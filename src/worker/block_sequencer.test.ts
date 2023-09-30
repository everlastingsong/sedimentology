import { fetchSlots } from "./block_sequencer";
import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";

const BLOCK_LIMIT = 5;

async function main() {
  const database = await createConnection(DB_CONNECTION_CONFIG);
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  await fetchSlots(database, solana, BLOCK_LIMIT);
  await database.end();
}

main();