import type { Campaign, Crew, GadgetId, HeistDef, HeistResult, LootCat, LootItem, Mods, Role, Settings, Skill } from './types';
import { CATS } from './types';
import { CAT_INFO, FENCES, GADGETS, HEISTS, makeCrew, xpNeeded } from './data';

const SAVE_KEY = 'meridian_heist_save_v1';
const SET_KEY = 'meridian_heist_settings_v1';

export const defaultSettings: Settings = { master: 0.7, music: 0.6, sfx: 0.8, muted: false, shake: true, speedDefault: 1 };

export function loadSettings(): Settings {
  try { const r = localStorage.getItem(SET_KEY); if (r) return { ...defaultSettings, ...JSON.parse(r) }; } catch { /* storage unavailable */ }
  return { ...defaultSettings };
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
export function saveCampaign(c: Campaign) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } }
export function loadCampaign(): Campaign | null {
  try {
    const r = localStorage.getItem(SAVE_KEY);
    if (!r) return null;
    const c = JSON.parse(r) as Campaign;
    if (!c || c.v !== 1 || !Array.isArray(c.crew)) return null;
    return c;
  } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } }

const rnd = Math.random;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const completed = (c: Campaign) => Object.values(c.jobs).filter(j => j.done > 0).length;
export const slots = (c: Campaign) => 3 + (c.upg.planning || 0);
export const loadoutSlots = (c: Campaign) => 2 + (c.upg.workshop || 0);
export const gadgetCost = (c: Campaign, id: GadgetId) => Math.round(GADGETS[id].cost * (1 - 0.1 * (c.upg.workshop || 0)));
export const reconCost = (c: Campaign, def: HeistDef, lvl: 1 | 2) => Math.round(def.recon[lvl - 1] * (1 - 0.15 * (c.upg.comms || 0)) * (1 + c.heat / 200) * [1, 1, 1.2][c.diff]);
export const maxRaids = (c: Campaign) => [4, 3, 2][c.diff];
export const stashValue = (c: Campaign) => c.stash.reduce((a, b) => a + b.value, 0);
export const bailCost = (c: Campaign, m: Crew) => Math.max(100, Math.round((150 + m.level * 120) * (m.trait === 'loyal' ? 0.7 : 1) * (1 - 0.25 * (c.upg.safehouse || 0))));
export const freeCrew = (c: Campaign) => c.crew.filter(m => m.jailed <= 0);

export function fencePrice(c: Campaign, fenceId: string, item: LootItem): number {
  const f = FENCES.find(x => x.id === fenceId)!;
  const sat = c.market.sat[fenceId]?.[item.cat] ?? 0;
  return Math.max(10, Math.round(item.value * c.market.idx[item.cat] * f.rate * (1 - sat) * (1 - Math.min(0.4, c.heat * f.heatPen))));
}

function pushNews(c: Campaign, msg: string) { c.news.unshift(`Day ${c.day}: ${msg}`); if (c.news.length > 14) c.news.length = 14; }

export function refreshRecruits(c: Campaign) {
  const roles: Role[] = ['hacker', 'cracker', 'muscle', 'shadow', 'face'];
  const lvlBase = 1 + Math.floor(completed(c) / 3);
  c.recruits = [];
  const order = roles.slice().sort(() => rnd() - 0.5);
  for (let i = 0; i < 4; i++) {
    const m = makeCrew(c.uid++, order[i % order.length], clampN(lvlBase + (rnd() < 0.5 ? 1 : 0), 1, 5), rnd);
    if (c.crew.some(x => x.name === m.name) || c.recruits.some(x => x.name === m.name)) m.name += ' ' + String.fromCharCode(65 + Math.floor(rnd() * 26));
    c.recruits.push(m);
  }
}

export function newCampaign(diff: 0 | 1 | 2, mods: Mods): Campaign {
  const idx = {} as Record<LootCat, number>, trend = {} as Record<LootCat, number>;
  CATS.forEach(k => { idx[k] = 0.92 + rnd() * 0.16; trend[k] = 0; });
  const sat: Record<string, Record<LootCat, number>> = {};
  FENCES.forEach(f => { sat[f.id] = { cash: 0, jewels: 0, art: 0, tech: 0, bullion: 0, data: 0 }; });
  const c: Campaign = {
    v: 1, diff, mods, cash: [3000, 2000, 1200][diff], heat: 0, day: 1, raids: 0,
    crew: [makeCrew(1, 'hacker', 1, rnd, 'Nyx', 'steady'), makeCrew(2, 'shadow', 1, rnd, 'Vesper', 'quiet'), makeCrew(3, 'muscle', 1, rnd, 'Brick', 'brawler')],
    recruits: [], stash: [], jobs: {}, intel: {}, upg: {}, gadgets: { smoke: 1, emp: 0, decoy: 1, dart: 0, key: 0 },
    market: { idx, trend, event: '', sat }, news: ['The Syndicate is open for business. Plan your first score.'],
    stats: { heists: 0, earned: 0, loot: 0, arrests: 0, alarms: 0, ghosts: 0, bodies: 0, guards: 0, time: 0, sold: 0 }, won: false, over: '', uid: 10,
  };
  refreshRecruits(c);
  return c;
}

