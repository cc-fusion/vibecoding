import { KINDS } from "./data";
import type { Affix, KindId, MechType, StageSpec } from "./types";

export const STAGE_COUNT_BY_TIER = [0, 2, 3, 3, 4, 5];

function weightedPick(rng: () => number, weights: Partial<Record<MechType, number>>): MechType {
  const entries = Object.entries(weights) as [MechType, number][];
  if (entries.length === 0) return "pins";
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

/** Procedurally assemble a multi-stage vault for a contract. */
export function genStages(rng: () => number, kind: KindId, tier: number, count: number): StageSpec[] {
  const stages: StageSpec[] = [];
  const weights = KINDS[kind].weights;
  let last: MechType | null = null;
  for (let i = 0; i < count; i++) {
    let type = weightedPick(rng, weights);
    // avoid repeating the same mechanism back-to-back when we can
    for (let tries = 0; tries < 4 && type === last; tries++) type = weightedPick(rng, weights);
    last = type;
    const level = Math.max(1, Math.min(6, tier + (i >= Math.ceil(count / 2) ? 1 : 0) - (tier === 1 && i === 0 ? 0 : 0)));
    let affix: Affix | undefined;
    if (tier >= 2 && rng() < 0.12 + tier * 0.05) {
      const r = rng();
      affix = r < 0.4 ? "trapped" : r < 0.75 ? "rusted" : "alarmed";
      if (type === "cipher" && affix === "rusted") affix = "trapped";
    }
    stages.push({ type, level, affix, seed: Math.floor(rng() * 1e9) });
  }
  return stages;
}

export function bossStages(seed: number): StageSpec[] {
  const s = (type: MechType, level: number, affix: Affix | undefined, n: number): StageSpec => ({
    type,
    level,
    affix,
    seed: seed + n * 977,
  });
  return [
    s("pins", 5, undefined, 1),
    s("dial", 5, "alarmed", 2),
    s("rings", 6, undefined, 3),
    s("sweep", 6, "trapped", 4),
    s("runes", 6, "alarmed", 5),
    s("cipher", 6, "trapped", 6),
    s("dial", 7, "rusted", 7),
    s("pins", 7, "trapped", 8),
  ];
}
