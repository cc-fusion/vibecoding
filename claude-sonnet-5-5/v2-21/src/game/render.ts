// ===== Rendering: parallax neon city, entities, player, FX, HUD =====
import { DISTRICTS, PACKAGES, clamp, rng } from './data';
import { GADGETS } from './data';
import type { Game } from './engine';
import type { Ent, Solid } from './level';

function hex(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
let bgCols: string[] = [];

export function makeBackground(g: Game) {
  const pal = DISTRICTS[g.cfg.contract.district].pal;
  const mk = (seed: number, color: string, minH: number, maxH: number, wMin: number, wMax: number, winP: number) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 520;
    const c = cv.getContext('2d')!; const r = rng(seed + g.cfg.contract.district * 13);
    let x = 0;
    while (x < 1024) {
      const w = wMin + r() * (wMax - wMin), h = minH + r() * (maxH - minH);
      c.fillStyle = color; c.fillRect(x, 520 - h, w - 2, h);
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, 520 - h, w - 2, 2);
      for (let wy = 520 - h + 10; wy < 505; wy += 14) for (let wx = x + 6; wx < x + w - 10; wx += 11) {
        if (r() < winP) { c.globalAlpha = 0.25 + r() * 0.65; c.fillStyle = r() < 0.2 ? pal.accent : pal.win; c.fillRect(wx, wy, 5, 7); }
      }
      c.globalAlpha = 1;
      if (r() < 0.3) { c.fillStyle = color; c.fillRect(x + w / 2, 520 - h - 30, 2, 30); c.fillStyle = '#ff3355'; c.fillRect(x + w / 2 - 1, 520 - h - 32, 4, 4); }
      if (r() < 0.22) { c.fillStyle = r() < 0.5 ? pal.accent : pal.accent2; c.globalAlpha = 0.85; c.fillRect(x + 8, 520 - h + 30 + r() * 40, 8, 40 + r() * 40); c.globalAlpha = 1; }
      x += w;
    }
    return cv;
  };
  bgCols = [mix(pal.skyBot, '#000000', 0.62), mix(pal.bldg, pal.fog, 0.2), pal.bldg];
  g.bgLayers = [mk(1, bgCols[0], 120, 300, 50, 110, 0.1), mk(2, bgCols[1], 160, 380, 60, 130, 0.22), mk(3, bgCols[2], 220, 480, 80, 170, 0.3)];
  const pc = document.createElement('canvas'); pc.width = 48; pc.height = 56;
  const c = pc.getContext('2d')!; const r = rng(99);
  for (let y = 4; y < 56; y += 14) for (let x = 6; x < 48; x += 14) if (r() < 0.5) { c.fillStyle = r() < 0.3 ? pal.accent : pal.win; c.globalAlpha = 0.3 + r() * 0.5; c.fillRect(x, y, 6, 8); }
  g.winPat = g.ctx.createPattern(pc, 'repeat');
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

