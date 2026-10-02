// Shared high-precision number setup and limits.
import Decimal from 'decimal.js';

export const BASE_PREC = 50;          // default working precision (significant digits)
export const MAX_PREC = 1000;         // ln / log / trig / gamma: decimal.js constants hold ~1025 digits
export const MAX_PREC_EXACT = 2200;   // pure arithmetic (+ - * / ^ !) has no such limit
export const EXACT_FLOOR = 1100;      // working precision for pure arithmetic with powers / factorials

/* Plain-number limits.
   - at most MAX_DIGITS integer digits are written out in full; more -> scientific notation
   - at most MAX_DECIMALS decimals are written out in full; more -> the plain number without the long tail */
export const MAX_DIGITS = 1000;
export const MAX_DECIMALS = 1000;
export const MAX_EXP10 = 100000;      // results beyond 10^100000 are not shown

export const D = Decimal.clone({ precision: BASE_PREC, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1e6, toExpPos: 1e6 });
export const RM = D.ROUND_HALF_UP;
export const BIG = new D('1e' + MAX_EXP10);
// load-time constants (BASE_PREC digits) - used for unit factors
export const PI = D.acos(-1);
export const E_C = new D(1).exp();

export const MAX_EXPR = 500;
export const MAX_STARTS = 200;
export const MAX_TOKENS = 200;
export const MAX_DEPTH = 64;
export const MAX_ALTS = 8;

// small helper clone: cheap log10 estimates that never hit the high-precision limits
const LO = D.clone({ precision: 40 });
export function lg10(x) {
  const s = x.abs().toSignificantDigits(30).toExponential();
  return LO.log10(s).toNumber();
}

// run fn at no more than p digits (ln / exp / trig constants are limited to ~1025 digits)
export function capPrecision(p, fn) {
  const old = D.precision;
  if (old <= p) return fn();
  D.set({ precision: p });
  try { return fn(); } finally { D.set({ precision: old }); }
}

/* ---- adaptive precision ----
   The default is BASE_PREC digits. When the user writes long literals (3.14159265358979323846...)
   or large / small exponents (1 + 10^-60, 2**1000) the working precision grows to fit.
   Expressions without transcendental functions can go well past 1000 digits. */
export const ctx = { noise: true };   // may tiny results be treated as rounding noise (sin(pi) ...)?

const TRANSC_RE = /sin|cos|tan|csc|sec|cot|ln|log|pi|\u03c0/i;
const CONST_E_RE = /(^|[^A-Za-z0-9._])e(?![A-Za-z0-9_])/;
const EXACT_RE = /\^|\*\*|!|ncr|npr|\b[CP]\s*\(/i;

function plan(text) {
  let litMax = 0, expNeed = 0, m;
  const lit = /\d[\d.]*/g;
  while ((m = lit.exec(text))) litMax = Math.max(litMax, m[0].replace(/\./g, '').length);
  const ex = /(?:\^|\*\*|[eE])\s*[-\u2212+]?\s*(\d{1,6})/g;
  while ((m = ex.exec(text))) expNeed = Math.max(expNeed, parseInt(m[1], 10));
  const transc = TRANSC_RE.test(text) || CONST_E_RE.test(text);
  const cap = transc ? MAX_PREC : MAX_PREC_EXACT;
  const need = Math.max(transc ? litMax : litMax * 3, expNeed);
  let p = need + 30;
  if (!transc && EXACT_RE.test(text)) p = Math.max(p, EXACT_FLOOR);
  return { p: Math.min(cap, Math.max(p, BASE_PREC)), noise: need + 30 <= cap };
}

export function setPrecision(p) {
  p = Math.max(BASE_PREC, Math.min(MAX_PREC_EXACT, Math.ceil(p)));
  if (D.precision !== p) D.set({ precision: p });
}
export function precisionFor(text) { return plan(text).p; }
export function configureFor(text) {
  const { p, noise } = plan(text);
  ctx.noise = noise;
  setPrecision(p);
}

// constants at the *current* working precision (cached per precision)
const constCache = new Map();
function cached(key, make) {
  const k = key + '@' + D.precision;
  let v = constCache.get(k);
  if (!v) { v = make(); constCache.set(k, v); if (constCache.size > 24) constCache.delete(constCache.keys().next().value); }
  return v;
}
export const piNow = () => cached('pi', () => D.acos(-1));
export const eNow = () => cached('e', () => new D(1).exp());