export function advanceDays(c: Campaign, n: number) {
  for (let d = 0; d < n; d++) {
    c.day++;
    c.heat = Math.max(0, c.heat - (1.2 + (c.upg.safehouse || 0)));
    c.crew.forEach(m => { if (m.jailed > 0) { m.jailed--; if (m.jailed === 0) pushNews(c, `${m.name} was released from custody.`); } });
    CATS.forEach(k => {
      c.market.trend[k] *= 0.8;
      c.market.idx[k] = clampN(c.market.idx[k] + (1 - c.market.idx[k]) * 0.1 + c.market.trend[k] + (rnd() - 0.5) * 0.08, 0.55, 1.65);
    });
    FENCES.forEach(f => CATS.forEach(k => { c.market.sat[f.id][k] = Math.max(0, c.market.sat[f.id][k] - 0.04); }));
    if (rnd() < 0.16) {
      const k = CATS[Math.floor(rnd() * CATS.length)];
      const up = rnd() < 0.55;
      c.market.trend[k] += up ? 0.18 : -0.16;
      c.market.event = up ? `${CAT_INFO[k].icon} ${CAT_INFO[k].label} demand surges!` : `${CAT_INFO[k].icon} ${CAT_INFO[k].label} market floods with stock.`;
      pushNews(c, c.market.event);
    } else if (c.day % 5 === 0) c.market.event = '';
    if (c.day % 4 === 0) refreshRecruits(c);
  }
}

export function checkOver(c: Campaign) {
  if (c.over) return;
  if (freeCrew(c).length > 0) return;
  const liquid = c.cash + stashValue(c) * 0.7;
  const cheapest = Math.min(...c.recruits.map(r => r.hire), ...c.crew.map(m => bailCost(c, m)), 99999);
  if (liquid < cheapest) c.over = 'Your syndicate has no crew left and no money to rebuild it. The Meridian job slips away to a rival gang.';
}

export function hire(c: Campaign, id: string): string | null {
  const r = c.recruits.find(x => x.id === id);
  if (!r) return 'Gone';
  if (c.cash < r.hire) return 'Not enough cash';
  c.cash -= r.hire;
  c.crew.push(r);
  c.recruits = c.recruits.filter(x => x.id !== id);
  pushNews(c, `${r.name} joined the crew.`);
  return null;
}
export function bail(c: Campaign, id: string): string | null {
  const m = c.crew.find(x => x.id === id);
  if (!m || m.jailed <= 0) return 'Not in custody';
  const cost = bailCost(c, m);
  if (c.cash < cost) return 'Not enough cash';
  c.cash -= cost; m.jailed = 0; c.heat = Math.min(100, c.heat + 2);
  return null;
}
export function spendPerk(c: Campaign, id: string, sk: Skill): string | null {
  const m = c.crew.find(x => x.id === id);
  if (!m || m.perks <= 0) return 'No perk points';
  if (m.skills[sk] >= 5) return 'Already maxed';
  m.skills[sk]++; m.perks--;
  return null;
}
export function buyGadget(c: Campaign, id: GadgetId): string | null {
  const cost = gadgetCost(c, id);
  if (c.cash < cost) return 'Not enough cash';
  if (c.gadgets[id] >= 6) return 'Stock full (6)';
  c.cash -= cost; c.gadgets[id]++;
  return null;
}
export function buyUpgrade(c: Campaign, id: string, costs: number[]): string | null {
  const lvl = c.upg[id] || 0;
  if (lvl >= costs.length) return 'Maxed';
  if (c.cash < costs[lvl]) return 'Not enough cash';
  c.cash -= costs[lvl]; c.upg[id] = lvl + 1;
  return null;
}
export function buyIntel(c: Campaign, def: HeistDef, lvl: 1 | 2): string | null {
  const cur = c.intel[def.id] || 0;
  if (cur >= lvl) return 'Already known';
  if (lvl === 2 && cur < 1) return 'Buy casing first';
  const cost = reconCost(c, def, lvl);
  if (c.cash < cost) return 'Not enough cash';
  c.cash -= cost; c.intel[def.id] = lvl;
  return null;
}
export function layLow(c: Campaign): string | null {
  const cost = 250;
  if (c.cash < cost) return 'Not enough cash';
  c.cash -= cost;
  c.heat = Math.max(0, c.heat - 12);
  advanceDays(c, 3);
  pushNews(c, 'The crew laid low for three days.');
  return null;
}

