export interface Settings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  shake: number;
  dmgNumbers: boolean;
  autoPause: boolean;
}

export interface SaveData {
  aether: number;
  lifetimeAether: number;
  research: Record<string, number>;
  best: Record<string, number>;
  wins: number;
  runs: number;
  totalKills: number;
  bossKills: number;
  tutorialDone: boolean;
  lastDifficulty: string;
  mutators: string[];
  settings: Settings;
}

const KEY = "stormcallers-pass-v1";

export function defaultSave(): SaveData {
  return {
    aether: 0,
    lifetimeAether: 0,
    research: {},
    best: {},
    wins: 0,
    runs: 0,
    totalKills: 0,
    bossKills: 0,
    tutorialDone: false,
    lastDifficulty: "stormcaller",
    mutators: [],
    settings: { master: 0.7, sfx: 0.8, music: 0.5, muted: false, shake: 1, dmgNumbers: true, autoPause: true },
  };
}

let memory: string | null = null;

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : memory;
    if (!raw) return d;
    const p = JSON.parse(raw);
    return {
      ...d,
      ...p,
      research: { ...(p.research || {}) },
      best: { ...(p.best || {}) },
      mutators: Array.isArray(p.mutators) ? p.mutators : [],
      settings: { ...d.settings, ...(p.settings || {}) },
    };
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData) {
  const raw = JSON.stringify(s);
  memory = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* storage unavailable: the in-memory copy keeps the session working */
  }
}

export function clearSave() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
