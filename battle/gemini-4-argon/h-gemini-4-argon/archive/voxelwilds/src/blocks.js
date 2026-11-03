export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  SANDSTONE: 6,
  GRAVEL: 7,
  WATER: 8,
  BEDROCK: 9,
  OAK_LOG: 10,
  OAK_LEAVES: 11,
  OAK_PLANKS: 12,
  BIRCH_LOG: 13,
  BIRCH_LEAVES: 14,
  BIRCH_PLANKS: 15,
  SPRUCE_LOG: 16,
  SPRUCE_LEAVES: 17,
  SPRUCE_PLANKS: 18,
  SNOW_GRASS: 19,
  SNOW_BLOCK: 20,
  ICE: 21,
  CLAY: 22,
  TERRACOTTA: 23,
  RED_SAND: 24,
  COAL_ORE: 25,
  IRON_ORE: 26,
  GOLD_ORE: 27,
  DIAMOND_ORE: 28,
  CRAFTING_TABLE: 29,
  FURNACE: 30,
  GLASS: 31,
  BRICKS: 32,
  STONE_BRICKS: 33,
  MOSSY_STONE_BRICKS: 34,
  BOOKSHELF: 35,
  GLOWSTONE: 36,
  WOOL_WHITE: 37,
  WOOL_RED: 38,
  WOOL_BLUE: 39,
  TORCH: 40,
  TALL_GRASS: 41,
  POPPY: 42,
  DANDELION: 43,
  MUSHROOM_RED: 44,
  DEAD_BUSH: 45,
  CACTUS: 46,
  IRON_BLOCK: 47,
  GOLD_BLOCK: 48,
  DIAMOND_BLOCK: 49,
};

export const ITEM = {
  STICK: 101,
  COAL: 102,
  IRON_INGOT: 103,
  GOLD_INGOT: 104,
  DIAMOND: 105,
  RAW_MEAT: 106,
  COOKED_MEAT: 107,
  APPLE: 108,
  BRICK_ITEM: 109,

  WOOD_PICKAXE: 110,
  WOOD_AXE: 111,
  WOOD_SHOVEL: 112,
  WOOD_SWORD: 113,

  STONE_PICKAXE: 120,
  STONE_AXE: 121,
  STONE_SHOVEL: 122,
  STONE_SWORD: 123,

  IRON_PICKAXE: 130,
  IRON_AXE: 131,
  IRON_SHOVEL: 132,
  IRON_SWORD: 133,

  DIAMOND_PICKAXE: 140,
  DIAMOND_AXE: 141,
  DIAMOND_SHOVEL: 142,
  DIAMOND_SWORD: 143,
};

const REGISTRY = new Map();

function register(def) {
  const normalized = {
    isBlock: def.id < 100 && def.id !== 0,
    solid: def.id < 100 && def.id !== 0,
    opaque: def.id < 100 && def.id !== 0,
    raycastable: def.id < 100 && def.id !== 0,
    renderType: 'cube',
    hardness: 1.0,
    preferredTool: null,
    minTier: 0,
    lightLevel: 0,
    maxStack: 64,
    soundType: 'stone',
    particleColor: '#888888',
    category: 'building',
    ...def,
  };
  REGISTRY.set(normalized.id, normalized);
}

// Air
register({
  id: BLOCK.AIR,
  key: 'air',
  name: 'Air',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
});

// Natural terrain blocks
register({
  id: BLOCK.GRASS,
  key: 'grass',
  name: 'Grass Block',
  textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  hardness: 0.65,
  preferredTool: 'shovel',
  drop: () => ({ id: BLOCK.DIRT, count: 1 }),
  soundType: 'grass',
  particleColor: '#5ea83c',
  category: 'nature',
});

register({
  id: BLOCK.DIRT,
  key: 'dirt',
  name: 'Dirt',
  textures: { all: 'dirt' },
  hardness: 0.55,
  preferredTool: 'shovel',
  soundType: 'dirt',
  particleColor: '#865b3b',
  category: 'nature',
});

register({
  id: BLOCK.STONE,
  key: 'stone',
  name: 'Stone',
  textures: { all: 'stone' },
  hardness: 2.0,
  preferredTool: 'pickaxe',
  minTier: 1,
  drop: () => ({ id: BLOCK.COBBLESTONE, count: 1 }),
  soundType: 'stone',
  particleColor: '#7d7d82',
  category: 'nature',
});

