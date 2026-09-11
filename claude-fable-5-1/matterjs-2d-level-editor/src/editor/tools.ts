import type { Editor } from "./Editor";
import type { EditorBody } from "./bodies";
import type { ConstraintEndpoint } from "./constraints";
import { dist, validatePolygon } from "./geometry";
import type { ConstraintKind, ShapeSpec, Vec2 } from "./types";

type Mode = "idle" | "maybe-drag" | "drag-bodies" | "marquee" | "create-drag";

const CREATION_TOOLS = new Set(["rectangle", "square", "circle", "polygon"]);
const CONSTRAINT_TOOLS = new Set(["link", "anchor", "spring", "pin"]);

export function isCreationTool(tool: string) {
  return CREATION_TOOLS.has(tool) || tool === "custom";
}
export function isConstraintTool(tool: string): tool is ConstraintKind {
  return CONSTRAINT_TOOLS.has(tool);
}

/**
 * Unified pointer handling for mouse, pen and touch. Only one active pointer is tracked so a
 * second finger can never trigger a duplicate action.
 */
export class ToolController {
  private pointerId: number | null = null;
  private pointerType = "mouse";
  private downPos: Vec2 = { x: 0, y: 0 };
  private downRaw: Vec2 = { x: 0, y: 0 };
  private moved = false;
  private mode: Mode = "idle";
  private additive = false;
  private dragStart = new Map<string, Vec2>();
  private grabbedId: string | null = null;
  private polygonPoints: Vec2[] = [];
  private constraintA: ConstraintEndpoint | null = null;
  private lastTap: { time: number; pos: Vec2 } | null = null;
  private tappedBodyWasSelected = false;

  constructor(
    private editor: Editor,
    private canvas: HTMLCanvasElement,
  ) {}

