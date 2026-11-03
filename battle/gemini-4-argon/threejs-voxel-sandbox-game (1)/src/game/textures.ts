import * as THREE from 'three';
import { ATLAS_PX, ATLAS_TILES_PER_ROW, TILE_PX } from './constants';
import { BLOCKS, TILE } from './blocks';
import { ITEMS } from './items';
import { mulberry32 } from './math/noise';
import { BlockId, ItemId } from './types';

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function shadeRgb(c: RGB, factor: number, jitter = 0): RGB {
  return [
    clampByte(c[0] * factor + jitter),
    clampByte(c[1] * factor + jitter),
    clampByte(c[2] * factor + jitter),
  ];
}

export interface GeneratedAtlas {
  data: Uint8Array;
  width: number;
  height: number;
  texture: THREE.DataTexture;
  crackTextures: THREE.DataTexture[];
}

function putTilePixel(
  buf: Uint8Array,
  tileIndex: number,
  px: number,
  py: number,
  color: RGBA
) {
  if (px < 0 || px >= TILE_PX || py < 0 || py >= TILE_PX) return;
  const tx = tileIndex % ATLAS_TILES_PER_ROW;
  const ty = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);
  const x = tx * TILE_PX + px;
  // Flip Y inside tile so py=0 is visual TOP of block face (v=1 in OpenGL or top-down consistent)
  const y = ty * TILE_PX + py;
  const idx = (y * ATLAS_PX + x) * 4;
  buf[idx] = color[0];
  buf[idx + 1] = color[1];
  buf[idx + 2] = color[2];
  buf[idx + 3] = color[3];
}

function getTilePixel(
  buf: Uint8Array,
  tileIndex: number,
  px: number,
  py: number
): RGBA {
  const tx = tileIndex % ATLAS_TILES_PER_ROW;
  const ty = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);
  const x = tx * TILE_PX + Math.max(0, Math.min(TILE_PX - 1, px));
  const y = ty * TILE_PX + Math.max(0, Math.min(TILE_PX - 1, py));
  const idx = (y * ATLAS_PX + x) * 4;
  return [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
}

function fillNoiseTile(
  buf: Uint8Array,
  tile: number,
  baseHex: string,
  variance = 18,
  seed = 101
) {
  const base = hexToRgb(baseHex);
  const rand = mulberry32(seed + tile * 977);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (rand() - 0.5) * 2 * variance;
      const c = shadeRgb(base, 1.0, n);
      putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
    }
  }
}

function paintOreVeins(
  buf: Uint8Array,
  tile: number,
  oreHex: string,
  highlightHex: string,
  seed: number
) {
  fillStoneTile(buf, tile, seed);
  const ore = hexToRgb(oreHex);
  const hi = hexToRgb(highlightHex);
  const clusters = [
    [3, 4],
    [4, 4],
    [4, 5],
    [10, 3],
    [11, 3],
    [11, 4],
    [6, 10],
    [7, 10],
    [7, 11],
    [8, 11],
    [12, 12],
    [13, 12],
    [3, 12],
  ];
  clusters.forEach(([x, y], i) => {
    const c = i % 3 === 0 ? hi : ore;
    putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
  });
}

function fillStoneTile(buf: Uint8Array, tile: number, seed = 303) {
  const base = hexToRgb('#7d8086');
  const rand = mulberry32(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const strata = Math.sin((y + x * 0.25) * 1.3) * 7;
      const n = (rand() - 0.5) * 22 + strata;
      const c = shadeRgb(base, 1.0, n);
      putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
    }
  }
}

function paintPlanksTile(buf: Uint8Array, tile: number, hex: string, seed: number) {
  const base = hexToRgb(hex);
  const rand = mulberry32(seed);
  for (let y = 0; y < 16; y++) {
    const isGroove = y % 4 === 3;
    const verticalJoint =
      (y < 4 && xJoint(8)) ||
      (y >= 4 && y < 8 && xJoint(3)) ||
      (y >= 8 && y < 12 && xJoint(12)) ||
      (y >= 12 && xJoint(6));
    void verticalJoint;
    for (let x = 0; x < 16; x++) {
      const joint =
        (y < 4 && x === 8) ||
        (y >= 4 && y < 8 && x === 3) ||
        (y >= 8 && y < 12 && x === 12) ||
        (y >= 12 && x === 6);
      const factor = isGroove || joint ? 0.74 : 1.0;
      const grain = (rand() - 0.5) * 14 + Math.sin(x * 0.9 + y) * 4;
      const c = shadeRgb(base, factor, grain);
      putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
    }
  }
}

