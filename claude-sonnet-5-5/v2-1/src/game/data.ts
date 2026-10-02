// ---------- Core constants, definitions and persistence for Tidal Forge Citadel ----------
export const W = 1280;
export const H = 720;
export const TIDE_T = 60; // seconds per tide cycle
export const MEAN_SEA = 450;
export const WALL_X0 = 705;
export const WALL_X1 = 745;
export const WALL_TOP0 = 300;
export const LAGOON_X0 = 440;
export const LAGOON_MIN_Y = 300;
export const LAGOON_MAX_Y = 560;
export const WAVE_COUNT = 12;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type ResKey = 'stone' | 'iron' | 'gold';
export type Cost = Partial<Record<ResKey, number>>;
export type PlotKind = 'high' | 'terrace' | 'beach' | 'mount';
export type BType =
  | 'quarry' | 'ironworks' | 'saltworks' | 'fishery' | 'mess' | 'barracks' | 'carpenter' | 'battery' | 'observatory'
  | 'ballista' | 'cannon' | 'catapult' | 'hydro' | 'keep' | 'wall';
export type EType = 'skiff' | 'fireship' | 'galley' | 'bombard' | 'tidecaller' | 'ironclad' | 'maelstrom' | 'leviathan';

export interface Plot { id: string; kind: PlotKind; x: number; y: number; label: string; floatY?: number; wallMount?: boolean; req?: string }

