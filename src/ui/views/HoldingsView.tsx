import { useMemo, useState } from "react";
import { daysBetween, Dec, RULES, taxFreeFrom, type Lot } from "../../engine/index.ts";
import { HoldingBar } from "../components.tsx";
import { day, money, units } from "../format.ts";
import { useI18n } from "../i18n.ts";

interface Group {
  key: string;
  wallet: string;
  asset: string;
  lots: Lot[];
  amount: Dec;
  cost: Dec;
  freeNow: Dec;
  nextFree: string | null;
}

export function HoldingsView({ lots, today }: { lots: Lot[]; today: string }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const lot of [...lots].sort((a, b) => a.acquiredTs - b.acquiredTs)) {
      const key = `${lot.wallet} ${lot.asset}`;
      const g = map.get(key) ?? { key, wallet: lot.wallet, asset: lot.asset, lots: [], amount: Dec.ZERO, cost: Dec.ZERO, freeNow: Dec.ZERO, nextFree: null };
      const free = taxFreeFrom(lot.acquiredDay);
      g.lots.push(lot);
      g.amount = g.amount.add(lot.amount);
      g.cost = g.cost.add(lot.cost);
      if (today >= free) g.freeNow = g.freeNow.add(lot.amount);
      else if (!g.nextFree || free < g.nextFree) g.nextFree = free;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.wallet.localeCompare(b.wallet) || a.asset.localeCompare(b.asset));
  }, [lots, today]);

  if (lots.length === 0) {
    return (
      <div className="view">
        <h1>{t("hold.title")}</h1>
        <p className="lead">{t("hold.none")}</p>
      </div>
    );
  }

  const freeCount = lots.filter((l) => today >= taxFreeFrom(l.acquiredDay)).length;
  const next = groups.map((g) => g.nextFree).filter((d): d is string => d !== null).sort()[0];
  const allOld = lots.every((l) => l.acquiredDay <= RULES.draft.cutoffDay);

  return (
    <div className="view view--holdings">
      <h1>{t("hold.title")}</h1>
      <p className="lead">
        {t("hold.lead", { free: freeCount, total: lots.length })}{" "}
        {next && t("hold.next", { date: day(next, lang), n: daysBetween(today, next) })}
      </p>
      {allOld && <p className="draft draft--inline">{t("hold.allOld")}</p>}

      <div className="groups">
        {groups.map((g) => {
          const isOpen = open === g.key;
          const freeShare = g.amount.isZero() ? 0 : g.freeNow.toNumber() / g.amount.toNumber();
          return (
            <section key={g.key} className="group">
              <div className="group__head">
                <h2>
                  {g.asset} <span className="group__wallet">{g.wallet}</span>
                </h2>
                <dl className="group__figures">
                  <div><dt>{t("hold.units")}</dt><dd>{units(g.amount, lang)}</dd></div>
                  <div><dt>{t("hold.cost")}</dt><dd>{money(g.cost, lang)}</dd></div>
                  <div><dt>{t("hold.freeNow")}</dt><dd>{units(g.freeNow, lang)} <span className="muted">({Math.round(freeShare * 100)} %)</span></dd></div>
                </dl>
              </div>
              <div className="share" aria-hidden="true"><div className="share__free" style={{ width: `${(freeShare * 100).toFixed(1)}%` }} /></div>
              {g.nextFree && <p className="hint">{t("hold.freeIn", { date: day(g.nextFree, lang), n: daysBetween(today, g.nextFree) })}</p>}
              <button type="button" className="btn btn--link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.key)}>
                {isOpen ? t("hold.hide") : t("hold.show", { n: g.lots.length })}
              </button>
              {isOpen && (
                <ul className="lots">
                  {g.lots.map((lot) => {
                    const free = taxFreeFrom(lot.acquiredDay);
                    const isFree = today >= free;
                    return (
                      <li key={lot.id} className={isFree ? "lot lot--free" : "lot"}>
                        <span className="lot__date">{day(lot.acquiredDay, lang)}</span>
                        <span className="lot__origin">{t(`hold.origin.${lot.origin}` as const)}</span>
                        <span className="lot__amount num">{units(lot.amount, lang)}</span>
                        <span className="lot__cost num">{lot.costUnknown ? t("hold.costUnknown") : money(lot.cost, lang)}</span>
                        <HoldingBar acquired={lot.acquiredDay} freeFrom={free} today={today} />
                        <span className="lot__status">
                          {isFree ? t("hold.freeSince", { date: day(free, lang) }) : t("hold.freeIn", { date: day(free, lang), n: daysBetween(today, free) })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
