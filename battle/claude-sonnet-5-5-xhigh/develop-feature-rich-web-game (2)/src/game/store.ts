import type { Settings, Meta, SlotInfo } from './types';

function get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function set(k: string, v: string): boolean { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, zoom: 0, particles: 2, numbers: true, touch: false };
export function loadSettings(): Settings {
  try { const s = get('td_settings'); if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) }; } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings) { set('td_settings', JSON.stringify(s)); }

const DEFAULT_META: Meta = { shards: 0, perks: {}, totalKills: 0, totalBosses: 0, wins: 0, worlds: 0, bestDay: 0 };
let metaCache: Meta | null = null;
export function loadMeta(): Meta {
  if (metaCache) return metaCache;
  try { const s = get('td_meta'); if (s) metaCache = { ...DEFAULT_META, ...JSON.parse(s) }; } catch { /* ignore */ }
  if (!metaCache) metaCache = { ...DEFAULT_META, perks: {} };
  return metaCache;
}
export function saveMeta(m: Meta) { metaCache = m; set('td_meta', JSON.stringify(m)); }

export function listSlots(): (SlotInfo | null)[] {
  return [0, 1, 2].map(i => { try { const s = get(`td_info_${i}`); return s && get(`td_world_${i}`) ? JSON.parse(s) as SlotInfo : null; } catch { return null; } });
}
export function loadSlot(i: number): any | null { try { const s = get(`td_world_${i}`); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveSlot(i: number, data: any, info: SlotInfo): boolean {
  const ok = set(`td_world_${i}`, JSON.stringify(data)); if (ok) set(`td_info_${i}`, JSON.stringify(info)); return ok;
}
export function deleteSlot(i: number) { del(`td_world_${i}`); del(`td_info_${i}`); }
