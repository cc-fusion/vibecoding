export const CELL = 20;
export const MW = 120;
export const MH = 80;

export type CasteId = 'worker' | 'soldier' | 'nurse' | 'scout' | 'spitter';
export const CASTES: CasteId[] = ['worker', 'soldier', 'nurse', 'scout', 'spitter'];

export const CASTE_INFO: Record<CasteId, { name: string; icon: string; cost: number; color: string; desc: string }> = {
  worker: { name: 'Worker', icon: '🐜', cost: 8, color: '#f4c95d', desc: 'Follows green forage trails, hauls food, digs tunnels. Flees danger.' },
  soldier: { name: 'Soldier', icon: '🛡️', cost: 16, color: '#e4572e', desc: 'Follows red war trails, guards the nest, strong melee fighter.' },
  nurse: { name: 'Nurse', icon: '💗', cost: 10, color: '#f7a8c4', desc: 'Speeds up brood, heals the wounded and tends fungus gardens.' },
  scout: { name: 'Scout', icon: '🔭', cost: 12, color: '#5ad1c8', desc: 'Fast explorer. Clears fog and marks found food with a faint trail.' },
  spitter: { name: 'Spitter', icon: '💦', cost: 22, color: '#9be564', desc: 'Ranged acid that pierces armor. Needs the Acid Glands evolution.' },
};

export type ChamberType = 'nursery' | 'granary' | 'barracks' | 'fungus' | 'sentry';
export const CHAMBER_TYPES: ChamberType[] = ['nursery', 'granary', 'barracks', 'fungus', 'sentry'];
export const CHAMBER_INFO: Record<ChamberType, { name: string; icon: string; cost: number; color: string; desc: string; tech?: string }> = {
  nursery: { name: 'Nursery', icon: '🥚', cost: 60, color: '#f2e2b3', desc: '+6 brood slots and faster hatching. Buffers cold snaps.' },
  granary: { name: 'Granary', icon: '🌾', cost: 50, color: '#e0b84a', desc: '+250 food capacity AND a closer drop-off point for returning workers.' },
  barracks: { name: 'Barracks', icon: '⚔️', cost: 70, color: '#c9533d', desc: '+16 population cap. Heals soldiers resting nearby.' },
  fungus: { name: 'Fungus Garden', icon: '🍄', cost: 90, color: '#b58bd9', desc: 'Grows food passively. Loves rain, hates heat. Tended by nurses.', tech: 'fungus' },
  sentry: { name: 'Sentry Post', icon: '🗼', cost: 80, color: '#7fb4d9', desc: 'Auto-fires acid at intruders (uses food). Soldiers nearby hit harder.', tech: 'sentry' },
};

export type WeatherId = 'clear' | 'rain' | 'heat' | 'cold' | 'storm';
export const WEATHER_INFO: Record<WeatherId, { name: string; icon: string; desc: string }> = {
  clear: { name: 'Fair', icon: '☀️', desc: 'Calm skies. Trails fade slowly.' },
  rain: { name: 'Rain', icon: '🌧️', desc: 'Washes surface trails away, slows ants outside. Fungus thrives. Wasps stay grounded.' },
  heat: { name: 'Heatwave', icon: '🔥', desc: 'Surface ants dehydrate. Fungus withers. Trails evaporate faster.' },
  cold: { name: 'Cold Snap', icon: '❄️', desc: 'Surface ants slow down, brood develops slower.' },
  storm: { name: 'Thunderstorm', icon: '⛈️', desc: 'Heavy rain, gusting wind and lightning strikes on the surface!' },
};

export interface TechDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  max: number;
  costs: number[];
  branch: 'Combat' | 'Colony' | 'Pheromone' | 'Unlocks';
}

