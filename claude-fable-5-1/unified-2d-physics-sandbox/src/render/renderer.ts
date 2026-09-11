// Unified Canvas 2D renderer: fluid, rigid bodies, soft bodies, constraints, editor overlays and debug views all
// draw through one world→screen transform. DPR only affects the backing resolution.
import type { World } from '../sim/world';
import type { Editor, View } from '../editor/editor';
import { CELL_FLUID, CELL_SOLID } from '../sim/flip';
import { rotate } from '../sim/geometry';

const ACCENT = '#ffb454', SEL = '#4cc2ff', FLUID = [
  'rgba(58, 132, 214, 0.92)', 'rgba(86, 166, 236, 0.92)', 'rgba(140, 205, 255, 0.95)',
];

export class Renderer {
  ctx: CanvasRenderingContext2D;
  view: View = { scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1 };
  dpr = 1;
  private worldW = 1; private worldH = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(worldW: number, worldH: number) {
    const cssW = Math.max(1, this.canvas.clientWidth), cssH = Math.max(1, this.canvas.clientHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const bw = Math.round(cssW * this.dpr), bh = Math.round(cssH * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) { this.canvas.width = bw; this.canvas.height = bh; }
    this.worldW = worldW; this.worldH = worldH;
    const margin = 6;
    const scale = Math.min((cssW - 2 * margin) / worldW, (cssH - 2 * margin) / worldH);
    this.view = { scale, ox: (cssW - worldW * scale) / 2, oy: (cssH - worldH * scale) / 2, cssW, cssH };
  }

  render(world: World, editor: Editor) {
    if (world.settings.width !== this.worldW || world.settings.height !== this.worldH || this.canvas.clientWidth !== this.view.cssW || this.canvas.clientHeight !== this.view.cssH) {
      this.resize(world.settings.width, world.settings.height);
    }
    editor.view = this.view;
    const ctx = this.ctx, v = this.view, ui = world.ui, dbg = ui.debug;
    const px = 1 / v.scale; // one CSS pixel in world units
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#101317';
    ctx.fillRect(0, 0, v.cssW, v.cssH);
    ctx.translate(v.ox, v.oy); ctx.scale(v.scale, v.scale);
    const W = world.settings.width, H = world.settings.height;
    ctx.fillStyle = '#1a1f27';
    ctx.fillRect(0, 0, W, H);

    if (ui.grid) this.drawGrid(W, H, ui.gridSize, px);
    if (dbg.fluidCells || dbg.fluidGrid) this.drawFluidGrid(world, dbg.fluidCells, dbg.fluidGrid, px);
    this.drawRegions(world, editor, px);
    this.drawFluid(world, dbg.fluidParticles, px);
    if (dbg.velocity) this.drawVelocity(world, px);
    this.drawRigid(world, dbg.rigidOutlines, px);
    this.drawSoft(world, dbg.softNodes, dbg.softSprings, px);
    this.drawConstraints(world, editor, px);
    this.drawSelection(world, editor, px);
    this.drawEditorOverlays(editor, px);

    // world border
    ctx.strokeStyle = '#3b4453'; ctx.lineWidth = 2 * px; ctx.strokeRect(0, 0, W, H);
  }

  private drawGrid(W: number, H: number, size: number, px: number) {
    const ctx = this.ctx;
    if (size * this.view.scale < 6) return;
    ctx.beginPath();
    for (let x = 0; x <= W; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += size) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = px; ctx.stroke();
  }

  private drawFluidGrid(world: World, cells: boolean, lines: boolean, px: number) {
    const ctx = this.ctx, f = world.fluid, h = f.h;
    if (cells) {
      for (let i = 1; i < f.numX - 1; i++) {
        for (let j = 1; j < f.numY - 1; j++) {
          const t = f.cellType[i * f.numY + j];
          if (t === CELL_FLUID) ctx.fillStyle = 'rgba(40, 110, 200, 0.35)';
          else if (t === CELL_SOLID) ctx.fillStyle = 'rgba(200, 80, 60, 0.35)';
          else continue;
          ctx.fillRect((i - 1) * h, (j - 1) * h, h, h);
        }
      }
    }
    if (lines && h * this.view.scale > 3) {
      ctx.beginPath();
      for (let i = 0; i <= f.numX - 2; i++) { ctx.moveTo(i * h, 0); ctx.lineTo(i * h, world.settings.height); }
      for (let j = 0; j <= f.numY - 2; j++) { ctx.moveTo(0, j * h); ctx.lineTo(world.settings.width, j * h); }
      ctx.strokeStyle = 'rgba(120, 170, 255, 0.18)'; ctx.lineWidth = px; ctx.stroke();
    }
  }

  private drawRegions(world: World, editor: Editor, px: number) {
    const ctx = this.ctx;
    const showFill = world.ui.debug.fluidRegions || editor.tool === 'fluid';
    for (const [id, r] of world.regions) {
      if (r.type === 'fill' && !showFill && !editor.selection.has(id)) continue;
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.strokeStyle = r.type === 'emitter' ? 'rgba(90, 220, 255, 0.8)' : 'rgba(90, 160, 255, 0.5)';
      ctx.lineWidth = 1.5 * px;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
      if (r.type === 'emitter') {
        ctx.fillStyle = 'rgba(90, 220, 255, 0.12)'; ctx.fillRect(r.x, r.y, r.w, r.h);
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, sp = Math.hypot(r.vx, r.vy);
        if (sp > 1) { const s = Math.min(60, sp * 0.1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (r.vx / sp) * s, cy + (r.vy / sp) * s); ctx.strokeStyle = 'rgba(90,220,255,0.9)'; ctx.stroke(); }
      }
    }
  }

  private drawFluid(world: World, debug: boolean, px: number) {
    const ctx = this.ctx, f = world.fluid, n = f.numParticles, pos = f.pos, vel = f.vel;
    if (n === 0) return;
    const r = debug ? Math.max(f.particleRadius * 0.6, 1.5 * px) : f.particleRadius * 1.55;
    const TAU = Math.PI * 2;
    for (let bin = 0; bin < 3; bin++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const sp = Math.abs(vel[2 * i]) + Math.abs(vel[2 * i + 1]);
        const b = sp < 120 ? 0 : sp < 400 ? 1 : 2;
        if (b !== bin) continue;
        const x = pos[2 * i], y = pos[2 * i + 1];
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        any = true;
      }
      if (!any) continue;
      ctx.fillStyle = debug ? ['#3a84d6', '#8ad1ff', '#ffffff'][bin] : FLUID[bin];
      ctx.fill();
    }
  }

