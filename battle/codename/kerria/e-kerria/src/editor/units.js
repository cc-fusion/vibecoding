import Decimal from 'decimal.js';

export const BASE_UNITS = ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'];
const D = Decimal.clone({ precision: 60, rounding: 4 });
const dim = (values = []) => Object.fromEntries(BASE_UNITS.map((key, i) => [key, values[i] || 0]));
const entry = (name, factor, dimensions, system = 'metric', extra = {}) => ({ name, factor: String(factor), dimension: dim(dimensions), system, ...extra });

export function defaultUnits() {
  const units = {
    kg: entry('kilogram', 1, [1]),
    m: entry('metre', 1, [0, 1]),
    s: entry('second', 1, [0, 0, 1]),
    A: entry('ampere', 1, [0, 0, 0, 1]),
    K: entry('kelvin', 1, [0, 0, 0, 0, 1]),
    mol: entry('mole', 1, [0, 0, 0, 0, 0, 1]),
    cd: entry('candela', 1, [0, 0, 0, 0, 0, 0, 1]),
    g: entry('gram', '0.001', [1]),
    t: entry('tonne', 1000, [1]),
    N: entry('newton', 1, [1, 1, -2]),
    J: entry('joule', 1, [1, 2, -2]),
    W: entry('watt', 1, [1, 2, -3]),
    Pa: entry('pascal', 1, [1, -1, -2]),
    Hz: entry('hertz', 1, [0, 0, -1]),
    C: entry('coulomb', 1, [0, 0, 1, 1]),
    V: entry('volt', 1, [1, 2, -3, -1]),
    F: entry('farad', 1, [-1, -2, 4, 2]),
    ohm: entry('ohm', 1, [1, 2, -3, -2], 'metric', { aliases: ['Ω'] }),
    S: entry('siemens', 1, [-1, -2, 3, 2]),
    Wb: entry('weber', 1, [1, 2, -2, -1]),
    T: entry('tesla', 1, [1, 0, -2, -1]),
    H: entry('henry', 1, [1, 2, -2, -2]),
    L: entry('litre', '0.001', [0, 3], 'metric', { aliases: ['l'] }),
    min: entry('minute', 60, [0, 0, 1], 'other'),
    h: entry('hour', 3600, [0, 0, 1], 'other'),
    hr: entry('hour', 3600, [0, 0, 1], 'other'),
    day: entry('day', 86400, [0, 0, 1], 'other'),
    bar: entry('bar', 100000, [1, -1, -2], 'other'),
    atm: entry('atmosphere', 101325, [1, -1, -2], 'other'),
    eV: entry('electronvolt', '1.602176634e-19', [1, 2, -2], 'other'),
    in: entry('inch', '0.0254', [0, 1], 'imperial'),
    ft: entry('foot', '0.3048', [0, 1], 'imperial'),
    yd: entry('yard', '0.9144', [0, 1], 'imperial'),
    mi: entry('mile', '1609.344', [0, 1], 'imperial'),
    nmi: entry('nautical mile', '1852', [0, 1], 'other'),
    oz: entry('ounce', '0.028349523125', [1], 'imperial'),
    lbs: entry('pound', '0.45359237', [1], 'imperial', { aliases: ['lb'] }),
    st: entry('stone', '6.35029318', [1], 'imperial'),
    ton: entry('US ton', '907.18474', [1], 'imperial'),
    slug: entry('slug', '14.5939029372', [1], 'imperial'),
    floz: entry('US fluid ounce', '0.0000295735295625', [0, 3], 'imperial', { aliases: ['fl oz'] }),
    cup: entry('US cup', '0.0002365882365', [0, 3], 'imperial'),
    pt: entry('US pint', '0.000473176473', [0, 3], 'imperial'),
    qt: entry('US quart', '0.000946352946', [0, 3], 'imperial'),
    gal: entry('US gallon', '0.003785411784', [0, 3], 'imperial'),
    psi: entry('pound per square inch', '6894.757293168', [1, -1, -2], 'imperial'),
    mph: entry('mile per hour', '0.44704', [0, 1, -1], 'imperial'),
    acre: entry('acre', '4046.8564224', [0, 2], 'imperial'),
    rad: entry('radian', 1, [], 'other', { angle: 'rad' }),
    deg: entry('degree', '0.017453292519943295769236907684886', [], 'other', { angle: 'deg', aliases: ['°'] }),
    percent: entry('percent', '0.01', [], 'other', { aliases: ['%'] }),
  };
  const prefixes = { Q: '1e30', R: '1e27', Y: '1e24', Z: '1e21', E: '1e18', P: '1e15', T: '1e12', G: '1e9', M: '1e6', k: '1000', h: '100', da: '10', d: '0.1', c: '0.01', m: '0.001', u: '1e-6', µ: '1e-6', μ: '1e-6', n: '1e-9', p: '1e-12', f: '1e-15', a: '1e-18', z: '1e-21', y: '1e-24', r: '1e-27', q: '1e-30' };
  for (const symbol of ['g', 'm', 's', 'A', 'K', 'mol', 'cd', 'N', 'J', 'W', 'Pa', 'Hz', 'C', 'V', 'F', 'S', 'Wb', 'T', 'H', 'L', 'l', 'Wh']) {
    if (symbol === 'Wh') units[symbol] = entry('watt-hour', 3600, [1, 2, -2]);
    const base = units[symbol] || (symbol === 'l' ? units.L : undefined);
    if (!base) continue;
    if (!units[symbol]) units[symbol] = { ...base, symbol };
    for (const [prefix, factor] of Object.entries(prefixes)) {
      if (units[prefix + symbol]) continue;
      units[prefix + symbol] = { ...base, name: `${prefix}${base.name}`, factor: new D(base.factor).mul(factor).toFixed(), prefixed: true };
    }
  }
  return units;
}

