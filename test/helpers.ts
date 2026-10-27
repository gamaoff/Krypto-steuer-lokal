import { buildLedger, parseTransactions, RULES, type Ledger } from "../src/engine/index.ts";

const HEADER = "date,type,wallet,asset_in,amount_in,asset_out,amount_out,eur_value,fee_eur,to_wallet,note";

/** Builds a ledger from CSV body lines written in the generic format. */
export function ledgerFrom(...lines: string[]): Ledger {
  const { transactions, alerts } = parseTransactions([HEADER, ...lines].join("\n"), "test.csv");
  if (alerts.length > 0) throw new Error(`Unexpected parse alerts: ${JSON.stringify(alerts)}`);
  return buildLedger(transactions, RULES);
}

/** Money as a 2-decimal string, the way it would be declared. */
export const eur = (d: { toFixed(dp: number): string }) => d.toFixed(2);
