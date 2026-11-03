import Decimal from 'decimal.js';
import { isZeroDims } from './units.js';

Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
  minE: -9e15,
  maxE: 9e15,
});

export class SyntaxErr extends Error {}
export class SemErr extends Error {}

export const MAX_PI_PRECISION = 1025;

const NUM_RE = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ID_RE = /[A-Za-z\u00B5\u03BC\u03A9\u2126\u00B0\u03C0\u03C4_][A-Za-z0-9\u00B5\u03BC\u03A9\u2126\u00B0\u03C0\u03C4_]*/y;

export const FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'sqrt', 'cbrt', 'abs', 'ln', 'log', 'log10', 'log2', 'exp', 'floor', 'ceil', 'round',
]);
export const CONSTS = { pi: 'pi', '\u03C0': 'pi', e: 'e', tau: 'tau', '\u03C4': 'tau' };

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      toks.push({ t: 'num', v: m[0], s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    ID_RE.lastIndex = i;
    const idm = ID_RE.exec(src);
    if (idm) {
      toks.push({ t: 'id', v: idm[0], s: i, e: i + idm[0].length });
      i += idm[0].length;
      continue;
    }
    if (src.startsWith('**', i)) { toks.push({ t: 'op', v: '**', s: i, e: i + 2 }); i += 2; continue; }
    if (src.startsWith('->', i)) { toks.push({ t: 'op', v: '->', s: i, e: i + 2 }); i += 2; continue; }
    if ('+-*/^!\u00D7\u00F7\u00B7'.includes(c)) { toks.push({ t: 'op', v: c, s: i, e: i + 1 }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp', v: c, s: i, e: i + 1 }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp', v: c, s: i, e: i + 1 }); i++; continue; }
    throw new SyntaxErr(`Unexpected character "${c}"`);
  }
  return toks;
}

const isOp = (tok, ...vs) => !!tok && tok.t === 'op' && vs.includes(tok.v);

class Parser {
  constructor(toks, src, reg) {
    this.t = toks;
    this.i = 0;
    this.src = src;
    this.reg = reg;
    this.meta = { ops: [], litDec: 0, expStyle: null, units: [] };
  }
  peek(o = 0) { return this.t[this.i + o]; }
  next() { return this.t[this.i++]; }

  parseTop() {
    if (!this.t.length) throw new SyntaxErr('Empty');
    let node = this.parseExpr();
    const m = this.peek();
    if (isOp(m, '->') || (m && m.t === 'id' && m.v === 'to')) {
      this.next();
      const startTok = this.peek();
      if (!startTok) throw new SyntaxErr('Missing target unit');
      this.meta.ops.push({ tok: m, after: startTok });
      const target = this.parseExpr();
      const last = this.t[this.t.length - 1];
      node = { k: 'conv', e: node, target, targetText: this.src.slice(startTok.s, last.e), unitStart: startTok.s };
    }
    if (this.i < this.t.length) throw new SyntaxErr('Unexpected token');
    return { ast: node, meta: this.meta, text: this.src };
  }

