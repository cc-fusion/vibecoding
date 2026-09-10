// Block & item definitions for the voxel world.
// Block ids are < 128, item ids are >= 128. Both share one "item id" space for inventories.

export const enum B {
  AIR = 0,
  STONE = 1,
  GRASS = 2,
  DIRT = 3,
  COBBLE = 4,
  OAK_PLANKS = 5,
  SAND = 6,
  GRAVEL = 7,
  WATER = 8,
  OAK_LOG = 9,
  OAK_LEAVES = 10,
  BIRCH_LOG = 11,
  BIRCH_LEAVES = 12,
  SPRUCE_LOG = 13,
  SPRUCE_LEAVES = 14,
  GLASS = 15,
  BEDROCK = 16,
  COAL_ORE = 17,
  IRON_ORE = 18,
  GOLD_ORE = 19,
  DIAMOND_ORE = 20,
  SNOW = 21,
  SNOWY_GRASS = 22,
  CACTUS = 23,
  TALL_GRASS = 24,
  FLOWER_RED = 25,
  FLOWER_YELLOW = 26,
  TORCH = 27,
  CRAFTING_TABLE = 28,
  FURNACE = 29,
  BRICKS = 30,
  STONE_BRICKS = 31,
  SANDSTONE = 32,
  GLOWSTONE = 33,
  LAVA = 34,
  MUSHROOM = 35,
  DEAD_BUSH = 36,
  BIRCH_PLANKS = 37,
  SPRUCE_PLANKS = 38,
  SMOOTH_STONE = 39,
  MOSSY_COBBLE = 40,
  CLAY = 41,
  ICE = 42,
  COAL_BLOCK = 43,
  IRON_BLOCK = 44,
  GOLD_BLOCK = 45,
  DIAMOND_BLOCK = 46,
  BOOKSHELF = 47,
  PUMPKIN = 48,
}

export const enum I {
  STICK = 128,
  COAL = 129,
  IRON_INGOT = 130,
  GOLD_INGOT = 131,
  DIAMOND = 132,
  APPLE = 133,
  CLAY_BALL = 134,
  BRICK = 135,
  WOOD_PICKAXE = 140,
  STONE_PICKAXE = 141,
  IRON_PICKAXE = 142,
  GOLD_PICKAXE = 143,
  DIAMOND_PICKAXE = 144,
  WOOD_AXE = 145,
  STONE_AXE = 146,
  IRON_AXE = 147,
  GOLD_AXE = 148,
  DIAMOND_AXE = 149,
  WOOD_SHOVEL = 150,
  STONE_SHOVEL = 151,
  IRON_SHOVEL = 152,
  GOLD_SHOVEL = 153,
  DIAMOND_SHOVEL = 154,
}

export type ToolKind = "pickaxe" | "axe" | "shovel";
export type SoundKind = "stone" | "wood" | "grass" | "sand" | "gravel" | "glass" | "cloth" | "snow";
export type BlockModel = "cube" | "cross" | "liquid";

export interface BlockDef {
  id: number;
  name: string;
  /** texture names for faces: +X, -X, +Y, -Y, +Z, -Z */
  tex: [string, string, string, string, string, string];
  model: BlockModel;
  solid: boolean; // collides with player
  opaque: boolean; // blocks light & hides neighbouring faces
  hardness: number; // seconds to break by hand (base)
  tool: ToolKind | null; // preferred tool
  minTier: number; // minimum pickaxe tier required to get a drop (0 = none)
  drop: number | null; // item id dropped (null = nothing, undefined = itself)
  dropCount: [number, number];
  dropChance: number;
  light: number; // emitted light 0..15
  sound: SoundKind;
  replaceable: boolean; // can be overwritten when placing (grass, water)
  unbreakable?: boolean;
  damage?: number; // contact damage per second
}

export interface ItemDef {
  id: number;
  name: string;
  tex: string;
  stack: number;
  tool?: { kind: ToolKind; tier: number; speed: number; durability: number };
  food?: number;
}

