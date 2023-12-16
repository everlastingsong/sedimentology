import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { Slot } from "../common/types";
import { LRUCache } from "lru-cache";
import invariant from "tiny-invariant";
import { DecodedWhirlpoolInstruction, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });

export async function fetchAndProcessBlock(database: Connection, solana: AxiosInstance, slot: number) {
  const [processingSlot] = await database.query<Slot[]>('SELECT * FROM admQueuedSlots WHERE slot = ?', [slot]);

  if (!processingSlot) {
    // already processed
    return;
  }

  const blockHeight = processingSlot.blockHeight;

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

  const touchedPubkeys = new Set<string>();
  const processedTransactions = [];
  blockData.transactions.forEach((tx, orderInBlock) => {
    // drop failed transactions
    if (tx.meta.err !== null) return;

    const staticPubkeys = tx.transaction.message.accountKeys;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const allPubkeys: string[] = [...staticPubkeys, ...writablePubkeys, ...readonlyPubkeys];
    const mentionWhirlpoolProgram = allPubkeys.includes(WHIRLPOOL_PUBKEY);

    // drop transactions that did not mention whirlpool pubkey
    if (!mentionWhirlpoolProgram) return;

    // innerInstructions is required to extract all executed whirlpool instructions via CPI
    // broken block does not have innerInstructions (null), it should be [] if no inner instructions exist
    invariant(tx.meta.innerInstructions !== null, "innerInstructions must exist");

    const whirlpoolInstructions = WhirlpoolTransactionDecoder.decode({ result: tx }, WHIRLPOOL_PUBKEY);
    
    // drop transactions that did not execute whirlpool instructions
    if (whirlpoolInstructions.length === 0) return;

    // now we are sure that this transaction executed at least one whirlpool instruction

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
    const initializingVaultPubkeys = new Set<string>();
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializePool":
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          initializingVaultPubkeys.add(ix.accounts.tokenVaultA);
          initializingVaultPubkeys.add(ix.accounts.tokenVaultB);
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
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          initializingVaultPubkeys.add(ix.accounts.rewardVault);
          break;
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
      // edge case: 4rMJC56qibPjr1PDzX7bQFmBuG6yd9CcVysoFbo8dk1Sho2eehQt6Y8NhZFEFECNvnbcNN3evFE2X47ycLxyQmA
      // initializePool + increaseLiquidity in the same transaction
      const preBalance = tx.meta.preTokenBalances.find((b) => b.accountIndex === index)?.uiTokenAmount.amount
        ?? (initializingVaultPubkeys.has(vault) ? "0" : undefined);
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
  });

  // save processed transactions to database

  // insert into pubkeys
  // anyway, we need to add pubkeys, so we do it outside of transaction for parallel processing
  const prepared = await database.prepare("CALL addPubkeyIfNotExists(?)");
  for (const pubkey of touchedPubkeys) {
    if (pubkeyLRUCache.get(pubkey)) continue;
    await prepared.execute([pubkey]);
    pubkeyLRUCache.set(pubkey, true);
  }
  prepared.close();

  await database.beginTransaction();

  // insert into txs
  if (processedTransactions.length > 0) {
    await database.batch(
      "INSERT INTO txs (txid, signature, payer) VALUES (?, ?, fromPubkeyBase58(?))",
      processedTransactions.map((tx) => [tx.txid, tx.signature, tx.payer])
    );
  }

  // insert into balances
  const balances = processedTransactions.flatMap((tx) => tx.balances.map((b) => [tx.txid, b.account, b.pre, b.post]));
  if (balances.length > 0) {
    await database.batch(
      "INSERT INTO balances (txid, account, pre, post) VALUES (?, fromPubkeyBase58(?), ?, ?)",
      balances
    );
  }

  // insert into ixsX
  for (const tx of processedTransactions) {
    await Promise.all(tx.whirlpoolInstructions.map((ix: DecodedWhirlpoolInstruction, order) => {
      return insertInstruction(tx.txid, order, ix, database);
    }));
  }

  // update slots
  await database.query("DELETE FROM admQueuedSlots WHERE slot = ?", [slot]);
  await database.query("INSERT INTO slots (slot, blockHeight, blockTime) VALUES(?, ?, ?)", [slot, blockHeight, blockTime]);

  await database.commit();
}


