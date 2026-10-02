// ===== Shared game data: factions, packages, districts, upgrades, saves, contracts, settlement =====

export type FactionId = 'chrome' | 'vipers' | 'verdant';
export type PkgKind = 'standard' | 'fragile' | 'volatile' | 'live' | 'data' | 'heavy';
export type SegType = 'rooftops' | 'alley' | 'market' | 'crane' | 'undercity' | 'maglev';
export type DiffId = 'courier' | 'runner' | 'ghost';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface Faction {
  id: FactionId; name: string; color: string; rival: FactionId; icon: string; blurb: string; cat: string; perks: [string, string, string];
}
export const FACTION_IDS: FactionId[] = ['chrome', 'vipers', 'verdant'];
export const FACTIONS: Record<FactionId, Faction> = {
  chrome: {
    id: 'chrome', name: 'Chrome Syndicate', color: '#28e0ff', rival: 'vipers', icon: '◈', cat: 'tech',
    blurb: 'Cybernetic smugglers who move black-market silicon through the Strip.',
    perks: ['Hack time +25% in their turf', 'Tech gear 15% off · Heat gain −20% in their turf', 'Unlocks Quantum Deck: first hack each run auto-cracks'],
  },
  vipers: {
    id: 'vipers', name: 'Crimson Vipers', color: '#ff3d6e', rival: 'verdant', icon: '❖', cat: 'body',
    blurb: 'Street-racing enforcers. They respect speed and nothing else.',
    perks: ['Hack time +25% in their turf', 'Body mods 15% off · Heat gain −20% in their turf', 'Unlocks Overdrive Core: +12% top speed'],
  },
  verdant: {
    id: 'verdant', name: 'Verdant Coalition', color: '#7dff6b', rival: 'chrome', icon: '✿', cat: 'armor',
    blurb: 'Eco-hackers who grow medicine in the sewers and ship it by hand.',
    perks: ['Hack time +25% in their turf', 'Armor gear 15% off · Heat gain −20% in their turf', 'Unlocks Mycelium Padding: package slowly self-repairs'],
  },
};
export const REP_TIERS = [20, 45, 70];
export function repTier(rep: number) { return rep >= REP_TIERS[2] ? 3 : rep >= REP_TIERS[1] ? 2 : rep >= REP_TIERS[0] ? 1 : 0; }
export function repLabel(rep: number) {
  if (rep <= -60) return 'KILL ORDER';
  if (rep <= -25) return 'HOSTILE';
  if (rep < 20) return 'NEUTRAL';
  if (rep < 45) return 'ACQUAINTANCE';
  if (rep < 70) return 'ALLY';
  return 'INNER CIRCLE';
}

export interface PkgInfo { name: string; icon: string; color: string; value: number; frag: number; desc: string; tip: string }
export const PACKAGES: Record<PkgKind, PkgInfo> = {
  standard: { name: 'Sealed Parcel', icon: '📦', color: '#c9d3ff', value: 60, frag: 1, desc: 'No special handling. Modest pay.', tip: 'Forgiving. Good for learning routes.' },
  fragile: { name: 'Glass Relic', icon: '🔮', color: '#c58bff', value: 130, frag: 1.5, desc: 'Hard landings and drops shatter it.', tip: 'Tap SLIDE just before landing to ROLL. Avoid tall drops.' },
  volatile: { name: 'Plasma Cell', icon: '🔋', color: '#ffb02e', value: 150, frag: 1, desc: 'Overheats when you sprint too fast.', tip: 'Keep below redline speed. Sliding vents heat.' },
  live: { name: 'Cryo Organ', icon: '🫀', color: '#ff6b8b', value: 170, frag: 1, desc: 'Integrity ticks away constantly.', tip: 'Speed is life. Shortest, fastest routes win.' },
  data: { name: 'Black-ICE Drive', icon: '💾', color: '#42ffa8', value: 140, frag: 1, desc: 'Drone scans corrupt it. Hacks heal it.', tip: 'Avoid scanner-heavy routes; hack terminals to repair.' },
  heavy: { name: 'Ingot Case', icon: '🧱', color: '#d0a46a', value: 200, frag: 0.7, desc: 'Slow and heavy but armored.', tip: 'Jumps are weaker, speed capped. Avoid big gaps.' },
};

