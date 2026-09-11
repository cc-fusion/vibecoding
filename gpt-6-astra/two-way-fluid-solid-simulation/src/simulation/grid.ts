import { SoftBody, type Contact } from './solid';
export const AIR = 0, FLUID = 1, SOLID = 2;
export interface Particles { count: number; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; mass: number }
type BoundaryFace = { axis: 'u' | 'v'; index: number; fluid: number; sign: number; contact: Contact };

export class MACGrid {
  nx: number; ny: number; h: number; rho = 1000;
  u: Float64Array; v: Float64Array; oldU: Float64Array; oldV: Float64Array;
  wu: Float64Array; wv: Float64Array; type: Uint8Array; pressure: Float64Array;
  diagonal: Float64Array; rhs: Float64Array; residual: Float64Array; direction: Float64Array; product: Float64Array; preconditioned: Float64Array;
  faces: BoundaryFace[] = []; iterations = 0; relativeResidual = 0; divergenceBefore = 0; divergenceAfter = 0;
  constructor(nx = 80, ny = 44, h = 0.125) {
    this.nx = nx; this.ny = ny; this.h = h;
    const n = nx * ny;
    this.u = new Float64Array((nx + 1) * ny); this.v = new Float64Array(nx * (ny + 1));
    this.oldU = this.u.slice(); this.oldV = this.v.slice(); this.wu = this.u.slice(); this.wv = this.v.slice();
    this.type = new Uint8Array(n); this.pressure = new Float64Array(n); this.diagonal = new Float64Array(n); this.rhs = new Float64Array(n);
    this.residual = new Float64Array(n); this.direction = new Float64Array(n); this.product = new Float64Array(n); this.preconditioned = new Float64Array(n);
  }
  private scatter(values: Float64Array, weights: Float64Array, width: number, height: number, x: number, y: number, value: number) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const xx = ix + i, yy = iy + j;
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), k = xx + yy * width;
      values[k] += w * value; weights[k] += w;
    }
  }
  sample(values: Float64Array, width: number, height: number, x: number, y: number) {
    x = Math.max(0, Math.min(width - 1.001, x)); y = Math.max(0, Math.min(height - 1.001, y));
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    return values[ix + iy * width] * (1 - fx) * (1 - fy) + values[ix + 1 + iy * width] * fx * (1 - fy) + values[ix + (iy + 1) * width] * (1 - fx) * fy + values[ix + 1 + (iy + 1) * width] * fx * fy;
  }
  velocity(x: number, y: number) { return { x: this.sample(this.u, this.nx + 1, this.ny, x / this.h, y / this.h - 0.5), y: this.sample(this.v, this.nx, this.ny + 1, x / this.h - 0.5, y / this.h) }; }
  private extrapolate(a: Float64Array, weights: Float64Array, w: number, h: number) {
    let valid = Uint8Array.from(weights, v => v > 0 ? 1 : 0);
    // Two layers suffice because adaptive CFL bounds advection below 0.4h.
    for (let pass = 0; pass < 2; pass++) {
      const next = valid.slice(), copy = a.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = x + y * w; if (valid[k]) continue;
        let sum = 0, count = 0;
        if (x > 0 && valid[k - 1]) { sum += a[k - 1]; count++; }
        if (x + 1 < w && valid[k + 1]) { sum += a[k + 1]; count++; }
        if (y > 0 && valid[k - w]) { sum += a[k - w]; count++; }
        if (y + 1 < h && valid[k + w]) { sum += a[k + w]; count++; }
        if (count) { copy[k] = sum / count; next[k] = 1; }
      }
      a.set(copy); valid = next;
    }
  }
  transfer(p: Particles, solid: SoftBody) {
    this.u.fill(0); this.v.fill(0); this.wu.fill(0); this.wv.fill(0); this.type.fill(AIR);
    const { nx, ny, h } = this;
    for (let k = 0; k < p.count; k++) {
      const x = p.x[k] / h, y = p.y[k] / h;
      this.scatter(this.u, this.wu, nx + 1, ny, x, y - 0.5, p.vx[k]);
      this.scatter(this.v, this.wv, nx, ny + 1, x - 0.5, y, p.vy[k]);
      const ix = Math.max(0, Math.min(nx - 1, Math.floor(x))), iy = Math.max(0, Math.min(ny - 1, Math.floor(y)));
      this.type[ix + iy * nx] = FLUID;
    }
    for (let k = 0; k < this.u.length; k++) if (this.wu[k]) this.u[k] /= this.wu[k];
    for (let k = 0; k < this.v.length; k++) if (this.wv[k]) this.v[k] /= this.wv[k];
    if (solid.enabled) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if (solid.contains((x + 0.5) * h, (y + 0.5) * h)) this.type[x + y * nx] = SOLID;
    this.extrapolate(this.u, this.wu, nx + 1, ny); this.extrapolate(this.v, this.wv, nx, ny + 1);
    this.oldU.set(this.u); this.oldV.set(this.v);
  }
  applyForces(dt: number, gravity: number) { for (let i = 0; i < this.v.length; i++) this.v[i] -= gravity * dt; }
  boundaries(solid: SoftBody) {
    const { nx, ny, h } = this; this.faces = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x <= nx; x++) {
      const k = x + y * (nx + 1);
      if (x === 0 || x === nx) { this.u[k] = 0; continue; }
      const l = x - 1 + y * nx, r = x + y * nx;
      if (this.type[l] === SOLID || this.type[r] === SOLID) {
        const c = solid.contact(x * h, (y + 0.5) * h); this.u[k] = solid.velocity(c).x;
        if (this.type[l] === FLUID) this.faces.push({ axis: 'u', index: k, fluid: l, sign: 1, contact: c });
        if (this.type[r] === FLUID) this.faces.push({ axis: 'u', index: k, fluid: r, sign: -1, contact: c });
      }
    }
    for (let y = 0; y <= ny; y++) for (let x = 0; x < nx; x++) {
      const k = x + y * nx;
      if (y === 0 || y === ny) { this.v[k] = 0; continue; }
      const b = x + (y - 1) * nx, t = x + y * nx;
      if (this.type[b] === SOLID || this.type[t] === SOLID) {
        const c = solid.contact((x + 0.5) * h, y * h); this.v[k] = solid.velocity(c).y;
        if (this.type[b] === FLUID) this.faces.push({ axis: 'v', index: k, fluid: b, sign: 1, contact: c });
        if (this.type[t] === FLUID) this.faces.push({ axis: 'v', index: k, fluid: t, sign: -1, contact: c });
      }
    }
  }
  divergence(k: number) {
    const x = k % this.nx, y = Math.floor(k / this.nx);
    return (this.u[x + 1 + y * (this.nx + 1)] - this.u[x + y * (this.nx + 1)] + this.v[x + (y + 1) * this.nx] - this.v[x + y * this.nx]) / this.h;
  }
  assemble(dt: number) {
    const { nx, ny } = this; this.diagonal.fill(0); this.rhs.fill(0); this.divergenceBefore = 0;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const k = x + y * nx; if (this.type[k] !== FLUID) continue;
      let d = 0;
      if (x > 0 && this.type[k - 1] !== SOLID) d++;
      if (x < nx - 1 && this.type[k + 1] !== SOLID) d++;
      if (y > 0 && this.type[k - nx] !== SOLID) d++;
      if (y < ny - 1 && this.type[k + nx] !== SOLID) d++;
      // Free surface: p_air = 0. Solid: Neumann with moving face velocities.
      // Tiny diagonal regularization fixes the gauge in isolated sealed pockets.
      this.diagonal[k] = d + 1e-8;
      const div = this.divergence(k);
      this.rhs[k] = -div * this.rho * this.h * this.h / dt;
      this.divergenceBefore = Math.max(this.divergenceBefore, Math.abs(div));
    }
  }
  multiply(a: Float64Array, out: Float64Array) {
    const { nx, ny } = this; out.fill(0);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const k = x + y * nx; if (this.type[k] !== FLUID) continue;
      let v = this.diagonal[k] * a[k];
      if (x > 0 && this.type[k - 1] === FLUID) v -= a[k - 1];
      if (x < nx - 1 && this.type[k + 1] === FLUID) v -= a[k + 1];
      if (y > 0 && this.type[k - nx] === FLUID) v -= a[k - nx];
      if (y < ny - 1 && this.type[k + nx] === FLUID) v -= a[k + nx];
      out[k] = v;
    }
  }
  solve(maxIterations = 60) {
    const { pressure: p, residual: r, direction: d, product: q, preconditioned: z, rhs: b } = this;
    p.fill(0); r.set(b); let rz = 0, norm = 0;
    for (let k = 0; k < p.length; k++) {
      z[k] = this.diagonal[k] ? r[k] / this.diagonal[k] : 0; d[k] = z[k]; rz += r[k] * z[k]; norm += b[k] * b[k];
    }
    this.iterations = 0; this.relativeResidual = norm > 0 ? 1 : 0;
    for (let it = 0; it < maxIterations && rz > 1e-20; it++) {
      this.multiply(d, q); let dq = 0;
      for (let k = 0; k < p.length; k++) dq += d[k] * q[k];
      if (dq <= 1e-25) break;
      const alpha = rz / dq; let rr = 0, nextRz = 0;
      for (let k = 0; k < p.length; k++) {
        p[k] += alpha * d[k]; r[k] -= alpha * q[k]; rr += r[k] * r[k];
        z[k] = this.diagonal[k] ? r[k] / this.diagonal[k] : 0; nextRz += r[k] * z[k];
      }
      this.iterations = it + 1; this.relativeResidual = Math.sqrt(rr / Math.max(norm, 1e-30));
      if (this.relativeResidual < 1e-4) break;
      const beta = nextRz / rz;
      for (let k = 0; k < p.length; k++) d[k] = z[k] + beta * d[k];
      rz = nextRz;
    }
  }
  project(dt: number, solid: SoftBody) {
    const { nx, ny, pressure: p, type, h } = this, scale = dt / (this.rho * h);
    for (let y = 0; y < ny; y++) for (let x = 1; x < nx; x++) {
      const l = x - 1 + y * nx, r = l + 1;
      if (type[l] !== SOLID && type[r] !== SOLID && (type[l] === FLUID || type[r] === FLUID)) this.u[x + y * (nx + 1)] -= scale * (p[r] - p[l]);
    }
    for (let y = 1; y < ny; y++) for (let x = 0; x < nx; x++) {
      const b = x + (y - 1) * nx, t = b + nx;
      if (type[b] !== SOLID && type[t] !== SOLID && (type[b] === FLUID || type[t] === FLUID)) this.v[x + y * nx] -= scale * (p[t] - p[b]);
    }
    // Reaction to pressure traction, integrated over a face of area h × unit depth.
    // The fluid projection uses that same face and its solid normal velocity.
    for (const face of this.faces) {
      const impulse = p[face.fluid] * h * dt * face.sign;
      solid.impulse(face.contact, face.axis === 'u' ? impulse : 0, face.axis === 'v' ? impulse : 0);
    }
    this.divergenceAfter = 0;
    for (let k = 0; k < type.length; k++) if (type[k] === FLUID) this.divergenceAfter = Math.max(this.divergenceAfter, Math.abs(this.divergence(k)));
  }
  gather(p: Particles, flip: number) {
    const { nx, ny, h } = this;
    for (let k = 0; k < p.count; k++) {
      const x = p.x[k] / h, y = p.y[k] / h;
      const u = this.sample(this.u, nx + 1, ny, x, y - 0.5), v = this.sample(this.v, nx, ny + 1, x - 0.5, y);
      const ou = this.sample(this.oldU, nx + 1, ny, x, y - 0.5), ov = this.sample(this.oldV, nx, ny + 1, x - 0.5, y);
      // 95% FLIP keeps momentum detail; 5% PIC damps unresolved grid noise.
      p.vx[k] = (1 - flip) * u + flip * (p.vx[k] + u - ou);
      p.vy[k] = (1 - flip) * v + flip * (p.vy[k] + v - ov);
    }
  }
}
