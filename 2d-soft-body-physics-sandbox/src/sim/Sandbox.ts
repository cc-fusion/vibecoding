import Matter from 'matter-js';
import decomp from 'poly-decomp';
import { SoftBody } from './SoftBody';
import type {
  BodyMode,
  Draft,
  GrabState,
  RigidDef,
  RigidObject,
  SimObject,
  SoftObject,
  SoftParams,
  Stats,
  ThrowIndicator,
  ToolState,
  Vec,
  WorldParams,
} from './types';
import {
  blobOutline,
  centroid,
  circleOutline,
  clamp,
  ellipseOutline,
  rectOutline,
  regularPolygon,
  rotateVec,
  starOutline,
} from './geometry';

const { Engine, Bodies, Body, Composite, Constraint, Common, Query } = Matter;

// enable concave polygon decomposition for Bodies.fromVertices
Common.setDecomp(decomp);

export const DEFAULT_SOFT: SoftParams = {
  stiffness: 0.5,
  damping: 0.3,
  pressure: 0.55,
  elasticity: 0.5,
  mass: 1,
  friction: 0.5,
  restitution: 0.1,
  resolution: 24,
};

const RIGID_COLORS = ['#7cb3ff', '#a78bfa', '#f472b6', '#60a5fa', '#c084fc'];
const SOFT_COLORS = ['#2dd4bf', '#34d399', '#22d3ee', '#4ade80', '#5eead4'];

const FIXED_DT = 1000 / 60;
const WALL = 240;

type Listener = () => void;

export class Sandbox {
  engine: Matter.Engine;
  world: Matter.World;
  objects = new Map<number, SimObject>();
  walls: Matter.Body[] = [];
  width = 800;
  height = 600;
  selectedId: number | null = null;
  hoverId: number | null = null;
  params: WorldParams = {
    gravityX: 0,
    gravityY: 1,
    speed: 1,
    paused: false,
    grid: true,
    debug: { nodes: false, springs: false, shapes: false, velocities: false },
  };
  tools: ToolState = { tool: 'select', softPreset: 'blob', bodyMode: 'dynamic', polyTarget: 'soft' };
  draft: Draft | null = null;
  grab: GrabState | null = null;
  throwIndicators: ThrowIndicator[] = [];
  pointer: Vec | null = null;
  stats: Stats = { fps: 60, bodies: 0, particles: 0, constraints: 0, simTime: 0, stepMs: 0 };
  version = 0;
  private nextId = 1;
  private listeners = new Set<Listener>();
  private accumulator = 0;
  private stepOnce = false;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private uiAcc = 0;

  constructor() {
    this.engine = Engine.create({
      positionIterations: 8,
      velocityIterations: 6,
      constraintIterations: 4,
      enableSleeping: false,
    });
    this.world = this.engine.world;
    this.applyGravity();
  }

  /* ------------------------------------------------------------------ */
  /* pub/sub for UI                                                      */
  /* ------------------------------------------------------------------ */

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  /* ------------------------------------------------------------------ */
  /* world / bounds                                                      */
  /* ------------------------------------------------------------------ */

