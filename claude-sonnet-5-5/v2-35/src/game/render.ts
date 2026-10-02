import { Battle, type BUnit, type Tile } from './battle';
import { CLASSES, ENEMIES, type Terrain } from './data';
import { SQRT3, key } from './hex';

const TCOL: Record<Terrain, string> = {
  plain: '#67864f',
  forest: '#33603d',
  hill: '#8b7b55',
  mountain: '#6d7079',
  water: '#2a5f93',
  chasm: '#0b0912',
  fault: '#7b6a58',
  ash: '#413d3d',
  bridge: '#8a6a3e',
};

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = x + s * Math.cos(a);
    const py = y + s * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function renderBattle(ctx: CanvasRenderingContext2D, b: Battle, W: number, H: number) {
  const pad = 8;
  const mapW = SQRT3 * (b.w + 0.5);
  const mapH = 1.5 * (b.h - 1) + 2;
  const size = Math.max(10, Math.min((W - pad * 2) / mapW, (H - pad * 2) / mapH));
  const ox = (W - mapW * size) / 2 + (SQRT3 / 2) * size;
  const oy = (H - mapH * size) / 2 + size;
  b.view = { size, ox, oy };
  const t = b.time;

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12101c');
  bg.addColorStop(1, '#1d1a2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (b.shakeAmt > 0) ctx.translate((Math.random() - 0.5) * b.shakeAmt, (Math.random() - 0.5) * b.shakeAmt);
  const P = (c: number, r: number) => {
    const p = b.px(c, r);
    return { x: ox + p.x * size, y: oy + p.y * size };
  };

  // tiles
  for (let r = 0; r < b.h; r++)
    for (let c = 0; c < b.w; c++) drawTile(ctx, b, b.tile(c, r), P(c, r), size, t);

  // supply overlay
  if (b.showSupply) {
    ctx.save();
    b.supplySet.forEach((k) => {
      const c = k % 64;
      const r = Math.floor(k / 64);
      const p = P(c, r);
      hexPath(ctx, p.x, p.y, size * 0.96);
      ctx.fillStyle = 'rgba(120,255,170,0.07)';
      ctx.fill();
    });
    ctx.setLineDash([size * 0.12, size * 0.14]);
    ctx.lineDashOffset = -t * size * 0.4;
    for (const u of b.units) {
      if (u.dead || u.team !== 'player' || !u.supplied) continue;
      let k = key(u.c, u.r);
      const sel = b.selected === u;
      ctx.strokeStyle = sel ? 'rgba(140,255,180,0.85)' : 'rgba(140,255,180,0.28)';
      ctx.lineWidth = sel ? size * 0.07 : size * 0.045;
      ctx.beginPath();
      let first = true;
      let guard = 0;
      while (k !== -1 && k !== undefined && guard++ < 40) {
        const p = P(k % 64, Math.floor(k / 64));
        if (first) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        first = false;
        k = b.supplyParent.get(k) ?? -1;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // threat overlay
  if (b.showThreat) {
    b.threat.forEach((k) => {
      const p = P(k % 64, Math.floor(k / 64));
      hexPath(ctx, p.x, p.y, size * 0.94);
      ctx.fillStyle = 'rgba(255,60,60,0.16)';
      ctx.fill();
    });
  }

  // reach highlight
  const sel = b.selected;
  if (sel && b.phase === 'player') {
    if (b.mode === 'move') {
      b.reachMap.forEach((_v, k) => {
        const c = k % 64;
        const r = Math.floor(k / 64);
        if (b.unitAt(c, r) && b.unitAt(c, r) !== sel) return;
        const p = P(c, r);
        hexPath(ctx, p.x, p.y, size * 0.93);
        ctx.fillStyle = 'rgba(90,170,255,0.26)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,210,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      // path preview
      if (b.hover) {
        const hk = key(b.hover.c, b.hover.r);
        if (b.reachMap.has(hk) && !b.unitAt(b.hover.c, b.hover.r)) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = size * 0.08;
          ctx.setLineDash([size * 0.14, size * 0.1]);
          ctx.beginPath();
          let k = hk;
          let first = true;
          let guard = 0;
          while (k !== -1 && guard++ < 40) {
            const p = P(k % 64, Math.floor(k / 64));
            if (first) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
            first = false;
            k = b.reachMap.get(k)?.prev ?? -1;
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      // attackable enemies
      for (const e of b.attackTargets(sel)) {
        const p = P(e.c, e.r);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * (0.72 + Math.sin(t * 6) * 0.04), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,70,70,0.95)';
        ctx.lineWidth = size * 0.09;
        ctx.stroke();
      }
    } else {
      for (const h of b.abilityTargets(sel)) {
        const p = P(h.c, h.r);
        hexPath(ctx, p.x, p.y, size * 0.93);
        ctx.fillStyle = 'rgba(190,120,255,0.32)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(225,180,255,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // hover outline
  if (b.hover && b.inb(b.hover.c, b.hover.r)) {
    const p = P(b.hover.c, b.hover.r);
    hexPath(ctx, p.x, p.y, size * 0.97);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // units (sorted by y)
  const us = b.units.filter((u) => !u.dead || u.deathT > 0).sort((a, c) => a.y - c.y);
  for (const u of us) drawUnit(ctx, b, u, ox, oy, size, t);

  // preview bubble
  if (sel && b.phase === 'player' && b.hover && b.mode === 'move') {
    const e = b.unitAt(b.hover.c, b.hover.r);
    if (e && e.team === 'enemy' && b.attackTargets(sel).includes(e)) bubble(ctx, b, sel, e, P(e.c, e.r), size, 0);
  } else if (sel && b.phase === 'player' && b.hover && b.mode === 'ability' && sel.kind === 'ranger') {
    const e = b.unitAt(b.hover.c, b.hover.r);
    if (e && e.team === 'enemy' && b.abilityTargets(sel).some((h) => h.c === e.c && h.r === e.r)) bubble(ctx, b, sel, e, P(e.c, e.r), size, 3);
  }

  // rings
  for (const r of b.rings) {
    const p = { x: ox + r.x * size, y: oy + r.y * size };
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * (0.3 + r.t * 1.5), 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - r.t;
    ctx.lineWidth = size * 0.08 * (1 - r.t);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // projectiles
  for (const pr of b.projs) {
    const x = pr.x0 + (pr.x1 - pr.x0) * pr.t;
    const y = pr.y0 + (pr.y1 - pr.y0) * pr.t - Math.sin(pr.t * Math.PI) * 0.6;
    const px = ox + x * size;
    const py = oy + y * size;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = pr.color;
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // particles
  for (const p of b.parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const s = p.size * size * (p.shape === 'c' ? a * 0.6 + 0.4 : 1);
    if (p.shape === 'c') {
      ctx.beginPath();
      ctx.arc(ox + p.x * size, oy + p.y * size, s, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(ox + p.x * size - s / 2, oy + p.y * size - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  // floating text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of b.floats) {
    const a = Math.min(1, f.life / (f.max * 0.4));
    const pop = f.max - f.life < 0.15 ? 1 + (1 - (f.max - f.life) / 0.15) * 0.5 : 1;
    ctx.globalAlpha = a;
    ctx.font = `800 ${Math.round(size * f.size * pop)}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(f.text, ox + f.x * size, oy + f.y * size);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, ox + f.x * size, oy + f.y * size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // weather overlay
  drawWeather(ctx, b, W, H, t);

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // banner
  if (b.banner) {
    const bn = b.banner;
    const k = bn.t / bn.dur;
    const inK = Math.min(1, k / 0.18);
    const outK = k > 0.78 ? (k - 0.78) / 0.22 : 0;
    const ease = 1 - Math.pow(1 - inK, 3);
    const a = (1 - outK) * ease;
    const bh = Math.min(120, H * 0.2);
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = 'rgba(8,6,16,0.9)';
    ctx.fillRect(0, H / 2 - bh / 2, W, bh);
    ctx.globalAlpha = a;
    ctx.fillStyle = bn.color;
    ctx.font = `900 ${Math.round(bh * 0.42)}px Cinzel, Georgia, serif`;
    ctx.fillText(bn.text, W / 2 + (1 - ease) * 120, H / 2 - bh * 0.1);
    ctx.fillStyle = '#d8d0e8';
    ctx.font = `600 ${Math.round(bh * 0.17)}px system-ui, sans-serif`;
    ctx.fillText(bn.sub, W / 2 - (1 - ease) * 120, H / 2 + bh * 0.28);
    ctx.globalAlpha = 1;
  }
}

function bubble(ctx: CanvasRenderingContext2D, b: Battle, att: BUnit, def: BUnit, p: { x: number; y: number }, size: number, bonus: number) {
  const pv = b.preview(att, def, bonus);
  const txt = pv.kill ? `-${pv.dmg} ☠ KILL` : `-${pv.dmg}${pv.counter ? `  (counter -${pv.counter})` : ''}`;
  ctx.font = `800 ${Math.round(size * 0.4)}px system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 16;
  const x = p.x - w / 2;
  const y = p.y - size * 1.5;
  ctx.fillStyle = 'rgba(10,8,20,0.9)';
  ctx.strokeStyle = pv.kill ? '#7dff9a' : '#ffd27a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y - size * 0.3, w, size * 0.6, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pv.kill ? '#7dff9a' : '#ffe9b0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, p.x, y);
}

function drawTile(ctx: CanvasRenderingContext2D, b: Battle, tl: Tile, p: { x: number; y: number }, size: number, t: number) {
  const s = size * 0.985;
  hexPath(ctx, p.x, p.y, s);
  let col = TCOL[tl.t];
  if (tl.t === 'plain' && b.mission.biome === 'ash') col = '#6a7448';
  ctx.fillStyle = col;
  ctx.fill();
  const v = (tl.seed - 0.5) * 0.16;
  ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
  ctx.fill();
  ctx.save();
  hexPath(ctx, p.x, p.y, s);
  ctx.clip();
  switch (tl.t) {
    case 'forest':
      for (let i = 0; i < 4; i++) {
        const tx = p.x + (hash(tl.seed * 10 + i) - 0.5) * size * 1.0;
        const ty = p.y + (hash(tl.seed * 20 + i) - 0.5) * size * 0.9;
        ctx.fillStyle = i % 2 ? '#1f4a2c' : '#2a6a38';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size * 0.36);
        ctx.lineTo(tx - size * 0.2, ty + size * 0.14);
        ctx.lineTo(tx + size * 0.2, ty + size * 0.14);
        ctx.fill();
      }
      break;
    case 'hill':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(p.x - size * 0.2, p.y + size * 0.25, size * 0.45, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(p.x + size * 0.25, p.y + size * 0.3, size * 0.35, Math.PI, 0);
      ctx.fill();
      break;
    case 'mountain':
      ctx.fillStyle = '#8b8f9a';
      ctx.beginPath();
      ctx.moveTo(p.x - size * 0.55, p.y + size * 0.4);
      ctx.lineTo(p.x - size * 0.05, p.y - size * 0.55);
      ctx.lineTo(p.x + size * 0.55, p.y + size * 0.4);
      ctx.fill();
      ctx.fillStyle = '#e8ecf5';
      ctx.beginPath();
      ctx.moveTo(p.x - size * 0.05, p.y - size * 0.55);
      ctx.lineTo(p.x - size * 0.2, p.y - size * 0.2);
      ctx.lineTo(p.x + size * 0.1, p.y - size * 0.25);
      ctx.fill();
      break;
    case 'water': {
      ctx.strokeStyle = 'rgba(180,225,255,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const yy = p.y + (i - 1) * size * 0.35;
        ctx.beginPath();
        for (let x = -0.7; x <= 0.7; x += 0.1) {
          const xx = p.x + x * size;
          const y2 = yy + Math.sin(t * 2 + x * 5 + tl.seed * 9 + i) * size * 0.05;
          if (x === -0.7) ctx.moveTo(xx, y2);
          else ctx.lineTo(xx, y2);
        }
        ctx.stroke();
      }
      break;
    }
    case 'chasm': {
      const g = ctx.createRadialGradient(p.x, p.y, size * 0.1, p.x, p.y, size);
      g.addColorStop(0, '#000');
      g.addColorStop(1, '#1d1530');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
      ctx.strokeStyle = 'rgba(140,100,70,0.5)';
      ctx.lineWidth = 2;
      hexPath(ctx, p.x, p.y, s - 1);
      ctx.stroke();
      if (tl.anim > 0) {
        ctx.fillStyle = `rgba(255,220,170,${tl.anim * 0.6})`;
        ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
      }
      break;
    }
    case 'fault':
    case 'ash': {
      ctx.strokeStyle = tl.t === 'fault' ? 'rgba(30,20,10,0.55)' : 'rgba(255,120,40,0.18)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const x0 = p.x - size * 0.5 + hash(tl.seed * 5) * size * 0.3;
      ctx.moveTo(x0, p.y - size * 0.5);
      ctx.lineTo(x0 + size * 0.2, p.y - size * 0.15);
      ctx.lineTo(x0 + size * 0.05, p.y + size * 0.1);
      ctx.lineTo(x0 + size * 0.35, p.y + size * 0.5);
      ctx.stroke();
      if (tl.t === 'ash') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
      }
      break;
    }
    case 'bridge':
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
      ctx.fillStyle = '#9b7843';
      for (let i = -3; i <= 3; i++) ctx.fillRect(p.x - size * 0.7, p.y + i * size * 0.2 - size * 0.07, size * 1.4, size * 0.14);
      break;
  }
  // flood
  if (tl.flood > 0) {
    ctx.fillStyle = 'rgba(50,140,230,0.55)';
    ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.strokeStyle = 'rgba(200,235,255,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      for (let x = -0.6; x <= 0.6; x += 0.1) {
        const xx = p.x + x * size;
        const yy = p.y + (i - 0.5) * size * 0.5 + Math.sin(t * 3 + x * 6 + i) * size * 0.06;
        if (x === -0.6) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  }
  // burning
  if (tl.burn > 0) {
    const f = 0.45 + Math.sin(t * 9 + tl.seed * 20) * 0.12;
    ctx.fillStyle = `rgba(255,90,20,${f})`;
    ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    for (let i = 0; i < 3; i++) {
      const fx = p.x + (i - 1) * size * 0.3;
      const h = size * (0.35 + 0.15 * Math.sin(t * 10 + i * 2 + tl.seed * 7));
      ctx.fillStyle = i === 1 ? '#ffd24a' : '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(fx - size * 0.13, p.y + size * 0.25);
      ctx.quadraticCurveTo(fx, p.y + size * 0.25 - h * 1.4, fx + size * 0.13, p.y + size * 0.25);
      ctx.fill();
    }
  }
  ctx.restore();
  // border
  hexPath(ctx, p.x, p.y, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // stable marker
  if (tl.stable && !tl.depot && (tl.t === 'fault' || tl.t === 'bridge')) {
    ctx.fillStyle = 'rgba(160,255,190,0.85)';
    ctx.font = `${Math.round(size * 0.3)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛓', p.x + size * 0.45, p.y + size * 0.4);
  }

  // depot
  if (tl.depot) {
    const d = tl.depot;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(size * 0.8)}px system-ui, "Segoe UI Emoji", sans-serif`;
    ctx.globalAlpha = 0.95;
    ctx.fillText(d.hq ? '🏰' : d.obj ? '🚩' : '⛺', p.x, p.y - size * 0.08);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x + size * 0.5, p.y - size * 0.55, size * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = d.owner === 'player' ? '#3fd6a0' : d.owner === 'enemy' ? '#ff5a5a' : '#c9c9c9';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // warnings
  if (tl.warn) {
    const w = tl.warn;
    const pulse = 0.55 + Math.sin(t * 6) * 0.25;
    const colr = w.kind === 'collapse' ? '255,220,150' : w.kind === 'flood' ? '110,200,255' : '255,140,40';
    hexPath(ctx, p.x, p.y, s * 0.9);
    ctx.fillStyle = `rgba(${colr},${0.12 + pulse * 0.1})`;
    ctx.fill();
    ctx.setLineDash([size * 0.18, size * 0.1]);
    ctx.lineDashOffset = -t * size * 0.5;
    ctx.strokeStyle = `rgba(${colr},${pulse + 0.3})`;
    ctx.lineWidth = size * 0.07;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.strokeStyle = `rgba(${colr},0.95)`;
    ctx.fillStyle = `rgba(${colr},0.95)`;
    ctx.lineWidth = size * 0.06;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = p.x;
    const cy = p.y + size * 0.05;
    if (w.kind === 'collapse') {
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.35, cy - size * 0.35);
      ctx.lineTo(cx - size * 0.05, cy - size * 0.08);
      ctx.lineTo(cx - size * 0.2, cy + size * 0.05);
      ctx.lineTo(cx + size * 0.15, cy + size * 0.35);
      ctx.stroke();
    } else if (w.kind === 'flood') {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        for (let x = -0.35; x <= 0.35; x += 0.07) {
          const yy = cy + (i - 0.3) * size * 0.3 + Math.sin(t * 4 + x * 12) * size * 0.05;
          if (x === -0.35) ctx.moveTo(cx + x * size, yy);
          else ctx.lineTo(cx + x * size, yy);
        }
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.4);
      ctx.quadraticCurveTo(cx + size * 0.35, cy, cx + size * 0.12, cy + size * 0.32);
      ctx.quadraticCurveTo(cx, cy + size * 0.12, cx - size * 0.15, cy + size * 0.32);
      ctx.quadraticCurveTo(cx - size * 0.3, cy, cx, cy - size * 0.4);
      ctx.fill();
    }
    ctx.restore();
    ctx.font = `900 ${Math.round(size * 0.32)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(String(w.eta), p.x + size * 0.5, p.y + size * 0.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(w.eta), p.x + size * 0.5, p.y + size * 0.5);
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, b: Battle, u: BUnit, ox: number, oy: number, size: number, t: number) {
  let wx = u.x;
  let wy = u.y;
  if (u.lunge) {
    const k = Math.sin(Math.PI * u.lunge.t) * 0.45;
    wx += u.lunge.dx * k;
    wy += u.lunge.dy * k;
  }
  const bob = u.team === 'player' && b.selected === u ? Math.sin(t * 6) * 0.04 : 0;
  const x = ox + wx * size;
  const y = oy + (wy + bob) * size;
  const R = size * (u.boss ? 0.78 : 0.55);
  const alpha = u.dead ? Math.max(0, u.deathT / 0.6) : 1;
  ctx.globalAlpha = alpha;
  // shadow
  ctx.beginPath();
  ctx.ellipse(x, y + R * 0.85, R * 0.9, R * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  const grad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
  if (u.team === 'player') {
    grad.addColorStop(0, '#4fb0d8');
    grad.addColorStop(1, '#1f5a82');
  } else {
    grad.addColorStop(0, u.boss ? '#e04a4a' : '#d65a4a');
    grad.addColorStop(1, u.boss ? '#601018' : '#7a2020');
  }
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = b.selected === u ? `rgba(255,225,90,${0.7 + Math.sin(t * 8) * 0.3})` : u.team === 'player' ? '#a8e6ff' : '#ffb4a4';
  if (u.boss) ctx.strokeStyle = '#ffd24a';
  ctx.stroke();
  if (u.team === 'player' && u.acted && u.mp <= 0 && b.phase === 'player') {
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,20,0.45)';
    ctx.fill();
  }
  const def = u.team === 'player' ? CLASSES[u.kind] : ENEMIES[u.kind];
  ctx.font = `${Math.round(R * 1.1)}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(def.icon, x, y + R * 0.05);
  if (u.flash > 0) {
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, u.flash * 4)})`;
    ctx.fill();
  }
  // hp bar
  const bw = R * 1.7;
  const bx = x - bw / 2;
  const by = y + R + size * 0.1;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, size * 0.17);
  const pct = Math.max(0, u.hp / u.maxHp);
  ctx.fillStyle = pct > 0.55 ? '#5be37a' : pct > 0.28 ? '#f0c040' : '#f05a4a';
  ctx.fillRect(bx, by, bw * pct, size * 0.15);
  // level pips
  if (u.team === 'player') {
    for (let i = 0; i < u.level - 1; i++) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(x - R + 4 + i * size * 0.14, y - R - size * 0.02, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.pendingPerks > 0) {
      ctx.font = `${Math.round(size * 0.3)}px system-ui`;
      ctx.fillText('⭐', x + R * 0.9, y - R * 0.9);
    }
    if (!u.supplied && b.phase !== 'over') {
      ctx.beginPath();
      ctx.arc(x - R * 0.85, y - R * 0.7, size * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9a3a';
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = `900 ${Math.round(size * 0.24)}px system-ui`;
      ctx.fillText('!', x - R * 0.85, y - R * 0.7 + 1);
    }
    if (u.cd > 0) {
      ctx.font = `800 ${Math.round(size * 0.26)}px system-ui`;
      ctx.fillStyle = '#c8b6ff';
      ctx.fillText(`⏳${u.cd}`, x + R * 0.7, y + R * 0.6);
    }
  } else if (u.boss) {
    ctx.font = `${Math.round(size * 0.4)}px system-ui`;
    ctx.fillText('👑', x, y - R - size * 0.15);
  } else if (u.cd === 0 && ENEMIES[u.kind].ability) {
    ctx.font = `${Math.round(size * 0.24)}px system-ui`;
    ctx.fillText('✨', x + R * 0.8, y - R * 0.8);
  }
  ctx.globalAlpha = 1;
}

function drawWeather(ctx: CanvasRenderingContext2D, b: Battle, W: number, H: number, t: number) {
  const w = b.weather;
  if (w === 'rain' || w === 'storm') {
    ctx.strokeStyle = 'rgba(170,210,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = w === 'storm' ? 110 : 70;
    for (let i = 0; i < n; i++) {
      const x = ((hash(i) * W + t * (w === 'storm' ? 300 : 80)) % (W + 40)) - 20;
      const y = (hash(i + 99) * H + t * 700) % H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - (w === 'storm' ? 10 : 3), y + 14);
    }
    ctx.stroke();
    if (w === 'storm' && Math.sin(t * 1.7) > 0.985) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (w === 'wind' || w === 'storm') {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    const ang = (-Math.PI / 3) * b.wind;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let i = 0; i < 24; i++) {
      const k = (hash(i + 5) + t * 0.3) % 1;
      const x = hash(i + 17) * W + dx * k * 200;
      const y = hash(i + 33) * H + dy * k * 200;
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 40, y + dy * 40);
    }
    ctx.stroke();
  }
  if (w === 'drought') {
    ctx.fillStyle = 'rgba(255,170,60,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,190,100,0.4)';
    for (let i = 0; i < 30; i++) {
      const x = (hash(i) * W + t * 20) % W;
      const y = (hash(i + 7) * H - t * 10 + H * 4) % H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
}
