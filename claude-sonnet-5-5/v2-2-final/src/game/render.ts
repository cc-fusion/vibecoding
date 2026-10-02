// ---------- Canvas renderer (blueprint noir) ----------
import { blocks, guardVisible, laserOn } from './sim';
import type { Sim, Order, Guard, CrewUnit } from './sim';
import { T_COVER, T_FLOOR, T_STREET, T_WALL } from './level';
import type { Level } from './level';
import { LOOT, CREW } from './data';
import type { GadgetId } from './data';

export interface View { ox: number; oy: number; ts: number; cw: number; ch: number; dpr: number }
export function computeView(cw: number, ch: number, L: Level, dpr: number): View {
  const ts = Math.max(6, Math.min((cw - 12) / L.w, (ch - 12) / L.h));
  return { ts, ox: (cw - L.w * ts) / 2, oy: (ch - L.h * ts) / 2, cw, ch, dpr };
}
export const toTile = (v: View, px: number, py: number) => ({ x: (px - v.ox) / v.ts, y: (py - v.oy) / v.ts });

export interface Overlay {
  selected: string | null; hover: { x: number; y: number } | null; plans: Record<string, Order[]>; phase: 'plan' | 'run'; gadget: GadgetId | null; shake: boolean; now: number;
}

const ROOM_TINT: Record<string, string> = { corridor: '#123560', room: '#0e2a52', office: '#1c2b60', security: '#0f3d4c', vault: '#4a3512' };
const DOOR_COL: Record<string, string> = { open: '#46e0c0', locked: '#ffb347', keycard: '#ff5fa8', vault: '#ff4d4d' };

function txt(ctx: CanvasRenderingContext2D, v: View, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', bold = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / v.ts, 1 / v.ts);
  ctx.font = `${bold ? '700 ' : ''}${size}px 'Chakra Petch', 'Segoe UI Emoji', monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 0); ctx.restore();
}

function cone(s: Sim, x: number, y: number, ang: number, fov: number, range: number): number[] {
  const pts = [x, y]; const n = 20;
  for (let i = 0; i <= n; i++) {
    const a = ang - fov / 2 + (fov * i) / n; const c = Math.cos(a), sn = Math.sin(a); let d = 0;
    while (d < range) { d += 0.25; if (blocks(s, Math.floor(x + c * d), Math.floor(y + sn * d))) { d -= 0.12; break; } }
    d = Math.min(d, range); pts.push(x + c * d, y + sn * d);
  }
  return pts;
}
function fillCone(ctx: CanvasRenderingContext2D, pts: number[], x: number, y: number, range: number, rgb: string, a: number) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
  const g = ctx.createRadialGradient(x, y, 0, x, y, range); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},${a * 0.15})`);
  ctx.fillStyle = g; ctx.fill();
}

export function orderPos(s: Sim, o: Order): { x: number; y: number } | null {
  switch (o.type) {
    case 'move': case 'sprint': case 'ambush': return { x: o.x + 0.5, y: o.y + 0.5 };
    case 'unlock': return { x: o.x + 0.5, y: o.y + 0.5 };
    case 'interact': { const it = s.items.find((i) => i.id === o.id); return it ? { x: it.x + 0.5, y: it.y + 0.5 } : null; }
    case 'exit': return { x: s.level.exit.x + 0.5, y: s.level.exit.y + 0.5 };
    default: return null;
  }
}

