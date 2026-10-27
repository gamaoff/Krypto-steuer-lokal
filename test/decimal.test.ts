import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Dec, parseLocaleNumber } from "../src/engine/index.ts";

describe("Dec", () => {
  it("adds without float error", () => {
    assert.equal(Dec.parse("0.1").add(Dec.parse("0.2")).toString(), "0.3");
  });

  it("keeps 18 decimals, the size of 1 wei", () => {
    const wei = Dec.parse("0.000000000000000001");
    assert.equal(wei.add(wei).toString(), "0.000000000000000002");
  });

  it("multiplies and divides with half-away-from-zero rounding", () => {
    assert.equal(Dec.parse("10").div(Dec.parse("3")).toFixed(2), "3.33");
    assert.equal(Dec.parse("2").div(Dec.parse("3")).toFixed(2), "0.67");
    assert.equal(Dec.parse("-2").div(Dec.parse("3")).toFixed(2), "-0.67");
    assert.equal(Dec.parse("1.005").toFixed(2), "1.01");
    assert.equal(Dec.parse("0.5").mul(Dec.parse("0.5")).toString(), "0.25");
  });

  it("formats zero and negatives", () => {
    assert.equal(Dec.parse("-0.004").toFixed(2), "0.00");
    assert.equal(Dec.parse("-12.5").toString(), "-12.5");
    assert.equal(Dec.ZERO.toString(), "0");
  });

  it("rejects text that is not a number", () => {
    assert.throws(() => Dec.parse("abc"));
    assert.throws(() => Dec.parse(""));
    assert.throws(() => Dec.parse("1.2.3"));
  });
});

describe("parseLocaleNumber", () => {
  it("reads the formats exchanges export", () => {
    assert.equal(parseLocaleNumber("1234.56").toString(), "1234.56");
    assert.equal(parseLocaleNumber("1234,56").toString(), "1234.56");
    assert.equal(parseLocaleNumber("1.234,56").toString(), "1234.56");
    assert.equal(parseLocaleNumber("1,234.56").toString(), "1234.56");
    assert.equal(parseLocaleNumber("1 234,56").toString(), "1234.56");
    assert.equal(parseLocaleNumber("0,00125").toString(), "0.00125");
    assert.equal(parseLocaleNumber("1,234,567").toString(), "1234567");
  });
});
