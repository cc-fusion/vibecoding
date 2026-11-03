import * as THREE from 'three';
import { BLOCK, getDef } from './blocks.js';
import { createPRNG } from './math/noise.js';

const TILE_SIZE = 16;
const PAD = 4;
const CELL_SIZE = TILE_SIZE + PAD * 2; // 24px per slot with clamped border
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

const TEXTURE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'mossy_cobble', 'deepslate', 'bedrock',
  'sand', 'sandstone_side', 'sandstone_top', 'gravel', 'clay', 'snow', 'snow_side', 'ice',
  'water', 'oak_log', 'oak_log_top', 'birch_log', 'birch_log_top', 'spruce_log', 'spruce_log_top', 'cactus_side',
  'cactus_top', 'oak_leaves', 'birch_leaves', 'spruce_leaves', 'oak_planks', 'birch_planks', 'spruce_planks', 'workbench_top',
  'workbench_side', 'furnace_front', 'furnace_top', 'glass', 'bricks', 'torch', 'glowstone', 'coal_ore',
  'iron_ore', 'gold_ore', 'diamond_ore', 'tall_grass', 'poppy', 'dandelion', 'cornflower', 'dead_shrub',
  'bookshelf', 'wool', 'crate',
];

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shadeColor(rgb, factor) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
  ];
}

function setPx(data, x, y, rgb, alpha = 255) {
  if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
  const idx = (y * TILE_SIZE + x) * 4;
  data[idx] = rgb[0];
  data[idx + 1] = rgb[1];
  data[idx + 2] = rgb[2];
  data[idx + 3] = alpha;
}

function createTileCanvas(drawFn, seed = 101) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const rand = createPRNG(seed);
  drawFn(img.data, rand);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function fillNoise(data, rand, baseHex, variance = 0.12) {
  const base = hexToRgb(baseHex);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const f = 1 + (rand() - 0.5) * variance * 2;
      setPx(data, x, y, shadeColor(base, f));
    }
  }
}

function paintOreSpots(data, rand, oreHex, highlightHex) {
  const ore = hexToRgb(oreHex);
  const hi = hexToRgb(highlightHex);
  const spots = [
    [3, 4], [4, 4], [4, 5],
    [10, 3], [11, 3], [10, 4],
    [6, 10], [7, 10], [7, 11], [8, 10],
    [12, 11], [13, 12],
    [2, 12], [3, 12],
  ];
  for (const [sx, sy] of spots) {
    const ox = sx + (rand() > 0.65 ? 1 : 0);
    const oy = sy;
    setPx(data, ox % 15, oy % 15, rand() > 0.35 ? ore : hi);
  }
}

