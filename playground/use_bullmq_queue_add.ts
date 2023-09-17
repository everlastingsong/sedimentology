import { Queue, ConnectionOptions } from "bullmq";

const connection: ConnectionOptions = {
  host: "localhost",
  port: 6379,
};

const queue = new Queue("my_queue", { connection });

async function addJobs() {
  await queue.add("my_job1", { foo: "bar" });
  await queue.add("my_job2", { baz: "qux" });
}

addJobs();

