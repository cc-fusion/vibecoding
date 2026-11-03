// ── Math engine: tokenizer + parser + arbitrary-precision evaluator ─────────
import Decimal from "decimal.js";
import { isDimensionless } from "./units.js";

const FUNCS = new Set(["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","ln","log","log2","exp","sqrt","cbrt","abs","floor","ceil","round"]);
const TRIG = new Set(["sin","cos","tan","asin","acos","atan"]);
const CONSTS = new Set(["pi","tau","e","phi"]);
const SUP = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"-" };

let piCache = { prec: 0, str: "" };

function ensurePi(minPrec) {
  if (piCache.prec >= minPrec) return;
  // compute in chunks so progressive typing doesn't recompute every keystroke
  const P = Math.max(Math.ceil(minPrec / 256) * 256, 256);
  const saved = Decimal.precision;
  Decimal.set({ precision: P + 10 });
  try {
    const atanInv = (n) => { // atan(1/n) via Taylor series (Machin)
      const x = new Decimal(1).div(n);
      const x2 = x.times(x).neg();
      let term = x, sum = x, k = 1;
      const eps = new Decimal("1e-" + (P + 5));
      while (true) {
        term = term.times(x2);
        const add = term.div(2 * k + 1);
        sum = sum.plus(add);
        if (add.abs().lt(eps) || k > 40000) break;
        k++;
      }
      return sum;
    };
    piCache = { prec: P, str: atanInv(5).times(16).minus(atanInv(239).times(4)).toString() };
  } finally {
    Decimal.set({ precision: saved });
  }
}
const PI = () => new Decimal(piCache.str);

function seriesSinCos(x, cos) {
  const P = Decimal.precision;
  const eps = new Decimal("1e-" + (P - 4));
  const x2 = x.times(x).neg();
  let term = cos ? new Decimal(1) : x;
  let sum = term;
  let k = cos ? 0 : 1;
  while (true) {
    const a = cos ? (2 * k + 1) * (2 * k + 2) : (2 * k) * (2 * k + 1);
    term = term.times(x2).div(a);
    sum = sum.plus(term);
    if (term.abs().lt(eps) || k > 30000) break;
    k++;
  }
  return sum;
}

function atanD(x) {
  const neg = x.isNegative();
  let v = x.abs();
  let invert = false;
  if (v.gt(1)) { v = new Decimal(1).div(v); invert = true; }
  let k = 0;
  while (v.gt("0.08")) { // half-angle reduction: atan(v) = 2 atan(v / (1+√(1+v²)))
    v = v.div(new Decimal(1).plus(new Decimal(1).plus(v.times(v)).sqrt()));
    k++;
  }
  const P = Decimal.precision;
  const eps = new Decimal("1e-" + (P - 4));
  const x2 = v.times(v).neg();
  let term = v, sum = v, n = 1;
  while (true) {
    term = term.times(x2);
    const add = term.div(2 * n + 1);
    sum = sum.plus(add);
    if (add.abs().lt(eps) || n > 30000) break;
    n++;
  }
  sum = sum.times(new Decimal(2).pow(k));
  if (invert) sum = PI().div(2).minus(sum);
  return neg ? sum.neg() : sum;
}

