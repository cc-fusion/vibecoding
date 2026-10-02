import type { Game } from "./engine";
import { GOODS, VTYPES, type ModuleId } from "./data";
import type { Crev } from "./types";

const WALL = 640;
const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
let auroraA = 0;

function wtext(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", alpha = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, -1);
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,10,25,0.7)"; ctx.lineJoin = "round";
  ctx.strokeText(s, 0, 0); ctx.fillStyle = color; ctx.fillText(s, 0, 0);
  ctx.restore();
}

export function render(g: Game) {
  const ctx = g.ctx, W = g.W, H = g.H, dpr = g.dpr, sc = g.sc;
  const shx = g.shake > 0.1 ? (Math.random() - 0.5) * g.shake * 0.9 : 0;
  const shy = g.shake > 0.1 ? (Math.random() - 0.5) * g.shake * 0.9 : 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#b9d6ec"; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * sc, 0, 0, -dpr * sc, dpr * (W / 2 - g.camX * sc + shx), dpr * (H * 0.7 + g.camY * sc + shy));
  const x0 = g.camX - W / 2 / sc - 80, x1 = g.camX + W / 2 / sc + 80;
  const yTop = g.camY + (H * 0.7) / sc + 80, yBot = g.camY - (H * 0.3) / sc - 80;

  // ground
  if (g.pattern) { ctx.fillStyle = g.pattern; ctx.fillRect(x0, yBot, x1 - x0, yTop - yBot); }
  else { ctx.fillStyle = "#cfe6f7"; ctx.fillRect(x0, yBot, x1 - x0, yTop - yBot); }
  drawDrift(g, x0, x1, yBot, yTop);
  drawWalls(g, x0, x1, yBot, yTop);
  drawStation(g, x0, x1, yBot, yTop);

  for (const t of g.thins) {
    if (t.y + t.ry < yBot || t.y - t.ry > yTop || t.x + t.rx < x0 || t.x - t.rx > x1) continue;
    ctx.save(); ctx.translate(t.x, t.y);
    const warn = t.warn > 0 ? 0.25 + 0.2 * Math.sin(g.real * 30) : 0;
    ctx.fillStyle = `rgba(110,190,255,${0.3 + warn})`;
    ctx.beginPath(); ctx.ellipse(0, 0, t.rx, t.ry, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(60,140,220,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + t.x; ctx.beginPath(); ctx.moveTo(Math.cos(a) * t.rx * 0.2, Math.sin(a) * t.ry * 0.2); ctx.lineTo(Math.cos(a + 0.3) * t.rx * 0.8, Math.sin(a + 0.3) * t.ry * 0.8); ctx.stroke(); }
    ctx.restore();
    wtext(ctx, "THIN ICE", t.x, t.y, 13, "rgba(40,100,170,0.9)");
  }

  for (const c of g.crevs) drawCrev(g, c, x0, x1, yBot, yTop);

  for (const a of g.avals) if (!a.done && a.y > yBot - 100 && a.y < yTop + 100) drawAval(g, a);

  for (const s of g.seracs) {
    if (s.y < yBot - 60 || s.y > yTop + 60 || s.x < x0 - 60 || s.x > x1 + 60) continue;
    drawSerac(ctx, s.x, s.y, s.r, s.seed);
  }
  for (const c of g.crates) {
    if (c.taken || c.y < yBot - 40 || c.y > yTop + 40) continue;
    const bob = Math.sin(g.real * 3 + c.bob) * 3;
    const col = { fuel: "255,170,60", food: "255,120,120", planks: "200,150,90", goods: "130,200,255", scrip: "255,220,90" }[c.kind];
    const gr = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 34);
    gr.addColorStop(0, `rgba(${col},0.55)`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#8a6238"; ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 2;
    ctx.fillRect(c.x - 11, c.y - 9 + bob, 22, 18); ctx.strokeRect(c.x - 11, c.y - 9 + bob, 22, 18);
    wtext(ctx, { fuel: "⛽", food: "🍖", planks: "🪵", goods: "📦", scrip: "💰" }[c.kind], c.x, c.y + bob + 1, 15, "#fff");
  }

  // ropes
  ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 3;
  const vs = g.run.vehicles;
  for (let i = 0; i < vs.length - 1; i++) {
    const a = vs[i], b = vs[i + 1];
    const al = vehLen(a.type) / 2, bl = vehLen(b.type) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x - Math.sin(a.ang) * al, a.y - Math.cos(a.ang) * al);
    ctx.lineTo(b.x + Math.sin(b.ang) * bl, b.y + Math.cos(b.ang) * bl); ctx.stroke();
  }
  for (const r of g.raiders) drawRaider(g, r);
  for (let i = vs.length - 1; i >= 0; i--) drawVehicle(g, vs[i], i === 0);
  ctx.lineWidth = 2;
  for (const b of g.bullets) { ctx.strokeStyle = `rgba(255,230,140,${b.life * 10})`; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }

  // particles
  for (const p of g.parts) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 0) { ctx.fillStyle = p.color; ctx.globalAlpha = a * 0.55; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, 6.283); ctx.fill(); }
    else if (p.kind === 1) { ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else { ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, 6.283); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  if (g.mawY > -9000) drawMaw(g, x0, x1, yBot, yTop);

  for (const f of g.floats) {
    const k = f.life / f.max, pop = 1 + 0.5 * Math.max(0, 1 - (f.max - f.life) / 0.18);
    wtext(ctx, f.text, f.x, f.y, f.size * pop, f.color, "center", Math.min(1, k * 2.5));
  }
  drawStuckBars(g);

  // ---------------- screen space overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lx = W / 2 + (g.lead.x - g.camX) * sc + shx, ly = H * 0.7 - (g.lead.y - g.camY) * sc + shy;
  drawLight(g, lx, ly);
  drawAurora(g);
  const vis = g.cur.vis;
  if (vis < 0.97) {
    const inner = (200 + 650 * vis) * sc, outer = inner + 380 * sc;
    const gr = ctx.createRadialGradient(lx, ly, inner, lx, ly, outer);
    gr.addColorStop(0, "rgba(218,234,250,0)"); gr.addColorStop(1, `rgba(218,234,250,${(1 - vis) * 0.95})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  // snow
  const n = Math.min(g.flakes.length, Math.floor(16 + g.cur.snow * 36));
  ctx.fillStyle = "#ffffff";
  const slant = g.windDir * g.cur.wind * 7;
  for (let i = 0; i < n; i++) {
    const f = g.flakes[i];
    ctx.globalAlpha = 0.35 + f.z * 0.5;
    const s = 1 + f.z * 2.2;
    if (g.cur.wind > 0.6) { ctx.fillRect(f.x * W, f.y * H, s * 4 + Math.abs(slant), s * 0.8); }
    else ctx.fillRect(f.x * W, f.y * H, s, s);
  }
  ctx.globalAlpha = 1;
  // vignettes
  const cold = Math.max(0, Math.min(1, (-g.teff - 8) / 20));
  if (cold > 0.05) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, "rgba(120,190,255,0)"); gr.addColorStop(1, `rgba(150,210,255,${cold * 0.35})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (g.mawY > -9000) {
    const gap = g.lead.y - g.mawY, k = Math.max(0, Math.min(1, 1 - gap / 700));
    if (k > 0.02) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
      gr.addColorStop(0, "rgba(255,40,40,0)"); gr.addColorStop(1, `rgba(255,40,60,${k * (0.45 + 0.15 * Math.sin(g.real * 8))})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
  }
  if (g.camping) {
    const gr = ctx.createRadialGradient(lx, ly, 20, lx, ly, 360 * sc);
    gr.addColorStop(0, "rgba(255,170,70,0.28)"); gr.addColorStop(1, "rgba(255,170,70,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (g.quakeT > 0 || g.quakeWarn > 0) {
    ctx.fillStyle = `rgba(255,140,80,${0.05 + 0.04 * Math.sin(g.real * 20)})`; ctx.fillRect(0, 0, W, H);
  }
  const hit = g.run.vehicles[0]?.flash ?? 0;
  if (hit > 0.1) { ctx.fillStyle = `rgba(255,60,60,${hit * 0.22})`; ctx.fillRect(0, 0, W, H); }
}

function vehLen(t: keyof typeof VTYPES) { return t === "crawler" ? 54 : t === "tractor" ? 48 : t === "sled" ? 42 : 48; }

function drawDrift(g: Game, x0: number, x1: number, yBot: number, yTop: number) {
  const ctx = g.ctx, cell = 190;
  ctx.lineWidth = 2; ctx.lineCap = "round";
  const gx0 = Math.floor(x0 / cell), gx1 = Math.ceil(x1 / cell), gy0 = Math.floor(yBot / cell), gy1 = Math.ceil(yTop / cell);
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
    const x = gx * cell + ((gy * 37) % 80), y = gy * cell + ((gx * 53) % 90);
    const dv = Math.sin(x / 260 + y / 1400 + g.wc * 0.08) * (22 + g.leg * 4) + g.cur.wind * g.windDir * 30;
    const len = dv * 1.1;
    const ph = ((g.wc * 0.4 + gx * 0.37 + gy * 0.51) % 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.28 * Math.sin(ph * 3.1416)})`;
    ctx.beginPath(); ctx.moveTo(x + len * (ph - 0.5), y); ctx.lineTo(x + len * (ph + 0.5), y); ctx.stroke();
  }
}

function drawWalls(g: Game, x0: number, x1: number, yBot: number, yTop: number) {
  const ctx = g.ctx;
  for (const side of [-1, 1]) {
    const edge = side * (WALL + 34);
    if (side < 0 ? x0 > edge + 20 : x1 < edge - 20) continue;
    ctx.beginPath();
    const ys = Math.floor(yBot / 40) * 40;
    ctx.moveTo(edge, ys);
    for (let y = ys; y <= yTop + 40; y += 40) ctx.lineTo(edge + side * (16 * Math.sin(y * 0.031) + 11 * Math.sin(y * 0.113)), y);
    ctx.lineTo(side * 3000, yTop + 40); ctx.lineTo(side * 3000, ys); ctx.closePath();
    const gr = ctx.createLinearGradient(edge, 0, edge + side * 260, 0);
    gr.addColorStop(0, "#506378"); gr.addColorStop(1, "#27323f");
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = "rgba(240,250,255,0.85)"; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let y = ys; y <= yTop; y += 40) ctx.fillRect(edge + side * (30 + ((y * 7) % 90)), y, 18, 9);
  }
}

function drawStation(g: Game, x0: number, x1: number, yBot: number, yTop: number) {
  const ctx = g.ctx, L = g.length;
  if (L < yBot - 20 || L > yTop + 600) return;
  // checkered finish
  const sq = 40;
  for (let i = -16; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#111a24" : "#f6fbff";
    ctx.fillRect(i * sq, L - 10, sq, 10); ctx.fillStyle = i % 2 === 0 ? "#f6fbff" : "#111a24"; ctx.fillRect(i * sq, L, sq, 10);
  }
  ctx.fillStyle = "#e8892b"; ctx.fillRect(-WALL, L - 4, 24, 160); ctx.fillRect(WALL - 24, L - 4, 24, 160);
  ctx.fillStyle = "#e8892b"; ctx.fillRect(-WALL, L + 150, WALL * 2, 18);
  wtext(ctx, g.tutorial ? "FINISH" : g.leg >= 5 ? "POLARIS STATION" : "STATION", 0, L + 159, 15, "#2a1400");
  // buildings
  ctx.fillStyle = "#d8e6f2"; ctx.fillRect(x0, L + 10, x1 - x0, 900);
  const rg = (i: number) => ((Math.sin(i * 91.7) * 43758.5453) % 1 + 1) % 1;
  for (let i = -6; i <= 6; i++) {
    const bx = i * 120 + (rg(i) - 0.5) * 30, by = L + 220 + rg(i + 9) * 80, bw = 70 + rg(i + 3) * 40, bh = 60 + rg(i + 5) * 60;
    ctx.fillStyle = "#58687c"; ctx.fillRect(bx - bw / 2, by, bw, bh);
    ctx.fillStyle = "#d9e6f2"; ctx.fillRect(bx - bw / 2 - 4, by + bh, bw + 8, 10);
    ctx.fillStyle = "#ffd98a";
    for (let w = 0; w < 3; w++) ctx.fillRect(bx - bw / 2 + 8 + w * (bw / 3), by + 12, 12, 10);
  }
}

function crevPath(ctx: CanvasRenderingContext2D, c: Crev, wmul = 1) {
  const N = 26, L = c.L;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = -L / 2 + L * t;
    const prof = (c.w / 2) * wmul * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.6);
    const j = 1 + (c.jag[i % c.jag.length] - 0.5) * 0.3;
    if (i === 0) ctx.moveTo(u, prof * j); else ctx.lineTo(u, prof * j);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, u = -L / 2 + L * t;
    const prof = (c.w / 2) * wmul * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.6);
    const j = 1 + (c.jag[(i + 9) % c.jag.length] - 0.5) * 0.3;
    ctx.lineTo(u, -prof * j);
  }
  ctx.closePath();
}

