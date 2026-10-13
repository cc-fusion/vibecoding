import { TILES, NT, WALLS, WL, ITEMS, ItemDef, T } from './data';
import { mulberry } from './world';

export let atlas: HTMLCanvasElement;
export let wallAtlas: HTMLCanvasElement;
const iconCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type Ctx = CanvasRenderingContext2D;
function drawObject(ctx: Ctx, id: number, rnd: () => number) {
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const L = (x0: number, y0: number, x1: number, y1: number, c: string) => { ctx.fillStyle = c; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; for (;;) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
  switch (id) {
    case T.TORCH: R(7, 6, 2, 9, '#7a5230'); R(7, 6, 1, 9, '#946238'); R(6, 2, 4, 4, '#ff8a20'); R(7, 1, 2, 3, '#ffd040'); R(7, 3, 2, 2, '#fff4a0'); break;
    case T.WORKBENCH: R(1, 8, 14, 3, '#b27a43'); R(1, 8, 14, 1, '#cf9658'); R(1, 10, 14, 1, '#7d5128'); R(2, 11, 2, 5, '#7d5128'); R(12, 11, 2, 5, '#7d5128'); R(4, 6, 3, 2, '#999'); R(9, 4, 1, 4, '#7a5230'); R(8, 4, 3, 1, '#aaa'); break;
    case T.FURNACE: R(1, 4, 14, 12, '#8a8e98'); R(1, 4, 14, 1, '#a8aeb8'); R(3, 7, 10, 8, '#2a2a30'); R(4, 10, 8, 4, '#ff7a20'); R(6, 9, 4, 3, '#ffd040'); R(11, 1, 3, 3, '#6a6e78'); break;
    case T.ANVIL: R(1, 4, 14, 4, '#9a9aa8'); R(1, 4, 14, 1, '#c8c8d4'); R(13, 5, 3, 2, '#9a9aa8'); R(5, 8, 6, 4, '#6a6a78'); R(3, 12, 10, 4, '#7a7a88'); R(3, 12, 10, 1, '#9a9aa8'); break;
    case T.HELLFORGE: R(1, 4, 14, 12, '#4a2a2a'); R(3, 6, 10, 9, '#200808'); R(4, 9, 8, 5, '#ff5a10'); R(5, 8, 6, 3, '#ffa030'); R(2, 1, 2, 3, '#2a1010'); R(12, 1, 2, 3, '#2a1010'); R(1, 4, 14, 1, '#7a4a3a'); break;
    case T.ARCANE: R(1, 5, 14, 4, '#6a4ad0'); R(1, 5, 14, 1, '#a08aff'); R(5, 9, 6, 3, '#4a3098'); R(3, 12, 10, 4, '#5a3ab0'); R(7, 1, 2, 3, '#6affff'); R(6, 2, 4, 1, '#c0ffff'); break;
    case T.CHEST: R(2, 5, 12, 10, '#a8702a'); R(2, 5, 12, 1, '#d8a050'); R(2, 9, 12, 1, '#5a3a14'); R(2, 5, 1, 10, '#7a4a1a'); R(13, 5, 1, 10, '#7a4a1a'); R(7, 8, 2, 3, '#ffd84a'); R(3, 4, 10, 1, '#c88a3a'); break;
    case T.DOOR: R(4, 0, 8, 16, '#9a6a34'); R(4, 0, 1, 16, '#6a4420'); R(11, 0, 1, 16, '#6a4420'); R(5, 2, 6, 5, '#b27a43'); R(5, 9, 6, 5, '#b27a43'); R(10, 8, 1, 2, '#ffd84a'); break;
    case T.CHAIR: R(4, 2, 2, 13, '#b27a43'); R(4, 9, 8, 2, '#b27a43'); R(10, 11, 2, 4, '#7d5128'); R(4, 2, 1, 7, '#cf9658'); break;
    case T.TABLE: R(1, 7, 14, 2, '#b27a43'); R(1, 7, 14, 1, '#cf9658'); R(2, 9, 2, 7, '#7d5128'); R(12, 9, 2, 7, '#7d5128'); break;
    case T.BED: R(1, 9, 14, 5, '#7d5128'); R(2, 7, 12, 3, '#e8e8e8'); R(6, 7, 8, 3, '#d84a4a'); R(2, 6, 4, 2, '#fff'); R(1, 14, 2, 2, '#5a3a18'); R(13, 14, 2, 2, '#5a3a18'); break;
    case T.CRYSTAL: { const w = [1, 2, 3, 4, 5, 5, 4, 4, 3, 2, 1]; w.forEach((h, i) => R(8 - h, 3 + i, h * 2, 1, '#ff5a9a')); R(6, 6, 2, 3, '#ffc0d8'); R(10, 7, 2, 4, '#c02a6a'); break; }
    case T.DAYBLOOM: R(8, 8, 1, 8, '#3a9a38'); R(5, 11, 3, 1, '#4cc040'); R(9, 10, 3, 1, '#4cc040'); R(6, 4, 5, 4, '#ffd23a'); R(7, 3, 3, 6, '#ffd23a'); R(8, 5, 1, 2, '#c06a10'); break;
    case T.SHIVER: R(8, 6, 1, 10, '#3a8ac0'); L(8, 10, 5, 4, '#6ac0ff'); L(8, 10, 11, 3, '#6ac0ff'); L(8, 9, 8, 2, '#a0e0ff'); break;
    case T.FIRE: R(8, 9, 1, 7, '#8a5a30'); R(6, 5, 5, 4, '#ff4a1a'); R(7, 3, 3, 8, '#ff7a2a'); R(8, 6, 1, 2, '#ffe060'); break;
    case T.GLOWSHROOM: R(7, 9, 2, 7, '#d8f0f8'); R(4, 5, 8, 5, '#2ac0e8'); R(5, 4, 6, 1, '#5ae0ff'); R(3, 8, 10, 2, '#2ac0e8'); R(6, 6, 1, 1, '#e8ffff'); R(9, 7, 1, 1, '#e8ffff'); break;
    case T.TALLGRASS: for (let i = 0; i < 5; i++) { const x = 2 + i * 3, h = 4 + Math.floor(rnd() * 6); L(x, 15, x + (rnd() < 0.5 ? -1 : 1), 15 - h, i % 2 ? '#4cc040' : '#3a9a38'); } break;
    case T.SAPLING: R(8, 9, 1, 7, '#7a5230'); R(5, 6, 4, 3, '#4cc040'); R(8, 5, 4, 3, '#58d048'); break;
  }
}

function drawTile(ctx: Ctx, id: number, rnd: () => number) {
  const d = TILES[id];
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const noise = (base: string, dark: string, light: string, dens: number) => {
    R(0, 0, 16, 16, base);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = rnd(); if (r < dens) R(x, y, 1, 1, dark); else if (r > 1 - dens * 0.6) R(x, y, 1, 1, light); }
  };
  switch (d.style) {
    case 'noise': noise(d.c, d.d, d.l, 0.16); break;
    case 'stone': noise(d.c, d.d, d.l, 0.12); for (let k = 0; k < 2; k++) { let x = Math.floor(rnd() * 14), y = Math.floor(rnd() * 12); for (let i = 0; i < 4; i++) { R(x, y, 1, 1, d.d); x += rnd() < 0.5 ? 1 : 0; y++; } } R(1, 1, 3, 1, d.l); break;
    case 'grass': noise(d.c, d.d, d.l, 0.14); R(0, 0, 16, 3, d.top!); for (let x = 0; x < 16; x++) { if (rnd() < 0.6) R(x, 3, 1, 1 + (rnd() < 0.4 ? 1 : 0), d.top!); if (rnd() < 0.3) R(x, 0, 1, 1, shade(d.top!, 0.25)); if (rnd() < 0.25) R(x, 2, 1, 1, shade(d.top!, -0.25)); } break;
    case 'ore': noise(d.c, d.d, d.l, 0.12); for (let k = 0; k < 4; k++) { const x = 1 + Math.floor(rnd() * 11), y = 1 + Math.floor(rnd() * 12); R(x, y, 3, 2, d.ore!); R(x + 1, y, 1, 1, '#ffffffaa'); R(x, y + 1, 1, 1, shade(d.ore!, -0.4)); } break;
    case 'hell': noise(d.c, d.d, d.d, 0.2); for (let k = 0; k < 5; k++) { const x = Math.floor(rnd() * 13), y = Math.floor(rnd() * 14); R(x, y, 2, 1, d.l); R(x, y + 1, 1, 1, '#ffd060'); } break;
    case 'ice': noise(d.c, d.d, d.l, 0.1); for (let k = 0; k < 3; k++) { let x = Math.floor(rnd() * 10) + 3, y = Math.floor(rnd() * 8); for (let i = 0; i < 5; i++) { R(x, y, 1, 1, d.l); x--; y++; } } break;
    case 'brick': R(0, 0, 16, 16, d.d); for (let row = 0; row < 4; row++) { const off = (row % 2) * 4; for (let bx = -off; bx < 16; bx += 8) { const x0 = Math.max(0, bx + 1), x1 = Math.min(16, bx + 8); R(x0, row * 4 + 1, x1 - x0, 3, d.c); R(x0, row * 4 + 1, x1 - x0, 1, d.l); } } break;
    case 'planks': R(0, 0, 16, 16, d.c); for (let row = 0; row < 4; row++) { R(0, row * 4, 16, 1, d.l); R(0, row * 4 + 3, 16, 1, d.d); R(2 + Math.floor(rnd() * 12), row * 4 + 1, 1, 1, d.d); } R(0, 0, 1, 16, d.d); R(15, 0, 1, 16, d.d); break;
    case 'glass': R(0, 0, 16, 16, 'rgba(190,232,245,0.30)'); R(0, 0, 16, 1, 'rgba(255,255,255,0.7)'); R(0, 15, 16, 1, 'rgba(120,180,210,0.7)'); R(0, 0, 1, 16, 'rgba(255,255,255,0.5)'); R(15, 0, 1, 16, 'rgba(120,180,210,0.5)'); for (let i = 0; i < 5; i++) R(3 + i, 9 - i, 1, 1, 'rgba(255,255,255,0.8)'); break;
    case 'trunk': R(4, 0, 8, 16, d.c); R(4, 0, 1, 16, d.d); R(11, 0, 1, 16, d.d); R(6, 0, 1, 16, d.l); for (let k = 0; k < 4; k++) R(5 + Math.floor(rnd() * 5), Math.floor(rnd() * 14), 1, 3, d.d); break;
    case 'leaf': for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = rnd(); if (r < 0.1) continue; R(x, y, 1, 1, r < 0.4 ? d.d : r > 0.85 ? d.l : d.c); } break;
    case 'cactus': R(5, 0, 6, 16, d.c); R(5, 0, 1, 16, d.d); R(10, 0, 1, 16, d.d); R(7, 0, 1, 16, d.l); for (let y = 2; y < 16; y += 4) { R(4, y, 1, 1, d.l); R(11, y + 2, 1, 1, d.l); } break;
    case 'platform': R(0, 0, 16, 4, d.c); R(0, 0, 16, 1, d.l); R(0, 3, 16, 1, d.d); R(3, 1, 1, 1, d.d); R(11, 1, 1, 1, d.d); break;
    case 'obj': drawObject(ctx, id, rnd); break;
  }
}

