import * as THREE from 'three';
import { BLOCK_SHAPES } from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';
import { ITEMS } from '../data/items.js';

const TILE_SIZE = 16;
const PAD = 4;
const CELL_SIZE = TILE_SIZE + PAD * 2; // 24px per cell
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

// Deterministic hash for pixel-art noise so textures look crisp & consistent
function hash2(x, y, seed = 1) {
  let n = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177);
  n = (n ^ (n >>> 13)) >>> 0;
  return (n % 1000) / 1000;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function shadeHex(hex, factor, add = 0) {
  const r = clampByte(((hex >> 16) & 255) * factor + add);
  const g = clampByte(((hex >> 8) & 255) * factor + add);
  const b = clampByte((hex & 255) * factor + add);
  return `rgb(${r},${g},${b})`;
}

function createTileCanvas() {
  const c = document.createElement('canvas');
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  return c;
}

function fillNoise(ctx, baseHex, variance = 0.1, seed = 1) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (hash2(x, y, seed) - 0.5) * 2 * variance;
      ctx.fillStyle = shadeHex(baseHex, 1 + n);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawOreSpots(ctx, oreHex, highlightHex, darkHex, seed) {
  fillNoise(ctx, 0x7d8085, 0.11, 30);
  // Subtle stone strata
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x++) {
      if (hash2(x, y, seed + 5) > 0.55) {
        ctx.fillStyle = shadeHex(0x696c72, 1.0);
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }
  const spots = [
    [3, 3], [4, 3], [3, 4],
    [10, 4], [11, 4], [11, 5],
    [6, 8], [7, 8], [7, 9], [8, 9],
    [3, 12], [4, 11], [4, 12],
    [11, 11], [12, 11], [12, 12],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [sx, sy] = spots[i];
    const ox = (sx + Math.floor(hash2(i, 1, seed) * 2)) % 14 + 1;
    const oy = (sy + Math.floor(hash2(1, i, seed) * 2)) % 14 + 1;
    ctx.fillStyle = shadeHex(oreHex, 1.0);
    ctx.fillRect(ox, oy, 2, 1);
    if (i % 3 === 0) {
      ctx.fillStyle = shadeHex(highlightHex, 1.0);
      ctx.fillRect(ox, oy, 1, 1);
    } else if (i % 3 === 1) {
      ctx.fillStyle = shadeHex(darkHex, 1.0);
      ctx.fillRect(ox + 1, oy, 1, 1);
    }
  }
}

