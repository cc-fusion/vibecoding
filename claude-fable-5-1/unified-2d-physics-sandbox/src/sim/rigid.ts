// Matter.js helpers: body construction from declarative defs, unit conversions, contact geometry and
// per-step impulse accumulation so that fluid/soft coupling can push dynamic bodies.
import Matter from 'matter-js';
import decomp from 'poly-decomp';
import { type RigidBodyDef, WATER_DENSITY } from './schema';
import { regularPolygon } from './schema';

const { Bodies, Body, Common } = Matter;
Common.setDecomp(decomp);

/** Allocation-free point-in-convex-polygon (same half-plane test Matter's Vertices.contains uses). */
export function containsConvex(verts: Matter.Vector[], x: number, y: number): boolean {
  for (let i = 0, n = verts.length; i < n; i++) {
    const v = verts[i], nv = verts[(i + 1) % n];
    if ((x - v.x) * (nv.y - v.y) + (y - v.y) * (v.x - nv.x) > 0) return false;
  }
  return true;
}

// Matter's velocities are "units per base delta (16.667 ms)"; we work in units per second everywhere else.
export const BASE_DELTA_MS = 1000 / 60;
export const velToMatter = (v: number) => v * (BASE_DELTA_MS / 1000);
export const velFromMatter = (v: number) => v * (1000 / BASE_DELTA_MS);
export const angVelToMatter = velToMatter;
export const angVelFromMatter = velFromMatter;

export function getVelocity(b: Matter.Body): { x: number; y: number } {
  const v = Body.getVelocity(b);
  return { x: velFromMatter(v.x), y: velFromMatter(v.y) };
}
export function setVelocity(b: Matter.Body, vx: number, vy: number) {
  Body.setVelocity(b, { x: velToMatter(vx), y: velToMatter(vy) });
}
export function getAngularVelocity(b: Matter.Body) { return angVelFromMatter(Body.getAngularVelocity(b)); }
export function setAngularVelocity(b: Matter.Body, w: number) { Body.setAngularVelocity(b, angVelToMatter(w)); }

/** Velocity (units/s) of a body's material point at world (x, y). */
export function pointVelocity(b: Matter.Body, x: number, y: number, out: Float32Array) {
  const v = Body.getVelocity(b), w = Body.getAngularVelocity(b);
  const rx = x - b.position.x, ry = y - b.position.y;
  out[0] = velFromMatter(v.x - w * ry);
  out[1] = velFromMatter(v.y + w * rx);
}

export interface BodyOptionsFromDef { def: RigidBodyDef }

export function createBodyFromDef(def: RigidBodyDef): Matter.Body | null {
  const opts: Matter.IChamferableBodyDefinition = {
    isStatic: def.isStatic, isSensor: def.isSensor, density: def.density * WATER_DENSITY,
    friction: def.friction, frictionAir: def.frictionAir, restitution: def.restitution,
    collisionFilter: { category: def.category, mask: def.mask, group: def.group },
    label: def.id, slop: 0.5,
  };
  let body: Matter.Body | null = null;
  if (def.shape === 'rect') body = Bodies.rectangle(def.x, def.y, def.w, def.h, opts);
  else if (def.shape === 'circle') body = Bodies.circle(def.x, def.y, def.radius, opts, Math.max(16, Math.min(48, Math.round(def.radius / 3))));
  else {
    const verts = def.vertices.length >= 3 ? def.vertices : regularPolygon(6, def.radius);
    const localCopy = verts.map(v => ({ x: v.x, y: v.y }));
    try {
      body = Bodies.fromVertices(def.x, def.y, [localCopy], opts, false, 0.01, 10, 0.01);
    } catch { body = null; }
    if (!body || !Number.isFinite(body.mass) || body.mass <= 0 || body.area <= 0) return null;
    // fromVertices centres the body at its centroid; keep the def position as the body position.
    Body.setPosition(body, { x: def.x, y: def.y });
  }
  if (!body) return null;
  Body.setAngle(body, def.angle);
  setVelocity(body, def.vx, def.vy);
  setAngularVelocity(body, def.angularVelocity);
  (body as any).defId = def.id;
  return body;
}

