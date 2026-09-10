import type { Body, Constraint, Engine } from "matter-js";
import type { EditorBody } from "./bodies";
import type { EditorConstraint } from "./constraints";
import { constraintWorldPoints } from "./constraints";
import type { ConstraintKind, EditorSettings, SelectionRef, ShapeSpec, Vec2 } from "./types";
import { shapeVertices } from "./bodies";

export type ToolPreview =
  | { type: "shape"; shape: ShapeSpec; position: Vec2; fill: string }
  | { type: "polygon-draft"; points: Vec2[]; cursor: Vec2 | null; error: string | null; canClose: boolean; closeHover: boolean }
  | { type: "constraint"; kind: ConstraintKind; a: Vec2 | null; aOnBody: boolean; cursor: Vec2; hoverBody: boolean }
  | { type: "marquee"; a: Vec2; b: Vec2 }
  | null;

export interface RenderState {
  engine: Engine;
  bodies: EditorBody[];
  constraints: EditorConstraint[];
  boundaries: Body[];
  selection: SelectionRef[];
  settings: EditorSettings;
  preview: ToolPreview;
  cursor: Vec2 | null;
  hoverId: string | null;
  running: boolean;
}

export const COLORS = {
  accent: "#4cc2ff",
  accentSoft: "rgba(76, 194, 255, 0.18)",
  primary: "#ffd166",
  danger: "#ff5d73",
  ok: "#5bd8a0",
  grid: "rgba(255,255,255,0.05)",
  gridMajor: "rgba(255,255,255,0.11)",
  wire: "#c9d1d9",
  text: "#e6edf3",
};

