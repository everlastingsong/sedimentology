import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

//import JSONBigInt from "json-bigint";
//import BigNumber from "bignumber.js";

// change BigNumber config to never use exponential notation
//BigNumber.config({ EXPONENTIAL_AT: 1e9 });

export async function fetchBlock(database: Connection, solana: AxiosInstance, slot: number) {
  const [{ state, blockHeight }] = await database.query<Slot[]>('SELECT * FROM slots WHERE slot = ?', [slot]);

  if (state !== SlotProcessingState.Added) {
    // already fetched
    return;
  }

  // getBlock
  // see: https://docs.solana.com/api/http#getblock
  const response = await solana.request({
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "getBlock",
      params: [
        slot,
        {
          "encoding": "json",
          "transactionDetails": "full",
          "maxSupportedTransactionVersion": 0,
        },
      ],
    },
    // to preserve u64 value, do not use default JSON.parse
    transformResponse: (r) => r,
    // use gzip compression to reduce network traffic
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    decompress: true, // axios automatically decompresses gzip response
  });

  const originalData = response.data as string;
  const data = JSON.parse(originalData);

  if (data.error) {
    throw new Error(`getBlock(${slot}) failed: ${JSON.stringify(data.error)}`);
  }
  invariant(data.result, "result must be truthy");

  // sanity check
  invariant(data.result.blockHeight, "blockHeight must exist");
  invariant(data.result.blockTime, "blockTime must exist");
  invariant(data.result.blockhash, "blockhash must exist");
  invariant(data.result.parentSlot, "parentSlot must exist");
  invariant(data.result.previousBlockhash, "previousBlockhash must exist");
  invariant(data.result.transactions, "transactions must exist");

  invariant(data.result.blockHeight == blockHeight, "blockHeight must match");

  const blockTime = data.result.blockTime;

  // compression & decompression sanity check
  const gzJsonString = gzipSync(strToU8(originalData));
  invariant(strFromU8(gunzipSync(gzJsonString)) === originalData, "compression must be reversible");

  await database.beginTransaction();
  await database.query("UPDATE slots SET blockHeight = ?, blockTime = ?, state = ? WHERE slot = ?", [blockHeight, blockTime, SlotProcessingState.Fetched, slot]);
  await database.query("INSERT INTO blocks (slot, gzJsonString) VALUES (?, BINARY(?))", [slot, Buffer.from(gzJsonString)]);
  await database.commit();
}

/*
import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";

async function main() {
  const database = await createConnection(DB_CONNECTION_CONFIG);
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  await fetchBlock(database, solana, 217833455);
  await database.end();
}

main();
*/