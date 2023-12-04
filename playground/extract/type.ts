export type MinMaxSlot = {
  minSlot: bigint;
  maxSlot: bigint;
};

export type Slot = {
  slot: bigint;
  blockHeight: bigint;
  blockTime: number;
};

export type Transaction = {
  txid: bigint;
  signature: string;
  payer: string;
};

export type Balance = {
  txid: bigint;
  account: string;
  pre: bigint;
  post: bigint;
};

export type Instruction = {
  txid: bigint;
  order: number;
  ix: string;
  json: any;
};
