import { BLOCK, ITEM, getItemDef } from './blocks.js';

export const HOTBAR_SIZE = 9;
export const BACKPACK_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + BACKPACK_SIZE;

export class Inventory {
  constructor() {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.selectedSlot = 0;
    this.furnaceFuelCharges = 0;
  }

  initStarterKit(mode) {
    this.slots.fill(null);
    this.selectedSlot = 0;
    this.furnaceFuelCharges = 0;

    if (mode === 'creative') {
      const creativeHotbar = [
        { id: BLOCK.GRASS, count: 64 },
        { id: BLOCK.STONE_BRICKS, count: 64 },
        { id: BLOCK.OAK_PLANKS, count: 64 },
        { id: BLOCK.GLASS, count: 64 },
        { id: BLOCK.BRICKS, count: 64 },
        { id: BLOCK.LANTERN, count: 64 },
        { id: BLOCK.TORCH, count: 64 },
        { id: BLOCK.BED, count: 1 },
        { id: ITEM.DIAMOND_PICKAXE, count: 1, durability: 650, maxDurability: 650 },
      ];
      creativeHotbar.forEach((s, i) => { this.slots[i] = s; });
    } else {
      // Friendly Survival start: just an Apple for nourishment — punch your first tree to begin!
      this.slots[0] = null;
      this.slots[8] = { id: ITEM.APPLE, count: 3 };
    }
  }

  getActiveStack() {
    return this.slots[this.selectedSlot];
  }

  getActiveItemDef() {
    const st = this.slots[this.selectedSlot];
    return st ? getItemDef(st.id) : null;
  }

  selectSlot(idx) {
    this.selectedSlot = ((idx % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  countItem(id) {
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (this.slots[i]?.id === id) total += this.slots[i].count;
    }
    return total;
  }

  countGroup(ids) {
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (s && ids.includes(s.id)) total += s.count;
    }
    return total;
  }

  hasAny(ids) {
    return this.countGroup(ids) > 0;
  }

  addItem(id, count = 1, customDurability = null) {
    if (!id || id === BLOCK.AIR || count <= 0) return 0;
    const def = getItemDef(id);
    const maxStack = def.maxStack || 64;
    let remaining = count;

    // 1. Merge into existing non-full stacks first
    if (maxStack > 1) {
      for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const space = maxStack - s.count;
          const add = Math.min(space, remaining);
          s.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Fill empty slots (Hotbar 0..8 first, then Backpack 9..35)
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(maxStack, remaining);
        const entry = { id, count: add };
        if (def.durability) {
          entry.durability = customDurability ?? def.durability;
          entry.maxDurability = def.durability;
        }
        this.slots[i] = entry;
        remaining -= add;
      }
    }

    return remaining;
  }

  consumeFromSlot(slotIdx, count = 1) {
    const s = this.slots[slotIdx];
    if (!s) return false;
    s.count -= count;
    if (s.count <= 0) {
      this.slots[slotIdx] = null;
    }
    return true;
  }

  consumeItemById(id, count = 1) {
    let needed = count;
    for (let i = 0; i < TOTAL_SLOTS && needed > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, needed);
        s.count -= take;
        needed -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return needed === 0;
  }

