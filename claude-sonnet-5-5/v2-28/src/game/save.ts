// Persistent save data with safe localStorage access

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  difficulty: string;
  mods: string[];
}

export interface SaveData {
  seeds: number;
  owned: string[];
  bestWave: number;
  bestScore: number;
  runs: number;
  wins: number;
  kills: number;
  reactions: number;
  tutorialDone: boolean;
  settings: Settings;
}

const KEY = "weather-warden-save-v1";

const defaults = (): SaveData => ({
  seeds: 0,
  owned: [],
  bestWave: 0,
  bestScore: 0,
  runs: 0,
  wins: 0,
  kills: 0,
  reactions: 0,
  tutorialDone: false,
  settings: { master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: true, difficulty: "farmer", mods: [] },
});

let cache: SaveData | null = null;

export function getSave(): SaveData {
  if (cache) return cache;
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      cache = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) } };
      if (!Array.isArray(cache.owned)) cache.owned = [];
      if (!Array.isArray(cache.settings.mods)) cache.settings.mods = [];
      return cache;
    }
  } catch {
    /* storage unavailable */
  }
  cache = d;
  return cache;
}

export function updateSave(fn: (s: SaveData) => void): SaveData {
  const s = getSave();
  fn(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: session-only */
  }
  return s;
}

export function resetSave(): SaveData {
  cache = defaults();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return cache;
}
