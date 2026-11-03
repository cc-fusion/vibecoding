// Pooled InstancedMesh 3D Voxel Particle System
import * as THREE from 'three';
import { getDef } from './items.js';

const MAX_PARTICLES = 450;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.cursor = 0;

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    const white = new THREE.Color(1, 1, 1);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, white);
      this.pool.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        size: 0.1,
        gravity: 18,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(1, 1, 1),
      });
    }

    if (this.scene) this.scene.add(this.mesh);
    this._dummy = dummy;
  }

  spawn({ x, y, z, vx, vy, vz, size = 0.12, gravity = 18, life = 0.65, colorHex = '#ffffff' }) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.size = size;
    p.gravity = gravity;
    p.life = 0;
    p.maxLife = life;
    p.color.set(colorHex);
    // Slight per-particle brightness variation
    const jitter = 0.85 + Math.random() * 0.3;
    p.color.multiplyScalar(jitter);
  }

  emitBlockBreak(bx, by, bz, blockId, count = 22) {
    const def = getDef(blockId);
    const hex = def.particleColor || '#999999';
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 0.75;
      const oy = (Math.random() - 0.5) * 0.75;
      const oz = (Math.random() - 0.5) * 0.75;
      this.spawn({
        x: bx + 0.5 + ox,
        y: by + 0.5 + oy,
        z: bz + 0.5 + oz,
        vx: ox * 4.5 + (Math.random() - 0.5) * 1.6,
        vy: Math.random() * 3.8 + 1.0,
        vz: oz * 4.5 + (Math.random() - 0.5) * 1.6,
        size: 0.09 + Math.random() * 0.08,
        gravity: 19,
        life: 0.45 + Math.random() * 0.4,
        colorHex: hex,
      });
    }
  }

  emitBlockChip(bx, by, bz, nx, ny, nz, blockId) {
    const def = getDef(blockId);
    const hex = def.particleColor || '#999999';
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: bx + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.45,
        y: by + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.45,
        z: bz + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.45,
        vx: nx * 1.8 + (Math.random() - 0.5) * 1.8,
        vy: ny * 1.5 + Math.random() * 2.2,
        vz: nz * 1.8 + (Math.random() - 0.5) * 1.8,
        size: 0.065 + Math.random() * 0.04,
        gravity: 17,
        life: 0.3 + Math.random() * 0.2,
        colorHex: hex,
      });
    }
  }

  emitSplash(x, y, z, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.6;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + 0.1,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: Math.cos(a) * spd,
        vy: 2.2 + Math.random() * 3.0,
        vz: Math.sin(a) * spd,
        size: 0.08 + Math.random() * 0.05,
        gravity: 15,
        life: 0.4 + Math.random() * 0.35,
        colorHex: i % 3 === 0 ? '#d8f1ff' : '#4298ff',
      });
    }
  }

  emitHitSpark(x, y, z, colorHex = '#ff5252', count = 12) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 1.5 + Math.random() * 3.0,
        vz: (Math.random() - 0.5) * 4.5,
        size: 0.08 + Math.random() * 0.05,
        gravity: 16,
        life: 0.35 + Math.random() * 0.25,
        colorHex,
      });
    }
  }

  update(dt, world) {
    let anyChanged = false;
    const dummy = this._dummy;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (world && getDef(world.getBlock(nx, ny, nz)).solid) {
        p.vy = Math.abs(p.vy) * 0.25;
        p.vx *= 0.6;
        p.vz *= 0.6;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const scale = p.size * (1.0 - (p.life / p.maxLife) * 0.45);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }

    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    if (this.scene && this.mesh) this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