function drawCrev(g: Game, c: Crev, x0: number, x1: number, yBot: number, yTop: number) {
  const ctx = g.ctx;
  const ex = c.ca * c.L / 2, ey = c.sa * c.L / 2;
  const minx = c.x - Math.abs(ex) - 60, maxx = c.x + Math.abs(ex) + 60, miny = c.y - Math.abs(ey) - 60, maxy = c.y + Math.abs(ey) + 60;
  if (maxx < x0 || minx > x1 || maxy < yBot || miny > yTop) return;
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
  if (c.fracture > 0) {
    ctx.strokeStyle = `rgba(255,110,70,${0.45 + 0.4 * Math.sin(g.real * 22)})`; ctx.lineWidth = 4; ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.moveTo(-c.L / 2, 0); ctx.lineTo(c.L / 2, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    wtext(ctx, "⚠ FRACTURE", c.x, c.y + 18, 14, "#ff9d7a");
    return;
  }
  const hiddenUn = c.hidden && !c.revealed;
  if (hiddenUn) {
    crevPath(ctx, c, 0.95);
    ctx.fillStyle = "rgba(245,252,255,0.30)"; ctx.fill();
    ctx.strokeStyle = "rgba(150,190,225,0.28)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 14]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  // soft shadow rim
  crevPath(ctx, c, 1.18); ctx.fillStyle = "rgba(60,110,170,0.35)"; ctx.fill();
  crevPath(ctx, c);
  const gr = ctx.createLinearGradient(0, -c.w / 2, 0, c.w / 2);
  gr.addColorStop(0, "#0d3052"); gr.addColorStop(0.5, "#020a14"); gr.addColorStop(1, "#0a2a48");
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = "#c8efff"; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); crevPath(ctx, c); ctx.clip();
  ctx.fillStyle = "rgba(90,200,255,0.16)";
  for (let i = 0; i < 12; i++) { const u = -c.L / 2 + ((i * 97 + g.wc * 8) % c.L); ctx.fillRect(u, -c.w * 0.3, 3, c.w * 0.6); }
  ctx.restore();
  if (c.hidden) {
    ctx.strokeStyle = "rgba(255,179,71,0.9)"; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); crevPath(ctx, c, 1.12); ctx.stroke(); ctx.setLineDash([]);
  }
  // bridges
  for (const b of c.bridges) {
    if (b.rubble) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = "#cfe9fb"; ctx.strokeStyle = "#7fb3d8"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const ux = b.u + (((i * 53) % 70) - 35), vy = ((i * 31) % 100) / 100 * (c.w + 6) - (c.w + 6) / 2;
        ctx.beginPath(); ctx.arc(ux, vy, 7 + (i % 3) * 3, 0, 6.283); ctx.fill(); ctx.stroke();
      }
      continue;
    }
    if (b.hp <= 0) {
      ctx.fillStyle = "#6b4a2a"; for (let i = 0; i < 5; i++) ctx.fillRect(b.u - 30 + i * 14, -c.w / 2 + (i % 2) * 20, 5, 14);
      continue;
    }
    const hw = b.half * 0.95, ext = (c.w / 2 + 16) * b.built;
    ctx.fillStyle = "#b4824a"; ctx.fillRect(b.u - hw, -ext, hw * 2, ext * 2);
    ctx.strokeStyle = "#6d4a24"; ctx.lineWidth = 1.5;
    for (let u = b.u - hw; u <= b.u + hw; u += 9) { ctx.beginPath(); ctx.moveTo(u, -ext); ctx.lineTo(u, ext); ctx.stroke(); }
    ctx.fillStyle = "#4a3016"; ctx.fillRect(b.u - hw - 3, -ext, 5, ext * 2); ctx.fillRect(b.u + hw - 2, -ext, 5, ext * 2);
    const hpk = b.hp / b.maxhp;
    if (hpk < 0.4) { ctx.fillStyle = `rgba(255,50,40,${0.25 + 0.2 * Math.sin(g.real * 14)})`; ctx.fillRect(b.u - hw, -ext, hw * 2, ext * 2); }
  }
  ctx.restore();
}