function callFn(name, q, angle) {
  const v = q.v;
  const toRad = (x) => (angle === "deg" && !q.tagged ? x.times(PI()).div(180) : x);
  const fromRad = (x) => (angle === "deg" && !q.tagged ? x.times(180).div(PI()) : x);
  switch (name) {
    case "sin": { ensurePi(Decimal.precision); const x = toRad(v); const twoPi = PI().times(2); const r = x.minus(twoPi.times(x.div(twoPi).round())); return seriesSinCos(r, false); }
    case "cos": { ensurePi(Decimal.precision); const x = toRad(v); const twoPi = PI().times(2); const r = x.minus(twoPi.times(x.div(twoPi).round())); return seriesSinCos(r, true); }
    case "tan": { ensurePi(Decimal.precision); const x = toRad(v); const twoPi = PI().times(2); const r = x.minus(twoPi.times(x.div(twoPi).round())); const c = seriesSinCos(r, true); if (c.isZero()) throw new Error("tan undefined"); return seriesSinCos(r, false).div(c); }
    case "asin": { if (v.abs().gt(1)) throw new Error("asin domain"); ensurePi(Decimal.precision); if (v.abs().eq(1)) return fromRad(PI().div(2).times(v.isNegative() ? -1 : 1)); return fromRad(atanD(v.div(new Decimal(1).minus(v.times(v)).sqrt()))); }
    case "acos": { if (v.abs().gt(1)) throw new Error("acos domain"); ensurePi(Decimal.precision); const t = v.abs().eq(1) ? (v.isNegative() ? PI().div(2) : new Decimal(0)) : atanD(v.div(new Decimal(1).minus(v.times(v)).sqrt())); return fromRad(PI().div(2).minus(t)); }
    case "atan": { ensurePi(Decimal.precision); return fromRad(atanD(v)); }
    case "sinh": { const ex = v.exp(); return ex.minus(new Decimal(1).div(ex)).div(2); }
    case "cosh": { const ex = v.exp(); return ex.plus(new Decimal(1).div(ex)).div(2); }
    case "tanh": { const e2 = v.times(2).exp(); return e2.minus(1).div(e2.plus(1)); }
    case "ln": return v.ln();
    case "log": return v.ln().div(new Decimal(10).ln());
    case "log2": return v.ln().div(new Decimal(2).ln());
    case "exp": return v.exp();
    case "sqrt": return v.sqrt();
    case "cbrt": return v.isNegative() ? v.abs().pow(new Decimal(1).div(3)).neg() : v.pow(new Decimal(1).div(3));
    case "abs": return v.abs();
    case "floor": return v.floor();
    case "ceil": return v.ceil();
    case "round": return v.round();
    default: throw new Error("unknown function " + name);
  }
}

// ── tokenizer ────────────────────────────────────────────────────────────────
export function tokenize(srcRaw) {
  const src = srcRaw
    .replace(/π/g, " pi ").replace(/√/g, " sqrt ").replace(/°/g, " deg ")
    .replace(/[·×]/g, "*").replace(/÷/g, "/").replace(/→/g, "->").replace(/μ/g, "µ")
    .replace(/−/g, "-");
  const toks = [];
  let i = 0;
  const numRe = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
  const idRe = /^[a-zA-ZµΩ]+/;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = src.slice(i);
    const gapAfter = (end) => { const m = /^\s*/.exec(src.slice(end)); return m ? m[0] : ""; };
    let m;
    if ((m = numRe.exec(rest))) {
      const raw = m[0];
      const [mant, expPart] = raw.split(/[eE]/);
      const fracLen = mant.includes(".") ? mant.split(".")[1].length : 0;
      const decimals = Math.max(0, fracLen - (expPart ? parseInt(expPart, 10) : 0));
      toks.push({ t: "num", v: raw, decimals, pos: i, end: i + raw.length, gap: gapAfter(i + raw.length) });
      i += raw.length; continue;
    }
    if ((m = idRe.exec(rest))) {
      let word = m[0];
      let end = i + word.length;
      let exp = null;
      if (!FUNCS.has(word)) {
        const em = /^-?\d+/.exec(src.slice(end));
        if (em) { exp = parseInt(em[0], 10); end += em[0].length; }
        else {
          const sm = /^[⁰¹²³⁴⁵⁶⁸⁹⁻]+/.exec(src.slice(end));
          if (sm) { exp = parseInt([...sm[0]].map((c) => SUP[c]).join(""), 10); end += sm[0].length; }
        }
      }
      toks.push({ t: "id", v: word, exp, pos: i, end, gap: gapAfter(end) });
      i = end; continue;
    }
    let matched = false;
    for (const op of ["**", "->", "+", "-", "*", "/", "^", "(", ")", "="]) {
      if (rest.startsWith(op)) {
        toks.push({ t: op === "(" ? "(" : op === ")" ? ")" : "op", v: op, pos: i, end: i + op.length, gap: gapAfter(i + op.length) });
        i += op.length; matched = true; break;
      }
    }
    if (matched) continue;
    throw new Error(`unexpected character "${ch}"`);
  }
  return { toks, src };
}

// ── quantity helpers ─────────────────────────────────────────────────────────
const Q = (v, d = [0,0,0,0,0,0,0], extra = {}) => ({ v, d, tagged: false, ...extra });
const dAdd = (a, b, s = 1) => a.map((x, i) => x + s * b[i]);

// ── evaluator ───────────────────────────────────────────────────────────────
export function evaluate(srcRaw, { engine, angle = "rad", precision = 60 } = {}) {
  const savedPrec = Decimal.precision;
  const savedRound = Decimal.rounding;
  Decimal.set({ precision: precision + 15, rounding: Decimal.ROUND_HALF_EVEN });
  try {
    return evaluateInner(srcRaw, engine, angle, precision);
  } finally {
    Decimal.set({ precision: savedPrec, rounding: savedRound });
  }
}

