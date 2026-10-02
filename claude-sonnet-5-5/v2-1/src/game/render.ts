import { BDEFS, clamp, EDEF, H, PLOTS, PLOT_BY_ID, seabedY, TERRAIN, TIDE_T, W, WALL_X0, WALL_X1, hasCharter } from './data';
import type { Building, Enemy, Game, Pick } from './sim';

export function viewT(w: number, h: number) {
  const s = Math.min(w / W, h / H);
  return { s, ox: (w - W * s) / 2, oy: (h - H * s) / 2 };
}

type RGB = [number, number, number];
const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixc = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
};
const mixrgb = (a: string, b: string, t: number): string => mixc(a, b, t);

const SKY: [string, string][] = [['#0a1030', '#26376a'], ['#2c3f7a', '#f0a070'], ['#4f9fd0', '#cfe8ee'], ['#3a2f6b', '#e88a6a']];
const X0 = -1500, X1 = 2900;

// deterministic decor
const rs = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const STARS = Array.from({ length: 110 }, () => ({ x: rs() * 1400 - 60, y: rs() * 330, r: rs() * 1.4 + 0.3, p: rs() * 6 }));
const SPECK = Array.from({ length: 260 }, () => ({ x: rs() * 1400, y: rs() * 760, r: rs() * 2 + 0.5, a: rs() * 0.2 }));
const CLOUDS = Array.from({ length: 7 }, () => ({ x: rs() * 1600, y: 40 + rs() * 140, s: 0.7 + rs(), v: 4 + rs() * 8 }));
const GULLS = Array.from({ length: 4 }, () => ({ x: rs() * 1500, y: 90 + rs() * 120, v: 20 + rs() * 20, p: rs() * 6 }));
const CRACKS = Array.from({ length: 8 }, () => ({ x: rs(), y: rs(), a: rs() * 6, l: 12 + rs() * 22 }));

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function terrainPath(c: CanvasRenderingContext2D) {
  c.beginPath(); c.moveTo(X0, 262); c.lineTo(0, 262);
  for (const p of TERRAIN) c.lineTo(p[0], p[1]);
  c.lineTo(X1, 700); c.lineTo(X1, 3000); c.lineTo(X0, 3000); c.closePath();
}

