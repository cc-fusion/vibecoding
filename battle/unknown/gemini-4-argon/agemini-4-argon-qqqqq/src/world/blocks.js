import { RENDER_TYPE, TOOL_TYPE, SOUND_GROUP } from './constants.js';

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
  CLAY: 9,
  SNOW_GRASS: 10,
  SNOW_BLOCK: 11,
  ICE: 12,
  PODZOL: 13,
  DEEPSLATE: 14,

  OAK_LOG: 15,
  OAK_LEAVES: 16,
  OAK_PLANKS: 17,
  BIRCH_LOG: 18,
  BIRCH_LEAVES: 19,
  BIRCH_PLANKS: 20,
  PINE_LOG: 21,
  PINE_LEAVES: 22,
  PINE_PLANKS: 23,

  COAL_ORE: 24,
  IRON_ORE: 25,
  GOLD_ORE: 26,
  CRYSTAL_ORE: 27,

  CRAFTING_TABLE: 28,
  FURNACE: 29,
  CHEST: 30,
  BRICKS: 31,
  GLASS: 32,
  BOOKSHELF: 33,
  WOOL: 34,
  CRYSTAL_BLOCK: 35,
  GLOWSTONE: 36,
  LANTERN: 37,
  TORCH: 38,

  WATER: 39,
  LAVA: 40,

  TALL_GRASS: 41,
  FLOWER_RED: 42,
  FLOWER_GOLD: 43,
  FLOWER_BLUE: 44,
  MUSHROOM_RED: 45,
  GLOWSHROOM: 46,
  DEAD_BUSH: 47,
  CACTUS: 48,
  BERRY_BUSH: 49,
  MOSSY_COBBLE: 50,
  SMOOTH_STONE: 51,
};

export const ITEM = {
  WOOD_PICKAXE: 101,
  WOOD_AXE: 102,
  WOOD_SHOVEL: 103,
  WOOD_SWORD: 104,

  STONE_PICKAXE: 105,
  STONE_AXE: 106,
  STONE_SHOVEL: 107,
  STONE_SWORD: 108,

  IRON_PICKAXE: 109,
  IRON_AXE: 110,
  IRON_SHOVEL: 111,
  IRON_SWORD: 112,

  CRYSTAL_PICKAXE: 113,
  CRYSTAL_AXE: 114,
  CRYSTAL_SHOVEL: 115,
  CRYSTAL_SWORD: 116,

  STICK: 120,
  COAL: 121,
  RAW_IRON: 122,
  IRON_INGOT: 123,
  RAW_GOLD: 124,
  GOLD_INGOT: 125,
  CRYSTAL_GEM: 126,
  CLAY_BALL: 127,
  BRICK_ITEM: 128,

  APPLE: 130,
  RAW_MEAT: 131,
  COOKED_MEAT: 132,
  BERRIES: 133,

  BUCKET_EMPTY: 140,
  BUCKET_WATER: 141,
};

export const REGISTRY = new Map();

function defBlock(id, cfg) {
  const tex = typeof cfg.tex === 'string'
    ? { top: cfg.tex, bottom: cfg.tex, side: cfg.tex, front: cfg.tex }
    : {
        top: cfg.tex.top,
        bottom: cfg.tex.bottom ?? cfg.tex.top,
        side: cfg.tex.side ?? cfg.tex.top,
        front: cfg.tex.front ?? cfg.tex.side ?? cfg.tex.top,
      };

  const renderType = cfg.renderType ?? RENDER_TYPE.SOLID;
  const solid = cfg.solid ?? (renderType === RENDER_TYPE.SOLID || renderType === RENDER_TYPE.CUTOUT);
  const opaque = cfg.opaque ?? (renderType === RENDER_TYPE.SOLID);

  const entry = {
    id,
    isBlock: true,
    name: cfg.name,
    renderType,
    solid,
    opaque,
    light: cfg.light ?? 0,
    lightAttenuation: opaque ? 15 : (cfg.lightAttenuation ?? 1),
    hardness: cfg.hardness ?? 1.0,
    preferredTool: cfg.preferredTool ?? TOOL_TYPE.NONE,
    minToolTier: cfg.minToolTier ?? 0,
    drop: cfg.drop ?? id,
    dropCount: cfg.dropCount ?? 1,
    bonusDrop: cfg.bonusDrop ?? null,
    sound: cfg.sound ?? SOUND_GROUP.STONE,
    tex,
    color: cfg.color ?? '#888888',
    stackSize: cfg.stackSize ?? 64,
    interactive: cfg.interactive ?? null,
    fuelValue: cfg.fuelValue ?? 0,
    hurts: cfg.hurts ?? 0,
  };
  REGISTRY.set(id, entry);
  return entry;
}

