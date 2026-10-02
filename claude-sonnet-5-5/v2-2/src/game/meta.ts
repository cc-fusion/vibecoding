import { ARCH, ArchId, CAT_IDS, Cat, DIFFS, DiffId, GADGETS, GadgetId, LOOT, ModId, NAMES, SkillId, Skills, TPLS, TraitId, TRAITS, repTier, CAPSTONE_TIER, rng32 } from './data';
import { BuildOpts } from './mapgen';
import { HeistResult } from './sim';

export interface CrewMember { id: string; name: string; arch: ArchId; lvl: number; xp: number; sp: number; skills: Skills; trait: TraitId | null; jail: number; heists: number }
export interface Contract { id: string; tpl: string; seed: number; client: string; fee: number; mod: string; expires: number; recon: number; capstone?: boolean }
export interface MarketEvent { name: string; desc: string; cat: Cat | null; mult: number; days: number }
export interface Market { idx: Record<Cat, number>; hist: Record<Cat, number[]>; event: MarketEvent | null }
export interface Meta {
  v: number; diff: DiffId; mods: Record<ModId, boolean>; day: number; cash: number; heat: number; rep: number;
  crew: CrewMember[]; recruits: CrewMember[]; gadgets: Record<GadgetId, number>; upgrades: Record<string, number>;
  stash: { kind: string; value: number }[]; market: Market; contracts: Contract[]; news: string[];
  stats: { heists: number; success: number; earned: number; arrests: number; alarms: number; ghosts: number; kos: number; stolen: number; best: number; fenced: number };
  flags: { tutorialDone: boolean; won: boolean };
  idc: number;
}

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; reduceFlash: boolean; speed: number }
export const DEFAULT_SETTINGS: Settings = { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, reduceFlash: false, speed: 1 };

const SAVE_KEY = 'meridian_syndicate_save_v1';
const SET_KEY = 'meridian_syndicate_settings_v1';
export const safeGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
export const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
export const safeDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };

export function loadSettings(): Settings {
  try { const s = safeGet(SET_KEY); if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) }; } catch { /* corrupt */ }
  return { ...DEFAULT_SETTINGS };
}
export const saveSettings = (s: Settings) => safeSet(SET_KEY, JSON.stringify(s));
export function loadMeta(): Meta | null {
  try { const s = safeGet(SAVE_KEY); if (!s) return null; const m = JSON.parse(s) as Meta; if (!m || m.v !== 1 || !Array.isArray(m.crew)) return null; return m; } catch { return null; }
}
export const saveMeta = (m: Meta) => safeSet(SAVE_KEY, JSON.stringify(m));
export const clearSave = () => safeDel(SAVE_KEY);
export const cloneMeta = (m: Meta): Meta => JSON.parse(JSON.stringify(m));

const rnd = () => Math.random();
const pickOne = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

export const wageOf = (m: Meta, c: CrewMember) => Math.round((40 + c.lvl * 25) * DIFFS[m.diff].wage * (c.trait === 'greedy' ? 1.25 : 1) / 5) * 5;
export const hireCost = (c: CrewMember) => Math.round(ARCH[c.arch].hire * (0.75 + 0.25 * c.lvl) / 10) * 10;
export const bailCost = (m: Meta, c: CrewMember) => Math.round((400 + c.lvl * 150) * (1 - 0.35 * (m.upgrades.lawyer || 0)) / 10) * 10;
export const gadgetCost = (m: Meta, g: GadgetId) => Math.round(GADGETS[g].cost * (1 - 0.15 * (m.upgrades.workshop || 0)));
export const crewSlots = (m: Meta) => 3 + (m.upgrades.table || 0);
export const gadgetSlots = (m: Meta) => 3 + (m.upgrades.armory || 0);
export const fenceCut = (m: Meta) => Math.min(0.6, Math.max(0.08, 0.32 - 0.04 * (m.upgrades.fence || 0) + m.heat / 400));
export const needXp = (lvl: number) => 80 * lvl;

export function makeCrew(m: { idc: number; crew: CrewMember[]; recruits: CrewMember[] }, arch?: ArchId, lvl = 1): CrewMember {
  const a = arch ?? pickOne(Object.keys(ARCH) as ArchId[]);
  const used = new Set([...m.crew, ...m.recruits].map(c => c.name));
  const free = NAMES.filter(n => !used.has(n));
  const name = pickOne(free.length ? free : NAMES);
  const traits = Object.keys(TRAITS) as TraitId[];
  const trait: TraitId | null = rnd() < 0.7 ? pickOne(traits) : null;
  let L = lvl; if (trait === 'veteran') L = Math.max(L, 2);
  const skills = { ...ARCH[a].base };
  const c: CrewMember = { id: 'c' + (++m.idc), name, arch: a, lvl: L, xp: 0, sp: 0, skills, trait, jail: 0, heists: 0 };
  // spread levels into primary skills so recruits at higher levels are stronger
  const keys = Object.keys(skills) as SkillId[];
  for (let i = 1; i < L; i++) { const k = rnd() < 0.5 ? keys.reduce((b, x) => skills[x] > skills[b] ? x : b, keys[0]) : pickOne(keys); skills[k] = Math.min(6, skills[k] + 1); }
  return c;
}