  parseExpr() {
    let l = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (isOp(t, '+', '-')) {
        this.next();
        if (!this.peek()) throw new SyntaxErr('Dangling operator');
        this.meta.ops.push({ tok: t, after: this.peek() });
        const r = this.parseTerm();
        l = { k: 'bin', op: t.v, l, r };
      } else break;
    }
    return l;
  }

  parseTerm() {
    let l = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (isOp(t, '*', '/', '\u00D7', '\u00F7', '\u00B7')) {
        this.next();
        if (!this.peek()) throw new SyntaxErr('Dangling operator');
        this.meta.ops.push({ tok: t, after: this.peek() });
        const r = this.parseUnary();
        const op = t.v === '/' || t.v === '\u00F7' ? '/' : '*';
        l = { k: 'bin', op, l, r };
        continue;
      }
      if (t.t === 'lp' ? l.k !== 'unit' : t.t === 'id' && t.v !== 'to') {
        const r = this.parsePower(false);
        l = { k: 'bin', op: '*', l, r, implicit: true };
        continue;
      }
      break;
    }
    return l;
  }

  parseUnary(noUnit = false) {
    const t = this.peek();
    if (isOp(t, '-', '+')) {
      this.next();
      const e = this.parseUnary(noUnit);
      return t.v === '-' ? { k: 'neg', e } : e;
    }
    return this.parsePower(noUnit);
  }

  parsePower(noUnit) {
    const base = this.parsePostfix(noUnit);
    const t = this.peek();
    if (isOp(t, '^', '**')) {
      this.next();
      if (!this.peek()) throw new SyntaxErr('Dangling operator');
      if (!this.meta.expStyle) this.meta.expStyle = t.v;
      const exp = this.parseUnary(true);
      return { k: 'pow', base, exp };
    }
    return base;
  }

  parsePostfix(noUnit) {
    let e = this.parsePrimary(noUnit);
    while (isOp(this.peek(), '!')) {
      this.next();
      e = { k: 'fact', e };
    }
    return e;
  }

  parsePrimary(noUnit) {
    const t = this.next();
    if (!t) throw new SyntaxErr('Unexpected end');
    if (t.t === 'num') {
      const mant = t.v.split(/[eE]/)[0];
      const dot = mant.indexOf('.');
      if (dot >= 0) this.meta.litDec = Math.max(this.meta.litDec, mant.length - dot - 1);
      const atoms = noUnit ? [] : this.parseUnitTerm();
      return atoms.length ? { k: 'lit', text: t.v, atoms } : { k: 'num', text: t.v };
    }
    if (t.t === 'lp') {
      const e = this.parseExpr();
      const r = this.next();
      if (!r || r.t !== 'rp') throw new SyntaxErr('Missing )');
      return e;
    }
    if (t.t === 'id') {
      if (FUNCS.has(t.v)) {
        let arg;
        if (this.peek() && this.peek().t === 'lp') {
          this.next();
          arg = this.parseExpr();
          const r = this.next();
          if (!r || r.t !== 'rp') throw new SyntaxErr('Missing )');
        } else {
          if (!this.peek()) throw new SyntaxErr('Missing argument');
          arg = this.parseUnary(false);
        }
        return { k: 'call', fn: t.v, arg };
      }
      if (CONSTS[t.v]) return { k: 'const', name: CONSTS[t.v] };
      const u = this.reg.resolve(t.v);
      if (u) {
        this.meta.units.push(u.symbol);
        return { k: 'unit', u };
      }
      throw new SyntaxErr(`Unknown identifier "${t.v}"`);
    }
    throw new SyntaxErr('Unexpected token');
  }

  parseUnitTerm() {
    const atoms = [];
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== 'id') break;
      if (t.v === 'to' || FUNCS.has(t.v) || CONSTS[t.v]) break;
      let u = this.reg.resolve(t.v);
      let exp = null;
      let style = null;
      if (!u) {
        const m = /^(.*[^\d])(\d+)$/.exec(t.v);
        if (m) {
          u = this.reg.resolve(m[1]);
          if (u) { exp = parseInt(m[2], 10); style = 'plain'; }
        }
      }
      if (!u) break;
      this.next();
      if (exp === null) {
        const p = this.peek();
        if (isOp(p, '-') && p.s === t.e) {
          const n = this.peek(1);
          const after = this.peek(2);
          if (n && n.t === 'num' && /^\d+$/.test(n.v) && n.s === p.e && !(after && (after.t === 'id' || after.t === 'num' || after.t === 'lp'))) {
            this.next(); this.next();
            exp = -parseInt(n.v, 10);
            style = 'plain';
          }
        } else if (isOp(p, '^', '**')) {
          let j = 1;
          let sign = 1;
          let q = this.peek(j);
          if (isOp(q, '-')) { sign = -1; j++; q = this.peek(j); }
          else if (isOp(q, '+')) { j++; q = this.peek(j); }
          if (q && q.t === 'num') {
            for (let k = 0; k <= j; k++) this.next();
            exp = sign * Number(q.v);
            style = p.v;
          }
        }
      }
      if (exp === null) exp = 1;
      atoms.push({ u, exp });
      this.meta.units.push(u.symbol);
      if (style && !this.meta.expStyle) this.meta.expStyle = style;
    }
    return atoms;
  }
}

