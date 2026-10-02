import type { DiffId, ModId } from "./data";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  diff: DiffId;
  mods: ModId[];
  hints: boolean;
}

export interface SaveData {
  credits: number;
  upgrades: Record<string, number>;
  stars: number[];
  tutorialDone: boolean;
  bestEndless: number;
  stats: { shifts: number; meltdowns: number; scrams: number; mwh: number; revenue: number };
  settings: Settings;
  victory: boolean;
}

const KEY = "reactor-shift-supervisor-v1";

export const defaultSave = (): SaveData => ({
  credits: 60,
  upgrades: {},
  stars: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  tutorialDone: false,
  bestEndless: 0,
  stats: { shifts: 0, meltdowns: 0, scrams: 0, mwh: 0, revenue: 0 },
  settings: { master: 0.7, music: 0.6, sfx: 0.8, muted: false, shake: true, diff: "operator", mods: [], hints: true },
  victory: false,
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      return {
        ...base,
        ...p,
        stats: { ...base.stats, ...(p.stats || {}) },
        settings: { ...base.settings, ...(p.settings || {}) },
        stars: Array.from({ length: 9 }, (_, i) => (p.stars && typeof p.stars[i] === "number" ? p.stars[i] : 0)),
        upgrades: { ...(p.upgrades || {}) },
      };
    }
  } catch {
    /* storage unavailable */
  }
  return memory ? { ...memory } : base;
}

export function writeSave(s: SaveData) {
  memory = s;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: fall back to memory */
  }
}

export function wipeSave(): SaveData {
  memory = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return defaultSave();
}
