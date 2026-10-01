// Core data + pure logic for Bio-Forge Alchemist

export type El = "E" | "D" | "M" | "S";
export type IngId = El | "P" | "N";
export const EL_ORDER: El[] = ["E", "D", "M", "S"];

export interface IngDef {
  name: string;
  color: string;
  path: string;
  desc: string;
  base: number;
  short: string;
}

export const ING: Record<IngId, IngDef> = {
  E: {
    name: "Emberroot",
    short: "Ember",
    color: "#ff6a3d",
    path: "M12 2C12 2 6 8 6 14a6 6 0 0 0 12 0c0-3-2-5-3-7-1 2-2 3-3 3 0-3 0-5 0-8z",
    desc: "Smoldering root. Potions with Ember burn monsters.",
    base: 4,
  },
  D: {
    name: "Dewcap",
    short: "Dew",
    color: "#4cc9f0",
    path: "M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z",
    desc: "Dripping mushroom. Potions with Dew soak & slow monsters.",
    base: 3,
  },
  M: {
    name: "Gloomvine",
    short: "Moss",
    color: "#7bd86b",
    path: "M20 3C11 3 5 8 5 15c0 1.5.4 2.8 1 4 1-5 4-9 9-12-4 3-6 6-7 11 1 .6 2 1 3 1 6 0 9-6 9-16z",
    desc: "Clinging vine. Potions with Moss entangle monsters.",
    base: 3,
  },
  S: {
    name: "Sparkbeetle",
    short: "Spark",
    color: "#ffd93d",
    path: "M13 2L4 14h7l-1 8 9-12h-7z",
    desc: "Crackling beetle. Potions with Spark knock monsters back.",
    base: 5,
  },
  P: {
    name: "Prism Shard",
    short: "Prism",
    color: "#e0aaff",
    path: "M12 2l8 7-8 13L4 9z",
    desc: "Catalyst: has no element, but counts as THREE tiles of size. Saves grid space.",
    base: 14,
  },
  N: {
    name: "Null Salt",
    short: "Null",
    color: "#c9d1d9",
    path: "M12 2l8.5 5v10L12 22l-8.5-5V7z",
    desc: "Catalyst: stabilizes a 3+ element cluster, keeping only its two most common elements (no Sludge).",
    base: 10,
  },
};

export const TIER_NAMES = ["Crude", "Fine", "Potent"];
export const TIER_PRICE = [10, 24, 46];
export const TIER_DMG = [12, 30, 65];
export const ROMAN = ["", "I", "II", "III"];

export const POTIONS: Record<string, { name: string; blurb: string }> = {
  E: { name: "Cinder Tonic", blurb: "Warm & toasty." },
  D: { name: "Clear Draught", blurb: "Cool & refreshing." },
  M: { name: "Verdant Salve", blurb: "Smells like a swamp." },
  S: { name: "Zap Fizz", blurb: "Tingly!" },
  ED: { name: "Steam Tonic", blurb: "Sauna in a bottle." },
  EM: { name: "Ashbloom Balm", blurb: "Smoky flowers." },
  ES: { name: "Blast Brew", blurb: "Do not shake." },
  DM: { name: "Regrowth Elixir", blurb: "Grows things. Mostly hair." },
  DS: { name: "Storm Serum", blurb: "Bottled thunderhead." },
  MS: { name: "Jolt Sap", blurb: "Sticky lightning." },
  X: { name: "Chaos Sludge", blurb: "Volatile. Hits every raider." },
};

export const RECIPE_KEYS = ["E", "D", "M", "S", "ED", "EM", "ES", "DM", "DS", "MS", "X"];

export interface Potion {
  key: string;
  tier: number;
}

export function potionName(p: Potion): string {
  return POTIONS[p.key]?.name ?? "Mystery";
}

export function potionValue(key: string, tier: number): number {
  const mult = key === "X" ? 0.6 : key.length === 2 ? 1.5 : 1;
  return Math.round(TIER_PRICE[tier - 1] * mult);
}

export function potionPower(key: string, tier: number): number {
  const mult = key === "X" ? 0.7 : key.length === 2 ? 1.3 : 1;
  return Math.round(TIER_DMG[tier - 1] * mult);
}

