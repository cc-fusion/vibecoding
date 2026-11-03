export type SoundGroup = 'grass' | 'stone' | 'wood' | 'sand' | 'glass' | 'metal' | 'water';
export type ToolKind = 'none' | 'pickaxe' | 'axe' | 'shovel' | 'sword';
export type RenderKind = 'cube' | 'cross' | 'torch' | 'fluid' | 'none';

export interface ItemDef {
  id: number;
  key: string;
  name: string;
  category: 'terrain' | 'building' | 'nature' | 'functional' | 'tool' | 'material' | 'food';
  isBlock: boolean;
  solid: boolean;
  opaque: boolean;
  fluid: boolean;
  transparent: boolean;
  renderType: RenderKind;
  lightEmission: number;
  hardness: number; // seconds by bare hand; -1 unbreakable
  preferredTool: ToolKind;
  minToolTier: number;
  toolType?: ToolKind;
  toolTier?: number; // 1=wood, 2=stone, 3=iron, 4=diamond
  toolSpeed?: number;
  attackDamage?: number;
  maxDurability?: number;
  foodRestore?: number;
  fuelValue?: number;
  dropId?: number;
  dropCount?: number;
  stackable: boolean;
  soundGroup: SoundGroup;
  textures: { top: number; side: number; bottom: number };
  colorHex: string;
  description?: string;
}

export const BLOCK = {
  AIR: 0,
  BEDROCK: 1,
  STONE: 2,
  DIRT: 3,
  GRASS: 4,
  SAND: 5,
  SANDSTONE: 6,
  SNOW_GRASS: 7,
  SNOW: 8,
  ICE: 9,
  CLAY: 10,
  GRAVEL: 11,
  WATER: 12,
  LAVA: 13,
  OAK_LOG: 14,
  BIRCH_LOG: 15,
  PINE_LOG: 16,
  OAK_LEAVES: 17,
  BIRCH_LEAVES: 18,
  PINE_LEAVES: 19,
  CACTUS: 20,
  TALL_GRASS: 21,
  FLOWER_RED: 22,
  FLOWER_YELLOW: 23,
  GLOW_SHROOM: 24,
  COAL_ORE: 25,
  IRON_ORE: 26,
  GOLD_ORE: 27,
  DIAMOND_ORE: 28,
  EMERALD_ORE: 29,
  COBBLESTONE: 30,
  OAK_PLANKS: 31,
  BIRCH_PLANKS: 32,
  PINE_PLANKS: 33,
  STONE_BRICKS: 34,
  BRICKS: 35,
  GLASS: 36,
  CRAFTING_TABLE: 37,
  FURNACE: 38,
  TORCH: 39,
  GLOWSTONE: 40,
  TNT: 41,
  BOOKSHELF: 42,
  WOOL: 43,
} as const;

export const ITEM = {
  STICK: 100,
  COAL: 101,
  IRON_INGOT: 102,
  GOLD_INGOT: 103,
  DIAMOND: 104,
  EMERALD: 105,
  BRICK_ITEM: 106,

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
  RAW_MEAT: 131,
  COOKED_MEAT: 132,
  BREAD: 133,
} as const;

