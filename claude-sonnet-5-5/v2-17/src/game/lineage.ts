import {
  BUILDINGS, DIFFICULTIES, DYN_MODS, HOUSES, MAX_RELIC_LVL, NAMES, RELICS, RELIC_IDS, STAT_KEYS, TRAITS, TRAIT_IDS,
  WEAPONS, baseMods, relicScale, traitsConflict,
  type DifficultyId, type Mods, type StatKey, type Stats, type WeaponId,
} from "./data";

export interface Hero {
  id: number;
  name: string;
  age: number;
  gen: number;
  stats: Stats;
  traits: string[];
  hue: number;
  parents: string[];
  cause?: string;
  depth?: number;
}
export interface Relic {
  uid: number;
  id: string;
  lvl: number;
}
export interface DynStats {
  runs: number;
  kills: number;
  bosses: number;
  goldEarned: number;
  rooms: number;
  deaths: number;
  damage: number;
  relics: number;
}
export interface Dynasty {
  house: string;
  difficulty: DifficultyId;
  mods: string[];
  year: number;
  gen: number;
  gold: number;
  renown: number;
  hero: Hero;
  spouse: Hero | null;
  children: Hero[];
  ancestors: Hero[];
  buildings: Record<string, number>;
  weapons: WeaponId[];
  weapon: WeaponId;
  relics: Relic[];
  equipped: number[];
  realmsCleared: number;
  nextId: number;
  stats: DynStats;
  log: string[];
  suitors: Hero[];
  status: "playing" | "won" | "lost";
  endReason?: string;
  victory?: boolean;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const ri = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

export const bl = (d: Dynasty, id: string) => d.buildings[id] || 0;
export const statCap = (d: Dynasty) => 10 + bl(d, "yard");
export const ageGroup = (age: number) => (age < 16 ? "Child" : age < 24 ? "Youthful" : age < 50 ? "Prime" : "Elder");
export const maxChildren = (d: Dynasty) => 2 + bl(d, "nursery");
export const keepRate = (d: Dynasty) => Math.min(1, 0.55 + 0.09 * bl(d, "vault"));
export const relicSlots = (d: Dynasty) => 1 + (bl(d, "vault") >= 3 ? 1 : 0) + (bl(d, "vault") >= 5 ? 1 : 0);
export const diffMult = (d: Dynasty) => {
  const df = DIFFICULTIES[d.difficulty];
  let hp = df.hp, dmg = df.dmg, gold = df.gold, spd = 1, mut = df.mut, renown = df.renown;
  for (const id of d.mods) {
    const m = DYN_MODS.find((x) => x.id === id);
    if (!m) continue;
    hp *= m.hp ?? 1; dmg *= m.dmg ?? 1; gold *= m.gold ?? 1; spd *= m.spd ?? 1; mut += m.mut ?? 0; renown *= m.renown;
  }
  return { hp, dmg, gold, spd, mut, renown, gens: df.gens };
};

export function heroTitle(h: Hero) {
  const t = h.traits.map((id) => TRAITS[id]).filter(Boolean);
  const first = t.find((x) => x.kind === "mythic") || t.find((x) => x.kind === "good") || t[0];
  return first ? `${h.name} the ${first.name.split(" ")[0].replace(/-.*/, (m) => m)}` : h.name;
}

export const effStats = (h: Hero): Stats => {
  const s = { ...h.stats };
  if (h.age < 24) { s.agility += 1; s.wits -= 1; }
  else if (h.age >= 50) { s.vigor -= 2; s.might -= 1; s.wits += 2; }
  return s;
};

export function heroMods(d: Dynasty, h: Hero): Mods {
  const m = baseMods();
  const s = effStats(h);
  const forge = bl(d, "forge"), hearth = bl(d, "hearth"), vault = bl(d, "vault");
  m.hpBase = 50 + s.vigor * 9 + hearth * 12;
  m.dmg = (1 + s.might * 0.08) * (1 + 0.07 * forge);
  m.crit = 0.05 + s.luck * 0.008 + Math.max(0, forge - 2) * 0.03;
  m.move = 1 + s.agility * 0.018;
  m.atkSpd = 1 + s.agility * 0.015;
  m.dashCd = Math.max(0.5, 1 - s.agility * 0.012);
  m.special = 1 + s.wits * 0.07;
  m.potionHeal = 0.3 + s.wits * 0.012;
  m.gold = 1 + s.luck * 0.03 + vault * 0.06;
  m.potions = 1 + Math.floor(hearth / 2);
  for (const id of h.traits) TRAITS[id]?.apply(m);
  for (const uid of d.equipped) {
    const r = d.relics.find((x) => x.uid === uid);
    if (r && RELICS[r.id]) RELICS[r.id].apply(m, relicScale(r.lvl));
  }
  return m;
}

const hueOf = () => Math.floor(rand(0, 360));

function weightedTrait(exclude: string[], goodBias = 0, allowMythic = true): string {
  const pool: [string, number][] = [];
  for (const id of TRAIT_IDS) {
    if (exclude.some((e) => traitsConflict(e, id))) continue;
    const k = TRAITS[id].kind;
    if (k === "mythic" && !allowMythic) continue;
    let w = k === "good" ? 6 + goodBias * 2 : k === "mixed" ? 3 : k === "bad" ? Math.max(0.5, 2 - goodBias) : 0.35 + goodBias * 0.15;
    pool.push([id, w]);
  }
  let total = pool.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of pool) { r -= w; if (r <= 0) return id; }
  return pool[0]?.[0] ?? "stout";
}

