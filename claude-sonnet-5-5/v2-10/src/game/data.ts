// Static game data, types and helpers for "Kaiju Insurance Adjuster"

export const W = 18;
export const H = 11;
export const LAND_H = 10;
export const MAX_DAY = 12;

export type BType = 'house' | 'apt' | 'office' | 'factory' | 'mall' | 'hospital' | 'landmark';
export type Cause = 'stomp' | 'fire' | 'flood' | 'quake' | 'collateral';
export type KKind = 'stomper' | 'pyro' | 'tide' | 'sky' | 'burrow' | 'boss';
export type DType = 'artillery' | 'flak' | 'tesla' | 'beacon' | 'firestation' | 'seawall' | 'damper';
export type Phase = 'briefing' | 'attack' | 'claims' | 'report';
export type TileKind = 'road' | 'park' | 'lot' | 'water';

export interface Vec {
  x: number;
  y: number;
}

export const BT: Record<
  BType,
  { name: string; value: number; pop: number; hp: number; h: number; top: string; side: string; flam: number }
> = {
  house: { name: 'Townhouse', value: 30, pop: 4, hp: 40, h: 0.34, top: '#e9b98c', side: '#b5845a', flam: 0.9 },
  apt: { name: 'Apartments', value: 80, pop: 14, hp: 70, h: 0.72, top: '#dca6a6', side: '#a86f6f', flam: 0.6 },
  office: { name: 'Office Tower', value: 140, pop: 8, hp: 90, h: 1.15, top: '#a6c8ea', side: '#6b8fb5', flam: 0.35 },
  factory: { name: 'Factory', value: 110, pop: 5, hp: 80, h: 0.55, top: '#b5b5a3', side: '#7d7d6e', flam: 1 },
  mall: { name: 'Shopping Mall', value: 120, pop: 10, hp: 70, h: 0.45, top: '#cba4de', side: '#9068a3', flam: 0.6 },
  hospital: { name: 'Hospital', value: 160, pop: 20, hp: 100, h: 0.85, top: '#f4f4f4', side: '#c4c9cf', flam: 0.3 },
  landmark: { name: 'Landmark', value: 260, pop: 2, hp: 160, h: 1.55, top: '#f6d860', side: '#c29d2f', flam: 0.3 },
};

export const DISTRICTS = [
  { name: 'Old Quarter', weights: { house: 0.45, apt: 0.3, mall: 0.15, office: 0.1 } },
  { name: 'Capital Row', weights: { office: 0.5, apt: 0.2, mall: 0.15, house: 0.05, hospital: 0.1 } },
  { name: 'Mill District', weights: { factory: 0.55, house: 0.25, apt: 0.1, office: 0.1 } },
  { name: 'Harbor Strip', weights: { factory: 0.3, mall: 0.25, apt: 0.25, house: 0.2 } },
  { name: 'Garden Terrace', weights: { house: 0.6, apt: 0.2, hospital: 0.08, mall: 0.12 } },
  { name: 'Neon Mile', weights: { mall: 0.35, office: 0.3, apt: 0.3, house: 0.05 } },
] as { name: string; weights: Partial<Record<BType, number>> }[];

export const districtOf = (x: number, y: number) => (y < 5 ? 0 : 1) * 3 + Math.min(2, Math.max(0, Math.floor(x / 6)));

export const DEFS: Record<
  DType,
  { name: string; cost: number; range: number; icon: string; key: string; hp: number; desc: string; req: string | null }