// Texture Atlas Tile Indices (8x8 = 64 tiles of 16x16 pixels)
export const TEX = {
  BEDROCK: 0,
  STONE: 1,
  DIRT: 2,
  GRASS_TOP: 3,
  GRASS_SIDE: 4,
  SAND: 5,
  SANDSTONE_SIDE: 6,
  SANDSTONE_TOP: 7,
  SNOW: 8,
  SNOW_SIDE: 9,
  ICE: 10,
  CLAY: 11,
  GRAVEL: 12,
  WATER: 13,
  LAVA: 14,
  OAK_LOG_SIDE: 15,
  OAK_LOG_TOP: 16,
  BIRCH_LOG_SIDE: 17,
  BIRCH_LOG_TOP: 18,
  PINE_LOG_SIDE: 19,
  PINE_LOG_TOP: 20,
  OAK_LEAVES: 21,
  BIRCH_LEAVES: 22,
  PINE_LEAVES: 23,
  CACTUS_SIDE: 24,
  CACTUS_TOP: 25,
  TALL_GRASS: 26,
  FLOWER_RED: 27,
  FLOWER_YELLOW: 28,
  GLOW_SHROOM: 29,
  COAL_ORE: 30,
  IRON_ORE: 31,
  GOLD_ORE: 32,
  DIAMOND_ORE: 33,
  EMERALD_ORE: 34,
  COBBLESTONE: 35,
  OAK_PLANKS: 36,
  BIRCH_PLANKS: 37,
  PINE_PLANKS: 38,
  STONE_BRICKS: 39,
  BRICKS: 40,
  GLASS: 41,
  CRAFT_TOP: 42,
  CRAFT_SIDE: 43,
  FURNACE_FRONT: 44,
  FURNACE_SIDE: 45,
  TORCH: 46,
  GLOWSTONE: 47,
  TNT_SIDE: 48,
  TNT_TOP: 49,
  TNT_BOTTOM: 50,
  BOOKSHELF: 51,
  WOOL: 52,
} as const;

export const ITEMS: Record<number, ItemDef> = {};

function reg(def: ItemDef) {
  ITEMS[def.id] = def;
}

const cubeTex = (t: number) => ({ top: t, side: t, bottom: t });

// --- TERRAIN & NATURE BLOCKS ---
reg({
  id: BLOCK.AIR,
  key: 'air',
  name: 'Air',
  category: 'terrain',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'none',
  lightEmission: 0,
  hardness: 0,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(0),
  colorHex: '#000000',
});

reg({
  id: BLOCK.BEDROCK,
  key: 'bedrock',
  name: 'Bedrock',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: -1,
  preferredTool: 'pickaxe',
  minToolTier: 99,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.BEDROCK),
  colorHex: '#33363b',
  description: 'Indestructible foundation rock at the bottom of the world.',
});

reg({
  id: BLOCK.STONE,
  key: 'stone',
  name: 'Stone',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.65,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  dropId: BLOCK.COBBLESTONE,
  dropCount: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.STONE),
  colorHex: '#7c8087',
  description: 'Drops Cobblestone when mined with a Pickaxe.',
});

reg({
  id: BLOCK.DIRT,
  key: 'dirt',
  name: 'Dirt',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.55,
  preferredTool: 'shovel',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.DIRT),
  colorHex: '#84593b',
});

reg({
  id: BLOCK.GRASS,
  key: 'grass',
  name: 'Grass Block',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.6,
  preferredTool: 'shovel',
  minToolTier: 0,
  dropId: BLOCK.DIRT,
  dropCount: 1,
  stackable: true,
  soundGroup: 'grass',
  textures: { top: TEX.GRASS_TOP, side: TEX.GRASS_SIDE, bottom: TEX.DIRT },
  colorHex: '#59a646',
});

reg({
  id: BLOCK.SAND,
  key: 'sand',
  name: 'Sand',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.55,
  preferredTool: 'shovel',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'sand',
  textures: cubeTex(TEX.SAND),
  colorHex: '#e2cf8b',
  description: 'Smelt in a Furnace to craft crystal-clear Glass.',
});

reg({
  id: BLOCK.SANDSTONE,
  key: 'sandstone',
  name: 'Sandstone',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.2,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: { top: TEX.SANDSTONE_TOP, side: TEX.SANDSTONE_SIDE, bottom: TEX.SANDSTONE_TOP },
  colorHex: '#d7c17c',
});

reg({
  id: BLOCK.SNOW_GRASS,
  key: 'snow_grass',
  name: 'Snowy Turf',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.6,
  preferredTool: 'shovel',
  minToolTier: 0,
  dropId: BLOCK.DIRT,
  dropCount: 1,
  stackable: true,
  soundGroup: 'grass',
  textures: { top: TEX.SNOW, side: TEX.SNOW_SIDE, bottom: TEX.DIRT },
  colorHex: '#f1f6fa',
});

