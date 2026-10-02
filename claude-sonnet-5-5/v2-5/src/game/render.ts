import { BUILDINGS, ENEMIES, ITEMS, MAP_H, MAP_W } from './defs';
import type { Enemy, Game, Building, Item } from './engine';
import { DX, DY, SHIELD_R, STAB_R, SHIELD_MAX, isBelt } from './engine';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

interface Star {
  th: number;
  r: number;
  s: number;
  d: number;
  a: number;
}
const STARS: Star[] = [];
for (let i = 0; i < 160; i++) {
  STARS.push({ th: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * 1.1, s: 0.6 + Math.random() * 1.6, d: Math.random(), a: 0.2 + Math.random() * 0.7 });
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

function emoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  const k = size / 100;
  ctx.scale(k, k);
  ctx.font = `100px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 6);
  ctx.restore();
}

function hash(x: number, y: number, k: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, x: number, y: number, r = 0.13) {
  const def = ITEMS[it.t];
  ctx.fillStyle = def.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  switch (def.shape) {
    case 0:
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 1:
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case 2:
      ctx.moveTo(x, y - r * 1.3);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.3);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
      break;
    default:
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rad = r * 1.35;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        else ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

export function drawGame(g: Game, ctx: CanvasRenderingContext2D, w: number, h: number) {
  const S = g.S;
  const t = g.time;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, w, h);

  // rotating starfield (visualises the ring spin)
  const ang = t * 0.02 * g.spin * g.spinDirV;
  const R = Math.hypot(w, h) / 2;
  for (const s of STARS) {
    const th = s.th + ang * (0.6 + s.d * 0.8);
    const x = w / 2 + Math.cos(th) * s.r * R - g.cam.x * s.d * 6 * g.cam.zoom;
    const y = h / 2 + Math.sin(th) * s.r * R - g.cam.y * s.d * 6 * g.cam.zoom;
    ctx.fillStyle = `rgba(190,215,255,${s.a})`;
    ctx.fillRect(x, y, s.s, s.s);
  }

  ctx.save();
  ctx.translate(g.shakeX, g.shakeY);
  ctx.translate(w / 2 - g.cam.x * S, h / 2 - g.cam.y * S);
  ctx.scale(S, S);

  const x0 = Math.max(0, Math.floor(g.cam.x - w / 2 / S) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil(g.cam.x + w / 2 / S) + 1);
  const y0 = Math.max(0, Math.floor(g.cam.y - h / 2 / S) - 1);
  const y1 = Math.min(MAP_H - 1, Math.ceil(g.cam.y + h / 2 / S) + 1);

  // floor
  const grd = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
  grd.addColorStop(0, '#0e1727');
  grd.addColorStop(1, '#0a1220');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  if (S >= 12) {
    ctx.lineWidth = 1 / S;
    ctx.strokeStyle = 'rgba(120,160,220,0.07)';
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1 + 1);
    }
    for (let y = y0; y <= y1 + 1; y++) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1 + 1, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,180,255,0.13)';
    ctx.lineWidth = 2 / S;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / 6) * 6; x <= x1 + 1; x += 6) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1 + 1);
    }
    for (let y = Math.ceil(y0 / 6) * 6; y <= y1 + 1; y += 6) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1 + 1, y);
    }
    ctx.stroke();
  }
  // hazard frame
  ctx.save();
  ctx.lineWidth = 0.4;
  ctx.strokeStyle = '#1a2233';
  ctx.strokeRect(-0.2, -0.2, MAP_W + 0.4, MAP_H + 0.4);
  ctx.setLineDash([0.6, 0.6]);
  ctx.lineDashOffset = -t * 0.8 * g.spinDirV;
  ctx.strokeStyle = '#eab308';
  ctx.globalAlpha = 0.55;
  ctx.strokeRect(-0.2, -0.2, MAP_W + 0.4, MAP_H + 0.4);
  ctx.restore();

  // terrain
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const tr = g.terrain[y * MAP_W + x];
      if (!tr) continue;
      if (tr === 4) {
        ctx.fillStyle = '#273042';
        ctx.beginPath();
        ctx.moveTo(x + 0.1, y + 0.7);
        ctx.lineTo(x + 0.25, y + 0.15);
        ctx.lineTo(x + 0.7, y + 0.1);
        ctx.lineTo(x + 0.92, y + 0.6);
        ctx.lineTo(x + 0.5, y + 0.92);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3a455a';
        ctx.lineWidth = 0.04;
        ctx.stroke();
        continue;
      }
      const col = tr === 1 ? '#b5654a' : tr === 2 ? '#2bb89a' : '#7fd4f0';
      ctx.globalAlpha = 0.28 + 0.06 * Math.sin(t * 2 + x + y);
      ctx.fillStyle = col;
      rr(ctx, x + 0.04, y + 0.04, 0.92, 0.92, 0.15);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const px = x + 0.15 + hash(x, y, i) * 0.7;
        const py = y + 0.15 + hash(x, y, i + 9) * 0.7;
        ctx.fillStyle = i % 2 ? '#ffffff' : col;
        ctx.beginPath();
        ctx.arc(px, py, 0.05 + hash(x, y, i + 3) * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

  // belts
  const side = g.spinDirV >= 0 ? 1 : -1;
  const vis = (b: Building) => b.x + b.w >= x0 && b.x <= x1 && b.y + b.h >= y0 && b.y <= y1;
  const belts: Building[] = [];
  const machines: Building[] = [];
  for (const b of g.blds) {
    if (!vis(b)) continue;
    if (isBelt(b.kind)) belts.push(b);
    else machines.push(b);
  }
  for (const b of belts) {
    ctx.save();
    ctx.translate(b.x + 0.5, b.y + 0.5);
    if (b.kind === 'conveyor' || b.kind === 'rail') {
      ctx.rotate((b.dir * Math.PI) / 2);
      const rail = b.kind === 'rail';
      ctx.fillStyle = rail ? '#0f2d38' : '#1b2535';
      ctx.fillRect(-0.5, -0.5, 1, 1);
      ctx.strokeStyle = rail ? '#38d6ff' : '#3c4a60';
      ctx.lineWidth = rail ? 0.06 : 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.5, -0.42);
      ctx.lineTo(0.5, -0.42);
      ctx.moveTo(-0.5, 0.42);
      ctx.lineTo(0.5, 0.42);
      ctx.stroke();
      const sp = rail ? 2.6 : 1.7;
      const off = (t * sp) % 0.5;
      ctx.strokeStyle = rail ? 'rgba(120,230,255,0.55)' : 'rgba(150,175,205,0.35)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const x = -0.5 + off + i * 0.5;
        ctx.moveTo(x - 0.08, -0.16);
        ctx.lineTo(x + 0.08, 0);
        ctx.lineTo(x - 0.08, 0.16);
      }
      ctx.stroke();
      if (!rail) {
        const nh = (b.dir + (side > 0 ? 1 : 3)) & 3;
        const open = !g.at(b.x + DX[nh], b.y + DY[nh]);
        let maxLat = 0;
        for (const it of b.items) maxLat = Math.max(maxLat, Math.abs(it.lat));
        if ((g.overlay && open) || maxLat > 0.3) {
          const a = open ? 0.25 + maxLat * 1.2 : maxLat * 0.5;
          ctx.fillStyle = `rgba(248,113,113,${Math.min(0.9, a)})`;
          ctx.fillRect(-0.5, side > 0 ? 0.43 : -0.5, 1, 0.07);
        }
      }
    } else if (b.kind === 'junction') {
      ctx.fillStyle = '#231f3a';
      ctx.fillRect(-0.5, -0.5, 1, 1);
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.4, 0);
      ctx.lineTo(0.4, 0);
      ctx.moveTo(0, -0.4);
      ctx.lineTo(0, 0.4);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3a2d12';
      ctx.fillRect(-0.5, -0.5, 1, 1);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.arc(0, 0, 0.28, 0, Math.PI * 2);
      ctx.moveTo(-0.5, 0);
      ctx.lineTo(-0.28, 0);
      ctx.moveTo(0.28, 0);
      ctx.lineTo(0.5, 0);
      ctx.moveTo(0, -0.5);
      ctx.lineTo(0, -0.28);
      ctx.moveTo(0, 0.28);
      ctx.lineTo(0, 0.5);
      ctx.stroke();
    }
    if (b.hitT > 0 || b.hp < b.maxHp * 0.5) {
      ctx.fillStyle = b.hitT > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,60,40,0.15)';
      ctx.fillRect(-0.5, -0.5, 1, 1);
    }
    ctx.restore();
  }
  // belt items
  for (const b of belts) {
    for (const it of b.items) {
      const hd = it.p < 0.5 ? it.pd : it.d;
      const rd = (hd + 1) & 3;
      const px = b.x + 0.5 + DX[hd] * (it.p - 0.5) + DX[rd] * it.lat;
      const py = b.y + 0.5 + DY[hd] * (it.p - 0.5) + DY[rd] * it.lat;
      drawItem(ctx, it, px, py);
    }
  }

  // machines
  for (const b of machines) drawBuilding(g, ctx, b);

  // shield domes
  for (const b of machines) {
    if (b.kind !== 'shield') continue;
    const f = b.sh / SHIELD_MAX;
    ctx.save();
    const cx = b.x + 0.5;
    const cy = b.y + 0.5;
    const gr = ctx.createRadialGradient(cx, cy, SHIELD_R * 0.6, cx, cy, SHIELD_R);
    gr.addColorStop(0, 'rgba(103,232,249,0)');
    gr.addColorStop(1, `rgba(103,232,249,${0.05 + 0.18 * f})`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, SHIELD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = f > 0 ? `rgba(103,232,249,${0.25 + 0.35 * f})` : 'rgba(248,113,113,0.3)';
    ctx.lineWidth = 0.06;
    ctx.setLineDash([0.4, 0.3]);
    ctx.lineDashOffset = -t * 0.6;
    ctx.stroke();
    ctx.restore();
  }

  // meteors
  for (const m of g.meteors) {
    const p = 1 - m.t / 1.6;
    ctx.strokeStyle = `rgba(251,146,60,${0.3 + 0.4 * Math.sin(t * 14) ** 2})`;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 1.4 * (0.5 + p * 0.5), 0, Math.PI * 2);
    ctx.stroke();
    const k = m.t * 4;
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(m.x - k, m.y - k * 1.5);
    ctx.lineTo(m.x - k * 0.7, m.y - k * 1.05);
    ctx.stroke();
  }

  // projectiles
  ctx.globalCompositeOperation = 'lighter';
  for (const b of g.bullets) {
    const dx = Math.cos(b.a);
    const dy = Math.sin(b.a);
    ctx.strokeStyle = b.col;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(b.x - dx * 0.45, b.y - dy * 0.45);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const s of g.eshots) {
    ctx.fillStyle = s.col;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.big ? 0.16 : 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.big ? 0.32 : 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';

  // enemies
  for (const e of g.enemies) drawEnemy(g, ctx, e);

  // particles
  for (const p of g.parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.02 * (0.4 + a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const r of g.rings) {
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r * Math.sqrt(k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawOverlays(g, ctx);
  drawBorderWarnings(g, ctx);
  ctx.restore();

  // tints & HUD effects (screen space)
  if (g.sun < 0.999) {
    ctx.fillStyle = `rgba(6,10,50,${(1 - g.sun) * 0.32})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (g.emp > 0) {
    ctx.fillStyle = `rgba(103,232,249,${0.05 + Math.random() * 0.1})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
  }
  const hubF = g.hub.hp / g.hub.maxHp;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, hubF < 0.35 ? `rgba(120,0,0,${0.45 + 0.2 * Math.sin(t * 6)})` : 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // floating texts
  for (const f of g.texts) {
    const p = g.toScreen(f.x, f.y);
    const a = Math.min(1, (f.life / f.max) * 2);
    const sc = Math.max(0.8, Math.min(1.5, S / 34));
    const pop = 1 + Math.max(0, f.life / f.max - 0.8) * 2;
    ctx.globalAlpha = a;
    ctx.font = `bold ${f.size * sc * pop}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, p.x, p.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, f: number, col: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x, y, w, 0.09);
  ctx.fillStyle = col;
  ctx.fillRect(x + 0.01, y + 0.01, Math.max(0, (w - 0.02) * Math.min(1, f)), 0.07);
}

