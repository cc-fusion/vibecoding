export type GoodId = 'spice' | 'silk' | 'oil' | 'relic' | 'tonic' | 'smoke';
export type FactionId = 'guild' | 'court' | 'syndicate' | 'wardens';
export type Role = 'vendor' | 'informant' | 'patron' | 'noble' | 'warden' | 'cutpurse' | 'rival';

export const W = 1280;
export const H = 760;

export interface Good { id: GoodId; name: string; icon: string; base: number; faction: FactionId; color: string }
export const GOODS: Record<GoodId, Good> = {
  spice: { id: 'spice', name: 'Saffron Spice', icon: '🌶️', base: 24, faction: 'guild', color: '#f08a3c' },
  silk: { id: 'silk', name: 'Moon Silk', icon: '🧵', base: 46, faction: 'court', color: '#c9a2ff' },
  oil: { id: 'oil', name: 'Lamp Oil', icon: '🛢️', base: 14, faction: 'guild', color: '#e6c84e' },
  relic: { id: 'relic', name: 'Saint Relics', icon: '🏺', base: 72, faction: 'court', color: '#d9b38c' },
  tonic: { id: 'tonic', name: 'Tonics', icon: '🧪', base: 32, faction: 'wardens', color: '#6fe0a8' },
  smoke: { id: 'smoke', name: 'Dream-Smoke', icon: '💨', base: 56, faction: 'syndicate', color: '#6fd3d6' },
};
export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

export interface Faction { id: FactionId; name: string; color: string; icon: string; rival: FactionId; blurb: string }
export const FACTIONS: Record<FactionId, Faction> = {
  guild: { id: 'guild', name: 'Lantern Guild', color: '#f2b84b', icon: '🏮', rival: 'syndicate', blurb: 'Merchants who prize fair scales and fat ledgers.' },
  court: { id: 'court', name: 'Veiled Court', color: '#b88cf5', icon: '🎭', rival: 'wardens', blurb: 'Masked nobles who trade in secrets and silk.' },
  syndicate: { id: 'syndicate', name: 'Tidewater Syndicate', color: '#3fc9bd', icon: '⚓', rival: 'guild', blurb: 'Smugglers, dockhands and quiet tides.' },
  wardens: { id: 'wardens', name: 'Ashen Wardens', color: '#e4665e', icon: '🛡️', rival: 'court', blurb: 'The city watch. Order, ash and iron.' },
};
export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
export const FAVOR_PER_POINT = 12;
export const FAVOR_MAX = 120;

