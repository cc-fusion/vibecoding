const DB_NAME = 'terracraft_worlds_v1';
const STORE_NAME = 'worlds';
const LS_FALLBACK_KEY = 'terracraft_worlds_fallback_v1';

function withTimeout(promise, ms, fallbackVal = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackVal), ms)),
  ]);
}

export class SaveManager {
  constructor() {
    this.dbPromise = withTimeout(this.openDB(), 250, null);
  }

  openDB() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
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
        req.onblocked = () => resolve(null);
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
      // Ignore storage quota limits safely
    }
  }

  async listWorlds() {
    const lsMap = this.readFallbackMap();
    const db = await this.dbPromise;
    if (!db) {
      return Object.values(lsMap).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    const idbList = await withTimeout(
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      }),
      250,
      []
    );

    const merged = { ...lsMap };
    for (const item of idbList) {
      if (item && item.id) {
        if (!merged[item.id] || (item.updatedAt || 0) >= (merged[item.id].updatedAt || 0)) {
          merged[item.id] = item;
        }
      }
    }
    return Object.values(merged).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async getWorld(id) {
    const lsMap = this.readFallbackMap();
    const db = await this.dbPromise;
    if (!db) return lsMap[id] || null;

    const idbRec = await withTimeout(
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
      250,
      null
    );

    return idbRec || lsMap[id] || null;
  }

  async saveWorld(record) {
    const payload = {
      ...record,
      updatedAt: Date.now(),
    };

    // Always write through to localStorage immediately so synchronous beforeunload also persists
    const map = this.readFallbackMap();
    map[payload.id] = payload;
    this.writeFallbackMap(map);

    const db = await this.dbPromise;
    if (!db) return payload;

    await withTimeout(
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(payload);
          tx.oncomplete = () => resolve(payload);
          tx.onerror = () => resolve(payload);
        } catch {
          resolve(payload);
        }
      }),
      250,
      payload
    );

    return payload;
  }

  async deleteWorld(id) {
    const map = this.readFallbackMap();
    delete map[id];
    this.writeFallbackMap(map);

    const db = await this.dbPromise;
    if (!db) return;

    await withTimeout(
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      }),
      250,
      null
    );
  }

  exportWorldToFile(record) {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (record.name || 'world').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    a.href = url;
    a.download = `terracraft_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
