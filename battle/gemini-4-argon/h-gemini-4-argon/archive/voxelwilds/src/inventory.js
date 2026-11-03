import { BLOCK, ITEM, getBlockDef } from './blocks.js';
import { GAME_MODES } from './constants.js';

export const HOTBAR_SIZE = 9;
export const TOTAL_SLOTS = 36;

export const PLANK_IDS = [BLOCK.OAK_PLANKS, BLOCK.BIRCH_PLANKS, BLOCK.SPRUCE_PLANKS];
export const LOG_IDS = [BLOCK.OAK_LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG];
export const FUEL_IDS = [ITEM.COAL, ...PLANK_IDS, ...LOG_IDS, ITEM.STICK];

export class Inventory {
  constructor(mode = GAME_MODES.SURVIVAL) {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.selectedHotbar = 0;
    this.mode = mode;
    this.onChange = null;
    this.initDefaults(mode);
  }

  initDefaults(mode) {
    this.slots.fill(null);
    this.mode = mode;
    if (mode === GAME_MODES.CREATIVE) {
      const creativeHotbar = [
        BLOCK.GRASS,
        BLOCK.OAK_PLANKS,
        BLOCK.STONE_BRICKS,
        BLOCK.COBBLESTONE,
        BLOCK.OAK_LOG,
        BLOCK.GLASS,
        BLOCK.BRICKS,
        BLOCK.TORCH,
        BLOCK.GLOWSTONE,
      ];
      creativeHotbar.forEach((id, idx) => {
        this.slots[idx] = { id, count: 64, durability: null };
      });
    } else {
      // Friendly survival start: slots 1-7 empty for natural gathering, plus apples & torches
      this.slots[7] = { id: ITEM.APPLE, count: 3, durability: null };
      this.slots[8] = { id: BLOCK.TORCH, count: 4, durability: null };
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === GAME_MODES.CREATIVE) {
      const isEmpty = this.slots.slice(0, HOTBAR_SIZE).every((s) => !s);
      if (isEmpty) this.initDefaults(GAME_MODES.CREATIVE);
    }
  }

  getSelectedSlot() {
    return this.slots[this.selectedHotbar];
  }

  selectHotbar(index) {
    const next = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (next !== this.selectedHotbar) {
      this.selectedHotbar = next;
      this.onChange?.();
    }
  }

  stepHotbar(delta) {
    this.selectHotbar(this.selectedHotbar + (delta > 0 ? 1 : -1));
  }

  addItem(id, count = 1, durability = null) {
    if (!id || count <= 0) return 0;
    const def = getBlockDef(id);
    const maxStack = def.maxStack || 64;
    let remaining = count;

    // 1. Merge into matching non-full stacks (hotbar first, then backpack)
    if (maxStack > 1) {
      for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack) {
          const add = Math.min(remaining, maxStack - s.count);
          s.count += add;
          remaining -= add;
        }
      }
    }

    // 2. Place into empty slots
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, maxStack);
        this.slots[i] = {
          id,
          count: add,
          durability: durability ?? (def.maxDurability || null),
        };
        remaining -= add;
      }
    }

    return remaining;
  }

  consumeSelected(amount = 1) {
    if (this.mode === GAME_MODES.CREATIVE) return true;
    const slot = this.slots[this.selectedHotbar];
    if (!slot || slot.count < amount) return false;
    slot.count -= amount;
    if (slot.count <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    return true;
  }

  damageSelectedTool(amount = 1) {
    if (this.mode === GAME_MODES.CREATIVE) return 'ok';
    const slot = this.slots[this.selectedHotbar];
    if (!slot) return 'none';
    const def = getBlockDef(slot.id);
    if (!def.maxDurability) return 'none';

    if (typeof slot.durability !== 'number') {
      slot.durability = def.maxDurability;
    }
    slot.durability -= amount;
    if (slot.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
      return 'broke';
    }
    return 'ok';
  }

  countItem(id) {
    let total = 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (s && s.id === id) total += s.count;
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

  hasIngredient(ing) {
    if (ing.anyOf) {
      return this.countGroup(ing.anyOf) >= ing.count;
    }
    return this.countItem(ing.id) >= ing.count;
  }

  canCraft(recipe) {
    if (this.mode === GAME_MODES.CREATIVE) return true;
    return recipe.ingredients.every((ing) => this.hasIngredient(ing));
  }

  consumeIngredient(ing) {
    if (this.mode === GAME_MODES.CREATIVE) return true;
    let remaining = ing.count;
    const matchIds = ing.anyOf ? ing.anyOf : [ing.id];

    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && matchIds.includes(s.id)) {
        const take = Math.min(remaining, s.count);
        s.count -= take;
        remaining -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return remaining === 0;
  }

  craftRecipe(recipe) {
    if (!this.canCraft(recipe)) return false;
    // Verify output fits
    const outDef = getBlockDef(recipe.output.id);
    const hasSpace =
      this.slots.some((s) => !s) ||
      (outDef.maxStack > 1 &&
        this.slots.some((s) => s && s.id === recipe.output.id && s.count + recipe.output.count <= outDef.maxStack));
    if (!hasSpace && this.mode !== GAME_MODES.CREATIVE) {
      // Still might free a slot during consumption, check carefully
    }

    for (const ing of recipe.ingredients) {
      this.consumeIngredient(ing);
    }
    this.addItem(recipe.output.id, recipe.output.count);
    return true;
  }

  swapOrMerge(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= TOTAL_SLOTS || toIdx >= TOTAL_SLOTS) return;
    const a = this.slots[fromIdx];
    const b = this.slots[toIdx];
    if (!a) return;

    if (!b) {
      this.slots[toIdx] = a;
      this.slots[fromIdx] = null;
      return;
    }

    const def = getBlockDef(a.id);
    const maxStack = def.maxStack || 64;
    if (a.id === b.id && maxStack > 1 && b.count < maxStack) {
      const move = Math.min(a.count, maxStack - b.count);
      b.count += move;
      a.count -= move;
      if (a.count <= 0) this.slots[fromIdx] = null;
    } else {
      this.slots[toIdx] = a;
      this.slots[fromIdx] = b;
    }
  }

  quickTransfer(idx) {
    const slot = this.slots[idx];
    if (!slot) return;
    const def = getBlockDef(slot.id);
    const maxStack = def.maxStack || 64;

    const targetStart = idx < HOTBAR_SIZE ? HOTBAR_SIZE : 0;
    const targetEnd = idx < HOTBAR_SIZE ? TOTAL_SLOTS : HOTBAR_SIZE;

    if (maxStack > 1) {
      for (let i = targetStart; i < targetEnd && slot.count > 0; i++) {
        const dst = this.slots[i];
        if (dst && dst.id === slot.id && dst.count < maxStack) {
          const add = Math.min(slot.count, maxStack - dst.count);
          dst.count += add;
          slot.count -= add;
        }
      }
    }

    for (let i = targetStart; i < targetEnd && slot.count > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...slot };
        slot.count = 0;
        break;
      }
    }

    if (slot.count <= 0) {
      this.slots[idx] = null;
    }
  }

  serialize() {
    return {
      selectedHotbar: this.selectedHotbar,
      slots: this.slots.map((s) => (s ? { id: s.id, count: s.count, durability: s.durability } : null)),
    };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    this.selectedHotbar = typeof data.selectedHotbar === 'number' ? data.selectedHotbar : 0;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = data.slots[i];
      this.slots[i] = s && s.id ? { id: s.id, count: s.count || 1, durability: s.durability ?? null } : null;
    }
  }
}
