import { Layout, HULLS, STARTER_BUILD, DiffKey, ModsState, Resist } from "./data";
import { buildLayout, layoutCost } from "./ship";

export interface Settings {
  master: number; music: number; sfx: number; muted: boolean; shake: number;
  tutHangar: boolean; tutFlight: boolean;
}
export interface SaveData {
  version: 1;
  credits: number; data: number;
  tech: Record<string, number>;
  hull: string;
  layouts: Record<string, Layout>;
  cleared: number;
  best: Record<number, number>;
  adapt: Resist;
  diff: DiffKey;
  mods: ModsState;
  settings: Settings;
  life: { kills: number; sorties: number; losses: number; credits: number; time: number; bosses: number };
}

const KEY = "starforge-shipwright-v1"; // localStorage key
let memory: string | null = null;

export const defaultSettings = (): Settings => ({
  master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: 1, tutHangar: false, tutFlight: false,
});

export function newCampaign(settings?: Settings): SaveData {
  const skiff = HULLS[0];
  const layout = buildLayout(skiff, STARTER_BUILD);
  return {
    version: 1,
    credits: 420 - layoutCost(layout) + 560,
    data: 3,
    tech: {},
    hull: "skiff",
    layouts: { skiff: layout },
    cleared: 0,
    best: {},
    adapt: { energy: 0, kinetic: 0, explosive: 0 },
    diff: "veteran",
    mods: { glass: false, blackout: false, swarm: false },
    settings: settings || defaultSettings(),
    life: { kills: 0, sorties: 0, losses: 0, credits: 0, time: 0, bosses: 0 },
  };
}

export function hasSave(): boolean {
  try { return !!(localStorage.getItem(KEY) || memory); } catch { return !!memory; }
}

export function loadSave(): SaveData {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = memory; }
  if (!raw) raw = memory;
  if (raw) {
    try {
      const p = JSON.parse(raw) as SaveData;
      if (p && p.version === 1 && p.layouts && p.settings) {
        const d = newCampaign();
        return { ...d, ...p, settings: { ...defaultSettings(), ...p.settings }, mods: { ...d.mods, ...p.mods }, life: { ...d.life, ...p.life }, adapt: { ...d.adapt, ...p.adapt } };
      }
    } catch { /* corrupted save */ }
  }
  return newCampaign();
}

export function persist(s: SaveData) {
  const raw = JSON.stringify(s);
  memory = raw;
  try { localStorage.setItem(KEY, raw); } catch { /* storage unavailable */ }
}
