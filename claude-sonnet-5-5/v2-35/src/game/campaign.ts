import { CLASSES, DIFFICULTIES, GEAR, MODIFIERS, NAMES_FIRST, NAMES_LAST, XP_LEVELS, MISSIONS } from './data';

export interface RosterUnit {
  id: number;
  kind: string;
  name: string;
  level: number;
  xp: number;
  perks: string[];
  gear: string | null;
  pendingPerks: number;
  kills: number;
  missions: number;
  deploy: boolean;
}

export interface Fallen {
  name: string;
  kind: string;
  level: number;
  mission: string;
  cause: string;
  kills: number;
}

export interface CampaignStats {
  kills: number;
  lost: number;
  rounds: number;
  envKills: number;
  missions: number;
  damage: number;
  shores: number;
}

export interface Campaign {
  seed: number;
  diff: string;
  mods: string[];
  roster: RosterUnit[];
  nextId: number;
  crowns: number;
  gear: string[];
  done: number[];
  tier: number;
  fallen: Fallen[];
  stats: CampaignStats;
  status: 'active' | 'won' | 'lost';
  retries: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  particles: 'high' | 'low';
  numbers: boolean;
}

export interface Meta {
  laurels: number;
  tech: Record<string, number>;
  settings: Settings;
  best: { score: number; wins: number; campaigns: number; kills: number };
  tutorialDone: boolean;
}

const META_KEY = 'hexfall_meta_v1';
const CAMP_KEY = 'hexfall_campaign_v1';
const mem: Record<string, string> = {};

function readStore(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return mem[k] ?? null;
  }
}
function writeStore(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    mem[k] = v;
  }
}
function delStore(k: string) {
  try {
    window.localStorage.removeItem(k);
  } catch {
    delete mem[k];
  }
}

export function defaultMeta(): Meta {
  return {
    laurels: 0,
    tech: {},
    settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, particles: 'high', numbers: true },
    best: { score: 0, wins: 0, campaigns: 0, kills: 0 },
    tutorialDone: false,
  };
}

export function loadMeta(): Meta {
  const d = defaultMeta();
  try {
    const raw = readStore(META_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Meta>;
    return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, best: { ...d.best, ...(p.best || {}) }, tech: p.tech || {} };
  } catch {
    return d;
  }
}
export function saveMeta(m: Meta) {
  writeStore(META_KEY, JSON.stringify(m));
}
export function loadCampaign(): Campaign | null {
  try {
    const raw = readStore(CAMP_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Campaign;
    if (!c || !Array.isArray(c.roster) || c.status !== 'active') return null;
    return c;
  } catch {
    return null;
  }
}
export function saveCampaign(c: Campaign | null) {
  if (!c || c.status !== 'active') delStore(CAMP_KEY);
  else writeStore(CAMP_KEY, JSON.stringify(c));
}

export function techLevel(meta: Meta, id: string): number {
  return meta.tech[id] || 0;
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) lvl = i + 1;
  return lvl;
}

export function randomName(): string {
  return NAMES_FIRST[Math.floor(Math.random() * NAMES_FIRST.length)] + ' ' + NAMES_LAST[Math.floor(Math.random() * NAMES_LAST.length)];
}

interface StatSrc {
  kind: string;
  level: number;
  perks: string[];
  gear: string | null;
}

export function maxHpFor(u: StatSrc): number {
  const d = CLASSES[u.kind];
  return d.hp + (u.level - 1) * 2 + (u.perks.includes('tough') ? 4 : 0) + (u.gear === 'plate' ? 3 : 0);
}

export function baseStatsFor(u: StatSrc) {
  const d = CLASSES[u.kind];
  const ranged = d.rmax > 1;
  return {
    atk: d.atk + (u.level >= 3 ? 1 : 0) + (u.level >= 5 ? 1 : 0) + (u.perks.includes('keen') ? 1 : 0) + (u.gear === 'whetstone' ? 1 : 0),
    move: d.move + (u.perks.includes('fleet') ? 1 : 0) + (u.gear === 'plate' ? -1 : 0) + (u.gear === 'spyglass' && !ranged ? 1 : 0),
    armor: d.armor + (u.perks.includes('ironskin') ? 1 : 0) + (u.gear === 'plate' ? 1 : 0),
    rmin: d.rmin,
    rmax: d.rmax + (ranged && u.perks.includes('longarm') ? 1 : 0) + (ranged && u.gear === 'spyglass' ? 1 : 0),
  };
}

export function newRecruit(c: Campaign, kind: string, meta: Meta): RosterUnit {
  const academy = techLevel(meta, 'academy');
  const veteran = academy >= 2;
  const ru: RosterUnit = {
    id: c.nextId++,
    kind,
    name: randomName(),
    level: veteran ? 2 : 1,
    xp: veteran ? XP_LEVELS[1] : 0,
    perks: [],
    gear: null,
    pendingPerks: veteran ? 1 : 0,
    kills: 0,
    missions: 0,
    deploy: true,
  };
  return ru;
}

export function createCampaign(diff: string, mods: string[], classes: string[], meta: Meta): Campaign {
  const d = DIFFICULTIES.find((x) => x.id === diff) || DIFFICULTIES[1];
  const c: Campaign = {
    seed: Math.floor(Math.random() * 1e9),
    diff,
    mods,
    roster: [],
    nextId: 1,
    crowns: d.start + techLevel(meta, 'chest') * 8,
    gear: [],
    done: [],
    tier: 0,
    fallen: [],
    stats: { kills: 0, lost: 0, rounds: 0, envKills: 0, missions: 0, damage: 0, shores: 0 },
    status: 'active',
    retries: 0,
  };
  classes.forEach((k) => c.roster.push(newRecruit(c, k, meta)));
  if (techLevel(meta, 'armory') > 0) c.gear.push('oilskin', 'waders');
  return c;
}

export function deployCap(meta: Meta): number {
  return 4 + techLevel(meta, 'barracks');
}

export function rewardMult(c: Campaign): number {
  const d = DIFFICULTIES.find((x) => x.id === c.diff) || DIFFICULTIES[1];
  let m = d.laurel;
  c.mods.forEach((id) => {
    const mod = MODIFIERS.find((x) => x.id === id);
    if (mod) m += mod.bonus;
  });
  return m;
}

export function campaignScore(c: Campaign): number {
  const lv = c.roster.reduce((a, u) => a + u.level, 0);
  const base = c.stats.missions * 100 + c.stats.kills * 5 + c.stats.envKills * 8 + lv * 20 + Math.floor(c.crowns / 2) - c.stats.lost * 30;
  return Math.max(0, Math.round(base * rewardMult(c)));
}

export function gearDef(id: string | null) {
  return id ? GEAR.find((g) => g.id === id) || null : null;
}

export function availableMissions(c: Campaign) {
  return MISSIONS.filter((m) => m.tier === c.tier);
}
