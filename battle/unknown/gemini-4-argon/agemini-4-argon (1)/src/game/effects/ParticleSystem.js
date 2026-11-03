import * as THREE from 'three';
import { getItemDef, BLOCK_IDS } from '../data/blocks.js';

const MAX_PARTICLES = 320;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.cursor = 0;

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.instanced = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES);
    this.instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instanced.frustumCulled = false;

    const dummyColor = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.instanced.setColorAt(i, dummyColor);
      this.pool.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0,
        size: 0.12,
        gravity: 22.0,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(1, 1, 1),
      });
    }
    this.scene.add(this.instanced);
    this.dummy = new THREE.Object3D();
  }

  spawn({ x, y, z, vx, vy, vz, size = 0.13, colorHex = 0xffffff, life = 0.7, gravity = 22.0 }) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.rx = Math.random() * Math.PI;
    p.ry = Math.random() * Math.PI;
    p.size = size;
    p.gravity = gravity;
    p.life = life;
    p.maxLife = life;

    p.color.setHex(colorHex);
    const jitter = 0.85 + Math.random() * 0.3;
    p.color.multiplyScalar(jitter);
  }

  emitBlockBreak(wx, wy, wz, blockId) {
    const def = getItemDef(blockId);
    const baseColor = def.particleColor || 0x999999;
    const count = 20;

    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 0.75;
      const oy = (Math.random() - 0.5) * 0.75;
      const oz = (Math.random() - 0.5) * 0.75;
      this.spawn({
        x: wx + 0.5 + ox,
        y: wy + 0.5 + oy,
        z: wz + 0.5 + oz,
        vx: ox * 5.2 + (Math.random() - 0.5) * 1.8,
        vy: 2.2 + Math.random() * 3.4,
        vz: oz * 5.2 + (Math.random() - 0.5) * 1.8,
        size: 0.11 + Math.random() * 0.08,
        colorHex: baseColor,
        life: 0.55 + Math.random() * 0.45,
        gravity: 22.0,
      });
    }
  }

  emitMiningChip(wx, wy, wz, normal, blockId) {
    const def = getItemDef(blockId);
    const baseColor = def.particleColor || 0x999999;
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: wx + 0.5 + normal.x * 0.52 + (Math.random() - 0.5) * 0.4,
        y: wy + 0.5 + normal.y * 0.52 + (Math.random() - 0.5) * 0.4,
        z: wz + 0.5 + normal.z * 0.52 + (Math.random() - 0.5) * 0.4,
        vx: normal.x * 2.2 + (Math.random() - 0.5) * 2.0,
        vy: normal.y * 2.0 + 1.5 + Math.random() * 1.5,
        vz: normal.z * 2.2 + (Math.random() - 0.5) * 2.0,
        size: 0.08 + Math.random() * 0.05,
        colorHex: baseColor,
        life: 0.32 + Math.random() * 0.2,
        gravity: 20.0,
      });
    }
  }

  emitSplash(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.6;
      this.spawn({
        x: x + Math.cos(a) * 0.25,
        y: y + 0.1,
        z: z + Math.sin(a) * 0.25,
        vx: Math.cos(a) * spd,
        vy: 2.5 + Math.random() * 2.8,
        vz: Math.sin(a) * spd,
        size: 0.09,
        colorHex: i % 3 === 0 ? 0xd9f2ff : 0x4da2ff,
        life: 0.45 + Math.random() * 0.25,
        gravity: 18.0,
      });
    }
  }

  emitHitBurst(x, y, z, colorHex = 0xff5252) {
    for (let i = 0; i < 10; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.4,
        z: z + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 1.8 + Math.random() * 2.6,
        vz: (Math.random() - 0.5) * 4.5,
        size: 0.1,
        colorHex,
        life: 0.4 + Math.random() * 0.2,
        gravity: 16.0,
      });
    }
  }

  update(dt, world) {
    let anyColorChanged = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.instanced.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.instanced.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (world) {
        const bid = world.getBlock(nx, ny, nz);
        if (bid !== BLOCK_IDS.AIR && getItemDef(bid).solid) {
          p.vy = Math.abs(p.vy) * 0.28;
          p.vx *= 0.55;
          p.vz *= 0.55;
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

      p.rx += dt * 4.0;
      p.ry += dt * 5.0;
      const shrink = Math.min(1.0, (p.life / p.maxLife) * 1.5);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rx, p.ry, 0);
      this.dummy.scale.setScalar(p.size * shrink);
      this.dummy.updateMatrix();
      this.instanced.setMatrixAt(i, this.dummy.matrix);
      this.instanced.setColorAt(i, p.color);
      anyColorChanged = true;
    }

    this.instanced.instanceMatrix.needsUpdate = true;
    if (anyColorChanged && this.instanced.instanceColor) {
      this.instanced.instanceColor.needsUpdate = true;
    }
  }
}
