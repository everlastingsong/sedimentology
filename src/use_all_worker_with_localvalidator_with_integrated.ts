import mariadb from 'mariadb';
import { Worker, ConnectionOptions, Queue } from 'bullmq';
import axios from "axios";
import { Slot } from './types';
import { fetchSlots } from './worker/block_sequencer';
import { fetchAndProcessBlock } from './worker/block_integrated_fetcher_processor';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'localtest0',
    connectionLimit: 20,
    bigIntAsNumber: true, // number is safe
  });

  const solana = axios.create({
    baseURL: "http://localhost:8899",
    method: "post",
  });

  const redis: ConnectionOptions = {
    host: "localhost",
    port: 6379,
    db: 3,
  };

  const MAX_ADD_SLOT_PER_JOB = 100;

  const QUEUE_BLOCK_SEQUENCER = "block_sequencer";
  const QUEUE_BLOCK_FETCHER_AND_PROCESSOR = "block_fetcher";

  const queueBlockSequencer = new Queue<void, void>(QUEUE_BLOCK_SEQUENCER, { connection: redis });
  const queueBlockFetcherAndProcessor = new Queue<number, void>(QUEUE_BLOCK_FETCHER_AND_PROCESSOR, { connection: redis });

  // clear queue
  console.log("clear queue...");
  await queueBlockSequencer.obliterate({force: true});
  await queueBlockFetcherAndProcessor.obliterate({force: true});

  // build worker
  console.log("build worker...");
  const workerBlockSequencer = new Worker<void, void>(QUEUE_BLOCK_SEQUENCER, async job => {
    console.log("block_sequencer consuming...");

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await fetchSlots(db, solana, MAX_ADD_SLOT_PER_JOB);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      db?.end();
    }

    console.log("block_sequencer consumed");
  }, { connection: redis, concurrency: 1, autorun: false });

  const workerBlockFetcher = new Worker<number, void>(QUEUE_BLOCK_FETCHER_AND_PROCESSOR, async job => {
    const slot = job.data;
    console.log("block_fetcher consuming...", job.name, slot);

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await fetchAndProcessBlock(db, solana, slot);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      db?.end();
    }

    console.log("block_fetcher consumed", slot);
  }, { connection: redis, concurrency: 10, autorun: false });

  // start worker
  // await するとワーカー終了まで待つので進まない
  console.log("start worker...");
  workerBlockSequencer.run();
  workerBlockFetcher.run();

  console.log("add sequencer repeated job...");
  queueBlockSequencer.add("sequencer repeated", undefined, { repeat: { every: 10 * 1000 } });
  
  //for (let i=0; i<5; i++) {
  console.log("start dispatch...");
  while (true) {
    console.log("enqueue jobs...");

    let db: mariadb.Connection;

    // enqueue block_fetcher
    let blockFetcherJobCount = 0;
    try {
      db = await pool.getConnection();

      const enqueued = await queueBlockFetcherAndProcessor.getJobs(["waiting", "active"]);
      const enqueuedSlotSet = new Set<number>();
      enqueued.forEach(job => { enqueuedSlotSet.add(job.data); });

      const rows = await db.query<Pick<Slot, "slot">[]>('SELECT slot FROM slots WHERE state = 0 ORDER BY slot ASC LIMIT 2000');
      rows.forEach(row => {
        if (!enqueuedSlotSet.has(row.slot)) {
          queueBlockFetcherAndProcessor.add(`block_fetcher(${row.slot})`, row.slot);
          blockFetcherJobCount++;
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      db?.end();
    }

    console.log("enqueue", "fetcher", blockFetcherJobCount);

    await sleep(10 * 1000);
  }

  //await pool.end();
}

main();