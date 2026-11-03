import * as THREE from 'three';
import { BLOCK, ITEM, REGISTRY } from '../constants/Blocks.js';
import { mulberry32 } from './Noise.js';

const ATLAS_SIZE = 256;
const SLOT_SIZE = 32; // 16x16 inner tile + 8px extruded border on all sides
const TILE_SIZE = 16;
const PAD = 8;
const GRID = ATLAS_SIZE / SLOT_SIZE; // 8x8 = 64 tiles

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function hexToRgb(hex) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Helper for painting a single 16x16 pixel buffer
class PixelTile {
  constructor(seed = 1) {
    this.data = new Uint8ClampedArray(16 * 16 * 4);
    this.rng = mulberry32(seed);
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    const idx = (y * 16 + x) * 4;
    this.data[idx] = clampByte(r);
    this.data[idx + 1] = clampByte(g);
    this.data[idx + 2] = clampByte(b);
    this.data[idx + 3] = clampByte(a);
  }

  setHex(x, y, hex, variance = 0, a = 255) {
    const [r, g, b] = hexToRgb(hex);
    const d = variance ? (this.rng() * 2 - 1) * variance : 0;
    this.set(x, y, r + d, g + d, b + d, a);
  }

  fillNoise(hex, variance = 12, speckleHex = null, speckleChance = 0) {
    const [br, bg, bb] = hexToRgb(hex);
    const sp = speckleHex ? hexToRgb(speckleHex) : null;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (sp && this.rng() < speckleChance) {
          const d = (this.rng() * 2 - 1) * (variance * 0.6);
          this.set(x, y, sp[0] + d, sp[1] + d, sp[2] + d, 255);
        } else {
          const d = (this.rng() * 2 - 1) * variance;
          this.set(x, y, br + d, bg + d, bb + d, 255);
        }
      }
    }
  }
}

