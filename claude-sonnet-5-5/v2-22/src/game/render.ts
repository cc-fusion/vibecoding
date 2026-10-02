import type { Sim } from "./sim";
import { clamp } from "./sim";

export const PW = 960;
export const PH = 540;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "steam" | "spark" | "bubble" | "spray" | "glow"; grow: number }
interface Floater { x: number; y: number; text: string; color: string; age: number }

const ANCHORS: Record<string, [number, number]> = {
  reactor: [140, 250], turbine: [650, 60], grid: [850, 100], tower: [830, 280], diesel: [420, 455],
};

type Pt = [number, number];

function tempColor(T: number, a = 1) {
  const k = clamp((T - 180) / 200, 0, 1);
  const r = Math.round(40 + 215 * Math.pow(k, 0.8));
  const g = Math.round(150 - 90 * k + (k < 0.4 ? 40 * k : 0));
  const b = Math.round(255 - 235 * k);
  return `rgba(${r},${g},${b},${a})`;
}

function polyLen(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
function polyAt(pts: Pt[], d: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= l) { const k = l === 0 ? 0 : d / l; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    d -= l;
  }
  return pts[pts.length - 1];
}

export class Renderer {
  parts: Particle[] = [];
  floats: Floater[] = [];
  time = 0;
  private spawnAcc: Record<string, number> = {};

  reset() { this.parts = []; this.floats = []; this.time = 0; this.spawnAcc = {}; }

  addFloat(msg: string, anchor: string, color: string) {
    const a = ANCHORS[anchor] || ANCHORS.reactor;
    const n = this.floats.filter((f) => f.age < 0.6 && Math.abs(f.x - a[0]) < 60).length;
    this.floats.push({ x: a[0] + (Math.random() - 0.5) * 20, y: a[1] - n * 18, text: msg, color, age: 0 });
    if (this.floats.length > 24) this.floats.shift();
  }