export function parse(src, reg) {
  return new Parser(tokenize(src), src, reg).parseTop();
}

/* ------------------------------ evaluation ------------------------------ */

class Q {
  constructor(v, d, ang = false) {
    this.v = v;
    this.d = d;
    this.ang = ang;
  }
}
const Z = () => [0, 0, 0, 0, 0, 0, 0];
const sameDims = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const cleanDims = (d) => d.map((x) => Math.round(x * 1e6) / 1e6);

function check(v) {
  if (!v.isFinite()) throw new SemErr('Not a finite number');
  return v;
}

function makeCtx(mode, P) {
  const ctx = { mode, P, _pi: null };
  ctx.pi = () => (ctx._pi ||= Decimal.acos(-1));
  return ctx;
}

function dimless(q, what) {
  if (!isZeroDims(q.d)) throw new SemErr(`${what} needs a dimensionless value`);
  return q.v;
}

function ev(n, ctx) {
  switch (n.k) {
    case 'num': return new Q(new Decimal(n.text), Z());
    case 'lit': {
      let v = new Decimal(n.text);
      let d = Z();
      if (n.atoms.length === 1 && n.atoms[0].u.angle && n.atoms[0].exp === 1) {
        const a = n.atoms[0].u.angle;
        return new Q(a === 'deg' ? v.times(ctx.pi()).div(180) : v, Z(), true);
      }
      for (const { u, exp } of n.atoms) {
        if (u.angle) throw new SemErr('Angles cannot be combined with other units');
        v = v.times(Number.isInteger(exp) ? u.factor.pow(exp) : u.factor.pow(new Decimal(exp)));
        d = d.map((x, i) => x + u.dims[i] * exp);
      }
      return new Q(v, cleanDims(d));
    }
    case 'unit': {
      if (n.u.angle) return new Q(n.u.angle === 'deg' ? ctx.pi().div(180) : new Decimal(1), Z(), true);
      return new Q(n.u.factor, n.u.dims.slice());
    }
    case 'const': {
      if (n.name === 'pi') return new Q(ctx.pi(), Z());
      if (n.name === 'tau') return new Q(ctx.pi().times(2), Z());
      return new Q(Decimal.exp(1), Z());
    }
    case 'neg': {
      const a = ev(n.e, ctx);
      return new Q(a.v.neg(), a.d, a.ang);
    }
    case 'bin': {
      const a = ev(n.l, ctx);
      const b = ev(n.r, ctx);
      if (n.op === '+' || n.op === '-') {
        if (!sameDims(a.d, b.d)) throw new SemErr('Dimension mismatch');
        return new Q(check(n.op === '+' ? a.v.plus(b.v) : a.v.minus(b.v)), a.d);
      }
      if (n.op === '*') return new Q(check(a.v.times(b.v)), cleanDims(a.d.map((x, i) => x + b.d[i])));
      if (b.v.isZero()) throw new SemErr('Division by zero');
      return new Q(check(a.v.div(b.v)), cleanDims(a.d.map((x, i) => x - b.d[i])));
    }
    case 'pow': {
      const b = ev(n.base, ctx);
      const e = ev(n.exp, ctx);
      const ev_ = dimless(e, 'Exponent');
      const v = check(b.v.pow(ev_));
      const en = ev_.toNumber();
      return new Q(v, isZeroDims(b.d) ? Z() : cleanDims(b.d.map((x) => x * en)));
    }
    case 'fact': {
      const a = ev(n.e, ctx);
      const x = dimless(a, 'Factorial');
      if (!x.isInteger() || x.isNeg() || x.gt(3000)) throw new SemErr('Invalid factorial');
      let r = new Decimal(1);
      for (let i = 2; i <= x.toNumber(); i++) r = r.times(i);
      return new Q(r, Z());
    }
    case 'call': return call(n.fn, ev(n.arg, ctx), ctx);
    case 'conv': {
      return ev(n.e, ctx);
    }
    default: throw new SemErr('Bad expression');
  }
}

