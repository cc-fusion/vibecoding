export const WORLD_W = 3600;
export const WORLD_H = 2400;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const fmt = (n: number) => Math.floor(Number.isFinite(n) ? n : 0).toLocaleString('en-US');
export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
export function angLerp(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/* ---------- Resources ---------- */
export type Res = 'scrap' | 'alloy' | 'cores' | 'data' | 'relics';
export const RES_LIST: Res[] = ['scrap', 'alloy', 'cores', 'data', 'relics'];
export const RES_INFO: Record<Res, { name: string; icon: string; base: number; color: string; impact: number }> = {
  scrap: { name: 'Scrap', icon: '🔩', base: 2, color: '#9aa7b8', impact: 0.004 },
  alloy: { name: 'Alloy', icon: '🧱', base: 6, color: '#f2b35e', impact: 0.012 },
  cores: { name: 'Power Cores', icon: '🔋', base: 15, color: '#5ef2c0', impact: 0.02 },
  data: { name: 'Data Shards', icon: '💾', base: 22, color: '#6fb1ff', impact: 0.03 },
  relics: { name: 'Relics', icon: '🏺', base: 95, color: '#e58bff', impact: 0.07 },
};
export type ResBag = Record<Res, number>;
export const emptyBag = (): ResBag => ({ scrap: 0, alloy: 0, cores: 0, data: 0, relics: 0 });
export const bagUnits = (b: ResBag) => b.scrap + b.alloy + b.cores + b.data + b.relics;
export const bagValue = (b: ResBag) => RES_LIST.reduce((s, r) => s + b[r] * RES_INFO[r].base, 0);

/* ---------- Factions ---------- */
export interface FactionDef {
  id: number;
  name: string;
  tag: string;
  color: string;
  desc: string;
  friendly: string;
  hostile: string;
  bx: number;
  by: number;
}
export const FACTIONS: FactionDef[] = [
  { id: 0, name: 'Your Syndicate', tag: 'YOU', color: '#4de1ff', desc: '', friendly: '', hostile: '', bx: WORLD_W / 2, by: WORLD_H / 2 + 80 },
  {
    id: 1, name: 'Ironclad Combine', tag: 'ICC', color: '#ff6b57',
    desc: 'Militarised claim-jumpers. Heavy gunships, fond of other people\'s wrecks.',
    friendly: 'Allied: shipyard prices -10%.', hostile: 'Hostile: periodic gunship raids on your station.', bx: 380, by: 380,
  },
  {
    id: 2, name: 'Verdant Reclaimers', tag: 'VRC', color: '#6dff8a',
    desc: 'Eco-merchants who control half the commodity exchanges.',
    friendly: 'Allied: +8% on every sale.', hostile: 'Hostile: price embargoes on your goods.', bx: WORLD_W - 380, by: 380,
  },
  {
    id: 3, name: 'Void Magpies', tag: 'VMP', color: '#e58bff',
    desc: 'Thieves with fast tugs. They hijack wrecks that are being towed.',
    friendly: 'Allied: crew hired from them is 20% cheaper and they stop thieving.', hostile: 'Hostile: hijack tugs target your tows.', bx: 380, by: WORLD_H - 380,
  },
  { id: 4, name: 'Maw Pirates', tag: 'PIR', color: '#ffc933', desc: 'Raiders at war with everyone.', friendly: '', hostile: '', bx: WORLD_W - 300, by: WORLD_H - 300 },
];

/* ---------- Ships ---------- */
export type ShipKind =
  | 'tug' | 'cutter' | 'gunship' | 'scout' | 'hauler' | 'frigate'
  | 'raider' | 'bomber' | 'sentry' | 'mine' | 'boss';
export interface ShipDef {
  name: string; icon: string; hp: number; speed: number; tow: number; beam: number; cut: number; cargo: number;
  dps: number; range: number; rate: number; shot: number; scan: number; cost: number; radius: number; fuel: number; desc: string;
  color: string;
}
export const SHIPS: Record<ShipKind, ShipDef> = {
  tug: { name: 'Tractor Tug', icon: '🛰️', hp: 70, speed: 110, tow: 60, beam: 130, cut: 0, cargo: 0, dps: 0, range: 0, rate: 1, shot: 0, scan: 170, cost: 260, radius: 11, fuel: 0.002, desc: 'Tows whole wrecks home with a tractor beam. Several tugs can share a heavy load.', color: '#4de1ff' },
  cutter: { name: 'Plasma Cutter', icon: '🔥', hp: 65, speed: 120, tow: 0, beam: 0, cut: 12, cargo: 36, dps: 0, range: 0, rate: 1, shot: 0, scan: 170, cost: 300, radius: 10, fuel: 0.002, desc: 'Strips wrecks in place and hauls the loot home. Slower yield, no tug needed.', color: '#ffa44d' },
  gunship: { name: 'Gunship', icon: '🚀', hp: 130, speed: 135, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 20, range: 230, rate: 0.45, shot: 520, scan: 210, cost: 420, radius: 12, fuel: 0.0025, desc: 'Escort and defence. Kills raiders, sentries and mines; breaks hijack attempts.', color: '#8dffb0' },
  scout: { name: 'Survey Scout', icon: '📡', hp: 40, speed: 215, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 0, range: 0, rate: 1, shot: 0, scan: 460, cost: 170, radius: 8, fuel: 0.0015, desc: 'Fast, huge sensor radius. Reveals hidden wrecks and lifts the fog.', color: '#d6f27a' },
  hauler: { name: 'Heavy Hauler', icon: '🚛', hp: 170, speed: 90, tow: 190, beam: 170, cut: 0, cargo: 0, dps: 0, range: 0, rate: 1, shot: 0, scan: 180, cost: 700, radius: 15, fuel: 0.0035, desc: 'Triple-strength tractor array. Essential for hulks like the Leviathan.', color: '#6fb1ff' },
  frigate: { name: 'Frigate', icon: '⚔️', hp: 300, speed: 105, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 40, range: 300, rate: 0.4, shot: 560, scan: 240, cost: 950, radius: 17, fuel: 0.004, desc: 'Heavy warship with long-range guns. The backbone of a late-game fleet.', color: '#ffd36e' },
  raider: { name: 'Pirate Raider', icon: '', hp: 48, speed: 155, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 11, range: 190, rate: 0.5, shot: 430, scan: 300, cost: 0, radius: 9, fuel: 0, desc: '', color: '#ffc933' },
  bomber: { name: 'Pirate Bomber', icon: '', hp: 130, speed: 90, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 22, range: 170, rate: 1.4, shot: 260, scan: 300, cost: 0, radius: 13, fuel: 0, desc: '', color: '#ff9a33' },
  sentry: { name: 'Sentry Turret', icon: '', hp: 80, speed: 0, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 13, range: 270, rate: 0.7, shot: 400, scan: 0, cost: 0, radius: 12, fuel: 0, desc: '', color: '#ff5a5a' },
  mine: { name: 'Proximity Mine', icon: '', hp: 5, speed: 0, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 0, range: 0, rate: 1, shot: 0, scan: 0, cost: 0, radius: 8, fuel: 0, desc: '', color: '#ff5a5a' },
  boss: { name: 'Dreadnought MAW', icon: '', hp: 3600, speed: 60, tow: 0, beam: 0, cut: 0, cargo: 0, dps: 18, range: 460, rate: 2, shot: 340, scan: 600, cost: 0, radius: 48, fuel: 0, desc: '', color: '#ff7a2f' },
};
export const BUILDABLE: ShipKind[] = ['tug', 'cutter', 'gunship', 'scout', 'hauler', 'frigate'];
export type Spec = 'pilot' | 'rigger' | 'gunner';
export const ROLE_SPEC: Partial<Record<ShipKind, Spec>> = {
  tug: 'rigger', hauler: 'rigger', cutter: 'rigger', gunship: 'gunner', frigate: 'gunner', scout: 'pilot',
};
export const SPEC_INFO: Record<Spec, { name: string; icon: string; desc: string }> = {
  pilot: { name: 'Pilot', icon: '🧭', desc: 'Faster ship' },
  rigger: { name: 'Rigger', icon: '⚓', desc: 'Stronger tow & cut' },
  gunner: { name: 'Gunner', icon: '🎯', desc: 'More damage' },
};

export type Trait = 'steady' | 'reckless' | 'haggler' | 'scrapper' | 'veteran' | 'turncoat';
export const TRAITS: Record<Trait, { name: string; desc: string }> = {
  steady: { name: 'Steady', desc: 'Unfazed by losses: ignores fear.' },
  reckless: { name: 'Reckless', desc: '+12% speed, takes +20% damage.' },
  haggler: { name: 'Haggler', desc: '+4% sale prices (max 3 stack).' },
  scrapper: { name: 'Scrapper', desc: '+12% yield on loot they deliver.' },
  veteran: { name: 'Veteran', desc: '+1 skill. Wants more pay.' },
  turncoat: { name: 'Turncoat', desc: 'Defects with your cash if their old faction hates you.' },
};
export interface Crew {
  id: number; name: string; spec: Spec; skill: number; xp: number; morale: number; wage: number;
  trait: Trait; origin: number; ship: number | null; kills: number;
}
export const FIRST = ['Ash', 'Brin', 'Cato', 'Dara', 'Edda', 'Finn', 'Gus', 'Hale', 'Ines', 'Jax', 'Kira', 'Lio', 'Mara', 'Nox', 'Orin', 'Pia', 'Quill', 'Rook', 'Sable', 'Tam', 'Uma', 'Vex', 'Wren', 'Yara', 'Zed'];
export const LAST = ['Voss', 'Karn', 'Mbeki', 'Ortega', 'Lund', 'Hartigan', 'Okoye', 'Strand', 'Pike', 'Duval', 'Ivanov', 'Reyes', 'Tanaka', 'Brandt'];

/* ---------- Entities ---------- */
export interface Order { t: 'idle' | 'move' | 'tow' | 'cut' | 'attack' | 'return'; x: number; y: number; id: number }
export const idleOrder = (): Order => ({ t: 'idle', x: 0, y: 0, id: 0 });
export interface Ship {
  id: number; faction: number; kind: ShipKind; x: number; y: number; vx: number; vy: number; ang: number;
  hp: number; maxHp: number; crew: number | null; order: Order; auto: boolean; manual: boolean;
  cargo: ResBag; cd: number; flash: number; attached: number; ai: string; t: number; stall: number; target: number;
  disabled: number; vis: boolean; temp: boolean; life: number; resume: number; moved: boolean; aux: number[];
  blk: Map<number, number>; dead: boolean; name: string;
}
export type WreckKind = 'hull' | 'cargo' | 'reactor' | 'vault' | 'relic' | 'leviathan';
export interface Wreck {
  id: number; x: number; y: number; vx: number; vy: number; rot: number; rv: number; r: number; mass: number;
  kind: WreckKind; name: string; loot: ResBag; value0: number; revealed: boolean; owner: number; instab: number;
  tugs: number[]; pts: number[]; special: '' | 'prize' | 'leviathan' | 'maw' | 'debris'; poached: number[]; fade: number;
  speed: number; leader: number; cutting: number; stalled: boolean;
}
export const WRECK_INFO: Record<WreckKind, { name: string; color: string; glow: string }> = {
  hull: { name: 'Hull Wreck', color: '#5b6b82', glow: '#9aa7b8' },
  cargo: { name: 'Cargo Barge', color: '#8a6a3a', glow: '#f2b35e' },
  reactor: { name: 'Reactor Hulk', color: '#2f8f7a', glow: '#5ef2c0' },
  vault: { name: 'Data Vault', color: '#3a6fb0', glow: '#6fb1ff' },
  relic: { name: 'Relic Ship', color: '#a0589c', glow: '#e58bff' },
  leviathan: { name: 'The Leviathan', color: '#6b5a7a', glow: '#ffd36e' },
};
export interface Station { x: number; y: number; r: number; hp: number; maxHp: number; cd: number; flash: number; rot: number }
export interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; faction: number; life: number; color: string; r: number; src: number; big: boolean }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'ring' | 'debris'; grow: number }
export interface FText { x: number; y: number; text: string; color: string; life: number; size: number }
export interface LogMsg { id: number; text: string; color: string; t: number }
export interface Ping { x: number; y: number; t: number; color: string }
export interface Storm { x: number; y: number; vx: number; vy: number; r: number; until: number }
export interface Meteor { x: number; y: number; t: number; r: number }
export interface MarketEvent { id: number; text: string; res: Res | 'fuel'; mult: number; until: number }
export interface Market {
  demand: ResBag; impact: ResBag; hist: Record<Res, number[]>; events: MarketEvent[]; tickT: number; fuelBase: number;
}
export interface Contract { id: number; faction: number; res: Res; qty: number; reward: number; rel: number; deadline: number }
export interface Auction { id: number; wreckId: number; bid: number; bidder: number; end: number; bidderName: string }
export interface RivalState { credits: number; spawnT: number; raidT: number; embargoT: number; delivered: number }

