import * as THREE from 'three';
import { mulberry32 } from './noise';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6, LOG: 7, LEAVES: 8, PLANKS: 9,
  GLASS: 10, COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14, SNOW: 15, ICE: 16, CACTUS: 17,
  BEDROCK: 18, GRAVEL: 19, BIRCH_LOG: 20, BIRCH_LEAVES: 21, CRAFTING_TABLE: 22, FURNACE: 23, TORCH: 24,
  FLOWER_RED: 25, FLOWER_YELLOW: 26, TALL_GRASS: 27, BRICKS: 28, STONE_BRICKS: 29, SANDSTONE: 30,
  GLOWSTONE: 31, WOOL: 32, BOOKSHELF: 33, PINE_LOG: 34, PINE_LEAVES: 35, SNOW_GRASS: 36, DEAD_BUSH: 37,
  CLAY: 38,
} as const;

export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, GOLD_INGOT: 103, DIAMOND: 104,
  WOOD_PICK: 110, STONE_PICK: 111, IRON_PICK: 112, DIAMOND_PICK: 113,
  WOOD_AXE: 114, STONE_AXE: 115, IRON_AXE: 116, DIAMOND_AXE: 117,
  WOOD_SHOVEL: 118, STONE_SHOVEL: 119, IRON_SHOVEL: 120, DIAMOND_SHOVEL: 121,
  WOOD_SWORD: 122, STONE_SWORD: 123, IRON_SWORD: 124, DIAMOND_SWORD: 125,
  APPLE: 130, RAW_PORK: 131, COOKED_PORK: 132, BREAD: 133, WHEAT_SEEDS: 134, ROTTEN_FLESH: 135, LEATHER: 136,
  RAW_BEEF: 137, STEAK: 138, BRICK: 139, CLAY_BALL: 140, MUTTON: 141, COOKED_MUTTON: 142,
} as const;

export type ToolType = 'pick' | 'axe' | 'shovel' | 'sword';

export interface BlockDef {
  id: number; name: string;
  tiles: [string, string, string]; // top, bottom, side
  solid: boolean; opaque: boolean; cutout?: boolean; liquid?: boolean; cross?: boolean; torch?: boolean;
  hardness: number; tool?: ToolType; tier?: number;
  drop?: (rnd: number) => [number, number] | null;
  light?: number; sound: 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'snow';
}

export interface ItemDef {
  id: number; name: string; tile: string; stack: number;
  tool?: { type: ToolType; tier: number; speed: number; damage: number; durability: number };
  food?: number;
}

const blocks: BlockDef[] = [];
const items: Record<number, ItemDef> = {};

