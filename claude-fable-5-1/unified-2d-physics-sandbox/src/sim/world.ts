// Central simulation world: owns Matter engine, FLIP fluid, soft bodies, constraints, world boundaries and the
// authored definitions (defs). Defs are the authored/serialisable state; runtime motion never writes into them
// except through explicit editor operations or commitRuntime().
import Matter from 'matter-js';
import {
  SCENE_VERSION, type SceneData, type WorldSettings, type FluidSettings, type UiPrefs, type RigidBodyDef, type SoftBodyDef,
  type ConstraintDef, type FluidRegionDef, type FluidState, type Vec2, newId,
} from './schema';
import { FlipFluid } from './flip';
import { SoftBody, type SoftPin } from './soft';
import { createBodyFromDef, applyDefProperties, setVelocity, setAngularVelocity, getVelocity, getAngularVelocity, ImpulseAccumulator } from './rigid';
import { rasterizeSolids, collideParticlesWithRigid, collideParticlesWithSoft, applyPressureForces, applyRigidFluidDrag, computeSoftFluidForces } from './coupling';
import { rotate } from './geometry';

const { Engine, Bodies, Body, Constraint, Composite } = Matter;

export interface RigidEntity { def: RigidBodyDef; body: Matter.Body }
export interface ConstraintEntity { def: ConstraintDef; mc: Matter.Constraint | null }

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const RIGID_GEOM_KEYS = new Set(['shape', 'w', 'h', 'radius', 'vertices']);
const SOFT_GEOM_KEYS = new Set(['shape', 'radius', 'w', 'h', 'points', 'innerRatio', 'vertices', 'resolution', 'angle']);

export class World {
  settings!: WorldSettings;
  fluidSettings!: FluidSettings;
  ui!: UiPrefs;
  engine: Matter.Engine;
  fluid!: FlipFluid;
  rigid = new Map<string, RigidEntity>();
  soft = new Map<string, SoftBody>();
  constraints = new Map<string, ConstraintEntity>();
  regions = new Map<string, FluidRegionDef>();
  authoredFluidState: FluidState | null = null;
  impulses = new ImpulseAccumulator();
  gravityOverride: Vec2 | null = null;
  time = 0; steps = 0; version = 0;
  onChange: (() => void) | null = null;
  stats = { fluidMs: 0, softMs: 0, rigidMs: 0 };
  private walls: Matter.Body[] = [];
  private bodyList: Matter.Body[] = [];
  private softList: SoftBody[] = [];
  private listsDirty = true;
  private emitAcc = new Map<string, number>();
  private tmp = new Float32Array(2);

  constructor(scene: SceneData) {
    this.engine = Engine.create({ enableSleeping: false, positionIterations: 8, velocityIterations: 6, constraintIterations: 3 });
    this.engine.gravity.scale = 0.001;
    this.loadScene(scene);
  }

  // ---------- lifecycle ----------
  loadScene(scene: SceneData) {
    Composite.clear(this.engine.world, false, true);
    this.rigid.clear(); this.soft.clear(); this.constraints.clear(); this.regions.clear(); this.emitAcc.clear();
    this.settings = clone(scene.world); this.fluidSettings = clone(scene.fluid); this.ui = clone(scene.ui);
    this.buildWalls();
    this.buildFluid(null);
    for (const d of scene.bodies) this.addRigid(clone(d), true);
    for (const d of scene.softBodies) this.addSoft(clone(d), true);
    for (const d of scene.fluidRegions) this.regions.set(d.id, clone(d));
    for (const d of scene.constraints) this.addConstraint(clone(d), true);
    this.authoredFluidState = scene.fluidState ? clone(scene.fluidState) : null;
    this.restoreFluidParticles();
    this.time = 0; this.steps = 0;
    this.markChanged();
  }

  snapshot(): SceneData {
    return {
      version: SCENE_VERSION, world: clone(this.settings), fluid: clone(this.fluidSettings),
      fluidRegions: [...this.regions.values()].map(clone), fluidState: this.authoredFluidState ? clone(this.authoredFluidState) : null,
      bodies: [...this.rigid.values()].map(e => clone(e.def)), softBodies: [...this.soft.values()].map(s => clone(s.def)),
      constraints: [...this.constraints.values()].map(e => clone(e.def)), ui: clone(this.ui),
    };
  }

