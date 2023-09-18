import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import axios from "axios";

// usage: ts-node download_signature_blocks.ts <conflictedSlots.json>
// required env var: RPC_ENDPOINT_URL
async function main() {
  const RPC_ENDPOINT_URL = process.env.RPC_ENDPOINT_URL ?? "";

  const conflictedSlotsFilepath = process.argv[2];
  const conflictedSlots = JSON.parse(fs.readFileSync(conflictedSlotsFilepath, "utf-8")) as number[];

  const endpoint = axios.create({
    baseURL: RPC_ENDPOINT_URL,
    method: "post",
  });

  for (const slot of conflictedSlots) {
    const file = `blocks/${slot}.json`;

    if (fs.existsSync(file)) continue

    console.log(`Downloading block ${slot}...`);
    const response = await endpoint.request({
      url: "/",
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "getBlock",
        params: [
          slot,
          {
            "encoding": "json",
            "transactionDetails": "signatures",
            "maxSupportedTransactionVersion": 0,
          },
        ],
      },
    });
    const signatures: string[] = response.data?.result?.signatures;

    if (signatures === undefined) {
      console.log(`Block ${slot} not found`);
      break;
    }

    fs.writeFileSync(file, JSON.stringify(signatures, null, 2));
  }
}

main();