// Inventory, Hotbar, Tool Durability & Recipe Crafting System
import { BLOCK, ITEM, RECIPES, getDef } from './items.js';

export const HOTBAR_SIZE = 9;
export const TOTAL_SLOTS = 36;

export class Inventory {
  constructor() {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.selectedSlot = 0;
    this.cursorItem = null; // Held item while inventory modal is open
    this.onChange = null;
  }

  notify() {
    if (typeof this.onChange === 'function') this.onChange();
  }

  makeStack(id, count = 1, durability = null) {
    const def = getDef(id);
    if (!def || id === 0 || count <= 0) return null;
    const stack = {
      id,
      count: Math.min(count, def.maxStack || 64),
    };
    if (def.durability > 0) {
      stack.maxDurability = def.durability;
      stack.durability = durability !== null ? durability : def.durability;
    }
    return stack;
  }

  giveStarterKit(mode) {
    this.slots.fill(null);
    if (mode === 'creative') {
      const creativeBar = [
        BLOCK.OAK_PLANKS,
        BLOCK.STONE_BRICKS,
        BLOCK.BRICKS,
        BLOCK.GLASS,
        BLOCK.OAK_LOG,
        BLOCK.TORCH,
        BLOCK.LANTERN,
        BLOCK.GLOWSTONE,
        ITEM.WATER_BUCKET,
      ];
      creativeBar.forEach((id, idx) => {
        this.slots[idx] = this.makeStack(id, 1);
      });
    } else {
      // Friendly survival starter gear: Wooden Axe, 4 Torches, 3 Crisp Apples so players can start right away or punch trees!
      this.slots[0] = this.makeStack(ITEM.WOOD_AXE, 1);
      this.slots[1] = this.makeStack(BLOCK.TORCH, 4);
      this.slots[2] = this.makeStack(ITEM.APPLE, 3);
    }
    this.selectedSlot = 0;
    this.notify();
  }

  getSelected() {
    return this.slots[this.selectedSlot];
  }

  selectSlot(index) {
    this.selectedSlot = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.notify();
  }

  cycleSlot(delta) {
    this.selectSlot(this.selectedSlot + (delta > 0 ? 1 : -1));
  }

  // Add item(s) to inventory; returns remaining count that did not fit
  addItem(id, count = 1, durability = null) {
    if (!id || count <= 0) return 0;
    const def = getDef(id);
    const maxStack = def.maxStack || 64;
    let remaining = count;

    // 1. Merge into existing non-full stacks if stackable
    if (maxStack > 1 && durability === null) {
      for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const take = Math.min(remaining, maxStack - s.count);
          s.count += take;
          remaining -= take;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(remaining, maxStack);
        this.slots[i] = this.makeStack(id, take, durability);
        remaining -= take;
      }
    }

