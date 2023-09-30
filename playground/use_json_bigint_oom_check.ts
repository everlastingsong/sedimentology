import JSONBigIntBuilder from "json-bigint";
import fs from "fs";
import invariant from "tiny-invariant";

const JSONBigInt = JSONBigIntBuilder();

const PARSE_TIMES = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // .result.blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF"
  const blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF";

  // inspect: node --inspect -r ts-node/register <script>.ts
  //await sleep(30*1000);

  // JSON から切り出した blockhash を蓄積する。
  // blockhash を PARSE_TIMES 個格納してもメモリは 1MB も使わないはず。
  // しかし、blockhash がパースされた JSON への参照を隠し持っていたら、JSON全体を開放できなくなる
  const blockhashCache = [];

  console.time("JSONBigInt.parse");
  for (let i = 0; i < PARSE_TIMES; i++) {
    const block217833460 = fs.readFileSync("data/217833460.json", "utf-8");
    const json = JSONBigInt.parse(block217833460);
    invariant(json.result.blockhash === blockhash, "blockHeight must match");
    blockhashCache.push(json.result.blockhash);

    console.log(i, process.memoryUsage());
  }
  console.timeEnd("JSONBigInt.parse");
}

// 812 回目で OOM (JSONBigInt のパース結果の文字列は巨大な文字列への slice 参照)

main();