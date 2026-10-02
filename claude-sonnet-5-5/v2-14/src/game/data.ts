// Static game data: worlds, buildings, techs, difficulties, perks, milestones, events.

export const W = 64;
export const H = 36;
export const N = W * H;
export const SIM_DT = 0.1; // seconds per simulation tick (at 1x)
export const YEAR_SEC = 8; // real seconds per in-game year at 1x
export const DT_Y = SIM_DT / YEAR_SEC; // years per tick
export const SOIL_CAP = 0.04;

export type GasKey = 'n2' | 'co2' | 'o2' | 'pfc';
export type BuildId =
  | 'solar' | 'wind' | 'geo' | 'mine' | 'lab' | 'pfc' | 'scrub' | 'oxy'
  | 'n2x' | 'pump' | 'seeder' | 'soot' | 'dome' | 'settle';
export type ActionId = 'inspect' | 'demolish' | 'comet' | 'cloud' | 'raise' | 'lower' | 'seed';
export type ToolId = ActionId | BuildId;

export interface BuildDef {
  id: BuildId;
  name: string;
  icon: string;
  cost: number;
  energy: number; // upkeep per year (negative = produces)
  desc: string;
  tech?: string;
  color: string;
}

export const BUILDINGS: BuildDef[] = [
  { id: 'solar', name: 'Solar Array', icon: '☀️', cost: 20, energy: 0, color: '#f6c445', desc: 'Produces energy from sunlight. Clouds and dust cut output; mirrors boost it.' },
  { id: 'mine', name: 'Ore Mine', icon: '⛏️', cost: 30, energy: 1, color: '#b08968', desc: 'Produces materials. Needs highlands (elevation ≥ 35%); richer on mountains.' },
  { id: 'lab', name: 'Research Lab', icon: '🔬', cost: 40, energy: 3, color: '#7cc4ff', desc: 'Produces research points to unlock technologies.' },
  { id: 'pfc', name: 'Gas Works', icon: '🏭', cost: 55, energy: 2, color: '#ff8a5c', desc: 'Emits super-greenhouse halocarbons (PFC). Strong warming, slow decay.' },
  { id: 'dome', name: 'Habitat Dome', icon: '🛖', cost: 90, energy: 3, color: '#9be7c4', desc: 'Sealed colony (cap 30). Survives hostile air if powered. Needs food from nothing—hydroponics.' },
  { id: 'wind', name: 'Wind Turbine', icon: '🌀', cost: 28, energy: 0, tech: 'wind', color: '#9ad1d4', desc: 'Energy from wind. Weak in thin air, strong in thick atmospheres and highlands.' },
  { id: 'geo', name: 'Geothermal Tap', icon: '♨️', cost: 60, energy: 0, tech: 'geo', color: '#ff6b4a', desc: 'Steady energy and local heat. Only on volcanic vents (♨ marks).' },
  { id: 'scrub', name: 'CO₂ Scrubber', icon: '🧪', cost: 60, energy: 5, tech: 'cap', color: '#b5a6ff', desc: 'Pulls CO₂ out of the air. Cools a CO₂-choked world and makes it breathable.' },
  { id: 'oxy', name: 'Oxygenator', icon: '💨', cost: 70, energy: 6, tech: 'elec', color: '#8ee3ff', desc: 'Converts CO₂ into O₂ (or cracks regolith if CO₂ is scarce).' },
  { id: 'n2x', name: 'N₂ Extractor', icon: '🧊', cost: 65, energy: 5, tech: 'n2x', color: '#8fb3ff', desc: 'Releases nitrogen from the crust, slowly raising atmospheric pressure.' },
  { id: 'pump', name: 'Aquifer Pump', icon: '💧', cost: 45, energy: 3, tech: 'aqua', color: '#4aa8ff', desc: 'Draws water from the subsurface reserve onto its tile.' },
  { id: 'soot', name: 'Soot Works', icon: '🌑', cost: 40, energy: 0, tech: 'albedo', color: '#555a66', desc: 'Darkens ground within 3 tiles. Melts ice caps and warms the area.' },
  { id: 'seeder', name: 'Bio-Seeder', icon: '🌱', cost: 35, energy: 1, tech: 'bio1', color: '#6bd36b', desc: 'Seeds life within 3 tiles using the best species the climate allows.' },
  { id: 'settle', name: 'Open Settlement', icon: '🏘️', cost: 120, energy: 0, tech: 'hab', color: '#ffd29b', desc: 'Open-air colony (cap up to 300). Needs a habitable climate and nearby plants for food.' },
];

