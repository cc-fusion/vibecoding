// Single-Draw-Call Instanced 3D Voxel Particle System (Block Breaks, Chips, Splashes, Smoke)

import * as THREE from 'three';

const MAX_PARTICLES = 420;

export class ParticleSystem {
  constructor(scene, chunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.particles = [];
    this.cursor = 0;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, zeroMat);
      this.mesh.setColorAt(i, white);
      this.particles.push({ active: false });
    }
    this.scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.colorTmp = new THREE.Color();
  }

  emitBlockBreak(bx, by, bz, colorHex = '#888888', count = 20) {
    const base = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const shade = 0.75 + Math.random() * 0.45;
      this.spawn({
        x: bx + 0.2 + Math.random() * 0.6,
        y: by + 0.2 + Math.random() * 0.6,
        z: bz + 0.2 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 4.4,
        vy: Math.random() * 3.8 + 1.0,
        vz: (Math.random() - 0.5) * 4.4,
        size: 0.10 + Math.random() * 0.09,
        gravity: 16.5,
        life: 0.45 + Math.random() * 0.45,
        r: base.r * shade,
        g: base.g * shade,
        b: base.b * shade,
      });
    }
  }

  emitBlockChip(bx, by, bz, normal, colorHex = '#999999') {
    const base = new THREE.Color(colorHex);
    for (let i = 0; i < 3; i++) {
      const shade = 0.8 + Math.random() * 0.4;
      this.spawn({
        x: bx + 0.5 + normal.x * 0.54 + (Math.random() - 0.5) * 0.4,
        y: by + 0.5 + normal.y * 0.54 + (Math.random() - 0.5) * 0.4,
        z: bz + 0.5 + normal.z * 0.54 + (Math.random() - 0.5) * 0.4,
        vx: normal.x * 1.8 + (Math.random() - 0.5) * 2.2,
        vy: normal.y * 1.5 + Math.random() * 2.0,
        vz: normal.z * 1.8 + (Math.random() - 0.5) * 2.2,
        size: 0.08 + Math.random() * 0.05,
        gravity: 15.0,
        life: 0.28 + Math.random() * 0.22,
        r: base.r * shade,
        g: base.g * shade,
        b: base.b * shade,
      });
    }
  }

  emitSplash(x, y, z, count = 14) {
    for (let i = 0; i < count; i++) {
      const bright = 0.85 + Math.random() * 0.15;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + 0.1,
        z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 2.2 + Math.random() * 2.8,
        vz: (Math.random() - 0.5) * 3.2,
        size: 0.09,
        gravity: 14.0,
        life: 0.4 + Math.random() * 0.3,
        r: 0.35 * bright,
        g: 0.72 * bright,
        b: 1.0 * bright,
      });
    }
  }

  emitPuff(x, y, z, colorHex = '#f5f5f5', count = 12) {
    const base = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.7,
        y: y + Math.random() * 1.1,
        z: z + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 0.8 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 1.8,
        size: 0.14 + Math.random() * 0.1,
        gravity: -1.5,
        life: 0.5 + Math.random() * 0.35,
        r: base.r,
        g: base.g,
        b: base.b,
      });
    }
  }

  spawn(opts) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    this.particles[idx] = {
      active: true,
      age: 0,
      ...opts,
    };
  }

  update(dt) {
    let anyChanged = false;
    let activeCount = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      activeCount++;

      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (this.chunkManager && p.gravity > 0) {
        const b = this.chunkManager.getBlock(nx, ny, nz);
        if (b !== 0 && b !== 10) {
          p.vy = -p.vy * 0.32;
          p.vx *= 0.65;
          p.vz *= 0.65;
        } else {
          p.x = nx;
          p.y = ny;
          p.z = nz;
        }
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const scale = p.size * (1 - (p.age / p.life) * 0.45);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.age * 4.2, p.age * 3.1, 0);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      this.colorTmp.setRGB(p.r, p.g, p.b);
      this.mesh.setColorAt(i, this.colorTmp);
    }

    this.mesh.visible = activeCount > 0;
    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
