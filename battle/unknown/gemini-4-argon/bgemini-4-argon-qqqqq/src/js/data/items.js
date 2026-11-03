import { TOOL_TIERS, TOOL_TYPES } from '../constants.js';
import { BLOCK, BLOCKS } from './blocks.js';

export const ITEM = {
  STICK: 101,
  COAL: 102,
  RAW_IRON: 103,
  IRON_INGOT: 104,
  RAW_GOLD: 105,
  GOLD_INGOT: 106,
  DIAMOND: 107,
  FLINT: 108,
  CLAY_BALL: 109,
  BRICK_ITEM: 110,

  WOOD_PICKAXE: 111,
  WOOD_AXE: 112,
  WOOD_SHOVEL: 113,
  WOOD_SWORD: 114,

  STONE_PICKAXE: 115,
  STONE_AXE: 116,
  STONE_SHOVEL: 117,
  STONE_SWORD: 118,

  IRON_PICKAXE: 119,
  IRON_AXE: 120,
  IRON_SHOVEL: 121,
  IRON_SWORD: 122,

  DIAMOND_PICKAXE: 123,
  DIAMOND_AXE: 124,
  DIAMOND_SHOVEL: 125,
  DIAMOND_SWORD: 126,

  FLINT_AND_STEEL: 127,
  BUCKET: 128,
  WATER_BUCKET: 129,

  APPLE: 130,
  RAW_PORK: 131,
  COOKED_PORK: 132,
  RAW_MUTTON: 133,
  COOKED_MUTTON: 134,
  RAW_CHICKEN: 135,
  COOKED_CHICKEN: 136,
};