export function validateUnits(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The registry must be a JSON object.');
  if (Object.keys(data).length > 2000) throw new Error('Use at most 2,000 unit definitions.');
  for (const [symbol, definition] of Object.entries(data)) {
    if (!/^[a-zA-ZµμΩ°%][a-zA-ZµμΩ°% ]*$/.test(symbol) || symbol.length > 24) throw new Error(`Invalid unit symbol: ${symbol}`);
    if (!definition || typeof definition !== 'object' || !BASE_UNITS.every(key => Number.isInteger(definition.dimension?.[key]) && Math.abs(definition.dimension[key]) <= 100)) throw new Error(`${symbol}: specify integer SI dimensions between −100 and 100.`);
    try {
      const factor = new D(definition.factor);
      if (!factor.isFinite() || factor.lte(0)) throw new Error();
    } catch { throw new Error(`${symbol}: factor must be a positive decimal number or numeric string.`); }
    if (definition.system && !['metric', 'imperial', 'other'].includes(definition.system)) throw new Error(`${symbol}: system must be metric, imperial, or other.`);
  }
  return data;
}

export function compileUnits(registry) {
  const units = {};
  const aliases = {};
  for (const [symbol, definition] of Object.entries(registry)) {
    const unit = { ...definition, symbol, factor: new D(definition.factor), dimension: { ...definition.dimension } };
    units[symbol] = unit;
    aliases[symbol] = symbol;
    for (const alias of definition.aliases || []) aliases[alias] = symbol;
  }
  return { units, aliases, symbols: Object.keys(aliases).sort((a, b) => b.length - a.length) };
}

export const zeroDimension = () => dim();
export const dimensionKey = d => BASE_UNITS.map(k => d[k] || 0).join(',');
export const isDimensionless = d => BASE_UNITS.every(k => !d[k]);
export const sameDimension = (a, b) => dimensionKey(a) === dimensionKey(b);
export const combineDimensions = (a, b, direction = 1) => Object.fromEntries(BASE_UNITS.map(k => [k, (a[k] || 0) + direction * (b[k] || 0)]));
export const quantity = (value, dimension = dim(), extra = {}) => ({ value: Decimal.isDecimal(value) ? value : new D(value), dimension, ...extra });