reg({
  id: BLOCK.SNOW,
  key: 'snow',
  name: 'Snow Block',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.4,
  preferredTool: 'shovel',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'sand',
  textures: cubeTex(TEX.SNOW),
  colorHex: '#f5fbff',
});

reg({
  id: BLOCK.ICE,
  key: 'ice',
  name: 'Packed Ice',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.65,
  preferredTool: 'pickaxe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'glass',
  textures: cubeTex(TEX.ICE),
  colorHex: '#93c5fd',
});

reg({
  id: BLOCK.CLAY,
  key: 'clay',
  name: 'Clay Deposit',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.65,
  preferredTool: 'shovel',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'sand',
  textures: cubeTex(TEX.CLAY),
  colorHex: '#9aa4b2',
  description: 'Smelt in a Furnace to produce red Bricks.',
});

reg({
  id: BLOCK.GRAVEL,
  key: 'gravel',
  name: 'Gravel',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.65,
  preferredTool: 'shovel',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'sand',
  textures: cubeTex(TEX.GRAVEL),
  colorHex: '#807b79',
});

reg({
  id: BLOCK.WATER,
  key: 'water',
  name: 'Water',
  category: 'terrain',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: true,
  transparent: true,
  renderType: 'fluid',
  lightEmission: 0,
  hardness: -1,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'water',
  textures: cubeTex(TEX.WATER),
  colorHex: '#2c82e0',
});

reg({
  id: BLOCK.LAVA,
  key: 'lava',
  name: 'Molten Lava',
  category: 'terrain',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: true,
  transparent: false,
  renderType: 'fluid',
  lightEmission: 15,
  hardness: -1,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'water',
  textures: cubeTex(TEX.LAVA),
  colorHex: '#f97316',
});

// --- WOODS, LEAVES & FLORA ---
reg({
  id: BLOCK.OAK_LOG,
  key: 'oak_log',
  name: 'Oak Log',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.25,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 2,
  stackable: true,
  soundGroup: 'wood',
  textures: { top: TEX.OAK_LOG_TOP, side: TEX.OAK_LOG_SIDE, bottom: TEX.OAK_LOG_TOP },
  colorHex: '#735334',
  description: 'Craft into 4 Oak Planks or use as Furnace fuel.',
});

reg({
  id: BLOCK.BIRCH_LOG,
  key: 'birch_log',
  name: 'Birch Log',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.25,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 2,
  stackable: true,
  soundGroup: 'wood',
  textures: { top: TEX.BIRCH_LOG_TOP, side: TEX.BIRCH_LOG_SIDE, bottom: TEX.BIRCH_LOG_TOP },
  colorHex: '#dfd9cf',
  description: 'Craft into 4 pale Birch Planks.',
});

reg({
  id: BLOCK.PINE_LOG,
  key: 'pine_log',
  name: 'Spruce Log',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.25,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 2,
  stackable: true,
  soundGroup: 'wood',
  textures: { top: TEX.PINE_LOG_TOP, side: TEX.PINE_LOG_SIDE, bottom: TEX.PINE_LOG_TOP },
  colorHex: '#4f3723',
  description: 'Craft into 4 rich dark Spruce Planks.',
});

reg({
  id: BLOCK.OAK_LEAVES,
  key: 'oak_leaves',
  name: 'Oak Leaves',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.25,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.OAK_LEAVES),
  colorHex: '#3f8a36',
  description: 'Occasionally drops crisp Red Apples or Sticks when broken!',
});

reg({
  id: BLOCK.BIRCH_LEAVES,
  key: 'birch_leaves',
  name: 'Birch Leaves',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.25,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.BIRCH_LEAVES),
  colorHex: '#63a348',
});

reg({
  id: BLOCK.PINE_LEAVES,
  key: 'pine_leaves',
  name: 'Spruce Needles',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.25,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.PINE_LEAVES),
  colorHex: '#2d6142',
});

