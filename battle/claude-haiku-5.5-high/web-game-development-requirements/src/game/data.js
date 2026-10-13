// Civilization Micro — static game data (tables only, no logic)

export const MAX_TURN = 250;

export const ERAS = ['Ancient', 'Classical', 'Medieval', 'Renaissance', 'Industrial', 'Modern'];

export const TERRAIN = {
  grass: { name: 'Grassland', col: '#86b85a', f: 2, p: 0, g: 0, def: 0, mv: 1, pass: true },
  plains: { name: 'Plains', col: '#c9b861', f: 1, p: 1, g: 0, def: 0, mv: 1, pass: true },
  desert: { name: 'Desert', col: '#e4c78e', f: 0, p: 0, g: 0, def: 0, mv: 1, pass: true, deco: '🌵' },
  tundra: { name: 'Tundra', col: '#cfdcd6', f: 1, p: 0, g: 0, def: 0, mv: 1, pass: true },
  hills: { name: 'Hills', col: '#a2a57e', f: 0, p: 2, g: 0, def: 0.5, mv: 2, pass: true, deco: '⛰️' },
  forest: { name: 'Forest', col: '#4a8a4c', f: 1, p: 2, g: 0, def: 0.25, mv: 2, pass: true, deco: '🌲' },
  mountain: { name: 'Mountains', col: '#7d7a85', f: 0, p: 0, g: 0, def: 0.75, mv: 99, pass: false, deco: '🏔️' },
  ocean: { name: 'Ocean', col: '#3b7bb8', f: 1, p: 0, g: 1, def: 0, mv: 99, pass: false, water: true },
};

export const RESOURCES = {
  wheat: { name: 'Wheat', icon: '🌾', f: 2, on: ['plains', 'grass'] },
  cattle: { name: 'Cattle', icon: '🐄', f: 1, g: 1, on: ['grass', 'plains'] },
  fish: { name: 'Fish', icon: '🐟', f: 2, on: ['ocean'] },
  deer: { name: 'Deer', icon: '🦌', f: 1, p: 1, on: ['forest', 'tundra'] },
  iron: { name: 'Iron', icon: '⚒️', p: 1, strat: true, on: ['hills', 'forest'] },
  horses: { name: 'Horses', icon: '🐎', p: 1, strat: true, on: ['grass', 'plains'] },
  gold: { name: 'Gold', icon: '💰', g: 3, on: ['hills', 'desert', 'tundra'] },
  gems: { name: 'Gems', icon: '💎', cu: 2, s: 1, on: ['hills', 'desert'] },
};

export const IMPROVEMENTS = {
  farm: { name: 'Farm', icon: '🚜', turns: 4, on: ['grass', 'plains', 'tundra', 'desert'], y: { f: 1 } },
  mine: { name: 'Mine', icon: '⛏️', turns: 4, on: ['hills'], y: { p: 2 } },
  lumber: { name: 'Lumber Camp', icon: '🪵', turns: 3, on: ['forest'], y: { p: 1 } },
  pasture: { name: 'Pasture', icon: '🐑', turns: 3, on: ['grass', 'plains'], y: { g: 1 }, req: 'animal' },
  road: { name: 'Road', icon: '🛣️', turns: 2, on: ['grass', 'plains', 'desert', 'tundra', 'hills', 'forest'], y: { g: 1 }, req: 'currency' },
};