> = {
  artillery: {
    name: 'Artillery Battery', cost: 140, range: 4.5, icon: '💥', key: '1', hp: 90, req: null,
    desc: 'Heavy shells. Great vs ground kaiju, poor vs fliers. Stray shells cause collateral claims.',
  },
  beacon: {
    name: 'Decoy Beacon', cost: 70, range: 4.5, icon: '📡', key: '2', hp: 40, req: null,
    desc: 'Lures kaiju off course. Consumed when devoured (stuns the beast 2.6s). Bosses resist.',
  },
  firestation: {
    name: 'Fire Station', cost: 90, range: 3.2, icon: '🚒', key: '3', hp: 80, req: null,
    desc: 'Extinguishes burning blocks and makes ignition much less likely nearby.',
  },
  flak: {
    name: 'Flak Battery', cost: 110, range: 4.0, icon: '🎯', key: '4', hp: 70, req: 'flak',
    desc: 'Rapid fire. Triple damage vs fliers, weak vs ground.',
  },
  seawall: {
    name: 'Sea Wall', cost: 100, range: 3.0, icon: '🌊', key: '5', hp: 120, req: 'seawall',
    desc: 'Tidal surges cannot flood tiles within its radius.',
  },
  damper: {
    name: 'Seismic Damper', cost: 130, range: 3.0, icon: '🌀', key: '6', hp: 100, req: 'damper',
    desc: 'Cuts quake and shockwave damage by 70% within its radius.',
  },
  tesla: {
    name: 'Tesla Pylon', cost: 260, range: 3.0, icon: '⚡', key: '7', hp: 100, req: 'tesla',
    desc: 'Chain lightning with a chance to stun. The best close-range killer.',
  },
};
export const DEF_ORDER: DType[] = ['artillery', 'beacon', 'firestation', 'flak', 'seawall', 'damper', 'tesla'];

export const KAIJU: Record<
  KKind,
  {
    name: string; title: string; hp: number; speed: number; radius: number; dps: number; flying: boolean;
    color: string; accent: string; desc: string; weak: string; icon: string; size: number;
  }
> = {
  stomper: {
    name: 'Gorgrath', title: 'The Footfall', hp: 420, speed: 0.55, radius: 1.1, dps: 42, flying: false,
    color: '#6b8f4e', accent: '#d4e58c', icon: '🦖', size: 1.1,
    desc: 'Plods straight at the densest block. Seismic SLAM every few seconds crushes a ring around it.',
    weak: 'Artillery, Tesla',
  },
  pyro: {
    name: 'Pyrovore', title: 'Ember Tyrant', hp: 380, speed: 0.6, radius: 0.95, dps: 26, flying: false,
    color: '#b8452e', accent: '#ffb347', icon: '🐉', size: 1.0,
    desc: 'Heads for factories. FIRE BREATH ignites a 4-tile line; flames leap between buildings.',
    weak: 'Fire Stations, Artillery',
  },
  tide: {
    name: 'Tidemaw', title: 'Bay Leviathan', hp: 520, speed: 0.5, radius: 1.05, dps: 30, flying: false,
    color: '#2f7f9c', accent: '#9be7ff', icon: '🐙', size: 1.15,
    desc: 'Rises from the bay. TIDAL SURGES flood wide areas — only flood-rider policies pay out.',
    weak: 'Sea Walls, Tesla',
  },
  sky: {
    name: 'Skyrend', title: 'Storm Wyvern', hp: 300, speed: 1.0, radius: 0.8, dps: 20, flying: true,
    color: '#7a5aa6', accent: '#e6c8ff', icon: '🦅', size: 0.95,
    desc: 'Erratic flier visiting two targets. DIVE STRIKES carve a line. Artillery mostly misses it.',
    weak: 'Flak, Tesla',
  },
  burrow: {
    name: 'Delvemaw', title: 'Undermother', hp: 450, speed: 0.7, radius: 0.9, dps: 28, flying: false,
    color: '#8a6a42', accent: '#f0cf96', icon: '🪱', size: 1.0,
    desc: 'Tunnels under the streets — untargetable while buried. Surfaces with SHOCKWAVES (quake riders).',
    weak: 'Seismic Dampers, Tesla',
  },
  boss: {
    name: 'OMEGA', title: 'Mother of Ruin', hp: 3600, speed: 0.42, radius: 1.6, dps: 55, flying: false,
    color: '#3b2a55', accent: '#ff4d6d', icon: '👹', size: 1.9,
    desc: 'Capstone catastrophe. Cycles breath, surge, shockwave and slam. Enrages at 66% and 33% HP.',
    weak: 'Everything you have',
  },
};

