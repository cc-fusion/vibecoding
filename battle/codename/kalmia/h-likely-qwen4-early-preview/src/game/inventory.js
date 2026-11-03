// 36-slot inventory (9 hotbar + 27 storage), stacking, durability.
import { stackMax, defOf } from './blocks.js';

export class Inventory {
  constructor(size = 36) {
    this.size = size;
    this.slots = new Array(size).fill(null); // { id, n, dur? }
    this.selected = 0;
    this.onChange = null;
  }

  changed() { this.onChange?.(); }

  get held() { return this.slots[this.selected]; }

  // Returns leftover count that didn't fit.
  add(id, n = 1, dur = undefined) {
    const max = stackMax(id);
    const def = defOf(id);
    if (max > 1) {
      for (let i = 0; i < this.size && n > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.n < max) {
          const take = Math.min(max - s.n, n);
          s.n += take; n -= take;
        }
      }
    }
    for (let i = 0; i < this.size && n > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, n);
        const slot = { id, n: take };
        if (def && def.durability) slot.dur = dur ?? def.durability;
        this.slots[i] = slot;
        n -= take;
      }
    }
    this.changed();
    return n;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  }

  remove(id, n) {
    for (let i = this.size - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.n, n);
        s.n -= take; n -= take;
        if (s.n <= 0) this.slots[i] = null;
      }
    }
    this.changed();
    return n === 0;
  }

  consumeSlot(i, n = 1) {
    const s = this.slots[i];
    if (!s) return;
    s.n -= n;
    if (s.n <= 0) this.slots[i] = null;
    this.changed();
  }

  // Damage held tool; returns true if it broke
  damageHeld(amount = 1) {
    const s = this.held;
    if (!s) return false;
    const def = defOf(s.id);
    if (!def || !def.durability) return false;
    s.dur = (s.dur ?? def.durability) - amount;
    if (s.dur <= 0) {
      this.slots[this.selected] = null;
      this.changed();
      return true;
    }
    this.changed();
    return false;
  }

  firstEmpty() { return this.slots.findIndex((s) => !s); }
  isFull() { return this.firstEmpty() === -1; }

  serialize() {
    return { slots: this.slots, selected: this.selected };
  }

  deserialize(d) {
    if (!d) return;
    this.slots = (d.slots || []).slice(0, this.size);
    while (this.slots.length < this.size) this.slots.push(null);
    this.selected = d.selected || 0;
    this.changed();
  }
}