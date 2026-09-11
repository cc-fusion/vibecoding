// Deformable bodies: a closed ring of particles solved with XPBD (edge + bend distance constraints, area constraint
// with an internal-pressure target) plus shape matching toward the rest shape, which gives robust recovery and
// prevents mesh inversion. Collisions: world bounds, Matter.js bodies (node-in-body and body-vertex-in-ring), other rings.
import type Matter from 'matter-js';
import { type SoftBodyDef, type Vec2, WATER_DENSITY } from './schema';
import { pointInRing, rotate, signedArea } from './geometry';
import { resolvePointInBody, pointVelocity, ImpulseAccumulator } from './rigid';

const REF_DT = 1 / 240;
const tmpV = new Float32Array(2);

export interface SoftPin { node: number; x: number; y: number; stiffness: number }

export function buildRing(def: SoftBodyDef): Vec2[] {
  const res = Math.max(6, def.resolution);
  const pts: Vec2[] = [];
  const sampleEdges = (poly: Vec2[]) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const segs = Math.max(1, Math.round(len / res));
      for (let k = 0; k < segs; k++) {
        const t = k / segs;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  };
  if (def.shape === 'blob') {
    const n = Math.max(8, Math.min(96, Math.round((2 * Math.PI * def.radius) / res)));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: Math.cos(a) * def.radius, y: Math.sin(a) * def.radius }); }
  } else if (def.shape === 'rect') {
    const hw = def.w / 2, hh = def.h / 2;
    sampleEdges([{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]);
  } else if (def.shape === 'star') {
    const poly: Vec2[] = [];
    const n = Math.max(3, def.points);
    for (let i = 0; i < 2 * n; i++) {
      const r = i % 2 === 0 ? def.radius : def.radius * def.innerRatio;
      const a = (i / (2 * n)) * Math.PI * 2 - Math.PI / 2;
      poly.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    sampleEdges(poly);
  } else {
    sampleEdges(def.vertices.length >= 3 ? def.vertices : [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 0, y: 50 }]);
  }
  if (signedArea(pts) < 0) pts.reverse();
  return pts.map(p => { const r = rotate(p, def.angle); return { x: r.x + def.x, y: r.y + def.y }; });
}

export class SoftBody {
  def: SoftBodyDef;
  n: number;
  pos: Float32Array; prev: Float32Array; vel: Float32Array;
  invMass: Float32Array; nodeMass: number;
  restLocal: Float32Array; restEdge: Float32Array; restBend: Float32Array; restArea: number;
  extAcc: Float32Array;  // external accelerations (fluid drag/buoyancy) per node, set each step
  extDv: Float32Array;   // accumulated velocity impulses (fluid particles) per node
  // contacts (per node, refreshed each substep)
  contactBody: (Matter.Body | null)[]; contactNx: Float32Array; contactNy: Float32Array; contactActive: Uint8Array;
  contactPreVn: Float32Array;
  pins: SoftPin[] = [];
  minX = 0; minY = 0; maxX = 0; maxY = 0;
  color: string;
  dragTarget: { node: number; x: number; y: number } | null = null;