  resize(w: number, h: number) {
    const prevH = this.height;
    this.width = w;
    this.height = h;
    if (this.walls.length) Composite.remove(this.world, this.walls);
    const opts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.7,
      restitution: 0.05,
      label: 'wall',
      plugin: { wall: true },
    };
    this.walls = [
      Bodies.rectangle(w / 2, h + WALL / 2, w + WALL * 2, WALL, opts), // floor
      Bodies.rectangle(-WALL / 2, h / 2 - 400, WALL, h + 2000, opts), // left
      Bodies.rectangle(w + WALL / 2, h / 2 - 400, WALL, h + 2000, opts), // right
      Bodies.rectangle(w / 2, -800 - WALL / 2, w + WALL * 2, WALL, opts), // ceiling (far above)
    ];
    Composite.add(this.world, this.walls);
    // lift anything that ended up under the new floor
    if (h < prevH) {
      for (const o of this.objects.values()) {
        const pos = o.kind === 'rigid' ? o.body.position : o.soft.center;
        if (pos.y > h - 10) {
          const d = { x: 0, y: h - 60 - pos.y };
          if (o.kind === 'rigid') Body.translate(o.body, d);
          else o.soft.translate(d);
        }
      }
    }
    this.emit();
  }

  setWorldParams(p: Partial<WorldParams>) {
    this.params = { ...this.params, ...p, debug: { ...this.params.debug, ...(p.debug ?? {}) } };
    this.applyGravity();
    this.emit();
  }

  private applyGravity() {
    this.engine.gravity.x = this.params.gravityX;
    this.engine.gravity.y = this.params.gravityY;
    this.engine.gravity.scale = 0.001;
  }

  setTools(p: Partial<ToolState>) {
    this.tools = { ...this.tools, ...p };
    if (p.tool && p.tool !== 'polygon') this.draft = null;
    this.emit();
  }

  togglePause() {
    this.params.paused = !this.params.paused;
    this.emit();
  }

  requestStep() {
    this.stepOnce = true;
  }

  /* ------------------------------------------------------------------ */
  /* object creation                                                     */
  /* ------------------------------------------------------------------ */

  private pickColor(list: string[]) {
    return list[(this.nextId * 7) % list.length];
  }

  createRigid(def: RigidDef, pos: Vec, mode: BodyMode = 'dynamic', angle = 0, extra: Partial<Matter.IChamferableBodyDefinition> = {}): RigidObject | null {
    const id = this.nextId++;
    const opts: Matter.IChamferableBodyDefinition = {
      friction: 0.4,
      frictionStatic: 0.6,
      restitution: 0.25,
      density: 0.0015,
      isStatic: mode === 'static',
      slop: 0.03,
      plugin: { simId: id },
      ...extra,
    };
    let body: Matter.Body | undefined;
    if (def.shape === 'rect') body = Bodies.rectangle(pos.x, pos.y, def.w, def.h, opts);
    else if (def.shape === 'circle') body = Bodies.circle(pos.x, pos.y, def.r, opts, 24);
    else {
      if (def.verts.length < 3) return null;
      body = Bodies.fromVertices(pos.x, pos.y, [def.verts.map((v) => ({ ...v }))], opts, true);
    }
    if (!body || !body.vertices?.length) return null;
    if (def.shape === 'polygon') {
      // fromVertices centers on the decomposed centroid; keep it at the requested position
      Body.setPosition(body, pos);
    }
    if (angle) Body.setAngle(body, angle);
    body.plugin = { ...(body.plugin ?? {}), simId: id };
    for (const part of body.parts) part.plugin = { ...(part.plugin ?? {}), simId: id };
    Composite.add(this.world, body);
    const obj: RigidObject = { kind: 'rigid', id, body, def, color: this.pickColor(RIGID_COLORS) };
    this.objects.set(id, obj);
    this.emit();
    return obj;
  }

  createSoft(outlineWorld: Vec[], params: Partial<SoftParams> = {}): SoftObject | null {
    if (outlineWorld.length < 3) return null;
    const id = this.nextId++;
    const p: SoftParams = { ...DEFAULT_SOFT, ...params };
    if (params.resolution === undefined) {
      // derive a sensible node count from perimeter
      let per = 0;
      for (let i = 0; i < outlineWorld.length; i++) {
        const a = outlineWorld[i];
        const b = outlineWorld[(i + 1) % outlineWorld.length];
        per += Math.hypot(a.x - b.x, a.y - b.y);
      }
      p.resolution = clamp(Math.round(per / 20), 12, 56);
    }
    const soft = new SoftBody(this.world, id, outlineWorld, p);
    const obj: SoftObject = { kind: 'soft', id, soft, color: this.pickColor(SOFT_COLORS) };
    this.objects.set(id, obj);
    this.emit();
    return obj;
  }

  /** Create a soft body from the current preset, fitted into a box. */
  createSoftPreset(preset: ToolState['softPreset'], center: Vec, w: number, h: number, params: Partial<SoftParams> = {}, seed?: number) {
    let local: Vec[];
    const rx = Math.max(w, 24) / 2;
    const ry = Math.max(h, 24) / 2;
    const extra: Partial<SoftParams> = {};
    switch (preset) {
      case 'circle':
        local = ellipseOutline(rx, ry, 36);
        break;
      case 'rect':
        local = rectOutline(rx * 2, ry * 2);
        extra.elasticity = 0.8;
        extra.pressure = 0.4;
        break;
      case 'star':
        local = starOutline(Math.max(rx, ry), Math.max(rx, ry) * 0.5, 5);
        extra.elasticity = 0.85;
        extra.stiffness = 0.6;
        break;
      default:
        local = blobOutline(rx, ry, seed);
        break;
    }
    return this.createSoft(
      local.map((v) => ({ x: v.x + center.x, y: v.y + center.y })),
      { ...extra, ...params },
    );
  }

  remove(id: number) {
    const o = this.objects.get(id);
    if (!o) return;
    if (this.grab?.objectId === id) this.endGrab(null);
    if (o.kind === 'rigid') Composite.remove(this.world, o.body);
    else o.soft.destroy();
    this.objects.delete(id);
    if (this.selectedId === id) this.selectedId = null;
    if (this.hoverId === id) this.hoverId = null;
    this.emit();
  }

  duplicate(id: number): SimObject | null {
    const o = this.objects.get(id);
    if (!o) return null;
    const off = { x: 40, y: -40 };
    let created: SimObject | null = null;
    if (o.kind === 'rigid') {
      const b = o.body;
      created = this.createRigid(
        o.def,
        { x: b.position.x + off.x, y: b.position.y + off.y },
        b.isStatic ? 'static' : 'dynamic',
        b.angle,
        { friction: b.friction, restitution: b.restitution, density: b.density },
      );
      if (created && created.kind === 'rigid' && !b.isStatic) Body.setMass(created.body, b.mass);
    } else {
      const s = o.soft;
      const outline = s.baseOutline.map((v) => {
        const r = rotateVec(v, s.angle);
        return { x: r.x + s.center.x + off.x, y: r.y + s.center.y + off.y };
      });
      created = this.createSoft(outline, { ...s.params });
    }
    if (created) this.select(created.id);
    return created;
  }

  clear() {
    this.endGrab(null);
    for (const id of [...this.objects.keys()]) this.remove(id);
    this.draft = null;
    this.selectedId = null;
    this.emit();
  }

  /* ------------------------------------------------------------------ */
  /* selection & property editing                                        */
  /* ------------------------------------------------------------------ */

  select(id: number | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.emit();
  }

  get selected(): SimObject | null {
    return this.selectedId !== null ? (this.objects.get(this.selectedId) ?? null) : null;
  }

  setRigidProps(
    id: number,
    p: Partial<{ mode: BodyMode; mass: number; friction: number; restitution: number; x: number; y: number; angle: number; angularVelocity: number }>,
  ) {
    const o = this.objects.get(id);
    if (!o || o.kind !== 'rigid') return;
    const b = o.body;
    if (p.mode !== undefined) {
      const wantStatic = p.mode === 'static';
      if (wantStatic !== b.isStatic) {
        Body.setStatic(b, wantStatic);
        if (!wantStatic) {
          Body.setVelocity(b, { x: 0, y: 0 });
          Body.setAngularVelocity(b, 0);
        }
      }
    }
    if (p.mass !== undefined && !b.isStatic) Body.setMass(b, Math.max(0.05, p.mass));
    if (p.friction !== undefined) {
      b.friction = p.friction;
      b.frictionStatic = p.friction * 1.2;
    }
    if (p.restitution !== undefined) b.restitution = p.restitution;
    if (p.x !== undefined || p.y !== undefined) {
      Body.setPosition(b, { x: p.x ?? b.position.x, y: p.y ?? b.position.y });
      Body.setVelocity(b, { x: 0, y: 0 });
    }
    if (p.angle !== undefined) {
      Body.setAngle(b, p.angle);
      Body.setAngularVelocity(b, 0);
    }
    if (p.angularVelocity !== undefined) Body.setAngularVelocity(b, p.angularVelocity);
    this.emit();
  }

  rotateSelected(delta: number) {
    const o = this.selected;
    if (!o || o.kind !== 'rigid') return;
    this.setRigidProps(o.id, { angle: o.body.angle + delta });
  }

  setSoftParams(id: number, p: Partial<SoftParams>) {
    const o = this.objects.get(id);
    if (!o || o.kind !== 'soft') return;
    const wasGrabbed = this.grab?.objectId === id && p.resolution !== undefined;
    if (wasGrabbed) this.endGrab(null);
    o.soft.setParams(p);
    this.emit();
  }

  freezeSelected() {
    const o = this.selected;
    if (!o) return;
    if (o.kind === 'rigid') {
      Body.setVelocity(o.body, { x: 0, y: 0 });
      Body.setAngularVelocity(o.body, 0);
    } else o.soft.setVelocity({ x: 0, y: 0 });
  }

  /* ------------------------------------------------------------------ */
  /* hit testing                                                         */
  /* ------------------------------------------------------------------ */

  objectAt(p: Vec): SimObject | null {
    const bodies = Query.point(Composite.allBodies(this.world), p);
    // prefer the top-most (last added) non-wall body
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      const plugin = (b.parent ?? b).plugin ?? b.plugin ?? {};
      if (plugin.wall) continue;
      const id = plugin.simId ?? plugin.softId ?? b.plugin?.softId;
      if (id !== undefined && this.objects.has(id)) return this.objects.get(id)!;
    }
    // soft body interiors are hollow – test the polygon
    let best: SimObject | null = null;
    for (const o of this.objects.values()) {
      if (o.kind === 'soft' && o.soft.containsPoint(p)) best = o;
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* grabbing / dragging                                                 */
  /* ------------------------------------------------------------------ */

  beginGrab(o: SimObject, p: Vec) {
    this.endGrab(null);
    const grab: GrabState = { objectId: o.id, pointer: { ...p }, constraints: [], staticOffset: null };
    if (o.kind === 'rigid') {
      const b = o.body;
      if (b.isStatic) {
        grab.staticOffset = { x: p.x - b.position.x, y: p.y - b.position.y };
      } else {
        const c = Constraint.create({
          pointA: { ...p },
          bodyB: b,
          pointB: { x: p.x - b.position.x, y: p.y - b.position.y },
          stiffness: 0.12,
          damping: 0.08,
          length: 0,
          label: 'grab',
        });
        grab.constraints.push({ c, offset: { x: 0, y: 0 }, baseAngle: b.angle });
      }
    } else {
      const s = o.soft;
      const radius = Math.max(s.spacing * 1.6, 26);
      const near = s.particles
        .map((pt) => ({ pt, d: Math.hypot(pt.position.x - p.x, pt.position.y - p.y) }))
        .sort((a, b) => a.d - b.d);
      const chosen = near.filter((n) => n.d <= radius).slice(0, 5);
      if (!chosen.length) chosen.push(near[0]);
      for (const { pt } of chosen) {
        const offset = { x: pt.position.x - p.x, y: pt.position.y - p.y };
        const c = Constraint.create({
          pointA: { x: p.x + offset.x, y: p.y + offset.y },
          bodyB: pt,
          pointB: { x: 0, y: 0 },
          stiffness: 0.08,
          damping: 0.04,
          length: 0,
          label: 'grab',
        });
        grab.constraints.push({ c, offset, baseAngle: 0 });
      }
    }
    if (grab.constraints.length) Composite.add(this.world, grab.constraints.map((g) => g.c));
    this.grab = grab;
  }

  updateGrab(p: Vec) {
    const g = this.grab;
    if (!g) return;
    g.pointer = { ...p };
    const o = this.objects.get(g.objectId);
    if (!o) return;
    if (g.staticOffset && o.kind === 'rigid') {
      Body.setPosition(o.body, { x: p.x - g.staticOffset.x, y: p.y - g.staticOffset.y });
      return;
    }
    for (const { c, offset } of g.constraints) {
      c.pointA = { x: p.x + offset.x, y: p.y + offset.y };
    }
  }

  /** Release; if velocity (px/ms) is provided the object is thrown with it. */
  endGrab(throwVel: Vec | null) {
    const g = this.grab;
    if (!g) return;
    if (g.constraints.length) Composite.remove(this.world, g.constraints.map((c) => c.c));
    this.grab = null;
    const o = this.objects.get(g.objectId);
    if (!o || !throwVel) return;
    const speed = Math.hypot(throwVel.x, throwVel.y);
    if (speed < 0.25) return;
    // px/ms -> px per 60Hz tick (Matter velocity units), capped to avoid tunnelling
    const scale = FIXED_DT;
    const cap = 32;
    let vx = throwVel.x * scale;
    let vy = throwVel.y * scale;
    const m = Math.hypot(vx, vy);
    if (m > cap) {
      vx *= cap / m;
      vy *= cap / m;
    }
    const v = { x: vx, y: vy };
    if (o.kind === 'rigid') {
      if (o.body.isStatic) return;
      Body.setVelocity(o.body, v);
    } else {
      o.soft.setVelocity(v);
    }
    const pos = o.kind === 'rigid' ? { ...o.body.position } : { ...o.soft.center };
    this.throwIndicators.push({ pos, vel: v, t: 0, objectId: o.id });
  }

  /* ------------------------------------------------------------------ */
  /* stepping                                                            */
  /* ------------------------------------------------------------------ */

  /** Advance the simulation by real elapsed ms (handles fixed timestep). */
  advance(elapsedMs: number) {
    const dt = Math.min(elapsedMs, 100);
    this.fpsAcc += dt;
    this.fpsFrames++;
    this.uiAcc += dt;
    if (this.fpsAcc >= 500) {
      this.stats.fps = Math.round((this.fpsFrames * 1000) / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      this.refreshStats();
    } else if (this.uiAcc >= 125) {
      // keep live readouts (velocity, position…) fresh without spamming React
      this.uiAcc = 0;
      this.emit();
    }

    for (const ti of this.throwIndicators) ti.t += dt;
    this.throwIndicators = this.throwIndicators.filter((t) => t.t < 900);

    if (this.params.paused) {
      if (this.stepOnce) {
        this.stepOnce = false;
        this.step(FIXED_DT);
      }
      return;
    }
    const speed = clamp(this.params.speed, 0.05, 4);
    const stepSize = FIXED_DT * Math.min(1, speed);
    this.accumulator += dt * speed;
    let n = 0;
    const t0 = performance.now();
    while (this.accumulator >= stepSize && n < 8) {
      this.step(stepSize);
      this.accumulator -= stepSize;
      n++;
    }
    if (n) this.stats.stepMs = (performance.now() - t0) / n;
    if (this.accumulator > stepSize * 8) this.accumulator = 0;
  }

  private step(dt: number) {
    for (const o of this.objects.values()) if (o.kind === 'soft') o.soft.applyForces();
    Engine.update(this.engine, dt);
    this.stats.simTime += dt;
    // keep escaped bodies in bounds (safety net against tunnelling)
    for (const o of this.objects.values()) {
      if (o.kind === 'rigid') {
        const b = o.body;
        if (b.position.y > this.height + 200 || b.position.x < -300 || b.position.x > this.width + 300) {
          Body.setPosition(b, { x: clamp(b.position.x, 40, this.width - 40), y: 60 });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      } else if (o.soft.center.y > this.height + 200) {
        o.soft.translate({ x: 0, y: 80 - o.soft.center.y });
        o.soft.setVelocity({ x: 0, y: 0 });
      }
    }
  }

  refreshStats() {
    let bodies = 0;
    let particles = 0;
    let constraints = 0;
    for (const o of this.objects.values()) {
      bodies++;
      if (o.kind === 'soft') {
        particles += o.soft.particles.length;
        constraints += o.soft.constraints.length;
      }
    }
    this.stats.bodies = bodies;
    this.stats.particles = particles;
    this.stats.constraints = constraints;
    this.emit();
  }

  /* ------------------------------------------------------------------ */
  /* scenes                                                              */
  /* ------------------------------------------------------------------ */

  spawnRandom() {
    const w = this.width;
    const x = 80 + Math.random() * Math.max(100, w - 160);
    const y = 40 + Math.random() * 80;
    const r = Math.random();
    let created: SimObject | null = null;
    if (r < 0.35) {
      const presets: ToolState['softPreset'][] = ['blob', 'circle', 'rect', 'star'];
      const size = 60 + Math.random() * 70;
      created = this.createSoftPreset(presets[Math.floor(Math.random() * presets.length)], { x, y }, size, size * (0.8 + Math.random() * 0.4));
    } else if (r < 0.6) {
      created = this.createRigid({ shape: 'rect', w: 30 + Math.random() * 70, h: 30 + Math.random() * 70 }, { x, y }, 'dynamic', Math.random() * Math.PI);
    } else if (r < 0.8) {
      created = this.createRigid({ shape: 'circle', r: 15 + Math.random() * 30 }, { x, y });
    } else {
      const sides = 3 + Math.floor(Math.random() * 5);
      created = this.createRigid({ shape: 'polygon', verts: regularPolygon(20 + Math.random() * 30, sides) }, { x, y }, 'dynamic', Math.random() * Math.PI);
    }
    if (created && created.kind === 'rigid') {
      Body.setAngularVelocity(created.body, (Math.random() - 0.5) * 0.2);
    }
    this.refreshStats();
  }

  loadInitialScene() {
    this.clear();
    const w = this.width;
    const h = this.height;
    const floorY = h;

    // static ramp on the left
    this.createRigid({ shape: 'rect', w: Math.min(360, w * 0.36), h: 22 }, { x: w * 0.2, y: floorY - 150 }, 'static', 0.28);
    // static platform on the right
    this.createRigid({ shape: 'rect', w: Math.min(300, w * 0.3), h: 22 }, { x: w * 0.78, y: floorY - 250 }, 'static', 0);
    // small static block
    this.createRigid({ shape: 'rect', w: 60, h: 60 }, { x: w * 0.55, y: floorY - 30 }, 'static', 0);

    // stack of boxes
    for (let i = 0; i < 4; i++) {
      this.createRigid({ shape: 'rect', w: 56 - i * 6, h: 40 }, { x: w * 0.62, y: floorY - 20 - i * 40 });
    }
    // circles & polygon
    this.createRigid({ shape: 'circle', r: 26 }, { x: w * 0.72, y: floorY - 300 });
    this.createRigid({ shape: 'circle', r: 18 }, { x: w * 0.84, y: floorY - 320 });
    this.createRigid({ shape: 'polygon', verts: regularPolygon(34, 6) }, { x: w * 0.42, y: floorY - 60 }, 'dynamic', 0.2);
    this.createRigid({ shape: 'polygon', verts: regularPolygon(30, 3, -Math.PI / 2) }, { x: w * 0.1, y: floorY - 330 }, 'dynamic');

    // large soft blob dropping onto the ramp
    this.createSoftPreset('blob', { x: w * 0.24, y: 120 }, 190, 170, { pressure: 0.6, elasticity: 0.35, stiffness: 0.45 });
    // soft rectangle onto the platform
    this.createSoftPreset('rect', { x: w * 0.78, y: 80 }, 150, 90, { elasticity: 0.8, pressure: 0.4, stiffness: 0.55 });
    // soft star
    this.createSoftPreset('star', { x: w * 0.5, y: 90 }, 110, 110, { elasticity: 0.85, stiffness: 0.6 });

    this.selectedId = null;
    this.refreshStats();
  }

  /* helpers exposed for creation tools */
  static circleOutlineAt(c: Vec, r: number) {
    return circleOutline(r).map((v) => ({ x: v.x + c.x, y: v.y + c.y }));
  }
  static centroid = centroid;
}