export function matchUnit(text, index, catalog) {
  // Longer symbols win, but a metric prefix may not swallow a different known unit.
  for (const symbol of catalog.symbols) {
    if (!text.startsWith(symbol, index)) continue;
    const after = index + symbol.length;
    const rest = text.slice(after);
    const exponent = /^(?:\*\*|\^)?[+-]?\d/.test(rest);
    const compoundContinuation = /^[a-zA-ZµμΩ°]/.test(rest);
    if (compoundContinuation && !exponent && !/^(?:kg|m|s)(?=[+-]?\d)/.test(rest)) continue;
    return { unit: catalog.units[catalog.aliases[symbol]], symbol, end: after };
  }
  return null;
}

const superscripts = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
export function readExponent(text, index) {
  let i = index;
  // Exponents attach to their unit; whitespace before * is multiplication.
  if (text[i] === ' ') return null;
  let syntax = '';
  if (text.startsWith('**', i)) { syntax = '**'; i += 2; }
  else if (text[i] === '^') { syntax = '^'; i++; }
  while (text[i] === ' ') i++;
  let number = '';
  if (text[i] === '-' || text[i] === '+') number += text[i++];
  while (/\d/.test(text[i] || '') && number.length < 5) number += text[i++];
  if (number && number !== '-' && number !== '+') return { exponent: Number(number), end: i, syntax: syntax || 'adjacent' };
  let superText = '';
  i = index;
  while (superscripts[text[i]] !== undefined) superText += superscripts[text[i++]];
  if (superText && /^[-+]?\d+$/.test(superText)) return { exponent: Number(superText), end: i, syntax: 'superscript' };
  return null;
}

export function formatExponent(exponent, syntax = '**') {
  if (exponent === 1) return '';
  if (syntax === 'superscript') return String(exponent).split('').map(c => ({ '-': '⁻', '+': '⁺' }[c] || '⁰¹²³⁴⁵⁶⁸⁹'[Number(c)])).join('');
  return (syntax === 'adjacent' ? '' : syntax) + exponent;
}

const derivedOrder = ['J', 'N', 'W', 'Pa', 'V', 'F', 'C', 'Wb', 'T', 'H', 'ohm', 'S', 'Hz'];
export function simplifyUnit(dimension, catalog, preferredSystem = 'metric') {
  for (const symbol of derivedOrder) {
    const unit = catalog.units[symbol];
    if (unit && sameDimension(unit.dimension, dimension)) return { symbol, factors: [{ symbol, exponent: 1, syntax: '**' }], compound: false, gap: false };
  }
  const factors = BASE_UNITS.filter(key => dimension[key]).map(symbol => ({ symbol, exponent: dimension[symbol], syntax: '**' }));
  return { symbol: null, factors, compound: factors.length > 1, gap: factors.length > 1, system: preferredSystem };
}

export function formatUnit(descriptor) {
  if (!descriptor?.factors?.length) return '';
  const positive = descriptor.factors.filter(f => f.exponent > 0);
  const negative = descriptor.factors.filter(f => f.exponent < 0);
  const render = f => f.symbol + formatExponent(f.exponent, f.syntax);
  let result = positive.length ? positive.map(render).join('·') : '1';
  if (negative.length) result += '/' + (negative.length > 1 ? '(' + negative.map(f => render({ ...f, exponent: -f.exponent })).join('·') + ')' : render({ ...negative[0], exponent: -negative[0].exponent }));
  return result;
}