function generateBlockTile(name, idx) {
  return createTileCanvas((data, rand) => {
    switch (name) {
      case 'grass_top': {
        fillNoise(data, rand, '#5da840', 0.13);
        for (let i = 0; i < 24; i++) {
          setPx(data, Math.floor(rand() * 16), Math.floor(rand() * 16), hexToRgb(rand() > 0.5 ? '#6ec04b' : '#4b8f33'));
        }
        break;
      }
      case 'dirt': {
        fillNoise(data, rand, '#7b5538', 0.15);
        for (let i = 0; i < 22; i++) {
          setPx(data, Math.floor(rand() * 16), Math.floor(rand() * 16), hexToRgb(rand() > 0.5 ? '#614128' : '#946a49'));
        }
        break;
      }
      case 'grass_side': {
        fillNoise(data, rand, '#7b5538', 0.15);
        for (let x = 0; x < 16; x++) {
          const depth = 3 + Math.floor(rand() * 3);
          for (let y = 0; y < depth; y++) {
            const f = 1 + (rand() - 0.5) * 0.18;
            setPx(data, x, y, shadeColor(hexToRgb('#5da840'), f));
          }
          setPx(data, x, depth, hexToRgb('#477d31'));
        }
        break;
      }
      case 'snow': {
        fillNoise(data, rand, '#f0f6fb', 0.06);
        for (let i = 0; i < 16; i++) {
          setPx(data, Math.floor(rand() * 16), Math.floor(rand() * 16), hexToRgb('#dceaf7'));
        }
        break;
      }
      case 'snow_side': {
        fillNoise(data, rand, '#7b5538', 0.14);
        for (let x = 0; x < 16; x++) {
          const depth = 3 + Math.floor(rand() * 3);
          for (let y = 0; y < depth; y++) {
            setPx(data, x, y, shadeColor(hexToRgb('#f1f7fc'), 0.96 + rand() * 0.06));
          }
          setPx(data, x, depth, hexToRgb('#cddfed'));
        }
        break;
      }
      case 'stone': {
        const base = hexToRgb('#83878c');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const streak = ((x + y * 3) % 7 === 0) ? -0.1 : 0;
            const f = 1 + streak + (rand() - 0.5) * 0.16;
            setPx(data, x, y, shadeColor(base, f));
          }
        }
        break;
      }
      case 'cobblestone':
      case 'mossy_cobble': {
        fillNoise(data, rand, '#787b80', 0.18);
        const mortar = hexToRgb(name === 'mossy_cobble' ? '#4a773c' : '#505357');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const cell = ((x + (y >> 2) * 3) % 5 === 0) || ((y + (x >> 2) * 2) % 4 === 0);
            if (cell) setPx(data, x, y, shadeColor(mortar, 0.9 + rand() * 0.2));
            else if (name === 'mossy_cobble' && rand() < 0.2) {
              setPx(data, x, y, hexToRgb('#5f914b'));
            }
          }
        }
        break;
      }
      case 'deepslate': {
        const base = hexToRgb('#464a54');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const band = (y % 4 === 0) ? 0.86 : 1.04;
            setPx(data, x, y, shadeColor(base, band + (rand() - 0.5) * 0.14));
          }
        }
        break;
      }
      case 'bedrock': {
        fillNoise(data, rand, '#323438', 0.38);
        break;
      }
      case 'sand': {
        const base = hexToRgb('#e2d29b');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const wave = Math.sin((x + y * 2) * 0.5) * 0.04;
            setPx(data, x, y, shadeColor(base, 1 + wave + (rand() - 0.5) * 0.1));
          }
        }
        break;
      }
      case 'sandstone_side': {
        const base = hexToRgb('#d8c488');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            let f = 1 + (rand() - 0.5) * 0.08;
            if (y === 3 || y === 9 || y === 14) f *= 0.86;
            if (y < 3) f *= 1.06;
            setPx(data, x, y, shadeColor(base, f));
          }
        }
        break;
      }
      case 'sandstone_top': {
        fillNoise(data, rand, '#dfd09a', 0.09);
        break;
      }
      case 'gravel': {
        fillNoise(data, rand, '#8c8683', 0.25);
        break;
      }
      case 'clay': {
        fillNoise(data, rand, '#9ea7b5', 0.1);
        break;
      }
      case 'ice': {
        const base = hexToRgb('#92c7f7');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const streak = (x + y === 11 || x + y === 12 || x + y === 20) ? 1.16 : 1.0;
            setPx(data, x, y, shadeColor(base, streak + (rand() - 0.5) * 0.06), 235);
          }
        }
        break;
      }
      case 'water': {
        const base = hexToRgb('#2a84e2');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const ripple = ((x + y * 2) % 8 < 2) ? 1.18 : 0.96;
            setPx(data, x, y, shadeColor(base, ripple + (rand() - 0.5) * 0.06), 192);
          }
        }
        break;
      }
      case 'oak_log':
      case 'spruce_log': {
        const base = hexToRgb(name === 'oak_log' ? '#6d5030' : '#46301d');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const groove = (x % 4 === 0) ? 0.82 : 1.05;
            setPx(data, x, y, shadeColor(base, groove + (rand() - 0.5) * 0.14));
          }
        }
        break;
      }
      case 'birch_log': {
        fillNoise(data, rand, '#e3dfd5', 0.08);
        for (let i = 0; i < 12; i++) {
          const bx = Math.floor(rand() * 14);
          const by = Math.floor(rand() * 15);
          setPx(data, bx, by, hexToRgb('#3e3c38'));
          setPx(data, bx + 1, by, hexToRgb('#54514b'));
        }
        break;
      }
      case 'oak_log_top':
      case 'birch_log_top':
      case 'spruce_log_top': {
        const bark = hexToRgb(name === 'birch_log_top' ? '#dcd8ce' : name === 'spruce_log_top' ? '#46301d' : '#6d5030');
        const heart = hexToRgb(name === 'birch_log_top' ? '#c9b47e' : name === 'spruce_log_top' ? '#8c663d' : '#ab8650');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
            if (dist > 6) setPx(data, x, y, bark);
            else {
              const ring = Math.round(dist) % 2 === 0 ? 0.93 : 1.06;
              setPx(data, x, y, shadeColor(heart, ring));
            }
          }
        }
        break;
      }
      case 'cactus_side': {
        const base = hexToRgb('#468732');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const rib = (x % 4 === 1) ? 1.12 : (x % 4 === 0 ? 0.82 : 0.98);
            setPx(data, x, y, shadeColor(base, rib + (rand() - 0.5) * 0.08));
            if (x % 4 === 1 && y % 5 === 2) {
              setPx(data, x, y, hexToRgb('#dce3a8'));
            }
          }
        }
        break;
      }
      case 'cactus_top': {
        fillNoise(data, rand, '#559c3d', 0.12);
        break;
      }
      case 'oak_leaves':
      case 'birch_leaves':
      case 'spruce_leaves': {
        const hex = name === 'birch_leaves' ? '#6ca444' : name === 'spruce_leaves' ? '#336443' : '#458d31';
        const base = hexToRgb(hex);
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            if (rand() < 0.14 && x > 0 && x < 15 && y > 0 && y < 15) {
              setPx(data, x, y, [0, 0, 0], 0);
            } else {
              setPx(data, x, y, shadeColor(base, 0.85 + rand() * 0.32));
            }
          }
        }
        break;
      }
      case 'oak_planks':
      case 'birch_planks':
      case 'spruce_planks': {
        const hex = name === 'birch_planks' ? '#d4c28d' : name === 'spruce_planks' ? '#7a5837' : '#b28c56';
        const base = hexToRgb(hex);
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            let f = 1 + (rand() - 0.5) * 0.1;
            if (y % 4 === 3) f *= 0.78;
            if ((y >> 2) % 2 === 0 && x === 8) f *= 0.8;
            if ((y >> 2) % 2 === 1 && x === 3) f *= 0.8;
            setPx(data, x, y, shadeColor(base, f));
          }
        }
        break;
      }
      case 'workbench_top': {
        fillNoise(data, rand, '#a47743', 0.08);
        for (let i = 0; i < 16; i++) {
          setPx(data, i, 0, hexToRgb('#5c3d1e'));
          setPx(data, i, 15, hexToRgb('#5c3d1e'));
          setPx(data, 0, i, hexToRgb('#5c3d1e'));
          setPx(data, 15, i, hexToRgb('#5c3d1e'));
        }
        for (let y = 3; y <= 12; y++) {
          for (let x = 3; x <= 12; x++) {
            const line = (x === 3 || x === 6 || x === 9 || x === 12 || y === 3 || y === 6 || y === 9 || y === 12);
            setPx(data, x, y, hexToRgb(line ? '#5e3f20' : '#c99e63'));
          }
        }
        break;
      }
      case 'workbench_side': {
        fillNoise(data, rand, '#ab824e', 0.1);
        for (let x = 0; x < 16; x++) {
          setPx(data, x, 0, hexToRgb('#5e3f20'));
          setPx(data, x, 1, hexToRgb('#7a532c'));
          setPx(data, x, 15, hexToRgb('#5e3f20'));
        }
        // Little pixel saw & hammer silhouette
        for (let y = 5; y <= 11; y++) {
          setPx(data, 4, y, hexToRgb('#cfd5dc'));
          setPx(data, 5, y, hexToRgb('#9aa2ab'));
          setPx(data, 11, y, hexToRgb('#5b3d20'));
        }
        setPx(data, 10, 5, hexToRgb('#cfd5dc'));
        setPx(data, 11, 5, hexToRgb('#cfd5dc'));
        setPx(data, 12, 5, hexToRgb('#cfd5dc'));
        break;
      }
      case 'furnace_top': {
        fillNoise(data, rand, '#74787d', 0.12);
        for (let i = 1; i < 15; i++) {
          setPx(data, i, 1, hexToRgb('#55585c'));
          setPx(data, i, 14, hexToRgb('#55585c'));
          setPx(data, 1, i, hexToRgb('#55585c'));
          setPx(data, 14, i, hexToRgb('#55585c'));
        }
        break;
      }
      case 'furnace_front': {
        fillNoise(data, rand, '#74787d', 0.14);
        for (let y = 3; y <= 7; y++) {
          for (let x = 4; x <= 11; x++) {
            setPx(data, x, y, hexToRgb('#2a2c30'));
          }
        }
        for (let y = 10; y <= 13; y++) {
          for (let x = 4; x <= 11; x++) {
            setPx(data, x, y, hexToRgb(y > 11 && (x === 6 || x === 8 || x === 9) ? '#ff8b2b' : '#3a2820'));
          }
        }
        break;
      }
      case 'glass': {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const border = x === 0 || x === 15 || y === 0 || y === 15;
            const glint = (x + y === 5 || x + y === 6) && x > 1 && y > 1;
            if (border) setPx(data, x, y, hexToRgb('#cdeaf5'), 255);
            else if (glint) setPx(data, x, y, hexToRgb('#eefaff'), 230);
            else setPx(data, x, y, [0, 0, 0], 0);
          }
        }
        break;
      }
      case 'bricks': {
        const brick = hexToRgb('#a64f3e');
        const mortar = hexToRgb('#cbbab0');
        for (let y = 0; y < 16; y++) {
          const row = y >> 2;
          for (let x = 0; x < 16; x++) {
            const isMortar = (y % 4 === 3) || ((x + (row % 2) * 4) % 8 === 7);
            if (isMortar) setPx(data, x, y, mortar);
            else setPx(data, x, y, shadeColor(brick, 0.92 + rand() * 0.18));
          }
        }
        break;
      }
      case 'torch': {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            setPx(data, x, y, [0, 0, 0], 0);
          }
        }
        for (let y = 6; y < 16; y++) {
          setPx(data, 7, y, hexToRgb('#8a6236'));
          setPx(data, 8, y, hexToRgb('#6d4b26'));
        }
        setPx(data, 7, 5, hexToRgb('#ff9326'));
        setPx(data, 8, 5, hexToRgb('#ffad33'));
        setPx(data, 7, 4, hexToRgb('#ffe66d'));
        setPx(data, 8, 4, hexToRgb('#fff7b2'));
        setPx(data, 6, 4, hexToRgb('#ff7b1c'));
        setPx(data, 9, 4, hexToRgb('#ff7b1c'));
        setPx(data, 7, 3, hexToRgb('#ffd24c'));
        break;
      }
      case 'glowstone': {
        const base = hexToRgb('#f5c256');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const r = rand();
            if (r > 0.72) setPx(data, x, y, hexToRgb('#fff3a8'));
            else if (r < 0.22) setPx(data, x, y, hexToRgb('#b87828'));
            else setPx(data, x, y, shadeColor(base, 0.92 + rand() * 0.18));
          }
        }
        break;
      }
      case 'coal_ore': {
        fillNoise(data, rand, '#83878c', 0.14);
        paintOreSpots(data, rand, '#25272b', '#3e4248');
        break;
      }
      case 'iron_ore': {
        fillNoise(data, rand, '#83878c', 0.14);
        paintOreSpots(data, rand, '#d1a484', '#edd0ba');
        break;
      }
      case 'gold_ore': {
        fillNoise(data, rand, '#83878c', 0.14);
        paintOreSpots(data, rand, '#f0be37', '#fff08a');
        break;
      }
      case 'diamond_ore': {
        fillNoise(data, rand, '#656972', 0.15);
        paintOreSpots(data, rand, '#3de5db', '#b4fffb');
        break;
      }
      case 'tall_grass': {
        for (let i = 0; i < 16 * 16; i++) data[i * 4 + 3] = 0;
        const blades = [2, 4, 6, 8, 10, 12, 13];
        for (const bx of blades) {
          const h = 5 + Math.floor(rand() * 8);
          for (let y = 15; y >= 15 - h; y--) {
            const sway = y < 10 ? (bx % 2 === 0 ? 1 : -1) : 0;
            setPx(data, Math.max(0, Math.min(15, bx + sway)), y, shadeColor(hexToRgb('#59ad3e'), 0.86 + (15 - y) * 0.03));
          }
        }
        break;
      }
      case 'poppy':
      case 'dandelion':
      case 'cornflower': {
        for (let i = 0; i < 16 * 16; i++) data[i * 4 + 3] = 0;
        for (let y = 8; y < 16; y++) {
          setPx(data, 7, y, hexToRgb('#468f32'));
          if (y === 12) {
            setPx(data, 6, y, hexToRgb('#468f32'));
            setPx(data, 8, y + 1, hexToRgb('#468f32'));
          }
        }
        const petal = hexToRgb(
          name === 'poppy' ? '#e53935' : name === 'dandelion' ? '#f7d633' : '#4379f2'
        );
        const center = hexToRgb(name === 'poppy' ? '#3b1e1e' : '#fff4a3');
        for (let y = 4; y <= 8; y++) {
          for (let x = 5; x <= 9; x++) {
            if (Math.abs(x - 7) + Math.abs(y - 6) <= 2) {
              setPx(data, x, y, petal);
            }
          }
        }
        setPx(data, 7, 6, center);
        break;
      }
      case 'dead_shrub': {
        for (let i = 0; i < 16 * 16; i++) data[i * 4 + 3] = 0;
        const wood = hexToRgb('#8a6840');
        for (let y = 8; y < 16; y++) setPx(data, 7, y, wood);
        setPx(data, 6, 10, wood); setPx(data, 5, 9, wood); setPx(data, 4, 8, wood);
        setPx(data, 8, 11, wood); setPx(data, 9, 10, wood); setPx(data, 10, 9, wood);
        setPx(data, 6, 7, wood); setPx(data, 8, 7, wood);
        break;
      }
      case 'bookshelf': {
        fillNoise(data, rand, '#b28c56', 0.08);
        const colors = ['#c94038', '#3c78c9', '#43964b', '#d4a638', '#7d49b8'];
        for (const shelfY of [2, 9]) {
          for (let y = shelfY; y < shelfY + 5; y++) {
            for (let x = 1; x < 15; x++) {
              const bookIdx = Math.floor(x / 3);
              const col = hexToRgb(colors[(bookIdx + shelfY) % colors.length]);
              setPx(data, x, y, shadeColor(col, x % 3 === 0 ? 0.8 : 1.05));
            }
          }
        }
        break;
      }
      case 'wool': {
        fillNoise(data, rand, '#f2eee4', 0.08);
        break;
      }
      case 'crate': {
        fillNoise(data, rand, '#a47744', 0.1);
        for (let i = 0; i < 16; i++) {
          setPx(data, i, 0, hexToRgb('#5d4022'));
          setPx(data, i, 15, hexToRgb('#5d4022'));
          setPx(data, 0, i, hexToRgb('#5d4022'));
          setPx(data, 15, i, hexToRgb('#5d4022'));
          setPx(data, i, i, hexToRgb('#7d5830'));
        }
        break;
      }
      default: {
        fillNoise(data, rand, '#ff00ff', 0.1);
      }
    }
  }, 1000 + idx * 37);
}

