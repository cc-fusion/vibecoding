import { COLS, EDGES, FACTIONS, GOODS, LOC, LOCS, NODES, ROWS, STALL_LOCS, W, H, type Loc } from './data';
import type { Game, Npc } from './engine';

export interface View { scale: number; camX: number; camY: number; cw: number; ch: number }

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function seeded(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const LANTERNS: { x: number; y: number; c: string }[] = [];
(() => {
  STALL_LOCS.forEach(l => {
    const r = l.rect; const upper = l.y > r.y + r.h / 2;
    const y = upper ? r.y + r.h + 4 : r.y - 4;
    LANTERNS.push({ x: r.x + 6, y, c: '#ffb050' }, { x: r.x + r.w - 6, y, c: '#ff8f5a' });
  });
  NODES.forEach((n, i) => { if (i !== 12) LANTERNS.push({ x: n.x + 30, y: n.y - 30, c: i % 2 ? '#ffd27a' : '#ff9d6a' }); });
  [[190, 640], [1060, 640], [190, 100], [1060, 100]].forEach(([x, y]) => LANTERNS.push({ x, y, c: '#ffc07a' }));
})();

export class Renderer {
  view: View = { scale: 1, camX: 0, camY: 0, cw: 1, ch: 1 };
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private glows = new Map<string, HTMLCanvasElement>();
  private cam = { x: 0, y: 0, init: false };

  private glow(color: string): HTMLCanvasElement {
    let g = this.glows.get(color);
    if (!g) {
      g = document.createElement('canvas'); g.width = g.height = 96;
      const c = g.getContext('2d')!;
      const gr = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, color); gr.addColorStop(0.25, color + '88'); gr.addColorStop(1, color + '00');
      c.fillStyle = gr; c.fillRect(0, 0, 96, 96);
      this.glows.set(color, g);
    }
    return g;
  }

  private buildBg(rs: number) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * rs); cv.height = Math.ceil(H * rs);
    const c = cv.getContext('2d')!;
    c.scale(rs, rs);
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16132a'); gr.addColorStop(1, '#1e1530');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const rnd = seeded(77);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(255,255,255,${0.015 + rnd() * 0.03})`; c.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 1 + rnd() * 2); }
    // lanes
    c.lineCap = 'round';
    c.strokeStyle = '#26223c'; c.lineWidth = 78;
    EDGES.forEach(([a, b]) => { c.beginPath(); c.moveTo(NODES[a].x, NODES[a].y); c.lineTo(NODES[b].x, NODES[b].y); c.stroke(); });
    c.strokeStyle = '#322e4c'; c.lineWidth = 64;
    EDGES.forEach(([a, b]) => { c.beginPath(); c.moveTo(NODES[a].x, NODES[a].y); c.lineTo(NODES[b].x, NODES[b].y); c.stroke(); });
    for (let i = 0; i < 900; i++) {
      const e = EDGES[Math.floor(rnd() * EDGES.length)]; const t = rnd();
      const x = NODES[e[0]].x + (NODES[e[1]].x - NODES[e[0]].x) * t + (rnd() - 0.5) * 56;
      const y = NODES[e[0]].y + (NODES[e[1]].y - NODES[e[0]].y) * t + (rnd() - 0.5) * 56;
      c.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.05})`; c.beginPath(); c.ellipse(x, y, 3 + rnd() * 3, 2 + rnd() * 2, 0, 0, 7); c.fill();
    }
    // fountain plaza
    c.fillStyle = '#3b3560'; c.beginPath(); c.arc(640, 380, 74, 0, 7); c.fill();
    c.strokeStyle = '#524a82'; c.lineWidth = 3; c.beginPath(); c.arc(640, 380, 74, 0, 7); c.stroke();
    c.fillStyle = '#2b4768'; c.beginPath(); c.arc(640, 380, 34, 0, 7); c.fill();
    c.strokeStyle = '#8fb4d6'; c.lineWidth = 3; c.beginPath(); c.arc(640, 380, 34, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(190,230,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(640, 380, 22, 0, 7); c.stroke(); c.beginPath(); c.arc(640, 380, 12, 0, 7); c.stroke();
    c.fillStyle = '#c8d8e8'; c.beginPath(); c.arc(640, 380, 5, 0, 7); c.fill();
    // harbour water
    const wg = c.createLinearGradient(0, 700, 0, H); wg.addColorStop(0, '#102440'); wg.addColorStop(1, '#0a1428');
    c.fillStyle = wg; c.fillRect(300, 735, W - 300, H - 735);
    c.strokeStyle = 'rgba(120,180,255,.18)'; c.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const x = 330 + rnd() * 930, y = 742 + rnd() * 14; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 4, x + 20, y); c.stroke(); }
    // lantern strings
    c.strokeStyle = 'rgba(255,200,140,.28)'; c.lineWidth = 1.2;
    for (let i = 0; i + 1 < LANTERNS.length; i += 2) {
      const a = LANTERNS[i], b = LANTERNS[i + 1];
      c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + 16, b.x, b.y); c.stroke();
    }
    // buildings
    const building = (l: Loc, color: string, roof: string, icon: string) => {
      const r = l.rect;
      c.fillStyle = 'rgba(0,0,0,.4)'; rrect(c, r.x + 4, r.y + 6, r.w, r.h, 8); c.fill();
      c.fillStyle = color; rrect(c, r.x, r.y, r.w, r.h, 8); c.fill();
      c.fillStyle = roof; rrect(c, r.x - 4, r.y - 4, r.w + 8, 14, 6); c.fill();
      for (let i = 0; i < 5; i++) { c.fillStyle = rnd() < 0.8 ? '#ffd27a' : '#2a2130'; c.fillRect(r.x + 18 + i * (r.w - 50) / 4, r.y + 26, 16, 20); }
      c.font = '26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.fillText(icon, r.x + r.w - 20, r.y + 18);
      c.font = 'bold 12px Georgia, serif'; c.fillStyle = '#f5e6c8'; c.textBaseline = 'alphabetic';
      c.fillText(l.name, r.x + r.w / 2, l.y > 400 ? r.y + r.h - 8 : r.y + r.h - 6);
    };
    building(LOC.tavern, '#3a2431', '#6a3a45', '🍺');
    building(LOC.pavilion, '#2d2745', '#6a4a9a', '🎭');
    building(LOC.wardpost, '#2c2c36', '#7a3a3a', '🛡️');
    building(LOC.docks, '#26303c', '#3a5a6a', '⚓');
    // stalls
    for (const l of STALL_LOCS) {
      const r = l.rect; const g = GOODS[l.good!]; const upper = l.y > r.y + r.h / 2;
      c.fillStyle = 'rgba(0,0,0,.45)'; rrect(c, r.x + 5, r.y + 7, r.w, r.h, 8); c.fill();
      c.fillStyle = '#4a3426'; rrect(c, r.x, r.y, r.w, r.h, 8); c.fill();
      c.fillStyle = '#6b4a33'; c.fillRect(r.x + 8, upper ? r.y + r.h - 34 : r.y + 6, r.w - 16, 28);
      const ay = upper ? r.y + r.h - 40 : r.y + 4;
      const n = 10; const sw = r.w / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i % 2 ? g.color : '#f1e4cc';
        c.beginPath();
        if (upper) { c.rect(r.x + i * sw, ay, sw, 28); c.arc(r.x + i * sw + sw / 2, ay + 28, sw / 2, 0, Math.PI); }
        else { c.rect(r.x + i * sw, ay + 8, sw, 28); c.moveTo(r.x + i * sw, ay + 8); c.arc(r.x + i * sw + sw / 2, ay + 8, sw / 2, Math.PI, 0); }
        c.fill();
      }
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(r.x, upper ? ay : ay + 8, r.w, 5);
      c.font = '34px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.fillText(g.icon, r.x + r.w / 2, upper ? r.y + 22 : r.y + 68);
      c.font = 'bold 11px Georgia, serif'; c.fillStyle = '#f5e6c8'; c.textBaseline = 'alphabetic';
      c.fillText(l.name, r.x + r.w / 2, upper ? r.y + 50 : r.y + 92);
    }
    // lantern bodies
    for (const l of LANTERNS) { c.fillStyle = l.c; c.beginPath(); c.ellipse(l.x, l.y + 4, 4, 6, 0, 0, 7); c.fill(); c.fillStyle = '#3a2a20'; c.fillRect(l.x - 2, l.y - 3, 4, 2); }
    this.bg = cv;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, cw: number, ch: number, dpr: number, time: number) {
    const s0 = Math.min(cw / W, ch / H);
    const scale = Math.max(s0, 0.62);
    const vw = cw / scale, vh = ch / scale;
    const p = g.player;
    let tx = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, p.x - vw / 2));
    let ty = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, p.y - vh / 2));
    if (!this.cam.init) { this.cam = { x: tx, y: ty, init: true }; }
    this.cam.x += (tx - this.cam.x) * 0.15; this.cam.y += (ty - this.cam.y) * 0.15;
    tx = this.cam.x; ty = this.cam.y;
    this.view = { scale, camX: tx, camY: ty, cw, ch };

    const rs = Math.max(0.8, Math.min(2.2, scale * dpr));
    const key = rs.toFixed(2);
    if (!this.bg || this.bgKey !== key) { this.buildBg(rs); this.bgKey = key; }

    const shx = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0, shy = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07091a'; ctx.fillRect(0, 0, cw * dpr, ch * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (-tx * scale + shx) * dpr, (-ty * scale + shy) * dpr);
    ctx.drawImage(this.bg!, 0, 0, W, H);

    // water shimmer
    ctx.globalAlpha = 0.12 + Math.sin(time * 0.002) * 0.05; ctx.fillStyle = '#6aa8ff';
    ctx.fillRect(300, 736 + Math.sin(time * 0.003) * 2, W - 300, 1.5); ctx.globalAlpha = 1;
    // fountain sparkle
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const a = time * 0.002 + i * 1.05; ctx.fillStyle = 'rgba(160,210,255,.5)'; ctx.beginPath(); ctx.arc(640 + Math.cos(a) * 20, 380 + Math.sin(a) * 20, 1.6, 0, 7); ctx.fill(); }

    // lantern glows
    for (let i = 0; i < LANTERNS.length; i++) {
      const l = LANTERNS[i]; const fl = 0.7 + Math.sin(time * 0.004 + i * 1.7) * 0.15 + Math.sin(time * 0.011 + i) * 0.08;
      ctx.globalAlpha = 0.5 * fl; const gl = this.glow(l.c); ctx.drawImage(gl, l.x - 52, l.y - 48, 104, 104);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    this.drawTags(ctx, g);
    if (g.hasPerk('w_tip')) {
      for (const n of g.npcs) if (n.def.role === 'warden' && n.visible) {
        const gr = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, 125); gr.addColorStop(0, 'rgba(255,80,70,.16)'); gr.addColorStop(1, 'rgba(255,80,70,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(n.x, n.y, 125, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,110,100,.4)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y, 125, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // threads
    ctx.globalCompositeOperation = 'lighter';
    for (const t of g.threads) {
      const a = Math.max(0, Math.min(1, t.life / 1.2));
      const mx = (t.a.x + t.b.x) / 2, my = (t.a.y + t.b.y) / 2 - 22;
      ctx.strokeStyle = t.color; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.a.x, t.a.y - 14); ctx.quadraticCurveTo(mx, my - 14, t.b.x, t.b.y - 14); ctx.stroke();
      const u = 1 - a; const px = (1 - u) * (1 - u) * t.a.x + 2 * (1 - u) * u * mx + u * u * t.b.x;
      const py = (1 - u) * (1 - u) * (t.a.y - 14) + 2 * (1 - u) * u * (my - 14) + u * u * (t.b.y - 14);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // click target marker
    if (p.target) {
      const k = (time % 900) / 900; ctx.strokeStyle = `rgba(255,230,160,${1 - k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.target.x, p.target.y + 6, 6 + k * 14, 3 + k * 7, 0, 0, 7); ctx.stroke();
    }

    // entities
    const ents: { y: number; fn: () => void }[] = [];
    for (const n of g.npcs) if (n.visible) ents.push({ y: n.y, fn: () => this.drawNpc(ctx, n, g, time) });
    ents.push({ y: p.y, fn: () => this.drawPlayer(ctx, g, time) });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.fn();

    // particles
    for (const q of g.particles) {
      const a = Math.max(0, q.life / q.max);
      if (q.kind === 'coin') { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.fillRect(q.x - 1, q.y - 2, 1.5, 2); }
      else if (q.kind === 'spark') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a), 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.globalAlpha = a * 0.5; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * 1.4, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    // weather
    if (g.evActive('storm')) {
      ctx.strokeStyle = 'rgba(170,200,255,.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 120; i++) { const x = (i * 97.3 + time * 0.25) % (W + 100) - 50; const y = (i * 61.7 + time * 0.9) % (H + 60) - 30; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); }
      ctx.stroke();
    }
    if (g.evActive('festival')) {
      for (let i = 0; i < 40; i++) { const x = (i * 131.7 + Math.sin(time * 0.001 + i) * 30) % W; const y = (i * 53.1 + time * 0.04) % H; ctx.fillStyle = `hsl(${(i * 47 + time * 0.05) % 360},90%,65%)`; ctx.fillRect(x, y, 3, 3); }
    }

    // floaters
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of g.floaters) {
      const a = Math.min(1, f.life / (f.max * 0.5)); const pop = 1 + Math.max(0, (f.life - f.max + 0.25)) * 2.2;
      ctx.globalAlpha = a; ctx.font = `bold ${f.size * pop}px Georgia, serif`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10,6,24,.9)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // atmosphere (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const f = g.frac;
    const stops: [number, number, number, number, number][] = [[0, 255, 140, 60, 0.1], [0.35, 20, 30, 90, 0.2], [0.7, 10, 10, 60, 0.26], [1, 255, 150, 170, 0.16]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (f >= stops[i][0] && f <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; }
    const u = b[0] === a[0] ? 0 : (f - a[0]) / (b[0] - a[0]);
    const m = (i: number) => a[i] + (b[i] - a[i]) * u;
    ctx.fillStyle = `rgba(${m(1) | 0},${m(2) | 0},${m(3) | 0},${m(4)})`; ctx.fillRect(0, 0, cw, ch);
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(3,2,14,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
    const heat = g.player.heat / 100;
    if (heat > 0.35) { const hv = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.7); hv.addColorStop(0, 'rgba(255,0,0,0)'); hv.addColorStop(1, `rgba(255,30,30,${(heat - 0.35) * 0.45 * (0.7 + Math.sin(time * 0.01) * 0.3)})`); ctx.fillStyle = hv; ctx.fillRect(0, 0, cw, ch); }
    if (g.bossNight && g.grip > 55) { const bv = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.7); bv.addColorStop(0, 'rgba(160,60,255,0)'); bv.addColorStop(1, `rgba(160,60,255,${(g.grip - 55) / 100 * 0.5})`); ctx.fillStyle = bv; ctx.fillRect(0, 0, cw, ch); }
  }

  private drawTags(ctx: CanvasRenderingContext2D, g: Game) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of STALL_LOCS) {
      const v = g.vendors.find(n => n.def.home === l.id); if (!v) continue;
      const good = GOODS[l.good!]; const q = g.quote(v, l.good!);
      const ratio = q.mid / (good.base * 0.87);
      const upper = l.y > l.rect.y + l.rect.h / 2;
      const cx = l.rect.x + l.rect.w / 2, cy = upper ? l.rect.y - 16 : l.rect.y + l.rect.h + 16;
      ctx.fillStyle = 'rgba(12,8,28,.82)'; rrect(ctx, cx - 50, cy - 11, 100, 22, 11); ctx.fill();
      ctx.strokeStyle = v.open ? (ratio > 1.08 ? '#ffb347' : ratio < 0.92 ? '#6ec6ff' : 'rgba(255,255,255,.25)') : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 12px Georgia, serif';
      if (!v.open) { ctx.fillStyle = '#a99fc0'; ctx.fillText('Away... back soon', cx, cy + 1); continue; }
      ctx.fillStyle = '#f5e6c8'; ctx.fillText(`${good.icon} ${q.ask}c`, cx - 8, cy + 1);
      ctx.fillStyle = ratio > 1.08 ? '#ffb347' : ratio < 0.92 ? '#6ec6ff' : '#9a93b5';
      ctx.fillText(ratio > 1.08 ? '▲' : ratio < 0.92 ? '▼' : '•', cx + 36, cy + 1);
    }
  }

  private drawNpc(ctx: CanvasRenderingContext2D, n: Npc, g: Game, time: number) {
    const d = n.def; const x = n.x; const bob = n.moving ? Math.sin(n.walk * 3) * 1.6 : Math.sin(time * 0.003 + n.hash) * 0.4;
    const y = n.y;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + 9, 9, 3.2, 0, 0, 7); ctx.fill();
    if (d.role === 'informant') { ctx.strokeStyle = `rgba(150,235,255,${0.45 + Math.sin(time * 0.005) * 0.2})`; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y + 8, 15, 6, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    if (d.role === 'cutpurse' && (g.kit('wary') > 0 || n.state !== 'idle')) { ctx.strokeStyle = n.state === 'idle' ? 'rgba(255,90,90,.55)' : 'rgba(255,60,60,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 8, 14, 5.5, 0, 0, 7); ctx.stroke(); }
    if (d.role === 'rival') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(this.glow('#b070ff'), x - 30, y - 34, 60, 60); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // body
    ctx.fillStyle = d.role === 'cutpurse' ? '#4b4460' : d.color;
    ctx.beginPath(); ctx.moveTo(x - 7, y + 8 + bob * 0.3); ctx.quadraticCurveTo(x - 9, y - 6 + bob, x, y - 9 + bob); ctx.quadraticCurveTo(x + 9, y - 6 + bob, x + 7, y + 8 + bob * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = FACTIONS[d.faction].color; ctx.fillRect(x - 7, y - 1 + bob, 14, 2.4);
    if (d.role === 'vendor') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x - 4, y - 1 + bob, 8, 9); }
    // head
    const hy = y - 14 + bob;
    ctx.fillStyle = d.role === 'noble' || d.role === 'rival' ? '#f4f0ee' : '#e8cfa8'; ctx.beginPath(); ctx.arc(x, hy, 5.2, 0, 7); ctx.fill();
    if (d.role === 'warden') { ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(x, hy - 1, 5.6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#d9473f'; ctx.fillRect(x - 1, hy - 9, 2, 5); }
    else if (d.role === 'noble') { ctx.fillStyle = '#e9c24a'; ctx.beginPath(); ctx.moveTo(x - 5, hy - 4); ctx.lineTo(x - 3, hy - 10); ctx.lineTo(x, hy - 6); ctx.lineTo(x + 3, hy - 10); ctx.lineTo(x + 5, hy - 4); ctx.closePath(); ctx.fill(); }
    else if (d.role === 'informant' || d.role === 'cutpurse') { ctx.fillStyle = d.role === 'cutpurse' ? '#2d2840' : d.color; ctx.beginPath(); ctx.arc(x, hy - 0.5, 6, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); }
    else if (d.role === 'rival') { ctx.fillStyle = '#18141f'; ctx.beginPath(); ctx.arc(x, hy, 5.4, 0, Math.PI); ctx.fill(); ctx.strokeStyle = '#b070ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 4, hy - 4); ctx.quadraticCurveTo(x + 12, hy - 14, x + 8, hy - 18); ctx.stroke(); }
    ctx.fillStyle = n.state === 'stalk' ? '#ff3b3b' : '#2a2030';
    ctx.fillRect(x - 2.6 + n.face * 0.8, hy - 1, 1.4, 1.6); ctx.fillRect(x + 1.2 + n.face * 0.8, hy - 1, 1.4, 1.6);
    // belief orbs
    let k = 0;
    for (const key of Object.keys(n.beliefs)) {
      if (k >= 3) break;
      const r = g.rumors.get(+key); const b = n.beliefs[+key];
      if (!r || r.state !== 'pending' || b < 0.3) continue;
      const col = r.kind === 'scandal' ? '#e56ad8' : r.dir > 0 ? '#ffb347' : '#6ec6ff';
      const ang = time * 0.0022 + k * 2.1 + n.hash;
      const ox = Math.cos(ang) * 14, oy = Math.sin(ang) * 5 - 20 + bob;
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col; ctx.globalAlpha = 0.5 + b * 0.5;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, 2 + b * 2.2, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x + ox, y + oy, 5 + b * 3, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; k++;
    }
    // near ring
    if (g.near === n || g.talk === n) {
      ctx.strokeStyle = g.talk === n ? '#ffe9a8' : 'rgba(255,240,200,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 8, 17 + Math.sin(time * 0.008) * 1.5, 7, 0, 0, 7); ctx.stroke();
      if (g.near === n && !g.talk) {
        ctx.fillStyle = 'rgba(15,10,30,.9)'; rrect(ctx, x - 9, y - 46, 18, 18, 5); ctx.fill();
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.def.role === 'cutpurse' ? '!' : 'E', x, y - 36);
      }
    }
    if (n.bubble) {
      ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15,10,30,.85)'; ctx.beginPath(); ctx.arc(x, y - 34, 9, 0, 7); ctx.fill();
      ctx.fillStyle = n.bubble === '!' ? '#ff7a7a' : '#ffe9a8'; ctx.fillText(n.bubble, x, y - 34);
    }
    const hov = g.hover && Math.hypot(g.hover.x - x, g.hover.y - y) < 24;
    const dp = Math.hypot(x - g.player.x, y - g.player.y);
    if (hov || (g.meta.opts.names && dp < 120 && g.near !== n) || g.near === n) {
      ctx.font = 'bold 10.5px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const label = d.role === 'cutpurse' && n.state === 'idle' && !hov ? '' : d.name;
      if (label) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,5,20,.9)'; ctx.strokeText(label, x, y + 24); ctx.fillStyle = FACTIONS[d.faction].color; ctx.fillText(label, x, y + 24); }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, g: Game, time: number) {
    const p = g.player; const moving = g.keys.up || g.keys.down || g.keys.left || g.keys.right || !!p.target;
    const bob = moving ? Math.sin(time * 0.02) * 1.6 : Math.sin(time * 0.003) * 0.5;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(this.glow('#ffd27a'), p.x - 34, p.y - 40, 68, 68);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, 10, 3.5, 0, 0, 7); ctx.fill();
    if (p.dashT > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#9d8cff'; ctx.beginPath(); ctx.ellipse(p.x - p.dx * 14, p.y - p.dy * 14, 8, 11, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const flick = p.stun > 0 ? (Math.floor(time / 80) % 2 ? 0.4 : 1) : 1; ctx.globalAlpha = flick;
    ctx.fillStyle = '#2b1f55';
    ctx.beginPath(); ctx.moveTo(p.x - 9, p.y + 9); ctx.quadraticCurveTo(p.x - 11, p.y - 8 + bob, p.x, p.y - 11 + bob); ctx.quadraticCurveTo(p.x + 11, p.y - 8 + bob, p.x + 9, p.y + 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(p.x - 1, p.y - 8 + bob, 2, 15);
    ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(p.x, p.y - 16 + bob, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.arc(p.x, p.y - 16 + bob, 6, p.face > 0 ? -Math.PI / 2 : Math.PI / 2, p.face > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.fill();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y - 16 + bob, 6, 0, 7); ctx.stroke();
    ctx.fillStyle = '#2a2030'; ctx.fillRect(p.x + p.face * 2.2 - 0.8, p.y - 17.5 + bob, 1.6, 1.8);
    ctx.fillStyle = '#2b1f55'; ctx.beginPath(); ctx.arc(p.x, p.y - 18 + bob, 6.4, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.globalAlpha = 1;
    if (g.listen) {
      const u = g.listen.p / g.listen.dur;
      ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 4, 24, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(g.listen.npc.x, g.listen.npc.y - 6); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👂', p.x, p.y - 40);
    }
  }
}

export { LOCS, COLS, ROWS };
