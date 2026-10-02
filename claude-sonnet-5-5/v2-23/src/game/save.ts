import { PART_LIST } from "./data";

export interface Settings {
  master: number; music: number; sfx: number; mute: boolean;
  shake: number; particles: "high" | "low"; floaters: boolean; autoEquip: boolean; flash: boolean;
}
export interface Stats { runs: number; wins: number; bestRound: number; bestScore: number; kills: number; rounds: number; bosses: number; merges: number }
export interface Meta {
  essence: number;
  up: Record<string, number>;
  unlocked: string[];
  seen: string[]; // parts discovered (codex)
  stats: Stats;
  tutorialDone: boolean;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.5, sfx: 0.8, mute: false, shake: 1, particles: "high", floaters: true, autoEquip: true, flash: true };

export function defaultMeta(): Meta {
  return {
    essence: 0,
    up: {},
    unlocked: PART_LIST.filter((p) => p.unlock === 0).map((p) => p.id),
    seen: [],
    stats: { runs: 0, wins: 0, bestRound: 0, bestScore: 0, kills: 0, rounds: 0, bosses: 0, merges: 0 },
    tutorialDone: false,
    settings: { ...DEFAULT_SETTINGS },
  };
}

const MEM: Record<string, string> = {};
function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return MEM[k] ?? null; }
}
function set(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { MEM[k] = v; }
}
function del(k: string) {
  try { localStorage.removeItem(k); } catch { delete MEM[k]; }
}

export function loadMeta(): Meta {
  const d = defaultMeta();
  try {
    const raw = get("chimera_forge_meta_v1");
    if (!raw) return d;
    const m = JSON.parse(raw);
    return {
      ...d, ...m,
      stats: { ...d.stats, ...(m.stats || {}) },
      settings: { ...d.settings, ...(m.settings || {}) },
      up: m.up || {},
      unlocked: Array.from(new Set([...d.unlocked, ...(m.unlocked || [])])),
      seen: m.seen || [],
    };
  } catch { return d; }
}
export function saveMeta(m: Meta) { set("chimera_forge_meta_v1", JSON.stringify(m)); }

export function loadRun<T>(): T | null {
  try { const r = get("chimera_forge_run_v1"); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
}
export function saveRun(r: unknown) { try { set("chimera_forge_run_v1", JSON.stringify(r)); } catch { /* ignore */ } }
export function clearRun() { del("chimera_forge_run_v1"); }

/** Small seeded PRNG so enemy lineups are deterministic per seed + round. */
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
