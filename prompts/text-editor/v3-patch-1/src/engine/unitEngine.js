import rawUnitsData from "../data/units.json";

const BASE_KEYS = ["M", "L", "T", "I", "Θ", "N", "J", "A"];

const BASE_SI_SYMBOLS = {
  M: "kg",
  L: "m",
  T: "s",
  I: "A",
  Θ: "K",
  N: "mol",
  J: "cd",
  A: "rad",
};

export const RAD_UNIT = {
  unit: "radian",
  symbol: "rad",
  dimension: { A: 1 },
  conversion_factor: 1,
  system: "SI",
};

export const DEG_UNIT = {
  unit: "degree",
  symbol: "deg",
  dimension: { A: 1 },
  conversion_factor: Math.PI / 180,
  system: "SI",
};

// Curated everyday ladders for Metric normalization
const METRIC_LADDERS = [
  {
    dimension: { M: 1 },
    symbols: ["pg", "ng", "µg", "mg", "g", "kg"],
    maxTopSymbol: "kg",
  },
  {
    dimension: { L: 1 },
    symbols: ["pm", "nm", "µm", "mm", "m", "km"],
    maxTopSymbol: "km",
  },
  {
    dimension: { T: 1 },
    symbols: ["ns", "µs", "ms", "s"],
    maxTopSymbol: "s",
  },
  {
    dimension: { L: 2 },
    symbols: ["mm**2", "cm**2", "m**2", "km**2"],
    maxTopSymbol: "km**2",
  },
  {
    dimension: { L: 3 },
    symbols: ["µL", "mL", "L", "m**3"],
    maxTopSymbol: "m**3",
  },
  {
    dimension: { M: 1, L: 2, T: -2 }, // Energy
    symbols: ["mJ", "J", "kJ", "MJ", "GJ"],
    maxTopSymbol: "GJ",
  },
  {
    dimension: { M: 1, L: 1, T: -2 }, // Force
    symbols: ["mN", "N", "kN", "MN"],
    maxTopSymbol: "MN",
  },
  {
    dimension: { M: 1, L: 2, T: -3 }, // Power
    symbols: ["mW", "W", "kW", "MW", "GW"],
    maxTopSymbol: "GW",
  },
  {
    dimension: { M: 1, L: -1, T: -2 }, // Pressure
    symbols: ["Pa", "kPa", "MPa", "GPa"],
    maxTopSymbol: "GPa",
  },
  {
    dimension: { T: -1 }, // Frequency
    symbols: ["Hz", "kHz", "MHz", "GHz"],
    maxTopSymbol: "GHz",
  },
  {
    dimension: { M: 1, L: 2, T: -3, I: -1 }, // Voltage
    symbols: ["µV", "mV", "V", "kV"],
    maxTopSymbol: "kV",
  },
  {
    dimension: { I: 1 }, // Current
    symbols: ["µA", "mA", "A", "kA"],
    maxTopSymbol: "kA",
  },
  {
    dimension: { M: 1, L: 2, T: -3, I: -2 }, // Resistance
    symbols: ["Ω", "kΩ", "MΩ"],
    maxTopSymbol: "MΩ",
  },
  {
    dimension: { T: 1, I: 1 }, // Charge
    symbols: ["µC", "mC", "C"],
    maxTopSymbol: "C",
  },
  {
    dimension: { L: 1, T: -1 }, // Velocity
    symbols: ["m/s"],
    maxTopSymbol: "m/s",
  },
];

// Curated everyday ladders for Imperial normalization
const IMPERIAL_LADDERS = [
  {
    dimension: { M: 1 },
    symbols: ["oz", "lbs"],
  },
  {
    dimension: { L: 1 },
    symbols: ["in", "ft", "mi"],
  },
  {
    dimension: { L: 2 },
    symbols: ["in**2", "ft**2", "ac", "mi**2"],
  },
  {
    dimension: { L: 3 },
    symbols: ["fl_oz", "cup", "pt", "qt", "gal"],
  },
  {
    dimension: { M: 1, L: 2, T: -2 }, // Energy
    symbols: ["Btu"],
  },
  {
    dimension: { M: 1, L: 1, T: -2 }, // Force
    symbols: ["ozf", "lbf"],
  },
  {
    dimension: { M: 1, L: 2, T: -3 }, // Power
    symbols: ["hp"],
  },
  {
    dimension: { M: 1, L: -1, T: -2 }, // Pressure
    symbols: ["psi"],
  },
  {
    dimension: { L: 1, T: -1 }, // Velocity
    symbols: ["ft/s", "mi/h"],
  },
  {
    dimension: { Θ: 1 }, // Temperature: default to Fahrenheit (°F) instead of Rankine (°R)
    symbols: ["°F"],
  },
];