function buildBlockTiles() {
  const tiles = {};
  let seedCounter = 100;
  const make = (name, fn) => {
    const t = new PixelTile((seedCounter += 37));
    fn(t);
    tiles[name] = t;
  };

  // Grass Top (neutral rich green that takes biome vertex tinting cleanly)
  make('grass_top', (t) => {
    t.fillNoise('#7cbd46', 14, '#6aa838', 0.25);
    for (let i = 0; i < 18; i++) {
      t.setHex((t.rng() * 16) | 0, (t.rng() * 16) | 0, '#8fd156', 6);
    }
  });

  // Dirt
  make('dirt', (t) => {
    t.fillNoise('#865c3c', 15, '#6d482d', 0.22);
    for (let i = 0; i < 12; i++) {
      t.setHex((t.rng() * 16) | 0, (t.rng() * 16) | 0, '#9e7250', 6);
    }
  });

  // Grass Side
  make('grass_side', (t) => {
    const dirt = tiles.dirt.data;
    t.data.set(dirt);
    for (let x = 0; x < 16; x++) {
      const overhang = 2 + ((t.rng() * 3.4) | 0);
      for (let y = 0; y < overhang; y++) {
        const shade = y === overhang - 1 ? -14 : 0;
        const [r, g, b] = hexToRgb('#6fb33b');
        const d = (t.rng() * 2 - 1) * 11 + shade;
        t.set(x, y, r + d, g + d, b + d, 255);
      }
    }
  });

  // Snowy grass side & Snow
  make('snow', (t) => {
    t.fillNoise('#f2f8ff', 8, '#dcebfa', 0.22);
  });

  make('snowy_grass_side', (t) => {
    t.data.set(tiles.dirt.data);
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + ((t.rng() * 3) | 0);
      for (let y = 0; y < overhang; y++) {
        const hex = y === overhang - 1 ? '#cfe3f7' : '#f1f8ff';
        t.setHex(x, y, hex, 6);
      }
    }
  });

  // Stone
  make('stone', (t) => {
    for (let y = 0; y < 16; y++) {
      const band = ((y + ((t.rng() * 2) | 0)) % 4 === 0) ? -8 : 0;
      for (let x = 0; x < 16; x++) {
        const d = (t.rng() * 2 - 1) * 11 + band;
        t.set(x, y, 126 + d, 130 + d, 134 + d, 255);
      }
    }
  });

  // Cobblestone
  make('cobblestone', (t) => {
    t.fillNoise('#6d7175', 14);
    const stones = [
      [1, 1, 6, 4], [8, 1, 7, 5], [0, 6, 5, 5], [6, 7, 6, 4],
      [12, 6, 4, 5], [2, 12, 6, 4], [9, 11, 6, 5],
    ];
    for (const [sx, sy, sw, sh] of stones) {
      const base = 128 + ((t.rng() * 26 - 13) | 0);
      for (let y = sy; y < sy + sh && y < 16; y++) {
        for (let x = sx; x < sx + sw && x < 16; x++) {
          const edge = x === sx || y === sy ? 14 : (x === sx + sw - 1 || y === sy + sh - 1 ? -22 : 0);
          t.set(x, y, base + edge, base + edge, base + 2 + edge, 255);
        }
      }
    }
  });

  // Mossy Cobblestone
  make('mossy_cobble', (t) => {
    t.data.set(tiles.cobblestone.data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = (y * 16 + x) * 4;
        if (t.data[idx] < 118 && t.rng() < 0.72) {
          t.setHex(x, y, '#4f8a36', 14);
        }
      }
    }
  });

  // Bedrock
  make('bedrock', (t) => {
    t.fillNoise('#2f3136', 22, '#17181b', 0.38);
    for (let i = 0; i < 24; i++) {
      t.setHex((t.rng() * 16) | 0, (t.rng() * 16) | 0, '#52555e', 8);
    }
  });

  // Sand & Sandstone
  make('sand', (t) => {
    for (let y = 0; y < 16; y++) {
      const wave = Math.sin(y * 0.8) * 5;
      for (let x = 0; x < 16; x++) {
        const d = (t.rng() * 2 - 1) * 9 + wave;
        t.set(x, y, 224 + d, 206 + d, 152 + d, 255);
      }
    }
  });

  make('sandstone_top', (t) => {
    t.fillNoise('#e2cf98', 8, '#d4be84', 0.25);
  });
  make('sandstone_bottom', (t) => {
    t.fillNoise('#ccb47a', 10);
  });
  make('sandstone_side', (t) => {
    for (let y = 0; y < 16; y++) {
      const hex = y < 3 ? '#ead9a5' : y === 3 || y === 9 ? '#bfa66d' : '#dbc68e';
      for (let x = 0; x < 16; x++) {
        t.setHex(x, y, hex, 7);
      }
    }
  });

  // Gravel
  make('gravel', (t) => {
    t.fillNoise('#87827e', 20, '#6a6562', 0.3);
    for (let i = 0; i < 20; i++) {
      t.setHex((t.rng() * 16) | 0, (t.rng() * 16) | 0, '#a69f9a', 8);
    }
  });

  // Water
  make('water', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const shimmer = ((x + y * 2) % 7 === 0) ? 22 : 0;
        const d = (t.rng() * 2 - 1) * 6 + shimmer;
        t.set(x, y, 36 + d, 128 + d, 214 + d, 195);
      }
    }
  });

  // Ice
  make('ice', (t) => {
    t.fillNoise('#8ec8f6', 8);
    for (let i = 0; i < 16; i++) {
      t.set(i, (i * 2) % 16, 215, 240, 255, 225);
      t.set((15 - i), (i + 5) % 16, 190, 228, 252, 225);
    }
    for (let i = 3; i < 16 * 16 * 4; i += 4) t.data[i] = 220;
  });

  // Oak Log & Planks & Leaves
  make('oak_log_side', (t) => {
    for (let x = 0; x < 16; x++) {
      const groove = x % 4 === 0 ? -16 : (x % 4 === 2 ? 8 : 0);
      for (let y = 0; y < 16; y++) {
        const d = (t.rng() * 2 - 1) * 10 + groove;
        t.set(x, y, 108 + d, 82 + d, 50 + d, 255);
      }
    }
  });

  make('oak_log_top', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.2) {
          t.setHex(x, y, '#694e2f', 8);
        } else {
          const ring = Math.round(dist) % 2 === 0 ? '#b9935e' : '#9f7b49';
          t.setHex(x, y, ring, 6);
        }
      }
    }
  });

  make('oak_leaves', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (t.rng() < 0.16 && x > 0 && x < 15 && y > 0 && y < 15) {
          t.set(x, y, 0, 0, 0, 0);
        } else {
          const shade = t.rng() < 0.35 ? '#4c8c2b' : '#65ab3e';
          t.setHex(x, y, shade, 12, 255);
        }
      }
    }
  });

  // Birch Log & Leaves
  make('birch_log_side', (t) => {
    t.fillNoise('#e5e1d8', 9);
    for (let i = 0; i < 11; i++) {
      const bx = (t.rng() * 13) | 0;
      const by = (t.rng() * 15) | 0;
      const len = 2 + ((t.rng() * 3) | 0);
      for (let dx = 0; dx < len; dx++) {
        t.setHex(bx + dx, by, '#3d3b37', 10);
      }
    }
  });

  make('birch_log_top', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.2) t.setHex(x, y, '#dcd8cf', 6);
        else t.setHex(x, y, Math.round(dist) % 2 === 0 ? '#d8c596' : '#c4ae7d', 5);
      }
    }
  });

  make('birch_leaves', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (t.rng() < 0.16 && x > 0 && x < 15 && y > 0 && y < 15) {
          t.set(x, y, 0, 0, 0, 0);
        } else {
          t.setHex(x, y, t.rng() < 0.4 ? '#6ea145' : '#85ba56', 10, 255);
        }
      }
    }
  });

  // Spruce Log & Leaves
  make('spruce_log_side', (t) => {
    for (let x = 0; x < 16; x++) {
      const groove = x % 3 === 0 ? -12 : 4;
      for (let y = 0; y < 16; y++) {
        const d = (t.rng() * 2 - 1) * 8 + groove;
        t.set(x, y, 68 + d, 47 + d, 30 + d, 255);
      }
    }
  });

  make('spruce_log_top', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.2) t.setHex(x, y, '#432e1d', 5);
        else t.setHex(x, y, Math.round(dist) % 2 === 0 ? '#936e46' : '#7b5936', 5);
      }
    }
  });

  make('spruce_leaves', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (t.rng() < 0.14 && x > 0 && x < 15 && y > 0 && y < 15) {
          t.set(x, y, 0, 0, 0, 0);
        } else {
          t.setHex(x, y, t.rng() < 0.45 ? '#2f5e3b' : '#3d744b', 9, 255);
        }
      }
    }
  });

  // Planks helper
  const makePlanks = (name, baseHex, seamHex) => {
    make(name, (t) => {
      t.fillNoise(baseHex, 9);
      for (const y of [3, 7, 11, 15]) {
        for (let x = 0; x < 16; x++) t.setHex(x, y, seamHex, 5);
      }
      for (let row = 0; row < 4; row++) {
        const vx = (row * 7 + 4) % 16;
        for (let dy = 0; dy < 3; dy++) t.setHex(vx, row * 4 + dy, seamHex, 4);
      }
    });
  };
  makePlanks('oak_planks', '#b89258', '#876739');
  makePlanks('birch_planks', '#d7c693', '#ad9b6b');
  makePlanks('spruce_planks', '#7b5836', '#543a21');

  // Cactus
  make('cactus_side', (t) => {
    for (let x = 0; x < 16; x++) {
      const rib = x % 4 === 0 ? -18 : (x % 4 === 2 ? 12 : 0);
      for (let y = 0; y < 16; y++) {
        const [r, g, b] = hexToRgb('#3f8a36');
        const d = (t.rng() * 2 - 1) * 7 + rib;
        t.set(x, y, r + d, g + d, b + d, 255);
      }
    }
    for (const [sx, sy] of [[2, 3], [6, 9], [10, 4], [14, 12], [2, 13], [10, 14]]) {
      t.setHex(sx, sy, '#e9edc9', 4);
    }
  });
  make('cactus_top', (t) => {
    t.fillNoise('#4d9d42', 9);
    for (let i = 3; i <= 12; i++) {
      t.setHex(i, 3, '#2f6a28', 4);
      t.setHex(i, 12, '#2f6a28', 4);
      t.setHex(3, i, '#2f6a28', 4);
      t.setHex(12, i, '#2f6a28', 4);
    }
  });

  // Ores overlaid on stone
  const makeOre = (name, veinHex, glintHex) => {
    make(name, (t) => {
      t.data.set(tiles.stone.data);
      const spots = [
        [3, 3], [4, 3], [3, 4],
        [10, 4], [11, 4], [11, 5],
        [5, 9], [6, 9], [6, 10], [7, 10],
        [11, 11], [12, 11], [11, 12],
      ];
      for (const [ox, oy] of spots) {
        t.setHex(ox, oy, veinHex, 8);
      }
      t.setHex(4, 3, glintHex, 3);
      t.setHex(6, 9, glintHex, 3);
      t.setHex(11, 11, glintHex, 3);
    });
  };
  makeOre('coal_ore', '#232529', '#40444b');
  makeOre('iron_ore', '#d2a282', '#f1cbb0');
  makeOre('gold_ore', '#f4c634', '#fff29c');
  makeOre('diamond_ore', '#37e3e8', '#b8ffff');
  makeOre('glow_crystal', '#a855f7', '#f0abfc');

  // Crafting Table
  make('crafting_top', (t) => {
    t.data.set(tiles.oak_planks.data);
    for (let y = 2; y <= 13; y++) {
      for (let x = 2; x <= 13; x++) {
        if (x === 2 || x === 13 || y === 2 || y === 13 || x === 6 || x === 9 || y === 6 || y === 9) {
          t.setHex(x, y, '#5c3f22', 4);
        } else {
          t.setHex(x, y, '#cfa76b', 5);
        }
      }
    }
  });
  make('crafting_side', (t) => {
    t.data.set(tiles.oak_planks.data);
    for (let x = 0; x < 16; x++) {
      t.setHex(x, 0, '#6b4a28', 4);
      t.setHex(x, 1, '#7d5730', 4);
    }
    // Mini pixel saw & hammer silhouette
    for (let y = 5; y <= 12; y++) {
      t.setHex(4, y, '#593c1f', 2);
      if (y < 9) {
        t.setHex(10, y, '#cfd6de', 5);
        t.setHex(11, y, '#9ba4b0', 5);
      } else {
        t.setHex(10, y, '#6e4c29', 4);
      }
    }
    for (let x = 3; x <= 5; x++) t.setHex(x, 5, '#cfd6de', 4);
  });

  // Furnace
  make('furnace_top', (t) => {
    t.fillNoise('#787c82', 9);
    for (let i = 1; i < 15; i++) {
      t.setHex(i, 1, '#55585d', 3);
      t.setHex(i, 14, '#55585d', 3);
      t.setHex(1, i, '#55585d', 3);
      t.setHex(14, i, '#55585d', 3);
    }
  });
  make('furnace_side', (t) => {
    t.data.set(tiles.cobblestone.data);
    for (let x = 0; x < 16; x++) {
      t.setHex(x, 0, '#5a5e63', 4);
      t.setHex(x, 15, '#4b4e52', 4);
    }
  });
  make('furnace_front', (t) => {
    t.data.set(tiles.furnace_side.data);
    for (let y = 4; y <= 13; y++) {
      for (let x = 4; x <= 11; x++) {
        if (y >= 10) {
          t.setHex(x, y, (x + y) % 2 === 0 ? '#ff9924' : '#ff5719', 8);
        } else {
          t.setHex(x, y, '#26282c', 4);
        }
      }
    }
  });

  // Glass
  make('glass', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const border = x === 0 || x === 15 || y === 0 || y === 15;
        const streak = (x + y === 5) || (x + y === 6) || (x + y === 21);
        if (border) {
          t.set(x, y, 212, 240, 252, 245);
        } else if (streak) {
          t.set(x, y, 235, 250, 255, 210);
        } else {
          t.set(x, y, 0, 0, 0, 0);
        }
      }
    }
  });

  // Stone Bricks
  make('stone_bricks', (t) => {
    t.fillNoise('#85898e', 8);
    for (let x = 0; x < 16; x++) {
      t.setHex(x, 0, '#55585c', 3);
      t.setHex(x, 8, '#55585c', 3);
      t.setHex(x, 1, '#9ea3a8', 3);
      t.setHex(x, 9, '#9ea3a8', 3);
    }
    for (let y = 0; y < 8; y++) t.setHex(8, y, '#55585c', 3);
    for (let y = 8; y < 16; y++) t.setHex(0, y, '#55585c', 3);
  });

  // Clay Bricks
  make('bricks', (t) => {
    t.fillNoise('#a64d3d', 11);
    for (const row of [3, 7, 11, 15]) {
      for (let x = 0; x < 16; x++) t.setHex(x, row, '#cfc5b8', 5);
    }
    for (let r = 0; r < 4; r++) {
      const off = r % 2 === 0 ? 0 : 4;
      for (let x = off; x < 16; x += 8) {
        for (let dy = 0; dy < 3; dy++) t.setHex(x, r * 4 + dy, '#cfc5b8', 4);
      }
    }
  });

  // Bookshelf
  make('bookshelf', (t) => {
    t.data.set(tiles.oak_planks.data);
    const colors = ['#b93838', '#2f6fb3', '#3b8c47', '#c28d2b', '#7b42a6'];
    for (const shelfY of [3, 9]) {
      for (let x = 1; x < 15; x++) {
        const col = colors[(x * 3 + shelfY) % colors.length];
        for (let dy = 0; dy < 5; dy++) {
          t.setHex(x, shelfY + dy, dy === 1 ? '#ece5d3' : col, 8);
        }
      }
    }
  });

  // Wool
  make('wool', (t) => {
    t.fillNoise('#f3f4f6', 10, '#e3e6eb', 0.35);
  });

  // Torch
  make('torch', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x >= 6 && x <= 9 && y >= 3) {
          if (y <= 5) {
            t.setHex(x, y, y === 3 ? '#fff7b2' : '#ff991f', 6);
          } else if (y === 6) {
            t.setHex(x, y, '#382c21', 4);
          } else {
            t.setHex(x, y, '#966c3e', 8);
          }
        } else {
          t.set(x, y, 0, 0, 0, 0);
        }
      }
    }
  });

  // Lantern
  make('lantern', (t) => {
    for (let y = 2; y < 16; y++) {
      for (let x = 3; x <= 12; x++) {
        const frame = x === 3 || x === 12 || y <= 4 || y >= 14;
        t.setHex(x, y, frame ? '#3a404a' : '#ffcf5c', frame ? 5 : 10);
      }
    }
  });

  // TNT
  make('tnt_side', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y >= 5 && y <= 10) {
          const dark = (y >= 7 && y <= 9 && (x % 4 === 1 || x % 4 === 2));
          t.setHex(x, y, dark ? '#222222' : '#f3f3f3', 4);
        } else {
          t.setHex(x, y, x % 4 === 0 ? '#b62822' : '#db362d', 8);
        }
      }
    }
  });
  make('tnt_top', (t) => {
    t.fillNoise('#c93129', 9);
    t.setHex(7, 7, '#2a2a2a', 2);
    t.setHex(8, 7, '#e8e8e8', 2);
    t.setHex(7, 8, '#e8e8e8', 2);
    t.setHex(8, 8, '#2a2a2a', 2);
  });
  make('tnt_bottom', (t) => {
    t.fillNoise('#ab2822', 9);
  });

  // Chest
  make('chest_top', (t) => {
    t.fillNoise('#a6773b', 9);
    for (let i = 0; i < 16; i++) {
      t.setHex(i, 0, '#5a3d1c', 3);
      t.setHex(i, 15, '#5a3d1c', 3);
      t.setHex(0, i, '#5a3d1c', 3);
      t.setHex(15, i, '#5a3d1c', 3);
    }
  });
  make('chest_side', (t) => {
    t.data.set(tiles.chest_top.data);
    for (let x = 0; x < 16; x++) t.setHex(x, 5, '#3b2812', 2);
  });
  make('chest_front', (t) => {
    t.data.set(tiles.chest_side.data);
    for (let y = 4; y <= 7; y++) {
      t.setHex(7, y, '#dde3ea', 4);
      t.setHex(8, y, '#b8c1cc', 4);
    }
  });

  // Flora (Cross-quad X-meshes)
  make('tall_grass', (t) => {
    const blades = [2, 4, 6, 8, 10, 12, 14];
    for (const bx of blades) {
      const top = 4 + ((t.rng() * 6) | 0);
      for (let y = top; y < 16; y++) {
        const sway = y < top + 3 ? ((bx % 4 === 0) ? -1 : 1) : 0;
        t.setHex(bx + sway, y, y < top + 2 ? '#8ed457' : '#65ab3b', 10);
      }
    }
  });

  const makeFlower = (name, petalHex, centerHex) => {
    make(name, (t) => {
      for (let y = 8; y < 16; y++) {
        t.setHex(7, y, '#478f2e', 5);
        if (y === 12) {
          t.setHex(6, y, '#478f2e', 4);
          t.setHex(8, y - 1, '#478f2e', 4);
        }
      }
      for (let py = 4; py <= 8; py++) {
        for (let px = 5; px <= 9; px++) {
          const dist = Math.abs(px - 7) + Math.abs(py - 6);
          if (dist === 0) t.setHex(px, py, centerHex, 4);
          else if (dist <= 2) t.setHex(px, py, petalHex, 8);
        }
      }
    });
  };
  makeFlower('red_flower', '#e63333', '#f5d142');
  makeFlower('yellow_flower', '#f7d42a', '#e88b1a');
  makeFlower('blue_flower', '#38a3f5', '#dff4ff');

  make('dead_bush', (t) => {
    for (let y = 7; y < 16; y++) t.setHex(7, y, '#87633b', 6);
    const twigs = [[5, 8], [6, 9], [9, 8], [8, 10], [4, 6], [5, 7], [10, 6], [9, 7]];
    for (const [tx, ty] of twigs) t.setHex(tx, ty, '#967046', 6);
  });

  make('glow_mushroom', (t) => {
    for (let y = 10; y < 16; y++) {
      t.setHex(7, y, '#c7d2fe', 5);
      t.setHex(8, y, '#a5b4fc', 5);
    }
    for (let py = 6; py <= 10; py++) {
      const half = py === 6 ? 2 : py <= 8 ? 4 : 5;
      for (let px = 7 - half; px <= 8 + half - 1; px++) {
        const spot = (px + py) % 4 === 0;
        t.setHex(px, py, spot ? '#67e8f9' : '#8b5cf6', 6);
      }
    }
  });

  return tiles;
}

