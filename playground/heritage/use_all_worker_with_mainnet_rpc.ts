import mariadb from 'mariadb';
import { fetchBlock } from './worker/block_fetcher';
import { Worker, ConnectionOptions, Queue } from 'bullmq';
import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "./constants";
import axios from "axios";
import { Slot } from './common/types';
import { processBlock } from './worker/block_processor';
import { fetchSlots } from './worker/fetch_slots';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'localtest',
    connectionLimit: 100,
    bigIntAsNumber: true, // number is safe
  });

  const solana = axios.create({
    baseURL: process.env["SOLANA_RPC_URL"],
    method: "post",
  });

  const solana2 = axios.create({
    baseURL: process.env["SOLANA_RPC_URL2"],
    method: "post",
  });

  const redis: ConnectionOptions = {
    host: "localhost",
    port: 6379,
    db: 2,
  };

  const MAX_ADD_SLOT_PER_JOB = 100;

  const QUEUE_BLOCK_SEQUENCER = "block_sequencer";
  const QUEUE_BLOCK_FETCHER = "block_fetcher";
  const QUEUE_BLOCK_PROCESSOR = "block_processor";

  const queueBlockSequencer = new Queue<void, void>(QUEUE_BLOCK_SEQUENCER, { connection: redis });
  const queueBlockFetcher = new Queue<number, void>(QUEUE_BLOCK_FETCHER, { connection: redis });
  const queueBlockProcessor = new Queue<number, void>(QUEUE_BLOCK_PROCESSOR, { connection: redis });

  // clear queue
  console.log("clear queue...");
  await queueBlockSequencer.obliterate({force: true});
  await queueBlockFetcher.obliterate({force: true});
  await queueBlockProcessor.obliterate({force: true});

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

  const workerBlockFetcher = new Worker<number, void>(QUEUE_BLOCK_FETCHER, async job => {
    const slot = job.data;
    console.log("block_fetcher consuming...", job.name, slot);

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await fetchBlock(db, solana, slot);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      db?.end();
    }

    console.log("block_fetcher consumed", slot);
  }, { connection: redis, concurrency: 20, autorun: false });

  const workerBlockFetcher2 = new Worker<number, void>(QUEUE_BLOCK_FETCHER, async job => {
    const slot = job.data;
    console.log("block_fetcher2 consuming...", job.name, slot);

    let db: mariadb.Connection;
    try {
      db = await pool.getConnection();
      await fetchBlock(db, solana2, slot);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      db?.end();
    }

    console.log("block_fetcher2 consumed", slot);
  }, { connection: redis, concurrency: 10, autorun: false });

  const workerBlockProcessor = new Worker<number, void>(QUEUE_BLOCK_PROCESSOR, async job => {
    const slot = job.data;
    console.log("block_processor consuming...", job.name, slot);

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

    console.log("block_processor consumed", slot);
  }, { connection: redis, concurrency: 5, autorun: false });

  // start worker
  // await するとワーカー終了まで待つので進まない
  console.log("start worker...");
  workerBlockSequencer.run();
  workerBlockFetcher.run();
  workerBlockFetcher2.run();
  workerBlockProcessor.run();

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

      const enqueued = await queueBlockFetcher.getJobs(["waiting", "active"]);
      const enqueuedSlotSet = new Set<number>();
      enqueued.forEach(job => { enqueuedSlotSet.add(job.data); });

      const rows = await db.query<Pick<Slot, "slot">[]>('SELECT slot FROM slots WHERE state = 0 ORDER BY slot ASC LIMIT 1000');
      rows.forEach(row => {
        if (!enqueuedSlotSet.has(row.slot)) {
          queueBlockFetcher.add(`block_fetcher(${row.slot})`, row.slot);
          blockFetcherJobCount++;
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      db?.end();
    }

    // enqueue block_processor
    let blockProcessorJobCount = 0;
    try {
      db = await pool.getConnection();

      const enqueued = await queueBlockProcessor.getJobs(["waiting", "active"]);
      const enqueuedSlotSet = new Set<number>();
      enqueued.forEach(job => { enqueuedSlotSet.add(job.data); });

      const rows = await db.query<Pick<Slot, "slot">[]>('SELECT slot FROM slots WHERE state = 1 ORDER BY slot ASC LIMIT 1000');
      rows.forEach(row => {
        if (!enqueuedSlotSet.has(row.slot)) {
          queueBlockProcessor.add(`block_processor(${row.slot})`, row.slot);
          blockProcessorJobCount++;
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      db?.end();
    }

    console.log("enqueue", "fetcher", blockFetcherJobCount, "processor", blockProcessorJobCount);

    await sleep(10 * 1000);
  }

  //await pool.end();
}

main();