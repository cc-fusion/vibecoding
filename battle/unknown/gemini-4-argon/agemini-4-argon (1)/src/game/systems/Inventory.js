import { GAME_MODES } from '../constants.js';
import { BLOCK_IDS, ITEM_IDS, getItemDef } from '../data/blocks.js';
import { INGREDIENT_TAGS } from '../data/recipes.js';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36; // 0..8 hotbar, 9..35 backpack

export class Inventory {
  constructor(mode = GAME_MODES.SURVIVAL) {
    this.mode = mode;
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    this.selectedHotbar = 0;
    this.onChange = null;
  }

  notify() {
    if (this.onChange) this.onChange();
  }

  initDefaultForMode(mode) {
    this.mode = mode;
    this.slots.fill(null);
    this.selectedHotbar = 0;

    if (mode === GAME_MODES.CREATIVE) {
      const starter = [
        { id: BLOCK_IDS.OAK_PLANKS, count: 64 },
        { id: BLOCK_IDS.STONE_BRICKS, count: 64 },
        { id: BLOCK_IDS.COBBLESTONE, count: 64 },
        { id: BLOCK_IDS.BRICKS, count: 64 },
        { id: BLOCK_IDS.GLASS, count: 64 },
        { id: BLOCK_IDS.TORCH, count: 64 },
        { id: BLOCK_IDS.GLOWSTONE, count: 64 },
        { id: BLOCK_IDS.BED, count: 1 },
        { id: BLOCK_IDS.OAK_LOG, count: 64 },
      ];
      starter.forEach((s, i) => {
        this.slots[i] = { ...s };
      });
    } else {
      // Friendly survival snack in last hotbar slot while keeping full wood->stone->iron->diamond progression
      this.slots[8] = { id: ITEM_IDS.APPLE, count: 3 };
    }
    this.notify();
  }

  getSelectedSlot() {
    return this.slots[this.selectedHotbar];
  }

  getSelectedDef() {
    const slot = this.getSelectedSlot();
    return slot ? getItemDef(slot.id) : getItemDef(BLOCK_IDS.AIR);
  }

  selectSlot(index) {
    const wrapped = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (wrapped !== this.selectedHotbar) {
      this.selectedHotbar = wrapped;
      this.notify();
      return true;
    }
    return false;
  }

  addItem(id, count = 1, durability = null) {
    if (!id || id === BLOCK_IDS.AIR || count <= 0) return 0;
    const def = getItemDef(id);
    const maxStack = def.maxStack || 64;
    let remaining = count;

    // 1. Merge into existing non-full stacks (hotbar 0..8 first, then 9..35)
    if (maxStack > 1) {
      for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const add = Math.min(remaining, maxStack - s.count);
          s.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, maxStack);
        const item = { id, count: add };
        if (def.maxDurability > 0) {
          item.durability = durability !== null ? durability : def.maxDurability;
        }
        this.slots[i] = item;
        remaining -= add;
      }
    }

    if (remaining !== count) this.notify();
    return remaining;
  }

  consumeSelected(amount = 1) {
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return false;
    if (this.mode === GAME_MODES.CREATIVE && getItemDef(slot.id).isBlock) {
      return true;
    }
    if (slot.count < amount) return false;
    slot.count -= amount;
    if (slot.count <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    this.notify();
    return true;
  }

  damageSelectedTool(amount = 1) {
    if (this.mode === GAME_MODES.CREATIVE) return false;
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return false;
    const def = getItemDef(slot.id);
    if (!def.maxDurability) return false;

    if (typeof slot.durability !== 'number') {
      slot.durability = def.maxDurability;
    }
    slot.durability -= amount;
    if (slot.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
      this.notify();
      return true; // broke
    }
    this.notify();
    return false;
  }

  matchesIngredient(slotId, ing) {
    if (ing.id) return slotId === ing.id;
    if (ing.tag && INGREDIENT_TAGS[ing.tag]) {
      return INGREDIENT_TAGS[ing.tag].matches(slotId);
    }
    return false;
  }

  countMatching(ing) {
    let total = 0;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = this.slots[i];
      if (s && this.matchesIngredient(s.id, ing)) {
        total += s.count;
      }
    }
    return total;
  }

  countById(id) {
    return this.countMatching({ id });
  }

  evaluateRecipe(recipe, hasWorkbench = false) {
    const missingTable = recipe.requiresTable && !hasWorkbench;
    const ingredientStatus = recipe.ingredients.map((ing) => {
      const have = this.countMatching(ing);
      return {
        ...ing,
        have,
        enough: have >= ing.count,
      };
    });
    const hasMaterials = ingredientStatus.every((st) => st.enough);
    return {
      craftable: !missingTable && hasMaterials,
      missingTable,
      hasMaterials,
      ingredientStatus,
    };
  }

  hasRoomFor(id, count) {
    const def = getItemDef(id);
    const maxStack = def.maxStack || 64;
    let space = 0;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = this.slots[i];
      if (!s) space += maxStack;
      else if (s.id === id && maxStack > 1) space += maxStack - s.count;
      if (space >= count) return true;
    }
    return false;
  }

  craft(recipe, hasWorkbench = false, maxRepeat = 1) {
    let craftedTimes = 0;
    const limit = Math.max(1, Math.min(16, maxRepeat));

    for (let rep = 0; rep < limit; rep++) {
      const status = this.evaluateRecipe(recipe, hasWorkbench);
      if (!status.craftable) break;
      if (!this.hasRoomFor(recipe.output.id, recipe.output.count)) break;

      // Consume ingredients
      for (const ing of recipe.ingredients) {
        let need = ing.count;
        for (let i = 0; i < INVENTORY_SIZE && need > 0; i++) {
          const s = this.slots[i];
          if (s && this.matchesIngredient(s.id, ing)) {
            const take = Math.min(need, s.count);
            s.count -= take;
            need -= take;
            if (s.count <= 0) this.slots[i] = null;
          }
        }
      }

      this.addItem(recipe.output.id, recipe.output.count);
      craftedTimes++;
    }

    if (craftedTimes > 0) this.notify();
    return craftedTimes;
  }

  quickMoveSlot(index) {
    const slot = this.slots[index];
    if (!slot) return false;
    const def = getItemDef(slot.id);
    const maxStack = def.maxStack || 64;

    const targetStart = index < HOTBAR_SIZE ? HOTBAR_SIZE : 0;
    const targetEnd = index < HOTBAR_SIZE ? INVENTORY_SIZE : HOTBAR_SIZE;

    // Merge first
    if (maxStack > 1) {
      for (let i = targetStart; i < targetEnd && slot.count > 0; i++) {
        const dst = this.slots[i];
        if (dst && dst.id === slot.id && dst.count < maxStack) {
          const move = Math.min(slot.count, maxStack - dst.count);
          dst.count += move;
          slot.count -= move;
        }
      }
    }

    // Empty slot next
    for (let i = targetStart; i < targetEnd && slot.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...slot };
        slot.count = 0;
        break;
      }
    }

    if (slot.count <= 0) {
      this.slots[index] = null;
    }
    this.notify();
    return true;
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { ...s } : null)),
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.selectedHotbar === 'number') {
      this.selectedHotbar = Math.max(0, Math.min(HOTBAR_SIZE - 1, data.selectedHotbar));
    }
    if (Array.isArray(data.slots)) {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
      }
    }
    this.notify();
  }
}
