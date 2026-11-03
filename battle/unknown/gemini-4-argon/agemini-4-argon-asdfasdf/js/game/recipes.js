// Complete Crafting & Smelting Progression Recipes for TerraCraft

import { BLOCK } from './blocks.js';

export const INGREDIENT_LABELS = {
  'tag:planks': 'Any Planks',
  'tag:logs': 'Any Wood Log',
  'tag:coal': 'Coal / Charcoal',
  'tag:fuel': 'Fuel (Coal / Wood)',
};

export const CRAFTING_RECIPES = [
  // Basics & Wood Processing
  {
    id: 'oak_planks',
    category: 'basics',
    output: `block:${BLOCK.OAK_PLANKS}`,
    count: 4,
    ingredients: [{ id: `block:${BLOCK.OAK_LOG}`, count: 1 }],
  },
  {
    id: 'birch_planks',
    category: 'basics',
    output: `block:${BLOCK.BIRCH_PLANKS}`,
    count: 4,
    ingredients: [{ id: `block:${BLOCK.BIRCH_LOG}`, count: 1 }],
  },
  {
    id: 'spruce_planks',
    category: 'basics',
    output: `block:${BLOCK.SPRUCE_PLANKS}`,
    count: 4,
    ingredients: [{ id: `block:${BLOCK.SPRUCE_LOG}`, count: 1 }],
  },
  {
    id: 'sticks',
    category: 'basics',
    output: 'item:stick',
    count: 4,
    ingredients: [{ id: 'tag:planks', count: 2 }],
  },
  {
    id: 'crafting_table',
    category: 'basics',
    output: `block:${BLOCK.CRAFTING_TABLE}`,
    count: 1,
    ingredients: [{ id: 'tag:planks', count: 4 }],
  },
  {
    id: 'furnace',
    category: 'basics',
    output: `block:${BLOCK.FURNACE}`,
    count: 1,
    ingredients: [{ id: `block:${BLOCK.COBBLESTONE}`, count: 8 }],
  },
  {
    id: 'torches',
    category: 'basics',
    output: `block:${BLOCK.TORCH}`,
    count: 4,
    ingredients: [
      { id: 'tag:coal', count: 1 },
      { id: 'item:stick', count: 1 },
    ],
  },
  {
    id: 'chest',
    category: 'basics',
    output: `block:${BLOCK.CHEST}`,
    count: 1,
    ingredients: [{ id: 'tag:planks', count: 8 }],
  },

  // Tools & Combat (Wood -> Stone -> Iron -> Diamond)
  {
    id: 'wood_pickaxe',
    category: 'tools',
    output: 'tool:wood_pickaxe',
    count: 1,
    ingredients: [
      { id: 'tag:planks', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'wood_axe',
    category: 'tools',
    output: 'tool:wood_axe',
    count: 1,
    ingredients: [
      { id: 'tag:planks', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'wood_shovel',
    category: 'tools',
    output: 'tool:wood_shovel',
    count: 1,
    ingredients: [
      { id: 'tag:planks', count: 1 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    category: 'tools',
    output: 'tool:wood_sword',
    count: 1,
    ingredients: [
      { id: 'tag:planks', count: 2 },
      { id: 'item:stick', count: 1 },
    ],
  },
  {
    id: 'stone_pickaxe',
    category: 'tools',
    output: 'tool:stone_pickaxe',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.COBBLESTONE}`, count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'stone_axe',
    category: 'tools',
    output: 'tool:stone_axe',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.COBBLESTONE}`, count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'stone_shovel',
    category: 'tools',
    output: 'tool:stone_shovel',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.COBBLESTONE}`, count: 1 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    category: 'tools',
    output: 'tool:stone_sword',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.COBBLESTONE}`, count: 2 },
      { id: 'item:stick', count: 1 },
    ],
  },
  {
    id: 'iron_pickaxe',
    category: 'tools',
    output: 'tool:iron_pickaxe',
    count: 1,
    ingredients: [
      { id: 'item:iron_ingot', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'iron_axe',
    category: 'tools',
    output: 'tool:iron_axe',
    count: 1,
    ingredients: [
      { id: 'item:iron_ingot', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'iron_shovel',
    category: 'tools',
    output: 'tool:iron_shovel',
    count: 1,
    ingredients: [
      { id: 'item:iron_ingot', count: 1 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'iron_sword',
    category: 'tools',
    output: 'tool:iron_sword',
    count: 1,
    ingredients: [
      { id: 'item:iron_ingot', count: 2 },
      { id: 'item:stick', count: 1 },
    ],
  },
  {
    id: 'bucket',
    category: 'tools',
    output: 'item:bucket',
    count: 1,
    ingredients: [{ id: 'item:iron_ingot', count: 3 }],
  },
  {
    id: 'diamond_pickaxe',
    category: 'tools',
    output: 'tool:diamond_pickaxe',
    count: 1,
    ingredients: [
      { id: 'item:diamond', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'diamond_axe',
    category: 'tools',
    output: 'tool:diamond_axe',
    count: 1,
    ingredients: [
      { id: 'item:diamond', count: 3 },
      { id: 'item:stick', count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    category: 'tools',
    output: 'tool:diamond_sword',
    count: 1,
    ingredients: [
      { id: 'item:diamond', count: 2 },
      { id: 'item:stick', count: 1 },
    ],
  },

  // Building & Decor
  {
    id: 'stone_bricks',
    category: 'building',
    output: `block:${BLOCK.STONE_BRICKS}`,
    count: 4,
    ingredients: [{ id: `block:${BLOCK.COBBLESTONE}`, count: 4 }],
  },
  {
    id: 'sandstone',
    category: 'building',
    output: `block:${BLOCK.SANDSTONE}`,
    count: 2,
    ingredients: [{ id: `block:${BLOCK.SAND}`, count: 4 }],
  },
  {
    id: 'bricks_block',
    category: 'building',
    output: `block:${BLOCK.BRICKS}`,
    count: 1,
    ingredients: [{ id: 'item:brick', count: 4 }],
  },
  {
    id: 'lantern',
    category: 'building',
    output: `block:${BLOCK.LANTERN}`,
    count: 2,
    ingredients: [
      { id: 'item:iron_ingot', count: 2 },
      { id: `block:${BLOCK.TORCH}`, count: 1 },
    ],
  },
  {
    id: 'bookshelf',
    category: 'building',
    output: `block:${BLOCK.BOOKSHELF}`,
    count: 1,
    ingredients: [
      { id: 'tag:planks', count: 6 },
      { id: `block:${BLOCK.SUGAR_CANE}`, count: 3 },
    ],
  },
  {
    id: 'wool_red',
    category: 'building',
    output: `block:${BLOCK.WOOL_RED}`,
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.WOOL_WHITE}`, count: 1 },
      { id: `block:${BLOCK.POPPY}`, count: 1 },
    ],
  },
  {
    id: 'snow_block',
    category: 'building',
    output: `block:${BLOCK.SNOW_BLOCK}`,
    count: 1,
    ingredients: [{ id: 'item:snowball', count: 4 }],
  },

  // Food
  {
    id: 'bread',
    category: 'food',
    output: 'item:bread',
    count: 1,
    ingredients: [{ id: 'item:wheat', count: 3 }],
  },
  {
    id: 'mushroom_stew',
    category: 'food',
    output: 'item:mushroom_stew',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.RED_MUSHROOM}`, count: 2 },
      { id: 'tag:planks', count: 1 },
    ],
  },
];

// Smelting recipes (Furnace / Kiln)
export const SMELTING_RECIPES = [
  {
    id: 'smelt_iron',
    category: 'smelting',
    output: 'item:iron_ingot',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.IRON_ORE}`, count: 1 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
  {
    id: 'smelt_gold',
    category: 'smelting',
    output: 'item:gold_ingot',
    count: 1,
    ingredients: [
      { id: `block:${BLOCK.GOLD_ORE}`, count: 1 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
  {
    id: 'smelt_glass',
    category: 'smelting',
    output: `block:${BLOCK.GLASS}`,
    count: 2,
    ingredients: [
      { id: `block:${BLOCK.SAND}`, count: 2 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
  {
    id: 'smelt_charcoal',
    category: 'smelting',
    output: 'item:charcoal',
    count: 2,
    ingredients: [
      { id: 'tag:logs', count: 1 },
      { id: 'tag:planks', count: 1 },
    ],
  },
  {
    id: 'smelt_bricks',
    category: 'smelting',
    output: 'item:brick',
    count: 4,
    ingredients: [
      { id: `block:${BLOCK.CLAY}`, count: 1 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
  {
    id: 'smelt_stone',
    category: 'smelting',
    output: `block:${BLOCK.STONE}`,
    count: 2,
    ingredients: [
      { id: `block:${BLOCK.COBBLESTONE}`, count: 2 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
  {
    id: 'smelt_steak',
    category: 'smelting',
    output: 'item:cooked_meat',
    count: 1,
    ingredients: [
      { id: 'item:raw_meat', count: 1 },
      { id: 'tag:fuel', count: 1 },
    ],
  },
];

export function canCraftRecipe(inventory, recipe) {
  return recipe.ingredients.every((req) => inventory.countMatching(req.id) >= req.count);
}

export function craftRecipeOnce(inventory, recipe) {
  if (!canCraftRecipe(inventory, recipe)) return false;
  for (const req of recipe.ingredients) {
    inventory.consumeMatching(req.id, req.count);
  }
  const leftover = inventory.addItem(recipe.output, recipe.count);
  inventory.totalCrafted.add(recipe.output);
  inventory.emitChange();
  return leftover < recipe.count;
}
