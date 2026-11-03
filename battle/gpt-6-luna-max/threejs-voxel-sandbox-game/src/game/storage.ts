import { ITEM_DEFS, type ItemId } from "./blocks";

const SAVE_KEY = "wilds.sandbox.v1";

export interface SavedGame {
  version: 1;
  seed: string;
  edits: [string, number][];
  inventory: Partial<Record<ItemId, number>>;
  hotbar: (ItemId | null)[];
  selectedSlot: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  time: number;
}

const itemIds = new Set(Object.keys(ITEM_DEFS));

export function readSave(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedGame>;
    if (value.version !== 1 || typeof value.seed !== "string" || !Array.isArray(value.edits)) return null;

    const inventory: Partial<Record<ItemId, number>> = {};
    if (value.inventory && typeof value.inventory === "object") {
      for (const [key, amount] of Object.entries(value.inventory)) {
        if (itemIds.has(key) && typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
          inventory[key as ItemId] = Math.floor(amount);
        }
      }
    }

    const hotbar = Array.from({ length: 9 }, (_, index) => {
      const item = value.hotbar?.[index];
      return typeof item === "string" && itemIds.has(item) ? item as ItemId : null;
    });
    const playerValue = value.player;
    const player = playerValue && [playerValue.x, playerValue.y, playerValue.z, playerValue.yaw, playerValue.pitch].every(Number.isFinite)
      ? { ...playerValue }
      : { x: 0.5, y: 24, z: 0.5, yaw: Math.PI * 0.22, pitch: -0.1 };
    const edits = value.edits.slice(0, 40_000).filter((entry): entry is [string, number] =>
      Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isInteger(entry[1]),
    );

    return {
      version: 1,
      seed: value.seed.slice(0, 40),
      edits,
      inventory,
      hotbar,
      selectedSlot: Math.max(0, Math.min(8, Math.floor(value.selectedSlot ?? 0))),
      player,
      time: typeof value.time === "number" && Number.isFinite(value.time) ? ((value.time % 1) + 1) % 1 : 0.38,
    };
  } catch {
    return null;
  }
}

export function writeSave(save: SavedGame): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function makeSeed(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `WILDS-${code}`;
}

export const DEFAULT_SEED = "MOSS-4821";