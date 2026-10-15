import * as shaders from "./shaders.js";
import { validateSize, stableTimeStep } from "./numerics.js";

export const DEFAULTS = Object.freeze({
  size: 1024,
  dt: 1 / 60,
  viscosity: 0.000002,
  velocityDecay: 0.08,
  densityDecay: 0.08,
  force: 1.0,
  dyeAmount: 12,
  radius: 0.025,
  bfecc: true,
  exposure: 1.1,
  palette: 0,
  view: 0,
  grid: false,
  vectors: false,
});

/** GPU-resident, periodic MAC solver. No CPU loop visits simulation cells. */
export class FluidSolver {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl)
      throw new Error(
        "This solver requires WebGL 2. Enable hardware acceleration or use a compatible browser.",
      );
    this.gl = gl;
    if (!gl.getExtension("EXT_color_buffer_float"))
      throw new Error(
        "32-bit floating-point render targets are not supported on this device.",
      );
    this.timerExt = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.config = { ...DEFAULTS, ...options };
    this.programs = {};
    for (const key of [
      "initialize",
      "forceDiffuse",
      "advect",
      "correct",
      "divergence",
      "fft",
      "poisson",
      "project",
      "diagnostics",
      "reduce",
      "display",
    ]) {
      this.programs[key] = this.program(shaders[key]);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.DITHER);
    this.targets = [];
    this.passes = 0;
    this.steps = 0;
    this.time = 0;
    this.metrics = {
      before: null,
      after: null,
      speed: null,
      dye: null,
      gpuMs: null,
      submitMs: 0,
    };
    this.pointer = {
      down: false,
      hover: false,
      point: [0.5, 0.5],
      previous: [0.5, 0.5],
      impulse: [0, 0],
      injectDye: true,
    };
    this.readback = null;
    this.timer = null;
    this.lastDiagnostic = -Infinity;
    this.lastTimer = -Infinity;
    this.resize(this.config.size);
  }

  program(fragment) {
    const gl = this.gl;
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(error);
      }
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, shaders.vertex),
      f = compile(gl.FRAGMENT_SHADER, fragment),
      p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    return { program: p, locations: new Map() };
  }
  location(program, name) {
    if (!program.locations.has(name))
      program.locations.set(
        name,
        this.gl.getUniformLocation(program.program, name),
      );
    return program.locations.get(name);
  }
  target(size, complex = false) {
    const gl = this.gl,
      texture = gl.createTexture(),
      fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texStorage2D(
      gl.TEXTURE_2D,
      1,
      complex ? gl.RG32F : gl.RGBA32F,
      size,
      size,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    if (
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE ||
      gl.getError() !== gl.NO_ERROR
    ) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
      throw new Error("GPU allocation failed. Try a smaller grid resolution.");
    }
    return { texture, fbo, size, bytes: size * size * (complex ? 8 : 16) };
  }
  lookup(size) {
    const gl = this.gl,
      texture = gl.createTexture(),
      data = new Float32Array(size * 4);
    // O(n) initialization only, not a simulation-cell or advection loop.
    // GLSL sin/cos accuracy is driver-dependent; upload accurate roots once.
    for (let k = 0; k < size; k++) {
      const theta = (2 * Math.PI * k) / size;
      data[k * 4] = Math.cos(theta);
      data[k * 4 + 1] = -Math.sin(theta);
      data[k * 4 + 2] = Math.sin((Math.PI * Math.min(k, size - k)) / size) ** 2;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, size, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, 1, gl.RGBA, gl.FLOAT, data);
    return { texture, fbo: null, bytes: size * 16 };
  }
  release(targets) {
    for (const t of targets) {
      this.gl.deleteFramebuffer(t.fbo);
      this.gl.deleteTexture(t.texture);
    }
  }
  cancelReadback() {
    if (this.readback) {
      this.gl.deleteSync(this.readback.sync);
      this.gl.deleteBuffer(this.readback.buffer);
      this.readback = null;
    }
    if (this.timer) {
      this.gl.deleteQuery(this.timer);
      this.timer = null;
    }
  }
  /** Allocate atomically; leave the old simulation intact if allocation fails. */
  resize(size) {
    const gl = this.gl;
    validateSize(size);
    if (size > gl.getParameter(gl.MAX_TEXTURE_SIZE))
      throw new Error("Grid exceeds this GPU’s maximum texture size.");
    const fresh = [];
    try {
      const state = Array.from({ length: 4 }, () => {
        const t = this.target(size);
        fresh.push(t);
        return t;
      });
      const fft = Array.from({ length: 2 }, () => {
        const t = this.target(size, true);
        fresh.push(t);
        return t;
      });
      const roots = this.lookup(size);
      fresh.push(roots);
      const pyramid = [];
      for (let n = size / 2; n >= 1; n /= 2) {
        const t = this.target(n);
        fresh.push(t);
        pyramid.push(t);
      }
      this.cancelReadback();
      this.release(this.targets);
      this.targets = fresh;
      this.roots = roots;
      this.state = state;
      this.fftBuffers = fft;
      this.pyramid = pyramid;
      this.config.size = size;
      this.bytes = fresh.reduce((s, t) => s + t.bytes, 0);
      this.pressure = fft[0];
      this.reset(this.preset ?? 0);
    } catch (error) {
      this.release(fresh);
      throw error;
    }
  }
  draw(name, target, textures = {}, uniforms = {}) {
    const gl = this.gl,
      p = this.programs[name];
    gl.bindVertexArray(this.vao);
    gl.useProgram(p.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo ?? null);
    gl.viewport(
      0,
      0,
      target?.size ?? this.canvas.width,
      target?.size ?? this.canvas.height,
    );
    gl.uniform1i(this.location(p, "uN"), this.config.size);
    let unit = 0;
    for (const [name, t] of Object.entries(textures)) {
      if (target === t)
        throw new Error(
          "GPU feedback loop: source and destination must differ.",
        );
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t.texture);
      gl.uniform1i(this.location(p, name), unit++);
    }
    for (const [name, [kind, ...value]] of Object.entries(uniforms))
      gl["uniform" + kind](this.location(p, name), ...value);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.passes++;
  }
  reset(preset = 0) {
    this.preset = preset;
    this.draw("initialize", this.state[0], {}, { uPreset: ["1i", preset] });
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.time = 0;
    this.steps = 0;
    this.metrics.before = this.metrics.after = null;
    this.cancelReadback();
    this.lastDiagnostic = -Infinity;
  }
  /** Stockham radix-2 FFT. Exactly 2 log₂(N) butterfly passes; no convergence loop. */
  transform(input, inverse = false) {
    let source = input;
    for (let axis = 0; axis < 2; axis++) {
      for (let stage = 2; stage <= this.config.size; stage *= 2) {
        const dest =
          source === this.fftBuffers[0]
            ? this.fftBuffers[1]
            : this.fftBuffers[0];
        this.draw(
          "fft",
          dest,
          { uInput: source, uRoots: this.roots },
          {
            uAxis: ["1i", axis],
            uStage: ["1i", stage],
            uInverse: ["1i", Number(inverse)],
          },
        );
        source = dest;
      }
    }
    return source;
  }
  advect(source, velocity, dest, dt, limit = false, bounds = source) {
    this.draw(
      "advect",
      dest,
      { uSource: source, uVelocity: velocity, uBounds: bounds },
      { uDt: ["1f", dt], uLimit: ["1i", Number(limit)] },
    );
  }
  step(now = performance.now()) {
    const start = performance.now(),
      c = this.config,
      n = c.size;
    // Forward-Euler diffusion stability in two dimensions: ν Δt / h² <= 1/4.
    this.effectiveDt = stableTimeStep(c.dt, c.viscosity, n);
    const dt = this.effectiveDt;
    if (!(dt > 0)) return;
    const timing = this.timerExt && !this.timer && now - this.lastTimer > 750;
    if (timing) {
      this.timer = this.gl.createQuery();
      this.gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, this.timer);
      this.lastTimer = now;
    }
    this.passes = 0;
    const [current, forced, forward, reverse] = this.state,
      p = this.pointer;
    this.draw(
      "forceDiffuse",
      forced,
      { uState: current },
      {
        uDt: ["1f", dt],
        uViscosity: ["1f", c.viscosity],
        uVelocityDecay: ["1f", c.velocityDecay],
        uDensityDecay: ["1f", c.densityDecay],
        uBrush: ["1i", Number(p.down)],
        uInjectDye: ["1i", Number(p.injectDye)],
        uPoint: ["2f", ...p.point],
        uPrevious: ["2f", ...p.previous],
        uImpulse: ["2f", p.impulse[0] * c.force, p.impulse[1] * c.force],
        uRadius: ["1f", c.radius],
        uDyeAmount: ["1f", c.dyeAmount],
      },
    );
    this.advect(forced, forced, forward, dt);
    let intermediate = forward;
    if (c.bfecc) {
      this.advect(forward, forced, reverse, -dt);
      this.draw("correct", current, { uOriginal: forced, uReverse: reverse });
      this.advect(current, forced, reverse, dt, true, forced);
      intermediate = reverse;
    }
    this.draw("divergence", this.fftBuffers[0], { uState: intermediate });
    const spectral = this.transform(this.fftBuffers[0]);
    const solution =
      spectral === this.fftBuffers[0] ? this.fftBuffers[1] : this.fftBuffers[0];
    this.draw("poisson", solution, { uInput: spectral, uRoots: this.roots });
    this.pressure = this.transform(solution, true);
    this.draw("project", current, {
      uState: intermediate,
      uPressure: this.pressure,
    });
    if (timing) this.gl.endQuery(this.timerExt.TIME_ELAPSED_EXT);
    this.lastStepPasses = this.passes;
    if (!this.readback && now - this.lastDiagnostic > 1000) {
      this.beginDiagnostics(intermediate);
      this.lastDiagnostic = now;
    }
    p.previous = [...p.point];
    p.impulse = [0, 0];
    this.time += dt;
    this.steps++;
    this.metrics.submitMs = performance.now() - start;
  }
  beginDiagnostics(intermediate) {
    this.draw("diagnostics", this.pyramid[0], {
      uState: this.state[0],
      uIntermediate: intermediate,
    });
    for (let i = 1; i < this.pyramid.length; i++)
      this.draw("reduce", this.pyramid[i], { uInput: this.pyramid[i - 1] });
    const gl = this.gl,
      buffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 16, gl.STREAM_READ);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.readback = {
      buffer,
      sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0),
    };
    gl.flush();
  }
  poll() {
    const gl = this.gl;
    if (this.timer) {
      const ready = gl.getQueryParameter(this.timer, gl.QUERY_RESULT_AVAILABLE),
        disjoint = gl.getParameter(this.timerExt.GPU_DISJOINT_EXT);
      if (disjoint) {
        gl.deleteQuery(this.timer);
        this.timer = null;
        this.metrics.gpuMs = null;
      } else if (ready) {
        this.metrics.gpuMs =
          gl.getQueryParameter(this.timer, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(this.timer);
        this.timer = null;
      }
    }
    if (this.readback) {
      const status = gl.clientWaitSync(this.readback.sync, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
        const data = new Float32Array(4);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.readback.buffer);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.deleteSync(this.readback.sync);
        gl.deleteBuffer(this.readback.buffer);
        this.readback = null;
        Object.assign(this.metrics, {
          after: Math.sqrt(data[0]),
          before: Math.sqrt(data[1]),
          speed: Math.sqrt(data[2]),
          dye: data[3],
        });
      } else if (status === gl.WAIT_FAILED) {
        gl.deleteSync(this.readback.sync);
        gl.deleteBuffer(this.readback.buffer);
        this.readback = null;
      }
    }
  }
  render() {
    const c = this.config,
      p = this.pointer;
    this.draw(
      "display",
      null,
      { uState: this.state[0], uPressure: this.pressure },
      {
        uResolution: ["2f", this.canvas.width, this.canvas.height],
        uPointer: ["2f", ...p.point],
        uRadius: ["1f", c.radius],
        uHover: ["1i", Number(p.hover)],
        uView: ["1i", c.view],
        uPalette: ["1i", c.palette],
        uExposure: ["1f", c.exposure],
        uGrid: ["1i", Number(c.grid)],
        uVectors: ["1i", Number(c.vectors)],
      },
    );
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelReadback();
    this.release(this.targets);
    for (const p of Object.values(this.programs))
      this.gl.deleteProgram(p.program);
    this.gl.deleteVertexArray(this.vao);
  }
}
