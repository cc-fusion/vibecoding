// Static data, types and persistence for Tectonic Shepherd

export type ToolId = 'drag' | 'tremor' | 'volcano' | 'bless' | 'tide' | 'omen' | 'sanct';

export interface ToolDef {
  id: ToolId;
  name: string;
  key: string;
  icon: string;
  resource: 'energy' | 'favor' | 'none';
  cost: number;
  cd: number;
  radius: number;
  desc: string;
  unlock: number; // insight cost, 0 = free
}

export const TOOLS: ToolDef[] = [
  { id: 'drag', name: 'Shepherd', key: '1', icon: '🤲', resource: 'none', cost: 0, cd: 0, radius: 0, unlock: 0,
    desc: 'Click and drag any plate to push it across the mantle. Costs Tectonic Energy per cell moved. Overlaps raise mountains, gaps open rifts.' },
  { id: 'tremor', name: 'Tremor', key: '2', icon: '🌋', resource: 'energy', cost: 18, cd: 3, radius: 8, unlock: 0,
    desc: 'Release stored fault stress in a controlled quake. Safe-ish venting prevents a catastrophic quake — and wounds the Titan.' },
  { id: 'volcano', name: 'Volcano', key: '3', icon: '🔥', resource: 'energy', cost: 38, cd: 10, radius: 4, unlock: 0,
    desc: 'Raise a volcano. Builds islands and mountains, and fertile ash — but lava burns settlements.' },
  { id: 'bless', name: 'Blessing', key: '4', icon: '🌱', resource: 'favor', cost: 15, cd: 2, radius: 6, unlock: 0,
    desc: 'Bless land: fertility surge for a minute, heal and cheer settlements in range.' },
  { id: 'tide', name: 'Tide', key: '5', icon: '🌊', resource: 'energy', cost: 26, cd: 4, radius: 0, unlock: 15,
    desc: 'Raise the global sea level (click) or lower it (right-click / press 5 again to flip mode). Drown threats or expose land bridges.' },
  { id: 'omen', name: 'Omen of Peace', key: '6', icon: '🕊️', resource: 'favor', cost: 25, cd: 5, radius: 3, unlock: 0,
    desc: 'Click a settlement: its tribe makes peace and warms relations with every tribe in contact.' },
  { id: 'sanct', name: 'Sanctuary', key: '7', icon: '🛡️', resource: 'favor', cost: 30, cd: 8, radius: 7, unlock: 30,
    desc: 'A dome that nullifies quakes, lava and floods for 25 seconds.' },
];

export interface TechDef {
  id: string; name: string; icon: string; tier: 1 | 2 | 3; cost: number; req: string[]; desc: string;
}