export function sizeToTier(size: number): number {
  return size >= 5 ? 3 : size >= 3 ? 2 : 1;
}

// ---------- Grid evaluation ----------
export interface Cluster {
  cells: number[];
  size: number;
  key: string | null;
  tier: number;
  note: string;
}

export function evalGrid(grid: (IngId | null)[], n: number): Cluster[] {
  const seen: boolean[] = new Array(grid.length).fill(false);
  const out: Cluster[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || seen[i]) continue;
    const cells: number[] = [];
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % n;
      const y = Math.floor(c / n);
      const nb: number[] = [];
      if (x > 0) nb.push(c - 1);
      if (x < n - 1) nb.push(c + 1);
      if (y > 0) nb.push(c - n);
      if (y < n - 1) nb.push(c + n);
      for (const q of nb) {
        if (grid[q] && !seen[q]) {
          seen[q] = true;
          stack.push(q);
        }
      }
    }
    const counts: Record<El, number> = { E: 0, D: 0, M: 0, S: 0 };
    let size = 0;
    let hasN = false;
    for (const c of cells) {
      const g = grid[c]!;
      if (g === "P") size += 3;
      else if (g === "N") {
        size += 1;
        hasN = true;
      } else {
        size += 1;
        counts[g]++;
      }
    }
    const present = EL_ORDER.filter((e) => counts[e] > 0);
    let key: string | null = null;
    let note = "";
    if (present.length === 0) {
      note = "No element - this will fizzle out!";
    } else if (present.length <= 2) {
      key = present.join("");
    } else if (hasN) {
      const top = [...present]
        .sort((a, b) => counts[b] - counts[a] || EL_ORDER.indexOf(a) - EL_ORDER.indexOf(b))
        .slice(0, 2);
      key = EL_ORDER.filter((e) => top.includes(e)).join("");
      note = "Null Salt stabilized it.";
    } else {
      key = "X";
      note = "3+ elements = unstable Sludge. Add Null Salt to tame it.";
    }
    out.push({ cells, size, key, tier: sizeToTier(size), note });
  }
  return out;
}

// ---------- Monsters ----------
export interface Look {
  body: string;
  belly: string;
  shape: "blob" | "biped" | "ghost" | "imp" | "wisp" | "brute" | "dragon";
  eyes: number;
  horns?: boolean;
  ears?: boolean;
  teeth?: boolean;
  hat?: string;
}

export interface MonDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  atkInt: number;
  steal: number;
  weak: El | null;
  r: number;
  look: Look;
  fav?: El | "pair" | "X";
  ranged?: number;
  bounty: number;
  quirks: string[];
  kind: "cust" | "raid" | "boss";
  blurb: string;
}

