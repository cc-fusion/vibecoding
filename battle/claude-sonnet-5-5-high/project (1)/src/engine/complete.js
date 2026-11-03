import Decimal from 'decimal.js';
import { parse, evaluate, SyntaxErr, sameDims } from './math.js';
import { isZeroDims } from './units.js';

/**
 * complete(text, cursor, options) -> { candidates, unit }
 *
 * candidate: { start, end, text, chip, tag, sym }
 *   Replace text[start:end) with `text` to accept. The first candidate is the inline one.
 * unit: { options: [{value, text, group}], selected } when a unit is being suggested.
 */

const L = (text, spaced = false) => ({ text, spaced });
const EMPTY = L('');
const joinRes = (num, label) => num + (label.spaced && label.text ? ' ' : '') + label.text;
const WORD_START = '[A-Za-z\\u00B5\\u03BC\\u03A9\\u2126\\u00B0\\u03C0\\u03C4_]';

export function complete(text, cursor, o) {
  const out = { candidates: [], unit: null };
  try {
    run(text, cursor, o, out);
  } catch (e) {
    if (o.log) o.log('skip', e && e.message);
  }
  return out;
}

/* ------------------------------ locating text ----------------------------- */

const tailOk = (tail) => tail === '' || /^[\s),;:\]}!?]/.test(tail) || /^\.(\s|$)/.test(tail);

function tailFor(label, tail) {
  if (tailOk(tail)) return 'full';
  if (label.text && tail.startsWith(label.text) && !/[A-Za-z0-9_]/.test(tail[label.text.length] || ' ')) return 'omit';
  return null;
}

function validStart(X, s, reg, depth) {
  const c = X[s];
  if (!new RegExp('[0-9.\\-+(]|' + WORD_START).test(c)) return false;
  if ((c === '-' || c === '+') && (s + 1 >= X.length || /\s/.test(X[s + 1]))) return false;
  if (s > 0) {
    const p = X[s - 1];
    if (c === '.') {
      if (/[0-9)]/.test(p)) return false;
    } else if (/[A-Za-z0-9_)\u00B5\u03BC\u03A9\u2126\u00B0\u03C0\u03C4.]/.test(p)) return false;
    let k = s - 1;
    while (k >= 0 && /\s/.test(X[k])) k--;
    if (k >= 0) {
      const q = X[k];
      if ('+-*/^\u00D7\u00F7\u00B7'.includes(q)) {
        const bullet = '-*+'.includes(q) && X.slice(0, k).trim() === '';
        if (!bullet) return false;
      } else if (q === '=' && depth < 2) {
        // text right after "<expression> =" is a result, not a new expression
        const prev = X.slice(0, k).trimEnd();
        if (prev && findExpression(prev, reg, depth + 1)) return false;
      }
    }
  }
  return true;
}

function findExpression(X, reg, depth = 0) {
  const lo = Math.max(0, X.length - 400);
  for (let s = lo; s < X.length; s++) {
    if (!validStart(X, s, reg, depth)) continue;
    const sub = X.slice(s);
    if (sub.endsWith('.')) continue;
    try {
      const parsed = parse(sub, reg);
      return { start: s, parsed, text: sub };
    } catch (e) {
      if (e instanceof SyntaxErr) continue;
      throw e;
    }
  }
  return null;
}

function kindOf(ast) {
  let b = ast;
  while (b.k === 'neg') b = b.e;
  if (b.k === 'num') return 'num';
  if (b.k === 'const') return 'const';
  if (b.k === 'unit') return 'unit';
  if (b.k === 'lit') return 'lit';
  return 'full';
}

/* ------------------------------- evaluation ------------------------------- */

function computeVariants(f, ctx, P) {
  const o = ctx.o;
  const modes = [o.angle, o.angle === 'rad' ? 'deg' : 'rad'];
  const rs = modes.map((mode) => ({ mode, r: evaluate(f.parsed, mode, P) }));
  const a = rs[0].r;
  const b = rs[1].r;
  const same = a.q.v.eq(b.q.v) && sameDims(a.q.d, b.q.d) && !!a.q.ang === !!b.q.ang;
  const used = same ? [rs[0]] : rs;
  if (o.log) o.log('variants', used.map((u) => ({ mode: u.mode, value: u.r.q.v.toString().slice(0, 60), dims: u.r.q.d })));
  return used.map((u) => ({ tag: same ? null : u.mode, r: u.r }));
}

function powU(u, exp) {
  return Number.isInteger(exp) ? u.factor.pow(exp) : u.factor.pow(new Decimal(exp));
}

