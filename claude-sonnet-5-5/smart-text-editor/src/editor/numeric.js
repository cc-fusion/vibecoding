// Shared high-precision number setup and limits.
import Decimal from 'decimal.js';

export const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1000, toExpPos: 1000 });
export const RM = D.ROUND_HALF_UP;
export const BIG = new D('1.7976931348623157e308');
export const PI = D.acos(-1);
export const E_C = new D(1).exp();

export const MAX_EXPR = 500;
export const MAX_STARTS = 200;
export const MAX_TOKENS = 200;
export const MAX_DEPTH = 64;
export const MAX_ALTS = 8;
