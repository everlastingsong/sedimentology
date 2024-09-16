import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import axios from "axios";
import invariant from "tiny-invariant";
import { DecodedWhirlpoolInstruction, RemainingAccounts, RemainingAccountsInfo, TransferAmountWithTransferFeeConfig, WhirlpoolTransactionDecoder } from "@yugure-orca/whirlpool-tx-decoder";

const WHIRLPOOL_PUBKEY = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

export async function fetchAndProcessBlock(solana: AxiosInstance, slot: number) {
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

  const blockTime = json.result.blockTime;

  ////////////////////////////////////////////////////////////////////////////////
  // PROCESSOR
  ////////////////////////////////////////////////////////////////////////////////

  const blockData = json.result;
  const blockHeight = blockData.blockHeight;

  // process transactions
console.log("transactions", blockData.transactions.length);
  for (let orderInBlock = 0; orderInBlock < blockData.transactions.length; orderInBlock++) {
    const tx = blockData.transactions[orderInBlock];

    // drop failed transactions
    // 🚨return to continue
    if (tx.meta.err !== null) continue;

    const staticPubkeys = tx.transaction.message.accountKeys;
    const writablePubkeys = tx.meta.loadedAddresses.writable;
    const readonlyPubkeys = tx.meta.loadedAddresses.readonly;
    const allPubkeys: string[] = [...staticPubkeys, ...writablePubkeys, ...readonlyPubkeys];
    const mentionWhirlpoolProgram = allPubkeys.includes(WHIRLPOOL_PUBKEY);

    // drop transactions that did not mention whirlpool pubkey
    // 🚨return to continue
    if (!mentionWhirlpoolProgram) continue;

    // innerInstructions is required to extract all executed whirlpool instructions via CPI
    // broken block does not have innerInstructions (null), it should be [] if no inner instructions exist
    invariant(tx.meta.innerInstructions !== null, "innerInstructions must exist");

    const {
      decodedInstructions: whirlpoolInstructions,
      programDeployDetected
    } = WhirlpoolTransactionDecoder.decodeWithProgramDeployDetection({ result: tx }, WHIRLPOOL_PUBKEY);
    
    if (programDeployDetected) {
      invariant(whirlpoolInstructions.length === 0, "whirlpoolInstructions must be empty");
      console.log(
        "program deploy detected!",
        `slot: ${slot}`,
        `blockHeight: ${blockHeight}`,
        `signature: ${tx.transaction.signatures[0]}`,
      );

      const programDataBuffer = await getProgramDataBuffer(solana, slot);
      console.log("programDataBuffer", programDataBuffer.length);
    }

  }

  console.log("transaction count", blockData.transactions.length);
}

// Program data account is PDA based on program address, so it is constant for each program
const WHIRLPOOL_PROGRAM_DATA_PUBKEY = "CtXfPzz36dH5Ws4UYKZvrQ1Xqzn42ecDW6y8NKuiN8nD";
const WHIRLPOOL_PROGRAM_DATA_ACCOUNT_SIZE = 1405485;

async function getProgramDataBuffer(
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
    // This block continues to output errors when it reaches this state, so delay
    await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
    throw new Error(`program deploy detected, but lastModifiedSlot mismatch: ${slot} !== ${lastModifiedSlot}`);
  }

  const programDataBuffer = dataBuffer.slice(45);
  return programDataBuffer;
}

async function main() {
  const solanaRpcUrl = process.env.SOLANA_RPC_URL;
  if (!solanaRpcUrl || solanaRpcUrl.length < "http://".length) {
    throw new Error("SOLANA_RPC_URL is required");
  }

  const solana = axios.create({
    baseURL: solanaRpcUrl,
    method: "post",
  });

  // 287352124: upgrade at Sep 2, 2024
  // signature: 5LDEtFBn6cyRYRY6sjiekVU9Pc68BZQMz5jfznpg1sXhueGCUb9LiS8T9SC2xpQpxPs6KNKUB6dvq95oA9sWXM5M
  // https://solscan.io/tx/5LDEtFBn6cyRYRY6sjiekVU9Pc68BZQMz5jfznpg1sXhueGCUb9LiS8T9SC2xpQpxPs6KNKUB6dvq95oA9sWXM5M
  await fetchAndProcessBlock(solana, 287352124);
}

main();