function evaluateInner(srcRaw, engine, angle, precision) {
  const { toks, src } = tokenize(srcRaw);
  if (!toks.length) throw new Error("empty expression");

  const ctx = {
    maxLitDec: 0, hasNum: false, hasUnit: false, hasConst: false, hasFn: false,
    hasTrig: false, hasBinOp: false, hasConv: false, hasJuxt: false, styles: {},
  };

  // split conversion at last top-level `to` / `->`
  let depth = 0, convIdx = -1;
  toks.forEach((t, idx) => {
    if (t.t === "(") depth++;
    else if (t.t === ")") depth--;
    else if (depth === 0 && ((t.t === "id" && t.v === "to") || (t.t === "op" && t.v === "->"))) convIdx = idx;
  });
  let lhsToks = toks, rhsToks = null;
  if (convIdx >= 0) { lhsToks = toks.slice(0, convIdx); rhsToks = toks.slice(convIdx + 1); ctx.hasConv = true; }

  const unitOf = (word) => {
    const def = engine.lookup(word);
    return def;
  };

  function parseTokens(tokens, { unitsOnly = false } = {}) {
    let p = 0;
    const peek = () => tokens[p];
    const next = () => tokens[p++];

    function parseExpr(minPrec) {
      let left = parseUnary();
      while (true) {
        const t = peek();
        if (!t || t.t !== "op" || !["+","-","*","/","**","^"].includes(t.v)) break;
        const op = t.v;
        const prec = op === "+" || op === "-" ? 1 : op === "*" || op === "/" ? 2 : 3;
        const rightAssoc = prec === 3;
        if (prec < minPrec) break;
        next();
        if (op !== "**" && op !== "^") ctx.hasBinOp = true;
        const right = parseExpr(rightAssoc ? prec : prec + 1);
        left = apply(op, left, right);
      }
      return left;
    }

    function parseUnary() {
      const t = peek();
      if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
        next();
        const v = parseUnary();
        return t.v === "-" ? Q(v.v.neg(), v.d, { tagged: v.tagged }) : v;
      }
      // juxtaposition (implicit multiplication) binds tighter than × ÷
      let left = parsePower();
      while (true) {
        const n = peek();
        if (!n || (n.t !== "id" && n.t !== "(")) break;
        ctx.hasJuxt = true;
        left = mul(left, parsePower());
      }
      return left;
    }

    function parsePower() {
      const base = parsePrimary();
      const t = peek();
      if (t && t.t === "op" && (t.v === "**" || t.v === "^")) {
        next();
        const exp = parseExponent();
        return pow(base, exp, "**");
      }
      return base;
    }

    // exponent operand: signs + power, but no juxtaposition (10**-6 kg → (10^-6)·kg)
    function parseExponent() {
      const t = peek();
      if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
        next();
        const v = parseExponent();
        return t.v === "-" ? Q(v.v.neg(), v.d, { tagged: v.tagged }) : v;
      }
      return parsePower();
    }

    function parsePrimary() {
      const t = next();
      if (!t) throw new Error("unexpected end");
      if (t.t === "num") {
        if (unitsOnly) throw new Error("number in unit target");
        ctx.hasNum = true;
        ctx.maxLitDec = Math.max(ctx.maxLitDec, t.decimals);
        return Q(new Decimal(t.v));
      }
      if (t.t === "(") {
        const inner = parseExpr(1);
        const close = next();
        if (!close || close.t !== ")") throw new Error("missing )");
        return inner;
      }
      if (t.t === "id") {
        const word = t.v;
        if (FUNCS.has(word)) {
          ctx.hasFn = true;
          if (TRIG.has(word)) ctx.hasTrig = true;
          let arg;
          if (peek() && peek().t === "(") { next(); arg = parseExpr(1); const c = next(); if (!c || c.t !== ")") throw new Error("missing )"); }
          else arg = parseUnary();
          if (!isDimensionless(arg.d)) throw new Error("function needs dimensionless argument");
          const val = callFn(word, arg, angle);
          if (word === "sqrt" || word === "cbrt" || word === "abs") return Q(val);
          return Q(val);
        }
        if (CONSTS.has(word)) {
          ctx.hasConst = true;
          ensurePi(Decimal.precision);
          let v = word === "pi" ? PI() : word === "tau" ? PI().times(2) : word === "e" ? new Decimal(1).exp() : PI().times(0).plus(new Decimal(5).sqrt().plus(1).div(2));
          let q = Q(v);
          if (t.exp != null) q = pow(q, Q(new Decimal(t.exp)), "");
          return q;
        }
        if (word === "deg" || word === "rad") {
          ensurePi(Decimal.precision);
          ctx.hasUnit = true;
          const q = Q(word === "deg" ? PI().div(180) : new Decimal(1));
          q.tagged = true;
          return q;
        }
        const def = unitOf(word);
        if (def) {
          ctx.hasUnit = true;
          let q = Q(def.coefDec, def.dims.slice(), { sym: word });
          if (t.exp != null) q = pow(q, Q(new Decimal(t.exp)), "");
          return q;
        }
        throw new Error(`unknown identifier "${word}"`);
      }
      throw new Error(`unexpected token "${t.v}"`);
    }

    function mul(a, b) { return Q(a.v.times(b.v), dAdd(a.d, b.d), { tagged: a.tagged || b.tagged }); }
    function apply(op, a, b) {
      switch (op) {
        case "+": case "-":
          if (dimsKeyLocal(a.d) !== dimsKeyLocal(b.d)) throw new Error("dimension mismatch");
          return Q(op === "+" ? a.v.plus(b.v) : a.v.minus(b.v), a.d, { tagged: a.tagged || b.tagged });
        case "*": return mul(a, b);
        case "/": return Q(a.v.div(b.v), dAdd(a.d, b.d, -1), { tagged: a.tagged || b.tagged });
        case "**": case "^": return pow(a, b, op === "**" ? "**" : "^");
      }
      throw new Error("bad op");
    }
    function pow(a, b, style) {
      if (!isDimensionless(b.d)) throw new Error("exponent must be dimensionless");
      if (a.sym) ctx.styles[a.sym] = ctx.styles[a.sym] === "**" || style === "**" ? "**" : "";
      if (!isDimensionless(a.d)) {
        if (!b.v.isInteger() || b.v.abs().gt(24)) throw new Error("unit exponent must be a small integer");
        const n = b.v.toNumber();
        return Q(a.v.pow(n), a.d.map((x) => x * n), { sym: n === 1 ? a.sym : undefined });
      }
      ctx.hasBinOp = true;
      return Q(a.v.pow(b.v));
    }

    const out = parseExpr(1);
    if (p !== tokens.length) throw new Error("trailing tokens");
    return out;
  }

  const dimsKeyLocal = (d) => d.join(",");
  const lhs = parseTokens(lhsToks);
  let result = { value: lhs.v, siValue: lhs.v, dims: lhs.d, target: null };

  if (rhsToks) {
    if (!rhsToks.length) throw new Error("missing conversion target");
    const rhs = parseTokens(rhsToks, { unitsOnly: true });
    if (isDimensionless(rhs.d)) throw new Error("conversion target needs units");
    if (dimsKeyLocal(lhs.d) !== dimsKeyLocal(rhs.d)) throw new Error("incompatible conversion");
    const label = src.slice(rhsToks[0].pos, rhsToks[rhsToks.length - 1].end).trim();
    result = { value: lhs.v.div(rhs.v), siValue: lhs.v, dims: lhs.d, target: { label } };
  }

  if (!result.value.isFinite()) throw new Error("non-finite result");

  // metadata for presentation
  let firstQty = null, lastGap = null;
  for (let i = 0; i < lhsToks.length; i++) {
    const t = lhsToks[i], n = lhsToks[i + 1];
    if (!firstQty && t.t === "num" && n && n.t === "id" && !FUNCS.has(n.v) && !CONSTS.has(n.v) && n.v !== "deg" && n.v !== "rad" && unitOf(n.v)) {
      firstQty = { sym: n.v, gap: t.gap };
    }
    const prev = lhsToks[i - 1];
    const isValueTok = (x) => x && (x.t === "num" || x.t === "id" || x.t === ")");
    if (t.t === "op" && ["+","-","*","/","**","^"].includes(t.v) && isValueTok(prev)) lastGap = t.gap;
  }
  if (convIdx >= 0) lastGap = toks[convIdx].gap;

  const worthy = ctx.hasBinOp || ctx.hasFn || ctx.hasConst || ctx.hasConv || ctx.hasJuxt || (ctx.hasNum && ctx.hasUnit);
  return { ...result, maxLitDec: ctx.maxLitDec, firstQty, lastGap, styles: ctx.styles, worthy, hasTrig: ctx.hasTrig };
}