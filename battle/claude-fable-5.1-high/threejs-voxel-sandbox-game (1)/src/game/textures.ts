// Procedural pixel-art texture atlas + UI icon generation.
import * as THREE from "three";
import { mulberry32 } from "./noise";
import { BLOCKS, ITEMS, isBlock } from "./blocks";

export const TILE = 16;
export const ATLAS_TILES = 16; // 16x16 tiles
export const ATLAS_PX = TILE * ATLAS_TILES;

type RGB = [number, number, number];
type Painter = (p: PixelCtx) => void;

class PixelCtx {
  data: Uint8ClampedArray;
  rand: () => number;
  constructor(seed: number) {
    this.data = new Uint8ClampedArray(TILE * TILE * 4);
    this.rand = mulberry32(seed);
  }
  set(x: number, y: number, c: RGB, a = 255) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = (y * TILE + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  fill(c: RGB, a = 255) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.set(x, y, c, a);
  }
  /** Fill with per-pixel brightness noise */
  noisy(c: RGB, amount: number, a = 255) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) this.set(x, y, vary(c, (this.rand() - 0.5) * 2 * amount), a);
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGB, a = 255) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, a);
  }
  /** Draw ASCII template with char→color map */
  template(rows: string[], map: Record<string, RGB>, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === "." || ch === " ") continue;
        const c = map[ch];
        if (c) this.set(x + ox, y + oy, c);
      }
    }
  }
}

export function vary(c: RGB, d: number): RGB {
  return [clamp255(c[0] * (1 + d)), clamp255(c[1] * (1 + d)), clamp255(c[2] * (1 + d))];
}
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

// Palette
const C = {
  stone: [128, 128, 128] as RGB,
  dirt: [134, 96, 67] as RGB,
  grass: [116, 172, 72] as RGB,
  sand: [219, 207, 163] as RGB,
  gravel: [136, 126, 126] as RGB,
  water: [52, 108, 220] as RGB,
  bark: [104, 82, 50] as RGB,
  wood: [160, 128, 80] as RGB,
  leaves: [60, 140, 50] as RGB,
  planks: [176, 143, 88] as RGB,
  cobble: [120, 120, 120] as RGB,
  bedrock: [60, 60, 60] as RGB,
  coal: [40, 40, 40] as RGB,
  iron: [216, 176, 150] as RGB,
  gold: [250, 220, 80] as RGB,
  diamond: [90, 230, 220] as RGB,
  snow: [240, 245, 250] as RGB,
  ice: [160, 200, 250] as RGB,
  cactus: [90, 150, 60] as RGB,
  brick: [160, 80, 70] as RGB,
  mortar: [200, 190, 180] as RGB,
  glow: [240, 200, 120] as RGB,
  lava: [230, 110, 30] as RGB,
  clay: [160, 165, 180] as RGB,
  wool: [235, 235, 235] as RGB,
  birch: [228, 226, 210] as RGB,
  spruce: [70, 50, 30] as RGB,
  spruceLeaves: [50, 90, 55] as RGB,
  handle: [110, 78, 44] as RGB,
  red: [200, 40, 40] as RGB,
  yellow: [240, 220, 60] as RGB,
  pumpkin: [220, 130, 40] as RGB,
};

function drawOre(p: PixelCtx, ore: RGB, light: RGB) {
  p.noisy(C.stone, 0.12);
  const spots = 5 + Math.floor(p.rand() * 3);
  for (let i = 0; i < spots; i++) {
    const x = 1 + Math.floor(p.rand() * 13),
      y = 1 + Math.floor(p.rand() * 13);
    p.set(x, y, ore);
    p.set(x + 1, y, ore);
    p.set(x, y + 1, light);
    p.set(x + 1, y + 1, ore);
  }
}

function drawCobble(p: PixelCtx, base: RGB, mossy = false) {
  p.noisy(base, 0.1);
  const rand = p.rand;
  for (let i = 0; i < 9; i++) {
    const cx = Math.floor(rand() * 16),
      cy = Math.floor(rand() * 16);
    const rx = 2 + Math.floor(rand() * 2),
      ry = 2 + Math.floor(rand() * 2);
    const shade = (rand() - 0.5) * 0.3;
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
          const edge = (x * x) / (rx * rx) + (y * y) / (ry * ry) > 0.6;
          p.set(((cx + x) % 16 + 16) % 16, ((cy + y) % 16 + 16) % 16, vary(base, shade - (edge ? 0.25 : 0)));
        }
      }
  }
  if (mossy) for (let i = 0; i < 40; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), vary([90, 130, 60], (rand() - 0.5) * 0.3));
}

