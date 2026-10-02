export interface Settings {
  master: number; sfx: number; music: number; muted: boolean;
  shake: number; // 0 off, 0.5 low, 1 full
  particles: number; // 0.4 low, 0.7 med, 1 high
  hitbox: boolean;
  autoPause: boolean;
}

export interface SaveData {
  ash: number;
  unlockedCards: string[];
  unlockedOrders: string[];
  meta: Record<string, number>;
  settings: Settings;
  records: { runs: number; wins: number; kills: number; grazes: number; bosses: number; bestAct: number; bestScore: Record<string, number>; playtime: number };
  tutorialDone: boolean;
  setup: { order: string; diff: string; vows: string[] };
}

export const defaultSave = (): SaveData => ({
  ash: 0,
  unlockedCards: [],
  unlockedOrders: ["acolyte"],
  meta: {},
  settings: { master: 0.8, sfx: 0.8, music: 0.5, muted: false, shake: 1, particles: 0.7, hitbox: false, autoPause: true },
  records: { runs: 0, wins: 0, kills: 0, grazes: 0, bosses: 0, bestAct: 0, bestScore: {}, playtime: 0 },
  tutorialDone: false,
  setup: { order: "acolyte", diff: "zealot", vows: [] },
});

const KEY = "bullet-liturgy-save-v1";
let memory: string | null = null;

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY) ?? memory;
    if (!raw) return d;
    const o = JSON.parse(raw);
    return {
      ...d, ...o,
      settings: { ...d.settings, ...(o.settings || {}) },
      records: { ...d.records, ...(o.records || {}), bestScore: { ...(o.records?.bestScore || {}) } },
      setup: { ...d.setup, ...(o.setup || {}) },
      meta: { ...(o.meta || {}) },
      unlockedCards: Array.isArray(o.unlockedCards) ? o.unlockedCards : [],
      unlockedOrders: Array.isArray(o.unlockedOrders) && o.unlockedOrders.length ? o.unlockedOrders : ["acolyte"],
    };
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData) {
  const raw = JSON.stringify(s);
  memory = raw;
  try { localStorage.setItem(KEY, raw); } catch { /* storage unavailable: keep in-memory copy */ }
}

export function wipeSave(): SaveData {
  memory = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaultSave();
}