export const TECHS: TechDef[] = [
  { id: 'agri', name: 'Agriculture', icon: '🌾', tier: 1, cost: 25, req: [], desc: '+25% settlement capacity.' },
  { id: 'seafaring', name: 'Seafaring', icon: '⛵', tier: 1, cost: 25, req: [], desc: 'Fishing capacity on coasts; trade/war across up to 7 water cells.' },
  { id: 'masonry', name: 'Masonry', icon: '🧱', tier: 1, cost: 25, req: [], desc: 'Quake damage −35%.' },
  { id: 'bronze', name: 'Bronze', icon: '🛡️', tier: 1, cost: 25, req: [], desc: '+30% military strength.' },
  { id: 'writing', name: 'Writing', icon: '📜', tier: 1, cost: 25, req: [], desc: '+30% research speed.' },
  { id: 'irrigation', name: 'Irrigation', icon: '💧', tier: 2, cost: 70, req: ['agri'], desc: 'Deserts and tundra become farmable.' },
  { id: 'navigation', name: 'Navigation', icon: '🧭', tier: 2, cost: 70, req: ['seafaring'], desc: 'Cross 14 water cells; trade partners give more.' },
  { id: 'levees', name: 'Levees', icon: '🏞️', tier: 2, cost: 70, req: ['masonry'], desc: 'Flood and tsunami damage −55%.' },
  { id: 'iron', name: 'Iron', icon: '⚔️', tier: 2, cost: 70, req: ['bronze'], desc: '+50% military strength.' },
  { id: 'seismo', name: 'Seismology', icon: '📈', tier: 2, cost: 70, req: ['writing'], desc: 'Early warnings: quake damage −25%.' },
  { id: 'volcanology', name: 'Volcanology', icon: '🌋', tier: 3, cost: 160, req: ['masonry', 'writing'], desc: 'Lava damage −60%, ash doubly fertile.' },
  { id: 'law', name: 'Codified Law', icon: '⚖️', tier: 3, cost: 160, req: ['writing', 'bronze'], desc: 'Fewer wars, faster reconciliation.' },
  { id: 'works', name: 'Great Works', icon: '🏛️', tier: 3, cost: 160, req: ['irrigation', 'levees'], desc: '+10% capacity, devotion grows faster.' },
];
export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export interface TribeDef {
  id: number; name: string; icon: string; color: string; trait: string; start: string[];
  pref: Record<string, number>;
}
export const TRIBES: TribeDef[] = [
  { id: 0, name: 'Sunwalkers', icon: '☀️', color: '#ffc94a', trait: 'Farmers: +12% capacity', start: [], pref: { agri: 3, irrigation: 2, works: 1 } },
  { id: 1, name: 'Tidecallers', icon: '🐚', color: '#3fd0d4', trait: 'Mariners: start with Seafaring, flood-hardy', start: ['seafaring'], pref: { seafaring: 3, navigation: 3, levees: 2 } },
  { id: 2, name: 'Stonekin', icon: '⛰️', color: '#b79bff', trait: 'Masons: quakes hurt 20% less', start: [], pref: { masonry: 3, levees: 1, volcanology: 2 } },
  { id: 3, name: 'Emberborn', icon: '🔥', color: '#ff6a4d', trait: 'Warriors: strong military, lava-hardy, quarrelsome', start: ['bronze'], pref: { bronze: 2, iron: 3, volcanology: 2 } },
  { id: 4, name: 'Mossfolk', icon: '🍃', color: '#7bdc6b', trait: 'Seers: +20% research, peaceful', start: [], pref: { writing: 3, law: 3, seismo: 2 } },
];

export interface DiffDef {
  id: string; name: string; desc: string; freq: number; dmg: number; regen: number; goal: number; titan: number; score: number;
}
export const DIFFS: DiffDef[] = [
  { id: 'gentle', name: 'Gentle Tides', desc: 'Fewer disasters, sturdier tribes, generous energy.', freq: 0.65, dmg: 0.7, regen: 1.25, goal: 0.8, titan: 70, score: 0.8 },
  { id: 'standard', name: 'Restless Mantle', desc: 'The intended experience.', freq: 1, dmg: 1, regen: 1, goal: 1, titan: 100, score: 1 },
  { id: 'brutal', name: 'Cataclysmic', desc: 'Relentless disasters, fragile tribes, a furious Titan.', freq: 1.55, dmg: 1.35, regen: 0.85, goal: 1.2, titan: 150, score: 1.7 },
];

export interface ModDef { id: string; name: string; desc: string; bonus: number; }
export const MODS: ModDef[] = [
  { id: 'restless', name: 'Restless Earth', desc: 'Faults load 60% faster, plates drift twice as fast.', bonus: 0.25 },
  { id: 'tides', name: 'Rising Tides', desc: 'Sea level creeps upward over time.', bonus: 0.2 },
  { id: 'warlike', name: 'Warlike Tribes', desc: 'Relations sour faster; wars are more common.', bonus: 0.2 },
  { id: 'frugal', name: 'Frugal Gods', desc: 'Max energy −30%, prayers grant less favor.', bonus: 0.25 },
];

export interface UpgradeDef { id: string; name: string; icon: string; desc: string; max: number; base: number; }
export const UPGRADES: UpgradeDef[] = [
  { id: 'sinews', name: 'Titan Sinews', icon: '💪', desc: '+15 max Tectonic Energy per level.', max: 5, base: 12 },
  { id: 'springs', name: 'Mantle Springs', icon: '♨️', desc: '+10% energy regeneration per level.', max: 5, base: 12 },
  { id: 'light', name: 'Light Touch', icon: '🪶', desc: '−8% plate movement cost per level.', max: 5, base: 14 },
  { id: 'foundations', name: 'Sturdy Foundations', icon: '🏗️', desc: '−10% quake and lava damage per level.', max: 3, base: 18 },
  { id: 'flock', name: 'Devout Flock', icon: '🙏', desc: '+20% favor from prayers per level.', max: 4, base: 12 },
  { id: 'elders', name: 'Wise Elders', icon: '📚', desc: '+10% tribal research per level.', max: 3, base: 16 },
  { id: 'seed', name: 'Seed of Plenty', icon: '🌰', desc: 'All tribes begin with Agriculture.', max: 1, base: 30 },
  { id: 'seismograph', name: 'Seismograph', icon: '📡', desc: 'Mark imminent quake epicenters on the map.', max: 1, base: 25 },
];
export const upgradeCost = (u: UpgradeDef, lvl: number) => u.base * (lvl + 1);