  burst(x: number, y: number, n: number, color: string, speed = 120) {
    for (let i = 0; i < n && this.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2; const s = Math.random() * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0, max: 0.4 + Math.random() * 0.6, size: 1.5 + Math.random() * 2, color, kind: "spark", grow: 0 });
    }
  }

  private spawn(key: string, rate: number, dt: number, fn: () => void) {
    this.spawnAcc[key] = (this.spawnAcc[key] || 0) + rate * dt;
    while (this.spawnAcc[key] >= 1) { this.spawnAcc[key] -= 1; if (this.parts.length < 500) fn(); }
  }

  update(dt: number, sim: Sim) {
    this.time += dt;
    // plume
    const heatOut = clamp(sim.usedT + sim.usedB, 0, 1.5) * (0.4 + 0.6 * sim.coolEff);
    this.spawn("plume", heatOut * 14, dt, () => {
      this.parts.push({ x: 800 + Math.random() * 40, y: 290, vx: (Math.random() - 0.3) * 10, vy: -25 - Math.random() * 20, life: 0, max: 2.5 + Math.random() * 1.5, size: 7 + Math.random() * 6, color: "220,235,245", kind: "steam", grow: 8 });
    });
    // leaks
    for (const l of sim.leaks) {
      if (l.isolated) continue;
      const rate = 30 * (l.rate / 0.004);
      if (l.kind === "pipe") this.spawn("leakp" + l.id, rate, dt, () => this.parts.push({ x: 300, y: 304, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 60, life: 0, max: 0.7, size: 3, color: "200,230,255", kind: "spray", grow: 3 }));
      else this.spawn("leakt" + l.id, rate, dt, () => this.parts.push({ x: 455, y: 250, vx: 20 + Math.random() * 30, vy: -20 - Math.random() * 30, life: 0, max: 1, size: 5, color: "255,190,120", kind: "steam", grow: 6 }));
    }
    // relief
    if (sim.reliefOpen || sim.relief > 0) this.spawn("relief", 20, dt, () => this.parts.push({ x: 270, y: 135, vx: (Math.random() - 0.5) * 30, vy: -60, life: 0, max: 0.8, size: 4, color: "255,255,255", kind: "steam", grow: 5 }));
    // bubbles in core
    if (sim.voidF > 0.02) this.spawn("bub", 30 * sim.voidF, dt, () => this.parts.push({ x: 90 + Math.random() * 80, y: 440, vx: 0, vy: -50 - Math.random() * 30, life: 0, max: 1.2, size: 2 + Math.random() * 2, color: "230,240,255", kind: "bubble", grow: 0 }));
    // fuel damage embers
    if (sim.fuel < 0.98) this.spawn("embers", (1 - sim.fuel) * 80, dt, () => this.parts.push({ x: 100 + Math.random() * 60, y: 400, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, life: 0, max: 1.4, size: 2, color: "255,120,40", kind: "glow", grow: 0 }));
    // turbine steam leak when relief
    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "spark" || p.kind === "spray") p.vy += 160 * dt;
      p.size += p.grow * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const f of this.floats) { f.age += dt; f.y -= 26 * dt; }
    this.floats = this.floats.filter((f) => f.age < 2.2);
  }

  private pipe(ctx: CanvasRenderingContext2D, pts: Pt[], w: number, color: string) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1319"; ctx.lineWidth = w + 4;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }

  private dots(ctx: CanvasRenderingContext2D, pts: Pt[], speed: number, color: string, spacing = 26) {
    const L = polyLen(pts); if (L <= 0 || speed <= 0.01) return;
    const n = Math.floor(L / spacing);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const d = (((this.time * speed * 60 + i * spacing) % L) + L) % L;
      const [x, y] = polyAt(pts, d);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.3); ctx.fill();
    }
  }

  private label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#9fe8ff", align: CanvasTextAlign = "left", size = 11) {
    ctx.font = `${size}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  draw(ctx: CanvasRenderingContext2D, sim: Sim, shakeOn: boolean) {
    const t = this.time;
    const d = sim.disp;
    ctx.save();
    ctx.clearRect(0, 0, PW, PH);
    if (shakeOn && sim.shake > 0.01) {
      const s = sim.shake * 9;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, PH);
    bg.addColorStop(0, "#0a1620"); bg.addColorStop(1, "#060e14");
    ctx.fillStyle = bg; ctx.fillRect(-20, -20, PW + 40, PH + 40);
    ctx.strokeStyle = "rgba(80,160,200,0.07)"; ctx.lineWidth = 1;
    for (let x = 0; x < PW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PH); ctx.stroke(); }
    for (let y = 0; y < PH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); }

    // ----- containment -----
    const pcK = clamp(sim.Pc / 4, 0, 1);
    ctx.beginPath();
    ctx.moveTo(20, 525); ctx.lineTo(20, 175); ctx.quadraticCurveTo(190, -30, 360, 175); ctx.lineTo(360, 525); ctx.closePath();
    const cg = ctx.createLinearGradient(20, 0, 360, 0);
    cg.addColorStop(0, "rgba(30,60,80,0.55)"); cg.addColorStop(0.5, "rgba(20,40,55,0.35)"); cg.addColorStop(1, "rgba(30,60,80,0.55)");
    ctx.fillStyle = cg; ctx.fill();
    if (pcK > 0.3) { ctx.fillStyle = `rgba(255,60,40,${(pcK - 0.3) * 0.25})`; ctx.fill(); }
    ctx.lineWidth = 3 + pcK * 3;
    ctx.strokeStyle = pcK > 0.7 ? `rgba(255,${Math.round(60 + 60 * Math.sin(t * 12))},50,1)` : pcK > 0.4 ? "#ffb347" : "#3b8aa8";
    ctx.stroke();
    if (sim.cspray && sim.powerAvail) {
      ctx.strokeStyle = "rgba(120,200,255,0.35)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { const x = 50 + i * 22 + ((t * 40) % 22); ctx.beginPath(); ctx.moveTo(x, 80 + ((t * 120 + i * 37) % 300)); ctx.lineTo(x - 2, 92 + ((t * 120 + i * 37) % 300)); ctx.stroke(); }
    }
    this.label(ctx, "CONTAINMENT", 190, 40, "#6fb8d4", "center", 11);
    this.label(ctx, `${d.Pc.toFixed(2)} bar`, 190, 54, pcK > 0.5 ? "#ff8a70" : "#8fd0e6", "center", 11);

    // ----- reactor vessel -----
    const vx = 80, vy = 270, vw = 100, vh = 195;
    ctx.fillStyle = "#0c1a22"; this.rr(ctx, vx, vy, vw, vh, 22); ctx.fill();
    // water
    ctx.save(); this.rr(ctx, vx + 3, vy + 3, vw - 6, vh - 6, 20); ctx.clip();
    const wl = vh * clamp(sim.inv, 0, 1);
    ctx.fillStyle = tempColor(sim.Tc, 0.55); ctx.fillRect(vx, vy + vh - wl, vw, wl);
    // core
    const coreGlow = clamp((sim.Tf - 300) / 900, 0, 1);
    const cg2 = ctx.createLinearGradient(0, 340, 0, 440);
    cg2.addColorStop(0, `rgba(255,${Math.round(220 - 160 * coreGlow)},${Math.round(80 - 60 * coreGlow)},${0.35 + coreGlow * 0.65})`);
    cg2.addColorStop(1, `rgba(255,${Math.round(180 - 140 * coreGlow)},40,${0.3 + coreGlow * 0.6})`);
    ctx.fillStyle = cg2; ctx.fillRect(vx + 10, 340, vw - 20, 105);
    // fuel assembly lines
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(vx + 10 + i * ((vw - 20) / 7), 340); ctx.lineTo(vx + 10 + i * ((vw - 20) / 7), 445); ctx.stroke(); }
    // cherenkov glow
    if (sim.P > 0.01) { ctx.fillStyle = `rgba(90,200,255,${clamp(sim.P, 0, 1.2) * 0.25 * (0.8 + 0.2 * Math.sin(t * 9))})`; ctx.fillRect(vx + 10, 340, vw - 20, 105); }
    ctx.restore();
    ctx.strokeStyle = sim.fuel < 0.95 ? "#ff5040" : "#4aa0c0"; ctx.lineWidth = 3; this.rr(ctx, vx, vy, vw, vh, 22); ctx.stroke();
    // rods
    for (let i = 0; i < 4; i++) {
      const r = sim.rods[i];
      const x = vx + 14 + i * 24;
      const tip = 300 + r.pos * 140;
      ctx.fillStyle = "#16242d"; ctx.fillRect(x - 6, 215, 12, 62);
      const rg = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
      if (r.stuck) { rg.addColorStop(0, "#ff7050"); rg.addColorStop(1, "#aa2a20"); } else { rg.addColorStop(0, "#d6e6ee"); rg.addColorStop(1, "#6a8896"); }
      ctx.fillStyle = rg; ctx.fillRect(x - 4, tip - 105, 8, 105);
      ctx.fillStyle = r.stuck ? "#ff3020" : "#222"; ctx.fillRect(x - 4, tip - 5, 8, 5);
      if (!r.stuck && Math.abs(r.tgt - r.pos) > 0.004) { ctx.fillStyle = "#ffe066"; ctx.fillRect(x - 7, 300 + r.tgt * 140 - 1, 14, 2); }
      this.label(ctx, `${i + 1}`, x, 210, r.stuck ? "#ff7050" : "#8fd0e6", "center", 10);
    }
    this.label(ctx, `P ${(d.P * 100).toFixed(0)}%`, vx + vw / 2, 482, "#7fe9ff", "center", 12);
    this.label(ctx, `Tf ${d.Tf.toFixed(0)}°C`, vx + vw / 2, 497, d.Tf > 1000 ? "#ff7050" : "#ffb86b", "center", 11);
    this.label(ctx, `Xe ${d.Xe.toFixed(2)}`, vx + vw / 2, 511, "#c79bff", "center", 10);

    // ----- pressurizer -----
    const px = 245, py = 140, pw = 44, ph = 110;
    ctx.fillStyle = "#0c1a22"; this.rr(ctx, px, py, pw, ph, 14); ctx.fill();
    ctx.save(); this.rr(ctx, px + 2, py + 2, pw - 4, ph - 4, 12); ctx.clip();
    const plev = clamp(0.35 + (sim.inv - 0.6) * 0.8, 0.05, 0.95);
    ctx.fillStyle = tempColor(sim.Tc + 20, 0.6); ctx.fillRect(px, py + ph * (1 - plev), pw, ph * plev);
    ctx.fillStyle = `rgba(255,140,40,${clamp(sim.heat, 0, 1) * (sim.powerAvail ? 1 : 0)})`; ctx.fillRect(px, py + ph - 14, pw, 14);
    ctx.restore();
    ctx.strokeStyle = sim.reliefOpen ? "#ff5040" : "#4aa0c0"; ctx.lineWidth = 2.5; this.rr(ctx, px, py, pw, ph, 14); ctx.stroke();
    if (sim.spray > 0.05 && sim.powerAvail) { ctx.strokeStyle = "rgba(140,210,255,0.8)"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 12 + i * 10, py + 8); ctx.lineTo(px + 12 + i * 10, py + 8 + 10 + 6 * Math.sin(t * 14 + i)); ctx.stroke(); } }
    this.label(ctx, "PRZR", px + pw / 2, py - 6, "#6fb8d4", "center", 10);
    this.label(ctx, `${d.Pp.toFixed(0)} bar`, px + pw / 2, py + ph + 14, d.Pp > 165 || d.Pp < 135 ? "#ff8a70" : "#9fe8ff", "center", 11);

    // ----- primary loop -----
    const hotP: Pt[] = [[180, 305], [410, 305]];
    const surge: Pt[] = [[267, 305], [267, 250]];
    const cold: Pt[] = [[410, 405], [180, 405]];
    this.pipe(ctx, surge, 7, tempColor(sim.Tc, 0.8));
    this.pipe(ctx, hotP, 11, tempColor(sim.Tc + 12));
    this.pipe(ctx, cold, 11, tempColor(sim.Tc - 14));
    const fl = sim.flow;
    this.dots(ctx, hotP, fl * 0.7, "rgba(255,255,255,0.8)");
    this.dots(ctx, cold, fl * 0.7, "rgba(255,255,255,0.8)");
    // pumps
    const pumpDraw = (x: number, k: "A" | "B", fail: boolean) => {
      const sp = sim.pumps[k].speed;
      ctx.fillStyle = "#0c1a22"; ctx.beginPath(); ctx.arc(x, 405, 19, 0, 6.3); ctx.fill();
      ctx.strokeStyle = fail ? "#ff5040" : sp > 0.05 ? "#4fe39a" : "#6b7f8a"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = fail ? "#ff5040" : "#cfe8f2"; ctx.lineWidth = 2.5;
      const a0 = t * sp * 22;
      for (let i = 0; i < 3; i++) { const a = a0 + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.moveTo(x, 405); ctx.lineTo(x + Math.cos(a) * 13, 405 + Math.sin(a) * 13); ctx.stroke(); }
      this.label(ctx, `PUMP ${k}`, x, 437, fail ? "#ff7050" : "#9fe8ff", "center", 10);
      this.label(ctx, `${(sp * 100).toFixed(0)}%`, x, 449, "#7fb0c4", "center", 10);
    };
    pumpDraw(260, "A", sim.offline("pumpA"));
    pumpDraw(340, "B", sim.offline("pumpB"));
    this.label(ctx, `Tavg ${d.Tc.toFixed(0)}°C`, 300, 296, d.Tc > 330 ? "#ff8a70" : "#ffb86b", "center", 11);

    // ----- steam generator -----
    const sx = 410, sy = 150, sw = 90, sh = 275;
    ctx.fillStyle = "#0c1a22"; this.rr(ctx, sx, sy, sw, sh, 18); ctx.fill();
    ctx.save(); this.rr(ctx, sx + 2, sy + 2, sw - 4, sh - 4, 16); ctx.clip();
    const lv = sh * clamp(sim.sgL, 0, 1);
    ctx.fillStyle = "rgba(60,140,200,0.55)"; ctx.fillRect(sx, sy + sh - lv, sw, lv);
    ctx.fillStyle = "rgba(235,245,255,0.12)"; ctx.fillRect(sx, sy, sw, sh - lv);
    ctx.strokeStyle = tempColor(sim.Tc + 5, 0.9); ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const y = 290 + i * 18; ctx.moveTo(sx, i === 0 ? 305 : y); ctx.lineTo(sx + sw - 12, y); ctx.lineTo(sx + sw - 12, y + 9); ctx.lineTo(sx + 12, y + 9); } ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = sim.offline("sg") ? "#ff5040" : "#4aa0c0"; ctx.lineWidth = 3; this.rr(ctx, sx, sy, sw, sh, 18); ctx.stroke();
    this.label(ctx, "STEAM GEN", sx + sw / 2, sy - 8, "#6fb8d4", "center", 10);
    this.label(ctx, `LVL ${(d.sgL * 100).toFixed(0)}%`, sx + sw / 2, sy + 16, d.sgL < 0.35 ? "#ff8a70" : "#9fe8ff", "center", 10);
    this.label(ctx, `${d.Ps.toFixed(0)} bar`, sx + sw / 2, sy + 30, d.Ps > 76 ? "#ff8a70" : "#dfeffa", "center", 11);

    // ----- steam line, turbine -----
    const steam: Pt[] = [[455, 150], [455, 90], [598, 90]];
    const steamCol = `rgba(225,240,250,${clamp(0.35 + sim.Ps / 150, 0.3, 0.9)})`;
    this.pipe(ctx, steam, 9, steamCol);
    const sflow = sim.usedT + sim.usedB;
    this.dots(ctx, steam, sflow * 1.2, "rgba(60,100,140,0.8)", 22);
    // bypass
    const byp: Pt[] = [[540, 90], [540, 365], [575, 365]];
    this.pipe(ctx, byp, 7, sim.bypass > 0.02 ? "rgba(225,240,250,0.7)" : "rgba(80,100,115,0.6)");
    this.dots(ctx, byp, sim.usedB * 2, "rgba(60,100,140,0.8)", 20);
    ctx.fillStyle = "#16242d"; ctx.fillRect(530, 215, 20, 16);
    ctx.fillStyle = sim.bypass > 0.02 ? "#ffd060" : "#4a5c66"; ctx.fillRect(532, 217 + 12 * (1 - sim.bypass), 16, 12 * sim.bypass + 1);
    this.label(ctx, "BYPASS", 556, 227, "#6fb8d4", "left", 10);
    // governor valve
    ctx.fillStyle = "#16242d"; ctx.fillRect(560, 78, 22, 24);
    ctx.fillStyle = sim.turbTripped ? "#ff5040" : "#4fe39a"; ctx.fillRect(563, 81 + 18 * (1 - sim.valve), 16, 18 * sim.valve + 1);
    // turbine body
    const tripped = sim.turbTripped || sim.offline("turbine");
    ctx.fillStyle = "#0c1a22";
    ctx.beginPath(); ctx.moveTo(600, 78); ctx.lineTo(700, 52); ctx.lineTo(700, 128); ctx.lineTo(600, 102); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = tripped ? "#ff5040" : "#4aa0c0"; ctx.lineWidth = 3; ctx.stroke();
    const spin = tripped ? 0 : sim.valve;
    ctx.strokeStyle = "rgba(200,230,245,0.7)"; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = 612 + i * 15; const h = 12 + i * 5; const o = ((t * spin * 90 + i * 9) % 14) - 7; ctx.beginPath(); ctx.moveTo(x, 90 - h / 2 + o * 0.2); ctx.lineTo(x, 90 + h / 2 + o * 0.2); ctx.stroke(); }
    // generator
    ctx.fillStyle = "#0c1a22"; ctx.beginPath(); ctx.arc(738, 90, 26, 0, 6.3); ctx.fill();
    ctx.strokeStyle = tripped ? "#ff5040" : "#e3c04f"; ctx.lineWidth = 3; ctx.stroke();
    this.label(ctx, "G", 738, 95, tripped ? "#ff7050" : "#ffe27a", "center", 16);
    this.label(ctx, "TURBINE", 650, 44, "#6fb8d4", "center", 10);
    this.label(ctx, `${d.MWe.toFixed(0)} MWe`, 700, 150, tripped ? "#ff8a70" : "#7dff9b", "center", 14);
    this.label(ctx, `demand ${sim.offsite ? sim.demand.toFixed(0) : "—"} MW`, 700, 166, "#ffe27a", "center", 11);
    // grid line + pylon
    const gridOn = sim.offsite;
    ctx.strokeStyle = gridOn && !tripped ? "#e3c04f" : "#5a4a2a"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(764, 90); ctx.lineTo(850, 90); ctx.stroke();
    ctx.strokeStyle = gridOn ? "#9fb7c4" : "#ff5040"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(850, 130); ctx.lineTo(862, 80); ctx.lineTo(874, 130); ctx.moveTo(840, 100); ctx.lineTo(884, 100); ctx.moveTo(845, 112); ctx.lineTo(879, 112); ctx.stroke();
    this.label(ctx, gridOn ? `GRID ${sim.freq.toFixed(2)} Hz` : "GRID DOWN", 862, 150, gridOn ? (Math.abs(sim.freq - 50) > 0.8 ? "#ff8a70" : "#9fe8ff") : "#ff6050", "center", 11);
    if (gridOn && !tripped && sim.MWe > 20) {
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < 4; i++) { const x = 764 + ((t * 70 + i * 22) % 86); ctx.beginPath(); ctx.arc(x, 90, 2.2, 0, 6.3); ctx.fill(); }
    }

    // ----- condenser, tower -----
    ctx.fillStyle = "#0c1a22"; this.rr(ctx, 575, 340, 120, 60, 10); ctx.fill();
    ctx.strokeStyle = sim.condPen > 0.05 ? "#ff9a50" : "#4aa0c0"; ctx.lineWidth = 3; this.rr(ctx, 575, 340, 120, 60, 10); ctx.stroke();
    this.label(ctx, "CONDENSER", 635, 358, "#6fb8d4", "center", 10);
    this.label(ctx, `cool ${(sim.coolEff * 100).toFixed(0)}%`, 635, 376, sim.coolEff < 0.5 ? "#ff8a70" : "#9fe8ff", "center", 11);
    this.label(ctx, `load ${((sim.usedT + sim.usedB) * 100).toFixed(0)}%`, 635, 391, "#8fb0c0", "center", 10);
    // feed return
    const feed: Pt[] = [[635, 400], [635, 445], [455, 445], [455, 425]];
    const feedOn = sim.perf("feed") > 0 && sim.powerAvail;
    this.pipe(ctx, feed, 6, "rgba(70,130,190,0.7)");
    this.dots(ctx, feed, feedOn ? 0.6 : sim.afw ? 0.2 : 0, "rgba(180,220,255,0.9)", 24);
    ctx.fillStyle = "#0c1a22"; ctx.beginPath(); ctx.arc(545, 445, 14, 0, 6.3); ctx.fill();
    ctx.strokeStyle = sim.offline("feed") ? "#ff5040" : feedOn ? "#4fe39a" : "#6b7f8a"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "#cfe8f2"; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = t * (feedOn ? 12 : 0) + i * 2.09; ctx.beginPath(); ctx.moveTo(545, 445); ctx.lineTo(545 + Math.cos(a) * 9, 445 + Math.sin(a) * 9); ctx.stroke(); }
    this.label(ctx, sim.afw ? "FEED + AFW" : "FEEDWATER", 545, 475, "#7fb0c4", "center", 10);
    // cooling tower
    ctx.beginPath();
    ctx.moveTo(765, 490); ctx.quadraticCurveTo(805, 400, 780, 285); ctx.lineTo(860, 285); ctx.quadraticCurveTo(835, 400, 875, 490); ctx.closePath();
    ctx.fillStyle = "#0f1f28"; ctx.fill();
    ctx.strokeStyle = sim.offline("tower") ? "#ff5040" : "#4aa0c0"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "rgba(80,160,200,0.25)"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const y = 310 + i * 28; ctx.beginPath(); ctx.moveTo(790, y); ctx.lineTo(850, y); ctx.stroke(); }
    this.label(ctx, `COOLING TOWER ${(sim.towerCmd * 100).toFixed(0)}%`, 820, 508, "#6fb8d4", "center", 10);
    this.label(ctx, `ambient ${(15 + sim.ambient * 25).toFixed(0)}°C`, 820, 521, sim.ambient > 0.6 ? "#ffb86b" : "#7fb0c4", "center", 10);

    // ----- diesel & RWST -----
    const dOn = sim.diesel === "running";
    ctx.fillStyle = "#0c1a22"; ctx.fillRect(380, 465, 80, 50);
    ctx.strokeStyle = sim.diesel === "failed" ? "#ff5040" : dOn ? "#4fe39a" : sim.diesel === "starting" ? "#ffd060" : "#4a6270"; ctx.lineWidth = 3; ctx.strokeRect(380, 465, 80, 50);
    this.label(ctx, "DIESEL", 420, 484, dOn ? "#7dff9b" : "#8fb0c0", "center", 11);
    ctx.fillStyle = "#16242d"; ctx.fillRect(388, 494, 64, 8);
    ctx.fillStyle = sim.dieselFuel < 0.25 ? "#ff6050" : "#e3c04f"; ctx.fillRect(388, 494, 64 * clamp(sim.dieselFuel, 0, 1), 8);
    this.label(ctx, sim.diesel.toUpperCase(), 420, 511, "#7fb0c4", "center", 9);
    if (dOn) { ctx.fillStyle = "rgba(255,230,120,0.5)"; ctx.fillRect(380 + 6 * Math.sin(t * 30), 460, 3, 5); }
    // RWST
    ctx.fillStyle = "#0c1a22"; this.rr(ctx, 215, 450, 46, 62, 8); ctx.fill();
    ctx.fillStyle = sim.eccs ? "rgba(120,220,170,0.8)" : "rgba(80,160,150,0.5)"; const th = 56 * clamp(sim.tank, 0, 1); ctx.fillRect(218, 509 - th, 40, th);
    ctx.strokeStyle = sim.eccs && sim.powerAvail ? "#4fe39a" : "#4a6270"; ctx.lineWidth = 2.5; this.rr(ctx, 215, 450, 46, 62, 8); ctx.stroke();
    this.label(ctx, "ECCS", 238, 446, "#6fb8d4", "center", 10);

    // ----- particles -----
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      if (p.kind === "steam") { ctx.fillStyle = `rgba(${p.color},${0.18 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.fill(); }
      else if (p.kind === "bubble") { ctx.strokeStyle = `rgba(${p.color},${0.8 * k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.stroke(); }
      else if (p.kind === "spray") { ctx.fillStyle = `rgba(${p.color},${0.9 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, 6.3); ctx.fill(); }
      else if (p.kind === "glow") { ctx.fillStyle = `rgba(${p.color},${k})`; ctx.fillRect(p.x, p.y, p.size, p.size); }
      else { ctx.fillStyle = p.color; ctx.globalAlpha = k; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; }
    }

    // ----- floating texts -----
    ctx.textAlign = "center";
    for (const f of this.floats) {
      const a = clamp(1 - f.age / 2.2, 0, 1);
      const sc = 1 + Math.max(0, 0.4 - f.age) * 1.5;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(sc, sc);
      ctx.globalAlpha = a; ctx.font = "bold 15px ui-monospace, Menlo, Consolas, monospace";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // alarm vignette
    const crit = sim.alarms.some((a) => a.active && a.level === 2);
    const unacked = sim.alarms.some((a) => a.active && !a.acked);
    if (crit || sim.scrammed) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (unacked ? 8 : 3));
      const g = ctx.createRadialGradient(PW / 2, PH / 2, PH * 0.35, PW / 2, PH / 2, PH * 0.95);
      g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(255,30,20,${0.12 + 0.18 * pulse})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    }
    if (!sim.offsite) { ctx.fillStyle = "rgba(0,0,10,0.35)"; ctx.fillRect(0, 0, PW, PH); }
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export const CW = 960;
export const CH = 210;

