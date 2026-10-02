// Static game data for Graveyard Shift Necropolis

export const TILE = 40;
export const COLS = 28;
export const ROWS = 18;
export const WW = COLS * TILE;
export const WH = ROWS * TILE;
export const DAY_LEN = 80; // seconds per full day/night cycle at 1x

export type ResKey = 'corpses' | 'bones' | 'souls' | 'ecto' | 'coin';
export type Res = Record<ResKey, number>;
export const RES_KEYS: ResKey[] = ['corpses', 'bones', 'souls', 'ecto', 'coin'];
export const RES_META: Record<ResKey, { name: string; icon: string; color: string }> = {
  corpses: { name: 'Corpses', icon: '⚰️', color: '#b9a37a' },
  bones: { name: 'Bones', icon: '🦴', color: '#e8e2cf' },
  souls: { name: 'Souls', icon: '👻', color: '#7fe3d4' },
  ecto: { name: 'Ectoplasm', icon: '🧪', color: '#a6f06b' },
  coin: { name: 'Coin', icon: '🪙', color: '#f2c14e' },
};
export const emptyRes = (): Res => ({ corpses: 0, bones: 0, souls: 0, ecto: 0, coin: 0 });

export type Shift = 'day' | 'night' | 'round';
export const SHIFT_META: Record<Shift, { name: string; icon: string; desc: string }> = {
  day: { name: 'Dayside', icon: '☀️', desc: 'Works dawn & daytime' },
  night: { name: 'Nightside', icon: '🌙', desc: 'Works dusk & night' },
  round: { name: 'Round-the-clock', icon: '⏳', desc: 'Always on; wears out & sours fast' },
};

export type SkillKey = 'dig' | 'mill' | 'soul' | 'craft' | 'rite' | 'perform' | 'guard' | 'turret' | 'ward';
export type Skills = Record<SkillKey, number>;

export type SpeciesId = 'skeleton' | 'zombie' | 'ghoul' | 'wraith' | 'golem';
export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  icon: string;
  color: string;
  desc: string;
  cost: Partial<Res>;
  day: number;
  night: number;
  speed: number;
  maxInt: number;
  atk: number;
  range: number;
  cd: number;
  raise: number;
  skills: Skills;
  unlock?: string;
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  skeleton: {
    id: 'skeleton', name: 'Skeleton', icon: '💀', color: '#d9d4c0',
    desc: 'Tireless and sun-hardy. Great carvers, musicians and ballista crews.',
    cost: { bones: 20 }, day: 0.9, night: 1.0, speed: 70, maxInt: 90, atk: 7, range: 24, cd: 0.8, raise: 10,
    skills: { dig: 0.8, mill: 1.0, soul: 0.7, craft: 1.3, rite: 1.0, perform: 1.4, guard: 1.2, turret: 1.4, ward: 0.7 },
  },
  zombie: {
    id: 'zombie', name: 'Zombie', icon: '🧟', color: '#7da06a',
    desc: 'Slow, sturdy labourers. Superb diggers and millers, but sunlight cripples them.',
    cost: { corpses: 2, bones: 5 }, day: 0.6, night: 1.05, speed: 46, maxInt: 130, atk: 10, range: 24, cd: 1.1, raise: 9,
    skills: { dig: 1.5, mill: 1.4, soul: 0.8, craft: 0.7, rite: 0.9, perform: 0.6, guard: 1.0, turret: 0.6, ward: 0.5 },
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul', icon: '👹', color: '#c47a5a',
    desc: 'Quick, hungry generalists who thrive after dark. Fine ritualists.',
    cost: { corpses: 3, souls: 1 }, day: 0.75, night: 1.2, speed: 96, maxInt: 80, atk: 9, range: 24, cd: 0.6, raise: 12,
    skills: { dig: 1.0, mill: 1.0, soul: 1.1, craft: 1.0, rite: 1.3, perform: 0.9, guard: 1.1, turret: 0.9, ward: 0.9 },
  },
  wraith: {
    id: 'wraith', name: 'Wraith', icon: '👻', color: '#8fb8ff',
    desc: 'Barely exists by day, but at night is the finest soul-worker and warder. Fragile.',
    cost: { souls: 5, ecto: 4 }, day: 0.12, night: 1.7, speed: 86, maxInt: 60, atk: 12, range: 140, cd: 1.2, raise: 16,
    skills: { dig: 0.3, mill: 0.5, soul: 1.9, craft: 0.6, rite: 1.6, perform: 1.4, guard: 1.0, turret: 1.0, ward: 2.1 },
    unlock: 'unlock_wraith',
  },
  golem: {
    id: 'golem', name: 'Bone Golem', icon: '🗿', color: '#b8b0a0',
    desc: 'Slow living siege-wall of fused bone. Unmatched guard, indifferent to daylight.',
    cost: { bones: 50, souls: 4 }, day: 0.95, night: 0.95, speed: 38, maxInt: 280, atk: 22, range: 30, cd: 1.3, raise: 18,
    skills: { dig: 1.2, mill: 1.0, soul: 0.3, craft: 0.9, rite: 0.7, perform: 0.2, guard: 1.9, turret: 0.5, ward: 0.2 },
    unlock: 'unlock_golem',
  },
};
export const SPECIES_ORDER: SpeciesId[] = ['skeleton', 'zombie', 'ghoul', 'wraith', 'golem'];

