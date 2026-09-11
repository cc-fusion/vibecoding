// Persistence (localStorage): world list, per-world saves (block edits + player), settings.
import type { Stack } from "./inventory";

export type GameMode = "survival" | "creative";

export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  mode: GameMode;
  created: number;
  lastPlayed: number;
}

export interface WorldSave {
  meta: WorldMeta;
  edits: Record<string, number[]>;
  /** undefined for a freshly created world (spawn point not yet chosen) */
  player?: { pos: [number, number, number]; yaw: number; pitch: number; health: number; air: number; flying: boolean };
  inventory: { slots: (Stack | null)[]; selected: number };
  time: number;
  spawn: [number, number, number];
  stats: { blocksMined: number; blocksPlaced: number; crafted: number; deaths: number; playTime: number };
}

export interface Settings {
  renderDistance: number;
  sensitivity: number;
  volume: number;
  musicVolume: number;
  fov: number;
  viewBobbing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 6,
  sensitivity: 1,
  volume: 0.7,
  musicVolume: 0.5,
  fov: 75,
  viewBobbing: true,
};

const INDEX_KEY = "voxelcraft:worlds";
const WORLD_KEY = (id: string) => `voxelcraft:world:${id}`;
const SETTINGS_KEY = "voxelcraft:settings";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const Saves = {
  list(): WorldMeta[] {
    const arr = read<WorldMeta[]>(INDEX_KEY) ?? [];
    return arr.filter((m) => m && typeof m.id === "string").sort((a, b) => b.lastPlayed - a.lastPlayed);
  },
  upsertMeta(meta: WorldMeta) {
    const list = Saves.list().filter((m) => m.id !== meta.id);
    list.push(meta);
    write(INDEX_KEY, list);
  },
  load(id: string): WorldSave | null {
    const s = read<WorldSave>(WORLD_KEY(id));
    if (!s || !s.meta) return null;
    return s;
  },
  save(s: WorldSave): boolean {
    const ok = write(WORLD_KEY(s.meta.id), s);
    if (ok) Saves.upsertMeta(s.meta);
    return ok;
  },
  delete(id: string) {
    try {
      localStorage.removeItem(WORLD_KEY(id));
    } catch {
      /* ignore */
    }
    write(
      INDEX_KEY,
      Saves.list().filter((m) => m.id !== id),
    );
  },
  settings(): Settings {
    return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
  },
  saveSettings(s: Settings) {
    write(SETTINGS_KEY, s);
  },
  newId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
};
