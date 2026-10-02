// Static game data for Frontier Rail Baron

export const W = 56;
export const H = 36;
export const TILE = 24;
export const MONTH_LEN = 5; // seconds of game time per month
export const START_YEAR = 1865;
export const CATCH = 3; // station catchment radius (Chebyshev)
export const BASE_TRACK = 55;

export const T_PLAIN = 0, T_FOREST = 1, T_HILL = 2, T_MOUNT = 3, T_WATER = 4, T_DESERT = 5;
export const TERRAIN_NAMES = ['Prairie', 'Forest', 'Hills', 'Mountains', 'Water', 'Badlands'];
export const TERRAIN_COST = [1, 1.6, 2.4, 7, 8, 1.2];
export const TERRAIN_SPEED = [1, 0.85, 0.7, 0.55, 0.9, 0.95];
export const TERRAIN_NOTE = ['Cheap to lay', 'Clearing needed', 'Grading needed', 'Tunnels - pricey!', 'Bridges - pricey!', 'Easy but barren'];

export type Cargo = 'pass' | 'mail' | 'coal' | 'grain' | 'timber' | 'goods';
export const CARGOS: Cargo[] = ['goods', 'mail', 'pass', 'grain', 'timber', 'coal'];
export const CARGO_INFO: Record<Cargo, { name: string; icon: string; rate: number; color: string; decay: number }> = {
  pass: { name: 'Passengers', icon: '🧑', rate: 0.95, color: '#e0a458', decay: 45 },
  mail: { name: 'Mail', icon: '✉️', rate: 1.15, color: '#d9d3c0', decay: 70 },
  coal: { name: 'Coal', icon: '⚫', rate: 0.7, color: '#444', decay: 220 },
  grain: { name: 'Grain', icon: '🌾', rate: 0.75, color: '#e6c84f', decay: 160 },
  timber: { name: 'Timber', icon: '🪵', rate: 0.72, color: '#9a6a3a', decay: 220 },
  goods: { name: 'Goods', icon: '📦', rate: 1.5, color: '#c97b4a', decay: 120 },
};

export const COMPANY_COLORS = ['#e0b050', '#b8412e', '#4a86b8', '#7a9e4a'];

export interface LocoDef {
  id: string; name: string; cost: number; speed: number; cap: number; upkeep: number; rel: number; tech?: string; desc: string; hill: number;
}
export const LOCOS: LocoDef[] = [
  { id: 'pioneer', name: 'Pioneer 4-4-0', cost: 3500, speed: 2.1, cap: 30, upkeep: 35, rel: 1, hill: 0, desc: 'The workhorse of the frontier. Slow but cheap.' },
  { id: 'mogul', name: 'Mogul 2-6-0', cost: 6200, speed: 2.5, cap: 48, upkeep: 50, rel: 1.15, hill: 0.25, tech: 'compound', desc: 'Compound engine: bigger load, better on grades.' },
  { id: 'consol', name: 'Consolidation 2-8-0', cost: 9000, speed: 2.2, cap: 85, upkeep: 75, rel: 1.2, hill: 0.55, tech: 'heavy', desc: 'Hauls enormous loads and shrugs off hills.' },
  { id: 'flyer', name: 'Atlantic Flyer 4-4-2', cost: 12500, speed: 4.0, cap: 42, upkeep: 90, rel: 0.95, hill: 0.1, tech: 'express', desc: 'Fast express. Premium for passengers and mail.' },
];

export interface TechDef { id: string; name: string; icon: string; desc: string; cost: number; time: number; req?: string }
export const TECHS: TechDef[] = [
  { id: 'survey', name: 'Surveying Corps', icon: '📐', desc: 'Track construction costs -15%.', cost: 2500, time: 15 },
  { id: 'tunnel', name: 'Tunnel Blasting', icon: '⛏️', desc: 'Mountain track costs -40%.', cost: 5000, time: 25, req: 'survey' },
  { id: 'steelbridge', name: 'Iron Truss Bridges', icon: '🌉', desc: 'Bridges -35% cost and 50% less flood damage.', cost: 5000, time: 25, req: 'survey' },
  { id: 'compound', name: 'Compound Engines', icon: '⚙️', desc: 'Unlocks the Mogul locomotive.', cost: 4000, time: 20 },
  { id: 'heavy', name: 'Heavy Haulage', icon: '🏋️', desc: 'Unlocks the Consolidation locomotive.', cost: 7000, time: 30, req: 'compound' },
  { id: 'express', name: 'Express Service', icon: '💨', desc: 'Unlocks the Atlantic Flyer locomotive.', cost: 9000, time: 35, req: 'compound' },
  { id: 'pullman', name: 'Pullman Cars', icon: '🛏️', desc: 'Passenger and mail revenue +25%.', cost: 6000, time: 25 },
  { id: 'telegraph', name: 'Telegraph Lines', icon: '📡', desc: 'Station ratings +8, sabotage against you -20%.', cost: 4500, time: 20 },
  { id: 'signals', name: 'Block Signals', icon: '🚦', desc: 'Breakdown chance halved.', cost: 5500, time: 25, req: 'telegraph' },
  { id: 'steelrails', name: 'Bessemer Steel Rails', icon: '🔩', desc: 'Trains +10% speed, upkeep on track -30%.', cost: 8000, time: 30, req: 'survey' },
  { id: 'yards', name: 'Freight Yards', icon: '🏭', desc: 'Faster loading, new stations get an extra platform.', cost: 5000, time: 20 },
  { id: 'broker', name: 'Wall Street Seat', icon: '🎩', desc: 'Trading fees 0.5%, your stock sentiment +5%.', cost: 6500, time: 25 },
  { id: 'pinkerton', name: 'Pinkerton Contract', icon: '🕵️', desc: 'Security costs -40%, rivals\' sabotage -15%.', cost: 7000, time: 30, req: 'telegraph' },
];

