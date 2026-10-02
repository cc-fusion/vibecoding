import { COLS, ROWS, T, W, H, SPELLS, ELEMENT_COLOR } from "./data";
import type { Game, Enemy } from "./engine";

const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const TITLE_FONT = '"Cinzel", Georgia, serif';

export function makeTerrain(g: Game): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const x = cv.getContext("2d")!;
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c1424");
  bg.addColorStop(1, "#101a2e");
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const T_ = g.terrain;
  const isFloor = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && T_[r * COLS + c] === 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const n = hash(i);
      const px = c * T, py = r * T;
      if (T_[i] === 0) {
        x.fillStyle = `rgb(${72 + n * 12},${88 + n * 12},${120 + n * 14})`;
        x.fillRect(px, py, T, T);
        if (n > 0.55) {
          x.fillStyle = "rgba(220,235,255,0.07)";
          x.beginPath();
          x.ellipse(px + hash(i + 1) * T, py + hash(i + 2) * T, 7 + n * 5, 3 + n * 3, 0, 0, 6.28);
          x.fill();
        }
        if (n < 0.2) {
          x.fillStyle = "rgba(20,30,50,0.35)";
          x.fillRect(px + hash(i + 3) * (T - 4), py + hash(i + 4) * (T - 4), 3, 2);
        }
        if (n > 0.9) {
          x.fillStyle = "rgba(255,255,255,0.5)";
          x.fillRect(px + hash(i + 5) * T, py + hash(i + 6) * T, 1.5, 1.5);
        }
      } else {
        x.fillStyle = `rgb(${26 + n * 14},${34 + n * 14},${52 + n * 16})`;
        x.fillRect(px, py, T, T);
        x.fillStyle = `rgba(120,140,180,${0.08 + n * 0.12})`;
        x.beginPath();
        x.moveTo(px + hash(i + 7) * T, py);
        x.lineTo(px + T, py + hash(i + 8) * T);
        x.lineTo(px + hash(i + 9) * T, py + T);
        x.closePath();
        x.fill();
        x.fillStyle = "rgba(0,0,0,0.25)";
        x.beginPath();
        x.moveTo(px, py + T);
        x.lineTo(px + hash(i + 10) * T, py + T * 0.4);
        x.lineTo(px + T * 0.5, py + T);
        x.closePath();
        x.fill();
      }
    }
  }
  // edge lighting
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const px = c * T, py = r * T;
      if (T_[r * COLS + c] === 1) {
        x.fillStyle = "rgba(170,195,235,0.35)";
        if (isFloor(c, r + 1)) x.fillRect(px, py + T - 2, T, 2);
        if (isFloor(c, r - 1)) x.fillRect(px, py, T, 2);
        if (isFloor(c + 1, r)) x.fillRect(px + T - 2, py, 2, T);
        if (isFloor(c - 1, r)) x.fillRect(px, py, 2, T);
      } else {
        const sh = (x0: number, y0: number, x1: number, y1: number, w: number, h: number) => {
          const gr = x.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, "rgba(0,0,10,0.38)");
          gr.addColorStop(1, "rgba(0,0,10,0)");
          x.fillStyle = gr;
          x.fillRect(px + (x0 - px > 0 && w < T ? 0 : 0), py, w, h);
        };
        void sh;
        const dark = (rx: number, ry: number, rw: number, rh: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
          const gr = x.createLinearGradient(gx0, gy0, gx1, gy1);
          gr.addColorStop(0, "rgba(0,0,10,0.4)");
          gr.addColorStop(1, "rgba(0,0,10,0)");
          x.fillStyle = gr;
          x.fillRect(rx, ry, rw, rh);
        };
        if (!isFloor(c, r - 1)) dark(px, py, T, 9, px, py, px, py + 9);
        if (!isFloor(c, r + 1)) dark(px, py + T - 9, T, 9, px, py + T, px, py + T - 9);
        if (!isFloor(c - 1, r)) dark(px, py, 9, T, px, py, px + 9, py);
        if (!isFloor(c + 1, r)) dark(px + T - 9, py, 9, T, px + T, py, px + T - 9, py);
      }
    }
  }
  // spawn and gate zones
  x.fillStyle = "rgba(150,30,40,0.3)";
  x.fillRect(0, 0, T * 2, H);
  x.strokeStyle = "rgba(255,120,120,0.35)";
  x.setLineDash([6, 6]);
  x.beginPath();
  x.moveTo(T * 2, 0);
  x.lineTo(T * 2, H);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = "rgba(255,210,120,0.12)";
  x.fillRect(W - T * 2, 0, T * 2, H);
  x.strokeStyle = "rgba(255,230,160,0.3)";
  x.setLineDash([6, 6]);
  x.beginPath();
  x.moveTo(W - T * 2, 0);
  x.lineTo(W - T * 2, H);
  x.stroke();
  x.setLineDash([]);
  return cv;
}

