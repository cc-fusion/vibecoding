// Inventory: 36 slots (9 hotbar + 27 main), stacking, crafting.
import { ITEMS, maxStack, type Recipe } from "./blocks";

export interface Stack {
  id: number;
  count: number;
  durability?: number; // remaining uses for tools
}

export const HOTBAR = 9;
export const INV_SIZE = 36;

export function makeStack(id: number, count = 1): Stack {
  const def = ITEMS[id];
  if (def?.tool) return { id, count: 1, durability: def.tool.durability };
  return { id, count };
}

export class Inventory {
  slots: (Stack | null)[] = new Array(INV_SIZE).fill(null);
  selected = 0;
  version = 0;

  get held(): Stack | null {
    return this.slots[this.selected];
  }

  touch() {
    this.version++;
  }

  count(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** Adds items; returns the number that did not fit. */
  add(id: number, count: number, durability?: number): number {
    const max = maxStack(id);
    let left = count;
    if (max > 1) {
      for (let i = 0; i < INV_SIZE && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const take = Math.min(max - s.count, left);
          s.count += take;
          left -= take;
        }
      }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, left);
        const st = makeStack(id, take);
        if (durability !== undefined) st.durability = durability;
        this.slots[i] = st;
        left -= take;
      }
    }
    this.touch();
    return left;
  }

  addStack(stack: Stack): number {
    return this.add(stack.id, stack.count, stack.durability);
  }

  /** Removes `count` of `id` from anywhere. Returns false (and removes nothing) if insufficient. */
  remove(id: number, count: number): boolean {
    if (this.count(id) < count) return false;
    let left = count;
    for (let i = INV_SIZE - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, left);
        s.count -= take;
        left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.touch();
    return true;
  }

  /** consume one from the selected slot */
  consumeHeld(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.touch();
  }

  /** wear down the held tool; returns true if it broke */
  damageHeld(): boolean {
    const s = this.slots[this.selected];
    if (!s || s.durability === undefined) return false;
    s.durability--;
    this.touch();
    if (s.durability <= 0) {
      this.slots[this.selected] = null;
      return true;
    }
    return false;
  }

  canCraft(r: Recipe): boolean {
    return r.in.every((i) => this.count(i.id) >= i.n);
  }

  craftableTimes(r: Recipe): number {
    let n = Infinity;
    for (const i of r.in) n = Math.min(n, Math.floor(this.count(i.id) / i.n));
    return n === Infinity ? 0 : n;
  }

  craft(r: Recipe): boolean {
    if (!this.canCraft(r)) return false;
    // ensure there is room: simulate
    const snapshot = this.slots.map((s) => (s ? { ...s } : null));
    for (const i of r.in) this.remove(i.id, i.n);
    const left = this.add(r.out, r.count);
    if (left > 0) {
      this.slots = snapshot;
      this.touch();
      return false;
    }
    return true;
  }

  /** find the hotbar slot containing an item id, or -1 */
  findHotbar(id: number): number {
    for (let i = 0; i < HOTBAR; i++) if (this.slots[i]?.id === id) return i;
    return -1;
  }
  findAny(id: number): number {
    for (let i = 0; i < INV_SIZE; i++) if (this.slots[i]?.id === id) return i;
    return -1;
  }
  firstEmptyHotbar(): number {
    for (let i = 0; i < HOTBAR; i++) if (!this.slots[i]) return i;
    return -1;
  }

  clear() {
    this.slots.fill(null);
    this.touch();
  }

  serialize() {
    return { slots: this.slots, selected: this.selected };
  }
  load(data: { slots?: (Stack | null)[]; selected?: number } | undefined) {
    if (!data) return;
    const slots = new Array(INV_SIZE).fill(null);
    if (Array.isArray(data.slots)) for (let i = 0; i < INV_SIZE; i++) {
      const s = data.slots[i];
      if (s && typeof s.id === "number" && typeof s.count === "number" && s.count > 0) slots[i] = { id: s.id, count: s.count, durability: s.durability };
    }
    this.slots = slots;
    this.selected = Math.max(0, Math.min(HOTBAR - 1, data.selected ?? 0));
    this.touch();
  }
}
