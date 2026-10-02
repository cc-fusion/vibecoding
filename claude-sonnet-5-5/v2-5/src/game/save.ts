export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  quality: 'high' | 'low';
}

export interface SaveData {
  legacy: number;
  upgrades: Record<string, number>;
  best: { wave: number; score: number; wins: number; runs: number; kills: number };
  settings: Settings;
  tutorialDone: boolean;
}

const KEY = 'orbital-foundry-logistics-v1';

export const defaultSave = (): SaveData => ({
  legacy: 0,
  upgrades: {},
  best: { wave: 0, score: 0, wins: 0, runs: 0, kills: 0 },
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, quality: 'high' },
  tutorialDone: false,
});

let memory: SaveData | null = null;

export function loadSave(): SaveData {
  if (memory) return memory;
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      memory = {
        legacy: Number(p.legacy) || 0,
        upgrades: typeof p.upgrades === 'object' && p.upgrades ? p.upgrades : {},
        best: { ...d.best, ...(p.best || {}) },
        settings: { ...d.settings, ...(p.settings || {}) },
        tutorialDone: !!p.tutorialDone,
      };
      return memory;
    }
  } catch {
    /* storage unavailable */
  }
  memory = d;
  return memory;
}

export function writeSave(s: SaveData) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: keep in-memory copy for the session */
  }
}

export function resetSave(): SaveData {
  const d = defaultSave();
  d.settings = loadSave().settings;
  writeSave(d);
  return d;
}
