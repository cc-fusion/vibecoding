export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  particles: number; // 0 low 1 med 2 high
}

export interface LifeStats {
  dives: number;
  deaths: number;
  totalMarks: number;
  creatures: number;
  nodes: number;
  deepest: number;
  seconds: number;
}

export interface SaveData {
  marks: number;
  upgrades: Record<string, number>;
  unlocked: number;
  clears: number[];
  bestHaul: number[];
  codex: number[];
  tutorialDone: boolean;
  won: boolean;
  difficulty: string;
  mods: string[];
  settings: Settings;
  life: LifeStats;
}

export const DEFAULT_SETTINGS: Settings = { master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: true, particles: 2 };

export function freshSave(settings?: Settings): SaveData {
  return {
    marks: 0,
    upgrades: {},
    unlocked: 0,
    clears: [0, 0, 0, 0, 0],
    bestHaul: [0, 0, 0, 0, 0],
    codex: [],
    tutorialDone: false,
    won: false,
    difficulty: 'standard',
    mods: [],
    settings: settings || { ...DEFAULT_SETTINGS },
    life: { dives: 0, deaths: 0, totalMarks: 0, creatures: 0, nodes: 0, deepest: 0, seconds: 0 },
  };
}

const KEY = 'sunken-archive-dive-v1';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const p = JSON.parse(raw);
    const f = freshSave();
    return {
      ...f,
      ...p,
      settings: { ...f.settings, ...(p.settings || {}) },
      life: { ...f.life, ...(p.life || {}) },
      clears: Array.isArray(p.clears) ? p.clears.concat([0, 0, 0, 0, 0]).slice(0, 5) : f.clears,
      bestHaul: Array.isArray(p.bestHaul) ? p.bestHaul.concat([0, 0, 0, 0, 0]).slice(0, 5) : f.bestHaul,
      upgrades: p.upgrades || {},
      codex: Array.isArray(p.codex) ? p.codex : [],
      mods: Array.isArray(p.mods) ? p.mods : [],
    };
  } catch {
    return freshSave();
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: session-only progress */
  }
}
