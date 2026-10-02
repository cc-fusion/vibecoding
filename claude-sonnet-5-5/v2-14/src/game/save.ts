// Safe localStorage wrapper + persistent meta-progression.

const KEY = 'terraform-ledger-v1';
const mem: Record<string, string> = {};

function read(): string | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v ?? mem[KEY] ?? null;
  } catch {
    return mem[KEY] ?? null;
  }
}
function write(v: string) {
  mem[KEY] = v;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable: session-only */
  }
}

export interface Settings {
  master: number; music: number; sfx: number; muted: boolean; shake: boolean; particles: boolean; tutorialDone: boolean;
}
export interface BestRun { world: string; diff: string; years: number; peakH: number; pop: number; win: boolean; score: number }
export interface Meta {
  lp: number; spent: number;
  perks: Record<string, number>;
  unlocked: string[];
  wins: number; runs: number;
  bests: Record<string, BestRun>;
  totalYears: number;
  settings: Settings;
  lastDiff: string; lastWorld: string; lastMods: string[];
}

export const defaultMeta = (): Meta => ({
  lp: 0, spent: 0, perks: {}, unlocked: ['rusthaven'], wins: 0, runs: 0, bests: {}, totalYears: 0,
  settings: { master: 0.7, music: 0.55, sfx: 0.7, muted: false, shake: true, particles: true, tutorialDone: false },
  lastDiff: 'engineer', lastWorld: 'rusthaven', lastMods: [],
});

export function loadMeta(): Meta {
  const base = defaultMeta();
  const raw = read();
  if (!raw) return base;
  try {
    const p = JSON.parse(raw) as Partial<Meta>;
    return {
      ...base, ...p,
      settings: { ...base.settings, ...(p.settings ?? {}) },
      perks: { ...(p.perks ?? {}) },
      bests: { ...(p.bests ?? {}) },
      unlocked: Array.isArray(p.unlocked) && p.unlocked.length ? p.unlocked : base.unlocked,
      lastMods: Array.isArray(p.lastMods) ? p.lastMods : [],
    };
  } catch {
    return base;
  }
}

export function saveMeta(m: Meta) {
  try {
    write(JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
