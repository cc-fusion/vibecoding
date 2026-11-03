import * as THREE from 'three';
import { REGISTRY } from './constants.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
  }

  spawnBlockBreak(x, y, z, blockId, count = 22) {
    const def = REGISTRY[blockId];
    const baseHex = def?.particleColor ?? 0x888888;
    const baseColor = new THREE.Color(baseHex);

    for (let i = 0; i < count; i++) {
      const shade = 0.8 + Math.random() * 0.4;
      const col = baseColor.clone().multiplyScalar(shade);
      const size = 0.09 + Math.random() * 0.09;
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(this.unitBox, mat);
      mesh.scale.set(size, size, size);

      const ox = (Math.random() - 0.5) * 0.7;
      const oy = (Math.random() - 0.5) * 0.7;
      const oz = (Math.random() - 0.5) * 0.7;
      mesh.position.set(x + 0.5 + ox, y + 0.5 + oy, z + 0.5 + oz);

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vx: ox * 4.5 + (Math.random() - 0.5) * 1.5,
        vy: 1.8 + Math.random() * 2.8,
        vz: oz * 4.5 + (Math.random() - 0.5) * 1.5,
        gravity: 13.5,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }
  }

  spawnMiningChip(x, y, z, nx, ny, nz, blockId) {
    const def = REGISTRY[blockId];
    const baseHex = def?.particleColor ?? 0x999999;
    const mat = new THREE.MeshBasicMaterial({ color: baseHex });
    const mesh = new THREE.Mesh(this.unitBox, mat);
    const size = 0.07;
    mesh.scale.set(size, size, size);
    mesh.position.set(
      x + 0.5 + nx * 0.52 + (Math.random() - 0.5) * 0.35,
      y + 0.5 + ny * 0.52 + (Math.random() - 0.5) * 0.35,
      z + 0.5 + nz * 0.52 + (Math.random() - 0.5) * 0.35
    );
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      mat,
      vx: nx * 1.6 + (Math.random() - 0.5) * 1.5,
      vy: 1.0 + Math.random() * 1.5,
      vz: nz * 1.6 + (Math.random() - 0.5) * 1.5,
      gravity: 12.0,
      life: 0.25 + Math.random() * 0.15,
      maxLife: 0.4,
    });
  }

  spawnTorchFlame(wx, wy, wz) {
    const colors = [0xffea79, 0xff9d24, 0xff5a1f];
    const col = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const mesh = new THREE.Mesh(this.unitBox, mat);
    const size = 0.065;
    mesh.scale.set(size, size, size);
    mesh.position.set(
      wx + (Math.random() - 0.5) * 0.12,
      wy + (Math.random() - 0.5) * 0.08,
      wz + (Math.random() - 0.5) * 0.12
    );
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      mat,
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.65 + Math.random() * 0.5,
      vz: (Math.random() - 0.5) * 0.25,
      gravity: -0.4,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.55,
    });
  }

  spawnExplosion(cx, cy, cz) {
    const palette = [0xffdd55, 0xff7722, 0xd93829, 0x444444, 0xdddddd];
    for (let i = 0; i < 50; i++) {
      const col = palette[i % palette.length];
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(this.unitBox, mat);
      const size = 0.14 + Math.random() * 0.18;
      mesh.scale.set(size, size, size);
      mesh.position.set(cx, cy, cz);
      this.scene.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3 + Math.random() * 7;
      this.particles.push({
        mesh,
        mat,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.abs(Math.cos(phi)) * speed + 2,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        gravity: 9.5,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.2,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.y += dt * 5;
      const scaleRatio = Math.max(0.02, p.life / p.maxLife);
      p.mesh.scale.multiplyScalar(0.985 + scaleRatio * 0.015);
    }
  }
}
