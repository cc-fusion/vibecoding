// Block + item registry. Everything gameplay-related keys off ids defined here.

export const B = {
  AIR: 0, STONE: 1, GRASS: 2, DIRT: 3, COBBLE: 4, PLANKS: 5, SAND: 6, GRAVEL: 7, LOG: 8, LEAVES: 9,
  WATER: 10, BEDROCK: 11, COAL_ORE: 12, IRON_ORE: 13, GOLD_ORE: 14, DIAMOND_ORE: 15, SNOW_GRASS: 16,
  SNOW: 17, ICE: 18, SANDSTONE: 19, CACTUS: 20, BIRCH_LOG: 21, BIRCH_LEAVES: 22, SPRUCE_LOG: 23,
  SPRUCE_LEAVES: 24, GLASS: 25, CRAFTING_TABLE: 26, FURNACE: 27, FURNACE_LIT: 28, CHEST: 29, TORCH: 30,
  TALL_GRASS: 31, FLOWER_RED: 32, FLOWER_YELLOW: 33, BRICKS: 34, LAVA: 35, WOOL: 36, BED: 37,
  DEAD_BUSH: 38, SAPLING: 39, DEEPSLATE: 40, TNT: 41, STONE_BRICKS: 42,
};

export const I = {
  STICK: 256, COAL: 257, CHARCOAL: 258, IRON_INGOT: 259, GOLD_INGOT: 260, DIAMOND: 261, FLINT: 262,
  FLINT_STEEL: 263, GUNPOWDER: 264, APPLE: 265, RAW_PORK: 266, COOKED_PORK: 267, RAW_BEEF: 268,
  COOKED_BEEF: 269, RAW_MUTTON: 270, COOKED_MUTTON: 271, RAW_CHICKEN: 272, COOKED_CHICKEN: 273,
  ROTTEN_FLESH: 274, BONE: 275, BONE_MEAL: 276,
  WOOD_PICKAXE: 300, WOOD_AXE: 301, WOOD_SHOVEL: 302, WOOD_SWORD: 303,
  STONE_PICKAXE: 304, STONE_AXE: 305, STONE_SHOVEL: 306, STONE_SWORD: 307,
  IRON_PICKAXE: 308, IRON_AXE: 309, IRON_SHOVEL: 310, IRON_SWORD: 311,
  DIAMOND_PICKAXE: 312, DIAMOND_AXE: 313, DIAMOND_SHOVEL: 314, DIAMOND_SWORD: 315,
};

export const MAX_ID = 512;
export const DEFS = new Array(MAX_ID).fill(null);

// shapes
export const S_CUBE = 0, S_CUTOUT = 1, S_WATER = 2, S_LAVA = 3, S_CROSS = 4, S_TORCH = 5, S_BOX = 6;

// lookup tables (hot paths in mesher / lighting / physics)
export const OPACITY = new Uint8Array(MAX_ID);     // light attenuation 0..15
export const OPAQUE = new Uint8Array(MAX_ID);      // fully hides neighbouring faces
export const SOLID = new Uint8Array(MAX_ID);       // collides with entities
export const EMIT = new Uint8Array(MAX_ID);        // block light emission
export const SHAPE = new Uint8Array(MAX_ID);
export const LIQUID = new Uint8Array(MAX_ID);

const TILE_SET = new Map();   // tile name -> layer index
export const TILE_NAMES = [];
function tileLayer(name) {
  if (!TILE_SET.has(name)) { TILE_SET.set(name, TILE_NAMES.length); TILE_NAMES.push(name); }
  return TILE_SET.get(name);
}
export const layerOf = (name) => TILE_SET.get(name);

// faces order: +X, -X, +Y, -Y, +Z, -Z
function block(id, name, o = {}) {
  const d = {
    id, name, kind: 'block', shape: S_CUBE, solid: true, opacity: 15, hardness: 1, tool: null, tier: 0,
    sound: 'stone', emit: 0, stack: 64, tint: 0, replaceable: false, fuel: 0, drops: undefined, noDrop: false,
    box: null, sel: null, ...o,
  };
  if (d.shape !== S_CUBE && d.shape !== S_BOX && o.opacity === undefined) d.opacity = 0;
  // tile naming
  const t = o.tiles || (o.tile ? { all: o.tile } : null);
  d.layers = new Int16Array(6).fill(-1);
  d.frontLayer = -1;
  d.iconTiles = null;
  if (t) {
    const top = t.top || t.all, bottom = t.bottom || t.all || t.top, side = t.side || t.all;
    d.layers[0] = d.layers[1] = d.layers[4] = d.layers[5] = tileLayer(side);
    d.layers[2] = tileLayer(top);
    d.layers[3] = tileLayer(bottom);
    if (t.front) d.frontLayer = tileLayer(t.front);
    d.iconTiles = { top, side: t.front || side, right: side };
    d.tileTop = top; d.tileSide = side; d.tileFront = t.front || side;
  }
  DEFS[id] = d;
  return d;
}

