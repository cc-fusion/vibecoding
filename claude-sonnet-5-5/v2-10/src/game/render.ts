import type { Game, Kaiju, Building, Defense } from './engine';
import { W, H, LAND_H, BT, DEFS, KAIJU, DISTRICTS } from './data';

const TAU = Math.PI * 2;

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, ts: number, align: CanvasTextAlign = 'center', weight = 'bold') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / ts, 1 / ts);
  ctx.font = `${weight} ${Math.max(7, size * ts)}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function tip(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, ts: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / ts, 1 / ts);
  ctx.font = '600 12px system-ui, sans-serif';
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += 16;
  const h = lines.length * 16 + 10;
  ctx.fillStyle = 'rgba(8,12,24,0.92)';
  ctx.strokeStyle = 'rgba(251,191,36,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1f5f9';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 8, 13 + i * 16));
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function drawGame(g: Game, ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, '#0a0f1e');
  bg.addColorStop(1, '#0f1b30');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  const topPad = 0.7;
  const ts = Math.max(8, Math.min(cw / W, ch / (H + topPad)));
  const ox = (cw - ts * W) / 2;
  const oy = (ch - ts * (H + topPad)) / 2 + ts * topPad;
  g.lay = { ts, ox, oy };
  const t = g.time;

  ctx.save();
  if (g.settings.shake && g.shakeAmp > 0) {
    const s = g.shakeAmp * ts * 0.12;
    ctx.translate((Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
  }
  ctx.translate(ox, oy);
  ctx.scale(ts, ts);

  drawGround(g, ctx, t, ts);
  drawDistricts(g, ctx, ts);
  if (g.status === 'playing' && g.phase === 'briefing') drawForecast(g, ctx, t, ts);

  // buildings & defenses, painter order
  for (let y = 0; y < LAND_H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = g.bAt[i];
      if (b) drawBuilding(g, ctx, b, t, i);
      const d = g.dAt[i];
      if (d) drawDef(ctx, d, t, ts, g);
    }
  }
  for (const d of g.defs) if (d.temp) drawDef(ctx, d, t, ts, g);

  drawHazards(g, ctx, t);
  drawTelegraphs(g, ctx, t);

  const ks = g.status === 'title' ? [g.demoK] : g.kaiju.filter((k) => (k.active || k.dead) && !k.gone);
  ks.sort((a, b) => a.y - b.y);
  for (const k of ks) drawKaiju(ctx, g, k, ts);
  for (const k of ks) if (!k.dead && g.status !== 'title') drawKBar(ctx, k, ts);

  // strikes (pending)
  for (const s of g.strikes) {
    const p = 1 - s.t / 1.2;
    ctx.strokeStyle = `rgba(248,113,113,${0.4 + 0.4 * Math.sin(t * 20)})`;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.9, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.9 * p, 0, TAU);
    ctx.stroke();
    txt(ctx, '✈', s.x, s.y, 0.5, '#fecaca', ts);
  }

  drawFx(g, ctx, t, ts);
  drawOverlays(g, ctx, t, ts);
  ctx.restore();

  // vignette + flash
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);
  if (g.flash > 0) {
    ctx.globalAlpha = Math.min(0.4, g.flash * 0.5);
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ ground
function drawGround(g: Game, ctx: CanvasRenderingContext2D, t: number, ts: number) {
  const wg = ctx.createLinearGradient(0, LAND_H, 0, H);
  wg.addColorStop(0, '#1d6196');
  wg.addColorStop(1, '#0d2f52');
  ctx.fillStyle = wg;
  ctx.fillRect(-0.02, LAND_H, W + 0.04, 1.02);
  ctx.strokeStyle = 'rgba(190,235,255,0.28)';
  ctx.lineWidth = 0.025;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 0.25) {
      const y = LAND_H + 0.22 + r * 0.26 + Math.sin(x * 2 + t * 1.5 + r * 1.7) * 0.04;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let y = 0; y < LAND_H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = g.kind[i];
      if (k === 'road') ctx.fillStyle = '#2a3242';
      else if (k === 'park') ctx.fillStyle = '#24523a';
      else ctx.fillStyle = '#343c4e';
      ctx.fillRect(x, y, 1.01, 1.01);
      if (k === 'road') {
        ctx.fillStyle = 'rgba(250,250,210,0.22)';
        const horiz = y === 4 || y === 9;
        const vert = x % 4 === 3;
        if (horiz && !vert) ctx.fillRect(x + 0.1, y + 0.48, 0.3, 0.04);
        if (vert && !horiz) ctx.fillRect(x + 0.48, y + 0.1, 0.04, 0.3);
      } else if (k === 'park') {
        ctx.fillStyle = '#2f7a4b';
        const s = (x * 31 + y * 17) % 7;
        ctx.beginPath(); ctx.arc(x + 0.3, y + 0.35 + s * 0.02, 0.17, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 0.68, y + 0.62, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3d9a5f';
        ctx.beginPath(); ctx.arc(x + 0.66, y + 0.58, 0.1, 0, TAU); ctx.fill();
      }
    }
  }
  void ts;
}

function drawDistricts(g: Game, ctx: CanvasRenderingContext2D, ts: number) {
  ctx.save();
  ctx.setLineDash([0.18, 0.14]);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(6, LAND_H);
  ctx.moveTo(12, 0); ctx.lineTo(12, LAND_H);
  ctx.moveTo(0, 5); ctx.lineTo(W, 5);
  ctx.stroke();
  ctx.restore();
  const playing = g.status === 'playing';
  for (let d = 0; d < 6; d++) {
    const x0 = (d % 3) * 6, y0 = d < 3 ? 0 : 5;
    const ordered = playing && (g.phase === 'briefing' ? g.evacOrders[d] : g.phase === 'attack' ? g.evacUsed[d] : false);
    if (ordered) {
      ctx.fillStyle = 'rgba(56,189,248,0.13)';
      ctx.fillRect(x0, y0, 6, 5);
      ctx.strokeStyle = 'rgba(125,211,252,0.7)';
      ctx.lineWidth = 0.05;
      ctx.strokeRect(x0 + 0.04, y0 + 0.04, 5.92, 4.92);
      txt(ctx, '🚶 EVACUATED', x0 + 3, y0 + 2.5, 0.28, 'rgba(186,230,253,0.85)', ts);
    }
    if (g.hover && playing && g.phase === 'attack' && g.armed === 'siren') {
      const hd = (g.hover.y < 5 ? 0 : 1) * 3 + Math.min(2, Math.floor(g.hover.x / 6));
      if (hd === d && g.hover.y < LAND_H) {
        ctx.fillStyle = 'rgba(56,189,248,0.2)';
        ctx.fillRect(x0, y0, 6, 5);
      }
    }
    txt(ctx, DISTRICTS[d].name.toUpperCase(), x0 + 0.12, y0 + 0.16, 0.2, 'rgba(255,255,255,0.4)', ts, 'left', '600');
  }
}

function drawForecast(g: Game, ctx: CanvasRenderingContext2D, t: number, ts: number) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 3);
  for (let i = 0; i < g.heat.length; i++) {
    const h = g.heat[i];
    if (h < 0.03) continue;
    ctx.fillStyle = `rgba(244,63,94,${h * 0.5 * pulse})`;
    ctx.fillRect(i % W, Math.floor(i / W), 1, 1);
  }
  ctx.save();
  ctx.setLineDash([0.2, 0.16]);
  ctx.lineDashOffset = -t * 0.6;
  ctx.lineWidth = 0.04;
  for (const p of g.plan) {
    ctx.strokeStyle = 'rgba(253,186,116,0.5)';
    for (const gl of p.ghosts) {
      ctx.beginPath();
      gl.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
    }
  }
  ctx.restore();
  for (const p of g.plan) {
    let e = p.route.find((pt) => pt.x >= -0.5 && pt.x <= W + 0.5 && pt.y >= -0.5 && pt.y <= H + 0.5) ?? p.route[0];
    e = { x: Math.max(0.5, Math.min(W - 0.5, e.x)), y: Math.max(0.5, Math.min(H - 0.5, e.y)) };
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(e.x, e.y, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    txt(ctx, KAIJU[p.kind].icon, e.x, e.y + 0.02, 0.45, '#fff', ts);
  }
}

// ------------------------------------------------------------------ buildings
function drawBuilding(g: Game, ctx: CanvasRenderingContext2D, b: Building, t: number, idx: number) {
  const info = BT[b.type];
  const x = b.x + 0.1, w = 0.8, base = b.y + 0.93;
  if (b.hp <= 0) {
    ctx.fillStyle = '#2d2d35';
    ctx.fillRect(x, base - 0.14, w, 0.14);
    for (let j = 0; j < 7; j++) {
      const rx = x + (((b.seed >> 2) * (j + 3)) % 70) / 100;
      const ry = base - 0.04 - (((b.seed >> 5) * (j + 2)) % 22) / 100;
      ctx.fillStyle = j % 2 ? '#6b6b73' : '#8a8a92';
      const s = 0.07 + ((b.seed + j * 13) % 8) / 100;
      ctx.fillRect(rx, ry, s, s * 0.8);
    }
    if (g.fireT[idx] > 0) {
      ctx.fillStyle = 'rgba(251,146,60,0.3)';
      ctx.beginPath(); ctx.arc(b.x + 0.5, b.y + 0.7, 0.4, 0, TAU); ctx.fill();
    }
    return;
  }
  const f = b.hp / b.maxHp;
  const burning = g.fireT[idx] > 0;
  const hgt = info.h * (0.6 + 0.4 * f) * 0.88;
  const top = base - hgt;
  const d = 0.15;
  ctx.fillStyle = burning ? '#4a2c22' : info.side;
  ctx.fillRect(x, top, w, hgt);
  // right face
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  poly(ctx, [x + w, top, x + w + 0.09, top - d, x + w + 0.09, base - d, x + w, base]);
  ctx.fill();
  // top face / roof
  if (b.type === 'house') {
    ctx.fillStyle = burning ? '#5a2b22' : '#a0412f';
    poly(ctx, [x - 0.03, top, x + w / 2 + 0.05, top - 0.3, x + w + 0.09, top - d + 0.02, x + w + 0.03, top]);
    ctx.fill();
  } else {
    ctx.fillStyle = burning ? '#6b3a2a' : info.top;
    poly(ctx, [x, top, x + 0.09, top - d, x + w + 0.09, top - d, x + w, top]);
    ctx.fill();
  }
  // windows
  const cols = b.type === 'house' ? 2 : 3;
  const rows = Math.max(1, Math.floor(hgt / 0.2));
  const evacd = b.evac > 0.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = ((b.seed >> ((r * cols + c) % 20)) & 1) === 1 && !evacd && f > 0.3;
      ctx.fillStyle = on ? (burning ? '#fb923c' : '#fde68a') : 'rgba(0,0,0,0.32)';
      const ww = 0.11, hh = 0.09;
      ctx.fillRect(x + 0.1 + c * ((w - 0.2) / cols) + 0.02, top + 0.07 + r * 0.19, ww, hh);
    }
  }
  // decorations
  if (b.type === 'factory') {
    ctx.fillStyle = '#5b5b52';
    ctx.fillRect(x + 0.1, top - d - 0.22, 0.1, 0.24);
    ctx.fillRect(x + 0.36, top - d - 0.3, 0.1, 0.32);
  } else if (b.type === 'hospital') {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + w / 2 - 0.03, top + hgt * 0.4, 0.06, 0.2);
    ctx.fillRect(x + w / 2 - 0.1, top + hgt * 0.4 + 0.07, 0.2, 0.06);
  } else if (b.type === 'landmark') {
    ctx.fillStyle = '#fde68a';
    poly(ctx, [x + w / 2 - 0.12, top - d, x + w / 2 + 0.12, top - d, x + w / 2 + 0.05, top - d - 0.5]);
    ctx.fill();
    ctx.fillStyle = `rgba(253,224,71,${0.1 + 0.07 * Math.sin(t * 2)})`;
    ctx.beginPath(); ctx.arc(x + w / 2, top - 0.2, 0.55, 0, TAU); ctx.fill();
  } else if (b.type === 'office') {
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(x + w / 2, top - d); ctx.lineTo(x + w / 2, top - d - 0.22); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 3 + b.seed) > 0 ? '#ef4444' : '#7f1d1d';
    ctx.fillRect(x + w / 2 - 0.02, top - d - 0.25, 0.04, 0.04);
  } else if (b.type === 'mall') {
    ctx.fillStyle = '#f472b6';
    for (let s = 0; s < 4; s++) if (s % 2 === 0) ctx.fillRect(x + s * 0.2, base - 0.13, 0.2, 0.09);
    ctx.fillStyle = '#fde68a';
    for (let s = 0; s < 4; s++) if (s % 2 === 1) ctx.fillRect(x + s * 0.2, base - 0.13, 0.2, 0.09);
  }
  // cracks
  if (f < 0.75) {
    ctx.strokeStyle = 'rgba(15,23,42,0.75)';
    ctx.lineWidth = 0.025;
    const n = Math.ceil((1 - f) * 4);
    for (let c = 0; c < n; c++) {
      const cx = x + 0.1 + ((b.seed >> (c * 2)) % 60) / 100;
      ctx.beginPath();
      ctx.moveTo(cx, top + 0.02);
      ctx.lineTo(cx + 0.06, top + hgt * 0.35);
      ctx.lineTo(cx - 0.04, top + hgt * 0.6);
      ctx.lineTo(cx + 0.05, top + hgt * 0.9);
      ctx.stroke();
    }
  }
  if (b.hp < b.maxHp && f > 0 && g.status === 'playing' && g.phase === 'attack') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, base + 0.01, w, 0.05);
    ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(x, base + 0.01, w * f, 0.05);
  }
}

// ------------------------------------------------------------------ defenses
function drawDef(ctx: CanvasRenderingContext2D, d: Defense, t: number, ts: number, g: Game) {
  const cx = d.x + 0.5, cy = d.y + 0.55;
  const info = DEFS[d.type];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0.22, 0.34, 0.12, 0, 0, TAU); ctx.fill();
  const colors: Record<string, string> = { artillery: '#475569', flak: '#4d6b4f', tesla: '#4c3d73', beacon: '#7c5a14', firestation: '#9b2c2c', seawall: '#2c6a8c', damper: '#6b5a2c' };
  ctx.fillStyle = colors[d.type];
  ctx.strokeStyle = d.flash > 0 ? '#fff' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.arc(0, 0, 0.32, 0, TAU); ctx.fill(); ctx.stroke();
  if (d.type === 'artillery' || d.type === 'flak') {
    ctx.save();
    ctx.rotate(d.angle);
    ctx.fillStyle = '#cbd5e1';
    if (d.type === 'artillery') ctx.fillRect(0, -0.06, 0.5, 0.12);
    else { ctx.fillRect(0, -0.1, 0.42, 0.06); ctx.fillRect(0, 0.04, 0.42, 0.06); }
    ctx.restore();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, TAU); ctx.fill();
  } else if (d.type === 'tesla') {
    ctx.fillStyle = '#a5b4fc';
    ctx.fillRect(-0.06, -0.38, 0.12, 0.4);
    ctx.fillStyle = `rgba(165,243,252,${0.6 + 0.4 * Math.sin(t * 10)})`;
    ctx.beginPath(); ctx.arc(0, -0.42, 0.13, 0, TAU); ctx.fill();
  } else if (d.type === 'beacon') {
    const p = (t * 1.2) % 1;
    ctx.strokeStyle = `rgba(251,191,36,${1 - p})`;
    ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.arc(0, 0, 0.3 + p * 0.5, 0, TAU); ctx.stroke();
    txt(ctx, '📡', 0, 0, 0.36, '#fff', ts);
  } else if (d.type === 'firestation') txt(ctx, '🚒', 0, 0, 0.38, '#fff', ts);
  else if (d.type === 'seawall') txt(ctx, '🌊', 0, 0, 0.38, '#fff', ts);
  else if (d.type === 'damper') {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(-0.2, 0);
    for (let i = 0; i < 6; i++) ctx.lineTo(-0.2 + (i + 0.5) * 0.067, i % 2 ? 0.1 : -0.1);
    ctx.lineTo(0.2, 0);
    ctx.stroke();
  }
  if (d.temp) {
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(0, 0, 0.45, 0, TAU * (d.ttl / 14)); ctx.stroke();
  }
  if (d.hp < d.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-0.3, 0.32, 0.6, 0.06);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-0.3, 0.32, 0.6 * Math.max(0, d.hp / d.maxHp), 0.06);
  }
  ctx.restore();
  void info; void g;
}

// ------------------------------------------------------------------ hazards
function drawHazards(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < g.floodT.length; i++) {
    const f = g.floodT[i];
    if (f > 0) {
      const x = i % W, y = Math.floor(i / W);
      ctx.fillStyle = `rgba(56,189,248,${Math.min(0.4, 0.2 + f * 0.05) + 0.05 * Math.sin(t * 4 + x)})`;
      ctx.fillRect(x, y, 1, 1);
      ctx.strokeStyle = 'rgba(224,242,254,0.4)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5 + Math.sin(t * 3 + x) * 0.05);
      ctx.lineTo(x + 1, y + 0.5 + Math.sin(t * 3 + x + 1) * 0.05);
      ctx.stroke();
    }
    if (g.fireT[i] > 0) {
      const x = i % W, y = Math.floor(i / W);
      ctx.fillStyle = `rgba(251,146,60,${0.2 + 0.08 * Math.sin(t * 12 + i)})`;
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.55, 0.62, 0, TAU); ctx.fill();
    }
  }
}

function drawTelegraphs(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const cols: Record<string, string> = { breath: '251,146,60', surge: '56,189,248', shock: '214,163,92', slam: '248,113,113', dive: '192,132,252' };
  for (const k of g.kaiju) {
    const c = k.cast;
    if (!c || k.dead) continue;
    const col = cols[c.type] ?? '255,255,255';
    const pr = c.t / c.dur;
    const a = 0.16 + 0.14 * Math.abs(Math.sin(t * 14));
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.strokeStyle = `rgba(${col},0.9)`;
    ctx.lineWidth = 0.05;
    if (c.len > 0) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.atan2(c.dy, c.dx));
      ctx.fillRect(0, -c.rad, c.len, c.rad * 2);
      ctx.strokeRect(0, -c.rad, c.len, c.rad * 2);
      ctx.fillStyle = `rgba(${col},0.35)`;
      ctx.fillRect(0, -c.rad, c.len * pr, c.rad * 2);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(c.x, c.y, c.rad, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x, c.y, c.rad * pr, 0, TAU); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ kaiju
function drawKaiju(ctx: CanvasRenderingContext2D, g: Game, k: Kaiju, ts: number) {
  const kd = KAIJU[k.kind];
  const s = kd.size;
  const t = g.time;
  const dir = k.dx >= 0 ? 1 : -1;
  const alpha = k.dead ? Math.max(0, 1 - k.deathT / 1.4) : 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(k.x, k.y + 0.4 * s);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(0, 0, 0.8 * s, 0.2 * s, 0, 0, TAU); ctx.fill();
  if (k.under) {
    ctx.fillStyle = '#6b4a22';
    ctx.beginPath(); ctx.ellipse(0, -0.05, 0.62 * s, 0.26 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a42';
    ctx.beginPath(); ctx.ellipse(0, -0.12, 0.4 * s, 0.15 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(253,230,138,0.5)';
    ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.ellipse(0, -0.05, (0.7 + 0.1 * Math.sin(t * 6)) * s, 0.3 * s, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    return;
  }
  const fly = kd.flying;
  if (fly) ctx.translate(0, (-0.9 + Math.sin(t * 4) * 0.12) * s * 0.6);
  const sc = s * 0.9;
  ctx.scale(dir * sc, sc);
  const sw = Math.sin(k.walk * 5) * 0.14;
  const boss = k.kind === 'boss';

  if (boss) {
    const ag = ctx.createRadialGradient(0, -1.1, 0.2, 0, -1.1, 2.2);
    ag.addColorStop(0, `rgba(255,77,109,${0.18 + 0.08 * k.phase + 0.05 * Math.sin(t * 5)})`);
    ag.addColorStop(1, 'rgba(255,77,109,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0, -1.1, 2.2, 0, TAU); ctx.fill();
  }
  // wings
  if (fly) {
    const fl = Math.sin(t * 9) * 0.45;
    ctx.fillStyle = kd.accent;
    ctx.globalAlpha = alpha * 0.85;
    poly(ctx, [-0.1, -1.4, -0.9, -2.0 - fl, -1.5, -1.2 - fl * 0.5, -0.5, -1.0]);
    ctx.fill();
    poly(ctx, [0.1, -1.4, 0.8, -2.1 - fl, 1.3, -1.3 - fl * 0.5, 0.4, -1.0]);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  // tail
  ctx.strokeStyle = kd.color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.26;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.9);
  ctx.quadraticCurveTo(-1.0, -0.55 + Math.sin(t * 3) * 0.12, -1.35, -0.95 + Math.sin(t * 3 + 1) * 0.15);
  ctx.stroke();
  // legs / tentacles
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.02;
  if (k.kind === 'tide') {
    ctx.strokeStyle = kd.color;
    ctx.lineWidth = 0.15;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.4 + i * 0.27, -0.7);
      ctx.quadraticCurveTo(-0.4 + i * 0.27 + Math.sin(t * 4 + i) * 0.2, -0.35, -0.45 + i * 0.27 + Math.sin(t * 4 + i * 2) * 0.15, 0);
      ctx.stroke();
    }
  } else if (!fly) {
    ctx.fillStyle = kd.color;
    for (const [lx, ph] of [[-0.3, 1], [0.15, -1]] as [number, number][]) {
      ctx.beginPath();
      ctx.rect(lx + sw * ph - 0.14, -0.8, 0.3, 0.8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = kd.accent;
      ctx.fillRect(lx + sw * ph - 0.16, -0.06, 0.34, 0.07);
      ctx.fillStyle = kd.color;
    }
  } else {
    ctx.fillStyle = kd.color;
    ctx.fillRect(-0.15, -0.8, 0.1, 0.35);
    ctx.fillRect(0.1, -0.8, 0.1, 0.35);
  }
  // body
  ctx.fillStyle = kd.color;
  ctx.beginPath(); ctx.ellipse(0, -1.05, 0.58, 0.72, 0, 0, TAU); ctx.fill();
  const bgl = ctx.createLinearGradient(0, -1.8, 0, -0.3);
  bgl.addColorStop(0, 'rgba(255,255,255,0.22)');
  bgl.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = bgl;
  ctx.beginPath(); ctx.ellipse(0, -1.05, 0.58, 0.72, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.ellipse(0.14, -0.95, 0.3, 0.5, 0, 0, TAU); ctx.fill();
  // spines
  ctx.fillStyle = kd.accent;
  const nsp = boss ? 6 : 4;
  for (let i = 0; i < nsp; i++) {
    const a = -2.5 + (i / nsp) * 1.6;
    const bx = Math.cos(a) * 0.55, by = -1.05 + Math.sin(a) * 0.7;
    poly(ctx, [bx - 0.1, by + 0.05, bx - 0.25 + Math.cos(a) * 0.1, by - 0.3, bx + 0.08, by - 0.03]);
    ctx.fill();
  }
  // arm
  ctx.fillStyle = kd.color;
  ctx.beginPath(); ctx.ellipse(0.42, -1.0 + Math.sin(k.walk * 5) * 0.04, 0.16, 0.1, 0.4, 0, TAU); ctx.fill();
  // head
  const casting = k.cast && (k.cast.type === 'breath' || k.cast.type === 'surge');
  ctx.fillStyle = kd.color;
  ctx.beginPath(); ctx.arc(0.5, -1.75, 0.34, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.82, -1.68, 0.3, 0.19, 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = casting ? (k.cast!.type === 'breath' ? '#fb923c' : '#38bdf8') : '#1c1917';
  ctx.beginPath(); ctx.ellipse(0.95, -1.62, 0.2, casting ? 0.11 : 0.05, 0, 0, TAU); ctx.fill();
  // teeth
  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < 3; i++) ctx.fillRect(0.78 + i * 0.1, -1.6, 0.04, 0.07);
  // horns
  ctx.fillStyle = kd.accent;
  poly(ctx, [0.35, -2.0, 0.28, -2.4, 0.5, -2.05]); ctx.fill();
  if (boss) { poly(ctx, [0.55, -2.05, 0.7, -2.5, 0.72, -2.0]); ctx.fill(); }
  // eye
  ctx.fillStyle = boss ? '#ff4d6d' : '#fde047';
  ctx.beginPath(); ctx.arc(0.68, -1.84, 0.075, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(0.7, -1.84, 0.035, 0, TAU); ctx.fill();
  if (boss) {
    ctx.strokeStyle = `rgba(255,77,109,${0.6 + 0.3 * Math.sin(t * 4)})`;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(-0.3, -1.5); ctx.lineTo(-0.1, -1.1); ctx.lineTo(-0.35, -0.8);
    ctx.moveTo(0.1, -1.4); ctx.lineTo(0.2, -1.0); ctx.lineTo(0.0, -0.7);
    ctx.stroke();
  }
  if (k.kind === 'tide') {
    ctx.fillStyle = kd.accent;
    poly(ctx, [0.2, -2.1, 0.15, -2.6, 0.45, -2.1]); ctx.fill();
    ctx.fillStyle = 'rgba(155,231,255,0.7)';
    ctx.beginPath(); ctx.arc(-0.2 + Math.sin(t * 5) * 0.1, -0.4 + ((t * 2) % 1) * 0.4, 0.05, 0, TAU); ctx.fill();
  }
  if (k.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, k.flash * 6)})`;
    ctx.beginPath(); ctx.ellipse(0, -1.05, 0.6, 0.74, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0.5, -1.75, 0.35, 0, TAU); ctx.fill();
  }
  if (k.stun > 0) {
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      ctx.beginPath(); ctx.arc(0.45 + Math.cos(a) * 0.4, -2.35 + Math.sin(a) * 0.1, 0.06, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  void ts;
}

function drawKBar(ctx: CanvasRenderingContext2D, k: Kaiju, ts: number) {
  if (k.under && k.kind === 'burrow') {
    txt(ctx, '🪱 burrowed', k.x, k.y - 0.5, 0.2, '#fde68a', ts);
    return;
  }
  const kd = KAIJU[k.kind];
  const w = 0.9 * kd.size + 0.3;
  const y = k.y - 2.15 * kd.size * 0.9 + (kd.flying ? -0.4 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(k.x - w / 2 - 0.02, y - 0.02, w + 0.04, 0.14);
  ctx.fillStyle = kd.accent;
  ctx.fillRect(k.x - w / 2, y, w * Math.max(0, k.hp / k.maxHp), 0.1);
  txt(ctx, kd.name, k.x, y - 0.14, 0.2, '#fff', ts);
}

// ------------------------------------------------------------------ fx
function drawFx(g: Game, ctx: CanvasRenderingContext2D, _t: number, ts: number) {
  for (const r of g.rings) {
    const p = 1 - r.life / r.max;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.lineWidth = 0.07 * (1 - p) + 0.02;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - p, 3)), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const tr of g.tracers) {
    ctx.globalAlpha = Math.max(0, tr.life / tr.max);
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = tr.w * 0.02;
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    if (tr.zig) {
      const n = 5;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        ctx.lineTo(tr.x1 + (tr.x2 - tr.x1) * f + (Math.random() - 0.5) * 0.3, tr.y1 + (tr.y2 - tr.y1) * f + (Math.random() - 0.5) * 0.3);
      }
    }
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of g.parts) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    if (p.kind === 'fire' || p.kind === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.6), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'water') {
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    } else if (p.kind === 'dust') {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  for (const f of g.floaters) {
    const a = Math.min(1, f.life / (f.max * 0.5));
    ctx.save();
    ctx.globalAlpha = a;
    const sz = 0.3 * f.size * (1 + Math.max(0, f.life / f.max - 0.85) * 3);
    txt(ctx, f.text, f.x + 0.02, f.y + 0.03, sz, 'rgba(0,0,0,0.8)', ts);
    txt(ctx, f.text, f.x, f.y, sz, f.color, ts);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ overlays (hover, ranges, claims)
function drawOverlays(g: Game, ctx: CanvasRenderingContext2D, t: number, ts: number) {
  if (g.status !== 'playing') return;
  const h = g.hover;
  if (g.phase === 'briefing') {
    if (g.inspect) {
      const d = g.inspect;
      ctx.strokeStyle = 'rgba(251,191,36,0.8)';
      ctx.fillStyle = 'rgba(251,191,36,0.07)';
      ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(d.x + 0.5, d.y + 0.5, DEFS[d.type].range, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (h) {
      const tx = Math.floor(h.x), ty = Math.floor(h.y);
      const i = ty * W + tx;
      const k = g.kind[i];
      if (g.selDef) {
        const ok = (k === 'road' || k === 'park') && !g.dAt[i];
        ctx.strokeStyle = ok ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)';
        ctx.fillStyle = ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.08)';
        ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(tx + 0.5, ty + 0.5, DEFS[g.selDef].range, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeRect(tx + 0.04, ty + 0.04, 0.92, 0.92);
        txt(ctx, DEFS[g.selDef].icon, tx + 0.5, ty + 0.5, 0.5, '#fff', ts);
      } else if (g.sellMode) {
        ctx.strokeStyle = g.dAt[i] ? '#f87171' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.05;
        ctx.strokeRect(tx + 0.04, ty + 0.04, 0.92, 0.92);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 0.03;
        ctx.strokeRect(tx + 0.04, ty + 0.04, 0.92, 0.92);
      }
      const b = g.bAt[i];
      const d = g.dAt[i];
      if (d) tip(ctx, [DEFS[d.type].name, 'HP ' + Math.round(d.hp) + '/' + d.maxHp, 'Click to inspect · X to sell'], Math.min(W - 3.2, h.x + 0.4), Math.min(H - 1.4, h.y + 0.4), ts);
      else if (b && !g.selDef) tipBuilding(ctx, g, b, h.x, h.y, ts);
      else if (k === 'water') tip(ctx, ['Open water'], Math.min(W - 2, h.x + 0.4), Math.min(H - 0.8, h.y + 0.4), ts);
    }
  } else if (g.phase === 'attack') {
    if (h) {
      const tx = Math.floor(h.x), ty = Math.floor(h.y);
      if (g.armed === 'flare') {
        ctx.strokeStyle = 'rgba(251,191,36,0.9)'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(tx + 0.5, ty + 0.5, DEFS.beacon.range, 0, TAU); ctx.stroke();
        txt(ctx, '🎇', tx + 0.5, ty + 0.5, 0.5, '#fff', ts);
      } else if (g.armed === 'strike') {
        ctx.strokeStyle = 'rgba(248,113,113,0.95)'; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.arc(h.x, h.y, 1.9, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(h.x - 0.4, h.y); ctx.lineTo(h.x + 0.4, h.y); ctx.moveTo(h.x, h.y - 0.4); ctx.lineTo(h.x, h.y + 0.4); ctx.stroke();
      } else if (g.armed === 'siren') {
        txt(ctx, '🚨', h.x, h.y, 0.5, '#fff', ts);
      } else {
        const b = g.bAt[ty * W + tx];
        if (b) tipBuilding(ctx, g, b, h.x, h.y, ts);
      }
    }
  } else if (g.phase === 'claims') {
    const cur = g.claims[g.ci];
    for (const c of g.claims) {
      if (c.decision) {
        ctx.fillStyle = c.decision === 'deny' ? '#f87171' : '#4ade80';
        ctx.beginPath(); ctx.arc(c.bx + 0.9, c.by + 0.15, 0.08, 0, TAU); ctx.fill();
      } else if (c !== cur) {
        ctx.fillStyle = 'rgba(251,191,36,0.8)';
        ctx.beginPath(); ctx.arc(c.bx + 0.9, c.by + 0.15, 0.08, 0, TAU); ctx.fill();
      }
    }
    if (cur) {
      const p = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(251,191,36,${0.5 + 0.5 * p})`;
      ctx.lineWidth = 0.06;
      ctx.strokeRect(cur.bx - 0.02, cur.by - 0.55, 1.04, 1.6);
      ctx.beginPath(); ctx.arc(cur.bx + 0.5, cur.by + 0.5, 0.9 + p * 0.2, 0, TAU); ctx.stroke();
    }
    if (h) {
      const b = g.bAt[Math.floor(h.y) * W + Math.floor(h.x)];
      if (b) tipBuilding(ctx, g, b, h.x, h.y, ts);
    }
  }
}

function tipBuilding(ctx: CanvasRenderingContext2D, g: Game, b: Building, hx: number, hy: number, ts: number) {
  const info = BT[b.type];
  const rid = [b.riders.fire ? '🔥' : '', b.riders.flood ? '🌊' : '', b.riders.quake ? '🌋' : ''].join('') || 'none';
  tip(
    ctx,
    [info.name + (b.hp <= 0 ? ' (ruins)' : ''), 'Value $' + b.value + 'K · Pop ' + (b.hp > 0 ? b.pop : 0), 'HP ' + Math.round((b.hp / b.maxHp) * 100) + '% · Riders ' + rid],
    Math.min(W - 3.6, hx + 0.4),
    Math.min(H - 1.4, hy + 0.4),
    ts,
  );
  void g;
}
