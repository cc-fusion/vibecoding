import { BLOCK, ITEM } from '../blocks.js';

export const RECIPE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'basics', label: 'Basics' },
  { id: 'tools', label: 'Tools & Gear' },
  { id: 'building', label: 'Building' },
  { id: 'smelting', label: 'Smelting' },
];

export const RECIPES = [
  // --- BASICS (Hand craftable anywhere) ---
  {
    id: 'oak_planks',
    category: 'basics',
    station: 'hand',
    output: { id: BLOCK.OAK_PLANKS, count: 4 },
    ingredients: [{ item: BLOCK.OAK_LOG, count: 1 }],
  },
  {
    id: 'birch_planks',
    category: 'basics',
    station: 'hand',
    output: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    ingredients: [{ item: BLOCK.BIRCH_LOG, count: 1 }],
  },
  {
    id: 'spruce_planks',
    category: 'basics',
    station: 'hand',
    output: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ item: BLOCK.SPRUCE_LOG, count: 1 }],
  },
  {
    id: 'sticks',
    category: 'basics',
    station: 'hand',
    output: { id: ITEM.STICK, count: 4 },
    ingredients: [{ item: 'ANY_PLANKS', count: 2 }],
  },
  {
    id: 'crafting_table',
    category: 'basics',
    station: 'hand',
    output: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    ingredients: [{ item: 'ANY_PLANKS', count: 4 }],
  },
  {
    id: 'torches',
    category: 'basics',
    station: 'hand',
    output: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { item: ITEM.COAL, count: 1 },
      { item: ITEM.STICK, count: 1 },
    ],
  },

  // --- WORKBENCH: STATIONS & TOOLS ---
  {
    id: 'furnace',
    category: 'basics',
    station: 'workbench',
    output: { id: BLOCK.FURNACE, count: 1 },
    ingredients: [{ item: BLOCK.COBBLESTONE, count: 8 }],
  },
  {
    id: 'wood_pickaxe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { item: 'ANY_PLANKS', count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_axe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.WOOD_AXE, count: 1 },
    ingredients: [
      { item: 'ANY_PLANKS', count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_shovel',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { item: 'ANY_PLANKS', count: 1 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.WOOD_SWORD, count: 1 },
    ingredients: [
      { item: 'ANY_PLANKS', count: 2 },
      { item: ITEM.STICK, count: 1 },
    ],
  },

  // Stone Tier
  {
    id: 'stone_pickaxe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.STONE_PICKAXE, count: 1 },
    ingredients: [
      { item: BLOCK.COBBLESTONE, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_axe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.STONE_AXE, count: 1 },
    ingredients: [
      { item: BLOCK.COBBLESTONE, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_shovel',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.STONE_SHOVEL, count: 1 },
    ingredients: [
      { item: BLOCK.COBBLESTONE, count: 1 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.STONE_SWORD, count: 1 },
    ingredients: [
      { item: BLOCK.COBBLESTONE, count: 2 },
      { item: ITEM.STICK, count: 1 },
    ],
  },

  // Iron Tier
  {
    id: 'iron_pickaxe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.IRON_PICKAXE, count: 1 },
    ingredients: [
      { item: ITEM.IRON_INGOT, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_axe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.IRON_AXE, count: 1 },
    ingredients: [
      { item: ITEM.IRON_INGOT, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_shovel',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.IRON_SHOVEL, count: 1 },
    ingredients: [
      { item: ITEM.IRON_INGOT, count: 1 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_sword',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.IRON_SWORD, count: 1 },
    ingredients: [
      { item: ITEM.IRON_INGOT, count: 2 },
      { item: ITEM.STICK, count: 1 },
    ],
  },

  // Diamond Tier
  {
    id: 'diamond_pickaxe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { item: ITEM.DIAMOND, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_axe',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.DIAMOND_AXE, count: 1 },
    ingredients: [
      { item: ITEM.DIAMOND, count: 3 },
      { item: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    category: 'tools',
    station: 'workbench',
    output: { id: ITEM.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { item: ITEM.DIAMOND, count: 2 },
      { item: ITEM.STICK, count: 1 },
    ],
  },

  // --- BUILDING & DECOR ---
  {
    id: 'sandstone',
    category: 'building',
    station: 'hand',
    output: { id: BLOCK.SANDSTONE, count: 2 },
    ingredients: [{ item: BLOCK.SAND, count: 4 }],
  },
  {
    id: 'snow_block',
    category: 'building',
    station: 'hand',
    output: { id: BLOCK.ICE, count: 2 },
    ingredients: [{ item: BLOCK.SNOW, count: 4 }],
  },
  {
    id: 'glowstone_lantern',
    category: 'building',
    station: 'workbench',
    output: { id: BLOCK.GLOWSTONE, count: 2 },
    ingredients: [
      { item: BLOCK.TORCH, count: 4 },
      { item: BLOCK.COBBLESTONE, count: 2 },
    ],
  },
  {
    id: 'crate',
    category: 'building',
    station: 'workbench',
    output: { id: BLOCK.CRATE, count: 2 },
    ingredients: [{ item: 'ANY_PLANKS', count: 6 }],
  },
  {
    id: 'bookshelf',
    category: 'building',
    station: 'workbench',
    output: { id: BLOCK.BOOKSHELF, count: 2 },
    ingredients: [
      { item: 'ANY_PLANKS', count: 6 },
      { item: ITEM.STICK, count: 2 },
    ],
  },

  // --- FURNACE SMELTING ---
  {
    id: 'smelt_charcoal',
    category: 'smelting',
    station: 'furnace',
    output: { id: ITEM.COAL, count: 2 },
    ingredients: [
      { item: 'ANY_LOG', count: 1 },
      { item: 'ANY_PLANKS', count: 1 },
    ],
  },
  {
    id: 'smelt_iron',
    category: 'smelting',
    station: 'furnace',
    output: { id: ITEM.IRON_INGOT, count: 1 },
    ingredients: [
      { item: BLOCK.IRON_ORE, count: 1 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
  {
    id: 'smelt_gold',
    category: 'smelting',
    station: 'furnace',
    output: { id: ITEM.GOLD_INGOT, count: 1 },
    ingredients: [
      { item: BLOCK.GOLD_ORE, count: 1 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
  {
    id: 'smelt_glass',
    category: 'smelting',
    station: 'furnace',
    output: { id: BLOCK.GLASS, count: 2 },
    ingredients: [
      { item: BLOCK.SAND, count: 2 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
  {
    id: 'smelt_bricks',
    category: 'smelting',
    station: 'furnace',
    output: { id: BLOCK.BRICKS, count: 2 },
    ingredients: [
      { item: BLOCK.CLAY, count: 2 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
  {
    id: 'smelt_stone',
    category: 'smelting',
    station: 'furnace',
    output: { id: BLOCK.STONE, count: 2 },
    ingredients: [
      { item: BLOCK.COBBLESTONE, count: 2 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
  {
    id: 'cook_meat',
    category: 'smelting',
    station: 'furnace',
    output: { id: ITEM.COOKED_MEAT, count: 1 },
    ingredients: [
      { item: ITEM.RAW_MEAT, count: 1 },
      { item: 'ANY_FUEL', count: 1 },
    ],
  },
];

export function canUseRecipeStation(recipe, stationsNearby) {
  if (recipe.station === 'hand') return true;
  if (recipe.station === 'workbench') return Boolean(stationsNearby.workbench);
  if (recipe.station === 'furnace') return Boolean(stationsNearby.furnace);
  return false;
}
