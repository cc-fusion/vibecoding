// ── Unit engine ──────────────────────────────────────────────────────────────
// Every unit is a coefficient (relative to SI base units) plus a vector of
// exponents over the seven SI base dimensions: [kg, m, s, A, K, mol, cd].
import Decimal from "decimal.js";

const M = "metric", I = "imperial", C = "common";
const u = (name, coef, dims, sys, alias) => ({ name, coef: String(coef), dims, sys, ...(alias ? { alias } : {}) });

export const DEFAULT_UNITS = {
  // mass ─ kg is the anchor (values ≥ 1 kg stay in kg)
  kg:  u("kilogram", 1,        [1,0,0,0,0,0,0], M),
  g:   u("gram",     "0.001",  [1,0,0,0,0,0,0], M),
  mg:  u("milligram","1e-6",   [1,0,0,0,0,0,0], M),
  µg:  u("microgram","1e-9",   [1,0,0,0,0,0,0], M),
  ng:  u("nanogram", "1e-12",  [1,0,0,0,0,0,0], M),
  pg:  u("picogram", "1e-15",  [1,0,0,0,0,0,0], M),
  ug:  u("microgram","1e-9",   [1,0,0,0,0,0,0], M, "µg"),
  lbs: u("pound",    "0.45359237",     [1,0,0,0,0,0,0], I),
  lb:  u("pound",    "0.45359237",     [1,0,0,0,0,0,0], I, "lbs"),
  oz:  u("ounce",    "0.028349523125", [1,0,0,0,0,0,0], I),
  // length
  km:  u("kilometer", 1000,    [0,1,0,0,0,0,0], M),
  m:   u("meter",     1,       [0,1,0,0,0,0,0], M),
  cm:  u("centimeter","0.01",  [0,1,0,0,0,0,0], M),
  mm:  u("millimeter","0.001", [0,1,0,0,0,0,0], M),
  µm:  u("micrometer","1e-6",  [0,1,0,0,0,0,0], M),
  nm:  u("nanometer", "1e-9",  [0,1,0,0,0,0,0], M),
  pm:  u("picometer", "1e-12", [0,1,0,0,0,0,0], M),
  um:  u("micrometer","1e-6",  [0,1,0,0,0,0,0], M, "µm"),
  mi:  u("mile",      "1609.344", [0,1,0,0,0,0,0], I),
  yd:  u("yard",      "0.9144",   [0,1,0,0,0,0,0], I),
  ft:  u("foot",      "0.3048",   [0,1,0,0,0,0,0], I),
  in:  u("inch",      "0.0254",   [0,1,0,0,0,0,0], I),
  inch:u("inch",      "0.0254",   [0,1,0,0,0,0,0], I, "in"),
  // time
  h:   u("hour",      3600,    [0,0,1,0,0,0,0], C),
  hr:  u("hour",      3600,    [0,0,1,0,0,0,0], C, "h"),
  min: u("minute",    60,      [0,0,1,0,0,0,0], C),
  s:   u("second",    1,       [0,0,1,0,0,0,0], C),
  ms:  u("millisecond","1e-3", [0,0,1,0,0,0,0], C),
  µs:  u("microsecond","1e-6", [0,0,1,0,0,0,0], C),
  us:  u("microsecond","1e-6", [0,0,1,0,0,0,0], C, "µs"),
  ns:  u("nanosecond","1e-9",  [0,0,1,0,0,0,0], C),
  // other SI bases
  A:   u("ampere",    1,       [0,0,0,1,0,0,0], C),
  mA:  u("milliampere","1e-3", [0,0,0,1,0,0,0], C),
  K:   u("kelvin",    1,       [0,0,0,0,1,0,0], C),
  mol: u("mole",      1,       [0,0,0,0,0,1,0], C),
  mmol:u("millimole", "1e-3",  [0,0,0,0,0,1,0], C),
  cd:  u("candela",   1,       [0,0,0,0,0,0,1], C),
  // derived
  N:   u("newton",    1,       [1,1,-2,0,0,0,0], C),
  kN:  u("kilonewton",1000,    [1,1,-2,0,0,0,0], C),
  J:   u("joule",     1,       [1,2,-2,0,0,0,0], C),
  kJ:  u("kilojoule", 1000,    [1,2,-2,0,0,0,0], C),
  MJ:  u("megajoule", "1e6",   [1,2,-2,0,0,0,0], C),
  mJ:  u("millijoule","1e-3",  [1,2,-2,0,0,0,0], C),
  W:   u("watt",      1,       [1,2,-3,0,0,0,0], C),
  kW:  u("kilowatt",  1000,    [1,2,-3,0,0,0,0], C),
  MW:  u("megawatt",  "1e6",   [1,2,-3,0,0,0,0], C),
  mW:  u("milliwatt", "1e-3",  [1,2,-3,0,0,0,0], C),
  Pa:  u("pascal",    1,       [1,-1,-2,0,0,0,0], C),
  kPa: u("kilopascal",1000,    [1,-1,-2,0,0,0,0], C),
  MPa: u("megapascal","1e6",   [1,-1,-2,0,0,0,0], C),
  bar: u("bar",       "1e5",   [1,-1,-2,0,0,0,0], M),
  Hz:  u("hertz",     1,       [0,0,-1,0,0,0,0], C),
  kHz: u("kilohertz", 1000,    [0,0,-1,0,0,0,0], C),
  MHz: u("megahertz", "1e6",   [0,0,-1,0,0,0,0], C),
  GHz: u("gigahertz", "1e9",   [0,0,-1,0,0,0,0], C),
  C:   u("coulomb",   1,       [0,0,1,1,0,0,0], C),
  V:   u("volt",      1,       [1,2,-3,-1,0,0,0], C),
  mV:  u("millivolt", "1e-3",  [1,2,-3,-1,0,0,0], C),
  kV:  u("kilovolt",  1000,    [1,2,-3,-1,0,0,0], C),
  F:   u("farad",     1,       [-1,-2,4,2,0,0,0], C),
  Ω:   u("ohm",       1,       [1,2,-3,-2,0,0,0], C),
  ohm: u("ohm",       1,       [1,2,-3,-2,0,0,0], C, "Ω"),
  // volume (m³)
  kL:  u("kiloliter", 1,       [0,3,0,0,0,0,0], M),
  L:   u("liter",     "0.001", [0,3,0,0,0,0,0], M),
  mL:  u("milliliter","1e-6",  [0,3,0,0,0,0,0], M),
  ml:  u("milliliter","1e-6",  [0,3,0,0,0,0,0], M, "mL"),
  µL:  u("microliter","1e-9",  [0,3,0,0,0,0,0], M),
  gal: u("gallon",    "0.003785411784",   [0,3,0,0,0,0,0], I),
  qt:  u("quart",     "0.000946352946",   [0,3,0,0,0,0,0], I),
  pt:  u("pint",      "0.000473176473",   [0,3,0,0,0,0,0], I),
  cup: u("cup",       "0.0002365882365",  [0,3,0,0,0,0,0], I),
  floz:u("fluid ounce","0.0000295735295625",[0,3,0,0,0,0,0], I),
};

