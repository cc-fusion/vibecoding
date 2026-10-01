// Line analyzer: find the expression before the caret and evaluate it.
import { MAX_EXPR, MAX_STARTS } from './numeric.js';
import { resolveUnitWord } from './units.js';
import { parseText, walk, collectUnits, show, isLone, bareInfo, isConstExpr } from './parser.js';
import { evaluateAst, dEq, dZero } from './evaluator.js';
import { formatValue } from './format.js';
import { itemsForQ } from './candidates.js';

const PHONE_DATE = [
  /^\d{3}-\d{4}$/,
  /^\d{3}-\d{3}-\d{4}$/,
  /^\(?\d{3}\)?[ -]?\d{3}-\d{4}$/,
  /^\d{4}-\d{1,2}-\d{1,2}$/,
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/
];
const WORDCH = /[A-Za-z0-9_.\u00b5\u03bc\u03c0\u00b0\u03a9]/;

function parsePartial(s) {
  const m = /^\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(\s*)([A-Za-z\u00b0\u00b5\u03bc\u03a9][A-Za-z0-9\u00b0\u00b5\u03bc\u03a9^\u00b2\u00b3/\u00b7*.]*)?$/.exec(s);
  if (!m) return null;
  if (m[3]) {
    const words = m[3].match(/[A-Za-z\u00b0\u00b5\u03bc\u03a9]+/g) || [];
    if (!words.every(w => resolveUnitWord(w))) return null;
  }
  return s.trim();
}

export function findExpression(seg) {
  if (seg.length > MAX_EXPR) seg = seg.slice(-MAX_EXPR);
  const t = seg.replace(/\s+$/, '');
  let tried = 0;
  for (let i = 0; i < t.length; i++) {
    if (/\s/.test(t[i])) continue;
    if (i > 0 && WORDCH.test(t[i - 1])) continue;
    if (++tried > MAX_STARTS) break;
    const sub = t.slice(i);
    const r1 = parseText(sub, 'sci');
    if (!r1) continue;
    const interps = [];
    if (r1.ast) interps.push({ ast: r1.ast, amb: r1.amb });
    if (r1.amb) {
      const r2 = parseText(sub, 'split');
      if (r2 && r2.ast) interps.push({ ast: r2.ast, amb: true });
    }
    if (!interps.length) continue;
    return { start: i, text: sub, interps };
  }
  return null;
}

// explicit conversion: "5 km to mi", "5 km in miles", "5km -> mi"
function splitConversion(seg) {
  const t = seg.replace(/\s+$/, '');
  if (!t || t.length > MAX_EXPR) return null;
  const cands = [];
  let m;
  const re1 = /(?<=\s)(?:to|in)(?=\s)/gi;
  while ((m = re1.exec(t))) cands.push({ idx: m.index, len: m[0].length });
  const re2 = /->|\u2192/g;
  while ((m = re2.exec(t))) cands.push({ idx: m.index, len: m[0].length });
  cands.sort((a, b) => b.idx - a.idx);
  for (const c of cands) {
    const left = t.slice(0, c.idx);
    const right = t.slice(c.idx + c.len).trim();
    if (!right) continue;
    const rp = parseText(right, 'sci');
    if (!rp || !rp.ast) continue;
    const bi = bareInfo(rp.ast);
    if (!bi || bi.nums !== 0) continue;
    const lf = findExpression(left);
    if (!lf) continue;
    const leftTrim = left.replace(/\s+$/, '');
    return { found: lf, right, rightAst: rp.ast, tail: t.slice(leftTrim.length) };
  }
  return null;
}

function dispFor(text, ast, pick) {
  const reps = [];
  walk(ast, n => {
    if (n.k === 'unit' && n.folded) {
      const rd = n.rd[pick.get(n) || 0];
      reps.push({ s: n.s, e: n.e, t: rd.sym + (n.pw > 1 ? '^' + n.pw : '') });
    }
  });
  if (!reps.length) return text;
  reps.sort((a, b) => b.s - a.s);
  let s = text;
  for (const r of reps) s = s.slice(0, r.s) + r.t + s.slice(r.e);
  return s;
}
function unitStyle(text, ast) {
  const nodes = collectUnits(ast).sort((a, b) => a.s - b.s);
  let sp = '';
  for (const n of nodes) {
    if (n.s === 0) continue;
    let i = n.s - 1, gap = false;
    while (i >= 0 && /\s/.test(text[i])) { gap = true; i--; }
    if (i < 0) continue;
    if (/[\d.)]/.test(text[i])) { sp = gap ? ' ' : ''; break; }
  }
  return { sp, long: nodes.length ? !!nodes[0].long : false };
}
export function convValue(q, tg) {
  if (!dEq(q.d, tg.d)) return null;
  if (tg.off) { if (!q.t) return null; return q.v.div(tg.f).minus(tg.off); }
  return q.v.div(tg.f);
}

