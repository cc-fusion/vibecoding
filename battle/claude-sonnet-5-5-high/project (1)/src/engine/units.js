import Decimal from 'decimal.js';

// Seven SI base units. Mass is tracked in kilograms.
export const BASE = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'];

export const SI_PREFIXES = {
  Y: 24, Z: 21, E: 18, P: 15, T: 12, G: 9, M: 6, k: 3, h: 2, da: 1,
  d: -1, c: -2, m: -3, 'µ': -6, 'μ': -6, u: -6, n: -9, p: -12, f: -15, a: -18, z: -21, y: -24,
};

const PREFIX_KEYS = Object.keys(SI_PREFIXES).sort((a, b) => b.length - a.length);

export const ANGLE_UNITS = {
  deg: 'deg', degs: 'deg', degree: 'deg', degrees: 'deg', '°': 'deg',
  rad: 'rad', rads: 'rad', radian: 'rad', radians: 'rad',
};

/**
 * Default known units. Editable as JSON in Settings → Developer.
 *  - symbols:   accepted spellings (first one is used for display)
 *  - factor:    value of 1 unit in SI base units (kg, m, s, ...)
 *  - dims:      exponents of the seven SI base units
 *  - system:    "metric" | "imperial" | "any"
 *  - prefixes:  accept SI prefixes when parsing (km, mg, ...)
 *  - suggest:   prefixes eligible for automatic suggestions, or false to never suggest
 *  - autoMin:   smallest value (in this unit) at which it is preferred (default 1)
 */
