/**
 * Minimal RFC 4180 CSV reader.
 * Handles quoted fields, escaped quotes, CRLF, a UTF-8 BOM, and the
 * semicolon delimiter that German spreadsheet software writes by default.
 */

export interface CsvTable {
  delimiter: string;
  header: string[];
  /** Each row with the 1-based line number where it starts in the file. */
  rows: Array<{ line: number; cells: string[] }>;
}

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  let best = ",";
  for (const d of [";", "\t"]) if ((counts[d] ?? 0) > (counts[best] ?? 0)) best = d;
  return best;
}

export function parseCsv(text: string): CsvTable {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLineEnd = src.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd === -1 ? src : src.slice(0, firstLineEnd));

  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let fieldStarted = false;

  const endField = () => {
    cells.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRecord = () => {
    endField();
    const empty = cells.length === 1 && cells[0]?.trim() === "";
    if (!empty) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) { inQuotes = true; fieldStarted = true; continue; }
    if (ch === delimiter) { endField(); continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { endRecord(); line++; recordLine = line; continue; }
    field += ch;
    fieldStarted = true;
  }
  if (field !== "" || cells.length > 0) endRecord();

  const [head, ...rows] = records;
  return {
    delimiter,
    header: (head?.cells ?? []).map((h) => h.trim()),
    rows,
  };
}

/** Quotes a value for CSV output when needed. */
export function csvCell(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
