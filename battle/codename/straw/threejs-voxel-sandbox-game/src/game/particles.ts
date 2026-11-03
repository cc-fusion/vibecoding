// CPU particle system (block debris, flames, splashes...) + precipitation.
import * as THREE from 'three';
import { blockDef } from './blocks';

const MAX = 5000;

function pointsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uScale;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, 1.0); #include <colorspace_fragment> }`,
    depthWrite: true,
  });
}

export interface SpawnOpts {
  count: number;
  color: string | string[];
  speed?: number;      // random sphere speed
  up?: number;         // upward bias
  gravity?: number;
  life?: number;
  size?: number;
  spread?: number;     // spawn box half-size
  drag?: number;
}

const _c = new THREE.Color();

export class ParticleSystem {
  points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private dragK = new Float32Array(MAX);
  private alive = 0;
  private baseSize = new Float32Array(MAX);

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, pointsMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  setPixelScale(hPx: number, fovDeg: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = (hPx * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    precipScale = (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value;
  }

  spawn(x: number, y: number, z: number, o: SpawnOpts) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    const spread = o.spread ?? 0.3, speed = o.speed ?? 2.2;
    for (let n = 0; n < o.count; n++) {
      if (this.alive >= MAX) return;
      const i = this.alive++;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 2 * spread;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 2 * spread;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 2 * spread;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.3 + Math.random() * 0.7);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      this.vel[i * 3 + 1] = Math.cos(ph) * sp + (o.up ?? 0);
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      _c.set(colors[(Math.random() * colors.length) | 0]);
      const shade = 0.78 + Math.random() * 0.35;
      this.col[i * 3] = _c.r * shade; this.col[i * 3 + 1] = _c.g * shade; this.col[i * 3 + 2] = _c.b * shade;
      this.maxLife[i] = (o.life ?? 0.7) * (0.6 + Math.random() * 0.7);
      this.life[i] = this.maxLife[i];
      this.grav[i] = o.gravity ?? 14;
      this.dragK[i] = o.drag ?? 0.4;
      this.baseSize[i] = (o.size ?? 0.09) * (0.7 + Math.random() * 0.7);
      this.size[i] = this.baseSize[i];
    }
  }

  burstBlock(x: number, y: number, z: number, blockId: number, count = 22) {
    const c = blockDef(blockId).mapColor;
    this.spawn(x + 0.5, y + 0.5, z + 0.5, { count, color: c, speed: 2.6, up: 1.6, gravity: 16, life: 0.8, size: 0.1, spread: 0.42 });
  }

  private kill(i: number) {
    const last = --this.alive;
    if (i === last) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[last * 3 + k];
      this.vel[i * 3 + k] = this.vel[last * 3 + k];
      this.col[i * 3 + k] = this.col[last * 3 + k];
    }
    this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
    this.grav[i] = this.grav[last]; this.dragK[i] = this.dragK[last];
    this.baseSize[i] = this.baseSize[last]; this.size[i] = this.size[last];
  }

  update(dt: number) {
    for (let i = this.alive - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const dr = Math.max(0, 1 - this.dragK[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (f < 0.3 ? f / 0.3 : 1);
    }
    this.geo.setDrawRange(0, this.alive);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() { this.alive = 0; this.geo.setDrawRange(0, 0); }
}

let precipScale = 600;

// Rain / snow around the camera
export class Precipitation {
  points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private vel: Float32Array;
  private N = 1600;
  mode: 'rain' | 'snow' | null = null;
  private area = 38; private height = 26;

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N);
    const col = new Float32Array(this.N * 3);
    const size = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * this.area;
      this.pos[i * 3 + 1] = Math.random() * this.height;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * this.area;
      this.vel[i] = 0.8 + Math.random() * 0.4;
      col[i * 3] = 0.65; col[i * 3 + 1] = 0.75; col[i * 3 + 2] = 1.0;
      size[i] = 0.07;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = pointsMaterial();
    mat.transparent = true; mat.opacity = 0.75; mat.depthWrite = false;
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 8;
    scene.add(this.points);
  }

  update(dt: number, center: THREE.Vector3) {
    const mat = this.points.material as THREE.ShaderMaterial;
    mat.uniforms.uScale.value = precipScale;
    if (!this.mode) { this.points.visible = false; return; }
    this.points.visible = true;
    const fall = this.mode === 'rain' ? 24 : 2.6;
    const colAttr = this.geo.getAttribute('aColor') as THREE.BufferAttribute;
    const sizeAttr = this.geo.getAttribute('aSize') as THREE.BufferAttribute;
    const targetSize = this.mode === 'rain' ? 0.06 : 0.09;
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.N; i++) {
      let y = this.pos[i * 3 + 1] - fall * this.vel[i] * dt;
      let x = this.pos[i * 3], z = this.pos[i * 3 + 2];
      if (this.mode === 'snow') { x += Math.sin(t * 1.3 + i) * dt * 0.9; z += Math.cos(t * 1.1 + i * 0.7) * dt * 0.9; }
      else x += dt * 1.2;
      // wrap in box around center (positions stored relative to center)
      if (y < 0) y += this.height;
      if (x > this.area / 2) x -= this.area; if (x < -this.area / 2) x += this.area;
      if (z > this.area / 2) z -= this.area; if (z < -this.area / 2) z += this.area;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const c = this.mode === 'rain' ? [0.6, 0.72, 1.0] : [0.95, 0.97, 1.0];
      colAttr.setXYZ(i, c[0], c[1], c[2]);
      sizeAttr.setX(i, targetSize);
    }
    colAttr.needsUpdate = true; sizeAttr.needsUpdate = true;
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.points.position.set(center.x, center.y - 4, center.z);
  }
}