export interface DiffDef { id: string; name: string; desc: string; cash: number; loan: number; target: number; aiCash: number; aggr: number; ev: number; lpMul: number; payMul: number; takeover: boolean }
export const DIFFS: DiffDef[] = [
  { id: 'settler', name: 'Settler', desc: 'Gentle rivals, generous funds. Learn the ropes.', cash: 45000, loan: 40000, target: 250000, aiCash: 22000, aggr: 0.5, ev: 0.7, lpMul: 0.7, payMul: 1.1, takeover: false },
  { id: 'railroader', name: 'Railroader', desc: 'A fair fight. Rivals build, trade and scheme.', cash: 32000, loan: 30000, target: 400000, aiCash: 30000, aggr: 1, ev: 1, lpMul: 1, payMul: 1, takeover: true },
  { id: 'baron', name: 'Robber Baron', desc: 'Ruthless rivals, hostile frontier, lean purse.', cash: 24000, loan: 22000, target: 650000, aiCash: 42000, aggr: 1.7, ev: 1.45, lpMul: 1.6, payMul: 0.92, takeover: true },
];

export interface ModDef { id: string; name: string; desc: string; lpMul: number }
export const MODS: ModDef[] = [
  { id: 'winters', name: 'Harsh Winters', desc: 'Frequent blizzards and floods; winter slows trains more.', lpMul: 1.15 },
  { id: 'market', name: 'Cutthroat Market', desc: 'Volatile stocks and a scheduled financial panic.', lpMul: 1.2 },
  { id: 'shoestring', name: 'Shoestring', desc: 'Start with 60% of the funds and a smaller credit line.', lpMul: 1.3 },
  { id: 'short', name: 'Short Line', desc: 'Only 10 years until the final reckoning.', lpMul: 0.8 },
];

export interface PerkDef { id: string; name: string; icon: string; desc: string; max: number; cost: number[] }
export const PERKS: PerkDef[] = [
  { id: 'grant', name: 'Land Grant', icon: '📜', desc: '+8% starting cash per level.', max: 5, cost: [8, 12, 18, 26, 36] },
  { id: 'rails', name: 'Friends in Congress', icon: '🏛️', desc: '-5% track costs per level.', max: 4, cost: [10, 16, 24, 34] },
  { id: 'surveyors', name: 'Survey Veterans', icon: '🧭', desc: 'Start with Surveying (L1) and Tunnel Blasting (L2).', max: 2, cost: [12, 24] },
  { id: 'guards', name: 'Pinkerton Retainer', icon: '🛡️', desc: 'Start with +1 security level per level.', max: 2, cost: [14, 26] },
  { id: 'broker', name: 'Inside Tipster', icon: '📈', desc: '+4% stock sentiment per level.', max: 3, cost: [10, 18, 28] },
  { id: 'rep', name: 'Good Name', icon: '🎖️', desc: '+10 starting reputation per level.', max: 3, cost: [8, 14, 22] },
];

export interface RivalDef { name: string; title: string; style: string; aggr: number; build: number; color: string; boss?: boolean; bio: string }
export const RIVALS: RivalDef[] = [
  { name: 'Vandermoor Pacific', title: 'Cornelius Vandermoor', style: 'The Iron Tyrant', aggr: 1.0, build: 1.2, color: '#b8412e', boss: true, bio: 'Races you for the Golden Spike. Buys your shares when you stumble and sabotages without mercy.' },
  { name: 'Harlan & Sons Freight', title: 'Eli Harlan', style: 'The Steady Builder', aggr: 0.25, build: 1.0, color: '#4a86b8', bio: 'Expands relentlessly and rarely stoops to dirty tricks.' },
  { name: 'Copperhead Rail Co.', title: 'Madam Ines Copper', style: 'The Saboteur', aggr: 1.3, build: 0.75, color: '#7a9e4a', bio: 'Small but venomous. Fond of fires, cut rails and rumors.' },
];

export const TOWN_NAMES = ['Dry Gulch', 'Brass Hollow', 'Copper Ridge', 'Fort Meridian', 'Silver Fork', 'Red Mesa', 'Cedar Bluff', 'Lonesome Creek', 'Prosper', 'Iron Spur', 'Wagon Wheel', 'Coyote Flats', 'Hangman\'s Rest', 'Sundown', 'Bitterroot', 'Gilded Rock', 'Tumbleweed', 'Fairhaven'];

export const SABOTAGE: { id: string; name: string; icon: string; cost: number; desc: string }[] = [
  { id: 'derail', name: 'Derail a Train', icon: '🚂', cost: 1800, desc: 'A loosened rail wrecks one locomotive and spills its cargo.' },
  { id: 'fire', name: 'Torch a Depot', icon: '🔥', cost: 2200, desc: 'Burns a station: cargo lost, rating wrecked, closed for a while.' },
  { id: 'cut', name: 'Cut the Line', icon: '✂️', cost: 1500, desc: 'Rips up a stretch of their track.' },
  { id: 'strike', name: 'Incite a Strike', icon: '📢', cost: 2500, desc: 'Their entire fleet stops for 20 seconds.' },
  { id: 'rumor', name: 'Spread Rumors', icon: '🗞️', cost: 1200, desc: 'Plants whispers of insolvency; their stock sags.' },
];

export const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
