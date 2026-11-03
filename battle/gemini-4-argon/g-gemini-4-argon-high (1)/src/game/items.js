// Complete Block, Item, Tool, Food & Crafting Registry

export const TILES = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  SANDSTONE_SIDE: 6,
  SANDSTONE_TOP: 7,

  SNOW: 8,
  SNOW_SIDE: 9,
  ICE: 10,
  WATER: 11,
  BEDROCK: 12,
  GRAVEL: 13,
  MOSSY_COBBLE: 14,
  STONE_BRICKS: 15,

  OAK_SIDE: 16,
  OAK_TOP: 17,
  BIRCH_SIDE: 18,
  SPRUCE_SIDE: 19,
  SPRUCE_TOP: 20,
  OAK_LEAVES: 21,
  BIRCH_LEAVES: 22,
  SPRUCE_LEAVES: 23,

  OAK_PLANKS: 24,
  BIRCH_PLANKS: 25,
  SPRUCE_PLANKS: 26,
  CRAFT_TOP: 27,
  CRAFT_SIDE: 28,
  FURNACE_SIDE: 29,
  FURNACE_FRONT: 30,
  BOOKSHELF: 31,

  GLASS: 32,
  BRICKS: 33,
  WOOL: 34,
  GLOWSTONE: 35,
  LANTERN: 36,
  TORCH: 37,
  LAVA: 38,
  CACTUS_SIDE: 39,

  CACTUS_TOP: 40,
  COAL_ORE: 41,
  IRON_ORE: 42,
  GOLD_ORE: 43,
  DIAMOND_ORE: 44,
  CRYSTAL_ORE: 45,
  TALL_GRASS: 46,
  RED_FLOWER: 47,

  YELLOW_FLOWER: 48,
  DEAD_BUSH: 49,
  MUSHROOM: 50,
  BED_TOP: 51,
  BED_SIDE: 52,
  CRACK_0: 56,
  CRACK_1: 57,
  CRACK_2: 58,
  CRACK_3: 59,
  CRACK_4: 60,
  CRACK_5: 61,
};

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  SANDSTONE: 6,
  GRAVEL: 7,
  SNOW_GRASS: 8,
  SNOW: 9,
  ICE: 10,
  WATER: 11,
  BEDROCK: 12,
  OAK_LOG: 13,
  BIRCH_LOG: 14,
  SPRUCE_LOG: 15,
  OAK_LEAVES: 16,
  BIRCH_LEAVES: 17,
  SPRUCE_LEAVES: 18,
  OAK_PLANKS: 19,
  BIRCH_PLANKS: 20,
  SPRUCE_PLANKS: 21,
  CRAFTING_TABLE: 22,
  FURNACE: 23,
  GLASS: 24,
  BRICKS: 25,
  STONE_BRICKS: 26,
  MOSSY_COBBLESTONE: 27,
  BOOKSHELF: 28,
  WOOL: 29,
  GLOWSTONE: 30,
  LANTERN: 31,
  TORCH: 32,
  COAL_ORE: 33,
  IRON_ORE: 34,
  GOLD_ORE: 35,
  DIAMOND_ORE: 36,
  CRYSTAL_ORE: 37,
  CACTUS: 38,
  TALL_GRASS: 39,
  RED_FLOWER: 40,
  YELLOW_FLOWER: 41,
  DEAD_BUSH: 42,
  MUSHROOM: 43,
  LAVA: 44,
  BED: 45,
};

export const ITEM = {
  STICK: 101,
  COAL: 102,
  RAW_IRON: 103,
  IRON_INGOT: 104,
  RAW_GOLD: 105,
  GOLD_INGOT: 106,
  DIAMOND: 107,
  CRYSTAL_SHARD: 108,

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

  EMPTY_BUCKET: 150,
  WATER_BUCKET: 151,

  APPLE: 160,
  RAW_MEAT: 161,
  COOKED_MEAT: 162,
  MUSHROOM_STEW: 163,
};

// Registry indexed by numeric ID
export const REGISTRY = {};