export function render(c: CanvasRenderingContext2D, g: Game, w: number, h: number, hover: Pick, time: number) {
  const v = viewT(w, h);
  c.setTransform(1, 0, 0, 1, 0, 0);
  const night = 0.5 + 0.5 * Math.cos((2 * Math.PI * (g.t / (TIDE_T * 4))) % (2 * Math.PI));
  const ph = (g.t / (TIDE_T * 4)) % 1;
  const seg = Math.floor(ph * 4); const f = ph * 4 - seg;
  const sA = SKY[seg], sB = SKY[(seg + 1) % 4];
  const stormMix = g.storm * 0.55;
  const top = mixrgb(mixc(sA[0], sB[0], f).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_m, r, gg, b) => '#' + [r, gg, b].map((n) => (+n).toString(16).padStart(2, '0')).join('')), '#2a323a', stormMix);
  const hor = mixrgb(mixc(sA[1], sB[1], f).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_m, r, gg, b) => '#' + [r, gg, b].map((n) => (+n).toString(16).padStart(2, '0')).join('')), '#59656d', stormMix);
  c.save();
  c.translate(v.ox, v.oy); c.scale(v.s, v.s);
  if (g.shake > 0.05) c.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

  // sky
  const sky = c.createLinearGradient(0, -200, 0, 470);
  sky.addColorStop(0, top); sky.addColorStop(1, hor);
  c.fillStyle = sky; c.fillRect(X0, -1600, X1 - X0, 3000);
  // stars
  const starA = clamp(night * 1.3 - 0.2, 0, 1) * (1 - g.storm);
  if (starA > 0.02) for (const s of STARS) { c.globalAlpha = starA * (0.5 + 0.5 * Math.sin(time * 1.5 + s.p)); c.fillStyle = '#fff'; c.fillRect(s.x, s.y, s.r, s.r); }
  c.globalAlpha = 1;
  // moon
  const tp = (2 * Math.PI * g.t) / TIDE_T;
  const mx = 900 - 280 * Math.sin(tp); const my = 150 + 70 * Math.cos(tp);
  const sf = clamp((g.ampAt(g.t) / (g.mods.has('spring') ? 1.3 : 1) - 61) / 54, 0, 1);
  const glow = c.createRadialGradient(mx, my, 6, mx, my, 90);
  glow.addColorStop(0, 'rgba(255,250,220,0.35)'); glow.addColorStop(1, 'rgba(255,250,220,0)');
  c.fillStyle = glow; c.fillRect(mx - 100, my - 100, 200, 200);
  c.globalAlpha = 0.9 - g.storm * 0.5;
  c.fillStyle = '#f4f0d8'; c.beginPath(); c.arc(mx, my, 20, 0, 7); c.fill();
  c.fillStyle = 'rgba(160,150,120,0.35)'; c.beginPath(); c.arc(mx - 6, my - 4, 4, 0, 7); c.arc(mx + 6, my + 6, 3, 0, 7); c.fill();
  if (sf < 0.95) { c.fillStyle = mixc(sA[0], sB[0], f); c.beginPath(); c.arc(mx + (1 - sf) * 22, my - 2, 19, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  // mountains
  for (let l = 0; l < 2; l++) {
    c.fillStyle = l === 0 ? mixc('#2a3550', '#3d4d6a', 1 - night) : mixc('#1c2438', '#2c384e', 1 - night);
    c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(X0, 700);
    for (let x = -400; x <= 1700; x += 40) c.lineTo(x, 330 - l * 40 - 45 * Math.abs(Math.sin(x * 0.006 + l * 2)) - 25 * Math.sin(x * 0.017 + l) - (l === 0 ? 20 : 0));
    c.lineTo(1700, 700); c.closePath(); c.fill();
  }
  c.globalAlpha = 1;
  // clouds
  for (const cl of CLOUDS) {
    const x = ((cl.x + time * cl.v) % 1900) - 300;
    c.fillStyle = `rgba(${200 - g.storm * 110},${210 - g.storm * 110},${225 - g.storm * 100},${0.16 + g.storm * 0.35})`;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + k * 30 * cl.s, cl.y + (k % 2) * 8, 40 * cl.s, 14 * cl.s, 0, 0, 7); c.fill(); }
  }
  for (const gl of GULLS) {
    const x = ((gl.x + time * gl.v) % 1700) - 200; const y = gl.y + Math.sin(time + gl.p) * 14; const fl = Math.sin(time * 6 + gl.p) * 5;
    c.strokeStyle = `rgba(240,240,240,${0.6 - g.storm * 0.4})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 8, y - fl); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 8, y - fl); c.stroke();
  }

  // sea body
  const S = g.S;
  c.beginPath(); c.moveTo(WALL_X1 - 2, g.surf(WALL_X1));
  for (let x = WALL_X1; x <= 1500; x += 14) c.lineTo(x, g.surf(x));
  c.lineTo(X1, g.surf(1500)); c.lineTo(X1, 3000); c.lineTo(WALL_X1 - 2, 3000); c.closePath();
  const sea = c.createLinearGradient(0, S - 30, 0, 720);
  sea.addColorStop(0, mixc('#2aa0b4', '#1f6f86', g.storm)); sea.addColorStop(0.45, '#14587a'); sea.addColorStop(1, '#071d33');
  c.fillStyle = sea; c.fill();
  // light shafts
  c.save(); c.clip();
  for (let i = 0; i < 5; i++) {
    const sx = 800 + i * 130 + Math.sin(time * 0.4 + i) * 20;
    const gr = c.createLinearGradient(0, S, 0, S + 260); gr.addColorStop(0, `rgba(190,240,255,${0.1 * (1 - g.storm)})`); gr.addColorStop(1, 'rgba(190,240,255,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(sx, S); c.lineTo(sx + 40, S); c.lineTo(sx + 110, S + 260); c.lineTo(sx + 20, S + 260); c.fill();
  }
  c.restore();
  // lagoon body
  const lg = c.createLinearGradient(0, g.L, 0, 570);
  lg.addColorStop(0, '#2e97ac'); lg.addColorStop(1, '#0b3550');
  c.fillStyle = lg; c.beginPath(); c.moveTo(440, g.L);
  for (let x = 440; x <= 706; x += 10) c.lineTo(x, g.L + Math.sin(x * 0.05 + time * 2) * 1.5);
  c.lineTo(706, 575); c.lineTo(440, 575); c.closePath(); c.fill();

  // terrain
  terrainPath(c);
  const tg = c.createLinearGradient(0, 250, 0, 720); tg.addColorStop(0, '#5b5144'); tg.addColorStop(1, '#2a2622');
  c.fillStyle = tg; c.fill();
  c.save(); c.clip();
  for (const s of SPECK) { c.fillStyle = `rgba(255,255,255,${s.a * 0.5})`; c.fillRect(s.x, s.y, s.r, s.r); }
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
  for (let y = 290; y < 760; y += 34) { c.beginPath(); c.moveTo(X0, y); for (let x = -100; x < 1400; x += 60) c.lineTo(x, y + Math.sin(x * 0.02 + y) * 6); c.stroke(); }
  // wetness
  c.fillStyle = 'rgba(8,40,60,0.38)'; c.fillRect(WALL_X1, S, 3000, 3000);
  c.fillStyle = 'rgba(8,40,60,0.4)'; c.fillRect(440, g.L, 266, 400);
  // tide-line algae
  c.fillStyle = 'rgba(80,140,90,0.35)'; c.fillRect(WALL_X1, S - 3, 3000, 4);
  c.restore();
  // grass
  c.strokeStyle = '#5f9a52'; c.lineWidth = 6; c.beginPath(); c.moveTo(X0, 260); c.lineTo(440, 260); c.stroke();
  c.strokeStyle = '#7bbf68'; c.lineWidth = 2;
  for (let x = 0; x < 440; x += 12) { c.beginPath(); c.moveTo(x, 259); c.lineTo(x + 2 + Math.sin(time + x) * 1.5, 252 - (x * 7 % 5)); c.stroke(); }

  drawWall(c, g, time);
  // tide staff
  c.fillStyle = '#6b4a2b'; c.fillRect(748, 300, 4, 270);
  c.fillStyle = '#e8d9b0';
  for (let y = 300; y <= 560; y += 20) c.fillRect(748, y, y % 100 === 0 ? 14 : 8, 1.5);
  c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(754, S); c.lineTo(766, S - 5); c.lineTo(766, S + 5); c.fill();

  // plots and buildings
  for (const p of PLOTS) {
    const b = g.buildingAt(p.id);
    if (p.kind === 'mount') drawMount(c, g, p.id, time);
    if (!b && !g.demo) drawPlotMarker(c, g, p.id, time, hover);
  }
  for (const b of g.buildings) { if (b.type === 'keep') drawKeep(c, g, b, time); else if (b.type !== 'wall') drawBuilding(c, g, b, time); }

  // crates
  for (const cr of g.crates) {
    c.save(); c.translate(cr.x, cr.y + Math.sin(time * 2 + cr.id) * 2); c.rotate(Math.sin(time * 1.5 + cr.id) * 0.12);
    if (cr.gold) { c.fillStyle = 'rgba(255,220,100,0.35)'; c.beginPath(); c.arc(0, -8, 18 + Math.sin(time * 5) * 2, 0, 7); c.fill(); }
    c.fillStyle = cr.gold ? '#d4a84a' : '#8a5a35'; rr(c, -11, -18, 22, 18, 2); c.fill();
    c.strokeStyle = '#3d2a18'; c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.moveTo(-11, -9); c.lineTo(11, -9); c.moveTo(0, -18); c.lineTo(0, 0); c.stroke();
    c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText(cr.kind === 'stone' ? '🪨' : cr.kind === 'iron' ? '⚙️' : cr.kind === 'gold' ? '🪙' : '🐟', 0, -22);
    c.restore();
  }

  for (const e of g.enemies) drawEnemy(c, g, e, time, hover);

  // projectiles
  for (const p of g.projs) {
    const ang = Math.atan2(p.vy, p.vx);
    c.save(); c.translate(p.x, p.y); c.rotate(ang);
    if (p.k === 'bolt') { c.strokeStyle = '#f1e6c8'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-12, 0); c.lineTo(6, 0); c.stroke(); c.fillStyle = '#c9ccd2'; c.beginPath(); c.moveTo(6, 0); c.lineTo(1, -3); c.lineTo(1, 3); c.fill(); }
    else if (p.k === 'ball' || p.k === 'eball') { c.fillStyle = '#1d1d22'; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(-1.5, -1.5, 1.5, 0, 7); c.fill(); }
    else if (p.k === 'boulder') { c.fillStyle = '#8d8579'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.fillStyle = '#6b655b'; c.beginPath(); c.arc(2, 2, 4, 0, 7); c.fill(); }
    else if (p.k === 'eshell') { c.fillStyle = '#3a2e2a'; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill(); c.fillStyle = '#ff9f43'; c.beginPath(); c.arc(-5, 0, 3, 0, 7); c.fill(); }
    else { c.fillStyle = 'rgba(255,100,40,0.45)'; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill(); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); }
    c.restore();
  }
  // beams
  for (const b of g.beams) {
    const a = b.life / b.max;
    if (b.k === 'jet') {
      c.strokeStyle = `rgba(120,220,255,${0.6 * a})`; c.lineWidth = 12 * a + 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 3; c.stroke();
    } else {
      c.strokeStyle = `rgba(255,240,150,${a})`; c.lineWidth = 2.5; c.shadowColor = '#ffe96a'; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(b.x1, b.y1);
      const n = 10; const sd = Math.floor(time * 30);
      for (let i = 1; i < n; i++) { const t = i / n; const jr = Math.sin(sd * 7.1 + i * 12.9) * 18; c.lineTo(b.x1 + (b.x2 - b.x1) * t + jr, b.y1 + (b.y2 - b.y1) * t + Math.cos(sd * 3.3 + i * 5.7) * 18); }
      c.lineTo(b.x2, b.y2); c.stroke(); c.shadowBlur = 0;
    }
  }

  // water overlay (ships/buildings appear submerged)
  c.beginPath(); c.moveTo(WALL_X1 - 2, g.surf(WALL_X1));
  for (let x = WALL_X1; x <= 1500; x += 14) c.lineTo(x, g.surf(x));
  c.lineTo(X1, g.surf(1500)); c.lineTo(X1, 3000); c.lineTo(WALL_X1 - 2, 3000); c.closePath();
  c.fillStyle = 'rgba(25,100,130,0.3)'; c.fill();
  // foam/surface highlight
  c.strokeStyle = 'rgba(220,250,255,0.75)'; c.lineWidth = 2.2; c.beginPath();
  for (let x = WALL_X1; x <= 1500; x += 10) { const y = g.surf(x); if (x === WALL_X1) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.strokeStyle = 'rgba(220,250,255,0.25)'; c.lineWidth = 1; c.beginPath();
  for (let x = WALL_X1; x <= 1500; x += 10) { const y = g.surf(x + 30) + 6; if (x === WALL_X1) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.fillStyle = 'rgba(30,130,150,0.32)'; c.fillRect(440, g.L, 266, 140);
  c.strokeStyle = 'rgba(210,248,255,0.7)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(440, g.L); for (let x = 440; x <= 706; x += 8) c.lineTo(x, g.L + Math.sin(x * 0.05 + time * 2) * 1.5); c.stroke();

  // selection visuals
  drawSelection(c, g, time, hover);

  // particles
  for (const p of g.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    c.globalAlpha = a;
    if (p.k === 2) { c.strokeStyle = p.col; c.lineWidth = 3 * a; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - a) + 4, 0, 7); c.stroke(); }
    else { c.fillStyle = p.col; if (p.k === 1) c.fillRect(p.x, p.y, p.size, p.size); else { c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, 7); c.fill(); } }
  }
  c.globalAlpha = 1;

  // rain
  if (g.storm > 0.3) {
    c.strokeStyle = `rgba(190,215,235,${0.35 * g.storm})`; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < 140; i++) { const x = ((i * 97.3 + time * 380) % 1500) - 100; const y = ((i * 53.7 + time * 700) % 800) - 40; c.moveTo(x, y); c.lineTo(x - 6, y + 16); }
    c.stroke();
  }
  // fog
  const fogE = g.events.find((e) => e.type === 'fog');
  if (fogE) {
    const a = 0.55 * g.evEnv(fogE);
    const fg = c.createLinearGradient(0, 250, 0, 720); fg.addColorStop(0, `rgba(220,230,235,${a * 0.6})`); fg.addColorStop(1, `rgba(220,230,235,${a})`);
    c.fillStyle = fg; c.fillRect(X0, 0, X1 - X0, 760);
    c.fillStyle = `rgba(235,240,245,${a * 0.35})`;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(((i * 260 + time * 20) % 1600) - 150, 420 + i * 28, 180, 26, 0, 0, 7); c.fill(); }
  }
  if (g.flashT > 0) { c.fillStyle = `rgba(255,255,230,${g.flashT * 1.6})`; c.fillRect(X0, -1600, X1 - X0, 3000); }
  // floating text
  c.textAlign = 'center'; c.lineJoin = 'round';
  for (const t of g.texts) {
    c.globalAlpha = clamp(t.life * 1.6, 0, 1); c.font = `bold ${t.size}px system-ui, sans-serif`;
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.col; c.fillText(t.txt, t.x, t.y);
  }
  c.globalAlpha = 1;
  c.restore();
}

function drawWall(c: CanvasRenderingContext2D, g: Game, time: number) {
  const top = g.wallTop; const wl = g.wall;
  const gr = c.createLinearGradient(WALL_X0, 0, WALL_X1, 0); gr.addColorStop(0, '#6d6a63'); gr.addColorStop(0.5, '#9a968c'); gr.addColorStop(1, '#716d65');
  c.fillStyle = gr; c.fillRect(WALL_X0, top, WALL_X1 - WALL_X0, 570 - top);
  c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1;
  for (let y = top; y < 570; y += 16) { c.beginPath(); c.moveTo(WALL_X0, y); c.lineTo(WALL_X1, y); c.stroke(); const o = ((y - top) / 16) % 2 ? 10 : 20; c.beginPath(); c.moveTo(WALL_X0 + o, y); c.lineTo(WALL_X0 + o, y + 16); c.moveTo(WALL_X0 + o + 20, y); c.lineTo(WALL_X0 + o + 20, y + 16); c.stroke(); }
  c.fillStyle = '#8d897f'; for (let x = WALL_X0; x < WALL_X1; x += 14) c.fillRect(x, top - 8, 8, 8);
  c.fillStyle = '#4b4741'; c.fillRect(WALL_X0 - 3, top - 2, WALL_X1 - WALL_X0 + 6, 4);
  // banner
  c.fillStyle = '#2f8aa0'; c.beginPath(); c.moveTo(WALL_X0 + 8, top + 6); c.lineTo(WALL_X0 + 24, top + 6); c.lineTo(WALL_X0 + 24, top + 34 + Math.sin(time * 2) * 2); c.lineTo(WALL_X0 + 16, top + 28); c.lineTo(WALL_X0 + 8, top + 34); c.fill();
  for (let i = 1; i < wl.level; i++) { c.fillStyle = '#ffd166'; c.beginPath(); c.arc(WALL_X0 + 12 + i * 8, top + 50, 2.5, 0, 7); c.fill(); }
  const dmg = 1 - wl.hp / wl.maxHp;
  c.strokeStyle = 'rgba(15,12,10,0.8)'; c.lineWidth = 1.6;
  for (let i = 0; i < Math.floor(dmg * 8); i++) { const k = CRACKS[i]; const x = WALL_X0 + 6 + k.x * 28; const y = top + 30 + k.y * (520 - top); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(k.a) * k.l * 0.5, y + Math.sin(k.a) * k.l); c.lineTo(x + Math.cos(k.a + 1) * k.l * 0.3, y + Math.sin(k.a) * k.l * 1.4); c.stroke(); }
  if (g.breached) { c.fillStyle = '#17120e'; c.beginPath(); c.moveTo(WALL_X0, 380); c.lineTo(WALL_X1, 395); c.lineTo(WALL_X1 - 6, 470); c.lineTo(WALL_X0 + 4, 480); c.fill(); c.font = 'bold 12px sans-serif'; c.fillStyle = '#ff6b6b'; c.textAlign = 'center'; c.fillText('BREACH', 725, 430); }
  // gates
  g.gates.forEach((gt, i) => {
    const y0 = gt.sill - 38;
    c.fillStyle = '#18222a'; c.fillRect(WALL_X0, y0, 40, 38);
    if (gt.flow > 1) { c.fillStyle = 'rgba(120,210,235,0.7)'; for (let k = 0; k < 4; k++) { const xx = WALL_X0 + ((time * 60 * (g.S > g.L ? -1 : 1) + k * 10) % 40 + 40) % 40; c.fillRect(xx, y0 + 4 + (k % 3) * 11, 6, 3); } }
    // turbine
    c.save(); c.translate(WALL_X0 + 20, y0 + 19); c.rotate(time * Math.min(14, gt.flow * 0.5) * (g.S > g.L ? 1 : -1)); c.strokeStyle = '#d4a84a'; c.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(11, 3); c.stroke(); }
    c.restore();
    const dh = 38 * (1 - gt.open);
    c.fillStyle = '#515c66'; c.fillRect(WALL_X0, y0, 40, dh);
    c.strokeStyle = '#2b333a'; c.lineWidth = 1; for (let k = 6; k < dh; k += 8) { c.beginPath(); c.moveTo(WALL_X0, y0 + k); c.lineTo(WALL_X1, y0 + k); c.stroke(); }
    c.strokeStyle = gt.mode === 2 ? '#7fe3a0' : gt.mode === 1 ? '#ffd166' : '#aab4bc'; c.lineWidth = 2.5; c.strokeRect(WALL_X0 + 1, y0 + 1, 38, 36);
    c.fillStyle = gt.mode === 2 ? '#7fe3a0' : gt.mode === 1 ? '#ffd166' : '#8a949c'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
    c.fillText(`${i + 1}·${gt.mode === 0 ? 'SHUT' : gt.mode === 1 ? 'OPEN' : 'AUTO'}`, WALL_X0 + 20, y0 - 4);
  });
}

function drawPlotMarker(c: CanvasRenderingContext2D, g: Game, id: string, time: number, hover: Pick) {
  const p = PLOT_BY_ID[id];
  const locked = !!p.req && !hasCharter(g.save, p.req);
  const hov = !!hover && hover.k === 'plot' && hover.id === id;
  const sel = !!g.sel && g.sel.k === 'plot' && g.sel.id === id;
  if (p.kind === 'mount') { if (locked) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('🔒', p.x, p.y - 12); } }
  c.save();
  c.globalAlpha = locked ? 0.25 : sel || hov ? 1 : 0.5 + 0.2 * Math.sin(time * 2 + p.x);
  c.setLineDash([5, 4]); c.lineDashOffset = -time * 8; c.strokeStyle = sel ? '#ffd166' : hov ? '#fff' : '#cfe8ee'; c.lineWidth = 1.8;
  const w = p.kind === 'mount' ? 40 : 50; const hh = p.kind === 'mount' ? 40 : 52;
  rr(c, p.x - w / 2, p.y - hh - 2, w, hh, 5); c.stroke(); c.setLineDash([]);
  if (!locked) { c.fillStyle = sel || hov ? '#fff' : '#cfe8ee'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('+', p.x, p.y - hh / 2 + 4); }
  c.restore();
}

function drawMount(c: CanvasRenderingContext2D, g: Game, id: string, _time: number) {
  const p = PLOT_BY_ID[id];
  if (p.req && !hasCharter(g.save, p.req)) return;
  c.fillStyle = '#6b4a2b'; c.strokeStyle = '#3d2a18'; c.lineWidth = 1.5;
  if (p.wallMount) {
    c.beginPath(); c.moveTo(WALL_X1, p.y + 2); c.lineTo(WALL_X1 + 6, p.y + 26); c.lineTo(WALL_X1 + 30, p.y + 2); c.stroke();
    c.fillRect(p.x - 24, p.y, 48, 6); c.strokeRect(p.x - 24, p.y, 48, 6);
  } else {
    const bed = seabedY(p.x);
    for (const dx of [-18, 18]) { c.fillRect(p.x + dx - 2.5, p.y + 6, 5, bed - p.y - 6); }
    c.strokeStyle = '#3d2a18'; c.beginPath(); c.moveTo(p.x - 18, p.y + 20); c.lineTo(p.x + 18, p.y + 50); c.moveTo(p.x + 18, p.y + 20); c.lineTo(p.x - 18, p.y + 50); c.stroke();
    c.fillStyle = '#7b5632'; c.fillRect(p.x - 26, p.y, 52, 7);
    c.fillStyle = '#d4a84a'; for (let k = -22; k < 24; k += 11) c.fillRect(p.x + k, p.y + 1, 2, 2);
  }
}

function hpBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, r: number, col: string) {
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col; c.fillRect(x - w / 2, y, w * clamp(r, 0, 1), 4);
}

function drawBuilding(c: CanvasRenderingContext2D, g: Game, b: Building, time: number) {
  const p = PLOT_BY_ID[b.plot]; const def = BDEFS[b.type];
  const grow = clamp(b.born / 0.45, 0, 1); const ease = 1 - Math.pow(1 - grow, 3);
  c.save(); c.translate(p.x, p.y); c.scale(1, ease);
  const eng = !!def.engine;
  if (!eng) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-27, -3, 54, 4); }
  if (eng) drawEngine(c, g, b, time);
  else drawWorkshop(c, g, b, time);
  if (b.flash > 0) { c.fillStyle = `rgba(255,255,255,${b.flash * 3})`; c.fillRect(-26, -56, 52, 56); }
  c.restore();
  // overlays
  const top = p.y - (eng ? 54 : 66);
  if (b.hp < b.maxHp) hpBar(c, p.x, top - 6, 36, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#7fe3a0' : '#ff7b6b');
  if (def.crew > 0) {
    for (let i = 0; i < def.crew; i++) { c.fillStyle = i < b.crew ? '#ffd166' : 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(p.x - (def.crew - 1) * 4 + i * 8, top + 4, 2.6, 0, 7); c.fill(); }
    if (b.crew < def.crew) { c.fillStyle = '#ff6b6b'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('!', p.x + 22, top + 8); }
  }
  for (let i = 0; i < b.level; i++) { c.fillStyle = '#ffd166'; c.fillRect(p.x - 12 + i * 9, top - 14, 6, 3); }
  if (b.flooded) { c.fillStyle = 'rgba(70,160,220,0.5)'; rr(c, p.x - 26, p.y - 56, 52, 56, 4); c.fill(); c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('💧', p.x, p.y - 30); }
  if (b.burning > 0) { c.font = '15px sans-serif'; c.textAlign = 'center'; c.fillText('🔥', p.x + Math.sin(time * 9) * 2, p.y - 40); }
  if (eng && b.depth > 100) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText('🌊', p.x, p.y - 50); }
}

function drawWorkshop(c: CanvasRenderingContext2D, g: Game, b: Building, time: number) {
  const run = b.eff > 0.05;
  switch (b.type) {
    case 'quarry':
      c.fillStyle = '#6e675d'; c.fillRect(-24, -10, 48, 10); c.fillStyle = '#8d8579';
      c.beginPath(); c.moveTo(-24, -10); c.lineTo(-10, -26); c.lineTo(4, -10); c.fill(); c.beginPath(); c.moveTo(0, -10); c.lineTo(12, -20); c.lineTo(24, -10); c.fill();
      c.strokeStyle = '#7b5632'; c.lineWidth = 4; c.beginPath(); c.moveTo(16, -10); c.lineTo(16, -46); c.stroke();
      c.save(); c.translate(16, -44); c.rotate(run ? Math.sin(time * 2.2) * 0.35 : 0.1); c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, 4); c.stroke(); c.restore();
      c.fillStyle = '#d4a84a'; c.fillRect(-18 + (run ? Math.sin(time * 2.2) * 5 : 0), -30, 7, 7); break;
    case 'ironworks':
      c.fillStyle = '#7a3b2e'; c.fillRect(-24, -32, 36, 32); c.fillStyle = '#4a2a22'; c.fillRect(-24, -34, 36, 4);
      c.fillStyle = '#403a36'; c.fillRect(12, -52, 11, 52);
      c.fillStyle = run ? '#ffae42' : '#5a3a2a'; c.fillRect(-16, -16, 14, 16);
      if (run) { c.fillStyle = 'rgba(255,170,60,0.25)'; c.beginPath(); c.arc(-9, -10, 18, 0, 7); c.fill(); for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; c.fillStyle = `rgba(190,190,190,${0.5 * (1 - t)})`; c.beginPath(); c.arc(18 + Math.sin(t * 6 + i) * 4, -54 - t * 30, 4 + t * 7, 0, 7); c.fill(); } }
      break;
    case 'saltworks':
      c.fillStyle = '#7b5632'; c.fillRect(-26, -8, 52, 8);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#e9f1f3'; c.beginPath(); c.moveTo(-24 + i * 17, -8); c.lineTo(-20 + i * 17, -18); c.lineTo(-10 + i * 17, -18); c.lineTo(-8 + i * 17, -8); c.fill(); c.fillStyle = 'rgba(120,200,230,0.6)'; c.fillRect(-19 + i * 17, -17, 8, 2); }
      c.fillStyle = '#d9c9a0'; c.beginPath(); c.moveTo(-10, -18); c.lineTo(0, -34); c.lineTo(10, -18); c.fill();
      if (run) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-2 + Math.sin(time * 3) * 12, -28 - (time * 8 % 8), 2, 2); } break;
    case 'fishery':
      c.fillStyle = '#7b5632'; c.fillRect(-20, -26, 30, 26); c.fillStyle = '#c9a85a'; c.beginPath(); c.moveTo(-24, -26); c.lineTo(-5, -44); c.lineTo(14, -26); c.fill();
      c.strokeStyle = '#d9d2b8'; c.lineWidth = 1; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(14, -30); c.lineTo(22 + i * 2, -4 + i); c.stroke(); }
      c.fillStyle = '#9fd0d8'; c.fillRect(14, -26, 14, 3); c.fillStyle = '#ffb347'; c.fillRect(18, -22, 6, 3); break;
    case 'mess':
      c.fillStyle = '#8a6a45'; c.fillRect(-24, -26, 48, 26); c.fillStyle = '#b55a3c'; c.beginPath(); c.arc(0, -26, 26, Math.PI, 0); c.fill();
      c.fillStyle = run ? '#ffd98a' : '#4b3a2a'; c.fillRect(-14, -18, 8, 10); c.fillRect(6, -18, 8, 10);
      if (run) for (let i = 0; i < 2; i++) { const t = (time * 0.5 + i / 2) % 1; c.fillStyle = `rgba(220,220,220,${0.5 * (1 - t)})`; c.beginPath(); c.arc(0 + Math.sin(t * 5) * 3, -52 - t * 22, 3 + t * 5, 0, 7); c.fill(); } break;
    case 'barracks':
      c.fillStyle = '#7d7468'; c.fillRect(-26, -24, 52, 24); c.fillStyle = '#4f6b8a'; c.beginPath(); c.moveTo(-30, -24); c.lineTo(0, -42); c.lineTo(30, -24); c.fill();
      c.fillStyle = '#ffd98a'; for (let i = 0; i < 3; i++) c.fillRect(-19 + i * 14, -17, 7, 8);
      c.strokeStyle = '#444'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -42); c.lineTo(0, -56); c.stroke(); c.fillStyle = '#e8c15a'; c.beginPath(); c.moveTo(0, -56); c.lineTo(12 + Math.sin(time * 4) * 2, -52); c.lineTo(0, -48); c.fill(); break;
    case 'carpenter':
      c.fillStyle = '#9a6b3d'; c.fillRect(-22, -26, 30, 26); c.strokeStyle = '#5b3d22'; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -26); c.lineTo(8, 0); c.moveTo(8, -26); c.lineTo(-22, 0); c.stroke();
      c.fillStyle = '#6b4a2b'; c.beginPath(); c.moveTo(-26, -26); c.lineTo(-7, -40); c.lineTo(12, -26); c.fill();
      c.fillStyle = '#b98a54'; for (let i = 0; i < 3; i++) c.fillRect(12, -6 - i * 6, 14, 5);
      if (run) { c.save(); c.translate(-10, -30); c.rotate(Math.sin(time * 8) * 0.5); c.fillStyle = '#777'; c.fillRect(0, 0, 10, 4); c.restore(); } break;
    case 'battery': {
      for (let i = 0; i < 3; i++) { c.fillStyle = '#3d4f60'; rr(c, -22 + i * 16, -32, 12, 32, 3); c.fill(); const fill = clamp(g.power / g.powerCap, 0, 1); c.fillStyle = `rgba(90,220,255,${0.4 + 0.4 * Math.sin(time * 3 + i)})`; c.fillRect(-20 + i * 16, -4 - 24 * fill, 8, 24 * fill); c.fillStyle = '#d4a84a'; c.fillRect(-19 + i * 16, -36, 6, 4); }
      if (g.power > g.powerCap * 0.8 && Math.sin(time * 9) > 0.7) { c.strokeStyle = '#9ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, -38); c.lineTo(-6, -46); c.lineTo(-2, -38); c.lineTo(10, -46); c.stroke(); } break;
    }
    case 'observatory':
      c.fillStyle = '#8a8378'; c.fillRect(-9, -40, 18, 40); c.fillStyle = '#4f6b8a'; c.beginPath(); c.arc(0, -40, 15, Math.PI, 0); c.fill();
      c.save(); c.translate(0, -48); c.rotate(-0.6 + Math.sin(time * 0.5) * 0.2); c.fillStyle = '#d4a84a'; c.fillRect(0, -3, 22, 6); c.restore();
      c.fillStyle = '#ffd98a'; c.fillRect(-3, -28, 6, 8); break;
    default: break;
  }
}

function drawEngine(c: CanvasRenderingContext2D, g: Game, b: Building, time: number) {
  const aim = b.aim || -0.3; const rc = b.recoil;
  const ready = b.charge >= 1;
  c.fillStyle = '#5b4a38'; rr(c, -18, -12, 36, 12, 3); c.fill();
  c.fillStyle = '#8a7a66'; c.fillRect(-14, -14, 28, 4);
  // charge ring
  c.strokeStyle = ready ? '#7fe3a0' : '#ffd166'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -26, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.charge); c.stroke();
  c.save(); c.translate(0, -24);
  if (b.type === 'ballista') {
    c.rotate(clamp(aim, -1.2, 0.5)); c.translate(-rc * 6, 0);
    c.strokeStyle = '#9a6b3d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 0); c.lineTo(16, 0); c.stroke();
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 3; c.beginPath(); c.moveTo(4, -14); c.quadraticCurveTo(-6 + rc * 6, 0, 4, 14); c.stroke();
    c.strokeStyle = '#eee'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, -14); c.lineTo(-6 * (1 - b.charge) - 4 * b.charge + rc * 6, 0); c.lineTo(4, 14); c.stroke();
    if (b.charge > 0.2 && rc < 0.1) { c.fillStyle = '#d9d2b8'; c.fillRect(-6 * b.charge, -1, 22, 2); }
  } else if (b.type === 'cannon') {
    c.rotate(clamp(aim, -1, 0.6)); c.translate(-rc * 8, 0);
    c.fillStyle = '#2c2f36'; rr(c, -12, -6, 34, 12, 4); c.fill(); c.fillStyle = '#4a4f59'; c.fillRect(-12, -6, 34, 3);
    c.fillStyle = '#d4a84a'; c.fillRect(18, -7, 4, 14);
    if (rc > 0.6) { c.fillStyle = 'rgba(255,200,80,0.9)'; c.beginPath(); c.arc(28, 0, 10 * rc, 0, 7); c.fill(); }
  } else if (b.type === 'catapult') {
    c.fillStyle = '#7b5632'; c.fillRect(-14, -4, 28, 6);
    c.save(); c.translate(0, -2); c.rotate(-2.3 + rc * 1.9); c.strokeStyle = '#9a6b3d'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(24, 0); c.stroke();
    if (rc < 0.3) { c.fillStyle = '#8d8579'; c.beginPath(); c.arc(25, 0, 5, 0, 7); c.fill(); }
    c.restore();
  } else if (b.type === 'hydro') {
    c.rotate(clamp(aim, -1, 0.6));
    c.fillStyle = '#b8863a'; rr(c, -10, -5, 30, 10, 4); c.fill(); c.fillStyle = '#d4a84a'; c.fillRect(16, -7, 6, 14);
    const head = clamp((g.S - g.L) / 100, 0, 1);
    c.fillStyle = `rgba(120,220,255,${0.4 + head * 0.5})`; c.fillRect(-10, -2, 24 * head, 4);
    c.restore(); c.save(); c.translate(0, -24);
    c.fillStyle = '#eee'; c.beginPath(); c.arc(-8, -14, 5, 0, 7); c.fill(); c.strokeStyle = '#c33'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-8, -14); c.lineTo(-8 + Math.cos(-2 + head * 2.6) * 4, -14 + Math.sin(-2 + head * 2.6) * 4); c.stroke();
  }
  c.restore();
  void time;
}

function drawKeep(c: CanvasRenderingContext2D, g: Game, b: Building, time: number) {
  c.save(); c.translate(75, 262);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-58, -3, 120, 5);
  const gr = c.createLinearGradient(-55, 0, 55, 0); gr.addColorStop(0, '#8d897f'); gr.addColorStop(1, '#6a665e');
  c.fillStyle = gr; c.fillRect(-50, -70, 100, 70);
  c.fillRect(-58, -112, 28, 112); c.fillRect(30, -100, 28, 100);
  c.fillStyle = '#4b4741';
  for (const [x, y, w] of [[-58, -112, 28], [30, -100, 28], [-50, -70, 100]] as const) for (let i = 0; i < w; i += 8) c.fillRect(x + i, y - 7, 5, 7);
  c.fillStyle = '#3b5f7d'; c.beginPath(); c.moveTo(-62, -112); c.lineTo(-44, -138); c.lineTo(-26, -112); c.fill();
  const lit = 1 - clamp(0.5 + 0.5 * Math.cos((2 * Math.PI * g.t) / (TIDE_T * 4)), 0, 1) * 0.5;
  c.fillStyle = `rgba(255,214,120,${0.5 + 0.5 * lit})`; c.fillRect(-48, -90, 6, 12); c.fillRect(38, -78, 6, 12); c.fillRect(-12, -52, 8, 14); c.fillRect(6, -52, 8, 14);
  c.fillStyle = '#3d2a18'; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-9, -22); c.arc(0, -22, 9, Math.PI, 0); c.lineTo(9, 0); c.fill();
  c.strokeStyle = '#444'; c.lineWidth = 2; c.beginPath(); c.moveTo(-44, -138); c.lineTo(-44, -158); c.stroke();
  c.fillStyle = b.hp < b.maxHp * 0.3 ? '#c33' : '#e8c15a'; c.beginPath(); c.moveTo(-44, -158); c.lineTo(-24 + Math.sin(time * 3) * 3, -153); c.lineTo(-44, -148); c.fill();
  if (b.flash > 0) { c.fillStyle = `rgba(255,255,255,${b.flash * 3})`; c.fillRect(-58, -112, 116, 112); }
  const dm = 1 - b.hp / b.maxHp;
  if (dm > 0.4 && Math.random() < 0.3) g.parts.push({ x: 75 + (Math.random() - 0.5) * 80, y: 200, vx: 0, vy: -30, life: 1, max: 1, size: 5, col: 'rgba(80,80,80,0.6)', g: -10, k: 0, drag: 0.5 });
  c.restore();
  hpBar(c, 75, 118, 70, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#7fe3a0' : '#ff7b6b');
  c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('KEEP', 75, 114);
  c.font = '12px sans-serif'; c.fillText(`⚓ ${g.crew - Math.max(0, g.freeCrew())}/${g.crew}`, 75, 134);
}

function hullPath(c: CanvasRenderingContext2D, s: number) {
  c.beginPath(); c.moveTo(-s * 0.5, -s * 0.13);
  c.quadraticCurveTo(-s * 0.4, s * 0.12, -s * 0.2, s * 0.17); c.lineTo(s * 0.3, s * 0.17);
  c.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.52, -s * 0.15); c.closePath();
}

function drawEnemy(c: CanvasRenderingContext2D, g: Game, e: Enemy, time: number, hover: Pick) {
  const d = EDEF[e.type]; const s = e.size;
  c.save(); c.translate(e.x, e.y);
  const slope = (g.surf(e.x + 10) - g.surf(e.x - 10)) / 20;
  c.rotate(e.aground ? 0.04 : Math.sin(e.bob * 1.3) * 0.03 + slope * 0.6);
  // sails & super structure first (behind hull)
  const col = d.col;
  switch (e.type) {
    case 'skiff':
      c.strokeStyle = '#5b3d22'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.8); c.stroke();
      c.fillStyle = '#e6dcc0'; c.beginPath(); c.moveTo(1, -s * 0.78); c.lineTo(s * 0.32, -s * 0.12); c.lineTo(1, -s * 0.12); c.fill(); break;
    case 'galley':
      c.strokeStyle = '#5b3d22'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.85); c.stroke();
      c.fillStyle = '#c0462f'; c.fillRect(-s * 0.22, -s * 0.8, s * 0.44, s * 0.4);
      c.strokeStyle = '#5b3d22'; c.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const ox = -s * 0.3 + i * s * 0.14; c.beginPath(); c.moveTo(ox, -s * 0.03); c.lineTo(ox - 6 + Math.sin(time * 4 + i) * 6, s * 0.22); c.stroke(); }
      c.fillStyle = '#9aa0a6'; c.beginPath(); c.moveTo(-s * 0.5, -s * 0.03); c.lineTo(-s * 0.64, s * 0.03); c.lineTo(-s * 0.5, s * 0.08); c.fill(); break;
    case 'fireship':
      c.strokeStyle = '#2b1a10'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.7); c.stroke();
      for (let i = 0; i < 6; i++) { const t = (time * 1.6 + i / 6) % 1; c.fillStyle = `rgba(255,${120 + i * 15},40,${0.9 * (1 - t)})`; c.beginPath(); c.arc(-s * 0.2 + i * s * 0.08 + Math.sin(time * 9 + i) * 2, -s * 0.15 - t * s * 0.5, s * 0.1 * (1 - t * 0.5), 0, 7); c.fill(); } break;
    case 'bombard':
      c.fillStyle = '#4f5964'; c.fillRect(-s * 0.3, -s * 0.28, s * 0.5, s * 0.15);
      c.save(); c.translate(-s * 0.02, -s * 0.28); c.rotate(-1.05 - Math.min(0.2, (e.cd > 0 ? 0 : 0.2))); c.fillStyle = '#25282e'; rr(c, 0, -5, s * 0.36, 10, 3); c.fill(); c.restore(); break;
    case 'tidecaller': {
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.7); c.stroke();
      const gl = 0.6 + 0.4 * Math.sin(time * 4); c.fillStyle = `rgba(110,231,255,${0.25 * gl})`; c.beginPath(); c.arc(0, -s * 0.8, s * 0.35, 0, 7); c.fill();
      c.fillStyle = '#7ef0ff'; c.beginPath(); c.moveTo(0, -s * 1.0); c.lineTo(7, -s * 0.8); c.lineTo(0, -s * 0.62); c.lineTo(-7, -s * 0.8); c.fill();
      c.strokeStyle = `rgba(110,231,255,${0.5 * gl})`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, s * 0.02, s * 0.6 + gl * 6, 8, 0, 0, 7); c.stroke(); break;
    }
    case 'ironclad':
      c.fillStyle = '#3f464e'; c.beginPath(); c.moveTo(-s * 0.36, -s * 0.12); c.lineTo(-s * 0.26, -s * 0.38); c.lineTo(s * 0.26, -s * 0.38); c.lineTo(s * 0.36, -s * 0.12); c.fill();
      c.fillStyle = '#2b3036'; c.fillRect(s * 0.1, -s * 0.7, s * 0.1, s * 0.34);
      for (let i = 0; i < 3; i++) { const t = (time * 0.5 + i / 3) % 1; c.fillStyle = `rgba(70,70,70,${0.5 * (1 - t)})`; c.beginPath(); c.arc(s * 0.15, -s * 0.74 - t * 26, 5 + t * 8, 0, 7); c.fill(); }
      c.fillStyle = '#1e2227'; rr(c, -s * 0.5, -s * 0.28, s * 0.3, 8, 3); c.fill(); c.fillStyle = '#ffb347'; c.fillRect(-s * 0.5, -s * 0.26, 3, 4); break;
    case 'maelstrom':
      for (let i = -1; i <= 1; i++) { c.strokeStyle = '#2b1a10'; c.lineWidth = 4; c.beginPath(); c.moveTo(i * s * 0.25, 0); c.lineTo(i * s * 0.25, -s * (0.7 - Math.abs(i) * 0.1)); c.stroke(); c.fillStyle = '#7a1f2c'; c.beginPath(); c.moveTo(i * s * 0.25 - s * 0.1, -s * 0.62); c.lineTo(i * s * 0.25 + s * 0.12 + Math.sin(time * 3 + i) * 3, -s * 0.5); c.lineTo(i * s * 0.25 + s * 0.1, -s * 0.2); c.lineTo(i * s * 0.25 - s * 0.1, -s * 0.2); c.fill(); }
      c.fillStyle = '#111'; c.fillRect(-1, -s * 0.78, 2, s * 0.1); c.font = `${s * 0.12}px sans-serif`; c.textAlign = 'center'; c.fillText('☠', 0, -s * 0.8);
      if (e.phase > 0) { c.strokeStyle = `rgba(255,80,80,${0.3 + 0.2 * Math.sin(time * 6)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, s * 0.62, s * 0.1, 0, 0, 7); c.stroke(); } break;
    case 'leviathan':
      for (let i = 0; i < 6; i++) { c.strokeStyle = i % 2 ? '#1f5a56' : '#2a6b66'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); const bx = -s * 0.4 + i * s * 0.17; c.moveTo(bx, 0); c.bezierCurveTo(bx - 8, -s * 0.3 + Math.sin(time * 2 + i) * 12, bx + 18, -s * 0.5 + Math.cos(time * 2.4 + i) * 14, bx + 4 + Math.sin(time * 3 + i) * 12, -s * 0.72); c.stroke(); }
      c.fillStyle = '#d4c36a'; c.beginPath(); c.moveTo(-s * 0.1, -s * 0.3); c.lineTo(-s * 0.05, -s * 0.5); c.lineTo(0, -s * 0.35); c.lineTo(s * 0.05, -s * 0.52); c.lineTo(s * 0.1, -s * 0.3); c.fill();
      c.fillStyle = `rgba(120,255,200,${0.6 + 0.4 * Math.sin(time * 4)})`; c.beginPath(); c.arc(-s * 0.3, -s * 0.05, 5, 0, 7); c.arc(-s * 0.2, -s * 0.05, 5, 0, 7); c.fill(); break;
    default: break;
  }
  // hull
  hullPath(c, s);
  const hg = c.createLinearGradient(0, -s * 0.13, 0, s * 0.17); hg.addColorStop(0, col); hg.addColorStop(1, '#1a1410');
  c.fillStyle = hg; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5; c.stroke();
  if (e.hit > 0) { c.fillStyle = `rgba(255,255,255,${e.hit * 5})`; c.fill(); }
  if (e.type === 'ironclad' || e.type === 'maelstrom') { c.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = -3; i <= 3; i++) c.fillRect(i * s * 0.12, -s * 0.06, 2, 2); }
  c.restore();
  // aground & bars
  const ty = e.y - s * 0.75 - (e.type === 'tidecaller' ? s * 0.3 : e.type === 'leviathan' ? s * 0.1 : 0);
  if (e.hp < e.maxHp || d.boss) hpBar(c, e.x, ty, Math.max(26, s * 0.5), e.hp / e.maxHp, d.boss ? '#ff6b81' : '#7fe3a0');
  if (e.aground) { c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText('⚓', e.x, ty - 6); c.fillStyle = 'rgba(214,190,130,0.6)'; c.fillRect(e.x - s * 0.5, e.y + s * 0.16, s, 3); }
  const isF = g.focus === e.id; const hov = !!hover && hover.k === 'enemy' && hover.e === e;
  if (isF || hov) { c.strokeStyle = isF ? '#ffd166' : 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.setLineDash([6, 4]); c.lineDashOffset = -time * 20; c.beginPath(); c.ellipse(e.x, e.y - s * 0.2, s * 0.58, s * 0.42, 0, 0, 7); c.stroke(); c.setLineDash([]); }
  if (hov) { c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3; c.strokeText(d.name, e.x, ty - 10); c.fillText(d.name, e.x, ty - 10); }
}

