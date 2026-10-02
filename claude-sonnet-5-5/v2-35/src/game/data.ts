export type Terrain = 'plain' | 'forest' | 'hill' | 'mountain' | 'water' | 'chasm' | 'fault' | 'ash' | 'bridge';
export type Weather = 'clear' | 'wind' | 'rain' | 'drought' | 'storm';
export type Objective = 'rout' | 'survive' | 'seize' | 'boss';
export type Biome = 'ash' | 'marsh' | 'fault' | 'mixed';

export const TERRAIN: Record<Terrain, { name: string; cost: number; cover: number; passable: boolean; flammable: boolean }> = {
  plain: { name: 'Plains', cost: 1, cover: 0, passable: true, flammable: false },
  forest: { name: 'Forest', cost: 2, cover: 1, passable: true, flammable: true },
  hill: { name: 'Hills', cost: 2, cover: 1, passable: true, flammable: false },
  mountain: { name: 'Mountain', cost: 99, cover: 0, passable: false, flammable: false },
  water: { name: 'Deep Water', cost: 99, cover: 0, passable: false, flammable: false },
  chasm: { name: 'Chasm', cost: 99, cover: 0, passable: false, flammable: false },
  fault: { name: 'Fault Ground', cost: 1, cover: 0, passable: true, flammable: false },
  ash: { name: 'Scorched Earth', cost: 1, cover: 0, passable: true, flammable: false },
  bridge: { name: 'Timber Bridge', cost: 1, cover: 0, passable: true, flammable: false },
};

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  cd: number;
  rmin: number;
  rmax: number;
}

export interface UnitDef {
  id: string;
  name: string;
  icon: string;
  hp: number;
  move: number;
  atk: number;
  armor: number;
  rmin: number;
  rmax: number;
  desc: string;
  cost?: number;
  ability?: AbilityDef;
  passive?: string;
  // enemy only
  ai?: string;
  pts?: number;
  xp?: number;
  boss?: boolean;
}

export const CLASSES: Record<string, UnitDef> = {
  fusilier: { id: 'fusilier', name: 'Fusilier', icon: '⚔️', hp: 10, move: 3, atk: 4, armor: 0, rmin: 1, rmax: 2, cost: 8, desc: 'Reliable line infantry. Strikes at range 1–2 and holds the center.' },
  vanguard: {
    id: 'vanguard', name: 'Vanguard', icon: '🛡️', hp: 15, move: 3, atk: 5, armor: 1, rmin: 1, rmax: 1, cost: 11,
    desc: 'Armored bruiser. SHOVE hurls foes into chasms, deep water and flames.',
    ability: { id: 'shove', name: 'Shove', desc: 'Push an adjacent enemy one hex away. Chasm = 6 dmg, deep water = drowned, fire = burn, another unit = collision.', cd: 1, rmin: 1, rmax: 1 },
  },
  ranger: {
    id: 'ranger', name: 'Ranger', icon: '🏹', hp: 8, move: 3, atk: 4, armor: 0, rmin: 2, rmax: 3, cost: 10,
    desc: 'Long-bow skirmisher. SNIPE hits hard from afar. +1 range from hills.',
    ability: { id: 'snipe', name: 'Snipe', desc: 'Range 2–4 shot dealing +3 damage.', cd: 3, rmin: 2, rmax: 4 },
  },
  sapper: {
    id: 'sapper', name: 'Sapper', icon: '🔧', hp: 9, move: 3, atk: 2, armor: 0, rmin: 1, rmax: 1, cost: 12,
    desc: 'The land-tamer. SHORE cancels hazards and rebuilds the ground.',
    ability: { id: 'shore', name: 'Shore', desc: 'Range 2: cancel a hazard warning & make tile stable; extinguish fire; drain flood; bridge a chasm.', cd: 2, rmin: 0, rmax: 2 },
  },
  scout: { id: 'scout', name: 'Scout', icon: '🐴', hp: 8, move: 5, atk: 3, armor: 0, rmin: 1, rmax: 1, cost: 9, desc: 'Fast rider. HIT & RUN: after attacking, may still move 2. Ideal depot-grabber.', passive: 'hitrun' },
  medic: {
    id: 'medic', name: 'Medic', icon: '💚', hp: 8, move: 3, atk: 2, armor: 0, rmin: 1, rmax: 1, cost: 10,
    desc: 'Mends wounds and keeps the line alive.',
    ability: { id: 'mend', name: 'Mend', desc: 'Heal an ally within range 1–2 for 4 HP.', cd: 0, rmin: 1, rmax: 2 },
  },
  mortar: {
    id: 'mortar', name: 'Mortar', icon: '💣', hp: 8, move: 2, atk: 5, armor: 0, rmin: 2, rmax: 4, cost: 13,
    desc: 'Siege artillery. Ignores cover but cannot fire after moving. INCENDIARY sets ground ablaze.',
    ability: { id: 'incendiary', name: 'Incendiary', desc: 'Range 2–4: ignite a tile (2 dmg to unit there). Fire spreads with the wind!', cd: 3, rmin: 2, rmax: 4 },
    passive: 'setup',
  },
};

