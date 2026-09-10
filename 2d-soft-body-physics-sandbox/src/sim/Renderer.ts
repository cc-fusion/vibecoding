import type { Sandbox } from './Sandbox';
import type { RigidObject, SoftObject, Vec } from './types';
import { blobOutline, ellipseOutline, rectOutline, starOutline } from './geometry';

const COLORS = {
  bg: '#0b0f14',
  gridMinor: 'rgba(148, 163, 184, 0.045)',
  gridMajor: 'rgba(148, 163, 184, 0.10)',
  floor: 'rgba(148, 163, 184, 0.35)',
  staticFill: 'rgba(71, 85, 105, 0.35)',
  staticStroke: '#94a3b8',
  select: '#fbbf24',
  hover: 'rgba(251, 191, 36, 0.45)',
  debugShape: '#4ade80',
  debugVel: '#f97316',
  debugSpring: 'rgba(56, 189, 248, 0.55)',
  debugBend: 'rgba(56, 189, 248, 0.18)',
  node: '#e2e8f0',
  draft: '#38bdf8',
  draftBad: '#f87171',
};

export class Renderer {
  private hatch: CanvasPattern | null = null;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {}

  setSize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  private getHatch(ctx: CanvasRenderingContext2D) {
    if (this.hatch) return this.hatch;
    const c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-2, 12);
    g.lineTo(12, -2);
    g.moveTo(-2, 2);
    g.lineTo(2, -2);
    g.moveTo(8, 12);
    g.lineTo(12, 8);
    g.stroke();
    this.hatch = ctx.createPattern(c, 'repeat');
    return this.hatch;
  }

  render(sb: Sandbox) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { width: w, height: h } = sb;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (sb.params.grid) this.drawGrid(ctx, w, h);

    // floor line
    ctx.strokeStyle = COLORS.floor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();

    const debug = sb.params.debug;
    for (const o of sb.objects.values()) {
      const selected = o.id === sb.selectedId;
      const hovered = o.id === sb.hoverId && !selected;
      if (o.kind === 'rigid') this.drawRigid(ctx, o, selected, hovered);
      else this.drawSoft(ctx, o, selected, hovered, debug.nodes, debug.springs);
    }

    if (debug.shapes || debug.velocities) this.drawDebug(ctx, sb);

    this.drawGrab(ctx, sb);
    this.drawThrows(ctx, sb);
    this.drawDraft(ctx, sb);
  }

  /* ------------------------------------------------------------------ */

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 25) {
      if (x % 100 === 0) continue;
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += 25) {
      if (y % 100 === 0) continue;
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.strokeStyle = COLORS.gridMinor;
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= w; x += 100) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += 100) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.stroke();
  }

  private drawRigid(ctx: CanvasRenderingContext2D, o: RigidObject, selected: boolean, hovered: boolean) {
    const b = o.body;
    const isStatic = b.isStatic;
    const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;

    const tracePart = (p: Matter.Body) => {
      ctx.beginPath();
      if (o.def.shape === 'circle' && b.circleRadius) {
        ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
      } else {
        const v = p.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
      }
    };

    for (const p of parts) {
      tracePart(p);
      if (isStatic) {
        ctx.fillStyle = COLORS.staticFill;
        ctx.fill();
        const pat = this.getHatch(ctx);
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fill();
        }
      } else {
        ctx.fillStyle = hexA(o.color, 0.2);
        ctx.fill();
      }
      ctx.lineWidth = isStatic ? 1.5 : 1.75;
      ctx.strokeStyle = isStatic ? COLORS.staticStroke : o.color;
      ctx.stroke();
    }

    // orientation tick
    if (!isStatic) {
      const r = o.def.shape === 'circle' ? (b.circleRadius ?? 10) : Math.min(b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y) * 0.3;
      ctx.beginPath();
      ctx.moveTo(b.position.x, b.position.y);
      ctx.lineTo(b.position.x + Math.cos(b.angle) * r, b.position.y + Math.sin(b.angle) * r);
      ctx.strokeStyle = hexA(o.color, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (selected || hovered) {
      for (const p of parts) {
        tracePart(p);
        ctx.strokeStyle = selected ? COLORS.select : COLORS.hover;
        ctx.lineWidth = selected ? 2.5 : 2;
        ctx.stroke();
      }
      if (selected) this.drawSelectionBox(ctx, b.bounds.min.x, b.bounds.min.y, b.bounds.max.x, b.bounds.max.y);
    }
  }

  private drawSoft(
    ctx: CanvasRenderingContext2D,
    o: SoftObject,
    selected: boolean,
    hovered: boolean,
    showNodes: boolean,
    showSprings: boolean,
  ) {
    const s = o.soft;
    const skin = s.skinOutline();
    if (skin.length < 3) return;

    // smooth closed curve through skin points
    this.traceSmooth(ctx, skin);
    ctx.fillStyle = hexA(o.color, 0.22);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = o.color;
    ctx.stroke();

    // subtle internal mesh: spokes to centroid
    const c = s.center;
    ctx.beginPath();
    for (const p of s.particles) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(p.position.x, p.position.y);
    }
    ctx.strokeStyle = hexA(o.color, 0.09);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = hexA(o.color, 0.6);
    ctx.fill();

    if (showSprings) {
      ctx.lineWidth = 1;
      for (const k of s.constraints) {
        if (!k.bodyA || !k.bodyB) continue;
        ctx.beginPath();
        ctx.moveTo(k.bodyA.position.x, k.bodyA.position.y);
        ctx.lineTo(k.bodyB.position.x, k.bodyB.position.y);
        ctx.strokeStyle = k.label === 'bend' ? COLORS.debugBend : COLORS.debugSpring;
        ctx.stroke();
      }
    }
    if (showNodes) {
      for (const p of s.particles) {
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, Math.max(2, s.radius * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = COLORS.node;
        ctx.fill();
      }
    }

    if (selected || hovered) {
      this.traceSmooth(ctx, skin);
      ctx.strokeStyle = selected ? COLORS.select : COLORS.hover;
      ctx.lineWidth = selected ? 2.5 : 2;
      ctx.stroke();
      if (selected) {
        const bb = s.bounds();
        this.drawSelectionBox(ctx, bb.minX, bb.minY, bb.maxX, bb.maxY);
      }
    }
  }

  private traceSmooth(ctx: CanvasRenderingContext2D, pts: Vec[]) {
    const n = pts.length;
    ctx.beginPath();
    // Catmull-Rom -> cubic Bezier
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      if (i === 0) ctx.moveTo(p1.x, p1.y);
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
    ctx.closePath();
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const pad = 6;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - pad + 0.5, y0 - pad + 0.5, x1 - x0 + pad * 2, y1 - y0 + pad * 2);
    ctx.restore();
    // corner handles
    ctx.fillStyle = COLORS.select;
    const hs = 3;
    for (const [x, y] of [
      [x0 - pad, y0 - pad],
      [x1 + pad, y0 - pad],
      [x0 - pad, y1 + pad],
      [x1 + pad, y1 + pad],
    ]) {
      ctx.fillRect(x - hs, y - hs, hs * 2, hs * 2);
    }
  }

  private drawDebug(ctx: CanvasRenderingContext2D, sb: Sandbox) {
    const { shapes, velocities } = sb.params.debug;
    for (const o of sb.objects.values()) {
      if (o.kind === 'rigid') {
        const b = o.body;
        if (shapes) {
          ctx.strokeStyle = COLORS.debugShape;
          ctx.lineWidth = 1;
          const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
          for (const p of parts) {
            ctx.beginPath();
            const v = p.vertices;
            ctx.moveTo(v[0].x, v[0].y);
            for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
            ctx.closePath();
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.35)';
          ctx.strokeRect(b.bounds.min.x, b.bounds.min.y, b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y);
        }
        if (velocities && !b.isStatic) this.arrow(ctx, b.position, b.velocity, 6, COLORS.debugVel);
      } else {
        const s = o.soft;
        if (shapes) {
          ctx.strokeStyle = COLORS.debugShape;
          ctx.lineWidth = 1;
          for (const p of s.particles) {
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, s.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (velocities) {
          this.arrow(ctx, s.center, s.averageVelocity(), 6, COLORS.debugVel);
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
          ctx.lineWidth = 1;
          for (const p of s.particles) {
            ctx.beginPath();
            ctx.moveTo(p.position.x, p.position.y);
            ctx.lineTo(p.position.x + p.velocity.x * 4, p.position.y + p.velocity.y * 4);
            ctx.stroke();
          }
        }
      }
    }
  }

  private arrow(ctx: CanvasRenderingContext2D, from: Vec, v: Vec, scale: number, color: string, width = 1.5) {
    const len = Math.hypot(v.x, v.y) * scale;
    if (len < 2) return;
    const tx = from.x + v.x * scale;
    const ty = from.y + v.y * scale;
    const ang = Math.atan2(v.y, v.x);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const hs = 6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(ang - 0.45) * hs, ty - Math.sin(ang - 0.45) * hs);
    ctx.lineTo(tx - Math.cos(ang + 0.45) * hs, ty - Math.sin(ang + 0.45) * hs);
    ctx.closePath();
    ctx.fill();
  }

  private drawGrab(ctx: CanvasRenderingContext2D, sb: Sandbox) {
    const g = sb.grab;
    if (!g) return;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 1.25;
    for (const { c, baseAngle } of g.constraints) {
      if (!c.bodyB) continue;
      const p = c.bodyB.position;
      const pb = c.pointB ?? { x: 0, y: 0 };
      const cos = Math.cos(c.bodyB.angle - baseAngle);
      const sin = Math.sin(c.bodyB.angle - baseAngle);
      const ax = p.x + pb.x * cos - pb.y * sin;
      const ay = p.y + pb.x * sin + pb.y * cos;
      ctx.beginPath();
      ctx.moveTo(c.pointA.x, c.pointA.y);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(g.pointer.x, g.pointer.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.select;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawThrows(ctx: CanvasRenderingContext2D, sb: Sandbox) {
    for (const t of sb.throwIndicators) {
      const a = 1 - t.t / 900;
      const o = sb.objects.get(t.objectId);
      const pos = o ? (o.kind === 'rigid' ? o.body.position : o.soft.center) : t.pos;
      ctx.save();
      ctx.globalAlpha = a;
      // predicted trajectory (ballistic, ignoring collisions)
      const g = { x: sb.params.gravityX * 0.001 * (1000 / 60) ** 2, y: sb.params.gravityY * 0.001 * (1000 / 60) ** 2 };
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let x = t.pos.x;
      let y = t.pos.y;
      let vx = t.vel.x;
      let vy = t.vel.y;
      ctx.moveTo(x, y);
      for (let i = 0; i < 40; i++) {
        vx += g.x;
        vy += g.y;
        x += vx;
        y += vy;
        ctx.lineTo(x, y);
        if (y > sb.height || x < 0 || x > sb.width) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      this.arrow(ctx, pos, t.vel, 3, COLORS.select, 2);
      ctx.restore();
    }
  }

  private drawDraft(ctx: CanvasRenderingContext2D, sb: Sandbox) {
    const d = sb.draft;
    if (!d) return;
    ctx.save();
    if (d.kind === 'box') {
      const x0 = Math.min(d.start.x, d.end.x);
      const y0 = Math.min(d.start.y, d.end.y);
      const w = Math.abs(d.end.x - d.start.x);
      const h = Math.abs(d.end.y - d.start.y);
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.draft;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (d.tool === 'circle') {
        const r = Math.max(w, h) / 2;
        ctx.arc(cx, cy, Math.max(r, 4), 0, Math.PI * 2);
      } else if (d.tool === 'rect') {
        ctx.rect(x0, y0, w, h);
      } else {
        let pts: Vec[];
        const rx = Math.max(w, 24) / 2;
        const ry = Math.max(h, 24) / 2;
        switch (sb.tools.softPreset) {
          case 'circle':
            pts = ellipseOutline(rx, ry, 36);
            break;
          case 'rect':
            pts = rectOutline(rx * 2, ry * 2);
            break;
          case 'star':
            pts = starOutline(Math.max(rx, ry), Math.max(rx, ry) * 0.5, 5);
            break;
          default:
            pts = blobOutline(rx, ry, d.seed);
        }
        ctx.moveTo(pts[0].x + cx, pts[0].y + cy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + cx, pts[i].y + cy);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`${Math.round(w)} × ${Math.round(h)}`, x0 + w + 8, y0 + h + 14);
    } else {
      const pts = d.points;
      const color = d.valid ? COLORS.draft : COLORS.draftBad;
      if (pts.length) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (d.cursor) ctx.lineTo(d.cursor.x, d.cursor.y);
        if (pts.length >= 2) {
          ctx.fillStyle = d.valid ? 'rgba(56, 189, 248, 0.10)' : 'rgba(248, 113, 113, 0.10)';
          ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // closing edge hint
        if (pts.length >= 2 && d.cursor) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.beginPath();
          ctx.moveTo(d.cursor.x, d.cursor.y);
          ctx.lineTo(pts[0].x, pts[0].y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (let i = 0; i < pts.length; i++) {
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, i === 0 ? (d.closing ? 9 : 6) : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? (d.closing ? COLORS.select : COLORS.bg) : color;
          ctx.fill();
          ctx.strokeStyle = i === 0 ? COLORS.select : color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
