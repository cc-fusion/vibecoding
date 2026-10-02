import { CELL, MW, MH, CHAMBER_INFO } from './data';
import { T_SOIL, T_TUNNEL, T_ROCK, hash2 } from './world';
import type { Game, Ent } from './engine';

const WORLD_W = MW * CELL;
const WORLD_H = MH * CELL;
const DIG_TIME = 2.4;

/* ------------------------------------------------------------ terrain */
function drawCell(ctx: CanvasRenderingContext2D, cells: Uint8Array, x: number, y: number) {
  const i = y * MW + x;
  const t = cells[i];
  const px = x * CELL;
  const py = y * CELL;
  const h = hash2(x, y, 3);
  const h2 = hash2(x, y, 9);
  const h3 = hash2(x, y, 17);
  const nb = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return T_ROCK;
    return cells[ny * MW + nx];
  };
  if (t === T_SOIL) {
    ctx.fillStyle = `hsl(${24 + h * 8},${30 + h2 * 10}%,${17 + h * 7}%)`;
    ctx.fillRect(px, py, CELL, CELL);
    if (h2 > 0.45) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + h * 14 + 2, py + h3 * 13 + 3, 4, 3); }
    if (h3 > 0.6) { ctx.fillStyle = 'rgba(255,220,170,0.07)'; ctx.fillRect(px + h2 * 12 + 3, py + h * 12 + 2, 3, 2); }
    if (h > 0.85) { ctx.fillStyle = 'rgba(150,130,110,0.25)'; ctx.fillRect(px + 6, py + 11, 3, 3); }
  } else if (t === T_ROCK) {
    ctx.fillStyle = `hsl(220,6%,${24 + h * 10}%)`;
    ctx.fillRect(px, py, CELL, CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); ctx.lineTo(px, py + CELL); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py + CELL - 4, CELL, 4);
    if (h2 > 0.6) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 3, py + 5); ctx.lineTo(px + 12 + h * 5, py + 15); ctx.stroke(); }
  } else if (t === T_TUNNEL) {
    ctx.fillStyle = `hsl(${30 + h * 6},${26 + h2 * 6}%,${33 + h * 6}%)`;
    ctx.fillRect(px, py, CELL, CELL);
    if (h2 > 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(px + h * 14, py + h3 * 14, 3, 2); }
    const edge = (dx: number, dy: number, rx: number, ry: number, rw: number, rh: number) => {
      const n = nb(dx, dy);
      if (n === T_SOIL || n === T_ROCK) {
        ctx.fillStyle = 'rgba(25,12,4,0.5)';
        ctx.fillRect(px + rx, py + ry, rw, rh);
      }
    };
    edge(0, -1, 0, 0, CELL, 4);
    edge(0, 1, 0, CELL - 3, CELL, 3);
    edge(-1, 0, 0, 0, 3, CELL);
    edge(1, 0, CELL - 3, 0, 3, CELL);
    const edge2 = (dx: number, dy: number, rx: number, ry: number, rw: number, rh: number) => {
      const n = nb(dx, dy);
      if (n === T_SOIL || n === T_ROCK) {
        ctx.fillStyle = 'rgba(25,12,4,0.22)';
        ctx.fillRect(px + rx, py + ry, rw, rh);
      }
    };
    edge2(0, -1, 0, 4, CELL, 3);
    edge2(-1, 0, 3, 0, 3, CELL);
  } else {
    ctx.fillStyle = `hsl(${92 + h * 26},${40 + h2 * 8}%,${25 + h * 9}%)`;
    ctx.fillRect(px, py, CELL, CELL);
    ctx.fillStyle = `hsla(${100 + h2 * 30},55%,${40 + h3 * 14}%,0.55)`;
    ctx.fillRect(px + h * 15 + 1, py + h2 * 12 + 2, 1.5, 5);
    ctx.fillRect(px + h2 * 14 + 2, py + h3 * 12 + 4, 1.5, 4);
    if (h3 > 0.55) ctx.fillRect(px + h3 * 15 + 1, py + h * 12 + 1, 1.5, 6);
    if (h > 0.92) { ctx.fillStyle = h2 > 0.5 ? 'rgba(255,240,120,0.8)' : 'rgba(255,255,255,0.7)'; ctx.fillRect(px + 8, py + 8, 2.5, 2.5); }
    const lip = (dx: number, dy: number, rx: number, ry: number, rw: number, rh: number) => {
      const n = nb(dx, dy);
      if (n === T_SOIL || n === T_ROCK) {
        ctx.fillStyle = 'rgba(30,20,6,0.5)';
        ctx.fillRect(px + rx, py + ry, rw, rh);
      }
    };
    lip(0, -1, 0, 0, CELL, 3);
    lip(0, 1, 0, CELL - 3, CELL, 3);
    lip(-1, 0, 0, 0, 3, CELL);
    lip(1, 0, CELL - 3, 0, 3, CELL);
  }
}

