// Evaluator
// Quantity: {v: Decimal (SI), d: dims, us: [unit-exponent maps], t: abs-temperature info}
import { D, RM, BIG, MAX_PREC, MAX_EXP10, lg10, capPrecision, piNow, eNow } from './numeric.js';
import { ZERO, ANGLE, TH_D } from './units.js';

const FAILX = { fail: true };
const failEv = () => { throw FAILX; };
export const Q = (v, d, us, t) => ({ v: (v instanceof D) ? v : new D(v), d: d || ZERO, us: us || [{}], t: t || null });
export const dEq = (a, b) => a.every((x, i) => x === b[i]);
export const dZero = (d) => d.every(x => x === 0);
const dAdd = (a, b) => a.map((x, i) => x + b[i]);
const dSub = (a, b) => a.map((x, i) => x - b[i]);
const nt = (q) => { if (q.t) failEv(); return q; };
function chk(q) {
  if (!q.v.isFinite() || q.v.abs().gte(BIG)) failEv();
  return q;
}

/* unit-exponent algebra (what units did the user combine?) */
function uSig(m) { return Object.keys(m).sort().map(k => k + ':' + m[k].e).join('|'); }
function uMul(A, B, sgn) {
  const out = [], seen = new Set();
  for (const a of A) for (const b of B) {
    const m = {};
    for (const k in a) m[k] = { ou: a[k].ou, e: a[k].e };
    for (const k in b) {
      const e = b[k].e * sgn;
      if (m[k]) m[k].e += e; else m[k] = { ou: b[k].ou, e };
      if (m[k].e === 0) delete m[k];
    }
    const sig = uSig(m);
    if (!seen.has(sig)) { seen.add(sig); out.push(m); if (out.length >= 6) return out; }
  }
  return out;
}
function uAdd(A, B) {
  const out = [], seen = new Set();
  for (const m of A.concat(B)) {
    const sig = uSig(m);
    if (!seen.has(sig)) { seen.add(sig); out.push(m); if (out.length >= 6) break; }
  }
  return out;
}
function uScale(A, y) {
  const out = [];
  for (const um of A) {
    const m = {}; let ok = true;
    for (const k in um) {
      const e = um[k].e * y;
      if (!Number.isInteger(e)) { ok = false; break; }
      m[k] = { ou: um[k].ou, e };
    }
    if (ok) out.push(m);
  }
  return out;
}

/* temperatures: absolute degC/degF values carry t:{ou, x} */
function tempMake(x, ou) {
  const K = x.plus(ou.offset).times(ou.f);
  return Q(K, TH_D, [{ [ou.sym]: { ou, e: 1 } }], { ou, x });
}
const tempX = (ou, K) => K.div(ou.f).minus(ou.offset || 0);

/* gamma via shift + Stirling series */
const BERN = [[1, 6], [-1, 30], [1, 42], [-1, 30], [5, 66], [-691, 2730], [7, 6], [-3617, 510], [43867, 798], [-174611, 330]]
  .map(([a, b]) => new D(a).div(b));