let vignette: HTMLCanvasElement | null = null;
function getVignette() {
  if (vignette) return vignette;
  vignette = document.createElement("canvas");
  vignette.width = W;
  vignette.height = H;
  const x = vignette.getContext("2d")!;
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,8,0.62)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return vignette;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.2832);
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const d = e.def;
  const r = d.r;
  const lift = e.flying ? -16 + Math.sin(e.anim * 5) * 3 : 0;
  const ex = e.x, ey = e.y + lift;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + r * 0.7, r * 0.95, r * 0.4, 0, 0, 6.28);
  ctx.fill();
  if (e.flying) {
    const flap = Math.sin(e.anim * 14) * 0.5;
    ctx.fillStyle = "rgba(160,90,200,0.85)";
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 4, ey + sgn * (r + 12 + flap * 8));
      ctx.lineTo(ex + 8, ey + sgn * (r + 4));
      ctx.closePath();
      ctx.fill();
    }
  }
  if (e.aura || e.type === "warcaller") {
    ctx.strokeStyle = e.type === "warcaller" ? "rgba(255,220,100,0.35)" : "rgba(255,220,100,0.5)";
    ctx.lineWidth = 1.5;
    circle(ctx, ex, ey, r + (e.type === "warcaller" ? 12 + Math.sin(time * 4) * 2 : 4));
    ctx.stroke();
  }
  ctx.fillStyle = d.color;
  circle(ctx, ex, ey, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(10,14,28,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (e.boss) {
    ctx.strokeStyle = e.type === "tyrant" ? ELEMENT_COLOR[e.ward] || "#fff" : "#ff5a5a";
    ctx.lineWidth = 3;
    circle(ctx, ex, ey, r + 4 + Math.sin(time * 5) * 1.5);
    ctx.stroke();
  }
  ctx.font = `${Math.round(r * 1.55)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(d.icon, ex, ey + 1);
  if (e.wet > 0) {
    ctx.fillStyle = "rgba(60,140,255,0.38)";
    circle(ctx, ex, ey, r);
    ctx.fill();
    ctx.fillStyle = "rgba(160,215,255,0.9)";
    ctx.fillRect(ex - r * 0.5, ey - r - 3 + ((time * 20 + e.id * 3) % 6), 1.5, 3);
    ctx.fillRect(ex + r * 0.4, ey - r - 3 + ((time * 17 + e.id) % 6), 1.5, 3);
  }
  if (e.chill > 0) {
    ctx.strokeStyle = "rgba(190,245,255,0.9)";
    ctx.lineWidth = 2;
    circle(ctx, ex, ey, r + 2);
    ctx.stroke();
  }
  if (e.burn > 0) {
    ctx.fillStyle = "rgba(255,120,30,0.28)";
    circle(ctx, ex, ey, r + 2);
    ctx.fill();
  }
  if (e.shock > 0) {
    ctx.strokeStyle = Math.random() < 0.5 ? "#fff6a8" : "#ffd23a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28;
      const rr = r + 3 + Math.random() * 4;
      if (k === 0) ctx.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
      else ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
  }
  if (e.frozen > 0) {
    ctx.fillStyle = "rgba(170,235,255,0.6)";
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    const s = r + 5;
    ctx.beginPath();
    ctx.roundRect(ex - s, ey - s, s * 2, s * 2, 5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(ex - s * 0.5, ey - s * 0.6);
    ctx.lineTo(ex - s * 0.2, ey - s * 0.2);
    ctx.stroke();
  } else if (e.stun > 0) {
    ctx.fillStyle = "#ffe85c";
    for (let k = 0; k < 3; k++) {
      const a = time * 6 + k * 2.1;
      ctx.fillRect(ex + Math.cos(a) * (r * 0.8) - 1.5, ey - r - 5 + Math.sin(a) * 2, 3, 3);
    }
  }
  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.55})`;
    circle(ctx, ex, ey, r);
    ctx.fill();
  }
  if (e.hp < e.maxHp - 0.5 || e.boss) {
    const bw = Math.max(16, r * 2 + 6);
    const by = ey - r - (e.boss ? 14 : 9);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(ex - bw / 2 - 1, by - 1, bw + 2, 5);
    const f = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = f > 0.5 ? "#6be07a" : f > 0.25 ? "#f0c648" : "#ff5a5a";
    ctx.fillRect(ex - bw / 2, by, bw * f, 3);
  }
}