export interface Perk { id: string; faction: FactionId; name: string; desc: string; cost: number; req: string[]; tier: number; col: number; icon: string }
export const PERKS: Perk[] = [
  { id: 'g_scales', faction: 'guild', name: 'Fair Scales', desc: 'Trade spread -2% on every deal.', cost: 1, req: [], tier: 0, col: 1, icon: '⚖️' },
  { id: 'g_yoke', faction: 'guild', name: "Porter's Yoke", desc: '+5 cargo capacity.', cost: 1, req: ['g_scales'], tier: 1, col: 0, icon: '🪢' },
  { id: 'g_board', faction: 'guild', name: 'Ledger Eyes', desc: 'The Market board shows live prices from every stall.', cost: 1, req: ['g_scales'], tier: 1, col: 2, icon: '📜' },
  { id: 'g_bulk', faction: 'guild', name: 'Bulk Haggler', desc: 'Buying 5+ units at once is 6% cheaper.', cost: 2, req: ['g_yoke'], tier: 2, col: 0, icon: '📦' },
  { id: 'g_clerk', faction: 'guild', name: 'Shipping Manifests', desc: 'See the next scheduled market event on your HUD.', cost: 2, req: ['g_board'], tier: 2, col: 2, icon: '🔭' },
  { id: 'g_charter', faction: 'guild', name: 'Monopoly Charter', desc: 'Your trades move prices 50% less; sell +4%.', cost: 3, req: ['g_bulk', 'g_clerk'], tier: 3, col: 1, icon: '👑' },

  { id: 'c_tongue', faction: 'court', name: 'Silver Tongue', desc: 'Rumors sell for +20%.', cost: 1, req: [], tier: 0, col: 1, icon: '👅' },
  { id: 'c_quiet', faction: 'court', name: 'Quiet Voice', desc: 'Eavesdropping costs half the Poise and is rarely noticed.', cost: 1, req: ['c_tongue'], tier: 1, col: 0, icon: '🤫' },
  { id: 'c_quill', faction: 'court', name: "Forger's Quill", desc: 'Forging rumors costs 40% less.', cost: 1, req: ['c_tongue'], tier: 1, col: 2, icon: '🪶' },
  { id: 'c_net', faction: 'court', name: "Courtier's Network", desc: 'Planted rumors take hold more firmly (+0.2 belief).', cost: 2, req: ['c_quiet'], tier: 2, col: 0, icon: '🕸️' },
  { id: 'c_masks', faction: 'court', name: 'Mask-Maker', desc: 'Lies are 70% less likely to be traced to you.', cost: 2, req: ['c_quill'], tier: 2, col: 2, icon: '🎭' },
  { id: 'c_web', faction: 'court', name: 'Whisper Web', desc: 'Planting also seeds the two nearest bystanders.', cost: 3, req: ['c_net', 'c_masks'], tier: 3, col: 1, icon: '🌐' },

  { id: 'd_alley', faction: 'syndicate', name: 'Back Alleys', desc: 'Dream-Smoke sells +12%; carrying it draws half the heat.', cost: 1, req: [], tier: 0, col: 1, icon: '🌫️' },
  { id: 'd_feet', faction: 'syndicate', name: 'Quick Feet', desc: '+15% move speed and cheaper dashes.', cost: 1, req: ['d_alley'], tier: 1, col: 0, icon: '👟' },
  { id: 'd_tide', faction: 'syndicate', name: 'Tide Tipoff', desc: 'Begin each night holding a TRUE rumor.', cost: 1, req: ['d_alley'], tier: 1, col: 2, icon: '🌊' },
  { id: 'd_bottom', faction: 'syndicate', name: 'False Bottoms', desc: 'Fines are halved; smoke is rarely confiscated.', cost: 2, req: ['d_feet'], tier: 2, col: 0, icon: '🧰' },
  { id: 'd_crew', faction: 'syndicate', name: 'Crew Watch', desc: 'Cutpurses will not dare rob you.', cost: 2, req: ['d_tide'], tier: 2, col: 2, icon: '🗡️' },
  { id: 'd_ghost', faction: 'syndicate', name: 'Ghost Cargo', desc: 'Begin each night with 5 free units of the best opportunity.', cost: 3, req: ['d_bottom', 'd_crew'], tier: 3, col: 1, icon: '👻' },

  { id: 'w_nod', faction: 'wardens', name: 'Friendly Nod', desc: 'Heat fades twice as fast.', cost: 1, req: [], tier: 0, col: 1, icon: '🙂' },
  { id: 'w_tip', faction: 'wardens', name: 'Patrol Tip-off', desc: 'See Warden sight ranges on the map.', cost: 1, req: ['w_nod'], tier: 1, col: 0, icon: '🔔' },
  { id: 'w_warrant', faction: 'wardens', name: 'Sealed Warrant', desc: 'Fines are halved.', cost: 1, req: ['w_nod'], tier: 1, col: 2, icon: '📃' },
  { id: 'w_name', faction: 'wardens', name: 'Cleansed Name', desc: '+4 Credibility at dawn; proven rumors give +1 extra.', cost: 2, req: ['w_tip'], tier: 2, col: 0, icon: '✨' },
  { id: 'w_deputy', faction: 'wardens', name: 'Deputy Authority', desc: 'Catching cutpurses pays a 15c bounty and +3 Warden favor.', cost: 2, req: ['w_warrant'], tier: 2, col: 2, icon: '⭐' },
  { id: 'w_badge', faction: 'wardens', name: 'Badge of Office', desc: 'Wardens ignore you while Heat is under 60.', cost: 3, req: ['w_name', 'w_deputy'], tier: 3, col: 1, icon: '🏅' },
];