  consumeGroup(ids, count = 1) {
    let needed = count;
    for (let i = 0; i < TOTAL_SLOTS && needed > 0; i++) {
      const s = this.slots[i];
      if (s && ids.includes(s.id)) {
        const take = Math.min(s.count, needed);
        s.count -= take;
        needed -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return needed === 0;
  }

  damageActiveTool(amount = 1) {
    const s = this.slots[this.selectedSlot];
    if (!s || s.durability === undefined) return { broke: false };
    s.durability -= amount;
    if (s.durability <= 0) {
      const brokenId = s.id;
      this.slots[this.selectedSlot] = null;
      return { broke: true, id: brokenId };
    }
    return { broke: false };
  }

  hasIngredients(recipe) {
    for (const ing of recipe.ingredients) {
      const have = ing.ids ? this.countGroup(ing.ids) : this.countItem(ing.id);
      if (have < ing.count) return false;
    }
    return true;
  }

  canCraft(recipe, hasTableNearby, isCreative = false) {
    if (isCreative) return true;
    if (recipe.station === 'table' && !hasTableNearby) return false;
    return this.hasIngredients(recipe);
  }

  craft(recipe, hasTableNearby, isCreative = false) {
    if (!this.canCraft(recipe, hasTableNearby, isCreative)) return false;

    if (!isCreative) {
      for (const ing of recipe.ingredients) {
        if (ing.ids) this.consumeGroup(ing.ids, ing.count);
        else this.consumeItemById(ing.id, ing.count);
      }
    }

    const leftover = this.addItem(recipe.result.id, recipe.result.count);
    return { crafted: true, leftover, result: recipe.result };
  }

  findFuelSlot() {
    // Prefer Coal first, then Planks, Logs, Sticks
    const priorityOrder = [
      ITEM.COAL,
      BLOCK.OAK_PLANKS, BLOCK.SPRUCE_PLANKS, BLOCK.BIRCH_PLANKS,
      BLOCK.OAK_LOG, BLOCK.SPRUCE_LOG, BLOCK.BIRCH_LOG,
      ITEM.STICK,
    ];
    for (const fid of priorityOrder) {
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        if (this.slots[i]?.id === fid) return i;
      }
    }
    return -1;
  }

  getTotalFuelPotential() {
    let total = this.furnaceFuelCharges;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const def = getItemDef(s.id);
      if (def.fuelValue > 0) total += def.fuelValue * s.count;
    }
    return total;
  }

  canSmelt(smeltRecipe, hasFurnaceNearby, isCreative = false) {
    if (isCreative) return true;
    if (!hasFurnaceNearby) return false;
    if (this.countItem(smeltRecipe.input) < 1) return false;
    return this.getTotalFuelPotential() >= 1.0;
  }

  smelt(smeltRecipe, hasFurnaceNearby, isCreative = false) {
    if (!this.canSmelt(smeltRecipe, hasFurnaceNearby, isCreative)) return false;

    if (!isCreative) {
      while (this.furnaceFuelCharges < 1.0) {
        const fSlot = this.findFuelSlot();
        if (fSlot === -1) return false;
        const fDef = getItemDef(this.slots[fSlot].id);
        this.furnaceFuelCharges += fDef.fuelValue;
        this.consumeFromSlot(fSlot, 1);
      }
      this.furnaceFuelCharges = Math.round((this.furnaceFuelCharges - 1.0) * 100) / 100;
      this.consumeItemById(smeltRecipe.input, 1);
    }

    const leftover = this.addItem(smeltRecipe.output.id, smeltRecipe.output.count);
    return { smelted: true, leftover, output: smeltRecipe.output };
  }

  quickTransfer(slotIdx) {
    const src = this.slots[slotIdx];
    if (!src) return false;
    const def = getItemDef(src.id);
    const maxStack = def.maxStack || 64;

    const targetStart = slotIdx < HOTBAR_SIZE ? HOTBAR_SIZE : 0;
    const targetEnd = slotIdx < HOTBAR_SIZE ? TOTAL_SLOTS : HOTBAR_SIZE;

    // 1. Merge into matching stacks in target range
    if (maxStack > 1) {
      for (let i = targetStart; i < targetEnd && src.count > 0; i++) {
        const dst = this.slots[i];
        if (dst && dst.id === src.id && dst.count < maxStack) {
          const move = Math.min(maxStack - dst.count, src.count);
          dst.count += move;
          src.count -= move;
        }
      }
    }

    // 2. Place remaining into empty target slot
    if (src.count > 0) {
      for (let i = targetStart; i < targetEnd; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { ...src };
          src.count = 0;
          break;
        }
      }
    }

    if (src.count <= 0) this.slots[slotIdx] = null;
    return true;
  }

  exportState() {
    return {
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      selectedSlot: this.selectedSlot,
      furnaceFuelCharges: this.furnaceFuelCharges,
    };
  }

  importState(data) {
    if (!data) return;
    if (Array.isArray(data.slots)) {
      this.slots = new Array(TOTAL_SLOTS).fill(null);
      for (let i = 0; i < Math.min(TOTAL_SLOTS, data.slots.length); i++) {
        this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
      }
    }
    this.selectedSlot = data.selectedSlot ?? 0;
    this.furnaceFuelCharges = data.furnaceFuelCharges ?? 0;
  }
}