function defBlock(id, cfg) {
  const faces = cfg.faces || {
    top: cfg.tile,
    bottom: cfg.tile,
    north: cfg.tile,
    south: cfg.tile,
    east: cfg.tile,
    west: cfg.tile,
  };
  REGISTRY[id] = {
    id,
    isBlock: true,
    name: cfg.name,
    faces: {
      top: faces.top ?? cfg.tile,
      bottom: faces.bottom ?? faces.top ?? cfg.tile,
      north: faces.north ?? faces.side ?? cfg.tile,
      south: faces.south ?? faces.side ?? cfg.tile,
      east: faces.east ?? faces.side ?? cfg.tile,
      west: faces.west ?? faces.front ?? faces.side ?? cfg.tile,
    },
    hardness: cfg.hardness ?? 1.0,
    unbreakable: Boolean(cfg.unbreakable),
    tool: cfg.tool || null, // 'pickaxe' | 'axe' | 'shovel'
    minTier: cfg.minTier || 0,
    drop: cfg.drop !== undefined ? cfg.drop : id,
    dropCount: cfg.dropCount || 1,
    sound: cfg.sound || 'stone',
    light: cfg.light || 0,
    renderType: cfg.renderType || 'cube', // 'cube' | 'cross' | 'torch' | 'liquid'
    opaque: cfg.opaque !== undefined ? cfg.opaque : true,
    solid: cfg.solid !== undefined ? cfg.solid : true,
    translucent: Boolean(cfg.translucent),
    alphaTest: Boolean(cfg.alphaTest),
    liquid: Boolean(cfg.liquid),
    selectable: cfg.selectable !== undefined ? cfg.selectable : true,
    replaceable: Boolean(cfg.replaceable),
    interactive: cfg.interactive || null,
    contactDamage: cfg.contactDamage || 0,
    maxStack: 64,
    tags: cfg.tags || [],
    particleColor: cfg.particleColor || '#888888',
  };
}

function defItem(id, cfg) {
  REGISTRY[id] = {
    id,
    isBlock: false,
    name: cfg.name,
    iconType: cfg.iconType,
    iconColor: cfg.iconColor || '#cccccc',
    iconAccent: cfg.iconAccent || '#6b4c30',
    maxStack: cfg.maxStack || 64,
    toolType: cfg.toolType || null,
    tier: cfg.tier || 0,
    speed: cfg.speed || 1.0,
    damage: cfg.damage || 1,
    durability: cfg.durability || 0,
    heal: cfg.heal || 0,
    bucketLiquid: cfg.bucketLiquid ?? null,
    tags: cfg.tags || [],
  };
}

// --- Define Blocks ---
REGISTRY[BLOCK.AIR] = {
  id: 0,
  isBlock: true,
  name: 'Air',
  opaque: false,
  solid: false,
  selectable: false,
  replaceable: true,
  light: 0,
};

defBlock(BLOCK.GRASS, {
  name: 'Grass Block',
  faces: { top: TILES.GRASS_TOP, bottom: TILES.DIRT, side: TILES.GRASS_SIDE },
  hardness: 0.65,
  tool: 'shovel',
  drop: BLOCK.DIRT,
  sound: 'grass',
  particleColor: '#5ca935',
});

defBlock(BLOCK.DIRT, {
  name: 'Dirt',
  tile: TILES.DIRT,
  hardness: 0.55,
  tool: 'shovel',
  sound: 'gravel',
  particleColor: '#7a5234',
});

defBlock(BLOCK.STONE, {
  name: 'Stone',
  tile: TILES.STONE,
  hardness: 1.6,
  tool: 'pickaxe',
  minTier: 1,
  drop: BLOCK.COBBLESTONE,
  sound: 'stone',
  particleColor: '#84888c',
});

defBlock(BLOCK.COBBLESTONE, {
  name: 'Cobblestone',
  tile: TILES.COBBLESTONE,
  hardness: 1.9,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  tags: ['stone_craft'],
  particleColor: '#73767a',
});

defBlock(BLOCK.SAND, {
  name: 'Sand',
  tile: TILES.SAND,
  hardness: 0.55,
  tool: 'shovel',
  sound: 'sand',
  particleColor: '#dfd199',
});

defBlock(BLOCK.SANDSTONE, {
  name: 'Sandstone',
  faces: { top: TILES.SANDSTONE_TOP, bottom: TILES.SANDSTONE_TOP, side: TILES.SANDSTONE_SIDE },
  hardness: 1.2,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  particleColor: '#d7c587',
});

defBlock(BLOCK.GRAVEL, {
  name: 'Gravel',
  tile: TILES.GRAVEL,
  hardness: 0.65,
  tool: 'shovel',
  sound: 'gravel',
  particleColor: '#8d8885',
});

defBlock(BLOCK.SNOW_GRASS, {
  name: 'Snowy Grass',
  faces: { top: TILES.SNOW, bottom: TILES.DIRT, side: TILES.SNOW_SIDE },
  hardness: 0.65,
  tool: 'shovel',
  drop: BLOCK.DIRT,
  sound: 'snow',
  particleColor: '#eef6fb',
});