reg({
  id: BLOCK.CACTUS,
  key: 'cactus',
  name: 'Desert Cactus',
  category: 'nature',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.45,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: { top: TEX.CACTUS_TOP, side: TEX.CACTUS_SIDE, bottom: TEX.CACTUS_TOP },
  colorHex: '#2f8540',
});

reg({
  id: BLOCK.TALL_GRASS,
  key: 'tall_grass',
  name: 'Meadow Grass',
  category: 'nature',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cross',
  lightEmission: 0,
  hardness: 0.05,
  preferredTool: 'none',
  minToolTier: 0,
  dropId: BLOCK.AIR,
  dropCount: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.TALL_GRASS),
  colorHex: '#53a642',
});

reg({
  id: BLOCK.FLOWER_RED,
  key: 'flower_red',
  name: 'Crimson Poppy',
  category: 'nature',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cross',
  lightEmission: 0,
  hardness: 0.05,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.FLOWER_RED),
  colorHex: '#e11d48',
});

reg({
  id: BLOCK.FLOWER_YELLOW,
  key: 'flower_yellow',
  name: 'Sun Dandelion',
  category: 'nature',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cross',
  lightEmission: 0,
  hardness: 0.05,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.FLOWER_YELLOW),
  colorHex: '#facc15',
});

reg({
  id: BLOCK.GLOW_SHROOM,
  key: 'glow_shroom',
  name: 'Luminous Cave Shroom',
  category: 'nature',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cross',
  lightEmission: 9,
  hardness: 0.1,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.GLOW_SHROOM),
  colorHex: '#38bdf8',
  description: 'Bioluminescent fungus lighting deep underground caverns.',
});

// --- ORES ---
reg({
  id: BLOCK.COAL_ORE,
  key: 'coal_ore',
  name: 'Coal Ore',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 2.0,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  dropId: ITEM.COAL,
  dropCount: 2,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.COAL_ORE),
  colorHex: '#2f3237',
  description: 'Drops Coal for Torches and Furnace smelting.',
});

reg({
  id: BLOCK.IRON_ORE,
  key: 'iron_ore',
  name: 'Iron Ore',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 2.4,
  preferredTool: 'pickaxe',
  minToolTier: 2,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.IRON_ORE),
  colorHex: '#d4a37d',
  description: 'Smelt in a Furnace to forge strong Iron Ingots.',
});

reg({
  id: BLOCK.GOLD_ORE,
  key: 'gold_ore',
  name: 'Gold Ore',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 2,
  hardness: 2.6,
  preferredTool: 'pickaxe',
  minToolTier: 3,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.GOLD_ORE),
  colorHex: '#facc15',
  description: 'Smelt in a Furnace into gleaming Gold Ingots.',
});

reg({
  id: BLOCK.DIAMOND_ORE,
  key: 'diamond_ore',
  name: 'Diamond Ore',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 4,
  hardness: 3.0,
  preferredTool: 'pickaxe',
  minToolTier: 3,
  dropId: ITEM.DIAMOND,
  dropCount: 1,
  stackable: true,
  soundGroup: 'metal',
  textures: cubeTex(TEX.DIAMOND_ORE),
  colorHex: '#22d3ee',
  description: 'Found deep underground below Y=22. Forges legendary Diamond gear!',
});

reg({
  id: BLOCK.EMERALD_ORE,
  key: 'emerald_ore',
  name: 'Emerald Ore',
  category: 'terrain',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 5,
  hardness: 2.8,
  preferredTool: 'pickaxe',
  minToolTier: 2,
  dropId: ITEM.EMERALD,
  dropCount: 1,
  stackable: true,
  soundGroup: 'metal',
  textures: cubeTex(TEX.EMERALD_ORE),
  colorHex: '#10b981',
  description: 'Rare mountain crystal that glows softly in dark caves.',
});

