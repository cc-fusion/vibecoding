import type { Dynasty } from "./lineage";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  numbers: boolean;
}
export interface HallEntry {
  house: string;
  result: "won" | "lost";
  reason: string;
  gens: number;
  years: number;
  bosses: number;
  difficulty: string;
  score: number;
}
export interface SaveData {
  v: 1;
  settings: Settings;
  marks: number;
  perks: Record<string, number>;
  hall: HallEntry[];
  dynasty: Dynasty | null;
  tutorialDone: boolean;
}

export const defaultSettings = (): Settings => ({ master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, numbers: true });
export const defaultSave = (): SaveData => ({ v: 1, settings: defaultSettings(), marks: 0, perks: {}, hall: [], dynasty: null, tutorialDone: false });

const KEY = "heirloom-dynasty-save-v1";
let memory: string | null = null;

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) ?? memory;
    if (!raw) return defaultSave();
    const p = JSON.parse(raw);
    const d = defaultSave();
    return {
      v: 1,
      settings: { ...d.settings, ...(p.settings || {}) },
      marks: Number(p.marks) || 0,
      perks: p.perks && typeof p.perks === "object" ? p.perks : {},
      hall: Array.isArray(p.hall) ? p.hall.slice(0, 30) : [],
      dynasty: p.dynasty && p.dynasty.hero && p.dynasty.status === "playing" ? p.dynasty : null,
      tutorialDone: !!p.tutorialDone,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: SaveData) {
  const raw = JSON.stringify(s);
  memory = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* storage unavailable: session memory only */
  }
}
