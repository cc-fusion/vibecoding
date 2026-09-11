// FLIP/PIC fluid solver on a staggered MAC grid, following Matthias Müller's "Ten Minute Physics" FLIP tutorial (#18).
// World is y-down; the grid has one ring of padding cells outside the world rectangle which are always solid.
// Grid cell (i, j) covers world x ∈ [(i-1)h, ih), y ∈ [(j-1)h, jh). Arrays are indexed i * numY + j.
// u[i,j] lives on the left face of cell (i,j); v[i,j] lives on the top face (smaller y).

export const CELL_FLUID = 0, CELL_AIR = 1, CELL_SOLID = 2;

export interface FluidParams {
  flipRatio: number; pressureIters: number; separationIters: number; separationStrength: number;
  overRelaxation: number; density: number; driftCompensation: boolean; driftStiffness: number;
}

export interface FluidHooks {
  /** Called after particle advection & world clamping: collide particles against rigid/soft geometry. */
  collide?: (fluid: FlipFluid, dt: number) => void;
  /** Called after pressure projection: read fluid.p to apply pressure forces. */
  afterProjection?: (fluid: FlipFluid, dt: number) => void;
}

export class FlipFluid {
  readonly width: number; readonly height: number;
  readonly h: number; readonly invH: number;
  readonly numX: number; readonly numY: number; readonly numCells: number;
  readonly particleRadius: number;
  readonly maxParticles: number;
  numParticles = 0;

  // grid
  readonly u: Float32Array; readonly v: Float32Array; readonly du: Float32Array; readonly dv: Float32Array;
  readonly prevU: Float32Array; readonly prevV: Float32Array;
  readonly p: Float32Array;
  readonly s: Float32Array;        // 0 = solid, 1 = free (per-step, includes bodies)
  readonly sStatic: Float32Array;  // world boundary solids
  readonly solidU: Float32Array; readonly solidV: Float32Array; // face velocities of solids (moving boundaries)
  readonly cellOwner: Int32Array;  // rigid body slot owning a solid cell, -1 otherwise
  readonly cellType: Int32Array;
  readonly particleDensity: Float32Array;
  readonly restDensity: number;

  // particles
  readonly pos: Float32Array; readonly vel: Float32Array;

  // spatial hash for separation and neighbour queries
  readonly pInvSpacing: number; readonly pNumX: number; readonly pNumY: number; readonly pNumCells: number;
  readonly numCellParticles: Int32Array; readonly firstCellParticle: Int32Array; readonly cellParticleIds: Int32Array;

  particleMass: number; // fluid density (mass/area) × area per particle
  hooks: FluidHooks = {};
  maxSpeed: number;

  constructor(width: number, height: number, cellSize: number, radiusFactor: number, maxParticles: number, density: number) {
    this.width = width; this.height = height;
    this.h = cellSize; this.invH = 1 / cellSize;
    this.numX = Math.ceil(width / cellSize) + 2;
    this.numY = Math.ceil(height / cellSize) + 2;
    this.numCells = this.numX * this.numY;
    this.particleRadius = radiusFactor * cellSize;
    this.maxParticles = maxParticles;
    const n = this.numCells;
    this.u = new Float32Array(n); this.v = new Float32Array(n); this.du = new Float32Array(n); this.dv = new Float32Array(n);
    this.prevU = new Float32Array(n); this.prevV = new Float32Array(n); this.p = new Float32Array(n);
    this.s = new Float32Array(n); this.sStatic = new Float32Array(n);
    this.solidU = new Float32Array(n); this.solidV = new Float32Array(n);
    this.cellOwner = new Int32Array(n); this.cellType = new Int32Array(n); this.particleDensity = new Float32Array(n);
    this.pos = new Float32Array(2 * maxParticles); this.vel = new Float32Array(2 * maxParticles);
    this.pInvSpacing = 1 / (2.2 * this.particleRadius);
    this.pNumX = Math.floor((width + 2 * cellSize) * this.pInvSpacing) + 1;
    this.pNumY = Math.floor((height + 2 * cellSize) * this.pInvSpacing) + 1;
    this.pNumCells = this.pNumX * this.pNumY;
    this.numCellParticles = new Int32Array(this.pNumCells);
    this.firstCellParticle = new Int32Array(this.pNumCells + 1);
    this.cellParticleIds = new Int32Array(maxParticles);
    // Each particle nominally occupies a (2r)² area; bilinear density weights sum to 1 per particle so rest density
    // in "particles per cell" is h² / (2r)².
    this.restDensity = (cellSize * cellSize) / (4 * this.particleRadius * this.particleRadius);
    this.particleMass = density * 0.001 * 4 * this.particleRadius * this.particleRadius;
    this.maxSpeed = 3000;
    // static solids: cells whose centre is outside the world rectangle
    for (let i = 0; i < this.numX; i++) {
      for (let j = 0; j < this.numY; j++) {
        const cx = (i - 1 + 0.5) * cellSize, cy = (j - 1 + 0.5) * cellSize;
        const solid = cx < 0 || cx > width || cy < 0 || cy > height;
        this.sStatic[i * this.numY + j] = solid ? 0 : 1;
      }
    }
    this.s.set(this.sStatic);
    this.cellOwner.fill(-1);
  }