export interface Stats {
  delivered: number; towed: number; cut: number; kills: number; lost: number; earned: number; spent: number;
  raids: number; repelled: number; claims: number; auctions: number; contracts: number; sells: number; hires: number;
  labBuys: number; towOrders: number; cutOrders: number; autoToggles: number; stolen: number; poached: number;
  sectors: number; bossKilled: boolean; peakFleet: number; wagesPaid: number; selects: number; bossDamage: number;
}
export const emptyStats = (): Stats => ({
  delivered: 0, towed: 0, cut: 0, kills: 0, lost: 0, earned: 0, spent: 0, raids: 0, repelled: 0, claims: 0, auctions: 0,
  contracts: 0, sells: 0, hires: 0, labBuys: 0, towOrders: 0, cutOrders: 0, autoToggles: 0, stolen: 0, poached: 0,
  sectors: 0, bossKilled: false, peakFleet: 0, wagesPaid: 0, selects: 0, bossDamage: 0,
});

export interface RunResult {
  kind: 'won' | 'lost' | 'sector' | 'trained';
  reason: string; score: number; renown: number; sector: number; time: number; stats: Stats; diff: string;
}

/* ---------- Sectors ---------- */
export interface SectorDef {
  id: number; name: string; blurb: string; quota: number; time: number; wrecks: number; raid: number;
  rivalTugs: number; rivalGuns: number; guarded: number; events: number; boss: boolean;
}
export const SECTORS: SectorDef[] = [
  { id: 0, name: 'Training Yard', blurb: 'A quiet scrapyard where the Syndicate trains rookies. No clock, no real danger.', quota: 700, time: 0, wrecks: 16, raid: 0, rivalTugs: 0, rivalGuns: 0, guarded: 0, events: 0, boss: false },
  { id: 1, name: 'Cinder Shallows', blurb: 'Fresh battlefield debris. Rivals are scouting; pirates are only curious.', quota: 1500, time: 360, wrecks: 26, raid: 100, rivalTugs: 1, rivalGuns: 1, guarded: 0.1, events: 0.5, boss: false },
  { id: 2, name: 'Gravewake Drift', blurb: 'A graveyard of capital ships. Sentries guard the best hulks and ion storms roll in.', quota: 3000, time: 420, wrecks: 32, raid: 80, rivalTugs: 2, rivalGuns: 1, guarded: 0.25, events: 1, boss: false },
  { id: 3, name: 'Magpie Reach', blurb: 'The Void Magpies own these lanes. Guard every tow or lose it.', quota: 4800, time: 480, wrecks: 36, raid: 68, rivalTugs: 3, rivalGuns: 2, guarded: 0.3, events: 1.2, boss: false },
  { id: 4, name: 'Iron Tide', blurb: 'The Combine is mobilising. Minefields, bombers, and a gold rush for relics.', quota: 7000, time: 540, wrecks: 40, raid: 58, rivalTugs: 3, rivalGuns: 3, guarded: 0.35, events: 1.4, boss: false },
  { id: 5, name: 'The Leviathan', blurb: 'A dead titan drifts here, and the pirate warlord MAW guards it. Haul it home to end the war.', quota: 0, time: 780, wrecks: 30, raid: 70, rivalTugs: 2, rivalGuns: 2, guarded: 0.3, events: 1.2, boss: true },
];
export function sectorDef(i: number): SectorDef {
  if (i <= 5) return SECTORS[Math.max(0, i)];
  const e = i - 5;
  const b = SECTORS[4];
  return { ...b, id: i, name: `Deepfield ${e}`, blurb: 'Endless salvage beyond the charted lanes. Everything gets worse.', quota: Math.round(b.quota * (1 + 0.3 * e)), raid: Math.max(30, b.raid - 4 * e), rivalGuns: b.rivalGuns + Math.floor(e / 2), time: 560 + e * 20 };
}

