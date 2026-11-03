import { mulberry32 } from './noise';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, PLANKS: 7, SAND: 8, WATER: 9,
  GLASS: 10, COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14, BEDROCK: 15, SNOW: 16, ICE: 17,
  CACTUS: 18, TABLE: 19, FURNACE: 20, TORCH: 21, GRAVEL: 22, SANDSTONE: 23, LAMP: 24, FLOWER_RED: 25,
  FLOWER_YELLOW: 26, TALLGRASS: 27, BIRCH_LOG: 28, SPRUCE_LEAVES: 29, WOOL: 30, STONEBRICK: 31,
  BOOKSHELF: 32, TNT: 33, SPRUCE_LOG: 34, BIRCH_LEAVES: 35, SNOW_LAYER_UNUSED: 36,
} as const;

export const I = {
  STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260, APPLE: 261, GOLDEN_APPLE: 262,
  RAW_PORK: 263, COOKED_PORK: 264, RAW_MUTTON: 265, COOKED_MUTTON: 266, ROTTEN_FLESH: 267,
  WOOD_PICK: 270, STONE_PICK: 271, IRON_PICK: 272, DIAMOND_PICK: 273,
  WOOD_AXE: 274, STONE_AXE: 275, IRON_AXE: 276, DIAMOND_AXE: 277,
  WOOD_SHOVEL: 278, STONE_SHOVEL: 279, IRON_SHOVEL: 280, DIAMOND_SHOVEL: 281,
  WOOD_SWORD: 282, STONE_SWORD: 283, IRON_SWORD: 284, DIAMOND_SWORD: 285,
} as const;

export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword';
export type RenderKind = 'cube' | 'cutout' | 'water' | 'cross';
export type SoundKind = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'snow';

export interface BlockDef {
  id: number; name: string; tex: [string, string, string, string?]; // top, bottom, side, front
  hardness: number; tool?: ToolType; tier?: number; drop?: number | null;
  solid: boolean; opaque: boolean; render: RenderKind; light?: number; sound: SoundKind;
}

export const TILES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'log_side', 'log_top', 'leaves', 'planks', 'sand',
  'water', 'glass', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'bedrock', 'snow', 'snow_side', 'ice',
  'cactus_side', 'cactus_top', 'table_top', 'table_side', 'table_front', 'furnace_front', 'furnace_side',
  'furnace_top', 'torch', 'gravel', 'sandstone', 'sandstone_top', 'lamp', 'flower_red', 'flower_yellow',
  'tallgrass', 'birch_side', 'birch_top', 'spruce_leaves', 'wool', 'stonebrick', 'bookshelf', 'tnt_side',
  'tnt_top', 'tnt_bottom', 'spruce_side', 'birch_leaves', 'furnace_lit',
  'crack0', 'crack1', 'crack2', 'crack3', 'crack4', 'crack5', 'crack6', 'crack7',
];
export const TILE_INDEX: Record<string, number> = {};
TILES.forEach((t, i) => (TILE_INDEX[t] = i));
export const ATLAS_TILES = 16; // 16x16 grid
export const TILE_PX = 16;