export interface Palette { skyTop: string; skyBot: string; accent: string; accent2: string; bldg: string; win: string; fog: string }
export interface District { id: number; name: string; owner: FactionId | null; pool: SegType[]; pal: Palette; mx: number; my: number; blurb: string; legs: number; mult: number }
export const DISTRICTS: District[] = [
  { id: 0, name: 'Dockside Warrens', owner: 'verdant', pool: ['market', 'undercity', 'rooftops', 'crane'], mx: 16, my: 70, blurb: 'Rusted cranes and sewer gardens by the black harbour.', legs: 4, mult: 1,
    pal: { skyTop: '#04111a', skyBot: '#0e4a52', accent: '#35ffd0', accent2: '#7dff6b', bldg: '#07161c', win: '#8bfff0', fog: '#0d4a55' } },
  { id: 1, name: 'Neon Strip', owner: 'chrome', pool: ['rooftops', 'alley', 'market', 'maglev'], mx: 36, my: 38, blurb: 'Casino towers, holo-ads and a million cameras.', legs: 4, mult: 1.3,
    pal: { skyTop: '#12041f', skyBot: '#5a0f6e', accent: '#ff2fd6', accent2: '#28e0ff', bldg: '#10061c', win: '#ffa6f0', fog: '#5a1070' } },
  { id: 2, name: 'Old Quarter', owner: 'vipers', pool: ['alley', 'market', 'undercity', 'rooftops'], mx: 58, my: 66, blurb: 'Crowded lanes, lantern rain and gang colours.', legs: 5, mult: 1.6,
    pal: { skyTop: '#1a0508', skyBot: '#6a1a24', accent: '#ff3d6e', accent2: '#ffb02e', bldg: '#14070a', win: '#ffd0a0', fog: '#6a2230' } },
  { id: 3, name: 'Foundry Row', owner: 'chrome', pool: ['crane', 'maglev', 'undercity', 'alley'], mx: 76, my: 34, blurb: 'Smelters, maglev yards and molten skies.', legs: 5, mult: 2,
    pal: { skyTop: '#1a0c02', skyBot: '#7a3a08', accent: '#ffb02e', accent2: '#ff5a1f', bldg: '#150a04', win: '#ffd488', fog: '#7a3a10' } },
  { id: 4, name: 'Spire Heights', owner: null, pool: ['rooftops', 'maglev', 'crane', 'alley'], mx: 90, my: 72, blurb: 'Sentinel HQ. The Warden walks these roofs.', legs: 5, mult: 2.6,
    pal: { skyTop: '#050a1c', skyBot: '#233a7a', accent: '#9ec3ff', accent2: '#ffffff', bldg: '#070c1c', win: '#d6e4ff', fog: '#2a3f86' } },
];

export const SEGS: Record<SegType, { name: string; icon: string; desc: string }> = {
  rooftops: { name: 'Rooftop Run', icon: '🏙️', desc: 'Fast open roofs with wide gaps and drops.' },
  alley: { name: 'Neon Alley', icon: '🌃', desc: 'Tall walls, tripwires and laser gates.' },
  market: { name: 'Night Market', icon: '🏮', desc: 'Packed street: crowds, cops and cameras.' },
  crane: { name: 'Crane Yard', icon: '🏗️', desc: 'Tiny perches, moving cranes and ziplines.' },
  undercity: { name: 'Undercity', icon: '🕳️', desc: 'Low pipes, steam vents, few eyes.' },
  maglev: { name: 'Maglev Yard', icon: '🚆', desc: 'Huge gaps bridged by moving train cars.' },
};