  reset() { this.loadScene(this.snapshot()); }

  clear() {
    const s = this.snapshot();
    s.bodies = []; s.softBodies = []; s.constraints = []; s.fluidRegions = []; s.fluidState = null;
    this.loadScene(s);
  }

  /** Capture the current runtime state (positions, velocities, fluid particles) as the new authored state. */
  commitRuntime() {
    for (const e of this.rigid.values()) {
      const v = getVelocity(e.body);
      Object.assign(e.def, { x: e.body.position.x, y: e.body.position.y, angle: e.body.angle, vx: v.x, vy: v.y, angularVelocity: getAngularVelocity(e.body) });
    }
    for (const sb of this.soft.values()) {
      sb.centroid(this.tmp); sb.def.x = this.tmp[0]; sb.def.y = this.tmp[1];
      sb.averageVelocity(this.tmp); sb.def.vx = this.tmp[0]; sb.def.vy = this.tmp[1];
    }
    this.authoredFluidState = this.captureFluidState();
    this.markChanged();
  }

  captureFluidState(): FluidState {
    const n = this.fluid.numParticles;
    const positions = new Array<number>(2 * n), velocities = new Array<number>(2 * n);
    for (let i = 0; i < 2 * n; i++) { positions[i] = Math.round(this.fluid.pos[i] * 10) / 10; velocities[i] = Math.round(this.fluid.vel[i] * 10) / 10; }
    return { positions, velocities };
  }

  markChanged() { this.version++; this.listsDirty = true; this.onChange?.(); }

  private refreshLists() {
    if (!this.listsDirty) return;
    this.bodyList = [...this.rigid.values()].map(e => e.body);
    this.softList = [...this.soft.values()];
    this.listsDirty = false;
  }
  get bodies(): Matter.Body[] { this.refreshLists(); return this.bodyList; }
  get softs(): SoftBody[] { this.refreshLists(); return this.softList; }

  private buildWalls() {
    for (const w of this.walls) Composite.remove(this.engine.world, w);
    const { width: W, height: H } = this.settings, t = 400;
    const opts: Matter.IChamferableBodyDefinition = { isStatic: true, label: '__wall', friction: 0.4, restitution: 0.1 };
    this.walls = [
      Bodies.rectangle(W / 2, -t / 2, W + 2 * t, t, opts), Bodies.rectangle(W / 2, H + t / 2, W + 2 * t, t, opts),
      Bodies.rectangle(-t / 2, H / 2, t, H + 2 * t, opts), Bodies.rectangle(W + t / 2, H / 2, t, H + 2 * t, opts),
    ];
    Composite.add(this.engine.world, this.walls);
  }

  private buildFluid(previous: FlipFluid | null) {
    const fs = this.fluidSettings;
    const f = new FlipFluid(this.settings.width, this.settings.height, fs.cellSize, fs.particleRadiusFactor, fs.maxParticles, fs.density);
    f.hooks = {
      collide: (fl) => {
        const cs = this.fluidSettings.couplingScale;
        collideParticlesWithRigid(fl, this.bodies, this.impulses, cs);
        collideParticlesWithSoft(fl, this.softs, cs);
      },
      afterProjection: (fl, sdt) => applyPressureForces(fl, this.bodies, this.impulses, sdt, this.fluidSettings.couplingScale),
    };
    if (previous) {
      for (let i = 0; i < previous.numParticles; i++) {
        const x = Math.min(Math.max(previous.pos[2 * i], f.particleRadius), f.width - f.particleRadius);
        const y = Math.min(Math.max(previous.pos[2 * i + 1], f.particleRadius), f.height - f.particleRadius);
        if (!f.addParticle(x, y, previous.vel[2 * i], previous.vel[2 * i + 1])) break;
      }
    }
    this.fluid = f;
  }

