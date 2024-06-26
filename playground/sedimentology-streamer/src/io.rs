use base64::prelude::{Engine as _, BASE64_STANDARD};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use mysql::prelude::*;
use mysql::*;
use serde_derive::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{Read, BufWriter};

use crate::schema::{WhirlpoolState, WhirlpoolStateAccount, WhirlpoolTransaction, TransactionBalance, Transaction, TransactionInstruction};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct Slot {
    pub slot: u64,
    pub block_height: u64,
    pub block_time: i64,
}

#[derive(Debug, Deserialize, Serialize)]
struct PubkeyAndDataBase64 {
    pubkey: String,
    data_base64: String,
}

pub fn fetch_latest_state_date(database: &mut PooledConn) -> u32 {
    let date = database
        .exec_first("SELECT max(date) FROM states", Params::Empty)
        .unwrap();
    return date.unwrap();
}

pub fn fetch_state(yyyymmdd_date: u32, file_buffer: &mut Vec<u8>, database: &mut PooledConn) {
    let state: Option<(u64, u64, i64, Vec<u8>, Vec<u8>)> = database
        .exec_first(
            "
      SELECT 
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

    let (slot, block_height, block_time, program_compressed_data, account_compressed_data) =
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

    let state: WhirlpoolState = WhirlpoolState {
        slot,
        block_height,
        block_time,
        accounts,
        program_data,
    };

    // json stringify & compression
    let encoder = GzEncoder::new(file_buffer, flate2::Compression::default());
    let writer = BufWriter::new(encoder);
    serde_json::to_writer(writer, &state).unwrap();  
}

pub fn fetch_checkpoint_block_slot(database: &mut PooledConn) -> u64 {
  let slot = database
      .exec_first("SELECT checkpointBlockSlot FROM admState", Params::Empty)
      .unwrap();
  return slot.unwrap();
}

pub fn fetch_next_slot_infos(start_slot: u64, limit: u16, database: &mut PooledConn) -> Vec<Slot> {
    let slots = database.exec_map(
    "SELECT slot, blockHeight, blockTime FROM vwSlotsUntilCheckpoint WHERE slot >= :s ORDER BY slot ASC LIMIT :l",
    params! {
        "s" => start_slot,
        "l" => limit,
    },
    |(slot, block_height, block_time)| {
        Slot {
            slot,
            block_height,
            block_time,
        }
    },
  ).unwrap();

    assert!(slots.len() >= 1); // at least start_slot shoud be returned
    return slots;
}

pub fn fetch_transactions(slots: &Vec<Slot>, queue: &mut VecDeque<String>, database: &mut PooledConn) {
      let min_slot = slots[0].slot;
      let max_slot = slots[slots.len() - 1].slot;
      let min_txid = min_slot << 24;
      let max_txid = ((max_slot + 1) << 24) - 1;
  
      let mut transactions: Vec<(u64, String, String)> = database.exec(
        "SELECT txid, signature, toPubkeyBase58(payer) as payer FROM txs WHERE txid BETWEEN :s AND :e",
        params! {
            "s" => min_txid,
            "e" => max_txid,
        },
      ).unwrap();
      transactions.sort_by(|a, b| a.0.cmp(&b.0));
  
      let mut balances: Vec<(u64, String, u64, u64)> = database.exec(
        "SELECT txid, toPubkeyBase58(account) as account, pre, post FROM balances WHERE txid BETWEEN :s AND :e",
        params! {
            "s" => min_txid,
            "e" => max_txid,
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
            UNION ALL SELECT * FROM vwJsonIxsUpdateFeesAndRewards WHERE txid BETWEEN :s and :e",
            // no ORDER BY clause, sort at the client side
        params! {
            "s" => min_txid,
            "e" => max_txid,
        },
      ).unwrap();
      instructions.sort_by(|a, b| {
        let txid =  a.0.cmp(&b.0);
        let order = a.1.cmp(&b.1);
        txid.then(order)
      });
  
      for slot in slots {
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
        queue.push_back(jsonl);
      }
  
}
  