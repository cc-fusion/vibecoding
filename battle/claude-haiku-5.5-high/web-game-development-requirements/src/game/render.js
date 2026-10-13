// Civilization Micro — canvas renderer, camera, particles, floating text, minimap
import { G, bus, SEL, SQ3, cityAt } from './engine.js';
import { TERRAIN, RESOURCES, IMPROVEMENTS, UNITS } from './data.js';

export const HEX = 34;
const TAU = Math.PI * 2;
export const CAM = { x: 0, y: 0, z: 1 };
const R = {
  canvas: null, ctx: null, mm: null, mmx: null, mmOff: null, dpr: 1, cw: 800, ch: 600,
  camT: null, shake: { m: 0, t: 0 }, shakeOn: true, parts: [], texts: [], disp: new Map(),
  quality: 'high', hover: -1, mmT: 0,
};
const SPR = new Map();
const RGBA = new Map();
const DIRS_EVEN = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIRS_ODD = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];

export function tw(W, i) {
  const x = i % W, y = (i / W) | 0;
  return [1.5 * HEX * x, SQ3 * HEX * (y + 0.5 * (x & 1))];
}

function rgba(hex, a) {
  const k = hex + a;
  let s = RGBA.get(k);
  if (!s) {
    const n = parseInt(hex.slice(1), 16);
    s = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    RGBA.set(k, s);
  }
  return s;
}

function hash01(i) { return (((i * 2654435761) >>> 0) % 1000) / 1000; }

export function initRender(canvas, mm) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  R.mm = mm;
  R.mmx = mm.getContext('2d');
  R.mmOff = document.createElement('canvas');
  resizeRender();
  if (!R.bound) {
    R.bound = true;
    bus.on('fx', onFx);
    bus.on('shake', (d) => {
      if (!R.shakeOn) return;
      R.shake.m = Math.max(R.shake.m, d.m);
      R.shake.t = Math.max(R.shake.t, d.t);
    });
  }
}

export function resizeRender() {
  if (!R.canvas) return;
  const r = R.canvas.getBoundingClientRect();
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.cw = Math.max(10, r.width);
  R.ch = Math.max(10, r.height);
  R.canvas.width = Math.round(R.cw * R.dpr);
  R.canvas.height = Math.round(R.ch * R.dpr);
}

export function setRenderOptions(o) {
  if (o.shake !== undefined) R.shakeOn = !!o.shake;
  if (o.quality) R.quality = o.quality;
}

export function setZoom(z, anchor) {
  const nz = Math.max(0.45, Math.min(2.2, z));
  CAM.z = nz;
  void anchor;
}
export function zoomBy(f) { setZoom(CAM.z * f); }
export function panBy(dx, dy) { CAM.x += dx / CAM.z; CAM.y += dy / CAM.z; if (R.camT) { R.camT.x += dx / CAM.z; R.camT.y += dy / CAM.z; } }
export function centerOn(i, instant) {
  if (!G.tiles || !G.tiles.length || i < 0) return;
  const [x, y] = tw(G.W, i);
  if (instant) { CAM.x = x; CAM.y = y; R.camT = null; }
  else R.camT = { x, y };
}
export function setHover(i) { R.hover = i; }

