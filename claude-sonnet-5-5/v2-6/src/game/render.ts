import type { Game } from './game';
import { W, H, N, mod, wrapDX } from './world';
import { TRIBES, TOOLS } from './data';

const S = 3;
const shade = new Float32Array(N);
const BC: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [226, 210, 152], [124, 178, 86], [52, 124, 66], [216, 184, 108], [142, 152, 98], [128, 120, 118], [240, 245, 252], [160, 178, 152]];

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  const f = (n: number) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
let plateRGB: [number, number, number][] = [];

function paintTerrain(g: Game, time: number) {
  const { h, sea, cnt, top, stress, lavaT, flood, bless, ash, biome, fert } = g;
  if (plateRGB.length !== g.plates.length) plateRGB = g.plates.map((p) => hsl2rgb(p.hue, 0.75, 0.55));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = mod(x - 1, W), xr = mod(x + 1, W), yu = Math.max(0, y - 1), yd = Math.min(H - 1, y + 1);
    const d = (h[yu * W + xl] - h[yd * W + xr]) * 1.5;
    shade[y * W + x] = d < -0.3 ? -0.3 : d > 0.3 ? 0.3 : d;
  }
  const data = g.terrImg.data; const TW = W * S, TH = H * S;
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  const ov = g.overlay;
  let o = 0;
  for (let py = 0; py < TH; py++) {
    const v = (py + 0.5) / S - 0.5; const y0 = Math.floor(v); const fy = v - y0;
    const ya = Math.max(0, Math.min(H - 1, y0)), yb = Math.max(0, Math.min(H - 1, y0 + 1));
    const cy = Math.floor(py / S);
    for (let px = 0; px < TW; px++) {
      const u = (px + 0.5) / S - 0.5; const x0 = Math.floor(u); const fx = u - x0;
      const xa = mod(x0, W), xb = mod(x0 + 1, W);
      const hi = h[ya * W + xa] * (1 - fx) * (1 - fy) + h[ya * W + xb] * fx * (1 - fy) + h[yb * W + xa] * (1 - fx) * fy + h[yb * W + xb] * fx * fy;
      const ci = cy * W + ((px / S) | 0);
      const e = hi - sea;
      let r: number, gg: number, b: number;
      const wet = e < 0;
      if (wet) {
        let t = -e / 0.8; if (t > 1) t = 1;
        const wave = Math.sin(time * 1.4 + px * 0.45 + py * 0.28 + t * 3) * 5 * (1 - t * 0.5);
        r = 78 - 66 * t + wave; gg = 176 - 140 * t + wave; b = 196 - 106 * t + wave;
        if (e > -0.04) { const foam = (1 + e / 0.04) * (0.6 + 0.4 * Math.sin(time * 2 + px * 0.7)); r += 60 * foam; gg += 60 * foam; b += 50 * foam; }
        if (cnt[ci] === 0) { r = r * 0.4 + 110 + 90 * pulse; gg = gg * 0.3 + 26 + 30 * pulse; b = b * 0.3 + 10; }
      } else {
        let bm = biome[ci]; if (bm <= 2) bm = 3;
        const c = BC[bm];
        const br = 1 + shade[ci] * (bm >= 7 ? 1.5 : 0.9) + (e - 0.2) * 0.12;
        const nz = ((((px * 73856093) ^ (py * 19349663)) >>> 4) & 15) - 7.5;
        r = c[0] * br + nz * 0.7; gg = c[1] * br + nz * 0.7; b = c[2] * br + nz * 0.7;
        if (ash[ci] > 0.4) { const k = (ash[ci] - 0.4) * 0.35; r *= 1 - k; gg *= 1 - k; b *= 1 - k; }
        if (bless[ci] > 0) { gg += 28 * bless[ci]; r += 8 * bless[ci]; }
      }
      if (lavaT[ci] > 0) {
        const fl = 0.7 + 0.3 * Math.sin(time * 9 + px * 0.9 + py * 0.7);
        r = 255 * fl; gg = (90 + 80 * fl) * (lavaT[ci] > 2 ? 1 : 0.55); b = 20;
      }
      if (flood[ci] > 0) { const k = Math.min(0.55, flood[ci] * 0.25); r = r * (1 - k) + 100 * k; gg = gg * (1 - k) + 190 * k; b = b * (1 - k) + 240 * k; }
      const s = stress[ci];
      if (ov === 0) {
        if (s > 60) { const k = ((s - 60) / 40) * (0.45 + 0.55 * pulse); r += k * 120; gg -= k * 30; b -= k * 40; }
      } else if (ov === 1) {
        const pc = top[ci] >= 0 ? plateRGB[top[ci]] : [255, 120, 40];
        r = r * 0.55 + pc[0] * 0.45; gg = gg * 0.55 + pc[1] * 0.45; b = b * 0.55 + pc[2] * 0.45;
        if (cnt[ci] >= 2) { r = r * 0.35 + 255 * 0.65; gg = gg * 0.35 + 215 * 0.65; b = b * 0.35 + 50 * 0.65; }
        else if (cnt[ci] === 0) { r = 255; gg = 90 + 40 * pulse; b = 30; }
      } else if (ov === 2) {
        r *= 0.38; gg *= 0.4; b *= 0.45;
        if (s > 2) {
          const k = Math.min(1, s / 100); const a = Math.min(0.92, 0.15 + k * 0.85);
          const hr = 70 + 185 * k, hg = (k < 0.5 ? 200 : 200 * (1 - k) * 2) * (0.6 + 0.4 * (1 - k)), hb = 130 * (1 - k);
          r = r * (1 - a) + hr * a; gg = gg * (1 - a) + hg * a; b = b * (1 - a) + hb * a;
          if (s > 85) { r += 40 * pulse; }
        }
      } else {
        r *= 0.42; gg *= 0.45; b *= 0.5;
        if (!wet) {
          const f = Math.min(1.2, fert[ci]);
          const hr = 150 - 100 * f, hg = 80 + 160 * f, hb = 50 + 20 * f;
          r = r * 0.25 + hr * 0.75; gg = gg * 0.25 + hg * 0.75; b = b * 0.25 + hb * 0.75;
        }
      }
      data[o++] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[o++] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      data[o++] = b < 0 ? 0 : b > 255 ? 255 : b;
      data[o++] = 255;
    }
  }
  g.terrCtx.putImageData(g.terrImg, 0, 0);
}

