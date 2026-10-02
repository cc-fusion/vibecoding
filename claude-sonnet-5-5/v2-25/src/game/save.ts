// Persistent meta-progression (localStorage with in-memory fallback)

export interface SaveData {
  shards: number;
  upgrades: Record<string, number>;
  bestDay: number;
  wins: number;
  runs: number;
  totalKills: number;
  bosses: number;
  settings: { master: number; music: number; sfx: number; muted: boolean; shake: boolean; tutorialSeen: boolean };
}

const KEY = 'graveyard-shift-necropolis-v1';

export const defaultSave = (): SaveData => ({
  shards: 0,
  upgrades: {},
  bestDay: 0,
  wins: 0,
  runs: 0,
  totalKills: 0,
  bosses: 0,
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, tutorialSeen: false },
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      return { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) }, upgrades: { ...(p.upgrades || {}) } };
    }
  } catch {
    if (memory) return memory;
  }
  return memory ?? base;
}

export function writeSave(s: SaveData) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: session-only persistence */
  }
}
