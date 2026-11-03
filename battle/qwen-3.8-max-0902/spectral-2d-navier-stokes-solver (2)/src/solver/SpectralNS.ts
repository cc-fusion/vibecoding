import {
  bindTexture,
  blit,
  createContext,
  createTarget,
  destroyTarget,
  program,
  type GLCaps,
  type GLContext,
  type Program,
  type Target,
} from "./gl";
import * as S from "./shaders";
import { DIVERGING, buildLUT, hueRGB, type ColorMap, type RGB } from "./colormaps";

export type DisplayMode = "dye" | "speed" | "vorticity" | "pressure" | "divergence" | "spectrum";

export interface SolverParams {
  dt: number;
  viscosity: number;
  bfecc: boolean;
  vorticityConfinement: number;
  dyeDissipation: number;
  velDissipation: number;
  stirring: boolean;
  stirStrength: number;
  displayMode: DisplayMode;
  autoScale: boolean;
  fieldScale: number;
  exposure: number;
  showGrid: boolean;
  stepsPerFrame: number;
}

export const defaultParams: SolverParams = {
  dt: 0.006,
  viscosity: 0.0,
  bfecc: true,
  vorticityConfinement: 0.0,
  dyeDissipation: 0.999,
  velDissipation: 0.998,
  stirring: true,
  stirStrength: 0.09,
  displayMode: "dye",
  autoScale: true,
  fieldScale: 1.0,
  exposure: 1.7,
  showGrid: false,
  stepsPerFrame: 1,
};

export interface Telemetry {
  fps: number;
  stepMs: number;
  frameMs: number;
  stages: { label: string; ms: number }[];
  rmsDivergence: number;
  relDivergence: number;
  uMax: number;
  rmsU: number;
  rmsOmega: number;
  energy: number;
  enstrophy: number;
  reynolds: number;
  cfl: number;
  diffusionNumber: number;
  diffusionSubsteps: number;
  N: number;
  steps: number;
  simTime: number;
  fftMs: number;
  gpuMB: number;
  modes: number;
}

export interface Preset {
  id: number;
  name: string;
  blurb: string;
  amp: number;
  viscosity: number;
  dye: number;
}

export const PRESETS: Preset[] = [
  { id: 0, name: "Taylor–Green", blurb: "Analytic decay · validates ν", amp: 0.35, viscosity: 0.0006, dye: 1 },
  { id: 1, name: "Double shear", blurb: "Kelvin–Helmholtz roll-up", amp: 1.0, viscosity: 0.0, dye: 1 },
  { id: 2, name: "Decaying 2D turbulence", blurb: "Random ψ, E(k) ~ k⁻³", amp: 1.0, viscosity: 0.0, dye: 1 },
  { id: 3, name: "Vortex dipole", blurb: "Lamb–Oseen pair, self-propelling", amp: 1.0, viscosity: 0.0, dye: 1 },
  { id: 4, name: "Vortex lattice", blurb: "Four alternating cores", amp: 1.0, viscosity: 0.0, dye: 1 },
  { id: 5, name: "Blank torus", blurb: "Empty field · paint with the pointer", amp: 0.0, viscosity: 0.0, dye: 0 },
];

interface Splat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: RGB;
  radius: number;
  dye: number;
}

export class SpectralSolver {
  readonly gl: GLContext;
  readonly caps: GLCaps;
  params: SolverParams = { ...defaultParams };
  N = 512;
  steps = 0;
  simTime = 0;
  preset = 2;
  seed = 1;
  gpuMB = 0;
  maxDiffusionSubsteps = 24;
  diffusionSubsteps = 0;
  diffusionCoeff = 0;

  private canvas: HTMLCanvasElement;
  private progs!: {
    advect: Program;
    bfecc: Program;
    divergence: Program;
    fft: Program;
    kernel: Program;
    project: Program;
    diffuse: Program;
    curl: Program;
    vortForce: Program;
    splat: Program;
    init: Program;
    stir: Program;
    stirDye: Program;
    stats: Program;
    reduce: Program;
    copy: Program;
    clear: Program;
    background: Program;
    display: Program;
  };

