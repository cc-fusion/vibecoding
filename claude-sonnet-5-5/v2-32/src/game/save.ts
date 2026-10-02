import type { InstId } from './data';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  offset: number; // ms input latency compensation
  shake: number; // 0..1
  tick: boolean; // metronome click
  difficulty: string;
  mods: string[];
}

export interface SaveData {
  opus: number;
  totalOpus: number;
  upg: Record<string, number>;
  unlocked: InstId[];
  cleared: Record<string, number>; // level id -> best stars
  tutorialDone: boolean;
  settings: Settings;
  best: { kills: number; combo: number; encoreWave: number; victories: number; runs: number };
}

const KEY = 'orchestra-of-automata-v1';

export function defaultSave(): SaveData {
  return {
    opus: 0,
    totalOpus: 0,
    upg: {},
    unlocked: [],
    cleared: {},
    tutorialDone: false,
    settings: { master: 0.8, music: 0.7, sfx: 0.8, muted: false, offset: 0, shake: 1, tick: true, difficulty: 'allegro', mods: [] },
    best: { kills: 0, combo: 0, encoreWave: 0, victories: 0, runs: 0 },
  };
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw);
    return {
      ...d,
      ...p,
      settings: { ...d.settings, ...(p.settings || {}) },
      best: { ...d.best, ...(p.best || {}) },
      upg: p.upg || {},
      unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
      cleared: p.cleared || {},
    };
  } catch {
    return d;
  }
}

export function persist(s: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}

export function wipeSave(): SaveData {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return defaultSave();
}
