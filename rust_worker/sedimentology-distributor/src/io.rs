use mysql::prelude::*;
use mysql::*;
use replay_engine::decoded_instructions::DecodedInstruction;
use crate::schema::{WhirlpoolTransaction, TransactionBalance, Transaction, TransactionInstruction};

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

pub fn fetch_latest_distributed_slot(profile: &String, database: &mut PooledConn) -> (u64, u64) {
    let state: Option<(u64, u64)> = database
        .exec_first(
            "
        SELECT
          latestDistributedBlockSlot,
          latestDistributedBlockHeight
        FROM
          admDistributorState
        WHERE
          profile = :p
        ",
        params! {
          "p" => profile,
        })
        .unwrap();
    return state.unwrap();
}

pub fn fetch_dest_latest_distributed_slot(database: &mut PooledConn) -> (u64, u64) {
  let state: Option<(u64, u64)> = database
      .exec_first(
          "
      SELECT
        latestDistributedBlockSlot,
        latestDistributedBlockHeight
      FROM admDistributorDestState
      ",
      Params::Empty)
      .unwrap();
  return state.unwrap();
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

pub fn advance_distributor_dest_state(
    transactions: &Vec<(Slot, String)>,
    keep_block_height: u64,
    database: &mut PooledConn
) -> Result<(usize, usize)> {
  let mut tx = database.start_transaction(TxOpts::default()).unwrap();
  let compression_level = 3; // standard level

  // Inserting one row at a time is slow for a distant database, so insert multiple rows at once.
  // exec_batch does not reduce the number of communications, so assemble a statement with multiple VALUES.
  // max_allowed_packet should be set to a large value in the MariaDB configuration.
  //
  // see also: https://github.com/blackbeam/rust-mysql-simple/issues/59
  const INSERT_CHUNK_SIZE: usize = 32;

  let mut total_data_size = 0usize;
  let mut total_compressed_data_size = 0usize;
  for chunk in transactions.chunks(INSERT_CHUNK_SIZE) {
    let stmt = format!(
      "INSERT INTO transactions (slot, blockHeight, blockTime, data) VALUES {}", 
      chunk.iter().map(|_| "(?, ?, ?, ?)").collect::<Vec<_>>().join(", ")
    );

    let mut params = Vec::with_capacity(chunk.len() * 4);
    for (slot, data) in chunk {
      let compressed = zstd::encode_all(data.as_bytes(), compression_level).unwrap();

      // verification
      let decoded = zstd::decode_all(compressed.as_slice()).unwrap();
      let decoded_data = std::str::from_utf8(&decoded).unwrap();
      assert_eq!(decoded_data, data);
  
      total_data_size += data.len();
      total_compressed_data_size += compressed.len();
  
      params.push(mysql::Value::UInt(slot.slot));
      params.push(mysql::Value::UInt(slot.block_height));
      params.push(mysql::Value::Int(slot.block_time));
      params.push(mysql::Value::Bytes(compressed));
    }

    tx.exec_drop(&stmt, params).unwrap();
  }

  let latest_slot = transactions.last().unwrap().0;
  let delete_block_height_threshold = latest_slot.block_height.saturating_sub(keep_block_height);

  tx.exec_drop(
    "DELETE FROM transactions WHERE blockHeight < :h",
    params! {
        "h" => delete_block_height_threshold,
    },
  ).unwrap();

  tx.exec_drop(
    "UPDATE admDistributorDestState SET latestDistributedBlockSlot = :s, latestDistributedBlockHeight = :h, latestDistributedBlockTime = :t",
    params! {
        "s" => latest_slot.slot,
        "h" => latest_slot.block_height,
        "t" => latest_slot.block_time,
    },
  ).unwrap();

  tx.commit().unwrap();

  return Ok((total_data_size, total_compressed_data_size));  
}

pub fn advance_distributor_state(
  profile: &String,
  next_latest_slot: &Slot,
  database: &mut PooledConn
) -> Result<()> {
  let mut tx = database.start_transaction(TxOpts::default()).unwrap();

  tx.exec_drop(
    "UPDATE admDistributorState SET latestDistributedBlockSlot = :s, latestDistributedBlockHeight = :h, latestDistributedBlockTime = :t WHERE profile = :p",
    params! {
        "s" => next_latest_slot.slot,
        "h" => next_latest_slot.block_height,
        "t" => next_latest_slot.block_time,
        "p" => profile,
    },
  ).unwrap();

  tx.commit().unwrap();

  return Ok(());  
}

pub fn fetch_transactions(slots: &Vec<Slot>, database: &mut PooledConn) -> Vec<(Slot, String)> {
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
          ",
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

    let mut result = vec![];
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
      result.push((*slot, jsonl));
    }

    result
}