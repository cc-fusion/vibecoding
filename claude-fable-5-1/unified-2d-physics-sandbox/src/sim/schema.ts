// Versioned, declarative scene format. Runtime physics objects are never serialized directly.

export const SCENE_VERSION = 1;

export interface Vec2 { x: number; y: number }

export interface WorldSettings {
  width: number;   // world units (≈ 100 units per metre, Matter.js-friendly scale)
  height: number;
  gravity: Vec2;   // units / s²
  timeScale: number;
  rigidSubsteps: number;
  softSubsteps: number;
  fluidSubsteps: number;
}

export interface FluidSettings {
  cellSize: number;
  flipRatio: number;
  pressureIters: number;
  separationIters: number;
  separationStrength: number;
  overRelaxation: number;
  density: number;             // relative to water = 1
  driftCompensation: boolean;
  driftStiffness: number;
  particleRadiusFactor: number; // radius = factor * cellSize
  maxParticles: number;
  gravityScale: number;
  couplingScale: number;       // scales fluid→body forces
}

export interface FluidRegionDef {
  id: string;
  type: 'fill' | 'emitter';
  x: number; y: number; w: number; h: number;
  rate: number;   // particles / second (emitter)
  vx: number; vy: number; // initial velocity (emitter)
}

export interface FluidState { positions: number[]; velocities: number[] }

export type RigidShape = 'rect' | 'circle' | 'polygon';

export interface RigidBodyDef {
  id: string;
  shape: RigidShape;
  x: number; y: number; angle: number;
  w: number; h: number; radius: number;
  vertices: Vec2[]; // local space, for polygon
  isStatic: boolean; isSensor: boolean;
  density: number; friction: number; frictionAir: number; restitution: number;
  vx: number; vy: number; angularVelocity: number;
  category: number; mask: number; group: number;
  color: string;
}

export type SoftShape = 'blob' | 'rect' | 'star' | 'polygon';

export interface SoftBodyDef {
  id: string;
  shape: SoftShape;
  x: number; y: number; angle: number;
  radius: number; w: number; h: number; points: number; innerRatio: number;
  vertices: Vec2[]; // local, for polygon
  resolution: number; // approx node spacing in world units
  stiffness: number;      // 0..1 edge stiffness
  shapeRetention: number; // 0..1 shape matching strength
  damping: number;
  density: number;
  pressure: number;       // area target multiplier
  friction: number; restitution: number;
  vx: number; vy: number;
  color: string;
}

export type ConstraintKind = 'link' | 'spring' | 'pin';

export interface ConstraintDef {
  id: string;
  kind: ConstraintKind;
  bodyA: string | null;  // rigid body id or null for world
  bodyB: string | null;
  softA: string | null;  // soft body id (pin to node)
  nodeA: number;
  pointA: Vec2;          // local to bodyA if bodyA else world
  pointB: Vec2;
  length: number;
  stiffness: number;
  damping: number;
}

export interface DebugFlags {
  rigidOutlines: boolean; softNodes: boolean; softSprings: boolean;
  fluidParticles: boolean; fluidGrid: boolean; fluidCells: boolean; velocity: boolean;
  fluidRegions: boolean;
}

export interface UiPrefs {
  grid: boolean; gridSize: number; snap: boolean;
  debug: DebugFlags;
  toolDefaults: ToolDefaults;
  deviceGravity: { sensitivity: number; smoothing: number; invertX: boolean; invertY: boolean };
}

export interface ToolDefaults {
  rigidStatic: boolean; rigidSides: number; rigidDensity: number; rigidFriction: number; rigidRestitution: number;
  softShape: SoftShape; softResolution: number; softStiffness: number; softPressure: number; softDensity: number;
  fluidMode: 'fill' | 'emitter'; emitterRate: number;
  constraintKind: ConstraintKind; springStiffness: number;
}

export interface SceneData {
  version: number;
  world: WorldSettings;
  fluid: FluidSettings;
  fluidRegions: FluidRegionDef[];
  fluidState: FluidState | null;
  bodies: RigidBodyDef[];
  softBodies: SoftBodyDef[];
  constraints: ConstraintDef[];
  ui: UiPrefs;
}