export interface EraDef { name: string; blurb: string; pop: number; settlements: number; techs: number; tier3: boolean; min: number; }
export const ERAS: EraDef[] = [
  { name: 'Age of Dawn', blurb: 'Five tribes wake upon the shifting crust.', pop: 110, settlements: 7, techs: 0, tier3: false, min: 45 },
  { name: 'Age of Bronze', blurb: 'Metal, trade and the first wars.', pop: 260, settlements: 10, techs: 4, tier3: false, min: 55 },
  { name: 'Age of Iron', blurb: 'Cities rise. The mantle grows restless.', pop: 450, settlements: 14, techs: 10, tier3: false, min: 60 },
  { name: 'Age of Empires', blurb: 'Great works tempt the gods.', pop: 650, settlements: 18, techs: 16, tier3: true, min: 60 },
  { name: 'The Cataclysm', blurb: 'The Titan Beneath awakens.', pop: 0, settlements: 0, techs: 0, tier3: false, min: 0 },
];

// ---------- runtime entity types ----------
export interface Settlement {
  id: number; tribe: number; plate: number; lx: number; ly: number; x: number; y: number; rx: number; ry: number;
  pop: number; K: number; name: string; expandCd: number; hit: number; prayCd: number; bad: number; born: number;
}
export interface Tribe {
  id: number; alive: boolean; knowledge: number; techs: Record<string, boolean>; focus: string | null; current: string | null;
  devotion: number; rel: number[]; war: boolean[]; contact: boolean[]; trade: boolean[]; pop: number; nset: number; rate: number;
  danger: { quake: number; flood: number; lava: number; war: number; dry: number }; lost: number; peakPop: number;
}
export interface Volcano {
  id: number; x: number; y: number; state: 'rising' | 'erupting' | 'dormant'; t: number; dur: number; budget: number;
  front: number[]; cone: number; step: number; next: number; player: boolean; power: number;
}
export interface Tsunami { x: number; y: number; r: number; maxR: number; str: number; hit: Set<number>; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; add: boolean; }
export interface FloatText { x: number; y: number; text: string; color: string; life: number; max: number; size: number; }
export interface Prayer { id: number; sid: number; t: number; ttl: number; }
export interface Sanct { x: number; y: number; r: number; t: number; max: number; }
export interface Ring { x: number; y: number; r: number; max: number; color: string; life: number; maxLife: number; w: number; }
export interface Titan { x: number; y: number; hp: number; max: number; phase: number; pulseT: number; tele: number; dead: boolean; deadT: number; born: number; }
export interface LogEntry { t: number; text: string; kind: 'info' | 'bad' | 'good' | 'war' | 'era'; }
export interface Link { a: number; b: number; ta: number; tb: number; sea: boolean; }
export interface PendingEvent { kind: string; t: number; x: number; y: number; }

export interface Stats {
  time: number; peakPop: number; deaths: number; quakes: number; maxMag: number; eruptions: number; tsunamis: number;
  wars: number; techs: number; founded: number; lost: number; prayers: number; dist: number; titanDmg: number; tribesAlive: number;
}

export interface RunConfig { diff: string; mods: string[]; tutorial: boolean; seed?: number; }

export interface EndResult {
  victory: boolean; score: number; insight: number; stats: Stats; era: number; diff: string; mods: string[]; newBest: boolean; reason: string;
}

// ---------- persistence ----------
export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; lines: boolean; }
export interface SaveData {
  insight: number; upgrades: Record<string, number>; unlocked: string[]; best: number; runs: number; wins: number;
  settings: Settings; diff: string; mods: string[]; tutorialDone: boolean;
}
const KEY = 'tectonic-shepherd-v1';
export const defaultSave = (): SaveData => ({
  insight: 0, upgrades: {}, unlocked: [], best: 0, runs: 0, wins: 0,
  settings: { master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: true, lines: true },
  diff: 'standard', mods: [], tutorialDone: false,
});
let memory: SaveData | null = null;
export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) } };
    }
  } catch { /* storage unavailable */ }
  return memory ? { ...memory } : d;
}
export function writeSave(s: SaveData) {
  memory = { ...s };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
