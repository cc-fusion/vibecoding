import {
  RENDER_PASS,
  MESH_SHAPE,
  TOOL_TYPES,
  SOUND_MATERIAL,
} from '../constants.js';

export const BLOCK_IDS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  BEDROCK: 5,
  SAND: 6,
  SANDSTONE: 7,
  GRAVEL: 8,
  CLAY: 9,
  SNOW_GRASS: 10,
  SNOW: 11,
  ICE: 12,
  WATER: 13,
  LAVA: 14,
  OAK_LOG: 15,
  OAK_LEAVES: 16,
  OAK_PLANKS: 17,
  BIRCH_LOG: 18,
  BIRCH_LEAVES: 19,
  BIRCH_PLANKS: 20,
  SPRUCE_LOG: 21,
  SPRUCE_LEAVES: 22,
  SPRUCE_PLANKS: 23,
  COAL_ORE: 24,
  IRON_ORE: 25,
  GOLD_ORE: 26,
  DIAMOND_ORE: 27,
  GLOWSTONE: 28,
  CRAFTING_TABLE: 29,
  FURNACE: 30,
  LIT_FURNACE: 31,
  CHEST: 32,
  TORCH: 33,
  GLASS: 34,
  BRICKS: 35,
  STONE_BRICKS: 36,
  MOSSY_COBBLE: 37,
  WOOL: 38,
  BOOKSHELF: 39,
  BED: 40,
  LADDER: 41,
  CACTUS: 42,
  TALL_GRASS: 43,
  RED_FLOWER: 44,
  YELLOW_FLOWER: 45,
  BERRY_BUSH: 46,
  MUSHROOM: 47,
  DEAD_BUSH: 48,
  REEDS: 49,
};

export const ITEM_IDS = {
  STICK: 100,
  COAL: 101,
  CHARCOAL: 102,
  IRON_INGOT: 103,
  GOLD_INGOT: 104,
  DIAMOND: 105,
  CLAY_BALL: 106,
  BRICK_ITEM: 107,
  FLINT: 108,
  LEATHER: 109,

  WOOD_PICKAXE: 110,
  WOOD_AXE: 111,
  WOOD_SHOVEL: 112,
  WOOD_SWORD: 113,

  STONE_PICKAXE: 114,
  STONE_AXE: 115,
  STONE_SHOVEL: 116,
  STONE_SWORD: 117,

  IRON_PICKAXE: 118,
  IRON_AXE: 119,
  IRON_SHOVEL: 120,
  IRON_SWORD: 121,

  DIAMOND_PICKAXE: 122,
  DIAMOND_AXE: 123,
  DIAMOND_SHOVEL: 124,
  DIAMOND_SWORD: 125,

  APPLE: 130,
  SWEET_BERRIES: 131,
  RAW_MEAT: 132,
  COOKED_MEAT: 133,
  BREAD: 134,
  WHEAT_GRAIN: 135,
};

export const REGISTRY = new Map();

function registerBlock(def) {
  const entry = {
    isBlock: true,
    solid: true,
    opaque: true,
    renderPass: RENDER_PASS.OPAQUE,
    shape: MESH_SHAPE.CUBE,
    lightLevel: 0,
    hardness: 1.0,
    preferredTool: TOOL_TYPES.NONE,
    minToolTier: 0,
    maxStack: 64,
    sound: SOUND_MATERIAL.STONE,
    gravity: false,
    liquid: false,
    climbable: false,
    replaceable: false,
    interactive: null,
    fuelTime: 0,
    attackDamage: 1,
    particleColor: 0x888888,
    ...def,
  };
  REGISTRY.set(entry.id, entry);
  return entry;
}

function registerItem(def) {
  const entry = {
    isBlock: false,
    maxStack: def.toolType ? 1 : 64,
    toolType: TOOL_TYPES.NONE,
    toolTier: 0,
    miningSpeed: 1.0,
    attackDamage: 1,
    maxDurability: 0,
    food: null,
    fuelTime: 0,
    ...def,
  };
  REGISTRY.set(entry.id, entry);
  return entry;
}

// --- BLOCKS ---
registerBlock({
  id: BLOCK_IDS.AIR,
  name: 'Air',
  solid: false,
  opaque: false,
  replaceable: true,
  hardness: 0,
});