export const MON: Record<string, MonDef> = {
  slime: {
    name: "Slimelet", hp: 45, speed: 70, dmg: 5, atkInt: 2, steal: 0, weak: "S", r: 26, fav: "D", bounty: 5, kind: "cust",
    look: { body: "#57c7e8", belly: "#b8ecfa", shape: "blob", eyes: 2 },
    quirks: ["Blorp! Something wet, please.", "I'm 80% puddle today.", "Got anything... moist?"],
    blurb: "Craves Dew potions.",
  },
  goblin: {
    name: "Cinder Goblin", hp: 50, speed: 72, dmg: 6, atkInt: 2, steal: 0, weak: "D", r: 26, fav: "E", bounty: 5, kind: "cust",
    look: { body: "#e2733a", belly: "#f7b58a", shape: "biped", eyes: 2, ears: true, teeth: true },
    quirks: ["My tail's gone cold. Fix it!", "Hot hot hot - MORE!", "Make my soup spicier."],
    blurb: "Craves Ember potions.",
  },
  troll: {
    name: "Mossback Troll", hp: 85, speed: 60, dmg: 9, atkInt: 2.3, steal: 0, weak: "E", r: 32, fav: "M", bounty: 7, kind: "cust",
    look: { body: "#5e9c4a", belly: "#a7d08f", shape: "brute", eyes: 2, teeth: true },
    quirks: ["Moss fell off. Embarrassing.", "Need to regrow my beard.", "Grrr... garden salad."],
    blurb: "Craves Moss potions.",
  },
  imp: {
    name: "Zapling", hp: 40, speed: 80, dmg: 5, atkInt: 1.5, steal: 0, weak: "M", r: 24, fav: "S", bounty: 5, kind: "cust",
    look: { body: "#f3d34a", belly: "#fff3a8", shape: "imp", eyes: 2, horns: true },
    quirks: ["Zzzt! My static's low!", "Charge me up, shopkeep!", "Bzzzt. Bzzzt. BZZT."],
    blurb: "Craves Spark potions.",
  },
  ghost: {
    name: "Phantom Dowager", hp: 55, speed: 55, dmg: 7, atkInt: 2.2, steal: 0, weak: "S", r: 30, fav: "pair", bounty: 8, kind: "cust",
    look: { body: "#c9c4f2", belly: "#eeeaff", shape: "ghost", eyes: 2, hat: "#7a5cc9" },
    quirks: ["A blend, dearie. Nothing plain.", "Something... complicated.", "Two flavors, like my two husbands."],
    blurb: "Only orders two-element blends.",
  },
  gremlin: {
    name: "Gremlin", hp: 50, speed: 85, dmg: 6, atkInt: 1.6, steal: 4, weak: "M", r: 24, fav: "X", bounty: 8, kind: "cust",
    look: { body: "#8fa34a", belly: "#cfe08a", shape: "imp", eyes: 2, ears: true, teeth: true },
    quirks: ["Mix 'em ALL! Hehehe!", "Make it explode-y!", "Chaos! Give me chaos!"],
    blurb: "Wants Chaos Sludge. Nobody else does.",
  },
  looter: {
    name: "Gobbo Looter", hp: 32, speed: 75, dmg: 4, atkInt: 1.6, steal: 7, weak: "S", r: 24, bounty: 6, kind: "raid",
    look: { body: "#6f8a3a", belly: "#b5c77a", shape: "biped", eyes: 2, ears: true, teeth: true, hat: "#3b2a1a" },
    quirks: [], blurb: "Steals gold on every hit.",
  },
  sprinter: {
    name: "Imp Sprinter", hp: 20, speed: 140, dmg: 3, atkInt: 1, steal: 0, weak: "D", r: 20, bounty: 5, kind: "raid",
    look: { body: "#d94f70", belly: "#f6a0b4", shape: "imp", eyes: 2, horns: true },
    quirks: [], blurb: "Fast, fragile, relentless.",
  },
  brute: {
    name: "Bog Brute", hp: 110, speed: 42, dmg: 10, atkInt: 2.4, steal: 0, weak: "E", r: 36, bounty: 14, kind: "raid",
    look: { body: "#6b5b3e", belly: "#a89570", shape: "brute", eyes: 1, teeth: true, horns: true },
    quirks: [], blurb: "Slow tank. Hits like a wagon.",
  },
  wisp: {
    name: "Hexing Wisp", hp: 42, speed: 55, dmg: 5, atkInt: 2.4, steal: 0, weak: "M", r: 22, ranged: 560, bounty: 10, kind: "raid",
    look: { body: "#9b6bff", belly: "#d9c5ff", shape: "wisp", eyes: 1 },
    quirks: [], blurb: "Curses the shop from afar.",
  },
  ogre: {
    name: "Baron Grumblegut", hp: 300, speed: 28, dmg: 14, atkInt: 2.6, steal: 12, weak: "E", r: 62, bounty: 90, kind: "boss",
    look: { body: "#a0533b", belly: "#e0a284", shape: "brute", eyes: 2, teeth: true, horns: true, hat: "#d4af37" },
    quirks: [], blurb: "The Tax Ogre. Wants 'back taxes'.",
  },
  dragon: {
    name: "Hoardwyrm Vexnar", hp: 600, speed: 22, dmg: 16, atkInt: 2.3, steal: 0, weak: "D", r: 78, ranged: 520, bounty: 220, kind: "boss",
    look: { body: "#b02a4a", belly: "#f0a05a", shape: "dragon", eyes: 1, horns: true, teeth: true },
    quirks: [], blurb: "Ancient dragon. Summons imps.",
  },
};

export const CUST_TYPES = ["slime", "goblin", "troll", "imp", "ghost", "gremlin"];

