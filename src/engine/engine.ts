import { Dec } from "./decimal.ts";
import { taxFreeFrom, type Day } from "./dates.ts";
import type { RuleSet } from "./rules.ts";
import type { Alert, DisposalPart, IncomeEvent, Ledger, Lot, Transaction } from "./types.ts";

/**
 * Turns transactions into lots, disposals and income events.
 *
 * Lot order follows the BMF position: first in, first out, separately for
 * each wallet. Moving units between own wallets is not a disposal; the units
 * keep their acquisition date and cost basis.
 */

interface Taken {
  lot: Lot;
  amount: Dec;
  cost: Dec;
}

const keyOf = (wallet: string, asset: string) => `${wallet}\u0000${asset}`;

/** Splits `total` across `weights` in proportion, with the last share taking the remainder so the parts add up exactly. */
export function allocate(total: Dec, weights: Dec[]): Dec[] {
  const out: Dec[] = [];
  let restTotal = total;
  let restWeight = Dec.sum(weights);
  weights.forEach((w, i) => {
    if (i === weights.length - 1 || restWeight.isZero()) {
      out.push(restTotal);
      restTotal = Dec.ZERO;
    } else {
      const share = restTotal.mul(w).div(restWeight);
      out.push(share);
      restTotal = restTotal.sub(share);
    }
    restWeight = restWeight.sub(w);
  });
  return out;
}

export class LotBook {
  private readonly queues = new Map<string, Lot[]>();

  constructor(lots: Lot[] = []) {
    for (const lot of lots) this.insert({ ...lot });
  }

  insert(lot: Lot): void {
    const k = keyOf(lot.wallet, lot.asset);
    const q = this.queues.get(k) ?? [];
    q.push(lot);
    // FIFO by acquisition time, also for units that arrive from another wallet.
    q.sort((a, b) => a.acquiredTs - b.acquiredTs);
    this.queues.set(k, q);
  }

  /** Removes `amount` units FIFO. Returns what was taken and the part that was not covered by any lot. */
  take(wallet: string, asset: string, amount: Dec): { taken: Taken[]; missing: Dec } {
    const q = this.queues.get(keyOf(wallet, asset)) ?? [];
    const taken: Taken[] = [];
    let rest = amount;
    while (rest.isPositive() && q.length > 0) {
      const lot = q[0] as Lot;
      if (lot.amount.lte(rest)) {
        taken.push({ lot: { ...lot }, amount: lot.amount, cost: lot.cost });
        rest = rest.sub(lot.amount);
        q.shift();
      } else {
        const cost = lot.cost.mul(rest).div(lot.amount);
        taken.push({ lot: { ...lot }, amount: rest, cost });
        lot.amount = lot.amount.sub(rest);
        lot.cost = lot.cost.sub(cost);
        rest = Dec.ZERO;
      }
    }
    return { taken, missing: rest };
  }

  openLots(): Lot[] {
    return [...this.queues.values()].flat().filter((l) => l.amount.isPositive());
  }
}