export function randomHero(d: { nextId: number }, gen: number, age: number, base: number, ntraits: number, house?: string): Hero {
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = Math.max(2, Math.round(base + rand(-1.6, 1.6)));
  const traits: string[] = [];
  for (let i = 0; i < ntraits; i++) traits.push(weightedTrait(traits));
  return { id: d.nextId++, name: pick(NAMES) + (house ? "" : ""), age, gen, stats, traits, hue: hueOf(), parents: [] };
}

function inheritTraits(a: Hero, b: Hero, nursery: number, mut: number): string[] {
  const out: string[] = [];
  const pool = Array.from(new Set([...a.traits, ...b.traits]));
  for (const id of pool.sort(() => Math.random() - 0.5)) {
    const t = TRAITS[id];
    const both = a.traits.includes(id) && b.traits.includes(id);
    let p = both ? 0.85 : 0.5;
    if (t.kind === "good" || t.kind === "mythic") p += nursery * 0.08;
    else if (t.kind === "bad") p -= nursery * 0.06;
    if (t.kind === "mythic") p *= 0.75;
    if (chance(p) && out.length < 3 && !out.some((o) => traitsConflict(o, id))) out.push(id);
  }
  if (chance(mut)) {
    const nt = weightedTrait(out, nursery, true);
    if (out.length < 3) out.push(nt);
    else out[Math.floor(Math.random() * out.length)] = nt;
  }
  if (out.length === 0) out.push(weightedTrait([], nursery + 1, false));
  return out;
}

export function makeChild(d: Dynasty, a: Hero, b: Hero): Hero {
  const stats = {} as Stats;
  const cap = statCap(d);
  for (const k of STAT_KEYS) {
    const avg = (a.stats[k] + b.stats[k]) / 2;
    stats[k] = Math.max(2, Math.min(cap, Math.round(avg * 0.7 + 1.5 + rand(-1, 1.2))));
  }
  const mix = (a.hue + b.hue) / 2 + rand(-30, 30);
  return {
    id: d.nextId++, name: pick(NAMES), age: 0, gen: Math.max(a.gen, b.gen) + 1, stats,
    traits: inheritTraits(a, b, bl(d, "nursery"), diffMult(d).mut), hue: ((mix % 360) + 360) % 360, parents: [a.name, b.name],
  };
}