const blocks: BlockDef[] = [];
function def(id: number, name: string, tex: BlockDef['tex'], hardness: number, o: Partial<BlockDef> = {}) {
  blocks[id] = { id, name, tex, hardness, solid: true, opaque: true, render: 'cube', sound: 'stone', drop: id, ...o };
}
const all = (t: string): BlockDef['tex'] => [t, t, t];
def(B.AIR, 'Air', all('stone'), 0, { solid: false, opaque: false, drop: null });
def(B.GRASS, 'Grass Block', ['grass_top', 'dirt', 'grass_side'], 0.6, { tool: 'shovel', drop: B.DIRT, sound: 'grass' });
def(B.DIRT, 'Dirt', all('dirt'), 0.5, { tool: 'shovel', sound: 'grass' });
def(B.STONE, 'Stone', all('stone'), 1.5, { tool: 'pickaxe', tier: 1, drop: B.COBBLE });
def(B.COBBLE, 'Cobblestone', all('cobble'), 2, { tool: 'pickaxe', tier: 1 });
def(B.LOG, 'Oak Log', ['log_top', 'log_top', 'log_side'], 2, { tool: 'axe', sound: 'wood' });
def(B.LEAVES, 'Oak Leaves', all('leaves'), 0.2, { opaque: false, render: 'cutout', sound: 'grass', drop: null });
def(B.PLANKS, 'Oak Planks', all('planks'), 2, { tool: 'axe', sound: 'wood' });
def(B.SAND, 'Sand', all('sand'), 0.5, { tool: 'shovel', sound: 'sand' });
def(B.WATER, 'Water', all('water'), 100, { solid: false, opaque: false, render: 'water', drop: null });
def(B.GLASS, 'Glass', all('glass'), 0.3, { opaque: false, render: 'cutout', sound: 'glass', drop: null });
def(B.COAL_ORE, 'Coal Ore', all('coal_ore'), 3, { tool: 'pickaxe', tier: 1, drop: I.COAL });
def(B.IRON_ORE, 'Iron Ore', all('iron_ore'), 3, { tool: 'pickaxe', tier: 2 });
def(B.GOLD_ORE, 'Gold Ore', all('gold_ore'), 3, { tool: 'pickaxe', tier: 3 });
def(B.DIAMOND_ORE, 'Diamond Ore', all('diamond_ore'), 3, { tool: 'pickaxe', tier: 3, drop: I.DIAMOND });
def(B.BEDROCK, 'Bedrock', all('bedrock'), -1, { drop: null });
def(B.SNOW, 'Snowy Grass', ['snow', 'dirt', 'snow_side'], 0.6, { tool: 'shovel', drop: B.DIRT, sound: 'snow' });
def(B.ICE, 'Ice', all('ice'), 0.5, { tool: 'pickaxe', sound: 'glass' });
def(B.CACTUS, 'Cactus', ['cactus_top', 'cactus_top', 'cactus_side'], 0.4, { sound: 'grass' });
def(B.TABLE, 'Crafting Table', ['table_top', 'planks', 'table_side', 'table_front'], 2.5, { tool: 'axe', sound: 'wood' });
def(B.FURNACE, 'Furnace', ['furnace_top', 'furnace_top', 'furnace_side', 'furnace_front'], 3.5, { tool: 'pickaxe', tier: 1 });
def(B.TORCH, 'Torch', all('torch'), 0, { solid: false, opaque: false, render: 'cross', light: 14, sound: 'wood' });
def(B.GRAVEL, 'Gravel', all('gravel'), 0.6, { tool: 'shovel', sound: 'sand' });
def(B.SANDSTONE, 'Sandstone', ['sandstone_top', 'sandstone_top', 'sandstone'], 0.8, { tool: 'pickaxe', tier: 1 });
def(B.LAMP, 'Glow Lamp', all('lamp'), 0.3, { light: 15, sound: 'glass' });
def(B.FLOWER_RED, 'Poppy', all('flower_red'), 0, { solid: false, opaque: false, render: 'cross', sound: 'grass' });
def(B.FLOWER_YELLOW, 'Dandelion', all('flower_yellow'), 0, { solid: false, opaque: false, render: 'cross', sound: 'grass' });
def(B.TALLGRASS, 'Tall Grass', all('tallgrass'), 0, { solid: false, opaque: false, render: 'cross', sound: 'grass', drop: null });
def(B.BIRCH_LOG, 'Birch Log', ['birch_top', 'birch_top', 'birch_side'], 2, { tool: 'axe', sound: 'wood' });
def(B.SPRUCE_LEAVES, 'Spruce Leaves', all('spruce_leaves'), 0.2, { opaque: false, render: 'cutout', sound: 'grass', drop: null });
def(B.WOOL, 'White Wool', all('wool'), 0.8, { sound: 'snow' });
def(B.STONEBRICK, 'Stone Bricks', all('stonebrick'), 1.5, { tool: 'pickaxe', tier: 1 });
def(B.BOOKSHELF, 'Bookshelf', ['planks', 'planks', 'bookshelf'], 1.5, { tool: 'axe', sound: 'wood' });
def(B.TNT, 'TNT', ['tnt_top', 'tnt_bottom', 'tnt_side'], 0, { sound: 'grass' });
def(B.SPRUCE_LOG, 'Spruce Log', ['log_top', 'log_top', 'spruce_side'], 2, { tool: 'axe', sound: 'wood' });
def(B.BIRCH_LEAVES, 'Birch Leaves', all('birch_leaves'), 0.2, { opaque: false, render: 'cutout', sound: 'grass', drop: null });
export const BLOCKS = blocks;

