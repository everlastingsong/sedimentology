import mariadb from "mariadb";
import axios from "axios";
import { ConnectionOptions, delay, Worker } from "bullmq";
import { Commitment, WorkerQueueName } from "../common/types";
import { program } from "commander";
import { addConnectionOptions } from "./options";
import { fetchAndProcessBlock } from "../worker/fetch_and_process_block";

const ERROR_COOLDOWN_DELAY_MS = 5_000; // 5s
const ERROR_BURST_DELAY_MS = 10_000; // 10s
const ERROR_BURST_THRESHOLD = 1000;

async function main() {
  addConnectionOptions(program, true, true, true);
  program
    .option("-c --concurrency <max>", "concurrency", "10")
    .option("-C --confirmed", "commitment is confirmed");

  const options = program.parse().opts();

  const concurrency = Number(options.concurrency);
  const commitment: Commitment = options.confirmed ? "confirmed" : "finalized";

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

  let consectiveErrors = 0;

  console.log("build worker...");
  const worker = new Worker<number, void>(WorkerQueueName.PROCESSOR, async (job) => {
    const slot = job.data;

    // Stop processing when an error burst occurs to prevent excessive RPC credit consumption.
    if (consectiveErrors >= ERROR_BURST_THRESHOLD) {
      await delay(ERROR_BURST_DELAY_MS);
      console.warn("job dropped (error burst)", slot);
      throw new Error("Job dropped due to an error burst");
    }

    console.info("job consuming...", slot);

    let db: mariadb.Connection | undefined;
    try {
      db = await pool.getConnection();
      await fetchAndProcessBlock(db, solana, slot, commitment);
      consectiveErrors = 0;
    } catch (err) {
      consectiveErrors++;
      console.error(err);
      await delay(ERROR_COOLDOWN_DELAY_MS);
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
