import Matter from 'matter-js';
import type { SoftParams, Vec } from './types';
import { centroid, clamp, normalizeWinding, perimeter, resamplePolygon, signedArea } from './geometry';

const { Bodies, Body, Constraint, Composite } = Matter;

/**
 * Soft body built from a ring of collision particles connected by springs.
 *
 * Deformation model (per physics step):
 *  - edge + bending springs (Matter constraints)         -> stiffness / damping
 *  - gas pressure restoring the rest area                 -> pressure
 *  - shape matching toward the rotated rest shape         -> elasticity
 *
 * Particles are ordinary Matter circle bodies so they collide with rigid
 * bodies, walls and other soft bodies for free.
 */
export class SoftBody {
  readonly id: number;
  particles: Matter.Body[] = [];
  constraints: Matter.Constraint[] = [];
  /** original local outline, centered at origin, positive winding */
  readonly baseOutline: Vec[];
  /** rest positions of the resampled particles (local, centered) */
  rest: Vec[] = [];
  restArea = 1;
  spacing = 10;
  radius = 5;
  params: SoftParams;
  /** current orientation estimated by shape matching */
  angle = 0;
  center: Vec = { x: 0, y: 0 };
  area = 1;
  private group: number;
  private world: Matter.World;
  /** scratch */
  private goals: Vec[] = [];

  constructor(world: Matter.World, id: number, outlineWorld: Vec[], params: SoftParams) {
    this.world = world;
    this.id = id;
    this.params = { ...params };
    this.group = Matter.Body.nextGroup(true);
    const c = centroid(outlineWorld);
    this.baseOutline = normalizeWinding(outlineWorld.map((p) => ({ x: p.x - c.x, y: p.y - c.y })));
    this.build(c, 0);
  }

  /* ------------------------------------------------------------------ */
  /* construction                                                        */
  /* ------------------------------------------------------------------ */

