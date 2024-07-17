use base64::prelude::{Engine as _, BASE64_STANDARD};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use mysql::prelude::*;
use mysql::*;
use replay_engine::decoded_instructions::{from_json, DecodedInstruction};
use serde_derive::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::{
  fs::File,
  io::{BufRead, BufReader, BufWriter, LineWriter},
};

use crate::date;

use crate::schema::{TokenDecimals, Transaction, TransactionBalance, TransactionInstruction, WhirlpoolState, WhirlpoolStateAccount, WhirlpoolTransaction};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct Slot {
    pub slot: u64,
    pub block_height: u64,
    pub block_time: i64,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Instruction {
    pub txid: u64,
    pub order: u32,
    pub ix_name: String,
    pub ix: DecodedInstruction,
}
/* 
pub struct CompressedState {
    pub date: u32,
    pub slot: u64,
    // gzip compressed base64 string
    pub program_compressed_data: Vec<u8>,
    // gzip compressed csv string (pubkey(base58),data(base64))
    pub account_compressed_data: Vec<u8>,
}

pub struct State {
    pub date: u32,
    pub slot: u64,
    pub block_height: u64,
    pub block_time: i64,
    pub program_data: Vec<u8>,
    pub accounts: AccountMap,
}
*/
#[derive(Debug, Deserialize, Serialize)]
struct PubkeyAndDataBase64 {
    pubkey: String,
    data_base64: String,
}

// TODO: refactor (dedup)
pub fn fetch_latest_replayed_date(database: &mut PooledConn) -> u32 {
  let date = database
      .exec_first("SELECT latestReplayedDate FROM admReplayerState", Params::Empty)
      .unwrap();
  return date.unwrap();
}

pub fn fetch_latest_archived_date(profile: &String, database: &mut PooledConn) -> u32 {
    let date = database
        .exec_first("SELECT latestArchivedDate FROM admArchiverState WHERE profile = :p",
        params! {
            "p" => profile,
        })
        .unwrap();
    return date.unwrap();
}

pub fn export_state(yyyymmdd_date: u32, file: &String, database: &mut PooledConn) {
    let state: Option<(u32, u64, u64, i64, Vec<u8>, Vec<u8>)> = database
        .exec_first(
            "
      SELECT 
          states.date,
          states.slot,
          slots.blockHeight,
          slots.blockTime,
          states.programCompressedData,
          states.accountCompressedData
      FROM
          states LEFT OUTER JOIN slots ON states.slot = slots.slot
      WHERE
          states.date = :d
      ",
            params! {
                "d" => yyyymmdd_date,
            },
        )
        .unwrap();

    let (date, slot, block_height, block_time, program_compressed_data, account_compressed_data) =
        state.unwrap();

    // gzip decoded -> base64 decoded -> Vec<u8>
    let mut program_data_gz = GzDecoder::new(program_compressed_data.as_slice());
    let mut program_data_base64 = String::new();
    program_data_gz
        .read_to_string(&mut program_data_base64)
        .unwrap();
    let program_data = BASE64_STANDARD.decode(program_data_base64.trim()).unwrap();

    // gzip decoded -> base58,base64 csv -> AccountMap
    let account_data_gz = GzDecoder::new(account_compressed_data.as_slice());
    let mut account_csv_reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(account_data_gz);

    let mut accounts: Vec<WhirlpoolStateAccount> = account_csv_reader
        .deserialize::<PubkeyAndDataBase64>()
        .map(|row| {
            let row = row.unwrap();
            let data = BASE64_STANDARD.decode(row.data_base64).unwrap();
            WhirlpoolStateAccount {
                pubkey: row.pubkey,
                data,
            }
        })
        .collect();

    accounts.sort_by(|a, b| a.pubkey.cmp(&b.pubkey));

    // This process assumes that backfilling has been completed.
    // More precisely, it requires that the initialization and reward initialization instructions
    // for all Whirlpool accounts in the state have been indexed.
    //
    // [REASON]
    // I wanted to avoid parsing whirlpool accounts and relying on whirlpools crates.
    // I could parse the whirlpool account, extract the mint addresses,
    // and resolve it with decimals fetched from the DB, but SQL is much simpler.
    //
    // If this process becomes too slow, just record the minimum value of txid to decimals table.
    let max_txid = ((slot + 1) << 24) - 1;
    let decimals: Vec<TokenDecimals> = database.exec_map(
        "
        SELECT
            toPubkeyBase58(mints.mint),
            resolveDecimals(mints.mint)
        FROM (
                  SELECT keyTokenMintA mint FROM ixsInitializePool WHERE txid <= :e
            UNION SELECT keyTokenMintB mint FROM ixsInitializePool WHERE txid <= :e
            UNION SELECT keyTokenMintA mint FROM ixsInitializePoolV2 WHERE txid <= :e
            UNION SELECT keyTokenMintB mint FROM ixsInitializePoolV2 WHERE txid <= :e
            UNION SELECT keyRewardMint mint FROM ixsInitializeReward WHERE txid <= :e
            UNION SELECT keyRewardMint mint FROM ixsInitializeRewardV2 WHERE txid <= :e
        ) mints
        ",
        params! {
            "e" => max_txid,
        },
        |(mint, decimals)| TokenDecimals {
            mint,
            decimals,
        },
    )
    .unwrap();

    let state: WhirlpoolState = WhirlpoolState {
        slot,
        block_height,
        block_time,
        accounts,
        decimals,
        program_data,
    };

    save_to_whirlpool_state_file(file, &state);
}

// TODO: refactor(dedup) replayer::io
pub fn save_to_whirlpool_state_file(file_path: &String, state: &WhirlpoolState) {
  let file = File::create(file_path).unwrap();
  let encoder = GzEncoder::new(file, flate2::Compression::default());
  let writer = BufWriter::new(encoder);
  serde_json::to_writer(writer, state).unwrap();
}

pub fn export_transaction(yyyymmdd_date: u32, file: &String, database: &mut PooledConn) {
  let min_block_time = date::convert_yyyymmdd_to_unixtime(yyyymmdd_date);
  let max_block_time = min_block_time + 24 * 60 * 60 - 1;

  let slog_range: Option<(u64, u64)> = database.exec_first(
    "SELECT min(slot), max(slot) FROM vwSlotsUntilCheckpoint WHERE blockTime BETWEEN :s AND :e",
    params! {
        "s" => min_block_time,
        "e" => max_block_time,
    },
  ).unwrap();

  let (min_slot, max_slot) = slog_range.unwrap();

  let slots = database.exec_map(
    "SELECT slot, blockHeight, blockTime FROM vwSlotsUntilCheckpoint WHERE slot BETWEEN :s AND :e ORDER BY slot ASC",
    params! {
        "s" => min_slot,
        "e" => max_slot,
    },
    |(slot, block_height, block_time)| {
        Slot {
            slot,
            block_height,
            block_time,
        }
    },
  ).unwrap();

  let f = File::create(file).unwrap();
  let encoder = GzEncoder::new(f, flate2::Compression::default());
  let mut writer = LineWriter::new(encoder);


  let chunk_size = 1000;
  for chunk in slots.chunks(chunk_size) {
    let chunk_min_slot = chunk[0].slot;
    let chunk_max_slot = chunk[chunk.len() - 1].slot;
    let chunk_min_txid = chunk_min_slot << 24;
    let chunk_max_txid = ((chunk_max_slot + 1) << 24) - 1;

    let mut transactions: Vec<(u64, String, String)> = database.exec(
      "SELECT txid, signature, toPubkeyBase58(payer) as payer FROM txs WHERE txid BETWEEN :s AND :e",
      params! {
          "s" => chunk_min_txid,
          "e" => chunk_max_txid,
      },
    ).unwrap();
    transactions.sort_by(|a, b| a.0.cmp(&b.0));

    let mut balances: Vec<(u64, String, u64, u64)> = database.exec(
      "SELECT txid, toPubkeyBase58(account) as account, pre, post FROM balances WHERE txid BETWEEN :s AND :e",
      params! {
          "s" => chunk_min_txid,
          "e" => chunk_max_txid,
      },
    ).unwrap();
    balances.sort_by(|a, b| {
      let txid =  a.0.cmp(&b.0);
      let account = a.1.cmp(&b.1);
      txid.then(account)
    });

    let mut instructions: Vec<(u64, u8, String, String)> = database.exec(
      // Since select for UNION ALL view of these views was too slow, I didn't use UNION ALL view.
      "
                    SELECT * FROM vwJsonIxsProgramDeploy WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsAdminIncreaseLiquidity WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCloseBundledPosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsClosePosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectFees WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectProtocolFees WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectReward WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsDecreaseLiquidity WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsDeletePositionBundle WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsIncreaseLiquidity WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeConfig WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeFeeTier WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializePool WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializePositionBundle WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializePositionBundleWithMetadata WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeReward WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeTickArray WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsOpenBundledPosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsOpenPosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsOpenPositionWithMetadata WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetCollectProtocolFeesAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetDefaultFeeRate WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetDefaultProtocolFeeRate WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetFeeAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetFeeRate WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetProtocolFeeRate WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetRewardAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetRewardAuthorityBySuperAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetRewardEmissions WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetRewardEmissionsSuperAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSwap WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsTwoHopSwap WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsUpdateFeesAndRewards WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectFeesV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectProtocolFeesV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsCollectRewardV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsDecreaseLiquidityV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsIncreaseLiquidityV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSwapV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsTwoHopSwapV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializePoolV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeRewardV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetRewardEmissionsV2 WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeConfigExtension WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeTokenBadge WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsDeleteTokenBadge WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetConfigExtensionAuthority WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsSetTokenBadgeAuthority WHERE txid BETWEEN :s and :e
          ",
          // no ORDER BY clause, sort at the client side
      params! {
          "s" => chunk_min_txid,
          "e" => chunk_max_txid,
      },
    ).unwrap();
    instructions.sort_by(|a, b| {
      let txid =  a.0.cmp(&b.0);
      let order = a.1.cmp(&b.1);
      txid.then(order)
    });

    for slot in chunk {
      let mut txs: Vec<Transaction> = Vec::new();
      let upper = (slot.slot + 1) << 24;
      while transactions.len() > 0 && transactions[0].0 < upper {
        let tx = transactions.remove(0);
        let txid = tx.0;
        let signature = tx.1;
        let payer = tx.2;

        let mut balances_in_tx: Vec<TransactionBalance> = Vec::new();
        while balances.len() > 0 && balances[0].0 == txid {
          let balance = balances.remove(0);
          balances_in_tx.push(TransactionBalance {
            account: balance.1,
            pre: balance.2,
            post: balance.3,
          });
        }

        let mut instructions_in_tx: Vec<TransactionInstruction> = Vec::new();
        while instructions.len() > 0 && instructions[0].0 == txid {
          let instruction = instructions.remove(0);
          instructions_in_tx.push(TransactionInstruction {
            name: instruction.2,
            payload: serde_json::from_str(&instruction.3).unwrap(),
          });
        }

        txs.push(Transaction {
          index: u32::try_from(txid & 0xffffff).unwrap(),
          signature,
          payer,
          balances: balances_in_tx,
          instructions: instructions_in_tx,
        });
      }

      let transaction: WhirlpoolTransaction = WhirlpoolTransaction {
        slot: slot.slot,
        block_height: slot.block_height,
        block_time: slot.block_time,
        transactions: txs,
      };

      let jsonl = serde_json::to_string(&transaction).unwrap();
      writer.write_all(jsonl.as_bytes()).unwrap();
      writer.write_all(b"\n").unwrap();
    }
  }

  writer.flush().unwrap();
}

pub fn advance_archiver_state(profile: &String, yyyymmdd_date: u32, database: &mut PooledConn) -> Result<()> {
  let mut tx = database.start_transaction(TxOpts::default()).unwrap();

  tx.exec_drop(
    "UPDATE admArchiverState SET latestArchivedDate = :d WHERE profile = :p",
    params! {
        "d" => yyyymmdd_date,
        "p" => profile,
    },
  ).unwrap();

  tx.commit().unwrap();

  return Ok(());  
}