function drawSelection(c: CanvasRenderingContext2D, g: Game, time: number, hover: Pick) {
  const sel = g.sel;
  if (hover && (hover.k === 'wall' || hover.k === 'keep' || hover.k === 'gate')) {
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
    if (hover.k === 'gate') { const y = g.gates[hover.i].sill; c.strokeRect(WALL_X0 - 2, y - 40, 44, 42); }
    else if (hover.k === 'wall') c.strokeRect(WALL_X0 - 2, g.wallTop - 10, 44, 290 - (g.wallTop - 300));
    else c.strokeRect(18, 120, 114, 144);
  }
  if (!sel) return;
  c.strokeStyle = '#ffd166'; c.lineWidth = 2.5; c.setLineDash([8, 5]); c.lineDashOffset = -time * 15;
  if (sel.k === 'gate') c.strokeRect(WALL_X0 - 3, g.gates[sel.i].sill - 41, 46, 44);
  else if (sel.k === 'wall') c.strokeRect(WALL_X0 - 3, g.wallTop - 10, 46, 290 - (g.wallTop - 300));
  else if (sel.k === 'keep') c.strokeRect(17, 118, 116, 146);
  c.setLineDash([]);
  const b = g.selB();
  if (sel.k === 'plot' && b && BDEFS[b.type].engine) {
    const p = PLOT_BY_ID[b.plot];
    const range = g.engRange(b);
    c.save(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.setLineDash([4, 6]);
    c.beginPath(); c.arc(p.x, p.y - 26, range, -Math.PI / 2 - 1.2, Math.PI / 2 + 1.2); c.stroke(); c.restore();
    if (b.type !== 'hydro' && p.floatY) {
      const y0 = p.floatY - 65; const y1 = p.floatY + 65;
      const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(127,227,160,0)'); gr.addColorStop(0.5, 'rgba(127,227,160,0.35)'); gr.addColorStop(1, 'rgba(127,227,160,0)');
      c.fillStyle = gr; c.fillRect(WALL_X1 + 4, y0, 520, y1 - y0);
      c.fillStyle = 'rgba(127,227,160,0.9)'; c.font = 'bold 11px sans-serif'; c.textAlign = 'left'; c.fillText('FLOAT BAND (engine charges fast here)', WALL_X1 + 100, p.floatY - 4);
    }
  }
  if (sel.k === 'plot' && !b) {
    const p = PLOT_BY_ID[sel.id]; c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.setLineDash([6, 4]); rr(c, p.x - 27, p.y - 60, 54, 62, 6); c.stroke(); c.setLineDash([]);
  }
  if (sel.k === 'plot' && b && !BDEFS[b.type].engine) {
    const p = PLOT_BY_ID[b.plot]; c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.setLineDash([6, 4]); rr(c, p.x - 29, p.y - 66, 58, 70, 6); c.stroke(); c.setLineDash([]);
  }
}