export const BUILD_MAP: Record<string, BuildDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export interface ActionDef { id: ActionId; name: string; icon: string; desc: string; tech?: string }
export const ACTIONS: ActionDef[] = [
  { id: 'inspect', name: 'Inspect', icon: '🔍', desc: 'Click a tile to read its climate, soil, life and habitability.' },
  { id: 'seed', name: 'Seed Life', icon: '🧬', tech: 'bio1', desc: 'Plant the best viable species on a tile (8 materials).' },
  { id: 'cloud', name: 'Cloud Seeding', icon: '🌧️', tech: 'cloud', desc: 'Forces rain from moist air in radius 3 for a few seconds (25 energy).' },
  { id: 'raise', name: 'Raise Land', icon: '⛰️', tech: 'terra', desc: 'Lift terrain around a tile. Build dams and barriers (8 materials).' },
  { id: 'lower', name: 'Dig Basin', icon: '🕳️', tech: 'terra', desc: 'Lower terrain around a tile. Make lake basins and channels (8 materials).' },
  { id: 'comet', name: 'Comet Strike', icon: '☄️', tech: 'comet', desc: 'Drop an ice comet: +6 kPa N₂, water, heat and a crater. Destroys everything within 2 tiles!' },
  { id: 'demolish', name: 'Demolish', icon: '🧨', desc: 'Remove a structure and refund 50% of its cost.' },
];

