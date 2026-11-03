const DB_NAME = "voxelcraft";
const STORE = "worlds";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export interface SaveData {
  version: number;
  name: string;
  seed: number;
  time: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    xp: number;
    level: number;
    mode: string;
    spawn: [number, number, number];
  };
  inventory: any;
  edits: Record<string, Record<number, number>>;
  furnaces: Record<string, any>;
  stats: Record<string, number>;
  achievements: string[];
  savedAt: number;
}

export async function saveWorld(key: string, data: SaveData): Promise<boolean> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
  try {
    localStorage.setItem("vc_" + key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export async function loadWorld(key: string): Promise<SaveData | null> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as SaveData) ?? null);
      r.onerror = () => resolve(null);
    });
  }
  try {
    const s = localStorage.getItem("vc_" + key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export async function listWorlds(): Promise<{ key: string; data: SaveData }[]> {
  const db = await openDb();
  const out: { key: string; data: SaveData }[] = [];
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          out.push({ key: String(cur.key), data: cur.value as SaveData });
          cur.continue();
        } else resolve(out.sort((a, b) => b.data.savedAt - a.data.savedAt));
      };
      req.onerror = () => resolve(out);
    });
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("vc_")) {
      try {
        out.push({ key: k.slice(3), data: JSON.parse(localStorage.getItem(k)!) });
      } catch {
        /* ignore */
      }
    }
  }
  return out.sort((a, b) => b.data.savedAt - a.data.savedAt);
}

export async function deleteWorld(key: string): Promise<void> {
  const db = await openDb();
  if (db) {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    return;
  }
  localStorage.removeItem("vc_" + key);
}