function blk(id: number, name: string, tiles: string | [string, string, string], o: Partial<BlockDef> = {}) {
  const t: [string, string, string] = typeof tiles === 'string' ? [tiles, tiles, tiles] : tiles;
  blocks[id] = { id, name, tiles: t, solid: true, opaque: true, hardness: 1, sound: 'stone', ...o };
}
blk(B.AIR, 'Air', 'stone', { solid: false, opaque: false, hardness: 0 });
blk(B.GRASS, 'Grass Block', ['grass_top', 'dirt', 'grass_side'], { hardness: 0.6, tool: 'shovel', sound: 'grass', drop: () => [B.DIRT, 1] });
blk(B.DIRT, 'Dirt', 'dirt', { hardness: 0.5, tool: 'shovel', sound: 'grass' });
blk(B.STONE, 'Stone', 'stone', { hardness: 1.5, tool: 'pick', tier: 1, drop: () => [B.COBBLE, 1] });
blk(B.COBBLE, 'Cobblestone', 'cobble', { hardness: 2, tool: 'pick', tier: 1 });
blk(B.SAND, 'Sand', 'sand', { hardness: 0.5, tool: 'shovel', sound: 'sand' });
blk(B.WATER, 'Water', 'water', { solid: false, opaque: false, liquid: true, hardness: -1 });
blk(B.LOG, 'Oak Log', ['log_top', 'log_top', 'log_side'], { hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.LEAVES, 'Oak Leaves', 'leaves', { opaque: false, cutout: true, hardness: 0.2, sound: 'grass', drop: (r) => r < 0.06 ? [I.APPLE, 1] : r < 0.12 ? [I.STICK, 1] : null });
blk(B.PLANKS, 'Oak Planks', 'planks', { hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.GLASS, 'Glass', 'glass', { opaque: false, cutout: true, hardness: 0.3, sound: 'glass', drop: () => null });
blk(B.COAL_ORE, 'Coal Ore', 'coal_ore', { hardness: 3, tool: 'pick', tier: 1, drop: () => [I.COAL, 1] });
blk(B.IRON_ORE, 'Iron Ore', 'iron_ore', { hardness: 3, tool: 'pick', tier: 2 });
blk(B.GOLD_ORE, 'Gold Ore', 'gold_ore', { hardness: 3, tool: 'pick', tier: 3 });
blk(B.DIAMOND_ORE, 'Diamond Ore', 'diamond_ore', { hardness: 3, tool: 'pick', tier: 3, drop: () => [I.DIAMOND, 1] });
blk(B.SNOW, 'Snow Block', 'snow', { hardness: 0.3, tool: 'shovel', sound: 'snow' });
blk(B.ICE, 'Ice', 'ice', { opaque: false, cutout: true, hardness: 0.5, tool: 'pick', sound: 'glass' });
blk(B.CACTUS, 'Cactus', ['cactus_top', 'cactus_top', 'cactus_side'], { hardness: 0.4, sound: 'wood' });
blk(B.BEDROCK, 'Bedrock', 'bedrock', { hardness: -1 });
blk(B.GRAVEL, 'Gravel', 'gravel', { hardness: 0.6, tool: 'shovel', sound: 'sand' });
blk(B.BIRCH_LOG, 'Birch Log', ['birch_top', 'birch_top', 'birch_side'], { hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.BIRCH_LEAVES, 'Birch Leaves', 'birch_leaves', { opaque: false, cutout: true, hardness: 0.2, sound: 'grass', drop: (r) => r < 0.1 ? [I.STICK, 1] : null });
blk(B.CRAFTING_TABLE, 'Crafting Table', ['table_top', 'planks', 'table_side'], { hardness: 2.5, tool: 'axe', sound: 'wood' });
blk(B.FURNACE, 'Furnace', ['furnace_top', 'furnace_top', 'furnace_front'], { hardness: 3.5, tool: 'pick', tier: 1 });
blk(B.TORCH, 'Torch', 'torch', { solid: false, opaque: false, cross: true, torch: true, hardness: 0, light: 14, sound: 'wood' });
blk(B.FLOWER_RED, 'Poppy', 'flower_red', { solid: false, opaque: false, cross: true, hardness: 0, sound: 'grass' });
blk(B.FLOWER_YELLOW, 'Dandelion', 'flower_yellow', { solid: false, opaque: false, cross: true, hardness: 0, sound: 'grass' });
blk(B.TALL_GRASS, 'Tall Grass', 'tall_grass', { solid: false, opaque: false, cross: true, hardness: 0, sound: 'grass', drop: (r) => r < 0.15 ? [I.WHEAT_SEEDS, 1] : null });
blk(B.BRICKS, 'Bricks', 'bricks', { hardness: 2, tool: 'pick', tier: 1 });
blk(B.STONE_BRICKS, 'Stone Bricks', 'stone_bricks', { hardness: 1.5, tool: 'pick', tier: 1 });
blk(B.SANDSTONE, 'Sandstone', ['sandstone_top', 'sandstone_top', 'sandstone'], { hardness: 0.8, tool: 'pick', tier: 1 });
blk(B.GLOWSTONE, 'Glowstone', 'glowstone', { hardness: 0.3, light: 15, sound: 'glass' });
blk(B.WOOL, 'White Wool', 'wool', { hardness: 0.8, sound: 'grass' });
blk(B.BOOKSHELF, 'Bookshelf', ['planks', 'planks', 'bookshelf'], { hardness: 1.5, tool: 'axe', sound: 'wood' });
blk(B.PINE_LOG, 'Spruce Log', ['pine_top', 'pine_top', 'pine_side'], { hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.PINE_LEAVES, 'Spruce Leaves', 'pine_leaves', { opaque: false, cutout: true, hardness: 0.2, sound: 'grass', drop: (r) => r < 0.1 ? [I.STICK, 1] : null });
blk(B.SNOW_GRASS, 'Snowy Grass', ['snow', 'dirt', 'snow_side'], { hardness: 0.6, tool: 'shovel', sound: 'snow', drop: () => [B.DIRT, 1] });
blk(B.DEAD_BUSH, 'Dead Bush', 'dead_bush', { solid: false, opaque: false, cross: true, hardness: 0, sound: 'grass', drop: (r) => r < 0.5 ? [I.STICK, 1] : null });
blk(B.CLAY, 'Clay', 'clay', { hardness: 0.6, tool: 'shovel', sound: 'sand', drop: () => [I.CLAY_BALL, 4] });

export const BLOCKS = blocks;
export const NUM_BLOCKS = blocks.length;

function item(id: number, name: string, tile: string, o: Partial<ItemDef> = {}) {
  items[id] = { id, name, tile, stack: 64, ...o };
}
item(I.STICK, 'Stick', 'i_stick');
item(I.COAL, 'Coal', 'i_coal');
item(I.IRON_INGOT, 'Iron Ingot', 'i_iron');
item(I.GOLD_INGOT, 'Gold Ingot', 'i_gold');
item(I.DIAMOND, 'Diamond', 'i_diamond');
const mats: [string, number, number, number, string][] = [
  ['Wooden', 1, 2, 60, '#8a6a3a'], ['Stone', 2, 4, 132, '#8a8a8a'], ['Iron', 3, 6, 251, '#e0e0e0'], ['Diamond', 4, 8, 1562, '#4fe3d6'],
];
export const TOOL_COLORS: Record<string, string> = {};
(['pick', 'axe', 'shovel', 'sword'] as ToolType[]).forEach((type, ti) => {
  mats.forEach(([mn, tier, speed, dur, col], mi) => {
    const id = 110 + ti * 4 + mi;
    const nm = { pick: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', sword: 'Sword' }[type];
    const tile = `t_${type}_${mi}`;
    TOOL_COLORS[tile] = col;
    item(id, `${mn} ${nm}`, tile, {
      stack: 1,
      tool: { type, tier, speed, damage: type === 'sword' ? 4 + mi * 1.5 : type === 'axe' ? 3 + mi : 2 + mi * 0.5, durability: dur },
    });
  });
});
item(I.APPLE, 'Apple', 'i_apple', { food: 4 });
item(I.RAW_PORK, 'Raw Porkchop', 'i_rawpork', { food: 3 });
item(I.COOKED_PORK, 'Cooked Porkchop', 'i_cookpork', { food: 8 });
item(I.BREAD, 'Bread', 'i_bread', { food: 5 });
item(I.WHEAT_SEEDS, 'Seeds', 'i_seeds');
item(I.ROTTEN_FLESH, 'Rotten Flesh', 'i_flesh', { food: 2 });
item(I.LEATHER, 'Leather', 'i_leather');
item(I.RAW_BEEF, 'Raw Beef', 'i_rawbeef', { food: 3 });
item(I.STEAK, 'Steak', 'i_steak', { food: 8 });
item(I.BRICK, 'Brick', 'i_brick');
item(I.CLAY_BALL, 'Clay Ball', 'i_clay');
item(I.MUTTON, 'Raw Mutton', 'i_rawpork', { food: 2 });
item(I.COOKED_MUTTON, 'Cooked Mutton', 'i_cookpork', { food: 6 });

export const ITEMS = items;

export function isBlock(id: number) { return id > 0 && id < 100; }
export function getName(id: number) { return isBlock(id) ? blocks[id]?.name ?? '?' : items[id]?.name ?? '?'; }
export function maxStack(id: number) { return isBlock(id) ? 64 : items[id]?.stack ?? 64; }

// ---------------------------------------------------------------- texture atlas
export const TILE = 16;
export const ATLAS_COLS = 16;
const tileIndex: Record<string, number> = {};
let atlasCanvas: HTMLCanvasElement | null = null;

type Ctx = CanvasRenderingContext2D;
type Painter = (c: Ctx, r: () => number) => void;

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function px(c: Ctx, x: number, y: number, col: string | [number, number, number], a = 1) {
  const [r, g, b] = typeof col === 'string' ? hex(col) : col;
  c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  c.fillRect(x, y, 1, 1);
}
function noiseFill(c: Ctx, r: () => number, base: string, v: number, area = [0, 0, 16, 16]) {
  const [br, bg, bb] = hex(base);
  for (let y = area[1]; y < area[1] + area[3]; y++)
    for (let x = area[0]; x < area[0] + area[2]; x++) {
      const k = 1 + (r() - 0.5) * v;
      px(c, x, y, [Math.min(255, br * k), Math.min(255, bg * k), Math.min(255, bb * k)]);
    }
}
function speckle(c: Ctx, r: () => number, cols: string[], n: number, size = 1) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * (16 - size + 1)), y = Math.floor(r() * (16 - size + 1));
    const col = cols[Math.floor(r() * cols.length)];
    for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) if (size === 1 || r() > 0.25) px(c, x + a, y + b, col);
  }
}
const ore = (spot: string[]): Painter => (c, r) => {
  noiseFill(c, r, '#7d7d7d', 0.25);
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12);
    px(c, x, y, spot[0]); px(c, x + 1, y, spot[1]); px(c, x, y + 1, spot[1]); if (r() > 0.4) px(c, x + 1, y + 1, spot[0]);
  }
};
const logSide = (base: string, dark: string): Painter => (c, r) => {
  noiseFill(c, r, base, 0.2);
  for (let x = 0; x < 16; x++) if (r() > 0.55) for (let y = 0; y < 16; y++) if (r() > 0.3) px(c, x, y, dark);
};
const logTop = (bark: string, ring: string, inner: string): Painter => (c, r) => {
  noiseFill(c, r, bark, 0.2);
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    px(c, x, y, Math.floor(d) % 2 ? ring : inner);
  }
};
const leaves = (base: string, holes = 0.12): Painter => (c, r) => {
  const [br, bg, bb] = hex(base);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (r() < holes) continue;
    const k = 0.7 + r() * 0.5;
    px(c, x, y, [br * k, bg * k, bb * k]);
  }
};
const cross = (draw: (c: Ctx, r: () => number) => void): Painter => draw;
const toolPainter = (type: ToolType, col: string): Painter => (c) => {
  // handle
  const handle = '#6b4a24';
  for (let i = 0; i < 9; i++) { px(c, 3 + i, 12 - i, handle); px(c, 4 + i, 12 - i, '#4a3216'); }
  const hc = col;
  const dark = '#333';
  if (type === 'pick') {
    const pts = [[4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 6], [14, 7], [14, 8], [14, 9], [13, 3], [12, 2], [11, 2], [3, 3]];
    pts.forEach(([x, y]) => { px(c, x, y, hc); px(c, x, y + 1, dark, 0.35); });
  } else if (type === 'axe') {
    for (let y = 1; y < 7; y++) for (let x = 8; x < 14; x++) if (x + y > 10 && x - y < 11) px(c, x, y, hc);
    px(c, 13, 1, dark, 0.4);
  } else if (type === 'shovel') {
    for (let y = 1; y < 6; y++) for (let x = 10; x < 15; x++) if (Math.abs(x - 12 + (y - 3)) < 3) px(c, x, y, hc);
  } else {
    for (let i = 0; i < 10; i++) { px(c, 5 + i, 10 - i, hc); px(c, 6 + i, 10 - i, hc); px(c, 6 + i, 11 - i, dark, 0.3); }
    c.clearRect(0, 0, 0, 0);
    for (let i = 0; i < 4; i++) { px(c, 2 + i, 10 + i - 2, '#4a3216'); }
    px(c, 4, 9, '#6b4a24'); px(c, 7, 12, '#6b4a24'); px(c, 3, 13, '#4a3216'); px(c, 2, 14, '#4a3216');
  }
};
const blob = (cols: string[], shape: number[][]): Painter => (c) => {
  shape.forEach((row, y) => row.forEach((v, x) => { if (v) px(c, x, y, cols[v - 1]); }));
};
function circleItem(main: string, hi: string, dark: string, rad = 5): Painter {
  return (c, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 8);
      if (d < rad) px(c, x, y, d < rad - 1.5 && x < 8 && y < 8 ? hi : r() > 0.85 ? dark : main);
      else if (d < rad + 1) px(c, x, y, dark);
    }
  };
}