function familyFor(dimension, catalog) {
  const key = dimensionKey(dimension);
  const families = [
    { dimension: dim([1]), units: ['mg', 'g', 'kg', 't'], imperial: ['oz', 'lbs', 'ton'], base: 'kg' },
    { dimension: dim([0, 1]), units: ['mm', 'm', 'km'], imperial: ['in', 'ft', 'mi'], base: 'm' },
    { dimension: dim([0, 0, 1]), units: ['ns', 'ms', 's', 'min', 'h', 'day'], imperial: ['s', 'min', 'h', 'day'], base: 's' },
    { dimension: dim([0, 3]), units: ['mL', 'L', 'm3'], imperial: ['floz', 'cup', 'gal'], base: 'm3' },
    { dimension: dim([0, 1, -1]), units: ['m/s', 'km/h'], imperial: ['ft/s', 'mph'], base: 'm/s' },
  ];
  for (const family of families) if (dimensionKey(family.dimension) === key) return family;
  for (const symbol of derivedOrder) {
    const unit = catalog.units[symbol];
    if (unit && sameDimension(unit.dimension, dimension)) return { dimension, units: [symbol], imperial: [symbol], base: symbol };
  }
  return null;
}

function normalizeMetric(q, catalog, preserve = false) {
  const family = familyFor(q.dimension, catalog);
  if (!family) return simplifyUnit(q.dimension, catalog);
  const candidates = family.units.map(symbol => {
    if (catalog.units[symbol]) return { symbol, factor: catalog.units[symbol].factor, descriptor: { symbol, factors: [{ symbol, exponent: 1, syntax: '**' }], compound: false, gap: false } };
    const descriptor = descriptorForSymbol(symbol, catalog);
    return descriptor ? { symbol, factor: descriptor.factor, descriptor: { ...descriptor, symbol } } : null;
  }).filter(Boolean);
  const source = q.display?.symbol;
  if (preserve && source) {
    const existing = candidates.find(c => c.symbol === source);
    if (existing) return existing.descriptor;
  }
  const current = candidates.find(c => c.symbol === source);
  if (current) {
    const magnitude = q.value.div(current.factor).abs();
    if (magnitude.gte(1) && (magnitude.lt(1000) || source === 'kg')) return current.descriptor;
  }
  const eligible = candidates.filter(c => {
    const n = q.value.div(c.factor).abs();
    return n.gte(1) && n.lt(1000);
  });
  if (eligible.length) {
    // Prefer the original SI family over an opportunistic volume conversion.
    const chosen = eligible.find(c => c.symbol === family.base) || eligible[0];
    return chosen.descriptor;
  }
  if (!q.value.isZero()) {
    let best = candidates[0];
    let distance = Infinity;
    for (const candidate of candidates) {
      const n = q.value.div(candidate.factor).abs().logarithm(10).abs().toNumber();
      if (n < distance) { distance = n; best = candidate; }
    }
    if (best) return best.descriptor;
  }
  return simplifyUnit(q.dimension, catalog);
}

function descriptorForSymbol(symbol, catalog) {
  if (catalog.units[symbol]) return { factors: [{ symbol, exponent: 1, syntax: '**' }], factor: catalog.units[symbol].factor, compound: false, gap: false };
  const pieces = symbol.split('/');
  const factors = [];
  let factor = new D(1);
  for (let side = 0; side < pieces.length; side++) {
    const match = catalog.symbols.find(s => s === pieces[side]);
    if (!match) return null;
    const unit = catalog.units[catalog.aliases[match]];
    factors.push({ symbol: match, exponent: side ? -1 : 1, syntax: '**' });
    factor = side ? factor.div(unit.factor) : factor.mul(unit.factor);
  }
  return { factors, factor, compound: factors.length > 1, gap: false };
}