function drawPlanks(p: PixelCtx, base: RGB) {
  p.noisy(base, 0.08);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y % 4 === 3) p.set(x, y, vary(base, -0.35));
      else if (p.rand() < 0.08) p.set(x, y, vary(base, -0.15));
    }
    if (y % 4 !== 3) {
      const nail = (Math.floor(y / 4) % 2) * 8 + 3;
      p.set(nail, y, vary(base, -0.3));
    }
  }
}

function drawLogSide(p: PixelCtx, base: RGB) {
  p.noisy(base, 0.1);
  for (let x = 0; x < 16; x++) {
    const dark = p.rand() < 0.35;
    for (let y = 0; y < 16; y++) {
      if (dark && p.rand() < 0.8) p.set(x, y, vary(base, -0.25 + (p.rand() - 0.5) * 0.1));
    }
  }
}

function drawLogTop(p: PixelCtx, bark: RGB, inner: RGB) {
  p.noisy(bark, 0.1);
  for (let r = 6; r >= 0; r -= 1) {
    const c = r % 2 === 0 ? vary(inner, -0.1) : vary(inner, 0.08);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (d <= r) p.set(x, y, vary(c, (p.rand() - 0.5) * 0.08));
      }
  }
}

function drawLeaves(p: PixelCtx, base: RGB, holes: number) {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const r = p.rand();
      if (r < holes) p.set(x, y, base, 0);
      else p.set(x, y, vary(base, (p.rand() - 0.5) * 0.5));
    }
}

function drawGrassSide(p: PixelCtx, dirt: RGB, grass: RGB) {
  p.noisy(dirt, 0.12);
  for (let x = 0; x < 16; x++) {
    const depth = 2 + Math.floor(p.rand() * 3);
    for (let y = 0; y < depth; y++) p.set(x, y, vary(grass, (p.rand() - 0.5) * 0.2));
  }
}

function drawTool(p: PixelCtx, rows: string[], mat: RGB) {
  p.template(rows, { h: C.handle, H: vary(C.handle, -0.3), m: mat, M: vary(mat, 0.25), d: vary(mat, -0.3) });
}

const PICKAXE = [
  "......mmmmmm....",
  ".....mMMMMMmm...",
  "....mMd...dMmm..",
  "...mMd.....dMm..",
  "...Md.......Mm..",
  "..md......h.dm..",
  "..md.....hH..m..",
  "........hH......",
  ".......hH.......",
  "......hH........",
  ".....hH.........",
  "....hH..........",
  "...hH...........",
  "..hH............",
  ".hH.............",
  "................",
];
const AXE = [
  "......mmmm......",
  ".....mMMMmm.....",
  "....mMd.dMmm....",
  "....mMd.hhmm....",
  ".....mdhH.Mm....",
  "......hHmmm.....",
  ".....hH.........",
  "....hH..........",
  "...hH...........",
  "..hH............",
  ".hH.............",
  "................",
  "................",
  "................",
  "................",
  "................",
];
const SWORD = [
  "............mm..",
  "...........mMm..",
  "..........mMm...",
  ".........mMm....",
  "........mMm.....",
  ".......mMm......",
  "......mMm.......",
  "..h..mMm........",
  "...hhmm.........",
  "..hhhh..........",
  ".hH.hh..........",
  "hH..............",
  "................",
  "................",
  "................",
  "................",
];
const SHOVEL = [
  "..........mmm...",
  ".........mMMmm..",
  ".........mMMMm..",
  ".........mmMmm..",
  "........hHmmm...",
  ".......hH.......",
  "......hH........",
  ".....hH.........",
  "....hH..........",
  "...hH...........",
  "..hH............",
  ".hH.............",
  "................",
  "................",
  "................",
  "................",
];