export function buildTerrain(g: Game) {
  const ctx = g.terrain.getContext('2d');
  if (!ctx) return;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawCell(ctx, g.cells, x, y);
}

export function paintCell(g: Game, x: number, y: number) {
  const ctx = g.terrain.getContext('2d');
  if (!ctx) return;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      drawCell(ctx, g.cells, nx, ny);
    }
  }
}

/* ------------------------------------------------------------ overlays: fog + pheromone */
function refreshFog(g: Game) {
  const ctx = g.fogCanvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(MW, MH);
  const d = img.data;
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 4;
    d[o] = 6; d[o + 1] = 4; d[o + 2] = 3;
    d[o + 3] = !g.explored[i] ? 244 : g.visible[i] ? 0 : 118;
  }
  ctx.putImageData(img, 0, 0);
  g.fogDirty = false;
}

function refreshPh(g: Game) {
  const ctx = g.phCanvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(MW, MH);
  const d = img.data;
  for (let i = 0; i < MW * MH; i++) {
    const f = g.phF[i];
    const w = g.phW[i];
    const a = f > w ? f : w;
    const o = i * 4;
    if (a < 0.02) { d[o + 3] = 0; continue; }
    const tf = f / (f + w);
    d[o] = 70 * tf + 255 * (1 - tf);
    d[o + 1] = 255 * tf + 70 * (1 - tf);
    d[o + 2] = 150 * tf + 60 * (1 - tf);
    d[o + 3] = Math.min(215, a * 235);
  }
  ctx.putImageData(img, 0, 0);
  g.phDirty = false;
}

/* ------------------------------------------------------------ sprites */
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

const CASTE_COL: Record<string, string> = {
  worker: '#e3a13a', soldier: '#c8402a', nurse: '#eaa9c2', scout: '#4cc9c0', spitter: '#8ed84a', queen: '#f2c84b',
};

