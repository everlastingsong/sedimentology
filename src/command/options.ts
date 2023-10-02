import { Command } from "commander";

export function addConnectionOptions(program: Command, mariadb: boolean = true, redis: boolean = true, solana: boolean = true) {
  mariadb && program
    .option("--mariadb-host <host>", "mariadb host", "localhost")
    .option("--mariadb-port <port>", "mariadb port", "3306")
    .option("--mariadb-user <user>", "mariadb user", "root")
    .option("--mariadb-password <password>", "mariadb password", "password")
    .option("--mariadb-database <database>", "mariadb database", "whirlpool");
  redis && program
    .option("--redis-host <host>", "redis host", "localhost")
    .option("--redis-port <port>", "redis port", "6379")
    .option("--redis-db <db>", "redis db", "0");
  solana && program
    .option("--solana-rpc-url <url>", "solana RPC URL", "http://localhost:8899");
}
