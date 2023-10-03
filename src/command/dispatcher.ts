import mariadb from "mariadb";
import { ConnectionOptions, Queue } from "bullmq";
import { Slot, WorkerQueueName } from "../common/types";
import { program } from "commander";
import { addConnectionOptions } from "./options";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  addConnectionOptions(program, true, true, false);
  program
    .option("-i --interval <interval>", "dispatch interval (seconds)", "10")
    .option("-p --processor <max>", "processor queue depth max", "1000");

  const options = program.parse().opts();

  const dispatchInterval = Number(options.interval) * 1000;
  const processorMax = Number(options.processor);

  const pool = mariadb.createPool({
    host: options.mariadbHost,
    port: Number(options.mariadbPort),
    user: options.mariadbUser,
    password: options.mariadbPassword,
    database: options.mariadbDatabase,
    connectionLimit: 5,
    bigIntAsNumber: true, // all referencing BigInt fields <= Number.MAX_SAFE_INTEGER
  });

  const redis: ConnectionOptions = {
    host: options.redisHost,
    port: Number(options.redisPort),
    db: Number(options.redisDb),
  };

  const queueSequencer = new Queue<undefined, void>(WorkerQueueName.SEQUENCER, { connection: redis });
  const queueProcessor = new Queue<number, void>(WorkerQueueName.PROCESSOR, { connection: redis });

  // reset queue
  console.info("reset queue...");
  await queueSequencer.obliterate({force: true});
  await queueProcessor.obliterate({force: true});

  console.info("add sequencer repeated job...");
  queueSequencer.add("sequencer repeated", undefined, { repeat: { every: dispatchInterval } });

  // graceful shutdown
  process.on("SIGINT", async () => {
    console.info("SIGINT");
    console.info("close pool...");
    await pool.end();
    process.exit(0);
  });
  
  console.info("start dispatch loop...");
  while (true) {
    console.info("enqueue jobs...");

    let db: mariadb.Connection;
    let processorAddJobCount = 0;
    try {
      db = await pool.getConnection();

      const enqueued = await queueProcessor.getJobs(["waiting", "active"]);
      const enqueuedSlotSet = new Set<number>();
      enqueued.forEach(job => { enqueuedSlotSet.add(job.data); });

      const rows = await db.query<Pick<Slot, "slot">[]>('SELECT slot FROM admQueuedSlots ORDER BY slot ASC LIMIT ?', [processorMax]);
      rows.forEach(row => {
        if (!enqueuedSlotSet.has(row.slot)) {
          queueProcessor.add(`block_processor(${row.slot})`, row.slot);
          processorAddJobCount++;
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      db?.end();
    }

    console.info("enqueue", processorAddJobCount);

    await sleep(dispatchInterval);
  }
}

main();