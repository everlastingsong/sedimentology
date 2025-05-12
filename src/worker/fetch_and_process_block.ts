import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { Commitment, Slot } from "../common/types";
import { LRUCache } from "lru-cache";
import invariant from "tiny-invariant";
import { DecodedWhirlpoolInstruction, RemainingAccounts, RemainingAccountsInfo, TransferAmountWithTransferFeeConfig, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

// Program data account is PDA based on program address, so it is constant for each program
const WHIRLPOOL_PROGRAM_DATA_PUBKEY = "CtXfPzz36dH5Ws4UYKZvrQ1Xqzn42ecDW6y8NKuiN8nD";
const WHIRLPOOL_PROGRAM_DATA_ACCOUNT_SIZE = 1405485;

const pubkeyLRUCache = new LRUCache<string, boolean>({ max: 10_000 });

export async function fetchAndProcessBlock(database: Connection, solana: AxiosInstance, slot: number, commitment: Commitment) {
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
          // Sedimentology does not need rewards info.
          // If parameter not provided, the default includes rewards.
          // Rewards at the first slot of the epoch is extremely large (>= 150MB), and the response is sometimes broken.
          "rewards": false,
          "commitment": commitment,
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
  const introducedDecimals = new Map<string, number>();
  const processedTransactions: ProcessedTransaction[] = [];
  for (let orderInBlock = 0; orderInBlock < blockData.transactions.length; orderInBlock++) {
    const tx = blockData.transactions[orderInBlock];

    // drop failed transactions
    if (tx.meta.err !== null) continue;

    const staticPubkeys = tx.transaction.message.accountKeys;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const allPubkeys: string[] = [...staticPubkeys, ...writablePubkeys, ...readonlyPubkeys];
    const mentionWhirlpoolProgram = allPubkeys.includes(WHIRLPOOL_PUBKEY);

    // drop transactions that did not mention whirlpool pubkey
    if (!mentionWhirlpoolProgram) continue;

    // innerInstructions is required to extract all executed whirlpool instructions via CPI
    // broken block does not have innerInstructions (null), it should be [] if no inner instructions exist
    invariant(tx.meta.innerInstructions !== null, "innerInstructions must exist");

    const {
      decodedInstructions: whirlpoolInstructions,
      programDeployDetected
    } = WhirlpoolTransactionDecoder.decodeWithProgramDeployDetection({ result: tx }, WHIRLPOOL_PUBKEY);
        
    // drop transactions that did not execute whirlpool instructions and did not do program deploy
    if (whirlpoolInstructions.length === 0 && !programDeployDetected) continue;

    // now we are sure that this transaction executed at least one whirlpool instruction or program deploy

    // for simplicity, we assume that program upgrade is never executed simultaneously with instruction execution
    let newProgramData: undefined | Buffer = undefined;
    if (programDeployDetected) {
      invariant(whirlpoolInstructions.length === 0, "whirlpoolInstructions must be empty when programDeployDetected");
      newProgramData = await fetchProgramData(solana, slot);
    }

    // FOR txs table
    const txid = toTxID(slot, orderInBlock);
    const signature: string = tx.transaction.signatures[0];
    const payer: string = tx.transaction.message.accountKeys[0];

    // FOR pubkeys table
    touchedPubkeys.add(payer);
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializeConfig":
          touchedPubkeys.add(ix.data.feeAuthority);
          touchedPubkeys.add(ix.data.collectProtocolFeesAuthority);
          touchedPubkeys.add(ix.data.rewardEmissionsSuperAuthority);
          break;
        case "initializeAdaptiveFeeTier":
          touchedPubkeys.add(ix.data.initializePoolAuthority);
          touchedPubkeys.add(ix.data.delegatedFeeAuthority);
          break;
        // auxiliaries
        case "lockPosition":
          touchedPubkeys.add(ix.auxiliaries.positionTokenAccountOwner);
          break;
        case "transferLockedPosition":
          touchedPubkeys.add(ix.auxiliaries.destinationTokenAccountOwner);
          break;
        // remaining accounts
        case "collectFeesV2":
        case "collectProtocolFeesV2":
        case "collectRewardV2":
        case "increaseLiquidityV2":
        case "decreaseLiquidityV2":
        case "swapV2":
        case "twoHopSwapV2":
          ix.remainingAccounts.forEach((pubkey) => touchedPubkeys.add(pubkey));
          break;
        default:
          break;
      }
      Object.values(ix.accounts).forEach((pubkey) => touchedPubkeys.add(pubkey));
    });

    // FOR decimals table
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializePool":
        case "initializePoolV2":
        case "initializePoolWithAdaptiveFee":
          introducedDecimals.set(ix.accounts.tokenMintA, ix.decimals.tokenMintA);
          introducedDecimals.set(ix.accounts.tokenMintB, ix.decimals.tokenMintB);
          break;
        case "initializeReward":
        case "initializeRewardV2":
          introducedDecimals.set(ix.accounts.rewardMint, ix.decimals.rewardMint);
          break;
        default:
          break;
      }
    });

    // FOR balances table
    const touchedVaultPubkeys = new Set<string>();
    const initializingVaultPubkeys = new Set<string>();
    whirlpoolInstructions.forEach((ix) => {
      switch (ix.name) {
        case "initializePool":
        case "initializePoolV2":
        case "initializePoolWithAdaptiveFee":
            // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          initializingVaultPubkeys.add(ix.accounts.tokenVaultA);
          initializingVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "increaseLiquidity":
        case "decreaseLiquidity":
        case "increaseLiquidityV2":
        case "decreaseLiquidityV2":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "collectFees":
        case "collectProtocolFees":
        case "collectFeesV2":
        case "collectProtocolFeesV2":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "initializeReward":
        case "initializeRewardV2":
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          initializingVaultPubkeys.add(ix.accounts.rewardVault);
          break;
        case "setRewardEmissions":
        case "setRewardEmissionsV2":
          // This instruction does not affect the token balance and preTokenBalance cannot be obtained.
          break;
        case "collectReward":
        case "collectRewardV2":
          touchedVaultPubkeys.add(ix.accounts.rewardVault);
          break;
        case "swap":
        case "swapV2":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultB);
          break;
        case "twoHopSwap":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneB);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoA);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoB);
          break;
        case "twoHopSwapV2":
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneInput);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultOneIntermediate);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoIntermediate);
          touchedVaultPubkeys.add(ix.accounts.tokenVaultTwoOutput);
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
        case "initializeConfigExtension":
        case "initializeTokenBadge":
        case "deleteTokenBadge":
        case "setConfigExtensionAuthority":
        case "setTokenBadgeAuthority":
        case "openPositionWithTokenExtensions":
        case "closePositionWithTokenExtensions":
        case "lockPosition":
        case "resetPositionRange":
        case "transferLockedPosition":
        case "initializeAdaptiveFeeTier":
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
      const preBalance: string | undefined = tx.meta.preTokenBalances.find((b) => b.accountIndex === index)?.uiTokenAmount.amount
        ?? (initializingVaultPubkeys.has(vault) ? "0" : undefined);
      invariant(preBalance, "preBalance must exist");
      const postBalance: string | undefined = tx.meta.postTokenBalances.find((b) => b.accountIndex === index)?.uiTokenAmount.amount;
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
      newProgramData,
    });
  }

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

  // insert into decimals
  if (introducedDecimals.size > 0) {
    // .batch does not support CALL command
    for (const [mint, decimals] of introducedDecimals) {
      await database.query(
        "CALL addDecimalsIfNotExists(fromPubkeyBase58(?), ?)",
        [mint, decimals]
      );
    }
  }

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

    // insert into ixsProgramDeploy
    if (tx.newProgramData) {
      invariant(tx.whirlpoolInstructions.length === 0, "whirlpoolInstructions must be empty when programDeployDetected");
      const order = 0;

      await insertProgramDeployInstruction(tx.txid, order, tx.newProgramData, database);
    }
  }

  // update slots
  await database.query("DELETE FROM admQueuedSlots WHERE slot = ?", [slot]);
  await database.query("INSERT INTO slots (slot, blockHeight, blockTime) VALUES(?, ?, ?)", [slot, blockHeight, blockTime]);

  await database.commit();

  // advance checkpoint
  try {
    await database.query("CALL advanceCheckpoint()");
  } catch (err) {
    // ignore but report
    console.error("advanceCheckpoint failed:", err);
  }
}


