import Decimal from "decimal.js";
import rawUnitsData from "../data/units.json";

export type BaseDimKey = "L" | "M" | "T" | "I" | "Θ" | "N" | "J";

export type Dimension = Partial<Record<BaseDimKey, number>>;

export interface UnitDef {
  unit: string;
  symbol: string;
  dimension: Dimension;
  conversion_factor: number;
  system: string;
}

export type UnitSystemPreference = "metric" | "imperial";

const BASE_KEYS: BaseDimKey[] = ["M", "L", "T", "I", "Θ", "N", "J"];

const BASE_SI_SYMBOLS: Record<BaseDimKey, string> = {
  M: "kg",
  L: "m",
  T: "s",
  I: "A",
  Θ: "K",
  N: "mol",
  J: "cd",
};

// Curated everyday ladders for Metric normalization
const METRIC_LADDERS: Array<{
  dimension: Dimension;
  symbols: string[];
  maxTopSymbol?: string;
}> = [
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
    symbols: ["mL", "L", "m**3"],
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
    symbols: ["mV", "V", "kV"],
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
const IMPERIAL_LADDERS: Array<{
  dimension: Dimension;
  symbols: string[];
}> = [
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
];

// Common aliases so users can type lb, lbs, ug, um, us, sec, hr, mins, etc.
const ALIAS_MAP: Record<string, string> = {
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
  um: "µm",
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
  us: "µs",
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
  newton: "N",
  newtons: "N",
  watt: "W",
  watts: "W",
  kilowatt: "kW",
  kilowatts: "kW",
  pascal: "Pa",
  pascals: "Pa",
  kilopascal: "kPa",
  volt: "V",
  volts: "V",
  ampere: "A",
  amperes: "A",
  amp: "A",
  amps: "A",
  kelvin: "K",
  kelvins: "K",
  mole: "mol",
  moles: "mol",
  candela: "cd",
  hertz: "Hz",
  coulomb: "C",
  farad: "F",
  ohm: "Ω",
  ohms: "Ω",
  Ohm: "Ω",
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
  ml: "mL",
  microliter: "µL",
  ul: "µL",
  uL: "µL",
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

export function normalizeDimension(dim: Dimension): Dimension {
  const res: Dimension = {};
  for (const k of BASE_KEYS) {
    const v = dim[k];
    if (v !== undefined && v !== 0) {
      res[k] = v;
    }
  }
  return res;
}

export function isDimensionless(dim: Dimension): boolean {
  for (const k of BASE_KEYS) {
    if (dim[k]) return false;
  }
  return true;
}

export function sameDimension(a: Dimension, b: Dimension): boolean {
  for (const k of BASE_KEYS) {
    if ((a[k] || 0) !== (b[k] || 0)) return false;
  }
  return true;
}

export function multiplyDimensions(a: Dimension, b: Dimension): Dimension {
  const res: Dimension = {};
  for (const k of BASE_KEYS) {
    const sum = (a[k] || 0) + (b[k] || 0);
    if (sum !== 0) res[k] = sum;
  }
  return res;
}

export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  const res: Dimension = {};
  for (const k of BASE_KEYS) {
    const diff = (a[k] || 0) - (b[k] || 0);
    if (diff !== 0) res[k] = diff;
  }
  return res;
}

export function powerDimension(a: Dimension, exp: number): Dimension {
  const res: Dimension = {};
  for (const k of BASE_KEYS) {
    const p = (a[k] || 0) * exp;
    if (p !== 0) res[k] = p;
  }
  return res;
}

export function dimensionKey(dim: Dimension): string {
  const parts: string[] = [];
  for (const k of BASE_KEYS) {
    if (dim[k]) {
      parts.push(`${k}:${dim[k]}`);
    }
  }
  return parts.join(",");
}

export interface ResolvedUnitToken {
  unitDef: UnitDef;
  exponent: number;
  exponentStyle: "none" | "attached" | "power";
}

export class UnitEngine {
  private units: UnitDef[] = [];
  private bySymbol = new Map<string, UnitDef>();
  private byName = new Map<string, UnitDef>();
  private byDimKey = new Map<string, UnitDef[]>();

  constructor(initialUnits: UnitDef[] = rawUnitsData as UnitDef[]) {
    this.setUnits(initialUnits);
  }

  public getUnits(): UnitDef[] {
    return this.units;
  }

  public getUnitsJson(): string {
    return JSON.stringify(this.units, null, 2);
  }

  public setUnitsFromJson(jsonStr: string): { ok: boolean; error?: string; count?: number } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Root JSON value must be an array of unit objects." };
      }
      for (const item of parsed) {
        if (!item || typeof item.symbol !== "string" || typeof item.conversion_factor !== "number" || typeof item.dimension !== "object") {
          return {
            ok: false,
            error: "Each unit must include 'symbol' (string), 'conversion_factor' (number), and 'dimension' (object).",
          };
        }
      }
      this.setUnits(parsed);
      return { ok: true, count: parsed.length };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Invalid JSON" };
    }
  }

  public setUnits(unitsList: UnitDef[]): void {
    this.units = unitsList.map((u) => ({
      ...u,
      dimension: normalizeDimension(u.dimension || {}),
    }));
    this.bySymbol.clear();
    this.byName.clear();
    this.byDimKey.clear();

    for (const u of this.units) {
      this.bySymbol.set(u.symbol, u);
      this.byName.set(u.unit.toLowerCase(), u);
      if (!u.unit.toLowerCase().endsWith("s")) {
        this.byName.set(u.unit.toLowerCase() + "s", u);
      }
      const dk = dimensionKey(u.dimension);
      const list = this.byDimKey.get(dk) || [];
      list.push(u);
      this.byDimKey.set(dk, list);
    }
  }

  public lookupExactUnit(token: string): UnitDef | null {
    const trimmed = token.trim().replace(/²/g, "**2").replace(/³/g, "**3");
    if (!trimmed) return null;

    // 1. Check exact symbol
    const direct = this.bySymbol.get(trimmed);
    if (direct) return direct;

    // 2. Check alias map
    const aliasSym = ALIAS_MAP[trimmed] || ALIAS_MAP[trimmed.toLowerCase()];
    if (aliasSym) {
      const aliased = this.bySymbol.get(aliasSym);
      if (aliased) return aliased;
    }

    // 3. Check unit name (case-insensitive)
    const named = this.byName.get(trimmed.toLowerCase());
    if (named) return named;

    return null;
  }

  /**
   * Resolves a unit token which may be:
   * - A direct unit symbol or name: "kg", "lbs", "mi", "J", "m**2"
   * - A base unit with an attached integer exponent: "m2", "s-2", "kg2", "kg3"
   * - A base unit with **exponent: "m**2", "s**2", "s**-2"
   */
  public resolveUnitToken(token: string): ResolvedUnitToken | null {
    const t = token
      .trim()
      .replace(/²/g, "**2")
      .replace(/³/g, "**3")
      .replace(/⁴/g, "**4")
      .replace(/⁻¹/g, "**-1")
      .replace(/⁻²/g, "**-2")
      .replace(/⁻³/g, "**-3");
    if (!t) return null;

    // Check explicit ** exponent syntax: e.g. m**2, s**-2
    const powerMatch = t.match(/^([a-zA-ZµΩ°_]+)\*\*([+-]?\d+)$/);
    if (powerMatch) {
      const base = this.lookupExactUnit(powerMatch[1]);
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
    const exact = this.lookupExactUnit(t);
    if (exact) {
      return {
        unitDef: exact,
        exponent: 1,
        exponentStyle: t.includes("**") ? "power" : "none",
      };
    }

    // Check attached integer exponent: e.g. m2, s-2, kg2, kg3
    const attachedMatch = t.match(/^([a-zA-ZµΩ°_]+)([+-]?\d+)$/);
    if (attachedMatch) {
      const base = this.lookupExactUnit(attachedMatch[1]);
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

  public getCompatibleUnits(dim: Dimension): UnitDef[] {
    const dk = dimensionKey(normalizeDimension(dim));
    if (!dk) return [];
    const all = this.byDimKey.get(dk) || [];

    // Sort so common/readable units appear first in the dropdown
    const ladderSyms = new Set<string>();
    for (const l of METRIC_LADDERS) {
      if (sameDimension(l.dimension, dim)) l.symbols.forEach((s) => ladderSyms.add(s));
    }
    for (const l of IMPERIAL_LADDERS) {
      if (sameDimension(l.dimension, dim)) l.symbols.forEach((s) => ladderSyms.add(s));
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
  public pickBestMetricUnit(
    siValue: Decimal,
    dim: Dimension,
    hintUnit?: UnitDef | null
  ): UnitDef | null {
    const normDim = normalizeDimension(dim);
    const dk = dimensionKey(normDim);
    if (!dk) return null;

    const absVal = siValue.abs();

    // Check curated metric ladder first
    const ladder = METRIC_LADDERS.find((l) => sameDimension(l.dimension, normDim));
    if (ladder) {
      const candidates = ladder.symbols
        .map((s) => this.bySymbol.get(s))
        .filter((u): u is UnitDef => !!u);

      if (candidates.length > 0) {
        if (absVal.isZero()) {
          // For 0, prefer base unit (factor=1) or hintUnit
          if (hintUnit && hintUnit.system === "SI" && sameDimension(hintUnit.dimension, normDim)) {
            return hintUnit;
          }
          return candidates.find((c) => c.conversion_factor === 1) || candidates[0];
        }

        // Sort candidates by conversion_factor ascending
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

    // Prefer conversion factor closest to 1 where value >= 1, or factor === 1
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
  public pickBestImperialUnit(
    siValue: Decimal,
    dim: Dimension,
    metricUnitUsed?: UnitDef | null
  ): UnitDef | null {
    const normDim = normalizeDimension(dim);
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
        .filter((u): u is UnitDef => !!u);

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
  public formatFallbackBaseUnits(
    dim: Dimension,
    exponentStyle: "none" | "attached" | "power" = "attached"
  ): string {
    const parts: string[] = [];
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
