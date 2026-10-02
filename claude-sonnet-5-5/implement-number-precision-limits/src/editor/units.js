// Unit engine.
// dims = [length, mass, time, current, temperature, data, angle]
// Quantities are held in SI (kg, m, s, A, K, bit, rad).
import { D, PI } from './numeric.js';

export const dm = (L, M, T, I, Th, Da, An) => [L || 0, M || 0, T || 0, I || 0, Th || 0, Da || 0, An || 0];
export const ZERO = dm();
export const ANGLE = dm(0, 0, 0, 0, 0, 0, 1);
export const TH_D = dm(0, 0, 0, 0, 1);

export const PREFIXES = [
  { n: 'quetta', s: ['Q'], e: 30 }, { n: 'ronna', s: ['R'], e: 27 }, { n: 'yotta', s: ['Y'], e: 24 },
  { n: 'zetta', s: ['Z'], e: 21 }, { n: 'exa', s: ['E'], e: 18 }, { n: 'peta', s: ['P'], e: 15 },
  { n: 'tera', s: ['T'], e: 12 }, { n: 'giga', s: ['G'], e: 9 }, { n: 'mega', s: ['M'], e: 6 },
  { n: 'kilo', s: ['k'], e: 3 }, { n: 'hecto', s: ['h'], e: 2 }, { n: 'deca', alt: ['deka'], s: ['da'], e: 1 },
  { n: 'deci', s: ['d'], e: -1 }, { n: 'centi', s: ['c'], e: -2 }, { n: 'milli', s: ['m'], e: -3 },
  { n: 'micro', s: ['\u00b5', '\u03bc', 'u'], e: -6 }, { n: 'nano', s: ['n'], e: -9 },
  { n: 'pico', s: ['p'], e: -12 }, { n: 'femto', s: ['f'], e: -15 }, { n: 'atto', s: ['a'], e: -18 },
  { n: 'zepto', s: ['z'], e: -21 }, { n: 'yocto', s: ['y'], e: -24 }, { n: 'ronto', s: ['r'], e: -27 },
  { n: 'quecto', s: ['q'], e: -30 }
].map(p => Object.assign(p, { f: D.pow(10, p.e), sym: p.s[0] }));
export const pfOK = (def, p) => def.pf === 'all' || (def.pf === 'large' && p.e >= 3 && p.e % 3 === 0);

export const UNITS = [];
function U(syms, names, dims, f, pf, o) {
  const d = Object.assign({ syms, names, dims, f: (f instanceof D) ? f : new D(f), pf: pf || 'none' }, o || {});
  UNITS.push(d);
  return d;
}
const LBF = new D('4.4482216152605');
const INCH = new D('0.0254');
const dL = dm(1), dV = dm(3), dMass = dm(0, 1), dT = dm(0, 0, 1);