const painters: Record<string, Painter> = {
  stone: (p) => p.noisy(C.stone, 0.1),
  dirt: (p) => p.noisy(C.dirt, 0.14),
  grass_top: (p) => p.noisy([150, 150, 150], 0.16), // tinted in shader
  grass_side: (p) => drawGrassSide(p, C.dirt, C.grass),
  sand: (p) => p.noisy(C.sand, 0.07),
  gravel: (p) => {
    p.noisy(C.gravel, 0.1);
    for (let i = 0; i < 30; i++) p.set(Math.floor(p.rand() * 16), Math.floor(p.rand() * 16), vary(C.gravel, (p.rand() - 0.5) * 0.6));
  },
  water: (p) => p.noisy([255, 255, 255], 0.06, 190), // tinted in shader
  log_top: (p) => drawLogTop(p, C.bark, C.wood),
  log_side: (p) => drawLogSide(p, C.bark),
  leaves: (p) => drawLeaves(p, [150, 150, 150], 0.07), // tinted
  planks: (p) => drawPlanks(p, C.planks),
  birch_planks: (p) => drawPlanks(p, [205, 190, 140]),
  spruce_planks: (p) => drawPlanks(p, [115, 85, 50]),
  cobble: (p) => drawCobble(p, C.cobble),
  mossy_cobble: (p) => drawCobble(p, C.cobble, true),
  bedrock: (p) => drawCobble(p, C.bedrock),
  coal_ore: (p) => drawOre(p, C.coal, [70, 70, 70]),
  iron_ore: (p) => drawOre(p, C.iron, [240, 210, 190]),
  gold_ore: (p) => drawOre(p, C.gold, [255, 245, 170]),
  diamond_ore: (p) => drawOre(p, C.diamond, [200, 255, 250]),
  glass: (p) => {
    p.fill([220, 240, 255], 0);
    for (let i = 0; i < 16; i++) {
      p.set(i, 0, [230, 240, 250]);
      p.set(i, 15, [230, 240, 250]);
      p.set(0, i, [230, 240, 250]);
      p.set(15, i, [230, 240, 250]);
    }
    for (let i = 2; i < 6; i++) p.set(i, 7 - i + 2, [255, 255, 255], 160);
    for (let i = 4; i < 8; i++) p.set(i + 2, 10 - i + 2, [255, 255, 255], 120);
  },
  torch: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(7, 6, 2, 10, C.handle);
    p.rect(7, 4, 2, 2, [255, 220, 90]);
    p.rect(7, 3, 2, 1, [255, 160, 40]);
    p.set(6, 5, [255, 190, 60]);
    p.set(9, 5, [255, 190, 60]);
  },
  lantern: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(5, 5, 6, 8, [60, 60, 70]);
    p.rect(6, 6, 4, 6, [255, 210, 120]);
    p.rect(7, 3, 2, 2, [60, 60, 70]);
    p.rect(6, 13, 4, 1, [60, 60, 70]);
  },
  table_top: (p) => {
    drawPlanks(p, C.planks);
    p.rect(0, 0, 16, 1, vary(C.planks, -0.4));
    p.rect(0, 15, 16, 1, vary(C.planks, -0.4));
    p.rect(0, 0, 1, 16, vary(C.planks, -0.4));
    p.rect(15, 0, 1, 16, vary(C.planks, -0.4));
    p.rect(7, 0, 2, 16, vary(C.planks, -0.3));
    p.rect(0, 7, 16, 2, vary(C.planks, -0.3));
  },
  table_side: (p) => {
    drawPlanks(p, C.planks);
    p.rect(0, 0, 16, 2, vary(C.planks, -0.3));
    p.rect(2, 4, 4, 4, [120, 120, 120]);
    p.rect(9, 5, 4, 3, [140, 100, 60]);
  },
  furnace_top: (p) => drawCobble(p, [110, 110, 110]),
  furnace_side: (p) => drawCobble(p, [105, 105, 105]),
  furnace_front: (p) => {
    drawCobble(p, [105, 105, 105]);
    p.rect(4, 8, 8, 6, [30, 30, 30]);
    p.rect(5, 10, 6, 4, [255, 140, 30]);
    p.rect(6, 11, 4, 3, [255, 210, 80]);
    p.rect(4, 2, 8, 4, [40, 40, 40]);
  },
  snow: (p) => p.noisy(C.snow, 0.04),
  snow_grass_side: (p) => drawGrassSide(p, C.dirt, C.snow),
  ice: (p) => {
    p.noisy(C.ice, 0.05, 220);
    for (let i = 0; i < 6; i++) p.set(i + 3, 12 - i, [230, 245, 255], 230);
  },
  cactus_top: (p) => {
    p.noisy(C.cactus, 0.1);
    p.rect(1, 1, 14, 14, vary(C.cactus, 0.15));
  },
  cactus_side: (p) => {
    p.noisy(C.cactus, 0.1);
    for (let y = 0; y < 16; y += 3) {
      p.set(3, y, [240, 240, 220]);
      p.set(11, y + 1, [240, 240, 220]);
    }
  },
  flower_red: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(7, 7, 2, 9, [60, 120, 40]);
    p.set(5, 10, [60, 120, 40]);
    p.set(6, 9, [60, 120, 40]);
    p.rect(6, 3, 4, 4, C.red);
    p.rect(5, 4, 6, 2, C.red);
    p.rect(7, 4, 2, 2, [40, 30, 30]);
  },
  flower_yellow: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(7, 7, 2, 9, [60, 120, 40]);
    p.set(9, 10, [60, 120, 40]);
    p.rect(6, 3, 4, 4, C.yellow);
    p.rect(5, 4, 6, 2, C.yellow);
    p.rect(7, 4, 2, 2, [200, 160, 40]);
  },
  tall_grass: (p) => {
    p.fill([0, 0, 0], 0);
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(p.rand() * 14);
      const h = 5 + Math.floor(p.rand() * 9);
      for (let y = 0; y < h; y++) p.set(x + (y > h / 2 ? Math.round(p.rand() * 0.6) : 0), 15 - y, vary([150, 150, 150], (p.rand() - 0.5) * 0.3));
    }
  },
  dead_bush: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(7, 9, 2, 7, [120, 85, 45]);
    for (let i = 0; i < 6; i++) {
      let x = 7 + Math.floor(p.rand() * 2),
        y = 9;
      const dx = p.rand() < 0.5 ? -1 : 1;
      for (let s = 0; s < 6; s++) {
        p.set(x, y, [130, 95, 50]);
        if (p.rand() < 0.6) x += dx;
        y--;
      }
    }
  },
  mushroom: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(7, 9, 2, 7, [220, 210, 190]);
    p.rect(4, 6, 8, 3, [190, 50, 40]);
    p.rect(5, 5, 6, 1, [190, 50, 40]);
    p.set(5, 7, [255, 255, 255]);
    p.set(9, 6, [255, 255, 255]);
    p.set(8, 8, [255, 255, 255]);
  },
  sandstone_top: (p) => p.noisy(vary(C.sand, -0.05), 0.05),
  sandstone_side: (p) => {
    p.noisy(vary(C.sand, -0.05), 0.05);
    p.rect(0, 0, 16, 1, vary(C.sand, 0.05));
    p.rect(0, 5, 16, 1, vary(C.sand, -0.2));
    p.rect(0, 10, 16, 1, vary(C.sand, -0.2));
    p.rect(0, 15, 16, 1, vary(C.sand, -0.25));
  },
  birch_top: (p) => drawLogTop(p, C.birch, [205, 190, 140]),
  birch_side: (p) => {
    p.noisy(C.birch, 0.05);
    for (let i = 0; i < 8; i++) p.rect(Math.floor(p.rand() * 14), Math.floor(p.rand() * 16), 2 + Math.floor(p.rand() * 3), 1, [40, 40, 40]);
  },
  birch_leaves: (p) => drawLeaves(p, [165, 165, 165], 0.06),
  spruce_top: (p) => drawLogTop(p, C.spruce, [115, 85, 50]),
  spruce_side: (p) => drawLogSide(p, C.spruce),
  spruce_leaves: (p) => drawLeaves(p, C.spruceLeaves, 0.06),
  brick: (p) => {
    p.noisy(C.mortar, 0.05);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : 4;
      for (let col = -1; col < 3; col++) {
        const x0 = col * 8 + off;
        const shade = (p.rand() - 0.5) * 0.2;
        for (let y = row * 4; y < row * 4 + 3; y++) for (let x = x0; x < x0 + 7; x++) if (x >= 0 && x < 16) p.set(x, y, vary(C.brick, shade + (p.rand() - 0.5) * 0.08));
      }
    }
  },
  stone_brick: (p) => {
    p.noisy(vary(C.stone, -0.3), 0.05);
    const cells = [
      [0, 0, 8, 8],
      [8, 0, 8, 8],
      [0, 8, 8, 8],
      [8, 8, 8, 8],
    ];
    for (const [x, y, w, h] of cells) {
      const shade = (p.rand() - 0.5) * 0.15;
      for (let yy = y; yy < y + h - 1; yy++) for (let xx = x; xx < x + w - 1; xx++) p.set(xx, yy, vary(C.stone, shade + (p.rand() - 0.5) * 0.1));
    }
  },
  glowstone: (p) => {
    p.noisy([200, 160, 90], 0.15);
    for (let i = 0; i < 25; i++) p.set(Math.floor(p.rand() * 16), Math.floor(p.rand() * 16), [255, 240, 180]);
  },
  lava: (p) => {
    p.noisy(C.lava, 0.2);
    for (let i = 0; i < 30; i++) p.set(Math.floor(p.rand() * 16), Math.floor(p.rand() * 16), [255, 230, 80]);
  },
  clay: (p) => p.noisy(C.clay, 0.06),
  wool: (p) => {
    p.noisy(C.wool, 0.06);
    for (let i = 0; i < 24; i++) p.set(Math.floor(p.rand() * 16), Math.floor(p.rand() * 16), [210, 210, 210]);
  },
  bookshelf: (p) => {
    drawPlanks(p, C.planks);
    const cols: RGB[] = [[180, 50, 50], [50, 90, 180], [60, 150, 70], [200, 170, 60], [120, 60, 140]];
    for (const row of [1, 9]) {
      p.rect(0, row, 16, 6, [40, 30, 20]);
      let x = 1;
      while (x < 15) {
        const w = 1 + Math.floor(p.rand() * 2);
        const c = cols[Math.floor(p.rand() * cols.length)];
        p.rect(x, row + Math.floor(p.rand() * 2), w, 5, c);
        x += w + (p.rand() < 0.3 ? 1 : 0);
      }
    }
  },
  bed_top: (p) => {
    p.fill([180, 40, 40]);
    p.rect(0, 0, 16, 5, [240, 240, 240]);
    p.rect(1, 1, 14, 3, [255, 255, 255]);
    for (let y = 6; y < 16; y += 3) p.rect(0, y, 16, 1, [150, 30, 30]);
  },
  bed_side: (p) => {
    drawPlanks(p, C.planks);
    p.rect(0, 0, 16, 8, [180, 40, 40]);
    p.rect(0, 0, 5, 8, [240, 240, 240]);
  },
  pumpkin_top: (p) => {
    p.noisy(C.pumpkin, 0.1);
    p.rect(7, 7, 2, 2, [90, 120, 40]);
  },
  pumpkin_side: (p) => {
    p.noisy(C.pumpkin, 0.1);
    for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, vary(C.pumpkin, -0.25));
  },
  // Items
  stick: (p) => drawTool(p, ["..............", "..............", "...........hH.", "..........hH..", ".........hH...", "........hH....", ".......hH.....", "......hH......", ".....hH.......", "....hH........", "...hH.........", "..hH..........", ".hH...........", "hH............"], C.wood),
  coal: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(4, 4, 8, 8, C.coal);
    p.rect(3, 6, 10, 5, C.coal);
    p.rect(6, 3, 5, 10, C.coal);
    p.set(6, 6, [80, 80, 80]);
    p.set(7, 5, [80, 80, 80]);
  },
  iron_ingot: (p) => ingot(p, [220, 220, 220]),
  gold_ingot: (p) => ingot(p, C.gold),
  diamond: (p) => {
    p.fill([0, 0, 0], 0);
    p.template(
      ["....mmmmmmm.....", "...mMMMMMMMm....", "..mMMMdddMMMm...", ".mMMddddddMMm...", "..mMdddddddm....", "...mMdddddm.....", "....mMdddm......", ".....mMdm.......", "......mm........"],
      { m: [40, 170, 170], M: [220, 255, 250], d: C.diamond },
      0,
      3,
    );
  },
  pickaxe_0: (p) => drawTool(p, PICKAXE, C.wood),
  pickaxe_1: (p) => drawTool(p, PICKAXE, C.stone),
  pickaxe_2: (p) => drawTool(p, PICKAXE, [220, 220, 220]),
  pickaxe_3: (p) => drawTool(p, PICKAXE, C.diamond),
  axe_0: (p) => drawTool(p, AXE, C.wood),
  axe_1: (p) => drawTool(p, AXE, C.stone),
  axe_2: (p) => drawTool(p, AXE, [220, 220, 220]),
  axe_3: (p) => drawTool(p, AXE, C.diamond),
  shovel_0: (p) => drawTool(p, SHOVEL, C.wood),
  shovel_1: (p) => drawTool(p, SHOVEL, C.stone),
  shovel_2: (p) => drawTool(p, SHOVEL, [220, 220, 220]),
  shovel_3: (p) => drawTool(p, SHOVEL, C.diamond),
  sword_0: (p) => drawTool(p, SWORD, C.wood),
  sword_1: (p) => drawTool(p, SWORD, C.stone),
  sword_2: (p) => drawTool(p, SWORD, [220, 220, 220]),
  sword_3: (p) => drawTool(p, SWORD, C.diamond),
  porkchop: (p) => meat(p, [240, 150, 150], [250, 220, 210]),
  cooked_porkchop: (p) => meat(p, [190, 120, 70], [230, 190, 140]),
  beef: (p) => meat(p, [200, 60, 60], [240, 200, 200]),
  steak: (p) => meat(p, [120, 70, 40], [180, 120, 80]),
  mutton: (p) => meat(p, [220, 90, 90], [240, 210, 210]),
  cooked_mutton: (p) => meat(p, [150, 90, 50], [200, 150, 100]),
  apple: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(4, 5, 8, 8, C.red);
    p.rect(3, 6, 10, 5, C.red);
    p.rect(5, 4, 2, 1, C.red);
    p.rect(9, 4, 2, 1, C.red);
    p.rect(7, 2, 1, 3, C.handle);
    p.rect(8, 3, 2, 1, [80, 160, 60]);
    p.set(5, 6, [255, 150, 150]);
  },
  bowl: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(2, 8, 12, 2, C.handle);
    p.rect(3, 10, 10, 2, C.handle);
    p.rect(5, 12, 6, 1, C.handle);
  },
  stew: (p) => {
    p.fill([0, 0, 0], 0);
    p.rect(2, 8, 12, 2, C.handle);
    p.rect(3, 10, 10, 2, C.handle);
    p.rect(5, 12, 6, 1, C.handle);
    p.rect(3, 7, 10, 2, [200, 150, 110]);
    p.rect(5, 6, 3, 1, [190, 50, 40]);
    p.rect(9, 6, 2, 1, [200, 200, 180]);
  },
  particle: (p) => p.fill([255, 255, 255]),
};

