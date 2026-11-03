const INDEX_KEY = 'voxelcraft.worlds';
const SETTINGS_KEY = 'voxelcraft.settings';

export function listWorlds() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; }
}
function writeIndex(list) { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); }

export function createWorldMeta(name, seed, mode) {
  const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const meta = { id, name, seed, mode, created: Date.now(), played: Date.now(), playtime: 0 };
  const list = listWorlds(); list.unshift(meta); writeIndex(list);
  return meta;
}
export function updateWorldMeta(id, patch) {
  const list = listWorlds(); const i = list.findIndex(w => w.id === id);
  if (i >= 0) { Object.assign(list[i], patch); writeIndex(list); }
}
export function deleteWorld(id) {
  writeIndex(listWorlds().filter(w => w.id !== id));
  localStorage.removeItem('voxelcraft.world.' + id);
}
export function saveWorldData(id, data) {
  try { localStorage.setItem('voxelcraft.world.' + id, JSON.stringify(data)); return true; }
  catch (e) { console.warn('Save failed', e); return false; }
}
export function loadWorldData(id) {
  try { const s = localStorage.getItem('voxelcraft.world.' + id); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function loadSettings() {
  const def = { renderDistance: 7, sensitivity: 1, volume: 0.6, fov: 75 };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return def; }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
