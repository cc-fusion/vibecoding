import type { P, Thing } from './types';
import type { Sim } from './sim';
import { camPos, laserOn } from './sim';
import { ROLE_INFO } from './data';

if (typeof CanvasRenderingContext2D !== 'undefined' && !(CanvasRenderingContext2D.prototype as unknown as { roundRect?: unknown }).roundRect) {
  (CanvasRenderingContext2D.prototype as unknown as { roundRect: (x: number, y: number, w: number, h: number) => void }).roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) { this.rect(x, y, w, h); };
}

export interface View { cw: number; ch: number; ts: number; ox: number; oy: number }
export interface PathViz { color: string; pts: { x: number; y: number; sym: string }[]; dim: boolean }
export interface RenderOpts { mode: 'plan' | 'run'; recon: number; paths: PathViz[]; hover: P | null; selected: string | null; focus: boolean; shake: boolean; hoverThing?: Thing | null }

export function layoutView(cw: number, ch: number, w: number, h: number): View {
  const ts = Math.max(8, Math.min(cw / (w + 0.5), ch / (h + 0.5)));
  return { cw, ch, ts, ox: (cw - w * ts) / 2, oy: (ch - h * ts) / 2 };
}
export const toTile = (v: View, px: number, py: number): P => ({ x: (px - v.ox) / v.ts, y: (py - v.oy) / v.ts });

const GCOL: Record<string, string> = { guard: '#fbbf24', sentinel: '#fb923c', k9: '#d4a373', drone: '#67e8f9', captain: '#f43f5e', cop: '#3b82f6' };
const LOCKCOL: Record<string, string> = { pick: '#fbbf24', hack: '#34d399', breach: '#f87171', none: '#94a3b8' };