defBlock(BLOCK.SNOW, {
  name: 'Snow Block',
  tile: TILES.SNOW,
  hardness: 0.4,
  tool: 'shovel',
  sound: 'snow',
  particleColor: '#f3f8fc',
});

defBlock(BLOCK.ICE, {
  name: 'Ice',
  tile: TILES.ICE,
  hardness: 0.6,
  tool: 'pickaxe',
  opaque: false,
  translucent: true,
  sound: 'glass',
  particleColor: '#90c7f5',
});

defBlock(BLOCK.WATER, {
  name: 'Water',
  tile: TILES.WATER,
  renderType: 'liquid',
  opaque: false,
  solid: false,
  translucent: true,
  liquid: true,
  selectable: false,
  replaceable: true,
  drop: null,
  sound: 'water',
  particleColor: '#2f7df0',
});

defBlock(BLOCK.BEDROCK, {
  name: 'Bedrock',
  tile: TILES.BEDROCK,
  unbreakable: true,
  hardness: 999,
  sound: 'stone',
  particleColor: '#3a3a3e',
});

defBlock(BLOCK.OAK_LOG, {
  name: 'Oak Log',
  faces: { top: TILES.OAK_TOP, bottom: TILES.OAK_TOP, side: TILES.OAK_SIDE },
  hardness: 1.5,
  tool: 'axe',
  sound: 'wood',
  tags: ['log'],
  particleColor: '#6f5232',
});

defBlock(BLOCK.BIRCH_LOG, {
  name: 'Birch Log',
  faces: { top: TILES.OAK_TOP, bottom: TILES.OAK_TOP, side: TILES.BIRCH_SIDE },
  hardness: 1.5,
  tool: 'axe',
  sound: 'wood',
  tags: ['log'],
  particleColor: '#d9d4c7',
});

defBlock(BLOCK.SPRUCE_LOG, {
  name: 'Spruce Log',
  faces: { top: TILES.SPRUCE_TOP, bottom: TILES.SPRUCE_TOP, side: TILES.SPRUCE_SIDE },
  hardness: 1.5,
  tool: 'axe',
  sound: 'wood',
  tags: ['log'],
  particleColor: '#4a3520',
});

defBlock(BLOCK.OAK_LEAVES, {
  name: 'Oak Leaves',
  tile: TILES.OAK_LEAVES,
  hardness: 0.25,
  opaque: false,
  alphaTest: true,
  sound: 'grass',
  particleColor: '#3d8b29',
});

defBlock(BLOCK.BIRCH_LEAVES, {
  name: 'Birch Leaves',
  tile: TILES.BIRCH_LEAVES,
  hardness: 0.25,
  opaque: false,
  alphaTest: true,
  sound: 'grass',
  particleColor: '#6aa443',
});

defBlock(BLOCK.SPRUCE_LEAVES, {
  name: 'Spruce Needles',
  tile: TILES.SPRUCE_LEAVES,
  hardness: 0.25,
  opaque: false,
  alphaTest: true,
  sound: 'grass',
  particleColor: '#2c6236',
});

defBlock(BLOCK.OAK_PLANKS, {
  name: 'Oak Planks',
  tile: TILES.OAK_PLANKS,
  hardness: 1.4,
  tool: 'axe',
  sound: 'wood',
  tags: ['planks'],
  particleColor: '#b08954',
});

defBlock(BLOCK.BIRCH_PLANKS, {
  name: 'Birch Planks',
  tile: TILES.BIRCH_PLANKS,
  hardness: 1.4,
  tool: 'axe',
  sound: 'wood',
  tags: ['planks'],
  particleColor: '#d4c392',
});

defBlock(BLOCK.SPRUCE_PLANKS, {
  name: 'Spruce Planks',
  tile: TILES.SPRUCE_PLANKS,
  hardness: 1.4,
  tool: 'axe',
  sound: 'wood',
  tags: ['planks'],
  particleColor: '#7a5835',
});

defBlock(BLOCK.CRAFTING_TABLE, {
  name: 'Crafting Table',
  faces: { top: TILES.CRAFT_TOP, bottom: TILES.OAK_PLANKS, side: TILES.CRAFT_SIDE },
  hardness: 1.6,
  tool: 'axe',
  sound: 'wood',
  interactive: 'crafting',
  particleColor: '#9c7142',
});

