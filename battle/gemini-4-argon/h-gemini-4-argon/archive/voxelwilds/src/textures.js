import * as THREE from 'three';
import { BLOCK, getBlockDef, getAllItems } from './blocks.js';

const TILE_SIZE = 16;
const PAD = 8;
const SLOT_SIZE = TILE_SIZE + PAD * 2; // 32px per slot
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

function seededHash(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeRgb([r, g, b], factor) {
  return [
    Math.max(0, Math.min(255, Math.round(r * factor))),
    Math.max(0, Math.min(255, Math.round(g * factor))),
    Math.max(0, Math.min(255, Math.round(b * factor))),
  ];
}

function setPx(ctx, x, y, rgb, alpha = 255) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha / 255})`;
  ctx.fillRect(x, y, 1, 1);
}

function fillNoiseTile(ctx, baseHex, variance = 0.12, seed = 1) {
  const base = hexToRgb(baseHex);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (seededHash(x, y, seed) - 0.5) * 2 * variance;
      setPx(ctx, x, y, shadeRgb(base, 1 + n));
    }
  }
}

const TILE_NAMES = [
  'grass_top',
  'grass_side',
  'dirt',
  'stone',
  'cobblestone',
  'sand',
  'sandstone_top',
  'sandstone_side',
  'sandstone_bottom',
  'gravel',
  'water',
  'bedrock',
  'oak_log_side',
  'oak_log_top',
  'oak_leaves',
  'oak_planks',
  'birch_log_side',
  'birch_log_top',
  'birch_leaves',
  'birch_planks',
  'spruce_log_side',
  'spruce_log_top',
  'spruce_leaves',
  'spruce_planks',
  'snow',
  'snow_grass_side',
  'ice',
  'clay',
  'terracotta',
  'red_sand',
  'coal_ore',
  'iron_ore',
  'gold_ore',
  'diamond_ore',
  'crafting_top',
  'crafting_side',
  'furnace_top',
  'furnace_front',
  'glass',
  'bricks',
  'stone_bricks',
  'mossy_stone_bricks',
  'bookshelf',
  'glowstone',
  'wool_white',
  'wool_red',
  'wool_blue',
  'torch',
  'tall_grass',
  'poppy',
  'dandelion',
  'mushroom_red',
  'dead_bush',
  'cactus_side',
  'cactus_top',
  'iron_block',
  'gold_block',
  'diamond_block',
];

function drawTile16(name) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);

  switch (name) {
    case 'grass_top': {
      fillNoiseTile(ctx, '#5ca83b', 0.14, 11);
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(seededHash(i, 3, 12) * 16);
        const y = Math.floor(seededHash(i, 9, 12) * 16);
        setPx(ctx, x, y, hexToRgb(i % 2 === 0 ? '#70bd4a' : '#4a8e2e'));
      }
      break;
    }
    case 'dirt': {
      fillNoiseTile(ctx, '#825839', 0.15, 21);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(seededHash(i, 1, 22) * 16);
        const y = Math.floor(seededHash(i, 7, 22) * 16);
        setPx(ctx, x, y, hexToRgb(i % 3 === 0 ? '#9c714f' : '#654229'));
      }
      break;
    }
    case 'grass_side': {
      ctx.drawImage(drawTile16('dirt'), 0, 0);
      const green = hexToRgb('#5ca83b');
      for (let x = 0; x < 16; x++) {
        const overhang = 2 + Math.floor(seededHash(x, 0, 31) * 3.5);
        for (let y = 0; y < overhang; y++) {
          const v = 1 + (seededHash(x, y, 32) - 0.5) * 0.2;
          setPx(ctx, x, y, shadeRgb(green, v));
        }
        setPx(ctx, x, overhang, hexToRgb('#487a2c'));
      }
      break;
    }
    case 'snow_grass_side': {
      ctx.drawImage(drawTile16('dirt'), 0, 0);
      const snow = hexToRgb('#f2f8fc');
      for (let x = 0; x < 16; x++) {
        const overhang = 3 + Math.floor(seededHash(x, 2, 35) * 3);
        for (let y = 0; y < overhang; y++) {
          setPx(ctx, x, y, shadeRgb(snow, 0.94 + seededHash(x, y, 36) * 0.08));
        }
        setPx(ctx, x, overhang, hexToRgb('#c8d9e6'));
      }
      break;
    }
    case 'stone': {
      const base = hexToRgb('#7f8086');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const streak = seededHash(Math.floor(x / 2), y, 41);
          const fine = seededHash(x, y, 42);
          const f = 0.88 + streak * 0.16 + (fine - 0.5) * 0.1;
          setPx(ctx, x, y, shadeRgb(base, f));
        }
      }
      break;
    }
    case 'cobblestone': {
      fillNoiseTile(ctx, '#737378', 0.12, 50);
      const cracks = [
        [0, 4], [1, 4], [2, 5], [3, 5], [4, 4], [5, 3], [6, 3], [7, 4],
        [8, 5], [9, 5], [10, 4], [11, 3], [12, 4], [13, 5], [14, 5], [15, 4],
        [4, 0], [4, 1], [5, 2], [11, 0], [11, 1], [11, 2],
        [0, 10], [1, 11], [2, 11], [3, 10], [4, 9], [5, 9], [6, 10], [7, 11],
        [8, 11], [9, 10], [10, 9], [11, 10], [12, 11], [13, 11], [14, 10], [15, 10],
        [7, 5], [7, 6], [8, 7], [8, 8], [8, 9],
        [3, 11], [3, 12], [2, 13], [2, 14], [3, 15],
        [12, 11], [12, 12], [13, 13], [13, 14], [12, 15],
      ];
      for (const [cx, cy] of cracks) {
        setPx(ctx, cx, cy, hexToRgb('#49494e'));
        if (cy + 1 < 16) setPx(ctx, cx, cy + 1, hexToRgb('#94949b'));
      }
      break;
    }
    case 'sand': {
      const base = hexToRgb('#e3d49b');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((x + y * 1.5) * 0.6) * 0.04;
          const n = (seededHash(x, y, 61) - 0.5) * 0.1;
          setPx(ctx, x, y, shadeRgb(base, 1 + wave + n));
        }
      }
      break;
    }
    case 'red_sand': {
      const base = hexToRgb('#cc6c35');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((x + y * 1.5) * 0.6) * 0.05;
          const n = (seededHash(x, y, 63) - 0.5) * 0.12;
          setPx(ctx, x, y, shadeRgb(base, 1 + wave + n));
        }
      }
      break;
    }
    case 'sandstone_top': {
      fillNoiseTile(ctx, '#dfd096', 0.08, 65);
      break;
    }
    case 'sandstone_bottom': {
      fillNoiseTile(ctx, '#cbb97d', 0.12, 66);
      break;
    }
    case 'sandstone_side': {
      fillNoiseTile(ctx, '#dac98e', 0.08, 67);
      for (let x = 0; x < 16; x++) {
        setPx(ctx, x, 3, hexToRgb('#efe3b2'));
        setPx(ctx, x, 4, hexToRgb('#baa76e'));
        setPx(ctx, x, 11, hexToRgb('#c2af75'));
      }
      break;
    }
    case 'gravel': {
      fillNoiseTile(ctx, '#888280', 0.22, 71);
      break;
    }
    case 'water': {
      const base = hexToRgb('#2d7de0');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ripple = Math.sin(x * 0.8 + y * 0.5) * 0.08;
          setPx(ctx, x, y, shadeRgb(base, 1 + ripple), 205);
        }
      }
      for (let x = 1; x < 15; x += 4) {
        setPx(ctx, x, (x * 3) % 16, hexToRgb('#7bb8ff'), 225);
        setPx(ctx, x + 1, (x * 3) % 16, hexToRgb('#7bb8ff'), 225);
      }
      break;
    }
    case 'bedrock': {
      fillNoiseTile(ctx, '#38383c', 0.35, 79);
      break;
    }
    case 'oak_log_side':
    case 'spruce_log_side': {
      const dark = name === 'spruce_log_side';
      const base = hexToRgb(dark ? '#48321e' : '#6b4f31');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const stripe = seededHash(x, Math.floor(y / 4), dark ? 83 : 81);
          const ridge = x % 4 === 0 ? -0.14 : x % 4 === 2 ? 0.08 : 0;
          setPx(ctx, x, y, shadeRgb(base, 0.92 + stripe * 0.18 + ridge));
        }
      }
      break;
    }
    case 'birch_log_side': {
      fillNoiseTile(ctx, '#e3dfd6', 0.07, 85);
      for (let i = 0; i < 10; i++) {
        const y = Math.floor(seededHash(i, 2, 86) * 15);
        const x = Math.floor(seededHash(i, 5, 86) * 13);
        setPx(ctx, x, y, hexToRgb('#3d3a36'));
        setPx(ctx, x + 1, y, hexToRgb('#3d3a36'));
        if (i % 2 === 0) setPx(ctx, x + 2, y, hexToRgb('#5e5a54'));
      }
      break;
    }
    case 'oak_log_top':
    case 'birch_log_top':
    case 'spruce_log_top': {
      const barkHex =
        name === 'birch_log_top' ? '#d8d4cb' : name === 'spruce_log_top' ? '#48321e' : '#6b4f31';
      const ringA =
        name === 'birch_log_top' ? '#d4c396' : name === 'spruce_log_top' ? '#85623d' : '#b59059';
      const ringB =
        name === 'birch_log_top' ? '#bfa977' : name === 'spruce_log_top' ? '#6e4f2f' : '#997643';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          if (dist >= 6.5) {
            setPx(ctx, x, y, hexToRgb(barkHex));
          } else {
            const ring = Math.floor(dist) % 2 === 0 ? ringA : ringB;
            setPx(ctx, x, y, hexToRgb(ring));
          }
        }
      }
      break;
    }
    case 'oak_leaves':
    case 'birch_leaves':
    case 'spruce_leaves': {
      const colorHex =
        name === 'birch_leaves' ? '#6aa848' : name === 'spruce_leaves' ? '#2f613e' : '#3d8f2d';
      const base = hexToRgb(colorHex);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const h = seededHash(x, y, name.length * 17);
          if (h < 0.14 && x > 0 && x < 15 && y > 0 && y < 15) {
            setPx(ctx, x, y, [0, 0, 0], 0);
          } else {
            setPx(ctx, x, y, shadeRgb(base, 0.8 + h * 0.36));
          }
        }
      }
      break;
    }
    case 'oak_planks':
    case 'birch_planks':
    case 'spruce_planks': {
      const baseHex =
        name === 'birch_planks' ? '#d6c596' : name === 'spruce_planks' ? '#7d5936' : '#b58d55';
      const base = hexToRgb(baseHex);
      for (let y = 0; y < 16; y++) {
        const plankRow = Math.floor(y / 4);
        for (let x = 0; x < 16; x++) {
          const isHorizontalSeam = y % 4 === 3;
          const jointX = (plankRow * 7 + 5) % 16;
          const isVerticalSeam = x === jointX;
          if (isHorizontalSeam || isVerticalSeam) {
            setPx(ctx, x, y, shadeRgb(base, 0.72));
          } else {
            const grain = (seededHash(Math.floor(x / 2), y, 95) - 0.5) * 0.12;
            setPx(ctx, x, y, shadeRgb(base, 1 + grain));
          }
        }
      }
      break;
    }
    case 'snow': {
      fillNoiseTile(ctx, '#f2f8fc', 0.05, 101);
      break;
    }
    case 'ice': {
      const base = hexToRgb('#94c6f7');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const diag = (x + y) % 7 === 0 ? 1.14 : 1.0;
          setPx(ctx, x, y, shadeRgb(base, diag), 228);
        }
      }
      break;
    }
    case 'clay': {
      fillNoiseTile(ctx, '#9ca4b3', 0.09, 108);
      break;
    }
    case 'terracotta': {
      const base = hexToRgb('#b86344');
      for (let y = 0; y < 16; y++) {
        const band = y < 4 ? 1.06 : y < 9 ? 0.94 : y < 13 ? 1.08 : 0.9;
        for (let x = 0; x < 16; x++) {
          setPx(ctx, x, y, shadeRgb(base, band + (seededHash(x, y, 111) - 0.5) * 0.06));
        }
      }
      break;
    }
    case 'coal_ore':
    case 'iron_ore':
    case 'gold_ore':
    case 'diamond_ore': {
      ctx.drawImage(drawTile16('stone'), 0, 0);
      const oreMap = {
        coal_ore: ['#262629', '#3d3d42'],
        iron_ore: ['#d8af93', '#b38366'],
        gold_ore: ['#ffdf4f', '#d9a421'],
        diamond_ore: ['#66fff2', '#26bfb8'],
      };
      const [bright, dark] = oreMap[name];
      const spots = [
        [3, 3], [4, 3], [3, 4],
        [10, 4], [11, 4], [11, 5],
        [5, 9], [6, 9], [6, 10], [5, 10],
        [11, 11], [12, 11], [11, 12],
      ];
      spots.forEach(([sx, sy], idx) => {
        setPx(ctx, sx, sy, hexToRgb(idx % 2 === 0 ? bright : dark));
      });
      break;
    }
    case 'crafting_top': {
      ctx.drawImage(drawTile16('oak_planks'), 0, 0);
      const border = hexToRgb('#5e4124');
      const gridBg = hexToRgb('#9c7142');
      for (let y = 2; y < 14; y++) {
        for (let x = 2; x < 14; x++) {
          if (x === 2 || x === 13 || y === 2 || y === 13 || x === 6 || x === 9 || y === 6 || y === 9) {
            setPx(ctx, x, y, border);
          } else {
            setPx(ctx, x, y, gridBg);
          }
        }
      }
      break;
    }
    case 'crafting_side': {
      ctx.drawImage(drawTile16('oak_planks'), 0, 0);
      for (let x = 0; x < 16; x++) {
        setPx(ctx, x, 0, hexToRgb('#5e4124'));
        setPx(ctx, x, 1, hexToRgb('#785430'));
        setPx(ctx, x, 2, hexToRgb('#4a321a'));
      }
      // Little saw & hammer silhouette
      for (let y = 5; y < 12; y++) {
        setPx(ctx, 5, y, hexToRgb('#cfd5db'));
        setPx(ctx, 6, y, hexToRgb('#9ea6b0'));
        setPx(ctx, 11, y, hexToRgb('#614124'));
      }
      for (let x = 9; x <= 13; x++) {
        setPx(ctx, x, 5, hexToRgb('#cfd5db'));
        setPx(ctx, x, 6, hexToRgb('#8b939c'));
      }
      break;
    }
    case 'furnace_top': {
      fillNoiseTile(ctx, '#6e6e73', 0.1, 125);
      for (let i = 1; i < 15; i++) {
        setPx(ctx, i, 1, hexToRgb('#4f4f54'));
        setPx(ctx, i, 14, hexToRgb('#4f4f54'));
        setPx(ctx, 1, i, hexToRgb('#4f4f54'));
        setPx(ctx, 14, i, hexToRgb('#4f4f54'));
      }
      break;
    }
    case 'furnace_front': {
      ctx.drawImage(drawTile16('cobblestone'), 0, 0);
      for (let y = 4; y < 14; y++) {
        for (let x = 4; x < 12; x++) {
          if (y === 8) {
            setPx(ctx, x, y, hexToRgb('#59595e'));
          } else if (y > 9) {
            const glow = (x + y) % 2 === 0 ? '#ff9924' : '#ffcf4d';
            setPx(ctx, x, y, hexToRgb(glow));
          } else {
            setPx(ctx, x, y, hexToRgb('#252529'));
          }
        }
      }
      break;
    }
    case 'glass': {
      const frame = hexToRgb('#d7f3fa');
      for (let i = 0; i < 16; i++) {
        setPx(ctx, i, 0, frame, 235);
        setPx(ctx, i, 15, frame, 235);
        setPx(ctx, 0, i, frame, 235);
        setPx(ctx, 15, i, frame, 235);
      }
      // Subtle diagonal glint
      setPx(ctx, 3, 3, [255, 255, 255], 210);
      setPx(ctx, 4, 3, [255, 255, 255], 210);
      setPx(ctx, 3, 4, [255, 255, 255], 210);
      setPx(ctx, 11, 12, [255, 255, 255], 180);
      setPx(ctx, 12, 11, [255, 255, 255], 180);
      break;
    }
    case 'bricks': {
      const brick = hexToRgb('#a84d3f');
      const mortar = hexToRgb('#cfc7bc');
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        for (let x = 0; x < 16; x++) {
          if (y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7) {
            setPx(ctx, x, y, mortar);
          } else {
            const n = (seededHash(x, y, 131) - 0.5) * 0.14;
            setPx(ctx, x, y, shadeRgb(brick, 1 + n));
          }
        }
      }
      break;
    }
    case 'stone_bricks':
    case 'mossy_stone_bricks': {
      const stone = hexToRgb('#7d7e85');
      const seam = hexToRgb('#4f5057');
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 8);
        for (let x = 0; x < 16; x++) {
          if (y % 8 === 7 || (x + row * 8) % 16 === 15) {
            setPx(ctx, x, y, seam);
          } else {
            const n = (seededHash(x, y, 134) - 0.5) * 0.12;
            setPx(ctx, x, y, shadeRgb(stone, 1 + n));
          }
        }
      }
      if (name === 'mossy_stone_bricks') {
        for (let i = 0; i < 26; i++) {
          const mx = Math.floor(seededHash(i, 4, 135) * 16);
          const my = Math.floor(seededHash(i, 8, 135) * 16);
          setPx(ctx, mx, my, hexToRgb(i % 2 === 0 ? '#4e823b' : '#65994d'));
        }
      }
      break;
    }
    case 'bookshelf': {
      ctx.drawImage(drawTile16('oak_planks'), 0, 0);
      const colors = ['#b83737', '#2f6db5', '#3b8c47', '#c9972c', '#7c42a8'];
      for (const shelfY of [2, 9]) {
        for (let y = shelfY; y < shelfY + 5; y++) {
          for (let x = 1; x < 15; x++) {
            const bookIdx = Math.floor(x / 3);
            const col = hexToRgb(colors[(bookIdx + shelfY) % colors.length]);
            setPx(ctx, x, y, x % 3 === 0 ? shadeRgb(col, 0.72) : col);
          }
        }
      }
      break;
    }
    case 'glowstone': {
      const a = hexToRgb('#fff29c');
      const b = hexToRgb('#f5b836');
      const cCol = hexToRgb('#b8741d');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = seededHash(x, y, 141);
          setPx(ctx, x, y, r > 0.62 ? a : r > 0.25 ? b : cCol);
        }
      }
      break;
    }
    case 'wool_white':
      fillNoiseTile(ctx, '#efefef', 0.08, 151);
      break;
    case 'wool_red':
      fillNoiseTile(ctx, '#c43535', 0.1, 152);
      break;
    case 'wool_blue':
      fillNoiseTile(ctx, '#3364c4', 0.1, 153);
      break;
    case 'torch': {
      for (let y = 6; y < 16; y++) {
        setPx(ctx, 7, y, hexToRgb('#8c6236'));
        setPx(ctx, 8, y, hexToRgb('#6e4b26'));
      }
      setPx(ctx, 7, 5, hexToRgb('#ff9d2e'));
      setPx(ctx, 8, 5, hexToRgb('#ff9d2e'));
      setPx(ctx, 7, 4, hexToRgb('#ffe66d'));
      setPx(ctx, 8, 4, hexToRgb('#ffd147'));
      setPx(ctx, 7, 3, hexToRgb('#fff9bd'));
      break;
    }
    case 'tall_grass': {
      const blades = [2, 4, 6, 8, 10, 12, 14];
      for (const bx of blades) {
        const h = 6 + Math.floor(seededHash(bx, 1, 161) * 8);
        for (let y = 15; y >= 15 - h; y--) {
          const sway = y < 9 && bx % 4 === 0 ? 1 : 0;
          setPx(ctx, bx + sway, y, hexToRgb(y < 10 ? '#6dc246' : '#4a912d'));
        }
      }
      break;
    }
    case 'poppy': {
      for (let y = 8; y < 16; y++) setPx(ctx, 7, y, hexToRgb('#3d8529'));
      setPx(ctx, 6, 11, hexToRgb('#4ca135'));
      setPx(ctx, 8, 12, hexToRgb('#4ca135'));
      const petals = [
        [6, 5], [7, 5], [8, 5],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
        [6, 7], [7, 7], [8, 7],
      ];
      for (const [px, py] of petals) {
        setPx(ctx, px, py, hexToRgb(py === 5 ? '#ff4a4a' : '#d62424'));
      }
      setPx(ctx, 7, 6, hexToRgb('#2b1b1b'));
      break;
    }
    case 'dandelion': {
      for (let y = 9; y < 16; y++) setPx(ctx, 7, y, hexToRgb('#3d8529'));
      const petals = [
        [6, 5], [7, 5], [8, 5],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
        [6, 7], [7, 7], [8, 7], [7, 8],
      ];
      for (const [px, py] of petals) {
        setPx(ctx, px, py, hexToRgb(py <= 6 ? '#ffeb47' : '#e0b91b'));
      }
      break;
    }
    case 'mushroom_red': {
      for (let y = 10; y < 16; y++) {
        setPx(ctx, 7, y, hexToRgb('#e8dec8'));
        setPx(ctx, 8, y, hexToRgb('#cfc3aa'));
      }
      for (let y = 6; y <= 9; y++) {
        const span = y === 6 ? 2 : y === 7 ? 3 : 4;
        for (let x = 7 - span; x <= 8 + span - 1; x++) {
          setPx(ctx, x, y, hexToRgb('#d42c2c'));
        }
      }
      setPx(ctx, 6, 7, [255, 255, 255]);
      setPx(ctx, 9, 8, [255, 255, 255]);
      setPx(ctx, 7, 9, [255, 255, 255]);
      break;
    }
    case 'dead_bush': {
      const twigs = [
        [7, 15], [7, 14], [7, 13], [6, 12], [5, 11], [4, 10], [3, 9],
        [8, 12], [9, 11], [10, 10], [11, 9], [6, 10], [5, 8], [9, 9], [10, 7],
      ];
      for (const [tx, ty] of twigs) setPx(ctx, tx, ty, hexToRgb('#8a683e'));
      break;
    }
    case 'cactus_side': {
      const base = hexToRgb('#2d8736');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? 0.8 : x % 4 === 2 ? 1.12 : 1.0;
          setPx(ctx, x, y, shadeRgb(base, rib));
        }
      }
      for (let y = 2; y < 15; y += 4) {
        setPx(ctx, 2, y, hexToRgb('#e6e2b8'));
        setPx(ctx, 10, (y + 2) % 16, hexToRgb('#e6e2b8'));
      }
      break;
    }
    case 'cactus_top': {
      fillNoiseTile(ctx, '#389941', 0.1, 171);
      for (let i = 2; i < 14; i++) {
        setPx(ctx, i, 2, hexToRgb('#23692a'));
        setPx(ctx, i, 13, hexToRgb('#23692a'));
        setPx(ctx, 2, i, hexToRgb('#23692a'));
        setPx(ctx, 13, i, hexToRgb('#23692a'));
      }
      break;
    }
    case 'iron_block':
    case 'gold_block':
    case 'diamond_block': {
      const hex =
        name === 'gold_block' ? '#f5cd38' : name === 'diamond_block' ? '#57f2e5' : '#e1e5eb';
      const base = hexToRgb(hex);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || y === 0 ? 1.16 : x === 15 || y === 15 ? 0.78 : 1.0;
          const sheen = Math.sin((x - y) * 0.45) * 0.06;
          setPx(ctx, x, y, shadeRgb(base, border + sheen));
        }
      }
      break;
    }
    default:
      fillNoiseTile(ctx, '#ff00ff', 0.1, 999);
  }
  return c;
}

function drawItemPixelIcon(def) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);

  const stickRgb = hexToRgb('#7d5832');
  const stickHi = hexToRgb('#a37646');

  if (def.toolType) {
    const head = hexToRgb(def.materialColor || '#cccccc');
    const headDark = shadeRgb(head, 0.74);
    const headHi = shadeRgb(head, 1.18);

    if (def.toolType === 'sword') {
      // Diagonal handle & crossguard & blade
      setPx(ctx, 2, 13, stickDark(stickRgb));
      setPx(ctx, 3, 12, stickRgb);
      setPx(ctx, 4, 11, stickHi);
      // Guard
      for (const [gx, gy] of [[3, 9], [4, 10], [5, 10], [6, 11], [5, 9]]) {
        setPx(ctx, gx, gy, headDark);
      }
      // Blade
      for (let i = 0; i < 8; i++) {
        const bx = 6 + i;
        const by = 9 - i;
        setPx(ctx, bx, by, headHi);
        setPx(ctx, bx - 1, by, head);
        setPx(ctx, bx, by + 1, headDark);
      }
    } else {
      // Diagonal wooden handle
      for (let i = 0; i < 9; i++) {
        setPx(ctx, 2 + i, 13 - i, i % 2 === 0 ? stickRgb : stickHi);
      }
      if (def.toolType === 'pickaxe') {
        const headPts = [
          [7, 2], [8, 2], [9, 2], [10, 2], [11, 3], [12, 4], [13, 5], [13, 6], [13, 7],
          [8, 3], [9, 3], [10, 3], [11, 4], [12, 5], [12, 6],
        ];
        headPts.forEach(([px, py], idx) => setPx(ctx, px, py, idx < 9 ? headHi : head));
        setPx(ctx, 6, 3, headDark);
        setPx(ctx, 13, 8, headDark);
      } else if (def.toolType === 'axe') {
        const bladePts = [
          [8, 2], [9, 2], [10, 2],
          [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
          [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
          [8, 5], [9, 5], [10, 5], [12, 5],
          [9, 6], [12, 6],
        ];
        bladePts.forEach(([px, py]) => setPx(ctx, px, py, px <= 8 ? headHi : head));
      } else if (def.toolType === 'shovel') {
        for (let y = 2; y <= 5; y++) {
          for (let x = 10; x <= 13; x++) {
            if (y === 2 && (x === 10 || x === 13)) continue;
            setPx(ctx, x, y, x === 11 ? headHi : head);
          }
        }
      }
    }
    return c;
  }

  switch (def.key) {
    case 'stick': {
      for (let i = 0; i < 10; i++) {
        setPx(ctx, 3 + i, 12 - i, stickHi);
        setPx(ctx, 4 + i, 12 - i, stickRgb);
      }
      break;
    }
    case 'coal': {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4.2) {
            setPx(ctx, x, y, hexToRgb(x + y < 14 ? '#3f3f46' : '#222227'));
          }
        }
      }
      setPx(ctx, 6, 6, hexToRgb('#62626b'));
      break;
    }
    case 'iron_ingot':
    case 'gold_ingot':
    case 'brick_item': {
      const col =
        def.key === 'gold_ingot'
          ? hexToRgb('#ffd84a')
          : def.key === 'brick_item'
            ? hexToRgb('#ba5747')
            : hexToRgb('#dfe4eb');
      for (let y = 5; y <= 10; y++) {
        const shift = Math.floor((10 - y) * 0.4);
        for (let x = 3 + shift; x <= 11 + shift; x++) {
          const f = y <= 6 ? 1.15 : y >= 9 ? 0.78 : 1.0;
          setPx(ctx, x, y, shadeRgb(col, f));
        }
      }
      break;
    }
    case 'diamond': {
      const col = hexToRgb('#4df5e7');
      for (let y = 3; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 7.8) < 5.2) {
            setPx(ctx, x, y, x < 7 && y < 8 ? hexToRgb('#b8fff8') : col);
          }
        }
      }
      break;
    }
    case 'apple': {
      const red = hexToRgb('#e03131');
      for (let y = 5; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 8.5) < 4.1) {
            setPx(ctx, x, y, x < 7 && y < 8 ? hexToRgb('#ff6b6b') : red);
          }
        }
      }
      setPx(ctx, 7, 3, stickRgb);
      setPx(ctx, 8, 4, hexToRgb('#48a832'));
      setPx(ctx, 9, 3, hexToRgb('#48a832'));
      break;
    }
    case 'raw_meat':
    case 'cooked_meat': {
      const meat = hexToRgb(def.key === 'cooked_meat' ? '#8c4e2b' : '#d95353');
      const trim = hexToRgb(def.key === 'cooked_meat' ? '#ba7849' : '#f2c9c9');
      for (let y = 4; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot((x - 7.5) * 0.85, y - 7.8) < 4.2) {
            const edge = Math.hypot((x - 7.5) * 0.85, y - 7.8) > 3.1;
            setPx(ctx, x, y, edge ? trim : meat);
          }
        }
      }
      break;
    }
  }
  return c;
}

function stickDark(rgb) {
  return shadeRgb(rgb, 0.72);
}

function renderIsometricBlockIcon(def, tileCanvases) {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (def.renderType === 'cross' || def.renderType === 'torch') {
    const tName = def.textures.all;
    const tile = tileCanvases.get(tName);
    if (tile) {
      ctx.drawImage(tile, 6, 6, 36, 36);
    }
    return c.toDataURL();
  }

  const topTile = tileCanvases.get(def.textures.top || def.textures.all);
  const sideTile = tileCanvases.get(def.textures.side || def.textures.all);

  // Isometric transforms for top, left, and right faces
  // Center top vertex at (24, 6), center junction at (24, 24)
  ctx.save();
  // Top face
  ctx.setTransform(1, 0.5, -1, 0.5, 24, 6);
  ctx.drawImage(topTile, 0, 0, 18, 18);
  ctx.restore();

  // Left face (slightly shaded)
  ctx.save();
  ctx.setTransform(1, 0.5, 0, 1.05, 6, 15);
  ctx.drawImage(sideTile, 0, 0, 18, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, 0, 18, 18);
  ctx.restore();

  // Right face (darker shade)
  ctx.save();
  ctx.setTransform(1, -0.5, 0, 1.05, 24, 24);
  ctx.drawImage(sideTile, 0, 0, 18, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 0, 18, 18);
  ctx.restore();

  return c.toDataURL();
}

export function createTextureSystem() {
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * SLOT_SIZE;
  atlasCanvas.height = ATLAS_ROWS * SLOT_SIZE;
  const ctx = atlasCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const tileCanvases = new Map();
  const tileUVMap = new Map();

  TILE_NAMES.forEach((name, idx) => {
    const tile = drawTile16(name);
    tileCanvases.set(name, tile);

    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    const sx = col * SLOT_SIZE;
    const sy = row * SLOT_SIZE;

    // Draw inner 16x16
    ctx.drawImage(tile, sx + PAD, sy + PAD);

    // Extrude edges by PAD pixels to eliminate seam bleeding completely
    // Top & bottom strips
    for (let p = 0; p < PAD; p++) {
      ctx.drawImage(tile, 0, 0, 16, 1, sx + PAD, sy + p, 16, 1);
      ctx.drawImage(tile, 0, 15, 16, 1, sx + PAD, sy + PAD + 16 + p, 16, 1);
      ctx.drawImage(tile, 0, 0, 1, 16, sx + p, sy + PAD, 1, 16);
      ctx.drawImage(tile, 15, 0, 1, 16, sx + PAD + 16 + p, sy + PAD, 1, 16);
    }

    const u0 = (sx + PAD) / atlasCanvas.width;
    const u1 = (sx + PAD + TILE_SIZE) / atlasCanvas.width;
    // Flip V for Three.js canvas texture coordinates (top of canvas = V=1)
    const v1 = 1 - (sy + PAD) / atlasCanvas.height;
    const v0 = 1 - (sy + PAD + TILE_SIZE) / atlasCanvas.height;

    tileUVMap.set(name, { u0, v0, u1, v1 });
  });

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.needsUpdate = true;

  // Pre-generate crisp UI icon Data URLs for every item and block
  const iconURLMap = new Map();
  const itemCanvasMap = new Map();

  for (const def of getAllItems()) {
    if (def.isBlock) {
      iconURLMap.set(def.id, renderIsometricBlockIcon(def, tileCanvases));
    } else {
      const pxCanvas = drawItemPixelIcon(def);
      itemCanvasMap.set(def.id, pxCanvas);
      const scaled = document.createElement('canvas');
      scaled.width = 48;
      scaled.height = 48;
      const sctx = scaled.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(pxCanvas, 0, 0, 48, 48);
      iconURLMap.set(def.id, scaled.toDataURL());
    }
  }

  return {
    atlasTexture,
    getTileUVs(tileName) {
      return tileUVMap.get(tileName) || tileUVMap.get('stone');
    },
    getBlockFaceUVs(blockId, faceDir) {
      const def = getBlockDef(blockId);
      if (!def || !def.textures) return tileUVMap.get('stone');
      let tName = def.textures.all;
      if (!tName) {
        if (faceDir === 'top') tName = def.textures.top;
        else if (faceDir === 'bottom') tName = def.textures.bottom;
        else tName = def.textures.side;
      }
      return tileUVMap.get(tName) || tileUVMap.get('stone');
    },
    getItemIconURL(id) {
      return iconURLMap.get(id) || '';
    },
    getItemCanvas(id) {
      return itemCanvasMap.get(id) || null;
    },
    getTileCanvas(name) {
      return tileCanvases.get(name) || tileCanvases.get('stone');
    },
  };
}
