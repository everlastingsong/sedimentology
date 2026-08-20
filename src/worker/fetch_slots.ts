import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { Commitment, State } from "../common/types";
import invariant from "tiny-invariant";

export async function fetchSlots(database: Connection, solana: AxiosInstance, limit: number, maxQueuedSlots: number, slotDelay: number, commitment: Commitment) {
  const [{ count }] = await database.query('SELECT COUNT(*) as count FROM admQueuedSlots WHERE isBackfillSlot IS FALSE');

  if (count > maxQueuedSlots) {
    // already enough queued slots
    return;
  }

  const [{ latestBlockSlot, latestBlockHeight }] = await database.query<State[]>('SELECT * FROM admState');

  // getBlockWithLimit frequently skipped blocks that actually existed.
  // To account for the possibility that the state is not yet stable, delay processing until the slot is sufficiently old.
  // Prioritize reliable operation with fewer errors over real-time processing.
  if (slotDelay > 0) {
    // getSlot
    // see: https://solana.com/docs/rpc/http/getslot
    const getSlotResponse = await solana.request({
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [
          { commitment: commitment },
        ],
      },
    });
    if (getSlotResponse.data?.error) {
      throw new Error(`getSlot failed: ${JSON.stringify(getSlotResponse.data.error)}`);
    }
    invariant(getSlotResponse.data?.result, "result must be truthy");

    const latestSlot: number = getSlotResponse.data.result;

    invariant(latestSlot >= latestBlockSlot, "The latest slot should not be older than the ingested slot");

    const slotLag = latestSlot - latestBlockSlot;
    if (slotLag < slotDelay) {
      console.debug(`Skipping ingestion: latestSlot=${latestSlot}, latestBlockSlot=${latestBlockSlot}, slotLag=${slotLag}, slotDelay=${slotDelay}`);
      return;
    }
    console.debug(`Proceeding with ingestion: latestSlot=${latestSlot}, latestBlockSlot=${latestBlockSlot}, slotLag=${slotLag}, slotDelay=${slotDelay}`);
  }

  // getBlocksWithLimit
  // see: https://solana.com/docs/rpc/http/getblockswithlimit
  const getBlocksWithLimitResponse = await solana.request({
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "getBlocksWithLimit",
      params: [
        latestBlockSlot,
        limit + 1, // latestBlockSlot is included
        { commitment: commitment },
      ],
    },
  });

  if (getBlocksWithLimitResponse.data?.error) {
    throw new Error(`getBlocksWithLimit(${latestBlockSlot}, ${limit}) failed: ${JSON.stringify(getBlocksWithLimitResponse.data.error)}`);
  }
  invariant(getBlocksWithLimitResponse.data?.result, "result must be truthy");

  const slots: number[] = getBlocksWithLimitResponse.data.result;

  invariant(slots.length >= 1, "at least latestBlockSlot should be returned");
  invariant(slots[0] === latestBlockSlot, "first slot should be latestBlockSlot");

  if (slots.length === 1) {
    // no new blocks
    return;
  }

  const newSlots = slots.map((slot, delta) => ({ slot, blockHeight: latestBlockHeight + delta })).slice(1);
  const newLatestSlot = newSlots[newSlots.length - 1];

  console.debug("latestBlockSlot", latestBlockSlot, "newLatestSlot", newLatestSlot);

  // getBlocksWithLimit frequently returned responses with missing blocks.
  // Validate that blockHeight matches the expected value to prevent blocks from being missed.

  // getBlock
  // see: https://solana.com/docs/rpc/http/getblock
  const getBlockResponse = await solana.request({
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "getBlock",
      params: [
        newLatestSlot.slot,
        {
          "encoding": "json",
          // Transaction details are not needed in this context.
          // The response size remains limited to a small JSON payload.
          "transactionDetails": "none",
          "maxSupportedTransactionVersion": 0,
          "rewards": false,
          "commitment": commitment,
        },
      ],
    },
    // we want to obtain raw string data, so do not use any transformation
    transformResponse: (r) => r,
  });

  const originalData = getBlockResponse.data as string;

  // JSON.parse cannot handle numbers > Number.MAX_SAFE_INTEGER precisely,
  // but it is okay because the ALL fields we are interested are < Number.MAX_SAFE_INTEGER or string.
  const json = JSON.parse(originalData);

  // JSON RPC ensures that error field is used when error occurs
  if (json.error) {
    throw new Error(`getBlock(${newLatestSlot.slot}) failed: ${JSON.stringify(json.error)}`);
  }
  invariant(json.result, "result must be truthy");

  // sanity check
  invariant(json.result.blockHeight, "blockHeight must exist");
  invariant(json.result.blockTime, "blockTime must exist");
  invariant(json.result.blockhash, "blockhash must exist");
  invariant(json.result.parentSlot, "parentSlot must exist");

  invariant(json.result.blockHeight === newLatestSlot.blockHeight, "blockHeight must match");

  await database.beginTransaction();
  await database.query("UPDATE admState SET latestBlockSlot = ?, latestBlockHeight = ? WHERE latestBlockSlot = ?", [newLatestSlot.slot, newLatestSlot.blockHeight, latestBlockSlot]);
  await database.batch("INSERT INTO admQueuedSlots (slot, blockHeight, isBackfillSlot) VALUES (?, ?, ?)", newSlots.map(s => [s.slot, s.blockHeight, false]));
  await database.commit();
}