defBlock(BLOCK.FURNACE, {
  name: 'Furnace',
  faces: {
    top: TILES.STONE,
    bottom: TILES.STONE,
    north: TILES.FURNACE_FRONT,
    south: TILES.FURNACE_SIDE,
    east: TILES.FURNACE_SIDE,
    west: TILES.FURNACE_SIDE,
  },
  hardness: 2.2,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  interactive: 'smelting',
  particleColor: '#6f7276',
});

defBlock(BLOCK.GLASS, {
  name: 'Glass',
  tile: TILES.GLASS,
  hardness: 0.35,
  opaque: false,
  alphaTest: true,
  drop: BLOCK.GLASS,
  sound: 'glass',
  particleColor: '#d8f3fc',
});

defBlock(BLOCK.BRICKS, {
  name: 'Brick Block',
  tile: TILES.BRICKS,
  hardness: 2.0,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  particleColor: '#a64d3d',
});

defBlock(BLOCK.STONE_BRICKS, {
  name: 'Stone Bricks',
  tile: TILES.STONE_BRICKS,
  hardness: 1.8,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  particleColor: '#7d8084',
});

defBlock(BLOCK.MOSSY_COBBLESTONE, {
  name: 'Mossy Cobblestone',
  tile: TILES.MOSSY_COBBLE,
  hardness: 1.8,
  tool: 'pickaxe',
  minTier: 1,
  sound: 'stone',
  tags: ['stone_craft'],
  particleColor: '#59744d',
});

defBlock(BLOCK.BOOKSHELF, {
  name: 'Bookshelf',
  faces: { top: TILES.OAK_PLANKS, bottom: TILES.OAK_PLANKS, side: TILES.BOOKSHELF },
  hardness: 1.3,
  tool: 'axe',
  sound: 'wood',
  particleColor: '#9b7444',
});

defBlock(BLOCK.WOOL, {
  name: 'Soft Wool',
  tile: TILES.WOOL,
  hardness: 0.6,
  sound: 'snow',
  particleColor: '#f0efe9',
});

defBlock(BLOCK.GLOWSTONE, {
  name: 'Sunstone Lamp',
  tile: TILES.GLOWSTONE,
  hardness: 0.5,
  light: 15,
  sound: 'glass',
  particleColor: '#ffda66',
});

defBlock(BLOCK.LANTERN, {
  name: 'Iron Lantern',
  tile: TILES.LANTERN,
  hardness: 0.8,
  tool: 'pickaxe',
  light: 15,
  sound: 'stone',
  particleColor: '#ffbe44',
});

defBlock(BLOCK.TORCH, {
  name: 'Torch',
  tile: TILES.TORCH,
  renderType: 'torch',
  hardness: 0.05,
  opaque: false,
  solid: false,
  alphaTest: true,
  light: 14,
  sound: 'wood',
  particleColor: '#ffae34',
});

defBlock(BLOCK.COAL_ORE, {
  name: 'Coal Ore',
  tile: TILES.COAL_ORE,
  hardness: 2.1,
  tool: 'pickaxe',
  minTier: 1,
  drop: ITEM.COAL,
  sound: 'stone',
  particleColor: '#3a3d40',
});

defBlock(BLOCK.IRON_ORE, {
  name: 'Iron Ore',
  tile: TILES.IRON_ORE,
  hardness: 2.6,
  tool: 'pickaxe',
  minTier: 2,
  drop: ITEM.RAW_IRON,
  sound: 'stone',
  particleColor: '#c99e7e',
});

defBlock(BLOCK.GOLD_ORE, {
  name: 'Gold Ore',
  tile: TILES.GOLD_ORE,
  hardness: 2.8,
  tool: 'pickaxe',
  minTier: 3,
  drop: ITEM.RAW_GOLD,
  sound: 'stone',
  particleColor: '#f5cf47',
});

defBlock(BLOCK.DIAMOND_ORE, {
  name: 'Diamond Ore',
  tile: TILES.DIAMOND_ORE,
  hardness: 3.3,
  tool: 'pickaxe',
  minTier: 3,
  drop: ITEM.DIAMOND,
  sound: 'stone',
  particleColor: '#56e8df',
});

defBlock(BLOCK.CRYSTAL_ORE, {
  name: 'Luminite Crystal Ore',
  tile: TILES.CRYSTAL_ORE,
  hardness: 2.3,
  tool: 'pickaxe',
  minTier: 2,
  drop: ITEM.CRYSTAL_SHARD,
  dropCount: 2,
  light: 9,
  sound: 'glass',
  particleColor: '#a66cff',
});

