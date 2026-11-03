import * as THREE from 'three';
import { BLOCK } from './blocks.js';

const BLOCK_PARTICLE_COLORS = {
  [BLOCK.GRASS]: [0x58a846, 0x845c3c],
  [BLOCK.DIRT]: [0x845c3c, 0x6e4b30],
  [BLOCK.STONE]: [0x82848a, 0x6c6e74],
  [BLOCK.COBBLESTONE]: [0x76787e, 0x5c5e64],
  [BLOCK.SAND]: [0xe0ce96, 0xcab67e],
  [BLOCK.SANDSTONE]: [0xd6be84, 0xbfa66c],
  [BLOCK.GRAVEL]: [0x888280, 0x6e6866],
  [BLOCK.SNOW_GRASS]: [0xf2f7fc, 0x845c3c],
  [BLOCK.SNOW]: [0xf2f7fc, 0xdce6f2],
  [BLOCK.ICE]: [0x96ccf8, 0xc8e6ff],
  [BLOCK.CLAY]: [0x9ca4b4, 0x828a9a],
  [BLOCK.COAL_ORE]: [0x2a2a30, 0x7e8086],
  [BLOCK.IRON_ORE]: [0xd8af8e, 0x7e8086],
  [BLOCK.GOLD_ORE]: [0xfad63a, 0x7e8086],
  [BLOCK.DIAMOND_ORE]: [0x4af2ee, 0x7e8086],
  [BLOCK.CRYSTAL_ORE]: [0xd676ff, 0xf2b0ff],
  [BLOCK.OAK_LOG]: [0x6c5230, 0xa88450],
  [BLOCK.OAK_LEAVES]: [0x469838, 0x387e2c],
  [BLOCK.SPRUCE_LOG]: [0x463220, 0x7e5c38],
  [BLOCK.SPRUCE_LEAVES]: [0x2e6840, 0x245232],
  [BLOCK.BIRCH_LOG]: [0xe2ded6, 0xc4b486],
  [BLOCK.BIRCH_LEAVES]: [0x6ca83e, 0x588e32],
  [BLOCK.CACTUS]: [0x489232, 0x387826],
  [BLOCK.OAK_PLANKS]: [0xb69058, 0x987644],
  [BLOCK.SPRUCE_PLANKS]: [0x7e5c38, 0x64482a],
  [BLOCK.BIRCH_PLANKS]: [0xd6c692, 0xb8a876],
  [BLOCK.CRAFTING_TABLE]: [0xa67644, 0x6c4828],
  [BLOCK.FURNACE]: [0x76767c, 0xf88e1c],
  [BLOCK.TORCH]: [0xffcc44, 0x9a7240],
  [BLOCK.LANTERN]: [0xffdc78, 0x484c56],
  [BLOCK.GLASS]: [0xd4f2fc, 0xffffff],
  [BLOCK.BRICKS]: [0xb24c3e, 0xcec6bc],
  [BLOCK.STONE_BRICKS]: [0x888a90, 0x686a70],
  [BLOCK.BED]: [0xc62e34, 0xf2f0ea],
  [BLOCK.WOOL_BLOCK]: [0xf2eee6, 0xdcd6cc],
};

export class ParticleSystem {
  constructor(scene, maxParticles = 260) {
    this.max = maxParticles;
    this.particles = [];
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rot: 0, vRot: 0,
        scale: 0.1,
        life: 0,
        maxLife: 1,
        gravity: 16,
        color: new THREE.Color(),
      });
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.dummy = new THREE.Object3D();
    const zeroColor = new THREE.Color(1, 1, 1);
    for (let i = 0; i < maxParticles; i++) {
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, zeroColor);
    }
    this.scene = scene;
    this.scene.add(this.mesh);
    this.cursor = 0;
  }

  spawnOne(opts) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;

    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.z = opts.z;
    p.vx = opts.vx;
    p.vy = opts.vy;
    p.vz = opts.vz;
    p.scale = opts.scale ?? 0.12;
    p.life = 0;
    p.maxLife = opts.maxLife ?? 0.55;
    p.gravity = opts.gravity ?? 18.0;
    p.rot = Math.random() * Math.PI;
    p.vRot = (Math.random() - 0.5) * 8;
    p.color.setHex(opts.hex ?? 0xffffff);
  }

  emitBlockBreak(bx, by, bz, blockId, count = 18) {
    const palette = BLOCK_PARTICLE_COLORS[blockId] || [0x999999, 0x777777];
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 0.7;
      const oy = (Math.random() - 0.5) * 0.7;
      const oz = (Math.random() - 0.5) * 0.7;
      this.spawnOne({
        x: bx + 0.5 + ox,
        y: by + 0.5 + oy,
        z: bz + 0.5 + oz,
        vx: ox * 4.5 + (Math.random() - 0.5) * 1.6,
        vy: 1.8 + Math.random() * 3.2,
        vz: oz * 4.5 + (Math.random() - 0.5) * 1.6,
        scale: 0.09 + Math.random() * 0.08,
        maxLife: 0.45 + Math.random() * 0.35,
        hex: palette[i % palette.length],
      });
    }
  }

  emitMiningChip(bx, by, bz, nx, ny, nz, blockId) {
    const palette = BLOCK_PARTICLE_COLORS[blockId] || [0x999999];
    for (let i = 0; i < 3; i++) {
      this.spawnOne({
        x: bx + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.4,
        y: by + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.4,
        z: bz + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.4,
        vx: nx * 2.2 + (Math.random() - 0.5) * 1.8,
        vy: ny * 2.0 + 1.4 + Math.random() * 1.5,
        vz: nz * 2.2 + (Math.random() - 0.5) * 1.8,
        scale: 0.07 + Math.random() * 0.05,
        maxLife: 0.28 + Math.random() * 0.2,
        hex: palette[i % palette.length],
      });
    }
  }

  emitSplash(x, y, z, intensity = 1.0) {
    const count = Math.round(12 * intensity);
    for (let i = 0; i < count; i++) {
      this.spawnOne({
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + 0.2,
        z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 3.4,
        vy: 2.2 + Math.random() * 3.2 * intensity,
        vz: (Math.random() - 0.5) * 3.4,
        scale: 0.08 + Math.random() * 0.05,
        maxLife: 0.45 + Math.random() * 0.25,
        hex: i % 2 === 0 ? 0x5cc4ff : 0xdff6ff,
      });
    }
  }

  emitHitSpark(x, y, z) {
    for (let i = 0; i < 10; i++) {
      this.spawnOne({
        x, y, z,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 1.5 + Math.random() * 3.0,
        vz: (Math.random() - 0.5) * 4.5,
        scale: 0.09,
        maxLife: 0.35 + Math.random() * 0.2,
        hex: i % 2 === 0 ? 0xff5252 : 0xffe0b2,
      });
    }
  }

  update(dt, world) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
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

      if (world && world.getBlock(nx, ny, nz) !== BLOCK.AIR && p.vy < 0) {
        p.vy = 0;
        p.vx *= 0.7;
        p.vz *= 0.7;
      } else {
        p.x = nx;
        p.y = ny;
        p.z = nz;
      }

      p.rot += p.vRot * dt;
      const fade = 1.0 - (p.life / p.maxLife) * 0.55;
      const s = p.scale * fade;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
