import { Bodies, Body, Bounds, Composite, Engine, Query, Sleeping, type Constraint } from "matter-js";
import {
  BODY_KIND_LABEL,
  EDITOR_PLUGIN_KEY,
  applyBodyProp,
  createMatterBody,
  makeBodyData,
  readBodyPhysics,
  reshapeBody,
  serializeBody,
  type BodyPropKey,
  type EditorBody,
} from "./bodies";
import {
  CONSTRAINT_KIND_LABEL,
  applyConstraintProp,
  constraintWorldPoints,
  createMatterConstraint,
  makeConstraintData,
  serializeConstraint,
  type ConstraintEndpoint,
  type ConstraintPropKey,
  type EditorConstraint,
} from "./constraints";
import { createDefaultLastUsed, createDefaultSettings, mergeInto } from "./defaults";
import { dist, makeId, pointToSegmentDistance, snapPoint } from "./geometry";
import { SensorGravity } from "./gravity";
import { renderFrame, type ToolPreview } from "./renderer";
import { DocumentError, buildDocument, parseDocumentText } from "./serialization";
import { clearSavedDocument, downloadJson, hasSavedDocument, loadDocument, saveDocument } from "./storage";
import type {
  BodyData,
  BodyKind,
  ConstraintData,
  ConstraintKind,
  EditorDocument,
  EditorSettings,
  LastUsed,
  SceneData,
  SelectionRef,
  ShapeSpec,
  SimState,
  ToolId,
  Vec2,
} from "./types";
import { createStarterScene } from "./starterScene";
import type { ToolController } from "./tools";

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type ToastKind = "info" | "success" | "error" | "warning";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = () => void;

export class Editor {
  readonly engine: Engine;
  settings: EditorSettings;
  lastUsed: LastUsed;
  bodies: EditorBody[] = [];
  constraints: EditorConstraint[] = [];
  boundaries: Body[] = [];
  selection: SelectionRef[] = [];
  tool: ToolId = "select";
  simState: SimState = "stopped";
  resetSnapshot: SceneData | null = null;
  version = 0;
  toasts: Toast[] = [];
  preview: ToolPreview = null;
  cursor: Vec2 | null = null;
  hoverId: string | null = null;
  sensor: SensorGravity;
  storageCorrupt = false;
  panelOpen = false; // mobile drawer
  width = 800;
  height = 600;
  stepCount = 0;
  fps = 0;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private liveCounter = 0;
  private fpsCounter = { frames: 0, since: 0 };
  private listeners = new Set<Listener>();
  private resizeObserver: ResizeObserver | null = null;
  private boundaryTimer: number | null = null;
  private autosaveTimer: number | null = null;
  private autosaveEnabled = true;
  private toastId = 0;
  private dragTargets: Map<string, Vec2> | null = null;

  constructor() {
    this.engine = Engine.create();
    this.settings = createDefaultSettings();
    this.lastUsed = createDefaultLastUsed();
    this.sensor = new SensorGravity(this.settings.gravity, () => this.emitLive());

    let doc: EditorDocument | null = null;
    try {
      doc = loadDocument();
    } catch (err) {
      this.storageCorrupt = true;
      this.autosaveEnabled = false;
      this.toast("error", `Saved data could not be read (${(err as Error).message}). It was left untouched; Save will overwrite it.`);
    }
    if (doc) {
      this.applyDocument(doc, false);
    } else if (!this.storageCorrupt) {
      this.loadScene(createStarterScene());
    }
    this.applyEngineSettings();
    this.initSensorForMode();
  }

  // ------------------------------------------------------------------ events

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Discrete change: notifies UI and schedules autosave. */
  emit() {
    this.version++;
    for (const l of this.listeners) l();
    this.scheduleAutosave();
  }

  /** Live refresh (simulation ticks, sensor updates): notifies UI without persisting. */
  emitLive() {
    this.version++;
    for (const l of this.listeners) l();
  }

  toast(kind: ToastKind, message: string) {
    const id = ++this.toastId;
    this.toasts = [...this.toasts, { id, kind, message }];
    window.setTimeout(() => this.dismissToast(id), kind === "error" ? 7000 : 3500);
    this.emitLive();
  }