// Lookup tables for hot loops
export const OPAQUE = new Uint8Array(256);
export const SOLID = new Uint8Array(256);
export const RENDER = new Uint8Array(256); // 0 none,1 cube,2 cutout,3 water,4 cross
export const EMIT = new Uint8Array(256);
export const FACE_TILES = new Uint16Array(256 * 6); // +x,-x,+y,-y,+z,-z
for (const b of blocks) {
  if (!b) continue;
  OPAQUE[b.id] = b.opaque ? 1 : 0;
  SOLID[b.id] = b.solid ? 1 : 0;
  RENDER[b.id] = b.id === 0 ? 0 : { cube: 1, cutout: 2, water: 3, cross: 4 }[b.render];
  EMIT[b.id] = b.light ?? 0;
  const [top, bot, side, front] = b.tex;
  const t = (n: string) => TILE_INDEX[n];
  FACE_TILES[b.id * 6 + 0] = t(side); FACE_TILES[b.id * 6 + 1] = t(side);
  FACE_TILES[b.id * 6 + 2] = t(top); FACE_TILES[b.id * 6 + 3] = t(bot);
  FACE_TILES[b.id * 6 + 4] = t(front ?? side); FACE_TILES[b.id * 6 + 5] = t(side);
}

// ---------------- Items ----------------
export interface ToolDef { type: ToolType; tier: number; speed: number; durability: number; damage: number }
export interface ItemDef { id: number; name: string; stack: number; tool?: ToolDef; food?: number; fuel?: number; color?: string }

const items: Record<number, ItemDef> = {};
function item(id: number, name: string, o: Partial<ItemDef> = {}) { items[id] = { id, name, stack: 64, ...o }; }
for (const b of blocks) if (b && b.id !== 0) item(b.id, b.name);
items[B.PLANKS].fuel = 15; items[B.LOG].fuel = 15; items[B.BIRCH_LOG].fuel = 15; items[B.SPRUCE_LOG].fuel = 15;
items[B.TABLE].fuel = 15; items[B.BOOKSHELF].fuel = 15;
item(I.STICK, 'Stick', { fuel: 5 });
item(I.COAL, 'Coal', { fuel: 80 });
item(I.IRON_INGOT, 'Iron Ingot');
item(I.GOLD_INGOT, 'Gold Ingot');
item(I.DIAMOND, 'Diamond');
item(I.APPLE, 'Apple', { food: 4 });
item(I.GOLDEN_APPLE, 'Golden Apple', { food: 10 });
item(I.RAW_PORK, 'Raw Porkchop', { food: 3 });
item(I.COOKED_PORK, 'Cooked Porkchop', { food: 8 });
item(I.RAW_MUTTON, 'Raw Mutton', { food: 2 });
item(I.COOKED_MUTTON, 'Cooked Mutton', { food: 6 });
item(I.ROTTEN_FLESH, 'Rotten Flesh', { food: 2 });
const mats = [
  { n: 'Wooden', tier: 1, speed: 2, dur: 60, c: '#a07a45' },
  { n: 'Stone', tier: 2, speed: 4, dur: 132, c: '#8a8a8a' },
  { n: 'Iron', tier: 3, speed: 6, dur: 250, c: '#e2e2e2' },
  { n: 'Diamond', tier: 4, speed: 8, dur: 1561, c: '#4fe3d6' },
];
const toolKinds: [ToolType, string, number][] = [['pickaxe', 'Pickaxe', 270], ['axe', 'Axe', 274], ['shovel', 'Shovel', 278], ['sword', 'Sword', 282]];
for (const [type, label, base] of toolKinds) {
  mats.forEach((m, i) => item(base + i, `${m.n} ${label}`, {
    stack: 1, color: m.c,
    tool: { type, tier: m.tier, speed: m.speed, durability: m.dur, damage: (type === 'sword' ? 4 : type === 'axe' ? 3 : 2) + i },
  }));
}
items[I.WOOD_PICK].fuel = 10; items[I.WOOD_AXE].fuel = 10; items[I.WOOD_SHOVEL].fuel = 10; items[I.WOOD_SWORD].fuel = 10;
export const ITEMS = items;
export const isBlockItem = (id: number) => id > 0 && id < 256;