  build(center: Vec, angle: number, velocity: Vec = { x: 0, y: 0 }) {
    this.destroy();
    const n = Math.max(6, Math.round(this.params.resolution));
    const local = resamplePolygon(this.baseOutline, n);
    const lc = centroid(local);
    this.rest = local.map((p) => ({ x: p.x - lc.x, y: p.y - lc.y }));
    this.restArea = Math.abs(signedArea(this.rest));
    this.spacing = perimeter(this.rest) / n;
    this.radius = clamp(this.spacing * 0.62, 3, 22);
    this.angle = angle;
    this.center = { ...center };

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const p = this.params;
    this.particles = this.rest.map((q) => {
      const x = center.x + q.x * cos - q.y * sin;
      const y = center.y + q.x * sin + q.y * cos;
      const b = Bodies.circle(x, y, this.radius, {
        friction: p.friction,
        frictionStatic: p.friction,
        restitution: p.restitution,
        density: 0.0012 * p.mass,
        frictionAir: this.airFriction(),
        slop: 0.02,
        collisionFilter: { group: this.group },
        plugin: { softId: this.id },
      });
      Body.setInertia(b, Infinity);
      Body.setVelocity(b, velocity);
      return b;
    });
    this.goals = this.rest.map(() => ({ x: 0, y: 0 }));

    const cons: Matter.Constraint[] = [];
    const s = this.springStiffness();
    const d = this.springDamping();
    for (let i = 0; i < n; i++) {
      const a = this.particles[i];
      const b = this.particles[(i + 1) % n];
      cons.push(
        Constraint.create({
          bodyA: a,
          bodyB: b,
          length: Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y),
          stiffness: s,
          damping: d,
          label: 'edge',
        }),
      );
      const c2 = this.particles[(i + 2) % n];
      cons.push(
        Constraint.create({
          bodyA: a,
          bodyB: c2,
          length: Math.hypot(a.position.x - c2.position.x, a.position.y - c2.position.y),
          stiffness: s * 0.5,
          damping: d,
          label: 'bend',
        }),
      );
    }
    this.constraints = cons;
    Composite.add(this.world, [...this.particles, ...this.constraints]);
  }

  destroy() {
    if (this.particles.length) Composite.remove(this.world, this.particles);
    if (this.constraints.length) Composite.remove(this.world, this.constraints);
    this.particles = [];
    this.constraints = [];
  }

  /** Rebuild in place (used when resolution changes). */
  rebuild() {
    const v = this.averageVelocity();
    this.build({ ...this.center }, this.angle, v);
  }

  /* ------------------------------------------------------------------ */
  /* parameters                                                          */
  /* ------------------------------------------------------------------ */

  private springStiffness() {
    const k = clamp(this.params.stiffness, 0, 1);
    return 0.03 + 0.7 * k * k;
  }
  private springDamping() {
    return clamp(this.params.damping, 0, 1) * 0.08;
  }
  private airFriction() {
    return 0.002 + clamp(this.params.damping, 0, 1) * 0.04;
  }

  setParams(partial: Partial<SoftParams>) {
    const prev = this.params;
    this.params = { ...prev, ...partial };
    if (partial.resolution !== undefined && Math.round(partial.resolution) !== Math.round(prev.resolution)) {
      this.rebuild();
      return;
    }
    const p = this.params;
    const s = this.springStiffness();
    const d = this.springDamping();
    for (const c of this.constraints) {
      c.stiffness = c.label === 'bend' ? s * 0.5 : s;
      c.damping = d;
    }
    const air = this.airFriction();
    const density = 0.0012 * p.mass;
    for (const b of this.particles) {
      b.friction = p.friction;
      b.frictionStatic = p.friction;
      b.restitution = p.restitution;
      b.frictionAir = air;
      if (partial.mass !== undefined) {
        Body.setDensity(b, density);
        Body.setInertia(b, Infinity);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* per-step forces                                                     */
  /* ------------------------------------------------------------------ */

  applyForces() {
    const ps = this.particles;
    const n = ps.length;
    if (n < 3) return;

    // centroid + signed area
    let cx = 0;
    let cy = 0;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = ps[i].position;
      const q = ps[(i + 1) % n].position;
      cx += p.x;
      cy += p.y;
      area += p.x * q.y - q.x * p.y;
    }
    cx /= n;
    cy /= n;
    area /= 2;
    this.center.x = cx;
    this.center.y = cy;
    this.area = area;

    // --- shape matching (optimal rotation of rest shape onto current) ---
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    for (let i = 0; i < n; i++) {
      const p = ps[i].position;
      const q = this.rest[i];
      const px = p.x - cx;
      const py = p.y - cy;
      a += px * q.x;
      b += px * q.y;
      c += py * q.x;
      d += py * q.y;
    }
    const theta = Math.atan2(c - b, a + d);
    this.angle = theta;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const K = clamp(this.params.elasticity, 0, 1) * 0.0022; // 1/ms²
    const inverted = area < this.restArea * 0.05;
    const ratio = inverted ? 3 : clamp(this.restArea / area - 1, -0.9, 4);
    const P = clamp(this.params.pressure, 0, 1) * 0.0045 * ratio; // px/ms²
    const maxDisp = 90;

    for (let i = 0; i < n; i++) {
      const body = ps[i];
      const p = body.position;
      const prev = ps[(i + n - 1) % n].position;
      const next = ps[(i + 1) % n].position;

      let ax = 0;
      let ay = 0;

      // pressure along the outward vertex normal (sum of adjacent edge normals)
      if (P !== 0) {
        // edge normal for positive winding: (dy, -dx)
        let nx = (p.y - prev.y) + (next.y - p.y);
        let ny = -((p.x - prev.x) + (next.x - p.x));
        const len = Math.hypot(nx, ny);
        if (len > 1e-6) {
          nx /= len;
          ny /= len;
          // scale by local edge length relative to rest spacing so uneven meshes stay balanced
          const edgeLen = (Math.hypot(p.x - prev.x, p.y - prev.y) + Math.hypot(next.x - p.x, next.y - p.y)) * 0.5;
          const w = clamp(edgeLen / this.spacing, 0.25, 2.5);
          ax += P * nx * w;
          ay += P * ny * w;
        }
      }

      // shape matching goal
      if (K > 0) {
        const q = this.rest[i];
        const gx = cx + q.x * cos - q.y * sin;
        const gy = cy + q.x * sin + q.y * cos;
        this.goals[i].x = gx;
        this.goals[i].y = gy;
        let dx = gx - p.x;
        let dy = gy - p.y;
        const dl = Math.hypot(dx, dy);
        if (dl > maxDisp) {
          dx *= maxDisp / dl;
          dy *= maxDisp / dl;
        }
        ax += K * dx;
        ay += K * dy;
      }

      if (ax !== 0 || ay !== 0) {
        Body.applyForce(body, p, { x: ax * body.mass, y: ay * body.mass });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* queries & helpers                                                   */
  /* ------------------------------------------------------------------ */

  positions(): Vec[] {
    return this.particles.map((p) => p.position);
  }

  /** Outline pushed outward by particle radius (for rendering the visual skin). */
  skinOutline(): Vec[] {
    const ps = this.particles;
    const n = ps.length;
    const out: Vec[] = new Array(n);
    const r = this.radius * 0.9;
    for (let i = 0; i < n; i++) {
      const p = ps[i].position;
      const prev = ps[(i + n - 1) % n].position;
      const next = ps[(i + 1) % n].position;
      let nx = (p.y - prev.y) + (next.y - p.y);
      let ny = -((p.x - prev.x) + (next.x - p.x));
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      out[i] = { x: p.x + nx * r, y: p.y + ny * r };
    }
    return out;
  }

  containsPoint(pt: Vec): boolean {
    const pts = this.positions();
    // inside polygon or within a particle
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
    const r2 = this.radius * this.radius;
    for (const p of pts) {
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  averageVelocity(): Vec {
    let vx = 0;
    let vy = 0;
    for (const p of this.particles) {
      vx += p.velocity.x;
      vy += p.velocity.y;
    }
    const n = this.particles.length || 1;
    return { x: vx / n, y: vy / n };
  }

  setVelocity(v: Vec) {
    for (const p of this.particles) Body.setVelocity(p, v);
  }

  translate(d: Vec) {
    for (const p of this.particles) Body.translate(p, d);
    this.center.x += d.x;
    this.center.y += d.y;
  }

  totalMass(): number {
    return this.particles.reduce((m, p) => m + p.mass, 0);
  }

  bounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.particles) {
      const b = p.bounds;
      if (b.min.x < minX) minX = b.min.x;
      if (b.min.y < minY) minY = b.min.y;
      if (b.max.x > maxX) maxX = b.max.x;
      if (b.max.y > maxY) maxY = b.max.y;
    }
    return { minX, minY, maxX, maxY };
  }
}