/* ---------- Difficulty ---------- */
export interface DiffDef { id: string; name: string; desc: string; hp: number; dmg: number; raid: number; credits: number; quota: number; renown: number; price: number; time: number }
export const DIFFS: Record<string, DiffDef> = {
  cadet: { id: 'cadet', name: 'Cadet', desc: 'Weaker enemies, rarer raids, generous start. Renown x0.8.', hp: 0.75, dmg: 0.7, raid: 1.35, credits: 1.3, quota: 0.85, renown: 0.8, price: 1.1, time: 1.15 },
  operator: { id: 'operator', name: 'Operator', desc: 'The intended experience.', hp: 1, dmg: 1, raid: 1, credits: 1, quota: 1, renown: 1, price: 1, time: 1 },
  warlord: { id: 'warlord', name: 'Warlord', desc: 'Tough enemies, frequent raids, high quotas, thin margins. Renown x1.6.', hp: 1.35, dmg: 1.3, raid: 0.7, credits: 0.8, quota: 1.2, renown: 1.6, price: 0.92, time: 0.95 },
};
export const MODS: { id: string; name: string; icon: string; desc: string }[] = [
  { id: 'feud', name: 'Blood Feud', icon: '🩸', desc: 'All rival syndicates start hostile (-45). Renown +25%.' },
  { id: 'lean', name: 'Lean Times', icon: '🪫', desc: 'Half starting credits and double fuel prices. Renown +25%.' },
  { id: 'storm', name: 'Storm Season', icon: '⛈️', desc: 'Twice as many ion storms, meteors and market swings. Renown +25%.' },
];

