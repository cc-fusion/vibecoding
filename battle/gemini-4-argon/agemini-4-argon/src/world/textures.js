import * as THREE from 'three';
import { mulberry32 } from '../utils/noise.js';
import { REGISTRY } from './blocks.js';
import { RENDER_TYPE as RT } from './constants.js';

const TILE_SIZE = 16;
const PAD = 8;
const CELL_SIZE = TILE_SIZE + PAD * 2; // 32px per cell
const ATLAS_COLS = 12;
const ATLAS_ROWS = 8;
const ATLAS_W = ATLAS_COLS * CELL_SIZE; // 384
const ATLAS_H = ATLAS_ROWS * CELL_SIZE; // 256

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function clampByte(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function shade(rgb, delta) {
  return [clampByte(rgb[0] + delta), clampByte(rgb[1] + delta), clampByte(rgb[2] + delta)];
}

function mixRgb(a, b, t) {
  return [
    clampByte(a[0] + (b[0] - a[0]) * t),
    clampByte(a[1] + (b[1] - a[1]) * t),
    clampByte(a[2] + (b[2] - a[2]) * t),
  ];
}

// Create a 16x16 RGBA pixel buffer helper
class PixelTile {
  constructor() {
    this.data = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
  }

  set(x, y, rgb, a = 255) {
    if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
    const i = (y * TILE_SIZE + x) * 4;
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = a;
  }

  get(x, y) {
    const cx = Math.max(0, Math.min(TILE_SIZE - 1, x));
    const cy = Math.max(0, Math.min(TILE_SIZE - 1, y));
    const i = (cy * TILE_SIZE + cx) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  fillNoise(baseHex, variance = 14, seed = 1, alpha = 255) {
    const rng = mulberry32(seed);
    const base = hexToRgb(baseHex);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = (rng() - 0.5) * 2 * variance;
        this.set(x, y, shade(base, d), alpha);
      }
    }
    return this;
  }

  rect(x0, y0, w, h, rgb, a = 255) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.set(x, y, rgb, a);
      }
    }
    return this;
  }
}

