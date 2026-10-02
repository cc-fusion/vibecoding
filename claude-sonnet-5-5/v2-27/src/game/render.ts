import { MODS, ModId } from "./data";

/** Lighten (amt>0) or darken (amt<0) a #rrggbb colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export interface DrawOpts { t?: number; aim?: number; hpRatio?: number; flash?: number; unmanned?: boolean; active?: boolean; dim?: number }

export function drawModule(ctx: CanvasRenderingContext2D, id: ModId, cx: number, cy: number, s: number, o: DrawOpts = {}) {
  const d = MODS[id];
  const u = s / 2;
  const t = o.t || 0;
  ctx.save();
  ctx.translate(cx, cy);
  if (o.dim !== undefined) ctx.globalAlpha = o.dim;
  const half = u - 0.6;
  // tile body
  ctx.fillStyle = id === "armor" ? "#1e293b" : shade(d.color, -0.78);
  ctx.fillRect(-half, -half, half * 2, half * 2);
  ctx.strokeStyle = shade(d.color, id === "armor" ? -0.2 : 0);
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = Math.max(1, s * 0.075);
  const L = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke(); };
  const C = (x: number, y: number, r: number, fill = false) => { ctx.beginPath(); ctx.arc(x * u, y * u, r * u, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
  switch (id) {
    case "bridge":
      ctx.beginPath(); ctx.moveTo(0, -0.65 * u); ctx.lineTo(0.65 * u, 0); ctx.lineTo(0, 0.65 * u); ctx.lineTo(-0.65 * u, 0); ctx.closePath(); ctx.stroke();
      C(0, 0, 0.2 + 0.05 * Math.sin(t * 4), true);
      break;
    case "reactor":
      C(0, 0, 0.55); C(0, 0, 0.22 + 0.08 * Math.sin(t * 6), true);
      L(0, -0.55, 0, -0.85); L(0, 0.55, 0, 0.85); L(-0.55, 0, -0.85, 0); L(0.55, 0, 0.85, 0);
      break;
    case "solar":
      ctx.strokeRect(-0.65 * u, -0.65 * u, 1.3 * u, 1.3 * u);
      L(0, -0.65, 0, 0.65); L(-0.65, 0, 0.65, 0);
      break;
    case "engine":
      ctx.beginPath(); ctx.moveTo(-0.4 * u, -0.6 * u); ctx.lineTo(0.4 * u, -0.6 * u); ctx.lineTo(0.7 * u, 0.55 * u); ctx.lineTo(-0.7 * u, 0.55 * u); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = o.active ? "#fff7ed" : shade(d.color, -0.4);
      ctx.fillRect(-0.3 * u, 0.1 * u, 0.6 * u, 0.4 * u);
      break;
    case "gyro":
      ctx.beginPath(); ctx.arc(0, 0, 0.55 * u, 0.4, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.5 * u, -0.35 * u); ctx.lineTo(0.85 * u, -0.05 * u); ctx.lineTo(0.25 * u, -0.05 * u); ctx.closePath(); ctx.fill();
      break;
    case "quarters":
      L(-0.6, -0.45, 0.6, -0.45); L(-0.6, 0, 0.6, 0); L(-0.6, 0.45, 0.6, 0.45);
      C(-0.35, -0.22, 0.12, true); C(0.2, 0.23, 0.12, true);
      break;
    case "corridor":
      ctx.globalAlpha *= 0.8;
      L(-0.8, 0, 0.8, 0); L(0, -0.8, 0, 0.8);
      C(0, 0, 0.18, true);
      break;
    case "armor":
      ctx.fillStyle = "#334155"; ctx.fillRect(-0.62 * u, -0.62 * u, 1.24 * u, 1.24 * u);
      ctx.fillStyle = "#94a3b8";
      for (const [x, y] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) C(x, y, 0.1, true);
      break;
    case "pulse":
      ctx.fillRect(-0.15 * u, -0.9 * u, 0.3 * u, 1.2 * u);
      C(0, 0.35, 0.4);
      if (o.active) { ctx.fillStyle = "#fff"; C(0, -0.9, 0.2, true); }
      break;
    case "turret": {
      C(0, 0, 0.5);
      ctx.save(); ctx.rotate(o.aim || 0);
      ctx.fillRect(-0.13 * u, -0.95 * u, 0.26 * u, 0.9 * u);
      ctx.restore();
      C(0, 0, 0.18, true);
      break;
    }
    case "railgun":
      ctx.fillRect(-0.5 * u, -0.95 * u, 0.22 * u, 1.5 * u);
      ctx.fillRect(0.28 * u, -0.95 * u, 0.22 * u, 1.5 * u);
      ctx.strokeRect(-0.55 * u, 0.2 * u, 1.1 * u, 0.55 * u);
      if (o.active) { ctx.strokeStyle = "#fff"; L(0, -0.9, 0, 0.2); }
      break;
    case "missile":
      ctx.strokeRect(-0.65 * u, -0.65 * u, 1.3 * u, 1.3 * u);
      for (const [x, y] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) C(x, y, 0.2, true);
      break;
    case "shield":
      C(0, 0, 0.6); C(0, 0, 0.3, true);
      ctx.globalAlpha *= 0.5; C(0, 0, 0.85);
      break;
    case "radiator":
      for (const x of [-0.6, -0.2, 0.2, 0.6]) L(x, -0.7, x, 0.7);
      break;
    case "sink":
      ctx.strokeRect(-0.7 * u, -0.7 * u, 1.4 * u, 1.4 * u);
      ctx.strokeRect(-0.4 * u, -0.4 * u, 0.8 * u, 0.8 * u);
      C(0, 0, 0.1, true);
      break;
    case "battery":
      ctx.strokeRect(-0.45 * u, -0.5 * u, 0.9 * u, 1.1 * u);
      ctx.fillRect(-0.2 * u, -0.75 * u, 0.4 * u, 0.25 * u);
      ctx.fillRect(-0.3 * u, 0.0 * u, 0.6 * u, 0.15 * u);
      ctx.fillRect(-0.3 * u, 0.28 * u, 0.6 * u, 0.15 * u);
      break;
    case "repair":
      ctx.fillRect(-0.18 * u, -0.7 * u, 0.36 * u, 1.4 * u);
      ctx.fillRect(-0.7 * u, -0.18 * u, 1.4 * u, 0.36 * u);
      break;
    case "targeting":
      C(0, 0, 0.5); C(0, 0, 0.12, true);
      L(0, -0.85, 0, -0.35); L(0, 0.85, 0, 0.35); L(-0.85, 0, -0.35, 0); L(0.85, 0, 0.35, 0);
      break;
    case "cargo":
      ctx.strokeRect(-0.65 * u, -0.65 * u, 1.3 * u, 1.3 * u);
      L(-0.65, -0.65, 0.65, 0.65); L(0.65, -0.65, -0.65, 0.65);
      break;
  }
  ctx.globalAlpha = o.dim !== undefined ? o.dim : 1;
  if (o.hpRatio !== undefined && o.hpRatio < 0.6) {
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-half * 0.6, -half); ctx.lineTo(0, -half * 0.1); ctx.lineTo(half * 0.5, half * 0.2); ctx.lineTo(half * 0.2, half);
    if (o.hpRatio < 0.3) { ctx.moveTo(half, -half * 0.5); ctx.lineTo(0, half * 0.1); ctx.lineTo(-half, half * 0.7); }
    ctx.stroke();
  }
  if (o.flash && o.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, o.flash * 5)})`;
    ctx.fillRect(-half, -half, half * 2, half * 2);
  }
  if (o.unmanned) {
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.fillRect(-half, -half, half * 2, half * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath(); ctx.arc(half * 0.55, -half * 0.55, Math.max(1.5, s * 0.13), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
