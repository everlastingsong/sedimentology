import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Block, Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";

import { PublicKey } from "@solana/web3.js";
import { WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

// change BigNumber config to never use exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const WHIRLPOOL_PUBKEY_BASE58 = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const WHIRLPOOL_PUBKEY = new PublicKey(WHIRLPOOL_PUBKEY_BASE58);

export async function processBlock(database: Connection, solana: AxiosInstance, slot: number) {

  const [{ state, blockHeight }] = await database.query<Slot[]>('SELECT * FROM slots WHERE slot = ?', [slot]);

  if (state !== SlotProcessingState.Fetched) {
    // already processed (or not fetched yet)
    return;
  }

  const [{ slot: querySlot, gzJsonString }] = await database.query<Block[]>('SELECT * FROM blocks WHERE slot = ?', [slot]);
  invariant(querySlot === slot, "slot must match");

  const jsonString = strFromU8(gunzipSync(gzJsonString));
  const json = JSONBigInt.parse(jsonString);

  // sanity check
  invariant(json.result, "result must exist");
  invariant(json.result.blockHeight === blockHeight, "blockHeight must match");
  invariant(JSONBigInt.stringify(json) === jsonString, "some data seems to be lost during JSON parse/stringify");

  const blockData = json.result;

  console.log("transactions", blockData.transactions.length);

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
    whirlpoolInstructions.forEach((ix) => Object.values(ix.accounts).forEach((pubkey) => touchedPubkeys.add(pubkey.toBase58())));

    // FOR balances
    const touchedVaultPubkeys = new Set<string>();
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializePool":
        case "increaseLiquidity":
        case "decreaseLiquidity":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB.toBase58());
          break;
        case "collectFees":
        case "collectProtocolFees":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB.toBase58());
          break;
        case "initializeReward":
        case "setRewardEmissions":
        case "collectReward":
          touchedVaultPubkeys.add(ix.accounts.rewardVault.toBase58());
          break;
        case "swap":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB.toBase58());
          break;
        case "twoHopSwap":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneB.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoB.toBase58());
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

  console.log("touchedPubkeys", touchedPubkeys);
  console.log("processedTransactions", processedTransactions);

/*
  await database.beginTransaction();
  await database.query("UPDATE slots SET blockHeight = ?, blockTime = ?, state = ? WHERE slot = ?", [blockHeight, blockTime, SlotProcessingState.Fetched, slot]);
  await database.query("INSERT INTO blocks (slot, gzJsonString) VALUES (?, BINARY(?))", [slot, Buffer.from(gzJsonString)]);
  await database.commit();
  */
}


import { DB_CONNECTION_CONFIG, SOLANA_RPC_URL } from "../constants";
import { createConnection } from "mariadb";
import axios from "axios";

async function main() {
  const database = await createConnection(DB_CONNECTION_CONFIG);
  const solana = axios.create({
    baseURL: SOLANA_RPC_URL,
    method: "post",
  });

  await processBlock(database, solana, 217833455);
  await database.end();
}

main();