// --- BUILDING & FUNCTIONAL BLOCKS ---
reg({
  id: BLOCK.COBBLESTONE,
  key: 'cobblestone',
  name: 'Cobblestone',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.8,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.COBBLESTONE),
  colorHex: '#6b7078',
});

reg({
  id: BLOCK.OAK_PLANKS,
  key: 'oak_planks',
  name: 'Oak Planks',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.1,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 1,
  stackable: true,
  soundGroup: 'wood',
  textures: cubeTex(TEX.OAK_PLANKS),
  colorHex: '#b48852',
});

reg({
  id: BLOCK.BIRCH_PLANKS,
  key: 'birch_planks',
  name: 'Birch Planks',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.1,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 1,
  stackable: true,
  soundGroup: 'wood',
  textures: cubeTex(TEX.BIRCH_PLANKS),
  colorHex: '#d9cb9e',
});

reg({
  id: BLOCK.PINE_PLANKS,
  key: 'pine_planks',
  name: 'Spruce Planks',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.1,
  preferredTool: 'axe',
  minToolTier: 0,
  fuelValue: 1,
  stackable: true,
  soundGroup: 'wood',
  textures: cubeTex(TEX.PINE_PLANKS),
  colorHex: '#7c5838',
});

reg({
  id: BLOCK.STONE_BRICKS,
  key: 'stone_bricks',
  name: 'Stone Bricks',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.8,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.STONE_BRICKS),
  colorHex: '#797d85',
});

reg({
  id: BLOCK.BRICKS,
  key: 'bricks',
  name: 'Masonry Bricks',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.8,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: cubeTex(TEX.BRICKS),
  colorHex: '#a8483b',
});

reg({
  id: BLOCK.GLASS,
  key: 'glass',
  name: 'Crystal Glass',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.4,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'glass',
  textures: cubeTex(TEX.GLASS),
  colorHex: '#bae6fd',
});

reg({
  id: BLOCK.CRAFTING_TABLE,
  key: 'crafting_table',
  name: 'Crafting Table',
  category: 'functional',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.2,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'wood',
  textures: { top: TEX.CRAFT_TOP, side: TEX.CRAFT_SIDE, bottom: TEX.OAK_PLANKS },
  colorHex: '#9c6b3c',
  description: 'Right-click when placed or press E to craft advanced tools & blocks.',
});

reg({
  id: BLOCK.FURNACE,
  key: 'furnace',
  name: 'Smelting Furnace',
  category: 'functional',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 12,
  hardness: 2.0,
  preferredTool: 'pickaxe',
  minToolTier: 1,
  stackable: true,
  soundGroup: 'stone',
  textures: { top: TEX.FURNACE_SIDE, side: TEX.FURNACE_FRONT, bottom: TEX.FURNACE_SIDE },
  colorHex: '#636870',
  description: 'Emits warm hearth glow and smelts Ores, Sand, Clay, and Meat!',
});

reg({
  id: BLOCK.TORCH,
  key: 'torch',
  name: 'Torch',
  category: 'functional',
  isBlock: true,
  solid: false,
  opaque: false,
  fluid: false,
  transparent: true,
  renderType: 'torch',
  lightEmission: 14,
  hardness: 0.08,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'wood',
  textures: cubeTex(TEX.TORCH),
  colorHex: '#fbbf24',
  description: 'Casts warm golden light across caves and nighttime builds.',
});

reg({
  id: BLOCK.GLOWSTONE,
  key: 'glowstone',
  name: 'Sunstone Lantern',
  category: 'functional',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 15,
  hardness: 0.5,
  preferredTool: 'pickaxe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'glass',
  textures: cubeTex(TEX.GLOWSTONE),
  colorHex: '#fde047',
  description: 'Radiant architectural block emitting maximum light level (15).',
});

reg({
  id: BLOCK.TNT,
  key: 'tnt',
  name: 'TNT Charge',
  category: 'functional',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.15,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: { top: TEX.TNT_TOP, side: TEX.TNT_SIDE, bottom: TEX.TNT_BOTTOM },
  colorHex: '#ef4444',
  description: 'Place and Right-Click it directly to ignite a 2.8s explosive fuse!',
});

