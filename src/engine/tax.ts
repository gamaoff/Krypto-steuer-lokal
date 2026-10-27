import { Dec } from "./decimal.ts";
import { taxFreeFrom, yearOf, type Day } from "./dates.ts";
import type { RuleSet } from "./rules.ts";
import type { DisposalPart, IncomeEvent, Ledger, Lot } from "./types.ts";

export interface PrivateSaleSummary {
  /** Sum of gains (positive) from disposals held one year or less. */
  gains: Dec;
  /** Sum of losses (negative) from disposals held one year or less. */
  losses: Dec;
  /** gains + losses: the "Gesamtgewinn" the Freigrenze looks at. */
  net: Dec;
  /** Gains from disposals held more than one year. Not taxable, shown for completeness. */
  taxFreeGain: Dec;
  belowExemption: boolean;
  /** Amount to declare as taxable. Negative means a loss that can only offset § 23 gains. */
  taxable: Dec;
  disposalCount: number;
  unknownCostCount: number;
}

export interface OtherIncomeSummary {
  total: Dec;
  belowExemption: boolean;
  taxable: Dec;
  eventCount: number;
}

export interface DraftScenario {
  /** Gains from lots acquired after the draft cutoff (would be capital income). */
  capitalGains: Dec;
  allowance: Dec;
  capitalTaxable: Dec;
  capitalTax: Dec;
  /** § 23 result for the lots that keep the current rules. */
  legacy: PrivateSaleSummary;
}

export interface YearSummary {
  year: number;
  privateSales: PrivateSaleSummary;
  otherIncome: OtherIncomeSummary;
  draft: DraftScenario;
}

export function summarisePrivateSales(parts: DisposalPart[], rules: RuleSet): PrivateSaleSummary {
  let gains = Dec.ZERO;
  let losses = Dec.ZERO;
  let taxFreeGain = Dec.ZERO;
  for (const p of parts) {
    if (p.heldOverOneYear) taxFreeGain = taxFreeGain.add(p.gain);
    else if (p.gain.isNegative()) losses = losses.add(p.gain);
    else gains = gains.add(p.gain);
  }
  const net = gains.add(losses);
  const limit = rules.current.privateSale.exemptionLimitEur;
  // § 23 Abs. 3 EStG: tax-free if the total gain is less than the limit.
  const belowExemption = !net.isNegative() && net.lt(limit);
  return {
    gains,
    losses,
    net,
    taxFreeGain,
    belowExemption,
    taxable: belowExemption ? Dec.ZERO : net,
    disposalCount: parts.length,
    unknownCostCount: parts.filter((p) => p.costUnknown).length,
  };
}

export function summariseOtherIncome(events: IncomeEvent[], rules: RuleSet): OtherIncomeSummary {
  const total = Dec.sum(events.map((e) => e.eurValue));
  // § 22 Nr. 3 EStG: not taxable if less than the limit in the calendar year.
  const belowExemption = total.lt(rules.current.otherIncome.exemptionLimitEur);
  return { total, belowExemption, taxable: belowExemption ? Dec.ZERO : total, eventCount: events.length };
}

export function draftScenario(parts: DisposalPart[], rules: RuleSet): DraftScenario {
  const capital = parts.filter((p) => p.lotAfterDraftCutoff);
  const legacyParts = parts.filter((p) => !p.lotAfterDraftCutoff);
  const capitalGains = Dec.sum(capital.map((p) => p.gain));
  const allowance = rules.draft.allowanceEur;
  const capitalTaxable = Dec.max(Dec.ZERO, capitalGains.sub(allowance));
  const rate = rules.draft.rate.mul(Dec.fromInt(1).add(rules.draft.soliRate));
  return {
    capitalGains,
    allowance,
    capitalTaxable,
    capitalTax: capitalTaxable.mul(rate),
    legacy: summarisePrivateSales(legacyParts, rules),
  };
}

