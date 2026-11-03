import { ITEMS } from './blocks';

export interface Stack { id: number; count: number; dur?: number }
export type Slots = (Stack | null)[];

export const maxStack = (id: number) => ITEMS[id]?.stack ?? 64;
export const clone = (s: Stack | null): Stack | null => (s ? { ...s } : null);

export function newStack(id: number, count = 1): Stack {
  const t = ITEMS[id]?.tool;
  return t ? { id, count: 1, dur: t.durability } : { id, count };
}

/** Adds items into slots (prefers existing stacks, then empty). Returns leftover count. */
export function addItem(slots: Slots, id: number, count: number, order?: number[]): number {
  const idxs = order ?? slots.map((_, i) => i);
  const max = maxStack(id);
  for (const i of idxs) {
    const s = slots[i];
    if (s && s.id === id && s.count < max && !ITEMS[id]?.tool) {
      const n = Math.min(count, max - s.count); s.count += n; count -= n;
      if (!count) return 0;
    }
  }
  for (const i of idxs) {
    if (!slots[i]) {
      const n = Math.min(count, max);
      slots[i] = newStack(id, n); count -= n;
      if (!count) return 0;
    }
  }
  return count;
}

export function countItem(slots: Slots, id: number) { return slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }

/** Standard left/right click interaction between a slot and the cursor. Returns new [slot, cursor]. */
export function clickSlot(slot: Stack | null, cursor: Stack | null, right: boolean): [Stack | null, Stack | null] {
  if (!cursor) {
    if (!slot) return [null, null];
    if (right) {
      const take = Math.ceil(slot.count / 2);
      const rest = slot.count - take;
      return [rest ? { ...slot, count: rest } : null, { ...slot, count: take }];
    }
    return [null, slot];
  }
  if (!slot) {
    if (right) return [{ ...cursor, count: 1 }, cursor.count > 1 ? { ...cursor, count: cursor.count - 1 } : null];
    return [cursor, null];
  }
  if (slot.id === cursor.id && !ITEMS[slot.id]?.tool) {
    const max = maxStack(slot.id);
    if (right) {
      if (slot.count >= max) return [slot, cursor];
      return [{ ...slot, count: slot.count + 1 }, cursor.count > 1 ? { ...cursor, count: cursor.count - 1 } : null];
    }
    const n = Math.min(cursor.count, max - slot.count);
    const left = cursor.count - n;
    return [{ ...slot, count: slot.count + n }, left ? { ...cursor, count: left } : null];
  }
  return [cursor, slot];
}

export interface FurnaceState { input: Stack | null; fuel: Stack | null; output: Stack | null; burn: number; burnMax: number; progress: number }
export const newFurnace = (): FurnaceState => ({ input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0 });
