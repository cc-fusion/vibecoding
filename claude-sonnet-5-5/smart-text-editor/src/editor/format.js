// Number formatting: exact values, approximate ladders, constants with extra precision,
// plus "written out" (non-scientific) and full-precision variants.
import { D, RM, BIG } from './numeric.js';

const LARGE_SIG = 20;      // significant digits of the "large precision" cell for approximate values

// 10^-n, cached per call site precision
const pow10neg = (n) => D.pow(10, -n);

export function cleanVal(x) {
  if (!x.isFinite()) return null;
  const P = D.precision;
  if (x.abs().lt(pow10neg(P - 10))) return new D(0);          // pure rounding noise (sin(pi) ...)
  const r = x.toDecimalPlaces(0, RM);
  if (!r.isZero() && x.minus(r).abs().lt('1e-14')) return r;   // default view: 1.00000000000000000001 -> 1
  const r20 = x.toSignificantDigits(20, RM);
  if (!r20.eq(x) && x.minus(r20).abs().lte(x.abs().times(pow10neg(P - 15)))) return r20;
  return x;
}
export function isSci(x) {
  if (x.isZero()) return false;
  const a = x.abs();
  return a.gte('1e15') || a.lt('1e-6');
}
export function splitSci(x) {
  if (!isSci(x)) return { m: x, suf: '' };
  const e = x.e;
  return { m: x.div(D.pow(10, e)), suf: 'e' + e };
}
export function isExact(x) { return x.isZero() || x.sd() <= 20; }
export function formatExact(x) {
  if (x.isZero()) return '0';
  const { m, suf } = splitSci(x);
  return m.toFixed() + suf;
}
function sciString(x) {
  const { m, suf } = splitSci(x);
  return m.toFixed() + suf;
}
function decimalsOf(s) { const p = s.split('.')[1]; return p ? p.length : 0; }

// approximate value -> [inline, ...ladder]
export function formatApprox(x) {
  const { m, suf } = splitSci(x);
  const absm = m.abs();
  const mt = m.trunc();
  let dInline = null, inline = null;
  for (let d = 1; d <= 60; d++) {
    const r = m.toDecimalPlaces(d, RM);
    if (r.isZero()) continue;
    if (!r.trunc().eq(mt)) continue;
    if (r.minus(m).abs().div(absm).lte('0.05')) { dInline = d; inline = r.toFixed(d); break; }
  }
  if (inline === null) { dInline = 8; inline = m.toSignificantDigits(8, RM).toFixed(); }
  const out = [inline + suf];
  const seen = new Set([inline]);
  const intDigits = mt.isZero() ? 0 : mt.abs().toFixed().length;
  for (const n of [3, 5, 8]) {
    if (intDigits > n) continue;
    const r = m.toSignificantDigits(n, RM);
    if (!r.trunc().eq(mt)) continue;
    const s = r.toFixed();
    if (decimalsOf(s) <= dInline) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s + suf);
  }
  return out;
}

// constants (pi, e, ...) lead with 6 significant digits: 3.14159, 2.71828
export function formatConst(x) {
  const { m, suf } = splitSci(x);
  const mt = m.trunc();
  const intDigits = mt.isZero() ? 0 : mt.abs().toFixed().length;
  const out = [];
  const seen = new Set();
  for (const n of [6, 3, 9, 15]) {
    if (intDigits > n) continue;
    const r = m.toSignificantDigits(n, RM);
    if (!r.trunc().eq(mt)) continue;
    const s = r.toFixed();
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s + suf);
  }
  return out.length ? out : formatApprox(x);
}

/* ---- full precision / written-out variants ----
   fullVal: the value with only the last few (noise) digits stripped - NOT snapped to an integer. */
export function fullVal(v) {
  if (!v.isFinite()) return null;
  const P = D.precision;
  if (v.abs().lt(pow10neg(P - 10))) return null;
  const r = v.toSignificantDigits(P - 8, RM);
  return r.abs().gte(BIG) ? null : r;
}
// a terminating decimal that fits well inside the working precision
const isTerminating = (fx) => fx.sd() <= D.precision - 10;

// Extend the default list with:
//   * the full-precision value when the default hides digits (1 + 10^-20 -> 1.00000000000000000001)
//   * the written-out version of anything shown in scientific notation (1.6e-9 -> 0.0000000016)
function withExtras(base, v, x) {
  const fx = fullVal(v);
  if (!fx) return base;
  const out = base.slice();
  const seen = new Set(out);
  const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };

  const exact = isTerminating(fx);
  const differs = !fx.eq(x);
  if (exact && differs) add(isSci(fx) ? sciString(fx) : fx.toFixed());

  if (isSci(x) || isSci(fx)) {
    for (const s of new Set([base[0], base[base.length - 1]])) if (s.includes('e')) add(new D(s).toFixed());
    add((exact ? fx : fx.toSignificantDigits(LARGE_SIG, RM)).toFixed());
  }
  return out;
}

// value -> [primary, ...ladder, ...extras]; null = silent
export function formatValue(v, precise) {
  const x = cleanVal(v);
  if (!x) return null;
  if (x.abs().gte(BIG)) return null;
  const base = isExact(x) ? [formatExact(x)] : precise ? formatConst(x) : formatApprox(x);
  return withExtras(base, v, x);
}

// alternate-unit formatting: exact in full, else 3 s.f. without touching integer digits
export function fmtAlt(v) {
  const x = cleanVal(v);
  if (!x || x.abs().gte(BIG)) return null;
  if (isExact(x)) return formatExact(x);
  const { m, suf } = splitSci(x);
  const mt = m.trunc();
  const intDigits = mt.isZero() ? 0 : mt.abs().toFixed().length;
  let s;
  if (intDigits >= 3) s = mt.toFixed();
  else {
    let r = m.toSignificantDigits(3, RM);
    if (!r.trunc().eq(mt)) r = m.toDecimalPlaces(Math.max(1, 3 - intDigits), D.ROUND_DOWN);
    s = r.toFixed();
  }
  return s + suf;
}

// written-out companion of an alternate-unit value shown in scientific notation (else null)
export function fmtAltWritten(v) {
  const x = cleanVal(v);
  if (!x || x.abs().gte(BIG) || !isSci(x)) return null;
  const fx = fullVal(v) || x;
  return (isTerminating(fx) ? fx : fx.toSignificantDigits(LARGE_SIG, RM)).toFixed();
}
