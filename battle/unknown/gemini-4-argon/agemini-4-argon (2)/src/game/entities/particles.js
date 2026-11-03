import * as THREE from 'three';
import { GRAVITY } from '../constants.js';
import { isSolidBlock } from '../blocks.js';

const MAX_PARTICLES = 320;
const MAX_WEATHER = 360;

export class ParticleManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // 1. Voxel burst particles (mining crumbs, splashes, combat hits)
    const cubeGeom = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.burstMesh = new THREE.InstancedMesh(cubeGeom, cubeMat, MAX_PARTICLES);
    this.burstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.burstMesh.frustumCulled = false;
    this.scene.add(this.burstMesh);

    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        scale: 1,
        gravity: 1,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(1, 1, 1),
      });
      this.burstMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.nextIdx = 0;

    // 2. Weather precipitation (rain streaks / snow flakes)
    const weatherGeom = new THREE.BoxGeometry(0.045, 0.35, 0.045);
    this.weatherMat = new THREE.MeshBasicMaterial({
      color: 0x9ecaff,
      transparent: true,
      opacity: 0.58,
    });
    this.weatherMesh = new THREE.InstancedMesh(weatherGeom, this.weatherMat, MAX_WEATHER);
    this.weatherMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;
    this.scene.add(this.weatherMesh);

    this.drops = [];
    for (let i = 0; i < MAX_WEATHER; i++) {
      this.drops.push({
        ox: (Math.random() - 0.5) * 34,
        oy: Math.random() * 20,
        oz: (Math.random() - 0.5) * 34,
        speed: 0.85 + Math.random() * 0.35,
      });
    }

    this._dummy = new THREE.Object3D();
  }

  emitBlockBreak(bx, by, bz, hexColor = '#888888', count = 18) {
    const baseCol = new THREE.Color(hexColor);
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextIdx];
      this.nextIdx = (this.nextIdx + 1) % MAX_PARTICLES;

      p.active = true;
      p.x = bx + 0.2 + Math.random() * 0.6;
      p.y = by + 0.2 + Math.random() * 0.6;
      p.z = bz + 0.2 + Math.random() * 0.6;
      p.vx = (Math.random() - 0.5) * 3.8;
      p.vy = 1.6 + Math.random() * 3.2;
      p.vz = (Math.random() - 0.5) * 3.8;
      p.scale = 0.7 + Math.random() * 0.7;
      p.gravity = 0.75;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.4;

      const shade = 0.8 + Math.random() * 0.35;
      p.color.copy(baseCol).multiplyScalar(shade);
    }
  }

  emitSplash(x, y, z, count = 14) {
    this.emitBlockBreak(x - 0.5, y - 0.3, z - 0.5, '#59b2ff', count);
  }

  emitCombatHit(x, y, z) {
    this.emitBlockBreak(x - 0.5, y, z - 0.5, '#ff6859', 12);
  }

  update(dt, playerPos, weatherMode = 'clear') {
    let anyDirty = false;
    const dummy = this._dummy;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        this.burstMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      anyDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        this.burstMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.vy -= GRAVITY * p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (isSolidBlock(this.world.getBlock(nx, ny, nz))) {
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const shrink = 1.0 - (p.life / p.maxLife) * 0.65;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale * shrink);
      dummy.rotation.set(p.life * 4, p.life * 3, 0);
      dummy.updateMatrix();
      this.burstMesh.setMatrixAt(i, dummy.matrix);
      this.burstMesh.setColorAt(i, p.color);
    }

    if (anyDirty || true) {
      this.burstMesh.instanceMatrix.needsUpdate = true;
      if (this.burstMesh.instanceColor) this.burstMesh.instanceColor.needsUpdate = true;
    }

    // Weather update
    if (weatherMode === 'clear') {
      this.weatherMesh.visible = false;
      return;
    }

    const isSnow = weatherMode === 'snow';
    this.weatherMesh.visible = true;
    this.weatherMat.color.setHex(isSnow ? 0xf2f7ff : 0x8ec2ff);
    this.weatherMat.opacity = isSnow ? 0.82 : 0.52;

    const fallRate = isSnow ? 3.2 : 16.5;
    for (let i = 0; i < MAX_WEATHER; i++) {
      const d = this.drops[i];
      d.oy -= fallRate * d.speed * dt;
      if (d.oy < -8) {
        d.oy = 14 + Math.random() * 6;
        d.ox = (Math.random() - 0.5) * 32;
        d.oz = (Math.random() - 0.5) * 32;
      }

      const wx = playerPos.x + d.ox + (isSnow ? Math.sin(performance.now() * 0.0015 + i) * 0.6 : 0);
      const wy = playerPos.y + d.oy;
      const wz = playerPos.z + d.oz;

      // Hide rain/snow underneath roofs or caves
      const surfY = this.world.generator.getSurfaceHeight(Math.floor(wx), Math.floor(wz));
      if (wy < surfY + 0.5 || isSolidBlock(this.world.getBlock(wx, wy + 1, wz))) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        dummy.position.set(wx, wy, wz);
        if (isSnow) {
          dummy.scale.set(2.1, 0.28, 2.1);
        } else {
          dummy.scale.set(0.85, 1.35, 0.85);
        }
        dummy.rotation.set(0, 0, 0);
      }
      dummy.updateMatrix();
      this.weatherMesh.setMatrixAt(i, dummy.matrix);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.burstMesh);
    this.scene.remove(this.weatherMesh);
    this.burstMesh.geometry.dispose();
    this.burstMesh.material.dispose();
    this.weatherMesh.geometry.dispose();
    this.weatherMat.dispose();
  }
}