function ingot(p: PixelCtx, c: RGB) {
  p.fill([0, 0, 0], 0);
  p.rect(3, 6, 10, 5, c);
  p.rect(5, 4, 9, 2, vary(c, 0.15));
  p.rect(2, 9, 10, 3, vary(c, -0.2));
  p.rect(12, 6, 2, 5, vary(c, -0.25));
}
function meat(p: PixelCtx, main: RGB, fat: RGB) {
  p.fill([0, 0, 0], 0);
  p.rect(4, 3, 8, 10, main);
  p.rect(3, 5, 10, 6, main);
  p.rect(4, 9, 4, 4, fat);
  p.rect(5, 4, 2, 2, vary(main, 0.2));
  p.rect(10, 7, 2, 3, vary(main, -0.2));
}

// Crack overlay stages
for (let s = 0; s < 10; s++) {
  painters[`crack_${s}`] = (p) => {
    p.fill([0, 0, 0], 0);
    const rand = mulberry32(1234);
    const lines = 2 + s * 1.6;
    for (let i = 0; i < lines; i++) {
      let x = Math.floor(rand() * 16),
        y = Math.floor(rand() * 16);
      const len = 3 + Math.floor(rand() * 6);
      for (let k = 0; k < len; k++) {
        p.set(x, y, [20, 20, 20], 200);
        if (rand() < 0.5) x += rand() < 0.5 ? -1 : 1;
        else y += rand() < 0.5 ? -1 : 1;
      }
    }
  };
}