export interface Upgrade { id: string; name: string; icon: string; max: number; base: number; cat: string; desc: string; excl?: FactionId }
export const UPGRADES: Upgrade[] = [
  { id: 'legs', name: 'Cyber-Legs', icon: '🦿', max: 5, base: 140, cat: 'body', desc: '+4% jump, +3% cruise speed per level.' },
  { id: 'grip', name: 'Grip Gloves', icon: '🧤', max: 5, base: 120, cat: 'body', desc: '+0.12s wall-run duration per level.' },
  { id: 'dash', name: 'Dash Coil', icon: '⚡', max: 4, base: 160, cat: 'body', desc: '−0.28s dash cooldown, longer reach.' },
  { id: 'boots', name: 'Gyro Boots', icon: '👟', max: 1, base: 420, cat: 'body', desc: 'Unlocks an air-hop (double jump).' },
  { id: 'core', name: 'Momentum Core', icon: '🌀', max: 4, base: 200, cat: 'body', desc: '+5% top speed, momentum decays slower.' },
  { id: 'shell', name: 'Impact Shell', icon: '🛡️', max: 5, base: 130, cat: 'armor', desc: '−8% package damage per level.' },
  { id: 'deck', name: 'Neural Deck', icon: '🧠', max: 5, base: 130, cat: 'tech', desc: '+1s hack time, softer failure penalties.' },
  { id: 'cloak', name: 'Ghost Cloak', icon: '👻', max: 5, base: 150, cat: 'tech', desc: '−8% heat gain, faster cooling.' },
  { id: 'rig', name: 'Gadget Rig', icon: '🎒', max: 4, base: 100, cat: 'tech', desc: '+1 carry capacity for each gadget.' },
  { id: 'quantum', name: 'Quantum Deck', icon: '💠', max: 1, base: 1100, cat: 'excl', excl: 'chrome', desc: 'First hack each run auto-cracks. (Chrome Inner Circle)' },
  { id: 'overdrive', name: 'Overdrive Core', icon: '🔥', max: 1, base: 1100, cat: 'excl', excl: 'vipers', desc: '+12% top speed. (Vipers Inner Circle)' },
  { id: 'mycelium', name: 'Mycelium Padding', icon: '🍄', max: 1, base: 1100, cat: 'excl', excl: 'verdant', desc: 'Package self-repairs over time. (Verdant Inner Circle)' },
];
export const GADGETS = [
  { id: 'emp', name: 'EMP Burst', icon: '💥', cost: 90, key: 'Q', desc: 'Fries drones, turrets and lasers nearby; stuns guards.' },
  { id: 'smoke', name: 'Smoke Bomb', icon: '🌫️', cost: 80, key: 'R', desc: 'Pushes the pack back 380m and cools 1★ of heat.' },
  { id: 'key', name: 'Skeleton Key', icon: '🗝️', cost: 110, key: 'K', desc: 'Instantly cracks one hack in progress.' },
] as const;
export type GadgetId = 'emp' | 'smoke' | 'key';

export function upgradeCost(save: Save, u: Upgrade): number {
  const lvl = save.upgrades[u.id] || 0;
  let c = u.base * Math.pow(1.65, lvl);
  const f = FACTION_IDS.find((f) => FACTIONS[f].cat === u.cat);
  if (f && repTier(save.rep[f]) >= 2) c *= 0.85;
  return Math.round(c / 5) * 5;
}
export function deriveStats(s: Save) {
  const u = (id: string) => s.upgrades[id] || 0;
  return {
    jumpMul: 1 + 0.04 * u('legs'), speedMul: 1 + 0.03 * u('legs'), wallTime: 0.62 + 0.12 * u('grip'),
    dashCd: Math.max(0.6, 1.9 - 0.28 * u('dash')), dashPow: 380 + 40 * u('dash'), airHop: u('boots') > 0,
    topMul: 1 + 0.05 * u('core') + (u('overdrive') ? 0.12 : 0), momDecay: Math.max(0.4, 1 - 0.15 * u('core')),
    dmgMul: Math.max(0.35, 1 - 0.08 * u('shell')), hackBonus: u('deck'), hackPenalty: Math.max(0.4, 1 - 0.12 * u('deck')),
    heatMul: Math.max(0.4, 1 - 0.08 * u('cloak')), coolMul: 1 + 0.12 * u('cloak'), cap: 2 + u('rig'),
    autoHack: u('quantum') > 0, regen: u('mycelium') > 0 ? 0.35 : 0,
  };
}

