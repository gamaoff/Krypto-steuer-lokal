import type { ReactNode } from "react";
import { daysBetween, type Day, type Dec } from "../engine/index.ts";
import { money, moneyDigits } from "./format.ts";
import { useI18n } from "./i18n.ts";

/**
 * The amount to declare, drawn like the comb field (Kammfeld) of a paper tax form:
 * one box per character, right-aligned, empty boxes in front.
 */
export function CombField({ value, tone, label }: { value: Dec; tone: "taxable" | "free" | "loss"; label: string }) {
  const { lang } = useI18n();
  const chars = moneyDigits(value, lang).split("");
  const width = Math.max(10, chars.length + 1);
  const cells: string[] = [...Array<string>(width - chars.length).fill(""), ...chars];
  return (
    <div className={`comb comb--${tone}`} role="img" aria-label={`${label}: ${value.isNegative() ? "-" : ""}${money(value.abs(), lang)}`}>
      <span className="comb__sign" aria-hidden="true">{value.isNegative() ? "−" : ""}</span>
      <span className="comb__cells" aria-hidden="true">
        {cells.map((c, i) => (
          <span key={i} className={`comb__cell${c === "," || c === "." ? " comb__cell--sep" : ""}${c === "" ? " comb__cell--empty" : ""}`} style={{ animationDelay: `${i * 35}ms` }}>
            {c}
          </span>
        ))}
      </span>
      <span className="comb__unit" aria-hidden="true">EUR</span>
    </div>
  );
}

/** Where the year's net gain sits relative to the exemption limit. */
export function ExemptionRuler({ net, limit }: { net: Dec; limit: Dec }) {
  const { t, lang } = useI18n();
  if (net.isNegative()) return null;
  const max = Math.max(net.toNumber(), limit.toNumber()) * 1.18;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(2)}%`;
  const over = net.gte(limit);
  return (
    <div className="ruler" aria-hidden="true">
      <div className="ruler__track">
        <div className={`ruler__fill ${over ? "ruler__fill--over" : "ruler__fill--under"}`} style={{ width: pct(net.toNumber()) }} />
        <div className="ruler__limit" style={{ left: pct(limit.toNumber()) }}>
          <span>{t("year.limit", { limit: money(limit, lang) })}</span>
        </div>
      </div>
      <div className="ruler__value" style={{ left: pct(net.toNumber()) }}>{money(net, lang)}</div>
    </div>
  );
}

export function StatusChip({ kind }: { kind: "free" | "taxable" | "unknown" | "draft" }) {
  const { t } = useI18n();
  return <span className={`chip chip--${kind}`}>{t(`status.${kind}` as const)}</span>;
}

/** Progress of one lot through its one-year holding period. */
export function HoldingBar({ acquired, freeFrom, today }: { acquired: Day; freeFrom: Day; today: Day }) {
  const total = daysBetween(acquired, freeFrom);
  const done = Math.max(0, Math.min(total, daysBetween(acquired, today)));
  const free = today >= freeFrom;
  return (
    <div className={`hbar ${free ? "hbar--free" : ""}`} aria-hidden="true">
      <div className="hbar__fill" style={{ width: `${((done / total) * 100).toFixed(1)}%` }} />
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
