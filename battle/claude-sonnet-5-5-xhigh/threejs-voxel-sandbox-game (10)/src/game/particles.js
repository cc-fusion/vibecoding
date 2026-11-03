// Lightweight CPU particle system rendered as one instanced mesh of small cubes.
import * as THREE from 'three';
import { layerOf, DEFS, B } from './blocks.js';
import { tileAverage } from './textures.js';

export class Particles {
  constructor(scene, world, max = 900) {
    this.max = max;
    this.world = world;
    this.enabled = true;
    this.lightFn = () => 1;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.z = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.collide = new Uint8Array(max);
    this.col = new Float32Array(max * 3);
    this.next = 0;
    this.dummy = new THREE.Object3D();
    const m0 = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, m0);
  }

  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 18, drag = 0.5, collide = 1) {
    if (!this.enabled) return;
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.grav[i] = grav; this.drag[i] = drag; this.collide[i] = collide;
  }

  blockColor(id, f) {
    const d = DEFS[id];
    let layer = d && d.layers ? d.layers[f === undefined ? 4 : f] : -1;
    if (layer < 0) layer = layerOf('stone');
    const c = tileAverage(layer);
    let r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    if (d && d.tint === 1) { r *= 0.5; g *= 0.85; b *= 0.35; }
    else if (d && d.tint === 2) { r *= 0.45; g *= 0.8; b *= 0.3; }
    return [r, g, b];
  }

  breakBlock(x, y, z, id, count = 18) {
    const [r, g, b] = this.blockColor(id, 4);
    const [tr, tg, tb] = id === B.GRASS ? this.blockColor(B.DIRT, 4) : [r, g, b];
    const L = this.lightFn(x, y, z);
    for (let i = 0; i < count; i++) {
      const v = 0.75 + Math.random() * 0.4;
      const useTop = id === B.GRASS && Math.random() < 0.35;
      const cr = (useTop ? r : tr) * v * L, cg = (useTop ? g : tg) * v * L, cb = (useTop ? b : tb) * v * L;
      this.spawn(x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7,
        (Math.random() - 0.5) * 4, Math.random() * 3.5 + 0.5, (Math.random() - 0.5) * 4, 0.6 + Math.random() * 0.7, 0.07 + Math.random() * 0.07, cr, cg, cb);
    }
  }

  hitBlock(x, y, z, id, nx, ny, nz) {
    const [r, g, b] = this.blockColor(id, 4);
    const L = this.lightFn(x, y, z);
    for (let i = 0; i < 3; i++) {
      const v = 0.75 + Math.random() * 0.4;
      this.spawn(x + 0.5 + nx * 0.52 + (Math.random() - 0.5) * (nx ? 0 : 0.9), y + 0.5 + ny * 0.52 + (Math.random() - 0.5) * (ny ? 0 : 0.9), z + 0.5 + nz * 0.52 + (Math.random() - 0.5) * (nz ? 0 : 0.9),
        nx * 2 + (Math.random() - 0.5) * 1.5, ny * 2 + Math.random() * 2, nz * 2 + (Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 0.4, 0.05 + Math.random() * 0.04, r * v * L, g * v * L, b * v * L);
    }
  }

  smoke(x, y, z, n = 1, dark = 0.4, size = 0.18) {
    for (let i = 0; i < n; i++) {
      const c = dark + Math.random() * 0.15;
      this.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.6, size, c, c, c, -0.3, 0.8, 0);
    }
  }

  flame(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      this.spawn(x + (Math.random() - 0.5) * 0.4, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, 0.8 + Math.random(), (Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.3, 0.07, 1, 0.45 + t * 0.45, 0.1, -2, 0.6, 0);
    }
  }

  splash(x, y, z, n = 8, up = 3) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2.5, Math.random() * up + 1, (Math.random() - 0.5) * 2.5, 0.5 + Math.random() * 0.4, 0.05 + Math.random() * 0.04, 0.6, 0.78, 1.0, 14, 0.3, 0);
    }
  }

  rainSplash(x, y, z) {
    this.spawn(x, y + 0.05, z, (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8, 0.25, 0.04, 0.7, 0.8, 1, 12, 0.2, 0);
  }

  explosion(x, y, z, power) {
    const n = Math.floor(40 * power);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 2, s = (2 + Math.random() * 6) * (0.4 + power * 0.25);
      const c = 0.15 + Math.random() * 0.25;
      this.spawn(x, y, z, Math.cos(a) * s, e * s * 0.5 + 1, Math.sin(a) * s, 0.8 + Math.random() * 1.0, 0.25 + Math.random() * 0.3, c, c, c, -0.2, 0.9, 0);
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * 5;
      this.spawn(x, y, z, Math.cos(a) * s, Math.random() * 4, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 0.14, 1, 0.5 + Math.random() * 0.4, 0.1, 4, 0.8, 0);
    }
  }

  poof(x, y, z, n = 12, size = 0.15) {
    for (let i = 0; i < n; i++) {
      const c = 0.85 + Math.random() * 0.15;
      this.spawn(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.5 + Math.random() * 0.4, size, c, c, c, -0.5, 0.9, 0);
    }
  }

  crit(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      this.spawn(x, y, z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.4, 0.06, 1, 0.9, 0.35, 4, 0.5, 0);
    }
  }

  crumbs(x, y, z, r, g, b, n = 4) {
    for (let i = 0; i < n; i++) {
      this.spawn(x, y, z, (Math.random() - 0.5) * 1.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 1.5, 0.4, 0.04, r, g, b, 16, 0.4, 1);
    }
  }

  update(dt) {
    const world = this.world, d = this.dummy, m = this.mesh;
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        d.position.set(0, -1000, 0); d.scale.setScalar(0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); dirty = true;
        continue;
      }
      this.vy[i] -= this.grav[i] * dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= k; this.vz[i] *= k;
      if (this.grav[i] < 0) this.vy[i] *= k;
      let nx = this.x[i] + this.vx[i] * dt, ny = this.y[i] + this.vy[i] * dt, nz = this.z[i] + this.vz[i] * dt;
      if (this.collide[i] && world.isSolid(Math.floor(nx), Math.floor(ny - 0.03), Math.floor(nz))) {
        if (!world.isSolid(Math.floor(this.x[i]), Math.floor(ny - 0.03), Math.floor(this.z[i]))) { nx = this.x[i]; nz = this.z[i]; }
        else if (this.vy[i] < 0) { ny = this.y[i]; this.vy[i] = 0; this.vx[i] *= 0.5; this.vz[i] *= 0.5; nx = this.x[i]; nz = this.z[i]; }
        else { ny = this.y[i]; this.vy[i] = -this.vy[i] * 0.3; }
      }
      this.x[i] = nx; this.y[i] = ny; this.z[i] = nz;
      const t = this.life[i] / this.maxLife[i];
      const s = this.size[i] * (t < 0.3 ? t / 0.3 : 1);
      d.position.set(nx, ny, nz); d.scale.setScalar(s); d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.instanceColor.setXYZ(i, this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]);
      dirty = true;
    }
    if (dirty) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
}
