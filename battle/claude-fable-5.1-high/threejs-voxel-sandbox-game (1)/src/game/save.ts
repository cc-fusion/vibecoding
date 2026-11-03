// localStorage persistence: worlds index + per-world save data.
import type { Stack } from "./inventory";

export type GameMode = "survival" | "creative";
export type Difficulty = "peaceful" | "normal";

export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  seedText: string;
  mode: GameMode;
  difficulty: Difficulty;
  created: number;
  lastPlayed: number;
  playTime: number;
  version: number;
}

export interface SaveData {
  player: { x: number; y: number; z: number; yaw: number; pitch: number; health: number; hunger: number; saturation: number; xp: number; flying: boolean; spawn: { x: number; y: number; z: number } };
  inventory: { slots: (Stack | null)[]; selected: number };
  sky: { time: number; weather: string; weatherTimer: number };
  chunks: Record<string, number[]>;
  achievements: string[];
  stats: Record<string, number>;
  playTime: number;
}

export interface Settings {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  master: number;
  sfx: number;
  music: number;
  ambient: number;
  showDebug: boolean;
  bobbing: boolean;
  particles: boolean;
  invertY: boolean;
}

const INDEX_KEY = "voxelcraft:worlds";
const SETTINGS_KEY = "voxelcraft:settings";
const WORLD_PREFIX = "voxelcraft:world:";

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 7,
  fov: 75,
  sensitivity: 1,
  master: 0.8,
  sfx: 1,
  music: 0.5,
  ambient: 0.7,
  showDebug: false,
  bobbing: true,
  particles: true,
  invertY: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export function listWorlds(): WorldMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) return (JSON.parse(raw) as WorldMeta[]).sort((a, b) => b.lastPlayed - a.lastPlayed);
  } catch { /* ignore */ }
  return [];
}

function writeIndex(list: WorldMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export function createWorldMeta(name: string, seedText: string, mode: GameMode, difficulty: Difficulty, seed: number): WorldMeta {
  const meta: WorldMeta = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name,
    seed,
    seedText,
    mode,
    difficulty,
    created: Date.now(),
    lastPlayed: Date.now(),
    playTime: 0,
    version: 1,
  };
  const list = listWorlds();
  list.unshift(meta);
  writeIndex(list);
  return meta;
}

export function updateWorldMeta(meta: WorldMeta) {
  const list = listWorlds().filter((w) => w.id !== meta.id);
  list.unshift(meta);
  writeIndex(list);
}

export function deleteWorld(id: string) {
  writeIndex(listWorlds().filter((w) => w.id !== id));
  localStorage.removeItem(WORLD_PREFIX + id);
}

export function loadWorldData(id: string): SaveData | null {
  try {
    const raw = localStorage.getItem(WORLD_PREFIX + id);
    if (raw) return JSON.parse(raw) as SaveData;
  } catch { /* ignore */ }
  return null;
}

export function saveWorldData(id: string, data: SaveData): boolean {
  try {
    localStorage.setItem(WORLD_PREFIX + id, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("Save failed", e);
    return false;
  }
}

export function storageUsageKB(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith("voxelcraft:")) total += (localStorage.getItem(k)?.length ?? 0) * 2;
  }
  return Math.round(total / 1024);
}
