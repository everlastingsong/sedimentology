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

    let whirlpoolInstructions: ReturnType<typeof WhirlpoolTransactionDecoder.decode>;
    try {
      whirlpoolInstructions = WhirlpoolTransactionDecoder.decode({ result: tx }, WHIRLPOOL_PUBKEY);
    } catch (err) {
      // drop transactions that failed to decode whirlpool instructions
      console.log("🚨DROP TRANSACTION");
      return;
    }
    
    // drop transactions that did not mention whirlpool pubkey
    // drop transactions that did not execute whirlpool instructions
    if (whirlpoolInstructions.length === 0) return;

    // now we are sure that this transaction executed at least one whirlpool instruction

    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const staticPubkeys = tx.transaction.message.accountKeys;
    const allPubkeys: string[] = [...staticPubkeys, ...writablePubkeys, ...readonlyPubkeys];

    // FOR txs table
    const txid = toTxID(slot, orderInBlock);
    const signature = tx.transaction.signatures[0];
    const payer = tx.transaction.message.accountKeys[0];

    // FOR pubkeys table
    touchedPubkeys.add(payer);
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializeConfig":
          touchedPubkeys.add(ix.data.feeAuthority);
          touchedPubkeys.add(ix.data.collectProtocolFeesAuthority);
          touchedPubkeys.add(ix.data.rewardEmissionsSuperAuthority);
          // no break
        default:
          Object.values(ix.accounts).forEach((pubkey) => touchedPubkeys.add(pubkey));
      }
    });

    // FOR balances table
    const touchedVaultPubkeys = new Set<string>();
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializePool":
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          break;
        case "increaseLiquidity":
        case "decreaseLiquidity":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "collectFees":
        case "collectProtocolFees":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "initializeReward":
        case "setRewardEmissions":
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          break;
        case "collectReward":
          touchedVaultPubkeys.add(ix.accounts.rewardVault);
          break;
        case "swap":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "twoHopSwap":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneB);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoB);
          break;
        case "adminIncreaseLiquidity":
        case "closeBundledPosition":
        case "closePosition":
        case "deletePositionBundle":
        case "initializeConfig":
        case "initializeFeeTier":
        case "initializePositionBundle":
        case "initializePositionBundleWithMetadata":
        case "initializeTickArray":
        case "openBundledPosition":
        case "openPosition":
        case "openPositionWithMetadata":
        case "setCollectProtocolFeesAuthority":
        case "setDefaultFeeRate":
        case "setDefaultProtocolFeeRate":
        case "setFeeAuthority":
        case "setFeeRate":
        case "setProtocolFeeRate":
        case "setRewardAuthority":
        case "setRewardAuthorityBySuperAuthority":
        case "setRewardEmissionsSuperAuthority":
        case "updateFeesAndRewards":
          // This instruction does not affect the token balance.
          break;
        default:
          throw new Error("unknown whirlpool instruction name");
      }
    });

    const balances = Array.from(touchedVaultPubkeys).map((vault) => {
      const index = allPubkeys.findIndex((pubkey) => pubkey === vault);
      invariant(index !== -1, "index must exist");
      const preBalance = tx.meta.preTokenBalances.find((b) => b.accountIndex === index)?.uiTokenAmount.amount;
      invariant(preBalance, "preBalance must exist");
      const postBalance = tx.meta.postTokenBalances.find((b) => b.accountIndex === index)?.uiTokenAmount.amount;
      invariant(postBalance, "postBalance must exist");
      return {
        account: vault,
        pre: preBalance,
        post: postBalance,
      };
    });

    // FOR ixsX tables
    // no specific processing

    processedTransactions.push({
      txid,
      signature,
      payer,
      balances,
      whirlpoolInstructions,
    });

    processedTransactions.forEach((tx) => {
      console.log(tx.signature);
      tx.whirlpoolInstructions.forEach((ix) => {
        console.log(`\t${ix.name}`);
      });
    });
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

  // IDL operations
  //await fetchAndProcessBlock(solana, 201197288, 183836170);
  //await fetchAndProcessBlock(solana, 201196110, 183835003);
  //await fetchAndProcessBlock(solana, 201196106, 183834999);
  //await fetchAndProcessBlock(solana, 201196102, 183834995);
  //await fetchAndProcessBlock(solana, 201196097, 183834990);
  //await fetchAndProcessBlock(solana, 201196058, 183834951);
  //await fetchAndProcessBlock(solana, 189247790, 172230136);
  //await fetchAndProcessBlock(solana, 189247530, 172229880);
  //await fetchAndProcessBlock(solana, 189247523, 172229877);
  //await fetchAndProcessBlock(solana, 189247518, 172229872);
  //await fetchAndProcessBlock(solana, 189247515, 172229869);
  //await fetchAndProcessBlock(solana, 189247512, 172229866);  
  //await fetchAndProcessBlock(solana, 189247507, 172229861);
  //await fetchAndProcessBlock(solana, 189247503, 172229857);
  //await fetchAndProcessBlock(solana, 189247497, 172229851);

  // blocken blocks ? (following transfer instructions were not recorded ?)
  // 140119956: leader = Cs23cJMRuahuKh5oNhVmLhM2UrtaZLULLF3HqrxfTnHc Jul 4, 2022 03:31:16
  // 140119987: leader = 2iGccofYbsAwg9GnxJA45iRNoGQfR4oYNjnptSzNx217 Jul 4, 2022 03:31:39
  // 140120077: leader = Hv3pt2LJTG3DhVKrAxDgyskkhkEL9GRGUuz3eRjFE3fw Jul 4, 2022 03:32:44
  //await fetchAndProcessBlock(solana, 140120077, 126585032); // 2gHXD71MykV37Xbmi8QSERWnZTF3WXHxMJH8RWCo7XRsqrQxBfTg3grUGF4BxaMCNQGqnFHb9fbseC1Am8B5crsS
  await fetchAndProcessBlock(solana, 140119987, 126584949);
  //await fetchAndProcessBlock(solana, 140119956, 126584921);

}

main();