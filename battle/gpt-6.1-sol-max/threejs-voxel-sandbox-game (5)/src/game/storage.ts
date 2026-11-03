import { B, BLOCKS } from './blocks';
import type { Settings, WorldSave } from './types';

const WORLDS_KEY = 'everwild.worlds.v1';
const ACTIVE_KEY = 'everwild.active.v1';
const SETTINGS_KEY = 'everwild.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  volume: 45, sensitivity: 42, renderDistance: 5, fov: 72,
  shadows: true, autoStep: true, weather: 'auto', mode: 'explorer',
};

export function newWorld(name = 'Willowmere', seed = 'WILLOW-017'): WorldSave {
  return {
    version: 1, id: crypto.randomUUID(), name, seed,
    createdAt: Date.now(), updatedAt: Date.now(), position: null, spawn: null,
    yaw: 0.62, pitch: -0.19,
    inventory: { [B.GRASS]: 32, [B.STONE]: 24, [B.LOG]: 12, [B.PLANKS]: 32, [B.LEAVES]: 16, [B.GLASS]: 12, [B.TORCH]: 8, [B.WOOD_PICK]: 1, [B.APPLE]: 5 },
    hotbar: [B.GRASS, B.STONE, B.LOG, B.PLANKS, B.LEAVES, B.GLASS, B.TORCH, B.WOOD_PICK, B.APPLE],
    selected: 0, edits: [], time: 0.32, day: 1, health: 20,
    stats: { gathered: {}, crafted: {}, placed: 0, distance: 0, biomes: [], completed: [] },
  };
}

export function getWorlds(): WorldSave[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(WORLDS_KEY) || '[]');
    if (Array.isArray(data)) return data.filter(isWorldSave);
  } catch { /* A damaged save never prevents a new world from opening. */ }
  return [];
}

export function isWorldSave(data: unknown): data is WorldSave {
  if (!data || typeof data !== 'object') return false;
  const w = data as WorldSave;
  const validPosition = (p: unknown) => p === null || (Array.isArray(p) && p.length === 3 && p.every(n => Number.isFinite(n) && Math.abs(n) < 10000000));
  const validCounts = (counts: unknown) => !!counts && typeof counts === 'object' && !Array.isArray(counts) && Object.entries(counts).every(([id, count]) => !!BLOCKS[Number(id)] && Number.isFinite(count) && count >= 0);
  return w.version === 1 && typeof w.id === 'string' && typeof w.name === 'string' && w.name.length <= 80 && typeof w.seed === 'string' && w.seed.length <= 120
    && Array.isArray(w.edits) && w.edits.length < 500000 && w.edits.every(e => Array.isArray(e) && typeof e[0] === 'string' && /^-?\d{1,7},\d{1,2},-?\d{1,7}$/.test(e[0]) && Number.isInteger(e[1]) && !!BLOCKS[e[1]] && e[1] < 108)
    && Array.isArray(w.hotbar) && w.hotbar.length === 9 && w.hotbar.every(id => !!BLOCKS[id])
    && validCounts(w.inventory) && Number.isInteger(w.selected) && w.selected >= 0 && w.selected <= 8
    && !!w.stats && Array.isArray(w.stats.completed) && Array.isArray(w.stats.biomes)
    && w.stats.completed.every(s => typeof s === 'string') && w.stats.biomes.every(s => typeof s === 'string')
    && validCounts(w.stats.gathered) && validCounts(w.stats.crafted) && Number.isFinite(w.stats.distance) && Number.isFinite(w.stats.placed)
    && Number.isFinite(w.time) && w.time >= 0 && w.time <= 1 && Number.isFinite(w.health) && w.health >= 0 && w.health <= 20
    && Number.isFinite(w.day) && w.day >= 1 && Number.isFinite(w.yaw) && Number.isFinite(w.pitch)
    && validPosition(w.position) && validPosition(w.spawn);
}

export function persistWorld(world: WorldSave) {
  const worlds = getWorlds();
  const index = worlds.findIndex(w => w.id === world.id);
  if (index === -1) worlds.push(world); else worlds[index] = world;
  localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  localStorage.setItem(ACTIVE_KEY, world.id);
}

export function getActiveWorld(): WorldSave {
  const worlds = getWorlds();
  let active: string | null = null;
  try { active = localStorage.getItem(ACTIVE_KEY); } catch { /* Private browsing can disallow storage. */ }
  return worlds.find(w => w.id === active) || worlds[0] || newWorld();
}

export function deleteWorld(id: string) {
  localStorage.setItem(WORLDS_KEY, JSON.stringify(getWorlds().filter(w => w.id !== id)));
}

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const range = (key: keyof Settings, min: number, max: number) => Number.isFinite(saved[key]) ? Math.max(min, Math.min(max, saved[key])) : DEFAULT_SETTINGS[key] as number;
    return {
      volume: range('volume', 0, 100), sensitivity: range('sensitivity', 5, 100), fov: range('fov', 55, 100), renderDistance: Math.round(range('renderDistance', 3, 7)),
      shadows: typeof saved.shadows === 'boolean' ? saved.shadows : DEFAULT_SETTINGS.shadows,
      autoStep: typeof saved.autoStep === 'boolean' ? saved.autoStep : DEFAULT_SETTINGS.autoStep,
      mode: saved.mode === 'creative' ? 'creative' : 'explorer', weather: ['auto', 'clear', 'rain'].includes(saved.weather) ? saved.weather : 'auto',
    };
  }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Settings are still usable in memory. */ }
}