// Parser (precedence climbing, no eval) + AST helpers
import { MAX_DEPTH } from './numeric.js';
import { resolveUnitWord } from './units.js';
import { tokenize, FUNCS, SUPMAP } from './tokenizer.js';

const SYN = { syntax: true };

function idKind(t) {
  if (t.trig) return 'trig';
  const lw = t.v.toLowerCase();
  if (t.v === 'e' || lw === 'pi' || t.v === '\u03c0') return 'const';
  if (FUNCS.has(lw)) return 'func';
  if (lw === 'npr' || lw === 'ncr') return 'comb';
  if (t.v === 'P' || t.v === 'C') return 'pc';
  if (resolveUnitWord(t.v)) return 'unit';
  return null;
}

function parseTokens(toks) {
  let p = 0, depth = 0;
  const peek = () => toks[p];
  const isOp = (t, v) => !!t && t.t === 'op' && t.v === v;
  const fail = () => { throw SYN; };
  const enter = () => { if (++depth > MAX_DEPTH) fail(); };
  const leave = () => { depth--; };

  function startsOperand(i, forPct) {
    const t = toks[i];
    if (!t) return false;
    if (t.t === 'num') return true;
    if (t.t === 'op') return t.v === '(';
    if (t.t === 'id') {
      const k = idKind(t);
      if (k === 'const' || k === 'func' || k === 'trig' || k === 'unit') return true;
      if (k === 'pc') return isOp(toks[i + 1], '(');
      if (k === 'comb') return !!forPct && isOp(toks[i + 1], '(');
    }
    return false;
  }
  const canJuxt = (i) => { const t = toks[i]; return !!t && t.t !== 'num' && startsOperand(i, false); };

  function parseAdd() {
    enter();
    let a = parseMul();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = toks[p++].v;
      const b = parseMul();
      a = { k: 'bin', op, a, b };
    }
    leave();
    return a;
  }
  function parseMul() {
    let a = parseCombo();
    for (;;) {
      const t = peek();
      if (isOp(t, '*') || isOp(t, '/') || isOp(t, '%')) {
        p++;
        const b = parseCombo();
        a = { k: 'bin', op: t.v, a, b };
      } else break;
    }
    return a;
  }
  function parseCombo() {
    let a = parseImplicit();
    for (;;) {
      const t = peek();
      if (t && t.t === 'id' && idKind(t) === 'comb') {
        p++;
        const b = parseImplicit();
        a = { k: 'comb', op: t.v.toLowerCase() === 'npr' ? 'nPr' : 'nCr', a, b, infix: true };
      } else break;
    }
    return a;
  }
  function parseImplicit() {
    let a = parseUnary();
    while (canJuxt(p)) {
      const b = parseUnary();
      a = { k: 'imul', a, b };
    }
    return a;
  }
  function parseUnary() {
    if (isOp(peek(), '-')) {
      p++; enter();
      const a = parseUnary();
      leave();
      return { k: 'neg', a };
    }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (isOp(peek(), '^')) {
      p++; enter();
      const ex = parseUnary();
      leave();
      return { k: 'pow', a: base, b: ex };
    }
    return base;
  }
  function parsePostfix() {
    let a = parsePrimary();
    for (;;) {
      const t = peek();
      if (isOp(t, '!')) { p++; a = { k: 'fact', a }; continue; }
      if (isOp(t, '%') && !startsOperand(p + 1, true)) { p++; a = { k: 'pct', a }; continue; }
      break;
    }
    return a;
  }
  function parseParen() {
    p++;
    const e = parseAdd();
    if (!isOp(peek(), ')')) fail();
    p++;
    return { k: 'paren', a: e };
  }
  function parseArgument() {
    if (isOp(peek(), '(')) return parseParen();
    return parseImplicit();
  }
  function parsePrimary() {
    const t = peek();
    if (!t) fail();
    if (t.t === 'num') { p++; return { k: 'num', v: t.v, sci: t.sci }; }
    if (isOp(t, '(')) return parseParen();
    if (t.t !== 'id') fail();
    const kind = idKind(t);
    const lw = t.v.toLowerCase();
    if (kind === 'const') { p++; return { k: 'const', name: (t.v === 'e') ? 'e' : 'pi' }; }
    if (kind === 'unit') {
      p++;
      const ur = resolveUnitWord(t.v);
      return { k: 'unit', rd: ur.rds, folded: ur.folded, long: ur.long, pw: t.pw || 1, s: t.s, e: t.e, word: t.v };
    }
    if (kind === 'func') {
      p++;
      const arg = parseArgument();
      return { k: 'call', fn: lw, base: t.base || null, arg };
    }
    if (kind === 'trig') {
      p++;
      const ti = t.trig;
      let power = null, arg;
      if (t.glue) {
        if (startsOperand(p, false)) { power = { k: 'num', v: t.glue }; arg = parseArgument(); }
        else arg = { k: 'num', v: t.glue };
      } else if (isOp(peek(), '^') && !ti.inv) {
        p++;
        let neg = false;
        if (isOp(peek(), '-')) { neg = true; p++; }
        const nt = peek();
        if (!nt || nt.t !== 'num') fail();
        p++;
        power = { k: 'num', v: (neg ? '-' : '') + nt.v };
        arg = parseArgument();
      } else arg = parseArgument();
      return { k: 'trig', fn: ti.fn, inv: ti.inv, power, arg };
    }
    if (kind === 'pc' || kind === 'comb') {
      p++;
      if (!isOp(peek(), '(')) fail();
      p++;
      const a = parseAdd();
      if (!isOp(peek(), ',')) fail();
      p++;
      const b = parseAdd();
      if (!isOp(peek(), ')')) fail();
      p++;
      const op = (kind === 'comb' ? lw === 'npr' : t.v === 'P') ? 'nPr' : 'nCr';
      return { k: 'comb', op, a, b, infix: false };
    }
    fail();
  }

  try {
    const ast = parseAdd();
    if (p !== toks.length) return null;
    return ast;
  } catch (e) { return null; }
}