// Render isometric 3D block icon or pixel sprite for UI
function createItemIcons(tiles) {
  const iconUrls = {};
  const itemPixels = {};

  // Helper to convert 16x16 PixelTile to ImageData canvas
  const tileCanvases = {};
  for (const [key, tile] of Object.entries(tiles)) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(16, 16);
    img.data.set(tile.data);
    ctx.putImageData(img, 0, 0);
    tileCanvases[key] = c;
  }

  // Render flat scaled sprite
  const makeFlatIcon = (drawFn) => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx);
    return c.toDataURL();
  };

  // Render crisp 3-face isometric voxel block icon
  const makeIsoBlockIcon = (topKey, leftKey, rightKey, tintTop = false, tintAll = false) => {
    const c = document.createElement('canvas');
    c.width = 36;
    c.height = 36;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const getTinted = (src, rMul, gMul, bMul) => {
      const tmp = document.createElement('canvas');
      tmp.width = 16;
      tmp.height = 16;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(src, 0, 0);
      const id = tctx.getImageData(0, 0, 16, 16);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clampByte(d[i] * rMul);
        d[i + 1] = clampByte(d[i + 1] * gMul);
        d[i + 2] = clampByte(d[i + 2] * bMul);
      }
      tctx.putImageData(id, 0, 0);
      return tmp;
    };

    const gTint = (tintTop || tintAll) ? [0.85, 1.06, 0.78] : [1, 1, 1];
    const sTint = tintAll ? [0.85, 1.06, 0.78] : [1, 1, 1];

    const topImg = getTinted(tileCanvases[topKey], gTint[0], gTint[1], gTint[2]);
    const leftImg = getTinted(tileCanvases[leftKey], 0.84 * sTint[0], 0.84 * sTint[1], 0.84 * sTint[2]);
    const rightImg = getTinted(tileCanvases[rightKey], 0.66 * sTint[0], 0.66 * sTint[1], 0.66 * sTint[2]);

    // Top diamond
    ctx.save();
    ctx.setTransform(0.88, 0.44, -0.88, 0.44, 18, 3);
    ctx.drawImage(topImg, 0, 0, 16, 16);
    ctx.restore();

    // Left face
    ctx.save();
    ctx.setTransform(0.88, 0.44, 0, 0.95, 3.9, 10.1);
    ctx.drawImage(leftImg, 0, 0, 16, 16);
    ctx.restore();

    // Right face
    ctx.save();
    ctx.setTransform(0.88, -0.44, 0, 0.95, 18, 17.1);
    ctx.drawImage(rightImg, 0, 0, 16, 16);
    ctx.restore();

    return c.toDataURL();
  };

  // Paint custom 16x16 pixel sprite for tools/items
  const paintSprite16 = (id, pixels) => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    for (const [x, y, color] of pixels) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
    itemPixels[id] = ctx.getImageData(0, 0, 16, 16).data;
    const out = document.createElement('canvas');
    out.width = 32;
    out.height = 32;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(c, 0, 0, 32, 32);
    iconUrls[id] = out.toDataURL();
  };

  // Tool generator helper
  const makeToolIcon = (kind, headMain, headHi, headDark) => {
    const px = [];
    const handle = '#8b5e34';
    const handleDark = '#624020';
    // Diagonal wooden handle from bottom-left (2,13) to (11,4)
    const maxLen = kind === 'sword' ? 5 : 10;
    for (let i = 0; i < maxLen; i++) {
      px.push([2 + i, 13 - i, i % 2 === 0 ? handle : handleDark]);
      if (i < maxLen - 1) px.push([3 + i, 13 - i, handleDark]);
    }
    if (kind === 'pickaxe') {
      const head = [
        [7, 2, headHi], [8, 2, headMain], [9, 2, headMain], [10, 2, headHi], [11, 3, headMain],
        [12, 4, headMain], [13, 5, headMain], [13, 6, headDark], [13, 7, headDark], [12, 8, headDark],
        [6, 3, headDark], [8, 3, headMain], [9, 3, headDark], [10, 3, headMain], [11, 4, headMain], [12, 5, headMain],
      ];
      px.push(...head);
    } else if (kind === 'axe') {
      const head = [
        [7, 2, headHi], [8, 2, headHi], [9, 2, headMain],
        [6, 3, headHi], [7, 3, headMain], [8, 3, headMain], [9, 3, headMain], [10, 3, headDark],
        [6, 4, headMain], [7, 4, headMain], [8, 4, headDark], [10, 4, headMain], [11, 5, headDark],
        [7, 5, headDark], [8, 5, headDark], [11, 6, headDark],
      ];
      px.push(...head);
    } else if (kind === 'shovel') {
      const head = [
        [10, 2, headHi], [11, 2, headHi], [12, 2, headMain], [13, 3, headMain],
        [10, 3, headMain], [11, 3, headMain], [12, 3, headMain], [13, 4, headDark],
        [11, 4, headMain], [12, 4, headDark], [12, 5, headDark],
      ];
      px.push(...head);
    } else if (kind === 'sword') {
      // Crossguard
      px.push([4, 9, handleDark], [5, 10, handle], [6, 11, handleDark], [3, 8, handleDark], [7, 12, handleDark]);
      // Blade
      for (let i = 0; i < 8; i++) {
        px.push([6 + i, 9 - i, headHi]);
        px.push([7 + i, 9 - i, headMain]);
        if (i < 7) px.push([7 + i, 10 - i, headDark]);
      }
    }
    return px;
  };

  // Generate icons for every entry in REGISTRY
  for (const def of Object.values(REGISTRY)) {
    if (def.id === BLOCK.AIR) continue;
    if (def.isBlock) {
      if (def.renderType === 'cross' || def.renderType === 'torch' || def.renderType === 'lantern') {
        const key = def.textures.all;
        itemPixels[def.id] = tiles[key].data;
        iconUrls[def.id] = makeFlatIcon((ctx) => {
          ctx.drawImage(tileCanvases[key], 2, 2, 28, 28);
        });
      } else {
        const tex = def.textures;
        const top = tex.top || tex.all;
        const left = tex.front || tex.side || tex.all;
        const right = tex.side || tex.all;
        iconUrls[def.id] = makeIsoBlockIcon(top, left, right, def.tintTop, def.tintAll);
      }
    }
  }

  // Non-block items
  const stickPx = [];
  for (let i = 0; i < 11; i++) {
    stickPx.push([3 + i, 13 - i, '#a47443']);
    stickPx.push([4 + i, 13 - i, '#75502b']);
  }
  paintSprite16(ITEM.STICK, stickPx);

  const makeGemOrIngot = (id, shape, c1, c2, c3) => {
    const px = [];
    if (shape === 'coal') {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if ((x - 7.5) ** 2 + (y - 8) ** 2 <= 15) {
            px.push([x, y, x + y < 14 ? c1 : (x + y > 17 ? c3 : c2)]);
          }
        }
      }
    } else if (shape === 'ingot') {
      for (let y = 5; y <= 10; y++) {
        const shift = (8 - y) >> 1;
        for (let x = 3 + shift; x <= 12 + shift; x++) {
          const border = y === 5 || y === 10 || x === 3 + shift || x === 12 + shift;
          px.push([x, y, border ? c3 : (y <= 7 ? c1 : c2)]);
        }
      }
    } else if (shape === 'diamond') {
      for (let y = 3; y <= 13; y++) {
        for (let x = 3; x <= 12; x++) {
          const d = Math.abs(x - 7.5) + Math.abs(y - 8);
          if (d <= 5.2) px.push([x, y, d < 2.2 ? c1 : (d > 4.1 ? c3 : c2)]);
        }
      }
    } else if (shape === 'dust') {
      for (let y = 5; y <= 12; y++) {
        const w = Math.max(1, (y - 3) >> 1);
        for (let x = 8 - w; x <= 7 + w; x++) {
          px.push([x, y, (x + y) % 2 === 0 ? c1 : c2]);
        }
      }
    }
    paintSprite16(id, px);
  };

  makeGemOrIngot(ITEM.COAL, 'coal', '#484c54', '#2a2d33', '#17181c');
  makeGemOrIngot(ITEM.IRON_INGOT, 'ingot', '#f3f6fa', '#cfd6e0', '#8d96a3');
  makeGemOrIngot(ITEM.GOLD_INGOT, 'ingot', '#fff394', '#f7c931', '#b88414');
  makeGemOrIngot(ITEM.DIAMOND, 'diamond', '#d4ffff', '#3be6eb', '#1896a8');
  makeGemOrIngot(ITEM.GLOW_DUST, 'dust', '#f5d0fe', '#c084fc', '#7e22ce');

  // Tools
  const tiers = [
    ['WOOD', '#caa063', '#dec08e', '#856235'],
    ['STONE', '#9ca2a8', '#bfc5cc', '#676c72'],
    ['IRON', '#dce3ec', '#f7faff', '#949eab'],
    ['DIAMOND', '#3be6eb', '#c8ffff', '#1998a8'],
  ];
  for (const [tier, main, hi, dark] of tiers) {
    paintSprite16(ITEM[`${tier}_PICKAXE`], makeToolIcon('pickaxe', main, hi, dark));
    paintSprite16(ITEM[`${tier}_AXE`], makeToolIcon('axe', main, hi, dark));
    paintSprite16(ITEM[`${tier}_SHOVEL`], makeToolIcon('shovel', main, hi, dark));
    paintSprite16(ITEM[`${tier}_SWORD`], makeToolIcon('sword', main, hi, dark));
  }
  paintSprite16(ITEM.GOLD_PICKAXE, makeToolIcon('pickaxe', '#f7c931', '#fff5a6', '#b58112'));

  // Food sprites
  const applePx = [[8, 2, '#6d4c2b'], [8, 3, '#4f9e34'], [9, 3, '#4f9e34']];
  for (let y = 4; y <= 12; y++) {
    for (let x = 4; x <= 11; x++) {
      if ((x - 7.5) ** 2 + (y - 8) ** 2 <= 16) {
        applePx.push([x, y, (x === 5 && y <= 7) ? '#ff8a8a' : (x > 9 ? '#b52222' : '#e03131')]);
      }
    }
  }
  paintSprite16(ITEM.APPLE, applePx);

  const makeMeat = (id, main, fat, dark) => {
    const px = [];
    for (let y = 4; y <= 11; y++) {
      for (let x = 3; x <= 12; x++) {
        if ((x - 7.5) ** 2 * 0.7 + (y - 7.5) ** 2 <= 14) {
          const streak = (x + y === 12 || x + y === 13);
          px.push([x, y, streak ? fat : (y >= 10 ? dark : main)]);
        }
      }
    }
    paintSprite16(id, px);
  };
  makeMeat(ITEM.RAW_MEAT, '#e36464', '#f7dada', '#ad3e3e');
  makeMeat(ITEM.COOKED_STEAK, '#8c4c27', '#cfa07a', '#592d14');
  makeMeat(ITEM.BREAD, '#d99b38', '#f0c469', '#9c671c');

  return { iconUrls, itemPixels };
}

