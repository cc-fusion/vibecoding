import * as THREE from 'three';
import { mulberry32 } from './noise';

// Atlas: 8x8 tiles, each 32px => 256x256
export const TILE = 32;
export const ATLAS_COLS = 8;

export function tileUV(index: number) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const u0 = col / ATLAS_COLS, v0 = 1 - (row + 1) / ATLAS_COLS;
  const u1 = (col + 1) / ATLAS_COLS, v1 = 1 - row / ATLAS_COLS;
  // inset slightly to avoid bleeding
  const e = 0.001;
  return { u0: u0 + e, v0: v0 + e, u1: u1 - e, v1: v1 - e };
}

function px(ctx: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
}
function fillTile(ctx: CanvasRenderingContext2D, idx: number, base: string, vary: string[], rng: () => number, speck = 0.35) {
  const tx = idx % ATLAS_COLS, ty = Math.floor(idx / ATLAS_COLS);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const r = rng();
    px(ctx, tx, ty, x, y, r < speck ? vary[Math.floor(rng() * vary.length)] : base);
  }
}


export function createAtlasTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(1337);
  const R = () => rng();

  // 0 grass top
  fillTile(ctx, 0, '#5fae3f', ['#4f9a34', '#6fbf4f', '#57a83a', '#7ac85a'], R, 0.5);
  // 1 grass side
  fillTile(ctx, 1, '#8a5a33', ['#7a4e2a', '#9a6a3f', '#6e4525'], R, 0.4);
  for (let x = 0; x < TILE; x++) for (let y = 0; y < 10; y++) px(ctx, 1 % 8, Math.floor(1 / 8), x, y, ['#5fae3f', '#4f9a34', '#6fbf4f'][Math.floor(R() * 3)]);
  // 2 dirt
  fillTile(ctx, 2, '#8a5a33', ['#7a4e2a', '#9a6a3f', '#6e4525', '#a87a4a'], R, 0.45);
  // 3 stone
  fillTile(ctx, 3, '#7d7d7d', ['#6e6e6e', '#8c8c8c', '#757575'], R, 0.4);
  // 4 cobble
  fillTile(ctx, 4, '#6e6e6e', ['#5a5a5a', '#7d7d7d', '#4a4a4a'], R, 0.5);
  for (let i = 0; i < 40; i++) { const x = Math.floor(R() * 30), y = Math.floor(R() * 30); px(ctx, 4 % 8, 0, x, y, '#3a3a3a'); px(ctx, 4 % 8, 0, x + 1, y, '#3a3a3a'); }
  // 5 planks
  fillTile(ctx, 5, '#b08a4f', ['#a07a42', '#c09a5a'], R, 0.25);
  for (let y = 7; y < TILE; y += 8) for (let x = 0; x < TILE; x++) px(ctx, 5 % 8, 0, x, y, '#7a5a2e');
  for (let x = 0; x < TILE; x++) px(ctx, 5 % 8, 0, x, 0, '#7a5a2e');
  // 6 log side
  fillTile(ctx, 6, '#6b4f2a', ['#5a4020', '#7a5c34'], R, 0.3);
  for (let x = 7; x < TILE; x += 8) for (let y = 0; y < TILE; y++) px(ctx, 6 % 8, 0, x, y, '#4a3418');
  // 7 log top
  fillTile(ctx, 7, '#b08a4f', ['#a07a42'], R, 0.2);
  for (let r = 2; r < 16; r += 3) for (let a = 0; a < 40; a++) { const x = 16 + Math.cos(a) * r, y = 16 + Math.sin(a) * r; if (x >= 0 && x < 32 && y >= 0 && y < 32) px(ctx, 7 % 8, 0, Math.floor(x), Math.floor(y), '#6b4f2a'); }
  // 8 leaves
  fillTile(ctx, 8, '#3d7a26', ['#2f6420', '#4d8a32', '#35702a'], R, 0.6);
  for (let i = 0; i < 60; i++) px(ctx, 0, 1, Math.floor(R() * 32), Math.floor(R() * 32), '#1e3d14');
  // 9 sand
  fillTile(ctx, 9, '#dbd29a', ['#ccc28a', '#e8e0aa'], R, 0.4);
  // 10 glass - mostly transparent with border
  { const tx = 2, ty = 1; ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE); ctx.fillStyle = 'rgba(220,240,250,0.15)'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); ctx.fillStyle = '#e8f4f8'; for (let i = 0; i < TILE; i++) { ctx.fillRect(tx * TILE + i, ty * TILE, 1, 1); ctx.fillRect(tx * TILE + i, ty * TILE + TILE - 1, 1, 1); ctx.fillRect(tx * TILE, ty * TILE + i, 1, 1); ctx.fillRect(tx * TILE + TILE - 1, ty * TILE + i, 1, 1); } ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 4; i < 12; i++) ctx.fillRect(tx * TILE + i, ty * TILE + i, 1, 1); }
  // 11 brick
  fillTile(ctx, 11, '#9a4a3a', ['#8a4032', '#aa5542'], R, 0.3);
  for (let y = 7; y < TILE; y += 8) for (let x = 0; x < TILE; x++) px(ctx, 3, 1, x, y, '#d8c8b8');
  for (let y = 0; y < TILE; y += 8) { const off = (y / 8) % 2 ? 8 : 0; for (let x = off; x < TILE; x += 16) for (let yy = y; yy < y + 8; yy++) px(ctx, 3, 1, x, yy, '#d8c8b8'); }
  // 12 bedrock
  fillTile(ctx, 12, '#2b2b2b', ['#1a1a1a', '#3d3d3d', '#555'], R, 0.5);
  // 13 snow
  fillTile(ctx, 13, '#f2f7f7', ['#e8f0f0', '#ffffff'], R, 0.3);
  // 14 sandstone
  fillTile(ctx, 14, '#d8cfa8', ['#c8bf98', '#e8dfb8'], R, 0.3);
  for (let x = 0; x < TILE; x++) px(ctx, 6, 1, x, 15, '#b8af88'); px(ctx, 6, 1, 0, 16, '#b8af88');
  // 15 gravel
  fillTile(ctx, 15, '#8a7f7a', ['#7a6f6a', '#9a8f8a', '#6a5f5a', '#a89f9a'], R, 0.6);
  // 16 coal ore
  fillTile(ctx, 16, '#7d7d7d', ['#6e6e6e', '#8c8c8c'], R, 0.3);
  for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 0, 2, x, y, '#1a1a1a'); px(ctx, 0, 2, x + 1, y, '#1a1a1a'); px(ctx, 0, 2, x, y + 1, '#1a1a1a'); }
  // 17 iron ore
  fillTile(ctx, 17, '#7d7d7d', ['#6e6e6e', '#8c8c8c'], R, 0.3);
  for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 1, 2, x, y, '#d8a488'); px(ctx, 1, 2, x + 1, y, '#d8a488'); px(ctx, 1, 2, x, y + 1, '#c89878'); }
  // 18 diamond ore
  fillTile(ctx, 18, '#7d7d7d', ['#6e6e6e', '#8c8c8c'], R, 0.3);
  for (let i = 0; i < 4; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 2, 2, x, y, '#5fe8e0'); px(ctx, 2, 2, x + 1, y, '#5fe8e0'); px(ctx, 2, 2, x, y + 1, '#3ac8c0'); }
  // 19 gold ore
  fillTile(ctx, 19, '#7d7d7d', ['#6e6e6e', '#8c8c8c'], R, 0.3);
  for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 3, 2, x, y, '#f5d13d'); px(ctx, 3, 2, x + 1, y, '#f5d13d'); px(ctx, 3, 2, x, y + 1, '#d8b02a'); }
  // 20 glowstone
  fillTile(ctx, 20, '#ffc94d', ['#ffb02a', '#ffe08a', '#ff9a1a'], R, 0.5);
  // 21 crafting side
  fillTile(ctx, 21, '#b08a4f', ['#a07a42'], R, 0.2);
  for (let y = 7; y < TILE; y += 8) for (let x = 0; x < TILE; x++) px(ctx, 5, 2, x, y, '#7a5a2e');
  ctx.fillStyle = '#5a4020'; ctx.fillRect(5 * TILE + 4, 2 * TILE + 4, 24, 10);
  // 22 crafting top
  fillTile(ctx, 22, '#b08a4f', ['#a07a42'], R, 0.2);
  for (let i = 0; i < TILE; i++) { px(ctx, 6, 2, i, 0, '#7a5a2e'); px(ctx, 6, 2, i, TILE - 1, '#7a5a2e'); px(ctx, 6, 2, 0, i, '#7a5a2e'); px(ctx, 6, 2, TILE - 1, i, '#7a5a2e'); }
  ctx.fillStyle = '#7a5a2e'; ctx.fillRect(6 * TILE + 8, 2 * TILE + 8, 16, 16); ctx.fillStyle = '#5a4020'; ctx.fillRect(6 * TILE + 10, 2 * TILE + 10, 12, 12);
  // 23 furnace side
  fillTile(ctx, 23, '#5a5a5a', ['#4a4a4a', '#6a6a6a'], R, 0.4);
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(7 * TILE + 8, 2 * TILE + 12, 16, 12); ctx.fillStyle = '#ff6a1a'; ctx.fillRect(7 * TILE + 10, 2 * TILE + 16, 12, 4);
  // 24 furnace top
  fillTile(ctx, 24, '#5a5a5a', ['#4a4a4a', '#6a6a6a'], R, 0.4);
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0 * TILE + 10, 3 * TILE + 10, 12, 12);
  // 25 mossy cobble
  fillTile(ctx, 25, '#6e6e6e', ['#5a5a5a', '#7d7d7d'], R, 0.4);
  for (let i = 0; i < 80; i++) px(ctx, 1, 3, Math.floor(R() * 32), Math.floor(R() * 32), ['#4a7a3a', '#5a8a4a'][Math.floor(R() * 2)]);
  // 26 ice
  fillTile(ctx, 26, '#a8d8f0', ['#98c8e8', '#b8e8f8', '#c8f0ff'], R, 0.4);
  for (let i = 0; i < 8; i++) { const x = Math.floor(R() * 28), y = Math.floor(R() * 28); for (let k = 0; k < 4; k++) px(ctx, 2, 3, x + k, y + k, '#e8f8ff'); }
  // 27 obsidian
  fillTile(ctx, 27, '#2a1a4a', ['#1e1238', '#3a2a5a', '#241840'], R, 0.4);
  // 28 tnt side
  fillTile(ctx, 28, '#d43a2a', ['#c03020', '#e04838'], R, 0.3);
  ctx.fillStyle = '#f0e8d8'; ctx.fillRect(4 * TILE + 0, 3 * TILE + 12, TILE, 8);
  ctx.fillStyle = '#2b2b2b'; ctx.font = 'bold 7px monospace'; ctx.fillText('TNT', 4 * TILE + 10, 3 * TILE + 19);
  // 29 tnt top
  fillTile(ctx, 29, '#d43a2a', ['#c03020'], R, 0.2);
  ctx.fillStyle = '#f0e8d8'; ctx.fillRect(5 * TILE + 10, 3 * TILE + 10, 12, 12); ctx.fillStyle = '#2b2b2b'; ctx.fillRect(5 * TILE + 14, 3 * TILE + 14, 4, 4);
  // 30-33 wool
  fillTile(ctx, 30, '#f0f0f0', ['#e0e0e0', '#ffffff'], R, 0.3);
  fillTile(ctx, 31, '#c03028', ['#b02820', '#d04038'], R, 0.3);
  fillTile(ctx, 32, '#2a4ac8', ['#223eb0', '#3a5ad8'], R, 0.3);
  fillTile(ctx, 33, '#f0d028', ['#e0c020', '#ffe040'], R, 0.3);
  // 34 pumpkin side
  fillTile(ctx, 34, '#e07a1a', ['#d06a10', '#f08a2a'], R, 0.3);
  for (let x = 7; x < TILE; x += 8) for (let y = 0; y < TILE; y++) px(ctx, 2, 4, x, y, '#b85a0a');
  // 35 pumpkin top
  fillTile(ctx, 35, '#e07a1a', ['#d06a10'], R, 0.2);
  ctx.fillStyle = '#6b4f2a'; ctx.fillRect(3 * TILE + 14, 4 * TILE + 12, 4, 8);
  // 36 melon side
  fillTile(ctx, 36, '#5aa832', ['#4a9828'], R, 0.2);
  for (let x = 5; x < TILE; x += 9) for (let y = 0; y < TILE; y++) px(ctx, 4, 4, x, y, '#3a7a20');
  // 37 melon top
  fillTile(ctx, 37, '#5aa832', ['#4a9828'], R, 0.2);
  ctx.fillStyle = '#6b4f2a'; ctx.fillRect(5 * TILE + 14, 4 * TILE + 12, 4, 8);
  // 38 sponge
  fillTile(ctx, 38, '#e8d83a', ['#d8c82a', '#f8e84a'], R, 0.4);
  for (let i = 0; i < 12; i++) px(ctx, 6, 4, Math.floor(R() * 32), Math.floor(R() * 32), '#b8a81a');
  // 39 clay
  fillTile(ctx, 39, '#9aa4b8', ['#8a94a8', '#aab4c8'], R, 0.3);
  // 40 stone brick
  fillTile(ctx, 40, '#7a7a7a', ['#6a6a6a', '#8a8a8a'], R, 0.3);
  for (let y = 7; y < TILE; y += 8) for (let x = 0; x < TILE; x++) px(ctx, 0, 5, x, y, '#4a4a4a');
  for (let y = 0; y < TILE; y += 8) { const off = (y / 8) % 2 ? 8 : 0; for (let x = off; x < TILE; x += 16) for (let yy = y; yy < y + 8; yy++) px(ctx, 0, 5, x, yy, '#4a4a4a'); }
  // 41 bookshelf
  fillTile(ctx, 41, '#b08a4f', ['#a07a42'], R, 0.2);
  for (let s = 0; s < 2; s++) { const y0 = 4 + s * 16; for (let b = 0; b < 6; b++) { const x = 2 + b * 5; ctx.fillStyle = ['#c03028', '#2a4ac8', '#3a8a3a', '#f0d028', '#7a3ac8', '#e07a1a'][b]; ctx.fillRect(1 * TILE + x, 5 * TILE + y0, 4, 12); } ctx.fillStyle = '#7a5a2e'; ctx.fillRect(1 * TILE, 5 * TILE + y0 + 12, TILE, 2); }
  // 42 mushroom
  fillTile(ctx, 42, '#f0e8d8', ['#e0d8c8'], R, 0.2);
  for (let i = 0; i < 8; i++) px(ctx, 2, 5, Math.floor(R() * 32), Math.floor(R() * 32), '#c83a2a');
  // 43 cactus side
  fillTile(ctx, 43, '#3a8a3a', ['#2f7a2f', '#4a9a4a'], R, 0.3);
  for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x++) px(ctx, 3, 5, x, y, '#2a6a2a');
  // 44 cactus top
  fillTile(ctx, 44, '#3a8a3a', ['#2f7a2f'], R, 0.2);
  // 45 lava
  fillTile(ctx, 45, '#ff6a1a', ['#ff8a2a', '#ff4a0a', '#ffb02a'], R, 0.5);
  // 46 netherrack
  fillTile(ctx, 46, '#7a2a22', ['#6a2018', '#8a3428'], R, 0.4);
  // 47 soul sand
  fillTile(ctx, 47, '#4a3428', ['#3a2820', '#5a4438'], R, 0.4);
  for (let i = 0; i < 10; i++) px(ctx, 7, 5, Math.floor(R() * 32), Math.floor(R() * 32), '#2a1a14');
  // 48 redstone ore
  fillTile(ctx, 48, '#7d7d7d', ['#6e6e6e'], R, 0.3);
  for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 0, 6, x, y, '#ff2a2a'); px(ctx, 0, 6, x + 1, y, '#ff2a2a'); }
  // 49 lapis ore
  fillTile(ctx, 49, '#7d7d7d', ['#6e6e6e'], R, 0.3);
  for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 1, 6, x, y, '#2a4ac8'); px(ctx, 1, 6, x + 1, y, '#2a4ac8'); }
  // 50 emerald ore
  fillTile(ctx, 50, '#7d7d7d', ['#6e6e6e'], R, 0.3);
  for (let i = 0; i < 4; i++) { const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 24); px(ctx, 2, 6, x, y, '#2ad84a'); px(ctx, 2, 6, x + 1, y, '#2ad84a'); }
  // 51 snow grass side
  fillTile(ctx, 51, '#8a5a33', ['#7a4e2a'], R, 0.3);
  for (let x = 0; x < TILE; x++) for (let y = 0; y < 12; y++) px(ctx, 3, 6, x, y, '#f2f7f7');
  // 52 snow grass top
  fillTile(ctx, 52, '#f2f7f7', ['#e8f0f0'], R, 0.3);
  // 53 prismarine
  fillTile(ctx, 53, '#3aa8a0', ['#2a9890', '#4ab8b0', '#5ac8c0'], R, 0.4);
  // 54 end stone
  fillTile(ctx, 54, '#d8d88a', ['#c8c87a', '#e8e89a'], R, 0.3);
  // 55 quartz
  fillTile(ctx, 55, '#f0ead8', ['#e0dac8', '#ffffff'], R, 0.2);
  // 56 water
  fillTile(ctx, 56, '#2f6fd0', ['#2a60c0', '#3a80e0', '#2f6fd0'], R, 0.3);
  for (let i = 0; i < 10; i++) { const x = Math.floor(R() * 28), y = Math.floor(R() * 28); px(ctx, 0, 7, x, y, '#5aa0f0'); px(ctx, 0, 7, x + 1, y, '#5aa0f0'); }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCrackTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 2;
  const rng = mulberry32(99);
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let x = 32, y = 32;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += (rng() - 0.5) * 28; y += (rng() - 0.5) * 28; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