export const SMELT: Record<number, number> = {
  [B.SAND]: B.GLASS, [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT, [B.COBBLE]: B.STONE,
  [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_MUTTON]: I.COOKED_MUTTON, [B.LOG]: I.COAL, [B.BIRCH_LOG]: I.COAL,
  [B.SPRUCE_LOG]: I.COAL, [B.CACTUS]: B.LEAVES,
};
delete SMELT[B.CACTUS];

// ---------------- Recipes ----------------
export interface Recipe { pattern: string[]; key: Record<string, number>; out: number; count: number }
const P = B.PLANKS, S = I.STICK;
export const RECIPES: Recipe[] = [
  { pattern: ['L'], key: { L: B.LOG }, out: P, count: 4 },
  { pattern: ['L'], key: { L: B.BIRCH_LOG }, out: P, count: 4 },
  { pattern: ['L'], key: { L: B.SPRUCE_LOG }, out: P, count: 4 },
  { pattern: ['P', 'P'], key: { P }, out: S, count: 4 },
  { pattern: ['PP', 'PP'], key: { P }, out: B.TABLE, count: 1 },
  { pattern: ['CCC', 'C C', 'CCC'], key: { C: B.COBBLE }, out: B.FURNACE, count: 1 },
  { pattern: ['C', 'S'], key: { C: I.COAL, S }, out: B.TORCH, count: 4 },
  { pattern: ['SS', 'SS'], key: { S: B.SAND }, out: B.SANDSTONE, count: 1 },
  { pattern: ['SS', 'SS'], key: { S: B.STONE }, out: B.STONEBRICK, count: 4 },
  { pattern: ['GGG', 'GTG', 'GGG'], key: { G: B.GLASS, T: B.TORCH }, out: B.LAMP, count: 2 },
  { pattern: ['PPP', 'SSS', 'PPP'], key: { P, S }, out: B.BOOKSHELF, count: 1 },
  { pattern: ['CSC', 'SCS', 'CSC'], key: { C: I.COAL, S: B.SAND }, out: B.TNT, count: 1 },
  { pattern: ['GGG', 'GAG', 'GGG'], key: { G: I.GOLD_INGOT, A: I.APPLE }, out: I.GOLDEN_APPLE, count: 1 },
];
const matItems = [P, B.COBBLE, I.IRON_INGOT, I.DIAMOND];
matItems.forEach((m, i) => {
  RECIPES.push({ pattern: ['MMM', ' S ', ' S '], key: { M: m, S }, out: I.WOOD_PICK + i, count: 1 });
  RECIPES.push({ pattern: ['MM', 'MS', ' S'], key: { M: m, S }, out: I.WOOD_AXE + i, count: 1 });
  RECIPES.push({ pattern: ['M', 'S', 'S'], key: { M: m, S }, out: I.WOOD_SHOVEL + i, count: 1 });
  RECIPES.push({ pattern: ['M', 'M', 'S'], key: { M: m, S }, out: I.WOOD_SWORD + i, count: 1 });
});

/** grid: array of size w*w with item ids (0 empty). Returns matching recipe or null. */
export function matchRecipe(grid: number[], w: number): Recipe | null {
  let minX = w, minY = w, maxX = -1, maxY = -1;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return null;
  const gw = maxX - minX + 1, gh = maxY - minY + 1;
  for (const r of RECIPES) {
    const rh = r.pattern.length, rw = Math.max(...r.pattern.map(p => p.length));
    if (rw !== gw || rh !== gh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < rh && ok; y++) for (let x = 0; x < rw && ok; x++) {
        const ch = r.pattern[y][mirror ? rw - 1 - x : x] ?? ' ';
        const need = ch === ' ' ? 0 : r.key[ch];
        if ((grid[(y + minY) * w + x + minX] || 0) !== need) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}

// ---------------- Texture painting ----------------
type RGB = [number, number, number];
function hex(h: string): RGB { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export const TILE_COLORS: RGB[] = [];

export function buildAtlas(): HTMLCanvasElement {
  const size = ATLAS_TILES * TILE_PX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  TILES.forEach((name, ti) => {
    const rnd = mulberry32(ti * 7919 + 13);
    const ox = (ti % ATLAS_TILES) * TILE_PX, oy = Math.floor(ti / ATLAS_TILES) * TILE_PX;
    const px = (x: number, y: number, c: RGB, a = 255) => {
      const i = ((oy + y) * size + ox + x) * 4;
      d[i] = Math.max(0, Math.min(255, c[0])); d[i + 1] = Math.max(0, Math.min(255, c[1])); d[i + 2] = Math.max(0, Math.min(255, c[2])); d[i + 3] = a;
    };
    const vary = (c: RGB, amt: number): RGB => { const v = (rnd() - 0.5) * amt; return [c[0] + v, c[1] + v, c[2] + v]; };
    const noiseFill = (c: string, amt = 30) => { const base = hex(c); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(base, amt)); };
    const speckle = (c: string, n: number, sz = 2) => {
      const col = hex(c);
      for (let k = 0; k < n; k++) {
        const cx = Math.floor(rnd() * (16 - sz)), cy = Math.floor(rnd() * (16 - sz));
        for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) if (rnd() > 0.25) px(cx + x, cy + y, vary(col, 25));
      }
    };
    const clear = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); };
    const ore = (c: string) => { noiseFill('#7d7d7d', 26); speckle(c, 6, 3); };
    const bark = (base: string, dark: string) => {
      const b = hex(base), dk = hex(dark);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary((x % 4 === 0 || rnd() < 0.1) ? dk : b, 18));
    };
    const leaves = (c: string) => {
      const col = hex(c);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (rnd() < 0.18) px(x, y, [0, 0, 0], 0); else px(x, y, vary(col, 50));
      }
    };
    const plank = () => {
      const b = hex('#b08850');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const seam = y % 4 === 3 || (x === ((Math.floor(y / 4) * 7) % 16));
        px(x, y, seam ? [110, 80, 45] : vary(b, 16));
      }
    };
    switch (name) {
      case 'grass_top': noiseFill('#5fa83a', 40); break;
      case 'dirt': noiseFill('#866043', 34); speckle('#6b4a30', 5, 1); break;
      case 'grass_side': {
        noiseFill('#866043', 34);
        const g = hex('#5fa83a');
        for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) px(x, y, vary(g, 36)); }
        break;
      }
      case 'snow': noiseFill('#f2f6fa', 10); break;
      case 'snow_side': {
        noiseFill('#866043', 34);
        for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) px(x, y, vary(hex('#f2f6fa'), 10)); }
        break;
      }
      case 'stone': noiseFill('#7d7d7d', 28); speckle('#6a6a6a', 6, 2); break;
      case 'cobble': {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const cell = ((Math.floor(x / 4) + Math.floor(y / 4) * 3) * 31) % 5;
          const edge = x % 4 === 0 || y % 4 === 0;
          px(x, y, vary(edge ? [80, 80, 80] : [120 + cell * 8, 120 + cell * 8, 120 + cell * 8], 20));
        }
        break;
      }
      case 'log_side': bark('#6b5130', '#4e3a22'); break;
      case 'spruce_side': bark('#4a3520', '#33241a'); break;
      case 'birch_side': {
        noiseFill('#e8e4d8', 14);
        for (let k = 0; k < 7; k++) { const y = Math.floor(rnd() * 16), x = Math.floor(rnd() * 13); for (let i = 0; i < 3; i++) px(x + i, y, [40, 40, 40]); }
        break;
      }
      case 'log_top': case 'birch_top': {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          const ring = Math.floor(r) % 2 === 0;
          px(x, y, r > 6.5 ? (name === 'birch_top' ? [220, 215, 200] : [90, 68, 40]) : vary(ring ? [184, 148, 95] : [160, 125, 75], 10));
        }
        break;
      }
      case 'leaves': leaves('#3f8a2c'); break;
      case 'birch_leaves': leaves('#6a9c3a'); break;
      case 'spruce_leaves': leaves('#2d5a35'); break;
      case 'planks': plank(); break;
      case 'sand': noiseFill('#dccf9a', 20); break;
      case 'sandstone': {
        noiseFill('#d8c98e', 14);
        for (let x = 0; x < 16; x++) { px(x, 0, [190, 175, 120]); px(x, 15, [180, 165, 110]); px(x, 5, [200, 185, 130]); }
        break;
      }
      case 'sandstone_top': noiseFill('#e0d29a', 12); break;
      case 'gravel': noiseFill('#8a8380', 40); speckle('#5e5855', 8, 2); break;
      case 'water': noiseFill('#2f62d8', 18); break;
      case 'glass': {
        clear();
        for (let i = 0; i < 16; i++) { px(i, 0, [220, 240, 255]); px(i, 15, [220, 240, 255]); px(0, i, [220, 240, 255]); px(15, i, [220, 240, 255]); }
        for (let i = 3; i < 7; i++) px(i, i - 1, [255, 255, 255], 200);
        break;
      }
      case 'ice': noiseFill('#9ec4f5', 14); break;
      case 'coal_ore': ore('#222222'); break;
      case 'iron_ore': ore('#d8a983'); break;
      case 'gold_ore': ore('#f5d442'); break;
      case 'diamond_ore': ore('#5ff0e6'); break;
      case 'bedrock': noiseFill('#4a4a4a', 70); break;
      case 'cactus_side': {
        noiseFill('#3d7d2a', 20);
        for (let y = 0; y < 16; y++) { px(0, y, [30, 70, 25]); px(15, y, [30, 70, 25]); if (y % 4 === 1) { px(3, y, [230, 230, 180]); px(11, y + 1 > 15 ? 0 : y + 1, [230, 230, 180]); } }
        break;
      }
      case 'cactus_top': noiseFill('#4f9636', 18); break;
      case 'table_top': {
        plank();
        for (let i = 0; i < 16; i++) { px(i, 0, [90, 60, 30]); px(i, 15, [90, 60, 30]); px(0, i, [90, 60, 30]); px(15, i, [90, 60, 30]); }
        for (let i = 3; i < 13; i++) { px(i, 8, [100, 70, 40]); px(8, i, [100, 70, 40]); }
        break;
      }
      case 'table_side': case 'table_front': {
        plank();
        for (let x = 0; x < 16; x++) { px(x, 0, [90, 60, 30]); px(x, 1, [130, 95, 55]); }
        if (name === 'table_front') { for (let y = 5; y < 13; y++) { px(4, y, [140, 140, 140]); px(11, y, [100, 70, 40]); } for (let x = 3; x < 7; x++) px(x, 5, [160, 160, 160]); }
        else for (let y = 4; y < 14; y++) { px(3, y, [90, 60, 30]); px(12, y, [90, 60, 30]); }
        break;
      }
      case 'furnace_side': case 'furnace_top': noiseFill('#6e6e6e', 22); for (let i = 0; i < 16; i++) { px(i, 0, [80, 80, 80]); px(i, 15, [80, 80, 80]); } break;
      case 'furnace_front': case 'furnace_lit': {
        noiseFill('#6e6e6e', 22);
        for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, name === 'furnace_lit' ? vary([240, 140, 40], 50) : [30, 30, 30]);
        for (let x = 3; x < 13; x++) px(x, 3, [50, 50, 50]);
        break;
      }
      case 'torch': {
        clear();
        for (let y = 6; y < 16; y++) { px(7, y, [120, 90, 50]); px(8, y, [100, 75, 40]); }
        px(7, 5, [255, 220, 90]); px(8, 5, [255, 200, 60]); px(7, 4, [255, 240, 150]); px(8, 4, [255, 160, 40]); px(7, 3, [255, 255, 200]);
        break;
      }
      case 'lamp': {
        noiseFill('#f2c46a', 40);
        for (let i = 0; i < 16; i++) { px(i, 0, [120, 80, 30]); px(i, 15, [120, 80, 30]); px(0, i, [120, 80, 30]); px(15, i, [120, 80, 30]); }
        speckle('#fff3c0', 6, 2);
        break;
      }
      case 'flower_red': case 'flower_yellow': {
        clear();
        for (let y = 8; y < 16; y++) px(7, y, [50, 120, 30]);
        px(6, 11, [60, 140, 40]); px(8, 12, [60, 140, 40]);
        const c: RGB = name === 'flower_red' ? [220, 30, 30] : [250, 220, 40];
        for (let y = 4; y < 8; y++) for (let x = 5; x < 10; x++) if (!((x === 5 || x === 9) && (y === 4 || y === 7))) px(x, y, vary(c, 30));
        px(7, 5, name === 'flower_red' ? [40, 20, 10] : [240, 160, 20]);
        break;
      }
      case 'tallgrass': {
        clear();
        for (let k = 0; k < 9; k++) { const x = 1 + Math.floor(rnd() * 14), h = 5 + Math.floor(rnd() * 9); for (let y = 16 - h; y < 16; y++) px(x, y, vary([80, 150, 50], 40)); }
        break;
      }
      case 'wool': noiseFill('#ececec', 16); break;
      case 'stonebrick': {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const off = Math.floor(y / 8) % 2 ? 8 : 0;
          const edge = y % 8 === 7 || (x + off) % 16 === 15;
          px(x, y, edge ? [70, 70, 70] : vary([125, 125, 125], 18));
        }
        break;
      }
      case 'bookshelf': {
        plank();
        const cols: RGB[] = [[150, 40, 40], [40, 80, 150], [50, 120, 50], [160, 130, 40], [100, 50, 120]];
        for (const row of [2, 9]) for (let x = 1; x < 15; x++) { const c = cols[Math.floor(rnd() * cols.length)]; for (let y = row; y < row + 5; y++) px(x, y, vary(c, 20)); }
        break;
      }
      case 'tnt_side': {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y > 4 && y < 11 ? [230, 230, 230] : [200, 50, 40], 20));
        for (let x = 3; x < 13; x += 2) for (let y = 6; y < 10; y++) px(x, y, [30, 30, 30]);
        break;
      }
      case 'tnt_top': noiseFill('#c43a30', 20); px(7, 7, [30, 30, 30]); px(8, 8, [30, 30, 30]); break;
      case 'tnt_bottom': noiseFill('#b0352b', 20); break;
      default:
        if (name.startsWith('crack')) {
          const stage = +name.slice(5);
          clear();
          const r2 = mulberry32(999);
          const n = (stage + 1) * 5;
          for (let k = 0; k < n; k++) {
            let x = 7 + Math.floor((r2() - 0.5) * 6), y = 7 + Math.floor((r2() - 0.5) * 6);
            const len = 3 + Math.floor(r2() * 4);
            for (let s = 0; s < len; s++) { if (x >= 0 && x < 16 && y >= 0 && y < 16) px(x, y, [0, 0, 0], 180); x += Math.round(r2() * 2 - 1); y += Math.round(r2() * 2 - 1); }
          }
        }
    }
    // average color
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((oy + y) * size + ox + x) * 4;
      if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    }
    TILE_COLORS[ti] = n ? [r / n, g / n, b / n] : [128, 128, 128];
  });
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------------- Icons ----------------
const iconCache: Record<number, string> = {};
let atlasRef: HTMLCanvasElement | null = null;
export function setIconAtlas(cv: HTMLCanvasElement) { atlasRef = cv; }

