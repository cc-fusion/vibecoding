import { blockItemId } from './blocks';
import { ITEMS } from './items';
import {
  BlockId,
  CraftingRecipe,
  FurnaceData,
  InventorySlot,
  ItemId,
  SmeltingRecipe,
} from './types';

export const PLANK_ITEMS: ItemId[] = [
  blockItemId(BlockId.OakPlanks),
  blockItemId(BlockId.BirchPlanks),
  blockItemId(BlockId.SprucePlanks),
];

const OAK_PLANKS = blockItemId(BlockId.OakPlanks);

function isEquivalentPlank(target: ItemId, candidate: ItemId): boolean {
  if (target === candidate) return true;
  if (target === OAK_PLANKS && PLANK_ITEMS.includes(candidate)) return true;
  return false;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Basics (2x2 Hand Craftable)
  {
    id: 'oak_planks',
    name: 'Oak Planks (×4)',
    category: 'basics',
    requiresTable: false,
    ingredients: [{ itemId: blockItemId(BlockId.OakLog), count: 1 }],
    output: { itemId: blockItemId(BlockId.OakPlanks), count: 4 },
    patternHint: ['Log'],
  },
  {
    id: 'birch_planks',
    name: 'Birch Planks (×4)',
    category: 'basics',
    requiresTable: false,
    ingredients: [{ itemId: blockItemId(BlockId.BirchLog), count: 1 }],
    output: { itemId: blockItemId(BlockId.BirchPlanks), count: 4 },
    patternHint: ['Log'],
  },
  {
    id: 'spruce_planks',
    name: 'Spruce Planks (×4)',
    category: 'basics',
    requiresTable: false,
    ingredients: [{ itemId: blockItemId(BlockId.SpruceLog), count: 1 }],
    output: { itemId: blockItemId(BlockId.SprucePlanks), count: 4 },
    patternHint: ['Log'],
  },
  {
    id: 'sticks',
    name: 'Wooden Sticks (×4)',
    category: 'basics',
    requiresTable: false,
    ingredients: [{ itemId: OAK_PLANKS, count: 2 }],
    output: { itemId: 'stick', count: 4 },
    patternHint: ['Plank', 'Plank'],
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    category: 'basics',
    requiresTable: false,
    ingredients: [{ itemId: OAK_PLANKS, count: 4 }],
    output: { itemId: blockItemId(BlockId.CraftingTable), count: 1 },
    patternHint: ['Plank', 'Plank', 'Plank', 'Plank'],
  },
  {
    id: 'torches',
    name: 'Torches (×4)',
    category: 'basics',
    requiresTable: false,
    ingredients: [
      { itemId: 'coal', count: 1 },
      { itemId: 'stick', count: 1 },
    ],
    output: { itemId: blockItemId(BlockId.Torch), count: 4 },
    patternHint: ['Coal', 'Stick'],
  },
  {
    id: 'charcoal_torches',
    name: 'Resin Torches (×2)',
    category: 'basics',
    requiresTable: false,
    ingredients: [
      { itemId: blockItemId(BlockId.SpruceLog), count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: blockItemId(BlockId.Torch), count: 2 },
    patternHint: ['Log', 'Stick'],
  },

  // Utility Stations (Crafting Table 3x3)
  {
    id: 'furnace',
    name: 'Stone Furnace',
    category: 'utility',
    requiresTable: true,
    ingredients: [{ itemId: blockItemId(BlockId.Cobblestone), count: 8 }],
    output: { itemId: blockItemId(BlockId.Furnace), count: 1 },
    patternHint: ['Cobble ×8 Ring'],
  },
  {
    id: 'chest',
    name: 'Storage Crate',
    category: 'utility',
    requiresTable: true,
    ingredients: [{ itemId: OAK_PLANKS, count: 8 }],
    output: { itemId: blockItemId(BlockId.Chest), count: 1 },
    patternHint: ['Plank ×8 Ring'],
  },
  {
    id: 'tnt',
    name: 'TNT Explosive',
    category: 'utility',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Sand), count: 4 },
      { itemId: 'coal', count: 4 },
      { itemId: 'flint', count: 1 },
    ],
    output: { itemId: blockItemId(BlockId.TNT), count: 1 },
    patternHint: ['Coal + Sand + Flint'],
  },
  {
    id: 'glowstone',
    name: 'Sunstone Crystal',
    category: 'utility',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Torch), count: 4 },
      { itemId: 'gold_ingot', count: 1 },
      { itemId: blockItemId(BlockId.Glass), count: 1 },
    ],
    output: { itemId: blockItemId(BlockId.Glowstone), count: 2 },
    patternHint: ['Gold + Glass + Torches'],
  },

  // Wooden Tools
  {
    id: 'wood_pickaxe',
    name: 'Wooden Pickaxe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: OAK_PLANKS, count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'wood_pickaxe', count: 1 },
    patternHint: ['PPP / .S. / .S.'],
  },
  {
    id: 'wood_axe',
    name: 'Wooden Axe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: OAK_PLANKS, count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'wood_axe', count: 1 },
    patternHint: ['PP. / PS. / .S.'],
  },
  {
    id: 'wood_shovel',
    name: 'Wooden Shovel',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: OAK_PLANKS, count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'wood_shovel', count: 1 },
    patternHint: ['.P. / .S. / .S.'],
  },
  {
    id: 'wood_sword',
    name: 'Wooden Sword',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: OAK_PLANKS, count: 2 },
      { itemId: 'stick', count: 1 },
    ],
    output: { itemId: 'wood_sword', count: 1 },
    patternHint: ['.P. / .P. / .S.'],
  },

  // Stone Tools
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Cobblestone), count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'stone_pickaxe', count: 1 },
    patternHint: ['CCC / .S. / .S.'],
  },
  {
    id: 'stone_axe',
    name: 'Stone Axe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Cobblestone), count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'stone_axe', count: 1 },
    patternHint: ['CC. / CS. / .S.'],
  },
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Cobblestone), count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'stone_shovel', count: 1 },
    patternHint: ['.C. / .S. / .S.'],
  },
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: blockItemId(BlockId.Cobblestone), count: 2 },
      { itemId: 'stick', count: 1 },
    ],
    output: { itemId: 'stone_sword', count: 1 },
    patternHint: ['.C. / .C. / .S.'],
  },

  // Iron Tools
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'iron_ingot', count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'iron_pickaxe', count: 1 },
    patternHint: ['III / .S. / .S.'],
  },
  {
    id: 'iron_axe',
    name: 'Iron Axe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'iron_ingot', count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'iron_axe', count: 1 },
    patternHint: ['II. / IS. / .S.'],
  },
  {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'iron_ingot', count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'iron_shovel', count: 1 },
    patternHint: ['.I. / .S. / .S.'],
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'iron_ingot', count: 2 },
      { itemId: 'stick', count: 1 },
    ],
    output: { itemId: 'iron_sword', count: 1 },
    patternHint: ['.I. / .I. / .S.'],
  },
  {
    id: 'gold_pickaxe',
    name: 'Golden Pickaxe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'gold_ingot', count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'gold_pickaxe', count: 1 },
    patternHint: ['GGG / .S. / .S.'],
  },

  // Diamond Tools
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'diamond', count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'diamond_pickaxe', count: 1 },
    patternHint: ['DDD / .S. / .S.'],
  },
  {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'diamond', count: 3 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'diamond_axe', count: 1 },
    patternHint: ['DD. / DS. / .S.'],
  },
  {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'diamond', count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'diamond_shovel', count: 1 },
    patternHint: ['.D. / .S. / .S.'],
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    category: 'tools',
    requiresTable: true,
    ingredients: [
      { itemId: 'diamond', count: 2 },
      { itemId: 'stick', count: 1 },
    ],
    output: { itemId: 'diamond_sword', count: 1 },
    patternHint: ['.D. / .D. / .S.'],
  },

  // Building & Food
  {
    id: 'sandstone',
    name: 'Sandstone (×2)',
    category: 'building',
    requiresTable: false,
    ingredients: [{ itemId: blockItemId(BlockId.Sand), count: 4 }],
    output: { itemId: blockItemId(BlockId.Sandstone), count: 2 },
    patternHint: ['Sand ×4'],
  },
  {
    id: 'bricks_block',
    name: 'Brick Block',
    category: 'building',
    requiresTable: false,
    ingredients: [{ itemId: 'brick_item', count: 4 }],
    output: { itemId: blockItemId(BlockId.Bricks), count: 1 },
    patternHint: ['Brick ×4'],
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf (×2)',
    category: 'building',
    requiresTable: true,
    ingredients: [
      { itemId: OAK_PLANKS, count: 6 },
      { itemId: blockItemId(BlockId.RedFlower), count: 1 },
    ],
    output: { itemId: blockItemId(BlockId.Bookshelf), count: 2 },
    patternHint: ['Planks + Dye'],
  },
  {
    id: 'mossy_cobble',
    name: 'Mossy Cobblestone (×2)',
    category: 'building',
    requiresTable: false,
    ingredients: [
      { itemId: blockItemId(BlockId.Cobblestone), count: 2 },
      { itemId: blockItemId(BlockId.OakLeaves), count: 1 },
    ],
    output: { itemId: blockItemId(BlockId.MossyCobble), count: 2 },
    patternHint: ['Cobble + Leaves'],
  },
];

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  {
    id: 'smelt_iron',
    input: blockItemId(BlockId.IronOre),
    output: 'iron_ingot',
    cookTime: 5.0,
  },
  {
    id: 'smelt_gold',
    input: blockItemId(BlockId.GoldOre),
    output: 'gold_ingot',
    cookTime: 5.5,
  },
  {
    id: 'smelt_glass',
    input: blockItemId(BlockId.Sand),
    output: blockItemId(BlockId.Glass),
    cookTime: 4.0,
  },
  {
    id: 'smelt_stone',
    input: blockItemId(BlockId.Cobblestone),
    output: blockItemId(BlockId.Stone),
    cookTime: 4.0,
  },
  {
    id: 'smelt_brick',
    input: 'clay_ball',
    output: 'brick_item',
    cookTime: 4.0,
  },
  {
    id: 'smelt_meat',
    input: 'raw_meat',
    output: 'cooked_meat',
    cookTime: 4.5,
  },
];