export function pickTile(px, py) {
  if (!G.tiles || !G.tiles.length) return -1;
  const hw = R.cw / 2, hh = R.ch / 2;
  const wx = (px - hw) / CAM.z + CAM.x, wy = (py - hh) / CAM.z + CAM.y;
  let best = -1, bd = Infinity;
  const cx = Math.round(wx / (1.5 * HEX));
  for (let x = cx - 1; x <= cx + 1; x++) {
    if (x < 0 || x >= G.W) continue;
    const yy = Math.round(wy / (SQ3 * HEX) - 0.5 * (x & 1));
    for (let y = yy - 1; y <= yy + 1; y++) {
      if (y < 0 || y >= G.H) continue;
      const i = y * G.W + x;
      const [tx, ty] = tw(G.W, i);
      const d = (tx - wx) * (tx - wx) + (ty - wy) * (ty - wy);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

function particleCount(n) { return Math.max(1, Math.round(n * (R.quality === 'low' ? 0.4 : 1))); }

function burst(i, col, n) {
  if (!G.tiles || !G.tiles.length || i < 0) return;
  const [x, y] = tw(G.W, i);
  for (let k = 0; k < particleCount(n); k++) {
    const a = Math.random() * TAU;
    const sp = 40 + Math.random() * 130;
    R.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: 0.6 + Math.random() * 0.6, col, s: 1.5 + Math.random() * 3 });
  }
  if (R.parts.length > 700) R.parts.splice(0, R.parts.length - 700);
}

function text(i, str, col, big) {
  if (!G.tiles || !G.tiles.length || i < 0) return;
  const [x, y] = tw(G.W, i);
  R.texts.push({ x, y: y - HEX * 0.6, text: str, col: col || '#fff', t: 0, life: big ? 2 : 1.4, big: !!big });
  if (R.texts.length > 40) R.texts.shift();
}

function onFx(d) {
  switch (d.type) {
    case 'burst': burst(d.i, d.col, d.n); break;
    case 'text': text(d.i, d.text, d.col, d.big); break;
    case 'hit': text(d.i, d.text, d.col, d.big); burst(d.i, d.col, 10); break;
    case 'claim': burst(d.i, '#63b3ed', 12); break;
    case 'grow': text(d.i, 'Growth', '#9ae6b4'); break;
    default: break;
  }
}

function updateFx(dt) {
  for (const p of R.parts) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
    p.vx *= Math.pow(0.4, dt);
  }
  R.parts = R.parts.filter((p) => p.t < p.life);
  for (const t of R.texts) t.t += dt;
  R.texts = R.texts.filter((t) => t.t < t.life);
  if (R.shake.t > 0) R.shake.t = Math.max(0, R.shake.t - dt);
  R.shake.m *= Math.pow(0.02, dt);
}

