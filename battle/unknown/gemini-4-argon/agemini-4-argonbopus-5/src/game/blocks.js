export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  BEDROCK: 5,
  SAND: 6,
  SANDSTONE: 7,
  GRAVEL: 8,
  SNOW_GRASS: 9,
  SNOW: 10,
  ICE: 11,
  CLAY: 12,
  COAL_ORE: 13,
  IRON_ORE: 14,
  GOLD_ORE: 15,
  DIAMOND_ORE: 16,
  CRYSTAL_ORE: 17,
  OAK_LOG: 18,
  OAK_LEAVES: 19,
  SPRUCE_LOG: 20,
  SPRUCE_LEAVES: 21,
  BIRCH_LOG: 22,
  BIRCH_LEAVES: 23,
  CACTUS: 24,
  TALL_GRASS: 25,
  RED_FLOWER: 26,
  YELLOW_FLOWER: 27,
  GLOW_SHROOM: 28,
  WATER: 29,
  LAVA: 30,
  OAK_PLANKS: 31,
  SPRUCE_PLANKS: 32,
  BIRCH_PLANKS: 33,
  CRAFTING_TABLE: 34,
  FURNACE: 35,
  TORCH: 36,
  LANTERN: 37,
  GLASS: 38,
  BRICKS: 39,
  STONE_BRICKS: 40,
  BED: 41,
  WOOL_BLOCK: 42,
  BOOKSHELF: 43,
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
  CLAY_BALL: 109,
  BRICK_ITEM: 110,
  FLINT: 111,

  WOOD_PICKAXE: 120,
  STONE_PICKAXE: 121,
  IRON_PICKAXE: 122,
  DIAMOND_PICKAXE: 123,

  WOOD_AXE: 124,
  STONE_AXE: 125,
  IRON_AXE: 126,
  DIAMOND_AXE: 127,

  WOOD_SHOVEL: 128,
  STONE_SHOVEL: 129,
  IRON_SHOVEL: 130,

  WOOD_SWORD: 131,
  STONE_SWORD: 132,
  IRON_SWORD: 133,
  DIAMOND_SWORD: 134,

  APPLE: 140,
  RAW_MEAT: 141,
  COOKED_MEAT: 142,
  BREAD: 143,
};

export const REGISTRY = {};

function regBlock(id, def) {
  REGISTRY[id] = {
    id,
    isBlock: true,
    maxStack: def.maxStack ?? 64,
    solid: def.solid ?? true,
    opaque: def.opaque ?? true,
    alphaTest: def.alphaTest ?? false,
    translucent: def.translucent ?? false,
    renderType: def.renderType ?? 'cube',
    light: def.light ?? 0,
    lightOpacity: def.lightOpacity ?? (def.opaque === false ? 1 : 15),
    hardness: def.hardness ?? 1.0,
    preferredTool: def.preferredTool ?? null,
    minTier: def.minTier ?? 0,
    soundGroup: def.soundGroup ?? 'stone',
    tintType: def.tintType ?? null,
    fuelValue: def.fuelValue ?? 0,
    ...def,
  };
}

function regItem(id, def) {
  REGISTRY[id] = {
    id,
    isBlock: false,
    maxStack: def.toolType ? 1 : (def.maxStack ?? 64),
    fuelValue: def.fuelValue ?? 0,
    ...def,
  };
}

// --- BLOCKS ---
regBlock(BLOCK.AIR, {
  name: 'Air',
  solid: false,
  opaque: false,
  lightOpacity: 0,
  hardness: 0,
});

regBlock(BLOCK.GRASS, {
  name: 'Grass Block',
  hardness: 0.65,
  preferredTool: 'shovel',
  soundGroup: 'grass',
  tintType: 'grass_top',
  textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  drop: BLOCK.DIRT,
});

regBlock(BLOCK.DIRT, {
  name: 'Dirt',
  hardness: 0.55,
  preferredTool: 'shovel',
  soundGroup: 'grass',
  textures: { all: 'dirt' },
});

