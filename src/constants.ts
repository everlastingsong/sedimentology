import { ConnectionConfig } from "mariadb";
import { ConnectionOptions }  from "bullmq";

export enum Queue {
  BLOCK_SEQUENCER = "block_sequencer",
}

export const REDIS_CONNECTION_CONFIG: ConnectionOptions = {
  host: "localhost",
  port: 6379,
};

export const DB_CONNECTION_CONFIG: ConnectionConfig = {
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'solana',
  // TODO: revisit, bigint is prefer ?
  bigIntAsNumber: true, // number is safe
};

export const SOLANA_RPC_URL = process.env["SOLANA_RPC_URL"];
