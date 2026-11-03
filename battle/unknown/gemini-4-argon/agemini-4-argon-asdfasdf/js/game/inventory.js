// 36-Slot Inventory (9 Hotbar + 27 Backpack), Cursor Drag/Split, Tool Durability, and Tag Queries

import { BLOCK } from './blocks.js';
import { getCreativePaletteItems, getItemDef } from './items.js';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export const ITEM_TAGS = {
  'tag:planks': [
    `block:${BLOCK.OAK_PLANKS}`,
    `block:${BLOCK.BIRCH_PLANKS}`,
    `block:${BLOCK.SPRUCE_PLANKS}`,
  ],
  'tag:logs': [
    `block:${BLOCK.OAK_LOG}`,
    `block:${BLOCK.BIRCH_LOG}`,
    `block:${BLOCK.SPRUCE_LOG}`,
  ],
  'tag:coal': ['item:coal', 'item:charcoal'],
  'tag:fuel': [
    'item:coal',
    'item:charcoal',
    `block:${BLOCK.OAK_LOG}`,
    `block:${BLOCK.BIRCH_LOG}`,
    `block:${BLOCK.SPRUCE_LOG}`,
    `block:${BLOCK.OAK_PLANKS}`,
    `block:${BLOCK.BIRCH_PLANKS}`,
    `block:${BLOCK.SPRUCE_PLANKS}`,
  ],
};

export function matchesIngredient(itemId, reqId) {
  if (!itemId) return false;
  if (itemId === reqId) return true;
  const tagList = ITEM_TAGS[reqId];
  return Boolean(tagList && tagList.includes(itemId));
}

export class Inventory {
  constructor() {
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    this.selectedSlot = 0; // 0..8
    this.cursorSlot = null; // held stack while arranging inventory modal
    this.listeners = new Set();
    this.totalCrafted = new Set();
    this.totalCollected = new Map();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitChange() {
    for (const fn of this.listeners) fn(this);
  }

  getHeldStack() {
    return this.slots[this.selectedSlot];
  }

  getHeldDef() {
    const s = this.getHeldStack();
    return s ? getItemDef(s.id) : null;
  }

  selectSlot(index) {
    const clamped = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (this.selectedSlot !== clamped) {
      this.selectedSlot = clamped;
      this.emitChange();
    }
  }

  initDefaultKit(mode = 'survival') {
    this.slots.fill(null);
    this.cursorSlot = null;
    if (mode === 'creative') {
      const defaults = [
        `block:${BLOCK.OAK_PLANKS}`,
        `block:${BLOCK.STONE_BRICKS}`,
        `block:${BLOCK.BRICKS}`,
        `block:${BLOCK.GLASS}`,
        `block:${BLOCK.OAK_LOG}`,
        `block:${BLOCK.LANTERN}`,
        `block:${BLOCK.TORCH}`,
        `block:${BLOCK.WOOL_RED}`,
        'item:water_bucket',
      ];
      defaults.forEach((id, idx) => {
        const def = getItemDef(id);
        this.slots[idx] = { id, count: def.stackSize > 1 ? 64 : 1 };
      });
      const palette = getCreativePaletteItems();
      let slotIdx = HOTBAR_SIZE;
      for (const id of palette) {
        if (slotIdx >= INVENTORY_SIZE) break;
        if (defaults.includes(id)) continue;
        const def = getItemDef(id);
        this.slots[slotIdx++] = { id, count: def.stackSize > 1 ? 64 : 1 };
      }
    } else {
      // Friendly survival start: hands free in slot 0 for tree chopping, plus 4 torches & 2 apples for cave safety
      this.slots[7] = { id: `block:${BLOCK.TORCH}`, count: 4 };
      this.slots[8] = { id: 'item:apple', count: 3 };
    }
    this.emitChange();
  }

  // Returns remaining count that couldn't fit (0 = completely added)
  addItem(itemId, count = 1, durability = null) {
    const def = getItemDef(itemId);
    if (!def || count <= 0) return count;

    let remaining = count;
    this.totalCollected.set(itemId, (this.totalCollected.get(itemId) || 0) + count);

    // 1. Stack onto existing matching stacks (hotbar prioritized first!)
    if (def.stackSize > 1) {
      for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === itemId && s.count < def.stackSize) {
          const add = Math.min(remaining, def.stackSize - s.count);
          s.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, def.stackSize);
        const entry = { id: itemId, count: add };
        if (def.durability) {
          entry.durability = durability ?? def.durability;
          entry.maxDurability = def.durability;
        }
        this.slots[i] = entry;
        remaining -= add;
      }
    }

