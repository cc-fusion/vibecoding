import * as THREE from 'three';
import { REGISTRY, BLOCK_IDS } from '../data/blocks.js';
import { MESH_SHAPE } from '../constants.js';
import { createMulberry32 } from '../math/noise.js';

const TILE_SIZE = 16;
const PAD = 8;
const SLOT_SIZE = TILE_SIZE + PAD * 2; // 32px
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8; // 64 tile capacity

function hexToRgb(hex) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function shadeHex(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${clampByte(r * factor)},${clampByte(g * factor)},${clampByte(b * factor)})`;
}

// Helper for 16x16 pixel buffer painting
class PixelPainter {
  constructor(seed = 101) {
    this.rng = createMulberry32(seed);
    this.pixels = new Uint8ClampedArray(16 * 16 * 4);
  }

  clear() {
    this.pixels.fill(0);
  }

  set(x, y, hex, alpha = 255, jitter = 0) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    let [r, g, b] = hexToRgb(hex);
    if (jitter > 0) {
      const d = (this.rng() * 2 - 1) * jitter;
      r = clampByte(r + d);
      g = clampByte(g + d);
      b = clampByte(b + d);
    }
    const idx = (y * 16 + x) * 4;
    this.pixels[idx] = r;
    this.pixels[idx + 1] = g;
    this.pixels[idx + 2] = b;
    this.pixels[idx + 3] = alpha;
  }

  fill(hex, jitter = 10, alpha = 255) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        this.set(x, y, hex, alpha, jitter);
      }
    }
  }

  rect(x0, y0, w, h, hex, jitter = 0, alpha = 255) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.set(x, y, hex, alpha, jitter);
      }
    }
  }

  speckle(count, hex, jitter = 8, alpha = 255) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(this.rng() * 16);
      const y = Math.floor(this.rng() * 16);
      this.set(x, y, hex, alpha, jitter);
    }
  }
}

const TILE_NAMES = [
  'grass_top', 'dirt', 'grass_side', 'stone', 'cobblestone', 'bedrock', 'sand', 'sandstone_top',
  'sandstone_bottom', 'sandstone_side', 'gravel', 'clay', 'snow', 'snow_side', 'ice', 'water',
  'lava', 'oak_log_top', 'oak_log', 'oak_leaves', 'oak_planks', 'birch_log_top', 'birch_log', 'birch_leaves',
  'birch_planks', 'spruce_log_top', 'spruce_log', 'spruce_leaves', 'spruce_planks', 'coal_ore', 'iron_ore', 'gold_ore',
  'diamond_ore', 'glowstone', 'crafting_top', 'crafting_side', 'furnace_top', 'furnace_side', 'furnace_front', 'furnace_front_lit',
  'chest_top', 'chest_side', 'chest_front', 'torch', 'glass', 'bricks', 'stone_bricks', 'mossy_cobble',
  'wool', 'bookshelf', 'bed_top', 'bed_side', 'ladder', 'cactus_top', 'cactus_side', 'tall_grass',
  'red_flower', 'yellow_flower', 'berry_bush', 'mushroom', 'dead_bush', 'reeds',
];

function paintTile(name, index) {
  const p = new PixelPainter(7001 + index * 97);
  p.clear();

  const drawPlanks = (base, dark, light) => {
    p.fill(base, 9);
    for (let row = 0; row < 4; row++) {
      const yLine = row * 4 + 3;
      p.rect(0, yLine, 16, 1, dark, 4);
      p.rect(0, row * 4, 16, 1, light, 5);
      const seamX = (row * 7 + 4) % 16;
      p.rect(seamX, row * 4, 1, 4, dark, 3);
    }
  };

  const drawStoneBase = () => {
    p.fill(0x82868b, 12);
    for (let y = 0; y < 16; y += 2) {
      const xOff = (y * 3) % 7;
      p.rect(xOff, y, 5, 1, 0x73777c, 6);
      p.rect((xOff + 8) % 14, y + 1, 4, 1, 0x91959b, 6);
    }
  };

  const drawOreClusters = (oreMain, oreBright, oreDark) => {
    drawStoneBase();
    const spots = [
      [3, 3], [4, 3], [3, 4],
      [10, 4], [11, 4], [11, 5],
      [6, 9], [7, 9], [6, 10], [7, 10],
      [11, 12], [12, 12], [3, 12],
    ];
    for (const [x, y] of spots) {
      p.set(x, y, oreMain, 255, 6);
    }
    p.set(3, 3, oreBright);
    p.set(6, 9, oreBright);
    p.set(11, 4, oreBright);
    p.set(7, 10, oreDark);
    p.set(12, 12, oreDark);
  };

  const drawLeaves = (base, highlight, deep) => {
    p.fill(base, 14);
    p.speckle(48, highlight, 8);
    p.speckle(40, deep, 8);
    // Crisp cutout pinholes for lush depth
    const holes = [[2, 3], [7, 1], [13, 4], [4, 9], [10, 8], [14, 12], [6, 14], [1, 13]];
    for (const [hx, hy] of holes) {
      p.set(hx, hy, 0x000000, 0);
    }
  };

  const drawLogTop = (bark, inner, ring) => {
    p.fill(bark, 8);
    p.rect(2, 2, 12, 12, inner, 6);
    for (let i = 3; i <= 12; i++) {
      p.set(i, 3, ring); p.set(i, 12, ring);
      p.set(3, i, ring); p.set(12, i, ring);
    }
    for (let i = 5; i <= 10; i++) {
      p.set(i, 5, ring); p.set(i, 10, ring);
      p.set(5, i, ring); p.set(10, i, ring);
    }
    p.rect(7, 7, 2, 2, ring, 4);
  };

  switch (name) {
    case 'grass_top':
      p.fill(0x5ca842, 13);
      p.speckle(35, 0x6ec14e, 8);
      p.speckle(28, 0x4b8f35, 8);
      break;

    case 'dirt':
      p.fill(0x7c563a, 14);
      p.speckle(30, 0x65442d, 8);
      p.speckle(18, 0x936a4a, 6);
      p.speckle(8, 0x8d8d8d, 5);
      break;

    case 'grass_side':
      p.fill(0x7c563a, 14);
      p.speckle(26, 0x65442d, 8);
      for (let x = 0; x < 16; x++) {
        const overhang = 3 + ((x * 7 + (x % 3) * 2) % 3);
        for (let y = 0; y < overhang; y++) {
          p.set(x, y, y === overhang - 1 ? 0x488a32 : 0x5ca842, 255, 10);
        }
      }
      break;

    case 'stone':
      drawStoneBase();
      break;

    case 'cobblestone':
      p.fill(0x63676b, 10);
      for (let y = 0; y < 16; y += 4) {
        const shift = (y % 8 === 0) ? 0 : 2;
        for (let x = 0; x < 16; x += 4) {
          const bx = (x + shift) % 16;
          p.rect(bx, y, 3, 3, 0x82868b, 12);
          p.set(bx, y, 0x9aa0a6, 255, 5);
          p.set((bx + 3) % 16, y + 3, 0x484b4f, 255, 4);
        }
      }
      break;

    case 'mossy_cobble':
      p.fill(0x5d675c, 10);
      for (let y = 0; y < 16; y += 4) {
        const shift = (y % 8 === 0) ? 0 : 2;
        for (let x = 0; x < 16; x += 4) {
          const bx = (x + shift) % 16;
          p.rect(bx, y, 3, 3, 0x7b8084, 10);
        }
      }
      p.speckle(48, 0x4e8a3c, 12);
      p.speckle(20, 0x67ab4f, 8);
      break;

    case 'bedrock':
      p.fill(0x2d2f33, 18);
      p.speckle(55, 0x18191c, 6);
      p.speckle(35, 0x4d5057, 8);
      break;

    case 'sand':
      p.fill(0xe2d39b, 10);
      for (let y = 1; y < 16; y += 3) {
        p.rect((y * 2) % 6, y, 9, 1, 0xebdcae, 6);
      }
      p.speckle(24, 0xcfbe84, 6);
      break;

    case 'sandstone_top':
      p.fill(0xdfd098, 8);
      p.rect(1, 1, 14, 14, 0xe8daaa, 6);
      break;

    case 'sandstone_bottom':
      p.fill(0xcab980, 10);
      break;

    case 'sandstone_side':
      p.fill(0xdcc98e, 8);
      p.rect(0, 0, 16, 3, 0xe9dcac, 5);
      p.rect(0, 3, 16, 1, 0xbfa96d, 4);
      p.rect(0, 9, 16, 1, 0xc7b277, 4);
      break;

    case 'gravel':
      p.fill(0x85807e, 18);
      p.speckle(40, 0x696462, 10);
      p.speckle(35, 0x9e9895, 10);
      break;

    case 'clay':
      p.fill(0x9ea6b5, 10);
      p.speckle(30, 0xadb6c6, 6);
      p.speckle(25, 0x8991a0, 6);
      break;

    case 'snow':
      p.fill(0xf2f8fc, 6);
      p.speckle(28, 0xdcebf5, 5);
      break;

    case 'snow_side':
      p.fill(0x7c563a, 14);
      for (let x = 0; x < 16; x++) {
        const h = 3 + ((x * 5 + 1) % 3);
        for (let y = 0; y < h; y++) {
          p.set(x, y, y === h - 1 ? 0xd5e6f2 : 0xf4f9fd, 255, 5);
        }
      }
      break;

    case 'ice':
      p.fill(0x8ec8f6, 8, 210);
      for (let i = 0; i < 16; i++) {
        p.set(i, (i * 2) % 16, 0xbfe3ff, 230, 4);
        p.set((i + 5) % 16, i, 0x72b2e8, 210, 4);
      }
      break;

    case 'water':
      p.fill(0x2878d8, 10, 182);
      for (let y = 0; y < 16; y += 4) {
        p.rect((y * 3) % 7, y, 7, 1, 0x5aa6f8, 6, 195);
      }
      break;

    case 'lava':
      p.fill(0xe45314, 16, 255);
      p.speckle(45, 0xff9b24, 14);
      p.speckle(22, 0xffdf59, 10);
      p.speckle(20, 0xb52d0b, 8);
      break;

    case 'oak_log_top':
      drawLogTop(0x63482b, 0xb5915b, 0x8f6e3f);
      break;

    case 'oak_log':
      p.fill(0x6b4e2e, 10);
      for (let x = 0; x < 16; x += 3) {
        p.rect(x, 0, 1, 16, 0x513a20, 8);
        p.rect(x + 1, 0, 1, 16, 0x7b5b38, 8);
      }
      break;

    case 'oak_leaves':
      drawLeaves(0x438a2f, 0x5cad41, 0x2d641e);
      break;

    case 'oak_planks':
      drawPlanks(0xac854f, 0x7e5e33, 0xc29a62);
      break;

    case 'birch_log_top':
      drawLogTop(0xd8d3c8, 0xcab98b, 0xa89668);
      break;

    case 'birch_log':
      p.fill(0xe3dfd6, 8);
      p.rect(2, 3, 4, 1, 0x3b3834, 4);
      p.rect(10, 6, 5, 1, 0x3b3834, 4);
      p.rect(1, 11, 3, 2, 0x45423d, 4);
      p.rect(9, 13, 4, 1, 0x3b3834, 4);
      p.speckle(16, 0xc7c2b6, 5);
      break;

    case 'birch_leaves':
      drawLeaves(0x66a33e, 0x82bf54, 0x497b28);
      break;

    case 'birch_planks':
      drawPlanks(0xcfbd8e, 0xa69365, 0xe0d0a4);
      break;

    case 'spruce_log_top':
      drawLogTop(0x3f2b1b, 0x7c5c3b, 0x5c4127);
      break;

    case 'spruce_log':
      p.fill(0x442f1d, 9);
      for (let x = 0; x < 16; x += 2) {
        p.rect(x, 0, 1, 16, 0x322113, 6);
      }
      break;

    case 'spruce_leaves':
      drawLeaves(0x2d5e3b, 0x417a52, 0x1e4228);
      break;

    case 'spruce_planks':
      drawPlanks(0x735233, 0x523921, 0x896442);
      break;

    case 'coal_ore':
      drawOreClusters(0x25272a, 0x3d4147, 0x121315);
      break;

    case 'iron_ore':
      drawOreClusters(0xd1a080, 0xebc2a6, 0x9e6f52);
      break;

    case 'gold_ore':
      drawOreClusters(0xf5cb38, 0xfff08a, 0xc29219);
      break;

    case 'diamond_ore':
      drawOreClusters(0x4be4e8, 0xb8ffff, 0x209ea8);
      break;

    case 'glowstone':
      p.fill(0xd69629, 14);
      p.speckle(55, 0xfad656, 12);
      p.speckle(35, 0xfff7b2, 8);
      break;

    case 'crafting_top':
      drawPlanks(0x9e713f, 0x6b4a26, 0xb88751);
      p.rect(1, 1, 14, 14, 0x704c26, 4);
      p.rect(2, 2, 12, 12, 0xb58650, 6);
      // 3x3 crafting grid lines
      for (let i = 2; i <= 14; i += 4) {
        p.rect(i, 2, 1, 12, 0x5c3c1b);
        p.rect(2, i, 12, 1, 0x5c3c1b);
      }
      break;

    case 'crafting_side':
      drawPlanks(0xa67c49, 0x6f4f29, 0xbf945e);
      p.rect(0, 0, 16, 3, 0x7a5229, 5);
      // Hanging tool silhouette (saw + hammer)
      p.rect(3, 5, 3, 6, 0xbcc4cc, 4);
      p.rect(4, 4, 1, 2, 0x5c3c1b);
      p.rect(10, 5, 4, 2, 0x8e969e);
      p.rect(11, 7, 1, 5, 0x5c3c1b);
      break;

    case 'furnace_top':
      p.fill(0x767a7f, 10);
      p.rect(1, 1, 14, 14, 0x898d94, 8);
      p.rect(3, 3, 10, 10, 0x676b70, 6);
      break;

    case 'furnace_side':
      p.fill(0x787c82, 10);
      for (let y = 0; y < 16; y += 4) {
        p.rect(0, y, 16, 1, 0x585b60, 4);
      }
      break;

    case 'furnace_front':
    case 'furnace_front_lit': {
      p.fill(0x787c82, 10);
      for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, 0x585b60, 4);
      // Upper grate
      p.rect(3, 3, 10, 5, 0x26282b);
      // Lower firebox
      p.rect(4, 10, 8, 5, 0x1e2022);
      if (name === 'furnace_front_lit') {
        p.rect(4, 4, 8, 3, 0xff7b1c, 12);
        p.rect(5, 11, 6, 4, 0xff9a24, 14);
        p.rect(6, 12, 4, 2, 0xfff078, 8);
      }
      break;
    }

    case 'chest_top':
      p.fill(0x8c5d2b, 6);
      p.rect(1, 1, 14, 14, 0xb0793b, 8);
      break;

    case 'chest_side':
      p.fill(0x8c5d2b, 6);
      p.rect(1, 1, 14, 14, 0xb0793b, 8);
      p.rect(0, 5, 16, 2, 0x5c3b18, 4);
      break;

    case 'chest_front':
      p.fill(0x8c5d2b, 6);
      p.rect(1, 1, 14, 14, 0xb0793b, 8);
      p.rect(0, 5, 16, 2, 0x5c3b18, 4);
      p.rect(7, 4, 2, 4, 0xe8c958, 4); // Gold latch
      break;

    case 'torch':
      p.rect(7, 6, 2, 10, 0x8c6537, 6);
      p.rect(7, 3, 2, 3, 0xff9424, 8);
      p.rect(7, 2, 2, 2, 0xfff282, 4);
      p.set(6, 4, 0xff6e1a, 200);
      p.set(9, 4, 0xff6e1a, 200);
      break;

    case 'glass':
      // Crisp frame + subtle reflection streaks
      for (let i = 0; i < 16; i++) {
        p.set(i, 0, 0xd4eef7, 240);
        p.set(i, 15, 0xa8d4e6, 240);
        p.set(0, i, 0xd4eef7, 240);
        p.set(15, i, 0xa8d4e6, 240);
      }
      p.set(3, 3, 0xffffff, 220);
      p.set(4, 3, 0xffffff, 220);
      p.set(3, 4, 0xffffff, 220);
      p.set(11, 11, 0xdff6ff, 190);
      p.set(12, 11, 0xdff6ff, 190);
      break;

    case 'bricks':
      p.fill(0xc4bdb5, 6); // Mortar
      for (let row = 0; row < 4; row++) {
        const y = row * 4;
        const off = (row % 2) * 4;
        for (let col = -1; col < 3; col++) {
          p.rect(col * 8 + off, y, 7, 3, 0xa84c3e, 12);
        }
      }
      break;

    case 'stone_bricks':
      p.fill(0x585b60, 5);
      p.rect(0, 0, 7, 7, 0x85898f, 9);
      p.rect(8, 0, 8, 7, 0x80848a, 9);
      p.rect(0, 8, 4, 8, 0x7e8288, 9);
      p.rect(5, 8, 11, 8, 0x868a90, 9);
      break;

    case 'wool':
      p.fill(0xf0f1f5, 10);
      p.speckle(40, 0xe1e4eb, 6);
      break;

    case 'bookshelf':
      drawPlanks(0xa67c49, 0x75542c, 0xc29660);
      p.rect(1, 2, 14, 5, 0x3b2816);
      p.rect(1, 9, 14, 5, 0x3b2816);
      const bookColors = [0xb83838, 0x386eb8, 0x3b8f46, 0xd4a437, 0x7d429e];
      for (let shelf = 0; shelf < 2; shelf++) {
        const sy = shelf === 0 ? 3 : 10;
        for (let bx = 2; bx < 14; bx += 2) {
          const c = bookColors[(bx + shelf * 3) % bookColors.length];
          p.rect(bx, sy, 2, 4, c, 8);
          p.set(bx, sy + 1, 0xede6d6);
        }
      }
      break;

    case 'bed_top':
      p.fill(0xc43636, 8);
      p.rect(0, 0, 16, 5, 0xf2f4f7, 6); // Pillow
      p.rect(0, 5, 16, 1, 0x8f2222);
      break;

    case 'bed_side':
      p.rect(0, 0, 16, 8, 0xc43636, 8);
      p.rect(0, 0, 5, 5, 0xf2f4f7, 5);
      p.rect(0, 8, 16, 5, 0xa67c49, 6);
      p.rect(0, 13, 3, 3, 0x78562d);
      p.rect(13, 13, 3, 3, 0x78562d);
      break;

    case 'ladder':
      p.rect(2, 0, 2, 16, 0x9e7844, 8);
      p.rect(12, 0, 2, 16, 0x9e7844, 8);
      for (let y = 2; y < 16; y += 4) {
        p.rect(1, y, 14, 2, 0xb58c54, 8);
      }
      break;

    case 'cactus_top':
      p.fill(0x3a8731, 10);
      p.rect(2, 2, 12, 12, 0x4ba140, 8);
      p.rect(6, 6, 4, 4, 0x70ba62, 6);
      break;

    case 'cactus_side':
      p.fill(0x3b8a32, 10);
      for (let x = 2; x < 16; x += 4) {
        p.rect(x, 0, 2, 16, 0x2c6e24, 6);
        for (let y = 2; y < 16; y += 5) {
          p.set(x, y, 0xe8e2b5);
        }
      }
      break;

    case 'tall_grass':
      for (let x = 1; x < 15; x += 2) {
        const h = 6 + ((x * 5) % 8);
        for (let y = 15; y >= 16 - h; y--) {
          const sway = y < 10 ? ((x % 4 === 1) ? -1 : 1) : 0;
          p.set(x + sway, y, y < 10 ? 0x6ec24a : 0x4b9432, 255, 10);
        }
      }
      break;

    case 'red_flower':
      p.rect(7, 8, 2, 8, 0x3f8a2e, 5);
      p.set(6, 12, 0x4ca138);
      p.set(9, 11, 0x4ca138);
      p.rect(5, 4, 6, 4, 0xd93030, 10);
      p.rect(6, 3, 4, 1, 0xeb4646);
      p.rect(7, 5, 2, 2, 0xf2c938);
      break;

    case 'yellow_flower':
      p.rect(7, 9, 2, 7, 0x3f8a2e, 5);
      p.rect(5, 5, 6, 4, 0xf5d130, 10);
      p.rect(6, 4, 4, 1, 0xffe45e);
      p.rect(7, 6, 2, 2, 0xe39619);
      break;

    case 'berry_bush':
      for (let y = 4; y < 16; y++) {
        for (let x = 2; x < 14; x++) {
          if (((x * 13 + y * 7) % 5) !== 0) {
            p.set(x, y, 0x347528, 255, 12);
          }
        }
      }
      const berries = [[5, 6], [9, 7], [4, 10], [10, 11], [7, 13], [11, 8]];
      for (const [bx, by] of berries) {
        p.set(bx, by, 0xd9263e);
        p.set(bx + 1, by, 0xa8182b);
      }
      break;

    case 'mushroom':
      p.rect(7, 10, 2, 6, 0xe6dec8, 5);
      p.rect(4, 7, 8, 3, 0xc93b2e, 8);
      p.rect(5, 6, 6, 1, 0xd94b3d);
      p.set(6, 7, 0xf7f5f0);
      p.set(9, 8, 0xf7f5f0);
      break;

    case 'dead_bush':
      p.rect(7, 11, 2, 5, 0x7d5d36);
      p.rect(5, 8, 2, 3, 0x8c6a3f);
      p.rect(9, 7, 2, 4, 0x8c6a3f);
      p.rect(3, 5, 2, 3, 0x9b7749);
      p.rect(11, 5, 2, 3, 0x9b7749);
      break;

    case 'reeds':
      for (const rx of [3, 7, 12]) {
        p.rect(rx, 0, 2, 16, 0x7bbd48, 10);
        p.rect(rx, 4, 2, 1, 0xa2db6b);
        p.rect(rx, 10, 2, 1, 0xa2db6b);
      }
      break;

    default:
      p.fill(0xff00ff, 0);
      break;
  }

  return p.pixels;
}

function drawItemIconCanvas(def, tilePixelsMap) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const drawRawTile = (tileName, dx, dy, dw, dh, brightness = 1.0) => {
    const raw = tilePixelsMap.get(tileName);
    if (!raw) return;
    const tmp = document.createElement('canvas');
    tmp.width = 16;
    tmp.height = 16;
    const tctx = tmp.getContext('2d');
    const img = tctx.createImageData(16, 16);
    for (let i = 0; i < raw.length; i += 4) {
      img.data[i] = clampByte(raw[i] * brightness);
      img.data[i + 1] = clampByte(raw[i + 1] * brightness);
      img.data[i + 2] = clampByte(raw[i + 2] * brightness);
      img.data[i + 3] = raw[i + 3];
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp, dx, dy, dw, dh);
    return tmp;
  };

  if (def.isBlock) {
    const tex = def.textures || {};
    const topName = tex.top || tex.all;
    const frontName = tex.front || tex.side || tex.all;
    const sideName = tex.side || tex.all;

    if (
      def.shape === MESH_SHAPE.CROSS ||
      def.shape === MESH_SHAPE.TORCH ||
      def.shape === MESH_SHAPE.LADDER
    ) {
      drawRawTile(frontName, 6, 6, 36, 36, 1.05);
      return canvas.toDataURL();
    }

    // Isometric 3D block icon!
    const topCanvas = drawRawTile(topName, -100, -100, 16, 16, 1.06);
    const leftCanvas = drawRawTile(frontName, -100, -100, 16, 16, 0.86);
    const rightCanvas = drawRawTile(sideName, -100, -100, 16, 16, 0.68);
    ctx.clearRect(0, 0, 48, 48);

    const scaleY = def.shape === MESH_SHAPE.BED ? 0.55 : 1.0;
    const yOffset = def.shape === MESH_SHAPE.BED ? 8 : 0;

    if (topCanvas && leftCanvas && rightCanvas) {
      // Top diamond
      ctx.save();
      ctx.translate(24, 6 + yOffset);
      ctx.transform(1.12, 0.56, -1.12, 0.56, 0, 0);
      ctx.drawImage(topCanvas, 0, 0, 16, 16);
      ctx.restore();

      // Left face
      ctx.save();
      ctx.translate(6.1, 15 + yOffset);
      ctx.transform(1.12, 0.56, 0, 1.22 * scaleY, 0, 0);
      ctx.drawImage(leftCanvas, 0, 0, 16, 16);
      ctx.restore();

      // Right face
      ctx.save();
      ctx.translate(24, 23.9 + yOffset);
      ctx.transform(1.12, -0.56, 0, 1.22 * scaleY, 0, 0);
      ctx.drawImage(rightCanvas, 0, 0, 16, 16);
      ctx.restore();
    }
    return canvas.toDataURL();
  }

  // Non-block 16x16 pixel sprite scaled 3x to 48x48
  const p = new PixelPainter(900 + def.id);
  const icon = def.icon || '';

  const tierColors = {
    wood: [0xb5884e, 0x805c2e, 0xd1a468],
    stone: [0x8c9196, 0x616569, 0xb0b6bd],
    iron: [0xdce2e8, 0x9aa3ad, 0xffffff],
    diamond: [0x4be6eb, 0x219ca6, 0xc2ffff],
  };

  const tierPrefix = icon.split('_')[0];
  const toolKind = icon.split('_')[1];

  if (tierColors[tierPrefix] && toolKind) {
    const [main, dark, bright] = tierColors[tierPrefix];
    // Diagonal wooden handle
    for (let i = 2; i <= 11; i++) {
      p.set(i, 15 - i, 0x8a6234);
      p.set(i + 1, 15 - i, 0x634420);
    }
    if (toolKind === 'pickaxe') {
      p.rect(6, 2, 7, 2, main);
      p.rect(11, 3, 3, 5, main);
      p.set(5, 3, dark);
      p.set(13, 8, dark);
      p.rect(7, 2, 4, 1, bright);
    } else if (toolKind === 'axe') {
      p.rect(7, 2, 5, 5, main);
      p.rect(6, 3, 2, 4, bright);
      p.rect(11, 5, 2, 3, dark);
    } else if (toolKind === 'shovel') {
      p.rect(10, 2, 4, 4, main);
      p.rect(11, 2, 2, 2, bright);
      p.set(13, 5, dark);
    } else if (toolKind === 'sword') {
      p.clear();
      // Pommel & guard
      p.rect(2, 12, 2, 2, dark);
      p.rect(4, 10, 2, 2, 0x7d582d);
      p.rect(4, 8, 5, 2, dark);
      // Blade
      for (let i = 0; i < 8; i++) {
        p.rect(6 + i, 8 - i, 2, 2, main);
        p.set(6 + i, 8 - i, bright);
      }
    }
  } else {
    switch (icon) {
      case 'stick':
        for (let i = 3; i <= 12; i++) {
          p.set(i, 15 - i, 0x9c7240);
          p.set(i + 1, 15 - i, 0x6e4e28);
        }
        break;
      case 'coal':
      case 'charcoal': {
        const outline = icon === 'coal' ? 0x5c6470 : 0x6e5a4b;
        const core = icon === 'coal' ? 0x2a2f36 : 0x3f332a;
        const glint = icon === 'coal' ? 0x8d97a6 : 0xb87648;
        p.rect(4, 3, 8, 10, outline);
        p.rect(3, 5, 10, 6, outline);
        p.rect(5, 4, 6, 8, core, 8);
        p.rect(4, 6, 8, 4, core, 8);
        p.rect(5, 5, 3, 2, glint);
        break;
      }
      case 'iron_ingot':
      case 'gold_ingot':
      case 'brick_item': {
        const base = icon === 'iron_ingot' ? 0xd8dfe6 : icon === 'gold_ingot' ? 0xf5ca36 : 0xb35242;
        const hi = icon === 'iron_ingot' ? 0xffffff : icon === 'gold_ingot' ? 0xfff39e : 0xcf6d5d;
        const lo = icon === 'iron_ingot' ? 0x8e98a3 : icon === 'gold_ingot' ? 0xb88914 : 0x7d3327;
        p.rect(3, 6, 10, 5, base);
        p.rect(4, 5, 8, 2, hi);
        p.rect(3, 10, 10, 1, lo);
        break;
      }
      case 'diamond':
        p.rect(5, 4, 6, 8, 0x45e3e8);
        p.rect(4, 6, 8, 4, 0x45e3e8);
        p.rect(6, 5, 3, 3, 0xc7ffff);
        p.rect(5, 11, 6, 1, 0x1d9aa3);
        break;
      case 'clay_ball':
        p.rect(5, 5, 6, 6, 0x9da6b8, 8);
        p.rect(4, 6, 8, 4, 0xadb7ca, 6);
        break;
      case 'flint':
        p.rect(5, 4, 5, 8, 0x3b3e42, 8);
        p.rect(6, 3, 3, 2, 0x62676e);
        break;
      case 'leather':
        p.rect(4, 4, 8, 8, 0xa86438, 8);
        p.rect(3, 6, 10, 4, 0xba7243, 6);
        break;
      case 'wheat_grain':
        p.rect(5, 4, 2, 9, 0xd9b848, 8);
        p.rect(8, 3, 2, 10, 0xe8ca58, 8);
        p.rect(6, 11, 4, 2, 0x967a28);
        break;
      case 'apple':
        p.rect(7, 2, 2, 2, 0x6b4c28);
        p.rect(8, 3, 3, 1, 0x4ca638);
        p.rect(4, 5, 8, 7, 0xd93232, 8);
        p.rect(5, 4, 6, 9, 0xe33d3d, 6);
        p.rect(5, 6, 2, 2, 0xff8c8c);
        break;
      case 'sweet_berries':
        p.rect(6, 3, 4, 3, 0x3e8c2e);
        p.rect(4, 6, 4, 4, 0xc9243b);
        p.rect(8, 7, 4, 4, 0xd92e46);
        p.rect(6, 9, 4, 4, 0xb51b30);
        break;
      case 'raw_meat':
      case 'cooked_meat': {
        const m = icon === 'raw_meat' ? 0xd95b5b : 0x8f4e29;
        const fat = icon === 'raw_meat' ? 0xf5dada : 0xbd7946;
        p.rect(3, 5, 10, 6, m, 8);
        p.rect(4, 4, 8, 8, m, 8);
        p.rect(5, 6, 3, 2, fat);
        break;
      }
      case 'bread':
        p.rect(3, 6, 10, 5, 0xc78d38, 8);
        p.rect(4, 5, 8, 2, 0xe3ad52, 6);
        p.rect(3, 10, 10, 1, 0x8f5f1d);
        break;
      default:
        p.rect(4, 4, 8, 8, 0xcccccc);
    }
  }

  const tmp = document.createElement('canvas');
  tmp.width = 16;
  tmp.height = 16;
  const tctx = tmp.getContext('2d');
  const img = tctx.createImageData(16, 16);
  img.data.set(p.pixels);
  tctx.putImageData(img, 0, 0);
  ctx.drawImage(tmp, 3, 3, 42, 42);
  return canvas.toDataURL();
}

export class TextureAtlas {
  constructor() {
    this.uvMap = new Map();
    this.tilePixelsMap = new Map();
    this.iconUrls = new Map();
    this.texture = null;
    this.crackTextures = [];
    this.build();
  }

  build() {
    const atlasW = ATLAS_COLS * SLOT_SIZE;
    const atlasH = ATLAS_ROWS * SLOT_SIZE;

    TILE_NAMES.forEach((name, idx) => {
      const col = idx % ATLAS_COLS;
      const row = Math.floor(idx / ATLAS_COLS);
      const px0 = col * SLOT_SIZE + PAD;
      const py0 = row * SLOT_SIZE + PAD;

      // Normalized UVs inset by 0.02px inside the 16x16 tile (which itself has an 8px border gutter!)
      const u0 = (px0 + 0.02) / atlasW;
      const u1 = (px0 + TILE_SIZE - 0.02) / atlasW;
      // Flip V for Three.js canvas coordinates (top-down row -> WebGL bottom-up V)
      const v1 = 1.0 - (py0 + 0.02) / atlasH;
      const v0 = 1.0 - (py0 + TILE_SIZE - 0.02) / atlasH;

      this.uvMap.set(name, { u0, v0, u1, v1 });
      this.tilePixelsMap.set(name, paintTile(name, idx));
    });

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = atlasW;
      canvas.height = atlasH;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(atlasW, atlasH);
      const data = imgData.data;

      const setAtlasPixel = (ax, ay, r, g, b, a) => {
        const i = (ay * atlasW + ax) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      };

      TILE_NAMES.forEach((name, idx) => {
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        const slotX = col * SLOT_SIZE;
        const slotY = row * SLOT_SIZE;
        const pixels = this.tilePixelsMap.get(name);

        // Fill entire 32x32 slot by clamping coordinates to [0..15] so border pixels extrude 8px outward!
        for (let sy = 0; sy < SLOT_SIZE; sy++) {
          const ty = Math.max(0, Math.min(TILE_SIZE - 1, sy - PAD));
          for (let sx = 0; sx < SLOT_SIZE; sx++) {
            const tx = Math.max(0, Math.min(TILE_SIZE - 1, sx - PAD));
            const src = (ty * TILE_SIZE + tx) * 4;
            setAtlasPixel(
              slotX + sx,
              slotY + sy,
              pixels[src],
              pixels[src + 1],
              pixels[src + 2],
              pixels[src + 3]
            );
          }
        }
      });

      ctx.putImageData(imgData, 0, 0);

      this.texture = new THREE.CanvasTexture(canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.magFilter = THREE.NearestFilter;
      this.texture.minFilter = THREE.NearestFilter;
      this.texture.generateMipmaps = false;
      this.texture.needsUpdate = true;

      this.buildCrackTextures();

      for (const [id, def] of REGISTRY.entries()) {
        if (id === BLOCK_IDS.AIR) continue;
        this.iconUrls.set(id, drawItemIconCanvas(def, this.tilePixelsMap));
      }
    }
  }

  buildCrackTextures() {
    for (let stage = 0; stage < 8; stage++) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = 'rgba(18, 18, 20, 0.72)';

      const reach = 2 + stage * 1.1;
      const rays = [
        [1, 0.7], [-1, 0.6], [0.5, -1], [-0.8, -0.9], [0.9, -0.3], [-0.3, 1],
      ];
      for (let r = 0; r < Math.min(rays.length, stage + 2); r++) {
        const [dx, dy] = rays[r];
        for (let step = 0; step <= reach; step += 0.8) {
          const px = Math.round(7.5 + dx * step + Math.sin(step + r) * 0.6);
          const py = Math.round(7.5 + dy * step + Math.cos(step - r) * 0.6);
          if (px >= 0 && px < 16 && py >= 0 && py < 16) {
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      this.crackTextures.push(tex);
    }
  }

  getUV(tileName) {
    return this.uvMap.get(tileName) || this.uvMap.get('stone');
  }

  getBlockFaceUV(blockDef, faceDir, metadata = 0) {
    const tex = blockDef.textures || {};
    if (tex.all) return this.getUV(tex.all);
    if (faceDir === 'top') return this.getUV(tex.top || tex.side);
    if (faceDir === 'bottom') return this.getUV(tex.bottom || tex.side);

    // Directional front face for Furnace & Chest:
    // metadata 0..3 maps to N(0:-z), E(1:+x), S(2:+z), W(3:-x)
    if (tex.front) {
      const frontDirs = ['nz', 'px', 'pz', 'nx'];
      const expectedFront = frontDirs[metadata & 3] || 'pz';
      if (faceDir === expectedFront) {
        return this.getUV(tex.front);
      }
    }
    return this.getUV(tex.side || tex.top);
  }

  getIconUrl(id) {
    return this.iconUrls.get(id) || '';
  }

   shadeColor(hex, factor) {
    return shadeHex(hex, factor);
  }
}
