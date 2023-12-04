import mariadb from "mariadb";
import { Balance, Instruction, MinMaxSlot, Slot, Transaction } from "./type";
import invariant from "tiny-invariant";

const SELECT_VWIXS_SQL = [
  // 32 lines
  "SELECT * FROM vwixsAdminIncreaseLiquidity WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsCloseBundledPosition WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsClosePosition WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsCollectFees WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsCollectProtocolFees WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsCollectReward WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsDecreaseLiquidity WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsDeletePositionBundle WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsIncreaseLiquidity WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializeConfig WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializeFeeTier WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializePool WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializePositionBundle WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializePositionBundleWithMetadata WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializeReward WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsInitializeTickArray WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsOpenBundledPosition WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsOpenPosition WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsOpenPositionWithMetadata WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetCollectProtocolFeesAuthority WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetDefaultFeeRate WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetDefaultProtocolFeeRate WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetFeeAuthority WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetFeeRate WHERE txid BETWEEN ? and ?", 
  "UNION ALL SELECT * FROM vwixsSetProtocolFeeRate WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetRewardAuthority WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetRewardAuthorityBySuperAuthority WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetRewardEmissions WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSetRewardEmissionsSuperAuthority WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsSwap WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsTwoHopSwap WHERE txid BETWEEN ? and ?",
  "UNION ALL SELECT * FROM vwixsUpdateFeesAndRewards WHERE txid BETWEEN ? and ?",
].join("\n");

async function main() {
  const unixtime = Number(process.argv[2]);

  const minBlockTime = unixtime;
  const maxBlockTime = unixtime + 60 * 60 * 24 - 1;
//  console.log(`date: ${minBlockTime} ~ ${maxBlockTime}`);

  const mariadbHost = "localhost";
  const mariadbPort = 53306;
  const mariadbUser = "monitoring";
  const mariadbPassword = "monitoring";
  const mariadbDatabase = "whirlpool";
  const concurrency = 10;

  const pool = mariadb.createPool({
    host: mariadbHost,
    port: mariadbPort,
    user: mariadbUser,
    password: mariadbPassword,
    database: mariadbDatabase,
    connectionLimit: concurrency + 5, // margin: 5
    bigIntAsNumber: false, // use bigint
  });

  const db = await pool.getConnection();

  const [slotRange] = await db.query<MinMaxSlot[]>('SELECT min(slot) as minSlot, max(slot) as maxSlot FROM slots WHERE blockTime BETWEEN ? AND ?', [minBlockTime, maxBlockTime]);
//  console.log(slotRange);

  const slots = await db.query<Slot[]>('SELECT slot, blockHeight, blockTime FROM slots WHERE slot BETWEEN ? AND ? ORDER BY slot ASC', [slotRange.minSlot, slotRange.maxSlot]);
  const minSlot = slots[0];
  const maxSlot = slots[slots.length - 1];
//  console.log(`slots: ${slots.length}`);
//  console.log(minSlot, maxSlot);

  const targetSlots = slots;
//  console.log("slots reduced to 1000");

  const CHUNK_SIZE = 100;
  for (let cursor = 0; cursor < targetSlots.length; cursor += CHUNK_SIZE) {
    const chunk = targetSlots.slice(cursor, cursor + CHUNK_SIZE);

    const minSlot = chunk[0];
    const maxSlot = chunk[chunk.length - 1];
    const minTxid = minSlot.slot * BigInt(2 ** 24);
    const maxTxid = (maxSlot.slot + BigInt(1)) * BigInt(2 ** 24) - BigInt(1);

    // TODO: fix toPubkey use
    const transactions = await db.query<Transaction[]>('SELECT txid, signature, toPubkey(payer) as payer FROM txs WHERE txid BETWEEN ? AND ?', [minTxid, maxTxid]);
    transactions.sort((a, b) => { if (a.txid < b.txid) return -1; if (a.txid > b.txid) return 1; return 0; });

    // TODO: impl hasDeploy
    const hasDeploy = false;
    const hasTransaction = transactions.length > 0;
    if (!hasDeploy && !hasTransaction) continue;

    const balances = await db.query<Balance[]>('SELECT txid, toPubkey(account) as account, pre, post FROM balances WHERE txid BETWEEN ? AND ?', [minTxid, maxTxid]);
    balances.sort((a, b) => { if (a.txid < b.txid) return -1; if (a.txid > b.txid) return 1; return a.account.localeCompare(b.account); });

    const params = new Array(32).fill([minTxid, maxTxid]).flat();
    const instructions = await db.query<Instruction[]>(SELECT_VWIXS_SQL, params);

    // TODO: append deploy ix to instructions 

    instructions.sort((a, b) => { if (a.txid < b.txid) return -1; if (a.txid > b.txid) return 1; return a.order - b.order; });

    for (const slot of chunk) {
      const txs = [];
      const upper = (slot.slot + BigInt(1)) * BigInt(2 ** 24);
      while (transactions.length > 0 && transactions[0].txid < upper) {
        const tx = transactions.shift();

        const bs = [];
        while (balances.length > 0 && balances[0].txid === tx.txid) {
          const b = balances.shift();
          bs.push({
            account: b.account,
            pre: b.pre.toString(),
            post: b.post.toString(),
          });
        }

        const ixs = [];
        while (instructions.length > 0 && instructions[0].txid === tx.txid) {
          const ix = instructions.shift();
          ixs.push({
            name: ix.ix,
            payload: ix.json,
          });
        }

        txs.push({
          index: Number(tx.txid % BigInt(2 ** 24)),
          signature: tx.signature,
          payer: tx.payer,
          balances: bs,
          instructions: ixs,
        });
      }

      const jsonl = {
        slot: Number(slot.slot),
        blockHeight: Number(slot.blockHeight),
        blockTime: slot.blockTime,
        transactions: txs,
      }

      console.log(JSON.stringify(jsonl));
    }

    invariant(balances.length === 0, "balances must be empty");
    invariant(instructions.length === 0, "instructions must be empty");
  }


  await db.end();
  await pool.end();
}

main();
