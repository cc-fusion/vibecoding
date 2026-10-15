/* ============================================================================
 * fluid-simulation.js  ·  v1.0.0
 * ----------------------------------------------------------------------------
 * A self-contained, GPU-accelerated WebGL fluid simulation API, based on the
 * classic single-file "WebGL Fluid Simulation". Implements a Navier–Stokes
 * solver (Jos Stam's "Stable Fluids") entirely on the GPU:
 * advection → vorticity confinement → pressure solve → gradient subtraction.
 *
 * Usage:
 *   <script src="fluid-simulation.js"></script>
 *   <script>
 *     const fluid = new FluidSimulation(document.querySelector('canvas'));
 *   </script>
 *
 * License: MIT
 * ========================================================================== */
(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        global.FluidSimulation = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* =============================== defaults ================================ */

const DEFAULT_CONFIG = {
    SIM_RESOLUTION: 128,          // velocity/pressure grid resolution
    DYE_RESOLUTION: 1024,         // color (dye) grid resolution
    DENSITY_DISSIPATION: 1.0,     // how fast the dye fades
    VELOCITY_DISSIPATION: 0.2,    // how fast motion decays
    PRESSURE: 0.8,                // pressure retention between frames (0..1)
    PRESSURE_ITERATIONS: 20,      // Jacobi solver iterations per frame
    CURL: 30,                     // vorticity confinement strength (swirl)
    SPLAT_RADIUS: 0.25,           // splat size
    SPLAT_FORCE: 6000,            // pointer force multiplier
    SHADING: true,                // fake directional lighting on the dye
    COLORFUL: true,               // periodically cycle pointer colors
    COLOR_UPDATE_SPEED: 10,       // color cycling speed
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: true,
    INTERACTIVE: true,            // enable pointer/touch interaction
    INTERACT_ON_HOVER: false,     // stir without pressing
    AUTO_SPLATS: true             // initial random burst so it's alive on load
};

/* ================================ shaders ================================ */

const BASE_VERTEX_SHADER = `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`;

const COPY_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`;

const CLEAR_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`;

const SPLAT_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`;

const ADVECTION_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
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
    }
`;

const DIVERGENCE_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
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
    }
`;

const CURL_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`;

const VORTICITY_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
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
    }
`;

const PRESSURE_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
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
    }
`;

const GRADIENT_SUBTRACT_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
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
    }
`;

const DISPLAY_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform vec2 texelSize;
    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
    #ifdef SHADING
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;
        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);
        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);
        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
        c *= diffuse;
    #endif
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c, a);
    }
`;

/* ================================ helpers ================================ */

function clamp01 (v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clampNum (v, min, max) {
    v = Number(v);
    if (!isFinite(v)) return min;
    return v < min ? min : v > max ? max : v;
}
function clampInt (v, min, max) { return Math.round(clampNum(v, min, max)); }

function isTouchDevice () {
    return typeof window !== 'undefined' &&
        ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
}

function hsvToRgb (h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r, g, b };
}

/** Random vibrant color, pre-darkened to a good dye intensity. */
function generateColor () {
    const c = hsvToRgb(Math.random(), 1.0, 1.0);
    c.r *= 0.15; c.g *= 0.15; c.b *= 0.15;
    return c;
}

/** Accepts {r,g,b} (0..1), [r,g,b] or '#hex' / 'hex' strings. */
function parseColor (value) {
    if (value == null) return null;
    if (typeof value === 'string') {
        let hex = value.trim().replace(/^#/, '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
        const n = parseInt(hex, 16);
        return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
    }
    if (Array.isArray(value) && value.length >= 3) {
        return { r: Number(value[0]) || 0, g: Number(value[1]) || 0, b: Number(value[2]) || 0 };
    }
    if (typeof value === 'object') {
        return { r: Number(value.r) || 0, g: Number(value.g) || 0, b: Number(value.b) || 0 };
    }
    return null;
}

/* ============================ WebGL utilities ============================ */

function supportRenderTextureFormat (gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMBUFFER);

    gl.deleteTexture(texture);
    gl.deleteFramebuffer(fbo);
    return status === gl.FRAMEBUFFER_COMPLETE;
}

