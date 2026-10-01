// Unit candidates -> chip items
import { MAX_ALTS } from './numeric.js';
import { CURATED, CURATED_TEMP_ABS, DERIVED, dkey, ENG, mkOut, compoundOu, siCompound } from './units.js';
import { cleanVal, fmtAlt, fmtAltWritten, formatValue } from './format.js';
import { dEq, dZero } from './evaluator.js';

function deriveFromU(um) {
  const ents = Object.keys(um).map(k => um[k]).filter(x => x.e !== 0);
  if (!ents.length) return { list: [], variants: [] };
  if (ents.length === 1 && ents[0].e === 1) return { list: [ents[0].ou], variants: [] };
  const sig = ents.map(x => x.ou.fam ? x.ou.fam + x.e : null);
  if (sig.every(Boolean)) {
    const fn = DERIVED.get(dkey(sig));
    if (fn) {
      const outs = fn(ents).map(mkOut).filter(Boolean);
      const variants = [];
      outs.forEach(o => {
        if (o.pf === 'all') for (const p of ENG) { const v = mkOut(p + o.sym); if (v) variants.push(v); }
      });
      return { list: outs, variants };
    }
  }
  return { list: [compoundOu(ents)], variants: [] };
}
function ouUniq(arr) {
  const seen = new Set(), out = [];
  for (const o of arr) { if (!o || seen.has(o.sym)) continue; seen.add(o.sym); out.push(o); }
  return out;
}
export function candidateUnits(q) {
  const okU = (o) => dEq(o.dims, q.d) && (o.offset === undefined || !!q.t);
  let oper = [], variants = [];
  if (q.t) oper.push(q.t.ou);
  else for (const um of q.us) { const r = deriveFromU(um); oper = oper.concat(r.list); variants = variants.concat(r.variants); }
  oper = ouUniq(oper).filter(okU);
  variants = ouUniq(variants).filter(okU);
  let cur = ouUniq((q.t ? CURATED_TEMP_ABS : (CURATED[q.d.join(',')] || [])).map(mkOut)).filter(okU);
  if (!oper.length && !cur.length) { const si = siCompound(q.d); if (si) cur = [si]; }
  return { oper, variants, cur };
}
export function longName(ou, numStr) {
  if (!ou.def || !ou.def.names[0]) return ou.sym;
  const one = numStr === '1' || numStr === '-1';
  const base = one ? ou.def.names[0] : ((ou.def.pl && ou.def.pl[0]) || ou.def.names[0] + 's');
  return (ou.pref ? ou.pref.n : '') + base;
}
// the unit's name as the user would type it as a conversion target
export function targetWord(ou, long) {
  if (long && ou.def && ou.def.names[0]) return (ou.pref ? ou.pref.n : '') + ou.def.names[0];
  return ou.sym;
}

// items carry `x`, the cleaned numeric value (in the displayed unit), so that the
// suggestion engine can extend digits the user has already typed.
export function itemsForQ(q, st) {
  const items = [];
  if (dZero(q.d) && !q.t) {
    const l = formatValue(q.v, st.precise);
    const x = cleanVal(q.v);
    if (l) l.forEach((s, i) => items.push({ num: s, unit: '', kind: i ? 'ladder' : 'primary', x }));
    return items;
  }
  const cu = candidateUnits(q);
  const valOf = (ou) => q.t ? q.v.div(ou.f).minus(ou.offset || 0) : q.v.div(ou.f);
  const utext = (ou, s) => (st.long && ou.def) ? longName(ou, s) : ou.sym;

  if (st.bare) {                                           // conversions only
    const own = new Set(cu.oper.map(o => o.sym));
    for (const o of cu.cur) {
      if (own.has(o.sym)) continue;
      const s = fmtAlt(valOf(o));
      if (s !== null) {
        items.push({ num: s, unit: utext(o, s), kind: 'alt', x: cleanVal(valOf(o)) });
        const w = fmtAltWritten(valOf(o));              // scientific -> also written out in full
        if (w && w !== s) items.push({ num: w, unit: utext(o, w), kind: 'alt', x: cleanVal(valOf(o)) });
      }
      if (items.length >= MAX_ALTS) break;
    }
    return items;
  }

  const pool = cu.oper.concat(cu.variants, cu.cur);
  let primary = null;
  if (!q.v.isZero()) primary = pool.find(o => { const a = cleanVal(valOf(o)); return a && a.abs().gte(1) && a.abs().lt(1000); });
  if (!primary) primary = cu.oper[0] || cu.cur[0];
  if (!primary) return items;
  const list = formatValue(valOf(primary), st.precise);
  if (!list) return items;
  const px = cleanVal(valOf(primary));
  items.push({ num: list[0], unit: utext(primary, list[0]), kind: 'primary', x: px });
  const rest = ouUniq(cu.oper.concat(cu.cur)).filter(o => o.sym !== primary.sym);
  let n = 0;
  for (const o of rest) {
    const s = fmtAlt(valOf(o));
    if (s === null) continue;
    items.push({ num: s, unit: utext(o, s), kind: 'alt', x: cleanVal(valOf(o)) });
    const w = fmtAltWritten(valOf(o));                  // scientific -> also written out in full
    if (w && w !== s) items.push({ num: w, unit: utext(o, w), kind: 'alt', x: cleanVal(valOf(o)) });
    if (++n >= MAX_ALTS) break;
  }
  list.slice(1).forEach(s => items.push({ num: s, unit: utext(primary, s), kind: 'ladder', x: px }));
  return items;
}