function gammaD(z) {
  const PI = piNow();
  let prod = new D(1), zz = z;
  while (zz.lt(40)) { prod = prod.times(zz); zz = zz.plus(1); }
  let s = zz.minus(0.5).times(zz.ln()).minus(zz).plus(PI.times(2).ln().div(2));
  const z2 = zz.times(zz);
  let zp = zz;
  for (let k = 1; k <= BERN.length; k++) {
    s = s.plus(BERN[k - 1].div(2 * k * (2 * k - 1)).div(zp));
    zp = zp.times(z2);
  }
  return s.exp().div(prod);
}
function gammaOnePlus(x) {
  const PI = piNow();
  const w = x.plus(1);
  if (w.gt(0)) return gammaD(w);
  const sn = D.sin(PI.times(w));
  if (sn.isZero()) failEv();
  return PI.div(sn.times(gammaD(new D(1).minus(w))));
}
function factQ(q) {
  nt(q);
  if (!dZero(q.d)) failEv();
  const x = q.v;
  if (x.isInteger()) {
    if (x.isNeg() || x.gt(170)) failEv();
    let r = new D(1);
    const n = x.toNumber();
    for (let i = 2; i <= n; i++) r = r.times(i);
    return chk(Q(r));
  }
  if (x.abs().gt(170)) failEv();
  // ln / exp / sin constants only go to ~1025 digits
  return chk(Q(capPrecision(MAX_PREC, () => gammaOnePlus(x))));
}
function combQ(op, a, b) {
  nt(a); nt(b);
  if (!dZero(a.d) || !dZero(b.d)) failEv();
  if (!a.v.isInteger() || !b.v.isInteger() || a.v.isNeg() || b.v.isNeg()) failEv();
  if (b.v.gt(a.v) || a.v.gt(1e6)) failEv();
  const n = a.v.toNumber(), r = b.v.toNumber();
  let res = new D(1);
  if (op === 'nPr') {
    if (r > 3000) failEv();
    for (let i = 0; i < r; i++) res = res.times(n - i);
  } else {
    const k = Math.min(r, n - r);
    if (k > 3000) failEv();
    for (let i = 1; i <= k; i++) res = res.times(n - k + i).div(i);
    res = res.toDecimalPlaces(0, RM);
  }
  return chk(Q(res));
}
function powQ(a, b) {
  nt(a); nt(b);
  if (!dZero(b.d)) failEv();
  const x = a.v, y = b.v;
  if (y.abs().gt(MAX_EXP10)) failEv();
  if (!y.isInteger() && x.isNeg()) failEv();
  if (x.isZero() && y.isNeg()) failEv();
  if (!x.isZero()) {
    // size estimate with a cheap low-precision log (D.log10 would hit the ~1025-digit limit)
    const est = y.toNumber() * lg10(x);
    if (est > MAX_EXP10) failEv();
  }
  const dims = a.d.map(c => { const m = y.times(c); if (!m.isInteger()) failEv(); return m.toNumber(); });
  // integer powers are exact at any precision; fractional ones use ln / exp
  const r = y.isInteger() ? x.pow(y) : capPrecision(MAX_PREC, () => x.pow(y));
  return chk(Q(r, dims, uScale(a.us, y.toNumber())));
}
function trigArg(q, ctx) {
  const PI = piNow();
  nt(q);
  if (dZero(q.d)) {
    ctx.bare = true;
    return ctx.mode === 'deg' ? q.v.times(PI).div(180) : q.v;
  }
  if (dEq(q.d, ANGLE)) return q.v;
  return failEv();
}
function fwdTrig(fn, x) {
  let r;
  switch (fn) {
    case 'sin': r = x.sin(); break;
    case 'cos': r = x.cos(); break;
    case 'tan': r = x.tan(); break;
    case 'csc': r = new D(1).div(x.sin()); break;
    case 'sec': r = new D(1).div(x.cos()); break;
    case 'cot': r = x.cos().div(x.sin()); break;
  }
  if (!r.isFinite() || r.abs().gt(1e15)) failEv();
  return r;
}
function invTrig(fn, x, mode) {
  const PI = piNow();
  const clamp = (v) => {
    const a = v.abs();
    if (a.gt(1)) { if (a.minus(1).lt('1e-30')) return new D(v.isNeg() ? -1 : 1); failEv(); }
    return v;
  };
  const clampOut = (v) => {
    const a = v.abs();
    if (a.lt(1)) { if (new D(1).minus(a).lt('1e-30')) return new D(v.isNeg() ? -1 : 1); failEv(); }
    return v;
  };
  let r;
  switch (fn) {
    case 'sin': r = clamp(x).asin(); break;
    case 'cos': r = clamp(x).acos(); break;
    case 'tan': r = x.atan(); break;
    case 'csc': r = clamp(new D(1).div(clampOut(x))).asin(); break;
    case 'sec': r = clamp(new D(1).div(clampOut(x))).acos(); break;
    case 'cot': r = PI.div(2).minus(x.atan()); break;
  }
  if (mode === 'deg') r = r.times(180).div(PI);
  return r;
}
function callQ(n, q) {
  nt(q);
  const fn = n.fn;
  if (fn === 'sqrt' || fn === 'cbrt') {
    const div = fn === 'sqrt' ? 2 : 3;
    if (fn === 'sqrt' && q.v.isNeg()) failEv();
    const dims = q.d.map(c => { if (c % div !== 0) failEv(); return c / div; });
    return chk(Q(fn === 'sqrt' ? q.v.sqrt() : q.v.cbrt(), dims, uScale(q.us, 1 / div)));
  }
  if (!dZero(q.d)) failEv();
  const x = q.v;
  if (x.isNeg() || x.isZero()) failEv();
  if (fn === 'ln') return chk(Q(capPrecision(MAX_PREC, () => x.ln())));
  const base = n.base ? new D(n.base) : new D(10);
  if (base.lte(0) || base.eq(1)) failEv();
  return chk(Q(capPrecision(MAX_PREC, () => x.log(base))));
}
const pickOu = (n, ctx) => n.rd[(ctx.pick && ctx.pick.get(n)) || 0].ou;

