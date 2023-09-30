import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { State, SlotProcessingState } from "../common/types";
import invariant from "tiny-invariant";

export async function fetchSlots(database: Connection, solana: AxiosInstance, limit: number) {
  const [{ latestBlockSlot, latestBlockHeight }] = await database.query<State[]>('SELECT * FROM state');

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

  const newSlots = slots.map((slot, delta) => ({ slot, blockHeight: latestBlockHeight + delta })).slice(1);
  const newLatestSlot = newSlots[newSlots.length - 1];

  await database.beginTransaction();
  await database.query("UPDATE state SET latestBlockSlot = ?, latestBlockHeight = ? WHERE latestBlockSlot = ?", [newLatestSlot.slot, newLatestSlot.blockHeight, latestBlockSlot]);
  await database.batch("INSERT INTO slots (slot, blockHeight, state) VALUES (?, ?, ?)", newSlots.map(s => [s.slot, s.blockHeight, SlotProcessingState.Added]));
  await database.commit();
}