export function draw(ctx: CanvasRenderingContext2D, s: Sim, v: View, o: Overlay) {
  const L = s.level; const { ts } = v; const t = o.now;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.fillStyle = '#050d1c'; ctx.fillRect(0, 0, v.cw, v.ch);
  const sh = o.shake ? s.shake : 0; const sx = (Math.random() - 0.5) * sh * 10, sy = (Math.random() - 0.5) * sh * 10;
  ctx.save(); ctx.translate(v.ox + sx, v.oy + sy); ctx.scale(ts, ts);
  const I = (x: number, y: number) => y * L.w + x;
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.tiles[I(x, y)] === T_WALL || L.tiles[I(x, y)] === 0;

  // ground
  ctx.fillStyle = '#071530'; ctx.fillRect(0, 0, L.w, L.h);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const tt = L.tiles[I(x, y)];
    if (tt === T_STREET) { ctx.fillStyle = '#0a1b36'; ctx.fillRect(x, y, 1, 1); }
    else if (tt === T_FLOOR || tt === T_COVER) {
      const rid = L.roomAt[I(x, y)]; const rm = rid >= 0 ? L.rooms[rid] : null;
      ctx.fillStyle = rm ? ROOM_TINT[rm.kind] : '#123560'; ctx.fillRect(x, y, 1, 1);
    }
  }
  // road dashes + van
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 0; y < L.h; y += 2) ctx.fillRect(0.5, y + 0.3, 0.12, 0.8);
  // grid
  ctx.strokeStyle = 'rgba(110,231,255,0.07)'; ctx.lineWidth = 0.025; ctx.beginPath();
  for (let x = 0; x <= L.w; x++) { ctx.moveTo(x, 0); ctx.lineTo(x, L.h); } for (let y = 0; y <= L.h; y++) { ctx.moveTo(0, y); ctx.lineTo(L.w, y); } ctx.stroke();
  if (s.alarm.level >= 2) { ctx.fillStyle = `rgba(255,40,60,${0.05 + 0.05 * Math.sin(t * 6)})`; ctx.fillRect(L.x0, 0, L.w - L.x0, L.h); }

  // walls
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const tt = L.tiles[I(x, y)];
    if (tt === T_WALL) {
      let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) { if (!solid(x + dx, y + dy)) { edge = true; break; } }
      if (edge) { ctx.fillStyle = '#6fa6e0'; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = 'rgba(8,20,40,0.35)'; ctx.fillRect(x + 0.18, y + 0.18, 0.64, 0.64); }
    } else if (tt === T_COVER) {
      ctx.fillStyle = '#35588a'; ctx.fillRect(x + 0.06, y + 0.06, 0.88, 0.88);
      ctx.strokeStyle = '#8fb8ea'; ctx.lineWidth = 0.05; ctx.strokeRect(x + 0.06, y + 0.06, 0.88, 0.88);
      ctx.beginPath(); ctx.moveTo(x + 0.15, y + 0.15); ctx.lineTo(x + 0.85, y + 0.85); ctx.moveTo(x + 0.85, y + 0.15); ctx.lineTo(x + 0.15, y + 0.85); ctx.lineWidth = 0.035; ctx.stroke();
    }
  }
  // room labels
  for (const r of L.rooms) {
    if (r.kind === 'corridor') continue;
    txt(ctx, v, r.name.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 - 0.1, Math.max(8, Math.min(13, ts * 0.42)), 'rgba(150,200,255,0.22)', 'center', true);
  }
  // exit / van
  txt(ctx, v, '🚐', L.exit.x + 0.5, L.exit.y + 0.5, ts * 0.9, '#fff');
  txt(ctx, v, 'GETAWAY', 2, L.cy - 0.7, Math.max(8, ts * 0.38), 'rgba(92,240,168,0.8)', 'center', true);

  // doors
  for (const d of s.doors) {
    const known = s.known.has(d.id) || d.kind === 'open' && d.y === L.cy + 1 && d.x === L.x0;
    const col = known ? DOOR_COL[d.kind] : '#8fa8c8'; const open = d.open;
    ctx.save(); ctx.translate(d.x + 0.5, d.y + 0.5);
    const w = d.vert ? 0.34 : 1, h = d.vert ? 1 : 0.34; const sl = open * 0.42;
    ctx.fillStyle = d.unlocked ? 'rgba(92,240,168,0.55)' : col; ctx.globalAlpha = 0.9;
    if (d.vert) { ctx.fillRect(-w / 2, -0.5, w, 0.5 - sl); ctx.fillRect(-w / 2, sl, w, 0.5 - sl); } else { ctx.fillRect(-0.5, -h / 2, 0.5 - sl, h); ctx.fillRect(sl, -h / 2, 0.5 - sl, h); }
    ctx.globalAlpha = 1; ctx.restore();
    if (known && d.kind !== 'open') txt(ctx, v, d.kind === 'keycard' ? '▤' : d.kind === 'vault' ? '◎' : d.unlocked ? '○' : '●', d.x + 0.5, d.y + 0.5, ts * 0.42, d.unlocked ? '#5cf0a8' : '#0b1220', 'center', true);
    else if (!known) txt(ctx, v, '?', d.x + 0.5, d.y + 0.5, ts * 0.4, '#0b1220', 'center', true);
  }

  // lasers
  for (const l of s.lasers) {
    if (!s.known.has(l.id)) continue;
    const on = laserOn(s, l); const x = l.x + 0.5;
    if (on) {
      ctx.strokeStyle = 'rgba(255,60,80,0.25)'; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.moveTo(x, l.y1); ctx.lineTo(x, l.y2 + 1); ctx.stroke();
      ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(x, l.y1); ctx.lineTo(x, l.y2 + 1); ctx.stroke();
    } else { ctx.setLineDash([0.15, 0.2]); ctx.strokeStyle = 'rgba(255,120,130,0.4)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x, l.y1); ctx.lineTo(x, l.y2 + 1); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = '#ff9aa4'; ctx.fillRect(x - 0.14, l.y1 - 0.1, 0.28, 0.2); ctx.fillRect(x - 0.14, l.y2 + 0.9, 0.28, 0.2);
    if (l.mode === 'solid') txt(ctx, v, 'SOLID', x, l.y1 - 0.35, Math.max(7, ts * 0.3), 'rgba(255,150,160,0.8)');
  }

  // guard routes (casing level 2)
  if (s.trackGuards) {
    ctx.setLineDash([0.18, 0.2]); ctx.lineWidth = 0.06;
    for (const gd of L.guards) {
      if (gd.loop.length < 2) continue; ctx.strokeStyle = gd.type === 'dog' ? 'rgba(210,150,100,0.4)' : 'rgba(255,170,70,0.38)';
      ctx.beginPath(); gd.loop.forEach((p, i) => (i ? ctx.lineTo(p.x + 0.5, p.y + 0.5) : ctx.moveTo(p.x + 0.5, p.y + 0.5))); ctx.closePath(); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // items
  for (const it of s.items) {
    if (!s.known.has(it.id)) continue;
    const cx = it.x + 0.5, cy = it.y + 0.5; const reusable = it.type === 'camTerm' || it.type === 'laserBox';
    ctx.globalAlpha = it.done && !reusable ? 0.28 : 1;
    const col = it.loot ? LOOT[it.loot.cat].color : it.type === 'vaultLock' ? '#ffd35c' : '#6ee7ff';
    ctx.fillStyle = 'rgba(5,13,28,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 0.06; ctx.stroke();
    txt(ctx, v, it.icon, cx, cy + 0.02, ts * 0.52, '#fff');
    if (it.primary && !it.done) { ctx.strokeStyle = `rgba(255,211,92,${0.5 + 0.4 * Math.sin(t * 4)})`; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(cx, cy, 0.55 + 0.06 * Math.sin(t * 4), 0, 7); ctx.stroke(); txt(ctx, v, '★', cx + 0.45, cy - 0.45, ts * 0.4, '#ffd35c'); }
    ctx.globalAlpha = 1;
  }

  // cameras
  for (const c of s.cams) {
    if (!s.known.has(c.id)) continue;
    const cx = c.x + 0.5, cy = c.y + 0.5; const off = c.off > s.t || s.camOff > s.t;
    if (!off) { const pts = cone(s, cx, cy, c.angle, c.fov, c.range); fillCone(ctx, pts, cx, cy, c.range, c.aware > 0.1 ? '255,70,80' : '255,210,90', 0.2 + c.aware * 0.3); }
    ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(cx, cy, 0.26, 0, 7); ctx.fill(); ctx.strokeStyle = off ? '#7d8ca3' : '#ff4d5e'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.angle); ctx.fillStyle = off ? '#7d8ca3' : '#ff4d5e'; ctx.fillRect(0.02, -0.07, 0.3, 0.14); ctx.restore();
    if (off) txt(ctx, v, '✕', cx, cy - 0.5, ts * 0.35, '#9fb0c8');
  }

  // smoke
  for (const m of s.smokes) {
    const g = ctx.createRadialGradient(m.x, m.y, 0.2, m.x, m.y, m.r); const a = Math.min(0.85, (m.until - s.t) * 0.5);
    g.addColorStop(0, `rgba(190,205,225,${a})`); g.addColorStop(1, 'rgba(190,205,225,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
  }
  for (const d of s.decoys) { ctx.strokeStyle = `rgba(255,211,92,${0.6})`; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(d.x, d.y, 0.4 + 0.2 * Math.sin(t * 10), 0, 7); ctx.stroke(); txt(ctx, v, '📢', d.x, d.y, ts * 0.6, '#fff'); }

  // guards
  const vis = s.guards.filter((g) => guardVisible(s, g));
  for (const g of vis) {
    if (g.state === 'down') continue;
    const col = g.state === 'chase' ? '255,60,70' : g.state === 'alert' || g.state === 'investigate' || g.state === 'search' ? '255,160,60' : '255,230,120';
    const range = g.range * (1 + 0.1 * s.alarm.level) * s.visMul;
    const pts = cone(s, g.x, g.y, g.angle, g.fov, range); fillCone(ctx, pts, g.x, g.y, range, col, g.state === 'chase' ? 0.34 : 0.24);
  }
  for (const g of s.guards) {
    if (g.state !== 'down') continue; if (!guardVisible(s, g) && !g.found) continue;
    ctx.fillStyle = '#556a88'; ctx.beginPath(); ctx.arc(g.x, g.y, 0.32, 0, 7); ctx.fill(); txt(ctx, v, g.found ? '💀' : '💤', g.x, g.y, ts * 0.5, '#fff');
  }
  for (const g of vis) if (g.state !== 'down') drawGuard(ctx, v, g, t);

  // order overlays (plan) / current path (run)
  const selId = o.selected;
  if (o.phase === 'plan') {
    for (const c of s.crew) {
      const ords = o.plans[c.id] ?? []; const sel = c.id === selId; const sp = L.spawn[s.crew.indexOf(c) % L.spawn.length];
      let px = sp.x + 0.5, py = sp.y + 0.5; ctx.globalAlpha = sel ? 1 : 0.35;
      ords.forEach((od, i) => {
        const p = orderPos(s, od); if (!p) return;
        ctx.strokeStyle = c.color; ctx.lineWidth = sel ? 0.09 : 0.05; ctx.setLineDash(od.type === 'sprint' ? [0.2, 0.15] : od.type === 'ambush' ? [0.05, 0.1] : []);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#071530'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.3, 0, 7); ctx.fill(); ctx.strokeStyle = c.color; ctx.lineWidth = 0.06; ctx.stroke();
        txt(ctx, v, String(i + 1), p.x, p.y, ts * 0.38, c.color, 'center', true);
        if (od.type === 'ambush') txt(ctx, v, '🗡', p.x + 0.4, p.y - 0.4, ts * 0.4, '#fff');
        if (od.type === 'sprint') txt(ctx, v, '»', p.x + 0.4, p.y - 0.4, ts * 0.5, '#fff');
        px = p.x; py = p.y;
      });
      ctx.globalAlpha = 1;
    }
  } else {
    const c = s.crew.find((q) => q.id === selId);
    if (c && c.path && c.status !== 'escaped') {
      ctx.strokeStyle = c.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.06; ctx.setLineDash([0.15, 0.15]); ctx.beginPath(); ctx.moveTo(c.x, c.y);
      for (let i = c.pi; i < c.path.length; i++) ctx.lineTo(c.path[i].x + 0.5, c.path[i].y + 0.5); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  // crew
  for (const c of s.crew) drawCrew(ctx, v, c, c.id === selId, t);

  // pings
  for (const p of s.pings) {
    const a = Math.max(0, 1 - p.r / p.max);
    if (p.kind === 'noise') { ctx.strokeStyle = `rgba(190,225,255,${0.45 * a})`; ctx.lineWidth = 0.06; ctx.setLineDash([0.12, 0.12]); }
    else { ctx.strokeStyle = `rgba(255,90,100,${0.35 * a})`; ctx.lineWidth = 0.1; }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  // particles
  for (const p of s.parts) { ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;

  // hover + gadget preview
  if (o.hover) {
    const hx = Math.floor(o.hover.x), hy = Math.floor(o.hover.y);
    if (hx >= 0 && hy >= 0 && hx < L.w && hy < L.h) {
      ctx.strokeStyle = 'rgba(110,231,255,0.9)'; ctx.lineWidth = 0.06; ctx.strokeRect(hx + 0.04, hy + 0.04, 0.92, 0.92);
      if (o.gadget) {
        const r = o.gadget === 'smoke' ? 2.7 : o.gadget === 'emp' ? 12 : o.gadget === 'decoy' ? 16 : 3.2;
        ctx.strokeStyle = 'rgba(255,211,92,0.8)'; ctx.setLineDash([0.2, 0.2]); ctx.beginPath(); ctx.arc(o.hover.x, o.hover.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  // floaters
  for (const f of s.floats) {
    const k = f.age / f.life; ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    txt(ctx, v, f.text, f.x, f.y - 0.5 - k * 1.1, Math.max(10, ts * 0.42), f.color, 'center', true);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, s.flash * 0.5)})`; ctx.fillRect(0, 0, v.cw, v.ch); }
}

function drawGuard(ctx: CanvasRenderingContext2D, v: View, g: Guard, t: number) {
  const r = g.type === 'heavy' ? 0.42 : 0.34;
  const col = g.type === 'swat' ? '#4d79ff' : g.type === 'heavy' ? '#ff5a3d' : g.type === 'dog' ? '#c28b5a' : '#ff9d3d';
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#1a0a00'; ctx.lineWidth = 0.06; ctx.stroke();
  ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(r + 0.14, 0); ctx.lineTo(r - 0.06, -0.12); ctx.lineTo(r - 0.06, 0.12); ctx.fill(); ctx.restore();
  txt(ctx, v, g.type === 'dog' ? '🐕' : g.type === 'swat' ? 'S' : g.type === 'heavy' ? 'H' : String(g.num), g.x, g.y, v.ts * (g.type === 'dog' ? 0.5 : 0.36), g.type === 'dog' ? '#fff' : '#1a0a00', 'center', true);
  if (g.aware > 0.02 && g.state !== 'chase') {
    ctx.strokeStyle = g.aware > 0.6 ? '#ff4d5e' : '#ffd35c'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(g.x, g.y, r + 0.14, -Math.PI / 2, -Math.PI / 2 + Math.min(1, g.aware) * Math.PI * 2); ctx.stroke();
  }
  if (g.state === 'chase') { ctx.strokeStyle = `rgba(255,60,70,${0.5 + 0.4 * Math.sin(t * 12)})`; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(g.x, g.y, r + 0.2, 0, 7); ctx.stroke(); txt(ctx, v, '!', g.x, g.y - 0.75, v.ts * 0.6, '#ff4d5e', 'center', true); }
  else if (g.state === 'alert') txt(ctx, v, '?', g.x, g.y - 0.75, v.ts * 0.6, '#ffd35c', 'center', true);
}

function drawCrew(ctx: CanvasRenderingContext2D, v: View, c: CrewUnit, sel: boolean, t: number) {
  if (c.status === 'escaped') return;
  if (c.status === 'captured') { txt(ctx, v, '⛓️', c.x, c.y, v.ts * 0.6, '#fff'); return; }
  const hid = c.status === 'ambush'; ctx.globalAlpha = hid ? 0.55 : 1;
  if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.07; ctx.setLineDash([0.15, 0.1]); ctx.beginPath(); ctx.arc(c.x, c.y, 0.55 + 0.04 * Math.sin(t * 5), 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (c.disguise > 0) { ctx.strokeStyle = '#ff7ad1'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(c.x, c.y, 0.46, 0, 7); ctx.stroke(); }
  ctx.fillStyle = c.hurt > 0 ? '#ff4d5e' : c.color; ctx.beginPath(); ctx.arc(c.x, c.y, 0.34, 0, 7); ctx.fill(); ctx.strokeStyle = '#050d1c'; ctx.lineWidth = 0.06; ctx.stroke();
  txt(ctx, v, CREW[c.kind].icon, c.x, c.y + 0.02, v.ts * 0.46, '#fff');
  ctx.globalAlpha = 1;
  txt(ctx, v, c.name, c.x, c.y + 0.68, Math.max(8, v.ts * 0.34), '#d6e8ff', 'center', true);
  if (c.bag.length) { ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(c.x + 0.34, c.y - 0.3, 0.18, 0, 7); ctx.fill(); txt(ctx, v, String(c.bag.length), c.x + 0.34, c.y - 0.3, v.ts * 0.26, '#1a1000', 'center', true); }
  if (c.work) {
    const k = Math.min(1, c.work.t / c.work.total); ctx.fillStyle = 'rgba(5,13,28,0.85)'; ctx.fillRect(c.x - 0.45, c.y - 0.72, 0.9, 0.18); ctx.fillStyle = '#5cf0a8'; ctx.fillRect(c.x - 0.42, c.y - 0.69, 0.84 * k, 0.12);
  }
  if (c.cuff > 0.1) { ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(c.x, c.y, 0.46, 0, Math.PI * 2 * Math.min(1, c.cuff / 0.75)); ctx.stroke(); }
}

export function describeAt(s: Sim, fx: number, fy: number): { title: string; lines: string[] } | null {
  const tx = Math.floor(fx), ty = Math.floor(fy);
  for (const g of s.guards) if (guardVisible(s, g) && Math.hypot(g.x - fx, g.y - fy) < 0.7) return { title: g.type === 'dog' ? 'Guard Dog' : g.type === 'heavy' ? 'Heavy Guard' : g.type === 'swat' ? 'SWAT' : 'Guard #' + g.num, lines: [`State: ${g.state}`, g.type === 'dog' ? 'Hears everything. Ignores disguises.' : g.type === 'heavy' ? 'Only Muscle can take him down.' : 'Takedown from behind (Ambush).'] };
  for (const c of s.crew) if (Math.hypot(c.x - fx, c.y - fy) < 0.6) return { title: c.name + ' - ' + CREW[c.kind].title, lines: [c.label, `HP ${c.hp}/${c.maxHp}`] };
  for (const it of s.items) if (s.known.has(it.id) && it.x === tx && it.y === ty) return { title: it.label, lines: [it.loot ? `${LOOT[it.loot.cat].name} - $${it.loot.value.toLocaleString('en-US')} - weight ${it.loot.weight}` : 'Equipment', `Needs: ${it.skill} (${it.time.toFixed(1)}s base)`] };
  for (const d of s.doors) if (d.x === tx && d.y === ty) return { title: s.known.has(d.id) ? `${d.kind[0].toUpperCase()}${d.kind.slice(1)} door` : 'Door', lines: [s.known.has(d.id) ? (d.kind === 'locked' ? 'Pick (Ghost) or breach (Muscle).' : d.kind === 'keycard' ? 'Hacker clones the keycard.' : d.kind === 'vault' ? `Opens when ${d.locks} lock(s) are defeated (${d.done}/${d.locks}).` : 'Unlocked.') : 'Unknown lock. Case the joint to see it.'] };
  for (const c of s.cams) if (s.known.has(c.id) && c.x === tx && c.y === ty) return { title: 'Security Camera', lines: ['Hacker can loop all cameras from the console.'] };
  for (const l of s.lasers) if (s.known.has(l.id) && l.x === tx && ty >= l.y1 && ty <= l.y2) return { title: l.mode === 'solid' ? 'Solid Laser Grid' : 'Pulsing Laser Grid', lines: [l.mode === 'solid' ? 'Always on. Cut power at the laser box.' : 'Crew time their crossing through the gaps.'] };
  return null;
}