function unitChoices(q, o, style) {
  const reg = o.registry;
  const v = q.v;
  const mkNamed = (u) => ({ x: v.div(u.factor), label: L(u.symbol), unit: u });
  const coherent = () => ({ x: v, label: reg.compound(q.d, style), unit: { factor: new Decimal(1), dims: q.d } });
  const metricNamed = reg.chooseNamed('metric', q.d, v);
  const imperialNamed = reg.chooseNamed('imperial', q.d, v);
  const metric = metricNamed ? mkNamed(metricNamed) : coherent();
  const imperial = imperialNamed ? mkNamed(imperialNamed) : null;
  const ok = (c) => {
    if (v.isZero()) return false;
    const a = c.x.abs();
    return a.gte('0.01') && a.lt('1e7');
  };
  const first = o.system === 'imperial' && imperial ? imperial : metric;
  const second = first === imperial ? metric : imperial;
  const out = [first];
  if (second && ok(second) && second.label.text !== first.label.text) out.push(second);
  return out;
}

function valuesFor(v, f, ctx) {
  const o = ctx.o;
  const { q, target } = v.r;
  if (q.ang) return [];
  if (target) {
    if (!sameDims(q.d, target.d)) throw new Error('Cannot convert between these units');
    if (isZeroDims(q.d)) throw new Error('Nothing to convert');
    const typed = f.parsed.ast.targetText;
    let label = typed;
    let factor = target.v;
    let override = false;
    if (o.unitOverride && o.unitOverride !== typed.trim()) {
      const u = o.registry.resolve(o.unitOverride);
      if (u && !u.angle && sameDims(u.dims, q.d)) {
        factor = u.factor;
        label = o.unitOverride;
        override = true;
      }
    }
    return [{ x: q.v.div(factor), label: L(label), override, convLabel: label }];
  }
  if (isZeroDims(q.d)) return [{ x: q.v, label: EMPTY }];
  return unitChoices(q, o, f.parsed.meta.expStyle || '**');
}

/* -------------------------------- formatting ------------------------------ */

function fmtDec(x, litDec) {
  if (x.isZero()) return '0';
  const r = x.toSignificantDigits(4);
  const out = litDec > r.decimalPlaces() ? x.toDecimalPlaces(litDec) : r;
  return (out.isZero() ? r : out).toFixed();
}

function fmtSci(x) {
  return x.toSignificantDigits(4).toExponential().replace('e+', 'e');
}

function previewStrings(x, litDec) {
  if (x.isZero()) return { dec: '0', sci: null };
  const huge = x.e >= 1000 || x.e < -1000;
  const abs = x.abs();
  const sciOk = huge || abs.lt('1e-4') || abs.gt('1e4');
  return { dec: huge ? null : fmtDec(x, litDec), sci: sciOk ? fmtSci(x) : null };
}

const digitsOf = (s) => s.replace(/\D/g, '').length;

/** Next progressive extension of typed digits T toward the value x. */
function progressive(x, T, P) {
  const S = x.toFixed();
  const dot = S.indexOf('.');
  const intPart = dot < 0 ? S : S.slice(0, dot);
  let ext = null;
  if (S.startsWith(T)) {
    if (S === T) return null;
    if (!T.includes('.')) {
      if (T !== intPart) ext = intPart;
      else if (dot >= 0) ext = S.slice(0, intPart.length + 2);
    } else {
      ext = S.slice(0, T.length + 1);
    }
  } else {
    // typed text is the rounded preview of the value: replace its last digits with exact ones
    const dT = T.includes('.') ? T.length - T.indexOf('.') - 1 : 0;
    if (x.toDecimalPlaces(dT).toFixed() === T) {
      if (dT === 0) {
        if (dot >= 0) ext = S.slice(0, dot + 2);
      } else {
        ext = S.slice(0, T.length + 1);
      }
    }
  }
  if (!ext || ext === T) return null;
  if (digitsOf(ext) > P - 14) return null;
  return ext;
}

const shorten = (s, fromEnd) => (s.length <= 30 ? s : fromEnd ? '...' + s.slice(-14) : s.slice(0, 26) + '...');

/* ---------------------------------- states -------------------------------- */

