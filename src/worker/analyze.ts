import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Block, Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";

import { WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

// change BigNumber config to never use exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

export async function processBlocks(database: Connection, solana: AxiosInstance) {
  const fetchedSlots = await database.query<Slot[]>('SELECT * FROM slots WHERE state = ?', [SlotProcessingState.Fetched]);

  let totalBlocks = 0;
  let totalTransactions = 0;
  let totalTransactionDataSize = 0;
  let totalWhirlpoolTouchedTransactions = 0;
  let totalWhirlpoolTouchedOkTransactions = 0;
  let totalWhirlpoolTouchedErrTransactions = 0;
  let totalWhirlpoolTouchedOkTransactionDataSize = 0;
  let totalWhirlpoolTouchedErrTransactionDataSize = 0;
  const totalWhirlpoolInstructionCount = new Map<string, number>();

  for (const { slot, blockHeight } of fetchedSlots.slice(0, 10000)) {
    totalBlocks++;

    const [{ slot: querySlot, gzJsonString }] = await database.query<Block[]>('SELECT * FROM blocks WHERE slot = ?', [slot]);
    invariant(querySlot === slot, "slot must match");

    const jsonString = strFromU8(gunzipSync(gzJsonString));
    const json = JSONBigInt.parse(jsonString);

    // sanity check
    invariant(json.result, "result must exist");
    invariant(json.result.blockHeight === blockHeight, "blockHeight must match");
    invariant(JSONBigInt.stringify(json) === jsonString, "some data seems to be lost during JSON parse/stringify");

    const blockData = json.result;

//    console.log("transactions", blockData.transactions.length);

    const transactions = blockData.transactions.length;

    let whirlpoolTouchedTransactions = 0;
    let whirlpoolTouchedOkTransactions = 0;
    let whirlpoolTouchedOkTransactionDataSize = 0;
    let whirlpoolTouchedErrTransactions = 0;
    let whirlpoolTouchedErrTransactionDataSize = 0;
    const instructionCount = new Map<string, number>();

    for (const tx of blockData.transactions) {
      const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
      const writablePubkeys = tx.meta.loadedAddresses.writable;
      const staticPubkeys = tx.transaction.message.accountKeys;

      const allPubkeys = [...staticPubkeys, ...readonlyPubkeys, ...writablePubkeys];
      const touchWhirlpool = allPubkeys.includes(WHIRLPOOL_PUBKEY);

      if (!touchWhirlpool) continue;
      whirlpoolTouchedTransactions++;

      //console.log("whirlpool touched", tx.meta.err === null ? "ok " : "err", tx.transaction.signatures[0]);
      if (tx.meta.err !== null) {
        whirlpoolTouchedErrTransactions++;
        whirlpoolTouchedErrTransactionDataSize += JSONBigInt.stringify(tx).length;
        continue;
      }
      whirlpoolTouchedOkTransactions++;
      whirlpoolTouchedOkTransactionDataSize += JSONBigInt.stringify(tx).length;

      const whirlpoolEvents = WhirlpoolTransactionDecoder.decode({ result: tx }, new PublicKey(WHIRLPOOL_PUBKEY));
      //console.log(whirlpoolEvents);
      whirlpoolEvents.forEach((e) => {
        if (!instructionCount.has(e.name)) instructionCount.set(e.name, 0);
        instructionCount.set(e.name, instructionCount.get(e.name) + 1);
      });
    }

    console.log(
      "slot", slot,
      "blockHeight", blockHeight,
      "transactions", transactions,
      "WP", whirlpoolTouchedTransactions,
      "WP(ok)", whirlpoolTouchedOkTransactions,
      "WP(err)", whirlpoolTouchedErrTransactions,
      //"WP(ix)", instructionCount,
    );

    totalTransactions += transactions;
    totalTransactionDataSize += jsonString.length;
    totalWhirlpoolTouchedTransactions += whirlpoolTouchedTransactions;
    totalWhirlpoolTouchedOkTransactions += whirlpoolTouchedOkTransactions;
    totalWhirlpoolTouchedErrTransactions += whirlpoolTouchedErrTransactions;
    totalWhirlpoolTouchedOkTransactionDataSize += whirlpoolTouchedOkTransactionDataSize;
    totalWhirlpoolTouchedErrTransactionDataSize += whirlpoolTouchedErrTransactionDataSize;
    for (const [k, v] of instructionCount.entries()) {
      if (!totalWhirlpoolInstructionCount.has(k)) totalWhirlpoolInstructionCount.set(k, 0);
      totalWhirlpoolInstructionCount.set(k, totalWhirlpoolInstructionCount.get(k) + v);
    }  
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(3);

  console.log(
    "blocks", totalBlocks,
    "txs", totalTransactions,
    "txsDataSize", mb(totalTransactionDataSize), "MB",
    "WP(tx)", totalWhirlpoolTouchedTransactions,
    "WP(ok)", totalWhirlpoolTouchedOkTransactions,
    "WP(ok)DataSize", mb(totalWhirlpoolTouchedOkTransactionDataSize), "MB",
    "WP(err)", totalWhirlpoolTouchedErrTransactions,
    "WP(err)DataSize", mb(totalWhirlpoolTouchedErrTransactionDataSize), "MB",
    "WP(ix)", totalWhirlpoolInstructionCount,
  );

  console.log(
    "AVERAGE",
    "txs", (totalTransactions / totalBlocks).toFixed(3),
    "txsDataSize", mb(totalTransactionDataSize / totalBlocks), "MB",
    "WP(tx)", (totalWhirlpoolTouchedTransactions / totalBlocks).toFixed(3),
    "WP(ok)", (totalWhirlpoolTouchedOkTransactions / totalBlocks).toFixed(3),
    "WP(ok)DataSize", mb(totalWhirlpoolTouchedOkTransactionDataSize / totalBlocks), "MB",
    "WP(err)", (totalWhirlpoolTouchedErrTransactions / totalBlocks).toFixed(3),
    "WP(err)DataSize", mb(totalWhirlpoolTouchedErrTransactionDataSize / totalBlocks), "MB",
    "error rate (%)", ((totalWhirlpoolTouchedErrTransactions / totalWhirlpoolTouchedTransactions) * 100).toFixed(2),
  );

  /*
  await database.beginTransaction();
  await database.query("UPDATE slots SET blockHeight = ?, blockTime = ?, state = ? WHERE slot = ?", [blockHeight, blockTime, SlotProcessingState.Fetched, slot]);
  await database.query("INSERT INTO blocks (slot, gzJsonString) VALUES (?, BINARY(?))", [slot, Buffer.from(gzJsonString)]);
  await database.commit();
  */
}


import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const database = await createConnection(DB_CONNECTION_CONFIG);
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  await processBlocks(database, solana);
  await database.end();
}

main();