export function countMatchingItems(
  inventory: (InventorySlot | null)[],
  targetItemId: ItemId
): number {
  let total = 0;
  for (const slot of inventory) {
    if (slot && isEquivalentPlank(targetItemId, slot.itemId)) {
      total += slot.count;
    }
  }
  return total;
}

export function canCraftRecipe(
  recipe: CraftingRecipe,
  inventory: (InventorySlot | null)[],
  hasCraftingTable: boolean
): boolean {
  if (recipe.requiresTable && !hasCraftingTable) return false;
  for (const ing of recipe.ingredients) {
    if (countMatchingItems(inventory, ing.itemId) < ing.count) {
      return false;
    }
  }
  return true;
}

export function addItemToInventory(
  inventory: (InventorySlot | null)[],
  itemId: ItemId,
  count: number,
  durability?: number
): number {
  const def = ITEMS[itemId];
  if (!def || count <= 0) return 0;
  let remaining = count;

  // Stack into existing matching slots first
  if (def.maxStack > 1) {
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      const slot = inventory[i];
      if (slot && slot.itemId === itemId && slot.count < def.maxStack) {
        const space = def.maxStack - slot.count;
        const add = Math.min(space, remaining);
        slot.count += add;
        remaining -= add;
      }
    }
  }

  // Fill empty slots next
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    if (inventory[i] === null) {
      const add = Math.min(def.maxStack, remaining);
      inventory[i] = {
        itemId,
        count: add,
        durability: durability ?? def.maxDurability,
      };
      remaining -= add;
    }
  }

  return remaining; // leftover if full
}