function getSupportedFormat (gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        if (internalFormat === gl.R16F) return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        if (internalFormat === gl.RG16F) return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        return null;
    }
    return { internalFormat, format };
}

function getWebGLContext (canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) {
        gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }
    if (!gl) return { gl: null, ext: null };

    let halfFloatTexType, supportLinearFiltering, formatRGBA, formatRG, formatR;

    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('EXT_color_buffer_half_float');
        supportLinearFiltering = true; // 16F textures are filterable in WebGL2 core
        halfFloatTexType = gl.HALF_FLOAT;
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG   = getSupportedFormat(gl, gl.RG16F,   gl.RG,   halfFloatTexType);
        formatR    = getSupportedFormat(gl, gl.R16F,    gl.RED,  halfFloatTexType);
    } else {
        const halfFloat = gl.getExtension('OES_texture_half_float');
        if (!halfFloat) return { gl, ext: null };
        supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
        halfFloatTexType = halfFloat.HALF_FLOAT_OES;
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG   = formatRGBA;
        formatR    = formatRGBA;
    }

    if (!formatRGBA || !formatRG || !formatR) return { gl, ext: null };

    return {
        gl,
        ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering, isWebGL2 }
    };
}

function compileShader (gl, type, source, keywords) {
    let src = '';
    if (keywords) {
        for (const k of keywords) src += '#define ' + k + '\n';
    }
    src += source;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('FluidSimulation shader error:', gl.getShaderInfoLog(shader));
        throw new Error('FluidSimulation: shader compile failed');
    }
    return shader;
}

function createProgram (gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('FluidSimulation program error:', gl.getProgramInfoLog(program));
        throw new Error('FluidSimulation: program link failed');
    }
    return program;
}

function getUniforms (gl, program) {
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i);
        if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return uniforms;
}

class Program {
    constructor (gl, vertexShader, fragmentShader) {
        this.gl = gl;
        this.program = createProgram(gl, vertexShader, fragmentShader);
        this.uniforms = getUniforms(gl, this.program);
    }
    bind () { this.gl.useProgram(this.program); }
}

/* ============================ main API class ============================= */

class FluidSimulation {
    /**
     * @param {HTMLCanvasElement|null} canvas  Target canvas. If omitted, a
     *   detached canvas is created for you (exposed as `fluid.canvas`).
     * @param {Object} options  Any keys from DEFAULT_CONFIG.
     */
    constructor (canvas = null, options = {}) {
        this._listeners = {};
        this.config = Object.assign({}, DEFAULT_CONFIG, options || {});
        this.pointers = [];
        this.splatQueue = [];
        this.supported = false;
        this.destroyed = false;
        this.paused = !!this.config.PAUSED;
        this._colorTimer = 0;
        this._initEmitted = false;
        this._handlers = null;

        if (typeof document === 'undefined') {
            this._fail(new Error('FluidSimulation requires a browser environment.'));
            return;
        }

        if (!canvas) canvas = document.createElement('canvas');
        this.canvas = canvas;

        // Sensible mobile defaults
        if (isTouchDevice() && options && options.DYE_RESOLUTION == null) {
            this.config.DYE_RESOLUTION = 512;
        }
        this.config.BACK_COLOR = parseColor(this.config.BACK_COLOR) || { r: 0, g: 0, b: 0 };

        const ctx = getWebGLContext(canvas);
        if (!ctx.gl || !ctx.ext) {
            this._fail(new Error('WebGL fluid simulation unavailable: this browser does not support WebGL with half-float render targets.'));
            return;
        }

        this.supported = true;
        this.gl = ctx.gl;
        this.ext = ctx.ext;

        this._buildPrograms();
        this._buildBuffers();
        this._resizeCanvas();
        this._initFramebuffers();
        this._bindEvents();

        this._update = this._update.bind(this);
        this._lastTime = performance.now();
        this._raf = requestAnimationFrame(this._update);

        if (this.config.AUTO_SPLATS) {
            this.randomSplats(Math.floor(Math.random() * 10) + 5);
        }
    }

    /* ----------------------------- lifecycle ----------------------------- */

