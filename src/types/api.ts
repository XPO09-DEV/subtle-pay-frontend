export type Wallet = {
  address: string;
  balanceToken: number;
  balanceUsd: number;
  balanceLocal: number;
  currency: string;
};

export type Me = { accountId: string; alias: string | null; currency: string };

export type Rates = { tokenUsd: number; usdLocal: number; updatedAt: string };

export type Payment = {
  id: string;
  direction: "in" | "out";
  counterparty: string;
  usdValue: number;
  localValue: number;
  status: string;
  createdAt: string;
};

export type SendResult = {
  txId: string;
  status: string;
  tokenAmount: number;
  usdValue: number;
};