export const DIFFS: Record<DiffId, { name: string; desc: string; dmg: number; heat: number; pack: number; pay: number; dens: number; color: string }> = {
  courier: { name: 'Courier', desc: 'Gentle: less damage, slower pursuit, fewer foes. Pay ×0.8', dmg: 0.65, heat: 0.7, pack: 0.85, pay: 0.8, dens: 0.75, color: '#7dff6b' },
  runner: { name: 'Runner', desc: 'The intended experience. Pay ×1.0', dmg: 1, heat: 1, pack: 1, pay: 1, dens: 1, color: '#28e0ff' },
  ghost: { name: 'Ghost', desc: 'Brutal: fragile cargo, hungry sentinels. Pay ×1.5', dmg: 1.4, heat: 1.35, pack: 1.15, pay: 1.5, dens: 1.3, color: '#ff3d6e' },
};
export const MODS = [
  { id: 'glass', name: 'Glass Courier', desc: 'All package damage ×2', pay: 0.4 },
  { id: 'hot', name: 'Hot Streets', desc: 'Start every run with 2★ heat', pay: 0.35 },
  { id: 'nobrake', name: 'No Brakes', desc: 'You cannot slow down', pay: 0.25 },
  { id: 'blackout', name: 'Blackout', desc: 'Lights out: limited vision', pay: 0.3 },
  { id: 'rush', name: 'Rush Hour', desc: '+40% enemy density', pay: 0.2 },
];
export function modPayMul(mods: string[]) { return 1 + MODS.filter((m) => mods.includes(m.id)).reduce((a, m) => a + m.pay, 0); }

// ===== Save / settings =====
export interface Stats { runs: number; delivered: number; failed: number; busted: number; chips: number; distance: number; hacks: number; stunts: number; topSpeed: number; earned: number; bestScore: number; falls: number }
export interface Save {
  v: number; cash: number; upgrades: Record<string, number>; gadgets: Record<GadgetId, number>; rep: Record<FactionId, number>;
  notoriety: number; heat: number[]; deliveries: number[]; refresh: number; seed: number; tutorialDone: boolean; bossBeaten: boolean; day: number; stats: Stats;
}
export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: number; difficulty: DiffId; mods: string[]; touch: 'auto' | 'on' | 'off'; particles: 'high' | 'low' }

const mem: Record<string, string> = {};
function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } }
function lsDel(k: string) { try { localStorage.removeItem(k); } catch { delete mem[k]; } }

export function newSave(): Save {
  return {
    v: 1, cash: 120, upgrades: {}, gadgets: { emp: 1, smoke: 1, key: 1 }, rep: { chrome: 0, vipers: 0, verdant: 0 },
    notoriety: 0, heat: [0, 0, 0, 0, 0], deliveries: [0, 0, 0, 0, 0], refresh: 0, seed: Math.floor(Math.random() * 1e6) + 1, tutorialDone: false, bossBeaten: false, day: 1,
    stats: { runs: 0, delivered: 0, failed: 0, busted: 0, chips: 0, distance: 0, hacks: 0, stunts: 0, topSpeed: 0, earned: 0, bestScore: 0, falls: 0 },
  };
}
export function loadSave(): Save | null {
  const raw = lsGet('neon-courier-save');
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    const b = newSave();
    return { ...b, ...o, rep: { ...b.rep, ...o.rep }, gadgets: { ...b.gadgets, ...o.gadgets }, stats: { ...b.stats, ...o.stats }, heat: o.heat?.length === 5 ? o.heat : b.heat, deliveries: o.deliveries?.length === 5 ? o.deliveries : b.deliveries };
  } catch { return null; }
}
export function persistSave(s: Save) { lsSet('neon-courier-save', JSON.stringify(s)); }
export function deleteSave() { lsDel('neon-courier-save'); }
export function defaultSettings(): Settings {
  return { master: 0.7, music: 0.6, sfx: 0.8, muted: false, shake: 1, difficulty: 'runner', mods: [], touch: 'auto', particles: 'high' };
}
export function loadSettings(): Settings {
  const raw = lsGet('neon-courier-settings');
  if (!raw) return defaultSettings();
  try { return { ...defaultSettings(), ...JSON.parse(raw) }; } catch { return defaultSettings(); }
}
export function persistSettings(s: Settings) { lsSet('neon-courier-settings', JSON.stringify(s)); }