/* ---------- Lab (in-run research) ---------- */
export interface LabDef { id: string; name: string; icon: string; desc: string; max: number }
export const LAB: LabDef[] = [
  { id: 'tow', name: 'Tractor Arrays', icon: '🧲', desc: '+22% tow capacity and +12% beam range per level.', max: 3 },
  { id: 'cut', name: 'Plasma Cutters', icon: '🔥', desc: '+28% cutting speed and +20% cargo hold per level.', max: 3 },
  { id: 'engine', name: 'Ion Drives', icon: '⚡', desc: '+9% speed and -8% fuel burn per level.', max: 3 },
  { id: 'hull', name: 'Hull Plating', icon: '🛡️', desc: '+25% hull on all ships per level.', max: 3 },
  { id: 'guns', name: 'Gun Batteries', icon: '💥', desc: '+22% weapon damage per level.', max: 3 },
  { id: 'scan', name: 'Sensor Arrays', icon: '📡', desc: '+25% scan radius per level.', max: 3 },
  { id: 'yield', name: 'Refinery Tuning', icon: '⚗️', desc: '+7% yield on every delivery per level.', max: 3 },
  { id: 'station', name: 'Fortify Station', icon: '🏰', desc: '+30% station hull and +25% turret damage per level.', max: 3 },
];
export const labCost = (lvl: number) => [350, 700, 1200][lvl] ?? 99999;
export const labData = (lvl: number) => [2, 5, 9][lvl] ?? 99;

