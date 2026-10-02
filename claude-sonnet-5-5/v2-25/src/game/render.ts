import { TILE, COLS, ROWS, WW, WH, SPECIES, BUILDINGS, SPELLS } from './data';
import type { Game, Building } from './engine';

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ground: { seed: number; canvas: HTMLCanvasElement } | null = null;

function bakeGround(seed: number) {
  const c = document.createElement('canvas');
  c.width = WW; c.height = WH;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const r = mulberry(seed);
  const grad = g.createLinearGradient(0, 0, WW, WH);
  grad.addColorStop(0, '#1d2622'); grad.addColorStop(0.5, '#18201f'); grad.addColorStop(1, '#1b221f');
  g.fillStyle = grad; g.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 2600; i++) {
    const x = r() * WW, y = r() * WH;
    const k = r();
    g.fillStyle = k < 0.4 ? 'rgba(70,95,70,0.35)' : k < 0.7 ? 'rgba(40,55,48,0.5)' : 'rgba(110,100,80,0.18)';
    g.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2);
  }
  // dirt paths from the edges toward the necropolis
  g.lineCap = 'round';
  const cx = 540, cy = 340;
  const ends: [number, number][] = [[0, 150 + r() * 400], [WW, 150 + r() * 400], [200 + r() * 700, 0], [200 + r() * 700, WH]];
  for (const [ex, ey] of ends) {
    for (const [w, col] of [[34, 'rgba(60,48,36,0.55)'], [20, 'rgba(78,62,46,0.5)']] as [number, string][]) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(ex, ey);
      g.quadraticCurveTo((ex + cx) / 2 + (r() - 0.5) * 220, (ey + cy) / 2 + (r() - 0.5) * 220, cx, cy);
      g.stroke();
    }
  }
  // grass tufts
  for (let i = 0; i < 260; i++) {
    const x = r() * WW, y = r() * WH;
    g.strokeStyle = 'rgba(90,130,80,0.45)'; g.lineWidth = 1;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 2, y); g.lineTo(x + k * 3, y - 4 - r() * 4); g.stroke(); }
  }
  // tombstones
  for (let i = 0; i < 46; i++) {
    const x = 20 + r() * (WW - 40), y = 24 + r() * (WH - 40);
    const w = 11 + r() * 6, h = 14 + r() * 8;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 3, y + h / 2 + 1, w / 2 + 3, 3, 0, 0, 6.3); g.fill();
    g.fillStyle = r() < 0.5 ? '#59605e' : '#4a5150';
    g.beginPath(); g.moveTo(x - w / 2, y + h / 2); g.lineTo(x - w / 2, y - h / 4); g.arc(x, y - h / 4, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y + h / 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,25,25,0.7)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y - h / 3); g.lineTo(x, y + h / 6); g.moveTo(x - 3, y - h / 8); g.lineTo(x + 3, y - h / 8); g.stroke();
  }
  // dead trees
  for (let i = 0; i < 12; i++) {
    const x = r() * WW, y = 40 + r() * (WH - 40);
    g.strokeStyle = '#2b2622'; g.lineWidth = 3;
    const br = (bx: number, by: number, a: number, len: number, d: number) => {
      if (d > 3) return;
      const nx = bx + Math.cos(a) * len, ny = by + Math.sin(a) * len;
      g.lineWidth = Math.max(1, 4 - d); g.beginPath(); g.moveTo(bx, by); g.lineTo(nx, ny); g.stroke();
      br(nx, ny, a - 0.5 - r() * 0.3, len * 0.7, d + 1);
      br(nx, ny, a + 0.5 + r() * 0.3, len * 0.7, d + 1);
    };
    br(x, y, -Math.PI / 2, 18, 0);
  }
  return c;
}

function emoji(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, col: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, v)) * w, h);
}