export const TECHS: TechDef[] = [
  { id: 'mandibles', name: 'Razor Mandibles', icon: '🦷', desc: '+12% ant damage per level.', max: 3, costs: [3, 5, 8], branch: 'Combat' },
  { id: 'chitin', name: 'Thick Chitin', icon: '🛡️', desc: '+12% ant health per level.', max: 3, costs: [3, 5, 8], branch: 'Combat' },
  { id: 'legs', name: 'Swift Legs', icon: '💨', desc: '+6% ant speed per level.', max: 3, costs: [3, 5, 7], branch: 'Combat' },
  { id: 'acid', name: 'Acid Glands', icon: '💦', desc: 'Unlocks the Spitter caste: ranged, armor-piercing.', max: 1, costs: [8], branch: 'Unlocks' },
  { id: 'fungus', name: 'Fungus Farming', icon: '🍄', desc: 'Unlocks the Fungus Garden chamber.', max: 1, costs: [6], branch: 'Unlocks' },
  { id: 'sentry', name: 'Sentry Instinct', icon: '🗼', desc: 'Unlocks the Sentry Post chamber.', max: 1, costs: [7], branch: 'Unlocks' },
  { id: 'bearers', name: 'Strong Bearers', icon: '🍞', desc: '+1 food carried per trip per level.', max: 2, costs: [4, 7], branch: 'Colony' },
  { id: 'diggers', name: 'Tireless Diggers', icon: '⛏️', desc: '+25% dig speed per level.', max: 3, costs: [3, 5, 7], branch: 'Colony' },
  { id: 'fertile', name: 'Fertile Queen', icon: '👑', desc: '+12% laying speed and +15% queen health per level.', max: 3, costs: [4, 6, 9], branch: 'Colony' },
  { id: 'reserves', name: 'Honeypot Reserves', icon: '🍯', desc: '+40 starting food per level.', max: 3, costs: [2, 4, 6], branch: 'Colony' },
  { id: 'weather', name: 'Weatherproof Shell', icon: '☂️', desc: 'Weather penalties reduced by 35% per level.', max: 2, costs: [4, 7], branch: 'Colony' },
  { id: 'mastery', name: 'Pheromone Mastery', icon: '🧪', desc: 'Trails last longer, gland energy is larger and recovers faster.', max: 3, costs: [3, 5, 7], branch: 'Pheromone' },
  { id: 'sonar', name: 'Scout Antennae', icon: '📡', desc: 'Scouts see farther and run faster.', max: 2, costs: [3, 6], branch: 'Pheromone' },
  { id: 'jelly', name: 'Royal Jelly Glands', icon: '✨', desc: '+15% Royal Jelly from every expedition.', max: 2, costs: [5, 9], branch: 'Pheromone' },
];

export interface DifficultyDef {
  id: string;
  name: string;
  desc: string;
  enemyHp: number;
  enemyDmg: number;
  spawn: number;
  upkeep: number;
  jelly: number;
  rivalRate: number;
  foodBonus: number;
}

export const DIFFS: DifficultyDef[] = [
  { id: 'gentle', name: 'Gentle Breeze', desc: 'Weaker enemies, lower upkeep, slower threats.', enemyHp: 0.75, enemyDmg: 0.75, spawn: 0.7, upkeep: 0.8, jelly: 0.8, rivalRate: 0.7, foodBonus: 60 },
  { id: 'normal', name: 'Colony Standard', desc: 'The intended experience.', enemyHp: 1, enemyDmg: 1, spawn: 1, upkeep: 1, jelly: 1, rivalRate: 1, foodBonus: 0 },
  { id: 'brutal', name: 'Brutal Winter', desc: 'Tougher enemies, hungrier ants, relentless raids.', enemyHp: 1.35, enemyDmg: 1.3, spawn: 1.4, upkeep: 1.2, jelly: 1.6, rivalRate: 1.4, foodBonus: -30 },
];

export interface ModDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  jelly: number;
}

export const MODS: ModDef[] = [
  { id: 'gale', name: 'Perpetual Gale', icon: '⛈️', desc: 'Weather skews heavily toward rain and thunderstorms.', jelly: 0.25 },
  { id: 'famine', name: 'Famine', icon: '🥀', desc: '40% less food in the world, upkeep +30%.', jelly: 0.25 },
  { id: 'fragile', name: 'Fragile Brood', icon: '🥚', desc: 'Your ants have 25% less health.', jelly: 0.2 },
  { id: 'surge', name: 'Swarm Surge', icon: '🦂', desc: 'Threat events arrive 50% faster.', jelly: 0.3 },
  { id: 'blind', name: 'Deep Dark', icon: '🌑', desc: 'Your vision range is cut by 40%.', jelly: 0.15 },
];

export type WildKind = 'beetle' | 'spider' | 'wasp' | 'centipede' | 'antlion' | 'anteater';