export const TILE_INDEX = new Map<string, number>();
export let atlasCanvas: HTMLCanvasElement;
export let atlasTexture: THREE.Texture;
const tilePixels = new Map<string, Uint8ClampedArray>();

export function buildAtlas(): THREE.Texture {
  if (atlasTexture) return atlasTexture;
  atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = ATLAS_PX;
  atlasCanvas.height = ATLAS_PX;
  const ctx = atlasCanvas.getContext("2d")!;
  let idx = 0;
  for (const name of Object.keys(painters)) {
    const p = new PixelCtx(idx * 7919 + 17);
    painters[name](p);
    const img = new ImageData(p.data as unknown as ImageDataArray, TILE, TILE);
    const tx = idx % ATLAS_TILES,
      ty = Math.floor(idx / ATLAS_TILES);
    ctx.putImageData(img, tx * TILE, ty * TILE);
    TILE_INDEX.set(name, idx);
    tilePixels.set(name, p.data);
    idx++;
  }
  atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.needsUpdate = true;
  return atlasTexture;
}

export function tileIndex(name: string): number {
  const i = TILE_INDEX.get(name);
  if (i === undefined) {
    console.warn("Missing tile", name);
    return 0;
  }
  return i;
}

/** Average color of a tile (for particles). */
const avgCache = new Map<string, RGB>();
export function tileAverageColor(name: string): RGB {
  let c = avgCache.get(name);
  if (c) return c;
  const d = tilePixels.get(name);
  if (!d) return [255, 255, 255];
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n++;
  }
  c = n ? [r / n, g / n, b / n] : [255, 255, 255];
  avgCache.set(name, c);
  return c;
}
export function tileRandomColor(name: string, rand: number): RGB {
  const d = tilePixels.get(name);
  if (!d) return [255, 255, 255];
  for (let tries = 0; tries < 8; tries++) {
    const i = (Math.floor(((rand * 7919 + tries * 131) % 1) * 256) % 256) * 4;
    if (d[i + 3] >= 128) return [d[i], d[i + 1], d[i + 2]];
  }
  return tileAverageColor(name);
}