  constructor(def: SoftBodyDef) {
    this.def = def;
    this.color = def.color;
    const ring = buildRing(def);
    const n = (this.n = ring.length);
    this.pos = new Float32Array(2 * n); this.prev = new Float32Array(2 * n); this.vel = new Float32Array(2 * n);
    this.invMass = new Float32Array(n); this.restLocal = new Float32Array(2 * n);
    this.restEdge = new Float32Array(n); this.restBend = new Float32Array(n);
    this.extAcc = new Float32Array(2 * n); this.extDv = new Float32Array(2 * n);
    this.contactBody = new Array(n).fill(null); this.contactNx = new Float32Array(n); this.contactNy = new Float32Array(n);
    this.contactActive = new Uint8Array(n); this.contactPreVn = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.pos[2 * i] = ring[i].x; this.pos[2 * i + 1] = ring[i].y; this.vel[2 * i] = def.vx; this.vel[2 * i + 1] = def.vy; }
    this.prev.set(this.pos);
    this.restArea = Math.abs(signedArea(ring));
    this.nodeMass = 1;
    this.updateMass();
    // rest shape relative to centroid (rotation-free; shape matching solves the rotation each substep)
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += ring[i].x; cy += ring[i].y; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) { this.restLocal[2 * i] = ring[i].x - cx; this.restLocal[2 * i + 1] = ring[i].y - cy; }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i + 2) % n;
      this.restEdge[i] = Math.max(1e-3, Math.hypot(ring[j].x - ring[i].x, ring[j].y - ring[i].y));
      this.restBend[i] = Math.max(1e-3, Math.hypot(ring[k].x - ring[i].x, ring[k].y - ring[i].y));
    }
    this.updateBounds();
  }

  updateMass() {
    const m = Math.max(1e-6, this.def.density * WATER_DENSITY * this.restArea / this.n);
    this.nodeMass = m;
    for (let i = 0; i < this.n; i++) this.invMass[i] = 1 / m;
    for (const p of this.pins) if (p.stiffness >= 1) this.invMass[p.node] = 0;
  }

  setPins(pins: SoftPin[]) {
    this.pins = pins.filter(p => p.node >= 0 && p.node < this.n);
    this.updateMass();
  }

  get mass() { return this.nodeMass * this.n; }

  centroid(out: Float32Array) {
    let cx = 0, cy = 0;
    for (let i = 0; i < this.n; i++) { cx += this.pos[2 * i]; cy += this.pos[2 * i + 1]; }
    out[0] = cx / this.n; out[1] = cy / this.n;
  }

  averageVelocity(out: Float32Array) {
    let vx = 0, vy = 0;
    for (let i = 0; i < this.n; i++) { vx += this.vel[2 * i]; vy += this.vel[2 * i + 1]; }
    out[0] = vx / this.n; out[1] = vy / this.n;
  }

  area(): number {
    let a = 0;
    const p = this.pos, n = this.n;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
    return a * 0.5;
  }

  updateBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < this.n; i++) {
      const x = this.pos[2 * i], y = this.pos[2 * i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
  }

  containsPoint(x: number, y: number): boolean {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return false;
    return pointInRing(x, y, this.pos, this.n);
  }

  translate(dx: number, dy: number) {
    for (let i = 0; i < this.n; i++) { this.pos[2 * i] += dx; this.pos[2 * i + 1] += dy; this.prev[2 * i] += dx; this.prev[2 * i + 1] += dy; }
    for (const p of this.pins) { p.x += dx; p.y += dy; }
    this.updateBounds();
  }

  setVelocityAll(vx: number, vy: number) {
    for (let i = 0; i < this.n; i++) { this.vel[2 * i] = vx; this.vel[2 * i + 1] = vy; }
  }

  /** Nearest edge of this ring to a point: returns edge index and parameter t. */
  nearestEdge(x: number, y: number, out: Float32Array): number {
    let best = Infinity, bi = 0, bt = 0, bnx = 0, bny = 0;
    const p = this.pos, n = this.n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = Math.hypot(x - qx, y - qy);
      if (d < best) {
        best = d; bi = i; bt = t;
        // outward normal of edge (ring has positive signed area in y-down ⇒ outward is (dy, -dx))
        const l = Math.sqrt(l2) || 1;
        bnx = dy / l; bny = -dx / l;
      }
    }
    out[0] = best; out[1] = bt; out[2] = bnx; out[3] = bny;
    return bi;
  }

  // ---------- simulation ----------
  integrate(dt: number, gx: number, gy: number) {
    const n = this.n, pos = this.pos, prev = this.prev, vel = this.vel, ext = this.extAcc, dvs = this.extDv;
    const damping = this.def.damping;
    // damping acts on velocity relative to the body's mean velocity, so it doesn't brake free fall
    tmpV[0] = 0; tmpV[1] = 0;
    this.averageVelocity(tmpV);
    const k = 1 - Math.pow(1 - Math.min(damping, 0.999), dt * 60);
    for (let i = 0; i < n; i++) {
      if (this.invMass[i] === 0) { prev[2 * i] = pos[2 * i]; prev[2 * i + 1] = pos[2 * i + 1]; continue; }
      let vx = vel[2 * i] + (gx + ext[2 * i]) * dt + dvs[2 * i];
      let vy = vel[2 * i + 1] + (gy + ext[2 * i + 1]) * dt + dvs[2 * i + 1];
      vx += k * (tmpV[0] - vx); vy += k * (tmpV[1] - vy);
      const sp = Math.hypot(vx, vy);
      if (sp > 4000) { vx *= 4000 / sp; vy *= 4000 / sp; }
      vel[2 * i] = vx; vel[2 * i + 1] = vy;
      prev[2 * i] = pos[2 * i]; prev[2 * i + 1] = pos[2 * i + 1];
      pos[2 * i] += vx * dt; pos[2 * i + 1] += vy * dt;
    }
    dvs.fill(0);
  }

  solveConstraints(dt: number) {
    const n = this.n, pos = this.pos, w = this.invMass, def = this.def;
    const stiff = Math.min(Math.max(def.stiffness, 0), 1);
    // XPBD compliance mapped from a 0..1 stiffness. α̃ = α/dt² is compared against w = 1/m in the projection, so α is
    // scaled by 1/m to make the response density independent; at stiffness 0.5 a single pass removes half the error.
    const alphaEdge = ((1 - stiff) / Math.max(stiff, 0.02)) * (2 / this.nodeMass) * REF_DT * REF_DT;
    const alphaBend = alphaEdge * 4 + 1e-9;
    const dt2 = dt * dt;
    for (let pass = 0; pass < 2; pass++) {
      const alpha = pass === 0 ? alphaEdge : alphaBend;
      const rest = pass === 0 ? this.restEdge : this.restBend;
      const step = pass === 0 ? 1 : 2;
      const at = alpha / dt2;
      for (let i = 0; i < n; i++) {
        const j = (i + step) % n;
        const wi = w[i], wj = w[j], wsum = wi + wj;
        if (wsum === 0) continue;
        let dx = pos[2 * j] - pos[2 * i], dy = pos[2 * j + 1] - pos[2 * i + 1];
        const d = Math.hypot(dx, dy);
        if (d < 1e-6) continue;
        const C = d - rest[i];
        const lambda = -C / (wsum + at);
        dx /= d; dy /= d;
        pos[2 * i] -= wi * lambda * dx; pos[2 * i + 1] -= wi * lambda * dy;
        pos[2 * j] += wj * lambda * dx; pos[2 * j + 1] += wj * lambda * dy;
      }
    }
    // Area constraint: C = A - A0·pressure. ∇_i A = 0.5·(y_{i+1} − y_{i−1}, x_{i−1} − x_{i+1}).
    const target = this.restArea * Math.min(Math.max(def.pressure, 0.2), 3);
    const A = this.area();
    const C = A - target;
    if (Math.abs(C) > 1e-6) {
      let denom = 0;
      for (let i = 0; i < n; i++) {
        const ip = (i + n - 1) % n, inx = (i + 1) % n;
        const gx = 0.5 * (pos[2 * inx + 1] - pos[2 * ip + 1]), gy = 0.5 * (pos[2 * ip] - pos[2 * inx]);
        denom += w[i] * (gx * gx + gy * gy);
      }
      const alphaArea = (1e-3 / this.nodeMass) * REF_DT * REF_DT / dt2;
      if (denom > 0) {
        const lambda = -C / (denom + alphaArea);
        for (let i = 0; i < n; i++) {
          const ip = (i + n - 1) % n, inx = (i + 1) % n;
          const gx = 0.5 * (pos[2 * inx + 1] - pos[2 * ip + 1]), gy = 0.5 * (pos[2 * ip] - pos[2 * inx]);
          const s = w[i] * lambda;
          pos[2 * i] += s * gx; pos[2 * i + 1] += s * gy;
        }
      }
    }
    // Shape matching (Müller et al. 2005): optimal rotation of the rest shape onto current positions.
    const retain = Math.min(Math.max(def.shapeRetention, 0), 1);
    if (retain > 0) {
      const k = 1 - Math.pow(1 - retain, dt * 60);
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) { cx += pos[2 * i]; cy += pos[2 * i + 1]; }
      cx /= n; cy /= n;
      let a00 = 0, a01 = 0, a10 = 0, a11 = 0;
      const q = this.restLocal;
      for (let i = 0; i < n; i++) {
        const px = pos[2 * i] - cx, py = pos[2 * i + 1] - cy, qx = q[2 * i], qy = q[2 * i + 1];
        a00 += px * qx; a01 += px * qy; a10 += py * qx; a11 += py * qy;
      }
      const theta = Math.atan2(a10 - a01, a00 + a11);
      const c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < n; i++) {
        if (w[i] === 0) continue;
        const gx = cx + c * q[2 * i] - s * q[2 * i + 1], gy = cy + s * q[2 * i] + c * q[2 * i + 1];
        pos[2 * i] += k * (gx - pos[2 * i]); pos[2 * i + 1] += k * (gy - pos[2 * i + 1]);
      }
    }
    for (const p of this.pins) {
      const i = p.node;
      if (p.stiffness >= 1) { pos[2 * i] = p.x; pos[2 * i + 1] = p.y; }
      else { pos[2 * i] += p.stiffness * (p.x - pos[2 * i]); pos[2 * i + 1] += p.stiffness * (p.y - pos[2 * i + 1]); }
    }
    if (this.dragTarget) {
      const i = this.dragTarget.node;
      pos[2 * i] += 0.35 * (this.dragTarget.x - pos[2 * i]); pos[2 * i + 1] += 0.35 * (this.dragTarget.y - pos[2 * i + 1]);
    }
  }

  /** World bounds + rigid bodies. Records contacts for the velocity pass. */
  collide(width: number, height: number, bodies: Matter.Body[]) {
    const n = this.n, pos = this.pos, prev = this.prev;
    this.contactActive.fill(0);
    for (let i = 0; i < n; i++) {
      let x = pos[2 * i], y = pos[2 * i + 1];
      if (!(x === x && y === y)) { x = prev[2 * i]; y = prev[2 * i + 1]; }
      if (x < 0) { x = 0; this.setContact(i, null, 1, 0); }
      else if (x > width) { x = width; this.setContact(i, null, -1, 0); }
      if (y < 0) { y = 0; this.setContact(i, null, 0, 1); }
      else if (y > height) { y = height; this.setContact(i, null, 0, -1); }
      pos[2 * i] = x; pos[2 * i + 1] = y;
    }
    this.updateBounds();
    for (let bi = 0; bi < bodies.length; bi++) {
      const b = bodies[bi];
      if (b.isSensor) continue;
      const bb = b.bounds;
      if (bb.max.x < this.minX || bb.min.x > this.maxX || bb.max.y < this.minY || bb.min.y > this.maxY) continue;
      // nodes inside body
      for (let i = 0; i < n; i++) {
        const x = pos[2 * i], y = pos[2 * i + 1];
        const c = resolvePointInBody(b, x, y);
        if (!c) continue;
        const depth = Math.min(c.depth + 0.5, 40);
        pos[2 * i] += c.nx * depth; pos[2 * i + 1] += c.ny * depth;
        this.setContact(i, b, c.nx, c.ny);
      }
      // body vertices inside the ring (prevents thin/small rigid shapes poking through between nodes)
      const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const part of parts) {
        const verts = part.vertices;
        for (let vi = 0; vi < verts.length; vi++) {
          const v = verts[vi];
          if (v.x < this.minX || v.x > this.maxX || v.y < this.minY || v.y > this.maxY) continue;
          if (!pointInRing(v.x, v.y, pos, n)) continue;
          const e = this.nearestEdge(v.x, v.y, tmpEdge);
          const d = tmpEdge[0], t = tmpEdge[1], nx = tmpEdge[2], ny = tmpEdge[3];
          if (d > 30) continue;
          const j = (e + 1) % n;
          const push = Math.min(d + 0.5, 30);
          // The vertex crossed the surface inward, so indent the edge inward (−n) past the vertex.
          pos[2 * e] -= nx * push * (1 - t); pos[2 * e + 1] -= ny * push * (1 - t);
          pos[2 * j] -= nx * push * t; pos[2 * j + 1] -= ny * push * t;
          // contact normal for the nodes points from the body into the soft material (−n)
          this.setContact(e, b, -nx, -ny); this.setContact(j, b, -nx, -ny);
        }
      }
    }
    this.updateBounds();
  }

  private setContact(i: number, body: Matter.Body | null, nx: number, ny: number) {
    this.contactActive[i] = 1; this.contactBody[i] = body; this.contactNx[i] = nx; this.contactNy[i] = ny;
    // pre-solve relative normal velocity
    let bvx = 0, bvy = 0;
    if (body) { pointVelocity(body, this.pos[2 * i], this.pos[2 * i + 1], tmpV); bvx = tmpV[0]; bvy = tmpV[1]; }
    this.contactPreVn[i] = (this.vel[2 * i] - bvx) * nx + (this.vel[2 * i + 1] - bvy) * ny;
  }

  /** Soft–soft: push nodes of this ring out of another ring, splitting the correction by mass. */
  collideSoft(other: SoftBody) {
    if (other.maxX < this.minX || other.minX > this.maxX || other.maxY < this.minY || other.minY > this.maxY) return;
    const n = this.n, pos = this.pos;
    const wA = 1 / this.nodeMass, wB = 1 / other.nodeMass, wsum = wA + wB;
    for (let i = 0; i < n; i++) {
      const x = pos[2 * i], y = pos[2 * i + 1];
      if (!other.containsPoint(x, y)) continue;
      const e = other.nearestEdge(x, y, tmpEdge);
      const d = tmpEdge[0], t = tmpEdge[1], nx = tmpEdge[2], ny = tmpEdge[3];
      if (d > 40) continue;
      const push = d + 0.5;
      const sa = push * (wA / wsum), sb = push * (wB / wsum);
      pos[2 * i] += nx * sa; pos[2 * i + 1] += ny * sa;
      const j = (e + 1) % other.n;
      other.pos[2 * e] -= nx * sb * (1 - t); other.pos[2 * e + 1] -= ny * sb * (1 - t);
      other.pos[2 * j] -= nx * sb * t; other.pos[2 * j + 1] -= ny * sb * t;
    }
  }

  /** Derive velocities from positions and apply contact restitution/friction with reactions on rigid bodies. */
  updateVelocities(dt: number, impulses: ImpulseAccumulator) {
    const n = this.n, pos = this.pos, prev = this.prev, vel = this.vel, inv = 1 / dt;
    const e = this.def.restitution, mu = this.def.friction, m = this.nodeMass;
    for (let i = 0; i < n; i++) {
      if (this.invMass[i] === 0) { vel[2 * i] = 0; vel[2 * i + 1] = 0; continue; }
      const freeVx = vel[2 * i], freeVy = vel[2 * i + 1]; // velocity before constraint/contact projection
      let vx = (pos[2 * i] - prev[2 * i]) * inv, vy = (pos[2 * i + 1] - prev[2 * i + 1]) * inv;
      if (this.contactActive[i]) {
        const body = this.contactBody[i], nx = this.contactNx[i], ny = this.contactNy[i];
        let bvx = 0, bvy = 0;
        if (body) { pointVelocity(body, pos[2 * i], pos[2 * i + 1], tmpV); bvx = tmpV[0]; bvy = tmpV[1]; }
        let rvx = vx - bvx, rvy = vy - bvy;
        const vn = rvx * nx + rvy * ny;
        const preVn = this.contactPreVn[i];
        const targetVn = preVn < -20 ? -e * preVn : 0; // restitution only for real impacts
        if (vn < targetVn) {
          const dvn = targetVn - vn;
          rvx += nx * dvn; rvy += ny * dvn;
          // Coulomb friction: tangential change bounded by μ·normal change
          let tx = rvx - nx * (rvx * nx + rvy * ny), ty = rvy - ny * (rvx * nx + rvy * ny);
          const vt = Math.hypot(tx, ty);
          if (vt > 1e-6) {
            const maxF = mu * Math.max(dvn, Math.abs(preVn) * 0.5);
            const f = Math.min(vt, maxF) / vt;
            rvx -= tx * f; rvy -= ty * f;
          }
          vx = rvx + bvx; vy = rvy + bvy;
        }
        if (body && !body.isStatic) {
          // reaction: the node's momentum change relative to its free (already gravity-integrated) velocity
          const jx = -m * (vx - freeVx), jy = -m * (vy - freeVy);
          impulses.add(body, pos[2 * i], pos[2 * i + 1], jx, jy);
        }
      }
      if (!(Number.isFinite(vx) && Number.isFinite(vy))) { vx = 0; vy = 0; pos[2 * i] = prev[2 * i]; pos[2 * i + 1] = prev[2 * i + 1]; }
      vel[2 * i] = vx; vel[2 * i + 1] = vy;
    }
  }

  isFinite(): boolean {
    for (let i = 0; i < 2 * this.n; i++) if (!Number.isFinite(this.pos[i]) || !Number.isFinite(this.vel[i])) return false;
    return true;
  }
}

const tmpEdge = new Float32Array(4);