function xJoint(n: number): number {
  return n;
}

function paintLogSide(
  buf: Uint8Array,
  tile: number,
  barkHex: string,
  streakHex: string,
  seed: number
) {
  const bark = hexToRgb(barkHex);
  const streak = hexToRgb(streakHex);
  const rand = mulberry32(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const col = x % 3 === 1 ? streak : bark;
      const c = shadeRgb(col, 1.0, (rand() - 0.5) * 18);
      putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
    }
  }
}

function paintLogTop(
  buf: Uint8Array,
  tile: number,
  barkHex: string,
  innerHex: string
) {
  const bark = hexToRgb(barkHex);
  const inner = hexToRgb(innerHex);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const edge = x <= 1 || x >= 14 || y <= 1 || y >= 14;
      if (edge) {
        putTilePixel(buf, tile, x, y, [bark[0], bark[1], bark[2], 255]);
      } else {
        const d = Math.hypot(x - 7.5, y - 7.5);
        const ring = Math.sin(d * 2.1) * 14;
        const c = shadeRgb(inner, 1.0, ring);
        putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }
}

function paintLeavesTile(buf: Uint8Array, tile: number, hex: string, seed: number) {
  const base = hexToRgb(hex);
  const rand = mulberry32(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const hole = rand() < 0.17 && (x + y) % 2 === 0;
      if (hole) {
        putTilePixel(buf, tile, x, y, [0, 0, 0, 0]);
      } else {
        const c = shadeRgb(base, rand() > 0.5 ? 1.09 : 0.88, (rand() - 0.5) * 16);
        putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }
}

function paintFlowerTile(buf: Uint8Array, tile: number, petalHex: string, centerHex: string) {
  // Transparent clear
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      putTilePixel(buf, tile, x, y, [0, 0, 0, 0]);
    }
  }
  const stem = hexToRgb('#3d8e2e');
  const leaf = hexToRgb('#4fa83b');
  const petal = hexToRgb(petalHex);
  const center = hexToRgb(centerHex);

  for (let y = 7; y < 16; y++) {
    putTilePixel(buf, tile, 7, y, [stem[0], stem[1], stem[2], 255]);
    putTilePixel(buf, tile, 8, y, [stem[0], stem[1], stem[2], 255]);
  }
  // Leaves on stem
  putTilePixel(buf, tile, 5, 12, [leaf[0], leaf[1], leaf[2], 255]);
  putTilePixel(buf, tile, 6, 13, [leaf[0], leaf[1], leaf[2], 255]);
  putTilePixel(buf, tile, 10, 11, [leaf[0], leaf[1], leaf[2], 255]);
  putTilePixel(buf, tile, 9, 12, [leaf[0], leaf[1], leaf[2], 255]);

  // Blossom
  for (let y = 3; y <= 7; y++) {
    for (let x = 5; x <= 10; x++) {
      const dist = Math.hypot(x - 7.5, y - 5);
      if (dist <= 2.9) {
        const isCenter = dist <= 1.1;
        const c = isCenter ? center : petal;
        putTilePixel(buf, tile, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }
}

let cachedAtlas: GeneratedAtlas | null = null;
const iconCache = new Map<string, string>();

export function getAtlas(): GeneratedAtlas {
  if (cachedAtlas) return cachedAtlas;

  const buf = new Uint8Array(ATLAS_PX * ATLAS_PX * 4);

  // Grass Top & Dirt
  fillNoiseTile(buf, TILE.GRASS_TOP, '#5bb33a', 18, 11);
  fillNoiseTile(buf, TILE.DIRT, '#855c3a', 20, 22);

  // Grass Side (Dirt with overhanging lush green grass top!)
  {
    const grass = hexToRgb('#5bb33a');
    const darkGrass = hexToRgb('#438c29');
    const rand = mulberry32(33);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const overhang = 2 + Math.floor(rand() * 3);
        if (y < overhang) {
          const c = shadeRgb(grass, 1.0, (rand() - 0.5) * 18);
          putTilePixel(buf, TILE.GRASS_SIDE, x, y, [c[0], c[1], c[2], 255]);
        } else if (y === overhang) {
          putTilePixel(buf, TILE.GRASS_SIDE, x, y, [
            darkGrass[0],
            darkGrass[1],
            darkGrass[2],
            255,
          ]);
        } else {
          const d = getTilePixel(buf, TILE.DIRT, x, y);
          putTilePixel(buf, TILE.GRASS_SIDE, x, y, d);
        }
      }
    }
  }

  // Stone, Cobblestone, Mossy Cobble, Bedrock
  fillStoneTile(buf, TILE.STONE, 44);

  // Cobblestone cellular stones
  {
    const rand = mulberry32(55);
    const centers = [
      [3, 3],
      [10, 2],
      [14, 6],
      [5, 8],
      [11, 10],
      [2, 13],
      [8, 14],
      [14, 14],
    ];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let d1 = 999;
        let d2 = 999;
        for (const [cx, cy] of centers) {
          const dx = Math.min(Math.abs(x - cx), 16 - Math.abs(x - cx));
          const dy = Math.min(Math.abs(y - cy), 16 - Math.abs(y - cy));
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) {
            d2 = d;
          }
        }
        const mortar = d2 - d1 < 0.85;
        const base = mortar ? hexToRgb('#4c4f54') : hexToRgb('#84888e');
        const c = shadeRgb(base, 1.0, (rand() - 0.5) * 18);
        putTilePixel(buf, TILE.COBBLESTONE, x, y, [c[0], c[1], c[2], 255]);
        const mossBase = mortar ? hexToRgb('#3d7a35') : base;
        const mc = shadeRgb(mossBase, 1.0, (rand() - 0.5) * 16);
        putTilePixel(buf, TILE.MOSSY_COBBLE, x, y, [mc[0], mc[1], mc[2], 255]);
      }
    }
  }

  fillNoiseTile(buf, TILE.BEDROCK, '#2c2e33', 34, 66);
  fillNoiseTile(buf, TILE.SAND, '#e4d69b', 14, 77);
  fillNoiseTile(buf, TILE.SANDSTONE_TOP, '#dfd094', 10, 88);
  // Sandstone layered side
  {
    const rand = mulberry32(99);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const band = y < 3 ? '#eadba4' : y % 5 === 0 ? '#c3b072' : '#dfd094';
        const c = shadeRgb(hexToRgb(band), 1.0, (rand() - 0.5) * 10);
        putTilePixel(buf, TILE.SANDSTONE_SIDE, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }

  fillNoiseTile(buf, TILE.GRAVEL, '#8b8582', 26, 110);
  fillNoiseTile(buf, TILE.CLAY, '#9fa8b8', 12, 120);
  fillNoiseTile(buf, TILE.SNOW, '#f5fbff', 8, 130);

  // Snowy Grass Side
  {
    const snow = hexToRgb('#f5fbff');
    const rand = mulberry32(135);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const overhang = 3 + Math.floor(rand() * 2);
        if (y <= overhang) {
          const c = shadeRgb(snow, y === overhang ? 0.86 : 1.0, 0);
          putTilePixel(buf, TILE.SNOW_SIDE, x, y, [c[0], c[1], c[2], 255]);
        } else {
          putTilePixel(buf, TILE.SNOW_SIDE, x, y, getTilePixel(buf, TILE.DIRT, x, y));
        }
      }
    }
  }

  // Translucent Ice & Water
  {
    const ice = hexToRgb('#95d2ff');
    const streak = hexToRgb('#d7f1ff');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const diag = (x + y) % 7 === 0 || (x + y) % 11 === 0;
        const c = diag ? streak : ice;
        putTilePixel(buf, TILE.ICE, x, y, [c[0], c[1], c[2], 205]);
      }
    }

    const w1 = hexToRgb('#247de6');
    const w2 = hexToRgb('#47a3ff');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin(x * 0.8 + y * 0.5) > 0.35;
        const c = wave ? w2 : w1;
        putTilePixel(buf, TILE.WATER, x, y, [c[0], c[1], c[2], 182]);
      }
    }
  }

  // Woods & Leaves
  paintLogSide(buf, TILE.OAK_LOG_SIDE, '#6c5031', '#533c23', 201);
  paintLogTop(buf, TILE.OAK_LOG_TOP, '#6c5031', '#ba9662');
  paintLeavesTile(buf, TILE.OAK_LEAVES, '#3f962b', 202);

  paintLogSide(buf, TILE.BIRCH_LOG_SIDE, '#e6e3dc', '#3a3937', 203);
  paintLogTop(buf, TILE.BIRCH_LOG_TOP, '#d8d4cc', '#d4c598');
  paintLeavesTile(buf, TILE.BIRCH_LEAVES, '#69a83e', 204);

  paintLogSide(buf, TILE.SPRUCE_LOG_SIDE, '#46321f', '#322214', 205);
  paintLogTop(buf, TILE.SPRUCE_LOG_TOP, '#46321f', '#896640');
  paintLeavesTile(buf, TILE.SPRUCE_LEAVES, '#2c6440', 206);

  // Cactus
  {
    const green = hexToRgb('#358a29');
    const rib = hexToRgb('#25691d');
    const spine = hexToRgb('#e5e3b8');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isSpine = (x === 3 || x === 12) && y % 5 === 2;
        const c = isSpine ? spine : x % 4 === 0 ? rib : green;
        putTilePixel(buf, TILE.CACTUS_SIDE, x, y, [c[0], c[1], c[2], 255]);
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const tc = d > 5.5 ? rib : green;
        putTilePixel(buf, TILE.CACTUS_TOP, x, y, [tc[0], tc[1], tc[2], 255]);
      }
    }
  }

  // Ores
  paintOreVeins(buf, TILE.COAL_ORE, '#1f2124', '#383b40', 301);
  paintOreVeins(buf, TILE.IRON_ORE, '#d5a384', '#f2cfb8', 302);
  paintOreVeins(buf, TILE.GOLD_ORE, '#f5c731', '#fff28c', 303);
  paintOreVeins(buf, TILE.DIAMOND_ORE, '#34e6de', '#b5ffff', 304);
  paintOreVeins(buf, TILE.EMERALD_ORE, '#22d864', '#9effbe', 305);

  // Glowstone Crystal
  {
    const rand = mulberry32(310);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x % 8) - 3.5, (y % 8) - 3.5);
        const hex = d < 2.1 ? '#fff7b2' : d < 3.4 ? '#ffca4b' : '#b87624';
        const c = shadeRgb(hexToRgb(hex), 1.0, (rand() - 0.5) * 16);
        putTilePixel(buf, TILE.GLOWSTONE, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }

  // Planks
  paintPlanksTile(buf, TILE.OAK_PLANKS, '#b88f58', 401);
  paintPlanksTile(buf, TILE.BIRCH_PLANKS, '#d8c996', 402);
  paintPlanksTile(buf, TILE.SPRUCE_PLANKS, '#785737', 403);

  // Crafting Table
  {
    paintPlanksTile(buf, TILE.CRAFT_TOP, '#ab7d46', 410);
    const border = hexToRgb('#5e4022');
    const grid = hexToRgb('#78522b');
    for (let y = 2; y < 14; y++) {
      for (let x = 2; x < 14; x++) {
        if (x === 2 || x === 13 || y === 2 || y === 13) {
          putTilePixel(buf, TILE.CRAFT_TOP, x, y, [border[0], border[1], border[2], 255]);
        } else if (x === 6 || x === 9 || y === 6 || y === 9) {
          putTilePixel(buf, TILE.CRAFT_TOP, x, y, [grid[0], grid[1], grid[2], 255]);
        }
      }
    }
    paintPlanksTile(buf, TILE.CRAFT_FRONT, '#a87d49', 411);
    paintPlanksTile(buf, TILE.CRAFT_SIDE, '#a87d49', 412);
    const iron = hexToRgb('#cfd5dd');
    const handle = hexToRgb('#593b1d');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y < 3) {
          putTilePixel(buf, TILE.CRAFT_FRONT, x, y, [handle[0], handle[1], handle[2], 255]);
          putTilePixel(buf, TILE.CRAFT_SIDE, x, y, [handle[0], handle[1], handle[2], 255]);
        }
        // Saw & hammer silhouette on front
        if (x >= 5 && x <= 7 && y >= 5 && y <= 11) {
          putTilePixel(buf, TILE.CRAFT_FRONT, x, y, [iron[0], iron[1], iron[2], 255]);
        }
        if (x === 11 && y >= 6 && y <= 12) {
          putTilePixel(buf, TILE.CRAFT_SIDE, x, y, [handle[0], handle[1], handle[2], 255]);
        }
      }
    }
  }

  // Furnace
  {
    fillStoneTile(buf, TILE.FURNACE_TOP, 420);
    fillStoneTile(buf, TILE.FURNACE_SIDE, 421);
    fillStoneTile(buf, TILE.FURNACE_FRONT, 422);
    const dark = hexToRgb('#202226');
    const ember = hexToRgb('#ff8c29');
    const rim = hexToRgb('#55585e');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          putTilePixel(buf, TILE.FURNACE_FRONT, x, y, [rim[0], rim[1], rim[2], 255]);
          putTilePixel(buf, TILE.FURNACE_SIDE, x, y, [rim[0], rim[1], rim[2], 255]);
        }
        if (x >= 4 && x <= 11 && y >= 4 && y <= 8) {
          putTilePixel(buf, TILE.FURNACE_FRONT, x, y, [dark[0], dark[1], dark[2], 255]);
        }
        if (x >= 4 && x <= 11 && y >= 11 && y <= 14) {
          const c = y === 13 && x % 2 === 0 ? ember : dark;
          putTilePixel(buf, TILE.FURNACE_FRONT, x, y, [c[0], c[1], c[2], 255]);
        }
      }
    }
  }

  // Glass (crisp pixel border + specular diagonal glint)
  {
    const frame = hexToRgb('#d8f3ff');
    const glint = hexToRgb('#ffffff');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || x === 15 || y === 0 || y === 15;
        const streak =
          (x + y === 6 && x >= 2 && x <= 5) || (x + y === 19 && x >= 9 && x <= 12);
        if (edge) {
          putTilePixel(buf, TILE.GLASS, x, y, [frame[0], frame[1], frame[2], 255]);
        } else if (streak) {
          putTilePixel(buf, TILE.GLASS, x, y, [glint[0], glint[1], glint[2], 255]);
        } else {
          putTilePixel(buf, TILE.GLASS, x, y, [0, 0, 0, 0]);
        }
      }
    }
  }

  // Bricks
  {
    const brick = hexToRgb('#ad4c3e');
    const mortar = hexToRgb('#c8c1b8');
    const rand = mulberry32(430);
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      const isMortarY = y % 4 === 3;
      for (let x = 0; x < 16; x++) {
        const isMortarX = (x + (row % 2) * 4) % 8 === 7;
        if (isMortarY || isMortarX) {
          putTilePixel(buf, TILE.BRICKS, x, y, [mortar[0], mortar[1], mortar[2], 255]);
        } else {
          const c = shadeRgb(brick, 1.0, (rand() - 0.5) * 20);
          putTilePixel(buf, TILE.BRICKS, x, y, [c[0], c[1], c[2], 255]);
        }
      }
    }
  }

  // Bookshelf
  {
    paintPlanksTile(buf, TILE.BOOKSHELF, '#a87f4c', 440);
    const colors = ['#b63b34', '#2e6eb5', '#348c46', '#c99c2c', '#7c3eb3'].map(hexToRgb);
    for (const shelfY of [2, 9]) {
      for (let y = shelfY; y < shelfY + 5; y++) {
        for (let x = 1; x < 15; x++) {
          const bookIdx = Math.floor(x / 3) % colors.length;
          const spineEdge = x % 3 === 0;
          const c = shadeRgb(colors[bookIdx], spineEdge ? 0.72 : 1.0, 0);
          putTilePixel(buf, TILE.BOOKSHELF, x, y, [c[0], c[1], c[2], 255]);
        }
      }
    }
  }

  // TNT
  {
    const red = hexToRgb('#d9382b');
    const darkRed = hexToRgb('#ad271c');
    const white = hexToRgb('#f3f1eb');
    const ink = hexToRgb('#222222');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y >= 5 && y <= 10) {
          const textPx =
            y >= 6 &&
            y <= 9 &&
            (x === 3 || x === 7 || x === 12 || (y === 6 && (x === 2 || x === 4 || x === 11 || x === 13)));
          const c = textPx ? ink : white;
          putTilePixel(buf, TILE.TNT_SIDE, x, y, [c[0], c[1], c[2], 255]);
        } else {
          const c = x % 4 === 0 ? darkRed : red;
          putTilePixel(buf, TILE.TNT_SIDE, x, y, [c[0], c[1], c[2], 255]);
        }
        const fuse = Math.hypot(x - 7.5, y - 7.5) < 2.2;
        const topC = fuse ? ink : (x + y) % 2 === 0 ? red : darkRed;
        putTilePixel(buf, TILE.TNT_TOP, x, y, [topC[0], topC[1], topC[2], 255]);
        putTilePixel(buf, TILE.TNT_BOTTOM, x, y, [darkRed[0], darkRed[1], darkRed[2], 255]);
      }
    }
  }

  // Torch
  {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        putTilePixel(buf, TILE.TORCH, x, y, [0, 0, 0, 0]);
      }
    }
    const stick = hexToRgb('#8a6236');
    const ember = hexToRgb('#ff8a1f');
    const core = hexToRgb('#fff7ad');
    for (let y = 5; y < 16; y++) {
      putTilePixel(buf, TILE.TORCH, 7, y, [stick[0], stick[1], stick[2], 255]);
      putTilePixel(buf, TILE.TORCH, 8, y, [stick[0], stick[1], stick[2], 255]);
    }
    for (let y = 2; y <= 5; y++) {
      for (let x = 6; x <= 9; x++) {
        const isCore = (x === 7 || x === 8) && (y === 3 || y === 4);
        const c = isCore ? core : ember;
        putTilePixel(buf, TILE.TORCH, x, y, [c[0], c[1], c[2], 255]);
      }
    }
  }

  // Tall Grass, Flowers, Dead Bush
  {
    const rand = mulberry32(460);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        putTilePixel(buf, TILE.TALL_GRASS, x, y, [0, 0, 0, 0]);
        putTilePixel(buf, TILE.DEAD_BUSH, x, y, [0, 0, 0, 0]);
      }
    }
    const g1 = hexToRgb('#52ab36');
    const g2 = hexToRgb('#3d8a27');
    for (let blade = 1; blade < 15; blade += 2) {
      const topY = 3 + Math.floor(rand() * 6);
      for (let y = topY; y < 16; y++) {
        const swayX = Math.max(0, Math.min(15, blade + (y < 9 ? (blade % 4 === 1 ? -1 : 1) : 0)));
        const c = y < 8 ? g1 : g2;
        putTilePixel(buf, TILE.TALL_GRASS, swayX, y, [c[0], c[1], c[2], 255]);
      }
    }

    const dry = hexToRgb('#8f6d43');
    for (let y = 6; y < 16; y++) {
      putTilePixel(buf, TILE.DEAD_BUSH, 7, y, [dry[0], dry[1], dry[2], 255]);
      if (y < 13) {
        putTilePixel(buf, TILE.DEAD_BUSH, Math.max(1, 7 - (13 - y)), y, [
          dry[0],
          dry[1],
          dry[2],
          255,
        ]);
        putTilePixel(buf, TILE.DEAD_BUSH, Math.min(14, 8 + (13 - y)), y, [
          dry[0],
          dry[1],
          dry[2],
          255,
        ]);
      }
    }
  }

  paintFlowerTile(buf, TILE.RED_FLOWER, '#e5352c', '#ffd633');
  paintFlowerTile(buf, TILE.YELLOW_FLOWER, '#ffda29', '#ff9900');
  paintFlowerTile(buf, TILE.BLUE_FLOWER, '#3ba6ff', '#d6f4ff');

  // Chest
  {
    paintPlanksTile(buf, TILE.CHEST_TOP, '#b37d3b', 470);
    paintPlanksTile(buf, TILE.CHEST_SIDE, '#b37d3b', 471);
    paintPlanksTile(buf, TILE.CHEST_FRONT, '#b37d3b', 472);
    const trim = hexToRgb('#593b1a');
    const latch = hexToRgb('#e5e7eb');
    for (let i = 0; i < 16; i++) {
      for (const t of [TILE.CHEST_TOP, TILE.CHEST_SIDE, TILE.CHEST_FRONT]) {
        putTilePixel(buf, t, i, 0, [trim[0], trim[1], trim[2], 255]);
        putTilePixel(buf, t, i, 15, [trim[0], trim[1], trim[2], 255]);
        putTilePixel(buf, t, 0, i, [trim[0], trim[1], trim[2], 255]);
        putTilePixel(buf, t, 15, i, [trim[0], trim[1], trim[2], 255]);
      }
      putTilePixel(buf, TILE.CHEST_SIDE, i, 5, [trim[0], trim[1], trim[2], 255]);
      putTilePixel(buf, TILE.CHEST_FRONT, i, 5, [trim[0], trim[1], trim[2], 255]);
    }
    for (let y = 4; y <= 7; y++) {
      putTilePixel(buf, TILE.CHEST_FRONT, 7, y, [latch[0], latch[1], latch[2], 255]);
      putTilePixel(buf, TILE.CHEST_FRONT, 8, y, [latch[0], latch[1], latch[2], 255]);
    }
  }

  const texture = new THREE.DataTexture(buf, ATLAS_PX, ATLAS_PX, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;

  // Build 10 progressive mining crack textures (16x16 DataTextures)
  const crackTextures: THREE.DataTexture[] = [];
  for (let stage = 0; stage < 10; stage++) {
    const cBuf = new Uint8Array(16 * 16 * 4);
    const radius = 1.8 + stage * 1.15;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const branch =
          Math.abs(Math.sin(angle * 3.0 + dist * 0.45)) < 0.24 ||
          Math.abs(Math.cos(angle * 5.0 - dist * 0.35)) < 0.16;
        if (dist <= radius && branch) {
          const i = (y * 16 + x) * 4;
          cBuf[i] = 15;
          cBuf[i + 1] = 16;
          cBuf[i + 2] = 18;
          cBuf[i + 3] = 200;
        }
      }
    }
    const ct = new THREE.DataTexture(cBuf, 16, 16, THREE.RGBAFormat);
    ct.magFilter = THREE.NearestFilter;
    ct.minFilter = THREE.NearestFilter;
    ct.needsUpdate = true;
    crackTextures.push(ct);
  }

  cachedAtlas = {
    data: buf,
    width: ATLAS_PX,
    height: ATLAS_PX,
    texture,
    crackTextures,
  };
  return cachedAtlas;
}

