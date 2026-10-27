import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Dec, RULES, simulateSale, summariseYear } from "../src/engine/index.ts";
import { eur, ledgerFrom } from "./helpers.ts";

describe("§ 23 Freigrenze (1,000 EUR)", () => {
  it("leaves a net gain of 999.99 tax-free", () => {
    const l = ledgerFrom("2025-01-01,buy,K,BTC,1,,,1000,,,", "2025-02-01,sell,K,,,BTC,1,1999.99,,,");
    const s = summariseYear(l, 2025, RULES).privateSales;
    assert.equal(s.belowExemption, true);
    assert.equal(eur(s.taxable), "0.00");
  });

  it("taxes the whole gain once it reaches 1,000.00", () => {
    const l = ledgerFrom("2025-01-01,buy,K,BTC,1,,,1000,,,", "2025-02-01,sell,K,,,BTC,1,2000,,,");
    const s = summariseYear(l, 2025, RULES).privateSales;
    assert.equal(s.belowExemption, false);
    assert.equal(eur(s.taxable), "1000.00");
  });

  it("nets losses before applying the limit", () => {
    // +1,500 and -700 = 800, below the limit.
    const l = ledgerFrom(
      "2025-01-01,buy,K,BTC,1,,,1000,,,",
      "2025-01-01,buy,K,ETH,1,,,2000,,,",
      "2025-03-01,sell,K,,,BTC,1,2500,,,",
      "2025-03-01,sell,K,,,ETH,1,1300,,,",
    );
    const s = summariseYear(l, 2025, RULES).privateSales;
    assert.deepEqual([eur(s.gains), eur(s.losses), eur(s.net), eur(s.taxable)], ["1500.00", "-700.00", "800.00", "0.00"]);
  });

  it("keeps sales after one year out of the taxable total", () => {
    const l = ledgerFrom("2023-01-01,buy,K,BTC,1,,,10000,,,", "2025-02-01,sell,K,,,BTC,1,90000,,,");
    const s = summariseYear(l, 2025, RULES).privateSales;
    assert.deepEqual([eur(s.taxFreeGain), eur(s.taxable)], ["80000.00", "0.00"]);
  });

  it("reports a net loss as a negative taxable amount", () => {
    const l = ledgerFrom("2025-01-01,buy,K,BTC,1,,,5000,,,", "2025-02-01,sell,K,,,BTC,1,3000,,,");
    assert.equal(eur(summariseYear(l, 2025, RULES).privateSales.taxable), "-2000.00");
  });
});

describe("§ 22 Nr. 3 Freigrenze (256 EUR)", () => {
  it("leaves 255.99 tax-free and taxes 256.00 in full", () => {
    const below = ledgerFrom("2025-05-01,reward,K,ETH,0.1,,,255.99,,,");
    const at = ledgerFrom("2025-05-01,reward,K,ETH,0.1,,,200,,,", "2025-06-01,reward,K,ETH,0.02,,,56,,,");
    assert.equal(eur(summariseYear(below, 2025, RULES).otherIncome.taxable), "0.00");
    assert.equal(eur(summariseYear(at, 2025, RULES).otherIncome.taxable), "256.00");
  });
});

describe("draft scenario (lots acquired after 31.12.2026)", () => {
  it("taxes new lots as capital income above the 1,000 allowance", () => {
    // Gain 2,000 - allowance 1,000 = 1,000 taxable. 1,000 x 25% x 1.055 = 263.75.
    const l = ledgerFrom("2027-01-05,buy,K,BTC,1,,,10000,,,", "2027-03-01,sell,K,,,BTC,1,12000,,,");
    const d = summariseYear(l, 2027, RULES).draft;
    assert.deepEqual([eur(d.capitalGains), eur(d.capitalTaxable), eur(d.capitalTax)], ["2000.00", "1000.00", "263.75"]);
  });

  it("keeps the one-year rule for lots bought up to 31.12.2026", () => {
    const l = ledgerFrom("2026-12-20,buy,K,BTC,1,,,10000,,,", "2028-01-10,sell,K,,,BTC,1,15000,,,");
    const d = summariseYear(l, 2028, RULES).draft;
    assert.equal(eur(d.capitalGains), "0.00");
    assert.equal(eur(d.legacy.taxFreeGain), "5000.00");
  });
});

describe("sale simulator", () => {
  it("shows which part of a sale is tax-free today and when the rest will be", () => {
    // Lot 1 (2024-01-10, 0.5 BTC, 10,000) is past one year on 2025-06-01.
    // Lot 2 (2025-03-01, 0.5 BTC, 20,000) is not, it becomes tax-free on 2026-03-02.
    const l = ledgerFrom("2024-01-10,buy,K,BTC,0.5,,,10000,,,", "2025-03-01,buy,K,BTC,0.5,,,20000,,,");
    const r = simulateSale(
      l.openLots,
      { wallet: "K", asset: "BTC", amount: Dec.parse("0.8"), pricePerUnitEur: Dec.parse("50000"), day: "2025-06-01" },
      RULES,
    );
    // Lot 1: proceeds 25,000, gain 15,000, tax-free. Lot 2 (0.3): cost 12,000, proceeds 15,000, gain 3,000, taxable.
    assert.deepEqual([eur(r.taxFreeGain), eur(r.taxableGain), r.allTaxFreeFrom], ["15000.00", "3000.00", "2026-03-02"]);
    assert.equal(r.missing.toString(), "0");
    assert.equal(l.openLots.find((x) => x.acquiredDay === "2025-03-01")?.amount.toString(), "0.5", "simulation must not change the ledger");
  });

  it("reports units the wallet does not hold", () => {
    const l = ledgerFrom("2024-01-10,buy,K,BTC,0.5,,,10000,,,");
    const r = simulateSale(
      l.openLots,
      { wallet: "K", asset: "BTC", amount: Dec.parse("2"), pricePerUnitEur: Dec.parse("1"), day: "2025-06-01" },
      RULES,
    );
    assert.equal(r.missing.toString(), "1.5");
  });
});
