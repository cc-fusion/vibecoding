// Block and item registry. IDs < 100 are blocks, >= 100 are items.

export const enum B {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  GRASS = 3,
  SAND = 4,
  GRAVEL = 5,
  WATER = 6,
  LOG = 7,
  LEAVES = 8,
  PLANKS = 9,
  COBBLE = 10,
  BEDROCK = 11,
  COAL_ORE = 12,
  IRON_ORE = 13,
  GOLD_ORE = 14,
  DIAMOND_ORE = 15,
  GLASS = 16,
  TORCH = 17,
  CRAFTING_TABLE = 18,
  FURNACE = 19,
  SNOW_GRASS = 20,
  SNOW = 21,
  ICE = 22,
  CACTUS = 23,
  FLOWER_RED = 24,
  FLOWER_YELLOW = 25,
  TALL_GRASS = 26,
  SANDSTONE = 27,
  BIRCH_LOG = 28,
  BIRCH_LEAVES = 29,
  BRICK = 30,
  GLOWSTONE = 31,
  LAVA = 32,
  CLAY = 33,
  WOOL = 34,
  BOOKSHELF = 35,
  STONE_BRICK = 36,
  DEAD_BUSH = 37,
  SPRUCE_LOG = 38,
  SPRUCE_LEAVES = 39,
  BED = 40,
  MUSHROOM = 41,
  PUMPKIN = 42,
  LANTERN = 43,
  MOSSY_COBBLE = 44,
  BIRCH_PLANKS = 45,
  SPRUCE_PLANKS = 46,
}

export const enum I {
  STICK = 100,
  COAL = 101,
  IRON_INGOT = 102,
  GOLD_INGOT = 103,
  DIAMOND = 104,
  WOOD_PICKAXE = 110,
  STONE_PICKAXE = 111,
  IRON_PICKAXE = 112,
  DIAMOND_PICKAXE = 113,
  WOOD_AXE = 114,
  STONE_AXE = 115,
  IRON_AXE = 116,
  DIAMOND_AXE = 117,
  WOOD_SHOVEL = 118,
  STONE_SHOVEL = 119,
  IRON_SHOVEL = 120,
  DIAMOND_SHOVEL = 121,
  WOOD_SWORD = 122,
  STONE_SWORD = 123,
  IRON_SWORD = 124,
  DIAMOND_SWORD = 125,
  PORKCHOP = 130,
  COOKED_PORKCHOP = 131,
  BEEF = 132,
  STEAK = 133,
  MUTTON = 134,
  COOKED_MUTTON = 135,
  APPLE = 136,
  MUSHROOM_STEW = 137,
  BOWL = 138,
}

export type Shape = "cube" | "cross" | "liquid";
export type ToolType = "pickaxe" | "axe" | "shovel" | "sword" | "none";
export type SoundMat = "stone" | "wood" | "grass" | "sand" | "glass" | "cloth" | "snow" | "liquid" | "gravel";

export interface BlockDef {
  id: number;
  name: string;
  /** texture tile names: [top, bottom, side] or [px, nx, py, ny, pz, nz] */
  tex: string[];
  shape: Shape;
  solid: boolean; // collides
  opaque: boolean; // blocks light & culls neighbors
  cullSame?: boolean; // cull faces between same-type blocks (glass, water, leaves)
  hardness: number; // seconds with bare hand baseline
  tool: ToolType;
  minTier: number; // 0 hand, 1 wood, 2 stone, 3 iron, 4 diamond
  drop?: number | ((rand: number) => { id: number; count: number } | null);
  light: number; // 0..15 emitted
  tint?: "grass" | "foliage" | "water";
  sound: SoundMat;
  damage?: number; // contact damage per second (lava)
  interact?: "crafting" | "furnace" | "bed";
  creativeOnly?: boolean;
}

export interface ItemDef {
  id: number;
  name: string;
  tex: string;
  stack: number;
  tool?: { type: ToolType; tier: number; speed: number; damage: number; durability: number };
  food?: number;
  foodSaturation?: number;
}

const blocks: BlockDef[] = [];
const items: ItemDef[] = [];

function block(def: Partial<BlockDef> & { id: number; name: string; tex: string[] }): void {
  blocks[def.id] = {
    shape: "cube",
    solid: true,
    opaque: true,
    hardness: 1,
    tool: "none",
    minTier: 0,
    light: 0,
    sound: "stone",
    ...def,
  } as BlockDef;
}
function item(def: Partial<ItemDef> & { id: number; name: string; tex: string }): void {
  items[def.id] = { stack: 64, ...def } as ItemDef;
}

