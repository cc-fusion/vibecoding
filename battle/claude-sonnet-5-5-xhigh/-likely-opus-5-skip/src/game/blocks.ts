// Block registry, tile names and fast lookup tables (shared by main thread and workers).
export const CS = 16;
export const CH = 128;
export const SEA = 38;
export const CVOL = CS * CS * CH;

export const MATS = ['wood', 'stone', 'iron', 'diamond'] as const;
export const TOOLS = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'] as const;

const BASE_TILES = [
  'white', 'grass_top', 'grass_side', 'grass_side_snow', 'dirt', 'stone', 'cobble', 'sand', 'gravel',
  'log_side', 'log_top', 'birch_side', 'birch_top', 'spruce_side', 'spruce_top',
  'leaves_oak', 'leaves_birch', 'leaves_spruce', 'planks', 'water', 'lava', 'bedrock',
  'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'snow', 'ice',
  'sandstone_top', 'sandstone_side', 'sandstone_bottom', 'cactus_top', 'cactus_side', 'glass',
  'stone_bricks', 'table_top', 'table_side', 'table_front', 'furnace_front', 'furnace_front_lit',
  'furnace_side', 'furnace_top', 'chest_front', 'chest_side', 'chest_top', 'torch',
  'tallgrass', 'flower_red', 'flower_yellow', 'deadbush', 'sapling',
  'wool_white', 'wool_red', 'wool_blue', 'wool_green', 'wool_yellow', 'wool_black',
  'farmland_top', 'wheat_0', 'wheat_1', 'wheat_2', 'wheat_3', 'bookshelf',
  'tnt_top', 'tnt_side', 'tnt_bottom', 'lamp', 'iron_block', 'gold_block', 'diamond_block',
  // items
  'stick', 'coal', 'iron_ingot', 'gold_ingot', 'diamond', 'flint', 'feather', 'leather',
  'raw_pork', 'cooked_pork', 'raw_beef', 'cooked_beef', 'raw_chicken', 'cooked_chicken',
  'raw_mutton', 'cooked_mutton', 'apple', 'bread', 'wheat', 'seeds', 'bone', 'gunpowder',
  'rotten_flesh', 'flint_steel',
];
export const TILE_NAMES: string[] = [...BASE_TILES, ...MATS.flatMap((m) => TOOLS.map((t) => `${m}_${t}`))];
export const TILE: Record<string, number> = {};
TILE_NAMES.forEach((n, i) => (TILE[n] = i));

export const K = { CUBE: 0, CROSS: 1, WATER: 2, LAVA: 3, TORCH: 4, CACTUS: 5, FARM: 6 } as const;
export const TL = { NONE: 0, PICK: 1, AXE: 2, SHOVEL: 3, SWORD: 4, HOE: 5 } as const;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6, LOG: 7, LEAVES: 8, PLANKS: 9,
  WATER: 10, LAVA: 11, BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15, DIAMOND_ORE: 16,
  SNOW: 17, SNOW_GRASS: 18, ICE: 19, SANDSTONE: 20, CACTUS: 21, BIRCH_LOG: 22, BIRCH_LEAVES: 23,
  SPRUCE_LOG: 24, SPRUCE_LEAVES: 25, GLASS: 26, STONE_BRICKS: 27, TABLE: 28, FURNACE: 29,
  FURNACE_LIT: 30, CHEST: 31, TORCH: 32, TALLGRASS: 33, FLOWER_RED: 34, FLOWER_YELLOW: 35,
  DEADBUSH: 36, SAPLING: 37, WOOL: 38, WOOL_RED: 39, WOOL_BLUE: 40, WOOL_GREEN: 41, WOOL_YELLOW: 42,
  WOOL_BLACK: 43, FARMLAND: 44, WHEAT0: 45, WHEAT1: 46, WHEAT2: 47, WHEAT3: 48, BOOKSHELF: 49,
  TNT: 50, LAMP: 51, IRON_BLOCK: 52, GOLD_BLOCK: 53, DIAMOND_BLOCK: 54,
} as const;

export interface BlockDef {
  id: number; name: string; kind: number; tiles: number[]; solid: boolean; opaque: boolean;
  opacity: number; light: number; hardness: number; tool: number; tier: number; sound: string;
  translucent: boolean; repl: boolean; item: boolean; icon: number; gravity: boolean;
}

export const BLOCKS: BlockDef[] = [];

function def(id: number, name: string, t: string | string[], o: Partial<BlockDef> = {}) {
  let names: string[];
  if (typeof t === 'string') names = [t, t, t, t, t, t];
  else if (t.length === 3) names = [t[2], t[2], t[0], t[1], t[2], t[2]];
  else names = t;
  const tiles = names.map((n) => {
    if (TILE[n] === undefined) throw new Error('missing tile ' + n);
    return TILE[n];
  });
  BLOCKS[id] = {
    id, name, kind: K.CUBE, tiles, solid: true, opaque: true, opacity: 15, light: 0, hardness: 1,
    tool: TL.NONE, tier: 0, sound: 'stone', translucent: false, repl: false, item: true,
    icon: tiles[2], gravity: false, ...o,
  };
}