// length
U(['m'], ['meter', 'metre'], dL, '1', 'all', { fam: 'L' });
U(['mi'], ['mile'], dL, '1609.344', 'none', { fam: 'L', imp: 1 });
U(['yd'], ['yard'], dL, '0.9144', 'none', { fam: 'L', imp: 1 });
U(['ft'], ['foot'], dL, '0.3048', 'none', { fam: 'L', imp: 1, pl: ['feet'] });
U(['in'], ['inch'], dL, '0.0254', 'none', { fam: 'L', imp: 1, pl: ['inches'] });
// mass
U(['g'], ['gram', 'gramme'], dMass, '0.001', 'all', { fam: 'M' });
U(['oz'], ['ounce'], dMass, '0.028349523125', 'none', { fam: 'M', imp: 1 });
U(['lb', 'lbs'], ['pound'], dMass, '0.45359237', 'none', { fam: 'M', imp: 1 });
// time
U(['s'], ['second'], dT, '1', 'all', { fam: 'T' });
U(['min', 'mins'], ['minute'], dT, '60', 'none', { fam: 'T' });
U(['h', 'hr', 'hrs'], ['hour'], dT, '3600', 'none', { fam: 'T' });
U(['d'], ['day'], dT, '86400', 'none', { fam: 'T' });
U(['wk'], ['week'], dT, '604800', 'none', { fam: 'T' });
U(['mo'], ['month'], dT, '2629800', 'none', { fam: 'T' });
U(['y', 'yr', 'yrs'], ['year'], dT, '31557600', 'none', { fam: 'T' });
U([], ['decade'], dT, '315576000', 'none', { fam: 'T' });
U([], ['century'], dT, '3155760000', 'none', { fam: 'T', pl: ['centuries'] });
// area
U(['ac', 'acre'], ['acre'], dm(2), '4046.8564224', 'none', { imp: 1 });
// data (large prefixes only)
const dData = dm(0, 0, 0, 0, 0, 1), dRate = dm(0, 0, -1, 0, 0, 1);
U(['b'], ['bit'], dData, '1', 'large', {});
U(['B'], ['byte'], dData, '8', 'large', {});
U(['bps'], [], dRate, '1', 'large', {});
U(['Bps'], [], dRate, '8', 'large', {});
// energy
const dE = dm(2, 1, -2), dW = dm(2, 1, -3);
U(['J'], ['joule'], dE, '1', 'all', { fam: 'E' });
U(['cal'], ['calorie'], dE, '4.184', 'all', { fam: 'E' });
U(['Cal'], [], dE, '4184', 'none', { fam: 'E' });
U(['Wh'], ['watthour'], dE, '3600', 'all', { fam: 'E' });
// frequency
U(['Hz'], ['hertz'], dm(0, 0, -1), '1', 'all', { fam: 'Hz', pl: ['hertz'] });
// fuel economy
U(['mpg'], [], dm(-2), new D('1609.344').div('0.003785411784'), 'none', {});
// angle
U(['deg', '\u00b0'], ['degree'], ANGLE, PI.div(180), 'none', {});
U(['rad'], ['radian'], ANGLE, '1', 'none', {});
U(['grad', 'gon'], ['gradian'], ANGLE, PI.div(200), 'none', {});
// pressure
const dP = dm(-1, 1, -2);
U(['Pa'], ['pascal'], dP, '1', 'all', { fam: 'P' });
U(['bar'], ['bar'], dP, '100000', 'all', { fam: 'P' });
U(['atm'], ['atmosphere'], dP, '101325', 'none', { fam: 'P' });
U(['PSI', 'psi'], [], dP, LBF.div(INCH.pow(2)), 'none', { fam: 'P', imp: 1 });
// speed
const dSpd = dm(1, 0, -1);
U(['mph'], [], dSpd, '0.44704', 'none', {});
U(['kph'], [], dSpd, new D(1000).div(3600), 'none', {});
U(['kn', 'kt'], ['knot'], dSpd, new D(1852).div(3600), 'none', {});
// temperature
U(['K'], ['kelvin'], TH_D, '1', 'all', { fam: 'Th', pl: ['kelvin'] });
U(['\u00b0C', 'degC'], ['celsius', 'celcius'], TH_D, '1', 'none', { offset: new D('273.15'), pl: ['celsius'] });
U(['\u00b0F', 'degF'], ['fahrenheit', 'farenheit'], TH_D, new D(5).div(9), 'none', { offset: new D('459.67'), pl: ['fahrenheit'] });
// volume (US customary, imperial variants)
U(['L', 'l'], ['liter', 'litre'], dV, '0.001', 'all', { fam: 'V' });
const gal = U(['gal'], ['gallon'], dV, '0.003785411784', 'none', {});
const pt = U(['pt'], ['pint'], dV, '0.000473176473', 'none', {});
const qt = U(['qt'], ['quart'], dV, '0.000946352946', 'none', {});
const cup = U(['cup'], ['cup'], dV, '0.0002365882365', 'none', {});
U(['tbsp'], ['tablespoon'], dV, '0.00001478676478125', 'none', {});
U(['tsp'], ['teaspoon'], dV, '0.00000492892159375', 'none', {});
const floz = U(['fl oz'], ['floz'], dV, '0.0000295735295625', 'none', {});
gal.impDef = U(['imp gal'], [], dV, '0.00454609', 'none', {});
pt.impDef = U(['imp pt'], [], dV, '0.00056826125', 'none', {});
qt.impDef = U(['imp qt'], [], dV, '0.0011365225', 'none', {});
cup.impDef = U(['imp cup'], [], dV, '0.000284130625', 'none', {});
floz.impDef = U(['imp fl oz'], [], dV, '0.0000284130625', 'none', {});
// power
U(['W'], ['watt'], dW, '1', 'all', { fam: 'W' });
U(['HP', 'hp'], ['horsepower'], dW, '745.69987158227022', 'none', { fam: 'W' });
U(['PS'], [], dW, '735.49875', 'none', { fam: 'W' });
// force / current / voltage / resistance
U(['N'], ['newton'], dm(1, 1, -2), '1', 'all', { fam: 'F' });
U(['lbf'], ['poundforce'], dm(1, 1, -2), LBF, 'none', { fam: 'F', imp: 1 });
U(['A'], ['ampere', 'amp'], dm(0, 0, 0, 1), '1', 'all', { fam: 'I' });
U(['V'], ['volt'], dm(2, 1, -3, -1), '1', 'all', { fam: 'V' });
U(['\u03a9', 'ohm'], ['ohm'], dm(2, 1, -3, -2), '1', 'all', { fam: 'R' });

