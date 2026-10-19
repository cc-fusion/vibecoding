(function(){
  /* =============================================================================
   *  Minimal WebGL Fluid Simulation
   *  Based on the approach of PavelDoGreat/WebGL-Fluid-Simulation (MIT)
   *
   *  FILE LAYOUT
   *    1. DEVELOPER CONFIG ......... tweak defaults here
   *    2. SHADERS .................. GLSL sources (custom shaders get a shared header)
   *    3. UTILITIES ................ colors, half floats
   *    4. FluidSimulation .......... the core engine + public API
   *    5. FluidExtensions .......... example plugins (input, buoyancy, obstacle, ...)
   *    6. APP ...................... dev panel + bootstrap (plain HTML/JS)
   *
   *  COORDINATES used by the public API (splat, sample, extensions):
   *    x, y in [0, 1], origin at TOP-LEFT (like the DOM), y grows downward.
   *    splat() velocity (dx, dy) follows the same convention (dy > 0 = down).
   *  RAW DATA (readField / writeField) is the GPU layout:
   *    RGBA float rows bottom-to-top; velocity.y points UP.
   * ============================================================================= */
  
  
  /* =============================================================================
   *  1. DEVELOPER CONFIG
   * ============================================================================= */
  const DEFAULT_CONFIG = {
    SIM_RESOLUTION: 128,        // velocity / pressure grid size (lower = faster)
    DYE_RESOLUTION: 1024,       // color grid size (higher = sharper)
    DENSITY_DISSIPATION: 1.0,   // how fast color fades
    VELOCITY_DISSIPATION: 0.2,  // how fast motion fades
    PRESSURE: 0.8,              // fraction of pressure kept between frames
    PRESSURE_ITERATIONS: 20,    // Jacobi iterations (accuracy vs. speed)
    CURL: 30,                   // vorticity confinement (swirliness)
    SPLAT_RADIUS: 0.25,         // splat size
    SPLAT_FORCE: 6000,          // pointer force multiplier
    SHADING: true,              // fake 3D lighting on dye
    COLORFUL: true,             // pointer color cycles over time
    PAUSED: false,              // stop stepping (rendering continues)
    BACK_COLOR: '#000000',      // background color
    DISPLAY_FIELD: 'dye',       // which field to visualize: dye | velocity | pressure | curl | divergence | <custom>
    FIELD_VIEW_SCALE: 1,        // brightness multiplier for debug field views
    MAX_DT: 1 / 60,             // max timestep (stability)
    MAX_PIXEL_RATIO: 2,         // cap devicePixelRatio for canvas size
  };
  
  // Config keys that require GPU buffers to be rebuilt when they change.
  const RESIZE_KEYS = ['SIM_RESOLUTION', 'DYE_RESOLUTION'];
  
  
  /* =============================================================================
   *  2. SHADERS
   *  Every fragment shader (including ones made with sim.createProgram) is
   *  automatically prefixed with FRAGMENT_HEADER, so you get:
   *    vUv (center), vL / vR / vT / vB (neighbors), uniform vec2 texelSize
   * ============================================================================= */
  const FRAGMENT_HEADER = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  `;
  
  const SHADERS = {
    vertex: `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }`,
  
    copy: `
      uniform sampler2D uTexture;
      void main () { gl_FragColor = texture2D(uTexture, vUv); }`,
  
    clear: `
      uniform sampler2D uTexture;
      uniform float value;
      void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`,
  
    splat: `
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }`,
  
    advection: `
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;
  
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
  
      void main () {
      #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
      #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
      #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }`,
  
    divergence: `
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }`,
  
    curl: `
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }`,
  
    vorticity: `
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }`,
  
    pressure: `
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }`,
  
    gradientSubtract: `
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }`,
  
    display: `
      uniform sampler2D uTexture;
      uniform bool uShading;
      uniform vec3 uBackColor;
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        if (uShading) {
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;
          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);
          c *= diffuse;
        }
        float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
        gl_FragColor = vec4(c + uBackColor * (1.0 - a), 1.0);
      }`,
  
    // Debug view for non-color fields. uMode 0 = vector (xy), 1 = signed scalar (x)
    displayField: `
      uniform sampler2D uTexture;
      uniform float uScale;
      uniform int uMode;
      uniform vec3 uBackColor;
      void main () {
        vec4 v = texture2D(uTexture, vUv) * uScale;
        vec3 c;
        if (uMode == 0) c = vec3(abs(v.x), abs(v.y), 0.5 * length(v.xy));
        else c = v.x > 0.0 ? vec3(1.0, 0.45, 0.1) * v.x : vec3(0.1, 0.5, 1.0) * -v.x;
        c = clamp(c, 0.0, 1.0);
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c + uBackColor * (1.0 - a), 1.0);
      }`,
  };
  
  
  /* =============================================================================
   *  3. UTILITIES
   * ============================================================================= */
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  }
  
  function hexToRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  
  // Float32 -> IEEE half float (only needed for WebGL1 uploads)
  const _f32 = new Float32Array(1), _u32 = new Uint32Array(_f32.buffer);
  function toHalf(value) {
    _f32[0] = value;
    const x = _u32[0];
    const sign = (x >>> 16) & 0x8000;
    const exp = ((x >>> 23) & 0xff) - 127 + 15;
    if (exp <= 0) return sign;
    if (exp >= 31) return sign | 0x7c00;
    return sign | (exp << 10) | ((x & 0x7fffff) >>> 13);
  }
  function toHalfArray(data) {
    const out = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = toHalf(data[i]);
    return out;
  }
  
  
  /* =============================================================================
   *  4. FluidSimulation — core engine + public API
   *
   *  LIFECYCLE      start(), stop(), step(dt), render(), destroy()
   *  CONFIG         config (live object), setConfig(patch), getConfig()
   *  INTERACTION    splat(x, y, dx, dy, color, {radius}), randomSplats(n), clear(field?)
   *  STATE I/O      readField(name), writeField(name, data|fn, w?, h?),
   *                 sample(name, x, y), getState(), setState(state)
   *  FIELDS         fields.{velocity,dye,pressure,divergence,curl}, addField(), removeField()
   *  GPU PASSES     createProgram(fragSrc, defines?), runPass(program, uniforms, target, {blend})
   *  PIPELINE       pipeline[], addStage(name, fn, {before|after}), removeStage(), setStageEnabled()
   *  EXTENSIONS     use(ext), remove(name), getExtension(name)
   *  EVENTS         on(evt, fn) / off / emit
   *                 'update' (every frame), 'beforeStep', 'afterStep', 'beforeRender',
   *                 'afterRender', 'splat', 'resize', 'config', 'pipeline', 'extensions'
   *  Extension objects may implement any event name as a method: ext.afterStep(sim, dt)
   * ============================================================================= */
  class FluidSimulation {
    constructor(canvas, config = {}) {
      this.canvas = canvas;
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.extensions = new Map();
      this.listeners = {};
      this.programs = {};
      this.fieldSpecs = {};
      this.fields = {};
      this.pipeline = [];
      this.time = 0;
      this.frame = 0;
      this.dt = 0;
      this._running = false;
      this._lastTime = performance.now();
  
      this._initContext();
      this._initGeometry();
      this._initPrograms();
      this._registerDefaultFields();
      this._resizeCanvas();
      this._initFields();
      this._registerDefaultStages();
      this._ready = true;
    }
  
    /* ---------------------------------------------------------------- setup -- */
  
    _initContext() {
      const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
      let gl = this.canvas.getContext('webgl2', params);
      const isWebGL2 = !!gl;
      if (!gl) gl = this.canvas.getContext('webgl', params) || this.canvas.getContext('experimental-webgl', params);
      if (!gl) throw new Error('WebGL is not supported in this browser.');
  
      let halfType, linearFiltering;
      if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
        halfType = gl.HALF_FLOAT;
        linearFiltering = true; // RGBA16F is always filterable in WebGL2
      } else {
        const hf = gl.getExtension('OES_texture_half_float');
        if (!hf) throw new Error('Half-float textures are not supported on this device.');
        gl.getExtension('EXT_color_buffer_half_float');
        halfType = hf.HALF_FLOAT_OES;
        linearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
      }
  
      this.gl = gl;
      this.capabilities = {
        isWebGL2,
        halfType,
        linearFiltering,
        internalFormat: isWebGL2 ? gl.RGBA16F : gl.RGBA,
      };
    }
  
    // One fullscreen quad, bound once and reused by every pass.
    _initGeometry() {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
    }
  
    _initPrograms() {
      const manual = this.capabilities.linearFiltering ? [] : ['MANUAL_FILTERING'];
      for (const name of Object.keys(SHADERS)) {
        if (name === 'vertex') continue;
        this.programs[name] = this.createProgram(SHADERS[name], name === 'advection' ? manual : []);
      }
    }
  
    _registerDefaultFields() {
      // resolution: 'sim' | 'dye' | { width, height }
      // view: how DISPLAY_FIELD visualizes it ('color' | 'vector' | 'scalar')
      this.fieldSpecs = {
        velocity:   { double: true,  resolution: 'sim', linear: true,  view: { mode: 'vector', scale: 0.003 } },
        dye:        { double: true,  resolution: 'dye', linear: true,  view: { mode: 'color',  scale: 1 } },
        pressure:   { double: true,  resolution: 'sim', linear: false, view: { mode: 'scalar', scale: 0.01 } },
        divergence: { double: false, resolution: 'sim', linear: false, view: { mode: 'scalar', scale: 0.05 } },
        curl:       { double: false, resolution: 'sim', linear: false, view: { mode: 'scalar', scale: 0.02 } },
      };
    }
  
    // The simulation step, as an ordered list of named stages.
    // Each stage is { name, run(sim, dt), enabled }. Insert your own with addStage().
    _registerDefaultStages() {
      const f = this.fields, c = this.config, p = this.programs;
      const simTexel = () => [f.velocity.texelSizeX, f.velocity.texelSizeY];
      const dyeTexel = () => [f.dye.texelSizeX, f.dye.texelSizeY];
  
      this.pipeline = [
        { name: 'curl',             run: () => this.runPass(p.curl, { uVelocity: f.velocity }, f.curl) },
        { name: 'vorticity',        run: (s, dt) => this.runPass(p.vorticity, { uVelocity: f.velocity, uCurl: f.curl, curl: c.CURL, dt }, f.velocity) },
        { name: 'divergence',       run: () => this.runPass(p.divergence, { uVelocity: f.velocity }, f.divergence) },
        { name: 'clearPressure',    run: () => this.runPass(p.clear, { uTexture: f.pressure, value: c.PRESSURE }, f.pressure) },
        { name: 'pressure',         run: () => {
            for (let i = 0; i < c.PRESSURE_ITERATIONS; i++)
              this.runPass(p.pressure, { uPressure: f.pressure, uDivergence: f.divergence }, f.pressure);
          } },
        { name: 'gradientSubtract', run: () => this.runPass(p.gradientSubtract, { uPressure: f.pressure, uVelocity: f.velocity }, f.velocity) },
        { name: 'advectVelocity',   run: (s, dt) => this.runPass(p.advection, {
            uVelocity: f.velocity, uSource: f.velocity, dyeTexelSize: simTexel(), dt, dissipation: c.VELOCITY_DISSIPATION }, f.velocity) },
        { name: 'advectDye',        run: (s, dt) => this.runPass(p.advection, {
            texelSize: simTexel(), dyeTexelSize: dyeTexel(), uVelocity: f.velocity, uSource: f.dye, dt, dissipation: c.DENSITY_DISSIPATION }, f.dye) },
      ].map(s => ({ ...s, enabled: true, builtin: true }));
    }
  
    /* ------------------------------------------------------------ lifecycle -- */
  
    start() {
      if (this._running) return this;
      this._running = true;
      this._lastTime = performance.now();
      const loop = () => {
        if (!this._running) return;
        this._tick();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
      return this;
    }
  
    stop() {
      this._running = false;
      cancelAnimationFrame(this._raf);
      return this;
    }
  
    _tick() {
      const now = performance.now();
      const dt = Math.min((now - this._lastTime) / 1000, this.config.MAX_DT);
      this._lastTime = now;
      this.dt = dt;
  
      if (this._resizeCanvas()) {
        this._initFields();
        this.emit('resize');
      }
      this.emit('update', dt);
      if (!this.config.PAUSED) this.step(dt);
      this.render();
      this.frame++;
    }
  
    /** Advance the simulation by dt seconds (runs every enabled pipeline stage). */
    step(dt = this.config.MAX_DT) {
      this.emit('beforeStep', dt);
      for (const stage of this.pipeline) if (stage.enabled) stage.run(this, dt);
      this.time += dt;
      this.emit('afterStep', dt);
      return this;
    }
  
    /** Draw the current DISPLAY_FIELD to the screen. */
    render() {
      this.emit('beforeRender');
      const name = this.fields[this.config.DISPLAY_FIELD] ? this.config.DISPLAY_FIELD : 'dye';
      const field = this.fields[name];
      const view = this.fieldSpecs[name].view || { mode: 'scalar', scale: 1 };
      const back = hexToRgb(this.config.BACK_COLOR);
  
      if (view.mode === 'color') {
        this.runPass(this.programs.display, { uTexture: field, uShading: this.config.SHADING, uBackColor: back }, null);
      } else {
        this.runPass(this.programs.displayField, {
          uTexture: field, uMode: view.mode === 'vector' ? 0 : 1,
          uScale: view.scale * this.config.FIELD_VIEW_SCALE, uBackColor: back,
        }, null);
      }
      this.emit('afterRender');
      return this;
    }
  
    destroy() {
      this.stop();
      for (const name of [...this.extensions.keys()]) this.remove(name);
      for (const f of Object.values(this.fields)) this._deleteField(f);
      for (const p of Object.values(this.programs)) this.deleteProgram(p);
      this.fields = {};
    }
  
    /* --------------------------------------------------------------- config -- */
  
    setConfig(patch) {
      Object.assign(this.config, patch);
      if (RESIZE_KEYS.some(k => k in patch)) this._initFields();
      this.emit('config', patch);
      return this;
    }
  
    getConfig() { return { ...this.config }; }
  
    get aspectRatio() { return this.canvas.width / this.canvas.height; }
  
    /* ---------------------------------------------------------- interaction -- */
  
    /**
     * Inject velocity + dye at a point.
     * x, y: [0..1], top-left origin. dx, dy: velocity (dy > 0 = down).
     * color: [r, g, b] or {r, g, b}. opts.radius overrides config.SPLAT_RADIUS.
     */
    splat(x, y, dx, dy, color = FluidSimulation.randomColor(), opts = {}) {
      const rgb = Array.isArray(color) ? color : [color.r, color.g, color.b];
      const radius = this._correctRadius((opts.radius ?? this.config.SPLAT_RADIUS) / 100);
      const common = { aspectRatio: this.aspectRatio, point: [x, 1 - y], radius };
      const { velocity, dye } = this.fields;
      this.runPass(this.programs.splat, { ...common, uTarget: velocity, color: [dx, -dy, 0] }, velocity);
      this.runPass(this.programs.splat, { ...common, uTarget: dye, color: rgb }, dye);
      this.emit('splat', { x, y, dx, dy, color: rgb });
      return this;
    }
  
    randomSplats(count = 5) {
      for (let i = 0; i < count; i++) {
        const color = FluidSimulation.randomColor(1.5);
        this.splat(Math.random(), Math.random(), 1000 * (Math.random() - 0.5), 1000 * (Math.random() - 0.5), color);
      }
      return this;
    }
  
    /** Zero a field (or all fields when called without arguments). */
    clear(name) {
      const names = name ? [name] : Object.keys(this.fields);
      for (const n of names) this.runPass(this.programs.clear, { uTexture: this.fields[n], value: 0 }, this.fields[n]);
      return this;
    }
  
    static randomColor(intensity = 0.15) {
      return hsvToRgb(Math.random(), 1, 1).map(c => c * intensity);
    }
  
    /* ------------------------------------------------------------ state I/O -- */
  
    /** Read a whole field from the GPU. Returns { width, height, data: Float32Array(RGBA) } or null. */
    readField(name) {
      const gl = this.gl, fbo = this._target(name);
      const data = new Float32Array(fbo.width * fbo.height * 4);
      gl.getError(); // clear stale errors
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.readPixels(0, 0, fbo.width, fbo.height, gl.RGBA, gl.FLOAT, data);
      if (gl.getError() !== gl.NO_ERROR) {
        console.warn('[FluidSimulation] Float readback is not supported on this device.');
        return null;
      }
      return { width: fbo.width, height: fbo.height, data };
    }
  
    /** Read a single texel at API coordinates (x, y top-left). Returns [r, g, b, a] or null. */
    sample(name, x, y) {
      const gl = this.gl, fbo = this._target(name);
      const px = Math.min(fbo.width - 1, Math.max(0, Math.floor(x * fbo.width)));
      const py = Math.min(fbo.height - 1, Math.max(0, Math.floor((1 - y) * fbo.height)));
      const out = new Float32Array(4);
      gl.getError();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.FLOAT, out);
      return gl.getError() === gl.NO_ERROR ? Array.from(out) : null;
    }
  
    /**
     * Write a field.
     *   source: Float32Array (RGBA, bottom-to-top rows) OR fn(u, v, px, py) => [r, g, b, a]
     *           where u, v are API coords (top-left origin).
     *   width/height: size of the source data (defaults to field size; resampled if different).
     */
    writeField(name, source, width, height) {
      const fbo = this._target(name);
      const w = width || fbo.width, h = height || fbo.height;
      let data = source;
  
      if (typeof source === 'function') {
        data = new Float32Array(w * h * 4);
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            const v = source((px + 0.5) / w, 1 - (py + 0.5) / h, px, py) || [0, 0, 0, 0];
            const i = (py * w + px) * 4;
            data[i] = v[0] || 0; data[i + 1] = v[1] || 0; data[i + 2] = v[2] || 0; data[i + 3] = v[3] ?? 1;
          }
        }
      }
      if (!(data instanceof Float32Array)) data = new Float32Array(data);
      if (data.length !== w * h * 4) throw new Error(`writeField: expected ${w * h * 4} floats, got ${data.length}`);
  
      if (w === fbo.width && h === fbo.height) {
        this._upload(fbo, data);
      } else {
        const tmp = this._createFBO(w, h, true);
        this._upload(tmp, data);
        this.runPass(this.programs.copy, { uTexture: tmp }, fbo);
        this._deleteField(tmp);
      }
      return this;
    }
  
    /** Snapshot of the persistent fields (velocity + dye by default). */
    getState(names = ['velocity', 'dye']) {
      const state = {};
      for (const n of names) state[n] = this.readField(n);
      return state;
    }
  
    setState(state) {
      for (const [n, f] of Object.entries(state)) if (f && this.fields[n]) this.writeField(n, f.data, f.width, f.height);
      return this;
    }
  
    /* --------------------------------------------------------------- fields -- */
  
    /**
     * Register a custom GPU field. It is created now and resized automatically.
     *   opts: { double, resolution: 'sim'|'dye'|{width,height}, linear, view: {mode, scale} }
     */
    addField(name, opts = {}) {
      this.fieldSpecs[name] = {
        double: false, resolution: 'sim', linear: true, view: { mode: 'scalar', scale: 1 }, ...opts,
      };
      if (this._ready) this._initFields();
      return this.fields[name];
    }
  
    removeField(name) {
      delete this.fieldSpecs[name];
      if (this.fields[name]) { this._deleteField(this.fields[name]); delete this.fields[name]; }
      return this;
    }
  
    _initFields() {
      const sim = this._getResolution(this.config.SIM_RESOLUTION);
      const dye = this._getResolution(this.config.DYE_RESOLUTION);
  
      for (const [name, spec] of Object.entries(this.fieldSpecs)) {
        const size = spec.resolution === 'dye' ? dye : spec.resolution === 'sim' ? sim : spec.resolution;
        const old = this.fields[name];
        if (old && old.width === size.width && old.height === size.height) continue;
  
        const field = spec.double
          ? this._createDoubleFBO(size.width, size.height, spec.linear)
          : this._createFBO(size.width, size.height, spec.linear);
  
        if (old) { // keep content when resizing
          this.runPass(this.programs.copy, { uTexture: old }, field.read || field);
          this._deleteField(old);
        }
        this.fields[name] = field;
      }
    }
  
    _getResolution(resolution) {
      const gl = this.gl;
      let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) aspect = 1 / aspect;
      const min = Math.round(resolution), max = Math.round(resolution * aspect);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? { width: max, height: min } : { width: min, height: max };
    }
  
    _resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, this.config.MAX_PIXEL_RATIO);
      const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
      if (this.canvas.width === w && this.canvas.height === h) return false;
      this.canvas.width = w;
      this.canvas.height = h;
      return true;
    }
  
    _correctRadius(radius) {
      const a = this.aspectRatio;
      return a > 1 ? radius * a : radius;
    }
  
    _target(nameOrField) {
      const f = typeof nameOrField === 'string' ? this.fields[nameOrField] : nameOrField;
      if (!f) throw new Error(`Unknown field "${nameOrField}"`);
      return f.read || f;
    }
  
    /* --------------------------------------------------------------- GPU ----- */
  
    _createFBO(w, h, linear) {
      const gl = this.gl, cap = this.capabilities;
      const filter = linear && cap.linearFiltering ? gl.LINEAR : gl.NEAREST;
  
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, cap.internalFormat, w, h, 0, gl.RGBA, cap.halfType, null);
  
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error('Rendering to half-float textures is not supported on this device.');
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
  
      return {
        texture, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); return unit; },
      };
    }
  
    // Ping-pong pair: read from .read, render into .write, then swap().
    _createDoubleFBO(w, h, linear) {
      return {
        read: this._createFBO(w, h, linear),
        write: this._createFBO(w, h, linear),
        width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        swap() { const t = this.read; this.read = this.write; this.write = t; },
      };
    }
  
    _deleteField(f) {
      const gl = this.gl;
      for (const fbo of f.read ? [f.read, f.write] : [f]) {
        gl.deleteTexture(fbo.texture);
        gl.deleteFramebuffer(fbo.fbo);
      }
    }
  
    _upload(fbo, data) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
      if (this.capabilities.isWebGL2) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, fbo.width, fbo.height, gl.RGBA, gl.FLOAT, data);
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, fbo.width, fbo.height, gl.RGBA, this.capabilities.halfType, toHalfArray(data));
    }
  
    _compile(type, source, defines = []) {
      const gl = this.gl;
      const prefix = defines.map(d => `#define ${d}\n`).join('');
      const header = type === gl.FRAGMENT_SHADER ? FRAGMENT_HEADER : '';
      const shader = gl.createShader(type);
      gl.shaderSource(shader, prefix + header + source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error('Shader compile error:\n' + gl.getShaderInfoLog(shader));
      return shader;
    }
  
    /**
     * Compile a fragment shader into a program usable with runPass().
     * The shared FRAGMENT_HEADER (vUv, vL/vR/vT/vB, texelSize) is prepended automatically.
     */
    createProgram(fragmentSource, defines = []) {
      const gl = this.gl;
      this._vertexShader = this._vertexShader || this._compile(gl.VERTEX_SHADER, SHADERS.vertex);
      const fs = this._compile(gl.FRAGMENT_SHADER, fragmentSource, defines);
  
      const program = gl.createProgram();
      gl.attachShader(program, this._vertexShader);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, 'aPosition');
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Program link error:\n' + gl.getProgramInfoLog(program));
  
      const uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i);
        uniforms[info.name] = { location: gl.getUniformLocation(program, info.name), type: info.type };
      }
      return { program, uniforms };
    }
  
    deleteProgram(p) { if (p) this.gl.deleteProgram(p.program); }
  
    /**
     * Run a fullscreen shader pass.
     *   program:  object from createProgram() (or name in this.programs)
     *   uniforms: { name: value } — fields/FBOs are bound as textures automatically,
     *             numbers/booleans/arrays are set according to the GLSL type.
     *             texelSize defaults to the target's texel size.
     *   target:   field / FBO / field name, or null for the screen.
     *             Double (ping-pong) targets are written and swapped automatically.
     *   options:  { blend: true } for alpha blending (overlays)
     */
    runPass(program, uniforms = {}, target = null, { blend = false } = {}) {
      const gl = this.gl;
      if (typeof program === 'string') program = this.programs[program];
      if (typeof target === 'string') target = this.fields[target];
      const out = target ? (target.write || target) : null;
  
      gl.useProgram(program.program);
      const texel = out ? [out.texelSizeX, out.texelSizeY] : [1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight];
      const all = { texelSize: texel, ...uniforms };
  
      let unit = 0;
      for (const name in all) {
        const u = program.uniforms[name];
        if (!u) continue;
        const v = all[name];
        if (v && typeof v === 'object' && (v.read || v.texture)) gl.uniform1i(u.location, (v.read || v).attach(unit++));
        else this._setUniform(u, v);
      }
  
      if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      if (out) { gl.viewport(0, 0, out.width, out.height); gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo); }
      else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      if (blend) gl.disable(gl.BLEND);
  
      if (target && target.swap) target.swap();
    }
  
    _setUniform(u, value) {
      const gl = this.gl, l = u.location;
      switch (u.type) {
        case gl.FLOAT:      gl.uniform1f(l, Number(value)); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(l, value); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(l, value); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(l, value); break;
        default:            gl.uniform1i(l, Number(value)); // int, bool, sampler
      }
    }
  
    /* ------------------------------------------------------------- pipeline -- */
  
    /** Insert a stage: fn(sim, dt). opts: { before: 'stageName' } or { after: 'stageName' } (default: end). */
    addStage(name, run, { before, after } = {}) {
      this.removeStage(name, true);
      const stage = { name, run, enabled: true, builtin: false };
      const ref = before ?? after;
      let idx = ref ? this.pipeline.findIndex(s => s.name === ref) : -1;
      if (idx === -1) this.pipeline.push(stage);
      else this.pipeline.splice(after ? idx + 1 : idx, 0, stage);
      this.emit('pipeline');
      return this;
    }
  
    removeStage(name, silent = false) {
      const i = this.pipeline.findIndex(s => s.name === name);
      if (i !== -1) { this.pipeline.splice(i, 1); if (!silent) this.emit('pipeline'); }
      return this;
    }
  
    setStageEnabled(name, enabled) {
      const s = this.pipeline.find(s => s.name === name);
      if (s) { s.enabled = enabled; this.emit('pipeline'); }
      return this;
    }
  
    /* ----------------------------------------------------------- extensions -- */
  
    /**
     * Install an extension: { name, init?(sim), destroy?(sim), <event>?(sim, ...args) }
     * Any event name can be a method: update, beforeStep, afterStep, beforeRender, afterRender, splat, resize...
     */
    use(ext) {
      if (!ext || !ext.name) throw new Error('Extensions need a unique "name"');
      if (this.extensions.has(ext.name)) this.remove(ext.name);
      this.extensions.set(ext.name, ext);
      if (ext.init) ext.init(this);
      this.emit('extensions');
      return this;
    }
  
    remove(name) {
      const ext = this.extensions.get(name);
      if (!ext) return this;
      if (ext.destroy) ext.destroy(this);
      this.extensions.delete(name);
      this.emit('extensions');
      return this;
    }
  
    getExtension(name) { return this.extensions.get(name); }
  
    /* --------------------------------------------------------------- events -- */
  
    on(event, fn) {
      (this.listeners[event] = this.listeners[event] || []).push(fn);
      return () => this.off(event, fn);
    }
  
    off(event, fn) {
      this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn);
      return this;
    }
  
    emit(event, ...args) {
      for (const ext of this.extensions.values()) if (typeof ext[event] === 'function') ext[event](this, ...args);
      for (const fn of this.listeners[event] || []) fn(this, ...args);
    }
  }
  
  
  /* =============================================================================
   *  5. FluidExtensions — example plugins. Copy one to start your own.
   * ============================================================================= */
  const FluidExtensions = {
  
    /** Mouse / touch input -> splats. Input is just an extension; remove it for a "headless" sim. */
    pointer() {
      return {
        name: 'pointer',
        pointers: new Map(),
        init(sim) {
          const c = sim.canvas;
          const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
          this._down = e => {
            const [x, y] = pos(e);
            this.pointers.set(e.pointerId, { x, y, px: x, py: y, moved: false, color: FluidSimulation.randomColor(), timer: 0 });
          };
          this._move = e => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            [p.x, p.y] = pos(e);
            p.moved = true;
          };
          this._up = e => this.pointers.delete(e.pointerId);
          c.addEventListener('pointerdown', this._down);
          window.addEventListener('pointermove', this._move);
          window.addEventListener('pointerup', this._up);
          window.addEventListener('pointercancel', this._up);
        },
        update(sim, dt) {
          for (const p of this.pointers.values()) {
            if (sim.config.COLORFUL && (p.timer += dt * 10) >= 1) { p.timer = 0; p.color = FluidSimulation.randomColor(); }
            if (!p.moved) continue;
            p.moved = false;
            let dx = p.x - p.px, dy = p.y - p.py;
            p.px = p.x; p.py = p.y;
            const a = sim.aspectRatio;
            if (a < 1) dx *= a;
            if (a > 1) dy /= a;
            sim.splat(p.x, p.y, dx * sim.config.SPLAT_FORCE, dy * sim.config.SPLAT_FORCE, p.color);
          }
        },
        destroy(sim) {
          sim.canvas.removeEventListener('pointerdown', this._down);
          window.removeEventListener('pointermove', this._move);
          window.removeEventListener('pointerup', this._up);
          window.removeEventListener('pointercancel', this._up);
        },
      };
    },
  
    /** Periodic random splats — uses the 'update' hook only. */
    autoSplats({ interval = 1.5, count = 2 } = {}) {
      return {
        name: 'autoSplats',
        interval, count, timer: 0,
        update(sim, dt) {
          if (sim.config.PAUSED) return;
          if ((this.timer += dt) >= this.interval) { this.timer = 0; sim.randomSplats(this.count); }
        },
      };
    },
  
    /** Bright dye rises — demonstrates a custom shader inserted as a pipeline stage. */
    buoyancy({ strength = 800 } = {}) {
      return {
        name: 'buoyancy',
        strength,
        init(sim) {
          this.program = sim.createProgram(`
            uniform sampler2D uVelocity;
            uniform sampler2D uDye;
            uniform float uStrength;
            uniform float dt;
            void main () {
              vec2 v = texture2D(uVelocity, vUv).xy;
              vec3 d = texture2D(uDye, vUv).rgb;
              v.y += uStrength * (d.r + d.g + d.b) / 3.0 * dt;
              gl_FragColor = vec4(v, 0.0, 1.0);
            }`);
          sim.addStage('buoyancy', (s, dt) => s.runPass(this.program, {
            uVelocity: s.fields.velocity, uDye: s.fields.dye, uStrength: this.strength, dt,
          }, s.fields.velocity), { before: 'curl' });
        },
        destroy(sim) { sim.removeStage('buoyancy'); sim.deleteProgram(this.program); },
      };
    },
  
    /** Circular obstacle — a pipeline stage (masking) + an afterRender overlay. Move it via ext.center. */
    obstacle({ x = 0.5, y = 0.5, radius = 0.08 } = {}) {
      return {
        name: 'obstacle',
        center: [x, y], radius,
        init(sim) {
          this.mask = sim.createProgram(`
            uniform sampler2D uTarget;
            uniform vec2 uCenter;
            uniform float uRadius;
            uniform float aspectRatio;
            void main () {
              vec2 p = vUv - uCenter; p.x *= aspectRatio;
              float m = smoothstep(uRadius * 0.95, uRadius, length(p));
              gl_FragColor = texture2D(uTarget, vUv) * m;
            }`);
          this.overlay = sim.createProgram(`
            uniform vec2 uCenter;
            uniform float uRadius;
            uniform float aspectRatio;
            void main () {
              vec2 p = vUv - uCenter; p.x *= aspectRatio;
              float d = length(p);
              float ring = 1.0 - smoothstep(0.0, 0.003, abs(d - uRadius));
              float fill = (1.0 - step(uRadius, d)) * 0.08;
              gl_FragColor = vec4(1.0, 1.0, 1.0, max(ring * 0.7, fill));
            }`);
          sim.addStage('obstacle', s => {
            const u = this._uniforms(s);
            s.runPass(this.mask, { ...u, uTarget: s.fields.velocity }, s.fields.velocity);
            s.runPass(this.mask, { ...u, uTarget: s.fields.dye }, s.fields.dye);
          }, { after: 'advectDye' });
        },
        _uniforms(sim) {
          return { uCenter: [this.center[0], 1 - this.center[1]], uRadius: this.radius, aspectRatio: sim.aspectRatio };
        },
        afterRender(sim) { sim.runPass(this.overlay, this._uniforms(sim), null, { blend: true }); },
        destroy(sim) { sim.removeStage('obstacle'); sim.deleteProgram(this.mask); sim.deleteProgram(this.overlay); },
      };
    },
  
    /** Reads velocity + dye under the cursor every frame — demonstrates the read API. */
    probe() {
      return {
        name: 'probe',
        x: 0.5, y: 0.5, velocity: null, dye: null,
        init(sim) {
          this._move = e => {
            const r = sim.canvas.getBoundingClientRect();
            this.x = (e.clientX - r.left) / r.width;
            this.y = (e.clientY - r.top) / r.height;
          };
          window.addEventListener('pointermove', this._move);
        },
        afterRender(sim) {
          this.velocity = sim.sample('velocity', this.x, this.y);
          this.dye = sim.sample('dye', this.x, this.y);
        },
        destroy() { window.removeEventListener('pointermove', this._move); },
      };
    },
  };
  
  // ============================================================
  // Public API exports
  // ============================================================

  FluidSimulation.version = '1.0.0';

  FluidSimulation.defaults = Object.freeze({ ...DEFAULT_CONFIG });

  /**
   * Create a simulation from a canvas element or CSS selector.
   */
  FluidSimulation.create = function (canvas, config = {}) {
    if (typeof canvas === 'string') {
      canvas = document.querySelector(canvas);
    }

    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError(
        'FluidSimulation.create() requires a valid canvas element or selector.'
      );
    }

    return new FluidSimulation(canvas, config);
  };

  // Export constructors
  window.FluidSimulation = FluidSimulation;
  window.FluidExtensions = FluidExtensions;
})();
