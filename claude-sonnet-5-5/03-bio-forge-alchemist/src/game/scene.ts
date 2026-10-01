import {
  MON, ING, EL_ORDER, type El, type MonDef, type Order, type Game, type Potion,
  potionValue, potionPower, bossHpMult, getThrowCd, getPatienceMult, getPriceMult, DAY_LEN, POTIONS, ROMAN,
} from "./data";
import { sfx } from "./audio";

export const W = 960;
export const H = 500;
export const LANES = [185, 255, 325, 395];
const SHOP_X = 250;

export interface Mon {
  id: number;
  type: string;
  def: MonDef;
  x: number;
  y: number;
  tx: number;
  lane: number;
  hostile: boolean;
  state: "walk" | "wait" | "atk" | "leave";
  hp: number;
  maxHp: number;
  patience: number;
  maxPat: number;
  order?: Order;
  atkT: number;
  burn: number;
  burnDps: number;
  wet: number;
  root: number;
  flash: number;
  age: number;
  alpha: number;
  boss: boolean;
  shake: number;
  summonT: number;
}

interface Part {
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number; kind: "c" | "s" | "r";
}
interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number; }
interface Proj {
  x0: number; y0: number; x1: number; y1: number; t: number; dur: number; color: string; arc: number;
  onHit: () => void; target?: Mon;
}
interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; color: string; }

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rpick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ---------- background ----------
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CRACKS: number[][][] = (() => {
  const r = prng(77);
  const out: number[][][] = [];
  for (let i = 0; i < 12; i++) {
    let x = 20 + r() * 170;
    let y = 40 + r() * 420;
    const pts: number[][] = [[x, y]];
    for (let j = 0; j < 5; j++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.3) * 40;
      pts.push([x, y]);
    }
    out.push(pts);
  }
  return out;
})();

function makeBackground(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const r = prng(1234);
  // sky
  const sky = x.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, "#120a28");
  sky.addColorStop(0.6, "#3a1f58");
  sky.addColorStop(1, "#7a4078");
  x.fillStyle = sky;
  x.fillRect(0, 0, W, 170);
  for (let i = 0; i < 70; i++) {
    x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    x.fillRect(r() * W, r() * 110, 1.5, 1.5);
  }
  const moon = x.createRadialGradient(780, 62, 6, 780, 62, 70);
  moon.addColorStop(0, "rgba(255,245,200,1)");
  moon.addColorStop(0.25, "rgba(255,240,190,.9)");
  moon.addColorStop(0.3, "rgba(255,230,180,.25)");
  moon.addColorStop(1, "rgba(255,230,180,0)");
  x.fillStyle = moon;
  x.fillRect(680, -40, 200, 200);
  // distant houses
  for (let i = 0; i < 14; i++) {
    const hx = 250 + i * 52 + r() * 10;
    const hh = 40 + r() * 60;
    const hw = 34 + r() * 18;
    x.fillStyle = "#1a1030";
    x.fillRect(hx, 160 - hh, hw, hh);
    x.beginPath();
    x.moveTo(hx - 4, 160 - hh);
    x.lineTo(hx + hw / 2, 160 - hh - 22 - r() * 14);
    x.lineTo(hx + hw + 4, 160 - hh);
    x.fill();
    for (let w = 0; w < 3; w++) {
      if (r() > 0.4) {
        x.fillStyle = "rgba(255,200,90,.8)";
        x.fillRect(hx + 6 + w * 10, 160 - hh + 10 + r() * 20, 5, 7);
      }
    }
  }
  // ground
  const gr = x.createLinearGradient(0, 150, 0, H);
  gr.addColorStop(0, "#2b2238");
  gr.addColorStop(1, "#46364f");
  x.fillStyle = gr;
  x.fillRect(0, 150, W, H - 150);
  // lane bands
  LANES.forEach((ly, i) => {
    x.fillStyle = i % 2 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.035)";
    x.fillRect(0, ly - 35, W, 70);
  });
  // cobbles
  for (let i = 0; i < 420; i++) {
    const cx = 250 + r() * (W - 250);
    const cy = 155 + r() * (H - 155);
    x.fillStyle = `rgba(${150 + r() * 50},${130 + r() * 40},${170 + r() * 40},${0.05 + r() * 0.08})`;
    x.beginPath();
    x.ellipse(cx, cy, 10 + r() * 12, 5 + r() * 6, 0, 0, 7);
    x.fill();
  }
  // shop facade
  x.fillStyle = "#3b2418";
  x.fillRect(0, 0, 222, H);
  for (let i = 0; i < 22; i++) {
    x.fillStyle = i % 2 ? "rgba(0,0,0,.14)" : "rgba(255,200,140,.05)";
    x.fillRect(i * 10, 0, 10, H);
  }
  x.fillStyle = "#2a170e";
  x.fillRect(214, 0, 8, H);
  // awning
  for (let i = 0; i < 11; i++) {
    x.fillStyle = i % 2 ? "#e9dcc0" : "#a52a3a";
    x.beginPath();
    x.moveTo(i * 20, 0);
    x.lineTo(i * 20 + 20, 0);
    x.lineTo(i * 20 + 20, 34);
    x.arc(i * 20 + 10, 34, 10, 0, Math.PI);
    x.fill();
  }
  // sign
  x.fillStyle = "#231208";
  x.fillRect(22, 62, 168, 46);
  x.strokeStyle = "#b98a44";
  x.lineWidth = 3;
  x.strokeRect(22, 62, 168, 46);
  x.fillStyle = "#7bd86b";
  x.font = "bold 17px Georgia, serif";
  x.textAlign = "center";
  x.fillText("BIO-FORGE", 106, 83);
  x.fillStyle = "#e9dcc0";
  x.font = "italic 12px Georgia, serif";
  x.fillText("Apothecary & Oddities", 106, 100);
  // shelves w/ jars
  x.fillStyle = "#24140b";
  x.fillRect(16, 140, 100, 6);
  x.fillRect(16, 200, 100, 6);
  const jars = ["#ff6a3d", "#4cc9f0", "#7bd86b", "#ffd93d", "#e0aaff"];
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < 5; i++) {
      x.fillStyle = jars[(i + s * 2) % 5];
      x.globalAlpha = 0.85;
      x.fillRect(22 + i * 19, 122 + s * 60, 12, 18);
      x.globalAlpha = 1;
      x.fillStyle = "#6b4425";
      x.fillRect(22 + i * 19, 119 + s * 60, 12, 4);
    }
  // alchemist
  x.fillStyle = "#3a2b66";
  x.beginPath();
  x.ellipse(150, 330, 28, 46, 0, 0, 7);
  x.fill();
  x.fillStyle = "#e7c7a0";
  x.beginPath();
  x.arc(150, 272, 15, 0, 7);
  x.fill();
  x.fillStyle = "#4a3690";
  x.beginPath();
  x.moveTo(126, 268);
  x.lineTo(174, 268);
  x.lineTo(156, 222);
  x.closePath();
  x.fill();
  x.fillStyle = "#e0b84a";
  x.fillRect(132, 264, 36, 5);
  x.fillStyle = "#1b1024";
  x.beginPath();
  x.arc(144, 274, 2, 0, 7);
  x.arc(156, 274, 2, 0, 7);
  x.fill();
  // cauldron
  x.fillStyle = "#15111c";
  x.beginPath();
  x.ellipse(70, 430, 46, 36, 0, 0, 7);
  x.fill();
  x.fillStyle = "#2a2236";
  x.beginPath();
  x.ellipse(70, 405, 40, 12, 0, 0, 7);
  x.fill();
  x.fillStyle = "#3bd672";
  x.beginPath();
  x.ellipse(70, 405, 34, 9, 0, 0, 7);
  x.fill();
  // counter
  const cg = x.createLinearGradient(222, 0, 262, 0);
  cg.addColorStop(0, "#8a5a30");
  cg.addColorStop(0.5, "#6b4425");
  cg.addColorStop(1, "#3f2712");
  x.fillStyle = cg;
  x.fillRect(222, 120, 40, H - 120);
  x.fillStyle = "rgba(255,220,160,.25)";
  x.fillRect(222, 120, 4, H - 120);
  for (let i = 0; i < 7; i++) {
    x.fillStyle = jars[i % 5];
    x.globalAlpha = 0.9;
    x.beginPath();
    x.arc(242, 150 + i * 48, 6, 0, 7);
    x.fill();
    x.globalAlpha = 1;
  }
  return c;
}