block({ id: B.STONE, name: "Stone", tex: ["stone"], hardness: 1.5, tool: "pickaxe", minTier: 1, drop: B.COBBLE });
block({ id: B.DIRT, name: "Dirt", tex: ["dirt"], hardness: 0.5, tool: "shovel", sound: "grass" });
block({ id: B.GRASS, name: "Grass Block", tex: ["grass_top", "dirt", "grass_side"], hardness: 0.6, tool: "shovel", drop: B.DIRT, tint: "grass", sound: "grass" });
block({ id: B.SAND, name: "Sand", tex: ["sand"], hardness: 0.5, tool: "shovel", sound: "sand" });
block({ id: B.GRAVEL, name: "Gravel", tex: ["gravel"], hardness: 0.6, tool: "shovel", sound: "gravel" });
block({ id: B.WATER, name: "Water", tex: ["water"], shape: "liquid", solid: false, opaque: false, cullSame: true, hardness: 100, tint: "water", sound: "liquid", creativeOnly: true });
block({ id: B.LOG, name: "Oak Log", tex: ["log_top", "log_top", "log_side"], hardness: 2, tool: "axe", sound: "wood" });
block({ id: B.LEAVES, name: "Oak Leaves", tex: ["leaves"], opaque: false, cullSame: true, hardness: 0.2, tint: "foliage", sound: "grass", drop: (r) => (r < 0.08 ? { id: I.APPLE, count: 1 } : r < 0.2 ? { id: I.STICK, count: 1 } : null) });
block({ id: B.PLANKS, name: "Oak Planks", tex: ["planks"], hardness: 2, tool: "axe", sound: "wood" });
block({ id: B.COBBLE, name: "Cobblestone", tex: ["cobble"], hardness: 2, tool: "pickaxe", minTier: 1 });
block({ id: B.BEDROCK, name: "Bedrock", tex: ["bedrock"], hardness: Infinity, tool: "pickaxe", minTier: 99, creativeOnly: true });
block({ id: B.COAL_ORE, name: "Coal Ore", tex: ["coal_ore"], hardness: 3, tool: "pickaxe", minTier: 1, drop: I.COAL });
block({ id: B.IRON_ORE, name: "Iron Ore", tex: ["iron_ore"], hardness: 3, tool: "pickaxe", minTier: 2 });
block({ id: B.GOLD_ORE, name: "Gold Ore", tex: ["gold_ore"], hardness: 3, tool: "pickaxe", minTier: 3 });
block({ id: B.DIAMOND_ORE, name: "Diamond Ore", tex: ["diamond_ore"], hardness: 3, tool: "pickaxe", minTier: 3, drop: I.DIAMOND });
block({ id: B.GLASS, name: "Glass", tex: ["glass"], opaque: false, cullSame: true, hardness: 0.3, sound: "glass", drop: () => null });
block({ id: B.TORCH, name: "Torch", tex: ["torch"], shape: "cross", solid: false, opaque: false, hardness: 0.05, light: 14, sound: "wood" });
block({ id: B.CRAFTING_TABLE, name: "Crafting Table", tex: ["table_top", "planks", "table_side"], hardness: 2.5, tool: "axe", sound: "wood", interact: "crafting" });
block({ id: B.FURNACE, name: "Furnace", tex: ["furnace_top", "furnace_top", "furnace_front", "furnace_side"], hardness: 3.5, tool: "pickaxe", minTier: 1, interact: "furnace" });
block({ id: B.SNOW_GRASS, name: "Snowy Grass", tex: ["snow", "dirt", "snow_grass_side"], hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "snow" });
block({ id: B.SNOW, name: "Snow Block", tex: ["snow"], hardness: 0.2, tool: "shovel", sound: "snow" });
block({ id: B.ICE, name: "Ice", tex: ["ice"], opaque: false, cullSame: true, hardness: 0.5, tool: "pickaxe", sound: "glass", drop: () => null });
block({ id: B.CACTUS, name: "Cactus", tex: ["cactus_top", "cactus_top", "cactus_side"], opaque: false, hardness: 0.4, sound: "cloth", damage: 1 });
block({ id: B.FLOWER_RED, name: "Poppy", tex: ["flower_red"], shape: "cross", solid: false, opaque: false, hardness: 0, sound: "grass" });
block({ id: B.FLOWER_YELLOW, name: "Dandelion", tex: ["flower_yellow"], shape: "cross", solid: false, opaque: false, hardness: 0, sound: "grass" });
block({ id: B.TALL_GRASS, name: "Tall Grass", tex: ["tall_grass"], shape: "cross", solid: false, opaque: false, hardness: 0, tint: "grass", sound: "grass", drop: () => null });
block({ id: B.SANDSTONE, name: "Sandstone", tex: ["sandstone_top", "sandstone_top", "sandstone_side"], hardness: 0.8, tool: "pickaxe", minTier: 1 });
block({ id: B.BIRCH_LOG, name: "Birch Log", tex: ["birch_top", "birch_top", "birch_side"], hardness: 2, tool: "axe", sound: "wood" });
block({ id: B.BIRCH_LEAVES, name: "Birch Leaves", tex: ["birch_leaves"], opaque: false, cullSame: true, hardness: 0.2, tint: "foliage", sound: "grass", drop: (r) => (r < 0.15 ? { id: I.STICK, count: 1 } : null) });
block({ id: B.BRICK, name: "Bricks", tex: ["brick"], hardness: 2, tool: "pickaxe", minTier: 1 });
block({ id: B.GLOWSTONE, name: "Glowstone", tex: ["glowstone"], hardness: 0.3, light: 15, sound: "glass" });
block({ id: B.LAVA, name: "Lava", tex: ["lava"], shape: "liquid", solid: false, opaque: false, cullSame: true, hardness: 100, light: 15, sound: "liquid", damage: 4, creativeOnly: true });
block({ id: B.CLAY, name: "Clay", tex: ["clay"], hardness: 0.6, tool: "shovel", sound: "gravel" });
block({ id: B.WOOL, name: "Wool", tex: ["wool"], hardness: 0.8, sound: "cloth" });
block({ id: B.BOOKSHELF, name: "Bookshelf", tex: ["planks", "planks", "bookshelf"], hardness: 1.5, tool: "axe", sound: "wood" });
block({ id: B.STONE_BRICK, name: "Stone Bricks", tex: ["stone_brick"], hardness: 1.5, tool: "pickaxe", minTier: 1 });
block({ id: B.DEAD_BUSH, name: "Dead Bush", tex: ["dead_bush"], shape: "cross", solid: false, opaque: false, hardness: 0, sound: "grass", drop: (r) => (r < 0.5 ? { id: I.STICK, count: 1 } : null) });
block({ id: B.SPRUCE_LOG, name: "Spruce Log", tex: ["spruce_top", "spruce_top", "spruce_side"], hardness: 2, tool: "axe", sound: "wood" });
block({ id: B.SPRUCE_LEAVES, name: "Spruce Needles", tex: ["spruce_leaves"], opaque: false, cullSame: true, hardness: 0.2, sound: "grass", drop: (r) => (r < 0.15 ? { id: I.STICK, count: 1 } : null) });
block({ id: B.BED, name: "Bed", tex: ["bed_top", "planks", "bed_side"], hardness: 0.3, sound: "cloth", interact: "bed" });
block({ id: B.MUSHROOM, name: "Mushroom", tex: ["mushroom"], shape: "cross", solid: false, opaque: false, hardness: 0, sound: "grass" });
block({ id: B.PUMPKIN, name: "Pumpkin", tex: ["pumpkin_top", "pumpkin_top", "pumpkin_side"], hardness: 1, tool: "axe", sound: "wood" });
block({ id: B.LANTERN, name: "Lantern", tex: ["lantern"], shape: "cross", solid: false, opaque: false, hardness: 0.3, light: 15, sound: "glass" });
block({ id: B.MOSSY_COBBLE, name: "Mossy Cobblestone", tex: ["mossy_cobble"], hardness: 2, tool: "pickaxe", minTier: 1 });
block({ id: B.BIRCH_PLANKS, name: "Birch Planks", tex: ["birch_planks"], hardness: 2, tool: "axe", sound: "wood" });
block({ id: B.SPRUCE_PLANKS, name: "Spruce Planks", tex: ["spruce_planks"], hardness: 2, tool: "axe", sound: "wood" });