export type BKind = 'prod' | 'house' | 'pit' | 'aura' | 'turret' | 'ward' | 'guard' | 'wall' | 'core';
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  kind: BKind;
  size: number;
  cost: Partial<Res>;
  slots: number;
  hp: number;
  skill: SkillKey;
  cycle: number;
  inputs: Partial<Res>;
  outputs: Partial<Res>;
  infamy: number;
  color: string;
  desc: string;
  unlock?: string;
  housing?: number;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  mausoleum: {
    id: 'mausoleum', name: 'Mausoleum', icon: '🏛️', kind: 'core', size: 3, cost: {}, slots: 0, hp: 900, skill: 'guard', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#4a3f6b', housing: 4,
    desc: 'The heart of your Necropolis. If it falls, the dead are laid to rest forever.',
  },
  plot: {
    id: 'plot', name: "Gravedigger's Plot", icon: '⚒️', kind: 'prod', size: 2, cost: { bones: 10, coin: 10 }, slots: 2, hp: 140, skill: 'dig', cycle: 9,
    inputs: {}, outputs: { corpses: 1 }, infamy: 0, color: '#5a4a35',
    desc: 'Digs up fresh corpses. The root of every resource chain.',
  },
  mill: {
    id: 'mill', name: 'Bone Mill', icon: '⚙️', kind: 'prod', size: 2, cost: { bones: 15, coin: 15 }, slots: 2, hp: 160, skill: 'mill', cycle: 7,
    inputs: { corpses: 1 }, outputs: { bones: 3 }, infamy: 0, color: '#6b6a58',
    desc: 'Grinds 1 Corpse into 3 Bones — building material, ammo and raw skeletons.',
  },
  altar: {
    id: 'altar', name: 'Soul Altar', icon: '🔮', kind: 'prod', size: 2, cost: { bones: 30, coin: 30 }, slots: 2, hp: 150, skill: 'soul', cycle: 12,
    inputs: { corpses: 2 }, outputs: { souls: 1, ecto: 1 }, infamy: 0.3, color: '#3d5a6b',
    desc: 'Distils 2 Corpses into a Soul and Ectoplasm. Wraiths excel here.',
  },
  carver: {
    id: 'carver', name: 'Bone Carver', icon: '🪚', kind: 'prod', size: 2, cost: { bones: 20, coin: 15 }, slots: 2, hp: 140, skill: 'craft', cycle: 8,
    inputs: { bones: 4 }, outputs: { coin: 16 }, infamy: 0.8, color: '#7a6a4a',
    desc: 'Turns 4 Bones into curios sold to the living. Raises Infamy a little.',
  },
  embalmer: {
    id: 'embalmer', name: "Embalmer's Parlour", icon: '🏺', kind: 'prod', size: 2, cost: { bones: 25, coin: 40 }, slots: 2, hp: 140, skill: 'craft', cycle: 10,
    inputs: { corpses: 1, ecto: 1 }, outputs: { coin: 34 }, infamy: 1.6, color: '#6b4a5a', unlock: 'unlock_embalmer',
    desc: 'Corpse + Ectoplasm become luxury funerary goods. Lucrative, but scandalous.',
  },
  crypt: {
    id: 'crypt', name: 'Crypt', icon: '🪦', kind: 'house', size: 2, cost: { bones: 25, coin: 15 }, slots: 0, hp: 220, skill: 'guard', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#3d3a4a', housing: 4,
    desc: 'Off-shift undead sleep here, restoring Integrity and Morale. Raises population cap.',
  },
  pit: {
    id: 'pit', name: 'Reanimation Pit', icon: '🧬', kind: 'pit', size: 2, cost: { bones: 40, coin: 40 }, slots: 1, hp: 170, skill: 'rite', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#4a3a5a',
    desc: 'Queue new undead here. Needs a worker to perform the rite.',
  },
  dirge: {
    id: 'dirge', name: 'Dirge Hall', icon: '🎻', kind: 'aura', size: 2, cost: { bones: 20, coin: 40 }, slots: 1, hp: 140, skill: 'perform', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#5a3a4a',
    desc: 'A staffed performer lifts Morale of every undead nearby.',
  },
  barricade: {
    id: 'barricade', name: 'Bone Barricade', icon: '🧱', kind: 'wall', size: 1, cost: { bones: 6 }, slots: 0, hp: 160, skill: 'guard', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#8a8470',
    desc: 'Cheap wall. Raiders stop to smash anything near their path.',
  },
  turret: {
    id: 'turret', name: 'Bone Ballista', icon: '🏹', kind: 'turret', size: 1, cost: { bones: 20, coin: 20 }, slots: 1, hp: 130, skill: 'turret', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#7a6a50',
    desc: 'Needs a gunner. Fires bolts, using 1 Bone per 3 shots. Paladin armour blunts its physical bolts.',
  },
  ward: {
    id: 'ward', name: 'Ward Obelisk', icon: '🗼', kind: 'ward', size: 1, cost: { bones: 30, souls: 5, coin: 40 }, slots: 1, hp: 150, skill: 'ward', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#4a6a8a', unlock: 'unlock_ward',
    desc: 'Staffed obelisk: slows raiders, pulses armour-piercing necrotic damage, blocks consecration. Eats 1 Soul / 12s.',
  },
  guard: {
    id: 'guard', name: 'Guard Post', icon: '⚔️', kind: 'guard', size: 2, cost: { bones: 20, coin: 15 }, slots: 3, hp: 220, skill: 'guard', cycle: 0,
    inputs: {}, outputs: {}, infamy: 0, color: '#6a4a4a',
    desc: 'Up to 3 undead stand guard here and charge raiders that come near.',
  },
};
export const BUILD_ORDER = ['plot', 'mill', 'altar', 'carver', 'embalmer', 'crypt', 'pit', 'dirge', 'barricade', 'turret', 'ward', 'guard'];
export const BUILD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  team: 'zealot' | 'rival';
  hp: number;
  speed: number;
  dmg: number;
  range: number;
  cd: number;
  cost: number;
  minDay: number;
  r: number;
  armor: number;
  color: string;
  desc: string;
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  pilgrim: { id: 'pilgrim', name: 'Pilgrim', icon: '🧔', team: 'zealot', hp: 42, speed: 32, dmg: 6, range: 18, cd: 1.0, cost: 1, minDay: 1, r: 11, armor: 0, color: '#e8d9a0', desc: 'Faithful rabble with pitchforks.' },
  torch: { id: 'torch', name: 'Torchbearer', icon: '🔥', team: 'zealot', hp: 34, speed: 46, dmg: 4, range: 18, cd: 1.0, cost: 2, minDay: 2, r: 11, armor: 0, color: '#ff9a3c', desc: 'Sets buildings ablaze.' },
  acolyte: { id: 'acolyte', name: 'Crossbow Acolyte', icon: '🏹', team: 'zealot', hp: 32, speed: 34, dmg: 9, range: 160, cd: 1.7, cost: 2, minDay: 3, r: 11, armor: 0, color: '#d7e8ff', desc: 'Shoots workers from afar.' },
  priest: { id: 'priest', name: 'Priest', icon: '🙏', team: 'zealot', hp: 58, speed: 30, dmg: 3, range: 18, cd: 1.0, cost: 3, minDay: 3, r: 12, armor: 0, color: '#fff3b0', desc: 'Heals zealots and consecrates haunted sites.' },
  paladin: { id: 'paladin', name: 'Paladin', icon: '🛡️', team: 'zealot', hp: 170, speed: 27, dmg: 18, range: 22, cd: 1.3, cost: 5, minDay: 5, r: 14, armor: 0.45, color: '#f5f5f5', desc: 'Armoured: shrugs off 45% of physical damage. Necrotic magic ignores armour.' },
  thrall: { id: 'thrall', name: 'Rival Thrall', icon: '🦴', team: 'rival', hp: 30, speed: 56, dmg: 6, range: 18, cd: 0.9, cost: 1, minDay: 1, r: 10, armor: 0, color: '#9bff9b', desc: 'Skeletal servant of a rival necromancer.' },
  ghast: { id: 'ghast', name: 'Ghast', icon: '🐺', team: 'rival', hp: 38, speed: 108, dmg: 8, range: 18, cd: 0.7, cost: 2, minDay: 2, r: 11, armor: 0, color: '#c58bff', desc: 'Fast hunter of loose workers.' },
  rivalnec: { id: 'rivalnec', name: 'Rival Necromancer', icon: '🧙', team: 'rival', hp: 120, speed: 28, dmg: 10, range: 170, cd: 2.0, cost: 6, minDay: 3, r: 13, armor: 0, color: '#6bff9e', desc: 'Siphons your stockpile, curses morale, raises thralls.' },
  inquisitor: { id: 'inquisitor', name: 'High Inquisitor Solenne', icon: '☀️', team: 'zealot', hp: 1100, speed: 26, dmg: 30, range: 26, cd: 1.4, cost: 0, minDay: 99, r: 24, armor: 0.3, color: '#ffe08a', desc: 'Boss. Calls Holy Smites and, when wounded, forces Radiance — sunlight at any hour.', boss: true },
  archlich: { id: 'archlich', name: 'Archlich Vorgrath', icon: '☠️', team: 'rival', hp: 950, speed: 22, dmg: 14, range: 230, cd: 1.6, cost: 0, minDay: 99, r: 24, armor: 0.15, color: '#b36bff', desc: 'Boss. Raises thralls, rends souls in rings, unleashes Death Novas when wounded.', boss: true },
};

