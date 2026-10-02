const KEY = 'salvage-syndicate-wars-v1';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  edge: boolean;
}
export interface SaveData {
  renown: number;
  meta: Record<string, number>;
  settings: Settings;
  tutorialDone: boolean;
  bestScore: number;
  bestSector: number;
  runs: number;
  wins: number;
  totalDelivered: number;
  lastDiff: string;
  lastMods: string[];
}

const defaults = (): SaveData => ({
  renown: 0,
  meta: {},
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, edge: true },
  tutorialDone: false,
  bestScore: 0,
  bestSector: 0,
  runs: 0,
  wins: 0,
  totalDelivered: 0,
  lastDiff: 'operator',
  lastMods: [],
});

let mem: SaveData | null = null;

export function loadSave(): SaveData {
  if (mem) return mem;
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      mem = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, meta: { ...(p.meta || {}) } };
      return mem;
    }
  } catch {
    /* storage unavailable: fall back to memory */
  }
  mem = d;
  return mem;
}

export function writeSave(d: SaveData) {
  mem = d;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function resetSave(): SaveData {
  const d = defaults();
  writeSave(d);
  return d;
}
