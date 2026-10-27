import type { Dec } from "./decimal.ts";
import type { Day } from "./dates.ts";

export type TxType = "buy" | "sell" | "swap" | "transfer" | "reward";

export interface SourceRef {
  file: string;
  /** 1-based line number in the original file. */
  line: number;
}

export interface Transaction {
  id: string;
  ts: number;
  day: Day;
  type: TxType;
  wallet: string;
  assetIn?: string;
  amountIn?: Dec;
  assetOut?: string;
  amountOut?: Dec;
  /** buy: EUR paid · sell: EUR received · swap: market value of the trade · reward: market value at receipt */
  eurValue?: Dec;
  feeEur: Dec;
  toWallet?: string;
  note?: string;
  source: SourceRef;
  /** Position in the combined input, used to keep the original order for equal timestamps. */
  seq: number;
}

/** A batch of units acquired together, tracked separately per wallet. */
export interface Lot {
  id: string;
  asset: string;
  wallet: string;
  acquiredDay: Day;
  acquiredTs: number;
  /** Transaction that created the units. Kept when units move between own wallets. */
  acquiredTxId: string | null;
  origin: "buy" | "swap" | "reward" | "unknown";
  /** Units still held. */
  amount: Dec;
  /** Remaining cost basis in EUR for those units. */
  cost: Dec;
  /** True when the acquisition could not be found in the imported data. */
  costUnknown: boolean;
}

/** The part of a sale or swap that consumed one lot. */
export interface DisposalPart {
  id: string;
  txId: string;
  kind: "sell" | "swap";
  asset: string;
  wallet: string;
  amount: Dec;
  acquiredDay: Day;
  acquiredTxId: string | null;
  disposedDay: Day;
  disposedTs: number;
  cost: Dec;
  proceeds: Dec;
  gain: Dec;
  taxFreeFrom: Day;
  /** Held for more than one year (§ 23 Abs. 1 Nr. 2 EStG): no tax under current law. */
  heldOverOneYear: boolean;
  costUnknown: boolean;
  /** Under the 30/09/2026 draft, lots acquired after the cutoff fall under § 20 EStG. */
  lotAfterDraftCutoff: boolean;
}

/** Staking, lending and similar rewards: other income under § 22 Nr. 3 EStG. */
export interface IncomeEvent {
  id: string;
  txId: string;
  day: Day;
  wallet: string;
  asset: string;
  amount: Dec;
  eurValue: Dec;
}

export type AlertCode =
  | "PARSE_MISSING_COLUMN"
  | "PARSE_BAD_ROW"
  | "MISSING_LOTS_DISPOSAL"
  | "MISSING_LOTS_TRANSFER"
  | "FEE_EXCEEDS_PROCEEDS";

export interface Alert {
  code: AlertCode;
  severity: "error" | "warning";
  txId?: string;
  source?: SourceRef;
  params: Record<string, string>;
}

export interface Ledger {
  transactions: Transaction[];
  openLots: Lot[];
  disposals: DisposalPart[];
  incomes: IncomeEvent[];
  alerts: Alert[];
}