export const BUILDINGS = {
  library: { name: 'Library', icon: '📚', cost: 60, up: 1, req: 'writing', y: { s: 2, cu: 1 }, desc: '+2 science, +1 culture' },
  temple: { name: 'Temple', icon: '🛕', cost: 50, up: 1, req: 'mysticism', y: { cu: 2 }, happy: 2, desc: '+2 culture, +2 content' },
  walls: { name: 'City Walls', icon: '🧱', cost: 50, up: 0, req: 'masonry', def: true, desc: 'Doubles city defense' },
  forge: { name: 'Forge', icon: '🔨', cost: 70, up: 1, req: 'ironworking', y: { p: 2 }, desc: '+2 production' },
  market: { name: 'Market', icon: '🏪', cost: 70, up: 1, req: 'currency', y: { g: 2 }, desc: '+2 gold' },
  aqueduct: { name: 'Aqueduct', icon: '🚰', cost: 80, up: 1, req: 'construction', cap: 16, desc: 'Raises size cap to 16' },
  colosseum: { name: 'Colosseum', icon: '🏟️', cost: 90, up: 2, req: 'construction', happy: 3, y: { cu: 1 }, desc: '+3 content, +1 culture' },
  harbor: { name: 'Harbor', icon: '⚓', cost: 80, up: 1, req: 'seafaring', coastal: true, y: { f: 2 }, desc: '+2 food (coastal)' },
  university: { name: 'University', icon: '🎓', cost: 130, up: 2, req: 'university', y: { s: 4, cu: 1 }, desc: '+4 science, +1 culture' },
  bank: { name: 'Bank', icon: '🏦', cost: 110, up: 2, req: 'banking', y: { g: 3 }, desc: '+3 gold' },
  factory: { name: 'Factory', icon: '🏭', cost: 150, up: 3, req: 'industrialization', y: { p: 4 }, desc: '+4 production' },
};

export const WONDERS = {
  pyramids: { name: 'Pyramids', icon: '🔺', cost: 180, req: 'bronze', desc: '+25% production in host city' },
  greatLibrary: { name: 'Great Library', icon: '📜', cost: 220, req: 'writing', desc: '+3 science, +1 culture in host city' },
  colossus: { name: 'Colossus', icon: '🚢', cost: 180, req: 'currency', desc: '+4 gold in host city' },
  hanging: { name: 'Hanging Gardens', icon: '🌳', cost: 200, req: 'pottery', desc: '+1 food in every city' },
  stonehenge: { name: 'Stonehenge', icon: '🗿', cost: 170, req: 'mysticism', desc: '+4 culture in host city' },
  eiffel: { name: 'Eiffel Tower', icon: '🗼', cost: 320, req: 'industrialization', desc: '+6 culture, +2 content everywhere' },
};

export const UNITS = {
  settler: { name: 'Settler', icon: '🧭', cost: 40, atk: 0, def: 1, mv: 2, civil: true, desc: 'Founds cities. Costs 1 population.' },
  worker: { name: 'Worker', icon: '🔧', cost: 25, atk: 0, def: 1, mv: 2, civil: true, desc: 'Builds tile improvements.' },
  warrior: { name: 'Warrior', icon: '🗡️', cost: 15, atk: 6, def: 6, mv: 2, desc: 'Basic melee unit.' },
  spearman: { name: 'Spearman', icon: '🔱', cost: 22, atk: 5, def: 10, mv: 2, req: 'bronze', anticav: true, desc: 'Strong vs mounted units.' },
  archer: { name: 'Archer', icon: '🏹', cost: 25, atk: 9, def: 4, mv: 2, rng: 2, req: 'archery', desc: 'Ranged: strikes without retaliation.' },
  horseman: { name: 'Horseman', icon: '🐴', cost: 30, atk: 10, def: 5, mv: 4, req: 'horseback', res: 'horses', mounted: true, desc: 'Fast raider. Needs Horses.' },
  swordsman: { name: 'Swordsman', icon: '⚔️', cost: 38, atk: 13, def: 9, mv: 2, req: 'ironworking', res: 'iron', desc: 'Heavy infantry. Needs Iron.' },
  catapult: { name: 'Catapult', icon: '🪨', cost: 45, atk: 16, def: 2, mv: 1, rng: 2, req: 'mathematics', siege: true, desc: 'Double damage vs cities. Cannot capture.' },
  musketeer: { name: 'Musketeer', icon: '🔫', cost: 50, atk: 14, def: 13, mv: 2, req: 'gunpowder', res: 'iron', desc: 'Gunpowder infantry. Needs Iron.' },
  tank: { name: 'Tank', icon: '🛡️', cost: 95, atk: 28, def: 16, mv: 4, req: 'combustion', res: 'iron', mounted: true, desc: 'Armored juggernaut. Needs Iron.' },
  legion: { name: 'Legion', icon: '🦅', cost: 32, atk: 12, def: 9, mv: 2, req: 'ironworking', unique: 'rome', desc: 'Roman legionary. Unique.' },
  chariot: { name: 'War Chariot', icon: '🛞', cost: 30, atk: 12, def: 5, mv: 3, req: 'horseback', unique: 'egypt', mounted: true, desc: 'Egyptian chariot. Unique.' },
  keshik: { name: 'Keshik', icon: '🏇', cost: 36, atk: 14, def: 7, mv: 4, req: 'horseback', unique: 'mongols', mounted: true, desc: 'Mongol elite cavalry. Unique.' },
  crossbow: { name: 'Crossbowman', icon: '🎯', cost: 34, atk: 15, def: 6, mv: 2, rng: 2, req: 'feudalism', unique: 'china', desc: 'Chinese crossbow. Unique.' },
  barb_warrior: { name: 'Raider', icon: '🪓', cost: 0, atk: 7, def: 5, mv: 2, barb: true, desc: 'Barbarian raider.' },
  barb_archer: { name: 'Slinger', icon: '🪃', cost: 0, atk: 8, def: 3, mv: 2, rng: 2, barb: true, desc: 'Barbarian slinger.' },
};