// Exact-case aliases (including mixed-case mcL, uL, mcV, uV as specified)
const EXACT_ALIAS_MAP = {
  mcg: "µg",
  ug: "µg",
  mcL: "µL",
  mcl: "µL",
  uL: "µL",
  ul: "µL",
  mcV: "µV",
  mcv: "µV",
  uV: "µV",
  uv: "µV",
  "°C": "°C",
  "°c": "°C",
  "°F": "°F",
  "°f": "°F",
  "°R": "°R",
  "°r": "°R",
  "°K": "K",
  "°k": "K",
  degC: "°C",
  degF: "°F",
  degR: "°R",
  degK: "K",
  Ohm: "Ω",
};

// Case-insensitive word/alias map (only matched when token is all-lower, all-upper, or Titlecase)
// Note: 'um' and 'us' are intentionally excluded per Requirement 9.
const CASE_INSENSITIVE_ALIAS_MAP = {
  lb: "lbs",
  lbs: "lbs",
  pound: "lbs",
  pounds: "lbs",
  ounce: "oz",
  ounces: "oz",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  milligram: "mg",
  milligrams: "mg",
  microgram: "µg",
  micrograms: "µg",
  mcg: "µg",
  ug: "µg",
  nanogram: "ng",
  picogram: "pg",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  centimeter: "cm",
  centimeters: "cm",
  millimeter: "mm",
  millimeters: "mm",
  micrometer: "µm",
  micrometers: "µm",
  nanometer: "nm",
  picometer: "pm",
  mile: "mi",
  miles: "mi",
  foot: "ft",
  feet: "ft",
  inch: "in",
  inches: "in",
  yard: "yd",
  yards: "yd",
  second: "s",
  seconds: "s",
  sec: "s",
  secs: "s",
  millisecond: "ms",
  milliseconds: "ms",
  microsecond: "µs",
  microseconds: "µs",
  nanosecond: "ns",
  nanoseconds: "ns",
  minute: "min",
  minutes: "min",
  mins: "min",
  hour: "h",
  hours: "h",
  hr: "h",
  hrs: "h",
  day: "d",
  days: "d",
  year: "yr",
  years: "yr",
  yrs: "yr",
  joule: "J",
  joules: "J",
  kilojoule: "kJ",
  kilojoules: "kJ",
  electronvolt: "eV",
  electronvolts: "eV",
  newton: "N",
  newtons: "N",
  watt: "W",
  watts: "W",
  kilowatt: "kW",
  kilowatts: "kW",
  pascal: "Pa",
  pascals: "Pa",
  kilopascal: "kPa",
  kilopascals: "kPa",
  volt: "V",
  volts: "V",
  microvolt: "µV",
  microvolts: "µV",
  mcv: "µV",
  uv: "µV",
  ampere: "A",
  amperes: "A",
  amp: "A",
  amps: "A",
  kelvin: "K",
  kelvins: "K",
  celsius: "°C",
  centigrade: "°C",
  degc: "°C",
  fahrenheit: "°F",
  degf: "°F",
  rankine: "°R",
  degr: "°R",
  r: "°R",
  mole: "mol",
  moles: "mol",
  candela: "cd",
  hertz: "Hz",
  coulomb: "C",
  coulombs: "C",
  farad: "F",
  farads: "F",
  ohm: "Ω",
  ohms: "Ω",
  tesla: "T",
  weber: "Wb",
  henry: "H",
  liter: "L",
  liters: "L",
  litre: "L",
  litres: "L",
  l: "L",
  milliliter: "mL",
  milliliters: "mL",
  microliter: "µL",
  microliters: "µL",
  microlitre: "µL",
  microlitres: "µL",
  mcl: "µL",
  ul: "µL",
  gallon: "gal",
  gallons: "gal",
  pint: "pt",
  pints: "pt",
  quart: "qt",
  quarts: "qt",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  acre: "ac",
  acres: "ac",
  hectare: "ha",
  hectares: "ha",
};

