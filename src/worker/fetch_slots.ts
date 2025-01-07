import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { Commitment, State } from "../common/types";
import invariant from "tiny-invariant";

export async function fetchSlots(database: Connection, solana: AxiosInstance, limit: number, maxQueuedSlots: number, commitment: Commitment) {
  const [{ count }] = await database.query('SELECT COUNT(*) as count FROM admQueuedSlots WHERE isBackfillSlot IS FALSE');

  if (count > maxQueuedSlots) {
    // already enough queued slots
    return;
  }

  const [{ latestBlockSlot, latestBlockHeight }] = await database.query<State[]>('SELECT * FROM admState');

  // getBlocksWithLimit
  // see: https://docs.solana.com/api/http#getblockswithlimit
  const response = await solana.request({
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

  if (response.data?.error) {
    throw new Error(`getBlocksWithLimit(${latestBlockSlot}, ${limit}) failed: ${JSON.stringify(response.data.error)}`);
  }
  invariant(response.data?.result, "result must be truthy");

  const slots: number[] = response.data.result;

  invariant(slots.length >= 1, "at least latestBlockSlot should be returned");
  invariant(slots[0] === latestBlockSlot, "first slot should be latestBlockSlot");

  if (slots.length === 1) {
    // no new blocks
    return;
  }

  const newSlots = slots.map((slot, delta) => ({ slot, blockHeight: latestBlockHeight + delta })).slice(1);
  const newLatestSlot = newSlots[newSlots.length - 1];

  await database.beginTransaction();
  await database.query("UPDATE admState SET latestBlockSlot = ?, latestBlockHeight = ? WHERE latestBlockSlot = ?", [newLatestSlot.slot, newLatestSlot.blockHeight, latestBlockSlot]);
  await database.batch("INSERT INTO admQueuedSlots (slot, blockHeight, isBackfillSlot) VALUES (?, ?, ?)", newSlots.map(s => [s.slot, s.blockHeight, false]));
  await database.commit();
}