export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  key: string;
  cost: Partial<Res>;
  cd: number;
  target: boolean;
  radius: number;
  desc: string;
  unlock?: string;
}
export const SPELLS: SpellDef[] = [
  { id: 'storm', name: 'Bone Storm', icon: '🌪️', key: 'q', cost: { souls: 4 }, cd: 18, target: true, radius: 110, desc: 'Whirling bone shards shred everything in the target area (necrotic, ignores armour).' },
  { id: 'dirge', name: 'Rally Dirge', icon: '🎼', key: 'w', cost: { souls: 3 }, cd: 30, target: false, radius: 0, desc: 'All undead regain 30 Morale and 25 Integrity.' },
  { id: 'militia', name: 'Raise Militia', icon: '🪓', key: 'e', cost: { bones: 30, souls: 2 }, cd: 32, target: true, radius: 40, desc: 'Three skeleton militia rise at the target and fight for 25s.' },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', key: 'r', cost: { souls: 9 }, cd: 60, target: false, radius: 0, desc: 'Blots out the sun for 18s: undead gain night power, zealots lose their sunlit fervour.', unlock: 'unlock_eclipse' },
];

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  max: number;
  cost: number[];
  requires?: string;
}
export const UPGRADES: UpgradeDef[] = [
  { id: 'wealth', name: 'Grave Wealth', icon: '💰', desc: '+25% starting resources per level.', max: 3, cost: [8, 16, 28] },
  { id: 'sinew', name: 'Binding Sinew', icon: '🧵', desc: '+10% max Integrity and −8% wear per level.', max: 3, cost: [10, 20, 32] },
  { id: 'rites', name: 'Efficient Rites', icon: '📜', desc: '+7% production speed per level.', max: 3, cost: [12, 24, 40] },
  { id: 'bulwark', name: 'Mausoleum Bulwark', icon: '🏰', desc: '+25% Mausoleum HP per level.', max: 3, cost: [10, 20, 34] },
  { id: 'shrouds', name: 'Sunproof Shrouds', icon: '🧣', desc: 'Reduces the daylight penalty of undead by 15% per level.', max: 3, cost: [14, 26, 42] },
  { id: 'ballistics', name: 'Ballistics', icon: '🎯', desc: '+12% ballista, guard & militia damage per level.', max: 3, cost: [12, 24, 40] },
  { id: 'dirges', name: 'Dirge Tutelage', icon: '🎶', desc: '+20% morale recovery and −10% morale loss per level.', max: 3, cost: [10, 20, 32] },
  { id: 'mastery', name: 'Spell Mastery', icon: '✨', desc: '−10% spell cost and −8% cooldown per level.', max: 3, cost: [14, 28, 44] },
  { id: 'crypts', name: 'Deep Catacombs', icon: '🕳️', desc: '+1 capacity in every Crypt and Mausoleum per level.', max: 2, cost: [16, 32] },
  { id: 'unlock_embalmer', name: "Embalmer's Guild", icon: '🏺', desc: "Unlocks the Embalmer's Parlour.", max: 1, cost: [12] },
  { id: 'unlock_ward', name: 'Warding Rites', icon: '🗼', desc: 'Unlocks the Ward Obelisk.', max: 1, cost: [18] },
  { id: 'unlock_wraith', name: 'Whispering Veil', icon: '👻', desc: 'Unlocks raising Wraiths.', max: 1, cost: [22], requires: 'unlock_ward' },
  { id: 'unlock_golem', name: 'Bone Colossus', icon: '🗿', desc: 'Unlocks raising Bone Golems.', max: 1, cost: [30] },
  { id: 'unlock_eclipse', name: 'Eclipse Liturgy', icon: '🌑', desc: 'Unlocks the Eclipse spell.', max: 1, cost: [26] },
];