function buildAllTiles() {
  const tiles = new Map();
  const make = (name, fn) => {
    const t = new PixelTile();
    fn(t);
    tiles.set(name, t);
    return t;
  };

  // Grass top: lush emerald pixel mottling
  make('grass_top', (t) => {
    const rng = mulberry32(101);
    const c1 = hexToRgb('#59ad3b');
    const c2 = hexToRgb('#4b9831');
    const c3 = hexToRgb('#6ec247');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = rng();
        const col = r < 0.28 ? c2 : r > 0.76 ? c3 : c1;
        t.set(x, y, shade(col, (rng() - 0.5) * 10));
      }
    }
  });

  // Dirt: warm earthy soil with tiny pebbles
  const dirtTile = make('dirt', (t) => {
    const rng = mulberry32(102);
    const base = hexToRgb('#7d5738');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = rng();
        let col = shade(base, (rng() - 0.5) * 20);
        if (r > 0.92) col = hexToRgb('#967153');
        else if (r < 0.08) col = hexToRgb('#5e3f26');
        t.set(x, y, col);
      }
    }
  });

  // Grass side: dirt with overhanging green grass fringe
  make('grass_side', (t) => {
    t.data.set(dirtTile.data);
    const rng = mulberry32(103);
    const g1 = hexToRgb('#59ad3b');
    const g2 = hexToRgb('#468d2d');
    for (let x = 0; x < 16; x++) {
      const overhang = 2 + Math.floor(rng() * 3.5);
      for (let y = 0; y < overhang; y++) {
        t.set(x, y, y === overhang - 1 ? g2 : shade(g1, (rng() - 0.5) * 14));
      }
    }
  });

  // Podzol
  make('podzol_top', (t) => {
    const rng = mulberry32(104);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = rng();
        const col = r < 0.35 ? hexToRgb('#4f3820') : r > 0.78 ? hexToRgb('#4c7a34') : hexToRgb('#66492a');
        t.set(x, y, shade(col, (rng() - 0.5) * 12));
      }
    }
  });

  make('podzol_side', (t) => {
    t.data.set(dirtTile.data);
    const rng = mulberry32(105);
    for (let x = 0; x < 16; x++) {
      const overhang = 2 + Math.floor(rng() * 3);
      for (let y = 0; y < overhang; y++) {
        t.set(x, y, shade(hexToRgb('#594024'), (rng() - 0.5) * 14));
      }
    }
  });

  // Stone: stratified natural rock
  const stoneTile = make('stone', (t) => {
    const rng = mulberry32(106);
    const base = hexToRgb('#7f848c');
    for (let y = 0; y < 16; y++) {
      const rowShift = ((y % 4 === 0) ? -7 : (y % 4 === 2 ? 5 : 0));
      for (let x = 0; x < 16; x++) {
        const streak = Math.sin((x + y * 2) * 0.6) * 5;
        t.set(x, y, shade(base, rowShift + streak + (rng() - 0.5) * 16));
      }
    }
  });

  make('smooth_stone', (t) => {
    t.fillNoise('#9da3ab', 8, 107);
    const border = hexToRgb('#767b82');
    for (let i = 0; i < 16; i++) {
      t.set(i, 0, border);
      t.set(0, i, border);
      t.set(i, 15, hexToRgb('#b6bcc4'));
      t.set(15, i, hexToRgb('#b6bcc4'));
    }
  });

  // Cobblestone: irregular mortared stones
  const cobbleTile = make('cobblestone', (t) => {
    const rng = mulberry32(108);
    const centers = [
      [3, 3], [10, 2], [14, 6], [5, 8], [11, 10], [2, 13], [8, 14], [14, 14],
    ];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let d1 = 999, d2 = 999, idx = 0;
        for (let c = 0; c < centers.length; c++) {
          let dx = Math.abs(x - centers[c][0]);
          let dy = Math.abs(y - centers[c][1]);
          dx = Math.min(dx, 16 - dx);
          dy = Math.min(dy, 16 - dy);
          const dist = Math.hypot(dx, dy);
          if (dist < d1) { d2 = d1; d1 = dist; idx = c; }
          else if (dist < d2) { d2 = dist; }
        }
        const edge = d2 - d1 < 0.85;
        const base = edge ? hexToRgb('#4c5057') : shade(hexToRgb('#797e86'), ((idx % 3) - 1) * 11 + (rng() - 0.5) * 10);
        t.set(x, y, base);
      }
    }
  });

  make('mossy_cobble', (t) => {
    t.data.set(cobbleTile.data);
    const rng = mulberry32(109);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const px = t.get(x, y);
        if (px[0] < 90 || rng() < 0.25) {
          t.set(x, y, shade(hexToRgb('#4e823b'), (rng() - 0.5) * 18));
        }
      }
    }
  });

  make('deepslate', (t) => {
    const rng = mulberry32(110);
    const base = hexToRgb('#434752');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const diag = ((x + y) % 5 === 0) ? -9 : 3;
        t.set(x, y, shade(base, diag + (rng() - 0.5) * 14));
      }
    }
  });

  make('bedrock', (t) => {
    const rng = mulberry32(111);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = rng() < 0.35 ? '#1c1e22' : rng() < 0.7 ? '#34373f' : '#50545e';
        t.set(x, y, hexToRgb(v));
      }
    }
  });

  make('sand', (t) => {
    const rng = mulberry32(112);
    const base = hexToRgb('#e3d49b');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x * 0.5 + y * 0.9)) * 6;
        t.set(x, y, shade(base, wave + (rng() - 0.5) * 12));
      }
    }
  });

  make('sandstone_top', (t) => t.fillNoise('#dfd094', 9, 113));
  make('sandstone_bottom', (t) => t.fillNoise('#cbb97d', 12, 114));
  make('sandstone_side', (t) => {
    t.fillNoise('#d8c78b', 8, 115);
    t.rect(0, 0, 16, 3, hexToRgb('#e7da9f'));
    t.rect(0, 3, 16, 1, hexToRgb('#baa76d'));
    t.rect(0, 12, 16, 1, hexToRgb('#baa76d'));
  });

  make('gravel', (t) => {
    const rng = mulberry32(116);
    const cols = ['#75706d', '#8e8884', '#635f5c', '#9e9792'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        t.set(x, y, hexToRgb(cols[Math.floor(rng() * cols.length)]));
      }
    }
  });

  make('clay', (t) => t.fillNoise('#9aa4b5', 11, 117));
  make('snow', (t) => t.fillNoise('#f2f7fc', 7, 118));
  make('snow_side', (t) => {
    t.data.set(dirtTile.data);
    const rng = mulberry32(119);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < h; y++) {
        t.set(x, y, y === h - 1 ? hexToRgb('#d0e2f2') : hexToRgb('#f3f8fd'));
      }
    }
  });

  make('ice', (t) => {
    t.fillNoise('#8ec6f5', 9, 120, 235);
    const streak = hexToRgb('#bce0ff');
    for (let i = 2; i < 14; i++) {
      t.set(i, 15 - i, streak, 245);
      if (i < 11) t.set(i + 3, 13 - i, streak, 245);
    }
  });

  // Logs, Planks & Leaves helper
  const makeBark = (name, cMain, cDark, cLight, seed, birch = false) => {
    make(name, (t) => {
      const rng = mulberry32(seed);
      const main = hexToRgb(cMain);
      const dark = hexToRgb(cDark);
      const light = hexToRgb(cLight);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (birch) {
            let col = shade(main, (rng() - 0.5) * 10);
            if ((y % 5 === 1 && (x + y) % 7 < 3) || rng() < 0.05) col = dark;
            t.set(x, y, col);
          } else {
            const groove = x % 4 === 0 ? dark : x % 4 === 2 ? light : main;
            t.set(x, y, shade(groove, (rng() - 0.5) * 14));
          }
        }
      }
    });
  };

  const makeLogTop = (name, barkHex, coreHex, ringHex) => {
    make(name, (t) => {
      const bark = hexToRgb(barkHex);
      const core = hexToRgb(coreHex);
      const ring = hexToRgb(ringHex);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          if (d >= 6.5) t.set(x, y, bark);
          else if (Math.round(d) % 2 === 0) t.set(x, y, ring);
          else t.set(x, y, core);
        }
      }
    });
  };

  const makePlanks = (name, hex, seed) => {
    make(name, (t) => {
      const rng = mulberry32(seed);
      const base = hexToRgb(hex);
      const seam = shade(base, -32);
      for (let y = 0; y < 16; y++) {
        const plankRow = Math.floor(y / 4);
        const jointX = (plankRow * 7 + 3) % 16;
        for (let x = 0; x < 16; x++) {
          if (y % 4 === 3 || x === jointX) {
            t.set(x, y, seam);
          } else {
            t.set(x, y, shade(base, (rng() - 0.5) * 14 + (plankRow % 2) * 5));
          }
        }
      }
    });
  };

  const makeLeaves = (name, hex1, hex2, seed) => {
    make(name, (t) => {
      const rng = mulberry32(seed);
      const c1 = hexToRgb(hex1);
      const c2 = hexToRgb(hex2);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rng();
          if (r < 0.14 && x > 0 && x < 15 && y > 0 && y < 15) {
            t.set(x, y, [0, 0, 0], 0); // subtle dappled leaf gaps
          } else {
            t.set(x, y, shade(r > 0.55 ? c1 : c2, (rng() - 0.5) * 18), 255);
          }
        }
      }
    });
  };

  makeBark('oak_log', '#6d5132', '#4f3921', '#826340', 121);
  makeLogTop('oak_log_top', '#594127', '#b8945e', '#9c7847');
  makePlanks('oak_planks', '#b38b56', 122);
  makeLeaves('oak_leaves', '#489632', '#357824', 123);

  makeBark('birch_log', '#dedad0', '#383632', '#eae6dc', 124, true);
  makeLogTop('birch_log_top', '#cfc9be', '#d6c598', '#bfa97a');
  makePlanks('birch_planks', '#d6c496', 125);
  makeLeaves('birch_leaves', '#6aad44', '#528e32', 126);

  makeBark('pine_log', '#4a3521', '#332315', '#5c432b', 127);
  makeLogTop('pine_log_top', '#3d2b1a', '#8c6943', '#735332');
  makePlanks('pine_planks', '#7d5a38', 128);
  makeLeaves('pine_leaves', '#2e633e', '#204a2d', 129);

  // Ores overlaid on stone
  const makeOre = (name, fleckHex, hiHex, seed) => {
    make(name, (t) => {
      t.data.set(stoneTile.data);
      const rng = mulberry32(seed);
      const fleck = hexToRgb(fleckHex);
      const hi = hexToRgb(hiHex);
      const spots = [
        [3, 4], [4, 4], [4, 5],
        [10, 3], [11, 3], [10, 4],
        [6, 10], [7, 10], [7, 11], [8, 10],
        [12, 12], [13, 12], [12, 13],
      ];
      for (const [sx, sy] of spots) {
        const ox = (sx + Math.floor(rng() * 2)) % 14 + 1;
        const oy = (sy + Math.floor(rng() * 2)) % 14 + 1;
        t.set(ox, oy, rng() > 0.35 ? fleck : hi);
      }
    });
  };

  makeOre('coal_ore', '#1f2124', '#3a3d42', 130);
  makeOre('iron_ore', '#d19e7d', '#f0c8ad', 131);
  makeOre('gold_ore', '#f0be2e', '#fff08a', 132);
  makeOre('crystal_ore', '#2debe0', '#b8fffb', 133);

  // Crafting Table
  make('workbench_top', (t) => {
    t.fillNoise('#a67846', 8, 134);
    const line = hexToRgb('#593b1d');
    for (let i = 0; i < 16; i++) {
      t.set(i, 0, line); t.set(i, 15, line); t.set(0, i, line); t.set(15, i, line);
      if (i >= 3 && i <= 12) {
        t.set(i, 3, line); t.set(i, 7, line); t.set(i, 12, line);
        t.set(3, i, line); t.set(7, i, line); t.set(12, i, line);
      }
    }
  });

  make('workbench_side', (t) => {
    t.data.set(tiles.get('oak_planks').data);
    t.rect(0, 0, 16, 3, hexToRgb('#6e4926'));
    // Hanging saw/hammer silhouette
    t.rect(4, 5, 2, 7, hexToRgb('#5c3d1e'));
    t.rect(3, 5, 4, 2, hexToRgb('#bcc4cc'));
    t.rect(10, 5, 3, 6, hexToRgb('#aeb7bf'));
  });
  tiles.set('workbench_front', tiles.get('workbench_side'));

  // Furnace
  make('furnace_side', (t) => {
    t.data.set(cobbleTile.data);
    t.rect(0, 0, 16, 2, hexToRgb('#585c63'));
    t.rect(0, 14, 16, 2, hexToRgb('#585c63'));
  });

  make('furnace_front', (t) => {
    t.data.set(tiles.get('furnace_side').data);
    t.rect(3, 3, 10, 5, hexToRgb('#24262b'));
    t.rect(4, 9, 8, 5, hexToRgb('#301a12'));
    t.rect(5, 11, 6, 3, hexToRgb('#ff7b24'));
    t.rect(6, 12, 4, 2, hexToRgb('#ffd257'));
  });

  // Chest
  make('chest_top', (t) => {
    t.fillNoise('#a67338', 9, 135);
    const rim = hexToRgb('#5c3c19');
    for (let i = 0; i < 16; i++) {
      t.set(i, 0, rim); t.set(i, 15, rim); t.set(0, i, rim); t.set(15, i, rim);
    }
  });
  make('chest_side', (t) => {
    t.data.set(tiles.get('chest_top').data);
    t.rect(0, 5, 16, 2, hexToRgb('#4f3314'));
  });
  make('chest_front', (t) => {
    t.data.set(tiles.get('chest_side').data);
    t.rect(6, 4, 4, 4, hexToRgb('#e5c14c'));
    t.rect(7, 5, 2, 2, hexToRgb('#8a6d1b'));
  });

  // Bricks, Glass, Bookshelf, Wool, Crystal, Glowstone
  make('bricks', (t) => {
    const mortar = hexToRgb('#c8c1b8');
    const brick = hexToRgb('#a84e3f');
    const rng = mulberry32(136);
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7) {
          t.set(x, y, mortar);
        } else {
          t.set(x, y, shade(brick, (rng() - 0.5) * 18));
        }
      }
    }
  });

  make('glass', (t) => {
    const frame = hexToRgb('#d8f3fc');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || x === 15 || y === 0 || y === 15;
        const glint = (x === 3 && y >= 2 && y <= 5) || (y === 3 && x >= 2 && x <= 5);
        if (edge || glint) t.set(x, y, frame, 235);
        else t.set(x, y, [200, 238, 252], 32);
      }
    }
  });

  make('bookshelf', (t) => {
    t.data.set(tiles.get('oak_planks').data);
    t.rect(1, 2, 14, 5, hexToRgb('#2c1f14'));
    t.rect(1, 9, 14, 5, hexToRgb('#2c1f14'));
    const bookCols = ['#c93b3b', '#387dc9', '#3ca35c', '#d9a536', '#8d4ec9'];
    for (let row of [2, 9]) {
      for (let x = 2; x < 14; x += 2) {
        t.rect(x, row, 2, 5, hexToRgb(bookCols[(x + row) % bookCols.length]));
        t.set(x, row + 1, [240, 232, 210]);
      }
    }
  });

  make('wool', (t) => t.fillNoise('#f0ede6', 10, 137));

  make('crystal_block', (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        const col = d < 4 ? '#c7fffb' : d < 8 ? '#55f2e8' : '#26bdb3';
        t.set(x, y, hexToRgb(col));
      }
    }
  });

  make('glowstone', (t) => {
    const rng = mulberry32(138);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = rng();
        const col = r > 0.65 ? '#fff6b3' : r > 0.25 ? '#f5be49' : '#a86b24';
        t.set(x, y, hexToRgb(col));
      }
    }
  });

  // Torch & Lantern
  make('torch', (t) => {
    t.rect(7, 6, 2, 10, hexToRgb('#8a6236'));
    t.rect(6, 3, 4, 3, hexToRgb('#ff9d2e'));
    t.rect(7, 2, 2, 3, hexToRgb('#fff49c'));
  });

  make('lantern', (t) => {
    t.rect(7, 1, 2, 3, hexToRgb('#4a5059'));
    t.rect(4, 4, 8, 10, hexToRgb('#3e434c'));
    t.rect(5, 5, 6, 8, hexToRgb('#ffbe47'));
    t.rect(6, 6, 4, 6, hexToRgb('#fff3a6'));
  });

  // Water & Lava
  make('water', (t) => {
    const rng = mulberry32(139);
    const c1 = hexToRgb('#247de0');
    const c2 = hexToRgb('#47a1f5');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = (Math.sin((x + y) * 0.8) + 1) * 0.5;
        t.set(x, y, mixRgb(c1, c2, wave * 0.65 + rng() * 0.2), 185);
      }
    }
  });

  make('lava', (t) => {
    const rng = mulberry32(140);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = Math.sin(x * 0.6) * Math.cos(y * 0.6) + rng() * 0.4;
        const col = v > 0.45 ? '#ffe359' : v > -0.1 ? '#ff6a14' : '#b82909';
        t.set(x, y, hexToRgb(col), 248);
      }
    }
  });

  // Cross plants & Cactus
  make('tall_grass', (t) => {
    const blades = [2, 4, 7, 9, 12, 14];
    const g1 = hexToRgb('#4ca333');
    const g2 = hexToRgb('#67c447');
    blades.forEach((bx, idx) => {
      const top = 3 + (idx % 3) * 2;
      for (let y = top; y < 16; y++) {
        const sway = y < 8 ? (idx % 2 === 0 ? -1 : 1) : 0;
        t.set(bx + sway, y, y < top + 3 ? g2 : g1, 255);
      }
    });
  });

  const makeFlower = (name, petalHex, centerHex) => {
    make(name, (t) => {
      t.rect(7, 8, 2, 8, hexToRgb('#3e8f2c'));
      t.set(5, 11, hexToRgb('#4da638'));
      t.set(10, 12, hexToRgb('#4da638'));
      const petal = hexToRgb(petalHex);
      for (let y = 3; y <= 7; y++) {
        for (let x = 5; x <= 10; x++) {
          if ((x === 5 || x === 10) && (y === 3 || y === 7)) continue;
          t.set(x, y, petal);
        }
      }
      t.rect(7, 4, 2, 3, hexToRgb(centerHex));
    });
  };

  makeFlower('flower_red', '#e33b3b', '#f7d13b');
  makeFlower('flower_gold', '#f5c731', '#e07a1b');
  makeFlower('flower_blue', '#459af5', '#ffffff');

  make('mushroom_red', (t) => {
    t.rect(7, 10, 2, 6, hexToRgb('#e8dec8'));
    t.rect(4, 6, 8, 4, hexToRgb('#d9382e'));
    t.rect(5, 5, 6, 1, hexToRgb('#d9382e'));
    t.set(5, 7, [255, 255, 255]);
    t.set(9, 6, [255, 255, 255]);
    t.set(10, 8, [255, 255, 255]);
  });

  make('glowshroom', (t) => {
    t.rect(7, 10, 2, 6, hexToRgb('#7ee8d2'));
    t.rect(4, 6, 8, 4, hexToRgb('#26e6b8'));
    t.rect(5, 5, 6, 1, hexToRgb('#96ffea'));
    t.set(6, 7, [220, 255, 248]);
    t.set(9, 7, [220, 255, 248]);
  });

  make('dead_bush', (t) => {
    const wood = hexToRgb('#8a683c');
    t.rect(7, 10, 2, 6, wood);
    for (let i = 0; i < 5; i++) {
      t.set(7 - i, 11 - i, wood);
      t.set(8 + i, 10 - i, wood);
      if (i < 3) t.set(5 + i, 6 - i, wood);
    }
  });

  make('berry_bush', (t) => {
    const rng = mulberry32(141);
    for (let y = 3; y < 16; y++) {
      for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 9.5);
        if (d < 6.2) {
          const r = rng();
          const col = r < 0.14 ? hexToRgb('#e62e5c') : shade(hexToRgb('#35782d'), (rng() - 0.5) * 18);
          t.set(x, y, col);
        }
      }
    }
  });

  make('cactus_side', (t) => {
    const g1 = hexToRgb('#348232');
    const g2 = hexToRgb('#266325');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        t.set(x, y, x % 4 === 0 ? g2 : g1);
      }
    }
    for (let y = 2; y < 15; y += 4) {
      t.set(1, y, [225, 232, 180]);
      t.set(14, y + 1, [225, 232, 180]);
    }
  });

  make('cactus_top', (t) => {
    t.fillNoise('#3e943b', 8, 142);
    t.rect(5, 5, 6, 6, hexToRgb('#62b559'));
  });

  return tiles;
}