function hexPath(ctx, cx, cy, s) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const px = cx + s * Math.cos(a), py = cy + s * Math.sin(a);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawSprite(ctx, ch, x, y, size, a = 1) {
  const px = Math.max(6, Math.round(size));
  const key = ch + '|' + px;
  let c = SPR.get(key);
  if (!c) {
    if (SPR.size > 500) SPR.clear();
    c = document.createElement('canvas');
    const s = Math.ceil(px * 2.2);
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.font = `${px * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, s / 2, s / 2 + px * 0.05);
    SPR.set(key, c);
  }
  const d = c.width / 2;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  ctx.drawImage(c, x - d / 2, y - d / 2, d, d);
  ctx.globalAlpha = prev;
}

/* Draws a world (game or title backdrop) into ctx. */
export function drawWorld(ctx, world, cam, o) {
  const W = world.W, H = world.H, tiles = world.tiles;
  const z = cam.z, S = HEX * z;
  const hw = o.cw / 2 + (o.shakeX || 0), hh = o.ch / 2 + (o.shakeY || 0);
  const fog = !!(world.opts && world.opts.fog && world.vis);
  const vis = world.vis, exp = world.exp;
  const scr = (wx, wy) => [(wx - cam.x) * z + hw, (wy - cam.y) * z + hh];
  const civs = world.civs || [];
  const colOf = (o2) => (o2 >= 0 && civs[o2] ? civs[o2].col : '#7a3e1d');
  const cityMap = new Map(world.cities.map((c) => [c.i, c]));
  const campMap = new Map((world.camps || []).map((c) => [c.i, c]));
  const unitMap = new Map();
  for (const u of world.units || []) {
    const a = unitMap.get(u.i);
    if (a) a.push(u); else unitMap.set(u.i, [u]);
  }

  // visible tile list
  const vt = [];
  for (let i = 0; i < tiles.length; i++) {
    const x = i % W, y = (i / W) | 0;
    const [px, py] = scr(1.5 * HEX * x, SQ3 * HEX * (y + 0.5 * (x & 1)));
    if (px < -S * 2 || px > o.cw + S * 2 || py < -S * 2 || py > o.ch + S * 2) continue;
    vt.push({ i, px, py });
  }

  // 1. terrain + ownership tint
  for (const v of vt) {
    const t = tiles[v.i];
    const T = TERRAIN[t.t];
    hexPath(ctx, v.px, v.py, S);
    ctx.fillStyle = T.col;
    ctx.fill();
    const hv = hash01(v.i);
    if (hv > 0.55) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill(); }
    else if (hv < 0.2) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fill(); }
    if (t.own >= 0) { ctx.fillStyle = rgba(colOf(t.own), 0.17); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 2. decorations, resources, improvements
  if (z > 0.5) {
    for (const v of vt) {
      if (fog && !exp[v.i]) continue;
      const t = tiles[v.i];
      const T = TERRAIN[t.t];
      if (T.deco) drawSprite(ctx, T.deco, v.px, v.py - S * 0.05, S * 0.7, 0.9);
      if (t.r) {
        const R2 = RESOURCES[t.r];
        if (T.deco) drawSprite(ctx, R2.icon, v.px + S * 0.5, v.py - S * 0.45, S * 0.42);
        else drawSprite(ctx, R2.icon, v.px, v.py, S * 0.8);
      }
      if (t.imp) drawSprite(ctx, IMPROVEMENTS[t.imp].icon, v.px - S * 0.5, v.py + S * 0.45, S * 0.4);
    }
  }

  // 3. borders
  ctx.lineWidth = Math.max(1.5, 3 * z);
  for (const v of vt) {
    const t = tiles[v.i];
    if (t.own < 0) continue;
    if (fog && !exp[v.i]) continue;
    const x = v.i % W, y = (v.i / W) | 0;
    const dirs = x & 1 ? DIRS_ODD : DIRS_EVEN;
    ctx.strokeStyle = rgba(colOf(t.own), 0.95);
    for (let k = 0; k < 6; k++) {
      const nx = x + dirs[k][0], ny = y + dirs[k][1];
      const same = nx >= 0 && ny >= 0 && nx < W && ny < H && tiles[ny * W + nx].own === t.own;
      if (same) continue;
      const a0 = (Math.PI / 3) * k, a1 = (Math.PI / 3) * (k + 1);
      ctx.beginPath();
      ctx.moveTo(v.px + S * Math.cos(a0), v.py + S * Math.sin(a0));
      ctx.lineTo(v.px + S * Math.cos(a1), v.py + S * Math.sin(a1));
      ctx.stroke();
    }
  }

  // 4. fog of war
  if (fog) {
    for (const v of vt) {
      if (vis[v.i]) continue;
      hexPath(ctx, v.px, v.py, S);
      ctx.fillStyle = exp[v.i] ? 'rgba(8,12,20,0.46)' : 'rgba(6,9,14,0.94)';
      ctx.fill();
    }
  }

  // 5. selection & move/attack highlights
  const inView = (i) => {
    const x = i % W, y = (i / W) | 0;
    const [px, py] = scr(1.5 * HEX * x, SQ3 * HEX * (y + 0.5 * (x & 1)));
    return [px, py];
  };
  if (SEL.kind === 'unit' || SEL.kind === 'city') {
    if (SEL.kind === 'unit') {
      for (const j of SEL.moves) {
        if (fog && !vis[j]) continue;
        const [px, py] = inView(j);
        hexPath(ctx, px, py, S);
        ctx.fillStyle = 'rgba(90,170,255,0.26)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(130,200,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      for (const [j] of SEL.attacks) {
        const [px, py] = inView(j);
        hexPath(ctx, px, py, S);
        ctx.fillStyle = 'rgba(255,90,90,0.3)';
        ctx.fill();
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    } else if (SEL.kind === 'city') {
      const c = world.cities.find((x) => x.id === SEL.id);
      if (c) {
        const cand = [c.i, ...c.worked];
        for (const j of cand) {
          const [px, py] = inView(j);
          hexPath(ctx, px, py, S * 0.94);
          ctx.strokeStyle = j === c.i ? 'rgba(255,209,102,0.9)' : 'rgba(255,209,102,0.5)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }
  if (SEL.i >= 0 && SEL.kind === 'tile') {
    const [px, py] = inView(SEL.i);
    hexPath(ctx, px, py, S);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (R.hover >= 0 && R.hover < tiles.length) {
    const [px, py] = inView(R.hover);
    hexPath(ctx, px, py, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 6. camps
  for (const cp of world.camps || []) {
    if (fog && !exp[cp.i]) continue;
    const [px, py] = inView(cp.i);
    ctx.beginPath();
    ctx.arc(px, py, S * 0.5, 0, TAU);
    ctx.fillStyle = 'rgba(122,62,29,0.85)';
    ctx.fill();
    drawSprite(ctx, '🏕️', px, py, S * 0.7);
    if (cp.hp < 90) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(px - S * 0.4, py + S * 0.6, S * 0.8 * (cp.hp / 90), Math.max(2, 3 * z));
    }
  }

  // 7. cities
  for (const c of world.cities) {
    if (fog && !exp[c.i]) continue;
    const [px, py] = inView(c.i);
    const col = colOf(c.o);
    ctx.beginPath();
    ctx.arc(px, py, S * 0.5, 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = Math.max(2, 2.5 * z);
    ctx.strokeStyle = c.cap ? '#ffd166' : 'rgba(255,255,255,0.9)';
    ctx.stroke();
    drawSprite(ctx, c.cap ? '🏰' : '🏘️', px, py, S * 0.62);
    const fs = Math.max(9, S * 0.36);
    ctx.font = `600 ${fs}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(c.name, px, py - S * 0.62);
    ctx.fillStyle = '#fff8e1';
    ctx.fillText(c.name, px, py - S * 0.62);
    ctx.beginPath();
    ctx.arc(px + S * 0.45, py - S * 0.45, Math.max(6, S * 0.2), 0, TAU);
    ctx.fillStyle = '#1a202c';
    ctx.fill();
    ctx.font = `700 ${Math.max(8, S * 0.25)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(String(c.size), px + S * 0.45, py - S * 0.45);
  }

  // 8. units (eased toward their tile)
  const ids = new Set();
  const ease = Math.min(1, (o.dt || 0.016) * 9);
  for (const u of world.units || []) {
    if (fog && u.o !== 0 && !vis[u.i]) continue;
    ids.add(u.id);
    const [tx, ty] = tw(W, u.i);
    const off = cityMap.has(u.i) ? S * 0.32 : 0;
    const tgtX = tx + off, tgtY = ty + off;
    let d = R.disp.get(u.id);
    if (!d) { d = { x: tgtX, y: tgtY }; R.disp.set(u.id, d); }
    d.x += (tgtX - d.x) * ease;
    d.y += (tgtY - d.y) * ease;
    const [px, py] = scr(d.x, d.y);
    const col = colOf(u.o);
    const r = S * 0.4;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.strokeStyle = u.o === 0 ? '#ffd166' : 'rgba(255,255,255,0.85)';
    ctx.stroke();
    if (SEL.kind === 'unit' && SEL.id === u.id) {
      const pulse = 0.5 + 0.5 * Math.sin((o.time || 0) * 6);
      ctx.beginPath();
      ctx.arc(px, py, r + 4 * z + pulse * 3 * z, 0, TAU);
      ctx.strokeStyle = `rgba(255,209,102,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    drawSprite(ctx, UNITS[u.type].icon, px, py, S * 0.5);
    if (u.fort) drawSprite(ctx, '🛡️', px + r * 0.8, py - r * 0.8, S * 0.3);
    if (u.hp < 100) {
      const bw = S * 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(px - bw / 2, py + r + 2, bw, Math.max(3, 4 * z));
      ctx.fillStyle = u.hp > 50 ? '#68d391' : u.hp > 25 ? '#f6e05e' : '#fc8181';
      ctx.fillRect(px - bw / 2, py + r + 2, bw * (u.hp / 100), Math.max(3, 4 * z));
    }
  }
  for (const k of R.disp.keys()) if (!ids.has(k)) R.disp.delete(k);
  void unitMap;
  return { hw, hh };
}

function drawFx(ctx, hw, hh) {
  const z = CAM.z;
  for (const p of R.parts) {
    const a = 1 - p.t / p.life;
    const px = (p.x - CAM.x) * z + hw, py = (p.y - CAM.y) * z + hh;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(px, py, p.s * z, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of R.texts) {
    const k = t.t / t.life;
    const pop = k < 0.12 ? 1 + (0.12 - k) * 2.5 : 1;
    const px = (t.x - CAM.x) * z + hw;
    const py = (t.y - CAM.y) * z + hh - k * 34;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.pow(k, 2.2));
    const fs = (t.big ? 17 : 13) * pop * Math.max(0.8, z);
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(t.text, px, py);
    ctx.fillStyle = t.col;
    ctx.fillText(t.text, px, py);
    ctx.restore();
  }
}

export function renderFrame(dt, now, uiTime) {
  if (!R.ctx) return;
  updateFx(dt);
  if (R.camT) {
    const k = Math.min(1, dt * 8);
    CAM.x += (R.camT.x - CAM.x) * k;
    CAM.y += (R.camT.y - CAM.y) * k;
    if (Math.abs(R.camT.x - CAM.x) < 0.5 && Math.abs(R.camT.y - CAM.y) < 0.5) R.camT = null;
  }
  const ctx = R.ctx;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = '#0a1019';
  ctx.fillRect(0, 0, R.cw, R.ch);
  let sx = 0, sy = 0;
  if (R.shake.t > 0 && R.shake.m > 0.2) {
    sx = (Math.random() * 2 - 1) * R.shake.m;
    sy = (Math.random() * 2 - 1) * R.shake.m;
  }
  const world = G.tiles && G.tiles.length ? G : null;
  if (world) {
    const r = drawWorld(ctx, world, CAM, { cw: R.cw, ch: R.ch, shakeX: sx, shakeY: sy, dt, time: uiTime, sel: SEL });
    drawFx(ctx, r.hw, r.hh);
  }
  R.mmT -= dt;
  if (R.mmT <= 0) { R.mmT = 0.3; drawMinimap(); }
  void now;
}

/* Renders a static terrain-only world (title backdrop). */
export function drawBackdrop(canvas, world, cam, time) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr)) {
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a1019';
  ctx.fillRect(0, 0, r.width, r.height);
  drawWorld(ctx, world, cam, { cw: r.width, ch: r.height, time, dt: 0.016, sel: { kind: null, moves: new Set(), attacks: new Map() } });
}

