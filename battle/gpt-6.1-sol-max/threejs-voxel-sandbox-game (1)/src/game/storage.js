const KEY = 'wildwood.worlds.v1';
const SETTINGS_KEY = 'wildwood.settings.v1';
export const DEFAULT_SETTINGS = { volume: 0.45, sensitivity: 0.9, distance: 4, fov: 76, shadows: true, weather: 'auto', showCoordinates: false };

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }
export function listWorlds() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function loadWorld(id) {
  try { return JSON.parse(localStorage.getItem(`wildwood.world.${id}`) || 'null'); } catch { return null; }
}
export function saveWorld(data) {
  try {
    localStorage.setItem(`wildwood.world.${data.id}`, JSON.stringify(data));
    const worlds = listWorlds().filter(w => w.id !== data.id);
    worlds.unshift({ id: data.id, name: data.name, seed: data.seed, mode: data.mode, updated: Date.now(), day: Math.floor(data.elapsed / 720) + 1 });
    localStorage.setItem(KEY, JSON.stringify(worlds));
    return true;
  } catch { return false; }
}
export function deleteWorld(id) {
  localStorage.removeItem(`wildwood.world.${id}`);
  localStorage.setItem(KEY, JSON.stringify(listWorlds().filter(w => w.id !== id)));
}

export function createWorld(name = 'The Meadowlands', seed = 'wildwood', mode = 'survival') {
  return {
    id: `world-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, seed, mode,
    elapsed: 0, time: 0.34, health: 10, stamina: 100, position: null, rotation: null, selected: 0,
    inventory: [
      { id: 1, count: 32 }, { id: 8, count: 24 }, { id: 9, count: 16 }, { id: 4, count: 8 },
      { id: 10, count: 8 }, { id: 15, count: 6 }, { id: 104, count: 1 }, { id: 17, count: 8 }, { id: 107, count: 3 },
      ...Array.from({ length: 27 }, () => null),
    ],
    changes: {}, stats: { broken: 0, placed: 0, crafted: 0, wood: 0, distance: 0, biomes: ['Meadow'], recipes: [], rewards: [] },
  };
}