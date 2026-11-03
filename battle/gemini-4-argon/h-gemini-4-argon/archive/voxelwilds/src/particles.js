import * as THREE from 'three';
import { BIOMES } from './constants.js';
import { getBlockDef, isSolidBlock } from './blocks.js';

const MAX_DEBRIS = 320;
const WEATHER_COUNT = 260;

export class ParticleSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // 1. Pooled InstancedMesh for 3D voxel block/splash/hit debris
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.debrisMesh = new THREE.InstancedMesh(boxGeom, boxMat, MAX_DEBRIS);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.frustumCulled = false;
    this.scene.add(this.debrisMesh);

    this.debrisPool = [];
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();

    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.debrisPool.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        size: 0.12,
        age: 0,
        life: 0.6,
        gravity: 22,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
      this.debrisMesh.setColorAt(i, this.tmpColor.setHex(0xffffff));
    }
    this.nextIdx = 0;

    // 2. Weather InstancedMesh (Rain streaks / Snowflakes)
    const wGeom = new THREE.BoxGeometry(1, 1, 1);
    const wMat = new THREE.MeshBasicMaterial({
      color: 0xd8ecff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.weatherMesh = new THREE.InstancedMesh(wGeom, wMat, WEATHER_COUNT);
    this.weatherMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;
    this.scene.add(this.weatherMesh);

    this.weatherDrops = [];
    for (let i = 0; i < WEATHER_COUNT; i++) {
      this.weatherDrops.push({
        ox: (Math.random() - 0.5) * 32,
        oz: (Math.random() - 0.5) * 32,
        y: Math.random() * 24,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  setWorld(world) {
    this.world = world;
  }

  emit({ x, y, z, vx, vy, vz, colorHex, size = 0.13, life = 0.65, gravity = 22 }) {
    const p = this.debrisPool[this.nextIdx];
    const idx = this.nextIdx;
    this.nextIdx = (this.nextIdx + 1) % MAX_DEBRIS;

    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.age = 0;
    p.life = life;
    p.gravity = gravity;

    this.tmpColor.set(colorHex);
    const jitter = 0.84 + Math.random() * 0.32;
    this.tmpColor.multiplyScalar(jitter);
    this.debrisMesh.setColorAt(idx, this.tmpColor);
    if (this.debrisMesh.instanceColor) {
      this.debrisMesh.instanceColor.needsUpdate = true;
    }
  }

  spawnBlockBreak(bx, by, bz, blockId) {
    const def = getBlockDef(blockId);
    const col = def.particleColor || '#999999';
    for (let i = 0; i < 20; i++) {
      const ox = bx + 0.2 + Math.random() * 0.6;
      const oy = by + 0.2 + Math.random() * 0.6;
      const oz = bz + 0.2 + Math.random() * 0.6;
      this.emit({
        x: ox,
        y: oy,
        z: oz,
        vx: (ox - (bx + 0.5)) * 5.2 + (Math.random() - 0.5) * 1.6,
        vy: 1.8 + Math.random() * 3.4,
        vz: (oz - (bz + 0.5)) * 5.2 + (Math.random() - 0.5) * 1.6,
        colorHex: col,
        size: 0.09 + Math.random() * 0.08,
        life: 0.45 + Math.random() * 0.4,
      });
    }
  }

  spawnBlockChip(bx, by, bz, nx, ny, nz, blockId) {
    const def = getBlockDef(blockId);
    const col = def.particleColor || '#999999';
    for (let i = 0; i < 3; i++) {
      this.emit({
        x: bx + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.45,
        y: by + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.45,
        z: bz + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.45,
        vx: nx * 1.8 + (Math.random() - 0.5) * 2.0,
        vy: ny * 1.6 + 1.4 + Math.random() * 1.5,
        vz: nz * 1.8 + (Math.random() - 0.5) * 2.0,
        colorHex: col,
        size: 0.07 + Math.random() * 0.05,
        life: 0.28 + Math.random() * 0.2,
      });
    }
  }

  spawnSplash(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.5;
      this.emit({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + 0.1,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: Math.cos(a) * spd,
        vy: 2.2 + Math.random() * 2.8,
        vz: Math.sin(a) * spd,
        colorHex: i % 3 === 0 ? '#d8f1ff' : '#4fa3ff',
        size: 0.08 + Math.random() * 0.05,
        life: 0.38 + Math.random() * 0.25,
      });
    }
  }

  spawnHitBurst(x, y, z, colorHex = '#ff5454') {
    for (let i = 0; i < 10; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.4,
        z: z + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 3.5,
        vy: 1.5 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 3.5,
        colorHex,
        size: 0.09,
        life: 0.35 + Math.random() * 0.2,
      });
    }
  }

  update(dt, playerPos, weatherIntensity = 0, currentBiome = BIOMES.PLAINS) {
    let anyDebrisUpdated = false;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const p = this.debrisPool[i];
      if (!p.active) continue;
      anyDebrisUpdated = true;

      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (this.world && isSolidBlock(this.world.getBlock(nx, ny - p.size * 0.5, nz))) {
        p.vy = Math.abs(p.vy) * 0.28;
        p.vx *= 0.72;
        p.vz *= 0.72;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const fade = 1 - Math.pow(p.age / p.life, 2);
      const s = p.size * fade;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (anyDebrisUpdated) {
      this.debrisMesh.instanceMatrix.needsUpdate = true;
    }

    // Weather precipitation around player
    const showWeather = weatherIntensity > 0.05 && currentBiome !== BIOMES.DESERT && currentBiome !== BIOMES.MESA;
    this.weatherMesh.visible = showWeather;
    if (!showWeather || !this.world) return;

    const isSnow = currentBiome === BIOMES.TAIGA;
    this.weatherMesh.material.color.setHex(isSnow ? 0xf7fbff : 0x9acaff);
    this.weatherMesh.material.opacity = (isSnow ? 0.85 : 0.52) * Math.min(1, weatherIntensity);

    const fallSpeed = isSnow ? 3.2 : 19.5;
    const now = performance.now() * 0.001;

    for (let i = 0; i < WEATHER_COUNT; i++) {
      const d = this.weatherDrops[i];
      d.y -= fallSpeed * dt;
      if (d.y < -8) {
        d.y = 16 + Math.random() * 6;
        d.ox = (Math.random() - 0.5) * 30;
        d.oz = (Math.random() - 0.5) * 30;
      }

      const wx = playerPos.x + d.ox + (isSnow ? Math.sin(now * 1.6 + d.phase) * 0.9 : 0);
      const wy = playerPos.y + d.y;
      const wz = playerPos.z + d.oz + (isSnow ? Math.cos(now * 1.4 + d.phase) * 0.9 : 0);

      // Shelter check: hide rain/snow beneath solid ceilings
      const roofY = this.world.getSurfaceHeight(wx, wz) + 1.05;
      if (wy < roofY) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
      } else {
        this.dummy.position.set(wx, wy, wz);
        if (isSnow) {
          this.dummy.scale.set(0.09, 0.09, 0.09);
        } else {
          this.dummy.scale.set(0.028, 0.52, 0.028);
        }
      }
      this.dummy.updateMatrix();
      this.weatherMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.debrisMesh);
    this.scene.remove(this.weatherMesh);
    this.debrisMesh.geometry.dispose();
    this.debrisMesh.material.dispose();
    this.weatherMesh.geometry.dispose();
    this.weatherMesh.material.dispose();
  }
}