function drawBuilding(g: Game, ctx: CanvasRenderingContext2D, b: Building) {
  const def = BUILDINGS[b.kind];
  const t = g.time;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const pop = b.spawnT > 0 ? 1 + (b.spawnT / 0.3) * 0.25 : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  const hw = b.w / 2;
  const hh = b.h / 2;
  const hub = b.kind === 'hub';
  // body
  ctx.fillStyle = '#121a2a';
  rr(ctx, -hw + 0.07, -hh + 0.07, b.w - 0.14, b.h - 0.14, hub ? 0.4 : 0.14);
  ctx.fill();
  const pulse = b.working ? 0.14 + 0.1 * Math.sin(t * 6 + b.id) : 0.04;
  ctx.fillStyle = def.color;
  ctx.globalAlpha = pulse;
  rr(ctx, -hw + 0.07, -hh + 0.07, b.w - 0.14, b.h - 0.14, hub ? 0.4 : 0.14);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = hub ? 0.08 : 0.05;
  ctx.stroke();

  switch (b.kind) {
    case 'turret':
    case 'laser': {
      ctx.save();
      ctx.rotate(b.aim);
      ctx.fillStyle = b.kind === 'laser' ? '#fb7185' : '#f9a8d4';
      const len = 0.62 - b.recoil * 0.12;
      ctx.fillRect(0, -0.07, len, 0.14);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(len - 0.08, -0.04, 0.08, 0.08);
      ctx.restore();
      ctx.fillStyle = b.kind === 'laser' ? '#9f1239' : '#9d174d';
      ctx.beginPath();
      ctx.arc(0, 0, 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 0.04;
      ctx.stroke();
      if (b.kind === 'turret') bar(ctx, -0.35, 0.34, 0.7, (b.ammoP + b.ammoC) / 20, b.ammoC > 0 ? '#ffd84a' : '#e2e8f0');
      break;
    }
    case 'solar': {
      ctx.fillStyle = `rgb(${30 + g.sun * 40},${70 + g.sun * 90},${130 + g.sun * 110})`;
      ctx.fillRect(-0.34, -0.34, 0.68, 0.68);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.11, -0.34);
      ctx.lineTo(-0.11, 0.34);
      ctx.moveTo(0.11, -0.34);
      ctx.lineTo(0.11, 0.34);
      ctx.moveTo(-0.34, -0.11);
      ctx.lineTo(0.34, -0.11);
      ctx.moveTo(-0.34, 0.11);
      ctx.lineTo(0.34, 0.11);
      ctx.stroke();
      break;
    }
    case 'dynamo': {
      ctx.save();
      ctx.rotate(t * g.spin * 3 * g.spinDirV);
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.fillRect(0, -0.06, 0.34, 0.12);
      }
      ctx.restore();
      ctx.fillStyle = '#0c4a6e';
      ctx.beginPath();
      ctx.arc(0, 0, 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stabilizer': {
      ctx.save();
      ctx.rotate(-t * 2);
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.18, 0.12]);
      ctx.beginPath();
      ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      emoji(ctx, def.emoji, 0, 0, 0.36);
      break;
    }
    case 'battery': {
      const f = g.cap > 0 ? g.batt / g.cap : 0;
      emoji(ctx, def.emoji, 0, -0.05, 0.42);
      bar(ctx, -0.35, 0.3, 0.7, f, '#4ade80');
      break;
    }
    case 'reactor': {
      if (b.fuel > 0) {
        ctx.fillStyle = `rgba(163,230,53,${0.2 + 0.15 * Math.sin(t * 8)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, def.emoji, 0, -0.03, 0.5);
      bar(ctx, -0.35, 0.32, 0.7, b.fuel / 6, '#a3e635');
      break;
    }
    case 'shield': {
      emoji(ctx, def.emoji, 0, 0, 0.5);
      bar(ctx, -0.35, 0.34, 0.7, b.sh / SHIELD_MAX, '#67e8f9');
      break;
    }
    case 'hub': {
      ctx.save();
      ctx.rotate(t * 0.3 * g.spin * g.spinDirV);
      ctx.strokeStyle = 'rgba(125,249,255,0.6)';
      ctx.lineWidth = 0.06;
      ctx.setLineDash([0.3, 0.22]);
      ctx.beginPath();
      ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(125,249,255,0.25)';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.arc(0, 0, 0.85, 0, Math.PI * 2);
      ctx.stroke();
      emoji(ctx, def.emoji, 0, 0, 1.2);
      break;
    }
    default: {
      emoji(ctx, def.emoji, 0, -0.02, 0.52);
      if (b.working && b.prog > 0 && b.kind !== 'extractor') bar(ctx, -0.35, 0.34, 0.7, b.prog, def.color);
      if (b.kind === 'extractor') {
        ctx.strokeStyle = b.res === 1 ? '#c8795c' : b.res === 2 ? '#36d1b0' : '#9fe8ff';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(0, 0, 0.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.prog);
        ctx.stroke();
      }
      if (b.kind === 'centrifuge' && b.working) {
        ctx.strokeStyle = 'rgba(251,113,133,0.5)';
        ctx.lineWidth = 0.04;
        ctx.save();
        ctx.rotate(t * g.spin * 6);
        ctx.setLineDash([0.15, 0.15]);
        ctx.beginPath();
        ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  // output buffer pips
  if (b.outBuf.length) {
    for (let i = 0; i < b.outBuf.length; i++) {
      ctx.fillStyle = ITEMS[b.outBuf[i]].color;
      ctx.beginPath();
      ctx.arc(-hw + 0.2 + i * 0.16, -hh + 0.17, 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // status glyphs
  const needsPower = def.power > 0 && g.sat < 0.45 && g.time > 4;
  if (needsPower && Math.sin(t * 6) > -0.3) emoji(ctx, '⚡', hw - 0.2, -hh + 0.2, 0.3);
  if (b.blocked) emoji(ctx, '⛔', hw - 0.2, hh - 0.2, 0.26);
  if (b.hitT > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rr(ctx, -hw + 0.07, -hh + 0.07, b.w - 0.14, b.h - 0.14, 0.14);
    ctx.fill();
  }
  if (b.hp < b.maxHp) bar(ctx, -hw + 0.1, -hh - 0.1, b.w - 0.2, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#4ade80' : '#f87171');
  ctx.restore();
  // laser beam in world space
  if (b.kind === 'laser' && b.beam > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(251,113,133,0.8)';
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(b.beamX, b.beamY);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(g: Game, ctx: CanvasRenderingContext2D, e: Enemy) {
  const def = ENEMIES[e.type];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.ang);
  const col = e.flash > 0 ? '#ffffff' : def.color;
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  switch (e.type) {
    case 'skiff':
      ctx.moveTo(0.4, 0);
      ctx.lineTo(-0.3, 0.26);
      ctx.lineTo(-0.14, 0);
      ctx.lineTo(-0.3, -0.26);
      ctx.closePath();
      break;
    case 'raider':
      ctx.moveTo(0.55, 0);
      ctx.lineTo(0.1, 0.22);
      ctx.lineTo(-0.2, 0.52);
      ctx.lineTo(-0.38, 0.3);
      ctx.lineTo(-0.28, 0);
      ctx.lineTo(-0.38, -0.3);
      ctx.lineTo(-0.2, -0.52);
      ctx.lineTo(0.1, -0.22);
      ctx.closePath();
      break;
    case 'looter':
      ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
      break;
    case 'bomber':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 0.34 : 0.56;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case 'frigate':
      ctx.moveTo(0.95, 0);
      ctx.lineTo(0.5, 0.36);
      ctx.lineTo(-0.7, 0.4);
      ctx.lineTo(-0.9, 0.2);
      ctx.lineTo(-0.9, -0.2);
      ctx.lineTo(-0.7, -0.4);
      ctx.lineTo(0.5, -0.36);
      ctx.closePath();
      break;
    default:
      ctx.moveTo(1.9, 0);
      ctx.lineTo(0.9, 0.7);
      ctx.lineTo(0.2, 1.5);
      ctx.lineTo(-0.9, 1.7);
      ctx.lineTo(-1.1, 0.8);
      ctx.lineTo(-1.8, 0.6);
      ctx.lineTo(-1.8, -0.6);
      ctx.lineTo(-1.1, -0.8);
      ctx.lineTo(-0.9, -1.7);
      ctx.lineTo(0.2, -1.5);
      ctx.lineTo(0.9, -0.7);
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  // cockpit / core details
  if (e.flash <= 0) {
    ctx.fillStyle = e.type === 'bomber' ? `rgba(255,${80 + 80 * Math.sin(g.time * 10)},60,1)` : 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(e.type === 'dread' ? 0.6 : 0.1, 0, e.type === 'dread' ? 0.35 : e.type === 'bomber' ? 0.16 : 0.09, 0, Math.PI * 2);
    ctx.fill();
    if (e.type === 'looter') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(0.3, 0);
      ctx.lineTo(0.55, 0);
      ctx.lineTo(0.55, 0.15);
      ctx.stroke();
    }
  }
  ctx.restore();
  // engine glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = def.color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(e.x - Math.cos(e.ang) * def.r * 0.9, e.y - Math.sin(e.ang) * def.r * 0.9, def.r * 0.3 * (0.8 + 0.4 * Math.sin(g.time * 20 + e.id)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (e.shield > 0) {
    ctx.strokeStyle = `rgba(103,232,249,${0.2 + 0.5 * (e.shield / Math.max(1, e.maxShield))})`;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(e.x, e.y, def.r * 1.2 + 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.charge > 0) {
    const k = 1 - e.charge / 1.8;
    ctx.strokeStyle = `rgba(103,232,249,${0.4 + 0.5 * k})`;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 3 * (1 - k) + 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.hp < e.maxHp) {
    const bw = Math.max(0.8, def.r * 2);
    bar(ctx, e.x - bw / 2, e.y - def.r - 0.35, bw, e.hp / e.maxHp, '#f87171');
  }
  if (e.carry > 0) {
    ctx.fillStyle = '#facc15';
    emoji(ctx, '💰', e.x, e.y + def.r + 0.45, 0.4);
  }
}

function drawOverlays(g: Game, ctx: CanvasRenderingContext2D) {
  const t = g.time;
  const tool = g.tool;
  const hx = g.hoverTx;
  const hy = g.hoverTy;
  const inb = hx >= 0 && hy >= 0 && hx < MAP_W && hy < MAP_H;
  // selected highlight
  const sel = g.selected;
  if (sel && g.bmap.has(sel.id)) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    ctx.setLineDash([0.2, 0.15]);
    ctx.lineDashOffset = -t;
    rr(ctx, sel.x - 0.04, sel.y - 0.04, sel.w + 0.08, sel.h + 0.08, 0.15);
    ctx.stroke();
    ctx.restore();
    ranges(ctx, sel, 0.5);
  }
  if (!inb) return;
  if (tool === 'erase') {
    const b = g.at(hx, hy);
    ctx.strokeStyle = 'rgba(248,113,113,0.9)';
    ctx.lineWidth = 0.07;
    const bx = b ? b.x : hx;
    const by = b ? b.y : hy;
    rr(ctx, bx, by, b ? b.w : 1, b ? b.h : 1, 0.12);
    ctx.stroke();
    return;
  }
  if (tool === 'select') {
    const b = g.at(hx, hy);
    if (b) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.04;
      rr(ctx, b.x, b.y, b.w, b.h, 0.12);
      ctx.stroke();
    }
    return;
  }
  const def = BUILDINGS[tool];
  const err = g.ghostErr;
  const ok = !err;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ok ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.4)';
  rr(ctx, hx, hy, def.w, def.h, 0.12);
  ctx.fill();
  ctx.strokeStyle = ok ? '#4ade80' : '#f87171';
  ctx.lineWidth = 0.05;
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  if (tool === 'conveyor' || tool === 'rail') {
    // direction arrow
    ctx.save();
    ctx.translate(hx + 0.5, hy + 0.5);
    ctx.rotate((g.rot * Math.PI) / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0.3, 0);
    ctx.lineTo(-0.15, 0.22);
    ctx.lineTo(-0.15, -0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Coriolis drift preview
    const rate = tool === 'rail' ? 0 : g.driftRate;
    const hd = g.rot;
    const rd = (hd + 1) & 3;
    const maxK = Math.min(40, (Math.abs(rate) > 1e-4 ? 0.5 / Math.abs(rate) : 30) * 1.5 + 2);
    ctx.setLineDash([0.12, 0.1]);
    ctx.strokeStyle = 'rgba(125,211,252,0.9)';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    let leak = -1;
    for (let k = 0; k <= maxK; k += 0.25) {
      const lat = rate * k;
      const px = hx + 0.5 + DX[hd] * k + DX[rd] * lat;
      const py = hy + 0.5 + DY[hd] * k + DY[rd] * lat;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      if (leak < 0 && Math.abs(lat) >= 0.5) leak = k;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (leak >= 0) {
      const lat = rate * leak;
      const px = hx + 0.5 + DX[hd] * leak + DX[rd] * lat;
      const py = hy + 0.5 + DY[hd] * leak + DY[rd] * lat;
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(px - 0.25, py - 0.25);
      ctx.lineTo(px + 0.25, py + 0.25);
      ctx.moveTo(px + 0.25, py - 0.25);
      ctx.lineTo(px - 0.25, py + 0.25);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff';
    emoji(ctx, def.emoji, hx + def.w / 2, hy + def.h / 2, 0.5 * def.w);
    ranges(ctx, { kind: tool, x: hx, y: hy, w: def.w, h: def.h } as Building, 0.9);
  }
  ctx.restore();
}

function ranges(ctx: CanvasRenderingContext2D, b: { kind: string; x: number; y: number; w: number; h: number }, a: number) {
  const r = b.kind === 'turret' ? 6.5 : b.kind === 'laser' ? 5.4 : b.kind === 'shield' ? SHIELD_R : b.kind === 'stabilizer' ? STAB_R : 0;
  if (!r) return;
  ctx.save();
  ctx.globalAlpha = a * 0.7;
  ctx.strokeStyle = b.kind === 'stabilizer' ? '#5eead4' : b.kind === 'shield' ? '#67e8f9' : '#f472b6';
  ctx.lineWidth = 0.05;
  ctx.setLineDash([0.25, 0.2]);
  ctx.beginPath();
  ctx.arc(b.x + b.w / 2, b.y + b.h / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBorderWarnings(g: Game, ctx: CanvasRenderingContext2D) {
  const soon = g.waveTimer < 14 && g.tutStep < 0 && !g.bossWave;
  const active = g.waveActive;
  if (!soon && !active) return;
  const pulse = 0.35 + 0.35 * Math.sin(g.time * 7);
  const edges = g.plan.edges;
  if (!soon) return;
  ctx.save();
  ctx.strokeStyle = `rgba(248,113,113,${pulse})`;
  ctx.lineWidth = 0.5;
  for (const e of edges) {
    ctx.beginPath();
    if (e === 0) {
      ctx.moveTo(0, -0.35);
      ctx.lineTo(MAP_W, -0.35);
    } else if (e === 2) {
      ctx.moveTo(0, MAP_H + 0.35);
      ctx.lineTo(MAP_W, MAP_H + 0.35);
    } else if (e === 1) {
      ctx.moveTo(MAP_W + 0.35, 0);
      ctx.lineTo(MAP_W + 0.35, MAP_H);
    } else {
      ctx.moveTo(-0.35, 0);
      ctx.lineTo(-0.35, MAP_H);
    }
    ctx.stroke();
  }
  ctx.restore();
}