function run(text, cursor, o, out) {
  if (o.selStart != null && o.selStart !== o.selEnd) return;
  const lineStart = cursor === 0 ? 0 : text.lastIndexOf('\n', cursor - 1) + 1;
  let lineEnd = text.indexOf('\n', cursor);
  if (lineEnd < 0) lineEnd = text.length;
  const before = text.slice(lineStart, cursor);
  const tail = text.slice(cursor, lineEnd);
  if (!before.trim()) return;
  const reg = o.registry;
  const ctx = { text, cursor, lineStart, before, tail, o, reg };

  // "<expression> = <partial result>"
  const eq = before.lastIndexOf('=');
  if (eq >= 0 && !'<>=!'.includes(before[eq - 1] || ' ')) {
    const m = /^(\s*)([+-]?\d*\.?\d*)$/.exec(before.slice(eq + 1));
    if (m) {
      const exprPart = before.slice(0, eq);
      const X = exprPart.trimEnd();
      const f = X ? findExpression(X, reg) : null;
      if (f) {
        stateB(ctx, f, X, exprPart.slice(X.length), m[1], m[2], out);
        return;
      }
    }
  }

  if (!tailOk(tail)) return;
  const X = before.trimEnd();
  const f = X ? findExpression(X, reg) : null;
  if (f) {
    stateA(ctx, f, X, before.slice(X.length), out);
    return;
  }
  unitComplete(ctx, out);
}

function unitInfo(ctx, dims, selected, typedExtra) {
  const o = ctx.o;
  const groups = { metric: 'Metric', imperial: 'Imperial', any: 'Common' };
  const opts = ctx.reg.optionsForDims(dims);
  const order = o.system === 'imperial' ? ['imperial', 'any', 'metric'] : ['metric', 'any', 'imperial'];
  const list = [];
  for (const sys of order) {
    for (const u of opts) if (u.system === sys) list.push({ value: u.symbol, text: `${u.symbol} \u2014 ${u.name}`, group: groups[sys] });
  }
  const extra = typedExtra && !list.some((x) => x.value === typedExtra) ? [{ value: typedExtra, text: typedExtra, group: null }] : [];
  if (selected && !list.some((x) => x.value === selected) && selected !== typedExtra) extra.push({ value: selected, text: selected, group: null });
  const options = [...extra, ...list];
  return options.length ? { options, selected } : null;
}

function stateA(ctx, f, X, trailing, out) {
  const { o, lineStart, cursor } = ctx;
  const ast = f.parsed.ast;
  const kind = kindOf(ast);
  if (kind === 'num' || kind === 'const' || kind === 'unit') return;
  const variants = computeVariants(f, ctx, 50);
  const litDec = Math.min(f.parsed.meta.litDec, 15);

  const ops = f.parsed.meta.ops;
  let W = ' ';
  if (ops.length) {
    const last = ops[ops.length - 1];
    W = f.text.slice(last.tok.e, last.after.s);
  }
  if (trailing && W === '') W = ' ';
  const strip = (ins) => {
    const lead = /^\s*/.exec(ins)[0];
    return ins.slice(Math.min(lead.length, trailing.length));
  };

  const decs = [];
  const scis = [];
  let convInfo = null;
  for (const v of variants) {
    const vals = valuesFor(v, f, ctx);
    if (kind === 'lit' && vals.length && !litShouldSuggest(vals[0], f)) return;
    for (const val of vals) {
      if (ast.k === 'conv' && !convInfo) {
        convInfo = unitInfo(ctx, v.r.q.d, val.override ? val.convLabel : ast.targetText.trim(), ast.targetText.trim());
      }
      const s = previewStrings(val.x, litDec);
      for (const [list, str] of [[decs, s.dec], [scis, s.sci]]) {
        if (str === null) continue;
        const res = joinRes(str, val.label);
        if (val.override) {
          const from = lineStart + f.start + ast.unitStart;
          const insert = val.convLabel + W + '=' + W + res;
          list.push({ from, to: lineStart + X.length, insert, chip: insert, tag: v.tag });
        } else {
          const insert = strip(W + '=' + W + res);
          list.push({ from: cursor, to: cursor, insert, chip: insert.trim(), tag: v.tag });
        }
      }
    }
  }
  finish(out, ctx, [...decs, ...scis], convInfo, false);
}

function litShouldSuggest(first, f) {
  const a = first.x.abs();
  if (a.lt(1) || a.gte(10000)) return false;
  let b = f.parsed.ast;
  while (b.k === 'neg') b = b.e;
  let tf = new Decimal(1);
  for (const { u, exp } of b.atoms) tf = tf.times(powU(u, exp));
  return !first.unit.factor.eq(tf);
}

