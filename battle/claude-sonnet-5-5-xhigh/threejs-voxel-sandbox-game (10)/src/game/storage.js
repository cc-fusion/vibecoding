// IndexedDB persistence for worlds and modified chunks (falls back to memory if unavailable).
const DB_NAME = 'blockhaven-v1';
let dbPromise = null;
const memory = { worlds: new Map(), chunks: new Map() };
let useMemory = false;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!window.indexedDB) { useMemory = true; resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { useMemory = true; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) {
        const s = db.createObjectStore('chunks', { keyPath: 'id' });
        s.createIndex('w', 'w', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useMemory = true; resolve(null); };
    req.onblocked = () => { useMemory = true; resolve(null); };
  });
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export const Storage = {
  async listWorlds() {
    const db = await open();
    if (!db) return [...memory.worlds.values()].sort((a, b) => b.played - a.played);
    const all = await wrap(db.transaction('worlds').objectStore('worlds').getAll());
    return all.sort((a, b) => b.played - a.played);
  },
  async getWorld(id) {
    const db = await open();
    if (!db) return memory.worlds.get(id) || null;
    return (await wrap(db.transaction('worlds').objectStore('worlds').get(id))) || null;
  },
  async putWorld(rec) {
    const db = await open();
    if (!db) { memory.worlds.set(rec.id, rec); return; }
    const tx = db.transaction('worlds', 'readwrite');
    tx.objectStore('worlds').put(rec);
    await done(tx);
  },
  async deleteWorld(id) {
    const db = await open();
    if (!db) {
      memory.worlds.delete(id);
      for (const k of [...memory.chunks.keys()]) if (k.startsWith(id + ':')) memory.chunks.delete(k);
      return;
    }
    const tx = db.transaction(['worlds', 'chunks'], 'readwrite');
    tx.objectStore('worlds').delete(id);
    const idx = tx.objectStore('chunks').index('w');
    const cur = idx.openKeyCursor(IDBKeyRange.only(id));
    cur.onsuccess = () => { const c = cur.result; if (c) { tx.objectStore('chunks').delete(c.primaryKey); c.continue(); } };
    await done(tx);
  },
  async loadChunks(worldId) {
    const db = await open();
    const out = new Map();
    if (!db) {
      for (const [k, v] of memory.chunks) if (k.startsWith(worldId + ':')) out.set(v.k, v.rec);
      return out;
    }
    const all = await wrap(db.transaction('chunks').objectStore('chunks').index('w').getAll(IDBKeyRange.only(worldId)));
    for (const r of all) out.set(r.k, { cx: r.cx, cz: r.cz, d: r.d, m: r.m });
    return out;
  },
  async putChunks(worldId, list) {
    if (!list.length) return;
    const db = await open();
    if (!db) { for (const { k, rec } of list) memory.chunks.set(worldId + ':' + k, { k, rec }); return; }
    const tx = db.transaction('chunks', 'readwrite');
    const st = tx.objectStore('chunks');
    for (const { k, rec } of list) st.put({ id: worldId + ':' + k, w: worldId, k, cx: rec.cx, cz: rec.cz, d: rec.d, m: rec.m });
    await done(tx);
  },
  isPersistent() { return !useMemory; },
};

export const SETTINGS_KEY = 'blockhaven.settings';
export const DEFAULT_SETTINGS = {
  renderDistance: 8, fov: 75, sensitivity: 1, master: 0.8, music: 0.5, sfx: 1,
  clouds: true, particles: true, bobbing: true, invertY: false, showFps: false,
};
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
