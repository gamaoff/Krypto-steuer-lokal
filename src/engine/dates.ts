/**
 * Calendar logic for German tax rules.
 *
 * A "Day" is a calendar date in Europe/Berlin, written as "YYYY-MM-DD".
 * Strings in this format compare correctly with < and >.
 */

export type Day = string;

const berlinParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in Europe/Berlin for a UTC timestamp in milliseconds. */
export function berlinDay(ts: number): Day {
  const parts = berlinParts.formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

export function makeDay(y: number, m: number, d: number): Day | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const monthDays = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const max = monthDays[m - 1] ?? 0;
  if (d > max) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function splitDay(day: Day): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y ?? 0, m ?? 0, d ?? 0];
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = splitDay(day);
  const t = Date.UTC(y, m - 1, d) + n * 86_400_000;
  const dt = new Date(t);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetween(from: Day, to: Day): number {
  const [y1, m1, d1] = splitDay(from);
  const [y2, m2, d2] = splitDay(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function yearOf(day: Day): number {
  return splitDay(day)[0];
}

/**
 * First day on which a sale is no longer a private disposal under
 * § 23 Abs. 1 Nr. 2 EStG ("not more than one year" between purchase and sale).
 *
 * Period computed per §§ 187 Abs. 1, 188 Abs. 2 and 3 BGB: the purchase day is
 * not counted, the year ends with the same calendar day one year later, so the
 * sale is tax-free from the day after. A purchase on 29 February ends its year
 * on 28 February, so the sale is tax-free from 1 March.
 */
export function taxFreeFrom(acquired: Day): Day {
  const [y, m, d] = splitDay(acquired);
  const ny = y + 1;
  if (m === 2 && d === 29 && !isLeapYear(ny)) return makeDay(ny, 3, 1) as Day;
  return addDays(makeDay(ny, m, d) as Day, 1);
}

export interface ParsedTime {
  ts: number;
  day: Day;
}

const ISO_ZONED = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})$/i;
const ISO_NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const GERMAN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Accepts the date formats found in exchange exports:
 * - ISO 8601 with zone ("2025-03-14T10:22:00Z", "...+01:00"): converted to Berlin time.
 * - ISO without zone ("2025-03-14 10:22"): read as Berlin local time.
 * - German ("14.03.2025 10:22"): read as Berlin local time.
 * Times without a zone are only used to order transactions on the same day.
 */
export function parseTimestamp(input: string): ParsedTime | null {
  const s = input.trim();
  const z = ISO_ZONED.exec(s);
  if (z) {
    const offset = z[3] === "z" ? "Z" : (z[3] ?? "Z").replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
    const ts = Date.parse(`${z[1]}T${z[2]}${offset}`);
    if (Number.isNaN(ts)) return null;
    return { ts, day: berlinDay(ts) };
  }
  let y: number, mo: number, d: number, h = 0, mi = 0, se = 0;
  const n = ISO_NAIVE.exec(s);
  const g = n ? null : GERMAN.exec(s);
  if (n) {
    y = Number(n[1]); mo = Number(n[2]); d = Number(n[3]);
    h = Number(n[4] ?? 0); mi = Number(n[5] ?? 0); se = Number(n[6] ?? 0);
  } else if (g) {
    d = Number(g[1]); mo = Number(g[2]); y = Number(g[3]);
    h = Number(g[4] ?? 0); mi = Number(g[5] ?? 0); se = Number(g[6] ?? 0);
  } else {
    return null;
  }
  const day = makeDay(y, mo, d);
  if (!day || h > 23 || mi > 59 || se > 59) return null;
  return { ts: Date.UTC(y, mo - 1, d, h, mi, se), day };
}
