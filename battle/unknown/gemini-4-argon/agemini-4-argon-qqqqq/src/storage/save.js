const DB_NAME = 'terracraft_db_v1';
const STORE_NAME = 'worlds';
const LS_PREFIX = 'terracraft_world_';
const LS_INDEX = 'terracraft_world_index_v1';
const LS_PREFS = 'terracraft_prefs_v1';

export class SaveManager {
  constructor() {
    this.dbPromise = null;
  }

  openDB() {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
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
    return this.dbPromise;
  }

  async listWorlds() {
    const db = await this.openDB();
    if (db) {
      try {
        const items = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return items
          .map((w) => ({
            id: w.id,
            name: w.name,
            seed: w.seed,
            mode: w.mode,
            dayNumber: w.dayNumber || 1,
            updatedAt: w.updatedAt || 0,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
      } catch {
        // Fall through to localStorage
      }
    }

    try {
      const raw = localStorage.getItem(LS_INDEX);
      const list = raw ? JSON.parse(raw) : [];
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async saveWorld(worldRecord) {
    const record = {
      ...worldRecord,
      updatedAt: Date.now(),
    };

    const db = await this.openDB();
    if (db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return true;
      } catch {
        // Fallback below
      }
    }

    try {
      localStorage.setItem(LS_PREFIX + record.id, JSON.stringify(record));
      const index = await this.listWorlds();
      const filtered = index.filter((w) => w.id !== record.id);
      filtered.unshift({
        id: record.id,
        name: record.name,
        seed: record.seed,
        mode: record.mode,
        dayNumber: record.dayNumber || 1,
        updatedAt: record.updatedAt,
      });
      localStorage.setItem(LS_INDEX, JSON.stringify(filtered.slice(0, 8)));
      return true;
    } catch {
      return false;
    }
  }

  async loadWorld(id) {
    const db = await this.openDB();
    if (db) {
      try {
        const res = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
        if (res) return res;
      } catch {
        // Fallback below
      }
    }

    try {
      const raw = localStorage.getItem(LS_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async deleteWorld(id) {
    const db = await this.openDB();
    if (db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Ignore
      }
    }

    try {
      localStorage.removeItem(LS_PREFIX + id);
      const raw = localStorage.getItem(LS_INDEX);
      if (raw) {
        const list = JSON.parse(raw).filter((w) => w.id !== id);
        localStorage.setItem(LS_INDEX, JSON.stringify(list));
      }
    } catch {
      // Ignore
    }
  }

  loadPrefs() {
    try {
      const raw = localStorage.getItem(LS_PREFS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  savePrefs(prefs) {
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
    } catch {
      // Ignore
    }
  }
}