type ProcessedTransaction = {
  txid: bigint;
  signature: string;
  payer: string;
  balances: { account: string, pre: string, post: string }[];
  whirlpoolInstructions: DecodedWhirlpoolInstruction[];
  newProgramData: undefined | Buffer;
};


function toTxID(slot: number, orderInBlock: number): bigint {
  // 40 bits for slot, 24 bits for orderInBlock
  const txid = BigInt(slot) * BigInt(2 ** 24) + BigInt(orderInBlock);
  return txid;
}


async function insertInstruction(txid: bigint, order: number, ix: DecodedWhirlpoolInstruction, database: Connection) {
  const buildSQL = (ixName: string, numData: number, numKey: number, numTransfer: number): string => {
    const table = `ixs${ixName.charAt(0).toUpperCase() + ixName.slice(1)}`;
    const data = Array(numData).fill(", ?").join("");
    const key = Array(numKey).fill(", fromPubkeyBase58(?)").join("");
    const transfer = Array(numTransfer).fill(", ?").join("");
    return `INSERT INTO ${table} VALUES (?, ?${data}${key}${transfer})`;
  };

  const buildV2SQL = (ixName: string, numData: number, numKey: number, numTransfer: number): string => {
    const table = `ixs${ixName.charAt(0).toUpperCase() + ixName.slice(1)}`;
    const data = Array(numData).fill(", ?").join("");
    const key = Array(numKey).fill(", fromPubkeyBase58(?)").join("");
    const remainingAccounts = ", encodeU8U8TupleArray(?), encodeBase58PubkeyArray(?)";
    // amount, transfer fee config initialized, transfer fee bps, transfer fee max
    const transfer = Array(numTransfer).fill(", ?, ?, ?, ?").join("");
    return `INSERT INTO ${table} VALUES (?, ?${data}${key}${remainingAccounts}${transfer})`;
  };

  const jsonifyRemainingAccountsInfo = (remainingAccountsInfo: RemainingAccountsInfo): string => {
    return JSON.stringify(
      remainingAccountsInfo.map((slice) => [slice.accountsType, slice.length])
    );
  };

  const jsonifyRemainingAccounts = (remainingAccounts: RemainingAccounts): string => {
    return JSON.stringify(remainingAccounts);
  };

  const flattenV2Transfer = (transfer: TransferAmountWithTransferFeeConfig) => {
    return transfer.transferFeeConfig
      ? [transfer.amount, 1, transfer.transferFeeConfig.basisPoints, transfer.transferFeeConfig.maximumFee]
      : [transfer.amount, 0, 0, 0n];
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
    case "collectFeesV2":
      return database.query(buildV2SQL(ix.name, 0, 13, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpool,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultB,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.memoProgram,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
      ]);
    case "collectProtocolFeesV2":
      return database.query(buildV2SQL(ix.name, 0, 12, 2), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpool,
        ix.accounts.collectProtocolFeesAuthority,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tokenDestinationA,
        ix.accounts.tokenDestinationB,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.memoProgram,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
      ]);
    case "collectRewardV2":
      return database.query(buildV2SQL(ix.name, 1, 9, 1), [
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
        ix.accounts.rewardMint,
        ix.accounts.rewardVault,
        ix.accounts.rewardTokenProgram,
        ix.accounts.memoProgram,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
      ]);
    case "increaseLiquidityV2":
      return database.query(buildV2SQL(ix.name, 3, 15, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidityAmount.toString()),
        BigInt(ix.data.tokenMaxA.toString()),
        BigInt(ix.data.tokenMaxB.toString()),
        // key
        ix.accounts.whirlpool,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.memoProgram,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArrayLower,
        ix.accounts.tickArrayUpper,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
      ]);
    case "decreaseLiquidityV2":
      return database.query(buildV2SQL(ix.name, 3, 15, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.liquidityAmount.toString()),
        BigInt(ix.data.tokenMinA.toString()),
        BigInt(ix.data.tokenMinB.toString()),
        // key
        ix.accounts.whirlpool,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.memoProgram,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArrayLower,
        ix.accounts.tickArrayUpper,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
      ]);
    case "swapV2":
      return database.query(buildV2SQL(ix.name, 5, 15, 2), [
        txid,
        order,
        // data
        BigInt(ix.data.amount.toString()),
        BigInt(ix.data.otherAmountThreshold.toString()),
        BigInt(ix.data.sqrtPriceLimit.toString()),
        ix.data.amountSpecifiedIsInput,
        ix.data.aToB,
        // key
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.memoProgram,
        ix.accounts.tokenAuthority,
        ix.accounts.whirlpool,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenOwnerAccountA,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenOwnerAccountB,
        ix.accounts.tokenVaultB,
        ix.accounts.tickArray0,
        ix.accounts.tickArray1,
        ix.accounts.tickArray2,
        ix.accounts.oracle,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
      ]);
    case "twoHopSwapV2":
      return database.query(buildV2SQL(ix.name, 7, 24, 3), [
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
        ix.accounts.whirlpoolOne,
        ix.accounts.whirlpoolTwo,
        ix.accounts.tokenMintInput,
        ix.accounts.tokenMintIntermediate,
        ix.accounts.tokenMintOutput,
        ix.accounts.tokenProgramInput,
        ix.accounts.tokenProgramIntermediate,
        ix.accounts.tokenProgramOutput,
        ix.accounts.tokenOwnerAccountInput,
        ix.accounts.tokenVaultOneInput,
        ix.accounts.tokenVaultOneIntermediate,
        ix.accounts.tokenVaultTwoIntermediate,
        ix.accounts.tokenVaultTwoOutput,
        ix.accounts.tokenOwnerAccountOutput,
        ix.accounts.tokenAuthority,
        ix.accounts.tickArrayOne0,
        ix.accounts.tickArrayOne1,
        ix.accounts.tickArrayOne2,
        ix.accounts.tickArrayTwo0,
        ix.accounts.tickArrayTwo1,
        ix.accounts.tickArrayTwo2,
        ix.accounts.oracleOne,
        ix.accounts.oracleTwo,
        ix.accounts.memoProgram,
        // remainingAccounts
        jsonifyRemainingAccountsInfo(ix.data.remainingAccountsInfo),
        jsonifyRemainingAccounts(ix.remainingAccounts),
        // transfer
        ...flattenV2Transfer(ix.transfers[0]),
        ...flattenV2Transfer(ix.transfers[1]),
        ...flattenV2Transfer(ix.transfers[2]),
      ]);
    case "initializePoolV2":
      return database.query(buildSQL(ix.name, 2, 14, 0), [
        txid,
        order,
        // data
        ix.data.tickSpacing,
        BigInt(ix.data.initialSqrtPrice.toString()),
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenBadgeA,
        ix.accounts.tokenBadgeB,
        ix.accounts.funder,
        ix.accounts.whirlpool,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.feeTier,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);
    case "initializeRewardV2":
      return database.query(buildSQL(ix.name, 1, 9, 0), [
        txid,
        order,
        // data
        ix.data.rewardIndex,
        // key
        ix.accounts.rewardAuthority,
        ix.accounts.funder,
        ix.accounts.whirlpool,
        ix.accounts.rewardMint,
        ix.accounts.rewardTokenBadge,
        ix.accounts.rewardVault,
        ix.accounts.rewardTokenProgram,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);
    case "setRewardEmissionsV2":
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
    case "initializeConfigExtension":
      return database.query(buildSQL(ix.name, 0, 5, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpoolsConfigExtension,
        ix.accounts.funder,
        ix.accounts.feeAuthority,
        ix.accounts.systemProgram,
        // no transfer
      ]);
    case "initializeTokenBadge":
      return database.query(buildSQL(ix.name, 0, 7, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpoolsConfigExtension,
        ix.accounts.tokenBadgeAuthority,
        ix.accounts.tokenMint,
        ix.accounts.tokenBadge,
        ix.accounts.funder,
        ix.accounts.systemProgram,
        // no transfer
      ]);
    case "deleteTokenBadge":
      return database.query(buildSQL(ix.name, 0, 6, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpoolsConfigExtension,
        ix.accounts.tokenBadgeAuthority,
        ix.accounts.tokenMint,
        ix.accounts.tokenBadge,
        ix.accounts.receiver,
        // no transfer
      ]);
    case "setConfigExtensionAuthority":
      return database.query(buildSQL(ix.name, 0, 4, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpoolsConfigExtension,
        ix.accounts.configExtensionAuthority,
        ix.accounts.newConfigExtensionAuthority,
        // no transfer
      ]);
    case "setTokenBadgeAuthority":
      return database.query(buildSQL(ix.name, 0, 4, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.whirlpoolsConfigExtension,
        ix.accounts.configExtensionAuthority,
        ix.accounts.newTokenBadgeAuthority,
        // no transfer
      ]);
    case "openPositionWithTokenExtensions":
      return database.query(buildSQL(ix.name, 3, 10, 0), [
        txid,
        order,
        // data
        ix.data.tickLowerIndex,
        ix.data.tickUpperIndex,
        ix.data.withTokenMetadataExtension,
        // key
        ix.accounts.funder,
        ix.accounts.owner,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionTokenAccount,
        ix.accounts.whirlpool,
        ix.accounts.token2022Program,
        ix.accounts.systemProgram,
        ix.accounts.associatedTokenProgram,
        ix.accounts.metadataUpdateAuth,
        // no transfer
      ]);
    case "closePositionWithTokenExtensions":
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
        ix.accounts.token2022Program,
        // no transfer
      ]);
    case "lockPosition":
      return database.query(buildSQL(ix.name, 1, 9 + 1, 0), [
        txid,
        order,
        // data
        JSON.stringify(ix.data.lockType),
        // key
        ix.accounts.funder,
        ix.accounts.positionAuthority,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionTokenAccount,
        ix.accounts.lockConfig,
        ix.accounts.whirlpool,
        ix.accounts.token2022Program,
        ix.accounts.systemProgram,
        // aux as key
        ix.auxiliaries.positionTokenAccountOwner,
        // no transfer
      ]);
    case "resetPositionRange":
      return database.query(buildSQL(ix.name, 2, 6, 0), [
        txid,
        order,
        // data
        ix.data.newTickLowerIndex,
        ix.data.newTickUpperIndex,
        // key
        ix.accounts.funder,
        ix.accounts.positionAuthority,
        ix.accounts.whirlpool,
        ix.accounts.position,
        ix.accounts.positionTokenAccount,
        ix.accounts.systemProgram,
        // no transfer
      ]);
    case "transferLockedPosition":
      return database.query(buildSQL(ix.name, 0, 8 + 1, 0), [
        txid,
        order,
        // no data
        // key
        ix.accounts.positionAuthority,
        ix.accounts.receiver,
        ix.accounts.position,
        ix.accounts.positionMint,
        ix.accounts.positionTokenAccount,
        ix.accounts.destinationTokenAccount,
        ix.accounts.lockConfig,
        ix.accounts.token2022Program,
        // aux as key
        ix.auxiliaries.destinationTokenAccountOwner,
        // no transfer
      ]);
    case "initializeAdaptiveFeeTier":
      return database.query(buildSQL(ix.name, 12 - 2, 5 + 2, 0), [
        txid,
        order,
        // data
        ix.data.feeTierIndex,
        ix.data.tickSpacing,
        ix.data.defaultBaseFeeRate,
        ix.data.filterPeriod,
        ix.data.decayPeriod,
        ix.data.reductionFactor,
        ix.data.adaptiveFeeControlFactor,
        ix.data.maxVolatilityAccumulator,
        ix.data.tickGroupSize,
        ix.data.majorSwapThresholdTicks,
        // data as key
        ix.data.initializePoolAuthority,
        ix.data.delegatedFeeAuthority,
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.adaptiveFeeTier,
        ix.accounts.funder,
        ix.accounts.feeAuthority,
        ix.accounts.systemProgram,
        // no transfer
      ]);
    case "initializePoolWithAdaptiveFee":
      return database.query(buildSQL(ix.name, 2, 16, 0), [
        txid,
        order,
        // data
        BigInt(ix.data.initialSqrtPrice.toString()),
        BigInt(ix.data.tradeEnableTimestamp.toString()),
        // key
        ix.accounts.whirlpoolsConfig,
        ix.accounts.tokenMintA,
        ix.accounts.tokenMintB,
        ix.accounts.tokenBadgeA,
        ix.accounts.tokenBadgeB,
        ix.accounts.funder,
        ix.accounts.initializePoolAuthority,
        ix.accounts.whirlpool,
        ix.accounts.oracle,
        ix.accounts.tokenVaultA,
        ix.accounts.tokenVaultB,
        ix.accounts.adaptiveFeeTier,
        ix.accounts.tokenProgramA,
        ix.accounts.tokenProgramB,
        ix.accounts.systemProgram,
        ix.accounts.rent,
        // no transfer
      ]);  
    default:
      throw new Error("unknown whirlpool instruction name");
  }
}