export const dimsKey = (d) => d.join(",");
export const isDimensionless = (d) => d.every((x) => x === 0);
const BASE_SYMBOLS = ["kg", "m", "s", "A", "K", "mol", "cd"];
// ladder order preference for prefixes when generating composite variants
const PREFIX_LADDER = {
  kg: ["kg", "g", "mg", "µg"], m: ["km", "m", "cm", "mm", "µm"], s: ["h", "min", "s", "ms", "µs", "ns"],
  A: ["A", "mA"], K: ["K"], mol: ["mol", "mmol"], cd: ["cd"],
};

export class UnitEngine {
  constructor(defs = DEFAULT_UNITS) { this.rebuild(defs); }

  rebuild(defs) {
    this.defs = defs;
    this.byDims = new Map();
    for (const [sym, def] of Object.entries(defs)) {
      const entry = { sym, ...def, coefDec: new Decimal(def.coef), canonical: def.alias || sym };
      if (!Array.isArray(entry.dims) || entry.dims.length !== 7) throw new Error(`unit "${sym}" needs 7 dimension exponents`);
      if (!["metric", "imperial", "common"].includes(entry.sys)) throw new Error(`unit "${sym}" has unknown system "${entry.sys}"`);
      if (!entry.coefDec.isFinite() || entry.coefDec.isZero()) throw new Error(`unit "${sym}" needs a non-zero coefficient`);
      const k = dimsKey(entry.dims);
      if (!this.byDims.has(k)) this.byDims.set(k, []);
      this.byDims.get(k).push(entry);
    }
    for (const list of this.byDims.values()) list.sort((a, b) => b.coefDec.cmp(a.coefDec));
  }

