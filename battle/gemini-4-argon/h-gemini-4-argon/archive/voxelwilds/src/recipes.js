import { BLOCK, ITEM } from './blocks.js';
import { PLANK_IDS, LOG_IDS, FUEL_IDS } from './inventory.js';

export const RECIPES = [
  // === Hand Crafting (Available Anywhere) ===
  {
    key: 'oak_planks',
    station: 'hand',
    group: 'basics',
    output: { id: BLOCK.OAK_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.OAK_LOG, count: 1, label: 'Oak Log' }],
  },
  {
    key: 'birch_planks',
    station: 'hand',
    group: 'basics',
    output: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.BIRCH_LOG, count: 1, label: 'Birch Log' }],
  },
  {
    key: 'spruce_planks',
    station: 'hand',
    group: 'basics',
    output: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.SPRUCE_LOG, count: 1, label: 'Spruce Log' }],
  },
  {
    key: 'sticks',
    station: 'hand',
    group: 'basics',
    output: { id: ITEM.STICK, count: 4 },
    ingredients: [{ anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 2, label: 'Wood Planks' }],
  },
  {
    key: 'crafting_table',
    station: 'hand',
    group: 'basics',
    output: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    ingredients: [{ anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 4, label: 'Wood Planks' }],
  },
  {
    key: 'torches',
    station: 'hand',
    group: 'basics',
    output: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { id: ITEM.COAL, count: 1, label: 'Coal' },
      { id: ITEM.STICK, count: 1, label: 'Stick' },
    ],
  },
  {
    key: 'sandstone',
    station: 'hand',
    group: 'building',
    output: { id: BLOCK.SANDSTONE, count: 1 },
    ingredients: [{ id: BLOCK.SAND, count: 4, label: 'Sand' }],
  },
  {
    key: 'snow_block',
    station: 'hand',
    group: 'building',
    output: { id: BLOCK.SNOW_BLOCK, count: 2 },
    ingredients: [{ id: BLOCK.ICE, count: 1, label: 'Packed Ice' }],
  },

  // === Workbench Recipes (Requires Placed Crafting Table Nearby) ===
  {
    key: 'furnace',
    station: 'table',
    group: 'basics',
    output: { id: BLOCK.FURNACE, count: 1 },
    ingredients: [{ id: BLOCK.COBBLESTONE, count: 8, label: 'Cobblestone' }],
  },
  // Wooden Tools
  {
    key: 'wood_pickaxe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 3, label: 'Wood Planks' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'wood_axe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.WOOD_AXE, count: 1 },
    ingredients: [
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 3, label: 'Wood Planks' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'wood_shovel',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 1, label: 'Wood Planks' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'wood_sword',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.WOOD_SWORD, count: 1 },
    ingredients: [
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 2, label: 'Wood Planks' },
      { id: ITEM.STICK, count: 1, label: 'Stick' },
    ],
  },

  // Stone Tools
  {
    key: 'stone_pickaxe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.STONE_PICKAXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3, label: 'Cobblestone' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'stone_axe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.STONE_AXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3, label: 'Cobblestone' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'stone_shovel',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.STONE_SHOVEL, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1, label: 'Cobblestone' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'stone_sword',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.STONE_SWORD, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2, label: 'Cobblestone' },
      { id: ITEM.STICK, count: 1, label: 'Stick' },
    ],
  },

  // Iron Tools
  {
    key: 'iron_pickaxe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.IRON_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3, label: 'Iron Ingots' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'iron_axe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.IRON_AXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3, label: 'Iron Ingots' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'iron_shovel',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.IRON_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1, label: 'Iron Ingot' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'iron_sword',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.IRON_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2, label: 'Iron Ingots' },
      { id: ITEM.STICK, count: 1, label: 'Stick' },
    ],
  },

  // Diamond Tools
  {
    key: 'diamond_pickaxe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3, label: 'Diamonds' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'diamond_axe',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.DIAMOND_AXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3, label: 'Diamonds' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'diamond_shovel',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.DIAMOND_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 1, label: 'Diamond' },
      { id: ITEM.STICK, count: 2, label: 'Sticks' },
    ],
  },
  {
    key: 'diamond_sword',
    station: 'table',
    group: 'tools',
    output: { id: ITEM.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 2, label: 'Diamonds' },
      { id: ITEM.STICK, count: 1, label: 'Stick' },
    ],
  },

  // Building & Decorative Workbench Recipes
  {
    key: 'stone_bricks',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.STONE_BRICKS, count: 4 },
    ingredients: [{ id: BLOCK.STONE, count: 4, label: 'Stone' }],
  },
  {
    key: 'bricks_block',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.BRICKS, count: 1 },
    ingredients: [{ id: ITEM.BRICK_ITEM, count: 4, label: 'Fired Bricks' }],
  },
  {
    key: 'bookshelf',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.BOOKSHELF, count: 1 },
    ingredients: [
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 6, label: 'Wood Planks' },
      { id: BLOCK.WOOL_WHITE, count: 2, label: 'White Wool' },
    ],
  },
  {
    key: 'glowstone_lantern',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.GLOWSTONE, count: 1 },
    ingredients: [
      { id: BLOCK.TORCH, count: 4, label: 'Torches' },
      { id: BLOCK.GLASS, count: 1, label: 'Glass' },
    ],
  },
  {
    key: 'wool_red',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.WOOL_RED, count: 1 },
    ingredients: [
      { id: BLOCK.WOOL_WHITE, count: 1, label: 'White Wool' },
      { id: BLOCK.POPPY, count: 1, label: 'Red Poppy' },
    ],
  },
  {
    key: 'iron_block',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.IRON_BLOCK, count: 1 },
    ingredients: [{ id: ITEM.IRON_INGOT, count: 9, label: 'Iron Ingots' }],
  },
  {
    key: 'gold_block',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.GOLD_BLOCK, count: 1 },
    ingredients: [{ id: ITEM.GOLD_INGOT, count: 9, label: 'Gold Ingots' }],
  },
  {
    key: 'diamond_block',
    station: 'table',
    group: 'building',
    output: { id: BLOCK.DIAMOND_BLOCK, count: 1 },
    ingredients: [{ id: ITEM.DIAMOND, count: 9, label: 'Diamonds' }],
  },

  // === Furnace Smelting Recipes (Requires Placed Stone Furnace Nearby) ===
  {
    key: 'smelt_charcoal',
    station: 'furnace',
    group: 'smelting',
    output: { id: ITEM.COAL, count: 2 },
    ingredients: [
      { anyOf: LOG_IDS, iconId: BLOCK.OAK_LOG, count: 1, label: 'Wood Log' },
      { anyOf: PLANK_IDS, iconId: BLOCK.OAK_PLANKS, count: 1, label: 'Plank Fuel' },
    ],
  },
  {
    key: 'smelt_iron',
    station: 'furnace',
    group: 'smelting',
    output: { id: ITEM.IRON_INGOT, count: 1 },
    ingredients: [
      { id: BLOCK.IRON_ORE, count: 1, label: 'Iron Ore' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
  {
    key: 'smelt_gold',
    station: 'furnace',
    group: 'smelting',
    output: { id: ITEM.GOLD_INGOT, count: 1 },
    ingredients: [
      { id: BLOCK.GOLD_ORE, count: 1, label: 'Gold Ore' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
  {
    key: 'smelt_stone',
    station: 'furnace',
    group: 'smelting',
    output: { id: BLOCK.STONE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1, label: 'Cobblestone' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
  {
    key: 'smelt_glass',
    station: 'furnace',
    group: 'smelting',
    output: { id: BLOCK.GLASS, count: 1 },
    ingredients: [
      { anyOf: [BLOCK.SAND, BLOCK.RED_SAND], iconId: BLOCK.SAND, count: 1, label: 'Sand' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
  {
    key: 'smelt_brick',
    station: 'furnace',
    group: 'smelting',
    output: { id: ITEM.BRICK_ITEM, count: 4 },
    ingredients: [
      { id: BLOCK.CLAY, count: 1, label: 'Clay Block' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
  {
    key: 'smelt_meat',
    station: 'furnace',
    group: 'smelting',
    output: { id: ITEM.COOKED_MEAT, count: 1 },
    ingredients: [
      { id: ITEM.RAW_MEAT, count: 1, label: 'Raw Venison' },
      { anyOf: FUEL_IDS, iconId: ITEM.COAL, count: 1, label: 'Fuel' },
    ],
  },
];
