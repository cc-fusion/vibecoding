import * as THREE from 'three';
import { getBlock } from './blocks.js';

const BLOCK_COLORS = {
  grass: '#6f994c', dirt: '#765037', stone: '#858989', sand: '#d9c17e', oak_log: '#795236', pine_log: '#66503b',
  oak_leaves: '#477a41', pine_leaves: '#315e4c', jungle_leaves: '#3d7e45', coal_ore: '#3c4244', iron_ore: '#b58a71',
  crystal_ore: '#64ded6', snow: '#ecf3ef', cactus: '#4c8c47', sandstone: '#cdb274', glowstone: '#f3c75e',
  planks: '#aa7948', glass: '#b9dedd', obsidian: '#342946', crystal_block: '#5dd4cf', berry_bush: '#a84652', pumpkin: '#ce7a31',
};

export class ParticleSystem {
  constructor(scene, capacity = 700) {
    this.capacity = capacity;
    this.count = 0;
    this.particles = Array.from({ length: capacity }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), color: new THREE.Color(), life: 0, maxLife: 1, gravity: 10,
    }));
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  burst(position, color = '#ffffff', count = 10, options = {}) {
    for (let i = 0; i < count && this.count < this.capacity; i++) {
      const particle = this.particles[this.count++];
      particle.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));
      const speed = options.speed ?? 2.4;
      particle.velocity.set((Math.random() - 0.5) * speed, Math.random() * speed + 0.4, (Math.random() - 0.5) * speed);
      particle.color.set(color).multiplyScalar(0.75 + Math.random() * 0.35);
      particle.life = particle.maxLife = (options.life ?? 0.65) * (0.7 + Math.random() * 0.6);
      particle.gravity = options.gravity ?? 9;
    }
  }

  block(position, blockId, count = 15) {
    const def = getBlock(blockId);
    this.burst(new THREE.Vector3(position.x + 0.5, position.y + 0.5, position.z + 0.5), BLOCK_COLORS[def.key] || '#8b8175', count, { speed: 3, life: 0.75 });
  }

  update(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.count--;
        const last = this.particles[this.count];
        this.particles[this.count] = particle;
        this.particles[i] = last;
        continue;
      }
      particle.velocity.y -= particle.gravity * dt;
      particle.position.addScaledVector(particle.velocity, dt);
    }
    for (let i = 0; i < this.count; i++) {
      const particle = this.particles[i];
      const fade = Math.min(1, particle.life / (particle.maxLife * 0.3));
      this.positions[i * 3] = particle.position.x;
      this.positions[i * 3 + 1] = particle.position.y;
      this.positions[i * 3 + 2] = particle.position.z;
      this.colors[i * 3] = particle.color.r * fade;
      this.colors[i * 3 + 1] = particle.color.g * fade;
      this.colors[i * 3 + 2] = particle.color.b * fade;
    }
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
