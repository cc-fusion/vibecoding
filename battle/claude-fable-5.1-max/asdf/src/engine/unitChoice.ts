import type { Dec } from "./decimal";
import type { Quantity } from "./evaluator";
import {
  DIM_ANGLE,
  DIM_TEMP,
  type Dim,
  type DisplayUnit,
  type UnitPart,
  type UnitRegistry,
  dimBase,
  dimEq,
  dimIsZero,
  displayValue,
  factorsEqual,
  systemOk,
} from "./units";

export type SystemPref = "metric" | "imperial";

const METRIC_BASE = ["kg", "m", "s", "A", "K", "mol", "cd", "rad"];
const IMPERIAL_BASE = ["lb", "ft", "s", "A", "K", "mol", "cd", "rad"];

interface Scored {
  unit: DisplayUnit;
  value: Dec;
  inRange: boolean;
  dist: number;
}

function score(q: Quantity, u: DisplayUnit): Scored {
  const value = displayValue(q, u);
  const a = value.abs();
  const inRange = a.gte(1) && a.lt(1000);
  let dist = 0;
  if (!inRange && !a.isZero() && a.isFinite()) {
    const lg = a.log(10).toNumber();
    dist = a.lt(1) ? -lg : lg - 3;
  }
  return { unit: u, value, inRange, dist };
}

/** Largest unit whose value lies in [1, 1000). */
function pickInRange(scored: Scored[]): Scored | null {
  let best: Scored | null = null;
  for (const s of scored) {
    if (!s.inRange) continue;
    if (!best || s.unit.factor.gt(best.unit.factor)) best = s;
  }
  return best;
}

/** Candidate closest to the readable range. */
function pickClosest(scored: Scored[]): Scored | null {
  let best: Scored | null = null;
  for (const s of scored) {
    if (!best || s.dist < best.dist - 1e-9 || (Math.abs(s.dist - best.dist) < 1e-9 && s.unit.factor.gt(best.unit.factor))) {
      best = s;
    }
  }
  return best;
}

/** Keep the user's spelling (e.g. `grams`, `°`) when an input unit is equivalent. */
function preferSpelling(u: DisplayUnit, inputs: DisplayUnit[]): DisplayUnit {
  for (const i of inputs) {
    if (i.parts.length === 1 && i.parts[0].exp === 1 && dimEq(i.dim, u.dim) && factorsEqual(i.factor, u.factor)) return i;
  }
  return u;
}

/** Builds a compound unit for `dim` from the base units the user typed (falling back to system defaults). */
export function buildCompound(
  dim: Dim,
  inputUnits: DisplayUnit[],
  system: SystemPref,
  reg: UnitRegistry,
): { unit: DisplayUnit; fromInput: boolean } | null {
  const parts: UnitPart[] = [];
  let fromInput = false;
  for (let i = 0; i < dim.length; i++) {
    const e = dim[i];
    if (!e) continue;
    const base = dimBase(i);
    let part: UnitPart | null = null;
    for (const u of inputUnits) {
      for (const p of u.parts) {
        if (dimEq(p.def.dim, base) && !p.def.offset && (p.def.system === "any" || p.def.system === system)) {
          part = { ...p, exp: e };
          fromInput = true;
          break;
        }
      }
      if (part) break;
    }
    if (!part) {
      const r = reg.resolveIdent(system === "imperial" ? IMPERIAL_BASE[i] : METRIC_BASE[i]);
      if (!r) return null;
      part = { ...r, exp: e };
    }
    parts.push(part);
  }
  if (!parts.length) return null;
  return { unit: reg.makeUnit(parts), fromInput };
}

/**
 * Chooses a readable display unit for a quantity under a metric/imperial
 * preference, taking the units the user typed into account.
 */
export function chooseDisplayUnit(
  q: Quantity,
  system: SystemPref,
  inputUnits: DisplayUnit[],
  reg: UnitRegistry,
): DisplayUnit | null {
  if (dimIsZero(q.dim)) return null;
  const sameDim = inputUnits.filter((u) => dimEq(u.dim, q.dim));

  if (q.v.isZero() && sameDim.length) return sameDim[sameDim.length - 1];

  // Angles: keep the unit the user wrote (default rad); the "other system" is the other angle unit.
  if (dimEq(q.dim, DIM_ANGLE)) {
    const rad = reg.parseUnitString("rad");
    const deg = reg.parseUnitString("deg");
    if (!rad || !deg) return null;
    const inp = [...sameDim].reverse().find((u) => u.parts.length === 1 && u.parts[0].exp === 1) ?? null;
    const primary = inp ?? rad;
    if (system === "metric") return primary;
    return factorsEqual(primary.factor, rad.factor) ? deg : rad;
  }

  // Temperatures: input unit of the right system, else °C / °F.
  if (dimEq(q.dim, DIM_TEMP)) {
    const inp = [...sameDim].reverse().find((u) => systemOk(u, system));
    if (inp) return inp;
    return reg.parseUnitString(system === "metric" ? "°C" : "°F");
  }

  const ladder = reg.ladderFor(q.dim, system);
  const derived: DisplayUnit[] = [];
  const unknownCompounds: DisplayUnit[] = [];

  // A. candidates derived from the input: units of the same dimension, plus a compound built from typed base units
  const aCands: DisplayUnit[] = [...sameDim];
  const compound = buildCompound(q.dim, inputUnits, system, reg);
  if (compound && compound.fromInput && !aCands.some((u) => factorsEqual(u.factor, compound.unit.factor))) {
    aCands.push(compound.unit);
  }
  for (let c of aCands) {
    const named = reg.findNamedByValue(c.dim, c.factor);
    if (named && !(c.parts.length === 1 && c.parts[0].def === named && c.parts[0].exp === 1)) c = reg.defUnit(named);
    if (!systemOk(c, system)) continue;
    if (reg.ladderEntryFor(c, system)) {
      derived.push(c);
      continue;
    }
    const isSingle = c.parts.length === 1 && c.parts[0].exp === 1;
    if (isSingle) {
      const best = pickInRange(reg.prefixFamily(c).map((u) => score(q, u)));
      if (best) return best.unit;
      derived.push(c);
    } else {
      unknownCompounds.push(c);
    }
  }

  // B. ladder normalization (SI prefixes, oz→lb, …)
  if (ladder) {
    const best = pickInRange(ladder.map((u) => score(q, u)));
    if (best) return preferSpelling(best.unit, sameDim);
  } else {
    // C. named units of this dimension
    const best = pickInRange(reg.namedUnitsForDim(q.dim, system).map((u) => score(q, u)));
    if (best) return preferSpelling(best.unit, sameDim);
  }

  // D. compound units built from what the user typed (e.g. kg3)
  if (unknownCompounds.length) {
    if (ladder) {
      const named = reg.defs
        .filter((d) => dimEq(d.dim, q.dim) && (d.system === "any" || d.system === system))
        .map((d) => reg.defUnit(d));
      const best = pickInRange(named.map((u) => score(q, u)));
      if (best) return best.unit;
    }
    return unknownCompounds[0];
  }

  // E. nothing fits the readable range: closest candidate (input-derived first)
  const derivedScored = derived.map((u) => score(q, u));
  const dBest = pickClosest(derivedScored);
  if (dBest && dBest.dist < 1) return preferSpelling(dBest.unit, sameDim);
  const pool = ladder ?? reg.namedUnitsForDim(q.dim, system);
  const best = pickClosest([...derivedScored, ...pool.map((u) => score(q, u))]);
  if (best) return preferSpelling(best.unit, sameDim);

  // F. generic compound from base units
  return compound?.unit ?? null;
}