// Progressive mining crack textures (stages 0..7)
function buildCrackMaterials() {
  const materials = [];
  for (let stage = 0; stage < 8; stage++) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(18, 20, 24, 0.78)';
    ctx.lineWidth = 1.25;
    const branches = 2 + stage * 2;
    const rng = mulberry32(900 + stage);
    for (let b = 0; b < branches; b++) {
      ctx.beginPath();
      ctx.moveTo(8, 8);
      const angle = (b / branches) * Math.PI * 2 + rng() * 0.4;
      const dist = 2 + stage * 1.15;
      ctx.lineTo(8 + Math.cos(angle) * dist, 8 + Math.sin(angle) * dist);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    materials.push(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
  }
  return materials;
}

export function createTextureAtlas() {
  const tiles = buildBlockTiles();
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');

  const uvMap = {};
  const keys = Object.keys(tiles);

  keys.forEach((name, idx) => {
    const gx = idx % GRID;
    const gy = Math.floor(idx / GRID);
    const slotX = gx * SLOT_SIZE;
    const slotY = gy * SLOT_SIZE;
    const tile = tiles[name];

    // Write 16x16 + 8px extruded gutter on all 4 sides into 32x32 slot
    const slotImg = ctx.createImageData(SLOT_SIZE, SLOT_SIZE);
    for (let sy = 0; sy < SLOT_SIZE; sy++) {
      const ty = Math.max(0, Math.min(TILE_SIZE - 1, sy - PAD));
      for (let sx = 0; sx < SLOT_SIZE; sx++) {
        const tx = Math.max(0, Math.min(TILE_SIZE - 1, sx - PAD));
        const srcIdx = (ty * TILE_SIZE + tx) * 4;
        const dstIdx = (sy * SLOT_SIZE + sx) * 4;
        slotImg.data[dstIdx] = tile.data[srcIdx];
        slotImg.data[dstIdx + 1] = tile.data[srcIdx + 1];
        slotImg.data[dstIdx + 2] = tile.data[srcIdx + 2];
        slotImg.data[dstIdx + 3] = tile.data[srcIdx + 3];
      }
    }
    ctx.putImageData(slotImg, slotX, slotY);

    // Exact UV bounds of the inner 16x16 region (with flipY = false)
    const eps = 0.02 / ATLAS_SIZE;
    uvMap[name] = {
      u0: (slotX + PAD) / ATLAS_SIZE + eps,
      v0: (slotY + PAD) / ATLAS_SIZE + eps,
      u1: (slotX + PAD + TILE_SIZE) / ATLAS_SIZE - eps,
      v1: (slotY + PAD + TILE_SIZE) / ATLAS_SIZE - eps,
    };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // Custom Voxel Chunk ShaderMaterial supporting SkyLight + Warm Torch BlockLight + Smooth AO + Fog
  const sharedUniforms = {
    uMap: { value: texture },
    uSunLevel: { value: 1.0 },
    uSkyTint: { value: new THREE.Color(1, 1, 1) },
    uTorchTint: { value: new THREE.Color(1.0, 0.84, 0.56) },
    uFogColor: { value: new THREE.Color(0.62, 0.82, 0.98) },
    uFogNear: { value: 48.0 },
    uFogFar: { value: 92.0 },
    uTime: { value: 0.0 },
    uUnderwater: { value: 0.0 },
  };

  const solidMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    side: THREE.FrontSide,
    vertexShader: `
      attribute vec3 aColor;
      attribute vec2 aLight;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vLight;
      varying float vDist;
      void main() {
        vUv = uv;
        vColor = aColor;
        vLight = aLight;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uSunLevel;
      uniform vec3 uSkyTint;
      uniform vec3 uTorchTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uTime;
      uniform float uUnderwater;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vLight;
      varying float vDist;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.45) discard;

        float skyLit = vLight.x * uSunLevel;
        float flicker = 0.97 + 0.03 * sin(uTime * 7.5 + vUv.x * 12.0);
        float blkLit = vLight.y * flicker;

        vec3 skyContrib = uSkyTint * max(skyLit, 0.065);
        vec3 torchContrib = uTorchTint * (blkLit * blkLit * 1.15);
        vec3 totalLight = max(skyContrib, torchContrib) + min(skyContrib, torchContrib) * 0.32;

        vec3 col = tex.rgb * vColor * totalLight;
        if (uUnderwater > 0.5) {
          col = mix(col, vec3(0.08, 0.34, 0.56), 0.35);
        }

        float fogFactor = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFogColor, fogFactor);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  // Double-sided material variant for cross-quad flora & leaves/glass if needed, or chunk mesher emits both sides for cross-quads!
  // Emitting both sides for cross-quads in ChunkMesher keeps the entire solid chunk to a SINGLE draw call with Backface Culling enabled!

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aColor;
      attribute vec2 aLight;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vLight;
      varying float vDist;
      varying float vWave;
      uniform float uTime;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vUv = uv + vec2(
          sin(uTime * 1.5 + worldPos.z * 0.8) * 0.011,
          cos(uTime * 1.2 + worldPos.x * 0.8) * 0.011
        );
        vColor = aColor;
        vLight = aLight;
        vec3 pos = position;
        float w = sin(uTime * 2.2 + worldPos.x * 0.85 + worldPos.z * 0.65);
        vWave = w;
        pos.y += w * 0.035;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vDist = length(mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uSunLevel;
      uniform vec3 uSkyTint;
      uniform vec3 uTorchTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vLight;
      varying float vDist;
      varying float vWave;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float skyLit = max(vLight.x * uSunLevel, 0.14);
        vec3 light = max(uSkyTint * skyLit, uTorchTint * vLight.y);
        vec3 crest = vec3(0.08, 0.12, 0.16) * max(0.0, vWave) * uSunLevel;
        vec3 waterBase = (tex.rgb * vColor + crest) * light;
        float fogFactor = smoothstep(uFogNear, uFogFar, vDist);
        vec3 col = mix(waterBase, uFogColor, fogFactor);
        gl_FragColor = vec4(col, mix(0.76, 0.94, fogFactor));
      }
    `,
  });

  const { iconUrls, itemPixels } = createItemIcons(tiles);
  const crackMaterials = buildCrackMaterials();

  // Also grab average RGB color per block for crisp break particles!
  const blockColors = {};
  for (const def of Object.values(REGISTRY)) {
    if (!def.isBlock || def.id === BLOCK.AIR) continue;
    const key = def.textures?.side || def.textures?.all || def.textures?.top;
    const tile = tiles[key];
    if (tile) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < tile.data.length; i += 4) {
        if (tile.data[i + 3] > 100) {
          r += tile.data[i];
          g += tile.data[i + 1];
          b += tile.data[i + 2];
          n++;
        }
      }
      if (n > 0) {
        blockColors[def.id] = new THREE.Color(r / (255 * n), g / (255 * n), b / (255 * n));
      }
    }
  }

  return {
    texture,
    uvMap,
    iconUrls,
    itemPixels,
    solidMaterial,
    waterMaterial,
    sharedUniforms,
    crackMaterials,
    blockColors,
  };
}