function ev(n, ctx) {
  switch (n.k) {
    case 'num': return chk(Q(new D(n.v)));
    case 'const': return Q(n.name === 'pi' ? piNow() : eNow());
    case 'unit': {
      const ou = pickOu(n, ctx), pw = n.pw;
      return Q(ou.f.pow(pw), ou.dims.map(c => c * pw), [{ [ou.sym]: { ou, e: pw } }]);
    }
    case 'paren': return ev(n.a, ctx);
    case 'neg': {
      const q = ev(n.a, ctx);
      if (q.t) return tempMake(q.t.x.neg(), q.t.ou);
      return Q(q.v.neg(), q.d, q.us);
    }
    case 'pct': { const q = nt(ev(n.a, ctx)); return Q(q.v.div(100), q.d, q.us); }
    case 'fact': return factQ(ev(n.a, ctx));
    case 'comb': return combQ(n.op, ev(n.a, ctx), ev(n.b, ctx));
    case 'pow': return powQ(ev(n.a, ctx), ev(n.b, ctx));
    case 'imul': {
      const a = ev(n.a, ctx), b = ev(n.b, ctx);
      if (n.b.k === 'unit') {
        const ou = pickOu(n.b, ctx);
        if (ou.offset !== undefined && n.b.pw === 1) {          // 20 degC -> absolute temperature
          if (a.t || !dZero(a.d)) failEv();
          return chk(tempMake(a.v, ou));
        }
      }
      nt(a); nt(b);
      return chk(Q(a.v.times(b.v), dAdd(a.d, b.d), uMul(a.us, b.us, 1)));
    }
    case 'bin': {
      const a = ev(n.a, ctx), b = ev(n.b, ctx);
      switch (n.op) {
        case '+': case '-': {
          if (!dEq(a.d, b.d)) failEv();
          if (a.t || b.t) {                                     // temperature: second operand is a delta
            let K, ou;
            if (a.t && b.t) {
              const db = b.t.x.times(b.t.ou.f);
              K = n.op === '+' ? a.v.plus(db) : a.v.minus(db);
              ou = a.t.ou;
            } else if (a.t) {
              K = n.op === '+' ? a.v.plus(b.v) : a.v.minus(b.v);
              ou = a.t.ou;
            } else {
              if (n.op === '-') failEv();
              K = a.v.plus(b.v);
              ou = b.t.ou;
            }
            return chk(Q(K, TH_D, [{ [ou.sym]: { ou, e: 1 } }], { ou, x: tempX(ou, K) }));
          }
          return chk(Q(n.op === '+' ? a.v.plus(b.v) : a.v.minus(b.v), a.d, uAdd(a.us, b.us)));
        }
        case '*':
          nt(a); nt(b);
          return chk(Q(a.v.times(b.v), dAdd(a.d, b.d), uMul(a.us, b.us, 1)));
        case '/':
          nt(a); nt(b);
          if (b.v.isZero()) failEv();
          return chk(Q(a.v.div(b.v), dSub(a.d, b.d), uMul(a.us, b.us, -1)));
        case '%':
          nt(a); nt(b);
          if (!(dEq(a.d, b.d) && !b.v.isZero())) failEv();
          return chk(Q(a.v.mod(b.v), a.d, a.us));
      }
      return failEv();
    }
    case 'call': return callQ(n, ev(n.arg, ctx));
    case 'trig': {
      const q = ev(n.arg, ctx);
      let r;
      if (n.inv) {
        ctx.bare = true;
        nt(q);
        if (!dZero(q.d)) failEv();
        r = invTrig(n.fn, q.v, ctx.mode);
      } else r = fwdTrig(n.fn, trigArg(q, ctx));
      let out = Q(r);
      if (n.power) out = powQ(out, Q(new D(n.power.v)));
      return chk(out);
    }
  }
  return failEv();
}

// -> [{q, tag}] (several when radians / degrees are both plausible) or null
export function evaluateAst(ast, pick) {
  const run = (mode) => {
    const ctx = { mode, bare: false, pick };
    let q = null;
    try { q = ev(ast, ctx); } catch (e) { q = null; }
    return { q, ctx };
  };
  const r1 = run('rad');
  if (!r1.ctx.bare) return r1.q ? [{ q: r1.q, tag: null }] : null;
  const r2 = run('deg');
  const out = [];
  if (r1.q) out.push({ q: r1.q, tag: 'rad' });
  if (r2.q) out.push({ q: r2.q, tag: 'deg' });
  return out.length ? out : null;
}
