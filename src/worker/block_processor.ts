import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";
import { Block, Slot, SlotProcessingState } from "../types";
import invariant from "tiny-invariant";

import JSONBigInt from "json-bigint";
import BigNumber from "bignumber.js";

import { PublicKey } from "@solana/web3.js";
import { DecodedWhirlpoolInstruction, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

import { LRUCache } from "lru-cache";

// change BigNumber config to never use exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const WHIRLPOOL_PUBKEY_BASE58 = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const WHIRLPOOL_PUBKEY = new PublicKey(WHIRLPOOL_PUBKEY_BASE58);

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });

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
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA.toBase58());
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB.toBase58());
          break;
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


  // add pubkeys
  // anyway, we need to add pubkeys, so we do it outside of transaction for parallel processing
  const prepared = await database.prepare("CALL addPubkeyIfNotExists(?)");
  for (const pubkey of touchedPubkeys) {
    if (pubkeyLRUCache.get(pubkey)) continue;
    await prepared.execute([pubkey]);
    pubkeyLRUCache.set(pubkey, true);
  }
  prepared.close();

  await database.beginTransaction();
  await database.batch("INSERT INTO txs (txid, signature, payer) VALUES (?, ?, fromPubkeyBase58(?))", processedTransactions.map((tx) => [tx.txid, tx.signature, tx.payer]));
  await database.batch("INSERT INTO balances (txid, account, pre, post) VALUES (?, fromPubkeyBase58(?), ?, ?)", processedTransactions.flatMap((tx) => tx.balances.map((b) => [tx.txid, b.account, b.pre, b.post])));
  for (const tx of processedTransactions) {
    await Promise.all(tx.whirlpoolInstructions.map((ix: DecodedWhirlpoolInstruction, order) => {
      console.log("ix", tx.txid, order, ix.name);
      return insertInstruction(tx.txid, order, ix, database);
    }));
  }
  await database.commit();

/*
  await database.beginTransaction();
  await database.query("UPDATE slots SET blockHeight = ?, blockTime = ?, state = ? WHERE slot = ?", [blockHeight, blockTime, SlotProcessingState.Fetched, slot]);
  await database.query("INSERT INTO blocks (slot, gzJsonString) VALUES (?, BINARY(?))", [slot, Buffer.from(gzJsonString)]);
  await database.commit();
  */
}

