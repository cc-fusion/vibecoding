// Procedurally generated 16x16 pixel-art texture atlas. No external assets required.
import * as THREE from "three";
import { hashString, mulberry32 } from "./noise";

export const TILE = 16;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 16;

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

class Painter {
  data = new Uint8ClampedArray(TILE * TILE * 4);
  rng: () => number;
  constructor(seed: string) {
    this.rng = mulberry32(hashString(seed));
  }
  set(x: number, y: number, c: RGB | RGBA) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? (c as RGBA)[3] : 255;
  }
  get(x: number, y: number): RGBA {
    const i = (((y + TILE) % TILE) * TILE + ((x + TILE) % TILE)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  fill(c: RGB | RGBA) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.set(x, y, c);
  }
  /** fill with base colour + random per-pixel brightness variance */
  noise(base: RGB, v: number, alpha = 255) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const d = (this.rng() - 0.5) * 2 * v;
        this.set(x, y, [base[0] + d, base[1] + d, base[2] + d, alpha]);
      }
  }
  /** multiply brightness of existing pixel */
  shade(x: number, y: number, f: number) {
    const c = this.get(x, y);
    this.set(x, y, [c[0] * f, c[1] * f, c[2] * f, c[3]]);
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGB | RGBA) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c);
  }
  speckle(c: RGB, count: number, v = 0) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(this.rng() * TILE),
        y = Math.floor(this.rng() * TILE);
      const d = (this.rng() - 0.5) * 2 * v;
      this.set(x, y, [c[0] + d, c[1] + d, c[2] + d]);
    }
  }
  /** blotches of colour (ore spots etc.) */
  blobs(c: RGB, count: number, size: number, hi?: RGB) {
    for (let i = 0; i < count; i++) {
      const cx = 2 + Math.floor(this.rng() * (TILE - 4)),
        cy = 2 + Math.floor(this.rng() * (TILE - 4));
      for (let dy = -size; dy <= size; dy++)
        for (let dx = -size; dx <= size; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > size) continue;
          if (Math.abs(dx) + Math.abs(dy) === size && this.rng() < 0.5) continue;
          this.set(cx + dx, cy + dy, dx + dy < 0 && hi ? hi : c);
        }
    }
  }
  /** wrap-around voronoi cobble pattern */
  cobble(base: RGB, v: number, edge: number, cells = 7) {
    const pts: [number, number][] = [];
    for (let i = 0; i < cells; i++) pts.push([this.rng() * TILE, this.rng() * TILE]);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        let d1 = 1e9,
          d2 = 1e9,
          idx = 0;
        for (let i = 0; i < pts.length; i++) {
          let dx = Math.abs(x + 0.5 - pts[i][0]),
            dy = Math.abs(y + 0.5 - pts[i][1]);
          if (dx > TILE / 2) dx = TILE - dx;
          if (dy > TILE / 2) dy = TILE - dy;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            idx = i;
          } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        const cellShade = 0.88 + ((idx * 37) % 10) / 40;
        let f = cellShade;
        if (e < 1.0) f *= edge;
        else if (e < 1.8) f *= 0.95;
        const d = (this.rng() - 0.5) * 2 * v;
        this.set(x, y, [(base[0] + d) * f, (base[1] + d) * f, (base[2] + d) * f]);
      }
  }
  /** draw an ascii template with a palette (chars not in palette are skipped) */
  template(rows: string[], pal: Record<string, RGB | RGBA>, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (pal[ch]) this.set(x + ox, y + oy, pal[ch]);
      }
  }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dark = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

const STONE: RGB = [127, 127, 127];
const DIRT: RGB = [134, 96, 67];
const GRASS: RGB = [96, 158, 58];
const SAND: RGB = [219, 207, 163];
const SNOW: RGB = [242, 246, 250];

function planks(p: Painter, base: RGB) {
  p.noise(base, 7);
  for (let y = 0; y < TILE; y++) {
    if (y % 4 === 3) for (let x = 0; x < TILE; x++) p.shade(x, y, 0.7);
    // grain
    for (let x = 0; x < TILE; x++) if (p.rng() < 0.12) p.shade(x, y, 0.9);
  }
  // plank end seams
  p.shade(7, 0, 0.7); p.shade(7, 1, 0.7); p.shade(7, 2, 0.7);
  p.shade(3, 4, 0.7); p.shade(3, 5, 0.7); p.shade(3, 6, 0.7);
  p.shade(11, 8, 0.7); p.shade(11, 9, 0.7); p.shade(11, 10, 0.7);
  p.shade(5, 12, 0.7); p.shade(5, 13, 0.7); p.shade(5, 14, 0.7);
}