// ---------- Orders & schedule ----------
export interface Order {
  key: string;
  tier: number;
  hidden: boolean;
}

export interface SpawnEvent {
  t: number;
  kind: "cust" | "raid" | "boss";
  type: string;
  order?: Order;
}

export const DAY_LEN = 70;

function rnd<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export function allKeys(day: number): string[] {
  const singles = ["E", "D", "M", "S"];
  const pairs = ["ED", "EM", "ES", "DM", "DS", "MS"];
  return day >= 3 ? [...singles, ...pairs] : singles;
}

export function makeOrder(type: string, day: number, hidden: boolean): Order {
  const def = MON[type];
  const keys = allKeys(day);
  let key: string;
  if (def.fav === "X") key = "X";
  else if (def.fav === "pair") key = rnd(keys.filter((k) => k.length === 2));
  else {
    const f = def.fav as El;
    const withF = keys.filter((k) => k.includes(f));
    const pure = withF.filter((k) => k.length === 1);
    const pairs = withF.filter((k) => k.length === 2);
    key = pairs.length && Math.random() < 0.5 ? rnd(pairs) : rnd(pure);
  }
  let tier = 1;
  const p2 = Math.min(0.6, Math.max(0, (day - 2) * 0.15));
  const p3 = day >= 5 ? Math.min(0.35, (day - 4) * 0.1) : 0;
  const r = Math.random();
  if (r < p3) tier = 3;
  else if (r < p3 + p2) tier = 2;
  return { key, tier, hidden };
}

export function bossFor(day: number): string | null {
  if (day % 5 !== 0) return null;
  return day === 5 ? "ogre" : "dragon";
}

export function bossHpMult(day: number): number {
  return day <= 10 ? 1 : 1 + (day - 10) * 0.12;
}

export function makeSchedule(day: number): SpawnEvent[] {
  const ev: SpawnEvent[] = [];
  const nC = Math.min(14, 3 + day);
  const boss = bossFor(day);
  let nR = day === 1 ? 0 : Math.min(14, Math.floor(day * 0.85));
  if (boss) nR = Math.max(1, nR - 1);

  const ctypes = ["slime", "goblin", "troll", "imp"];
  if (day >= 3) ctypes.push("ghost", "ghost");
  if (day >= 6) ctypes.push("gremlin", "gremlin");
  const rtypes = ["looter"];
  if (day >= 3) rtypes.push("sprinter");
  if (day >= 4) rtypes.push("brute");
  if (day >= 5) rtypes.push("wisp");

  const span = DAY_LEN - 10;
  for (let i = 0; i < nC; i++) {
    const t = 2 + (i + Math.random() * 0.8) * (span / nC);
    const type = rnd(ctypes);
    const hidden = day >= 2 && Math.random() < 0.25;
    ev.push({ t, kind: "cust", type, order: makeOrder(type, day, hidden) });
  }
  for (let i = 0; i < nR; i++) {
    const t = 11 + (i + Math.random() * 0.8) * ((span - 9) / nR);
    ev.push({ t, kind: "raid", type: rnd(rtypes) });
  }
  if (boss) ev.push({ t: 40, kind: "boss", type: boss });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

// ---------- Upgrades ----------
export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: "forge", name: "Wider Forge", desc: "Grows the cauldron grid (+1 row & column).", costs: [70, 160] },
  { id: "shelf", name: "Potion Shelf", desc: "+4 potion shelf slots.", costs: [50, 100, 180] },
  { id: "walls", name: "Reinforced Walls", desc: "+25 max Shop Integrity (and repairs 25).", costs: [60, 110, 180] },
  { id: "rune", name: "Ward Rune", desc: "An arcane sentry zaps the closest raider automatically.", costs: [90, 150, 240] },
  { id: "hands", name: "Quick Hands", desc: "Faster potion throwing & swatting.", costs: [50, 100] },
  { id: "incense", name: "Calming Incense", desc: "+20% customer patience.", costs: [50, 100, 160] },
  { id: "garden", name: "Spore Garden", desc: "Grows 2 free random ingredients overnight per level.", costs: [70, 140, 220] },
  { id: "sign", name: "Golden Sign", desc: "+10% gold on every sale.", costs: [60, 120, 200] },
  { id: "prism", name: "Prism Contract", desc: "Unlocks Prism Shards in the market.", costs: [80] },
  { id: "nullsalt", name: "Null Salt Contract", desc: "Unlocks Null Salt in the market.", costs: [70] },
];