async function insertProgramDeployInstruction(txid: bigint, order: number, programData: Buffer, database: Connection) {
  await database.query(
    //
    // DO NOT USE TO_BASE64 FUNCTION ON MARIADB (it insert new line every 76 chars)
    //
    "INSERT INTO ixsProgramDeploy VALUES(?, ?, ?)",
    [txid, order, programData.toString("base64")]
  );
}

async function fetchProgramData(
  solana: AxiosInstance,
  slot: number,
): Promise<Buffer> {
  // getAccountInfo
  // see: https://solana.com/docs/rpc/http/getaccountinfo
  const response = await solana.request({
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [
        WHIRLPOOL_PROGRAM_DATA_PUBKEY,
        {
          commitment: "finalized",
          encoding: "base64",
        },
      ],
    },
  });

  if (response.data?.error) {
    throw new Error(`getAccountInfo(${WHIRLPOOL_PROGRAM_DATA_PUBKEY}) failed: ${JSON.stringify(response.data.error)}`);
  }
  invariant(response.data?.result, "result must be truthy");
  invariant(response.data.result.value?.data, "data must exist");
  invariant(response.data.result.value.data.length === 2, "data length must be 2");
  invariant(response.data.result.value.data[1] === "base64", "data[1] must be base64");

  // https://github.com/solana-labs/solana/blob/27eff8408b7223bb3c4ab70523f8a8dca3ca6645/sdk/program/src/bpf_loader_upgradeable.rs#L45
  // 45 byte header + program data
  // header:
  //   - 4  bytes: 0x03, 0x00, 0x00, 0x00 ("ProgramData" enum discriminator)
  //   - 8  bytes: last modified slot (u64)
  //   - 33 bytes: Option<Pubkey> (upgrade authority)
  const dataBuffer = Buffer.from(response.data.result.value.data[0], "base64");
  invariant(dataBuffer.length === WHIRLPOOL_PROGRAM_DATA_ACCOUNT_SIZE, `data length must be ${WHIRLPOOL_PROGRAM_DATA_ACCOUNT_SIZE}`);
  const accountDiscriminator = dataBuffer.readUInt32LE(0);
  invariant(accountDiscriminator === 3, "account discriminator must be 3 (ProgramData)");

  // This constraint is NOT satisfied if a past deployment has already been overwritten.
  // In this case, it is necessary to analyze the Write instruction to recovery the past state.
  // This constraint is effective when parsing blocks in semi-real-time.
  // The program must wait 750 slots (DEPLOYMENT_COOLDOWN_IN_SLOTS) until the next upgrade,
  // so it is not necessary to consider the possibility of being upgraded again in a very short time.
  const lastModifiedSlot = dataBuffer.readBigUInt64LE(4);
  if (slot !== Number(lastModifiedSlot)) {
    throw new Error(`lastModifiedSlot mismatch: ${slot} !== ${lastModifiedSlot}`);
  }

  const programDataBuffer = dataBuffer.slice(45);
  return programDataBuffer;
}