function drawToolPixelArt(ctx, kind, headHex, hiHex) {
  const handle = '#7b5531';
  const put = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };

  if (kind === 'sword') {
    for (let i = 0; i < 4; i++) put(2 + i, 13 - i, handle);
    put(4, 9, '#553a20'); put(5, 10, '#553a20'); put(6, 11, '#553a20');
    put(3, 8, headHex); put(7, 12, headHex);
    for (let i = 0; i < 8; i++) {
      put(6 + i, 9 - i, hiHex);
      put(7 + i, 9 - i, headHex);
      if (i < 7) put(6 + i, 8 - i, headHex);
    }
    return;
  }

  // Diagonal handle for pickaxe / axe / shovel
  for (let i = 0; i < 10; i++) {
    put(2 + i, 13 - i, i % 2 === 0 ? handle : '#664526');
  }

  if (kind === 'pickaxe') {
    const pts = [
      [8, 2], [9, 2], [10, 2], [11, 2], [12, 3], [13, 4], [13, 5], [13, 6], [13, 7],
      [7, 3], [11, 3], [12, 4], [12, 5],
    ];
    for (const [x, y] of pts) put(x, y, headHex);
    put(9, 2, hiHex); put(10, 2, hiHex); put(11, 3, hiHex);
  } else if (kind === 'axe') {
    const pts = [
      [8, 2], [9, 2], [10, 2], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
      [7, 4], [8, 4], [9, 4], [11, 4], [8, 5], [12, 5], [12, 6],
    ];
    for (const [x, y] of pts) put(x, y, headHex);
    put(8, 2, hiHex); put(9, 3, hiHex); put(7, 4, hiHex);
  } else if (kind === 'shovel') {
    for (let y = 2; y <= 5; y++) {
      for (let x = 10; x <= 13; x++) {
        if (x === 10 && y === 5) continue;
        put(x, y, x === 11 && y <= 3 ? hiHex : headHex);
      }
    }
  }
}

