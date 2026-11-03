import { B, I, ITEMS, maxStack } from './blocks';

export interface Slot { id: number; count: number; dur?: number }
export type Slots = (Slot | null)[];

export class Inventory {
  slots: Slots = new Array(36).fill(null);
  add(id: number, count: number, dur?: number): number {
    const ms = maxStack(id);
    if (ms > 1) for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < ms) { const n = Math.min(ms - s.count, count); s.count += n; count -= n; }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(ms, count);
        const tool = ITEMS[id]?.tool;
        this.slots[i] = { id, count: n, dur: dur ?? (tool ? tool.durability : undefined) }; count -= n;
      }
    }
    return count;
  }
  count(id: number) { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }
  take(i: number, n = 1) {
    const s = this.slots[i]; if (!s) return;
    s.count -= n; if (s.count <= 0) this.slots[i] = null;
  }
}

// ---------------------------------------------------------------- crafting
type Key = number | number[];
interface Shaped { pattern: string[]; keys: Record<string, Key>; out: [number, number] }
interface Shapeless { items: Key[]; out: [number, number] }

const LOGS = [B.LOG, B.BIRCH_LOG, B.PINE_LOG];
const shaped: Shaped[] = [];
const shapeless: Shapeless[] = [];
const S = (pattern: string[], keys: Record<string, Key>, out: [number, number]) => shaped.push({ pattern, keys, out });

shapeless.push({ items: [LOGS], out: [B.PLANKS, 4] });
S(['P', 'P'], { P: B.PLANKS }, [I.STICK, 4]);
S(['PP', 'PP'], { P: B.PLANKS }, [B.CRAFTING_TABLE, 1]);
S(['CCC', 'C C', 'CCC'], { C: B.COBBLE }, [B.FURNACE, 1]);
S(['C', 'S'], { C: I.COAL, S: I.STICK }, [B.TORCH, 4]);
S(['SS', 'SS'], { S: B.STONE }, [B.STONE_BRICKS, 4]);
S(['SS', 'SS'], { S: B.SAND }, [B.SANDSTONE, 1]);
S(['BB', 'BB'], { B: I.BRICK }, [B.BRICKS, 1]);
S(['PPP', 'SSS', 'PPP'], { P: B.PLANKS, S: I.STICK }, [B.BOOKSHELF, 1]);
S(['SSS'], { S: I.WHEAT_SEEDS }, [I.BREAD, 1]);
S([' C ', 'CGC', ' C '], { C: I.COAL, G: I.GOLD_INGOT }, [B.GLOWSTONE, 2]);
S(['CC', 'CC'], { C: I.CLAY_BALL }, [B.CLAY, 1]);
S(['LL', 'LL'], { L: I.LEATHER }, [B.WOOL, 1]);
const toolMats: Key[] = [B.PLANKS, [B.COBBLE, B.STONE], I.IRON_INGOT, I.DIAMOND];
toolMats.forEach((m, mi) => {
  S(['XXX', ' S ', ' S '], { X: m, S: I.STICK }, [110 + mi, 1]);
  S(['XX', 'XS', ' S'], { X: m, S: I.STICK }, [114 + mi, 1]);
  S(['X', 'S', 'S'], { X: m, S: I.STICK }, [118 + mi, 1]);
  S(['X', 'X', 'S'], { X: m, S: I.STICK }, [122 + mi, 1]);
});

const matches = (k: Key | undefined, id: number) => k === undefined ? id === 0 : Array.isArray(k) ? k.includes(id) : k === id;

export function craft(grid: Slots, w: number): [number, number] | null {
  const h = grid.length / w;
  const ids = grid.map((s) => (s ? s.id : 0));
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ids[y * w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const sub = (x: number, y: number) => ids[(y + minY) * w + x + minX];
  for (const r of shaped) {
    const rw = Math.max(...r.pattern.map((p) => p.length)), rh = r.pattern.length;
    if (rw !== bw || rh !== bh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < rh && ok; y++) for (let x = 0; x < rw && ok; x++) {
        const ch = r.pattern[y][mirror ? rw - 1 - x : x] ?? ' ';
        const key = ch === ' ' ? undefined : r.keys[ch];
        if (!matches(key, sub(x, y))) ok = false;
      }
      if (ok) return r.out;
    }
  }
  const present = ids.filter((i) => i);
  for (const r of shapeless) {
    if (present.length !== r.items.length) continue;
    const left = [...r.items];
    let ok = true;
    for (const id of present) { const j = left.findIndex((k) => matches(k, id)); if (j < 0) { ok = false; break; } left.splice(j, 1); }
    if (ok) return r.out;
  }
  return null;
}

// recipe book listing (for the UI help panel)
export function recipeList() {
  const out: { out: [number, number]; grid: number[][] }[] = [];
  const first = (k: Key) => (Array.isArray(k) ? k[0] : k);
  for (const r of shaped) out.push({ out: r.out, grid: r.pattern.map((row) => row.split('').map((ch) => (ch === ' ' ? 0 : first(r.keys[ch])))) });
  for (const r of shapeless) out.push({ out: r.out, grid: [r.items.map(first)] });
  return out;
}

// ---------------------------------------------------------------- smelting
export const SMELT: Record<number, number> = {
  [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE, [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT,
  [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.STEAK, [I.MUTTON]: I.COOKED_MUTTON, [B.LOG]: I.COAL, [B.BIRCH_LOG]: I.COAL,
  [B.PINE_LOG]: I.COAL, [I.CLAY_BALL]: I.BRICK, [B.CLAY]: B.BRICKS,
};
export const FUEL: Record<number, number> = {
  [I.COAL]: 8, [B.PLANKS]: 1.5, [B.LOG]: 1.5, [B.BIRCH_LOG]: 1.5, [B.PINE_LOG]: 1.5, [I.STICK]: 0.5, [B.CRAFTING_TABLE]: 1.5, [B.BOOKSHELF]: 1.5,
};
export interface FurnaceState { input: Slot | null; fuel: Slot | null; output: Slot | null; burn: number; burnMax: number; progress: number }
export const newFurnace = (): FurnaceState => ({ input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0 });
export const SMELT_TIME = 4;

export function tickFurnace(f: FurnaceState, dt: number): boolean {
  const res = f.input ? SMELT[f.input.id] : undefined;
  const canOut = res !== undefined && (!f.output || (f.output.id === res && f.output.count < maxStack(res)));
  let changed = false;
  if (f.burn <= 0 && canOut && f.fuel && FUEL[f.fuel.id]) {
    f.burnMax = f.burn = FUEL[f.fuel.id] * SMELT_TIME;
    f.fuel.count--; if (f.fuel.count <= 0) f.fuel = null; changed = true;
  }
  if (f.burn > 0) {
    f.burn -= dt;
    if (canOut) {
      f.progress += dt;
      if (f.progress >= SMELT_TIME) {
        f.progress = 0;
        if (f.output) f.output.count++; else f.output = { id: res!, count: 1 };
        f.input!.count--; if (f.input!.count <= 0) f.input = null;
        changed = true;
      }
    } else f.progress = 0;
  } else f.progress = Math.max(0, f.progress - dt * 2);
  return changed;
}