export const ENEMIES: Record<string, UnitDef> = {
  raider: { id: 'raider', name: 'Raider', icon: '🗡️', hp: 8, move: 4, atk: 3, armor: 0, rmin: 1, rmax: 1, ai: 'rush', pts: 2, xp: 4, desc: 'Fast melee swarm.' },
  slinger: { id: 'slinger', name: 'Slinger', icon: '🎯', hp: 6, move: 3, atk: 3, armor: 0, rmin: 2, rmax: 3, ai: 'ranged', pts: 2, xp: 4, desc: 'Keeps its distance and pelts you.' },
  skirmisher: { id: 'skirmisher', name: 'Skirmisher', icon: '🐺', hp: 7, move: 6, atk: 3, armor: 0, rmin: 1, rmax: 1, ai: 'flank', pts: 3, xp: 5, desc: 'Fast. Hunts healers, sappers and depots.' },
  brute: { id: 'brute', name: 'Brute', icon: '🔨', hp: 16, move: 2, atk: 5, armor: 2, rmin: 1, rmax: 1, ai: 'rush', pts: 4, xp: 7, desc: 'Armored heavy. Slow but crushing.' },
  pyromancer: {
    id: 'pyromancer', name: 'Pyromancer', icon: '🔥', hp: 7, move: 3, atk: 2, armor: 0, rmin: 2, rmax: 3, ai: 'caster', pts: 4, xp: 7, desc: 'Casts FIREBOLT: ignites the ground, hurts those on it.',
    ability: { id: 'firebolt', name: 'Firebolt', desc: 'Ignites target tile in 2 rounds.', cd: 2, rmin: 2, rmax: 4 },
  },
  geomancer: {
    id: 'geomancer', name: 'Geomancer', icon: '🌋', hp: 8, move: 3, atk: 2, armor: 0, rmin: 2, rmax: 3, ai: 'caster', pts: 5, xp: 8, desc: 'Casts FISSURE: cracks ground that collapses in 2 rounds.',
    ability: { id: 'fissure', name: 'Fissure', desc: 'Marks 3 tiles to collapse.', cd: 3, rmin: 2, rmax: 4 },
  },
  tidecaller: {
    id: 'tidecaller', name: 'Tidecaller', icon: '🌊', hp: 8, move: 3, atk: 2, armor: 0, rmin: 2, rmax: 3, ai: 'caster', pts: 5, xp: 8, desc: 'Casts SURGE: floods an area, cutting supply and slowing you.',
    ability: { id: 'surge', name: 'Surge', desc: 'Marks 4 tiles to flood.', cd: 3, rmin: 2, rmax: 4 },
  },
  colossus: { id: 'colossus', name: 'Ashen Colossus', icon: '🗿', hp: 46, move: 2, atk: 6, armor: 2, rmin: 1, rmax: 1, ai: 'boss', pts: 0, xp: 30, boss: true, desc: 'A walking pyre. Ignites the ground around it each round. Enrages below 50%.' },
  warden: { id: 'warden', name: 'Cataclysm Warden', icon: '👹', hp: 64, move: 3, atk: 5, armor: 1, rmin: 1, rmax: 3, ai: 'boss', pts: 0, xp: 50, boss: true, desc: 'Master of ruin. Calls fire, fissure and flood. Summons raiders at 66% and 33%.' },
};

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  ranged?: boolean;
}

