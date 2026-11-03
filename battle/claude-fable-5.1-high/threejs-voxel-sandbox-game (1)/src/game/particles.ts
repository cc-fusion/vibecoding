// Pooled point-sprite particles with gravity and simple voxel collision.
import * as THREE from "three";
import type { World } from "./world";
import { BLOCKS } from "./blocks";
import { getUniforms } from "./materials";

const MAX = 3000;

export class Particles {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private flags = new Uint8Array(MAX); // 1 = gravity+collide, 2 = no gravity (smoke/bubbles rise)
  private count = 0;
  private geo: THREE.BufferGeometry;

  constructor(private world: World) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setDrawRange(0, 0);
    const u = getUniforms();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: u.uSun, uFogColor: u.uFogColor, uFogNear: u.uFogNear, uFogFar: u.uFogFar, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize;
        varying vec3 vColor; varying float vDist;
        uniform float uPixelRatio;
        void main(){
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vDist = length(mv.xyz);
          gl_PointSize = aSize * uPixelRatio * 300.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vDist;
        uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
        void main(){
          float f = smoothstep(uFogNear, uFogFar, vDist);
          gl_FragColor = vec4(mix(vColor, uFogColor, f), 1.0);
        }`,
      transparent: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setPixelRatio(pr: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = pr;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, g: number, b: number, size: number, life: number, flag = 1) {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.flags[i] = flag;
  }

  /** Block break burst; colors sampled by caller. */
  burst(x: number, y: number, z: number, colors: [number, number, number][], n: number, light: number, spread = 1) {
    for (let i = 0; i < n; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      const px = x + Math.random(), py = y + Math.random(), pz = z + Math.random();
      const vx = (px - x - 0.5) * 4 * spread + (Math.random() - 0.5) * 2;
      const vy = Math.random() * 4 + 1;
      const vz = (pz - z - 0.5) * 4 * spread + (Math.random() - 0.5) * 2;
      this.spawn(px, py, pz, vx, vy, vz, (c[0] / 255) * light, (c[1] / 255) * light, (c[2] / 255) * light, 0.08 + Math.random() * 0.08, 0.6 + Math.random() * 0.6);
    }
  }

  update(dt: number) {
    const world = this.world;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const last = this.count - 1;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[last * 3 + k];
            this.vel[i * 3 + k] = this.vel[last * 3 + k];
            this.col[i * 3 + k] = this.col[last * 3 + k];
          }
          this.size[i] = this.size[last];
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.flags[i] = this.flags[last];
        }
        this.count--;
        continue;
      }
      const f = this.flags[i];
      let vx = this.vel[i * 3], vy = this.vel[i * 3 + 1], vz = this.vel[i * 3 + 2];
      if (f === 1) {
        vy -= 20 * dt;
        vx *= 1 - 2 * dt;
        vz *= 1 - 2 * dt;
      } else if (f === 2) {
        vy += 1.5 * dt;
        vx *= 1 - 1 * dt;
        vz *= 1 - 1 * dt;
      }
      let nx = this.pos[i * 3] + vx * dt, ny = this.pos[i * 3 + 1] + vy * dt, nz = this.pos[i * 3 + 2] + vz * dt;
      if (f === 1) {
        const id = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (BLOCKS[id]?.solid) {
          // resolve: stop vertical motion if the block below is solid
          const idBelow = world.getBlock(Math.floor(this.pos[i * 3]), Math.floor(ny), Math.floor(this.pos[i * 3 + 2]));
          if (BLOCKS[idBelow]?.solid) {
            ny = this.pos[i * 3 + 1];
            vy = 0;
            vx *= 0.5;
            vz *= 0.5;
          } else {
            nx = this.pos[i * 3];
            nz = this.pos[i * 3 + 2];
            vx = vz = 0;
          }
        }
      }
      this.pos[i * 3] = nx; this.pos[i * 3 + 1] = ny; this.pos[i * 3 + 2] = nz;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
}