const painters: Record<string, Painter> = {
  grass_top: (c, r) => { noiseFill(c, r, '#5fa83a', 0.3); speckle(c, r, ['#4e9230', '#72bd4a'], 30); },
  dirt: (c, r) => { noiseFill(c, r, '#866043', 0.3); speckle(c, r, ['#6b4a30', '#9a7457', '#5c3f28'], 24); },
  grass_side: (c, r) => {
    painters.dirt(c, r);
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) px(c, x, y, r() > 0.5 ? '#5fa83a' : '#56a034'); }
  },
  snow_side: (c, r) => {
    painters.dirt(c, r);
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) px(c, x, y, r() > 0.5 ? '#f4f8ff' : '#e2ecf7'); }
  },
  stone: (c, r) => { noiseFill(c, r, '#7d7d7d', 0.22); speckle(c, r, ['#6a6a6a', '#8f8f8f'], 30, 2); },
  cobble: (c, r) => {
    noiseFill(c, r, '#6e6e6e', 0.2);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * 13), y = Math.floor(r() * 13), w = 3 + Math.floor(r() * 3);
      for (let a = 0; a < w; a++) for (let b = 0; b < w - 1; b++) px(c, (x + a) % 16, (y + b) % 16, r() > 0.5 ? '#9a9a9a' : '#8a8a8a');
      for (let a = 0; a < w; a++) px(c, (x + a) % 16, (y + w - 1) % 16, '#4b4b4b');
    }
  },
  sand: (c, r) => { noiseFill(c, r, '#dbcf9a', 0.12); speckle(c, r, ['#c9bc84', '#e8ddb0'], 30); },
  gravel: (c, r) => { noiseFill(c, r, '#857f7d', 0.3); speckle(c, r, ['#5f5a58', '#a59f9c', '#6e6560'], 50, 2); },
  water: (c, r) => { noiseFill(c, r, '#3567d6', 0.15); speckle(c, r, ['#5385ea', '#2a55b8'], 20, 2); },
  log_side: logSide('#6b5131', '#4f3b22'),
  log_top: logTop('#6b5131', '#a5824f', '#b8955e'),
  birch_side: (c, r) => { noiseFill(c, r, '#dcdcd2', 0.08); for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 16); px(c, x, y, '#2b2b2b'); px(c, x + 1, y, '#3b3b3b'); if (r() > 0.5) px(c, x + 2, y, '#555'); } },
  birch_top: logTop('#dcdcd2', '#c4b17f', '#d6c38f'),
  pine_side: logSide('#4a3420', '#36251a'),
  pine_top: logTop('#4a3420', '#7a5c37', '#8d6b42'),
  leaves: leaves('#3f8f2a'),
  birch_leaves: leaves('#6aa64a'),
  pine_leaves: leaves('#2f5a35', 0.08),
  planks: (c, r) => {
    noiseFill(c, r, '#a8854f', 0.12);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) px(c, x, y + 3, '#6e5430');
    for (let y = 0; y < 4; y++) { const off = (y * 7) % 16; for (let k = 0; k < 3; k++) px(c, off, y * 4 + k, '#7c5f37'); }
  },
  glass: (c) => {
    for (let i = 0; i < 16; i++) { px(c, i, 0, '#d5eef5'); px(c, i, 15, '#a6c8d1'); px(c, 0, i, '#d5eef5'); px(c, 15, i, '#a6c8d1'); }
    for (let i = 0; i < 4; i++) { px(c, 3 + i, 3 + i - 1, '#ffffff', 0.8); px(c, 9 + i, 9 + i - 2, '#ffffff', 0.6); }
  },
  coal_ore: ore(['#1e1e1e', '#3a3a3a']),
  iron_ore: ore(['#d8af93', '#b88d70']),
  gold_ore: ore(['#fcee4b', '#d6b52a']),
  diamond_ore: ore(['#6af2e4', '#2bb8aa']),
  snow: (c, r) => { noiseFill(c, r, '#f2f6fb', 0.06); speckle(c, r, ['#dfe8f2'], 14); },
  ice: (c, r) => { noiseFill(c, r, '#9cc4f2', 0.1); for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 12), y = Math.floor(r() * 12); for (let k = 0; k < 4; k++) px(c, x + k, y + k, '#d6ebff'); } },
  cactus_side: (c, r) => { noiseFill(c, r, '#3c8a2e', 0.15); for (let y = 0; y < 16; y++) { px(c, 0, y, '#2a6420'); px(c, 15, y, '#2a6420'); px(c, 4, y, '#2f7025'); px(c, 11, y, '#2f7025'); if (y % 4 === 1) { px(c, 2, y, '#e8e3b0'); px(c, 13, y + 2 > 15 ? 0 : y + 2, '#e8e3b0'); } } },
  cactus_top: (c, r) => { noiseFill(c, r, '#4a9a38', 0.15); for (let i = 0; i < 16; i++) { px(c, i, 0, '#2a6420'); px(c, i, 15, '#2a6420'); px(c, 0, i, '#2a6420'); px(c, 15, i, '#2a6420'); } },
  bedrock: (c, r) => { noiseFill(c, r, '#3a3a3a', 0.6); speckle(c, r, ['#151515', '#6a6a6a'], 40, 2); },
  table_top: (c, r) => { painters.planks(c, r); for (let i = 1; i < 15; i++) { px(c, i, 1, '#5a4224'); px(c, i, 14, '#5a4224'); px(c, 1, i, '#5a4224'); px(c, 14, i, '#5a4224'); px(c, i, 7, '#5a4224'); px(c, 7, i, '#5a4224'); } },
  table_side: (c, r) => {
    painters.planks(c, r);
    for (let x = 0; x < 16; x++) { px(c, x, 0, '#5a4224'); px(c, x, 1, '#7c5f37'); }
    for (let y = 4; y < 12; y++) { px(c, 3, y, '#9a9a9a'); px(c, 4, y, '#7a7a7a'); px(c, 11, y, '#6b4a24'); px(c, 12, y, '#6b4a24'); }
    for (let x = 2; x < 7; x++) px(c, x, 4, '#bbbbbb');
    for (let x = 9; x < 14; x++) px(c, x, 5, '#888');
  },
  furnace_top: (c, r) => { noiseFill(c, r, '#787878', 0.18); },
  furnace_front: (c, r) => {
    noiseFill(c, r, '#787878', 0.18);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(c, x, y, y > 11 ? '#e2711d' : '#1c1c1c');
    for (let x = 3; x < 13; x++) { px(c, x, 7, '#4a4a4a'); px(c, x, 14, '#4a4a4a'); }
    for (let x = 3; x < 13; x++) px(c, x, 3, '#4a4a4a');
  },
  torch: cross((c) => {
    for (let y = 6; y < 16; y++) { px(c, 7, y, '#6b4a24'); px(c, 8, y, '#8a6334'); }
    px(c, 7, 5, '#ffd84a'); px(c, 8, 5, '#ffef9a'); px(c, 7, 4, '#ff9d2a'); px(c, 8, 4, '#ffd84a');
    px(c, 7, 6, '#ffa82a'); px(c, 8, 6, '#ffd84a');
  }),
  flower_red: cross((c) => {
    for (let y = 8; y < 16; y++) px(c, 8, y, '#3c8a2e');
    px(c, 7, 12, '#3c8a2e'); px(c, 6, 11, '#3c8a2e'); px(c, 9, 13, '#3c8a2e');
    [[7, 5], [8, 5], [9, 5], [7, 6], [9, 6], [8, 4], [7, 7], [8, 7], [9, 7], [6, 6], [10, 6]].forEach(([x, y]) => px(c, x, y, '#d42a2a'));
    px(c, 8, 6, '#3a1010');
  }),
  flower_yellow: cross((c) => {
    for (let y = 9; y < 16; y++) px(c, 8, y, '#3c8a2e');
    px(c, 9, 12, '#3c8a2e'); px(c, 10, 11, '#3c8a2e');
    [[7, 6], [8, 6], [9, 6], [7, 7], [9, 7], [8, 5], [7, 8], [8, 8], [9, 8]].forEach(([x, y]) => px(c, x, y, '#f4d41c'));
    px(c, 8, 7, '#e0a010');
  }),
  tall_grass: cross((c, r) => {
    for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(r() * 14), h = 5 + Math.floor(r() * 9); for (let y = 15; y > 15 - h; y--) px(c, x + ((15 - y) > h / 2 && r() > 0.6 ? 1 : 0), y, r() > 0.5 ? '#5fa83a' : '#4c9030'); }
  }),
  dead_bush: cross((c, r) => {
    for (let i = 0; i < 6; i++) { let x = 8, y = 15; const dx = r() > 0.5 ? 1 : -1; for (let k = 0; k < 9; k++) { px(c, x, y, '#8a6a3a'); y--; if (r() > 0.5) x += dx; if (x < 0 || x > 15) break; } }
  }),
  bricks: (c, r) => {
    noiseFill(c, r, '#9a4a3a', 0.15);
    for (let y = 0; y < 16; y += 4) { for (let x = 0; x < 16; x++) px(c, x, y, '#b8ada0'); const off = (y / 4) % 2 ? 4 : 0; for (let k = 1; k < 4; k++) { px(c, off, y + k, '#b8ada0'); px(c, off + 8, y + k, '#b8ada0'); } }
  },
  stone_bricks: (c, r) => {
    noiseFill(c, r, '#7a7a7a', 0.15);
    for (let x = 0; x < 16; x++) { px(c, x, 7, '#4a4a4a'); px(c, x, 15, '#4a4a4a'); }
    for (let y = 0; y < 7; y++) px(c, 4, y, '#4a4a4a'); for (let y = 8; y < 15; y++) px(c, 12, y, '#4a4a4a');
  },
  sandstone: (c, r) => { noiseFill(c, r, '#d8c88e', 0.08); for (let x = 0; x < 16; x++) { px(c, x, 3, '#c4b37a'); px(c, x, 12, '#c4b37a'); } },
  sandstone_top: (c, r) => { noiseFill(c, r, '#ddd09a', 0.08); },
  glowstone: (c, r) => { noiseFill(c, r, '#c99a4a', 0.3); speckle(c, r, ['#ffe9a0', '#fff6c8', '#f0c060'], 40, 2); },
  wool: (c, r) => { noiseFill(c, r, '#e8e8e8', 0.08); speckle(c, r, ['#d4d4d4'], 40); },
  bookshelf: (c, r) => {
    painters.planks(c, r);
    const cols = ['#a83232', '#3250a8', '#32a85a', '#a8a032', '#7a32a8'];
    for (const y0 of [1, 9]) for (let x = 1; x < 15; x++) { const col = cols[Math.floor(r() * cols.length)]; for (let y = y0; y < y0 + 6; y++) px(c, x, y, col); }
  },
  clay: (c, r) => { noiseFill(c, r, '#a0a6b4', 0.1); },
  i_stick: (c) => { for (let i = 0; i < 10; i++) { px(c, 3 + i, 13 - i, '#6b4a24'); px(c, 4 + i, 13 - i, '#8a6334'); } },
  i_coal: circleItem('#2a2a2a', '#555', '#111'),
  i_iron: blob(['#e8e8e8', '#b8b8b8', '#888'], ingot()),
  i_gold: blob(['#fff07a', '#e0c030', '#a08010'], ingot()),
  i_diamond: (c) => { for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 6.5) * 1.1; if (d < 6) px(c, x, y, d < 2.5 ? '#c8fff8' : d < 4.5 ? '#4fe3d6' : '#1d9a90'); } },
  i_apple: (c, r) => { circleItem('#d42a2a', '#ff7a7a', '#7a1010', 5)(c, r); px(c, 8, 2, '#5a3a1a'); px(c, 8, 3, '#5a3a1a'); px(c, 9, 2, '#3c8a2e'); px(c, 10, 2, '#3c8a2e'); },
  i_rawpork: circleItem('#f0a0a0', '#ffd0d0', '#b06060', 5.5),
  i_cookpork: circleItem('#b0663a', '#d89060', '#6a3a1a', 5.5),
  i_rawbeef: circleItem('#c83a3a', '#f07070', '#7a1a1a', 5.5),
  i_steak: circleItem('#8a4a26', '#b8703a', '#4a2a10', 5.5),
  i_bread: (c) => { for (let y = 6; y < 11; y++) for (let x = 2; x < 14; x++) if (Math.abs(x - 7.5) / 6 + Math.abs(y - 8) / 3 < 1.1) px(c, x, y, y < 8 ? '#d09040' : '#a86a28'); },
  i_seeds: (c, r) => { for (let i = 0; i < 7; i++) { const x = 4 + Math.floor(r() * 8), y = 5 + Math.floor(r() * 7); px(c, x, y, '#4c9030'); px(c, x, y + 1, '#2e6a1a'); } },
  i_flesh: circleItem('#8a6a4a', '#a88a5a', '#4a6a2a', 5),
  i_leather: (c) => { for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) px(c, x, y, (x + y) % 5 ? '#9a5a2a' : '#7a4018'); },
  i_brick: blob(['#c06040', '#9a4a3a', '#6a2a1a'], ingot()),
  i_clay: circleItem('#a0a6b4', '#c8ccd8', '#707680', 4.5),
};
function ingot() {
  const rows: number[][] = [];
  for (let y = 0; y < 16; y++) {
    const row: number[] = [];
    for (let x = 0; x < 16; x++) {
      const inside = y >= 6 && y <= 11 && x >= 2 + (11 - y) * 0.5 && x <= 13 - (11 - y) * 0.5;
      row.push(!inside ? 0 : y === 6 || x < 3 + (11 - y) * 0.5 ? 1 : y === 11 ? 3 : 2);
    }
    rows.push(row);
  }
  return rows;
}
Object.entries(TOOL_COLORS).forEach(([tile, col]) => {
  const [, type] = tile.split('_');
  painters[tile] = toolPainter(type as ToolType, col);
});
// crack stages
for (let s = 0; s < 8; s++) {
  painters['crack_' + s] = (c, r) => {
    const n = 6 + s * 7;
    for (let i = 0; i < n; i++) {
      let x = 8 + Math.floor((r() - 0.5) * (4 + s * 2)), y = 8 + Math.floor((r() - 0.5) * (4 + s * 2));
      for (let k = 0; k < 3; k++) { px(c, ((x % 16) + 16) % 16, ((y % 16) + 16) % 16, '#000', 0.75); x += Math.round(r() * 2 - 1); y += Math.round(r() * 2 - 1); }
    }
  };
}