/* ---- lookup tables ---- */
const defsIdx = new Map(UNITS.map((u, i) => [u, i]));
const rdCache = new Map();
export function mkRd(def, pref) {
  const k = defsIdx.get(def) + '|' + (pref ? pref.sym : '');
  let r = rdCache.get(k);
  if (r) return r;
  const base = def.syms[0] || def.names[0];
  const sym = (pref ? pref.sym : '') + base;
  r = { def, pref, sym, ou: {
    sym, f: pref ? def.f.times(pref.f) : def.f, dims: def.dims, def, pref,
    fam: def.fam, imp: def.imp, offset: def.offset, pf: pref ? 'none' : def.pf
  } };
  rdCache.set(k, r);
  return r;
}
export const EXACT = new Map();
const LOWER = new Map();
export const NAMES = new Map();
function pushLower(key, rd) {
  let a = LOWER.get(key);
  if (!a) { a = []; LOWER.set(key, a); }
  if (!a.includes(rd)) a.push(rd);
}
for (const def of UNITS) for (const s of def.syms) {
  if (def.pf === 'none') continue;
  for (const p of PREFIXES) {
    if (!pfOK(def, p)) continue;
    for (const ps of p.s) {
      const key = ps + s, rd = mkRd(def, p);
      if (!EXACT.has(key)) EXACT.set(key, rd);
      pushLower(key.toLowerCase(), rd);
    }
  }
}
for (const def of UNITS) for (const s of def.syms) {          // exact base-unit match beats prefix+unit
  const rd = mkRd(def, null);
  EXACT.set(s, rd);
  pushLower(s.toLowerCase(), rd);
}
for (const def of UNITS) {
  for (const nm of def.names) {
    NAMES.set(nm, def); NAMES.set(nm + 's', def);
  }
  (def.pl || []).forEach(p => NAMES.set(p, def));
}

const rwCache = new Map();
export function resolveUnitWord(word) {
  if (rwCache.has(word)) return rwCache.get(word);
  const r = resolveUnitWord0(word);
  rwCache.set(word, r);
  return r;
}
function caseScore(typed, sym) {
  let s = 0;
  for (let i = 0; i < Math.min(typed.length, sym.length); i++) if (typed[i] === sym[i]) s++;
  return s;
}
function resolveUnitWord0(word) {
  const ex = EXACT.get(word);
  if (ex) return { rds: [ex], folded: false, long: false };
  const lw = word.toLowerCase();
  if (lw.startsWith('imp ')) {
    const b = resolveUnitWord(word.slice(4));
    if (b && b.rds.length === 1 && b.rds[0].def.impDef) {
      return { rds: [mkRd(b.rds[0].def.impDef, null)], folded: false, long: b.long };
    }
    return null;
  }
  const nm = NAMES.get(lw);
  if (nm) return { rds: [mkRd(nm, null)], folded: false, long: true };
  for (const p of PREFIXES) for (const pn of [p.n].concat(p.alt || [])) {
    if (lw.length > pn.length && lw.startsWith(pn)) {
      const d = NAMES.get(lw.slice(pn.length));
      if (d && pfOK(d, p)) return { rds: [mkRd(d, p)], folded: false, long: true };
    }
  }
  const lo = LOWER.get(lw);
  if (lo && lo.length) {
    return { rds: lo.slice().sort((a, b) => caseScore(word, b.sym) - caseScore(word, a.sym)), folded: true, long: false };
  }
  return null;
}

