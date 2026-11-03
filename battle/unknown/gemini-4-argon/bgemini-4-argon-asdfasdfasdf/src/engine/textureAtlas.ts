import * as THREE from 'three';
import { BLOCK, ITEM, ITEMS, TEX } from './blocks';

export const ATLAS_COLS = 8;
export const TILE_PX = 16;
export const ATLAS_SIZE = ATLAS_COLS * TILE_PX; // 128x128

function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177);
  n = (n ^ (n >>> 13)) >>> 0;
  return (n & 0xffff) / 0xffff;
}

function shadeHex(hex: string, factor: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

let cachedAtlasCanvas: HTMLCanvasElement | null = null;
let cachedTexture: THREE.CanvasTexture | null = null;
const iconCache = new Map<number, string>();

function setPx(ctx: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number, color: string) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  ctx.fillStyle = color;
  ctx.fillRect(tx * TILE_PX + x, ty * TILE_PX + y, 1, 1);
}

function clearTile(ctx: CanvasRenderingContext2D, tile: number) {
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  ctx.clearRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
}

function fillNoiseTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  baseHex: string,
  variance: number,
  seed: number,
  streakX = false
) {
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = streakX
        ? hash2(x >> 1, y, seed) * 0.7 + hash2(x, y, seed + 7) * 0.3
        : hash2(x, y, seed);
      const f = 1 + (n - 0.5) * variance;
      setPx(ctx, tx, ty, x, y, shadeHex(baseHex, f));
    }
  }
}

function paintOre(ctx: CanvasRenderingContext2D, tile: number, oreHex: string, glintHex: string, seed: number) {
  fillNoiseTile(ctx, tile, '#7a7e86', 0.2, 10 + seed, true);
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  const clusters = [
    [3, 4],
    [10, 3],
    [6, 9],
    [12, 11],
    [3, 12],
  ];
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy] = clusters[i];
    const ox = (cx + Math.floor(hash2(i, seed, 99) * 2)) % 14;
    const oy = (cy + Math.floor(hash2(seed, i, 55) * 2)) % 14;
    setPx(ctx, tx, ty, ox, oy, oreHex);
    setPx(ctx, tx, ty, ox + 1, oy, glintHex);
    setPx(ctx, tx, ty, ox, oy + 1, shadeHex(oreHex, 0.78));
    if (i % 2 === 0) setPx(ctx, tx, ty, ox + 1, oy + 1, oreHex);
  }
}

function paintPlanks(ctx: CanvasRenderingContext2D, tile: number, baseHex: string, seed: number) {
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  for (let y = 0; y < 16; y++) {
    const plankRow = Math.floor(y / 4);
    const isGroove = y % 4 === 3;
    const seamX = (plankRow * 7 + 4) % 16;
    for (let x = 0; x < 16; x++) {
      if (isGroove || x === seamX) {
        setPx(ctx, tx, ty, x, y, shadeHex(baseHex, 0.65));
      } else {
        const grain = hash2(x >> 2, y + plankRow * 13, seed);
        setPx(ctx, tx, ty, x, y, shadeHex(baseHex, 0.9 + grain * 0.22));
      }
    }
  }
}

function paintLogTop(ctx: CanvasRenderingContext2D, tile: number, barkHex: string, heartHex: string) {
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 6.6 || x === 0 || x === 15 || y === 0 || y === 15) {
        setPx(ctx, tx, ty, x, y, shadeHex(barkHex, 0.88 + hash2(x, y, 3) * 0.2));
      } else {
        const ring = Math.sin(dist * 2.1) * 0.1;
        setPx(ctx, tx, ty, x, y, shadeHex(heartHex, 0.94 + ring));
      }
    }
  }
}