export function renderFrame(ctx: CanvasRenderingContext2D, width: number, height: number, s: RenderState) {
  const { settings } = s;
  ctx.save();
  ctx.fillStyle = settings.world.background;
  ctx.fillRect(0, 0, width, height);

  if (settings.grid.show) drawGrid(ctx, width, height, settings.grid.spacing);
  if (settings.render.showBoundaries) drawBoundaries(ctx, s.boundaries, settings.boundaries.color);

  const selected = new Set(s.selection.map((r) => `${r.type}:${r.id}`));
  const primary = s.selection.length ? s.selection[s.selection.length - 1] : null;

  for (const e of s.bodies) drawBody(ctx, e.body, s);
  for (const c of s.constraints) drawConstraint(ctx, c.constraint, s, false);

  if (settings.render.showCollisions) drawCollisions(ctx, s.engine);

  // Hover highlight (pointer devices only report hover; still safe for touch)
  if (s.hoverId && !selected.has(`body:${s.hoverId}`)) {
    const e = s.bodies.find((b) => b.id === s.hoverId);
    if (e) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      traceBody(ctx, e.body);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Selection outlines
  for (const ref of s.selection) {
    const isPrimary = primary !== null && primary.type === ref.type && primary.id === ref.id && s.selection.length > 1;
    if (ref.type === "body") {
      const e = s.bodies.find((b) => b.id === ref.id);
      if (e) drawBodySelection(ctx, e.body, isPrimary);
    } else {
      const c = s.constraints.find((k) => k.id === ref.id);
      if (c) drawConstraint(ctx, c.constraint, s, true);
    }
  }

  if (settings.render.showLabels) {
    for (const e of s.bodies) drawLabel(ctx, e.body.position, e.body.label);
  }

  drawPreview(ctx, s);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, spacing: number) {
  if (spacing < 4) return;
  ctx.save();
  ctx.lineWidth = 1;
  const majorEvery = 5;
  ctx.beginPath();
  ctx.strokeStyle = COLORS.grid;
  for (let x = 0, i = 0; x <= w; x += spacing, i++) {
    if (i % majorEvery === 0) continue;
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = 0, i = 0; y <= h; y += spacing, i++) {
    if (i % majorEvery === 0) continue;
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = COLORS.gridMajor;
  for (let x = 0; x <= w; x += spacing * majorEvery) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = 0; y <= h; y += spacing * majorEvery) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBoundaries(ctx: CanvasRenderingContext2D, boundaries: Body[], color: string) {
  ctx.save();
  for (const b of boundaries) {
    ctx.fillStyle = color;
    ctx.beginPath();
    tracePolygon(ctx, b.vertices);
    ctx.fill();
    // hatch stripes to read as infrastructure
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    const { min, max } = b.bounds;
    ctx.beginPath();
    for (let x = min.x - (max.y - min.y); x < max.x; x += 14) {
      ctx.moveTo(x, max.y);
      ctx.lineTo(x + (max.y - min.y), min.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function tracePolygon(ctx: CanvasRenderingContext2D, vertices: Vec2[]) {
  if (!vertices.length) return;
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
  ctx.closePath();
}

/** Traces every part of a (possibly compound) body into a single path. */
function traceBody(ctx: CanvasRenderingContext2D, body: Body) {
  ctx.beginPath();
  if (body.circleRadius) {
    ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  for (const part of parts) tracePolygon(ctx, part.vertices);
}

function drawBody(ctx: CanvasRenderingContext2D, body: Body, s: RenderState) {
  const r = s.settings.render;
  const wire = r.wireframes;
  const opacity = body.render.opacity ?? 1;
  const sleeping = r.showSleeping && body.isSleeping;
  ctx.save();
  ctx.globalAlpha = sleeping ? opacity * 0.45 : opacity;

  traceBody(ctx, body);
  if (wire) {
    ctx.strokeStyle = body.isStatic ? "#8b949e" : COLORS.wire;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle = String(body.render.fillStyle ?? "#888");
    if (body.isSensor) {
      ctx.globalAlpha *= 0.35;
      ctx.fill();
      ctx.globalAlpha = opacity;
      ctx.setLineDash([5, 4]);
    } else {
      ctx.fill();
    }
    if ((body.render.lineWidth ?? 0) > 0) {
      ctx.strokeStyle = String(body.render.strokeStyle ?? "#000");
      ctx.lineWidth = body.render.lineWidth ?? 1;
      ctx.stroke();
    }
    if (body.isStatic) {
      // subtle static hatch marker
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 1;
      const { min, max } = body.bounds;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let x = min.x - (max.y - min.y); x < max.x; x += 10) {
        ctx.moveTo(x, max.y);
        ctx.lineTo(x + (max.y - min.y), min.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.setLineDash([]);

  if (r.showAxes) {
    // angle indicator from centre
    const len = body.circleRadius ? body.circleRadius : Math.min(18, Math.max(6, (body.bounds.max.x - body.bounds.min.x) * 0.25));
    ctx.beginPath();
    ctx.moveTo(body.position.x, body.position.y);
    ctx.lineTo(body.position.x + Math.cos(body.angle) * len, body.position.y + Math.sin(body.angle) * len);
    ctx.strokeStyle = wire ? COLORS.wire : "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  if (r.showBounds) {
    const { min, max } = body.bounds;
    ctx.strokeStyle = "rgba(255, 120, 120, 0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
    ctx.setLineDash([]);
  }
  if (r.showVelocity && !body.isStatic) {
    ctx.beginPath();
    ctx.moveTo(body.position.x, body.position.y);
    ctx.lineTo(body.position.x + body.velocity.x * 4, body.position.y + body.velocity.y * 4);
    ctx.strokeStyle = COLORS.ok;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodySelection(ctx: CanvasRenderingContext2D, body: Body, isPrimary: boolean) {
  ctx.save();
  traceBody(ctx, body);
  ctx.strokeStyle = isPrimary ? COLORS.primary : COLORS.accent;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // corner handles on bounds
  const { min, max } = body.bounds;
  ctx.fillStyle = isPrimary ? COLORS.primary : COLORS.accent;
  const hs = 3;
  for (const [x, y] of [
    [min.x, min.y],
    [max.x, min.y],
    [min.x, max.y],
    [max.x, max.y],
  ]) {
    ctx.fillRect(x - hs, y - hs, hs * 2, hs * 2);
  }
  ctx.restore();
}

function drawSpring(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, coils = 8, amplitude = 5) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    return;
  }
  const nx = -dy / len;
  const ny = dx / len;
  const segs = coils * 2;
  ctx.moveTo(a.x, a.y);
  const lead = Math.min(8, len * 0.1);
  ctx.lineTo(a.x + (dx / len) * lead, a.y + (dy / len) * lead);
  for (let i = 1; i < segs; i++) {
    const t = lead / len + (i / segs) * (1 - (2 * lead) / len);
    const side = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(a.x + dx * t + nx * amplitude * side, a.y + dy * t + ny * amplitude * side);
  }
  ctx.lineTo(b.x - (dx / len) * lead, b.y - (dy / len) * lead);
  ctx.lineTo(b.x, b.y);
}

function drawConstraint(ctx: CanvasRenderingContext2D, c: Constraint, s: RenderState, selected: boolean) {
  const { a, b } = constraintWorldPoints(c);
  const render = c.render as unknown as { strokeStyle?: string; lineWidth?: number; type?: string; anchors?: boolean };
  ctx.save();
  const isPin = c.length < 1 && Math.hypot(a.x - b.x, a.y - b.y) < 2;
  ctx.beginPath();
  if (isPin) {
    ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
  } else if (render.type === "spring") {
    drawSpring(ctx, a, b);
  } else {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  if (selected) {
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = (render.lineWidth ?? 2) + 5;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = render.lineWidth ?? 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = render.strokeStyle ?? "#fff";
    ctx.lineWidth = render.lineWidth ?? 2;
    ctx.stroke();
  }
  if (isPin) {
    ctx.fillStyle = selected ? COLORS.accent : (render.strokeStyle ?? "#fff");
    ctx.beginPath();
    ctx.arc(a.x, a.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if ((render.anchors !== false && s.settings.render.showConstraintAnchors) || selected) {
    for (const [p, isWorld] of [
      [a, !c.bodyA],
      [b, !c.bodyB],
    ] as const) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, selected ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isWorld ? "#0d1117" : (selected ? COLORS.accent : (render.strokeStyle ?? "#fff"));
      ctx.fill();
      ctx.strokeStyle = selected ? COLORS.accent : (render.strokeStyle ?? "#fff");
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

interface PairLike {
  isActive: boolean;
  activeContacts?: { vertex: Vec2 }[];
  contacts?: { vertex: Vec2 }[];
  contactCount?: number;
}

function drawCollisions(ctx: CanvasRenderingContext2D, engine: Engine) {
  const pairs = engine.pairs.list as unknown as PairLike[];
  ctx.save();
  ctx.fillStyle = COLORS.danger;
  for (const pair of pairs) {
    if (!pair.isActive) continue;
    const contacts = pair.activeContacts ?? (pair.contacts ? pair.contacts.slice(0, pair.contactCount ?? pair.contacts.length) : []);
    for (const c of contacts) {
      if (!c || !c.vertex) continue;
      ctx.fillRect(c.vertex.x - 2.5, c.vertex.y - 2.5, 5, 5);
    }
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, p: Vec2, text: string) {
  ctx.save();
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(13,17,23,0.75)";
  ctx.fillRect(p.x - w / 2, p.y - 24, w, 15);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, p.x, p.y - 11);
  ctx.restore();
}

function drawPreview(ctx: CanvasRenderingContext2D, s: RenderState) {
  const p = s.preview;
  if (s.cursor && s.settings.grid.snap && !s.running) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.cursor.x - 6, s.cursor.y);
    ctx.lineTo(s.cursor.x + 6, s.cursor.y);
    ctx.moveTo(s.cursor.x, s.cursor.y - 6);
    ctx.lineTo(s.cursor.x, s.cursor.y + 6);
    ctx.stroke();
    ctx.restore();
  }
  if (!p) return;
  ctx.save();
  switch (p.type) {
    case "shape": {
      const verts = shapeVertices(p.shape).map((v) => ({ x: v.x + p.position.x, y: v.y + p.position.y }));
      ctx.beginPath();
      if (p.shape.kind === "circle") ctx.arc(p.position.x, p.position.y, p.shape.radius, 0, Math.PI * 2);
      else tracePolygon(ctx, verts);
      ctx.fillStyle = p.fill;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawDimensionTag(ctx, p.position, describeShape(p.shape));
      break;
    }
    case "polygon-draft": {
      const pts = p.points;
      const invalid = Boolean(p.error) && pts.length >= 3;
      const stroke = invalid ? COLORS.danger : COLORS.accent;
      if (pts.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (p.cursor) ctx.lineTo(p.cursor.x, p.cursor.y);
        if (pts.length >= 2) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const last = p.cursor ?? pts[pts.length - 1];
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(pts[0].x, pts[0].y);
          ctx.stroke();
          ctx.restore();
        }
        if (pts.length >= 3) {
          ctx.beginPath();
          tracePolygon(ctx, pts);
          ctx.fillStyle = invalid ? "rgba(255,93,115,0.15)" : COLORS.accentSoft;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (p.cursor) ctx.lineTo(p.cursor.x, p.cursor.y);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      pts.forEach((pt, i) => {
        ctx.beginPath();
        const r = i === 0 ? (p.closeHover ? 9 : 6) : 4;
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? (p.canClose ? COLORS.ok : "#0d1117") : "#0d1117";
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      if (p.error && pts.length >= 3) drawDimensionTag(ctx, pts[0], p.error, COLORS.danger);
      break;
    }
    case "constraint": {
      if (p.a) {
        ctx.beginPath();
        if (p.kind === "spring") drawSpring(ctx, p.a, p.cursor);
        else {
          ctx.moveTo(p.a.x, p.a.y);
          ctx.lineTo(p.cursor.x, p.cursor.y);
        }
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(p.a.x, p.a.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.aOnBody ? COLORS.accent : "#0d1117";
        ctx.fill();
        ctx.strokeStyle = COLORS.accent;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.cursor.x, p.cursor.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = p.hoverBody ? COLORS.ok : "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case "marquee": {
      const x = Math.min(p.a.x, p.b.x);
      const y = Math.min(p.a.y, p.b.y);
      const w = Math.abs(p.a.x - p.b.x);
      const h = Math.abs(p.a.y - p.b.y);
      ctx.fillStyle = COLORS.accentSoft;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      break;
    }
  }
  ctx.restore();
}

function describeShape(shape: ShapeSpec) {
  switch (shape.kind) {
    case "rectangle":
      return `${Math.round(shape.width)} × ${Math.round(shape.height)}`;
    case "square":
      return `${Math.round(shape.size)} × ${Math.round(shape.size)}`;
    case "circle":
      return `r ${Math.round(shape.radius)}`;
    case "polygon":
      return `${shape.sides} sides · r ${Math.round(shape.radius)}`;
    case "custom":
      return `${shape.vertices.length} vertices`;
  }
}

function drawDimensionTag(ctx: CanvasRenderingContext2D, p: Vec2, text: string, color = COLORS.accent) {
  ctx.save();
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(13,17,23,0.85)";
  ctx.fillRect(p.x + 12, p.y - 20, w, 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x + 12.5, p.y - 19.5, w, 18);
  ctx.fillStyle = color;
  ctx.fillText(text, p.x + 17, p.y - 11);
  ctx.restore();
}
