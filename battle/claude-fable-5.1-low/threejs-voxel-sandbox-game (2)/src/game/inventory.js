import { maxStack, getDef } from './blocks.js';

export class Inventory {
  constructor(size = 36) {
    this.slots = new Array(size).fill(null);
    this.selected = 0;
    this.onChange = null;
  }
  get held() { return this.slots[this.selected]; }
  changed() { if (this.onChange) this.onChange(); }

  add(id, count = 1) {
    const max = maxStack(id);
    // fill existing stacks (hotbar first)
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max && !getDef(id).durability) { const n = Math.min(max - s.count, count); s.count += n; count -= n; }
    }
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (!this.slots[i]) { const n = Math.min(max, count); this.slots[i] = { id, count: n }; const d = getDef(id); if (d.durability) this.slots[i].dur = d.durability; count -= n; }
    }
    this.changed();
    return count; // leftover
  }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }
  remove(id, count = 1) {
    for (let i = this.slots.length - 1; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) { const n = Math.min(s.count, count); s.count -= n; count -= n; if (s.count <= 0) this.slots[i] = null; }
    }
    this.changed();
    return count === 0;
  }
  consumeHeld(n = 1) {
    const s = this.slots[this.selected]; if (!s) return;
    s.count -= n; if (s.count <= 0) this.slots[this.selected] = null;
    this.changed();
  }
  damageHeld(amount = 1) {
    const s = this.slots[this.selected]; if (!s || s.dur === undefined) return false;
    s.dur -= amount;
    if (s.dur <= 0) { this.slots[this.selected] = null; this.changed(); return true; }
    this.changed(); return false;
  }
  select(i) { this.selected = ((i % 9) + 9) % 9; this.changed(); }
  serialize() { return { slots: this.slots, selected: this.selected }; }
  load(data) { if (!data) return; this.slots = data.slots.map(s => s ? { ...s } : null); while (this.slots.length < 36) this.slots.push(null); this.selected = data.selected || 0; this.changed(); }
  isEmpty() { return this.slots.every(s => !s); }
}