// ===== Contracts =====
export interface Contract { id: string; district: number; client: FactionId; pkg: PkgKind; legs: number; seed: number; base: number; title: string; boss: boolean }
const T1 = ['Midnight', 'Quiet', 'Burning', 'Glass', 'Hollow', 'Velvet', 'Static', 'Rusted', 'Phantom', 'Electric'];
const T2 = ['Handoff', 'Errand', 'Drop', 'Favor', 'Delivery', 'Shipment', 'Courier Job', 'Run', 'Exchange', 'Transfer'];
export function districtUnlocked(s: Save, di: number) { return di === 0 || (s.deliveries[di - 1] || 0) >= 2; }

export function genContracts(s: Save, di: number): Contract[] {
  const r = rng(s.seed * 7919 + s.refresh * 104729 + di * 31 + 7);
  const d = DISTRICTS[di];
  const list: Contract[] = [];
  for (let i = 0; i < 3; i++) {
    const pool: FactionId[] = [];
    for (const f of FACTION_IDS) {
      if (s.rep[f] <= -60) continue;
      const w = d.owner === f ? 3 : 1;
      for (let k = 0; k < w; k++) pool.push(f);
    }
    if (pool.length === 0) pool.push(...FACTION_IDS);
    const client = pool[Math.floor(r() * pool.length)];
    const kinds: PkgKind[] = ['standard', 'fragile', 'fragile', 'volatile', 'volatile', 'live', 'live', 'data', 'data', 'heavy', 'heavy'];
    const pkg = di === 0 && i === 0 ? 'standard' : kinds[Math.floor(r() * kinds.length)];
    const legs = d.legs;
    const base = Math.round(((60 + di * 40) * legs * 0.9 + PACKAGES[pkg].value * (1 + di * 0.3)) / 5) * 5;
    list.push({
      id: `c${s.refresh}-${di}-${i}`, district: di, client, pkg, legs, seed: Math.floor(r() * 1e9), base,
      title: `${T1[Math.floor(r() * T1.length)]} ${T2[Math.floor(r() * T2.length)]}`, boss: false,
    });
  }
  if (di === 4) {
    list.unshift({ id: 'boss', district: 4, client: 'chrome', pkg: 'data', legs: 5, seed: 424242, base: 2600, title: 'The Spire Override', boss: true });
  }
  return list;
}
export function contractRisk(c: Contract) { return clamp(c.district + 1 + (c.pkg === 'fragile' || c.pkg === 'volatile' ? 1 : 0) + (c.boss ? 2 : 0), 1, 5); }