export interface TechDef { id: string; name: string; icon: string; cost: number; req: string[]; desc: string; tier: number }
export const TECHS: TechDef[] = [
  { id: 'wind', name: 'Wind Harvest', icon: '🌀', cost: 30, req: [], tier: 1, desc: 'Unlocks Wind Turbines.' },
  { id: 'n2x', name: 'Nitrogen Extraction', icon: '🧊', cost: 45, req: [], tier: 1, desc: 'Unlocks N₂ Extractors to raise pressure.' },
  { id: 'cap', name: 'Carbon Capture', icon: '🧪', cost: 55, req: [], tier: 1, desc: 'Unlocks CO₂ Scrubbers.' },
  { id: 'aqua', name: 'Aquifer Drilling', icon: '💧', cost: 50, req: [], tier: 1, desc: 'Unlocks Aquifer Pumps to tap subsurface water.' },
  { id: 'bio1', name: 'Extremophile Genetics', icon: '🦠', cost: 55, req: [], tier: 1, desc: 'Unlocks Bio-Seeders, Seed Life, microbial mats and lichens.' },
  { id: 'albedo', name: 'Albedo Engineering', icon: '🌑', cost: 55, req: [], tier: 1, desc: 'Unlocks Soot Works to melt ice caps.' },
  { id: 'geo', name: 'Geothermal Tapping', icon: '♨️', cost: 40, req: [], tier: 1, desc: 'Unlocks Geothermal Taps on volcanic vents.' },
  { id: 'adv', name: 'Advanced Labs', icon: '🧠', cost: 90, req: [], tier: 1, desc: '+30% research output.' },
  { id: 'elec', name: 'Electrolysis', icon: '💨', cost: 60, req: ['cap'], tier: 2, desc: 'Unlocks Oxygenators (CO₂ → O₂).' },
  { id: 'mirror', name: 'Orbital Mirrors', icon: '🪞', cost: 70, req: [], tier: 2, desc: 'Unlocks the global insolation dial (−50% … +40%).' },
  { id: 'cloud', name: 'Cloud Seeding', icon: '🌧️', cost: 65, req: [], tier: 2, desc: 'Unlocks the Cloud Seeding action.' },
  { id: 'terra', name: 'Terrain Engineering', icon: '⛰️', cost: 75, req: [], tier: 2, desc: 'Unlocks Raise Land and Dig Basin.' },
  { id: 'warn', name: 'Early Warning Net', icon: '📡', cost: 80, req: [], tier: 2, desc: 'Disaster warnings arrive 3 years earlier.' },
  { id: 'comet', name: 'Cometary Capture', icon: '☄️', cost: 100, req: ['n2x'], tier: 2, desc: 'Unlocks Comet Strike: a huge one-shot boost of N₂ and water.' },
  { id: 'bio2', name: 'Prairie Genome', icon: '🌾', cost: 90, req: ['bio1'], tier: 2, desc: 'Grasses can now be seeded and will spread.' },
  { id: 'hab', name: 'Open Habitats', icon: '🏘️', cost: 110, req: ['bio1'], tier: 2, desc: 'Unlocks Open Settlements — large colonies without domes.' },
  { id: 'lance', name: 'Orbital Lance', icon: '🛰️', cost: 110, req: ['warn'], tier: 3, desc: 'Click incoming meteors to intercept them (18 energy).' },
  { id: 'fire', name: 'Fire Suppression', icon: '🧯', cost: 100, req: ['cloud'], tier: 3, desc: 'Wildfires spread 60% slower and burn out faster.' },
  { id: 'fusion', name: 'Fusion Grid', icon: '⚛️', cost: 200, req: ['geo', 'adv'], tier: 3, desc: '+50% energy output from all generators.' },
  { id: 'bio3', name: 'Boreal Genome', icon: '🌲', cost: 140, req: ['bio2'], tier: 3, desc: 'Cold-hardy shrubs and conifers.' },
  { id: 'ward', name: 'Magnetic Ward', icon: '🧲', cost: 170, req: ['lance'], tier: 4, desc: 'Halves flare damage and radiation.' },
  { id: 'bio4', name: 'Temperate Canopy', icon: '🌳', cost: 190, req: ['bio3'], tier: 4, desc: 'Broadleaf forests. Great food and O₂.' },
  { id: 'bio5', name: 'Equatorial Biome', icon: '🌴', cost: 250, req: ['bio4'], tier: 5, desc: 'Rainforests that thrive in warm, wet climates.' },
];
export const TECH_MAP: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export interface TierDef { name: string; tmin: number; tmax: number; soil: number; minP: number; food: number; color: [number, number, number] }
export const TIERS: TierDef[] = [
  { name: 'None', tmin: 0, tmax: 0, soil: 1, minP: 0, food: 0, color: [0, 0, 0] },
  { name: 'Microbial Mats', tmin: -35, tmax: 75, soil: 0.03, minP: 1, food: 0, color: [98, 130, 110] },
  { name: 'Lichen & Moss', tmin: -25, tmax: 42, soil: 0.08, minP: 3, food: 0.15, color: [128, 150, 84] },
  { name: 'Prairie Grass', tmin: -8, tmax: 38, soil: 0.22, minP: 15, food: 0.6, color: [150, 184, 70] },
  { name: 'Boreal Shrub', tmin: -15, tmax: 32, soil: 0.3, minP: 20, food: 0.5, color: [76, 140, 74] },
  { name: 'Temperate Forest', tmin: 2, tmax: 34, soil: 0.42, minP: 25, food: 0.8, color: [40, 112, 54] },
  { name: 'Rainforest', tmin: 16, tmax: 40, soil: 0.65, minP: 30, food: 1, color: [14, 92, 62] },
];
export const TIER_TECH = ['', 'bio1', 'bio1', 'bio2', 'bio3', 'bio4', 'bio5'];

export const BIOMES = [
  'Deep Ocean', 'Shallow Sea', 'Ice Sheet', 'Barren Rock', 'Frozen Waste', 'Desert',
  'Microbial Flats', 'Lichen Tundra', 'Grassland', 'Shrubland', 'Forest', 'Rainforest', 'Wetland', 'Scorched',
];

