// Persistence: IndexedDB (worlds + RLE-compressed modified chunks) with in-memory fallback.
import { CVOL } from './blocks';

export interface WorldMeta {
  id: string; name: string; seedStr: string; seed: number; mode: 'survival' | 'creative';
  created: number; lastPlayed: number; playTime: number;
  state?: any;
}

export interface ChunkStore {
  keys: Set<string>;
  load(cx: number, cz: number): Promise<Uint8Array | null>;
  save(cx: number, cz: number, blocks: Uint8Array): void;
}

export function rleEncode(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const v = src[i];
    let n = 1;
    while (i + n < src.length && src[i + n] === v && n < 255) n++;
    out.push(v, n);
    i += n;
  }
  return Uint8Array.from(out);
}
export function rleDecode(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(CVOL);
  let o = 0;
  for (let i = 0; i < src.length; i += 2) { out.fill(src[i], o, o + src[i + 1]); o += src[i + 1]; }
  return out;
}

const DB = 'terracraft-v1';
let dbp: Promise<IDBDatabase> | null = null;
const mem = { worlds: new Map<string, WorldMeta>(), chunks: new Map<string, Uint8Array>() };
const hasIDB = typeof indexedDB !== 'undefined';

function openDB(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('worlds', { keyPath: 'id' }); r.result.createObjectStore('chunks'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function safe<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!hasIDB) return fallback();
  try { return await fn(); } catch { return fallback(); }
}

export const listWorlds = () => safe(async () => {
  const db = await openDB();
  const all = (await req(db.transaction('worlds').objectStore('worlds').getAll())) as WorldMeta[];
  return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
}, () => [...mem.worlds.values()].sort((a, b) => b.lastPlayed - a.lastPlayed));

export const saveWorld = (m: WorldMeta) => safe(async () => {
  const db = await openDB();
  await req(db.transaction('worlds', 'readwrite').objectStore('worlds').put(m));
}, () => { mem.worlds.set(m.id, m); });

export const deleteWorld = (id: string) => safe(async () => {
  const db = await openDB();
  await req(db.transaction('worlds', 'readwrite').objectStore('worlds').delete(id));
  await req(db.transaction('chunks', 'readwrite').objectStore('chunks').delete(IDBKeyRange.bound(id + '|', id + '|\uffff')));
}, () => { mem.worlds.delete(id); for (const k of [...mem.chunks.keys()]) if (k.startsWith(id + '|')) mem.chunks.delete(k); });

export async function openChunkStore(worldId: string): Promise<ChunkStore> {
  const keys = new Set<string>();
  const prefix = worldId + '|';
  await safe(async () => {
    const db = await openDB();
    const ks = (await req(db.transaction('chunks').objectStore('chunks').getAllKeys(IDBKeyRange.bound(prefix, prefix + '\uffff')))) as string[];
    ks.forEach((k) => keys.add(k.slice(prefix.length)));
  }, () => { for (const k of mem.chunks.keys()) if (k.startsWith(prefix)) keys.add(k.slice(prefix.length)); });
  const pending = new Map<string, Uint8Array>();
  return {
    keys,
    async load(cx, cz) {
      const k = `${cx},${cz}`;
      if (!keys.has(k)) return null;
      const p = pending.get(k);
      if (p) return rleDecode(p);
      const data = await safe(async () => {
        const db = await openDB();
        return (await req(db.transaction('chunks').objectStore('chunks').get(prefix + k))) as Uint8Array | undefined;
      }, () => mem.chunks.get(prefix + k));
      return data ? rleDecode(data) : null;
    },
    save(cx, cz, blocks) {
      const k = `${cx},${cz}`;
      const enc = rleEncode(blocks);
      keys.add(k);
      pending.set(k, enc);
      safe(async () => {
        const db = await openDB();
        await req(db.transaction('chunks', 'readwrite').objectStore('chunks').put(enc, prefix + k));
      }, () => { mem.chunks.set(prefix + k, enc); }).finally(() => { if (pending.get(k) === enc) pending.delete(k); });
    },
  };
}

export const SETTINGS_KEY = 'terracraft-settings';
export interface Settings { renderDist: number; fov: number; sens: number; master: number; music: number; sfx: number; clouds: boolean; bob: boolean; fps: boolean }
export const defaultSettings: Settings = { renderDist: 6, fov: 75, sens: 1, master: 0.7, music: 0.5, sfx: 1, clouds: true, bob: true, fps: false };
export function loadSettings(): Settings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...defaultSettings }; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
