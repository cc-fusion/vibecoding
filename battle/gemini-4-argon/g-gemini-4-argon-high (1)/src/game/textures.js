// Procedural 16x16 Pixel-Art Texture Atlas + Isometric UI Item Icon Generator
import * as THREE from 'three';
import {
  TILE_PIXELS,
  TILE_PAD,
  CELL_PIXELS,
  ATLAS_COLS,
  ATLAS_ROWS,
  ATLAS_SIZE,
} from './constants.js';
import { TILES, REGISTRY, getDef } from './items.js';
import { mulberry32 } from './noise.js';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

// Helper pixel painter for a single 16x16 RGBA buffer
class TilePainter {
  constructor(seed = 1337) {
    this.data = new Uint8ClampedArray(16 * 16 * 4);
    this.rng = mulberry32(seed);
  }

  clear(r = 0, g = 0, b = 0, a = 0) {
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = a;
    }
    return this;
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    const idx = (y * 16 + x) * 4;
    this.data[idx] = clampByte(r);
    this.data[idx + 1] = clampByte(g);
    this.data[idx + 2] = clampByte(b);
    this.data[idx + 3] = clampByte(a);
  }

  setHex(x, y, hex, delta = 0, a = 255) {
    const [r, g, b] = hexToRgb(hex);
    this.set(x, y, r + delta, g + delta, b + delta, a);
  }

  fillNoise(baseHex, variance = 16, alpha = 255) {
    const [br, bg, bb] = hexToRgb(baseHex);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = (this.rng() - 0.5) * 2 * variance;
        this.set(x, y, br + d, bg + d, bb + d, alpha);
      }
    }
    return this;
  }

  rect(x0, y0, w, h, hex, delta = 0, a = 255) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.setHex(x, y, hex, delta, a);
      }
    }
    return this;
  }
}

