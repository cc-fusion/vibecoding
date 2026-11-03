import { DEFAULT_SETTINGS } from '../constants.js';

const DB_NAME = 'terravox_db';
const DB_VERSION = 1;
const STORE_WORLDS = 'worlds';
const LS_SETTINGS_KEY = 'terravox_settings_v1';
const LS_FALLBACK_KEY = 'terravox_worlds_fallback_v1';

export class SaveManager {
  constructor() {
    this.dbPromise = null;
  }

  _openDB() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
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
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  async listWorlds() {
    const db = await this._openDB();
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
        } catch {
          resolve([]);
        }
      });
    }

    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      return [];
    }
  }

  async loadWorld(id) {
    const db = await this._openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readonly');
          const req = tx.objectStore(STORE_WORLDS).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }

    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map[id] || null;
    } catch {
      return null;
    }
  }

  async saveWorld(record) {
    const payload = {
      ...record,
      updatedAt: Date.now(),
    };

    const db = await this._openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readwrite');
          tx.objectStore(STORE_WORLDS).put(payload);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }

    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[payload.id] = payload;
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(map));
      return true;
    } catch {
      return false;
    }
  }

  async deleteWorld(id) {
    const db = await this._openDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_WORLDS, 'readwrite');
          tx.objectStore(STORE_WORLDS).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }

    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      const map = raw ? JSON.parse(raw) : {};
      delete map[id];
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(map));
      return true;
    } catch {
      return false;
    }
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }
}
