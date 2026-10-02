export type ItemId =
  | 'ore_fe'
  | 'ore_cu'
  | 'ice'
  | 'plate'
  | 'ingot'
  | 'cell'
  | 'frame'
  | 'circuit'
  | 'drive'
  | 'aegis';

export const ITEM_IDS: ItemId[] = ['ore_fe', 'ore_cu', 'ice', 'plate', 'ingot', 'cell', 'frame', 'circuit', 'drive', 'aegis'];

export interface ItemDef {
  name: string;
  color: string;
  value: number;
  rp: number;
  shape: 0 | 1 | 2 | 3;
  tier: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  ore_fe: { name: 'Iron Ore', color: '#c8795c', value: 2, rp: 0, shape: 0, tier: 0 },
  ore_cu: { name: 'Copper Ore', color: '#36d1b0', value: 2, rp: 0, shape: 0, tier: 0 },
  ice: { name: 'Comet Ice', color: '#9fe8ff', value: 2, rp: 0, shape: 0, tier: 0 },
  plate: { name: 'Iron Plate', color: '#d5dde8', value: 7, rp: 1, shape: 1, tier: 1 },
  ingot: { name: 'Copper Ingot', color: '#ff9a4d', value: 7, rp: 1, shape: 1, tier: 1 },
  cell: { name: 'Fuel Cell', color: '#6dff9a', value: 9, rp: 2, shape: 1, tier: 1 },
  frame: { name: 'Hull Frame', color: '#8aa0ff', value: 20, rp: 4, shape: 2, tier: 2 },
  circuit: { name: 'Circuit', color: '#ffd84a', value: 27, rp: 5, shape: 2, tier: 2 },
  drive: { name: 'Drive Core', color: '#ff5ad2', value: 115, rp: 20, shape: 3, tier: 3 },
  aegis: { name: 'Aegis Plate', color: '#5ac8ff', value: 85, rp: 15, shape: 3, tier: 3 },
};

export type BKind =
  | 'hub'
  | 'conveyor'
  | 'rail'
  | 'junction'
  | 'splitter'
  | 'dock'
  | 'stabilizer'
  | 'extractor'
  | 'smelter'
  | 'centrifuge'
  | 'electrolyzer'
  | 'assembler'
  | 'fabricator'
  | 'lab'
  | 'solar'
  | 'dynamo'
  | 'reactor'
  | 'battery'
  | 'turret'
  | 'laser'
  | 'shield';

export type Cat = 'logistics' | 'production' | 'power' | 'defense';

export interface BDef {
  kind: BKind;
  name: string;
  cat: Cat;
  cost: number;
  w: number;
  h: number;
  hp: number;
  power: number;
  emoji: string;
  color: string;
  desc: string;
  tech?: string;
}