const EVENTS: Omit<MarketEvent, 'days'>[] = [
  { name: 'Collector Craze', desc: 'Art buyers are paying a premium.', cat: 'art', mult: 1.6 },
  { name: 'Gold Rush', desc: 'Bullion demand is soaring.', cat: 'gold', mult: 1.5 },
  { name: 'Cyber Panic', desc: 'Data brokers are desperate.', cat: 'data', mult: 1.7 },
  { name: 'Jewel Glut', desc: 'Too many gems on the street.', cat: 'jewels', mult: 0.65 },
  { name: 'Museum Scandal', desc: 'Nobody wants to touch relics.', cat: 'relic', mult: 0.6 },
  { name: 'Billionaire Spree', desc: 'A collector is buying every relic.', cat: 'relic', mult: 1.6 },
  { name: 'Customs Crackdown', desc: 'All prices are soft this week.', cat: null, mult: 0.8 },
  { name: 'Gold Crash', desc: 'A bullion dump tanks prices.', cat: 'gold', mult: 0.65 },
];

export function newMarket(): Market {
  const idx = {} as Record<Cat, number>, hist = {} as Record<Cat, number[]>;
  CAT_IDS.forEach(c => { idx[c] = c === 'cash' ? 1 : 0.85 + rnd() * 0.3; hist[c] = Array.from({ length: 14 }, () => idx[c] * (0.92 + rnd() * 0.16)); hist[c][13] = idx[c]; });
  return { idx, hist, event: null };
}
function stepMarket(mk: Market, log: string[]) {
  if (mk.event) {
    mk.event.days--;
    if (mk.event.days <= 0) { log.push(`Market event ended: ${mk.event.name}.`); mk.event = null; }
  } else if (rnd() < 0.25) {
    const e = pickOne(EVENTS);
    mk.event = { ...e, days: 4 + Math.floor(rnd() * 3) };
    log.push(`MARKET: ${e.name} - ${e.desc}`);
  }
  CAT_IDS.forEach(c => {
    if (c === 'cash') return;
    let v = mk.idx[c];
    v += (1 - v) * 0.08 + (rnd() - 0.5) * 0.12;
    if (mk.event && (mk.event.cat === c || mk.event.cat === null)) v += (mk.event.mult - v) * 0.3;
    mk.idx[c] = Math.min(2.2, Math.max(0.45, v));
    mk.hist[c].push(mk.idx[c]); if (mk.hist[c].length > 24) mk.hist[c].shift();
  });
}

export function newMeta(diff: DiffId, mods: Record<ModId, boolean>): Meta {
  const d = DIFFS[diff];
  const m: Meta = {
    v: 1, diff, mods, day: 1, cash: Math.round(d.cash * (mods.lean ? 0.5 : 1)), heat: 0, rep: 0, crew: [], recruits: [],
    gadgets: { smoke: 1, noise: 1, emp: 0, dart: 0, jammer: 0, drill: 0, flash: 0 }, upgrades: {}, stash: [], market: newMarket(), contracts: [], news: ['Welcome to the Meridian Heist Syndicate. Take a contract to begin.'],
    stats: { heists: 0, success: 0, earned: 0, arrests: 0, alarms: 0, ghosts: 0, kos: 0, stolen: 0, best: 0, fenced: 0 }, flags: { tutorialDone: false, won: false }, idc: 0,
  };
  m.crew.push(makeCrew(m, 'locksmith'), makeCrew(m, 'ghost'));
  m.recruits = genRecruits(m);
  refreshContracts(m);
  return m;
}

export function genRecruits(m: Meta): CrewMember[] {
  const out: CrewMember[] = [];
  const t = repTier(m.rep);
  const archs = (Object.keys(ARCH) as ArchId[]).sort(() => rnd() - 0.5).slice(0, 4);
  for (const a of archs) { const tmp = { idc: m.idc, crew: m.crew, recruits: out }; const c = makeCrew(tmp, a, 1 + Math.floor(rnd() * Math.min(3, t))); m.idc = tmp.idc; out.push(c); }
  return out;
}