export function sellItem(c: Campaign, fenceId: string, index: number): { price: number; traced: boolean } | null {
  const it = c.stash[index];
  if (!it) return null;
  const f = FENCES.find(x => x.id === fenceId)!;
  const price = fencePrice(c, fenceId, it);
  c.cash += price; c.stats.earned += price; c.stats.sold += price;
  c.stash.splice(index, 1);
  c.market.sat[fenceId][it.cat] = Math.min(0.6, c.market.sat[fenceId][it.cat] + 0.07);
  const traced = f.bust > 0 && rnd() < f.bust;
  if (traced) { c.heat = Math.min(100, c.heat + 4); pushNews(c, 'A Cipher sale was traced. Heat +4.'); }
  return { price, traced };
}

export interface ResultNotes { lines: string[]; levelUps: string[]; raid: boolean; payout: number }

export function applyResult(c: Campaign, r: HeistResult, def: HeistDef): ResultNotes {
  const lines: string[] = [];
  const levelUps: string[] = [];
  const bonus = r.bonuses.reduce((a, b) => a + b.amount, 0);
  const payout = r.fee + bonus;
  c.cash += payout - r.salary;
  c.stats.earned += payout;
  c.stash.push(...r.loot);
  r.gadgetsUsed && (Object.keys(r.gadgetsUsed) as GadgetId[]).forEach(g => { c.gadgets[g] = Math.max(0, c.gadgets[g] - r.gadgetsUsed[g]); });
  const job = c.jobs[def.id] || { done: 0, best: 'F', bestLoot: 0 };
  const order = 'FDCBAS';
  if (r.success) job.done++;
  if (order.indexOf(r.rating) > order.indexOf(job.best)) job.best = r.rating;
  job.bestLoot = Math.max(job.bestLoot, r.lootValue);
  c.jobs[def.id] = job;
  c.stats.heists++; c.stats.loot += r.lootValue; c.stats.arrests += r.arrested.length; c.stats.alarms += r.alarms; c.stats.bodies += r.bodiesFound; c.stats.guards += r.guardsDowned; c.stats.time += r.time;
  if (r.ghost) c.stats.ghosts++;
  if (r.success && def.id === 'meridian') c.won = true;

  // crew xp & consequences
  Object.keys(r.xp).forEach(id => {
    const m = c.crew.find(x => x.id === id);
    if (!m) return;
    m.heists++;
    m.xp += r.xp[id];
    while (m.xp >= xpNeeded(m.level)) {
      m.xp -= xpNeeded(m.level); m.level++; m.perks++; m.salary = 60 + m.level * 40;
      levelUps.push(`${m.name} reached level ${m.level}! (+1 perk point)`);
    }
  });
  r.arrested.forEach(id => {
    const m = c.crew.find(x => x.id === id);
    if (!m) return;
    if (c.mods.iron) { c.crew = c.crew.filter(x => x.id !== id); lines.push(`${m.name} is gone for good (Iron Crew).`); }
    else { m.jailed = 4; lines.push(`${m.name} is in custody for 4 days. Bail: $${bailCost(c, m)}.`); }
  });
  c.heat = Math.min(100, c.heat + r.heatGain);
  lines.push(`Heat +${r.heatGain}.`);
  advanceDays(c, 2);

  let raid = false;
  if (c.heat >= 100) {
    raid = true; c.raids++;
    const seized = c.stash.length;
    c.stash = [];
    const lost = Math.round(c.cash * 0.4);
    c.cash -= lost;
    const free = freeCrew(c);
    if (free.length) {
      const v = free[Math.floor(rnd() * free.length)];
      if (c.mods.iron) c.crew = c.crew.filter(x => x.id !== v.id); else v.jailed = 5;
      lines.push(`${v.name} was taken in the raid.`);
    }
    c.heat = 55;
    lines.push(`TASK FORCE RAID! ${seized} stashed items and $${lost.toLocaleString()} seized. (Raid ${c.raids}/${maxRaids(c)})`);
    pushNews(c, 'Task force raided the safehouse.');
    if (c.raids >= maxRaids(c)) c.over = 'The Task Force raided your safehouse for the last time. The syndicate is finished.';
  }
  if (c.cash < 0) c.cash = 0;
  checkOver(c);
  return { lines, levelUps, raid, payout };
}

export function unlockedJobs(c: Campaign) { return HEISTS.filter(h => completed(c) >= h.unlock); }
