import { useEffect, useMemo, useState } from "react";
import {
  berlinDay,
  buildLedger,
  parseTransactions,
  RULES,
  type Alert,
  type Ledger,
  type Transaction,
} from "../engine/index.ts";

export interface LoadedFile {
  name: string;
  text: string;
}

export interface FileStats {
  name: string;
  rows: number;
  problems: number;
}

export interface AppData {
  ledger: Ledger;
  alerts: Alert[];
  fileStats: FileStats[];
  txById: Map<string, Transaction>;
}

/** Parses all loaded files and builds the ledger. Everything stays in memory. */
export function useAppData(files: LoadedFile[]): AppData {
  return useMemo(() => {
    const transactions: Transaction[] = [];
    const parseAlerts: Alert[] = [];
    const fileStats: FileStats[] = [];
    for (const f of files) {
      const r = parseTransactions(f.text, f.name, transactions.length);
      transactions.push(...r.transactions);
      parseAlerts.push(...r.alerts);
      fileStats.push({ name: f.name, rows: r.transactions.length, problems: r.alerts.length });
    }
    const ledger = buildLedger(transactions, RULES);
    return {
      ledger,
      alerts: [...parseAlerts, ...ledger.alerts],
      fileStats,
      txById: new Map(ledger.transactions.map((tx) => [tx.id, tx])),
    };
  }, [files]);
}

export function useToday(): string {
  return useMemo(() => berlinDay(Date.now()), []);
}

/**
 * Counts every network request the page makes after it has loaded,
 * and every request the Content Security Policy blocked.
 */
export function useNetworkMonitor(): { requests: number; blocked: number } {
  const [state, setState] = useState({ requests: 0, blocked: 0 });
  useEffect(() => {
    const onViolation = () => setState((s) => ({ ...s, blocked: s.blocked + 1 }));
    document.addEventListener("securitypolicyviolation", onViolation);
    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== "undefined") {
      observer = new PerformanceObserver((list) => {
        const n = list.getEntries().length;
        if (n > 0) setState((s) => ({ ...s, requests: s.requests + n }));
      });
      observer.observe({ type: "resource", buffered: false });
    }
    return () => {
      document.removeEventListener("securitypolicyviolation", onViolation);
      observer?.disconnect();
    };
  }, []);
  return state;
}

/** Hands a text file to the browser's download, without any network request. */
export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
