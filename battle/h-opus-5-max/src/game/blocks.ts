// ───────────────────────────────────────────────────────────────────────────
//  Block + item registry
// ───────────────────────────────────────────────────────────────────────────
import { texId, cubeIcon, flatIcon, spriteIcon, TEX_NAMES } from "./textures";

export const enum B {
  AIR = 0,
  STONE,
  GRASS,
  DIRT,
  COBBLESTONE,
  MOSSY_COBBLESTONE,
  SAND,
  SANDSTONE,
  GRAVEL,
  CLAY,
  BEDROCK,
  WATER,
  LAVA,
  OAK_LOG,
  BIRCH_LOG,
  SPRUCE_LOG,
  OAK_LEAVES,
  BIRCH_LEAVES,
  SPRUCE_LEAVES,
  JUNGLE_LEAVES,
  OAK_PLANKS,
  BIRCH_PLANKS,
  SPRUCE_PLANKS,
  GLASS,
  BRICKS,
  STONE_BRICKS,
  COAL_ORE,
  IRON_ORE,
  GOLD_ORE,
  DIAMOND_ORE,
  REDSTONE_ORE,
  EMERALD_ORE,
  LAPIS_ORE,
  SNOW,
  ICE,
  CACTUS,
  TALL_GRASS,
  FERN,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_BLUE,
  DEAD_BUSH,
  MUSHROOM_RED,
  TORCH,
  LADDER,
  CRAFTING_TABLE,
  FURNACE,
  FURNACE_LIT,
  GLOWSTONE,
  OBSIDIAN,
  COAL_BLOCK,
  IRON_BLOCK,
  GOLD_BLOCK,
  DIAMOND_BLOCK,
  WOOL_WHITE,
  WOOL_RED,
  WOOL_BLUE,
  WOOL_YELLOW,
  WOOL_BLACK,
  PUMPKIN,
  OAK_SAPLING,
  SPRUCE_SAPLING,
  CHEST,
  COUNT,
}

export type RenderKind = "cube" | "cross" | "liquid" | "none";
export type ToolClass = "pickaxe" | "axe" | "shovel" | "sword" | "none";

export interface BlockDef {
  id: number;
  name: string;
  /** texture layer per face: +Y -Y +X -X +Z -Z */
  tex: number[];
  kind: RenderKind;
  /** blocks movement */
  solid: boolean;
  /** blocks light completely */
  opaque: boolean;
  /** attenuates skylight by 1 even if not opaque */
  dimming: number;
  light: number;
  liquid: boolean;
  hardness: number; // seconds at hand speed; -1 = unbreakable
  tool: ToolClass;
  /** min tool tier required to drop anything (0 = hand) */
  tier: number;
  drops?: string | null;
  dropCount?: [number, number];
  /** replaceable by placement / plant growth */
  replaceable?: boolean;
  /** needs a solid block below (plants) */
  needsSupport?: boolean;
  flammable?: boolean;
  slipperiness?: number;
  sound: "grass" | "stone" | "wood" | "sand" | "gravel" | "glass" | "wool" | "liquid";
}

const defs: BlockDef[] = [];

type BlockOpts = Omit<Partial<BlockDef>, "tex"> & { tex?: string | string[] };

function def(id: number, name: string, o: BlockOpts) {
  let tex: number[];
  const t = o.tex;
  if (!t) tex = [0, 0, 0, 0, 0, 0];
  else if (typeof t === "string") {
    const i = texId(t);
    tex = [i, i, i, i, i, i];
  } else if (t.length === 2) {
    const a = texId(t[0]),
      b = texId(t[1]);
    tex = [a, a, b, b, b, b];
  } else if (t.length === 3) {
    const a = texId(t[0]),
      b = texId(t[1]),
      c = texId(t[2]);
    tex = [a, b, c, c, c, c];
  } else tex = (t as string[]).map(texId);

  defs[id] = {
    id,
    name,
    kind: "cube",
    solid: true,
    opaque: true,
    dimming: 15,
    light: 0,
    liquid: false,
    hardness: 1,
    tool: "none",
    tier: 0,
    drops: undefined,
    dropCount: [1, 1],
    sound: "stone",
    ...(o as any),
    tex,
  } as BlockDef;
}

