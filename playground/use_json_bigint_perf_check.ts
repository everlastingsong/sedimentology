import JSONBigIntBuilder from "json-bigint";
import fs from "fs";
import invariant from "tiny-invariant";

const JSONBigInt = JSONBigIntBuilder();

const PARSE_TIMES = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // .result.blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF"
  const block217833460 = fs.readFileSync("data/217833460.json", "utf-8");
  const blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF";

//  console.log(block217833460.slice(0, 200));

  // inspect: node --inspect -r ts-node/register use_json_bigint_perf_check.ts
  await sleep(30*1000);

  console.time("JSON.parse");
  for (let i = 0; i < PARSE_TIMES; i++) {
    const json = JSON.parse(block217833460);
    invariant(json.result.blockhash === blockhash, "blockHeight must match");
  }
  console.timeEnd("JSON.parse");

  console.time("JSONBigInt.parse");
  for (let i = 0; i < PARSE_TIMES; i++) {
    const json = JSONBigInt.parse(block217833460);
    invariant(json.result.blockhash === blockhash, "blockHeight must match");
  }
  console.timeEnd("JSONBigInt.parse");

  /*
  JSONBigInt.parse は非常に遅い (JSで実装されているからエンジンレベルの最適化の恩恵なし？)

  JSON.parse: 2.831s
  JSONBigInt.parse: 15.630s

  トランザクションのJSONは大きい number を含まないので安全。
  唯一気にしていた TokenBalances をよくみたら amount は文字列だった。
  何と戦っていたんだろう。 (decimals + uiAmountString も考えたが、amount が文字列なら全く問題ない)

          "postTokenBalances": [
            {
              "accountIndex": 1,
              "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              "owner": "2rbMgYvzAb3xDk6vXrzKkY3VwsmyDZsJTkvB3JJYsRzA",
              "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              "uiTokenAmount": {
                "amount": "4724485993",
                "decimals": 6,
                "uiAmount": 4724.485993,
                "uiAmountString": "4724.485993"
              }
            },

  今回は利用しないところなのでどうでもよいが、postBalances (SOL) は number なので参照するならやはり要注意

          "postBalances": [
            1458159786,
            2039280,
            2039280,
            1,

  */
}

main();