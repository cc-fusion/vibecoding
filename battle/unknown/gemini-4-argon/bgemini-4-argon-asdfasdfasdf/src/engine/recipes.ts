import { BLOCK, isPlanks, ITEM, ITEMS } from './blocks';
import { InventorySlot, MAX_STACK } from './constants';

export interface IngredientReq {
  id: number; // use -1 for "Any Wood Planks"
  label?: string;
  count: number;
}

export const ANY_PLANKS = -1;

export interface CraftingRecipe {
  id: string;
  outputId: number;
  outputCount: number;
  category: 'basics' | 'tools' | 'building' | 'functional';
  ingredients: IngredientReq[];
}

export interface SmeltRecipe {
  id: string;
  inputId: number;
  outputId: number;
  outputCount: number;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Basics
  {
    id: 'oak_planks',
    outputId: BLOCK.OAK_PLANKS,
    outputCount: 4,
    category: 'basics',
    ingredients: [{ id: BLOCK.OAK_LOG, count: 1 }],
  },
  {
    id: 'birch_planks',
    outputId: BLOCK.BIRCH_PLANKS,
    outputCount: 4,
    category: 'basics',
    ingredients: [{ id: BLOCK.BIRCH_LOG, count: 1 }],
  },
  {
    id: 'pine_planks',
    outputId: BLOCK.PINE_PLANKS,
    outputCount: 4,
    category: 'basics',
    ingredients: [{ id: BLOCK.PINE_LOG, count: 1 }],
  },
  {
    id: 'sticks',
    outputId: ITEM.STICK,
    outputCount: 4,
    category: 'basics',
    ingredients: [{ id: ANY_PLANKS, label: 'Any Planks', count: 2 }],
  },
  {
    id: 'crafting_table',
    outputId: BLOCK.CRAFTING_TABLE,
    outputCount: 1,
    category: 'functional',
    ingredients: [{ id: ANY_PLANKS, label: 'Any Planks', count: 4 }],
  },
  {
    id: 'furnace',
    outputId: BLOCK.FURNACE,
    outputCount: 1,
    category: 'functional',
    ingredients: [{ id: BLOCK.COBBLESTONE, count: 8 }],
  },
  {
    id: 'torches_coal',
    outputId: BLOCK.TORCH,
    outputCount: 4,
    category: 'functional',
    ingredients: [
      { id: ITEM.COAL, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
  },
  {
    id: 'torches_resin',
    outputId: BLOCK.TORCH,
    outputCount: 2,
    category: 'functional',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },

  // Tools & Weapons — Wood
  {
    id: 'wood_pickaxe',
    outputId: ITEM.WOOD_PICKAXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_axe',
    outputId: ITEM.WOOD_AXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_shovel',
    outputId: ITEM.WOOD_SHOVEL,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    outputId: ITEM.WOOD_SWORD,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // Tools & Weapons — Stone
  {
    id: 'stone_pickaxe',
    outputId: ITEM.STONE_PICKAXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_axe',
    outputId: ITEM.STONE_AXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_shovel',
    outputId: ITEM.STONE_SHOVEL,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    outputId: ITEM.STONE_SWORD,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // Tools & Weapons — Iron
  {
    id: 'iron_pickaxe',
    outputId: ITEM.IRON_PICKAXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_axe',
    outputId: ITEM.IRON_AXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_shovel',
    outputId: ITEM.IRON_SHOVEL,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_sword',
    outputId: ITEM.IRON_SWORD,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // Tools & Weapons — Diamond
  {
    id: 'diamond_pickaxe',
    outputId: ITEM.DIAMOND_PICKAXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_axe',
    outputId: ITEM.DIAMOND_AXE,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    outputId: ITEM.DIAMOND_SWORD,
    outputCount: 1,
    category: 'tools',
    ingredients: [
      { id: ITEM.DIAMOND, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // Building & Functional Blocks
  {
    id: 'stone_bricks',
    outputId: BLOCK.STONE_BRICKS,
    outputCount: 4,
    category: 'building',
    ingredients: [{ id: BLOCK.STONE, count: 4 }],
  },
  {
    id: 'stone_bricks_cobble',
    outputId: BLOCK.STONE_BRICKS,
    outputCount: 4,
    category: 'building',
    ingredients: [{ id: BLOCK.COBBLESTONE, count: 4 }],
  },
  {
    id: 'sandstone',
    outputId: BLOCK.SANDSTONE,
    outputCount: 2,
    category: 'building',
    ingredients: [{ id: BLOCK.SAND, count: 4 }],
  },
  {
    id: 'bricks_block',
    outputId: BLOCK.BRICKS,
    outputCount: 2,
    category: 'building',
    ingredients: [{ id: ITEM.BRICK_ITEM, count: 4 }],
  },
  {
    id: 'bookshelf',
    outputId: BLOCK.BOOKSHELF,
    outputCount: 1,
    category: 'building',
    ingredients: [
      { id: ANY_PLANKS, label: 'Any Planks', count: 4 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'glowstone_lantern',
    outputId: BLOCK.GLOWSTONE,
    outputCount: 2,
    category: 'functional',
    ingredients: [
      { id: BLOCK.TORCH, count: 4 },
      { id: BLOCK.GLASS, count: 1 },
    ],
  },
  {
    id: 'tnt_charge',
    outputId: BLOCK.TNT,
    outputCount: 2,
    category: 'functional',
    ingredients: [
      { id: BLOCK.SAND, count: 4 },
      { id: ITEM.COAL, count: 3 },
    ],
  },
];

export const SMELT_RECIPES: SmeltRecipe[] = [
  { id: 'smelt_iron', inputId: BLOCK.IRON_ORE, outputId: ITEM.IRON_INGOT, outputCount: 1 },
  { id: 'smelt_gold', inputId: BLOCK.GOLD_ORE, outputId: ITEM.GOLD_INGOT, outputCount: 1 },
  { id: 'smelt_glass', inputId: BLOCK.SAND, outputId: BLOCK.GLASS, outputCount: 1 },
  { id: 'smelt_brick', inputId: BLOCK.CLAY, outputId: ITEM.BRICK_ITEM, outputCount: 2 },
  { id: 'smelt_stone', inputId: BLOCK.COBBLESTONE, outputId: BLOCK.STONE, outputCount: 1 },
  { id: 'smelt_steak', inputId: ITEM.RAW_MEAT, outputId: ITEM.COOKED_MEAT, outputCount: 1 },
  { id: 'smelt_charcoal', inputId: BLOCK.OAK_LOG, outputId: ITEM.COAL, outputCount: 1 },
];

export function countIngredientInInventory(inv: (InventorySlot | null)[], reqId: number): number {
  let total = 0;
  for (const slot of inv) {
    if (!slot) continue;
    if (reqId === ANY_PLANKS) {
      if (isPlanks(slot.id)) total += slot.count;
    } else if (slot.id === reqId) {
      total += slot.count;
    }
  }
  return total;
}

export function canCraftRecipe(inv: (InventorySlot | null)[], recipe: CraftingRecipe): boolean {
  for (const req of recipe.ingredients) {
    if (countIngredientInInventory(inv, req.id) < req.count) return false;
  }
  return true;
}

export function addItemToInventory(
  inv: (InventorySlot | null)[],
  itemId: number,
  count: number
): boolean {
  const def = ITEMS[itemId];
  if (!def || count <= 0) return false;

  let remaining = count;

  if (def.stackable) {
    for (let i = 0; i < inv.length && remaining > 0; i++) {
      const slot = inv[i];
      if (slot && slot.id === itemId && slot.count < MAX_STACK) {
        const space = MAX_STACK - slot.count;
        const add = Math.min(space, remaining);
        slot.count += add;
        remaining -= add;
      }
    }
  }

  for (let i = 0; i < inv.length && remaining > 0; i++) {
    if (inv[i] === null) {
      if (def.stackable) {
        const add = Math.min(MAX_STACK, remaining);
        inv[i] = { id: itemId, count: add };
        remaining -= add;
      } else {
        inv[i] = {
          id: itemId,
          count: 1,
          durability: def.maxDurability,
        };
        remaining -= 1;
      }
    }
  }

  return remaining < count;
}

export function consumeIngredient(inv: (InventorySlot | null)[], reqId: number, count: number): void {
  let rem = count;
  for (let i = 0; i < inv.length && rem > 0; i++) {
    const slot = inv[i];
    if (!slot) continue;
    const matches = reqId === ANY_PLANKS ? isPlanks(slot.id) : slot.id === reqId;
    if (matches) {
      const take = Math.min(slot.count, rem);
      slot.count -= take;
      rem -= take;
      if (slot.count <= 0) inv[i] = null;
    }
  }
}

export function findFuelSlotIndex(inv: (InventorySlot | null)[]): number {
  // Prefer Coal first, then Sticks/Planks/Logs
  const priority = (id: number) =>
    id === ITEM.COAL ? 3 : id === ITEM.STICK ? 2 : ITEMS[id]?.fuelValue ? 1 : 0;

  let bestIdx = -1;
  let bestPrio = 0;
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i];
    if (!s) continue;
    const p = priority(s.id);
    if (p > bestPrio) {
      bestPrio = p;
      bestIdx = i;
    }
  }
  return bestIdx;
}
