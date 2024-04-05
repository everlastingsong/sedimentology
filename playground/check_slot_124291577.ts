import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { LRUCache } from "lru-cache";
import invariant from "tiny-invariant";
import { DecodedWhirlpoolInstruction, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";
import axios from "axios";

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });

export async function fetchAndProcessBlock(solana: AxiosInstance, slot: number, blockHeight: number) {
  ////////////////////////////////////////////////////////////////////////////////
  // FETCHER
  ////////////////////////////////////////////////////////////////////////////////

  console.log("fetching...", slot);
  // getBlock
  // see: https://docs.solana.com/api/http#getblock
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
          "rewards": false,
        },
      ],
    },
    // we want to obtain raw string data, so do not use any transformation
    transformResponse: (r) => r,
    // use gzip compression to reduce network traffic
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    // axios automatically decompresses gzip response
    decompress: true,
  });

  console.log("fetched");
  const originalData = response.data as string;
  console.log(originalData);

  // JSON.parse cannot handle numbers > Number.MAX_SAFE_INTEGER precisely,
  // but it is okay because the ALL fields we are interested are < Number.MAX_SAFE_INTEGER or string.
  const json = JSON.parse(originalData);
  console.log("parsed");

  // JSON RPC ensures that error field is used when error occurs
  if (json.error) {
    throw new Error(`getBlock(${slot}) failed: ${JSON.stringify(json.error)}`);
  }
  invariant(json.result, "result must be truthy");

  // sanity check
  invariant(json.result.blockHeight, "blockHeight must exist");
  invariant(json.result.blockTime, "blockTime must exist");
  invariant(json.result.blockhash, "blockhash must exist");
  invariant(json.result.parentSlot, "parentSlot must exist");
  invariant(json.result.transactions, "transactions must exist");

  invariant(json.result.blockHeight === blockHeight, "blockHeight must match");

  const blockTime = json.result.blockTime;

  ////////////////////////////////////////////////////////////////////////////////
  // PROCESSOR
  ////////////////////////////////////////////////////////////////////////////////

  const blockData = json.result;

  // process transactions

  console.log("num of transactions:", blockData.transactions.length);

  const touchedPubkeys = new Set<string>();
  const processedTransactions = [];
  blockData.transactions.forEach((tx, orderInBlock) => {
    // drop failed transactions
    if (tx.meta.err !== null) return;

    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const staticPubkeys = tx.transaction.message.accountKeys;
    const allPubkeys: string[] = [...staticPubkeys, ...writablePubkeys, ...readonlyPubkeys];

    const mentionToWhirlpoolProgram = allPubkeys.includes(WHIRLPOOL_PUBKEY);

//    const mentionToWhirlpoolProgram = allPubkeys.some((pubkey) => pubkey === WHIRLPOOL_PUBKEY);
    if (!mentionToWhirlpoolProgram) return;

    const lostInnerInstructions = tx.meta.innerInstructions === null;

    let whirlpoolInstructions: ReturnType<typeof WhirlpoolTransactionDecoder.decode>;
    try {
      whirlpoolInstructions = WhirlpoolTransactionDecoder.decode({ result: tx }, WHIRLPOOL_PUBKEY);
    } catch (err) {
      // drop transactions that failed to decode whirlpool instructions
      console.log("🚨DROP TRANSACTION");
      console.log(JSON.stringify(tx, null, 2));
      return;
    }

    console.log(tx.transaction.signatures[0], whirlpoolInstructions.length, lostInnerInstructions ? "🔥LOST innerInstructions" : "🤔exist innerInstructions");

  });

  console.log("done");
}

async function main() {
  const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  // ok case with deprecated SOL/USDC
  //await fetchAndProcessBlock(solana, 175080156, 158784073);

  // slot 124,291,577 (height: 112,419,322): oracle アカウントが含まれない唯一の swap 命令を含む
  // signature: 42cBuWXNV1JMR6edFnup98JDq3wvrU3fdqwwp22CBNVw1QVoDEEeeU8Zs5NbSdXuBziBwGN9gMhu76mhsVkMRA9R
  //await fetchAndProcessBlock(solana, 124291577, 112419322);

  // 255312004, 235801715

  //await fetchAndProcessBlock(solana, 255645986, 236122877);

  //await fetchAndProcessBlock(solana, 255312004, 235801715);
  await fetchAndProcessBlock(solana, 258336004, 238690950);

}

main();