export const PERKS: PerkDef[] = [
  { id: 'tough', name: 'Tough', desc: '+4 max HP.' },
  { id: 'keen', name: 'Keen Edge', desc: '+1 attack.' },
  { id: 'fleet', name: 'Fleet', desc: '+1 movement.' },
  { id: 'ironskin', name: 'Iron Skin', desc: '+1 armor.' },
  { id: 'pyreborn', name: 'Pyre-Born', desc: 'Immune to fire damage.' },
  { id: 'steady', name: 'Steady Footing', desc: 'Takes only 1 damage from collapses.' },
  { id: 'amphib', name: 'Amphibious', desc: 'Flooded ground costs no extra movement and no attack penalty.' },
  { id: 'forager', name: 'Forager', desc: 'Never suffers supply penalties.' },
  { id: 'exec', name: 'Executioner', desc: '+2 damage vs enemies below half health.' },
  { id: 'drinker', name: 'Lifedrinker', desc: 'Heal 3 HP on a kill.' },
  { id: 'longarm', name: 'Long Arm', desc: '+1 attack range.', ranged: true },
  { id: 'scholar', name: 'Scholar', desc: 'Gains +50% experience.' },
];

export interface GearDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
}

export const GEAR: GearDef[] = [
  { id: 'oilskin', name: 'Oilskin Cloak', icon: '🧥', desc: 'Fire damage reduced to 1.', cost: 6 },
  { id: 'hobnails', name: 'Hobnail Boots', icon: '🥾', desc: 'Collapses deal 1 damage; hills cost 1 move.', cost: 6 },
  { id: 'waders', name: 'Waders', icon: '🪣', desc: 'Ignore flood movement cost & attack penalty.', cost: 5 },
  { id: 'rations', name: 'Iron Rations', icon: '🍞', desc: 'Never suffers supply penalties.', cost: 7 },
  { id: 'whetstone', name: 'Whetstone', icon: '🪨', desc: '+1 attack.', cost: 8 },
  { id: 'plate', name: 'Bulwark Plate', icon: '🔰', desc: '+1 armor, +3 max HP, -1 move.', cost: 9 },
  { id: 'spyglass', name: 'Spyglass', icon: '🔭', desc: '+1 range for ranged units; +1 move for melee.', cost: 10 },
];

export const XP_LEVELS = [0, 8, 20, 38, 60];
export const RANKS = ['Recruit', 'Veteran', 'Elite', 'Champion', 'Legend'];

export interface MissionDef {
  id: number;
  name: string;
  tier: number;
  desc: string;
  objective: Objective;
  turns?: number;
  biome: Biome;
  w: number;
  h: number;
  haz: { collapse: number; flood: number; fire: number };
  hazGrow: number;
  weather: Weather[];
  budget: number;
  crowns: number;
  laurels: number;
  boss?: string;
  eLevel: number;
  kinds: string[];
}

