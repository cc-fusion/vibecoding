import { BLOCK, ITEM, REGISTRY, getMaxStack } from '../constants/Blocks.js';

export const HOTBAR_SIZE = 9;
export const TOTAL_SLOTS = 36;

export class Inventory {
  constructor(mode = 'survival') {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.selectedSlot = 0;
    this.onChange = null;
    this.initStarterKit(mode);
  }

  initStarterKit(mode) {
    this.slots.fill(null);
    if (mode === 'creative') {
      const builderHotbar = [
        { id: BLOCK.STONE_BRICKS, count: 64 },
        { id: BLOCK.OAK_PLANKS, count: 64 },
        { id: BLOCK.COBBLESTONE, count: 64 },
        { id: BLOCK.GLASS, count: 64 },
        { id: BLOCK.OAK_LOG, count: 64 },
        { id: BLOCK.BRICKS, count: 64 },
        { id: BLOCK.TORCH, count: 64 },
        { id: BLOCK.LANTERN, count: 64 },
        { id: BLOCK.TNT, count: 64 },
      ];
      for (let i = 0; i < builderHotbar.length; i++) {
        this.slots[i] = { ...builderHotbar[i] };
      }
    } else {
      // Survival: start fresh so punching your first tree & crafting tools feels rewarding,
      // plus 2 crisp apples in slot 8 for early exploration sustenance.
      this.slots[8] = { id: ITEM.APPLE, count: 2 };
    }
  }

  notify() {
    if (this.onChange) this.onChange();
  }

  selectSlot(idx) {
    this.selectedSlot = ((idx % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.notify();
  }

  cycleSlot(delta) {
    this.selectSlot(this.selectedSlot + (delta > 0 ? 1 : -1));
  }

  getSelected() {
    return this.slots[this.selectedSlot];
  }

  addItem(id, count = 1, durability = null) {
    if (!id || count <= 0) return 0;
    const def = REGISTRY[id];
    if (!def) return count;
    const maxStack = getMaxStack(id);
    let remaining = count;

    // 1. Merge into existing non-full stacks (hotbar first)
    if (maxStack > 1) {
      for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const take = Math.min(remaining, maxStack - s.count);
          s.count += take;
          remaining -= take;
        }
      }
    }

    // 2. Fill empty slots (hotbar first)
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(remaining, maxStack);
        const item = { id, count: take };
        if (def.maxDurability) {
          item.durability = durability ?? def.maxDurability;
        }
        this.slots[i] = item;
        remaining -= take;
      }
    }

    this.notify();
    return remaining;
  }

  consumeSelected(amount = 1) {
    const s = this.slots[this.selectedSlot];
    if (!s) return false;
    s.count -= amount;
    if (s.count <= 0) {
      this.slots[this.selectedSlot] = null;
    }
    this.notify();
    return true;
  }

  damageSelectedTool(amount = 1) {
    const s = this.slots[this.selectedSlot];
    if (!s) return null;
    const def = REGISTRY[s.id];
    if (!def || !def.maxDurability) return null;
    if (typeof s.durability !== 'number') s.durability = def.maxDurability;
    s.durability -= amount;
    if (s.durability <= 0) {
      this.slots[this.selectedSlot] = null;
      this.notify();
      return 'broke';
    }
    this.notify();
    return 'damaged';
  }

  countItem(idOrList) {
    const set = Array.isArray(idOrList) ? new Set(idOrList) : new Set([idOrList]);
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (s && set.has(s.id)) total += s.count;
    }
    return total;
  }

  // Simulate ingredient deduction on a virtual copy so overlapping 'anyOf' groups never false-positive
  canCraft(recipe, stations = { table: false, furnace: false }) {
    if (recipe.station === 'table' && !stations.table) return false;
    if (recipe.station === 'furnace' && !stations.furnace) return false;

    const virtualCounts = this.slots.map((s) => (s ? { id: s.id, count: s.count } : null));

    for (const ing of recipe.ingredients) {
      let need = ing.count;
      const allowed = ing.anyOf ? new Set(ing.anyOf) : new Set([ing.id]);
      for (let i = 0; i < TOTAL_SLOTS && need > 0; i++) {
        const vs = virtualCounts[i];
        if (vs && vs.count > 0 && allowed.has(vs.id)) {
          const take = Math.min(need, vs.count);
          vs.count -= take;
          need -= take;
        }
      }
      if (need > 0) return false;
    }

    // Also verify output fits in inventory after consuming ingredients
    const outDef = REGISTRY[recipe.output.id];
    const maxStack = getMaxStack(recipe.output.id);
    let fit = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const vs = virtualCounts[i];
      if (!vs || vs.count === 0) {
        fit += maxStack;
      } else if (maxStack > 1 && vs.id === recipe.output.id && vs.count < maxStack) {
        fit += maxStack - vs.count;
      }
    }
    return Boolean(outDef && fit >= recipe.output.count);
  }

  craft(recipe, stations = { table: false, furnace: false }) {
    if (!this.canCraft(recipe, stations)) return false;

    for (const ing of recipe.ingredients) {
      let need = ing.count;
      const allowed = ing.anyOf ? new Set(ing.anyOf) : new Set([ing.id]);
      for (let i = 0; i < TOTAL_SLOTS && need > 0; i++) {
        const s = this.slots[i];
        if (s && allowed.has(s.id)) {
          const take = Math.min(need, s.count);
          s.count -= take;
          need -= take;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
    }

    this.addItem(recipe.output.id, recipe.output.count);
    this.notify();
    return true;
  }

  // Click slot interaction (swap or merge stacks)
  interactSlot(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const a = this.slots[fromIdx];
    const b = this.slots[toIdx];
    if (!a) return;

    if (!b) {
      this.slots[toIdx] = a;
      this.slots[fromIdx] = null;
    } else if (a.id === b.id && getMaxStack(b.id) > 1 && b.count < getMaxStack(b.id)) {
      const space = getMaxStack(b.id) - b.count;
      const move = Math.min(space, a.count);
      b.count += move;
      a.count -= move;
      if (a.count <= 0) this.slots[fromIdx] = null;
    } else {
      this.slots[toIdx] = a;
      this.slots[fromIdx] = b;
    }
    this.notify();
  }

  // Shift+Click quick transfer between Hotbar (0..8) and Backpack (9..35)
  quickTransfer(idx) {
    const item = this.slots[idx];
    if (!item) return;
    const targetStart = idx < HOTBAR_SIZE ? HOTBAR_SIZE : 0;
    const targetEnd = idx < HOTBAR_SIZE ? TOTAL_SLOTS : HOTBAR_SIZE;
    const maxStack = getMaxStack(item.id);

    if (maxStack > 1) {
      for (let i = targetStart; i < targetEnd && item.count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === item.id && s.count < maxStack) {
          const move = Math.min(maxStack - s.count, item.count);
          s.count += move;
          item.count -= move;
        }
      }
    }
    for (let i = targetStart; i < targetEnd && item.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...item };
        item.count = 0;
        break;
      }
    }
    if (item.count <= 0) this.slots[idx] = null;
    this.notify();
  }

  serialize() {
    return {
      selectedSlot: this.selectedSlot,
      slots: this.slots.map((s) => (s ? { ...s } : null)),
    };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    this.selectedSlot = Number(data.selectedSlot) || 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = data.slots[i];
      this.slots[i] = s && REGISTRY[s.id] ? { ...s } : null;
    }
    this.notify();
  }
}