regBlock(BLOCK.STONE, {
  name: 'Stone',
  hardness: 1.7,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { all: 'stone' },
  drop: BLOCK.COBBLESTONE,
});

regBlock(BLOCK.COBBLESTONE, {
  name: 'Cobblestone',
  hardness: 1.9,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { all: 'cobblestone' },
});

regBlock(BLOCK.BEDROCK, {
  name: 'Bedrock',
  hardness: Infinity,
  soundGroup: 'stone',
  textures: { all: 'bedrock' },
});

regBlock(BLOCK.SAND, {
  name: 'Sand',
  hardness: 0.55,
  preferredTool: 'shovel',
  soundGroup: 'sand',
  textures: { all: 'sand' },
});

regBlock(BLOCK.SANDSTONE, {
  name: 'Sandstone',
  hardness: 1.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
});

regBlock(BLOCK.GRAVEL, {
  name: 'Gravel',
  hardness: 0.65,
  preferredTool: 'shovel',
  soundGroup: 'sand',
  textures: { all: 'gravel' },
});

regBlock(BLOCK.SNOW_GRASS, {
  name: 'Snowy Grass',
  hardness: 0.65,
  preferredTool: 'shovel',
  soundGroup: 'grass',
  textures: { top: 'snow', bottom: 'dirt', side: 'snow_grass_side' },
  drop: BLOCK.DIRT,
});

regBlock(BLOCK.SNOW, {
  name: 'Snow Block',
  hardness: 0.4,
  preferredTool: 'shovel',
  soundGroup: 'sand',
  textures: { all: 'snow' },
});

regBlock(BLOCK.ICE, {
  name: 'Alpine Ice',
  hardness: 0.6,
  preferredTool: 'pickaxe',
  opaque: false,
  translucent: true,
  lightOpacity: 2,
  soundGroup: 'glass',
  textures: { all: 'ice' },
});

regBlock(BLOCK.CLAY, {
  name: 'River Clay',
  hardness: 0.65,
  preferredTool: 'shovel',
  soundGroup: 'sand',
  textures: { all: 'clay' },
  drop: ITEM.CLAY_BALL,
  dropCount: 4,
});

regBlock(BLOCK.COAL_ORE, {
  name: 'Coal Ore',
  hardness: 2.3,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { all: 'coal_ore' },
  drop: ITEM.COAL,
});

regBlock(BLOCK.IRON_ORE, {
  name: 'Iron Ore',
  hardness: 2.7,
  preferredTool: 'pickaxe',
  minTier: 2,
  soundGroup: 'stone',
  textures: { all: 'iron_ore' },
  drop: ITEM.RAW_IRON,
});

regBlock(BLOCK.GOLD_ORE, {
  name: 'Gold Ore',
  hardness: 3.0,
  preferredTool: 'pickaxe',
  minTier: 3,
  soundGroup: 'stone',
  textures: { all: 'gold_ore' },
  drop: ITEM.RAW_GOLD,
});

regBlock(BLOCK.DIAMOND_ORE, {
  name: 'Diamond Ore',
  hardness: 3.4,
  preferredTool: 'pickaxe',
  minTier: 3,
  soundGroup: 'stone',
  textures: { all: 'diamond_ore' },
  drop: ITEM.DIAMOND,
});

regBlock(BLOCK.CRYSTAL_ORE, {
  name: 'Luminescent Crystal',
  hardness: 2.6,
  preferredTool: 'pickaxe',
  minTier: 2,
  light: 10,
  soundGroup: 'glass',
  textures: { all: 'crystal_ore' },
  drop: ITEM.CRYSTAL_SHARD,
  dropCount: 2,
});

regBlock(BLOCK.OAK_LOG, {
  name: 'Oak Log',
  hardness: 1.4,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 2,
  textures: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log_side' },
});

regBlock(BLOCK.OAK_LEAVES, {
  name: 'Oak Leaves',
  hardness: 0.28,
  opaque: false,
  alphaTest: true,
  lightOpacity: 2,
  soundGroup: 'grass',
  tintType: 'leaf',
  textures: { all: 'oak_leaves' },
});