function defItem(id, cfg) {
  const entry = {
    id,
    isBlock: false,
    name: cfg.name,
    icon: cfg.icon,
    toolType: cfg.toolType ?? TOOL_TYPE.NONE,
    toolTier: cfg.toolTier ?? 0,
    miningSpeed: cfg.miningSpeed ?? 1,
    attackDamage: cfg.attackDamage ?? 1,
    maxDurability: cfg.durability ?? 0,
    stackSize: cfg.durability ? 1 : (cfg.stackSize ?? 64),
    food: cfg.food ?? 0,
    heal: cfg.heal ?? 0,
    fuelValue: cfg.fuelValue ?? 0,
    placesFluid: cfg.placesFluid ?? null,
    scoopsFluid: cfg.scoopsFluid ?? false,
    color: cfg.color ?? '#cccccc',
  };
  REGISTRY.set(id, entry);
  return entry;
}

// Air
REGISTRY.set(BLOCK.AIR, {
  id: BLOCK.AIR,
  isBlock: true,
  name: 'Air',
  renderType: RENDER_TYPE.NONE,
  solid: false,
  opaque: false,
  light: 0,
  lightAttenuation: 1,
  hardness: 0,
  tex: { top: 'air', bottom: 'air', side: 'air', front: 'air' },
});

// Terrain blocks
defBlock(BLOCK.GRASS, {
  name: 'Grass Block',
  tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  hardness: 0.65,
  preferredTool: TOOL_TYPE.SHOVEL,
  drop: BLOCK.DIRT,
  sound: SOUND_GROUP.GRASS,
  color: '#5ca93e',
});

defBlock(BLOCK.DIRT, {
  name: 'Dirt',
  tex: 'dirt',
  hardness: 0.55,
  preferredTool: TOOL_TYPE.SHOVEL,
  sound: SOUND_GROUP.GRASS,
  color: '#7c5638',
});

defBlock(BLOCK.PODZOL, {
  name: 'Forest Moss Soil',
  tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' },
  hardness: 0.65,
  preferredTool: TOOL_TYPE.SHOVEL,
  drop: BLOCK.DIRT,
  sound: SOUND_GROUP.GRASS,
  color: '#5a4328',
});

defBlock(BLOCK.STONE, {
  name: 'Stone',
  tex: 'stone',
  hardness: 1.8,
  preferredTool: TOOL_TYPE.PICKAXE,
  drop: BLOCK.COBBLESTONE,
  sound: SOUND_GROUP.STONE,
  color: '#7d8187',
});

defBlock(BLOCK.SMOOTH_STONE, {
  name: 'Polished Stone',
  tex: 'smooth_stone',
  hardness: 1.9,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#9ba0a6',
});

defBlock(BLOCK.COBBLESTONE, {
  name: 'Cobblestone',
  tex: 'cobblestone',
  hardness: 2.0,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#6e7278',
});

defBlock(BLOCK.MOSSY_COBBLE, {
  name: 'Mossy Cobblestone',
  tex: 'mossy_cobble',
  hardness: 2.0,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#597453',
});

defBlock(BLOCK.DEEPSLATE, {
  name: 'Deepslate',
  tex: 'deepslate',
  hardness: 2.8,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#464a54',
});

defBlock(BLOCK.BEDROCK, {
  name: 'Bedrock',
  tex: 'bedrock',
  hardness: -1,
  sound: SOUND_GROUP.STONE,
  color: '#2c2e33',
});

defBlock(BLOCK.SAND, {
  name: 'Sand',
  tex: 'sand',
  hardness: 0.55,
  preferredTool: TOOL_TYPE.SHOVEL,
  sound: SOUND_GROUP.SAND,
  color: '#dfd199',
});