export function getTileUVRect(tileIndex: number): [number, number, number, number] {
  const tx = tileIndex % ATLAS_TILES_PER_ROW;
  const ty = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);
  const pad = 0.0012;
  const u0 = tx / ATLAS_TILES_PER_ROW + pad;
  const u1 = (tx + 1) / ATLAS_TILES_PER_ROW - pad;
  const v0 = ty / ATLAS_TILES_PER_ROW + pad;
  const v1 = (ty + 1) / ATLAS_TILES_PER_ROW - pad;
  return [u0, v0, u1, v1];
}

// Crisp HUD/Inventory 32x32 Canvas DataURL generator (isometric 3D blocks + pixel-art tools/items!)
export function getItemIconUrl(itemId: ItemId): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const atlas = getAtlas();
  const item = ITEMS[itemId];
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx || !item) return '';
  ctx.imageSmoothingEnabled = false;

  if (item.blockId !== undefined) {
    const block = BLOCKS[item.blockId];
    if (block.shape === 'cross' || block.shape === 'torch' || item.blockId === BlockId.Glass) {
      // Draw flat crisp 2x scaled 16x16 sprite
      const tile = block.faces[0];
      const img = ctx.createImageData(16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const p = getTilePixel(atlas.data, tile, x, y);
          const idx = (y * 16 + x) * 4;
          img.data[idx] = p[0];
          img.data[idx + 1] = p[1];
          img.data[idx + 2] = p[2];
          img.data[idx + 3] = p[3];
        }
      }
      const off = document.createElement('canvas');
      off.width = 16;
      off.height = 16;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.drawImage(off, 2, 2, 28, 28);
    } else {
      // Draw authentic shaded 3D isometric voxel block!
      const topTile = block.faces[0];
      const leftTile = block.faces[2]; // north/front face
      const rightTile = block.faces[4]; // east/side face

      const makeFaceCanvas = (tile: number, brightness: number) => {
        const fc = document.createElement('canvas');
        fc.width = 16;
        fc.height = 16;
        const fctx = fc.getContext('2d')!;
        const img = fctx.createImageData(16, 16);
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const p = getTilePixel(atlas.data, tile, x, y);
            const idx = (y * 16 + x) * 4;
            img.data[idx] = clampByte(p[0] * brightness);
            img.data[idx + 1] = clampByte(p[1] * brightness);
            img.data[idx + 2] = clampByte(p[2] * brightness);
            img.data[idx + 3] = p[3] === 0 ? 0 : 255;
          }
        }
        fctx.putImageData(img, 0, 0);
        return fc;
      };

      const topC = makeFaceCanvas(topTile, 1.05);
      const leftC = makeFaceCanvas(leftTile, 0.82);
      const rightC = makeFaceCanvas(rightTile, 0.62);

      // Top diamond
      ctx.save();
      ctx.transform(0.8, 0.4, -0.8, 0.4, 16, 3.2);
      ctx.drawImage(topC, 0, 0, 16, 16);
      ctx.restore();

      // Left face
      ctx.save();
      ctx.transform(0.8, 0.4, 0, 0.9, 3.2, 9.6);
      ctx.drawImage(leftC, 0, 0, 16, 16);
      ctx.restore();

      // Right face
      ctx.save();
      ctx.transform(0.8, -0.4, 0, 0.9, 16, 16);
      ctx.drawImage(rightC, 0, 0, 16, 16);
      ctx.restore();
    }
  } else {
    // Draw crisp 16x16 pixel-art tool/weapon/ingot/food scaled to 32x32
    const off = document.createElement('canvas');
    off.width = 16;
    off.height = 16;
    const octx = off.getContext('2d')!;
    const px = (x: number, y: number, color: string) => {
      octx.fillStyle = color;
      octx.fillRect(x, y, 1, 1);
    };
    const shaft = item.secondaryColor ?? '#7c5832';
    const head = item.accentColor;

    if (item.toolCategory === 'pickaxe') {
      for (let i = 2; i <= 12; i++) px(i, 15 - i, shaft);
      for (let x = 5; x <= 13; x++) {
        px(x, 2, head);
        px(x, 3, head);
      }
      px(13, 4, head);
      px(14, 5, head);
      px(14, 6, head);
      px(12, 4, head);
      px(4, 3, head);
      px(3, 4, head);
    } else if (item.toolCategory === 'axe') {
      for (let i = 2; i <= 13; i++) px(i, 15 - i, shaft);
      for (let y = 2; y <= 7; y++) {
        for (let x = 8; x <= 13; x++) {
          if (x + y <= 18) px(x, y, head);
        }
      }
    } else if (item.toolCategory === 'shovel') {
      for (let i = 2; i <= 11; i++) px(i, 15 - i, shaft);
      for (let y = 2; y <= 6; y++) {
        for (let x = 9; x <= 14; x++) {
          if (Math.hypot(x - 11.5, y - 4) <= 2.7) px(x, y, head);
        }
      }
    } else if (item.toolCategory === 'sword') {
      px(2, 13, shaft);
      px(3, 12, shaft);
      px(4, 11, shaft);
      // Crossguard
      for (let d = -2; d <= 2; d++) px(5 + d, 10 + d, '#684c2a');
      // Blade
      for (let i = 0; i <= 8; i++) {
        px(6 + i, 9 - i, head);
        px(6 + i, 8 - i, '#ffffff88');
        px(7 + i, 9 - i, head);
      }
    } else if (itemId === 'stick') {
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, '#9c7344');
        px(i, 14 - i, '#75522c');
      }
    } else if (itemId === 'iron_ingot' || itemId === 'gold_ingot' || itemId === 'brick_item') {
      for (let y = 5; y <= 10; y++) {
        for (let x = 2 + (y - 5) * 0.4; x <= 13 - (10 - y) * 0.4; x++) {
          px(Math.round(x), y, y <= 6 ? '#ffffffaa' : head);
          if (y > 6) px(Math.round(x), y, head);
        }
      }
      octx.fillStyle = head;
      octx.fillRect(3, 6, 10, 5);
      octx.fillStyle = 'rgba(255,255,255,0.45)';
      octx.fillRect(4, 6, 8, 2);
    } else {
      // Gem / Coal / Apple / Food round sprite with specular highlight
      for (let y = 3; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          const d = Math.hypot(x - 7.5, y - 8);
          if (d <= 4.6) {
            px(x, y, d < 2.2 && x < 8 && y < 8 ? '#ffffffaa' : head);
            if (d >= 2.2) px(x, y, head);
          }
        }
      }
      if (itemId === 'apple') {
        px(8, 2, '#4a8f29');
        px(9, 3, '#4a8f29');
      }
    }

    ctx.drawImage(off, 2, 2, 28, 28);
  }

  const url = canvas.toDataURL();
  iconCache.set(itemId, url);
  return url;
}
