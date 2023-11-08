import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { BackfillState } from "../common/types";
import invariant from "tiny-invariant";

export async function fetchBackfillSlots(database: Connection, solana: AxiosInstance, limit: number, maxQueuedSlots: number) {
  const [{ count }] = await database.query('SELECT COUNT(*) as count FROM admQueuedSlots WHERE isBackfillSlot IS TRUE');

  if (count > maxQueuedSlots) {
    // already enough queued slots
    return;
  }

  const [backfillState] = await database.query<BackfillState[]>('SELECT * FROM admBackfillState WHERE enabled IS TRUE AND latestBlockHeight < maxBlockHeight ORDER BY maxBlockHeight DESC LIMIT 1');

  if (!backfillState) {
    // no backfill required
    return;
  }

  const { maxBlockHeight, latestBlockSlot, latestBlockHeight } = backfillState;

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
        { commitment: "finalized" },
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

  const newSlots = slots.map((slot, delta) => ({ slot, blockHeight: latestBlockHeight + delta }))
    .filter(s => s.blockHeight <= maxBlockHeight)
    .slice(1);
  const newLatestSlot = newSlots[newSlots.length - 1];

  await database.beginTransaction();
  await database.query("UPDATE admBackfillState SET latestBlockSlot = ?, latestBlockHeight = ? WHERE maxBlockHeight = ? AND latestBlockSlot = ?", [newLatestSlot.slot, newLatestSlot.blockHeight, maxBlockHeight, latestBlockSlot]);
  await database.batch("INSERT INTO admQueuedSlots (slot, blockHeight, enqueuedAt, isBackfillSlot) VALUES (?, ?, UNIX_TIMESTAMP(), ?)", newSlots.map(s => [s.slot, s.blockHeight, true]));
  await database.commit();
}