export const BUILDINGS: Record<BKind, BDef> = {
  hub: { kind: 'hub', name: 'Ring Core', cat: 'logistics', cost: 0, w: 3, h: 3, hp: 700, power: 0, emoji: '🛰️', color: '#7df9ff', desc: 'The heart of the ring. Buys any item. Protect it!' },
  conveyor: { kind: 'conveyor', name: 'Conveyor', cat: 'logistics', cost: 1, w: 1, h: 1, hp: 20, power: 0, emoji: '➡️', color: '#8da2b8', desc: 'Moves items. Coriolis drift pushes items sideways — long runs leak!' },
  rail: { kind: 'rail', name: 'Rail Guide', cat: 'logistics', cost: 4, w: 1, h: 1, hp: 30, power: 0, emoji: '⏩', color: '#7de3ff', desc: 'Magnetic rails: faster and immune to drift.', tech: 'rails' },
  junction: { kind: 'junction', name: 'Junction', cat: 'logistics', cost: 6, w: 1, h: 1, hp: 30, power: 0, emoji: '✚', color: '#c4b5fd', desc: 'Lets two belts cross. Items pass straight through.' },
  splitter: { kind: 'splitter', name: 'Splitter', cat: 'logistics', cost: 8, w: 1, h: 1, hp: 30, power: 0, emoji: '⑂', color: '#fbbf24', desc: 'Splits items forward/left/right in rotation.' },
  dock: { kind: 'dock', name: 'Export Dock', cat: 'logistics', cost: 30, w: 1, h: 1, hp: 60, power: 0, emoji: '📦', color: '#fde68a', desc: 'Sells any item to passing cargo shuttles at market price.' },
  stabilizer: { kind: 'stabilizer', name: 'Gyro Stabilizer', cat: 'logistics', cost: 110, w: 1, h: 1, hp: 70, power: 5, emoji: '🌀', color: '#5eead4', desc: 'Cuts Coriolis drift by up to 75% within 4 tiles.', tech: 'gyro' },
  extractor: { kind: 'extractor', name: 'Extractor', cat: 'production', cost: 40, w: 1, h: 1, hp: 60, power: 4, emoji: '⛏️', color: '#fb923c', desc: 'Place on an ore or ice deposit to mine raw resources.' },
  smelter: { kind: 'smelter', name: 'Smelter', cat: 'production', cost: 60, w: 1, h: 1, hp: 80, power: 6, emoji: '🔥', color: '#f87171', desc: 'Iron ore → plate, copper ore → ingot.' },
  centrifuge: { kind: 'centrifuge', name: 'Centrifuge Smelter', cat: 'production', cost: 160, w: 1, h: 1, hp: 90, power: 10, emoji: '🌪️', color: '#fb7185', desc: 'Smelts like a Smelter, but speed scales with ring spin.', tech: 'centrifuge' },
  electrolyzer: { kind: 'electrolyzer', name: 'Electrolyzer', cat: 'production', cost: 100, w: 1, h: 1, hp: 80, power: 8, emoji: '🧪', color: '#4ade80', desc: '2 comet ice → 1 fuel cell.', tech: 'cells' },
  assembler: { kind: 'assembler', name: 'Assembler', cat: 'production', cost: 120, w: 1, h: 1, hp: 90, power: 8, emoji: '🏭', color: '#60a5fa', desc: 'Makes frames and circuits. Click it to choose a recipe.', tech: 'assembly' },
  fabricator: { kind: 'fabricator', name: 'Fabricator', cat: 'production', cost: 350, w: 1, h: 1, hp: 120, power: 14, emoji: '🧬', color: '#e879f9', desc: 'Tier-3 goods: Drive Cores and Aegis Plates.', tech: 'fab' },
  lab: { kind: 'lab', name: 'Research Lab', cat: 'production', cost: 90, w: 1, h: 1, hp: 70, power: 6, emoji: '🔬', color: '#a78bfa', desc: 'Consumes goods and converts them into research points.' },
  solar: { kind: 'solar', name: 'Solar Array', cat: 'power', cost: 50, w: 1, h: 1, hp: 40, power: 0, emoji: '☀️', color: '#facc15', desc: '12 kW at noon, nothing at night. The ring spin sets the day length.' },
  dynamo: { kind: 'dynamo', name: 'Spin Dynamo', cat: 'power', cost: 70, w: 1, h: 1, hp: 60, power: 0, emoji: '⚙️', color: '#38bdf8', desc: 'Steady 8 kW × ring spin. Faster spin = more power (and drift).' },
  reactor: { kind: 'reactor', name: 'Fuel Reactor', cat: 'power', cost: 250, w: 1, h: 1, hp: 110, power: 0, emoji: '☢️', color: '#a3e635', desc: '40 kW while fed fuel cells (1 per 6s).', tech: 'reactor' },
  battery: { kind: 'battery', name: 'Battery', cat: 'power', cost: 60, w: 1, h: 1, hp: 50, power: 0, emoji: '🔋', color: '#4ade80', desc: 'Stores 300 kW·s of surplus power for the night.', tech: 'battery' },
  turret: { kind: 'turret', name: 'Gun Turret', cat: 'defense', cost: 80, w: 1, h: 1, hp: 90, power: 0, emoji: '🔫', color: '#f472b6', desc: 'Belt-fed with plates (or circuits for heavy rounds). Bullets curve with spin!' },
  laser: { kind: 'laser', name: 'Lance Turret', cat: 'defense', cost: 220, w: 1, h: 1, hp: 100, power: 12, emoji: '🔆', color: '#fb7185', desc: 'Ammo-free beam. Drains power while firing. Never misses.', tech: 'lance' },
  shield: { kind: 'shield', name: 'Aegis Dome', cat: 'defense', cost: 300, w: 1, h: 1, hp: 120, power: 15, emoji: '🛡️', color: '#67e8f9', desc: 'Projects a shield (radius 5.5) that soaks incoming fire.', tech: 'aegis' },
};

export const BUILD_ORDER: BKind[] = [
  'conveyor', 'rail', 'junction', 'splitter', 'dock', 'stabilizer',
  'extractor', 'smelter', 'centrifuge', 'electrolyzer', 'assembler', 'fabricator', 'lab',
  'solar', 'dynamo', 'reactor', 'battery',
  'turret', 'laser', 'shield',
];

export const CATS: { id: Cat; name: string; icon: string }[] = [
  { id: 'logistics', name: 'Logistics', icon: '🔀' },
  { id: 'production', name: 'Industry', icon: '🏭' },
  { id: 'power', name: 'Power', icon: '⚡' },
  { id: 'defense', name: 'Defense', icon: '🛡️' },
];

export interface Recipe {
  id: string;
  name: string;
  inputs: Partial<Record<ItemId, number>>;
  output: ItemId;
  outQty: number;
  time: number;
}