export function craftRecipeOnce(
  recipe: CraftingRecipe,
  inventory: (InventorySlot | null)[],
  hasCraftingTable: boolean
): boolean {
  if (!canCraftRecipe(recipe, inventory, hasCraftingTable)) return false;

  // Check if inventory has room for output
  const outDef = ITEMS[recipe.output.itemId];
  let canFit = false;
  for (const slot of inventory) {
    if (slot === null) {
      canFit = true;
      break;
    }
    if (
      slot.itemId === recipe.output.itemId &&
      outDef.maxStack > 1 &&
      slot.count + recipe.output.count <= outDef.maxStack
    ) {
      canFit = true;
      break;
    }
  }
  if (!canFit) return false;

  // Deduct ingredients
  for (const ing of recipe.ingredients) {
    let toRemove = ing.count;
    for (let i = 0; i < inventory.length && toRemove > 0; i++) {
      const slot = inventory[i];
      if (slot && isEquivalentPlank(ing.itemId, slot.itemId)) {
        const take = Math.min(slot.count, toRemove);
        slot.count -= take;
        toRemove -= take;
        if (slot.count <= 0) {
          inventory[i] = null;
        }
      }
    }
  }

  addItemToInventory(inventory, recipe.output.itemId, recipe.output.count);
  return true;
}

export function stepFurnace(furnace: FurnaceData, dt: number): boolean {
  let changed = false;
  const recipe = furnace.input
    ? SMELTING_RECIPES.find((r) => r.input === furnace.input!.itemId)
    : undefined;

  const canOutputFit =
    recipe !== undefined &&
    (furnace.output === null ||
      (furnace.output.itemId === recipe.output &&
        furnace.output.count < ITEMS[recipe.output].maxStack));

  if (furnace.burnRemaining > 0) {
    furnace.burnRemaining = Math.max(0, furnace.burnRemaining - dt);
    changed = true;
  }

  if (furnace.burnRemaining <= 0 && canOutputFit && furnace.fuel) {
    const fuelTime = ITEMS[furnace.fuel.itemId]?.fuelSeconds ?? 0;
    if (fuelTime > 0) {
      furnace.burnRemaining = fuelTime;
      furnace.burnTotal = fuelTime;
      furnace.fuel.count -= 1;
      if (furnace.fuel.count <= 0) furnace.fuel = null;
      changed = true;
    }
  }

  if (furnace.burnRemaining > 0 && canOutputFit && recipe) {
    furnace.cookProgress += dt / recipe.cookTime;
    if (furnace.cookProgress >= 1) {
      furnace.cookProgress = 0;
      furnace.input!.count -= 1;
      if (furnace.input!.count <= 0) furnace.input = null;
      if (furnace.output === null) {
        furnace.output = { itemId: recipe.output, count: 1 };
      } else {
        furnace.output.count += 1;
      }
    }
    changed = true;
  } else if (furnace.cookProgress > 0) {
    furnace.cookProgress = Math.max(0, furnace.cookProgress - dt * 0.5);
    changed = true;
  }

  return changed;
}