function snap(x, ctx) {
  return x.abs().lt(new Decimal(10).pow(-(ctx.P - 8))) ? new Decimal(0) : x;
}

function call(fn, a, ctx) {
  const radians = (q) => {
    if (q.ang) return q.v;
    const v = dimless(q, fn);
    return ctx.mode === 'deg' ? v.times(ctx.pi()).div(180) : v;
  };
  const fromRad = (r) => (ctx.mode === 'deg' ? r.times(180).div(ctx.pi()) : r);
  switch (fn) {
    case 'sin': return new Q(snap(Decimal.sin(radians(a)), ctx), Z());
    case 'cos': return new Q(snap(Decimal.cos(radians(a)), ctx), Z());
    case 'tan': {
      const r = radians(a);
      if (snap(Decimal.cos(r), ctx).isZero()) throw new SemErr('tan is undefined here');
      return new Q(check(snap(Decimal.tan(r), ctx)), Z());
    }
    case 'asin': return new Q(check(fromRad(Decimal.asin(dimless(a, fn)))), Z());
    case 'acos': return new Q(check(fromRad(Decimal.acos(dimless(a, fn)))), Z());
    case 'atan': return new Q(check(fromRad(Decimal.atan(dimless(a, fn)))), Z());
    case 'sinh': return new Q(check(Decimal.sinh(dimless(a, fn))), Z());
    case 'cosh': return new Q(check(Decimal.cosh(dimless(a, fn))), Z());
    case 'tanh': return new Q(check(Decimal.tanh(dimless(a, fn))), Z());
    case 'ln': return new Q(check(Decimal.ln(dimless(a, fn))), Z());
    case 'log':
    case 'log10': return new Q(check(Decimal.log10(dimless(a, fn))), Z());
    case 'log2': return new Q(check(Decimal.log2(dimless(a, fn))), Z());
    case 'exp': return new Q(check(Decimal.exp(dimless(a, fn))), Z());
    case 'sqrt': return new Q(check(a.v.sqrt()), cleanDims(a.d.map((x) => x / 2)));
    case 'cbrt': return new Q(check(a.v.cbrt()), cleanDims(a.d.map((x) => x / 3)));
    case 'abs': return new Q(a.v.abs(), a.d);
    case 'floor': return new Q(a.v.floor(), a.d);
    case 'ceil': return new Q(a.v.ceil(), a.d);
    case 'round': return new Q(a.v.toDecimalPlaces(0), a.d);
    default: throw new SemErr(`Unknown function ${fn}`);
  }
}

function evalAt(parsed, mode, P) {
  Decimal.set({ precision: P });
  const ctx = makeCtx(mode, P);
  const node = parsed.ast;
  const keep = Math.max(P - 12, 10);
  const fin = (q) => new Q(q.v.toSignificantDigits(keep), q.d, q.ang);
  if (node.k === 'conv') {
    const q = fin(ev(node.e, ctx));
    const t = fin(ev(node.target, ctx));
    return { q, target: t };
  }
  return { q: fin(ev(node, ctx)) };
}

/** Evaluate a parsed expression at precision P (digits). Falls back to the pi limit when needed. */
export function evaluate(parsed, mode, P = 50) {
  try {
    return evalAt(parsed, mode, P);
  } catch (e) {
    if (/precision limit/i.test(String(e && e.message)) && P > MAX_PI_PRECISION) {
      return evalAt(parsed, mode, MAX_PI_PRECISION);
    }
    if (e instanceof SemErr || e instanceof SyntaxErr) throw e;
    throw new SemErr(String(e && e.message));
  }
}

export { Q, sameDims };
