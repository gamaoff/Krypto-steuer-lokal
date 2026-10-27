import { useEffect, useMemo, useState } from "react";
import { yearsIn, yearOf } from "../engine/index.ts";
import { LangContext, translator, type Lang } from "./i18n.ts";
import { useAppData, useNetworkMonitor, useToday, type LoadedFile } from "./state.ts";
import { HoldingsView } from "./views/HoldingsView.tsx";
import { ImportView } from "./views/ImportView.tsx";
import { PrivacyView } from "./views/PrivacyView.tsx";
import { ReviewView } from "./views/ReviewView.tsx";
import { SimulatorView } from "./views/SimulatorView.tsx";
import { YearView } from "./views/YearView.tsx";

const TABS = ["import", "review", "year", "holdings", "simulate", "privacy"] as const;
type Tab = (typeof TABS)[number];

const tabFromHash = (): Tab => {
  const h = location.hash.replace("#", "");
  return (TABS as readonly string[]).includes(h) ? (h as Tab) : "import";
};

export function App() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.toLowerCase().startsWith("de") ? "de" : "en"));
  const i18n = useMemo(() => ({ lang, t: translator(lang) }), [lang]);
  const { t } = i18n;

  const [files, setFiles] = useState<LoadedFile[]>([]);
  const data = useAppData(files);
  const today = useToday();
  const net = useNetworkMonitor();

  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const setTab = (next: Tab) => {
    setTabState(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("app.title");
  }, [lang, t]);

  const years = useMemo(() => yearsIn(data.ledger), [data.ledger]);
  // Default to the year a return is usually being prepared for: the previous calendar year.
  const defaultYear = years.includes(yearOf(today) - 1) ? yearOf(today) - 1 : (years[0] ?? yearOf(today));
  const [yearChoice, setYear] = useState<number | null>(null);
  const year = yearChoice !== null && years.includes(yearChoice) ? yearChoice : defaultYear;

  const addFiles = (incoming: LoadedFile[]) =>
    setFiles((prev) => [...prev.filter((p) => !incoming.some((n) => n.name === p.name)), ...incoming]);

  const issueCount = data.alerts.length;
  const hasData = files.length > 0;

  return (
    <LangContext.Provider value={i18n}>
      <header className="top">
        <div className="top__brand">
          <span className="top__title">{t("app.title")}</span>
          <span className="top__tag">{t("app.prototype")}</span>
        </div>
        <div className="top__tools">
          <button type="button" className={`netbadge${net.requests > 0 ? " netbadge--some" : ""}`} onClick={() => setTab("privacy")}>
            <span className="netbadge__dot" aria-hidden="true" />
            {net.requests === 0 ? t("net.none") : t("net.some", { n: net.requests })}
          </button>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setLang(lang === "de" ? "en" : "de")}>
            {t("app.lang")}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Navigation">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={`tabs__item${tab === id ? " is-active" : ""}`}
            aria-current={tab === id ? "page" : undefined}
            disabled={!hasData && id !== "import" && id !== "privacy"}
            onClick={() => setTab(id)}
          >
            {t(`nav.${id}` as const)}
            {id === "review" && issueCount > 0 && <span className="tabs__count">{issueCount}</span>}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === "import" && (
          <ImportView
            files={data.fileStats}
            onAdd={addFiles}
            onRemove={(name) => setFiles((prev) => prev.filter((f) => f.name !== name))}
            onClear={() => setFiles([])}
            onDone={() => setTab(issueCount > 0 ? "review" : "year")}
          />
        )}
        {tab === "review" && <ReviewView alerts={data.alerts} />}
        {tab === "year" && (
          <YearView ledger={data.ledger} years={years} year={year} onYear={setYear} txById={data.txById} onReview={() => setTab("review")} />
        )}
        {tab === "holdings" && <HoldingsView lots={data.ledger.openLots} today={today} />}
        {tab === "simulate" && <SimulatorView lots={data.ledger.openLots} today={today} />}
        {tab === "privacy" && <PrivacyView requests={net.requests} blocked={net.blocked} />}
      </main>

      <footer className="foot">
        <p>{t("footer")}</p>
      </footer>
    </LangContext.Provider>
  );
}
