// Safe localStorage persistence (guards against unavailable storage)
export interface RunRecord { date: number; leader: string; diff: string; result: "victory" | "defeat"; term: number; seats: number; passed: number; feathers: number; cause: string; }
export interface SaveData {
  feathers: number; upgrades: string[]; leaders: string[]; seenTutorial: boolean;
  stats: { runs: number; wins: number; bills: number; bestTerm: number; scandals: number; bribes: number; totalFeathers: number };
  history: RunRecord[]; winsByDiff: Record<string, number>;
  settings: { master: number; music: number; sfx: number; muted: boolean; shake: boolean; tutorial: boolean; lastDiff: string; lastLeader: string };
}
const KEY = "parliament-of-crows-v1";
export const defaultSave = (): SaveData => ({
  feathers: 0, upgrades: [], leaders: ["schemer", "idealist"], seenTutorial: false,
  stats: { runs: 0, wins: 0, bills: 0, bestTerm: 0, scandals: 0, bribes: 0, totalFeathers: 0 },
  history: [], winsByDiff: {},
  settings: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, tutorial: true, lastDiff: "corvid", lastLeader: "schemer" },
});
export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw);
    return { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, settings: { ...d.settings, ...(p.settings || {}) } };
  } catch { return d; }
}
export function writeSave(s: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: session-only */ }
}
export function wipeSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