reg({
  id: BLOCK.BOOKSHELF,
  key: 'bookshelf',
  name: 'Scholar Bookshelf',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 1.1,
  preferredTool: 'axe',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'wood',
  textures: { top: TEX.OAK_PLANKS, side: TEX.BOOKSHELF, bottom: TEX.OAK_PLANKS },
  colorHex: '#92623a',
});

reg({
  id: BLOCK.WOOL,
  key: 'wool',
  name: 'Fleece Wool',
  category: 'building',
  isBlock: true,
  solid: true,
  opaque: true,
  fluid: false,
  transparent: false,
  renderType: 'cube',
  lightEmission: 0,
  hardness: 0.45,
  preferredTool: 'none',
  minToolTier: 0,
  stackable: true,
  soundGroup: 'grass',
  textures: cubeTex(TEX.WOOL),
  colorHex: '#f1f5f9',
});

// --- MATERIALS, TOOLS & CONSUMABLES ---
function regItem(
  id: number,
  key: string,
  name: string,
  category: ItemDef['category'],
  colorHex: string,
  extra: Partial<ItemDef> = {}
) {
  reg({
    id,
    key,
    name,
    category,
    isBlock: false,
    solid: false,
    opaque: false,
    fluid: false,
    transparent: true,
    renderType: 'none',
    lightEmission: 0,
    hardness: 0,
    preferredTool: 'none',
    minToolTier: 0,
    stackable: extra.toolType ? false : true,
    soundGroup: 'wood',
    textures: cubeTex(0),
    colorHex,
    ...extra,
  });
}

regItem(ITEM.STICK, 'stick', 'Wooden Stick', 'material', '#9c6f44', {
  fuelValue: 0.5,
  description: 'Essential handle for crafting tools, weapons, and Torches.',
});
regItem(ITEM.COAL, 'coal', 'Lump of Coal', 'material', '#26292e', {
  fuelValue: 8,
  description: 'High-efficiency Furnace fuel (8 smelts) and Torch ingredient.',
});
regItem(ITEM.IRON_INGOT, 'iron_ingot', 'Iron Ingot', 'material', '#e2e8f0', {
  description: 'Strong forged metal for durable tools and swords.',
});
regItem(ITEM.GOLD_INGOT, 'gold_ingot', 'Gold Ingot', 'material', '#facc15', {
  description: 'Gleaming precious ingot used for Sunstone Lanterns.',
});
regItem(ITEM.DIAMOND, 'diamond', 'Brilliant Diamond', 'material', '#22d3ee', {
  description: 'Peak gemstone used to forge ultra-fast Diamond equipment.',
});
regItem(ITEM.EMERALD, 'emerald', 'Mountain Emerald', 'material', '#10b981', {
  description: 'Rare crystalline gem prized by explorers.',
});
regItem(ITEM.BRICK_ITEM, 'brick_item', 'Fired Clay Brick', 'material', '#b84a39', {
  description: 'Combine 4 Fired Bricks into sturdy Masonry Brick blocks.',
});

const TIERS: {
  prefix: string;
  tier: number;
  speed: number;
  durability: number;
  dmg: number;
  color: string;
  ids: [number, number, number, number];
}[] = [
  {
    prefix: 'Wooden',
    tier: 1,
    speed: 2.5,
    durability: 65,
    dmg: 4,
    color: '#a37444',
    ids: [ITEM.WOOD_PICKAXE, ITEM.WOOD_AXE, ITEM.WOOD_SHOVEL, ITEM.WOOD_SWORD],
  },
  {
    prefix: 'Stone',
    tier: 2,
    speed: 4.2,
    durability: 140,
    dmg: 5.5,
    color: '#8c929c',
    ids: [ITEM.STONE_PICKAXE, ITEM.STONE_AXE, ITEM.STONE_SHOVEL, ITEM.STONE_SWORD],
  },
  {
    prefix: 'Iron',
    tier: 3,
    speed: 6.8,
    durability: 280,
    dmg: 7,
    color: '#e2e8f0',
    ids: [ITEM.IRON_PICKAXE, ITEM.IRON_AXE, ITEM.IRON_SHOVEL, ITEM.IRON_SWORD],
  },
  {
    prefix: 'Diamond',
    tier: 4,
    speed: 10.5,
    durability: 800,
    dmg: 9,
    color: '#22d3ee',
    ids: [ITEM.DIAMOND_PICKAXE, ITEM.DIAMOND_AXE, ITEM.DIAMOND_SHOVEL, ITEM.DIAMOND_SWORD],
  },
];

