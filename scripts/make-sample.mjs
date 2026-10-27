// Generates sample/beispiel-transaktionen.csv, a synthetic history for one
// fictional investor. Prices are rough monthly EUR levels, not market data.
// Run: node scripts/make-sample.mjs
import { writeFileSync } from "node:fs";

const BTC = {
  "2024-01": 39000, "2024-02": 45000, "2024-03": 62000, "2024-04": 60000, "2024-05": 62000, "2024-06": 61000,
  "2024-07": 60000, "2024-08": 55000, "2024-09": 56000, "2024-10": 60000, "2024-11": 85000, "2024-12": 92000,
  "2025-01": 98000, "2025-02": 92000, "2025-03": 78000, "2025-04": 80000, "2025-05": 92000, "2025-06": 94000,
  "2025-07": 100000, "2025-08": 99000, "2025-09": 96000, "2025-10": 105000, "2025-11": 88000, "2025-12": 80000,
  "2026-01": 82000, "2026-02": 76000, "2026-03": 72000, "2026-04": 74000, "2026-05": 79000, "2026-06": 76000,
  "2026-07": 80000, "2026-08": 78000, "2026-09": 75000, "2026-10": 74000,
};
const ETH = {
  "2024-04": 3200, "2024-05": 2900, "2024-06": 3300, "2024-07": 3100, "2024-08": 2400, "2024-09": 2300,
  "2024-10": 2400, "2024-11": 2900, "2024-12": 3600, "2025-01": 3300, "2025-02": 2600, "2025-03": 2000,
  "2025-04": 1500, "2025-05": 2300, "2025-06": 2200, "2025-07": 2900, "2025-08": 3800, "2025-09": 3700,
  "2025-10": 3600, "2025-11": 3000, "2025-12": 2700, "2026-01": 2800, "2026-02": 2400, "2026-03": 2000,
  "2026-04": 1900, "2026-05": 2100, "2026-06": 2200, "2026-07": 2500, "2026-08": 2400, "2026-09": 2300,
  "2026-10": 2200,
};

const rows = [];
const add = (date, type, wallet, assetIn, amountIn, assetOut, amountOut, eurValue, feeEur, toWallet, note) =>
  rows.push([date, type, wallet, assetIn, amountIn, assetOut, amountOut, eurValue, feeEur, toWallet, note]);

// Bitcoin savings plan on Bitpanda: 100 EUR on the 5th of every month, 1.49 EUR fee.
const units = (eurAmount, price) => (Math.floor((eurAmount / price) * 1e8) / 1e8).toFixed(8);
let firstYearBtc = 0n;
for (const month of Object.keys(BTC)) {
  const amount = units(98.51, BTC[month]);
  if (month.startsWith("2024")) firstYearBtc += BigInt(amount.replace(".", ""));
  add(`${month}-05 09:00`, "buy", "Bitpanda", "BTC", amount, "", "", "98.51", "1.49", "", "Sparplan");
}
const sats = (n) => `${n / 100000000n}.${(n % 100000000n).toString().padStart(8, "0")}`;

// The whole 2024 savings go to a hardware wallet in January 2025.
add("2025-01-15 18:40", "transfer", "Bitpanda", "", "", "BTC", sats(firstYearBtc), "", "", "Ledger", "Cold Storage");

// One-off sale on Bitpanda when the price peaked.
add("2025-10-06 12:10", "sell", "Bitpanda", "", "", "BTC", "0.00500000", "525.00", "7.82", "", "");

// In February 2026 part of the cold storage goes to Kraken and is sold the next day.
add("2026-02-01 10:00", "transfer", "Ledger", "", "", "BTC", "0.00800000", "", "", "Kraken", "");
add("2026-02-02 11:30", "sell", "Kraken", "", "", "BTC", "0.00800000", "608.00", "1.58", "", "");

// A Bitcoin trade on Kraken, sold 18 days before its one-year mark (tax-free from 2025-10-26).
add("2024-10-25 17:05", "buy", "Kraken", "BTC", "0.05", "", "", "3000.00", "7.80", "", "");
add("2025-10-08 10:45", "sell", "Kraken", "", "", "BTC", "0.05", "5250.00", "13.65", "", "18 Tage vor Ablauf der Haltefrist");

// Ether on Kraken.
add("2024-03-05 14:12", "buy", "Kraken", "ETH", "2", "", "", "7000.00", "18.00", "", "");
add("2024-11-20 08:45", "buy", "Kraken", "ETH", "1", "", "", "2900.00", "8.00", "", "");
add("2025-02-10 16:03", "sell", "Kraken", "", "", "ETH", "1", "2600.00", "6.50", "", "");
add("2025-08-20 19:20", "swap", "Kraken", "SOL", "23.03", "ETH", "1", "3800.00", "9.50", "", "ETH zu SOL");
add("2025-11-03 09:15", "sell", "Kraken", "", "", "ETH", "1", "3000.00", "7.50", "", "");
add("2026-04-14 13:00", "sell", "Kraken", "", "", "SOL", "10", "1150.00", "2.90", "", "");

// Monthly staking rewards on Kraken: 0.004 ETH valued at the month's price.
for (const month of Object.keys(ETH)) {
  add(`${month}-01 02:00`, "reward", "Kraken", "ETH", "0.004", "", "", (0.004 * ETH[month]).toFixed(2), "", "", "Staking");
}

// A sale on Coinbase whose purchase was never exported: the app should flag it.
add("2025-06-12 20:30", "sell", "Coinbase", "", "", "ETH", "0.2", "440.00", "2.20", "", "");

rows.sort((a, b) => a[0].localeCompare(b[0]));
const header = "date,type,wallet,asset_in,amount_in,asset_out,amount_out,eur_value,fee_eur,to_wallet,note";
const csv = [header, ...rows.map((r) => r.join(","))].join("\n") + "\n";
writeFileSync(new URL("../sample/beispiel-transaktionen.csv", import.meta.url), csv);
console.log(`Wrote ${rows.length} transactions.`);