  private vel: Target[] = [];
  private velIdx = 0;
  private dye: Target[] = [];
  private dyeIdx = 0;
  private fftBuf: Target[] = [];
  private scalar!: Target;
  private spectrum!: Target;
  private chain: Target[] = [];
  private lut!: WebGLTexture;
  private divLut!: WebGLTexture;

  private splats: Splat[] = [];
  private pressureBuf: Target | null = null;
  private pbo: WebGLBuffer | null = null;
  private fence: WebGLSync | null = null;
  private statsPending = false;
  private viewport = { x: 0, y: 0, w: 1, h: 1 };

  /** latest measured quantities */
  tel: Telemetry = {
    fps: 0,
    stepMs: 0,
    frameMs: 0,
    stages: [],
    rmsDivergence: 0,
    relDivergence: 0,
    uMax: 0,
    rmsU: 0,
    rmsOmega: 0,
    energy: 0,
    enstrophy: 0,
    reynolds: 0,
    cfl: 0,
    diffusionNumber: 0,
    diffusionSubsteps: 0,
    N: 512,
    steps: 0,
    simTime: 0,
    fftMs: 0,
    gpuMB: 0,
    modes: 0,
  };
  private stageTimes: Record<string, number> = {};
  private profiling = false;

  constructor(canvas: HTMLCanvasElement, N = 512) {
    const ctx = createContext(canvas);
    if (!ctx) throw new Error("WebGL2 is not available in this browser.");
    this.canvas = canvas;
    this.gl = ctx.gl;
    this.caps = ctx.caps;
    if (!this.caps.floatRenderable) {
      throw new Error("EXT_color_buffer_float is unavailable — floating-point render targets are required for the spectral solve.");
    }
    this.compile();
    this.makeLUTs();
    this.allocate(N);
    this.initPreset(2, 1);
  }

  /* ---------------------------------------------------------------- */
  /* setup                                                            */
  /* ---------------------------------------------------------------- */

  private compile() {
    const gl = this.gl;
    const P = (name: string, src: string, uniforms: string[]) => program(gl, name, src, uniforms);
    this.progs = {
      advect: P("advect", S.ADVECT, ["uField", "uVel", "uDt", "uDissipation"]),
      bfecc: P("bfecc", S.BFECC, ["uPhi0", "uPhi2", "uN"]),
      divergence: P("divergence", S.DIVERGENCE, ["uVel", "uN", "uH"]),
      fft: P("fft", S.FFT, ["uSrc", "uN", "uM", "uAxis", "uSign"]),
      kernel: P("kernel", S.KERNEL, ["uSrc", "uN", "uH", "uScale"]),
      project: P("project", S.PROJECT, ["uVelStar", "uPressure", "uN", "uH", "uDt"]),
      diffuse: P("diffuse", S.DIFFUSE, ["uVel", "uN", "uCoeff"]),
      curl: P("curl", S.CURL, ["uVel", "uN", "uH"]),
      vortForce: P("vortForce", S.VORTICITY_FORCE, ["uVel", "uCurl", "uN", "uH", "uDt", "uEps"]),
      splat: P("splat", S.SPLAT, ["uTarget", "uPoint", "uValue", "uRadius"]),
      init: P("init", S.INIT, ["uPreset", "uOutKind", "uSeed", "uAmp"]),
      stir: P("stir", S.STIR, ["uVel", "uTime", "uStrength", "uDt"]),
      stirDye: P("stirDye", S.STIR_DYE, ["uDye", "uTime", "uAmount"]),
      stats: P("stats", S.STATS, ["uVel", "uSrcN", "uH"]),
      reduce: P("reduce", S.REDUCE, ["uSrc"]),
      copy: P("copy", S.COPY, ["uSrc"]),
      clear: P("clear", S.CLEAR, ["uValue"]),
      background: P("background", S.BACKGROUND, ["uRes", "uTime", "uEnergy"]),
      display: P("display", S.DISPLAY, [
        "uDye", "uVel", "uScalar", "uSpectrum", "uLut", "uDivLut",
        "uMode", "uMapId", "uScale", "uExposure", "uGrid", "uTexel", "uN", "uTime",
      ]),
    };
  }