defBlock(BLOCK.SANDSTONE, {
  name: 'Sandstone',
  tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
  hardness: 1.4,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#d4c285',
});

defBlock(BLOCK.GRAVEL, {
  name: 'Gravel',
  tex: 'gravel',
  hardness: 0.65,
  preferredTool: TOOL_TYPE.SHOVEL,
  sound: SOUND_GROUP.SAND,
  color: '#88837f',
});

defBlock(BLOCK.CLAY, {
  name: 'Clay Deposit',
  tex: 'clay',
  hardness: 0.7,
  preferredTool: TOOL_TYPE.SHOVEL,
  drop: ITEM.CLAY_BALL,
  dropCount: 4,
  sound: SOUND_GROUP.SAND,
  color: '#9aa3b2',
});

defBlock(BLOCK.SNOW_GRASS, {
  name: 'Snowy Turf',
  tex: { top: 'snow', bottom: 'dirt', side: 'snow_side' },
  hardness: 0.65,
  preferredTool: TOOL_TYPE.SHOVEL,
  drop: BLOCK.DIRT,
  sound: SOUND_GROUP.SNOW,
  color: '#eef5fb',
});

defBlock(BLOCK.SNOW_BLOCK, {
  name: 'Snow Block',
  tex: 'snow',
  hardness: 0.45,
  preferredTool: TOOL_TYPE.SHOVEL,
  sound: SOUND_GROUP.SNOW,
  color: '#f2f7fc',
});

defBlock(BLOCK.ICE, {
  name: 'Glacial Ice',
  tex: 'ice',
  hardness: 0.8,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.GLASS,
  lightAttenuation: 2,
  color: '#93c8f5',
});

// Wood & Foliage
defBlock(BLOCK.OAK_LOG, {
  name: 'Oak Log',
  tex: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log' },
  hardness: 1.5,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 15,
  color: '#6e5233',
});

defBlock(BLOCK.OAK_LEAVES, {
  name: 'Oak Leaves',
  tex: 'oak_leaves',
  renderType: RENDER_TYPE.CUTOUT,
  opaque: false,
  lightAttenuation: 2,
  hardness: 0.25,
  drop: 0,
  bonusDrop: [
    { id: ITEM.STICK, chance: 0.22 },
    { id: ITEM.APPLE, chance: 0.08 },
  ],
  sound: SOUND_GROUP.GRASS,
  color: '#468c32',
});

defBlock(BLOCK.OAK_PLANKS, {
  name: 'Oak Planks',
  tex: 'oak_planks',
  hardness: 1.4,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 12,
  color: '#b08954',
});

defBlock(BLOCK.BIRCH_LOG, {
  name: 'Birch Log',
  tex: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log' },
  hardness: 1.5,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 15,
  color: '#d9d5cb',
});

defBlock(BLOCK.BIRCH_LEAVES, {
  name: 'Birch Leaves',
  tex: 'birch_leaves',
  renderType: RENDER_TYPE.CUTOUT,
  opaque: false,
  lightAttenuation: 2,
  hardness: 0.25,
  drop: 0,
  bonusDrop: [
    { id: ITEM.STICK, chance: 0.22 },
    { id: ITEM.APPLE, chance: 0.06 },
  ],
  sound: SOUND_GROUP.GRASS,
  color: '#67a544',
});

defBlock(BLOCK.BIRCH_PLANKS, {
  name: 'Birch Planks',
  tex: 'birch_planks',
  hardness: 1.4,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 12,
  color: '#d4c394',
});

defBlock(BLOCK.PINE_LOG, {
  name: 'Spruce Log',
  tex: { top: 'pine_log_top', bottom: 'pine_log_top', side: 'pine_log' },
  hardness: 1.6,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 15,
  color: '#4a3522',
});

defBlock(BLOCK.PINE_LEAVES, {
  name: 'Spruce Needles',
  tex: 'pine_leaves',
  renderType: RENDER_TYPE.CUTOUT,
  opaque: false,
  lightAttenuation: 2,
  hardness: 0.25,
  drop: 0,
  bonusDrop: [{ id: ITEM.STICK, chance: 0.25 }],
  sound: SOUND_GROUP.GRASS,
  color: '#2e5d3b',
});