export const MISSIONS: MissionDef[] = [
  { id: 0, name: 'Cinder Ford', tier: 0, desc: 'Brigands torch the ford. Rout them before the fire spreads.', objective: 'rout', biome: 'ash', w: 10, h: 8, haz: { collapse: 0, flood: 0, fire: 1 }, hazGrow: 0.1, weather: ['clear', 'wind', 'clear'], budget: 7, crowns: 14, laurels: 1, eLevel: 1, kinds: ['raider', 'slinger'] },
  { id: 1, name: 'Sunken Causeway', tier: 1, desc: 'Seize both flooded waystations. The river keeps rising.', objective: 'seize', biome: 'marsh', w: 11, h: 8, haz: { collapse: 0, flood: 1, fire: 0 }, hazGrow: 0.2, weather: ['clear', 'rain', 'rain'], budget: 9, crowns: 17, laurels: 1, eLevel: 1, kinds: ['raider', 'slinger', 'skirmisher'] },
  { id: 2, name: 'Orchard of Embers', tier: 1, desc: 'Hold the orchard for 6 rounds as wildfire and raiders close in.', objective: 'survive', turns: 6, biome: 'ash', w: 11, h: 9, haz: { collapse: 0, flood: 0, fire: 2 }, hazGrow: 0.15, weather: ['drought', 'wind', 'clear'], budget: 7, crowns: 18, laurels: 1, eLevel: 1, kinds: ['raider', 'skirmisher', 'pyromancer'] },
  { id: 3, name: 'Fault Line Pass', tier: 2, desc: 'The pass is crumbling. Rout the warband before the road gives way.', objective: 'rout', biome: 'fault', w: 12, h: 9, haz: { collapse: 2, flood: 0, fire: 0 }, hazGrow: 0.2, weather: ['clear', 'wind'], budget: 13, crowns: 20, laurels: 2, eLevel: 2, kinds: ['raider', 'slinger', 'brute', 'geomancer'] },
  { id: 4, name: 'Drowned Mill', tier: 2, desc: 'Retake the mill depots amid floods and sinking floors.', objective: 'seize', biome: 'mixed', w: 12, h: 9, haz: { collapse: 1, flood: 2, fire: 0 }, hazGrow: 0.2, weather: ['rain', 'clear', 'rain'], budget: 13, crowns: 21, laurels: 2, eLevel: 2, kinds: ['raider', 'brute', 'tidecaller', 'skirmisher'] },
  { id: 5, name: 'The Ashen Colossus', tier: 3, desc: 'A walking furnace blocks the road. Slay it. Use water, chasms and the Shove.', objective: 'boss', boss: 'colossus', biome: 'ash', w: 13, h: 9, haz: { collapse: 0, flood: 1, fire: 2 }, hazGrow: 0.15, weather: ['wind', 'clear', 'drought'], budget: 8, crowns: 34, laurels: 3, eLevel: 2, kinds: ['raider', 'slinger', 'pyromancer', 'brute'] },
  { id: 6, name: 'Tidewall Bastion', tier: 4, desc: 'Hold the sea-wall for 7 rounds against the tide and the horde.', objective: 'survive', turns: 7, biome: 'marsh', w: 12, h: 9, haz: { collapse: 1, flood: 2, fire: 0 }, hazGrow: 0.25, weather: ['rain', 'storm', 'clear'], budget: 14, crowns: 24, laurels: 2, eLevel: 3, kinds: ['brute', 'tidecaller', 'slinger', 'skirmisher'] },
  { id: 7, name: 'Shattered Highway', tier: 4, desc: 'Break the enemy column on a road falling into the abyss.', objective: 'rout', biome: 'fault', w: 13, h: 9, haz: { collapse: 3, flood: 0, fire: 1 }, hazGrow: 0.25, weather: ['wind', 'clear', 'drought'], budget: 19, crowns: 25, laurels: 2, eLevel: 3, kinds: ['raider', 'brute', 'geomancer', 'pyromancer', 'skirmisher'] },
  { id: 8, name: 'Stormbreak Ridge', tier: 5, desc: 'Seize the ridge beacons under a ceaseless storm. All hazards are live.', objective: 'seize', biome: 'mixed', w: 13, h: 10, haz: { collapse: 1, flood: 1, fire: 1 }, hazGrow: 0.25, weather: ['storm', 'rain', 'wind'], budget: 21, crowns: 28, laurels: 3, eLevel: 4, kinds: ['raider', 'brute', 'geomancer', 'tidecaller', 'pyromancer', 'slinger'] },
  { id: 9, name: 'Burnt Archive', tier: 5, desc: 'Defend the last archive for 8 rounds in a firestorm.', objective: 'survive', turns: 8, biome: 'ash', w: 12, h: 10, haz: { collapse: 1, flood: 0, fire: 3 }, hazGrow: 0.2, weather: ['drought', 'wind', 'wind'], budget: 19, crowns: 28, laurels: 3, eLevel: 4, kinds: ['raider', 'skirmisher', 'pyromancer', 'brute', 'slinger'] },
  { id: 10, name: 'Cataclysm Citadel', tier: 6, desc: 'Destroy the Cataclysm Warden and end the Hexfall.', objective: 'boss', boss: 'warden', biome: 'mixed', w: 13, h: 10, haz: { collapse: 2, flood: 1, fire: 1 }, hazGrow: 0.2, weather: ['storm', 'wind', 'rain', 'drought'], budget: 14, crowns: 60, laurels: 6, eLevel: 5, kinds: ['raider', 'brute', 'geomancer', 'tidecaller', 'pyromancer', 'skirmisher'] },
];

export const MAX_TIER = 6;

export interface Difficulty {
  id: string;
  name: string;
  desc: string;
  budget: number;
  hp: number;
  haz: number;
  smart: number;
  crowns: number;
  laurel: number;
  start: number;
  mercy: boolean;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'squire', name: 'Squire', desc: 'Gentler foes and hazards. Fallen units may survive wounded (Field Surgeons). Forgiving AI.', budget: 0.75, hp: 0.9, haz: 0.75, smart: 0.4, crowns: 1.0, laurel: 1, start: 40, mercy: true },
  { id: 'captain', name: 'Captain', desc: 'The intended experience. Permadeath is real.', budget: 1, hp: 1, haz: 1, smart: 1, crowns: 1, laurel: 1.25, start: 30, mercy: false },
  { id: 'warlord', name: 'Warlord', desc: 'Big enemy forces, savage hazards and AI that dodges and exploits terrain.', budget: 1.3, hp: 1.15, haz: 1.25, smart: 1.5, crowns: 1.2, laurel: 1.75, start: 20, mercy: false },
];

