import { W, H, N } from './data';
import { isWaterKind } from './engine';
import type { Game } from './engine';
import type { Kind } from './data';

export interface Layout { ts: number; ox: number; oy: number; cw: number; ch: number }

export function computeLayout(cw: number, ch: number): Layout {
  const ts = Math.max(8, Math.floor(Math.min(cw / W, ch / H)));
  return { ts, ox: Math.floor((cw - ts * W) / 2), oy: Math.floor((ch - ts * H) / 2), cw, ch };
}

export function tileAt(lay: Layout, px: number, py: number): number {
  const x = Math.floor((px - lay.ox) / lay.ts), y = Math.floor((py - lay.oy) / lay.ts);
  if (x < 0 || y < 0 || x >= W || y >= H) return -1;
  return y * W + x;
}

const PAL = ['#2f7fa3', '#e0cf98', '#a6c26e', '#8db35f', '#b3b563', '#c4a762', '#b08a5a', '#9a7b5b', '#8d8478', '#cfcac0'];
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

function hexToRgb(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixc(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

export class Renderer {
  private terrain: HTMLCanvasElement | null = null;
  private key = '';
  private seaIdx: number[] = [];

  private buildTerrain(g: Game, ts: number, dpr: number) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(ts * W * dpr); c.height = Math.ceil(ts * H * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    this.seaIdx = [];
    const hAt = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? g.h[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] : g.h[y * W + x]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = g.h[i];
      ctx.fillStyle = PAL[h];
      ctx.fillRect(x * ts, y * ts, ts + 0.5, ts + 0.5);
      if (h === 0) { this.seaIdx.push(i); continue; }
      const s = (hAt(x - 1, y) - hAt(x + 1, y) + hAt(x, y - 1) - hAt(x, y + 1)) * 0.5;
      if (s > 0) ctx.fillStyle = `rgba(255,250,220,${Math.min(0.3, s * 0.1)})`; else ctx.fillStyle = `rgba(30,20,10,${Math.min(0.32, -s * 0.1)})`;
      ctx.fillRect(x * ts, y * ts, ts + 0.5, ts + 0.5);
      // contour edges
      const hr = hAt(x + 1, y), hb = hAt(x, y + 1);
      if (x < W - 1 && hr !== h && hr > 0) { ctx.fillStyle = `rgba(40,25,10,${0.12 + Math.min(3, Math.abs(hr - h)) * 0.06})`; ctx.fillRect((x + 1) * ts - 1, y * ts, 1.5, ts); }
      if (y < H - 1 && hb !== h && hb > 0) { ctx.fillStyle = `rgba(40,25,10,${0.12 + Math.min(3, Math.abs(hb - h)) * 0.06})`; ctx.fillRect(x * ts, (y + 1) * ts - 1, ts, 1.5); }
      if (hr === 0 || hb === 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; if (hr === 0) ctx.fillRect((x + 1) * ts - 2, y * ts, 2, ts); if (hb === 0) ctx.fillRect(x * ts, (y + 1) * ts - 2, ts, 2); }
      // grain
      const hsh = (i * 2654435761) >>> 0;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(x * ts + (hsh % 7) * ts / 8, y * ts + ((hsh >> 4) % 7) * ts / 8, ts / 10, ts / 10);
    }
    this.terrain = c;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, lay: Layout, dpr: number) {
    const { ts, ox, oy, cw, ch } = lay;
    const key = `${ts}|${g.cfg.scenario}|${g.cfg.seed ?? ''}|${dpr}|${g.sc.id}`;
    if (key !== this.key || !this.terrain) { this.key = key; this.buildTerrain(g, ts, dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1b21';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * 7, (Math.random() - 0.5) * g.shake * 7);
    ctx.translate(ox, oy);
    if (this.terrain) ctx.drawImage(this.terrain, 0, 0, ts * W, ts * H);
    const t = g.anim;
    // sea shimmer
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (const i of this.seaIdx) {
      const x = i % W, y = (i / W) | 0;
      const o = Math.sin(t * 1.3 + x * 0.8 + y * 0.5);
      ctx.fillRect(x * ts + ts * (0.2 + 0.2 * o), y * ts + ts * 0.35, ts * 0.4, 1.5);
      ctx.fillRect(x * ts + ts * (0.4 - 0.2 * o), y * ts + ts * 0.7, ts * 0.35, 1.5);
    }
    // floods
    for (let i = 0; i < N; i++) {
      const f = g.flood[i];
      if (f <= 0.03) continue;
      const x = i % W, y = (i / W) | 0;
      ctx.fillStyle = g.dirty[i] ? `rgba(120,105,35,${Math.min(0.75, 0.2 + f * 0.35)})` : `rgba(70,165,230,${Math.min(0.7, 0.2 + f * 0.35)})`;
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x * ts + ts * (0.15 + 0.2 * Math.sin(t * 3 + i)), y * ts + ts * 0.5, ts * 0.4, 1.5);
    }
    // pass A: conduits
    for (let i = 0; i < N; i++) {
      const k = g.kind[i];
      if (isWaterKind(k) || k === 'drain' || k === 'pump') this.drawConduit(ctx, g, i, ts, t);
    }
    // pass B: buildings
    for (let i = 0; i < N; i++) {
      const k = g.kind[i];
      const si = g.springAt[i];
      if (si >= 0) this.drawSpring(ctx, g, i, ts, t);
      else if (k === 'house') this.drawHouse(ctx, g, i, ts, t);
      else if (k === 'farm') this.drawFarm(ctx, g, i, ts);
      else if (k === 'fountain' || k === 'grand') this.drawFountain(ctx, g, i, ts, t, k === 'grand');
      else if (k === 'bath') this.drawBath(ctx, g, i, ts);
      else if (k === 'mill') this.drawMill(ctx, g, i, ts, t);
      else if (k === 'treatment') this.drawTreatment(ctx, g, i, ts);
      else if (k === 'well') this.drawWell(ctx, g, i, ts);
      else if (k === 'rubble') this.drawRubble(ctx, i, ts);
    }
    // overlays
    if (g.overlay === 'height') this.drawHeights(ctx, g, ts);
    if (g.overlay === 'health') this.drawHealth(ctx, g, ts, t);
    if (g.overlay === 'happy') this.drawHappy(ctx, g, ts);
    this.drawHover(ctx, g, ts);
    // particles
    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x * ts, p.y * ts, Math.max(1, p.s * ts), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // floaters
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.max(11, ts * 0.5)}px Nunito, system-ui, sans-serif`;
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,0,0.85)';
      ctx.strokeText(f.text, f.x * ts, f.y * ts);
      ctx.fillStyle = f.c; ctx.fillText(f.text, f.x * ts, f.y * ts);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // atmosphere (screen space)
    const season = g.season;
    const tints = ['', 'rgba(255,200,80,0.05)', 'rgba(210,110,40,0.08)', 'rgba(170,205,255,0.10)'];
    if (tints[season]) { ctx.fillStyle = tints[season]; ctx.fillRect(0, 0, cw, ch); }
    if (g.droughtI > 0.02) { ctx.fillStyle = `rgba(255,150,40,${0.16 * g.droughtI})`; ctx.fillRect(0, 0, cw, ch); }
    if (g.rainI > 0.02) {
      ctx.fillStyle = `rgba(10,20,55,${0.32 * g.rainI})`; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = `rgba(200,222,255,${0.5 * g.rainI})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      const rd = g.rainDrops;
      for (let i = 0; i < rd.length; i += 3) {
        const x = rd[i] * cw, y = rd[i + 1] * ch;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13 * rd[i + 2]);
      }
      ctx.stroke();
    }
    if (g.surgeI > 0.05) {
      const grd = ctx.createLinearGradient(0, ch, 0, ch * 0.6);
      grd.addColorStop(0, `rgba(60,150,220,${0.35 * g.surgeI})`); grd.addColorStop(1, 'rgba(60,150,220,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, ch * 0.6, cw, ch * 0.4);
    }
    if (g.flash > 0) { ctx.globalAlpha = Math.min(0.8, g.flash * 0.6); ctx.fillStyle = g.flashColor; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
    // vignette
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
  }

  private conns(g: Game, i: number): boolean[] {
    const k = g.kind[i];
    const out = [false, false, false, false];
    for (let d = 0; d < 4; d++) {
      const n = g.nb(i, d);
      if (n < 0) continue;
      const kn = g.kind[n];
      if (k === 'drain') out[d] = kn === 'drain' || kn === 'treatment' || g.h[n] === 0;
      else if (k === 'pump') out[d] = (isWaterKind(kn)) && (d % 2 === (g.aux[i] | 0) % 2);
      else out[d] = isWaterKind(kn) || g.springAt[n] >= 0 || kn === 'well' || (kn === 'pump' && d % 2 === (g.aux[n] | 0) % 2);
    }
    return out;
  }

  private arms(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number, c: boolean[], wd: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - wd / 2, cy - wd / 2, wd, wd);
    if (c[0]) ctx.fillRect(cx, cy - wd / 2, ts / 2 + 0.5, wd);
    if (c[1]) ctx.fillRect(cx - wd / 2, cy, wd, ts / 2 + 0.5);
    if (c[2]) ctx.fillRect(cx - ts / 2 - 0.5, cy - wd / 2, ts / 2 + 0.5, wd);
    if (c[3]) ctx.fillRect(cx - wd / 2, cy - ts / 2 - 0.5, wd, ts / 2 + 0.5);
  }

  private drawConduit(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number, t: number) {
    const k = g.kind[i];
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    const c = this.conns(g, i);
    const isDrain = k === 'drain';
    const cap = isDrain ? 6 : g.cap(i);
    const fill = Math.max(0, Math.min(1, g.w[i] / cap));
    const lift = k === 'bridge' ? g.bed[i] - g.h[i] : 0;
    if (k === 'pump') {
      this.arms(ctx, cx, cy, ts, c, ts * 0.34, '#6e5c40');
      this.arms(ctx, cx, cy, ts, c, ts * 0.2, '#4fb6e6');
      const run = g.coins > 0;
      ctx.fillStyle = '#8d7a5a'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.38, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3e3220'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(run ? t * 3 : 0);
      ctx.fillStyle = '#e9d9a8';
      for (let s = 0; s < 6; s++) { ctx.rotate(Math.PI / 3); ctx.fillRect(ts * 0.18, -ts * 0.04, ts * 0.14, ts * 0.08); }
      ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(((g.aux[i] | 0) * Math.PI) / 2);
      ctx.fillStyle = run ? '#fff3c0' : '#9a8a70';
      ctx.beginPath(); ctx.moveTo(ts * 0.3, 0); ctx.lineTo(ts * 0.08, -ts * 0.14); ctx.lineTo(ts * 0.08, ts * 0.14); ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    if (k === 'reservoir') {
      this.arms(ctx, cx, cy, ts, c, ts * 0.3, '#6e5c40');
      const s = ts * 0.92;
      ctx.fillStyle = '#9a8a70'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.fillStyle = '#2f3d42'; ctx.fillRect(cx - s / 2 + 3, cy - s / 2 + 3, s - 6, s - 6);
      const hh = (s - 6) * fill;
      ctx.fillStyle = '#4fb6e6'; ctx.fillRect(cx - s / 2 + 3, cy + s / 2 - 3 - hh, s - 6, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - s / 2 + 3, cy + s / 2 - 3 - hh, s - 6, 2);
      return;
    }
    if (k === 'bridge') {
      const off = Math.min(6, lift * 1.6);
      ctx.globalAlpha = 0.28; this.arms(ctx, cx + off, cy + off * 1.4, ts, c, ts * 0.62, '#000'); ctx.globalAlpha = 1;
      this.arms(ctx, cx, cy, ts, c, ts * 0.7, '#a8946a');
      this.arms(ctx, cx, cy, ts, c, ts * 0.58, '#e1d3ae');
      this.arms(ctx, cx, cy, ts, c, ts * 0.34, '#3f4b4f');
      ctx.globalAlpha = 0.25 + 0.75 * fill; this.arms(ctx, cx, cy, ts, c, ts * 0.3, '#4fb6e6'); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(50,35,20,0.5)';
      const horiz = c[0] || c[2];
      for (let a = 0; a < 3; a++) {
        const o = (a - 1) * ts * 0.3;
        ctx.beginPath();
        if (horiz) ctx.arc(cx + o, cy + ts * 0.46, ts * 0.1, Math.PI, 0); else ctx.arc(cx + ts * 0.44, cy + o, ts * 0.1, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fill();
      }
      if (g.cracked[i]) {
        ctx.strokeStyle = '#e5604d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - ts * 0.25, cy - ts * 0.2); ctx.lineTo(cx, cy + ts * 0.02); ctx.lineTo(cx - ts * 0.05, cy + ts * 0.1); ctx.lineTo(cx + ts * 0.25, cy + ts * 0.3); ctx.stroke();
      }
    } else if (k === 'tunnel') {
      this.arms(ctx, cx, cy, ts, c, ts * 0.3, 'rgba(25,18,10,0.5)');
      ctx.globalAlpha = 0.15 + 0.45 * fill; this.arms(ctx, cx, cy, ts, c, ts * 0.14, '#4fb6e6'); ctx.globalAlpha = 1;
      for (let d = 0; d < 4; d++) {
        const n = g.nb(i, d);
        if (n >= 0 && g.kind[n] !== 'tunnel' && isWaterKind(g.kind[n])) {
          ctx.fillStyle = '#2b2118';
          ctx.beginPath(); ctx.arc(cx + DX[d] * ts * 0.4, cy + DY[d] * ts * 0.4, ts * 0.17, 0, 6.283); ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - ts * 0.08, cy - ts * 0.08, ts * 0.16, ts * 0.16);
    } else {
      const border = isDrain ? '#5a4a2c' : '#7a6a52';
      const bed = isDrain ? '#2e281a' : '#34464c';
      const wcol = isDrain ? '#a39432' : '#4fb6e6';
      this.arms(ctx, cx, cy, ts, c, ts * 0.5, border);
      this.arms(ctx, cx, cy, ts, c, ts * 0.34, bed);
      ctx.globalAlpha = 0.22 + 0.78 * fill; this.arms(ctx, cx, cy, ts, c, ts * 0.3, wcol); ctx.globalAlpha = 1;
    }
    if (k === 'sluice') {
      const horiz = c[0] || c[2];
      const open = g.aux[i] > 0;
      ctx.fillStyle = open ? '#6fcf7a' : '#e5604d';
      if (open) {
        if (horiz) { ctx.fillRect(cx - ts * 0.05, cy - ts * 0.44, ts * 0.1, ts * 0.16); ctx.fillRect(cx - ts * 0.05, cy + ts * 0.28, ts * 0.1, ts * 0.16); }
        else { ctx.fillRect(cx - ts * 0.44, cy - ts * 0.05, ts * 0.16, ts * 0.1); ctx.fillRect(cx + ts * 0.28, cy - ts * 0.05, ts * 0.16, ts * 0.1); }
      } else if (horiz) ctx.fillRect(cx - ts * 0.06, cy - ts * 0.4, ts * 0.12, ts * 0.8); else ctx.fillRect(cx - ts * 0.4, cy - ts * 0.06, ts * 0.8, ts * 0.12);
      ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - ts * 0.17, cy - ts * 0.17, ts * 0.34, ts * 0.34);
    }
    if (k === 'spillway') {
      ctx.fillStyle = 'rgba(230,248,255,0.9)';
      for (let a = 0; a < 3; a++) {
        const p = (t * 1.6 + a / 3) % 1;
        ctx.fillRect(cx - ts * 0.3 + a * ts * 0.25, cy - ts * 0.4 + p * ts * 0.8, ts * 0.08, ts * 0.2);
      }
      ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2; ctx.strokeRect(cx - ts * 0.36, cy - ts * 0.36, ts * 0.72, ts * 0.72);
    }
    // flow animation
    const wc = isDrain ? 'rgba(220,205,110,0.85)' : 'rgba(235,250,255,0.9)';
    for (let d = 0; d < 4; d++) {
      const amt = g.flowE[i * 4 + d];
      if (amt < 0.1) continue;
      ctx.fillStyle = wc;
      const p = (t * 1.4 + (i % 5) * 0.2) % 1;
      const len = ts / 2;
      ctx.fillRect(cx + DX[d] * len * p - ts * 0.04, cy + DY[d] * len * p - ts * 0.04, ts * 0.08, ts * 0.08);
      const p2 = (p + 0.5) % 1;
      ctx.fillRect(cx + DX[d] * len * p2 - ts * 0.04, cy + DY[d] * len * p2 - ts * 0.04, ts * 0.08, ts * 0.08);
    }
  }

  private drawSpring(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number, t: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    const sp = g.springs[g.springAt[i]];
    const fail = sp && sp.mult < 1;
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, ts * 0.95);
    grd.addColorStop(0, fail ? 'rgba(160,160,150,0.9)' : 'rgba(140,225,255,0.95)'); grd.addColorStop(1, 'rgba(80,190,240,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.95, 0, 6.283); ctx.fill();
    ctx.fillStyle = fail ? '#9a9a90' : '#5cc3e8'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.3, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2; ctx.stroke();
    for (let r = 0; r < 2; r++) {
      const p = (t * 0.6 + r * 0.5) % 1;
      ctx.strokeStyle = `rgba(230,250,255,${0.7 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(cx, cy, ts * (0.3 + p * 0.6), 0, 6.283); ctx.stroke();
    }
  }

  private drawHouse(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number, t: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    const lvl = g.lvl[i] || 1;
    const s = ts * (0.7 + lvl * 0.08);
    const vacant = g.pop[i] < 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - s / 2 + 2, cy - s / 2 + 3, s, s);
    ctx.fillStyle = vacant ? '#c9c0a8' : '#efe0bc'; ctx.fillRect(cx - s / 2, cy - s / 2 + s * 0.3, s, s * 0.7);
    ctx.fillStyle = vacant ? '#8a7f70' : lvl === 1 ? '#c4553a' : lvl === 2 ? '#b0432b' : '#8e3a8a';
    ctx.beginPath(); ctx.moveTo(cx - s / 2 - 2, cy - s / 2 + s * 0.34); ctx.lineTo(cx, cy - s / 2 - 1); ctx.lineTo(cx + s / 2 + 2, cy - s / 2 + s * 0.34); ctx.closePath(); ctx.fill();
    if (lvl >= 2) { ctx.fillStyle = '#f2d98a'; ctx.fillRect(cx - s / 2, cy - s / 2 + s * 0.32, s, 2); }
    if (lvl >= 3) { ctx.fillStyle = '#6fae5a'; ctx.fillRect(cx - s * 0.2, cy + s * 0.12, s * 0.4, s * 0.2); }
    ctx.fillStyle = '#5a4025'; ctx.fillRect(cx - s * 0.08, cy + s * 0.12, s * 0.16, s * 0.28);
    const hp = g.happy[i];
    ctx.fillStyle = hp > 66 ? '#6fe07a' : hp > 40 ? '#f2d24a' : '#ef5a48';
    ctx.beginPath(); ctx.arc(cx + s / 2 - 1, cy - s / 2 + 3, ts * 0.1, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    if (g.sat[i] < 0.3 && !vacant) { ctx.font = `${ts * 0.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💧', cx - s / 2 + 2, cy - s / 2 + 4); ctx.strokeStyle = '#ff5040'; ctx.strokeRect(cx - s / 2 - 1, cy - s / 2 - 1, s + 2, s + 2); }
    if (g.sick[i] > 0.25) {
      ctx.strokeStyle = `rgba(140,230,90,${0.5 + 0.5 * Math.sin(t * 6)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.7, 0, 6.283); ctx.stroke();
    }
    if (g.dmg[i] > 0.1) { ctx.fillStyle = `rgba(40,100,160,${Math.min(0.6, g.dmg[i])})`; ctx.fillRect(cx - s / 2, cy - s / 2, s, s); }
  }

  private drawFarm(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number) {
    const x = i % W, y = (i / W) | 0;
    const px = x * ts + ts * 0.05, py = y * ts + ts * 0.05, s = ts * 0.9;
    ctx.fillStyle = '#7d5a32'; ctx.fillRect(px, py, s, s);
    const cr = Math.min(1, g.crop[i]);
    const col = g.sat[i] < 0.3 ? '#b9a050' : mixc('#6fae3a', '#e8c040', cr);
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = '#5c4224'; ctx.fillRect(px + 2, py + 3 + r * (s / 4), s - 4, 2);
      ctx.fillStyle = col; ctx.fillRect(px + 3, py + 5 + r * (s / 4), (s - 6) * (0.25 + 0.75 * cr), s / 4 - 5);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, s, s);
    if (g.sat[i] < 0.3) { ctx.font = `${ts * 0.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💧', px + s / 2, py + s / 2); }
  }

  private drawFountain(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number, t: number, grand: boolean) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    const r = ts * (grand ? 0.62 : 0.4);
    const on = g.sat[i] > 0.4;
    ctx.fillStyle = grand ? '#e8c46a' : '#c9c1ad'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = grand ? '#8a6a1c' : '#7d7562'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = on ? '#6dc7ee' : '#8a8570'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, 6.283); ctx.fill();
    ctx.fillStyle = grand ? '#fff1b8' : '#e8e2d0'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, 6.283); ctx.fill();
    if (on) {
      ctx.strokeStyle = 'rgba(240,252,255,0.8)'; ctx.lineWidth = 1.5;
      for (let a = 0; a < (grand ? 8 : 5); a++) {
        const ang = t * 1.5 + (a * 6.283) / (grand ? 8 : 5);
        ctx.beginPath(); ctx.arc(cx, cy, r * (0.35 + 0.3 * ((t * 0.8 + a * 0.2) % 1)), ang, ang + 0.7); ctx.stroke();
      }
    }
  }

  private drawBath(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2, s = ts * 0.84;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(cx - s / 2 + 2, cy - s / 2 + 3, s, s);
    ctx.fillStyle = '#ebe5d2'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.fillStyle = g.sat[i] > 0.4 ? '#5cc3e8' : '#8a8570'; ctx.fillRect(cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.4);
    ctx.fillStyle = '#b8ad92';
    for (let a = 0; a < 4; a++) ctx.fillRect(cx - s / 2 + a * (s - s * 0.14) / 3, cy - s / 2, s * 0.14, s * 0.2);
    ctx.fillStyle = '#d4a84f'; ctx.fillRect(cx - s / 2, cy - s / 2, s, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  }

  private drawMill(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number, t: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2, s = ts * 0.78;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(cx - s / 2 + 2, cy - s / 2 + 3, s, s);
    ctx.fillStyle = '#a07a52'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s * 0.22);
    ctx.save(); ctx.translate(cx - s * 0.1, cy + s * 0.1); ctx.rotate(g.sat[i] > 0.4 ? t * 2.2 : 0);
    ctx.strokeStyle = '#3e2a14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, 6.283); ctx.stroke();
    for (let a = 0; a < 4; a++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-s * 0.32, 0); ctx.lineTo(s * 0.32, 0); ctx.stroke(); }
    ctx.restore();
  }

  private drawTreatment(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    ctx.fillStyle = '#3d4a40'; ctx.fillRect(cx - ts * 0.45, cy - ts * 0.45, ts * 0.9, ts * 0.9);
    const busy = g.plantLeft[i] < 3;
    for (let a = 0; a < 2; a++) {
      ctx.fillStyle = busy ? '#6fcf8a' : '#5aa06a';
      ctx.beginPath(); ctx.arc(cx + (a ? 1 : -1) * ts * 0.2, cy + (a ? 1 : -1) * ts * 0.12, ts * 0.2, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#2c5a3c'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#c9f0cf'; ctx.font = `800 ${ts * 0.35}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♻', cx, cy + ts * 0.02);
  }

  private drawWell(ctx: CanvasRenderingContext2D, g: Game, i: number, ts: number) {
    const x = i % W, y = (i / W) | 0;
    const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
    ctx.fillStyle = '#9c917a'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.34, 0, 6.283); ctx.fill();
    ctx.fillStyle = g.pollution > 0.6 ? '#6a6a3a' : '#2f6f8f'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.22, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#4a4232'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.34, 0, 6.283); ctx.stroke();
  }

  private drawRubble(ctx: CanvasRenderingContext2D, i: number, ts: number) {
    const x = i % W, y = (i / W) | 0;
    for (let a = 0; a < 6; a++) {
      const hs = ((i * 31 + a * 17) * 2654435761) >>> 0;
      ctx.fillStyle = a % 2 ? '#7d7466' : '#a39683';
      ctx.fillRect(x * ts + ((hs % 70) / 100) * ts + ts * 0.05, y * ts + (((hs >> 5) % 70) / 100) * ts + ts * 0.05, ts * 0.22, ts * 0.18);
    }
  }

  private drawHeights(ctx: CanvasRenderingContext2D, g: Game, ts: number) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(8, ts * 0.36)}px Nunito, sans-serif`;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0, h = g.h[i];
      if (h === 0) continue;
      const k = g.kind[i];
      const cx = x * ts + ts / 2, cy = y * ts + ts / 2;
      if (isWaterKind(k) || k === 'drain') {
        const b = g.bed[i];
        ctx.fillStyle = 'rgba(20,16,10,0.75)'; ctx.fillRect(cx - ts * 0.22, cy - ts * 0.2, ts * 0.44, ts * 0.4);
        ctx.fillStyle = b > h ? '#ffe08a' : b < h ? '#a8e0ff' : '#ffffff';
        ctx.fillText(String(b), cx, cy + 1);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(String(h), cx, cy + 1);
      }
    }
  }

  private drawHealth(ctx: CanvasRenderingContext2D, g: Game, ts: number, t: number) {
    ctx.fillStyle = 'rgba(8,16,20,0.45)'; ctx.fillRect(0, 0, W * ts, H * ts);
    const hs: number[] = [];
    for (let i = 0; i < N; i++) if (g.kind[i] === 'house') hs.push(i);
    for (const i of hs) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dy < 0 || (dy === 0 && dx <= 0)) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (g.kind[j] !== 'house') continue;
        const m = Math.max(g.sick[i], g.sick[j]);
        ctx.strokeStyle = m > 0.05 ? `rgba(255,${Math.round(150 - m * 110)},80,${0.35 + m * 0.6})` : 'rgba(150,220,180,0.25)';
        ctx.lineWidth = 1 + m * 3;
        ctx.beginPath(); ctx.moveTo(x * ts + ts / 2, y * ts + ts / 2); ctx.lineTo(nx * ts + ts / 2, ny * ts + ts / 2); ctx.stroke();
      }
    }
    for (const i of hs) {
      const x = i % W, y = (i / W) | 0, s = g.sick[i];
      ctx.fillStyle = mixc('#6fe07a', '#ff3a2a', Math.min(1, s * 1.4));
      ctx.beginPath(); ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * (0.22 + 0.1 * s * (1 + Math.sin(t * 6) * 0.3)), 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (g.waste[i] > 3.5) { ctx.strokeStyle = '#d6c040'; ctx.beginPath(); ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 0.38, 0, 6.283); ctx.stroke(); }
    }
  }

  private drawHappy(ctx: CanvasRenderingContext2D, g: Game, ts: number) {
    ctx.fillStyle = 'rgba(8,16,20,0.4)'; ctx.fillRect(0, 0, W * ts, H * ts);
    for (let i = 0; i < N; i++) {
      if (g.kind[i] !== 'house') continue;
      const x = i % W, y = (i / W) | 0;
      const hp = Math.max(0, Math.min(100, g.happy[i])) / 100;
      const col = hp > 0.5 ? mixc('#f2d24a', '#4fe07a', (hp - 0.5) * 2) : mixc('#ef3a30', '#f2d24a', hp * 2);
      const grd = ctx.createRadialGradient(x * ts + ts / 2, y * ts + ts / 2, 1, x * ts + ts / 2, y * ts + ts / 2, ts * 1.6);
      grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.7; ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 1.6, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  private drawHover(ctx: CanvasRenderingContext2D, g: Game, ts: number) {
    const i = g.hover;
    if (i < 0 || g.status !== 'playing') return;
    const x = i % W, y = (i / W) | 0;
    const tool = g.tool;
    const ev = g.evalPlace(tool, i);
    const ok = ev.ok && ev.cost <= g.coins + (tool === 'demolish' ? 1e9 : 0);
    const radius: Partial<Record<string, number>> = { house: 1, farm: 2, fountain: 5, bath: 6, mill: 3, treatment: 4, spillway: 0 };
    const r = radius[tool];
    if (r) {
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,230,150,0.9)'; ctx.lineWidth = 1.5;
      ctx.strokeRect((x - r) * ts, (y - r) * ts, (2 * r + 1) * ts, (2 * r + 1) * ts); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,230,150,0.08)'; ctx.fillRect((x - r) * ts, (y - r) * ts, (2 * r + 1) * ts, (2 * r + 1) * ts);
    }
    ctx.fillStyle = ok ? 'rgba(124,230,116,0.38)' : tool === 'select' ? 'rgba(255,255,255,0.18)' : 'rgba(240,90,70,0.42)';
    ctx.fillRect(x * ts, y * ts, ts, ts);
    ctx.strokeStyle = ok ? '#b6ffa8' : tool === 'select' ? '#fff' : '#ff9a80'; ctx.lineWidth = 2; ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
    if (tool === 'pump') {
      ctx.save(); ctx.translate(x * ts + ts / 2, y * ts + ts / 2); ctx.rotate((g.pumpDir * Math.PI) / 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ts * 0.4, 0); ctx.lineTo(ts * 0.15, -ts * 0.15); ctx.lineTo(ts * 0.15, ts * 0.15); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (tool !== 'select') {
      let label = '';
      if (ev.ok) {
        label = tool === 'demolish' ? `+${Math.round(-ev.cost)}🪙` : `${Math.ceil(ev.cost)}🪙`;
        if (tool === 'bridge') {
          const k: Kind = ev.kind || 'canal';
          label += ` · ${k === 'bridge' ? 'aqueduct' : k === 'tunnel' ? 'tunnel' : 'canal'} bed ${ev.bed}`;
        }
      } else label = ev.reason || '';
      if (label) {
        ctx.font = `700 ${Math.max(10, ts * 0.42)}px Nunito, sans-serif`;
        const tw = ctx.measureText(label).width + 10;
        let bx = x * ts + ts / 2 - tw / 2; const by = y * ts - ts * 0.75 < 0 ? (y + 1) * ts + 4 : y * ts - ts * 0.7;
        bx = Math.max(2, Math.min(W * ts - tw - 2, bx));
        ctx.fillStyle = 'rgba(14,26,32,0.92)'; ctx.fillRect(bx, by, tw, ts * 0.6);
        ctx.fillStyle = ok ? '#e8ffe0' : '#ffb8a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + tw / 2, by + ts * 0.31);
      }
    }
  }
}
