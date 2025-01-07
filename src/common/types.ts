export enum WorkerQueueName {
  SEQUENCER = "sequencer",
  BACKFILL = "backfill",
  PROCESSOR = "processor",
}

export type Commitment = "finalized" | "confirmed";

export type State = {
  latestBlockSlot: number;
  latestBlockHeight: number;
};

export type Slot = {
  slot: number;
  blockHeight: number;
  blockTimestamp: number | null;
};

export type BackfillSlot = {
  slot: number;
  blockHeight: number;
};