export const suitorCost = (h: Hero) => {
  const sum = STAT_KEYS.reduce((a, k) => a + h.stats[k], 0);
  let c = 20 + sum * 2.2;
  for (const t of h.traits) { const k = TRAITS[t].kind; c += k === "good" ? 18 : k === "mythic" ? 55 : k === "bad" ? -8 : 4; }
  return Math.max(25, Math.round(c));
};
export function makeSuitors(d: Dynasty): Hero[] {
  const out: Hero[] = [];
  for (let i = 0; i < 3; i++) out.push(randomHero(d, d.gen, ri(18, 30), 4.6 + Math.min(2.5, d.gen * 0.15), ri(1, 2)));
  return out;
}

export function logEvent(d: Dynasty, text: string) {
  d.log.unshift(`Y${d.year}: ${text}`);
  if (d.log.length > 60) d.log.length = 60;
}

export function newDynasty(house: string, difficulty: DifficultyId, mods: string[], perks: Record<string, number>): Dynasty {
  const d = {
    house: house || pick(HOUSES), difficulty, mods, year: 1, gen: 1, gold: 60 + 100 * (perks.chest || 0), renown: 0,
    spouse: null, children: [], ancestors: [], buildings: {}, weapons: ["blade"] as WeaponId[], weapon: "blade" as WeaponId,
    relics: [] as Relic[], equipped: [] as number[], realmsCleared: 0, nextId: 1,
    stats: { runs: 0, kills: 0, bosses: 0, goldEarned: 0, rooms: 0, deaths: 0, damage: 0, relics: 0 },
    log: [] as string[], suitors: [] as Hero[], status: "playing" as const,
  } as unknown as Dynasty;
  const hero = randomHero(d, 1, 24, 5, 2);
  const birth = perks.birth || 0;
  for (const k of STAT_KEYS) hero.stats[k] += birth;
  if (perks.blood && hero.traits.length < 3) {
    const good = TRAIT_IDS.filter((t) => ["good", "mythic"].includes(TRAITS[t].kind) && !hero.traits.some((o) => traitsConflict(o, t)));
    hero.traits.push(pick(good));
  }
  d.hero = hero;
  d.spouse = randomHero(d, 1, 22, 5, 2);
  if ((perks.arms || 0) >= 1) d.weapons.push("spear");
  if ((perks.arms || 0) >= 2) d.weapons.push("bow");
  if (perks.kin) {
    const kid = makeChild(d, hero, d.spouse);
    kid.age = 17;
    d.children.push(kid);
  }
  logEvent(d, `House ${d.house} is founded by ${hero.name}.`);
  return d;
}

export function advanceYears(d: Dynasty, n: number) {
  d.year += n;
  d.hero.age += n;
  if (d.spouse) d.spouse.age += n;
  for (const c of d.children) c.age += n;
  if (d.spouse && d.spouse.age >= 66) { logEvent(d, `${d.spouse.name} passes peacefully.`); d.spouse = null; }
}

export function birthAfterExpedition(d: Dynasty): Hero[] {
  const born: Hero[] = [];
  if (!d.spouse || d.children.length >= maxChildren(d)) return born;
  const n = 1 + (chance(Math.max(0, (bl(d, "nursery") - 1) * 0.1 + (bl(d, "nursery") >= 2 ? 0.05 : 0))) ? 1 : 0);
  for (let i = 0; i < n && d.children.length < maxChildren(d); i++) {
    const c = makeChild(d, d.hero, d.spouse);
    d.children.push(c);
    born.push(c);
    logEvent(d, `${c.name} is born to ${d.hero.name} and ${d.spouse.name}.`);
  }
  return born;
}

export function trainCost(d: Dynasty, h: Hero, k: StatKey) {
  const cur = h.stats[k];
  return Math.round((15 + cur * cur * 1.6) * (1 - 0.1 * bl(d, "yard")));
}
export const rebirthCost = (d: Dynasty) => Math.round(70 * (1 - 0.08 * bl(d, "shrine")));
export const cleanseCost = (d: Dynasty) => Math.round(45 * (1 - 0.08 * bl(d, "shrine")));
export const blessCost = (d: Dynasty) => Math.round(160 * (1 - 0.08 * bl(d, "shrine")));

