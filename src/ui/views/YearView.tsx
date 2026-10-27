import { Fragment, useMemo, useState } from "react";
import {
  csvCell,
  daysBetween,
  Dec,
  RULES,
  summariseYear,
  yearOf,
  type DisposalPart,
  type Ledger,
  type Transaction,
} from "../../engine/index.ts";
import { CombField, ExemptionRuler, Section, StatusChip } from "../components.tsx";
import { day, money, units } from "../format.ts";
import { useI18n } from "../i18n.ts";
import { downloadText } from "../state.ts";

interface Props {
  ledger: Ledger;
  years: number[];
  year: number;
  onYear: (y: number) => void;
  txById: Map<string, Transaction>;
  onReview: () => void;
}

type PartStatus = "free" | "taxable" | "unknown";
const statusOf = (p: DisposalPart): PartStatus => (p.costUnknown ? "unknown" : p.heldOverOneYear ? "free" : "taxable");

interface SaleRow {
  txId: string;
  parts: DisposalPart[];
  amount: Dec;
  proceeds: Dec;
  cost: Dec;
  gain: Dec;
  statuses: PartStatus[];
}

function groupSales(parts: DisposalPart[]): SaleRow[] {
  const rows = new Map<string, SaleRow>();
  for (const p of parts) {
    const r = rows.get(p.txId) ?? { txId: p.txId, parts: [], amount: Dec.ZERO, proceeds: Dec.ZERO, cost: Dec.ZERO, gain: Dec.ZERO, statuses: [] };
    r.parts.push(p);
    r.amount = r.amount.add(p.amount);
    r.proceeds = r.proceeds.add(p.proceeds);
    r.cost = r.cost.add(p.cost);
    r.gain = r.gain.add(p.gain);
    const s = statusOf(p);
    if (!r.statuses.includes(s)) r.statuses.push(s);
    rows.set(p.txId, r);
  }
  return [...rows.values()].sort((a, b) => (a.parts[0]?.disposedTs ?? 0) - (b.parts[0]?.disposedTs ?? 0));
}