export interface WorldDef {
  id: string; name: string; icon: string; tag: string; desc: string;
  s0: number; n2: number; co2: number; o2: number; pfc: number;
  ocean: number; capIce: number; aquifer: number; startT: number; rockAlb: number;
  rockLow: [number, number, number]; rockHigh: [number, number, number];
  unlockCost: number; unlockBy: string | null; vents: number; sky: string;
}
export const WORLDS: WorldDef[] = [
  {
    id: 'rusthaven', name: 'Rusthaven', icon: '🔴', tag: 'Cold desert · Tutorial-friendly',
    desc: 'A thin-aired, frozen red desert with polar ice and a deep aquifer. Warm it, thicken the air, add water, then seed the first life.',
    s0: 0.62, n2: 2, co2: 5, o2: 0, pfc: 0, ocean: 0, capIce: 0.05, aquifer: 120, startT: -58, rockAlb: 0.24,
    rockLow: [112, 60, 42], rockHigh: [186, 130, 92], unlockCost: 0, unlockBy: null, vents: 7, sky: '#c4563a',
  },
  {
    id: 'glacia', name: 'Glacia', icon: '🧊', tag: 'Snowball world · Flood risk',
    desc: 'An iceball with frozen seas and a decent atmosphere. Melt it carefully: rising seas drown coastal colonies.',
    s0: 0.78, n2: 18, co2: 1.5, o2: 0, pfc: 0, ocean: 0.36, capIce: 0.03, aquifer: 40, startT: -52, rockAlb: 0.3,
    rockLow: [86, 96, 112], rockHigh: [172, 180, 194], unlockCost: 15, unlockBy: 'rusthaven', vents: 6, sky: '#7fb6e6',
  },
  {
    id: 'cinderia', name: 'Cinderia', icon: '🟠', tag: 'Runaway greenhouse · Expert',
    desc: 'A dry, crushing CO₂ furnace at +85°C. Shade it with mirrors, scrub the sky, import water, and make the poison breathable.',
    s0: 1.32, n2: 30, co2: 42, o2: 0, pfc: 0, ocean: 0, capIce: 0, aquifer: 70, startT: 88, rockAlb: 0.2,
    rockLow: [62, 40, 36], rockHigh: [158, 104, 62], unlockCost: 30, unlockBy: 'glacia', vents: 9, sky: '#e8913a',
  },
];
export const WORLD_MAP: Record<string, WorldDef> = Object.fromEntries(WORLDS.map((w) => [w.id, w]));

export interface DiffDef {
  id: string; name: string; desc: string; charter: number; events: number; cost: number; start: number;
  winH: number; popGoal: number; fragments: number; lp: number;
}
export const DIFFS: DiffDef[] = [
  { id: 'settler', name: 'Settler', desc: 'Relaxed charter, fewer disasters, cheaper builds.', charter: 150, events: 0.6, cost: 0.85, start: 1.3, winH: 0.7, popGoal: 300, fragments: 8, lp: 0.8 },
  { id: 'engineer', name: 'Engineer', desc: 'The intended challenge.', charter: 120, events: 1, cost: 1, start: 1, winH: 0.8, popGoal: 500, fragments: 11, lp: 1 },
  { id: 'architect', name: 'Architect', desc: 'Short charter, brutal skies, expensive materials.', charter: 90, events: 1.5, cost: 1.2, start: 0.8, winH: 0.85, popGoal: 800, fragments: 15, lp: 1.6 },
];
export const DIFF_MAP: Record<string, DiffDef> = Object.fromEntries(DIFFS.map((d) => [d.id, d]));

export interface ModDef { id: string; name: string; icon: string; desc: string; lp: number }
export const MODS: ModDef[] = [
  { id: 'volatile', name: 'Volatile Skies', icon: '⛈️', desc: 'Disasters strike 80% more often.', lp: 1.3 },
  { id: 'thin', name: 'Thin Ledger', icon: '📉', desc: 'Costs +30%, half the starting resources.', lp: 1.25 },
  { id: 'short', name: 'Short Charter', icon: '⏳', desc: 'Charter shortened by 30%.', lp: 1.3 },
  { id: 'fragile', name: 'Fragile Colonies', icon: '🥀', desc: 'Colonists die twice as fast in bad conditions.', lp: 1.25 },
];

export interface PerkDef { id: string; name: string; icon: string; desc: string; max: number; cost: number }
export const PERKS: PerkDef[] = [
  { id: 'stores', name: 'Prefab Stores', icon: '📦', desc: '+60 starting materials per level.', max: 5, cost: 4 },
  { id: 'cells', name: 'Reserve Cells', icon: '🔋', desc: '+80 starting energy per level.', max: 5, cost: 4 },
  { id: 'vault', name: 'Seed Vault', icon: '🧫', desc: 'Start with Extremophile Genetics researched.', max: 1, cost: 8 },
  { id: 'library', name: 'Archive Library', icon: '📚', desc: '+10% research output per level.', max: 5, cost: 6 },
  { id: 'foresight', name: 'Foresight', icon: '🔭', desc: 'Disaster warnings arrive +2 years earlier per level.', max: 3, cost: 6 },
  { id: 'rigs', name: 'Efficient Rigs', icon: '🛠️', desc: '−5% structure costs per level.', max: 4, cost: 7 },
  { id: 'charter', name: 'Deep Charter', icon: '📜', desc: '+10 years of charter per level.', max: 3, cost: 9 },
  { id: 'contracts', name: 'Comet Contracts', icon: '🚀', desc: '−15% Comet Strike cost per level.', max: 3, cost: 8 },
];