const plant = (id: number, name: string, tile: string, o: Partial<BlockDef> = {}) =>
  def(id, name, tile, {
    kind: K.CROSS, solid: false, opaque: false, opacity: 0, hardness: 0, sound: 'grass', icon: TILE[tile], ...o,
  });

def(B.AIR, 'Air', 'white', { solid: false, opaque: false, opacity: 0, repl: true, item: false, hardness: -1 });
def(B.GRASS, 'Grass Block', ['grass_top', 'dirt', 'grass_side'], { hardness: 0.6, tool: TL.SHOVEL, sound: 'grass' });
def(B.DIRT, 'Dirt', 'dirt', { hardness: 0.5, tool: TL.SHOVEL, sound: 'dirt' });
def(B.STONE, 'Stone', 'stone', { hardness: 1.5, tool: TL.PICK, tier: 1 });
def(B.COBBLE, 'Cobblestone', 'cobble', { hardness: 2, tool: TL.PICK, tier: 1 });
def(B.SAND, 'Sand', 'sand', { hardness: 0.5, tool: TL.SHOVEL, sound: 'sand', gravity: true });
def(B.GRAVEL, 'Gravel', 'gravel', { hardness: 0.6, tool: TL.SHOVEL, sound: 'gravel', gravity: true });
def(B.LOG, 'Oak Log', ['log_top', 'log_top', 'log_side'], { hardness: 2, tool: TL.AXE, sound: 'wood' });
def(B.LEAVES, 'Oak Leaves', 'leaves_oak', { hardness: 0.2, opaque: false, opacity: 1, sound: 'leaves' });
def(B.PLANKS, 'Oak Planks', 'planks', { hardness: 2, tool: TL.AXE, sound: 'wood' });
def(B.WATER, 'Water', 'water', { kind: K.WATER, solid: false, opaque: false, opacity: 2, repl: true, item: false, hardness: -1, translucent: true, sound: 'water' });
def(B.LAVA, 'Lava', 'lava', { kind: K.LAVA, solid: false, opaque: false, opacity: 2, light: 15, repl: true, item: false, hardness: -1, sound: 'water' });
def(B.BEDROCK, 'Bedrock', 'bedrock', { hardness: -1 });
def(B.COAL_ORE, 'Coal Ore', 'coal_ore', { hardness: 3, tool: TL.PICK, tier: 1 });
def(B.IRON_ORE, 'Iron Ore', 'iron_ore', { hardness: 3, tool: TL.PICK, tier: 2 });
def(B.GOLD_ORE, 'Gold Ore', 'gold_ore', { hardness: 3, tool: TL.PICK, tier: 3 });
def(B.DIAMOND_ORE, 'Diamond Ore', 'diamond_ore', { hardness: 3, tool: TL.PICK, tier: 3 });
def(B.SNOW, 'Snow Block', 'snow', { hardness: 0.3, tool: TL.SHOVEL, sound: 'snow' });
def(B.SNOW_GRASS, 'Snowy Grass', ['snow', 'dirt', 'grass_side_snow'], { hardness: 0.6, tool: TL.SHOVEL, sound: 'snow' });
def(B.ICE, 'Ice', 'ice', { hardness: 0.5, tool: TL.PICK, opaque: false, opacity: 2, translucent: true, sound: 'glass' });
def(B.SANDSTONE, 'Sandstone', ['sandstone_top', 'sandstone_bottom', 'sandstone_side'], { hardness: 0.8, tool: TL.PICK, tier: 1 });
def(B.CACTUS, 'Cactus', ['cactus_top', 'cactus_top', 'cactus_side'], { kind: K.CACTUS, opaque: false, opacity: 0, hardness: 0.4, sound: 'cloth' });
def(B.BIRCH_LOG, 'Birch Log', ['birch_top', 'birch_top', 'birch_side'], { hardness: 2, tool: TL.AXE, sound: 'wood' });
def(B.BIRCH_LEAVES, 'Birch Leaves', 'leaves_birch', { hardness: 0.2, opaque: false, opacity: 1, sound: 'leaves' });
def(B.SPRUCE_LOG, 'Spruce Log', ['spruce_top', 'spruce_top', 'spruce_side'], { hardness: 2, tool: TL.AXE, sound: 'wood' });
def(B.SPRUCE_LEAVES, 'Spruce Leaves', 'leaves_spruce', { hardness: 0.2, opaque: false, opacity: 1, sound: 'leaves' });
def(B.GLASS, 'Glass', 'glass', { hardness: 0.3, opaque: false, opacity: 0, sound: 'glass' });
def(B.STONE_BRICKS, 'Stone Bricks', 'stone_bricks', { hardness: 1.5, tool: TL.PICK, tier: 1 });
def(B.TABLE, 'Crafting Table', ['table_side', 'table_side', 'table_top', 'planks', 'table_front', 'table_front'], { hardness: 2.5, tool: TL.AXE, sound: 'wood', icon: TILE.table_front });
def(B.FURNACE, 'Furnace', ['furnace_front', 'furnace_front', 'furnace_top', 'furnace_top', 'furnace_front', 'furnace_front'], { hardness: 3.5, tool: TL.PICK, tier: 1 });
def(B.FURNACE_LIT, 'Lit Furnace', ['furnace_front_lit', 'furnace_front_lit', 'furnace_top', 'furnace_top', 'furnace_front_lit', 'furnace_front_lit'], { hardness: 3.5, tool: TL.PICK, tier: 1, light: 13, item: false });
def(B.CHEST, 'Chest', ['chest_side', 'chest_side', 'chest_top', 'chest_top', 'chest_front', 'chest_front'], { hardness: 2.5, tool: TL.AXE, sound: 'wood' });
def(B.TORCH, 'Torch', 'torch', { kind: K.TORCH, solid: false, opaque: false, opacity: 0, light: 14, hardness: 0, sound: 'wood', icon: TILE.torch });
plant(B.TALLGRASS, 'Tall Grass', 'tallgrass', { repl: true });
plant(B.FLOWER_RED, 'Red Flower', 'flower_red');
plant(B.FLOWER_YELLOW, 'Yellow Flower', 'flower_yellow');
plant(B.DEADBUSH, 'Dead Bush', 'deadbush', { repl: true });
plant(B.SAPLING, 'Oak Sapling', 'sapling');
const woolOpts = { hardness: 0.8, sound: 'cloth' };
def(B.WOOL, 'White Wool', 'wool_white', woolOpts);
def(B.WOOL_RED, 'Red Wool', 'wool_red', woolOpts);
def(B.WOOL_BLUE, 'Blue Wool', 'wool_blue', woolOpts);
def(B.WOOL_GREEN, 'Green Wool', 'wool_green', woolOpts);
def(B.WOOL_YELLOW, 'Yellow Wool', 'wool_yellow', woolOpts);
def(B.WOOL_BLACK, 'Black Wool', 'wool_black', woolOpts);
def(B.FARMLAND, 'Farmland', ['farmland_top', 'dirt', 'dirt'], { kind: K.FARM, opaque: false, hardness: 0.6, tool: TL.SHOVEL, sound: 'dirt', item: false });
for (let i = 0; i < 4; i++) plant(B.WHEAT0 + i, 'Wheat Crop', 'wheat_' + i, { item: false });
def(B.BOOKSHELF, 'Bookshelf', ['planks', 'planks', 'bookshelf'], { hardness: 1.5, tool: TL.AXE, sound: 'wood' });
def(B.TNT, 'TNT', ['tnt_top', 'tnt_bottom', 'tnt_side'], { hardness: 0, sound: 'grass' });
def(B.LAMP, 'Lamp', 'lamp', { hardness: 0.3, light: 15, sound: 'glass' });
def(B.IRON_BLOCK, 'Block of Iron', 'iron_block', { hardness: 5, tool: TL.PICK, tier: 2 });
def(B.GOLD_BLOCK, 'Block of Gold', 'gold_block', { hardness: 3, tool: TL.PICK, tier: 3 });
def(B.DIAMOND_BLOCK, 'Block of Diamond', 'diamond_block', { hardness: 5, tool: TL.PICK, tier: 3 });

