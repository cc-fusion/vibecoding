export interface Settings {
  master: number; sfx: number; music: number; muted: boolean; shake: number; difficulty: string; mods: string[];
}
export interface Save {
  souls: number;
  levels: Record<string, number>;
  tutorialDone: boolean;
  settings: Settings;
  lifetime: { runs: number; wins: number; kills: number; bestWave: number; bosses: number; totalSouls: number };
}
const KEY = 'dungeon-lords-ledger-v1';

export const defaultSave = (): Save => ({
  souls: 0,
  levels: {},
  tutorialDone: false,
  settings: { master: 0.7, sfx: 0.8, music: 0.5, muted: false, shake: 1, difficulty: 'overlord', mods: [] },
  lifetime: { runs: 0, wins: 0, kills: 0, bestWave: 0, bosses: 0, totalSouls: 0 },
});

let memory: Save | null = null;

export function loadSave(): Save {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ...d, ...p,
        settings: { ...d.settings, ...(p.settings || {}) },
        lifetime: { ...d.lifetime, ...(p.lifetime || {}) },
        levels: { ...(p.levels || {}) },
      };
    }
  } catch {
    /* storage unavailable – fall back to memory */
  }
  return memory ? memory : d;
}

export function writeSave(s: Save) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function resetSave(): Save {
  const d = defaultSave();
  writeSave(d);
  return d;
}