function drawWall(ctx: Ctx, i: number, rnd: () => number) {
  const c = WALLS[i].c;
  const R = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  R(0, 0, 16, 16, c);
  if (i === WL.WOOD) { for (let r = 0; r < 4; r++) { R(0, r * 4 + 3, 16, 1, shade(c, -0.3)); R(0, r * 4, 16, 1, shade(c, 0.12)); } return; }
  if (i === WL.PBRICK) { for (let r = 0; r < 4; r++) { const off = (r % 2) * 4; R(0, r * 4 + 3, 16, 1, shade(c, -0.35)); for (let bx = -off; bx < 16; bx += 8) R(Math.max(0, bx + 7), r * 4, 1, 4, shade(c, -0.35)); } return; }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = rnd(); if (r < 0.14) R(x, y, 1, 1, shade(c, -0.25)); else if (r > 0.93) R(x, y, 1, 1, shade(c, 0.15)); }
  R(0, 0, 16, 1, shade(c, 0.08)); R(0, 0, 1, 16, shade(c, 0.08));
}

export function buildTextures() {
  if (atlas) return;
  atlas = mk(64, 16 * NT);
  const ctx = atlas.getContext('2d')!;
  for (let id = 1; id < NT; id++) {
    const d = TILES[id]; if (!d || d.liquid) continue;
    for (let v = 0; v < 4; v++) { ctx.save(); ctx.translate(v * 16, id * 16); drawTile(ctx, id, mulberry(id * 977 + v * 131)); ctx.restore(); }
  }
  wallAtlas = mk(64, 16 * WALLS.length);
  const wc = wallAtlas.getContext('2d')!;
  for (let i = 1; i < WALLS.length; i++) for (let v = 0; v < 4; v++) { wc.save(); wc.translate(v * 16, i * 16); drawWall(wc, i, mulberry(i * 313 + v * 17)); wc.restore(); }
}