function logSide(p: Painter, base: RGB, v: number) {
  p.noise(base, v);
  for (let x = 0; x < TILE; x++) {
    const f = x % 3 === 0 ? 0.75 : x % 3 === 1 ? 1.05 : 0.95;
    for (let y = 0; y < TILE; y++) {
      p.shade(x, y, f);
      if (p.rng() < 0.08) p.shade(x, y, 0.8);
    }
  }
}
function logTop(p: Painter, bark: RGB, inner: RGB) {
  p.noise(bark, 8);
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++) {
      const dx = x - 7.5,
        dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.floor(r) % 2 === 0 ? 1 : 0.85;
      const d = (p.rng() - 0.5) * 10;
      p.set(x, y, [inner[0] * ring + d, inner[1] * ring + d, inner[2] * ring + d]);
    }
}
function leaves(p: Painter, base: RGB, holes: number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = p.rng();
      if (r < holes) p.set(x, y, [0, 0, 0, 0]);
      else {
        const f = 0.7 + p.rng() * 0.5;
        p.set(x, y, [base[0] * f, base[1] * f, base[2] * f, 255]);
      }
    }
}
function ore(p: Painter, c: RGB, hi: RGB) {
  p.noise(STONE, 9);
  p.blobs(c, 5, 1, hi);
}
function bricks(p: Painter, brick: RGB, mortar: RGB, bh: number, bw: number) {
  p.noise(mortar, 5);
  for (let y = 0; y < TILE; y++) {
    const row = Math.floor(y / bh);
    if (y % bh === bh - 1) continue;
    const off = row % 2 === 0 ? 0 : Math.floor(bw / 2);
    for (let x = 0; x < TILE; x++) {
      if ((x + off) % bw === bw - 1) continue;
      const d = (p.rng() - 0.5) * 16;
      const f = 1 + (((row * 7 + Math.floor((x + off) / bw)) % 3) - 1) * 0.06;
      p.set(x, y, [(brick[0] + d) * f, (brick[1] + d) * f, (brick[2] + d) * f]);
    }
  }
}

const TOOL_TEMPLATES: Record<string, string[]> = {
  pickaxe: [
    "......mmmmm.....",
    ".....mMMMMMm....",
    "....mM....dMm...",
    "...mM..h...dM...",
    "...m..h.....d...",
    ".....h......d...",
    "....h...........",
    "...h............",
    "..h.............",
    ".h..............",
    "h...............",
  ],
  axe: [
    "......mmm.......",
    ".....mMMmm......",
    ".....mMMhdm.....",
    ".....mmmhdm.....",
    "......mmhd......",
    "......h.d.......",
    ".....h..........",
    "....h...........",
    "...h............",
    "..h.............",
    ".h..............",
    "h...............",
  ],
  shovel: [
    "......mmm.......",
    ".....mMMMm......",
    ".....mMMMm......",
    ".....mmMdm......",
    "......mhd.......",
    ".......h........",
    "......h.........",
    ".....h..........",
    "....h...........",
    "...h............",
    "..h.............",
    ".h..............",
  ],
};
const TOOL_MATS: [RGB, RGB, RGB][] = [
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[150, 112, 62], [185, 145, 90], [110, 80, 40]],
  [[122, 122, 122], [160, 160, 160], [85, 85, 85]],
  [[200, 200, 205], [240, 240, 245], [140, 140, 150]],
  [[235, 195, 45], [255, 238, 120], [180, 140, 20]],
  [[70, 215, 205], [170, 250, 245], [40, 150, 150]],
];
const HANDLE: RGB = [112, 82, 42];