item({ id: I.STICK, name: "Stick", tex: "stick" });
item({ id: I.COAL, name: "Coal", tex: "coal" });
item({ id: I.IRON_INGOT, name: "Iron Ingot", tex: "iron_ingot" });
item({ id: I.GOLD_INGOT, name: "Gold Ingot", tex: "gold_ingot" });
item({ id: I.DIAMOND, name: "Diamond", tex: "diamond" });

const tiers = [
  { n: "Wooden", tier: 1, speed: 2, dmg: 1, dur: 60 },
  { n: "Stone", tier: 2, speed: 4, dmg: 2, dur: 132 },
  { n: "Iron", tier: 3, speed: 6, dmg: 3, dur: 251 },
  { n: "Diamond", tier: 4, speed: 8, dmg: 4, dur: 1562 },
];
const toolKinds: { type: ToolType; base: number; label: string; dmg: number }[] = [
  { type: "pickaxe", base: I.WOOD_PICKAXE, label: "Pickaxe", dmg: 2 },
  { type: "axe", base: I.WOOD_AXE, label: "Axe", dmg: 3 },
  { type: "shovel", base: I.WOOD_SHOVEL, label: "Shovel", dmg: 1 },
  { type: "sword", base: I.WOOD_SWORD, label: "Sword", dmg: 4 },
];
for (const k of toolKinds) {
  tiers.forEach((t, i) => {
    item({
      id: k.base + i,
      name: `${t.n} ${k.label}`,
      tex: `${k.type}_${i}`,
      stack: 1,
      tool: { type: k.type, tier: t.tier, speed: t.speed, damage: k.dmg + t.dmg, durability: t.dur },
    });
  });
}

