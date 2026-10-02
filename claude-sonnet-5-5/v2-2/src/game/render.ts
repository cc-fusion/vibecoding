import { World, Pt, T_WALL, T_STREET } from './mapgen';
import { HeistSim, Plan, stepIcon, CrewRun } from './sim';
import { LOOT, GadgetId, GADGETS } from './data';

export interface View { scale: number; ox: number; oy: number }
export interface DrawCfg {
  world: World; sim: HeistSim; W: number; H: number; dpr: number; view: View; phase: 'plan' | 'exec' | 'done'; intel: number;
  plan: Plan; selCrew: string; paths: Record<string, Pt[][]>; hover: Pt | null; targeting: GadgetId | null; shakeOn: boolean; time: number; tool: string;
}

const LOCK_COL = ['#4ade80', '#fde047', '#fb923c', '#f87171', '#e879f9'];
const FONT = '"Share Tech Mono", ui-monospace, monospace';

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', bold = false) {
  ctx.save(); ctx.translate(x, y); const k = size / 20; ctx.scale(k, k);
  ctx.font = `${bold ? 'bold ' : ''}20px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 0); ctx.restore();
}
function emoji(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x, y); const k = size / 20; ctx.scale(k, k);
  ctx.font = '20px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 0); ctx.restore();
}

function cone(ctx: CanvasRenderingContext2D, sim: HeistSim, x: number, y: number, dir: number, fov: number, range: number, fill: string) {
  const n = 18;
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 0; i <= n; i++) {
    const a = dir - fov / 2 + fov * i / n;
    const cx = Math.cos(a), cy = Math.sin(a);
    let d = 0.4;
    while (d < range) { if (sim.blocks(x + cx * d, y + cy * d)) break; d += 0.3; }
    ctx.lineTo(x + cx * Math.min(d, range), y + cy * Math.min(d, range));
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

export function draw(ctx: CanvasRenderingContext2D, c: DrawCfg) {
  const { world: w, sim, view, phase } = c;
  const exec = phase !== 'plan';
  const intel = exec ? 3 : c.intel;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050a14'; ctx.fillRect(0, 0, c.W * c.dpr, c.H * c.dpr);
  const sh = c.shakeOn ? sim.shake : 0;
  const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
  const S = view.scale * c.dpr;
  ctx.setTransform(S, 0, 0, S, (view.ox + sx) * c.dpr, (view.oy + sy) * c.dpr);

  // ---- street
  ctx.fillStyle = '#0a1424'; ctx.fillRect(0, w.bh, w.w, w.h - w.bh);
  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  for (let x = 1; x < w.w; x += 3) ctx.fillRect(x, w.bh + 1.45, 1.4, 0.1);
  txt(ctx, `${w.tpl.icon} ${w.tpl.name.toUpperCase()}`, w.w / 2, w.bh + 2.5, 0.9, 'rgba(56,189,248,0.35)', 'center', true);

  // ---- floors
  for (let y = 0; y < w.bh; y++) for (let x = 0; x < w.w; x++) {
    const t = w.tiles[y * w.w + x];
    if (t === T_WALL || t === T_STREET) continue;
    const r = w.rooms[w.roomOf[y * w.w + x]] ?? w.rooms[w.rooms.findIndex(rm => rm.id === (w.doors[w.doorAt[y * w.w + x]]?.rooms[0] ?? -1))];
    const light = r ? r.light : 1;
    const base = exec ? 22 + 20 * light : 20 + 16 * light;
    ctx.fillStyle = `rgb(${base * 0.55 | 0},${base * 0.95 | 0},${base * 1.55 + 10 | 0})`;
    ctx.fillRect(x, y, 1.02, 1.02);
    if (r && r.role === 'vault') { ctx.fillStyle = 'rgba(232,121,249,0.08)'; ctx.fillRect(x, y, 1.02, 1.02); }
  }
  ctx.strokeStyle = 'rgba(56,189,248,0.07)'; ctx.lineWidth = 0.03; ctx.beginPath();
  for (let x = 0; x <= w.w; x++) { ctx.moveTo(x, 0); ctx.lineTo(x, w.bh); }
  for (let y = 0; y <= w.bh; y++) { ctx.moveTo(0, y); ctx.lineTo(w.w, y); }
  ctx.stroke();

  // alarm pulse overlay per room
  for (const rm of w.rooms) {
    const p = sim.roomPulse[rm.id];
    let a = 0;
    if (p !== undefined) a = Math.max(0, 0.32 * (1 - (sim.time - p) / 2.2));
    if (sim.alarm) a = Math.max(a, 0.07 + 0.06 * Math.sin(c.time * 6));
    if (a > 0.005 && exec) { ctx.fillStyle = `rgba(248,50,50,${a})`; ctx.fillRect(rm.x, rm.y, rm.w, rm.h); }
  }

  // ---- walls
  for (let y = 0; y < w.bh; y++) for (let x = 0; x < w.w; x++) {
    if (w.tiles[y * w.w + x] !== T_WALL) continue;
    ctx.fillStyle = '#17385a'; ctx.fillRect(x, y, 1.02, 1.02);
    ctx.fillStyle = '#2b6aa0'; ctx.fillRect(x + 0.18, y + 0.18, 0.66, 0.66);
  }

  // ---- room labels
  if (!exec || view.scale > 22) for (const rm of w.rooms) {
    if (view.scale < 11) break;
    txt(ctx, rm.name.toUpperCase(), rm.x + 0.25, rm.y + 0.45, 0.42, 'rgba(147,197,253,0.4)', 'left');
  }

  // ---- doors
  for (const d of w.doors) {
    const hz = w.tiles[d.y * w.w + d.x - 1] !== T_WALL && w.tiles[d.y * w.w + d.x + 1] !== T_WALL;
    const isOpen = d.open || d.openT > 0;
    const col = intel >= 1 || d.lock === 0 ? LOCK_COL[Math.min(4, d.lock)] : '#94a3b8';
    ctx.save(); ctx.translate(d.x + 0.5, d.y + 0.5); if (!hz) ctx.rotate(Math.PI / 2);
    if (isOpen) { ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(-0.5, 0.35); ctx.lineTo(-0.5, -0.35); ctx.stroke(); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = d.sealed ? '#7f1d1d' : '#0b1220'; ctx.fillRect(-0.5, -0.28, 1, 0.56); ctx.strokeStyle = col; ctx.lineWidth = 0.1; ctx.strokeRect(-0.44, -0.22, 0.88, 0.44); }
    ctx.restore();
    if (!isOpen && d.vault) emoji(ctx, d.sealed ? '⛔' : '🔒', d.x + 0.5, d.y + 0.5, 0.7);
    else if (!isOpen && intel >= 1 && d.lock > 0 && view.scale > 14) txt(ctx, 'L' + d.lock, d.x + 0.5, d.y + 0.5, 0.42, col, 'center', true);
  }

  // ---- lasers
  if (intel >= 1) for (const L of w.lasers) {
    const on = exec ? sim.laserOn(L.id, sim.time) : true;
    const off = exec && (sim.laserOffT > 0 || sim.laserEmp[L.id] > 0);
    const a = L.cells[0], b = L.cells[L.cells.length - 1];
    ctx.save();
    if (on) { ctx.shadowColor = '#f87171'; ctx.shadowBlur = 10; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 0.1; }
    else { ctx.strokeStyle = off ? 'rgba(100,116,139,0.3)' : 'rgba(248,113,113,0.25)'; ctx.lineWidth = 0.05; ctx.setLineDash([0.2, 0.25]); }
    ctx.beginPath(); ctx.moveTo(a.x + 0.5, a.y + 0.5); ctx.lineTo(b.x + 0.5, b.y + 0.5); ctx.stroke();
    ctx.restore();
    if (!exec) txt(ctx, L.solid ? 'SOLID' : 'PULSE', (a.x + b.x) / 2 + 0.5, (a.y + b.y) / 2 + 0.5, 0.35, '#fecaca');
  }

  // ---- objects
  for (const t of w.terms) { emoji(ctx, t.kind === 'vault' ? '⏲️' : t.kind === 'comms' ? '📡' : t.kind === 'lasers' ? '🔦' : '🖥️', t.x + 0.5, t.y + 0.5, 0.85); if (t.hacked) txt(ctx, '✔', t.x + 0.9, t.y + 0.1, 0.5, '#4ade80'); else if (view.scale > 15) txt(ctx, t.kind.toUpperCase(), t.x + 0.5, t.y + 1.05, 0.34, '#7dd3fc'); }
  if (intel >= 1) for (const p of w.panels) { emoji(ctx, '🚨', p.x + 0.5, p.y + 0.5, 0.7); if (p.disabled) txt(ctx, '✖', p.x + 0.5, p.y + 0.5, 0.8, '#f87171'); }
  for (const s of w.safes) { emoji(ctx, s.opened ? '📦' : '🔐', s.x + 0.5, s.y + 0.5, 0.85); if (!s.opened && view.scale > 14) txt(ctx, 'L' + s.lock, s.x + 0.5, s.y + 1.05, 0.34, '#fde047'); }
  for (const l of w.loot) {
    if (l.taken || l.hidden) continue;
    const bob = Math.sin(c.time * 3 + l.id) * 0.04;
    ctx.fillStyle = 'rgba(253,224,71,0.15)'; ctx.beginPath(); ctx.arc(l.x + 0.5, l.y + 0.5, 0.5 + bob, 0, 6.283); ctx.fill();
    emoji(ctx, LOOT[l.kind].icon, l.x + 0.5, l.y + 0.5 + bob, 0.8);
  }
  // van
  emoji(ctx, '🚐', w.van.x + 0.5, w.van.y + 0.5, 1.5);

  // ---- cameras
  if (intel >= 1) for (const cm of w.cams) {
    const off = cm.emp > 0 || cm.off > 0 || sim.camOffT > 0;
    if (!off) cone(ctx, sim, cm.x + 0.5, cm.y + 0.5, exec ? cm.ang : cm.a, cm.fov, cm.range, cm.alertT > 0 ? 'rgba(248,113,113,0.3)' : `rgba(251,191,36,${0.1 + cm.susp * 0.25})`);
    ctx.fillStyle = off ? '#64748b' : cm.alertT > 0 ? '#f87171' : '#fbbf24';
    ctx.beginPath(); ctx.arc(cm.x + 0.5, cm.y + 0.5, 0.28, 0, 6.283); ctx.fill();
    emoji(ctx, '📹', cm.x + 0.5, cm.y + 0.5, 0.5);
    if (!exec) { ctx.strokeStyle = 'rgba(251,191,36,0.4)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(cm.x + 0.5, cm.y + 0.5, cm.range, cm.a - cm.sweep - cm.fov / 2, cm.a + cm.sweep + cm.fov / 2); ctx.stroke(); }
  }

  // ---- guard routes (intel 2)
  if (!exec && intel >= 2) for (const g of w.guards) {
    if (g.post || g.route.length < 2) continue;
    ctx.strokeStyle = g.type === 'warden' ? 'rgba(240,171,252,0.5)' : g.type === 'drone' ? 'rgba(167,139,250,0.5)' : 'rgba(248,113,113,0.45)';
    ctx.lineWidth = 0.07; ctx.setLineDash([0.3, 0.2]); ctx.beginPath();
    g.route.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x + 0.5, p.y + 0.5); else ctx.lineTo(p.x + 0.5, p.y + 0.5); });
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    g.route.forEach(p => { ctx.fillStyle = 'rgba(248,113,113,0.5)'; ctx.beginPath(); ctx.arc(p.x + 0.5, p.y + 0.5, 0.12, 0, 6.283); ctx.fill(); });
  }

  // ---- guards cones & bodies
  if (intel >= 1) for (const g of sim.guards) {
    if (g.state === 'down' || g.type === 'civilian' && intel < 2 && !exec) continue;
    if (g.type === 'drone' && g.emp > 0) continue;
    const fill = g.state === 'alert' ? 'rgba(248,50,50,0.28)' : g.state === 'suspicious' || g.susp > 0.35 ? 'rgba(251,191,36,0.2)' : g.flash > 0 ? 'rgba(255,255,255,0.05)' : g.type === 'civilian' ? 'rgba(251,191,36,0.07)' : 'rgba(248,113,113,0.13)';
    if (g.stun <= 0) cone(ctx, sim, g.x, g.y, g.dir, g.fov, g.range, fill);
  }

  // ---- plan paths
  const selRun = sim.crew.find(cr => cr.id === c.selCrew);
  if (!exec) {
    for (const cr of sim.crew) {
      const segs = c.paths[cr.id]; if (!segs) continue;
      const sel = cr.id === c.selCrew;
      ctx.strokeStyle = cr.color; ctx.globalAlpha = sel ? 0.95 : 0.35; ctx.lineWidth = sel ? 0.13 : 0.08; ctx.setLineDash([0.28, 0.2]); ctx.lineDashOffset = -c.time * 0.6;
      for (const seg of segs) { if (seg.length < 2) continue; ctx.beginPath(); seg.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      const steps = c.plan[cr.id] || [];
      steps.forEach((s, i) => {
        if (s.t === 'wait' || s.t === 'sync') return;
        const px = (s.t === 'takedown' || (s.t === 'gadget' && s.g === 'dart')) ? (w.guards[s.id ?? 0]?.x ?? s.x) + 0.5 : s.x + 0.5;
        const py = (s.t === 'takedown' || (s.t === 'gadget' && s.g === 'dart')) ? (w.guards[s.id ?? 0]?.y ?? s.y) + 0.5 : s.y + 0.5;
        ctx.globalAlpha = sel ? 1 : 0.45;
        ctx.fillStyle = '#06101f'; ctx.strokeStyle = cr.color; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.arc(px + 0.3, py - 0.3, 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
        txt(ctx, String(i + 1), px + 0.3, py - 0.3, 0.38, cr.color, 'center', true);
        emoji(ctx, stepIcon(s), px - 0.1, py + 0.15, 0.5);
        ctx.globalAlpha = 1;
      });
    }
  } else if (selRun && selRun.path.length) {
    ctx.strokeStyle = selRun.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.08; ctx.setLineDash([0.2, 0.2]);
    ctx.beginPath(); ctx.moveTo(selRun.x, selRun.y); selRun.path.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // ---- smoke clouds
  for (const s of sim.smokes) {
    const a = Math.min(1, s.t / 2) * 0.55;
    for (let i = 0; i < 6; i++) { const ang = i * 1.05 + c.time * 0.3; ctx.fillStyle = `rgba(203,213,225,${a * 0.5})`; ctx.beginPath(); ctx.arc(s.x + Math.cos(ang) * s.r * 0.45, s.y + Math.sin(ang) * s.r * 0.45, s.r * 0.6, 0, 6.283); ctx.fill(); }
  }

  // ---- guards
  for (const g of sim.guards) {
    if (!exec && intel < 1) break;
    const down = g.state === 'down', R = g.type === 'heavy' ? 0.46 : g.type === 'warden' ? 0.5 : g.type === 'drone' ? 0.3 : 0.38;
    ctx.save(); ctx.translate(g.x, g.y);
    if (down) {
      ctx.fillStyle = g.hidden ? 'rgba(100,116,139,0.25)' : '#64748b'; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.2, R * 0.7, 0.4, 0, 6.283); ctx.fill();
      txt(ctx, 'z z', 0.2, -0.4, 0.4, '#cbd5e1');
    } else {
      const body = g.type === 'warden' ? '#d946ef' : g.type === 'heavy' ? '#b91c1c' : g.type === 'drone' ? '#8b5cf6' : g.type === 'civilian' ? '#f59e0b' : '#ef4444';
      if (g.state === 'alert') { ctx.strokeStyle = `rgba(248,50,50,${0.5 + 0.5 * Math.sin(c.time * 12)})`; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(0, 0, R + 0.2, 0, 6.283); ctx.stroke(); }
      ctx.fillStyle = body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.06;
      if (g.type === 'drone') { ctx.rotate(c.time * 3); ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R, 0); ctx.lineTo(0, R); ctx.lineTo(-R, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.rotate(-c.time * 3); }
      else { ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.rotate(g.dir); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(R + 0.18, 0); ctx.lineTo(R - 0.05, -0.12); ctx.lineTo(R - 0.05, 0.12); ctx.fill(); ctx.rotate(-g.dir); }
      if (g.type === 'warden') txt(ctx, '👑', 0, -R - 0.2, 0.6, '#fff');
      else if (g.type === 'heavy') txt(ctx, 'H', 0, 0.02, 0.5, '#fff', 'center', true);
      else if (g.type === 'civilian') txt(ctx, 'C', 0, 0.02, 0.45, '#451a03', 'center', true);
      if (g.stun > 0 || g.emp > 0) emoji(ctx, g.emp > 0 ? '⚡' : '💫', 0, -0.7, 0.6);
      if (g.flash > 0) emoji(ctx, '😵', 0, -0.7, 0.6);
      if (g.susp > 0.02 && g.state !== 'alert') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-0.4, -R - 0.32, 0.8, 0.14); ctx.fillStyle = g.susp > 0.7 ? '#f87171' : '#fbbf24'; ctx.fillRect(-0.4, -R - 0.32, 0.8 * Math.min(1, g.susp), 0.14); }
      if (g.state === 'alert' && !sim.alarm && !g.called && sim.jamT <= 0) { ctx.fillStyle = '#fbbf24'; ctx.fillRect(-0.4, -R - 0.32, 0.8 * Math.min(1, g.radioT / 1.5), 0.12); emoji(ctx, '📻', 0.55, -R - 0.3, 0.45); }
    }
    ctx.restore();
    if (!exec) txt(ctx, '#' + (g.id + 1), g.x, g.y + 0.75, 0.38, '#fecaca');
  }

  // ---- crew
  const drawCrew = (cr: CrewRun) => {
    const sel = cr.id === c.selCrew;
    ctx.save(); ctx.translate(cr.x, cr.y);
    if (cr.state === 'arrested') { emoji(ctx, '⛓️', 0, 0, 0.9); ctx.restore(); return; }
    if (cr.state === 'escaped') { ctx.restore(); return; }
    if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.07; ctx.setLineDash([0.15, 0.12]); ctx.lineDashOffset = -c.time; ctx.beginPath(); ctx.arc(0, 0, 0.58, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
    ctx.shadowColor = cr.color; ctx.shadowBlur = 8;
    ctx.fillStyle = cr.color; ctx.beginPath(); ctx.arc(0, 0, 0.36, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 0.07; ctx.stroke();
    emoji(ctx, cr.icon, 0, 0.02, 0.5);
    if (cr.state === 'work') { const p = cr.auto ? cr.auto.t / cr.auto.dur : cr.workDur ? cr.workT / cr.workDur : 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(0, 0, 0.5, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.min(1, p)); ctx.stroke(); }
    if (cr.carryW > 0) emoji(ctx, '💰', 0.4, -0.4, 0.5);
    if (cr.state === 'wait' || cr.state === 'hold') emoji(ctx, cr.state === 'hold' ? '⏸️' : '⏳', 0, -0.75, 0.5);
    ctx.restore();
    if (exec || sel) txt(ctx, cr.name, cr.x, cr.y + 0.78, 0.4, cr.color, 'center', true);
  };
  sim.crew.forEach(cr => { if (cr.id !== c.selCrew) drawCrew(cr); });
  if (selRun) drawCrew(selRun);

  // ---- rings
  for (const r of sim.rings) { const k = r.t / r.life; ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(r.x, r.y, r.max * k, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  // ---- particles
  for (const p of sim.particles) {
    const k = Math.max(0, p.life / p.max);
    ctx.globalAlpha = k * (p.kind === 'smoke' ? 0.5 : 1); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 3 + (1 - k) * 4 : 1), 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- hover
  if (c.hover && phase !== 'done') {
    const h = c.hover;
    ctx.strokeStyle = c.targeting ? '#fbbf24' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.07;
    ctx.strokeRect(h.x + 0.05, h.y + 0.05, 0.9, 0.9);
    if (c.targeting) { ctx.beginPath(); ctx.arc(h.x + 0.5, h.y + 0.5, c.targeting === 'smoke' ? 3 : c.targeting === 'emp' ? 5 : c.targeting === 'flash' ? 4 : 0.6, 0, 6.283); ctx.setLineDash([0.2, 0.2]); ctx.stroke(); ctx.setLineDash([]); emoji(ctx, GADGETS[c.targeting].icon, h.x + 0.5, h.y - 0.3, 0.8); }
  }

  // ---- floating text
  for (const t of sim.texts) {
    const k = t.t / t.life, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
    const pop = 1 + Math.max(0, 0.4 - k * 2) * 1.5;
    ctx.globalAlpha = Math.max(0, a);
    txt(ctx, t.text, t.x, t.y, 0.55 * t.size * pop, '#000', 'center', true);
    txt(ctx, t.text, t.x - 0.02, t.y - 0.02, 0.55 * t.size * pop, t.color, 'center', true);
    ctx.globalAlpha = 1;
  }

  // ---- screen space overlays
  ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
  if (exec && sim.alarm) {
    const g = ctx.createRadialGradient(c.W / 2, c.H / 2, Math.min(c.W, c.H) * 0.4, c.W / 2, c.H / 2, Math.max(c.W, c.H) * 0.75);
    g.addColorStop(0, 'rgba(220,38,38,0)'); g.addColorStop(1, `rgba(220,38,38,${0.25 + 0.15 * Math.sin(c.time * 6)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
  }
  if (sim.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, sim.flash)})`; ctx.fillRect(0, 0, c.W, c.H); }
}