function tileRect(name: string) {
  const ti = TILE_INDEX[name];
  return [(ti % ATLAS_TILES) * TILE_PX, Math.floor(ti / ATLAS_TILES) * TILE_PX] as const;
}

function drawItemPixels(ctx: CanvasRenderingContext2D, id: number) {
  const def = ITEMS[id];
  const p = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * 2, y * 2, 2, 2); };
  const handle = '#7a5a30', handleD = '#5a3f1f';
  if (def.tool) {
    const c = def.color!, dark = shade(c, -50);
    const t = def.tool.type;
    // handle diagonal
    const hEnd = t === 'sword' ? 4 : 3;
    for (let i = hEnd; i < 14; i++) { p(15 - i, i, i % 2 ? handle : handleD); }
    if (t === 'pickaxe') {
      for (let i = 0; i < 10; i++) { p(3 + i, 2 + Math.round(Math.abs(i - 4.5) * 0.5) - 1, c); p(3 + i, 3 + Math.round(Math.abs(i - 4.5) * 0.5) - 1, dark); }
    } else if (t === 'axe') {
      for (let y = 1; y < 7; y++) for (let x = 7; x < 12; x++) if (!(x === 7 && (y === 1 || y === 6))) p(x, y, x === 7 ? dark : c);
    } else if (t === 'shovel') {
      for (let y = 1; y < 6; y++) for (let x = 10; x < 15; x++) if (Math.abs(x - 12) + Math.abs(y - 3) < 4) p(x - (y > 3 ? 1 : 0), y, (x + y) % 3 ? c : dark);
    } else {
      for (let i = 1; i < 11; i++) { p(14 - i, i, c); p(15 - i, i, dark); p(13 - i, i, shade(c, 30)); }
      for (let i = 0; i < 5; i++) p(2 + i, 9 + i - 2 + 2, '#3a2a1a');
    }
    return;
  }
  const blob = (c: string, shape: string[]) => shape.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') p(x + 2, y + 2, c); else if (ch === 'd') p(x + 2, y + 2, shade(c, -45)); else if (ch === 'l') p(x + 2, y + 2, shade(c, 60));
  }));
  const ingot = ['', '', '', '    llllll', '   l#####d', '  l#####dd', ' ldddddddd', ' dddddddd'];
  const gem = ['', '    llll', '   l####d', '  l######d', '  d######d', '   d####d', '    d##d', '     dd'];
  const meat = ['', '   ####', '  #lll##', ' #llll###', ' #lll####', '  ###### d', '     d  dd', '         dd'];
  const appleS = ['     d', '    d', '  #####', ' ###l###', ' ##l####', ' #######', '  #####', '   ###'];
  switch (id) {
    case I.STICK: for (let i = 3; i < 13; i++) p(15 - i, i, i % 2 ? handle : handleD); break;
    case I.COAL: blob('#2a2a2a', gem); break;
    case I.IRON_INGOT: blob('#d8d8d8', ingot); break;
    case I.GOLD_INGOT: blob('#f2cc38', ingot); break;
    case I.DIAMOND: blob('#4fe3d6', gem); break;
    case I.APPLE: blob('#d82a2a', appleS); p(7, 1, '#3a8a2a'); p(8, 1, '#3a8a2a'); break;
    case I.GOLDEN_APPLE: blob('#f2cc38', appleS); p(7, 1, '#3a8a2a'); break;
    case I.RAW_PORK: blob('#f08a8a', meat); break;
    case I.COOKED_PORK: blob('#b0652e', meat); break;
    case I.RAW_MUTTON: blob('#d84a4a', meat); break;
    case I.COOKED_MUTTON: blob('#8a4a20', meat); break;
    case I.ROTTEN_FLESH: blob('#7a8a3a', meat); break;
  }
}

