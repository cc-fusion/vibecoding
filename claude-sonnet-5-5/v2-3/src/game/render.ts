import { ENEMIES, LM, PINS, TERRAIN } from "./data";
import { HEX, hash2, hexDist, toPixel } from "./hex";
import type { Game } from "./engine";
import type { TerrainId, Tile } from "./types";

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const BODY_FONT = '"IM Fell English",Georgia,serif';
const FAKE_ICONS = ["☠️", "🏛️", "⚠️", "❔", "🕯️", "👁️"];
const FAKE_TERR: TerrainId[] = ["meadow", "forest", "hills", "mountain", "marsh", "ash", "ruins"];

let parchment: HTMLCanvasElement | null = null;
let nightK = 0;

function getParchment(): HTMLCanvasElement {
  if (parchment) return parchment;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#dcc99f";
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},20,${Math.random() * 0.09})`;
    const s = Math.random() * 3 + 0.5;
    x.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  for (let i = 0; i < 30; i++) {
    x.strokeStyle = `rgba(120,90,50,${Math.random() * 0.07})`;
    x.beginPath();
    const px = Math.random() * 256, py = Math.random() * 256;
    x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.random() * 40 - 20, py + Math.random() * 40 - 20, px + Math.random() * 60 - 30, py + Math.random() * 60 - 30);
    x.stroke();
  }
  parchment = c;
  return c;
}

export function screenToWorld(g: Game, sx: number, sy: number, w: number, h: number) {
  return { x: (sx - w / 2) / g.cam.zoom + g.cam.x, y: (sy - h / 2) / g.cam.zoom + g.cam.y };
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed = 0, jit = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    let px = x + s * Math.cos(a);
    let py = y + s * Math.sin(a);
    if (jit) {
      px += (hash2(i, Math.floor(seed * 1000), 3) - 0.5) * jit;
      py += (hash2(i, Math.floor(seed * 1000), 9) - 0.5) * jit;
    }
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function glyph(ctx: CanvasRenderingContext2D, id: TerrainId, x: number, y: number, s: number, alpha: number, color: string, seed: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (id) {
    case "mountain":
      ctx.moveTo(x - s * 0.55, y + s * 0.3);
      ctx.lineTo(x - s * 0.2, y - s * 0.3);
      ctx.lineTo(x + s * 0.05, y + s * 0.08);
      ctx.lineTo(x + s * 0.25, y - s * 0.18);
      ctx.lineTo(x + s * 0.58, y + s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.33, y - s * 0.08);
      ctx.lineTo(x - s * 0.2, y - s * 0.16);
      ctx.lineTo(x - s * 0.08, y - s * 0.06);
      ctx.stroke();
      break;
    case "hills":
      ctx.arc(x - s * 0.22, y + s * 0.2, s * 0.3, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.24, y + s * 0.24, s * 0.26, Math.PI, 0);
      ctx.stroke();
      break;
    case "forest":
      for (const [dx, dy] of [[-0.28, 0.12], [0.2, 0.16], [-0.02, -0.18]]) {
        const cx = x + dx * s, cy = y + dy * s;
        ctx.moveTo(cx, cy - s * 0.24);
        ctx.lineTo(cx + s * 0.15, cy + s * 0.08);
        ctx.lineTo(cx - s * 0.15, cy + s * 0.08);
        ctx.closePath();
        ctx.moveTo(cx, cy + s * 0.08);
        ctx.lineTo(cx, cy + s * 0.2);
      }
      ctx.stroke();
      break;
    case "meadow":
      for (const [dx, dy] of [[-0.3, 0.1], [0.12, 0.2], [0.02, -0.18], [0.3, -0.05]]) {
        const cx = x + dx * s, cy = y + dy * s;
        ctx.moveTo(cx - s * 0.08, cy - s * 0.1);
        ctx.lineTo(cx, cy + s * 0.05);
        ctx.lineTo(cx + s * 0.08, cy - s * 0.1);
      }
      ctx.stroke();
      break;
    case "marsh":
      for (const dy of [-0.1, 0.12]) {
        ctx.moveTo(x - s * 0.4, y + dy * s);
        ctx.quadraticCurveTo(x - s * 0.2, y + dy * s - s * 0.1, x, y + dy * s);
        ctx.quadraticCurveTo(x + s * 0.2, y + dy * s + s * 0.1, x + s * 0.4, y + dy * s);
      }
      ctx.moveTo(x + s * 0.22, y - s * 0.12);
      ctx.lineTo(x + s * 0.22, y - s * 0.42);
      ctx.moveTo(x + s * 0.32, y - s * 0.1);
      ctx.lineTo(x + s * 0.34, y - s * 0.36);
      ctx.stroke();
      break;
    case "ash":
      for (let i = 0; i < 6; i++) {
        const dx = (hash2(i, Math.floor(seed * 100), 1) - 0.5) * s * 0.9;
        const dy = (hash2(i, Math.floor(seed * 100), 2) - 0.5) * s * 0.7;
        ctx.moveTo(x + dx + 1.5, y + dy);
        ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + s * 0.2);
      ctx.lineTo(x - s * 0.1, y);
      ctx.lineTo(x - s * 0.18, y - s * 0.12);
      ctx.lineTo(x + s * 0.12, y - s * 0.28);
      ctx.stroke();
      break;
    case "ruins":
      ctx.rect(x - s * 0.36, y - s * 0.05, s * 0.16, s * 0.38);
      ctx.moveTo(x - s * 0.36, y - s * 0.05);
      ctx.lineTo(x - s * 0.28, y - s * 0.16);
      ctx.lineTo(x - s * 0.2, y - s * 0.05);
      ctx.rect(x + s * 0.06, y + s * 0.1, s * 0.16, s * 0.23);
      ctx.moveTo(x - s * 0.12, y + s * 0.33);
      ctx.lineTo(x + s * 0.4, y + s * 0.33);
      ctx.stroke();
      break;
    case "lake":
      for (const dy of [-0.18, 0.02, 0.22]) {
        ctx.moveTo(x - s * 0.4, y + dy * s);
        ctx.quadraticCurveTo(x - s * 0.2, y + dy * s - s * 0.12, x, y + dy * s);
        ctx.quadraticCurveTo(x + s * 0.2, y + dy * s + s * 0.12, x + s * 0.4, y + dy * s);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function emoji(ctx: CanvasRenderingContext2D, e: string, x: number, y: number, size: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, x, y);
  ctx.restore();
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = "#2a1d12", halo = "rgba(235,220,180,0.9)") {
  ctx.save();
  ctx.font = `${size}px ${BODY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function featureIcon(g: Game, t: Tile): { icon: string; kind: string } | null {
  const f = t.feature;
  const hallu = g.isHallu(t);
  const bucket = Math.floor(g.time / 4);
  if (f && (f.kind === "landmark" ? t.ls.disc : !t.done)) {
    if (hallu && f.kind !== "landmark" && hash2(t.q, t.r, bucket) < 0.5) return null;
    if (f.kind === "landmark") return { icon: LM[f.id].emoji, kind: "lm" };
    if (f.kind === "lair") return { icon: ENEMIES[f.enemy].emoji, kind: "lair" };
    if (f.kind === "hazard") return { icon: "⚠️", kind: "hazard" };
    if (f.kind === "event") return { icon: "❔", kind: "event" };
    return { icon: "🎁", kind: "cache" };
  }
  if (hallu && hash2(t.q, t.r, bucket + 11) < 0.35) {
    return { icon: FAKE_ICONS[Math.floor(hash2(t.q, t.r, bucket + 5) * FAKE_ICONS.length)], kind: "fake" };
  }
  return null;
}

export function render(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, dt: number) {
  const cam = g.cam;
  if (!cam.manual) {
    const k = 1 - Math.exp(-5 * dt);
    cam.x += (g.vx - cam.x) * k;
    cam.y += (g.vy - cam.y) * k;
  }
  const settings = g.save.settings;
  const shk = settings.shake ? g.fx.shake : 0;
  const sx = (Math.random() - 0.5) * shk;
  const sy = (Math.random() - 0.5) * shk;
  const z = cam.zoom;
  const t = g.rt;

  // background
  ctx.fillStyle = "#cdb98c";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + sx, h / 2 + sy);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);
  const x0 = cam.x - w / 2 / z - 80, x1 = cam.x + w / 2 / z + 80;
  const y0 = cam.y - h / 2 / z - 80, y1 = cam.y + h / 2 / z + 80;
  const pat = ctx.createPattern(getParchment(), "repeat");
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // ---- tiles ----
  const S = HEX - 0.6;
  const psyc = settings.psycho;
  const vis = g.vision();
  const night = g.isNight();
  for (const tile of g.tiles) {
    const p = toPixel(tile.q, tile.r);
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (tile.state === 0) {
      hexPath(ctx, p.x, p.y, S);
      ctx.strokeStyle = "rgba(90,65,35,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      continue;
    }
    const halluT = psyc && g.isHallu(tile);
    let tid: TerrainId = tile.state === 2 ? tile.terrain : tile.seen;
    if (halluT) {
      const alt = FAKE_TERR[Math.floor(hash2(tile.q, tile.r, Math.floor(g.time / 4) + 7) * FAKE_TERR.length)];
      if (alt !== tid && tid !== "lake") tid = alt;
    }
    const T = TERRAIN[tid];
    if (tile.state === 1) {
      const a = Math.min(1, (t - tile.glimT) * 2);
      hexPath(ctx, p.x, p.y, S, tile.seed, 2);
      ctx.globalAlpha = 0.3 * a;
      ctx.fillStyle = T.color;
      ctx.fill();
      ctx.globalAlpha = 0.5 * a;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = T.edge;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      glyph(ctx, tid, p.x, p.y, S * 0.8, 0.4 * a, T.edge, tile.seed);
      const sh = t - tile.shiftT;
      if (sh < 40 && sh > 0 && tile.shiftT > 0) {
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 4 + tile.seed * 10);
        ctx.strokeStyle = "#9a6ad0";
        ctx.lineWidth = 2;
        hexPath(ctx, p.x, p.y, S * 0.8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      const age = t - tile.chartT;
      const pop = age < 0.5 ? 0.82 + 0.18 * Math.min(1, age / 0.35) + Math.sin(Math.min(1, age / 0.5) * Math.PI) * 0.06 : 1;
      hexPath(ctx, p.x, p.y, S * pop, tile.seed, 2.2);
      const grd = ctx.createLinearGradient(p.x - S, p.y - S, p.x + S, p.y + S);
      grd.addColorStop(0, T.color);
      grd.addColorStop(1, T.edge);
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = T.color;
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#3a2a18";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      glyph(ctx, tid, p.x, p.y + 1, S * 0.82, 0.9, "#34261a", tile.seed);
      if (age < 0.5) {
        ctx.globalAlpha = (1 - age / 0.5) * 0.5;
        ctx.fillStyle = "#fff6d8";
        hexPath(ctx, p.x, p.y, S);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // hallucination distortion marker
    if (halluT && tile.pin === 0) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#6a2a8a";
      hexPath(ctx, p.x + Math.sin(t * 3 + tile.seed * 9) * 2, p.y, S);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // erased
    if (tile.erased) {
      ctx.fillStyle = "#17100a";
      ctx.globalAlpha = 0.93;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + tile.seed * 6;
        const r = S * (0.75 + 0.35 * Math.sin(t * 1.5 + i * 2 + tile.seed * 20));
        ctx.moveTo(p.x + Math.cos(a) * r * 0.2 + r * 0.55, p.y + Math.sin(a) * r * 0.2);
        ctx.arc(p.x + Math.cos(a) * r * 0.45, p.y + Math.sin(a) * r * 0.45, r * 0.55, 0, Math.PI * 2);
      }
      ctx.fill();
      hexPath(ctx, p.x, p.y, S * 0.92);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#8a5ab5";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // feature icons (charted only)
    if (tile.state === 2) {
      const fi = featureIcon(g, tile);
      if (fi) {
        const bob = fi.kind === "lm" ? Math.sin(t * 2 + tile.seed * 8) * 1.5 : 0;
        if (fi.kind === "lair") {
          ctx.fillStyle = "rgba(139,43,34,0.35)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, S * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (fi.kind === "lm") {
          const gl = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, S * 0.9);
          gl.addColorStop(0, "rgba(255,230,150,0.55)");
          gl.addColorStop(1, "rgba(255,230,150,0)");
          ctx.fillStyle = gl;
          ctx.beginPath();
          ctx.arc(p.x, p.y, S * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        emoji(ctx, fi.icon, p.x, p.y + bob, fi.kind === "lm" ? S * 0.86 : S * 0.7, tile.erased ? 0.6 : 1);
        if (fi.kind === "lm" && z > 0.75 && tile.feature?.kind === "landmark") {
          haloText(ctx, LM[tile.feature.id].name, p.x, p.y + S * 0.82, 10);
        }
      }
    }
    if (tile.pin > 0) {
      const gl = PINS[tile.pin].glyph;
      ctx.fillStyle = "rgba(240,215,150,0.9)";
      ctx.strokeStyle = "#7a5420";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x + S * 0.42, p.y - S * 0.5, S * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      emoji(ctx, gl, p.x + S * 0.42, p.y - S * 0.5, S * 0.38);
      if (g.halluP() > 0.05) {
        ctx.strokeStyle = "rgba(200,150,46,0.95)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        hexPath(ctx, p.x, p.y, S * 0.93);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // chartable highlights in quill mode
  if (g.tool === "quill" && !g.locked()) {
    for (const h of g.tiles) {
      if (h.state !== 1 || hexDist(g.p, h) > vis) continue;
      const p = toPixel(h.q, h.r);
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 5);
      ctx.strokeStyle = "#c8962e";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      hexPath(ctx, p.x, p.y, S * 0.92);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  } else if (g.tool === "walk") {
    // vision ring
    const pp = toPixel(g.p.q, g.p.r);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#fff4cf";
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, (vis + 0.5) * HEX * 1.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // rumors
  for (const r of g.rumors) {
    const p = toPixel(r.q, r.r);
    ctx.strokeStyle = "rgba(160,70,30,0.8)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -t * 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r.radius * HEX * 1.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    haloText(ctx, `${r.label}?`, p.x, p.y - r.radius * HEX * 1.55 - 8, 13, "#7a2a10");
  }

  // hover & path preview
  if (g.hover && !g.locked()) {
    const p = toPixel(g.hover.q, g.hover.r);
    const ht = g.tileAt(g.hover.q, g.hover.r);
    if (ht) {
      if (g.hoverPath && g.hoverPath.length && g.tool === "walk") {
        ctx.strokeStyle = "rgba(30,20,10,0.85)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        const s0 = toPixel(g.p.q, g.p.r);
        ctx.moveTo(s0.x, s0.y);
        for (const pt of g.hoverPath) {
          const q = toPixel(pt.q, pt.r);
          ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        haloText(ctx, `${g.hoverCost} supplies`, p.x, p.y - S * 0.95, 12, "#2a1d12");
      }
      ctx.strokeStyle = g.tool === "quill" ? "#c8962e" : g.tool === "pin" ? "#8a5ab5" : "#2a1d12";
      ctx.lineWidth = 2.5;
      hexPath(ctx, p.x, p.y, S);
      ctx.stroke();
      if (g.tool === "quill" && ht.state === 1 && hexDist(g.p, ht) <= vis) {
        haloText(ctx, `🖋️ ${TERRAIN[ht.seen].ink}`, p.x, p.y - S * 0.95, 12);
      }
    }
  }

  // ink trail
  if (g.trail.length > 1) {
    ctx.lineCap = "round";
    for (let i = 1; i < g.trail.length; i++) {
      const a = g.trail[i - 1], b = g.trail[i];
      const age = t - b.t;
      ctx.strokeStyle = `rgba(30,20,10,${Math.max(0, 0.7 - age * 0.6)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // player token
  {
    const px = g.vx, py = g.vy;
    const bob = Math.sin(t * 3) * 1.5;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(px, py + 13, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const sp = toPixel(g.spire.q, g.spire.r);
    const ang = Math.atan2(sp.y - py, sp.x - px);
    const gl = ctx.createRadialGradient(px, py + bob, 2, px, py + bob, 26);
    gl.addColorStop(0, "rgba(255,240,180,0.55)");
    gl.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(px, py + bob, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f1e2b8";
    ctx.strokeStyle = "#2a1d12";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(px, py + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(ang);
    ctx.fillStyle = "#8b2b22";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-3, -4.5);
    ctx.lineTo(-3, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a1d12";
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-2, -3.5);
    ctx.lineTo(-2, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // fx
  for (const r of g.fx.rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.7);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const p of g.fx.parts) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a * (p.kind === "wisp" ? 0.5 : 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (p.kind === "spark") {
      ctx.moveTo(p.x, p.y - p.size * 1.6);
      ctx.lineTo(p.x + p.size * 0.5, p.y);
      ctx.lineTo(p.x, p.y + p.size * 1.6);
      ctx.lineTo(p.x - p.size * 0.5, p.y);
      ctx.closePath();
    } else ctx.arc(p.x, p.y, p.size * (p.kind === "ink" ? 0.6 + 0.6 * a : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of g.fx.floats) {
    const a = Math.min(1, f.life / 0.6);
    ctx.globalAlpha = a;
    ctx.font = `bold ${f.size}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(20,12,6,0.85)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ---- screen space overlays ----
  const targetNight = night ? 1 : 0;
  nightK += (targetNight - nightK) * Math.min(1, dt * 1.5);
  const pcx = (g.vx - cam.x) * z + w / 2 + sx;
  const pcy = (g.vy - cam.y) * z + h / 2 + sy;
  if (nightK > 0.01) {
    const gr = ctx.createRadialGradient(pcx, pcy, vis * HEX * z * 0.9, pcx, pcy, Math.max(w, h) * 0.75);
    gr.addColorStop(0, `rgba(10,14,48,${0.05 * nightK})`);
    gr.addColorStop(0.35, `rgba(10,14,48,${0.6 * nightK})`);
    gr.addColorStop(1, `rgba(6,8,30,${0.86 * nightK})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }
  // edge vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.8);
  vg.addColorStop(0, "rgba(40,22,8,0)");
  vg.addColorStop(1, "rgba(40,22,8,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // sanity vignette
  if (psyc && g.sanity < 55) {
    const k = (1 - g.sanity / 55) * (0.75 + 0.25 * Math.sin(t * 2.3));
    const sg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    sg.addColorStop(0, "rgba(90,20,120,0)");
    sg.addColorStop(1, `rgba(60,10,90,${0.65 * k})`);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    if (g.sanity < 28) {
      ctx.strokeStyle = `rgba(10,5,15,${0.5 * k})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const side = i % 4;
        const bx = side === 0 ? 0 : side === 1 ? w : (i * 137) % w;
        const by = side === 2 ? 0 : side === 3 ? h : (i * 91) % h;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const len = 60 + 80 * k + Math.sin(t * 1.7 + i) * 30;
        const ex = bx + (w / 2 - bx) * (len / w) * 2;
        const ey = by + (h / 2 - by) * (len / h) * 2;
        ctx.quadraticCurveTo((bx + ex) / 2 + Math.sin(t * 2 + i * 3) * 30, (by + ey) / 2 + Math.cos(t * 2 + i) * 30, ex, ey);
        ctx.stroke();
      }
    }
  }
  if (g.fx.flash > 0.01) {
    ctx.globalAlpha = Math.min(0.6, g.fx.flash);
    ctx.fillStyle = g.fx.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // spire compass arrow
  {
    const sp = toPixel(g.spire.q, g.spire.r);
    const scx = (sp.x - cam.x) * z + w / 2;
    const scy = (sp.y - cam.y) * z + h / 2;
    const m = 46;
    if (scx < m || scx > w - m || scy < m + 40 || scy > h - m - 60) {
      const dx = scx - w / 2, dy = scy - h / 2;
      const sc = Math.min((w / 2 - m) / Math.abs(dx || 1), (h / 2 - m - 50) / Math.abs(dy || 1));
      const ax = w / 2 + dx * sc, ay = h / 2 + dy * sc + 10;
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(26,16,10,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c8962e";
      ctx.lineWidth = 2;
      ctx.stroke();
      emoji(ctx, "🌀", 0, 0, 20);
      ctx.rotate(ang);
      ctx.fillStyle = "#e8b64a";
      ctx.beginPath();
      ctx.moveTo(33, 0);
      ctx.lineTo(24, -7);
      ctx.lineTo(24, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      const d = hexDist(g.p, g.spire);
      ctx.font = `12px ${BODY_FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0dfb8";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(`${d}`, ax, ay + 31);
      ctx.fillText(`${d}`, ax, ay + 31);
    }
  }
}