for (const t of TIERS) {
  const [pickId, axeId, shovelId, swordId] = t.ids;
  regItem(pickId, `${t.prefix.toLowerCase()}_pickaxe`, `${t.prefix} Pickaxe`, 'tool', t.color, {
    toolType: 'pickaxe',
    toolTier: t.tier,
    toolSpeed: t.speed,
    attackDamage: t.dmg - 1.5,
    maxDurability: t.durability,
    description: `Tier ${t.tier} Pickaxe (${t.speed}x stone & ore mining speed).`,
  });
  regItem(axeId, `${t.prefix.toLowerCase()}_axe`, `${t.prefix} Axe`, 'tool', t.color, {
    toolType: 'axe',
    toolTier: t.tier,
    toolSpeed: t.speed,
    attackDamage: t.dmg - 0.5,
    maxDurability: t.durability,
    description: `Tier ${t.tier} Axe (${t.speed}x wood chopping speed).`,
  });
  regItem(shovelId, `${t.prefix.toLowerCase()}_shovel`, `${t.prefix} Shovel`, 'tool', t.color, {
    toolType: 'shovel',
    toolTier: t.tier,
    toolSpeed: t.speed,
    attackDamage: t.dmg - 2,
    maxDurability: t.durability,
    description: `Tier ${t.tier} Shovel (${t.speed}x earth, sand & snow speed).`,
  });
  regItem(swordId, `${t.prefix.toLowerCase()}_sword`, `${t.prefix} Sword`, 'tool', t.color, {
    toolType: 'sword',
    toolTier: t.tier,
    toolSpeed: 1.6,
    attackDamage: t.dmg + 1.5,
    maxDurability: t.durability,
    description: `Deals ${t.dmg + 1.5} melee damage with knockback.`,
  });
}

regItem(ITEM.APPLE, 'apple', 'Crisp Red Apple', 'food', '#ef4444', {
  foodRestore: 4,
  description: 'Right-click to eat! Restores +4 Hunger and heals Hearts.',
});
regItem(ITEM.RAW_MEAT, 'raw_meat', 'Raw Venison Cut', 'food', '#f87171', {
  foodRestore: 3,
  description: 'Restores +3 Hunger, or cook in a Furnace for +8 Hunger!',
});
regItem(ITEM.COOKED_MEAT, 'cooked_meat', 'Roasted Steak', 'food', '#92400e', {
  foodRestore: 8,
  description: 'Hearty meal restoring +8 Hunger and rapidly regenerating Health!',
});
regItem(ITEM.BREAD, 'bread', 'Golden Loaf', 'food', '#d97706', {
  foodRestore: 6,
  description: 'Freshly baked bread restoring +6 Hunger.',
});

export function isPlanks(id: number): boolean {
  return id === BLOCK.OAK_PLANKS || id === BLOCK.BIRCH_PLANKS || id === BLOCK.PINE_PLANKS;
}

export function isLog(id: number): boolean {
  return id === BLOCK.OAK_LOG || id === BLOCK.BIRCH_LOG || id === BLOCK.PINE_LOG;
}

export const ALL_CREATIVE_ITEMS: number[] = Object.values(ITEMS)
  .filter((it) => it.id !== BLOCK.AIR && it.id !== BLOCK.WATER && it.id !== BLOCK.LAVA)
  .map((it) => it.id);
