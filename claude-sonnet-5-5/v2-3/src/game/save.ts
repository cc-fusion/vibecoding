import type { SaveData } from "./types";

const KEY = "cartographers-lament-v1";

export const defaultSave = (): SaveData => ({
  renown: 0,
  lifetime: 0,
  upgrades: {},
  classes: ["surveyor"],
  lore: [],
  tutorialDone: false,
  runs: 0,
  wins: 0,
  best: [],
  totals: { charted: 0, kills: 0, landmarks: 0 },
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, psycho: true },
  lastCfg: { difficulty: "cartographer", mods: [], classId: "surveyor", tutorial: true },
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
        ...d,
        ...p,
        settings: { ...d.settings, ...(p.settings || {}) },
        totals: { ...d.totals, ...(p.totals || {}) },
        lastCfg: { ...d.lastCfg, ...(p.lastCfg || {}) },
        upgrades: p.upgrades || {},
        classes: p.classes && p.classes.length ? p.classes : ["surveyor"],
        lore: p.lore || [],
        best: p.best || [],
      };
      return memory;
    }
  } catch {
    /* storage unavailable or corrupted */
  }
  memory = d;
  return memory;
}

export function writeSave(s: SaveData) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore: session-only progress */
  }
}

export function resetSave() {
  memory = defaultSave();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