registerBlock({
  id: BLOCK_IDS.GRASS,
  name: 'Grass Block',
  textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  hardness: 0.75,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.GRASS,
  drops: { id: BLOCK_IDS.DIRT, count: 1 },
  particleColor: 0x5da644,
});

registerBlock({
  id: BLOCK_IDS.DIRT,
  name: 'Dirt',
  textures: { all: 'dirt' },
  hardness: 0.65,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.DIRT,
  particleColor: 0x7a553a,
});

registerBlock({
  id: BLOCK_IDS.STONE,
  name: 'Stone',
  textures: { all: 'stone' },
  hardness: 2.0,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  drops: { id: BLOCK_IDS.COBBLESTONE, count: 1 },
  particleColor: 0x84888c,
});

registerBlock({
  id: BLOCK_IDS.COBBLESTONE,
  name: 'Cobblestone',
  textures: { all: 'cobblestone' },
  hardness: 2.2,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0x6f7377,
});

registerBlock({
  id: BLOCK_IDS.BEDROCK,
  name: 'Bedrock',
  textures: { all: 'bedrock' },
  hardness: -1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0x333538,
});

registerBlock({
  id: BLOCK_IDS.SAND,
  name: 'Sand',
  textures: { all: 'sand' },
  hardness: 0.6,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.SAND,
  gravity: true,
  particleColor: 0xdfd199,
});

registerBlock({
  id: BLOCK_IDS.SANDSTONE,
  name: 'Sandstone',
  textures: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
  hardness: 1.5,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0xd6c489,
});

registerBlock({
  id: BLOCK_IDS.GRAVEL,
  name: 'Gravel',
  textures: { all: 'gravel' },
  hardness: 0.75,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.SAND,
  gravity: true,
  drops: () => (Math.random() < 0.2 ? { id: ITEM_IDS.FLINT, count: 1 } : { id: BLOCK_IDS.GRAVEL, count: 1 }),
  particleColor: 0x898482,
});

registerBlock({
  id: BLOCK_IDS.CLAY,
  name: 'Clay Block',
  textures: { all: 'clay' },
  hardness: 0.75,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.DIRT,
  drops: { id: ITEM_IDS.CLAY_BALL, count: 4 },
  particleColor: 0x9fa6b4,
});

registerBlock({
  id: BLOCK_IDS.SNOW_GRASS,
  name: 'Snowy Turf',
  textures: { top: 'snow', bottom: 'dirt', side: 'snow_side' },
  hardness: 0.75,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.GRASS,
  drops: { id: BLOCK_IDS.DIRT, count: 1 },
  particleColor: 0xebf4f8,
});

registerBlock({
  id: BLOCK_IDS.SNOW,
  name: 'Snow Block',
  textures: { all: 'snow' },
  hardness: 0.45,
  preferredTool: TOOL_TYPES.SHOVEL,
  sound: SOUND_MATERIAL.WOOL,
  particleColor: 0xf2f8fc,
});

registerBlock({
  id: BLOCK_IDS.ICE,
  name: 'Packed Ice',
  textures: { all: 'ice' },
  opaque: false,
  renderPass: RENDER_PASS.TRANSLUCENT,
  hardness: 0.7,
  preferredTool: TOOL_TYPES.PICKAXE,
  sound: SOUND_MATERIAL.GLASS,
  particleColor: 0x94c9f5,
});

registerBlock({
  id: BLOCK_IDS.WATER,
  name: 'Water',
  textures: { all: 'water' },
  solid: false,
  opaque: false,
  liquid: true,
  replaceable: true,
  renderPass: RENDER_PASS.TRANSLUCENT,
  shape: MESH_SHAPE.LIQUID,
  hardness: -1,
  sound: SOUND_MATERIAL.WATER,
  particleColor: 0x3482e0,
});

registerBlock({
  id: BLOCK_IDS.LAVA,
  name: 'Lava',
  textures: { all: 'lava' },
  solid: false,
  opaque: false,
  liquid: true,
  replaceable: true,
  renderPass: RENDER_PASS.OPAQUE,
  shape: MESH_SHAPE.LIQUID,
  lightLevel: 15,
  hardness: -1,
  sound: SOUND_MATERIAL.WATER,
  particleColor: 0xf4651b,
});

registerBlock({
  id: BLOCK_IDS.OAK_LOG,
  name: 'Oak Log',
  textures: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log' },
  hardness: 1.6,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 15,
  particleColor: 0x6f5333,
});