// ---------- Game state ----------
export interface DayStats {
  served: number;
  earned: number;
  killed: number;
  angry: number;
  integrityLost: number;
  stolen: number;
  bestCombo: number;
}

export interface Game {
  day: number;
  gold: number;
  integrity: number;
  inv: Record<IngId, number>;
  shelf: Potion[];
  grid: (IngId | null)[];
  upg: Record<string, number>;
  prices: Record<IngId, number>;
  schedule: SpawnEvent[];
  stats: DayStats;
  totals: { served: number; earned: number; killed: number; days: number };
  endless: boolean;
  notes: string[];
}

export const emptyStats = (): DayStats => ({ served: 0, earned: 0, killed: 0, angry: 0, integrityLost: 0, stolen: 0, bestCombo: 0 });

export const getGridN = (g: Game) => 4 + (g.upg.forge || 0);
export const getShelfCap = (g: Game) => 8 + 4 * (g.upg.shelf || 0);
export const getMaxIntegrity = (g: Game) => 100 + 25 * (g.upg.walls || 0);
export const getThrowCd = (g: Game) => 0.6 - 0.15 * (g.upg.hands || 0);
export const getPatienceMult = (g: Game) => 1 + 0.2 * (g.upg.incense || 0);
export const getPriceMult = (g: Game) => 1 + 0.1 * (g.upg.sign || 0);
export const availableIngs = (g: Game): IngId[] => {
  const l: IngId[] = ["E", "D", "M", "S"];
  if (g.upg.prism) l.push("P");
  if (g.upg.nullsalt) l.push("N");
  return l;
};

export function rollPrices(): Record<IngId, number> {
  const r = (b: number, v: number) => Math.max(2, b + Math.floor(Math.random() * (2 * v + 1)) - v);
  return { E: r(4, 1), D: r(3, 1), M: r(3, 1), S: r(5, 1), P: r(14, 2), N: r(10, 2) };
}

export function newGame(): Game {
  const g: Game = {
    day: 1,
    gold: 60,
    integrity: 100,
    inv: { E: 3, D: 3, M: 3, S: 2, P: 0, N: 0 },
    shelf: [],
    grid: new Array(16).fill(null),
    upg: {},
    prices: rollPrices(),
    schedule: [],
    stats: emptyStats(),
    totals: { served: 0, earned: 0, killed: 0, days: 0 },
    endless: false,
    notes: [],
  };
  g.schedule = makeSchedule(1);
  return g;
}

// Called at the beginning of each day's prep phase.
export function beginDayPrep(g: Game) {
  g.prices = rollPrices();
  g.schedule = makeSchedule(g.day);
  g.stats = emptyStats();
  g.notes = [];
  const n = getGridN(g);
  if (g.grid.length !== n * n) g.grid = new Array(n * n).fill(null);
  const garden = g.upg.garden || 0;
  if (garden > 0) {
    const got: string[] = [];
    for (let i = 0; i < garden * 2; i++) {
      const e = rnd(EL_ORDER);
      g.inv[e]++;
      got.push(ING[e].short);
    }
    g.notes.push(`Your Spore Garden sprouted: ${got.join(", ")}.`);
  }
  const tiles = g.inv.E + g.inv.D + g.inv.M + g.inv.S;
  if (g.day > 1 && g.gold < 12 && tiles + g.shelf.length < 3) {
    for (let i = 0; i < 4; i++) g.inv[rnd(EL_ORDER)]++;
    g.notes.push("The Alchemists' Guild took pity on you and sent a charity parcel of 4 ingredients.");
  }
}

export function totalScore(g: Game): number {
  return g.totals.earned + g.totals.days * 100 + g.totals.killed * 10 + g.totals.served * 5;
}

export function bestScore(): number {
  try {
    return parseInt(localStorage.getItem("bfa_best") || "0", 10) || 0;
  } catch {
    return 0;
  }
}
export function saveBest(score: number) {
  try {
    if (score > bestScore()) localStorage.setItem("bfa_best", String(score));
  } catch {
    /* ignore */
  }
}