export interface DifficultyDef {
  id: string;
  name: string;
  desc: string;
  raid: number;
  hp: number;
  start: number;
  goal: number;
  shards: number;
  morale: number;
  eco: number;
  color: string;
}
export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'apprentice', name: 'Apprentice', desc: 'Smaller raids, richer start. Survive to Day 7.', raid: 0.75, hp: 0.9, start: 1.3, goal: 7, shards: 0.8, morale: 0.8, eco: 1.1, color: '#7fe3d4' },
  { id: 'necromancer', name: 'Necromancer', desc: 'The intended nightmare. Survive to Day 9.', raid: 1.0, hp: 1.0, start: 1.0, goal: 9, shards: 1.0, morale: 1.0, eco: 1.0, color: '#b78cff' },
  { id: 'lich', name: 'Lich', desc: 'Massive crusades, tougher foes, leaner start. Survive to Day 11.', raid: 1.4, hp: 1.25, start: 0.8, goal: 11, shards: 1.7, morale: 1.2, eco: 0.95, color: '#ff6b81' },
];

export interface ModifierDef { id: string; name: string; icon: string; desc: string; shards: number }
export const MODIFIERS: ModifierDef[] = [
  { id: 'crusade', name: 'Holy Crusade', icon: '✝️', desc: 'Zealot raids are 35% larger.', shards: 0.35 },
  { id: 'restless', name: 'Restless Dead', icon: '😠', desc: 'Morale drains 60% faster.', shards: 0.3 },
  { id: 'pauper', name: "Pauper's Grave", icon: '🪙', desc: 'Half the starting resources, no starting zombies.', shards: 0.3 },
  { id: 'sun', name: 'Eternal Sun', icon: '☀️', desc: 'Daylight dominates: nights are short.', shards: 0.4 },
  { id: 'rivals', name: 'Rival Season', icon: '🧙', desc: 'Rival necromancers raid from Day 1 and in greater numbers.', shards: 0.35 },
];