export interface ResearchNode {
  id: string; name: string; desc: string; cost: number; req?: string; branch: string; icon: string;
}
export const RESEARCH: ResearchNode[] = [
  { id: 'seis1', name: 'Seismograph Net', desc: '+11% forecast accuracy.', cost: 3, branch: 'Forecast', icon: '📈' },
  { id: 'seis2', name: 'Satellite Telemetry', desc: '+11% forecast accuracy.', cost: 5, req: 'seis1', branch: 'Forecast', icon: '🛰️' },
  { id: 'seis3', name: 'Oracle Engine', desc: '+11% forecast accuracy.', cost: 8, req: 'seis2', branch: 'Forecast', icon: '🔮' },
  { id: 'flak', name: 'Flak Doctrine', desc: 'Unlocks Flak Batteries.', cost: 3, branch: 'Defense', icon: '🎯' },
  { id: 'seawall', name: 'Coastal Engineering', desc: 'Unlocks Sea Walls.', cost: 3, branch: 'Defense', icon: '🌊' },
  { id: 'damper', name: 'Geo-Stabilizers', desc: 'Unlocks Seismic Dampers.', cost: 4, branch: 'Defense', icon: '🌀' },
  { id: 'tesla', name: 'Tesla Grid', desc: 'Unlocks Tesla Pylons.', cost: 6, req: 'flak', branch: 'Defense', icon: '⚡' },
  { id: 'ordnance', name: 'Hardened Ordnance', desc: 'All turret damage +25%.', cost: 5, branch: 'Defense', icon: '🔩' },
  { id: 'autoload', name: 'Autoloaders', desc: 'Turret reload 20% faster.', cost: 6, req: 'ordnance', branch: 'Defense', icon: '⚙️' },
  { id: 'invest', name: 'Field Investigators', desc: '+2 investigations per day.', cost: 3, branch: 'Claims', icon: '🕵️' },
  { id: 'forensic', name: 'Forensic Lab', desc: 'Sharper damage assessments; investigations cost less.', cost: 4, req: 'invest', branch: 'Claims', icon: '🔬' },
  { id: 'fraudai', name: 'Anomaly Highlighter', desc: 'Suspicious claim fields glow red.', cost: 5, req: 'forensic', branch: 'Claims', icon: '🚨' },
  { id: 'reins', name: 'Reinsurance Treaty', desc: 'All payouts reduced by 12%.', cost: 5, branch: 'Finance', icon: '📜' },
  { id: 'actuary', name: 'Actuarial Tables', desc: 'Premium income +18%.', cost: 4, branch: 'Finance', icon: '🧮' },
  { id: 'pr', name: 'PR Department', desc: '+10% evacuation compliance, +1 trust each day.', cost: 4, branch: 'Finance', icon: '📣' },
  { id: 'shelters', name: 'Public Shelters', desc: 'Casualties reduced by 35%.', cost: 5, branch: 'Finance', icon: '🏛️' },
];

export const PERKS = [
  { id: 'fund', name: 'Rainy Day Fund', desc: '+150K starting cash per rank.', max: 3, cost: 3, icon: '💰' },
  { id: 'fellow', name: 'Seismology Fellowship', desc: '+4% forecast accuracy per rank.', max: 3, cost: 3, icon: '📡' },
  { id: 'eye', name: 'Sharp Eye', desc: '+1 investigation per day per rank.', max: 3, cost: 3, icon: '👁️' },
  { id: 'charm', name: 'PR Charm', desc: '+4 starting public trust per rank.', max: 3, cost: 2, icon: '🎩' },
  { id: 'grant', name: 'Research Grant', desc: '+2 starting research points per rank.', max: 3, cost: 3, icon: '🎓' },
  { id: 'ordnance', name: 'Ordnance Contracts', desc: 'Defenses cost 8% less per rank.', max: 3, cost: 4, icon: '🏭' },
];

