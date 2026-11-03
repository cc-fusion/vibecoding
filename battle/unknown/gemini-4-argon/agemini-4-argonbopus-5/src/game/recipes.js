import { BLOCK, ITEM } from './blocks.js';

export const ANY_PLANKS = [BLOCK.OAK_PLANKS, BLOCK.SPRUCE_PLANKS, BLOCK.BIRCH_PLANKS];
export const ANY_LOGS = [BLOCK.OAK_LOG, BLOCK.SPRUCE_LOG, BLOCK.BIRCH_LOG];

/**
 * Each ingredient entry has:
 *  - id: number OR ids: number[] (matching any item in group, e.g., ANY_PLANKS)
 *  - label?: friendly name when group is used
 *  - count: quantity needed
 */
export const CRAFTING_RECIPES = [
  // --- BASICS (Hand-Craftable Anywhere) ---
  {
    id: 'oak_planks',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.OAK_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.OAK_LOG, count: 1 }],
    desc: 'Sturdy timber boards cut from oak logs.',
  },
  {
    id: 'spruce_planks',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.SPRUCE_LOG, count: 1 }],
    desc: 'Rich dark boards cut from boreal spruce.',
  },
  {
    id: 'birch_planks',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.BIRCH_LOG, count: 1 }],
    desc: 'Pale golden boards cut from birch logs.',
  },
  {
    id: 'sticks',
    category: 'basics',
    station: 'hand',
    result: { id: ITEM.STICK, count: 4 },
    ingredients: [{ ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 2 }],
    desc: 'Essential handles for tools, weapons, and torches.',
  },
  {
    id: 'crafting_table',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    ingredients: [{ ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 4 }],
    desc: 'Place in the world to unlock tools, weapons, and advanced blocks.',
  },
  {
    id: 'torches_coal',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { id: ITEM.COAL, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Warm light source (Light 14) for caves and nightfall.',
  },
  {
    id: 'torches_crystal',
    category: 'basics',
    station: 'hand',
    result: { id: BLOCK.TORCH, count: 6 },
    ingredients: [
      { id: ITEM.CRYSTAL_SHARD, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Craft bright torches from luminescent cave shards.',
  },

  // --- TOOLS & WEAPONS (Requires Crafting Table) ---
  {
    id: 'wood_pickaxe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Mines Stone and Coal Ore.',
  },
  {
    id: 'wood_axe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.WOOD_AXE, count: 1 },
    ingredients: [
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Chops logs and wooden structures swiftly.',
  },
  {
    id: 'wood_shovel',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Excavates dirt, sand, snow, and river clay.',
  },
  {
    id: 'wood_sword',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.WOOD_SWORD, count: 1 },
    ingredients: [
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Basic blade (4 Attack) for hunting and defense.',
  },

  // Stone Tier
  {
    id: 'stone_pickaxe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.STONE_PICKAXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Mines Iron Ore and Luminescent Crystals.',
  },
  {
    id: 'stone_axe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.STONE_AXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Durable stone hatchet for timber.',
  },
  {
    id: 'stone_shovel',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.STONE_SHOVEL, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Fast stone spade for earthmoving.',
  },
  {
    id: 'stone_sword',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.STONE_SWORD, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Sturdy stone blade (6 Attack).',
  },

  // Iron Tier
  {
    id: 'iron_pickaxe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.IRON_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Mines Gold and deep Diamond Ore!',
  },
  {
    id: 'iron_axe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.IRON_AXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Heavy forged axe for rapid forestry.',
  },
  {
    id: 'iron_shovel',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.IRON_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Forged iron shovel.',
  },
  {
    id: 'iron_sword',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.IRON_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Sharp forged longsword (8 Attack).',
  },

  // Diamond Tier
  {
    id: 'diamond_pickaxe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Masterwork pickaxe with peak speed and durability.',
  },
  {
    id: 'diamond_axe',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.DIAMOND_AXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Masterwork diamond axe.',
  },
  {
    id: 'diamond_sword',
    category: 'tools',
    station: 'table',
    result: { id: ITEM.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Legendary crystalline blade (11 Attack).',
  },

  // --- BUILDING & UTILITY ---
  {
    id: 'furnace',
    category: 'building',
    station: 'table',
    result: { id: BLOCK.FURNACE, count: 1 },
    ingredients: [{ id: BLOCK.COBBLESTONE, count: 8 }],
    desc: 'Place in world to smelt ores, glass, bricks, and roast food.',
  },
  {
    id: 'cozy_bed',
    category: 'building',
    station: 'table',
    result: { id: BLOCK.BED, count: 1 },
    ingredients: [
      { id: BLOCK.WOOL_BLOCK, count: 3 },
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 3 },
    ],
    desc: 'Place and interact at dusk/night to sleep until sunrise and set respawn.',
  },
  {
    id: 'lantern',
    category: 'building',
    station: 'table',
    result: { id: BLOCK.LANTERN, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2 },
      { id: BLOCK.TORCH, count: 1 },
    ],
    desc: 'Radiant iron lamp (Light 15).',
  },
  {
    id: 'stone_bricks',
    category: 'building',
    station: 'hand',
    result: { id: BLOCK.STONE_BRICKS, count: 4 },
    ingredients: [{ id: BLOCK.STONE, count: 4 }],
    desc: 'Dressed architectural masonry.',
  },
  {
    id: 'clay_bricks',
    category: 'building',
    station: 'hand',
    result: { id: BLOCK.BRICKS, count: 1 },
    ingredients: [{ id: ITEM.BRICK_ITEM, count: 4 }],
    desc: 'Classic fired red clay brickwork.',
  },
  {
    id: 'sandstone',
    category: 'building',
    station: 'hand',
    result: { id: BLOCK.SANDSTONE, count: 1 },
    ingredients: [{ id: BLOCK.SAND, count: 4 }],
    desc: 'Compacted desert sandstone block.',
  },
  {
    id: 'bookshelf',
    category: 'building',
    station: 'table',
    result: { id: BLOCK.BOOKSHELF, count: 1 },
    ingredients: [
      { ids: ANY_PLANKS, label: 'Any Planks', iconId: BLOCK.OAK_PLANKS, count: 6 },
      { id: ITEM.STICK, count: 3 },
    ],
    desc: 'Warm library shelving for cozy interiors.',
  },
];

export const SMELTING_RECIPES = [
  {
    id: 'smelt_iron',
    input: ITEM.RAW_IRON,
    output: { id: ITEM.IRON_INGOT, count: 1 },
    desc: 'Smelts Raw Iron Ore into forged Iron Ingot.',
  },
  {
    id: 'smelt_gold',
    input: ITEM.RAW_GOLD,
    output: { id: ITEM.GOLD_INGOT, count: 1 },
    desc: 'Refines Raw Gold Ore into gleaming Gold Ingot.',
  },
  {
    id: 'smelt_glass',
    input: BLOCK.SAND,
    output: { id: BLOCK.GLASS, count: 1 },
    desc: 'Fuses desert or coastal Sand into Clear Glass.',
  },
  {
    id: 'smelt_stone',
    input: BLOCK.COBBLESTONE,
    output: { id: BLOCK.STONE, count: 1 },
    desc: 'Fires Cobblestone back into smooth Stone.',
  },
  {
    id: 'smelt_brick',
    input: ITEM.CLAY_BALL,
    output: { id: ITEM.BRICK_ITEM, count: 1 },
    desc: 'Bakes River Clay into Fired Bricks.',
  },
  {
    id: 'cook_meat',
    input: ITEM.RAW_MEAT,
    output: { id: ITEM.COOKED_MEAT, count: 1 },
    desc: 'Roasts meat for high nourishment and healing.',
  },
];

export const MILESTONES = [
  {
    id: 'timber',
    title: 'First Timber',
    hint: 'Harvest a tree log by holding Left-Click',
    check: (inv) => inv.hasAny(ANY_LOGS) || inv.hasAny(ANY_PLANKS),
  },
  {
    id: 'workbench',
    title: 'Craftsman',
    hint: 'Press E to craft Planks & a Crafting Table',
    check: (inv, stats) => inv.countItem(BLOCK.CRAFTING_TABLE) > 0 || stats.placedTable,
  },
  {
    id: 'wood_pick',
    title: 'Ready to Mine',
    hint: 'Place your Crafting Table (Right-Click) and craft a Wooden Pickaxe',
    check: (inv) => inv.countItem(ITEM.WOOD_PICKAXE) > 0 || inv.countItem(ITEM.STONE_PICKAXE) > 0,
  },
  {
    id: 'stone_age',
    title: 'Stone Age',
    hint: 'Mine Stone for Cobblestone and upgrade to a Stone Pickaxe',
    check: (inv) => inv.countItem(ITEM.STONE_PICKAXE) > 0 || inv.countItem(ITEM.IRON_PICKAXE) > 0,
  },
  {
    id: 'light_dark',
    title: 'Light the Dark',
    hint: 'Mine Coal Ore and craft Torches for caves & nightfall',
    check: (inv) => inv.countItem(BLOCK.TORCH) > 0 || inv.countItem(BLOCK.LANTERN) > 0,
  },
  {
    id: 'iron_age',
    title: 'Iron Smelter',
    hint: 'Build a Stone Furnace and smelt Raw Iron into Iron Ingots',
    check: (inv) => inv.countItem(ITEM.IRON_INGOT) > 0 || inv.countItem(ITEM.IRON_PICKAXE) > 0,
  },
  {
    id: 'diamond_delver',
    title: 'Deep Delver',
    hint: 'Explore deep caves (Y < 18) with an Iron Pickaxe to unearth Diamonds!',
    check: (inv) => inv.countItem(ITEM.DIAMOND) > 0 || inv.countItem(ITEM.DIAMOND_PICKAXE) > 0,
  },
];
