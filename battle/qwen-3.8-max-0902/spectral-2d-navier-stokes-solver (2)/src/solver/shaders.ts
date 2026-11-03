/**
 * GLSL ES 3.00 shader sources for the GPU spectral Navier–Stokes solver.
 *
 * Conventions
 * -----------
 *  - Domain is the unit torus [0,1)^2, discretised on an N x N *collocated* grid,
 *    spacing h = 1/N. Texture coordinate == physical coordinate, so periodic
 *    boundary conditions come for free from GL_REPEAT texture wrapping.
 *  - Velocities live in the RG channels of an RG32F texture, dye in RGBA.
 *  - Complex Fourier data lives in RG (real, imaginary).
 *  - All spatial derivatives are second-order central differences.
 */

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692
`;

/**
 * Base for every shader that evaluates a finite-difference stencil.
 * Neighbours are located with *integer* texelFetch plus an explicit periodic
 * wrap instead of floating-point texture() offsets: the tap lands exactly on
 * the texel centre, so the discrete grad/div/Laplacian operators are bit-exact
 * and the spectral projection leaves a divergence that is pure round-off.
 */
export const STENCIL = HEADER + /* glsl */ `
uniform int uN;
ivec2 wrapCell(int dx, int dy) {
  ivec2 p = ivec2(gl_FragCoord.xy) + ivec2(dx, dy);
  p.x = p.x < 0 ? p.x + uN : (p.x >= uN ? p.x - uN : p.x);
  p.y = p.y < 0 ? p.y + uN : (p.y >= uN ? p.y - uN : p.y);
  return p;
}
`;

/* ------------------------------------------------------------------ */
/* Semi-Lagrangian advection (single bilinear fetch == hardware lerp)  */
/* ------------------------------------------------------------------ */
export const ADVECT = HEADER + /* glsl */ `
uniform sampler2D uField;
uniform sampler2D uVel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 vel = texture(uVel, vUv).xy;
  // Departure point. REPEAT wrapping makes this periodic automatically.
  vec2 coord = vUv - uDt * vel;
  fragColor = texture(uField, coord) * uDissipation;
}`;

/* ------------------------------------------------------------------ */
/* BFECC limiter: phi0 + 0.5*(phi0 - phi2), clamped to local AABB      */
/* ------------------------------------------------------------------ */
export const BFECC = STENCIL + /* glsl */ `
uniform sampler2D uPhi0;
uniform sampler2D uPhi2;
void main() {
  vec4 p0 = texelFetch(uPhi0, wrapCell(0, 0), 0);
  vec4 p2 = texelFetch(uPhi2, wrapCell(0, 0), 0);
  vec4 corr = p0 + 0.5 * (p0 - p2);
  vec4 mn = p0;
  vec4 mx = p0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec4 s = texelFetch(uPhi0, wrapCell(dx, dy), 0);
      mn = min(mn, s);
      mx = max(mx, s);
    }
  }
  fragColor = clamp(corr, mn, mx);
}`;

/* ------------------------------------------------------------------ */
/* Divergence of the intermediate velocity -> real part of FFT input   */
/* ------------------------------------------------------------------ */
export const DIVERGENCE = STENCIL + /* glsl */ `
uniform sampler2D uVel;
uniform float uH;
void main() {
  float uR = texelFetch(uVel, wrapCell(1, 0), 0).x;
  float uL = texelFetch(uVel, wrapCell(-1, 0), 0).x;
  float vT = texelFetch(uVel, wrapCell(0, 1), 0).y;
  float vB = texelFetch(uVel, wrapCell(0, -1), 0).y;
  fragColor = vec4(0.5 * ((uR - uL) + (vT - vB)) / uH, 0.0, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* One Stockham auto-sort butterfly stage of a radix-2 FFT.            */
/*                                                                     */
/* Invariant: after stage s the texture holds N/2^s contiguous blocks  */
/* of length 2^s, block R being the DFT of the strided samples         */
/* x[R + j*N/2^s].  With m = 2^s, mh = m/2, R in [0,N/m), t in [0,mh): */
/*                                                                     */
/*   a = X[R*mh + t] ; b = X[R*mh + t + N/2] ; w = exp(sign*2pi*i*t/m) */
/*   Y[R*m + t]        = a + w*b                                       */
/*   Y[R*m + t + mh]   = a - w*b                                       */
/*                                                                     */
/* Natural-order in, natural-order out: no bit-reversal permutation,   */
/* and the "b" operand is always exactly N/2 away, so both fetches are */
/* from the same cache line neighbourhood.  Each fragment emits one    */
/* output texel; the branch sign is recovered from the output index.   */
/* uAxis 0 -> transform along x, 1 -> along y.                         */
/* ------------------------------------------------------------------ */
export const FFT = HEADER + /* glsl */ `
uniform sampler2D uSrc;
uniform int uN;
uniform int uM;
uniform int uAxis;
uniform float uSign;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int q = (uAxis == 0) ? p.x : p.y;
  int mh = uM >> 1;
  int R = q / uM;                    // block index
  int rem = q - R * uM;
  int branch = rem >= mh ? 1 : 0;    // upper half of the block takes the minus
  int t = rem - branch * mh;         // position inside the butterfly
  int ia = R * mh + t;
  int ib = ia + (uN >> 1);
  float s = branch == 0 ? 1.0 : -1.0;
  ivec2 ca = (uAxis == 0) ? ivec2(ia, p.y) : ivec2(p.x, ia);
  ivec2 cb = (uAxis == 0) ? ivec2(ib, p.y) : ivec2(p.x, ib);
  vec2 a = texelFetch(uSrc, ca, 0).xy;
  vec2 b = texelFetch(uSrc, cb, 0).xy;
  float ang = uSign * TAU * float(t) / float(uM);
  vec2 w = vec2(cos(ang), sin(ang));
  vec2 wb = vec2(w.x * b.x - w.y * b.y, w.x * b.y + w.y * b.x);
  fragColor = vec4(a + s * wb, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Poisson Green's function:  phat = fhat / (lambda * dt * N^2)        */
/*                                                                     */
/* lambda MUST be the symbol of the operator actually used, i.e. the   */
/* composition of the two central first differences that build div and */
/* grad:                                                               */
/*     (D.D phat) = -(sin^2(2pi k/N) + sin^2(2pi l/N)) / h^2           */
/* (the *wide* stencil (p[i+2]-2p[i]+p[i-2])/4h^2), NOT the compact    */
/* 5-point Laplacian -4sin^2(pi k/N)/h^2. Using the matching symbol    */
/* makes div(u^{n+1}) vanish to round-off instead of leaving an O(h^2) */
/* residual.                                                           */
/*                                                                     */
/* That symbol is zero on the four modes with k,l in {0, N/2}: the     */
/* mean (pressure gauge) and the three checkerboard modes that a       */
/* collocated central-difference pair cannot see. They are pinned to   */
/* zero by an exact integer test - no float threshold, no NaNs.        */
/* ------------------------------------------------------------------ */
export const KERNEL = HEADER + /* glsl */ `
uniform sampler2D uSrc;
uniform int uN;
uniform float uH;
uniform float uScale;   // = 1/(dt * N^2), folds in the inverse-FFT normalisation
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 f = texelFetch(uSrc, p, 0).xy;
  int halfN = uN >> 1;
  bool degX = (p.x == 0) || (p.x == halfN);
  bool degY = (p.y == 0) || (p.y == halfN);
  if (degX && degY) { fragColor = vec4(0.0); return; }   // gauge + checkerboard null space
  float kk = float(p.x <= halfN ? p.x : p.x - uN);
  float ll = float(p.y <= halfN ? p.y : p.y - uN);
  float sx = sin(TAU * kk / float(uN));
  float sy = sin(TAU * ll / float(uN));
  float lam = -(sx * sx + sy * sy) / (uH * uH);
  fragColor = vec4(f * (uScale / lam), 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Chorin projection step: u = u* - dt * grad(p)                       */
/* ------------------------------------------------------------------ */
export const PROJECT = STENCIL + /* glsl */ `
uniform sampler2D uVelStar;
uniform sampler2D uPressure;
uniform float uH;
uniform float uDt;
void main() {
  float pR = texelFetch(uPressure, wrapCell(1, 0), 0).x;
  float pL = texelFetch(uPressure, wrapCell(-1, 0), 0).x;
  float pT = texelFetch(uPressure, wrapCell(0, 1), 0).x;
  float pB = texelFetch(uPressure, wrapCell(0, -1), 0).x;
  vec2 vel = texelFetch(uVelStar, wrapCell(0, 0), 0).xy;
  vel -= (uDt * 0.5 / uH) * vec2(pR - pL, pT - pB);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Explicit (forward-Euler) viscous diffusion of velocity              */
/* ------------------------------------------------------------------ */
export const DIFFUSE = STENCIL + /* glsl */ `
uniform sampler2D uVel;
uniform float uCoeff;   // nu*dt_sub/h^2, kept <= 0.2 by sub-cycling
void main() {
  vec2 c = texelFetch(uVel, wrapCell(0, 0), 0).xy;
  vec2 r = texelFetch(uVel, wrapCell(1, 0), 0).xy;
  vec2 l = texelFetch(uVel, wrapCell(-1, 0), 0).xy;
  vec2 t = texelFetch(uVel, wrapCell(0, 1), 0).xy;
  vec2 b = texelFetch(uVel, wrapCell(0, -1), 0).xy;
  vec2 lap = (r + l + t + b) - 4.0 * c;
  fragColor = vec4(c + uCoeff * lap, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Vorticity (curl)                                                    */
/* ------------------------------------------------------------------ */
export const CURL = STENCIL + /* glsl */ `
uniform sampler2D uVel;
uniform float uH;
void main() {
  vec2 r = texelFetch(uVel, wrapCell(1, 0), 0).xy;
  vec2 l = texelFetch(uVel, wrapCell(-1, 0), 0).xy;
  vec2 t = texelFetch(uVel, wrapCell(0, 1), 0).xy;
  vec2 b = texelFetch(uVel, wrapCell(0, -1), 0).xy;
  fragColor = vec4(0.5 * ((r.y - l.y) - (t.x - b.x)) / uH, 0.0, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Vorticity confinement force                                         */
/* ------------------------------------------------------------------ */
export const VORTICITY_FORCE = STENCIL + /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform float uH;
uniform float uDt;
uniform float uEps;
void main() {
  float c  = texelFetch(uCurl, wrapCell(0, 0), 0).x;
  float cR = abs(texelFetch(uCurl, wrapCell(1, 0), 0).x);
  float cL = abs(texelFetch(uCurl, wrapCell(-1, 0), 0).x);
  float cT = abs(texelFetch(uCurl, wrapCell(0, 1), 0).x);
  float cB = abs(texelFetch(uCurl, wrapCell(0, -1), 0).x);
  vec2 g = (0.5 / uH) * vec2(cR - cL, cT - cB);
  vec2 n = g / (length(g) + 1e-18);
  vec2 f = uEps * vec2(n.y, -n.x) * c;
  fragColor = vec4(texelFetch(uVel, wrapCell(0, 0), 0).xy + uDt * f, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Gaussian splat (pointer injection / seeding)                        */
/* ------------------------------------------------------------------ */
export const SPLAT = HEADER + /* glsl */ `
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 d = vUv - uPoint;
  d -= floor(d + 0.5);                 // nearest periodic image
  float g = exp(-dot(d, d) / (uRadius * uRadius));
  fragColor = texture(uTarget, vUv) + vec4(uValue * g, 0.0);
}`;

/* ------------------------------------------------------------------ */
/* Analytic initial conditions.  uOutKind: 0 = velocity, 1 = dye       */
/* ------------------------------------------------------------------ */
export const INIT = HEADER + /* glsl */ `
uniform int uPreset;
uniform int uOutKind;
uniform float uSeed;
uniform float uAmp;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Divergence-free turbulent field from a random streamfunction.
vec2 turbPsi(vec2 x, float seed) {
  vec2 g = vec2(0.0);
  float psi = 0.0;
  float dpsi_dx = 0.0, dpsi_dy = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float kx = floor(hash(vec2(fi, seed)) * 6.0) + 1.0;
    float ky = floor(hash(vec2(fi + 31.7, seed * 1.3)) * 6.0) + 1.0;
    float ph = hash(vec2(fi + 71.3, seed * 2.1)) * TAU;
    float amp = hash(vec2(fi + 13.1, seed * 3.7)) * 2.0 - 1.0;
    float k2 = kx * kx + ky * ky;
    amp /= k2;                                   // ~ k^-2 -> E(k) ~ k^-3
    float s = sin(TAU * (kx * x.x + ky * x.y) + ph);
    float c = cos(TAU * (kx * x.x + ky * x.y) + ph);
    psi += amp * s;
    dpsi_dx += amp * c * TAU * kx;
    dpsi_dy += amp * c * TAU * ky;
  }
  g.x = dpsi_dy;      // u =  dpsi/dy
  g.y = -dpsi_dx;     // v = -dpsi/dx
  return g;
}

vec2 lambOseen(vec2 x, vec2 c, float gamma, float sigma) {
  vec2 d = x - c;
  d -= floor(d + 0.5);
  float r2 = dot(d, d);
  float f = gamma / (TAU * (r2 + 1e-8)) * (1.0 - exp(-r2 / (sigma * sigma)));
  return vec2(-d.y, d.x) * f;
}

void main() {
  vec2 x = vUv;
  if (uOutKind == 0) {
    vec2 vel = vec2(0.0);
    if (uPreset == 0) {                     // Taylor–Green vortex
      vel = uAmp * vec2(-cos(TAU * x.x) * sin(TAU * x.y),
                         sin(TAU * x.x) * cos(TAU * x.y));
    } else if (uPreset == 1) {              // double shear layer (K–H roll-up)
      // psi = -cos(TAU y)/TAU + e*sin(TAU x)sin(TAU y)/TAU^2  ->  div-free by construction
      float e = 0.25;
      vel = uAmp * vec2(sin(TAU * x.y) + e * sin(TAU * x.x) * cos(TAU * x.y),
                       -e * cos(TAU * x.x) * sin(TAU * x.y));
    } else if (uPreset == 2) {              // decaying turbulence
      vel = uAmp * turbPsi(x, uSeed);
    } else if (uPreset == 3) {              // counter-rotating dipole
      vel = uAmp * (lambOseen(x, vec2(0.38, 0.5),  1.0, 0.07)
                  + lambOseen(x, vec2(0.62, 0.5), -1.0, 0.07));
    } else if (uPreset == 4) {              // four-vortex lattice
      vel = uAmp * (lambOseen(x, vec2(0.25, 0.25),  1.0, 0.09)
                  + lambOseen(x, vec2(0.75, 0.75),  1.0, 0.09)
                  + lambOseen(x, vec2(0.25, 0.75), -1.0, 0.09)
                  + lambOseen(x, vec2(0.75, 0.25), -1.0, 0.09));
    }
    fragColor = vec4(vel, 0.0, 1.0);
  } else {
    vec3 dye = vec3(0.0);
    if (uPreset == 0) {
      dye = 0.5 + 0.5 * vec3(sin(TAU * x.x), sin(TAU * x.y + 2.1), sin(TAU * (x.x + x.y) + 4.2));
      dye *= 0.9;
    } else if (uPreset == 1) {
      float band = smoothstep(0.35, 0.5, x.y) - smoothstep(0.5, 0.65, x.y);
      dye = mix(vec3(0.06, 0.55, 0.85), vec3(0.98, 0.45, 0.18), band);
      dye *= 0.55 + 0.45 * cos(TAU * 6.0 * x.x);
      dye = max(dye, vec3(0.0));
    } else if (uPreset == 2) {
      dye = 0.5 + 0.5 * cos(TAU * (vec3(1.0, 1.3, 1.7) * (x.x * 3.0 + x.y * 2.0) + vec3(0.0, 0.33, 0.67)));
      dye *= 0.85;
    } else if (uPreset == 3) {
      vec2 d1 = x - vec2(0.38, 0.5); d1 -= floor(d1 + 0.5);
      vec2 d2 = x - vec2(0.62, 0.5); d2 -= floor(d2 + 0.5);
      dye = vec3(0.95, 0.35, 0.25) * exp(-dot(d1, d1) / 0.004)
          + vec3(0.25, 0.65, 1.00) * exp(-dot(d2, d2) / 0.004);
    } else {
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 c = vec2(hash(vec2(fi, uSeed)), hash(vec2(fi + 9.0, uSeed + 3.0)));
        vec2 d = x - c; d -= floor(d + 0.5);
        vec3 col = 0.5 + 0.5 * cos(TAU * (vec3(1.0, 1.0, 1.0) * (fi / 5.0) + vec3(0.0, 0.33, 0.67)));
        dye += col * exp(-dot(d, d) / 0.0025);
      }
    }
    fragColor = vec4(clamp(dye, 0.0, 1.0), 1.0);
  }
}`;

/* ------------------------------------------------------------------ */
/* Continuous large-scale stirring (divergence-free by construction)   */
/* ------------------------------------------------------------------ */
export const STIR = HEADER + /* glsl */ `
uniform sampler2D uVel;
uniform float uTime;
uniform float uStrength;
uniform float uDt;
void main() {
  vec2 x = vUv;
  float t = uTime;
  // streamfunction with drifting phases -> u = dpsi/dy, v = -dpsi/dx (divergence-free)
  float k1 = 2.0, k2 = 3.0;
  float ax = TAU * (k1 * x.x + 0.11 * t);
  float ay = TAU * (k2 * x.y - 0.07 * t);
  float bx = TAU * (k2 * x.x + 0.05 * t + 0.3);
  float by = TAU * (k1 * x.y + 0.09 * t);
  float dpdx = k1 * cos(ax) * cos(ay) - k2 * sin(bx) * sin(by);
  float dpdy = -k2 * sin(ax) * cos(ay) + k1 * cos(bx) * cos(by);
  vec2 f = vec2(dpdy, -dpdx) * uStrength;   // uStrength = acceleration amplitude
  fragColor = vec4(texture(uVel, vUv).xy + uDt * f, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Ink source co-located with the stirring bands (keeps forced runs     */
/* from washing out to black), hue cycling slowly with time.           */
/* ------------------------------------------------------------------ */
export const STIR_DYE = HEADER + /* glsl */ `
uniform sampler2D uDye;
uniform float uTime;
uniform float uAmount;
void main() {
  vec2 x = vUv;
  float t = uTime;
  float k1 = 2.0, k2 = 3.0;
  float a = sin(TAU * (k1 * x.x + 0.11 * t)) * cos(TAU * (k2 * x.y - 0.07 * t));
  float b = cos(TAU * (k2 * x.x + 0.05 * t + 0.3)) * sin(TAU * (k1 * x.y + 0.09 * t));
  float src = smoothstep(0.62, 1.0, abs(a)) + smoothstep(0.62, 1.0, abs(b));
  vec3 ink = 0.55 + 0.45 * cos(TAU * (vec3(0.13, 0.11, 0.09) * t + vec3(0.0, 0.33, 0.67)));
  fragColor = vec4(texture(uDye, vUv).rgb + ink * src * uAmount, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Global integrals (single pass): div^2, |u|^2, curl^2, 1             */
/* ------------------------------------------------------------------ */
export const STATS = HEADER + /* glsl */ `
uniform sampler2D uVel;
uniform int uSrcN;
uniform float uH;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * 2;
  vec4 acc = vec4(0.0);
  for (int dy = 0; dy < 2; dy++) {
    for (int dx = 0; dx < 2; dx++) {
      ivec2 p = base + ivec2(dx, dy);
      vec2 c = texelFetch(uVel, p, 0).xy;
      vec2 r = texelFetch(uVel, ivec2((p.x + 1) % uSrcN, p.y), 0).xy;
      vec2 l = texelFetch(uVel, ivec2((p.x - 1 + uSrcN) % uSrcN, p.y), 0).xy;
      vec2 t = texelFetch(uVel, ivec2(p.x, (p.y + 1) % uSrcN), 0).xy;
      vec2 b = texelFetch(uVel, ivec2(p.x, (p.y - 1 + uSrcN) % uSrcN), 0).xy;
      float div = 0.5 * ((r.x - l.x) + (t.y - b.y)) / uH;
      float w   = 0.5 * ((r.y - l.y) - (t.x - b.x)) / uH;
      float k2  = dot(c, c);
      acc += vec4(div * div, k2, w * w, 0.0);
      acc.a = max(acc.a, k2);
    }
  }
  fragColor = acc;
}`;

/* ------------------------------------------------------------------ */
/* 2x2 box-sum reduction (texelFetch -> filtering independent)         */
/* ------------------------------------------------------------------ */
export const REDUCE = HEADER + /* glsl */ `
uniform sampler2D uSrc;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  vec4 a = texelFetch(uSrc, p, 0);
  vec4 b = texelFetch(uSrc, p + ivec2(1, 0), 0);
  vec4 c = texelFetch(uSrc, p + ivec2(0, 1), 0);
  vec4 d = texelFetch(uSrc, p + ivec2(1, 1), 0);
  fragColor = vec4(a.rgb + b.rgb + c.rgb + d.rgb,
                   max(max(a.a, b.a), max(c.a, d.a)));
}`;

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */
export const COPY = HEADER + /* glsl */ `
uniform sampler2D uSrc;
void main() { fragColor = texture(uSrc, vUv); }`;

export const CLEAR = HEADER + /* glsl */ `
uniform vec4 uValue;
void main() { fragColor = uValue; }`;

/* ------------------------------------------------------------------ */
/* Ambient background behind the letterboxed simulation viewport       */
/* ------------------------------------------------------------------ */
export const BACKGROUND = HEADER + /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(p);
  vec3 col = vec3(0.030, 0.043, 0.058);
  col += vec3(0.020, 0.055, 0.075) * (0.55 + 0.45 * cos(r * 9.0 - uTime * 0.35)) * (1.0 - smoothstep(0.0, 1.1, r));
  col += vec3(0.10, 0.045, 0.03) * uEnergy * exp(-r * 2.4);
  // engineering mesh
  vec2 g = abs(fract(uv * vec2(uRes.x / 26.0, uRes.y / 26.0)) - 0.5);
  float line = smoothstep(0.47, 0.5, max(g.x, g.y));
  col += vec3(0.05, 0.09, 0.11) * line * 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.35, 1.25, r);
  fragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Display / compositing                                               */
/* ------------------------------------------------------------------ */
export const DISPLAY = HEADER + /* glsl */ `
uniform sampler2D uDye;
uniform sampler2D uVel;
uniform sampler2D uScalar;    // pressure / divergence / curl depending on mode
uniform sampler2D uSpectrum;
uniform sampler2D uLut;
uniform sampler2D uDivLut;
uniform int   uMode;          // 0 dye, 1 speed, 2 vorticity, 3 pressure, 4 divergence, 5 spectrum
uniform int   uMapId;
uniform float uScale;
uniform float uExposure;
uniform float uGrid;
uniform vec2  uTexel;
uniform int   uN;
uniform float uTime;

vec3 seqLUT(float t) { return texture(uLut, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb; }
vec3 divLUT(float t) { return texture(uDivLut, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb; }

vec3 tonemap(vec3 c) {
  c = max(c, vec3(0.0));
  return vec3(1.0) - exp(-c * uExposure);
}

void main() {
  vec3 col;
  if (uMode == 0) {
    col = tonemap(texture(uDye, vUv).rgb);
    // faint blueprint mesh under the dye so voids are not flat black
    vec2 gp = vUv * 8.0;
    vec2 g = abs(fract(gp) - 0.5);
    col += vec3(0.012, 0.030, 0.042) * smoothstep(0.44, 0.5, max(g.x, g.y));
  } else if (uMode == 1) {
    float s = length(texture(uVel, vUv).xy) * uScale;
    col = seqLUT(pow(clamp(s, 0.0, 1.0), 0.75));
  } else if (uMode == 2) {
    float w = texture(uScalar, vUv).x * uScale;
    col = divLUT(0.5 + 0.5 * clamp(w, -1.0, 1.0));
  } else if (uMode == 3) {
    float p = texture(uScalar, vUv).x * uScale;
    col = divLUT(0.5 + 0.5 * clamp(p, -1.0, 1.0));
  } else if (uMode == 4) {
    // local *relative* divergence  |div u| h / |u|  on a log scale:
    // a correct spectral projection pushes this to float round-off (~1e-6)
    float d = abs(texture(uScalar, vUv).x);
    float sp = length(texture(uVel, vUv).xy);
    float rel = d * uTexel.x / max(sp, 1e-7);
    float lg = (log(max(rel, 1e-12)) / log(10.0) + 8.0) / 6.0;
    col = seqLUT(clamp(lg, 0.0, 1.0));
    col = mix(col, vec3(0.02, 0.03, 0.05), 0.22);
  } else {
    vec2 uv = fract(vUv + vec2(0.5));   // fftshift: zero mode to the centre
    vec2 sp = texture(uSpectrum, uv).xy;
    float mag = log(1.0 + length(sp) * uScale);
    col = seqLUT(clamp(mag / 6.0, 0.0, 1.0));
  }

  if (uGrid > 0.5) {
    vec2 cell = vUv * float(uN) / 32.0;
    vec2 g = abs(fract(cell) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    col = mix(col, vec3(0.55, 0.85, 0.95), line * 0.16);
  }

  // subtle frame vignette inside the sim viewport
  vec2 e = min(vUv, 1.0 - vUv);
  float vig = smoothstep(0.0, 0.035, min(e.x, e.y));
  col *= 0.35 + 0.65 * vig;

  fragColor = vec4(col, 1.0);
}`;
