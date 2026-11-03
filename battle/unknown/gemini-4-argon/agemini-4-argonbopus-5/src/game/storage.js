const DB_NAME = 'terravox_worlds_db';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const LS_FALLBACK_KEY = 'terravox_worlds_fallback_v1';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class WorldStorage {
  async listWorlds() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return Object.values(obj).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      } catch {
        return [];
      }
    }
  }

  async loadWorld(id) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj[id] || null;
      } catch {
        return null;
      }
    }
  }

  async saveWorld(worldRecord) {
    const record = {
      ...worldRecord,
      updatedAt: Date.now(),
    };
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj[record.id] = record;
        localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(obj));
        return true;
      } catch {
        return false;
      }
    }
  }

  async deleteWorld(id) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        delete obj[id];
        localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(obj));
        return true;
      } catch {
        return false;
      }
    }
  }
}