export const DEFAULT_UNITS = [
  { name: 'gram', symbols: ['g', 'gram', 'grams'], factor: '0.001', dims: { kg: 1 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', '', 'k'] },
  { name: 'meter', symbols: ['m', 'meter', 'meters', 'metre', 'metres'], factor: '1', dims: { m: 1 }, system: 'metric', prefixes: true, suggest: ['p', 'n', 'µ', 'm', 'c', '', 'k'] },
  { name: 'second', symbols: ['s', 'sec', 'second', 'seconds'], factor: '1', dims: { s: 1 }, system: 'any', prefixes: true, suggest: ['n', 'µ', 'm', ''] },
  { name: 'minute', symbols: ['min', 'minute', 'minutes'], factor: '60', dims: { s: 1 }, system: 'any' },
  { name: 'hour', symbols: ['h', 'hr', 'hour', 'hours'], factor: '3600', dims: { s: 1 }, system: 'any' },
  { name: 'day', symbols: ['d', 'day', 'days'], factor: '86400', dims: { s: 1 }, system: 'any' },
  { name: 'year', symbols: ['yr', 'year', 'years'], factor: '31557600', dims: { s: 1 }, system: 'any', suggest: false },
  { name: 'ampere', symbols: ['A', 'amp', 'amps'], factor: '1', dims: { A: 1 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', ''] },
  { name: 'kelvin', symbols: ['K', 'kelvin'], factor: '1', dims: { K: 1 }, system: 'metric', prefixes: true },
  { name: 'mole', symbols: ['mol', 'mole', 'moles'], factor: '1', dims: { mol: 1 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', ''] },
  { name: 'candela', symbols: ['cd', 'candela'], factor: '1', dims: { cd: 1 }, system: 'metric' },

  { name: 'hertz', symbols: ['Hz', 'hertz'], factor: '1', dims: { s: -1 }, system: 'metric', prefixes: true, suggest: ['', 'k', 'M', 'G'] },
  { name: 'newton', symbols: ['N', 'newton', 'newtons'], factor: '1', dims: { kg: 1, m: 1, s: -2 }, system: 'metric', prefixes: true, suggest: ['m', '', 'k', 'M'] },
  { name: 'pascal', symbols: ['Pa', 'pascal', 'pascals'], factor: '1', dims: { kg: 1, m: -1, s: -2 }, system: 'metric', prefixes: true, suggest: ['', 'k', 'M'] },
  { name: 'joule', symbols: ['J', 'joule', 'joules'], factor: '1', dims: { kg: 1, m: 2, s: -2 }, system: 'metric', prefixes: true, suggest: ['m', '', 'k', 'M', 'G'] },
  { name: 'watt', symbols: ['W', 'watt', 'watts'], factor: '1', dims: { kg: 1, m: 2, s: -3 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', '', 'k', 'M', 'G'] },
  { name: 'coulomb', symbols: ['C', 'coulomb', 'coulombs'], factor: '1', dims: { A: 1, s: 1 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', ''] },
  { name: 'volt', symbols: ['V', 'volt', 'volts'], factor: '1', dims: { kg: 1, m: 2, s: -3, A: -1 }, system: 'metric', prefixes: true, suggest: ['µ', 'm', '', 'k'] },
  { name: 'farad', symbols: ['F', 'farad', 'farads'], factor: '1', dims: { kg: -1, m: -2, s: 4, A: 2 }, system: 'metric', prefixes: true, suggest: ['p', 'n', 'µ', 'm', ''] },
  { name: 'ohm', symbols: ['\u03A9', '\u2126', 'ohm', 'ohms'], factor: '1', dims: { kg: 1, m: 2, s: -3, A: -2 }, system: 'metric', prefixes: true, suggest: ['', 'k', 'M'] },
  { name: 'liter', symbols: ['L', 'l', 'liter', 'liters', 'litre', 'litres'], factor: '0.001', dims: { m: 3 }, system: 'metric', prefixes: true, suggest: ['m', ''] },
  { name: 'bar', symbols: ['bar'], factor: '100000', dims: { kg: 1, m: -1, s: -2 }, system: 'metric', prefixes: true, suggest: false },
  { name: 'atmosphere', symbols: ['atm'], factor: '101325', dims: { kg: 1, m: -1, s: -2 }, system: 'metric', suggest: false },
  { name: 'calorie', symbols: ['cal', 'calorie', 'calories'], factor: '4.184', dims: { kg: 1, m: 2, s: -2 }, system: 'metric', prefixes: true, suggest: false },
  { name: 'watt hour', symbols: ['Wh'], factor: '3600', dims: { kg: 1, m: 2, s: -2 }, system: 'metric', prefixes: true, suggest: false },

  { name: 'inch', symbols: ['in', 'inch', 'inches'], factor: '0.0254', dims: { m: 1 }, system: 'imperial' },
  { name: 'foot', symbols: ['ft', 'foot', 'feet'], factor: '0.3048', dims: { m: 1 }, system: 'imperial' },
  { name: 'yard', symbols: ['yd', 'yard', 'yards'], factor: '0.9144', dims: { m: 1 }, system: 'imperial', suggest: false },
  { name: 'mile', symbols: ['mi', 'mile', 'miles'], factor: '1609.344', dims: { m: 1 }, system: 'imperial', autoMin: 0.5 },
  { name: 'ounce', symbols: ['oz', 'ounce', 'ounces'], factor: '0.028349523125', dims: { kg: 1 }, system: 'imperial' },
  { name: 'pound', symbols: ['lbs', 'lb', 'pound', 'pounds'], factor: '0.45359237', dims: { kg: 1 }, system: 'imperial' },
  { name: 'fluid ounce', symbols: ['floz', 'fluidounce'], factor: '0.0000295735295625', dims: { m: 3 }, system: 'imperial' },
  { name: 'teaspoon', symbols: ['tsp'], factor: '0.00000492892159375', dims: { m: 3 }, system: 'imperial', suggest: false },
  { name: 'tablespoon', symbols: ['tbsp'], factor: '0.00001478676478125', dims: { m: 3 }, system: 'imperial', suggest: false },
  { name: 'cup', symbols: ['cup', 'cups'], factor: '0.0002365882365', dims: { m: 3 }, system: 'imperial', suggest: false },
  { name: 'pint', symbols: ['pt', 'pint', 'pints'], factor: '0.000473176473', dims: { m: 3 }, system: 'imperial', suggest: false },
  { name: 'quart', symbols: ['qt', 'quart', 'quarts'], factor: '0.000946352946', dims: { m: 3 }, system: 'imperial', suggest: false },
  { name: 'gallon', symbols: ['gal', 'gallon', 'gallons'], factor: '0.003785411784', dims: { m: 3 }, system: 'imperial' },
  { name: 'miles per hour', symbols: ['mph'], factor: '0.44704', dims: { m: 1, s: -1 }, system: 'imperial' },
  { name: 'pound-force', symbols: ['lbf'], factor: '4.4482216152605', dims: { kg: 1, m: 1, s: -2 }, system: 'imperial' },
  { name: 'psi', symbols: ['psi'], factor: '6894.757293168', dims: { kg: 1, m: -1, s: -2 }, system: 'imperial' },
  { name: 'horsepower', symbols: ['hp'], factor: '745.69987158227', dims: { kg: 1, m: 2, s: -3 }, system: 'imperial' },
  { name: 'BTU', symbols: ['BTU', 'btu'], factor: '1055.05585262', dims: { kg: 1, m: 2, s: -2 }, system: 'imperial' },
];

export function defaultUnitsJson() {
  return JSON.stringify({ units: DEFAULT_UNITS }, null, 2);
}

const dimsKey = (d) => d.join(',');
export const isZeroDims = (d) => d.every((x) => x === 0);

export function normalizeUnits(list) {
  if (!Array.isArray(list)) throw new Error('"units" must be an array');
  const seen = new Set();
  return list.map((u, i) => {
    const where = `Unit #${i + 1}`;
    if (!u || typeof u !== 'object') throw new Error(`${where}: must be an object`);
    const symbols = Array.isArray(u.symbols) ? u.symbols.map(String) : u.symbol ? [String(u.symbol)] : [];
    if (!symbols.length) throw new Error(`${where}: "symbols" must be a non-empty array`);
    let factor;
    try { factor = new Decimal(String(u.factor ?? 1)); } catch { throw new Error(`${where} (${symbols[0]}): "factor" is not a number`); }
    if (!factor.isFinite() || factor.lte(0)) throw new Error(`${where} (${symbols[0]}): "factor" must be positive`);
    const rawDims = u.dims ?? {};
    for (const k of Object.keys(rawDims)) {
      if (!BASE.includes(k)) throw new Error(`${where} (${symbols[0]}): unknown base unit "${k}" (use ${BASE.join(', ')})`);
    }
    const dims = BASE.map((b) => {
      const n = Number(rawDims[b] ?? 0);
      if (!Number.isFinite(n)) throw new Error(`${where} (${symbols[0]}): exponent of "${b}" is not a number`);
      return n;
    });
    const system = ['metric', 'imperial', 'any'].includes(u.system) ? u.system : 'metric';
    symbols.forEach((s) => seen.add(s));
    return {
      name: String(u.name ?? symbols[0]),
      symbols,
      factor,
      dims,
      system,
      prefixes: !!u.prefixes,
      suggest: u.suggest === false ? false : Array.isArray(u.suggest) ? u.suggest.map(String) : [''],
      autoMin: u.autoMin != null ? new Decimal(String(u.autoMin)) : new Decimal(1),
    };
  });
}

export class Registry {
  constructor(unitList = DEFAULT_UNITS) {
    this.defs = normalizeUnits(unitList);
    this.bySymbol = new Map();
    for (const def of this.defs) for (const s of def.symbols) if (!this.bySymbol.has(s)) this.bySymbol.set(s, def);
    this.cache = new Map();
    this.byDims = new Map();
    for (const def of this.defs) {
      for (const v of this.variants(def)) {
        const k = dimsKey(def.dims);
        if (!this.byDims.has(k)) this.byDims.set(k, []);
        this.byDims.get(k).push(v);
      }
    }
    for (const list of this.byDims.values()) list.sort((a, b) => b.factor.cmp(a.factor));
  }

  prefixFactor(p) {
    return new Decimal(10).pow(SI_PREFIXES[p]);
  }

  variants(def) {
    if (def.suggest === false) return [];
    return def.suggest
      .filter((p) => p === '' || (def.prefixes && p in SI_PREFIXES))
      .map((p) => ({
        symbol: p + def.symbols[0],
        factor: p ? def.factor.times(this.prefixFactor(p)) : def.factor,
        dims: def.dims,
        def,
        system: def.system,
      }));
  }

  /** Resolve a symbol like "km", "lbs", "deg" into a unit object, or null. */
  resolve(sym) {
    if (this.cache.has(sym)) return this.cache.get(sym);
    let out = null;
    if (ANGLE_UNITS[sym]) {
      out = { symbol: sym, angle: ANGLE_UNITS[sym], dims: [0, 0, 0, 0, 0, 0, 0], factor: new Decimal(1) };
    } else if (this.bySymbol.has(sym)) {
      const def = this.bySymbol.get(sym);
      out = { symbol: sym, factor: def.factor, dims: def.dims, def, system: def.system };
    } else {
      for (const p of PREFIX_KEYS) {
        if (!sym.startsWith(p) || sym.length === p.length) continue;
        const def = this.bySymbol.get(sym.slice(p.length));
        if (def && def.prefixes) {
          out = { symbol: sym, factor: def.factor.times(this.prefixFactor(p)), dims: def.dims, def, system: def.system };
          break;
        }
      }
    }
    this.cache.set(sym, out);
    return out;
  }

  /** Pick the most readable unit of a system for a magnitude (SI value). */
  chooseNamed(system, dims, value) {
    const list = (this.byDims.get(dimsKey(dims)) || []).filter((u) => u.system === system || u.system === 'any');
    if (!list.length) return null;
    const abs = value.abs();
    if (abs.isZero()) return list.find((u) => u.factor.eq(1)) || list[list.length - 1];
    for (const u of list) if (abs.div(u.factor).gte(u.def.autoMin)) return u;
    return list[list.length - 1];
  }

  /** Every unit that can express these dimensions (used by the unit dropdown). */
  optionsForDims(dims) {
    const out = [];
    const seen = new Set();
    const push = (symbol, def, factor) => {
      if (seen.has(symbol)) return;
      seen.add(symbol);
      out.push({ symbol, name: def.name, system: def.system, factor });
    };
    for (const def of this.defs) {
      if (dimsKey(def.dims) !== dimsKey(dims)) continue;
      const prefixes = def.suggest === false ? [''] : def.suggest;
      for (const p of prefixes) {
        if (p && !(def.prefixes && p in SI_PREFIXES)) continue;
        push(p + def.symbols[0], def, p ? def.factor.times(this.prefixFactor(p)) : def.factor);
      }
    }
    out.sort((a, b) => b.factor.cmp(a.factor));
    return out;
  }

  /** Coherent (SI base) compound unit text, in the user's exponent style. */
  compound(dims, style = '**') {
    const fmtExp = (e) => (Number.isInteger(e) ? String(e) : String(+e.toFixed(4)));
    if (style === 'plain') {
      const parts = [];
      BASE.forEach((b, i) => {
        const e = dims[i];
        if (e !== 0) parts.push(e === 1 ? b : b + fmtExp(e));
      });
      return { text: parts.join(' '), spaced: true };
    }
    const ex = (b, e) => (e === 1 ? b : style === '^' ? `${b}^${fmtExp(e)}` : `${b}**${fmtExp(e)}`);
    const pos = [];
    const neg = [];
    BASE.forEach((b, i) => {
      const e = dims[i];
      if (e > 0) pos.push(ex(b, e));
      else if (e < 0) neg.push(ex(b, -e));
    });
    let text = pos.join('*');
    if (neg.length === 1) text += '/' + neg[0];
    else if (neg.length > 1) text += '/(' + neg.join('*') + ')';
    return { text, spaced: false };
  }
}