function item(id, name, o = {}) {
  const d = { id, name, kind: 'item', stack: 64, fuel: 0, ...o };
  DEFS[id] = d;
  return d;
}

// ---- blocks ------------------------------------------------------------------------------------
block(B.AIR, 'Air', { tiles: null, solid: false, opacity: 0, hardness: 0, replaceable: true, noDrop: true });
block(B.STONE, 'Stone', { tile: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drops: [[B.COBBLE, 1]] });
block(B.GRASS, 'Grass Block', { tiles: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', tint: 1, drops: [[B.DIRT, 1]] });
block(B.DIRT, 'Dirt', { tile: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
block(B.COBBLE, 'Cobblestone', { tile: 'cobble', hardness: 2, tool: 'pickaxe', tier: 1 });
block(B.PLANKS, 'Oak Planks', { tile: 'planks', hardness: 2, tool: 'axe', sound: 'wood', fuel: 15 });
block(B.SAND, 'Sand', { tile: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
block(B.GRAVEL, 'Gravel', { tile: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel', gravity: true, drops: [[B.GRAVEL, 1], [I.FLINT, 1, 0.12, true]] });
block(B.LOG, 'Oak Log', { tiles: { top: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, log: true });
block(B.LEAVES, 'Oak Leaves', { tile: 'leaves', shape: S_CUTOUT, opacity: 1, hardness: 0.2, sound: 'grass', tint: 2, leaves: true, drops: [[B.SAPLING, 1, 0.06], [I.APPLE, 1, 0.025], [I.STICK, 1, 0.05]] });
block(B.WATER, 'Water', { tile: 'water', shape: S_WATER, solid: false, opacity: 1, hardness: -1, sound: 'water', replaceable: true, noDrop: true });
block(B.BEDROCK, 'Bedrock', { tile: 'bedrock', hardness: -1, noDrop: true });
block(B.COAL_ORE, 'Coal Ore', { tile: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1, drops: [[I.COAL, 1]] });
block(B.IRON_ORE, 'Iron Ore', { tile: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2 });
block(B.GOLD_ORE, 'Gold Ore', { tile: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
block(B.DIAMOND_ORE, 'Diamond Ore', { tile: 'diamond_ore', hardness: 3, tool: 'pickaxe', tier: 3, drops: [[I.DIAMOND, 1]] });
block(B.SNOW_GRASS, 'Snowy Grass', { tiles: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, hardness: 0.6, tool: 'shovel', sound: 'snow', drops: [[B.DIRT, 1]] });
block(B.SNOW, 'Snow Block', { tile: 'snow', hardness: 0.3, tool: 'shovel', sound: 'snow' });
block(B.ICE, 'Ice', { tile: 'ice', shape: S_CUTOUT, opacity: 1, hardness: 0.5, tool: 'pickaxe', sound: 'glass', noDrop: true, icy: true });
block(B.SANDSTONE, 'Sandstone', { tiles: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
block(B.CACTUS, 'Cactus', { tiles: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, shape: S_BOX, box: [1, 0, 1, 15, 16, 15], opacity: 0, hardness: 0.4, sound: 'cloth', cactus: true });
block(B.BIRCH_LOG, 'Birch Log', { tiles: { top: 'birch_log_top', side: 'birch_log_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, log: true });
block(B.BIRCH_LEAVES, 'Birch Leaves', { tile: 'birch_leaves', shape: S_CUTOUT, opacity: 1, hardness: 0.2, sound: 'grass', leaves: true, drops: [[B.SAPLING, 1, 0.06], [I.STICK, 1, 0.05]] });
block(B.SPRUCE_LOG, 'Spruce Log', { tiles: { top: 'spruce_log_top', side: 'spruce_log_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, log: true });
block(B.SPRUCE_LEAVES, 'Spruce Leaves', { tile: 'spruce_leaves', shape: S_CUTOUT, opacity: 1, hardness: 0.2, sound: 'grass', leaves: true, drops: [[B.SAPLING, 1, 0.06], [I.STICK, 1, 0.05]] });
block(B.GLASS, 'Glass', { tile: 'glass', shape: S_CUTOUT, opacity: 0, hardness: 0.3, sound: 'glass', noDrop: true });
block(B.CRAFTING_TABLE, 'Crafting Table', { tiles: { top: 'crafting_top', bottom: 'planks', side: 'crafting_side', front: 'crafting_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 15, facing: true, ui: 'crafting' });
block(B.FURNACE, 'Furnace', { tiles: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, facing: true, ui: 'furnace' });
block(B.FURNACE_LIT, 'Furnace', { tiles: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' }, hardness: 3.5, tool: 'pickaxe', tier: 1, facing: true, ui: 'furnace', emit: 13, drops: [[B.FURNACE, 1]], hidden: true });
block(B.CHEST, 'Chest', { tiles: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, shape: S_BOX, box: [1, 0, 1, 15, 14, 15], opacity: 0, hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 15, facing: true, ui: 'chest' });
block(B.TORCH, 'Torch', { tile: 'torch', shape: S_TORCH, solid: false, hardness: 0, sound: 'wood', emit: 14, sel: [6, 0, 6, 10, 10, 10] });
block(B.TALL_GRASS, 'Tall Grass', { tile: 'tall_grass', shape: S_CROSS, solid: false, hardness: 0, sound: 'grass', tint: 1, replaceable: true, plant: true, drops: [[B.SAPLING, 1, 0.04]], sel: [3, 0, 3, 13, 13, 13] });
block(B.FLOWER_RED, 'Poppy', { tile: 'flower_red', shape: S_CROSS, solid: false, hardness: 0, sound: 'grass', plant: true, sel: [4, 0, 4, 12, 11, 12] });
block(B.FLOWER_YELLOW, 'Dandelion', { tile: 'flower_yellow', shape: S_CROSS, solid: false, hardness: 0, sound: 'grass', plant: true, sel: [4, 0, 4, 12, 11, 12] });
block(B.BRICKS, 'Bricks', { tile: 'bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
block(B.LAVA, 'Lava', { tile: 'lava', shape: S_LAVA, solid: false, opacity: 2, hardness: -1, emit: 15, sound: 'water', replaceable: true, noDrop: true });
block(B.WOOL, 'Wool', { tile: 'wool', hardness: 0.8, sound: 'cloth' });
block(B.BED, 'Bed', { tiles: { top: 'bed_top', bottom: 'planks', side: 'bed_side' }, shape: S_BOX, box: [0, 0, 0, 16, 9, 16], opacity: 0, hardness: 0.2, sound: 'cloth', facing: true, ui: 'bed' });
block(B.DEAD_BUSH, 'Dead Bush', { tile: 'dead_bush', shape: S_CROSS, solid: false, hardness: 0, sound: 'grass', plant: true, replaceable: true, drops: [[I.STICK, 1, 0.8]], sel: [3, 0, 3, 13, 10, 13] });
block(B.SAPLING, 'Sapling', { tile: 'sapling', shape: S_CROSS, solid: false, hardness: 0, sound: 'grass', plant: true, fuel: 5, sel: [3, 0, 3, 13, 12, 13] });
block(B.DEEPSLATE, 'Deepslate', { tiles: { top: 'deepslate_top', bottom: 'deepslate_top', side: 'deepslate' }, hardness: 3, tool: 'pickaxe', tier: 1, drops: [[B.COBBLE, 1]] });
block(B.TNT, 'TNT', { tiles: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass', tnt: true });
block(B.STONE_BRICKS, 'Stone Bricks', { tile: 'stone_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });

// ---- items -------------------------------------------------------------------------------------
item(I.STICK, 'Stick', { fuel: 5 });
item(I.COAL, 'Coal', { fuel: 80 });
item(I.CHARCOAL, 'Charcoal', { fuel: 80 });
item(I.IRON_INGOT, 'Iron Ingot');
item(I.GOLD_INGOT, 'Gold Ingot');
item(I.DIAMOND, 'Diamond');
item(I.FLINT, 'Flint');
item(I.FLINT_STEEL, 'Flint and Steel', { stack: 1, durability: 64 });
item(I.GUNPOWDER, 'Gunpowder');
item(I.APPLE, 'Apple', { food: [4, 2.4] });
item(I.RAW_PORK, 'Raw Porkchop', { food: [3, 1.8] });
item(I.COOKED_PORK, 'Cooked Porkchop', { food: [8, 12.8] });
item(I.RAW_BEEF, 'Raw Beef', { food: [3, 1.8] });
item(I.COOKED_BEEF, 'Steak', { food: [8, 12.8] });
item(I.RAW_MUTTON, 'Raw Mutton', { food: [2, 1.2] });
item(I.COOKED_MUTTON, 'Cooked Mutton', { food: [6, 9.6] });
item(I.RAW_CHICKEN, 'Raw Chicken', { food: [2, 1.2] });
item(I.COOKED_CHICKEN, 'Cooked Chicken', { food: [6, 7.2] });
item(I.ROTTEN_FLESH, 'Rotten Flesh', { food: [4, 0.8], rotten: true });
item(I.BONE, 'Bone');
item(I.BONE_MEAL, 'Bone Meal');

const TIERS = [
  ['WOOD', 'Wooden', 1, 2, 59, [4, 3, 2, 1.5]],
  ['STONE', 'Stone', 2, 4, 131, [5, 4, 3, 2.5]],
  ['IRON', 'Iron', 3, 6, 250, [6, 5, 4, 3.5]],
  ['DIAMOND', 'Diamond', 4, 8, 1561, [7, 6, 5, 4.5]],
];
for (const [key, label, tier, speed, dur, dmg] of TIERS) {
  const mk = (type, name, di, suffix) => item(I[`${key}_${suffix}`], `${label} ${name}`, {
    stack: 1, tool: type, tier, speed, durability: dur, damage: dmg[di], toolTier: key.toLowerCase(),
  });
  mk('sword', 'Sword', 0, 'SWORD');
  mk('axe', 'Axe', 1, 'AXE');
  mk('pickaxe', 'Pickaxe', 2, 'PICKAXE');
  mk('shovel', 'Shovel', 3, 'SHOVEL');
}

// ---- derived lookup tables ---------------------------------------------------------------------
for (const d of DEFS) {
  if (!d || d.kind !== 'block') continue;
  OPACITY[d.id] = d.opacity;
  OPAQUE[d.id] = d.shape === S_CUBE && d.opacity === 15 ? 1 : 0;
  SOLID[d.id] = d.solid ? 1 : 0;
  EMIT[d.id] = d.emit;
  SHAPE[d.id] = d.shape;
  LIQUID[d.id] = d.shape === S_WATER || d.shape === S_LAVA ? 1 : 0;
}
// tile name for flat sprites in icons
for (const d of DEFS) {
  if (d && d.kind === 'block' && (d.shape === S_CROSS || d.shape === S_TORCH)) d.flatIcon = d.tileSide;
}

export const isBlockId = (id) => id > 0 && id < 256;
export const def = (id) => DEFS[id];
export const isTool = (id) => !!(DEFS[id] && DEFS[id].tool);
export const maxStack = (id) => (DEFS[id] ? DEFS[id].stack : 64);
export const isLog = (id) => !!(DEFS[id] && DEFS[id].log);
export const isLeaves = (id) => !!(DEFS[id] && DEFS[id].leaves);
export const isPlant = (id) => !!(DEFS[id] && DEFS[id].plant);

// All obtainable things for creative inventory, grouped
export const CREATIVE_BLOCKS = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.STONE_BRICKS, B.BRICKS, B.DEEPSLATE, B.SAND, B.SANDSTONE, B.GRAVEL,
  B.PLANKS, B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.GLASS, B.WOOL,
  B.SNOW, B.SNOW_GRASS, B.ICE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.BEDROCK, B.CACTUS,
  B.TALL_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW, B.DEAD_BUSH, B.SAPLING,
  B.CRAFTING_TABLE, B.FURNACE, B.CHEST, B.TORCH, B.BED, B.TNT,
];
export const CREATIVE_ITEMS = [
  I.STICK, I.COAL, I.CHARCOAL, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND, I.FLINT, I.FLINT_STEEL, I.GUNPOWDER, I.BONE, I.BONE_MEAL,
  I.WOOD_PICKAXE, I.WOOD_AXE, I.WOOD_SHOVEL, I.WOOD_SWORD, I.STONE_PICKAXE, I.STONE_AXE, I.STONE_SHOVEL, I.STONE_SWORD,
  I.IRON_PICKAXE, I.IRON_AXE, I.IRON_SHOVEL, I.IRON_SWORD, I.DIAMOND_PICKAXE, I.DIAMOND_AXE, I.DIAMOND_SHOVEL, I.DIAMOND_SWORD,
  I.APPLE, I.RAW_PORK, I.COOKED_PORK, I.RAW_BEEF, I.COOKED_BEEF, I.RAW_MUTTON, I.COOKED_MUTTON, I.RAW_CHICKEN, I.COOKED_CHICKEN, I.ROTTEN_FLESH,
];

export function dropsFor(id, rnd, canHarvest = true) {
  const d = DEFS[id];
  if (!d || d.noDrop || !canHarvest) return [];
  const out = [];
  if (d.drops === undefined) { out.push([id, 1]); return out; }
  // entries flagged `replace` (4th element) override the normal drops when they trigger
  for (const e of d.drops) {
    if (e[3] && rnd() < (e[2] === undefined ? 1 : e[2])) return [[e[0], e[1]]];
  }
  for (const e of d.drops) {
    if (e[3]) continue;
    const chance = e[2] === undefined ? 1 : e[2];
    if (rnd() < chance) out.push([e[0], e[1]]);
  }
  return out;
}