const easeOutBack = (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

const SHIFT_COL = { day: '#ffd36b', night: '#6b9bff', round: '#c58bff' } as const;

export function renderGame(g: Game, ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dpr: number, now: number) {
  const scale = Math.min(cssW / WW, cssH / WH);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, cssW, cssH);
  const ox = (cssW - WW * scale) / 2, oy = (cssH - WH * scale) / 2;
  const sh = g.shake;
  ctx.save();
  ctx.translate(ox + (sh ? (Math.random() - 0.5) * sh * scale : 0), oy + (sh ? (Math.random() - 0.5) * sh * scale : 0));
  ctx.scale(scale, scale);
  ctx.beginPath(); ctx.rect(-30, -30, WW + 60, WH + 60); ctx.clip();

  if (!ground || ground.seed !== g.decorSeed) ground = { seed: g.decorSeed, canvas: bakeGround(g.decorSeed) };
  ctx.drawImage(ground.canvas, 0, 0);
  const t = now / 1000;
  const sun = g.effSun;

  // ----- haunted sites -----
  for (const s of g.sites) {
    const hz = s.state === 'haunted';
    const pulse = 0.5 + 0.5 * Math.sin(s.pulse * 2);
    const grd = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r + 10);
    grd.addColorStop(0, hz ? `rgba(120,255,230,${0.22 + pulse * 0.1})` : 'rgba(255,240,170,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 10, 0, 6.3); ctx.fill();
    ctx.strokeStyle = hz ? 'rgba(127,227,212,0.7)' : 'rgba(255,240,170,0.6)';
    ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 10;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = s.pulse * 0.3 + (i * 4 * Math.PI) / 5; const px = s.x + Math.cos(a) * (s.r - 14), py = s.y + Math.sin(a) * (s.r - 14); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.stroke();
    emoji(ctx, hz ? '🕯️' : '✝️', s.x, s.y, 20, hz ? 0.8 : 0.9);
    if (s.prog > 0 && hz) {
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6, -Math.PI / 2, -Math.PI / 2 + s.prog * 6.283); ctx.stroke();
    }
    if (g.sel.kind === 'site' && g.sites[g.sel.id] === s) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 12, 0, 6.3); ctx.stroke(); }
  }

  // ----- build grid overlay -----
  if (g.tool && g.tool !== 'demolish') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, WH); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * TILE); ctx.lineTo(WW, r * TILE); }
    ctx.stroke();
  }

  // ----- zones (bone storm) -----
  for (const z of g.zones) {
    const a = Math.min(1, (z.max - z.t) * 2);
    const grd = ctx.createRadialGradient(z.x, z.y, 5, z.x, z.y, z.r);
    grd.addColorStop(0, `rgba(232,226,207,${0.25 * a})`); grd.addColorStop(1, `rgba(120,200,180,${0.05 * a})`);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = `rgba(232,226,207,${0.7 * a})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
  }

  // ----- buildings -----
  const sorted = [...g.buildings].sort((a, b) => a.y - b.y);
  const selB = g.sel.kind === 'building' ? g.bById(g.sel.id) : undefined;
  for (const b of sorted) drawBuilding(ctx, g, b, t, b === selB, sun);

  // range rings
  for (const b of g.buildings) {
    const show = b === selB || ((b.def.kind === 'ward') && b.active) || (g.tool && (b.def.kind === 'turret' || b.def.kind === 'ward'));
    if (!show || !b.radius) continue;
    ctx.strokeStyle = b.def.kind === 'ward' ? 'rgba(143,184,255,0.45)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    if (b.def.kind === 'ward' && b.active) {
      ctx.fillStyle = 'rgba(143,184,255,0.06)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, 6.3); ctx.fill();
    }
  }
  if (selB && selB.def.kind === 'aura') {
    ctx.strokeStyle = 'rgba(255,211,107,0.4)'; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(selB.x, selB.y, 220, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
  }

  // ----- selection link -----
  const selW = g.sel.kind === 'worker' ? g.wById(g.sel.id) : undefined;
  if (selW) {
    const jb = g.bById(selW.pin ?? selW.job);
    if (jb) {
      ctx.strokeStyle = selW.pin != null ? 'rgba(127,227,212,0.8)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.moveTo(selW.x, selW.y); ctx.lineTo(jb.x, jb.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ----- hazards -----
  for (const h of g.hazards) {
    const p = h.t / h.max;
    const col = h.kind === 'smite' ? '255,224,138' : '179,107,255';
    ctx.fillStyle = `rgba(${col},${0.08 + p * 0.25})`;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * p, 0, 6.3); ctx.stroke();
    if (h.kind === 'smite') { ctx.fillStyle = `rgba(255,255,220,${p * 0.6})`; ctx.fillRect(h.x - 6 * p, h.y - 400, 12 * p, 400); }
  }

  // ----- actors (sorted by y) -----
  type Act = { y: number; draw: () => void };
  const acts: Act[] = [];
  for (const w of g.workers) {
    if (w.inside !== null) continue;
    acts.push({ y: w.y, draw: () => drawWorker(ctx, g, w, t, w === selW) });
  }
  for (const m of g.militia) acts.push({ y: m.y, draw: () => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 9, 9, 3.5, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = m.flash > 0 ? '#fff' : '#2a4a3a'; ctx.strokeStyle = '#7bff9e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, 6.3); ctx.fill(); ctx.stroke();
    emoji(ctx, '💀', m.x, m.y + 1, 12);
    bar(ctx, m.x - 8, m.y - 15, 16, 2.5, m.life / 25, '#7bff9e');
  } });
  for (const e of g.enemies) {
    acts.push({ y: e.y, draw: () => {
      const d = e.def;
      const sc = easeOutBack(Math.min(1, e.spawnT));
      const r = d.r * sc;
      const bob = Math.sin(e.wobble) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r * 0.9, r * 0.35, 0, 0, 6.3); ctx.fill();
      if (d.boss) {
        const grd = ctx.createRadialGradient(e.x, e.y, r * 0.5, e.x, e.y, r * 2.6);
        grd.addColorStop(0, d.id === 'inquisitor' ? 'rgba(255,224,138,0.5)' : 'rgba(179,107,255,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(e.x, e.y, r * 2.6, 0, 6.3); ctx.fill();
      }
      if (e.slow < 1) { ctx.strokeStyle = 'rgba(143,184,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, 6.3); ctx.stroke(); }
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : d.team === 'zealot' ? '#4a4030' : '#24402e';
      ctx.strokeStyle = d.color; ctx.lineWidth = d.boss ? 3.5 : 2;
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, r, 0, 6.3); ctx.fill(); ctx.stroke();
      if (d.armor > 0.2) { ctx.strokeStyle = 'rgba(200,220,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y + bob, r + 2.5, 0, 6.3); ctx.stroke(); }
      emoji(ctx, d.icon, e.x, e.y + bob + 1, r * 1.35);
      if (e.hp < e.maxHp || d.boss) bar(ctx, e.x - r, e.y - r - 8, r * 2, 3.5, e.hp / e.maxHp, d.team === 'zealot' ? '#ffd36b' : '#6bff9e');
      if (e.blocker) emoji(ctx, '💥', e.blocker.x, e.blocker.y - 4, 14, 0.8);
      if (d.id === 'priest') { ctx.strokeStyle = 'rgba(255,243,176,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, 100, 0, 6.3); ctx.stroke(); }
    } });
  }
  acts.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

  // ----- projectiles -----
  for (const p of g.projs) {
    ctx.fillStyle = p.color;
    if (p.kind === 'arrow') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = '#e8e2cf'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); ctx.lineTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5); ctx.stroke();
    } else {
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'nova' ? 5 : 3.6, 0, 6.3); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ----- particles -----
  for (const p of g.parts) {
    const k = Math.max(0, p.life / p.max);
    switch (p.kind) {
      case 'bone':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size * 0.7); ctx.restore(); ctx.globalAlpha = 1; break;
      case 'smoke':
        ctx.globalAlpha = k * 0.35; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'soul': case 'wisp':
        ctx.globalAlpha = Math.min(1, k * 1.5) * 0.9; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; break;
      case 'note':
        ctx.fillStyle = p.color; emoji(ctx, '♪', p.x, p.y, p.size * 2.2, k); break;
      default:
        ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // ----- lighting / time of day -----
  const night = 1 - sun;
  if (g.sunFx.eclipse > 0) { ctx.fillStyle = 'rgba(30,5,50,0.35)'; ctx.fillRect(0, 0, WW, WH); }
  ctx.fillStyle = `rgba(8,10,40,${0.52 * night})`;
  ctx.fillRect(0, 0, WW, WH);
  const twil = Math.max(0, 1 - Math.abs(sun - 0.5) * 3.2);
  if (twil > 0) { ctx.fillStyle = `rgba(255,110,60,${0.14 * twil})`; ctx.fillRect(0, 0, WW, WH); }
  if (g.sunFx.radiance > 0) { ctx.fillStyle = `rgba(255,245,200,${0.16 + 0.06 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, WW, WH); }
  if (night > 0.15) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.buildings) {
      if (b.def.kind === 'wall') continue;
      const rad = b.w * 1.1 + 24;
      const grd = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, rad);
      const col = b.def.kind === 'ward' || b.def.id === 'altar' ? '80,150,255' : b.def.kind === 'core' ? '170,120,255' : '255,170,80';
      grd.addColorStop(0, `rgba(${col},${0.22 * night})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, 6.3); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const vg = ctx.createRadialGradient(WW / 2, WH / 2, WH * 0.35, WW / 2, WH / 2, WW * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, WW, WH);

  // ----- raid warnings -----
  for (const r of g.raids) {
    const active = (r.warned && !r.spawned) || (r.spawned && g.time < r.spawnAt + 5);
    if (!active) continue;
    const left = Math.max(0, r.spawnAt - g.time);
    const pul = 0.5 + 0.5 * Math.sin(t * 8);
    for (const s of r.sides) {
      let x = Math.max(34, Math.min(WW - 34, s.x)), y = Math.max(34, Math.min(WH - 34, s.y));
      if (s.dir === 'W') x = 34; if (s.dir === 'E') x = WW - 34; if (s.dir === 'N') y = 34; if (s.dir === 'S') y = WH - 34;
      const col = r.team === 'zealot' ? '255,211,107' : '123,255,158';
      const grd = ctx.createRadialGradient(x, y, 4, x, y, 70);
      grd.addColorStop(0, `rgba(${col},${0.3 + pul * 0.25})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, 70, 0, 6.3); ctx.fill();
      emoji(ctx, r.team === 'zealot' ? '⚠️' : '☠️', x, y - 4, 24 + pul * 4);
      ctx.fillStyle = `rgb(${col})`; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(left > 0 ? `${Math.ceil(left)}s` : 'NOW', x, y + 22);
    }
  }

  // ----- floating text -----
  for (const f of g.texts) {
    const k = f.life / f.max;
    const pop = k > 0.85 ? 1 + (k - 0.85) * 4 : 1;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.font = `bold ${f.size * pop}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(f.str, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.str, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  // ----- placement ghost / spell targeting -----
  if (g.mouse.inside && !g.paused) {
    if (g.tool && g.tool !== 'demolish') {
      const def = BUILDINGS[g.tool];
      const { col, row } = g.tileFor(g.tool, g.mouse.x, g.mouse.y);
      const err = g.canPlace(g.tool, col, row);
      const px = col * TILE, py = row * TILE, sz = def.size * TILE;
      ctx.fillStyle = err ? 'rgba(255,80,80,0.35)' : 'rgba(120,255,180,0.28)';
      ctx.strokeStyle = err ? '#ff6b6b' : '#7bff9e'; ctx.lineWidth = 2;
      rr(ctx, px + 1, py + 1, sz - 2, sz - 2, 6); ctx.fill(); ctx.stroke();
      emoji(ctx, def.icon, px + sz / 2, py + sz / 2, Math.min(40, sz * 0.5), 0.85);
      const rad = def.kind === 'turret' ? 250 : def.kind === 'ward' ? 150 : def.kind === 'aura' ? 220 : 0;
      if (rad) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(px + sz / 2, py + sz / 2, rad, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); }
      for (const s of g.sites) if (s.state === 'haunted' && Math.hypot(s.x - (px + sz / 2), s.y - (py + sz / 2)) < s.r + sz / 2) { ctx.fillStyle = '#7fe3d4'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('Haunted bonus +40%', px + sz / 2, py - 10); }
    } else if (g.tool === 'demolish') {
      const b = g.buildingAt(g.mouse.x, g.mouse.y);
      if (b) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; rr(ctx, b.x - b.w / 2, b.y - b.w / 2, b.w, b.w, 6); ctx.stroke(); }
    }
    if (g.targeting) {
      const sp = SPELLS.find((s) => s.id === g.targeting);
      const rad = sp ? sp.radius : 40;
      ctx.strokeStyle = '#b78cff'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(g.mouse.x, g.mouse.y, rad, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(183,140,255,0.12)'; ctx.fill();
      emoji(ctx, sp ? sp.icon : '✨', g.mouse.x, g.mouse.y, 22);
    }
  }
  ctx.restore();
  if (g.screenFlash > 0) {
    ctx.globalAlpha = Math.min(0.6, g.screenFlash);
    ctx.fillStyle = g.flashColor; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1;
  }
  void Math;
}

function drawBuilding(ctx: CanvasRenderingContext2D, g: Game, b: Building, t: number, selected: boolean, sun: number) {
  const def = b.def;
  const k = easeOutBack(b.pop);
  const half = (b.w / 2) * k;
  const x = b.x - half, y = b.y - half, w = half * 2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, x + 3, y + 5, w, w, 8); ctx.fill();
  // body
  const grd = ctx.createLinearGradient(x, y, x, y + w);
  grd.addColorStop(0, def.color); grd.addColorStop(1, '#17151c');
  ctx.fillStyle = b.flash > 0 ? '#ffffff' : grd;
  rr(ctx, x, y, w, w, def.kind === 'wall' ? 4 : 8); ctx.fill();
  ctx.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.6)';
  ctx.lineWidth = selected ? 3 : 2;
  rr(ctx, x, y, w, w, def.kind === 'wall' ? 4 : 8); ctx.stroke();
  if (selected) { ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 6; rr(ctx, x - 3, y - 3, w + 6, w + 6, 10); ctx.stroke(); }
  if (b.haunt > 1 && def.kind !== 'core') { ctx.strokeStyle = 'rgba(127,227,212,0.7)'; ctx.lineWidth = 2; rr(ctx, x + 2, y + 2, w - 4, w - 4, 7); ctx.stroke(); }
  const isz = def.kind === 'core' ? 58 : def.size === 1 ? 24 : 34;
  const working = b.working && (def.kind === 'prod' || def.kind === 'pit' || def.kind === 'aura');
  const bounce = working ? Math.sin(t * 10) * 1.5 : 0;
  emoji(ctx, def.icon, b.x, b.y + bounce - (def.size > 1 ? 2 : 0), isz * k);
  if (b.fire > 0) emoji(ctx, '🔥', b.x + b.w / 4, b.y - b.w / 4 + Math.sin(t * 12) * 2, 22);
  // hp bar
  if (b.hp < b.maxHp - 0.5) bar(ctx, x + 3, y - 7, w - 6, 4, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#7bff9e' : '#ff6b6b');
  // progress
  if (def.kind === 'prod' && b.active) bar(ctx, x + 6, y + w - 9, w - 12, 5, b.progress / def.cycle, '#f2c14e');
  if (def.kind === 'pit' && b.queue.length) {
    const need = SPECIES[b.queue[0]].raise;
    bar(ctx, x + 6, y + w - 9, w - 12, 5, b.progress / need, '#b78cff');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${SPECIES[b.queue[0]].icon} ×${b.queue.length}`, b.x, y + 10);
  }
  if (def.kind === 'aura' && b.active) { ctx.strokeStyle = `rgba(255,211,107,${0.3 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 38 + (t * 20) % 30, 0, 6.3); ctx.stroke(); }
  if (def.kind === 'house' || def.kind === 'core') {
    const cap = g.housingOf(b);
    for (let i = 0; i < cap; i++) {
      ctx.fillStyle = i < b.inside.length ? '#b78cff' : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(x + 9 + i * 9, y + w - 8, 3.2, 0, 6.3); ctx.fill();
    }
  }
  // crew pips
  if (def.slots > 0) {
    for (let i = 0; i < def.slots; i++) {
      const has = i < b.crew.length;
      ctx.fillStyle = has ? '#7fe3d4' : 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x + w - 8 - i * 9, y + 8, 3.4, 0, 6.3); ctx.fill(); ctx.stroke();
    }
  }
  // status bubble
  const status = b.stalled && b.stalled !== 'idle' ? b.stalled : b.warn;
  if (status && (def.kind !== 'turret' && def.kind !== 'ward' ? true : b.crew.length > 0 || status === 'unmanned')) {
    const label = status === 'unmanned' ? '⚠ no crew' : `⚠ ${status}`;
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(20,10,10,0.82)'; rr(ctx, b.x - tw / 2, y - 22, tw, 16, 6); ctx.fill();
    ctx.fillStyle = status === 'unmanned' ? '#ffb86b' : '#ff8f8f'; ctx.fillText(label, b.x, y - 14);
  }
  void sun;
}

function drawWorker(ctx: CanvasRenderingContext2D, g: Game, w: import('./engine').Worker, t: number, selected: boolean) {
  const sp = SPECIES[w.species];
  const r = w.species === 'golem' ? 14 : 11;
  const walking = w.state === 'moving' || w.state === 'fleeing';
  const bob = walking ? Math.abs(Math.sin(t * 12 + w.bob)) * -3 : w.state === 'working' ? Math.sin(t * 9 + w.bob) * 1.2 : 0;
  const ghostly = w.species === 'wraith' ? 0.55 + 0.2 * Math.sin(t * 3 + w.bob) : 1;
  const dayFade = w.species === 'wraith' ? Math.max(0.25, 1 - g.effSun * 0.7) : 1;
  ctx.globalAlpha = ghostly * dayFade;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(w.x, w.y + r * 0.85, r * 0.9, r * 0.33, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = w.flash > 0 ? '#ffffff' : '#242330';
  ctx.strokeStyle = SHIFT_COL[w.shift]; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(w.x, w.y + bob, r, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = sp.color; ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(w.x, w.y + bob, r - 2, 0, 6.3); ctx.fill(); ctx.globalAlpha = ghostly * dayFade;
  emoji(ctx, sp.icon, w.x, w.y + bob + 1, r * 1.3);
  ctx.globalAlpha = 1;
  if (w.integrity < w.maxInt - 1) bar(ctx, w.x - 9, w.y - r - 7, 18, 3, w.integrity / w.maxInt, w.integrity < 25 ? '#ff6b6b' : '#7bff9e');
  if (w.strike) emoji(ctx, '😠', w.x, w.y - r - 14, 13);
  else if (w.repairing) emoji(ctx, '🔧', w.x, w.y - r - 14, 12);
  else if (w.morale < 25) emoji(ctx, '😟', w.x, w.y - r - 14, 12);
  if (w.pin != null) { ctx.fillStyle = '#7fe3d4'; ctx.beginPath(); ctx.arc(w.x + r, w.y - r, 3, 0, 6.3); ctx.fill(); }
  if (w.state === 'fighting') emoji(ctx, '⚔️', w.x + w.face * 14, w.y - 6, 12);
  if (selected) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.arc(w.x, w.y + bob, r + 6, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
  }
}