defBlock(BLOCK.PINE_PLANKS, {
  name: 'Spruce Planks',
  tex: 'pine_planks',
  hardness: 1.4,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  fuelValue: 12,
  color: '#7a5937',
});

// Ores
defBlock(BLOCK.COAL_ORE, {
  name: 'Coal Ore',
  tex: 'coal_ore',
  hardness: 2.3,
  preferredTool: TOOL_TYPE.PICKAXE,
  minToolTier: 1,
  drop: ITEM.COAL,
  sound: SOUND_GROUP.STONE,
  color: '#34363a',
});

defBlock(BLOCK.IRON_ORE, {
  name: 'Iron Ore',
  tex: 'iron_ore',
  hardness: 2.7,
  preferredTool: TOOL_TYPE.PICKAXE,
  minToolTier: 1,
  drop: ITEM.RAW_IRON,
  sound: SOUND_GROUP.STONE,
  color: '#c99c7e',
});

defBlock(BLOCK.GOLD_ORE, {
  name: 'Gold Ore',
  tex: 'gold_ore',
  hardness: 3.1,
  preferredTool: TOOL_TYPE.PICKAXE,
  minToolTier: 2,
  drop: ITEM.RAW_GOLD,
  sound: SOUND_GROUP.STONE,
  color: '#f2ca4b',
});

defBlock(BLOCK.CRYSTAL_ORE, {
  name: 'Aether Crystal Ore',
  tex: 'crystal_ore',
  hardness: 3.8,
  preferredTool: TOOL_TYPE.PICKAXE,
  minToolTier: 3,
  drop: ITEM.CRYSTAL_GEM,
  light: 6,
  sound: SOUND_GROUP.GLASS,
  color: '#4ef2ea',
});

// Functional & Crafted Blocks
defBlock(BLOCK.CRAFTING_TABLE, {
  name: 'Crafting Table',
  tex: { top: 'workbench_top', bottom: 'oak_planks', side: 'workbench_side', front: 'workbench_front' },
  hardness: 1.6,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  interactive: 'workbench',
  color: '#9c6b3e',
});

defBlock(BLOCK.FURNACE, {
  name: 'Stone Furnace',
  tex: { top: 'smooth_stone', bottom: 'cobblestone', side: 'furnace_side', front: 'furnace_front' },
  hardness: 2.4,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  interactive: 'furnace',
  light: 9,
  color: '#6b6f75',
});

defBlock(BLOCK.CHEST, {
  name: 'Wooden Crate',
  tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' },
  hardness: 1.6,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  color: '#a47239',
});

defBlock(BLOCK.BRICKS, {
  name: 'Clay Bricks',
  tex: 'bricks',
  hardness: 2.2,
  preferredTool: TOOL_TYPE.PICKAXE,
  sound: SOUND_GROUP.STONE,
  color: '#a85244',
});

defBlock(BLOCK.GLASS, {
  name: 'Clear Glass',
  tex: 'glass',
  renderType: RENDER_TYPE.CUTOUT,
  opaque: false,
  lightAttenuation: 1,
  hardness: 0.45,
  sound: SOUND_GROUP.GLASS,
  color: '#cdeef7',
});

defBlock(BLOCK.BOOKSHELF, {
  name: 'Bookshelf',
  tex: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
  hardness: 1.4,
  preferredTool: TOOL_TYPE.AXE,
  sound: SOUND_GROUP.WOOD,
  color: '#8f693e',
});

defBlock(BLOCK.WOOL, {
  name: 'Fleece Wool',
  tex: 'wool',
  hardness: 0.6,
  sound: SOUND_GROUP.SNOW,
  color: '#ece9e2',
});

defBlock(BLOCK.CRYSTAL_BLOCK, {
  name: 'Aether Crystal Block',
  tex: 'crystal_block',
  hardness: 3.2,
  preferredTool: TOOL_TYPE.PICKAXE,
  light: 12,
  sound: SOUND_GROUP.GLASS,
  color: '#5cf5eb',
});

defBlock(BLOCK.GLOWSTONE, {
  name: 'Sunstone Lamp',
  tex: 'glowstone',
  hardness: 0.8,
  light: 15,
  sound: SOUND_GROUP.GLASS,
  color: '#ffda73',
});