regBlock(BLOCK.SPRUCE_LOG, {
  name: 'Spruce Log',
  hardness: 1.4,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 2,
  textures: { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log_side' },
});

regBlock(BLOCK.SPRUCE_LEAVES, {
  name: 'Spruce Needles',
  hardness: 0.28,
  opaque: false,
  alphaTest: true,
  lightOpacity: 2,
  soundGroup: 'grass',
  tintType: 'leaf',
  textures: { all: 'spruce_leaves' },
});

regBlock(BLOCK.BIRCH_LOG, {
  name: 'Birch Log',
  hardness: 1.4,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 2,
  textures: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log_side' },
});

regBlock(BLOCK.BIRCH_LEAVES, {
  name: 'Birch Leaves',
  hardness: 0.28,
  opaque: false,
  alphaTest: true,
  lightOpacity: 2,
  soundGroup: 'grass',
  tintType: 'leaf',
  textures: { all: 'birch_leaves' },
});

regBlock(BLOCK.CACTUS, {
  name: 'Desert Cactus',
  hardness: 0.5,
  soundGroup: 'grass',
  textures: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' },
});

regBlock(BLOCK.TALL_GRASS, {
  name: 'Wild Grass',
  solid: false,
  opaque: false,
  alphaTest: true,
  renderType: 'cross',
  lightOpacity: 0,
  hardness: 0.05,
  soundGroup: 'grass',
  tintType: 'grass_all',
  textures: { all: 'tall_grass' },
  drop: BLOCK.AIR,
});

regBlock(BLOCK.RED_FLOWER, {
  name: 'Crimson Poppy',
  solid: false,
  opaque: false,
  alphaTest: true,
  renderType: 'cross',
  lightOpacity: 0,
  hardness: 0.05,
  soundGroup: 'grass',
  textures: { all: 'red_flower' },
});

regBlock(BLOCK.YELLOW_FLOWER, {
  name: 'Sunburst Dandelion',
  solid: false,
  opaque: false,
  alphaTest: true,
  renderType: 'cross',
  lightOpacity: 0,
  hardness: 0.05,
  soundGroup: 'grass',
  textures: { all: 'yellow_flower' },
});

regBlock(BLOCK.GLOW_SHROOM, {
  name: 'Cave Glowshroom',
  solid: false,
  opaque: false,
  alphaTest: true,
  renderType: 'cross',
  light: 9,
  lightOpacity: 0,
  hardness: 0.08,
  soundGroup: 'grass',
  textures: { all: 'glow_shroom' },
});

regBlock(BLOCK.WATER, {
  name: 'Water',
  solid: false,
  opaque: false,
  translucent: true,
  renderType: 'fluid',
  lightOpacity: 2,
  hardness: Infinity,
  soundGroup: 'water',
  textures: { all: 'water' },
});

regBlock(BLOCK.LAVA, {
  name: 'Lava',
  solid: false,
  opaque: false,
  renderType: 'fluid',
  light: 15,
  lightOpacity: 1,
  hardness: Infinity,
  soundGroup: 'water',
  textures: { all: 'lava' },
});

regBlock(BLOCK.OAK_PLANKS, {
  name: 'Oak Planks',
  hardness: 1.3,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 1.5,
  textures: { all: 'oak_planks' },
});

regBlock(BLOCK.SPRUCE_PLANKS, {
  name: 'Spruce Planks',
  hardness: 1.3,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 1.5,
  textures: { all: 'spruce_planks' },
});

regBlock(BLOCK.BIRCH_PLANKS, {
  name: 'Birch Planks',
  hardness: 1.3,
  preferredTool: 'axe',
  soundGroup: 'wood',
  fuelValue: 1.5,
  textures: { all: 'birch_planks' },
});

regBlock(BLOCK.CRAFTING_TABLE, {
  name: 'Crafting Table',
  hardness: 1.5,
  preferredTool: 'axe',
  soundGroup: 'wood',
  interactive: 'crafting',
  textures: { top: 'crafting_top', bottom: 'oak_planks', side: 'crafting_side' },
});

regBlock(BLOCK.FURNACE, {
  name: 'Stone Furnace',
  hardness: 2.2,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  interactive: 'furnace',
  light: 4,
  textures: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' },
});

regBlock(BLOCK.TORCH, {
  name: 'Torch',
  solid: false,
  opaque: false,
  alphaTest: true,
  renderType: 'torch',
  light: 14,
  lightOpacity: 0,
  hardness: 0.05,
  soundGroup: 'wood',
  textures: { all: 'torch' },
});

regBlock(BLOCK.LANTERN, {
  name: 'Iron Lantern',
  hardness: 1.4,
  preferredTool: 'pickaxe',
  light: 15,
  soundGroup: 'glass',
  textures: { top: 'lantern_top', bottom: 'lantern_top', side: 'lantern_side' },
});

regBlock(BLOCK.GLASS, {
  name: 'Clear Glass',
  hardness: 0.45,
  opaque: false,
  alphaTest: true,
  lightOpacity: 0,
  soundGroup: 'glass',
  textures: { all: 'glass' },
});

regBlock(BLOCK.BRICKS, {
  name: 'Clay Bricks',
  hardness: 2.0,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { all: 'bricks' },
});

regBlock(BLOCK.STONE_BRICKS, {
  name: 'Carved Stone Bricks',
  hardness: 2.0,
  preferredTool: 'pickaxe',
  minTier: 1,
  soundGroup: 'stone',
  textures: { all: 'stone_bricks' },
});

regBlock(BLOCK.BED, {
  name: 'Cozy Bed',
  hardness: 0.8,
  preferredTool: 'axe',
  soundGroup: 'wood',
  interactive: 'bed',
  maxStack: 1,
  textures: { top: 'bed_top', bottom: 'oak_planks', side: 'bed_side' },
});

regBlock(BLOCK.WOOL_BLOCK, {
  name: 'Soft Wool',
  hardness: 0.55,
  soundGroup: 'grass',
  textures: { all: 'wool' },
});

regBlock(BLOCK.BOOKSHELF, {
  name: 'Bookshelf',
  hardness: 1.2,
  preferredTool: 'axe',
  soundGroup: 'wood',
  textures: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
});

// --- NON-BLOCK ITEMS ---
regItem(ITEM.STICK, { name: 'Wooden Stick', icon: 'stick', fuelValue: 0.5 });
regItem(ITEM.COAL, { name: 'Coal', icon: 'coal', fuelValue: 8 });
regItem(ITEM.RAW_IRON, { name: 'Raw Iron Ore', icon: 'raw_iron' });
regItem(ITEM.IRON_INGOT, { name: 'Iron Ingot', icon: 'iron_ingot' });
regItem(ITEM.RAW_GOLD, { name: 'Raw Gold Ore', icon: 'raw_gold' });
regItem(ITEM.GOLD_INGOT, { name: 'Gold Ingot', icon: 'gold_ingot' });
regItem(ITEM.DIAMOND, { name: 'Diamond Gem', icon: 'diamond' });
regItem(ITEM.CRYSTAL_SHARD, { name: 'Luminescent Shard', icon: 'crystal_shard' });
regItem(ITEM.CLAY_BALL, { name: 'Clay Lump', icon: 'clay_ball' });
regItem(ITEM.BRICK_ITEM, { name: 'Fired Brick', icon: 'brick_item' });
regItem(ITEM.FLINT, { name: 'Sharp Flint', icon: 'flint' });

// Pickaxes
regItem(ITEM.WOOD_PICKAXE, {
  name: 'Wooden Pickaxe', icon: 'wood_pickaxe',
  toolType: 'pickaxe', tier: 1, speed: 2.5, damage: 2, durability: 65,
});
regItem(ITEM.STONE_PICKAXE, {
  name: 'Stone Pickaxe', icon: 'stone_pickaxe',
  toolType: 'pickaxe', tier: 2, speed: 4.2, damage: 3, durability: 140,
});
regItem(ITEM.IRON_PICKAXE, {
  name: 'Iron Pickaxe', icon: 'iron_pickaxe',
  toolType: 'pickaxe', tier: 3, speed: 6.5, damage: 4, durability: 280,
});
regItem(ITEM.DIAMOND_PICKAXE, {
  name: 'Diamond Pickaxe', icon: 'diamond_pickaxe',
  toolType: 'pickaxe', tier: 4, speed: 9.5, damage: 5, durability: 650,
});

// Axes
regItem(ITEM.WOOD_AXE, {
  name: 'Wooden Axe', icon: 'wood_axe',
  toolType: 'axe', tier: 1, speed: 2.5, damage: 3, durability: 65,
});
regItem(ITEM.STONE_AXE, {
  name: 'Stone Axe', icon: 'stone_axe',
  toolType: 'axe', tier: 2, speed: 4.2, damage: 4, durability: 140,
});
regItem(ITEM.IRON_AXE, {
  name: 'Iron Axe', icon: 'iron_axe',
  toolType: 'axe', tier: 3, speed: 6.5, damage: 5, durability: 280,
});
regItem(ITEM.DIAMOND_AXE, {
  name: 'Diamond Axe', icon: 'diamond_axe',
  toolType: 'axe', tier: 4, speed: 9.5, damage: 7, durability: 650,
});

// Shovels
regItem(ITEM.WOOD_SHOVEL, {
  name: 'Wooden Shovel', icon: 'wood_shovel',
  toolType: 'shovel', tier: 1, speed: 2.5, damage: 2, durability: 65,
});
regItem(ITEM.STONE_SHOVEL, {
  name: 'Stone Shovel', icon: 'stone_shovel',
  toolType: 'shovel', tier: 2, speed: 4.2, damage: 3, durability: 140,
});
regItem(ITEM.IRON_SHOVEL, {
  name: 'Iron Shovel', icon: 'iron_shovel',
  toolType: 'shovel', tier: 3, speed: 6.5, damage: 4, durability: 280,
});

// Swords
regItem(ITEM.WOOD_SWORD, {
  name: 'Wooden Sword', icon: 'wood_sword',
  toolType: 'sword', tier: 1, speed: 1.5, damage: 4, durability: 70,
});
regItem(ITEM.STONE_SWORD, {
  name: 'Stone Sword', icon: 'stone_sword',
  toolType: 'sword', tier: 2, speed: 1.5, damage: 6, durability: 150,
});
regItem(ITEM.IRON_SWORD, {
  name: 'Iron Sword', icon: 'iron_sword',
  toolType: 'sword', tier: 3, speed: 1.5, damage: 8, durability: 300,
});
regItem(ITEM.DIAMOND_SWORD, {
  name: 'Diamond Sword', icon: 'diamond_sword',
  toolType: 'sword', tier: 4, speed: 1.5, damage: 11, durability: 700,
});

// Food
regItem(ITEM.APPLE, {
  name: 'Crisp Apple', icon: 'apple',
  food: { hunger: 4, heal: 2 },
});
regItem(ITEM.RAW_MEAT, {
  name: 'Raw Venison', icon: 'raw_meat',
  food: { hunger: 3, heal: 1 },
});
regItem(ITEM.COOKED_MEAT, {
  name: 'Roasted Steak', icon: 'cooked_meat',
  food: { hunger: 8, heal: 5 },
});
regItem(ITEM.BREAD, {
  name: 'Golden Loaf', icon: 'bread',
  food: { hunger: 6, heal: 3 },
});

export function getItemDef(id) {
  return REGISTRY[id] || REGISTRY[BLOCK.AIR];
}

export function isSolidBlock(id) {
  const def = REGISTRY[id];
  return Boolean(def && def.solid);
}

export function isOpaqueBlock(id) {
  const def = REGISTRY[id];
  return Boolean(def && def.opaque);
}
