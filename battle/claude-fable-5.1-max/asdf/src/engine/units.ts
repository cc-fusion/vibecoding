import { D0, type Dec, type DecCtor, piFor } from "./decimal";
import type { UnitsJSON } from "./unitsData";

// ---------------------------------------------------------------------------
// Dimensions: exponents of kg, m, s, A, K, mol, cd and an internal angle slot.
// ---------------------------------------------------------------------------

export const DIM_NAMES = ["kg", "m", "s", "A", "K", "mol", "cd", "rad"] as const;
export type Dim = readonly number[];
export const DIM0: Dim = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]);
export const DIM_ANGLE: Dim = Object.freeze([0, 0, 0, 0, 0, 0, 0, 1]);
export const DIM_TEMP: Dim = Object.freeze([0, 0, 0, 0, 1, 0, 0, 0]);
export type UnitSystem = "metric" | "imperial" | "any";

export function dimFromObj(o: Record<string, number>): Dim {
  const d = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const [k, v] of Object.entries(o)) {
    const i = DIM_NAMES.indexOf(k as (typeof DIM_NAMES)[number]);
    if (i < 0) throw new Error(`Unknown dimension "${k}"`);
    d[i] = v;
  }
  return d;
}
export const dimKey = (d: Dim) => d.join(",");
export const dimEq = (a: Dim, b: Dim) => a.every((x, i) => x === b[i]);
export const dimAdd = (a: Dim, b: Dim): Dim => a.map((x, i) => x + b[i]);
export const dimSub = (a: Dim, b: Dim): Dim => a.map((x, i) => x - b[i]);
export const dimScale = (a: Dim, k: number): Dim => a.map((x) => x * k);
export const dimIsZero = (a: Dim) => a.every((x) => x === 0);
export function dimBase(i: number): Dim {
  const d = [0, 0, 0, 0, 0, 0, 0, 0];
  d[i] = 1;
  return d;
}

// ---------------------------------------------------------------------------
// Factors: decimal | a/b | pi/b | a*pi
// ---------------------------------------------------------------------------

export interface FactorExpr {
  num: Dec;
  den: Dec;
  piPower: number;
}

export function parseFactor(s: string): FactorExpr {
  const [numS, denS] = s.split("/");
  const parseSide = (side: string | undefined): { v: Dec; pi: number } => {
    if (side === undefined) return { v: new D0(1), pi: 0 };
    let v = new D0(1);
    let p = 0;
    for (const raw of side.split("*")) {
      const part = raw.trim();
      if (part === "pi" || part === "π") p++;
      else if (part.length) v = v.mul(part);
    }
    return { v, pi: p };
  };
  const n = parseSide(numS);
  const d = parseSide(denS);
  return { num: n.v, den: d.v, piPower: n.pi - d.pi };
}