export interface Modifier {
  id: string;
  name: string;
  desc: string;
  bonus: number;
}

export const MODIFIERS: Modifier[] = [
  { id: 'cataclysm', name: 'Cataclysm', desc: '+1 hazard event per active hazard type each round.', bonus: 0.4 },
  { id: 'famine', name: 'Famine', desc: 'Supply lines reach 2 hexes shorter.', bonus: 0.3 },
  { id: 'elite', name: 'Elite Foes', desc: 'Enemies gain +2 HP and +1 attack.', bonus: 0.4 },
];

export interface TechDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  max: number;
  cost: number[];
}

export const TECH: TechDef[] = [
  { id: 'survey', name: 'Geological Survey', icon: '🧭', desc: '-1 natural collapse per hazard phase per level.', max: 2, cost: [4, 8] },
  { id: 'quartermaster', name: 'Quartermasters', icon: '📦', desc: '+1 supply line reach per level.', max: 3, cost: [3, 5, 8] },
  { id: 'hospital', name: 'Field Hospital', icon: '⛑️', desc: '+1 healing per round for supplied units per level.', max: 2, cost: [4, 7] },
  { id: 'barracks', name: 'Barracks', icon: '🏕️', desc: '+1 deployment slot per level (base 4).', max: 2, cost: [5, 10] },
  { id: 'engineers', name: "Engineers' Guild", icon: '⚒️', desc: 'Shore reach +1 and its cooldown -1 (level 2).', max: 2, cost: [4, 8] },
  { id: 'academy', name: 'War Academy', icon: '🎓', desc: '+25% XP per level; recruits start as Veterans (level 2).', max: 2, cost: [4, 9] },
  { id: 'chest', name: 'War Chest', icon: '💰', desc: '+8 starting crowns and +10% mission crowns per level.', max: 3, cost: [3, 5, 7] },
  { id: 'hazmat', name: 'Hazard Drills', icon: '🪖', desc: '-1 damage from fire & collapse per level.', max: 2, cost: [5, 9] },
  { id: 'armory', name: 'Armory Stock', icon: '🗃️', desc: 'Begin each campaign with a free Oilskin & Waders per level.', max: 1, cost: [4] },
];

export const NAMES_FIRST = ['Aldric', 'Brienne', 'Corvin', 'Dara', 'Edda', 'Fenn', 'Garrick', 'Hale', 'Isolde', 'Jory', 'Kestrel', 'Lysa', 'Mace', 'Nessa', 'Orrin', 'Perrin', 'Quill', 'Rowan', 'Sable', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yara', 'Zeph', 'Bram', 'Cass', 'Dov', 'Elsie', 'Finch', 'Gwyn', 'Hob'];
export const NAMES_LAST = ['Ashdown', 'Blackwater', 'Cairn', 'Dunmore', 'Emberly', 'Flint', 'Greyfell', 'Hollow', 'Ironwood', 'Kettle', 'Larch', 'Marsh', 'Nightjar', 'Oakhart', 'Pike', 'Quarry', 'Rook', 'Stormvale', 'Thorn', 'Underhill', 'Vale', 'Whitlock'];

export const WEATHER_INFO: Record<Weather, { name: string; icon: string; desc: string }> = {
  clear: { name: 'Clear', icon: '☀️', desc: 'Calm skies. Natural hazards at base rate.' },
  wind: { name: 'Gale', icon: '💨', desc: 'Fire leaps two hexes downwind.' },
  rain: { name: 'Rain', icon: '🌧️', desc: '+1 flood event; fires are doused; floods do not recede.' },
  drought: { name: 'Drought', icon: '🏜️', desc: '+1 fire event; floods recede faster; plains can burn.' },
  storm: { name: 'Storm', icon: '⛈️', desc: 'Rain + gale + lightning strikes + extra collapse.' },
};

export const WIND_ARROWS = ['→', '↗', '↖', '←', '↙', '↘'];

export const TIPS = [
  'Hazard warnings resolve at the end of the round. Move units off marked tiles!',
  'Sappers can Shore a collapse warning: the tile becomes permanently stable.',
  'Supply lines are blocked by enemies, chasms, flood and fire. Keep a road open.',
  'Shove an enemy into a chasm or deep water for an instant kill.',
  'Rain douses fire. Drought feeds it. Check the weather forecast every round.',
  'Veterans are precious. Fallen units are gone forever.',
  'Hold depots to extend your supply range. Enemies capture them too!',
  'Flooding a chasm turns it into a lake permanently.',
  'Press T to toggle the enemy threat range overlay.',
];