export function drawChart(ctx: CanvasRenderingContext2D, sim: Sim) {
  const diag = sim.up.diag || 0;
  const past = 100;
  const fut = 40 + 40 * Math.min(2, diag);
  const L = 44, R = 10, T = 14, B = 22;
  const w = CW - L - R, h = CH - T - B;
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#08121a"; ctx.fillRect(0, 0, CW, CH);
  const xOf = (dt: number) => L + ((dt + past) / (past + fut)) * w;
  const yOf = (f: number) => T + h - clamp(f, -0.05, 1.05) * h;
  ctx.strokeStyle = "rgba(80,160,200,0.12)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = T + (h * i) / 4; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + w, y); ctx.stroke(); }
  ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.fillStyle = "#6aa"; ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) ctx.fillText(String(Math.round(1200 - i * 300)), L - 4, T + (h * i) / 4 + 3);
  ctx.textAlign = "center";
  for (let s = -100; s <= fut; s += 20) { ctx.fillStyle = "#4a8"; ctx.fillText(`${s >= 0 ? "+" : ""}${s}s`, xOf(s), CH - 7); }
  // forecast zone
  ctx.fillStyle = "rgba(255,226,122,0.04)"; ctx.fillRect(xOf(0), T, w * (fut / (past + fut)), h);
  const series: { key: keyof typeof sim.history[number]; f: (v: number) => number; c: string }[] = [
    { key: "Xe", f: (v) => v / 2, c: "#c79bff" },
    { key: "Pp", f: (v) => (v - 100) / 100, c: "#ff6ad5" },
    { key: "Tc", f: (v) => (v - 200) / 200, c: "#ffb347" },
    { key: "P", f: (v) => v / 1.2, c: "#4de1ff" },
    { key: "mwe", f: (v) => v / 1200, c: "#6dff8f" },
  ];
  const hist = sim.history;
  const draw = (get: (i: number) => number, f: (v: number) => number, c: string, width: number, dash?: number[]) => {
    ctx.strokeStyle = c; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < hist.length; i++) {
      const dt = hist[i].t - sim.t;
      if (dt < -past) continue;
      const x = xOf(dt), y = yOf(f(get(i)));
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  };
  for (const s of series) draw((i) => hist[i][s.key] as number, s.f, s.c, s.key === "mwe" ? 2 : 1.3);
  // demand (history + forecast)
  draw((i) => hist[i].dem, (v) => v / 1200, "#ffe27a", 1.6, [5, 3]);
  ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 1.6; ctx.setLineDash([2, 4]);
  ctx.beginPath();
  for (let k = 0; k <= fut; k += 2) {
    const dm = sim.demandAt(sim.t + k) + (sim.surgeUntil > sim.t + k ? sim.surgeAmt : 0);
    const x = xOf(k), y = yOf(dm / 1200);
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  // now line
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(xOf(0), T); ctx.lineTo(xOf(0), T + h); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("NOW", xOf(0) + 3, T + 9);
  // xenon forecast marker
  if (diag >= 1) {
    const xf = sim.forecastXe(30);
    ctx.fillStyle = "#c79bff"; ctx.fillRect(xOf(30) - 2, yOf(xf / 2) - 2, 5, 5);
    ctx.fillText(`Xe→${xf.toFixed(2)}`, xOf(30) + 6, yOf(xf / 2) + 3);
  }
}