export function render(ctx: CanvasRenderingContext2D, s: Sim, v: View, o: RenderOpts) {
  const { ts, ox, oy } = v;
  const W = s.w.w, H = s.w.h;
  const plan = o.mode === 'plan';
  const run = !plan;
  const X = (x: number) => ox + x * ts, Y = (y: number) => oy + y * ts;
  ctx.clearRect(0, 0, v.cw, v.ch);
  ctx.fillStyle = plan ? '#081a33' : '#05070b';
  ctx.fillRect(0, 0, v.cw, v.ch);
  ctx.save();
  if (o.shake && s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake * 14, (Math.random() - 0.5) * s.shake * 14);

  // blueprint grid
  if (plan) {
    ctx.strokeStyle = 'rgba(80,150,230,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(H)); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(W), Y(y)); }
    ctx.stroke();
  }
  // floors
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = s.w.tiles[y * W + x];
    if (t === 0) continue;
    const rid = s.w.roomId[y * W + x];
    if (plan) ctx.fillStyle = rid ? '#0f3563' : '#0c2c54';
    else ctx.fillStyle = rid ? (rid % 2 ? '#1a2231' : '#161d2b') : '#121824';
    ctx.fillRect(X(x), Y(y), ts + 0.5, ts + 0.5);
    if (rid && s.w.rooms[rid - 1].dark) { ctx.fillStyle = plan ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,10,0.38)'; ctx.fillRect(X(x), Y(y), ts + 0.5, ts + 0.5); }
    if (run && (x + y) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.012)'; ctx.fillRect(X(x), Y(y), ts, ts); }
    if (t === 2) {
      ctx.fillStyle = plan ? '#1c5a9a' : '#2c3548';
      ctx.fillRect(X(x) + ts * 0.1, Y(y) + ts * 0.1, ts * 0.8, ts * 0.8);
      ctx.strokeStyle = plan ? '#7ec8ff' : '#465273'; ctx.lineWidth = 1;
      ctx.strokeRect(X(x) + ts * 0.1, Y(y) + ts * 0.1, ts * 0.8, ts * 0.8);
    }
  }
  // wall edges
  ctx.strokeStyle = plan ? '#8fd0ff' : '#56648a';
  ctx.lineWidth = Math.max(2, ts * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!s.w.tiles[y * W + x]) continue;
    if (y === 0 || !s.w.tiles[(y - 1) * W + x]) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); }
    if (y === H - 1 || !s.w.tiles[(y + 1) * W + x]) { ctx.moveTo(X(x), Y(y + 1)); ctx.lineTo(X(x + 1), Y(y + 1)); }
    if (x === 0 || !s.w.tiles[y * W + x - 1]) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); }
    if (x === W - 1 || !s.w.tiles[y * W + x + 1]) { ctx.moveTo(X(x + 1), Y(y)); ctx.lineTo(X(x + 1), Y(y + 1)); }
  }
  ctx.stroke();

  // room labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(8, ts * 0.42)}px ui-monospace, monospace`;
  s.w.rooms.forEach(r => {
    ctx.fillStyle = plan ? 'rgba(160,210,255,0.55)' : 'rgba(180,190,220,0.18)';
    ctx.fillText(r.name.toUpperCase() + (r.dark ? ' ◐' : ''), X(r.x + r.w / 2), Y(r.y + 0.55));
  });

  // van
  const van = s.w.van;
  ctx.fillStyle = plan ? '#2f6fb0' : '#2b3447';
  ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(X(van.x - 0.45), Y(van.y - 0.4), ts * 1.5, ts * 0.8, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4ade80'; ctx.font = `bold ${ts * 0.36}px sans-serif`;
  ctx.fillText(s.vanGone ? 'GONE' : 'VAN', X(van.x + 0.3), Y(van.y));

  // alarm waves
  for (const wv of s.waves) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = wv.dist[y * W + x];
      if (d < 0 || d > wv.r) continue;
      const a = 0.22 * Math.max(0, 1 - (wv.r - d) / 14);
      if (a < 0.01) continue;
      ctx.fillStyle = `rgba(255,40,60,${a})`;
      ctx.fillRect(X(x), Y(y), ts, ts);
    }
  }

  const known = (t: Thing) => run || o.recon >= 1 || t.kind === 'door' || (t.kind === 'safe' && t.vault);
  const cone = (x: number, y: number, ang: number, fov: number, range: number, color: string) => {
    ctx.beginPath(); ctx.moveTo(X(x), Y(y));
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const a = ang - fov / 2 + (fov * i) / n, dx = Math.cos(a), dy = Math.sin(a);
      let d = 0.3;
      for (; d < range; d += 0.25) {
        const px = x + dx * d, py = y + dy * d, ii = Math.floor(py) * W + Math.floor(px);
        if (!s.w.tiles[ii]) break;
        const dr = s.doorIdx[ii];
        if (dr && (dr.locked || dr.open < 0.55)) break;
      }
      ctx.lineTo(X(x + dx * d), Y(y + dy * d));
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };

  // lasers
  if (run || o.recon >= 1) {
    for (const l of s.w.lasers) {
      const on = laserOn(s, l);
      const a = l.tiles[0], b = l.tiles[l.tiles.length - 1];
      ctx.beginPath(); ctx.moveTo(X(a.x + 0.5), Y(a.y + 0.5)); ctx.lineTo(X(b.x + 0.5), Y(b.y + 0.5));
      if (on) { ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = Math.max(2, ts * 0.12); ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 10; ctx.setLineDash([]); }
      else { ctx.strokeStyle = l.off > 0 ? 'rgba(125,211,252,0.5)' : 'rgba(255,45,85,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); }
      ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
      [a, b].forEach(p => { ctx.fillStyle = '#ff2d55'; ctx.fillRect(X(p.x + 0.5) - 3, Y(p.y + 0.5) - 3, 6, 6); });
    }
  }

  // things
  for (const t of s.w.things) {
    if (!known(t)) continue;
    const cx = X(t.x + 0.5), cy = Y(t.y + 0.5);
    if (t.kind === 'door') {
      const col = LOCKCOL[t.lock];
      const len = ts * (t.locked ? 1 : 1 - t.open * 0.85);
      ctx.fillStyle = t.locked ? col : plan ? '#7aa7d6' : '#7b88a6';
      if (t.vert) ctx.fillRect(cx - ts * 0.11, cy - len / 2, ts * 0.22, len); else ctx.fillRect(cx - len / 2, cy - ts * 0.11, len, ts * 0.22);
      if (t.locked) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
        ctx.strokeRect(cx - ts * 0.5 + 2, cy - ts * 0.5 + 2, ts - 4, ts - 4); ctx.globalAlpha = 1;
        ctx.font = `${ts * 0.4}px sans-serif`; ctx.fillStyle = '#fff';
        ctx.fillText(t.lock === 'pick' ? '🗝' : t.lock === 'hack' ? '⌁' : '✱', cx, cy);
      }
    } else if (t.kind === 'safe') {
      const big = t.vault;
      ctx.fillStyle = t.opened ? '#334155' : big ? '#b8860b' : '#64748b';
      ctx.strokeStyle = big ? '#fde047' : '#cbd5e1'; ctx.lineWidth = 2;
      const sz = ts * (big ? 0.9 : 0.74);
      ctx.beginPath(); ctx.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, 4); ctx.fill(); ctx.stroke();
      ctx.font = `${ts * 0.46}px sans-serif`; ctx.fillStyle = '#fff';
      ctx.fillText(t.opened ? '·' : big ? '👑' : '🔐', cx, cy + 1);
      if (!t.opened && t.stages > 1) { ctx.font = `bold ${ts * 0.3}px sans-serif`; ctx.fillStyle = '#fde047'; ctx.fillText(`${t.stage}/${t.stages}`, cx, cy + ts * 0.6); }
    } else if (t.kind === 'loot') {
      if (t.taken) continue;
      ctx.fillStyle = 'rgba(250,204,21,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.38, 0, 7); ctx.fill();
      ctx.font = `${ts * 0.55}px sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(t.item.icon, cx, cy + 1);
    } else if (t.kind === 'terminal') {
      ctx.fillStyle = t.done ? '#1e293b' : '#0e7490'; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - ts * 0.34, cy - ts * 0.3, ts * 0.68, ts * 0.6, 3); ctx.fill(); ctx.stroke();
      ctx.font = `bold ${ts * 0.3}px sans-serif`; ctx.fillStyle = '#e0f2fe';
      ctx.fillText(t.effect === 'cam' ? 'CAM' : t.effect === 'laser' ? 'LSR' : 'LCK', cx, cy + 1);
    } else if (t.kind === 'camera') {
      const on = t.off <= 0;
      if (on && (run || o.recon >= 1)) cone(camPos(t).x, camPos(t).y, t.ang, t.fov, t.range, plan ? 'rgba(255,80,100,0.1)' : t.sus > 0.3 ? 'rgba(255,60,60,0.22)' : 'rgba(255,90,90,0.13)');
      ctx.fillStyle = on ? '#ef4444' : '#475569';
      ctx.beginPath(); ctx.arc(cx, cy, ts * 0.26, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t.ang) * ts * 0.5, cy + Math.sin(t.ang) * ts * 0.5); ctx.stroke();
    }
  }

  // decoys & smoke
  for (const d of s.decoys) { ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(d.x), Y(d.y), ts * (0.3 + (s.t % 1) * 0.5), 0, 7); ctx.stroke(); ctx.font = `${ts * 0.5}px sans-serif`; ctx.fillText('📻', X(d.x), Y(d.y)); }
  for (const m of s.smoke) {
    const g = ctx.createRadialGradient(X(m.x), Y(m.y), 2, X(m.x), Y(m.y), m.r * ts);
    const a = Math.min(0.85, m.t / 3);
    g.addColorStop(0, `rgba(190,200,215,${a})`); g.addColorStop(1, 'rgba(190,200,215,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), m.r * ts, 0, 7); ctx.fill();
  }

  // guard routes (intel)
  const showG = run || o.recon >= 2;
  if (plan && showG) {
    for (const g of s.guards) {
      if (g.route.length < 2) continue;
      ctx.strokeStyle = GCOL[g.type]; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
      ctx.beginPath(); g.route.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  // plan paths
  for (const pv of o.paths) {
    if (pv.pts.length < 2) continue;
    ctx.strokeStyle = pv.color; ctx.lineWidth = pv.dim ? 1.5 : 3; ctx.globalAlpha = pv.dim ? 0.45 : 0.95; ctx.setLineDash(pv.dim ? [4, 4] : []);
    ctx.beginPath(); pv.pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke();
    ctx.setLineDash([]);
    pv.pts.forEach((p, i) => {
      if (!i) return;
      ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), ts * 0.24, 0, 7); ctx.fill();
      ctx.strokeStyle = pv.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${ts * 0.26}px sans-serif`; ctx.fillText(p.sym || String(i), X(p.x), Y(p.y) + 0.5);
    });
    ctx.globalAlpha = 1;
  }

  // guards
  if (showG) {
    for (const g of s.guards) {
      if (g.state === 'down') {
        if (g.hidden) continue;
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; const gx = X(g.x), gy = Y(g.y), r = ts * 0.22;
        ctx.beginPath(); ctx.moveTo(gx - r, gy - r); ctx.lineTo(gx + r, gy + r); ctx.moveTo(gx + r, gy - r); ctx.lineTo(gx - r, gy + r); ctx.stroke();
        continue;
      }
      const T = { guard: [7, 1.45], sentinel: [8, 1.3], k9: [6, 1.6], drone: [6.5, 2.0], captain: [9, 1.9], cop: [9, 1.8] }[g.type];
      const alert = g.state === 'alert' || g.state === 'hunt';
      if (g.stun <= 0) cone(g.x, g.y, g.ang, T[1], T[0] * (g.state === 'chat' ? 0.5 : 1), alert ? 'rgba(255,60,60,0.2)' : g.sus > 0.3 ? 'rgba(255,170,40,0.22)' : plan ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.14)');
      const gx = X(g.x), gy = Y(g.y);
      const r = ts * (g.type === 'captain' ? 0.45 : g.type === 'k9' ? 0.24 : 0.33);
      ctx.fillStyle = g.stun > 0 ? '#64748b' : GCOL[g.type]; ctx.strokeStyle = alert ? '#fff' : '#0b1220'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (g.type === 'drone') { ctx.moveTo(gx, gy - r * 1.2); ctx.lineTo(gx + r * 1.2, gy); ctx.lineTo(gx, gy + r * 1.2); ctx.lineTo(gx - r * 1.2, gy); ctx.closePath(); } else ctx.arc(gx, gy, r, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#0b1220'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(g.ang) * r * 1.5, gy + Math.sin(g.ang) * r * 1.5); ctx.stroke();
      if (g.sus > 0.05 && g.state !== 'alert') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(gx - ts * 0.3, gy - ts * 0.62, ts * 0.6, 4); ctx.fillStyle = g.sus > 0.6 ? '#ef4444' : '#fbbf24'; ctx.fillRect(gx - ts * 0.3, gy - ts * 0.62, ts * 0.6 * Math.min(1, g.sus), 4); }
      if (g.state === 'alert') { ctx.fillStyle = '#ef4444'; ctx.font = `bold ${ts * 0.55}px sans-serif`; ctx.fillText('!', gx, gy - ts * 0.7); }
      else if (g.state === 'suspicious' || g.state === 'investigate') { ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${ts * 0.5}px sans-serif`; ctx.fillText('?', gx, gy - ts * 0.7); }
      else if (g.state === 'chat') { ctx.font = `${ts * 0.4}px sans-serif`; ctx.fillText('💬', gx, gy - ts * 0.7); }
      if (g.maxHp > 60 && g.maxHp < 900 && g.hp < g.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(gx - ts * 0.4, gy + ts * 0.5, ts * 0.8, 4); ctx.fillStyle = '#f43f5e'; ctx.fillRect(gx - ts * 0.4, gy + ts * 0.5, ts * 0.8 * Math.max(0, g.hp / g.maxHp), 4); }
      if (g.type === 'captain') { ctx.fillStyle = '#fff'; ctx.font = `bold ${ts * 0.3}px sans-serif`; ctx.fillText('VOSS', gx, gy + ts * 0.72); }
    }
  }

  // crew
  for (const c of s.crew) {
    if (c.state === 'out') continue;
    const cx = X(c.x), cy = Y(c.y), r = ts * 0.34;
    const col = ROLE_INFO[c.ref.role].color;
    if (c.state === 'down') {
      ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
      continue;
    }
    c.trail.forEach((p, i) => { ctx.fillStyle = col; ctx.globalAlpha = (i / c.trail.length) * 0.25; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r * 0.6, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (o.selected === c.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = c.vanish > 0 ? 0.4 : c.state === 'ambush' ? 0.7 : 1;
    ctx.fillStyle = c.hurt > 0 ? '#ef4444' : col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b1220'; ctx.font = `bold ${ts * 0.36}px sans-serif`; ctx.fillText(c.ref.name[0], cx, cy + 1);
    if (c.work) {
      const p = Math.min(1, c.work.t / c.work.total);
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 3, -Math.PI / 2, -Math.PI / 2 + p * 6.283); ctx.stroke();
    }
    if (c.hp < c.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - r, cy - r - 8, r * 2, 4); ctx.fillStyle = '#4ade80'; ctx.fillRect(cx - r, cy - r - 8, r * 2 * Math.max(0, c.hp / c.maxHp), 4); }
    if (c.carry.length) { ctx.font = `${ts * 0.32}px sans-serif`; ctx.fillText(c.carry.map(i => i.icon).join(''), cx, cy + r + ts * 0.28); }
    if (c.stun > 0) { ctx.font = `${ts * 0.4}px sans-serif`; ctx.fillText('💫', cx, cy - r - ts * 0.35); }
  }

  // particles, ripples, floaters
  for (const p of s.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(X(p.x), Y(p.y), p.size * ts, p.size * ts); }
  ctx.globalAlpha = 1;
  for (const r of s.ripples) { ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - r.t / 0.9; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), (r.t / 0.9) * r.r * ts, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const f of s.floaters) {
    const k = f.t / f.life, sc = f.big ? 1 + Math.max(0, 0.4 - f.t * 2) : 1;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.font = `bold ${(f.big ? ts * 0.62 : ts * 0.4) * sc}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, X(f.x), Y(f.y));
    ctx.fillStyle = f.color; ctx.fillText(f.text, X(f.x), Y(f.y));
  }
  ctx.globalAlpha = 1;

  // hover
  if (o.hover) {
    const hx = Math.floor(o.hover.x), hy = Math.floor(o.hover.y);
    if (hx >= 0 && hy >= 0 && hx < W && hy < H && s.w.tiles[hy * W + hx] !== 0) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(X(hx) + 1, Y(hy) + 1, ts - 2, ts - 2); }
  }
  ctx.restore();

  // screen overlays
  if (run && s.full) {
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 6);
    const g = ctx.createRadialGradient(v.cw / 2, v.ch / 2, Math.min(v.cw, v.ch) * 0.35, v.cw / 2, v.ch / 2, Math.max(v.cw, v.ch) * 0.7);
    g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.15 + pulse * 0.2})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, v.cw, v.ch);
  }
  if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.35})`; ctx.fillRect(0, 0, v.cw, v.ch); }
  if (o.focus) { ctx.fillStyle = 'rgba(56,120,255,0.06)'; ctx.fillRect(0, 0, v.cw, v.ch); ctx.strokeStyle = 'rgba(96,165,250,0.6)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, v.cw - 4, v.ch - 4); }
}
