// ---------- Campaign / meta layer: heat, market, crew, upgrades, persistence ----------
import {
  CREW, DIFFS, FENCES, GADGETS, MODS, UPGRADES, VENUES, VENUE_ORDER, NAME_POOL, LOOT_CATS, GADGET_IDS, UPGRADE_IDS, clamp, fmt, heatTier, mulberry32, pick, ri,
} from './data';
import type { Contract, CrewKind, DiffId, Fence, GadgetId, Loot, LootCat, ModId, UpgradeId } from './data';
import type { Result } from './sim';

export interface CrewMember { id: string; kind: CrewKind; name: string; level: number; status: 'ready' | 'custody'; custodyDays: number; jobs: number }
export interface Market { mul: Record<LootCat, number>; sat: Record<LootCat, number>; news: string; sold: Record<string, number> }
export interface Stats { jobs: number; wins: number; stolen: number; arrests: number; alarms: number; ghosts: number; sold: number; spent: number; takedowns: number }
export interface Campaign {
  v: number; diff: DiffId; mods: ModId[]; day: number; cash: number; heat: number; rep: number; jobsDone: number; crew: CrewMember[]; stash: Loot[]; market: Market;
  upgrades: Record<UpgradeId, number>; gadgets: Record<GadgetId, number>; contracts: Contract[]; seed: number; nextId: number; tutorialDone: boolean; won: boolean;
  freePlay: boolean; raided: boolean; bribedDay: number; stats: Stats; news: string[];
}
export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; hints: boolean }
export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false, shake: true, hints: true };