function paintLeaves(ctx: CanvasRenderingContext2D, tile: number, leafHex: string, seed: number) {
  clearTile(ctx, tile);
  const tx = tile % ATLAS_COLS;
  const ty = Math.floor(tile / ATLAS_COLS);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hash2(x, y, seed);
      // Leave small pixel sky holes so canopies filter light beautifully
      if (n < 0.17 && x > 0 && x < 15 && y > 0 && y < 15) continue;
      const f = 0.72 + n * 0.52;
      setPx(ctx, tx, ty, x, y, shadeHex(leafHex, f));
    }
  }
}

export function getAtlasCanvas(): HTMLCanvasElement {
  if (cachedAtlasCanvas) return cachedAtlasCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;

  // 0: Bedrock
  fillNoiseTile(ctx, TEX.BEDROCK, '#2f3238', 0.65, 1);

  // 1: Stone
  fillNoiseTile(ctx, TEX.STONE, '#7d818a', 0.22, 2, true);

  // 2: Dirt
  fillNoiseTile(ctx, TEX.DIRT, '#825738', 0.28, 3);
  {
    const tx = TEX.DIRT % ATLAS_COLS;
    const ty = Math.floor(TEX.DIRT / ATLAS_COLS);
    setPx(ctx, tx, ty, 4, 6, '#9c9288');
    setPx(ctx, tx, ty, 11, 12, '#69442a');
    setPx(ctx, tx, ty, 13, 4, '#9c9288');
  }

  // 3: Grass Top
  fillNoiseTile(ctx, TEX.GRASS_TOP, '#56ab42', 0.24, 4);

  // 4: Grass Side
  fillNoiseTile(ctx, TEX.GRASS_SIDE, '#825738', 0.26, 3);
  {
    const tx = TEX.GRASS_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.GRASS_SIDE / ATLAS_COLS);
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + Math.floor(hash2(x, 0, 77) * 3);
      for (let y = 0; y < overhang; y++) {
        setPx(ctx, tx, ty, x, y, shadeHex('#56ab42', 0.86 + hash2(x, y, 12) * 0.28));
      }
      setPx(ctx, tx, ty, x, overhang, shadeHex('#825738', 0.68));
    }
  }

  // 5: Sand
  fillNoiseTile(ctx, TEX.SAND, '#e5d28e', 0.16, 5, true);

  // 6 & 7: Sandstone
  fillNoiseTile(ctx, TEX.SANDSTONE_TOP, '#dec983', 0.14, 6);
  {
    fillNoiseTile(ctx, TEX.SANDSTONE_SIDE, '#d8c178', 0.14, 7);
    const tx = TEX.SANDSTONE_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.SANDSTONE_SIDE / ATLAS_COLS);
    for (let x = 0; x < 16; x++) {
      setPx(ctx, tx, ty, x, 3, '#ead99b');
      setPx(ctx, tx, ty, x, 4, '#b89f58');
      setPx(ctx, tx, ty, x, 10, '#c2aa61');
    }
  }

  // 8 & 9: Snow & Snow Side
  fillNoiseTile(ctx, TEX.SNOW, '#f3f8fc', 0.08, 8);
  fillNoiseTile(ctx, TEX.SNOW_SIDE, '#825738', 0.25, 3);
  {
    const tx = TEX.SNOW_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.SNOW_SIDE / ATLAS_COLS);
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + Math.floor(hash2(x, 2, 91) * 3);
      for (let y = 0; y < overhang; y++) {
        setPx(ctx, tx, ty, x, y, shadeHex('#f3f8fc', 0.94 + hash2(x, y, 8) * 0.06));
      }
      setPx(ctx, tx, ty, x, overhang, '#cbd5e1');
    }
  }

  // 10: Ice
  {
    const tx = TEX.ICE % ATLAS_COLS;
    const ty = Math.floor(TEX.ICE / ATLAS_COLS);
    ctx.fillStyle = 'rgba(135, 198, 250, 0.82)';
    ctx.fillRect(tx * 16, ty * 16, 16, 16);
    for (let i = 0; i < 14; i++) {
      setPx(ctx, tx, ty, i, 14 - i, 'rgba(224, 242, 254, 0.92)');
      if (i < 9) setPx(ctx, tx, ty, i + 4, 10 - i, 'rgba(255, 255, 255, 0.85)');
    }
  }

  // 11: Clay & 12: Gravel
  fillNoiseTile(ctx, TEX.CLAY, '#9ba6b5', 0.16, 11);
  fillNoiseTile(ctx, TEX.GRAVEL, '#827d7a', 0.36, 12);

  // 13: Water
  {
    const tx = TEX.WATER % ATLAS_COLS;
    const ty = Math.floor(TEX.WATER / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x + y * 0.7) * 0.8) * 0.5 + 0.5;
        const r = Math.round(28 + wave * 36);
        const g = Math.round(118 + wave * 48);
        const b = Math.round(212 + wave * 34);
        ctx.fillStyle = `rgba(${r},${g},${b},0.76)`;
        ctx.fillRect(tx * 16 + x, ty * 16 + y, 1, 1);
      }
    }
  }

  // 14: Lava
  {
    const tx = TEX.LAVA % ATLAS_COLS;
    const ty = Math.floor(TEX.LAVA / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = hash2(x >> 1, y >> 1, 140) * 0.6 + Math.sin(x * 0.5 + y * 0.4) * 0.2 + 0.2;
        const color = n > 0.66 ? '#fde047' : n > 0.4 ? '#f97316' : '#dc2626';
        setPx(ctx, tx, ty, x, y, color);
      }
    }
  }

  // 15..20: Logs
  {
    const tx = TEX.OAK_LOG_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.OAK_LOG_SIDE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ridge = hash2(x, y >> 2, 15);
        setPx(ctx, tx, ty, x, y, shadeHex('#6e4e30', 0.76 + ridge * 0.44));
      }
    }
    paintLogTop(ctx, TEX.OAK_LOG_TOP, '#6e4e30', '#b88f5d');
  }
  {
    fillNoiseTile(ctx, TEX.BIRCH_LOG_SIDE, '#e5e2dc', 0.1, 17);
    const tx = TEX.BIRCH_LOG_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.BIRCH_LOG_SIDE / ATLAS_COLS);
    const marks = [
      [2, 3, 3],
      [9, 6, 4],
      [4, 11, 3],
      [11, 13, 3],
    ];
    for (const [mx, my, len] of marks) {
      for (let i = 0; i < len; i++) setPx(ctx, tx, ty, mx + i, my, '#2d3033');
    }
    paintLogTop(ctx, TEX.BIRCH_LOG_TOP, '#d6d2c9', '#d8c89e');
  }
  {
    const tx = TEX.PINE_LOG_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.PINE_LOG_SIDE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ridge = hash2(x, y >> 2, 19);
        setPx(ctx, tx, ty, x, y, shadeHex('#4a3320', 0.78 + ridge * 0.4));
      }
    }
    paintLogTop(ctx, TEX.PINE_LOG_TOP, '#4a3320', '#8c6540');
  }

  // 21..23: Leaves
  paintLeaves(ctx, TEX.OAK_LEAVES, '#3f9138', 21);
  paintLeaves(ctx, TEX.BIRCH_LEAVES, '#65a847', 22);
  paintLeaves(ctx, TEX.PINE_LEAVES, '#2c6644', 23);

  // 24..25: Cactus
  {
    fillNoiseTile(ctx, TEX.CACTUS_SIDE, '#2f8a41', 0.16, 24);
    const tx = TEX.CACTUS_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.CACTUS_SIDE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (const rx of [2, 6, 10, 14]) {
        setPx(ctx, tx, ty, rx, y, '#236931');
        if (y % 4 === 1) setPx(ctx, tx, ty, rx - 1, y, '#fef08a');
      }
    }
    paintLogTop(ctx, TEX.CACTUS_TOP, '#267035', '#52b05c');
  }

  // 26..29: Cross-Quad Flora
  {
    clearTile(ctx, TEX.TALL_GRASS);
    const tx = TEX.TALL_GRASS % ATLAS_COLS;
    const ty = Math.floor(TEX.TALL_GRASS / ATLAS_COLS);
    const stalks = [2, 4, 7, 9, 11, 14];
    for (const sx of stalks) {
      const h = 7 + Math.floor(hash2(sx, 1, 26) * 7);
      for (let y = 15; y >= 16 - h; y--) {
        const bend = y < 9 && sx % 2 === 0 ? 1 : 0;
        setPx(ctx, tx, ty, sx + bend, y, shadeHex('#52ab3e', 0.85 + (15 - y) * 0.03));
      }
    }
  }
  {
    clearTile(ctx, TEX.FLOWER_RED);
    const tx = TEX.FLOWER_RED % ATLAS_COLS;
    const ty = Math.floor(TEX.FLOWER_RED / ATLAS_COLS);
    for (let y = 8; y < 16; y++) setPx(ctx, tx, ty, 7 + (y > 12 ? 1 : 0), y, '#3d8f34');
    setPx(ctx, tx, ty, 6, 12, '#4ba640');
    setPx(ctx, tx, ty, 9, 11, '#4ba640');
    for (let dy = 4; dy <= 7; dy++) {
      for (let dx = 5; dx <= 9; dx++) {
        if ((dx === 5 || dx === 9) && dy === 7) continue;
        setPx(ctx, tx, ty, dx, dy, dy === 4 ? '#fb7185' : '#e11d48');
      }
    }
    setPx(ctx, tx, ty, 7, 6, '#3f1d24');
  }
  {
    clearTile(ctx, TEX.FLOWER_YELLOW);
    const tx = TEX.FLOWER_YELLOW % ATLAS_COLS;
    const ty = Math.floor(TEX.FLOWER_YELLOW / ATLAS_COLS);
    for (let y = 8; y < 16; y++) setPx(ctx, tx, ty, 7, y, '#439639');
    setPx(ctx, tx, ty, 6, 13, '#53ad46');
    setPx(ctx, tx, ty, 8, 12, '#53ad46');
    for (let dy = 5; dy <= 7; dy++) {
      for (let dx = 5; dx <= 9; dx++) {
        setPx(ctx, tx, ty, dx, dy, dy === 5 ? '#fef08a' : '#eab308');
      }
    }
  }
  {
    clearTile(ctx, TEX.GLOW_SHROOM);
    const tx = TEX.GLOW_SHROOM % ATLAS_COLS;
    const ty = Math.floor(TEX.GLOW_SHROOM / ATLAS_COLS);
    for (let y = 10; y < 16; y++) {
      setPx(ctx, tx, ty, 7, y, '#cbd5e1');
      setPx(ctx, tx, ty, 8, y, '#94a3b8');
    }
    for (let y = 6; y <= 9; y++) {
      const span = y === 6 ? 2 : y === 7 ? 4 : 5;
      for (let x = 8 - span; x <= 7 + span; x++) {
        setPx(ctx, tx, ty, x, y, (x + y) % 3 === 0 ? '#a5f3fc' : '#0284c7');
      }
    }
  }

  // 30..34: Ores
  paintOre(ctx, TEX.COAL_ORE, '#1f2328', '#3f454f', 1);
  paintOre(ctx, TEX.IRON_ORE, '#d69e76', '#f7d6be', 2);
  paintOre(ctx, TEX.GOLD_ORE, '#eab308', '#fef9c3', 3);
  paintOre(ctx, TEX.DIAMOND_ORE, '#06b6d4', '#cffafe', 4);
  paintOre(ctx, TEX.EMERALD_ORE, '#10b981', '#a7f3d0', 5);

  // 35: Cobblestone
  {
    fillNoiseTile(ctx, TEX.COBBLESTONE, '#737882', 0.25, 35);
    const tx = TEX.COBBLESTONE % ATLAS_COLS;
    const ty = Math.floor(TEX.COBBLESTONE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cell = (x + (Math.floor(y / 4) % 2) * 3) % 5 === 0 || y % 4 === 0;
        if (cell) setPx(ctx, tx, ty, x, y, '#4a4e56');
      }
    }
  }

  // 36..38: Planks
  paintPlanks(ctx, TEX.OAK_PLANKS, '#b58952', 36);
  paintPlanks(ctx, TEX.BIRCH_PLANKS, '#decfa0', 37);
  paintPlanks(ctx, TEX.PINE_PLANKS, '#7c5737', 38);

  // 39: Stone Bricks
  {
    fillNoiseTile(ctx, TEX.STONE_BRICKS, '#7d828c', 0.14, 39);
    const tx = TEX.STONE_BRICKS % ATLAS_COLS;
    const ty = Math.floor(TEX.STONE_BRICKS / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const row = y >= 8 ? 1 : 0;
        if (y === 0 || y === 8 || x === (row ? 8 : 0)) {
          setPx(ctx, tx, ty, x, y, '#4c5059');
        } else if (y === 1 || y === 9) {
          setPx(ctx, tx, ty, x, y, '#9ca2ad');
        }
      }
    }
  }

  // 40: Masonry Bricks
  {
    fillNoiseTile(ctx, TEX.BRICKS, '#ab4738', 0.16, 40);
    const tx = TEX.BRICKS % ATLAS_COLS;
    const ty = Math.floor(TEX.BRICKS / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0) {
          setPx(ctx, tx, ty, x, y, '#d4cdc3');
        }
      }
    }
  }

  // 41: Glass
  {
    clearTile(ctx, TEX.GLASS);
    const tx = TEX.GLASS % ATLAS_COLS;
    const ty = Math.floor(TEX.GLASS / ATLAS_COLS);
    for (let i = 0; i < 16; i++) {
      setPx(ctx, tx, ty, i, 0, '#e0f2fe');
      setPx(ctx, tx, ty, i, 15, '#7dd3fc');
      setPx(ctx, tx, ty, 0, i, '#e0f2fe');
      setPx(ctx, tx, ty, 15, i, '#7dd3fc');
    }
    for (let i = 2; i < 7; i++) {
      setPx(ctx, tx, ty, i, 8 - i, 'rgba(224,242,254,0.9)');
      setPx(ctx, tx, ty, i + 6, 14 - i, 'rgba(224,242,254,0.75)');
    }
  }

  // 42 & 43: Crafting Table
  {
    paintPlanks(ctx, TEX.CRAFT_TOP, '#9e6b3b', 42);
    const tx = TEX.CRAFT_TOP % ATLAS_COLS;
    const ty = Math.floor(TEX.CRAFT_TOP / ATLAS_COLS);
    for (let i = 2; i <= 13; i++) {
      setPx(ctx, tx, ty, i, 2, '#5c3b1e');
      setPx(ctx, tx, ty, i, 6, '#5c3b1e');
      setPx(ctx, tx, ty, i, 10, '#5c3b1e');
      setPx(ctx, tx, ty, i, 13, '#5c3b1e');
      setPx(ctx, tx, ty, 2, i, '#5c3b1e');
      setPx(ctx, tx, ty, 6, i, '#5c3b1e');
      setPx(ctx, tx, ty, 10, i, '#5c3b1e');
      setPx(ctx, tx, ty, 13, i, '#5c3b1e');
    }
    paintPlanks(ctx, TEX.CRAFT_SIDE, '#a87644', 43);
    const sx = TEX.CRAFT_SIDE % ATLAS_COLS;
    const sy = Math.floor(TEX.CRAFT_SIDE / ATLAS_COLS);
    for (let x = 0; x < 16; x++) {
      setPx(ctx, sx, sy, x, 0, '#5c3b1e');
      setPx(ctx, sx, sy, x, 1, '#754b27');
    }
    // Saw & Hammer silhouette
    for (let y = 5; y <= 11; y++) setPx(ctx, sx, sy, 5, y, '#cbd5e1');
    setPx(ctx, sx, sy, 4, 5, '#475569');
    setPx(ctx, sx, sy, 6, 5, '#475569');
    for (let y = 5; y <= 12; y++) setPx(ctx, sx, sy, 11, y, '#7c4d25');
    for (let x = 9; x <= 13; x++) setPx(ctx, sx, sy, x, 5, '#94a3b8');
  }

  // 44 & 45: Furnace
  {
    fillNoiseTile(ctx, TEX.FURNACE_SIDE, '#6c707a', 0.18, 45);
    fillNoiseTile(ctx, TEX.FURNACE_FRONT, '#6c707a', 0.18, 44);
    const tx = TEX.FURNACE_FRONT % ATLAS_COLS;
    const ty = Math.floor(TEX.FURNACE_FRONT / ATLAS_COLS);
    for (let y = 3; y <= 7; y++) {
      for (let x = 4; x <= 11; x++) setPx(ctx, tx, ty, x, y, '#27292e');
    }
    for (let y = 9; y <= 14; y++) {
      for (let x = 4; x <= 11; x++) {
        setPx(ctx, tx, ty, x, y, y >= 12 ? '#f97316' : y === 11 ? '#fde047' : '#1f2126');
      }
    }
  }

  // 46: Torch
  {
    clearTile(ctx, TEX.TORCH);
    const tx = TEX.TORCH % ATLAS_COLS;
    const ty = Math.floor(TEX.TORCH / ATLAS_COLS);
    for (let y = 6; y < 16; y++) {
      setPx(ctx, tx, ty, 7, y, '#8f6239');
      setPx(ctx, tx, ty, 8, y, '#734d2b');
    }
    setPx(ctx, tx, ty, 7, 5, '#f97316');
    setPx(ctx, tx, ty, 8, 5, '#ea580c');
    setPx(ctx, tx, ty, 7, 4, '#fef08a');
    setPx(ctx, tx, ty, 8, 4, '#facc15');
    setPx(ctx, tx, ty, 7, 3, '#ffffff');
  }

  // 47: Glowstone
  {
    const tx = TEX.GLOWSTONE % ATLAS_COLS;
    const ty = Math.floor(TEX.GLOWSTONE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = hash2(x, y, 47);
        const border = x === 0 || x === 15 || y === 0 || y === 15;
        setPx(
          ctx,
          tx,
          ty,
          x,
          y,
          border ? '#b45309' : n > 0.72 ? '#fef9c3' : n > 0.35 ? '#facc15' : '#d97706'
        );
      }
    }
  }

  // 48..50: TNT
  {
    const tx = TEX.TNT_SIDE % ATLAS_COLS;
    const ty = Math.floor(TEX.TNT_SIDE / ATLAS_COLS);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y >= 5 && y <= 10) {
          setPx(ctx, tx, ty, x, y, '#f8fafc');
        } else {
          setPx(ctx, tx, ty, x, y, x % 4 === 0 ? '#b91c1c' : '#ef4444');
        }
      }
    }
    // Crisp pixel 'T N T'
    const letters = [
      [2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9],
      [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9],
      [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9],
    ];
    for (const [lx, ly] of letters) setPx(ctx, tx, ty, lx, ly, '#1e293b');

    fillNoiseTile(ctx, TEX.TNT_TOP, '#dc2626', 0.2, 49);
    setPx(ctx, TEX.TNT_TOP % 8, Math.floor(TEX.TNT_TOP / 8), 7, 7, '#1e293b');
    setPx(ctx, TEX.TNT_TOP % 8, Math.floor(TEX.TNT_TOP / 8), 8, 8, '#f8fafc');
    fillNoiseTile(ctx, TEX.TNT_BOTTOM, '#991b1b', 0.2, 50);
  }

  // 51: Bookshelf
  {
    paintPlanks(ctx, TEX.BOOKSHELF, '#9e6f40', 51);
    const tx = TEX.BOOKSHELF % ATLAS_COLS;
    const ty = Math.floor(TEX.BOOKSHELF / ATLAS_COLS);
    const bookColors = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0d9488'];
    for (const shelfY of [2, 9]) {
      for (let x = 1; x < 15; x++) {
        const c = bookColors[(x + shelfY) % bookColors.length];
        for (let dy = 0; dy < 5; dy++) {
          setPx(ctx, tx, ty, x, shelfY + dy, dy === 0 && x % 3 === 0 ? '#1e293b' : c);
        }
      }
    }
  }

  // 52: Wool
  fillNoiseTile(ctx, TEX.WOOL, '#f1f5f9', 0.1, 52);

  cachedAtlasCanvas = canvas;
  return canvas;
}