export function applyDefProperties(body: Matter.Body, def: RigidBodyDef) {
  if (body.isStatic !== def.isStatic) Body.setStatic(body, def.isStatic);
  if (!def.isStatic) Body.setDensity(body, def.density * WATER_DENSITY);
  else body.density = def.density * WATER_DENSITY;
  body.friction = def.friction; body.frictionAir = def.frictionAir; body.restitution = def.restitution;
  body.isSensor = def.isSensor;
  body.collisionFilter.category = def.category; body.collisionFilter.mask = def.mask; body.collisionFilter.group = def.group;
}

/** Contact info for a point inside a body: penetration depth and outward normal of the nearest face. */
export interface PointContact { depth: number; nx: number; ny: number; part: Matter.Body | null }
const scratchContact: PointContact = { depth: 0, nx: 0, ny: 0, part: null };

export function resolvePointInBody(body: Matter.Body, x: number, y: number): PointContact | null {
  const b = body.bounds;
  if (x < b.min.x || x > b.max.x || y < b.min.y || y > b.max.y) return null;
  const parts = body.parts;
  for (let pi = parts.length > 1 ? 1 : 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const pb = part.bounds;
    if (x < pb.min.x || x > pb.max.x || y < pb.min.y || y > pb.max.y) continue;
    const verts = part.vertices;
    if (!containsConvex(verts, x, y)) continue;
    // Convex part: penetration is the smallest distance to an edge line; normal points outward.
    const cx = part.position.x, cy = part.position.y;
    let best = Infinity, bnx = 0, bny = -1;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], c = verts[(i + 1) % verts.length];
      let nx = c.y - a.y, ny = -(c.x - a.x);
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      nx /= len; ny /= len;
      if (nx * (a.x - cx) + ny * (a.y - cy) < 0) { nx = -nx; ny = -ny; }
      const d = nx * (a.x - x) + ny * (a.y - y); // positive inside
      if (d < best) { best = d; bnx = nx; bny = ny; }
    }
    if (!Number.isFinite(best)) return null;
    scratchContact.depth = Math.max(best, 0); scratchContact.nx = bnx; scratchContact.ny = bny; scratchContact.part = part;
    return scratchContact;
  }
  return null;
}

/** Accumulates impulses (mass·units/s) on a dynamic body over one world step; applied as force before Engine.update. */
export class ImpulseAccumulator {
  private map = new Map<Matter.Body, { jx: number; jy: number; tau: number }>();
  add(body: Matter.Body, x: number, y: number, jx: number, jy: number) {
    if (body.isStatic || body.isSensor) return;
    let e = this.map.get(body);
    if (!e) { e = { jx: 0, jy: 0, tau: 0 }; this.map.set(body, e); }
    e.jx += jx; e.jy += jy;
    e.tau += (x - body.position.x) * jy - (y - body.position.y) * jx;
  }
  /** Convert accumulated impulses into Matter forces for a step of dt seconds, clamped to a maximum Δv. */
  flush(dt: number, maxDeltaV: number, maxDeltaW: number) {
    for (const [body, e] of this.map) {
      if (body.isStatic) continue;
      let dvx = e.jx / body.mass, dvy = e.jy / body.mass;
      const dv = Math.hypot(dvx, dvy);
      if (dv > maxDeltaV) { dvx *= maxDeltaV / dv; dvy *= maxDeltaV / dv; }
      let dw = e.tau / body.inertia;
      if (dw > maxDeltaW) dw = maxDeltaW; else if (dw < -maxDeltaW) dw = -maxDeltaW;
      if (!Number.isFinite(dvx) || !Number.isFinite(dvy) || !Number.isFinite(dw)) continue;
      // Matter integrates velocity += force / mass * delta² (delta in ms), so acceleration a (units/s²) ⇒ force = m·a·1e-6.
      const k = 1e-6 / dt;
      body.force.x += body.mass * dvx * k;
      body.force.y += body.mass * dvy * k;
      body.torque += body.inertia * dw * k;
    }
    this.map.clear();
  }
}