    start ()    { return this.resume(); }
    resume ()   { this.paused = false; return this; }
    pause ()    { this.paused = true;  return this; }
    togglePaused () { this.paused = !this.paused; return this.paused; }

    /** Wipe all dye and velocity. */
    clear () {
        if (this.supported && !this.destroyed) this._initFramebuffers(true);
        return this;
    }

    /** Re-check the canvas CSS size against its backing store. */
    resize () {
        if (this.supported && !this.destroyed && this._resizeCanvas()) this._initFramebuffers();
        return this;
    }

    /** Render the current frame and return it as a data URL. */
    screenshot (type = 'image/png', quality) {
        if (!this.supported || this.destroyed) return null;
        this.render();
        return this.canvas.toDataURL(type, quality);
    }

    /** Stop the loop, remove listeners, free GL resources. */
    destroy () {
        if (this.destroyed) return;
        this.destroyed = true;
        cancelAnimationFrame(this._raf);
        this._unbindEvents();
        if (this.gl) {
            try {
                const gl = this.gl;
                this._deleteDoubleFBO(this.dye);
                this._deleteDoubleFBO(this.velocity);
                this._deleteFBO(this.divergenceFBO);
                this._deleteFBO(this.curlFBO);
                this._deleteDoubleFBO(this.pressure);
                gl.deleteBuffer(this._quadBuffer);
                gl.deleteBuffer(this._quadIndexBuffer);
                const programs = [
                    this.copyProgram, this.clearProgram, this.splatProgram,
                    this.advectionProgram, this.divergenceProgram, this.curlProgram,
                    this.vorticityProgram, this.pressureProgram, this.gradientProgram,
                    this.displayProgram
                ];
                for (const p of programs) { if (p) gl.deleteProgram(p.program); }
                const lose = gl.getExtension('WEBGL_lose_context');
                if (lose) lose.loseContext();
            } catch (e) { /* best effort */ }
        }
        this.splatQueue = [];
        this.pointers = [];
        this._emit('destroy', this);
        this._listeners = {};
    }

    /* --------------------------- splat methods --------------------------- */

    /**
     * Inject dye + momentum at a point.
     * @param {number} x  0..1, origin at BOTTOM-LEFT
     * @param {number} y  0..1
     * @param {number} dx  horizontal impulse (simulation units, e.g. ±200–2000)
     * @param {number} dy  vertical impulse (+dy pushes UP)
     * @param {{r,g,b}} [color]  floats; >1 = brighter. Random if omitted.
     */
    splat (x, y, dx = 0, dy = 0, color) {
        if (!this.supported || this.destroyed) return this;
        const c = color || generateColor();
        this.splatQueue.push({
            x: clamp01(x), y: clamp01(y),
            dx, dy,
            color: { r: Number(c.r) || 0, g: Number(c.g) || 0, b: Number(c.b) || 0 }
        });
        return this;
    }

    /**
     * Fire `count` splats at random positions/directions.
     * @param {number} count
     * @param {{color?:{r,g,b}, intensity?:number}} [options]
     */
    randomSplats (count, options = {}) {
        count = Math.max(1, Math.round(count || 10));
        const intensity = options.intensity != null ? options.intensity : 10;
        for (let i = 0; i < count; i++) {
            const base = options.color ? Object.assign({}, options.color) : generateColor();
            this.splat(
                Math.random(), Math.random(),
                1000 * (Math.random() - 0.5),
                1000 * (Math.random() - 0.5),
                { r: base.r * intensity, g: base.g * intensity, b: base.b * intensity }
            );
        }
        return this;
    }

    /* ------------------------------ config ------------------------------- */