export function renderGame(g: Game) {
  const c = g.ctx, W = g.cw, H = g.ch;
  const pal = DISTRICTS[g.cfg.contract.district].pal;
  g.scale = (H / 720) * g.cam.zoom; g.vw = W / g.scale; g.vh = H / g.scale;
  const sc = g.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // sky
  const sg = c.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, pal.skyTop); sg.addColorStop(0.75, pal.skyBot); sg.addColorStop(1, pal.skyTop);
  c.fillStyle = sg; c.fillRect(0, 0, W, H);
  // moon / glow
  const mx = W * 0.72 - ((g.cam.x * 0.02) % (W * 1.4)), my = H * 0.2;
  const mg = c.createRadialGradient(mx, my, 4, mx, my, H * 0.28);
  mg.addColorStop(0, pal.accent + 'cc'); mg.addColorStop(0.15, pal.accent + '44'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = mg; c.fillRect(0, 0, W, H);
  // parallax skyline
  const L = [{ f: 0.08, k: 0.8 }, { f: 0.2, k: 0.85 }, { f: 0.4, k: 0.95 }];
  for (let i = 0; i < 3; i++) {
    const tile = g.bgLayers[i]; if (!tile) continue;
    const k = sc * L[i].k, tw = tile.width * k, th = tile.height * k;
    const off = -(((g.cam.x * L[i].f * sc) % tw) + tw) % tw;
    const by = H * 0.93 - (g.cam.y - 44) * L[i].f * sc;
    for (let x = off; x < W; x += tw) c.drawImage(tile, x, by - th, tw + 1, th);
    c.fillStyle = bgCols[i]; c.fillRect(0, by - 1, W, H - by + 2);
    if (i < 2) { const fg = c.createLinearGradient(0, by - th * 0.6, 0, by); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, pal.fog + '55'); c.fillStyle = fg; c.fillRect(0, by - th * 0.6, W, th * 0.6); }
  }
  const typ = g.segs[Math.min(g.legIdx, g.segs.length - 1)]?.type;
  if (typ === 'undercity') { c.fillStyle = 'rgba(0,12,10,0.38)'; c.fillRect(0, 0, W, H); }

  // ===== world =====
  c.save();
  const shx = (Math.random() - 0.5) * g.shake * 2, shy = (Math.random() - 0.5) * g.shake * 2;
  c.scale(sc, sc); c.translate(-g.cam.x + shx, -g.cam.y + shy);
  const x0 = g.cam.x - 80, x1 = g.cam.x + g.vw + 80, yb = g.cam.y + g.vh + 50;
  for (const s of g.solids) { if (s.x > x1 || s.x + s.w < x0 || s.x < -50000) continue; drawSolid(c, g, s, pal.accent, pal.accent2, pal.bldg); }
  for (const e of g.ents) { if (e.dead) continue; if (e.t !== 'zip' && (e.x > x1 + 100 || e.x < x0 - 100)) continue; drawEnt(c, g, e, pal.accent, pal.accent2); }
  // marks
  for (const m of g.marks) {
    if (m.kind === 'missile') {
      const f = clamp(m.t / m.max, 0, 1);
      c.strokeStyle = `rgba(255,50,70,${0.4 + 0.5 * Math.sin(m.t * 25) ** 2})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(m.x, m.y - 2, 85 * (1 - f * 0.4), 14, 0, 0, 6.3); c.stroke();
      c.fillStyle = 'rgba(255,60,60,0.22)'; c.fillRect(m.x - 3, m.y - 600 * (1 - f), 6, 600 * (1 - f) * 0.2);
      c.fillStyle = '#ff7a3a'; c.beginPath(); c.arc(m.x, m.y - 600 * (1 - f * f) , 8, 0, 6.3); c.fill();
    } else {
      const gr = g.groundAt(m.x); const gy = gr ? gr.y : g.p.y + 44;
      const gg = c.createLinearGradient(m.x - 160, 0, m.x + 10, 0); gg.addColorStop(0, 'rgba(255,40,80,0)'); gg.addColorStop(1, 'rgba(255,80,110,0.95)');
      c.fillStyle = gg; c.fillRect(m.x - 160, gy - 30, 170, 30);
    }
  }
  for (const b of g.bolts) { c.fillStyle = '#ffb36a'; c.shadowColor = '#ff7a3a'; c.shadowBlur = 12; c.beginPath(); c.arc(b.x, b.y, 5, 0, 6.3); c.fill(); c.shadowBlur = 0; }
  if (g.empFx > 0) {
    const f = 1 - g.empFx / 0.6; c.strokeStyle = `rgba(40,224,255,${1 - f})`; c.lineWidth = 6; c.beginPath(); c.arc(g.empPos.x, g.empPos.y, 560 * f, 0, 6.3); c.stroke();
  }
  drawPack(c, g);
  drawPlayer(c, g);
  // particles
  for (const glow of [false, true]) {
    c.globalCompositeOperation = glow ? 'lighter' : 'source-over';
    for (const q of g.parts) {
      if (q.glow !== glow || q.x < x0 || q.x > x1 || q.y > yb) continue;
      c.globalAlpha = clamp(q.life / q.max, 0, 1); c.fillStyle = q.color;
      if (q.size < 1.5 && !q.glow) c.fillRect(q.x, q.y, 1, 9); else c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const t of g.texts) {
    c.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1); c.font = `800 ${t.size}px Orbitron, sans-serif`;
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(t.text, t.x, t.y); c.fillStyle = t.color; c.fillText(t.text, t.x, t.y);
  }
  c.globalAlpha = 1;
  // terminal prompt in world
  if (g.nearTerm && !g.hack && !g.ended) {
    const t = g.nearTerm; const lock = (t.lock ?? 0) > 0;
    c.font = '800 15px Orbitron, sans-serif'; c.lineWidth = 4; c.strokeStyle = '#000';
    const txt = lock ? 'LOCKED OUT' : '[E] HACK'; const yy = t.y - 100 + Math.sin(g.realT * 6) * 3;
    c.strokeText(txt, t.x, yy); c.fillStyle = lock ? '#ff5577' : '#42ffa8'; c.fillText(txt, t.x, yy);
  }
  c.restore();

  // ===== screen overlays =====
  const p = g.p;
  const sr = clamp((p.vx - 520) / 450, 0, 1);
  if (sr > 0.05) {
    c.strokeStyle = `rgba(255,255,255,${0.1 * sr})`; c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = Math.random() * H, x = Math.random() * W, l = (60 + Math.random() * 160) * sr; c.beginPath(); c.moveTo(x, y); c.lineTo(x - l, y); c.stroke(); }
  }
  if (g.mods.has('blackout')) {
    const px = (p.x + 11 - g.cam.x) * sc, py = (p.y - g.cam.y) * sc;
    const bg = c.createRadialGradient(px, py, 40 * sc, px, py, 320 * sc); bg.addColorStop(0, 'rgba(0,0,6,0)'); bg.addColorStop(1, 'rgba(0,0,6,0.96)');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
  }
  if (g.vig) { c.fillStyle = g.vig; c.fillRect(0, 0, W, H); }
  if (g.integrity < 30 && !g.ended) { c.fillStyle = `rgba(255,0,40,${0.06 + 0.06 * Math.sin(g.realT * 8)})`; c.fillRect(0, 0, W, H); }
  if (g.smokeFx > 0) { c.fillStyle = `rgba(190,200,220,${Math.min(0.35, g.smokeFx * 0.3)})`; c.fillRect(0, 0, W, H); }
  if (g.flash > 0) { c.globalAlpha = Math.min(0.5, g.flash); c.fillStyle = g.flashCol; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  // pack siren glow at left
  if (g.pack.active) {
    const gap = p.x - g.pack.x, f = clamp(1 - gap / 1100, 0, 1);
    if (f > 0.02) {
      const red = Math.sin(g.pack.pulse * 12) > 0;
      const sg2 = c.createLinearGradient(0, 0, W * 0.35, 0); sg2.addColorStop(0, (red ? 'rgba(255,30,60,' : 'rgba(40,80,255,') + (0.5 * f) + ')'); sg2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg2; c.fillRect(0, 0, W * 0.35, H);
    }
  }
  drawHUD(c, g, W, H);
  if (g.hack) g.hack.draw(c, W, H);
}

function drawSolid(c: CanvasRenderingContext2D, g: Game, s: Solid, acc: string, acc2: string, bldg: string) {
  switch (s.kind) {
    case 'plat': {
      c.fillStyle = bldg; c.fillRect(s.x, s.y, s.w, s.h);
      if (g.winPat) { c.globalAlpha = 0.55; c.fillStyle = g.winPat; c.fillRect(s.x + 6, s.y + 26, s.w - 12, Math.min(s.h, 700)); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(s.x, s.y, 3, Math.min(s.h, 700));
      c.globalAlpha = 0.22; c.fillStyle = acc; c.fillRect(s.x - 2, s.y - 3, s.w + 4, 11); c.globalAlpha = 1;
      c.fillStyle = acc; c.fillRect(s.x, s.y, s.w, 3);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(s.x, s.y + 3, s.w, 5);
      break;
    }
    case 'crate':
      c.fillStyle = '#1a1530'; c.fillRect(s.x, s.y, s.w, s.h); c.strokeStyle = acc2; c.lineWidth = 2; c.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + s.w, s.y + s.h); c.moveTo(s.x + s.w, s.y); c.lineTo(s.x, s.y + s.h); c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1; break;
    case 'wall':
      if (s.block) {
        c.fillStyle = '#12101e'; c.fillRect(s.x, s.y, s.w, s.h);
        for (let y = s.y; y < s.y + s.h; y += 24) { c.fillStyle = (Math.floor(y / 24) % 2) ? '#ff3355' : '#f4f4ff'; c.globalAlpha = 0.85; c.fillRect(s.x, y, s.w, 12); }
        c.globalAlpha = 1; c.fillStyle = Math.sin(g.realT * 12) > 0 ? '#ff2244' : '#3355ff'; c.fillRect(s.x - 2, s.y - 8, s.w + 4, 8);
      } else {
        c.fillStyle = '#0f0c1f'; c.fillRect(s.x, s.y, s.w, s.h);
        if (g.winPat) { c.globalAlpha = 0.45; c.fillStyle = g.winPat; c.fillRect(s.x + 4, s.y + 8, s.w - 8, s.h - 8); c.globalAlpha = 1; }
        c.fillStyle = acc2; c.globalAlpha = 0.85; c.fillRect(s.x, s.y, 3, s.h); c.fillRect(s.x + s.w - 3, s.y, 3, s.h); c.globalAlpha = 1;
        c.fillStyle = acc; c.fillRect(s.x, s.y, s.w, 3);
      }
      break;
    case 'ceil':
      c.fillStyle = '#2a2a3a'; c.fillRect(s.x, s.y, s.w, s.h); c.fillStyle = '#ff9d2e'; c.fillRect(s.x, s.y + s.h - 6, s.w, 6);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(s.x, s.y + 6, s.w, 8);
      for (let x = s.x + 10; x < s.x + s.w; x += 30) { c.fillStyle = '#111'; c.fillRect(x, s.y, 5, s.h); }
      break;
    case 'train':
      c.fillStyle = '#1c1a30'; c.fillRect(s.x, s.y, s.w, s.h); c.fillStyle = acc; c.fillRect(s.x, s.y, s.w, 4);
      for (let x = s.x + 12; x < s.x + s.w - 20; x += 36) { c.fillStyle = acc2; c.globalAlpha = 0.8; c.fillRect(x, s.y + 16, 22, 16); c.globalAlpha = 1; }
      c.fillStyle = '#ffee99'; c.fillRect(s.x + s.w - 4, s.y + 24, 4, 10); break;
    case 'crane':
      c.fillStyle = '#2b2630'; c.fillRect(s.x, s.y, s.w, s.h);
      for (let x = s.x; x < s.x + s.w; x += 20) { c.fillStyle = '#ffc12e'; c.fillRect(x, s.y, 10, s.h); }
      c.fillStyle = acc; c.fillRect(s.x, s.y, s.w, 2);
      c.strokeStyle = 'rgba(200,200,220,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x + s.w / 2, s.y); c.lineTo(s.x + s.w / 2, s.y - 900); c.stroke(); break;
  }
}

function drawEnt(c: CanvasRenderingContext2D, g: Game, e: Ent, acc: string, acc2: string) {
  const t = g.realT;
  const off = !!e.dis || (e.off ?? 0) > 0;
  switch (e.t) {
    case 'gate': {
      c.fillStyle = acc; c.globalAlpha = 0.9; c.fillRect(e.x - 70, e.y - 230, 5, 230); c.fillRect(e.x + 65, e.y - 230, 5, 230); c.fillRect(e.x - 70, e.y - 232, 140, 6); c.globalAlpha = 0.12; c.fillRect(e.x - 66, e.y - 230, 132, 230); c.globalAlpha = 1;
      c.font = '800 14px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(e.text || '', e.x, e.y - 246); break;
    }
    case 'pad': {
      const col = g.boss && g.boss.hp > 0 ? '#ff5577' : '#42ffa8';
      const gr = c.createLinearGradient(0, e.y - 500, 0, e.y); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col + '99');
      c.fillStyle = gr; c.fillRect(e.x - 50, e.y - 500, 100, 500);
      c.fillStyle = col; c.fillRect(e.x - 90, e.y - 4, 180, 5); c.font = '800 20px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('DROP', e.x, e.y - 40 + Math.sin(t * 4) * 4);
      break;
    }
    case 'chip': { const s = Math.abs(Math.sin(t * 5 + e.x * 0.01)); c.fillStyle = '#ffe04a'; c.shadowColor = '#ffb02e'; c.shadowBlur = 8; c.beginPath(); c.moveTo(e.x, e.y - 9); c.lineTo(e.x + 6 * (0.4 + s * 0.6), e.y); c.lineTo(e.x, e.y + 9); c.lineTo(e.x - 6 * (0.4 + s * 0.6), e.y); c.fill(); c.shadowBlur = 0; break; }
    case 'vent': {
      c.fillStyle = '#222'; c.fillRect(e.x - 27, e.y - 5, 54, 5); c.fillStyle = acc2; c.fillRect(e.x - 27, e.y - 5, 54, 1.5);
      for (let i = 0; i < 4; i++) { const f = ((t * 1.3 + i * 0.25) % 1); c.globalAlpha = (1 - f) * 0.3; c.fillStyle = '#dff'; c.beginPath(); c.arc(e.x + Math.sin(i * 2 + t) * 6, e.y - 10 - f * 90, 8 + f * 14, 0, 6.3); c.fill(); }
      c.globalAlpha = 1; break;
    }
    case 'trip': {
      if (e.dead) break;
      c.fillStyle = '#333'; c.fillRect(e.x - 8, e.y - 44, 3, 44); c.fillRect(e.x + 5, e.y - 44, 3, 44);
      c.strokeStyle = off ? '#556' : `rgba(255,50,80,${0.6 + 0.4 * Math.sin(t * 20)})`; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x - 6, e.y - 34); c.lineTo(e.x + 6, e.y - 34); c.stroke(); break;
    }
    case 'laser': {
      const col = off ? '#556' : '#ff3355';
      c.fillStyle = '#2a2a3a'; c.fillRect(e.x - 8, e.y - e.h - 8, 16, 10); c.fillRect(e.x - 8, e.y - 4, 16, 6);
      if (!off && e.state === 1) { c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 16; c.fillRect(e.x - 3, e.y - e.h, 6, e.h); c.shadowBlur = 0; c.fillStyle = '#fff'; c.fillRect(e.x - 1, e.y - e.h, 2, e.h); }
      else if (!off && e.state === 2 && Math.sin(t * 50) > 0) { c.globalAlpha = 0.5; c.fillStyle = col; c.fillRect(e.x - 1, e.y - e.h, 2, e.h); c.globalAlpha = 1; }
      else { c.globalAlpha = 0.25; c.fillStyle = col; c.fillRect(e.x - 0.5, e.y - e.h, 1, e.h); c.globalAlpha = 1; }
      break;
    }
    case 'turret': {
      const dx = g.p.x - e.x, dy = g.p.y + 20 - e.y, a = Math.atan2(dy, dx);
      c.fillStyle = '#2b2b3d'; c.fillRect(e.x - 14, e.y - 4, 28, 12);
      c.save(); c.translate(e.x, e.y - 4); c.rotate(a); c.fillStyle = off ? '#444' : '#555a77'; c.fillRect(0, -4, 24, 8);
      if (e.state === 1 && !off) { c.strokeStyle = 'rgba(255,60,60,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(24, 0); c.lineTo(700, 0); c.stroke(); }
      c.restore();
      c.fillStyle = off ? '#444' : '#ff3355'; c.beginPath(); c.arc(e.x, e.y - 4, 5, 0, 6.3); c.fill(); break;
    }
    case 'drone': {
      if (e.dead) break;
      const col = off ? '#556' : e.chase ? '#ff3355' : '#ffb02e';
      if (!off && (e.scan ?? 0) > 0 || (!off && !e.chase)) {
        const gr = c.createLinearGradient(0, e.y, 0, e.y + 340); gr.addColorStop(0, (e.scan ?? 0) > 0 ? 'rgba(255,60,80,0.28)' : 'rgba(255,200,80,0.12)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(e.x - 10, e.y + 6); c.lineTo(e.x + 10, e.y + 6); c.lineTo(e.x + 105, e.y + 340); c.lineTo(e.x - 105, e.y + 340); c.fill();
      }
      c.fillStyle = '#23233a'; c.beginPath(); c.ellipse(e.x, e.y, 18, 8, 0, 0, 6.3); c.fill();
      c.strokeStyle = '#8a8aa8'; c.lineWidth = 2; c.beginPath(); c.moveTo(e.x - 24 + Math.sin(t * 40) * 3, e.y - 8); c.lineTo(e.x + 24 - Math.sin(t * 40) * 3, e.y - 8); c.stroke();
      c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.arc(e.x, e.y + 2, 4, 0, 6.3); c.fill(); c.shadowBlur = 0; break;
    }
    case 'walker': {
      const ped = e.kind === 'ped', hunter = e.kind === 'hunter';
      const body = ped ? ['#6c7fd1', '#c97ad6', '#d19a6c', '#6cd1b0'][Math.abs(Math.floor(e.x / 50)) % 4] : hunter ? '#ff3d6e' : '#2f5fd0';
      const down = e.state === 2;
      c.save(); c.translate(e.x, e.y);
      if (down) { c.globalAlpha = clamp((e.tm ?? 0) / 0.8, 0.2, 1); c.rotate((e.dir ?? 1) * 1.45); c.translate(0, -6); }
      const ph = Math.sin(t * (e.state === 1 ? 16 : 8) + e.x) * 8;
      c.strokeStyle = '#111'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -20); c.lineTo(ph, 0); c.moveTo(0, -20); c.lineTo(-ph, 0); c.stroke();
      c.fillStyle = body; c.fillRect(-8, -42, 16, 24);
      c.fillStyle = '#d9c2a8'; c.beginPath(); c.arc(0, -48, 7, 0, 6.3); c.fill();
      if (!ped) { c.fillStyle = '#111'; c.fillRect(-8, -56, 16, 5); c.fillStyle = Math.sin(t * 14) > 0 ? '#ff2244' : '#3355ff'; c.fillRect(-3, -60, 6, 4); if (e.state === 1) { c.fillStyle = '#fff'; c.fillRect((e.dir ?? 1) * 6 - 1, -34, 2, 12); } }
      c.restore(); c.lineCap = 'butt'; c.globalAlpha = 1; break;
    }
    case 'term': {
      const col = e.used ? '#42ffa8' : (e.lock ?? 0) > 0 ? '#ff5577' : e.kind === 'relay' || e.kind === 'master' ? '#ff5577' : acc;
      c.fillStyle = '#1b1830'; c.fillRect(e.x - 16, e.y - 54, 32, 54); c.fillStyle = '#05050d'; c.fillRect(e.x - 12, e.y - 48, 24, 26);
      c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 14; c.globalAlpha = e.used ? 0.7 : 0.5 + 0.4 * Math.sin(t * 5);
      for (let i = 0; i < 4; i++) c.fillRect(e.x - 9, e.y - 45 + i * 6, 6 + ((i * 7 + Math.floor(t * 3)) % 12), 3);
      c.globalAlpha = 1; c.shadowBlur = 0;
      const lbl: Record<string, string> = { grid: 'GRID', cache: 'CACHE', calm: 'CALM', rep: 'RELAY', relay: 'WARDEN', master: 'MASTER' };
      c.font = '700 10px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillStyle = col; c.fillText(lbl[e.kind || 'grid'] || '', e.x, e.y - 60); break;
    }
    case 'zip': {
      c.strokeStyle = '#ffd23f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x2!, e.y2!); c.stroke();
      c.fillStyle = '#ffd23f'; c.fillRect(e.x - 4, e.y - 6, 8, 12); c.fillRect(e.x2! - 4, e.y2! - 6, 8, 12);
      c.globalAlpha = 0.25; c.lineWidth = 8; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x2!, e.y2!); c.stroke(); c.globalAlpha = 1; break;
    }
    default: break;
  }
}

function drawPack(c: CanvasRenderingContext2D, g: Game) {
  if (!g.pack.active) return;
  const px = g.pack.x;
  if (px < g.cam.x - 700 || px > g.cam.x + g.vw + 100) {
    if (g.boss && g.boss.hp > 0 && px > g.cam.x - 700) { /* fallthrough: draw below */ } else return;
  }
  const gr = g.groundAt(Math.max(px, g.p.x - 400)); const gy = gr ? gr.y : g.p.y + g.p.h;
  const t = g.pack.pulse;
  if (g.boss && g.boss.hp > 0) {
    const b = g.boss, x = px - 60, y = gy;
    c.save(); c.translate(x, y); c.scale(3.2, 3.2);
    const sw = Math.sin(t * 3) * 6;
    c.fillStyle = b.flash > 0 ? '#ffffff' : '#10101c'; c.strokeStyle = '#ff2255'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-40, 0); c.lineTo(-30, -90 + sw * 0.3); c.lineTo(-10, -140); c.lineTo(30, -140); c.lineTo(50, -90); c.lineTo(40, 0); c.closePath(); c.fill(); c.stroke();
    c.fillRect(-30, 0, 18, 6 + Math.max(0, sw)); c.fillRect(16, 0, 18, 6 + Math.max(0, -sw));
    c.fillStyle = '#ff2255'; c.shadowColor = '#ff2255'; c.shadowBlur = 20; c.fillRect(2, -120, 26, 6); c.fillRect(-2, -100, 6, 20); c.shadowBlur = 0;
    c.restore(); return;
  }
  const red = Math.sin(t * 12) > 0;
  for (let i = 0; i < 5; i++) {
    const x = px - i * 38 + Math.sin(t * 9 + i) * 4;
    c.save(); c.translate(x, gy); const ph = Math.sin(t * 18 + i * 1.3) * 9;
    c.strokeStyle = '#05050a'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -22); c.lineTo(ph, 0); c.moveTo(0, -22); c.lineTo(-ph, 0); c.stroke();
    c.fillStyle = '#0b0d20'; c.fillRect(-9, -46, 18, 26); c.beginPath(); c.arc(1, -52, 8, 0, 6.3); c.fill();
    c.fillStyle = (i % 2 === 0) === red ? '#ff2244' : '#3355ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 14; c.fillRect(-4, -64, 8, 5); c.shadowBlur = 0;
    c.restore();
  }
  c.lineCap = 'butt';
  const lg = c.createRadialGradient(px, gy - 30, 10, px, gy - 30, 280); lg.addColorStop(0, red ? 'rgba(255,30,60,0.45)' : 'rgba(50,80,255,0.45)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'lighter'; c.fillStyle = lg; c.fillRect(px - 280, gy - 310, 560, 340); c.globalCompositeOperation = 'source-over';
}

function drawPlayer(c: CanvasRenderingContext2D, g: Game) {
  const p = g.p, pk = PACKAGES[g.pkgKind];
  for (const gh of g.ghosts) { c.globalAlpha = (gh.t / 0.3) * 0.28; c.fillStyle = g.p.dashT > 0 ? '#28e0ff' : '#ff2fd6'; c.fillRect(gh.x, gh.y, 22, gh.h); }
  c.globalAlpha = p.inv > 0 && !g.ended && Math.floor(g.realT * 24) % 2 === 0 ? 0.4 : 1;
  const cx = p.x + 11, y = p.y;
  const jacket = '#ff2fd6', acc = '#28e0ff';
  c.lineCap = 'round'; c.lineJoin = 'round';
  // scarf
  c.strokeStyle = acc; c.lineWidth = 3; c.beginPath();
  const sy = p.sliding ? y + 6 : y + 11;
  c.moveTo(cx - 1, sy);
  for (let i = 1; i <= 6; i++) c.lineTo(cx - 1 - i * (4 + p.vx * 0.012), sy + Math.sin(g.realT * 14 + i * 0.9) * 2.5 * (i / 6) + i * (p.vy > 0 ? -0.5 : 1));
  c.stroke();
  if (p.sliding) {
    c.strokeStyle = '#1b1b30'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 4, y + 16); c.lineTo(cx - 20, y + 20); c.moveTo(cx - 2, y + 17); c.lineTo(cx + 14, y + 20); c.stroke();
    c.fillStyle = jacket; c.fillRect(cx - 10, y + 6, 20, 9);
    c.fillStyle = '#e9c9a8'; c.beginPath(); c.arc(cx + 12, y + 9, 6, 0, 6.3); c.fill();
    c.fillStyle = pk.color; c.fillRect(cx - 16, y + 2, 11, 10);
  } else {
    const lean = clamp(p.vx / 700, 0, 1) * 5;
    const air = !p.ground && p.wr <= 0;
    const ph = p.run, hipx = cx - 1, hipy = y + 30;
    c.strokeStyle = '#1b1b30'; c.lineWidth = 5;
    c.beginPath();
    if (p.wr > 0) { c.moveTo(hipx, hipy); c.lineTo(cx + 12, y + 38 + Math.sin(g.realT * 30) * 3); c.moveTo(hipx, hipy); c.lineTo(cx + 10, y + 26 + Math.sin(g.realT * 30 + 2) * 3); }
    else if (air) { c.moveTo(hipx, hipy); c.lineTo(cx + 9, y + 36); c.lineTo(cx + 7, y + 44); c.moveTo(hipx, hipy); c.lineTo(cx - 8, y + 38); }
    else { c.moveTo(hipx, hipy); c.lineTo(hipx + Math.sin(ph) * 13, y + 44 - Math.max(0, Math.cos(ph)) * 7); c.moveTo(hipx, hipy); c.lineTo(hipx - Math.sin(ph) * 13, y + 44 - Math.max(0, -Math.cos(ph)) * 7); }
    c.stroke();
    c.fillStyle = pk.color; c.shadowColor = pk.color; c.shadowBlur = g.integrity < 35 ? 4 + Math.abs(Math.sin(g.realT * 10)) * 12 : 8;
    c.fillRect(cx - 14 - lean * 0.4, y + 13, 10, 15); c.shadowBlur = 0;
    c.strokeStyle = jacket; c.lineWidth = 9; c.beginPath(); c.moveTo(cx - 1, y + 17); c.lineTo(cx - 1 + lean, y + 29); c.stroke();
    c.strokeStyle = acc; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 5 + lean * 0.7, y + 22); c.lineTo(cx + 3 + lean * 0.7, y + 22); c.stroke();
    c.strokeStyle = '#e9c9a8'; c.lineWidth = 3.5; c.beginPath();
    if (p.wr > 0) { c.moveTo(cx, y + 18); c.lineTo(cx + 12, y + 8); } else if (air) { c.moveTo(cx, y + 18); c.lineTo(cx + 10, y + 14); c.moveTo(cx, y + 18); c.lineTo(cx - 8, y + 22); }
    else { c.moveTo(cx, y + 18); c.lineTo(cx + Math.sin(ph + 3.14) * 10 + 4, y + 26); }
    c.stroke();
    c.fillStyle = '#e9c9a8'; c.beginPath(); c.arc(cx + 2 + lean, y + 8, 7, 0, 6.3); c.fill();
    c.fillStyle = acc; c.shadowColor = acc; c.shadowBlur = 6; c.fillRect(cx + 4 + lean, y + 5, 6, 3); c.shadowBlur = 0;
  }
  c.globalAlpha = 1; c.lineCap = 'butt';
}

function drawHUD(c: CanvasRenderingContext2D, g: Game, W: number, H: number) {
  const u = clamp(Math.min(W / 1100, H / 640), 0.55, 1.8);
  const p = g.p, pk = PACKAGES[g.pkgKind], pal = DISTRICTS[g.cfg.contract.district].pal;
  c.save(); c.textBaseline = 'middle';
  const txt = (s: string, x: number, y: number, size: number, col = '#fff', align: CanvasTextAlign = 'left', font = 'Orbitron') => {
    c.font = `700 ${size * u}px ${font}, sans-serif`; c.textAlign = align; c.fillStyle = col; c.fillText(s, x, y);
  };
  const bar = (x: number, y: number, w: number, h: number, f: number, col: string) => {
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, w, h);
    c.fillStyle = col; c.fillRect(x, y, w * clamp(f, 0, 1), h);
  };
  // top-left
  const lx = 16 * u; let ly = 16 * u;
  txt(`${pk.icon} ${pk.name.toUpperCase()}`, lx, ly + 6 * u, 12, pk.color);
  ly += 20 * u;
  const ig = g.integrity, icol = ig > 60 ? '#42ffa8' : ig > 30 ? '#ffb02e' : Math.sin(g.realT * 10) > 0 ? '#ff3355' : '#aa2244';
  bar(lx, ly, 230 * u, 14 * u, ig / 100, icol);
  txt(`INTEGRITY ${Math.round(ig)}%`, lx + 6 * u, ly + 7.5 * u, 10, '#000');
  ly += 22 * u;
  const mg = c.createLinearGradient(lx, 0, lx + 230 * u, 0); mg.addColorStop(0, '#28e0ff'); mg.addColorStop(1, '#ff2fd6');
  bar(lx, ly, 230 * u, 8 * u, p.mom / 100, mg as unknown as string);
  txt(`MOMENTUM ${Math.round(p.mom)}`, lx, ly + 18 * u, 9, '#9d98d8');
  txt(`${Math.round(p.vx * 0.2)} km/h`, lx + 230 * u, ly + 18 * u, 9, '#fff', 'right');
  ly += 30 * u;
  if (g.pkgKind === 'volatile') { bar(lx, ly, 230 * u, 8 * u, g.core / 100, g.overheated ? '#ff3355' : '#ffb02e'); txt(g.overheated ? 'CORE OVERHEAT!' : 'CORE TEMP', lx, ly + 18 * u, 9, g.overheated ? '#ff3355' : '#ffb02e'); ly += 28 * u; }
  if (g.combo > 1) {
    const m = g.comboMult();
    txt(`FLOW ×${m}`, lx, ly + 6 * u, 16, '#ffe04a');
    bar(lx, ly + 20 * u, 120 * u, 4 * u, g.comboT / 3.2, '#ffe04a'); txt(`${g.combo} chain`, lx + 128 * u, ly + 22 * u, 9, '#bba');
  }
  // top-center progress
  const pw = clamp(W * 0.32, 200 * u, 480 * u), px = (W - pw) / 2, py = 18 * u;
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(px - 2, py - 2, pw + 4, 12 * u); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(px, py, pw, 8 * u);
  c.fillStyle = pal.accent; c.fillRect(px, py, pw * clamp(p.x / g.endX, 0, 1), 8 * u);
  g.segs.forEach((s, i) => { if (i < g.segs.length - 1) { c.fillStyle = '#fff'; c.fillRect(px + pw * (s.x1 / (g.endX + 240)), py - 2 * u, 2, 12 * u); } });
  c.fillStyle = '#42ffa8'; c.fillRect(px + pw - 2, py - 3 * u, 3, 14 * u);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(px + pw * clamp(p.x / g.endX, 0, 1), py + 4 * u, 6 * u, 0, 6.3); c.fill();
  if (g.pack.active) { c.fillStyle = Math.sin(g.pack.pulse * 12) > 0 ? '#ff2244' : '#3355ff'; c.beginPath(); c.arc(px + pw * clamp(g.pack.x / g.endX, 0, 1), py + 4 * u, 5 * u, 0, 6.3); c.fill(); }
  const segName = g.segs[Math.min(g.legIdx, g.segs.length - 1)]?.name || '';
  txt(g.tutorial ? 'TRAINING YARD' : `LEG ${g.legIdx + 1}/${g.cfg.contract.legs} · ${segName}`, W / 2, py + 24 * u, 10, '#c9c4ff', 'center');
  if (g.boss) {
    const by = py + 40 * u; bar(px, by, pw, 10 * u, g.boss.hp / 100, '#ff2255'); txt(`THE WARDEN ${g.boss.hp}%`, W / 2, by + 5.5 * u, 8, '#fff', 'center');
  }
  // top-right
  const rx = W - 70 * u;
  const heat = g.heat;
  for (let i = 0; i < 5; i++) {
    const f = clamp(heat - i, 0, 1), sx = rx - (4 - i) * 24 * u;
    c.font = `${22 * u}px sans-serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillText('★', sx, 24 * u);
    if (f > 0) { c.globalAlpha = f; c.fillStyle = i >= 3 ? '#ff2244' : '#ffb02e'; c.fillText('★', sx, 24 * u); c.globalAlpha = 1; }
  }
  const gap = g.pack.active ? Math.max(0, p.x - g.pack.x) : 9999;
  const gf = g.pack.active ? 1 - clamp(gap / 1100, 0, 1) : 0;
  bar(rx - 120 * u, 44 * u, 120 * u, 7 * u, gf, gf > 0.7 ? '#ff2244' : '#ffb02e');
  txt(g.pack.active ? `PACK ${Math.round(gap / 10)}m` : 'NO PURSUIT', rx, 62 * u, 9, g.pack.active ? (gf > 0.7 ? '#ff5577' : '#ffcf88') : '#42ffa8', 'right');
  txt(`${Math.round(g.score).toLocaleString()}`, rx, 82 * u, 15, '#fff', 'right');
  txt(`¤ ${g.chipCash}  ·  ${g.chips} chips`, rx, 100 * u, 10, '#ffe04a', 'right');
  // bottom-left gadgets
  const gy = H - 66 * u; let gx = 16 * u;
  const slot = (label: string, key: string, n: number | string, frac: number, col: string) => {
    c.fillStyle = 'rgba(8,6,24,0.75)'; c.fillRect(gx, gy, 58 * u, 50 * u);
    c.strokeStyle = col; c.globalAlpha = 0.8; c.lineWidth = 1.5; c.strokeRect(gx, gy, 58 * u, 50 * u); c.globalAlpha = 1;
    if (frac < 1) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(gx, gy, 58 * u, 50 * u * (1 - frac)); }
    c.font = `${20 * u}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(label, gx + 29 * u, gy + 19 * u);
    txt(key, gx + 6 * u, gy + 42 * u, 9, col); txt(String(n), gx + 52 * u, gy + 42 * u, 11, '#fff', 'right');
    gx += 64 * u;
  };
  slot('⚡', 'SHIFT', '', 1 - clamp(p.dashCd / g.st.dashCd, 0, 1), '#28e0ff');
  for (const gd of GADGETS) slot(gd.icon, gd.key, g.gadgets[gd.id] - g.used[gd.id], 1, gd.id === 'emp' ? '#42a5ff' : gd.id === 'smoke' ? '#cfd8ff' : '#ffd23f');
  if (g.st.airHop) { txt(p.airHop > 0 || p.ground ? 'HOP READY' : 'HOP USED', gx + 4 * u, gy + 25 * u, 9, p.airHop > 0 || p.ground ? '#9ad7ff' : '#667'); }
  // toasts
  let ty = H - 120 * u;
  for (const t of g.toasts) { c.globalAlpha = clamp(t.t, 0, 1); txt(t.text, W / 2, ty, 12, t.color, 'center', 'Rajdhani'); ty -= 20 * u; }
  c.globalAlpha = 1;
  // hint
  if (g.hintT > 0 && g.hintText) {
    c.font = `700 ${15 * u}px Rajdhani, sans-serif`;
    const lines = wrap(c, g.hintText, Math.min(W * 0.8, 640 * u)); const lh = 20 * u, bw = Math.min(W * 0.82, 660 * u), bh = lines.length * lh + 18 * u, by2 = H * 0.2;
    c.globalAlpha = clamp(g.hintT, 0, 1) * 0.92; c.fillStyle = 'rgba(8,6,28,0.88)'; c.fillRect(W / 2 - bw / 2, by2, bw, bh);
    c.strokeStyle = pal.accent; c.lineWidth = 1.5; c.strokeRect(W / 2 - bw / 2, by2, bw, bh);
    c.fillStyle = '#fff'; c.textAlign = 'center'; lines.forEach((l, i) => c.fillText(l, W / 2, by2 + 18 * u + i * lh));
    c.globalAlpha = 1;
  }
  // terminal prompt (screen-space helper)
  if (g.nearTerm && !g.hack && !g.ended) txt('PRESS E / TAP HACK TO BREACH', W / 2, H * 0.62, 12, '#42ffa8', 'center');
  // banner
  if (g.bn) {
    const b = g.bn, f = clamp(Math.min(b.t, 2.4 - b.t) * 3, 0, 1), s = 0.9 + 0.1 * f;
    c.globalAlpha = f; c.save(); c.translate(W / 2, H * 0.36); c.scale(s, s);
    c.shadowColor = b.color; c.shadowBlur = 24; txt(b.text, 0, 0, 38, b.color, 'center'); c.shadowBlur = 0;
    if (b.sub) txt(b.sub, 0, 36 * u, 14, '#e9e6ff', 'center', 'Rajdhani');
    c.restore(); c.globalAlpha = 1;
  }
  // wave warning arrow
  if (g.marks.some((m) => m.kind === 'wave' && m.x < g.cam.x)) { c.globalAlpha = 0.5 + 0.5 * Math.sin(g.realT * 20); txt('◀ SHOCKWAVE', 20 * u, H * 0.5, 16, '#ff3355'); c.globalAlpha = 1; }
  c.restore();
}