    this.emitChange();
    return remaining;
  }

  countMatching(reqId) {
    let total = 0;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = this.slots[i];
      if (s && matchesIngredient(s.id, reqId)) {
        total += s.count;
      }
    }
    return total;
  }

  consumeMatching(reqId, amount) {
    let remaining = amount;
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && matchesIngredient(s.id, reqId)) {
        const take = Math.min(remaining, s.count);
        s.count -= take;
        remaining -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.emitChange();
    return remaining === 0;
  }

  consumeSelected(amount = 1) {
    const s = this.slots[this.selectedSlot];
    if (!s) return false;
    s.count -= amount;
    if (s.count <= 0) this.slots[this.selectedSlot] = null;
    this.emitChange();
    return true;
  }

  damageSelectedTool(amount = 1) {
    const s = this.slots[this.selectedSlot];
    if (!s || s.durability === undefined) return { broke: false };
    s.durability -= amount;
    if (s.durability <= 0) {
      const brokenName = getItemDef(s.id)?.name || 'Tool';
      this.slots[this.selectedSlot] = null;
      this.emitChange();
      return { broke: true, name: brokenName };
    }
    this.emitChange();
    return { broke: false };
  }

  // Click handling inside Inventory UI (left click, right click split, shift quick-move)
  handleSlotClick(index, button = 0, shiftKey = false) {
    if (index < 0 || index >= INVENTORY_SIZE) return;
    const slot = this.slots[index];

    if (shiftKey && slot && !this.cursorSlot) {
      const targetRange = index < HOTBAR_SIZE ? [HOTBAR_SIZE, INVENTORY_SIZE] : [0, HOTBAR_SIZE];
      const def = getItemDef(slot.id);
      // Merge stack first
      if (def.stackSize > 1) {
        for (let i = targetRange[0]; i < targetRange[1] && slot.count > 0; i++) {
          const dest = this.slots[i];
          if (dest && dest.id === slot.id && dest.count < def.stackSize) {
            const move = Math.min(slot.count, def.stackSize - dest.count);
            dest.count += move;
            slot.count -= move;
          }
        }
      }
      // Empty slot next
      for (let i = targetRange[0]; i < targetRange[1] && slot.count > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { ...slot };
          slot.count = 0;
        }
      }
      if (slot.count <= 0) this.slots[index] = null;
      this.emitChange();
      return;
    }

    if (button === 2) {
      // Right-click: split half or place 1
      if (!this.cursorSlot && slot) {
        const half = Math.ceil(slot.count / 2);
        this.cursorSlot = { ...slot, count: half };
        slot.count -= half;
        if (slot.count <= 0) this.slots[index] = null;
      } else if (this.cursorSlot) {
        const def = getItemDef(this.cursorSlot.id);
        if (!slot) {
          this.slots[index] = { ...this.cursorSlot, count: 1 };
          this.cursorSlot.count -= 1;
        } else if (slot.id === this.cursorSlot.id && slot.count < def.stackSize) {
          slot.count += 1;
          this.cursorSlot.count -= 1;
        }
        if (this.cursorSlot.count <= 0) this.cursorSlot = null;
      }
      this.emitChange();
      return;
    }

    // Left-click: pick up / place / merge / swap
    if (!this.cursorSlot && slot) {
      this.cursorSlot = slot;
      this.slots[index] = null;
    } else if (this.cursorSlot && !slot) {
      this.slots[index] = this.cursorSlot;
      this.cursorSlot = null;
    } else if (this.cursorSlot && slot) {
      const def = getItemDef(slot.id);
      if (slot.id === this.cursorSlot.id && def.stackSize > 1 && slot.count < def.stackSize) {
        const add = Math.min(this.cursorSlot.count, def.stackSize - slot.count);
        slot.count += add;
        this.cursorSlot.count -= add;
        if (this.cursorSlot.count <= 0) this.cursorSlot = null;
      } else {
        this.slots[index] = this.cursorSlot;
        this.cursorSlot = slot;
      }
    }
    this.emitChange();
  }

  returnCursorToInventory() {
    if (!this.cursorSlot) return;
    this.addItem(this.cursorSlot.id, this.cursorSlot.count, this.cursorSlot.durability);
    this.cursorSlot = null;
    this.emitChange();
  }

  serialize() {
    return {
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      selectedSlot: this.selectedSlot,
      totalCrafted: Array.from(this.totalCrafted),
      totalCollected: Array.from(this.totalCollected.entries()),
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.slots)) {
      this.slots = new Array(INVENTORY_SIZE)
        .fill(null)
        .map((_, idx) => (data.slots[idx] ? { ...data.slots[idx] } : null));
    }
    if (typeof data.selectedSlot === 'number') {
      this.selectedSlot = Math.max(0, Math.min(HOTBAR_SIZE - 1, data.selectedSlot));
    }
    this.totalCrafted = new Set(data.totalCrafted || []);
    this.totalCollected = new Map(data.totalCollected || []);
    this.emitChange();
  }
}
