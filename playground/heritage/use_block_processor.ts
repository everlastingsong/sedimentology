import mariadb from 'mariadb';
import { fetchBlock } from './worker/block_fetcher';
import { Worker, ConnectionOptions, Queue } from 'bullmq';
import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "./constants";
import axios from "axios";
import { Slot } from './common/types';
import { processBlock } from './worker/block_processor';

async function main() {
  const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'solana',
    connectionLimit: 10,
    bigIntAsNumber: true, // number is safe
  });

  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  const redis: ConnectionOptions = {
    host: "localhost",
    port: 6379,
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  
  const queueBlockProcessor = new Queue<number, void>("block_processor", { connection: redis });

  // clear queue
  await queueBlockProcessor.drain();

  // start worker
  const workerBlockProcessor = new Worker<number, void>("block_processor", async job => {
    const slot = job.data;
    console.log("consuming...", job.name, slot);

    //await sleep(20 * 1000);

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await processBlock(db, solana, slot);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      db?.end();
    }

    console.log("consumed");
  }, { connection: redis, concurrency: 1 });

  for (let i=0; i<5; i++) {
    console.log("enqueue jobs...");

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();

      const enqueued = await queueBlockProcessor.getJobs(["waiting", "active"]);

      const enqueuedSlotSet = new Set<number>();
      enqueued.forEach(job => { enqueuedSlotSet.add(job.data); });

      const rows = await db.query<Pick<Slot, "slot">[]>('SELECT slot FROM slots WHERE state = 1 ORDER BY slot ASC LIMIT 100');
      rows.forEach(row => {
        if (!enqueuedSlotSet.has(row.slot)) {
          console.log("enqueue", row.slot, "to block_fetcher");
          queueBlockProcessor.add(`block_processor(${row.slot})`, row.slot);
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      db?.end();
    }

    await sleep(10 * 1000);
  }

  //await pool.end();
}

main();