  setDensity(density: number) { this.particleMass = density * 0.001 * 4 * this.particleRadius * this.particleRadius; }

  addParticle(x: number, y: number, vx = 0, vy = 0): boolean {
    if (this.numParticles >= this.maxParticles) return false;
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(vx) && Number.isFinite(vy))) return false;
    const i = this.numParticles++;
    this.pos[2 * i] = x; this.pos[2 * i + 1] = y; this.vel[2 * i] = vx; this.vel[2 * i + 1] = vy;
    return true;
  }

  removeParticle(i: number) {
    const last = --this.numParticles;
    this.pos[2 * i] = this.pos[2 * last]; this.pos[2 * i + 1] = this.pos[2 * last + 1];
    this.vel[2 * i] = this.vel[2 * last]; this.vel[2 * i + 1] = this.vel[2 * last + 1];
  }

  clearParticles() {
    this.numParticles = 0;
    this.u.fill(0); this.v.fill(0); this.prevU.fill(0); this.prevV.fill(0); this.p.fill(0); this.particleDensity.fill(0);
    for (let i = 0; i < this.numCells; i++) this.cellType[i] = this.s[i] === 0 ? CELL_SOLID : CELL_AIR;
  }

  /** Fill a rectangle with particles on a 2r lattice (skipping cells that are solid). */
  fillRect(x0: number, y0: number, w: number, h: number): number {
    const d = 2 * this.particleRadius;
    const r = this.particleRadius;
    let added = 0;
    const xs = Math.max(x0, r), ys = Math.max(y0, r), xe = Math.min(x0 + w, this.width - r), ye = Math.min(y0 + h, this.height - r);
    for (let y = ys + r; y <= ye; y += d) {
      for (let x = xs + r; x <= xe; x += d) {
        const px = x + (Math.random() - 0.5) * 0.2 * r, py = y + (Math.random() - 0.5) * 0.2 * r;
        const ci = this.cellIndex(px, py);
        if (this.s[ci] === 0) continue;
        if (!this.addParticle(px, py)) return added;
        added++;
      }
    }
    return added;
  }

  cellIndex(x: number, y: number): number {
    const xi = Math.min(Math.max(Math.floor((x + this.h) * this.invH), 0), this.numX - 1);
    const yi = Math.min(Math.max(Math.floor((y + this.h) * this.invH), 0), this.numY - 1);
    return xi * this.numY + yi;
  }

  simulate(dt: number, gx: number, gy: number, params: FluidParams, substeps: number) {
    const sdt = dt / substeps;
    for (let step = 0; step < substeps; step++) {
      this.integrateParticles(sdt, gx, gy);
      this.buildHash();
      if (params.separationIters > 0) this.pushParticlesApart(params.separationIters, params.separationStrength);
      this.handleWorldCollisions();
      this.hooks.collide?.(this, sdt);
      this.transferVelocities(true, 0);
      this.updateParticleDensity();
      this.solveIncompressibility(params.pressureIters, sdt, params.overRelaxation, params.density, params.driftCompensation, params.driftStiffness);
      this.hooks.afterProjection?.(this, sdt);
      this.transferVelocities(false, params.flipRatio);
    }
  }

  // ---- particles ----
  integrateParticles(dt: number, gx: number, gy: number) {
    const pos = this.pos, vel = this.vel, maxV = this.maxSpeed, maxV2 = maxV * maxV;
    for (let i = 0; i < this.numParticles; i++) {
      let vx = vel[2 * i] + dt * gx, vy = vel[2 * i + 1] + dt * gy;
      const v2 = vx * vx + vy * vy;
      if (!(v2 < maxV2)) { // also catches NaN
        if (v2 !== v2) { vx = 0; vy = 0; } else { const k = maxV / Math.sqrt(v2); vx *= k; vy *= k; }
      }
      vel[2 * i] = vx; vel[2 * i + 1] = vy;
      pos[2 * i] += vx * dt; pos[2 * i + 1] += vy * dt;
    }
  }

  buildHash() {
    const n = this.numParticles, pos = this.pos, inv = this.pInvSpacing, h = this.h;
    this.numCellParticles.fill(0);
    for (let i = 0; i < n; i++) {
      const xi = Math.min(Math.max(Math.floor((pos[2 * i] + h) * inv), 0), this.pNumX - 1);
      const yi = Math.min(Math.max(Math.floor((pos[2 * i + 1] + h) * inv), 0), this.pNumY - 1);
      this.numCellParticles[xi * this.pNumY + yi]++;
    }
    let first = 0;
    for (let i = 0; i < this.pNumCells; i++) { first += this.numCellParticles[i]; this.firstCellParticle[i] = first; }
    this.firstCellParticle[this.pNumCells] = first;
    for (let i = 0; i < n; i++) {
      const xi = Math.min(Math.max(Math.floor((pos[2 * i] + h) * inv), 0), this.pNumX - 1);
      const yi = Math.min(Math.max(Math.floor((pos[2 * i + 1] + h) * inv), 0), this.pNumY - 1);
      const c = xi * this.pNumY + yi;
      this.firstCellParticle[c]--;
      this.cellParticleIds[this.firstCellParticle[c]] = i;
    }
  }

  pushParticlesApart(numIters: number, strength: number) {
    const minDist = 2 * this.particleRadius, minDist2 = minDist * minDist;
    const pos = this.pos, inv = this.pInvSpacing, h = this.h, pNumY = this.pNumY;
    const k = 0.5 * Math.min(Math.max(strength, 0), 2);
    for (let iter = 0; iter < numIters; iter++) {
      for (let i = 0; i < this.numParticles; i++) {
        const px = pos[2 * i], py = pos[2 * i + 1];
        const pxi = Math.floor((px + h) * inv), pyi = Math.floor((py + h) * inv);
        const x0 = Math.max(pxi - 1, 0), y0 = Math.max(pyi - 1, 0);
        const x1 = Math.min(pxi + 1, this.pNumX - 1), y1 = Math.min(pyi + 1, pNumY - 1);
        for (let xi = x0; xi <= x1; xi++) {
          for (let yi = y0; yi <= y1; yi++) {
            const c = xi * pNumY + yi;
            const first = this.firstCellParticle[c], last = this.firstCellParticle[c + 1];
            for (let j = first; j < last; j++) {
              const id = this.cellParticleIds[j];
              if (id === i) continue;
              const qx = pos[2 * id], qy = pos[2 * id + 1];
              let dx = qx - px, dy = qy - py;
              const d2 = dx * dx + dy * dy;
              if (d2 > minDist2 || d2 === 0) continue;
              const d = Math.sqrt(d2);
              const s = k * (minDist - d) / d;
              dx *= s; dy *= s;
              pos[2 * i] -= dx; pos[2 * i + 1] -= dy;
              pos[2 * id] += dx; pos[2 * id + 1] += dy;
            }
          }
        }
      }
    }
  }

  handleWorldCollisions() {
    const r = this.particleRadius, minX = r, maxX = this.width - r, minY = r, maxY = this.height - r;
    const pos = this.pos, vel = this.vel;
    for (let i = 0; i < this.numParticles; i++) {
      let x = pos[2 * i], y = pos[2 * i + 1];
      if (!(x === x && y === y)) { this.removeParticle(i); i--; continue; }
      if (x < minX) { x = minX; if (vel[2 * i] < 0) vel[2 * i] = 0; }
      if (x > maxX) { x = maxX; if (vel[2 * i] > 0) vel[2 * i] = 0; }
      if (y < minY) { y = minY; if (vel[2 * i + 1] < 0) vel[2 * i + 1] = 0; }
      if (y > maxY) { y = maxY; if (vel[2 * i + 1] > 0) vel[2 * i + 1] = 0; }
      pos[2 * i] = x; pos[2 * i + 1] = y;
    }
  }

  // ---- grid transfer ----
  updateParticleDensity() {
    const n = this.numY, h = this.h, h1 = this.invH, h2 = 0.5 * h, d = this.particleDensity;
    d.fill(0);
    for (let i = 0; i < this.numParticles; i++) {
      let x = this.pos[2 * i] + h, y = this.pos[2 * i + 1] + h;
      x = Math.min(Math.max(x, h), (this.numX - 1) * h); y = Math.min(Math.max(y, h), (this.numY - 1) * h);
      const x0 = Math.floor((x - h2) * h1), tx = (x - h2 - x0 * h) * h1, x1 = Math.min(x0 + 1, this.numX - 2);
      const y0 = Math.floor((y - h2) * h1), ty = (y - h2 - y0 * h) * h1, y1 = Math.min(y0 + 1, this.numY - 2);
      const sx = 1 - tx, sy = 1 - ty;
      if (x0 < this.numX && y0 < this.numY) d[x0 * n + y0] += sx * sy;
      if (x1 < this.numX && y0 < this.numY) d[x1 * n + y0] += tx * sy;
      if (x1 < this.numX && y1 < this.numY) d[x1 * n + y1] += tx * ty;
      if (x0 < this.numX && y1 < this.numY) d[x0 * n + y1] += sx * ty;
    }
  }

  transferVelocities(toGrid: boolean, flipRatio: number) {
    const n = this.numY, h = this.h, h1 = this.invH, h2 = 0.5 * h;
    const numX = this.numX, numY = this.numY, cellType = this.cellType;
    if (toGrid) {
      this.prevU.set(this.u); this.prevV.set(this.v);
      this.du.fill(0); this.dv.fill(0); this.u.fill(0); this.v.fill(0);
      for (let i = 0; i < this.numCells; i++) cellType[i] = this.s[i] === 0 ? CELL_SOLID : CELL_AIR;
      for (let i = 0; i < this.numParticles; i++) {
        const xi = Math.min(Math.max(Math.floor((this.pos[2 * i] + h) * h1), 0), numX - 1);
        const yi = Math.min(Math.max(Math.floor((this.pos[2 * i + 1] + h) * h1), 0), numY - 1);
        const c = xi * n + yi;
        if (cellType[c] === CELL_AIR) cellType[c] = CELL_FLUID;
      }
    }
    for (let component = 0; component < 2; component++) {
      const dx = component === 0 ? 0 : h2, dy = component === 0 ? h2 : 0;
      const f = component === 0 ? this.u : this.v;
      const prevF = component === 0 ? this.prevU : this.prevV;
      const d = component === 0 ? this.du : this.dv;
      const offset = component === 0 ? n : 1;
      for (let i = 0; i < this.numParticles; i++) {
        let x = this.pos[2 * i] + h, y = this.pos[2 * i + 1] + h;
        x = Math.min(Math.max(x, h), (numX - 1) * h); y = Math.min(Math.max(y, h), (numY - 1) * h);
        const x0 = Math.min(Math.floor((x - dx) * h1), numX - 2), tx = (x - dx - x0 * h) * h1, x1 = Math.min(x0 + 1, numX - 2);
        const y0 = Math.min(Math.floor((y - dy) * h1), numY - 2), ty = (y - dy - y0 * h) * h1, y1 = Math.min(y0 + 1, numY - 2);
        const sx = 1 - tx, sy = 1 - ty;
        const d0 = sx * sy, d1 = tx * sy, d2 = tx * ty, d3 = sx * ty;
        const nr0 = x0 * n + y0, nr1 = x1 * n + y0, nr2 = x1 * n + y1, nr3 = x0 * n + y1;
        if (toGrid) {
          const pv = this.vel[2 * i + component];
          f[nr0] += pv * d0; d[nr0] += d0;
          f[nr1] += pv * d1; d[nr1] += d1;
          f[nr2] += pv * d2; d[nr2] += d2;
          f[nr3] += pv * d3; d[nr3] += d3;
        } else {
          const valid0 = cellType[nr0] !== CELL_AIR || cellType[nr0 - offset] !== CELL_AIR ? 1 : 0;
          const valid1 = cellType[nr1] !== CELL_AIR || cellType[nr1 - offset] !== CELL_AIR ? 1 : 0;
          const valid2 = cellType[nr2] !== CELL_AIR || cellType[nr2 - offset] !== CELL_AIR ? 1 : 0;
          const valid3 = cellType[nr3] !== CELL_AIR || cellType[nr3 - offset] !== CELL_AIR ? 1 : 0;
          const v = this.vel[2 * i + component];
          const wsum = valid0 * d0 + valid1 * d1 + valid2 * d2 + valid3 * d3;
          if (wsum > 0) {
            // PIC: interpolate the new grid velocity. FLIP: add the interpolated grid velocity *change* to the particle.
            const picV = (valid0 * d0 * f[nr0] + valid1 * d1 * f[nr1] + valid2 * d2 * f[nr2] + valid3 * d3 * f[nr3]) / wsum;
            const corr = (valid0 * d0 * (f[nr0] - prevF[nr0]) + valid1 * d1 * (f[nr1] - prevF[nr1]) + valid2 * d2 * (f[nr2] - prevF[nr2]) + valid3 * d3 * (f[nr3] - prevF[nr3])) / wsum;
            const flipV = v + corr;
            this.vel[2 * i + component] = flipRatio * flipV + (1 - flipRatio) * picV;
          }
        }
      }
    }
    if (toGrid) {
      const u = this.u, v = this.v, du = this.du, dv = this.dv;
      for (let i = 0; i < this.numCells; i++) {
        if (du[i] > 0) u[i] /= du[i];
        if (dv[i] > 0) v[i] /= dv[i];
      }
      // Faces touching solid cells take the solid's velocity (static walls: 0, moving bodies: their surface velocity).
      for (let i = 0; i < numX; i++) {
        for (let j = 0; j < numY; j++) {
          const c = i * n + j;
          const solid = cellType[c] === CELL_SOLID;
          if (solid || (i > 0 && cellType[c - n] === CELL_SOLID)) u[c] = solid ? this.solidU[c] : this.solidU[c - n];
          if (solid || (j > 0 && cellType[c - 1] === CELL_SOLID)) v[c] = solid ? this.solidV[c] : this.solidV[c - 1];
        }
      }
    }
  }

  solveIncompressibility(numIters: number, dt: number, overRelaxation: number, density: number, compensateDrift: boolean, driftK: number) {
    this.p.fill(0);
    this.prevU.set(this.u); this.prevV.set(this.v); // store pre-projection velocities for FLIP deltas
    const n = this.numY, cp = density * 0.001 * this.h / dt;
    const u = this.u, v = this.v, s = this.s, cellType = this.cellType, p = this.p, pd = this.particleDensity, rest = this.restDensity;
    for (let iter = 0; iter < numIters; iter++) {
      for (let i = 1; i < this.numX - 1; i++) {
        for (let j = 1; j < this.numY - 1; j++) {
          const c = i * n + j;
          if (cellType[c] !== CELL_FLUID) continue;
          const left = c - n, right = c + n, top = c - 1, bottom = c + 1;
          const sx0 = s[left], sx1 = s[right], sy0 = s[top], sy1 = s[bottom];
          const sum = sx0 + sx1 + sy0 + sy1;
          if (sum === 0) continue;
          let div = u[right] - u[c] + v[bottom] - v[c];
          if (compensateDrift) {
            // Drift/density correction: over-dense cells get an artificial positive divergence so they expand.
            const compression = pd[c] - rest;
            if (compression > 0) div -= driftK * compression;
          }
          let pr = -div / sum;
          pr *= overRelaxation;
          p[c] += cp * pr;
          u[c] -= sx0 * pr; u[right] += sx1 * pr;
          v[c] -= sy0 * pr; v[bottom] += sy1 * pr;
        }
      }
    }
  }

  /** Bilinear sample of grid velocity at a world position (for drag on soft bodies etc). */
  sampleVelocity(x: number, y: number, out: Float32Array) {
    const n = this.numY, h = this.h, h1 = this.invH, h2 = 0.5 * h;
    let gx = x + h, gy = y + h;
    gx = Math.min(Math.max(gx, h), (this.numX - 1) * h); gy = Math.min(Math.max(gy, h), (this.numY - 1) * h);
    for (let component = 0; component < 2; component++) {
      const dx = component === 0 ? 0 : h2, dy = component === 0 ? h2 : 0;
      const f = component === 0 ? this.u : this.v;
      const x0 = Math.min(Math.floor((gx - dx) * h1), this.numX - 2), tx = (gx - dx - x0 * h) * h1, x1 = Math.min(x0 + 1, this.numX - 2);
      const y0 = Math.min(Math.floor((gy - dy) * h1), this.numY - 2), ty = (gy - dy - y0 * h) * h1, y1 = Math.min(y0 + 1, this.numY - 2);
      const sx = 1 - tx, sy = 1 - ty;
      out[component] = sx * sy * f[x0 * n + y0] + tx * sy * f[x1 * n + y0] + tx * ty * f[x1 * n + y1] + sx * ty * f[x0 * n + y1];
    }
  }

  /** Local fluid fraction (0..1+) at a world position from the particle density grid. */
  sampleDensity(x: number, y: number): number {
    const c = this.cellIndex(x, y);
    return this.particleDensity[c] / this.restDensity;
  }

  isFinite(): boolean {
    for (let i = 0; i < 2 * this.numParticles; i++) if (!Number.isFinite(this.pos[i]) || !Number.isFinite(this.vel[i])) return false;
    return true;
  }
}
