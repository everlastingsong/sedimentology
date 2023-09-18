import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Block, Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

//import JSONBigInt from "json-bigint";
//import BigNumber from "bignumber.js";

// change BigNumber config to never use exponential notation
//BigNumber.config({ EXPONENTIAL_AT: 1e9 });

export async function processBlock(database: Connection, solana: AxiosInstance, slot: number) {
  const [{ state, blockHeight }] = await database.query<Slot[]>('SELECT * FROM slots WHERE slot = ?', [slot]);

  if (state !== SlotProcessingState.Fetched) {
    // already processed (or not fetched yet)
    return;
  }

  const [{ slot: querySlot, gzJsonString }] = await database.query<Block[]>('SELECT * FROM blocks WHERE slot = ?', [slot]);
  invariant(querySlot === slot, "slot must match");

  const jsonString = strFromU8(gunzipSync(gzJsonString));
  console.log("block", slot, jsonString);

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