  attach() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onCancel);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("contextmenu", this.onContext);
  }

  detach() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onCancel);
    c.removeEventListener("pointerleave", this.onLeave);
    c.removeEventListener("contextmenu", this.onContext);
  }

  // ------------------------------------------------------------ public state

  get polygonDraft() {
    return this.polygonPoints;
  }

  get hasPendingOperation() {
    return this.polygonPoints.length > 0 || this.constraintA !== null || this.mode !== "idle";
  }

  /** Escape semantics: cancel pending op → back to select tool → clear selection. */
  escape() {
    if (this.polygonPoints.length || this.constraintA) {
      this.resetTransient();
      this.editor.toast("info", "Cancelled");
      return;
    }
    if (this.editor.tool !== "select") {
      this.editor.setTool("select");
      return;
    }
    this.editor.clearSelection();
  }

  /** Called by the editor when the active tool changes. */
  resetTransient() {
    this.polygonPoints = [];
    this.constraintA = null;
    this.mode = "idle";
    this.editor.preview = null;
    this.editor.emitLive();
  }

  undoVertex() {
    if (!this.polygonPoints.length) return;
    this.polygonPoints.pop();
    this.updatePolygonPreview(null);
    this.editor.emitLive();
  }

  finishPolygon() {
    const check = validatePolygon(this.polygonPoints);
    if (!check.ok) {
      this.editor.toast("error", `Cannot create polygon: ${check.error}`);
      this.updatePolygonPreview(null);
      return false;
    }
    // Shift to centroid-relative coordinates for a stable shape spec.
    const sumArea = check.vertices;
    let cx = 0;
    let cy = 0;
    let area = 0;
    for (let i = 0; i < sumArea.length; i++) {
      const p = sumArea[i];
      const q = sumArea[(i + 1) % sumArea.length];
      const cross = p.x * q.y - q.x * p.y;
      area += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    area /= 2;
    cx /= 6 * area;
    cy /= 6 * area;
    const shape: ShapeSpec = { kind: "custom", vertices: check.vertices.map((v) => ({ x: v.x - cx, y: v.y - cy })) };
    try {
      const entity = this.editor.createBody("custom", shape, { x: cx, y: cy });
      this.polygonPoints = [];
      this.editor.preview = null;
      this.editor.select([{ type: "body", id: entity.id }]);
      this.editor.setTool("select");
      if (check.removedDuplicates) this.editor.toast("info", `Removed ${check.removedDuplicates} duplicate vertex(es)`);
      return true;
    } catch (err) {
      this.editor.toast("error", `Matter.js rejected the polygon: ${(err as Error).message}`);
      return false;
    }
  }

  get pendingConstraintEndpoint() {
    return this.constraintA;
  }

  // -------------------------------------------------------------- utilities

  private toWorld(e: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private threshold() {
    return this.pointerType === "touch" ? 8 : 4;
  }

  private hitTolerance() {
    return this.pointerType === "touch" ? 16 : 8;
  }

  private onContext = (e: Event) => e.preventDefault();

  private onLeave = () => {
    if (this.pointerId === null) {
      this.editor.cursor = null;
      this.editor.hoverId = null;
      if (this.editor.preview?.type === "constraint" && !this.editor.preview.a) this.editor.preview = null;
      if (this.editor.preview?.type === "shape") this.editor.preview = null;
      if (this.editor.preview?.type === "polygon-draft") this.editor.preview = { ...this.editor.preview, cursor: null };
    }
  };

  // ------------------------------------------------------------ pointer down

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return; // ignore secondary pointers
    if (e.pointerType === "mouse" && e.button !== 0) {
      if (e.button === 2) this.escape();
      return;
    }
    this.pointerId = e.pointerId;
    this.pointerType = e.pointerType;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (typeof (this.canvas as HTMLElement).focus === "function") this.canvas.focus({ preventScroll: true });
    const raw = this.toWorld(e);
    const p = this.editor.snapIfEnabled(raw);
    this.downRaw = raw;
    this.downPos = p;
    this.moved = false;
    this.additive = e.shiftKey || e.ctrlKey || e.metaKey || this.editor.settings.ui.stickyMultiSelect;
    const tool = this.editor.tool;
    const ed = this.editor;

    if (tool === "select") {
      const cHit = ed.constraintAt(raw, this.hitTolerance());
      const bHit = ed.bodyAt(raw);
      const constraintWins = cHit && (!bHit || cHit.distance <= 6);
      if (constraintWins && cHit) {
        ed.select([{ type: "constraint", id: cHit.entity.id }], this.additive ? "toggle" : "replace");
        this.mode = "idle";
        return;
      }
      if (bHit) {
        const ref = { type: "body" as const, id: bHit.id };
        this.tappedBodyWasSelected = ed.isSelected(ref);
        if (this.additive) {
          ed.select([ref], "toggle");
          if (!ed.isSelected(ref)) {
            this.mode = "idle";
            return;
          }
        } else if (!this.tappedBodyWasSelected) {
          ed.select([ref], "replace");
        }
        this.grabbedId = bHit.id;
        this.dragStart = new Map(ed.selectedBodies().map((b) => [b.id, { x: b.body.position.x, y: b.body.position.y }]));
        this.mode = "maybe-drag";
        return;
      }
      if (!this.additive) ed.clearSelection();
      this.mode = "marquee";
      return;
    }

    if (CREATION_TOOLS.has(tool)) {
      this.mode = "create-drag";
      this.editor.preview = this.shapePreview(p, p);
      return;
    }
    // custom polygon & constraint tools act on pointer up (tap semantics)
    this.mode = "idle";
  };

  // ------------------------------------------------------------ pointer move

  private onMove = (e: PointerEvent) => {
    const raw = this.toWorld(e);
    const p = this.editor.snapIfEnabled(raw);
    const ed = this.editor;
    ed.cursor = p;
    const tool = ed.tool;

    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
    if (this.pointerId !== null && !this.moved && dist(raw, this.downRaw) > this.threshold()) this.moved = true;

    if (tool === "select") {
      if (this.mode === "idle" && e.pointerType === "mouse") ed.hoverId = ed.bodyAt(raw)?.id ?? null;
      if (this.mode === "maybe-drag" && this.moved) {
        this.mode = "drag-bodies";
        ed.hoverId = null;
      }
      if (this.mode === "drag-bodies") {
        let dx = raw.x - this.downRaw.x;
        let dy = raw.y - this.downRaw.y;
        if (ed.settings.grid.snap && this.grabbedId) {
          const start = this.dragStart.get(this.grabbedId);
          if (start) {
            const snapped = ed.snapIfEnabled({ x: start.x + dx, y: start.y + dy });
            dx = snapped.x - start.x;
            dy = snapped.y - start.y;
          }
        }
        const targets = new Map<string, Vec2>();
        for (const [id, start] of this.dragStart) targets.set(id, { x: start.x + dx, y: start.y + dy });
        ed.setDragTargets(targets);
      } else if (this.mode === "marquee" && this.moved) {
        ed.preview = { type: "marquee", a: this.downRaw, b: raw };
      }
      return;
    }

    if (CREATION_TOOLS.has(tool)) {
      if (this.mode === "create-drag") ed.preview = this.shapePreview(this.downPos, p);
      else if (this.pointerId === null) ed.preview = this.shapePreview(p, p); // hover ghost
      return;
    }

    if (tool === "custom") {
      this.updatePolygonPreview(p);
      return;
    }

    if (isConstraintTool(tool)) {
      const hover = ed.bodyAt(raw);
      ed.hoverId = hover?.id ?? null;
      ed.preview = {
        type: "constraint",
        kind: tool,
        a: this.constraintA ? this.constraintA.world : null,
        aOnBody: Boolean(this.constraintA?.body),
        cursor: hover ? raw : p,
        hoverBody: Boolean(hover),
      };
    }
  };

  // -------------------------------------------------------------- pointer up

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const raw = this.toWorld(e);
    const p = this.editor.snapIfEnabled(raw);
    const ed = this.editor;
    const tool = ed.tool;
    const tap = !this.moved;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (tool === "select") {
      if (this.mode === "drag-bodies") {
        ed.endDrag();
      } else if (this.mode === "marquee") {
        if (this.moved) {
          const hits = ed.bodiesInRect(this.downRaw, raw).map((b) => ({ type: "body" as const, id: b.id }));
          ed.select(hits, this.additive ? "add" : "replace");
        }
        ed.preview = null;
      } else if (this.mode === "maybe-drag" && tap && !this.additive && this.tappedBodyWasSelected && this.grabbedId) {
        // Tap on an already-selected body inside a multi-selection narrows to it.
        if (ed.selection.length > 1) ed.select([{ type: "body", id: this.grabbedId }], "replace");
      }
    } else if (CREATION_TOOLS.has(tool) && this.mode === "create-drag") {
      const shape = this.moved ? this.shapeFromDrag(this.downPos, p) : this.defaultShape(tool as "rectangle" | "square" | "circle" | "polygon");
      const centre = this.moved ? this.dragCentre(tool, this.downPos, p) : this.downPos;
      ed.preview = null;
      if (shape) {
        const entity = ed.createBody(shape.kind, shape, centre);
        ed.select([{ type: "body", id: entity.id }]);
      }
    } else if (tool === "custom" && tap) {
      this.handlePolygonTap(p, raw);
    } else if (isConstraintTool(tool) && tap) {
      this.handleConstraintTap(tool, raw);
    }

    this.lastTap = tap ? { time: performance.now(), pos: raw } : null;
    this.pointerId = null;
    this.mode = "idle";
    this.grabbedId = null;
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const ed = this.editor;
    if (this.mode === "drag-bodies") ed.endDrag();
    if (this.mode === "marquee" || this.mode === "create-drag") ed.preview = null;
    this.pointerId = null;
    this.mode = "idle";
    this.grabbedId = null;
  };

  // ----------------------------------------------------------- shape helpers

  private defaultShape(tool: "rectangle" | "square" | "circle" | "polygon"): ShapeSpec {
    const lu = this.editor.lastUsed.bodies;
    switch (tool) {
      case "rectangle":
        return { kind: "rectangle", width: lu.rectangle.width, height: lu.rectangle.height };
      case "square":
        return { kind: "square", size: lu.square.size };
      case "circle":
        return { kind: "circle", radius: lu.circle.radius };
      case "polygon":
        return { kind: "polygon", sides: lu.polygon.sides, radius: lu.polygon.radius };
    }
  }

  private shapeFromDrag(a: Vec2, b: Vec2): ShapeSpec | null {
    const tool = this.editor.tool;
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    const min = 6;
    switch (tool) {
      case "rectangle":
        return { kind: "rectangle", width: Math.max(min, w), height: Math.max(min, h) };
      case "square":
        return { kind: "square", size: Math.max(min, Math.max(w, h)) };
      case "circle":
        return { kind: "circle", radius: Math.max(min / 2, dist(a, b)) };
      case "polygon":
        return { kind: "polygon", sides: this.editor.lastUsed.bodies.polygon.sides, radius: Math.max(min / 2, dist(a, b)) };
      default:
        return null;
    }
  }

  private dragCentre(tool: string, a: Vec2, b: Vec2): Vec2 {
    if (tool === "circle" || tool === "polygon") return a; // radial tools grow from the centre
    if (tool === "square") {
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      return { x: a.x + (Math.sign(b.x - a.x) || 1) * s * 0.5, y: a.y + (Math.sign(b.y - a.y) || 1) * s * 0.5 };
    }
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private shapePreview(a: Vec2, b: Vec2) {
    const tool = this.editor.tool as "rectangle" | "square" | "circle" | "polygon";
    const moved = dist(a, b) > 1;
    const shape = moved ? this.shapeFromDrag(a, b) : this.defaultShape(tool);
    if (!shape) return null;
    const fill = this.editor.lastUsed.bodies[tool].render.fillStyle;
    return { type: "shape" as const, shape, position: moved ? this.dragCentre(tool, a, b) : a, fill };
  }

  // --------------------------------------------------------- custom polygon

  private updatePolygonPreview(cursor: Vec2 | null) {
    const pts = this.polygonPoints;
    const check = pts.length >= 3 ? validatePolygon(pts) : null;
    const closeHover = Boolean(cursor && pts.length >= 3 && dist(cursor, pts[0]) <= this.closeRadius());
    this.editor.preview = {
      type: "polygon-draft",
      points: pts,
      cursor: closeHover ? pts[0] : cursor,
      error: pts.length >= 3 ? (check?.error ?? null) : null,
      canClose: Boolean(check?.ok),
      closeHover,
    };
  }

  private closeRadius() {
    return this.pointerType === "touch" ? 22 : 12;
  }

  private handlePolygonTap(p: Vec2, raw: Vec2) {
    const pts = this.polygonPoints;
    const now = performance.now();
    const isDoubleTap = this.lastTap && now - this.lastTap.time < 350 && dist(this.lastTap.pos, raw) < 14;
    if (pts.length >= 3 && (dist(raw, pts[0]) <= this.closeRadius() || isDoubleTap)) {
      this.finishPolygon();
      this.lastTap = null;
      return;
    }
    if (isDoubleTap) return; // ignore accidental double placement
    if (pts.length && dist(pts[pts.length - 1], p) < 3) {
      this.editor.toast("warning", "Vertex too close to the previous one");
      return;
    }
    pts.push(p);
    this.updatePolygonPreview(p);
    this.editor.emitLive();
  }

  // ------------------------------------------------------------ constraints

  private endpoint(body: EditorBody | null, world: Vec2): ConstraintEndpoint {
    return { bodyId: body?.id ?? null, body: body?.body ?? null, world: { ...world } };
  }

  private handleConstraintTap(kind: ConstraintKind, raw: Vec2) {
    const ed = this.editor;
    const hit = ed.bodyAt(raw);
    const snapped = ed.snapIfEnabled(raw);
    const point = hit ? raw : snapped;

    if (kind === "pin") {
      const stack = ed.bodiesAt(raw);
      if (!stack.length) {
        ed.toast("warning", "Tap on a body to pin it");
        return;
      }
      const top = stack[stack.length - 1];
      const under = stack.length >= 2 ? stack[stack.length - 2] : null;
      const a = this.endpoint(top, raw);
      const b = under ? this.endpoint(under, raw) : this.endpoint(null, raw);
      ed.createConstraint("pin", a, b);
      ed.toast("success", under ? `Hinged ${top.body.label} to ${under.body.label}` : `Pinned ${top.body.label} to the world`);
      return;
    }

    if (!this.constraintA) {
      if (kind === "link" && !hit) {
        ed.toast("warning", "Body link: start by tapping a body");
        return;
      }
      if (kind === "anchor" && hit) {
        // Anchor tool: first tap defines the world anchor point, even over a body.
        this.constraintA = this.endpoint(null, snapped);
      } else {
        this.constraintA = this.endpoint(hit, point);
      }
      ed.preview = { type: "constraint", kind, a: this.constraintA.world, aOnBody: Boolean(this.constraintA.body), cursor: raw, hoverBody: Boolean(hit) };
      ed.emitLive();
      return;
    }

    if (!hit) {
      ed.toast("warning", "Finish the constraint by tapping a body");
      return;
    }
    if (this.constraintA.bodyId === hit.id) {
      ed.toast("warning", "Choose a different body for the second endpoint");
      return;
    }
    const entity = ed.createConstraint(kind, this.constraintA, this.endpoint(hit, raw));
    this.constraintA = null;
    ed.preview = null;
    if (entity) ed.toast("success", `Created ${entity.constraint.label}`);
  }
}