registerBlock({
  id: BLOCK_IDS.OAK_LEAVES,
  name: 'Oak Leaves',
  textures: { all: 'oak_leaves' },
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  hardness: 0.3,
  sound: SOUND_MATERIAL.GRASS,
  drops: () => {
    const r = Math.random();
    if (r < 0.08) return { id: ITEM_IDS.APPLE, count: 1 };
    if (r < 0.22) return { id: ITEM_IDS.STICK, count: 1 };
    return null;
  },
  particleColor: 0x458b32,
});

registerBlock({
  id: BLOCK_IDS.OAK_PLANKS,
  name: 'Oak Planks',
  textures: { all: 'oak_planks' },
  hardness: 1.5,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 10,
  particleColor: 0xa7834f,
});

registerBlock({
  id: BLOCK_IDS.BIRCH_LOG,
  name: 'Birch Log',
  textures: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log' },
  hardness: 1.6,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 15,
  particleColor: 0xd8d3c8,
});

registerBlock({
  id: BLOCK_IDS.BIRCH_LEAVES,
  name: 'Birch Leaves',
  textures: { all: 'birch_leaves' },
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  hardness: 0.3,
  sound: SOUND_MATERIAL.GRASS,
  drops: () => (Math.random() < 0.18 ? { id: ITEM_IDS.STICK, count: 1 } : null),
  particleColor: 0x6ba644,
});

registerBlock({
  id: BLOCK_IDS.BIRCH_PLANKS,
  name: 'Birch Planks',
  textures: { all: 'birch_planks' },
  hardness: 1.5,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 10,
  particleColor: 0xcab98b,
});