export const STAGES = [
  { name: 'Dead World', min: 0, color: '#9a8d8d' },
  { name: 'Stirring', min: 0.05, color: '#d6a45e' },
  { name: 'Frontier', min: 0.2, color: '#c8c94f' },
  { name: 'Viable', min: 0.4, color: '#7bd26b' },
  { name: 'Verdant', min: 0.6, color: '#3fd0a0' },
  { name: 'Eden', min: 0.8, color: '#5ee0ff' },
];

export type EventKind = 'dust' | 'volcano' | 'deluge' | 'wildfire' | 'thermal' | 'meteor' | 'flare' | 'drought';
export const EVENT_INFO: Record<EventKind, { name: string; icon: string; desc: string; dur: number }> = {
  dust: { name: 'Global Dust Storm', icon: '🌪️', desc: 'Dust blots out the sun: solar output and temperatures fall. Dust darkens ice afterwards.', dur: 6 },
  volcano: { name: 'Volcanic Eruption', icon: '🌋', desc: 'Erupts CO₂ and ash, torches nearby land, destroys structures within 2 tiles.', dur: 2 },
  deluge: { name: 'Superstorm Deluge', icon: '⛈️', desc: 'Torrential rain floods the lowlands under the storm.', dur: 3 },
  wildfire: { name: 'Wildfire Outbreak', icon: '🔥', desc: 'Ignites dry forests. Worse with high O₂. Rain extinguishes it.', dur: 1 },
  thermal: { name: 'Thermal Anomaly', icon: '🌡️', desc: 'Planet-wide heat wave or cold snap.', dur: 4 },
  meteor: { name: 'Meteor Shower', icon: '🌠', desc: 'Fragments strike the surface. Intercept with the Orbital Lance.', dur: 3 },
  flare: { name: 'Solar Flare', icon: '☀️', desc: 'Power grid collapses to 20% and radiation stresses life.', dur: 2 },
  drought: { name: 'Great Drought', icon: '🏜️', desc: 'Evaporation doubles while rain nearly stops.', dur: 8 },
};

export interface MilestoneDef { id: string; name: string; desc: string; rewardR: number; rewardM: number }
export const MILESTONES: MilestoneDef[] = [
  { id: 'veil', name: 'Thin Veil', desc: 'Atmospheric pressure ≥ 15 kPa', rewardR: 25, rewardM: 0 },
  { id: 'thaw', name: 'The Thaw', desc: 'Average temperature ≥ −30°C', rewardR: 30, rewardM: 0 },
  { id: 'rain', name: 'First Rain', desc: '15+ tiles receiving rain or snow', rewardR: 30, rewardM: 60 },
  { id: 'water', name: 'Standing Water', desc: '40+ tiles of open water', rewardR: 0, rewardM: 80 },
  { id: 'green', name: 'First Green', desc: '40+ tiles of living plants', rewardR: 40, rewardM: 0 },
  { id: 'frost', name: 'Frost-Free', desc: 'Average temperature ≥ 0°C', rewardR: 40, rewardM: 40 },
  { id: 'air', name: 'Breathable Air', desc: 'O₂ ≥ 12 kPa', rewardR: 30, rewardM: 50 },
  { id: 'bio', name: 'Biodiversity', desc: '6+ biomes with 10+ tiles each', rewardR: 60, rewardM: 0 },
  { id: 'settlers', name: 'First Settlers', desc: 'Population ≥ 100', rewardR: 40, rewardM: 60 },
  { id: 'canopy', name: 'Canopy', desc: '30+ tiles of forest or rainforest', rewardR: 60, rewardM: 60 },
  { id: 'hearths', name: 'Hundred Hearths', desc: 'Population ≥ 300', rewardR: 60, rewardM: 100 },
  { id: 'garden', name: 'Garden World', desc: 'Habitability ≥ 60%', rewardR: 80, rewardM: 100 },
  { id: 'reckoning', name: 'Reckoning Survived', desc: 'Survive the cataclysm', rewardR: 100, rewardM: 150 },
  { id: 'cert', name: 'Certified Habitable', desc: 'Complete the Charter', rewardR: 0, rewardM: 0 },
];

export function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
