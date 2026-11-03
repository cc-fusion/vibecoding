// Persistent Multi-World Storage Engine using IndexedDB (with graceful localStorage fallback)

const DB_NAME = 'TerraCraftWorldsDB';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';

export class WorldStorage {
  constructor() {
    this.dbPromise = this.openDatabase();
  }

  openDatabase() {
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

  async listWorlds() {
    const db = await this.dbPromise;
    if (!db) {
      return this.listFallback();
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const items = (req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(items);
      };
      req.onerror = () => resolve(this.listFallback());
    });
  }

  async loadWorld(id) {
    const db = await this.dbPromise;
    if (!db) {
      const raw = localStorage.getItem(`terracraft_world_${id}`);
      return raw ? JSON.parse(raw) : null;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async saveWorld(worldRecord) {
    const payload = {
      ...worldRecord,
      updatedAt: Date.now(),
    };
    const db = await this.dbPromise;
    if (!db) {
      try {
        localStorage.setItem(`terracraft_world_${payload.id}`, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors cleanly
      }
      return payload;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(payload);
      tx.oncomplete = () => resolve(payload);
      tx.onerror = () => resolve(payload);
    });
  }

  async deleteWorld(id) {
    const db = await this.dbPromise;
    if (!db) {
      localStorage.removeItem(`terracraft_world_${id}`);
      return;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  listFallback() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('terracraft_world_')) {
        try {
          list.push(JSON.parse(localStorage.getItem(key)));
        } catch {
          // ignore invalid entry
        }
      }
    }
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
}
