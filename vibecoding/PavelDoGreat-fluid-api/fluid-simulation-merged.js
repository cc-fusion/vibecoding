/*!
 * Fluid Simulation API - v2.1.0 (merged)
 * A dependency-free, embeddable WebGL fluid simulation.
 *
 * Usage with a plain script tag (no bundler):
 *   1. put a canvas element on the page:   canvas id="fluid"
 *   2. load this file:                     src="fluid-simulation-merged.js"
 *   3. FluidSimulation.create({ canvas: '#fluid', preset: 'neon', config: { curl: 40 } });
 *
 * Derived from the WebGL Fluid Simulation by Pavel Dobryakov (MIT, c) 2017.
 * The GLSL programs are kept verbatim from that project; everything else is a
 * re-architecture of the same simulation into a reusable, instance-based API.
 * See LICENSE-fluid-merged.txt for the original MIT license text.
 *
 * Merged from five submitted implementations; includes compatibility aliases,
 * quality presets, custom palettes, manual ticking, capture, lifecycle recovery
 * and automatic canvas sizing. See README-fluid-merged.md for API documentation.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.FluidSimulation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2.1.0';

    // ---------------------------------------------------------------------------
  // GLSL programs. Extracted verbatim from the original WebGL fluid simulation
  // (MIT, Copyright (c) 2017 Pavel Dobryakov) by tools/build.py.
  // Do not edit here: edit tools/reference/original-app-script.js instead.
  // ---------------------------------------------------------------------------
  const SHADERS = {
    baseVertex: `
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
`,
    blurVertex: `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - texelSize * offset;
        vR = vUv + texelSize * offset;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`,
    blur: `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
        sum += texture2D(uTexture, vL) * 0.35294117;
        sum += texture2D(uTexture, vR) * 0.35294117;
        gl_FragColor = sum;
    }
`,
    copy: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`,
    clear: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`,
    color: `
    precision mediump float;

    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`,
    checkerboard: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float aspectRatio;

    #define SCALE 25.0

    void main () {
        vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
        float v = mod(uv.x + uv.y, 2.0);
        v = v * 0.1 + 0.8;
        gl_FragColor = vec4(vec3(v), 1.0);
    }
`,
    display: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uBloom;
    uniform sampler2D uSunrays;
    uniform sampler2D uDithering;
    uniform vec2 ditherScale;
    uniform vec2 texelSize;
    uniform float shadingStrength;
    uniform float shadingBase;
    uniform float ditheringStrength;

    vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
    }

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

        float diffuse = clamp(dot(n, l) * shadingStrength + shadingBase, shadingBase, 1.0);
        c *= diffuse;
    #endif

    #ifdef BLOOM
        vec3 bloom = texture2D(uBloom, vUv).rgb;
    #endif

    #ifdef SUNRAYS
        float sunrays = texture2D(uSunrays, vUv).r;
        c *= sunrays;
    #ifdef BLOOM
        bloom *= sunrays;
    #endif
    #endif

    #ifdef BLOOM
        float noise = texture2D(uDithering, vUv * ditherScale).r;
        noise = noise * 2.0 - 1.0;
        bloom += noise / 255.0 * ditheringStrength;
        bloom = linearToGamma(bloom);
        c += bloom;
    #endif

        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c, a);
    }
`,
    bloomPrefilter: `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec3 curve;
    uniform float threshold;

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - curve.x, 0.0, curve.y);
        rq = curve.z * rq * rq;
        c *= max(rq, br - threshold) / max(br, 0.0001);
        gl_FragColor = vec4(c, 0.0);
    }
`,
    bloomBlur: `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum;
    }
`,
    bloomFinal: `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform float intensity;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum * intensity;
    }
`,
    sunraysMask: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        vec4 c = texture2D(uTexture, vUv);
        float br = max(c.r, max(c.g, c.b));
        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
        gl_FragColor = c;
    }
`,
    sunrays: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;
    uniform float density;
    uniform float decay;
    uniform float exposure;
    uniform int iterations;

    #define MAX_ITERATIONS 16

    void main () {
        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;
        float safeIterations = max(float(iterations), 1.0);

        dir *= 1.0 / safeIterations * density;
        float illuminationDecay = 1.0;
        float color = texture2D(uTexture, vUv).a;

        for (int i = 0; i < MAX_ITERATIONS; i++) {
            if (i >= iterations) break;
            coord -= dir;
            float col = texture2D(uTexture, coord).a;
            color += col * illuminationDecay * weight;
            illuminationDecay *= decay;
        }

        gl_FragColor = vec4(color * exposure, 0.0, 0.0, 1.0);
    }
`,
    splat: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    uniform float sharpness;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius * sharpness) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`,
    advection: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;
    uniform float advectionScale;

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
        vec2 coord = vUv - dt * advectionScale * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
        vec2 coord = vUv - dt * advectionScale * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
    #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }
`,
    divergence: `
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
`,
    curl: `
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
`,
    vorticity: `
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
`,
    pressure: `
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
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`,
    gradientSubtract: `
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
`,
  };

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  /** Every knob of the simulation, using the original project's property names. */
  var DEFAULT_CONFIG = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 1,
    VELOCITY_DISSIPATION: 0.2,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 10,
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: false,
    CHECKERBOARD: false,
    PALETTE: null,
    BLOOM: true,
    BLOOM_ITERATIONS: 8,
    BLOOM_RESOLUTION: 256,
    BLOOM_INTENSITY: 0.8,
    BLOOM_THRESHOLD: 0.6,
    BLOOM_SOFT_KNEE: 0.7,
    SUNRAYS: true,
    SUNRAYS_RESOLUTION: 196,
    SUNRAYS_WEIGHT: 1.0,
    DITHERING: true,

    // Advanced solver / timing controls
    TIME_SCALE: 1,
    MAX_DELTA_TIME: 0.016666,
    ADVECTION_STRENGTH: 1,
    SPLAT_SHARPNESS: 1,
    RANDOM_SPLAT_FORCE: 1000,
    RANDOM_SPLAT_COLOR_SCALE: 10,

    // Fine post-processing controls
    SHADING_STRENGTH: 1,
    SHADING_BASE: 0.7,
    DITHERING_STRENGTH: 1,
    SUNRAYS_DENSITY: 0.3,
    SUNRAYS_DECAY: 0.95,
    SUNRAYS_EXPOSURE: 0.7,
    SUNRAYS_ITERATIONS: 16
  };

  /** Non-simulation options understood by create(). */
  var DEFAULT_OPTIONS = {
    canvas: null,
    container: null,
    config: null,
    preset: null,
    quality: null,
    autoStart: true,
    autoUpdate: true,
    autoResize: true,
    pixelRatio: null,
    maxPixelRatio: 2,
    palette: null,
    initialSplats: 'random',
    autoDegrade: true,
    mobileQuality: true,
    input: true,
    hover: false,
    pointerTarget: null,
    inputTarget: null,
    keyboard: false,
    hotkeys: { pause: 'KeyP', splat: 'Space' },
    pauseWhenHidden: true,
    visibilityPause: null,
    preserveDrawingBuffer: false,
    releaseContext: false,
    ditheringUrl: null,
    color: null,
    id: null,
    className: 'fluid-canvas',
    style: null,
    removeCanvasOnDestroy: false,
    throwOnError: true,
    onError: null
  };

  /** Merged style presets. Every preset is a partial DEFAULT_CONFIG override. */
  var PRESETS = {
    classic: {},
    default: {},
    calm: {
      DENSITY_DISSIPATION: 1.6, VELOCITY_DISSIPATION: 0.7, CURL: 12,
      SPLAT_RADIUS: 0.22, SPLAT_FORCE: 4200, BLOOM_INTENSITY: 0.5,
      COLOR_UPDATE_SPEED: 4, SUNRAYS_WEIGHT: 0.6
    },
    vivid: {
      DENSITY_DISSIPATION: 0.35, VELOCITY_DISSIPATION: 0.05, CURL: 46,
      SPLAT_RADIUS: 0.18, SPLAT_FORCE: 9000, BLOOM_INTENSITY: 1.3,
      BLOOM_THRESHOLD: 0.4, SUNRAYS_WEIGHT: 1.2, COLOR_UPDATE_SPEED: 18
    },
    neon: {
      DENSITY_DISSIPATION: 1.2, VELOCITY_DISSIPATION: 0.15, CURL: 46,
      SPLAT_RADIUS: 0.18, SPLAT_FORCE: 7800, BLOOM: true,
      BLOOM_ITERATIONS: 9, BLOOM_INTENSITY: 1.5, BLOOM_THRESHOLD: 0.35,
      SUNRAYS: true, SUNRAYS_WEIGHT: 1.0, COLOR_UPDATE_SPEED: 14,
      PALETTE: ['#00f5d4', '#00bbf9', '#f15bb5', '#fee440', '#9b5de5']
    },
    smoke: {
      DENSITY_DISSIPATION: 0.6, VELOCITY_DISSIPATION: 0.3, PRESSURE: 0.9,
      CURL: 22, SPLAT_RADIUS: 0.35, SPLAT_FORCE: 5200, SHADING: true,
      BLOOM: true, BLOOM_INTENSITY: 0.45, SUNRAYS: false, COLORFUL: false,
      BACK_COLOR: { r: 4, g: 4, b: 8 }
    },
    ink: {
      DENSITY_DISSIPATION: 0.25, VELOCITY_DISSIPATION: 0.6, PRESSURE: 0.8,
      CURL: 8, SPLAT_RADIUS: 0.16, SPLAT_FORCE: 5200, BLOOM: false,
      SUNRAYS: false, SHADING: true, COLORFUL: false,
      BACK_COLOR: { r: 250, g: 249, b: 246 }
    },
    fire: {
      DENSITY_DISSIPATION: 2.4, VELOCITY_DISSIPATION: 0.25, CURL: 38,
      SPLAT_RADIUS: 0.3, SPLAT_FORCE: 7000, BLOOM: true,
      BLOOM_INTENSITY: 1.2, BLOOM_THRESHOLD: 0.45, SUNRAYS: true,
      SUNRAYS_WEIGHT: 0.9, COLOR_UPDATE_SPEED: 22,
      PALETTE: ['#ff3c00', '#ff8c00', '#ffd166', '#e63946']
    },
    water: {
      DENSITY_DISSIPATION: 0.6, VELOCITY_DISSIPATION: 0.1, CURL: 12,
      SPLAT_RADIUS: 0.4, SPLAT_FORCE: 5000, BLOOM: true,
      BLOOM_INTENSITY: 0.7, BLOOM_THRESHOLD: 0.7, SUNRAYS: true,
      SUNRAYS_WEIGHT: 0.6, COLOR_UPDATE_SPEED: 4,
      PALETTE: ['#0047ab', '#0f7bd6', '#00c2c7', '#7ef0e2', '#0b2545']
    },
    ocean: {
      DENSITY_DISSIPATION: 1.1, VELOCITY_DISSIPATION: 0.35, CURL: 26,
      SPLAT_RADIUS: 0.3, SPLAT_FORCE: 6400, BLOOM_THRESHOLD: 0.5,
      PALETTE: ['#0047ab', '#0f7bd6', '#00c2c7', '#7ef0e2', '#0b2545']
    }
  };

  /** Resolution/effect bundles for quick performance-quality tradeoffs. */
  var QUALITY_PRESETS = {
    low:       { SIM_RESOLUTION: 64,  DYE_RESOLUTION: 256,  PRESSURE_ITERATIONS: 10, SHADING: false, BLOOM: false, SUNRAYS: false },
    performance:{ SIM_RESOLUTION: 64,  DYE_RESOLUTION: 256,  PRESSURE_ITERATIONS: 12, SHADING: false, BLOOM: false, SUNRAYS: false },
    medium:    { SIM_RESOLUTION: 96,  DYE_RESOLUTION: 512,  PRESSURE_ITERATIONS: 16, SHADING: true,  BLOOM: true,  SUNRAYS: false },
    high:      { SIM_RESOLUTION: 128, DYE_RESOLUTION: 1024, PRESSURE_ITERATIONS: 20, SHADING: true, BLOOM: true, SUNRAYS: true },
    ultra:     { SIM_RESOLUTION: 256, DYE_RESOLUTION: 2048, PRESSURE_ITERATIONS: 24, SHADING: true, BLOOM: true, SUNRAYS: true }
  };

  /** Friendly aliases accepted alongside the upstream uppercase config keys. */
  var CONFIG_ALIASES = {
    simResolution: 'SIM_RESOLUTION', dyeResolution: 'DYE_RESOLUTION',
    captureResolution: 'CAPTURE_RESOLUTION', densityDissipation: 'DENSITY_DISSIPATION',
    velocityDissipation: 'VELOCITY_DISSIPATION', pressure: 'PRESSURE',
    pressureIterations: 'PRESSURE_ITERATIONS', curl: 'CURL', vorticity: 'CURL',
    splatRadius: 'SPLAT_RADIUS', splatForce: 'SPLAT_FORCE', shading: 'SHADING',
    colorful: 'COLORFUL', colorUpdateSpeed: 'COLOR_UPDATE_SPEED', paused: 'PAUSED',
    background: 'BACK_COLOR', backgroundColor: 'BACK_COLOR', backColor: 'BACK_COLOR',
    transparent: 'TRANSPARENT', checkerboard: 'CHECKERBOARD', palette: 'PALETTE',
    bloom: 'BLOOM', bloomIterations: 'BLOOM_ITERATIONS', bloomResolution: 'BLOOM_RESOLUTION',
    bloomIntensity: 'BLOOM_INTENSITY', bloomThreshold: 'BLOOM_THRESHOLD',
    bloomSoftKnee: 'BLOOM_SOFT_KNEE', sunrays: 'SUNRAYS',
    sunraysResolution: 'SUNRAYS_RESOLUTION', sunraysWeight: 'SUNRAYS_WEIGHT',
    dithering: 'DITHERING',
    timeScale: 'TIME_SCALE', maxDeltaTime: 'MAX_DELTA_TIME',
    advectionStrength: 'ADVECTION_STRENGTH', splatSharpness: 'SPLAT_SHARPNESS',
    randomSplatForce: 'RANDOM_SPLAT_FORCE', randomSplatColorScale: 'RANDOM_SPLAT_COLOR_SCALE',
    shadingStrength: 'SHADING_STRENGTH', shadingBase: 'SHADING_BASE',
    ditheringStrength: 'DITHERING_STRENGTH', sunraysDensity: 'SUNRAYS_DENSITY',
    sunraysDecay: 'SUNRAYS_DECAY', sunraysExposure: 'SUNRAYS_EXPOSURE',
    sunraysIterations: 'SUNRAYS_ITERATIONS'
  };

  function normalizeConfigPatch(patch) {
    var normalized = {};
    Object.keys(patch || {}).forEach(function (key) {
      var mapped = CONFIG_ALIASES[key] || (key.toUpperCase() in DEFAULT_CONFIG ? key.toUpperCase() : key);
      normalized[mapped] = patch[key];
    });
    return normalized;
  }

  var INTEGER_CONFIG_LIMITS = {
    SIM_RESOLUTION: [1, 16384], DYE_RESOLUTION: [1, 16384], CAPTURE_RESOLUTION: [1, 16384],
    PRESSURE_ITERATIONS: [1, 128], BLOOM_ITERATIONS: [2, 16],
    BLOOM_RESOLUTION: [1, 16384], SUNRAYS_RESOLUTION: [1, 16384],
    SUNRAYS_ITERATIONS: [1, 16]
  };

  var NUMERIC_CONFIG_MINIMUMS = {
    DENSITY_DISSIPATION: 0, VELOCITY_DISSIPATION: 0, CURL: 0,
    SPLAT_RADIUS: 0.0001, SPLAT_FORCE: 0, COLOR_UPDATE_SPEED: 0,
    BLOOM_INTENSITY: 0, BLOOM_THRESHOLD: 0, BLOOM_SOFT_KNEE: 0, SUNRAYS_WEIGHT: 0,
    TIME_SCALE: 0, ADVECTION_STRENGTH: 0, RANDOM_SPLAT_FORCE: 0,
    RANDOM_SPLAT_COLOR_SCALE: 0, SHADING_STRENGTH: 0, SHADING_BASE: 0,
    DITHERING_STRENGTH: 0, SUNRAYS_DENSITY: 0, SUNRAYS_DECAY: 0,
    SUNRAYS_EXPOSURE: 0
  };

  var NUMERIC_CONFIG_RANGES = {
    TIME_SCALE: [0, 4], MAX_DELTA_TIME: [0.001, 0.1],
    ADVECTION_STRENGTH: [0, 4], SPLAT_SHARPNESS: [0.1, 5],
    RANDOM_SPLAT_FORCE: [0, 5000], RANDOM_SPLAT_COLOR_SCALE: [0, 20],
    SHADING_STRENGTH: [0, 2], SHADING_BASE: [0, 1], DITHERING_STRENGTH: [0, 4],
    SUNRAYS_DENSITY: [0, 1], SUNRAYS_DECAY: [0, 1], SUNRAYS_EXPOSURE: [0, 4]
  };

  function normalizeConfigValue(key, raw) {
    if (!(key in DEFAULT_CONFIG)) return { valid: false, reason: 'unknown config key' };
    if (key === 'PALETTE') {
      if (raw == null) return { valid: true, value: null };
      if (!Array.isArray(raw) || raw.length === 0 || raw.some(function (color) { return toRgb255(color) == null; })) {
        return { valid: false, reason: 'expected null or a non-empty array of supported colors' };
      }
      return { valid: true, value: cloneConfigValue(raw) };
    }
    if (key === 'BACK_COLOR') {
      var rgb = toRgb255(raw);
      if (!rgb || !Number.isFinite(rgb.r) || !Number.isFinite(rgb.g) || !Number.isFinite(rgb.b)) {
        return { valid: false, reason: 'expected a supported hex/RGB color' };
      }
      return { valid: true, value: { r: clamp(rgb.r, 0, 255), g: clamp(rgb.g, 0, 255), b: clamp(rgb.b, 0, 255) } };
    }
    if (typeof DEFAULT_CONFIG[key] === 'boolean') {
      return typeof raw === 'boolean' ? { valid: true, value: raw } : { valid: false, reason: 'expected a boolean' };
    }
    if (typeof DEFAULT_CONFIG[key] === 'number') {
      var number = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() ? Number(raw) : NaN);
      if (!Number.isFinite(number)) return { valid: false, reason: 'expected a finite number' };
      if (INTEGER_CONFIG_LIMITS[key]) {
        var bounds = INTEGER_CONFIG_LIMITS[key];
        if (number < bounds[0] || number > bounds[1]) return { valid: false, reason: 'value is outside the supported integer range ' + bounds[0] + '–' + bounds[1] };
        number = Math.round(number);
      } else if (NUMERIC_CONFIG_RANGES[key]) {
        var range = NUMERIC_CONFIG_RANGES[key];
        if (number < range[0] || number > range[1]) return { valid: false, reason: 'expected a value in the range ' + range[0] + '–' + range[1] };
      } else if (key === 'PRESSURE') {
        if (number < 0 || number > 1) return { valid: false, reason: 'expected a value from 0 to 1' };
      } else if (NUMERIC_CONFIG_MINIMUMS[key] != null && number < NUMERIC_CONFIG_MINIMUMS[key]) {
        return { valid: false, reason: 'expected a value greater than or equal to ' + NUMERIC_CONFIG_MINIMUMS[key] };
      }
      return { valid: true, value: number };
    }
    return { valid: true, value: cloneConfigValue(raw) };
  }

  function normalizeInitialConfigPatch(patch) {
    var normalized = normalizeConfigPatch(patch);
    var result = {};
    Object.keys(normalized).forEach(function (key) {
      var entry = normalizeConfigValue(key, normalized[key]);
      if (!entry.valid) {
        if (!(key in DEFAULT_CONFIG)) {
          warn('ignoring unknown config key "' + key + '".');
          return;
        }
        throw new FluidError(ERROR_CODES.INVALID_OPTION, 'Invalid config option "' + key + '": ' + entry.reason + '.');
      }
      result[key] = entry.value;
    });
    return result;
  }

  function normalizeQualityPatch(quality) {
    if (typeof quality === 'string') {
      var named = QUALITY_PRESETS[quality.toLowerCase()];
      if (!named) throw new FluidError(ERROR_CODES.INVALID_OPTION,
        'Unknown quality preset "' + quality + '". Available: ' + Object.keys(QUALITY_PRESETS).join(', '));
      return cloneConfig(named);
    }
    if (!quality || typeof quality !== 'object') return {};
    var patch = {};
    if (quality.sim != null) patch.SIM_RESOLUTION = quality.sim;
    if (quality.dye != null) patch.DYE_RESOLUTION = quality.dye;
    if (quality.capture != null) patch.CAPTURE_RESOLUTION = quality.capture;
    if (quality.pressureIterations != null) patch.PRESSURE_ITERATIONS = quality.pressureIterations;
    if (quality.effects != null) {
      patch.SHADING = !!quality.effects;
      patch.BLOOM = !!quality.effects;
      patch.SUNRAYS = !!quality.effects;
    }
    Object.keys(quality).forEach(function (key) {
      if (key in DEFAULT_CONFIG || CONFIG_ALIASES[key]) patch[key] = quality[key];
    });
    return normalizeConfigPatch(patch);
  }

  /** Event names emitted by an instance. */
  var EVENTS = {
    READY: 'ready',
    FRAME: 'frame',
    SPLAT: 'splat',
    RESIZE: 'resize',
    CONFIG: 'config',
    PAUSE: 'pause',
    RESUME: 'resume',
    VISIBILITY: 'visibility',
    CAPTURE: 'capture',
    CLEAR: 'clear',
    DESTROY: 'destroy',
    ERROR: 'error'
  };

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /** Error thrown by the API, carrying a stable machine-readable `code`. */
  function FluidError(code, message, details) {
    var error = Error.call(this, message);
    this.name = 'FluidSimulationError';
    this.code = code;
    this.message = message;
    this.details = details || null;
    this.stack = error.stack || new Error(message).stack;
  }
  FluidError.prototype = Object.create(Error.prototype);
  FluidError.prototype.constructor = FluidError;

  var ERROR_CODES = {
    NO_CANVAS: 'NO_CANVAS',
    NO_WEBGL: 'NO_WEBGL',
    FLOAT_TEXTURE_UNSUPPORTED: 'FLOAT_TEXTURE_UNSUPPORTED',
    SHADER_COMPILE: 'SHADER_COMPILE',
    CONTEXT_LOST: 'CONTEXT_LOST',
    DESTROYED: 'DESTROYED',
    INVALID_OPTION: 'INVALID_OPTION'
  };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /** Shallow merge that copies nested color objects instead of aliasing them. */
  function cloneConfigValue(value) {
    if (Array.isArray(value)) return value.map(cloneConfigValue);
    if (isPlainObject(value)) {
      var copy = {};
      Object.keys(value).forEach(function (key) { copy[key] = cloneConfigValue(value[key]); });
      return copy;
    }
    return value;
  }

  function cloneConfig(source) {
    var target = {};
    Object.keys(source).forEach(function (key) { target[key] = cloneConfigValue(source[key]); });
    return target;
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      if (!source) continue;
      Object.keys(source).forEach(function (key) {
        target[key] = source[key];
      });
    }
    return target;
  }

  function clamp01(input) {
    return Math.min(Math.max(input, 0), 1);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function wrap(value, min, max) {
    var range = max - min;
    if (range === 0) return min;
    return (value - min) % range + min;
  }

  function hashCode(string) {
    if (string.length === 0) return 0;
    var hash = 0;
    for (var i = 0; i < string.length; i++) {
      hash = (hash << 5) - hash + string.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function isMobile() {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  function effectivePixelRatio(options) {
    options = options || {};
    var nativeRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    var ratio = typeof options.pixelRatio === 'number' && options.pixelRatio > 0 ? options.pixelRatio : nativeRatio;
    if (typeof options.maxPixelRatio === 'number' && options.maxPixelRatio > 0) ratio = Math.min(ratio, options.maxPixelRatio);
    return ratio;
  }

  function scaleByPixelRatio(input, options) {
    return Math.floor(input * effectivePixelRatio(options));
  }

  function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      default: r = v, g = p, b = q; break;
    }
    return { r: r, g: g, b: b };
  }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    var value = hex.trim().replace(/^#/, '');
    if (value.length === 3) {
      value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    var int = parseInt(value, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }

  function rgbToHex(color) {
    var r = Math.round(clamp(color.r, 0, 255));
    var g = Math.round(clamp(color.g, 0, 255));
    var b = Math.round(clamp(color.b, 0, 255));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Accepts '#1e90ff', '1e90ff', [30,144,255], { r: 30, g: 144, b: 255 },
   * { r: 0.1, g: 0.5, b: 1 } and returns 0-255 components.
   */
  function toRgb255(value) {
    if (value == null) return null;
    if (typeof value === 'string') {
      var fromHex = hexToRgb(value);
      if (fromHex) return fromHex;
      var match = value.match(/rgba?\(([^)]+)\)/i);
      if (match) {
        var bits = match[1].split(',').map(function (part) { return parseFloat(part); });
        return { r: bits[0] || 0, g: bits[1] || 0, b: bits[2] || 0 };
      }
      return null;
    }
    if (Array.isArray(value)) return { r: +value[0] || 0, g: +value[1] || 0, b: +value[2] || 0 };
    if (typeof value === 'object') {
      var max = Math.max(value.r, value.g, value.b);
      if (max <= 1.0000001) {
        return { r: (value.r || 0) * 255, g: (value.g || 0) * 255, b: (value.b || 0) * 255 };
      }
      return { r: value.r || 0, g: value.g || 0, b: value.b || 0 };
    }
    return null;
  }

  /** 0-255 color -> normalized WebGL color. */
  function normalizeColor(input) {
    var rgb = toRgb255(input) || { r: 0, g: 0, b: 0 };
    return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
  }

  /** Default color generator: random hue, low intensity (matches the original). */
  function defaultColorGenerator() {
    var color = HSVtoRGB(Math.random(), 1.0, 1.0);
    color.r *= 0.15;
    color.g *= 0.15;
    color.b *= 0.15;
    return color;
  }

  /** Deterministic PRNG so procedural noise textures are reproducible. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Blue-ish noise data used to dither the bloom pass. The original app shipped a
   * PNG for this; generating it keeps the library free of any network request.
   */
  function createNoiseData(size, seed) {
    var random = mulberry32(seed == null ? 0x9E3779B9 : seed);
    var data = new Uint8Array(size * size * 4);
    for (var i = 0; i < size * size; i++) {
      var value = Math.floor(random() * 256);
      data[i * 4 + 0] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    return data;
  }

  function getResolution(gl, resolution) {
    var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

    var min = Math.round(resolution);
    var max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
      return { width: max, height: min };
    }
    return { width: min, height: max };
  }

  function getTextureScale(texture, width, height) {
    return { x: width / texture.width, y: height / texture.height };
  }

  // ---------------------------------------------------------------------------
  // WebGL plumbing
  // ---------------------------------------------------------------------------

  function getWebGLContext(canvas, options) {
    var params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: !!(options && options.preserveDrawingBuffer),
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    };

    var gl = canvas.getContext('webgl2', params);
    var isWebGL2 = !!gl;
    if (!isWebGL2) {
      gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }
    if (!gl) {
      throw new FluidError(ERROR_CODES.NO_WEBGL,
        'Fluid Simulation requires WebGL, but this browser/context does not provide it.');
    }

    var halfFloat = null;
    var floatFallback = false;
    var supportLinearFiltering = false;

    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
      if (!halfFloat) {
        floatFallback = !!gl.getExtension('OES_texture_float');
      }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    var halfFloatTexType;
    if (isWebGL2) {
      halfFloatTexType = gl.HALF_FLOAT;
    } else if (halfFloat) {
      halfFloatTexType = halfFloat.HALF_FLOAT_OES;
    } else if (floatFallback) {
      halfFloatTexType = gl.FLOAT;
    } else {
      throw new FluidError(ERROR_CODES.NO_WEBGL,
        'Fluid Simulation needs half-float or float textures; neither OES_texture_half_float ' +
        'nor OES_texture_float is available in this browser.');
    }

    var formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    if (!formatRGBA || !formatRG || !formatR) {
      throw new FluidError(ERROR_CODES.FLOAT_TEXTURE_UNSUPPORTED,
        'Fluid Simulation needs float framebuffers, which this device cannot render to. ' +
        'Call FluidSimulation.isSupported() before creating an instance if you want to ' +
        'show a fallback instead.');
    }

    return {
      gl: gl,
      isWebGL2: isWebGL2,
      ext: {
        formatRGBA: formatRGBA,
        formatRG: formatRG,
        formatR: formatR,
        halfFloatTexType: halfFloatTexType,
        supportLinearFiltering: supportLinearFiltering
      }
    };
  }

  function getSupportedFormat(gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
      switch (internalFormat) {
        case gl.R16F:
          return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        case gl.RG16F:
          return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        default:
          return null;
      }
    }
    return { internalFormat: internalFormat, format: format };
  }

  function supportRenderTextureFormat(gl, internalFormat, format, type) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    var complete = status === gl.FRAMEBUFFER_COMPLETE;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    return complete;
  }

  function compileShader(gl, type, source, keywords) {
    source = addKeywords(source, keywords);
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new FluidError(ERROR_CODES.SHADER_COMPILE, 'Shader compile error: ' + log, { log: log });
    }
    return shader;
  }

  function addKeywords(source, keywords) {
    if (!keywords || !keywords.length) return source;
    var keywordsString = '';
    keywords.forEach(function (keyword) {
      keywordsString += '#define ' + keyword + '\n';
    });
    return keywordsString + source;
  }

  function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new FluidError(ERROR_CODES.SHADER_COMPILE, 'Program link error: ' + log, { log: log });
    }
    return program;
  }

  function getUniforms(gl, program) {
    var uniforms = {};
    var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < uniformCount; i++) {
      var uniformName = gl.getActiveUniform(program, i).name;
      uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
  }

  // ---------------------------------------------------------------------------
  // Programs and materials
  // ---------------------------------------------------------------------------

  function Program(gl, vertexShader, fragmentShader) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.uniforms = getUniforms(gl, this.program);
  }

  Program.prototype.bind = function () {
    this.gl.useProgram(this.program);
  };

  Program.prototype.dispose = function () {
    this.gl.deleteProgram(this.program);
  };

  /**
   * A shader whose fragment source is recompiled on demand for #define keywords,
   * used by the display pass (SHADING / BLOOM / SUNRAYS toggles).
   */
  function Material(gl, vertexShader, fragmentShaderSource) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = {};
    this.activeProgram = null;
    this.activeKey = null;
    this.uniforms = {};
  }

  Material.prototype.setKeywords = function (keywords) {
    var gl = this.gl;
    var list = (keywords || []).slice();
    var key = list.join('|');
    var program = this.programs[key];
    if (!program) {
      var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource, list);
      program = createProgram(gl, this.vertexShader, fragmentShader);
      gl.deleteShader(fragmentShader);
      this.programs[key] = program;
    }
    if (program === this.activeProgram) return;
    this.uniforms = getUniforms(gl, program);
    this.activeProgram = program;
    this.activeKey = key;
  };

  Material.prototype.bind = function () {
    this.gl.useProgram(this.activeProgram);
  };

  Material.prototype.dispose = function () {
    var self = this;
    Object.keys(this.programs).forEach(function (key) {
      self.gl.deleteProgram(self.programs[key]);
    });
    this.programs = {};
    this.activeProgram = null;
    this.uniforms = {};
  };

  /** Pointer state for mouse, pen and touch input. */
  function Pointer(id) {
    this.id = id == null ? -1 : id;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = { r: 0.1, g: 0, b: 0.5 };
  }

  Pointer.prototype.reset = function (texcoordX, texcoordY, color) {
    this.texcoordX = texcoordX;
    this.texcoordY = texcoordY;
    this.prevTexcoordX = texcoordX;
    this.prevTexcoordY = texcoordY;
    this.deltaX = 0;
    this.deltaY = 0;
    this.moved = false;
    if (color) this.color = color;
  };

  // ---------------------------------------------------------------------------
  // The simulation instance
  // ---------------------------------------------------------------------------

  /**
   * Create a fluid simulation. Prefer `FluidSimulation.create(options)`.
   *
   * @param {Object} [options] see README-fluid-merged.md - everything is optional.
   */
  function FluidSimulation(options) {
    var opts = assign({}, DEFAULT_OPTIONS, options || {});
    opts.hotkeys = assign({}, DEFAULT_OPTIONS.hotkeys, (options && options.hotkeys) || {});
    this.options = opts;

    this.version = VERSION;
    this.destroyed = false;
    this.ready = false;
    this.running = false;
    this.degraded = { mobile: false, noLinearFiltering: false };

    this._handlers = {};
    this._rafId = null;
    this._lastUpdateTime = now();
    this._colorUpdateTimer = 0.0;
    this._pausedByVisibility = false;
    this._contextLost = false;
    this._inputEnabled = false;
    this._keyboardEnabled = false;
    this._resizeObserver = null;
    this._pointerMap = null;
    this._activeIds = [];

    this.pointers = [new Pointer(-1)];
    this._splatStack = [];
    this._colorGenerator = defaultColorGenerator;
    this._boundTick = this._tick.bind(this);

    // ---- configuration -----------------------------------------------------
    this.config = cloneConfig(DEFAULT_CONFIG);
    if (opts.preset) {
      var preset = PRESETS[opts.preset];
      if (!preset) {
        throw new FluidError(ERROR_CODES.INVALID_OPTION,
          'Unknown preset "' + opts.preset + '". Available: ' + Object.keys(PRESETS).join(', '));
      }
      assign(this.config, cloneConfig(normalizeInitialConfigPatch(preset)));
    }
    if (opts.quality) assign(this.config, cloneConfig(normalizeInitialConfigPatch(normalizeQualityPatch(opts.quality))));
    if (opts.config) assign(this.config, cloneConfig(normalizeInitialConfigPatch(opts.config)));
    if (opts.palette !== null && opts.palette !== undefined) {
      var normalizedPalette = normalizeConfigValue('PALETTE', opts.palette);
      if (!normalizedPalette.valid) throw new FluidError(ERROR_CODES.INVALID_OPTION, 'Invalid palette: ' + normalizedPalette.reason + '.');
      this.config.PALETTE = normalizedPalette.value;
    }
    /** Snapshot of the configuration this instance was created with. */
    this._initialConfig = cloneConfig(this.config);

    // ---- element -----------------------------------------------------------
    var requestedCanvas = opts.canvas;
    var existingCanvas = !!(requestedCanvas && typeof requestedCanvas === 'object' && requestedCanvas.tagName === 'CANVAS');
    if (typeof requestedCanvas === 'string' && typeof document !== 'undefined') {
      var selected = document.querySelector(requestedCanvas);
      existingCanvas = !!(selected && selected.tagName === 'CANVAS');
    }
    this.canvas = resolveCanvas(opts);
    // A selector targeting an existing canvas does not transfer ownership.
    this._ownsCanvas = !existingCanvas;

    // Size the canvas before initial framebuffer allocation.
    this._resizeCanvas();

    // ---- WebGL -------------------------------------------------------------
    try {
      this._initResources();
    } catch (error) {
      // Do not strand an internally-created canvas if WebGL initialization fails.
      if (this._ownsCanvas && this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      throw error;
    }
    this.ready = true;

    // ---- interaction / integration ----------------------------------------
    if (opts.input) this.enableInput();
    if (opts.keyboard) this.enableKeyboard();
    this._bindResizeObserver();
    this._bindVisibility();

    // ---- initial state -----------------------------------------------------
    if (opts.initialSplats === 'random') this.randomSplats(5 + Math.floor(Math.random() * 20));
    else if (opts.initialSplats) this.randomSplats(clamp(opts.initialSplats | 0, 0, 50));

    if (opts.autoStart && opts.autoUpdate !== false) this.start();
    var self = this;
    // ready is emitted on the next microtask so listeners can be attached first.
    setTimeout(function () {
      if (!self.destroyed) self._emit(EVENTS.READY, { canvas: self.canvas, gl: self.gl, config: self.getConfig() });
    }, 0);
  }

  // ---------------------------------------------------------------------------
  // Creation helpers
  // ---------------------------------------------------------------------------

  function now() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  function resolveCanvas(opts) {
    if (typeof document === 'undefined') {
      throw new FluidError(ERROR_CODES.NO_CANVAS,
        'FluidSimulation needs a DOM: there is no document in this environment. ' +
        'Create instances in the browser, not during server-side rendering.');
    }
    var canvas = opts.canvas;
    if (typeof canvas === 'string') {
      canvas = document.querySelector(canvas);
      if (!canvas) {
        throw new FluidError(ERROR_CODES.NO_CANVAS, 'No element matches the canvas selector "' + opts.canvas + '".');
      }
    }
    if (canvas == null) {
      canvas = createCanvasElement(opts);
    } else if (!(canvas instanceof Object) || canvas.nodeType !== 1) {
      throw new FluidError(ERROR_CODES.NO_CANVAS, 'options.canvas must be an element or a CSS selector.');
    }
    if (canvas.tagName !== 'CANVAS') {
      canvas = promoteToCanvas(canvas, opts);
    }
    if (opts.id) canvas.id = opts.id;
    if (opts.className && !canvas.className) canvas.className = opts.className;
    if (opts.style && canvas.style) applyStyle(canvas, opts.style);
    ensureTouchAction(canvas);
    return canvas;
  }

  function createCanvasElement(opts) {
    var parent = opts.container;
    if (typeof parent === 'string') {
      var selector = parent;
      parent = document.querySelector(selector);
      if (!parent) throw new FluidError(ERROR_CODES.NO_CANVAS, 'No element matches the container selector "' + selector + '".');
    }
    if (!parent) parent = document.body;
    if (!parent) {
      throw new FluidError(ERROR_CODES.NO_CANVAS,
        'No container available; call create() after the document body exists.');
    }
    var canvas = document.createElement('canvas');
    canvas.className = opts.className || 'fluid-canvas';
    if (opts.container) {
      // Fill the given container and leave the rest of the page alone.
      makePositioned(parent);
      applyStyle(canvas, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'block'
      });
    } else {
      // No container: behave like the original app, full-bleed behind everything.
      applyStyle(canvas, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: '-1'
      });
    }
    parent.appendChild(canvas);
    return canvas;
  }

  function makePositioned(element) {
    if (!element.style || typeof getComputedStyle !== 'function') return;
    var computed = getComputedStyle(element);
    if (computed && computed.position === 'static') element.style.position = 'relative';
  }

  /** A non-canvas element (usually a div) gets a canvas child that fills it. */
  function promoteToCanvas(container, opts) {
    makePositioned(container);
    var canvas = document.createElement('canvas');
    canvas.className = opts.className || 'fluid-canvas';
    applyStyle(canvas, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'block'
    });
    container.appendChild(canvas);
    return canvas;
  }

  function applyStyle(element, style) {
    Object.keys(style).forEach(function (key) {
      element.style[key] = style[key];
    });
  }

  function ensureTouchAction(canvas) {
    if (!canvas.style) return;
    var current = canvas.style.touchAction;
    if (!current || current === 'auto') {
      canvas.style.touchAction = 'none';
      canvas.style.webkitTouchAction = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start (or restart) the animation loop. Safe to call repeatedly.
   * @returns {FluidSimulation} this
   */
  FluidSimulation.prototype.start = function () {
    assertAlive(this);
    if (!this.running) {
      this.running = true;
      this._lastUpdateTime = now();
      this._rafId = requestAnimationFrame(this._boundTick);
    }
    return this;
  };

  /** Stop the animation loop but keep all GL state (see resume() to continue). */
  FluidSimulation.prototype.stop = function () {
    if (this.destroyed) return this;
    this.running = false;
    if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
    return this;
  };

  /** Freeze the simulation (rendering continues; the physics does not advance). */
  FluidSimulation.prototype.pause = function () {
    assertAlive(this);
    if (!this.config.PAUSED) {
      this.config.PAUSED = true;
      this._emit(EVENTS.PAUSE, {});
    }
    return this;
  };

  /** Resume a paused simulation. */
  FluidSimulation.prototype.resume = function () {
    assertAlive(this);
    if (this.config.PAUSED) {
      this.config.PAUSED = false;
      this._lastUpdateTime = now();
      this._emit(EVENTS.RESUME, {});
    }
    if (!this.running && this.options.autoUpdate !== false) this.start();
    return this;
  };

  FluidSimulation.prototype.togglePause = function () {
    return this.config.PAUSED ? this.resume() : this.pause();
  };

  FluidSimulation.prototype.isPaused = function () {
    return !!this.config.PAUSED;
  };

  FluidSimulation.prototype.isRunning = function () {
    return !!this.running && !this.destroyed;
  };

  FluidSimulation.prototype.isDestroyed = function () {
    return !!this.destroyed;
  };

  /** Re-read the canvas size and rebuild framebuffers if it changed. */
  FluidSimulation.prototype.resize = function () {
    assertAlive(this);
    if (this._resizeCanvas()) this._handleResize();
    return this;
  };

  /** Release every listener, GL resource and (optionally) the canvas element. */
  FluidSimulation.prototype.destroy = function () {
    if (this.destroyed) return this;
    this.stop();
    this.destroyed = true;
    this.disableInput();
    this.disableKeyboard();
    this._unbindResizeObserver();
    this._unbindVisibility();

    var gl = this.gl;
    if (gl) {
      if (this.canvas && this._onContextLost) {
        this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
      }
      this._deleteFramebuffers();
      this._deletePrograms();
      if (this._vertexBuffer) gl.deleteBuffer(this._vertexBuffer);
      if (this._indexBuffer) gl.deleteBuffer(this._indexBuffer);
      var lose = gl.getExtension('WEBGL_lose_context');
      if (this.options.releaseContext && lose) lose.loseContext();
    }

    this._emit(EVENTS.DESTROY, {});
    this._handlers = {};
    this.ready = false;

    var autoInitElement = this._autoInitElement;
    if (autoInitElement) {
      if (autoInitElement.__fluidInstance === this) delete autoInitElement.__fluidInstance;
      if (autoInitElement.fluid === this) delete autoInitElement.fluid;
      this._autoInitElement = null;
    }

    if (this._ownsCanvas && this.options.removeCanvasOnDestroy && this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    return this;
  };

  // Alias: some code bases prefer deinit()/dispose().
  FluidSimulation.prototype.dispose = FluidSimulation.prototype.destroy;

  // ---------------------------------------------------------------------------
  // Resource creation
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._initResources = function () {
    var context = getWebGLContext(this.canvas, this.options);
    this.gl = context.gl;
    this.isWebGL2 = context.isWebGL2;
    this.ext = context.ext;

    if (this.options.autoDegrade !== false) this._applyCapabilityDegradation();

    this._createPrograms();
    this._createBlit();
    this._updateKeywords();
    this._initDithering();
    this._initFramebuffers();
  };

  FluidSimulation.prototype._applyCapabilityDegradation = function () {
    if (!this.ext.supportLinearFiltering) {
      this.config.DYE_RESOLUTION = 512;
      this.config.SHADING = false;
      this.config.BLOOM = false;
      this.config.SUNRAYS = false;
      this.degraded.noLinearFiltering = true;
      warn('This device does not support linear filtering of float textures; ' +
        'quality, shading, bloom and sunrays were disabled.');
    }
    if (this.options.mobileQuality !== false && isMobile()) {
      this.config.DYE_RESOLUTION = Math.min(this.config.DYE_RESOLUTION, 512);
      this.degraded.mobile = true;
    }
  };

  FluidSimulation.prototype._createPrograms = function () {
    var gl = this.gl;
    var S = SHADERS;

    var baseVertexShader = compileShader(gl, gl.VERTEX_SHADER, S.baseVertex);
    var blurVertexShader = compileShader(gl, gl.VERTEX_SHADER, S.blurVertex);
    this._shaderCache = { baseVertex: baseVertexShader, blurVertex: blurVertexShader };

    var advectionKeywords = this.ext.supportLinearFiltering ? null : ['MANUAL_FILTERING'];

    this.programs = {
      blur: new Program(gl, blurVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.blur)),
      copy: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.copy)),
      clear: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.clear)),
      color: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.color)),
      checkerboard: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.checkerboard)),
      bloomPrefilter: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.bloomPrefilter)),
      bloomBlur: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.bloomBlur)),
      bloomFinal: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.bloomFinal)),
      sunraysMask: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.sunraysMask)),
      sunrays: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.sunrays)),
      splat: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.splat)),
      advection: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.advection, advectionKeywords)),
      divergence: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.divergence)),
      curl: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.curl)),
      vorticity: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.vorticity)),
      pressure: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.pressure)),
      gradientSubtract: new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, S.gradientSubtract))
    };

    this.displayMaterial = new Material(gl, baseVertexShader, SHADERS.display);
  };

  FluidSimulation.prototype._createBlit = function () {
    var gl = this.gl;
    var self = this;

    this._vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    /** Draw the full-screen quad into `target` (null = the visible canvas). */
    this.blit = function (target, clear) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      self._drawCalls++;
    };

    this._drawCalls = 0;
  };

  FluidSimulation.prototype._initDithering = function () {
    var gl = this.gl;
    if (this.ditheringTexture) {
      gl.deleteTexture(this.ditheringTexture.texture);
      this.ditheringTexture = null;
    }
    var url = this.options.ditheringUrl;
    if (url) {
      this.ditheringTexture = this._createTextureAsync(url);
    } else if (this.config.DITHERING !== false) {
      this.ditheringTexture = this._createDataTexture(createNoiseData(64), 64, 64);
    } else {
      // Flat mid-grey: the bloom noise term becomes a constant, so nothing shimmers.
      this.ditheringTexture = this._createDataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    }
  };

  /**
   * Enable/disable bloom dithering, or point it at your own noise texture:
   * `setDithering(true)`, `setDithering(false)`, `setDithering('noise.png')`.
   */
  FluidSimulation.prototype.setDithering = function (value) {
    assertAlive(this);
    if (typeof value === 'string') {
      this.options.ditheringUrl = value;
      this.config.DITHERING = true;
    } else {
      this.options.ditheringUrl = null;
      this.config.DITHERING = value !== false;
    }
    this._initDithering();
    return this;
  };

  FluidSimulation.prototype._createDataTexture = function (data, width, height) {
    var gl = this.gl;
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return makeTextureHandle(gl, texture, width, height);
  };

  FluidSimulation.prototype._createTextureAsync = function (url) {
    var gl = this.gl;
    var handle = this._createDataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    if (typeof Image === 'undefined') return handle;
    var image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = function () {
      if (handle.disposed) return;
      handle.width = image.width;
      handle.height = image.height;
      gl.bindTexture(gl.TEXTURE_2D, handle.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };
    image.onerror = function () {
      warn('Could not load the dithering texture "' + url + '"; using generated noise instead.');
    };
    image.src = url;
    return handle;
  };

  function makeTextureHandle(gl, texture, width, height) {
    return {
      texture: texture,
      width: width,
      height: height,
      disposed: false,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
      dispose: function () {
        this.disposed = true;
        gl.deleteTexture(texture);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Framebuffers
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._initFramebuffers = function () {
    var gl = this.gl;
    var config = this.config;
    var simRes = getResolution(gl, config.SIM_RESOLUTION);
    var dyeRes = getResolution(gl, config.DYE_RESOLUTION);

    var texType = this.ext.halfFloatTexType;
    var rgba = this.ext.formatRGBA;
    var rg = this.ext.formatRG;
    var r = this.ext.formatR;
    var filtering = this.ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    if (this.dye == null) {
      this.dye = this._createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    } else {
      this.dye = this._resizeDoubleFBO(this.dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    }

    if (this.velocity == null) {
      this.velocity = this._createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    } else {
      this.velocity = this._resizeDoubleFBO(this.velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    }

    this.divergence = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    this.curl = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    this.pressure = this._createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

    this._initBloomFramebuffers();
    this._initSunraysFramebuffers();
  };

  FluidSimulation.prototype._initBloomFramebuffers = function () {
    var gl = this.gl;
    var config = this.config;
    var res = getResolution(gl, config.BLOOM_RESOLUTION);

    var texType = this.ext.halfFloatTexType;
    var rgba = this.ext.formatRGBA;
    var filtering = this.ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    if (this.bloom) this.bloom.dispose();
    this.bloom = this._createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);

    if (this.bloomFramebuffers) {
      this.bloomFramebuffers.forEach(function (fbo) { fbo.dispose(); });
    }
    this.bloomFramebuffers = [];
    for (var i = 0; i < config.BLOOM_ITERATIONS; i++) {
      var width = res.width >> (i + 1);
      var height = res.height >> (i + 1);
      if (width < 2 || height < 2) break;
      this.bloomFramebuffers.push(this._createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering));
    }
  };

  FluidSimulation.prototype._initSunraysFramebuffers = function () {
    var gl = this.gl;
    var config = this.config;
    var res = getResolution(gl, config.SUNRAYS_RESOLUTION);

    var texType = this.ext.halfFloatTexType;
    var r = this.ext.formatR;
    var filtering = this.ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    if (this.sunrays) this.sunrays.dispose();
    if (this.sunraysTemp) this.sunraysTemp.dispose();
    this.sunrays = this._createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
    this.sunraysTemp = this._createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
  };

  FluidSimulation.prototype._createFBO = function (w, h, internalFormat, format, type, param) {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture: texture,
      fbo: fbo,
      width: w,
      height: h,
      texelSizeX: 1.0 / w,
      texelSizeY: 1.0 / h,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
      dispose: function () {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(texture);
      }
    };
  };

  FluidSimulation.prototype._createDoubleFBO = function (w, h, internalFormat, format, type, param) {
    var fbo1 = this._createFBO(w, h, internalFormat, format, type, param);
    var fbo2 = this._createFBO(w, h, internalFormat, format, type, param);

    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() { return fbo1; },
      set read(value) { fbo1 = value; },
      get write() { return fbo2; },
      set write(value) { fbo2 = value; },
      swap: function () {
        var temp = fbo1;
        fbo1 = fbo2;
        fbo2 = temp;
      },
      dispose: function () {
        fbo1.dispose();
        fbo2.dispose();
      }
    };
  };

  FluidSimulation.prototype._resizeFBO = function (target, w, h, internalFormat, format, type, param) {
    var gl = this.gl;
    var newFBO = this._createFBO(w, h, internalFormat, format, type, param);
    var copy = this.programs.copy;
    copy.bind();
    gl.uniform1i(copy.uniforms.uTexture, target.attach(0));
    this.blit(newFBO);
    target.dispose();
    return newFBO;
  };

  FluidSimulation.prototype._resizeDoubleFBO = function (target, w, h, internalFormat, format, type, param) {
    if (target.width === w && target.height === h) return target;
    target.read = this._resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write.dispose();
    target.write = this._createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
  };

  FluidSimulation.prototype._deleteFramebuffers = function () {
    var self = this;
    ['dye', 'velocity', 'divergence', 'curl', 'pressure', 'bloom', 'sunrays', 'sunraysTemp'].forEach(function (key) {
      if (self[key] && self[key].dispose) self[key].dispose();
      self[key] = null;
    });
    if (this.bloomFramebuffers) {
      this.bloomFramebuffers.forEach(function (fbo) { fbo.dispose(); });
      this.bloomFramebuffers = [];
    }
    if (this.ditheringTexture) {
      this.ditheringTexture.dispose();
      this.ditheringTexture = null;
    }
  };

  FluidSimulation.prototype._deletePrograms = function () {
    var self = this;
    if (this.programs) {
      Object.keys(this.programs).forEach(function (key) { self.programs[key].dispose(); });
      this.programs = null;
    }
    if (this.displayMaterial) {
      this.displayMaterial.dispose();
      this.displayMaterial = null;
    }
    if (this._shaderCache) {
      Object.keys(this._shaderCache).forEach(function (key) { self.gl.deleteShader(self._shaderCache[key]); });
      this._shaderCache = null;
    }
  };

  // ---------------------------------------------------------------------------
  // Keywords
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._updateKeywords = function () {
    if (!this.displayMaterial) return;
    var keywords = [];
    if (this.config.SHADING) keywords.push('SHADING');
    if (this.config.BLOOM) keywords.push('BLOOM');
    if (this.config.SUNRAYS) keywords.push('SUNRAYS');
    this.displayMaterial.setKeywords(keywords);
  };

  // ---------------------------------------------------------------------------
  // Frame loop, simulation and rendering
  // ---------------------------------------------------------------------------

  function assertAlive(instance) {
    if (!instance || instance.destroyed) {
      throw new FluidError(ERROR_CODES.DESTROYED, 'This fluid simulation has been destroyed.');
    }
  }

  function warn(message) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[FluidSimulation] ' + message);
  }

  FluidSimulation.prototype._tick = function () {
    if (this.destroyed || !this.running) return;

    var dt = (now() - this._lastUpdateTime) / 1000;
    dt = Math.min(dt, this.config.MAX_DELTA_TIME);
    this._lastUpdateTime = now();

    this._advance(dt);

    this._rafId = requestAnimationFrame(this._boundTick);
  };

  /** One simulation+render iteration with an explicit timestep. */
  FluidSimulation.prototype.frame = function (dt) {
    assertAlive(this);
    this._advance(typeof dt === 'number' && dt > 0 ? Math.min(dt, this.config.MAX_DELTA_TIME) : Math.min(1 / 60, this.config.MAX_DELTA_TIME));
    return this;
  };

  // Alias for people who think of frame() as an update step.
  FluidSimulation.prototype.update = function (dt) {
    return this.frame(dt);
  };

  FluidSimulation.prototype._advance = function (dt) {
    if (this._contextLost) return;
    // Cap elapsed time first, then apply the artistic simulation speed scale.
    // A final 0.1s cap avoids unstable steps when TIME_SCALE is set aggressively.
    dt = Math.min(Math.max(0, dt), this.config.MAX_DELTA_TIME);
    dt = Math.min(dt * this.config.TIME_SCALE, 0.1);
    this._updateColors(dt);
    this._applyInputs();
    if (!this.config.PAUSED && dt > 0) this.step(dt);
    this._render(null);
    this._emit(EVENTS.FRAME, { dt: dt, paused: !!this.config.PAUSED, drawCalls: this._drawCalls });
  };

  FluidSimulation.prototype._resizeCanvas = function () {
    var canvas = this.canvas;
    var displayWidth = canvas.clientWidth || canvas.width;
    var displayHeight = canvas.clientHeight || canvas.height;
    var width = scaleByPixelRatio(displayWidth, this.options);
    var height = scaleByPixelRatio(displayHeight, this.options);
    if (width === 0 || height === 0) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  };

  FluidSimulation.prototype._handleResize = function () {
    this._initFramebuffers();
    this._emit(EVENTS.RESIZE, { width: this.canvas.width, height: this.canvas.height });
  };

  FluidSimulation.prototype._updateColors = function (dt) {
    if (!this.config.COLORFUL) return;
    this._colorUpdateTimer += dt * this.config.COLOR_UPDATE_SPEED;
    if (this._colorUpdateTimer >= 1) {
      this._colorUpdateTimer = wrap(this._colorUpdateTimer, 0, 1);
      var color = this._nextPointerColor();
      this.pointers.forEach(function (pointer) { pointer.color = color; });
    }
  };

  FluidSimulation.prototype._applyInputs = function () {
    if (this._splatStack.length > 0) {
      this._multipleSplats(this._splatStack.pop());
    }
    this.pointers.forEach(function (pointer) {
      if (pointer.moved) {
        pointer.moved = false;
        this._splatPointer(pointer);
      }
    }, this);
  };

  /** One pressure-projection/transport iteration (ported from the original step()). */
  FluidSimulation.prototype.step = function (dt) {
    assertAlive(this);
    var gl = this.gl;
    var config = this.config;
    var programs = this.programs;
    var velocity = this.velocity;
    var ext = this.ext;

    gl.disable(gl.BLEND);

    programs.curl.bind();
    gl.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    this.blit(this.curl);

    programs.vorticity.bind();
    gl.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.vorticity.uniforms.uCurl, this.curl.attach(1));
    gl.uniform1f(programs.vorticity.uniforms.curl, config.CURL);
    gl.uniform1f(programs.vorticity.uniforms.dt, dt);
    this.blit(velocity.write);
    velocity.swap();

    programs.divergence.bind();
    gl.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    this.blit(this.divergence);

    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, this.pressure.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, config.PRESSURE);
    this.blit(this.pressure.write);
    this.pressure.swap();

    programs.pressure.bind();
    gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.pressure.uniforms.uDivergence, this.divergence.attach(0));
    for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(programs.pressure.uniforms.uPressure, this.pressure.read.attach(1));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    programs.gradientSubtract.bind();
    gl.uniform2f(programs.gradientSubtract.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.gradientSubtract.uniforms.uPressure, this.pressure.read.attach(0));
    gl.uniform1i(programs.gradientSubtract.uniforms.uVelocity, velocity.read.attach(1));
    this.blit(velocity.write);
    velocity.swap();

    programs.advection.bind();
    gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    var velocityId = velocity.read.attach(0);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocityId);
    gl.uniform1i(programs.advection.uniforms.uSource, velocityId);
    gl.uniform1f(programs.advection.uniforms.dt, dt);
    gl.uniform1f(programs.advection.uniforms.advectionScale, config.ADVECTION_STRENGTH);
    gl.uniform1f(programs.advection.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    this.blit(velocity.write);
    velocity.swap();

    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    }
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, this.dye.read.attach(1));
    gl.uniform1f(programs.advection.uniforms.advectionScale, config.ADVECTION_STRENGTH);
    gl.uniform1f(programs.advection.uniforms.dissipation, config.DENSITY_DISSIPATION);
    this.blit(this.dye.write);
    this.dye.swap();
  };

  /** Composite the dye (plus bloom/sunrays) into `target`; null renders on screen. */
  FluidSimulation.prototype._render = function (target) {
    var gl = this.gl;
    var config = this.config;

    if (config.BLOOM) this._applyBloom(this.dye.read, this.bloom);
    if (config.SUNRAYS) {
      this._applySunrays(this.dye.read, this.dye.write, this.sunrays);
      this._blur(this.sunrays, this.sunraysTemp, 1);
    }

    if (target == null || !config.TRANSPARENT) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }

    if (!config.TRANSPARENT) this._drawColor(target, normalizeColor(config.BACK_COLOR));
    if (target == null && config.TRANSPARENT && config.CHECKERBOARD) {
      // Preserve the checkerboard while compositing fluid with straight alpha.
      this._drawCheckerboard(target);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
    }
    this._drawDisplay(target);
  };

  FluidSimulation.prototype._drawColor = function (target, color) {
    var gl = this.gl;
    var program = this.programs.color;
    program.bind();
    gl.uniform4f(program.uniforms.color, color.r, color.g, color.b, 1);
    this.blit(target);
  };

  FluidSimulation.prototype._drawCheckerboard = function (target) {
    var gl = this.gl;
    var program = this.programs.checkerboard;
    program.bind();
    gl.uniform1f(program.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
    this.blit(target);
  };

  FluidSimulation.prototype._drawDisplay = function (target) {
    var gl = this.gl;
    var config = this.config;
    var width = target == null ? gl.drawingBufferWidth : target.width;
    var height = target == null ? gl.drawingBufferHeight : target.height;

    this.displayMaterial.bind();
    if (config.SHADING) {
      gl.uniform2f(this.displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
      gl.uniform1f(this.displayMaterial.uniforms.shadingStrength, config.SHADING_STRENGTH);
      gl.uniform1f(this.displayMaterial.uniforms.shadingBase, config.SHADING_BASE);
    }
    gl.uniform1i(this.displayMaterial.uniforms.uTexture, this.dye.read.attach(0));
    if (config.BLOOM) {
      gl.uniform1i(this.displayMaterial.uniforms.uBloom, this.bloom.attach(1));
      gl.uniform1i(this.displayMaterial.uniforms.uDithering, this.ditheringTexture.attach(2));
      var scale = getTextureScale(this.ditheringTexture, width, height);
      gl.uniform2f(this.displayMaterial.uniforms.ditherScale, scale.x, scale.y);
      gl.uniform1f(this.displayMaterial.uniforms.ditheringStrength, config.DITHERING ? config.DITHERING_STRENGTH : 0);
    }
    if (config.SUNRAYS) {
      gl.uniform1i(this.displayMaterial.uniforms.uSunrays, this.sunrays.attach(3));
    }
    this.blit(target);
  };

  FluidSimulation.prototype._applyBloom = function (source, destination) {
    var gl = this.gl;
    var config = this.config;
    var program = this.programs.bloomBlur;

    if (this.bloomFramebuffers.length < 2) return;

    var last = destination;

    gl.disable(gl.BLEND);
    var prefilter = this.programs.bloomPrefilter;
    prefilter.bind();
    var knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
    var curve0 = config.BLOOM_THRESHOLD - knee;
    var curve1 = knee * 2;
    var curve2 = 0.25 / knee;
    gl.uniform3f(prefilter.uniforms.curve, curve0, curve1, curve2);
    gl.uniform1f(prefilter.uniforms.threshold, config.BLOOM_THRESHOLD);
    gl.uniform1i(prefilter.uniforms.uTexture, source.attach(0));
    this.blit(last);

    program.bind();
    for (var i = 0; i < this.bloomFramebuffers.length; i++) {
      var dest = this.bloomFramebuffers[i];
      gl.uniform2f(program.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(program.uniforms.uTexture, last.attach(0));
      this.blit(dest);
      last = dest;
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);

    for (var j = this.bloomFramebuffers.length - 2; j >= 0; j--) {
      var baseTex = this.bloomFramebuffers[j];
      gl.uniform2f(program.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(program.uniforms.uTexture, last.attach(0));
      gl.viewport(0, 0, baseTex.width, baseTex.height);
      this.blit(baseTex);
      last = baseTex;
    }

    gl.disable(gl.BLEND);
    var final = this.programs.bloomFinal;
    final.bind();
    gl.uniform2f(final.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
    gl.uniform1i(final.uniforms.uTexture, last.attach(0));
    gl.uniform1f(final.uniforms.intensity, config.BLOOM_INTENSITY);
    this.blit(destination);
  };

  FluidSimulation.prototype._applySunrays = function (source, mask, destination) {
    var gl = this.gl;
    gl.disable(gl.BLEND);

    var maskProgram = this.programs.sunraysMask;
    maskProgram.bind();
    gl.uniform1i(maskProgram.uniforms.uTexture, source.attach(0));
    this.blit(mask);

    var program = this.programs.sunrays;
    program.bind();
    gl.uniform1f(program.uniforms.weight, this.config.SUNRAYS_WEIGHT);
    gl.uniform1f(program.uniforms.density, this.config.SUNRAYS_DENSITY);
    gl.uniform1f(program.uniforms.decay, this.config.SUNRAYS_DECAY);
    gl.uniform1f(program.uniforms.exposure, this.config.SUNRAYS_EXPOSURE);
    gl.uniform1i(program.uniforms.iterations, this.config.SUNRAYS_ITERATIONS);
    gl.uniform1i(program.uniforms.uTexture, mask.attach(0));
    this.blit(destination);
  };

  FluidSimulation.prototype._blur = function (target, temp, iterations) {
    var gl = this.gl;
    var program = this.programs.blur;
    program.bind();
    for (var i = 0; i < iterations; i++) {
      gl.uniform2f(program.uniforms.texelSize, target.texelSizeX, 0.0);
      gl.uniform1i(program.uniforms.uTexture, target.attach(0));
      this.blit(temp);

      gl.uniform2f(program.uniforms.texelSize, 0.0, target.texelSizeY);
      gl.uniform1i(program.uniforms.uTexture, temp.attach(0));
      this.blit(target);
    }
  };

  // ---------------------------------------------------------------------------
  // Splats
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._splatPointer = function (pointer) {
    var dx = pointer.deltaX * this.config.SPLAT_FORCE;
    var dy = pointer.deltaY * this.config.SPLAT_FORCE;
    this.splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
  };

  FluidSimulation.prototype._multipleSplats = function (amount) {
    for (var i = 0; i < amount; i++) {
      var color = this.randomColor();
      color.r *= this.config.RANDOM_SPLAT_COLOR_SCALE;
      color.g *= this.config.RANDOM_SPLAT_COLOR_SCALE;
      color.b *= this.config.RANDOM_SPLAT_COLOR_SCALE;
      var x = Math.random();
      var y = Math.random();
      var dx = this.config.RANDOM_SPLAT_FORCE * (Math.random() - 0.5);
      var dy = this.config.RANDOM_SPLAT_FORCE * (Math.random() - 0.5);
      this.splat(x, y, dx, dy, color);
    }
  };

  /**
   * Inject dye + velocity at a point.
   *
   * @param {number} x        normalized 0..1, origin bottom-left
   * @param {number} y        normalized 0..1, origin bottom-left
   * @param {number} [dx]     horizontal velocity impulse
   * @param {number} [dy]     vertical velocity impulse
   * @param {string|Object|Array} [color] hex/array/object, defaults to a random color
   * @param {Object} [options] `{ radius }` - same scale as config.SPLAT_RADIUS
   * @returns {FluidSimulation} this
   */
  FluidSimulation.prototype.splat = function (x, y, dx, dy, color, options) {
    assertAlive(this);
    if (!this.ready || this._contextLost) return this;

    var gl = this.gl;
    var config = this.config;
    var program = this.programs.splat;
    var rgb = color == null ? this.randomColor() : normalizeColor(color);
    var radius = options && options.radius != null ? options.radius : config.SPLAT_RADIUS;

    program.bind();
    gl.uniform1i(program.uniforms.uTarget, this.velocity.read.attach(0));
    gl.uniform1f(program.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
    gl.uniform2f(program.uniforms.point, x, y);
    gl.uniform3f(program.uniforms.color, dx || 0, dy || 0, 0.0);
    gl.uniform1f(program.uniforms.radius, this._correctRadius(radius / 100.0));
    gl.uniform1f(program.uniforms.sharpness, config.SPLAT_SHARPNESS);
    this.blit(this.velocity.write);
    this.velocity.swap();

    gl.uniform1i(program.uniforms.uTarget, this.dye.read.attach(0));
    gl.uniform3f(program.uniforms.color, rgb.r, rgb.g, rgb.b);
    this.blit(this.dye.write);
    this.dye.swap();

    this._emit(EVENTS.SPLAT, { x: x, y: y, dx: dx || 0, dy: dy || 0, color: rgb, radius: radius });
    return this;
  };

  /**
   * Splat using CSS/client pixel coordinates (the event's clientX/clientY).
   * dx/dy are pixel deltas, exactly like dragging a pointer.
   */
  FluidSimulation.prototype.splatAt = function (clientX, clientY, dx, dy, color, options) {
    assertAlive(this);
    var rect = this.canvas.getBoundingClientRect();
    var width = rect.width || this.canvas.clientWidth || 1;
    var height = rect.height || this.canvas.clientHeight || 1;
    var x = (clientX - rect.left) / width;
    var y = 1.0 - (clientY - rect.top) / height;
    var deltaX = dx ? this._correctDeltaX(dx / width) : 0;
    var deltaY = dy ? this._correctDeltaY(-dy / height) : 0;
    return this.splat(x, y, deltaX, deltaY, color, options);
  };

  /** Throw `amount` random splats right now. */
  FluidSimulation.prototype.randomSplats = function (amount) {
    assertAlive(this);
    var count = clamp(amount == null ? 8 : amount | 0, 0, 100);
    this._multipleSplats(count);
    this._emit(EVENTS.SPLAT, { multiple: count });
    return this;
  };

  /** Queue random splats for the next frame (lets you burst on load). */
  FluidSimulation.prototype.queueSplats = function (amount) {
    assertAlive(this);
    this._splatStack.push(clamp(amount == null ? 8 : amount | 0, 0, 100));
    return this;
  };

  /** Wipe the dye and velocity fields (framebuffers are recreated empty). */
  FluidSimulation.prototype.clear = function () {
    assertAlive(this);
    var self = this;
    ['dye', 'velocity', 'divergence', 'curl', 'pressure'].forEach(function (key) {
      if (self[key] && self[key].dispose) self[key].dispose();
      self[key] = null;
    });
    this._splatStack.length = 0;
    this._initFramebuffers();
    this._emit(EVENTS.CLEAR, {});
    return this;
  };

  // ---------------------------------------------------------------------------
  // Scripted strokes
  // ---------------------------------------------------------------------------

  /** Begin a programmatic drag at normalized (0..1, bottom-left origin) coords. */
  FluidSimulation.prototype.startStroke = function (x, y, color) {
    assertAlive(this);
    var pointer = this._strokePointer || (this._strokePointer = new Pointer('stroke'));
    pointer.color = color == null ? this._nextPointerColor() : normalizeColor(color);
    pointer.reset(x, y, pointer.color);
    pointer.down = true;
    this.splat(x, y, 0, 0, pointer.color);
    return this;
  };

  /** Continue the programmatic drag; injects a force proportional to the movement. */
  FluidSimulation.prototype.moveStroke = function (x, y) {
    assertAlive(this);
    var pointer = this._strokePointer;
    if (!pointer || !pointer.down) return this;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = x;
    pointer.texcoordY = y;
    pointer.deltaX = this._correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = this._correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    if (Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0) this._splatPointer(pointer);
    return this;
  };

  FluidSimulation.prototype.endStroke = function () {
    if (this._strokePointer) this._strokePointer.down = false;
    return this;
  };

  // ---------------------------------------------------------------------------
  // Colors
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._nextPointerColor = function () {
    if (this.options.color != null && !this.config.COLORFUL) return normalizeColor(this.options.color);
    return this.randomColor();
  };

  /** Color produced by the current color generator, as 0..1 components. */
  FluidSimulation.prototype.randomColor = function () {
    var palette = this.config && this.config.PALETTE;
    if (Array.isArray(palette) && palette.length) {
      return normalizeColor(palette[Math.floor(Math.random() * palette.length)]);
    }
    var color = this._colorGenerator();
    if (!color || typeof color !== 'object') return { r: 0.1, g: 0.1, b: 0.1 };
    var max = Math.max(color.r, color.g, color.b);
    if (max > 1.0000001) return normalizeColor(color);
    return { r: +color.r || 0, g: +color.g || 0, b: +color.b || 0 };
  };

  /**
   * Replace the random color generator.
   * @param {function} generator `() => ({ r, g, b })` in 0..1 (values > 1 are allowed
   *   and produce the bright core seen in the original's random splats).
   */
  FluidSimulation.prototype.setColorGenerator = function (generator) {
    this._colorGenerator = typeof generator === 'function' ? generator : defaultColorGenerator;
    if (this.config && this.config.PALETTE != null) this.setConfig({ PALETTE: null });
    return this;
  };

  /** Set a palette of CSS color strings, RGB arrays or {r,g,b} objects. */
  FluidSimulation.prototype.setPalette = function (colors) {
    if (colors != null && (!Array.isArray(colors) || !colors.length)) {
      throw new FluidError(ERROR_CODES.INVALID_OPTION, 'setPalette() expects a non-empty array of colors or null.');
    }
    if (colors != null) {
      var invalid = colors.some(function (color) { return toRgb255(color) == null; });
      if (invalid) throw new FluidError(ERROR_CODES.INVALID_OPTION, 'Every palette entry must be a supported CSS/RGB color.');
    }
    this.setConfig({ PALETTE: colors == null ? null : cloneConfigValue(colors) });
    return this;
  };

  FluidSimulation.prototype.getColorGenerator = function () {
    return this._colorGenerator;
  };

  /** Set a fixed pointer/splat color (hex '#1e90ff', '#abc', [30,144,255] or object). */
  FluidSimulation.prototype.setColor = function (color) {
    this.options.color = color == null ? null : (toRgb255(color) ? color : null);
    var normalized = this.options.color == null ? null : normalizeColor(this.options.color);
    if (normalized) this.pointers.forEach(function (pointer) { pointer.color = normalized; });
    return this;
  };

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Current configuration (a copy - mutate through setConfig). */
  FluidSimulation.prototype.getConfig = function () {
    return cloneConfig(this.config);
  };

  /**
   * Merge a partial configuration. Framebuffer-size changes rebuild framebuffers,
   * display toggles recompile the display shader.
   */
  FluidSimulation.prototype.setConfig = function (patch) {
    assertAlive(this);
    if (!patch) return this;
    patch = normalizeConfigPatch(patch);

    var previous = cloneConfig(this.config);
    var self = this;
    var unknown = [];
    var needsFramebuffers = false;
    var needsKeywords = false;
    var needsDithering = false;

    var sizeKeys = ['SIM_RESOLUTION', 'DYE_RESOLUTION', 'BLOOM_RESOLUTION', 'BLOOM_ITERATIONS', 'SUNRAYS_RESOLUTION'];
    var keywordKeys = ['SHADING', 'BLOOM', 'SUNRAYS'];

    Object.keys(patch).forEach(function (key) {
      if (!(key in DEFAULT_CONFIG)) {
        unknown.push(key);
        return;
      }
      var value = patch[key];
      var normalizedValue = normalizeConfigValue(key, value);
      if (!normalizedValue.valid) {
        warn('ignoring config option "' + key + '": ' + normalizedValue.reason + '.');
        return;
      }
      var next = normalizedValue.value;
      if (!sameValue(self.config[key], next)) {
        if (sizeKeys.indexOf(key) !== -1) needsFramebuffers = true;
        if (keywordKeys.indexOf(key) !== -1) needsKeywords = true;
        if (key === 'DITHERING') needsDithering = true;
      }
      self.config[key] = next;
    });

    if (unknown.length) {
      warn('ignoring unknown config key(s): ' + unknown.join(', ') +
        '. Valid keys: ' + Object.keys(DEFAULT_CONFIG).join(', '));
    }

    if (needsFramebuffers && !this._contextLost) this._initFramebuffers();
    if (needsKeywords) this._updateKeywords();
    if (needsDithering) this._initDithering();

    if (previous.PAUSED !== this.config.PAUSED) {
      this._emit(this.config.PAUSED ? EVENTS.PAUSE : EVENTS.RESUME, {});
    }
    this._emit(EVENTS.CONFIG, { config: this.getConfig(), changes: cloneConfig(patch), previous: previous });
    return this;
  };

  function sameValue(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
      return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      var ak = Object.keys(a), bk = Object.keys(b);
      if (ak.length !== bk.length) return false;
      for (var j = 0; j < ak.length; j++) {
        if (!(ak[j] in b) || !sameValue(a[ak[j]], b[ak[j]])) return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Restore the configuration this instance was created with (defaults, plus the
   * preset and any options.config it was given).
   */
  FluidSimulation.prototype.resetConfig = function () {
    assertAlive(this);
    var fresh = assign(cloneConfig(DEFAULT_CONFIG), cloneConfig(this._initialConfig || {}));
    this.setConfig(fresh);
    return this;
  };

  /** Apply one of FluidSimulation.presets ('classic', 'calm', 'vivid', 'smoke', 'ink'). */
  FluidSimulation.prototype.applyPreset = function (name) {
    assertAlive(this);
    var preset = PRESETS[name];
    if (!preset) {
      throw new FluidError(ERROR_CODES.INVALID_OPTION,
        'Unknown preset "' + name + '". Available: ' + Object.keys(PRESETS).join(', '));
    }
    this.options.preset = name;
    this.setConfig(preset);
    return this;
  };

  /** Convenience for the two resolution knobs that dominate quality/perf. */
  FluidSimulation.prototype.setQuality = function (quality) {
    assertAlive(this);
    this.setConfig(normalizeQualityPatch(quality));
    return this;
  };


  /** `setBackground('#101018')`, or `setBackground('transparent')`. */
  FluidSimulation.prototype.setBackground = function (value) {
    assertAlive(this);
    if (value === 'transparent' || value === null) {
      this.setConfig({ TRANSPARENT: true });
      return this;
    }
    var rgb = toRgb255(value);
    if (!rgb) {
      warn('setBackground() ignores "' + value + '"; pass a hex string, RGB array/object or "transparent".');
      return this;
    }
    this.setConfig({ TRANSPARENT: false, BACK_COLOR: { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) } });
    return this;
  };

  FluidSimulation.prototype.setTransparent = function (transparent) {
    this.setConfig({ TRANSPARENT: transparent !== false });
    return this;
  };

  // ---------------------------------------------------------------------------
  // Sizing / diagnostics
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype.getSize = function () {
    return {
      cssWidth: this.canvas.clientWidth,
      cssHeight: this.canvas.clientHeight,
      width: this.canvas.width,
      height: this.canvas.height,
      pixelRatio: effectivePixelRatio(this.options)
    };
  };

  FluidSimulation.prototype.getContextInfo = function () {
    var gl = this.gl;
    var info = {
      version: this.version,
      webgl2: !!this.isWebGL2,
      supportLinearFiltering: !!this.ext.supportLinearFiltering,
      renderer: null,
      vendor: null,
      degraded: { mobile: this.degraded.mobile, noLinearFiltering: this.degraded.noLinearFiltering },
      drawCalls: this._drawCalls
    };
    try {
      var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        info.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        info.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      }
    } catch (error) {
      // Some browsers block the extension; not fatal.
    }
    return info;
  };

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._readFloatPixels = function (width, height) {
    var gl = this.gl;
    while (gl.getError() !== gl.NO_ERROR) { /* clear stale errors */ }

    var floatData = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, floatData);
    if (gl.getError() === gl.NO_ERROR) return floatData;

    // Half-float color buffers may refuse a FLOAT read on some drivers.
    var halfType = this.ext.halfFloatTexType;
    if (halfType === gl.FLOAT) {
      throw new FluidError('CAPTURE_UNSUPPORTED', 'This device cannot read pixels from float framebuffers.');
    }
    var halfData = new Uint16Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, halfType, halfData);
    if (gl.getError() !== gl.NO_ERROR) {
      throw new FluidError('CAPTURE_UNSUPPORTED', 'This device cannot read pixels from float framebuffers.');
    }
    var decoded = new Float32Array(halfData.length);
    for (var i = 0; i < halfData.length; i++) decoded[i] = halfToFloat(halfData[i]);
    return decoded;
  };

  /** Half-float (IEEE 754 binary16) -> float32. */
  function halfToFloat(value) {
    var sign = (value & 0x8000) >> 15;
    var exponent = (value & 0x7C00) >> 10;
    var fraction = value & 0x03FF;
    if (exponent === 0) return (sign ? -1 : 1) * Math.pow(2, -14) * (fraction / 1024);
    if (exponent === 0x1F) return fraction ? NaN : (sign ? -Infinity : Infinity);
    return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
  }

  /** Render the current frame at `resolution` and return it as an RGBA byte buffer. */
  FluidSimulation.prototype.getImageData = function (options) {
    assertAlive(this);
    var gl = this.gl;
    var resolution = options && options.resolution != null ? options.resolution : this.config.CAPTURE_RESOLUTION;
    var res = getResolution(gl, resolution);
    var target = this._createFBO(res.width, res.height, this.ext.formatRGBA.internalFormat,
      this.ext.formatRGBA.format, this.ext.halfFloatTexType, gl.NEAREST);

    this._render(target);
    var pixels = this._readFloatPixels(target.width, target.height);
    var bytes = floatPixelsToBytes(pixels, target.width, target.height);
    target.dispose();

    return { width: target.width, height: target.height, data: bytes };
  };

  function floatPixelsToBytes(texture, width, height) {
    var result = new Uint8ClampedArray(texture.length);
    var id = 0;
    for (var i = height - 1; i >= 0; i--) {
      for (var j = 0; j < width; j++) {
        var nid = i * width * 4 + j * 4;
        result[nid + 0] = clamp01(texture[id + 0]) * 255;
        result[nid + 1] = clamp01(texture[id + 1]) * 255;
        result[nid + 2] = clamp01(texture[id + 2]) * 255;
        result[nid + 3] = clamp01(texture[id + 3]) * 255;
        id += 4;
      }
    }
    return result;
  }

  /**
   * Snapshot the simulation as an offscreen `<canvas>` (PNG-ready, top-left origin).
   * @param {Object} [options] `{ resolution }`
   * @returns {HTMLCanvasElement}
   */
  FluidSimulation.prototype.capture = function (options) {
    assertAlive(this);
    var image = this.getImageData(options);
    var canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    var context = canvas.getContext('2d');
    var imageData = context.createImageData(image.width, image.height);
    imageData.data.set(image.data);
    context.putImageData(imageData, 0, 0);
    this._emit(EVENTS.CAPTURE, { canvas: canvas, width: image.width, height: image.height });
    return canvas;
  };

  /** Snapshot as a data URL, e.g. `'data:image/png;base64,...'`. */
  FluidSimulation.prototype.toDataURL = function (type, quality, options) {
    return this.capture(options).toDataURL(type || 'image/png', quality);
  };

  /** Snapshot and trigger a browser download. */
  FluidSimulation.prototype.download = function (filename, options) {
    var dataURL = this.toDataURL('image/png', undefined, options);
    if (typeof document === 'undefined') {
      warn('download() needs a DOM; use toDataURL() instead.');
      return this;
    }
    var link = document.createElement('a');
    link.download = filename || 'fluid.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return this;
  };

  // Alias kept for parity with the original app's menu entry.
  FluidSimulation.prototype.captureScreenshot = function (filename) {
    return this.download(filename || 'fluid.png');
  };

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  function isEditableTarget(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  }

  FluidSimulation.prototype.enableInput = function () {
    if (this._inputEnabled || this.destroyed) return this;
    var canvas = this.canvas;
    var inputTarget = this.options.pointerTarget || this.options.inputTarget || canvas;
    if (typeof inputTarget === 'string' && typeof document !== 'undefined') {
      inputTarget = document.querySelector(inputTarget);
    }
    if (!inputTarget || typeof inputTarget.addEventListener !== 'function') {
      warn('pointerTarget/inputTarget did not resolve to an event target; falling back to the canvas.');
      inputTarget = canvas;
    }
    this._inputTarget = inputTarget;
    var self = this;

    this._onPointerDownEvent = function (event) {
      if (event.button != null && event.button !== 0 && event.pointerType === 'mouse') return;
      self._pointerDownWithClient(event.pointerId == null ? -1 : event.pointerId, event.clientX, event.clientY);
    };
    this._onPointerMoveEvent = function (event) {
      self._pointerMoveWithClient(event.pointerId == null ? -1 : event.pointerId, event.clientX, event.clientY);
    };
    this._onPointerUpEvent = function (event) {
      self._pointerUpWithClient(event.pointerId == null ? -1 : event.pointerId);
    };

    if (typeof window !== 'undefined' && 'PointerEvent' in window) {
      inputTarget.addEventListener('pointerdown', this._onPointerDownEvent);
      inputTarget.addEventListener('pointermove', this._onPointerMoveEvent);
      window.addEventListener('pointerup', this._onPointerUpEvent);
      window.addEventListener('pointercancel', this._onPointerUpEvent);
    } else {
      this._onMouseDownEvent = function (event) {
        self._pointerDownWithClient(-1, event.clientX, event.clientY);
      };
      this._onMouseMoveEvent = function (event) {
        self._pointerMoveWithClient(-1, event.clientX, event.clientY);
      };
      this._onMouseUpEvent = function () {
        self._pointerUpWithClient(-1);
      };
      this._onTouchStartEvent = function (event) {
        event.preventDefault();
        for (var i = 0; i < event.changedTouches.length; i++) {
          var touch = event.changedTouches[i];
          self._pointerDownWithClient('t' + touch.identifier, touch.clientX, touch.clientY);
        }
      };
      this._onTouchMoveEvent = function (event) {
        event.preventDefault();
        for (var i = 0; i < event.changedTouches.length; i++) {
          var touch = event.changedTouches[i];
          self._pointerMoveWithClient('t' + touch.identifier, touch.clientX, touch.clientY);
        }
      };
      this._onTouchEndEvent = function (event) {
        for (var i = 0; i < event.changedTouches.length; i++) {
          self._pointerUpWithClient('t' + event.changedTouches[i].identifier);
        }
      };
      inputTarget.addEventListener('mousedown', this._onMouseDownEvent);
      window.addEventListener('mousemove', this._onMouseMoveEvent);
      window.addEventListener('mouseup', this._onMouseUpEvent);
      inputTarget.addEventListener('touchstart', this._onTouchStartEvent, { passive: false });
      inputTarget.addEventListener('touchmove', this._onTouchMoveEvent, { passive: false });
      window.addEventListener('touchend', this._onTouchEndEvent);
      window.addEventListener('touchcancel', this._onTouchEndEvent);
    }

    this._inputEnabled = true;
    return this;
  };

  FluidSimulation.prototype.disableInput = function () {
    if (!this._inputEnabled) return this;
    var canvas = this.canvas;
    var inputTarget = this._inputTarget || canvas;
    var win = typeof window !== 'undefined' ? window : null;
    if (this._onPointerDownEvent) {
      inputTarget.removeEventListener('pointerdown', this._onPointerDownEvent);
      inputTarget.removeEventListener('pointermove', this._onPointerMoveEvent);
      if (win) {
        win.removeEventListener('pointerup', this._onPointerUpEvent);
        win.removeEventListener('pointercancel', this._onPointerUpEvent);
      }
    }
    if (this._onMouseDownEvent) {
      inputTarget.removeEventListener('mousedown', this._onMouseDownEvent);
      if (win) {
        win.removeEventListener('mousemove', this._onMouseMoveEvent);
        win.removeEventListener('mouseup', this._onMouseUpEvent);
        win.removeEventListener('touchend', this._onTouchEndEvent);
        win.removeEventListener('touchcancel', this._onTouchEndEvent);
      }
      inputTarget.removeEventListener('touchstart', this._onTouchStartEvent);
      inputTarget.removeEventListener('touchmove', this._onTouchMoveEvent);
    }
    this._inputEnabled = false;
    this._inputTarget = null;
    return this;
  };

  FluidSimulation.prototype.isInputEnabled = function () {
    return !!this._inputEnabled;
  };

  /** Enable the original app's P (pause) and Space (random splats) shortcuts. */
  FluidSimulation.prototype.enableKeyboard = function () {
    if (this._keyboardEnabled || this.destroyed || typeof window === 'undefined') return this;
    var self = this;
    this._onKeyDownEvent = function (event) {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      var hotkeys = self.options.hotkeys;
      if (hotkeys.pause && event.code === hotkeys.pause) {
        self.togglePause();
      } else if (hotkeys.splat && (event.code === hotkeys.splat || event.key === ' ')) {
        self.queueSplats(5 + Math.floor(Math.random() * 20));
        if (event.key === ' ') event.preventDefault();
      }
    };
    window.addEventListener('keydown', this._onKeyDownEvent);
    this._keyboardEnabled = true;
    return this;
  };

  FluidSimulation.prototype.disableKeyboard = function () {
    if (!this._keyboardEnabled) return this;
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this._onKeyDownEvent);
    this._keyboardEnabled = false;
    return this;
  };

  FluidSimulation.prototype._pointerFor = function (id) {
    if (!this._pointersById) {
      this._pointersById = {};
      this._activeIds = [];
    }
    var pointer = this._pointersById[id];
    if (!pointer) {
      pointer = new Pointer(id);
      this._pointersById[id] = pointer;
      if (id === -1) this.pointers[0] = pointer;
      else this.pointers.push(pointer);
      this._activeIds.push(id);
    }
    return pointer;
  };

  FluidSimulation.prototype._toTexcoord = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var width = rect.width || this.canvas.clientWidth || 1;
    var height = rect.height || this.canvas.clientHeight || 1;
    return {
      x: (clientX - rect.left) / width,
      y: 1.0 - (clientY - rect.top) / height
    };
  };

  FluidSimulation.prototype._pointerDownWithClient = function (id, clientX, clientY) {
    var pointer = this._pointerFor(id);
    var position = this._toTexcoord(clientX, clientY);
    pointer.down = true;
    pointer.moved = false;
    pointer.reset(position.x, position.y, this._nextPointerColor());
  };

  FluidSimulation.prototype._pointerMoveWithClient = function (id, clientX, clientY) {
    var pointer = this._pointersById && this._pointersById[id];
    var isHover = !pointer || !pointer.down;
    if (isHover && !this.options.hover) return;

    var position = this._toTexcoord(clientX, clientY);
    // When the event target extends beyond the canvas, ignore hover outside its bounds.
    if (isHover && (position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1)) {
      if (pointer) pointer.moved = false;
      return;
    }
    if (!pointer) {
      pointer = this._pointerFor(id);
      pointer.reset(position.x, position.y, this._nextPointerColor());
      pointer.down = false;
      pointer.moved = false;
      return;
    }

    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = position.x;
    pointer.texcoordY = position.y;
    pointer.deltaX = this._correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = this._correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
  };

  FluidSimulation.prototype._pointerUpWithClient = function (id) {
    var pointer = this._pointersById && this._pointersById[id];
    if (pointer) pointer.down = false;
  };

  /** Programmatic pointer press in normalized (0..1, bottom-left) coordinates. */
  FluidSimulation.prototype.pointerDown = function (x, y, color) {
    assertAlive(this);
    var pointer = this._pointerFor(-1);
    pointer.down = true;
    pointer.moved = false;
    pointer.reset(x, y, color == null ? this._nextPointerColor() : normalizeColor(color));
    return this;
  };

  FluidSimulation.prototype.pointerMove = function (x, y) {
    assertAlive(this);
    var pointer = this._pointerFor(-1);
    if (!pointer.down) return this;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = x;
    pointer.texcoordY = y;
    pointer.deltaX = this._correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = this._correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    return this;
  };

  FluidSimulation.prototype.pointerUp = function () {
    if (this._pointersById && this._pointersById[-1]) this._pointersById[-1].down = false;
    return this;
  };

  FluidSimulation.prototype._correctRadius = function (radius) {
    var aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
  };

  FluidSimulation.prototype._correctDeltaX = function (delta) {
    var aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
  };

  FluidSimulation.prototype._correctDeltaY = function (delta) {
    var aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
  };

  // ---------------------------------------------------------------------------
  // Host integration: resize, visibility, context loss, events
  // ---------------------------------------------------------------------------

  FluidSimulation.prototype._bindResizeObserver = function () {
    var self = this;
    if (this.options.autoResize !== false) {
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(function () {
          if (self.destroyed || self._contextLost) return;
          if (self._resizeCanvas()) self._handleResize();
        });
        this._resizeObserver.observe(this.canvas);
      }
      if (typeof window !== 'undefined') {
        this._onWindowResize = function () {
          if (self.destroyed || self._contextLost) return;
          if (self._resizeCanvas()) self._handleResize();
        };
        window.addEventListener('resize', this._onWindowResize);
      }
    }
    this._onContextLost = function (event) {
      event.preventDefault();
      self._contextLost = true;
      self._wasRunningBeforeContextLoss = self.running;
      self.stop(); // avoid a requestAnimationFrame spin while WebGL is unavailable
      self._emit(EVENTS.ERROR, { code: ERROR_CODES.CONTEXT_LOST, message: 'WebGL context lost.' });
    };
    this._onContextRestored = function () {
      try {
        self._initResources();
        self._contextLost = false;
        if (self._wasRunningBeforeContextLoss) self.start();
        self._wasRunningBeforeContextLoss = false;
      } catch (error) {
        self._emit(EVENTS.ERROR, { code: ERROR_CODES.CONTEXT_LOST, message: 'Could not restore the WebGL context.', error: error });
      }
    };
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
  };

  FluidSimulation.prototype._unbindResizeObserver = function () {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (typeof window !== 'undefined' && this._onWindowResize) {
      window.removeEventListener('resize', this._onWindowResize);
    }
  };

  FluidSimulation.prototype._bindVisibility = function () {
    var self = this;
    var pauseWhenHidden = this.options.pauseWhenHidden;
    if (this.options.visibilityPause != null) pauseWhenHidden = !!this.options.visibilityPause;
    if (!pauseWhenHidden || typeof document === 'undefined') return;

    this._onVisibilityChange = function () {
      var hidden = document.hidden;
      self._emit(EVENTS.VISIBILITY, { hidden: hidden });
      if (hidden) {
        if (!self.config.PAUSED) {
          self._pausedByVisibility = true;
          self.pause();
        }
      } else {
        self._lastUpdateTime = now();
        if (self._pausedByVisibility) {
          self._pausedByVisibility = false;
          self.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  };

  FluidSimulation.prototype._unbindVisibility = function () {
    if (this._onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  };

  FluidSimulation.prototype._emit = function (name, payload) {
    var handlers = this._handlers[name];
    if (!handlers || !handlers.length) return this;
    var list = handlers.slice();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](payload, this);
      } catch (error) {
        warn('listener for "' + name + '" threw: ' + (error && error.message));
      }
    }
    return this;
  };

  /** Subscribe to an event. Returns this, so calls chain. */
  FluidSimulation.prototype.on = function (name, handler) {
    if (typeof handler !== 'function') return this;
    (this._handlers[name] = this._handlers[name] || []).push(handler);
    return this;
  };

  FluidSimulation.prototype.once = function (name, handler) {
    var self = this;
    function wrapper(payload, instance) {
      self.off(name, wrapper);
      handler(payload, instance);
    }
    wrapper.listener = handler;
    return this.on(name, wrapper);
  };

  FluidSimulation.prototype.off = function (name, handler) {
    if (name == null) {
      this._handlers = {};
      return this;
    }
    var handlers = this._handlers[name];
    if (!handlers) return this;
    if (!handler) {
      delete this._handlers[name];
      return this;
    }
    this._handlers[name] = handlers.filter(function (item) {
      return item !== handler && item.listener !== handler;
    });
    return this;
  };

  FluidSimulation.prototype.listeners = function (name) {
    return (this._handlers[name] || []).slice();
  };

  FluidSimulation.prototype.removeAllListeners = function (name) {
    return this.off(name);
  };

  // ---------------------------------------------------------------------------
  // Module-level API
  // ---------------------------------------------------------------------------

  /** Every live instance created through FluidSimulation.create(). */
  var instances = [];

  /**
   * Create a simulation and keep it in FluidSimulation.instances until destroyed.
   * @returns {FluidSimulation}
   */
  function create(options) {
    var opts = options || {};
    var instance;
    try {
      instance = new FluidSimulation(opts);
    } catch (error) {
      if (typeof opts.onError === 'function') {
        try { opts.onError(error); } catch (callbackError) { warn('onError callback threw: ' + callbackError.message); }
      }
      if (opts.throwOnError === false) return null;
      throw error;
    }
    instances.push(instance);
    instance.once(EVENTS.DESTROY, function () {
      var index = instances.indexOf(instance);
      if (index !== -1) instances.splice(index, 1);
    });
    return instance;
  }

  /**
   * Like create(), but returns null (and calls options.onError) when WebGL is
   * unavailable or initialization fails - handy for progressive enhancement.
   */
  function createIfSupported(options) {
    var opts = assign({}, options || {});
    if (!isSupported()) {
      var reason = new FluidError(ERROR_CODES.NO_WEBGL, 'WebGL is not available in this browser.');
      if (typeof opts.onError === 'function') opts.onError(reason);
      else warn(reason.message);
      return null;
    }
    var onError = opts.onError;
    opts.onError = null; // report exactly once from this wrapper
    opts.throwOnError = true;
    try {
      return create(opts);
    } catch (error) {
      if (typeof onError === 'function') onError(error);
      else warn(error.message);
      return null;
    }
  }

  /** Feature test that does not leave a WebGL context behind. */
  function isSupported() {
    if (typeof document === 'undefined') return false;
    var canvas;
    try {
      canvas = document.createElement('canvas');
      var context = getWebGLContext(canvas, {});
      var lose = context.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Explicit alias of create() - reads well when the canvas already exists. */
  function attach(target, options) {
    return create(assign({}, options || {}, { canvas: target }));
  }

  /**
   * Instantiate every `[data-fluid]` element on the page (or your own selector).
   *
   *   <canvas data-fluid data-fluid-preset="vivid" data-fluid-config='{"CURL":45}'></canvas>
   *
   * @param {Object} [options] passed to every instance; `options.selector` overrides
   *   the query. Repeated initialization skips elements that already have an instance.
   * @returns {FluidSimulation[]} the instances created by this call
   */
  function autoInit(options) {
    var opts = options || {};
    if (typeof document === 'undefined') return [];
    var selector = opts.selector || '[data-fluid]';
    var elements = document.querySelectorAll(selector);
    var created = [];

    Array.prototype.forEach.call(elements, function (element) {
      if (element.__fluidInstance) return;

      var local = assign({}, opts);
      delete local.selector;

      var inline = element.getAttribute('data-fluid');
      if (inline && inline.trim() && inline.trim() !== 'true') {
        try {
          assign(local, JSON.parse(inline));
        } catch (error) {
          warn('data-fluid attribute is not valid JSON on <' + element.tagName.toLowerCase() + '>.');
        }
      }
      var config = element.getAttribute('data-fluid-config');
      if (config) {
        try {
          local.config = assign({}, local.config || {}, JSON.parse(config));
        } catch (error) {
          warn('data-fluid-config attribute is not valid JSON on <' + element.tagName.toLowerCase() + '>.');
        }
      }
      var preset = element.getAttribute('data-fluid-preset');
      if (preset) local.preset = preset;

      if (element.tagName === 'CANVAS') {
        local.canvas = element;
        local.container = null;
      } else {
        local.canvas = null;
        local.container = element;
      }

      try {
        var instance = create(local);
        if (!instance) return;
        element.__fluidInstance = instance;
        element.fluid = instance;
        instance._autoInitElement = element;
        created.push(instance);
      } catch (error) {
        warn('could not initialise the simulation on <' + element.tagName.toLowerCase() + '>: ' + error.message);
      }
    });

    return created;
  }

  /** Destroy every live instance; returns how many were destroyed. */
  function destroyAll() {
    var snapshot = instances.slice();
    snapshot.forEach(function (instance) { instance.destroy(); });
    return snapshot.length;
  }

  // ---------------------------------------------------------------------------
  // Public surface
  // ---------------------------------------------------------------------------

  FluidSimulation.version = VERSION;
  FluidSimulation.instances = instances;

  FluidSimulation.create = create;
  FluidSimulation.createIfSupported = createIfSupported;
  FluidSimulation.attach = attach;
  FluidSimulation.autoInit = autoInit;
  FluidSimulation.isSupported = isSupported;
  FluidSimulation.destroyAll = destroyAll;

  FluidSimulation.events = EVENTS;
  FluidSimulation.errorCodes = ERROR_CODES;
  FluidSimulation.Error = FluidError;

  /** Fresh copy of the default simulation configuration. */
  FluidSimulation.defaultConfig = function () {
    return cloneConfig(DEFAULT_CONFIG);
  };

  /** Fresh copy of the default options accepted by create(). */
  FluidSimulation.defaultOptions = function () {
    return cloneConfig(DEFAULT_OPTIONS);
  };

  FluidSimulation.defaults = {
    config: DEFAULT_CONFIG,
    options: DEFAULT_OPTIONS,
    presets: PRESETS
  };

  FluidSimulation.presets = PRESETS;
  FluidSimulation.qualityPresets = QUALITY_PRESETS;
  FluidSimulation.configAliases = CONFIG_ALIASES;

  /** The GLSL sources, exposed for advanced reuse/customisation. */
  FluidSimulation.shaders = SHADERS;

  FluidSimulation.helpers = {
    HSVtoRGB: HSVtoRGB,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    toRgb255: toRgb255,
    normalizeColor: normalizeColor,
    randomColor: defaultColorGenerator,
    clamp01: clamp01,
    clamp: clamp,
    wrap: wrap,
    isMobile: isMobile,
    hashCode: hashCode
  };

  FluidSimulation.prototype.constructor = FluidSimulation;

  return FluidSimulation;
});