export interface Difficulty {
  id: string; name: string; desc: string; hp: number; cash: number; acc: number; fraud: number; income: number; mul: number;
}
export const DIFFS: Difficulty[] = [
  { id: 'rookie', name: 'Rookie Clerk', desc: 'Weaker kaiju, bigger budget, clearer forecasts.', hp: 0.75, cash: 1400, acc: 0.1, fraud: 0.7, income: 1.15, mul: 0.6 },
  { id: 'adjuster', name: 'Senior Adjuster', desc: 'The intended experience.', hp: 1, cash: 1000, acc: 0, fraud: 1, income: 1, mul: 1 },
  { id: 'partner', name: 'Managing Partner', desc: 'Tougher monsters, leaner books, more fraud.', hp: 1.3, cash: 800, acc: -0.06, fraud: 1.3, income: 0.9, mul: 1.5 },
  { id: 'catastrophe', name: 'Act of God', desc: 'Unlocked by victory. Brutal kaiju, scarce funds.', hp: 1.65, cash: 650, acc: -0.12, fraud: 1.6, income: 0.8, mul: 2.2 },
];

export const MODS = [
  { id: 'fraud', name: 'Fraud Epidemic', desc: 'Nearly twice the fraudulent claims.', mul: 1.2 },
  { id: 'fog', name: 'Sensor Fog', desc: 'Forecast accuracy −12%.', mul: 1.2 },
  { id: 'skeleton', name: 'Skeleton Crew', desc: 'One fewer investigation per day.', mul: 1.15 },
];

export interface SchedEntry { kind: KKind; delay: number }
const S = (...k: KKind[]): SchedEntry[] => k.map((kind, i) => ({ kind, delay: 1.5 + i * 15 }));
export const SCHEDULE: SchedEntry[][] = [
  S('stomper'), S('stomper'), S('pyro'), S('tide'), S('sky'), S('burrow'),
  S('pyro', 'stomper'), S('tide', 'sky'), S('burrow', 'pyro'), S('stomper', 'sky', 'tide'),
  S('burrow', 'pyro', 'tide'), [{ kind: 'boss', delay: 1.5 }, { kind: 'sky', delay: 38 }],
];

export const INCIDENT_NAMES = [
  'First Contact', 'The Footfall Returns', 'Trial by Fire', 'Rising Tide', 'Wings Over Capital Row', 'Tremors Below',
  'Double Trouble', 'Land, Sea & Air', 'Fire From the Deep', 'The Triple Threat', 'The Gathering Dark', 'OMEGA',
];

export const EVENTS = [
  { id: 'none', title: 'Quiet Skies', text: 'No special conditions.', weight: 3 },
  { id: 'heatwave', title: 'Heat Wave', text: 'Fire spreads 60% faster.', weight: 1.4 },
  { id: 'storm', title: 'Storm Surge', text: 'Floods last 50% longer.', weight: 1.4 },
  { id: 'fog', title: 'Sensor Fog', text: 'Forecast accuracy −12%.', weight: 1.4 },
  { id: 'fraud', title: 'Fraud Ring Active', text: 'Fraudulent claims up 60%.', weight: 1.2 },
  { id: 'audit', title: 'Regulator Audit', text: 'Claim accuracy ≥65% earns trust; otherwise a fine.', weight: 1 },
  { id: 'windfall', title: 'Investor Confidence', text: '+150K capital injection.', weight: 0.9 },
  { id: 'subsidy', title: 'Research Subsidy', text: '+2 research points.', weight: 0.9 },
  { id: 'scandal', title: 'Media Scandal', text: 'A leaked memo costs 5 trust.', weight: 0.9 },
];

// ---------- helpers ----------
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (r: () => number) => {
  const u = Math.max(1e-6, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
export const fmtK = (v: number) => (v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString() + 'K';