defBlock(BLOCK.CACTUS, {
  name: 'Cactus',
  faces: { top: TILES.CACTUS_TOP, bottom: TILES.CACTUS_TOP, side: TILES.CACTUS_SIDE },
  hardness: 0.45,
  contactDamage: 1,
  sound: 'grass',
  particleColor: '#338832',
});

defBlock(BLOCK.TALL_GRASS, {
  name: 'Tall Grass',
  tile: TILES.TALL_GRASS,
  renderType: 'cross',
  hardness: 0.02,
  opaque: false,
  solid: false,
  alphaTest: true,
  replaceable: true,
  drop: null,
  sound: 'grass',
  particleColor: '#58a832',
});

defBlock(BLOCK.RED_FLOWER, {
  name: 'Crimson Poppy',
  tile: TILES.RED_FLOWER,
  renderType: 'cross',
  hardness: 0.02,
  opaque: false,
  solid: false,
  alphaTest: true,
  sound: 'grass',
  particleColor: '#e03b3b',
});

defBlock(BLOCK.YELLOW_FLOWER, {
  name: 'Sun Dandelion',
  tile: TILES.YELLOW_FLOWER,
  renderType: 'cross',
  hardness: 0.02,
  opaque: false,
  solid: false,
  alphaTest: true,
  sound: 'grass',
  particleColor: '#f5d436',
});

defBlock(BLOCK.DEAD_BUSH, {
  name: 'Desert Shrub',
  tile: TILES.DEAD_BUSH,
  renderType: 'cross',
  hardness: 0.02,
  opaque: false,
  solid: false,
  alphaTest: true,
  drop: ITEM.STICK,
  sound: 'grass',
  particleColor: '#8d683b',
});

defBlock(BLOCK.MUSHROOM, {
  name: 'Glow Cap Mushroom',
  tile: TILES.MUSHROOM,
  renderType: 'cross',
  hardness: 0.02,
  opaque: false,
  solid: false,
  alphaTest: true,
  light: 4,
  sound: 'grass',
  particleColor: '#d45a4a',
});

defBlock(BLOCK.LAVA, {
  name: 'Lava',
  tile: TILES.LAVA,
  renderType: 'liquid',
  opaque: false,
  solid: false,
  liquid: true,
  selectable: false,
  replaceable: true,
  light: 15,
  contactDamage: 4,
  drop: null,
  sound: 'water',
  particleColor: '#ff5d17',
});

// --- Define Materials, Tools, Utility & Food ---
defItem(ITEM.STICK, { name: 'Wooden Stick', iconType: 'stick', iconColor: '#8e6539' });
defItem(ITEM.COAL, { name: 'Coal', iconType: 'gem', iconColor: '#2d3136', iconAccent: '#525861' });
defItem(ITEM.RAW_IRON, { name: 'Raw Iron', iconType: 'ore_chunk', iconColor: '#d2a684', iconAccent: '#8f694d' });
defItem(ITEM.IRON_INGOT, { name: 'Iron Ingot', iconType: 'ingot', iconColor: '#dfe5eb', iconAccent: '#99a3ad' });
defItem(ITEM.RAW_GOLD, { name: 'Raw Gold', iconType: 'ore_chunk', iconColor: '#f7d147', iconAccent: '#b88614' });
defItem(ITEM.GOLD_INGOT, { name: 'Gold Ingot', iconType: 'ingot', iconColor: '#ffe052', iconAccent: '#cc9714' });
defItem(ITEM.DIAMOND, { name: 'Diamond', iconType: 'diamond', iconColor: '#55f2e8', iconAccent: '#1ca8b8' });
defItem(ITEM.CRYSTAL_SHARD, { name: 'Luminite Shard', iconType: 'crystal', iconColor: '#b77bff', iconAccent: '#6f32cc' });

// Tool tiers: Wood (1), Stone (2), Iron (3), Diamond (4)
const TIER_DEFS = [
  { prefix: 'WOOD', label: 'Wooden', tier: 1, speed: 2.5, dur: 65, color: '#ad804b', dmgBase: 3 },
  { prefix: 'STONE', label: 'Stone', tier: 2, speed: 4.4, dur: 140, color: '#8f9499', dmgBase: 4 },
  { prefix: 'IRON', label: 'Iron', tier: 3, speed: 6.8, dur: 260, color: '#dce3ea', dmgBase: 5 },
  { prefix: 'DIAMOND', label: 'Diamond', tier: 4, speed: 10.0, dur: 900, color: '#4eeddf', dmgBase: 7 },
];

