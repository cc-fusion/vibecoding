// GPU-point particle system using atlas tiles (block debris) and flat colors (smoke, flames, splashes).
import * as THREE from 'three';
import { TILE } from './blocks';

const VERT = `
attribute float aSize; attribute vec4 aUV; attribute vec4 aColor;
uniform float uScale;
varying vec4 vUV; varying vec4 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 96.0);
  vUV = aUV; vC = aColor;
}`;
const FRAG = `
uniform sampler2D map; uniform float uLight; uniform vec3 uFogColor; uniform float uFogFar;
varying vec4 vUV; varying vec4 vC;
void main() {
  vec4 t = texture2D(map, vUV.xy + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * vUV.zw);
  float a = t.a * vC.a;
  if (a < 0.05) discard;
  gl_FragColor = vec4(t.rgb * vC.rgb * uLight, a);
}`;

export class Particles {
  max = 2400; n = 0;
  pos = new Float32Array(this.max * 3); size = new Float32Array(this.max);
  uv = new Float32Array(this.max * 4); col = new Float32Array(this.max * 4);
  vel = new Float32Array(this.max * 3); life = new Float32Array(this.max); maxLife = new Float32Array(this.max);
  grav = new Float32Array(this.max); baseA = new Float32Array(this.max); shrink = new Uint8Array(this.max);
  points: THREE.Points;
  uniforms = { map: { value: null as THREE.Texture | null }, uScale: { value: 600 }, uLight: { value: 1 }, uFogColor: { value: new THREE.Color() }, uFogFar: { value: 100 } };
  geo = new THREE.BufferGeometry();

  constructor(scene: THREE.Scene, atlas: THREE.Texture) {
    this.uniforms.map.value = atlas;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aUV', new THREE.BufferAttribute(this.uv, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, tile: number, r: number, g: number, b: number, a = 1, grav = 20, sub = false, shrink = false) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav;
    const tx = (tile & 15) / 16, ty = 1 - ((tile >> 4) + 1) / 16;
    if (sub) {
      const s = 4 / 256, ox = Math.floor(Math.random() * 3) * s, oy = Math.floor(Math.random() * 3) * s;
      this.uv[i * 4] = tx + ox; this.uv[i * 4 + 1] = ty + oy; this.uv[i * 4 + 2] = s; this.uv[i * 4 + 3] = s;
    } else { this.uv[i * 4] = tx + 0.002; this.uv[i * 4 + 1] = ty + 0.002; this.uv[i * 4 + 2] = 1 / 16 - 0.004; this.uv[i * 4 + 3] = 1 / 16 - 0.004; }
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.baseA[i] = a; this.shrink[i] = shrink ? 1 : 0;
  }

  debris(x: number, y: number, z: number, tile: number, tint: number[] | null, count: number, speed = 3) {
    for (let i = 0; i < count; i++) {
      const k = 0.7 + Math.random() * 0.4;
      this.spawn(x + (Math.random() - 0.5) * 0.9, y + (Math.random() - 0.5) * 0.9, z + (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * speed, Math.random() * speed * 0.9, (Math.random() - 0.5) * speed,
        0.5 + Math.random() * 0.7, 0.11 + Math.random() * 0.07, tile, (tint ? tint[0] : 1) * k, (tint ? tint[1] : 1) * k, (tint ? tint[2] : 1) * k, 1, 22, true);
    }
  }
  puff(x: number, y: number, z: number, r: number, g: number, b: number, count: number, spread = 1, up = 0.6, size = 0.35, life = 0.8) {
    for (let i = 0; i < count; i++) {
      const v = 0.8 + Math.random() * 0.2;
      this.spawn(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * spread, up * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * spread, life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), TILE.white, r * v, g * v, b * v, 0.8, -0.3, false, true);
    }
  }
  flame(x: number, y: number, z: number) {
    this.spawn(x + (Math.random() - 0.5) * 0.08, y, z + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2, 0.45, 0.09, TILE.white, 1, 0.55 + Math.random() * 0.35, 0.1, 0.95, -0.5, false, true);
  }

  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const l = --this.n;
        if (i !== l) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[l * 3 + k]; this.vel[i * 3 + k] = this.vel[l * 3 + k]; }
          for (let k = 0; k < 4; k++) { this.uv[i * 4 + k] = this.uv[l * 4 + k]; this.col[i * 4 + k] = this.col[l * 4 + k]; }
          this.life[i] = this.life[l]; this.maxLife[i] = this.maxLife[l]; this.size[i] = this.size[l];
          this.grav[i] = this.grav[l]; this.baseA[i] = this.baseA[l]; this.shrink[i] = this.shrink[l];
        }
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const d = Math.max(0, 1 - dt * 1.2);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 4 + 3] = this.baseA[i] * Math.min(1, f * 3);
      if (this.shrink[i]) this.size[i] *= 1 - dt * 0.9;
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aSize', 'aUV', 'aColor']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(scene: THREE.Scene) { scene.remove(this.points); this.geo.dispose(); }
}