export function getAtlasTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;
  const canvas = getAtlasCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedTexture = tex;
  return tex;
}

export function getTileUV(tileIndex: number): [number, number, number, number] {
  const tx = tileIndex % ATLAS_COLS;
  const ty = Math.floor(tileIndex / ATLAS_COLS);
  const pad = 0.0015; // prevents texture bleeding at block edges
  const u0 = (tx + pad) / ATLAS_COLS;
  const u1 = (tx + 1 - pad) / ATLAS_COLS;
  // Canvas Y is top-down, Three.js UV V is bottom-up
  const v1 = 1 - (ty + pad) / ATLAS_COLS;
  const v0 = 1 - (ty + 1 - pad) / ATLAS_COLS;
  return [u0, v0, u1, v1];
}

function drawToolSprite(ctx: CanvasRenderingContext2D, kind: string, headHex: string) {
  const handle = '#8c5d34';
  const handleDark = '#613f22';
  const shine = shadeHex(headHex, 1.25);
  const dark = shadeHex(headHex, 0.72);
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * 2, y * 2, 2, 2);
  };

  if (kind === 'sword') {
    px(2, 13, handleDark);
    px(3, 12, handle);
    px(4, 11, handle);
    // crossguard
    px(3, 9, dark);
    px(4, 10, headHex);
    px(5, 10, headHex);
    px(6, 11, dark);
    for (let i = 0; i < 8; i++) {
      px(5 + i, 9 - i, shine);
      px(6 + i, 9 - i, headHex);
      if (i < 7) px(6 + i, 10 - i, dark);
    }
    return;
  }

  // Diagonal wooden shaft from bottom-left (2,13) to upper-right (10,5)
  for (let i = 0; i < 9; i++) {
    px(2 + i, 13 - i, i % 2 === 0 ? handle : handleDark);
  }

  if (kind === 'pickaxe') {
    const arc = [
      [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 4], [11, 5],
      [12, 6], [13, 7], [13, 8], [13, 9], [13, 10],
    ];
    for (const [x, y] of arc) {
      px(x, y, headHex);
      px(x, y + 1, dark);
    }
    px(7, 2, shine);
    px(8, 2, shine);
    px(11, 5, shine);
  } else if (kind === 'axe') {
    const head = [
      [7, 2], [8, 2], [9, 2],
      [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
      [7, 5], [8, 5], [10, 5], [11, 5],
      [11, 6], [11, 7],
    ];
    for (const [x, y] of head) {
      px(x, y, x <= 7 ? shine : x >= 10 ? dark : headHex);
    }
  } else if (kind === 'shovel') {
    for (let dy = 2; dy <= 5; dy++) {
      for (let dx = 9; dx <= 13; dx++) {
        if (dy === 2 && (dx === 9 || dx === 13)) continue;
        px(dx, dy, dx <= 10 ? shine : headHex);
      }
    }
  }
}

