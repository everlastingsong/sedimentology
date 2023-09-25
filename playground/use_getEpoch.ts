import { Connection } from "@solana/web3.js";

async function main() {
  const connection = new Connection(process.env["SOLANA_RPC_URL"], "confirmed");
  const epochInfo = await connection.getEpochInfo();
  console.log(epochInfo);

  console.log(epochInfo.absoluteSlot, epochInfo.blockHeight);
}

main();