export function refreshContracts(m: Meta) {
  m.contracts = m.contracts.filter(c => c.expires > m.day && !(c.capstone && m.flags.won));
  const t = repTier(m.rep);
  if (t >= CAPSTONE_TIER && !m.flags.won && !m.contracts.some(c => c.capstone)) {
    m.contracts.push({ id: 'cap' + m.day, tpl: 'meridian', seed: Math.floor(rnd() * 1e9), client: 'The Syndicate Council', fee: 10000, mod: 'none', expires: 9999, recon: 0, capstone: true });
    m.news.unshift('The Council has handed you the Meridian Vault contract. The capstone job awaits.');
  }
  const pool = Object.values(TPLS).filter(p => p.tier > 0 && !p.boss && p.tier <= t);
  let guard = 0;
  while (m.contracts.filter(c => !c.capstone).length < 4 && guard++ < 20) {
    const p = pickOne(pool);
    const mods = ['none', 'none', 'rich', 'tight', 'night', 'audit'];
    const mod = pickOne(mods);
    m.contracts.push({ id: 'k' + Math.floor(rnd() * 1e9), tpl: p.id, seed: Math.floor(rnd() * 1e9), client: pickOne(p.clients), fee: Math.round(p.basePay * (0.85 + rnd() * 0.3) / 10) * 10, mod, expires: m.day + 4 + Math.floor(rnd() * 4), recon: 0 });
  }
}

export function worldOpts(m: Meta, c: Contract): BuildOpts {
  const heat = m.heat;
  return { guardMul: DIFFS[m.diff].guards, extraGuards: (heat >= 50 ? 1 : 0) + (heat >= 75 ? 1 : 0), extraHeavy: heat >= 75 ? 1 : 0, mod: c.mod, lootMul: m.mods.lean ? 1.25 : 1 };
}

export function advanceDay(m: Meta, lay: boolean): string[] {
  const log: string[] = [];
  m.day++;
  const wages = m.crew.filter(c => c.jail <= 0).reduce((s, c) => s + wageOf(m, c), 0);
  m.cash -= wages;
  if (wages) log.push(`Paid $${wages.toLocaleString()} in crew wages.`);
  const decay = 2 + 2 * (m.upgrades.forger || 0) + (lay ? 6 : 0);
  if (m.heat > 0) { m.heat = Math.max(0, m.heat - decay); log.push(`Heat fell by ${decay}.`); }
  m.crew.forEach(c => { if (c.jail > 0) { c.jail--; if (c.jail <= 0) log.push(`${c.name} is out of jail.`); } });
  stepMarket(m.market, log);
  refreshContracts(m);
  if (m.day % 3 === 0) m.recruits = genRecruits(m);
  m.news = [...log, ...m.news].slice(0, 14);
  return log;
}

export function sellItems(m: Meta, kind: 'cat' | 'one', cat: Cat, count: number): number {
  let total = 0;
  const cut = fenceCut(m);
  for (let n = 0; n < count; n++) {
    let bi = -1, bv = -1;
    m.stash.forEach((s, i) => { if (LOOT[s.kind].cat === cat && s.value > bv) { bv = s.value; bi = i; } });
    if (bi < 0) break;
    const item = m.stash[bi];
    const price = Math.round(item.value * m.market.idx[cat] * (1 - cut));
    m.stash.splice(bi, 1);
    m.cash += price; total += price; m.stats.fenced += price; m.stats.earned += price;
    m.market.idx[cat] = Math.max(0.45, m.market.idx[cat] * 0.96);
    if (kind === 'one') break;
  }
  return total;
}
export const stashValue = (m: Meta, cat: Cat) => m.stash.filter(s => LOOT[s.kind].cat === cat).reduce((a, s) => a + Math.round(s.value * m.market.idx[cat] * (1 - fenceCut(m))), 0);

export interface Summary {
  tutorial: boolean; success: boolean; payout: number; cashLoot: number; stashed: number; repGain: number; heatGain: number;
  crewXp: { id: string; name: string; xp: number; level: number | null; arrested: boolean; lost: boolean }[]; won: boolean; rank: string; log: string[]; result: HeistResult; tplName: string; leveled: string[];
}