// ---------- drawing helpers ----------
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hostile: boolean) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, s, 0, 7);
  ctx.fill();
  ctx.fillStyle = hostile ? "#c0182b" : "#1b1024";
  ctx.beginPath();
  ctx.arc(x - s * 0.3, y, s * 0.52, 0, 7);
  ctx.fill();
}

function face(ctx: CanvasRenderingContext2D, def: MonDef, cx: number, cy: number, s: number, hostile: boolean) {
  const L = def.look;
  const pos: number[] = L.eyes === 1 ? [cx] : [cx - s * 1.3, cx + s * 1.3];
  pos.forEach((px, i) => {
    eye(ctx, px, cy, s, hostile);
    if (hostile) {
      ctx.strokeStyle = "#1b1024";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      if (L.eyes === 1 || i === 0) {
        ctx.moveTo(px - s * 1.1, cy - s * 1.7);
        ctx.lineTo(px + s * 1.1, cy - s * 0.95);
      } else {
        ctx.moveTo(px - s * 1.1, cy - s * 0.95);
        ctx.lineTo(px + s * 1.1, cy - s * 1.7);
      }
      ctx.stroke();
    }
  });
  // mouth
  const my = cy + s * 2.3;
  ctx.strokeStyle = "#1b1024";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (hostile) ctx.arc(cx - s * 0.2, my + s * 0.8, s * 1.1, Math.PI * 1.1, Math.PI * 1.9);
  else ctx.arc(cx - s * 0.2, my - s * 0.4, s * 1.0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (L.teeth) {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      const tx = cx - s * 0.9 + i * s * 1.3;
      ctx.moveTo(tx, my + (hostile ? s * 0.0 : s * 0.3));
      ctx.lineTo(tx + s * 0.4, my + (hostile ? s * 0.0 : s * 0.3));
      ctx.lineTo(tx + s * 0.2, my + s * (hostile ? 0.8 : 1.0));
      ctx.fill();
    }
  }
}

