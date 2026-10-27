import { parseCsv } from "./csv.ts";
import { Dec, parseLocaleNumber } from "./decimal.ts";
import { parseTimestamp } from "./dates.ts";
import type { Alert, Transaction, TxType } from "./types.ts";

/**
 * Reads the generic CSV format documented in docs/CSV-FORMAT.md.
 * Exchange-specific formats will map onto the same columns.
 */

export const COLUMNS = [
  "date",
  "type",
  "wallet",
  "asset_in",
  "amount_in",
  "asset_out",
  "amount_out",
  "eur_value",
  "fee_eur",
  "to_wallet",
  "note",
] as const;

type Column = (typeof COLUMNS)[number];

const REQUIRED: Column[] = ["date", "type", "wallet"];

const TYPES: Record<string, TxType> = {
  buy: "buy", kauf: "buy",
  sell: "sell", verkauf: "sell",
  swap: "swap", tausch: "swap",
  transfer: "transfer", "übertragung": "transfer", uebertragung: "transfer",
  reward: "reward", staking: "reward", belohnung: "reward",
};

/** What each type needs, besides date, type and wallet. */
const NEEDS: Record<TxType, Column[]> = {
  buy: ["asset_in", "amount_in", "eur_value"],
  sell: ["asset_out", "amount_out", "eur_value"],
  swap: ["asset_in", "amount_in", "asset_out", "amount_out", "eur_value"],
  transfer: ["asset_out", "amount_out", "to_wallet"],
  reward: ["asset_in", "amount_in", "eur_value"],
};

export interface ParseResult {
  transactions: Transaction[];
  alerts: Alert[];
}

export function parseTransactions(text: string, file: string, seqStart = 0): ParseResult {
  const table = parseCsv(text);
  const header = table.header.map((h) => h.toLowerCase());
  const alerts: Alert[] = [];
  const transactions: Transaction[] = [];

  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    alerts.push({
      code: "PARSE_MISSING_COLUMN",
      severity: "error",
      source: { file, line: 1 },
      params: { file, columns: missing.join(", ") },
    });
    return { transactions, alerts };
  }

  const idx = (c: Column) => header.indexOf(c);
  let seq = seqStart;

  for (const row of table.rows) {
    const cell = (c: Column): string => {
      const i = idx(c);
      return i >= 0 ? (row.cells[i] ?? "").trim() : "";
    };
    const source = { file, line: row.line };
    const bad = (reason: string, column?: string) =>
      alerts.push({
        code: "PARSE_BAD_ROW",
        severity: "error",
        source,
        params: { file, line: String(row.line), reason, column: column ?? "" },
      });

    const type = TYPES[cell("type").toLowerCase()];
    if (!type) { bad("unknown_type", "type"); continue; }

    const time = parseTimestamp(cell("date"));
    if (!time) { bad("bad_date", "date"); continue; }

    const wallet = cell("wallet");
    if (!wallet) { bad("missing_value", "wallet"); continue; }

    const absent = NEEDS[type].filter((c) => cell(c) === "");
    if (absent.length > 0) { bad("missing_value", absent.join(", ")); continue; }

    const num = (c: Column): Dec | undefined | null => {
      const raw = cell(c);
      if (raw === "") return undefined;
      try {
        const v = parseLocaleNumber(raw);
        return v.isNegative() ? null : v;
      } catch {
        return null;
      }
    };

    const amountIn = num("amount_in");
    const amountOut = num("amount_out");
    const eurValue = num("eur_value");
    const feeEur = num("fee_eur");
    const badNumber = (
      [["amount_in", amountIn], ["amount_out", amountOut], ["eur_value", eurValue], ["fee_eur", feeEur]] as const
    ).find(([, v]) => v === null);
    if (badNumber) { bad("bad_number", badNumber[0]); continue; }
    if ((amountIn && amountIn.isZero()) || (amountOut && amountOut.isZero())) {
      bad("zero_amount", amountIn?.isZero() ? "amount_in" : "amount_out");
      continue;
    }

    const tx: Transaction = {
      id: `${file}#${row.line}`,
      ts: time.ts,
      day: time.day,
      type,
      wallet,
      feeEur: feeEur ?? Dec.ZERO,
      source,
      seq: seq++,
    };
    if (cell("asset_in")) tx.assetIn = cell("asset_in").toUpperCase();
    if (amountIn) tx.amountIn = amountIn;
    if (cell("asset_out")) tx.assetOut = cell("asset_out").toUpperCase();
    if (amountOut) tx.amountOut = amountOut;
    if (eurValue) tx.eurValue = eurValue;
    if (cell("to_wallet")) tx.toWallet = cell("to_wallet");
    if (cell("note")) tx.note = cell("note");
    transactions.push(tx);
  }

  return { transactions, alerts };
}
