import type { Slots, FurnaceState } from './inventory';

export type GameMode = 'survival' | 'creative';
export interface WorldMeta { id: string; name: string; seed: number; seedText: string; mode: GameMode; created: number; played: number }
export interface SaveData {
  v: 1;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; health: number; hunger: number; sat: number; flying: boolean };
  inv: Slots; sel: number; time: number; day: number;
  weather: { rain: number; target: number; timer: number; thunder: boolean };
  edits: Record<string, number[]>;
  furnaces: Record<string, FurnaceState>;
  achievements: string[];
  spawn: [number, number, number];
  stats: { mined: number; placed: number; kills: number; crafted: number; deaths: number };
}
export interface Settings { renderDist: number; fov: number; sens: number; volume: number; autoJump: boolean; music: boolean }

const LIST = 'vx_worlds';
export function listWorlds(): WorldMeta[] {
  try { return (JSON.parse(localStorage.getItem(LIST) || '[]') as WorldMeta[]).sort((a, b) => b.played - a.played); } catch { return []; }
}
export function saveWorldMeta(m: WorldMeta) {
  const l = listWorlds().filter((w) => w.id !== m.id); l.push(m);
  localStorage.setItem(LIST, JSON.stringify(l));
}
export function deleteWorld(id: string) {
  localStorage.setItem(LIST, JSON.stringify(listWorlds().filter((w) => w.id !== id)));
  localStorage.removeItem('vx_w_' + id);
}
export function loadSave(id: string): SaveData | null {
  try { const s = localStorage.getItem('vx_w_' + id); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function writeSave(id: string, d: SaveData): boolean {
  try { localStorage.setItem('vx_w_' + id, JSON.stringify(d)); return true; } catch (e) { console.warn('save failed', e); return false; }
}
export const DEFAULT_SETTINGS: Settings = { renderDist: 6, fov: 75, sens: 1, volume: 0.7, autoJump: true, music: true };
export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('vx_settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings) { localStorage.setItem('vx_settings', JSON.stringify(s)); }
