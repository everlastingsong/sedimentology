import JSONBigIntBuilder from "json-bigint";
import fs from "fs";
import invariant from "tiny-invariant";

const JSONBigInt = JSONBigIntBuilder();

const PARSE_TIMES = 50;

function main() {
  // .result.blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF"
  const block217833460 = fs.readFileSync("data/217833460.json", "utf-8");
  const blockhash = "8c3Tn9YKGC9vqttFhtGAcT4wKVMJToVK5scuWuocPQmF";

//  console.log(block217833460.slice(0, 200));

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
  const normalJson = JSON.parse(jsonStringWithBigInt);
  console.log(normalJson);

  const bigIntJson = JSONBigInt.parse(jsonStringWithBigInt);
  console.log(bigIntJson);

  const backNormalJsonString = JSON.stringify(normalJson);
  console.log(backNormalJsonString);

  const backJsonString = JSONBigInt.stringify(bigIntJson, );
  console.log(backJsonString);

  const backJsonStringNoExp = JSONBigInt.stringify(bigIntJson, );
  console.log(backJsonStringNoExp);
  */
}

main();