export function buildTextureAtlas() {
  const tiles = new Map();

  const paint = (tileId, fn) => {
    const p = new TilePainter(9001 + tileId * 137);
    fn(p);
    tiles.set(tileId, p.data);
  };

  // --- Natural Terrain ---
  paint(TILES.GRASS_TOP, (p) => {
    p.fillNoise('#56a934', 15);
    for (let i = 0; i < 36; i++) {
      const x = (p.rng() * 16) | 0;
      const y = (p.rng() * 16) | 0;
      p.setHex(x, y, p.rng() > 0.45 ? '#6bc242' : '#438c26');
    }
  });

  paint(TILES.DIRT, (p) => {
    p.fillNoise('#7b5436', 16);
    for (let i = 0; i < 30; i++) {
      const x = (p.rng() * 16) | 0;
      const y = (p.rng() * 16) | 0;
      p.setHex(x, y, p.rng() > 0.5 ? '#5d3e26' : '#966b48');
    }
  });

  paint(TILES.GRASS_SIDE, (p) => {
    // Copy dirt look then drape lush grass overhang
    p.fillNoise('#7b5436', 15);
    for (let i = 0; i < 24; i++) {
      p.setHex((p.rng() * 16) | 0, 3 + ((p.rng() * 13) | 0), '#5d3e26');
    }
    for (let x = 0; x < 16; x++) {
      const hang = 2 + ((p.rng() * 4) | 0);
      for (let y = 0; y < hang; y++) {
        const d = (p.rng() - 0.5) * 20;
        p.setHex(x, y, y === hang - 1 ? '#448d27' : '#57aa35', d);
      }
    }
  });

  paint(TILES.STONE, (p) => {
    p.fillNoise('#82868b', 12);
    // Stratified stone cracks
    for (let y = 1; y < 16; y += 4) {
      const ox = (p.rng() * 6) | 0;
      for (let x = ox; x < ox + 8; x++) {
        p.setHex(x % 16, y, '#6b6f74', (p.rng() - 0.5) * 8);
      }
    }
  });

  paint(TILES.COBBLESTONE, (p) => {
    p.fillNoise('#6c7075', 14);
    const stones = [
      [1, 1, 6, 4], [8, 0, 7, 5], [0, 6, 5, 5], [6, 5, 6, 5],
      [12, 6, 4, 5], [1, 12, 7, 4], [9, 11, 6, 5],
    ];
    for (const [sx, sy, sw, sh] of stones) {
      const shade = (p.rng() - 0.5) * 18;
      for (let y = sy; y < sy + sh; y++) {
        for (let x = sx; x < sx + sw; x++) {
          const edge = x === sx || y === sy || x === sx + sw - 1 || y === sy + sh - 1;
          p.setHex(x % 16, y % 16, edge ? '#4d5054' : '#898d92', edge ? 0 : shade);
        }
      }
    }
  });

  paint(TILES.MOSSY_COBBLE, (p) => {
    const cobble = tiles.get(TILES.COBBLESTONE);
    p.data.set(cobble);
    for (let i = 0; i < 55; i++) {
      const x = (p.rng() * 16) | 0;
      const y = (p.rng() * 16) | 0;
      p.setHex(x, y, p.rng() > 0.4 ? '#4d8a36' : '#3a6e27', (p.rng() - 0.5) * 14);
    }
  });

  paint(TILES.STONE_BRICKS, (p) => {
    p.fillNoise('#85898e', 9);
    for (let x = 0; x < 16; x++) {
      p.setHex(x, 0, '#55585c');
      p.setHex(x, 8, '#55585c');
      p.setHex(x, 1, '#9ca0a6', -4);
      p.setHex(x, 9, '#9ca0a6', -4);
    }
    for (let y = 0; y < 8; y++) p.setHex(0, y, '#55585c');
    for (let y = 8; y < 16; y++) p.setHex(8, y, '#55585c');
  });

  paint(TILES.SAND, (p) => {
    p.fillNoise('#e2d39b', 11);
    for (let y = 2; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) {
        const wave = (y + ((Math.sin(x * 0.6) * 1.2) | 0)) & 15;
        p.setHex(x, wave, '#ebdcae', 6);
      }
    }
  });

  paint(TILES.SANDSTONE_TOP, (p) => {
    p.fillNoise('#decb8c', 9);
  });

  paint(TILES.SANDSTONE_SIDE, (p) => {
    p.fillNoise('#d8c484', 10);
    p.rect(0, 0, 16, 3, '#e7d79f', 0);
    p.rect(0, 3, 16, 1, '#b8a263', 0);
    p.rect(0, 11, 16, 1, '#c1ab6b', 0);
  });

  paint(TILES.GRAVEL, (p) => {
    p.fillNoise('#87827f', 22);
    for (let i = 0; i < 35; i++) {
      p.setHex((p.rng() * 16) | 0, (p.rng() * 16) | 0, p.rng() > 0.5 ? '#67625f' : '#a8a29e');
    }
  });

  paint(TILES.SNOW, (p) => {
    p.fillNoise('#f2f8fd', 7);
    for (let i = 0; i < 20; i++) {
      p.setHex((p.rng() * 16) | 0, (p.rng() * 16) | 0, '#dcebfa');
    }
  });

  paint(TILES.SNOW_SIDE, (p) => {
    p.fillNoise('#7b5436', 15);
    for (let x = 0; x < 16; x++) {
      const hang = 3 + ((p.rng() * 3) | 0);
      for (let y = 0; y < hang; y++) {
        p.setHex(x, y, y === hang - 1 ? '#d4e6f7' : '#f3f9fe', (p.rng() - 0.5) * 8);
      }
    }
  });

  paint(TILES.ICE, (p) => {
    p.fillNoise('#8cc6f7', 10, 210);
    for (let i = 0; i < 16; i++) {
      p.setHex(i, (i * 2) % 16, '#bce0ff', 0, 225);
      p.setHex((i + 5) % 16, i, '#aed8fc', 0, 220);
    }
  });

  paint(TILES.WATER, (p) => {
    p.fillNoise('#2878eb', 12, 188);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) {
        if ((x + y) % 5 < 2) p.setHex(x, y, '#58a3ff', 0, 200);
      }
    }
  });

  paint(TILES.LAVA, (p) => {
    p.fillNoise('#eb4c11', 20, 250);
    for (let i = 0; i < 42; i++) {
      p.setHex((p.rng() * 16) | 0, (p.rng() * 16) | 0, p.rng() > 0.4 ? '#ff9f1c' : '#ffd23f');
    }
  });

  paint(TILES.BEDROCK, (p) => {
    p.fillNoise('#323438', 24);
    for (let i = 0; i < 40; i++) {
      p.setHex((p.rng() * 16) | 0, (p.rng() * 16) | 0, '#18191c');
    }
  });

  // --- Woods & Leaves ---
  paint(TILES.OAK_SIDE, (p) => {
    p.fillNoise('#6c5031', 12);
    for (let x = 0; x < 16; x++) {
      const groove = x % 4 === 0 ? -18 : x % 2 === 0 ? 8 : 0;
      for (let y = 0; y < 16; y++) {
        p.setHex(x, y, '#6c5031', groove + (p.rng() - 0.5) * 12);
      }
    }
  });

  paint(TILES.OAK_TOP, (p) => {
    p.fillNoise('#b5905b', 8);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.4) p.setHex(x, y, '#6b4f30', (p.rng() - 0.5) * 10);
        else if (Math.round(dist) % 2 === 0) p.setHex(x, y, '#9d7847', (p.rng() - 0.5) * 8);
      }
    }
  });

  paint(TILES.BIRCH_SIDE, (p) => {
    p.fillNoise('#dedad0', 9);
    for (let i = 0; i < 14; i++) {
      const y = (p.rng() * 16) | 0;
      const x = (p.rng() * 13) | 0;
      const len = 2 + ((p.rng() * 3) | 0);
      for (let k = 0; k < len; k++) p.setHex(x + k, y, '#383633');
    }
  });

  paint(TILES.SPRUCE_SIDE, (p) => {
    p.fillNoise('#48331e', 11);
    for (let x = 0; x < 16; x += 3) {
      for (let y = 0; y < 16; y++) p.setHex(x, y, '#322213', (p.rng() - 0.5) * 8);
    }
  });

  paint(TILES.SPRUCE_TOP, (p) => {
    p.fillNoise('#85633c', 8);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.4) p.setHex(x, y, '#48331e');
        else if (Math.round(dist) % 2 === 0) p.setHex(x, y, '#6f502f');
      }
    }
  });

  const paintLeaves = (p, mainHex, lightHex, darkHex) => {
    p.fillNoise(mainHex, 16, 255);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = p.rng();
        if (r < 0.14) p.set(x, y, 0, 0, 0, 0); // subtle leaf airy cutouts!
        else if (r < 0.42) p.setHex(x, y, lightHex, (p.rng() - 0.5) * 10);
        else if (r > 0.78) p.setHex(x, y, darkHex, (p.rng() - 0.5) * 10);
      }
    }
  };

  paint(TILES.OAK_LEAVES, (p) => paintLeaves(p, '#398a28', '#52ad39', '#256318'));
  paint(TILES.BIRCH_LEAVES, (p) => paintLeaves(p, '#639f3d', '#82bf56', '#467827'));
  paint(TILES.SPRUCE_LEAVES, (p) => paintLeaves(p, '#2a5f35', '#3c7a49', '#1b4223'));

  const paintPlanks = (p, baseHex, seamHex) => {
    p.fillNoise(baseHex, 10);
    for (let row = 0; row < 4; row++) {
      const ySeam = row * 4 + 3;
      for (let x = 0; x < 16; x++) p.setHex(x, ySeam, seamHex);
      const vJoint = (row * 7 + 4) % 16;
      for (let y = row * 4; y < row * 4 + 3; y++) p.setHex(vJoint, y, seamHex);
    }
  };

  paint(TILES.OAK_PLANKS, (p) => paintPlanks(p, '#b38b54', '#7d5d33'));
  paint(TILES.BIRCH_PLANKS, (p) => paintPlanks(p, '#d8c796', '#a89668'));
  paint(TILES.SPRUCE_PLANKS, (p) => paintPlanks(p, '#785634', '#4f371f'));

  // --- Stations & Crafted Blocks ---
  paint(TILES.CRAFT_TOP, (p) => {
    paintPlanks(p, '#a87d48', '#6f4e27');
    p.rect(2, 2, 12, 12, '#694723');
    p.rect(3, 3, 10, 10, '#c79b63');
    // 3x3 crafting grid lines
    for (let i = 3; i < 13; i++) {
      p.setHex(6, i, '#694723');
      p.setHex(9, i, '#694723');
      p.setHex(i, 6, '#694723');
      p.setHex(i, 9, '#694723');
    }
  });

  paint(TILES.CRAFT_SIDE, (p) => {
    paintPlanks(p, '#ad8450', '#70502a');
    p.rect(0, 0, 16, 3, '#7b542c');
    // Hanging saw & hammer details
    p.rect(3, 5, 3, 6, '#cfd6de');
    p.rect(4, 4, 1, 2, '#634121');
    p.rect(10, 5, 4, 2, '#cfd6de');
    p.rect(11, 7, 2, 5, '#634121');
  });

  paint(TILES.FURNACE_SIDE, (p) => {
    p.data.set(tiles.get(TILES.COBBLESTONE));
    p.rect(0, 0, 16, 2, '#5a5e63');
    p.rect(0, 14, 16, 2, '#5a5e63');
  });

  paint(TILES.FURNACE_FRONT, (p) => {
    p.data.set(tiles.get(TILES.FURNACE_SIDE));
    p.rect(4, 3, 8, 5, '#26282b');
    p.rect(4, 10, 8, 4, '#2b1e19');
    // Warm ember glow inside firebox
    p.rect(5, 11, 6, 2, '#ff7b24');
    p.setHex(7, 11, '#ffd447');
    p.setHex(8, 12, '#ffd447');
  });

  paint(TILES.BOOKSHELF, (p) => {
    p.rect(0, 0, 16, 16, '#52381e');
    p.rect(0, 0, 16, 2, '#b38b54');
    p.rect(0, 7, 16, 2, '#b38b54');
    p.rect(0, 14, 16, 2, '#b38b54');
    const bookColors = ['#c93b3b', '#3878c9', '#3ca352', '#d4a635', '#8b4ac9', '#2ca6a6'];
    for (const shelfY of [2, 9]) {
      let x = 1;
      while (x < 15) {
        const bw = 2;
        const col = bookColors[((x + shelfY) * 3) % bookColors.length];
        p.rect(x, shelfY, bw, 5, col, (p.rng() - 0.5) * 12);
        p.setHex(x, shelfY + 1, '#ede6d3');
        x += bw + (x % 5 === 0 ? 1 : 0);
      }
    }
  });

  paint(TILES.GLASS, (p) => {
    p.clear(200, 240, 255, 22);
    for (let i = 0; i < 16; i++) {
      p.setHex(i, 0, '#d9f4ff');
      p.setHex(i, 15, '#9ecde3');
      p.setHex(0, i, '#d9f4ff');
      p.setHex(15, i, '#9ecde3');
    }
    // Crisp pixel glass specular streaks
    p.setHex(3, 3, '#ffffff');
    p.setHex(4, 4, '#ffffff');
    p.setHex(5, 5, '#ffffff');
    p.setHex(11, 10, '#e6f9ff');
    p.setHex(12, 11, '#e6f9ff');
  });

  paint(TILES.BRICKS, (p) => {
    p.fillNoise('#a84b3b', 12);
    for (let row = 0; row < 4; row++) {
      const y = row * 4 + 3;
      for (let x = 0; x < 16; x++) p.setHex(x, y, '#cfc8be');
      const offset = (row % 2) * 4;
      for (let x = offset; x < 16; x += 8) {
        for (let dy = row * 4; dy < row * 4 + 3; dy++) p.setHex(x, dy, '#cfc8be');
      }
    }
  });

  paint(TILES.WOOL, (p) => {
    p.fillNoise('#f2f0ea', 10);
    for (let i = 0; i < 28; i++) {
      p.setHex((p.rng() * 16) | 0, (p.rng() * 16) | 0, '#e0ddd3');
    }
  });

  paint(TILES.BED_TOP, (p) => {
    p.fillNoise('#c63333', 10);
    // White pillow at head
    p.rect(1, 1, 14, 5, '#f4f2ec');
    p.rect(1, 6, 14, 1, '#dedad0');
    // Wood trim border
    for (let i = 0; i < 16; i++) {
      p.setHex(0, i, '#7d5b34');
      p.setHex(15, i, '#7d5b34');
      p.setHex(i, 0, '#7d5b34');
      p.setHex(i, 15, '#7d5b34');
    }
  });

  paint(TILES.BED_SIDE, (p) => {
    p.fillNoise('#9e7444', 10);
    // Blanket & mattress upper half
    p.rect(0, 0, 16, 7, '#c63333');
    p.rect(0, 0, 5, 7, '#f4f2ec');
    p.rect(0, 7, 16, 4, '#b38b54');
    // Lower space & wooden legs
    p.rect(2, 11, 12, 5, '#47331c');
    p.rect(0, 11, 2, 5, '#7d5b34');
    p.rect(14, 11, 2, 5, '#7d5b34');
  });

  paint(TILES.GLOWSTONE, (p) => {
    p.fillNoise('#e39c2b', 18);
    for (let i = 0; i < 65; i++) {
      const x = (p.rng() * 16) | 0;
      const y = (p.rng() * 16) | 0;
      p.setHex(x, y, p.rng() > 0.4 ? '#ffec85' : '#fff9d2');
    }
  });

  paint(TILES.LANTERN, (p) => {
    p.fillNoise('#3b4047', 8);
    p.rect(3, 2, 10, 12, '#ffae33');
    p.rect(5, 4, 6, 8, '#fff2a6');
    for (let y = 2; y < 14; y++) {
      p.setHex(7, y, '#454b54');
      p.setHex(8, y, '#454b54');
    }
  });

  paint(TILES.TORCH, (p) => {
    p.clear(0, 0, 0, 0);
    // Stick body in center columns 7..8
    p.rect(7, 6, 2, 10, '#8d6538');
    p.setHex(7, 8, '#6e4c26');
    p.setHex(8, 12, '#6e4c26');
    // Glowing flame head
    p.rect(6, 3, 4, 3, '#ff8c1a');
    p.rect(7, 2, 2, 3, '#ffe761');
    p.setHex(7, 3, '#ffffff');
  });

  // --- Ores ---
  const paintOre = (p, mainHex, hiHex, darkHex) => {
    p.data.set(tiles.get(TILES.STONE));
    const spots = [
      [3, 3], [4, 3], [3, 4],
      [10, 4], [11, 5], [10, 5],
      [5, 10], [6, 10], [6, 11],
      [11, 11], [12, 11], [11, 12],
    ];
    for (const [x, y] of spots) {
      const r = p.rng();
      p.setHex(x, y, r < 0.3 ? hiHex : r > 0.75 ? darkHex : mainHex);
    }
  };

  paint(TILES.COAL_ORE, (p) => paintOre(p, '#26292e', '#434852', '#141619'));
  paint(TILES.IRON_ORE, (p) => paintOre(p, '#d4a787', '#f0cbb0', '#9c7154'));
  paint(TILES.GOLD_ORE, (p) => paintOre(p, '#f5cc36', '#fff28c', '#bd8e15'));
  paint(TILES.DIAMOND_ORE, (p) => paintOre(p, '#48ebe0', '#b8fff9', '#1da3ad'));
  paint(TILES.CRYSTAL_ORE, (p) => paintOre(p, '#ae6eff', '#e6ccff', '#6c30c9'));

  // --- Cactus & Flora ---
  paint(TILES.CACTUS_SIDE, (p) => {
    p.fillNoise('#2f852e', 10);
    for (let x = 1; x < 16; x += 4) {
      for (let y = 0; y < 16; y++) p.setHex(x, y, '#216320');
      for (let y = 2; y < 16; y += 5) p.setHex(x, y, '#dce6b8'); // cactus spines
    }
  });

  paint(TILES.CACTUS_TOP, (p) => {
    p.fillNoise('#3b9939', 10);
    p.rect(3, 3, 10, 10, '#5bb557');
  });

  paint(TILES.TALL_GRASS, (p) => {
    p.clear();
    const blades = [2, 4, 7, 9, 11, 13];
    for (const bx of blades) {
      const h = 7 + ((p.rng() * 7) | 0);
      for (let y = 15; y >= 16 - h; y--) {
        const sway = y < 9 ? ((bx % 2 === 0) ? -1 : 1) : 0;
        p.setHex(bx + sway, y, y < 10 ? '#6bc441' : '#469127');
      }
    }
  });

  paint(TILES.RED_FLOWER, (p) => {
    p.clear();
    p.rect(7, 8, 2, 8, '#3f8f29');
    p.setHex(6, 11, '#4ca632');
    p.setHex(9, 12, '#4ca632');
    p.rect(5, 4, 6, 4, '#e03131');
    p.rect(6, 3, 4, 5, '#f24949');
    p.rect(7, 5, 2, 2, '#ffda47');
  });

  paint(TILES.YELLOW_FLOWER, (p) => {
    p.clear();
    p.rect(7, 8, 2, 8, '#3f8f29');
    p.rect(5, 4, 6, 4, '#f5cf27');
    p.rect(6, 3, 4, 6, '#ffe552');
    p.rect(7, 5, 2, 2, '#f0971d');
  });

  paint(TILES.DEAD_BUSH, (p) => {
    p.clear();
    p.rect(7, 10, 2, 6, '#7a5931');
    const twigs = [
      [6, 9], [5, 8], [4, 6], [5, 5],
      [9, 9], [10, 8], [11, 6], [8, 7], [7, 5],
    ];
    for (const [x, y] of twigs) p.setHex(x, y, '#8f6b3e');
  });

  paint(TILES.MUSHROOM, (p) => {
    p.clear();
    p.rect(7, 10, 2, 6, '#e8dec8');
    p.rect(4, 7, 8, 3, '#cf488c');
    p.rect(5, 5, 6, 2, '#e35da2');
    p.setHex(6, 6, '#fff2ff');
    p.setHex(9, 7, '#fff2ff');
  });

  // --- Progressive Block Crack Overlays (0..5) ---
  for (let stage = 0; stage < 6; stage++) {
    paint(TILES.CRACK_0 + stage, (p) => {
      p.clear();
      const branches = (stage + 1) * 3;
      const rng = mulberry32(404 + stage * 19);
      for (let b = 0; b < branches; b++) {
        let cx = 8;
        let cy = 8;
        const steps = 3 + stage * 2;
        const dx = (rng() - 0.5) * 2.2;
        const dy = (rng() - 0.5) * 2.2;
        for (let s = 0; s < steps; s++) {
          cx += dx + (rng() - 0.5) * 1.1;
          cy += dy + (rng() - 0.5) * 1.1;
          p.set(cx | 0, cy | 0, 15, 16, 18, 185);
        }
      }
    });
  }

  // Pack all 16x16 tiles into a 256x256 RGBA DataTexture with 8px extruded border padding!
  const atlasData = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);

  for (const [tileId, src] of tiles.entries()) {
    const col = tileId % ATLAS_COLS;
    const row = Math.floor(tileId / ATLAS_COLS);
    const cellX = col * CELL_PIXELS;
    const cellY = row * CELL_PIXELS;

    for (let py = 0; py < CELL_PIXELS; py++) {
      // Clamp to [0, 15] so the 8px padding repeats the edge texels cleanly
      const sy = Math.max(0, Math.min(TILE_PIXELS - 1, py - TILE_PAD));
      for (let px = 0; px < CELL_PIXELS; px++) {
        const sx = Math.max(0, Math.min(TILE_PIXELS - 1, px - TILE_PAD));
        const sIdx = (sy * TILE_PIXELS + sx) * 4;
        const ax = cellX + px;
        // Flip Y in DataTexture or keep top-down with flipY = false:
        // Using flipY = false makes UV math super clean and direct!
        const ay = cellY + py;
        const dIdx = (ay * ATLAS_SIZE + ax) * 4;
        atlasData[dIdx] = src[sIdx];
        atlasData[dIdx + 1] = src[sIdx + 1];
        atlasData[dIdx + 2] = src[sIdx + 2];
        atlasData[dIdx + 3] = src[sIdx + 3];
      }
    }
  }

  const texture = new THREE.DataTexture(atlasData, ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // Build crisp data-URL icons for UI slots (browser runtime)
  const iconUrls = buildIconDataUrls(tiles);

  return { texture, tiles, iconUrls };
}