export interface RivalDef {
  name: string;
  color: string;
  x: number;
  y: number;
  power: number;
  cap: number;
  raidEvery: number;
}

export interface ObjectiveDef {
  type: 'grow' | 'conquer' | 'survive' | 'boss' | 'endless';
  pop?: number;
  food?: number;
  time?: number;
}

export interface LevelDef {
  id: number;
  name: string;
  icon: string;
  blurb: string;
  seed: number;
  nest: { x: number; y: number };
  objective: ObjectiveDef;
  rivals: RivalDef[];
  foodPatches: number;
  caches: number;
  antlions: number;
  rocks: number;
  meadows: number;
  enemies: WildKind[];
  weather: Partial<Record<WeatherId, number>>;
  startFood: number;
  startAnts: number;
  parTime: number;
  maxLost: number;
  jelly: number;
  firstThreat: number;
  spawnRate: number;
  bossAt?: number;
  mapPos: { x: number; y: number };
}

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'Dewdrop Meadow', icon: '🌼', seed: 11,
    blurb: 'A gentle clearing where a young colony takes root. Learn the trails, dig your first chambers and grow strong.',
    nest: { x: 16, y: 62 },
    objective: { type: 'grow', pop: 30, food: 200 },
    rivals: [], foodPatches: 6, caches: 3, antlions: 1, rocks: 8, meadows: 5,
    enemies: ['beetle', 'spider'], weather: { clear: 5, rain: 2, heat: 1 },
    startFood: 120, startAnts: 12, parTime: 540, maxLost: 40, jelly: 6, firstThreat: 80, spawnRate: 0.8,
    mapPos: { x: 8, y: 72 },
  },
  {
    id: 2, name: 'Bramble Hollow', icon: '🌿', seed: 23,
    blurb: 'The Black Ant clan guards the thorn thickets. Break into their nest and end their queen.',
    nest: { x: 14, y: 14 },
    objective: { type: 'conquer' },
    rivals: [{ name: 'Black Ants', color: '#2d2d3d', x: 102, y: 64, power: 0.9, cap: 22, raidEvery: 120 }],
    foodPatches: 7, caches: 4, antlions: 2, rocks: 12, meadows: 6,
    enemies: ['beetle', 'spider', 'wasp'], weather: { clear: 4, rain: 3, heat: 2, cold: 1 },
    startFood: 130, startAnts: 14, parTime: 780, maxLost: 70, jelly: 8, firstThreat: 70, spawnRate: 0.9,
    mapPos: { x: 24, y: 40 },
  },
  {
    id: 3, name: 'Stormbreak Ridge', icon: '⛈️', seed: 37,
    blurb: 'Lightning and wasps ravage the ridge. Hold the colony together until the storms pass — 7 minutes.',
    nest: { x: 18, y: 40 },
    objective: { type: 'survive', time: 420 },
    rivals: [], foodPatches: 7, caches: 4, antlions: 4, rocks: 14, meadows: 6,
    enemies: ['wasp', 'spider', 'beetle'], weather: { clear: 2, rain: 3, storm: 4, cold: 2 },
    startFood: 140, startAnts: 14, parTime: 420, maxLost: 80, jelly: 9, firstThreat: 50, spawnRate: 1.1,
    mapPos: { x: 42, y: 70 },
  },
  {
    id: 4, name: 'Fire Ant Frontier', icon: '🔥', seed: 51,
    blurb: 'Two aggressive clans fight over the scorched plains. Crush both before their raids crush you.',
    nest: { x: 16, y: 40 },
    objective: { type: 'conquer' },
    rivals: [
      { name: 'Fire Ants', color: '#d4421e', x: 100, y: 62, power: 1.0, cap: 24, raidEvery: 100 },
      { name: 'Rust Ants', color: '#9a5b2b', x: 98, y: 14, power: 0.95, cap: 22, raidEvery: 110 },
    ],
    foodPatches: 8, caches: 4, antlions: 3, rocks: 14, meadows: 7,
    enemies: ['beetle', 'spider', 'wasp'], weather: { clear: 3, heat: 4, rain: 2, storm: 1 },
    startFood: 150, startAnts: 16, parTime: 1000, maxLost: 100, jelly: 11, firstThreat: 60, spawnRate: 1.0,
    mapPos: { x: 60, y: 36 },
  },
  {
    id: 5, name: 'Centipede Warrens', icon: '🐛', seed: 67,
    blurb: 'Tunnelling centipedes burrow straight for your queen. Fortify, then storm the Marauder nest.',
    nest: { x: 14, y: 64 },
    objective: { type: 'conquer' },
    rivals: [{ name: 'Marauder Ants', color: '#6b2fa0', x: 100, y: 22, power: 1.2, cap: 28, raidEvery: 85 }],
    foodPatches: 7, caches: 5, antlions: 3, rocks: 16, meadows: 6,
    enemies: ['centipede', 'beetle', 'spider', 'wasp'], weather: { clear: 3, rain: 2, cold: 2, storm: 2 },
    startFood: 160, startAnts: 16, parTime: 1100, maxLost: 110, jelly: 12, firstThreat: 55, spawnRate: 1.1,
    mapPos: { x: 76, y: 66 },
  },
  {
    id: 6, name: "The Anteater's Reign", icon: '🦡', seed: 89,
    blurb: 'A colossal anteater is tearing the earth open. Survive its onslaught and bring the beast down.',
    nest: { x: 18, y: 50 },
    objective: { type: 'boss' },
    rivals: [], foodPatches: 8, caches: 5, antlions: 3, rocks: 12, meadows: 7,
    enemies: ['beetle', 'spider', 'wasp', 'centipede'], weather: { clear: 3, rain: 2, heat: 1, cold: 1, storm: 2 },
    startFood: 170, startAnts: 18, parTime: 700, maxLost: 140, jelly: 18, firstThreat: 45, spawnRate: 1.0, bossAt: 200,
    mapPos: { x: 92, y: 34 },
  },
  {
    id: 7, name: 'Evergreen Siege', icon: '♾️', seed: 101,
    blurb: 'Endless escalation. How long can your dynasty hold? An Anteater arrives at 10 minutes. Earn jelly for every minute survived.',
    nest: { x: 60, y: 42 },
    objective: { type: 'endless' },
    rivals: [], foodPatches: 9, caches: 5, antlions: 4, rocks: 16, meadows: 7,
    enemies: ['beetle', 'spider', 'wasp', 'centipede'], weather: { clear: 3, rain: 2, heat: 2, cold: 2, storm: 2 },
    startFood: 180, startAnts: 18, parTime: 900, maxLost: 9999, jelly: 8, firstThreat: 45, spawnRate: 1.2, bossAt: 600,
    mapPos: { x: 92, y: 74 },
  },
];