export function getItemIconUrl(itemId: number): string {
  if (iconCache.has(itemId)) return iconCache.get(itemId)!;

  const def = ITEMS[itemId];
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (!def || itemId === BLOCK.AIR) return '';

  const atlas = getAtlasCanvas();

  if (def.isBlock && def.renderType === 'cube') {
    // Crisp 3D Isometric Voxel Block Preview!
    const topTx = (def.textures.top % ATLAS_COLS) * 16;
    const topTy = Math.floor(def.textures.top / ATLAS_COLS) * 16;
    const sideTx = (def.textures.side % ATLAS_COLS) * 16;
    const sideTy = Math.floor(def.textures.side / ATLAS_COLS) * 16;

    // Top diamond face
    ctx.save();
    ctx.translate(16, 3);
    ctx.transform(0.75, 0.375, -0.75, 0.375, 0, 0);
    ctx.drawImage(atlas, topTx, topTy, 16, 16, 0, 0, 16, 16);
    ctx.restore();

    // Left face (medium brightness)
    ctx.save();
    ctx.translate(4, 9);
    ctx.transform(0.75, 0.375, 0, 0.82, 0, 0);
    ctx.drawImage(atlas, sideTx, sideTy, 16, 16, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();

    // Right face (shaded)
    ctx.save();
    ctx.translate(16, 15);
    ctx.transform(0.75, -0.375, 0, 0.82, 0, 0);
    ctx.drawImage(atlas, sideTx, sideTy, 16, 16, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();
  } else if (def.isBlock) {
    // Cross-flora, Torch, Water, Lava: flat crisp 2x scaled sprite
    const sx = (def.textures.side % ATLAS_COLS) * 16;
    const sy = Math.floor(def.textures.side / ATLAS_COLS) * 16;
    ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 32, 32);
  } else if (def.toolType) {
    drawToolSprite(ctx, def.toolType, def.colorHex);
  } else {
    // Custom material / food sprites
    const px = (x: number, y: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x * 2, y * 2, 2, 2);
    };
    if (itemId === ITEM.STICK) {
      for (let i = 0; i < 11; i++) {
        px(3 + i, 13 - i, '#9c6f44');
        px(4 + i, 13 - i, '#704d2d');
      }
    } else if (itemId === ITEM.COAL) {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if ((x === 4 || x === 11) && (y === 4 || y === 12)) continue;
          px(x, y, x + y < 13 ? '#475569' : '#1e293b');
        }
      }
    } else if (itemId === ITEM.DIAMOND || itemId === ITEM.EMERALD) {
      const base = def.colorHex;
      for (let y = 3; y <= 12; y++) {
        const span = y <= 6 ? y - 2 : 13 - y;
        for (let x = 8 - span; x <= 7 + span; x++) {
          px(x, y, x <= 7 && y <= 7 ? '#ffffff' : shadeHex(base, x > 8 ? 0.8 : 1.05));
        }
      }
    } else if (itemId === ITEM.APPLE) {
      px(8, 2, '#65a30d');
      px(9, 2, '#65a30d');
      px(7, 3, '#78350f');
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if ((x === 4 || x === 11) && (y === 4 || y >= 11)) continue;
          px(x, y, x <= 6 && y <= 7 ? '#fca5a5' : x >= 10 ? '#b91c1c' : '#ef4444');
        }
      }
    } else {
      // Ingots, Bricks, Bread, Meat
      const base = def.colorHex;
      for (let y = 5; y <= 10; y++) {
        for (let x = 3; x <= 12; x++) {
          if ((x === 3 || x === 12) && (y === 5 || y === 10)) continue;
          px(x, y, y <= 6 ? shadeHex(base, 1.25) : y >= 9 ? shadeHex(base, 0.72) : base);
        }
      }
    }
  }

  const url = c.toDataURL();
  iconCache.set(itemId, url);
  return url;
}
