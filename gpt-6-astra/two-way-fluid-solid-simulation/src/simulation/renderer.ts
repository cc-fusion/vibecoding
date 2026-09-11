import { Simulation } from './engine';
export type ViewMode = 'Particles' | 'Surface' | 'Velocity' | 'Pressure';
export interface ViewSettings { grid: boolean; mesh: boolean; mode: ViewMode; trails: boolean }
export const inset = { left: 40, right: 27, top: 34, bottom: 31 };
export function screenToWorld(canvas: HTMLCanvasElement, sim: Simulation, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left - inset.left) / (rect.width - inset.left - inset.right) * sim.width, y: (rect.height - inset.bottom - (clientY - rect.top)) / (rect.height - inset.top - inset.bottom) * sim.height };
}
export function draw(canvas: HTMLCanvasElement, sim: Simulation, view: ViewSettings) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height, l = inset.left, t = inset.top, pw = w - l - inset.right, ph = h - t - inset.bottom;
  const sx = pw / sim.width, sy = ph / sim.height, X = (x: number) => l + x * sx, Y = (y: number) => t + ph - y * sy;
  ctx.fillStyle = '#101e2d'; ctx.fillRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, t, 0, h); bg.addColorStop(0, '#101e2d'); bg.addColorStop(1, '#12273a'); ctx.fillStyle = bg; ctx.fillRect(l, t, pw, ph);
  ctx.lineWidth = 0.65; ctx.strokeStyle = view.grid ? '#294052' : '#1a2c3d';
  const gridStep = view.grid ? 0.5 : 1;
  ctx.beginPath();
  for (let x = 0; x <= sim.width; x += gridStep) { ctx.moveTo(X(x), t); ctx.lineTo(X(x), t + ph); }
  for (let y = 0; y <= sim.height; y += gridStep) { ctx.moveTo(l, Y(y)); ctx.lineTo(l + pw, Y(y)); }
  ctx.stroke();
  ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#546777'; ctx.textAlign = 'center';
  for (let x = 0; x <= 10; x += 2) ctx.fillText(x.toFixed(1), X(x), h - 13);
  ctx.textAlign = 'right'; for (let y = 0; y <= 5; y++) ctx.fillText(y.toFixed(1), l - 11, Y(y) + 3);
  ctx.save(); ctx.beginPath(); ctx.rect(l, t, pw, ph); ctx.clip();
  const p = sim.particles;
  if (view.mode === 'Pressure') {
    const g = sim.grid;
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const k = i + j * g.nx; if (g.type[k] !== 1) continue;
      const value = Math.max(0, Math.min(1, g.pressure[k] / 22000));
      ctx.fillStyle = `hsla(${205 - 165 * value}, 74%, ${35 + value * 24}%, 0.8)`;
      ctx.fillRect(X(i * g.h), Y((j + 1) * g.h), sx * g.h + 0.5, sy * g.h + 0.5);
    }
  }
  if (view.mode === 'Surface') {
    // A display-only density field; never fed into physical boundaries.
    ctx.fillStyle = '#258aca';
    for (let k = 0; k < p.count; k++) { ctx.beginPath(); ctx.arc(X(p.x[k]), Y(p.y[k]), Math.max(2.5, sx * 0.045), 0, Math.PI * 2); ctx.fill(); }
  } else {
    const colors = ['#287caf', '#318fc6', '#39a0d7', '#52b6e7', '#80d3f4'];
    const buckets: number[][] = colors.map(() => []);
    for (let k = 0; k < p.count; k++) {
      const speed = Math.hypot(p.vx[k], p.vy[k]);
      const bucket = view.mode === 'Velocity' ? Math.min(4, Math.floor(speed * 0.9)) : Math.min(4, Math.floor((p.y[k] / sim.height * 2.3 + speed * 0.15 + (k % 7) / 7) * 2));
      buckets[bucket].push(k);
    }
    const r = Math.max(0.85, Math.min(1.65, sx * 0.018));
    for (let b = 0; b < buckets.length; b++) {
      ctx.fillStyle = colors[b]; ctx.beginPath();
      for (const k of buckets[b]) { const x = X(p.x[k]), y = Y(p.y[k]); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    if (view.trails || view.mode === 'Velocity') {
      ctx.strokeStyle = '#83dbf766'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let k = 0; k < p.count; k += 8) { ctx.moveTo(X(p.x[k]), Y(p.y[k])); ctx.lineTo(X(p.x[k] - p.vx[k] * 0.045), Y(p.y[k] - p.vy[k] * 0.045)); }
      ctx.stroke();
    }
  }
  const body = sim.solid;
  ctx.save(); ctx.globalAlpha = body.enabled ? 1 : 0.38;
  ctx.beginPath(); body.boundary.forEach((i, j) => { const n = body.nodes[i]; if (j === 0) ctx.moveTo(X(n.x), Y(n.y)); else ctx.lineTo(X(n.x), Y(n.y)); }); ctx.closePath();
  const gradient = ctx.createLinearGradient(X(body.bounds.minX), Y(body.bounds.maxY), X(body.bounds.maxX), Y(body.bounds.minY));
  gradient.addColorStop(0, '#b6f4c7'); gradient.addColorStop(0.55, '#80d6b5'); gradient.addColorStop(1, '#51a99c');
  ctx.fillStyle = gradient; ctx.shadowColor = '#79debd33'; ctx.shadowBlur = 19; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#c1f6d9'; ctx.lineWidth = 1.3; ctx.stroke();
  if (view.mesh) {
    for (const tr of body.triangles) {
      const a = body.nodes[tr.a], b = body.nodes[tr.b], c = body.nodes[tr.c];
      const area = Math.abs(((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2);
      ctx.fillStyle = `rgba(20,94,86,${Math.min(0.2, Math.abs(area / tr.rest - 1) * 0.3 + (tr.a % 5) * 0.018)})`;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.lineTo(X(c.x), Y(c.y)); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#286d6866'; ctx.lineWidth = 0.75; ctx.beginPath();
    for (const e of body.edges) { const a = body.nodes[e.a], b = body.nodes[e.b]; ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); } ctx.stroke();
    ctx.fillStyle = '#d0ffe0';
    for (const i of body.boundary) { const n = body.nodes[i]; ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), 1.65, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore(); ctx.restore();
  ctx.strokeStyle = '#425364'; ctx.lineWidth = 1; ctx.beginPath();
  for (const [x, y, dx, dy] of [[l, t, 1, 1], [l + pw, t, -1, 1], [l, t + ph, 1, -1], [l + pw, t + ph, -1, -1]]) { ctx.moveTo(x + dx * 10, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 10); } ctx.stroke();
}
