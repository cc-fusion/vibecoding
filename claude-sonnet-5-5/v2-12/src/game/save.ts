import { PlayableType, UNITS, XP_TIERS } from './data';

export interface RosterUnit {
  id: string;
  type: PlayableType;
  name: string;
  xp: number;
  promo: string[];
  kills: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  particles: number; // 0 low, 1 normal
  coach: boolean;
  diff: 'cadet' | 'officer' | 'admiral';
  mods: string[];
}

export interface Totals {
  battles: number;
  wins: number;
  kills: number;
  losses: number;
  hazard: number;
  rounds: number;
}

export interface Save {
  roster: RosterUnit[];
  stardust: number;
  research: Record<string, number>;
  cleared: number;
  stars: Record<number, number>;
  bestRounds: Record<number, number>;
  totals: Totals;
  settings: Settings;
  nextId: number;
  tutSeen: boolean;
  campaignDone: boolean;
}

const KEY = 'gravity-chess-tactics-v1';

const CALLSIGNS = [
  'Ada', 'Bohr', 'Curie', 'Dirac', 'Euler', 'Fermi', 'Gauss', 'Hawk', 'Ives', 'Jules', 'Kepler', 'Lovelace', 'Maxwell', 'Noether',
  'Oort', 'Planck', 'Quark', 'Rubin', 'Sagan', 'Tesla', 'Unruh', 'Vega', 'Wren', 'Xena', 'Yuri', 'Zeno', 'Nova', 'Orion', 'Lyra', 'Atlas',
];

export function nameFor(n: number): string {
  return CALLSIGNS[n % CALLSIGNS.length] + (n >= CALLSIGNS.length ? ' ' + (Math.floor(n / CALLSIGNS.length) + 1) : '');
}

export function defaultSave(): Save {
  const mk = (id: number, type: PlayableType): RosterUnit => ({ id: 'u' + id, type, name: nameFor(id), xp: 0, promo: [], kills: 0 });
  return {
    roster: [mk(0, 'core'), mk(1, 'mote'), mk(2, 'mote'), mk(3, 'mote'), mk(4, 'sling')],
    stardust: 20,
    research: {},
    cleared: 0,
    stars: {},
    bestRounds: {},
    totals: { battles: 0, wins: 0, kills: 0, losses: 0, hazard: 0, rounds: 0 },
    settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, particles: 1, coach: true, diff: 'officer', mods: [] },
    nextId: 5,
    tutSeen: false,
    campaignDone: false,
  };
}

export function loadSave(): Save {
  const def = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Save>;
    const s: Save = {
      ...def,
      ...p,
      settings: { ...def.settings, ...(p.settings || {}) },
      totals: { ...def.totals, ...(p.totals || {}) },
      research: p.research || {},
      stars: p.stars || {},
      bestRounds: p.bestRounds || {},
    };
    // validate roster
    s.roster = (Array.isArray(s.roster) ? s.roster : []).filter((r) => r && UNITS[r.type as PlayableType] && Array.isArray(r.promo));
    if (!s.roster.some((r) => r.type === 'core')) s.roster.unshift({ id: 'u' + s.nextId, type: 'core', name: nameFor(s.nextId), xp: 0, promo: [], kills: 0 });
    return s;
  } catch {
    return def;
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

export function resetSave(): Save {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  return defaultSave();
}

export function promoTier(u: RosterUnit): number {
  // number of promotions available to take right now (0 or 1)
  const t = u.promo.length;
  if (t >= XP_TIERS.length) return 0;
  return u.xp >= XP_TIERS[t] ? 1 : 0;
}