/* ---------- Meta (Archives) ---------- */
export interface MetaDef { id: string; name: string; icon: string; desc: string; max: number; base: number; step: number }
export const META: MetaDef[] = [
  { id: 'credits', name: 'Seed Capital', icon: '💰', desc: '+150 starting credits per level.', max: 5, base: 3, step: 2 },
  { id: 'tether', name: 'Reinforced Tethers', icon: '🧲', desc: '+8% tow capacity per level.', max: 5, base: 3, step: 2 },
  { id: 'haggle', name: 'Brokerage License', icon: '📈', desc: '+3% sale prices per level.', max: 5, base: 4, step: 2 },
  { id: 'plating', name: 'Station Plating', icon: '🏰', desc: '+15% station hull per level.', max: 4, base: 3, step: 2 },
  { id: 'recruit', name: 'Headhunters', icon: '🧑‍🚀', desc: 'Bigger, better crew pool (+1 candidate, +skill at lvl 2+).', max: 3, base: 4, step: 3 },
  { id: 'sensors', name: 'Deep Scanners', icon: '📡', desc: '+10% scan radius per level.', max: 4, base: 3, step: 2 },
  { id: 'diplomat', name: 'Old Friends', icon: '🤝', desc: '+8 starting relations with all rivals per level.', max: 4, base: 3, step: 2 },
  { id: 'holds', name: 'Bigger Holds', icon: '📦', desc: '+10% cutter cargo, +1 fleet cap per 2 levels.', max: 4, base: 3, step: 2 },
  { id: 'hauler', name: 'Unlock: Heavy Hauler', icon: '🚛', desc: 'Adds the Heavy Hauler to the shipyard.', max: 1, base: 8, step: 0 },
  { id: 'frigate', name: 'Unlock: Frigate', icon: '⚔️', desc: 'Adds the Frigate warship to the shipyard.', max: 1, base: 12, step: 0 },
];
export const metaCost = (d: MetaDef, lvl: number) => d.base + d.step * lvl;