// ---------- IDs ----------
let idCounter = 0;
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.floor(Math.random() * 46656).toString(36)}`;
}

// ---------- Defaults ----------
export const WATER_DENSITY = 0.001; // Matter.js mass/area units for "1.0"

export function defaultWorld(): WorldSettings {
  return { width: 1600, height: 1000, gravity: { x: 0, y: 981 }, timeScale: 1, rigidSubsteps: 2, softSubsteps: 4, fluidSubsteps: 1 };
}

export function defaultFluid(): FluidSettings {
  const mobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return {
    cellSize: mobile ? 32 : 20, flipRatio: 0.9, pressureIters: mobile ? 30 : 50, separationIters: 2, separationStrength: 1,
    overRelaxation: 1.9, density: 1, driftCompensation: true, driftStiffness: 1, particleRadiusFactor: 0.3,
    maxParticles: mobile ? 5000 : 14000, gravityScale: 1, couplingScale: 1,
  };
}

export function defaultDebug(): DebugFlags {
  return { rigidOutlines: false, softNodes: false, softSprings: false, fluidParticles: false, fluidGrid: false, fluidCells: false, velocity: false, fluidRegions: false };
}

export function defaultToolDefaults(): ToolDefaults {
  return {
    rigidStatic: false, rigidSides: 6, rigidDensity: 1, rigidFriction: 0.3, rigidRestitution: 0.2,
    softShape: 'blob', softResolution: 22, softStiffness: 0.8, softPressure: 1, softDensity: 0.6,
    fluidMode: 'fill', emitterRate: 200, constraintKind: 'spring', springStiffness: 0.05,
  };
}

export function defaultUi(): UiPrefs {
  return { grid: false, gridSize: 50, snap: false, debug: defaultDebug(), toolDefaults: defaultToolDefaults(), deviceGravity: { sensitivity: 1, smoothing: 0.15, invertX: false, invertY: false } };
}

export function makeRigidDef(partial: Partial<RigidBodyDef> = {}): RigidBodyDef {
  return {
    id: newId('rb'), shape: 'rect', x: 0, y: 0, angle: 0, w: 100, h: 60, radius: 40, vertices: [],
    isStatic: false, isSensor: false, density: 1, friction: 0.3, frictionAir: 0.01, restitution: 0.2,
    vx: 0, vy: 0, angularVelocity: 0, category: 1, mask: 0xffffffff, group: 0, color: '#e0a552', ...partial,
  };
}

export function makeSoftDef(partial: Partial<SoftBodyDef> = {}): SoftBodyDef {
  return {
    id: newId('sb'), shape: 'blob', x: 0, y: 0, angle: 0, radius: 80, w: 160, h: 90, points: 5, innerRatio: 0.5,
    vertices: [], resolution: 22, stiffness: 0.8, shapeRetention: 0.25, damping: 0.02, density: 0.6, pressure: 1,
    friction: 0.4, restitution: 0.1, vx: 0, vy: 0, color: '#5fc98f', ...partial,
  };
}

export function makeConstraintDef(partial: Partial<ConstraintDef> = {}): ConstraintDef {
  return {
    id: newId('cs'), kind: 'spring', bodyA: null, bodyB: null, softA: null, nodeA: -1,
    pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 0 }, length: 100, stiffness: 0.05, damping: 0.02, ...partial,
  };
}

export function makeRegionDef(partial: Partial<FluidRegionDef> = {}): FluidRegionDef {
  return { id: newId('fr'), type: 'fill', x: 0, y: 0, w: 200, h: 200, rate: 200, vx: 0, vy: 0, ...partial };
}

export function emptyScene(): SceneData {
  return { version: SCENE_VERSION, world: defaultWorld(), fluid: defaultFluid(), fluidRegions: [], fluidState: null, bodies: [], softBodies: [], constraints: [], ui: defaultUi() };
}

// Initial demonstration scene: pool of fluid, soft blob + soft slab, dynamic rigid bodies, ramp, spring.
export function defaultScene(): SceneData {
  const s = emptyScene();
  const W = s.world.width, H = s.world.height;
  // Pool on the left held by a static pillar (dam); ramp + ledge on the right; bodies fall into the pool quickly.
  s.fluidRegions.push(makeRegionDef({ id: 'fr_pool', type: 'fill', x: 0, y: H - 400, w: W * 0.6, h: 400 }));
  s.bodies.push(
    makeRigidDef({ id: 'rb_pillar', shape: 'rect', x: W * 0.6 + 20, y: H - 200, w: 40, h: 400, isStatic: true, color: '#8a94a6' }),
    makeRigidDef({ id: 'rb_ramp', shape: 'rect', x: W * 0.80, y: H * 0.40, w: 420, h: 24, angle: 0.42, isStatic: true, color: '#8a94a6' }),
    makeRigidDef({ id: 'rb_ledge', shape: 'rect', x: W * 0.86, y: H - 200, w: 340, h: 24, isStatic: true, color: '#8a94a6' }),
    makeRigidDef({ id: 'rb_crate', shape: 'rect', x: W * 0.71, y: H * 0.12, w: 90, h: 90, density: 0.5, color: '#e0a552' }),
    makeRigidDef({ id: 'rb_ball', shape: 'circle', x: W * 0.30, y: 120, radius: 42, density: 0.4, restitution: 0.3, color: '#f2704e' }),
    makeRigidDef({ id: 'rb_heavy', shape: 'circle', x: W * 0.47, y: 60, radius: 32, density: 2.5, color: '#b5b9c2' }),
    makeRigidDef({ id: 'rb_hex', shape: 'polygon', x: W * 0.20, y: 240, radius: 48, vertices: regularPolygon(6, 48), density: 0.7, color: '#d9c94a' }),
    makeRigidDef({ id: 'rb_plank', shape: 'rect', x: W * 0.52, y: 420, w: 220, h: 26, density: 0.3, color: '#c58a4a' }),
    makeRigidDef({ id: 'rb_bob', shape: 'circle', x: W * 0.94, y: 300, radius: 28, density: 1.2, color: '#f2704e' }),
  );
  s.softBodies.push(
    makeSoftDef({ id: 'sb_blob', shape: 'blob', x: W * 0.10, y: H * 0.34, radius: 95, resolution: 22, density: 0.5, color: '#5fc98f' }),
    makeSoftDef({ id: 'sb_slab', shape: 'rect', x: W * 0.38, y: H * 0.22, w: 220, h: 80, resolution: 22, density: 0.9, stiffness: 0.9, shapeRetention: 0.35, color: '#4fb8d9' }),
  );
  s.constraints.push(makeConstraintDef({ id: 'cs_spring', kind: 'spring', bodyA: null, bodyB: 'rb_bob', pointA: { x: W * 0.94, y: 40 }, pointB: { x: 0, y: 0 }, length: 200, stiffness: 0.02, damping: 0.02 }));
  return s;
}

export function regularPolygon(sides: number, radius: number): Vec2[] {
  const v: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    v.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return v;
}
