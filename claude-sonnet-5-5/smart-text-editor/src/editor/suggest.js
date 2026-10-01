// Suggestion engine: turns an analyzed line into chips (cells + optional inline ghost text).
import { D } from './numeric.js';
import { UNITS, PREFIXES, pfOK } from './units.js';
import { isExact } from './format.js';
import { analyzeLine } from './analyze.js';
import { targetChips } from './target.js';
import { getAnglePref } from './prefs.js';

const NUM_ONLY = /^-?(?:\d+\.?\d*|\.\d+)$/;
const MAX_SIG = 20;          // never extend beyond this many significant digits

/* ---- progressive digits ----
   Typed "3.1" for pi -> inline "4" (3.14), cells "41" (3.141), ...
   Typed "3.14"       -> inline "15" (3.1415), cell "159" (3.14159), ...
   Digits are truncated (not rounded) so every rung literally extends what was typed.
   Returns null when not applicable, else { rungs: [string], replace: bool }. */
function ladderRungs(x, typedNum) {
  if (!x || !x.isFinite() || isExact(x)) return null;
  if (!NUM_ONLY.test(typedNum)) return null;
  const ax = x.abs();
  if (ax.gte('1e15') || ax.lt('1e-6')) return null;

  const dot = typedNum.indexOf('.');
  const d = dot < 0 ? 0 : typedNum.length - dot - 1;
  const intStr = dot < 0 ? typedNum : typedNum.slice(0, dot);
  // the integer part has to be complete before digits can be appended
  if (intStr !== x.toDecimalPlaces(0, D.ROUND_DOWN).toFixed()) return null;

  const tn = typedNum.endsWith('.') ? typedNum.slice(0, -1) : typedNum;
  const trunc = (r) => x.toDecimalPlaces(r, D.ROUND_DOWN).toFixed(r);

  let replace = false;
  if (trunc(d) !== tn) {
    // not a digit-prefix. A correctly rounded literal ends the ladder, except that a
    // long one (7+ digits) is offered a more precise replacement.
    if (x.toDecimalPlaces(d, D.ROUND_HALF_UP).toFixed(d) !== tn) return null;
    const sigTyped = tn.replace('-', '').replace('.', '').replace(/^0+/, '').length;
    if (sigTyped < 7) return { rungs: [], replace: false };
    replace = true;
  }

  const intDigits = ax.gte(1) ? ax.toDecimalPlaces(0, D.ROUND_DOWN).toFixed().length : 0;
  const maxDec = intDigits ? Math.max(0, MAX_SIG - intDigits) : MAX_SIG + (-x.e - 1);
  const base = d === 0 ? [2, 5, 8, 12]
    : d === 1 ? [2, 3, 5, 8, 12]
    : [d + 2, d + 3, d + 5, d + 8, d + 12];

  const rungs = [];
  for (let r of base) {
    r = Math.min(r, maxDec);
    if (r <= d) continue;
    let s = trunc(r);
    for (let k = 0; k < 3 && s.endsWith('0') && r < maxDec; k++) { r++; s = trunc(r); }
    if (s.endsWith('0')) continue;
    if (s.length <= typedNum.length) continue;
    if (!replace && !s.startsWith(typedNum)) continue;
    if (!rungs.includes(s)) rungs.push(s);
    if (rungs.length >= 4) break;
  }
  return { rungs, replace };
}

