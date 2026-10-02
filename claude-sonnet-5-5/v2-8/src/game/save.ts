export interface Settings {
  master: number; music: number; sfx: number; muted: boolean; shake: boolean; diff: number; mods: string[]; touch: boolean;
}
export interface Lifetime { runs: number; wins: number; distance: number; bestScore: number; bestLegs: number; raiders: number; }
export interface SaveData {
  renown: number; levels: Record<string, number>; settings: Settings; life: Lifetime; tutorialDone: boolean;
}

const KEY = "glacier-caravan-save-v1";

export const defaultSave = (): SaveData => ({
  renown: 0,
  levels: {},
  settings: { master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, diff: 1, mods: [], touch: false },
  life: { runs: 0, wins: 0, distance: 0, bestScore: 0, bestLegs: 0, raiders: 0 },
  tutorialDone: false,
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  if (memory) return memory;
  const base = defaultSave();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      memory = {
        ...base,
        ...p,
        settings: { ...base.settings, ...(p.settings || {}) },
        life: { ...base.life, ...(p.life || {}) },
        levels: { ...(p.levels || {}) },
      };
      return memory;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  memory = base;
  return memory;
}

export function persist(data: SaveData): void {
  memory = data;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / privacy-mode errors; session memory still holds progress */
  }
}

export function resetSave(): SaveData {
  const d = defaultSave();
  persist(d);
  return d;
}