function toTxID(slot: number, orderInBlock: number): BigInt {
  // 40 bits for slot, 24 bits for orderInBlock
  const txid = BigInt(slot) * BigInt(2 ** 24) + BigInt(orderInBlock);
  return txid;
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
        ix.accounts.tokenProgram,
        ix.accounts.tokenAuthority,
        ix.accounts.whirlpool,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArray0,
        ix.accounts.tickArray1,
        ix.accounts.tickArray2,
        ix.accounts.oracle,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
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
        ix.accounts.tokenProgram,
        ix.accounts.tokenAuthority,
        ix.accounts.whirlpoolOne,
        ix.accounts.whirlpoolTwo,
        ix.accounts.tokenOwnerAccountOneA,
        ix.accounts.tokenVaultOneA,
        ix.accounts.tokenOwnerAccountOneB,
        ix.accounts.tokenVaultOneB,
        ix.accounts.tokenOwnerAccountTwoA,
        ix.accounts.tokenVaultTwoA,
        ix.accounts.tokenOwnerAccountTwoB,
        ix.accounts.tokenVaultTwoB,
        ix.accounts.tickArrayOne0,
        ix.accounts.tickArrayOne1,
        ix.accounts.tickArrayOne2,
        ix.accounts.tickArrayTwo0,
        ix.accounts.tickArrayTwo1,
        ix.accounts.tickArrayTwo2,
        ix.accounts.oracleOne,
        ix.accounts.oracleTwo,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
        ix.transfers[2],
        ix.transfers[3],
      ]);
    case "openPosition":
      return database.query(buildSQL(ix.name, 2, 10, 0), [
        txid,
        order,
        // data
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        // key
        ix.accounts.funder,
        ix.accounts.owner,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionTokenAccount,
        ix.accounts.whirlpool,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        ix.accounts.associatedTokenProgram,
        // no transfer
      ]);
    case "openPositionWithMetadata":
      return database.query(buildSQL(ix.name, 2, 13, 0), [
        txid,
        order,
        // data
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        // key
        ix.accounts.funder,
        ix.accounts.owner,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionMetadataAccount,
        ix.accounts.positionTokenAccount,
        ix.accounts.whirlpool,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        ix.accounts.associatedTokenProgram,
        ix.accounts.metadataProgram,
        ix.accounts.metadataUpdateAuth,
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
        ix.accounts.whirlpool,
        ix.accounts.tokenProgram,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArrayLower,
        ix.accounts.tickArrayUpper,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
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
        ix.accounts.whirlpool,
        ix.accounts.tokenProgram,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArrayLower,
        ix.accounts.tickArrayUpper,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
      ]);
    case "updateFeesAndRewards":
      return database.query(buildSQL(ix.name, 0, 4, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpool,
        ix.accounts.position,
        ix.accounts.tickArrayLower,
        ix.accounts.tickArrayUpper,
        // no transfer
      ]);
    case "collectFees":
      return database.query(buildSQL(ix.name, 0, 9, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpool,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultB,
        ix.accounts.tokenProgram,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
      ]);
    case "collectReward":
      return database.query(buildSQL(ix.name, 1, 7, 1), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpool,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.rewardOwnerAccount,
        ix.accounts.rewardVault,
        ix.accounts.tokenProgram,
        // transfer
        ix.transfers[0],
      ]);
    case "closePosition":
      return database.query(buildSQL(ix.name, 0, 6, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionAuthority,
        ix.accounts.receiver,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenProgram,
        // no transfer
      ]);
    case "collectProtocolFees":
      return database.query(buildSQL(ix.name, 0, 8, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.collectProtocolFeesAuthority,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tokenDestinationA,
        ix.accounts.tokenDestinationB,
        ix.accounts.tokenProgram,
        // transfer
        ix.transfers[0],
        ix.transfers[1],
      ]);
    case "adminIncreaseLiquidity":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidity.toString()),
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.authority,
        // no transfer
      ]);
    case "initializeConfig":
      return database.query(buildSQL(ix.name, 4 - 3, 3 + 3, 0), [
        txid,
        order,
        // data
        ix.data.defaultProtocolFeeRate,
        // data as key
        ix.data.feeAuthority,
        ix.data.collectProtocolFeesAuthority,
        ix.data.rewardEmissionsSuperAuthority,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.funder,
        ix.accounts.systemProgram,
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
        ix.accounts.whirlpoolsConfig,
        ix.accounts.feeTier,
        ix.accounts.funder,
        ix.accounts.feeAuthority,
        ix.accounts.systemProgram,
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
        ix.accounts.whirlpoolsConfig,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.funder,
        ix.accounts.whirlpool,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.feeTier,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);
    case "initializePositionBundle":
      return database.query(buildSQL(ix.name, 0, 9, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle,
        ix.accounts.positionBundleMint,
        ix.accounts.positionBundleTokenAccount,
        ix.accounts.positionBundleOwner,
        ix.accounts.funder,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        ix.accounts.associatedTokenProgram,
        // no transfer
      ]);
    case "initializePositionBundleWithMetadata":
      return database.query(buildSQL(ix.name, 0, 12, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle,
        ix.accounts.positionBundleMint,
        ix.accounts.positionBundleMetadata,
        ix.accounts.positionBundleTokenAccount,
        ix.accounts.positionBundleOwner,
        ix.accounts.funder,
        ix.accounts.metadataUpdateAuth,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        ix.accounts.associatedTokenProgram,
        ix.accounts.metadataProgram,
        // no transfer
      ]);
    case "initializeReward":
      return database.query(buildSQL(ix.name, 1, 8, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.rewardAuthority,
        ix.accounts.funder,
        ix.accounts.whirlpool,
        ix.accounts.rewardMint,
        ix.accounts.rewardVault,
        ix.accounts.tokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);
    case "initializeTickArray":
      return database.query(buildSQL(ix.name, 1, 4, 0), [
        txid,
        order,
        // data
        ix.data.startTickIndex,
        // key
        ix.accounts.whirlpool,
        ix.accounts.funder,
        ix.accounts.tickArray,
        ix.accounts.systemProgram,
        // no transfer
      ]);
    case "deletePositionBundle":
      return database.query(buildSQL(ix.name, 0, 6, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionBundle,
        ix.accounts.positionBundleMint,
        ix.accounts.positionBundleTokenAccount,
        ix.accounts.positionBundleOwner,
        ix.accounts.receiver,
        ix.accounts.tokenProgram,
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
        ix.accounts.bundledPosition,
        ix.accounts.positionBundle,
        ix.accounts.positionBundleTokenAccount,
        ix.accounts.positionBundleAuthority,
        ix.accounts.whirlpool,
        ix.accounts.funder,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);
    case "closeBundledPosition":
      return database.query(buildSQL(ix.name, 1, 5, 0), [
        txid,
        order,
        // data
        ix.data.bundleIndex,
        // key
        ix.accounts.bundledPosition,
        ix.accounts.positionBundle,
        ix.accounts.positionBundleTokenAccount,
        ix.accounts.positionBundleAuthority,
        ix.accounts.receiver,
        // no transfer
      ]);
    case "setCollectProtocolFeesAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.collectProtocolFeesAuthority,
        ix.accounts.newCollectProtocolFeesAuthority,
        // no transfer
      ]);
    case "setDefaultFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.defaultFeeRate,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.feeTier,
        ix.accounts.feeAuthority,
        // no transfer
      ]);
    case "setDefaultProtocolFeeRate":
      return database.query(buildSQL(ix.name, 1, 2, 0), [
        txid,
        order,
        // data
        ix.data.defaultProtocolFeeRate,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.feeAuthority,
        // no transfer
      ]);
    case "setFeeAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.feeAuthority,
        ix.accounts.newFeeAuthority,
        // no transfer
      ]);
    case "setFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.feeRate,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.feeAuthority,
        // no transfer
      ]);
    case "setProtocolFeeRate":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.protocolFeeRate,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.feeAuthority,
        // no transfer
      ]);
    case "setRewardAuthority":
      return database.query(buildSQL(ix.name, 1, 3, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpool,
        ix.accounts.rewardAuthority,
        ix.accounts.newRewardAuthority,
        // no transfer
      ]);
    case "setRewardAuthorityBySuperAuthority":
      return database.query(buildSQL(ix.name, 1, 4, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.rewardEmissionsSuperAuthority,
        ix.accounts.newRewardAuthority,
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
        ix.accounts.whirlpool,
        ix.accounts.rewardAuthority,
        ix.accounts.rewardVault,
        // no transfer
      ]);
    case "setRewardEmissionsSuperAuthority":
      return database.query(buildSQL(ix.name, 0, 3, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.rewardEmissionsSuperAuthority,
        ix.accounts.newRewardEmissionsSuperAuthority,
        // no transfer
      ]);
    default:
      throw new Error("unknown whirlpool instruction name");
  }
}
