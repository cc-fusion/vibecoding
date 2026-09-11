/* 2D, unit-depth, partitioned FLIP / XPBD solver. All lengths are metres.
 * MAC velocities: u(i,j) at (i*h,(j+.5)*h), v(i,j) at ((i+.5)*h,j*h).
 * q = pressure * dt / density. The pressure operator is a symmetric graph
 * Laplacian with zero-pressure air and prescribed-velocity solid boundaries.
 */
export interface Settings {
  flip: number; stiffness: number; gravity: number; coupled: boolean;
  viscosity: number; substeps: number; iterations: number; pinned: boolean;
}
export interface Particle { x: number; y: number; vx: number; vy: number }
export interface Node extends Particle { ox: number; oy: number; restX: number; restY: number }
interface Spring { a: number; b: number; rest: number; lambda: number }
interface Boundary { axis: 0 | 1; index: number; left: number; right: number; a: number; b: number; t: number }
export interface Diagnostics { divergence: number; residual: number; cfl: number; energy: number; exchangeError: number; steps: number; time: number }
export const defaults: Settings = { flip: .95, stiffness: .8, gravity: 9.81, coupled: true, viscosity: .015, substeps: 3, iterations: 40, pinned: false };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class FluidSolver {
  readonly nx = 72; readonly ny = 42; readonly width = 12; readonly h = 12 / 72; readonly height = 7;
  particles: Particle[] = []; nodes: Node[] = []; springs: Spring[] = []; outline: number[] = [];
  settings: Settings = { ...defaults }; scene = 'Dam break'; elapsed = 0;
  readonly cols = 9; readonly rows = 5; nodeMass = .06;
  particleMass = (12 / 72) ** 2 / 4;
  u = new Float64Array(73 * 42); v = new Float64Array(72 * 43);
  oldU = new Float64Array(this.u.length); oldV = new Float64Array(this.v.length);
  wu = new Float64Array(this.u.length); wv = new Float64Array(this.v.length);
  q = new Float64Array(72 * 42); rhs = new Float64Array(this.q.length); type = new Uint8Array(this.q.length);
  boundaries: Boundary[] = []; bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  pointer: { x: number; y: number; vx: number; vy: number; solid: boolean } | null = null;
  diagnostics: Diagnostics = { divergence: 0, residual: 0, cfl: 0, energy: 0, exchangeError: 0, steps: 0, time: 0 };
  constructor(scene = 'Dam break', density = 4) { this.reset(scene, density); }
  reset(scene = this.scene, density = 4) {
    this.scene = scene; this.elapsed = 0; this.particles = []; this.nodes = []; this.springs = []; this.outline = [];
    this.u.fill(0); this.v.fill(0); this.q.fill(0);
    let seed = 37; const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    const cx = scene === 'Drop test' ? 6 : 7.15, cy = scene === 'Drop test' ? 5.2 : 3.75;
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const x = cx + (i / (this.cols - 1) - .5) * 2.35;
      const y = cy + (j / (this.rows - 1) - .5) * 1.35 + .11 * Math.sin(i / 8 * Math.PI);
      this.nodes.push({ x, y, vx: 0, vy: 0, ox: x, oy: y, restX: x, restY: y });
    }
    const edge = (a: number, b: number) => this.springs.push({ a, b, rest: Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].y - this.nodes[b].y), lambda: 0 });
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const a = j * this.cols + i;
      if (i < this.cols - 1) edge(a, a + 1);
      if (j < this.rows - 1) edge(a, a + this.cols);
      if (i < this.cols - 1 && j < this.rows - 1) { edge(a, a + this.cols + 1); edge(a + 1, a + this.cols); }
      if (i < this.cols - 2) edge(a, a + 2);
      if (j < this.rows - 2) edge(a, a + this.cols * 2);
    }
    for (let i = 0; i < this.cols; i++) this.outline.push(i);
    for (let j = 1; j < this.rows; j++) this.outline.push(j * this.cols + this.cols - 1);
    for (let i = this.cols - 2; i >= 0; i--) this.outline.push((this.rows - 1) * this.cols + i);
    for (let j = this.rows - 2; j > 0; j--) this.outline.push(j * this.cols);
    this.nodeMass = 2.35 * 1.35 * .65 / this.nodes.length;
    this.updateBounds();
    this.particleMass = this.h * this.h / density;
    const spacing = this.h / Math.sqrt(density);
    for (let y = this.h * .55; y < 5.1; y += spacing) for (let x = this.h * .55; x < this.width - this.h * .5; x += spacing) {
      const level = scene === 'Dam break' ? (x < 3.4 ? 4.25 - .08 * x : 2.05 + .17 * Math.sin(x * 1.3)) : scene === 'Wave tank' ? 2.75 + .7 * Math.cos(x * .5) : 2.5;
      if (y > level) continue;
      const px = x + (random() - .5) * spacing * .38, py = y + (random() - .5) * spacing * .38;
      if (!this.inside(px, py)) this.particles.push({ x: px, y: py, vx: scene === 'Wave tank' ? 1.1 : .05, vy: 0 });
    }
    this.diagnostics = { divergence: 0, residual: 0, cfl: 0, energy: 0, exchangeError: 0, steps: 0, time: 0 };
  }
  updateBounds() {
    const xs = this.nodes.map(n => n.x), ys = this.nodes.map(n => n.y);
    this.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  inside(x: number, y: number) {
    const b = this.bounds; if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false;
    let hit = false;
    for (let k = 0, l = this.outline.length - 1; k < this.outline.length; l = k++) {
      const a = this.nodes[this.outline[k]], c = this.nodes[this.outline[l]];
      if ((a.y > y) !== (c.y > y) && x < (c.x - a.x) * (y - a.y) / (c.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }
  nearest(x: number, y: number) {
    let dist = Infinity, a = 0, b = 1, t = 0, px = 0, py = 0;
    for (let k = 0; k < this.outline.length; k++) {
      const ia = this.outline[k], ib = this.outline[(k + 1) % this.outline.length], n = this.nodes[ia], m = this.nodes[ib];
      const dx = m.x - n.x, dy = m.y - n.y, f = clamp(((x - n.x) * dx + (y - n.y) * dy) / (dx * dx + dy * dy + 1e-12), 0, 1);
      const xx = n.x + f * dx, yy = n.y + f * dy, d = (x - xx) ** 2 + (y - yy) ** 2;
      if (d < dist) { dist = d; a = ia; b = ib; t = f; px = xx; py = yy; }
    }
    return { a, b, t, x: px, y: py, dist: Math.sqrt(dist) };
  }
  sample(field: Float64Array, x: number, y: number, axis: number) {
    const w = axis === 0 ? this.nx + 1 : this.nx, ht = axis === 0 ? this.ny : this.ny + 1;
    const gx = clamp(x / this.h - (axis === 0 ? 0 : .5), 0, w - 1.001), gy = clamp(y / this.h - (axis === 0 ? .5 : 0), 0, ht - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, k = i + j * w;
    return field[k] * (1 - fx) * (1 - fy) + field[k + 1] * fx * (1 - fy) + field[k + w] * (1 - fx) * fy + field[k + w + 1] * fx * fy;
  }
  deposit(field: Float64Array, weights: Float64Array, p: Particle, axis: number) {
    const w = axis === 0 ? this.nx + 1 : this.nx, ht = axis === 0 ? this.ny : this.ny + 1;
    const gx = clamp(p.x / this.h - (axis === 0 ? 0 : .5), 0, w - 1.001), gy = clamp(p.y / this.h - (axis === 0 ? .5 : 0), 0, ht - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, vel = axis === 0 ? p.vx : p.vy;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      const k = i + xx + (j + yy) * w, weight = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
      field[k] += weight * vel; weights[k] += weight;
    }
  }
  extrapolate(field: Float64Array, weights: Float64Array, w: number, ht: number) {
    let valid = Uint8Array.from(weights, v => v > 1e-9 ? 1 : 0);
    for (let pass = 0; pass < 3; pass++) {
      const next = valid.slice(), values = field.slice();
      for (let j = 0; j < ht; j++) for (let i = 0; i < w; i++) {
        const k = i + j * w; if (valid[k]) continue;
        let sum = 0, count = 0;
        if (i > 0 && valid[k - 1]) { sum += field[k - 1]; count++; }
        if (i < w - 1 && valid[k + 1]) { sum += field[k + 1]; count++; }
        if (j > 0 && valid[k - w]) { sum += field[k - w]; count++; }
        if (j < ht - 1 && valid[k + w]) { sum += field[k + w]; count++; }
        if (count) { values[k] = sum / count; next[k] = 1; }
      }
      field.set(values); valid = next;
    }
  }
  p2g() {
    this.u.fill(0); this.v.fill(0); this.wu.fill(0); this.wv.fill(0); this.type.fill(0);
    for (const p of this.particles) {
      this.deposit(this.u, this.wu, p, 0); this.deposit(this.v, this.wv, p, 1);
      this.type[clamp(Math.floor(p.x / this.h), 0, this.nx - 1) + clamp(Math.floor(p.y / this.h), 0, this.ny - 1) * this.nx] = 1;
    }
    for (let k = 0; k < this.u.length; k++) if (this.wu[k]) this.u[k] /= this.wu[k];
    for (let k = 0; k < this.v.length; k++) if (this.wv[k]) this.v[k] /= this.wv[k];
    this.extrapolate(this.u, this.wu, this.nx + 1, this.ny); this.extrapolate(this.v, this.wv, this.nx, this.ny + 1);
    this.oldU.set(this.u); this.oldV.set(this.v);
  }
  invMass(i: number) { return this.settings.pinned && i >= (this.rows - 1) * this.cols ? 0 : 1 / this.nodeMass; }
  solidStep(dt: number) {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]; n.ox = n.x; n.oy = n.y;
      if (!this.invMass(i)) { n.x = n.restX; n.y = n.restY; n.vx = 0; n.vy = 0; continue; }
      n.vy -= this.settings.gravity * dt;
      n.vx *= Math.exp(-.3 * dt); n.vy *= Math.exp(-.3 * dt);
      if (this.pointer?.solid) { const dx = this.pointer.x - n.x, dy = this.pointer.y - n.y; n.vx += dx * 65 * dt; n.vy += dy * 65 * dt; }
      n.x += n.vx * dt; n.y += n.vy * dt;
    }
    // XPBD compliance is scaled by dt², unlike iteration-dependent PBD stiffness.
    const compliance = 10 ** (-2 - this.settings.stiffness * 5), alpha = compliance / (dt * dt);
    for (const s of this.springs) s.lambda = 0;
    for (let it = 0; it < 12; it++) {
      for (const s of this.springs) {
        const a = this.nodes[s.a], b = this.nodes[s.b], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const wa = this.invMass(s.a), wb = this.invMass(s.b); if (len < 1e-9 || wa + wb === 0) continue;
        const dl = (-(len - s.rest) - alpha * s.lambda) / (wa + wb + alpha); s.lambda += dl;
        a.x -= wa * dl * dx / len; a.y -= wa * dl * dy / len; b.x += wb * dl * dx / len; b.y += wb * dl * dy / len;
      }
      for (let i = 0; i < this.nodes.length; i++) if (this.invMass(i)) { const n = this.nodes[i]; n.x = clamp(n.x, this.h, this.width - this.h); n.y = clamp(n.y, this.h, this.height - this.h); }
    }
    for (const n of this.nodes) { n.vx = (n.x - n.ox) / dt; n.vy = (n.y - n.oy) / dt; }
    this.updateBounds();
  }
  markBoundaries() {
    const { nx, ny, h } = this; this.boundaries = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (this.inside((i + .5) * h, (j + .5) * h)) this.type[i + j * nx] = 2;
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const left = i - 1 + j * nx, right = i + j * nx;
      if (this.type[left] !== 2 && this.type[right] !== 2) continue;
      const near = this.nearest(i * h, (j + .5) * h), a = this.nodes[near.a], b = this.nodes[near.b], index = i + j * (nx + 1);
      this.u[index] = a.vx * (1 - near.t) + b.vx * near.t;
      if (this.type[left] === 1 || this.type[right] === 1) this.boundaries.push({ axis: 0, index, left, right, ...near });
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const left = i + (j - 1) * nx, right = i + j * nx;
      if (this.type[left] !== 2 && this.type[right] !== 2) continue;
      const near = this.nearest((i + .5) * h, j * h), a = this.nodes[near.a], b = this.nodes[near.b], index = i + j * nx;
      this.v[index] = a.vy * (1 - near.t) + b.vy * near.t;
      if (this.type[left] === 1 || this.type[right] === 1) this.boundaries.push({ axis: 1, index, left, right, ...near });
    }
    for (let j = 0; j < ny; j++) { this.u[j * (nx + 1)] = 0; this.u[nx + j * (nx + 1)] = 0; }
    for (let i = 0; i < nx; i++) { this.v[i] = 0; this.v[i + ny * nx] = 0; }
  }
  project() {
    const { nx, ny, h, type, q, rhs, u, v } = this; q.fill(0); rhs.fill(0);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = i + j * nx; if (type[k] !== 1) continue;
      rhs[k] = -h * (u[i + 1 + j * (nx + 1)] - u[i + j * (nx + 1)] + v[i + (j + 1) * nx] - v[i + j * nx]);
    }
    // Red-black Gauss-Seidel. Solid/domain neighbours contribute no diagonal;
    // air contributes a diagonal but q_air=0 (free-surface Dirichlet condition).
    let residual = 0;
    for (let it = 0; it < this.settings.iterations; it++) for (let color = 0; color < 2; color++) {
      for (let j = 0; j < ny; j++) for (let i = (j + color) % 2; i < nx; i += 2) {
        const k = i + j * nx; if (type[k] !== 1) continue;
        let sum = 0, diag = 0;
        if (i > 0 && type[k - 1] !== 2) { sum += q[k - 1]; diag++; }
        if (i < nx - 1 && type[k + 1] !== 2) { sum += q[k + 1]; diag++; }
        if (j > 0 && type[k - nx] !== 2) { sum += q[k - nx]; diag++; }
        if (j < ny - 1 && type[k + nx] !== 2) { sum += q[k + nx]; diag++; }
        if (diag) q[k] = (rhs[k] + sum) / diag;
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const a = i - 1 + j * nx, b = a + 1;
      if (type[a] !== 2 && type[b] !== 2 && (type[a] === 1 || type[b] === 1)) u[i + j * (nx + 1)] += (q[a] - q[b]) / h;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = i + (j - 1) * nx, b = a + nx;
      if (type[a] !== 2 && type[b] !== 2 && (type[a] === 1 || type[b] === 1)) v[i + j * nx] += (q[a] - q[b]) / h;
    }
    let div = 0, cells = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (type[i + j * nx] === 1) {
      const d = (u[i + 1 + j * (nx + 1)] - u[i + j * (nx + 1)] + v[i + (j + 1) * nx] - v[i + j * nx]) / h;
      div += d * d; residual = Math.max(residual, Math.abs(d) * h * h); cells++;
    }
    this.diagnostics.divergence = Math.sqrt(div / Math.max(1, cells)); this.diagnostics.residual = residual;
    // Pressure traction: J = (p*dt/rho)*rho*faceLength. Unit fluid density.
    // The same face pressure that changes fluid momentum drives the solid.
    if (this.settings.coupled) for (const face of this.boundaries) {
      const impulse = (type[face.left] === 1 ? q[face.left] : -q[face.right]) * h;
      const a = this.nodes[face.a], b = this.nodes[face.b];
      if (face.axis === 0) { a.vx += impulse * (1 - face.t) * this.invMass(face.a); b.vx += impulse * face.t * this.invMass(face.b); }
      else { a.vy += impulse * (1 - face.t) * this.invMass(face.a); b.vy += impulse * face.t * this.invMass(face.b); }
    }
  }
  collide(p: Particle, mass: number) {
    const r = this.h * .14, b = this.bounds;
    if (p.x > b.minX - r && p.x < b.maxX + r && p.y > b.minY - r && p.y < b.maxY + r) {
      const inside = this.inside(p.x, p.y), near = this.nearest(p.x, p.y);
      if (inside || near.dist < r) {
        const a = this.nodes[near.a], c = this.nodes[near.b], ex = c.x - a.x, ey = c.y - a.y, length = Math.hypot(ex, ey) || 1;
        // Outline is counter-clockwise: right-hand edge normal points outwards.
        const nx = ey / length, ny = -ex / length;
        p.x = near.x + nx * r; p.y = near.y + ny * r;
        const sx = a.vx * (1 - near.t) + c.vx * near.t, sy = a.vy * (1 - near.t) + c.vy * near.t;
        const vn = (p.vx - sx) * nx + (p.vy - sy) * ny;
        if (vn < 0) {
          const wa = this.settings.coupled ? this.invMass(near.a) : 0, wb = this.settings.coupled ? this.invMass(near.b) : 0;
          const J = -vn / (1 / mass + (1 - near.t) ** 2 * wa + near.t ** 2 * wb);
          p.vx += J * nx / mass; p.vy += J * ny / mass;
          a.vx -= J * nx * (1 - near.t) * wa; a.vy -= J * ny * (1 - near.t) * wa;
          c.vx -= J * nx * near.t * wb; c.vy -= J * ny * near.t * wb;
          // Modest contact drag, limited by the normal impulse. This is a
          // dissipative tangential contact model, not a viscous stress solve.
          const tx = -ny, ty = nx;
          const slip = (p.vx - a.vx * (1 - near.t) - c.vx * near.t) * tx + (p.vy - a.vy * (1 - near.t) - c.vy * near.t) * ty;
          const jt = clamp(-slip / (1 / mass + (1 - near.t) ** 2 * wa + near.t ** 2 * wb), -.08 * J, .08 * J);
          p.vx += jt * tx / mass; p.vy += jt * ty / mass;
          a.vx -= jt * tx * (1 - near.t) * wa; a.vy -= jt * ty * (1 - near.t) * wa;
          c.vx -= jt * tx * near.t * wb; c.vy -= jt * ty * near.t * wb;
          const balance = J - J * (1 - near.t) - J * near.t;
          this.diagnostics.exchangeError = Math.max(this.diagnostics.exchangeError, Math.abs(balance));
        }
      }
    }
    if (p.x < r) { p.x = r; p.vx = Math.max(0, p.vx); }
    if (p.x > this.width - r) { p.x = this.width - r; p.vx = Math.min(0, p.vx); }
    if (p.y < r) { p.y = r; p.vy = Math.max(0, p.vy); }
    if (p.y > this.height - r) { p.y = this.height - r; p.vy = Math.min(0, p.vy); }
  }
  advance(frameDt = 1 / 60) {
    const start = performance.now(); let remaining = Math.min(frameDt, 1 / 30), steps = 0, maxCfl = 0;
    const pm = this.particleMass;
    while (remaining > 1e-7 && steps < 24) {
      let speed = 0; for (const p of this.particles) speed = Math.max(speed, Math.hypot(p.vx, p.vy));
      for (const n of this.nodes) speed = Math.max(speed, Math.hypot(n.vx, n.vy));
      // Half-cell CFL including gravitational acceleration. Overload slows time
      // instead of increasing dt; no unstable frame-time catch-up.
      const dt = Math.min(remaining, frameDt / this.settings.substeps, .45 * this.h / (speed + Math.sqrt(this.settings.gravity * this.h) + 1e-3));
      this.solidStep(dt); for (const p of this.particles) this.collide(p, pm);
      this.p2g();
      const damp = Math.exp(-this.settings.viscosity * dt);
      for (let k = 0; k < this.u.length; k++) this.u[k] *= damp;
      for (let k = 0; k < this.v.length; k++) this.v[k] = this.v[k] * damp - this.settings.gravity * dt;
      this.markBoundaries(); this.project();
      for (const p of this.particles) {
        const pu = this.sample(this.u, p.x, p.y, 0), pv = this.sample(this.v, p.x, p.y, 1);
        const du = pu - this.sample(this.oldU, p.x, p.y, 0), dv = pv - this.sample(this.oldV, p.x, p.y, 1), f = this.settings.flip;
        // 5% PIC damps high-frequency FLIP noise; no velocity clamping.
        p.vx = (1 - f) * pu + f * (p.vx + du); p.vy = (1 - f) * pv + f * (p.vy + dv);
        if (this.pointer && !this.pointer.solid) {
          const d = Math.hypot(p.x - this.pointer.x, p.y - this.pointer.y), w = Math.max(0, 1 - d / 1.05);
          p.vx += (this.pointer.vx - p.vx) * w * Math.min(1, dt * 14); p.vy += (this.pointer.vy - p.vy) * w * Math.min(1, dt * 14);
        }
        p.x += p.vx * dt; p.y += p.vy * dt; this.collide(p, pm);
      }
      remaining -= dt; this.elapsed += dt; steps++; maxCfl = Math.max(maxCfl, speed * dt / this.h);
    }
    let energy = 0; for (const p of this.particles) energy += .5 * pm * (p.vx ** 2 + p.vy ** 2);
    this.diagnostics.energy = energy; this.diagnostics.cfl = maxCfl; this.diagnostics.steps = steps; this.diagnostics.time = performance.now() - start;
  }
  // Small deterministic checks, callable from the UI without changing the scene.
  static verify() {
    const A = [[3, -1, -1, 0], [-1, 3, 0, -1], [-1, 0, 3, -1], [0, -1, -1, 3]];
    const L = Array.from({ length: 4 }, () => [0, 0, 0, 0]); let spd = true;
    for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) {
      let value = A[i][j]; for (let k = 0; k < j; k++) value -= L[i][k] * L[j][k];
      if (i === j) { if (value <= 0) spd = false; L[i][j] = Math.sqrt(Math.max(0, value)); } else L[i][j] = value / L[j][j];
    }
    const J = 2.35, t = .37, error = Math.abs(J - (1 - t) * J - t * J);
    const sim = new FluidSolver('Drop test'); const count = sim.particles.length;
    for (let i = 0; i < 8; i++) sim.advance();
    const finite = sim.particles.every(p => Number.isFinite(p.x + p.y + p.vx + p.vy));
    const penetration = sim.particles.filter(p => sim.inside(p.x, p.y)).length;
    return [
      { label: 'Reference pressure matrix · Cholesky', pass: spd, value: spd ? 'SPD' : 'Failed' },
      { label: 'Contact impulse balance', pass: error < 1e-12, value: error.toExponential(1) },
      { label: 'Particle mass · 8-frame smoke test', pass: sim.particles.length === count, value: `${count} / ${sim.particles.length}` },
      { label: 'Finite state', pass: finite, value: finite ? 'All finite' : 'Failed' },
      { label: 'Final particle / solid overlap', pass: penetration === 0, value: `${penetration} particles` },
      { label: 'Last-step CFL', pass: sim.diagnostics.cfl <= .45, value: sim.diagnostics.cfl.toFixed(3) },
    ];
  }
}