function outline(ctx: CanvasRenderingContext2D, g: Game, pid: number) {
  const { top } = g;
  ctx.beginPath();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (top[i] !== pid) continue;
    const X = g.mx0 + x * g.cs, Y = g.my0 + y * g.cs;
    if (top[y * W + mod(x + 1, W)] !== pid) { ctx.moveTo(X + g.cs, Y); ctx.lineTo(X + g.cs, Y + g.cs); }
    if (top[y * W + mod(x - 1, W)] !== pid) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + g.cs); }
    if (y === 0 || top[i - W] !== pid) { ctx.moveTo(X, Y); ctx.lineTo(X + g.cs, Y); }
    if (y === H - 1 || top[i + W] !== pid) { ctx.moveTo(X, Y + g.cs); ctx.lineTo(X + g.cs, Y + g.cs); }
  }
  ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, stroke = 'rgba(0,0,0,0.75)') {
  ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size * 0.22); ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function drawSettlement(ctx: CanvasRenderingContext2D, g: Game, i: number, time: number) {
  const s = g.settlements[i];
  const cs = g.cs; const lvl = g.level(s);
  const X = g.mx0 + (s.rx + 0.5) * cs, Y = g.my0 + (s.ry + 0.5) * cs;
  const r = cs * (0.62 + 0.16 * lvl);
  const col = TRIBES[s.tribe].color;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(X, Y + r * 0.7, r * 1.05, r * 0.42, 0, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.283);
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = s.hit > 0 ? '#fff' : 'rgba(20,16,30,0.9)'; ctx.stroke();
  const u = r * 0.5;
  ctx.fillStyle = 'rgba(28,20,36,0.88)';
  ctx.beginPath();
  if (lvl === 1) { ctx.moveTo(X - u, Y + u * 0.8); ctx.lineTo(X, Y - u); ctx.lineTo(X + u, Y + u * 0.8); }
  else if (lvl === 2) { ctx.rect(X - u * 0.8, Y - u * 0.2, u * 1.6, u * 1.1); ctx.moveTo(X - u, Y - u * 0.2); ctx.lineTo(X, Y - u * 1.1); ctx.lineTo(X + u, Y - u * 0.2); }
  else { ctx.rect(X - u, Y - u * 0.5, u * 2, u * 1.4); ctx.rect(X - u, Y - u * 0.9, u * 0.5, u * 0.5); ctx.rect(X - u * 0.25, Y - u * 0.9, u * 0.5, u * 0.5); ctx.rect(X + u * 0.5, Y - u * 0.9, u * 0.5, u * 0.5); }
  ctx.fill();
  if (lvl === 4) { ctx.fillRect(X - 1, Y - u * 2, 2, u * 1.2); ctx.fillStyle = col; ctx.fillRect(X + 1, Y - u * 2, u * 0.9, u * 0.6); }
  if (s.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${s.hit * 0.6})`; ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.283); ctx.fill(); }
  if (s.bad > 0) text(ctx, '!', X, Y - r - cs * 0.6, cs * 1.4, '#ff5a4a');
  if (cs >= 6) text(ctx, String(Math.floor(s.pop)), X, Y + r + cs * 0.75, Math.max(9, cs * 1.05), '#fff');
  void time;
}

export function renderGame(g: Game, dt: number) {
  const { ctx, cs } = g;
  const time = g.time;
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, g.ch);
  bg.addColorStop(0, '#07091a'); bg.addColorStop(1, '#150d26');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, g.cw, g.ch);
  for (const st of g.stars) {
    ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(time * 0.6 + st.a * 9));
    ctx.fillStyle = '#cfd8ff'; ctx.fillRect(st.x * g.cw, st.y * g.ch, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  g.terrAcc += dt;
  if (g.terrAcc > 0.045) { g.terrAcc = 0; paintTerrain(g, time); }

  ctx.save();
  if (g.meta.settings.shake && g.shake > 0.01) {
    const m = g.shake * g.shake * 16 + g.shake * 2;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  const MW = W * cs, MH = H * cs;
  // planet glow
  ctx.shadowColor = 'rgba(120,160,255,0.35)'; ctx.shadowBlur = 30; ctx.fillStyle = '#000';
  ctx.fillRect(g.mx0, g.my0, MW, MH); ctx.shadowBlur = 0;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(g.terr, g.mx0, g.my0, MW, MH);

  // plate boundaries
  ctx.save();
  ctx.beginPath(); ctx.rect(g.mx0, g.my0, MW, MH); ctx.clip();
  const showPlates = g.overlay === 1;
  ctx.strokeStyle = showPlates ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = showPlates ? 1.6 : 1;
  ctx.beginPath();
  const top = g.top;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; const X = g.mx0 + x * cs, Y = g.my0 + y * cs;
    if (top[i] !== top[y * W + mod(x + 1, W)]) { ctx.moveTo(X + cs, Y); ctx.lineTo(X + cs, Y + cs); }
    if (y < H - 1 && top[i] !== top[i + W]) { ctx.moveTo(X, Y + cs); ctx.lineTo(X + cs, Y + cs); }
  }
  ctx.stroke();
  // hovered / dragged plate
  let hp = -1;
  if (g.drag) hp = g.drag.p.id;
  else if (g.state === 'playing' && !g.paused && g.tool === 'drag' && g.mouse.inside) { const i = g.idx(g.mouse.mx, g.mouse.my); hp = top[i]; }
  g.hoverPlate = hp;
  if (hp >= 0) {
    ctx.strokeStyle = g.drag ? '#ffe9a0' : 'rgba(255,255,255,0.75)'; ctx.lineWidth = g.drag ? 2.6 : 1.8;
    ctx.shadowColor = g.drag ? '#ffcc55' : '#fff'; ctx.shadowBlur = 8;
    outline(ctx, g, hp); ctx.shadowBlur = 0;
  }
  ctx.restore();

  // seismograph markers
  if (g.upg('seismograph') && g.state === 'playing') {
    const marks: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i += 2) {
      if (g.stress[i] < 90) continue;
      const x = i % W, y = (i / W) | 0;
      if (marks.some((m) => Math.abs(wrapDX(m.x, x)) < 7 && Math.abs(m.y - y) < 7)) continue;
      marks.push({ x, y }); if (marks.length >= 8) break;
    }
    for (const m of marks) {
      const X = g.mx0 + (m.x + 0.5) * cs, Y = g.my0 + (m.y + 0.5) * cs, k = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.strokeStyle = `rgba(255,80,80,${0.5 + k * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, cs * (1.4 + k), 0, 6.283); ctx.stroke();
      text(ctx, '▼', X, Y - cs * 2.4, cs * 1.4, '#ff6b6b');
    }
  }

  // relation links
  if (g.meta.settings.lines) {
    for (const l of g.links) {
      const a = g.tribes[l.ta]; const war = a.war[l.tb]; const trade = a.trade[l.tb];
      const ax = l.a.rx + 0.5, ay = l.a.ry + 0.5; const dx = wrapDX(l.b.rx, l.a.rx), dy = l.b.ry - l.a.ry;
      const X1 = g.mx0 + ax * cs, Y1 = g.my0 + ay * cs, X2 = X1 + dx * cs, Y2 = Y1 + dy * cs;
      ctx.lineWidth = war ? 2.4 : trade ? 1.8 : 1;
      ctx.strokeStyle = war ? `rgba(255,70,50,${0.6 + 0.4 * Math.sin(time * 8)})` : trade ? 'rgba(120,255,160,0.7)' : 'rgba(220,220,255,0.28)';
      ctx.setLineDash(l.sea ? [cs * 0.8, cs * 0.6] : war ? [cs * 0.4, cs * 0.3] : []);
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.stroke(); ctx.setLineDash([]);
      if (trade) {
        const k = (time * 0.25 + l.a.id * 0.13) % 1;
        ctx.fillStyle = '#c7ffd6'; ctx.beginPath(); ctx.arc(X1 + (X2 - X1) * k, Y1 + (Y2 - Y1) * k, cs * 0.3, 0, 6.283); ctx.fill();
      }
      if (war) text(ctx, '⚔', (X1 + X2) / 2, (Y1 + Y2) / 2, cs * 1.8, '#fff');
    }
  }

  // sanctuaries
  for (const s of g.sanctuaries) {
    const X = g.mx0 + s.x * cs, Y = g.my0 + s.y * cs, R = s.r * cs;
    const gr = ctx.createRadialGradient(X, Y, R * 0.2, X, Y, R);
    gr.addColorStop(0, 'rgba(150,230,255,0.04)'); gr.addColorStop(1, `rgba(150,230,255,${0.22 * Math.min(1, s.t / 3)})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, R, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([cs * 1.2, cs * 0.7]); ctx.lineDashOffset = -time * 20;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
  }

  // volcano icons
  for (const v of g.volcanoes) {
    const X = g.mx0 + v.x * cs, Y = g.my0 + v.y * cs, r = cs * 1.5;
    if (v.state === 'erupting') {
      const gr = ctx.createRadialGradient(X, Y, 0, X, Y, r * 3);
      gr.addColorStop(0, 'rgba(255,150,40,0.7)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r * 3, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#3a2420'; ctx.beginPath(); ctx.moveTo(X - r, Y + r * 0.7); ctx.lineTo(X - r * 0.25, Y - r * 0.7); ctx.lineTo(X + r * 0.25, Y - r * 0.7); ctx.lineTo(X + r, Y + r * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = v.state === 'dormant' ? '#6a5a55' : '#ff7a2a'; ctx.fillRect(X - r * 0.25, Y - r * 0.8, r * 0.5, r * 0.25);
  }

  // titan
  const ti = g.titan;
  if (ti) {
    const X = g.mx0 + ti.x * cs, Y = g.my0 + ti.y * cs, R = cs * 6;
    const al = ti.dead ? Math.max(0.15, 1 - ti.deadT / 3.5) : 1;
    ctx.globalAlpha = al; ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(X, Y, 0, X, Y, R);
    gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.25, 'rgba(255,130,40,0.7)'); gr.addColorStop(0.6, 'rgba(190,40,20,0.35)'); gr.addColorStop(1, 'rgba(120,10,10,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, R * (1 + 0.05 * Math.sin(time * 4)), 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,${150 + k * 30},80,0.7)`; ctx.setLineDash([cs * 1.4, cs * 0.9]); ctx.lineDashOffset = -time * (14 + k * 8) * (k % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(X, Y, R * (0.3 + 0.18 * k), 0, 6.283); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(60,10,5,0.9)'; ctx.lineWidth = 2.5;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.283 + 0.3, l = R * (0.45 + 0.25 * Math.sin(k * 2.7 + time));
      ctx.beginPath(); ctx.moveTo(X + Math.cos(a) * R * 0.12, Y + Math.sin(a) * R * 0.12); ctx.lineTo(X + Math.cos(a + 0.2) * l * 0.6, Y + Math.sin(a + 0.2) * l * 0.6); ctx.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); ctx.stroke();
    }
    if (!ti.dead) {
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(X, Y, R * 1.08, 0, 6.283); ctx.stroke();
      const f = Math.max(0, ti.hp / ti.max);
      ctx.strokeStyle = f > 0.66 ? '#ff6a3a' : f > 0.33 ? '#ffb23a' : '#ffe96a';
      ctx.beginPath(); ctx.arc(X, Y, R * 1.08, -Math.PI / 2, -Math.PI / 2 + 6.283 * f); ctx.stroke();
      if (ti.tele > 0) {
        const k = 1 - ti.tele / 2.5;
        ctx.strokeStyle = `rgba(255,50,30,${0.9 - k * 0.5})`; ctx.lineWidth = 4 + 3 * Math.sin(time * 20);
        ctx.beginPath(); ctx.arc(X, Y, R * (0.4 + k * 2.2), 0, 6.283); ctx.stroke();
      }
      text(ctx, 'TITAN', X, Y - R * 1.3, Math.max(12, cs * 1.8), '#ffd9a0');
    }
    ctx.globalAlpha = 1;
  }

  // tsunamis
  for (const t of g.tsunamis) {
    const X = g.mx0 + t.x * cs, Y = g.my0 + t.y * cs, a = Math.max(0, 1 - t.r / t.maxR);
    ctx.strokeStyle = `rgba(160,230,255,${0.25 + a * 0.55})`; ctx.lineWidth = cs * 0.9 * (0.4 + a);
    ctx.beginPath(); ctx.arc(X, Y, t.r * cs, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X, Y, t.r * cs, 0, 6.283); ctx.stroke();
  }

  // settlements (smooth positions)
  for (let i = 0; i < g.settlements.length; i++) {
    const s = g.settlements[i];
    const dx = wrapDX(s.x, s.rx), dy = s.y - s.ry;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { s.rx = s.x; s.ry = s.y; }
    else { const k = Math.min(1, dt * 12); s.rx = mod(s.rx + dx * k, W); s.ry += dy * k; }
    drawSettlement(ctx, g, i, time);
  }

  // prayers
  for (const p of g.prayers) {
    const s = g.settlements.find((q) => q.id === p.sid); if (!s) continue;
    const X = g.mx0 + (s.rx + 0.5) * cs, Y = g.my0 + (s.ry - 1.6) * cs + Math.sin(time * 3 + p.id) * cs * 0.3;
    const rr = cs * 1.15; const fade = Math.min(1, (p.ttl - p.t) / 3);
    ctx.globalAlpha = fade;
    const gr = ctx.createRadialGradient(X, Y, 0, X, Y, rr * 1.8);
    gr.addColorStop(0, 'rgba(255,240,170,0.9)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, rr * 1.8, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff6cc'; ctx.beginPath(); ctx.arc(X, Y, rr * 0.8, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, rr, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - p.t / p.ttl)); ctx.stroke();
    text(ctx, '✦', X, Y, rr * 1.1, '#c47a00', 'rgba(255,255,255,0.0)');
    ctx.globalAlpha = 1;
  }

  // rings
  for (const r of g.rings) {
    const X = g.mx0 + r.x * cs, Y = g.my0 + r.y * cs, a = Math.max(0, r.life / r.maxLife);
    ctx.globalAlpha = Math.min(1, a * 1.4); ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(1.5, r.w * cs * a * 2);
    ctx.beginPath(); ctx.arc(X, Y, Math.max(1, r.r * cs), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // particles
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.max);
    const X = g.mx0 + p.x * cs, Y = g.my0 + p.y * cs;
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a * 1.3); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(X, Y, Math.max(0.6, p.size * cs * (p.add ? a : 1.2 - a * 0.3)), 0, 6.283); ctx.fill();
    if (p.add) ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;

  // tool cursor
  if (g.state === 'playing' && !g.paused && g.mouse.inside && !g.drag) {
    const def = TOOLS.find((d) => d.id === g.tool)!;
    const X = g.mx0 + g.mouse.mx * cs, Y = g.my0 + g.mouse.my * cs;
    if (def.radius > 0) {
      const col = g.tool === 'bless' ? '#9dff8a' : g.tool === 'sanct' ? '#9be7ff' : g.tool === 'volcano' ? '#ff8a3a' : g.tool === 'omen' ? '#ffffff' : '#ffb347';
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([cs * 0.8, cs * 0.5]); ctx.lineDashOffset = -time * 14;
      ctx.beginPath(); ctx.arc(X, Y, def.radius * cs, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, def.icon, X, Y, cs * 1.8, '#fff', 'rgba(0,0,0,0.4)');
    } else if (g.tool === 'tide') text(ctx, g.tideLower ? '🌊 ▼' : '🌊 ▲', X, Y, cs * 2, '#bfe9ff');
  }
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(g.cw / 2, g.ch / 2, Math.min(g.cw, g.ch) * 0.45, g.cw / 2, g.ch / 2, Math.max(g.cw, g.ch) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, g.cw, g.ch);

  // floating texts (drawn unshaken)
  for (const f of g.floats) {
    const a = Math.min(1, f.life / (f.max * 0.4));
    ctx.globalAlpha = a;
    const pop = 1 + Math.max(0, (f.life - f.max * 0.85) * 4);
    text(ctx, f.text, g.mx0 + f.x * cs, g.my0 + f.y * cs, Math.max(11, Math.min(26, cs * 1.25 * f.size)) * pop, f.color);
  }
  ctx.globalAlpha = 1;
}