const KEY = 'mhs_campaign_v1', SKEY = 'mhs_settings_v1', BKEY = 'mhs_best_v1';
const ls = {
  get(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del(k: string) { try { window.localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
export const loadSettings = (): Settings => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(ls.get(SKEY) ?? '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } };
export const saveSettings = (s: Settings) => ls.set(SKEY, JSON.stringify(s));
export const saveCampaign = (c: Campaign) => ls.set(KEY, JSON.stringify(c));
export const clearCampaign = () => ls.del(KEY);
export function loadCampaign(): Campaign | null {
  try { const raw = ls.get(KEY); if (!raw) return null; const c = JSON.parse(raw) as Campaign; if (!c || c.v !== 1 || !Array.isArray(c.crew)) return null; return c; } catch { return null; }
}
export interface Best { wins: number; bestDay: number; bestCash: number; runs: number }
export const loadBest = (): Best => { try { return { wins: 0, bestDay: 0, bestCash: 0, runs: 0, ...JSON.parse(ls.get(BKEY) ?? '{}') }; } catch { return { wins: 0, bestDay: 0, bestCash: 0, runs: 0 }; } };
export function recordBest(c: Campaign, won: boolean) { const b = loadBest(); b.runs++; if (won) { b.wins++; if (!b.bestDay || c.day < b.bestDay) b.bestDay = c.day; } b.bestCash = Math.max(b.bestCash, c.cash); ls.set(BKEY, JSON.stringify(b)); }

// ---------- creation ----------
const uid = (c: Campaign, p: string) => p + (c.nextId++);
const freshName = (c: Campaign) => { const used = new Set(c.crew.map((m) => m.name)); const pool = NAME_POOL.filter((n) => !used.has(n)); return pool.length ? pick(Math.random, pool) : 'Agent ' + c.nextId; };
const modsPay = (c: Campaign) => c.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.pay ?? 0), 0);

export function newCampaign(diff: DiffId, mods: ModId[]): Campaign {
  const D = DIFFS[diff];
  const mul = {} as Record<LootCat, number>, sat = {} as Record<LootCat, number>;
  LOOT_CATS.forEach((k) => { mul[k] = 0.9 + Math.random() * 0.25; sat[k] = 0; });
  const c: Campaign = {
    v: 1, diff, mods, day: 1, cash: Math.round(D.cash * (mods.includes('thrift') ? 0.5 : 1)), heat: 0, rep: 0, jobsDone: 0, crew: [], stash: [], market: { mul, sat, news: 'The market is quiet.', sold: {} },
    upgrades: { safehouse: 0, garage: 0, intel: 0, lawyer: 0, workshop: 0 }, gadgets: { smoke: 1, emp: 0, decoy: 1, tranq: 0 }, contracts: [], seed: Math.floor(Math.random() * 1e9), nextId: 1,
    tutorialDone: false, won: false, freePlay: false, raided: false, bribedDay: 0, stats: { jobs: 0, wins: 0, stolen: 0, arrests: 0, alarms: 0, ghosts: 0, sold: 0, spent: 0, takedowns: 0 }, news: ['Welcome to the Syndicate. The Meridian Vault awaits.'],
  };
  for (const k of ['ghost', 'hacker', 'muscle'] as CrewKind[]) c.crew.push({ id: uid(c, 'm'), kind: k, name: freshName(c), level: 1, status: 'ready', custodyDays: 0, jobs: 0 });
  genBoard(c); return c;
}

export const deadline = (c: Campaign) => DIFFS[c.diff].deadline;

export function genBoard(c: Campaign) {
  c.contracts = c.contracts.filter((x) => x.tutorial || x.final || x.expires >= c.day);
  if (!c.tutorialDone && !c.contracts.some((x) => x.tutorial)) {
    c.contracts.unshift({ id: uid(c, 'k'), venue: 'tutorial', tier: 1, seed: c.seed % 99991, fee: 600, client: 'The Old Man', expires: 999, targetName: VENUES.tutorial.targets[0], tutorial: true });
  }
  if (c.jobsDone >= 6 && !c.won && !c.contracts.some((x) => x.final)) {
    const V = VENUES.meridian; const D = DIFFS[c.diff];
    c.contracts.push({ id: uid(c, 'k'), venue: 'meridian', tier: 5, seed: (c.seed * 31 + 7) % 1000003, fee: Math.round((V.baseFee * D.pay * (1 + modsPay(c))) / 100) * 100, client: V.clients[0], expires: 999, targetName: V.targets[0], final: true });
  }
  const r = mulberry32((c.seed + c.day * 977 + c.nextId * 13) >>> 0);
  const avail = VENUE_ORDER.filter((v) => VENUES[v].minJobs <= c.jobsDone);
  let n = c.contracts.filter((x) => !x.tutorial && !x.final).length, guard = 0;
  while (n < 3 && guard++ < 20) {
    const vid = pick(r, avail); const V = VENUES[vid];
    if (c.contracts.some((x) => x.venue === vid) && avail.length > 3) continue;
    const base = 1 + Math.floor(c.jobsDone / 2);
    const tier = clamp(base + (r() < 0.3 ? 1 : 0) - (r() < 0.2 ? 1 : 0), 1, 5);
    const fee = Math.round((V.baseFee * (0.85 + 0.15 * tier) * DIFFS[c.diff].pay * (1 + modsPay(c)) * (1 + Math.min(0.3, c.rep / 400))) / 10) * 10;
    c.contracts.push({ id: uid(c, 'k'), venue: vid, tier, seed: Math.floor(r() * 1e9), fee, client: pick(r, V.clients), expires: c.day + ri(r, 3, 5), targetName: pick(r, V.targets) });
    n++;
  }
}

// ---------- money / crew / gear ----------
export const casingCost = (c: Campaign, ct: Contract, level: number) => {
  if (level <= 0 || ct.tutorial) return 0;
  const disc = [1, 0.7, 0.4, 0.15][c.upgrades.intel]; return Math.round(((level === 1 ? 150 : 420) * ct.tier * disc) / 5) * 5;
};
export const rehearsalCost = (ct: Contract) => (ct.tutorial ? 0 : 80 * ct.tier);
export const gadgetCost = (c: Campaign, id: GadgetId) => Math.round(GADGETS[id].cost * (1 - 0.2 * c.upgrades.workshop));
export const hireCost = (c: Campaign, kind: CrewKind) => Math.round(CREW[kind].hire * (1 + 0.12 * c.crew.filter((m) => m.kind === kind).length));
export const trainCost = (m: CrewMember) => 900 * m.level;
export const bailCost = (c: Campaign, m: CrewMember) => Math.round((500 + 300 * m.level) * [1, 0.7, 0.45, 0.2][c.upgrades.lawyer]);
export const bribeCost = (c: Campaign) => Math.round(500 + c.heat * 12);

export type Res = { ok: boolean; msg: string };
const bad = (msg: string): Res => ({ ok: false, msg });
export function hire(c: Campaign, kind: CrewKind): Res {
  const cost = hireCost(c, kind); if (c.crew.length >= 8) return bad('Roster full (8).'); if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; const m: CrewMember = { id: uid(c, 'm'), kind, name: freshName(c), level: 1, status: 'ready', custodyDays: 0, jobs: 0 }; c.crew.push(m); return { ok: true, msg: `${m.name} joins as ${CREW[kind].name}.` };
}
export function train(c: Campaign, id: string): Res {
  const m = c.crew.find((x) => x.id === id); if (!m) return bad('No such crew.'); if (m.level >= 3) return bad('Already maxed.'); const cost = trainCost(m); if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; m.level++; return { ok: true, msg: `${m.name} trained to level ${m.level}.` };
}
export function payBail(c: Campaign, id: string): Res {
  const m = c.crew.find((x) => x.id === id); if (!m || m.status !== 'custody') return bad('Not in custody.'); const cost = bailCost(c, m); if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; m.status = 'ready'; m.custodyDays = 0; return { ok: true, msg: `${m.name} is out on bail.` };
}
export function buyGadget(c: Campaign, id: GadgetId): Res {
  const cost = gadgetCost(c, id); if (c.gadgets[id] >= 6) return bad('Max 6 carried.'); if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; c.gadgets[id]++; return { ok: true, msg: `Bought ${GADGETS[id].name}.` };
}
export function buyUpgrade(c: Campaign, id: UpgradeId): Res {
  const u = UPGRADES[id]; const lvl = c.upgrades[id]; if (lvl >= 3) return bad('Maxed.');
  if (u.requires && lvl >= 1 && c.upgrades[u.requires[0]] < u.requires[1]) return bad(`Requires ${UPGRADES[u.requires[0]].name} Lv${u.requires[1]}.`);
  if (u.requires && lvl === 0 && c.upgrades[u.requires[0]] < u.requires[1]) return bad(`Requires ${UPGRADES[u.requires[0]].name} Lv${u.requires[1]}.`);
  const cost = u.costs[lvl]; if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; c.upgrades[id]++; return { ok: true, msg: `${u.name} upgraded to Lv${c.upgrades[id]}.` };
}
export function bribe(c: Campaign): Res {
  if (c.bribedDay === c.day) return bad('The commissioner only takes one envelope per day.'); const cost = bribeCost(c); if (c.heat < 5) return bad('No heat worth bribing away.'); if (c.cash < cost) return bad('Not enough cash.');
  c.cash -= cost; c.stats.spent += cost; c.heat = Math.max(0, c.heat - 25); c.bribedDay = c.day; return { ok: true, msg: 'Heat -25. Files go missing.' };
}

// ---------- fence market ----------
export function fenceCut(c: Campaign, f: Fence) {
  let cut = f.cut + (c.mods.includes('thrift') ? 0.05 : 0); if (!f.heatProof) cut += 0.03 * heatTier(c.heat);
  cut -= Math.min(0.08, Math.floor((c.market.sold[f.id] ?? 0) / 4000) * 0.01); return clamp(cut, 0.08, 0.6);
}
export function quote(c: Campaign, f: Fence, l: Loot) {
  const bonus = f.bonus[l.cat] ?? 0.85; const hot = (l.hotUntil ?? 0) > c.day ? 0.7 : 1;
  return Math.round(l.value * c.market.mul[l.cat] * bonus * (1 - fenceCut(c, f)) * (1 - c.market.sat[l.cat]) * hot);
}
export function sellLoot(c: Campaign, fenceId: string, ids: string[]): Res {
  const f = FENCES.find((x) => x.id === fenceId); if (!f) return bad('Unknown fence.'); let total = 0, n = 0;
  for (const id of ids) {
    const i = c.stash.findIndex((l) => l.id === id); if (i < 0) continue; const l = c.stash[i]; const p = quote(c, f, l);
    total += p; n++; c.stash.splice(i, 1); c.market.sat[l.cat] = Math.min(0.5, c.market.sat[l.cat] + 0.05);
  }
  if (!n) return bad('Nothing selected.'); c.cash += total; c.stats.sold += total; c.market.sold[f.id] = (c.market.sold[f.id] ?? 0) + total;
  return { ok: true, msg: `Sold ${n} item${n > 1 ? 's' : ''} to ${f.name} for ${fmt(total)}.` };
}
function stepMarket(c: Campaign) {
  const m = c.market;
  for (const k of LOOT_CATS) { m.mul[k] = clamp(m.mul[k] + (Math.random() - 0.5) * 0.2 + (1 - m.mul[k]) * 0.12, 0.65, 1.7); m.sat[k] = Math.max(0, m.sat[k] - 0.04); }
  m.news = 'Quiet day on the black market.';
  if (Math.random() < 0.3) {
    const k = pick(Math.random, LOOT_CATS); const boom = Math.random() < 0.6;
    m.mul[k] = clamp(m.mul[k] + (boom ? 0.35 : -0.3), 0.6, 1.9);
    m.news = boom ? `Collectors are hungry: ${k} prices surge!` : `A glut of ${k} floods the market. Prices tumble.`;
  }
}

// ---------- day cycle / results ----------
export function advanceDay(c: Campaign, extraDecay = 0): string[] {
  const msgs: string[] = []; c.day++;
  const up = 40 * c.crew.length; c.cash -= up; msgs.push(`Day ${c.day}: crew upkeep ${fmt(up)}.`);
  const decay = (2 + 1.5 * c.upgrades.safehouse + extraDecay) * (c.diff === 'rookie' ? 1.3 : 1);
  c.heat = Math.max(0, c.heat - decay);
  for (const m of c.crew) if (m.status === 'custody') { m.custodyDays--; if (m.custodyDays <= 0) { m.status = 'ready'; msgs.push(`${m.name} was released from custody.`); } }
  stepMarket(c);
  if (c.heat >= 70 && c.stash.length && Math.random() < 0.3) { const i = Math.floor(Math.random() * c.stash.length); const l = c.stash.splice(i, 1)[0]; msgs.push(`Police raided a drop: ${l.name} (${fmt(l.value)}) seized!`); }
  if (c.heat >= 100) { c.raided = true; msgs.push('The syndicate hideout was raided at dawn.'); }
  genBoard(c);
  c.news = [...msgs, ...c.news].slice(0, 12); return msgs;
}
export function layLow(c: Campaign): string[] { return advanceDay(c, 7); }

export interface Summary { fee: number; bonus: number; heatGain: number; rep: number; lines: string[]; custody: string[]; lost: string[] }
export function applyResult(c: Campaign, ct: Contract, r: Result, crewIds: string[]): Summary {
  const lines: string[] = []; const custody: string[] = []; const lost: string[] = []; const D = DIFFS[c.diff];
  const fee = r.success ? ct.fee : 0; const bonus = r.success ? Math.round((ct.fee * 0.2 * (r.stars - 1)) / 10) * 10 : 0;
  c.cash += fee + bonus;
  const hot = r.alarmMax >= 2 ? c.day + 3 : 0;
  for (const l of r.loot) { c.stash.push({ ...l, hotUntil: hot || undefined }); }
  c.stats.stolen += r.lootValue; c.stats.jobs++; c.stats.takedowns += r.guardsDowned; if (r.success) c.stats.wins++; if (r.alarmMax >= 1) c.stats.alarms++; if (r.success && r.alarmMax === 0) c.stats.ghosts++;
  const lawyer = 1 - 0.25 * c.upgrades.lawyer;
  let heat = [2, 6, 14, 26][clamp(r.alarmMax, 0, 3)] + r.guardsDowned * 0.5 + r.bodies * 3 + r.captured.length * 8 * lawyer + (r.policeArrived ? 6 : 0);
  heat = ct.tutorial ? 0 : Math.round(heat * D.heat);
  c.heat = clamp(c.heat + heat, 0, 100);
  const rep = ct.tutorial ? 0 : r.success ? 8 + 4 * r.stars : -2; c.rep = Math.max(0, c.rep + rep);
  for (const id of crewIds) { const m = c.crew.find((x) => x.id === id); if (m) m.jobs++; }
  if (!ct.tutorial) for (const id of r.captured) {
    const m = c.crew.find((x) => x.id === id); if (!m) continue; c.stats.arrests++;
    if (c.mods.includes('iron')) { c.crew = c.crew.filter((x) => x.id !== id); lost.push(m.name); } else { m.status = 'custody'; m.custodyDays = 3; custody.push(m.name); }
  }
  c.contracts = c.contracts.filter((x) => x.id !== ct.id);
  if (ct.tutorial && r.success) { c.tutorialDone = true; lines.push('Training complete. The Old Man nods. Real jobs are on the board.'); }
  if (!ct.tutorial && r.success) c.jobsDone++;
  if (ct.final && r.success) { c.won = true; lines.push('THE MERIDIAN STAR IS YOURS.'); }
  if (!ct.tutorial) lines.push(...advanceDay(c));
  else genBoard(c);
  return { fee, bonus, heatGain: heat, rep, lines, custody, lost };
}

export type EndKind = 'raid' | 'bankrupt' | 'deadline';
export function checkEnd(c: Campaign): { kind: EndKind; title: string; text: string } | null {
  if (c.raided) return { kind: 'raid', title: 'RAIDED', text: 'The heat reached the boiling point. Police stormed the syndicate hideout at dawn. Everyone is in cuffs.' };
  if (c.cash < -1500) return { kind: 'bankrupt', title: 'BANKRUPT', text: 'The debts piled up. The crew walked out, and the syndicate dissolved.' };
  const stuck = !c.crew.some((m) => m.status === 'ready' || m.status === 'custody') && c.cash < 1500 && c.stash.length === 0;
  if (stuck) return { kind: 'bankrupt', title: 'NO CREW LEFT', text: 'With no crew, no stash and no cash, there is no syndicate left to run.' };
  if (!c.won && !c.freePlay && c.day > deadline(c)) return { kind: 'deadline', title: 'THE VAULT CLOSED', text: 'The Meridian exhibition ended and the vault was sealed for good. You ran out of time.' };
  return null;
}

export const lootTotal = (ls_: Loot[]) => ls_.reduce((a, l) => a + l.value, 0);
export const readyCrew = (c: Campaign) => c.crew.filter((m) => m.status === 'ready');
export { GADGET_IDS, UPGRADE_IDS };