defBlock(BLOCK.LANTERN, {
  name: 'Iron Lantern',
  tex: 'lantern',
  renderType: RENDER_TYPE.TORCH,
  solid: false,
  opaque: false,
  light: 15,
  hardness: 0.4,
  sound: SOUND_GROUP.GLASS,
  color: '#ffb84d',
});

defBlock(BLOCK.TORCH, {
  name: 'Torch',
  tex: 'torch',
  renderType: RENDER_TYPE.TORCH,
  solid: false,
  opaque: false,
  light: 14,
  hardness: 0.05,
  sound: SOUND_GROUP.WOOD,
  color: '#ffaa33',
});

// Fluids
defBlock(BLOCK.WATER, {
  name: 'Water',
  tex: 'water',
  renderType: RENDER_TYPE.FLUID,
  solid: false,
  opaque: false,
  lightAttenuation: 2,
  hardness: -1,
  sound: SOUND_GROUP.WATER,
  color: '#2c8ae8',
});

defBlock(BLOCK.LAVA, {
  name: 'Molten Lava',
  tex: 'lava',
  renderType: RENDER_TYPE.FLUID,
  solid: false,
  opaque: false,
  light: 15,
  hardness: -1,
  hurts: 4,
  sound: SOUND_GROUP.WATER,
  color: '#ff5d17',
});

// Cross Flora & Plants
defBlock(BLOCK.TALL_GRASS, {
  name: ' Meadow Grass',
  tex: 'tall_grass',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.04,
  drop: 0,
  sound: SOUND_GROUP.GRASS,
  color: '#5ab33e',
});

defBlock(BLOCK.FLOWER_RED, {
  name: 'Crimson Poppy',
  tex: 'flower_red',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.04,
  sound: SOUND_GROUP.GRASS,
  color: '#e03e3e',
});

defBlock(BLOCK.FLOWER_GOLD, {
  name: 'Sunbloom',
  tex: 'flower_gold',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.04,
  sound: SOUND_GROUP.GRASS,
  color: '#f2c938',
});

defBlock(BLOCK.FLOWER_BLUE, {
  name: 'Azurebell',
  tex: 'flower_blue',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.04,
  sound: SOUND_GROUP.GRASS,
  color: '#4a9ef5',
});

defBlock(BLOCK.MUSHROOM_RED, {
  name: 'Spotted Mushroom',
  tex: 'mushroom_red',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.05,
  sound: SOUND_GROUP.GRASS,
  color: '#d94136',
});

defBlock(BLOCK.GLOWSHROOM, {
  name: 'Cavern Glowshroom',
  tex: 'glowshroom',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  light: 10,
  hardness: 0.08,
  sound: SOUND_GROUP.GLASS,
  color: '#4bf5c8',
});

defBlock(BLOCK.DEAD_BUSH, {
  name: 'Desert Shrub',
  tex: 'dead_bush',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.05,
  drop: ITEM.STICK,
  sound: SOUND_GROUP.WOOD,
  color: '#917044',
});

defBlock(BLOCK.CACTUS, {
  name: 'Desert Cactus',
  tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' },
  hardness: 0.5,
  sound: SOUND_GROUP.GRASS,
  hurts: 1,
  color: '#3c8c3a',
});

defBlock(BLOCK.BERRY_BUSH, {
  name: 'Wildberry Bush',
  tex: 'berry_bush',
  renderType: RENDER_TYPE.CROSS,
  solid: false,
  opaque: false,
  hardness: 0.15,
  drop: ITEM.BERRIES,
  dropCount: 2,
  sound: SOUND_GROUP.GRASS,
  color: '#3f7d36',
});

// Tools & Weapons
const TIERS = [
  { prefix: 'WOOD', label: 'Wooden', tier: 1, speed: 2.5, dur: 70, dmg: 3, swordDmg: 5, color: '#a87d48', key: 'wood' },
  { prefix: 'STONE', label: 'Stone', tier: 2, speed: 4.2, dur: 140, dmg: 4, swordDmg: 6.5, color: '#8a8f96', key: 'stone' },
  { prefix: 'IRON', label: 'Iron', tier: 3, speed: 6.8, dur: 280, dmg: 5, swordDmg: 8.5, color: '#dce3eb', key: 'iron' },
  { prefix: 'CRYSTAL', label: 'Crystal', tier: 4, speed: 10.5, dur: 650, dmg: 6.5, swordDmg: 11, color: '#52f7ec', key: 'crystal' },
];

