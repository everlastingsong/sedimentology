import axios from "axios";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const solana = axios.create({
    baseURL: process.env.SOLANA_RPC_URL,
    method: "post",
  });

  const now = Date.now();
  const after10sec = now + 10 * 1000;

  // loop until after10sec
  while (Date.now() < after10sec);

  for (let i=0; i<5; i++) {
    console.log("fetching...", i);

    const slot = 217833460;
    const response = await solana.request({
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "getBlock",
        params: [
          slot,
          {
            "encoding": "json",
            "transactionDetails": "full",
            "maxSupportedTransactionVersion": 0,
          },
        ],
      },
      // to preserve u64 value, do not use default JSON.parse
      transformResponse: (r) => r,
      // use gzip compression to reduce network traffic
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      decompress: true, // axios automatically decompresses gzip response
    });

    console.log("fetched...", i);
    console.log("sleep...", i);
    await sleep(10 * 1000);
  }

  console.log("stop manually! (Ctrl+C)");
  await sleep(60*60*1000);
}

main();