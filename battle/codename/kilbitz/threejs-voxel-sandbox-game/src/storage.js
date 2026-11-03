const INDEX_KEY = 'voxel-sanctuary.worlds.v1';
const WORLD_PREFIX = 'voxel-sanctuary.world.v1.';
const SETTINGS_KEY = 'voxel-sanctuary.settings.v1';

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Storage is unavailable' };
  }
}

export class WorldStorage {
  list() {
    const worlds = readJSON(INDEX_KEY, []);
    return Array.isArray(worlds) ? worlds.filter((world) => world && world.id).sort((a, b) => b.lastPlayed - a.lastPlayed) : [];
  }

  create(name, seed, mode = 'survival') {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    const meta = {
      id,
      name: String(name || 'New Sanctuary').trim().slice(0, 32) || 'New Sanctuary',
      seed: String(seed || Math.floor(Math.random() * 1e9)).trim().slice(0, 40),
      mode: mode === 'peaceful' ? 'peaceful' : 'survival',
      created: now,
      lastPlayed: now,
      playTime: 0,
    };
    const worlds = this.list().filter((world) => world.id !== id);
    worlds.push(meta);
    const result = writeJSON(INDEX_KEY, worlds);
    return result.ok ? meta : null;
  }

  load(id) {
    const meta = this.list().find((world) => world.id === id);
    if (!meta) return null;
    return { meta, data: readJSON(WORLD_PREFIX + id, {}) };
  }

  save(id, data) {
    const worlds = this.list();
    const meta = worlds.find((world) => world.id === id);
    if (!meta) return { ok: false, error: 'World not found' };
    meta.lastPlayed = Date.now();
    meta.playTime = Number(data.playTime) || 0;
    meta.level = Number(data.level) || 1;
    const indexResult = writeJSON(INDEX_KEY, worlds);
    if (!indexResult.ok) return indexResult;
    return writeJSON(WORLD_PREFIX + id, data);
  }

  delete(id) {
    const result = writeJSON(INDEX_KEY, this.list().filter((world) => world.id !== id));
    try { localStorage.removeItem(WORLD_PREFIX + id); } catch { /* index is already updated */ }
    return result;
  }

  loadSettings() {
    return {
      renderDistance: 4,
      fov: 75,
      sensitivity: 1,
      volume: 0.65,
      ...readJSON(SETTINGS_KEY, {}),
    };
  }

  saveSettings(settings) {
    return writeJSON(SETTINGS_KEY, settings);
  }
}