export function drawMinimap() {
  if (!R.mm || !G.tiles || !G.tiles.length) return;
  const W = G.W, H = G.H;
  const mmW = 170, mmH = Math.round((mmW * H) / W);
  if (R.mm.width !== mmW || R.mm.height !== mmH) { R.mm.width = mmW; R.mm.height = mmH; }
  const off = R.mmOff;
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  const img = octx.createImageData(W, H);
  const fog = !!G.opts.fog;
  for (let i = 0; i < G.tiles.length; i++) {
    const t = G.tiles[i];
    const seen = !fog || G.exp[i];
    let c;
    if (!seen) c = [8, 11, 18];
    else if (t.own >= 0) {
      const hex = G.civs[t.own].col;
      const n = parseInt(hex.slice(1), 16);
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else {
      const n = parseInt(TERRAIN[t.t].col.slice(1), 16);
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const p = i * 4;
    img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  for (const c of G.cities) {
    if (fog && !G.exp[c.i]) continue;
    octx.fillStyle = c.o === 0 ? '#ffffff' : '#ffd166';
    octx.fillRect(c.i % W, (c.i / W) | 0, 1, 1);
  }
  const mx = R.mmx;
  mx.imageSmoothingEnabled = false;
  mx.clearRect(0, 0, mmW, mmH);
  mx.drawImage(off, 0, 0, mmW, mmH);
  // viewport
  const tilesW = (R.cw / CAM.z) / (1.5 * HEX);
  const tilesH = (R.ch / CAM.z) / (SQ3 * HEX);
  const cxT = CAM.x / (1.5 * HEX), cyT = CAM.y / (SQ3 * HEX);
  const sx = ((cxT - tilesW / 2) / W) * mmW, sy = ((cyT - tilesH / 2) / H) * mmH;
  mx.strokeStyle = '#ffd166';
  mx.lineWidth = 1.5;
  mx.strokeRect(sx, sy, (tilesW / W) * mmW, (tilesH / H) * mmH);
}

export function minimapToTile(fx, fy) {
  if (!G.tiles || !G.tiles.length) return -1;
  const x = Math.max(0, Math.min(G.W - 1, Math.floor(fx * G.W)));
  const y = Math.max(0, Math.min(G.H - 1, Math.floor(fy * G.H)));
  return y * G.W + x;
}

export function mapCanvasSize() { return { cw: R.cw, ch: R.ch }; }
