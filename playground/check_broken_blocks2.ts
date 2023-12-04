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
    whirlpoolInstructions.forEach((instruction, orderInTransaction) => {
      console.log(`  instruction[${orderInTransaction}]`, instruction.name);
    });

  });

  console.log("done");
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
  //await fetchAndProcessBlock(solana, 140120077, 126585032); // 2gHXD71MykV37Xbmi8QSERWnZTF3WXHxMJH8RWCo7XRsqrQxBfTg3grUGF4BxaMCNQGqnFHb9fbseC1Am8B5crsS
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

  // 検知したNG ブロック
  // 140120077,h:126585032 (上記) Alchemyで処理済み
  // 140120034,h:126584991 🔥破損確認済み, 1TX(1 swap) 漏らしている (Alchemyには存在) 📝追加している命令がないから slot を消して再処理すればよいはず
  //    5sdXmFKjgvJcLQL1MJxS7vN6PsHPXqRxoZ1zvog47bQcwyESf7Z5XEMT96L1PwbdTw9oKhfYJYJb4sjUVWTq4yUB 0 true
  // 140119993,h:126584954 🔥破損確認済み, 2TX(2 命令) 漏らしている (Alchemyには存在) 📝追加している命令がないから slot を消して再処理すればよいはず
  //    2DhSKhNZRfx1uB4iep2ftcj6jCk3cigQbfwq7JdYgpbmjvWUBaXCeSCvC7CaaGU7QFbD1JiChV1iwa3FgN5A3yXv 0 true
  //    4FEUe5YxnuqDLzDuV6B4jH7ZfiATEyPYiyvJo7n2u7JcpC3uFbuMGaVec7wDfpB4vfjMECH74mEYzjVWxKQZzB2U 0 true
  // 140119987,h:126584949 (上記) Alchemyで処理済み
  // 140119985,h:126584947 🔥破損確認済み, 1TX(1 命令) 漏らしている (Alchemyには存在) 📝追加している命令がないから slot を消して再処理すればよいはず
  //    3i5LLK7EdSoX9oatmHEMXw4phGPK4MzMg4r2cfgbjn5hKrrqvpKsdRzEMU7G3uxSzu2gnTdxmVGPKPTXbohvVYC1 0 true
  // 140119956,h:126584921 (上記) Alchemyで処理済み

  // 🔥🔥🔥22年3月分でも大量に破損あり → ✅ Alchemy で対応済み
  // 127222122, h:115223413
  // 127221969, h:115223261
  // 127152989, h:115155507
  // 127152954, h:115155472
  // 127007265, h:115012969
  // 127006979, h:115012684
  // 126819744, h:114829204
  // 127007177, h:115012881  🚨drop 発生
  // 126819594, h:114829054  🚨drop 発生
  // 126700632, h:114714254  🚨drop 発生
  // 126700620, h:114714242  🚨drop 発生
  // 126697087, h:114710778
  // 126693873, h:114707635  🚨drop 発生
  // 126693858, h:114707624  🚨drop 発生
  // 126662634, h:114677145
  // 126597520, h:114614241
  // 126597437, h:114614162
  // 126597407, h:114614136
  // 126597113, h:114613857
  // 126596960, h:114613705  🚨drop 発生
  // 126596614, h:114613368
  // 126569449, h:114586885
  // 126569418, h:114586854

  //await fetchAndProcessBlock(solana, 127222122, 115223413);
  //await fetchAndProcessBlock(solana, 127221969, 115223261);
  //await fetchAndProcessBlock(solana, 127152989, 115155507);
  //await fetchAndProcessBlock(solana, 127152954, 115155472);
  //await fetchAndProcessBlock(solana, 127007265, 115012969);
  //await fetchAndProcessBlock(solana, 127006979, 115012684);
  //await fetchAndProcessBlock(solana, 126819744, 114829204);
  //await fetchAndProcessBlock(solana, 127007177, 115012881);
  //await fetchAndProcessBlock(solana, 126819594, 114829054);
  //await fetchAndProcessBlock(solana, 126700632, 114714254);
  //await fetchAndProcessBlock(solana, 126700620, 114714242);
  //await fetchAndProcessBlock(solana, 126697087, 114710778);
  //await fetchAndProcessBlock(solana, 126693873, 114707635);
  //await fetchAndProcessBlock(solana, 126693858, 114707624);
  //await fetchAndProcessBlock(solana, 126662634, 114677145);
  //await fetchAndProcessBlock(solana, 126597520, 114614241);
  //await fetchAndProcessBlock(solana, 126597437, 114614162);
  //await fetchAndProcessBlock(solana, 126597407, 114614136);
  //await fetchAndProcessBlock(solana, 126597113, 114613857);
  //await fetchAndProcessBlock(solana, 126596960, 114613705);
  //await fetchAndProcessBlock(solana, 126596614, 114613368);
  //await fetchAndProcessBlock(solana, 126569449, 114586885);
  //await fetchAndProcessBlock(solana, 126569418, 114586854);

  // パッチ準備
  await fetchAndProcessBlock(solana, 140119985, 126584947);
  await fetchAndProcessBlock(solana, 140119993, 126584954);
  await fetchAndProcessBlock(solana, 140120034, 126584991);

}

main();