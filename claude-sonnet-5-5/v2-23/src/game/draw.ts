import { TAG_META, type Tag } from "./data";

export interface DrawPart { tag: Tag; tier: number }
export interface DrawOpts {
  t: number; facing: 1 | -1; flash?: number; swing?: number; alpha?: number; rot?: number; phase?: number; still?: boolean; ghost?: boolean;
}

const cache: Record<string, [number, number, number]> = {};
function rgb(hex: string): [number, number, number] {
  if (cache[hex]) return cache[hex];
  const n = parseInt(hex.slice(1), 16);
  return (cache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
export function shade(hex: string, f: number, mix = 0): string {
  const [r, g, b] = rgb(hex);
  const adj = (c: number) => {
    let v = f <= 1 ? c * f : c + (255 - c) * (f - 1);
    v = v + (255 - v) * mix;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}

/** Draws a chimera standing on (x,y) with feet at y. size = pixels per local unit (1 unit ≈ 1px at size 1). */
export function drawChimera(ctx: CanvasRenderingContext2D, parts: (DrawPart | null)[], x: number, y: number, size: number, o: DrawOpts) {
  const [head, torso, limbs, tail] = parts;
  const t = o.t, ph = o.phase ?? 0, fl = o.flash ?? 0, swing = o.swing ?? 0;
  const still = o.still;
  const bob = still ? 0 : Math.sin(t * 3.2 + ph) * 1.6;
  const walk = still ? 0 : Math.sin(t * 5 + ph);
  const C = (tag: Tag | null, f = 1) => (tag ? shade(TAG_META[tag].color, f, fl) : shade("#777777", f, fl));
  const ts = (p: DrawPart | null) => (p ? 1 + 0.1 * (p.tier - 1) : 1);
  const glow = (p: DrawPart | null) => { ctx.shadowColor = p && p.tier >= 3 ? TAG_META[p.tag].color : "transparent"; ctx.shadowBlur = p && p.tier >= 3 ? 14 : 0; };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size * o.facing, size);
  if (o.rot) ctx.rotate(o.rot);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const ghostA = (p: DrawPart | null) => { ctx.globalAlpha = (o.alpha ?? 1) * (p ? 1 : 0.28); };

  // ---- TAIL ----
  {
    const tt = tail, s = ts(tt), tag = tt?.tag ?? null;
    ghostA(tt); glow(tt);
    const wave = still ? 0 : Math.sin(t * 4 + ph) * 6;
    const ex = -56 * s, ey = -54 * s + wave;
    ctx.strokeStyle = C(tag, 0.75); ctx.lineWidth = 6 * s;
    if (!tt) ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(-20, -32 + bob); ctx.quadraticCurveTo(-52, -24, ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C(tag, 1.1);
    if (tag === "feral") { ctx.beginPath(); ctx.arc(ex, ey, 9 * s, 0, 7); ctx.fill(); ctx.fillStyle = C(tag, 1.4); ctx.beginPath(); ctx.arc(ex - 3, ey - 3, 4 * s, 0, 7); ctx.fill(); }
    else if (tag === "scale") {
      ctx.beginPath(); ctx.arc(ex, ey, 7 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = C(tag, 1.3); ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6); ctx.lineTo(ex + Math.cos(a) * 13 * s, ey + Math.sin(a) * 13 * s); ctx.stroke(); }
    } else if (tag === "chitin") {
      ctx.beginPath(); ctx.moveTo(ex - 2, ey + 6); ctx.lineTo(ex - 14 * s, ey - 4); ctx.lineTo(ex + 6, ey - 8 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e8ffb0"; ctx.beginPath(); ctx.arc(ex - 14 * s, ey - 4, 2.2, 0, 7); ctx.fill();
    } else if (tag === "plume") {
      for (let i = -2; i <= 2; i++) { ctx.fillStyle = C(tag, 1 + Math.abs(i) * 0.12); ctx.beginPath(); ctx.ellipse(ex - 8 * s, ey + i * 6 * s - 3, 12 * s, 3.4 * s, i * 0.28 - 0.35, 0, 7); ctx.fill(); }
    } else if (tag === "void") {
      ctx.beginPath(); ctx.arc(ex, ey, 6 * s, 0, 7); ctx.fill();
      ctx.fillStyle = C(tag, 1.5); ctx.beginPath(); ctx.arc(ex - 10 * s, ey + 8 + wave * 0.3, 3.5 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 4 * s, ey - 12 - wave * 0.3, 3 * s, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ---- LEGS / LIMBS ----
  const legs = (hx: number, back: boolean) => {
    const s = ts(limbs), tag = limbs?.tag ?? null;
    ghostA(limbs); glow(limbs);
    const sw = (back ? walk : -walk) * 5 + (back ? 0 : swing * 4);
    const fx = hx + sw, fy = 0;
    ctx.strokeStyle = C(tag, back ? 0.65 : 0.85); ctx.lineWidth = 7 * s;
    if (!limbs) ctx.setLineDash([3, 4]);
    if (tag === "void") {
      ctx.beginPath(); ctx.moveTo(hx, -20 + bob);
      for (let i = 1; i <= 4; i++) ctx.lineTo(hx + Math.sin(t * 4 + i + hx) * 5 + sw * (i / 4), -20 + i * 5 + bob * (1 - i / 4));
      ctx.stroke();
    } else if (tag === "chitin") {
      ctx.lineWidth = 5 * s;
      ctx.beginPath(); ctx.moveTo(hx, -20 + bob); ctx.lineTo(hx + sw * 0.5 + 8, -22 - 6); ctx.lineTo(fx, fy); ctx.stroke();
    } else { ctx.beginPath(); ctx.moveTo(hx, -20 + bob); ctx.lineTo(fx, fy - 2); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = C(tag, 1.35); ctx.lineWidth = 2.2;
    if (tag === "feral" || tag === "plume") { for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(fx, fy - 1); ctx.lineTo(fx + 8 + (tag === "plume" ? 3 : 0), fy + i * 3 - 1); ctx.stroke(); } }
    else if (tag === "scale") { ctx.fillStyle = C(tag, 1.2); ctx.fillRect(fx - 5 * s, fy - 7 * s, 12 * s, 9 * s); }
    else if (tag === "chitin") { ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 9, fy - 3); ctx.stroke(); }
    ctx.shadowBlur = 0;
  };
  legs(-13, true); legs(10, true);

  // ---- TORSO ----
  {
    const s = ts(torso), tag = torso?.tag ?? null;
    ghostA(torso); glow(torso);
    ctx.fillStyle = C(tag, 0.95); ctx.strokeStyle = C(tag, 0.55); ctx.lineWidth = 2;
    if (!torso) ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(0, -34 + bob, 27 * s, 19 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    ctx.strokeStyle = C(tag, 1.3); ctx.lineWidth = 1.8;
    const by = -34 + bob;
    if (tag === "feral") { for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 7, by - 17 * s + Math.abs(i)); ctx.lineTo(i * 7 + 3, by - 24 * s + Math.abs(i)); ctx.lineTo(i * 7 + 6, by - 16 * s + Math.abs(i)); ctx.stroke(); } }
    else if (tag === "scale") { for (let r = 0; r < 2; r++) for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 9 + r * 4, by - 4 + r * 11, 5, 0, Math.PI); ctx.stroke(); } }
    else if (tag === "chitin") { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9, by - 17 * s); ctx.quadraticCurveTo(i * 9 + 4, by, i * 9, by + 17 * s); ctx.stroke(); } }
    else if (tag === "plume") { for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 8 + (r % 2) * 4, by - 8 + r * 8, 4.5, 0.1, Math.PI - 0.1); ctx.stroke(); } }
    else if (tag === "void") { ctx.fillStyle = C(tag, 1.7); ctx.beginPath(); ctx.arc(0, by, 7 + Math.sin(t * 3 + ph) * 1.5, 0, 7); ctx.fill(); ctx.strokeStyle = C(tag, 0.4); ctx.beginPath(); ctx.arc(0, by, 12, t, t + 4); ctx.stroke(); }
  }
  legs(-3, false);

  // ---- HEAD ----
  {
    const s = ts(head), tag = head?.tag ?? null, hx = 31, hy = -52 + bob + (swing ? -swing * 3 : 0), r = 13 * s;
    ghostA(head); glow(head);
    ctx.strokeStyle = C(tag, 0.7); ctx.lineWidth = 8; if (!head) ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(16, -40 + bob); ctx.lineTo(hx - 4, hy + 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C(tag, 1.05); ctx.strokeStyle = C(tag, 0.55); ctx.lineWidth = 2;
    if (!head) ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    const dark = C(tag, 0.4), light = C(tag, 1.4);
    if (tag === "feral") {
      ctx.fillStyle = C(tag, 0.85); ctx.beginPath(); ctx.moveTo(hx - 8, hy - 8); ctx.lineTo(hx - 6, hy - 22 * s); ctx.lineTo(hx + 2, hy - 11); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + 2, hy - 11); ctx.lineTo(hx + 8, hy - 21 * s); ctx.lineTo(hx + 11, hy - 6); ctx.fill();
      ctx.fillStyle = C(tag, 1.2); ctx.fillRect(hx + 6, hy - 1, 14 * s, 8 * s);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(hx + 12, hy + 7 * s); ctx.lineTo(hx + 14, hy + 12 * s); ctx.lineTo(hx + 16, hy + 7 * s); ctx.fill();
    } else if (tag === "scale") {
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 8); ctx.quadraticCurveTo(hx - 20 * s, hy - 14, hx - 22 * s, hy - 2); ctx.quadraticCurveTo(hx - 12, hy - 8, hx - 2, hy - 4); ctx.fill();
      ctx.fillStyle = C(tag, 1.2); ctx.fillRect(hx + 5, hy - 2, 15 * s, 9 * s);
      ctx.fillStyle = dark; ctx.fillRect(hx + 16 * s, hy, 2, 2);
    } else if (tag === "chitin") {
      ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(hx + 8, hy + 6); ctx.lineTo(hx + 18 * s, hy + 14 * s); ctx.moveTo(hx + 3, hy + 9); ctx.lineTo(hx + 8 * s, hy + 18 * s); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = light;
      ctx.beginPath(); ctx.moveTo(hx, hy - 11); ctx.quadraticCurveTo(hx + 4, hy - 26 * s, hx + 14 + Math.sin(t * 5) * 2, hy - 28 * s); ctx.stroke();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(hx + 3, hy - 6, 2.2, 0, 7); ctx.arc(hx + 9, hy - 2, 2.2, 0, 7); ctx.fill();
    } else if (tag === "plume") {
      ctx.fillStyle = "#ffd36b"; ctx.beginPath(); ctx.moveTo(hx + 9, hy - 4); ctx.lineTo(hx + 25 * s, hy + 3); ctx.lineTo(hx + 9, hy + 8); ctx.fill();
      ctx.strokeStyle = light; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx - 3 + i * 4, hy - 11); ctx.lineTo(hx - 10 + i * 6, hy - 22 * s); ctx.stroke(); }
    } else if (tag === "void") {
      ctx.strokeStyle = light; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(hx, hy - 17 * s, 11, 3.5, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = "#f5e6ff"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx + 6, hy - 6 + i * 6, 2.4, 0, 7); ctx.fill(); }
    }
    if (tag && tag !== "void" && tag !== "chitin") {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx + 4, hy - 3, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = "#1a0a10"; ctx.beginPath(); ctx.arc(hx + 5.2, hy - 3, 1.7, 0, 7); ctx.fill();
    }
    if (!tag) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", hx, hy + 4); }
  }
  // front arm
  legs(20, false);
  ctx.restore();
}

/** Small gold dots showing a unit's highest part tier. */
export function drawTierPips(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < tier; i++) { ctx.beginPath(); ctx.arc(x + (i - (tier - 1) / 2) * 7, y, 2.4, 0, 7); ctx.fill(); }
}
