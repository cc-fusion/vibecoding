import { W, H, TILE, CATCH, T_PLAIN, T_FOREST, T_HILL, T_MOUNT, T_WATER, T_DESERT, CARGOS, CARGO_INFO, COMPANY_COLORS } from './data';
import { DX, DY, BIT, type Town, type Industry } from './world';
import type { Game } from './sim';

export interface Camera { x: number; y: number; z: number }
export interface RenderState {
  cam: Camera; w: number; h: number; dpr: number; tool: string; hover: { x: number; y: number } | null; anchor: number | null;
  preview: { path: number[]; cost: number; ok: boolean } | null; selTrain: number | null; selStation: number | null; time: number;
}

function hash(x: number, y: number, k: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  terrain: HTMLCanvasElement | null = null;
  mini: HTMLCanvasElement | null = null;
  builtFor: Uint8Array | null = null;

  build(g: Game) {
    const cv = document.createElement('canvas');
    cv.width = W * TILE; cv.height = H * TILE;
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    const mini = document.createElement('canvas');
    mini.width = W; mini.height = H;
    const mc = mini.getContext('2d') as CanvasRenderingContext2D;
    const base = ['#a3b56d', '#7c9e59', '#bba46c', '#8f867a', '#4b86ab', '#d9c27c'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = g.terr[y * W + x];
        const px = x * TILE, py = y * TILE;
        const v = hash(x, y, 1);
        c.fillStyle = base[t];
        c.fillRect(px, py, TILE, TILE);
        c.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + v * 0.05})`;
        c.fillRect(px, py, TILE, TILE);
        mc.fillStyle = base[t]; mc.fillRect(x, y, 1, 1);
        if (t === T_PLAIN) {
          c.strokeStyle = 'rgba(70,100,40,0.55)'; c.lineWidth = 1;
          for (let k = 0; k < 3; k++) { const gx = px + 3 + hash(x, y, 10 + k) * (TILE - 6), gy = py + 5 + hash(x, y, 20 + k) * (TILE - 8); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1, gy - 3); c.moveTo(gx, gy); c.lineTo(gx + 1.5, gy - 3); c.stroke(); }
        } else if (t === T_FOREST) {
          for (let k = 0; k < 3; k++) {
            const tx = px + 4 + hash(x, y, 30 + k) * (TILE - 8), ty = py + 8 + hash(x, y, 40 + k) * (TILE - 10);
            c.fillStyle = '#4c3a22'; c.fillRect(tx - 0.8, ty, 1.6, 3);
            c.fillStyle = k % 2 ? '#2f6b3a' : '#3b7d45';
            c.beginPath(); c.moveTo(tx, ty - 8); c.lineTo(tx - 4, ty + 1); c.lineTo(tx + 4, ty + 1); c.fill();
            c.beginPath(); c.moveTo(tx, ty - 11); c.lineTo(tx - 3, ty - 4); c.lineTo(tx + 3, ty - 4); c.fill();
          }
        } else if (t === T_HILL) {
          c.strokeStyle = 'rgba(110,85,40,0.6)'; c.lineWidth = 1.4;
          for (let k = 0; k < 2; k++) { const hx = px + 6 + hash(x, y, 50 + k) * (TILE - 12), hy = py + 9 + k * 8; c.beginPath(); c.arc(hx, hy, 6, Math.PI, 0); c.stroke(); }
        } else if (t === T_MOUNT) {
          const mx = px + TILE / 2 + (hash(x, y, 60) - 0.5) * 4;
          c.fillStyle = '#6d6559'; c.beginPath(); c.moveTo(mx, py + 2); c.lineTo(px + 1, py + TILE - 2); c.lineTo(px + TILE - 1, py + TILE - 2); c.fill();
          c.fillStyle = '#a89f92'; c.beginPath(); c.moveTo(mx, py + 2); c.lineTo(px + 1, py + TILE - 2); c.lineTo(mx, py + TILE - 2); c.fill();
          c.fillStyle = '#f4f4f0'; c.beginPath(); c.moveTo(mx, py + 2); c.lineTo(mx - 4, py + 9); c.lineTo(mx - 1, py + 7); c.lineTo(mx + 2, py + 9); c.lineTo(mx + 4, py + 9); c.fill();
        } else if (t === T_WATER) {
          c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
          const wy = py + 6 + hash(x, y, 70) * 12;
          c.beginPath(); c.moveTo(px + 3, wy); c.quadraticCurveTo(px + 8, wy - 2, px + 12, wy); c.quadraticCurveTo(px + 16, wy + 2, px + 21, wy); c.stroke();
        } else if (t === T_DESERT) {
          c.fillStyle = 'rgba(150,110,50,0.45)';
          for (let k = 0; k < 4; k++) c.fillRect(px + hash(x, y, 80 + k) * (TILE - 2), py + hash(x, y, 90 + k) * (TILE - 2), 1.5, 1.5);
          if (hash(x, y, 99) > 0.88) { c.fillStyle = '#5b8a4a'; c.fillRect(px + 10, py + 8, 2, 8); c.fillRect(px + 8, py + 10, 2, 2); c.fillRect(px + 12, py + 11, 3, 2); }
        }
      }
    }
    // shore lines
    c.strokeStyle = 'rgba(30,60,80,0.35)'; c.lineWidth = 1.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g.terr[y * W + x] !== T_WATER) continue;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (g.terr[ny * W + nx] === T_WATER) continue;
        const px = x * TILE, py = y * TILE;
        c.beginPath();
        if (d === 0) { c.moveTo(px, py); c.lineTo(px + TILE, py); } else if (d === 1) { c.moveTo(px + TILE, py); c.lineTo(px + TILE, py + TILE); }
        else if (d === 2) { c.moveTo(px, py + TILE); c.lineTo(px + TILE, py + TILE); } else { c.moveTo(px, py); c.lineTo(px, py + TILE); }
        c.stroke();
      }
    }
    this.terrain = cv; this.mini = mini; this.builtFor = g.terr;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, rs: RenderState) {
    if (!this.terrain || this.builtFor !== g.terr) this.build(g);
    const { cam, w, h, dpr } = rs;
    const z = cam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2d5a78';
    ctx.fillRect(0, 0, w * dpr, h * dpr);
    const sx = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0, sy = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
    const ox = w / 2 - cam.x * z + sx, oy = h / 2 - cam.y * z + sy;
    ctx.setTransform(z * dpr, 0, 0, z * dpr, ox * dpr, oy * dpr);
    ctx.imageSmoothingEnabled = z < 1.6;
    ctx.drawImage(this.terrain as HTMLCanvasElement, 0, 0);
    // season tint
    const se = g.season;
    const tint = se === 'Winter' ? 'rgba(235,245,255,0.2)' : se === 'Autumn' ? 'rgba(220,120,30,0.08)' : se === 'Spring' ? 'rgba(90,200,90,0.05)' : 'rgba(255,230,120,0.04)';
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W * TILE, H * TILE);

    // grid when building
    if (rs.tool === 'track' || rs.tool === 'station') {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.5 / z + 0.2;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) { ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H * TILE); }
      for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * TILE); ctx.lineTo(W * TILE, y * TILE); }
      ctx.stroke();
    }

    // zones
    for (const zn of g.zones) {
      const fade = Math.min(1, (zn.until - g.t) / 4, (g.t - zn.start) / 2 + 0.2);
      const gr = ctx.createRadialGradient(zn.x * TILE, zn.y * TILE, 0, zn.x * TILE, zn.y * TILE, zn.r * TILE);
      const col = zn.kind === 'blizzard' ? '255,255,255' : zn.kind === 'flood' ? '60,130,230' : zn.kind === 'boom' ? '255,210,80' : '255,120,40';
      gr.addColorStop(0, `rgba(${col},${0.45 * fade})`); gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(zn.x * TILE, zn.y * TILE, zn.r * TILE, 0, 6.283); ctx.fill();
    }

    this.drawTrack(ctx, g, rs);
    // ruins
    for (const r of g.ruins) {
      const x = (r.i % W) * TILE, y = Math.floor(r.i / W) * TILE;
      ctx.strokeStyle = `rgba(255,70,50,${0.5 + 0.5 * Math.sin(rs.time * 6)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + TILE - 5, y + TILE - 5); ctx.moveTo(x + TILE - 5, y + 5); ctx.lineTo(x + 5, y + TILE - 5); ctx.stroke();
    }
    // tutorial highlight
    if (g.tut.on && g.tut.step <= 2) {
      for (const id of g.tutPair) {
        const t = g.towns[id]; if (!t) continue;
        ctx.strokeStyle = `rgba(255,230,120,${0.5 + 0.4 * Math.sin(rs.time * 4)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(t.x * TILE + 12, t.y * TILE + 12, 34 + Math.sin(rs.time * 4) * 3, 0, 6.283); ctx.stroke();
      }
    }
    for (const i of g.inds) this.drawInd(ctx, g, i, rs);
    for (const t of g.towns) this.drawTown(ctx, t);
    for (const s of g.stations) this.drawStation(ctx, g, s, rs);
    // preview
    if (rs.preview) {
      ctx.fillStyle = rs.preview.ok ? 'rgba(120,255,140,0.45)' : 'rgba(255,90,70,0.45)';
      for (const i of rs.preview.path) ctx.fillRect((i % W) * TILE + 3, Math.floor(i / W) * TILE + 3, TILE - 6, TILE - 6);
    }
    if (rs.anchor !== null) {
      const ax = (rs.anchor % W) * TILE, ay = Math.floor(rs.anchor / W) * TILE;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.strokeRect(ax + 1, ay + 1, TILE - 2, TILE - 2);
    }
    if (rs.hover) {
      const hx = rs.hover.x, hy = rs.hover.y;
      if (g.inb(hx, hy)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(hx * TILE, hy * TILE, TILE, TILE);
        if (rs.tool === 'station') {
          const ok = !g.canStation(hx, hy, 0);
          ctx.strokeStyle = ok ? 'rgba(255,224,138,0.9)' : 'rgba(255,90,70,0.9)'; ctx.setLineDash([4, 3]);
          ctx.strokeRect((hx - CATCH) * TILE, (hy - CATCH) * TILE, (CATCH * 2 + 1) * TILE, (CATCH * 2 + 1) * TILE); ctx.setLineDash([]);
        }
      }
    }
    // trains
    for (const tr of g.trains) this.drawTrain(ctx, g, tr, rs);
    // particles
    for (const p of g.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      if (p.kind === 'smoke') { ctx.fillStyle = `rgba(220,220,220,${a * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'coin' ? 1 : 0.7), 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
    }
    // screen-space text
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const showSt = z > 0.9;
    for (const t of g.towns) {
      const px = (t.x * TILE + 12) * z + ox, py = (t.y * TILE - 8) * z + oy;
      ctx.font = `bold ${Math.max(10, 12 * Math.min(1.3, z))}px Georgia, serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.9)'; ctx.fillStyle = t.terminus ? '#ffe08a' : '#fff6dc';
      ctx.strokeText(t.name, px, py); ctx.fillText(t.name, px, py);
      ctx.font = `${Math.max(9, 10 * Math.min(1.3, z))}px Georgia, serif`; ctx.fillStyle = '#e0d5b8';
      ctx.strokeText(`pop ${Math.round(t.pop).toLocaleString()}${t.boomUntil > g.t ? ' 🌟' : ''}`, px, py + 11 * Math.min(1.3, z) + 2); ctx.fillText(`pop ${Math.round(t.pop).toLocaleString()}${t.boomUntil > g.t ? ' 🌟' : ''}`, px, py + 11 * Math.min(1.3, z) + 2);
    }
    if (showSt) {
      ctx.font = `${Math.max(9, 10 * Math.min(1.2, z))}px Georgia, serif`;
      for (const s of g.stations) {
        const px = (s.x * TILE + 12) * z + ox, py = (s.y * TILE + 30) * z + oy;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,0,0.9)'; ctx.fillStyle = COMPANY_COLORS[s.owner];
        ctx.strokeText(s.name, px, py); ctx.fillText(s.name, px, py);
      }
    }
    if (z > 1.1) {
      ctx.font = `${Math.max(9, 9.5 * Math.min(1.2, z))}px Georgia, serif`; ctx.fillStyle = '#d6e8ff';
      for (const i of g.inds) { const px = (i.x * TILE + 12) * z + ox, py = (i.y * TILE + 33) * z + oy; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,20,30,0.85)'; ctx.strokeText(i.name, px, py); ctx.fillText(i.name, px, py); }
    }
    for (const f of g.floaters) {
      const a = Math.min(1, f.life / (f.max * 0.5));
      const px = f.x * z + ox, py = f.y * z + oy;
      const sc = f.big ? 1 + Math.max(0, f.life / f.max - 0.8) * 2 : 1;
      ctx.font = `bold ${(f.big ? 17 : 12) * sc}px Georgia, serif`;
      ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,0,0.9)'; ctx.fillStyle = f.color;
      ctx.strokeText(f.text, px, py); ctx.fillText(f.text, px, py); ctx.globalAlpha = 1;
    }
    // winter vignette
    if (g.zones.some((zz) => zz.kind === 'blizzard')) { ctx.fillStyle = 'rgba(220,235,255,0.08)'; ctx.fillRect(0, 0, w, h); }
  }

  drawTrack(ctx: CanvasRenderingContext2D, g: Game, rs: RenderState) {
    const groups = new Map<string, Path2D>();
    for (let i = 0; i < W * H; i++) {
      const m = g.trk[i];
      if (!m) continue;
      const o = Math.max(0, g.own[i]);
      const t = g.terr[i];
      const kind = t === T_WATER ? 1 : t === T_MOUNT ? 2 : 0;
      const key = `${o}|${kind}`;
      let p = groups.get(key);
      if (!p) { p = new Path2D(); groups.set(key, p); }
      const cx = (i % W) * TILE + TILE / 2, cy = Math.floor(i / W) * TILE + TILE / 2;
      for (let d = 0; d < 4; d++) if (m & BIT[d]) { p.moveTo(cx, cy); p.lineTo(cx + DX[d] * TILE / 2, cy + DY[d] * TILE / 2); }
      // junction dot
      p.moveTo(cx, cy); p.lineTo(cx + 0.01, cy);
    }
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (const [key, p] of groups) {
      const [o, k] = key.split('|').map(Number);
      if (k === 1) { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 11; ctx.setLineDash([]); ctx.stroke(p); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 9; ctx.stroke(p); }
      if (k === 2) { ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 10; ctx.setLineDash([]); ctx.stroke(p); }
      ctx.strokeStyle = COMPANY_COLORS[o]; ctx.globalAlpha = 0.9; ctx.lineWidth = 7; ctx.setLineDash([2.2, 3.4]); ctx.stroke(p); ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#d4d4d4'; ctx.lineWidth = 4.2; ctx.stroke(p);
      ctx.strokeStyle = k === 2 ? '#2a2420' : '#43301c'; ctx.lineWidth = 2.2; ctx.stroke(p);
    }
    void rs;
  }

  drawTown(ctx: CanvasRenderingContext2D, t: Town) {
    const cx = t.x * TILE + 12, cy = t.y * TILE + 12;
    const n = Math.min(26, 4 + Math.floor(t.pop / 90));
    const sz = t.pop < 300 ? 5 : t.pop < 1000 ? 6 : t.pop < 2500 ? 7 : 8;
    ctx.fillStyle = 'rgba(70,50,30,0.3)'; ctx.beginPath(); ctx.arc(cx, cy, 8 + n * 0.55, 0, 6.283); ctx.fill();
    const pal = ['#c9a27a', '#e4d4b4', '#b5603f', '#d9c08a', '#9a7b5a'];
    for (let i = 0; i < n; i++) {
      const [ox, oy, r] = t.bldg[i];
      const bx = cx + ox * (6 + n * 0.28), by = cy + oy * (6 + n * 0.28);
      const bw = sz * (0.7 + r * 0.5), bh = sz * (0.6 + r * 0.5);
      ctx.fillStyle = pal[Math.floor(r * 5) % 5]; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
      ctx.fillStyle = r > 0.5 ? '#7a3a2a' : '#5a4636';
      ctx.beginPath(); ctx.moveTo(bx - bw / 2 - 1, by - bh / 2); ctx.lineTo(bx, by - bh / 2 - bh * 0.5); ctx.lineTo(bx + bw / 2 + 1, by - bh / 2); ctx.fill();
    }
    if (t.pop > 1000) { ctx.fillStyle = '#eee'; ctx.fillRect(cx - 2, cy - 14, 4, 12); ctx.fillStyle = '#9a3a2a'; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 14); ctx.lineTo(cx, cy - 20); ctx.lineTo(cx + 3, cy - 14); ctx.fill(); }
    if (t.terminus) { ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(cx, cy + 16, 2.5, 0, 6.283); ctx.fill(); }
  }

  drawInd(ctx: CanvasRenderingContext2D, g: Game, i: Industry, rs: RenderState) {
    const cx = i.x * TILE + 12, cy = i.y * TILE + 12;
    const down = i.downUntil > g.t;
    ctx.globalAlpha = down ? 0.55 : 1;
    if (i.ik === 'mine') {
      ctx.fillStyle = '#3a342c'; ctx.beginPath(); ctx.arc(cx, cy + 3, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(cx - 4, cy - 2, 8, 6);
      ctx.fillStyle = '#7a5a30'; ctx.fillRect(cx - 5, cy - 3, 2, 7); ctx.fillRect(cx + 3, cy - 3, 2, 7);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + 10, cy + 5, 3, 0, 6.283); ctx.fill();
    } else if (i.ik === 'farm') {
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#d2b64a' : '#b8a040'; ctx.fillRect(cx - 12, cy - 11 + k * 5, 14, 4); }
      ctx.fillStyle = '#a8412e'; ctx.fillRect(cx + 1, cy - 2, 9, 8); ctx.fillStyle = '#5a2a20'; ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx + 5.5, cy - 8); ctx.lineTo(cx + 11, cy - 2); ctx.fill();
    } else if (i.ik === 'lumber') {
      ctx.fillStyle = '#6a4a2a'; for (let k = 0; k < 3; k++) ctx.fillRect(cx - 10, cy + 2 + k * 3, 12, 2.5);
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(cx + 1, cy - 6, 9, 8); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 5.5, cy - 11); ctx.lineTo(cx + 11, cy - 6); ctx.fill();
    } else {
      ctx.fillStyle = '#6f6a66'; ctx.fillRect(cx - 11, cy - 6, 22, 13); ctx.fillStyle = '#4a4542'; ctx.fillRect(cx - 11, cy - 8, 22, 3);
      ctx.fillStyle = '#3a3532'; ctx.fillRect(cx + 4, cy - 17, 4, 11); ctx.fillRect(cx - 7, cy - 14, 3.5, 8);
      ctx.fillStyle = '#f0c040'; ctx.fillRect(cx - 8, cy - 1, 3, 3); ctx.fillRect(cx - 2, cy - 1, 3, 3);
      if (!down && Math.sin(rs.time * 3 + i.id) > 0.3 && g.particles.length < 500 && Math.random() < 0.05) g.particles.push({ x: cx + 6, y: cy - 18, vx: 4, vy: -10, life: 1.4, max: 1.4, size: 2.5, color: '#bbb', kind: 'smoke' });
    }
    ctx.globalAlpha = 1;
    for (let k = 0; k < i.level; k++) { ctx.fillStyle = '#ffe08a'; ctx.fillRect(cx - 10 + k * 5, cy + 14, 4, 2.5); }
    if (down) { ctx.font = '12px serif'; ctx.fillText('🔥', cx - 6, cy); }
  }

  drawStation(ctx: CanvasRenderingContext2D, g: Game, s: import('./sim').Station, rs: RenderState) {
    const cx = s.x * TILE + 12, cy = s.y * TILE + 12;
    const col = COMPANY_COLORS[s.owner];
    ctx.fillStyle = '#d9c9a8'; ctx.fillRect(cx - 9, cy - 5, 18, 11);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 11, cy - 5); ctx.lineTo(cx, cy - 12); ctx.lineTo(cx + 11, cy - 5); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(cx - 2, cy, 4, 6);
    ctx.fillStyle = '#fff'; for (let k = 0; k < s.platforms; k++) ctx.fillRect(cx - 8 + k * 5, cy + 7, 3.5, 2);
    if (s.depot) { ctx.fillStyle = '#5a5048'; ctx.fillRect(cx + 7, cy - 3, 7, 6); ctx.fillStyle = col; ctx.fillRect(cx + 7, cy - 4, 7, 1.5); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 5); ctx.lineTo(cx - 9, cy - 16); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 16); ctx.lineTo(cx - 2, cy - 14); ctx.lineTo(cx - 9, cy - 12); ctx.fill();
    if (s.closedUntil > g.t) { ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.fillText('🔥', cx, cy - 4); }
    if (rs.selStation === s.id) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect((s.x - CATCH) * TILE, (s.y - CATCH) * TILE, (CATCH * 2 + 1) * TILE, (CATCH * 2 + 1) * TILE); ctx.setLineDash([]); }
    // cargo waiting pips
    if (s.owner === 0) {
      let tot = 0; for (const c of CARGOS) for (const p of s.cargo[c]) tot += p.n;
      const pips = Math.min(6, Math.floor(tot / 40));
      ctx.fillStyle = '#ffe08a'; for (let k = 0; k < pips; k++) ctx.fillRect(cx - 9 + k * 3.2, cy + 11, 2.4, 2.4);
    }
  }

  drawTrain(ctx: CanvasRenderingContext2D, g: Game, tr: import('./sim').Train, rs: RenderState) {
    const lc = g.loco(tr.loco);
    const col = COMPANY_COLORS[tr.owner];
    const cars = 1 + Math.floor(lc.cap / 35);
    let dom: string = '#8a8a8a', best = 0;
    for (const c of CARGOS) { const s = tr.cargo[c].reduce((a, p) => a + p.n, 0); if (s > best) { best = s; dom = CARGO_INFO[c].color; } }
    for (let k = cars; k >= 1; k--) {
      const p = g.trainXY(tr, 0.42 * k + 0.1);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = '#2a2018'; ctx.fillRect(-5, -3.3, 10, 6.6);
      ctx.fillStyle = tr.load > 0 ? dom : '#6a5a48'; ctx.fillRect(-4.4, -2.7, 8.8, 5.4);
      ctx.restore();
    }
    const p = g.trainXY(tr, 0);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = '#18130f'; ctx.fillRect(-6, -3.6, 12.5, 7.2);
    ctx.fillStyle = col; ctx.fillRect(-6, -1, 12.5, 2);
    ctx.fillStyle = '#18130f'; ctx.fillRect(-7, -3, 3, 6);
    ctx.fillStyle = '#c9a050'; ctx.beginPath(); ctx.arc(5.5, 0, 1.4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e0e0e0'; ctx.fillRect(2.5, -4.4, 2, 1.5);
    ctx.restore();
    if (rs.selTrain === tr.id) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 11 + Math.sin(rs.time * 6) * 1.5, 0, 6.283); ctx.stroke(); }
    if (tr.haltUntil > g.t || tr.state === 'broken' || tr.state === 'stuck' || tr.state === 'queue' || tr.slow) {
      ctx.font = '11px serif'; ctx.textAlign = 'center';
      ctx.fillText(tr.state === 'broken' ? '🔧' : tr.state === 'stuck' ? '❓' : tr.state === 'queue' ? '⏳' : tr.haltUntil > g.t ? '✋' : '❄️', p.x, p.y - 9);
    }
  }

  drawMini(ctx: CanvasRenderingContext2D, g: Game, cam: Camera, vw: number, vh: number, mw: number, mh: number) {
    if (!this.mini) return;
    ctx.clearRect(0, 0, mw, mh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini, 0, 0, mw, mh);
    const sx = mw / W, sy = mh / H;
    for (let i = 0; i < W * H; i++) {
      if (!g.trk[i]) continue;
      ctx.fillStyle = COMPANY_COLORS[Math.max(0, g.own[i])];
      ctx.fillRect((i % W) * sx, Math.floor(i / W) * sy, sx, sy);
    }
    for (const t of g.towns) { ctx.fillStyle = '#fff'; ctx.fillRect(t.x * sx - 1, t.y * sy - 1, 3, 3); }
    for (const s of g.stations) { ctx.fillStyle = COMPANY_COLORS[s.owner]; ctx.fillRect(s.x * sx - 1, s.y * sy - 1, 3, 3); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    const vx = (cam.x / TILE - vw / cam.z / TILE / 2) * sx, vy = (cam.y / TILE - vh / cam.z / TILE / 2) * sy;
    ctx.strokeRect(vx, vy, (vw / cam.z / TILE) * sx, (vh / cam.z / TILE) * sy);
  }
}