export function buildLedger(input: Transaction[], rules: RuleSet): Ledger {
  const transactions = [...input].sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  const book = new LotBook();
  const disposals: DisposalPart[] = [];
  const incomes: IncomeEvent[] = [];
  const alerts: Alert[] = [];
  const cutoff = rules.draft.cutoffDay;

  const acquire = (tx: Transaction, asset: string, amount: Dec, cost: Dec, origin: Lot["origin"]) => {
    book.insert({
      id: `${tx.id}:${asset}`,
      asset,
      wallet: tx.wallet,
      acquiredDay: tx.day,
      acquiredTs: tx.ts,
      acquiredTxId: tx.id,
      origin,
      amount,
      cost,
      costUnknown: false,
    });
  };

  const dispose = (tx: Transaction, kind: "sell" | "swap", asset: string, amount: Dec, proceeds: Dec) => {
    const { taken, missing } = book.take(tx.wallet, asset, amount);
    const slices: Array<{ amount: Dec; cost: Dec; lot: Lot | null }> = taken.map((t) => ({ amount: t.amount, cost: t.cost, lot: t.lot }));
    if (missing.isPositive()) {
      slices.push({ amount: missing, cost: Dec.ZERO, lot: null });
      alerts.push({
        code: "MISSING_LOTS_DISPOSAL",
        severity: "warning",
        txId: tx.id,
        source: tx.source,
        params: { asset, wallet: tx.wallet, missing: missing.toString(), day: tx.day },
      });
    }
    const shares = allocate(proceeds, slices.map((s) => s.amount));
    slices.forEach((s, i) => {
      // Without a known purchase, the conservative assumption is a purchase on the same day: taxable, cost zero.
      const acquiredDay: Day = s.lot ? s.lot.acquiredDay : tx.day;
      const free = taxFreeFrom(acquiredDay);
      const p = shares[i] ?? Dec.ZERO;
      disposals.push({
        id: `${tx.id}/${i}`,
        txId: tx.id,
        kind,
        asset,
        wallet: tx.wallet,
        amount: s.amount,
        acquiredDay,
        acquiredTxId: s.lot ? s.lot.acquiredTxId : null,
        disposedDay: tx.day,
        disposedTs: tx.ts,
        cost: s.cost,
        proceeds: p,
        gain: p.sub(s.cost),
        taxFreeFrom: free,
        heldOverOneYear: tx.day >= free,
        costUnknown: s.lot ? s.lot.costUnknown : true,
        lotAfterDraftCutoff: acquiredDay > cutoff,
      });
    });
  };

  for (const tx of transactions) {
    const eur = tx.eurValue ?? Dec.ZERO;
    switch (tx.type) {
      case "buy":
        acquire(tx, tx.assetIn as string, tx.amountIn as Dec, eur.add(tx.feeEur), "buy");
        break;
      case "reward":
        acquire(tx, tx.assetIn as string, tx.amountIn as Dec, eur, "reward");
        incomes.push({
          id: `${tx.id}:income`,
          txId: tx.id,
          day: tx.day,
          wallet: tx.wallet,
          asset: tx.assetIn as string,
          amount: tx.amountIn as Dec,
          eurValue: eur,
        });
        break;
      case "sell":
      case "swap": {
        let proceeds = eur.sub(tx.feeEur);
        if (proceeds.isNegative()) {
          alerts.push({ code: "FEE_EXCEEDS_PROCEEDS", severity: "warning", txId: tx.id, source: tx.source, params: { day: tx.day } });
          proceeds = Dec.ZERO;
        }
        dispose(tx, tx.type, tx.assetOut as string, tx.amountOut as Dec, proceeds);
        if (tx.type === "swap") acquire(tx, tx.assetIn as string, tx.amountIn as Dec, eur, "swap");
        break;
      }
      case "transfer": {
        const asset = tx.assetOut as string;
        const to = tx.toWallet as string;
        const { taken, missing } = book.take(tx.wallet, asset, tx.amountOut as Dec);
        taken.forEach((t, i) =>
          book.insert({ ...t.lot, id: `${t.lot.id}>${tx.id}/${i}`, wallet: to, amount: t.amount, cost: t.cost }),
        );
        if (missing.isPositive()) {
          alerts.push({
            code: "MISSING_LOTS_TRANSFER",
            severity: "warning",
            txId: tx.id,
            source: tx.source,
            params: { asset, wallet: tx.wallet, to, missing: missing.toString(), day: tx.day },
          });
          book.insert({
            id: `${tx.id}:unknown`,
            asset,
            wallet: to,
            acquiredDay: tx.day,
            acquiredTs: tx.ts,
            acquiredTxId: null,
            origin: "unknown",
            amount: missing,
            cost: Dec.ZERO,
            costUnknown: true,
          });
        }
        break;
      }
    }
  }

  return { transactions, openLots: book.openLots(), disposals, incomes, alerts };
}
