import { Connection } from "mariadb";
import { AxiosInstance } from "axios";
import { BackfillSlot } from "../common/types";
import invariant from "tiny-invariant";

export async function fetchBackfillSlots(database: Connection, solana: AxiosInstance, limit: number, maxQueuedSlots: number) {
  const [{ count }] = await database.query('SELECT COUNT(*) as count FROM admQueuedSlots WHERE isBackfillSlot IS TRUE');

  if (count > maxQueuedSlots) {
    // already enough queued slots
    return;
  }

  const backfillSlots = await database.query<BackfillSlot[]>('SELECT * FROM admBackfillSlots ORDER BY slot DESC LIMIT ?', [limit]);

  if (backfillSlots.length === 0) {
    // no backfill required
    return;
  }

  await database.beginTransaction();
  await database.batch("DELETE FROM admBackfillSlots WHERE slot = ?", backfillSlots.map(s => [s.slot]));
  await database.batch("INSERT INTO admQueuedSlots (slot, blockHeight, isBackfillSlot) VALUES (?, ?, ?)", backfillSlots.map(s => [s.slot, s.blockHeight, true]));
  await database.commit();
}
