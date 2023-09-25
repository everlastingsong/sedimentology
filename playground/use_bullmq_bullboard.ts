import express from "express";
import { Queue, ConnectionOptions } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const redis: ConnectionOptions = {
  host: "localhost",
  port: 6379,
  db: 2, // 👉Database index to use
};

const queue = new Queue("my_queue");
const queueBlockSequencer = new Queue("block_sequencer", { connection: redis });
const queueBlockFetcher = new Queue("block_fetcher", { connection: redis });
const queueBlockProcessor = new Queue("block_processor", { connection: redis });

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullMQAdapter(queue),
    new BullMQAdapter(queueBlockFetcher),
    new BullMQAdapter(queueBlockProcessor),
    new BullMQAdapter(queueBlockSequencer),
  ],
  serverAdapter: serverAdapter,
});

const app = express();

app.use('/admin/queues', serverAdapter.getRouter());

// other configurations of your server

const port = 3500;
app.listen(port, () => {
  console.log(`Running on ${port}...`);
  console.log(`For the UI, open http://localhost:${port}/admin/queues`);
  console.log('Make sure Redis is running on port 6379 by default');
});