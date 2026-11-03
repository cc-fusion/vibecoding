const DB_NAME = 'voxelwilds_worlds_db';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const LS_FALLBACK_KEY = 'voxelwilds_worlds_fallback_v1';

export class WorldStorage {
  constructor() {
    this.dbPromise = this.openDB();
  }

  openDB() {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
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
      } catch {
        resolve(null);
      }
    });
  }

  readFallbackMap() {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  writeFallbackMap(map) {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(map));
    } catch {
      // Ignore quota errors
    }
  }

  async listWorlds() {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = Array.isArray(req.result) ? req.result : [];
            list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            resolve(list);
          };
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    const map = this.readFallbackMap();
    return Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async loadWorld(id) {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
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
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => {
            const map = this.readFallbackMap();
            map[record.id] = record;
            this.writeFallbackMap(map);
            resolve(true);
          };
        } catch {
          const map = this.readFallbackMap();
          map[record.id] = record;
          this.writeFallbackMap(map);
          resolve(true);
        }
      });
    }

    const map = this.readFallbackMap();
    map[record.id] = record;
    this.writeFallbackMap(map);
    return true;
  }

  async deleteWorld(id) {
    const db = await this.dbPromise;
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
    const map = this.readFallbackMap();
    if (map[id]) {
      delete map[id];
      this.writeFallbackMap(map);
    }
    return true;
  }
}
