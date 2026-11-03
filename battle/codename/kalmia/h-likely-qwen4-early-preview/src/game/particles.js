// Instanced particle pool: block debris, hits, flames, splash.
import * as THREE from 'three';
import { BLOCKS } from './blocks.js';

const MAX = 400;
const TINT_COLORS = { grass: 0x79b64a, leaves: 0x5ea83e };

// average colors for block particles (sampled approximation of the atlas)
const BLOCK_COLORS = {
  1: 0x79b64a, 2: 0x79553a, 3: 0x7f7f7f, 4: 0x787878, 5: 0xdbd08f,
  7: 0x6b4f2e, 8: 0x5ea83e, 9: 0xa3824c, 10: 0x4a4a4a, 11: 0xb08a6e,
  12: 0xc9b054, 13: 0x6fd8cf, 14: 0x3d3d3d, 15: 0xeef3f6, 16: 0x5f8f3a,
  17: 0xc8e1f0, 18: 0xa3824c, 19: 0x787878, 20: 0xffb52f, 21: 0xe8e8e8,
  22: 0x847e7a, 23: 0xf2f6f8,
};

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  spawn(x, y, z, color, count, { speed = 3, up = 3, life = 0.7, size = 1, gravity = 18 } = {}) {
    this._c.set(color);
    for (let i = 0; i < count; i++) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push({
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + (Math.random() - 0.5) * 0.6,
        z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * up,
        vz: (Math.random() - 0.5) * speed,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.6),
        r: this._c.r * (0.8 + Math.random() * 0.3),
        g: this._c.g * (0.8 + Math.random() * 0.3),
        b: this._c.b * (0.8 + Math.random() * 0.3),
        gravity,
      });
    }
  }

  blockBreak(bx, by, bz, blockId) {
    const def = BLOCKS[blockId];
    let color = BLOCK_COLORS[blockId] || 0x888888;
    if (def?.tint) color = TINT_COLORS[def.tint];
    this.spawn(bx + 0.5, by + 0.5, bz + 0.5, color, 22, { speed: 4, up: 4 });
  }

  blockHit(bx, by, bz, blockId, face) {
    const color = BLOCK_COLORS[blockId] || 0x888888;
    this.spawn(
      bx + 0.5 + face[0] * 0.5, by + 0.5 + face[1] * 0.5, bz + 0.5 + face[2] * 0.5,
      color, 3, { speed: 2, up: 2, life: 0.4, size: 0.7 }
    );
  }

  entityHit(x, y, z, color = 0xcc3333) {
    this.spawn(x, y, z, color, 8, { speed: 3, up: 3, life: 0.5 });
  }

  flame(x, y, z) {
    this.spawn(x, y, z, 0xff9b2f, 1, { speed: 0.4, up: 1.2, life: 0.5, size: 0.6, gravity: -2 });
  }

  splashAt(x, y, z) {
    this.spawn(x, y, z, 0x5a8ff0, 16, { speed: 3, up: 5, life: 0.6 });
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.mesh.count = list.length;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const s = p.size * Math.min(1, p.life / (p.maxLife * 0.4));
      this._p.set(p.x, p.y, p.z);
      this._s.set(s, s, s);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.instanceColor.setXYZ(i, p.r, p.g, p.b);
    }
    if (list.length) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}