function drawPlanks(ctx, baseHex, seed) {
  for (let y = 0; y < 16; y++) {
    const plankRow = Math.floor(y / 4);
    const isSeamY = y % 4 === 3;
    const seamX = (plankRow % 2 === 0 ? 7 : 15);
    for (let x = 0; x < 16; x++) {
      const n = (hash2(x, y, seed) - 0.5) * 0.12;
      const grain = Math.sin((x + plankRow * 5) * 0.6) * 0.04;
      let f = 1 + n + grain;
      if (isSeamY || x === seamX) f *= 0.74;
      else if (y % 4 === 0) f *= 1.06;
      ctx.fillStyle = shadeHex(baseHex, f);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawLeaves(ctx, baseHex, seed, dense = false) {
  ctx.clearRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = hash2(x, y, seed);
      if (!dense && r < 0.16 && (x + y) % 2 === 0) {
        continue; // crisp cutout holes
      }
      const f = 0.82 + r * 0.36;
      ctx.fillStyle = shadeHex(baseHex, f);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function buildBlockTiles() {
  const tiles = {};
  const make = (name, fn) => {
    const c = createTileCanvas();
    const ctx = c.getContext('2d');
    fn(ctx);
    tiles[name] = c;
  };

  // Grass top (neutral bright grayscale-greenish base modulated by biome tint, or vivid green base)
  // Using a neutral-white/light-sage base so vertex biome tinting produces lush emerald/forest/taiga hues!
  make('grass_top', (ctx) => {
    fillNoise(ctx, 0xd8ead2, 0.12, 11);
    for (let i = 0; i < 28; i++) {
      const x = Math.floor(hash2(i, 3, 12) * 16);
      const y = Math.floor(hash2(3, i, 12) * 16);
      ctx.fillStyle = i % 2 === 0 ? '#eefbe8' : '#bdd4b6';
      ctx.fillRect(x, y, 1, 1);
    }
  });

  make('dirt', (ctx) => {
    fillNoise(ctx, 0x865d3d, 0.14, 21);
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash2(i, 7, 22) * 16);
      const y = Math.floor(hash2(7, i, 22) * 16);
      ctx.fillStyle = i % 3 === 0 ? '#a17652' : '#65442b';
      ctx.fillRect(x, y, 1, 1);
    }
  });

  make('grass_side', (ctx) => {
    ctx.drawImage(tiles.dirt, 0, 0);
    for (let x = 0; x < 16; x++) {
      const skirt = 3 + Math.floor(hash2(x, 0, 19) * 3);
      for (let y = 0; y < skirt; y++) {
        const n = (hash2(x, y, 18) - 0.5) * 0.16;
        ctx.fillStyle = shadeHex(0x63b346, 1 + n);
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = 'rgba(30,20,10,0.28)';
      ctx.fillRect(x, skirt, 1, 1);
    }
  });

  make('snow', (ctx) => {
    fillNoise(ctx, 0xf2f7fc, 0.05, 91);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash2(i, 2, 92) * 16);
      const y = Math.floor(hash2(2, i, 92) * 16);
      ctx.fillStyle = '#dce8f5';
      ctx.fillRect(x, y, 1, 1);
    }
  });

  make('snow_grass_side', (ctx) => {
    ctx.drawImage(tiles.dirt, 0, 0);
    for (let x = 0; x < 16; x++) {
      const skirt = 3 + Math.floor(hash2(x, 1, 95) * 3);
      for (let y = 0; y < skirt; y++) {
        ctx.fillStyle = y === skirt - 1 ? '#d4e4f4' : '#f4f9ff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  make('stone', (ctx) => {
    fillNoise(ctx, 0x80848a, 0.11, 30);
    for (let y = 1; y < 16; y += 3) {
      for (let x = 0; x < 16; x++) {
        if (hash2(x, y, 31) > 0.5) {
          ctx.fillStyle = '#6d7076';
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }
  });

  make('cobblestone', (ctx) => {
    fillNoise(ctx, 0x74777d, 0.16, 40);
    const stones = [
      [1, 1, 6, 4], [8, 0, 7, 5],
      [0, 6, 5, 5], [6, 5, 6, 5], [13, 6, 3, 5],
      [1, 12, 7, 4], [9, 11, 6, 5],
    ];
    ctx.fillStyle = '#4e5055';
    ctx.fillRect(0, 0, 16, 16);
    for (let i = 0; i < stones.length; i++) {
      const [sx, sy, sw, sh] = stones[i];
      for (let y = sy; y < Math.min(16, sy + sh); y++) {
        for (let x = sx; x < Math.min(16, sx + sw); x++) {
          const edge = x === sx || y === sy ? 1.12 : (x === sx + sw - 1 || y === sy + sh - 1 ? 0.82 : 1.0);
          const n = (hash2(x, y, 42 + i) - 0.5) * 0.12;
          ctx.fillStyle = shadeHex(0x83878e, edge + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  });

  make('bedrock', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hash2(x, y, 50);
        const c = r < 0.3 ? 0x222326 : r < 0.7 ? 0x3b3d42 : 0x595c63;
        ctx.fillStyle = shadeHex(c, 1.0);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  make('sand', (ctx) => {
    fillNoise(ctx, 0xe2cf96, 0.08, 60);
    for (let y = 0; y < 16; y += 3) {
      for (let x = 0; x < 16; x++) {
        if (hash2(x, y, 61) > 0.45) {
          ctx.fillStyle = '#ead9a7';
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }
  });

  make('sandstone_top', (ctx) => {
    fillNoise(ctx, 0xdec98d, 0.07, 62);
  });
  make('sandstone_bottom', (ctx) => {
    fillNoise(ctx, 0xcab479, 0.09, 63);
  });
  make('sandstone_side', (ctx) => {
    fillNoise(ctx, 0xd8c387, 0.07, 64);
    ctx.fillStyle = '#ebdca8';
    ctx.fillRect(0, 0, 16, 3);
    ctx.fillStyle = '#bfa86c';
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
  });

  make('gravel', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hash2(x, y, 68);
        const hex = r < 0.25 ? 0x6c6866 : r < 0.65 ? 0x8a8582 : 0xa39c97;
        ctx.fillStyle = shadeHex(hex, 1.0);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  make('clay', (ctx) => {
    fillNoise(ctx, 0x9da4b4, 0.08, 69);
  });

  make('water', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x + y * 0.7) * 0.8) * 0.08;
        const c = shadeHex(0x2782db, 1 + wave);
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(185, 232, 255, 0.35)';
    ctx.fillRect(2, 3, 5, 1);
    ctx.fillRect(9, 8, 5, 1);
    ctx.fillRect(4, 13, 6, 1);
  });

  make('ice', (ctx) => {
    fillNoise(ctx, 0x95c8f6, 0.06, 98);
    ctx.strokeStyle = 'rgba(235, 248, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 13);
    ctx.lineTo(13, 2);
    ctx.moveTo(6, 14);
    ctx.lineTo(14, 6);
    ctx.stroke();
  });

  // Logs & Leaves
  const drawLogTop = (ctx, barkHex, ringLight, ringDark) => {
    fillNoise(ctx, barkHex, 0.08, 70);
    for (let y = 2; y < 14; y++) {
      for (let x = 2; x < 14; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const hex = Math.floor(dist) % 2 === 0 ? ringLight : ringDark;
        ctx.fillStyle = shadeHex(hex, 1.0);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  make('oak_log_side', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const stripe = x % 4 === 0 ? 0.84 : x % 4 === 2 ? 1.08 : 0.96;
        const n = (hash2(x, y, 71) - 0.5) * 0.12;
        ctx.fillStyle = shadeHex(0x6b4f31, stripe + n);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  make('oak_log_top', (ctx) => drawLogTop(ctx, 0x6b4f31, 0xb89462, 0x9b794b));
  make('oak_leaves', (ctx) => drawLeaves(ctx, 0xd4ebd0, 72, false));

  make('birch_log_side', (ctx) => {
    fillNoise(ctx, 0xe4e1d8, 0.06, 73);
    const knots = [[2, 3, 4, 1], [10, 6, 4, 2], [4, 11, 5, 1], [12, 14, 3, 1], [0, 8, 3, 1]];
    ctx.fillStyle = '#3c3a36';
    for (const [kx, ky, kw, kh] of knots) ctx.fillRect(kx, ky, kw, kh);
  });
  make('birch_log_top', (ctx) => drawLogTop(ctx, 0xd8d5cc, 0xd5c496, 0xbfa978));
  make('birch_leaves', (ctx) => drawLeaves(ctx, 0xd8ecd2, 74, false));

  make('spruce_log_side', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const stripe = x % 3 === 0 ? 0.85 : 1.04;
        const n = (hash2(x, y, 75) - 0.5) * 0.1;
        ctx.fillStyle = shadeHex(0x422d1b, stripe + n);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  make('spruce_log_top', (ctx) => drawLogTop(ctx, 0x422d1b, 0x8f6b43, 0x735331));
  make('spruce_leaves', (ctx) => drawLeaves(ctx, 0x3f6e4a, 76, false));

  // Cactus
  make('cactus_side', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rib = x % 4 === 0 ? 0.82 : x % 4 === 2 ? 1.12 : 0.96;
        ctx.fillStyle = shadeHex(0x2f8a38, rib);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#d9e3b8';
    for (let y = 2; y < 16; y += 4) {
      ctx.fillRect(1, y, 1, 1);
      ctx.fillRect(9, y + 1, 1, 1);
      ctx.fillRect(14, y, 1, 1);
    }
  });
  make('cactus_top', (ctx) => {
    fillNoise(ctx, 0x389b42, 0.08, 78);
    ctx.fillStyle = '#6ec274';
    ctx.fillRect(5, 5, 6, 6);
  });
  make('cactus_bottom', (ctx) => fillNoise(ctx, 0x578f4b, 0.08, 79));

  // Ores
  make('coal_ore', (ctx) => drawOreSpots(ctx, 0x222428, 0x3d4047, 0x111214, 101));
  make('iron_ore', (ctx) => drawOreSpots(ctx, 0xd8af93, 0xf2d2bc, 0xa87d62, 102));
  make('gold_ore', (ctx) => drawOreSpots(ctx, 0xf5cf38, 0xfff394, 0xc79914, 103));
  make('diamond_ore', (ctx) => drawOreSpots(ctx, 0x49ebd8, 0xb8fff7, 0x20a89e, 104));

  // Planks
  make('oak_planks', (ctx) => drawPlanks(ctx, 0xb48c56, 110));
  make('birch_planks', (ctx) => drawPlanks(ctx, 0xd7c58c, 111));
  make('spruce_planks', (ctx) => drawPlanks(ctx, 0x785736, 112));

  // Utility blocks
  make('crafting_top', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    ctx.fillStyle = '#5c3f22';
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = '#c89d64';
    ctx.fillRect(2, 2, 12, 12);
    // 3x3 grid lines
    ctx.fillStyle = '#6c4b2a';
    ctx.fillRect(5, 2, 1, 12);
    ctx.fillRect(10, 2, 1, 12);
    ctx.fillRect(2, 5, 12, 1);
    ctx.fillRect(2, 10, 12, 1);
  });
  make('crafting_side', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    ctx.fillStyle = '#5c3f22';
    ctx.fillRect(0, 0, 16, 3);
    // Little tool silhouettes
    ctx.fillStyle = '#8b939c';
    ctx.fillRect(4, 6, 2, 5);
    ctx.fillStyle = '#593b1d';
    ctx.fillRect(5, 10, 1, 4);
    ctx.fillStyle = '#c5cdd6';
    ctx.fillRect(10, 5, 3, 3);
    ctx.fillStyle = '#593b1d';
    ctx.fillRect(11, 8, 1, 6);
  });
  make('crafting_front', (ctx) => {
    ctx.drawImage(tiles.crafting_side, 0, 0);
  });

  make('furnace_top', (ctx) => {
    fillNoise(ctx, 0x6e7177, 0.09, 120);
    ctx.strokeStyle = '#505358';
    ctx.strokeRect(1.5, 1.5, 13, 13);
  });
  make('furnace_side', (ctx) => {
    ctx.drawImage(tiles.cobblestone, 0, 0);
    ctx.fillStyle = 'rgba(30,32,36,0.25)';
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillRect(0, 14, 16, 2);
  });
  make('furnace_front', (ctx) => {
    ctx.drawImage(tiles.furnace_side, 0, 0);
    ctx.fillStyle = '#25272b';
    ctx.fillRect(4, 3, 8, 5);
    ctx.fillRect(4, 10, 8, 4);
    ctx.fillStyle = '#43464d';
    ctx.fillRect(3, 2, 10, 1);
    ctx.fillRect(3, 9, 10, 1);
  });
  make('furnace_front_lit', (ctx) => {
    ctx.drawImage(tiles.furnace_front, 0, 0);
    ctx.fillStyle = '#ff7b1c';
    ctx.fillRect(4, 10, 8, 4);
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(5, 11, 6, 2);
    ctx.fillStyle = '#ff9838';
    ctx.fillRect(5, 4, 6, 3);
  });

  make('chest_top', (ctx) => {
    fillNoise(ctx, 0xa87638, 0.08, 130);
    ctx.strokeStyle = '#583b18';
    ctx.strokeRect(0.5, 0.5, 15, 15);
  });
  make('chest_side', (ctx) => {
    fillNoise(ctx, 0xa87638, 0.08, 131);
    ctx.strokeStyle = '#583b18';
    ctx.strokeRect(0.5, 0.5, 15, 15);
    ctx.fillStyle = '#583b18';
    ctx.fillRect(0, 5, 16, 1);
  });
  make('chest_front', (ctx) => {
    ctx.drawImage(tiles.chest_side, 0, 0);
    ctx.fillStyle = '#dde3ea';
    ctx.fillRect(7, 4, 2, 4);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(7, 7, 2, 1);
  });

  make('torch', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    // Stick shaft
    ctx.fillStyle = '#8b6337';
    ctx.fillRect(7, 6, 2, 10);
    ctx.fillStyle = '#6c4b27';
    ctx.fillRect(8, 6, 1, 10);
    // Coal collar
    ctx.fillStyle = '#2d2d30';
    ctx.fillRect(7, 5, 2, 1);
    // Glowing flame tip
    ctx.fillStyle = '#ff7c1f';
    ctx.fillRect(6, 2, 4, 3);
    ctx.fillStyle = '#ffe96b';
    ctx.fillRect(7, 3, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 3, 1, 1);
  });

  make('glass', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#d7f2ff';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    // Crisp diagonal glint
    ctx.fillStyle = '#eefaff';
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(2, 4, 2, 1);
    ctx.fillRect(11, 11, 2, 1);
  });

  make('bricks', (ctx) => {
    ctx.fillStyle = '#cfc7bc';
    ctx.fillRect(0, 0, 16, 16);
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      const offset = (row % 2) * 4;
      for (let x = 0; x < 16; x++) {
        if ((x + offset) % 8 === 7) continue;
        for (let dy = 0; dy < 3; dy++) {
          const n = (hash2(x, y + dy, 140) - 0.5) * 0.14;
          ctx.fillStyle = shadeHex(0xa84b3b, 1 + n);
          ctx.fillRect(x, y + dy, 1, 1);
        }
      }
    }
  });

  make('stone_bricks', (ctx) => {
    fillNoise(ctx, 0x82868c, 0.08, 141);
    ctx.fillStyle = '#53565b';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(15, 8, 1, 7);
    ctx.fillStyle = '#9ea3aa';
    ctx.fillRect(0, 0, 7, 1);
    ctx.fillRect(8, 0, 8, 1);
    ctx.fillRect(0, 8, 15, 1);
  });

  make('glowstone', (ctx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hash2(x, y, 145);
        const hex = r < 0.25 ? 0xbd8228 : r < 0.65 ? 0xf2c249 : 0xfff5a8;
        ctx.fillStyle = shadeHex(hex, 1.0);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  make('tnt_side', (ctx) => {
    ctx.fillStyle = '#cc3328';
    ctx.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x += 4) {
      ctx.fillStyle = '#b0271e';
      ctx.fillRect(x, 0, 1, 16);
    }
    ctx.fillStyle = '#f2eee6';
    ctx.fillRect(0, 5, 16, 6);
    ctx.fillStyle = '#1c1c1e';
    // Tiny pixel "TNT"
    ctx.fillRect(2, 6, 3, 1); ctx.fillRect(3, 7, 1, 3);
    ctx.fillRect(6, 6, 1, 4); ctx.fillRect(7, 7, 1, 1); ctx.fillRect(8, 8, 1, 1); ctx.fillRect(9, 6, 1, 4);
    ctx.fillRect(11, 6, 3, 1); ctx.fillRect(12, 7, 1, 3);
  });
  make('tnt_top', (ctx) => {
    fillNoise(ctx, 0xc73228, 0.08, 146);
    ctx.fillStyle = '#2d2d30';
    ctx.fillRect(6, 6, 4, 4);
    ctx.fillStyle = '#e5dcc8';
    ctx.fillRect(7, 7, 2, 2);
  });
  make('tnt_bottom', (ctx) => fillNoise(ctx, 0xa82820, 0.08, 147));

  // Cross Flora
  make('tall_grass', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    const blades = [2, 4, 6, 8, 10, 12, 14];
    for (let i = 0; i < blades.length; i++) {
      const bx = blades[i];
      const h = 7 + (i * 3) % 7;
      for (let y = 15; y >= 16 - h; y--) {
        const sway = y < 10 ? (i % 2 === 0 ? -1 : 1) : 0;
        ctx.fillStyle = y < 10 ? '#e4f7dd' : '#bfdcb6';
        ctx.fillRect(bx + sway, y, 1, 1);
      }
    }
  });

  make('red_flower', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#3d8f34';
    ctx.fillRect(7, 9, 2, 7);
    ctx.fillRect(5, 12, 2, 1);
    ctx.fillRect(9, 11, 2, 1);
    ctx.fillStyle = '#dc2929';
    ctx.fillRect(5, 4, 6, 5);
    ctx.fillRect(6, 3, 4, 1);
    ctx.fillStyle = '#ff5c5c';
    ctx.fillRect(6, 4, 3, 2);
    ctx.fillStyle = '#2b1b12';
    ctx.fillRect(7, 6, 2, 2);
  });

  make('yellow_flower', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#3d8f34';
    ctx.fillRect(7, 9, 2, 7);
    ctx.fillStyle = '#f5cf27';
    ctx.fillRect(5, 4, 6, 5);
    ctx.fillRect(6, 3, 4, 1);
    ctx.fillStyle = '#fff380';
    ctx.fillRect(6, 4, 3, 2);
  });

  make('dead_bush', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#7c5833';
    ctx.fillRect(7, 10, 2, 6);
    ctx.fillRect(5, 7, 2, 4);
    ctx.fillRect(9, 8, 2, 3);
    ctx.fillRect(3, 5, 2, 3);
    ctx.fillRect(11, 5, 2, 3);
    ctx.fillRect(6, 4, 1, 3);
  });

  make('mushroom', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#e5dccb';
    ctx.fillRect(7, 10, 2, 6);
    ctx.fillStyle = '#c8372d';
    ctx.fillRect(4, 6, 8, 4);
    ctx.fillRect(5, 5, 6, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 7, 2, 1);
    ctx.fillRect(9, 6, 2, 2);
  });

  make('bookshelf', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    ctx.fillStyle = '#332211';
    ctx.fillRect(1, 2, 14, 5);
    ctx.fillRect(1, 9, 14, 5);
    const colors = ['#b83227', '#296eb8', '#2f8f46', '#c99a26', '#7b3fa8', '#a85a2a'];
    for (let shelf = 0; shelf < 2; shelf++) {
      const sy = shelf === 0 ? 3 : 10;
      for (let x = 2; x < 14; x += 2) {
        ctx.fillStyle = colors[(x + shelf * 3) % colors.length];
        ctx.fillRect(x, sy, 2, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, sy + 1, 1, 1);
      }
    }
  });

  make('wool', (ctx) => {
    fillNoise(ctx, 0xf2f0eb, 0.06, 160);
  });

  make('bed_top', (ctx) => {
    // Pillow + cozy crimson blanket
    ctx.fillStyle = '#f5f4ef';
    ctx.fillRect(0, 0, 16, 5);
    ctx.fillStyle = '#d9d6cc';
    ctx.fillRect(1, 4, 14, 1);
    for (let y = 5; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = (hash2(x, y, 162) - 0.5) * 0.08;
        ctx.fillStyle = shadeHex(0xc43235, 1 + n);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  make('bed_side', (ctx) => {
    ctx.fillStyle = '#c43235';
    ctx.fillRect(0, 0, 16, 8);
    ctx.fillStyle = '#f5f4ef';
    ctx.fillRect(0, 0, 4, 7);
    ctx.drawImage(tiles.oak_planks, 0, 8, 16, 8, 0, 8, 16, 8);
  });

  const drawMineralBlock = (ctx, baseHex, lightHex, darkHex) => {
    fillNoise(ctx, baseHex, 0.06, 170);
    ctx.fillStyle = shadeHex(lightHex, 1.0);
    ctx.fillRect(1, 1, 14, 1);
    ctx.fillRect(1, 1, 1, 14);
    ctx.fillRect(3, 3, 5, 2);
    ctx.fillStyle = shadeHex(darkHex, 1.0);
    ctx.fillRect(1, 14, 14, 1);
    ctx.fillRect(14, 1, 1, 14);
  };

  make('diamond_block', (ctx) => drawMineralBlock(ctx, 0x45e3d1, 0xb8fff6, 0x229c8e));
  make('iron_block', (ctx) => drawMineralBlock(ctx, 0xdce0e5, 0xffffff, 0x9ca3ad));
  make('gold_block', (ctx) => drawMineralBlock(ctx, 0xf5cd33, 0xfff59e, 0xb88914));

  return tiles;
}

// Draw 16x16 pixel-art icons for non-block items & tools
function buildItemSpriteCanvas(iconKey) {
  const c = createTileCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);

  const px = (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const drawHandle = () => {
    for (let i = 2; i <= 10; i++) {
      px(i, 15 - i, '#7c562e');
      if (i < 10) px(i + 1, 15 - i, '#593c1e');
    }
  };

  const tierPalette = {
    wood: ['#b88f56', '#8d6a3b', '#d1aa71'],
    stone: ['#92969e', '#686b72', '#b5bac2'],
    iron: ['#e2e7ed', '#9ea6b0', '#ffffff'],
    diamond: ['#42ebd8', '#1ea395', '#bcfff7'],
  };

  if (iconKey.endsWith('_pickaxe') || iconKey.endsWith('_axe') || iconKey.endsWith('_shovel') || iconKey.endsWith('_sword')) {
    const [tier, kind] = iconKey.split('_');
    const [main, dark, light] = tierPalette[tier] || tierPalette.iron;

    if (kind === 'pickaxe') {
      drawHandle();
      // Curved pickaxe head
      px(7, 2, main, 5, 2);
      px(11, 3, main, 2, 3);
      px(12, 6, dark, 2, 2);
      px(5, 2, dark, 2, 2);
      px(8, 2, light, 3, 1);
    } else if (kind === 'axe') {
      drawHandle();
      px(7, 2, main, 4, 5);
      px(6, 3, light, 2, 4);
      px(11, 3, dark, 2, 2);
    } else if (kind === 'shovel') {
      drawHandle();
      px(10, 2, main, 4, 4);
      px(11, 1, light, 2, 2);
      px(13, 3, dark, 1, 3);
    } else if (kind === 'sword') {
      // Hilt
      px(2, 13, '#6e4b26', 2, 2);
      px(4, 11, '#8d6436', 2, 2);
      px(4, 9, dark, 5, 2);
      px(5, 10, main, 3, 3);
      // Blade
      for (let i = 0; i < 8; i++) {
        px(6 + i, 9 - i, main, 2, 2);
        px(6 + i, 8 - i, light, 1, 1);
      }
    }
    return c;
  }

  switch (iconKey) {
    case 'stick':
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, '#9c7140');
        px(i + 1, 15 - i, '#6b4b27');
      }
      break;
    case 'coal':
      px(5, 4, '#24262b', 6, 8);
      px(4, 5, '#191b1f', 8, 6);
      px(6, 5, '#464a54', 3, 2);
      break;
    case 'raw_iron':
      px(4, 5, '#b88b70', 8, 7);
      px(5, 4, '#d9af94', 6, 6);
      px(6, 5, '#f5d7c4', 3, 2);
      break;
    case 'iron_ingot':
      px(3, 6, '#9ca4ae', 10, 5);
      px(4, 5, '#dce2e8', 8, 5);
      px(5, 6, '#ffffff', 6, 2);
      break;
    case 'raw_gold':
      px(4, 5, '#c99918', 8, 7);
      px(5, 4, '#f5cf38', 6, 6);
      px(6, 5, '#fff59c', 3, 2);
      break;
    case 'gold_ingot':
      px(3, 6, '#b88611', 10, 5);
      px(4, 5, '#f5cd31', 8, 5);
      px(5, 6, '#fff6a6', 6, 2);
      break;
    case 'diamond':
      px(5, 3, '#22a89a', 6, 10);
      px(4, 5, '#45ebd8', 8, 6);
      px(6, 4, '#c2fff8', 3, 3);
      break;
    case 'flint':
      px(5, 3, '#2d2f36', 6, 10);
      px(4, 6, '#434650', 7, 6);
      px(6, 4, '#7c8291', 2, 3);
      break;
    case 'clay_ball':
      px(4, 5, '#8991a3', 8, 7);
      px(5, 4, '#abb3c4', 6, 7);
      px(6, 5, '#cad2e3', 2, 2);
      break;
    case 'brick_item':
      px(3, 6, '#87382b', 10, 5);
      px(4, 5, '#b55040', 8, 5);
      px(5, 6, '#cf6c5b', 5, 1);
      break;
    case 'flint_and_steel':
      px(3, 4, '#cfd6de', 5, 2);
      px(3, 6, '#cfd6de', 2, 4);
      px(3, 9, '#9da5b0', 5, 2);
      px(9, 7, '#34373f', 4, 5);
      px(10, 6, '#595e6b', 2, 2);
      break;
    case 'bucket':
      px(4, 5, '#8d95a0', 8, 7);
      px(5, 12, '#6f7782', 6, 2);
      px(5, 6, '#cfd6e0', 6, 5);
      px(5, 5, '#3b3f46', 6, 2);
      break;
    case 'water_bucket':
      px(4, 5, '#8d95a0', 8, 7);
      px(5, 12, '#6f7782', 6, 2);
      px(5, 6, '#cfd6e0', 6, 5);
      px(5, 4, '#2989e8', 6, 3);
      px(6, 4, '#8fd1ff', 3, 1);
      break;
    case 'apple':
      px(7, 2, '#5c3d1e', 2, 2);
      px(9, 2, '#47a339', 2, 2);
      px(4, 4, '#cc2929', 8, 8);
      px(5, 12, '#a81e1e', 6, 2);
      px(5, 5, '#ff7373', 2, 3);
      break;
    case 'raw_pork':
    case 'raw_mutton':
    case 'raw_chicken':
      px(3, 5, '#d96c6c', 10, 7);
      px(4, 4, '#f08d8d', 8, 7);
      px(9, 6, '#fce8e6', 3, 3);
      break;
    case 'cooked_pork':
    case 'cooked_mutton':
    case 'cooked_chicken':
      px(3, 5, '#7d4422', 10, 7);
      px(4, 4, '#ab6438', 8, 7);
      px(6, 5, '#d18856', 4, 2);
      break;
    default:
      px(4, 4, '#cccccc', 8, 8);
  }
  return c;
}

// Render a crisp 48x48 isometric 3D block icon from top, left, right 16x16 canvases
function renderIsometricBlockIcon(topCanvas, leftCanvas, rightCanvas, topTintHex = null, allTintHex = null) {
  const size = 48;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const tintTile = (src, hex, brightness) => {
    const tmp = createTileCanvas();
    const tctx = tmp.getContext('2d');
    tctx.drawImage(src, 0, 0);
    const img = tctx.getImageData(0, 0, 16, 16);
    const d = img.data;
    const tr = hex ? ((hex >> 16) & 255) / 255 : 1;
    const tg = hex ? ((hex >> 8) & 255) / 255 : 1;
    const tb = hex ? (hex & 255) / 255 : 1;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clampByte(d[i] * tr * brightness);
      d[i + 1] = clampByte(d[i + 1] * tg * brightness);
      d[i + 2] = clampByte(d[i + 2] * tb * brightness);
    }
    tctx.putImageData(img, 0, 0);
    return tmp;
  };

  const tTop = tintTile(topCanvas, topTintHex || allTintHex, 1.04);
  const tLeft = tintTile(leftCanvas, allTintHex, 0.84);
  const tRight = tintTile(rightCanvas, allTintHex, 0.66);

  // Isometric transforms onto 48x48 canvas
  // Center top vertex at (24, 4), center middle vertex at (24, 24)
  // Top face
  ctx.save();
  ctx.transform(1.15, 0.575, -1.15, 0.575, 24, 4.5);
  ctx.drawImage(tTop, 0, 0);
  ctx.restore();

  // Left face
  ctx.save();
  ctx.transform(1.15, 0.575, 0, 1.22, 5.6, 13.7);
  ctx.drawImage(tLeft, 0, 0);
  ctx.restore();

  // Right face
  ctx.save();
  ctx.transform(1.15, -0.575, 0, 1.22, 24, 22.9);
  ctx.drawImage(tRight, 0, 0);
  ctx.restore();

  return out.toDataURL();
}

function renderFlatSpriteIcon(tileCanvas, tintHex = null) {
  const size = 48;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (tintHex) {
    const tmp = createTileCanvas();
    const tctx = tmp.getContext('2d');
    tctx.drawImage(tileCanvas, 0, 0);
    const img = tctx.getImageData(0, 0, 16, 16);
    const d = img.data;
    const tr = ((tintHex >> 16) & 255) / 255;
    const tg = ((tintHex >> 8) & 255) / 255;
    const tb = (tintHex & 255) / 255;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clampByte(d[i] * tr);
      d[i + 1] = clampByte(d[i + 1] * tg);
      d[i + 2] = clampByte(d[i + 2] * tb);
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 4, 4, 40, 40);
  } else {
    ctx.drawImage(tileCanvas, 4, 4, 40, 40);
  }
  return out.toDataURL();
}

export class TextureAtlas {
  constructor() {
    this.tiles = buildBlockTiles();
    this.uvMap = {};
    this.iconUrls = new Map();
    this.itemCanvases = new Map();
    this.blockColors = new Map();

    this.atlasCanvas = document.createElement('canvas');
    this.atlasCanvas.width = ATLAS_COLS * CELL_SIZE;
    this.atlasCanvas.height = ATLAS_ROWS * CELL_SIZE;
    this._packAtlas();

    this.texture = new THREE.CanvasTexture(this.atlasCanvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    this.crackTextures = this._buildCrackTextures();
    this._buildAllIconsAndColors();
  }

  _packAtlas() {
    const ctx = this.atlasCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.atlasCanvas.width, this.atlasCanvas.height);

    const names = Object.keys(this.tiles);
    const totalW = this.atlasCanvas.width;
    const totalH = this.atlasCanvas.height;

    names.forEach((name, idx) => {
      const col = idx % ATLAS_COLS;
      const row = Math.floor(idx / ATLAS_COLS);
      const cellX = col * CELL_SIZE;
      const cellY = row * CELL_SIZE;
      const tile = this.tiles[name];
      const innerX = cellX + PAD;
      const innerY = cellY + PAD;

      // Draw center 16x16
      ctx.drawImage(tile, innerX, innerY);

      // Extrude 4px border on top, bottom, left, right, and corners so grazing UVs never bleed
      for (let p = 1; p <= PAD; p++) {
        ctx.drawImage(tile, 0, 0, 16, 1, innerX, innerY - p, 16, 1); // top
        ctx.drawImage(tile, 0, 15, 16, 1, innerX, innerY + 15 + p, 16, 1); // bottom
        ctx.drawImage(tile, 0, 0, 1, 16, innerX - p, innerY, 1, 16); // left
        ctx.drawImage(tile, 15, 0, 1, 16, innerX + 15 + p, innerY, 1, 16); // right
      }
      // 4 corners
      ctx.drawImage(tile, 0, 0, 1, 1, cellX, cellY, PAD, PAD);
      ctx.drawImage(tile, 15, 0, 1, 1, innerX + 16, cellY, PAD, PAD);
      ctx.drawImage(tile, 0, 15, 1, 1, cellX, innerY + 16, PAD, PAD);
      ctx.drawImage(tile, 15, 15, 1, 1, innerX + 16, innerY + 16, PAD, PAD);

      // Compute UV rect in Three.js bottom-left origin coordinates
      const eps = 0.02;
      const u0 = (innerX + eps) / totalW;
      const u1 = (innerX + TILE_SIZE - eps) / totalW;
      const v1 = 1.0 - (innerY + eps) / totalH;
      const v0 = 1.0 - (innerY + TILE_SIZE - eps) / totalH;

      this.uvMap[name] = { u0, v0, u1, v1 };
    });
  }

  getUV(texName) {
    return this.uvMap[texName] || this.uvMap.stone;
  }

  getBlockFaceUV(blockId, faceName) {
    const b = BLOCKS[blockId];
    if (!b || !b.textures) return this.getUV('stone');
    const t = b.textures;
    if (t.all) return this.getUV(t.all);
    if (faceName === 'top' && t.top) return this.getUV(t.top);
    if (faceName === 'bottom' && t.bottom) return this.getUV(t.bottom);
    if (faceName === 'front' && t.front) return this.getUV(t.front);
    return this.getUV(t.side || t.top || 'stone');
  }

  _buildCrackTextures() {
    const list = [];
    for (let stage = 0; stage < 10; stage++) {
      const c = createTileCanvas();
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 16, 16);
      const branches = 2 + stage * 2;
      ctx.fillStyle = 'rgba(18, 18, 22, 0.72)';
      for (let b = 0; b < branches; b++) {
        let cx = 8;
        let cy = 8;
        const len = 2 + Math.floor(((stage + 1) / 10) * 8);
        const angle = (b / branches) * Math.PI * 2 + b * 0.7;
        for (let s = 0; s < len; s++) {
          cx += Math.cos(angle + Math.sin(s * 1.7 + b) * 0.5);
          cy += Math.sin(angle + Math.cos(s * 1.3 + b) * 0.5);
          const ix = Math.max(0, Math.min(15, Math.round(cx)));
          const iy = Math.max(0, Math.min(15, Math.round(cy)));
          ctx.fillRect(ix, iy, 1, 1);
          if (stage >= 6 && s % 2 === 1) {
            ctx.fillRect(Math.min(15, ix + 1), iy, 1, 1);
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      list.push(tex);
    }
    return list;
  }

  _buildAllIconsAndColors() {
    for (const key of Object.keys(BLOCKS)) {
      const b = BLOCKS[key];
      if (!b || b.id === BLOCK.AIR) continue;
      const t = b.textures;
      const topName = t.top || t.all || 'stone';
      const sideName = t.front || t.side || t.all || 'stone';
      const topTile = this.tiles[topName] || this.tiles.stone;
      const sideTile = this.tiles[sideName] || this.tiles.stone;

      // Sample average particle color
      const pctx = sideTile.getContext('2d');
      const d = pctx.getImageData(4, 4, 8, 8).data;
      let r = 0, g = 0, bl = 0, cnt = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 60) {
          r += d[i]; g += d[i + 1]; bl += d[i + 2]; cnt++;
        }
      }
      if (cnt > 0) {
        r = Math.round(r / cnt); g = Math.round(g / cnt); bl = Math.round(bl / cnt);
        if (b.tintAll === 'foliage' || b.tintAll === 'grass') {
          r = Math.round(r * 0.48); g = Math.round(g * 0.78); bl = Math.round(bl * 0.36);
        }
        this.blockColors.set(b.id, (r << 16) | (g << 8) | bl);
      } else {
        this.blockColors.set(b.id, 0x888888);
      }

      if (b.shape === BLOCK_SHAPES.CROSS || b.shape === BLOCK_SHAPES.TORCH) {
        const tint = b.tintAll ? 0x67b848 : null;
        this.iconUrls.set(b.id, renderFlatSpriteIcon(sideTile, tint));
      } else {
        const topTint = b.tintTop === 'grass' ? 0x68bc49 : null;
        const allTint = b.tintAll === 'foliage' ? 0x5ab03e : b.tintAll === 'birch' ? 0x7ec255 : null;
        this.iconUrls.set(b.id, renderIsometricBlockIcon(topTile, sideTile, sideTile, topTint, allTint));
      }
    }

    for (const key of Object.keys(ITEMS)) {
      const it = ITEMS[key];
      const spriteCanvas = buildItemSpriteCanvas(it.icon);
      this.itemCanvases.set(it.id, spriteCanvas);
      this.iconUrls.set(it.id, renderFlatSpriteIcon(spriteCanvas));
    }
  }

  getIconUrl(id) {
    return this.iconUrls.get(id) || '';
  }

  getItemCanvas(id) {
    return this.itemCanvases.get(id) || null;
  }

  getBlockColor(id) {
    return this.blockColors.get(id) ?? 0x888888;
  }
}
