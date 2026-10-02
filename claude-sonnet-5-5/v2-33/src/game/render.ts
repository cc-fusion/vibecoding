import type { Game } from './engine';
import { WORLD_W, WORLD_H, SHIPS, FACTIONS, WRECK_INFO, RES_LIST, RES_INFO, bagValue } from './data';
import type { Ship, ShipKind } from './data';
import { sectorDef } from './data';

const mod = (a: number, b: number) => ((a % b) + b) % b;

const SHAPES: Partial<Record<ShipKind, number[][]>> = {
  tug: [[1.3, 0], [-0.9, 0.9], [-0.5, 0], [-0.9, -0.9]],
  hauler: [[1.2, 0], [0.4, 1], [-1, 1], [-1, -1], [0.4, -1]],
  cutter: [[1.2, 0], [-0.2, 0.8], [-1, 0.5], [-1, -0.5], [-0.2, -0.8]],
  gunship: [[1.4, 0], [-0.2, 0.5], [-1, 1.1], [-0.6, 0], [-1, -1.1], [-0.2, -0.5]],
  frigate: [[1.5, 0], [0.3, 0.7], [-1, 1], [-1.2, 0.3], [-1.2, -0.3], [-1, -1], [0.3, -0.7]],
  scout: [[1.4, 0], [-1, 0.6], [-0.5, 0], [-1, -0.6]],
  raider: [[1.3, 0], [-1, 0.9], [-0.4, 0], [-1, -0.9]],
  bomber: [[1, 0], [0.5, 0.9], [-0.7, 0.9], [-1, 0], [-0.7, -0.9], [0.5, -0.9]],
  boss: [[1.2, 0], [0.4, 0.7], [0.3, 1], [-0.6, 1], [-1, 0.5], [-1, -0.5], [-0.6, -1], [0.3, -1], [0.4, -0.7]],
};

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, z: number, size = 12, align: CanvasTextAlign = 'center') {
  ctx.font = `600 ${size / z}px Rajdhani, sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = 3 / z;
  ctx.strokeStyle = 'rgba(2,6,14,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawShip(ctx: CanvasRenderingContext2D, g: Game, s: Ship, z: number, selected: boolean) {
  const def = SHIPS[s.kind];
  const r = def.radius;
  const col = s.faction === 0 ? def.color : s.faction === 4 ? def.color : FACTIONS[s.faction].color;
  const t = g.time;
  ctx.save();
  ctx.translate(s.x, s.y);
  if (selected) {
    ctx.strokeStyle = '#7dffb0';
    ctx.lineWidth = 1.6 / z;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + Math.sin(t * 6) * 1, 0, 6.3);
    ctx.stroke();
  }
  if (s.kind === 'mine') {
    const blink = Math.sin(t * 5 + s.id) > 0.3;
    ctx.fillStyle = '#2a1214';
    ctx.strokeStyle = blink ? '#ff5a5a' : '#8a2a2a';
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (s.kind === 'sentry') {
    ctx.fillStyle = s.flash > 0 ? '#fff' : '#2b1418';
    ctx.strokeStyle = '#ff5a5a';
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(s.ang);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(0, -2, r + 6, 4);
    ctx.restore();
    return;
  }
  ctx.rotate(s.ang);
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > 20 && s.disabled <= 0) {
    ctx.fillStyle = s.faction === 4 ? 'rgba(255,170,60,0.7)' : 'rgba(120,220,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.35);
    ctx.lineTo(-r * (1.3 + Math.min(1.2, sp / 120) * (0.7 + Math.random() * 0.5)), 0);
    ctx.lineTo(-r * 0.9, r * 0.35);
    ctx.fill();
  }
  const sh = SHAPES[s.kind];
  if (sh) {
    ctx.beginPath();
    sh.forEach((p, i) => (i ? ctx.lineTo(p[0] * r, p[1] * r) : ctx.moveTo(p[0] * r, p[1] * r)));
    ctx.closePath();
    ctx.fillStyle = s.flash > 0 ? '#ffffff' : s.disabled > 0 ? '#333a44' : 'rgba(8,16,28,0.92)';
    ctx.fill();
    ctx.strokeStyle = s.disabled > 0 ? '#667' : col;
    ctx.lineWidth = (s.kind === 'boss' ? 3 : 1.8) / z;
    ctx.stroke();
  }
  if (s.kind === 'tug' || s.kind === 'hauler') {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 0.22, 0, 6.3);
    ctx.fill();
  }
  if (s.kind === 'boss') {
    ctx.fillStyle = '#ff7a2f';
    for (const p of [[0.6, 0.6], [0.6, -0.6], [-0.3, 0.8], [-0.3, -0.8]]) { ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, r * 0.12, 0, 6.3); ctx.fill(); }
    if (s.aux[3] > 0) {
      ctx.strokeStyle = `rgba(111,177,255,${0.5 + Math.sin(t * 12) * 0.3})`;
      ctx.lineWidth = 4 / z;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, 6.3);
      ctx.stroke();
    }
    if (s.aux[2] > 0) {
      ctx.strokeStyle = `rgba(255,74,74,${0.4 + Math.sin(t * 30) * 0.4})`;
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.5 + (0.9 - s.aux[2]) * 2), 0, 6.3);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (s.faction === 0 && !s.crew && !s.temp) {
    label(ctx, '!', s.x, s.y - r - 14, '#ff9a6b', z, 13);
  }
  if (s.hp < s.maxHp - 0.5 || selected || s.kind === 'boss') {
    const bw = Math.max(18, r * 2);
    const by = s.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(s.x - bw / 2, by, bw, 3.5);
    ctx.fillStyle = s.hp / s.maxHp > 0.5 ? '#7dffb0' : s.hp / s.maxHp > 0.25 ? '#ffd36e' : '#ff6b57';
    ctx.fillRect(s.x - bw / 2, by, bw * Math.max(0, s.hp / s.maxHp), 3.5);
  }
  if (s.faction !== 0 && s.faction !== 4 && z > 0.4 && s.name) label(ctx, s.name, s.x, s.y + r + 12, col, z, 10);
}

export function drawGame(g: Game, ctx: CanvasRenderingContext2D, stars: { x: number; y: number; z: number; s: number }[]) {
  const { vw, vh, dpr, cam } = g;
  const z = cam.zoom;
  const t = g.time;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, vw, vh);
  // nebula
  const neb: [number, number, number, string][] = [
    [0.2, 0.3, 0.55, 'rgba(60,40,130,0.16)'], [0.8, 0.2, 0.5, 'rgba(20,90,130,0.14)'], [0.6, 0.85, 0.6, 'rgba(120,40,90,0.11)'],
  ];
  neb.forEach(([nx, ny, nr, c], i) => {
    const px = nx * vw - cam.x * 0.03 * (i + 1) * z, py = ny * vh - cam.y * 0.03 * (i + 1) * z;
    const rad = nr * Math.max(vw, vh);
    const gr = ctx.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, vw, vh);
  });
  for (const s of stars) {
    const sx = mod((s.x / 2000) * vw - cam.x * 0.08 * s.z * z, vw);
    const sy = mod((s.y / 1400) * vh - cam.y * 0.08 * s.z * z, vh);
    ctx.fillStyle = `rgba(200,225,255,${0.25 + s.z * 0.5})`;
    ctx.fillRect(sx, sy, s.s, s.s);
  }
  const sh = g.shake;
  const ox = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  const oy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  ctx.save();
  ctx.translate(vw / 2 + ox, vh / 2 + oy);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);
  // grid
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = 'rgba(77,225,255,0.05)';
  ctx.beginPath();
  for (let x = 0; x <= WORLD_W; x += 300) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); }
  for (let y = 0; y <= WORLD_H; y += 300) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(77,225,255,0.35)';
  ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
  // fog
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g.fogCanvas, 0, 0, WORLD_W, WORLD_H);
  // storm
  if (g.storm) {
    const s = g.storm;
    const gr = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
    gr.addColorStop(0, 'rgba(150,100,255,0.28)');
    gr.addColorStop(0.8, 'rgba(110,70,220,0.18)');
    gr.addColorStop(1, 'rgba(90,60,200,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,150,255,0.5)';
    ctx.setLineDash([12 / z, 10 / z]);
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.3);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'ION STORM', s.x, s.y, 'rgba(210,180,255,0.85)', z, 15);
  }
  // meteors
  for (const m of g.meteors) {
    ctx.strokeStyle = `rgba(255,90,60,${0.4 + Math.sin(t * 14) * 0.3})`;
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, 6.3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,60,0.1)';
    ctx.fill();
  }
  // bases
  for (let f = 1; f <= 4; f++) {
    const b = FACTIONS[f];
    if (f === 4 && !g.sd.boss && g.sector < 1) continue;
    ctx.save();
    ctx.translate(b.bx, b.by);
    ctx.rotate(t * 0.05 * (f % 2 ? 1 : -1));
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2.5 / z;
    ctx.beginPath();
    ctx.arc(0, 0, f === 4 ? 90 : 60, 0, 6.3);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    label(ctx, f === 4 ? 'MAW LAIR' : b.name.toUpperCase(), b.bx, b.by + 82, b.color, z, 11);
    if (f < 4) {
      const rel = g.rel[f];
      label(ctx, g.hostile(0, f) ? 'HOSTILE' : rel >= 40 ? 'ALLIED' : 'NEUTRAL', b.bx, b.by + 96 + 2, g.hostile(0, f) ? '#ff6b57' : rel >= 40 ? '#7dffb0' : '#9ab', z, 9);
    }
  }
  // station
  {
    const st = g.station;
    ctx.save();
    ctx.translate(st.x, st.y);
    const dockR = st.r + 18;
    ctx.strokeStyle = 'rgba(77,225,255,0.18)';
    ctx.setLineDash([6 / z, 8 / z]);
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    ctx.arc(0, 0, dockR + 60, 0, 6.3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(st.rot);
    ctx.fillStyle = st.flash > 0 ? '#ffffff' : 'rgba(10,26,44,0.95)';
    ctx.strokeStyle = '#4de1ff';
    ctx.lineWidth = 3 / z;
    ctx.beginPath();
    ctx.arc(0, 0, st.r, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.arc(0, 0, st.r * 0.55, 0, 6.3);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * st.r * 0.55, Math.sin(a) * st.r * 0.55);
      ctx.lineTo(Math.cos(a) * (st.r + 12), Math.sin(a) * (st.r + 12));
      ctx.stroke();
      ctx.fillStyle = '#4de1ff';
      ctx.fillRect(Math.cos(a) * (st.r + 10) - 3, Math.sin(a) * (st.r + 10) - 3, 6, 6);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(77,225,255,0.9)';
    ctx.beginPath();
    ctx.arc(st.x, st.y, 9 + Math.sin(t * 3) * 1.5, 0, 6.3);
    ctx.fill();
    const bw = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(st.x - bw / 2, st.y + st.r + 14, bw, 5);
    const fr = Math.max(0, st.hp / st.maxHp);
    ctx.fillStyle = fr > 0.5 ? '#7dffb0' : fr > 0.25 ? '#ffd36e' : '#ff6b57';
    ctx.fillRect(st.x - bw / 2, st.y + st.r + 14, bw * fr, 5);
    label(ctx, 'SYNDICATE DOCK', st.x, st.y - st.r - 12, '#4de1ff', z, 11);
  }
  // wrecks
  const selSet = new Set(g.sel);
  for (const w of g.wrecks) {
    if (!w.revealed || w.fade < 0) continue;
    const info = WRECK_INFO[w.kind];
    const alpha = w.fade > 0 ? w.fade : 1;
    ctx.globalAlpha = alpha;
    const val = bagValue(w.loot);
    const pulse = w.kind === 'reactor' ? 0.5 + Math.sin(t * (3 + w.instab / 12)) * 0.5 : 0.4;
    const gr = ctx.createRadialGradient(w.x, w.y, w.r * 0.5, w.x, w.y, w.r * 2.2);
    gr.addColorStop(0, info.glow + (w.kind === 'reactor' ? Math.floor(30 + pulse * 40 + w.instab * 0.6).toString(16).padStart(2, '0') : '33'));
    gr.addColorStop(1, info.glow + '00');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r * 2.2, 0, 6.3);
    ctx.fill();
    if (w.owner >= 0) {
      ctx.strokeStyle = FACTIONS[w.owner].color;
      ctx.setLineDash([7 / z, 6 / z]);
      ctx.lineDashOffset = -t * 12;
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + 12, 0, 6.3);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (w.special === 'prize' || w.special === 'maw') {
      ctx.strokeStyle = `rgba(255,211,110,${0.5 + Math.sin(t * 4) * 0.3})`;
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + 22, 0, 6.3);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.beginPath();
    for (let i = 0; i < w.pts.length; i += 2) (i ? ctx.lineTo(w.pts[i], w.pts[i + 1]) : ctx.moveTo(w.pts[i], w.pts[i + 1]));
    ctx.closePath();
    ctx.fillStyle = info.color;
    ctx.fill();
    ctx.strokeStyle = info.glow;
    ctx.lineWidth = 2 / z;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    ctx.moveTo(-w.r * 0.5, -w.r * 0.1);
    ctx.lineTo(w.r * 0.4, w.r * 0.2);
    ctx.moveTo(-w.r * 0.1, -w.r * 0.5);
    ctx.lineTo(w.r * 0.1, w.r * 0.45);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = alpha;
    const hov = g.hoverWreck === w.id;
    if (z > 0.42 || hov || w.special) {
      const ratio = val / w.value0;
      label(ctx, `${Math.round(val)}cr${w.kind === 'reactor' ? ' ⚡' : ''}`, w.x, w.y - w.r - 10, hov ? '#fff' : info.glow, z, 11);
      if (ratio < 0.995) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(w.x - w.r, w.y + w.r + 6, w.r * 2, 3);
        ctx.fillStyle = '#ffa44d';
        ctx.fillRect(w.x - w.r, w.y + w.r + 6, w.r * 2 * ratio, 3);
      }
    }
    if (w.kind === 'reactor' && w.instab > 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(w.x - w.r, w.y + w.r + 11, w.r * 2, 3);
      ctx.fillStyle = w.instab > 70 ? '#ff4a4a' : '#ffd36e';
      ctx.fillRect(w.x - w.r, w.y + w.r + 11, w.r * 2 * Math.min(1, w.instab / 100), 3);
    }
    ctx.globalAlpha = 1;
  }
  // tow beams
  ctx.lineWidth = 2 / z;
  for (const w of g.wrecks) {
    if (!w.tugs.length || w.fade !== 0) continue;
    for (const id of w.tugs) {
      const s = g.shipMap.get(id);
      if (!s) continue;
      const c = s.faction === 0 ? '#4de1ff' : FACTIONS[s.faction].color;
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.2;
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.lineDashOffset = -t * 50;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (w.stalled) label(ctx, '⚠ STALLED', w.x, w.y + w.r + 24, '#ff9a6b', z, 11);
  }
  ctx.setLineDash([]);
  // cutter beams
  for (const s of g.ships) {
    if (s.aux[1] > 0 && s.kind === 'cutter' && s.order.t === 'cut') {
      const w = g.wreckMap.get(s.order.id);
      if (!w) continue;
      ctx.strokeStyle = `rgba(255,${150 + Math.random() * 60},60,0.9)`;
      ctx.lineWidth = (2 + Math.random() * 1.5) / z;
      const a = Math.atan2(w.y - s.y, w.x - s.x);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(w.x - Math.cos(a) * w.r * 0.6, w.y - Math.sin(a) * w.r * 0.6);
      ctx.stroke();
    }
  }
  // order lines for selected
  ctx.setLineDash([4 / z, 6 / z]);
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = 'rgba(125,255,176,0.45)';
  for (const id of g.sel) {
    const s = g.shipMap.get(id);
    if (!s || s.dead) continue;
    let tx = 0, ty = 0, ok = false;
    if (s.order.t === 'move') { tx = s.order.x; ty = s.order.y; ok = true; }
    else if (s.order.t === 'return') { tx = g.station.x; ty = g.station.y; ok = true; }
    else if (s.order.id) {
      const w = g.wreckMap.get(s.order.id);
      const o = g.shipMap.get(s.order.id);
      if (s.order.t !== 'attack' && w) { tx = w.x; ty = w.y; ok = true; }
      else if (o) { tx = o.x; ty = o.y; ok = true; }
    }
    if (ok) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  // ships
  for (const s of g.ships) {
    if (s.dead || !s.vis || s.kind === 'boss') continue;
    drawShip(ctx, g, s, z, selSet.has(s.id));
  }
  for (const s of g.ships) if (!s.dead && s.vis && s.kind === 'boss') drawShip(ctx, g, s, z, false);
  // projectiles
  ctx.lineCap = 'round';
  for (const p of g.projs) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = (p.r * 1.3) / z * z;
    const l = p.big ? 0.025 : 0.035;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * l, p.y - p.vy * l);
    ctx.stroke();
    if (p.big) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
  }
  ctx.lineCap = 'butt';
  // particles
  for (const p of g.parts) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2.5 / z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.3);
      ctx.stroke();
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.3);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  // pings
  for (const p of g.pings) {
    const k = 1 - p.t / 1;
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.t);
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + k * 40, 0, 6.3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // floating text
  for (const f of g.texts) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    label(ctx, f.text, f.x, f.y, f.color, z, f.size);
  }
  ctx.globalAlpha = 1;
  // hover tooltip anchors (in world)
  ctx.restore();

  // ===== screen-space overlays =====
  if (g.drag) {
    const d = g.drag;
    ctx.strokeStyle = 'rgba(125,255,176,0.9)';
    ctx.fillStyle = 'rgba(125,255,176,0.08)';
    ctx.lineWidth = 1;
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    ctx.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  }
  // off-screen indicators
  const ind: { x: number; y: number; c: string; big?: boolean }[] = [];
  const stp = g.toScreen(g.station.x, g.station.y);
  ind.push({ x: stp.x, y: stp.y, c: '#4de1ff', big: true });
  let hostiles = 0;
  for (const s of g.ships) {
    if (s.dead || !s.vis || s.faction === 0) continue;
    if (s.kind === 'mine' || s.kind === 'sentry') continue;
    if (!g.hostile(0, s.faction) && s.kind !== 'boss') continue;
    if (hostiles++ > 14) break;
    const p = g.toScreen(s.x, s.y);
    ind.push({ x: p.x, y: p.y, c: s.kind === 'boss' ? '#ff7a2f' : '#ff6b57', big: s.kind === 'boss' });
  }
  for (const it of ind) {
    if (it.x > 20 && it.x < vw - 20 && it.y > 60 && it.y < vh - 20) continue;
    const cx = vw / 2, cy = vh / 2;
    const dx = it.x - cx, dy = it.y - cy;
    const k = Math.min((vw / 2 - 28) / Math.abs(dx || 1), (vh / 2 - 60) / Math.abs(dy || 1));
    const px = cx + dx * k, py = cy + dy * k;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = it.c;
    ctx.globalAlpha = 0.85;
    const sz = it.big ? 11 : 7;
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz, sz * 0.8);
    ctx.lineTo(-sz * 0.5, 0);
    ctx.lineTo(-sz, -sz * 0.8);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // tooltip
  const lines: { t: string; c: string }[] = [];
  if (g.hoverWreck) {
    const w = g.wreckMap.get(g.hoverWreck);
    if (w) {
      lines.push({ t: w.name, c: WRECK_INFO[w.kind].glow });
      lines.push({ t: `Mass ${Math.round(w.mass)} · needs ${Math.ceil(w.mass * 0.4)}+ tow power`, c: '#9ab' });
      const loot = RES_LIST.filter((r) => w.loot[r] >= 0.5).map((r) => `${RES_INFO[r].icon}${Math.round(w.loot[r])}`).join('  ');
      lines.push({ t: loot || 'Empty', c: '#d8ecff' });
      lines.push({ t: w.owner >= 0 ? `Claimed: ${FACTIONS[w.owner].name}` : 'Unclaimed', c: w.owner >= 0 ? FACTIONS[w.owner].color : '#7dffb0' });
      if (w.kind === 'reactor') lines.push({ t: `⚡ Instability ${Math.round(w.instab)}%: tow it, don't cut it`, c: '#ffd36e' });
    }
  } else if (g.hoverShip) {
    const s = g.shipMap.get(g.hoverShip);
    if (s) {
      const d = SHIPS[s.kind];
      lines.push({ t: s.faction === 0 ? `${d.name}${s.name ? ` “${s.name}”` : ''}` : s.faction === 4 ? d.name : `${FACTIONS[s.faction].tag} ${d.name}`, c: s.faction === 0 ? d.color : s.faction === 4 ? '#ffc933' : FACTIONS[s.faction].color });
      lines.push({ t: `Hull ${Math.round(s.hp)}/${Math.round(s.maxHp)}`, c: '#9ab' });
      if (s.faction === 0) {
        const c = g.crewOf(s);
        lines.push({ t: c ? `Captain ${c.name} (${c.spec}, skill ${c.skill})` : 'No captain: 65% efficiency', c: c ? '#d8ecff' : '#ff9a6b' });
      }
    }
  }
  if (lines.length) {
    ctx.font = '600 13px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    let wd = 0;
    for (const l of lines) wd = Math.max(wd, ctx.measureText(l.t).width);
    const bx = Math.min(vw - wd - 24, g.mouse.x + 16), by = Math.min(vh - lines.length * 17 - 16, g.mouse.y + 16);
    ctx.fillStyle = 'rgba(6,14,26,0.92)';
    ctx.strokeStyle = 'rgba(77,225,255,0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, wd + 16, lines.length * 17 + 10);
    ctx.strokeRect(bx, by, wd + 16, lines.length * 17 + 10);
    lines.forEach((l, i) => { ctx.fillStyle = l.c; ctx.fillText(l.t, bx + 8, by + 18 + i * 17); });
  }
  // storm / raid vignette
  if (g.storm && g.inStorm(cam.x, cam.y)) {
    ctx.fillStyle = 'rgba(120,80,220,0.08)';
    ctx.fillRect(0, 0, vw, vh);
  }
  if (g.station.hp < g.station.maxHp * 0.3) {
    const gr = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vh * 0.9);
    gr.addColorStop(0, 'rgba(255,0,0,0)');
    gr.addColorStop(1, `rgba(255,30,30,${0.18 + Math.sin(t * 6) * 0.08})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, vw, vh);
  }
  void sectorDef;
}

export function drawMini(g: Game, c: HTMLCanvasElement) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const w = c.width, h = c.height;
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050b16';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g.fogCanvas, 0, 0, w, h);
  for (let f = 1; f <= 4; f++) {
    ctx.fillStyle = FACTIONS[f].color;
    ctx.fillRect(FACTIONS[f].bx * sx - 3, FACTIONS[f].by * sy - 3, 6, 6);
  }
  for (const wr of g.wrecks) {
    if (!wr.revealed || wr.fade !== 0) continue;
    ctx.fillStyle = wr.owner >= 0 ? FACTIONS[wr.owner].color : WRECK_INFO[wr.kind].glow;
    const s = wr.special === 'leviathan' ? 5 : 2.4;
    ctx.fillRect(wr.x * sx - s / 2, wr.y * sy - s / 2, s, s);
  }
  if (g.storm) {
    ctx.strokeStyle = 'rgba(190,150,255,0.8)';
    ctx.beginPath();
    ctx.arc(g.storm.x * sx, g.storm.y * sy, g.storm.r * sx, 0, 6.3);
    ctx.stroke();
  }
  for (const s of g.ships) {
    if (s.dead || !s.vis) continue;
    if (s.kind === 'mine') continue;
    ctx.fillStyle = s.faction === 0 ? '#4de1ff' : s.faction === 4 ? '#ff6b57' : FACTIONS[s.faction].color;
    const sz = s.kind === 'boss' ? 6 : s.faction === 0 ? 2.6 : 2.2;
    ctx.fillRect(s.x * sx - sz / 2, s.y * sy - sz / 2, sz, sz);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(g.station.x * sx - 3, g.station.y * sy - 3, 6, 6);
  const vwW = (g.vw / g.cam.zoom) * sx, vhH = (g.vh / g.cam.zoom) * sy;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(g.cam.x * sx - vwW / 2, g.cam.y * sy - vhH / 2, vwW, vhH);
}