/* ---------- Boons ---------- */
export const BOONS: { id: string; name: string; icon: string; desc: string }[] = [
  { id: 'cash', name: 'Syndicate Bonus', icon: '💰', desc: '+700 credits.' },
  { id: 'gunship', name: 'Veteran Escort', icon: '🛡️', desc: 'A free gunship with a skilled captain joins your fleet.' },
  { id: 'diplomacy', name: 'Peace Envoys', icon: '🕊️', desc: '+20 relations with all rival syndicates and heat reset.' },
  { id: 'cache', name: 'Vault Cache', icon: '💾', desc: '+14 Data Shards and +2 Relics.' },
  { id: 'plating', name: 'Reinforced Hulls', icon: '🧱', desc: '+20% hull on all ships, permanently.' },
  { id: 'winch', name: 'Overdrive Winches', icon: '⚓', desc: '+15% tow capacity, permanently.' },
  { id: 'fuel', name: 'Fuel Tanker', icon: '⛽', desc: '+250 fuel.' },
  { id: 'thrust', name: 'Afterburner Kits', icon: '🚀', desc: '+8% ship speed and +10% damage.' },
];

export type Tab = 'fleet' | 'market' | 'rights' | 'crew' | 'lab' | 'diplo';
export const TABS: { id: Tab; name: string; key: string; icon: string }[] = [
  { id: 'fleet', name: 'Fleet', key: 'B', icon: '🚀' },
  { id: 'market', name: 'Market', key: 'M', icon: '💱' },
  { id: 'rights', name: 'Rights', key: 'K', icon: '📜' },
  { id: 'crew', name: 'Crew', key: 'C', icon: '🧑‍🚀' },
  { id: 'lab', name: 'Lab', key: 'U', icon: '🔬' },
  { id: 'diplo', name: 'Factions', key: 'F', icon: '🏴' },
];
