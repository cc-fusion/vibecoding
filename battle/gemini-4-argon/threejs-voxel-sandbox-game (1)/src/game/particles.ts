import * as THREE from 'three';
import { isSolidBlock } from './blocks';
import { WORLD_HEIGHT } from './constants';
import { WorldBlockGetter } from './raycast';
import { WeatherKind } from './types';

interface VoxelParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  gravity: number;
  age: number;
  life: number;
  color: THREE.Color;
}

const MAX_PARTICLES = 650;
const WEATHER_COUNT = 550;

export class ParticleSystem {
  readonly mesh: THREE.InstancedMesh;
  readonly weatherPoints: THREE.Points;
  private pool: VoxelParticle[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();
  private weatherPositions: Float32Array;
  private weatherGeom: THREE.BufferGeometry;
  private weatherMat: THREE.PointsMaterial;

  constructor(scene: THREE.Scene) {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.1,
        gravity: 20,
        age: 0,
        life: 1,
        color: new THREE.Color(1, 1, 1),
      });
      this.mesh.setMatrixAt(i, zeroMatrix);
      this.mesh.setColorAt(i, white);
    }
    scene.add(this.mesh);

    // Weather particles (Rain & Snow)
    this.weatherPositions = new Float32Array(WEATHER_COUNT * 3);
    for (let i = 0; i < WEATHER_COUNT; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 44;
      this.weatherPositions[i * 3 + 1] = Math.random() * 26;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    this.weatherGeom = new THREE.BufferGeometry();
    this.weatherGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.weatherPositions, 3)
    );
    this.weatherMat = new THREE.PointsMaterial({
      color: 0x9fd0ff,
      size: 0.18,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeom, this.weatherMat);
    this.weatherPoints.frustumCulled = false;
    this.weatherPoints.visible = false;
    scene.add(this.weatherPoints);
  }

  emitBlockBreak(wx: number, wy: number, wz: number, hexColor: string, count = 22): void {
    const base = new THREE.Color(hexColor);
    for (let i = 0; i < count; i++) {
      const p = this.nextSlot();
      p.active = true;
      p.x = wx + 0.2 + Math.random() * 0.6;
      p.y = wy + 0.2 + Math.random() * 0.6;
      p.z = wz + 0.2 + Math.random() * 0.6;
      p.vx = (Math.random() - 0.5) * 4.4;
      p.vy = 1.2 + Math.random() * 3.8;
      p.vz = (Math.random() - 0.5) * 4.4;
      p.size = 0.08 + Math.random() * 0.1;
      p.gravity = 19;
      p.age = 0;
      p.life = 0.45 + Math.random() * 0.45;
      const shade = 0.75 + Math.random() * 0.4;
      p.color.setRGB(base.r * shade, base.g * shade, base.b * shade);
    }
  }

  emitMiningChip(
    wx: number,
    wy: number,
    wz: number,
    nx: number,
    ny: number,
    nz: number,
    hexColor: string
  ): void {
    const base = new THREE.Color(hexColor);
    for (let i = 0; i < 4; i++) {
      const p = this.nextSlot();
      p.active = true;
      p.x = wx + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.5;
      p.y = wy + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.5;
      p.z = wz + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.5;
      p.vx = nx * 1.8 + (Math.random() - 0.5) * 2.2;
      p.vy = ny * 1.8 + 1.4 + Math.random() * 1.5;
      p.vz = nz * 1.8 + (Math.random() - 0.5) * 2.2;
      p.size = 0.06 + Math.random() * 0.06;
      p.gravity = 18;
      p.age = 0;
      p.life = 0.28 + Math.random() * 0.22;
      p.color.copy(base).multiplyScalar(0.8 + Math.random() * 0.35);
    }
  }

  emitExplosion(x: number, y: number, z: number): void {
    const palette = ['#ff9d2e', '#ff5722', '#fff199', '#e5e7eb', '#52525b'];
    for (let i = 0; i < 95; i++) {
      const p = this.nextSlot();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 1.4;
      p.y = y + (Math.random() - 0.5) * 1.4;
      p.z = z + (Math.random() - 0.5) * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3.5 + Math.random() * 11;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.abs(Math.cos(phi)) * speed * 0.9 + 2.0;
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;
      p.size = 0.14 + Math.random() * 0.24;
      p.gravity = 14;
      p.age = 0;
      p.life = 0.6 + Math.random() * 0.85;
      p.color.set(palette[Math.floor(Math.random() * palette.length)]);
    }
  }

  emitEmber(x: number, y: number, z: number): void {
    const p = this.nextSlot();
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 0.16;
    p.y = y;
    p.z = z + (Math.random() - 0.5) * 0.16;
    p.vx = (Math.random() - 0.5) * 0.35;
    p.vy = 0.7 + Math.random() * 0.8;
    p.vz = (Math.random() - 0.5) * 0.35;
    p.size = 0.055;
    p.gravity = -0.4;
    p.age = 0;
    p.life = 0.45 + Math.random() * 0.35;
    p.color.set(Math.random() > 0.4 ? '#ffaa33' : '#fff3a1');
  }

  private nextSlot(): VoxelParticle {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    return p;
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    weather: WeatherKind,
    getBlock: WorldBlockGetter
  ): void {
    let anyUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      anyUpdated = true;
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

      if (isSolidBlock(getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
        p.vy = 0;
        p.vx *= 0.65;
        p.vz *= 0.65;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const scale = p.size * (1 - (p.age / p.life) * 0.55);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }

    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) {
        this.mesh.instanceColor.needsUpdate = true;
      }
    }

    // Update weather precipitation with real roof occlusion!
    if (weather === 'clear') {
      this.weatherPoints.visible = false;
      return;
    }

    this.weatherPoints.visible = true;
    const isSnow = weather === 'snow';
    this.weatherMat.color.setHex(isSnow ? 0xf8fbff : 0x8cc6ff);
    this.weatherMat.size = isSnow ? 0.16 : 0.2;
    this.weatherMat.opacity = isSnow ? 0.85 : 0.62;

    const fallSpeed = isSnow ? 3.2 : 19.5;
    for (let i = 0; i < WEATHER_COUNT; i++) {
      const idx = i * 3;
      let wx = this.weatherPositions[idx];
      let wy = this.weatherPositions[idx + 1];
      let wz = this.weatherPositions[idx + 2];

      wy -= fallSpeed * dt;
      if (isSnow) {
        wx += Math.sin(wy * 0.9 + i) * 0.9 * dt;
      }

      // Wrap around player 42x42 box
      if (wx < playerX - 21) wx += 42;
      if (wx > playerX + 21) wx -= 42;
      if (wz < playerZ - 21) wz += 42;
      if (wz > playerZ + 21) wz -= 42;

      const gx = Math.floor(wx);
      const gz = Math.floor(wz);
      const gy = Math.floor(wy);
      if (
        wy < playerY - 8 ||
        (gy >= 0 && gy < WORLD_HEIGHT && isSolidBlock(getBlock(gx, gy, gz)))
      ) {
        wx = playerX + (Math.random() - 0.5) * 42;
        wz = playerZ + (Math.random() - 0.5) * 42;
        wy = playerY + 12 + Math.random() * 14;
      }

      this.weatherPositions[idx] = wx;
      this.weatherPositions[idx + 1] = wy;
      this.weatherPositions[idx + 2] = wz;
    }
    this.weatherGeom.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.weatherGeom.dispose();
    this.weatherMat.dispose();
  }
}