/* ---- output units (curated lists, compound units, derived units) ---- */
const outCache = new Map();
function unitPow(s) {
  const m = /^(.+?)(?:\^(\d))?$/.exec(s);
  const o = EXACT.get(m[1]);
  if (!o) return null;
  const p = m[2] ? +m[2] : 1;
  return { f: o.ou.f.pow(p), dims: o.ou.dims.map(c => c * p) };
}
export function mkOut(s) {
  if (outCache.has(s)) return outCache.get(s);
  let r = null;
  const ex = EXACT.get(s);
  if (ex) r = ex.ou;
  else {
    const parts = s.split('/');
    if (parts.length === 2) {
      const a = unitPow(parts[0]), b = unitPow(parts[1]);
      if (a && b) r = { sym: s, f: a.f.div(b.f), dims: a.dims.map((c, i) => c - b.dims[i]), compound: true };
    } else {
      const a = unitPow(s);
      if (a) r = { sym: s, f: a.f, dims: a.dims, compound: true };
    }
  }
  outCache.set(s, r);
  return r;
}
export function compoundOu(ents) {
  const part = (en, n) => en.ou.sym + (n !== 1 ? '^' + n : '');
  const num = ents.filter(x => x.e > 0).map(x => part(x, x.e));
  const den = ents.filter(x => x.e < 0).map(x => part(x, -x.e));
  let sym = num.length ? num.join('\u00b7') : '1';
  if (den.length) sym += '/' + (den.length > 1 ? '(' + den.join('\u00b7') + ')' : den[0]);
  let f = new D(1), dims = ZERO;
  for (const en of ents) {
    f = f.times(en.ou.f.pow(en.e));
    dims = dims.map((c, i) => c + en.ou.dims[i] * en.e);
  }
  return { sym, f, dims, compound: true };
}
export function siCompound(d) {
  const syms = ['m', 'kg', 's', 'A', 'K', 'bit', 'rad'];
  const ents = [];
  d.forEach((e, i) => {
    if (e) ents.push({ e, ou: { sym: syms[i], f: new D(1), dims: dm(...ZERO.map((_, j) => (j === i ? 1 : 0))) } });
  });
  return ents.length ? compoundOu(ents) : null;
}

export const DERIVED = new Map();
export const dkey = (a) => a.slice().sort().join(',');
DERIVED.set(dkey(['I1', 'V1']), () => ['W']);
DERIVED.set(dkey(['T1', 'W1']), (ents) => (ents.some(e => e.ou.sym === 'h') ? ['Wh'] : ['J']));
DERIVED.set(dkey(['E1', 'T-1']), () => ['W']);
DERIVED.set(dkey(['F1', 'L-2']), () => ['Pa']);
DERIVED.set(dkey(['L2', 'P1']), (ents) => (ents.some(e => e.ou.imp) ? ['lbf'] : ['N']));
DERIVED.set(dkey(['T-1']), () => ['Hz']);
DERIVED.set(dkey(['I-1', 'V1']), () => ['\u03a9']);
DERIVED.set(dkey(['I-1', 'W1']), () => ['V']);
DERIVED.set(dkey(['V-1', 'W1']), () => ['A']);
DERIVED.set(dkey(['R-1', 'V1']), () => ['A']);
DERIVED.set(dkey(['I1', 'R1']), () => ['V']);

export const ENG = ['k', 'M', 'G', 'm', '\u00b5', 'n'];

export const CURATED = {};
const CUR = (d, list) => { CURATED[d.join(',')] = list; };
CUR(dL, ['mi', 'm', 'km', 'ft', 'in', 'yd', 'cm', 'mm']);
CUR(dm(2), ['km^2', 'acre', 'ft^2', 'm^2', 'mi^2', 'cm^2']);
CUR(dV, ['L', 'gal', 'qt', 'pt', 'cup', 'fl oz', 'mL', 'tbsp', 'tsp', 'm^3', 'ft^3', 'in^3']);
CUR(dMass, ['kg', 'lb', 'g', 'oz', 'mg']);
CUR(dT, ['s', 'min', 'h', 'd', 'wk', 'mo', 'y']);
CUR(dSpd, ['m/s', 'mph', 'kph', 'ft/s', 'kn']);
CUR(dP, ['Pa', 'kPa', 'bar', 'PSI', 'atm']);
CUR(dm(1, 1, -2), ['N', 'lbf', 'kN']);
CUR(dE, ['J', 'kJ', 'cal', 'kcal', 'Wh', 'kWh']);
CUR(dW, ['W', 'kW', 'HP', 'PS']);
CUR(dm(0, 0, -1), ['Hz', 'kHz', 'MHz', 'GHz']);
CUR(dm(0, 0, 0, 1), ['A', 'mA', '\u00b5A']);
CUR(dm(2, 1, -3, -1), ['V', 'mV', 'kV']);
CUR(dm(2, 1, -3, -2), ['\u03a9', 'k\u03a9', 'M\u03a9', 'm\u03a9']);
CUR(TH_D, ['K']);
CUR(dData, ['B', 'kB', 'MB', 'GB', 'TB', 'b', 'kb', 'Mb', 'Gb']);
CUR(dRate, ['bps', 'kbps', 'Mbps', 'Gbps', 'kB/s', 'MB/s', 'GB/s']);
CUR(dm(-2), ['mpg', 'km/L']);
CUR(ANGLE, ['rad', 'deg', 'grad']);
export const CURATED_TEMP_ABS = ['\u00b0C', '\u00b0F', 'K'];