export function buildAtlas() {
  if (atlasCanvas) return atlasCanvas;
  const names = Object.keys(painters);
  const rows = Math.ceil(names.length / ATLAS_COLS);
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * TILE; cv.height = Math.max(rows, 1) * TILE;
  // Ensure power-of-two height for mipmaps-free sampling stability
  let h = 16; while (h < cv.height) h *= 2; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  names.forEach((n, i) => {
    tileIndex[n] = i;
    const tx = (i % ATLAS_COLS) * TILE, ty = Math.floor(i / ATLAS_COLS) * TILE;
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = TILE;
    const tc = tmp.getContext('2d')!;
    painters[n](tc, mulberry32(i * 7919 + 13));
    ctx.drawImage(tmp, tx, ty);
  });
  atlasCanvas = cv;
  return cv;
}
export function atlasRows() { return buildAtlas().height / TILE; }
export function tileUV(name: string): [number, number, number, number] {
  buildAtlas();
  const i = tileIndex[name] ?? 0;
  const cols = ATLAS_COLS, rows = atlasRows();
  const u0 = (i % cols) / cols, v1 = 1 - Math.floor(i / cols) / rows;
  const eps = 0.0005;
  return [u0 + eps, v1 - 1 / rows + eps, u0 + 1 / cols - eps, v1 - eps];
}
export function tileOf(name: string) { buildAtlas(); return tileIndex[name] ?? 0; }