register({
  id: BLOCK.COBBLESTONE,
  key: 'cobblestone',
  name: 'Cobblestone',
  textures: { all: 'cobblestone' },
  hardness: 2.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#6f6f73',
  category: 'building',
});

register({
  id: BLOCK.SAND,
  key: 'sand',
  name: 'Sand',
  textures: { all: 'sand' },
  hardness: 0.55,
  preferredTool: 'shovel',
  gravity: true,
  soundType: 'sand',
  particleColor: '#dfd199',
  category: 'nature',
});

register({
  id: BLOCK.SANDSTONE,
  key: 'sandstone',
  name: 'Sandstone',
  textures: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
  hardness: 1.5,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#d7c588',
  category: 'building',
});

register({
  id: BLOCK.GRAVEL,
  key: 'gravel',
  name: 'Gravel',
  textures: { all: 'gravel' },
  hardness: 0.65,
  preferredTool: 'shovel',
  gravity: true,
  soundType: 'sand',
  particleColor: '#8b8583',
  category: 'nature',
});

register({
  id: BLOCK.WATER,
  key: 'water',
  name: 'Water',
  textures: { all: 'water' },
  solid: false,
  opaque: false,
  raycastable: false,
  renderType: 'water',
  hardness: Infinity,
  soundType: 'water',
  particleColor: '#3685e8',
  category: 'nature',
});

register({
  id: BLOCK.BEDROCK,
  key: 'bedrock',
  name: 'Bedrock',
  textures: { all: 'bedrock' },
  hardness: Infinity,
  soundType: 'stone',
  particleColor: '#3a3a3d',
  category: 'nature',
});

// Woods & Leaves
register({
  id: BLOCK.OAK_LOG,
  key: 'oak_log',
  name: 'Oak Log',
  textures: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log_side' },
  hardness: 1.5,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#6e5233',
  category: 'nature',
});

register({
  id: BLOCK.OAK_LEAVES,
  key: 'oak_leaves',
  name: 'Oak Leaves',
  textures: { all: 'oak_leaves' },
  opaque: false,
  renderType: 'leaves',
  hardness: 0.28,
  drop: (rng = Math.random) => {
    const r = rng();
    if (r < 0.08) return { id: ITEM.APPLE, count: 1 };
    if (r < 0.22) return { id: ITEM.STICK, count: 1 };
    return null;
  },
  soundType: 'grass',
  particleColor: '#3f8c2e',
  category: 'nature',
});

register({
  id: BLOCK.OAK_PLANKS,
  key: 'oak_planks',
  name: 'Oak Planks',
  textures: { all: 'oak_planks' },
  hardness: 1.4,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#b28d57',
  category: 'building',
});

register({
  id: BLOCK.BIRCH_LOG,
  key: 'birch_log',
  name: 'Birch Log',
  textures: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log_side' },
  hardness: 1.5,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#d9d5cc',
  category: 'nature',
});

register({
  id: BLOCK.BIRCH_LEAVES,
  key: 'birch_leaves',
  name: 'Birch Leaves',
  textures: { all: 'birch_leaves' },
  opaque: false,
  renderType: 'leaves',
  hardness: 0.28,
  drop: (rng = Math.random) => (rng() < 0.18 ? { id: ITEM.STICK, count: 1 } : null),
  soundType: 'grass',
  particleColor: '#68a347',
  category: 'nature',
});

register({
  id: BLOCK.BIRCH_PLANKS,
  key: 'birch_planks',
  name: 'Birch Planks',
  textures: { all: 'birch_planks' },
  hardness: 1.4,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#d5c596',
  category: 'building',
});