function drawAnt(ctx: CanvasRenderingContext2D, e: Ent, body: string, lod: boolean, g: Game) {
  const flash = e.flash > 0;
  const col = flash ? '#ffffff' : body;
  const s = e.type === 'queen' ? 2.6 : e.type === 'soldier' ? 1.25 : e.type === 'spitter' ? 1.1 : e.type === 'scout' ? 0.95 : 1;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  if (lod) {
    ctx.fillStyle = col;
    ellipse(ctx, -1, 0, 6, 3);
    ctx.restore();
    return;
  }
  const ph = e.anim * 0.4;
  ctx.strokeStyle = 'rgba(20,10,5,0.85)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const lx = -1.6 + i * 2.1;
    const sw = Math.sin(ph + i * 2.1) * 1.6;
    ctx.moveTo(lx, 0); ctx.lineTo(lx + sw, 5.2);
    ctx.moveTo(lx, 0); ctx.lineTo(lx - sw, -5.2);
  }
  ctx.stroke();
  ctx.fillStyle = col;
  if (e.type === 'queen') {
    const pulse = 1 + Math.sin(g.time * 3) * 0.04;
    ellipse(ctx, -8, 0, 7.5 * pulse, 4.8);
    ctx.fillStyle = flash ? '#fff' : 'rgba(120,70,10,0.4)';
    for (let k = 0; k < 3; k++) ellipse(ctx, -9 + k * 3, 0, 0.9, 4.2);
    ctx.fillStyle = col;
  } else {
    ellipse(ctx, -5, 0, 4.1, 2.8);
  }
  ellipse(ctx, 0, 0, 2.4, 1.9);
  if (e.type === 'soldier' || e.type === 'queen') {
    ellipse(ctx, 4.6, 0, 3.3, 2.9);
    ctx.strokeStyle = 'rgba(20,10,5,0.9)';
    ctx.beginPath(); ctx.moveTo(7.4, -1); ctx.lineTo(9.6, -0.2); ctx.moveTo(7.4, 1); ctx.lineTo(9.6, 0.2); ctx.stroke();
  } else {
    ellipse(ctx, 4.2, 0, 2.4, 2.1);
  }
  ctx.strokeStyle = 'rgba(20,10,5,0.8)';
  ctx.lineWidth = 0.6;
  const w = Math.sin(ph * 0.7) * 0.6;
  ctx.beginPath();
  ctx.moveTo(5.5, -0.9); ctx.lineTo(8, -2.8 + w);
  ctx.moveTo(5.5, 0.9); ctx.lineTo(8, 2.8 - w);
  ctx.stroke();
  if (e.type === 'queen') {
    ctx.fillStyle = flash ? '#fff' : (e.team === 0 ? '#ffe27a' : '#ff9ad0');
    ctx.beginPath(); ctx.moveTo(1.5, -2.3); ctx.lineTo(2.5, -4.3); ctx.lineTo(3.3, -2.5); ctx.lineTo(4.2, -4.3); ctx.lineTo(5, -2.3); ctx.closePath(); ctx.fill();
  }
  if (e.type === 'spitter') { ctx.fillStyle = '#d7ff7a'; ellipse(ctx, -6, 0, 2, 1.8); }
  if (e.type === 'nurse') { ctx.fillStyle = '#fff'; ctx.fillRect(-6.2, -0.5, 3, 1); ctx.fillRect(-5.2, -1.5, 1, 3); }
  if (e.carry > 0) { ctx.fillStyle = '#ffe08a'; ellipse(ctx, 7.4, 0, 1.9, 1.7); }
  ctx.restore();
}