// Solid ground profile (left -> right). The pit between x=440 and x=705 is the tidal lagoon.
export const TERRAIN: [number, number][] = [
  [0, 262], [440, 262], [440, 330], [500, 330], [500, 410], [560, 410], [560, 490], [620, 490], [620, 570], [705, 570],
  [705, 300], [745, 300], [745, 566], [780, 566], [790, 500], [850, 500], [870, 566], [1040, 576], [1110, 700], [1280, 700],
];
const SEABED: [number, number][] = [[745, 566], [780, 566], [790, 500], [850, 500], [870, 566], [1040, 576], [1110, 700], [1400, 700]];
export function seabedY(x: number): number {
  if (x <= SEABED[0][0]) return 566;
  for (let i = 1; i < SEABED.length; i++) {
    const a = SEABED[i - 1], b = SEABED[i];
    if (x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
  }
  return 700;
}

export const PLOTS: Plot[] = [
  { id: 'H0', kind: 'high', x: 160, y: 262, label: 'Upper Yard I' },
  { id: 'H1', kind: 'high', x: 216, y: 262, label: 'Upper Yard II' },
  { id: 'H2', kind: 'high', x: 272, y: 262, label: 'Upper Yard III' },
  { id: 'H3', kind: 'high', x: 328, y: 262, label: 'Upper Yard IV' },
  { id: 'H4', kind: 'high', x: 384, y: 262, label: 'Upper Yard V' },
  { id: 'T1', kind: 'terrace', x: 470, y: 330, label: 'Lagoon Terrace I (high)' },
  { id: 'T2', kind: 'terrace', x: 530, y: 410, label: 'Lagoon Terrace II (mid)' },
  { id: 'T3', kind: 'terrace', x: 590, y: 490, label: 'Lagoon Terrace III (low)' },
  { id: 'B0', kind: 'beach', x: 820, y: 500, label: 'Tide-Pool Rocks' },
  { id: 'M0', kind: 'mount', x: 768, y: 318, floatY: 392, wallMount: true, label: 'Wall Battery (high)' },
  { id: 'M1', kind: 'mount', x: 768, y: 392, floatY: 445, wallMount: true, label: 'Wall Battery (mid)' },
  { id: 'M2', kind: 'mount', x: 768, y: 458, floatY: 500, wallMount: true, label: 'Wall Battery (low)' },
  { id: 'M3', kind: 'mount', x: 915, y: 548, floatY: 490, label: 'Offshore Pier' },
  { id: 'M4', kind: 'mount', x: 985, y: 555, floatY: 465, label: 'Outer Pier', req: 'u_pierB' },
];
export const PLOT_BY_ID: Record<string, Plot> = Object.fromEntries(PLOTS.map((p) => [p.id, p]));

export interface BDef {
  name: string; icon: string; desc: string; kinds: PlotKind[]; cost: Cost; crew: number; hp: number;
  waterproof?: boolean; unlock?: string; engine?: boolean; power?: number; hidden?: boolean; wallOnly?: boolean;
}
export const BDEFS: Record<BType, BDef> = {
  quarry: { name: 'Quarry', icon: '⛏️', desc: 'Cuts stone from the headland. Slightly power-assisted.', kinds: ['high', 'terrace'], cost: { stone: 25 }, crew: 2, hp: 140, power: 0.4 },
  ironworks: { name: 'Ironworks', icon: '🔥', desc: 'Smelts stone into iron for ammunition and upgrades. Power hungry.', kinds: ['high'], cost: { stone: 60, gold: 20 }, crew: 2, hp: 170, power: 1.2 },
  saltworks: { name: 'Brine Pans', icon: '🧂', desc: 'Evaporates lagoon brine into salt (gold). Best when the lagoon surface sits near the pan level.', kinds: ['terrace'], cost: { stone: 50, iron: 10 }, crew: 1, hp: 130, power: 0.4, waterproof: true },
  fishery: { name: 'Tide-Pool Fishery', icon: '🐟', desc: 'Harvests rations from tide pools. Only works while the rocks are exposed at low tide.', kinds: ['beach'], cost: { stone: 30 }, crew: 2, hp: 110, waterproof: true },
  mess: { name: 'Mess Hall', icon: '🍲', desc: 'Turns rations into morale. Staffed halls lift the crew equilibrium.', kinds: ['high', 'terrace'], cost: { stone: 40, gold: 10 }, crew: 1, hp: 140 },
  barracks: { name: 'Barracks', icon: '🛏️', desc: 'Houses +6 crew per level and mildly lifts morale.', kinds: ['high'], cost: { stone: 55 }, crew: 0, hp: 170 },
  carpenter: { name: "Carpenter's Yard", icon: '🪚', desc: 'Auto-repairs damaged buildings (costs stone) and douses fires.', kinds: ['high', 'terrace'], cost: { stone: 45, iron: 10 }, crew: 2, hp: 120, power: 0.4 },
  battery: { name: 'Capacitor Bank', icon: '🔋', desc: 'Stores +120 power per level so tidal surges are not wasted.', kinds: ['high', 'terrace'], cost: { stone: 35, iron: 20 }, crew: 0, hp: 110 },
  observatory: { name: 'Tide Observatory', icon: '🔭', desc: 'Longer tide forecast, +6% engine range per level, and previews the next wave.', kinds: ['high'], cost: { stone: 70, iron: 20, gold: 30 }, crew: 1, hp: 120, unlock: 'u_observatory' },
  ballista: { name: 'Wave Ballista', icon: '🏹', desc: 'Fast piercing bolts. Weak against armor. Cheap.', kinds: ['mount'], cost: { stone: 35, iron: 15 }, crew: 1, hp: 120, engine: true },
  cannon: { name: 'Tide Cannon', icon: '💣', desc: 'Heavy explosive shot with splash. Burns iron.', kinds: ['mount'], cost: { stone: 70, iron: 45 }, crew: 2, hp: 150, engine: true, unlock: 'u_cannon' },
  catapult: { name: 'Surge Catapult', icon: '🪨', desc: 'Lobs boulders. Massive splash and +80% damage to grounded ships.', kinds: ['mount'], cost: { stone: 90, iron: 35 }, crew: 2, hp: 150, engine: true, unlock: 'u_catapult' },
  hydro: { name: 'Hydro-Ram', icon: '🌊', desc: 'Fires a piercing water jet fed by the lagoon. Damage scales with lagoon head. Wall mounts only.', kinds: ['mount'], cost: { stone: 75, iron: 40, gold: 25 }, crew: 1, hp: 140, engine: true, wallOnly: true, unlock: 'u_hydro' },
  keep: { name: 'The Keep', icon: '🏰', desc: 'Your citadel heart. If it falls, the war is lost.', kinds: [], cost: {}, crew: 0, hp: 900, hidden: true },
  wall: { name: 'Seawall', icon: '🧱', desc: 'Holds back the sea and the enemy.', kinds: [], cost: {}, crew: 0, hp: 1000, hidden: true },
};

export interface EngDef { period: number; dmg: number; range: number; aoe: number; ammo: number; speed: number; g: number; kind: 'bolt' | 'ball' | 'boulder' | 'jet' }
export const ENGDEFS: Record<string, EngDef> = {
  ballista: { period: 1.3, dmg: 18, range: 390, aoe: 0, ammo: 0.5, speed: 780, g: 70, kind: 'bolt' },
  cannon: { period: 3.4, dmg: 58, range: 450, aoe: 42, ammo: 2, speed: 540, g: 420, kind: 'ball' },
  catapult: { period: 5.4, dmg: 95, range: 340, aoe: 66, ammo: 3, speed: 340, g: 520, kind: 'boulder' },
  hydro: { period: 2.3, dmg: 22, range: 320, aoe: 0, ammo: 0, speed: 0, g: 0, kind: 'jet' },
};

export interface EDef { name: string; hp: number; speed: number; draft: number; size: number; armor: number; range: number; dmg: number; rate: number; pts: number; bounty: number; col: string; desc: string; boss?: boolean; from: number }
export const EDEF: Record<EType, EDef> = {
  skiff: { name: 'Raider Skiff', hp: 38, speed: 62, draft: 14, size: 36, armor: 0, range: 66, dmg: 7, rate: 1.1, pts: 1, bounty: 4, col: '#c9a66b', desc: 'Fast boarders. Cross the shoals at any tide.', from: 1 },
  galley: { name: 'Ram Galley', hp: 170, speed: 30, draft: 55, size: 72, armor: 2, range: 46, dmg: 26, rate: 1.7, pts: 3, bounty: 12, col: '#a35d3d', desc: 'Rams the seawall and batteries. Grounds out at low tide.', from: 2 },
  fireship: { name: 'Fire Ship', hp: 64, speed: 46, draft: 36, size: 48, armor: 0, range: 36, dmg: 55, rate: 99, pts: 2, bounty: 7, col: '#e8743b', desc: 'Explodes on contact and ignites buildings. Flooding douses fires.', from: 3 },
  bombard: { name: 'Bombard Barge', hp: 130, speed: 24, draft: 90, size: 80, armor: 2, range: 430, dmg: 36, rate: 3.6, pts: 4, bounty: 16, col: '#6a7a8a', desc: 'Outranges most engines and shells random buildings.', from: 4 },
  tidecaller: { name: 'Tidecaller', hp: 110, speed: 26, draft: 60, size: 62, armor: 0, range: 0, dmg: 0, rate: 14, pts: 4, bounty: 18, col: '#4fc3d9', desc: 'Conjures surges that raise the sea and flood your works.', from: 5 },
  ironclad: { name: 'Ironclad', hp: 430, speed: 19, draft: 130, size: 98, armor: 9, range: 270, dmg: 30, rate: 2.6, pts: 6, bounty: 30, col: '#59616b', desc: 'Armored hull. Bolts bounce; only floods the shoals at high tide.', from: 7 },
  maelstrom: { name: 'Admiral Brack — Maelstrom', hp: 1900, speed: 15, draft: 140, size: 132, armor: 5, range: 410, dmg: 34, rate: 3.2, pts: 0, bounty: 150, col: '#8b2d3a', desc: 'Flagship. Salvos, then summons raiders, then burns everything.', boss: true, from: 99 },
  leviathan: { name: 'The Drowned King — Leviathan', hp: 4000, speed: 13, draft: 165, size: 172, armor: 7, range: 470, dmg: 42, rate: 3, pts: 0, bounty: 300, col: '#2a6b66', desc: 'Calls storm surges and a drowned fleet. Needs deep water to reach you.', boss: true, from: 99 },
};

export interface Diff { id: string; name: string; desc: string; hp: number; count: number; dmg: number; res: number; grace: number; renown: number; drain: number; evt: number }
export const DIFFS: Diff[] = [
  { id: 'calm', name: 'Calm Waters', desc: 'Weaker fleets, generous resources, long preparation. Renown x0.7.', hp: 0.8, count: 0.8, dmg: 0.75, res: 1.25, grace: 80, renown: 0.7, drain: 0.7, evt: 0.7 },
  { id: 'open', name: 'Open Sea', desc: 'The intended experience. Balanced fleets and weather.', hp: 1, count: 1, dmg: 1, res: 1, grace: 55, renown: 1, drain: 1, evt: 1 },
  { id: 'tempest', name: 'Tempest', desc: 'Bigger fleets, harsher weather, thin resources. Renown x1.6.', hp: 1.3, count: 1.25, dmg: 1.3, res: 0.85, grace: 40, renown: 1.6, drain: 1.3, evt: 1.5 },
];
export interface Mod { id: string; name: string; desc: string; bonus: number }
export const MODS: Mod[] = [
  { id: 'spring', name: 'Spring Tides', desc: 'Tidal range +30%: higher highs, lower lows.', bonus: 0.15 },
  { id: 'rusty', name: 'Rusty Winches', desc: 'Sluice gates flow 45% slower.', bonus: 0.15 },
  { id: 'restless', name: 'Restless Crew', desc: 'Morale falls faster and the crew is easier to rattle.', bonus: 0.2 },
  { id: 'ironfleet', name: 'Iron Fleet', desc: 'Enemies have +25% HP and Ironclads arrive early.', bonus: 0.25 },
];

export interface CharterDef { id: string; name: string; icon: string; desc: string; max: number; cost: (lvl: number) => number; group: 'Upgrade' | 'Unlock' }
export const CHARTER: CharterDef[] = [
  { id: 'found', name: 'Deep Foundations', icon: '🪨', desc: '+25 starting stone per rank.', max: 4, cost: (l) => 6 + 4 * l, group: 'Upgrade' },
  { id: 'guild', name: "Sailors' Guild", icon: '⚓', desc: '+2 starting crew per rank.', max: 3, cost: (l) => 8 + 6 * l, group: 'Upgrade' },
  { id: 'almanac', name: 'Tide Almanac', icon: '📜', desc: 'Tide forecast reaches 0.4 cycles further per rank.', max: 2, cost: (l) => 10 + 8 * l, group: 'Upgrade' },
  { id: 'granite', name: 'Granite Sills', icon: '🧱', desc: 'Seawall and Keep HP +20% per rank.', max: 4, cost: (l) => 8 + 6 * l, group: 'Upgrade' },
  { id: 'winches', name: 'Oiled Winches', icon: '⚙️', desc: 'Sluice flow +20% per rank.', max: 3, cost: (l) => 9 + 6 * l, group: 'Upgrade' },
  { id: 'artisan', name: 'Master Artisans', icon: '🔨', desc: 'Workshop output +12% per rank.', max: 4, cost: (l) => 10 + 6 * l, group: 'Upgrade' },
  { id: 'ordnance', name: 'Ordnance Guild', icon: '🎯', desc: 'Engine damage +8% per rank.', max: 4, cost: (l) => 12 + 8 * l, group: 'Upgrade' },
  { id: 'merchant', name: 'Merchant Charter', icon: '💰', desc: '+12% gold income and +25 starting gold per rank.', max: 3, cost: (l) => 8 + 7 * l, group: 'Upgrade' },
  { id: 'u_cannon', name: 'Blueprint: Tide Cannon', icon: '💣', desc: 'Unlocks the Tide Cannon.', max: 1, cost: () => 12, group: 'Unlock' },
  { id: 'u_observatory', name: 'Blueprint: Observatory', icon: '🔭', desc: 'Unlocks the Tide Observatory.', max: 1, cost: () => 18, group: 'Unlock' },
  { id: 'u_pierB', name: 'Outer Pier Rights', icon: '🌉', desc: 'Unlocks a second offshore pier mount.', max: 1, cost: () => 22, group: 'Unlock' },
  { id: 'u_catapult', name: 'Blueprint: Surge Catapult', icon: '🪨', desc: 'Unlocks the Surge Catapult.', max: 1, cost: () => 26, group: 'Unlock' },
  { id: 'u_hydro', name: 'Blueprint: Hydro-Ram', icon: '🌊', desc: 'Unlocks the lagoon-fed Hydro-Ram.', max: 1, cost: () => 40, group: 'Unlock' },
];

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; particles: boolean }
export interface Save {
  renown: number; charter: Record<string, number>; bestWave: number; bestScore: number; runs: number; wins: number;
  kills: number; seenTutorial: boolean; settings: Settings;
}
export const DEFAULT_SAVE: Save = {
  renown: 0, charter: {}, bestWave: 0, bestScore: 0, runs: 0, wins: 0, kills: 0, seenTutorial: false,
  settings: { master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, particles: true },
};
const KEY = 'tidalForgeCitadel.v1';
let memSave: Save | null = null;
export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...DEFAULT_SAVE, ...p, settings: { ...DEFAULT_SAVE.settings, ...(p.settings || {}) }, charter: p.charter || {} };
    }
  } catch { /* storage unavailable */ }
  return memSave ? memSave : { ...DEFAULT_SAVE, charter: {}, settings: { ...DEFAULT_SAVE.settings } };
}
export function writeSave(s: Save) {
  memSave = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export const hasCharter = (s: Save, id: string) => (s.charter[id] || 0) > 0;

// Deterministic RNG so wave previews match actual waves
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Spawn { t: number; type: EType }
export function buildWave(n: number, diff: Diff, ironFleet: boolean): Spawn[] {
  const r = mulberry(n * 7919 + 13);
  const out: Spawn[] = [];
  const bossType: EType | null = n === 6 ? 'maelstrom' : n >= 12 && n % 6 === 0 ? 'leviathan' : null;
  if (bossType) out.push({ t: 4, type: bossType });
  let pts = (4 + 3.4 * n) * diff.count * (bossType ? 0.55 : 1);
  const pool = (Object.keys(EDEF) as EType[]).filter((k) => !EDEF[k].boss && EDEF[k].from <= n + (ironFleet && k === 'ironclad' ? 3 : 0));
  let guard = 0;
  while (pts > 0.5 && guard++ < 120) {
    const afford = pool.filter((k) => EDEF[k].pts <= pts + 0.5);
    if (!afford.length) break;
    const weights = afford.map((k) => (k === 'skiff' ? 3 : k === 'ironclad' ? 1 : 1.6));
    let roll = r() * weights.reduce((a, b) => a + b, 0);
    let pick = afford[0];
    for (let i = 0; i < afford.length; i++) { roll -= weights[i]; if (roll <= 0) { pick = afford[i]; break; } }
    out.push({ t: 2 + r() * 44, type: pick });
    pts -= EDEF[pick].pts;
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface AbilityDef { id: string; key: string; name: string; icon: string; desc: string; cd: number; cost: string }
export const ABILITIES: AbilityDef[] = [
  { id: 'rally', key: 'Q', name: 'Rally Cry', icon: '📯', desc: 'Raise morale by 25. Costs 15 rations.', cd: 40, cost: '15 rations' },
  { id: 'arc', key: 'W', name: 'Arc Discharge', icon: '⚡', desc: 'Lightning through the sea hurts every ship (more in shallows). Costs 60 power.', cd: 25, cost: '60 power' },
  { id: 'shore', key: 'E', name: 'Emergency Shoring', icon: '🛠️', desc: 'Repairs 20% of every structure. Costs 25 stone.', cd: 30, cost: '25 stone' },
  { id: 'brigade', key: 'R', name: 'Fire Brigade', icon: '🚒', desc: 'Douses every fire using 25px of lagoon water.', cd: 20, cost: 'lagoon water' },
];

export const TUT = [
  { title: 'Welcome, Harbormaster', body: 'The moon drags the sea up and down every minute. Your citadel lives and dies by that tide. The gauge at the bottom forecasts it. Press Next.', cond: 'next' },
  { title: 'Raise a Quarry', body: 'Click an empty Upper Yard plot (the + markers on the clifftop) and build a Quarry. Stone builds everything.', cond: 'quarry' },
  { title: 'Mount a Wave Ballista', body: 'Click a Wall Battery mount on the seawall and build a Wave Ballista. Engines charge from the tide: each has a float band, and only fires fast when the sea sits near it. New builds auto-assign crew.', cond: 'engine' },
  { title: 'Work the Sluice', body: 'Click a sluice gate in the seawall (or press 1 or 2) to open it. Water rushes between sea and lagoon through turbines and makes power. The bigger the head difference, the more power. Beware: lagoon terraces flood!', cond: 'gate' },
  { title: 'Inspect Your Engine', body: 'Click your ballista. Its panel shows crew, upgrades, and the tide float band, which is highlighted on the sea. Upgrade or staff it from there.', cond: 'select' },
  { title: 'Call the First Wave', body: 'Ready? Press Space or click "Call Wave" to summon the first raiders. Click a ship to focus fire. Click floating crates to loot them. Good luck!', cond: 'wave' },
  { title: 'The Tide Is Yours', body: 'You know the essentials. Build workshops, keep the crew fed, and use abilities Q W E R. Open Help from the pause menu anytime. Survive 12 waves!', cond: 'next' },
];