export const TECHS = [
  // Ancient
  { id: 'pottery', name: 'Pottery', era: 0, cost: 20, pre: [] },
  { id: 'bronze', name: 'Bronze Working', era: 0, cost: 20, pre: [] },
  { id: 'animal', name: 'Animal Husbandry', era: 0, cost: 25, pre: [] },
  { id: 'writing', name: 'Writing', era: 0, cost: 30, pre: ['pottery'] },
  { id: 'masonry', name: 'Masonry', era: 0, cost: 25, pre: [] },
  { id: 'archery', name: 'Archery', era: 0, cost: 25, pre: ['bronze'] },
  { id: 'mysticism', name: 'Mysticism', era: 0, cost: 40, pre: ['writing'] },
  { id: 'horseback', name: 'Horseback Riding', era: 0, cost: 35, pre: ['animal'] },
  // Classical
  { id: 'ironworking', name: 'Iron Working', era: 1, cost: 50, pre: ['bronze'] },
  { id: 'currency', name: 'Currency', era: 1, cost: 55, pre: ['bronze'] },
  { id: 'mathematics', name: 'Mathematics', era: 1, cost: 65, pre: ['masonry', 'writing'] },
  { id: 'philosophy', name: 'Philosophy', era: 1, cost: 80, pre: ['mysticism', 'writing'] },
  { id: 'seafaring', name: 'Seafaring', era: 1, cost: 60, pre: ['pottery', 'writing'] },
  { id: 'monarchy', name: 'Monarchy', era: 1, cost: 60, pre: ['mysticism', 'currency'] },
  { id: 'construction', name: 'Construction', era: 1, cost: 70, pre: ['masonry', 'currency'] },
  // Medieval
  { id: 'feudalism', name: 'Feudalism', era: 2, cost: 110, pre: ['monarchy', 'horseback'] },
  { id: 'astronomy', name: 'Astronomy', era: 2, cost: 120, pre: ['mathematics', 'mysticism'] },
  { id: 'banking', name: 'Banking', era: 2, cost: 130, pre: ['currency', 'philosophy'] },
  { id: 'navigation', name: 'Navigation', era: 2, cost: 130, pre: ['seafaring', 'astronomy'] },
  // Renaissance
  { id: 'university', name: 'University', era: 3, cost: 160, pre: ['astronomy', 'philosophy'] },
  { id: 'printing', name: 'Printing Press', era: 3, cost: 170, pre: ['writing', 'banking'] },
  { id: 'gunpowder', name: 'Gunpowder', era: 3, cost: 190, pre: ['ironworking', 'feudalism'] },
  { id: 'economics', name: 'Economics', era: 3, cost: 200, pre: ['banking', 'university'] },
  // Industrial
  { id: 'steam', name: 'Steam Power', era: 4, cost: 240, pre: ['gunpowder', 'navigation'] },
  { id: 'industrialization', name: 'Industrialization', era: 4, cost: 280, pre: ['steam', 'banking'] },
  { id: 'railroad', name: 'Railroad', era: 4, cost: 300, pre: ['steam'] },
  { id: 'steel', name: 'Steel', era: 4, cost: 310, pre: ['industrialization'] },
  { id: 'electricity', name: 'Electricity', era: 4, cost: 320, pre: ['steam', 'university'] },
  // Modern
  { id: 'combustion', name: 'Combustion', era: 5, cost: 380, pre: ['steel', 'railroad'] },
  { id: 'flight', name: 'Flight', era: 5, cost: 400, pre: ['combustion', 'electricity'] },
  { id: 'computers', name: 'Computers', era: 5, cost: 450, pre: ['electricity', 'economics'] },
  { id: 'rocketry', name: 'Rocketry', era: 5, cost: 480, pre: ['flight', 'computers'] },
  { id: 'space', name: 'Space Flight', era: 5, cost: 600, pre: ['rocketry'] },
];