let atlasTex: THREE.Texture | null = null;
export function atlasTexture() {
  if (atlasTex) return atlasTex;
  const t = new THREE.CanvasTexture(buildAtlas());
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  atlasTex = t;
  return t;
}

// ---------------------------------------------------------------- icons for UI
const iconCache: Record<number, string> = {};
export function iconFor(id: number): string {
  if (iconCache[id]) return iconCache[id];
  const atlas = buildAtlas();
  const cv = document.createElement('canvas');
  const S = 48; cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const src = (n: string) => { const i = tileOf(n); return [(i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE] as const; };
  if (isBlock(id) && !BLOCKS[id].cross) {
    const def = BLOCKS[id];
    const [tx, ty] = src(def.tiles[0]); const [sx, sy] = src(def.tiles[2]);
    // isometric cube: top, left, right
    const h = S / 4;
    c.save(); c.setTransform(S / 2 / 16, h / 16, -S / 2 / 16, h / 16, S / 2, 0); c.drawImage(atlas, tx, ty, 16, 16, 0, 0, 16, 16); c.restore();
    c.save(); c.setTransform(S / 2 / 16, h / 16, 0, (S / 2) / 16, 0, h); c.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 16, 16); c.restore();
    c.save(); c.setTransform(S / 2 / 16, -h / 16, 0, (S / 2) / 16, S / 2, h * 2); c.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, 16, 16); c.restore();
  } else {
    const n = isBlock(id) ? BLOCKS[id].tiles[0] : ITEMS[id]?.tile ?? 'stone';
    const [x, y] = src(n);
    c.drawImage(atlas, x, y, 16, 16, 0, 0, S, S);
  }
  iconCache[id] = cv.toDataURL();
  return iconCache[id];
}
