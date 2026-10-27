import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Dec, parseTransactions } from "../src/engine/index.ts";
import { eur, ledgerFrom } from "./helpers.ts";

describe("FIFO per wallet", () => {
  it("consumes the oldest lot first and splits the next one", () => {
    // 1 BTC at 10,000 and 1 BTC at 20,000, then 1.5 BTC sold for 45,000.
    // Lot 1: cost 10,000, proceeds 30,000, gain 20,000.
    // Lot 2 (half): cost 10,000, proceeds 15,000, gain 5,000.
    const l = ledgerFrom(
      "2024-01-10,buy,Kraken,BTC,1,,,10000,,,",
      "2024-06-10,buy,Kraken,BTC,1,,,20000,,,",
      "2024-12-01,sell,Kraken,,,BTC,1.5,45000,,,",
    );
    assert.equal(l.disposals.length, 2);
    const [a, b] = l.disposals;
    assert.deepEqual([a?.amount.toString(), eur(a!.cost), eur(a!.proceeds), eur(a!.gain)], ["1", "10000.00", "30000.00", "20000.00"]);
    assert.deepEqual([b?.amount.toString(), eur(b!.cost), eur(b!.proceeds), eur(b!.gain)], ["0.5", "10000.00", "15000.00", "5000.00"]);
    assert.equal(l.openLots.length, 1);
    assert.equal(l.openLots[0]?.amount.toString(), "0.5");
    assert.equal(eur(l.openLots[0]!.cost), "10000.00");
  });

  it("keeps wallets separate instead of using one global queue", () => {
    // Global FIFO would take the 10,000 lot from A (gain 15,000).
    // Wallet FIFO takes the 20,000 lot from B (gain 5,000).
    const l = ledgerFrom(
      "2024-01-01,buy,A,BTC,1,,,10000,,,",
      "2024-06-01,buy,B,BTC,1,,,20000,,,",
      "2024-07-01,sell,B,,,BTC,1,25000,,,",
    );
    assert.equal(eur(l.disposals[0]!.gain), "5000.00");
  });
});

describe("one-year holding period", () => {
  it("is taxable on the anniversary and tax-free the day after", () => {
    const onAnniversary = ledgerFrom("2024-03-14,buy,K,ETH,1,,,2000,,,", "2025-03-14,sell,K,,,ETH,1,3000,,,");
    const dayAfter = ledgerFrom("2024-03-14,buy,K,ETH,1,,,2000,,,", "2025-03-15,sell,K,,,ETH,1,3000,,,");
    assert.equal(onAnniversary.disposals[0]?.heldOverOneYear, false);
    assert.equal(dayAfter.disposals[0]?.heldOverOneYear, true);
    assert.equal(dayAfter.disposals[0]?.taxFreeFrom, "2025-03-15");
  });
});

describe("transfers between own wallets", () => {
  it("are not a sale and keep acquisition date and cost", () => {
    const l = ledgerFrom(
      "2024-01-10,buy,Bitpanda,BTC,1,,,10000,,,",
      "2024-05-01,transfer,Bitpanda,,,BTC,1,,,Ledger,",
      "2025-02-01,sell,Ledger,,,BTC,1,30000,,,",
    );
    assert.equal(l.disposals.length, 1);
    const d = l.disposals[0]!;
    assert.equal(d.acquiredDay, "2024-01-10");
    assert.equal(d.acquiredTxId, "test.csv#2");
    assert.equal(eur(d.gain), "20000.00");
    assert.equal(d.heldOverOneYear, true);
  });

  it("join the FIFO queue of the target wallet by acquisition date", () => {
    // Ledger already holds a newer lot. The older lot arriving later must still be sold first.
    const l = ledgerFrom(
      "2024-01-10,buy,Bitpanda,BTC,1,,,10000,,,",
      "2024-03-01,buy,Ledger,BTC,1,,,30000,,,",
      "2024-04-01,transfer,Bitpanda,,,BTC,1,,,Ledger,",
      "2024-05-01,sell,Ledger,,,BTC,1,35000,,,",
    );
    assert.equal(l.disposals[0]?.acquiredDay, "2024-01-10");
    assert.equal(eur(l.disposals[0]!.gain), "25000.00");
  });

  it("flag units that were never bought in the source wallet", () => {
    const l = ledgerFrom("2024-04-01,transfer,Coinbase,,,ETH,2,,,Ledger,");
    assert.equal(l.alerts[0]?.code, "MISSING_LOTS_TRANSFER");
    assert.equal(l.openLots[0]?.costUnknown, true);
    assert.equal(l.openLots[0]?.wallet, "Ledger");
  });
});