const rawItems = [
  // Materials
  { id: ITEM.STICK, name: 'Stick', category: 'materials', icon: 'stick', fuelTime: 5 },
  { id: ITEM.COAL, name: 'Coal', category: 'materials', icon: 'coal', fuelTime: 65 },
  { id: ITEM.RAW_IRON, name: 'Raw Iron', category: 'materials', icon: 'raw_iron' },
  { id: ITEM.IRON_INGOT, name: 'Iron Ingot', category: 'materials', icon: 'iron_ingot' },
  { id: ITEM.RAW_GOLD, name: 'Raw Gold', category: 'materials', icon: 'raw_gold' },
  { id: ITEM.GOLD_INGOT, name: 'Gold Ingot', category: 'materials', icon: 'gold_ingot' },
  { id: ITEM.DIAMOND, name: 'Diamond', category: 'materials', icon: 'diamond' },
  { id: ITEM.FLINT, name: 'Flint', category: 'materials', icon: 'flint' },
  { id: ITEM.CLAY_BALL, name: 'Clay Ball', category: 'materials', icon: 'clay_ball' },
  { id: ITEM.BRICK_ITEM, name: 'Clay Brick', category: 'materials', icon: 'brick_item' },

  // Wood Tools
  {
    id: ITEM.WOOD_PICKAXE,
    name: 'Wooden Pickaxe',
    category: 'tools',
    icon: 'wood_pickaxe',
    stackSize: 1,
    toolType: TOOL_TYPES.PICKAXE,
    toolTier: TOOL_TIERS.WOOD,
    miningSpeed: 2.3,
    attackDamage: 3,
    maxDurability: 60,
    fuelTime: 10,
  },
  {
    id: ITEM.WOOD_AXE,
    name: 'Wooden Axe',
    category: 'tools',
    icon: 'wood_axe',
    stackSize: 1,
    toolType: TOOL_TYPES.AXE,
    toolTier: TOOL_TIERS.WOOD,
    miningSpeed: 2.3,
    attackDamage: 4,
    maxDurability: 60,
    fuelTime: 10,
  },
  {
    id: ITEM.WOOD_SHOVEL,
    name: 'Wooden Shovel',
    category: 'tools',
    icon: 'wood_shovel',
    stackSize: 1,
    toolType: TOOL_TYPES.SHOVEL,
    toolTier: TOOL_TIERS.WOOD,
    miningSpeed: 2.3,
    attackDamage: 2,
    maxDurability: 60,
    fuelTime: 10,
  },
  {
    id: ITEM.WOOD_SWORD,
    name: 'Wooden Sword',
    category: 'tools',
    icon: 'wood_sword',
    stackSize: 1,
    toolType: TOOL_TYPES.SWORD,
    toolTier: TOOL_TIERS.WOOD,
    miningSpeed: 1.5,
    attackDamage: 5,
    maxDurability: 60,
    fuelTime: 10,
  },

  // Stone Tools
  {
    id: ITEM.STONE_PICKAXE,
    name: 'Stone Pickaxe',
    category: 'tools',
    icon: 'stone_pickaxe',
    stackSize: 1,
    toolType: TOOL_TYPES.PICKAXE,
    toolTier: TOOL_TIERS.STONE,
    miningSpeed: 4.0,
    attackDamage: 4,
    maxDurability: 132,
  },
  {
    id: ITEM.STONE_AXE,
    name: 'Stone Axe',
    category: 'tools',
    icon: 'stone_axe',
    stackSize: 1,
    toolType: TOOL_TYPES.AXE,
    toolTier: TOOL_TIERS.STONE,
    miningSpeed: 4.0,
    attackDamage: 5,
    maxDurability: 132,
  },
  {
    id: ITEM.STONE_SHOVEL,
    name: 'Stone Shovel',
    category: 'tools',
    icon: 'stone_shovel',
    stackSize: 1,
    toolType: TOOL_TYPES.SHOVEL,
    toolTier: TOOL_TIERS.STONE,
    miningSpeed: 4.0,
    attackDamage: 3,
    maxDurability: 132,
  },
  {
    id: ITEM.STONE_SWORD,
    name: 'Stone Sword',
    category: 'tools',
    icon: 'stone_sword',
    stackSize: 1,
    toolType: TOOL_TYPES.SWORD,
    toolTier: TOOL_TIERS.STONE,
    miningSpeed: 1.5,
    attackDamage: 6,
    maxDurability: 132,
  },

  // Iron Tools
  {
    id: ITEM.IRON_PICKAXE,
    name: 'Iron Pickaxe',
    category: 'tools',
    icon: 'iron_pickaxe',
    stackSize: 1,
    toolType: TOOL_TYPES.PICKAXE,
    toolTier: TOOL_TIERS.IRON,
    miningSpeed: 6.2,
    attackDamage: 5,
    maxDurability: 250,
  },
  {
    id: ITEM.IRON_AXE,
    name: 'Iron Axe',
    category: 'tools',
    icon: 'iron_axe',
    stackSize: 1,
    toolType: TOOL_TYPES.AXE,
    toolTier: TOOL_TIERS.IRON,
    miningSpeed: 6.2,
    attackDamage: 6,
    maxDurability: 250,
  },
  {
    id: ITEM.IRON_SHOVEL,
    name: 'Iron Shovel',
    category: 'tools',
    icon: 'iron_shovel',
    stackSize: 1,
    toolType: TOOL_TYPES.SHOVEL,
    toolTier: TOOL_TIERS.IRON,
    miningSpeed: 6.2,
    attackDamage: 4,
    maxDurability: 250,
  },
  {
    id: ITEM.IRON_SWORD,
    name: 'Iron Sword',
    category: 'tools',
    icon: 'iron_sword',
    stackSize: 1,
    toolType: TOOL_TYPES.SWORD,
    toolTier: TOOL_TIERS.IRON,
    miningSpeed: 1.5,
    attackDamage: 7,
    maxDurability: 250,
  },

  // Diamond Tools
  {
    id: ITEM.DIAMOND_PICKAXE,
    name: 'Diamond Pickaxe',
    category: 'tools',
    icon: 'diamond_pickaxe',
    stackSize: 1,
    toolType: TOOL_TYPES.PICKAXE,
    toolTier: TOOL_TIERS.DIAMOND,
    miningSpeed: 9.0,
    attackDamage: 6,
    maxDurability: 800,
  },
  {
    id: ITEM.DIAMOND_AXE,
    name: 'Diamond Axe',
    category: 'tools',
    icon: 'diamond_axe',
    stackSize: 1,
    toolType: TOOL_TYPES.AXE,
    toolTier: TOOL_TIERS.DIAMOND,
    miningSpeed: 9.0,
    attackDamage: 8,
    maxDurability: 800,
  },
  {
    id: ITEM.DIAMOND_SHOVEL,
    name: 'Diamond Shovel',
    category: 'tools',
    icon: 'diamond_shovel',
    stackSize: 1,
    toolType: TOOL_TYPES.SHOVEL,
    toolTier: TOOL_TIERS.DIAMOND,
    miningSpeed: 9.0,
    attackDamage: 5,
    maxDurability: 800,
  },
  {
    id: ITEM.DIAMOND_SWORD,
    name: 'Diamond Sword',
    category: 'tools',
    icon: 'diamond_sword',
    stackSize: 1,
    toolType: TOOL_TYPES.SWORD,
    toolTier: TOOL_TIERS.DIAMOND,
    miningSpeed: 1.5,
    attackDamage: 9,
    maxDurability: 800,
  },

  // Utility Tools
  {
    id: ITEM.FLINT_AND_STEEL,
    name: 'Flint & Steel',
    category: 'tools',
    icon: 'flint_and_steel',
    stackSize: 1,
    maxDurability: 64,
  },
  {
    id: ITEM.BUCKET,
    name: 'Empty Bucket',
    category: 'tools',
    icon: 'bucket',
    stackSize: 16,
  },
  {
    id: ITEM.WATER_BUCKET,
    name: 'Water Bucket',
    category: 'tools',
    icon: 'water_bucket',
    stackSize: 1,
  },

  // Food
  { id: ITEM.APPLE, name: 'Crisp Apple', category: 'food', icon: 'apple', foodRestore: 4 },
  { id: ITEM.RAW_PORK, name: 'Raw Porkchop', category: 'food', icon: 'raw_pork', foodRestore: 3 },
  { id: ITEM.COOKED_PORK, name: 'Cooked Porkchop', category: 'food', icon: 'cooked_pork', foodRestore: 8 },
  { id: ITEM.RAW_MUTTON, name: 'Raw Mutton', category: 'food', icon: 'raw_mutton', foodRestore: 2 },
  { id: ITEM.COOKED_MUTTON, name: 'Cooked Mutton', category: 'food', icon: 'cooked_mutton', foodRestore: 6 },
  { id: ITEM.RAW_CHICKEN, name: 'Raw Poultry', category: 'food', icon: 'raw_chicken', foodRestore: 2 },
  { id: ITEM.COOKED_CHICKEN, name: 'Roast Poultry', category: 'food', icon: 'cooked_chicken', foodRestore: 6 },
];

export const ITEMS = {};
for (const def of rawItems) {
  ITEMS[def.id] = {
    isBlock: false,
    stackSize: def.stackSize ?? 64,
    toolType: def.toolType || TOOL_TYPES.NONE,
    toolTier: def.toolTier || TOOL_TIERS.NONE,
    miningSpeed: def.miningSpeed || 1.0,
    attackDamage: def.attackDamage || 1,
    maxDurability: def.maxDurability || 0,
    fuelTime: def.fuelTime || 0,
    foodRestore: def.foodRestore || 0,
    inCreativePalette: true,
    ...def,
  };
}

export function getEntry(id) {
  if (!id) return null;
  if (id < 100) return BLOCKS[id] || null;
  return ITEMS[id] || null;
}

export function getAllCreativeEntries() {
  const list = [];
  for (const key of Object.keys(BLOCKS)) {
    const b = BLOCKS[key];
    if (b && b.id !== BLOCK.AIR && b.inCreativePalette) {
      list.push(b);
    }
  }
  for (const key of Object.keys(ITEMS)) {
    const it = ITEMS[key];
    if (it && it.inCreativePalette) {
      list.push(it);
    }
  }
  return list;
}