function generateItemSpriteCanvas(iconName) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  const put = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };

  const tierColors = {
    wood: ['#a9804b', '#c99f65'],
    stone: ['#84888e', '#aeb3ba'],
    iron: ['#d2d8df', '#f4f8fc'],
    diamond: ['#39e2d8', '#aefcf7'],
  };

  for (const tier of Object.keys(tierColors)) {
    for (const tool of ['pickaxe', 'axe', 'shovel', 'sword']) {
      if (iconName === `${tier}_${tool}`) {
        drawToolPixelArt(ctx, tool, tierColors[tier][0], tierColors[tier][1]);
        return c;
      }
    }
  }

  if (iconName === 'stick') {
    for (let i = 0; i < 10; i++) {
      put(3 + i, 12 - i, i % 2 === 0 ? '#8c6438' : '#6f4d29');
      put(4 + i, 12 - i, '#593d20');
    }
  } else if (iconName === 'coal') {
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 8) < 5.2) {
          put(x, y, (x + y) % 3 === 0 ? '#42464f' : '#24272c');
        }
      }
    }
  } else if (iconName === 'iron_ingot' || iconName === 'gold_ingot') {
    const main = iconName === 'iron_ingot' ? '#cfd6de' : '#f0be38';
    const hi = iconName === 'iron_ingot' ? '#f5f9fd' : '#fff29c';
    const lo = iconName === 'iron_ingot' ? '#8c949e' : '#b8841c';
    for (let y = 5; y <= 10; y++) {
      for (let x = 3; x <= 12; x++) {
        if (y === 5 || x === 3) put(x, y, hi);
        else if (y === 10 || x === 12) put(x, y, lo);
        else put(x, y, main);
      }
    }
  } else if (iconName === 'diamond') {
    for (let y = 3; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) <= 4.5) {
          put(x, y, x < 7 && y < 7 ? '#c2fffa' : '#32ded4');
        }
      }
    }
  } else if (iconName === 'apple') {
    put(8, 2, '#5c3f21'); put(9, 2, '#4ba135'); put(10, 3, '#4ba135');
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 8) <= 4.6) {
          put(x, y, x <= 6 && y <= 6 ? '#ff756b' : '#d9342b');
        }
      }
    }
  } else if (iconName === 'raw_meat' || iconName === 'cooked_meat') {
    const main = iconName === 'cooked_meat' ? '#8c4c27' : '#d65c5c';
    const fat = iconName === 'cooked_meat' ? '#cfa36e' : '#f5d5cf';
    for (let y = 4; y <= 11; y++) {
      for (let x = 3; x <= 12; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) <= 5.2) {
          put(x, y, (x + y === 12 || x + y === 13) ? fat : main);
        }
      }
    }
  } else if (iconName === 'bread') {
    for (let y = 6; y <= 11; y++) {
      for (let x = 2; x <= 13; x++) {
        if (Math.abs(x - 7.5) * 0.7 + Math.abs(y - 8.5) <= 4.5) {
          put(x, y, y <= 7 ? '#e3ad4b' : '#b87f2c');
        }
      }
    }
  }

  return c;
}