export interface RunSummary {
  outcome: 'delivered' | 'busted' | 'destroyed' | 'abandoned'; payout: number; fine: number; lines: string[]; repDelta: Partial<Record<FactionId, number>>;
  notoDelta: number; heatDelta: number; burned: boolean; victory: boolean; unlocked: string[];
}
export interface RunStatsIn {
  outcome: RunSummary['outcome']; integrity: number; grade: string; score: number; chips: number; chipCash: number; heatPeak: number; legMul: number;
  hacksOk: number; stunts: number; topSpeed: number; distance: number; falls: number; used: Record<GadgetId, number>; tutorial: boolean; bonusRep: number; wardenDown: boolean;
}
export function settleRun(save: Save, c: Contract, r: RunStatsIn, st: Settings): { save: Save; summary: RunSummary } {
  const s: Save = JSON.parse(JSON.stringify(save));
  const sum: RunSummary = { outcome: r.outcome, payout: 0, fine: 0, lines: [], repDelta: {}, notoDelta: 0, heatDelta: 0, burned: false, victory: false, unlocked: [] };
  if (r.tutorial) {
    s.tutorialDone = true; sum.lines.push('Training complete. Welcome to the grid, courier.');
    s.cash += 60; sum.payout = 60; sum.lines.push('Signing bonus: ¤60');
    persistSave(s); return { save: s, summary: sum };
  }
  const di = c.district, diff = DIFFS[st.difficulty], mm = modPayMul(st.mods);
  for (const g of ['emp', 'smoke', 'key'] as GadgetId[]) s.gadgets[g] = Math.max(0, s.gadgets[g] - (r.used[g] || 0));
  s.stats.runs++; s.stats.chips += r.chips; s.stats.distance += Math.round(r.distance); s.stats.hacks += r.hacksOk; s.stats.stunts += r.stunts;
  s.stats.topSpeed = Math.max(s.stats.topSpeed, r.topSpeed); s.stats.falls += r.falls; s.stats.bestScore = Math.max(s.stats.bestScore, r.score);
  const rival = FACTIONS[c.client].rival;
  const gb = r.grade === 'S' ? 5 : r.grade === 'A' ? 3 : r.grade === 'B' ? 1 : 0;
  let notoDelta = 0, heatDelta = 0;
  if (r.outcome === 'delivered') {
    const im = 0.4 + 0.6 * (r.integrity / 100);
    const gradeMul = r.grade === 'S' ? 1.25 : r.grade === 'A' ? 1.15 : r.grade === 'B' ? 1.05 : 1;
    const core = Math.round(c.base * im * r.legMul * diff.pay * mm * gradeMul);
    const style = Math.round(r.score / 60);
    sum.payout = core + r.chipCash + style;
    sum.lines.push(`Contract fee ¤${core}  (integrity ${Math.round(r.integrity)}%, route ×${r.legMul.toFixed(2)}, diff ×${(diff.pay * mm).toFixed(2)})`);
    sum.lines.push(`Chips ¤${r.chipCash} · Style bonus ¤${style}`);
    const rg = 7 + gb;
    sum.repDelta[c.client] = (sum.repDelta[c.client] || 0) + rg;
    sum.repDelta[rival] = (sum.repDelta[rival] || 0) - 4;
    s.deliveries[di] = (s.deliveries[di] || 0) + 1;
    s.stats.delivered++; s.stats.earned += sum.payout;
    notoDelta = Math.round(r.heatPeak * 2.5) - (r.heatPeak < 1 ? 3 : 0);
    heatDelta = Math.round(r.heatPeak * 6);
    if (c.boss) { s.bossBeaten = true; sum.victory = true; sum.lines.push('THE WARDEN IS OFFLINE. The grid is yours.'); }
    if (di + 1 < 5 && s.deliveries[di] === 2 && save.deliveries[di] < 2) sum.unlocked.push(DISTRICTS[di + 1].name);
  } else if (r.outcome === 'busted') {
    sum.fine = Math.min(s.cash, Math.round(s.cash * 0.12 + 20));
    sum.lines.push(`Busted! Sentinels confiscate the package. Fine ¤${sum.fine}.`);
    sum.repDelta[c.client] = -5; notoDelta = 10; heatDelta = 10; s.stats.busted++; s.stats.failed++;
    sum.payout = Math.round(r.chipCash * 0.5);
  } else if (r.outcome === 'destroyed') {
    sum.lines.push('Package destroyed. The client wants blood.');
    sum.repDelta[c.client] = -8; sum.repDelta[rival] = 2; notoDelta = 3; heatDelta = Math.round(r.heatPeak * 3); s.stats.failed++;
    sum.payout = Math.round(r.chipCash * 0.5);
  } else {
    sum.lines.push('Contract abandoned.'); sum.repDelta[c.client] = -3; notoDelta = 2; s.stats.failed++;
  }
  if (r.bonusRep && DISTRICTS[di].owner) sum.repDelta[DISTRICTS[di].owner!] = (sum.repDelta[DISTRICTS[di].owner!] || 0) + r.bonusRep;
  s.cash = Math.max(0, s.cash + sum.payout - sum.fine);
  for (const f of FACTION_IDS) if (sum.repDelta[f]) s.rep[f] = clamp(s.rep[f] + (sum.repDelta[f] as number), -100, 100);
  s.notoriety = clamp(s.notoriety + notoDelta, 0, 100);
  s.heat = s.heat.map((h, i) => clamp(i === di ? h + heatDelta : h - 5, 0, 100));
  sum.notoDelta = notoDelta; sum.heatDelta = heatDelta;
  if (r.outcome !== 'abandoned') { s.refresh++; s.day++; }
  if (s.notoriety >= 100) { sum.burned = true; }
  persistSave(s);
  return { save: s, summary: sum };
}