export const RECIPES: Record<string, Recipe> = {
  smelt_fe: { id: 'smelt_fe', name: 'Iron Plate', inputs: { ore_fe: 1 }, output: 'plate', outQty: 1, time: 1.6 },
  smelt_cu: { id: 'smelt_cu', name: 'Copper Ingot', inputs: { ore_cu: 1 }, output: 'ingot', outQty: 1, time: 1.6 },
  crack: { id: 'crack', name: 'Fuel Cell', inputs: { ice: 2 }, output: 'cell', outQty: 1, time: 2.2 },
  frame: { id: 'frame', name: 'Hull Frame', inputs: { plate: 2 }, output: 'frame', outQty: 1, time: 3 },
  circuit: { id: 'circuit', name: 'Circuit', inputs: { plate: 1, ingot: 2 }, output: 'circuit', outQty: 1, time: 3.5 },
  drive: { id: 'drive', name: 'Drive Core', inputs: { circuit: 2, frame: 1, cell: 1 }, output: 'drive', outQty: 1, time: 6 },
  aegis: { id: 'aegis', name: 'Aegis Plate', inputs: { frame: 2, circuit: 1 }, output: 'aegis', outQty: 1, time: 5 },
};

export const MACHINE_RECIPES: Partial<Record<BKind, string[]>> = {
  smelter: ['smelt_fe', 'smelt_cu'],
  centrifuge: ['smelt_fe', 'smelt_cu'],
  electrolyzer: ['crack'],
  assembler: ['frame', 'circuit'],
  fabricator: ['drive', 'aegis'],
};

export const AUTO_RECIPE: BKind[] = ['smelter', 'centrifuge', 'electrolyzer'];

export interface Tech {
  id: string;
  name: string;
  cost: number;
  desc: string;
  req: string[];
  tier: number;
  icon: string;
}

export const TECHS: Tech[] = [
  { id: 'assembly', name: 'Assembly Lines', cost: 20, desc: 'Unlocks the Assembler (frames, circuits).', req: [], tier: 0, icon: '🏭' },
  { id: 'rails', name: 'Rail Guides', cost: 25, desc: 'Unlocks drift-immune Rail Guides.', req: [], tier: 0, icon: '⏩' },
  { id: 'cells', name: 'Cell Cracking', cost: 30, desc: 'Unlocks the Electrolyzer (ice → fuel cells).', req: [], tier: 0, icon: '🧪' },
  { id: 'battery', name: 'Accumulators', cost: 30, desc: 'Unlocks Batteries to ride out the night.', req: [], tier: 0, icon: '🔋' },
  { id: 'trade', name: 'Trade Routes', cost: 40, desc: '+15% sell prices at all docks.', req: [], tier: 0, icon: '💱' },
  { id: 'gyro', name: 'Gyro Stabilizers', cost: 60, desc: 'Unlocks the Gyro Stabilizer (anti-drift field).', req: ['rails'], tier: 1, icon: '🌀' },
  { id: 'centrifuge', name: 'Centrifugal Smelting', cost: 60, desc: 'Unlocks the spin-powered Centrifuge Smelter.', req: ['assembly'], tier: 1, icon: '🌪️' },
  { id: 'reactor', name: 'Fuel Reactors', cost: 80, desc: 'Unlocks the 40 kW Fuel Reactor.', req: ['cells'], tier: 1, icon: '☢️' },
  { id: 'ballistics', name: 'Coriolis Ballistics', cost: 70, desc: 'Turrets fully compensate for bullet curvature.', req: ['rails'], tier: 1, icon: '🎯' },
  { id: 'overclock', name: 'Overclocking', cost: 120, desc: 'All machines run 25% faster.', req: ['assembly'], tier: 1, icon: '⚡' },
  { id: 'lance', name: 'Photon Lances', cost: 90, desc: 'Unlocks the ammo-free Lance Turret.', req: ['battery'], tier: 2, icon: '🔆' },
  { id: 'aegis', name: 'Aegis Field', cost: 110, desc: 'Unlocks the Aegis Dome shield.', req: ['battery', 'assembly'], tier: 2, icon: '🛡️' },
  { id: 'fab', name: 'Fabrication', cost: 140, desc: 'Unlocks the Fabricator (Drive Cores, Aegis Plates).', req: ['assembly', 'cells'], tier: 2, icon: '🧬' },
  { id: 'nanite', name: 'Nanite Repair', cost: 100, desc: 'Buildings slowly self-repair. Core heals faster.', req: ['overclock'], tier: 2, icon: '🧫' },
];

export type EnemyType = 'skiff' | 'raider' | 'looter' | 'bomber' | 'frigate' | 'dread';