const six = (t: string): BlockDef["tex"] => [t, t, t, t, t, t];
const tsb = (top: string, side: string, bottom: string): BlockDef["tex"] => [side, side, top, bottom, side, side];

type Partial = { [K in keyof BlockDef]?: BlockDef[K] };

function block(id: number, name: string, tex: BlockDef["tex"], p: Partial = {}): BlockDef {
  return {
    id,
    name,
    tex,
    model: "cube",
    solid: true,
    opaque: true,
    hardness: 1,
    tool: null,
    minTier: 0,
    drop: id,
    dropCount: [1, 1],
    dropChance: 1,
    light: 0,
    sound: "stone",
    replaceable: false,
    ...p,
  };
}

const plant = (id: number, name: string, tex: string, p: Partial = {}) =>
  block(id, name, six(tex), {
    model: "cross",
    solid: false,
    opaque: false,
    hardness: 0,
    sound: "grass",
    replaceable: true,
    ...p,
  });

export const BLOCKS: BlockDef[] = [];
function reg(b: BlockDef) {
  BLOCKS[b.id] = b;
}

reg(block(B.AIR, "Air", six("stone"), { solid: false, opaque: false, drop: null, replaceable: true }));
reg(block(B.STONE, "Stone", six("stone"), { hardness: 1.5, tool: "pickaxe", minTier: 1, drop: B.COBBLE }));
reg(block(B.GRASS, "Grass Block", tsb("grass_top", "grass_side", "dirt"), { hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "grass" }));
reg(block(B.DIRT, "Dirt", six("dirt"), { hardness: 0.5, tool: "shovel", sound: "gravel" }));
reg(block(B.COBBLE, "Cobblestone", six("cobble"), { hardness: 2, tool: "pickaxe", minTier: 1 }));
reg(block(B.OAK_PLANKS, "Oak Planks", six("oak_planks"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.SAND, "Sand", six("sand"), { hardness: 0.5, tool: "shovel", sound: "sand" }));
reg(block(B.GRAVEL, "Gravel", six("gravel"), { hardness: 0.6, tool: "shovel", sound: "gravel" }));
reg(block(B.WATER, "Water", six("water"), { model: "liquid", solid: false, opaque: false, hardness: 100, drop: null, replaceable: true, unbreakable: true }));
reg(block(B.OAK_LOG, "Oak Log", tsb("oak_log_top", "oak_log", "oak_log_top"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.OAK_LEAVES, "Oak Leaves", six("oak_leaves"), { opaque: false, hardness: 0.2, sound: "grass", drop: I.APPLE, dropChance: 0.12 }));
reg(block(B.BIRCH_LOG, "Birch Log", tsb("birch_log_top", "birch_log", "birch_log_top"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.BIRCH_LEAVES, "Birch Leaves", six("birch_leaves"), { opaque: false, hardness: 0.2, sound: "grass", drop: I.STICK, dropChance: 0.1 }));
reg(block(B.SPRUCE_LOG, "Spruce Log", tsb("spruce_log_top", "spruce_log", "spruce_log_top"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.SPRUCE_LEAVES, "Spruce Leaves", six("spruce_leaves"), { opaque: false, hardness: 0.2, sound: "grass", drop: I.STICK, dropChance: 0.1 }));
reg(block(B.GLASS, "Glass", six("glass"), { opaque: false, hardness: 0.3, drop: null, sound: "glass" }));
reg(block(B.BEDROCK, "Bedrock", six("bedrock"), { hardness: 1e9, unbreakable: true, drop: null }));
reg(block(B.COAL_ORE, "Coal Ore", six("coal_ore"), { hardness: 3, tool: "pickaxe", minTier: 1, drop: I.COAL }));
reg(block(B.IRON_ORE, "Iron Ore", six("iron_ore"), { hardness: 3, tool: "pickaxe", minTier: 2 }));
reg(block(B.GOLD_ORE, "Gold Ore", six("gold_ore"), { hardness: 3, tool: "pickaxe", minTier: 3 }));
reg(block(B.DIAMOND_ORE, "Diamond Ore", six("diamond_ore"), { hardness: 3, tool: "pickaxe", minTier: 3, drop: I.DIAMOND }));
reg(block(B.SNOW, "Snow Block", six("snow"), { hardness: 0.2, tool: "shovel", sound: "snow" }));
reg(block(B.SNOWY_GRASS, "Snowy Grass", tsb("snow", "snowy_grass_side", "dirt"), { hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "snow" }));
reg(block(B.CACTUS, "Cactus", tsb("cactus_top", "cactus_side", "cactus_top"), { opaque: false, hardness: 0.4, sound: "cloth", damage: 1 }));
reg(plant(B.TALL_GRASS, "Tall Grass", "tall_grass", { drop: null }));
reg(plant(B.FLOWER_RED, "Poppy", "flower_red"));
reg(plant(B.FLOWER_YELLOW, "Dandelion", "flower_yellow"));
reg(plant(B.TORCH, "Torch", "torch", { light: 14, replaceable: false, sound: "wood" }));
reg(block(B.CRAFTING_TABLE, "Crafting Table", tsb("crafting_table_top", "crafting_table_side", "oak_planks"), { hardness: 2.5, tool: "axe", sound: "wood" }));
reg(block(B.FURNACE, "Furnace", tsb("furnace_top", "furnace_side", "furnace_top"), { hardness: 3.5, tool: "pickaxe", minTier: 1 }));
reg(block(B.BRICKS, "Bricks", six("bricks"), { hardness: 2, tool: "pickaxe", minTier: 1 }));
reg(block(B.STONE_BRICKS, "Stone Bricks", six("stone_bricks"), { hardness: 1.5, tool: "pickaxe", minTier: 1 }));
reg(block(B.SANDSTONE, "Sandstone", tsb("sandstone_top", "sandstone_side", "sandstone_top"), { hardness: 0.8, tool: "pickaxe", minTier: 1 }));
reg(block(B.GLOWSTONE, "Glowstone", six("glowstone"), { hardness: 0.3, light: 15, sound: "glass" }));
reg(block(B.LAVA, "Lava", six("lava"), { model: "liquid", solid: false, opaque: false, hardness: 100, drop: null, replaceable: true, unbreakable: true, light: 15, damage: 4 }));
reg(plant(B.MUSHROOM, "Mushroom", "mushroom", { replaceable: false }));
reg(plant(B.DEAD_BUSH, "Dead Bush", "dead_bush", { drop: I.STICK, dropCount: [0, 2] }));
reg(block(B.BIRCH_PLANKS, "Birch Planks", six("birch_planks"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.SPRUCE_PLANKS, "Spruce Planks", six("spruce_planks"), { hardness: 2, tool: "axe", sound: "wood" }));
reg(block(B.SMOOTH_STONE, "Smooth Stone", six("smooth_stone"), { hardness: 2, tool: "pickaxe", minTier: 1 }));
reg(block(B.MOSSY_COBBLE, "Mossy Cobblestone", six("mossy_cobble"), { hardness: 2, tool: "pickaxe", minTier: 1 }));
reg(block(B.CLAY, "Clay", six("clay"), { hardness: 0.6, tool: "shovel", drop: I.CLAY_BALL, dropCount: [4, 4], sound: "gravel" }));
reg(block(B.ICE, "Ice", six("ice"), { hardness: 0.5, tool: "pickaxe", drop: null, sound: "glass" }));
reg(block(B.COAL_BLOCK, "Block of Coal", six("coal_block"), { hardness: 5, tool: "pickaxe", minTier: 1 }));
reg(block(B.IRON_BLOCK, "Block of Iron", six("iron_block"), { hardness: 5, tool: "pickaxe", minTier: 2 }));
reg(block(B.GOLD_BLOCK, "Block of Gold", six("gold_block"), { hardness: 3, tool: "pickaxe", minTier: 3 }));
reg(block(B.DIAMOND_BLOCK, "Block of Diamond", six("diamond_block"), { hardness: 5, tool: "pickaxe", minTier: 3 }));
reg(block(B.BOOKSHELF, "Bookshelf", tsb("oak_planks", "bookshelf", "oak_planks"), { hardness: 1.5, tool: "axe", sound: "wood" }));
reg(block(B.PUMPKIN, "Pumpkin", tsb("pumpkin_top", "pumpkin_side", "pumpkin_top"), { hardness: 1, tool: "axe", sound: "wood" }));

export const ITEMS: ItemDef[] = [];
function item(d: ItemDef) {
  ITEMS[d.id] = d;
}
item({ id: I.STICK, name: "Stick", tex: "stick", stack: 64 });
item({ id: I.COAL, name: "Coal", tex: "coal", stack: 64 });
item({ id: I.IRON_INGOT, name: "Iron Ingot", tex: "iron_ingot", stack: 64 });
item({ id: I.GOLD_INGOT, name: "Gold Ingot", tex: "gold_ingot", stack: 64 });
item({ id: I.DIAMOND, name: "Diamond", tex: "diamond", stack: 64 });
item({ id: I.APPLE, name: "Apple", tex: "apple", stack: 64, food: 4 });
item({ id: I.CLAY_BALL, name: "Clay Ball", tex: "clay_ball", stack: 64 });
item({ id: I.BRICK, name: "Brick", tex: "brick", stack: 64 });

export const TIER_NAMES = ["", "Wooden", "Stone", "Iron", "Golden", "Diamond"];
// tier => mining level (gold mines like wood but fast)
const TIER_LEVEL = [0, 1, 2, 3, 1, 4];
const TIER_SPEED = [1, 2, 4, 6, 12, 8];
const TIER_DURABILITY = [0, 60, 132, 251, 33, 1562];

const toolKinds: ToolKind[] = ["pickaxe", "axe", "shovel"];
const toolBase = { pickaxe: I.WOOD_PICKAXE, axe: I.WOOD_AXE, shovel: I.WOOD_SHOVEL };
const kindLabel = { pickaxe: "Pickaxe", axe: "Axe", shovel: "Shovel" };
for (const kind of toolKinds) {
  for (let tier = 1; tier <= 5; tier++) {
    const id = toolBase[kind] + tier - 1;
    item({
      id,
      name: `${TIER_NAMES[tier]} ${kindLabel[kind]}`,
      tex: `${kind}_${tier}`,
      stack: 1,
      tool: { kind, tier: TIER_LEVEL[tier], speed: TIER_SPEED[tier], durability: TIER_DURABILITY[tier] },
    });
  }
}

export function isBlock(id: number) {
  return id > 0 && id < 128 && !!BLOCKS[id];
}
export function itemName(id: number): string {
  if (id < 128) return BLOCKS[id]?.name ?? "Unknown";
  return ITEMS[id]?.name ?? "Unknown";
}
export function maxStack(id: number): number {
  if (id < 128) return 64;
  return ITEMS[id]?.stack ?? 64;
}
export function itemTexture(id: number): string {
  if (id < 128) return BLOCKS[id]?.tex[4] ?? "stone";
  return ITEMS[id]?.tex ?? "stick";
}
/** Blocks that a player may place (used by creative inventory) */
export const PLACEABLE_BLOCKS: number[] = BLOCKS.filter((b) => b && b.id !== B.AIR && b.id !== B.BEDROCK).map((b) => b.id);

// ---------------- Recipes ----------------
export interface Recipe {
  id: string;
  out: number;
  count: number;
  in: { id: number; n: number }[];
  station: "none" | "table" | "furnace";
}
export const RECIPES: Recipe[] = [];
let rid = 0;
function recipe(out: number, count: number, ins: [number, number][], station: Recipe["station"] = "none") {
  RECIPES.push({ id: "r" + rid++, out, count, in: ins.map(([id, n]) => ({ id, n })), station });
}
recipe(B.OAK_PLANKS, 4, [[B.OAK_LOG, 1]]);
recipe(B.BIRCH_PLANKS, 4, [[B.BIRCH_LOG, 1]]);
recipe(B.SPRUCE_PLANKS, 4, [[B.SPRUCE_LOG, 1]]);
recipe(I.STICK, 4, [[B.OAK_PLANKS, 2]]);
recipe(I.STICK, 4, [[B.BIRCH_PLANKS, 2]]);
recipe(I.STICK, 4, [[B.SPRUCE_PLANKS, 2]]);
recipe(B.CRAFTING_TABLE, 1, [[B.OAK_PLANKS, 4]]);
recipe(B.TORCH, 4, [[I.STICK, 1], [I.COAL, 1]]);
recipe(B.FURNACE, 1, [[B.COBBLE, 8]], "table");
const toolRecipes: [ToolKind, number, number][] = [
  ["pickaxe", 3, 2],
  ["axe", 3, 2],
  ["shovel", 1, 2],
];
const tierMat = [0, B.OAK_PLANKS, B.COBBLE, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND];
for (const [kind, mat, sticks] of toolRecipes) {
  for (let tier = 1; tier <= 5; tier++) {
    recipe(toolBase[kind] + tier - 1, 1, [[tierMat[tier], mat], [I.STICK, sticks]], "table");
  }
}
recipe(B.STONE_BRICKS, 4, [[B.STONE, 4]], "table");
recipe(B.SANDSTONE, 1, [[B.SAND, 4]], "table");
recipe(B.BRICKS, 1, [[I.BRICK, 4]], "table");
recipe(B.BOOKSHELF, 1, [[B.OAK_PLANKS, 6], [B.OAK_LEAVES, 3]], "table");
recipe(B.MOSSY_COBBLE, 1, [[B.COBBLE, 1], [B.TALL_GRASS, 1]], "table");
recipe(B.GLOWSTONE, 1, [[I.GOLD_INGOT, 1], [B.TORCH, 4]], "table");
recipe(B.COAL_BLOCK, 1, [[I.COAL, 9]], "table");
recipe(I.COAL, 9, [[B.COAL_BLOCK, 1]]);
recipe(B.IRON_BLOCK, 1, [[I.IRON_INGOT, 9]], "table");
recipe(I.IRON_INGOT, 9, [[B.IRON_BLOCK, 1]]);
recipe(B.GOLD_BLOCK, 1, [[I.GOLD_INGOT, 9]], "table");
recipe(I.GOLD_INGOT, 9, [[B.GOLD_BLOCK, 1]]);
recipe(B.DIAMOND_BLOCK, 1, [[I.DIAMOND, 9]], "table");
recipe(I.DIAMOND, 9, [[B.DIAMOND_BLOCK, 1]]);
recipe(B.SNOW, 1, [[B.ICE, 1], [B.SAND, 1]], "table");
// furnace (smelting) recipes: consume coal as fuel
recipe(B.GLASS, 4, [[B.SAND, 4], [I.COAL, 1]], "furnace");
recipe(B.STONE, 4, [[B.COBBLE, 4], [I.COAL, 1]], "furnace");
recipe(B.SMOOTH_STONE, 4, [[B.STONE, 4], [I.COAL, 1]], "furnace");
recipe(I.IRON_INGOT, 2, [[B.IRON_ORE, 2], [I.COAL, 1]], "furnace");
recipe(I.GOLD_INGOT, 2, [[B.GOLD_ORE, 2], [I.COAL, 1]], "furnace");
recipe(I.BRICK, 4, [[I.CLAY_BALL, 4], [I.COAL, 1]], "furnace");
recipe(I.COAL, 2, [[B.OAK_LOG, 2], [B.OAK_PLANKS, 2]], "furnace");
