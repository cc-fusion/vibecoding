import * as THREE from 'three';
import { BLOCKS } from '../data/blocks.js';

const MAX_PARTICLES = 450;

export class ParticleSystem {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.dummy = new THREE.Object3D();
    this.colorTmp = new THREE.Color();

    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        size: 0.12,
        gravity: 20,
        life: 0,
        maxLife: 1,
        color: 0xffffff,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.colorTmp);
    }

    this.cursor = 0;
    this.scene.add(this.mesh);
  }

  spawn(opts) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.z = opts.z;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.size = opts.size ?? 0.13;
    p.gravity = opts.gravity ?? 22;
    p.maxLife = opts.life ?? 0.65;
    p.life = p.maxLife;
    p.color = opts.color ?? 0xffffff;
  }

  emitBlockBreak(bx, by, bz, blockId, count = 22) {
    const baseHex = this.atlas.getBlockColor(blockId);
    const r0 = (baseHex >> 16) & 255;
    const g0 = (baseHex >> 8) & 255;
    const b0 = baseHex & 255;

    for (let i = 0; i < count; i++) {
      const shade = 0.78 + Math.random() * 0.4;
      const r = Math.min(255, Math.round(r0 * shade));
      const g = Math.min(255, Math.round(g0 * shade));
      const b = Math.min(255, Math.round(b0 * shade));
      const col = (r << 16) | (g << 8) | b;

      const ox = (Math.random() - 0.5) * 0.75;
      const oy = (Math.random() - 0.5) * 0.75;
      const oz = (Math.random() - 0.5) * 0.75;

      this.spawn({
        x: bx + 0.5 + ox,
        y: by + 0.5 + oy,
        z: bz + 0.5 + oz,
        vx: ox * 4.5 + (Math.random() - 0.5) * 1.6,
        vy: 1.5 + Math.random() * 3.4,
        vz: oz * 4.5 + (Math.random() - 0.5) * 1.6,
        size: 0.10 + Math.random() * 0.08,
        gravity: 20,
        life: 0.45 + Math.random() * 0.45,
        color: col,
      });
    }
  }

  emitBlockChip(hitPos, normal, blockId) {
    const baseHex = this.atlas.getBlockColor(blockId);
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: hitPos.x + normal.x * 0.06 + (Math.random() - 0.5) * 0.25,
        y: hitPos.y + normal.y * 0.06 + (Math.random() - 0.5) * 0.25,
        z: hitPos.z + normal.z * 0.06 + (Math.random() - 0.5) * 0.25,
        vx: normal.x * 2.1 + (Math.random() - 0.5) * 2.0,
        vy: normal.y * 2.0 + 1.2 + Math.random() * 1.5,
        vz: normal.z * 2.1 + (Math.random() - 0.5) * 2.0,
        size: 0.08 + Math.random() * 0.05,
        gravity: 21,
        life: 0.28 + Math.random() * 0.22,
        color: baseHex,
      });
    }
  }

  emitSplash(x, y, z, count = 14) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + 0.1,
        z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 2.2 + Math.random() * 2.8,
        vz: (Math.random() - 0.5) * 3.2,
        size: 0.09 + Math.random() * 0.05,
        gravity: 18,
        life: 0.35 + Math.random() * 0.25,
        color: i % 3 === 0 ? 0xd9f3ff : 0x3ea2ff,
      });
    }
  }

  emitExplosion(x, y, z) {
    const palette = [0xffa126, 0xffe46b, 0xff511c, 0x5c5c63, 0xd8d8de];
    for (let i = 0; i < 65; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3.5 + Math.random() * 8.5;
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.8,
        y: y + (Math.random() - 0.5) * 0.8,
        z: z + (Math.random() - 0.5) * 0.8,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed + 2.0,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        size: 0.16 + Math.random() * 0.18,
        gravity: i % 2 === 0 ? 4.0 : 14.0,
        life: 0.55 + Math.random() * 0.65,
        color: palette[i % palette.length],
      });
    }
  }

  emitTorchEmber(x, y, z) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.14,
      y: y + 0.72,
      z: z + (Math.random() - 0.5) * 0.14,
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.55 + Math.random() * 0.45,
      vz: (Math.random() - 0.5) * 0.25,
      size: 0.06,
      gravity: -0.4,
      life: 0.45 + Math.random() * 0.35,
      color: Math.random() < 0.65 ? 0xffa834 : 0x55555a,
    });
  }

  update(dt, world) {
    let anyActive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        anyActive = true;
        continue;
      }

      p.vy -= p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (world) {
        const bBelow = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (BLOCKS[bBelow]?.solid) {
          p.vy = Math.abs(p.vy) * 0.28;
          p.vx *= 0.65;
          p.vz *= 0.65;
        } else {
          p.x = nx;
          p.y = ny;
          p.z = nz;
        }
      } else {
        p.x = nx; p.y = ny; p.z = nz;
      }

      const scale = p.size * Math.min(1.0, (p.life / p.maxLife) * 1.6);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      this.colorTmp.setHex(p.color);
      this.mesh.setColorAt(i, this.colorTmp);
      anyActive = true;
    }

    if (anyActive) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
