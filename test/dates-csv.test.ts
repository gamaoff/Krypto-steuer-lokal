import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { berlinDay, parseCsv, parseTimestamp, taxFreeFrom } from "../src/engine/index.ts";

describe("taxFreeFrom (one-year rule, §§ 187, 188 BGB)", () => {
  it("is the day after the first anniversary", () => {
    assert.equal(taxFreeFrom("2025-03-14"), "2026-03-15");
    assert.equal(taxFreeFrom("2025-12-31"), "2027-01-01");
  });

  it("handles a purchase on 29 February", () => {
    assert.equal(taxFreeFrom("2024-02-29"), "2025-03-01");
  });

  it("handles 28 February before a leap year", () => {
    assert.equal(taxFreeFrom("2023-02-28"), "2024-02-29");
  });
});

describe("dates in Europe/Berlin", () => {
  it("moves a late UTC time into the next Berlin day", () => {
    assert.equal(berlinDay(Date.parse("2025-12-31T23:30:00Z")), "2026-01-01");
    assert.equal(berlinDay(Date.parse("2025-07-15T22:30:00Z")), "2025-07-16");
    assert.equal(berlinDay(Date.parse("2025-07-15T21:30:00Z")), "2025-07-15");
  });

  it("reads ISO, ISO with offset and German formats", () => {
    assert.equal(parseTimestamp("2025-03-14T10:22:00Z")?.day, "2025-03-14");
    assert.equal(parseTimestamp("2025-03-14T00:30:00+01:00")?.day, "2025-03-14");
    // 00:30 at +02:00 is 23:30 the previous day in Berlin, which is still on winter time in March.
    assert.equal(parseTimestamp("2025-03-14T00:30:00+02:00")?.day, "2025-03-13");
    assert.equal(parseTimestamp("2025-03-14 10:22")?.day, "2025-03-14");
    assert.equal(parseTimestamp("14.03.2025 10:22")?.day, "2025-03-14");
    assert.equal(parseTimestamp("2025-03-14")?.day, "2025-03-14");
  });

  it("rejects impossible dates", () => {
    assert.equal(parseTimestamp("2025-02-30"), null);
    assert.equal(parseTimestamp("31.04.2025"), null);
    assert.equal(parseTimestamp("yesterday"), null);
  });
});

describe("parseCsv", () => {
  it("reads quoted fields, escaped quotes and CRLF", () => {
    const t = parseCsv('a,b,c\r\n1,"x, y","say ""hi"""\r\n');
    assert.deepEqual(t.header, ["a", "b", "c"]);
    assert.deepEqual(t.rows[0]?.cells, ["1", "x, y", 'say "hi"']);
    assert.equal(t.rows[0]?.line, 2);
  });

  it("detects the semicolon delimiter and strips the BOM", () => {
    const t = parseCsv("﻿date;amount\n14.03.2025;0,5\n");
    assert.equal(t.delimiter, ";");
    assert.deepEqual(t.header, ["date", "amount"]);
    assert.deepEqual(t.rows[0]?.cells, ["14.03.2025", "0,5"]);
  });

  it("keeps line numbers right after a quoted newline and skips blank lines", () => {
    const t = parseCsv('a,b\n1,"two\nlines"\n\n3,4');
    assert.equal(t.rows.length, 2);
    assert.equal(t.rows[1]?.line, 5);
  });
});
