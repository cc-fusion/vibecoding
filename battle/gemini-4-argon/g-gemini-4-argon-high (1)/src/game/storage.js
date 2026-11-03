// Persistent World Save Manager (IndexedDB + LocalStorage Fallback + JSON Export/Import)

const DB_NAME = 'voxel_realms_db';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const FALLBACK_KEY = 'voxel_realms_worlds_v1';

export class WorldStorage {
  constructor() {
    this.dbPromise = null;
    this.memoryFallback = new Map();
  }

  openDB() {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  readFallbackMap() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    const obj = {};
    for (const [k, v] of this.memoryFallback.entries()) obj[k] = v;
    return obj;
  }

  writeFallbackMap(obj) {
    for (const [k, v] of Object.entries(obj)) {
      this.memoryFallback.set(k, v);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(obj));
      }
    } catch (_) {}
  }

  async listWorlds() {
    const db = await this.openDB();
    let list = [];

    if (db) {
      list = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      const map = this.readFallbackMap();
      list = Object.values(map);
    }

    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async getWorld(id) {
    const db = await this.openDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
    const map = this.readFallbackMap();
    return map[id] || null;
  }

  async saveWorld(worldRecord) {
    const record = {
      ...worldRecord,
      updatedAt: Date.now(),
    };
    const db = await this.openDB();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
      return record;
    }

    const map = this.readFallbackMap();
    map[record.id] = record;
    this.writeFallbackMap(map);
    return record;
  }

  async deleteWorld(id) {
    const db = await this.openDB();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
      return;
    }
    const map = this.readFallbackMap();
    delete map[id];
    this.writeFallbackMap(map);
  }
}