item({ id: I.PORKCHOP, name: "Raw Porkchop", tex: "porkchop", food: 3 });
item({ id: I.COOKED_PORKCHOP, name: "Cooked Porkchop", tex: "cooked_porkchop", food: 8 });
item({ id: I.BEEF, name: "Raw Beef", tex: "beef", food: 3 });
item({ id: I.STEAK, name: "Steak", tex: "steak", food: 8 });
item({ id: I.MUTTON, name: "Raw Mutton", tex: "mutton", food: 2 });
item({ id: I.COOKED_MUTTON, name: "Cooked Mutton", tex: "cooked_mutton", food: 6 });
item({ id: I.APPLE, name: "Apple", tex: "apple", food: 4 });
item({ id: I.MUSHROOM_STEW, name: "Mushroom Stew", tex: "stew", food: 6, stack: 1 });
item({ id: I.BOWL, name: "Bowl", tex: "bowl" });

export const BLOCKS = blocks;
export const ITEMS = items;

export function isBlock(id: number): boolean {
  return id > 0 && id < 100 && !!blocks[id];
}
export function getName(id: number): string {
  return id < 100 ? blocks[id]?.name ?? "?" : items[id]?.name ?? "?";
}
export function getStackSize(id: number): number {
  return id < 100 ? 64 : items[id]?.stack ?? 64;
}
export function getTex(id: number): string {
  return id < 100 ? blocks[id].tex[0] : items[id].tex;
}
export function getTool(id: number) {
  return id >= 100 ? items[id]?.tool : undefined;
}
export function getFood(id: number) {
  return id >= 100 ? items[id]?.food : undefined;
}

/** Opaque lookup table for fast meshing/lighting. */
export const OPAQUE = new Uint8Array(100);
export const SOLID = new Uint8Array(100);
export const LIGHT = new Uint8Array(100);
export const LIGHT_ATTEN = new Uint8Array(100); // extra light attenuation (water, leaves)
for (let i = 1; i < 100; i++) {
  const b = blocks[i];
  if (!b) continue;
  OPAQUE[i] = b.opaque ? 1 : 0;
  SOLID[i] = b.solid ? 1 : 0;
  LIGHT[i] = b.light;
  if (b.id === B.WATER) LIGHT_ATTEN[i] = 2;
  else if (b.id === B.LEAVES || b.id === B.BIRCH_LEAVES || b.id === B.SPRUCE_LEAVES) LIGHT_ATTEN[i] = 1;
  else if (b.id === B.ICE) LIGHT_ATTEN[i] = 1;
}

/** All block ids that can appear in the creative palette / survival placement. */
export const PLACEABLE_BLOCKS: number[] = blocks.filter((b) => b && b.id !== B.AIR).map((b) => b.id);
export const CREATIVE_ITEMS: number[] = [
  ...PLACEABLE_BLOCKS.filter((id) => id !== B.BEDROCK),
  ...items.filter((it) => !!it).map((it) => it.id),
];