export function riteTraitFor(d: Dynasty, h: Hero, exceptIdx: number) {
  const rest = h.traits.filter((_, i) => i !== exceptIdx);
  return weightedTrait(rest, bl(d, "shrine") + 1, bl(d, "shrine") >= 3);
}

export function addRelic(d: Dynasty, id: string): { relic: Relic; upgraded: boolean } {
  const ex = d.relics.find((r) => r.id === id);
  d.stats.relics++;
  if (ex) {
    ex.lvl = Math.min(MAX_RELIC_LVL, ex.lvl + 2);
    return { relic: ex, upgraded: true };
  }
  const r: Relic = { uid: d.nextId++, id, lvl: 1 };
  d.relics.push(r);
  if (d.equipped.length < relicSlots(d)) d.equipped.push(r.uid);
  return { relic: r, upgraded: false };
}
export const randomRelicId = (exclude: string[] = []) => pick(RELIC_IDS.filter((r) => !exclude.includes(r)).concat(RELIC_IDS));

export interface SuccessionResult {
  lost?: string;
  heirs: Hero[];
}
/** Called when the current hero is dead. Moves them to the ancestors, levels heirlooms, returns heirs to choose from. */
export function retireHero(d: Dynasty, cause: string): SuccessionResult {
  d.hero.cause = cause;
  d.ancestors.push(d.hero);
  logEvent(d, `${d.hero.name} (gen ${d.gen}) ${cause}.`);
  for (const uid of d.equipped) {
    const r = d.relics.find((x) => x.uid === uid);
    if (r) r.lvl = Math.min(MAX_RELIC_LVL, r.lvl + 1);
  }
  const limit = diffMult(d).gens;
  if (d.gen >= limit && !d.victory) {
    d.status = "lost";
    d.endReason = `The bloodline faded after ${limit} generations without ending the Hollow King.`;
    return { lost: d.endReason, heirs: [] };
  }
  d.spouse = null;
  if (d.children.length === 0) {
    if (bl(d, "nursery") >= 1) {
      const kin = randomHero(d, d.gen + 1, ri(20, 30), 4.5 + d.gen * 0.2, ri(1, 2));
      kin.parents = ["Distant Kin"];
      d.children.push(kin);
      logEvent(d, `Distant kin ${kin.name} answers the call of blood.`);
    } else {
      d.status = "lost";
      d.endReason = `${d.hero.name} fell with no heir. The bloodline of House ${d.house} is extinct.`;
      return { lost: d.endReason, heirs: [] };
    }
  }
  return { heirs: d.children.slice() };
}

export function crownHeir(d: Dynasty, id: number) {
  const idx = d.children.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const heir = d.children.splice(idx, 1)[0];
  if (heir.age < 16) advanceYears(d, 16 - heir.age);
  d.hero = heir;
  d.gen += 1;
  d.hero.gen = d.gen;
  d.suitors = makeSuitors(d);
  logEvent(d, `${heir.name} takes up the family blade (gen ${d.gen}).`);
}

export function dynastyScore(d: Dynasty) {
  const won = d.status === "won" || !!d.victory;
  return Math.round(d.stats.bosses * 400 + d.realmsCleared * 250 + d.stats.kills * 2 + d.stats.rooms * 20 + d.gen * 50 + (won ? 3000 + Math.max(0, diffMult(d).gens - d.gen) * 200 : 0));
}
export const marksFor = (d: Dynasty) => Math.round((d.gen + d.stats.bosses * 3 + (d.victory ? 12 : 0)) * (diffMult(d).renown >= 1.5 ? 1.3 : 1));

export const weaponName = (id: WeaponId) => WEAPONS[id].name;
export const buildingName = (id: string) => BUILDINGS.find((b) => b.id === id)?.name ?? id;