registerBlock({
  id: BLOCK_IDS.SPRUCE_LOG,
  name: 'Spruce Log',
  textures: { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log' },
  hardness: 1.6,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 15,
  particleColor: 0x47321f,
});

registerBlock({
  id: BLOCK_IDS.SPRUCE_LEAVES,
  name: 'Spruce Needles',
  textures: { all: 'spruce_leaves' },
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  hardness: 0.3,
  sound: SOUND_MATERIAL.GRASS,
  drops: () => (Math.random() < 0.18 ? { id: ITEM_IDS.STICK, count: 1 } : null),
  particleColor: 0x2f5f3b,
});

registerBlock({
  id: BLOCK_IDS.SPRUCE_PLANKS,
  name: 'Spruce Planks',
  textures: { all: 'spruce_planks' },
  hardness: 1.5,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 10,
  particleColor: 0x725335,
});

registerBlock({
  id: BLOCK_IDS.COAL_ORE,
  name: 'Coal Ore',
  textures: { all: 'coal_ore' },
  hardness: 2.4,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  drops: { id: ITEM_IDS.COAL, count: 1 },
  particleColor: 0x3b3d40,
});

registerBlock({
  id: BLOCK_IDS.IRON_ORE,
  name: 'Iron Ore',
  textures: { all: 'iron_ore' },
  hardness: 2.8,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 2,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0xc99c7e,
});

registerBlock({
  id: BLOCK_IDS.GOLD_ORE,
  name: 'Gold Ore',
  textures: { all: 'gold_ore' },
  hardness: 3.0,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 3,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0xf2c94c,
});

registerBlock({
  id: BLOCK_IDS.DIAMOND_ORE,
  name: 'Diamond Ore',
  textures: { all: 'diamond_ore' },
  hardness: 3.4,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 3,
  sound: SOUND_MATERIAL.STONE,
  drops: { id: ITEM_IDS.DIAMOND, count: 1 },
  particleColor: 0x57e2e5,
});

registerBlock({
  id: BLOCK_IDS.GLOWSTONE,
  name: 'Sunstone Crystal',
  textures: { all: 'glowstone' },
  lightLevel: 15,
  hardness: 0.9,
  preferredTool: TOOL_TYPES.PICKAXE,
  sound: SOUND_MATERIAL.GLASS,
  particleColor: 0xfad665,
});

registerBlock({
  id: BLOCK_IDS.CRAFTING_TABLE,
  name: 'Crafting Table',
  textures: { top: 'crafting_top', bottom: 'oak_planks', side: 'crafting_side' },
  hardness: 1.7,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  interactive: 'crafting',
  fuelTime: 15,
  particleColor: 0x9b6d3f,
});

registerBlock({
  id: BLOCK_IDS.FURNACE,
  name: 'Furnace',
  textures: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' },
  hardness: 2.6,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  interactive: 'furnace',
  particleColor: 0x707478,
});

registerBlock({
  id: BLOCK_IDS.LIT_FURNACE,
  name: 'Lit Furnace',
  textures: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' },
  lightLevel: 13,
  hardness: 2.6,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  interactive: 'furnace',
  drops: { id: BLOCK_IDS.FURNACE, count: 1 },
  particleColor: 0xe68432,
});

registerBlock({
  id: BLOCK_IDS.CHEST,
  name: 'Storage Chest',
  textures: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' },
  hardness: 1.8,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  interactive: 'chest',
  fuelTime: 15,
  particleColor: 0xa67438,
});

registerBlock({
  id: BLOCK_IDS.TORCH,
  name: 'Torch',
  textures: { all: 'torch' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.TORCH,
  lightLevel: 14,
  hardness: 0.08,
  sound: SOUND_MATERIAL.WOOD,
  particleColor: 0xffb84d,
});

registerBlock({
  id: BLOCK_IDS.GLASS,
  name: 'Glass',
  textures: { all: 'glass' },
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  hardness: 0.45,
  sound: SOUND_MATERIAL.GLASS,
  particleColor: 0xdbf3fa,
});

registerBlock({
  id: BLOCK_IDS.BRICKS,
  name: 'Clay Bricks',
  textures: { all: 'bricks' },
  hardness: 2.2,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0xa85244,
});

registerBlock({
  id: BLOCK_IDS.STONE_BRICKS,
  name: 'Stone Bricks',
  textures: { all: 'stone_bricks' },
  hardness: 2.2,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0x7d8084,
});

registerBlock({
  id: BLOCK_IDS.MOSSY_COBBLE,
  name: 'Mossy Cobblestone',
  textures: { all: 'mossy_cobble' },
  hardness: 2.2,
  preferredTool: TOOL_TYPES.PICKAXE,
  minToolTier: 1,
  sound: SOUND_MATERIAL.STONE,
  particleColor: 0x5c7a52,
});

registerBlock({
  id: BLOCK_IDS.WOOL,
  name: 'Soft Wool',
  textures: { all: 'wool' },
  hardness: 0.6,
  sound: SOUND_MATERIAL.WOOL,
  fuelTime: 5,
  particleColor: 0xedeef2,
});

registerBlock({
  id: BLOCK_IDS.BOOKSHELF,
  name: 'Bookshelf',
  textures: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
  hardness: 1.4,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  fuelTime: 15,
  particleColor: 0x8f6b41,
});

registerBlock({
  id: BLOCK_IDS.BED,
  name: 'Cozy Bed',
  textures: { top: 'bed_top', bottom: 'oak_planks', side: 'bed_side' },
  opaque: false,
  renderPass: RENDER_PASS.OPAQUE,
  shape: MESH_SHAPE.BED,
  hardness: 0.6,
  sound: SOUND_MATERIAL.WOOL,
  interactive: 'bed',
  maxStack: 1,
  particleColor: 0xc83e3e,
});

registerBlock({
  id: BLOCK_IDS.LADDER,
  name: 'Wooden Ladder',
  textures: { all: 'ladder' },
  solid: false,
  opaque: false,
  climbable: true,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.LADDER,
  hardness: 0.5,
  preferredTool: TOOL_TYPES.AXE,
  sound: SOUND_MATERIAL.WOOD,
  particleColor: 0x9b7948,
});

registerBlock({
  id: BLOCK_IDS.CACTUS,
  name: 'Desert Cactus',
  textures: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' },
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CACTUS,
  hardness: 0.55,
  sound: SOUND_MATERIAL.GRASS,
  particleColor: 0x3b8532,
});

registerBlock({
  id: BLOCK_IDS.TALL_GRASS,
  name: 'Wild Grass',
  textures: { all: 'tall_grass' },
  solid: false,
  opaque: false,
  replaceable: true,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.05,
  sound: SOUND_MATERIAL.GRASS,
  drops: () => (Math.random() < 0.25 ? { id: ITEM_IDS.WHEAT_GRAIN, count: 1 } : null),
  particleColor: 0x5aa63e,
});

registerBlock({
  id: BLOCK_IDS.RED_FLOWER,
  name: 'Crimson Poppy',
  textures: { all: 'red_flower' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.05,
  sound: SOUND_MATERIAL.GRASS,
  particleColor: 0xd93838,
});

registerBlock({
  id: BLOCK_IDS.YELLOW_FLOWER,
  name: 'Sunburst Dandelion',
  textures: { all: 'yellow_flower' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.05,
  sound: SOUND_MATERIAL.GRASS,
  particleColor: 0xf2d03b,
});

registerBlock({
  id: BLOCK_IDS.BERRY_BUSH,
  name: 'Sweet Berry Bush',
  textures: { all: 'berry_bush' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.2,
  sound: SOUND_MATERIAL.GRASS,
  interactive: 'berry',
  drops: { id: ITEM_IDS.SWEET_BERRIES, count: 2 },
  particleColor: 0xb8293d,
});

registerBlock({
  id: BLOCK_IDS.MUSHROOM,
  name: 'Forest Mushroom',
  textures: { all: 'mushroom' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.05,
  sound: SOUND_MATERIAL.GRASS,
  particleColor: 0xc6493a,
});

registerBlock({
  id: BLOCK_IDS.DEAD_BUSH,
  name: 'Dry Shrub',
  textures: { all: 'dead_bush' },
  solid: false,
  opaque: false,
  replaceable: true,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.05,
  sound: SOUND_MATERIAL.WOOD,
  drops: { id: ITEM_IDS.STICK, count: 1 },
  particleColor: 0x8c6c43,
});

registerBlock({
  id: BLOCK_IDS.REEDS,
  name: 'River Reeds',
  textures: { all: 'reeds' },
  solid: false,
  opaque: false,
  renderPass: RENDER_PASS.CUTOUT,
  shape: MESH_SHAPE.CROSS,
  hardness: 0.08,
  sound: SOUND_MATERIAL.GRASS,
  particleColor: 0x86c45a,
});

// --- NON-BLOCK ITEMS ---
registerItem({ id: ITEM_IDS.STICK, name: 'Wooden Stick', icon: 'stick', fuelTime: 5 });
registerItem({ id: ITEM_IDS.COAL, name: 'Coal', icon: 'coal', fuelTime: 60 });
registerItem({ id: ITEM_IDS.CHARCOAL, name: 'Charcoal', icon: 'charcoal', fuelTime: 60 });
registerItem({ id: ITEM_IDS.IRON_INGOT, name: 'Iron Ingot', icon: 'iron_ingot' });
registerItem({ id: ITEM_IDS.GOLD_INGOT, name: 'Gold Ingot', icon: 'gold_ingot' });
registerItem({ id: ITEM_IDS.DIAMOND, name: 'Diamond Gem', icon: 'diamond' });
registerItem({ id: ITEM_IDS.CLAY_BALL, name: 'Clay Lump', icon: 'clay_ball' });
registerItem({ id: ITEM_IDS.BRICK_ITEM, name: 'Fired Brick', icon: 'brick_item' });
registerItem({ id: ITEM_IDS.FLINT, name: 'Sharp Flint', icon: 'flint' });
registerItem({ id: ITEM_IDS.LEATHER, name: 'Animal Hide', icon: 'leather' });
registerItem({ id: ITEM_IDS.WHEAT_GRAIN, name: 'Wild Grain', icon: 'wheat_grain' });

// Wooden Tools (Tier 1)
registerItem({
  id: ITEM_IDS.WOOD_PICKAXE,
  name: 'Wooden Pickaxe',
  icon: 'wood_pickaxe',
  toolType: TOOL_TYPES.PICKAXE,
  toolTier: 1,
  miningSpeed: 2.4,
  attackDamage: 3,
  maxDurability: 65,
  fuelTime: 10,
});
registerItem({
  id: ITEM_IDS.WOOD_AXE,
  name: 'Wooden Axe',
  icon: 'wood_axe',
  toolType: TOOL_TYPES.AXE,
  toolTier: 1,
  miningSpeed: 2.5,
  attackDamage: 4,
  maxDurability: 65,
  fuelTime: 10,
});
registerItem({
  id: ITEM_IDS.WOOD_SHOVEL,
  name: 'Wooden Shovel',
  icon: 'wood_shovel',
  toolType: TOOL_TYPES.SHOVEL,
  toolTier: 1,
  miningSpeed: 2.5,
  attackDamage: 2,
  maxDurability: 65,
  fuelTime: 10,
});
registerItem({
  id: ITEM_IDS.WOOD_SWORD,
  name: 'Wooden Sword',
  icon: 'wood_sword',
  toolType: TOOL_TYPES.SWORD,
  toolTier: 1,
  miningSpeed: 1.5,
  attackDamage: 5,
  maxDurability: 65,
  fuelTime: 10,
});

// Stone Tools (Tier 2)
registerItem({
  id: ITEM_IDS.STONE_PICKAXE,
  name: 'Stone Pickaxe',
  icon: 'stone_pickaxe',
  toolType: TOOL_TYPES.PICKAXE,
  toolTier: 2,
  miningSpeed: 4.2,
  attackDamage: 4,
  maxDurability: 140,
});
registerItem({
  id: ITEM_IDS.STONE_AXE,
  name: 'Stone Axe',
  icon: 'stone_axe',
  toolType: TOOL_TYPES.AXE,
  toolTier: 2,
  miningSpeed: 4.2,
  attackDamage: 5,
  maxDurability: 140,
});
registerItem({
  id: ITEM_IDS.STONE_SHOVEL,
  name: 'Stone Shovel',
  icon: 'stone_shovel',
  toolType: TOOL_TYPES.SHOVEL,
  toolTier: 2,
  miningSpeed: 4.2,
  attackDamage: 3,
  maxDurability: 140,
});
registerItem({
  id: ITEM_IDS.STONE_SWORD,
  name: 'Stone Sword',
  icon: 'stone_sword',
  toolType: TOOL_TYPES.SWORD,
  toolTier: 2,
  miningSpeed: 1.8,
  attackDamage: 6,
  maxDurability: 140,
});

// Iron Tools (Tier 3)
registerItem({
  id: ITEM_IDS.IRON_PICKAXE,
  name: 'Iron Pickaxe',
  icon: 'iron_pickaxe',
  toolType: TOOL_TYPES.PICKAXE,
  toolTier: 3,
  miningSpeed: 6.8,
  attackDamage: 5,
  maxDurability: 280,
});
registerItem({
  id: ITEM_IDS.IRON_AXE,
  name: 'Iron Axe',
  icon: 'iron_axe',
  toolType: TOOL_TYPES.AXE,
  toolTier: 3,
  miningSpeed: 6.8,
  attackDamage: 6,
  maxDurability: 280,
});
registerItem({
  id: ITEM_IDS.IRON_SHOVEL,
  name: 'Iron Shovel',
  icon: 'iron_shovel',
  toolType: TOOL_TYPES.SHOVEL,
  toolTier: 3,
  miningSpeed: 6.8,
  attackDamage: 4,
  maxDurability: 280,
});
registerItem({
  id: ITEM_IDS.IRON_SWORD,
  name: 'Iron Sword',
  icon: 'iron_sword',
  toolType: TOOL_TYPES.SWORD,
  toolTier: 3,
  miningSpeed: 2.0,
  attackDamage: 7,
  maxDurability: 280,
});

// Diamond Tools (Tier 4)
registerItem({
  id: ITEM_IDS.DIAMOND_PICKAXE,
  name: 'Diamond Pickaxe',
  icon: 'diamond_pickaxe',
  toolType: TOOL_TYPES.PICKAXE,
  toolTier: 4,
  miningSpeed: 10.5,
  attackDamage: 6,
  maxDurability: 900,
});
registerItem({
  id: ITEM_IDS.DIAMOND_AXE,
  name: 'Diamond Axe',
  icon: 'diamond_axe',
  toolType: TOOL_TYPES.AXE,
  toolTier: 4,
  miningSpeed: 10.5,
  attackDamage: 8,
  maxDurability: 900,
});
registerItem({
  id: ITEM_IDS.DIAMOND_SHOVEL,
  name: 'Diamond Shovel',
  icon: 'diamond_shovel',
  toolType: TOOL_TYPES.SHOVEL,
  toolTier: 4,
  miningSpeed: 10.5,
  attackDamage: 5,
  maxDurability: 900,
});
registerItem({
  id: ITEM_IDS.DIAMOND_SWORD,
  name: 'Diamond Sword',
  icon: 'diamond_sword',
  toolType: TOOL_TYPES.SWORD,
  toolTier: 4,
  miningSpeed: 2.5,
  attackDamage: 9,
  maxDurability: 900,
});

// Food
registerItem({
  id: ITEM_IDS.APPLE,
  name: 'Crisp Apple',
  icon: 'apple',
  maxStack: 16,
  food: { hunger: 4, heal: 2 },
});
registerItem({
  id: ITEM_IDS.SWEET_BERRIES,
  name: 'Sweet Berries',
  icon: 'sweet_berries',
  maxStack: 32,
  food: { hunger: 2, heal: 1 },
});
registerItem({
  id: ITEM_IDS.RAW_MEAT,
  name: 'Raw Venison',
  icon: 'raw_meat',
  maxStack: 16,
  food: { hunger: 3, heal: 1 },
});
registerItem({
  id: ITEM_IDS.COOKED_MEAT,
  name: 'Roasted Steak',
  icon: 'cooked_meat',
  maxStack: 16,
  food: { hunger: 8, heal: 5 },
});
registerItem({
  id: ITEM_IDS.BREAD,
  name: 'Country Bread',
  icon: 'bread',
  maxStack: 16,
  food: { hunger: 6, heal: 3 },
});

export function getItemDef(id) {
  return REGISTRY.get(id) || REGISTRY.get(BLOCK_IDS.AIR);
}

export function isAnyPlank(id) {
  return (
    id === BLOCK_IDS.OAK_PLANKS ||
    id === BLOCK_IDS.BIRCH_PLANKS ||
    id === BLOCK_IDS.SPRUCE_PLANKS
  );
}

export function isAnyLog(id) {
  return (
    id === BLOCK_IDS.OAK_LOG ||
    id === BLOCK_IDS.BIRCH_LOG ||
    id === BLOCK_IDS.SPRUCE_LOG
  );
}

export const CREATIVE_PALETTE = [
  BLOCK_IDS.GRASS,
  BLOCK_IDS.DIRT,
  BLOCK_IDS.STONE,
  BLOCK_IDS.COBBLESTONE,
  BLOCK_IDS.STONE_BRICKS,
  BLOCK_IDS.MOSSY_COBBLE,
  BLOCK_IDS.OAK_LOG,
  BLOCK_IDS.OAK_PLANKS,
  BLOCK_IDS.BIRCH_LOG,
  BLOCK_IDS.BIRCH_PLANKS,
  BLOCK_IDS.SPRUCE_LOG,
  BLOCK_IDS.SPRUCE_PLANKS,
  BLOCK_IDS.BRICKS,
  BLOCK_IDS.GLASS,
  BLOCK_IDS.SAND,
  BLOCK_IDS.SANDSTONE,
  BLOCK_IDS.GRAVEL,
  BLOCK_IDS.SNOW,
  BLOCK_IDS.ICE,
  BLOCK_IDS.WOOL,
  BLOCK_IDS.BOOKSHELF,
  BLOCK_IDS.GLOWSTONE,
  BLOCK_IDS.TORCH,
  BLOCK_IDS.CRAFTING_TABLE,
  BLOCK_IDS.FURNACE,
  BLOCK_IDS.CHEST,
  BLOCK_IDS.BED,
  BLOCK_IDS.LADDER,
  BLOCK_IDS.OAK_LEAVES,
  BLOCK_IDS.BIRCH_LEAVES,
  BLOCK_IDS.SPRUCE_LEAVES,
  BLOCK_IDS.CACTUS,
  BLOCK_IDS.RED_FLOWER,
  BLOCK_IDS.YELLOW_FLOWER,
  BLOCK_IDS.BERRY_BUSH,
  BLOCK_IDS.MUSHROOM,
  BLOCK_IDS.REEDS,
  BLOCK_IDS.COAL_ORE,
  BLOCK_IDS.IRON_ORE,
  BLOCK_IDS.GOLD_ORE,
  BLOCK_IDS.DIAMOND_ORE,
  ITEM_IDS.DIAMOND_PICKAXE,
  ITEM_IDS.DIAMOND_AXE,
  ITEM_IDS.DIAMOND_SHOVEL,
  ITEM_IDS.DIAMOND_SWORD,
  ITEM_IDS.COOKED_MEAT,
  ITEM_IDS.APPLE,
];