for (const t of TIER_DEFS) {
  defItem(ITEM[`${t.prefix}_PICKAXE`], {
    name: `${t.label} Pickaxe`,
    iconType: 'pickaxe',
    iconColor: t.color,
    maxStack: 1,
    toolType: 'pickaxe',
    tier: t.tier,
    speed: t.speed,
    damage: t.dmgBase,
    durability: t.dur,
  });
  defItem(ITEM[`${t.prefix}_AXE`], {
    name: `${t.label} Axe`,
    iconType: 'axe',
    iconColor: t.color,
    maxStack: 1,
    toolType: 'axe',
    tier: t.tier,
    speed: t.speed,
    damage: t.dmgBase + 1,
    durability: t.dur,
  });
  defItem(ITEM[`${t.prefix}_SHOVEL`], {
    name: `${t.label} Shovel`,
    iconType: 'shovel',
    iconColor: t.color,
    maxStack: 1,
    toolType: 'shovel',
    tier: t.tier,
    speed: t.speed,
    damage: t.dmgBase - 1,
    durability: t.dur,
  });
  defItem(ITEM[`${t.prefix}_SWORD`], {
    name: `${t.label} Sword`,
    iconType: 'sword',
    iconColor: t.color,
    maxStack: 1,
    toolType: 'sword',
    tier: t.tier,
    speed: 1.6,
    damage: t.dmgBase + 2,
    durability: t.dur,
  });
}

defItem(ITEM.EMPTY_BUCKET, {
  name: 'Iron Bucket',
  iconType: 'bucket',
  iconColor: '#cfd8e0',
  maxStack: 1,
  bucketLiquid: 0,
});

defItem(ITEM.WATER_BUCKET, {
  name: 'Water Bucket',
  iconType: 'water_bucket',
  iconColor: '#3385ff',
  maxStack: 1,
  bucketLiquid: BLOCK.WATER,
});

defItem(ITEM.APPLE, {
  name: 'Crisp Apple',
  iconType: 'apple',
  iconColor: '#e53935',
  heal: 4,
});

defItem(ITEM.RAW_MEAT, {
  name: 'Raw Venison',
  iconType: 'meat',
  iconColor: '#e27474',
  heal: 3,
});

defItem(ITEM.COOKED_MEAT, {
  name: 'Roasted Steak',
  iconType: 'meat',
  iconColor: '#9c4f2b',
  heal: 8,
});

defBlock(BLOCK.BED, {
  name: 'Cozy Bed',
  faces: { top: TILES.BED_TOP, bottom: TILES.OAK_PLANKS, side: TILES.BED_SIDE },
  hardness: 0.7,
  tool: 'axe',
  sound: 'wood',
  interactive: 'bed',
  particleColor: '#c93838',
});

ITEM.GOLDEN_APPLE = 164;

defItem(ITEM.MUSHROOM_STEW, {
  name: 'Glow-Cap Stew',
  iconType: 'stew',
  iconColor: '#cf6a4c',
  maxStack: 16,
  heal: 8,
});

defItem(ITEM.GOLDEN_APPLE, {
  name: 'Golden Apple',
  iconType: 'apple',
  iconColor: '#ffd43b',
  maxStack: 16,
  heal: 20,
});