    /** Merge new options into the live config (validated). */
    setConfig (options) {
        if (!options || this.destroyed) return this;
        const cfg = this.config;
        for (const key of Object.keys(options)) {
            if (!(key in DEFAULT_CONFIG)) continue;
            let value = options[key];
            switch (key) {
                case 'BACK_COLOR':          value = parseColor(value) || cfg.BACK_COLOR; break;
                case 'SIM_RESOLUTION':
                case 'DYE_RESOLUTION':      value = clampInt(value, 16, 4096); break;
                case 'PRESSURE':            value = clampNum(value, 0, 1); break;
                case 'PRESSURE_ITERATIONS': value = clampInt(value, 1, 60); break;
                case 'CURL':                value = clampNum(value, 0, 100); break;
                case 'SPLAT_RADIUS':        value = clampNum(value, 0.01, 1); break;
                case 'SPLAT_FORCE':         value = clampNum(value, 0, 20000); break;
                case 'DENSITY_DISSIPATION':
                case 'VELOCITY_DISSIPATION':value = clampNum(value, 0, 10); break;
                case 'COLOR_UPDATE_SPEED':  value = clampNum(value, 0, 100); break;
            }
            cfg[key] = value;
        }
        if (this.supported) {
            if ('SHADING' in options) this._buildDisplayProgram();
            if ('SIM_RESOLUTION' in options || 'DYE_RESOLUTION' in options) this._initFramebuffers();
            if ('PAUSED' in options) this.paused = !!cfg.PAUSED;
        }
        return this;
    }

    /** Snapshot of the current configuration. */
    getConfig () {
        return Object.assign({}, this.config, { BACK_COLOR: Object.assign({}, this.config.BACK_COLOR) });
    }

    /* ------------------------------- events ------------------------------ */

    on (event, fn) {
        (this._listeners[event] = this._listeners[event] || []).push(fn);
        return this;
    }
    once (event, fn) {
        const wrapper = (...args) => { this.off(event, wrapper); fn.apply(this, args); };
        return this.on(event, wrapper);
    }
    off (event, fn) {
        const list = this._listeners[event];
        if (!list) return this;
        if (!fn) { delete this._listeners[event]; return this; }
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
        return this;
    }
    _emit (event, data) {
        const list = this._listeners[event];
        if (!list) return;
        for (const fn of list.slice()) {
            try { fn.call(this, data); } catch (err) { console.error('FluidSimulation listener error:', err); }
        }
    }
    _fail (err) {
        this.supported = false;
        setTimeout(() => this._emit('error', err), 0);
    }

    /* ---------------------------- GL internals --------------------------- */

