import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

import { Block } from "../types";

import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";

import { PublicKey } from "@solana/web3.js";
import { DecodedWhirlpoolInstruction, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

import { LRUCache } from "lru-cache";
import { insertInstruction } from "./block_processor";

// change BigNumber config to never use exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });

function createNewStringInstance(s: string): string {
  return Buffer.from(s).toString();
}

export async function fetchAndProcessBlock(database: Connection, solana: AxiosInstance, slot: number) {
  const [{ state, blockHeight }] = await database.query<Slot[]>('SELECT * FROM slots WHERE slot = ?', [slot]);

  if (state !== SlotProcessingState.Added) {
    // already fetched
    return;
  }

// FETCHER phase

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
    // to preserve u64 value, do not use default JSON.parse
    transformResponse: (r) => r,
    // use gzip compression to reduce network traffic
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    decompress: true, // axios automatically decompresses gzip response
  });

  const originalData = response.data as string;
  const json = JSONBigInt.parse(originalData);

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
  invariant(json.result.previousBlockhash, "previousBlockhash must exist");
  invariant(json.result.transactions, "transactions must exist");

  invariant(json.result.blockHeight == blockHeight, "blockHeight must match");

  const blockTime = json.result.blockTime;

  // .0 の再現で問題がある (がどうでもいい)
  //invariant(JSONBigInt.stringify(json) === jsonString, "some data seems to be lost during JSON parse/stringify");

// PROCESSOR phase

  const blockData = json.result;

  //console.log("transactions", blockData.transactions.length);

  const touchedPubkeys = new Set<string>();
  const processedTransactions = [];
  blockData.transactions.forEach((tx, orderInBlock) => {
    // drop failed transactions
    if (tx.meta.err !== null) return;

    const whirlpoolInstructions = WhirlpoolTransactionDecoder.decode({ result: tx }, WHIRLPOOL_PUBKEY);
    
    // drop transactions that did not mention whirlpool pubkey
    // drop transactions that did not execute whirlpool instructions
    if (whirlpoolInstructions.length === 0) return;

    // now we are sure that this transaction executed at least one whirlpool instruction

    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const staticPubkeys = tx.transaction.message.accountKeys;
    const allPubkeys: string[] = [...staticPubkeys, ...readonlyPubkeys, ...writablePubkeys];

    // TODO: use bigint always (including JSONBigInt & Whirlpool instruction decoder) & mariaDB

    // FOR txs
    // TODO: make function toTxId
    const txid = BigInt(slot) * BigInt(2 ** 24) + BigInt(orderInBlock); // 40 bits for slot, 24 bits for orderInBlock
    const signature = tx.transaction.signatures[0];
    const payer = tx.transaction.message.accountKeys[0];

    // FOR pubkeys
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

    // FOR balances
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

    // FOR ixsX


  //  console.log("tx", signature, payer, whirlpoolInstructions.length, whirlpoolInstructions.map((ix) => ix.name), balances);

    processedTransactions.push({
      txid,
      signature,
      payer,
      balances,
      whirlpoolInstructions,
    });

  });

  //console.log("touchedPubkeys", touchedPubkeys.size);
  //console.log("processedTransactions", processedTransactions.length);

  // add pubkeys
  // anyway, we need to add pubkeys, so we do it outside of transaction for parallel processing
  const prepared = await database.prepare("CALL addPubkeyIfNotExists(?)");
  for (const pubkey of touchedPubkeys) {
    if (pubkeyLRUCache.get(pubkey)) continue;
    await prepared.execute([pubkey]);

    // I have faced OOM error.
    // pubkey is sliced from original string, so it contains the reference to the originalData.
    // So I need to create completely new string instance to garbage collect originalData.
    pubkeyLRUCache.set(createNewStringInstance(pubkey), true);
  }
  prepared.close();

  await database.beginTransaction();
  if (processedTransactions.length > 0) {
    await database.batch(
      "INSERT INTO txs (txid, signature, payer) VALUES (?, ?, fromPubkeyBase58(?))",
      processedTransactions.map((tx) => [tx.txid, tx.signature, tx.payer])
    );
  }
  const balances = processedTransactions.flatMap((tx) => tx.balances.map((b) => [tx.txid, b.account, b.pre, b.post]));
  if (balances.length > 0) {
    await database.batch(
      "INSERT INTO balances (txid, account, pre, post) VALUES (?, fromPubkeyBase58(?), ?, ?)",
      balances
    );
  }
  for (const tx of processedTransactions) {
    await Promise.all(tx.whirlpoolInstructions.map((ix: DecodedWhirlpoolInstruction, order) => {
    //  console.log("ix", tx.txid, order, ix.name);
      return insertInstruction(tx.txid, order, ix, database);
    }));
  }

  await database.query('DELETE FROM blocks WHERE slot = ?', [slot]);
  await database.query("UPDATE slots SET blockTime = ?, state = ? WHERE slot = ?", [blockTime, SlotProcessingState.Processed, slot]);
  await database.commit();

  console.log(`processed slot=${slot}`, `${processedTransactions.length}/${blockData.transactions.length}`, `${processedTransactions.reduce((sum, tx) => sum + tx.whirlpoolInstructions.length, 0)} ix`);
}

/*
import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";

async function main() {
  const database = await createConnection(DB_CONNECTION_CONFIG);
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  await fetchBlock(database, solana, 217833455);
  await database.end();
}

main();
*/