function shade(c: string, amt: number) {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

export function getIcon(id: number): string {
  if (iconCache[id]) return iconCache[id];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (isBlockItem(id) && atlasRef) {
    const b = BLOCKS[id];
    if (b.render === 'cross') {
      const [sx, sy] = tileRect(b.tex[0]);
      ctx.drawImage(atlasRef, sx, sy, 16, 16, 2, 2, 28, 28);
    } else {
      const [top, , side, front] = b.tex;
      const draw = (name: string, a: number, bb: number, c: number, d: number, e: number, f: number, dark: number) => {
        ctx.save();
        ctx.setTransform(a, bb, c, d, e, f);
        const [sx, sy] = tileRect(name);
        ctx.drawImage(atlasRef!, sx, sy, 16, 16, 0, 0, 16, 16);
        if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, 16, 16); }
        ctx.restore();
      };
      // isometric cube: top, left, right
      draw(top, 0.875, 0.4375, -0.875, 0.4375, 16, 1.5, 0);
      draw(front ?? side, 0.875, 0.4375, 0, 0.9375, 2, 8.5, 0.25);
      draw(side, 0.875, -0.4375, 0, 0.9375, 16, 15.5, 0.42);
    }
  } else drawItemPixels(ctx, id);
  iconCache[id] = cv.toDataURL();
  return iconCache[id];
}
