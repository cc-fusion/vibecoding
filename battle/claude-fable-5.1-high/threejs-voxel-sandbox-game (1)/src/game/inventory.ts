// Inventory: 36 slots (0-8 hotbar), stacking, durability.
import { getStackSize, getTool } from "./blocks";

export interface Stack {
  id: number;
  count: number;
  durability?: number; // remaining uses for tools
}

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  selected = 0;
  cursor: Stack | null = null; // item held by mouse in the UI
  version = 0;

  get held(): Stack | null {
    return this.slots[this.selected];
  }

  touch() {
    this.version++;
  }

  /** Adds items, returns leftover count. */
  add(id: number, count: number, durability?: number): number {
    const max = getStackSize(id);
    // merge into existing
    if (max > 1) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 36; i++) {
          const s = this.slots[i];
          if (s && s.id === id && s.count < max) {
            const take = Math.min(max - s.count, count);
            s.count += take;
            count -= take;
            if (count === 0) {
              this.touch();
              return 0;
            }
          }
        }
      }
    }
    // hotbar first, then main
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, count);
        const tool = getTool(id);
        this.slots[i] = { id, count: take, durability: durability ?? (tool ? tool.durability : undefined) };
        count -= take;
      }
    }
    this.touch();
    return count;
  }

  count(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** Removes count of id; returns true if successful (checks first). */
  remove(id: number, count: number): boolean {
    if (this.count(id) < count) return false;
    for (let i = 35; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, count);
        s.count -= take;
        count -= take;
        if (s.count === 0) this.slots[i] = null;
      }
    }
    this.touch();
    return true;
  }

  consumeHeld(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.touch();
  }

  /** Damages the held tool; returns true if it broke. */
  damageHeld(amount = 1): boolean {
    const s = this.slots[this.selected];
    if (!s || s.durability === undefined) return false;
    s.durability -= amount;
    if (s.durability <= 0) {
      this.slots[this.selected] = null;
      this.touch();
      return true;
    }
    this.touch();
    return false;
  }

  /** UI click on a slot: pick up / put down / swap / merge. right=true takes/puts one. */
  click(index: number, right: boolean) {
    const s = this.slots[index];
    const c = this.cursor;
    if (!c) {
      if (!s) return;
      if (right) {
        const half = Math.ceil(s.count / 2);
        this.cursor = { ...s, count: half };
        s.count -= half;
        if (s.count === 0) this.slots[index] = null;
      } else {
        this.cursor = s;
        this.slots[index] = null;
      }
    } else {
      if (!s) {
        if (right) {
          this.slots[index] = { ...c, count: 1 };
          c.count--;
          if (c.count === 0) this.cursor = null;
        } else {
          this.slots[index] = c;
          this.cursor = null;
        }
      } else if (s.id === c.id && getStackSize(s.id) > 1) {
        const max = getStackSize(s.id);
        const take = Math.min(right ? 1 : c.count, max - s.count);
        s.count += take;
        c.count -= take;
        if (c.count === 0) this.cursor = null;
      } else {
        this.slots[index] = c;
        this.cursor = s;
      }
    }
    this.touch();
  }

  /** Quick move between hotbar and main inventory (shift-click). */
  quickMove(index: number) {
    const s = this.slots[index];
    if (!s) return;
    const targetRange = index < 9 ? [9, 36] : [0, 9];
    const max = getStackSize(s.id);
    for (let i = targetRange[0]; i < targetRange[1] && s.count > 0; i++) {
      const t = this.slots[i];
      if (t && t.id === s.id && t.count < max) {
        const take = Math.min(max - t.count, s.count);
        t.count += take;
        s.count -= take;
      }
    }
    for (let i = targetRange[0]; i < targetRange[1] && s.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...s };
        s.count = 0;
      }
    }
    if (s.count === 0) this.slots[index] = null;
    this.touch();
  }

  /** Returns cursor stack back to inventory (on close). */
  returnCursor() {
    if (this.cursor) {
      const left = this.add(this.cursor.id, this.cursor.count, this.cursor.durability);
      this.cursor = left > 0 ? { ...this.cursor, count: left } : null;
    }
  }

  serialize() {
    return { slots: this.slots, selected: this.selected };
  }
  load(data: { slots: (Stack | null)[]; selected: number }) {
    if (data?.slots) this.slots = data.slots.map((s) => (s ? { ...s } : null)).concat(new Array(36).fill(null)).slice(0, 36);
    this.selected = data?.selected ?? 0;
    this.touch();
  }
}