export function normalizeQuantity(q, catalog, preference = 'metric', explicit = false) {
  if (isDimensionless(q.dimension)) return { ...q, display: null };
  if (explicit && q.requestedDisplay) return { ...q, display: q.requestedDisplay };
  if (preference === 'imperial') {
    const family = familyFor(q.dimension, catalog);
    if (family) {
      const available = family.imperial.filter(s => catalog.units[s]);
      let eligible = available.filter(s => q.value.div(catalog.units[s].factor).abs().gte(1) && q.value.div(catalog.units[s].factor).abs().lt(1000));
      let chosen = eligible.sort((a, b) => catalog.units[b].factor.cmp(catalog.units[a].factor))[0];
      if (!chosen && available.length) chosen = available.reduce((a, b) => q.value.div(catalog.units[a].factor).abs().logarithm(10).abs().lt(q.value.div(catalog.units[b].factor).abs().logarithm(10).abs()) ? a : b);
      if (chosen) return { ...q, display: { symbol: chosen, factors: [{ symbol: chosen, exponent: 1, syntax: '**' }], compound: false, gap: false } };
    }
  }
  // Derived units take precedence over their expanded SI base representation.
  const simplified = simplifyUnit(q.dimension, catalog, preference);
  if (simplified.symbol && !q.display?.compound) return { ...q, display: simplified };
  if (q.display?.factors?.length && q.display.symbol && catalog.units[q.display.symbol] && sameDimension(catalog.units[q.display.symbol].dimension, q.dimension)) {
    const sourceFactor = catalog.units[q.display.symbol].factor;
    const n = q.value.div(sourceFactor).abs();
    if (n.gte(1) && (n.lt(1000) || q.display.symbol === 'kg')) return q;
  }
  if (!familyFor(q.dimension, catalog) && q.display?.factors?.length) {
    return { ...q, display: { ...simplified, factors: simplified.factors.map(f => ({ ...f, syntax: q.display.factors.find(original => original.symbol === f.symbol)?.syntax || f.syntax })), gap: q.display.gap } };
  }
  const normalized = normalizeMetric(q, catalog, false);
  if (q.display?.compound && !normalized.symbol) normalized.gap = true;
  return { ...q, display: normalized };
}

export function alternativeQuantity(q, catalog, preference) {
  if (isDimensionless(q.dimension)) return null;
  const family = familyFor(q.dimension, catalog);
  if (!family) return null;
  if (preference === 'imperial') {
    return normalizeQuantity({ ...q, display: null }, catalog, 'metric');
  }
  const available = family.imperial.filter(s => catalog.units[s]);
  if (!available.length || available.every(s => catalog.units[s].system === 'metric')) return null;
  const eligible = available.filter(s => q.value.div(catalog.units[s].factor).abs().gte(1) && q.value.div(catalog.units[s].factor).abs().lt(1000));
  let chosen = eligible.sort((a, b) => catalog.units[b].factor.cmp(catalog.units[a].factor))[0];
  if (!chosen) chosen = available.reduce((a, b) => q.value.div(catalog.units[a].factor).abs().logarithm(10).abs().lt(q.value.div(catalog.units[b].factor).abs().logarithm(10).abs()) ? a : b);
  return { ...q, display: { symbol: chosen, factors: [{ symbol: chosen, exponent: 1, syntax: '**' }], compound: false, gap: false } };
}

export function unitOptions(q, catalog) {
  if (isDimensionless(q.dimension)) return [];
  const options = Object.values(catalog.units).filter(u => sameDimension(u.dimension, q.dimension) && !u.angle && u.symbol !== 'percent');
  const seen = new Set();
  return options.filter(u => {
    const key = u.factor.toFixed() + ':' + dimensionKey(u.dimension);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => ({ imperial: 0, metric: 1, other: 2 }[a.system || 'other'] - { imperial: 0, metric: 1, other: 2 }[b.system || 'other']));
}

export function convertQuantity(q, target, catalog) {
  if (!sameDimension(q.dimension, target.dimension)) throw new Error(`Cannot convert ${formatUnit(simplifyUnit(q.dimension, catalog)) || 'a scalar'} to ${target.symbol}.`);
  return { ...q, display: { symbol: target.symbol, factors: [{ symbol: target.symbol, exponent: 1, syntax: '**' }], compound: false, gap: false }, requestedDisplay: { symbol: target.symbol, factors: [{ symbol: target.symbol, exponent: 1, syntax: '**' }], compound: false, gap: false } };
}

export { D as UnitDecimal };
