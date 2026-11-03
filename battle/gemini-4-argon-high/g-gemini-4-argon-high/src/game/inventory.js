import { BLOCK, ITEM, REGISTRY, RECIPES } from './constants.js';

export class InventorySystem {
  constructor() {
    this.slots = new Array(36).fill(null); // 0..8 = Hotbar, 9..35 = Backpack
    this.selectedHotbar = 0;
    this.initStarterKit();
  }

  initStarterKit() {
    this.slots.fill(null);
    this.slots[0] = { id: ITEM.WOOD_PICKAXE, count: 1, durability: REGISTRY[ITEM.WOOD_PICKAXE].durability };
    this.slots[1] = { id: ITEM.STONE_SWORD, count: 1, durability: REGISTRY[ITEM.STONE_SWORD].durability };
    this.slots[2] = { id: BLOCK.OAK_LOG, count: 12 };
    this.slots[3] = { id: BLOCK.COBBLESTONE, count: 24 };
    this.slots[4] = { id: BLOCK.TORCH, count: 16 };
    this.slots[5] = { id: BLOCK.CRAFTING_TABLE, count: 1 };
    this.slots[6] = { id: ITEM.APPLE, count: 5 };
    this.slots[7] = { id: BLOCK.GLASS, count: 12 };
    this.slots[8] = { id: BLOCK.TNT, count: 4 };

    // A few extra building blocks in backpack
    this.slots[9] = { id: BLOCK.PLANKS, count: 24 };
    this.slots[10] = { id: BLOCK.BRICKS, count: 16 };
    this.slots[11] = { id: BLOCK.GLOWSTONE, count: 8 };
    this.slots[12] = { id: ITEM.COAL, count: 8 };
    this.slots[13] = { id: ITEM.IRON_INGOT, count: 4 };
  }

  getHeldItem() {
    return this.slots[this.selectedHotbar];
  }

  getHeldDef() {
    const slot = this.getHeldItem();
    return slot ? REGISTRY[slot.id] : null;
  }

  selectSlot(index) {
    this.selectedHotbar = ((index % 9) + 9) % 9;
    return this.getHeldDef();
  }

  addItem(id, count = 1) {
    if (!id || count <= 0) return false;
    const def = REGISTRY[id];
    if (!def) return false;

    const maxStack = def.isTool ? 1 : 64;
    let remaining = count;

    // 1. Merge into existing stacks first
    if (maxStack > 1) {
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const add = Math.min(remaining, maxStack - s.count);
          s.count += add;
          remaining -= add;
          if (remaining <= 0) return true;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, maxStack);
        this.slots[i] = {
          id,
          count: add,
          durability: def.isTool ? def.durability : undefined,
        };
        remaining -= add;
        if (remaining <= 0) return true;
      }
    }

    return remaining < count;
  }

  consumeHeld(amount = 1) {
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return false;
    slot.count -= amount;
    if (slot.count <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    return true;
  }

  damageHeldTool(amount = 1) {
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return;
    const def = REGISTRY[slot.id];
    if (!def || !def.isTool) return;
    if (typeof slot.durability !== 'number') {
      slot.durability = def.durability;
    }
    slot.durability -= amount;
    if (slot.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
  }

  getCount(id) {
    let total = 0;
    for (const s of this.slots) {
      if (s && s.id === id) total += s.count;
    }
    return total;
  }

  removeById(id, count = 1) {
    let rem = count;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(rem, s.count);
        s.count -= take;
        rem -= take;
        if (s.count <= 0) this.slots[i] = null;
        if (rem <= 0) return true;
      }
    }
    return rem <= 0;
  }

  canCraft(recipe) {
    for (const req of recipe.ingredients) {
      if (this.getCount(req.id) < req.count) return false;
    }
    return true;
  }

  craft(recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return false;

    for (const req of recipe.ingredients) {
      this.removeById(req.id, req.count);
    }
    this.addItem(recipe.result.id, recipe.result.count);
    return true;
  }

  swapSlots(indexA, indexB) {
    if (indexA === indexB) return;
    if (indexA < 0 || indexA >= this.slots.length || indexB < 0 || indexB >= this.slots.length) return;
    const a = this.slots[indexA];
    const b = this.slots[indexB];

    // If same stackable item, merge
    if (a && b && a.id === b.id && !REGISTRY[a.id]?.isTool) {
      const space = 64 - b.count;
      if (space > 0) {
        const move = Math.min(space, a.count);
        b.count += move;
        a.count -= move;
        if (a.count <= 0) this.slots[indexA] = null;
        return;
      }
    }

    this.slots[indexA] = b;
    this.slots[indexB] = a;
  }

  getMiningSpeed(blockId) {
    const blockDef = REGISTRY[blockId];
    if (!blockDef) return 1.0;
    const heldDef = this.getHeldDef();
    if (!heldDef || !heldDef.isTool) return 1.0;
    if (heldDef.toolType === blockDef.tool) {
      return heldDef.speed || 2.5;
    }
    return 1.15;
  }

  getAttackDamage() {
    const heldDef = this.getHeldDef();
    if (!heldDef) return 2; // Fist damage
    return heldDef.damage || 2;
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { ...s } : null)),
    };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    this.selectedHotbar = Number(data.selectedHotbar) || 0;
    for (let i = 0; i < 36; i++) {
      this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
    }
  }
}
