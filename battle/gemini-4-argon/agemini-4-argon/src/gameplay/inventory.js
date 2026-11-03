import { BLOCK, ITEM, getDef } from '../world/blocks.js';

export const HOTBAR_SIZE = 9;
export const BACKPACK_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + BACKPACK_SIZE;

export class Inventory {
  constructor() {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.selectedHotbar = 0;
    this.onChange = null;
  }

  notify() {
    if (this.onChange) this.onChange();
  }

  getActiveSlot() {
    return this.slots[this.selectedHotbar];
  }

  getActiveDef() {
    const slot = this.getActiveSlot();
    return slot ? getDef(slot.id) : null;
  }

  selectHotbar(idx) {
    this.selectedHotbar = ((idx % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.notify();
  }

  cycleHotbar(delta) {
    this.selectHotbar(this.selectedHotbar + (delta > 0 ? 1 : -1));
  }

  // Give helpful starter survival kit or creative kit on new world
  populateStarterKit(mode = 'survival') {
    this.slots.fill(null);
    if (mode === 'creative') {
      const creativeBar = [
        BLOCK.OAK_PLANKS,
        BLOCK.COBBLESTONE,
        BLOCK.BRICKS,
        BLOCK.GLASS,
        BLOCK.TORCH,
        BLOCK.LANTERN,
        BLOCK.CRYSTAL_BLOCK,
        ITEM.BUCKET_WATER,
        ITEM.CRYSTAL_PICKAXE,
      ];
      creativeBar.forEach((id, i) => {
        const def = getDef(id);
        this.slots[i] = {
          id,
          count: def.stackSize > 1 ? 64 : 1,
          durability: def.maxDurability || null,
        };
      });
    } else {
      // Friendly Survival start: basic wood axe + 4 torches + 3 apples so night 1 is approachable,
      // while still leaving full Wood -> Stone -> Iron -> Crystal progression intact!
      this.slots[0] = { id: ITEM.WOOD_AXE, count: 1, durability: getDef(ITEM.WOOD_AXE).maxDurability };
      this.slots[1] = { id: BLOCK.TORCH, count: 6, durability: null };
      this.slots[2] = { id: ITEM.APPLE, count: 3, durability: null };
    }
    this.notify();
  }

  addItem(id, count = 1, durability = null) {
    if (!id || count <= 0) return 0;
    const def = getDef(id);
    if (!def || id === BLOCK.AIR) return count;

    const maxStack = def.stackSize || 64;
    let remaining = count;

    // 1. Merge into existing non-full stacks (hotbar first, then backpack)
    if (maxStack > 1) {
      for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const space = maxStack - s.count;
          const take = Math.min(space, remaining);
          s.count += take;
          remaining -= take;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(maxStack, remaining);
        this.slots[i] = {
          id,
          count: take,
          durability: durability ?? (def.maxDurability > 0 ? def.maxDurability : null),
        };
        remaining -= take;
      }
    }

    if (remaining !== count) this.notify();
    return remaining;
  }

  consumeActive(amount = 1, infinite = false) {
    const s = this.slots[this.selectedHotbar];
    if (!s) return false;
    if (infinite) return true;
    s.count -= amount;
    if (s.count <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    this.notify();
    return true;
  }

  replaceActive(newId) {
    const def = getDef(newId);
    this.slots[this.selectedHotbar] = {
      id: newId,
      count: 1,
      durability: def.maxDurability > 0 ? def.maxDurability : null,
    };
    this.notify();
  }

  damageActiveTool(amount = 1, infinite = false) {
    if (infinite) return false;
    const s = this.slots[this.selectedHotbar];
    if (!s || s.durability == null) return false;
    s.durability -= amount;
    if (s.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
      this.notify();
      return true; // broke
    }
    this.notify();
    return false;
  }

  countItem(idOrGroup) {
    const ids = Array.isArray(idOrGroup) ? idOrGroup : [idOrGroup];
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (s && ids.includes(s.id)) total += s.count;
    }
    return total;
  }

  hasIngredients(ingredients) {
    for (const ing of ingredients) {
      if (this.countItem(ing.ids) < ing.count) return false;
    }
    return true;
  }

  consumeIngredients(ingredients) {
    if (!this.hasIngredients(ingredients)) return false;
    for (const ing of ingredients) {
      let rem = ing.count;
      for (let i = 0; i < TOTAL_SLOTS && rem > 0; i++) {
        const s = this.slots[i];
        if (s && ing.ids.includes(s.id)) {
          const take = Math.min(s.count, rem);
          s.count -= take;
          rem -= take;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
    }
    this.notify();
    return true;
  }

  // Click / drag-free slot interaction: swap or merge stacks
  interactSlots(fromIdx, toIdx, rightClick = false) {
    if (fromIdx === toIdx) return;
    const a = this.slots[fromIdx];
    const b = this.slots[toIdx];
    if (!a) return;

    const defA = getDef(a.id);
    const maxStack = defA.stackSize || 64;

    if (rightClick && a.count > 1 && !b) {
      const half = Math.ceil(a.count / 2);
      a.count -= half;
      this.slots[toIdx] = { id: a.id, count: half, durability: a.durability };
      this.notify();
      return;
    }

    if (b && b.id === a.id && maxStack > 1 && b.count < maxStack) {
      const take = Math.min(maxStack - b.count, rightClick ? 1 : a.count);
      b.count += take;
      a.count -= take;
      if (a.count <= 0) this.slots[fromIdx] = null;
      this.notify();
      return;
    }

    this.slots[fromIdx] = b;
    this.slots[toIdx] = a;
    this.notify();
  }

  // Shift-click quick move between Hotbar (0..8) and Backpack (9..35)
  quickMove(idx) {
    const s = this.slots[idx];
    if (!s) return;
    const def = getDef(s.id);
    const maxStack = def.stackSize || 64;
    const rangeStart = idx < HOTBAR_SIZE ? HOTBAR_SIZE : 0;
    const rangeEnd = idx < HOTBAR_SIZE ? TOTAL_SLOTS : HOTBAR_SIZE;

    // Try merge first
    if (maxStack > 1) {
      for (let i = rangeStart; i < rangeEnd && s.count > 0; i++) {
        const dst = this.slots[i];
        if (dst && dst.id === s.id && dst.count < maxStack) {
          const take = Math.min(maxStack - dst.count, s.count);
          dst.count += take;
          s.count -= take;
        }
      }
    }

    // Then empty slot
    for (let i = rangeStart; i < rangeEnd && s.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...s };
        s.count = 0;
        break;
      }
    }

    if (s.count <= 0) this.slots[idx] = null;
    this.notify();
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { id: s.id, count: s.count, durability: s.durability } : null)),
    };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    this.selectedHotbar = data.selectedHotbar ?? 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = data.slots[i];
      this.slots[i] = s && getDef(s.id) ? { id: s.id, count: s.count, durability: s.durability ?? null } : null;
    }
    this.notify();
  }
}