export interface SettingsData {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: number;
  particles: number;
}

export interface SaveData {
  jelly: number;
  tech: Record<string, number>;
  levels: Record<number, { stars: number; best: number }>;
  settings: SettingsData;
  tutorialDone: boolean;
  lifetime: { games: number; wins: number; kills: number; food: number; ants: number };
  lastDiff: string;
  lastMods: string[];
  endlessBest: number;
}

const KEY = 'formica-swarm-colony-v1';
let memSave: SaveData | null = null;

export function defaultSave(): SaveData {
  return {
    jelly: 0,
    tech: {},
    levels: {},
    settings: { master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: 1, particles: 1 },
    tutorialDone: false,
    lifetime: { games: 0, wins: 0, kills: 0, food: 0, ants: 0 },
    lastDiff: 'normal',
    lastMods: [],
    endlessBest: 0,
  };
}

export function getSave(): SaveData {
  if (memSave) return memSave;
  const base = defaultSave();
  let s = base;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      s = {
        ...base,
        ...p,
        settings: { ...base.settings, ...(p.settings || {}) },
        tech: { ...(p.tech || {}) },
        levels: { ...(p.levels || {}) },
        lifetime: { ...base.lifetime, ...(p.lifetime || {}) },
        lastMods: Array.isArray(p.lastMods) ? p.lastMods : [],
      };
    }
  } catch {
    s = base;
  }
  memSave = s;
  return s;
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSave()));
  } catch {
    /* storage unavailable: progress stays in memory for this session */
  }
}

export function resetSave(): void {
  memSave = defaultSave();
  persist();
}

export function techLevel(id: string): number {
  return getSave().tech[id] || 0;
}

export function levelUnlocked(id: number): boolean {
  if (id === 1) return true;
  if (id === 7) return !!getSave().levels[3];
  return !!getSave().levels[id - 1];
}

export function fmtTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
