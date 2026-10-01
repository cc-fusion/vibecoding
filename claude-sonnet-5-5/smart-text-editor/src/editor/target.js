// Conversion-target suggestions:  "1kg to |"  and  "3 celsius to f|"
import { MAX_EXPR } from './numeric.js';
import { UNITS, PREFIXES, EXACT, mkRd, pfOK } from './units.js';
import { isLone, bareInfo } from './parser.js';
import { dEq, dZero } from './evaluator.js';
import { formatValue } from './format.js';
import { candidateUnits, longName, targetWord } from './candidates.js';
import { findExpression, evalReadings, convValue } from './analyze.js';

const TARGET_RE = /^(.*?)(?:(?<=\s)(?:to|in)\s+|\s*(?:->|\u2192)\s*)([A-Za-z\u00b0\u00b5\u03bc\u03a9]*)$/i;
const MAX_TARGETS = 8;

const byLen = (a, b) => (a.alias ? 1 : 0) - (b.alias ? 1 : 0)
  || a.text.length - b.text.length
  || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);

// units (by name or symbol) whose spelling continues what the user typed
function matchTargets(q, lw, long) {
  const okU = (ou) => dEq(ou.dims, q.d) && (ou.offset === undefined || !!q.t);
  const names = [], syms = [];
  for (const def of UNITS) {
    if (!dEq(def.dims, q.d)) continue;
    const found = [];
    def.names.forEach((nm, idx) => {
      const alias = idx > 0;                               // alternate spellings rank last
      if (nm.length > lw.length && nm.startsWith(lw)) found.push({ text: nm, ou: mkRd(def, null).ou, alias });
      for (const p of PREFIXES) {
        if (!pfOK(def, p)) continue;
        for (const pn of [p.n].concat(p.alt || [])) {
          const full = pn + nm;
          if (lw.startsWith(pn) && full.length > lw.length && full.startsWith(lw)) found.push({ text: full, ou: mkRd(def, p).ou, alias });
        }
      }
    });
    // an alias is only offered when the canonical spelling does not match
    const hasCanon = found.some(f => !f.alias);
    for (const f of found) if (!f.alias || !hasCanon) names.push(f);
  }
  for (const [key, rd] of EXACT) {
    if (key.length > lw.length && key.toLowerCase().startsWith(lw) && dEq(rd.ou.dims, q.d)) syms.push({ text: key, ou: rd.ou });
  }
  names.sort(byLen); syms.sort(byLen);
  const ordered = long ? names.concat(syms) : syms.concat(names);
  const seen = new Set(), out = [];
  for (const t of ordered) {
    if (!okU(t.ou) || seen.has(t.text)) continue;
    seen.add(t.text);
    out.push(t);
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

export function targetChips(value, caret) {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  let lineEnd = value.indexOf('\n', caret); if (lineEnd < 0) lineEnd = value.length;
  if (/\S/.test(value.slice(caret, lineEnd))) return [];

  let body = value.slice(lineStart, caret);
  const bm = body.match(/^\s*[-*+\u2022\u2013]\s+/);
  if (bm) body = body.slice(bm[0].length);
  if (body.length > MAX_EXPR) body = body.slice(-MAX_EXPR);
  if (body.includes('=')) return [];

  const m = TARGET_RE.exec(body);
  if (!m) return [];
  const word = m[2], lw = word.toLowerCase();
  const leftTrim = m[1].replace(/\s+$/, '');
  if (!leftTrim) return [];
  const tail = body.slice(leftTrim.length);              // " to f"

  const found = findExpression(leftTrim);
  if (!found) return [];
  const ast0 = found.interps[0].ast;
  if (isLone(ast0)) return [];
  const bi = bareInfo(ast0);
  if (bi && bi.nums === 0) return [];

  const { readings } = evalReadings(found);
  const chips = [], seen = new Set();
  for (const r of readings) {
    const q = r.q;
    if (dZero(q.d) && !q.t) continue;
    const long = r.st.long;
    let targets;
    if (!word) {
      const cu = candidateUnits(q);
      const own = new Set(cu.oper.map(o => o.sym));
      targets = cu.cur.filter(o => !own.has(o.sym)).map(ou => ({ text: targetWord(ou, long), ou }));
    } else {
      targets = matchTargets(q, lw, long);
    }
    for (const t of targets) {
      const ou = t.ou;
      const x = convValue(q, { f: ou.f, d: ou.dims, off: ou.offset });
      if (!x) continue;
      const l = formatValue(x);
      if (!l) continue;
      const unitText = (long && ou.def) ? longName(ou, l[0]) : ou.sym;
      const insertText = t.text.slice(word.length) + ' = ' + l[0] + r.st.sp + unitText;
      const dim = r.disp + tail;
      const key = insertText + '|' + dim;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({
        insertText, dim, ins: insertText, tag: r.tag, replaceLen: 0,
        // completing a partly typed unit may be done inline; the bare list is cells only
        inlineEligible: !!word, kind: 'target'
      });
      if (chips.length >= MAX_TARGETS) return chips;
    }
  }
  return chips;
}