  private restoreFluidParticles() {
    this.fluid.clearParticles();
    this.refreshLists();
    rasterizeSolids(this.fluid, this.bodies);
    const st = this.authoredFluidState;
    if (st && st.positions.length > 0) {
      for (let i = 0; i < st.positions.length / 2; i++) if (!this.fluid.addParticle(st.positions[2 * i], st.positions[2 * i + 1], st.velocities[2 * i], st.velocities[2 * i + 1])) break;
    } else {
      for (const r of this.regions.values()) if (r.type === 'fill') this.fluid.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  // ---------- settings ----------
  updateWorldSettings(patch: Partial<WorldSettings>) {
    const sizeChanged = (patch.width !== undefined && patch.width !== this.settings.width) || (patch.height !== undefined && patch.height !== this.settings.height);
    Object.assign(this.settings, patch);
    if (patch.gravity) this.settings.gravity = { ...patch.gravity };
    if (sizeChanged) { this.buildWalls(); this.buildFluid(this.fluid); }
    this.markChanged();
  }

  updateFluidSettings(patch: Partial<FluidSettings>) {
    const fs = this.fluidSettings;
    const rebuild = (patch.cellSize !== undefined && patch.cellSize !== fs.cellSize) || (patch.particleRadiusFactor !== undefined && patch.particleRadiusFactor !== fs.particleRadiusFactor) || (patch.maxParticles !== undefined && patch.maxParticles !== fs.maxParticles);
    Object.assign(fs, patch);
    if (rebuild) this.buildFluid(this.fluid);
    else if (patch.density !== undefined) this.fluid.setDensity(fs.density);
    this.markChanged();
  }

  updateUi(patch: Partial<UiPrefs>) { Object.assign(this.ui, patch); this.markChanged(); }

  get gravity(): Vec2 { return this.gravityOverride ?? this.settings.gravity; }

  // ---------- rigid ----------
  addRigid(def: RigidBodyDef, silent = false): RigidEntity | null {
    const body = createBodyFromDef(def);
    if (!body) return null;
    Composite.add(this.engine.world, body);
    const e = { def, body };
    this.rigid.set(def.id, e);
    if (!silent) this.markChanged(); else this.listsDirty = true;
    return e;
  }

  removeRigid(id: string) {
    const e = this.rigid.get(id);
    if (!e) return;
    for (const c of [...this.constraints.values()]) if (c.def.bodyA === id || c.def.bodyB === id) this.removeConstraint(c.def.id, true);
    Composite.remove(this.engine.world, e.body);
    this.rigid.delete(id);
    this.markChanged();
  }

  updateRigid(id: string, patch: Partial<RigidBodyDef>) {
    const e = this.rigid.get(id);
    if (!e) return;
    const geom = Object.keys(patch).some(k => RIGID_GEOM_KEYS.has(k));
    Object.assign(e.def, patch);
    if (geom) {
      const pos = { x: e.body.position.x, y: e.body.position.y }, ang = e.body.angle, v = getVelocity(e.body), w = getAngularVelocity(e.body);
      const nb = createBodyFromDef({ ...e.def, x: patch.x ?? pos.x, y: patch.y ?? pos.y, angle: patch.angle ?? ang, vx: patch.vx ?? v.x, vy: patch.vy ?? v.y, angularVelocity: patch.angularVelocity ?? w });
      if (!nb) return;
      Composite.remove(this.engine.world, e.body);
      Composite.add(this.engine.world, nb);
      for (const c of this.constraints.values()) {
        if (!c.mc) continue;
        if (c.def.bodyA === id) c.mc.bodyA = nb;
        if (c.def.bodyB === id) c.mc.bodyB = nb;
      }
      e.body = nb;
    } else {
      applyDefProperties(e.body, e.def);
      if (patch.x !== undefined || patch.y !== undefined) Body.setPosition(e.body, { x: patch.x ?? e.body.position.x, y: patch.y ?? e.body.position.y });
      if (patch.angle !== undefined) Body.setAngle(e.body, patch.angle);
      if (patch.vx !== undefined || patch.vy !== undefined) { const v = getVelocity(e.body); setVelocity(e.body, patch.vx ?? v.x, patch.vy ?? v.y); }
      if (patch.angularVelocity !== undefined) setAngularVelocity(e.body, patch.angularVelocity);
    }
    this.markChanged();
  }

  // ---------- soft ----------
  addSoft(def: SoftBodyDef, silent = false): SoftBody | null {
    let sb: SoftBody;
    try { sb = new SoftBody(def); } catch { return null; }
    if (sb.n < 3 || !sb.isFinite() || sb.restArea < 1) return null;
    this.soft.set(def.id, sb);
    this.refreshSoftPins(def.id, sb);
    if (!silent) this.markChanged(); else this.listsDirty = true;
    return sb;
  }

  removeSoft(id: string) {
    if (!this.soft.has(id)) return;
    for (const c of [...this.constraints.values()]) if (c.def.softA === id) this.removeConstraint(c.def.id, true);
    this.soft.delete(id);
    this.markChanged();
  }

  updateSoft(id: string, patch: Partial<SoftBodyDef>) {
    const sb = this.soft.get(id);
    if (!sb) return;
    const geom = Object.keys(patch).some(k => SOFT_GEOM_KEYS.has(k));
    const oldX = sb.def.x, oldY = sb.def.y;
    Object.assign(sb.def, patch);
    if (geom) {
      const nb = new SoftBody(sb.def);
      if (nb.n >= 3 && nb.isFinite()) { this.soft.set(id, nb); this.refreshSoftPins(id, nb); }
    } else {
      if (patch.x !== undefined || patch.y !== undefined) sb.translate(sb.def.x - oldX, sb.def.y - oldY);
      if (patch.vx !== undefined || patch.vy !== undefined) sb.setVelocityAll(sb.def.vx, sb.def.vy);
      sb.updateMass();
    }
    this.markChanged();
  }

  private refreshSoftPins(softId: string, sb: SoftBody) {
    const pins: SoftPin[] = [];
    for (const c of this.constraints.values()) {
      if (c.def.softA !== softId) continue;
      pins.push({ node: c.def.nodeA, x: c.def.pointA.x, y: c.def.pointA.y, stiffness: c.def.kind === 'pin' ? 1 : Math.min(1, c.def.stiffness) });
    }
    sb.setPins(pins);
  }

  // ---------- constraints ----------
  addConstraint(def: ConstraintDef, silent = false): ConstraintEntity | null {
    if (def.softA) {
      const sb = this.soft.get(def.softA);
      if (!sb || def.nodeA < 0 || def.nodeA >= sb.n) return null;
      const e = { def, mc: null };
      this.constraints.set(def.id, e);
      this.refreshSoftPins(def.softA, sb);
      if (!silent) this.markChanged();
      return e;
    }
    const a = def.bodyA ? this.rigid.get(def.bodyA)?.body : undefined;
    const b = def.bodyB ? this.rigid.get(def.bodyB)?.body : undefined;
    if ((def.bodyA && !a) || (def.bodyB && !b) || (!a && !b)) return null;
    const mc = Constraint.create({
      bodyA: a, bodyB: b, pointA: a ? rotate(def.pointA, a.angle) : { ...def.pointA }, pointB: b ? rotate(def.pointB, b.angle) : { ...def.pointB },
      length: def.kind === 'pin' ? 0 : def.length, stiffness: def.kind === 'pin' || def.kind === 'link' ? Math.max(def.stiffness, 0.9) : def.stiffness,
      damping: def.damping, label: def.id,
    });
    Composite.add(this.engine.world, mc);
    const e = { def, mc };
    this.constraints.set(def.id, e);
    if (!silent) this.markChanged();
    return e;
  }

  removeConstraint(id: string, silent = false) {
    const e = this.constraints.get(id);
    if (!e) return;
    if (e.mc) Composite.remove(this.engine.world, e.mc);
    this.constraints.delete(id);
    if (e.def.softA) { const sb = this.soft.get(e.def.softA); if (sb) this.refreshSoftPins(e.def.softA, sb); }
    if (!silent) this.markChanged();
  }

  updateConstraint(id: string, patch: Partial<ConstraintDef>) {
    const e = this.constraints.get(id);
    if (!e) return;
    const def = e.def;
    const endpointsChanged = ('bodyA' in patch && patch.bodyA !== def.bodyA) || ('bodyB' in patch && patch.bodyB !== def.bodyB) || ('softA' in patch) || ('kind' in patch && patch.kind !== def.kind);
    const next = { ...def, ...patch };
    if (next.bodyA && next.bodyA === next.bodyB) return;
    if (endpointsChanged) {
      this.removeConstraint(id, true);
      if (!this.addConstraint(next, true)) this.addConstraint(def, true); // restore on failure
    } else {
      Object.assign(def, patch);
      if (e.mc) {
        e.mc.length = def.kind === 'pin' ? 0 : def.length; e.mc.stiffness = def.kind === 'pin' || def.kind === 'link' ? Math.max(def.stiffness, 0.9) : def.stiffness; e.mc.damping = def.damping;
        // Matter rotates anchors by (body.angle − angleAtCreation), so express local anchors in the creation frame.
        e.mc.pointA = e.mc.bodyA ? rotate(def.pointA, (e.mc as any).angleA ?? 0) : { ...def.pointA };
        e.mc.pointB = e.mc.bodyB ? rotate(def.pointB, (e.mc as any).angleB ?? 0) : { ...def.pointB };
      } else if (def.softA) { const sb = this.soft.get(def.softA); if (sb) this.refreshSoftPins(def.softA, sb); }
    }
    this.markChanged();
  }

  // ---------- fluid regions ----------
  addRegion(def: FluidRegionDef) {
    this.regions.set(def.id, def);
    if (def.type === 'fill') {
      this.refreshLists();
      rasterizeSolids(this.fluid, this.bodies);
      const before = this.fluid.numParticles;
      this.fluid.fillRect(def.x, def.y, def.w, def.h);
      if (this.authoredFluidState) {
        for (let i = 2 * before; i < 2 * this.fluid.numParticles; i++) { this.authoredFluidState.positions.push(this.fluid.pos[i]); this.authoredFluidState.velocities.push(this.fluid.vel[i]); }
      }
    }
    this.markChanged();
  }
  removeRegion(id: string) { this.regions.delete(id); this.emitAcc.delete(id); this.markChanged(); }
  updateRegion(id: string, patch: Partial<FluidRegionDef>) { const r = this.regions.get(id); if (r) { Object.assign(r, patch); this.markChanged(); } }

  // ---------- duplication ----------
  duplicate(ids: string[], offset = 30): string[] {
    const idMap = new Map<string, string>();
    const out: string[] = [];
    for (const id of ids) {
      const r = this.rigid.get(id);
      if (r) {
        const v = getVelocity(r.body);
        const def = { ...clone(r.def), id: newId('rb'), x: r.body.position.x + offset, y: r.body.position.y + offset, angle: r.body.angle, vx: v.x, vy: v.y, angularVelocity: getAngularVelocity(r.body) };
        if (this.addRigid(def, true)) { idMap.set(id, def.id); out.push(def.id); }
        continue;
      }
      const s = this.soft.get(id);
      if (s) {
        s.centroid(this.tmp);
        const def = { ...clone(s.def), id: newId('sb'), x: this.tmp[0] + offset, y: this.tmp[1] + offset };
        if (this.addSoft(def, true)) { idMap.set(id, def.id); out.push(def.id); }
        continue;
      }
      const g = this.regions.get(id);
      if (g) { const def = { ...clone(g), id: newId('fr'), x: g.x + offset, y: g.y + offset }; this.addRegion(def); out.push(def.id); }
    }
    for (const id of ids) {
      const c = this.constraints.get(id);
      if (!c) continue;
      const d = c.def;
      const a = d.bodyA ? idMap.get(d.bodyA) : null, b = d.bodyB ? idMap.get(d.bodyB) : null, sa = d.softA ? idMap.get(d.softA) : null;
      if ((d.bodyA && !a) || (d.bodyB && !b) || (d.softA && !sa)) continue;
      const def: ConstraintDef = { ...clone(d), id: newId('cs'), bodyA: a ?? null, bodyB: b ?? null, softA: sa ?? null };
      if (!def.bodyA && !def.softA) def.pointA = { x: def.pointA.x + offset, y: def.pointA.y + offset };
      if (!def.bodyB && def.bodyA) def.pointB = { x: def.pointB.x + offset, y: def.pointB.y + offset };
      if (this.addConstraint(def, true)) out.push(def.id);
    }
    this.markChanged();
    return out;
  }

  remove(ids: string[]) {
    for (const id of ids) {
      if (this.rigid.has(id)) this.removeRigid(id);
      else if (this.soft.has(id)) this.removeSoft(id);
      else if (this.constraints.has(id)) this.removeConstraint(id);
      else if (this.regions.has(id)) this.removeRegion(id);
    }
  }

  // ---------- stepping ----------
  step(dt: number) {
    const g = this.gravity;
    const fs = this.fluidSettings, ws = this.settings;
    this.engine.gravity.x = g.x / 1000; this.engine.gravity.y = g.y / 1000;
    this.refreshLists();
    const bodies = this.bodyList, softs = this.softList, fluid = this.fluid;

    // emitters
    for (const r of this.regions.values()) {
      if (r.type !== 'emitter' || r.rate <= 0) continue;
      let acc = (this.emitAcc.get(r.id) ?? 0) + r.rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const x = r.x + Math.random() * r.w, y = r.y + Math.random() * r.h;
        if (fluid.s[fluid.cellIndex(x, y)] !== 0) fluid.addParticle(x, y, r.vx, r.vy);
      }
      this.emitAcc.set(r.id, acc);
    }

    let t0 = performance.now();
    rasterizeSolids(fluid, bodies);
    fluid.simulate(dt, g.x * fs.gravityScale, g.y * fs.gravityScale, fs, ws.fluidSubsteps);
    applyRigidFluidDrag(fluid, bodies, this.impulses, dt, fs.couplingScale);
    let t1 = performance.now();
    this.stats.fluidMs = t1 - t0; t0 = t1;

    // soft bodies
    const sub = ws.softSubsteps, sdt = dt / sub;
    for (const sb of softs) {
      computeSoftFluidForces(fluid, sb, g.x, g.y, fs.density, fs.couplingScale);
      const dv = sb.extDv;
      for (let i = 0; i < sb.n; i++) {
        const m = Math.hypot(dv[2 * i], dv[2 * i + 1]);
        if (m > 600) { dv[2 * i] *= 600 / m; dv[2 * i + 1] *= 600 / m; }
      }
    }
    for (let k = 0; k < sub; k++) {
      for (const sb of softs) sb.integrate(sdt, g.x, g.y);
      for (const sb of softs) sb.solveConstraints(sdt);
      for (const sb of softs) sb.collide(ws.width, ws.height, bodies);
      for (let i = 0; i < softs.length; i++) for (let j = i + 1; j < softs.length; j++) { softs[i].collideSoft(softs[j]); softs[j].collideSoft(softs[i]); }
      for (const sb of softs) sb.updateVelocities(sdt, this.impulses);
    }
    for (const sb of softs) if (!sb.isFinite()) this.recoverSoft(sb);
    t1 = performance.now();
    this.stats.softMs = t1 - t0; t0 = t1;

    // rigid bodies
    const rsub = ws.rigidSubsteps, rdt = dt / rsub;
    this.impulses.flush(rdt, 800, 40);
    for (let k = 0; k < rsub; k++) Engine.update(this.engine, rdt * 1000);
    for (const e of this.rigid.values()) this.sanitizeBody(e);
    this.stats.rigidMs = performance.now() - t0;
    this.time += dt; this.steps++;
  }

  private sanitizeBody(e: RigidEntity) {
    const b = e.body, p = b.position, W = this.settings.width, H = this.settings.height;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(b.angle) || p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) {
      Body.setPosition(b, { x: Math.min(Math.max(e.def.x, 10), W - 10), y: Math.min(Math.max(e.def.y, 10), H - 10) });
      Body.setAngle(b, Number.isFinite(b.angle) ? b.angle : 0);
      setVelocity(b, 0, 0); setAngularVelocity(b, 0);
    }
  }

  private recoverSoft(sb: SoftBody) {
    const nb = new SoftBody(sb.def);
    this.soft.set(sb.def.id, nb);
    this.refreshSoftPins(sb.def.id, nb);
    this.markChanged();
  }
}