  private drawVelocity(world: World, px: number) {
    const ctx = this.ctx, f = world.fluid, h = f.h, n = f.numY;
    ctx.beginPath();
    const stride = h * this.view.scale < 14 ? 2 : 1;
    for (let i = 1; i < f.numX - 1; i += stride) {
      for (let j = 1; j < f.numY - 1; j += stride) {
        const c = i * n + j;
        if (f.cellType[c] !== CELL_FLUID) continue;
        const cx = (i - 0.5) * h, cy = (j - 0.5) * h;
        const vx = 0.5 * (f.u[c] + f.u[c + n]), vy = 0.5 * (f.v[c] + f.v[c + 1]);
        const k = 0.04;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + vx * k, cy + vy * k);
      }
    }
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.8)'; ctx.lineWidth = px; ctx.stroke();
  }

  private drawRigid(world: World, debug: boolean, px: number) {
    const ctx = this.ctx;
    for (const e of world.rigid.values()) {
      const b = e.body, parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      ctx.beginPath();
      for (const p of parts) {
        const vs = p.vertices;
        ctx.moveTo(vs[0].x, vs[0].y);
        for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y);
        ctx.closePath();
      }
      if (e.def.isSensor) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.setLineDash([5 * px, 4 * px]); }
      else { ctx.fillStyle = e.def.color; ctx.fill(); }
      ctx.strokeStyle = b.isStatic ? '#5a6474' : 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5 * px; ctx.stroke();
      ctx.setLineDash([]);
      if (b.isStatic && !e.def.isSensor) {
        // hatch static geometry lightly
        ctx.save(); ctx.clip();
        ctx.beginPath();
        const bb = b.bounds, step = 14;
        for (let x = bb.min.x - (bb.max.y - bb.min.y); x < bb.max.x; x += step) { ctx.moveTo(x, bb.min.y); ctx.lineTo(x + (bb.max.y - bb.min.y), bb.max.y); }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = px; ctx.stroke();
        ctx.restore();
      } else if (e.def.shape === 'circle') {
        // orientation tick
        const r = e.def.radius;
        ctx.beginPath(); ctx.moveTo(b.position.x, b.position.y); ctx.lineTo(b.position.x + Math.cos(b.angle) * r, b.position.y + Math.sin(b.angle) * r);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5 * px; ctx.stroke();
      }
      if (debug) {
        ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = px; ctx.setLineDash([3 * px, 3 * px]);
        ctx.strokeRect(b.bounds.min.x, b.bounds.min.y, b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y);
        ctx.setLineDash([]);
        for (const p of parts) { ctx.beginPath(); const vs = p.vertices; ctx.moveTo(vs[0].x, vs[0].y); for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y); ctx.closePath(); ctx.strokeStyle = '#ffd166'; ctx.stroke(); }
        const v = b.velocity;
        ctx.beginPath(); ctx.moveTo(b.position.x, b.position.y); ctx.lineTo(b.position.x + v.x * 8, b.position.y + v.y * 8); ctx.strokeStyle = '#7CFC98'; ctx.stroke();
      }
    }
  }

  private drawSoft(world: World, nodes: boolean, springs: boolean, px: number) {
    const ctx = this.ctx;
    for (const sb of world.soft.values()) {
      const p = sb.pos, n = sb.n;
      ctx.beginPath();
      // smooth closed curve through edge midpoints
      let mx = (p[0] + p[2]) / 2, my = (p[1] + p[3]) / 2;
      ctx.moveTo(mx, my);
      for (let i = 1; i <= n; i++) {
        const c = i % n, nx = (i + 1) % n;
        mx = (p[2 * c] + p[2 * nx]) / 2; my = (p[2 * c + 1] + p[2 * nx + 1]) / 2;
        ctx.quadraticCurveTo(p[2 * c], p[2 * c + 1], mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = sb.def.color; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * px; ctx.stroke();
      if (springs) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = (i + 2) % n; ctx.moveTo(p[2 * i], p[2 * i + 1]); ctx.lineTo(p[2 * j], p[2 * j + 1]); ctx.moveTo(p[2 * i], p[2 * i + 1]); ctx.lineTo(p[2 * k], p[2 * k + 1]); }
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = px; ctx.stroke();
      }
      if (nodes) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { ctx.moveTo(p[2 * i] + 2.5 * px, p[2 * i + 1]); ctx.arc(p[2 * i], p[2 * i + 1], 2.5 * px, 0, Math.PI * 2); }
        ctx.fillStyle = '#fff'; ctx.fill();
        for (const pin of sb.pins) { ctx.beginPath(); ctx.arc(pin.x, pin.y, 4 * px, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill(); }
      }
    }
  }

  private drawConstraints(world: World, editor: Editor, px: number) {
    const ctx = this.ctx;
    for (const [id, e] of world.constraints) {
      const ep = editor.constraintEndpoints(id);
      if (!ep) continue;
      const selected = editor.selection.has(id);
      const color = selected ? SEL : '#d8dee9';
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = (selected ? 2.5 : 1.5) * px;
      if (e.def.kind === 'pin') {
        ctx.beginPath(); ctx.arc(ep.a.x, ep.a.y, 6 * px, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ep.a.x, ep.a.y, 2 * px, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const dx = ep.b.x - ep.a.x, dy = ep.b.y - ep.a.y, len = Math.hypot(dx, dy);
      ctx.beginPath();
      if (e.def.kind === 'spring' && len > 1) {
        const coils = Math.max(4, Math.min(20, Math.round(len / 14))), amp = 6;
        const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
        ctx.moveTo(ep.a.x, ep.a.y);
        for (let i = 1; i < coils * 2; i++) {
          const t = i / (coils * 2), s = i % 2 === 0 ? 0 : (Math.floor(i / 2) % 2 === 0 ? amp : -amp);
          ctx.lineTo(ep.a.x + ux * len * t + nx * s, ep.a.y + uy * len * t + ny * s);
        }
        ctx.lineTo(ep.b.x, ep.b.y);
      } else { ctx.moveTo(ep.a.x, ep.a.y); ctx.lineTo(ep.b.x, ep.b.y); }
      ctx.stroke();
      // anchors
      const worldA = !e.def.bodyA, worldB = !e.def.bodyB && !e.def.softA;
      ctx.beginPath(); ctx.arc(ep.a.x, ep.a.y, 3.5 * px, 0, Math.PI * 2); ctx.arc(ep.b.x, ep.b.y, 3.5 * px, 0, Math.PI * 2); ctx.fill();
      if (worldA) { ctx.strokeRect(ep.a.x - 6 * px, ep.a.y - 6 * px, 12 * px, 12 * px); }
      if (worldB) { ctx.strokeRect(ep.b.x - 6 * px, ep.b.y - 6 * px, 12 * px, 12 * px); }
    }
    // drag constraints (interactive grab)
    for (const c of editor.dragConstraints) {
      const b = c.bodyB!, pb = rotate(c.pointB, b.angle - (c as any).angleB);
      ctx.beginPath(); ctx.moveTo(c.pointA.x, c.pointA.y); ctx.lineTo(b.position.x + pb.x, b.position.y + pb.y);
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5 * px; ctx.setLineDash([4 * px, 4 * px]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  private drawSelection(world: World, editor: Editor, px: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = SEL; ctx.lineWidth = 2 * px;
    for (const id of editor.selection) {
      const r = world.rigid.get(id);
      if (r) {
        const parts = r.body.parts.length > 1 ? r.body.parts.slice(1) : r.body.parts;
        ctx.beginPath();
        for (const p of parts) { const vs = p.vertices; ctx.moveTo(vs[0].x, vs[0].y); for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y); ctx.closePath(); }
        ctx.stroke();
        this.handles(r.body.bounds.min.x, r.body.bounds.min.y, r.body.bounds.max.x, r.body.bounds.max.y, px);
        continue;
      }
      const sb = world.soft.get(id);
      if (sb) {
        ctx.beginPath(); ctx.moveTo(sb.pos[0], sb.pos[1]);
        for (let i = 1; i < sb.n; i++) ctx.lineTo(sb.pos[2 * i], sb.pos[2 * i + 1]);
        ctx.closePath(); ctx.stroke();
        this.handles(sb.minX, sb.minY, sb.maxX, sb.maxY, px);
        continue;
      }
      const g = world.regions.get(id);
      if (g) { ctx.strokeRect(g.x, g.y, g.w, g.h); this.handles(g.x, g.y, g.x + g.w, g.y + g.h, px); }
    }
  }

  private handles(x0: number, y0: number, x1: number, y1: number, px: number) {
    const ctx = this.ctx;
    ctx.setLineDash([4 * px, 3 * px]); ctx.lineWidth = px; ctx.strokeStyle = 'rgba(76,194,255,0.7)';
    ctx.strokeRect(x0 - 4 * px, y0 - 4 * px, x1 - x0 + 8 * px, y1 - y0 + 8 * px);
    ctx.setLineDash([]);
    ctx.fillStyle = SEL;
    const s = 3 * px;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) ctx.fillRect(x - s - 4 * px * Math.sign(x - (x0 + x1) / 2), y - s - 4 * px * Math.sign(y - (y0 + y1) / 2), 2 * s, 2 * s);
    ctx.lineWidth = 2 * px; ctx.strokeStyle = SEL;
  }

  private drawEditorOverlays(editor: Editor, px: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = ACCENT; ctx.fillStyle = 'rgba(255,180,84,0.15)'; ctx.lineWidth = 1.5 * px;
    const pv = editor.preview;
    if (pv) {
      ctx.setLineDash([5 * px, 4 * px]);
      if (pv.type === 'rect' || pv.type === 'region' || pv.type === 'softRect') {
        const x = Math.min(pv.x0, pv.x1), y = Math.min(pv.y0, pv.y1), w = Math.abs(pv.x1 - pv.x0), h = Math.abs(pv.y1 - pv.y0);
        if (pv.type === 'region') { ctx.strokeStyle = '#5adcff'; ctx.fillStyle = 'rgba(90,220,255,0.15)'; }
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      } else if (pv.type === 'circle') {
        const r = Math.hypot(pv.x1 - pv.x0, pv.y1 - pv.y0);
        ctx.beginPath();
        if (pv.star) { const n = 5; for (let i = 0; i < 2 * n; i++) { const rr = i % 2 === 0 ? r : r * 0.5, a = (i / (2 * n)) * Math.PI * 2 - Math.PI / 2; const x = pv.x0 + Math.cos(a) * rr, y = pv.y0 + Math.sin(a) * rr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); }
        else ctx.arc(pv.x0, pv.y0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (pv.type === 'polygon') {
        const r = Math.hypot(pv.x1 - pv.x0, pv.y1 - pv.y0), n = pv.sides ?? 6;
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const x = pv.x0 + Math.cos(a) * r, y = pv.y0 + Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const pts = editor.polygonPoints;
    if (pts.length) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(editor.pointerWorld.x, editor.pointerWorld.y);
      ctx.strokeStyle = ACCENT; ctx.stroke();
      if (pts.length >= 2) { ctx.setLineDash([4 * px, 4 * px]); ctx.beginPath(); ctx.moveTo(editor.pointerWorld.x, editor.pointerWorld.y); ctx.lineTo(pts[0].x, pts[0].y); ctx.stroke(); ctx.setLineDash([]); }
      for (let i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, (i === 0 ? 6 : 4) * px, 0, Math.PI * 2); ctx.fillStyle = i === 0 ? ACCENT : '#fff'; ctx.fill(); }
    }
    const m = editor.marquee;
    if (m) {
      ctx.fillStyle = 'rgba(76,194,255,0.1)'; ctx.strokeStyle = SEL; ctx.lineWidth = px;
      ctx.fillRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      ctx.strokeRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    }
    const cd = editor.constraintDrag;
    if (cd) {
      ctx.beginPath(); ctx.moveTo(cd.fromWorld.x, cd.fromWorld.y); ctx.lineTo(cd.to.x, cd.to.y);
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2 * px; ctx.setLineDash([6 * px, 4 * px]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cd.fromWorld.x, cd.fromWorld.y, 4 * px, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill();
    }
  }
}
