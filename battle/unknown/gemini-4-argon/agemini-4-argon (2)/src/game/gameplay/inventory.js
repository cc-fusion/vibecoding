import { BLOCK, ITEM, getDef } from '../blocks.js';

export const INGREDIENT_GROUPS = {
  ANY_PLANKS: {
    name: 'Any Wood Planks',
    ids: [BLOCK.OAK_PLANKS, BLOCK.BIRCH_PLANKS, BLOCK.SPRUCE_PLANKS],
    previewId: BLOCK.OAK_PLANKS,
  },
  ANY_LOG: {
    name: 'Any Wood Log',
    ids: [BLOCK.OAK_LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG],
    previewId: BLOCK.OAK_LOG,
  },
  ANY_FUEL: {
    name: 'Fuel (Coal / Wood)',
    ids: [ITEM.COAL, BLOCK.OAK_PLANKS, BLOCK.BIRCH_PLANKS, BLOCK.SPRUCE_PLANKS, BLOCK.OAK_LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG],
    previewId: ITEM.COAL,
  },
};

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null); // 0..8 hotbar, 9..35 backpack
    this.selectedHotbar = 0;
    this.onChange = null;
  }

  notify() {
    if (typeof this.onChange === 'function') this.onChange();
  }

  getHeldSlot() {
    return this.slots[this.selectedHotbar];
  }

  getHeldId() {
    const s = this.slots[this.selectedHotbar];
    return s ? s.id : 0;
  }

  selectHotbar(index) {
    const clamped = ((index % 9) + 9) % 9;
    if (this.selectedHotbar !== clamped) {
      this.selectedHotbar = clamped;
      this.notify();
    }
  }

  addItem(id, count = 1, customDurability = null) {
    if (!id || count <= 0) return 0;
    const def = getDef(id);
    const maxStack = def.maxStack || 64;
    let remaining = count;

    // 1. Stack into existing matching slots
    if (maxStack > 1) {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.id === id && slot.count < maxStack) {
          const canAdd = Math.min(remaining, maxStack - slot.count);
          slot.count += canAdd;
          remaining -= canAdd;
        }
      }
    }

    // 2. Fill empty slots (hotbar 0..8 first, then backpack 9..35)
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const putCount = Math.min(remaining, maxStack);
        const entry = { id, count: putCount };
        if (def.durability) {
          entry.maxDurability = def.durability;
          entry.durability = customDurability !== null ? customDurability : def.durability;
        }
        this.slots[i] = entry;
        remaining -= putCount;
      }
    }

    this.notify();
    return remaining;
  }

  consumeHeld(amount = 1) {
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return false;
    slot.count -= amount;
    if (slot.count <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    this.notify();
    return true;
  }

  damageHeldTool(amount = 1) {
    const slot = this.slots[this.selectedHotbar];
    if (!slot || typeof slot.durability !== 'number') return 'none';
    slot.durability -= amount;
    if (slot.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
      this.notify();
      return 'broke';
    }
    this.notify();
    return 'damaged';
  }

  countIngredient(idOrGroup) {
    if (typeof idOrGroup === 'string' && INGREDIENT_GROUPS[idOrGroup]) {
      const ids = INGREDIENT_GROUPS[idOrGroup].ids;
      let total = 0;
      for (const slot of this.slots) {
        if (slot && ids.includes(slot.id)) total += slot.count;
      }
      return total;
    }
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.id === idOrGroup) total += slot.count;
    }
    return total;
  }

  canAfford(ingredients) {
    for (const ing of ingredients) {
      if (this.countIngredient(ing.item) < ing.count) return false;
    }
    return true;
  }

  consumeIngredients(ingredients) {
    if (!this.canAfford(ingredients)) return false;

    for (const ing of ingredients) {
      let toRemove = ing.count;
      const validIds = (typeof ing.item === 'string' && INGREDIENT_GROUPS[ing.item])
        ? INGREDIENT_GROUPS[ing.item].ids
        : [ing.item];

      for (let i = 0; i < this.slots.length && toRemove > 0; i++) {
        const slot = this.slots[i];
        if (slot && validIds.includes(slot.id)) {
          const take = Math.min(toRemove, slot.count);
          slot.count -= take;
          toRemove -= take;
          if (slot.count <= 0) this.slots[i] = null;
        }
      }
    }

    this.notify();
    return true;
  }

  swapSlots(indexA, indexB) {
    if (indexA === indexB) return;
    const a = this.slots[indexA];
    const b = this.slots[indexB];

    // Merge stacks if identical stackable item
    if (a && b && a.id === b.id && !a.maxDurability) {
      const maxStack = getDef(a.id).maxStack || 64;
      const space = maxStack - b.count;
      if (space > 0) {
        const move = Math.min(space, a.count);
        b.count += move;
        a.count -= move;
        if (a.count <= 0) this.slots[indexA] = null;
        this.notify();
        return;
      }
    }

    this.slots[indexA] = b;
    this.slots[indexB] = a;
    this.notify();
  }

  quickTransfer(slotIndex) {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    const isHotbar = slotIndex < 9;
    const start = isHotbar ? 9 : 0;
    const end = isHotbar ? 36 : 9;
    const maxStack = getDef(slot.id).maxStack || 64;

    if (maxStack > 1) {
      for (let i = start; i < end && slot.count > 0; i++) {
        const target = this.slots[i];
        if (target && target.id === slot.id && target.count < maxStack) {
          const move = Math.min(slot.count, maxStack - target.count);
          target.count += move;
          slot.count -= move;
        }
      }
    }

    for (let i = start; i < end && slot.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...slot };
        slot.count = 0;
        break;
      }
    }

    if (slot.count <= 0) this.slots[slotIndex] = null;
    this.notify();
  }

  clearAndLoadCreativeDefaults() {
    this.slots.fill(null);
    const defaults = [
      BLOCK.OAK_PLANKS,
      BLOCK.COBBLESTONE,
      BLOCK.BRICKS,
      BLOCK.GLASS,
      BLOCK.TORCH,
      BLOCK.GLOWSTONE,
      BLOCK.OAK_LOG,
      BLOCK.CRAFTING_TABLE,
      ITEM.DIAMOND_PICKAXE,
    ];
    defaults.forEach((id, idx) => {
      const def = getDef(id);
      this.slots[idx] = {
        id,
        count: def.maxStack === 1 ? 1 : 64,
        ...(def.durability ? { durability: def.durability, maxDurability: def.durability } : {}),
      };
    });
    this.notify();
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { ...s } : null)),
    };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    this.selectedHotbar = typeof data.selectedHotbar === 'number' ? data.selectedHotbar : 0;
    this.slots = new Array(36).fill(null);
    for (let i = 0; i < Math.min(36, data.slots.length); i++) {
      const s = data.slots[i];
      if (s && s.id && s.count > 0) {
        this.slots[i] = { ...s };
      }
    }
    this.notify();
  }
}
