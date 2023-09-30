import mariadb from "mariadb";
import axios from "axios";
import { ConnectionOptions, Worker } from "bullmq";
import { WorkerQueueName } from "../common/types";
import { program } from "commander";
import { addConnectionOptions } from "./options";
import { fetchAndProcessBlock } from "../worker/fetch_and_process_block";

async function main() {
  addConnectionOptions(program, true, true, true);
  program
    .option("-c --concurrency <max>", "concurrency", "10");

  const options = program.parse().opts();

  const concurrency = Number(options.concurrency);

  const pool = mariadb.createPool({
    host: options.mariadbHost,
    port: Number(options.mariadbPort),
    user: options.mariadbUser,
    password: options.mariadbPassword,
    database: options.mariadbDatabase,
    connectionLimit: concurrency + 5, // margin: 5
    bigIntAsNumber: true, // all referencing BigInt fields <= Number.MAX_SAFE_INTEGER
  });

  const redis: ConnectionOptions = {
    host: options.redisHost,
    port: Number(options.redisPort),
    db: Number(options.redisDb),
  };

  const solana = axios.create({
    baseURL: options.solanaRpcUrl,
    method: "post",
  });

  console.log("build worker...");
  const worker = new Worker<number, void>(WorkerQueueName.PROCESSOR, async (job) => {
    const slot = job.data;
    console.info("job consuming...", slot);

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await fetchAndProcessBlock(db, solana, slot);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      db?.end();
    }

    console.info("job consumed", slot);
  }, { connection: redis, concurrency, autorun: false });

  // graceful shutdown
  process.on("SIGINT", async () => {
    console.info("SIGINT");
    console.info("close worker...");
    await worker.close();
    console.info("close pool...");
    await pool.end();
    process.exit(0);
  });

  console.info("start worker...");
  await worker.run();
}

main();
