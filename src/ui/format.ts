import { Dec } from "../engine/index.ts";
import type { Lang } from "./i18n.ts";

/**
 * Reads a number the person typed, using the separators of the interface language.
 * In German "74.000" is seventy-four thousand and "0,5" is a half.
 * (CSV files use a heuristic instead, see parseLocaleNumber.)
 */
export function parseUserNumber(input: string, lang: Lang): Dec | null {
  let s = input.trim().replace(/[\s  ']/g, "");
  if (s === "") return null;
  s = lang === "de" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  try {
    return Dec.parse(s);
  } catch {
    return null;
  }
}

function group(intPart: string, sep: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Formats a decimal string like "-1234.5" with the locale's separators, without going through a float. */
function localise(plain: string, lang: Lang): string {
  const neg = plain.startsWith("-");
  const [i = "0", f] = (neg ? plain.slice(1) : plain).split(".");
  const [thousands, decimal] = lang === "de" ? [".", ","] : [",", "."];
  const out = group(i, thousands) + (f ? decimal + f : "");
  return neg ? `−${out}` : out;
}

export function money(d: Dec, lang: Lang): string {
  const s = localise(d.toFixed(2), lang);
  return lang === "de" ? `${s} €` : `€${s}`;
}

/** Plain euro amount with 2 decimals, without currency sign. Used for comb fields. */
export function moneyDigits(d: Dec, lang: Lang): string {
  return localise(d.abs().toFixed(2), lang);
}

/** Crypto units: up to 8 decimals, trailing zeros removed. */
export function units(d: Dec, lang: Lang): string {
  const s = d.toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return localise(s, lang);
}

export function day(dayStr: string, lang: Lang): string {
  if (lang === "en") return dayStr;
  const [y, m, d] = dayStr.split("-");
  return `${d}.${m}.${y}`;
}