export function applyResult(m: Meta, contract: Contract, r: HeistResult): Summary {
  const tpl = TPLS[contract.tpl];
  const log: string[] = [];
  if (r.tutorial) {
    if (!m.flags.tutorialDone && r.success) { m.flags.tutorialDone = true; m.cash += 500; log.push('Training complete! The Old Fixer slips you $500.'); }
    return { tutorial: true, success: r.success, payout: 0, cashLoot: 0, stashed: 0, repGain: 0, heatGain: 0, crewXp: [], won: false, rank: r.success ? 'A' : 'C', log, result: r, tplName: tpl.name, leveled: [] };
  }
  const d = DIFFS[m.diff];
  let payout = 0, cashLoot = 0, stashed = 0, repGain = 0;
  if (r.success) {
    payout = Math.round(contract.fee * (1 + r.bonusPct / 100));
    m.cash += payout;
    for (const l of r.loot) {
      if (LOOT[l.kind].cat === 'cash') cashLoot += Math.round(l.value * 0.88);
      else { m.stash.push({ kind: l.kind, value: l.value }); stashed += l.value; }
    }
    m.cash += cashLoot;
    repGain = Math.round(20 * tpl.tier + r.lootValue / 200 + (r.bonuses.find(b => b.id === 'ghost')?.ok ? 15 : 0) + r.bonusPct / 5);
    m.rep += repGain;
    m.stats.success++; m.stats.earned += payout + cashLoot; m.stats.stolen += r.lootValue; m.stats.best = Math.max(m.stats.best, r.lootValue + payout);
    if (r.bonuses.find(b => b.id === 'ghost')?.ok) m.stats.ghosts++;
    log.push(`Contract paid $${payout.toLocaleString()}${r.bonusPct ? ` (+${r.bonusPct}% bonus)` : ''}.`);
  } else log.push('The job failed. No payout.');
  m.stats.heists++; m.stats.alarms += r.stats.hard; m.stats.kos += r.stats.kos; m.stats.arrests += r.arrested.length;

  // heat
  let heatGain = r.heatDelta * d.heat * (m.mods.paranoid ? 1.25 : 1);
  if (!r.success) heatGain += 3;
  heatGain = Math.round(heatGain);
  m.heat = Math.min(100, m.heat + heatGain);

  // crew
  const crewXp: Summary['crewXp'] = [];
  const leveled: string[] = [];
  const lostIds: string[] = [];
  for (const id of r.crewIds) {
    const c = m.crew.find(x => x.id === id); if (!c) continue;
    const arrested = r.arrested.includes(id);
    let xp = 30 + 20 * tpl.tier + (r.success ? 40 : 0) + Math.round(r.bonusPct / 2);
    if (arrested) xp = Math.round(xp / 2);
    c.xp += xp; c.heists++;
    let lv: number | null = null;
    while (c.lvl < 8 && c.xp >= needXp(c.lvl)) { c.xp -= needXp(c.lvl); c.lvl++; c.sp++; lv = c.lvl; }
    if (lv) leveled.push(`${c.name} reached level ${lv}`);
    let lost = false;
    if (arrested) {
      if (m.mods.iron) { lost = true; lostIds.push(id); log.push(`${c.name} is gone for good (Iron Crew).`); }
      else { c.jail = Math.max(1, 3 - (m.upgrades.lawyer || 0)); log.push(`${c.name} is in jail for ${c.jail} day(s). Bail: $${bailCost(m, c)}.`); }
    }
    crewXp.push({ id, name: c.name, xp, level: lv, arrested, lost });
  }
  m.crew = m.crew.filter(c => !lostIds.includes(c.id));
  Object.entries(r.gadgetsUsed).forEach(([g, n]) => { m.gadgets[g as GadgetId] = Math.max(0, (m.gadgets[g as GadgetId] || 0) - n); });

  const won = !!(contract.capstone && r.success && r.carriedCore);
  if (won) { m.flags.won = true; log.push('THE MERIDIAN CORE IS YOURS. The Syndicate is yours.'); }

  const dayLog = advanceDay(m, false);
  log.push(...dayLog.filter(l => !l.startsWith('MARKET') && !l.includes('Market')));
  const score = (r.success ? 50 : 0) + r.bonusPct + (r.arrested.length ? -15 : 10) + Math.min(30, r.lootValue / 400);
  const rank = !r.success ? 'F' : score >= 110 ? 'S' : score >= 85 ? 'A' : score >= 60 ? 'B' : 'C';
  return { tutorial: false, success: r.success, payout, cashLoot, stashed, repGain, heatGain, crewXp, won, rank, log, result: r, tplName: tpl.name, leveled };
}

export type EndReason = 'raid' | 'debt' | 'broke' | null;
export function checkEnd(m: Meta): EndReason {
  if (m.heat >= 100) return 'raid';
  if (m.cash < -1000) return 'debt';
  if (m.crew.length === 0 && m.cash < 700 && m.stash.length === 0) return 'broke';
  return null;
}

export const seedRng = rng32;