function drawSerac(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(30,70,110,0.28)"; ctx.beginPath(); ctx.ellipse(r * 0.35, -r * 0.4, r * 1.1, r * 0.85, 0, 0, 6.283); ctx.fill();
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283, rad = r * (0.8 + 0.35 * Math.abs(Math.sin(seed * 20 + i * 2.3)));
    const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const gr = ctx.createLinearGradient(-r, r, r, -r);
  gr.addColorStop(0, "#7cc4ef"); gr.addColorStop(0.5, "#d8f3ff"); gr.addColorStop(1, "#ffffff");
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = "#5aa6d6"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.1); ctx.lineTo(r * 0.1, r * 0.5); ctx.lineTo(r * 0.4, r * 0.2); ctx.stroke();
  ctx.restore();
}

function drawAval(g: Game, a: Game["avals"][number]) {
  const ctx = g.ctx;
  if (!a.armed) {
    for (const s of [-1, 1]) wtext(ctx, "⚠", s * (WALL - 18), a.y, 20, "#ffb347");
    return;
  }
  const warn = 2.2;
  if (a.t < warn) {
    ctx.fillStyle = `rgba(255,90,60,${0.12 + 0.1 * Math.sin(g.real * 14)})`;
    ctx.fillRect(-WALL, a.y - a.h / 2, WALL * 2, a.h);
    ctx.strokeStyle = "rgba(255,120,80,0.7)"; ctx.setLineDash([20, 14]); ctx.lineWidth = 3;
    ctx.strokeRect(-WALL, a.y - a.h / 2, WALL * 2, a.h); ctx.setLineDash([]);
    wtext(ctx, "AVALANCHE", 0, a.y, 22, "#ff9d7a");
  } else {
    const p = Math.max(0, Math.min(1, (a.t - warn) / 2.2));
    const fx = a.dir > 0 ? -WALL - 100 + (WALL * 2 + 200) * p : WALL + 100 - (WALL * 2 + 200) * p;
    const gr = ctx.createLinearGradient(fx - a.dir * 120, 0, fx + a.dir * 60, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(230,245,255,0.95)");
    ctx.fillStyle = gr;
    const xa = Math.min(fx - a.dir * 120, fx + a.dir * 60), xb = Math.max(fx - a.dir * 120, fx + a.dir * 60);
    ctx.fillRect(xa, a.y - a.h / 2, xb - xa, a.h);
  }
}

function drawMaw(g: Game, x0: number, x1: number, yBot: number, yTop: number) {
  const ctx = g.ctx, my = g.mawY;
  if (my < yBot - 400) { ctx.fillStyle = "#02060c"; ctx.fillRect(x0, yBot, x1 - x0, yTop - yBot); return; }
  if (my > yTop + 100) return;
  const t = g.real;
  ctx.beginPath();
  ctx.moveTo(x0 - 40, yBot - 400);
  const step = 26;
  for (let x = Math.floor(x0 / step) * step - step; x <= x1 + step; x += step) {
    const tooth = (Math.floor(x / step) % 2 === 0 ? 1 : 0) * (26 + 22 * Math.abs(Math.sin(x * 0.07 + t * 1.5)));
    ctx.lineTo(x, my + tooth + 10 * Math.sin(x * 0.03 + t * 3));
  }
  ctx.lineTo(x1 + 60, yBot - 400); ctx.closePath();
  const gr = ctx.createLinearGradient(0, my + 70, 0, my - 380);
  gr.addColorStop(0, "#1a0a1c"); gr.addColorStop(0.15, "#05070f"); gr.addColorStop(1, "#010308");
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = `rgba(120,220,255,${0.75 + 0.25 * Math.sin(t * 6)})`; ctx.stroke();
  ctx.lineWidth = 14; ctx.strokeStyle = "rgba(255,70,90,0.22)"; ctx.stroke();
  // eyes
  const ex = g.camX + Math.sin(t * 0.7) * 160;
  for (const o of [-70, 70]) {
    const rg = ctx.createRadialGradient(ex + o, my - 90, 2, ex + o, my - 90, 46);
    rg.addColorStop(0, "#fff2c0"); rg.addColorStop(0.3, "#ff4a5a"); rg.addColorStop(1, "rgba(255,40,60,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ex + o, my - 90, 46, 0, 6.283); ctx.fill();
  }
  wtext(ctx, "THE MAW", g.camX, my - 180, 28, "#ff7a8a");
}

function drawRaider(g: Game, r: Game["raiders"][number]) {
  const ctx = g.ctx;
  ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(-r.ang);
  ctx.fillStyle = "rgba(20,40,70,0.28)"; ctx.fillRect(-9, -18, 22, 40);
  ctx.fillStyle = "#1c1218"; ctx.fillRect(-14, -18, 6, 36); ctx.fillRect(8, -18, 6, 36);
  ctx.fillStyle = r.flee > 0 ? "#6a4a4a" : "#a62d3a"; ctx.beginPath(); ctx.roundRect(-9, -16, 18, 32, 5); ctx.fill();
  ctx.fillStyle = "#2a1a1a"; ctx.fillRect(-5, 4, 10, 8);
  ctx.fillStyle = "#ffcf5a"; ctx.fillRect(-6, 14, 4, 3); ctx.fillRect(2, 14, 4, 3);
  ctx.restore();
  wtext(ctx, "☠", r.x, r.y + 2, 11, "#fff");
  if (r.hp < r.maxhp) { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(r.x - 14, r.y + 26, 28, 4); ctx.fillStyle = "#ff5d5d"; ctx.fillRect(r.x - 14, r.y + 26, 28 * Math.max(0, r.hp / r.maxhp), 4); }
}

function drawMod(g: Game, id: ModuleId, y: number, vx: number, vy: number) {
  const ctx = g.ctx, t = g.real;
  switch (id) {
    case "turret": {
      let ang = 0, bd = 340;
      for (const r of g.raiders) { const d = Math.hypot(r.x - vx, r.y - vy); if (d < bd) { bd = d; ang = Math.atan2(r.x - vx, r.y - vy); } }
      ctx.fillStyle = "#38424f"; ctx.beginPath(); ctx.arc(0, y, 6, 0, 6.283); ctx.fill();
      ctx.save(); ctx.translate(0, y); ctx.rotate(-(ang - (g.run.vehicles.find((v) => v.x === vx)?.ang ?? 0))); ctx.fillStyle = "#9aa7b8"; ctx.fillRect(-1.5, 0, 3, 12); ctx.restore();
      break;
    }
    case "radar": ctx.fillStyle = "#2d3a48"; ctx.beginPath(); ctx.arc(0, y, 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = "#8ff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Math.cos(t * 4) * 8, y + Math.sin(t * 4) * 8); ctx.stroke(); break;
    case "tank": ctx.fillStyle = "#9db2c6"; ctx.beginPath(); ctx.roundRect(-9, y - 6, 18, 12, 5); ctx.fill(); ctx.fillStyle = "#e8892b"; ctx.fillRect(-9, y - 1, 18, 2); break;
    case "heater": ctx.fillStyle = "#c2562b"; ctx.fillRect(-5, y - 4, 10, 8); ctx.fillStyle = `rgba(255,${150 + Math.sin(t * 9) * 60},60,0.9)`; ctx.beginPath(); ctx.arc(0, y, 2.5, 0, 6.283); ctx.fill(); break;
    case "bridge": ctx.fillStyle = "#b4824a"; for (let i = 0; i < 4; i++) ctx.fillRect(-9, y - 5 + i * 3, 18, 2); break;
    case "turbo": ctx.fillStyle = "#59636f"; ctx.fillRect(-8, y - 3, 5, 8); ctx.fillRect(3, y - 3, 5, 8); ctx.fillStyle = "rgba(90,200,255,0.9)"; ctx.fillRect(-7, y - 5, 3, 2); ctx.fillRect(4, y - 5, 3, 2); break;
    case "rack": ctx.fillStyle = "#7b5c36"; ctx.fillRect(-9, y - 6, 18, 12); ctx.strokeStyle = "#3d2b14"; ctx.strokeRect(-9, y - 6, 18, 12); ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(9, y); ctx.stroke(); break;
    case "anchor": ctx.fillStyle = "#c8d4e0"; ctx.beginPath(); ctx.moveTo(-14, y - 3); ctx.lineTo(-18, y); ctx.lineTo(-14, y + 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, y - 3); ctx.lineTo(18, y); ctx.lineTo(14, y + 3); ctx.fill(); break;
    case "winch": ctx.fillStyle = "#e0b020"; ctx.beginPath(); ctx.roundRect(-8, y - 4, 16, 8, 3); ctx.fill(); ctx.strokeStyle = "#333"; ctx.beginPath(); ctx.moveTo(-4, y - 4); ctx.lineTo(-4, y + 4); ctx.moveTo(0, y - 4); ctx.lineTo(0, y + 4); ctx.moveTo(4, y - 4); ctx.lineTo(4, y + 4); ctx.stroke(); break;
    case "armor": ctx.strokeStyle = "#cfd8e2"; ctx.lineWidth = 2; ctx.strokeRect(-12, y - 6, 24, 12); break;
    default: break;
  }
}

function drawVehicle(g: Game, v: Game["run"]["vehicles"][number], isLead: boolean) {
  const ctx = g.ctx, def = VTYPES[v.type];
  const len = vehLen(v.type), wid = v.type === "crawler" ? 34 : v.type === "tractor" ? 32 : 28;
  const air = v.air >= 0 ? Math.sin(Math.PI * v.air) : 0;
  const tilt = v.stuck > 0 ? Math.sin(g.real * 12) * 0.05 + (v.id % 2 ? 0.22 : -0.22) : 0;
  // shadow
  ctx.save(); ctx.translate(v.x + 5 + air * 12, v.y - 5 - air * 12); ctx.rotate(-v.ang);
  ctx.fillStyle = `rgba(20,50,90,${0.3 - air * 0.1})`; ctx.beginPath(); ctx.roundRect(-wid / 2, -len / 2, wid, len, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(v.x, v.y + air * 16); ctx.rotate(-v.ang + tilt); ctx.scale(1 + air * 0.25, 1 + air * 0.25);
  // tracks
  ctx.fillStyle = "#1b222c";
  ctx.fillRect(-wid / 2 - 1, -len / 2 + 2, 8, len - 4); ctx.fillRect(wid / 2 - 7, -len / 2 + 2, 8, len - 4);
  ctx.strokeStyle = "#3a4656"; ctx.lineWidth = 1;
  const off = (g.leadS * 0.6) % 6;
  for (let y = -len / 2 + 4 + off; y < len / 2 - 2; y += 6) { ctx.beginPath(); ctx.moveTo(-wid / 2 - 1, y); ctx.lineTo(-wid / 2 + 7, y); ctx.moveTo(wid / 2 - 7, y); ctx.lineTo(wid / 2 + 1, y); ctx.stroke(); }
  // body
  const bg = ctx.createLinearGradient(-wid / 2, 0, wid / 2, 0);
  bg.addColorStop(0, shade(def.color, -25)); bg.addColorStop(0.5, shade(def.color, 20)); bg.addColorStop(1, shade(def.color, -25));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-wid / 2 + 4, -len / 2, wid - 8, len, 7); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  if (v.type === "tractor") {
    ctx.fillStyle = "#17324d"; ctx.beginPath(); ctx.roundRect(-8, len / 2 - 20, 16, 11, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(-6, len / 2 - 18, 12, 3);
    ctx.fillStyle = "#2c3440"; ctx.fillRect(-9, -len / 2 + 3, 18, 3);
    ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(-9, len / 2 - 3, 2.5, 0, 6.283); ctx.arc(9, len / 2 - 3, 2.5, 0, 6.283); ctx.fill();
  } else if (v.type === "cabin") {
    ctx.fillStyle = "#ffd98a"; for (let i = 0; i < 3; i++) ctx.fillRect(-6 + (i % 2) * 6, -12 + i * 12, 6, 6);
    ctx.fillStyle = "#4a2a3a"; ctx.fillRect(-3, len / 2 - 9, 6, 6);
  } else if (v.type === "sled") {
    const n = Math.min(4, Math.ceil(g.run.goods.furs * 0 + (g.d.goodsTotal / Math.max(1, g.d.cargoCap)) * 4));
    const cols = ["#e0a060", "#7fe0a0", "#8fd0ff", "#c0c8d8"];
    for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(-7 + (i % 2) * 7, -len / 2 + 6 + Math.floor(i / 2) * 11, 8, 9); }
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.strokeRect(-wid / 2 + 7, -len / 2 + 5, wid - 14, len - 10);
  }
  // modules
  const slots = v.modules.length;
  v.modules.forEach((m, i) => { if (m) drawMod(g, m, -len / 2 + (len * (i + 0.5)) / slots - (v.type === "tractor" ? 6 : 0), v.x, v.y); });
  if (v.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${v.flash * 0.7})`; ctx.beginPath(); ctx.roundRect(-wid / 2 + 4, -len / 2, wid - 8, len, 7); ctx.fill(); }
  ctx.restore();
  if (isLead && g.speed > 8 && !g.camping) {
    // headlight glow on snow
    const gr = ctx.createRadialGradient(v.x + Math.sin(v.ang) * 90, v.y + Math.cos(v.ang) * 90, 5, v.x + Math.sin(v.ang) * 90, v.y + Math.cos(v.ang) * 90, 90);
    gr.addColorStop(0, "rgba(255,246,200,0.16)"); gr.addColorStop(1, "rgba(255,246,200,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(v.x + Math.sin(v.ang) * 90, v.y + Math.cos(v.ang) * 90, 90, 0, 6.283); ctx.fill();
  }
  if (g.camping && isLead) {
    wtext(ctx, "⛺", v.x + 34, v.y + 8, 22, "#fff");
    wtext(ctx, "🔥", v.x + 34, v.y - 12, 16, "#fff");
  }
}

function drawStuckBars(g: Game) {
  const ctx = g.ctx;
  for (const v of g.run.vehicles) {
    if (v.stuck <= 0 || v.stuckMax <= 0) continue;
    const k = 1 - v.stuck / v.stuckMax;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(v.x - 22, v.y + 36, 44, 7);
    ctx.fillStyle = "#ffb347"; ctx.fillRect(v.x - 21, v.y + 37, 42 * k, 5);
    wtext(ctx, "WINCHING", v.x, v.y + 50, 11, "#ffd9a0");
  }
}

function drawLight(g: Game, lx: number, ly: number) {
  const dark = g.dark;
  if (dark < 0.03 && g.cur.vis > 0.9) return;
  const lc = g.light.getContext("2d");
  if (!lc) return;
  const dpr = g.dpr, sc = g.sc;
  const level = Math.min(0.92, dark * 1.5 + (1 - g.cur.vis) * 0.12);
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = "source-over";
  lc.clearRect(0, 0, g.light.width, g.light.height);
  lc.fillStyle = `rgba(4,10,36,${level})`; lc.fillRect(0, 0, g.light.width, g.light.height);
  lc.globalCompositeOperation = "destination-out";
  lc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lead = g.lead;
  // headlight cone
  lc.save(); lc.translate(lx, ly); lc.rotate(lead.ang);
  const R = 520 * sc;
  const cg = lc.createRadialGradient(0, -24 * sc, 10, 0, -24 * sc, R);
  cg.addColorStop(0, "rgba(0,0,0,0.98)"); cg.addColorStop(0.6, "rgba(0,0,0,0.6)"); cg.addColorStop(1, "rgba(0,0,0,0)");
  lc.fillStyle = cg; lc.beginPath(); lc.moveTo(-10 * sc, -20 * sc); lc.lineTo(-190 * sc, -R); lc.lineTo(190 * sc, -R); lc.lineTo(10 * sc, -20 * sc); lc.closePath(); lc.fill();
  lc.restore();
  for (const v of g.run.vehicles) {
    const x = g.W / 2 + (v.x - g.camX) * sc, y = g.H * 0.7 - (v.y - g.camY) * sc;
    const rg = lc.createRadialGradient(x, y, 4, x, y, 90 * sc);
    rg.addColorStop(0, "rgba(0,0,0,0.85)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    lc.fillStyle = rg; lc.beginPath(); lc.arc(x, y, 90 * sc, 0, 6.283); lc.fill();
  }
  if (g.camping) {
    const rg = lc.createRadialGradient(lx, ly, 10, lx, ly, 320 * sc);
    rg.addColorStop(0, "rgba(0,0,0,0.95)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    lc.fillStyle = rg; lc.beginPath(); lc.arc(lx, ly, 320 * sc, 0, 6.283); lc.fill();
  }
  for (const c of g.crates) {
    if (c.taken) continue;
    const x = g.W / 2 + (c.x - g.camX) * sc, y = g.H * 0.7 - (c.y - g.camY) * sc;
    if (x < -50 || x > g.W + 50 || y < -50 || y > g.H + 50) continue;
    const rg = lc.createRadialGradient(x, y, 2, x, y, 40 * sc);
    rg.addColorStop(0, "rgba(0,0,0,0.7)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    lc.fillStyle = rg; lc.beginPath(); lc.arc(x, y, 40 * sc, 0, 6.283); lc.fill();
  }
  lc.globalCompositeOperation = "source-over";
  g.ctx.drawImage(g.light, 0, 0, g.W, g.H);
}

function drawAurora(g: Game) {
  const target = g.wType === "aurora" ? 1 : 0;
  auroraA += (target - auroraA) * 0.02;
  if (auroraA < 0.02) return;
  const ctx = g.ctx, W = g.W, t = g.real;
  ctx.save(); ctx.globalAlpha = auroraA * 0.5; ctx.globalCompositeOperation = "screen";
  for (let b = 0; b < 3; b++) {
    const gr = ctx.createLinearGradient(0, 0, 0, g.H * 0.4);
    gr.addColorStop(0, b === 1 ? "rgba(180,100,255,0)" : "rgba(60,255,160,0)"); gr.addColorStop(0.5, b === 1 ? "rgba(180,100,255,0.55)" : "rgba(60,255,160,0.6)"); gr.addColorStop(1, "rgba(60,255,160,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, g.H * (0.04 + b * 0.05) + Math.sin(x * 0.006 + t * (0.5 + b * 0.2) + b) * 26 + Math.sin(x * 0.015 + t) * 10);
    ctx.lineTo(W, g.H * 0.4); ctx.lineTo(0, g.H * 0.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt)), gg = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${gg},${b})`;
}

export const GOOD_COLORS = Object.fromEntries(Object.entries(GOODS).map(([k, v]) => [k, v.color]));
