// Safe localStorage persistence with in-memory fallback

export interface Meta {
  cp: number;
  perks: Record<string, number>;
  bestScore: number;
  bestDay: number;
  runs: number;
  wins: number;
  kills: number;
  unlockedCat: boolean;
  bestByDiff: Record<string, number>;
  seenHelp: boolean;
}
export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  particles: number;
  tips: boolean;
}

const MK = 'kaiju-adjuster-meta-v1';
const SK = 'kaiju-adjuster-settings-v1';
const mem: Record<string, string> = {};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return mem[key] ?? null;
  }
}
function write(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    mem[key] = v;
  }
}

export const defaultMeta = (): Meta => ({
  cp: 0, perks: {}, bestScore: 0, bestDay: 0, runs: 0, wins: 0, kills: 0, unlockedCat: false, bestByDiff: {}, seenHelp: false,
});
export const defaultSettings = (): Settings => ({
  master: 0.8, music: 0.55, sfx: 0.8, muted: false, shake: true, particles: 1, tips: true,
});

export function loadMeta(): Meta {
  try {
    const s = read(MK);
    if (s) return { ...defaultMeta(), ...JSON.parse(s) };
  } catch {
    /* ignore corrupt data */
  }
  return defaultMeta();
}
export function saveMeta(m: Meta) {
  write(MK, JSON.stringify(m));
}
export function loadSettings(): Settings {
  try {
    const s = read(SK);
    if (s) return { ...defaultSettings(), ...JSON.parse(s) };
  } catch {
    /* ignore corrupt data */
  }
  return defaultSettings();
}
export function saveSettings(s: Settings) {
  write(SK, JSON.stringify(s));
}
