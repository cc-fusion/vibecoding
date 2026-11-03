import * as THREE from 'three';
import { B, isSolid } from './blocks.js';

export class Player {
  constructor(world, position) {
    this.world = world; this.position = position.clone(); this.velocity = new THREE.Vector3();
    this.yaw = -0.28; this.pitch = -0.13; this.grounded = false; this.inWater = false; this.submerged = false;
    this.radius = 0.29; this.height = 1.77; this.eyeHeight = 1.61; this.stamina = 100;
    this.health = 10; this.bob = 0; this.stepDistance = 0; this.sprint = false; this.flying = false;
    this.onLand = () => {}; this.onStep = () => {};
  }
  look(dx, dy, sensitivity) {
    this.yaw -= dx * 0.0022 * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022 * sensitivity, -1.53, 1.53);
  }
  intersectsBlock(x, y, z) {
    const p = this.position, r = this.radius;
    return p.x + r > x && p.x - r < x + 1 && p.y + this.height > y && p.y < y + 1 && p.z + r > z && p.z - r < z + 1;
  }
  collides(position = this.position) {
    const r = this.radius;
    for (let y = Math.floor(position.y + 0.001); y <= Math.floor(position.y + this.height - 0.001); y++)
      for (let z = Math.floor(position.z - r + 0.001); z <= Math.floor(position.z + r - 0.001); z++)
        for (let x = Math.floor(position.x - r + 0.001); x <= Math.floor(position.x + r - 0.001); x++)
          if (isSolid(this.world.getBlock(x, y, z))) return true;
    return false;
  }
  moveAxis(axis, amount) {
    if (!amount) return;
    this.position[axis] += amount;
    const p = this.position, r = this.radius;
    const min = { x: Math.floor(p.x - r + 0.0001), y: Math.floor(p.y + 0.0001), z: Math.floor(p.z - r + 0.0001) };
    const max = { x: Math.floor(p.x + r - 0.0001), y: Math.floor(p.y + this.height - 0.0001), z: Math.floor(p.z + r - 0.0001) };
    for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) for (let x = min.x; x <= max.x; x++) {
      if (!isSolid(this.world.getBlock(x, y, z))) continue;
      const block = { x, y, z };
      if (axis === 'y') {
        if (amount < 0) {
          p.y = Math.max(p.y, y + 1); this.grounded = true;
          if (this.velocity.y < -11 && !this.inWater && !this.flying) this.onLand(Math.floor((-this.velocity.y - 10) * 0.55));
        } else p.y = Math.min(p.y, y - this.height);
      } else if (amount > 0) p[axis] = Math.min(p[axis], block[axis] - r);
      else p[axis] = Math.max(p[axis], block[axis] + 1 + r);
      this.velocity[axis] = 0;
    }
  }
  update(dt, keys, creative = false) {
    const p = this.position;
    this.inWater = this.world.getBlock(p.x, p.y + 0.6, p.z) === B.WATER;
    this.submerged = this.world.getBlock(p.x, p.y + this.eyeHeight, p.z) === B.WATER;
    this.sprint = !!(keys.ShiftLeft || keys.ShiftRight) && this.stamina > 1 && !this.inWater;
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const length = Math.hypot(f, s); if (length) { f /= Math.max(1, length); s /= Math.max(1, length); }
    const speed = this.flying ? (this.sprint ? 14 : 8) : this.inWater ? 2.8 : this.sprint ? 6.5 : 4.3;
    const targetX = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed;
    const targetZ = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed;
    const smoothing = 1 - Math.exp(-(this.grounded || this.inWater || this.flying ? 16 : 6) * dt);
    this.velocity.x += (targetX - this.velocity.x) * smoothing;
    this.velocity.z += (targetZ - this.velocity.z) * smoothing;
    if (this.sprint && length && !creative) this.stamina = Math.max(0, this.stamina - dt * 12);
    else this.stamina = Math.min(100, this.stamina + dt * 9);
    if (this.flying) this.velocity.y = (keys.Space ? 7 : 0) - (keys.ControlLeft || keys.KeyC ? 7 : 0);
    else if (this.inWater) { this.velocity.y = Math.max(-3.5, this.velocity.y - 6 * dt); if (keys.Space) this.velocity.y = 3.8; }
    else {
      if (keys.Space && this.grounded) { this.velocity.y = 7.6; this.grounded = false; }
      this.velocity.y = Math.max(-30, this.velocity.y - 23 * dt);
    }
    const oldX = p.x, oldZ = p.z;
    this.grounded = false;
    this.moveAxis('x', this.velocity.x * dt); this.moveAxis('z', this.velocity.z * dt); this.moveAxis('y', this.velocity.y * dt);
    const distance = Math.hypot(p.x - oldX, p.z - oldZ);
    if (this.grounded || this.inWater) { this.bob += distance * 2.4; this.stepDistance += distance; }
    if (this.stepDistance > (this.inWater ? 2.1 : 1.75)) { this.stepDistance = 0; this.onStep(this.inWater); }
    if (p.y < -15) { this.position.copy(this.world.findSpawn()); this.velocity.set(0, 0, 0); this.onLand(2); }
    return distance;
  }
  setCamera(camera, moving = true) {
    const amount = moving && this.grounded ? Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 4) : 0;
    camera.position.set(this.position.x, this.position.y + this.eyeHeight + Math.sin(this.bob * 2) * 0.035 * amount, this.position.z);
    camera.rotation.set(this.pitch, this.yaw, Math.cos(this.bob) * 0.003 * amount, 'YXZ');
  }
}