function renderIsometricBlockIcon(topCanvas, sideCanvas) {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Left face
  ctx.save();
  ctx.translate(6, 14.5);
  ctx.transform(1, 0.5, 0, 1.12, 0, 0);
  ctx.drawImage(sideCanvas, 0, 0, 18.4, 18.4);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fillRect(0, 0, 18.4, 18.4);
  ctx.restore();

  // Right face
  ctx.save();
  ctx.translate(24, 23.5);
  ctx.transform(1, -0.5, 0, 1.12, 0, 0);
  ctx.drawImage(sideCanvas, 0, 0, 18.4, 18.4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, 18.4, 18.4);
  ctx.restore();

  // Top diamond drawn last for crisp upper ridge
  ctx.save();
  ctx.translate(24, 5.5);
  ctx.transform(1, 0.5, -1, 0.5, 0, 0);
  ctx.drawImage(topCanvas, 0, 0, 18.4, 18.4);
  ctx.restore();

  return c.toDataURL();
}

function buildExtrudedPixelGeometry(spriteCanvas, size = 0.34, depth = 0.028) {
  const ctx = spriteCanvas.getContext('2d');
  const w = spriteCanvas.width;
  const h = spriteCanvas.height;
  const img = ctx.getImageData(0, 0, w, h).data;

  const isOpaque = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return img[(y * w + x) * 4 + 3] > 60;
  };

  const positions = [];
  const colors = [];
  const indices = [];
  let vCount = 0;

  const pxSize = size / w;
  const halfSize = size * 0.5;
  const halfDepth = depth * 0.5;

  const pushQuad = (p0, p1, p2, p3, r, g, b, shade) => {
    const base = vCount;
    positions.push(...p0, ...p1, ...p2, ...p3);
    const cr = (r / 255) * shade;
    const cg = (g / 255) * shade;
    const cb = (b / 255) * shade;
    for (let i = 0; i < 4; i++) colors.push(cr, cg, cb);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    vCount += 4;
  };

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!isOpaque(px, py)) continue;
      const idx = (py * w + px) * 4;
      const r = img[idx];
      const g = img[idx + 1];
      const b = img[idx + 2];

      const x0 = px * pxSize - halfSize;
      const x1 = (px + 1) * pxSize - halfSize;
      const y1 = (h - py) * pxSize - halfSize;
      const y0 = (h - py - 1) * pxSize - halfSize;

      // Front (+Z) & Back (-Z)
      pushQuad([x0, y0, halfDepth], [x1, y0, halfDepth], [x1, y1, halfDepth], [x0, y1, halfDepth], r, g, b, 1.0);
      pushQuad([x1, y0, -halfDepth], [x0, y0, -halfDepth], [x0, y1, -halfDepth], [x1, y1, -halfDepth], r, g, b, 0.85);

      // Perimeter thickness faces where adjacent pixel is transparent
      if (!isOpaque(px, py - 1)) {
        pushQuad([x0, y1, halfDepth], [x1, y1, halfDepth], [x1, y1, -halfDepth], [x0, y1, -halfDepth], r, g, b, 1.06);
      }
      if (!isOpaque(px, py + 1)) {
        pushQuad([x0, y0, -halfDepth], [x1, y0, -halfDepth], [x1, y0, halfDepth], [x0, y0, halfDepth], r, g, b, 0.65);
      }
      if (!isOpaque(px + 1, py)) {
        pushQuad([x1, y0, halfDepth], [x1, y0, -halfDepth], [x1, y1, -halfDepth], [x1, y1, halfDepth], r, g, b, 0.78);
      }
      if (!isOpaque(px - 1, py)) {
        pushQuad([x0, y0, -halfDepth], [x0, y0, halfDepth], [x0, y1, halfDepth], [x0, y1, -halfDepth], r, g, b, 0.78);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}