export function yearsIn(ledger: Ledger): number[] {
  const ys = new Set<number>();
  for (const d of ledger.disposals) ys.add(yearOf(d.disposedDay));
  for (const i of ledger.incomes) ys.add(yearOf(i.day));
  return [...ys].sort((a, b) => b - a);
}

export function summariseYear(ledger: Ledger, year: number, rules: RuleSet): YearSummary {
  const parts = ledger.disposals.filter((d) => yearOf(d.disposedDay) === year);
  const events = ledger.incomes.filter((i) => yearOf(i.day) === year);
  return {
    year,
    privateSales: summarisePrivateSales(parts, rules),
    otherIncome: summariseOtherIncome(events, rules),
    draft: draftScenario(parts, rules),
  };
}

/* ------------------------------------------------------------------ */
/* What-if: selling from a wallet today                                 */
/* ------------------------------------------------------------------ */

export interface SimulationInput {
  wallet: string;
  asset: string;
  amount: Dec;
  pricePerUnitEur: Dec;
  day: Day;
}

export interface SimulationPart {
  lot: Lot;
  amount: Dec;
  cost: Dec;
  proceeds: Dec;
  gain: Dec;
  taxFreeFrom: Day;
  heldOverOneYear: boolean;
  lotAfterDraftCutoff: boolean;
}

export interface SimulationResult {
  parts: SimulationPart[];
  /** Units requested but not held in that wallet. */
  missing: Dec;
  proceeds: Dec;
  /** Gain that is tax-free today because the lots were held more than one year. */
  taxFreeGain: Dec;
  /** Gain that counts towards § 23 this year. */
  taxableGain: Dec;
  /** Gain that would be capital income under the draft. */
  draftCapitalGain: Dec;
  /** Earliest day on which every consumed lot is past its one-year mark, if that day is later than the sale. */
  allTaxFreeFrom: Day | null;
}

/** FIFO preview of a sale. Uses a copy of the open lots, the ledger is not changed. */
export function simulateSale(openLots: Lot[], input: SimulationInput, rules: RuleSet): SimulationResult {
  const queue = openLots
    .filter((l) => l.wallet === input.wallet && l.asset === input.asset)
    .map((l) => ({ ...l }))
    .sort((a, b) => a.acquiredTs - b.acquiredTs);

  const parts: SimulationPart[] = [];
  let rest = input.amount;
  for (const lot of queue) {
    if (!rest.isPositive()) break;
    const amount = Dec.min(lot.amount, rest);
    const cost = amount.eq(lot.amount) ? lot.cost : lot.cost.mul(amount).div(lot.amount);
    const proceeds = amount.mul(input.pricePerUnitEur);
    const free = taxFreeFrom(lot.acquiredDay);
    parts.push({
      lot,
      amount,
      cost,
      proceeds,
      gain: proceeds.sub(cost),
      taxFreeFrom: free,
      heldOverOneYear: input.day >= free,
      lotAfterDraftCutoff: lot.acquiredDay > rules.draft.cutoffDay,
    });
    rest = rest.sub(amount);
  }

  const sumGain = (f: (p: SimulationPart) => boolean) => Dec.sum(parts.filter(f).map((p) => p.gain));
  const pending = parts.filter((p) => !p.heldOverOneYear && !p.lotAfterDraftCutoff).map((p) => p.taxFreeFrom);
  return {
    parts,
    missing: rest,
    proceeds: Dec.sum(parts.map((p) => p.proceeds)),
    taxFreeGain: sumGain((p) => p.heldOverOneYear && !p.lotAfterDraftCutoff),
    taxableGain: sumGain((p) => !p.heldOverOneYear && !p.lotAfterDraftCutoff),
    draftCapitalGain: sumGain((p) => p.lotAfterDraftCutoff),
    allTaxFreeFrom: pending.length > 0 ? pending.sort().at(-1) ?? null : null,
  };
}