// Compute exact UV bounds [u0, v0, u1, v1] for a tile inside our flipY=false padded atlas
export function getTileUVs(tileId) {
  const col = tileId % ATLAS_COLS;
  const row = Math.floor(tileId / ATLAS_COLS);
  const x0 = col * CELL_PIXELS + TILE_PAD;
  const y0 = row * CELL_PIXELS + TILE_PAD;
  const u0 = x0 / ATLAS_SIZE;
  const v0 = y0 / ATLAS_SIZE;
  const u1 = (x0 + TILE_PIXELS) / ATLAS_SIZE;
  const v1 = (y0 + TILE_PIXELS) / ATLAS_SIZE;
  return [u0, v0, u1, v1];
}

// Generate crisp 32x32 isometric block icons & pixel-art item icons for UI
function buildIconDataUrls(tiles) {
  const urls = new Map();
  const canvas = makeCanvas(32, 32);
  if (!canvas) return urls;
  const ctx = canvas.getContext('2d');
  if (!ctx) return urls;

  const tileCanvas = makeCanvas(16, 16);
  const tctx = tileCanvas.getContext('2d');

  const putTileToCanvas = (tileId, brightness = 1.0) => {
    const src = tiles.get(tileId);
    if (!src) return;
    const img = tctx.createImageData(16, 16);
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      img.data[idx] = clampByte(src[idx] * brightness);
      img.data[idx + 1] = clampByte(src[idx + 1] * brightness);
      img.data[idx + 2] = clampByte(src[idx + 2] * brightness);
      img.data[idx + 3] = src[idx + 3];
    }
    tctx.putImageData(img, 0, 0);
  };

  for (const key of Object.keys(REGISTRY)) {
    const id = Number(key);
    if (id === 0) continue;
    const def = getDef(id);
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;

    if (def.isBlock) {
      if (def.renderType === 'cross' || def.renderType === 'torch') {
        putTileToCanvas(def.faces.top, 1.05);
        ctx.drawImage(tileCanvas, 4, 4, 24, 24);
      } else {
        // Render crisp isometric 3D cube using Top, North (left), East (right) faces!
        // Top diamond
        ctx.save();
        putTileToCanvas(def.faces.top, 1.06);
        ctx.transform(0.75, 0.375, -0.75, 0.375, 16, 3);
        ctx.drawImage(tileCanvas, 0, 0, 16, 16);
        ctx.restore();

        // Left face
        ctx.save();
        putTileToCanvas(def.faces.west ?? def.faces.north, 0.84);
        ctx.transform(0.75, 0.375, 0, 0.82, 4, 9);
        ctx.drawImage(tileCanvas, 0, 0, 16, 16);
        ctx.restore();

        // Right face
        ctx.save();
        putTileToCanvas(def.faces.north, 0.66);
        ctx.transform(0.75, -0.375, 0, 0.82, 16, 15);
        ctx.drawImage(tileCanvas, 0, 0, 16, 16);
        ctx.restore();
      }
    } else {
      drawPixelItemIcon(tctx, def);
      ctx.drawImage(tileCanvas, 3, 3, 26, 26);
    }

    urls.set(id, canvas.toDataURL());
  }

  return urls;
}