function scaleSpriteToIcon(spriteCanvas) {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, 4, 4, 40, 40);
  return c.toDataURL();
}

export class TextureManager {
  constructor() {
    this.tileCanvases = new Map();
    this.spriteCanvases = new Map();
    this.extrudedGeoms = new Map();
    this.uvMap = new Map();
    this.iconUrls = new Map();
    this.itemTextures = new Map();
    this.crackTextures = [];

    this._buildAtlas();
    this._buildCrackTextures();
    this._buildIcons();
  }

  _buildAtlas() {
    const width = ATLAS_COLS * CELL_SIZE;
    const height = ATLAS_ROWS * CELL_SIZE;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = width;
    atlasCanvas.height = height;
    const ctx = atlasCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    TEXTURE_NAMES.forEach((name, idx) => {
      const tile = generateBlockTile(name, idx);
      this.tileCanvases.set(name, tile);

      const col = idx % ATLAS_COLS;
      const row = Math.floor(idx / ATLAS_COLS);
      const ox = col * CELL_SIZE + PAD;
      const oy = row * CELL_SIZE + PAD;

      // Center 16x16
      ctx.drawImage(tile, ox, oy);

      // Clamp edges into 4px padding around tile to prevent any bleeding
      ctx.drawImage(tile, 0, 0, 16, 1, ox, oy - PAD, 16, PAD); // top
      ctx.drawImage(tile, 0, 15, 16, 1, ox, oy + 16, 16, PAD); // bottom
      ctx.drawImage(tile, 0, 0, 1, 16, ox - PAD, oy, PAD, 16); // left
      ctx.drawImage(tile, 15, 0, 1, 16, ox + 16, oy, PAD, 16); // right
      // Corners
      ctx.drawImage(tile, 0, 0, 1, 1, ox - PAD, oy - PAD, PAD, PAD);
      ctx.drawImage(tile, 15, 0, 1, 1, ox + 16, oy - PAD, PAD, PAD);
      ctx.drawImage(tile, 0, 15, 1, 1, ox - PAD, oy + 16, PAD, PAD);
      ctx.drawImage(tile, 15, 15, 1, 1, ox + 16, oy + 16, PAD, PAD);

      const eps = 0.04;
      const u0 = (ox + eps) / width;
      const u1 = (ox + TILE_SIZE - eps) / width;
      // Three.js flipY = true means v=1 is top of canvas
      const v1 = 1.0 - (oy + eps) / height;
      const v0 = 1.0 - (oy + TILE_SIZE - eps) / height;

      this.uvMap.set(name, { u0, v0, u1, v1 });
    });

    this.atlasTexture = new THREE.CanvasTexture(atlasCanvas);
    this.atlasTexture.magFilter = THREE.NearestFilter;
    this.atlasTexture.minFilter = THREE.NearestFilter;
    this.atlasTexture.generateMipmaps = false;
    this.atlasTexture.colorSpace = THREE.SRGBColorSpace;
    this.atlasTexture.needsUpdate = true;
  }