export function YearView({ ledger, years, year, onYear, txById, onReview }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const summary = useMemo(() => summariseYear(ledger, year, RULES), [ledger, year]);
  const parts = useMemo(() => ledger.disposals.filter((d) => yearOf(d.disposedDay) === year), [ledger, year]);
  const sales = useMemo(() => groupSales(parts), [parts]);

  if (years.length === 0) {
    return (
      <div className="view">
        <h1>{t("nav.year")}</h1>
        <p className="lead">{t("year.none")}</p>
      </div>
    );
  }

  const ps = summary.privateSales;
  const oi = summary.otherIncome;
  const limit23 = RULES.current.privateSale.exemptionLimitEur;
  const limit22 = RULES.current.otherIncome.exemptionLimitEur;
  const p23Tone = ps.net.isNegative() ? "loss" : ps.belowExemption ? "free" : "taxable";
  const p23Explain = ps.net.isNegative()
    ? t("year.p23.explainLoss", { net: money(ps.net, lang) })
    : ps.belowExemption
      ? t("year.p23.explainBelow", { net: money(ps.net, lang), limit: money(limit23, lang), year })
      : t("year.p23.explainAbove", { net: money(ps.net, lang), limit: money(limit23, lang) });

  const sourceOf = (txId: string | null) => {
    const tx = txId ? txById.get(txId) : undefined;
    return tx ? t("review.source", { file: tx.source.file, line: tx.source.line }) : null;
  };

  const exportCsv = () => {
    const head = ["sale_date", "wallet", "asset", "amount", "acquired", "held_days", "proceeds_eur", "cost_eur", "gain_eur", "status", "sale_source", "purchase_source"];
    const lines = parts.map((p) =>
      [
        p.disposedDay, p.wallet, p.asset, p.amount.toString(), p.acquiredDay, String(daysBetween(p.acquiredDay, p.disposedDay)),
        p.proceeds.toFixed(2), p.cost.toFixed(2), p.gain.toFixed(2), statusOf(p), sourceOf(p.txId) ?? "", sourceOf(p.acquiredTxId) ?? "",
      ].map(csvCell).join(","),
    );
    downloadText(`veraeusserungen-${year}.csv`, [head.join(","), ...lines].join("\n") + "\n");
  };

  const heldText = (r: SaleRow) => {
    const ds = r.parts.map((p) => daysBetween(p.acquiredDay, p.disposedDay));
    const lo = Math.min(...ds);
    const hi = Math.max(...ds);
    return lo === hi ? t("held.days", { n: lo }) : `${lo} ${lang === "de" ? "bis" : "to"} ${t("held.days", { n: hi })}`;
  };

  return (
    <div className="view view--year">
      <div className="view__head">
        <h1>{t("year.title", { year })}</h1>
        <div className="segmented" role="group" aria-label={t("year.select")}>
          {years.map((y) => (
            <button key={y} type="button" aria-pressed={y === year} className={y === year ? "is-on" : ""} onClick={() => onYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="form-block" key={`p23-${year}`}>
        <div className="form-block__label">
          <h2>{t("year.p23.label")}</h2>
          <p className="form-block__section">{t("year.p23.section")}</p>
        </div>
        <div className="form-block__field">
          <p className="form-block__for">{t("year.toForm")}</p>
          <CombField value={ps.taxable} tone={p23Tone} label={t("year.p23.label")} />
          {p23Tone !== "loss" && <StatusChip kind={p23Tone} />}
        </div>
        <div className="form-block__explain">
          <p>{p23Explain}</p>
          <ExemptionRuler net={ps.net} limit={limit23} />
          <dl className="figures">
            <dt>{t("year.p23.gains")}</dt><dd>{money(ps.gains, lang)}</dd>
            <dt>{t("year.p23.losses")}</dt><dd>{money(ps.losses, lang)}</dd>
            <dt className="figures__total">{t("year.p23.net")}</dt><dd className="figures__total">{money(ps.net, lang)}</dd>
            <dt>{t("year.p23.free")}</dt><dd>{money(ps.taxFreeGain, lang)}</dd>
          </dl>
          <p className="hint">{t("year.p23.otherAssets")}</p>
          {ps.unknownCostCount > 0 && (
            <p className="warn">
              {t("year.unknownWarn", { n: ps.unknownCostCount })}{" "}
              <button type="button" className="btn btn--link" onClick={onReview}>{t("year.unknownLink")}</button>
            </p>
          )}
        </div>
      </div>

      <div className="form-block form-block--small" key={`p22-${year}`}>
        <div className="form-block__label">
          <h2>{t("year.p22.label")}</h2>
          <p className="form-block__section">{t("year.p22.section")}</p>
        </div>
        <div className="form-block__field">
          <p className="form-block__for">{t("year.toForm")}</p>
          <CombField value={oi.taxable} tone={oi.belowExemption ? "free" : "taxable"} label={t("year.p22.label")} />
          <StatusChip kind={oi.belowExemption ? "free" : "taxable"} />
        </div>
        <div className="form-block__explain">
          <p>
            {oi.belowExemption
              ? t("year.p22.explainBelow", { total: money(oi.total, lang), limit: money(limit22, lang) })
              : t("year.p22.explainAbove", { total: money(oi.total, lang), limit: money(limit22, lang) })}
          </p>
        </div>
      </div>

      <aside className="draft">
        <h2 className="h3">{t("year.draft.title")}</h2>
        <p>
          {summary.draft.capitalGains.isZero()
            ? t("year.draft.none", { year })
            : t("year.draft.some", {
                gains: money(summary.draft.capitalGains, lang),
                allowance: money(summary.draft.allowance, lang),
                tax: money(summary.draft.capitalTax, lang),
              })}
        </p>
      </aside>

      <Section
        title={t("year.table.title", { year })}
        aside={parts.length > 0 ? <button type="button" className="btn btn--quiet" onClick={exportCsv}>{t("year.export")}</button> : undefined}
      >
        {sales.length === 0 ? (
          <p className="hint">{t("year.table.empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("col.date")}</th>
                  <th>{t("col.wallet")}</th>
                  <th className="num">{t("col.amount")}</th>
                  <th>{t("col.held")}</th>
                  <th className="num">{t("col.proceeds")}</th>
                  <th className="num">{t("col.cost")}</th>
                  <th className="num">{t("col.gain")}</th>
                  <th>{t("col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((r) => {
                  const first = r.parts[0] as DisposalPart;
                  const isOpen = open === r.txId;
                  return (
                    <Fragment key={r.txId}>
                      <tr className={isOpen ? "is-open" : ""}>
                        <td>
                          <button type="button" className="rowtoggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.txId)}>
                            {day(first.disposedDay, lang)}
                          </button>
                        </td>
                        <td>{first.wallet}</td>
                        <td className="num">{units(r.amount, lang)} {first.asset}</td>
                        <td>{heldText(r)}</td>
                        <td className="num">{money(r.proceeds, lang)}</td>
                        <td className="num">{money(r.cost, lang)}</td>
                        <td className={`num ${r.gain.isNegative() ? "neg" : ""}`}>{money(r.gain, lang)}</td>
                        <td className="chips">{r.statuses.map((s) => <StatusChip key={s} kind={s} />)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="detail">
                          <td colSpan={8}>
                            <p className="detail__title">{t("year.origin")}</p>
                            <p>{t("year.origin.sale", { source: sourceOf(r.txId) ?? "" })}</p>
                            <ol className="detail__parts">
                              {r.parts.map((p) => (
                                <li key={p.id}>
                                  <span>{units(p.amount, lang)} {p.asset}, {t("col.bought").toLowerCase()} {day(p.acquiredDay, lang)}</span>
                                  <span className="num">{money(p.gain, lang)}</span>
                                  <StatusChip kind={statusOf(p)} />
                                  <span className="detail__src">
                                    {p.acquiredTxId ? t("year.origin.buy", { source: sourceOf(p.acquiredTxId) ?? "" }) : t("year.origin.buyUnknown")}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