function drawPixelItemIcon(tctx, def) {
  tctx.clearRect(0, 0, 16, 16);
  const px = (x, y, col) => {
    tctx.fillStyle = col;
    tctx.fillRect(x, y, 1, 1);
  };
  const handle = '#7b5531';
  const handleDark = '#54381d';
  const main = def.iconColor || '#cccccc';
  const acc = def.iconAccent || '#ffffff';

  switch (def.iconType) {
    case 'stick':
      for (let i = 3; i < 13; i++) {
        px(i, 15 - i, handle);
        px(i, 14 - i, '#9c6e42');
      }
      break;

    case 'pickaxe':
      for (let i = 2; i < 12; i++) {
        px(i, 15 - i, i % 2 ? handle : handleDark);
      }
      for (let x = 6; x <= 13; x++) px(x, 2, main);
      px(5, 3, main); px(6, 3, main); px(12, 3, main); px(13, 3, main);
      px(13, 4, main); px(14, 5, main); px(13, 6, main);
      px(4, 4, main);
      break;

    case 'axe':
      for (let i = 2; i < 13; i++) px(i, 15 - i, handle);
      for (let y = 2; y <= 6; y++) {
        for (let x = 7; x <= 11; x++) px(x, y, main);
      }
      px(6, 3, main); px(6, 4, main); px(12, 3, main);
      break;

    case 'shovel':
      for (let i = 2; i < 11; i++) px(i, 15 - i, handle);
      for (let y = 2; y <= 5; y++) {
        for (let x = 10; x <= 13; x++) px(x, y, main);
      }
      px(11, 1, main); px(12, 1, main);
      break;

    case 'sword':
      px(2, 13, handleDark); px(3, 12, handle); px(4, 11, handle);
      px(3, 9, '#5e4326'); px(4, 10, '#5e4326'); px(5, 11, '#5e4326'); px(6, 12, '#5e4326');
      for (let i = 5; i <= 13; i++) {
        px(i, 15 - i, main);
        px(i, 14 - i, '#ffffff88');
        px(i + 1, 15 - i, main);
      }
      break;

    case 'ingot':
      tctx.fillStyle = acc;
      tctx.fillRect(3, 6, 10, 5);
      tctx.fillStyle = main;
      tctx.fillRect(4, 5, 8, 5);
      tctx.fillStyle = '#ffffffaa';
      tctx.fillRect(5, 6, 5, 1);
      break;

    case 'diamond':
    case 'gem':
    case 'crystal':
      tctx.fillStyle = main;
      tctx.fillRect(5, 4, 6, 8);
      tctx.fillRect(4, 6, 8, 5);
      tctx.fillStyle = '#ffffffaa';
      tctx.fillRect(6, 5, 2, 2);
      tctx.fillStyle = acc;
      tctx.fillRect(6, 10, 4, 2);
      break;

    case 'ore_chunk':
      tctx.fillStyle = acc;
      tctx.fillRect(4, 5, 8, 7);
      tctx.fillStyle = main;
      tctx.fillRect(5, 4, 6, 6);
      px(6, 5, '#ffffffaa');
      px(9, 8, main);
      break;

    case 'bucket':
    case 'water_bucket':
      tctx.fillStyle = '#aeb8c2';
      tctx.fillRect(4, 5, 8, 7);
      tctx.fillRect(5, 12, 6, 2);
      tctx.fillStyle = def.iconType === 'water_bucket' ? '#2e86ff' : '#4a5259';
      tctx.fillRect(5, 5, 6, 3);
      break;

    case 'apple':
      tctx.fillStyle = '#43a047';
      tctx.fillRect(8, 2, 2, 2);
      tctx.fillStyle = main;
      tctx.fillRect(4, 4, 8, 8);
      tctx.fillRect(5, 12, 6, 2);
      px(6, 5, '#ff9e9e');
      break;

    case 'meat':
      tctx.fillStyle = main;
      tctx.fillRect(4, 5, 8, 6);
      tctx.fillRect(5, 4, 6, 8);
      tctx.fillStyle = '#f5efe6';
      tctx.fillRect(6, 6, 2, 2);
      break;

    case 'stew':
      tctx.fillStyle = '#825732';
      tctx.fillRect(3, 8, 10, 5);
      tctx.fillRect(5, 13, 6, 1);
      tctx.fillStyle = main;
      tctx.fillRect(4, 7, 8, 2);
      px(6, 7, '#ffd9c2');
      px(9, 8, '#ffd9c2');
      break;

    default:
      tctx.fillStyle = main;
      tctx.fillRect(4, 4, 8, 8);
  }
}
