import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";


function main() {
  const jsonStringWithBigInt = `{ "a": 1234567890123456789012345678901234567890, "b": 235 }`;

  const normalJson = JSON.parse(jsonStringWithBigInt);
  console.log(normalJson);

  const bigIntJson = JSONBigInt.parse(jsonStringWithBigInt);
  console.log(bigIntJson);

  const backNormalJsonString = JSON.stringify(normalJson);
  console.log(backNormalJsonString);

  const backJsonString = JSONBigInt.stringify(bigIntJson, );
  console.log(backJsonString);


  console.log(BigNumber.config());
  BigNumber.config({ EXPONENTIAL_AT: 1e9 }); // never use exponential notation
  console.log(BigNumber.config());

  const backJsonStringNoExp = JSONBigInt.stringify(bigIntJson, );
  console.log(backJsonStringNoExp);
}

main();