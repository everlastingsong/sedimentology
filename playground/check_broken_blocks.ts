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

  const originalData = response.data as string;

  // JSON.parse cannot handle numbers > Number.MAX_SAFE_INTEGER precisely,
  // but it is okay because the ALL fields we are interested are < Number.MAX_SAFE_INTEGER or string.
  const json = JSON.parse(originalData);

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
    const allPubkeys: string[] = [...staticPubkeys, ...readonlyPubkeys, ...writablePubkeys];

    const mentionToWhirlpoolProgram = allPubkeys.some((pubkey) => pubkey === WHIRLPOOL_PUBKEY);
    if (!mentionToWhirlpoolProgram) return;

    let whirlpoolInstructions: ReturnType<typeof WhirlpoolTransactionDecoder.decode>;
    try {
      whirlpoolInstructions = WhirlpoolTransactionDecoder.decode({ result: tx }, WHIRLPOOL_PUBKEY);
    } catch (err) {
      // drop transactions that failed to decode whirlpool instructions
      console.log("🚨DROP TRANSACTION");
      return;
    }

    console.log(tx.transaction.signatures[0], whirlpoolInstructions.length);

  });

  console.log("done");
}


function toTxID(slot: number, orderInBlock: number): BigInt {
  // 40 bits for slot, 24 bits for orderInBlock
  const txid = BigInt(slot) * BigInt(2 ** 24) + BigInt(orderInBlock);
  return txid;
}

async function main() {
  const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  // blocken blocks ? (following transfer instructions were not recorded ?)
  // 140119956: leader = Cs23cJMRuahuKh5oNhVmLhM2UrtaZLULLF3HqrxfTnHc Jul 4, 2022 03:31:16
  // 140119987: leader = 2iGccofYbsAwg9GnxJA45iRNoGQfR4oYNjnptSzNx217 Jul 4, 2022 03:31:39
  // 140120077: leader = Hv3pt2LJTG3DhVKrAxDgyskkhkEL9GRGUuz3eRjFE3fw Jul 4, 2022 03:32:44
  await fetchAndProcessBlock(solana, 140120077, 126585032); // 2gHXD71MykV37Xbmi8QSERWnZTF3WXHxMJH8RWCo7XRsqrQxBfTg3grUGF4BxaMCNQGqnFHb9fbseC1Am8B5crsS
  // --> 言及は以下の2つ, 1つは Jup のトップレベルから復元が必要
  // 2gHXD71MykV37Xbmi8QSERWnZTF3WXHxMJH8RWCo7XRsqrQxBfTg3grUGF4BxaMCNQGqnFHb9fbseC1Am8B5crsS 1
  // 3RA8wvMjc9Ey89jEcVZ5xAJoCtMZXXsD3zkMXFLTp2ET67a2o4Mb935Q2Jhty8CZC7forj2sirjZZgtpPexpzPsi 0
  
  //await fetchAndProcessBlock(solana, 140119987, 126584949);
  // --> 言及かつ成功は LCfcX1kyrQEbvWmA8LzPWRrfaKfrXy9NfYXwW8gp5PRPD2kUE8zd9ga6zeWxPc4igpezvytezJJ7oVptWeQkSsg のみ
  // トップレベル呼び出しのみのためこのトランザクションだけケアすればよい
  
  //await fetchAndProcessBlock(solana, 140119956, 126584921);
  // 言及かつ成功は1つのみ
  // 5ueXfZ1QyYADds7J2LLRNugDiLUJxhCW2LmUWbtBwkTFySzw1eY39KiutSY9hDuiUiHvowyFc51PtzqeTzRvj5dx 1


  //await fetchAndProcessBlock(solana, 140120078, 126585033); // safe
  //await fetchAndProcessBlock(solana, 140120076, 126585031); // safe
  //await fetchAndProcessBlock(solana, 140120075, 126585030); // safe
  //await fetchAndProcessBlock(solana, 140120074, 126585029); // safe

}

main();