export enum SlotProcessingState {
  Added = 0,
  Fetched = 1,
  Processed = 2,
}

export type State = {
  latestBlockSlot: number;
  latestBlockHeight: number;
};

export type Slot = {
  slot: number;
  blockHeight: number;
  blockTimestamp: number | null;
  state: SlotProcessingState;
};

export type Block = {
  slot: number;
  gzJsonString: Buffer;
};
