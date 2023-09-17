import { Worker, ConnectionOptions }  from "bullmq";

const connection: ConnectionOptions = {
  host: "localhost",
  port: 6379,
};

const worker = new Worker("my_queue", async job => {
  console.log("consumed", job.name, job.data);
}, { connection });



worker.on("completed", job => {
  console.log("completed", job.name, job.data);
});

worker.on("failed", (job, err) => {
  console.log("failed", job.name, job.data, err);
});

