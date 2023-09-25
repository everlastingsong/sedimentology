import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Block, Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";

import { PublicKey } from "@solana/web3.js";
import { DecodedWhirlpoolInstruction, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

import { LRUCache } from "lru-cache";

import { processBlock } from "./block_processor";

// change BigNumber config to never use exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const WHIRLPOOL_PUBKEY_BASE58 = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const WHIRLPOOL_PUBKEY = new PublicKey(WHIRLPOOL_PUBKEY_BASE58);

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });



import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";

async function main() {
  const database = await createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'localtest',
    bigIntAsNumber: true, // number is safe
  });

  const solana = axios.create({
    baseURL: "http://localhost:8899",
    method: "post",
  });
  
  await processBlock(database, solana, 401);
  await database.end();
}

main();