export function parseText(text, mode) {
  const src = text.replace(/\u2212/g, '-').replace(/\u00d7/g, '*').replace(/\u00f7/g, '/').replace(/\u2126/g, '\u03a9');
  const tk = tokenize(src, mode);
  if (!tk) return null;
  return { ast: parseTokens(tk.toks), amb: tk.amb };
}

export function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  fn(n);
  for (const k of ['a', 'b', 'arg', 'power']) if (n[k] && typeof n[k] === 'object') walk(n[k], fn);
}
export function collectUnits(ast) { const o = []; walk(ast, n => { if (n.k === 'unit') o.push(n); }); return o; }

function sup(s) { return String(s).replace(/-/g, '\u207b').replace(/\d/g, d => SUPMAP[+d]); }
export function show(n) {
  switch (n.k) {
    case 'num':
      if (n.sci) return (n.sci.m === '1' ? '10' : n.sci.m + '\u00b710') + sup(n.sci.e);
      return n.v;
    case 'const': return n.name === 'pi' ? '\u03c0' : 'e';
    case 'unit': return n.word + (n.pw > 1 ? '^' + n.pw : '');
    case 'paren': return '(' + show(n.a) + ')';
    case 'neg': return '\u2212' + show(n.a);
    case 'bin': {
      const o = n.op === '-' ? '\u2212' : n.op === '*' ? '\u00d7' : n.op;
      return show(n.a) + ' ' + o + ' ' + show(n.b);
    }
    case 'imul': return show(n.a) + '\u00b7' + show(n.b);
    case 'pow': return show(n.a) + '^' + show(n.b);
    case 'fact': return show(n.a) + '!';
    case 'pct': return show(n.a) + '%';
    case 'comb': return n.infix ? show(n.a) + ' ' + n.op + ' ' + show(n.b) : n.op + '(' + show(n.a) + ', ' + show(n.b) + ')';
    case 'call': return n.fn + (n.base || '') + (n.arg.k === 'paren' ? show(n.arg) : '(' + show(n.arg) + ')');
    case 'trig': {
      const name = (n.inv ? 'arc' : '') + n.fn + (n.power ? '^' + n.power.v : '');
      return name + (n.arg.k === 'paren' ? show(n.arg) : '(' + show(n.arg) + ')');
    }
  }
  return '?';
}
export function isLone(n) {
  switch (n.k) {
    case 'num': return true;
    case 'paren': case 'neg': case 'pct': return isLone(n.a);
  }
  return false;
}
// quantity made only of numbers, units, * / ^ -> {nums}
export function bareInfo(root) {
  let nums = 0, units = 0, ok = true;
  (function w(n) {
    switch (n.k) {
      case 'num': nums++; break;
      case 'unit': units++; break;
      case 'paren': case 'neg': w(n.a); break;
      case 'imul': w(n.a); w(n.b); break;
      case 'bin': if (n.op === '*' || n.op === '/') { w(n.a); w(n.b); } else ok = false; break;
      case 'pow':
        w(n.a);
        if (!(n.b.k === 'num' || (n.b.k === 'neg' && n.b.a.k === 'num'))) ok = false;
        break;
      default: ok = false;
    }
  })(root);
  return ok && units > 0 ? { nums } : null;
}
// expression built only from numbers, arithmetic and constants (pi, e), with at least one constant
export function isConstExpr(root) {
  let consts = 0, ok = true;
  (function w(n) {
    switch (n.k) {
      case 'num': break;
      case 'const': consts++; break;
      case 'paren': case 'neg': w(n.a); break;
      case 'imul': case 'bin': case 'pow': w(n.a); w(n.b); break;
      default: ok = false;
    }
  })(root);
  return ok && consts > 0;
}