export function factorValue(f: FactorExpr, D: DecCtor): Dec {
  let v = new D(f.num).div(f.den);
  if (f.piPower !== 0) v = v.mul(piFor(D).pow(f.piPower));
  return v;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitDef {
  symbol: string;
  dim: Dim;
  factor: FactorExpr;
  factor0: Dec;
  offset: Dec | null;
  system: UnitSystem;
  prefixable: boolean;
  aliases: string[];
  plural?: string;
}

export interface UnitPart {
  /** symbol as typed / displayed, including prefix */
  symbol: string;
  def: UnitDef;
  prefix: string;
  prefixFactor: Dec;
  exp: number;
}

export interface DisplayUnit {
  parts: UnitPart[];
  dim: Dim;
  factor: Dec;
  offset: Dec | null;
  system: UnitSystem;
  /** verbatim text typed by the user (explicit conversion target) */
  text?: string;
}

export interface UnitStyle {
  exp: "digits" | "**" | "^" | "sup";
  neg: "slash" | "digits";
  mul: " " | "*" | "·";
}
export const DEFAULT_STYLE: UnitStyle = { exp: "digits", neg: "slash", mul: " " };

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
function superscript(n: number): string {
  const digits = String(Math.abs(n))
    .split("")
    .map((c) => SUP[Number(c)])
    .join("");
  return (n < 0 ? "⁻" : "") + digits;
}
function fromSuperscript(s: string): number {
  let neg = false;
  let out = "";
  for (const ch of s) {
    if (ch === "⁻") neg = true;
    else out += String(SUP.indexOf(ch));
  }
  const n = Number(out || "1");
  return neg ? -n : n;
}

const DEFAULT_PREFIX_VARIANTS = ["p", "n", "µ", "m", "", "k", "M", "G", "T"];

export interface Ladder {
  name: string;
  dim: Dim;
  metric: DisplayUnit[];
  imperial: DisplayUnit[];
}

export class UnitRegistry {
  readonly defs: UnitDef[] = [];
  readonly ladders: Ladder[] = [];
  private bySymbol = new Map<string, UnitDef>();
  private byLower = new Map<string, UnitDef>();
  private prefixes: { p: string; f: Dec }[] = [];

  constructor(json: UnitsJSON) {
    if (!json || !Array.isArray(json.units)) throw new Error("units must be an array");
    for (const [p, f] of Object.entries(json.prefixes ?? {})) this.prefixes.push({ p, f: new D0(f) });
    this.prefixes.sort((a, b) => b.p.length - a.p.length);
    for (const u of json.units) {
      if (!u.symbol || !u.dim || !u.factor) throw new Error(`Invalid unit definition: ${JSON.stringify(u)}`);
      const factor = parseFactor(u.factor);
      const def: UnitDef = {
        symbol: u.symbol,
        dim: dimFromObj(u.dim),
        factor,
        factor0: factorValue(factor, D0),
        offset: u.offset ? factorValue(parseFactor(u.offset), D0) : null,
        system: u.system ?? "any",
        prefixable: !!u.prefixable,
        aliases: u.aliases ?? [],
        plural: u.plural,
      };
      this.defs.push(def);
      this.bySymbol.set(def.symbol, def);
      for (const a of def.aliases) if (!this.bySymbol.has(a)) this.bySymbol.set(a, def);
      for (const name of [def.symbol, ...def.aliases]) {
        if (name.length >= 3 && !this.byLower.has(name.toLowerCase())) this.byLower.set(name.toLowerCase(), def);
      }
    }
    for (const l of json.ladders ?? []) {
      const parseList = (list?: string[]) =>
        (list ?? []).map((s) => {
          const u = this.parseUnitString(s);
          if (!u) throw new Error(`Unknown unit "${s}" in ladder "${l.name}"`);
          return u;
        });
      const any = parseList(l.any);
      this.ladders.push({
        name: l.name,
        dim: dimFromObj(l.dim),
        metric: l.metric ? parseList(l.metric) : any,
        imperial: l.imperial ? parseList(l.imperial) : any,
      });
    }
  }

  /** Resolve an identifier such as `km`, `m2`, `s`, `m²`, `lbs`, `°C` into a unit part. */
  resolveIdent(ident: string): UnitPart | null {
    let base = ident;
    let exp = 1;
    const sup = /^(.*?)([⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/u.exec(ident);
    const dig = /^(.*?[^\d])([1-9])$/u.exec(ident);
    const tryBase = (b: string, e: number): UnitPart | null => {
      const r = this.resolveBase(b);
      return r ? { ...r, exp: e } : null;
    };
    const direct = tryBase(base, exp);
    if (direct) return direct;
    if (sup) {
      const r = tryBase(sup[1], fromSuperscript(sup[2]));
      if (r) return r;
    }
    if (dig) {
      const r = tryBase(dig[1], Number(dig[2]));
      if (r) return r;
    }
    return null;
  }

  private resolveBase(base: string): Omit<UnitPart, "exp"> | null {
    if (!base) return null;
    const exact = this.bySymbol.get(base);
    if (exact) return { symbol: base, def: exact, prefix: "", prefixFactor: new D0(1) };
    for (const { p, f } of this.prefixes) {
      if (base.length > p.length && base.startsWith(p)) {
        const rest = base.slice(p.length);
        const def = this.bySymbol.get(rest);
        if (def && def.prefixable) return { symbol: base, def, prefix: p, prefixFactor: f };
      }
    }
    if (base.length >= 3) {
      const lower = this.byLower.get(base.toLowerCase());
      if (lower) return { symbol: base, def: lower, prefix: "", prefixFactor: new D0(1) };
    }
    return null;
  }

  makeUnit(parts: UnitPart[], text?: string): DisplayUnit {
    let dim: Dim = DIM0;
    let factor = new D0(1);
    let system: UnitSystem = "any";
    for (const p of parts) {
      dim = dimAdd(dim, dimScale(p.def.dim, p.exp));
      factor = factor.mul(p.prefixFactor.mul(p.def.factor0).pow(p.exp));
      if (p.def.system === "imperial") system = "imperial";
      else if (p.def.system === "metric" && system === "any") system = "metric";
    }
    const offset = parts.length === 1 && parts[0].exp === 1 && !parts[0].prefix ? parts[0].def.offset : null;
    return { parts, dim, factor, offset, system, text };
  }

  /** Parses simple unit strings like `m^2`, `km/h`, `kg m2 s-2`, `mm^2`. */
  parseUnitString(s: string): DisplayUnit | null {
    s = s.trim();
    const single = this.resolveIdent(s);
    if (single) return this.makeUnit([single]);
    const [numS, ...denS] = s.split("/");
    const parts: UnitPart[] = [];
    const addAtoms = (side: string, sign: number) => {
      for (const atom of side.split(/[\s*·×]+/).filter(Boolean)) {
        const m = /^(.+?)(?:\^|\*\*)(-?\d+)$/.exec(atom);
        let part: UnitPart | null;
        if (m) {
          part = this.resolveIdent(m[1]);
          if (part) part = { ...part, exp: part.exp * Number(m[2]) };
        } else {
          part = this.resolveIdent(atom);
        }
        if (!part) throw new Error(`Unknown unit "${atom}"`);
        parts.push({ ...part, exp: part.exp * sign });
      }
    };
    try {
      addAtoms(numS, 1);
      for (const d of denS) addAtoms(d, -1);
    } catch {
      return null;
    }
    return parts.length ? this.makeUnit(parts) : null;
  }

  ladderFor(dim: Dim, system: "metric" | "imperial"): DisplayUnit[] | null {
    const l = this.ladders.find((x) => dimEq(x.dim, dim));
    if (!l) return null;
    const list = system === "metric" ? l.metric : l.imperial;
    return list.length ? list : null;
  }

  /** The ladder entry equivalent to `u` (same dimension and factor), if any. */
  ladderEntryFor(u: DisplayUnit, system: "metric" | "imperial"): DisplayUnit | null {
    const ladder = this.ladderFor(u.dim, system);
    if (!ladder) return null;
    return ladder.find((e) => factorsEqual(e.factor, u.factor)) ?? null;
  }

  /** A named unit with exactly this dimension and factor (e.g. kg·m²/s² → J). */
  findNamedByValue(dim: Dim, factor: Dec): UnitDef | null {
    for (const d of this.defs) {
      if (dimEq(d.dim, dim) && factorsEqual(d.factor0, factor)) return d;
    }
    return null;
  }

  defUnit(def: UnitDef, prefix = ""): DisplayUnit {
    const pf = prefix ? this.prefixes.find((p) => p.p === prefix)!.f : new D0(1);
    return this.makeUnit([{ symbol: prefix + def.symbol, def, prefix, prefixFactor: pf, exp: 1 }]);
  }

  namedUnitsForDim(dim: Dim, system: "metric" | "imperial"): DisplayUnit[] {
    const out: DisplayUnit[] = [];
    for (const d of this.defs) {
      if (!dimEq(d.dim, dim)) continue;
      if (d.system !== "any" && d.system !== system) continue;
      if (d.prefixable) {
        for (const p of DEFAULT_PREFIX_VARIANTS) out.push(this.defUnit(d, p));
      } else out.push(this.defUnit(d));
    }
    return out;
  }

  /** Prefix family of a prefixable single unit, e.g. kWh → [pWh … TWh]. */
  prefixFamily(u: DisplayUnit): DisplayUnit[] {
    const part = u.parts[0];
    if (u.parts.length !== 1 || part.exp !== 1 || !part.def.prefixable) return [u];
    return DEFAULT_PREFIX_VARIANTS.map((p) => (p === part.prefix ? u : this.defUnit(part.def, p)));
  }

  /** All units usable for a dimension (for the unit picker). */
  allUnitsForDim(dim: Dim): DisplayUnit[] {
    const out: DisplayUnit[] = [];
    const seen = new Set<string>();
    const push = (u: DisplayUnit) => {
      const k = unitKey(u);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(u);
      }
    };
    for (const u of this.ladderFor(dim, "metric") ?? []) push(u);
    for (const u of this.ladderFor(dim, "imperial") ?? []) push(u);
    for (const d of this.defs) if (dimEq(d.dim, dim)) push(this.defUnit(d));
    return out;
  }
}

export function factorsEqual(a: Dec, b: Dec): boolean {
  if (a.eq(b)) return true;
  if (a.isZero() || b.isZero()) return false;
  return a.minus(b).abs().div(a.abs()).lt("1e-12");
}

/** Unit factor recomputed at the working precision of `D` (matters for π-based units). */
export function unitFactorAt(u: DisplayUnit, D: DecCtor): Dec {
  if (D.precision <= D0.precision && !u.parts.some((p) => p.def.factor.piPower !== 0)) return new D(u.factor);
  let f = new D(1);
  for (const p of u.parts) {
    f = f.mul(new D(p.prefixFactor).mul(factorValue(p.def.factor, D)).pow(p.exp));
  }
  return f;
}

export function systemOk(u: DisplayUnit, system: "metric" | "imperial"): boolean {
  return u.system === "any" || u.system === system;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function partSymbol(p: UnitPart, u: DisplayUnit, value?: Dec): string {
  if (u.parts.length === 1 && p.exp === 1 && p.def.plural && p.symbol === p.def.symbol && value && !value.abs().eq(1)) {
    return p.def.plural;
  }
  return p.symbol;
}

function expStr(e: number, style: UnitStyle): string {
  if (e === 1) return "";
  switch (style.exp) {
    case "**":
      return `**${e}`;
    case "^":
      return `^${e}`;
    case "sup":
      return superscript(e);
    default:
      return String(e);
  }
}

export function formatUnit(u: DisplayUnit, style: UnitStyle = DEFAULT_STYLE, value?: Dec): string {
  if (u.text) {
    const p = u.parts[0];
    if (u.parts.length === 1 && p.exp === 1 && p.def.plural && u.text === p.def.symbol && value && !value.abs().eq(1)) {
      return p.def.plural;
    }
    return u.text;
  }
  const num = u.parts.filter((p) => p.exp > 0);
  const den = u.parts.filter((p) => p.exp < 0);
  const mul = style.mul;
  if (style.neg === "digits" || den.length === 0 || (style.exp === "sup" && num.length === 0)) {
    return u.parts.map((p) => partSymbol(p, u, value) + expStr(p.exp, style)).join(mul);
  }
  const numStr = num.length ? num.map((p) => partSymbol(p, u, value) + expStr(p.exp, style)).join(mul) : "1";
  const denParts = den.map((p) => partSymbol(p, u, value) + expStr(-p.exp, style));
  const denStr = denParts.length > 1 ? `(${denParts.join(mul)})` : denParts[0];
  return `${numStr}/${denStr}`;
}

/** Whether a space should separate the number from this unit string. */
export function unitNeedsSpace(s: string): boolean {
  if (/[\s/·*]/.test(s)) {
    if (/^[^\s/·*]+\*\*-?\d+$/.test(s)) return false; // m**2
    return true;
  }
  if (/\d$/.test(s) && !/[*^]\d+$/.test(s)) return true; // m2, kg3
  if (/^[A-Za-z]{5,}$/.test(s)) return true; // word-like: meters
  return false;
}

export function unitKey(u: DisplayUnit): string {
  return formatUnit(u, DEFAULT_STYLE);
}

export interface QuantityLike {
  v: Dec;
  tempOffset?: Dec | null;
}

/** Numeric value of a quantity expressed in `u`. */
export function displayValue(q: QuantityLike, u: DisplayUnit): Dec {
  const D = q.v.constructor as DecCtor;
  const f = unitFactorAt(u, D);
  if (u.offset && q.tempOffset) return q.v.minus(new D(u.offset)).div(f);
  return q.v.div(f);
}

/** Detect which exponent / multiplication notation the user prefers from a unit string. */
export function detectStyle(sample: string, current: UnitStyle): UnitStyle {
  const s = { ...current };
  if (/\*\*/.test(sample)) s.exp = "**";
  else if (/\^/.test(sample)) s.exp = "^";
  else if (/[⁰¹²³⁴⁵⁶⁷⁸⁹]/u.test(sample)) s.exp = "sup";
  if (/·/.test(sample)) s.mul = "·";
  return s;
}