  lookup(sym) { return this.defs[sym] ? { sym, ...this.defs[sym], coefDec: new Decimal(this.defs[sym].coef) } : null; }

  // Pick the readable unit for a system: largest coefficient giving |value| ≥ 1.
  pick(valueSI, dims, system) {
    const all = this.byDims.get(dimsKey(dims)) || [];
    const list = all.filter((e) => !e.alias && (e.sys === system || e.sys === "common"));
    if (!list.length) return null;
    const abs = valueSI.abs();
    if (abs.isZero()) {
      const one = list.find((e) => e.coefDec.eq(1)) || list[0];
      return { unit: one, value: new Decimal(0) };
    }
    let chosen = list[list.length - 1];
    for (const e of list) {
      if (abs.div(e.coefDec).gte(1)) { chosen = e; break; }
    }
    return { unit: chosen, value: valueSI.div(chosen.coefDec) };
  }

  // All convertible units for a dimension signature (dropdown source).
  optionsFor(dims) {
    const named = (this.byDims.get(dimsKey(dims)) || []).filter((e) => !e.alias);
    const opts = named.map((e) => ({ label: e.sym, expr: e.sym, name: e.name, sys: e.sys }));
    if (!named.length) {
      // composite dimensions, e.g. m² or kg³ → offer prefixed variants of a single base
      const nonzero = dims.map((e, i) => [e, i]).filter(([e]) => e !== 0);
      if (nonzero.length === 1) {
        const [exp, i] = nonzero[0];
        const base = BASE_SYMBOLS[i];
        for (const sym of PREFIX_LADDER[base] || [base]) {
          if (!this.defs[sym]) continue;
          const label = Math.abs(exp) === 1 ? sym : `${sym}**${exp}`;
          opts.push({ label, expr: label, name: `${this.defs[sym].name}${exp === 1 ? "" : "^" + exp}`, sys: this.defs[sym].sys });
        }
        if (base === "m") for (const sym of ["mi", "ft", "in"]) {
          const label = Math.abs(exp) === 1 ? sym : `${sym}**${exp}`;
          opts.push({ label, expr: label, name: `${this.defs[sym].name}${exp === 1 ? "" : "^" + exp}`, sys: "imperial" });
        }
      }
    }
    return opts;
  }

  // Render a quantity as coefficient + unit product using base SI symbols.
  baseProduct(valueSI, dims, styles = {}) {
    const parts = [];
    const neg = [];
    dims.forEach((e, i) => {
      if (e === 0) return;
      const sym = BASE_SYMBOLS[i];
      const styled = styles[sym] === "**" && Math.abs(e) !== 1 ? `${sym}**${e}` : Math.abs(e) === 1 ? sym : `${sym}${e}`;
      const plain = Math.abs(e) === 1 ? sym : `${sym}${e}`;
      (e > 0 ? parts : neg).push({ sym, styled, plain, exp: e });
    });
    let label = parts.map((p) => (styles[p.sym] === "**" ? p.styled : p.plain)).join(" ");
    for (const p of neg) label += "/" + (styles[p.sym] === "**" ? p.styled : p.plain);
    return { label: label || "", first: parts[0]?.sym || neg[0]?.sym || null, value: valueSI };
  }
}

// Validate a plain-JSON unit table (developer tools editor).
export function validateUnitDefs(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("expected an object of unit definitions");
  const clean = {};
  for (const [sym, d] of Object.entries(obj)) {
    if (!/^[a-zA-ZµΩ°]+$/.test(sym)) throw new Error(`invalid symbol "${sym}" (letters only)`);
    if (!d || typeof d !== "object") throw new Error(`"${sym}": expected { name, coef, dims, sys }`);
    new Decimal(d.coef); // throws on bad coefficient
    clean[sym] = { name: String(d.name || sym), coef: String(d.coef), dims: d.dims, sys: d.sys, ...(d.alias ? { alias: String(d.alias) } : {}) };
  }
  const eng = new UnitEngine(clean); // throws on structural problems
  return { clean, eng };
}