describe("swaps, fees and rewards", () => {
  it("treats a swap as a sale of one asset and a purchase of the other", () => {
    // 2 ETH bought for 4,000. 1 ETH swapped for 0.05 BTC worth 3,000.
    const l = ledgerFrom(
      "2024-02-01,buy,K,ETH,2,,,4000,,,",
      "2024-04-01,swap,K,BTC,0.05,ETH,1,3000,,,",
    );
    const d = l.disposals[0]!;
    assert.deepEqual([d.kind, eur(d.cost), eur(d.proceeds), eur(d.gain)], ["swap", "2000.00", "3000.00", "1000.00"]);
    const btc = l.openLots.find((x) => x.asset === "BTC")!;
    assert.deepEqual([btc.amount.toString(), eur(btc.cost), btc.acquiredDay], ["0.05", "3000.00", "2024-04-01"]);
  });

  it("adds fees to the cost and deducts them from the proceeds", () => {
    // Cost 10,000 + 50 = 10,050. Proceeds 12,000 - 60 = 11,940. Gain 1,890.
    const l = ledgerFrom("2024-01-01,buy,K,BTC,1,,,10000,50,,", "2024-02-01,sell,K,,,BTC,1,12000,60,,");
    assert.equal(eur(l.disposals[0]!.gain), "1890.00");
  });

  it("records staking rewards as income with their market value as cost", () => {
    const l = ledgerFrom("2025-05-01,reward,K,ETH,0.1,,,300,,,");
    assert.equal(eur(l.incomes[0]!.eurValue), "300.00");
    assert.equal(eur(l.openLots[0]!.cost), "300.00");
  });
});

describe("missing purchase data", () => {
  it("warns and assumes cost zero and a same-day purchase, the worst case", () => {
    const l = ledgerFrom("2024-01-01,buy,K,ETH,1,,,2000,,,", "2024-06-01,sell,K,,,ETH,1.5,4500,,,");
    assert.equal(l.alerts[0]?.code, "MISSING_LOTS_DISPOSAL");
    assert.equal(l.alerts[0]?.params.missing, "0.5");
    const unknown = l.disposals.find((d) => d.costUnknown)!;
    assert.deepEqual([unknown.amount.toString(), eur(unknown.cost), eur(unknown.proceeds), unknown.heldOverOneYear], ["0.5", "0.00", "1500.00", false]);
  });
});

describe("splitting keeps totals exact", () => {
  it("allocates proceeds across thirds without losing a cent", () => {
    const l = ledgerFrom(
      "2024-01-01,buy,K,BTC,1,,,1000,,,",
      "2024-01-02,buy,K,BTC,1,,,1000,,,",
      "2024-01-03,buy,K,BTC,1,,,1000,,,",
      "2024-02-01,sell,K,,,BTC,3,10000,,,",
    );
    const total = Dec.sum(l.disposals.map((d) => d.proceeds));
    assert.equal(total.toString(), "10000");
  });
});

describe("parser", () => {
  it("reports rows it cannot read, with their line numbers", () => {
    const csv = [
      "date,type,wallet,asset_in,amount_in,asset_out,amount_out,eur_value,fee_eur,to_wallet,note",
      "2024-01-01,buy,K,BTC,1,,,1000,,,",
      "2024-13-01,buy,K,BTC,1,,,1000,,,",
      "2024-01-02,gift,K,BTC,1,,,1000,,,",
      "2024-01-03,buy,K,BTC,,,,1000,,,",
      "2024-01-04,sell,K,,,BTC,abc,1000,,,",
    ].join("\n");
    const { transactions, alerts } = parseTransactions(csv, "f.csv");
    assert.equal(transactions.length, 1);
    assert.deepEqual(alerts.map((a) => [a.params.line, a.params.reason]), [
      ["3", "bad_date"],
      ["4", "unknown_type"],
      ["5", "missing_value"],
      ["6", "bad_number"],
    ]);
  });

  it("accepts German exports with semicolons and decimal commas", () => {
    const csv = "date;type;wallet;asset_in;amount_in;eur_value\n14.03.2025 10:22;Kauf;Bitpanda;btc;0,0015;100,00\n";
    const { transactions, alerts } = parseTransactions(csv, "de.csv");
    assert.equal(alerts.length, 0);
    assert.deepEqual([transactions[0]?.type, transactions[0]?.assetIn, transactions[0]?.amountIn?.toString()], ["buy", "BTC", "0.0015"]);
  });
});
