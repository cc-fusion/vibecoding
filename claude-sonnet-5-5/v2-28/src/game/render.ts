import { COLS, ROWS, CELL, W, H, PESTS, CROP_TYPES, SPELLS, STRUCTS } from "./data";
import type { Crop, Struct, Pest, Cloud } from "./data";
import type { Game } from "./engine";

const TAU = Math.PI * 2;

export function render(g: Game) {
  const ctx = g.ctx;
  const cv = g.canvas;
  const v = g.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b1712";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const sx = g.shake > 0 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  ctx.setTransform(v.scale, 0, 0, v.scale, v.ox + sx * v.scale, v.oy + sy * v.scale);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  drawGround(g);
  drawFire(g);
  for (const z of g.zones) drawZone(g, z.x, z.y, z.r, z.kind, z.life / z.max);
  for (const s of g.structs) if (s.id === "lamp" || s.id === "spire") drawAura(g, s);
  for (const cr of g.crops) drawCrop(g, cr);
  for (const s of g.structs) drawStruct(g, s);
  const ground = g.pests.filter((p) => !PESTS[p.kind].fly).sort((a, b) => a.y - b.y);
  for (const p of ground) drawPest(g, p);
  drawWindStreaks(g);
  drawSteam(g);
  const air = g.pests.filter((p) => PESTS[p.kind].fly).sort((a, b) => a.y - b.y);
  for (const p of air) drawPest(g, p);
  for (const c of g.clouds) drawCloud(g, c);
  drawParticles(g);
  drawArcs(g);
  drawCursor(g);
  drawTexts(g);
  // atmosphere
  const night = 1 - g.day();
  if (night > 0.02) {
    ctx.fillStyle = `rgba(8,16,56,${night * 0.38})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.event && g.event.kind === "heatwave") {
    ctx.fillStyle = "rgba(255,140,40,0.08)";
    ctx.fillRect(0, 0, W, H);
  }
  if (g.event && g.event.kind === "coldsnap") {
    ctx.fillStyle = "rgba(120,180,255,0.1)";
    ctx.fillRect(0, 0, W, H);
  }
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,255,225,${Math.min(0.6, g.flash * 0.6)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  drawBanner(g);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(v.ox, v.oy, W * v.scale, H * v.scale);
}

function drawGround(g: Game) {
  const ctx = g.ctx;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const isCrop = g.cropAt[i] >= 0;
      let R: number, G: number, B: number;
      if (isCrop) {
        R = 112;
        G = 80;
        B = 52;
      } else {
        const k = (c + r) & 1;
        R = k ? 82 : 88;
        G = k ? 124 : 130;
        B = k ? 58 : 62;
      }
      const fu = g.fuel[i];
      if (fu < 1 && !isCrop) {
        const m = (1 - fu) * 0.8;
        R += (48 - R) * m;
        G += (40 - G) * m;
        B += (32 - B) * m;
      }
      const w = g.wet[i];
      if (w > 0.02) {
        const m = Math.min(0.55, w * 0.55);
        R += (38 - R) * m;
        G += (84 - G) * m;
        B += (104 - B) * m;
        if (w > 0.6) {
          const m2 = (w - 0.6) * 0.7;
          R += (90 - R) * m2;
          G += (72 - G) * m2;
          B += (50 - B) * m2;
        }
      }
      const t = g.temp[i];
      if (t > 0.62) {
        const m = (t - 0.62) * 1.1;
        R += (205 - R) * m;
        G += (160 - G) * m;
        B += (70 - B) * m;
      } else if (t < 0.38) {
        const m = (0.38 - t) * 1.3;
        R += (110 - R) * m;
        G += (160 - G) * m;
        B += (215 - B) * m;
      }
      const ic = g.ice[i];
      if (ic > 0.02) {
        const m = Math.min(0.9, ic * 1.1);
        R += (225 - R) * m;
        G += (243 - G) * m;
        B += (255 - B) * m;
      }
      ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      ctx.fillRect(c * CELL, r * CELL, CELL + 0.6, CELL + 0.6);
      if (isCrop) {
        ctx.fillStyle = "rgba(40,25,10,0.18)";
        for (let k = 0; k < 3; k++) ctx.fillRect(c * CELL + 4, r * CELL + 10 + k * 14, CELL - 8, 2);
      }
      if (ic > 0.4) {
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c * CELL + 8, r * CELL + 14);
        ctx.lineTo(c * CELL + 22, r * CELL + 6);
        ctx.moveTo(c * CELL + 26, r * CELL + 40);
        ctx.lineTo(c * CELL + 40, r * CELL + 28);
        ctx.stroke();
      }
      const ch = g.charge[i];
      if (ch > 0.02) {
        ctx.fillStyle = `rgba(255,250,170,${ch * 0.55})`;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  // grass tufts
  ctx.strokeStyle = "rgba(30,70,30,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const x = (i * 97.3) % W;
    const y = (i * 53.7 + 11) % H;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (g.cropAt[r * COLS + c] >= 0) continue;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 5);
  }
  ctx.stroke();
}

function drawFire(g: Game) {
  const ctx = g.ctx;
  const t = g.time;
  for (let i = 0; i < g.N; i++) {
    const f = g.fire[i];
    if (f <= 0) continue;
    const cx = (i % COLS) * CELL + CELL / 2;
    const cy = Math.floor(i / COLS) * CELL + CELL / 2;
    ctx.fillStyle = `rgba(255,120,30,${0.18 + f * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 9 + Math.sin(t * 9 + i + k * 2) * 3;
      const h = (12 + f * 20) * (0.75 + 0.25 * Math.sin(t * 13 + k * 1.7 + i));
      ctx.fillStyle = k % 2 ? "#ffb02e" : "#ff6a1a";
      ctx.beginPath();
      ctx.moveTo(cx + ox - 6, cy + 14);
      ctx.quadraticCurveTo(cx + ox - 4, cy + 14 - h * 0.5, cx + ox + Math.sin(t * 8 + k) * 3, cy + 14 - h);
      ctx.quadraticCurveTo(cx + ox + 4, cy + 14 - h * 0.5, cx + ox + 6, cy + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + 12, 2.5, h * 0.3, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function drawSteam(g: Game) {
  const ctx = g.ctx;
  for (let i = 0; i < g.N; i++) {
    const s = g.steam[i];
    if (s < 0.05) continue;
    const cx = (i % COLS) * CELL + CELL / 2 + Math.sin(g.time * 1.3 + i) * 5;
    const cy = Math.floor(i / COLS) * CELL + CELL / 2 + Math.cos(g.time * 1.1 + i * 2) * 4;
    ctx.fillStyle = `rgba(240,246,255,${Math.min(0.55, s * 0.45)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + s * 12, 0, TAU);
    ctx.fill();
  }
}

function drawWindStreaks(g: Game) {
  const ctx = g.ctx;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < g.N; i++) {
    const vx = g.wx[i];
    const vy = g.wy[i];
    const sp = Math.hypot(vx, vy);
    if (sp < 40) continue;
    const cx = (i % COLS) * CELL + CELL / 2;
    const cy = Math.floor(i / COLS) * CELL + CELL / 2;
    const l = Math.min(26, sp * 0.1);
    const ux = vx / sp;
    const uy = vy / sp;
    const ph = (g.time * 3 + i * 0.37) % 1;
    ctx.strokeStyle = `rgba(230,255,245,${Math.min(0.5, sp / 500)})`;
    for (let k = -1; k <= 1; k += 2) {
      const ox = cx - uy * k * 9 + ux * (ph - 0.5) * 30;
      const oy = cy + ux * k * 9 + uy * (ph - 0.5) * 30;
      ctx.beginPath();
      ctx.moveTo(ox - ux * l, oy - uy * l);
      ctx.lineTo(ox + ux * l, oy + uy * l);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
}

function drawZone(g: Game, x: number, y: number, r: number, kind: "heat" | "frost", f: number) {
  const ctx = g.ctx;
  const pulse = 0.85 + 0.15 * Math.sin(g.time * 6);
  const gr = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  if (kind === "heat") {
    gr.addColorStop(0, `rgba(255,140,40,${0.32 * f * pulse})`);
    gr.addColorStop(1, "rgba(255,90,20,0)");
  } else {
    gr.addColorStop(0, `rgba(160,225,255,${0.34 * f * pulse})`);
    gr.addColorStop(1, "rgba(120,200,255,0)");
  }
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawAura(g: Game, s: Struct) {
  const r = s.id === "lamp" ? CELL * (1.6 + 0.3 * s.lvl) : CELL * (1.8 + 0.3 * s.lvl);
  drawZone(g, s.x, s.y, r, s.id === "lamp" ? "heat" : "frost", 0.7);
}

function bar(g: Game, x: number, y: number, w: number, f: number, col: string) {
  const ctx = g.ctx;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), 3);
}

function drawCrop(g: Game, cr: Crop) {
  const ctx = g.ctx;
  const { x, y } = cr;
  if (!cr.alive) {
    ctx.strokeStyle = "#5a4630";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * 8, y + 10);
      ctx.lineTo(x + k * 8 + 4, y - 2);
    }
    ctx.stroke();
    if (g.gold >= 25 && g.tool === null) {
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd75e";
      ctx.fillText("25g", x, y - 8 + Math.sin(g.time * 4) * 2);
    }
    return;
  }
  const gs = 0.3 + 0.7 * cr.growth;
  const type = cr.type;
  const sway = Math.sin(g.time * 2 + cr.i) * 1.5 + (g.gw.x + g.wx[cr.i]) * 0.03;
  if (type === 0) {
    for (let k = -2; k <= 2; k++) {
      ctx.strokeStyle = cr.growth > 0.8 ? "#d8b44a" : "#8fbf4a";
      ctx.lineWidth = 2;
      const hx = x + k * 5 + sway;
      const hy = y + 12 - 22 * gs;
      ctx.beginPath();
      ctx.moveTo(x + k * 5, y + 13);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      if (cr.growth > 0.45) {
        ctx.fillStyle = "#e8c25a";
        ctx.beginPath();
        ctx.ellipse(hx, hy - 2, 2.2, 5 * gs, 0, 0, TAU);
        ctx.fill();
      }
    }
  } else if (type === 1) {
    ctx.fillStyle = "#4f9a43";
    ctx.beginPath();
    ctx.arc(x, y + 3, 14 * gs, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7fcf6a";
    ctx.beginPath();
    ctx.arc(x + sway * 0.3, y + 2, 10 * gs, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#b8ec9a";
    ctx.beginPath();
    ctx.arc(x, y + 1, 5 * gs, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = "#3f7a34";
    ctx.beginPath();
    ctx.ellipse(x - 9, y + 4, 8 * gs, 4 * gs, -0.5, 0, TAU);
    ctx.ellipse(x + 9, y + 4, 8 * gs, 4 * gs, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = cr.growth > 0.6 ? "#f08a2a" : "#b8a83a";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 12 * gs, 9 * gs, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,50,0,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 5 * gs, 9 * gs, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#4a6a2a";
    ctx.fillRect(x - 1.5, y - 6 * gs, 3, 5);
  }
  if (cr.flash > 0) {
    ctx.fillStyle = `rgba(255,80,60,${Math.min(0.4, cr.flash * 2)})`;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, TAU);
    ctx.fill();
  }
  if (cr.hp < cr.maxhp - 0.5) bar(g, x, y - 22, 28, cr.hp / cr.maxhp, cr.hp / cr.maxhp > 0.4 ? "#7fd85a" : "#ff6a5a");
  const w = g.wet[cr.i];
  const t = g.temp[cr.i];
  ctx.font = "11px serif";
  ctx.textAlign = "center";
  if (w < 0.08 && cr.thirst > 2 && Math.floor(g.time * 2) % 2 === 0) ctx.fillText("💧", x + 14, y - 12);
  if (t < 0.22) ctx.fillText("❄️", x - 14, y - 12);
  else if (t > 0.88) ctx.fillText("🔥", x - 14, y - 12);
  if (cr.growth > 0.02 && cr.growth < 1) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 12, y + 18, 24, 3);
    ctx.fillStyle = CROP_TYPES[cr.type].color;
    ctx.fillRect(x - 12, y + 18, 24 * cr.growth, 3);
  }
}

function structRange(g: Game, id: string, lvl: number) {
  if (id === "sprinkler") return CELL * (1.5 + 0.3 * lvl);
  if (id === "rod") return CELL * (3.6 + 0.5 * lvl) * (g.perks.rodMul > 1 ? 1.2 : 1);
  if (id === "lamp") return CELL * (1.6 + 0.3 * lvl);
  if (id === "spire") return CELL * (1.8 + 0.3 * lvl);
  return 0;
}

function drawStruct(g: Game, s: Struct) {
  const ctx = g.ctx;
  const { x, y } = s;
  const sel = g.selStruct === s;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 15, 6, 0, 0, TAU);
  ctx.fill();
  if (sel) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, TAU);
    ctx.stroke();
    const r = structRange(g, s.id, s.lvl);
    if (r) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  if (s.id === "sprinkler") {
    ctx.fillStyle = "#3b6ea8";
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 6, 22, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#7fbfff";
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.quadraticCurveTo(x + 10, y - 6, x, y - 3);
    ctx.quadraticCurveTo(x - 10, y - 6, x, y - 20);
    ctx.fill();
  } else if (s.id === "rod") {
    ctx.strokeStyle = "#8a93a0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.fillStyle = "#4a5260";
    ctx.fillRect(x - 9, y + 12, 18, 5);
    const ready = s.cd < 0.6 || s.charge > 0;
    const glow = ready ? 0.6 + 0.4 * Math.sin(g.time * 10) : 0.15;
    ctx.fillStyle = `rgba(255,228,94,${glow})`;
    ctx.beginPath();
    ctx.arc(x, y - 20, 7 + s.charge * 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffe45e";
    ctx.beginPath();
    ctx.arc(x, y - 20, 3.5, 0, TAU);
    ctx.fill();
  } else if (s.id === "fan") {
    ctx.fillStyle = "#4a5a52";
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#bfe9d8";
    for (let k = 0; k < 4; k++) {
      const a = s.spin + (k * TAU) / 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.ellipse(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 8, 3.5, a, 0, TAU);
      ctx.fill();
    }
    const dx = [1, 0, -1, 0][s.dir];
    const dy = [0, 1, 0, -1][s.dir];
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + dx * 18, y + dy * 18);
    ctx.lineTo(x + dx * 28, y + dy * 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx * 32, y + dy * 32);
    ctx.lineTo(x + dx * 24 - dy * 5, y + dy * 24 + dx * 5);
    ctx.lineTo(x + dx * 24 + dy * 5, y + dy * 24 - dx * 5);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
  } else if (s.id === "lamp") {
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x, y - 6);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,170,60,${0.5 + 0.2 * Math.sin(g.time * 5)})`;
    ctx.beginPath();
    ctx.arc(x, y - 10, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffb34a";
    ctx.beginPath();
    ctx.arc(x, y - 10, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff0b0";
    ctx.beginPath();
    ctx.arc(x, y - 10, 3.5, 0, TAU);
    ctx.fill();
  } else if (s.id === "spire") {
    ctx.fillStyle = "#7fd0f0";
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x + 11, y + 4);
    ctx.lineTo(x + 5, y + 16);
    ctx.lineTo(x - 5, y + 16);
    ctx.lineTo(x - 11, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x + 3, y + 10);
    ctx.lineTo(x - 6, y + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#ffe45e";
  for (let k = 0; k < s.lvl; k++) {
    ctx.beginPath();
    ctx.arc(x - (s.lvl - 1) * 4 + k * 8, y + 22, 2.4, 0, TAU);
    ctx.fill();
  }
}

function drawPest(g: Game, p: Pest) {
  const ctx = g.ctx;
  const d = PESTS[p.kind];
  const flying = d.fly && p.soak <= 0;
  const size = d.r * 2.3 + (d.boss ? 10 : 4);
  const bob = flying ? Math.sin(p.bob) * 2.5 : Math.sin(p.bob * 1.4) * 0.8;
  const yy = p.y - (flying ? 12 : 0) + bob;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + d.r * 0.7, d.r * (flying ? 0.7 : 1), d.r * 0.38, 0, 0, TAU);
  ctx.fill();
  if (d.burrow && !p.exposed) {
    ctx.fillStyle = "#6b4a2a";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 13, 7, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = "#86603a";
    ctx.beginPath();
    ctx.ellipse(p.x - 2, p.y + 2, 7, 4, 0, Math.PI, TAU);
    ctx.fill();
    if (Math.random() < 0.15) g.burst(p.x, p.y + 4, 1, "#8a6a44", 30, 0.4, 2, 60);
    return;
  }
  if (p.burn > 0) {
    ctx.fillStyle = `rgba(255,120,30,${0.35 + 0.15 * Math.sin(g.time * 20)})`;
    ctx.beginPath();
    ctx.arc(p.x, yy, size * 0.62, 0, TAU);
    ctx.fill();
  }
  if (d.boss && p.phase === 2) {
    ctx.fillStyle = `rgba(255,50,40,${0.2 + 0.12 * Math.sin(g.time * 8)})`;
    ctx.beginPath();
    ctx.arc(p.x, yy, size * 0.75, 0, TAU);
    ctx.fill();
  }
  if (p.kind === "raven") {
    const fl = Math.sin(g.time * 18 + p.id) * 0.8;
    ctx.fillStyle = "#1c1a26";
    ctx.beginPath();
    ctx.ellipse(p.x, yy, 11, 7, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x - 3, yy);
    ctx.lineTo(p.x - 20, yy - 12 * fl - 3);
    ctx.lineTo(p.x + 4, yy - 2);
    ctx.moveTo(p.x - 3, yy);
    ctx.lineTo(p.x - 20, yy + 12 * fl + 4);
    ctx.lineTo(p.x + 4, yy + 2);
    ctx.fill();
    ctx.fillStyle = "#3b3550";
    ctx.beginPath();
    ctx.arc(p.x + 9, yy - 3, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e8b83a";
    ctx.beginPath();
    ctx.moveTo(p.x + 13, yy - 4);
    ctx.lineTo(p.x + 20, yy - 2);
    ctx.lineTo(p.x + 13, yy - 1);
    ctx.fill();
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(p.x + 10, yy - 4, 1.4, 0, TAU);
    ctx.fill();
  } else {
    ctx.font = `${size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.emoji, p.x, yy);
    if (p.kind === "queen") {
      ctx.font = "26px serif";
      ctx.fillText("👑", p.x, yy - size * 0.55);
    }
    ctx.textBaseline = "alphabetic";
  }
  if (p.hit > 0) {
    ctx.fillStyle = `rgba(255,255,255,${p.hit * 0.55})`;
    ctx.beginPath();
    ctx.arc(p.x, yy, size * 0.45, 0, TAU);
    ctx.fill();
  }
  if (p.chill > 0.05 && p.frozen <= 0) {
    ctx.strokeStyle = `rgba(150,220,255,${0.3 + p.chill * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, yy, size * 0.55, 0, TAU * p.chill);
    ctx.stroke();
  }
  if (p.frozen > 0) {
    ctx.fillStyle = "rgba(160,225,255,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(p.x - size * 0.55, yy - size * 0.55, size * 1.1, size * 1.1, 6);
    ctx.fill();
    ctx.stroke();
  }
  if (d.fly && p.soak > 0) {
    ctx.fillStyle = "rgba(90,170,255,0.8)";
    ctx.beginPath();
    ctx.arc(p.x - 5, yy - size * 0.5 + (g.time * 20) % 6, 1.8, 0, TAU);
    ctx.arc(p.x + 5, yy - size * 0.5 + ((g.time * 20 + 3) % 6), 1.8, 0, TAU);
    ctx.fill();
  }
  if (p.hp < p.maxhp - 0.5 || d.boss) bar(g, p.x, yy - size * 0.62 - 6, Math.max(18, size * 0.9), p.hp / p.maxhp, d.boss ? "#ff8a4a" : "#ff6a5a");
}

function drawCloud(g: Game, c: Cloud) {
  const ctx = g.ctx;
  const fade = Math.min(1, c.life / 1.2, (c.max - c.life) / 0.6 + 0.2);
  const storm = c.kind === "storm";
  const hail = c.kind === "hail";
  const base = storm ? [90, 80, 120] : hail ? [200, 225, 240] : [140, 160, 185];
  ctx.globalAlpha = 0.14 * fade;
  ctx.fillStyle = storm ? "#9a80ff" : hail ? "#cfeaff" : "#5aa9ff";
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.9 * fade;
  const fl = c.flash;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + c.seed;
    const rr = c.r * (0.35 + 0.25 * ((k * 37) % 5) / 5);
    const px = c.x + Math.cos(a) * rr * 0.9 + Math.sin(g.time * 0.8 + k) * 3;
    const py = c.y + Math.sin(a) * rr * 0.6 - 14;
    const R = Math.min(255, base[0] + fl * 150);
    const G = Math.min(255, base[1] + fl * 150);
    const B = Math.min(255, base[2] + fl * 120);
    ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
    ctx.beginPath();
    ctx.arc(px, py, c.r * 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = storm ? "rgb(70,60,100)" : hail ? "rgb(220,238,250)" : "rgb(160,178,200)";
  ctx.beginPath();
  ctx.arc(c.x, c.y - 16, c.r * 0.42, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (storm) {
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡", c.x, c.y - 10);
  } else if (hail) {
    ctx.font = "14px serif";
    ctx.textAlign = "center";
    ctx.fillText("❄️", c.x, c.y - 10);
  }
}

function drawParticles(g: Game) {
  const ctx = g.ctx;
  for (const p of g.parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    if (p.kind === 0) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU);
      ctx.fill();
    } else if (p.kind === 1) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.stroke();
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - a * 0.9) + 4, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawArcs(g: Game) {
  const ctx = g.ctx;
  ctx.lineJoin = "round";
  for (const a of g.arcs) {
    const f = Math.max(0, a.life / a.max);
    ctx.globalAlpha = f * 0.5;
    ctx.strokeStyle = "#ffe45e";
    ctx.lineWidth = a.w * 3.5;
    path(ctx, a.pts);
    ctx.globalAlpha = f;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = a.w;
    path(ctx, a.pts);
  }
  ctx.globalAlpha = 1;
}

function path(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function drawTexts(g: Game) {
  const ctx = g.ctx;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const t of g.texts) {
    const age = t.max - t.life;
    const sc = 1 + Math.max(0, 0.25 - age) * 2.4;
    ctx.globalAlpha = Math.min(1, t.life / 0.4);
    ctx.font = `bold ${Math.round(t.size * sc)}px system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawBanner(g: Game) {
  if (g.bannerT <= 0) return;
  const ctx = g.ctx;
  const a = Math.min(1, g.bannerT / 0.5);
  const age = Math.min(1, (2.6 - g.bannerT) / 0.35);
  const sc = 0.7 + 0.3 * (1 - Math.pow(1 - Math.max(0, age), 3));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(sc, sc);
  ctx.font = "900 46px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineJoin = "round";
  ctx.strokeText(g.banner, 0, 0);
  ctx.fillStyle = "#fff4c2";
  ctx.fillText(g.banner, 0, 0);
  ctx.restore();
}

function drawCursor(g: Game) {
  if (!g.mouseIn || g.paused || g.over) return;
  const ctx = g.ctx;
  const { x, y } = g.mouse;
  const tool = g.tool;
  if (g.padActive) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }
  if (!tool) return;
  const spell = SPELLS.find((s) => s.id === tool);
  if (spell) {
    const afford = g.mana >= spell.cost && g.cd[spell.id] <= 0;
    ctx.globalAlpha = afford ? 0.9 : 0.35;
    ctx.strokeStyle = spell.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    if (tool === "wind") {
      const d = g.drag;
      if (d) {
        const dx = x - d.x;
        const dy = y - d.y;
        const l = Math.hypot(dx, dy);
        ctx.setLineDash([]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (l > 8) {
          const ux = dx / l;
          const uy = dy / l;
          ctx.beginPath();
          ctx.moveTo(x + ux * 12, y + uy * 12);
          ctx.lineTo(x - uy * 8, y + ux * 8);
          ctx.lineTo(x + uy * 8, y - ux * 8);
          ctx.closePath();
          ctx.fillStyle = spell.color;
          ctx.fill();
        }
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(d.x, d.y, CELL * 1.5, 0, TAU);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, CELL * 1.5, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "20px serif";
        ctx.textAlign = "center";
        ctx.fillText("⬅️", x, y + 7);
      }
    } else if (tool === "bolt") {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, TAU);
      ctx.moveTo(x - 26, y);
      ctx.lineTo(x + 26, y);
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x, y + 26);
      ctx.stroke();
      // chain preview
      const ci = g.cellIdx(x, y);
      const seen = new Set<number>([ci]);
      const q: [number, number][] = [[ci, 0]];
      const maxD = 4 + g.perks.chain;
      ctx.fillStyle = "rgba(255,240,120,0.22)";
      while (q.length && seen.size < 60) {
        const [j, d] = q.shift()!;
        ctx.fillRect((j % COLS) * CELL + 2, Math.floor(j / COLS) * CELL + 2, CELL - 4, CELL - 4);
        if (d >= maxD) continue;
        const jc = j % COLS;
        const jr = Math.floor(j / COLS);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = jc + dc;
          const nr = jr + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
          const n = nr * COLS + nc;
          if (!seen.has(n) && (g.wet[n] > 0.3 || g.ice[n] > 0.4)) {
            seen.add(n);
            q.push([n, d + 1]);
          }
        }
      }
    } else {
      const r = tool === "rain" ? CELL * 2.2 * g.perks.cloudMul : CELL * 2.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "20px serif";
      ctx.textAlign = "center";
      ctx.fillText(spell.icon, x, y + 7);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  const def = STRUCTS.find((s) => s.id === tool);
  if (def) {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    const ok = g.canPlace(c, r) && g.gold >= def.cost;
    const cx = c * CELL + CELL / 2;
    const cy = r * CELL + CELL / 2;
    ctx.fillStyle = ok ? "rgba(120,255,140,0.3)" : "rgba(255,90,80,0.35)";
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    ctx.globalAlpha = 0.85;
    ctx.font = "28px serif";
    ctx.textAlign = "center";
    ctx.fillText(def.icon, cx, cy + 9);
    const rg = structRange(g, def.id, 1);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    if (rg) {
      ctx.beginPath();
      ctx.arc(cx, cy, rg, 0, TAU);
      ctx.stroke();
    } else if (def.id === "fan") {
      const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][g.ghostDir];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + d[0] * CELL * 4, cy + d[1] * CELL * 4);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}
