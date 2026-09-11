// Editor model: creation tools, selection, dragging/throwing, custom polygon drawing, alignment.
// All pointer input arrives through Pointer Events on the canvas and is mapped to world coordinates via the view.
import Matter from 'matter-js';
import { World } from '../sim/world';
import { makeRigidDef, makeSoftDef, makeRegionDef, makeConstraintDef, regularPolygon, type Vec2, type ToolDefaults } from '../sim/schema';
import { sanitizePolygon, distToSegment, snapValue, rotate, centroid } from '../sim/geometry';
import { setVelocity } from '../sim/rigid';
import type { SoftBody } from '../sim/soft';

const { Constraint, Composite, Body, Vertices } = Matter;

export type Tool = 'select' | 'rect' | 'circle' | 'polygon' | 'soft' | 'fluid' | 'constraint';
export type EntityKind = 'rigid' | 'soft' | 'constraint' | 'region';
export interface Hit { id: string; kind: EntityKind }
export interface View { scale: number; ox: number; oy: number; cssW: number; cssH: number }

export interface Preview {
  type: 'rect' | 'circle' | 'polygon' | 'region' | 'softRect';
  x0: number; y0: number; x1: number; y1: number; sides?: number; star?: boolean; points?: number; inner?: number;
}

const COLORS = ['#e0a552', '#f2704e', '#d9c94a', '#c58a4a', '#b5b9c2', '#9fd0f2', '#e07ab8'];
const SOFT_COLORS = ['#5fc98f', '#4fb8d9', '#c7e06a', '#f0a3c8'];
const THROW_MAX = 2500;

export class Editor {
  tool: Tool = 'select';
  polygonCustom = false;
  selection = new Set<string>();
  multiSelectMode = false;
  message = '';
  view: View = { scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1 };
  isRunning: () => boolean = () => false;
  onChange: (() => void) | null = null;
  onAfterEdit: (() => void) | null = null;
  // transient interaction state (read by the renderer)
  preview: Preview | null = null;
  marquee: { x0: number; y0: number; x1: number; y1: number } | null = null;
  polygonPoints: Vec2[] = [];
  constraintDrag: { from: Hit; fromWorld: Vec2; to: Vec2 } | null = null;
  pointerWorld: Vec2 = { x: 0, y: 0 };
  dragConstraints: Matter.Constraint[] = [];

  private pointerId: number | null = null;
  private pointerType = 'mouse';
  private mode: 'none' | 'pending' | 'drag' | 'marquee' | 'create' | 'constraint' = 'none';
  private down: Vec2 = { x: 0, y: 0 };
  private downScreen: Vec2 = { x: 0, y: 0 };
  private lastDelta: Vec2 = { x: 0, y: 0 };
  private history: { x: number; y: number; t: number }[] = [];
  private dragSofts: { sb: SoftBody; node: number; ox: number; oy: number }[] = [];
  private dragBodies: Matter.Body[] = [];
  private dragStart = new Map<string, Vec2>();
  private lastClickTime = 0;
  private colorIdx = 0;
  private handlers: { [k: string]: (e: any) => void } = {};

  constructor(public world: World, private canvas: HTMLCanvasElement) {}

  private get td(): ToolDefaults { return this.world.ui.toolDefaults; }
  private notify() { this.onChange?.(); }
  private edited() { this.onAfterEdit?.(); }
  setMessage(m: string) { this.message = m; this.notify(); }

  setTool(t: Tool) {
    if (this.tool === t) return;
    this.cancelInteraction();
    this.polygonPoints = [];
    this.tool = t; this.message = '';
    this.notify();
  }

  // ---------- attachment ----------
  attach() {
    const c = this.canvas;
    this.handlers.down = (e: PointerEvent) => this.onPointerDown(e);
    this.handlers.move = (e: PointerEvent) => this.onPointerMove(e);
    this.handlers.up = (e: PointerEvent) => this.onPointerUp(e);
    this.handlers.cancel = (e: PointerEvent) => this.onPointerCancel(e);
    this.handlers.key = (e: KeyboardEvent) => this.onKey(e);
    this.handlers.ctx = (e: Event) => e.preventDefault();
    c.addEventListener('pointerdown', this.handlers.down);
    c.addEventListener('pointermove', this.handlers.move);
    c.addEventListener('pointerup', this.handlers.up);
    c.addEventListener('pointercancel', this.handlers.cancel);
    c.addEventListener('contextmenu', this.handlers.ctx);
    window.addEventListener('keydown', this.handlers.key);
  }

