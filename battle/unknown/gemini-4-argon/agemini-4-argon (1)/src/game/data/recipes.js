import { BLOCK_IDS, ITEM_IDS, isAnyPlank, isAnyLog } from './blocks.js';

export const RECIPE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'basics', label: 'Basics' },
  { id: 'tools', label: 'Tools & Combat' },
  { id: 'utility', label: 'Stations & Light' },
  { id: 'building', label: 'Building' },
  { id: 'food', label: 'Food' },
];

export const INGREDIENT_TAGS = {
  'tag:planks': {
    label: 'Any Planks',
    iconId: BLOCK_IDS.OAK_PLANKS,
    matches: (id) => isAnyPlank(id),
  },
  'tag:coal': {
    label: 'Coal / Charcoal',
    iconId: ITEM_IDS.COAL,
    matches: (id) => id === ITEM_IDS.COAL || id === ITEM_IDS.CHARCOAL,
  },
  'tag:log': {
    label: 'Any Log',
    iconId: BLOCK_IDS.OAK_LOG,
    matches: (id) => isAnyLog(id),
  },
};

export const CRAFTING_RECIPES = [
  // --- BASICS (Hand Craftable) ---
  {
    id: 'oak_planks',
    category: 'basics',
    requiresTable: false,
    output: { id: BLOCK_IDS.OAK_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK_IDS.OAK_LOG, count: 1 }],
  },
  {
    id: 'birch_planks',
    category: 'basics',
    requiresTable: false,
    output: { id: BLOCK_IDS.BIRCH_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK_IDS.BIRCH_LOG, count: 1 }],
  },
  {
    id: 'spruce_planks',
    category: 'basics',
    requiresTable: false,
    output: { id: BLOCK_IDS.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK_IDS.SPRUCE_LOG, count: 1 }],
  },
  {
    id: 'sticks',
    category: 'basics',
    requiresTable: false,
    output: { id: ITEM_IDS.STICK, count: 4 },
    ingredients: [{ tag: 'tag:planks', count: 2 }],
  },
  {
    id: 'crafting_table',
    category: 'utility',
    requiresTable: false,
    output: { id: BLOCK_IDS.CRAFTING_TABLE, count: 1 },
    ingredients: [{ tag: 'tag:planks', count: 4 }],
  },
  {
    id: 'torches',
    category: 'utility',
    requiresTable: false,
    output: { id: BLOCK_IDS.TORCH, count: 4 },
    ingredients: [
      { tag: 'tag:coal', count: 1 },
      { id: ITEM_IDS.STICK, count: 1 },
    ],
  },

  // --- STATIONS & UTILITY (Workbench) ---
  {
    id: 'furnace',
    category: 'utility',
    requiresTable: true,
    output: { id: BLOCK_IDS.FURNACE, count: 1 },
    ingredients: [{ id: BLOCK_IDS.COBBLESTONE, count: 8 }],
  },
  {
    id: 'chest',
    category: 'utility',
    requiresTable: true,
    output: { id: BLOCK_IDS.CHEST, count: 1 },
    ingredients: [{ tag: 'tag:planks', count: 8 }],
  },
  {
    id: 'bed',
    category: 'utility',
    requiresTable: true,
    output: { id: BLOCK_IDS.BED, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.WOOL, count: 3 },
      { tag: 'tag:planks', count: 3 },
    ],
  },
  {
    id: 'ladder',
    category: 'utility',
    requiresTable: true,
    output: { id: BLOCK_IDS.LADDER, count: 4 },
    ingredients: [{ id: ITEM_IDS.STICK, count: 7 }],
  },
  {
    id: 'glowstone',
    category: 'utility',
    requiresTable: true,
    output: { id: BLOCK_IDS.GLOWSTONE, count: 2 },
    ingredients: [
      { id: ITEM_IDS.GOLD_INGOT, count: 2 },
      { id: BLOCK_IDS.TORCH, count: 2 },
    ],
  },

  // --- WOODEN TOOLS ---
  {
    id: 'wood_pickaxe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { tag: 'tag:planks', count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_axe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.WOOD_AXE, count: 1 },
    ingredients: [
      { tag: 'tag:planks', count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_shovel',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { tag: 'tag:planks', count: 1 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.WOOD_SWORD, count: 1 },
    ingredients: [
      { tag: 'tag:planks', count: 2 },
      { id: ITEM_IDS.STICK, count: 1 },
    ],
  },

  // --- STONE TOOLS ---
  {
    id: 'stone_pickaxe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.STONE_PICKAXE, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.COBBLESTONE, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_axe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.STONE_AXE, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.COBBLESTONE, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_shovel',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.STONE_SHOVEL, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.COBBLESTONE, count: 1 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.STONE_SWORD, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.COBBLESTONE, count: 2 },
      { id: ITEM_IDS.STICK, count: 1 },
    ],
  },

  // --- IRON TOOLS ---
  {
    id: 'iron_pickaxe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.IRON_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM_IDS.IRON_INGOT, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_axe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.IRON_AXE, count: 1 },
    ingredients: [
      { id: ITEM_IDS.IRON_INGOT, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_shovel',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.IRON_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM_IDS.IRON_INGOT, count: 1 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_sword',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.IRON_SWORD, count: 1 },
    ingredients: [
      { id: ITEM_IDS.IRON_INGOT, count: 2 },
      { id: ITEM_IDS.STICK, count: 1 },
    ],
  },

  // --- DIAMOND TOOLS ---
  {
    id: 'diamond_pickaxe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM_IDS.DIAMOND, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_axe',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.DIAMOND_AXE, count: 1 },
    ingredients: [
      { id: ITEM_IDS.DIAMOND, count: 3 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_shovel',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.DIAMOND_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM_IDS.DIAMOND, count: 1 },
      { id: ITEM_IDS.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    category: 'tools',
    requiresTable: true,
    output: { id: ITEM_IDS.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { id: ITEM_IDS.DIAMOND, count: 2 },
      { id: ITEM_IDS.STICK, count: 1 },
    ],
  },

  // --- BUILDING ---
  {
    id: 'sandstone',
    category: 'building',
    requiresTable: false,
    output: { id: BLOCK_IDS.SANDSTONE, count: 2 },
    ingredients: [{ id: BLOCK_IDS.SAND, count: 4 }],
  },
  {
    id: 'stone_bricks',
    category: 'building',
    requiresTable: true,
    output: { id: BLOCK_IDS.STONE_BRICKS, count: 4 },
    ingredients: [{ id: BLOCK_IDS.STONE, count: 4 }],
  },
  {
    id: 'clay_bricks',
    category: 'building',
    requiresTable: true,
    output: { id: BLOCK_IDS.BRICKS, count: 2 },
    ingredients: [{ id: ITEM_IDS.BRICK_ITEM, count: 4 }],
  },
  {
    id: 'clay_block',
    category: 'building',
    requiresTable: false,
    output: { id: BLOCK_IDS.CLAY, count: 1 },
    ingredients: [{ id: ITEM_IDS.CLAY_BALL, count: 4 }],
  },
  {
    id: 'snow_block',
    category: 'building',
    requiresTable: false,
    output: { id: BLOCK_IDS.SNOW, count: 2 },
    ingredients: [{ id: BLOCK_IDS.ICE, count: 1 }],
  },
  {
    id: 'wool_weave',
    category: 'building',
    requiresTable: false,
    output: { id: BLOCK_IDS.WOOL, count: 1 },
    ingredients: [{ id: BLOCK_IDS.REEDS, count: 4 }],
  },
  {
    id: 'bookshelf',
    category: 'building',
    requiresTable: true,
    output: { id: BLOCK_IDS.BOOKSHELF, count: 1 },
    ingredients: [
      { tag: 'tag:planks', count: 6 },
      { id: BLOCK_IDS.REEDS, count: 3 },
    ],
  },
  {
    id: 'mossy_cobble',
    category: 'building',
    requiresTable: false,
    output: { id: BLOCK_IDS.MOSSY_COBBLE, count: 1 },
    ingredients: [
      { id: BLOCK_IDS.COBBLESTONE, count: 1 },
      { id: BLOCK_IDS.TALL_GRASS, count: 1 },
    ],
  },

  // --- FOOD ---
  {
    id: 'bread',
    category: 'food',
    requiresTable: true,
    output: { id: ITEM_IDS.BREAD, count: 1 },
    ingredients: [{ id: ITEM_IDS.WHEAT_GRAIN, count: 3 }],
  },
];

export const SMELTING_RECIPES = [
  { inputId: BLOCK_IDS.IRON_ORE, output: { id: ITEM_IDS.IRON_INGOT, count: 1 }, cookTime: 7.0 },
  { inputId: BLOCK_IDS.GOLD_ORE, output: { id: ITEM_IDS.GOLD_INGOT, count: 1 }, cookTime: 8.0 },
  { inputId: BLOCK_IDS.SAND, output: { id: BLOCK_IDS.GLASS, count: 1 }, cookTime: 5.5 },
  { inputId: BLOCK_IDS.COBBLESTONE, output: { id: BLOCK_IDS.STONE, count: 1 }, cookTime: 6.0 },
  { inputId: ITEM_IDS.CLAY_BALL, output: { id: ITEM_IDS.BRICK_ITEM, count: 1 }, cookTime: 5.5 },
  { inputId: ITEM_IDS.RAW_MEAT, output: { id: ITEM_IDS.COOKED_MEAT, count: 1 }, cookTime: 6.0 },
  { inputId: BLOCK_IDS.OAK_LOG, output: { id: ITEM_IDS.CHARCOAL, count: 1 }, cookTime: 6.0 },
  { inputId: BLOCK_IDS.BIRCH_LOG, output: { id: ITEM_IDS.CHARCOAL, count: 1 }, cookTime: 6.0 },
  { inputId: BLOCK_IDS.SPRUCE_LOG, output: { id: ITEM_IDS.CHARCOAL, count: 1 }, cookTime: 6.0 },
];

export function getSmeltingRecipe(inputId) {
  return SMELTING_RECIPES.find((r) => r.inputId === inputId) || null;
}