register({
  id: BLOCK.SPRUCE_LOG,
  key: 'spruce_log',
  name: 'Spruce Log',
  textures: { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log_side' },
  hardness: 1.5,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#4a3420',
  category: 'nature',
});

register({
  id: BLOCK.SPRUCE_LEAVES,
  key: 'spruce_leaves',
  name: 'Spruce Leaves',
  textures: { all: 'spruce_leaves' },
  opaque: false,
  renderType: 'leaves',
  hardness: 0.28,
  drop: (rng = Math.random) => (rng() < 0.18 ? { id: ITEM.STICK, count: 1 } : null),
  soundType: 'grass',
  particleColor: '#2d5c3b',
  category: 'nature',
});

register({
  id: BLOCK.SPRUCE_PLANKS,
  key: 'spruce_planks',
  name: 'Spruce Planks',
  textures: { all: 'spruce_planks' },
  hardness: 1.4,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#7a5837',
  category: 'building',
});

// Snow & Mesa blocks
register({
  id: BLOCK.SNOW_GRASS,
  key: 'snow_grass',
  name: 'Snowy Grass',
  textures: { top: 'snow', bottom: 'dirt', side: 'snow_grass_side' },
  hardness: 0.65,
  preferredTool: 'shovel',
  drop: () => ({ id: BLOCK.DIRT, count: 1 }),
  soundType: 'snow',
  particleColor: '#f0f6fa',
  category: 'nature',
});

register({
  id: BLOCK.SNOW_BLOCK,
  key: 'snow_block',
  name: 'Snow Block',
  textures: { all: 'snow' },
  hardness: 0.45,
  preferredTool: 'shovel',
  soundType: 'snow',
  particleColor: '#f4f9fc',
  category: 'nature',
});

register({
  id: BLOCK.ICE,
  key: 'ice',
  name: 'Packed Ice',
  textures: { all: 'ice' },
  opaque: false,
  renderType: 'glass',
  hardness: 0.7,
  preferredTool: 'pickaxe',
  soundType: 'glass',
  particleColor: '#97c7f7',
  category: 'nature',
});

register({
  id: BLOCK.CLAY,
  key: 'clay',
  name: 'Clay Block',
  textures: { all: 'clay' },
  hardness: 0.65,
  preferredTool: 'shovel',
  soundType: 'dirt',
  particleColor: '#9aa2b0',
  category: 'nature',
});

register({
  id: BLOCK.TERRACOTTA,
  key: 'terracotta',
  name: 'Terracotta',
  textures: { all: 'terracotta' },
  hardness: 1.8,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#b56345',
  category: 'building',
});

register({
  id: BLOCK.RED_SAND,
  key: 'red_sand',
  name: 'Red Sand',
  textures: { all: 'red_sand' },
  hardness: 0.55,
  preferredTool: 'shovel',
  gravity: true,
  soundType: 'sand',
  particleColor: '#c76932',
  category: 'nature',
});

// Ores
register({
  id: BLOCK.COAL_ORE,
  key: 'coal_ore',
  name: 'Coal Ore',
  textures: { all: 'coal_ore' },
  hardness: 2.5,
  preferredTool: 'pickaxe',
  minTier: 1,
  drop: () => ({ id: ITEM.COAL, count: 1 }),
  soundType: 'stone',
  particleColor: '#454549',
  category: 'nature',
});

register({
  id: BLOCK.IRON_ORE,
  key: 'iron_ore',
  name: 'Iron Ore',
  textures: { all: 'iron_ore' },
  hardness: 3.0,
  preferredTool: 'pickaxe',
  minTier: 2,
  soundType: 'stone',
  particleColor: '#b8947c',
  category: 'nature',
});

register({
  id: BLOCK.GOLD_ORE,
  key: 'gold_ore',
  name: 'Gold Ore',
  textures: { all: 'gold_ore' },
  hardness: 3.2,
  preferredTool: 'pickaxe',
  minTier: 3,
  soundType: 'stone',
  particleColor: '#f0ca43',
  category: 'nature',
});

register({
  id: BLOCK.DIAMOND_ORE,
  key: 'diamond_ore',
  name: 'Diamond Ore',
  textures: { all: 'diamond_ore' },
  hardness: 3.8,
  preferredTool: 'pickaxe',
  minTier: 3,
  drop: () => ({ id: ITEM.DIAMOND, count: 1 }),
  soundType: 'stone',
  particleColor: '#4ee6db',
  category: 'nature',
});

// Utility & Crafted Blocks
register({
  id: BLOCK.CRAFTING_TABLE,
  key: 'crafting_table',
  name: 'Crafting Table',
  textures: { top: 'crafting_top', bottom: 'oak_planks', side: 'crafting_side' },
  hardness: 1.6,
  preferredTool: 'axe',
  interactive: 'crafting',
  soundType: 'wood',
  particleColor: '#9c7243',
  category: 'utility',
});

register({
  id: BLOCK.FURNACE,
  key: 'furnace',
  name: 'Stone Furnace',
  textures: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_front' },
  hardness: 2.5,
  preferredTool: 'pickaxe',
  minTier: 1,
  interactive: 'furnace',
  soundType: 'stone',
  particleColor: '#6d6d72',
  category: 'utility',
});

register({
  id: BLOCK.GLASS,
  key: 'glass',
  name: 'Clear Glass',
  textures: { all: 'glass' },
  opaque: false,
  renderType: 'glass',
  hardness: 0.45,
  soundType: 'glass',
  particleColor: '#d7f1f7',
  category: 'building',
});

register({
  id: BLOCK.BRICKS,
  key: 'bricks',
  name: 'Clay Bricks',
  textures: { all: 'bricks' },
  hardness: 2.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#a85346',
  category: 'building',
});

register({
  id: BLOCK.STONE_BRICKS,
  key: 'stone_bricks',
  name: 'Stone Bricks',
  textures: { all: 'stone_bricks' },
  hardness: 2.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#79797e',
  category: 'building',
});

register({
  id: BLOCK.MOSSY_STONE_BRICKS,
  key: 'mossy_stone_bricks',
  name: 'Mossy Stone Bricks',
  textures: { all: 'mossy_stone_bricks' },
  hardness: 2.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundType: 'stone',
  particleColor: '#617a58',
  category: 'building',
});

register({
  id: BLOCK.BOOKSHELF,
  key: 'bookshelf',
  name: 'Bookshelf',
  textures: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
  hardness: 1.3,
  preferredTool: 'axe',
  soundType: 'wood',
  particleColor: '#9e7949',
  category: 'utility',
});

register({
  id: BLOCK.GLOWSTONE,
  key: 'glowstone',
  name: 'Sunstone Lantern',
  textures: { all: 'glowstone' },
  hardness: 0.6,
  lightLevel: 15,
  soundType: 'glass',
  particleColor: '#ffda66',
  category: 'utility',
});

register({
  id: BLOCK.WOOL_WHITE,
  key: 'wool_white',
  name: 'White Wool',
  textures: { all: 'wool_white' },
  hardness: 0.6,
  soundType: 'grass',
  particleColor: '#ececec',
  category: 'building',
});

register({
  id: BLOCK.WOOL_RED,
  key: 'wool_red',
  name: 'Crimson Wool',
  textures: { all: 'wool_red' },
  hardness: 0.6,
  soundType: 'grass',
  particleColor: '#bf3434',
  category: 'building',
});

register({
  id: BLOCK.WOOL_BLUE,
  key: 'wool_blue',
  name: 'Azure Wool',
  textures: { all: 'wool_blue' },
  hardness: 0.6,
  soundType: 'grass',
  particleColor: '#3566bf',
  category: 'building',
});

register({
  id: BLOCK.TORCH,
  key: 'torch',
  name: 'Torch',
  textures: { all: 'torch' },
  solid: false,
  opaque: false,
  renderType: 'torch',
  hardness: 0.05,
  lightLevel: 14,
  soundType: 'wood',
  particleColor: '#ffbe4a',
  category: 'utility',
});

// Flora & Crossed Quads
register({
  id: BLOCK.TALL_GRASS,
  key: 'tall_grass',
  name: 'Tall Grass',
  textures: { all: 'tall_grass' },
  solid: false,
  opaque: false,
  renderType: 'cross',
  replaceable: true,
  hardness: 0.03,
  drop: (rng = Math.random) => (rng() < 0.1 ? { id: ITEM.APPLE, count: 1 } : null),
  soundType: 'grass',
  particleColor: '#57a137',
  category: 'nature',
});

register({
  id: BLOCK.POPPY,
  key: 'poppy',
  name: 'Red Poppy',
  textures: { all: 'poppy' },
  solid: false,
  opaque: false,
  renderType: 'cross',
  hardness: 0.03,
  soundType: 'grass',
  particleColor: '#e03636',
  category: 'nature',
});

register({
  id: BLOCK.DANDELION,
  key: 'dandelion',
  name: 'Golden Dandelion',
  textures: { all: 'dandelion' },
  solid: false,
  opaque: false,
  renderType: 'cross',
  hardness: 0.03,
  soundType: 'grass',
  particleColor: '#f2d335',
  category: 'nature',
});

register({
  id: BLOCK.MUSHROOM_RED,
  key: 'mushroom_red',
  name: 'Spotted Mushroom',
  textures: { all: 'mushroom_red' },
  solid: false,
  opaque: false,
  renderType: 'cross',
  hardness: 0.04,
  soundType: 'grass',
  particleColor: '#d43b3b',
  category: 'nature',
});

register({
  id: BLOCK.DEAD_BUSH,
  key: 'dead_bush',
  name: 'Desert Shrub',
  textures: { all: 'dead_bush' },
  solid: false,
  opaque: false,
  renderType: 'cross',
  replaceable: true,
  hardness: 0.04,
  drop: () => ({ id: ITEM.STICK, count: 1 }),
  soundType: 'wood',
  particleColor: '#8d6c43',
  category: 'nature',
});

register({
  id: BLOCK.CACTUS,
  key: 'cactus',
  name: 'Desert Cactus',
  textures: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' },
  opaque: false,
  renderType: 'cactus',
  hardness: 0.45,
  contactDamage: 1,
  soundType: 'grass',
  particleColor: '#2e8538',
  category: 'nature',
});

register({
  id: BLOCK.IRON_BLOCK,
  key: 'iron_block',
  name: 'Block of Iron',
  textures: { all: 'iron_block' },
  hardness: 3.4,
  preferredTool: 'pickaxe',
  minTier: 2,
  soundType: 'stone',
  particleColor: '#dcdcdc',
  category: 'building',
});

register({
  id: BLOCK.GOLD_BLOCK,
  key: 'gold_block',
  name: 'Block of Gold',
  textures: { all: 'gold_block' },
  hardness: 3.4,
  preferredTool: 'pickaxe',
  minTier: 3,
  soundType: 'stone',
  particleColor: '#f5ce38',
  category: 'building',
});

register({
  id: BLOCK.DIAMOND_BLOCK,
  key: 'diamond_block',
  name: 'Block of Diamond',
  textures: { all: 'diamond_block' },
  hardness: 4.0,
  preferredTool: 'pickaxe',
  minTier: 3,
  soundType: 'stone',
  particleColor: '#54f0e3',
  category: 'building',
});

// Materials & Food Items
register({
  id: ITEM.STICK,
  key: 'stick',
  name: 'Wooden Stick',
  iconKey: 'stick',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  fuelValue: 1,
  category: 'materials',
});

register({
  id: ITEM.COAL,
  key: 'coal',
  name: 'Coal',
  iconKey: 'coal',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  fuelValue: 4,
  category: 'materials',
});

register({
  id: ITEM.IRON_INGOT,
  key: 'iron_ingot',
  name: 'Iron Ingot',
  iconKey: 'iron_ingot',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  category: 'materials',
});

register({
  id: ITEM.GOLD_INGOT,
  key: 'gold_ingot',
  name: 'Gold Ingot',
  iconKey: 'gold_ingot',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  category: 'materials',
});

register({
  id: ITEM.DIAMOND,
  key: 'diamond',
  name: 'Diamond Gem',
  iconKey: 'diamond',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  category: 'materials',
});

register({
  id: ITEM.BRICK_ITEM,
  key: 'brick_item',
  name: 'Fired Brick',
  iconKey: 'brick_item',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  category: 'materials',
});

register({
  id: ITEM.RAW_MEAT,
  key: 'raw_meat',
  name: 'Raw Venison',
  iconKey: 'raw_meat',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  foodHeal: 3,
  category: 'food',
});

register({
  id: ITEM.COOKED_MEAT,
  key: 'cooked_meat',
  name: 'Roasted Steak',
  iconKey: 'cooked_meat',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  foodHeal: 8,
  category: 'food',
});

register({
  id: ITEM.APPLE,
  key: 'apple',
  name: 'Crisp Apple',
  iconKey: 'apple',
  isBlock: false,
  solid: false,
  opaque: false,
  raycastable: false,
  foodHeal: 4,
  category: 'food',
});

// Helper to register tools cleanly
function registerTool({ id, key, name, toolType, tier, speed, damage, durability, materialColor }) {
  register({
    id,
    key,
    name,
    iconKey: key,
    isBlock: false,
    solid: false,
    opaque: false,
    raycastable: false,
    maxStack: 1,
    toolType,
    toolTier: tier,
    miningSpeed: speed,
    attackDamage: damage,
    maxDurability: durability,
    materialColor,
    category: 'tools',
  });
}

// Wood Tier (Tier 1)
registerTool({ id: ITEM.WOOD_PICKAXE, key: 'wood_pickaxe', name: 'Wooden Pickaxe', toolType: 'pickaxe', tier: 1, speed: 2.3, damage: 3, durability: 65, materialColor: '#b38b54' });
registerTool({ id: ITEM.WOOD_AXE, key: 'wood_axe', name: 'Wooden Axe', toolType: 'axe', tier: 1, speed: 2.3, damage: 4, durability: 65, materialColor: '#b38b54' });
registerTool({ id: ITEM.WOOD_SHOVEL, key: 'wood_shovel', name: 'Wooden Shovel', toolType: 'shovel', tier: 1, speed: 2.3, damage: 2, durability: 65, materialColor: '#b38b54' });
registerTool({ id: ITEM.WOOD_SWORD, key: 'wood_sword', name: 'Wooden Sword', toolType: 'sword', tier: 1, speed: 1.5, damage: 5, durability: 65, materialColor: '#b38b54' });

// Stone Tier (Tier 2)
registerTool({ id: ITEM.STONE_PICKAXE, key: 'stone_pickaxe', name: 'Stone Pickaxe', toolType: 'pickaxe', tier: 2, speed: 4.0, damage: 4, durability: 140, materialColor: '#8d8d94' });
registerTool({ id: ITEM.STONE_AXE, key: 'stone_axe', name: 'Stone Axe', toolType: 'axe', tier: 2, speed: 4.0, damage: 5, durability: 140, materialColor: '#8d8d94' });
registerTool({ id: ITEM.STONE_SHOVEL, key: 'stone_shovel', name: 'Stone Shovel', toolType: 'shovel', tier: 2, speed: 4.0, damage: 3, durability: 140, materialColor: '#8d8d94' });
registerTool({ id: ITEM.STONE_SWORD, key: 'stone_sword', name: 'Stone Sword', toolType: 'sword', tier: 2, speed: 1.6, damage: 6, durability: 140, materialColor: '#8d8d94' });

// Iron Tier (Tier 3)
registerTool({ id: ITEM.IRON_PICKAXE, key: 'iron_pickaxe', name: 'Iron Pickaxe', toolType: 'pickaxe', tier: 3, speed: 6.5, damage: 5, durability: 260, materialColor: '#e2e6eb' });
registerTool({ id: ITEM.IRON_AXE, key: 'iron_axe', name: 'Iron Axe', toolType: 'axe', tier: 3, speed: 6.5, damage: 6, durability: 260, materialColor: '#e2e6eb' });
registerTool({ id: ITEM.IRON_SHOVEL, key: 'iron_shovel', name: 'Iron Shovel', toolType: 'shovel', tier: 3, speed: 6.5, damage: 4, durability: 260, materialColor: '#e2e6eb' });
registerTool({ id: ITEM.IRON_SWORD, key: 'iron_sword', name: 'Iron Sword', toolType: 'sword', tier: 3, speed: 1.8, damage: 7, durability: 260, materialColor: '#e2e6eb' });

// Diamond Tier (Tier 4)
registerTool({ id: ITEM.DIAMOND_PICKAXE, key: 'diamond_pickaxe', name: 'Diamond Pickaxe', toolType: 'pickaxe', tier: 4, speed: 9.5, damage: 6, durability: 650, materialColor: '#4bf0e2' });
registerTool({ id: ITEM.DIAMOND_AXE, key: 'diamond_axe', name: 'Diamond Axe', toolType: 'axe', tier: 4, speed: 9.5, damage: 8, durability: 650, materialColor: '#4bf0e2' });
registerTool({ id: ITEM.DIAMOND_SHOVEL, key: 'diamond_shovel', name: 'Diamond Shovel', toolType: 'shovel', tier: 4, speed: 9.5, damage: 5, durability: 650, materialColor: '#4bf0e2' });
registerTool({ id: ITEM.DIAMOND_SWORD, key: 'diamond_sword', name: 'Diamond Sword', toolType: 'sword', tier: 4, speed: 2.0, damage: 9, durability: 650, materialColor: '#4bf0e2' });

export function getBlockDef(id) {
  return REGISTRY.get(id) || REGISTRY.get(BLOCK.AIR);
}

export function getAllItems() {
  return Array.from(REGISTRY.values()).filter((d) => d.id !== BLOCK.AIR && d.id !== BLOCK.WATER);
}

export function isSolidBlock(id) {
  const def = REGISTRY.get(id);
  return Boolean(def && def.solid);
}

export function isOpaqueBlock(id) {
  const def = REGISTRY.get(id);
  return Boolean(def && def.opaque);
}

export function isWaterBlock(id) {
  return id === BLOCK.WATER;
}

export function getLightEmission(id) {
  const def = REGISTRY.get(id);
  return def ? def.lightLevel : 0;
}