export class TextureManager {
  constructor() {
    this.tiles = buildAllTiles();
    this.uvMap = new Map();
    this.iconCache = new Map();
    this.atlasTexture = null;
    this.crackTextures = [];
    this.buildAtlas();
    this.buildCrackTextures();
  }

  buildAtlas() {
    const names = Array.from(this.tiles.keys());
    const rgba = new Uint8ClampedArray(ATLAS_W * ATLAS_H * 4);

    names.forEach((name, idx) => {
      const col = idx % ATLAS_COLS;
      const row = Math.floor(idx / ATLAS_COLS);
      const cellX = col * CELL_SIZE;
      const cellY = row * CELL_SIZE;
      const tile = this.tiles.get(name);

      // Blit 16x16 + extruded PAD border to eliminate UV edge bleeding
      for (let py = 0; py < CELL_SIZE; py++) {
        for (let px = 0; px < CELL_SIZE; px++) {
          const sx = Math.max(0, Math.min(TILE_SIZE - 1, px - PAD));
          const sy = Math.max(0, Math.min(TILE_SIZE - 1, py - PAD));
          const rgbaPx = tile.get(sx, sy);
          const dst = ((cellY + py) * ATLAS_W + (cellX + px)) * 4;
          rgba[dst] = rgbaPx[0];
          rgba[dst + 1] = rgbaPx[1];
          rgba[dst + 2] = rgbaPx[2];
          rgba[dst + 3] = rgbaPx[3];
        }
      }

      const u0 = (cellX + PAD) / ATLAS_W;
      const u1 = (cellX + PAD + TILE_SIZE) / ATLAS_W;
      // Note: Three.js DataTexture has flipY = false by default (row 0 = v=0)
      const v0 = (cellY + PAD) / ATLAS_H;
      const v1 = (cellY + PAD + TILE_SIZE) / ATLAS_H;
      this.uvMap.set(name, { u0, v0, u1, v1 });
    });

    const tex = new THREE.DataTexture(rgba, ATLAS_W, ATLAS_H, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;
    this.atlasTexture = tex;
  }

  getUV(texName) {
    return this.uvMap.get(texName) || this.uvMap.get('stone');
  }

  buildCrackTextures() {
    for (let stage = 0; stage < 10; stage++) {
      const buf = new Uint8ClampedArray(16 * 16 * 4);
      const rng = mulberry32(900);
      const branches = (stage + 1) * 2;
      for (let b = 0; b < branches; b++) {
        let cx = 8, cy = 8;
        const angle = (b / branches) * Math.PI * 2 + rng() * 0.5;
        const maxLen = 2 + stage * 0.9;
        for (let step = 0; step < maxLen; step++) {
          cx += Math.cos(angle + (rng() - 0.5) * 0.9);
          cy += Math.sin(angle + (rng() - 0.5) * 0.9);
          const ix = Math.round(cx), iy = Math.round(cy);
          if (ix >= 0 && ix < 16 && iy >= 0 && iy < 16) {
            const idx = (iy * 16 + ix) * 4;
            buf[idx] = 18;
            buf[idx + 1] = 18;
            buf[idx + 2] = 20;
            buf[idx + 3] = 185;
          }
        }
      }
      const tex = new THREE.DataTexture(buf, 16, 16, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this.crackTextures.push(tex);
    }
  }

  // Generate crisp 48x48 DataURL icon for UI slots & hotbar
  getIconUrl(id) {
    if (this.iconCache.has(id)) return this.iconCache.get(id);
    if (typeof document === 'undefined') return '';

    const def = REGISTRY.get(id);
    if (!def || id === 0) return '';

    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (def.isBlock) {
      if (def.renderType === RT.CROSS || def.renderType === RT.TORCH) {
        this.drawFlatTile(ctx, def.tex.side, 6, 6, 36);
      } else {
        this.drawIsoCube(ctx, def.tex.top, def.tex.front, def.tex.side);
      }
    } else {
      this.drawItemPixelArt(ctx, def);
    }

    const url = canvas.toDataURL();
    this.iconCache.set(id, url);
    return url;
  }

  // Extract 16x16 [x, y, colorHexOrRgb] list for 3D extruded first-person held items
  getItemVoxels16(id) {
    const def = REGISTRY.get(id);
    if (!def || id === 0) return [];

    if (def.isBlock) {
      const tile = this.tiles.get(def.tex.side);
      if (!tile) return [];
      const out = [];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const [r, g, b, a] = tile.get(x, y);
          if (a > 100) {
            out.push({ x, y, color: `rgb(${r},${g},${b})` });
          }
        }
      }
      return out;
    }

    const map = new Map();
    const virtualCtx = {
      fillStyle: '#ffffff',
      fillRect(rx, ry) {
        const vx = Math.round(rx / 3);
        const vy = Math.round(ry / 3);
        map.set(`${vx},${vy}`, { x: vx, y: vy, color: this.fillStyle });
      },
    };
    this.drawItemPixelArt(virtualCtx, def);
    return Array.from(map.values());
  }