function stateB(ctx, f, X, ws1, ws2, T, out) {
  const { o, lineStart, cursor, text, tail } = ctx;
  const ast = f.parsed.ast;
  const kind = kindOf(ast);
  if (kind === 'num' || kind === 'unit') return;
  const digits = digitsOf(T);
  const P = Math.max(50, digits + 40);
  const variants = computeVariants(f, ctx, P);
  const litDec = Math.min(f.parsed.meta.litDec, 15);
  const tStart = cursor - T.length;
  const pre = T === '' && ws2 === '' && ws1 !== '' ? ws1 : '';

  const decs = [];
  const scis = [];
  let convInfo = null;
  for (const v of variants) {
    const vals = valuesFor(v, f, ctx);
    for (const val of vals) {
      if (ast.k === 'conv' && !convInfo) {
        convInfo = unitInfo(ctx, v.r.q.d, val.override ? val.convLabel : ast.targetText.trim(), ast.targetText.trim());
      }
      if (val.override) {
        const s = previewStrings(val.x, litDec);
        const between = text.slice(lineStart + X.length, tStart);
        const from = lineStart + f.start + ast.unitStart;
        for (const [list, str] of [[decs, s.dec], [scis, s.sci]]) {
          if (str === null) continue;
          const res = joinRes(str, val.label);
          const insert = val.convLabel + between + (ws2 === '' && ws1 !== '' ? ws1 : '') + res;
          list.push({ from, to: cursor, insert, chip: res, tag: v.tag });
        }
        continue;
      }
      const mode = tailFor(val.label, tail);
      if (!mode) continue;
      const add = (list, numStr) => {
        const full = joinRes(numStr, val.label);
        const res = mode === 'omit' ? numStr : full;
        list.push({ from: tStart, to: cursor, insert: pre + res, chip: full, tag: v.tag, progressive: T !== '' });
      };
      if (digits === 0) {
        const s = previewStrings(val.x, litDec);
        if (s.dec !== null && s.dec.startsWith(T)) add(decs, s.dec);
        if (s.sci !== null && s.sci.startsWith(T)) add(scis, s.sci);
      } else {
        const ext = progressive(val.x, T, P);
        if (ext !== null) add(decs, ext);
      }
    }
  }
  finish(out, ctx, [...decs, ...scis], convInfo, true);
}

function unitComplete(ctx, out) {
  const { before, o, reg, cursor } = ctx;
  const m = new RegExp(
    '(->|(?<![A-Za-z0-9_\\u00B5\\u03BC\\u03A9\\u2126\\u00B0\\u03C0\\u03C4.])to(?![A-Za-z0-9_]))(\\s*)(' + WORD_START + '*)$'
  ).exec(before);
  if (!m) return;
  const srcX = before.slice(0, m.index).trimEnd();
  if (!srcX) return;
  const f = findExpression(srcX, reg);
  if (!f) return;
  const r = evaluate(f.parsed, o.angle, 50);
  const q = r.q;
  if (r.target || q.ang || isZeroDims(q.d)) return;
  const options = reg.optionsForDims(q.d);
  if (!options.length) return;
  const prefix = m[3];
  const other = o.system === 'imperial' ? 'metric' : 'imperial';
  const best = (sys) => {
    const u = reg.chooseNamed(sys, q.d, q.v);
    return u ? u.symbol : null;
  };
  const known = new Set(options.map((x) => x.symbol));
  let order = [...new Set([best(o.system), best(other), ...options.map((x) => x.symbol)])].filter((s) => s && known.has(s));
  if (!prefix) {
    const typed = new Set(f.parsed.meta.units);
    const rest = order.filter((s) => !typed.has(s));
    if (rest.length) order = rest;
  }
  let list = order;
  if (prefix) {
    list = order.filter((s) => s.startsWith(prefix));
    if (!list.length) list = order.filter((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));
  }
  list = list.slice(0, 8);
  if (o.unitOverride && known.has(o.unitOverride)) list = [o.unitOverride, ...list.filter((s) => s !== o.unitOverride)];
  if (!list.length) return;
  const lead = prefix === '' && m[2] === '' ? ' ' : '';
  const cands = list.map((sym) => ({ from: cursor - prefix.length, to: cursor, insert: lead + sym, chip: sym, sym }));
  finish(out, ctx, cands, unitInfo(ctx, q.d, list[0], null), false);
}

function finish(out, ctx, cands, info, progressiveState) {
  const seen = new Set();
  const res = [];
  for (const c of cands) {
    const key = `${c.from}|${c.to}|${c.insert}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const old = ctx.text.slice(c.from, c.to);
    let cp = 0;
    while (cp < old.length && cp < c.insert.length && old[cp] === c.insert[cp]) cp++;
    const text = c.insert.slice(cp);
    const start = c.from + cp;
    if (!text && start === c.to) continue;
    res.push({ start, end: c.to, text, chip: shorten(c.chip, !!c.progressive), tag: c.tag || null, sym: c.sym || null });
  }
  out.candidates = res;
  out.unit = res.length ? info : null;
  if (ctx.o.log) ctx.o.log('candidates', res.map((r) => ({ replace: [r.start, r.end], text: r.text.slice(0, 40), chip: r.chip, tag: r.tag })));
}
