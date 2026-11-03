import { GAME_MODES } from '../constants.js';
import { BLOCK } from '../data/blocks.js';
import { getEntry, ITEM } from '../data/items.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null); // 0..8 hotbar, 9..35 main bag
    this.selectedHotbar = 0;
    this.onChange = null;
  }

  notify() {
    if (this.onChange) this.onChange();
  }

  initDefaultForMode(gameMode) {
    this.slots.fill(null);
    this.selectedHotbar = 0;
    if (gameMode === GAME_MODES.CREATIVE) {
      this.slots[0] = { id: BLOCK.OAK_PLANKS, count: 1 };
      this.slots[1] = { id: BLOCK.STONE_BRICKS, count: 1 };
      this.slots[2] = { id: BLOCK.BRICKS, count: 1 };
      this.slots[3] = { id: BLOCK.GLASS, count: 1 };
      this.slots[4] = { id: BLOCK.GLOWSTONE, count: 1 };
      this.slots[5] = { id: BLOCK.TORCH, count: 1 };
      this.slots[6] = { id: BLOCK.BED_BLOCK, count: 1 };
      this.slots[7] = { id: ITEM.WATER_BUCKET, count: 1 };
      this.slots[8] = { id: BLOCK.TNT, count: 1 };
    } else {
      // Friendly survival snack in last slot without skipping wood-gathering progression
      this.slots[8] = { id: ITEM.APPLE, count: 3 };
    }
    this.notify();
  }

  getHeldSlot() {
    return this.slots[this.selectedHotbar];
  }

  getHeldEntry() {
    const s = this.getHeldSlot();
    return s && s.count > 0 ? getEntry(s.id) : null;
  }

  selectHotbar(idx) {
    this.selectedHotbar = ((idx % 9) + 9) % 9;
    this.notify();
  }

  cycleHotbar(delta) {
    this.selectHotbar(this.selectedHotbar + (delta > 0 ? 1 : -1));
  }

  createItemObject(id, count = 1, durability = undefined) {
    const entry = getEntry(id);
    if (!entry) return null;
    const obj = { id, count };
    if (entry.maxDurability > 0) {
      obj.durability = durability !== undefined ? durability : entry.maxDurability;
    }
    return obj;
  }

  canMerge(a, b) {
    if (!a || !b || a.id !== b.id) return false;
    const entry = getEntry(a.id);
    if (!entry || entry.stackSize <= 1 || entry.maxDurability > 0) return false;
    return true;
  }

  // Returns leftover count that couldn't fit
  addItem(id, count = 1, durability = undefined) {
    const entry = getEntry(id);
    if (!entry || count <= 0) return 0;
    const maxStack = entry.stackSize || 64;
    let remaining = count;

    // 1. Merge into existing non-full stacks
    if (maxStack > 1 && !entry.maxDurability) {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const add = Math.min(maxStack - s.count, remaining);
          s.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(maxStack, remaining);
        this.slots[i] = this.createItemObject(id, add, durability);
        remaining -= add;
      }
    }

    if (remaining !== count) this.notify();
    return remaining;
  }

  consumeHeld(amount = 1, gameMode = GAME_MODES.SURVIVAL) {
    if (gameMode === GAME_MODES.CREATIVE) return true;
    const s = this.slots[this.selectedHotbar];
    if (!s || s.count < amount) return false;
    s.count -= amount;
    if (s.count <= 0) this.slots[this.selectedHotbar] = null;
    this.notify();
    return true;
  }

  // Returns true if tool broke
  damageHeldTool(amount = 1, gameMode = GAME_MODES.SURVIVAL) {
    if (gameMode === GAME_MODES.CREATIVE) return false;
    const s = this.slots[this.selectedHotbar];
    if (!s) return false;
    const entry = getEntry(s.id);
    if (!entry || !entry.maxDurability) return false;
    if (s.durability === undefined) s.durability = entry.maxDurability;
    s.durability -= amount;
    if (s.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
      this.notify();
      return true;
    }
    this.notify();
    return false;
  }

  // Standard Minecraft-like slot click (button 0 = left, button 2 = right)
  interactSlot(targetArray, index, cursorRef, button = 0) {
    const slot = targetArray[index];
    const cur = cursorRef.item;

    if (!cur && !slot) return;

    if (button === 0) {
      // Left click
      if (!cur && slot) {
        cursorRef.item = slot;
        targetArray[index] = null;
      } else if (cur && !slot) {
        targetArray[index] = cur;
        cursorRef.item = null;
      } else if (cur && slot) {
        if (this.canMerge(cur, slot)) {
          const maxStack = getEntry(slot.id).stackSize || 64;
          const space = maxStack - slot.count;
          if (space > 0) {
            const move = Math.min(space, cur.count);
            slot.count += move;
            cur.count -= move;
            if (cur.count <= 0) cursorRef.item = null;
          }
        } else {
          targetArray[index] = cur;
          cursorRef.item = slot;
        }
      }
    } else if (button === 2) {
      // Right click: split half if cursor empty, or drop 1 if cursor holding item
      if (!cur && slot) {
        const take = Math.ceil(slot.count / 2);
        cursorRef.item = { ...slot, count: take };
        slot.count -= take;
        if (slot.count <= 0) targetArray[index] = null;
      } else if (cur && !slot) {
        targetArray[index] = { ...cur, count: 1 };
        cur.count -= 1;
        if (cur.count <= 0) cursorRef.item = null;
      } else if (cur && slot && this.canMerge(cur, slot)) {
        const maxStack = getEntry(slot.id).stackSize || 64;
        if (slot.count < maxStack) {
          slot.count += 1;
          cur.count -= 1;
          if (cur.count <= 0) cursorRef.item = null;
        }
      }
    }
    this.notify();
  }

  // Shift-click quick move between two ranges inside an array or across arrays
  quickTransfer(srcArray, srcIdx, dstArray, dstStart = 0, dstEnd = dstArray.length) {
    const item = srcArray[srcIdx];
    if (!item || item.count <= 0) return false;
    const entry = getEntry(item.id);
    const maxStack = entry?.stackSize || 64;

    let moved = false;
    if (maxStack > 1 && !entry?.maxDurability) {
      for (let i = dstStart; i < dstEnd && item.count > 0; i++) {
        const dst = dstArray[i];
        if (dst && dst.id === item.id && dst.count < maxStack) {
          const add = Math.min(maxStack - dst.count, item.count);
          dst.count += add;
          item.count -= add;
          moved = true;
        }
      }
    }
    for (let i = dstStart; i < dstEnd && item.count > 0; i++) {
      if (!dstArray[i]) {
        dstArray[i] = { ...item };
        item.count = 0;
        moved = true;
        break;
      }
    }
    if (item.count <= 0) srcArray[srcIdx] = null;
    if (moved) this.notify();
    return moved;
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { ...s } : null)),
    };
  }

  restore(data) {
    if (!data) return;
    this.selectedHotbar = data.selectedHotbar ?? 0;
    if (Array.isArray(data.slots)) {
      for (let i = 0; i < 36; i++) {
        this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
      }
    }
    this.notify();
  }
}