  detach() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.handlers.down);
    c.removeEventListener('pointermove', this.handlers.move);
    c.removeEventListener('pointerup', this.handlers.up);
    c.removeEventListener('pointercancel', this.handlers.cancel);
    c.removeEventListener('contextmenu', this.handlers.ctx);
    window.removeEventListener('keydown', this.handlers.key);
    this.cancelInteraction();
  }

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    const v = this.view;
    return { x: (clientX - r.left - v.ox) / v.scale, y: (clientY - r.top - v.oy) / v.scale };
  }

  private snap(p: Vec2): Vec2 {
    const ui = this.world.ui;
    return { x: snapValue(p.x, ui.gridSize, ui.snap), y: snapValue(p.y, ui.gridSize, ui.snap) };
  }

  private tolerance(): number { return (this.pointerType === 'touch' ? 20 : 10) / this.view.scale; }

  // ---------- hit testing ----------
  constraintEndpoints(id: string): { a: Vec2; b: Vec2 } | null {
    const e = this.world.constraints.get(id);
    if (!e) return null;
    const d = e.def;
    if (d.softA) {
      const sb = this.world.soft.get(d.softA);
      if (!sb) return null;
      return { a: { ...d.pointA }, b: { x: sb.pos[2 * d.nodeA], y: sb.pos[2 * d.nodeA + 1] } };
    }
    const ba = d.bodyA ? this.world.rigid.get(d.bodyA)?.body : null;
    const bb = d.bodyB ? this.world.rigid.get(d.bodyB)?.body : null;
    const a = ba ? add(ba.position, rotate(d.pointA, ba.angle)) : { ...d.pointA };
    const b = bb ? add(bb.position, rotate(d.pointB, bb.angle)) : { ...d.pointB };
    return { a, b };
  }

  hitTest(x: number, y: number, includeRegions = false): Hit | null {
    const w = this.world, tol = this.tolerance();
    // pins first (small markers that sit on bodies)
    for (const [id, e] of w.constraints) {
      if (e.def.kind !== 'pin') continue;
      const ep = this.constraintEndpoints(id);
      if (ep && Math.hypot(ep.a.x - x, ep.a.y - y) < tol) return { id, kind: 'constraint' };
    }
    const bodies = w.bodies;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (x < b.bounds.min.x || x > b.bounds.max.x || y < b.bounds.min.y || y > b.bounds.max.y) continue;
      const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const p of parts) if (Vertices.contains(p.vertices, { x, y })) return { id: (b as any).defId, kind: 'rigid' };
    }
    for (const [id, sb] of w.soft) if (sb.containsPoint(x, y)) return { id, kind: 'soft' };
    for (const [id] of w.constraints) {
      const ep = this.constraintEndpoints(id);
      if (ep && distToSegment(x, y, ep.a.x, ep.a.y, ep.b.x, ep.b.y) < tol) return { id, kind: 'constraint' };
    }
    if (includeRegions || w.ui.debug.fluidRegions) {
      for (const [id, r] of w.regions) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { id, kind: 'region' };
    } else {
      for (const [id, r] of w.regions) if (r.type === 'emitter' && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { id, kind: 'region' };
    }
    return null;
  }

  kindOf(id: string): EntityKind | null {
    const w = this.world;
    return w.rigid.has(id) ? 'rigid' : w.soft.has(id) ? 'soft' : w.constraints.has(id) ? 'constraint' : w.regions.has(id) ? 'region' : null;
  }

  // ---------- pointer events ----------
  private onPointerDown(e: PointerEvent) {
    if (this.pointerId !== null) return; // single active pointer
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.pointerId = e.pointerId; this.pointerType = e.pointerType;
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    const p = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorld = p;
    this.down = p; this.downScreen = { x: e.clientX, y: e.clientY };
    this.history = [{ x: p.x, y: p.y, t: performance.now() }];
    this.lastDelta = { x: 0, y: 0 };
    const additive = e.shiftKey || e.ctrlKey || e.metaKey || this.multiSelectMode;
    const now = performance.now();
    const dbl = now - this.lastClickTime < 350;
    this.lastClickTime = now;

    switch (this.tool) {
      case 'select': {
        const hit = this.hitTest(p.x, p.y);
        if (hit) {
          if (additive) { this.toggleSelect(hit.id); this.mode = 'none'; }
          else {
            if (!this.selection.has(hit.id)) { this.selection.clear(); this.selection.add(hit.id); this.notify(); }
            this.mode = 'pending';
          }
        } else {
          this.mode = 'marquee';
          this.marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
          if (!additive && this.selection.size) { this.selection.clear(); this.notify(); }
        }
        break;
      }
      case 'rect': case 'circle': case 'fluid':
        this.mode = 'create'; this.updatePreview(p);
        break;
      case 'polygon':
        if (this.polygonCustom) this.addPolygonPoint(this.snap(p), dbl);
        else { this.mode = 'create'; this.updatePreview(p); }
        break;
      case 'soft':
        if (this.td.softShape === 'polygon') this.addPolygonPoint(this.snap(p), dbl);
        else { this.mode = 'create'; this.updatePreview(p); }
        break;
      case 'constraint': {
        const hit = this.hitTest(p.x, p.y);
        if (!hit || (hit.kind !== 'rigid' && hit.kind !== 'soft')) { this.setMessage('Constraint: start on a rigid or soft body'); break; }
        if (this.td.constraintKind === 'pin') { this.createPin(hit, p); break; }
        this.mode = 'constraint';
        this.constraintDrag = { from: hit, fromWorld: p, to: p };
        break;
      }
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) {
      if (this.pointerId === null) this.pointerWorld = this.screenToWorld(e.clientX, e.clientY);
      return;
    }
    const p = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorld = p;
    const now = performance.now();
    this.history.push({ x: p.x, y: p.y, t: now });
    if (this.history.length > 12) this.history.shift();
    const movedPx = Math.hypot(e.clientX - this.downScreen.x, e.clientY - this.downScreen.y);
    switch (this.mode) {
      case 'pending':
        if (movedPx > 4) { this.mode = 'drag'; this.beginDrag(p); this.updateDrag(p); }
        break;
      case 'drag': this.updateDrag(p); break;
      case 'marquee': if (this.marquee) { this.marquee.x1 = p.x; this.marquee.y1 = p.y; } break;
      case 'create': this.updatePreview(p); break;
      case 'constraint': if (this.constraintDrag) this.constraintDrag.to = p; break;
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    const p = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorld = p;
    switch (this.mode) {
      case 'drag': this.endDrag(p); break;
      case 'marquee': this.endMarquee(e.shiftKey || e.ctrlKey || e.metaKey || this.multiSelectMode); break;
      case 'create': this.finishCreate(p); break;
      case 'constraint': this.finishConstraint(p); break;
    }
    this.mode = 'none';
    this.releasePointer(e.pointerId);
  }

  private onPointerCancel(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.cancelInteraction();
    this.releasePointer(e.pointerId);
  }

  private releasePointer(id: number) {
    try { this.canvas.releasePointerCapture(id); } catch { /* already released */ }
    this.pointerId = null;
  }

  cancelInteraction() {
    this.clearDragConstraints();
    this.preview = null; this.marquee = null; this.constraintDrag = null;
    this.mode = 'none';
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (this.selection.size) { e.preventDefault(); this.deleteSelection(); } }
    else if (e.key === 'Escape') { if (this.polygonPoints.length) this.cancelPolygon(); else { this.selection.clear(); this.notify(); } }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelection(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); }
    else if (e.key === 'Enter' && this.polygonPoints.length) { this.finishPolygon(); }
  }

  // ---------- selection ----------
  toggleSelect(id: string) { if (this.selection.has(id)) this.selection.delete(id); else this.selection.add(id); this.notify(); }
  select(ids: string[]) { this.selection = new Set(ids); this.notify(); }
  clearSelection() { if (this.selection.size) { this.selection.clear(); this.notify(); } }
  selectAll() { this.selection = new Set([...this.world.rigid.keys(), ...this.world.soft.keys(), ...this.world.constraints.keys()]); this.notify(); }

  /** Drop ids that no longer exist (after reset/load/delete). */
  pruneSelection() {
    let changed = false;
    for (const id of [...this.selection]) if (!this.kindOf(id)) { this.selection.delete(id); changed = true; }
    if (changed) this.notify();
  }

  private endMarquee(additive: boolean) {
    const m = this.marquee;
    this.marquee = null;
    if (!m) return;
    const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
    if (x1 - x0 < 3 && y1 - y0 < 3) { if (!additive) this.clearSelection(); return; }
    const inside = (p: Vec2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    if (!additive) this.selection.clear();
    for (const [id, e] of this.world.rigid) if (inside(e.body.position)) this.selection.add(id);
    const tmp = new Float32Array(2);
    for (const [id, sb] of this.world.soft) { sb.centroid(tmp); if (inside({ x: tmp[0], y: tmp[1] })) this.selection.add(id); }
    for (const [id] of this.world.constraints) { const ep = this.constraintEndpoints(id); if (ep && inside(ep.a) && inside(ep.b)) this.selection.add(id); }
    for (const [id, r] of this.world.regions) if ((r.type === 'emitter' || this.world.ui.debug.fluidRegions) && inside({ x: r.x + r.w / 2, y: r.y + r.h / 2 })) this.selection.add(id);
    this.notify();
  }

  // ---------- dragging ----------
  private beginDrag(p: Vec2) {
    const w = this.world;
    this.dragStart.clear(); this.dragSofts = []; this.dragBodies = [];
    const running = this.isRunning();
    for (const id of this.selection) {
      const r = w.rigid.get(id);
      if (r) {
        this.dragStart.set(id, { x: r.body.position.x, y: r.body.position.y });
        if (running && !r.body.isStatic) {
          const c = Constraint.create({ pointA: { x: p.x, y: p.y }, bodyB: r.body, pointB: { x: p.x - r.body.position.x, y: p.y - r.body.position.y }, stiffness: 0.2, damping: 0.08, length: 0, label: '__drag' });
          Composite.add(w.engine.world, c);
          this.dragConstraints.push(c);
          this.dragBodies.push(r.body);
        }
        continue;
      }
      const sb = w.soft.get(id);
      if (sb) {
        const tmp = new Float32Array(2); sb.centroid(tmp);
        this.dragStart.set(id, { x: tmp[0], y: tmp[1] });
        if (running) {
          let best = Infinity, node = 0;
          for (let i = 0; i < sb.n; i++) { const d = Math.hypot(sb.pos[2 * i] - p.x, sb.pos[2 * i + 1] - p.y); if (d < best) { best = d; node = i; } }
          this.dragSofts.push({ sb, node, ox: sb.pos[2 * node] - p.x, oy: sb.pos[2 * node + 1] - p.y });
        }
        continue;
      }
      const g = w.regions.get(id);
      if (g) { this.dragStart.set(id, { x: g.x, y: g.y }); continue; }
      const c = w.constraints.get(id);
      if (c && !c.def.bodyA && !c.def.softA) this.dragStart.set(id, { ...c.def.pointA });
      else if (c && c.def.softA) this.dragStart.set(id, { ...c.def.pointA });
    }
  }

  private updateDrag(p: Vec2) {
    const w = this.world, running = this.isRunning();
    const raw = { x: p.x - this.down.x, y: p.y - this.down.y };
    const snapped = this.world.ui.snap ? this.snap(raw) : raw;
    for (const c of this.dragConstraints) c.pointA = { x: p.x, y: p.y };
    for (const d of this.dragSofts) d.sb.dragTarget = { node: d.node, x: p.x + d.ox, y: p.y + d.oy };
    for (const [id, start] of this.dragStart) {
      const nx = start.x + snapped.x, ny = start.y + snapped.y;
      const r = w.rigid.get(id);
      if (r) {
        if (running && !r.body.isStatic) continue; // physics-driven via constraint
        Body.setPosition(r.body, { x: nx, y: ny });
        if (!running) { setVelocity(r.body, 0, 0); r.def.x = nx; r.def.y = ny; } else { r.def.x = nx; r.def.y = ny; }
        continue;
      }
      const sb = w.soft.get(id);
      if (sb) {
        if (running) continue;
        sb.translate(snapped.x - this.lastDelta.x, snapped.y - this.lastDelta.y);
        sb.def.x += snapped.x - this.lastDelta.x; sb.def.y += snapped.y - this.lastDelta.y;
        sb.setVelocityAll(0, 0);
        continue;
      }
      const g = w.regions.get(id);
      if (g) { g.x = nx; g.y = ny; continue; }
      const c = w.constraints.get(id);
      if (c) w.updateConstraint(id, { pointA: { x: nx, y: ny } });
    }
    this.lastDelta = snapped;
  }

  private throwVelocity(): Vec2 {
    const h = this.history, now = performance.now();
    let i = h.length - 1;
    while (i > 0 && now - h[i - 1].t < 90) i--;
    const a = h[i], b = h[h.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.005) return { x: 0, y: 0 };
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp > THROW_MAX) { vx *= THROW_MAX / sp; vy *= THROW_MAX / sp; }
    return { x: vx, y: vy };
  }

  private endDrag(_p: Vec2) {
    const v = this.throwVelocity();
    const running = this.isRunning();
    const speed = Math.hypot(v.x, v.y);
    this.clearDragConstraints();
    if (speed > 60) {
      for (const id of this.selection) {
        const r = this.world.rigid.get(id);
        if (r && !r.body.isStatic) { setVelocity(r.body, v.x, v.y); if (!running) { r.def.vx = v.x; r.def.vy = v.y; } }
        const sb = this.world.soft.get(id);
        if (sb) { sb.setVelocityAll(v.x, v.y); if (!running) { sb.def.vx = v.x; sb.def.vy = v.y; } }
      }
    }
    this.world.markChanged();
    this.edited();
  }

  private clearDragConstraints() {
    for (const c of this.dragConstraints) Composite.remove(this.world.engine.world, c);
    this.dragConstraints = [];
    for (const d of this.dragSofts) d.sb.dragTarget = null;
    this.dragSofts = []; this.dragBodies = [];
    this.dragStart.clear();
  }

  // ---------- creation ----------
  private updatePreview(p: Vec2) {
    const a = this.snap(this.down), b = this.snap(p);
    const td = this.td;
    if (this.tool === 'rect') this.preview = { type: 'rect', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    else if (this.tool === 'circle') this.preview = { type: 'circle', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    else if (this.tool === 'polygon') this.preview = { type: 'polygon', x0: a.x, y0: a.y, x1: b.x, y1: b.y, sides: td.rigidSides };
    else if (this.tool === 'fluid') this.preview = { type: 'region', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    else if (this.tool === 'soft') {
      if (td.softShape === 'rect') this.preview = { type: 'softRect', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
      else this.preview = { type: 'circle', x0: a.x, y0: a.y, x1: b.x, y1: b.y, star: td.softShape === 'star', points: 5, inner: 0.5 };
    }
  }

  private nextColor(soft: boolean) { const arr = soft ? SOFT_COLORS : COLORS; return arr[this.colorIdx++ % arr.length]; }

  private finishCreate(p: Vec2) {
    const pv = this.preview;
    this.preview = null;
    if (!pv) return;
    void p;
    const w = this.world, td = this.td;
    const x = Math.min(pv.x0, pv.x1), y = Math.min(pv.y0, pv.y1), bw = Math.abs(pv.x1 - pv.x0), bh = Math.abs(pv.y1 - pv.y0);
    const r = Math.hypot(pv.x1 - pv.x0, pv.y1 - pv.y0);
    let newId: string | null = null;
    const rigidBase = { isStatic: td.rigidStatic, density: td.rigidDensity, friction: td.rigidFriction, restitution: td.rigidRestitution, color: td.rigidStatic ? '#8a94a6' : this.nextColor(false) };
    if (pv.type === 'rect') {
      if (bw < 8 || bh < 8) return this.setMessage('Rectangle too small');
      const def = makeRigidDef({ ...rigidBase, shape: 'rect', x: x + bw / 2, y: y + bh / 2, w: bw, h: bh });
      newId = w.addRigid(def) ? def.id : null;
    } else if (pv.type === 'circle' && this.tool === 'circle') {
      if (r < 6) return this.setMessage('Circle too small');
      const def = makeRigidDef({ ...rigidBase, shape: 'circle', x: pv.x0, y: pv.y0, radius: Math.min(r, 600) });
      newId = w.addRigid(def) ? def.id : null;
    } else if (pv.type === 'polygon') {
      if (r < 8) return this.setMessage('Polygon too small');
      const rad = Math.min(r, 600);
      const def = makeRigidDef({ ...rigidBase, shape: 'polygon', x: pv.x0, y: pv.y0, radius: rad, vertices: regularPolygon(Math.max(3, Math.min(12, td.rigidSides)), rad) });
      newId = w.addRigid(def) ? def.id : null;
    } else if (pv.type === 'region') {
      if (bw < 10 || bh < 10) return this.setMessage('Fluid region too small');
      const def = makeRegionDef({ type: td.fluidMode, x, y, w: bw, h: bh, rate: td.emitterRate });
      w.addRegion(def); newId = def.id;
    } else if (pv.type === 'softRect') {
      if (bw < 20 || bh < 20) return this.setMessage('Soft body too small (min 20)');
      const def = makeSoftDef({ shape: 'rect', x: x + bw / 2, y: y + bh / 2, w: bw, h: bh, resolution: td.softResolution, stiffness: td.softStiffness, pressure: td.softPressure, density: td.softDensity, color: this.nextColor(true) });
      newId = w.addSoft(def) ? def.id : null;
    } else if (pv.type === 'circle') {
      if (r < 15) return this.setMessage('Soft body too small (min radius 15)');
      const def = makeSoftDef({ shape: pv.star ? 'star' : 'blob', x: pv.x0, y: pv.y0, radius: Math.min(r, 500), points: 5, innerRatio: 0.5, resolution: td.softResolution, stiffness: td.softStiffness, pressure: td.softPressure, density: td.softDensity, color: this.nextColor(true) });
      newId = w.addSoft(def) ? def.id : null;
    }
    if (newId) { this.selection = new Set([newId]); this.message = ''; }
    else this.message = 'Could not create object (invalid geometry)';
    this.notify(); this.edited();
  }

  // ---------- custom polygons ----------
  private addPolygonPoint(p: Vec2, dbl: boolean) {
    const pts = this.polygonPoints;
    if (pts.length >= 3) {
      const first = pts[0];
      if (Math.hypot(first.x - p.x, first.y - p.y) < this.tolerance() * 1.5 || dbl) { this.finishPolygon(); return; }
    }
    if (dbl && pts.length) return;
    pts.push(p);
    this.message = `${pts.length} vertices — click first vertex, double-click or press Enter to finish`;
    this.notify();
  }

  undoPolygonPoint() { this.polygonPoints.pop(); this.notify(); }
  cancelPolygon() { this.polygonPoints = []; this.message = ''; this.notify(); }

  finishPolygon(): boolean {
    const isSoft = this.tool === 'soft';
    const res = sanitizePolygon(this.polygonPoints, isSoft ? 400 : 100);
    if (!res.ok) { this.setMessage(`Polygon rejected: ${res.reason}`); return false; }
    const c = centroid(res.pts);
    const local = res.pts.map(v => ({ x: v.x - c.x, y: v.y - c.y }));
    const radius = Math.max(...local.map(v => Math.hypot(v.x, v.y)));
    const td = this.td;
    let id: string | null = null;
    if (isSoft) {
      const def = makeSoftDef({ shape: 'polygon', x: c.x, y: c.y, vertices: local, radius, resolution: td.softResolution, stiffness: td.softStiffness, pressure: td.softPressure, density: td.softDensity, color: this.nextColor(true) });
      id = this.world.addSoft(def) ? def.id : null;
    } else {
      const def = makeRigidDef({ shape: 'polygon', x: c.x, y: c.y, vertices: local, radius, isStatic: td.rigidStatic, density: td.rigidDensity, friction: td.rigidFriction, restitution: td.rigidRestitution, color: td.rigidStatic ? '#8a94a6' : this.nextColor(false) });
      id = this.world.addRigid(def) ? def.id : null;
    }
    this.polygonPoints = [];
    if (!id) { this.setMessage('Polygon rejected: could not build a valid body'); return false; }
    this.selection = new Set([id]); this.message = '';
    this.notify(); this.edited();
    return true;
  }

  // ---------- constraints ----------
  private localPoint(body: Matter.Body, p: Vec2): Vec2 { return rotate({ x: p.x - body.position.x, y: p.y - body.position.y }, -body.angle); }

  private nearestNode(sb: SoftBody, p: Vec2): number {
    let best = Infinity, node = 0;
    for (let i = 0; i < sb.n; i++) { const d = Math.hypot(sb.pos[2 * i] - p.x, sb.pos[2 * i + 1] - p.y); if (d < best) { best = d; node = i; } }
    return node;
  }

  private createPin(hit: Hit, p: Vec2) {
    const w = this.world;
    let def;
    if (hit.kind === 'rigid') {
      const body = w.rigid.get(hit.id)!.body;
      def = makeConstraintDef({ kind: 'pin', bodyA: null, bodyB: hit.id, pointA: this.snap(p), pointB: this.localPoint(body, p), length: 0, stiffness: 1, damping: 0 });
    } else {
      const sb = w.soft.get(hit.id)!;
      const node = this.nearestNode(sb, p);
      def = makeConstraintDef({ kind: 'pin', softA: hit.id, nodeA: node, pointA: { x: sb.pos[2 * node], y: sb.pos[2 * node + 1] }, length: 0, stiffness: 1, damping: 0 });
    }
    if (w.addConstraint(def)) { this.selection = new Set([def.id]); this.message = ''; } else this.message = 'Could not create pin';
    this.notify(); this.edited();
  }

  private finishConstraint(p: Vec2) {
    const cd = this.constraintDrag;
    this.constraintDrag = null;
    if (!cd) return;
    const w = this.world, td = this.td, kind = td.constraintKind;
    const stiffness = kind === 'link' ? 1 : td.springStiffness;
    const target = this.hitTest(p.x, p.y);
    let def;
    if (cd.from.kind === 'soft') {
      const sb = w.soft.get(cd.from.id)!;
      const node = this.nearestNode(sb, cd.fromWorld);
      def = makeConstraintDef({ kind, softA: cd.from.id, nodeA: node, pointA: this.snap(p), length: 0, stiffness: kind === 'link' ? 1 : Math.min(0.5, stiffness * 4), damping: 0 });
    } else {
      const bodyA = w.rigid.get(cd.from.id)!.body;
      const pointA = this.localPoint(bodyA, cd.fromWorld);
      if (target && target.kind === 'rigid' && target.id !== cd.from.id) {
        const bodyB = w.rigid.get(target.id)!.body;
        const len = Math.hypot(p.x - cd.fromWorld.x, p.y - cd.fromWorld.y);
        def = makeConstraintDef({ kind, bodyA: cd.from.id, bodyB: target.id, pointA, pointB: this.localPoint(bodyB, p), length: len, stiffness, damping: kind === 'spring' ? 0.02 : 0 });
      } else {
        const anchor = this.snap(p);
        const len = Math.hypot(anchor.x - cd.fromWorld.x, anchor.y - cd.fromWorld.y);
        def = makeConstraintDef({ kind, bodyA: null, bodyB: cd.from.id, pointA: anchor, pointB: pointA, length: len, stiffness, damping: kind === 'spring' ? 0.02 : 0 });
      }
    }
    if (w.addConstraint(def)) { this.selection = new Set([def.id]); this.message = ''; } else this.message = 'Could not create constraint';
    this.notify(); this.edited();
  }

  // ---------- commands ----------
  deleteSelection() {
    if (!this.selection.size) return;
    this.clearDragConstraints();
    this.world.remove([...this.selection]);
    this.selection.clear();
    this.notify(); this.edited();
  }

  duplicateSelection() {
    if (!this.selection.size) return;
    const ids = this.world.duplicate([...this.selection]);
    this.selection = new Set(ids);
    this.notify(); this.edited();
  }

  entityBounds(id: string): { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number } | null {
    const w = this.world;
    const r = w.rigid.get(id);
    if (r) { const b = r.body.bounds; return { minX: b.min.x, minY: b.min.y, maxX: b.max.x, maxY: b.max.y, cx: r.body.position.x, cy: r.body.position.y }; }
    const sb = w.soft.get(id);
    if (sb) { const t = new Float32Array(2); sb.centroid(t); return { minX: sb.minX, minY: sb.minY, maxX: sb.maxX, maxY: sb.maxY, cx: t[0], cy: t[1] }; }
    const g = w.regions.get(id);
    if (g) return { minX: g.x, minY: g.y, maxX: g.x + g.w, maxY: g.y + g.h, cx: g.x + g.w / 2, cy: g.y + g.h / 2 };
    return null;
  }

  moveEntityBy(id: string, dx: number, dy: number) {
    const w = this.world;
    const r = w.rigid.get(id);
    if (r) { w.updateRigid(id, { x: r.body.position.x + dx, y: r.body.position.y + dy }); return; }
    const sb = w.soft.get(id);
    if (sb) { w.updateSoft(id, { x: sb.def.x + dx, y: sb.def.y + dy }); return; }
    const g = w.regions.get(id);
    if (g) w.updateRegion(id, { x: g.x + dx, y: g.y + dy });
  }

  align(mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    const items = [...this.selection].map(id => ({ id, b: this.entityBounds(id) })).filter(i => i.b) as { id: string; b: NonNullable<ReturnType<Editor['entityBounds']>> }[];
    if (items.length < 2) return;
    const minX = Math.min(...items.map(i => i.b.minX)), maxX = Math.max(...items.map(i => i.b.maxX));
    const minY = Math.min(...items.map(i => i.b.minY)), maxY = Math.max(...items.map(i => i.b.maxY));
    for (const it of items) {
      const b = it.b;
      let dx = 0, dy = 0;
      if (mode === 'left') dx = minX - b.minX; else if (mode === 'right') dx = maxX - b.maxX; else if (mode === 'hcenter') dx = (minX + maxX) / 2 - b.cx;
      else if (mode === 'top') dy = minY - b.minY; else if (mode === 'bottom') dy = maxY - b.maxY; else if (mode === 'vcenter') dy = (minY + maxY) / 2 - b.cy;
      if (dx || dy) this.moveEntityBy(it.id, dx, dy);
    }
    this.edited();
  }

  distribute(axis: 'x' | 'y') {
    const items = [...this.selection].map(id => ({ id, b: this.entityBounds(id) })).filter(i => i.b) as { id: string; b: NonNullable<ReturnType<Editor['entityBounds']>> }[];
    if (items.length < 3) return;
    items.sort((a, b) => (axis === 'x' ? a.b.cx - b.b.cx : a.b.cy - b.b.cy));
    const first = axis === 'x' ? items[0].b.cx : items[0].b.cy, last = axis === 'x' ? items[items.length - 1].b.cx : items[items.length - 1].b.cy;
    const step = (last - first) / (items.length - 1);
    items.forEach((it, i) => {
      const target = first + step * i;
      if (axis === 'x') this.moveEntityBy(it.id, target - it.b.cx, 0); else this.moveEntityBy(it.id, 0, target - it.b.cy);
    });
    this.edited();
  }
}

function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