// Categorized Crafting & Smelting Recipes
// Ingredients support either { id, count } OR { tag, label, sampleId, count }
export const RECIPES = [
  // --- BASICS (craftable anywhere!) ---
  {
    id: 'oak_planks',
    category: 'basics',
    station: null,
    output: { id: BLOCK.OAK_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.OAK_LOG, count: 1 }],
  },
  {
    id: 'birch_planks',
    category: 'basics',
    station: null,
    output: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.BIRCH_LOG, count: 1 }],
  },
  {
    id: 'spruce_planks',
    category: 'basics',
    station: null,
    output: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    ingredients: [{ id: BLOCK.SPRUCE_LOG, count: 1 }],
  },
  {
    id: 'sticks',
    category: 'basics',
    station: null,
    output: { id: ITEM.STICK, count: 4 },
    ingredients: [{ tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 2 }],
  },
  {
    id: 'crafting_table',
    category: 'basics',
    station: null,
    output: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    ingredients: [{ tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 4 }],
  },
  {
    id: 'torches_coal',
    category: 'light',
    station: null,
    output: { id: BLOCK.TORCH, count: 4 },
    ingredients: [
      { id: ITEM.COAL, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
  },
  {
    id: 'torches_crystal',
    category: 'light',
    station: null,
    output: { id: BLOCK.TORCH, count: 6 },
    ingredients: [
      { id: ITEM.CRYSTAL_SHARD, count: 1 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // --- TOOLS & WEAPONS (Crafting Table) ---
  {
    id: 'wood_pickaxe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.WOOD_PICKAXE, count: 1 },
    ingredients: [
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_axe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.WOOD_AXE, count: 1 },
    ingredients: [
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_shovel',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.WOOD_SHOVEL, count: 1 },
    ingredients: [
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.WOOD_SWORD, count: 1 },
    ingredients: [
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  {
    id: 'stone_pickaxe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.STONE_PICKAXE, count: 1 },
    ingredients: [
      { tag: 'stone_craft', label: 'Cobblestone', sampleId: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_axe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.STONE_AXE, count: 1 },
    ingredients: [
      { tag: 'stone_craft', label: 'Cobblestone', sampleId: BLOCK.COBBLESTONE, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_shovel',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.STONE_SHOVEL, count: 1 },
    ingredients: [
      { tag: 'stone_craft', label: 'Cobblestone', sampleId: BLOCK.COBBLESTONE, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.STONE_SWORD, count: 1 },
    ingredients: [
      { tag: 'stone_craft', label: 'Cobblestone', sampleId: BLOCK.COBBLESTONE, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  {
    id: 'iron_pickaxe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.IRON_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_axe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.IRON_AXE, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_shovel',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.IRON_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'iron_sword',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.IRON_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },
  {
    id: 'bucket',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.EMPTY_BUCKET, count: 1 },
    ingredients: [{ id: ITEM.IRON_INGOT, count: 3 }],
  },

  {
    id: 'diamond_pickaxe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_axe',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.DIAMOND_AXE, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 3 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_shovel',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.DIAMOND_SHOVEL, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 1 },
      { id: ITEM.STICK, count: 2 },
    ],
  },
  {
    id: 'diamond_sword',
    category: 'tools',
    station: 'crafting',
    output: { id: ITEM.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { id: ITEM.DIAMOND, count: 2 },
      { id: ITEM.STICK, count: 1 },
    ],
  },

  // --- BUILDING & STATIONS ---
  {
    id: 'furnace',
    category: 'basics',
    station: 'crafting',
    output: { id: BLOCK.FURNACE, count: 1 },
    ingredients: [{ tag: 'stone_craft', label: 'Cobblestone', sampleId: BLOCK.COBBLESTONE, count: 8 }],
  },
  {
    id: 'stone_bricks',
    category: 'building',
    station: null,
    output: { id: BLOCK.STONE_BRICKS, count: 4 },
    ingredients: [{ id: BLOCK.STONE, count: 4 }],
  },
  {
    id: 'sandstone',
    category: 'building',
    station: null,
    output: { id: BLOCK.SANDSTONE, count: 1 },
    ingredients: [{ id: BLOCK.SAND, count: 4 }],
  },
  {
    id: 'bricks',
    category: 'building',
    station: 'crafting',
    output: { id: BLOCK.BRICKS, count: 4 },
    ingredients: [
      { id: BLOCK.STONE, count: 2 },
      { id: BLOCK.DIRT, count: 2 },
    ],
  },
  {
    id: 'bookshelf',
    category: 'building',
    station: 'crafting',
    output: { id: BLOCK.BOOKSHELF, count: 1 },
    ingredients: [
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 6 },
      { id: BLOCK.WOOL, count: 1 },
    ],
  },
  {
    id: 'glowstone',
    category: 'light',
    station: null,
    output: { id: BLOCK.GLOWSTONE, count: 1 },
    ingredients: [{ id: ITEM.CRYSTAL_SHARD, count: 4 }],
  },
  {
    id: 'lantern',
    category: 'light',
    station: 'crafting',
    output: { id: BLOCK.LANTERN, count: 2 },
    ingredients: [
      { id: ITEM.IRON_INGOT, count: 1 },
      { id: BLOCK.TORCH, count: 1 },
    ],
  },
  {
    id: 'cozy_bed',
    category: 'basics',
    station: 'crafting',
    output: { id: BLOCK.BED, count: 1 },
    ingredients: [
      { id: BLOCK.WOOL, count: 3 },
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 3 },
    ],
  },
  {
    id: 'golden_apple',
    category: 'basics',
    station: 'crafting',
    output: { id: ITEM.GOLDEN_APPLE, count: 1 },
    ingredients: [
      { id: ITEM.APPLE, count: 1 },
      { id: ITEM.GOLD_INGOT, count: 2 },
    ],
  },
  {
    id: 'gold_sunstone',
    category: 'light',
    station: 'crafting',
    output: { id: BLOCK.GLOWSTONE, count: 2 },
    ingredients: [
      { id: ITEM.GOLD_INGOT, count: 1 },
      { id: BLOCK.TORCH, count: 2 },
    ],
  },
  {
    id: 'mushroom_stew',
    category: 'basics',
    station: null,
    output: { id: ITEM.MUSHROOM_STEW, count: 1 },
    ingredients: [
      { id: BLOCK.MUSHROOM, count: 2 },
      { tag: 'planks', label: 'Any Planks', sampleId: BLOCK.OAK_PLANKS, count: 1 },
    ],
  },

  // --- SMELTING (Furnace) ---
  {
    id: 'smelt_iron',
    category: 'smelting',
    station: 'smelting',
    output: { id: ITEM.IRON_INGOT, count: 1 },
    ingredients: [
      { id: ITEM.RAW_IRON, count: 1 },
      { id: ITEM.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_gold',
    category: 'smelting',
    station: 'smelting',
    output: { id: ITEM.GOLD_INGOT, count: 1 },
    ingredients: [
      { id: ITEM.RAW_GOLD, count: 1 },
      { id: ITEM.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_glass',
    category: 'smelting',
    station: 'smelting',
    output: { id: BLOCK.GLASS, count: 2 },
    ingredients: [
      { id: BLOCK.SAND, count: 2 },
      { id: ITEM.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_stone',
    category: 'smelting',
    station: 'smelting',
    output: { id: BLOCK.STONE, count: 2 },
    ingredients: [
      { id: BLOCK.COBBLESTONE, count: 2 },
      { id: ITEM.COAL, count: 1 },
    ],
  },
  {
    id: 'cook_meat',
    category: 'smelting',
    station: 'smelting',
    output: { id: ITEM.COOKED_MEAT, count: 1 },
    ingredients: [{ id: ITEM.RAW_MEAT, count: 1 }],
  },
  {
    id: 'charcoal',
    category: 'smelting',
    station: 'smelting',
    output: { id: ITEM.COAL, count: 1 },
    ingredients: [{ tag: 'log', label: 'Any Wood Log', sampleId: BLOCK.OAK_LOG, count: 1 }],
  },
];

// Ordered list of blocks & items available in Creative Palette
export const CREATIVE_PALETTE = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.STONE_BRICKS,
  BLOCK.MOSSY_COBBLESTONE, BLOCK.BRICKS, BLOCK.SAND, BLOCK.SANDSTONE, BLOCK.GRAVEL,
  BLOCK.SNOW_GRASS, BLOCK.SNOW, BLOCK.ICE, BLOCK.GLASS, BLOCK.WOOL,
  BLOCK.OAK_LOG, BLOCK.OAK_PLANKS, BLOCK.BIRCH_LOG, BLOCK.BIRCH_PLANKS,
  BLOCK.SPRUCE_LOG, BLOCK.SPRUCE_PLANKS, BLOCK.OAK_LEAVES, BLOCK.BIRCH_LEAVES, BLOCK.SPRUCE_LEAVES,
  BLOCK.CRAFTING_TABLE, BLOCK.FURNACE, BLOCK.BED, BLOCK.BOOKSHELF, BLOCK.TORCH, BLOCK.LANTERN, BLOCK.GLOWSTONE,
  BLOCK.RED_FLOWER, BLOCK.YELLOW_FLOWER, BLOCK.MUSHROOM, BLOCK.TALL_GRASS, BLOCK.CACTUS, BLOCK.DEAD_BUSH,
  BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.GOLD_ORE, BLOCK.DIAMOND_ORE, BLOCK.CRYSTAL_ORE,
  ITEM.WATER_BUCKET, ITEM.EMPTY_BUCKET, ITEM.DIAMOND_PICKAXE, ITEM.DIAMOND_AXE, ITEM.DIAMOND_SHOVEL, ITEM.DIAMOND_SWORD,
  ITEM.APPLE, ITEM.GOLDEN_APPLE, ITEM.COOKED_MEAT, ITEM.MUSHROOM_STEW,
];

export function getDef(id) {
  return REGISTRY[id] || REGISTRY[0];
}
