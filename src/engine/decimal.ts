/**
 * Exact fixed-point decimal arithmetic on BigInt.
 *
 * Every value carries 18 fractional digits, which covers the smallest unit of
 * Ethereum (1 wei = 1e-18 ETH) and is far beyond what euro amounts need.
 * Money is never stored as a JavaScript float.
 *
 * Rounding: multiplication and division round half away from zero at the
 * 18th digit. Display rounding (toFixed) uses the same rule.
 */

const SCALE = 18;
const ONE = 10n ** BigInt(SCALE);

function divRoundHalfAway(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError("Division by zero");
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  const absR2 = (r < 0n ? -r : r) * 2n;
  const absD = d < 0n ? -d : d;
  if (absR2 >= absD) {
    const negative = (n < 0n) !== (d < 0n);
    return negative ? q - 1n : q + 1n;
  }
  return q;
}

const STRICT = /^([+-])?(\d*)(?:\.(\d*))?$/;

export class Dec {
  private constructor(readonly raw: bigint) {}

  static readonly ZERO = new Dec(0n);

  /** Parses a plain decimal string such as "-12.5" or "0.000001". */
  static parse(input: string): Dec {
    const s = input.trim();
    const m = STRICT.exec(s);
    if (!m || (m[2] === "" && (m[3] === undefined || m[3] === ""))) {
      throw new SyntaxError(`Not a decimal number: "${input}"`);
    }
    const sign = m[1] === "-" ? -1n : 1n;
    const intPart = m[2] === "" ? "0" : (m[2] ?? "0");
    let frac = m[3] ?? "";
    let roundUp = false;
    if (frac.length > SCALE) {
      roundUp = (frac.charCodeAt(SCALE) - 48) >= 5;
      frac = frac.slice(0, SCALE);
    }
    frac = frac.padEnd(SCALE, "0");
    let raw = BigInt(intPart) * ONE + BigInt(frac);
    if (roundUp) raw += 1n;
    return new Dec(sign * raw);
  }

  static fromInt(n: number | bigint): Dec {
    if (typeof n === "number" && !Number.isInteger(n)) {
      throw new TypeError("fromInt expects an integer");
    }
    return new Dec(BigInt(n) * ONE);
  }

  static sum(values: Iterable<Dec>): Dec {
    let acc = 0n;
    for (const v of values) acc += v.raw;
    return new Dec(acc);
  }

  add(o: Dec): Dec { return new Dec(this.raw + o.raw); }
  sub(o: Dec): Dec { return new Dec(this.raw - o.raw); }
  mul(o: Dec): Dec { return new Dec(divRoundHalfAway(this.raw * o.raw, ONE)); }
  div(o: Dec): Dec { return new Dec(divRoundHalfAway(this.raw * ONE, o.raw)); }
  neg(): Dec { return new Dec(-this.raw); }
  abs(): Dec { return this.raw < 0n ? new Dec(-this.raw) : this; }

  cmp(o: Dec): -1 | 0 | 1 { return this.raw < o.raw ? -1 : this.raw > o.raw ? 1 : 0; }
  eq(o: Dec): boolean { return this.raw === o.raw; }
  lt(o: Dec): boolean { return this.raw < o.raw; }
  lte(o: Dec): boolean { return this.raw <= o.raw; }
  gt(o: Dec): boolean { return this.raw > o.raw; }
  gte(o: Dec): boolean { return this.raw >= o.raw; }
  isZero(): boolean { return this.raw === 0n; }
  isNegative(): boolean { return this.raw < 0n; }
  isPositive(): boolean { return this.raw > 0n; }

  static min(a: Dec, b: Dec): Dec { return a.lte(b) ? a : b; }
  static max(a: Dec, b: Dec): Dec { return a.gte(b) ? a : b; }

  /** Rounds half away from zero to `dp` digits and formats with "." as separator. */
  toFixed(dp: number): string {
    if (!Number.isInteger(dp) || dp < 0 || dp > SCALE) throw new RangeError("dp out of range");
    const factor = 10n ** BigInt(SCALE - dp);
    const q = divRoundHalfAway(this.raw, factor);
    const neg = q < 0n;
    const abs = neg ? -q : q;
    const unit = 10n ** BigInt(dp);
    const intPart = abs / unit;
    const fracPart = abs % unit;
    const sign = neg && abs !== 0n ? "-" : "";
    if (dp === 0) return `${sign}${intPart}`;
    return `${sign}${intPart}.${fracPart.toString().padStart(dp, "0")}`;
  }

  /** Canonical string without trailing zeros, e.g. "0.05" or "-12". */
  toString(): string {
    const s = this.toFixed(SCALE);
    if (!s.includes(".")) return s;
    const trimmed = s.replace(/0+$/, "").replace(/\.$/, "");
    return trimmed === "-0" ? "0" : trimmed;
  }

  /** For display or charts only. Never use the result in calculations. */
  toNumber(): number { return Number(this.toString()); }
}

/**
 * Normalises numbers as they appear in exchange exports:
 * "1234.56", "1234,56", "1.234,56", "1,234.56", "1 234,56".
 * The separator that appears last is treated as the decimal separator.
 */
export function parseLocaleNumber(input: string): Dec {
  let s = input.trim().replace(/[\s  ']/g, "");
  if (s === "") throw new SyntaxError("Empty number");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const commas = s.split(",").length - 1;
    if (commas > 1) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  }
  return Dec.parse(s);
}