export interface TutStep { id: string; title: string; text: string }
export const TUTORIAL: TutStep[] = [
  { id: 'plot', title: "Dig for corpses", text: "Select the Gravedigger's Plot in the toolbar (key 1) and click an empty patch of ground to build it. Workers auto-assign." },
  { id: 'mill', title: 'Grind to bone', text: 'Build a Bone Mill (key 2). It turns Corpses into Bones, which pay for nearly everything.' },
  { id: 'crypt', title: 'Give the dead a bed', text: 'Build a Crypt (key 6). Off-shift undead rest there, restoring Integrity and Morale, and it raises your population cap.' },
  { id: 'shift', title: 'Schedule the shifts', text: 'Open the Roster tab and switch a worker to Nightside. Zombies, ghouls and wraiths weaken in sunlight; skeletons do not.' },
  { id: 'turret', title: 'Arm a ballista', text: 'Build a Bone Ballista (key 0). Then click a worker and click the ballista to pin them as its gunner.' },
  { id: 'pit', title: 'Raise the dead', text: 'Build a Reanimation Pit (key 7), choose a species in the Inspect tab and queue a rite. A worker must staff the pit.' },
  { id: 'raid', title: 'Hold the line', text: 'A small zealot raid approaches! Keep gunners staffed and bones stocked. Slay 3 raiders.' },
  { id: 'spell', title: 'Cast a rite', text: 'Press Q (Bone Storm), then click on the enemy to cast it. Souls come from the Soul Altar.' },
];

export const MAX_PARTICLES = 700;
