import { WorldSaveData, WorldSaveMeta } from './types';

const DB_NAME = 'terravox_worlds_db';
const DB_VERSION = 1;
const STORE_META = 'world_meta';
const STORE_DATA = 'world_data';
const LS_PREFIX = 'terravox_fallback_';

export class WorldStorage {
  private memoryFallback = new Map<string, string>();

  private openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_DATA)) {
            db.createObjectStore(STORE_DATA, { keyPath: 'meta.id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private getFallbackItem(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(LS_PREFIX + key);
      }
    } catch {
      // ignore storage quota / sandbox restrictions
    }
    return this.memoryFallback.get(key) ?? null;
  }

  private setFallbackItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_PREFIX + key, value);
        return;
      }
    } catch {
      // fall through
    }
    this.memoryFallback.set(key, value);
  }

  private removeFallbackItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LS_PREFIX + key);
      }
    } catch {
      // ignore
    }
    this.memoryFallback.delete(key);
  }

  async listWorlds(): Promise<WorldSaveMeta[]> {
    const db = await this.openDb();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).getAll();
        req.onsuccess = () => {
          const list = (req.result as WorldSaveMeta[]) ?? [];
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          db.close();
          resolve(list);
        };
        req.onerror = () => {
          db.close();
          resolve([]);
        };
      });
    }

    const rawIndex = this.getFallbackItem('index');
    if (!rawIndex) return [];
    try {
      const list = JSON.parse(rawIndex) as WorldSaveMeta[];
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async saveWorld(data: WorldSaveData): Promise<void> {
    data.meta.updatedAt = Date.now();
    const db = await this.openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
        tx.objectStore(STORE_META).put(data.meta);
        tx.objectStore(STORE_DATA).put(data);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      });
      return;
    }

    const existing = await this.listWorlds();
    const filtered = existing.filter((m) => m.id !== data.meta.id);
    filtered.unshift(data.meta);
    this.setFallbackItem('index', JSON.stringify(filtered));
    this.setFallbackItem(`world_${data.meta.id}`, JSON.stringify(data));
  }

  async loadWorld(id: string): Promise<WorldSaveData | null> {
    const db = await this.openDb();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_DATA, 'readonly');
        const req = tx.objectStore(STORE_DATA).get(id);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as WorldSaveData) ?? null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    }

    const raw = this.getFallbackItem(`world_${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorldSaveData;
    } catch {
      return null;
    }
  }

  async deleteWorld(id: string): Promise<void> {
    const db = await this.openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
        tx.objectStore(STORE_META).delete(id);
        tx.objectStore(STORE_DATA).delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      });
      return;
    }

    const existing = await this.listWorlds();
    this.setFallbackItem(
      'index',
      JSON.stringify(existing.filter((m) => m.id !== id))
    );
    this.removeFallbackItem(`world_${id}`);
  }
}

export const worldStorage = new WorldStorage();
