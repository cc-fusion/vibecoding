// Validation of externally supplied scene data (imports, localStorage). Produces a fully-populated SceneData
// or a list of errors; never throws on malformed input.
import {
  SCENE_VERSION, emptyScene, makeRigidDef, makeSoftDef, makeConstraintDef, makeRegionDef, defaultUi,
  type SceneData, type Vec2, type RigidBodyDef, type SoftBodyDef, type ConstraintDef, type FluidRegionDef,
} from './schema';
import { isFiniteNum, sanitizePolygon, clamp } from './geometry';

export interface ValidationResult { ok: boolean; scene: SceneData | null; errors: string[]; warnings: string[] }

const num = (v: unknown, fallback: number, lo = -1e9, hi = 1e9): number => (isFiniteNum(v) ? clamp(v, lo, hi) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.length < 128 ? v : fallback);
const vec = (v: any, fb: Vec2): Vec2 => (v && isFiniteNum(v.x) && isFiniteNum(v.y) ? { x: clamp(v.x, -1e6, 1e6), y: clamp(v.y, -1e6, 1e6) } : { ...fb });
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fb: T): T => (opts.includes(v as T) ? (v as T) : fb);

export function validateScene(input: unknown): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, scene: null, errors: ['scene must be an object'], warnings };
  const raw = input as any;
  if (raw.version !== SCENE_VERSION) return { ok: false, scene: null, errors: [`unsupported scene version: ${String(raw.version)}`], warnings };

  const scene = emptyScene();
  const w = raw.world ?? {};
  scene.world.width = num(w.width, scene.world.width, 400, 6000);
  scene.world.height = num(w.height, scene.world.height, 300, 6000);
  scene.world.gravity = vec(w.gravity, scene.world.gravity);
  scene.world.timeScale = num(w.timeScale, 1, 0.05, 3);
  scene.world.rigidSubsteps = Math.round(num(w.rigidSubsteps, 2, 1, 8));
  scene.world.softSubsteps = Math.round(num(w.softSubsteps, 4, 1, 12));
  scene.world.fluidSubsteps = Math.round(num(w.fluidSubsteps, 1, 1, 4));

  const f = raw.fluid ?? {};
  const df = scene.fluid;
  scene.fluid = {
    cellSize: num(f.cellSize, df.cellSize, 10, 200), flipRatio: num(f.flipRatio, 0.9, 0, 1),
    pressureIters: Math.round(num(f.pressureIters, df.pressureIters, 1, 200)), separationIters: Math.round(num(f.separationIters, 2, 0, 8)),
    separationStrength: num(f.separationStrength, 1, 0, 2), overRelaxation: num(f.overRelaxation, 1.9, 1, 1.99),
    density: num(f.density, 1, 0.05, 20), driftCompensation: bool(f.driftCompensation, true), driftStiffness: num(f.driftStiffness, 1, 0, 5),
    particleRadiusFactor: num(f.particleRadiusFactor, 0.3, 0.15, 0.5), maxParticles: Math.round(num(f.maxParticles, df.maxParticles, 100, 60000)),
    gravityScale: num(f.gravityScale, 1, -3, 3), couplingScale: num(f.couplingScale, 1, 0, 5),
  };

  const ids = new Set<string>();
  const uniqueId = (id: unknown, prefix: string): string => {
    let s = typeof id === 'string' && id.length > 0 && id.length < 64 ? id : `${prefix}_${ids.size}`;
    while (ids.has(s)) s = `${s}_dup`;
    ids.add(s);
    return s;
  };

  if (Array.isArray(raw.fluidRegions)) {
    for (const r of raw.fluidRegions.slice(0, 200)) {
      if (!r || typeof r !== 'object') continue;
      const d: FluidRegionDef = makeRegionDef({
        id: uniqueId(r.id, 'fr'), type: oneOf(r.type, ['fill', 'emitter'] as const, 'fill'),
        x: num(r.x, 0), y: num(r.y, 0), w: num(r.w, 100, 4, 6000), h: num(r.h, 100, 4, 6000),
        rate: num(r.rate, 200, 0, 5000), vx: num(r.vx, 0, -5000, 5000), vy: num(r.vy, 0, -5000, 5000),
      });
      scene.fluidRegions.push(d);
    }
  }

  if (raw.fluidState && Array.isArray(raw.fluidState.positions) && Array.isArray(raw.fluidState.velocities)) {
    const p = raw.fluidState.positions as unknown[], v = raw.fluidState.velocities as unknown[];
    const n = Math.min(p.length, v.length, scene.fluid.maxParticles * 2) & ~1;
    if (n > 0 && p.every(isFiniteNum) && v.every(isFiniteNum)) {
      scene.fluidState = { positions: (p as number[]).slice(0, n), velocities: (v as number[]).slice(0, n) };
    } else warnings.push('fluid state ignored (non-finite values)');
  }

  if (Array.isArray(raw.bodies)) {
    for (const b of raw.bodies.slice(0, 2000)) {
      if (!b || typeof b !== 'object') continue;
      const shape = oneOf(b.shape, ['rect', 'circle', 'polygon'] as const, 'rect');
      let vertices: Vec2[] = [];
      if (shape === 'polygon') {
        const res = sanitizePolygon(Array.isArray(b.vertices) ? b.vertices : [], 50);
        if (!res.ok) { warnings.push(`body ${String(b.id)} skipped: ${res.reason}`); continue; }
        vertices = res.pts;
      }
      const d: RigidBodyDef = makeRigidDef({
        id: uniqueId(b.id, 'rb'), shape, x: num(b.x, 0), y: num(b.y, 0), angle: num(b.angle, 0, -1000, 1000),
        w: num(b.w, 100, 2, 6000), h: num(b.h, 60, 2, 6000), radius: num(b.radius, 40, 2, 3000), vertices,
        isStatic: bool(b.isStatic, false), isSensor: bool(b.isSensor, false),
        density: num(b.density, 1, 0.01, 100), friction: num(b.friction, 0.3, 0, 5), frictionAir: num(b.frictionAir, 0.01, 0, 1),
        restitution: num(b.restitution, 0.2, 0, 1), vx: num(b.vx, 0, -1e4, 1e4), vy: num(b.vy, 0, -1e4, 1e4),
        angularVelocity: num(b.angularVelocity, 0, -100, 100),
        category: Math.round(num(b.category, 1, 0, 0xffffffff)), mask: Math.round(num(b.mask, 0xffffffff, 0, 0xffffffff)), group: Math.round(num(b.group, 0, -1000, 1000)),
        color: str(b.color, '#e0a552'),
      });
      scene.bodies.push(d);
    }
  }

  if (Array.isArray(raw.softBodies)) {
    for (const b of raw.softBodies.slice(0, 200)) {
      if (!b || typeof b !== 'object') continue;
      const shape = oneOf(b.shape, ['blob', 'rect', 'star', 'polygon'] as const, 'blob');
      let vertices: Vec2[] = [];
      if (shape === 'polygon') {
        const res = sanitizePolygon(Array.isArray(b.vertices) ? b.vertices : [], 400);
        if (!res.ok) { warnings.push(`soft body ${String(b.id)} skipped: ${res.reason}`); continue; }
        vertices = res.pts;
      }
      const d: SoftBodyDef = makeSoftDef({
        id: uniqueId(b.id, 'sb'), shape, x: num(b.x, 0), y: num(b.y, 0), angle: num(b.angle, 0, -1000, 1000),
        radius: num(b.radius, 80, 10, 2000), w: num(b.w, 160, 10, 4000), h: num(b.h, 90, 10, 4000),
        points: Math.round(num(b.points, 5, 3, 12)), innerRatio: num(b.innerRatio, 0.5, 0.2, 0.95), vertices,
        resolution: num(b.resolution, 22, 8, 120), stiffness: num(b.stiffness, 0.8, 0, 1), shapeRetention: num(b.shapeRetention, 0.25, 0, 1),
        damping: num(b.damping, 0.02, 0, 1), density: num(b.density, 0.6, 0.01, 50), pressure: num(b.pressure, 1, 0.2, 3),
        friction: num(b.friction, 0.4, 0, 2), restitution: num(b.restitution, 0.1, 0, 1), vx: num(b.vx, 0, -1e4, 1e4), vy: num(b.vy, 0, -1e4, 1e4),
        color: str(b.color, '#5fc98f'),
      });
      scene.softBodies.push(d);
    }
  }

  const bodyIds = new Set(scene.bodies.map(b => b.id));
  const softIds = new Set(scene.softBodies.map(b => b.id));
  if (Array.isArray(raw.constraints)) {
    for (const c of raw.constraints.slice(0, 2000)) {
      if (!c || typeof c !== 'object') continue;
      const bodyA = typeof c.bodyA === 'string' ? c.bodyA : null;
      const bodyB = typeof c.bodyB === 'string' ? c.bodyB : null;
      const softA = typeof c.softA === 'string' ? c.softA : null;
      if (bodyA && !bodyIds.has(bodyA)) { warnings.push(`constraint ${String(c.id)} dropped: missing bodyA`); continue; }
      if (bodyB && !bodyIds.has(bodyB)) { warnings.push(`constraint ${String(c.id)} dropped: missing bodyB`); continue; }
      if (softA && !softIds.has(softA)) { warnings.push(`constraint ${String(c.id)} dropped: missing softA`); continue; }
      if (!bodyA && !bodyB && !softA) { warnings.push(`constraint ${String(c.id)} dropped: no attached body`); continue; }
      if (bodyA && bodyA === bodyB) { warnings.push(`constraint ${String(c.id)} dropped: self-reference`); continue; }
      const d: ConstraintDef = makeConstraintDef({
        id: uniqueId(c.id, 'cs'), kind: oneOf(c.kind, ['link', 'spring', 'pin'] as const, 'spring'),
        bodyA, bodyB, softA, nodeA: Math.round(num(c.nodeA, -1, -1, 10000)),
        pointA: vec(c.pointA, { x: 0, y: 0 }), pointB: vec(c.pointB, { x: 0, y: 0 }),
        length: num(c.length, 100, 0, 6000), stiffness: num(c.stiffness, 0.05, 0.0001, 1), damping: num(c.damping, 0.02, 0, 1),
      });
      scene.constraints.push(d);
    }
  }

  const u = raw.ui ?? {};
  const du = defaultUi();
  scene.ui = {
    grid: bool(u.grid, du.grid), gridSize: num(u.gridSize, du.gridSize, 5, 500), snap: bool(u.snap, du.snap),
    debug: { ...du.debug, ...(u.debug && typeof u.debug === 'object' ? Object.fromEntries(Object.entries(u.debug).filter(([k, v]) => k in du.debug && typeof v === 'boolean')) : {}) },
    toolDefaults: { ...du.toolDefaults, ...(u.toolDefaults && typeof u.toolDefaults === 'object' ? Object.fromEntries(Object.entries(u.toolDefaults).filter(([k, v]) => k in du.toolDefaults && typeof v === typeof (du.toolDefaults as any)[k] && (typeof v !== 'number' || Number.isFinite(v)))) : {}) },
    deviceGravity: {
      sensitivity: num(u.deviceGravity?.sensitivity, 1, 0.1, 5), smoothing: num(u.deviceGravity?.smoothing, 0.15, 0, 0.99),
      invertX: bool(u.deviceGravity?.invertX, false), invertY: bool(u.deviceGravity?.invertY, false),
    },
  };
  return { ok: errors.length === 0, scene, errors, warnings };
}

export function parseSceneJson(text: string): ValidationResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false, scene: null, errors: [`invalid JSON: ${(e as Error).message}`], warnings: [] }; }
  return validateScene(parsed);
}
