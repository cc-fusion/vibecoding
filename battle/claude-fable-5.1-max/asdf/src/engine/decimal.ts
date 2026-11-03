import Decimal from "decimal.js";

export type Dec = Decimal;
export type DecCtor = typeof Decimal;

const BASE_CONFIG = {
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
  maxE: 9e15,
  minE: -9e15,
};

Decimal.set({ precision: 60, ...BASE_CONFIG });

/** Default constructor (60 significant digits) used for unit factors and constants. */
export const D0 = Decimal;

const ctorCache = new Map<number, DecCtor>();

/** Returns a (cached) Decimal constructor with the requested working precision. */
export function decimalWithPrecision(precision: number): DecCtor {
  const p = Math.max(20, Math.min(5000, Math.round(precision)));
  let ctor = ctorCache.get(p);
  if (!ctor) {
    ctor = Decimal.clone({ precision: p, ...BASE_CONFIG });
    ctorCache.set(p, ctor);
  }
  return ctor;
}

export function precisionOf(x: Dec): number {
  return (x.constructor as DecCtor).precision;
}

// ---------------------------------------------------------------------------
// π to arbitrary precision (Machin's formula), cached.
// decimal.js ships ~1000 digits of π internally; beyond that we compute our own.
// ---------------------------------------------------------------------------

let piCacheDigits = 0;
let piCacheValue: Dec | null = null;

function arctanInverse(D: DecCtor, n: number, digits: number): Dec {
  const nn = new D(n);
  const n2 = nn.mul(nn);
  let power = new D(1).div(nn); // 1/n^(2k+1)
  let sum = power;
  const eps = new D(10).pow(-(digits + 5));
  let k = 1;
  let negative = true;
  for (;;) {
    power = power.div(n2);
    const term = power.div(2 * k + 1);
    if (term.abs().lt(eps)) break;
    sum = negative ? sum.minus(term) : sum.plus(term);
    negative = !negative;
    k++;
  }
  return sum;
}

/** π with at least `digits` significant digits. */
export function pi(digits: number): Dec {
  const need = Math.max(60, digits);
  if (piCacheValue && piCacheDigits >= need) return piCacheValue;
  const target = Math.ceil(need / 100) * 100 + 20;
  if (target <= 1000) {
    // Fast path: decimal.js has an internal high precision π.
    const W = decimalWithPrecision(target);
    piCacheValue = W.acos(-1);
  } else {
    const W = decimalWithPrecision(target + 15);
    piCacheValue = W.mul(16, arctanInverse(W, 5, target + 10)).minus(
      W.mul(4, arctanInverse(W, 239, target + 10)),
    );
  }
  piCacheDigits = target;
  return piCacheValue;
}

/** π rounded into the given constructor's precision. */
export function piFor(D: DecCtor): Dec {
  return new D(pi(D.precision));
}
