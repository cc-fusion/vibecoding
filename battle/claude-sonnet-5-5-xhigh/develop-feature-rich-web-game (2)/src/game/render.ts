import { T, TILES, ITEMS, B, TS } from './data';
import { atlas, wallAtlas, iconCanvas, shade, hexRgb } from './gfx';
import type { Game } from './game';
import { daylight, isNight } from './game';
import type { Enemy, Npc } from './types';
import { HELL_TOP } from './world';

const STARS = Array.from({ length: 160 }, (_, i) => ({ x: ((i * 7919) % 1000) / 1000, y: ((i * 104729) % 1000) / 1000, s: 1 + (i % 3), p: i * 1.7 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: (i * 0.137) % 1, y: 0.06 + ((i * 0.31) % 0.28), s: 0.7 + (i % 4) * 0.35 }));
const glowCache = new Map<string, HTMLCanvasElement>();
const rgbCache = new Map<string, [number, number, number]>();
const rgbOf = (c: string): [number, number, number] => { let r = rgbCache.get(c); if (!r) { r = c[0] === '#' ? hexRgb(c) : [255, 255, 255]; rgbCache.set(c, r); } return r; };
function glowSprite(c: [number, number, number]) {
  const k = c.join(','); let s = glowCache.get(k);
  if (!s) { s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, `rgba(${k},1)`); g.addColorStop(0.4, `rgba(${k},0.35)`); g.addColorStop(1, `rgba(${k},0)`); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowCache.set(k, s); }
  return s;
}
let lightCanvas: HTMLCanvasElement | null = null, lightCtx: CanvasRenderingContext2D | null = null, lightImg: ImageData | null = null;
let LB = new Float32Array(1), CB = new Float32Array(1);
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: number[]) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

