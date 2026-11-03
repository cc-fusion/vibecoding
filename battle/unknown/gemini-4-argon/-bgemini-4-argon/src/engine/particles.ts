import * as THREE from 'three';
import { GRAVITY } from './constants';
import { VoxelWorld } from './world';
import { ITEMS } from './blocks';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  gravityScale: number;
  color: THREE.Color;
}

const MAX_PARTICLES = 360;

export class ParticleSystem {
  readonly mesh: THREE.InstancedMesh;
  private pool: Particle[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();

  constructor() {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.1,
        life: 0,
        maxLife: 1,
        gravityScale: 1,
        color: new THREE.Color(1, 1, 1),
      });
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.pool[i].color);
    }
  }

  emitBlockBreak(bx: number, by: number, bz: number, blockId: number, count = 20): void {
    const baseHex = ITEMS[blockId]?.colorHex ?? '#94a3b8';
    const baseColor = new THREE.Color(baseHex);

    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = bx + 0.15 + Math.random() * 0.7;
      p.y = by + 0.15 + Math.random() * 0.7;
      p.z = bz + 0.15 + Math.random() * 0.7;
      p.vx = (Math.random() - 0.5) * 4.6;
      p.vy = 1.2 + Math.random() * 3.8;
      p.vz = (Math.random() - 0.5) * 4.6;
      p.size = 0.09 + Math.random() * 0.09;
      p.maxLife = 0.48 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.gravityScale = 0.75;
      const shade = 0.75 + Math.random() * 0.45;
      p.color.setRGB(baseColor.r * shade, baseColor.g * shade, baseColor.b * shade);
      this.mesh.setColorAt((this.cursor - 1 + MAX_PARTICLES) % MAX_PARTICLES, p.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  emitBurst(
    x: number,
    y: number,
    z: number,
    hexColors: string[],
    count: number,
    speed: number,
    gravityScale = 0.5,
    size = 0.14
  ): void {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const p = this.pool[idx];
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + (Math.random() - 0.5) * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = (Math.random() - 0.5) * speed * 2;
      p.vy = (Math.random() - 0.25) * speed * 1.8;
      p.vz = (Math.random() - 0.5) * speed * 2;
      p.size = size * (0.7 + Math.random() * 0.7);
      p.maxLife = 0.4 + Math.random() * 0.55;
      p.life = p.maxLife;
      p.gravityScale = gravityScale;
      p.color.set(hexColors[i % hexColors.length]);
      this.mesh.setColorAt(idx, p.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, world: VoxelWorld): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy -= GRAVITY * p.gravityScale * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;

      if (ITEMS[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]?.solid) {
        p.vy = -p.vy * 0.25;
        p.vx *= 0.65;
        p.vz *= 0.65;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      const scale = p.size * Math.min(1, p.life / (p.maxLife * 0.35));
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.rotation.set(p.life * 3, p.life * 2, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
