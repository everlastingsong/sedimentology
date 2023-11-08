import express from "express";
import { Queue, ConnectionOptions } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { addConnectionOptions } from "./options";
import { program } from "commander";
import { WorkerQueueName } from "../common/types";

addConnectionOptions(program, false, true, false);
program
  .option("-p --port <port>", "bullboard port", "3500");

const options = program.parse().opts();

const port = Number(options.port);

const redis: ConnectionOptions = {
  host: options.redisHost,
  port: Number(options.redisPort),
  db: Number(options.redisDb),
};

const queueSequencer = new Queue<undefined, void>(WorkerQueueName.SEQUENCER, { connection: redis });
const queueBackfillSequencer = new Queue<undefined, void>(WorkerQueueName.BACKFILL_SEQUENCER, { connection: redis });
const queueProcessor = new Queue<number, void>(WorkerQueueName.PROCESSOR, { connection: redis });

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullMQAdapter(queueSequencer),
    new BullMQAdapter(queueBackfillSequencer),
    new BullMQAdapter(queueProcessor),
  ],
  serverAdapter: serverAdapter,
});

const app = express();

app.use('/admin/queues', serverAdapter.getRouter());

app.listen(port, () => {
  console.info(`Running on ${port}...`);
  console.info(`For the UI, open http://localhost:${port}/admin/queues`);
});