export function initBlocks() {
  if (defs.length) return;
  def(B.AIR, "Air", {
    kind: "none",
    solid: false,
    opaque: false,
    dimming: 0,
    hardness: -1,
    replaceable: true,
  });
  def(B.STONE, "Stone", {
    tex: "stone",
    hardness: 1.5,
    tool: "pickaxe",
    tier: 1,
    drops: "cobblestone",
  });
  def(B.GRASS, "Grass Block", {
    tex: ["grass_top", "dirt", "grass_side"],
    hardness: 0.6,
    tool: "shovel",
    drops: "dirt",
    sound: "grass",
  });
  def(B.DIRT, "Dirt", { tex: "dirt", hardness: 0.5, tool: "shovel", sound: "gravel" });
  def(B.COBBLESTONE, "Cobblestone", {
    tex: "cobblestone",
    hardness: 2,
    tool: "pickaxe",
    tier: 1,
  });
  def(B.MOSSY_COBBLESTONE, "Mossy Cobblestone", {
    tex: "mossy_cobblestone",
    hardness: 2,
    tool: "pickaxe",
    tier: 1,
  });
  def(B.SAND, "Sand", { tex: "sand", hardness: 0.5, tool: "shovel", sound: "sand" });
  def(B.SANDSTONE, "Sandstone", {
    tex: ["sandstone_top", "sandstone_top", "sandstone_side"],
    hardness: 0.8,
    tool: "pickaxe",
    tier: 1,
    sound: "sand",
  });
  def(B.GRAVEL, "Gravel", { tex: "gravel", hardness: 0.6, tool: "shovel", sound: "gravel" });
  def(B.CLAY, "Clay", { tex: "clay", hardness: 0.6, tool: "shovel", sound: "gravel" });
  def(B.BEDROCK, "Bedrock", { tex: "bedrock", hardness: -1 });
  def(B.WATER, "Water", {
    tex: "water",
    kind: "liquid",
    solid: false,
    opaque: false,
    dimming: 2,
    liquid: true,
    hardness: -1,
    replaceable: true,
    sound: "liquid",
  });
  def(B.LAVA, "Lava", {
    tex: "lava",
    kind: "liquid",
    solid: false,
    opaque: false,
    dimming: 1,
    liquid: true,
    light: 15,
    hardness: -1,
    replaceable: true,
    sound: "liquid",
  });
  def(B.OAK_LOG, "Oak Log", {
    tex: ["oak_log_top", "oak_log_top", "oak_log_side"],
    hardness: 2,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  def(B.BIRCH_LOG, "Birch Log", {
    tex: ["birch_log_top", "birch_log_top", "birch_log_side"],
    hardness: 2,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  def(B.SPRUCE_LOG, "Spruce Log", {
    tex: ["oak_log_top", "oak_log_top", "spruce_log_side"],
    hardness: 2,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  const leafCommon = {
    kind: "cube" as const,
    opaque: false,
    dimming: 1,
    hardness: 0.25,
    tool: "none" as const,
    sound: "grass" as const,
    flammable: true,
  };
  def(B.OAK_LEAVES, "Oak Leaves", { tex: "oak_leaves", ...leafCommon, drops: "oak_sapling" });
  def(B.OAK_SAPLING, "Oak Sapling", {
    tex: "sapling",
    kind: "cross",
    solid: false,
    opaque: false,
    dimming: 0,
    hardness: 0.05,
    needsSupport: true,
    sound: "grass",
    flammable: true,
  });
  def(B.SPRUCE_SAPLING, "Spruce Sapling", {
    tex: "sapling_spruce",
    kind: "cross",
    solid: false,
    opaque: false,
    dimming: 0,
    hardness: 0.05,
    needsSupport: true,
    sound: "grass",
    flammable: true,
  });
  def(B.BIRCH_LEAVES, "Birch Leaves", { tex: "birch_leaves", ...leafCommon, drops: "stick" });
  def(B.SPRUCE_LEAVES, "Spruce Leaves", { tex: "spruce_leaves", ...leafCommon, drops: "stick" });
  def(B.JUNGLE_LEAVES, "Jungle Leaves", { tex: "jungle_leaves", ...leafCommon, drops: "stick" });
  def(B.OAK_PLANKS, "Oak Planks", {
    tex: "oak_planks",
    hardness: 1.4,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  def(B.BIRCH_PLANKS, "Birch Planks", {
    tex: "birch_planks",
    hardness: 1.4,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  def(B.SPRUCE_PLANKS, "Spruce Planks", {
    tex: "spruce_planks",
    hardness: 1.4,
    tool: "axe",
    sound: "wood",
    flammable: true,
  });
  def(B.GLASS, "Glass", {
    tex: "glass",
    opaque: false,
    dimming: 0,
    hardness: 0.3,
    drops: null,
    sound: "glass",
  });
  def(B.BRICKS, "Bricks", { tex: "bricks", hardness: 2, tool: "pickaxe", tier: 1 });
  def(B.STONE_BRICKS, "Stone Bricks", {
    tex: "stone_bricks",
    hardness: 2,
    tool: "pickaxe",
    tier: 1,
  });
  def(B.COAL_ORE, "Coal Ore", {
    tex: "coal_ore",
    hardness: 3,
    tool: "pickaxe",
    tier: 1,
    drops: "coal",
  });
  def(B.IRON_ORE, "Iron Ore", {
    tex: "iron_ore",
    hardness: 3,
    tool: "pickaxe",
    tier: 2,
    drops: "raw_iron",
  });
  def(B.GOLD_ORE, "Gold Ore", {
    tex: "gold_ore",
    hardness: 3,
    tool: "pickaxe",
    tier: 3,
    drops: "raw_gold",
  });
  def(B.DIAMOND_ORE, "Diamond Ore", {
    tex: "diamond_ore",
    hardness: 3.5,
    tool: "pickaxe",
    tier: 3,
    drops: "diamond",
  });
  def(B.REDSTONE_ORE, "Redstone Ore", {
    tex: "redstone_ore",
    hardness: 3,
    tool: "pickaxe",
    tier: 3,
    drops: "redstone",
    dropCount: [3, 5],
  });
  def(B.EMERALD_ORE, "Emerald Ore", {
    tex: "emerald_ore",
    hardness: 3.5,
    tool: "pickaxe",
    tier: 3,
    drops: "emerald",
  });
  def(B.LAPIS_ORE, "Lapis Ore", {
    tex: "lapis_ore",
    hardness: 3,
    tool: "pickaxe",
    tier: 2,
    drops: "lapis",
    dropCount: [4, 8],
  });
  def(B.SNOW, "Snow Block", { tex: "snow", hardness: 0.4, tool: "shovel", sound: "sand" });
  def(B.ICE, "Ice", {
    tex: "ice",
    opaque: false,
    dimming: 2,
    hardness: 0.5,
    tool: "pickaxe",
    drops: null,
    slipperiness: 0.985,
    sound: "glass",
  });
  def(B.CACTUS, "Cactus", {
    tex: ["cactus_top", "cactus_top", "cactus_side"],
    hardness: 0.5,
    opaque: false,
    dimming: 15,
    sound: "wool",
  });
  const plant = {
    kind: "cross" as const,
    solid: false,
    opaque: false,
    dimming: 0,
    hardness: 0.05,
    sound: "grass" as const,
    needsSupport: true,
    replaceable: true,
    flammable: true,
  };
  def(B.TALL_GRASS, "Tall Grass", { tex: "tall_grass", ...plant, drops: "wheat_seeds" });
  def(B.FERN, "Fern", { tex: "fern", ...plant, drops: "wheat_seeds" });
  def(B.FLOWER_RED, "Poppy", { tex: "flower_red", ...plant, replaceable: false });
  def(B.FLOWER_YELLOW, "Dandelion", { tex: "flower_yellow", ...plant, replaceable: false });
  def(B.FLOWER_BLUE, "Cornflower", { tex: "flower_blue", ...plant, replaceable: false });
  def(B.DEAD_BUSH, "Dead Bush", { tex: "dead_bush", ...plant, drops: "stick" });
  def(B.MUSHROOM_RED, "Red Mushroom", { tex: "mushroom_red", ...plant, replaceable: false });
  def(B.TORCH, "Torch", {
    tex: "torch",
    kind: "cross",
    solid: false,
    opaque: false,
    dimming: 0,
    light: 14,
    hardness: 0.05,
    needsSupport: true,
    sound: "wood",
  });
  def(B.LADDER, "Ladder", {
    tex: "ladder",
    kind: "cross",
    solid: false,
    opaque: false,
    dimming: 0,
    hardness: 0.4,
    sound: "wood",
  });
  def(B.CRAFTING_TABLE, "Crafting Table", {
    tex: ["crafting_table_top", "oak_planks", "crafting_table_side"],
    hardness: 2.5,
    tool: "axe",
    sound: "wood",
  });
  def(B.FURNACE, "Furnace", {
    tex: [
      "furnace_top",
      "furnace_top",
      "furnace_side",
      "furnace_side",
      "furnace_front",
      "furnace_side",
    ],
    hardness: 3.5,
    tool: "pickaxe",
    tier: 1,
  });
  def(B.FURNACE_LIT, "Furnace", {
    tex: [
      "furnace_top",
      "furnace_top",
      "furnace_side",
      "furnace_side",
      "furnace_front_lit",
      "furnace_side",
    ],
    hardness: 3.5,
    tool: "pickaxe",
    tier: 1,
    light: 13,
    drops: "furnace",
  });
  def(B.GLOWSTONE, "Glowstone", {
    tex: "glowstone",
    hardness: 0.4,
    light: 15,
    sound: "glass",
  });
  def(B.OBSIDIAN, "Obsidian", {
    tex: "obsidian",
    hardness: 12,
    tool: "pickaxe",
    tier: 4,
  });
  def(B.COAL_BLOCK, "Block of Coal", {
    tex: "coal_block",
    hardness: 4,
    tool: "pickaxe",
    tier: 1,
  });
  def(B.IRON_BLOCK, "Block of Iron", {
    tex: "iron_block",
    hardness: 4,
    tool: "pickaxe",
    tier: 2,
  });
  def(B.GOLD_BLOCK, "Block of Gold", {
    tex: "gold_block",
    hardness: 4,
    tool: "pickaxe",
    tier: 3,
  });
  def(B.DIAMOND_BLOCK, "Block of Diamond", {
    tex: "diamond_block",
    hardness: 5,
    tool: "pickaxe",
    tier: 3,
  });
  const wool = { hardness: 0.8, sound: "wool" as const, flammable: true };
  def(B.WOOL_WHITE, "White Wool", { tex: "wool_white", ...wool });
  def(B.WOOL_RED, "Red Wool", { tex: "wool_red", ...wool });
  def(B.WOOL_BLUE, "Blue Wool", { tex: "wool_blue", ...wool });
  def(B.WOOL_YELLOW, "Yellow Wool", { tex: "wool_yellow", ...wool });
  def(B.WOOL_BLACK, "Black Wool", { tex: "wool_black", ...wool });
  def(B.CHEST, "Chest", {
    tex: ["chest_top", "chest_top", "chest_side", "chest_side", "chest_front", "chest_side"],
    hardness: 2.5,
    tool: "axe",
    sound: "wood",
    opaque: false,
    dimming: 15,
    flammable: true,
  });
  def(B.PUMPKIN, "Pumpkin", {
    tex: ["pumpkin_top", "pumpkin_top", "pumpkin_side"],
    hardness: 1,
    tool: "axe",
    sound: "wool",
  });
}

export function block(id: number): BlockDef {
  return defs[id] ?? defs[0];
}
export function allBlocks(): BlockDef[] {
  return defs;
}

// Fast lookup tables built once (hot path in mesher/lighting)
export let OPAQUE = new Uint8Array(B.COUNT);
export let SOLID = new Uint8Array(B.COUNT);
export let DIMMING = new Uint8Array(B.COUNT);
export let EMIT = new Uint8Array(B.COUNT);
export let KIND = new Uint8Array(B.COUNT); // 0 none 1 cube 2 cross 3 liquid
export let TEXLUT = new Uint16Array(B.COUNT * 6);

export function buildLuts() {
  for (let i = 0; i < B.COUNT; i++) {
    const d = defs[i] ?? defs[0];
    OPAQUE[i] = d.opaque ? 1 : 0;
    SOLID[i] = d.solid ? 1 : 0;
    DIMMING[i] = d.dimming;
    EMIT[i] = d.light;
    KIND[i] = d.kind === "none" ? 0 : d.kind === "cube" ? 1 : d.kind === "cross" ? 2 : 3;
    for (let f = 0; f < 6; f++) TEXLUT[i * 6 + f] = d.tex[f];
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Items
// ───────────────────────────────────────────────────────────────────────────
export interface ItemDef {
  id: string;
  name: string;
  stack: number;
  /** placing this item produces this block */
  block?: number;
  tool?: { class: ToolClass; tier: number; speed: number; damage: number; durability: number };
  food?: { hunger: number; heal?: number };
  fuel?: number; // seconds of smelting
  icon: string;
  rarity?: number;
}

const items = new Map<string, ItemDef>();
export function item(id: string): ItemDef | undefined {
  return items.get(id);
}
export function allItems(): ItemDef[] {
  return [...items.values()];
}

function regItem(d: Omit<ItemDef, "stack"> & { stack?: number }) {
  items.set(d.id, { stack: 64, ...d } as ItemDef);
}

export function blockItemId(b: number): string {
  return block(b).name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

const TOOL_MATS: Record<string, { tier: number; speed: number; dmg: number; dur: number; color: string; dark: string; light: string }> = {
  wooden: { tier: 1, speed: 2, dmg: 2, dur: 60, color: "#a4763f", dark: "#7b5729", light: "#c49a63" },
  stone: { tier: 2, speed: 4, dmg: 3, dur: 132, color: "#8d8d8d", dark: "#6a6a6a", light: "#b0b0b0" },
  iron: { tier: 3, speed: 6, dmg: 4, dur: 251, color: "#d8d8d8", dark: "#a8a8a8", light: "#f0f0f0" },
  diamond: { tier: 4, speed: 8, dmg: 5, dur: 1562, color: "#5fe3d6", dark: "#37a79c", light: "#a8f5ee" },
};

const PICK = [
  "................",
  "..mmm...mmm.....",
  ".mlllmmmlllm....",
  ".mllllllllll m..",
  "..mmm.hh.mmm....",
  "......hh........",
  ".....hh.........",
  ".....hh.........",
  "....hh..........",
  "....hh..........",
  "...hh...........",
  "...hh...........",
  "..hh............",
  "..hh............",
  "................",
  "................",
];
const AXE = [
  "................",
  "....mmm.........",
  "...mlllmm.......",
  "..mllllllm......",
  "..mlllllhm......",
  "..mllllhh.......",
  "...mmmhh........",
  ".....hh.........",
  ".....hh.........",
  "....hh..........",
  "....hh..........",
  "...hh...........",
  "...hh...........",
  "..hh............",
  "..hh............",
  "................",
];
const SHOVEL = [
  "................",
  ".....mmm........",
  "....mlllm.......",
  "....mlllm.......",
  "....mlllm.......",
  ".....mhm........",
  ".....hh.........",
  ".....hh.........",
  "....hh..........",
  "....hh..........",
  "...hh...........",
  "...hh...........",
  "..hh............",
  "..hh............",
  "..h.............",
  "................",
];
const SWORD = [
  "................",
  "...........mll..",
  "..........mlllm.",
  ".........mlllm..",
  "........mlllm...",
  ".......mlllm....",
  "......mlllm.....",
  ".....mlllm......",
  "..d.mlllm.......",
  "..dd mlm........",
  "...ddhm.........",
  "..hhhhh.........",
  "..hhhh..........",
  "...hh...........",
  "..hh............",
  "................",
];

export function initItems() {
  if (items.size) return;
  // block items
  for (let b = 1; b < B.COUNT; b++) {
    const d = defs[b];
    if (!d || d.id === B.FURNACE_LIT) continue;
    if (d.liquid) continue;
    const id = blockItemId(b);
    if (items.has(id)) continue;
    const topT = d.tex[0];
    const sideT = d.tex[4];
    const nameOf = (i: number) => texNameOf(i);
    const icon =
      d.kind === "cross"
        ? flatIcon(nameOf(topT))
        : cubeIcon(nameOf(topT), nameOf(sideT), nameOf(d.tex[2]));
    regItem({ id, name: d.name, block: b, icon });
  }

  regItem({ id: "stick", name: "Stick", fuel: 5, icon: spriteIcon([
    "................",
    "...........hh...",
    "..........hhh...",
    ".........hhh....",
    "........hhh.....",
    ".......hhh......",
    "......hhh.......",
    ".....hhh........",
    "....hhh.........",
    "...hhh..........",
    "..hhh...........",
    "..hh............",
    "................",
    "................",
    "................",
    "................",
  ], { h: "#9a6b3a" }) });

  const nug = (id: string, name: string, col: string, light: string, extra: Partial<ItemDef> = {}) =>
    regItem({
      id,
      name,
      icon: spriteIcon([
        "................",
        "................",
        "................",
        ".....mmmm.......",
        "....mllllm......",
        "...mlllllmm.....",
        "...mllllllm.....",
        "...mllllllm.....",
        "....mllllm......",
        ".....mmmm.......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
      ], { m: col, l: light }),
      ...extra,
    });
  nug("coal", "Coal", "#2a2a2e", "#48484f", { fuel: 80 });
  nug("charcoal", "Charcoal", "#3a332c", "#5a5048", { fuel: 80 });
  nug("raw_iron", "Raw Iron", "#b9815a", "#d79e76");
  nug("raw_gold", "Raw Gold", "#c9a22c", "#f0cb4d");
  nug("iron_ingot", "Iron Ingot", "#c4c4c4", "#eeeeee");
  nug("gold_ingot", "Gold Ingot", "#d9b227", "#ffe272");
  nug("redstone", "Redstone Dust", "#a61f1f", "#e23c3c");
  nug("lapis", "Lapis Lazuli", "#20409a", "#3a69d6");
  nug("clay_ball", "Clay Ball", "#9aa0ae", "#bcc2cd");
  nug("brick", "Brick", "#9a4a38", "#c06a52");
  regItem({
    id: "diamond",
    name: "Diamond",
    icon: spriteIcon([
      "................",
      "................",
      "......mm........",
      ".....mllm.......",
      "....mllllm......",
      "...mllllllm.....",
      "..mllllllllm....",
      "...mllllllm.....",
      "....mllllm......",
      ".....mllm.......",
      "......mm........",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#2fb3a5", l: "#8df4ea" }),
  });
  regItem({
    id: "emerald",
    name: "Emerald",
    icon: spriteIcon([
      "................",
      "................",
      ".....mmmm.......",
      "....mllllm......",
      "...mlmllllm.....",
      "...mlmllllm.....",
      "...mllllmlm.....",
      "....mllllm......",
      ".....mmmm.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#1a9c4a", l: "#4ae882" }),
  });
  regItem({
    id: "apple",
    name: "Apple",
    stack: 16,
    food: { hunger: 4 },
    icon: spriteIcon([
      "................",
      "................",
      "........g.......",
      ".......g........",
      "....mmm.mm......",
      "...mlllmmmm.....",
      "..mllllllllm....",
      "..mllllllllm....",
      "..mllllllllm....",
      "..mllllllllm....",
      "...mllllllm.....",
      "....mm..mm......",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#9c1f1f", l: "#dd3b33", g: "#4a8a2a" }),
  });
  regItem({
    id: "bread",
    name: "Bread",
    stack: 16,
    food: { hunger: 6 },
    icon: spriteIcon([
      "................",
      "................",
      "................",
      "...mmmmmmm......",
      "..mlllllllm.....",
      ".mllddllddlm....",
      ".mllllllllllm...",
      ".mlldlldllldm...",
      "..mlllllllllm...",
      "...mmmmmmmmm....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#8a5a22", l: "#c99448", d: "#a06f31" }),
  });
  regItem({
    id: "porkchop_raw",
    name: "Raw Porkchop",
    stack: 16,
    food: { hunger: 2 },
    icon: spriteIcon([
      "................",
      "................",
      "....mmmmm.......",
      "...mlllllm......",
      "..mllwwlllm.....",
      "..mlwwwwllm.....",
      "..mllwwlllm.....",
      "...mlllllm......",
      "....mmmmm.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#a85c5c", l: "#e08c8c", w: "#f3d2d2" }),
  });
  regItem({
    id: "porkchop_cooked",
    name: "Cooked Porkchop",
    stack: 16,
    food: { hunger: 8, heal: 2 },
    icon: spriteIcon([
      "................",
      "................",
      "....mmmmm.......",
      "...mlllllm......",
      "..mllwwlllm.....",
      "..mlwwwwllm.....",
      "..mllwwlllm.....",
      "...mlllllm......",
      "....mmmmm.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#7a4a1c", l: "#b57a34", w: "#e0bb7a" }),
  });
  regItem({
    id: "wheat",
    name: "Wheat",
    icon: spriteIcon([
      "................",
      "......m.........",
      ".....mlm........",
      "....mlllm.......",
      ".....mlm.m......",
      "....mlllm.......",
      ".....mlm........",
      "....mlllm.......",
      ".....mlm........",
      "......m.........",
      "......m.........",
      "......m.........",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#8a7020", l: "#d8bb44" }),
  });
  regItem({
    id: "wheat_seeds",
    name: "Seeds",
    icon: spriteIcon([
      "................",
      "................",
      "................",
      "......mm........",
      ".....mllm.......",
      "....mmllmm......",
      "....mllllm......",
      ".....mmmm.......",
      "........mm......",
      ".......mllm.....",
      "........mm......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#5a7a28", l: "#8db044" }),
  });
  regItem({
    id: "leather",
    name: "Leather",
    icon: spriteIcon([
      "................",
      "................",
      "...mmmmmmm......",
      "..mlllllllm.....",
      "..mlllllllm.....",
      "..mlllllllm.....",
      "..mlllllllm.....",
      "..mlllllllm.....",
      "...mmmmmmm......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ], { m: "#7a5a32", l: "#b08a52" }),
  });
  regItem({
    id: "bone",
    name: "Bone",
    icon: spriteIcon([
      "................",
      "...........mm...",
      "..........mllm..",
      "...........mm...",
      "..........mllm..",
      ".........mllm...",
      "........mll.....",
      ".......mll......",
      "......mll.......",
      ".....mll........",
      "....mllm........",
      "...mllm.........",
      "..mllm..........",
      "...mm...........",
      "..mllm..........",
      "...mm...........",
    ], { m: "#b8b4a0", l: "#eceadd" }),
  });
  regItem({
    id: "string",
    name: "String",
    icon: spriteIcon([
      "................",
      ".......mm.......",
      "......m..m......",
      ".....m....m.....",
      "......m..m......",
      ".......mm.......",
      "......m.........",
      ".....m..........",
      "......m.........",
      ".......m........",
      "......m.........",
      ".....m..........",
      "....m...........",
      "................",
      "................",
      "................",
    ], { m: "#dcdcdc" }),
  });

  // tools
  for (const [mat, v] of Object.entries(TOOL_MATS)) {
    const colors = { m: v.color, l: v.light, d: v.dark, h: "#9a6b3a" };
    const matName = mat[0].toUpperCase() + mat.slice(1);
    const mk = (
      suffix: string,
      cls: ToolClass,
      rows: string[],
      speedMul: number,
      dmgAdd: number,
    ) =>
      regItem({
        id: `${mat}_${suffix}`,
        name: `${matName} ${suffix[0].toUpperCase() + suffix.slice(1)}`,
        stack: 1,
        icon: spriteIcon(rows, colors),
        tool: {
          class: cls,
          tier: v.tier,
          speed: v.speed * speedMul,
          damage: v.dmg + dmgAdd,
          durability: v.dur,
        },
      });
    mk("pickaxe", "pickaxe", PICK, 1, 0);
    mk("axe", "axe", AXE, 1, 1);
    mk("shovel", "shovel", SHOVEL, 1, 0);
    mk("sword", "sword", SWORD, 0.7, 2);
  }

  // make planks / wood / coal fuels
  for (const id of [
    "oak_planks", "birch_planks", "spruce_planks", "oak_log", "birch_log", "spruce_log",
    "crafting_table", "ladder",
  ]) {
    const it = items.get(id);
    if (it) it.fuel = 15;
  }
  const coalBlock = items.get("block_of_coal");
  if (coalBlock) coalBlock.fuel = 800;
  const sapling = items.get("oak_sapling");
  if (sapling) sapling.fuel = 5;
}

function texNameOf(layer: number): string {
  return TEX_NAMES[layer];
}

/** item -> block for placing */
export function itemBlock(id: string | null): number {
  if (!id) return 0;
  const it = items.get(id);
  return it?.block ?? 0;
}
