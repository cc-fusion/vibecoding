const DB_NAME = 'voxelwild_db_v1';
const DB_VERSION = 1;
const STORE_WORLDS = 'worlds';
const SETTINGS_KEY = 'voxelwild_settings_v1';
const FALLBACK_KEY = 'voxelwild_worlds_fallback_v1';

export const DEFAULT_SETTINGS = {
  renderDistance: 5,
  fov: 74,
  volume: 0.7,
  sensitivity: 1.0,
  invertY: false,
};

export class WorldStorage {
  constructor() {
    this.dbPromise = null;
    this.memoryWorlds = new Map();
  }

  openDB() {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_WORLDS)) {
              db.createObjectStore(STORE_WORLDS, { keyPath: 'id' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  loadSettings() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        }
      }
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      }
    } catch (_) {}
    return merged;
  }

  async listWorlds() {
    const db = await this.openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readonly');
          const store = tx.objectStore(STORE_WORLDS);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = Array.isArray(req.result) ? req.result : [];
            list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            resolve(list);
          };
          req.onerror = () => resolve([]);
        } catch (_) {
          resolve([]);
        }
      });
    }

    // Fallback
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Object.values(parsed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }
      }
    } catch (_) {}

    return Array.from(this.memoryWorlds.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  async loadWorld(id) {
    const db = await this.openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readonly');
          const req = tx.objectStore(STORE_WORLDS).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed[id] || null;
        }
      }
    } catch (_) {}

    return this.memoryWorlds.get(id) || null;
  }

  async saveWorld(record) {
    const payload = {
      ...record,
      updatedAt: Date.now(),
    };
    this.memoryWorlds.set(payload.id, payload);

    const db = await this.openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readwrite');
          tx.objectStore(STORE_WORLDS).put(payload);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[payload.id] = payload;
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(parsed));
      }
    } catch (_) {}
    return true;
  }

  async deleteWorld(id) {
    this.memoryWorlds.delete(id);
    const db = await this.openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readwrite');
          tx.objectStore(STORE_WORLDS).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          delete parsed[id];
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(parsed));
        }
      }
    } catch (_) {}
    return true;
  }
}
