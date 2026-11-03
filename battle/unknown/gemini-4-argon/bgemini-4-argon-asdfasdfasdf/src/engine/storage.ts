import { Achievement, GameMode, InventorySlot, WeatherType, WorldSaveMeta } from './constants';

export interface SavedWorldPayload {
  meta: WorldSaveMeta;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    flying: boolean;
    selectedHotbar: number;
  };
  timeOfDay: number;
  weather: WeatherType;
  inventory: (InventorySlot | null)[];
  achievements: Achievement[];
  edits: Record<string, [number, number][]>;
}

const DB_NAME = 'voxelrealms_db_v1';
const STORE_META = 'worlds_meta';
const STORE_DATA = 'worlds_data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
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
    req.onerror = () => reject(req.error);
  });
}

export async function listSavedWorlds(): Promise<WorldSaveMeta[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const list = (req.result as WorldSaveMeta[]) || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveWorldData(payload: SavedWorldPayload): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      payload.meta.updatedAt = Date.now();
      tx.objectStore(STORE_META).put(payload.meta);
      tx.objectStore(STORE_DATA).put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('World save warning:', err);
  }
}

export async function loadWorldData(id: string): Promise<SavedWorldPayload | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DATA, 'readonly');
      const req = tx.objectStore(STORE_DATA).get(id);
      req.onsuccess = () => resolve((req.result as SavedWorldPayload) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteSavedWorld(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_DATA], 'readwrite');
      tx.objectStore(STORE_META).delete(id);
      tx.objectStore(STORE_DATA).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export function createDefaultAchievements(): Achievement[] {
  return [
    {
      id: 'first_timber',
      title: 'Getting Wood',
      description: 'Chop down a tree trunk to gather your first timber.',
      unlocked: false,
    },
    {
      id: 'bench_maker',
      title: 'Artisan Workshop',
      description: 'Craft Planks, Sticks, or a Crafting Table in your Inventory (E).',
      unlocked: false,
    },
    {
      id: 'stone_age',
      title: 'Stone Age Miner',
      description: 'Mine Cobblestone or Coal Ore with a Pickaxe.',
      unlocked: false,
    },
    {
      id: 'light_the_dark',
      title: 'Light the Dark',
      description: 'Place a warm glowing Torch or Sunstone Lantern.',
      unlocked: false,
    },
    {
      id: 'iron_forge',
      title: 'Iron Forgemaster',
      description: 'Smelt Iron Ore into strong Iron Ingots in the Furnace.',
      unlocked: false,
    },
    {
      id: 'demolitionist',
      title: 'Boom! Quarry Master',
      description: 'Ignite a TNT Charge or forge Diamond gear.',
      unlocked: false,
    },
  ];
}

export function createStarterInventory(mode: GameMode): (InventorySlot | null)[] {
  const inv: (InventorySlot | null)[] = new Array(36).fill(null);
  if (mode === 'creative') {
    inv[0] = { id: 31, count: 64 }; // Oak Planks
    inv[1] = { id: 34, count: 64 }; // Stone Bricks
    inv[2] = { id: 35, count: 64 }; // Bricks
    inv[3] = { id: 36, count: 64 }; // Crystal Glass
    inv[4] = { id: 39, count: 64 }; // Torch
    inv[5] = { id: 40, count: 64 }; // Glowstone
    inv[6] = { id: 41, count: 64 }; // TNT
    inv[7] = { id: 42, count: 64 }; // Bookshelf
    inv[8] = { id: 122, count: 1, durability: 800 }; // Diamond Pickaxe
  } else {
    // Helpful adventurer starter kit so players can immediately mine, chop, build & light caves,
    // while still gathering wood/stone/coal/iron/diamonds to progress!
    inv[0] = { id: 110, count: 1, durability: 65 }; // Wooden Pickaxe
    inv[1] = { id: 113, count: 1, durability: 65 }; // Wooden Sword
    inv[2] = { id: 39, count: 8 }; // 8 Torches for cave exploration
    inv[3] = { id: 130, count: 4 }; // 4 Crisp Red Apples
  }
  return inv;
}