const SI_PREFIX_NAMES = [
  "quecto",
  "ronto",
  "yocto",
  "zepto",
  "atto",
  "femto",
  "pico",
  "nano",
  "micro",
  "milli",
  "mill",
  "centi",
  "deci",
  "deca",
  "hecto",
  "kilo",
  "mega",
  "giga",
  "tera",
  "peta",
  "exa",
  "zetta",
  "yotta",
  "ronna",
  "quetta",
];

function isSiPrefixedUnit(u) {
  const lowName = (u.unit || "").toLowerCase();
  const words = lowName.split(/\s+/);
  for (const w of words) {
    for (const p of SI_PREFIX_NAMES) {
      if (w.startsWith(p) && w.length > p.length + 1 && w !== "gallon" && w !== "galileo" && w !== "calorie" && w !== "candela" && w !== "carat") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether a token is eligible for case-insensitive matching:
 * Each alphabetic segment must be all-lowercase, all-uppercase, or Titlecase.
 * Examples:
 * - "psi", "PSI", "Psi" -> true
 * - "psI", "pSi", "PSi", "pSI" -> false
 */
export function isAllowedCaseInsensitiveForm(token) {
  const cleaned = token.replace(/^°/, "");
  if (!cleaned) return true;
  // Extract alphabetic words (ignoring digits, *, ^, /, _, -)
  const alphaSegments = cleaned.match(/[a-zA-ZµΩ]+/g);
  if (!alphaSegments || alphaSegments.length === 0) return true;

  for (const seg of alphaSegments) {
    // If segment contains µ, require exact match (handled before this)
    if (seg.includes("µ")) return false;
    const isLower = seg === seg.toLowerCase();
    const isUpper = seg === seg.toUpperCase();
    const isTitle =
      seg.length >= 1 &&
      seg[0] === seg[0].toUpperCase() &&
      seg.slice(1) === seg.slice(1).toLowerCase();
    if (!isLower && !isUpper && !isTitle) {
      return false;
    }
  }
  return true;
}

export function lookupAngleUnit(token) {
  const t = token.trim();
  if (t === "°") return DEG_UNIT;
  if (!isAllowedCaseInsensitiveForm(t)) return null;
  const low = t.toLowerCase();
  if (low === "rad" || low === "radian" || low === "radians") {
    return RAD_UNIT;
  }
  if (low === "deg" || low === "degree" || low === "degrees") {
    return DEG_UNIT;
  }
  return null;
}

export function normalizeDimension(dim) {
  const res = {};
  for (const k of BASE_KEYS) {
    const v = dim[k];
    if (v !== undefined && v !== 0) {
      res[k] = v;
    }
  }
  return res;
}

export function isDimensionless(dim) {
  for (const k of BASE_KEYS) {
    if (dim[k]) return false;
  }
  return true;
}

export function sameDimension(a, b) {
  for (const k of BASE_KEYS) {
    if ((a[k] || 0) !== (b[k] || 0)) return false;
  }
  return true;
}

export function multiplyDimensions(a, b) {
  const res = {};
  for (const k of BASE_KEYS) {
    const sum = (a[k] || 0) + (b[k] || 0);
    if (sum !== 0) res[k] = sum;
  }
  return res;
}

export function divideDimensions(a, b) {
  const res = {};
  for (const k of BASE_KEYS) {
    const diff = (a[k] || 0) - (b[k] || 0);
    if (diff !== 0) res[k] = diff;
  }
  return res;
}

export function powerDimension(a, exp) {
  const res = {};
  for (const k of BASE_KEYS) {
    const p = (a[k] || 0) * exp;
    if (p !== 0) res[k] = p;
  }
  return res;
}

export function dimensionKey(dim) {
  const parts = [];
  for (const k of BASE_KEYS) {
    if (dim[k]) {
      parts.push(`${k}:${dim[k]}`);
    }
  }
  return parts.join(",");
}

export class UnitEngine {
  constructor(initialUnits = rawUnitsData) {
    this.units = [];
    this.bySymbol = new Map();
    this.bySymbolLower = new Map();
    this.byName = new Map();
    this.byDimKey = new Map();
    this.setUnits(initialUnits);
  }

  getUnits() {
    return this.units;
  }

  getUnitsJson() {
    return JSON.stringify(this.units, null, 2);
  }

  setUnitsFromJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Root JSON value must be an array of unit objects." };
      }
      for (const item of parsed) {
        if (
          !item ||
          typeof item.symbol !== "string" ||
          typeof item.conversion_factor !== "number" ||
          typeof item.dimension !== "object"
        ) {
          return {
            ok: false,
            error:
              "Each unit must include 'symbol' (string), 'conversion_factor' (number), and 'dimension' (object).",
          };
        }
      }
      this.setUnits(parsed);
      return { ok: true, count: parsed.length };
    } catch (e) {
      return { ok: false, error: e?.message || "Invalid JSON" };
    }
  }

  setUnits(unitsList) {
    this.units = unitsList.map((u) => ({
      ...u,
      dimension: normalizeDimension(u.dimension || {}),
    }));
    this.bySymbol.clear();
    this.bySymbolLower.clear();
    this.byName.clear();
    this.byDimKey.clear();

    for (const u of this.units) {
      this.bySymbol.set(u.symbol, u);

      const symLow = u.symbol.toLowerCase();
      const lowList = this.bySymbolLower.get(symLow) || [];
      lowList.push(u);
      this.bySymbolLower.set(symLow, lowList);

      const nameLow = u.unit.toLowerCase();
      this.byName.set(nameLow, u);
      if (!nameLow.endsWith("s")) {
        this.byName.set(nameLow + "s", u);
      }

      const dk = dimensionKey(u.dimension);
      const list = this.byDimKey.get(dk) || [];
      list.push(u);
      this.byDimKey.set(dk, list);
    }
  }

  /**
   * Looks up a unit by symbol, alias, or name.
   * @param {string} token
   * @param {object} [options]
   * @param {boolean} [options.preferTemperature] - When true, 'C'/'c' resolves to '°C' and 'F'/'f' resolves to '°F'
   */
  lookupExactUnit(token, options = {}) {
    const trimmed = token
      .trim()
      .replace(/μ/g, "µ")
      .replace(/²/g, "**2")
      .replace(/³/g, "**3");
    if (!trimmed) return null;

    // Special rule for Celsius / Coulomb ('C'/'c') and Fahrenheit / Farad ('F'/'f')
    if (options.preferTemperature) {
      if (trimmed === "C" || trimmed === "c") {
        const degC = this.bySymbol.get("°C");
        if (degC) return degC;
      }
      if (trimmed === "F" || trimmed === "f") {
        const degF = this.bySymbol.get("°F");
        if (degF) return degF;
      }
    }

    // Special rule for radians / degrees
    const angleUnit = lookupAngleUnit(trimmed);
    if (angleUnit) return angleUnit;

    // 1. Check exact symbol match
    const direct = this.bySymbol.get(trimmed);
    if (direct) return direct;

    // 2. Check exact-case alias map (e.g. mcL, uL, mcV, uV, mcg, ug)
    const exactAliasSym = EXACT_ALIAS_MAP[trimmed];
    if (exactAliasSym) {
      const aliased = this.bySymbol.get(exactAliasSym);
      if (aliased) return aliased;
    }

    // 3. Enforce case-insensitivity rule: must be all-lowercase, all-uppercase, or Titlecase
    if (!isAllowedCaseInsensitiveForm(trimmed)) {
      return null;
    }

    const low = trimmed.toLowerCase();

    // 4. Check case-insensitive symbol matches (unless they conflict)
    const symMatches = this.bySymbolLower.get(low);
    if (symMatches && symMatches.length > 0) {
      if (symMatches.length === 1) {
        return symMatches[0];
      }
      // Remove pairs that conflict within the same dimension (e.g. mW vs MW, mJ vs MJ, pA vs PA, mL vs ML)
      const dimCounts = new Map();
      for (const m of symMatches) {
        const dk = dimensionKey(m.dimension);
        dimCounts.set(dk, (dimCounts.get(dk) || 0) + 1);
      }
      const nonSameDimConflicts = symMatches.filter(
        (m) => dimCounts.get(dimensionKey(m.dimension)) === 1
      );
      if (nonSameDimConflicts.length === 1) {
        return nonSameDimConflicts[0];
      }
      const unprefixed = nonSameDimConflicts.filter((m) => !isSiPrefixedUnit(m));
      if (unprefixed.length === 1) {
        return unprefixed[0];
      }
      return null;
    }

    // 5. Check case-insensitive word alias map
    const wordAliasSym = CASE_INSENSITIVE_ALIAS_MAP[low];
    if (wordAliasSym) {
      const aliased = this.bySymbol.get(wordAliasSym);
      if (aliased) return aliased;
    }

    // 6. Check unit full name (case-insensitive, since isAllowedCaseInsensitiveForm passed)
    const named = this.byName.get(low);
    if (named) return named;

    return null;
  }

  /**
   * Resolves a unit token which may be:
   * - A direct unit symbol or name: "kg", "lbs", "mi", "J", "m**2"
   * - A base unit with an attached integer exponent: "m2", "s-2", "kg2", "kg3"
   * - A base unit with ** or ^ exponent: "m**2", "m^2", "s**-2", "m^-2"
   */
  resolveUnitToken(token, options = {}) {
    const t = token
      .trim()
      .replace(/μ/g, "µ")
      .replace(/²/g, "**2")
      .replace(/³/g, "**3")
      .replace(/⁴/g, "**4")
      .replace(/⁻¹/g, "**-1")
      .replace(/⁻²/g, "**-2")
      .replace(/⁻³/g, "**-3");
    if (!t) return null;

    // Check explicit ** or ^ exponent syntax: e.g. m**2, m^2, s**-2, m^-2
    const powerMatch = t.match(/^([a-zA-ZµΩ°_]+)(?:\*\*|\^)([+-]?\d+)$/);
    if (powerMatch) {
      const base = this.lookupExactUnit(powerMatch[1], options);
      const exp = parseInt(powerMatch[2], 10);
      if (base && !isNaN(exp)) {
        return {
          unitDef: base,
          exponent: exp,
          exponentStyle: "power",
        };
      }
    }

    // Check exact match (without exponent)
    const exact = this.lookupExactUnit(t, options);
    if (exact) {
      return {
        unitDef: exact,
        exponent: 1,
        exponentStyle: t.includes("**") || t.includes("^") ? "power" : "none",
      };
    }

    // Check attached integer exponent: e.g. m2, s-2, kg2, kg3
    const attachedMatch = t.match(/^([a-zA-ZµΩ°_]+)([+-]?\d+)$/);
    if (attachedMatch) {
      const base = this.lookupExactUnit(attachedMatch[1], options);
      const exp = parseInt(attachedMatch[2], 10);
      if (base && !isNaN(exp)) {
        return {
          unitDef: base,
          exponent: exp,
          exponentStyle: "attached",
        };
      }
    }

    return null;
  }

  getCompatibleUnits(dim) {
    const norm = normalizeDimension(dim);
    if (sameDimension(norm, { A: 1 })) {
      return [DEG_UNIT, RAD_UNIT];
    }
    const dk = dimensionKey(norm);
    if (!dk) return [];
    const all = this.byDimKey.get(dk) || [];

    // Sort so common/readable units appear first in the dropdown
    const ladderSyms = new Set();
    for (const l of METRIC_LADDERS) {
      if (sameDimension(l.dimension, norm)) l.symbols.forEach((s) => ladderSyms.add(s));
    }
    for (const l of IMPERIAL_LADDERS) {
      if (sameDimension(l.dimension, norm)) l.symbols.forEach((s) => ladderSyms.add(s));
    }

    return [...all].sort((a, b) => {
      const aCommon = ladderSyms.has(a.symbol) ? 0 : 1;
      const bCommon = ladderSyms.has(b.symbol) ? 0 : 1;
      if (aCommon !== bCommon) return aCommon - bCommon;
      return a.symbol.length - b.symbol.length || a.symbol.localeCompare(b.symbol);
    });
  }

  /**
   * Selects the best Metric (SI) unit for a given SI base value and dimension.
   */
  pickBestMetricUnit(siValue, dim, hintUnit = null) {
    const normDim = normalizeDimension(dim);
    if (sameDimension(normDim, { A: 1 })) {
      return hintUnit || RAD_UNIT;
    }
    const dk = dimensionKey(normDim);
    if (!dk) return null;

    const absVal = siValue.abs();

    // Check curated metric ladder first
    const ladder = METRIC_LADDERS.find((l) => sameDimension(l.dimension, normDim));
    if (ladder) {
      const candidates = ladder.symbols
        .map((s) => this.bySymbol.get(s))
        .filter((u) => !!u);

      if (candidates.length > 0) {
        if (absVal.isZero()) {
          if (hintUnit && hintUnit.system === "SI" && sameDimension(hintUnit.dimension, normDim)) {
            return hintUnit;
          }
          return candidates.find((c) => c.conversion_factor === 1) || candidates[0];
        }

        const sorted = [...candidates].sort((a, b) => a.conversion_factor - b.conversion_factor);
        let chosen = sorted[0];
        for (const u of sorted) {
          const inUnit = absVal.div(u.conversion_factor);
          if (inUnit.gte(1)) {
            chosen = u;
          }
        }
        return chosen;
      }
    }

    // Fallback: look for all SI units matching dimension
    const allUnits = (this.byDimKey.get(dk) || []).filter((u) => u.system === "SI");
    if (allUnits.length === 0) return null;

    if (absVal.isZero()) {
      return allUnits.find((u) => u.conversion_factor === 1) || allUnits[0];
    }

    const baseOne = allUnits.find((u) => Math.abs(u.conversion_factor - 1) < 1e-12);
    if (baseOne && absVal.gte(0.001) && absVal.lt(10000)) {
      return baseOne;
    }

    const sorted = [...allUnits].sort((a, b) => a.conversion_factor - b.conversion_factor);
    let chosen = sorted[0];
    for (const u of sorted) {
      if (absVal.div(u.conversion_factor).gte(1)) {
        chosen = u;
      }
    }
    return chosen;
  }

  /**
   * Selects the best Imperial unit for a given SI base value and dimension, if one exists.
   */
  pickBestImperialUnit(siValue, dim, metricUnitUsed = null) {
    const normDim = normalizeDimension(dim);
    if (sameDimension(normDim, { A: 1 })) {
      return null;
    }
    const dk = dimensionKey(normDim);
    if (!dk) return null;

    const absVal = siValue.abs();

    // Special case: if metric unit is km (or length >= 500m), prefer miles (mi) in imperial
    if (sameDimension(normDim, { L: 1 })) {
      if (metricUnitUsed?.symbol === "km" || absVal.gte(500)) {
        const mi = this.bySymbol.get("mi");
        if (mi) return mi;
      }
    }

    const ladder = IMPERIAL_LADDERS.find((l) => sameDimension(l.dimension, normDim));
    if (ladder) {
      const candidates = ladder.symbols
        .map((s) => this.bySymbol.get(s))
        .filter((u) => !!u);

      if (candidates.length > 0) {
        if (absVal.isZero()) return candidates[candidates.length - 1];
        const sorted = [...candidates].sort((a, b) => a.conversion_factor - b.conversion_factor);
        let chosen = sorted[0];
        for (const u of sorted) {
          if (absVal.div(u.conversion_factor).gte(1)) {
            chosen = u;
          }
        }
        return chosen;
      }
    }

    const impUnits = (this.byDimKey.get(dk) || []).filter((u) => u.system === "Imperial");
    if (impUnits.length === 0) return null;
    const sorted = [...impUnits].sort((a, b) => a.conversion_factor - b.conversion_factor);
    let chosen = sorted[0];
    for (const u of sorted) {
      if (absVal.div(u.conversion_factor).gte(1)) {
        chosen = u;
      }
    }
    return chosen;
  }

  /**
   * Formats a dimension that has no matching single unit in the database
   * using SI base unit symbols (e.g. { M: 3 } -> " kg3" or " kg**3").
   */
  formatFallbackBaseUnits(dim, exponentStyle = "attached") {
    const parts = [];
    for (const k of BASE_KEYS) {
      const exp = dim[k];
      if (!exp) continue;
      const sym = BASE_SI_SYMBOLS[k];
      if (exp === 1) {
        parts.push(sym);
      } else if (exponentStyle === "power") {
        parts.push(`${sym}**${exp}`);
      } else {
        parts.push(`${sym}${exp}`);
      }
    }
    if (parts.length === 0) return "";
    return " " + parts.join(" ");
  }
}

export const defaultUnitEngine = new UnitEngine();