export interface EnemyDef {
  name: string;
  hp: number;
  shield: number;
  speed: number;
  range: number;
  dmg: number;
  cd: number;
  r: number;
  bounty: number;
  cost: number;
  from: number;
  color: string;
  desc: string;
  emoji: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  skiff: { name: 'Skiff', hp: 34, shield: 0, speed: 3.0, range: 3.2, dmg: 4, cd: 0.9, r: 0.35, bounty: 6, cost: 1, from: 1, color: '#fb7185', desc: 'Fast and fragile. Peppers the nearest structure.', emoji: '🛸' },
  raider: { name: 'Raider', hp: 100, shield: 0, speed: 1.7, range: 5, dmg: 9, cd: 1.2, r: 0.5, bounty: 14, cost: 2, from: 2, color: '#f97316', desc: 'Hunts your turrets and shields first.', emoji: '🚀' },
  looter: { name: 'Looter Drone', hp: 60, shield: 0, speed: 2.4, range: 0, dmg: 0, cd: 0, r: 0.4, bounty: 12, cost: 2, from: 3, color: '#facc15', desc: 'Steals items off belts and credits from docks.', emoji: '🪝' },
  bomber: { name: 'Bomber', hp: 150, shield: 0, speed: 1.4, range: 0, dmg: 75, cd: 0, r: 0.55, bounty: 20, cost: 3, from: 4, color: '#c084fc', desc: 'Kamikaze run at your power plants.', emoji: '💣' },
  frigate: { name: 'Frigate', hp: 280, shield: 140, speed: 0.95, range: 7.5, dmg: 16, cd: 1.5, r: 0.85, bounty: 45, cost: 6, from: 5, color: '#38bdf8', desc: 'Shielded gunship with long range artillery.', emoji: '🚢' },
  dread: { name: 'Dreadnought', hp: 2800, shield: 450, speed: 0.5, range: 9.5, dmg: 28, cd: 1.3, r: 1.7, bounty: 400, cost: 0, from: 99, color: '#ef4444', desc: 'Boss. Spawns skiffs, fires EMP pulses and radial barrages.', emoji: '👾' },
};

export type DiffId = 'cadet' | 'engineer' | 'foreman';

export interface DiffDef {
  id: DiffId;
  name: string;
  desc: string;
  hp: number;
  count: number;
  credits: number;
  interval: number;
  lp: number;
}

export const DIFFS: DiffDef[] = [
  { id: 'cadet', name: 'Cadet', desc: 'Gentler raids, bigger purse, longer breaks.', hp: 0.75, count: 0.8, credits: 1.3, interval: 1.25, lp: 0.7 },
  { id: 'engineer', name: 'Engineer', desc: 'The intended experience.', hp: 1, count: 1, credits: 1, interval: 1, lp: 1 },
  { id: 'foreman', name: 'Foreman', desc: 'Tougher, larger raids on a tight budget.', hp: 1.35, count: 1.3, credits: 0.8, interval: 0.85, lp: 1.6 },
];

export interface ModDef {
  id: 'storm' | 'frenzy' | 'brown';
  name: string;
  desc: string;
  icon: string;
}

export const MODS: ModDef[] = [
  { id: 'storm', name: 'Storm Spin', desc: 'Coriolis drift is 60% stronger.', icon: '🌀' },
  { id: 'frenzy', name: 'Pirate Frenzy', desc: 'Raids arrive 25% sooner and pirates fly faster.', icon: '🏴‍☠️' },
  { id: 'brown', name: 'Thin Grid', desc: 'All power generation is cut by 25%.', icon: '🔌' },
];

export interface LegacyDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  base: number;
  icon: string;
}

export const LEGACY: LegacyDef[] = [
  { id: 'capital', name: 'Seed Capital', desc: '+120 starting credits per level.', max: 5, base: 8, icon: '💰' },
  { id: 'hull', name: 'Reinforced Core', desc: '+20% Ring Core hull per level.', max: 5, base: 10, icon: '🛰️' },
  { id: 'gyro', name: 'Gyro Tuning', desc: '-8% Coriolis drift per level.', max: 5, base: 10, icon: '🌀' },
  { id: 'ordnance', name: 'Ordnance Doctrine', desc: '+12% turret & lance damage per level.', max: 5, base: 12, icon: '🎯' },
  { id: 'dynamo', name: 'Dynamo Windings', desc: '+10% power generation per level.', max: 5, base: 12, icon: '⚙️' },
  { id: 'study', name: 'Quick Study', desc: '+12% research from labs per level.', max: 5, base: 8, icon: '🔬' },
  { id: 'broker', name: 'Broker Network', desc: '+10% contract rewards per level.', max: 5, base: 8, icon: '🤝' },
  { id: 'head', name: 'Head Start', desc: 'Begin each run with Rail Guides researched (lvl 1) and Assembly (lvl 2).', max: 2, base: 20, icon: '🚀' },
];

export const MAP_W = 48;
export const MAP_H = 30;
export const WIN_WAVE = 10;