function drawIcon(ctx: Ctx, d: ItemDef) {
  const P = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const L = (x0: number, y0: number, x1: number, y1: number, c: string) => { ctx.fillStyle = c; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; for (;;) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
  const col = d.col, dk = shade(col, -0.4), lt = shade(col, 0.4);
  const diamond = (cx: number, top: number, ws: number[], c: string) => ws.forEach((h, i) => R(cx - h, top + i, h * 2, 1, c));
  switch (d.icon) {
    case 'block': if (d.tile !== undefined) { ctx.imageSmoothingEnabled = false; ctx.drawImage(atlas, 0, d.tile * 16, 16, 16, 0, 0, 16, 16); if (TILES[d.tile].style !== 'obj' && TILES[d.tile].style !== 'trunk') { R(0, 0, 16, 1, 'rgba(255,255,255,0.25)'); R(0, 15, 16, 1, 'rgba(0,0,0,0.3)'); } } break;
    case 'wall': ctx.drawImage(wallAtlas, 0, (d.wall || 1) * 16, 16, 16, 1, 1, 14, 14); R(1, 1, 14, 1, 'rgba(255,255,255,0.2)'); break;
    case 'pick': L(3, 13, 11, 5, '#8a5a30'); L(4, 13, 12, 5, '#6a4220'); L(7, 3, 13, 9, col); L(6, 4, 12, 10, dk); L(8, 3, 13, 8, lt); P(6, 3, lt); P(13, 10, dk); break;
    case 'sword': L(4, 12, 13, 3, col); L(5, 12, 13, 4, lt); L(4, 11, 12, 3, dk); L(3, 9, 7, 13, '#8a6a30'); L(2, 14, 4, 12, '#6a4220'); P(13, 2, '#fff'); break;
    case 'bow': L(10, 1, 7, 4, col); L(7, 4, 6, 8, col); L(6, 8, 7, 12, col); L(7, 12, 10, 15, col); L(11, 1, 11, 15, '#e8e8e8'); P(6, 7, dk); P(6, 9, dk); break;
    case 'gun': R(2, 6, 10, 3, col); R(2, 6, 10, 1, lt); R(11, 5, 3, 2, dk); R(4, 9, 2, 4, '#7a4a20'); R(7, 9, 1, 2, dk); break;
    case 'staff': L(3, 14, 10, 7, '#8a5a30'); L(4, 14, 11, 7, '#6a4220'); R(10, 3, 3, 5, col); R(9, 4, 5, 3, col); P(10, 4, '#fff'); P(12, 6, dk); break;
    case 'book': R(3, 2, 10, 12, col); R(3, 2, 2, 12, dk); R(6, 4, 6, 1, lt); R(6, 7, 6, 1, lt); R(6, 10, 4, 1, lt); R(7, 5, 2, 2, '#222'); break;
    case 'bomb': for (let dy = -5; dy <= 5; dy++) { const h = Math.round(Math.sqrt(25 - dy * dy)); R(8 - h, 9 + dy, h * 2, 1, '#2e2e36'); } P(6, 7, '#888'); P(7, 6, '#888'); L(10, 4, 12, 2, '#b08a50'); P(13, 1, '#ffd040'); P(12, 1, '#ff8020'); break;
    case 'potion': R(6, 1, 4, 2, '#9a6a34'); R(7, 3, 2, 2, '#cfe8f0'); R(5, 5, 6, 1, '#cfe8f0'); R(4, 6, 8, 7, col); R(5, 13, 6, 1, col); R(5, 5, 6, 1, col); R(5, 7, 1, 4, lt); R(10, 8, 1, 4, dk); R(4, 6, 8, 1, lt); break;
    case 'bottle': R(6, 1, 4, 2, '#9a6a34'); R(7, 3, 2, 2, col); R(4, 6, 8, 7, 'rgba(191,232,245,0.55)'); R(5, 13, 6, 1, 'rgba(191,232,245,0.55)'); R(5, 7, 1, 4, '#fff'); R(5, 5, 6, 1, 'rgba(191,232,245,0.55)'); break;
    case 'head': R(4, 3, 8, 7, col); R(3, 5, 1, 5, dk); R(12, 5, 1, 5, dk); R(5, 7, 6, 2, '#222'); R(5, 3, 6, 1, lt); R(7, 1, 2, 2, dk); R(4, 10, 8, 1, dk); break;
    case 'body': R(3, 3, 10, 10, col); R(1, 3, 3, 5, col); R(12, 3, 3, 5, col); R(6, 3, 4, 2, dk); R(3, 11, 10, 1, dk); R(4, 5, 2, 5, lt); R(1, 7, 3, 1, dk); R(12, 7, 3, 1, dk); break;
    case 'legs': R(3, 2, 10, 3, dk); R(3, 5, 4, 9, col); R(9, 5, 4, 9, col); R(3, 13, 4, 1, dk); R(9, 13, 4, 1, dk); R(4, 5, 1, 7, lt); R(10, 5, 1, 7, lt); break;
    case 'bar': R(2, 8, 12, 5, col); R(3, 6, 10, 2, lt); R(2, 12, 12, 1, dk); R(2, 8, 1, 5, dk); R(13, 8, 1, 5, dk); R(5, 9, 2, 1, lt); break;
    case 'ore': R(3, 5, 10, 8, '#7d838d'); R(4, 4, 8, 1, '#7d838d'); R(3, 12, 10, 1, '#555b66'); R(5, 6, 3, 2, col); R(9, 8, 3, 2, col); R(6, 10, 2, 2, col); P(5, 6, '#fff'); P(9, 8, '#fff'); break;
    case 'gel': for (let dy = -4; dy <= 4; dy++) { const h = Math.round(Math.sqrt(16 - dy * dy) * 1.3); R(8 - h, 9 + dy, h * 2, 1, col); } R(5, 7, 2, 2, 'rgba(255,255,255,0.7)'); R(4, 12, 8, 1, dk); break;
    case 'lens': R(4, 4, 8, 8, '#eee'); R(3, 5, 10, 6, '#eee'); R(5, 3, 6, 10, '#eee'); R(6, 6, 4, 4, '#d03030'); R(7, 7, 2, 2, '#111'); P(4, 7, '#e88'); P(11, 9, '#e88'); break;
    case 'bone': L(4, 12, 12, 4, '#ece8d4'); L(5, 12, 12, 5, '#c8c0a0'); R(2, 11, 3, 3, col); R(11, 2, 3, 3, col); P(3, 10, col); P(2, 12, col); P(12, 1, col); P(13, 3, col); break;
    case 'star': R(7, 2, 2, 12, col); R(2, 7, 12, 2, col); R(5, 5, 6, 6, col); R(7, 7, 2, 2, '#fff'); P(3, 3, lt); P(12, 3, lt); P(3, 12, lt); P(12, 12, lt); break;
    case 'shard': diamond(8, 2, [1, 2, 3, 4, 4, 4, 4, 3, 3, 2, 2, 1, 1], col); R(6, 5, 2, 4, lt); R(10, 8, 1, 4, dk); break;
    case 'core': R(3, 3, 10, 10, '#555'); R(3, 3, 10, 1, '#888'); R(5, 5, 6, 6, col); R(7, 7, 2, 2, '#fff'); P(2, 6, '#999'); P(13, 9, '#999'); break;
    case 'herb': L(8, 14, 8, 7, '#3a9a38'); R(5, 10, 3, 2, '#4cc040'); R(9, 8, 3, 2, '#4cc040'); R(6, 3, 5, 4, col); R(7, 2, 3, 6, col); R(8, 4, 1, 2, '#fff8'); break;
    case 'shroom': R(7, 9, 2, 5, '#e8e8f0'); R(4, 5, 8, 4, col); R(5, 4, 6, 1, col); R(6, 6, 1, 1, '#fff'); R(9, 7, 1, 1, '#fff'); R(3, 8, 10, 1, dk); break;
    case 'crystal': diamond(8, 1, [1, 2, 3, 4, 5, 5, 5, 4, 4, 3, 2, 2, 1], col); R(5, 5, 2, 4, lt); R(10, 7, 2, 4, dk); break;
    case 'mcrystal': diamond(8, 1, [1, 2, 3, 4, 5, 5, 5, 4, 4, 3, 2, 2, 1], col); R(5, 5, 2, 4, lt); R(10, 7, 2, 4, dk); R(7, 6, 2, 3, '#fff'); R(6, 7, 4, 1, '#fff'); break;
    case 'arrow': L(3, 13, 12, 4, '#8a5a30'); P(13, 3, '#ddd'); P(12, 3, '#ddd'); P(13, 4, '#ddd'); P(13, 2, '#ddd'); R(2, 12, 2, 2, col === '#ff9a30' ? '#ff6020' : '#e8e8e8'); P(1, 14, '#e8e8e8'); break;
    case 'bullet': R(5, 5, 6, 6, col); R(6, 4, 4, 8, col); R(6, 6, 2, 2, '#fff'); R(9, 9, 2, 2, dk); break;
    case 'boots': R(4, 3, 4, 8, col); R(4, 10, 9, 3, col); R(4, 13, 9, 1, dk); R(2, 5, 3, 2, '#fff'); R(1, 7, 3, 1, '#fff'); R(4, 3, 4, 1, lt); break;
    case 'cloud': R(3, 8, 10, 4, '#fff'); R(5, 6, 6, 2, '#fff'); R(2, 9, 12, 2, '#e0f0ff'); R(6, 3, 4, 3, 'rgba(191,232,245,0.8)'); R(7, 2, 2, 1, '#9a6a34'); break;
    case 'shoe': R(3, 3, 3, 9, col); R(10, 3, 3, 9, col); R(5, 10, 6, 3, col); P(4, 5, '#555'); P(11, 5, '#555'); P(4, 8, '#555'); P(11, 8, '#555'); R(3, 3, 1, 8, lt); break;
    case 'ring': R(5, 5, 6, 8, col); ctx.clearRect(6, 6, 4, 6); R(7, 3, 2, 3, '#ff4060'); R(5, 5, 6, 1, lt); break;
    case 'claws': L(4, 13, 7, 3, col); L(7, 13, 9, 3, col); L(10, 13, 11, 3, col); L(5, 13, 8, 3, lt); R(3, 13, 9, 2, '#6a4a2a'); break;
    case 'shield': R(3, 2, 10, 8, col); R(4, 10, 8, 2, col); R(6, 12, 4, 2, col); R(3, 2, 10, 1, lt); R(7, 4, 2, 7, dk); R(5, 6, 6, 2, dk); break;
    case 'wings': R(2, 3, 5, 3, col); R(1, 5, 6, 3, col); R(2, 8, 5, 2, col); R(9, 3, 5, 3, col); R(9, 5, 6, 3, col); R(9, 8, 5, 2, col); R(7, 5, 2, 8, '#c8a050'); R(2, 3, 5, 1, '#ddd'); R(9, 3, 5, 1, '#ddd'); break;
    case 'emblem': R(4, 4, 8, 8, col); R(3, 5, 10, 6, col); R(5, 3, 6, 10, col); R(7, 5, 2, 6, '#fff8'); R(5, 7, 6, 2, '#fff8'); R(4, 4, 8, 1, lt); break;
    case 'skull': R(4, 3, 8, 7, '#eee'); R(5, 10, 6, 3, '#eee'); R(5, 6, 2, 2, '#222'); R(9, 6, 2, 2, '#222'); R(7, 9, 2, 1, '#555'); R(6, 11, 1, 2, '#999'); R(9, 11, 1, 2, '#999'); break;
    case 'doll': R(6, 5, 4, 6, col); R(6, 2, 4, 3, '#e8c898'); R(4, 6, 8, 1, col); R(6, 11, 1, 3, col); R(9, 11, 1, 3, col); P(7, 3, '#222'); P(8, 3, '#222'); P(7, 7, '#fff'); P(11, 5, '#c0c0c0'); break;
    case 'worm': R(2, 10, 4, 4, col); R(5, 7, 4, 4, col); R(8, 4, 4, 4, col); R(11, 2, 3, 3, '#f55'); R(3, 11, 1, 1, '#f55'); R(6, 8, 1, 1, '#f55'); break;
    case 'sigil': diamond(8, 1, [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1], col); R(7, 6, 2, 4, '#fff'); R(5, 7, 6, 2, '#0aa'); R(7, 7, 2, 2, '#fff'); break;
    case 'flag': L(4, 2, 4, 14, '#8a5a30'); R(5, 2, 8, 6, col); R(5, 2, 8, 1, lt); R(7, 4, 2, 2, '#222'); break;
    case 'hook': R(7, 2, 2, 8, col); R(4, 9, 8, 2, col); R(4, 7, 2, 3, col); R(10, 7, 2, 3, col); L(8, 10, 8, 15, '#a08a60'); P(7, 2, '#fff'); break;
    case 'mirror': R(5, 2, 6, 10, '#e8c060'); R(3, 4, 10, 6, '#e8c060'); R(5, 3, 6, 8, '#9fd3ff'); R(4, 5, 8, 4, '#9fd3ff'); R(6, 4, 2, 2, '#fff'); R(7, 12, 2, 3, '#e8c060'); break;
    case 'powder': R(5, 6, 6, 7, col); R(4, 8, 8, 4, col); R(6, 4, 4, 2, '#8a6a40'); R(7, 3, 2, 1, '#a08a60'); R(6, 8, 2, 2, lt); break;
    default: R(4, 4, 8, 8, col);
  }
}

export function iconCanvas(id: string): HTMLCanvasElement {
  let c = iconCache.get(id);
  if (c) return c;
  buildTextures();
  c = mk(16, 16);
  const d = ITEMS[id];
  if (d) drawIcon(c.getContext('2d')!, d);
  iconCache.set(id, c);
  return c;
}
export function iconURL(id: string): string {
  let u = urlCache.get(id);
  if (!u) { u = iconCanvas(id).toDataURL(); urlCache.set(id, u); }
  return u;
}