  tileToCanvas(texName, brightness = 1.0) {
    const tile = this.tiles.get(texName) || this.tiles.get('stone');
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(16, 16);
    for (let i = 0; i < tile.data.length; i += 4) {
      img.data[i] = clampByte(tile.data[i] * brightness);
      img.data[i + 1] = clampByte(tile.data[i + 1] * brightness);
      img.data[i + 2] = clampByte(tile.data[i + 2] * brightness);
      img.data[i + 3] = tile.data[i + 3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  drawFlatTile(ctx, texName, x, y, size) {
    const src = this.tileToCanvas(texName, 1.05);
    ctx.drawImage(src, x, y, size, size);
  }

  drawIsoCube(ctx, topName, leftName, rightName) {
    const topC = this.tileToCanvas(topName, 1.06);
    const leftC = this.tileToCanvas(leftName, 0.86);
    const rightC = this.tileToCanvas(rightName, 0.68);

    // Top diamond
    ctx.save();
    ctx.transform(1.15, 0.57, -1.15, 0.57, 24, 5);
    ctx.drawImage(topC, 0, 0, 16, 16);
    ctx.restore();

    // Left face
    ctx.save();
    ctx.transform(1.15, 0.57, 0, 1.22, 5.6, 14.1);
    ctx.drawImage(leftC, 0, 0, 16, 16);
    ctx.restore();

    // Right face
    ctx.save();
    ctx.transform(1.15, -0.57, 0, 1.22, 24, 23.2);
    ctx.drawImage(rightC, 0, 0, 16, 16);
    ctx.restore();
  }

  drawItemPixelArt(ctx, def) {
    const p = 3; // 16x16 virtual grid -> 48x48
    const px = (x, y, hex) => {
      ctx.fillStyle = hex;
      ctx.fillRect(x * p, y * p, p, p);
    };

    const handle = '#7a542e';
    const handleHi = '#9c6e3e';
    const col = def.color || '#cbd5e1';
    const rgb = hexToRgb(col);
    const hi = `rgb(${ shade(rgb, 38).join(',') })`;
    const lo = `rgb(${ shade(rgb, -35).join(',') })`;

    const icon = def.icon || '';

    if (icon.startsWith('pickaxe_')) {
      for (let i = 2; i <= 11; i++) px(i, 15 - i, i % 2 ? handle : handleHi);
      const head = [[7,2,hi],[8,2,hi],[9,2,col],[10,2,col],[11,3,col],[12,4,lo],[13,5,lo],[13,6,lo],[12,5,col],[11,4,hi],[6,3,lo],[5,4,lo]];
      head.forEach(([x, y, c]) => px(x, y, c));
    } else if (icon.startsWith('axe_')) {
      for (let i = 2; i <= 11; i++) px(i, 15 - i, i % 2 ? handle : handleHi);
      const head = [[8,2,hi],[9,2,hi],[10,2,col],[7,3,hi],[8,3,col],[9,3,col],[10,3,lo],[7,4,col],[8,4,col],[9,4,lo],[8,5,lo],[11,4,lo],[11,5,lo]];
      head.forEach(([x, y, c]) => px(x, y, c));
    } else if (icon.startsWith('shovel_')) {
      for (let i = 2; i <= 10; i++) px(i, 15 - i, i % 2 ? handle : handleHi);
      for (let y = 2; y <= 5; y++) {
        for (let x = 10; x <= 13; x++) {
          if (x === 13 && y === 5) continue;
          px(x, y, x === 10 || y === 2 ? hi : col);
        }
      }
    } else if (icon.startsWith('sword_')) {
      px(2, 13, lo); px(3, 12, handle); px(4, 11, handleHi);
      px(3, 9, lo); px(4, 10, col); px(5, 11, col); px(6, 12, lo);
      for (let i = 5; i <= 12; i++) {
        px(i, 15 - i, hi);
        px(i + 1, 15 - i, col);
        if (i < 12) px(i + 1, 16 - i, lo);
      }
      px(13, 2, hi);
    } else if (icon === 'stick') {
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, handleHi);
        px(i + 1, 15 - i, handle);
      }
    } else if (icon === 'coal' || icon === 'raw_iron' || icon === 'raw_gold' || icon === 'clay_ball') {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4.2) {
            px(x, y, x + y < 14 ? hi : x + y > 17 ? lo : col);
          }
        }
      }
    } else if (icon === 'iron_ingot' || icon === 'gold_ingot' || icon === 'brick_item') {
      for (let y = 5; y <= 10; y++) {
        const shift = Math.floor((10 - y) * 0.5);
        for (let x = 3 + shift; x <= 11 + shift; x++) {
          px(x, y, y <= 6 ? hi : y >= 9 ? lo : col);
        }
      }
    } else if (icon === 'crystal_gem') {
      for (let y = 3; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const d = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 0.85;
          if (d < 4.3) px(x, y, d < 2 ? '#e0fffd' : x < 8 ? hi : col);
        }
      }
    } else if (icon === 'apple') {
      px(8, 2, '#5a3d1e'); px(9, 3, '#4aa336'); px(10, 3, '#4aa336');
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4.3) {
            px(x, y, x < 7 && y < 7 ? '#ff7a7a' : x > 9 ? '#b02525' : '#e03636');
          }
        }
      }
    } else if (icon === 'berries') {
      [[6,8],[9,8],[7,10],[10,10],[8,6]].forEach(([bx, by]) => {
        px(bx, by, '#e62e5c'); px(bx + 1, by, '#b51d43');
        px(bx, by + 1, '#c9244d'); px(bx + 1, by + 1, '#8f1433');
      });
      px(7, 4, '#3e9433'); px(8, 5, '#3e9433'); px(9, 4, '#3e9433');
    } else if (icon === 'raw_meat' || icon === 'cooked_meat') {
      for (let y = 4; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot((x - 7.5) * 0.85, y - 7.8) < 4.1) {
            const bone = x >= 8 && x <= 9 && y >= 6 && y <= 7;
            px(x, y, bone ? '#f5efe4' : x + y < 14 ? hi : col);
          }
        }
      }
    } else if (icon === 'bucket_empty' || icon === 'bucket_water') {
      for (let y = 5; y <= 12; y++) {
        const inset = y > 9 ? 1 : 0;
        for (let x = 4 + inset; x <= 11 - inset; x++) {
          const rim = y === 5 || y === 6;
          if (rim && icon === 'bucket_water' && x > 4 && x < 11) {
            px(x, y, '#3898ff');
          } else {
            px(x, y, x < 7 ? '#e2e8f0' : x > 9 ? '#94a3b8' : '#cbd5e1');
          }
        }
      }
    }
  }
}
