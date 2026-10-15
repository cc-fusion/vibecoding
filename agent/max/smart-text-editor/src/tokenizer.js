// Tokenizer: text -> tokens (numbers, identifiers, operators)
import { MAX_TOKENS } from './numeric.js';
import { resolveUnitWord } from './units.js';

const RE_NUM = /(?:\d+\.?\d*|\.\d+)/y;
const RE_EXP = /[eE]([+-]?)(\d+)/y;
const RE_ID = /[A-Za-z\u00b5\u03bc\u03c0\u00b0\u03a9]+/y;
const RE_LOGB = /_?(\d+)(?![\d.])/y;
const RE_INV_A = /\s*(?:\^|\*\*)\s*-\s*1(?![\d.])/y;
const RE_INV_B = /\u207b\u00b9/y;
const RE_INV_C = /-1(?![\d.])(?=\s*[\d.(])/y;
const RE_GLUE = /\d+(?![\d.])/y;
const RE_UGLUE = /[2-9](?![\d.])/y;
const SUP = { '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4',
              '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9' };
export const SUPMAP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
const TRIG = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot'];
export const FUNCS = new Set(['ln', 'sqrt', 'cbrt', 'log']);

function trigInfo(lower) {
  if (TRIG.includes(lower)) return { fn: lower, inv: false };
  const m = /^(?:arc|a)(sin|cos|tan|csc|sec|cot)$/.exec(lower);
  return m ? { fn: m[1], inv: true } : null;
}
function stickyAt(re, s, i) { re.lastIndex = i; return re.exec(s); }
function isPlainUnitWord(word, lower) {
  if (FUNCS.has(lower) || lower === 'log') return false;
  if (lower === 'e' || lower === 'pi' || lower === 'npr' || lower === 'ncr') return false;
  if (word === '\u03c0' || word === 'P' || word === 'C') return false;
  return !!resolveUnitWord(word);
}
function isUnitTok(t) { return !!t && t.t === 'id' && !t.trig && !!resolveUnitWord(t.v) && !FUNCS.has(t.v.toLowerCase()); }

// multi-word units: "fl oz", "imp gal", "sq m", "square meter", "meters squared", "cubic ft"
function mergeWords(toks) {
  let out = toks;
  const lw = (t) => t.v.toLowerCase();
  const pass = (fn) => {
    const res = [];
    for (let i = 0; i < out.length; i++) {
      const m = fn(out[i], out[i + 1]);
      if (m) { res.push(m); i++; } else res.push(out[i]);
    }
    out = res;
  };
  pass((a, b) => (a.t === 'id' && b && b.t === 'id' && ['fl', 'fluid'].includes(lw(a)) && ['oz', 'ounce', 'ounces'].includes(lw(b)))
    ? { t: 'id', v: 'fl oz', s: a.s, e: b.e, sp: a.sp } : null);
  pass((a, b) => (a.t === 'id' && b && ['imp', 'uk', 'imperial'].includes(lw(a)) && isUnitTok(b) && resolveUnitWord('imp ' + b.v))
    ? { t: 'id', v: 'imp ' + b.v, s: a.s, e: b.e, sp: a.sp, pw: b.pw } : null);
  pass((a, b) => (a.t === 'id' && b && ['sq', 'square'].includes(lw(a)) && isUnitTok(b))
    ? Object.assign({}, b, { s: a.s, sp: a.sp, pw: (b.pw || 1) * 2 }) : null);
  pass((a, b) => (a.t === 'id' && b && ['cubic', 'cu'].includes(lw(a)) && isUnitTok(b))
    ? Object.assign({}, b, { s: a.s, sp: a.sp, pw: (b.pw || 1) * 3 }) : null);
  pass((a, b) => (isUnitTok(a) && b && b.t === 'id' && ['squared', 'cubed'].includes(lw(b)))
    ? Object.assign({}, a, { e: b.e, pw: (a.pw || 1) * (lw(b) === 'squared' ? 2 : 3) }) : null);
  return out;
}

export function tokenize(src, mode) {
  const toks = [];
  let i = 0, amb = false, sp = false;
  const n = src.length;
  const push = (o) => { o.sp = sp; sp = false; toks.push(o); };
  while (i < n) {
    if (toks.length > MAX_TOKENS) return null;
    const ch = src[i];
    if (/\s/.test(ch)) { sp = true; i++; continue; }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = stickyAt(RE_NUM, src, i);
      let text = m[0], j = i + text.length, sci = null;
      const em = stickyAt(RE_EXP, src, j);
      if (em) {
        const neg = em[1] === '-';
        const ambiguous = neg && em[0][0] === 'e';
        if (ambiguous) amb = true;
        if (!(ambiguous && mode === 'split')) {
          sci = { m: text, e: (neg ? '-' : '') + em[2] };
          text = text + 'e' + sci.e;
          j += em[0].length;
        }
      }
      push({ t: 'num', v: text, sci, s: i, e: j });
      i = j; continue;
    }

    if (ch === '\u207b' || ch === '\u207a' || SUP[ch] !== undefined) {
      let j = i, neg = false;
      if (src[j] === '\u207b') { neg = true; j++; } else if (src[j] === '\u207a') j++;
      let ds = '';
      while (SUP[src[j]] !== undefined) { ds += SUP[src[j]]; j++; }
      if (!ds) return null;
      push({ t: 'op', v: '^', s: i, e: j });
      if (neg) push({ t: 'op', v: '-', s: i, e: j });
      push({ t: 'num', v: ds, sci: null, s: i, e: j });
      i = j; continue;
    }

    if (ch === '\u221a') { push({ t: 'id', v: 'sqrt', s: i, e: i + 1 }); i++; continue; }

    const im = stickyAt(RE_ID, src, i);
    if (im) {
      const word = im[0];
      let j = i + word.length;
      const lower = word.toLowerCase();
      const tok = { t: 'id', v: word, s: i };
      if (lower === 'log') {
        const bm = stickyAt(RE_LOGB, src, j);
        if (bm) { tok.base = bm[1]; j += bm[0].length; }
      }
      const ti = trigInfo(lower);
      if (ti) {
        tok.trig = { fn: ti.fn, inv: ti.inv };
        if (!ti.inv) {
          let mm;
          if ((mm = stickyAt(RE_INV_A, src, j)) || (mm = stickyAt(RE_INV_B, src, j)) || (mm = stickyAt(RE_INV_C, src, j))) {
            tok.trig.inv = true; j += mm[0].length;
          } else if ((mm = stickyAt(RE_GLUE, src, j))) {
            tok.glue = mm[0]; j += mm[0].length;
          }
        }
      } else if (isPlainUnitWord(word, lower)) {                // m2, ft3
        const gm = stickyAt(RE_UGLUE, src, j);
        if (gm) { tok.pw = +gm[0]; j += gm[0].length; }
      }
      tok.e = j;
      push(tok);
      i = j; continue;
    }

    if (ch === '*' && src[i + 1] === '*') { push({ t: 'op', v: '^', s: i, e: i + 2 }); i += 2; continue; }
    if ('+-*/%^!(),'.includes(ch)) { push({ t: 'op', v: ch, s: i, e: i + 1 }); i++; continue; }
    return null;
  }
  if (!toks.length) return null;
  return { toks: mergeWords(toks), amb };
}
