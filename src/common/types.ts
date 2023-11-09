export enum WorkerQueueName {
  SEQUENCER = "sequencer",
  BACKFILL_SEQUENCER = "backfill_sequencer",
  PROCESSOR = "processor",
}

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
