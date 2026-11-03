const DB_NAME = 'voxterra_worlds_db';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const LS_FALLBACK_KEY = 'voxterra_worlds_fallback_v1';

export class WorldPersistence {
  constructor() {
    this.dbPromise = this._openDB();
  }

  _openDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
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
      return this._listFallback();
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => resolve(this._listFallback());
      } catch {
        resolve(this._listFallback());
      }
    });
  }

  async loadWorld(id) {
    const db = await this.dbPromise;
    if (!db) {
      const list = this._listFallback();
      return list.find((w) => w.id === id) || null;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async saveWorld(record) {
    record.updatedAt = Date.now();
    const db = await this.dbPromise;
    if (!db) {
      this._saveFallback(record);
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          this._saveFallback(record);
          resolve(true);
        };
      } catch {
        this._saveFallback(record);
        resolve(true);
      }
    });
  }

  async deleteWorld(id) {
    const db = await this.dbPromise;
    if (!db) {
      this._deleteFallback(id);
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  _listFallback() {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
    } catch {
      return [];
    }
  }

  _saveFallback(record) {
    try {
      const list = this._listFallback().filter((w) => w.id !== record.id);
      list.unshift(record);
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(list));
    } catch {
      // Ignore quota errors
    }
  }

  _deleteFallback(id) {
    try {
      const list = this._listFallback().filter((w) => w.id !== id);
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(list));
    } catch {
      // Ignore
    }
  }
}
