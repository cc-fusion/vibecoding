// ── Number formatting & precision continuation ──────────────────────────────
import Decimal from "decimal.js";

const BIG = new Decimal("1e1000");
const SMALL = new Decimal("1e-1000");
const SCI_HI = new Decimal("1e4");
const SCI_LO = new Decimal("1e-4");

// Plain decimal string with `sig` significant digits (never exponential).
export function plain(d, sig = 4, rounding = Decimal.ROUND_HALF_UP) {
  if (d.isZero()) return "0";
  const r = d.toSignificantDigits(sig, rounding);
  const dp = Math.max(0, r.sd() - 1 - r.e);
  return r.toFixed(dp);
}

// Compact scientific string, e.g. 1.234e-7
export function sci(d, sig = 4) {
  if (d.isZero()) return "0";
  const s = d.toExponential(sig - 1);
  let [mant, exp] = s.split("e");
  if (mant.includes(".")) mant = mant.replace(/0+$/, "").replace(/\.$/, "");
  const e = parseInt(exp, 10);
  return `${mant}e${e}`;
}

export function intDigits(d) {
  return d.isZero() ? 1 : d.e + 1;
}

// Default preview: 4 significant digits, standard rounding. When small literal
// addends demand more digits (pi + 0.000001), precision continues with the
// true digit expansion instead of rounding.
export function formatNumber(d, extendSig = 0) {
  if (d.isZero()) return { primary: "0", alt: null };
  const abs = d.abs();
  const extreme = abs.gt(BIG) || abs.lt(SMALL);
  if (extreme) return { primary: sci(d), alt: null, sciOnly: true };
  const sig = Math.max(4, Math.min(extendSig, 400));
  const primary = sig > 4 ? plain(d, sig, Decimal.ROUND_DOWN) : plain(d, 4);
  let alt = null;
  if (sig === 4 && (abs.gt(SCI_HI) || abs.lt(SCI_LO))) alt = sci(d);
  return { primary, alt };
}

const stripTyped = (t) => (t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t);

// Continue a partially typed result. Returns { insert, replaceBefore } or null.
// - exact prefix  → offer the next true digit (or the decimal point)
// - rounded tail  → replace the diverging digits and extend by one more
export function continuation(typed, value, precision) {
  if (!/^-?\d*\.?\d*$/.test(typed) || !/\d/.test(typed)) return null;
  if (typed.length + 8 > precision) return null;
  if (!value.isFinite()) return null;

  // Full-precision plain expansion of the true value.
  const exact = plain(value, Math.max(precision - 10, 20), Decimal.ROUND_DOWN);
  const isExactValue = value.eq(new Decimal(plain(value, Math.max(precision - 10, 20), Decimal.ROUND_HALF_UP))) &&
    value.sd() < precision - 12;

  if (isExactValue && stripTyped(typed) === exact) return null;

  const decimals = typed.includes(".") ? typed.split(".")[1].length : 0;
  const trueStr = isExactValue ? exact : value.toFixed(decimals + 6, Decimal.ROUND_DOWN);

  // Exact-prefix path
  if (trueStr.startsWith(typed)) {
    if (isExactValue) {
      if (typed.length >= trueStr.length) {
        // typed matches the whole exact value (maybe with trailing zeros) → done
        return null;
      }
      return { insert: trueStr[typed.length], replaceBefore: 0 };
    }
    if (typed.length >= trueStr.length) return null;
    return { insert: trueStr[typed.length], replaceBefore: 0 };
  }

  // Divergence: only repair a purely numeric suffix (a rounded last digit).
  let k = 0;
  while (k < typed.length && k < trueStr.length && typed[k] === trueStr[k]) k++;
  const suffix = typed.slice(k);
  if (k === 0 || !/^\d+$/.test(suffix)) return null;
  if (isExactValue) {
    const ins = trueStr.slice(k, k + suffix.length + 1);
    if (ins.length === 0) return null;
    return { insert: ins, replaceBefore: suffix.length };
  }
  const insert = trueStr.slice(k, k + suffix.length + 1);
  if (insert.length < suffix.length + 1) return null;
  return { insert, replaceBefore: suffix.length };
}

export function truncateLabel(s, max = 30) {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}
