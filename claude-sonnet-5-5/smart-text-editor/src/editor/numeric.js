// Shared high-precision number setup and limits.
import Decimal from 'decimal.js';

export const BASE_PREC = 50;      // default working precision (significant digits)
export const MAX_PREC = 1000;     // decimal.js can evaluate pi/trig up to ~1025 digits

export const D = Decimal.clone({ precision: BASE_PREC, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -2000, toExpPos: 2000 });
export const RM = D.ROUND_HALF_UP;
export const BIG = new D('1.7976931348623157e308');
// load-time constants (BASE_PREC digits) - used for unit factors
export const PI = D.acos(-1);
export const E_C = new D(1).exp();

export const MAX_EXPR = 500;
export const MAX_STARTS = 200;
export const MAX_TOKENS = 200;
export const MAX_DEPTH = 64;
export const MAX_ALTS = 8;

/* ---- adaptive precision ----
   The default is BASE_PREC digits. When the user writes long literals (3.14159265358979323846...)
   or very small / large exponents (1 + 10^-60) the working precision grows to fit, up to MAX_PREC. */
export function setPrecision(p) {
  p = Math.max(BASE_PREC, Math.min(MAX_PREC, Math.ceil(p)));
  if (D.precision !== p) D.set({ precision: p });
}
export function precisionFor(text) {
  let need = 0, m;
  const lit = /\d[\d.]*/g;
  while ((m = lit.exec(text))) need = Math.max(need, m[0].replace(/\./g, '').length);
  const ex = /(?:\^|\*\*|[eE])\s*[-\u2212+]?\s*(\d{1,4})/g;
  while ((m = ex.exec(text))) need = Math.max(need, parseInt(m[1], 10));
  return need + 30;
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
