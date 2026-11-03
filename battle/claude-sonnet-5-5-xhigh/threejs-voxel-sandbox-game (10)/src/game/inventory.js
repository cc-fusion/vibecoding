// Inventory model: 36 slots (0-8 hotbar), stacks are {id,count,dmg?}
import { DEFS, maxStack } from './blocks.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
    this.selected = 0;
    this.version = 0;
  }
  touch() { this.version++; }

  held() { return this.slots[this.selected]; }

  // returns count that did not fit
  add(id, count = 1, dmg = 0) {
    if (!DEFS[id] || count <= 0) return 0;
    const max = maxStack(id);
    const order = [];
    for (let i = 0; i < 36; i++) order.push(i);
    if (max > 1) {
      for (const i of order) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const n = Math.min(max - s.count, count);
          s.count += n; count -= n;
          if (!count) { this.touch(); return 0; }
        }
      }
    }
    for (const i of order) {
      if (!this.slots[i]) {
        const n = Math.min(max, count);
        this.slots[i] = { id, count: n };
        if (max === 1 && dmg) this.slots[i].dmg = dmg;
        count -= n;
        if (!count) { this.touch(); return 0; }
      }
    }
    this.touch();
    return count;
  }

  canAdd(id, count = 1) {
    const max = maxStack(id);
    let space = 0;
    for (const s of this.slots) {
      if (!s) space += max;
      else if (s.id === id && max > 1) space += max - s.count;
      if (space >= count) return true;
    }
    return false;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id, count = 1) {
    if (this.count(id) < count) return false;
    for (let i = 35; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const n = Math.min(s.count, count);
        s.count -= n; count -= n;
        if (!s.count) this.slots[i] = null;
      }
    }
    this.touch();
    return true;
  }

  decrementHeld() {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.touch();
  }

  // returns true if the tool broke
  damageHeld(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return false;
    const d = DEFS[s.id];
    if (!d || !d.durability) return false;
    s.dmg = (s.dmg || 0) + n;
    this.touch();
    if (s.dmg >= d.durability) { this.slots[this.selected] = null; return true; }
    return false;
  }

  clear() { this.slots.fill(null); this.touch(); }

  serialize() { return this.slots.map((s) => (s ? [s.id, s.count, s.dmg || 0] : 0)); }
  load(arr) {
    this.slots.fill(null);
    (arr || []).forEach((s, i) => { if (s && i < 36 && DEFS[s[0]] && s[1] > 0) this.slots[i] = { id: s[0], count: s[1], ...(s[2] ? { dmg: s[2] } : {}) }; });
    this.touch();
  }
}

export const cloneStack = (s) => (s ? { ...s } : null);