// Evaluate every reading of a found expression (Ne-N reading x unit-case reading).
// Failures are silent. -> { readings: [{q, tag, disp, ii, st, precise}], ambiguous }
export function evalReadings(found) {
  const multiAst = found.interps.length > 1;
  const readings = [];
  let ambiguous = false, ii = 0;
  for (const it of found.interps) {
    const un = collectUnits(it.ast);
    const amb = un.filter(n => n.rd.length > 1);
    let combos = [new Map()];
    for (const n of amb) {
      const nc = [];
      for (const c of combos) for (let k = 0; k < n.rd.length; k++) {
        const m = new Map(c); m.set(n, k); nc.push(m);
        if (nc.length >= 8) break;
      }
      combos = nc.slice(0, 8);
    }
    if (amb.length) ambiguous = true;
    const st = unitStyle(found.text, it.ast);
    const precise = isConstExpr(it.ast);
    for (const pick of combos) {
      const modes = evaluateAst(it.ast, pick);
      if (modes) {
        const disp = multiAst ? show(it.ast) : dispFor(found.text, it.ast, pick);
        for (const m of modes) readings.push({ q: m.q, tag: m.tag, disp, ii, st, precise });
      }
      ii++;
    }
  }
  return { readings, ambiguous };
}

export function analyzeLine(value, caret) {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  let lineEnd = value.indexOf('\n', caret); if (lineEnd < 0) lineEnd = value.length;
  if (/\S/.test(value.slice(caret, lineEnd))) return null;

  const line = value.slice(lineStart, caret);
  const trailing = line.match(/\s*$/)[0];

  let body = line, bullet = false;
  const bm = line.match(/^\s*[-*+\u2022\u2013]\s+/);
  if (bm) { bullet = true; body = line.slice(bm[0].length); }
  if (body.length > MAX_EXPR) body = body.slice(-MAX_EXPR);
  const bodyT = body.replace(/\s+$/, '');
  if (!bodyT) return null;

  const segs = bodyT.split('=');
  let shape = 'plain', exprSeg, typed = null, explicitEq = false, segIndex;

  if (bodyT.endsWith('=')) {
    segs.pop();
    exprSeg = segs[segs.length - 1] ?? '';
    segIndex = segs.length - 1;
    shape = 'eq'; explicitEq = true;
  } else if (segs.length > 1) {
    const last = segs[segs.length - 1];
    const pm = parsePartial(last);
    const prev = segs[segs.length - 2];
    const prevOk = pm ? !!(splitConversion(prev) || findExpression(prev)) : false;
    if (pm && prevOk) {
      if (trailing) return null;
      shape = 'typed'; explicitEq = true; typed = pm;
      exprSeg = prev; segIndex = segs.length - 2;
    } else {
      exprSeg = last; segIndex = segs.length - 1;
    }
  } else {
    exprSeg = segs[0]; segIndex = 0;
  }

  const conv = splitConversion(exprSeg);
  const found = conv ? conv.found : findExpression(exprSeg);
  if (!found) return null;
  const ast0 = found.interps[0].ast;
  if (!conv && isLone(ast0)) return null;                  // lone literal: nothing
  const bi = conv ? null : bareInfo(ast0);
  if (bi && bi.nums === 0) return null;                    // a unit with no number
  const bare = !!bi;

  const exprText = conv ? found.text + conv.tail : found.text.trim();

  // conversion target
  let tg = null;
  if (conv) {
    const rr = evaluateAst(conv.rightAst, new Map());
    if (!rr) return null;
    const rq = rr[0].q;
    if (dZero(rq.d)) return null;
    const un = collectUnits(conv.rightAst);
    let off = null;
    if (conv.rightAst.k === 'unit' && un.length === 1 && un[0].pw === 1) {
      const ou = un[0].rd[0].ou;
      if (ou.offset !== undefined) off = ou.offset;
    }
    tg = { f: rq.v, d: rq.d, off };
  }

  const { readings, ambiguous } = evalReadings(found);
  const lists = [];
  for (const r of readings) {
    let items;
    if (conv) {
      const x = convValue(r.q, tg);
      if (!x) continue;
      const l = formatValue(x);
      if (!l) continue;
      items = l.map((s, i) => ({ num: s, unit: conv.right, kind: i ? 'ladder' : 'primary', x }));
    } else {
      items = itemsForQ(r.q, { bare, long: r.st.long, precise: r.precise });
    }
    if (items.length) lists.push({ items, tag: r.tag, disp: conv ? r.disp + conv.tail : r.disp, ii: r.ii, sp: r.st.sp });
  }
  if (!lists.length) return null;

  let cls = 'inline';
  if (ambiguous) cls = 'chip';
  else if (!explicitEq) {
    if (PHONE_DATE.some(r => r.test(exprText))) cls = 'chip';
    else if (bullet && segIndex === 0 && found.start === 0) cls = 'chip';
  }
  const spaced = /\s/.test(exprText);
  const spaceBeforeEq = shape === 'eq' && /\s$/.test(exprSeg);
  return { shape, typed, explicitEq, exprText, lists, cls, spaced, trailing, spaceBeforeEq };
}
