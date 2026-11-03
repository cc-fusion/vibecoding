export interface WorldMeta { id: string; name: string; seed: number; mode: 'survival' | 'creative'; created: number; lastPlayed: number; days?: number }

const LIST_KEY = 'voxelcraft:worlds';
const DATA_KEY = (id: string) => `voxelcraft:world:${id}`;
const SETTINGS_KEY = 'voxelcraft:settings';

export function listWorlds(): WorldMeta[] {
  try { return (JSON.parse(localStorage.getItem(LIST_KEY) || '[]') as WorldMeta[]).sort((a, b) => b.lastPlayed - a.lastPlayed); } catch { return []; }
}
export function saveMeta(meta: WorldMeta) {
  const list = listWorlds().filter(w => w.id !== meta.id);
  list.push(meta);
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}
export function deleteWorld(id: string) {
  localStorage.setItem(LIST_KEY, JSON.stringify(listWorlds().filter(w => w.id !== id)));
  localStorage.removeItem(DATA_KEY(id));
}
export function loadWorldData<T>(id: string): T | null {
  try { const s = localStorage.getItem(DATA_KEY(id)); return s ? JSON.parse(s) as T : null; } catch { return null; }
}
export function saveWorldData(id: string, data: unknown): boolean {
  try { localStorage.setItem(DATA_KEY(id), JSON.stringify(data)); return true; } catch (e) { console.warn('Save failed', e); return false; }
}

export interface Settings { renderDistance: number; fov: number; sensitivity: number; volume: number; music: boolean; bobbing: boolean }
export const defaultSettings: Settings = { renderDistance: 6, fov: 75, sensitivity: 1, volume: 0.6, music: true, bobbing: true };
export function loadSettings(): Settings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...defaultSettings }; }
}
export function saveSettings(s: Settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