    _buildPrograms () {
        const gl = this.gl;
        const vs = compileShader(gl, gl.VERTEX_SHADER, BASE_VERTEX_SHADER);
        const frag = (src, kw) => compileShader(gl, gl.FRAGMENT_SHADER, src, kw);

        this.copyProgram       = new Program(gl, vs, frag(COPY_SHADER));
        this.clearProgram      = new Program(gl, vs, frag(CLEAR_SHADER));
        this.splatProgram      = new Program(gl, vs, frag(SPLAT_SHADER));
        this.advectionProgram  = new Program(gl, vs, frag(ADVECTION_SHADER, this.ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']));
        this.divergenceProgram = new Program(gl, vs, frag(DIVERGENCE_SHADER));
        this.curlProgram       = new Program(gl, vs, frag(CURL_SHADER));
        this.vorticityProgram  = new Program(gl, vs, frag(VORTICITY_SHADER));
        this.pressureProgram   = new Program(gl, vs, frag(PRESSURE_SHADER));
        this.gradientProgram   = new Program(gl, vs, frag(GRADIENT_SUBTRACT_SHADER));
        this._buildDisplayProgram();
    }

    _buildDisplayProgram () {
        const gl = this.gl;
        if (this.displayProgram) {
            try { gl.deleteProgram(this.displayProgram.program); } catch (e) {}
        }
        const vs = compileShader(gl, gl.VERTEX_SHADER, BASE_VERTEX_SHADER);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, DISPLAY_SHADER, this.config.SHADING ? ['SHADING'] : null);
        this.displayProgram = new Program(gl, vs, fs);
    }

    _buildBuffers () {
        const gl = this.gl;
        this._quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        this._quadIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._quadIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    }

    _blit (target) {
        const gl = this.gl;
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._quadIndexBuffer);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    _createFBO (w, h, internalFormat, format, type, filter) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        return {
            texture, fbo, width: w, height: h,
            texelSizeX: 1 / w, texelSizeY: 1 / h,
            attach: (id) => {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    _createDoubleFBO (w, h, internalFormat, format, type, filter) {
        let fbo1 = this._createFBO(w, h, internalFormat, format, type, filter);
        let fbo2 = this._createFBO(w, h, internalFormat, format, type, filter);
        return {
            width: w, height: h,
            texelSizeX: 1 / w, texelSizeY: 1 / h,
            get read () { return fbo1; },  set read (v) { fbo1 = v; },
            get write () { return fbo2; }, set write (v) { fbo2 = v; },
            swap () { const t = fbo1; fbo1 = fbo2; fbo2 = t; }
        };
    }

    _resizeFBO (target, w, h, internalFormat, format, type, filter) {
        const newFBO = this._createFBO(w, h, internalFormat, format, type, filter);
        this.copyProgram.bind();
        this._u1i(this.copyProgram, 'uTexture', target.attach(0));
        this._blit(newFBO);
        this._deleteFBO(target);
        return newFBO;
    }

    _resizeDoubleFBO (target, w, h, internalFormat, format, type, filter) {
        if (target.width === w && target.height === h) return target;
        target.read = this._resizeFBO(target.read, w, h, internalFormat, format, type, filter);
        target.write = this._createFBO(w, h, internalFormat, format, type, filter);
        target.width = w; target.height = h;
        target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
        return target;
    }

    _deleteFBO (f) {
        if (!f || !this.gl) return;
        this.gl.deleteTexture(f.texture);
        this.gl.deleteFramebuffer(f.fbo);
    }
    _deleteDoubleFBO (d) {
        if (!d) return;
        this._deleteFBO(d.read);
        this._deleteFBO(d.write);
    }

    _initFramebuffers (force = false) {
        const gl = this.gl, ext = this.ext;
        const simRes = this._getResolution(this.config.SIM_RESOLUTION);
        const dyeRes = this._getResolution(this.config.DYE_RESOLUTION);
        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
        const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

        gl.disable(gl.BLEND);

        if (force) {
            this._deleteDoubleFBO(this.dye);       this.dye = null;
            this._deleteDoubleFBO(this.velocity);  this.velocity = null;
            this._deleteFBO(this.divergenceFBO);   this.divergenceFBO = null;
            this._deleteFBO(this.curlFBO);         this.curlFBO = null;
            this._deleteDoubleFBO(this.pressure);  this.pressure = null;
        }

        this.dye = this.dye
            ? this._resizeDoubleFBO(this.dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering)
            : this._createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);

        this.velocity = this.velocity
            ? this._resizeDoubleFBO(this.velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering)
            : this._createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);

        this._deleteFBO(this.divergenceFBO);
        this._deleteFBO(this.curlFBO);
        this._deleteDoubleFBO(this.pressure);

        this.divergenceFBO = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
        this.curlFBO       = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
        this.pressure      = this._createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    _getResolution (resolution) {
        const gl = this.gl;
        let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
        const min = Math.round(resolution);
        const max = Math.round(resolution * aspectRatio);
        return gl.drawingBufferWidth > gl.drawingBufferHeight
            ? { width: max, height: min }
            : { width: min, height: max };
    }

    _resizeCanvas () {
        const canvas = this.canvas;
        if (!canvas.clientWidth || !canvas.clientHeight) return false; // not laid out yet
        const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
        const w = Math.floor(canvas.clientWidth * dpr);
        const h = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            return true;
        }
        return false;
    }

    /* ---------------------------- input events --------------------------- */

    _bindEvents () {
        const canvas = this.canvas;
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        const H = this._handlers = {};

        if (typeof window !== 'undefined' && window.PointerEvent) {
            H.down  = (e) => this._pointerDown(e.pointerId, e);
            H.move  = (e) => this._pointerMove(e.pointerId, e);
            H.up    = (e) => this._pointerUp(e.pointerId, e.pointerType === 'touch');
            H.leave = (e) => { const p = this._getPointer(e.pointerId); if (p) p.hasPos = false; };
            canvas.addEventListener('pointerdown', H.down);
            window.addEventListener('pointermove', H.move);
            window.addEventListener('pointerup', H.up);
            window.addEventListener('pointercancel', H.up);
            canvas.addEventListener('pointerleave', H.leave);
        } else {
            H.mdown = (e) => this._pointerDown(-1, e);
            H.mmove = (e) => this._pointerMove(-1, e);
            H.mup   = ()  => this._pointerUp(-1, false);
            canvas.addEventListener('mousedown', H.mdown);
            window.addEventListener('mousemove', H.mmove);
            window.addEventListener('mouseup', H.mup);
            H.tstart = (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) this._pointerDown(t.identifier, t); };
            H.tmove  = (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) this._pointerMove(t.identifier, t); };
            H.tend   = (e) => { for (const t of Array.from(e.changedTouches)) this._pointerUp(t.identifier, true); };
            canvas.addEventListener('touchstart', H.tstart, { passive: false });
            canvas.addEventListener('touchmove', H.tmove, { passive: false });
            canvas.addEventListener('touchend', H.tend);
            canvas.addEventListener('touchcancel', H.tend);
        }
    }

    _unbindEvents () {
        const H = this._handlers;
        const canvas = this.canvas;
        if (!H) return;
        if (H.down) {
            canvas.removeEventListener('pointerdown', H.down);
            window.removeEventListener('pointermove', H.move);
            window.removeEventListener('pointerup', H.up);
            window.removeEventListener('pointercancel', H.up);
            canvas.removeEventListener('pointerleave', H.leave);
        } else {
            canvas.removeEventListener('mousedown', H.mdown);
            window.removeEventListener('mousemove', H.mmove);
            window.removeEventListener('mouseup', H.mup);
            canvas.removeEventListener('touchstart', H.tstart);
            canvas.removeEventListener('touchmove', H.tmove);
            canvas.removeEventListener('touchend', H.tend);
            canvas.removeEventListener('touchcancel', H.tend);
        }
        this._handlers = null;
    }

    _getPointer (id) { return this.pointers.find(p => p.id === id); }

    _createPointer (id) {
        return {
            id, down: false, hasPos: false,
            texcoordX: 0, texcoordY: 0,
            prevTexcoordX: 0, prevTexcoordY: 0,
            color: generateColor()
        };
    }

    _eventToTexcoord (e) {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width || 1, h = rect.height || 1;
        return {
            x: (e.clientX - rect.left) / w,
            y: 1 - (e.clientY - rect.top) / h   // flip: GL origin is bottom-left
        };
    }

    _pointerDown (id, e) {
        if (!this.config.INTERACTIVE) return;
        let p = this._getPointer(id);
        if (!p) { p = this._createPointer(id); this.pointers.push(p); }
        p.down = true;
        const raw = this._eventToTexcoord(e);
        const x = clamp01(raw.x), y = clamp01(raw.y);
        p.texcoordX = p.prevTexcoordX = x;
        p.texcoordY = p.prevTexcoordY = y;
        p.hasPos = true;
        p.color = generateColor();
        const c = generateColor();
        this.splat(x, y, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5),
            { r: c.r * 10, g: c.g * 10, b: c.b * 10 });
    }

    _pointerMove (id, e) {
        if (!this.config.INTERACTIVE) return;
        let p = this._getPointer(id);
        const hover = this.config.INTERACT_ON_HOVER;
        if (!p) {
            if (!hover) return;
            p = this._createPointer(id);
            this.pointers.push(p);
        }
        if (!p.down && !hover) return;

        const raw = this._eventToTexcoord(e);
        if (!p.down && (raw.x < 0 || raw.x > 1 || raw.y < 0 || raw.y > 1)) {
            p.hasPos = false;
            return;
        }
        const x = clamp01(raw.x), y = clamp01(raw.y);

        if (!p.hasPos) {
            p.hasPos = true;
            p.texcoordX = p.prevTexcoordX = x;
            p.texcoordY = p.prevTexcoordY = y;
            return;
        }

        let dx = x - p.texcoordX;
        let dy = y - p.texcoordY;
        p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
        p.texcoordX = x; p.texcoordY = y;
        if (dx === 0 && dy === 0) return;

        dx = this._correctDeltaX(dx);
        dy = this._correctDeltaY(dy);
        const force = this.config.SPLAT_FORCE;
        this.splat(x, y, dx * force, dy * force, p.color);
    }

    _pointerUp (id, remove) {
        const p = this._getPointer(id);
        if (!p) return;
        p.down = false;
        p.hasPos = false;
        if (remove) {
            const i = this.pointers.indexOf(p);
            if (i >= 0) this.pointers.splice(i, 1);
        }
    }

    _correctDeltaX (delta) {
        const ar = this.canvas.width / this.canvas.height;
        return ar < 1 ? delta * ar : delta;
    }
    _correctDeltaY (delta) {
        const ar = this.canvas.width / this.canvas.height;
        return ar > 1 ? delta / ar : delta;
    }
    _correctRadius (radius) {
        const ar = this.canvas.width / this.canvas.height;
        return ar < 1 ? radius * ar : radius;
    }

    /* ------------------------------ main loop ----------------------------- */

    _update () {
        if (this.destroyed) return;
        const now = performance.now();
        let dt = (now - this._lastTime) / 1000;
        this._lastTime = now;
        if (!(dt > 0) || dt > 1) dt = 0.016;
        dt = Math.min(dt, 0.016666);

        if (this._resizeCanvas()) this._initFramebuffers();
        this._updateColors(dt);
        this._applyInputs();
        if (!this.paused) this.step(dt);
        this.render();

        if (!this._initEmitted) {
            this._initEmitted = true;
            this._emit('init', this);
        }
        this._emit('frame', dt);
        this._raf = requestAnimationFrame(this._update);
    }

    _updateColors (dt) {
        if (!this.config.COLORFUL) return;
        this._colorTimer += dt * this.config.COLOR_UPDATE_SPEED * 0.1;
        if (this._colorTimer >= 1) {
            this._colorTimer %= 1;
            for (const p of this.pointers) p.color = generateColor();
        }
    }

    _applyInputs () {
        if (!this.splatQueue.length) return;
        const q = this.splatQueue;
        this.splatQueue = [];
        for (const s of q) this._doSplat(s.x, s.y, s.dx, s.dy, s.color);
    }

    _doSplat (x, y, dx, dy, color) {
        const gl = this.gl;
        const cfg = this.config;
        gl.disable(gl.BLEND);
        this.splatProgram.bind();
        this._u1i(this.splatProgram, 'uTarget', this.velocity.read.attach(0));
        this._u1f(this.splatProgram, 'aspectRatio', this.canvas.width / this.canvas.height);
        this._u2f(this.splatProgram, 'point', x, y);
        this._u3f(this.splatProgram, 'color', dx, dy, 0.0);
        this._u1f(this.splatProgram, 'radius', this._correctRadius(cfg.SPLAT_RADIUS / 100));
        this._blit(this.velocity.write);
        this.velocity.swap();

        this._u1i(this.splatProgram, 'uTarget', this.dye.read.attach(0));
        this._u3f(this.splatProgram, 'color', color.r, color.g, color.b);
        this._blit(this.dye.write);
        this.dye.swap();

        this._emit('splat', { x, y, dx, dy, color });
    }

    /* --------------------------- simulation step -------------------------- */

    step (dt) {
        const gl = this.gl;
        const cfg = this.config;
        gl.disable(gl.BLEND);

        // 1. curl
        this.curlProgram.bind();
        this._u2f(this.curlProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        this._u1i(this.curlProgram, 'uVelocity', this.velocity.read.attach(0));
        this._blit(this.curlFBO);

        // 2. vorticity confinement
        this.vorticityProgram.bind();
        this._u2f(this.vorticityProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        this._u1i(this.vorticityProgram, 'uVelocity', this.velocity.read.attach(0));
        this._u1i(this.vorticityProgram, 'uCurl', this.curlFBO.attach(1));
        this._u1f(this.vorticityProgram, 'curl', cfg.CURL);
        this._u1f(this.vorticityProgram, 'dt', dt);
        this._blit(this.velocity.write);
        this.velocity.swap();

        // 3. divergence
        this.divergenceProgram.bind();
        this._u2f(this.divergenceProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        this._u1i(this.divergenceProgram, 'uVelocity', this.velocity.read.attach(0));
        this._blit(this.divergenceFBO);

        // 4. decay pressure
        this.clearProgram.bind();
        this._u1i(this.clearProgram, 'uTexture', this.pressure.read.attach(0));
        this._u1f(this.clearProgram, 'value', cfg.PRESSURE);
        this._blit(this.pressure.write);
        this.pressure.swap();

        // 5. Jacobi pressure solve
        this.pressureProgram.bind();
        this._u2f(this.pressureProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        this._u1i(this.pressureProgram, 'uDivergence', this.divergenceFBO.attach(0));
        for (let i = 0; i < cfg.PRESSURE_ITERATIONS; i++) {
            this._u1i(this.pressureProgram, 'uPressure', this.pressure.read.attach(1));
            this._blit(this.pressure.write);
            this.pressure.swap();
        }

        // 6. subtract pressure gradient → divergence-free velocity
        this.gradientProgram.bind();
        this._u2f(this.gradientProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        this._u1i(this.gradientProgram, 'uPressure', this.pressure.read.attach(0));
        this._u1i(this.gradientProgram, 'uVelocity', this.velocity.read.attach(1));
        this._blit(this.velocity.write);
        this.velocity.swap();

        // 7. advect velocity through itself
        this.advectionProgram.bind();
        this._u2f(this.advectionProgram, 'texelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        if (!this.ext.supportLinearFiltering)
            this._u2f(this.advectionProgram, 'dyeTexelSize', this.velocity.texelSizeX, this.velocity.texelSizeY);
        const velocityId = this.velocity.read.attach(0);
        this._u1i(this.advectionProgram, 'uVelocity', velocityId);
        this._u1i(this.advectionProgram, 'uSource', velocityId);
        this._u1f(this.advectionProgram, 'dt', dt);
        this._u1f(this.advectionProgram, 'dissipation', cfg.VELOCITY_DISSIPATION);
        this._blit(this.velocity.write);
        this.velocity.swap();

        // 8. advect dye through the velocity field
        if (!this.ext.supportLinearFiltering)
            this._u2f(this.advectionProgram, 'dyeTexelSize', this.dye.texelSizeX, this.dye.texelSizeY);
        this._u1i(this.advectionProgram, 'uVelocity', this.velocity.read.attach(0));
        this._u1i(this.advectionProgram, 'uSource', this.dye.read.attach(1));
        this._u1f(this.advectionProgram, 'dissipation', cfg.DENSITY_DISSIPATION);
        this._blit(this.dye.write);
        this.dye.swap();
    }

    /* ------------------------------- render ------------------------------- */

    render () {
        const gl = this.gl;
        const cfg = this.config;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const b = cfg.BACK_COLOR;
        gl.clearColor(b.r, b.g, b.b, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (cfg.TRANSPARENT) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.disable(gl.BLEND);
        }

        this.displayProgram.bind();
        this._u2f(this.displayProgram, 'texelSize', this.dye.texelSizeX, this.dye.texelSizeY);
        this._u1i(this.displayProgram, 'uTexture', this.dye.read.attach(0));
        this._blit(null);
        gl.disable(gl.BLEND);
    }

    /* -------------------------- uniform setters --------------------------- */

    _u1f (p, n, x)       { const l = p.uniforms[n]; if (l != null) this.gl.uniform1f(l, x); }
    _u1i (p, n, x)       { const l = p.uniforms[n]; if (l != null) this.gl.uniform1i(l, x); }
    _u2f (p, n, x, y)    { const l = p.uniforms[n]; if (l != null) this.gl.uniform2f(l, x, y); }
    _u3f (p, n, x, y, z) { const l = p.uniforms[n]; if (l != null) this.gl.uniform3f(l, x, y, z); }
}

/* ------------------------------- statics -------------------------------- */

FluidSimulation.VERSION = '1.0.0';
FluidSimulation.DEFAULT_CONFIG = Object.assign({}, DEFAULT_CONFIG);
FluidSimulation.generateColor = generateColor;
FluidSimulation.hsvToRgb = hsvToRgb;

return FluidSimulation;
});