  dismissToast(id: number) {
    if (!this.toasts.some((t) => t.id === id)) return;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emitLive();
  }

  // --------------------------------------------------------------- lifecycle

  attach(canvas: HTMLCanvasElement) {
    if (this.canvas === canvas) return;
    this.detach();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(parent);
    }
    this.resize();
    this.rebuildBoundaries();
    this.lastFrameTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  detach() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas = null;
    this.ctx = null;
  }

  destroy() {
    this.detach();
    this.sensor.destroy();
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
  }

  resize() {
    const canvas = this.canvas;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const changed = w !== this.width || h !== this.height;
    this.width = w;
    this.height = h;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (changed) {
      if (this.boundaryTimer) window.clearTimeout(this.boundaryTimer);
      this.boundaryTimer = window.setTimeout(() => {
        this.boundaryTimer = null;
        this.rebuildBoundaries();
      }, 120);
      this.emitLive();
    }
  }

  private frame = (t: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(100, t - this.lastFrameTime);
    this.lastFrameTime = t;
    this.fpsCounter.frames++;
    if (t - this.fpsCounter.since > 1000) {
      this.fps = this.fpsCounter.frames;
      this.fpsCounter = { frames: 0, since: t };
    }
    this.applyGravity();
    this.applyDrag();
    if (this.simState === "running") {
      const stepMs = 1000 / Math.max(10, this.settings.engine.stepHz);
      this.accumulator += dt;
      let n = 0;
      while (this.accumulator >= stepMs && n < 4) {
        Engine.update(this.engine, stepMs);
        this.accumulator -= stepMs;
        this.stepCount++;
        n++;
      }
      if (n === 4) this.accumulator = 0;
      if (n > 0) this.applyDrag(); // keep dragged bodies pinned after the physics step
    }
    // Periodic UI refresh for live values (positions while running, sensor diagnostics).
    if (this.simState === "running" || this.sensor.isActive || this.dragTargets) {
      if (++this.liveCounter % 6 === 0) this.emitLive();
    }
    this.render();
  };

  private render() {
    if (!this.ctx) return;
    renderFrame(this.ctx, this.width, this.height, {
      engine: this.engine,
      bodies: this.bodies,
      constraints: this.constraints,
      boundaries: this.boundaries,
      selection: this.selection,
      settings: this.settings,
      preview: this.preview,
      cursor: this.cursor,
      hoverId: this.hoverId,
      running: this.simState === "running",
    });
  }

  // ----------------------------------------------------------------- gravity

  private applyGravity() {
    const g = this.settings.gravity;
    this.engine.gravity.scale = g.scale;
    if (g.mode !== "manual" && this.sensor.isProviding) {
      const v = this.sensor.vector;
      this.engine.gravity.x = v.x;
      this.engine.gravity.y = v.y;
    } else {
      this.engine.gravity.x = g.x;
      this.engine.gravity.y = g.y;
    }
  }

  get usingSensorGravity() {
    return this.settings.gravity.mode !== "manual" && this.sensor.isProviding;
  }

  private initSensorForMode() {
    const g = this.settings.gravity;
    if (g.mode === "manual") {
      this.sensor.disable();
      return;
    }
    if (this.sensor.caps.supported && !this.sensor.caps.needsPermission) {
      void this.sensor.enable(false).catch(() => undefined);
    }
  }

  async enableSensorGravity() {
    if (this.settings.gravity.mode === "manual") {
      this.settings.gravity.mode = "auto";
    }
    try {
      const ok = await this.sensor.enable(true);
      if (ok) this.toast("success", "Motion sensors enabled");
      else this.toast("warning", this.sensor.diagnostics.message);
    } catch (err) {
      this.toast("error", `Sensor error: ${(err as Error).message}`);
    }
    this.emit();
  }

  disableSensorGravity() {
    this.settings.gravity.mode = "manual";
    this.sensor.disable();
    this.emit();
  }

  calibrateSensor() {
    const cal = this.sensor.calibrationFromCurrent();
    if (!cal) {
      this.toast("warning", "No orientation data yet — tilt the device and try again");
      return;
    }
    this.settings.gravity.calibration = cal;
    this.sensor.updateSettings(this.settings.gravity);
    this.toast("success", "Sensor recentered to current orientation");
    this.emit();
  }

  // ---------------------------------------------------------------- settings

  updateSettings<K extends keyof EditorSettings>(section: K, patch: Partial<EditorSettings[K]>) {
    this.settings = { ...this.settings, [section]: { ...this.settings[section], ...patch } };
    if (section === "engine") this.applyEngineSettings();
    if (section === "boundaries") this.rebuildBoundaries();
    if (section === "gravity") {
      this.sensor.updateSettings(this.settings.gravity);
      if ("mode" in patch) this.initSensorForMode();
    }
    this.emit();
  }

  private applyEngineSettings() {
    const e = this.settings.engine;
    this.engine.timing.timeScale = e.timeScale;
    this.engine.enableSleeping = e.enableSleeping;
    this.engine.positionIterations = e.positionIterations;
    this.engine.velocityIterations = e.velocityIterations;
    this.engine.constraintIterations = e.constraintIterations;
    if (!e.enableSleeping) for (const b of this.bodies) Sleeping.set(b.body, false);
  }

  updateLastUsedBody<K extends BodyKind>(kind: K, patch: Partial<LastUsed["bodies"][K]>) {
    const cur = this.lastUsed.bodies[kind];
    this.lastUsed.bodies[kind] = {
      ...cur,
      ...patch,
      render: { ...cur.render, ...(patch as { render?: Partial<typeof cur.render> }).render },
      collisionFilter: { ...cur.collisionFilter, ...(patch as { collisionFilter?: Partial<typeof cur.collisionFilter> }).collisionFilter },
    };
    this.emit();
  }

  updateLastUsedConstraint(kind: ConstraintKind, patch: Partial<LastUsed["constraints"][ConstraintKind]>) {
    const cur = this.lastUsed.constraints[kind];
    this.lastUsed.constraints[kind] = { ...cur, ...patch, render: { ...cur.render, ...patch.render } };
    this.emit();
  }

  /** Set by the canvas view so tool changes can discard in-progress operations. */
  tools: ToolController | null = null;

  setTool(tool: ToolId) {
    if (this.tool === tool) {
      // Re-activating the current tool returns to its settings view.
      this.tools?.resetTransient();
      if (tool !== "select") this.clearSelection();
      return;
    }
    this.tool = tool;
    this.preview = null;
    this.hoverId = null;
    if (tool !== "select") this.selection = [];
    this.tools?.resetTransient();
    this.emit();
  }

  setPanelOpen(open: boolean) {
    this.panelOpen = open;
    this.emitLive();
  }

  setCollapsed(key: string, collapsed: boolean) {
    this.updateSettings("ui", { collapsed: { ...this.settings.ui.collapsed, [key]: collapsed } });
  }

  // ------------------------------------------------------------------- scene

  getBody(id: string) {
    return this.bodies.find((b) => b.id === id) ?? null;
  }

  getConstraint(id: string) {
    return this.constraints.find((c) => c.id === id) ?? null;
  }

  addBody(data: BodyData): EditorBody {
    const body = createMatterBody(data);
    const entity: EditorBody = { id: data.id, kind: data.shape.kind, shape: JSON.parse(JSON.stringify(data.shape)), body };
    this.bodies.push(entity);
    Composite.add(this.engine.world, body);
    return entity;
  }

  addConstraint(data: ConstraintData): EditorConstraint | null {
    const a = data.bodyA ? this.getBody(data.bodyA) : null;
    const b = data.bodyB ? this.getBody(data.bodyB) : null;
    if ((data.bodyA && !a) || (data.bodyB && !b)) return null;
    if (!a && !b) return null;
    const constraint = createMatterConstraint(data, a?.body ?? null, b?.body ?? null);
    const entity: EditorConstraint = { id: data.id, kind: data.kind, constraint, bodyAId: a?.id ?? null, bodyBId: b?.id ?? null };
    this.constraints.push(entity);
    Composite.add(this.engine.world, constraint);
    return entity;
  }

  private removeConstraintEntity(e: EditorConstraint) {
    Composite.remove(this.engine.world, e.constraint);
    this.constraints = this.constraints.filter((c) => c !== e);
  }

  private removeBodyEntity(e: EditorBody) {
    for (const c of [...this.constraints]) {
      if (c.bodyAId === e.id || c.bodyBId === e.id) this.removeConstraintEntity(c);
    }
    Composite.remove(this.engine.world, e.body);
    this.bodies = this.bodies.filter((b) => b !== e);
  }

  serializeScene(): SceneData {
    return {
      bodies: this.bodies.map(serializeBody),
      constraints: this.constraints.map(serializeConstraint),
    };
  }

  /** Replaces all user entities with the given scene. Boundaries are untouched. */
  loadScene(scene: SceneData) {
    for (const c of this.constraints) Composite.remove(this.engine.world, c.constraint);
    for (const b of this.bodies) Composite.remove(this.engine.world, b.body);
    this.bodies = [];
    this.constraints = [];
    this.dragTargets = null;
    for (const b of scene.bodies) this.addBody(b);
    const dropped: string[] = [];
    for (const c of scene.constraints) {
      if (!this.addConstraint(c)) dropped.push(c.label || c.id);
    }
    if (dropped.length) this.toast("warning", `Dropped ${dropped.length} constraint(s) with missing bodies`);
    this.pruneSelection();
  }

  private pruneSelection() {
    this.selection = this.selection.filter((r) => (r.type === "body" ? this.getBody(r.id) : this.getConstraint(r.id)));
  }

  private nextLabel(kind: BodyKind) {
    const n = this.bodies.filter((b) => b.kind === kind).length + 1;
    return `${BODY_KIND_LABEL[kind]} ${n}`;
  }

  createBody(kind: BodyKind, shape: ShapeSpec, position: Vec2): EditorBody {
    const defaults = this.lastUsed.bodies[kind];
    const data = makeBodyData(makeId("b"), shape, position, defaults, this.nextLabel(kind));
    const entity = this.addBody(data);
    // remember creation dimensions for this kind only
    switch (shape.kind) {
      case "rectangle":
        this.lastUsed.bodies.rectangle = { ...this.lastUsed.bodies.rectangle, width: shape.width, height: shape.height };
        break;
      case "square":
        this.lastUsed.bodies.square = { ...this.lastUsed.bodies.square, size: shape.size };
        break;
      case "circle":
        this.lastUsed.bodies.circle = { ...this.lastUsed.bodies.circle, radius: shape.radius };
        break;
      case "polygon":
        this.lastUsed.bodies.polygon = { ...this.lastUsed.bodies.polygon, sides: shape.sides, radius: shape.radius };
        break;
    }
    this.emit();
    return entity;
  }

  createConstraint(kind: ConstraintKind, a: ConstraintEndpoint, b: ConstraintEndpoint): EditorConstraint | null {
    const defaults = this.lastUsed.constraints[kind];
    const n = this.constraints.filter((c) => c.kind === kind).length + 1;
    const data = makeConstraintData(makeId("c"), kind, a, b, defaults, `${CONSTRAINT_KIND_LABEL[kind]} ${n}`);
    const entity = this.addConstraint(data);
    if (entity) {
      this.selection = [{ type: "constraint", id: entity.id }];
      this.emit();
    }
    return entity;
  }

  // -------------------------------------------------------------- hit testing

  bodiesAt(p: Vec2): EditorBody[] {
    const hits = Query.point(
      this.bodies.map((b) => b.body),
      p,
    );
    const set = new Set(hits);
    return this.bodies.filter((b) => set.has(b.body));
  }

  bodyAt(p: Vec2): EditorBody | null {
    const hits = this.bodiesAt(p);
    return hits.length ? hits[hits.length - 1] : null;
  }

  constraintAt(p: Vec2, tolerance: number): { entity: EditorConstraint; distance: number } | null {
    let best: { entity: EditorConstraint; distance: number } | null = null;
    for (const e of this.constraints) {
      const { a, b } = constraintWorldPoints(e.constraint);
      const d = dist(a, b) < 2 ? dist(p, a) : pointToSegmentDistance(p, a, b);
      if (d <= tolerance && (!best || d < best.distance)) best = { entity: e, distance: d };
    }
    return best;
  }

  bodiesInRect(a: Vec2, b: Vec2): EditorBody[] {
    const bounds = Bounds.create([
      { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    ]);
    const hits = new Set(
      Query.region(
        this.bodies.map((e) => e.body),
        bounds,
      ),
    );
    return this.bodies.filter((e) => hits.has(e.body));
  }

  // ---------------------------------------------------------------- selection

  isSelected(ref: SelectionRef) {
    return this.selection.some((r) => r.type === ref.type && r.id === ref.id);
  }

  select(refs: SelectionRef[], mode: "replace" | "add" | "toggle" = "replace") {
    if (mode === "replace") {
      this.selection = [...refs];
    } else if (mode === "add") {
      const next = [...this.selection];
      for (const r of refs) if (!next.some((x) => x.type === r.type && x.id === r.id)) next.push(r);
      this.selection = next;
    } else {
      let next = [...this.selection];
      for (const r of refs) {
        if (next.some((x) => x.type === r.type && x.id === r.id)) next = next.filter((x) => !(x.type === r.type && x.id === r.id));
        else next.push(r);
      }
      this.selection = next;
    }
    this.emitLive();
  }

  clearSelection() {
    if (!this.selection.length) return;
    this.selection = [];
    this.emitLive();
  }

  selectAll() {
    this.selection = this.bodies.map((b) => ({ type: "body" as const, id: b.id }));
    this.emitLive();
  }

  selectedBodies(): EditorBody[] {
    return this.selection.filter((r) => r.type === "body").map((r) => this.getBody(r.id)).filter((b): b is EditorBody => Boolean(b));
  }

  selectedConstraints(): EditorConstraint[] {
    return this.selection
      .filter((r) => r.type === "constraint")
      .map((r) => this.getConstraint(r.id))
      .filter((c): c is EditorConstraint => Boolean(c));
  }

  // ------------------------------------------------------------- manipulation

  /** Drag targets are re-applied every frame so dragging stays stable while physics runs. */
  setDragTargets(targets: Map<string, Vec2>) {
    this.dragTargets = targets;
  }

  endDrag() {
    if (!this.dragTargets) return;
    this.applyDrag();
    this.dragTargets = null;
    this.emit();
  }

  private applyDrag() {
    if (!this.dragTargets) return;
    for (const [id, pos] of this.dragTargets) {
      const e = this.getBody(id);
      if (!e) continue;
      Sleeping.set(e.body, false);
      Body.setPosition(e.body, pos);
      Body.setVelocity(e.body, { x: 0, y: 0 });
      Body.setAngularVelocity(e.body, 0);
    }
  }

  moveSelectedBy(dx: number, dy: number) {
    for (const e of this.selectedBodies()) {
      Sleeping.set(e.body, false);
      Body.setPosition(e.body, { x: e.body.position.x + dx, y: e.body.position.y + dy });
    }
    this.emit();
  }

  deleteSelection() {
    const bodies = this.selectedBodies();
    const cons = this.selectedConstraints();
    if (!bodies.length && !cons.length) return;
    for (const c of cons) this.removeConstraintEntity(c);
    for (const b of bodies) this.removeBodyEntity(b);
    this.selection = [];
    this.emit();
    this.toast("info", `Deleted ${bodies.length ? `${bodies.length} body(ies)` : ""}${bodies.length && cons.length ? ", " : ""}${cons.length ? `${cons.length} constraint(s)` : ""}`);
  }

  duplicateSelection() {
    const bodies = this.selectedBodies();
    if (!bodies.length) return;
    const offset = this.settings.grid.snap ? this.settings.grid.spacing : 24;
    const idMap = new Map<string, string>();
    const newRefs: SelectionRef[] = [];
    for (const e of bodies) {
      const data = serializeBody(e);
      data.id = makeId("b");
      data.position = { x: data.position.x + offset, y: data.position.y + offset };
      data.label = `${data.label} copy`;
      idMap.set(e.id, data.id);
      this.addBody(data);
      newRefs.push({ type: "body", id: data.id });
    }
    for (const c of this.constraints) {
      const aIn = c.bodyAId ? idMap.has(c.bodyAId) : false;
      const bIn = c.bodyBId ? idMap.has(c.bodyBId) : false;
      if (!aIn && !bIn) continue;
      if ((c.bodyAId && !aIn) || (c.bodyBId && !bIn)) continue; // only duplicate fully-contained links
      const data = serializeConstraint(c);
      data.id = makeId("c");
      data.bodyA = c.bodyAId ? idMap.get(c.bodyAId)! : null;
      data.bodyB = c.bodyBId ? idMap.get(c.bodyBId)! : null;
      if (!data.bodyA) data.pointA = { x: data.pointA.x + offset, y: data.pointA.y + offset };
      if (!data.bodyB) data.pointB = { x: data.pointB.x + offset, y: data.pointB.y + offset };
      this.addConstraint(data);
    }
    this.selection = newRefs;
    this.emit();
  }

  align(mode: AlignMode) {
    const bodies = this.selectedBodies();
    if (bodies.length < 2) return;
    const minX = Math.min(...bodies.map((b) => b.body.bounds.min.x));
    const maxX = Math.max(...bodies.map((b) => b.body.bounds.max.x));
    const minY = Math.min(...bodies.map((b) => b.body.bounds.min.y));
    const maxY = Math.max(...bodies.map((b) => b.body.bounds.max.y));
    for (const e of bodies) {
      const { min, max } = e.body.bounds;
      const p = e.body.position;
      let dx = 0;
      let dy = 0;
      switch (mode) {
        case "left":
          dx = minX - min.x;
          break;
        case "hcenter":
          dx = (minX + maxX) / 2 - (min.x + max.x) / 2;
          break;
        case "right":
          dx = maxX - max.x;
          break;
        case "top":
          dy = minY - min.y;
          break;
        case "vcenter":
          dy = (minY + maxY) / 2 - (min.y + max.y) / 2;
          break;
        case "bottom":
          dy = maxY - max.y;
          break;
      }
      Sleeping.set(e.body, false);
      Body.setPosition(e.body, { x: p.x + dx, y: p.y + dy });
    }
    this.emit();
  }

  distribute(axis: "horizontal" | "vertical") {
    const bodies = this.selectedBodies();
    if (bodies.length < 3) return;
    const key = axis === "horizontal" ? "x" : "y";
    const sorted = [...bodies].sort((a, b) => a.body.position[key] - b.body.position[key]);
    const first = sorted[0].body.position[key];
    const last = sorted[sorted.length - 1].body.position[key];
    const gap = (last - first) / (sorted.length - 1);
    sorted.forEach((e, i) => {
      const target = first + gap * i;
      const p = e.body.position;
      Sleeping.set(e.body, false);
      Body.setPosition(e.body, key === "x" ? { x: target, y: p.y } : { x: p.x, y: target });
    });
    this.emit();
  }

  // --------------------------------------------------------------- properties

  setBodyProp(ids: string[], key: BodyPropKey, value: number | string | boolean) {
    for (const id of ids) {
      const e = this.getBody(id);
      if (!e) continue;
      Sleeping.set(e.body, false);
      applyBodyProp(e.body, key, value);
      this.rememberBodyProp(e, key, value);
    }
    this.emit();
  }

  private rememberBodyProp(e: EditorBody, key: BodyPropKey, value: number | string | boolean) {
    const lu = this.lastUsed.bodies[e.kind];
    const phys = readBodyPhysics(e.body);
    switch (key) {
      case "isStatic":
      case "isSensor":
      case "density":
      case "restitution":
      case "friction":
      case "frictionStatic":
      case "frictionAir":
      case "sleepThreshold":
        (lu as unknown as Record<string, unknown>)[key] = phys[key];
        break;
      case "group":
      case "category":
      case "mask":
        lu.collisionFilter = { ...phys.collisionFilter };
        break;
      case "fillStyle":
      case "strokeStyle":
      case "lineWidth":
      case "opacity":
        lu.render = { ...lu.render, [key]: key === "fillStyle" || key === "strokeStyle" ? String(value) : Number(value) };
        break;
    }
  }

  reshape(id: string, shape: ShapeSpec) {
    const e = this.getBody(id);
    if (!e) return;
    reshapeBody(e, shape);
    switch (shape.kind) {
      case "rectangle":
        this.lastUsed.bodies.rectangle = { ...this.lastUsed.bodies.rectangle, width: shape.width, height: shape.height };
        break;
      case "square":
        this.lastUsed.bodies.square = { ...this.lastUsed.bodies.square, size: shape.size };
        break;
      case "circle":
        this.lastUsed.bodies.circle = { ...this.lastUsed.bodies.circle, radius: shape.radius };
        break;
      case "polygon":
        this.lastUsed.bodies.polygon = { ...this.lastUsed.bodies.polygon, sides: shape.sides, radius: shape.radius };
        break;
    }
    this.emit();
  }

  setConstraintProp(id: string, key: ConstraintPropKey, value: number | string | boolean) {
    const e = this.getConstraint(id);
    if (!e) return;
    applyConstraintProp(e.constraint, key, value);
    const lu = this.lastUsed.constraints[e.kind];
    const c: Constraint = e.constraint;
    switch (key) {
      case "stiffness":
        lu.stiffness = c.stiffness;
        break;
      case "damping":
        lu.damping = c.damping ?? 0;
        break;
      case "strokeStyle":
      case "lineWidth":
      case "type":
      case "anchors":
        lu.render = { ...lu.render, [key]: (c.render as unknown as Record<string, unknown>)[key] as never };
        break;
    }
    if (e.bodyAId) Sleeping.set(this.getBody(e.bodyAId)!.body, false);
    if (e.bodyBId) Sleeping.set(this.getBody(e.bodyBId)!.body, false);
    this.emit();
  }

  // ------------------------------------------------------------- boundaries

  rebuildBoundaries() {
    for (const b of this.boundaries) Composite.remove(this.engine.world, b);
    this.boundaries = [];
    const s = this.settings.boundaries;
    const t = Math.max(4, s.thickness);
    const w = this.width;
    const h = this.height;
    const make = (label: string, x: number, y: number, bw: number, bh: number) => {
      const body = Bodies.rectangle(x, y, bw, bh, {
        isStatic: true,
        label: `boundary:${label}`,
        friction: s.friction,
        restitution: s.restitution,
        render: { visible: s.visible },
      });
      (body.plugin as Record<string, unknown>)[EDITOR_PLUGIN_KEY] = { boundary: true };
      return body;
    };
    if (s.top) this.boundaries.push(make("top", w / 2, t / 2, w + t * 2, t));
    if (s.bottom) this.boundaries.push(make("bottom", w / 2, h - t / 2, w + t * 2, t));
    if (s.left) this.boundaries.push(make("left", t / 2, h / 2, t, h + t * 2));
    if (s.right) this.boundaries.push(make("right", w - t / 2, h / 2, t, h + t * 2));
    if (this.boundaries.length) Composite.add(this.engine.world, this.boundaries);
    // Boundaries are drawn beneath bodies; keep them first in the world body list.
    for (const b of this.bodies) Sleeping.set(b.body, false);
  }

  // -------------------------------------------------------------- simulation

  start() {
    if (this.simState === "running") return;
    if (this.simState === "stopped") {
      this.resetSnapshot = this.serializeScene();
      this.stepCount = 0;
    }
    this.accumulator = 0;
    this.lastFrameTime = performance.now();
    this.simState = "running";
    this.emit();
  }

  pause() {
    if (this.simState !== "running") return;
    this.simState = "paused";
    this.emit();
  }

  stop() {
    if (this.simState === "stopped") return;
    this.simState = "stopped";
    this.emit();
  }

  step() {
    if (this.simState === "running") return;
    if (this.simState === "stopped") {
      this.resetSnapshot = this.serializeScene();
      this.stepCount = 0;
      this.simState = "paused";
    }
    this.applyGravity();
    Engine.update(this.engine, 1000 / Math.max(10, this.settings.engine.stepHz));
    this.stepCount++;
    this.emit();
  }

  reset() {
    if (!this.resetSnapshot) return;
    this.simState = "stopped";
    this.loadScene(this.resetSnapshot);
    this.resetSnapshot = null;
    this.stepCount = 0;
    this.emit();
  }

  clear() {
    this.simState = "stopped";
    this.resetSnapshot = null;
    this.loadScene({ bodies: [], constraints: [] });
    this.selection = [];
    this.preview = null;
    this.rebuildBoundaries();
    this.emit();
  }

  togglePlay() {
    if (this.simState === "running") this.pause();
    else this.start();
  }

  // -------------------------------------------------------------- persistence

  /** Scene that represents the user's editing state (pre-simulation snapshot while simulating). */
  editingScene(): SceneData {
    return this.simState !== "stopped" && this.resetSnapshot ? this.resetSnapshot : this.serializeScene();
  }

  buildDocument(): EditorDocument {
    return buildDocument(this.editingScene(), this.settings, this.lastUsed);
  }

  private scheduleAutosave() {
    if (!this.autosaveEnabled) return;
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      try {
        saveDocument(this.buildDocument());
      } catch (err) {
        console.warn("Autosave failed", err);
      }
    }, 800);
  }

  save() {
    try {
      saveDocument(this.buildDocument());
      this.autosaveEnabled = true;
      this.storageCorrupt = false;
      this.toast("success", "Saved to browser storage");
      this.emitLive();
    } catch (err) {
      this.toast("error", `Save failed: ${(err as Error).message}`);
    }
  }

  load() {
    let doc: EditorDocument | null;
    try {
      doc = loadDocument();
    } catch (err) {
      this.toast("error", `Load failed: ${(err as Error).message}`);
      return;
    }
    if (!doc) {
      this.toast("warning", "No saved level found in browser storage");
      return;
    }
    this.applyDocument(doc, true);
    this.toast("success", `Loaded "${doc.settings.world.name}" (${doc.scene.bodies.length} bodies)`);
  }

  private applyDocument(doc: EditorDocument, notify: boolean) {
    this.simState = "stopped";
    this.resetSnapshot = null;
    this.settings = mergeInto(createDefaultSettings(), doc.settings);
    this.lastUsed = mergeInto(createDefaultLastUsed(), doc.lastUsed);
    this.sensor.updateSettings(this.settings.gravity);
    this.applyEngineSettings();
    this.loadScene(doc.scene);
    this.selection = [];
    this.preview = null;
    if (this.canvas) this.rebuildBoundaries();
    if (notify) {
      this.initSensorForMode();
      this.emit();
    }
  }

  exportJson() {
    const doc = this.buildDocument();
    const safe = doc.settings.world.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "level";
    downloadJson(`${safe}.level.json`, doc);
    this.toast("success", "Exported level JSON");
  }

  /** Validates before touching the working scene. */
  importJson(text: string) {
    let doc: EditorDocument;
    try {
      doc = parseDocumentText(text);
    } catch (err) {
      const msg = err instanceof DocumentError ? err.message : `Unexpected error: ${(err as Error).message}`;
      this.toast("error", `Import rejected: ${msg}`);
      return false;
    }
    this.applyDocument(doc, true);
    this.toast("success", `Imported "${doc.settings.world.name}" (${doc.scene.bodies.length} bodies, ${doc.scene.constraints.length} constraints)`);
    return true;
  }

  clearSavedData() {
    clearSavedDocument();
    this.storageCorrupt = false;
    this.autosaveEnabled = false; // don't immediately re-save; resume on next explicit action
    this.toast("info", "Cleared saved data. Autosave resumes after your next change.");
    window.setTimeout(() => {
      this.autosaveEnabled = true;
    }, 0);
    this.emitLive();
  }

  restoreDefaults() {
    const name = this.settings.world.name;
    this.settings = createDefaultSettings();
    this.settings.world.name = name;
    this.lastUsed = createDefaultLastUsed();
    this.sensor.updateSettings(this.settings.gravity);
    this.applyEngineSettings();
    this.rebuildBoundaries();
    this.initSensorForMode();
    this.toast("info", "Settings and tool defaults restored");
    this.emit();
  }

  hasSaved() {
    return hasSavedDocument();
  }

  snapIfEnabled(p: Vec2): Vec2 {
    return this.settings.grid.snap ? snapPoint(p, this.settings.grid.spacing) : p;
  }
}