async function insertInstruction(txid: BigInt, order: number, ix: DecodedWhirlpoolInstruction, database: Connection) {
  const buildSQL = (ixName: string, numData: number, numKey: number, numTransfer: number): string => {
    const table = `ixs${ixName.charAt(0).toUpperCase() + ixName.slice(1)}`;
    const data = Array(numData).fill(", ?").join("");
    const key = Array(numKey).fill(", fromPubkeyBase58(?)").join("");
    const transfer = Array(numTransfer).fill(", ?").join("");
    return `INSERT INTO ${table} VALUES (?, ?${data}${key}${transfer})`;
  }

  switch (ix.name) {
    case "swap":
      return database.query(buildSQL(ix.name, 5, 11, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.amount.toString()),
        BigInt(ix.data.otherAmountThreshold.toString()),
        BigInt(ix.data.sqrtPriceLimit.toString()),
        ix.data.amountSpecifiedIsInput,
        ix.data.aToB,
        // key
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.tokenAuthority.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenOwnerAccountA.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenOwnerAccountB.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.tickArray0.toBase58(),
        ix.accounts.tickArray1.toBase58(),
        ix.accounts.tickArray2.toBase58(),
        ix.accounts.oracle.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
      ]);
    case "twoHopSwap":
      return database.query(buildSQL(ix.name, 7, 20, 4), [
        txid,
        order,
        // data
        BigInt(ix.data.amount.toString()),
        BigInt(ix.data.otherAmountThreshold.toString()),
        ix.data.amountSpecifiedIsInput,
        ix.data.aToBOne,
        ix.data.aToBTwo,
        BigInt(ix.data.sqrtPriceLimitOne.toString()),
        BigInt(ix.data.sqrtPriceLimitTwo.toString()),
        // key
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.tokenAuthority.toBase58(),
        ix.accounts.whirlpoolOne.toBase58(),
        ix.accounts.whirlpoolTwo.toBase58(),
        ix.accounts.tokenOwnerAccountOneA.toBase58(),
        ix.accounts.tokenVaultOneA.toBase58(),
        ix.accounts.tokenOwnerAccountOneB.toBase58(),
        ix.accounts.tokenVaultOneB.toBase58(),
        ix.accounts.tokenOwnerAccountTwoA.toBase58(),
        ix.accounts.tokenVaultTwoA.toBase58(),
        ix.accounts.tokenOwnerAccountTwoB.toBase58(),
        ix.accounts.tokenVaultTwoB.toBase58(),
        ix.accounts.tickArrayOne0.toBase58(),
        ix.accounts.tickArrayOne1.toBase58(),
        ix.accounts.tickArrayOne2.toBase58(),
        ix.accounts.tickArrayTwo0.toBase58(),
        ix.accounts.tickArrayTwo1.toBase58(),
        ix.accounts.tickArrayTwo2.toBase58(),
        ix.accounts.oracleOne.toBase58(),
        ix.accounts.oracleTwo.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
        ix.transfers[2].data.amount,
        ix.transfers[3].data.amount,
      ]);
    case "openPosition":
      return database.query(buildSQL(ix.name, 2, 10, 0), [
        txid,
        order,
        // data
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        // key
        ix.accounts.funder.toBase58(),
        ix.accounts.owner.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionMint.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        ix.accounts.associatedTokenProgram.toBase58(),
        // no transfer
      ]);
    case "openPositionWithMetadata":
      return database.query(buildSQL(ix.name, 2, 11, 0), [
        txid,
        order,
        // data
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        // key
        ix.accounts.funder.toBase58(),
        ix.accounts.owner.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionMint.toBase58(),
        ix.accounts.positionMetadataAccount.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        ix.accounts.associatedTokenProgram.toBase58(),
        // TODO: metadataProgram
        // TODO: metadataUpdateAuth
        // no transfer
      ]);
    case "increaseLiquidity":
      return database.query(buildSQL(ix.name, 3, 11, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidityAmount.toString()),
        BigInt(ix.data.tokenMaxA.toString()),
        BigInt(ix.data.tokenMaxB.toString()),
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.positionAuthority.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.tokenOwnerAccountA.toBase58(),
        ix.accounts.tokenOwnerAccountB.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.tickArrayLower.toBase58(),
        ix.accounts.tickArrayUpper.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
      ]);
    case "decreaseLiquidity":
      return database.query(buildSQL(ix.name, 3, 11, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidityAmount.toString()),
        BigInt(ix.data.tokenMinA.toString()),
        BigInt(ix.data.tokenMinB.toString()),
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.positionAuthority.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.tokenOwnerAccountA.toBase58(),
        ix.accounts.tokenOwnerAccountB.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.tickArrayLower.toBase58(),
        ix.accounts.tickArrayUpper.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
      ]);
    case "updateFeesAndRewards":
      return database.query(buildSQL(ix.name, 0, 4, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.tickArrayLower.toBase58(),
        ix.accounts.tickArrayUpper.toBase58(),
        // no transfer
      ]);
    case "collectFees":
      return database.query(buildSQL(ix.name, 0, 9, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.positionAuthority.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.tokenOwnerAccountA.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenOwnerAccountB.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
      ]);
    case "collectReward":
      return database.query(buildSQL(ix.name, 1, 7, 1), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.positionAuthority.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.rewardOwnerAccount.toBase58(),
        ix.accounts.rewardVault.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
      ]);
    case "closePosition":
      return database.query(buildSQL(ix.name, 0, 6, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionAuthority.toBase58(),
        ix.accounts.receiver.toBase58(),
        ix.accounts.position.toBase58(),
        ix.accounts.positionMint.toBase58(),
        ix.accounts.positionTokenAccount.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        // no transfer
      ]);
    case "collectProtocolFees":
      return database.query(buildSQL(ix.name, 0, 8, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.collectProtocolFeesAuthority.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.tokenDestinationA.toBase58(),
        ix.accounts.tokenDestinationB.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        // transfer
        ix.transfers[0].data.amount,
        ix.transfers[1].data.amount,
      ]);
    case "adminIncreaseLiquidity":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidity.toString()),
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.authority.toBase58(),
        // no transfer
      ]);
    case "initializeConfig":
      return database.query(buildSQL(ix.name, 4 - 3, 3 + 3, 0), [
        txid,
        order,
        // data
        ix.data.defaultProtocolFeeRate,
        // data as key
        ix.data.feeAuthority.toBase58(),
        ix.data.collectProtocolFeesAuthority.toBase58(),
        ix.data.rewardEmissionsSuperAuthority.toBase58(),
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        // no transfer
      ]);
    case "initializeFeeTier":
      return database.query(buildSQL(ix.name, 2, 5, 0), [
        txid,
        order,
        // data
        ix.data.tickSpacing,
        ix.data.defaultFeeRate,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.feeTier.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        // no transfer
      ]);
    case "initializePool":
      return database.query(buildSQL(ix.name, 2, 11, 0), [
        txid,
        order,
        // data
        ix.data.tickSpacing,
        BigInt(ix.data.initialSqrtPrice.toString()),
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.tokenMintA.toBase58(),
        ix.accounts.tokenMintB.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.tokenVaultA.toBase58(),
        ix.accounts.tokenVaultB.toBase58(),
        ix.accounts.feeTier.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        // no transfer
      ]);
    case "initializePositionBundle":
      return database.query(buildSQL(ix.name, 0, 9, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle.toBase58(),
        ix.accounts.positionBundleMint.toBase58(),
        ix.accounts.positionBundleTokenAccount.toBase58(),
        ix.accounts.positionBundleOwner.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        ix.accounts.associatedTokenProgram.toBase58(),
        // no transfer
      ]);
    case "initializePositionBundleWithMetadata":
      return database.query(buildSQL(ix.name, 0, 12, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle.toBase58(),
        ix.accounts.positionBundleMint.toBase58(),
        ix.accounts.positionBundleMetadata.toBase58(),
        ix.accounts.positionBundleTokenAccount.toBase58(),
        ix.accounts.positionBundleOwner.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.metadataUpdateAuth.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        ix.accounts.associatedTokenProgram.toBase58(),
        ix.accounts.metadataProgram.toBase58(),
        // no transfer
      ]);
    case "initializeReward":
      return database.query(buildSQL(ix.name, 1, 8, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.rewardAuthority.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.rewardMint.toBase58(),
        ix.accounts.rewardVault.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        // no transfer
      ]);
    case "initializeTickArray":
      return database.query(buildSQL(ix.name, 1, 4, 0), [
        txid,
        order,
        // data
        ix.data.startTickIndex,
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.tickArray.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        // no transfer
      ]);
    case "deletePositionBundle":
      return database.query(buildSQL(ix.name, 0, 6, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle.toBase58(),
        ix.accounts.positionBundleMint.toBase58(),
        ix.accounts.positionBundleTokenAccount.toBase58(),
        ix.accounts.positionBundleOwner.toBase58(),
        ix.accounts.receiver.toBase58(),
        ix.accounts.tokenProgram.toBase58(),
        // no transfer
      ]);
    case "openBundledPosition":
      return database.query(buildSQL(ix.name, 3, 8, 0), [
        txid,
        order,
        // data
        ix.data.bundleIndex,
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        // key
        ix.accounts.bundledPosition.toBase58(),
        ix.accounts.positionBundle.toBase58(),
        ix.accounts.positionBundleTokenAccount.toBase58(),
        ix.accounts.positionBundleAuthority.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.funder.toBase58(),
        ix.accounts.systemProgram.toBase58(),
        ix.accounts.rent.toBase58(),
        // no transfer
      ]);
    case "closeBundledPosition":
      return database.query(buildSQL(ix.name, 1, 5, 0), [
        txid,
        order,
        // data
        ix.data.bundleIndex,
        // key
        ix.accounts.bundledPosition.toBase58(),
        ix.accounts.positionBundle.toBase58(),
        ix.accounts.positionBundleTokenAccount.toBase58(),
        ix.accounts.positionBundleAuthority.toBase58(),
        ix.accounts.receiver.toBase58(),
        // no transfer
      ]);
    case "setCollectProtocolFeesAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.collectProtocolFeesAuthority.toBase58(),
        ix.accounts.newCollectProtocolFeesAuthority.toBase58(),
        // no transfer
      ]);
    case "setDefaultFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.defaultFeeRate,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.feeTier.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        // no transfer
      ]);
    case "setDefaultProtocolFeeRate":
      return database.query(buildSQL(ix.name, 1, 2, 0), [
        txid,
        order,
        // data
        ix.data.defaultProtocolFeeRate,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        // no transfer
      ]);
    case "setFeeAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        ix.accounts.newFeeAuthority.toBase58(),
        // no transfer
      ]);
    case "setFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.feeRate,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        // no transfer
      ]);
    case "setProtocolFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.protocolFeeRate,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.feeAuthority.toBase58(),
        // no transfer
      ]);
    case "setRewardAuthority":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.rewardAuthority.toBase58(),
        ix.accounts.newRewardAuthority.toBase58(),
        // no transfer
      ]);
    case "setRewardAuthorityBySuperAuthority":
      return database.query(buildSQL(ix.name, 1, 4, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.rewardEmissionsSuperAuthority.toBase58(),
        ix.accounts.newRewardAuthority.toBase58(),
        // no transfer
      ]);
    case "setRewardEmissions":
      return database.query(buildSQL(ix.name, 2, 3, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        BigInt(ix.data.emissionsPerSecondX64.toString()),
        // key
        ix.accounts.whirlpool.toBase58(),
        ix.accounts.rewardAuthority.toBase58(),
        ix.accounts.rewardVault.toBase58(),
        // no transfer
      ]);
    case "setRewardEmissionsSuperAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig.toBase58(),
        ix.accounts.rewardEmissionsSuperAuthority.toBase58(),
        ix.accounts.newRewardEmissionsSuperAuthority.toBase58(),
        // no transfer
      ]);
    default:
      throw new Error("unknown whirlpool instruction name");
  }
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