export const GRASS_TINT: RGB = [116 / 150, 172 / 150, 72 / 150];
export const FOLIAGE_TINT: RGB = [66 / 150, 140 / 150, 50 / 150];

// ---------- UI icons ----------
const iconCache = new Map<number, string>();

function tileCanvas(name: string, tint?: RGB): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext("2d")!;
  const data = tilePixels.get(name);
  if (!data) return c;
  const copy = new Uint8ClampedArray(data.length);
  copy.set(data);
  if (tint) {
    for (let i = 0; i < copy.length; i += 4) {
      copy[i] = clamp255(copy[i] * tint[0]);
      copy[i + 1] = clamp255(copy[i + 1] * tint[1]);
      copy[i + 2] = clamp255(copy[i + 2] * tint[2]);
    }
  }
  ctx.putImageData(new ImageData(copy as unknown as ImageDataArray, TILE, TILE), 0, 0);
  return c;
}

function tintFor(name: string): RGB | undefined {
  if (name === "grass_top" || name === "tall_grass") return GRASS_TINT;
  if (name === "leaves" || name === "birch_leaves") return FOLIAGE_TINT;
  if (name === "water") return [0.25, 0.45, 0.9];
  return undefined;
}

function shadeCanvas(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(0,0,0,${amount})`;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function getIcon(id: number): string {
  let url = iconCache.get(id);
  if (url) return url;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  if (isBlock(id)) {
    const def = BLOCKS[id];
    if (def.shape === "cross") {
      ctx.drawImage(tileCanvas(def.tex[0], tintFor(def.tex[0])), 4, 4, 56, 56);
    } else {
      const texs = def.tex;
      const top = texs[0];
      const side = texs.length >= 3 ? texs[2] : texs[0];
      const side2 = texs.length === 4 ? texs[3] : side;
      const w = 26, h = 26, H = 30;
      const cx = size / 2, topY = 4;
      const s = 1 / TILE;
      // top
      ctx.setTransform(w * s, (h / 2) * s, -w * s, (h / 2) * s, cx, topY);
      ctx.drawImage(tileCanvas(top, tintFor(top)), 0, 0);
      // left (front)
      ctx.setTransform(w * s, (h / 2) * s, 0, H * s, cx - w, topY + h / 2);
      ctx.drawImage(shadeCanvas(tileCanvas(side, tintFor(side)), 0.2), 0, 0);
      // right
      ctx.setTransform(w * s, -(h / 2) * s, 0, H * s, cx, topY + h);
      ctx.drawImage(shadeCanvas(tileCanvas(side2, tintFor(side2)), 0.4), 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  } else {
    const def = ITEMS[id];
    if (def) ctx.drawImage(tileCanvas(def.tex), 4, 4, 56, 56);
  }
  url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}