  private uploadLUT(tex: WebGLTexture, data: Uint8Array) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  private makeLUTs() {
    const gl = this.gl;
    const mk = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.lut = mk();
    this.divLut = mk();
    this.uploadLUT(this.divLut, buildLUT(DIVERGING));
  }

  setColormap(map: ColorMap) {
    this.uploadLUT(this.lut, buildLUT(map.stops));
  }

  /* ---------------------------------------------------------------- */
  /* memory                                                           */
  /* ---------------------------------------------------------------- */

  private rgInt: number = 0;
  private rgFmt: number = 0;
  private rgbaInt: number = 0;
  private filter: number = 0;

  private disposeField() {
    const gl = this.gl;
    for (const t of [...this.vel, ...this.dye, ...this.fftBuf, ...this.chain]) destroyTarget(gl, t);
    if (this.scalar) destroyTarget(gl, this.scalar);
    if (this.spectrum) destroyTarget(gl, this.spectrum);
    if (this.pbo) gl.deleteBuffer(this.pbo);
    this.pbo = null;
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = null;
    this.vel = [];
    this.dye = [];
    this.fftBuf = [];
    this.chain = [];
  }

  allocate(N: number) {
    const gl = this.gl;
    const pow2 = Math.max(32, Math.min(2048, 1 << Math.round(Math.log2(N))));
    this.disposeField();
    this.N = pow2;

    const useFloat = this.caps.floatLinear;
    this.rgInt = useFloat ? gl.RG32F : gl.RG16F;
    this.rgFmt = gl.RG;
    this.rgbaInt = gl.RGBA16F;
    this.filter = gl.LINEAR;
    const type = useFloat ? gl.FLOAT : gl.HALF_FLOAT;

    const rg = () => createTarget(gl, pow2, pow2, this.rgInt, this.rgFmt, type, this.filter);
    this.vel = [rg(), rg()];
    this.fftBuf = [rg(), rg()];
    this.scalar = rg();
    this.spectrum = rg();
    const rgba = () => createTarget(gl, pow2, pow2, this.rgbaInt, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.dye = [rgba(), rgba(), rgba(), rgba()];
    this.velIdx = 0;
    this.dyeIdx = 0;

    // reduction chain: N/2 ... 1  (RGBA32F so readPixels(RGBA, FLOAT) is legal)
    let s = pow2 >> 1;
    this.chain = [];
    while (s >= 1) {
      this.chain.push(createTarget(gl, s, s, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST));
      s >>= 1;
    }
    this.pbo = gl.createBuffer();

    const bytes =
      6 * pow2 * pow2 * (useFloat ? 8 : 4) + 4 * pow2 * pow2 * 8 + (pow2 * pow2) / 3 * 16;
    this.gpuMB = bytes / 1048576;
    this.tel.N = pow2;
    this.tel.gpuMB = this.gpuMB;
    this.tel.modes = pow2 * pow2;
    this.pressureBuf = null;
  }

  get h() {
    return 1 / this.N;
  }
  get texel() {
    return [1 / this.N, 1 / this.N] as [number, number];
  }

  /* ---------------------------------------------------------------- */
  /* initial / boundary data                                          */
  /* ---------------------------------------------------------------- */

  initPreset(preset: number, seed: number, ampOverride?: number) {
    const gl = this.gl;
    const p = this.progs.init;
    const spec = PRESETS.find((x) => x.id === preset) ?? PRESETS[2];
    this.preset = preset;
    this.seed = seed;
    gl.useProgram(p.prog);
    gl.uniform1i(p.u.uPreset, preset);
    gl.uniform1f(p.u.uSeed, seed);
    gl.uniform1f(p.u.uAmp, ampOverride ?? spec.amp);
    gl.uniform1i(p.u.uOutKind, 0);
    blit(gl, this.vel[this.velIdx]);
    gl.uniform1i(p.u.uOutKind, 1);
    blit(gl, this.dye[this.dyeIdx]);
    this.steps = 0;
    this.simTime = 0;
    this.tel.steps = 0;
    this.tel.simTime = 0;
  }

  clearAll() {
    const gl = this.gl;
    const p = this.progs.clear;
    gl.useProgram(p.prog);
    gl.uniform4f(p.u.uValue, 0, 0, 0, 1);
    blit(gl, this.vel[this.velIdx]);
    blit(gl, this.dye[this.dyeIdx]);
    this.steps = 0;
    this.simTime = 0;
  }

  queueSplat(x: number, y: number, dx: number, dy: number, color: RGB, radius = 0.02, dye = 1) {
    if (this.splats.length > 24) this.splats.shift();
    this.splats.push({ x, y, dx, dy, color, radius, dye });
  }

  /** Apply queued pointer splats without advancing time (usable while paused). */
  flushSplats() {
    if (this.splats.length) this.applySplats();
  }

  private applySplats() {
    if (!this.splats.length) return;
    const gl = this.gl;
    const p = this.progs.splat;
    gl.useProgram(p.prog);
    for (const s of this.splats) {
      // velocity
      gl.uniform2f(p.u.uPoint, s.x, s.y);
      gl.uniform1f(p.u.uRadius, s.radius);
      gl.uniform3f(p.u.uValue, s.dx, s.dy, 0);
      gl.uniform1i(p.u.uTarget, 0);
      bindTexture(gl, 0, this.velCur().tex);
      blit(gl, this.velAlt());
      this.velIdx ^= 1;
      // dye
      gl.uniform1f(p.u.uRadius, s.radius * 0.85);
      gl.uniform3f(p.u.uValue, s.color[0] * s.dye, s.color[1] * s.dye, s.color[2] * s.dye);
      bindTexture(gl, 0, this.dyeCur().tex);
      blit(gl, this.dye[this.dyeIdx ^ 1]);
      this.dyeIdx ^= 1;
    }
    this.splats.length = 0;
  }

  /* ---------------------------------------------------------------- */
  /* buffer helpers                                                   */
  /* ---------------------------------------------------------------- */

  private velCur() {
    return this.vel[this.velIdx];
  }
  private velAlt() {
    return this.vel[this.velIdx ^ 1];
  }
  private dyeCur() {
    return this.dye[this.dyeIdx];
  }

  private use(prog: Program) {
    this.gl.useProgram(prog.prog);
    return prog;
  }

  /** Semi-Lagrangian advection of `field` by velocity `vel` into `dst`. */
  private advect(field: Target, vel: Target, dst: Target, dt: number, dissipation: number) {
    const gl = this.gl;
    const p = this.use(this.progs.advect);
    gl.uniform1i(p.u.uField, 0);
    gl.uniform1i(p.u.uVel, 1);
    gl.uniform1f(p.u.uDt, dt);
    gl.uniform1f(p.u.uDissipation, dissipation);
    bindTexture(gl, 0, field.tex);
    bindTexture(gl, 1, vel.tex);
    blit(gl, dst);
  }

  /**
   * BFECC (back-and-forth error compensation & correction):
   *   phi1 = A(phi0, -dt);  phi2 = A(phi1, +dt)
   *   phic = phi0 + 0.5(phi0 - phi2)   (clamped to the local AABB)
   *   out  = A(phic, -dt)
   * Three advections + one limiter instead of one advection -> second-order
   * accurate in time and dramatically less numerical diffusion.
   */
  private advectBFECC(cur: Target, dst: Target, scratch: [Target, Target], dt: number, dissipation: number, isDye: boolean) {
    const vel = this.velCur();
    if (!this.params.bfecc) {
      this.advect(cur, vel, dst, dt, dissipation);
      return;
    }
    const [s0, s1] = scratch;
    this.advect(cur, vel, s0, dt, 1.0);
    this.advect(s0, vel, s1, -dt, 1.0);
    const gl = this.gl;
    const p = this.use(this.progs.bfecc);
    gl.uniform1i(p.u.uPhi0, 0);
    gl.uniform1i(p.u.uPhi2, 1);
    gl.uniform1i(p.u.uN, this.N);
    bindTexture(gl, 0, cur.tex);
    bindTexture(gl, 1, s1.tex);
    blit(gl, s0);
    this.advect(s0, vel, dst, dt, dissipation);
    void isDye;
  }

  /* ---------------------------------------------------------------- */
  /* spectral Poisson solve:  div -> FFT -> G(k) -> iFFT -> pressure   */
  /* ---------------------------------------------------------------- */

  private fftStages(input: Target, sign: number): { out: Target; ms: number } {
    const gl = this.gl;
    const p = this.progs.fft;
    const t0 = this.profiling ? performance.now() : 0;
    let cur = input;
    const other = (t: Target) => (t === this.fftBuf[0] ? this.fftBuf[1] : this.fftBuf[0]);
    gl.useProgram(p.prog);
    gl.uniform1i(p.u.uSrc, 0);
    gl.uniform1i(p.u.uN, this.N);
    gl.uniform1f(p.u.uSign, sign);
    for (let axis = 0; axis < 2; axis++) {
      gl.uniform1i(p.u.uAxis, axis);
      for (let m = 2; m <= this.N; m <<= 1) {
        gl.uniform1i(p.u.uM, m);
        const dst = other(cur);
        bindTexture(gl, 0, cur.tex);
        blit(gl, dst);
        cur = dst;
      }
    }
    return { out: cur, ms: this.profiling ? performance.now() - t0 : 0 };
  }

  private solvePressure(dt: number) {
    const gl = this.gl;
    // 1) divergence of the intermediate velocity -> fftBuf[0] (real part)
    const d = this.use(this.progs.divergence);
    gl.uniform1i(d.u.uVel, 0);
    gl.uniform1i(d.u.uN, this.N);
    gl.uniform1f(d.u.uH, this.h);
    bindTexture(gl, 0, this.velCur().tex);
    blit(gl, this.fftBuf[0]);

    // 2) forward FFT
    const t0 = this.profiling ? performance.now() : 0;
    const fwd = this.fftStages(this.fftBuf[0], +1);
    if (this.params.displayMode === "spectrum") {
      const c = this.use(this.progs.copy);
      gl.uniform1i(c.u.uSrc, 0);
      bindTexture(gl, 0, fwd.out.tex);
      blit(gl, this.spectrum);
    }

    // 3) Green's function of the discrete Laplacian (+ 1/dt and 1/N^2 for the inverse)
    const k = this.use(this.progs.kernel);
    const dst = fwd.out === this.fftBuf[0] ? this.fftBuf[1] : this.fftBuf[0];
    gl.uniform1i(k.u.uSrc, 0);
    gl.uniform1i(k.u.uN, this.N);
    gl.uniform1f(k.u.uH, this.h);
    gl.uniform1f(k.u.uScale, 1 / (dt * this.N * this.N));
    bindTexture(gl, 0, fwd.out.tex);
    blit(gl, dst);

    // 4) inverse FFT
    const inv = this.fftStages(dst, -1);
    if (this.profiling) {
      this.stageTimes["spectral Poisson (2×FFT + G(k))"] = performance.now() - t0;
    }
    this.tel.fftMs = fwd.ms + inv.ms;
    this.pressureBuf = inv.out;
    return inv.out;
  }

  /* ---------------------------------------------------------------- */
  /* one full Chorin splitting step                                   */
  /* ---------------------------------------------------------------- */

  step(dt = this.params.dt) {
    const gl = this.gl;
    const mark = (label: string, t0: number) => {
      if (this.profiling) this.stageTimes[label] = performance.now() - t0;
    };

    let t = this.profiling ? performance.now() : 0;
    this.applySplats();
    if (this.params.stirring && this.params.stirStrength > 0) {
      const p = this.use(this.progs.stir);
      gl.uniform1i(p.u.uVel, 0);
      gl.uniform1f(p.u.uTime, this.simTime);
      gl.uniform1f(p.u.uStrength, this.params.stirStrength);
      gl.uniform1f(p.u.uDt, dt);
      bindTexture(gl, 0, this.velCur().tex);
      blit(gl, this.velAlt());
      this.velIdx ^= 1;
    }
    mark("forces / pointer injection", t);

    // ---- 1. advection: u* = A(u^n) --------------------------------
    t = this.profiling ? performance.now() : 0;
    this.advectBFECC(this.velCur(), this.velAlt(), [this.fftBuf[0], this.fftBuf[1]], dt, this.params.velDissipation, false);
    this.velIdx ^= 1;
    mark("semi-Lagrangian advection (u)", t);

    // ---- 2. explicit diffusion (sub-cycled to respect νΔt/h² <= 0.2) ----
    const nu = this.params.viscosity;
    if (nu > 1e-7) {
      t = this.profiling ? performance.now() : 0;
      const total = (nu * dt) / (this.h * this.h);
      const substeps = Math.max(1, Math.min(this.maxDiffusionSubsteps, Math.ceil(total / 0.2)));
      const coeff = total / substeps;
      const p = this.use(this.progs.diffuse);
      gl.uniform1i(p.u.uVel, 0);
      gl.uniform1i(p.u.uN, this.N);
      gl.uniform1f(p.u.uCoeff, coeff);
      for (let i = 0; i < substeps; i++) {
        bindTexture(gl, 0, this.velCur().tex);
        blit(gl, this.velAlt());
        this.velIdx ^= 1;
      }
      this.diffusionSubsteps = substeps;
      this.diffusionCoeff = coeff;
      mark(`explicit diffusion ν∇²u ×${substeps}`, t);
    } else {
      this.diffusionSubsteps = 0;
      this.diffusionCoeff = 0;
    }

    // ---- 3. vorticity confinement ---------------------------------
    if (this.params.vorticityConfinement > 0) {
      t = this.profiling ? performance.now() : 0;
      const c = this.use(this.progs.curl);
      gl.uniform1i(c.u.uVel, 0);
      gl.uniform1i(c.u.uN, this.N);
      gl.uniform1f(c.u.uH, this.h);
      bindTexture(gl, 0, this.velCur().tex);
      blit(gl, this.scalar);

      const f = this.use(this.progs.vortForce);
      gl.uniform1i(f.u.uVel, 0);
      gl.uniform1i(f.u.uCurl, 1);
      gl.uniform1i(f.u.uN, this.N);
      gl.uniform1f(f.u.uH, this.h);
      gl.uniform1f(f.u.uDt, dt);
      gl.uniform1f(f.u.uEps, this.params.vorticityConfinement);
      bindTexture(gl, 0, this.velCur().tex);
      bindTexture(gl, 1, this.scalar.tex);
      blit(gl, this.velAlt());
      this.velIdx ^= 1;
      mark("vorticity confinement", t);
    }

    // ---- 4. pressure Poisson solve (spectral, direct) -------------
    const pressure = this.solvePressure(dt);

    // ---- 5. projection --------------------------------------------
    t = this.profiling ? performance.now() : 0;
    const pr = this.use(this.progs.project);
    gl.uniform1i(pr.u.uVelStar, 0);
    gl.uniform1i(pr.u.uPressure, 1);
    gl.uniform1i(pr.u.uN, this.N);
    gl.uniform1f(pr.u.uH, this.h);
    gl.uniform1f(pr.u.uDt, dt);
    bindTexture(gl, 0, this.velCur().tex);
    bindTexture(gl, 1, pressure.tex);
    blit(gl, this.velAlt());
    this.velIdx ^= 1;
    mark("projection u = u* − dt∇p", t);

    // ---- 6. dye transport with the divergence-free velocity -------
    t = this.profiling ? performance.now() : 0;
    const dScratch: [Target, Target] = [this.dye[2], this.dye[3]];
    this.advectBFECC(this.dyeCur(), this.dye[this.dyeIdx ^ 1], dScratch, dt, this.params.dyeDissipation, true);
    this.dyeIdx ^= 1;
    if (this.params.stirring && this.params.stirStrength > 0) {
      const sd = this.use(this.progs.stirDye);
      gl.uniform1i(sd.u.uDye, 0);
      gl.uniform1f(sd.u.uTime, this.simTime);
      gl.uniform1f(sd.u.uAmount, this.params.stirStrength * dt * 8.0);
      bindTexture(gl, 0, this.dyeCur().tex);
      blit(gl, this.dye[this.dyeIdx ^ 1]);
      this.dyeIdx ^= 1;
    }
    mark("semi-Lagrangian advection (dye)", t);

    this.steps++;
    this.simTime += dt;
  }

  /* ---------------------------------------------------------------- */
  /* diagnostics: global integrals via GPU reduction + async readback */
  /* ---------------------------------------------------------------- */

  requestStats() {
    if (this.statsPending || !this.chain.length) return;
    const gl = this.gl;
    const s = this.use(this.progs.stats);
    gl.uniform1i(s.u.uVel, 0);
    gl.uniform1i(s.u.uSrcN, this.N);
    gl.uniform1f(s.u.uH, this.h);
    bindTexture(gl, 0, this.velCur().tex);
    blit(gl, this.chain[0]);

    const r = this.use(this.progs.reduce);
    gl.uniform1i(r.u.uSrc, 0);
    for (let i = 1; i < this.chain.length; i++) {
      bindTexture(gl, 0, this.chain[i - 1].tex);
      blit(gl, this.chain[i]);
    }

    const last = this.chain[this.chain.length - 1];
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 16, gl.STREAM_READ);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, last.fbo);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.statsPending = true;
  }

  pollStats(): boolean {
    if (!this.statsPending || !this.fence) return false;
    const gl = this.gl;
    const st = gl.clientWaitSync(this.fence, 0, 0);
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return false;
    gl.deleteSync(this.fence);
    this.fence = null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    const raw = new Float32Array(4);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, raw);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.statsPending = false;

    const cells = this.N * this.N;
    const h2 = this.h * this.h;
    const sumDiv2 = raw[0];
    const sumU2 = raw[1];
    const sumW2 = raw[2];
    const maxU2 = raw[3];
    const rmsDiv = Math.sqrt(Math.max(0, sumDiv2) / cells);
    const rmsU = Math.sqrt(Math.max(0, sumU2) / cells);
    const uMax = Math.sqrt(Math.max(0, maxU2));
    const rmsW = Math.sqrt(Math.max(0, sumW2) / cells);
    const dt = this.params.dt;
    const nu = Math.max(this.params.viscosity, 1e-12);
    this.tel.rmsDivergence = rmsDiv;
    this.tel.relDivergence = rmsU > 1e-9 ? rmsDiv / (rmsU / this.h) : 0;
    this.tel.uMax = uMax;
    this.tel.rmsU = rmsU;
    this.tel.rmsOmega = rmsW;
    this.tel.energy = 0.5 * sumU2 * h2;
    this.tel.enstrophy = 0.5 * sumW2 * h2;
    this.tel.reynolds = rmsU / nu;
    this.tel.cfl = (uMax * dt) / this.h;
    this.tel.diffusionNumber = this.diffusionCoeff;
    this.tel.diffusionSubsteps = this.diffusionSubsteps;
    this.tel.steps = this.steps;
    this.tel.simTime = this.simTime;
    this.tel.N = this.N;
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* presentation                                                     */
  /* ---------------------------------------------------------------- */

  resizeCanvas(cssW: number, cssH: number, dpr: number) {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const pad = Math.round(Math.min(w, h) * 0.012);
    const s = Math.max(1, Math.min(w - pad * 2, h - pad * 2));
    this.viewport = { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), w: s, h: s };
  }

  render(time: number) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const mode = this.params.displayMode;

    // per-frame auxiliary scalar field for the current display mode
    if (mode === "vorticity") {
      const c = this.use(this.progs.curl);
      gl.uniform1i(c.u.uVel, 0);
      gl.uniform1i(c.u.uN, this.N);
      gl.uniform1f(c.u.uH, this.h);
      bindTexture(gl, 0, this.velCur().tex);
      blit(gl, this.scalar);
    } else if (mode === "divergence") {
      const d = this.use(this.progs.divergence);
      gl.uniform1i(d.u.uVel, 0);
      gl.uniform1i(d.u.uN, this.N);
      gl.uniform1f(d.u.uH, this.h);
      bindTexture(gl, 0, this.velCur().tex);
      blit(gl, this.scalar);
    }
    const scalarTex = mode === "pressure" && this.pressureBuf ? this.pressureBuf.tex : this.scalar.tex;

    const bg = this.use(this.progs.background);
    gl.uniform2f(bg.u.uRes, W, H);
    gl.uniform1f(bg.u.uTime, time);
    gl.uniform1f(bg.u.uEnergy, Math.min(1.4, this.tel.rmsU * 1.6));
    blit(gl, null, { x: 0, y: 0, w: W, h: H });

    // auto-ranging for the scalar visualisations
    let scale = this.params.fieldScale;
    if (this.params.autoScale) {
      const rms = Math.max(1e-6, this.tel.rmsU);
      if (mode === "speed") scale = (0.62 / rms) * this.params.fieldScale;
      else if (mode === "vorticity") scale = (1.2 / Math.max(1e-5, this.tel.rmsOmega)) * this.params.fieldScale;
      else if (mode === "pressure") scale = (1.6 / Math.max(1e-5, this.tel.rmsU * this.tel.rmsU * 2 + 1e-6)) * this.params.fieldScale;
      else if (mode === "spectrum") scale = (240 / Math.max(1e-3, this.tel.rmsU)) * this.params.fieldScale;
    }

    const modeIndex = { dye: 0, speed: 1, vorticity: 2, pressure: 3, divergence: 4, spectrum: 5 }[mode];
    const d = this.use(this.progs.display);
    gl.uniform1i(d.u.uDye, 0);
    gl.uniform1i(d.u.uVel, 1);
    gl.uniform1i(d.u.uScalar, 2);
    gl.uniform1i(d.u.uSpectrum, 3);
    gl.uniform1i(d.u.uLut, 4);
    gl.uniform1i(d.u.uDivLut, 5);
    bindTexture(gl, 0, this.dyeCur().tex);
    bindTexture(gl, 1, this.velCur().tex);
    bindTexture(gl, 2, scalarTex);
    bindTexture(gl, 3, this.spectrum.tex);
    bindTexture(gl, 4, this.lut);
    bindTexture(gl, 5, this.divLut);
    gl.uniform1i(d.u.uMode, modeIndex);
    gl.uniform1i(d.u.uMapId, 0);
    gl.uniform1f(d.u.uScale, scale);
    gl.uniform1f(d.u.uExposure, this.params.exposure);
    gl.uniform1f(d.u.uGrid, this.params.showGrid ? 1 : 0);
    gl.uniform2f(d.u.uTexel, 1 / this.N, 1 / this.N);
    gl.uniform1i(d.u.uN, this.N);
    gl.uniform1f(d.u.uTime, time);
    blit(gl, null, this.viewport);
  }

  /** Convert a client-space pointer position to simulation UV inside the letterbox. */
  clientToUV(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / Math.max(1, r.width);
    const px = (clientX - r.left) * dpr;
    const py = (clientY - r.top) * dpr;
    const v = this.viewport;
    const x = (px - v.x) / v.w;
    const y = 1 - (py - v.y) / v.h;
    return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
  }

  pointerColor(t: number): RGB {
    return hueRGB((t * 0.06) % 1, 0.9, 0.55);
  }

  beginProfile() {
    this.profiling = true;
    this.stageTimes = {};
  }
  endProfile(): { label: string; ms: number }[] {
    this.profiling = false;
    this.gl.finish();
    const out = Object.entries(this.stageTimes).map(([label, ms]) => ({ label, ms }));
    this.stageTimes = {};
    return out;
  }

  /** Synchronous flush used for profiling boundaries. */
  sync() {
    this.gl.finish();
  }

  /** Re-render and grab the current frame as a PNG data URL. */
  snapshot(): string | null {
    try {
      this.render(performance.now() / 1000);
      this.gl.finish();
      return this.canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  destroy() {
    this.disposeField();
    const gl = this.gl;
    gl.deleteTexture(this.lut);
    gl.deleteTexture(this.divLut);
    for (const key of Object.keys(this.progs) as (keyof typeof this.progs)[]) {
      gl.deleteProgram(this.progs[key].prog);
    }
    // NB: the context is intentionally *not* lost here so that a remount
    // (React StrictMode) can keep rendering on the same canvas.
  }
}
