import JSONBigIntBuilder from "json-bigint";

const JSONBigInt = JSONBigIntBuilder({ useNativeBigInt: true, alwaysParseAsBig: true });

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

  const backJsonStringNoExp = JSONBigInt.stringify(bigIntJson, );
  console.log(backJsonStringNoExp);
}

main();