export const T_KIND = new Uint8Array(256);
export const T_OPAQUE = new Uint8Array(256);
export const T_OPACITY = new Uint8Array(256);
export const T_LIGHT = new Uint8Array(256);
export const T_SOLID = new Uint8Array(256);
export const T_TRANS = new Uint8Array(256);
export const T_FACE = new Uint8Array(256 * 6);
export const TINT_TILE = new Uint8Array(256);
for (const b of BLOCKS) {
  if (!b) continue;
  T_KIND[b.id] = b.kind;
  T_OPAQUE[b.id] = b.opaque ? 1 : 0;
  T_OPACITY[b.id] = b.opacity;
  T_LIGHT[b.id] = b.light;
  T_SOLID[b.id] = b.solid ? 1 : 0;
  T_TRANS[b.id] = b.translucent ? 1 : 0;
  for (let f = 0; f < 6; f++) T_FACE[b.id * 6 + f] = b.tiles[f];
}
TINT_TILE[TILE.grass_top] = 1;
TINT_TILE[TILE.tallgrass] = 1;
TINT_TILE[TILE.leaves_oak] = 2;
TINT_TILE[TILE.sapling] = 0;

export const isSurface = (id: number) => id !== 0 && T_KIND[id] !== K.CROSS && T_KIND[id] !== K.TORCH;
export const isLeaves = (id: number) => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES;
export const isLog = (id: number) => id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG;
export const isPlant = (id: number) => T_KIND[id] === K.CROSS;
