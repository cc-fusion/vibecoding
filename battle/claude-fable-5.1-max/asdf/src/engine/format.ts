import Decimal from "decimal.js";
import type { Dec } from "./decimal";

export const DEFAULT_SIG = 4;

export interface FormatOpts {
  /** significant digits for the preview (default 4) */
  sig?: number;
  /** keep at least this many decimals (precision of the typed inputs) */
  minDecimals?: number;
}

export function stripZeros(s: string): string {
  if (s.includes(".")) {
    s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (s === "-0" || s === "") s = "0";
  return s;
}

export function decimalsOf(s: string): number {
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

function integerDigits(x: Dec): number {
  const a = x.abs();
  if (a.lt(1)) return 0;
  return a.e + 1;
}

/**
 * Ordinary decimal notation. Rounds to `sig` significant digits (never rounding
 * away integer digits) and extends with exact digits when the inputs carried
 * more decimal precision than the rounded preview would show.
 */
export function formatPlain(x: Dec, opts: FormatOpts = {}): string {
  const sig = opts.sig ?? DEFAULT_SIG;
  if (!x.isFinite()) throw new Error("non-finite");
  if (x.isZero()) return "0";
  const useSig = Math.max(sig, integerDigits(x));
  const rounded = x.toSignificantDigits(useSig, Decimal.ROUND_HALF_UP);
  let s = stripZeros(rounded.toFixed());
  const minDec = opts.minDecimals ?? 0;
  if (minDec > decimalsOf(s)) {
    const ext = stripZeros(x.toFixed(minDec, Decimal.ROUND_DOWN));
    if (decimalsOf(ext) > decimalsOf(s)) s = ext;
  }
  return s;
}

/** Scientific notation such as `1.234e-5` (mantissa rounded to `sig` digits). */
export function formatSci(x: Dec, sig = DEFAULT_SIG): string {
  if (x.isZero()) return "0";
  const r = x.toSignificantDigits(sig, Decimal.ROUND_HALF_UP);
  let s = r.toExponential();
  s = s.replace("e+", "e");
  s = s.replace(/^(-?\d)(?:\.(\d*?))?0*e/, (_m, a: string, b: string | undefined) =>
    b && b.length ? `${a}.${b}e` : `${a}e`,
  );
  return s;
}

export type SciLevel = "none" | "alt" | "only";

const SCI_ALT_LO = new Decimal("1e-4");
const SCI_ALT_HI = new Decimal("1e4");
const SCI_ONLY_LO = new Decimal("1e-1000");
const SCI_ONLY_HI = new Decimal("1e1000");

/** Whether scientific notation should be offered as an alternative, or used exclusively. */
export function sciLevel(x: Dec): SciLevel {
  if (x.isZero() || !x.isFinite()) return "none";
  const a = x.abs();
  if (a.lt(SCI_ONLY_LO) || a.gt(SCI_ONLY_HI)) return "only";
  if (a.lt(SCI_ALT_LO) || a.gt(SCI_ALT_HI)) return "alt";
  return "none";
}

/**
 * Exact decimal expansion of `x` (as far as its working precision allows),
 * rounded a few digits short of the precision so that numerical noise such as
 * 0.4999999…9 collapses to 0.5.
 */
export function exactString(x: Dec, precision: number): string {
  if (x.isZero()) return "0";
  const keep = Math.max(6, precision - 8);
  const t = x.toSignificantDigits(keep, Decimal.ROUND_HALF_UP);
  return stripZeros(t.toFixed());
}

export interface Continuation {
  /** characters before the cursor that must be replaced */
  replaceBefore: number;
  /** text to insert */
  text: string;
}

/**
 * Given the digits the user has typed so far and the exact value, compute the
 * next digit to suggest. Returns "done" when the typed text already equals the
 * full expansion, null when the typed text does not match the value.
 */
export function continueDigits(typed: string, x: Dec, precision: number): Continuation | "done" | null {
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(typed)) return null;
  if (typed.startsWith("+")) return null;
  const exact = exactString(x, precision);
  if (typed === exact) return "done";
  let common = -1;
  if (exact.startsWith(typed)) {
    common = typed.length;
  } else {
    // Does the typed text equal the value correctly rounded to the typed length?
    let rounded: string | null = null;
    if (typed.includes(".")) {
      const dec = typed.split(".")[1].length;
      rounded = x.toFixed(dec, Decimal.ROUND_HALF_UP);
      if (rounded === typed || stripZeros(rounded) === stripZeros(typed)) {
        common = commonPrefix(typed, exact);
      }
    } else {
      const digits = typed.replace("-", "").length;
      rounded = x.toSignificantDigits(digits, Decimal.ROUND_HALF_UP).toFixed();
      if (rounded === typed) {
        common = commonPrefix(typed, exact);
      }
    }
    if (common < 0) return null;
  }
  let text = exact.slice(common, typed.length + 1);
  if (text.endsWith(".")) text = exact.slice(common, typed.length + 2);
  if (!text.length) return "done";
  return { replaceBefore: typed.length - common, text };
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Truncates long previews with an ellipsis. */
export function truncatePreview(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 3)) + "...";
}
