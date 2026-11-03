import { ITEMS, getItem } from './blocks.js';

export class Inventory {
  constructor(saved = null) {
    this.size = 36;
    this.slots = Array.from({ length: this.size }, () => null);
    this.selected = 0;
    if (saved?.slots) {
      saved.slots.slice(0, this.size).forEach((slot, index) => {
        if (slot && ITEMS[slot.id]) this.slots[index] = { id: slot.id, count: Math.max(1, slot.count | 0), ...(slot.durability ? { durability: slot.durability } : {}) };
      });
      this.selected = Math.max(0, Math.min(8, saved.selected | 0));
    }
  }

  selectedSlot() {
    return this.slots[this.selected];
  }

  selectedItem() {
    const slot = this.selectedSlot();
    return slot ? getItem(slot.id) : null;
  }

  countItem(id) {
    return this.slots.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0);
  }

  hasIngredients(ingredients) {
    return Object.entries(ingredients).every(([id, count]) => this.countItem(id) >= count);
  }

  addItem(id, count = 1) {
    const def = getItem(id);
    if (!def || count <= 0) return count;
    let remaining = count;
    if (def.stack > 1) {
      for (const slot of this.slots) {
        if (remaining <= 0) break;
        if (slot?.id === id && slot.count < def.stack) {
          const amount = Math.min(remaining, def.stack - slot.count);
          slot.count += amount;
          remaining -= amount;
        }
      }
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const amount = Math.min(remaining, def.stack);
      this.slots[i] = { id, count: amount };
      if (def.durability) this.slots[i].durability = def.durability;
      remaining -= amount;
    }
    return remaining;
  }

  removeItem(id, count = 1) {
    if (this.countItem(id) < count) return false;
    let remaining = count;
    for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
      const slot = this.slots[i];
      if (slot?.id !== id) continue;
      const amount = Math.min(remaining, slot.count);
      slot.count -= amount;
      remaining -= amount;
      if (slot.count <= 0) this.slots[i] = null;
    }
    return true;
  }

  consumeIngredients(ingredients) {
    if (!this.hasIngredients(ingredients)) return false;
    for (const [id, count] of Object.entries(ingredients)) this.removeItem(id, count);
    return true;
  }

  removeSelected(count = 1) {
    const slot = this.selectedSlot();
    if (!slot) return false;
    const amount = Math.min(count, slot.count);
    slot.count -= amount;
    if (slot.count <= 0) this.slots[this.selected] = null;
    return amount;
  }

  damageSelected(amount = 1) {
    const slot = this.selectedSlot();
    if (!slot) return null;
    const def = getItem(slot.id);
    if (!def?.durability) return null;
    slot.durability = Math.max(0, (slot.durability ?? def.durability) - amount);
    if (slot.durability <= 0) {
      this.slots[this.selected] = null;
      return def.name;
    }
    return null;
  }

  swapSlots(a, b) {
    if (a === b || a < 0 || b < 0 || a >= this.size || b >= this.size) return;
    const first = this.slots[a];
    const second = this.slots[b];
    if (first && second && first.id === second.id) {
      const def = getItem(first.id);
      const space = def.stack - second.count;
      if (space > 0 && def.stack > 1) {
        const moved = Math.min(space, first.count);
        second.count += moved;
        first.count -= moved;
        if (first.count <= 0) this.slots[a] = null;
        return;
      }
    }
    this.slots[a] = second;
    this.slots[b] = first;
  }

  sortBackpack() {
    const backpack = this.slots.slice(9);
    const merged = [];
    for (const slot of backpack) {
      if (!slot) continue;
      const def = getItem(slot.id);
      const existing = merged.find((other) => other.id === slot.id && other.count < def.stack && def.stack > 1);
      if (existing) {
        const amount = Math.min(slot.count, def.stack - existing.count);
        existing.count += amount;
        slot.count -= amount;
        if (slot.count > 0) merged.push(slot);
      } else merged.push(slot);
    }
    merged.sort((a, b) => {
      const blockA = getItem(a.id).block !== undefined ? 0 : 1;
      const blockB = getItem(b.id).block !== undefined ? 0 : 1;
      return blockA - blockB || getItem(a.id).name.localeCompare(getItem(b.id).name);
    });
    for (let i = 9; i < this.size; i++) this.slots[i] = merged[i - 9] || null;
  }

  serialize() {
    return { selected: this.selected, slots: this.slots.map((slot) => slot ? { ...slot } : null) };
  }
}
