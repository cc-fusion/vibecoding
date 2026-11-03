import * as THREE from "three";

const MAX = 3000;

const PART_VERT = /* glsl */ `
precision highp float;
in vec3 aColor;
in float aSize;
in float aAlpha;
out vec3 vColor;
out float vAlpha;
out float vFog;
void main(){
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * 300.0 / max(-mv.z, 0.1);
}`;

const PART_FRAG = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vFog;
uniform vec3 uFogColor;
uniform float uFogDensity;
layout(location = 0) out vec4 fragColor;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  if (max(abs(d.x), abs(d.y)) > 0.5) discard;
  float f = clamp(1.0 - exp(-pow(vFog * uFogDensity, 2.0)), 0.0, 1.0);
  vec3 c = mix(vColor, uFogColor, f);
  fragColor = vec4(c, vAlpha);
}`;

export class ParticleSystem {
  geo = new THREE.BufferGeometry();
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private count = 0;
  mat: THREE.ShaderMaterial;

  constructor() {
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: new THREE.Color(0.6, 0.75, 1) },
        uFogDensity: { value: 0.012 },
      },
      vertexShader: PART_VERT,
      fragmentShader: PART_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.geo.setDrawRange(0, 0);
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    size: number,
    life: number,
    gravity = 14,
  ) {
    let i = this.count;
    if (i >= MAX) {
      // recycle oldest
      i = Math.floor(Math.random() * MAX);
    } else this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
  }

  burst(
    x: number,
    y: number,
    z: number,
    n: number,
    color: [number, number, number],
    spread = 2.4,
    size = 0.12,
    life = 0.9,
    up = 2.5,
  ) {
    for (let i = 0; i < n; i++) {
      const v = 0.75 + Math.random() * 0.5;
      this.spawn(
        x + (Math.random() - 0.5) * 0.6,
        y + (Math.random() - 0.5) * 0.6,
        z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * spread,
        Math.random() * up,
        (Math.random() - 0.5) * spread,
        color[0] * v,
        color[1] * v,
        color[2] * v,
        size * (0.7 + Math.random() * 0.6),
        life * (0.6 + Math.random() * 0.8),
      );
    }
  }

  update(dt: number) {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        // swap with last
        const last = this.count - 1;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[last * 3 + k];
            this.vel[i * 3 + k] = this.vel[last * 3 + k];
            this.col[i * 3 + k] = this.col[last * 3 + k];
          }
          this.size[i] = this.size[last];
          this.alpha[i] = this.alpha[last];
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.grav[i] = this.grav[last];
          i--;
        }
        this.count--;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - 2.2 * dt;
      this.vel[i * 3 + 2] *= 1 - 2.2 * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
    }
    this.geo.setDrawRange(0, this.count);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ── weather (rain / snow) ──────────────────────────────────────────────────
const WEATHER_N = 3500;
const RAIN_VERT = /* glsl */ `
precision highp float;
in float aKind;
in float aSpeed;
uniform float uTime;
uniform vec3 uCenter;
uniform float uRange;
uniform float uSnow;
out float vAlpha;
out float vKind;
void main(){
  vec3 p = position;
  float fall = mod(uTime * aSpeed + p.y * 7.0, 1.0);
  vec3 w = vec3(
    mod(p.x * uRange + uCenter.x + uRange*0.5, uRange) - uRange*0.5 + uCenter.x - mod(uCenter.x, 1.0),
    uCenter.y + 22.0 - fall * 42.0,
    mod(p.z * uRange + uCenter.z + uRange*0.5, uRange) - uRange*0.5 + uCenter.z - mod(uCenter.z, 1.0)
  );
  if (uSnow > 0.5) {
    w.x += sin(uTime * 1.3 + p.y * 30.0) * 1.4;
    w.z += cos(uTime * 1.1 + p.x * 25.0) * 1.4;
  }
  vec4 mv = modelViewMatrix * vec4(w, 1.0);
  vAlpha = clamp(1.0 - length(mv.xyz) / (uRange * 0.55), 0.0, 1.0);
  vKind = aKind;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (uSnow > 0.5 ? 3.5 : 2.0) * 220.0 / max(-mv.z, 0.1) * 0.12;
}`;
const RAIN_FRAG = /* glsl */ `
precision highp float;
in float vAlpha;
in float vKind;
uniform float uSnow;
uniform vec3 uTint;
layout(location = 0) out vec4 fragColor;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  if (uSnow > 0.5) { if (length(d) > 0.5) discard; }
  else if (abs(d.x) > 0.22) discard;
  fragColor = vec4(uTint, vAlpha * (uSnow > 0.5 ? 0.85 : 0.5));
}`;

export class Weather {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  constructor() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(WEATHER_N * 3);
    const kind = new Float32Array(WEATHER_N);
    const speed = new Float32Array(WEATHER_N);
    for (let i = 0; i < WEATHER_N; i++) {
      pos[i * 3] = Math.random();
      pos[i * 3 + 1] = Math.random();
      pos[i * 3 + 2] = Math.random();
      kind[i] = Math.random();
      speed[i] = 0.5 + Math.random() * 0.3;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uRange: { value: 42 },
        uSnow: { value: 0 },
        uTint: { value: new THREE.Color(0.72, 0.8, 0.95) },
      },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }
  update(t: number, center: THREE.Vector3, intensity: number, snow: boolean) {
    this.points.visible = intensity > 0.01;
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uCenter.value.copy(center);
    this.mat.uniforms.uSnow.value = snow ? 1 : 0;
    (this.mat.uniforms.uTint.value as THREE.Color).setRGB(
      snow ? 1 : 0.7,
      snow ? 1 : 0.78,
      snow ? 1 : 0.95,
    );
    this.mat.opacity = intensity;
  }
}