export function render(g: Game) {
  const ctx = g.ctx, cv = g.canvas, S = g.scale, W = cv.width, H = cv.height, w = g.world, dl = daylight(g.time);
  const p = g.player;
  drawBackground(g, ctx, W, H, dl);
  ctx.setTransform(S, 0, 0, S, -g.camL * S, -g.camT * S); ctx.imageSmoothingEnabled = false;
  const x0 = Math.max(0, Math.floor(g.camL / 16) - 1), y0 = Math.max(0, Math.floor(g.camT / 16) - 1), x1 = Math.min(w.W - 1, Math.floor((g.camL + g.vw) / 16) + 1), y1 = Math.min(w.H - 1, Math.floor((g.camT + g.vh) / 16) + 1);
  const glows: [number, number, number, [number, number, number], number][] = [];
  const time = performance.now() / 1000;
  // walls
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w.W + x, wl = w.walls[i]; if (!wl) continue; const t = w.tiles[i]; if (t && TILES[t].solid && !TILES[t].clear) continue;
    ctx.drawImage(wallAtlas, (((x * 7 + y * 13) ^ x) & 3) * 16, wl * 16, 16, 16, x * 16, y * 16, 16, 16);
  }
  // tiles
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w.W + x, t = w.tiles[i]; if (!t) continue; const d = TILES[t];
    if (d.liquid) {
      const above = w.get(x, y - 1) === t;
      if (t === T.WATER) { ctx.fillStyle = 'rgba(48,108,230,0.6)'; ctx.fillRect(x * 16, y * 16 + (above ? 0 : 3), 16, above ? 16 : 13); if (!above) { ctx.fillStyle = 'rgba(190,225,255,0.8)'; ctx.fillRect(x * 16, y * 16 + 3 + Math.round(Math.sin(time * 3 + x) * 0.6), 16, 1); } }
      else { ctx.fillStyle = above ? '#d8420a' : '#f05a14'; ctx.fillRect(x * 16, y * 16 + (above ? 0 : 2), 16, above ? 16 : 14); ctx.fillStyle = '#ffa030'; ctx.fillRect(x * 16 + ((x * 5 + Math.floor(time * 2)) % 12), y * 16 + 4 + ((y * 3) % 8), 3, 2); if (!above) { ctx.fillStyle = '#ffd060'; ctx.fillRect(x * 16, y * 16 + 2, 16, 1); } if (glows.length < 90 && (x + y) % 3 === 0) glows.push([x * 16 + 8, y * 16 + 8, 34, [255, 110, 30], 0.35]); }
      continue;
    }
    ctx.drawImage(atlas, (((x * 7 + y * 13) ^ x) & 3) * 16, t * 16, 16, 16, x * 16, y * 16, 16, 16);
    if (d.light > 0.4 && glows.length < 90) { const c: [number, number, number] = t === T.TORCH ? [255, 170, 70] : t === T.CRYSTAL ? [255, 90, 150] : t === T.GLOWSHROOM ? [80, 220, 255] : t === T.ARCANE ? [140, 120, 255] : [255, 120, 50]; glows.push([x * 16 + 8, y * 16 + 8, t === T.TORCH ? 46 : 34, c, t === T.TORCH ? 0.42 + Math.sin(time * 9 + x) * 0.06 : 0.38]); }
    if (!d.solid && d.snd === 'plant' && t !== T.TRUNK && t !== T.CACTUS && !d.light) { /* sway handled by static art */ }
  }
  // crack overlay + cursor
  const m = g.mouse, d0 = g.selItem();
  if (p.mine.prog > 0 && !p.dead) {
    const tx = p.mine.x, ty = p.mine.y, t = w.get(tx, ty); const hp = t ? (TILES[t].hp || 30) : 30; const st = Math.min(3, Math.floor(p.mine.prog / hp * 4));
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); const px = tx * 16, py = ty * 16;
    const segs = [[8, 8, 3, 2], [8, 8, 13, 5], [8, 8, 4, 13], [8, 8, 12, 14], [3, 2, 1, 6], [13, 5, 15, 9]];
    for (let s = 0; s <= st + 1 && s < segs.length; s++) { const q = segs[s]; ctx.moveTo(px + q[0], py + q[1]); ctx.lineTo(px + q[2], py + q[3]); } ctx.stroke();
  }
  if (!p.dead && g.panel !== 'map' && (g.panel === 'none' || g.panel === 'inventory') && d0 && (d0.kind === 'pick' || d0.kind === 'block' || d0.kind === 'wall')) {
    const tx = Math.floor(m.wx / 16), ty = Math.floor(m.wy / 16); const ok = g.reachOK(tx, ty, d0.kind === 'pick' ? 5.5 : 6.5);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,80,80,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(tx * 16 + 0.5, ty * 16 + 0.5, 15, 15);
  }
  // room overlays (housing panel)
  if (g.panel === 'housing') {
    ctx.fillStyle = 'rgba(80,255,120,0.14)'; for (const r of g.rooms) for (const i of r.tiles) ctx.fillRect((i % w.W) * 16, ((i / w.W) | 0) * 16, 16, 16);
    const hr = g.hoverRoom; if (hr && hr.tiles.length && !hr.leaked) { ctx.fillStyle = hr.ok ? 'rgba(80,255,120,0.35)' : 'rgba(255,90,60,0.3)'; for (const i of hr.tiles) ctx.fillRect((i % w.W) * 16, ((i / w.W) | 0) * 16, 16, 16); }
  }
  // drops
  for (const dr of g.drops) {
    const bob = dr.onGround ? Math.sin(dr.t * 4 + dr.x) * 1.2 : 0; const ic = iconCanvas(dr.id);
    if (dr.star) { glows.push([dr.x + 4, dr.y + 4, 30, [255, 224, 96], 0.5]); }
    ctx.drawImage(ic, Math.round(dr.x - 2), Math.round(dr.y - 4 + bob), 12, 12);
  }
  // npcs
  for (const n of g.npcs) if (n.deadT <= 0) drawNpc(g, ctx, n);
  // enemies
  for (const e of g.enemies) { if (e.x + 200 < g.camL || e.x - 200 > g.camL + g.vw) { if (!e.boss) continue; } drawEnemy(g, ctx, e, glows); }
  // hook rope
  if (p.hook) { ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y + 12); ctx.lineTo(p.hook.x, p.hook.y); ctx.stroke(); ctx.fillStyle = '#cfcfd8'; ctx.fillRect(p.hook.x - 2, p.hook.y - 2, 4, 4); }
  if (!p.dead) drawPlayer(g, ctx);
  // projectiles
  for (const pr of g.projs) { drawProj(ctx, pr); if (pr.light && glows.length < 130) glows.push([pr.x, pr.y, 16 + pr.light * 16, rgbOf(pr.kind === 'rainbow' ? '#ff80ff' : pr.col), pr.light * 0.7]); }
  // particles
  for (const q of g.parts) { const a = Math.max(0, q.life / q.max); ctx.globalAlpha = a; ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); if (q.glow && glows.length < 160) glows.push([q.x, q.y, 8, rgbOf(q.col), 0.3 * a]); }
  ctx.globalAlpha = 1;
  // lighting
  drawLighting(g, ctx, x0, y0, x1, y1, dl);
  // glows
  ctx.globalCompositeOperation = 'lighter';
  for (const [gx, gy, r, c, a] of glows) { if (gx + r < g.camL || gx - r > g.camL + g.vw || gy + r < g.camT || gy - r > g.camT + g.vh) continue; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(c), gx - r, gy - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
  // boss beam
  if (g.boss && g.boss.def.id === 'lunar' && g.boss.a.beam) drawBeam(ctx, g.boss);
  ctx.globalCompositeOperation = 'source-over';
  // floating texts
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const f of g.texts) { ctx.globalAlpha = Math.min(1, f.life / f.max * 1.6); ctx.font = `bold ${f.size}px monospace`; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;
  // NPC names
  for (const n of g.npcs) if (n.deadT <= 0 && (Math.hypot(n.x - p.x, n.y - p.y) < 90 || (m.wx > n.x - 4 && m.wx < n.x + n.w + 4 && m.wy > n.y - 4 && m.wy < n.y + n.h + 4))) {
    ctx.font = 'bold 7px monospace'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(n.def.name, n.x + 6, n.y - 8); ctx.fillStyle = n.home < 0 ? '#ffd080' : '#c0ffc0'; ctx.fillText(n.def.name + (n.home < 0 ? ' (homeless)' : ''), n.x + 6, n.y - 8);
  }
  // ----- screen space -----
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawWeather(g, ctx, W, H, time);
  const hf = (g as any).hurtFlash || 0; if (hf > 0) { (g as any).hurtFlash = hf - 0.016; ctx.fillStyle = `rgba(200,0,0,${Math.min(0.35, hf * 0.5)})`; ctx.fillRect(0, 0, W, H); }
  if (!p.dead && p.hp < p.maxHp * 0.3) { const a = 0.15 + Math.sin(time * 6) * 0.06; const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(160,0,0,${a * 2})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
  if (g.ev.blood && w.layer(p.x / 16, p.y / 16) <= 1) { ctx.fillStyle = 'rgba(150,10,10,0.13)'; ctx.fillRect(0, 0, W, H); }
  if (g.panel === 'map') drawFullMap(g, ctx, W, H); else drawMinimap(g, ctx, W, H);
}

function drawBackground(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number, dl: number) {
  const S = g.scale, w = g.world, p = g.player; ctx.setTransform(1, 0, 0, 1, 0, 0);
  const night = isNight(g.time);
  const dayTop = [74, 163, 255], dayBot = [196, 232, 255], ntTop = [3, 5, 18], ntBot = [14, 22, 52];
  let top = mix(ntTop, dayTop, dl), bot = mix(ntBot, dayBot, dl);
  const tw = 1 - Math.abs(dl * 2 - 1); if (tw > 0.01 && dl > 0 && dl < 1) bot = mix(bot, [255, 140, 80], tw * 0.6);
  if (g.ev.blood) { top = mix(top, [60, 0, 10], 0.7); bot = mix(bot, [140, 20, 20], 0.6); }
  const grd = ctx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, rgb(top)); grd.addColorStop(1, rgb(bot)); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  const t = g.time; const surf = w.surf[Math.max(0, Math.min(w.W - 1, Math.floor(p.x / 16)))];
  const depth = Math.max(0, Math.min(1, (p.y / 16 - (surf + 4)) / 14));
  if (depth < 1) {
    if (dl < 0.8) { ctx.fillStyle = '#fff'; for (const s of STARS) { ctx.globalAlpha = (1 - dl) * (0.5 + 0.5 * Math.sin(t * 2 + s.p)) * (1 - depth); ctx.fillRect(Math.floor(s.x * W), Math.floor(s.y * H * 0.7), s.s * S * 0.6, s.s * S * 0.6); } ctx.globalAlpha = 1; }
    // sun / moon
    const frac = night ? (t - 360) / 240 : t / 360; const sx = W * (0.08 + 0.84 * frac), sy = H * 0.5 - Math.sin(Math.PI * frac) * H * 0.38;
    ctx.globalAlpha = 1 - depth;
    if (!night) { const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * S); gl.addColorStop(0, 'rgba(255,240,170,0.8)'); gl.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = gl; ctx.fillRect(sx - 60 * S, sy - 60 * S, 120 * S, 120 * S); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(sx, sy, 11 * S, 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = g.ev.blood ? '#c01818' : '#e8eefc'; ctx.beginPath(); ctx.arc(sx, sy, 9 * S, 0, 6.283); ctx.fill(); ctx.fillStyle = g.ev.blood ? '#901010' : '#c8d0e8'; ctx.beginPath(); ctx.arc(sx - 3 * S, sy - 2 * S, 2 * S, 0, 6.283); ctx.arc(sx + 3 * S, sy + 3 * S, 1.5 * S, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
    // clouds
    ctx.fillStyle = `rgba(255,255,255,${0.15 + dl * 0.6})`; const cl = 1 - depth;
    for (const c of CLOUDS) { const cx = ((c.x * 1.4 * W - g.camL * S * 0.15 + t * 3 * S * c.s) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15; const cy = c.y * H - (g.camT - 60 * 16) * S * 0.05; if (cl > 0.01) { ctx.globalAlpha = cl; ctx.beginPath(); ctx.ellipse(cx, cy, 34 * S * c.s, 8 * S * c.s, 0, 0, 6.283); ctx.ellipse(cx + 18 * S * c.s, cy - 5 * S * c.s, 22 * S * c.s, 9 * S * c.s, 0, 0, 6.283); ctx.ellipse(cx - 20 * S * c.s, cy - 2 * S * c.s, 20 * S * c.s, 7 * S * c.s, 0, 0, 6.283); ctx.fill(); } }
    ctx.globalAlpha = 1;
    // hills
    const b = w.biomeAt(p.x / 16, p.y / 16); const pal: Record<number, string[]> = { [B.FOREST]: ['#5f86b8', '#3f7a5a', '#2f6a3a'], [B.DESERT]: ['#d8b878', '#c9a060', '#b88a48'], [B.TUNDRA]: ['#b8d0e8', '#d0e2f2', '#e6f0fa'], [B.JUNGLE]: ['#2a8a5a', '#1f7a40', '#16602f'], [B.BLIGHT]: ['#5a4080', '#463066', '#33244f'], [B.HELL]: ['#402030', '#301020', '#200810'] };
    const cols = pal[b] || pal[B.FOREST]; const base = (surf * 16 - g.camT) * S; const dim = 0.25 + dl * 0.75;
    for (let layer = 0; layer < 3; layer++) {
      const par = 0.1 + layer * 0.12, amp = (24 - layer * 5) * S, off = g.camL * S * par, yb = base - (46 - layer * 16) * S * 1.0 + (layer * 0) ;
      const c = hexRgb(cols[layer]); ctx.fillStyle = rgb([c[0] * dim, c[1] * dim, c[2] * dim * (1.0 + (1 - dl) * 0.25)]);
      ctx.globalAlpha = 1 - depth; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) { const wx = (x + off) / S; ctx.lineTo(x, yb - (Math.sin(wx * 0.021 + layer * 3) * 0.6 + Math.sin(wx * 0.047 + layer) * 0.4 + 1) * amp * 0.5); }
      ctx.lineTo(W, H); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (depth > 0) { ctx.fillStyle = `rgba(16,12,14,${depth})`; ctx.fillRect(0, 0, W, H); }
  if (p.y / 16 > HELL_TOP) { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(50,8,4,0.9)'); gr.addColorStop(1, 'rgba(110,24,6,0.9)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
}

function drawLighting(g: Game, ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, dl: number) {
  const w = g.world, p = g.player; const M = 7; const mx0 = x0 - M, my0 = y0 - M, tw = x1 - x0 + 1 + M * 2, th = y1 - y0 + 1 + M * 2; const n = tw * th;
  if (LB.length < n) { LB = new Float32Array(n); CB = new Float32Array(n); }
  if (!lightCanvas || lightCanvas.width !== tw || lightCanvas.height !== th) { lightCanvas = document.createElement('canvas'); lightCanvas.width = tw; lightCanvas.height = th; lightCtx = lightCanvas.getContext('2d')!; lightImg = lightCtx.createImageData(tw, th); }
  const skyL = (g.ev.blood ? 0.2 : 0.34) + (1 - (g.ev.blood ? 0.2 : 0.34)) * dl;
  for (let cx = 0; cx < tw; cx++) {
    const wx = mx0 + cx; let skyTop = 0;
    if (wx >= 0 && wx < w.W) { while (skyTop < w.H) { const t = w.tiles[skyTop * w.W + wx]; if ((t && TILES[t].solid && !TILES[t].clear) || w.walls[skyTop * w.W + wx]) break; skyTop++; } } else skyTop = 0;
    for (let cy = 0; cy < th; cy++) {
      const wy = my0 + cy, i = cy * tw + cx; let t: number;
      if (wx < 0 || wx >= w.W || wy >= w.H) t = T.STONE; else if (wy < 0) t = 0; else t = w.tiles[wy * w.W + wx];
      const d = TILES[t]; const solid = d.solid && !d.clear;
      CB[i] = solid ? 0.2 : 0.075; let l = 0;
      if (wy < skyTop && wx >= 0 && wx < w.W) l = skyL; if (d.light > l) l = d.light;
      if (wy >= HELL_TOP && t === 0) l = Math.max(l, 0.06);
      LB[i] = l;
    }
  }
  const put = (wx: number, wy: number, v: number) => { const cx = Math.floor(wx / 16) - mx0, cy = Math.floor(wy / 16) - my0; if (cx >= 0 && cx < tw && cy >= 0 && cy < th) { const i = cy * tw + cx; if (v > LB[i]) LB[i] = v; } };
  const sel = g.selItem(); const px = p.x + p.w / 2, py = p.y + 10;
  put(px, py, p.st.owl ? 0.85 : 0.5); if (sel && sel.id === 'torch') put(px, py, 1);
  for (const e of g.enemies) if (e.def.light) put(e.x + e.w / 2, e.y + e.h / 2, e.def.light);
  for (const pr of g.projs) if (pr.light) put(pr.x, pr.y, Math.min(1, pr.light));
  for (const dr of g.drops) if (dr.star) put(dr.x, dr.y, 0.9);
  if (g.boss) put(g.boss.x + g.boss.w / 2, g.boss.y + g.boss.h / 2, 0.8);
  for (let it = 0; it < 2; it++) {
    for (let cy = 0; cy < th; cy++) { const r = cy * tw; for (let cx = 1; cx < tw; cx++) { const v = LB[r + cx - 1] - CB[r + cx]; if (v > LB[r + cx]) LB[r + cx] = v; } for (let cx = tw - 2; cx >= 0; cx--) { const v = LB[r + cx + 1] - CB[r + cx]; if (v > LB[r + cx]) LB[r + cx] = v; } }
    for (let cx = 0; cx < tw; cx++) { for (let cy = 1; cy < th; cy++) { const i = cy * tw + cx; const v = LB[i - tw] - CB[i]; if (v > LB[i]) LB[i] = v; } for (let cy = th - 2; cy >= 0; cy--) { const i = cy * tw + cx; const v = LB[i + tw] - CB[i]; if (v > LB[i]) LB[i] = v; } }
  }
  const data = lightImg!.data; const hellTint = p.y / 16 > HELL_TOP; const owl = p.st.owl ? 0.18 : 0;
  for (let i = 0; i < n; i++) { const l = Math.min(1, LB[i] + owl); const o = i * 4; data[o] = hellTint ? 18 : 3; data[o + 1] = hellTint ? 3 : 4; data[o + 2] = hellTint ? 2 : 14; data[o + 3] = Math.round((1 - l) * 245); }
  lightCtx!.putImageData(lightImg!, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(lightCanvas, 0, 0, tw, th, mx0 * 16, my0 * 16, tw * 16, th * 16); ctx.imageSmoothingEnabled = false;
  void TS;
}

// ---------- characters ----------
function human(ctx: CanvasRenderingContext2D, cx: number, by: number, dir: number, walk: number, o: { skin: string; hair?: string; shirt: string; pants: string; helm?: string; fl?: boolean; reach?: boolean; swing?: number; held?: string; ear?: boolean; bone?: boolean; alpha?: number; heldAng?: number }) {
  const K = (c: string) => (o.fl ? '#ffffff' : c); const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = K(c); ctx.fillRect(x, y, w, h); };
  ctx.save(); ctx.translate(Math.round(cx), Math.round(by)); ctx.scale(dir, 1); if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const s = Math.sin(walk) * 3, l1 = Math.max(0, Math.sin(walk)) * 2, l2 = Math.max(0, -Math.sin(walk)) * 2;
  R(-4 + s * 0.3, -10 + l1, 4, 10 - l1, o.pants); R(0 - s * 0.3, -10 + l2, 4, 10 - l2, shade(o.pants, -0.2)); R(-4 + s * 0.3, -2, 4, 2, '#2a2a30'); R(0 - s * 0.3, -2, 4, 2, '#2a2a30');
  // back arm
  R(-6 - s * 0.2, -19, 3, 8, shade(o.skin, -0.15));
  R(-5, -20, 10, 10, o.shirt); R(-5, -11, 10, 1, shade(o.shirt, -0.35)); if (o.bone) { for (let i = 0; i < 3; i++) R(-3, -18 + i * 3, 6, 1, shade(o.shirt, -0.4)); }
  R(-4, -28, 8, 8, o.skin); if (o.hair) { R(-5, -29, 10, 4, o.hair); R(-5, -26, 2, 4, o.hair); } R(1, -25, 2, 2, '#222'); if (o.ear) { R(4, -26, 3, 2, o.skin); R(-6, -26, 2, 2, o.skin); }
  if (o.helm) { R(-5, -30, 10, 6, o.helm); R(-5, -25, 2, 3, o.helm); R(0, -25, 5, 1, shade(o.helm, -0.5)); R(-2, -31, 4, 2, shade(o.helm, 0.2)); }
  // front arm + item
  const sw = o.swing; let ang: number;
  if (sw !== undefined) ang = sw; else if (o.reach) ang = -0.15; else ang = 0.3 + Math.sin(walk + 3) * 0.5 * (Math.abs(s) > 0.1 ? 1 : 0);
  ctx.save(); ctx.translate(2, -18); ctx.rotate(ang); R(-1.5, 0, 3, 8, o.skin); R(-1.5, 6, 3, 2, shade(o.skin, 0.1));
  if (o.held) { const ic = iconCanvas(o.held), d = ITEMS[o.held], follow = sw !== undefined; ctx.translate(0, 7); if (d && (d.kind === 'sword' || d.kind === 'pick' || d.kind === 'staff')) { const k = d.reach && d.reach > 40 ? 1.5 : 1; ctx.rotate(follow ? 3 * Math.PI / 4 : -ang); ctx.scale(k, k); ctx.drawImage(ic, -2, -14, 16, 16); } else if (d && (d.kind === 'bow' || d.kind === 'gun')) { ctx.rotate(follow ? Math.PI / 2 : -ang); ctx.drawImage(ic, -2, -8, 16, 16); } else { ctx.rotate(-ang); ctx.drawImage(ic, 0, -8, 10, 10); } }
  ctx.restore(); ctx.restore();
}
function drawPlayer(g: Game, ctx: CanvasRenderingContext2D) {
  const p = g.player; if (p.invT > 0 && Math.floor(p.invT * 20) % 2 === 0 && p.invT < 3) ctx.globalAlpha = 0.45;
  const it = g.selItem(); const A = p.armor.map(s => (s ? ITEMS[s.id].col : undefined));
  if (p.st.wings && !p.onGround) { const f = Math.sin(performance.now() / 70) * 0.5; ctx.save(); ctx.translate(Math.round(p.x + p.w / 2), Math.round(p.y + 14)); ctx.scale(-p.dir, 1); ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-4 - i * 3, -4 - f * 6 + i * 3, 9 - i, 3, -0.6 - f * 0.4 + i * 0.2, 0, 6.283); ctx.fill(); } ctx.restore(); }
  let swing: number | undefined; let hAng = 0;
  const m = g.mouse; const sx = p.x + p.w / 2, sy = p.y + 10; const ra = Math.atan2(m.wy - sy, (m.wx - sx) * p.dir);
  if (p.swing) { const f = p.swing.t / p.swing.dur; const k = it && it.kind === 'pick' ? 1 : 1; swing = -2.4 + 2.7 * (1 - Math.pow(1 - f, 2)) * k; hAng = 0; if (it && it.kind === 'pick') swing = -2.4 + 2.9 * Math.abs(Math.sin(f * 3.14)); }
  else if (it && (it.kind === 'bow' || it.kind === 'gun' || it.kind === 'staff') && g.mouse.down) { swing = -Math.PI / 2 + ra; hAng = 0; hAng = it.kind === 'staff' ? -Math.PI / 4 * 0 : 0; }
  if (swing !== undefined && p.swing && it && it.kind === 'sword') { const f = p.swing.t / p.swing.dur; ctx.save(); ctx.translate(sx, sy + 2); ctx.scale(p.dir, 1); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); const r = (it.reach || 34) * 0.85; ctx.arc(0, 0, r, -0.85 + 2.7 * Math.max(0, f - 0.3), -0.85 + 2.7 * f); ctx.stroke(); ctx.restore(); }
  const heldId = p.inv[p.sel]?.id;
  human(ctx, p.x + p.w / 2, p.y + p.h, p.dir, p.walk, { skin: '#f0c8a0', hair: '#5a3a20', shirt: A[1] || '#3a7ac8', pants: A[2] || '#4a4a6a', helm: A[0], swing: swing !== undefined ? swing : (g.player.sleeping ? 0 : undefined), held: heldId, heldAng: hAng });
  ctx.globalAlpha = 1;
  if (p.sleeping) { ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#bcd0ff'; ctx.textAlign = 'center'; ctx.fillText('Z z z', p.x + 6, p.y - 8 + Math.sin(performance.now() / 300) * 2); }
  if (p.recall > 0) { ctx.strokeStyle = 'rgba(160,220,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x + 6, p.y + 14, 14 + (2.5 - p.recall) * 6, 0, 6.283); ctx.stroke(); }
}
function drawNpc(g: Game, ctx: CanvasRenderingContext2D, n: Npc) {
  human(ctx, n.x + n.w / 2, n.y + n.h, n.dir, n.walk, { skin: '#f0c8a0', hair: n.def.hair, shirt: n.def.col, pants: shade(n.def.col, -0.4), fl: n.flash > 0 });
  if (n.hp < n.maxHp) { ctx.fillStyle = '#300'; ctx.fillRect(n.x - 2, n.y - 4, 16, 2); ctx.fillStyle = '#4f4'; ctx.fillRect(n.x - 2, n.y - 4, 16 * n.hp / n.maxHp, 2); }
  if (n.home < 0 && Math.floor(performance.now() / 500) % 2 === 0) { ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#ffd040'; ctx.textAlign = 'center'; ctx.fillText('!', n.x + 6, n.y - 12); }
  void g;
}

function drawEnemy(g: Game, ctx: CanvasRenderingContext2D, e: Enemy, glows: any[]) {
  const d = e.def, cx = e.x + e.w / 2, cy = e.y + e.h / 2, fl = e.flash > 0; const K = (c: string) => (fl ? '#ffffff' : c);
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = K(c); ctx.fillRect(x, y, w, h); };
  ctx.save(); ctx.globalAlpha = e.alpha;
  if (e.boss) { drawBoss(g, ctx, e, glows); ctx.restore(); if (e.hp < e.maxHp) { } return; }
  switch (d.draw) {
    case 'slime': { const sq = Math.max(-0.35, Math.min(0.35, -e.vy / 700)); const rx = e.w / 2 * (1 - sq * 0.6), ry = e.h * (1 + sq); ctx.fillStyle = K(d.col); ctx.globalAlpha = e.alpha * 0.88; ctx.beginPath(); ctx.ellipse(cx, e.y + e.h, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.globalAlpha = e.alpha; ctx.fillStyle = K(d.col2); ctx.fillRect(cx - rx, e.y + e.h - 2, rx * 2, 2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - rx * 0.5, e.y + e.h - ry * 0.75, 3, 2); const ex = e.dir * 2; R(cx - 3 + ex, e.y + e.h - ry * 0.45, 2, 3, '#111'); R(cx + 2 + ex, e.y + e.h - ry * 0.45, 2, 3, '#111'); if (d.light) glows.push([cx, cy, 24, [255, 110, 30], 0.35]); break; }
    case 'humanoid': { const aim = d.ai === 'archer'; human(ctx, cx, e.y + e.h, e.dir, e.walk, { skin: d.col, shirt: d.col2, pants: shade(d.col2, -0.3), fl, reach: !aim, ear: d.id.startsWith('goblin'), bone: d.bone, hair: d.id === 'zombie' ? '#3a4a2a' : undefined, held: aim ? 'wood_bow' : undefined, swing: aim ? -1.57 : undefined, heldAng: 0 }); break; }
    case 'eye': { const r = e.w / 2; ctx.save(); ctx.translate(cx, cy); const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x); ctx.fillStyle = K('rgba(150,30,30,0.8)'); ctx.beginPath(); ctx.moveTo(-Math.cos(ang) * r, -Math.sin(ang) * r); ctx.lineTo(-Math.cos(ang) * r * 2.2 + Math.sin(e.t * 8) * 2, -Math.sin(ang) * r * 2.2); ctx.lineTo(-Math.cos(ang) * r * 1.2 + 2, -Math.sin(ang) * r * 1.2 + 2); ctx.fill(); ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.fillStyle = K(d.col2); ctx.beginPath(); ctx.arc(Math.cos(ang) * r * 0.35, Math.sin(ang) * r * 0.35, r * 0.5, 0, 6.283); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * 0.45, Math.sin(ang) * r * 0.45, r * 0.22, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(200,40,40,0.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-r * 0.9, -2); ctx.lineTo(-r * 0.4, -r * 0.2); ctx.moveTo(r * 0.2, r * 0.8); ctx.lineTo(r * 0.1, r * 0.4); ctx.stroke(); if (d.light) glows.push([cx, cy, 26, [80, 220, 255], 0.4]); ctx.restore(); break; }
    case 'bat': { const f = Math.sin(e.t * 22) * 4; ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.ellipse(cx, cy, 4, 3, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx - 12, cy - 4 + f); ctx.lineTo(cx - 8, cy + 2); ctx.lineTo(cx - 5, cy + 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 12, cy - 4 + f); ctx.lineTo(cx + 8, cy + 2); ctx.lineTo(cx + 5, cy + 3); ctx.fill(); R(cx - 2, cy - 1, 1, 1, '#f44'); R(cx + 1, cy - 1, 1, 1, '#f44'); R(cx - 3, cy - 4, 1, 2, d.col2); R(cx + 2, cy - 4, 1, 2, d.col2); if (d.light) glows.push([cx, cy, 20, [255, 90, 40], 0.4]); break; }
    case 'bird': { ctx.save(); ctx.translate(cx, cy); ctx.scale(e.dir, 1); const f = Math.sin(e.t * 9) * 5; ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = K(d.col2); ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(-6, -9 + f); ctx.lineTo(4, -2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(-6, 9 - f); ctx.lineTo(4, 2); ctx.fill(); R(7, -3, 4, 3, d.col); R(11, -2, 3, 1, '#e8c040'); R(9, -3, 1, 1, '#111'); ctx.restore(); break; }
    case 'bug': { ctx.save(); ctx.translate(cx, cy); ctx.scale(e.dir, 1); ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2 - 1, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = K(d.col2); ctx.fillRect(-2, -e.h / 2 + 1, 2, e.h - 2); ctx.fillRect(2, -e.h / 2 + 2, 2, e.h - 4); if (d.ai === 'flyshoot') { ctx.fillStyle = 'rgba(220,240,255,0.6)'; const f = Math.sin(e.t * 40) * 3; ctx.beginPath(); ctx.ellipse(-2, -6 + f * 0.3, 6, 3 + Math.abs(f) * 0.5, -0.4, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e44'; ctx.fillRect(-e.w / 2 - 3, -1, 4, 2); } ctx.fillStyle = '#111'; ctx.fillRect(e.w / 2 - 3, -2, 2, 2); ctx.restore(); break; }
    case 'souls': { ctx.save(); ctx.translate(cx, cy); ctx.scale(e.dir, 1); ctx.fillStyle = K(d.col2); const wv = Math.sin(e.t * 10) * 3; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-e.w * 0.9, wv - 3); ctx.lineTo(-e.w * 0.7, wv + 4); ctx.fill(); ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#200010'; ctx.beginPath(); ctx.ellipse(e.w * 0.15, 2, e.w * 0.3, e.h * 0.2 + Math.abs(Math.sin(e.t * 8)) * 2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(e.w * 0.0, 0, 1, 2); ctx.fillRect(e.w * 0.2, 0, 1, 2); ctx.fillRect(e.w * 0.35, 0, 1, 2); ctx.fillRect(2, -e.h * 0.28, 3, 3); ctx.fillStyle = '#f33'; ctx.fillRect(3, -e.h * 0.25, 2, 2); ctx.restore(); break; }
    case 'imp': { const f = Math.sin(e.t * 12) * 3; ctx.save(); ctx.translate(cx, cy); ctx.scale(e.dir, 1); ctx.fillStyle = K(d.col2); ctx.globalAlpha = e.alpha * 0.8; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-13, -10 + f); ctx.lineTo(-9, 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(13, -10 + f); ctx.lineTo(9, 2); ctx.fill(); ctx.globalAlpha = e.alpha; R(-4, -2, 8, 10, d.col); R(-3, -11, 7, 8, d.col); R(-4, -14, 2, 4, '#401010'); R(3, -14, 2, 4, '#401010'); R(1, -8, 2, 2, '#ffe060'); R(-3, 8, 3, 4, shade(d.col, -0.3)); R(1, 8, 3, 4, shade(d.col, -0.3)); if (d.light) glows.push([0 + cx, cy, 26, [255, 120, 40], 0.4]); ctx.restore(); break; }
    case 'ghost': { ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = K(d.col); ctx.beginPath(); ctx.arc(0, -6, 8, Math.PI, 0); ctx.lineTo(8, 10); for (let i = 0; i < 4; i++) ctx.lineTo(8 - (i + 1) * 4, 10 + (i % 2 ? 3 : -2) + Math.sin(e.t * 6 + i) * 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#102050'; ctx.fillRect(-4, -8, 3, 4); ctx.fillRect(2, -8, 3, 4); ctx.fillStyle = K(d.col2); ctx.fillRect(-4, -2, 8, 2); glows.push([cx, cy, 24, [140, 170, 255], 0.35]); ctx.restore(); break; }
    case 'skull': { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(e.t * 3) * 0.2); R(-7, -7, 14, 10, d.col); R(-5, 3, 10, 4, shade(d.col, -0.1)); R(-5, -3, 4, 4, '#101010'); R(1, -3, 4, 4, '#101010'); R(-4, -2, 2, 2, d.col2); R(2, -2, 2, 2, d.col2); R(-1, 1, 2, 2, '#444'); glows.push([cx, cy, 22, [64, 255, 144], 0.4]); ctx.restore(); break; }
    case 'demon': { const f = Math.sin(e.t * 8) * 5; ctx.save(); ctx.translate(cx, cy); ctx.scale(e.dir, 1); ctx.fillStyle = K(d.col2); ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-22, -14 + f); ctx.lineTo(-18, 2); ctx.lineTo(-10, 5); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(22, -14 + f); ctx.lineTo(18, 2); ctx.lineTo(10, 5); ctx.fill(); R(-6, -4, 12, 14, d.col); R(-5, -13, 10, 9, d.col); R(-6, -17, 3, 6, '#301010'); R(3, -17, 3, 6, '#301010'); R(0, -9, 3, 2, '#ffe060'); R(-3, 10, 3, 5, d.col2); R(1, 10, 3, 5, d.col2); glows.push([cx, cy, 24, [255, 60, 60], 0.3]); ctx.restore(); break; }
  }
  ctx.restore();
  if (e.hp < e.maxHp && !e.boss) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 1, e.y - 5, e.w + 2, 3); ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#4c4' : '#e44'; ctx.fillRect(e.x, e.y - 4, e.w * e.hp / e.maxHp, 1); }
}

function drawBoss(g: Game, ctx: CanvasRenderingContext2D, e: Enemy, glows: any[]) {
  const id = e.def.id, cx = e.x + e.w / 2, cy = e.y + e.h / 2, fl = e.flash > 0; const K = (c: string) => (fl ? '#ffffff' : c); const a = e.a;
  const p = g.player; const ang = Math.atan2(p.y + 14 - cy, p.x + 6 - cx);
  if (id === 'eoc') {
    const ph = a.phase || 1, r = 28; ctx.save(); ctx.translate(cx, cy); const rot = a.state === 'dash' ? Math.atan2(e.vy, e.vx) : ang; ctx.rotate(rot);
    ctx.strokeStyle = K('#a02030'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-r + 4, 0); for (let i = 1; i <= 5; i++) ctx.lineTo(-r - i * 9, Math.sin(e.t * 6 + i) * 6); ctx.stroke();
    ctx.fillStyle = K(ph === 1 ? '#f4eaea' : '#d8a0a0'); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(200,30,40,0.7)'; ctx.lineWidth = 1; for (let i = 0; i < 9; i++) { const aa = i * 0.7 + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(aa) * r, Math.sin(aa) * r); ctx.lineTo(Math.cos(aa + 0.2) * r * 0.55, Math.sin(aa + 0.2) * r * 0.55); ctx.stroke(); }
    if (ph === 1) { ctx.fillStyle = K('#2a68e0'); ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.45, 0, 6.283); ctx.fill(); ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(r * 0.32, 0, r * 0.2, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(r * 0.15, -r * 0.2, 3, 3); }
    else { ctx.fillStyle = '#400810'; ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 0.62, r * 0.5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(r * 0.2 + i * 5, -r * 0.45 + Math.abs(i)); ctx.lineTo(r * 0.2 + i * 5 + 2.5, -r * 0.1); ctx.lineTo(r * 0.2 + i * 5 - 2.5, -r * 0.1); ctx.fill(); ctx.beginPath(); ctx.moveTo(r * 0.2 + i * 5, r * 0.45 - Math.abs(i)); ctx.lineTo(r * 0.2 + i * 5 + 2.5, r * 0.1); ctx.lineTo(r * 0.2 + i * 5 - 2.5, r * 0.1); ctx.fill(); } }
    ctx.restore(); glows.push([cx, cy, 50, [255, 60, 60], 0.25]);
  } else if (id === 'bone_lord') {
    ctx.save(); ctx.translate(cx, cy); if (a.state === 'spin') ctx.rotate(a.ang * 1.0); const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = K(c); ctx.fillRect(x, y, w, h); };
    R(-22, -22, 44, 32, '#e8e4d0'); R(-16, 10, 32, 12, '#d8d0b8'); R(-14, -8, 12, 12, '#0a1a10'); R(2, -8, 12, 12, '#0a1a10'); R(-11, -5, 6, 6, '#40ff90'); R(5, -5, 6, 6, '#40ff90'); R(-3, 4, 6, 5, '#6a6a60'); for (let i = -2; i <= 2; i++) R(i * 6 - 1, 14, 2, 8, '#888078'); R(-22, -22, 44, 3, '#fff8e8');
    ctx.restore(); for (const r of e.rects.slice(1)) { ctx.fillStyle = K('#e8e4d0'); ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#b8b098'; ctx.fillRect(r.x + 3, r.y + 3, 3, r.h - 6); ctx.fillRect(r.x + 9, r.y + 3, 3, r.h - 6); ctx.strokeStyle = 'rgba(232,228,208,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(r.x + 10, r.y + 10); ctx.stroke(); }
    glows.push([cx, cy, 52, [64, 255, 144], 0.3]);
  } else if (id === 'flesh_wall') {
    const dir = e.dir || 1; const front = dir > 0 ? e.x + e.w : e.x; const back = front - dir * 260; const x0 = Math.min(front, back), wd = Math.abs(front - back);
    const y0 = Math.max(g.camT - 10, HELL_TOP * 16 - 30), y1 = Math.min(g.camT + g.vh + 10, (g.world.H) * 16);
    const gr = ctx.createLinearGradient(front, 0, back, 0); gr.addColorStop(0, K('#e07080')); gr.addColorStop(0.15, K('#c04a60')); gr.addColorStop(1, K('#401020')); ctx.fillStyle = gr; ctx.fillRect(x0, y0, wd, y1 - y0);
    ctx.strokeStyle = 'rgba(120,10,30,0.6)'; ctx.lineWidth = 2; for (let y = Math.floor(y0 / 24) * 24; y < y1; y += 24) { ctx.beginPath(); ctx.moveTo(front, y); ctx.bezierCurveTo(front - dir * 30, y + 8, front - dir * 60, y - 8, front - dir * 90, y + 6); ctx.stroke(); }
    ctx.fillStyle = K('#e87888'); ctx.fillRect(front - dir * 4, y0, 4 * dir, y1 - y0);
    const eye = (oy: number) => { const ex = front - dir * 10, ey = cy + oy; ctx.fillStyle = K('#f8f0f0'); ctx.beginPath(); ctx.arc(ex, ey, 14, 0, 6.283); ctx.fill(); ctx.fillStyle = '#d02030'; ctx.beginPath(); ctx.arc(ex + Math.cos(ang) * 5 + dir * 3, ey + Math.sin(ang) * 5, 7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#100'; ctx.beginPath(); ctx.arc(ex + Math.cos(ang) * 6 + dir * 3, ey + Math.sin(ang) * 6, 3, 0, 6.283); ctx.fill(); glows.push([ex, ey, 34, [255, 40, 60], 0.35]); };
    eye(-60); eye(50);
    ctx.fillStyle = '#30040c'; ctx.beginPath(); ctx.ellipse(front - dir * 8, cy + 112, 18, 14 + Math.sin(e.t * 5) * 3, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { ctx.fillRect(front - dir * 8 + i * 6 - 1, cy + 100, 2, 6); ctx.fillRect(front - dir * 8 + i * 6 - 1, cy + 118, 2, 6); }
  } else if (id === 'mech_worm') {
    const segs = a.segs as { x: number; y: number }[]; const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = K(c); ctx.fillRect(x, y, w, h); };
    for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; const r = i === segs.length - 1 ? 7 : 10; ctx.fillStyle = K(i % 2 ? '#8a90a8' : '#a6acc4'); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill(); ctx.fillStyle = K('#5a6078'); ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.55, 0, 6.283); ctx.fill(); ctx.fillStyle = (Math.floor(e.t * 4) + i) % 5 === 0 ? '#ff4050' : '#601020'; ctx.fillRect(s.x - 1, s.y - 1, 3, 3); }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a.ang); ctx.fillStyle = K('#b8bed8'); ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); ctx.fill(); R(2, -12, 14, 6, '#6a7088'); R(2, 6, 14, 6, '#6a7088'); R(8, -4, 8, 8, '#300810'); ctx.fillStyle = '#ff3040'; ctx.fillRect(-2, -6, 4, 3); ctx.fillRect(-2, 3, 4, 3); ctx.restore(); glows.push([cx, cy, 38, [255, 50, 70], 0.3]);
  } else if (id === 'lunar') {
    const H = a.hands; const open = !H.L.alive && !H.R.alive;
    for (const k of ['L', 'R'] as const) if (H[k].alive) { ctx.strokeStyle = K('#6a7a9a'); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx + (k === 'L' ? -20 : 20), cy - 6); ctx.quadraticCurveTo(cx + (k === 'L' ? -80 : 80), cy - 10, H[k].x, H[k].y - 10); ctx.stroke(); ctx.fillStyle = K('#8a9ab8'); ctx.beginPath(); ctx.arc(H[k].x, H[k].y, 22, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(H[k].x, H[k].y, 11, 0, 6.283); ctx.fill(); ctx.fillStyle = '#20d0ff'; ctx.beginPath(); ctx.arc(H[k].x + Math.cos(ang) * 3, H[k].y + Math.sin(ang) * 3, 6, 0, 6.283); ctx.fill(); ctx.fillStyle = '#001'; ctx.beginPath(); ctx.arc(H[k].x + Math.cos(ang) * 4, H[k].y + Math.sin(ang) * 4, 2.5, 0, 6.283); ctx.fill(); glows.push([H[k].x, H[k].y, 36, [48, 224, 255], 0.3]); const hpf = H[k].hp / H[k].max; ctx.fillStyle = '#000a'; ctx.fillRect(H[k].x - 20, H[k].y - 32, 40, 4); ctx.fillStyle = '#30e0ff'; ctx.fillRect(H[k].x - 20, H[k].y - 32, 40 * hpf, 4); }
    ctx.fillStyle = K(open ? '#a8b8d8' : '#7a8aa8'); ctx.beginPath(); ctx.ellipse(cx, cy, 36, 40, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = K('#5a6a88'); ctx.beginPath(); ctx.ellipse(cx, cy + 10, 28, 24, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.ellipse(cx, cy - 4, 18, 14, 0, 0, 6.283); ctx.fill();
    if (open) { ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(cx, cy - 4, 11, 0, 6.283); ctx.fill(); ctx.fillStyle = '#20e0ff'; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * 4, cy - 4 + Math.sin(ang) * 4, 7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#001'; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * 5, cy - 4 + Math.sin(ang) * 5, 3, 0, 6.283); ctx.fill(); ctx.fillStyle = '#6affff'; for (let i = 0; i < 5; i++) ctx.fillRect(cx - 20 + i * 9, cy + 22, 3, 8); }
    else { ctx.fillStyle = '#5a6a88'; ctx.fillRect(cx - 18, cy - 6, 36, 4); ctx.strokeStyle = 'rgba(100,230,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 46 + Math.sin(e.t * 4) * 2, 50, 0, 0, 6.283); ctx.stroke(); }
    glows.push([cx, cy, 80, [48, 224, 255], 0.25]);
  }
}
function drawBeam(ctx: CanvasRenderingContext2D, e: Enemy) {
  const b = e.a.beam, cx = e.x + e.w / 2, cy = e.y + e.h / 2; const an = b.ang0 + b.sweep * Math.max(0, b.t / b.dur);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(an);
  if (b.t < 0) { ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 40) * 0.2; ctx.fillStyle = '#80f0ff'; ctx.fillRect(0, -1, 900, 2); }
  else { ctx.globalAlpha = 0.5; ctx.fillStyle = '#20c8ff'; ctx.fillRect(0, -10, 900, 20); ctx.globalAlpha = 1; ctx.fillStyle = '#e8ffff'; ctx.fillRect(0, -4, 900, 8); }
  ctx.restore();
}
function drawProj(ctx: CanvasRenderingContext2D, pr: any) {
  ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.rot);
  switch (pr.kind) {
    case 'parrow': ctx.fillStyle = '#8a5a30'; ctx.fillRect(-6, -1, 10, 2); ctx.fillStyle = pr.fire ? '#ffb030' : '#ddd'; ctx.fillRect(4, -2, 3, 4); ctx.fillStyle = '#eee'; ctx.fillRect(-7, -2, 2, 4); break;
    case 'arrow': ctx.fillStyle = '#8a5a30'; ctx.fillRect(-6, -1, 10, 2); ctx.fillStyle = '#ccc'; ctx.fillRect(4, -2, 3, 4); break;
    case 'bullet': ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-3, -1, 6, 2); break;
    case 'stinger': ctx.fillStyle = '#e8c030'; ctx.fillRect(-4, -1, 8, 2); ctx.fillStyle = '#6a3a10'; ctx.fillRect(2, -1, 2, 2); break;
    case 'laser': ctx.fillStyle = '#ff3050'; ctx.fillRect(-7, -2, 14, 4); ctx.fillStyle = '#ffd0d8'; ctx.fillRect(-5, -1, 10, 2); break;
    case 'spark': case 'frost': case 'star': case 'fallstar': ctx.rotate(pr.t * 8 - pr.rot); ctx.fillStyle = pr.col; ctx.fillRect(-1, -5, 2, 10); ctx.fillRect(-5, -1, 10, 2); ctx.fillRect(-3, -3, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -1, 2, 2); break;
    case 'fireball': case 'bolt': case 'phantom': case 'chaos': case 'skullbolt': ctx.fillStyle = pr.col; ctx.beginPath(); ctx.arc(0, 0, pr.big ? 5 : 4, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 6.283); ctx.fill(); break;
    case 'rainbow': ctx.fillStyle = `hsl(${(pr.t * 700) % 360},100%,65%)`; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.283); ctx.fill(); break;
    case 'skull': ctx.fillStyle = '#e8e4d0'; ctx.fillRect(-4, -4, 8, 6); ctx.fillRect(-3, 2, 6, 2); ctx.fillStyle = '#111'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2); break;
    case 'scythe': ctx.strokeStyle = '#ff4060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 6, 0.3, 4.2); ctx.stroke(); break;
    case 'bomb': ctx.rotate(-pr.rot); ctx.fillStyle = '#2e2e36'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill(); ctx.fillStyle = '#777'; ctx.fillRect(-3, -3, 2, 2); ctx.fillStyle = Math.floor(pr.t * 10) % 2 ? '#ffd040' : '#ff6020'; ctx.fillRect(2, -7, 3, 3); break;
    case 'powder': ctx.rotate(-pr.rot); ctx.fillStyle = '#a0ffb0'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.283); ctx.fill(); break;
    default: ctx.fillStyle = pr.col; ctx.fillRect(-3, -3, 6, 6);
  }
  ctx.restore();
}
function drawWeather(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number, time: number) {
  if (g.ev.rain > 0 && g.world.layer(g.player.x / 16, g.player.y / 16) <= 1) {
    ctx.strokeStyle = 'rgba(120,255,160,0.5)'; ctx.lineWidth = 2 * (g.scale / 2); ctx.beginPath();
    for (let i = 0; i < 70; i++) { const x = ((i * 137.5 + time * 40) % 1) * 0 + ((i * 97) % 100) / 100 * W; const y = (((i * 53) % 100) / 100 * H + time * 600 * (0.8 + (i % 5) * 0.1)) % H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14 * g.scale / 2); }
    ctx.stroke();
  }
}
function drawMinimap(g: Game, ctx: CanvasRenderingContext2D, W: number, _H: number) {
  void _H; const dpr = g.canvas.width / Math.max(1, g.canvas.clientWidth), mw = 190 * dpr, mh = 118 * dpr, mx = W - mw - 12 * dpr, my = 12 * dpr; const p = g.player, w = g.world;
  const tilesW = 110, tilesH = Math.round(tilesW * mh / mw); const ptx = (p.x + p.w / 2) / 16, pty = (p.y + p.h / 2) / 16;
  ctx.save(); ctx.fillStyle = 'rgba(8,10,20,0.85)'; ctx.fillRect(mx, my, mw, mh);
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip(); ctx.imageSmoothingEnabled = false;
  const sx = ptx - tilesW / 2, sy = pty - tilesH / 2; ctx.drawImage(g.mapCanvas, sx, sy, tilesW, tilesH, mx + (-Math.min(0, sx)) * mw / tilesW * 0 + 0, my, mw, mh);
  // markers
  const k = mw / tilesW; const mk = (x: number, y: number, c: string, r: number) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx + (x / 16 - sx) * k, my + (y / 16 - sy) * k, r * dpr, 0, 6.283); ctx.fill(); };
  for (const n of g.npcs) if (n.deadT <= 0) mk(n.x + 6, n.y + 12, '#6aff8a', 2.2);
  if (g.boss) mk(g.boss.x + g.boss.w / 2, g.boss.y + g.boss.h / 2, '#ff4040', 3.5);
  mk(w.spawn.x * 16, w.spawn.y * 16, '#ffd040', 2);
  mk(p.x + 6, p.y + 14, Math.floor(performance.now() / 300) % 2 ? '#ffffff' : '#40a0ff', 2.8);
  ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
}
function drawFullMap(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const w = g.world, p = g.player; ctx.fillStyle = 'rgba(4,6,14,0.92)'; ctx.fillRect(0, 0, W, H);
  const k = Math.min((W * 0.9) / w.W, (H * 0.8) / w.H); const mw = w.W * k, mh = w.H * k, mx = (W - mw) / 2, my = (H - mh) / 2 + 10; ctx.imageSmoothingEnabled = false; ctx.drawImage(g.mapCanvas, mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  const mk = (x: number, y: number, c: string, r: number) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx + x / 16 * k, my + y / 16 * k, r, 0, 6.283); ctx.fill(); };
  for (const n of g.npcs) if (n.deadT <= 0) mk(n.x, n.y, '#6aff8a', 4); mk(w.spawn.x * 16, w.spawn.y * 16, '#ffd040', 4); if (g.boss) mk(g.boss.x, g.boss.y, '#ff4040', 6);
  mk(p.x, p.y, Math.floor(performance.now() / 300) % 2 ? '#fff' : '#40a0ff', 5);
  const hy = my + (HELL_TOP) * k; ctx.strokeStyle = 'rgba(255,80,40,0.5)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(mx, hy); ctx.lineTo(mx + mw, hy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${14 * (g.scale / 2)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('WORLD MAP — press M or Esc to close', W / 2, my - 10);
}