/* ---- chips for an analyzed line ---- */
function buildChips(a) {
  // radians/degrees: the reading the user last picked comes first (and is the inline one)
  const pref = getAnglePref();
  const rank = (l) => (l.tag && l.tag !== pref ? 1 : 0);
  const lists = a.lists.slice().sort((p, q) => (p.ii - q.ii) || (rank(p) - rank(q)));

  let cands = [];
  for (const kind of ['primary', 'alt', 'ladder'])
    for (const L of lists) for (const it of L.items)
      if (it.kind === kind) cands.push(Object.assign({}, it, { tag: L.tag, disp: L.disp, ii: L.ii, sp: L.sp }));
  if (!cands.length) return [];

  const full = (c, sp) => c.num + (c.unit ? sp + c.unit : '');
  const seen = new Map(), uniq = [];
  for (const c of cands) {
    const key = c.disp + '|' + full(c, '\u0000');
    if (seen.has(key)) {
      const p = seen.get(key);
      if (p.kind === 'primary' && c.kind === 'primary' && p.ii === c.ii && p.tag !== c.tag) p.tag = null;
      continue;
    }
    seen.set(key, c); uniq.push(c);
  }
  cands = uniq;

  const chips = [];
  const mk = (o) => chips.push(Object.assign({ tag: null, replaceLen: 0 }, o));
  const inl = (c) => c.kind === 'primary' && a.cls === 'inline';

  if (a.shape === 'typed') {
    const t = a.typed;
    const tm = /^(-?[\d.]+(?:e[+-]?\d+)?)(\s*)(.*)$/.exec(t) || [t, t, '', ''];
    const spOf = (c) => tm[3] ? tm[2] : c.sp;
    const keys = new Set();
    const add = (o) => {
      const k = o.insertText + '|' + o.replaceLen + '|' + (o.tag || '') + '|' + o.dim;
      if (keys.has(k)) return;
      keys.add(k); mk(o);
    };
    let any = false;
    for (const c of cands) {
      const f = full(c, spOf(c));
      const lad = tm[3] ? null : ladderRungs(c.x, tm[1]);
      if (lad) {
        any = true;
        const u = c.unit ? c.sp + c.unit : '';
        lad.rungs.forEach((s, i) => {
          if (lad.replace) {
            add({ insertText: s + u, replaceLen: t.length, dim: c.disp + ' = ', ins: s + u, tag: c.tag,
                  inlineEligible: false, kind: 'replace' });
          } else {
            const rem = s.slice(t.length) + u;
            add({ insertText: rem, dim: c.disp + ' = ' + t, ins: rem, tag: c.tag, inlineEligible: i === 0 && inl(c), kind: c.kind });
          }
        });
        continue;
      }
      if (f.startsWith(t)) {
        any = true;
        if (f === t) continue;
        const rem = f.slice(t.length);
        add({ insertText: rem, dim: c.disp + ' = ' + t, ins: rem, tag: c.tag, inlineEligible: inl(c), kind: c.kind });
      }
    }
    if (!any) {
      const c = cands[0];
      mk({ insertText: full(c, c.sp), replaceLen: t.length, dim: c.disp + ' = ', ins: full(c, c.sp), tag: c.tag,
           inlineEligible: false, kind: 'replace' });
    }
  } else if (a.shape === 'eq') {
    const lead = (a.spaceBeforeEq && !a.trailing) ? ' ' : '';
    for (const c of cands) {
      const f = full(c, c.sp);
      mk({ insertText: lead + f, dim: c.disp + ' = ', ins: f, tag: c.tag, inlineEligible: inl(c), kind: c.kind });
    }
  } else {
    const lead = (a.trailing ? '' : (a.spaced ? ' ' : '')) + (a.spaced ? '= ' : '=');
    for (const c of cands) {
      const f = full(c, c.sp);
      mk({ insertText: lead + f, dim: c.disp + ' = ', ins: f, tag: c.tag, inlineEligible: inl(c), kind: c.kind });
    }
  }
  return chips;
}

/* ---- name autocomplete: functions, constants, units.
   These are offered as cells and accepted with Tab, but never shown inline. ---- */
const FN_WORDS = ['sqrt(', 'cbrt(', 'log(', 'ln(', 'log2(', 'sin(', 'cos(', 'tan(', 'csc(', 'sec(', 'cot(',
  'asin(', 'acos(', 'atan(', 'arcsin(', 'arccos(', 'arctan(', 'nPr(', 'nCr(', 'pi'];
const UNIT_WORDS = (() => {
  const s = new Set(['square', 'cubic', 'squared', 'cubed']);
  UNITS.forEach(u => u.names.forEach(n => s.add(n)));
  PREFIXES.forEach(p => s.add(p.n));
  return Array.from(s);
})();
function nameSuggest(value, caret) {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  let lineEnd = value.indexOf('\n', caret); if (lineEnd < 0) lineEnd = value.length;
  if (/\S/.test(value.slice(caret, lineEnd))) return [];
  const before = value.slice(lineStart, caret);
  const m = /([A-Za-z\u00b5\u03bc]{2,})$/.exec(before);
  if (!m) return [];
  const w = m[1], lw = w.toLowerCase();
  const pre = before.slice(0, before.length - w.length);
  const unitCtx = /(?:[\d.)/\u00b7*^]|->|\u2192|\b(?:to|in|per))\s*$/i.test(pre);
  const fns = [], units = [];
  const push = (arr, full) => { if (full.length > lw.length && full.toLowerCase().startsWith(lw)) arr.push(full.slice(lw.length)); };
  FN_WORDS.forEach(f => push(fns, f));
  if (unitCtx) {
    UNIT_WORDS.forEach(f => push(units, f));
    for (const p of PREFIXES) {
      if (lw.length >= p.n.length && lw.startsWith(p.n)) {
        for (const u of UNITS) if (u.names[0] && pfOK(u, p)) push(units, p.n + u.names[0]);
      }
    }
  }
  const byLen = (x, y) => x.length - y.length || (x < y ? -1 : 1);
  fns.sort(byLen); units.sort(byLen);
  const ordered = unitCtx ? units.concat(fns) : fns;
  const seen = new Set(), out = [];
  for (const r of ordered) {
    if (seen.has(r)) continue; seen.add(r);
    out.push({ insertText: r, dim: w, ins: r, tag: null, replaceLen: 0, inlineEligible: false, kind: 'name' });
    if (out.length >= 8) break;
  }
  return out;
}

export function suggestFor(text, caret) {
  const a = analyzeLine(text, caret);
  if (a) return buildChips(a);
  const t = targetChips(text, caret);
  if (t.length) return t;
  return nameSuggest(text, caret);
}
