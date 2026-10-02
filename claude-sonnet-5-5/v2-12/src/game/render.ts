import { Game, driftPlan, findOpt, unitAt, massOf, fieldAt, Unit } from './engine';
import { SHAPES, UType } from './data';

export interface View {
  cw: number;
  ch: number;
  cell: number;
  ox: number;
  oy: number;
}

export function layout(cw: number, ch: number, G: Game): View {
  const cell = Math.max(24, Math.floor(Math.min((cw - 16) / G.W, (ch - 16) / G.H)));
  return { cw, ch, cell, ox: Math.floor((cw - cell * G.W) / 2), oy: Math.floor((ch - cell * G.H) / 2) };
}

export function tileFromPoint(v: View, G: Game, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - v.ox) / v.cell);
  const y = Math.floor((py - v.oy) / v.cell);
  if (x < 0 || y < 0 || x >= G.W || y >= G.H) return null;
  return { x, y };
}

const STARS = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.3, p: Math.random() * 6 }));
const PATHS: Partial<Record<UType, Path2D>> = {};
function pathFor(t: UType): Path2D {
  let p = PATHS[t];
  if (!p) {
    p = new Path2D(SHAPES[t]);
    PATHS[t] = p;
  }
  return p;
}

// displacement of spacetime at tile-space point (tile corner coords)
function disp(G: Game, px: number, py: number): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const a of G.anoms) {
    const vx = a.x + 0.5 - px;
    const vy = a.y + 0.5 - py;
    const k = (a.m * G.gs * 0.045) / (vx * vx + vy * vy + 0.6);
    dx += vx * k;
    dy += vy * k;
  }
  for (const u of G.units) {
    if (!u.alive) continue;
    const vx = u.rx + 0.5 - px;
    const vy = u.ry + 0.5 - py;
    const k = (massOf(u) * G.gs * 0.045) / (vx * vx + vy * vy + 0.6);
    dx += vx * k;
    dy += vy * k;
  }
  const l = Math.hypot(dx, dy);
  if (l > 0.34) {
    dx = (dx / l) * 0.34;
    dy = (dy / l) * 0.34;
  }
  return [dx, dy];
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function draw(ctx: CanvasRenderingContext2D, G: Game, v: View) {
  const { cw, ch, cell, ox, oy } = v;
  const t = G.time;
  ctx.clearRect(0, 0, cw, ch);
  // background
  const bg = ctx.createRadialGradient(cw / 2, ch / 2, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  bg.addColorStop(0, '#141a3d');
  bg.addColorStop(1, '#05060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);
  for (const s of STARS) {
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + s.p));
    ctx.fillStyle = '#cfe0ff';
    ctx.fillRect(s.x * cw, s.y * ch, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * cell * 0.3, (Math.random() - 0.5) * G.shake * cell * 0.3);

  // warped vertices
  const vw = G.W + 1;
  const vp: [number, number][] = [];
  for (let j = 0; j <= G.H; j++)
    for (let i = 0; i <= G.W; i++) {
      const [dx, dy] = disp(G, i, j);
      vp.push([ox + (i + dx) * cell, oy + (j + dy) * cell]);
    }
  const P = (i: number, j: number) => vp[j * vw + i];
  const warpPt = (tx: number, ty: number): [number, number] => {
    const [dx, dy] = disp(G, tx, ty);
    return [ox + (tx + dx) * cell, oy + (ty + dy) * cell];
  };

  const sel = G.sel;
  const hoverU = G.hover ? unitAt(G, G.hover.x, G.hover.y) : null;

  // tiles
  for (let y = 0; y < G.H; y++)
    for (let x = 0; x < G.W; x++) {
      const c = G.terrain[y][x];
      const a = P(x, y);
      const b = P(x + 1, y);
      const d = P(x + 1, y + 1);
      const e = P(x, y + 1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.closePath();
      ctx.fillStyle = (x + y) % 2 ? '#0f1534' : '#131a3f';
      if (c === 'N') ctx.fillStyle = (x + y) % 2 ? '#2a1850' : '#31205c';
      ctx.fill();
      const [fx, fy] = fieldAt(G, x, y, null);
      const mag = Math.hypot(fx, fy);
      const al = Math.min(G.showField ? 0.5 : 0.16, mag * (G.showField ? 0.07 : 0.025));
      if (al > 0.01) {
        ctx.fillStyle = `rgba(70,150,255,${al})`;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,160,255,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

  // move highlights
  if (sel && G.phase === 'player') {
    G.moveMap.forEach((r) => {
      const a = P(r.x, r.y);
      const b = P(r.x + 1, r.y);
      const d = P(r.x + 1, r.y + 1);
      const e = P(r.x, r.y + 1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(79,240,255,0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(79,240,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const cx = (a[0] + d[0]) / 2;
      const cy = (a[1] + d[1]) / 2;
      ctx.font = `600 ${Math.max(9, cell * 0.2)}px Rajdhani, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = r.cost < 0.95 ? '#7dffb0' : r.cost > 1.05 ? '#ffb07d' : '#ffffff';
      ctx.fillText(r.cost.toFixed(1), cx, cy + cell * 0.3);
    });
  }

  // anomalies
  for (const an of G.anoms) {
    const [cx, cy] = warpPt(an.x + 0.5, an.y + 0.5);
    const R = cell * 0.44;
    if (an.kind === 'hole') {
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R);
      g.addColorStop(0, '#000');
      g.addColorStop(0.7, '#000');
      g.addColorStop(1, 'rgba(150,60,255,0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(197,139,255,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const st = t * 2 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.8, st, st + 1.2);
        ctx.stroke();
      }
    } else if (an.kind === 'well' || an.kind === 'pwell' || an.kind === 'bwell') {
      const col = an.kind === 'bwell' ? '#c58bff' : '#5aa2ff';
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.7 + i / 4) % 1;
        ctx.strokeStyle = rgba(col, ph * 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, (1 - ph) * R, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(col, 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const col = '#ffa24f';
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.7 + i / 4) % 1;
        ctx.strokeStyle = rgba(col, (1 - ph) * 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ph * R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (an.ttl !== undefined) {
      ctx.font = `700 ${Math.max(9, cell * 0.2)}px Rajdhani, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(an.ttl), cx + R * 0.7, cy - R * 0.7);
    }
  }

  // rocks
  for (let y = 0; y < G.H; y++)
    for (let x = 0; x < G.W; x++) {
      if (G.terrain[y][x] !== '#') continue;
      const [cx, cy] = warpPt(x + 0.5, y + 0.5);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rr = cell * (0.3 + 0.12 * Math.abs(Math.sin(x * 7.3 + y * 3.1 + i * 2.2)));
        const px = cx + Math.cos(ang) * rr;
        const py = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#3a3f55';
      ctx.fill();
      ctx.strokeStyle = '#7f88aa';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

  // nebula speckles
  for (let y = 0; y < G.H; y++)
    for (let x = 0; x < G.W; x++) {
      if (G.terrain[y][x] !== 'N') continue;
      for (let i = 0; i < 4; i++) {
        const ph = t * 0.3 + x * 1.7 + y * 2.3 + i * 1.6;
        const [px, py] = warpPt(x + 0.5 + Math.cos(ph) * 0.3, y + 0.5 + Math.sin(ph * 1.3) * 0.3);
        ctx.fillStyle = `rgba(200,150,255,${0.25 + 0.2 * Math.sin(ph * 2)})`;
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  // field arrows
  if (G.showField) {
    ctx.lineWidth = 1.5;
    for (let y = 0; y < G.H; y++)
      for (let x = 0; x < G.W; x++) {
        const [fx, fy] = fieldAt(G, x, y, null);
        const mag = Math.hypot(fx, fy);
        if (mag < 0.15) continue;
        const len = Math.min(0.42, 0.08 + mag * 0.06) * cell;
        const ux = fx / mag;
        const uy = fy / mag;
        const [cx, cy] = warpPt(x + 0.5, y + 0.5);
        const x1 = cx - ux * len * 0.5;
        const y1 = cy - uy * len * 0.5;
        const x2 = cx + ux * len * 0.5;
        const y2 = cy + uy * len * 0.5;
        ctx.strokeStyle = 'rgba(160,215,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - (ux * 0.3 - uy * 0.2) * len * 0.5, y2 - (uy * 0.3 + ux * 0.2) * len * 0.5);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - (ux * 0.3 + uy * 0.2) * len * 0.5, y2 - (uy * 0.3 - ux * 0.2) * len * 0.5);
        ctx.stroke();
      }
  }

  // telegraph
  if (G.telegraph) {
    const tg = G.telegraph;
    const cells: [number, number][] = [[tg.x, tg.y], [tg.x + 1, tg.y], [tg.x - 1, tg.y], [tg.x, tg.y + 1], [tg.x, tg.y - 1]];
    ctx.fillStyle = `rgba(197,139,255,${0.25 + 0.2 * Math.sin(t * 8)})`;
    ctx.strokeStyle = '#c58bff';
    ctx.lineWidth = 2;
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= G.W || y >= G.H) continue;
      const a = P(x, y);
      const b = P(x + 1, y);
      const d = P(x + 1, y + 1);
      const e = P(x, y + 1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // attack previews
  if (sel && G.phase === 'player') {
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    for (const o of G.attacks) {
      ctx.strokeStyle = 'rgba(255,100,130,0.35)';
      ctx.beginPath();
      o.path.forEach((p, i) => {
        const [sx, sy] = warpPt(p[0] + 0.5, p[1] + 0.5);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const tgt = hoverU && hoverU.team === 'e' ? hoverU : null;
    const opt = tgt ? findOpt(G.attacks, tgt) : null;
    if (opt) {
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = '#ff4f9a';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      opt.path.forEach((p, i) => {
        const [sx, sy] = warpPt(p[0] + 0.5, p[1] + 0.5);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // hover/cursor outlines
  const outline = (x: number, y: number, color: string, w: number, dash = false) => {
    if (x < 0 || y < 0 || x >= G.W || y >= G.H) return;
    const a = P(x, y);
    const b = P(x + 1, y);
    const d = P(x + 1, y + 1);
    const e = P(x, y + 1);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    if (dash) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (sel) outline(sel.x, sel.y, '#fff', 3);
  if (G.hover) outline(G.hover.x, G.hover.y, 'rgba(255,255,255,0.7)', 2);
  outline(G.cursor.x, G.cursor.y, '#ffe36b', 2, true);
  if (G.mode === 'pulse' && G.hover) {
    const [cx, cy] = warpPt(G.hover.x + 0.5, G.hover.y + 0.5);
    const col = G.pulseKind === 'well' ? '#5aa2ff' : '#ffa24f';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (1.1 + 0.1 * Math.sin(t * 6)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // drift arrows data
  const drifts = G.phase === 'over' ? [] : driftPlan(G);
  const driftMap = new Map<Unit, (typeof drifts)[number]>();
  drifts.forEach((d) => driftMap.set(d.u, d));

  // units
  const units = G.units.filter((u) => u.alive).sort((a, b) => a.ry - b.ry);
  for (const u of units) {
    const [dx, dy] = disp(G, u.rx + 0.5, u.ry + 0.5);
    const cx = ox + (u.rx + 0.5 + dx * 0.9) * cell;
    const cy = oy + (u.ry + 0.5 + dy * 0.9) * cell;
    drawUnit(ctx, G, u, cx, cy, cell, driftMap.get(u) || null, u === sel, u === hoverU);
    if (sel && G.phase === 'player' && u.team === 'e' && G.attacks.some((o) => o.targets.includes(u))) {
      ctx.strokeStyle = `rgba(255,80,110,${0.6 + 0.4 * Math.sin(G.time * 8)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (0.46 + 0.03 * Math.sin(G.time * 8)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - cell * 0.12, cy - cell * 0.56);
      ctx.lineTo(cx + cell * 0.12, cy - cell * 0.56);
      ctx.lineTo(cx, cy - cell * 0.46);
      ctx.closePath();
      ctx.fillStyle = '#ff5070';
      ctx.fill();
    }
  }

  // rings
  for (const r of G.rings) {
    const [cx, cy] = warpPt(r.x + 0.5, r.y + 0.5);
    ctx.strokeStyle = rgba(r.color, Math.max(0, r.life / 0.6));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r.r * cell, 0, Math.PI * 2);
    ctx.stroke();
  }
  // beams
  for (const b of G.beams) {
    const al = Math.max(0, b.life / 0.4);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(b.color, al * 0.8);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 7 * al + 2;
    ctx.beginPath();
    b.path.forEach((p, i) => {
      const [sx, sy] = warpPt(p[0] + 0.5, p[1] + 0.5);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,255,255,${al})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // particles
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    const s = p.size * cell;
    ctx.fillRect(ox + (p.x + 0.5) * cell - s / 2, oy + (p.y + 0.5) * cell - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  // floaters
  for (const f of G.floaters) {
    const al = Math.min(1, f.life * 2);
    const sc = 1 + Math.max(0, f.life - 1.0) * 3;
    ctx.globalAlpha = al;
    ctx.font = `700 ${Math.round(cell * 0.3 * f.size * sc)}px Rajdhani, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(f.text, ox + (f.x + 0.5) * cell, oy + (f.y + 0.5) * cell);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, ox + (f.x + 0.5) * cell, oy + (f.y + 0.5) * cell);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // banner
  if (G.banner) {
    const bn = G.banner;
    const al = Math.min(1, bn.t * 3, (1.6 - bn.t) * 5);
    const slide = (1 - Math.min(1, (1.6 - bn.t) * 4)) * 60;
    ctx.save();
    ctx.globalAlpha = Math.max(0, al);
    const hh = Math.min(120, ch * 0.2);
    const grd = ctx.createLinearGradient(0, ch / 2 - hh / 2, 0, ch / 2 + hh / 2);
    grd.addColorStop(0, 'rgba(5,6,15,0)');
    grd.addColorStop(0.5, 'rgba(5,6,15,0.85)');
    grd.addColorStop(1, 'rgba(5,6,15,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, ch / 2 - hh / 2, cw, hh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.min(54, cw * 0.09)}px Orbitron, Rajdhani, system-ui, sans-serif`;
    ctx.fillStyle = bn.text === 'ENEMY PHASE' || bn.text === 'DEFEAT' ? '#ff4f9a' : '#4ff0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.fillText(bn.text, cw / 2 + slide, ch / 2 - (bn.sub ? 10 : 0));
    ctx.shadowBlur = 0;
    if (bn.sub) {
      ctx.font = `600 ${Math.min(20, cw * 0.04)}px Rajdhani, system-ui, sans-serif`;
      ctx.fillStyle = '#c9d6ff';
      ctx.fillText(bn.sub, cw / 2 - slide, ch / 2 + 28);
    }
    ctx.restore();
  }
}

function drawUnit(
  ctx: CanvasRenderingContext2D, G: Game, u: Unit, cx: number, cy: number, cell: number,
  dr: { dx: number; dy: number; fate: string } | null, selected: boolean, hovered: boolean
) {
  const mass = massOf(u);
  const base = cell * (0.3 + Math.min(0.12, mass * 0.012)) * (0.4 + 0.6 * easeOutBack(u.pop));
  const enemy = u.team === 'e';
  const col = enemy ? '#ff4f9a' : '#4ff0ff';
  const dim = u.team === 'p' && u.acted && G.phase === 'player';
  ctx.save();
  ctx.translate(cx, cy);
  // gravity glow
  const glow = ctx.createRadialGradient(0, 0, base * 0.3, 0, 0, base * (1.5 + mass * 0.08));
  glow.addColorStop(0, rgba(col, dim ? 0.1 : 0.3));
  glow.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, base * (1.5 + mass * 0.08), 0, Math.PI * 2);
  ctx.fill();
  if (u.brace) {
    ctx.strokeStyle = '#9bd8ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, base * 1.25, G.time * 2, G.time * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.save();
  const s = base / 40;
  ctx.scale(s, s);
  if (u.type === 'horizon') {
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 52);
    g.addColorStop(0, '#000');
    g.addColorStop(0.72, '#000');
    g.addColorStop(0.8, '#c58bff');
    g.addColorStop(1, 'rgba(255,79,154,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb0e0';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 36 + i * 4, G.time * (1.5 + i * 0.4) + i, G.time * (1.5 + i * 0.4) + i + 1.6);
      ctx.stroke();
    }
  } else {
    const p = pathFor(u.type);
    ctx.globalAlpha = dim ? 0.55 : 1;
    const gr = ctx.createLinearGradient(0, -40, 0, 40);
    if (enemy) {
      gr.addColorStop(0, '#ff8fc0');
      gr.addColorStop(1, '#a3144f');
    } else {
      gr.addColorStop(0, '#9ff8ff');
      gr.addColorStop(1, '#0c8fa3');
    }
    ctx.fillStyle = gr;
    ctx.fill(p);
    ctx.lineWidth = selected ? 6 : 4;
    ctx.strokeStyle = selected ? '#fff' : hovered ? '#ffffffcc' : '#071022';
    ctx.stroke(p);
    if (u.type === 'core') {
      ctx.fillStyle = '#071022';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = enemy ? '#ffd0e6' : '#d0ffff';
      ctx.beginPath();
      ctx.arc(0, 0, 8 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.type === 'mote') {
      ctx.fillStyle = '#071022';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.type === 'singularity') {
      ctx.fillStyle = '#071022';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.type === 'warden') {
      ctx.fillStyle = '#220510';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9b4f';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (u.flash > 0) {
      ctx.globalAlpha = u.flash;
      ctx.fillStyle = '#fff';
      ctx.fill(p);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // hp bar
  const bw = cell * 0.62;
  const by = base + cell * 0.1;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(-bw / 2, by, bw, cell * 0.08);
  const frac = Math.max(0, u.hp / u.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#6bff9a' : frac > 0.25 ? '#ffd24f' : '#ff5a5a';
  ctx.fillRect(-bw / 2, by, bw * frac, cell * 0.08);
  // mass tag + rank pips
  ctx.font = `700 ${Math.max(9, cell * 0.18)}px Rajdhani, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText('m' + mass, base * 0.75, -base * 0.85);
  for (let i = 0; i < u.promo.length; i++) {
    ctx.fillStyle = '#ffd24f';
    ctx.beginPath();
    ctx.arc(-base * 0.9 + i * cell * 0.11, -base * 0.9, cell * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // drift arrow
  if (dr) {
    const ang = Math.atan2(dr.dy, dr.dx);
    const danger = dr.fate === 'hole';
    const pulse = danger ? 0.6 + 0.4 * Math.sin(G.time * 10) : 0.85;
    ctx.save();
    ctx.rotate(ang);
    ctx.translate(base * 1.2 + Math.sin(G.time * 5) * cell * 0.03, 0);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = danger ? '#ff3b3b' : dr.fate === 'collide' ? '#ffb04f' : '#8fb4ff';
    ctx.beginPath();
    ctx.moveTo(cell * 0.13, 0);
    ctx.lineTo(-cell * 0.05, cell * 0.1);
    ctx.lineTo(-cell * 0.05, -cell * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
