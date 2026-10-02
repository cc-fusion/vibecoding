import { PERKS } from "./data";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  hints: boolean;
}

export interface ClearRecord { best: number; diff: string; wins: number }

export interface SaveData {
  seals: number;
  perks: Record<string, number>;
  cleared: Record<string, ClearRecord>;
  settings: Settings;
  runs: number;
  wins: number;
  totalRecruits: number;
  tutorialDone: boolean;
}

const KEY = "coup-detat-protocol-v1";

export function defaultSave(): SaveData {
  return {
    seals: 0,
    perks: {},
    cleared: {},
    settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, hints: true },
    runs: 0,
    wins: 0,
    totalRecruits: 0,
    tutorialDone: false,
  };
}

let memory: string | null = null;

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY) ?? memory;
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<SaveData>;
    const perks: Record<string, number> = {};
    PERKS.forEach((pk) => {
      const v = p.perks?.[pk.id];
      if (typeof v === "number") perks[pk.id] = Math.max(0, Math.min(3, Math.floor(v)));
    });
    return {
      ...base,
      ...p,
      perks,
      cleared: p.cleared ?? {},
      settings: { ...base.settings, ...(p.settings ?? {}) },
    };
  } catch {
    return base;
  }
}

export function persist(s: SaveData) {
  const raw = JSON.stringify(s);
  memory = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* storage unavailable: session memory only */
  }
}

export function wipeSave(): SaveData {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return defaultSave();
}