function tri(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawBody(ctx: CanvasRenderingContext2D, m: Mon, t: number) {
  const d = m.def;
  const L = d.look;
  const r = d.r;
  const body = m.flash > 0 ? "#ffffff" : L.body;
  const belly = m.flash > 0 ? "#ffffff" : L.belly;
  const hostile = m.hostile;
  const flap = Math.sin(t * 10 + m.id) * 0.3;
  switch (L.shape) {
    case "blob": {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.85);
      ctx.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, r * 0.85);
      ctx.quadraticCurveTo(r * 0.5, r * 1.05, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.5, r * 0.65, -r, r * 0.85);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.25, r * 0.14, -0.5, 0, 7);
      ctx.fill();
      face(ctx, d, -r * 0.2, -r * 0.1, r * 0.17, hostile);
      break;
    }
    case "ghost": {
      ctx.globalAlpha *= 0.88;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, r);
      ctx.bezierCurveTo(-r * 1.1, -r * 1.3, r * 1.1, -r * 1.3, r * 0.85, r);
      for (let i = 0; i < 4; i++) {
        const sx = r * 0.85 - (i * r * 1.7) / 4;
        ctx.quadraticCurveTo(sx - r * 0.2, r * (i % 2 ? 0.75 : 1.25), sx - r * 0.425, r);
      }
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(-r * 0.05, r * 0.25, r * 0.4, r * 0.5, 0, 0, 7);
      ctx.globalAlpha *= 0.5;
      ctx.fill();
      ctx.globalAlpha /= 0.5;
      face(ctx, d, -r * 0.2, -r * 0.35, r * 0.15, hostile);
      if (L.hat) {
        ctx.fillStyle = L.hat;
        tri(ctx, -r * 0.55, -r * 0.85, r * 0.25, -r * 0.85, -r * 0.1, -r * 1.65);
        ctx.fillRect(-r * 0.7, -r * 0.9, r * 1.1, r * 0.12);
      }
      break;
    }
    case "biped": {
      ctx.fillStyle = body;
      ctx.fillRect(-r * 0.45, r * 0.5, r * 0.3, r * 0.5 + Math.sin(t * 9 + m.id) * 2);
      ctx.fillRect(r * 0.12, r * 0.5, r * 0.3, r * 0.5 - Math.sin(t * 9 + m.id) * 2);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.15, r * 0.68, r * 0.72, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(-r * 0.12, r * 0.25, r * 0.38, r * 0.45, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = body;
      if (L.ears) {
        tri(ctx, -r * 0.45, -r * 0.7, -r * 1.25, -r * 0.95, -r * 0.5, -r * 0.3);
        tri(ctx, r * 0.35, -r * 0.7, r * 1.05, -r * 0.9, r * 0.35, -r * 0.3);
      }
      ctx.beginPath();
      ctx.arc(-r * 0.05, -r * 0.6, r * 0.6, 0, 7);
      ctx.fill();
      face(ctx, d, -r * 0.2, -r * 0.68, r * 0.15, hostile);
      if (L.hat) {
        ctx.fillStyle = L.hat;
        ctx.fillRect(-r * 0.6, -r * 1.12, r * 1.1, r * 0.22);
        ctx.fillRect(-r * 0.4, -r * 1.5, r * 0.7, r * 0.42);
      }
      break;
    }
    case "imp": {
      ctx.fillStyle = body;
      ctx.globalAlpha *= 0.85;
      tri(ctx, r * 0.3, -r * 0.1, r * 1.3, -r * (0.9 + flap), r * 0.6, r * 0.5);
      tri(ctx, r * 0.1, -r * 0.2, r * 0.9, -r * (1.25 + flap), r * 0.5, r * 0.2);
      ctx.globalAlpha /= 0.85;
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, r * 0.7);
      ctx.quadraticCurveTo(r * 1.2, r * 0.9, r * 1.1, r * 0.3 + Math.sin(t * 8) * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.4, r * 0.6, r * 0.6, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, r * 0.5, r * 0.32, r * 0.38, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = body;
      if (L.ears) {
        tri(ctx, -r * 0.5, -r * 0.5, -r * 1.3, -r * 0.6, -r * 0.5, -r * 0.05);
        tri(ctx, r * 0.4, -r * 0.5, r * 1.1, -r * 0.65, r * 0.4, -r * 0.05);
      }
      ctx.beginPath();
      ctx.arc(-r * 0.08, -r * 0.35, r * 0.66, 0, 7);
      ctx.fill();
      if (L.horns) {
        ctx.fillStyle = "#3b1d2a";
        tri(ctx, -r * 0.5, -r * 0.75, -r * 0.3, -r * 1.35, -r * 0.1, -r * 0.85);
        tri(ctx, r * 0.1, -r * 0.85, r * 0.3, -r * 1.35, r * 0.4, -r * 0.7);
      }
      face(ctx, d, -r * 0.2, -r * 0.4, r * 0.16, hostile);
      break;
    }
    case "wisp": {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.6);
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(0.3, L.body);
      g.addColorStop(1, "rgba(155,107,255,0)");
      ctx.fillStyle = m.flash > 0 ? "#fff" : g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = body;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.3 + i * r * 0.3);
        ctx.quadraticCurveTo(r * 1.3, -r * 0.6 + i * r * 0.6 + Math.sin(t * 6 + i) * 6, r * 1.9, i * r * 0.4 - r * 0.2 + Math.sin(t * 5 + i) * 8);
        ctx.quadraticCurveTo(r * 1.0, i * r * 0.3, r * 0.3, r * 0.1 + i * r * 0.3);
        ctx.fill();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, 7);
      ctx.fill();
      face(ctx, d, -r * 0.1, -r * 0.1, r * 0.3, hostile);
      break;
    }
    case "brute": {
      ctx.fillStyle = body;
      ctx.fillRect(-r * 0.6, r * 0.6, r * 0.45, r * 0.4 + Math.sin(t * 6 + m.id) * 2);
      ctx.fillRect(r * 0.15, r * 0.6, r * 0.45, r * 0.4 - Math.sin(t * 6 + m.id) * 2);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.2, r * 1.0, r * 0.82, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, r * 0.3, r * 0.55, r * 0.5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = body;
      const sw = Math.sin(t * 6 + m.id) * r * 0.1;
      ctx.beginPath();
      ctx.ellipse(-r * 1.0, r * 0.35 + sw, r * 0.3, r * 0.34, 0, 0, 7);
      ctx.ellipse(r * 0.95, r * 0.35 - sw, r * 0.3, r * 0.34, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.65, r * 0.5, 0, 7);
      ctx.fill();
      if (L.horns) {
        ctx.fillStyle = "#e9dcc0";
        tri(ctx, -r * 0.6, -r * 0.95, -r * 0.75, -r * 1.5, -r * 0.35, -r * 1.05);
        tri(ctx, -r * 0.05, -r * 1.05, r * 0.2, -r * 1.5, r * 0.1, -r * 0.85);
      }
      face(ctx, d, -r * 0.35, -r * 0.7, r * 0.13, hostile);
      if (L.hat) {
        ctx.fillStyle = L.hat;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 1.05);
        for (let i = 0; i < 4; i++) {
          ctx.lineTo(-r * 0.65 + i * r * 0.3 + r * 0.15, -r * 1.5);
          ctx.lineTo(-r * 0.65 + (i + 1) * r * 0.3, -r * 1.05);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "dragon": {
      ctx.fillStyle = "#7d1c36";
      ctx.globalAlpha *= 0.9;
      tri(ctx, r * 0.2, -r * 0.3, r * 1.4, -r * (1.3 + flap), r * 1.0, r * 0.2);
      tri(ctx, -r * 0.2, -r * 0.3, r * 0.6, -r * (1.6 + flap), r * 0.6, r * 0.1);
      ctx.globalAlpha /= 0.9;
      ctx.strokeStyle = body;
      ctx.lineWidth = r * 0.22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(r * 0.8, r * 0.3);
      ctx.quadraticCurveTo(r * 1.6, r * 0.6, r * 1.5, r * 0.0 + Math.sin(t * 3) * 8);
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(r * 0.15, r * 0.2, r * 1.0, r * 0.7, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(r * 0.05, r * 0.4, r * 0.7, r * 0.4, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.fillRect(r * 0.15, r * 0.6, r * 0.3, r * 0.4);
      ctx.fillRect(-r * 0.35, r * 0.6, r * 0.3, r * 0.4);
      ctx.strokeStyle = body;
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.1);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.4, -r * 0.85, -r * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.95, -r * 0.65, r * 0.5, r * 0.34, 0.15, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#f5e6c8";
      tri(ctx, -r * 0.7, -r * 0.9, -r * 0.4, -r * 1.45, -r * 0.5, -r * 0.85);
      tri(ctx, -r * 1.0, -r * 0.9, -r * 0.95, -r * 1.4, -r * 0.8, -r * 0.88);
      ctx.fillStyle = "#5c1428";
      for (let i = 0; i < 5; i++) tri(ctx, -r * 0.3 + i * r * 0.3, -r * 0.35, -r * 0.15 + i * r * 0.3, -r * 0.65, r * 0.0 + i * r * 0.3, -r * 0.35);
      face(ctx, d, -r * 1.05, -r * 0.72, r * 0.11, hostile);
      break;
    }
  }
}

export function drawMonster(ctx: CanvasRenderingContext2D, m: Mon, t: number) {
  const d = m.def;
  const r = d.r;
  const bob = Math.sin(t * 6 + m.id) * (m.state === "walk" ? 2.5 : 1.2);
  ctx.save();
  ctx.translate(m.x, m.y + bob);
  ctx.globalAlpha = m.alpha;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, r * 1.0 - bob, r * 0.95, r * 0.22, 0, 0, 7);
  ctx.fill();
  if (m.hostile && m.state !== "leave") {
    ctx.strokeStyle = "rgba(255,70,70,.75)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, r * 1.0 - bob, r * 1.1, r * 0.28, 0, 0, 7);
    ctx.stroke();
  }
  if (m.state === "atk" && m.root <= 0) {
    const w = Math.max(0, 1 - m.atkT / 0.45);
    ctx.translate(-w * 14, 0);
    ctx.scale(1 + w * 0.1, 1 - w * 0.05);
  }
  if (m.shake > 0) ctx.translate(Math.sin(t * 80) * m.shake * 12, 0);
  if (m.root > 0) ctx.translate(0, 0);
  drawBody(ctx, m, t);
  // status overlays
  if (m.wet > 0) {
    ctx.strokeStyle = "rgba(90,200,255,.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 1.15, 0, 0, 7);
    ctx.stroke();
  }
  if (m.root > 0) {
    ctx.strokeStyle = "#5fbf4a";
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.9 - i * r * 0.55);
      ctx.bezierCurveTo(-r * 0.3, r * 0.5 - i * r * 0.55, r * 0.3, r * 1.3 - i * r * 0.55, r, r * 0.7 - i * r * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(ctx: CanvasRenderingContext2D, path: string, color: string, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path));
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,.5)";
  ctx.stroke(new Path2D(path));
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, m: Mon, good: boolean) {
  const o = m.order!;
  const n = o.key === "X" ? 1 : o.key.length;
  const w = 22 + n * 24;
  const h = 44;
  const bx = m.x - w / 2;
  const by = m.y - m.def.r - 14 - h - Math.sin(m.age * 3) * 1.5;
  ctx.save();
  ctx.fillStyle = good ? "rgba(235,255,235,.97)" : "rgba(255,250,240,.96)";
  ctx.strokeStyle = good ? "#3ddc84" : "#3a2b2b";
  ctx.lineWidth = good ? 3 : 2;
  roundRect(ctx, bx, by, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m.x - 6, by + h - 1);
  ctx.lineTo(m.x, by + h + 9);
  ctx.lineTo(m.x + 6, by + h - 1);
  ctx.fillStyle = good ? "rgba(235,255,235,.97)" : "rgba(255,250,240,.96)";
  ctx.fill();
  if (o.key === "X") {
    const cs = ["#ff6a3d", "#4cc9f0", "#7bd86b", "#ffd93d"];
    cs.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(m.x - 8 + (i % 2) * 16, by + 10 + Math.floor(i / 2) * 11, 4.5, 0, 7);
      ctx.fill();
    });
  } else {
    o.key.split("").forEach((e, i) => {
      const d = ING[e as El];
      drawIcon(ctx, d.path, d.color, bx + 11 + i * 24, by + 4, 22);
    });
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < o.tier ? "#f0a500" : "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.arc(m.x - 10 + i * 10, by + h - 7, 3.2, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Scene ----------
export class Scene {
  g: Game;
  mons: Mon[] = [];
  parts: Part[] = [];
  floats: Floater[] = [];
  projs: Proj[] = [];
  beams: Beam[] = [];
  time = 0;
  spawnIdx = 0;
  nextId = 1;
  shake = 0;
  redFlash = 0;
  cd = 0;
  runeT = 0;
  sel: string | null = null;
  combo = 0;
  lastServe = -99;
  mouse = { x: -1, y: -1 };
  paused = false;
  speed = 1;
  ending: "none" | "over" | "done" = "none";
  endT = 0;
  bg: HTMLCanvasElement;
  bossBanner = 0;
  emptyT = 0;
  anim = 0;

  constructor(g: Game) {
    this.g = g;
    this.bg = makeBackground();
    this.runeT = this.runeInterval();
  }

  runeInterval() {
    const l = this.g.upg.rune || 0;
    return l ? [6, 4.5, 3][l - 1] : 999;
  }

  // ----- helpers -----
  addFloat(x: number, y: number, text: string, color = "#fff", size = 18, life = 1.1) {
    this.floats.push({ x, y, text, color, life, max: life, size });
  }
  burst(x: number, y: number, color: string, n = 10, sp = 120, life = 0.6, grav = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(sp * 0.3, sp);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, color, size: rand(2, 5), grav, kind: "c" });
    }
  }
  ring(x: number, y: number, color: string) {
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, color, size: 10, grav: 0, kind: "r" });
  }

  shelfIndex(): number {
    if (!this.sel) return -1;
    const [k, t] = this.sel.split(":");
    return this.g.shelf.findIndex((p) => p.key === k && p.tier === Number(t));
  }

  selectStack(key: string | null) {
    this.sel = key;
  }

  hostiles() {
    return this.mons.filter((m) => m.hostile && m.state !== "leave" && m.hp > 0);
  }

  // ----- spawning -----
  spawn(type: string, lane: number, order: Order | undefined, hostile: boolean) {
    const def = MON[type];
    const g = this.g;
    let hp = def.hp;
    if (def.kind === "boss") hp *= bossHpMult(g.day);
    if (def.kind === "raid") hp *= 1 + Math.max(0, g.day - 6) * 0.06;
    const pat = (24 + (order ? (order.tier - 1) * 5 : 0)) * getPatienceMult(g);
    const boss = def.kind === "boss";
    const m: Mon = {
      id: this.nextId++, type, def, x: W + 40, y: boss ? 290 : LANES[lane] + rand(-6, 6), lane,
      tx: def.ranged ? def.ranged + rand(0, 50) : hostile ? SHOP_X + 55 + rand(0, 60) : SHOP_X + 62,
      hostile, state: "walk", hp, maxHp: hp, patience: pat, maxPat: pat, order, atkT: def.atkInt,
      burn: 0, burnDps: 0, wet: 0, root: 0, flash: 0, age: 0, alpha: 1, boss, shake: 0, summonT: 13,
    };
    if (boss) {
      m.tx = def.ranged ? def.ranged : SHOP_X + 90;
      this.bossBanner = 3;
      sfx.boss();
      this.shake = 10;
    }
    this.mons.push(m);
    return m;
  }

  freeLane(): number {
    const used = new Set(this.mons.filter((m) => !m.hostile && m.state !== "leave").map((m) => m.lane));
    const free = [0, 1, 2, 3].filter((l) => !used.has(l));
    return free.length ? rpick(free) : -1;
  }

  // ----- combat -----
  dealDamage(m: Mon, amt: number, silent = false) {
    if (m.hp <= 0) return;
    m.hp -= amt;
    m.flash = 0.12;
    if (!silent) this.addFloat(m.x + rand(-10, 10), m.y - m.def.r - 8, String(Math.round(amt)), "#ffe27a", 18 + Math.min(14, amt / 6));
    if (m.hp <= 0) {
      m.hp = 0;
      this.onKilled(m, m.x, m.y);
    }
  }

  onKilled(m: Mon, px: number, py: number) {
    const g = this.g;
    const c = m.def.look.body;
    this.burst(px, py, c, 26, 240, 0.9);
    this.burst(px, py, "#ffffff", 8, 160, 0.5);
    this.ring(px, py, c);
    sfx.kill();
    const bounty = m.def.bounty;
    g.gold += bounty;
    g.stats.earned += bounty;
    g.totals.earned += bounty;
    g.stats.killed++;
    g.totals.killed++;
    this.addFloat(px, py - m.def.r - 10, `+${bounty}g bounty`, "#ffd45e", 18, 1.4);
    const drops = m.boss ? 3 : Math.random() < 0.35 ? 1 : 0;
    for (let i = 0; i < drops; i++) {
      const e = rpick(EL_ORDER);
      g.inv[e]++;
      this.addFloat(px + i * 18, py - m.def.r + 12, `+${ING[e].short}`, ING[e].color, 15, 1.6);
    }
    if (m.boss) {
      this.shake = 16;
      sfx.boom();
      for (let i = 0; i < 6; i++) this.burst(px + rand(-50, 50), py + rand(-50, 50), rpick(["#ffd45e", "#ff6a3d", "#fff"]), 18, 260, 1);
    }
  }

  hitShop(m: Mon) {
    const g = this.g;
    const dmg = m.def.dmg;
    g.integrity -= dmg;
    g.stats.integrityLost += dmg;
    this.shake = Math.max(this.shake, 4 + dmg * 0.5);
    this.redFlash = 0.35;
    sfx.hurt();
    this.addFloat(SHOP_X - 10, m.y - 10, `-${dmg}`, "#ff5a5a", 24, 1.2);
    this.burst(SHOP_X, m.y, "#8a5a30", 10, 160, 0.6);
    if (m.def.steal > 0 && g.gold > 0) {
      const s = Math.min(g.gold, m.def.steal);
      g.gold -= s;
      g.stats.stolen += s;
      this.addFloat(m.x, m.y - m.def.r - 10, `-${s}g stolen!`, "#ff9f5a", 16, 1.3);
    }
    if (g.integrity <= 0) {
      g.integrity = 0;
      this.ending = "over";
      this.endT = 0;
      sfx.lose();
    }
  }

  enrage(m: Mon) {
    m.hostile = true;
    m.state = "atk";
    m.atkT = 1.0;
    this.g.stats.angry++;
    this.addFloat(m.x, m.y - m.def.r - 20, "ENRAGED!", "#ff4d4d", 22, 1.5);
    sfx.enrage();
    this.burst(m.x, m.y, "#ff3b3b", 14, 150, 0.6, -40);
  }

  applyPotion(m: Mon, p: Potion) {
    const power = potionPower(p.key, p.tier);
    const els = p.key === "X" ? [] : p.key.split("");
    const x = m.x;
    const y = m.y;
    const col = p.key === "X" ? "#b14cff" : ING[els[0] as El].color;
    if (p.key === "X") {
      sfx.boom();
      this.shake = Math.max(this.shake, 9);
      this.ring(x, y, "#b14cff");
      this.burst(x, y, "#b14cff", 30, 260, 0.9);
      this.burst(x, y, "#46e08a", 20, 220, 0.9);
      for (const h of this.hostiles()) {
        this.dealDamage(h, power * (h.boss ? 0.8 : 1));
        if (h.hp > 0) {
          const e = rpick(EL_ORDER);
          this.applyStatus(h, [e], p.tier);
        }
      }
      return;
    }
    let dmg = power;
    if (m.def.weak && els.includes(m.def.weak)) {
      dmg *= 2;
      this.addFloat(x, y - m.def.r - 34, "WEAK!", "#7dffb0", 16, 1.0);
    }
    if (m.wet > 0 && els.includes("S")) {
      dmg *= 1.5;
      this.addFloat(x, y - m.def.r - 50, "SHOCK!", "#ffe94d", 16, 1.0);
    }
    sfx.hit();
    this.burst(x, y, col, 16, 200, 0.6);
    this.ring(x, y, col);
    this.dealDamage(m, dmg);
    if (m.hp > 0) this.applyStatus(m, els, p.tier);
  }

  applyStatus(m: Mon, els: string[], tier: number) {
    const bossMul = m.boss ? 0.5 : 1;
    if (els.includes("E")) {
      m.burn = 3;
      m.burnDps = 3 * tier;
    }
    if (els.includes("D")) m.wet = 4;
    if (els.includes("M")) m.root = (1.2 + 0.6 * tier) * bossMul;
    if (els.includes("S")) {
      m.x = Math.min(W - 20, m.x + (m.boss ? 12 : 35 + 20 * tier));
      m.atkT = Math.max(m.atkT, 0.9);
      if (m.x > m.tx + 2 && m.state === "atk") m.state = "walk";
      if (m.x > m.tx + 2 && m.state === "wait") m.state = "walk";
    }
  }

  throwPotion(m: Mon) {
    const idx = this.shelfIndex();
    if (idx < 0) return;
    const p = this.g.shelf.splice(idx, 1)[0];
    if (this.shelfIndex() < 0) this.sel = null;
    this.cd = getThrowCd(this.g);
    sfx.throw();
    const col = p.key === "X" ? "#b14cff" : ING[p.key[0] as El].color;
    this.projs.push({
      x0: SHOP_X - 10, y0: 450, x1: m.x, y1: m.y, t: 0, dur: 0.28, color: col, arc: 70, target: m,
      onHit: () => {
        if (m.hp > 0 && m.state !== "leave") this.applyPotion(m, p);
        else if (p.key === "X") this.applyPotion(m, p);
        else {
          this.burst(m.x, m.y, col, 10, 150, 0.5);
          sfx.hit();
        }
      },
    });
  }

  swat(m: Mon) {
    this.cd = getThrowCd(this.g) * 0.8;
    sfx.swat();
    this.burst(m.x, m.y, "#ffffff", 6, 120, 0.3);
    this.dealDamage(m, 4);
    m.x = Math.min(W - 20, m.x + 8);
  }

  serve(m: Mon) {
    const g = this.g;
    const idx = this.shelfIndex();
    const o = m.order!;
    if (idx < 0) {
      this.addFloat(m.x, m.y - m.def.r - 70, "Pick a potion first!", "#ffffff", 15, 1.2);
      sfx.error();
      return;
    }
    const p = g.shelf[idx];
    if (p.key !== o.key) {
      this.addFloat(m.x, m.y - m.def.r - 70, "That's not what I ordered!", "#ff8a8a", 15, 1.4);
      m.patience -= m.maxPat * 0.08;
      m.shake = 0.4;
      sfx.error();
      return;
    }
    if (p.tier < o.tier) {
      this.addFloat(m.x, m.y - m.def.r - 70, `Too weak! I want tier ${ROMAN[o.tier]}+`, "#ff8a8a", 15, 1.4);
      m.patience -= m.maxPat * 0.08;
      m.shake = 0.4;
      sfx.error();
      return;
    }
    g.shelf.splice(idx, 1);
    if (this.shelfIndex() < 0) this.sel = null;
    if (this.time - this.lastServe < 10) this.combo++;
    else this.combo = 1;
    this.lastServe = this.time;
    g.stats.bestCombo = Math.max(g.stats.bestCombo, this.combo);
    const comboMul = 1 + Math.min(0.5, (this.combo - 1) * 0.1);
    const frac = Math.max(0, m.patience / m.maxPat);
    const pay = Math.round(potionValue(p.key, p.tier) * getPriceMult(g) * (0.8 + 0.4 * frac) * comboMul);
    g.gold += pay;
    g.stats.earned += pay;
    g.totals.earned += pay;
    g.stats.served++;
    g.totals.served++;
    m.state = "leave";
    sfx.coin();
    this.addFloat(m.x, m.y - m.def.r - 26, `+${pay}g`, "#ffd45e", 24, 1.3);
    if (this.combo > 1) this.addFloat(m.x, m.y - m.def.r - 50, `Combo x${this.combo}!`, "#7dffb0", 15, 1.2);
    else if (frac > 0.7) this.addFloat(m.x, m.y - m.def.r - 50, "Quick service!", "#9fe8ff", 14, 1.1);
    this.burst(m.x, m.y - 10, "#ffd45e", 14, 170, 0.8, 120);
    this.burst(m.x, m.y - 10, "#ff7aa8", 6, 90, 1.0, -40);
  }

  pick(px: number, py: number): Mon | null {
    const list = [...this.mons].filter((m) => m.state !== "leave" && m.hp > 0).sort((a, b) => b.y - a.y);
    for (const m of list) {
      const r = m.def.r;
      if (Math.hypot(px - m.x, py - m.y) < r + 12) return m;
      if (!m.hostile && m.order && px > m.x - 50 && px < m.x + 50 && py > m.y - r - 62 && py < m.y - r - 6) return m;
    }
    return null;
  }

  click(px: number, py: number) {
    if (this.paused || this.ending !== "none") return;
    const m = this.pick(px, py);
    if (!m) return;
    if (m.hostile) {
      if (this.cd > 0) return;
      if (this.shelfIndex() >= 0) this.throwPotion(m);
      else this.swat(m);
    } else if (m.order) {
      this.serve(m);
    }
  }

  // ----- update -----
  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.05);
    if (this.paused) return;
    for (let i = 0; i < this.speed; i++) this.step(dt);
  }

  step(dt: number) {
    this.anim += dt;
    // particles & floaters always
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.redFlash = Math.max(0, this.redFlash - dt);
    this.bossBanner = Math.max(0, this.bossBanner - dt);

    if (this.ending !== "none") {
      this.endT += dt;
      return;
    }

    this.time += dt;
    this.cd -= dt;
    const g = this.g;

    // spawn
    while (this.spawnIdx < g.schedule.length && g.schedule[this.spawnIdx].t <= this.time) {
      const ev = g.schedule[this.spawnIdx];
      if (ev.kind === "cust") {
        const lane = this.freeLane();
        if (lane < 0) break;
        this.spawn(ev.type, lane, ev.order, false);
      } else {
        this.spawn(ev.type, Math.floor(Math.random() * 4), undefined, true);
      }
      this.spawnIdx++;
    }

    // monsters
    for (const m of this.mons) {
      if (m.hp <= 0) continue;
      m.age += dt;
      m.flash = Math.max(0, m.flash - dt);
      m.shake = Math.max(0, m.shake - dt);
      if (m.burn > 0) {
        m.burn -= dt;
        this.dealDamage(m, m.burnDps * dt, true);
        if (Math.random() < dt * 18) this.parts.push({ x: m.x + rand(-m.def.r, m.def.r) * 0.6, y: m.y + rand(-m.def.r, m.def.r * 0.4), vx: rand(-10, 10), vy: -60, life: 0.5, max: 0.5, color: rpick(["#ff6a3d", "#ffb347"]), size: rand(2, 4), grav: -50, kind: "c" });
        if (m.hp <= 0) continue;
      }
      if (m.wet > 0) {
        m.wet -= dt;
        if (Math.random() < dt * 8) this.parts.push({ x: m.x + rand(-m.def.r, m.def.r) * 0.7, y: m.y - m.def.r * 0.6, vx: 0, vy: 20, life: 0.6, max: 0.6, color: "#6fd6ff", size: 2.5, grav: 200, kind: "c" });
      }
      if (m.root > 0) m.root -= dt;
      if (m.state === "leave") {
        m.x += 140 * dt;
        m.alpha -= dt * 0.7;
        continue;
      }
      const frozen = m.root > 0;
      const speedMul = m.wet > 0 ? 0.55 : 1;
      if (m.state === "walk") {
        if (!frozen) m.x -= m.def.speed * speedMul * dt;
        if (m.x <= m.tx) {
          m.x = m.tx;
          if (m.hostile) {
            m.state = "atk";
            m.atkT = m.def.atkInt * 0.6;
          } else {
            m.state = "wait";
            if (m.def.quirks.length) this.addFloat(m.x, m.y - m.def.r - 68, rpick(m.def.quirks), "#f5ecd7", 13, 3);
          }
        }
      } else if (m.state === "wait") {
        m.patience -= dt;
        if (m.patience <= 0) this.enrage(m);
      } else if (m.state === "atk" && !frozen) {
        m.atkT -= dt;
        if (m.atkT <= 0) {
          m.atkT = m.def.atkInt;
          if (m.def.ranged) {
            const col = m.def.look.body;
            this.projs.push({ x0: m.x - 10, y0: m.y, x1: SHOP_X, y1: m.y, t: 0, dur: 0.45, color: col, arc: 0, onHit: () => this.hitShop(m) });
          } else this.hitShop(m);
        }
      }
    }

    // boss summons (dragon)
    for (const m of this.mons) {
      if (m.type === "dragon" && m.hp > 0 && m.state !== "leave") {
        m.summonT -= dt;
        if (m.summonT <= 0) {
          m.summonT = 13;
          for (let i = 0; i < 2; i++) this.spawn("sprinter", Math.floor(Math.random() * 4), undefined, true);
          this.addFloat(m.x, m.y - m.def.r - 30, "Minions, attack!", "#ff9a9a", 18, 1.6);
          sfx.enrage();
        }
      }
    }

    // projectiles
    for (const p of this.projs) {
      p.t += dt;
      if (p.t >= p.dur) p.onHit();
    }
    this.projs = this.projs.filter((p) => p.t < p.dur);

    // rune turret
    if (g.upg.rune) {
      this.runeT -= dt;
      if (this.runeT <= 0) {
        const hs = this.hostiles().filter((h) => h.x < W - 30).sort((a, b) => a.x - b.x);
        if (hs.length) {
          const h = hs[0];
          const dmg = [20, 30, 42][g.upg.rune - 1];
          this.beams.push({ x1: 205, y1: 105, x2: h.x, y2: h.y, life: 0.2, color: "#b9a0ff" });
          sfx.zap();
          this.burst(h.x, h.y, "#b9a0ff", 10, 160, 0.4);
          this.dealDamage(h, dmg);
          h.root = Math.max(h.root, 0.4);
          this.runeT = this.runeInterval();
        } else this.runeT = 0.3;
      }
    }

    // remove dead / departed monsters
    this.mons = this.mons.filter((m) => {
      if (m.hp <= 0) return false;
      if (m.state === "leave" && (m.alpha <= 0 || m.x > W + 80)) return false;
      return true;
    });

    // end of day
    if (this.spawnIdx >= g.schedule.length && this.mons.length === 0 && this.projs.length === 0) {
      this.emptyT += dt;
      if (this.emptyT > 0.8) {
        this.ending = "done";
        this.endT = 0;
        sfx.dayEnd();
      }
    } else this.emptyT = 0;
  }

  // ----- draw -----
  draw(ctx: CanvasRenderingContext2D) {
    const t = this.anim;
    const g = this.g;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    ctx.drawImage(this.bg, 0, 0);

    // shop damage cracks
    const maxI = 100 + 25 * (g.upg.walls || 0);
    const dmgFrac = 1 - g.integrity / maxI;
    const nCr = Math.floor(dmgFrac * 12);
    ctx.strokeStyle = "rgba(0,0,0,.65)";
    ctx.lineWidth = 2;
    for (let i = 0; i < nCr; i++) {
      ctx.beginPath();
      CRACKS[i].forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
    // cauldron bubbles + lantern glow
    for (let i = 0; i < 3; i++) {
      const bp = (t * 0.8 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(120,255,170,${0.7 * (1 - bp)})`;
      ctx.beginPath();
      ctx.arc(58 + i * 12 + Math.sin(t * 3 + i) * 3, 404 - bp * 40, 3 + bp * 3, 0, 7);
      ctx.fill();
    }
    [135, 330].forEach((ly, i) => {
      const fl = 0.75 + Math.sin(t * 7 + i * 2) * 0.12 + Math.random() * 0.05;
      const gr = ctx.createRadialGradient(262, ly, 2, 262, ly, 70);
      gr.addColorStop(0, `rgba(255,190,90,${0.55 * fl})`);
      gr.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(190, ly - 70, 150, 140);
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(262, ly, 5, 0, 7);
      ctx.fill();
    });
    // rune crystal
    if (g.upg.rune) {
      const fl = 0.8 + Math.sin(t * 4) * 0.2;
      ctx.save();
      ctx.translate(205, 105 + Math.sin(t * 2) * 3);
      const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      gg.addColorStop(0, `rgba(200,170,255,${fl})`);
      gg.addColorStop(1, "rgba(150,110,255,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(-30, -30, 60, 60);
      ctx.fillStyle = "#c8aaff";
      tri(ctx, 0, -14, 9, 0, 0, 14);
      tri(ctx, 0, -14, -9, 0, 0, 14);
      ctx.restore();
    }

    // monsters
    const sorted = [...this.mons].sort((a, b) => a.y - b.y);
    const hover = this.paused ? null : this.pick(this.mouse.x, this.mouse.y);
    const sel = this.shelfIndex() >= 0 ? this.g.shelf[this.shelfIndex()] : null;
    for (const m of sorted) {
      drawMonster(ctx, m, t);
      if (hover === m) {
        ctx.save();
        const hostile = m.hostile;
        let ok = true;
        if (!hostile && sel && m.order) ok = sel.key === m.order.key && sel.tier >= m.order.tier;
        ctx.strokeStyle = hostile ? "rgba(255,90,90,.9)" : ok ? "rgba(90,255,150,.9)" : "rgba(255,200,90,.9)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.def.r + 10, 0, 7);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,.8)";
        ctx.fillStyle = "#fff";
        const label = m.def.name + (m.order ? ` - ${POTIONS[m.order.key].name} ${ROMAN[m.order.tier]}+` : "");
        ctx.strokeText(label, m.x, m.y + m.def.r + 24);
        ctx.fillText(label, m.x, m.y + m.def.r + 24);
        ctx.restore();
      }
    }
    // bubbles, bars
    for (const m of sorted) {
      if (m.state === "leave") continue;
      if (!m.hostile && m.order) {
        const good = !!sel && sel.key === m.order.key && sel.tier >= m.order.tier;
        drawBubble(ctx, m, good);
        const frac = Math.max(0, m.patience / m.maxPat);
        const bw = 50;
        const by = m.y + m.def.r + 6;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        roundRect(ctx, m.x - bw / 2 - 1, by - 1, bw + 2, 8, 4);
        ctx.fill();
        ctx.fillStyle = `hsl(${frac * 120},80%,50%)`;
        roundRect(ctx, m.x - bw / 2, by, Math.max(2, bw * frac), 6, 3);
        ctx.fill();
      } else if (m.hostile && !m.boss) {
        const bw = 52;
        const by = m.y - m.def.r - 16;
        ctx.fillStyle = "rgba(0,0,0,.6)";
        roundRect(ctx, m.x - bw / 2 - 1, by - 1, bw + 2, 9, 4);
        ctx.fill();
        ctx.fillStyle = "#e5484d";
        roundRect(ctx, m.x - bw / 2, by, Math.max(2, (bw * m.hp) / m.maxHp), 7, 3);
        ctx.fill();
        if (m.def.weak) {
          const d = ING[m.def.weak];
          ctx.fillStyle = "rgba(0,0,0,.65)";
          ctx.beginPath();
          ctx.arc(m.x + bw / 2 + 12, by + 3, 10, 0, 7);
          ctx.fill();
          drawIcon(ctx, d.path, d.color, m.x + bw / 2 + 3, by - 6, 18);
        }
      }
    }

    // projectiles
    for (const p of this.projs) {
      const k = p.t / p.dur;
      const x = p.x0 + (p.x1 - p.x0) * k;
      const y = p.y0 + (p.y1 - p.y0) * k - Math.sin(Math.PI * k) * p.arc;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, p.arc ? 8 : 10, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (p.arc) {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, 3, 0, 7);
        ctx.fill();
      }
    }
    // beams
    for (const b of this.beams) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 4 * (b.life / 0.2);
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const segs = 6;
      for (let i = 1; i < segs; i++) {
        const k = i / segs;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * k + rand(-10, 10), b.y1 + (b.y2 - b.y1) * k + rand(-10, 10));
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // particles
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      ctx.globalAlpha = k;
      if (p.kind === "r") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + (1 - k) * 60, 0, 7);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // floaters
    ctx.textAlign = "center";
    for (const f of this.floats) {
      const k = Math.min(1, f.life / (f.max * 0.5));
      ctx.globalAlpha = k;
      ctx.font = `bold ${f.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(10,5,20,.85)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // boss bar
    const boss = this.mons.find((m) => m.boss && m.hp > 0);
    if (boss) {
      const bw = 420;
      const bx = (W - bw) / 2 + 100;
      ctx.fillStyle = "rgba(0,0,0,.65)";
      roundRect(ctx, bx - 4, 10, bw + 8, 30, 8);
      ctx.fill();
      ctx.fillStyle = "#d33c4a";
      roundRect(ctx, bx, 14, Math.max(4, (bw * boss.hp) / boss.maxHp), 14, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(boss.def.name.toUpperCase(), bx + 4, 37);
      if (boss.def.weak) {
        const d = ING[boss.def.weak];
        ctx.textAlign = "right";
        ctx.fillText("WEAK TO", bx + bw - 26, 37);
        drawIcon(ctx, d.path, d.color, bx + bw - 22, 26, 16);
      }
    }
    if (this.bossBanner > 0) {
      ctx.globalAlpha = Math.min(1, this.bossBanner);
      ctx.fillStyle = "rgba(120,0,20,.55)";
      ctx.fillRect(0, 200, W, 80);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 40px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("BOSS INCOMING", W / 2, 252);
      ctx.globalAlpha = 1;
    }
    if (this.redFlash > 0) {
      ctx.fillStyle = `rgba(255,30,30,${this.redFlash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    // low integrity vignette
    if (g.integrity / maxI < 0.3) {
      const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560);
      v.addColorStop(0, "rgba(255,0,0,0)");
      v.addColorStop(1, `rgba(200,0,0,${0.25 + Math.sin(t * 5) * 0.08})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  get dayProgress() {
    return Math.min(1, this.time / DAY_LEN);
  }
}
