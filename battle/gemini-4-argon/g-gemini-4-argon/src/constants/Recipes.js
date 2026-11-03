import { BLOCK, ITEM, ANY_PLANKS, ANY_LOGS } from './Blocks.js';

export const ANY_FUEL = [ITEM.COAL, BLOCK.OAK_LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG, BLOCK.OAK_PLANKS, BLOCK.BIRCH_PLANKS, BLOCK.SPRUCE_PLANKS];

// Each ingredient can specify either `{ id, count }` or `{ anyOf: [...ids], label, count }`
export const RECIPES = [
  // ================= BASICS (Available Anywhere) =================
  {
    id: 'oak_planks',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.OAK_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.OAK_LOG, count: 1 }],
    desc: 'Sturdy timber planks from oak logs',
  },
  {
    id: 'birch_planks',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.BIRCH_LOG, count: 1 }],
    desc: 'Pale timber planks from birch logs',
  },
  {
    id: 'spruce_planks',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.SPRUCE_LOG, count: 1 }],
    desc: 'Dark timber planks from spruce logs',
  },
  {
    id: 'sticks',
    category: 'Basics',
    station: 'hand',
    output: { id: ITEM.STICK, count: 4 },
    ingredients: [{ anyOf: ANY_PLANKS, label: 'Any Planks', count: 2 }],
    desc: 'Handles for tools, weapons, and torches',
  },
  {
    id: 'crafting_table',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    ingredients: [{ anyOf: ANY_PLANKS, label: 'Any Planks', count: 4 }],
    desc: 'Place & right-click to unlock tools, furnace & advanced blocks',
  },
  {
    id: 'torches_coal',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { id: ITEM.COAL, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Bright warm light for caves and nightfall',
  },
  {
    id: 'torches_glow',
    category: 'Basics',
    station: 'hand',
    output: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { id: ITEM.GLOW_DUST, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Craft torches from luminescent cave crystal dust',
  },

  // ================= TOOLS & WEAPONS (Requires Crafting Table) =================
  {
    id: 'wood_pickaxe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Mine stone and coal ore rapidly',
  },
  {
    id: 'wood_axe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.WOOD_AXE, count: 1 },
    ingredients: [
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Chop trees and timber quickly',
  },
  {
    id: 'wood_shovel',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Dig dirt, grass, sand, and snow',
  },
  {
    id: 'wood_sword',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.WOOD_SWORD, count: 1 },
    ingredients: [
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Basic melee blade for fending off night mobs',
  },

  // Stone Tools
  {
    id: 'stone_pickaxe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.STONE_PICKAXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Sturdy pickaxe for iron ore & deep caverns',
  },
  {
    id: 'stone_axe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.STONE_AXE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Fast stone-headed logging axe',
  },
  {
    id: 'stone_shovel',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.STONE_SHOVEL, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Durable stone excavation shovel',
  },
  {
    id: 'stone_sword',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.STONE_SWORD, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Sharp stone broadsword',
  },

  // Iron Tools
  {
    id: 'iron_pickaxe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.IRON_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'High-speed pickaxe for gold and diamond veins',
  },
  {
    id: 'iron_axe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.IRON_AXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Heavy forged felling axe',
  },
  {
    id: 'iron_shovel',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.IRON_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Forged iron spade',
  },
  {
    id: 'iron_sword',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.IRON_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Tempered steel longsword',
  },

  // Gold & Diamond Tools
  {
    id: 'gold_pickaxe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.GOLD_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.GOLD_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Blazingly fast mining speed, lighter durability',
  },
  {
    id: 'diamond_pickaxe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Masterwork crystalline pickaxe with 800 durability',
  },
  {
    id: 'diamond_axe',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.DIAMOND_AXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Masterwork diamond axe',
  },
  {
    id: 'diamond_shovel',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.DIAMOND_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
    desc: 'Masterwork diamond shovel',
  },
  {
    id: 'diamond_sword',
    category: 'Tools',
    station: 'table',
    output: { id: ITEM.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
    desc: 'Legendary diamond blade (9 attack damage)',
  },

  // ================= BUILDING & UTILITY =================
  {
    id: 'furnace',
    category: 'Utility',
    station: 'table',
    output: { id: BLOCK.FURNACE, count: 1 },
    ingredients: [{ id: BLOCK.COBBLESTONE, count: 8 }],
    desc: 'Place & right-click to smelt iron, gold, glass, charcoal & steak',
  },
  {
    id: 'chest',
    category: 'Utility',
    station: 'table',
    output: { id: BLOCK.CHEST, count: 1 },
    ingredients: [{ anyOf: ANY_PLANKS, label: 'Any Planks', count: 8 }],
    desc: 'Decorative reinforced timber chest',
  },
  {
    id: 'lantern',
    category: 'Utility',
    station: 'table',
    output: { id: BLOCK.LANTERN, count: 2 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: BLOCK.TORCH, count: 1 },
    ],
    desc: 'Radiant iron-framed lantern',
  },
  {
    id: 'tnt',
    category: 'Utility',
    station: 'table',
    output: { id: BLOCK.TNT, count: 1 },
    ingredients: [
      { id: BLOCK.SAND, count: 4 },
      { id: ITEM.COAL, count: 2 },
    ],
    desc: 'Explosive charge — place and right-click to ignite fuse!',
  },
  {
    id: 'sandstone',
    category: 'Building',
    station: 'hand',
    output: { id: BLOCK.SANDSTONE, count: 2 },
    ingredients: [{ id: BLOCK.SAND, count: 4 }],
    desc: 'Carved desert sandstone masonry',
  },
  {
    id: 'stone_bricks',
    category: 'Building',
    station: 'table',
    output: { id: BLOCK.STONE_BRICKS, count: 4 },
    ingredients: [{ anyOf: [BLOCK.STONE, BLOCK.COBBLESTONE], label: 'Stone / Cobble', count: 4 }],
    desc: 'Chiseled fortress stone bricks',
  },
  {
    id: 'bricks',
    category: 'Building',
    station: 'table',
    output: { id: BLOCK.BRICKS, count: 4 },
    ingredients: [
      { id: BLOCK.GRAVEL, count: 3 },
      { id: BLOCK.DIRT, count: 1 },
    ],
    desc: 'Kiln-style red masonry bricks',
  },
  {
    id: 'bookshelf',
    category: 'Building',
    station: 'table',
    output: { id: BLOCK.BOOKSHELF, count: 2 },
    ingredients: [
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 6 },
      { id: BLOCK.WOOL, count: 1 },
    ],
    desc: 'Cozy study bookshelf lined with colorful tomes',
  },
  {
    id: 'mossy_cobble',
    category: 'Building',
    station: 'hand',
    output: { id: BLOCK.MOSSY_COBBLESTONE, count: 1 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 1 },
      { anyOf: [BLOCK.OAK_LEAVES, BLOCK.BIRCH_LEAVES, BLOCK.SPRUCE_LEAVES], label: 'Leaves', count: 1 },
    ],
    desc: 'Vine-draped ancient cobblestone',
  },
  {
    id: 'bread_bake',
    category: 'Utility',
    station: 'hand',
    output: { id: ITEM.BREAD, count: 2 },
    ingredients: [
      { id: ITEM.APPLE, count: 1 },
      { anyOf: [BLOCK.YELLOW_FLOWER, BLOCK.RED_FLOWER], label: 'Wildflower', count: 2 },
    ],
    desc: 'Hearty field rations restoring hunger & health',
  },

  // ================= FURNACE SMELTING (Requires Furnace) =================
  {
    id: 'smelt_iron',
    category: 'Smelting',
    station: 'furnace',
    output: { id: ITEM.IRON_INGOT, count: 1 },
    ingredients: [
      { id: BLOCK.IRON_ORE, count: 1 },
      { anyOf: ANY_FUEL, label: 'Coal or Wood', count: 1 },
    ],
    desc: 'Smelt raw iron ore into forged iron ingot',
  },
  {
    id: 'smelt_gold',
    category: 'Smelting',
    station: 'furnace',
    output: { id: ITEM.GOLD_INGOT, count: 1 },
    ingredients: [
      { id: BLOCK.GOLD_ORE, count: 1 },
      { anyOf: ANY_FUEL, label: 'Coal or Wood', count: 1 },
    ],
    desc: 'Smelt raw gold ore into gleaming gold ingot',
  },
  {
    id: 'smelt_charcoal',
    category: 'Smelting',
    station: 'furnace',
    output: { id: ITEM.COAL, count: 2 },
    ingredients: [
      { anyOf: ANY_LOGS, label: 'Any Log', count: 1 },
      { anyOf: ANY_PLANKS, label: 'Any Planks', count: 1 },
    ],
    desc: 'Burn timber logs into charcoal for torches & fuel',
  },
  {
    id: 'smelt_glass',
    category: 'Smelting',
    station: 'furnace',
    output: { id: BLOCK.GLASS, count: 2 },
    ingredients: [
      { id: BLOCK.SAND, count: 2 },
      { anyOf: ANY_FUEL, label: 'Coal or Wood', count: 1 },
    ],
    desc: 'Fuse desert sand into clear framed window glass',
  },
  {
    id: 'smelt_stone',
    category: 'Smelting',
    station: 'furnace',
    output: { id: BLOCK.STONE, count: 2 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2 },
      { anyOf: ANY_FUEL, label: 'Coal or Wood', count: 1 },
    ],
    desc: 'Refire cobblestone into smooth natural stone',
  },
  {
    id: 'smelt_steak',
    category: 'Smelting',
    station: 'furnace',
    output: { id: ITEM.COOKED_STEAK, count: 1 },
    ingredients: [
      { id: ITEM.RAW_MEAT, count: 1 },
      { anyOf: ANY_FUEL, label: 'Coal or Wood', count: 1 },
    ],
    desc: 'Roast raw meat into nourishing steak (+8 hunger)',
  },
];