export const CIVS = [
  { id: 'rome', name: 'Rome', leader: 'Caesar Aurelius', col: '#c0392b', icon: '🦅', unique: 'legion', unlock: 0,
    ability: 'Imperium — all units cost 15% less to produce.',
    cityNames: ['Roma', 'Ostia', 'Capua', 'Ravenna', 'Neapolis', 'Mediolanum', 'Brundisium', 'Tarentum'] },
  { id: 'egypt', name: 'Egypt', leader: 'Pharaoh Nefertari', col: '#d4a017', icon: '🏺', unique: 'chariot', unlock: 1,
    ability: 'Nile Gift — +1 food in every city; Pyramids cost 30% less.',
    cityNames: ['Thebes', 'Memphis', 'Abydos', 'Akhetaten', 'Sais', 'Edfu', 'Giza', 'Bubastis'] },
  { id: 'mongols', name: 'Mongolia', leader: 'Khan Temur', col: '#2e86c1', icon: '🐎', unique: 'keshik', unlock: 2,
    ability: 'Horse Lords — mounted units attack +25%.',
    cityNames: ['Karakorum', 'Ordos', 'Kherlen', 'Tuul', 'Onon', 'Bayan', 'Khentii', 'Ulaan'] },
  { id: 'china', name: 'China', leader: 'Emperor Wen', col: '#8e44ad', icon: '🐉', unique: 'crossbow', unlock: 3,
    ability: 'Scholars — +25% science; libraries +1 science.',
    cityNames: ["Chang'an", 'Luoyang', 'Kaifeng', 'Hangzhou', 'Nanjing', 'Xi Ning', 'Jinan', 'Suzhou'] },
];

export const DIFFICULTY = {
  chieftain: { name: 'Chieftain', desc: 'Gentle rivals and forgiving diplomacy. Easiest.', ai: { p: 0.8, s: 0.8, g: 0.9 }, aggr: 0.5, player: { s: 1.15, p: 1.1 }, cul: 900 },
  monarch: { name: 'Monarch', desc: 'Balanced rivals and a fair economy.', ai: { p: 1, s: 1, g: 1 }, aggr: 1, player: { s: 1, p: 1 }, cul: 1100 },
  deity: { name: 'Deity', desc: 'Aggressive rivals with bonus yields. Hardest.', ai: { p: 1.25, s: 1.25, g: 1.2 }, aggr: 1.8, player: { s: 0.95, p: 0.95 }, cul: 1400 },
};

export const MAP_SIZES = {
  small: { name: 'Small', w: 20, h: 14, camps: 2, civs: 4 },
  standard: { name: 'Standard', w: 26, h: 18, camps: 3, civs: 4 },
  large: { name: 'Large', w: 32, h: 22, camps: 4, civs: 4 },
};

export const LEGACY = [
  { id: 'treasury', name: 'Royal Treasury', desc: 'Start every game with +30 gold.', cost: 2 },
  { id: 'surveyors', name: 'Surveyors Guild', desc: 'Start with an extra Worker.', cost: 3 },
  { id: 'militia', name: 'Militia Tradition', desc: 'Start with an extra Warrior.', cost: 3 },
  { id: 'scholars', name: 'Scholarly Tradition', desc: '+15% science in all your cities.', cost: 4 },
  { id: 'heritage', name: 'Cultural Heritage', desc: '+15% culture output.', cost: 4 },
  { id: 'quick', name: 'Quick Study', desc: 'Start with Pottery and Bronze Working researched.', cost: 5 },
];

export const DEFAULT_SETTINGS = { vol: 0.7, music: true, sfx: true, shake: true, hints: true, particles: 'high' };