  _buildCrackTextures() {
    const rand = createPRNG(909);
    const branches = [];
    for (let b = 0; b < 7; b++) {
      let x = 8, y = 8;
      const pts = [[x, y]];
      const angle = (b / 7) * Math.PI * 2 + 0.3;
      for (let step = 1; step <= 10; step++) {
        x += Math.cos(angle + (rand() - 0.5) * 0.9) * 0.9;
        y += Math.sin(angle + (rand() - 0.5) * 0.9) * 0.9;
        pts.push([Math.round(x), Math.round(y)]);
      }
      branches.push(pts);
    }

    for (let stage = 0; stage < 10; stage++) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(18, 18, 22, 0.78)';
      const maxStep = stage + 1;
      for (const pts of branches) {
        for (let s = 0; s < Math.min(pts.length, maxStep + 1); s++) {
          const [px, py] = pts[s];
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

  _buildIcons() {
    for (const key of Object.keys(BLOCK)) {
      const id = BLOCK[key];
      if (id === BLOCK.AIR) continue;
      const def = getDef(id);
      if (!def || !def.textures) continue;
      const topName = def.textures.top || def.textures.all;
      const sideName = def.textures.side || def.textures.all;
      const topCanvas = this.tileCanvases.get(topName);
      const sideCanvas = this.tileCanvases.get(sideName);
      if (def.crossMesh) {
        this.spriteCanvases.set(id, topCanvas);
        this.iconUrls.set(id, scaleSpriteToIcon(topCanvas));
        const tex = new THREE.CanvasTexture(topCanvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.itemTextures.set(id, tex);
      } else if (topCanvas && sideCanvas) {
        this.iconUrls.set(id, renderIsometricBlockIcon(topCanvas, sideCanvas));
      }
    }
  }

  getUV(textureName) {
    return this.uvMap.get(textureName) || this.uvMap.get('stone');
  }

  getBlockFaceUV(blockId, faceDir) {
    const def = getDef(blockId);
    if (!def || !def.textures) return this.getUV('stone');
    if (def.textures.all) return this.getUV(def.textures.all);
    if (faceDir === 'top') return this.getUV(def.textures.top || def.textures.side);
    if (faceDir === 'bottom') return this.getUV(def.textures.bottom || def.textures.side);
    return this.getUV(def.textures.side);
  }

  getIconUrl(id) {
    if (this.iconUrls.has(id)) return this.iconUrls.get(id);
    const def = getDef(id);
    if (def && !def.isBlock && def.icon) {
      const sprite = generateItemSpriteCanvas(def.icon);
      this.spriteCanvases.set(id, sprite);
      const url = scaleSpriteToIcon(sprite);
      this.iconUrls.set(id, url);

      const tex = new THREE.CanvasTexture(sprite);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.itemTextures.set(id, tex);
      return url;
    }
    return '';
  }

  getItemTexture(id) {
    if (!this.itemTextures.has(id)) {
      this.getIconUrl(id);
    }
    return this.itemTextures.get(id) || null;
  }

  getExtrudedItemGeometry(id) {
    if (this.extrudedGeoms.has(id)) return this.extrudedGeoms.get(id);
    if (!this.spriteCanvases.has(id)) {
      this.getIconUrl(id);
    }
    const sprite = this.spriteCanvases.get(id);
    if (!sprite) return null;
    const geom = buildExtrudedPixelGeometry(sprite, 0.34, 0.028);
    this.extrudedGeoms.set(id, geom);
    return geom;
  }
}
