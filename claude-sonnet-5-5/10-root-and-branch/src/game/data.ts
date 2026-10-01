export const COLS = 30;
export const ROWS = 16;
export const CS = 32; // cell size
export const SKY = 128; // surface line y
export const W = COLS * CS;
export const H = SKY + ROWS * CS;

export type BuildingKind = 'cottage' | 'granary' | 'barn' | 'tower' | 'chapel' | 'wall' | 'guild' | 'keep';

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  w: number; // columns
  d: number; // foundation depth rows
  hp: number; // integrity
  height: number; // px above ground
  ward: number; // salt-ward radius in cells (0 = none)
  spawner: boolean;
  desc: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  cottage: { kind: 'cottage', name: 'Cottage', w: 2, d: 1, hp: 45, height: 44, ward: 0, spawner: false, desc: 'Humble. Shallow foundations.' },
  granary: { kind: 'granary', name: 'Granary', w: 2, d: 2, hp: 85, height: 56, ward: 0, spawner: false, desc: 'Stuffed with grain.' },
  barn: { kind: 'barn', name: 'Barn', w: 3, d: 2, hp: 120, height: 58, ward: 0, spawner: false, desc: 'Wide and sturdy.' },
  tower: { kind: 'tower', name: 'Watchtower', w: 2, d: 3, hp: 150, height: 104, ward: 3.2, spawner: false, desc: 'Salt-ward burns roots nearby.' },
  chapel: { kind: 'chapel', name: 'Chapel', w: 3, d: 3, hp: 170, height: 84, ward: 3, spawner: false, desc: 'Blessed salt ward.' },
  wall: { kind: 'wall', name: 'Fort Wall', w: 3, d: 2, hp: 200, height: 50, ward: 0, spawner: false, desc: 'Thick stone. Slow to erode.' },
  guild: { kind: 'guild', name: 'Exterminator Guild', w: 3, d: 2, hp: 130, height: 64, ward: 0, spawner: true, desc: 'Spawns exterminators. Priority target!' },
  keep: { kind: 'keep', name: 'The Keep', w: 4, d: 4, hp: 420, height: 120, ward: 4.2, spawner: false, desc: 'Seat of the crown. Fierce salt-ward.' },
};

export interface LevelDef {
  name: string;
  subtitle: string;
  buildings: BuildingKind[];
  rocks: number;
  humus: number;
  water: number;
  carcass: number;
  detect: number; // detection depth in rows
  spawnBase: number; // seconds between spawns per guild
  types: ('sprayer' | 'fumigator' | 'prober')[];
  duster: number; // seconds between crop dusters, 0 = none
  sky: [string, string];
  startNutrients: number;
}

export const LEVELS: LevelDef[] = [
  {
    name: 'The Hamlet',
    subtitle: 'A sleepy farming village. They suspect nothing... yet.',
    buildings: ['cottage', 'cottage', 'granary', 'cottage', 'guild'],
    rocks: 4,
    humus: 5,
    water: 2,
    carcass: 4,
    detect: 2,
    spawnBase: 24,
    types: ['sprayer'],
    duster: 0,
    sky: ['#2a3a5c', '#e8a272'],
    startNutrients: 80,
  },
  {
    name: 'Millbrook Village',
    subtitle: 'The villagers hired a professional. Fumigators arrive.',
    buildings: ['cottage', 'barn', 'tower', 'cottage', 'guild', 'barn', 'granary'],
    rocks: 6,
    humus: 6,
    water: 3,
    carcass: 4,
    detect: 3,
    spawnBase: 20,
    types: ['sprayer', 'sprayer', 'fumigator'],
    duster: 0,
    sky: ['#243a4e', '#d9b07a'],
    startNutrients: 90,
  },
  {
    name: 'St. Voss Abbey',
    subtitle: 'Holy salt, holy poison. Beware the crop duster.',
    buildings: ['cottage', 'chapel', 'guild', 'tower', 'barn', 'guild', 'cottage'],
    rocks: 8,
    humus: 6,
    water: 3,
    carcass: 5,
    detect: 4,
    spawnBase: 18,
    types: ['sprayer', 'fumigator', 'prober'],
    duster: 60,
    sky: ['#2e2a52', '#c98a8a'],
    startNutrients: 100,
  },
  {
    name: 'Fort Ironhold',
    subtitle: 'Walls, towers and a lot of paranoia.',
    buildings: ['wall', 'tower', 'guild', 'barn', 'tower', 'wall', 'guild', 'cottage'],
    rocks: 10,
    humus: 7,
    water: 4,
    carcass: 5,
    detect: 5,
    spawnBase: 16,
    types: ['sprayer', 'fumigator', 'prober', 'prober'],
    duster: 50,
    sky: ['#1f2b3a', '#b8896a'],
    startNutrients: 110,
  },
  {
    name: 'Crown City',
    subtitle: 'Topple the Keep. End the Extermination Edict.',
    buildings: ['guild', 'wall', 'tower', 'keep', 'chapel', 'tower', 'guild', 'cottage'],
    rocks: 12,
    humus: 8,
    water: 4,
    carcass: 6,
    detect: 6,
    spawnBase: 13,
    types: ['sprayer', 'fumigator', 'prober', 'prober', 'fumigator'],
    duster: 42,
    sky: ['#1a1830', '#a8607a'],
    startNutrients: 130,
  },
];