export function renderGame(g: Game) {
  const ctx = g.ctx;
  const v = g.view;
  const t = g.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const s = v.scale * v.dpr;
  const sa = g.shakeAmt * (g.getSettings().shake ?? 1);
  const sx = sa ? (Math.random() - 0.5) * 2 * sa : 0;
  const sy = sa ? (Math.random() - 0.5) * 2 * sa : 0;
  ctx.setTransform(s, 0, 0, s, (v.ox + sx) * v.dpr, (v.oy + sy) * v.dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (g.terrainCanvas) ctx.drawImage(g.terrainCanvas, 0, 0);

  const building = g.tool === "wall" || g.tool === "dig";
  const live = g.phase === "prep" || g.phase === "wave";

  // build overlay: grid + restricted
  if (building && live) {
    ctx.strokeStyle = "rgba(200,220,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * T, 0); ctx.lineTo(c * T, H); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * T); ctx.lineTo(W, r * T); }
    ctx.stroke();
  }

  // path preview
  if (live && (building || g.phase === "prep") && g.spawnRows.length) {
    const sr = g.spawnRows[Math.floor(g.spawnRows.length / 2)];
    let c = 0, r = sr;
    ctx.strokeStyle = "rgba(255,230,140,0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.moveTo((c + 0.5) * T, (r + 0.5) * T);
    const marks: number[][] = [];
    for (let k = 0; k < 120; k++) {
      const n = g.nextTile(c, r);
      if (n < 0) break;
      c = n % COLS;
      r = (n / COLS) | 0;
      ctx.lineTo((c + 0.5) * T, (r + 0.5) * T);
      if (g.wallHp[n] > 0) marks.push([c, r]);
      if (c >= COLS - 1) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,110,110,0.9)";
    ctx.lineWidth = 2;
    for (const [mc, mr] of marks) {
      const cx = (mc + 0.5) * T, cy = (mr + 0.5) * T;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
      ctx.stroke();
    }
  }

  // zones
  for (const z of g.zones) {
    const a = Math.min(1, z.t / 0.25, (z.dur - z.t) / 0.8);
    const col = z.kind === "rain" ? "70,160,255" : z.kind === "blizzard" ? "190,245,255" : "255,120,40";
    const gr = ctx.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
    gr.addColorStop(0, `rgba(${col},${0.3 * a})`);
    gr.addColorStop(1, `rgba(${col},${0.05 * a})`);
    ctx.fillStyle = gr;
    circle(ctx, z.x, z.y, z.r);
    ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.65 * a})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 30;
    circle(ctx, z.x, z.y, z.r);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // rockfall telegraph
  for (const p of g.pend) {
    const k = Math.min(1, p.t / p.delay);
    ctx.fillStyle = `rgba(255,80,50,${0.1 + 0.2 * k})`;
    circle(ctx, p.x, p.y, p.r);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,150,100,0.9)";
    ctx.lineWidth = 2;
    circle(ctx, p.x, p.y, p.r * (1 - k * 0.15));
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,200,0.9)";
    circle(ctx, p.x, p.y, p.r * (1 - k));
    ctx.stroke();
    const hy = p.y - (1 - k) * (1 - k) * 260;
    ctx.fillStyle = "#6a5a48";
    circle(ctx, p.x, hy, 12 + k * 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    circle(ctx, p.x - 4, hy - 4, 5);
    ctx.fill();
  }

  // walls
  const mods = g.mods;
  for (let i = 0; i < g.wallHp.length; i++) {
    const hp = g.wallHp[i];
    if (hp <= 0) continue;
    const c = i % COLS, r = (i / COLS) | 0;
    const x0 = c * T, y0 = r * T;
    const f = Math.max(0, Math.min(1, hp / Math.max(1, g.wallMax[i])));
    const fl = g.wallFlash[i] > 0 ? Math.min(1, g.wallFlash[i] * 2) : 0;
    ctx.fillStyle = `rgb(${Math.round(112 + f * 46 + fl * 90)},${Math.round(118 + f * 46 + fl * 90)},${Math.round(136 + f * 44 + fl * 80)})`;
    ctx.fillRect(x0 + 1, y0 + 1, T - 2, T - 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x0 + 1, y0 + 1, T - 2, 4);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(x0 + 1, y0 + T - 5, T - 2, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 1, y0 + T / 2); ctx.lineTo(x0 + T - 1, y0 + T / 2);
    ctx.moveTo(x0 + T / 3, y0 + 1); ctx.lineTo(x0 + T / 3, y0 + T / 2);
    ctx.moveTo(x0 + (T * 2) / 3, y0 + T / 2); ctx.lineTo(x0 + (T * 2) / 3, y0 + T - 1);
    ctx.stroke();
    if (f < 0.6) {
      ctx.strokeStyle = "rgba(10,10,20,0.7)";
      ctx.beginPath();
      ctx.moveTo(x0 + 6, y0 + 3); ctx.lineTo(x0 + 11, y0 + 13); ctx.lineTo(x0 + 8, y0 + 20);
      if (f < 0.3) { ctx.moveTo(x0 + 22, y0 + 4); ctx.lineTo(x0 + 17, y0 + 14); ctx.lineTo(x0 + 21, y0 + 24); }
      ctx.stroke();
    }
    if (mods.rime) { ctx.strokeStyle = "rgba(190,240,255,0.7)"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 1.5, y0 + 1.5, T - 3, T - 3); }
    if (mods.ember) { ctx.strokeStyle = `rgba(255,${Math.round(120 + Math.sin(t * 5 + i) * 40)},40,0.55)`; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 3.5, y0 + 3.5, T - 7, T - 7); }
    if (mods.pylon) { ctx.fillStyle = `rgba(255,240,120,${0.5 + Math.sin(t * 6 + i) * 0.3})`; ctx.fillRect(x0 + T / 2 - 2, y0 + T / 2 - 2, 4, 4); }
  }

  // gate
  {
    const gs = Math.sin(t * 70) * g.gateShake * 4;
    const gx = W - T * 1.1 + gs;
    const top = g.gateTop * T, bot = (g.gateBot + 1) * T;
    const frac = Math.max(0, Math.min(1, g.gateHp / Math.max(1, g.gateMax)));
    const col = frac > 0.6 ? "110,230,140" : frac > 0.3 ? "240,200,80" : "255,90,90";
    ctx.fillStyle = "#3a3f52";
    ctx.fillRect(gx, top - 12, T * 1.1, 12);
    ctx.fillRect(gx, bot, T * 1.1, 12);
    ctx.fillStyle = "#5a6178";
    ctx.fillRect(gx, top - 12, T * 1.1, 3);
    ctx.fillRect(gx, bot, T * 1.1, 3);
    const gr = ctx.createLinearGradient(gx, 0, gx + T * 1.1, 0);
    gr.addColorStop(0, `rgba(${col},0.05)`);
    gr.addColorStop(1, `rgba(${col},0.55)`);
    ctx.fillStyle = gr;
    ctx.fillRect(gx - 14, top, T * 1.1 + 14, bot - top);
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(gx + T * 0.6, top, T * 0.5, bot - top);
    ctx.strokeStyle = "#8a8f9c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = top + 6; y < bot; y += 12) { ctx.moveTo(gx + T * 0.6, y); ctx.lineTo(gx + T * 1.1, y); }
    ctx.stroke();
    for (const ty of [top - 6, bot + 6]) {
      const fl = 5 + Math.sin(t * 12 + ty) * 1.5;
      ctx.fillStyle = "rgba(255,170,60,0.9)";
      circle(ctx, gx + T * 0.4, ty, fl);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,160,0.9)";
      circle(ctx, gx + T * 0.4, ty, fl * 0.5);
      ctx.fill();
    }
  }

  // enemies (sorted by y)
  const sorted = g.enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of sorted) if (!e.flying) drawEnemy(ctx, e, t);
  for (const e of sorted) if (e.flying) drawEnemy(ctx, e, t);

  // projectiles
  for (const p of g.projs) {
    ctx.fillStyle = "#ffb05a";
    circle(ctx, p.x, p.y, 5);
    ctx.fill();
    ctx.fillStyle = "#fff0b0";
    circle(ctx, p.x, p.y, 2.5);
    ctx.fill();
  }

  // particles
  for (const p of g.parts) {
    const k = Math.max(0, p.life / p.max);
    ctx.globalAlpha = Math.min(1, k * 1.4);
    if (p.kind === 0) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.kind === 1) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * k + 0.5;
      circle(ctx, p.x, p.y, p.size * (1 - k * k));
      ctx.stroke();
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.min(2.5, p.size / 3 + 0.8);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // bolts
  for (const b of g.bolts) {
    const k = Math.max(0, b.life / b.max);
    ctx.lineJoin = "round";
    ctx.beginPath();
    b.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.35 * k;
    ctx.lineWidth = b.width * 3.5;
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = b.width * 0.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // weather overlay
  const w = g.weather;
  if (w === "rain") { ctx.fillStyle = "rgba(15,35,80,0.2)"; ctx.fillRect(0, 0, W, H); }
  else if (w === "snow") { ctx.fillStyle = "rgba(200,225,255,0.06)"; ctx.fillRect(0, 0, W, H); }
  else if (w === "ember") { ctx.fillStyle = "rgba(255,80,20,0.08)"; ctx.fillRect(0, 0, W, H); }
  else if (w === "gale") { ctx.fillStyle = "rgba(90,200,160,0.05)"; ctx.fillRect(0, 0, W, H); }
  for (const p of g.wp) {
    if (w === "rain") {
      ctx.strokeStyle = "rgba(170,205,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 14); ctx.stroke();
    } else if (w === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(p.x, p.y, 1.5 + p.s * 1.5, 1.5 + p.s * 1.5);
    } else if (w === "ember") {
      ctx.fillStyle = `rgba(255,${Math.round(120 + p.s * 90)},40,0.8)`;
      ctx.fillRect(p.x, p.y, 2, 2);
    } else if (w === "gale") {
      ctx.strokeStyle = "rgba(210,255,225,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 18 + p.v * 26, p.y); ctx.stroke();
    } else if (p.s > 0.7) {
      ctx.fillStyle = `rgba(200,220,255,${0.15 + 0.2 * Math.sin(t * 2 + p.s * 30)})`;
      ctx.fillRect(p.x, p.y, 1.5, 1.5);
    }
  }
  if (g.tempestT > 0) {
    ctx.fillStyle = `rgba(40,20,90,${0.22 + 0.08 * Math.sin(t * 8)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(getVignette(), 0, 0);

  // cursor
  if (g.mouseIn && live) {
    const mx = g.mx, my = g.my;
    if (building) {
      const c = Math.floor(mx / T), r = Math.floor(my / T);
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) {
        const i = r * COLS + c;
        let col = "rgba(255,100,100,0.4)";
        if (g.tool === "wall") {
          if (g.buildable(c, r)) {
            if (g.wallHp[i] > 0) col = g.wallHp[i] < g.wallMax[i] * 0.98 ? "rgba(120,200,255,0.45)" : "rgba(255,255,255,0.2)";
            else col = g.stone >= g.wallCost() ? "rgba(120,255,160,0.4)" : "rgba(255,200,100,0.4)";
          }
        } else if (g.wallHp[i] > 0) col = "rgba(255,120,80,0.5)";
        ctx.fillStyle = col;
        ctx.fillRect(c * T, r * T, T, T);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c * T + 0.5, r * T + 0.5, T - 1, T - 1);
      }
    } else {
      const def = SPELLS.find((sp) => sp.id === g.tool);
      if (def) {
        const rad = g.spellRadius(def.id);
        const ready = (g.cd[def.id] || 0) <= 0 && g.mana >= g.spellCost(def.id);
        ctx.fillStyle = def.color + (ready ? "22" : "0c");
        circle(ctx, mx, my, rad);
        ctx.fill();
        ctx.strokeStyle = def.color + (ready ? "dd" : "55");
        ctx.lineWidth = 2;
        ctx.setLineDash(def.id === "rockfall" ? [5, 5] : []);
        circle(ctx, mx, my, rad);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(mx - 6, my); ctx.lineTo(mx + 6, my);
        ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my + 6);
        ctx.stroke();
      }
    }
  }

  // flash
  if (g.flash > 0.01) {
    ctx.fillStyle = `rgba(235,242,255,${Math.min(0.7, g.flash * 0.55)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // floating texts
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of g.texts) {
    const k = f.life / f.max;
    const pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
    ctx.globalAlpha = Math.min(1, k * 2.2);
    ctx.font = `800 ${Math.round(f.size * pop)}px Inter, system-ui, sans-serif`;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(5,8,20,0.9)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // banner
  if (g.banner) {
    const b = g.banner;
    const a = Math.min(1, b.t / 0.7);
    const y = H * 0.3 - (1 - a) * 12;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(4,8,20,0.55)";
    ctx.fillRect(0, y - 48, W, 100);
    ctx.font = `900 46px ${TITLE_FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(b.text, W / 2, y - 6);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, W / 2, y - 6);
    ctx.font = `600 17px Inter, sans-serif`;
    ctx.fillStyle = "#dbe7ff";
    ctx.fillText(b.sub, W / 2, y + 28);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