// ---------- Map ----------
export const COLS = [140, 470, 810, 1140];
export const ROWS = [130, 380, 630];
export const NODES: { x: number; y: number }[] = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) NODES.push({ x: COLS[c], y: ROWS[r] });
NODES.push({ x: 640, y: 380 });
export const EDGES: [number, number][] = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const a = r * 4 + c;
    if (r === 1 && c === 1) { EDGES.push([a, 12], [12, a + 1]); } else EDGES.push([a, a + 1]);
  }
}
for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) EDGES.push([r * 4 + c, (r + 1) * 4 + c]);

const NN = NODES.length;
const dist: number[][] = [];
const nxt: number[][] = [];
for (let i = 0; i < NN; i++) { dist.push(new Array(NN).fill(Infinity)); nxt.push(new Array(NN).fill(-1)); dist[i][i] = 0; nxt[i][i] = i; }
for (const [a, b] of EDGES) {
  const d = Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y);
  dist[a][b] = d; dist[b][a] = d; nxt[a][b] = b; nxt[b][a] = a;
}
for (let k = 0; k < NN; k++) for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) {
  if (dist[i][k] + dist[k][j] < dist[i][j]) { dist[i][j] = dist[i][k] + dist[k][j]; nxt[i][j] = nxt[i][k]; }
}
export function nodePath(a: number, b: number): number[] {
  const out = [a];
  let guard = 0;
  while (a !== b && guard++ < 30) { a = nxt[a][b]; if (a < 0) break; out.push(a); }
  return out;
}
export function nearestNode(x: number, y: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < NN; i++) { const d = (NODES[i].x - x) ** 2 + (NODES[i].y - y) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

export interface Loc {
  id: string; name: string; x: number; y: number; node: number; kind: 'stall' | 'social';
  good?: GoodId; rect: { x: number; y: number; w: number; h: number }; short: string;
}
const stall = (id: string, name: string, short: string, good: GoodId, cx: number, cy: number, node: number, upper: boolean): Loc => ({
  id, name, short, good, kind: 'stall', x: cx, y: upper ? cy + 80 : cy - 80, node,
  rect: { x: cx - 95, y: cy - 50, w: 190, h: 100 },
});
export const LOCS: Loc[] = [
  stall('spice', 'Ember Spice Stall', 'Spice Stall', 'spice', 305, 255, 5, true),
  stall('silk', 'Moonloom Silks', 'Silk Stall', 'silk', 640, 255, 12, true),
  stall('tonic', "Sister Vale's Tonics", 'Tonic Stall', 'tonic', 975, 255, 6, true),
  stall('oil', 'Wick & Wonder Lamps', 'Lamp Stall', 'oil', 305, 505, 5, false),
  stall('relic', 'Hollow Saint Curios', 'Relic Stall', 'relic', 640, 505, 12, false),
  stall('smoke', 'The Quiet Pipe', 'Smoke Stall', 'smoke', 975, 505, 6, false),
  { id: 'fountain', name: 'Wishing Fountain', short: 'the Fountain', x: 640, y: 380, node: 12, kind: 'social', rect: { x: 0, y: 0, w: 0, h: 0 } },
  { id: 'tavern', name: 'The Gilded Ear', short: 'the Tavern', x: 200, y: 652, node: 8, kind: 'social', rect: { x: 60, y: 668, w: 240, h: 78 } },
  { id: 'pavilion', name: 'Velvet Pavilion', short: 'the Pavilion', x: 200, y: 106, node: 0, kind: 'social', rect: { x: 60, y: 14, w: 240, h: 74 } },
  { id: 'wardpost', name: 'Warden Post', short: 'the Warden Post', x: 1080, y: 106, node: 3, kind: 'social', rect: { x: 980, y: 14, w: 260, h: 74 } },
  { id: 'docks', name: 'Dockside Gate', short: 'the Docks', x: 1080, y: 652, node: 11, kind: 'social', rect: { x: 980, y: 668, w: 260, h: 78 } },
];
export const LOC: Record<string, Loc> = Object.fromEntries(LOCS.map(l => [l.id, l]));
export const OBSTACLES = LOCS.filter(l => l.rect.w > 0).map(l => l.rect);
export const STALL_LOCS = LOCS.filter(l => l.kind === 'stall');

// ---------- NPCs ----------
export interface NpcDef {
  id: string; name: string; title: string; role: Role; faction: FactionId; gossip: number; trust: number; color: string;
  home?: string; good?: GoodId; route?: string[]; bio: string;
}
export const VENDORS: NpcDef[] = [
  { id: 'v_spice', name: 'Tamsin Ember', title: 'Spice Merchant', role: 'vendor', faction: 'guild', gossip: 0.45, trust: 0.6, color: '#f08a3c', home: 'spice', good: 'spice', bio: 'Counts every grain twice.' },
  { id: 'v_silk', name: 'Ilsabet Moonloom', title: 'Silk Weaver', role: 'vendor', faction: 'court', gossip: 0.6, trust: 0.5, color: '#c9a2ff', home: 'silk', good: 'silk', bio: 'Hears what nobles whisper.' },
  { id: 'v_tonic', name: 'Sister Vale', title: 'Apothecary', role: 'vendor', faction: 'wardens', gossip: 0.35, trust: 0.7, color: '#6fe0a8', home: 'tonic', good: 'tonic', bio: 'Trusting, and rarely wrong.' },
  { id: 'v_oil', name: 'Odo Wick', title: 'Lamp-Maker', role: 'vendor', faction: 'guild', gossip: 0.55, trust: 0.5, color: '#e6c84e', home: 'oil', good: 'oil', bio: 'Loves a storm story.' },
  { id: 'v_relic', name: 'Curator Hesk', title: 'Relic Dealer', role: 'vendor', faction: 'court', gossip: 0.3, trust: 0.4, color: '#d9b38c', home: 'relic', good: 'relic', bio: 'A hard skeptic.' },
  { id: 'v_smoke', name: 'Fenn the Quiet', title: 'Smoke-Peddler', role: 'vendor', faction: 'syndicate', gossip: 0.4, trust: 0.45, color: '#6fd3d6', home: 'smoke', good: 'smoke', bio: 'Says little, hears everything.' },
];
export const INFORMANTS: NpcDef[] = [
  { id: 'i_nan', name: 'Whisper Nan', title: 'Gossip-Monger', role: 'informant', faction: 'guild', gossip: 0.95, trust: 0.6, color: '#f2d6a0', route: ['tavern', 'fountain', 'spice', 'tavern'], bio: 'Sells what she overhears.' },
  { id: 'i_lucan', name: 'Lucan Lamplight', title: 'Lamplighter', role: 'informant', faction: 'court', gossip: 0.8, trust: 0.55, color: '#ffe0f0', route: ['pavilion', 'silk', 'fountain', 'relic', 'pavilion'], bio: 'Sees every window.' },
  { id: 'i_pike', name: 'Dockhand Pike', title: 'Dock Rat', role: 'informant', faction: 'syndicate', gossip: 0.75, trust: 0.5, color: '#b8f0ea', route: ['docks', 'smoke', 'tavern', 'docks'], bio: 'Knows which ships are late.' },
];
export const NOBLES: NpcDef[] = [
  { id: 'n_corvina', name: 'Lady Corvina', title: 'Masked Noble', role: 'noble', faction: 'court', gossip: 0.7, trust: 0.8, color: '#a46de6', route: ['pavilion', 'silk', 'fountain', 'relic', 'pavilion'], bio: 'Believes whatever flatters her.' },
  { id: 'n_venn', name: 'Lord Ashby Venn', title: 'Guild Patron', role: 'noble', faction: 'guild', gossip: 0.5, trust: 0.7, color: '#e9b44a', route: ['pavilion', 'spice', 'fountain', 'oil', 'tavern'], bio: 'Rich, bored, credulous.' },
];
export const WARDENS: NpcDef[] = [
  { id: 'w_harrow', name: 'Sgt. Harrow', title: 'Warden', role: 'warden', faction: 'wardens', gossip: 0.1, trust: 0.2, color: '#e4665e', bio: 'Hard eyes, softer pockets.' },
  { id: 'w_dole', name: 'Watchman Dole', title: 'Warden', role: 'warden', faction: 'wardens', gossip: 0.1, trust: 0.2, color: '#d9534f', bio: 'Always one step behind.' },
  { id: 'w_brask', name: 'Captain Brask', title: 'Warden', role: 'warden', faction: 'wardens', gossip: 0.1, trust: 0.2, color: '#c9443f', bio: 'Reserve patrol.' },
];
const PATRON_NAMES: [string, string][] = [
  ['Mira', 'Weaver'], ['Joss', 'Sailor'], ['Pell', 'Scribe'], ['Dunya', 'Courtesan'], ['Kit', 'Apprentice'], ['Rook', 'Dockworker'],
  ['Anselm', 'Cleric'], ['Brisa', 'Dancer'], ['Corwin', 'Cooper'], ['Edda', 'Midwife'], ['Fitch', 'Tinker'], ['Gwen', 'Fishwife'],
];
const PATRON_COLORS = ['#9bb7d4', '#d49b9b', '#a7d49b', '#d4c49b', '#b79bd4', '#9bd4c8'];
const FIDS: FactionId[] = ['guild', 'court', 'syndicate', 'wardens', 'guild', 'syndicate'];
export const PATRONS: NpcDef[] = PATRON_NAMES.map(([n, t], i) => ({
  id: 'p_' + n.toLowerCase(), name: n, title: t, role: 'patron' as Role, faction: FIDS[i % FIDS.length],
  gossip: 0.35 + ((i * 37) % 55) / 100, trust: 0.35 + ((i * 53) % 50) / 100, color: PATRON_COLORS[i % PATRON_COLORS.length], bio: 'A face in the crowd.',
}));
const THIEF_NAMES = ['Slip', 'Nib', 'Grubb', 'Tick', 'Fingers'];
export const CUTPURSES: NpcDef[] = THIEF_NAMES.map((n, i) => ({
  id: 't_' + n.toLowerCase(), name: n, title: 'Cutpurse', role: 'cutpurse' as Role, faction: 'syndicate' as FactionId,
  gossip: 0.2, trust: 0.3, color: '#8a7f99' + '', bio: 'Light fingers' + i,
}));
export const MAGPIE: NpcDef = {
  id: 'r_magpie', name: 'The Magpie', title: 'Rival Broker', role: 'rival', faction: 'court', gossip: 1, trust: 0.1, color: '#f4f4f8',
  bio: 'A masked rival who sows lies to corner the market.',
};
export const PATRON_SPOTS = ['spice', 'silk', 'oil', 'relic', 'tonic', 'smoke', 'fountain', 'tavern', 'fountain', 'pavilion', 'docks'];

// ---------- Rumor text ----------
export function marketText(g: GoodId, dir: number, variant: number): string {
  const n = GOODS[g].name;
  const up = [`${n} will run short before dawn.`, `${n} is vanishing from the docks.`, `A noble wants every scrap of ${n}.`, `${n} prices are about to climb.`];
  const dn = [`A shipload of ${n} is due; prices will fall.`, `${n} is spoiling in the warehouses.`, `Nobody wants ${n} anymore.`, `${n} will be cheap by midnight.`];
  const arr = dir > 0 ? up : dn;
  return arr[variant % arr.length];
}
export function scandalText(f: FactionId, variant: number): string {
  const n = FACTIONS[f].name;
  const arr = [`The ${n} treasurer is skimming the till.`, `A ${n} envoy was seen dining with the enemy.`, `The ${n} ledgers are cooked.`, `A ${n} captain sold the harbor map.`];
  return arr[variant % arr.length];
}

// ---------- Events ----------
export interface EventDef {
  id: string; name: string; icon: string; desc: string; fx: Partial<Record<GoodId, number>>; main: GoodId; hint: string;
  gossip?: number; crackdown?: boolean; storm?: boolean; festival?: boolean;
}
export const EVENTS: EventDef[] = [
  { id: 'galleon', name: 'Moonloom Galleon', icon: '⛵', desc: 'A galleon floods the docks with silk.', fx: { silk: -0.34, relic: -0.05 }, main: 'silk', hint: 'A Moonloom galleon is said to be docking, holds heavy with silk.' },
  { id: 'blight', name: 'Spice Blight', icon: '🥀', desc: 'Blight guts the spice terraces.', fx: { spice: 0.5 }, main: 'spice', hint: 'The spice terraces are failing; a blight is coming.' },
  { id: 'gala', name: 'Masked Gala', icon: '🎭', desc: 'The Court hosts a gala; finery sells dear.', fx: { silk: 0.28, relic: 0.3 }, main: 'relic', hint: 'The Court plans a masked gala; nobles will pay anything for finery.' },
  { id: 'crackdown', name: 'Warden Crackdown', icon: '🚨', desc: 'Wardens sweep the lanes hunting contraband.', fx: { smoke: 0.45 }, main: 'smoke', crackdown: true, hint: 'The Wardens will sweep the lanes; dream-smoke will vanish from shelves.' },
  { id: 'plague', name: 'Dock Fever', icon: '🤒', desc: 'A coughing sickness. Tonics become gold.', fx: { tonic: 0.55 }, main: 'tonic', hint: 'A coughing sickness spreads from the docks; tonics will be gold.' },
  { id: 'storm', name: 'Sea Storm', icon: '⛈️', desc: 'Rain drives the crowd to the tavern; lamps burn dear.', fx: { oil: 0.38, spice: -0.08 }, main: 'oil', storm: true, hint: 'A storm rolls in off the sea; lamps will burn dear.' },
  { id: 'festival', name: 'Festival of Masks', icon: '🎉', desc: 'Tongues loosen; rumors spread faster.', fx: { spice: 0.18, oil: 0.18 }, main: 'spice', festival: true, gossip: 1.7, hint: 'The Festival of Masks begins soon; spice will flow and tongues loosen.' },
  { id: 'moon', name: "Smugglers' Moon", icon: '🌕', desc: 'Boats heavy with smoke slip past the harbor.', fx: { smoke: -0.36 }, main: 'smoke', hint: 'A smugglers\' moon: boats heavy with dream-smoke slip past the harbor.' },
  { id: 'find', name: 'Tomb Flood', icon: '⚱️', desc: 'Grave-robbers flood the market with relics.', fx: { relic: -0.32 }, main: 'relic', hint: 'Grave-robbers are flooding the market with relics.' },
];

// ---------- Difficulty ----------
export interface Difficulty { id: string; name: string; desc: string; quota: number; night: number; heat: number; thieves: number; magpie: number; coins: number; marks: number }
export const DIFFICULTIES: Difficulty[] = [
  { id: 'apprentice', name: 'Apprentice', desc: 'Gentle tithes, patient wardens, long nights.', quota: 0.7, night: 215, heat: 0.65, thieves: 1, magpie: 1.4, coins: 220, marks: 1 },
  { id: 'broker', name: 'Broker', desc: 'The intended experience.', quota: 1, night: 185, heat: 1, thieves: 2, magpie: 1, coins: 160, marks: 1.5 },
  { id: 'spymaster', name: 'Spymaster', desc: 'Cruel tithes, sharp wardens, a hungry Magpie.', quota: 1.35, night: 165, heat: 1.45, thieves: 3, magpie: 0.7, coins: 120, marks: 2.3 },
];
export interface Modifier { id: string; name: string; desc: string; marks: number }
export const MODIFIERS: Modifier[] = [
  { id: 'loose', name: 'Loose Lips', desc: 'Rumors spread twice as fast.', marks: 0.15 },
  { id: 'volatile', name: 'Volatile Market', desc: 'Price noise is 1.8x stronger.', marks: 0.2 },
  { id: 'iron', name: 'Iron Wardens', desc: 'Heat builds 50% faster; an extra patrol.', marks: 0.25 },
  { id: 'season', name: 'Cutpurse Season', desc: '+3 cutpurses roam the lanes.', marks: 0.15 },
  { id: 'lies', name: 'Fog of Lies', desc: 'Twice as many false rumors circulate.', marks: 0.2 },
];

export const FINALE_NIGHT = 12;
export function quotaFor(night: number): number {
  const n = night;
  return Math.round((20 + 12 * n + 3 * n * n) / 5) * 5;
}

// ---------- Upgrades ----------
export interface KitItem { id: string; name: string; icon: string; desc: string; max: number; cost: number[] }
export const KIT: KitItem[] = [
  { id: 'satchel', name: 'Deep Satchel', icon: '🎒', desc: '+4 cargo slots per level.', max: 3, cost: [110, 200, 340] },
  { id: 'trumpet', name: 'Ear Trumpet', icon: '📯', desc: 'Eavesdrop range +25% and 20% less noticed per level.', max: 3, cost: [90, 170, 280] },
  { id: 'charm', name: 'Calm Charm', icon: '🧿', desc: 'Poise regenerates 25% faster per level.', max: 3, cost: [100, 190, 310] },
  { id: 'mask', name: 'Mask of Many Faces', icon: '😶', desc: 'Heat gain -20% per level.', max: 3, cost: [120, 210, 330] },
  { id: 'lens', name: 'Truth Lens', icon: '🔍', desc: 'Rumors show a hint of truth: 70% / 85% / 95% accurate.', max: 3, cost: [140, 260, 420] },
  { id: 'wary', name: 'Wary Eyes', icon: '👁️', desc: 'Marks cutpurses with a red ring; longer dashes.', max: 1, cost: [130] },
];
export interface LegacyItem { id: string; name: string; icon: string; desc: string; max: number; cost: number[] }
export const LEGACY: LegacyItem[] = [
  { id: 'purse', name: 'Old Money', icon: '💰', desc: '+60 starting coins per level.', max: 3, cost: [3, 6, 10] },
  { id: 'satchel', name: 'Smuggler\'s Lining', icon: '🧥', desc: '+2 cargo capacity per level.', max: 3, cost: [3, 6, 10] },
  { id: 'lungs', name: 'Steady Nerves', icon: '🫁', desc: '+10 max Poise per level.', max: 3, cost: [3, 6, 10] },
  { id: 'name', name: 'Family Name', icon: '📛', desc: '+8 starting Credibility per level.', max: 3, cost: [3, 6, 10] },
  { id: 'legs', name: 'Alley Runner', icon: '🏃', desc: '+4% move speed per level.', max: 3, cost: [3, 6, 10] },
  { id: 'omens', name: 'Omen Reading', icon: '🔮', desc: 'Each dusk, the forecast reveals 1 / 2 / 3 coming events.', max: 3, cost: [4, 8, 12] },
];

export const TUTORIAL = [
  'Move with WASD / arrow keys (or click / tap the ground). Walk toward the glowing figures.',
  'Stand near someone and press E (or click them) to talk. Time slows while you talk.',
  'Choose "Eavesdrop" or buy a rumor. Rumors are your merchandise.',
  'Plant that rumor with a gossip. Watch glowing orbs jump between people and prices start to shift.',
  'Rumors move prices. Buy goods at a stall that has not heard the news, and sell where it has.',
  'Sell goods or rumors to earn the dawn tithe. Keep Heat low near Wardens. Good luck, broker!',
];