export type UpgradeId = 'vigor' | 'antibodies' | 'enzymes' | 'growth' | 'absorb' | 'spores' | 'seed' | 'heart';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  desc: string;
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'vigor', name: 'Hardy Hyphae', icon: '🧬', desc: '+20% root health per level.', costs: [25, 45, 70, 105] },
  { id: 'antibodies', name: 'Antibodies', icon: '🛡️', desc: '-12% poison & salt damage per level.', costs: [30, 55, 85, 125] },
  { id: 'enzymes', name: 'Potent Enzymes', icon: '⚗️', desc: '+25% foundation erosion per level.', costs: [30, 55, 85, 125] },
  { id: 'growth', name: 'Rapid Growth', icon: '🌱', desc: '-15% root growth time per level.', costs: [25, 50, 80] },
  { id: 'absorb', name: 'Efficient Absorption', icon: '💧', desc: '+20% nutrient income per level.', costs: [25, 45, 70, 100] },
  { id: 'spores', name: 'Toxic Spores', icon: '☣️', desc: '+30% mushroom spore damage per level.', costs: [30, 60, 95] },
  { id: 'seed', name: 'Rich Seed', icon: '🌰', desc: '+40 starting nutrients per level.', costs: [20, 40, 65] },
  { id: 'heart', name: 'Mother Heart', icon: '❤️', desc: '+50% heart health per level.', costs: [35, 65, 100] },
];

export type Upgrades = Record<UpgradeId, number>;

export function emptyUpgrades(): Upgrades {
  return { vigor: 0, antibodies: 0, enzymes: 0, growth: 0, absorb: 0, spores: 0, seed: 0, heart: 0 };
}

export type ToolId = 'grow' | 'thicken' | 'antidote' | 'acid' | 'fruit';

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  cost: number;
  key: string;
  desc: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'grow', name: 'Hypha', icon: '🕸️', cost: 5, key: '1', desc: 'Extend the network into an adjacent soil cell. Drag to paint a path. Foundation stone costs double.' },
  { id: 'thicken', name: 'Rhizomorph', icon: '🪢', cost: 18, key: '2', desc: 'Thicken a hypha: 3x health, 50% poison resistance, erodes foundations twice as fast.' },
  { id: 'antidote', name: 'Antidote Gland', icon: '🧪', cost: 35, key: '3', desc: 'Neutralises poison in a radius and halves salt-ward damage.' },
  { id: 'acid', name: 'Acid Cyst', icon: '🫧', cost: 30, key: '4', desc: 'Dissolves adjacent bedrock and speeds up foundation erosion nearby.' },
  { id: 'fruit', name: 'Fruiting Body', icon: '🍄', cost: 25, key: '5', desc: 'Surface row only. Bait that releases toxic spores at exterminators. Exterminators hunt these first.' },
];

export const TOOL_COST: Record<ToolId, number> = { grow: 5, thicken: 18, antidote: 35, acid: 30, fruit: 25 };

export function upgradeCost(u: UpgradeDef, level: number): number | null {
  return level >= u.costs.length ? null : u.costs[level];
}