const painters: Record<string, (p: Painter) => void> = {
  stone: (p) => {
    p.noise(STONE, 9);
    p.blobs(dark(STONE, 0.9), 4, 1);
  },
  smooth_stone: (p) => p.noise([150, 150, 150], 4),
  cobble: (p) => p.cobble(STONE, 7, 0.6),
  mossy_cobble: (p) => {
    p.cobble(STONE, 7, 0.6);
    p.blobs([86, 128, 60], 6, 1, [100, 150, 70]);
  },
  dirt: (p) => {
    p.noise(DIRT, 11);
    p.speckle(dark(DIRT, 0.7), 20);
    p.speckle([160, 120, 85], 10);
  },
  grass_top: (p) => {
    p.noise(GRASS, 11);
    p.speckle(dark(GRASS, 0.8), 25);
  },
  grass_side: (p) => {
    p.noise(DIRT, 11);
    p.speckle(dark(DIRT, 0.7), 12);
    for (let x = 0; x < TILE; x++) {
      const h = 2 + Math.floor(p.rng() * 3);
      for (let y = 0; y < h; y++) {
        const d = (p.rng() - 0.5) * 20;
        p.set(x, y, [GRASS[0] + d, GRASS[1] + d, GRASS[2] + d]);
      }
    }
  },
  snowy_grass_side: (p) => {
    p.noise(DIRT, 11);
    for (let x = 0; x < TILE; x++) {
      const h = 3 + Math.floor(p.rng() * 2);
      for (let y = 0; y < h; y++) p.set(x, y, mix(SNOW, [200, 210, 225], p.rng() * 0.5));
    }
  },
  snow: (p) => p.noise(SNOW, 5),
  sand: (p) => {
    p.noise(SAND, 8);
    p.speckle(dark(SAND, 0.85), 15);
  },
  sandstone_top: (p) => p.noise(SAND, 6),
  sandstone_side: (p) => {
    p.noise(SAND, 5);
    for (let y = 0; y < TILE; y++) {
      const f = y % 5 === 0 ? 0.82 : y % 5 === 2 ? 1.04 : 1;
      for (let x = 0; x < TILE; x++) p.shade(x, y, f);
    }
  },
  gravel: (p) => {
    p.noise([130, 122, 118], 14);
    p.blobs([100, 92, 90], 6, 1, [150, 145, 140]);
  },
  clay: (p) => {
    p.noise([158, 164, 176], 7);
    p.blobs([140, 146, 160], 4, 1);
  },
  water: (p) => {
    p.noise([38, 88, 200], 12, 175);
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(p.rng() * TILE),
        y = Math.floor(p.rng() * TILE);
      p.set(x, y, [90, 140, 230, 185]);
      p.set(x + 1, y, [80, 130, 225, 185]);
    }
  },
  lava: (p) => {
    p.noise([225, 90, 20], 20);
    p.blobs([255, 200, 60], 5, 1, [255, 240, 120]);
    p.blobs([170, 40, 10], 3, 1);
  },
  ice: (p) => {
    p.noise([170, 205, 245], 8);
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(p.rng() * TILE),
        y = Math.floor(p.rng() * TILE);
      for (let k = 0; k < 6; k++) {
        p.set(x, y, [220, 235, 255]);
        x += p.rng() < 0.5 ? 1 : 0;
        y += p.rng() < 0.6 ? 1 : -1;
      }
    }
  },
  oak_log: (p) => logSide(p, [104, 82, 50], 9),
  oak_log_top: (p) => logTop(p, [104, 82, 50], [176, 142, 88]),
  birch_log: (p) => {
    p.noise([222, 222, 212], 6);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(p.rng() * TILE),
        y = Math.floor(p.rng() * TILE),
        w = 1 + Math.floor(p.rng() * 3);
      p.rect(x, y, w, 1, [40, 40, 40]);
      if (p.rng() < 0.5) p.rect(x, y + 1, 1, 1, [60, 60, 60]);
    }
  },
  birch_log_top: (p) => logTop(p, [222, 222, 212], [204, 186, 138]),
  spruce_log: (p) => logSide(p, [60, 42, 24], 8),
  spruce_log_top: (p) => logTop(p, [60, 42, 24], [140, 106, 64]),
  oak_leaves: (p) => leaves(p, [58, 118, 34], 0.14),
  birch_leaves: (p) => leaves(p, [104, 160, 62], 0.14),
  spruce_leaves: (p) => leaves(p, [44, 86, 56], 0.1),
  oak_planks: (p) => planks(p, [174, 138, 84]),
  birch_planks: (p) => planks(p, [206, 192, 142]),
  spruce_planks: (p) => planks(p, [114, 84, 50]),
  glass: (p) => {
    p.fill([255, 255, 255, 0]);
    for (let i = 0; i < TILE; i++) {
      p.set(i, 0, [200, 225, 235]);
      p.set(i, TILE - 1, [200, 225, 235]);
      p.set(0, i, [200, 225, 235]);
      p.set(TILE - 1, i, [200, 225, 235]);
    }
    for (let i = 2; i < 6; i++) p.set(i, 7 - i + 1, [235, 245, 250, 200]);
    for (let i = 3; i < 8; i++) p.set(i + 2, 11 - i + 2, [235, 245, 250, 150]);
  },
  bedrock: (p) => {
    p.noise([80, 80, 80], 30);
    p.blobs([40, 40, 40], 5, 1);
  },
  coal_ore: (p) => ore(p, [40, 40, 40], [70, 70, 70]),
  iron_ore: (p) => ore(p, [210, 170, 140], [235, 200, 175]),
  gold_ore: (p) => ore(p, [235, 200, 60], [255, 235, 130]),
  diamond_ore: (p) => ore(p, [80, 220, 215], [180, 250, 245]),
  coal_block: (p) => {
    p.noise([32, 32, 34], 8);
    p.blobs([55, 55, 58], 4, 1);
  },
  iron_block: (p) => {
    p.noise([210, 210, 214], 5);
    p.rect(0, 0, TILE, 1, [235, 235, 240]);
    p.rect(0, 0, 1, TILE, [235, 235, 240]);
    p.rect(0, TILE - 1, TILE, 1, [160, 160, 165]);
    p.rect(TILE - 1, 0, 1, TILE, [160, 160, 165]);
  },
  gold_block: (p) => {
    p.noise([240, 205, 60], 8);
    p.rect(0, 0, TILE, 1, [255, 240, 140]);
    p.rect(0, 0, 1, TILE, [255, 240, 140]);
    p.rect(0, TILE - 1, TILE, 1, [180, 140, 30]);
    p.rect(TILE - 1, 0, 1, TILE, [180, 140, 30]);
  },
  diamond_block: (p) => {
    p.noise([95, 225, 220], 8);
    p.rect(0, 0, TILE, 1, [190, 255, 250]);
    p.rect(0, 0, 1, TILE, [190, 255, 250]);
    p.rect(0, TILE - 1, TILE, 1, [50, 150, 150]);
    p.rect(TILE - 1, 0, 1, TILE, [50, 150, 150]);
  },
  cactus_side: (p) => {
    p.noise([70, 128, 50], 8);
    for (let x = 0; x < TILE; x++) if (x % 4 === 1) for (let y = 0; y < TILE; y++) p.shade(x, y, 0.75);
    p.speckle([170, 190, 120], 8);
  },
  cactus_top: (p) => {
    p.noise([80, 140, 58], 8);
    p.rect(2, 2, 12, 12, [95, 155, 70]);
  },
  tall_grass: (p) => {
    p.fill([0, 0, 0, 0]);
    for (let x = 1; x < TILE - 1; x++) {
      if (p.rng() < 0.35) continue;
      const h = 5 + Math.floor(p.rng() * 9);
      const c = mix([74, 140, 44], [120, 180, 70], p.rng());
      for (let y = TILE - h; y < TILE; y++) p.set(x + (y < TILE - h + 2 && p.rng() < 0.4 ? 1 : 0), y, c);
    }
  },
  flower_red: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["......rr........", ".....rRrr.......", ".....rrrr.......", "......rr........", ".......g........", ".......g........", "......gg.g......", ".......gg.......", ".......g........", ".......g........", ".......g........"],
      { r: [200, 30, 30], R: [255, 90, 90], g: [60, 130, 40] },
      0,
      4,
    );
  },
  flower_yellow: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["......yyy.......", ".....yYYyy......", ".....yYyyy......", "......yyy.......", ".......g........", ".......g........", ".....g.g........", "......gg........", ".......g........", ".......g........", ".......g........"],
      { y: [235, 200, 40], Y: [255, 240, 120], g: [60, 130, 40] },
      0,
      4,
    );
  },
  mushroom: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["....bbbbbb......", "...bBbbbbbb.....", "...bbbbBbbb.....", "....bbbbbb......", "......ss........", "......ss........", "......ss........", "......ss........"],
      { b: [150, 95, 60], B: [200, 150, 110], s: [222, 205, 170] },
      1,
      8,
    );
  },
  dead_bush: (p) => {
    p.fill([0, 0, 0, 0]);
    const c: RGB = [120, 90, 50];
    for (let i = 0; i < 6; i++) {
      let x = 7 + Math.floor(p.rng() * 2),
        y = 15;
      const dx = p.rng() < 0.5 ? -1 : 1;
      for (let k = 0; k < 6 + Math.floor(p.rng() * 5); k++) {
        p.set(x, y, c);
        y--;
        if (p.rng() < 0.5) x += dx;
      }
    }
  },
  torch: (p) => {
    p.fill([0, 0, 0, 0]);
    p.rect(7, 6, 2, 10, [150, 118, 70]);
    p.set(7, 8, [120, 92, 50]);
    p.rect(7, 4, 2, 2, [255, 220, 90]);
    p.set(7, 3, [255, 250, 180]);
    p.set(8, 5, [255, 160, 50]);
  },
  crafting_table_top: (p) => {
    planks(p, [174, 138, 84]);
    p.rect(2, 2, 12, 1, [90, 65, 35]);
    p.rect(2, 13, 12, 1, [90, 65, 35]);
    p.rect(2, 2, 1, 12, [90, 65, 35]);
    p.rect(13, 2, 1, 12, [90, 65, 35]);
    p.rect(6, 2, 1, 12, [90, 65, 35]);
    p.rect(9, 2, 1, 12, [90, 65, 35]);
    p.rect(2, 6, 12, 1, [90, 65, 35]);
    p.rect(2, 9, 12, 1, [90, 65, 35]);
  },
  crafting_table_side: (p) => {
    planks(p, [174, 138, 84]);
    p.rect(0, 0, TILE, 2, [110, 80, 45]);
    p.rect(2, 4, 4, 5, [120, 120, 125]);
    p.rect(3, 9, 2, 5, HANDLE);
    p.rect(9, 5, 2, 4, [200, 200, 205]);
    p.rect(10, 9, 1, 5, HANDLE);
  },
  furnace_side: (p) => p.cobble(STONE, 7, 0.6),
  furnace_top: (p) => {
    p.noise(STONE, 9);
    p.blobs(dark(STONE, 0.9), 4, 1);
  },
  bricks: (p) => bricks(p, [156, 78, 62], [180, 170, 165], 4, 8),
  stone_bricks: (p) => bricks(p, [128, 128, 128], [90, 90, 90], 8, 8),
  glowstone: (p) => {
    p.noise([210, 160, 80], 20);
    p.blobs([255, 230, 140], 7, 1, [255, 250, 200]);
    p.blobs([160, 110, 50], 4, 1);
  },
  bookshelf: (p) => {
    planks(p, [174, 138, 84]);
    const cols: RGB[] = [[170, 50, 50], [60, 90, 170], [70, 140, 70], [200, 170, 60], [140, 70, 150], [220, 220, 220]];
    for (let row = 0; row < 2; row++) {
      const y0 = row * 8 + 1;
      p.rect(0, y0 - 1, TILE, 1, [110, 80, 45]);
      let x = 1;
      while (x < TILE - 1) {
        const w = 1 + Math.floor(p.rng() * 2);
        const c = cols[Math.floor(p.rng() * cols.length)];
        const h = 5 + Math.floor(p.rng() * 2);
        p.rect(x, y0 + 6 - h, w, h, c);
        p.set(x, y0 + 6 - h + 1, dark(c, 1.3));
        x += w + (p.rng() < 0.3 ? 1 : 0);
      }
    }
  },
  pumpkin_side: (p) => {
    p.noise([222, 130, 30], 10);
    for (let x = 0; x < TILE; x++) if (x % 5 === 0) for (let y = 0; y < TILE; y++) p.shade(x, y, 0.8);
  },
  pumpkin_top: (p) => {
    p.noise([210, 125, 30], 10);
    p.rect(7, 6, 2, 3, [90, 130, 50]);
    p.rect(6, 5, 1, 2, [90, 130, 50]);
  },
  // ------- items -------
  stick: (p) => {
    p.fill([0, 0, 0, 0]);
    for (let i = 0; i < 11; i++) {
      p.set(3 + i, 13 - i, HANDLE);
      p.set(4 + i, 13 - i, [140, 105, 60]);
    }
  },
  coal: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["....cccc........", "...cCccccc......", "..cCcccccc......", "..cccccccccc....", "..cccccccccc....", "...ccccccccc....", "....cccccccc....", ".....cccccc.....", "......cccc......"],
      { c: [40, 40, 44], C: [80, 80, 86] },
      1,
      3,
    );
  },
  iron_ingot: (p) => ingot(p, [200, 200, 205], [240, 240, 245], [130, 130, 140]),
  gold_ingot: (p) => ingot(p, [235, 200, 50], [255, 240, 130], [170, 130, 20]),
  diamond: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["....dDDDDd......", "...dDDdddDd.....", "..dDdddddddd....", "..dddddddddd....", "...dddddddd.....", "....dddddd......", ".....dddd.......", "......dd........"],
      { d: [80, 220, 215], D: [190, 255, 250] },
      1,
      4,
    );
  },
  apple: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      [".......h........", "......h.gg......", "....rrrrrrr.....", "...rrRrrrrrr....", "...rRRrrrrrrr...", "...rRrrrrrrrr...", "...rrrrrrrrrr...", "...rrrrrrrrrr...", "....rrrrrrrr....", ".....rrr.rrr...."],
      { r: [200, 40, 40], R: [255, 120, 110], h: [90, 60, 30], g: [70, 150, 50] },
      0,
      3,
    );
  },
  clay_ball: (p) => {
    p.fill([0, 0, 0, 0]);
    p.template(
      ["....cccc........", "...cCCccc.......", "..cCccccccc.....", "..cccccccccc....", "..cccccccccc....", "...ccccccccc....", "....cccccccc....", ".....cccccc.....", "......cccc......"],
      { c: [158, 164, 176], C: [200, 205, 215] },
      1,
      3,
    );
  },
  brick: (p) => {
    p.fill([0, 0, 0, 0]);
    p.rect(3, 6, 10, 5, [156, 78, 62]);
    p.rect(3, 6, 10, 1, [190, 110, 90]);
    p.rect(3, 10, 10, 1, [110, 50, 40]);
  },
};

