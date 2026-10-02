export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; tutorial: boolean }
export interface SaveData {
  legacyPoints: number;
  legacy: Record<string, number>;
  unlocked: number;
  best: Record<string, { stars: number; score: number }>;
  settings: Settings;
  totals: { wins: number; losses: number; popRaised: number };
}

const KEY = 'aqueduct-architects-v1';

export const defaultSave = (): SaveData => ({
  legacyPoints: 0,
  legacy: {},
  unlocked: 1,
  best: {},
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, tutorial: true },
  totals: { wins: 0, losses: 0, popRaised: 0 },
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  if (memory) return memory;
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      memory = {
        ...d, ...p,
        settings: { ...d.settings, ...(p.settings || {}) },
        totals: { ...d.totals, ...(p.totals || {}) },
        legacy: p.legacy || {},
        best: p.best || {},
      };
      return memory;
    }
  } catch { /* storage unavailable */ }
  memory = d;
  return memory;
}

export function writeSave(s: SaveData) {
  memory = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function resetSave(): SaveData {
  const d = defaultSave();
  writeSave(d);
  return d;
}
