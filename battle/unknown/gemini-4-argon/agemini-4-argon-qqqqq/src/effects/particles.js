import * as THREE from 'three';
import { BLOCK, getDef } from '../world/blocks.js';

const MAX_PARTICLES = 320;
const FIREFLY_COUNT = 28;

export class ParticleSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.pool = [];
    this.cursor = 0;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
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
        gravity: 16,
        age: 0,
        life: 0.6,
      });
    }
    this.scene.add(this.mesh);

    // Ambient twilight/night fireflies
    this.buildFireflies();
  }

  buildFireflies() {
    const pos = new Float32Array(FIREFLY_COUNT * 3);
    this.fireflySeeds = [];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      this.fireflySeeds.push({
        ox: (Math.random() - 0.5) * 26,
        oy: 1.0 + Math.random() * 3.5,
        oz: (Math.random() - 0.5) * 26,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xffe875,
      size: 0.24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  spawnOne(x, y, z, vx, vy, vz, colorHex, size = 0.11, life = 0.65, gravity = 17) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    const p = this.pool[idx];
    p.active = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.size = size;
    p.life = life;
    p.age = 0;
    p.gravity = gravity;

    const col = new THREE.Color(colorHex);
    // Subtle per-fragment shade variation
    col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
    this.mesh.setColorAt(idx, col);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  emitBlockBreak(bx, by, bz, colorHex = '#888888', count = 22) {
    for (let i = 0; i < count; i++) {
      const ox = bx + 0.2 + Math.random() * 0.6;
      const oy = by + 0.2 + Math.random() * 0.6;
      const oz = bz + 0.2 + Math.random() * 0.6;
      const vx = (ox - (bx + 0.5)) * 5.5 + (Math.random() - 0.5) * 2.2;
      const vy = 1.8 + Math.random() * 3.4;
      const vz = (oz - (bz + 0.5)) * 5.5 + (Math.random() - 0.5) * 2.2;
      this.spawnOne(ox, oy, oz, vx, vy, vz, colorHex, 0.09 + Math.random() * 0.06, 0.5 + Math.random() * 0.35);
    }
  }

  emitMiningChip(bx, by, bz, nx, ny, nz, colorHex = '#888888') {
    for (let i = 0; i < 3; i++) {
      const px = bx + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.45;
      const py = by + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.45;
      const pz = bz + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.45;
      this.spawnOne(
        px, py, pz,
        nx * 1.8 + (Math.random() - 0.5) * 1.5,
        ny * 1.8 + 1.2 + Math.random(),
        nz * 1.8 + (Math.random() - 0.5) * 1.5,
        colorHex,
        0.07,
        0.35
      );
    }
  }

  emitWaterSplash(x, y, z) {
    for (let i = 0; i < 14; i++) {
      this.spawnOne(
        x + (Math.random() - 0.5) * 0.6,
        y + 0.1,
        z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 3.2,
        2.4 + Math.random() * 2.6,
        (Math.random() - 0.5) * 3.2,
        '#6ec1ff',
        0.08,
        0.55,
        14
      );
    }
  }

  update(dt, playerPos, sunBrightness) {
    const clampedDt = Math.min(0.05, dt);
    const dummy = new THREE.Object3D();
    let anyChanged = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      anyChanged = true;

      p.age += clampedDt;
      if (p.age >= p.life) {
        p.active = false;
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * clampedDt;
      const nx = p.x + p.vx * clampedDt;
      const ny = p.y + p.vy * clampedDt;
      const nz = p.z + p.vz * clampedDt;

      const hitBlock = this.world.getBlock(nx, ny, nz);
      if (hitBlock !== BLOCK.AIR && getDef(hitBlock).solid) {
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const scale = p.size * (1 - (p.age / p.life) * 0.45);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    // Update dusk/night fireflies
    const duskGlow = sunBrightness < 0.58 ? Math.min(0.88, (0.58 - sunBrightness) * 2.2) : 0;
    this.fireflyMat.opacity = duskGlow;
    if (duskGlow > 0.02) {
      const t = performance.now() * 0.001;
      const arr = this.fireflies.geometry.attributes.position.array;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const s = this.fireflySeeds[i];
        arr[i * 3] = playerPos.x + s.ox + Math.sin(t * 0.9 + s.phase) * 1.8;
        arr[i * 3 + 1] = playerPos.y + s.oy + Math.cos(t * 1.4 + s.phase) * 0.7;
        arr[i * 3 + 2] = playerPos.z + s.oz + Math.cos(t * 0.8 + s.phase * 1.3) * 1.8;
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;
      this.fireflies.visible = true;
    } else {
      this.fireflies.visible = false;
    }
  }
}