for (const t of TIERS) {
  defItem(ITEM[`${t.prefix}_PICKAXE`], {
    name: `${t.label} Pickaxe`,
    icon: `pickaxe_${t.key}`,
    toolType: TOOL_TYPE.PICKAXE,
    toolTier: t.tier,
    miningSpeed: t.speed,
    attackDamage: t.dmg,
    durability: t.dur,
    color: t.color,
  });
  defItem(ITEM[`${t.prefix}_AXE`], {
    name: `${t.label} Axe`,
    icon: `axe_${t.key}`,
    toolType: TOOL_TYPE.AXE,
    toolTier: t.tier,
    miningSpeed: t.speed,
    attackDamage: t.dmg + 1,
    durability: t.dur,
    color: t.color,
  });
  defItem(ITEM[`${t.prefix}_SHOVEL`], {
    name: `${t.label} Shovel`,
    icon: `shovel_${t.key}`,
    toolType: TOOL_TYPE.SHOVEL,
    toolTier: t.tier,
    miningSpeed: t.speed,
    attackDamage: t.dmg - 0.5,
    durability: t.dur,
    color: t.color,
  });
  defItem(ITEM[`${t.prefix}_SWORD`], {
    name: `${t.label} Sword`,
    icon: `sword_${t.key}`,
    toolType: TOOL_TYPE.SWORD,
    toolTier: t.tier,
    miningSpeed: 1.5,
    attackDamage: t.swordDmg,
    durability: t.dur + 30,
    color: t.color,
  });
}

// Resources & Food
defItem(ITEM.STICK, { name: 'Wooden Stick', icon: 'stick', fuelValue: 5, color: '#8f693e' });
defItem(ITEM.COAL, { name: 'Coal', icon: 'coal', fuelValue: 60, color: '#2b2d30' });
defItem(ITEM.RAW_IRON, { name: 'Raw Iron Ore', icon: 'raw_iron', color: '#cf9e80' });
defItem(ITEM.IRON_INGOT, { name: 'Iron Ingot', icon: 'iron_ingot', color: '#e2e8f0' });
defItem(ITEM.RAW_GOLD, { name: 'Raw Gold Ore', icon: 'raw_gold', color: '#f5cb42' });
defItem(ITEM.GOLD_INGOT, { name: 'Gold Ingot', icon: 'gold_ingot', color: '#ffd94a' });
defItem(ITEM.CRYSTAL_GEM, { name: 'Aether Crystal', icon: 'crystal_gem', color: '#4ff7ec' });
defItem(ITEM.CLAY_BALL, { name: 'Clay Lump', icon: 'clay_ball', color: '#9ea8b8' });
defItem(ITEM.BRICK_ITEM, { name: 'Fired Brick', icon: 'brick_item', color: '#b85746' });

defItem(ITEM.APPLE, { name: 'Crisp Apple', icon: 'apple', food: 4, heal: 2, color: '#e03a3a' });
defItem(ITEM.RAW_MEAT, { name: 'Raw Venison', icon: 'raw_meat', food: 2, heal: 1, color: '#d46363' });
defItem(ITEM.COOKED_MEAT, { name: 'Roasted Steak', icon: 'cooked_meat', food: 8, heal: 5, color: '#96502c' });
defItem(ITEM.BERRIES, { name: 'Sweet Wildberries', icon: 'berries', food: 3, heal: 1.5, color: '#c92e55' });

defItem(ITEM.BUCKET_EMPTY, {
  name: 'Iron Bucket',
  icon: 'bucket_empty',
  stackSize: 1,
  scoopsFluid: true,
  color: '#cbd5e1',
});
defItem(ITEM.BUCKET_WATER, {
  name: 'Water Bucket',
  icon: 'bucket_water',
  stackSize: 1,
  placesFluid: BLOCK.WATER,
  color: '#3b82f6',
});

export function getDef(id) {
  return REGISTRY.get(id) || REGISTRY.get(BLOCK.AIR);
}

export function isBlockId(id) {
  return id > 0 && id < 100 && REGISTRY.has(id);
}