function ingot(p: Painter, c: RGB, hi: RGB, lo: RGB) {
  p.fill([0, 0, 0, 0]);
  p.template(
    ["....mmmmmmmm....", "...mMMMMMMMmm...", "..mMmmmmmmmmm...", ".mMmmmmmmmmmdd..", ".mmmmmmmmmmddd..", ".mmmmmmmmmddd...", ".ddddddddddd....", ".ddddddddd......"],
    { m: c, M: hi, d: lo },
    0,
    4,
  );
}

for (const kind of Object.keys(TOOL_TEMPLATES)) {
  for (let tier = 1; tier <= 5; tier++) {
    painters[`${kind}_${tier}`] = (p) => {
      p.fill([0, 0, 0, 0]);
      const [m, M, d] = TOOL_MATS[tier];
      p.template(TOOL_TEMPLATES[kind], { m, M, d, h: HANDLE }, 0, 2);
    };
  }
}
for (let s = 0; s < 8; s++) {
  painters[`crack_${s}`] = (p) => {
    p.fill([0, 0, 0, 0]);
    const lines = 2 + s * 2;
    for (let i = 0; i < lines; i++) {
      let x = 6 + Math.floor(p.rng() * 4),
        y = 6 + Math.floor(p.rng() * 4);
      const len = 3 + Math.floor(p.rng() * (4 + s));
      const dx = p.rng() < 0.5 ? -1 : 1,
        dy = p.rng() < 0.5 ? -1 : 1;
      for (let k = 0; k < len; k++) {
        p.set(x, y, [20, 20, 20, 150 + s * 10]);
        if (p.rng() < 0.5) x += dx;
        else y += dy;
      }
    }
  };
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  index: Map<string, number>;
  tileUV(name: string): [number, number, number, number]; // u0, v0, u1, v1 (v flipped for three)
  tileOf(index: number): [number, number, number, number];
}

let cached: Atlas | null = null;

export function getAtlas(): Atlas {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * TILE;
  canvas.height = ATLAS_ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  const index = new Map<string, number>();
  let i = 0;
  for (const name of Object.keys(painters)) {
    const p = new Painter(name);
    painters[name](p);
    const img = new ImageData(p.data, TILE, TILE);
    ctx.putImageData(img, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE);
    index.set(name, i);
    i++;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;

  const tileOf = (idx: number): [number, number, number, number] => {
    const tx = idx % ATLAS_COLS,
      ty = Math.floor(idx / ATLAS_COLS);
    const e = 0.001 / ATLAS_COLS;
    return [tx / ATLAS_COLS + e, ty / ATLAS_ROWS + e, (tx + 1) / ATLAS_COLS - e, (ty + 1) / ATLAS_ROWS - e];
  };
  cached = {
    canvas,
    texture,
    index,
    tileOf,
    tileUV: (name) => tileOf(index.get(name) ?? 0),
  };
  return cached;
}
