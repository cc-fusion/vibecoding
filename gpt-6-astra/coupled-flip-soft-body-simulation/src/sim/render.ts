import { FluidSolver } from './solver';
export interface ViewOptions { particles: boolean; mesh: boolean; grid: boolean; velocity: boolean; pressure: boolean }
export const defaultView: ViewOptions = { particles: true, mesh: true, grid: false, velocity: false, pressure: false };
export function viewport(canvas: HTMLCanvasElement, solver: FluidSolver) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const scale = Math.min((w - 58) / solver.width, (h - 58) / solver.height);
  return { w, h, scale, left: (w - solver.width * scale) / 2, top: (h - solver.height * scale) / 2 - 4 };
}
export function render(canvas: HTMLCanvasElement, solver: FluidSolver, view: ViewOptions, clock: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), width = canvas.clientWidth, height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { w, h, scale, left, top } = viewport(canvas, solver);
  const px = (x: number) => left + x * scale, py = (y: number) => top + (solver.height - y) * scale;
  ctx.fillStyle = '#102b30'; ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createRadialGradient(w * .48, h * .75, 0, w * .48, h * .55, w * .7);
  gradient.addColorStop(0, '#173c3e'); gradient.addColorStop(1, '#10282e'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  const gridStep = view.grid ? solver.h : 1;
  ctx.strokeStyle = view.grid ? '#80b9ac19' : '#80b9ac0c';
  ctx.beginPath();
  for (let x = 0; x <= solver.width + .001; x += gridStep) { ctx.moveTo(px(x), py(0)); ctx.lineTo(px(x), py(solver.height)); }
  for (let y = 0; y <= solver.height + .001; y += gridStep) { ctx.moveTo(px(0), py(y)); ctx.lineTo(px(solver.width), py(y)); }
  ctx.stroke();
  // Pressure is a cell diagnostic, not a smoothed fluid-surface reconstruction.
  if (view.pressure) {
    for (let j = 0; j < solver.ny; j++) for (let i = 0; i < solver.nx; i++) {
      const k = i + j * solver.nx; if (solver.type[k] !== 1) continue;
      ctx.fillStyle = `rgba(174,225,95,${Math.min(.6, Math.abs(solver.q[k]) * 3)})`;
      ctx.fillRect(px(i * solver.h), py((j + 1) * solver.h), solver.h * scale + .3, solver.h * scale + .3);
    }
  }
  if (view.particles) {
    const radius = Math.max(.75, Math.min(1.6, scale * solver.h * .13));
    // Bucket colors to avoid per-particle context-state changes.
    const colors = ['#36a7a0', '#49c0b1', '#73d7c0', '#a1e8cd', '#cdf7db'];
    for (let bucket = 0; bucket < colors.length; bucket++) {
      ctx.fillStyle = colors[bucket]; ctx.beginPath();
      for (let i = 0; i < solver.particles.length; i++) {
        const p = solver.particles[i], speed = Math.hypot(p.vx, p.vy);
        const b = Math.min(4, Math.floor(speed * .62 + (i % 7) * .28)); if (b !== bucket) continue;
        const x = px(p.x), y = py(p.y); ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  const nodes = solver.nodes;
  ctx.beginPath(); solver.outline.forEach((id, i) => { const n = nodes[id]; if (i === 0) ctx.moveTo(px(n.x), py(n.y)); else ctx.lineTo(px(n.x), py(n.y)); }); ctx.closePath();
  const solidGradient = ctx.createLinearGradient(0, py(solver.bounds.maxY), 0, py(solver.bounds.minY));
  solidGradient.addColorStop(0, '#c2e98755'); solidGradient.addColorStop(1, '#99ce6a22'); ctx.fillStyle = solidGradient; ctx.fill();
  ctx.strokeStyle = '#c5ed91'; ctx.lineWidth = 1.5; ctx.stroke();
  if (view.mesh) {
    ctx.lineWidth = .8; ctx.strokeStyle = '#c2e99485'; ctx.beginPath();
    for (let j = 0; j < solver.rows; j++) for (let i = 0; i < solver.cols; i++) {
      const k = i + j * solver.cols, n = nodes[k];
      const edge = (id: number) => { ctx.moveTo(px(n.x), py(n.y)); ctx.lineTo(px(nodes[id].x), py(nodes[id].y)); };
      if (i < solver.cols - 1) edge(k + 1); if (j < solver.rows - 1) edge(k + solver.cols);
      if (i < solver.cols - 1 && j < solver.rows - 1) edge(k + solver.cols + 1);
    }
    ctx.stroke(); ctx.fillStyle = '#dcf7b3';
    for (const n of nodes) { ctx.beginPath(); ctx.arc(px(n.x), py(n.y), 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  if (view.velocity) {
    ctx.strokeStyle = '#d7edd48c'; ctx.lineWidth = 1; ctx.beginPath();
    for (let j = 1; j < solver.ny; j += 3) for (let i = 1; i < solver.nx; i += 3) {
      if (solver.type[i + j * solver.nx] !== 1) continue;
      const x = (i + .5) * solver.h, y = (j + .5) * solver.h, vx = solver.sample(solver.u, x, y, 0), vy = solver.sample(solver.v, x, y, 1);
      const ax = px(x), ay = py(y), bx = px(x + vx * .075), by = py(y + vy * .075), angle = Math.atan2(by - ay, bx - ax);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(bx - 3 * Math.cos(angle - .5), by - 3 * Math.sin(angle - .5)); ctx.lineTo(bx, by); ctx.lineTo(bx - 3 * Math.cos(angle + .5), by - 3 * Math.sin(angle + .5));
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#729c9338'; ctx.lineWidth = 1; ctx.strokeRect(left, top, solver.width * scale, solver.height * scale);
  ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#7e9c9d'; ctx.textAlign = 'center';
  for (let x = 0; x <= 12; x += 2) ctx.fillText(`${x}`, px(x), py(0) + 16);
  ctx.textAlign = 'right'; for (let y = 0; y <= 6; y += 2) ctx.fillText(`${y}`, left - 10, py(y) + 3);
  ctx.fillText('m', px(12) + 16, py(0) + 16);
  if (solver.pointer) {
    ctx.strokeStyle = '#cef4d769'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(px(solver.pointer.x), py(solver.pointer.y), scale * .7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  void clock;
}