    this.notify();
    return remaining;
  }

  consumeSelected(amount = 1, isCreative = false) {
    if (isCreative) return true;
    const s = this.slots[this.selectedSlot];
    if (!s || s.count < amount) return false;
    s.count -= amount;
    if (s.count <= 0) this.slots[this.selectedSlot] = null;
    this.notify();
    return true;
  }

  damageSelectedTool(amount = 1, isCreative = false) {
    if (isCreative) return false;
    const s = this.slots[this.selectedSlot];
    if (!s || !s.maxDurability) return false;
    s.durability -= amount;
    let broke = false;
    if (s.durability <= 0) {
      this.slots[this.selectedSlot] = null;
      broke = true;
    }
    this.notify();
    return broke;
  }

  matchesIngredient(slotItem, ing) {
    if (!slotItem) return false;
    if (ing.id !== undefined) return slotItem.id === ing.id;
    if (ing.tag) {
      const def = getDef(slotItem.id);
      return Array.isArray(def.tags) && def.tags.includes(ing.tag);
    }
    return false;
  }

  countMatching(ing) {
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (this.matchesIngredient(s, ing)) total += s.count;
    }
    return total;
  }

  canCraft(recipe, stations = { crafting: false, smelting: false }) {
    if (recipe.station === 'crafting' && !stations.crafting) return false;
    if (recipe.station === 'smelting' && !stations.smelting) return false;
    for (const ing of recipe.ingredients) {
      if (this.countMatching(ing) < ing.count) return false;
    }
    return true;
  }

  craft(recipe, stations = { crafting: false, smelting: false }) {
    if (!this.canCraft(recipe, stations)) return null;

    // Consume ingredients
    for (const ing of recipe.ingredients) {
      let need = ing.count;
      for (let i = 0; i < TOTAL_SLOTS && need > 0; i++) {
        const s = this.slots[i];
        if (this.matchesIngredient(s, ing)) {
          const take = Math.min(need, s.count);
          s.count -= take;
          need -= take;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
    }

    const outId = recipe.output.id;
    const outCount = recipe.output.count;
    const leftover = this.addItem(outId, outCount);
    this.notify();
    return { id: outId, count: outCount, leftover };
  }

  getAvailableRecipes(stations, category = 'all', craftableOnly = false) {
    return RECIPES.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (craftableOnly && !this.canCraft(r, stations)) return false;
      return true;
    });
  }

  // Interactive slot click handling inside Inventory Modal
  handleSlotClick(index, rightClick = false, shiftKey = false) {
    if (index < 0 || index >= TOTAL_SLOTS) return;

    if (shiftKey && !this.cursorItem) {
      const item = this.slots[index];
      if (!item) return;
      const targetRange = index < HOTBAR_SIZE ? [HOTBAR_SIZE, TOTAL_SLOTS] : [0, HOTBAR_SIZE];
      const def = getDef(item.id);
      const maxStack = def.maxStack || 64;

      // Try merge first
      if (maxStack > 1) {
        for (let i = targetRange[0]; i < targetRange[1] && item.count > 0; i++) {
          const dst = this.slots[i];
          if (dst && dst.id === item.id && dst.count < maxStack) {
            const take = Math.min(item.count, maxStack - dst.count);
            dst.count += take;
            item.count -= take;
          }
        }
      }
      // Then empty slot
      for (let i = targetRange[0]; i < targetRange[1] && item.count > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { ...item };
          item.count = 0;
        }
      }
      if (item.count <= 0) this.slots[index] = null;
      this.notify();
      return;
    }

    const slot = this.slots[index];
    const cur = this.cursorItem;

    if (!rightClick) {
      if (!cur && slot) {
        this.cursorItem = slot;
        this.slots[index] = null;
      } else if (cur && !slot) {
        this.slots[index] = cur;
        this.cursorItem = null;
      } else if (cur && slot) {
        const def = getDef(slot.id);
        const maxStack = def.maxStack || 64;
        if (cur.id === slot.id && maxStack > 1 && slot.count < maxStack) {
          const take = Math.min(cur.count, maxStack - slot.count);
          slot.count += take;
          cur.count -= take;
          if (cur.count <= 0) this.cursorItem = null;
        } else {
          this.slots[index] = cur;
          this.cursorItem = slot;
        }
      }
    } else {
      // Right-click: split half or place 1
      if (!cur && slot) {
        const half = Math.ceil(slot.count / 2);
        this.cursorItem = { ...slot, count: half };
        slot.count -= half;
        if (slot.count <= 0) this.slots[index] = null;
      } else if (cur && !slot) {
        this.slots[index] = { ...cur, count: 1 };
        cur.count -= 1;
        if (cur.count <= 0) this.cursorItem = null;
      } else if (cur && slot && cur.id === slot.id) {
        const maxStack = getDef(slot.id).maxStack || 64;
        if (slot.count < maxStack) {
          slot.count += 1;
          cur.count -= 1;
          if (cur.count <= 0) this.cursorItem = null;
        }
      }
    }

    this.notify();
  }

  returnCursorItem() {
    if (!this.cursorItem) return;
    this.addItem(this.cursorItem.id, this.cursorItem.count, this.cursorItem.durability ?? null);
    this.cursorItem = null;
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
      this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
    }
    this.notify();
  }
}
