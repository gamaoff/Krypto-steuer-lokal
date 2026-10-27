import { useMemo, useState } from "react";
import { daysBetween, Dec, parseTimestamp, RULES, simulateSale, type Lot } from "../../engine/index.ts";
import { StatusChip } from "../components.tsx";
import { day, money, parseUserNumber, units } from "../format.ts";
import { useI18n, type Lang } from "../i18n.ts";

function positive(s: string, lang: Lang): Dec | null {
  const d = parseUserNumber(s, lang);
  return d && d.isPositive() ? d : null;
}

export function SimulatorView({ lots, today }: { lots: Lot[]; today: string }) {
  const { t, lang } = useI18n();
  const wallets = useMemo(() => [...new Set(lots.map((l) => l.wallet))].sort(), [lots]);
  const [walletChoice, setWallet] = useState(wallets[0] ?? "");
  const wallet = wallets.includes(walletChoice) ? walletChoice : (wallets[0] ?? "");
  const assets = useMemo(() => [...new Set(lots.filter((l) => l.wallet === wallet).map((l) => l.asset))].sort(), [lots, wallet]);
  const [assetChoice, setAsset] = useState(assets[0] ?? "");
  const asset = assets.includes(assetChoice) ? assetChoice : (assets[0] ?? "");
  const held = useMemo(() => Dec.sum(lots.filter((l) => l.wallet === wallet && l.asset === asset).map((l) => l.amount)), [lots, wallet, asset]);
  const [amountText, setAmountText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [saleDay, setSaleDay] = useState(today);

  const amount = positive(amountText, lang);
  const price = positive(priceText, lang);
  const dayOk = parseTimestamp(saleDay) !== null;
  const result = useMemo(
    () => (amount && price && dayOk ? simulateSale(lots, { wallet, asset, amount, pricePerUnitEur: price, day: saleDay }, RULES) : null),
    [lots, wallet, asset, amount?.raw, price?.raw, saleDay, dayOk],
  );

  if (lots.length === 0) {
    return (
      <div className="view">
        <h1>{t("sim.title")}</h1>
        <p className="lead">{t("sim.empty")}</p>
      </div>
    );
  }

  const pickWallet = (w: string) => {
    setWallet(w);
    const first = [...new Set(lots.filter((l) => l.wallet === w).map((l) => l.asset))].sort()[0] ?? "";
    setAsset(first);
    setAmountText("");
  };

  return (
    <div className="view view--sim">
      <h1>{t("sim.title")}</h1>
      <p className="lead">{t("sim.lead")}</p>

      <form className="simform" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span>{t("sim.wallet")}</span>
          <select value={wallet} onChange={(e) => pickWallet(e.target.value)}>
            {wallets.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label>
          <span>{t("sim.asset")}</span>
          <select value={asset} onChange={(e) => { setAsset(e.target.value); setAmountText(""); }}>
            {assets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          <span>{t("sim.amount")}</span>
          <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0" />
          <button type="button" className="btn btn--link" onClick={() => setAmountText(units(held, lang))}>
            {t("sim.max", { held: units(held, lang) })}
          </button>
        </label>
        <label>
          <span>{t("sim.price")}</span>
          <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder={lang === "de" ? "74.000" : "74,000"} />
        </label>
        <label>
          <span>{t("sim.day")}</span>
          <input type="date" value={saleDay} onChange={(e) => setSaleDay(e.target.value)} />
        </label>
      </form>

      {!result ? (
        <p className="hint">{t("sim.invalid")}</p>
      ) : (
        <div className="simresult" aria-live="polite">
          <dl className="simtotals">
            <div><dt>{t("sim.proceeds")}</dt><dd>{money(result.proceeds, lang)}</dd></div>
            <div className="simtotals--free"><dt>{t("sim.free")}</dt><dd>{money(result.taxFreeGain, lang)}</dd></div>
            <div className="simtotals--taxable"><dt>{t("sim.taxable")}</dt><dd>{money(result.taxableGain, lang)}</dd></div>
            {!result.draftCapitalGain.isZero() && (
              <div className="simtotals--draft"><dt>{t("sim.draft")}</dt><dd>{money(result.draftCapitalGain, lang)}</dd></div>
            )}
          </dl>

          {result.missing.isPositive() && <p className="warn">{t("sim.missing", { wallet, held: units(held, lang), asset })}</p>}
          {result.allTaxFreeFrom ? (
            <p className="callout">{t("sim.wait", { date: day(result.allTaxFreeFrom, lang), n: daysBetween(saleDay, result.allTaxFreeFrom) })}</p>
          ) : result.parts.length > 0 && result.draftCapitalGain.isZero() ? (
            <p className="callout callout--free">{t("sim.allFree")}</p>
          ) : null}

          <h2 className="h3">{t("sim.lotsTitle")}</h2>
          <ol className="simlots">
            {result.parts.map((p) => (
              <li key={p.lot.id}>
                <span>{t("sim.lotLine", { amount: units(p.amount, lang), asset, date: day(p.lot.acquiredDay, lang) })}</span>
                <span className={`num ${p.gain.isNegative() ? "neg" : ""}`}>{money(p.gain, lang)}</span>
                <StatusChip kind={p.lotAfterDraftCutoff ? "draft" : p.lot.costUnknown ? "unknown" : p.heldOverOneYear ? "free" : "taxable"} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