function drawCreature(ctx: CanvasRenderingContext2D, e: Ent, lod: boolean) {
  const flash = e.flash > 0;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const ph = e.anim * 0.3;
  switch (e.type) {
    case 'beetle': {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const sw = Math.sin(ph + i * 2) * 2.5; ctx.moveTo(-5 + i * 5, 0); ctx.lineTo(-6 + i * 5 + sw, 12); ctx.moveTo(-5 + i * 5, 0); ctx.lineTo(-6 + i * 5 - sw, -12); }
      ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : '#2c3e5c'; ellipse(ctx, 0, 0, 14, 10);
      if (!lod) {
        ctx.fillStyle = flash ? '#fff' : '#3f5a85'; ellipse(ctx, -1, 0, 11, 7.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ellipse(ctx, -2, -3.5, 6, 2);
      }
      ctx.fillStyle = flash ? '#fff' : '#1b2638'; ellipse(ctx, 12, 0, 5.5, 4.5);
      ctx.strokeStyle = '#0b0f18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(21, -3); ctx.moveTo(15, 0); ctx.lineTo(21, 3); ctx.stroke();
      break;
    }
    case 'spider': {
      ctx.strokeStyle = '#1d1226'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const base = -3 + i * 3;
        const sw = Math.sin(ph * 1.4 + i * 1.7) * 3;
        ctx.moveTo(base, 0); ctx.lineTo(base + 4 + sw, 8); ctx.lineTo(base + 5 + sw * 1.4, 14);
        ctx.moveTo(base, 0); ctx.lineTo(base + 4 - sw, -8); ctx.lineTo(base + 5 - sw * 1.4, -14);
      }
      ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : '#4d2f60'; ellipse(ctx, -3, 0, 8, 6.5);
      ctx.fillStyle = flash ? '#fff' : '#35204a'; ellipse(ctx, 6, 0, 4.2, 3.6);
      if (!lod) { ctx.fillStyle = '#ff4a4a'; ellipse(ctx, 8.4, -1.4, 0.9, 0.9); ellipse(ctx, 8.4, 1.4, 0.9, 0.9); ctx.fillStyle = 'rgba(190,120,255,0.35)'; ellipse(ctx, -4, 0, 3.4, 2.4); }
      break;
    }
    case 'wasp': {
      const flap = Math.sin(e.anim * 2.2);
      ctx.fillStyle = 'rgba(210,235,255,0.45)';
      ctx.save(); ctx.translate(0, -2); ctx.rotate(-0.5 - flap * 0.5); ellipse(ctx, -2, -6, 3.2, 8); ctx.restore();
      ctx.save(); ctx.translate(0, 2); ctx.rotate(0.5 + flap * 0.5); ellipse(ctx, -2, 6, 3.2, 8); ctx.restore();
      ctx.fillStyle = flash ? '#fff' : '#f0c020'; ellipse(ctx, -7, 0, 7, 4);
      ctx.fillStyle = '#1a1a1a';
      for (let k = 0; k < 3; k++) ctx.fillRect(-11 + k * 4, -3.8, 1.8, 7.6);
      ctx.fillStyle = flash ? '#fff' : '#2a2018'; ellipse(ctx, 0, 0, 3.6, 3);
      ctx.fillStyle = flash ? '#fff' : '#d99a10'; ellipse(ctx, 5, 0, 2.8, 2.6);
      ctx.fillStyle = '#b00'; ellipse(ctx, 6.2, -1.4, 0.8, 0.8); ellipse(ctx, 6.2, 1.4, 0.8, 0.8);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-17, 0.8); ctx.lineTo(-14, 1.4); ctx.fill();
      break;
    }
    case 'centipede': {
      ctx.restore();
      ctx.save();
      for (let k = 11; k >= 0; k--) {
        const bx = e.x - Math.cos(e.a) * k * 8;
        const by = e.y - Math.sin(e.a) * k * 8;
        const wig = Math.sin(e.anim * 0.1 - k * 0.8) * 3;
        const px = bx - Math.sin(e.a) * wig;
        const py = by + Math.cos(e.a) * wig;
        ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        const lw = Math.sin(e.anim * 0.3 + k) * 2;
        ctx.moveTo(px - Math.sin(e.a) * (5 + lw), py + Math.cos(e.a) * (5 + lw)); ctx.lineTo(px + Math.sin(e.a) * (5 + lw), py - Math.cos(e.a) * (5 + lw));
        ctx.stroke();
        ctx.fillStyle = flash ? '#fff' : k === 0 ? '#8a2a10' : k % 2 ? '#c4571d' : '#d9702a';
        ctx.beginPath(); ctx.arc(px, py, k === 0 ? 6.5 : 5.2 - k * 0.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return;
    }
    case 'antlion': {
      ctx.restore();
      return;
    }
    case 'anteater': {
      ctx.strokeStyle = '#2b1d12'; ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) { const sw = Math.sin(ph + i * 3) * 6; ctx.moveTo(-12 + i * 26, 14); ctx.lineTo(-10 + i * 26 + sw, 32); ctx.moveTo(-12 + i * 26, -14); ctx.lineTo(-10 + i * 26 - sw, -32); }
      ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : '#4a3a2c'; ellipse(ctx, -44, 0, 26, 12);
      ctx.fillStyle = flash ? '#fff' : '#6d5a46'; ellipse(ctx, 0, 0, 34, 20);
      ctx.fillStyle = flash ? '#fff' : '#2e2218'; ellipse(ctx, -4, 0, 28, 6);
      ctx.fillStyle = flash ? '#fff' : '#8a7660'; ellipse(ctx, 30, 0, 14, 11);
      ctx.fillStyle = flash ? '#fff' : '#7d6a55';
      ctx.beginPath(); ctx.moveTo(34, -7); ctx.lineTo(78, -2); ctx.lineTo(78, 2); ctx.lineTo(34, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5a3a'; ellipse(ctx, 34, -6, 2.4, 2.4); ellipse(ctx, 34, 6, 2.4, 2.4);
      ctx.fillStyle = '#e8d8c0';
      for (let i = 0; i < 3; i++) { ctx.fillRect(32 + i * 4, 20 + 4, 1.5, 6); }
      break;
    }
    default: break;
  }
  ctx.restore();
}

