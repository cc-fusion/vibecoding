/*!
 * mls-mpm.js v1.0.0 - high-performance 2D MLS-MPM in vanilla JavaScript
 *
 * A close, optimized port of mls-mpm88.cpp from taichi_mpm:
 *   https://github.com/yuanming-hu/taichi_mpm
 * "A Moving Least Squares Material Point Method with Displacement Discontinuity
 *  and Two-Way Rigid Body Coupling" (SIGGRAPH 2018) by Yuanming Hu, Yu Fang,
 *  Ziheng Ge, Ziyin Qu, Yixin Zhu, Andre Pradhana and Chenfanfu Jiang.
 * Original 88-line C++ code by Yuanming Hu (MIT License). This port: MIT License.
 *
 * Load it with a script tag (src="mls-mpm.js"); it defines one global, MLSMPM:
 *
 *   const sim = new MLSMPM();                  // same constants as the C++ code
 *   sim.add_object([0.55, 0.45], 0xED553B);    // 1000 particles in a square
 *   function frame() {
 *     sim.advance_frame();                     // frame_dt / dt calls of advance(dt)
 *     sim.render(canvas);                      // draw into a canvas element
 *     requestAnimationFrame(frame);
 *   }
 *   frame();
 *
 * Also works as a CommonJS module and in Web Workers (only render() needs a canvas).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MLSMPM = factory();
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const SNOW = 0, JELLY = 1, WATER = 2;                            // particle materials
  const MATERIALS = { snow: SNOW, jelly: JELLY, water: WATER };

  // Scratch storage: advance() never allocates, so it never triggers the GC.
  const wx = new Float64Array(3), wy = new Float64Array(3);        // B-spline weights
  const tF = new Float64Array(4), tU = new Float64Array(4), tV = new Float64Array(4);
  const tSig = new Float64Array(2);

  // ---------------------------------------------------------------------------
  // 2x2 linear algebra in closed form (the same formulas as taichi.h).
  // Matrices are row-major arrays [m00, m01, m10, m11].
  // ---------------------------------------------------------------------------

  // Polar decomposition M = R S (R: rotation, S: symmetric).
  function polar_decomp(m, R, S) {
    const x = m[0] + m[3], y = m[2] - m[1];
    const scale = Math.sqrt(x * x + y * y);
    const c = scale > 0 ? x / scale : 1, s = scale > 0 ? y / scale : 0;
    R[0] = c; R[1] = -s; R[2] = s; R[3] = c;
    S[0] = c * m[0] + s * m[2]; S[1] = c * m[1] + s * m[3];          // S = R^T M
    S[2] = c * m[2] - s * m[0]; S[3] = c * m[3] - s * m[1];
  }

  // SVD M = U diag(sig) V^T with rotations U, V and sig[0] >= sig[1]
  // (sig[1] < 0 when M is inverted): polar decomposition + one Jacobi rotation.
  function svd(m, U, sig, V) {
    const x = m[0] + m[3], y = m[2] - m[1];
    const scale = Math.sqrt(x * x + y * y);
    const qc = scale > 0 ? x / scale : 1, qs = scale > 0 ? y / scale : 0;
    const s00 = qc * m[0] + qs * m[2], s01 = qc * m[1] + qs * m[3];  // S = Q^T M
    const s11 = qc * m[3] - qs * m[1];
    let c = 1, s = 0, sig0 = s00, sig1 = s11;
    if (Math.abs(s01) >= 1e-6) {                                      // diagonalize S
      const tao = 0.5 * (s00 - s11);
      const w = Math.sqrt(tao * tao + s01 * s01);
      const t = tao > 0 ? s01 / (tao + w) : s01 / (tao - w);
      c = 1 / Math.sqrt(t * t + 1);
      s = -t * c;
      sig0 = c * c * s00 - 2 * c * s * s01 + s * s * s11;
      sig1 = s * s * s00 + 2 * c * s * s01 + c * c * s11;
    }
    let v00 = c, v01 = s, v10 = -s, v11 = c;
    if (sig0 < sig1) {                                                // sort
      const tmp = sig0; sig0 = sig1; sig1 = tmp;
      v00 = -s; v01 = c; v10 = -c; v11 = -s;
    }
    sig[0] = sig0; sig[1] = sig1;
    V[0] = v00; V[1] = v01; V[2] = v10; V[3] = v11;
    U[0] = qc * v00 - qs * v10; U[1] = qc * v01 - qs * v11;          // U = Q V
    U[2] = qs * v00 + qc * v10; U[3] = qs * v01 + qc * v11;
  }

  // Small deterministic PRNG (mulberry32) for reproducible scenes.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function opt(value, fallback) { return value === undefined ? fallback : value; }

  function material_id(m) {
    if (m === undefined || m === null) return SNOW;
    if (typeof m === 'string') {
      const id = MATERIALS[m.toLowerCase()];
      if (id === undefined) throw new Error('MLSMPM: unknown material "' + m + '"');
      return id;
    }
    return m | 0;
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  // 0xRRGGBB -> opaque 32-bit pixel for a Uint32Array view of ImageData.
  function pack(rgb) {
    const r = (rgb >>> 16) & 255, g = (rgb >>> 8) & 255, b = rgb & 255;
    return (LITTLE_ENDIAN ? (255 << 24) | (b << 16) | (g << 8) | r
                          : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }

  function fill_rect(buf, W, H, x0, y0, x1, y1, color) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    for (let y = y0; y < y1; y++) buf.fill(color, y * W + x0, y * W + x1);
  }

  const stamps = new Map();                   // pixel offsets of a disc, per radius
  function disc(r) {
    let s = stamps.get(r);
    if (!s) {
      const R = Math.ceil(r), list = [];
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++)
          if (dx * dx + dy * dy <= r * r) list.push(dx, dy);
      s = new Int32Array(list.length ? list : [0, 0]);
      stamps.set(r, s);
    }
    return s;
  }

  // ---------------------------------------------------------------------------
  // The simulation
  // ---------------------------------------------------------------------------
  class MLSMPM {
    constructor(options) {
      const o = options || {};
      // C++: const int n = 80; dx = 1.0_f / n, inv_dx = 1.0_f / dx;
      this.n = o.n === undefined ? 80 : Math.max(4, o.n | 0);   // grid resolution (cells)
      this.dx = 1 / this.n;
      this.inv_dx = 1 / this.dx;
      // C++: dt = 1e-4_f, frame_dt = 1e-3_f   (the default dt is scaled with n for stability)
      this.dt = opt(o.dt, 1e-4 * 80 / this.n);
      this.frame_dt = opt(o.frame_dt, 1e-3);
      // C++: particle_mass = 1, vol = 1, hardening = 10, E = 1e4, nu = 0.2, plastic = true
      this.particle_mass = opt(o.particle_mass, 1);
      this.vol = opt(o.vol, 1);
      this.hardening = opt(o.hardening, 10);
      this.E = opt(o.E, 1e4);
      this.nu = opt(o.nu, 0.2);
      this.plastic = opt(o.plastic, true);
      this.theta_c = opt(o.theta_c, 2.5e-2);       // critical compression (snow)
      this.theta_s = opt(o.theta_s, 7.5e-3);       // critical stretch (snow)
      // C++: g += dt * Vector3(0, -200, 0);  real boundary = 0.05;
      this.gravity = o.gravity ? [o.gravity[0], o.gravity[1]] : [0, -200];
      this.boundary = opt(o.boundary, 0.05);
      // Extensions (not in the C++ code)
      this.attractor = null;                       // { x, y, strength, radius? }
      this.grid_hook = null;                       // function (x, y, grid, k)
      this.random = o.seed === undefined ? Math.random : mulberry32(o.seed);
      this.t = 0;                                  // simulated time
      // C++: Vector3 grid[n + 1][n + 1];  // velocity + mass, node_res = cell_res + 1
      this.grid = new Float64Array((this.n + 1) * (this.n + 1) * 3);
      // C++: struct Particle { Vec x, v; Mat F, C; real Jp; int c; };  -> structure of arrays
      this.num_particles = 0;
      this.capacity = 0;
      this.x = this.v = this.F = this.C = this.Jp = this.c = this.material = null;
      this._image = this._pixels = null;
      this.reserve(Math.max(1, o.max_particles || 1024));
    }

    get mu_0() { return this.E / (2 * (1 + this.nu)); }
    get lambda_0() { return this.E * this.nu / ((1 + this.nu) * (1 - 2 * this.nu)); }
    get steps_per_frame() { return Math.max(1, Math.round(this.frame_dt / this.dt)); }

    // Grow the particle arrays so that they hold at least `capacity` particles.
    reserve(capacity) {
      if (capacity <= this.capacity) return this;
      const grow = (old, Type, len) => { const a = new Type(len); if (old) a.set(old); return a; };
      this.x = grow(this.x, Float64Array, 2 * capacity);          // position
      this.v = grow(this.v, Float64Array, 2 * capacity);          // velocity
      this.F = grow(this.F, Float64Array, 4 * capacity);          // deformation gradient
      this.C = grow(this.C, Float64Array, 4 * capacity);          // affine velocity (APIC)
      this.Jp = grow(this.Jp, Float64Array, capacity);            // plastic volume ratio
      this.c = grow(this.c, Uint32Array, capacity);               // color 0xRRGGBB
      this.material = grow(this.material, Uint8Array, capacity);  // SNOW / JELLY / WATER
      this.capacity = capacity;
      return this;
    }

    // Add one particle. C++: particles.push_back(Particle(x, c, v));
    add_particle(x, c, options) {
      const o = options || {}, v = o.velocity;
      return this._push(x[0], x[1], v ? v[0] : 0, v ? v[1] : 0, c, material_id(o.material));
    }

    // Seed particles uniformly in a square (or rectangle). C++: add_object(center, c)
    add_object(center, c, options) {
      const o = options || {}, size = opt(o.size, 0.08);
      const sx = typeof size === 'number' ? size : size[0];
      const sy = typeof size === 'number' ? size : size[1];
      const k = this.n / 80;    // keep the C++ density: 1000 particles per 0.16 x 0.16 at n = 80
      const count = o.count === undefined ? Math.round(1000 * (sx * sy) / 0.0064 * k * k) : o.count | 0;
      const v = o.velocity, vx = v ? v[0] : 0, vy = v ? v[1] : 0;
      const material = material_id(o.material), rand = this.random, first = this.num_particles;
      if (first + count > this.capacity) this.reserve(Math.max(first + count, 2 * this.capacity));
      for (let i = 0; i < count; i++)          // Randomly sample particles in the square
        this._push((rand() * 2 - 1) * sx + center[0], (rand() * 2 - 1) * sy + center[1], vx, vy, c, material);
      return first;
    }

    // Remove all particles and reset the clock.
    clear() {
      this.num_particles = 0;
      this.t = 0;
      this.grid.fill(0);
      return this;
    }

    // A copy of the state of particle i.
    get_particle(i) {
      const F = this.F, C = this.C, a = 2 * i, b = 4 * i;
      return {
        x: [this.x[a], this.x[a + 1]], v: [this.v[a], this.v[a + 1]],
        F: [F[b], F[b + 1], F[b + 2], F[b + 3]], C: [C[b], C[b + 1], C[b + 2], C[b + 3]],
        Jp: this.Jp[i], c: this.c[i], material: this.material[i],
      };
    }

    // One time step: P2G, grid update, G2P. C++: void advance(real dt)
    advance(dt) {
      if (dt === undefined) dt = this.dt;
      const n = this.n, n1 = n + 1, dx = this.dx, inv_dx = this.inv_dx;
      const grid = this.grid, num = this.num_particles;
      const X = this.x, V = this.v, F = this.F, C = this.C, Jp = this.Jp, mat = this.material;
      const particle_mass = this.particle_mass, vol = this.vol, hardening = this.hardening;
      const mu_0 = this.mu_0, lambda_0 = this.lambda_0;

      grid.fill(0);                                                     // Reset grid

      const k_stress = -4 * inv_dx * inv_dx * dt * vol;
      for (let p = 0; p < num; p++) {                                   // P2G
        const p2 = 2 * p, p4 = 4 * p;
        const gx = X[p2] * inv_dx, gy = X[p2 + 1] * inv_dx;
        const bx = Math.floor(gx - 0.5), by = Math.floor(gy - 0.5);    // base_coord
        const fx = gx - bx, fy = gy - by;
        // Quadratic kernels  [http://mpm.graphics  Eqn. 123, with x = fx, fx-1, fx-2]
        wx[0] = 0.5 * (1.5 - fx) * (1.5 - fx); wy[0] = 0.5 * (1.5 - fy) * (1.5 - fy);
        wx[1] = 0.75 - (fx - 1) * (fx - 1);     wy[1] = 0.75 - (fy - 1) * (fy - 1);
        wx[2] = 0.5 * (fx - 0.5) * (fx - 0.5); wy[2] = 0.5 * (fy - 0.5) * (fy - 0.5);
        const e = Math.exp(hardening * (1 - Jp[p]));
        const mu = mat[p] === WATER ? 0 : mu_0 * e, lambda = lambda_0 * e;
        const f00 = F[p4], f01 = F[p4 + 1], f10 = F[p4 + 2], f11 = F[p4 + 3];
        const J = f00 * f11 - f01 * f10;                                // Current volume
        // Polar decomp. for fixed corotated model:  F = R S,  R = [[rc, -rs], [rs, rc]]
        const px = f00 + f11, py = f10 - f01, pl = Math.sqrt(px * px + py * py);
        const rc = pl > 0 ? px / pl : 1, rs = pl > 0 ? py / pl : 0;
        // Cauchy stress times dt and inv_dx:
        //   -4 inv_dx^2 dt vol (2 mu (F - R) F^T + lambda (J - 1) J I)
        const a00 = f00 - rc, a01 = f01 + rs, a10 = f10 - rs, a11 = f11 - rc;
        const mu2 = 2 * mu, lj = lambda * (J - 1) * J;
        // affine = stress + particle_mass * C
        const q00 = k_stress * (mu2 * (a00 * f00 + a01 * f01) + lj) + particle_mass * C[p4];
        const q01 = k_stress * (mu2 * (a00 * f10 + a01 * f11)) + particle_mass * C[p4 + 1];
        const q10 = k_stress * (mu2 * (a10 * f00 + a11 * f01)) + particle_mass * C[p4 + 2];
        const q11 = k_stress * (mu2 * (a10 * f10 + a11 * f11) + lj) + particle_mass * C[p4 + 3];
        const mvx = V[p2] * particle_mass, mvy = V[p2 + 1] * particle_mass; // momentum
        for (let i = 0; i < 3; i++) {                                   // Scatter to grid
          const dpx = (i - fx) * dx, wi = wx[i];
          let k = ((bx + i) * n1 + by) * 3;
          for (let j = 0; j < 3; j++, k += 3) {
            const dpy = (j - fy) * dx, w = wi * wy[j];
            grid[k] += w * (mvx + q00 * dpx + q01 * dpy);
            grid[k + 1] += w * (mvy + q10 * dpx + q11 * dpy);
            grid[k + 2] += w * particle_mass;
          }
        }
      }

      const gdx = dt * this.gravity[0], gdy = dt * this.gravity[1];
      const boundary = this.boundary, hook = this.grid_hook, att = this.attractor;
      const pull = att && att.strength ? att.strength * dt : 0;
      const ax = pull ? att.x : 0, ay = pull ? att.y : 0;
      const ar = pull && att.radius > 0 ? att.radius : Infinity;
      for (let i = 0; i <= n; i++) {                                    // For all grid nodes
        const x = i / n;
        for (let j = 0; j <= n; j++) {
          const k = (i * n1 + j) * 3, m = grid[k + 2];
          if (m > 0) {                                                  // No need for epsilon here
            let vx = grid[k] / m + gdx, vy = grid[k + 1] / m + gdy;    // Normalize by mass, gravity
            const y = j / n;                                            // node coord
            if (pull !== 0) {                                           // Attractor (extension)
              const ddx = ax - x, ddy = ay - y, d = Math.sqrt(ddx * ddx + ddy * ddy);
              if (d < ar) {
                const f = pull / (0.01 + d) * (ar === Infinity ? 1 : 1 - d / ar);
                vx += ddx * f; vy += ddy * f;
              }
            }
            if (hook) {                                                 // User hook (extension)
              grid[k] = vx; grid[k + 1] = vy;
              hook(x, y, grid, k);
              vx = grid[k]; vy = grid[k + 1];
            }
            if (x < boundary || x > 1 - boundary || y > 1 - boundary) { vx = 0; vy = 0; } // Sticky
            if (y < boundary && vy < 0) vy = 0;                         // "Separate"
            grid[k] = vx; grid[k + 1] = vy;                             // (grid[k + 2] keeps the mass)
          }
        }
      }

      const plastic = this.plastic, sig_lo = 1 - this.theta_c, sig_hi = 1 + this.theta_s;
      const lo = 0.5 * dx, hi = 1 - 0.5 * dx - 1e-6, k_apic = 4 * inv_dx;
      for (let p = 0; p < num; p++) {                                   // Grid to particle
        const p2 = 2 * p, p4 = 4 * p;
        const gx = X[p2] * inv_dx, gy = X[p2 + 1] * inv_dx;
        const bx = Math.floor(gx - 0.5), by = Math.floor(gy - 0.5);    // base_coord
        const fx = gx - bx, fy = gy - by;
        wx[0] = 0.5 * (1.5 - fx) * (1.5 - fx); wy[0] = 0.5 * (1.5 - fy) * (1.5 - fy);
        wx[1] = 0.75 - (fx - 1) * (fx - 1);     wy[1] = 0.75 - (fy - 1) * (fy - 1);
        wx[2] = 0.5 * (fx - 0.5) * (fx - 0.5); wy[2] = 0.5 * (fy - 0.5) * (fy - 0.5);
        let vx = 0, vy = 0, c00 = 0, c01 = 0, c10 = 0, c11 = 0;        // p.C = Mat(0); p.v = Vec(0);
        for (let i = 0; i < 3; i++) {
          const dpx = i - fx, wi = wx[i];
          let k = ((bx + i) * n1 + by) * 3;
          for (let j = 0; j < 3; j++, k += 3) {
            const dpy = j - fy, w = wi * wy[j];
            const wvx = w * grid[k], wvy = w * grid[k + 1];             // weight * grid_v
            vx += wvx; vy += wvy;                                       // Velocity
            c00 += wvx * dpx; c01 += wvx * dpy;                         // APIC C
            c10 += wvy * dpx; c11 += wvy * dpy;                         //  (x 4 inv_dx below)
          }
        }
        c00 *= k_apic; c01 *= k_apic; c10 *= k_apic; c11 *= k_apic;
        V[p2] = vx; V[p2 + 1] = vy;
        C[p4] = c00; C[p4 + 1] = c01; C[p4 + 2] = c10; C[p4 + 3] = c11;
        const nx = X[p2] + dt * vx, ny = X[p2 + 1] + dt * vy;          // Advection
        X[p2] = nx < lo ? lo : nx > hi ? hi : nx;                       // (clamped to the grid:
        X[p2 + 1] = ny < lo ? lo : ny > hi ? hi : ny;                   //  a safety net only)
        const f00 = F[p4], f01 = F[p4 + 1], f10 = F[p4 + 2], f11 = F[p4 + 3];
        const b00 = 1 + dt * c00, b01 = dt * c01, b10 = dt * c10, b11 = 1 + dt * c11;
        let g00 = b00 * f00 + b01 * f10, g01 = b00 * f01 + b01 * f11;  // MLS-MPM F-update:
        let g10 = b10 * f00 + b11 * f10, g11 = b10 * f01 + b11 * f11;  //   F = (I + dt C) F
        const m = mat[p];
        if (m === SNOW && plastic) {                                    // Snow Plasticity
          tF[0] = g00; tF[1] = g01; tF[2] = g10; tF[3] = g11;
          svd(tF, tU, tSig, tV);
          const s0 = Math.min(Math.max(tSig[0], sig_lo), sig_hi);
          const s1 = Math.min(Math.max(tSig[1], sig_lo), sig_hi);
          const oldJ = g00 * g11 - g01 * g10;
          g00 = tU[0] * s0 * tV[0] + tU[1] * s1 * tV[1];                // F = U sig V^T
          g01 = tU[0] * s0 * tV[2] + tU[1] * s1 * tV[3];
          g10 = tU[2] * s0 * tV[0] + tU[3] * s1 * tV[1];
          g11 = tU[2] * s0 * tV[2] + tU[3] * s1 * tV[3];
          const Jp_new = Jp[p] * oldJ / (g00 * g11 - g01 * g10);
          Jp[p] = Jp_new < 0.6 ? 0.6 : Jp_new > 20 ? 20 : Jp_new;
        } else if (m === WATER) {                          // Fluid (extension): keep only J
          const Jw = g00 * g11 - g01 * g10, sj = Math.sqrt(Jw > 1e-4 ? Jw : 1e-4);
          g00 = sj; g01 = 0; g10 = 0; g11 = sj;
        }
        F[p4] = g00; F[p4 + 1] = g01; F[p4 + 2] = g10; F[p4 + 3] = g11;
      }
      this.t += dt;
      return this;
    }

    // Advance one visual frame: frame_dt / dt substeps (what the C++ main loop does).
    advance_frame() {
      for (let i = 0, steps = this.steps_per_frame; i < steps; i++) this.advance(this.dt);
      return this;
    }

    // Draw into a canvas (or a 2D context): background, box and particles with the
    // colors and sizes of the C++ GUI. options: { background, box, radius }.
    render(target, options) {
      const o = options || {};
      const ctx = target.getContext ? target.getContext('2d') : target;
      const W = ctx.canvas.width, H = ctx.canvas.height;
      if (!this._image || this._image.width !== W || this._image.height !== H) {
        this._image = ctx.createImageData(W, H);
        this._pixels = new Uint32Array(this._image.data.buffer);
      }
      const buf = this._pixels, scale = Math.min(W, H) / 800;       // C++: window_size = 800
      const background = opt(o.background, 0x112F41), box = opt(o.box, 0x4FB99F);
      buf.fill(background === null ? 0 : pack(background));         // canvas.clear(0x112F41)
      if (box !== null) {                     // canvas.rect(Vec(0.04), Vec(0.96)).radius(2)
        const t = Math.max(1, Math.round(2 * scale)), col = pack(box);
        const x0 = Math.round(0.04 * W), x1 = Math.round(0.96 * W);
        const y0 = Math.round(0.04 * H), y1 = Math.round(0.96 * H);
        fill_rect(buf, W, H, x0, y0, x1, y0 + t, col);
        fill_rect(buf, W, H, x0, y1 - t, x1, y1, col);
        fill_rect(buf, W, H, x0, y0, x0 + t, y1, col);
        fill_rect(buf, W, H, x1 - t, y0, x1, y1, col);
      }
      const stamp = disc(opt(o.radius, Math.max(0.5, 2 * scale)));  // circle(p.x).radius(2)
      const X = this.x, color = this.c, N = this.num_particles, S = stamp.length;
      for (let p = 0; p < N; p++) {
        const px = Math.floor(X[2 * p] * W), py = Math.floor((1 - X[2 * p + 1]) * H);
        const rgba = pack(color[p]);
        for (let k = 0; k < S; k += 2) {
          const qx = px + stamp[k], qy = py + stamp[k + 1];
          if (qx >= 0 && qx < W && qy >= 0 && qy < H) buf[qy * W + qx] = rgba;
        }
      }
      ctx.putImageData(this._image, 0, 0);
      return this;
    }

    _push(x, y, vx, vy, c, material) {
      if (this.num_particles >= this.capacity) this.reserve(Math.max(1024, 2 * this.capacity));
      const p = this.num_particles++, lo = 0.5 * this.dx, hi = 1 - 0.5 * this.dx - 1e-6;
      this.x[2 * p] = x < lo ? lo : x > hi ? hi : x;
      this.x[2 * p + 1] = y < lo ? lo : y > hi ? hi : y;
      this.v[2 * p] = vx; this.v[2 * p + 1] = vy;
      const F = this.F, C = this.C, q = 4 * p;
      F[q] = 1; F[q + 1] = 0; F[q + 2] = 0; F[q + 3] = 1;            // F(1)
      C[q] = 0; C[q + 1] = 0; C[q + 2] = 0; C[q + 3] = 0;            // C(0)
      this.Jp[p] = 1;                                               // Jp(1)
      this.c[p] = c === undefined ? 0xFFFFFF : c;
      this.material[p] = material;
      return p;
    }
  }

  MLSMPM.version = VERSION;
  MLSMPM.SNOW = SNOW;
  MLSMPM.JELLY = JELLY;
  MLSMPM.WATER = WATER;

  // Closed-form 2x2 decompositions, exposed for convenience and testing.
  MLSMPM.svd = function (m, U, sig, V) {
    U = U || [0, 0, 0, 0]; sig = sig || [0, 0]; V = V || [0, 0, 0, 0];
    svd(m, U, sig, V);
    return { U: U, sig: sig, V: V };
  };
  MLSMPM.polar_decomp = function (m, R, S) {
    R = R || [0, 0, 0, 0]; S = S || [0, 0, 0, 0];
    polar_decomp(m, R, S);
    return { R: R, S: S };
  };

  // Convert a mouse / pointer event to simulation coordinates ([0, 1]^2, y up).
  MLSMPM.pointer = function (event, canvas) {
    const r = canvas.getBoundingClientRect();
    return [(event.clientX - r.left) / r.width, 1 - (event.clientY - r.top) / r.height];
  };

  return MLSMPM;
});
