import { Dec } from "./decimal.ts";
import type { Day } from "./dates.ts";

/**
 * Tax rules as versioned data, not code.
 * When a rule changes, add a new version with its validity instead of editing
 * the old one, so past years keep being computed with the rules of their time.
 */

export interface Source {
  title: string;
  url: string;
}

export interface CurrentRules {
  id: string;
  status: "in-force";
  validFrom: Day;
  privateSale: {
    section: string;
    holdingYears: 1;
    /** Freigrenze: the whole net gain is taxed once it reaches this amount. */
    exemptionLimitEur: Dec;
  };
  otherIncome: {
    section: string;
    /** Freigrenze for all § 22 Nr. 3 income of the year combined. */
    exemptionLimitEur: Dec;
  };
  lotOrder: "fifo-per-wallet";
  sources: Source[];
}

export interface DraftRules {
  id: string;
  status: "draft";
  draftDate: Day;
  section: string;
  /** Lots acquired after this day would fall under the draft rules. */
  cutoffDay: Day;
  rate: Dec;
  soliRate: Dec;
  /** Sparer-Pauschbetrag for a single filer. Shared with all other capital income. */
  allowanceEur: Dec;
  sources: Source[];
}

export interface RuleSet {
  current: CurrentRules;
  draft: DraftRules;
}

export const RULES: RuleSet = {
  current: {
    id: "DE-EStG-2024",
    status: "in-force",
    validFrom: "2024-01-01",
    privateSale: {
      section: "§ 23 EStG",
      holdingYears: 1,
      exemptionLimitEur: Dec.parse("1000"),
    },
    otherIncome: {
      section: "§ 22 Nr. 3 EStG",
      exemptionLimitEur: Dec.parse("256"),
    },
    lotOrder: "fifo-per-wallet",
    sources: [
      { title: "§ 23 EStG", url: "https://www.gesetze-im-internet.de/estg/__23.html" },
      { title: "§ 22 EStG", url: "https://www.gesetze-im-internet.de/estg/__22.html" },
      {
        title: "BMF-Schreiben vom 06.03.2025 (Kryptowerte)",
        url: "https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-03-06-einzelfragen-kryptowerte-bmf-schreiben.pdf?__blob=publicationFile&v=2",
      },
    ],
  },
  draft: {
    id: "BMF-RefE-2026-09-30",
    status: "draft",
    draftDate: "2026-09-30",
    section: "§ 20 EStG (Entwurf)",
    cutoffDay: "2026-12-31",
    rate: Dec.parse("0.25"),
    soliRate: Dec.parse("0.055"),
    allowanceEur: Dec.parse("1000"),
    sources: [
      {
        title: "CryptoTicker: reform status, 16.10.2026",
        url: "https://cryptoticker.io/en/crypto-holding-period-reform-status/",
      },
    ],
  },
};
