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

export async function processBlock(database: Connection, solana: AxiosInstance, slot: number) {
  const [{ state, blockHeight }] = await database.query<Slot[]>('SELECT * FROM slots WHERE slot = ?', [slot]);

  if (state !== SlotProcessingState.Fetched) {
    // already processed (or not fetched yet)
    return;
  }

  const [{ slot: querySlot, gzJsonString }] = await database.query<Block[]>('SELECT * FROM blocks WHERE slot = ?', [slot]);
  invariant(querySlot === slot, "slot must match");

  const jsonString = strFromU8(gunzipSync(gzJsonString));
  const json = JSONBigInt.parse(jsonString);

  // sanity check
  invariant(json.result, "result must exist");
  invariant(json.result.blockHeight === blockHeight, "blockHeight must match");
  invariant(JSONBigInt.stringify(json) === jsonString, "some data seems to be lost during JSON parse/stringify");

  const blockData = json.result;

  console.log("transactions", blockData.transactions.length);

  const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

  for (const tx of blockData.transactions) {
    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const staticPubkeys = tx.transaction.message.accountKeys;

    const allPubkeys = [...staticPubkeys, ...readonlyPubkeys, ...writablePubkeys];
    const touchWhirlpool = allPubkeys.includes(WHIRLPOOL_PUBKEY);

    if (!touchWhirlpool) continue;

    console.log("whirlpool touched", tx.meta.err === null ? "ok " : "err", tx.transaction.signatures[0]);
    if (tx.meta.err !== null) continue;

    const whirlpoolEvents = WhirlpoolTransactionDecoder.decode({ result: tx }, new PublicKey(WHIRLPOOL_PUBKEY));
    console.log(whirlpoolEvents);
  }

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

  await processBlock(database, solana, 217833455);
  await database.end();
}

main();
