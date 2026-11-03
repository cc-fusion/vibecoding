// Persistence: multiple worlds + settings in localStorage.
import type { Stack } from './items';
import type { TileEnt } from './world';

export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  mode: 'survival' | 'creative';
  created: number;
  lastPlayed: number;
}

export interface Stats {
  mined: number; placed: number; kills: number; deaths: number; distance: number; playSeconds: number; crafted: number;
}
export const emptyStats = (): Stats => ({ mined: 0, placed: 0, kills: 0, deaths: 0, distance: 0, playSeconds: 0, crafted: 0 });

export interface SaveData {
  meta: WorldMeta;
  time: number;
  dayCount: number;
  spawn: { x: number; y: number; z: number };
  player: { x: number; y: number; z: number; yaw: number; pitch: number; hp: number; hunger: number; fly: boolean };
  inventory: (Stack | null)[];
  selected: number;
  edits: [number, [number, number][]][]; // chunkKey -> [localIdx, blockId][]
  tiles: [string, TileEnt][];
  achievements: string[];
  stats: Stats;
}

const INDEX_KEY = 'voxelcraft.worlds.v1';
const WORLD_PREFIX = 'voxelcraft.world.v1.';
const SETTINGS_KEY = 'voxelcraft.settings.v1';

function readIndex(): WorldMeta[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]'); } catch { return []; }
}
function writeIndex(list: WorldMeta[]) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); } catch { /* full */ }
}

export function listWorlds(): WorldMeta[] {
  return readIndex().sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export function saveWorldData(data: SaveData) {
  try { localStorage.setItem(WORLD_PREFIX + data.meta.id, JSON.stringify(data)); } catch { /* quota */ }
  const idx = readIndex();
  const i = idx.findIndex(w => w.id === data.meta.id);
  if (i >= 0) idx[i] = data.meta; else idx.push(data.meta);
  writeIndex(idx);
}

export function loadWorldData(id: string): SaveData | null {
  try {
    const raw = localStorage.getItem(WORLD_PREFIX + id);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch { return null; }
}

export function deleteWorld(id: string) {
  try { localStorage.removeItem(WORLD_PREFIX + id); } catch { /* noop */ }
  writeIndex(readIndex().filter(w => w.id !== id));
}

export function registerWorld(meta: WorldMeta) {
  const idx = readIndex();
  if (!idx.find(w => w.id === meta.id)) { idx.push(meta); writeIndex(idx); }
}

export interface Settings {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  volume: number;
  music: boolean;
  quality: number; // max pixel ratio
  clouds: boolean;
  minimap: boolean;
  invertY: boolean;
}
export const defaultSettings = (): Settings => ({
  renderDistance: 6, fov: 75, sensitivity: 1, volume: 0.8, music: true, quality: 1.5, clouds: true, minimap: true, invertY: false,
});

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings(), ...JSON.parse(raw) } : defaultSettings();
  } catch { return defaultSettings(); }
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