function drawAntlionPit(ctx: CanvasRenderingContext2D, e: Ent, t: number) {
  const grd = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 36);
  grd.addColorStop(0, 'rgba(10,6,2,0.95)');
  grd.addColorStop(0.5, 'rgba(70,45,20,0.75)');
  grd.addColorStop(1, 'rgba(120,90,50,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(e.x, e.y, 36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,25,10,0.5)';
  ctx.lineWidth = 1;
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(e.x, e.y, k * 9 + Math.sin(t * 2 + k) * 1.5, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = e.flash > 0 ? '#fff' : '#2a1a0c';
  ctx.lineWidth = 2.2;
  const o = 5 + Math.sin(t * 5 + e.id) * 2;
  ctx.beginPath(); ctx.moveTo(e.x - o, e.y - 8); ctx.quadraticCurveTo(e.x - 2, e.y - 2, e.x - 1, e.y + 3); ctx.moveTo(e.x + o, e.y - 8); ctx.quadraticCurveTo(e.x + 2, e.y - 2, e.x + 1, e.y + 3); ctx.stroke();
}

/* ------------------------------------------------------------ weather tint state */
const tint = { r: 0, g: 0, b: 0, a: 0 };

/* ------------------------------------------------------------ main render */
export function renderGame(g: Game) {
  const ctx = g.ctx;
  const cv = g.canvas;
  const W = g.W;
  const H = g.H;
  const z = g.cam.z;
  const dpr = g.dpr;
  const t = g.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0704';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const shx = (Math.random() - 0.5) * g.shake * 2;
  const shy = (Math.random() - 0.5) * g.shake * 2;
  const ox = W / 2 - g.cam.x * z + shx;
  const oy = H / 2 - g.cam.y * z + shy;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
  const vx0 = Math.max(0, g.cam.x - W / 2 / z - 20);
  const vy0 = Math.max(0, g.cam.y - H / 2 / z - 20);
  const vx1 = Math.min(WORLD_W, g.cam.x + W / 2 / z + 20);
  const vy1 = Math.min(WORLD_H, g.cam.y + H / 2 / z + 20);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g.terrain, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);
  const cx0 = Math.max(0, Math.floor(vx0 / CELL));
  const cy0 = Math.max(0, Math.floor(vy0 / CELL));
  const cx1 = Math.min(MW - 1, Math.ceil(vx1 / CELL));
  const cy1 = Math.min(MH - 1, Math.ceil(vy1 / CELL));
  const lod = z < 0.62;

  // chambers
  for (const c of g.chambers) {
    const px = (c.cx + 0.5) * CELL;
    const py = (c.cy + 0.5) * CELL;
    if (px < vx0 - 60 || px > vx1 + 60 || py < vy0 - 60 || py > vy1 + 60) continue;
    const info = CHAMBER_INFO[c.type];
    ctx.globalAlpha = c.built ? 0.22 : 0.1;
    ctx.fillStyle = info.color;
    ctx.beginPath(); ctx.arc(px, py, CELL * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.active ? info.color : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash(c.built ? [] : [5, 4]);
    ctx.beginPath(); ctx.arc(px, py, CELL * 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (!c.built) {
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, CELL * 2.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.prog); ctx.stroke();
    }
    ctx.font = '20px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = c.active ? 0.95 : 0.55;
    ctx.fillText(info.icon, px, py);
    ctx.globalAlpha = 1;
    if (c.built && !c.active) { ctx.font = '12px system-ui'; ctx.fillText('⚠️', px + 18, py - 18); }
  }

  // food
  for (const f of g.food) {
    if (f.x < vx0 - 20 || f.x > vx1 + 20 || f.y < vy0 - 20 || f.y > vy1 + 20) continue;
    const ci = g.cellOf(f.x, f.y);
    if (!g.explored[ci]) continue;
    const k = Math.max(0.5, Math.min(1.3, f.amt / f.max + 0.3));
    if (f.kind === 'crumb') {
      ctx.fillStyle = '#e8d49a'; ctx.beginPath(); ctx.arc(f.x, f.y, 3.2 * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6cf'; ctx.beginPath(); ctx.arc(f.x - 1, f.y - 1, 1.2, 0, 7); ctx.fill();
    } else if (f.kind === 'berry') {
      ctx.fillStyle = '#c62a45'; ctx.beginPath(); ctx.arc(f.x, f.y, 4.6 * k, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(f.x - 1.5, f.y - 1.8, 1.3, 0, 7); ctx.fill();
    } else if (f.kind === 'carcass') {
      ctx.fillStyle = '#6a4a35'; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.id * 0.7); ellipse(ctx, 0, 0, 8 * k, 5.5 * k);
      ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-7, 6); ctx.moveTo(0, 0); ctx.lineTo(0, 7); ctx.moveTo(4, 0); ctx.lineTo(7, 6); ctx.stroke(); ctx.restore();
    } else {
      const s = 0.5 + 0.5 * Math.sin(t * 3 + f.id);
      ctx.fillStyle = `rgba(255,224,120,${0.35 + s * 0.5})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 5 + s * 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff4c0'; ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
    }
    if (f.kind !== 'cache' && f.amt > 0 && (f.id + Math.floor(t * 2)) % 9 === 0) {
      ctx.strokeStyle = 'rgba(255,255,200,0.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5); ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5); ctx.stroke();
    }
  }

  // pheromone
  if (g.phDirty && g.phFrame % 3 === 0) refreshPh(g);
  ctx.drawImage(g.phCanvas, 0, 0, WORLD_W, WORLD_H);

  // dig designations
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const i = y * MW + x;
      if (!g.dig[i]) continue;
      const px = x * CELL;
      const py = y * CELL;
      ctx.fillStyle = 'rgba(255,205,90,0.2)';
      ctx.fillRect(px, py, CELL, CELL);
      ctx.strokeStyle = 'rgba(255,225,130,0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
      ctx.setLineDash([]);
      const p = g.digProg[i] / DIG_TIME;
      if (p > 0) { ctx.fillStyle = 'rgba(255,240,170,0.6)'; ctx.fillRect(px + 3, py + CELL - 6, (CELL - 6) * Math.min(1, p), 3); }
    }
  }

  // antlion pits first
  for (const e of g.ents) {
    if (e.dead || e.type !== 'antlion') continue;
    if (e.x < vx0 - 40 || e.x > vx1 + 40 || e.y < vy0 - 40 || e.y > vy1 + 40) continue;
    if (!g.explored[e.cell < 0 ? 0 : e.cell]) continue;
    drawAntlionPit(ctx, e, t);
  }

  // eggs around queen
  {
    const q = g.queen;
    const n = Math.min(14, g.brood.length);
    for (let k = 0; k < n; k++) {
      const a = (k / Math.max(1, n)) * Math.PI * 2 + 0.5;
      const bx = q.x + Math.cos(a) * 22;
      const by = q.y + Math.sin(a) * 18;
      const b = g.brood[k];
      const pr = b.t / b.need;
      ctx.fillStyle = pr > 0.66 ? '#fff0c0' : '#f6f3ea';
      ellipse(ctx, bx, by, 2.4 + pr * 1.6, 3.2 + pr * 1.8);
    }
  }

  // entities
  const ground: Ent[] = [];
  const air: Ent[] = [];
  for (const e of g.ents) {
    if (e.dead || e.type === 'antlion') continue;
    if (e.x < vx0 - 90 || e.x > vx1 + 90 || e.y < vy0 - 90 || e.y > vy1 + 90) continue;
    if (e.team !== 0 && !g.visible[e.cell < 0 ? 0 : e.cell] && !g.ended) continue;
    if (e.flying) air.push(e); else ground.push(e);
  }
  const drawEnt = (e: Ent) => {
    if (e.team === 9) {
      if (e.flying) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(ctx, e.x, e.y + 11, 8, 3.5); ctx.save(); ctx.translate(0, -7); drawCreature(ctx, e, lod); ctx.restore(); } else drawCreature(ctx, e, lod);
    } else if (e.team === 0) {
      drawAnt(ctx, e, CASTE_COL[e.type] || '#e3a13a', lod, g);
    } else {
      const R = g.rivals[e.team - 1];
      drawAnt(ctx, e, R ? (e.type === 'soldier' ? R.def.color : R.def.color) : '#444', lod, g);
      if (!lod && R) {
        ctx.strokeStyle = e.type === 'soldier' ? 'rgba(255,60,60,0.8)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.type === 'queen' ? 14 : 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (e.hp < e.maxHp && !e.boss) {
      const bw = e.type === 'queen' ? 34 : e.type === 'anteater' ? 60 : Math.max(10, e.r * 2);
      const by = e.y - e.r - (e.type === 'queen' ? 18 : 9) - (e.flying ? 7 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 4);
      const p = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = p > 0.5 ? '#6fe07a' : p > 0.25 ? '#f1c94b' : '#ee5a4a';
      ctx.fillRect(e.x - bw / 2, by, bw * p, 2);
    }
    if (e.poison > 0) { ctx.fillStyle = 'rgba(160,255,90,0.8)'; ctx.fillRect(e.x - 1, e.y - e.r - 14, 2, 2); }
  };
  for (const e of ground) drawEnt(e);
  for (const e of air) drawEnt(e);

  // telegraphs
  for (const tg of g.telegraphs) {
    const p = 1 - tg.t / tg.max;
    ctx.fillStyle = `rgba(255,60,30,${0.1 + p * 0.25})`;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,80,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,230,200,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * p, 0, Math.PI * 2); ctx.stroke();
  }

  // projectiles
  for (const p of g.projs) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill();
  }

  // particles
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 1) {
      ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a) + 4, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.color; ctx.globalAlpha = a;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  // fog
  if (g.fogDirty) refreshFog(g);
  ctx.drawImage(g.fogCanvas, 0, 0, WORLD_W, WORLD_H);

  // floaters
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of g.floaters) {
    if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
    const a = Math.min(1, f.life / f.max * 1.6);
    const pop = 1 + Math.max(0, (f.life - (f.max - 0.15)) * 4);
    ctx.globalAlpha = a;
    ctx.font = `bold ${f.size * pop}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // cursor
  if (g.mouse.in && !g.paused && !g.ended && g.pointers.size < 2) {
    const w = g.screenToWorld(g.mouse.x, g.mouse.y);
    if (g.tool === 'build') {
      const info = CHAMBER_INFO[g.chamberSel];
      const cx = (Math.floor(w.x / CELL) + 0.5) * CELL;
      const cy = (Math.floor(w.y / CELL) + 0.5) * CELL;
      ctx.globalAlpha = 0.28; ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 2.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '22px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.icon, cx, cy);
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      const label = `${info.name} · ${g.chamberCost(g.chamberSel)} food`;
      ctx.strokeText(label, cx, cy + CELL * 3.2); ctx.fillText(label, cx, cy + CELL * 3.2);
    } else if (g.tool !== 'pan') {
      const rad = [0.6, 1.4, 2.4][g.brush - 1] * CELL;
      const col = g.tool === 'forage' ? '#5dffa0' : g.tool === 'war' ? '#ff5a5a' : g.tool === 'dig' ? '#ffd066' : '#ffffff';
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(5, rad), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // ---- screen space overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const wTarget = g.weather === 'rain' ? [30, 50, 85, 0.16] : g.weather === 'storm' ? [12, 18, 40, 0.3] : g.weather === 'heat' ? [255, 120, 30, 0.1] : g.weather === 'cold' ? [140, 190, 255, 0.11] : [0, 0, 0, 0];
  tint.r += (wTarget[0] - tint.r) * 0.04; tint.g += (wTarget[1] - tint.g) * 0.04; tint.b += (wTarget[2] - tint.b) * 0.04; tint.a += (wTarget[3] - tint.a) * 0.04;
  if (tint.a > 0.005) { ctx.fillStyle = `rgba(${tint.r | 0},${tint.g | 0},${tint.b | 0},${tint.a})`; ctx.fillRect(0, 0, W, H); }
  if (g.weather === 'rain' || g.weather === 'storm') {
    ctx.strokeStyle = g.weather === 'storm' ? 'rgba(200,220,255,0.4)' : 'rgba(190,210,235,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = g.weather === 'storm' ? 200 : 120;
    const skew = g.weather === 'storm' ? 8 : 3;
    for (let i = 0; i < n; i++) {
      const sp = 700 + (i % 7) * 70;
      const x = (i * 173.3 + t * 40 * (1 + (i % 3))) % (W + 40) - 20;
      const y = (i * 91.7 + t * sp) % (H + 30) - 15;
      ctx.moveTo(x, y); ctx.lineTo(x - skew, y + 14);
    }
    ctx.stroke();
  }
  if (g.weather === 'heat') {
    ctx.fillStyle = `rgba(255,200,100,${0.03 + 0.02 * Math.sin(t * 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, g.flash * 0.7)})`; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const qp = g.queen.hp / g.queen.maxHp;
  if (qp < 0.35) {
    const pulse = 0.12 + 0.1 * Math.sin(t * 6);
    const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    rg.addColorStop(0, 'rgba(200,0,0,0)');
    rg.addColorStop(1, `rgba(220,20,20,${pulse + (0.35 - qp)})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ------------------------------------------------------------ minimap */
export function renderMinimap(g: Game, mini: HTMLCanvasElement) {
  const ctx = mini.getContext('2d');
  if (!ctx) return;
  const w = mini.width;
  const h = mini.height;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g.terrain, 0, 0, w, h);
  // food hints
  ctx.fillStyle = '#ffe08a';
  for (const f of g.food) {
    if (f.amt <= 0 || !g.explored[g.cellOf(f.x, f.y)]) continue;
    ctx.fillRect(f.x * sx - 1, f.y * sy - 1, 2, 2);
  }
  ctx.drawImage(g.fogCanvas, 0, 0, w, h);
  const dot = (x: number, y: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2); ctx.fill(); };
  for (const c of g.chambers) { ctx.fillStyle = CHAMBER_INFO[c.type].color; ctx.fillRect((c.cx + 0.5) * CELL * sx - 2, (c.cy + 0.5) * CELL * sy - 2, 4, 4); }
  for (const e of g.ents) {
    if (e.dead || e.type === 'antlion') continue;
    if (e.team === 0) { if (e.type === 'queen') dot(e.x, e.y, 3.5, '#ffe27a'); else dot(e.x, e.y, 1.2, '#ffcf5a'); continue; }
    if (!g.visible[e.cell < 0 ? 0 : e.cell]) continue;
    if (e.boss) dot(e.x, e.y, 4 + Math.sin(g.time * 8), '#ff3030');
    else if (e.team === 9) dot(e.x, e.y, 1.6, '#ff5a5a');
    else dot(e.x, e.y, e.type === 'queen' ? 3 : 1.3, g.rivals[e.team - 1] ? '#d070ff' : '#fff');
  }
  const z = g.cam.z;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect((g.cam.x - g.W / 2 / z) * sx, (g.cam.y - g.H / 2 / z) * sy, (g.W / z) * sx, (g.H / z) * sy);
}

