export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; }
export interface CityBest { stars: number; score: number; wins: number; }
export interface SaveData {
  legacy: number; perks: Record<string, number>; unlocked: number;
  best: Record<string, CityBest>; settings: Settings;
  tutorialDone: boolean; runs: number; wins: number; lastDiff: string; lastMods: string[];
  totalSaved: number; totalLost: number;
}

const KEY = "plague-doctors-quarantine-v1";
export const defaultSave = (): SaveData => ({
  legacy: 0, perks: {}, unlocked: 1, best: {},
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true },
  tutorialDone: false, runs: 0, wins: 0, lastDiff: "physician", lastMods: [], totalSaved: 0, totalLost: 0,
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      return { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) }, perks: { ...(p.perks || {}) }, best: { ...(p.best || {}) } };
    }
  } catch { /* storage unavailable or corrupt: fall back to defaults */ }
  return memory ? { ...memory } : base;
}

export function persist(data: SaveData) {
  memory = data;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* session-only progress */ }
}
