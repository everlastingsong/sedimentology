use base64::prelude::{Engine as _, BASE64_STANDARD};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use mysql::prelude::*;
use mysql::*;
use replay_engine::decoded_instructions::{from_json, DecodedInstruction};
use replay_engine::account_data_store::AccountDataStore;
use replay_engine::types::{ProgramData, Slot};
use serde_derive::{Deserialize, Serialize};
use std::io::{Read, Write};

#[derive(Debug, PartialEq, Eq)]
pub struct Instruction {
    pub txid: u64,
    pub order: u32,
    pub ix_name: String,
    pub ix: DecodedInstruction,
}

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
    pub accounts: AccountDataStore,
}

#[derive(Debug, Deserialize, Serialize)]
struct PubkeyAndDataBase64 {
    pubkey: String,
    data_base64: String,
}

pub fn fetch_latest_replayed_date(database: &mut PooledConn) -> u32 {
    let date = database
        .exec_first("SELECT latestReplayedDate FROM admReplayerState", Params::Empty)
        .unwrap();
    return date.unwrap();
}

pub fn fetch_state(date: u32, database: &mut PooledConn) -> State {
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
                "d" => date,
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

    let mut accounts = AccountDataStore::new_on_memory();
    account_csv_reader
        .deserialize::<PubkeyAndDataBase64>()
        .for_each(|row| {
            let row = row.unwrap();
            let data = BASE64_STANDARD.decode(row.data_base64).unwrap();
            accounts.upsert(&row.pubkey, &data).unwrap();
        });

    return State {
        date,
        slot,
        block_height,
        block_time,
        program_data,
        accounts,
    };
}

pub fn fetch_slot_info(slot: u64, database: &mut PooledConn) -> Slot {
    let mut slots = database
        .exec_map(
            "SELECT slot, blockHeight, blockTime FROM vwSlotsUntilCheckpoint WHERE slot = :s",
            params! {
                "s" => slot,
            },
            |(slot, block_height, block_time)| Slot {
                slot,
                block_height,
                block_time,
            },
        )
        .unwrap();

    assert_eq!(slots.len(), 1);
    return slots.pop().unwrap();
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

pub fn fetch_instructions_in_slot(slot: u64, database: &mut PooledConn) -> Vec<Instruction> {
    let txid_start = slot << 24;
    let txid_end = ((slot + 1) << 24) - 1;

    let mut ixs_in_slot = database.exec_map(
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
          UNION ALL SELECT * FROM vwJsonIxsOpenPositionWithTokenExtensions WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsClosePositionWithTokenExtensions WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsLockPosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsResetPositionRange WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsTransferLockedPosition WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializeAdaptiveFeeTier WHERE txid BETWEEN :s and :e
          UNION ALL SELECT * FROM vwJsonIxsInitializePoolWithAdaptiveFee WHERE txid BETWEEN :s and :e
          ",
          // no ORDER BY clause, sort at the client side
      params! {
          "s" => txid_start,
          "e" => txid_end,
      },
      |(txid, order, ix, payload)| {
          let ix_name: String = ix;
          Instruction {
              txid,
              order,
              ix_name: ix_name.clone(),
              ix: from_json(&ix_name, &payload).unwrap(),
          }
      },
  ).unwrap();

    // order by txid, order
    ixs_in_slot.sort_by_key(|ix| (ix.txid, ix.order));

    return ixs_in_slot;
}

pub fn advance_replayer_state(
    date: u32,
    slot: &Slot,
    program_data: &ProgramData,
    accounts: &AccountDataStore,
    database: &mut PooledConn
) -> Result<()> {
  //  Vec<u8> -> base64 encoded -> gzip encoded
  let program_data_base64 = BASE64_STANDARD.encode(program_data);
  let mut program_data_gz = GzEncoder::new(Vec::new(), flate2::Compression::default());
  program_data_gz.write_all(program_data_base64.as_bytes()).unwrap();
  let program_compressed_data = program_data_gz.finish().unwrap();

  // AccountMap -> base58,base64 csv -> gzip encoded
  let encoder = GzEncoder::new(Vec::new(), flate2::Compression::default());
  let mut writer = csv::WriterBuilder::new()
      .has_headers(false)
      .from_writer(encoder);

  accounts.traverse(|pubkey, data| {
    let data_base64 = BASE64_STANDARD.encode(data);
    let row = PubkeyAndDataBase64 {
        pubkey: pubkey.to_string(),
        data_base64,
    };
    writer.serialize(row).unwrap();

    Ok(())
  }).unwrap();

  writer.flush().unwrap();
  let account_compressed_data = writer.into_inner().unwrap().finish().unwrap();

  let mut tx = database.start_transaction(TxOpts::default()).unwrap();

  tx.exec_drop(
      "INSERT INTO states (date, slot, programCompressedData, accountCompressedData) VALUES (:d, :s, :p, :a)",
      params! {
          "d" => date,
          "s" => slot.slot,
          "p" => program_compressed_data,
          "a" => account_compressed_data,
      },
  ).unwrap();

  tx.exec_drop(
    "UPDATE admReplayerState SET latestReplayedDate = :d",
    params! {
        "d" => date,
    },
  ).unwrap();

  tx.commit().unwrap();

  return Ok(());  
}
