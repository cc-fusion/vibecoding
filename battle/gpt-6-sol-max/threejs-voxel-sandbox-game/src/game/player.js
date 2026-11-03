import * as THREE from "three";
import { B, BLOCKS } from "./blocks.js";

const RADIUS = 0.31;
const HEIGHT = 1.76;
const EYE_HEIGHT = 1.57;

export class Player {
  constructor(world, camera, state = {}, callbacks = {}) {
    this.world = world;
    this.camera = camera;
    this.spawn = world.spawn;
    this.position = new THREE.Vector3(
      Number.isFinite(state.x) ? state.x : this.spawn.x + 0.5,
      Number.isFinite(state.y) ? state.y : this.spawn.y + 0.05,
      Number.isFinite(state.z) ? state.z : this.spawn.z + 0.5,
    );
    this.velocity = new THREE.Vector3();
    this.yaw = Number.isFinite(state.yaw) ? state.yaw : -0.55;
    this.pitch = Number.isFinite(state.pitch) ? state.pitch : -0.08;
    this.health = Number.isFinite(state.health) ? state.health : 10;
    this.grounded = false;
    this.inWater = false;
    this.stepDistance = 0;
    this.bob = 0;
    this.callbacks = callbacks;
    this.updateCamera(0, false);
  }

  look(dx, dy, sensitivity = 0.00215) {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(-1.52, Math.min(1.52, this.pitch - dy * sensitivity));
    this.updateCamera(0, false);
  }

  collides(x, y, z) {
    const minX = Math.floor(x - RADIUS + 0.0001), maxX = Math.floor(x + RADIUS - 0.0001);
    const minY = Math.floor(y + 0.001), maxY = Math.floor(y + HEIGHT - 0.001);
    const minZ = Math.floor(z - RADIUS + 0.0001), maxZ = Math.floor(z + RADIUS - 0.0001);
    for (let by = minY; by <= maxY; by++) for (let bz = minZ; bz <= maxZ; bz++) for (let bx = minX; bx <= maxX; bx++) {
      if (BLOCKS[this.world.getBlock(bx, by, bz)]?.solid) return true;
    }
    return false;
  }

  moveAxis(axis, distance, canStep = false) {
    if (Math.abs(distance) < 0.00001) return false;
    const start = this.position[axis];
    this.position[axis] = start + distance;
    if (!this.collides(this.position.x, this.position.y, this.position.z)) return false;
    if (canStep && this.grounded && !this.inWater) {
      this.position.y += 0.57;
      if (!this.collides(this.position.x, this.position.y, this.position.z)) {
        this.velocity.y = Math.max(this.velocity.y, 0);
        return false;
      }
      this.position.y -= 0.57;
    }

    let safe = 0, blocked = 1;
    for (let i = 0; i < 9; i++) {
      const middle = (safe + blocked) / 2;
      this.position[axis] = start + distance * middle;
      if (this.collides(this.position.x, this.position.y, this.position.z)) blocked = middle;
      else safe = middle;
    }
    this.position[axis] = start + distance * safe;
    return true;
  }

  update(dt, keys, options = {}) {
    const beforeX = this.position.x, beforeZ = this.position.z;
    this.inWater = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.6), Math.floor(this.position.z)) === B.WATER;
    const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const strafe = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const length = Math.hypot(forward, strafe) || 1;
    const moving = forward !== 0 || strafe !== 0;
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = this.inWater ? 3.1 : sprinting ? 7.3 : 5.0;
    const targetX = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / length * speed;
    const targetZ = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / length * speed;
    const response = Math.min(1, dt * (this.grounded ? 12 : this.inWater ? 8 : 4.5));
    this.velocity.x += (targetX - this.velocity.x) * response;
    this.velocity.z += (targetZ - this.velocity.z) * response;

    if (this.inWater) {
      this.velocity.y = Math.max(-4, this.velocity.y - 8 * dt);
      if (keys.has("Space")) this.velocity.y = Math.min(4.7, this.velocity.y + 21 * dt);
    } else {
      if (keys.has("Space") && this.grounded) {
        this.velocity.y = 8.5;
        this.grounded = false;
        this.callbacks.onJump?.();
      }
      this.velocity.y = Math.max(-32, this.velocity.y - 25 * dt);
    }

    if (this.moveAxis("x", this.velocity.x * dt, true)) this.velocity.x = 0;
    if (this.moveAxis("z", this.velocity.z * dt, true)) this.velocity.z = 0;
    const fallingSpeed = this.velocity.y;
    const verticalCollision = this.moveAxis("y", this.velocity.y * dt);
    if (verticalCollision) {
      this.grounded = fallingSpeed < 0;
      if (fallingSpeed < -13) this.damage(Math.min(5, Math.floor((-fallingSpeed - 10) / 3)));
      this.velocity.y = 0;
    } else {
      this.grounded = this.collides(this.position.x, this.position.y - 0.055, this.position.z);
      if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
    }

    if (this.position.y < -10) this.respawn();
    const moved = Math.hypot(this.position.x - beforeX, this.position.z - beforeZ);
    if (moving && this.grounded && moved > 0.001) {
      this.stepDistance += moved;
      this.bob += moved * (sprinting ? 11 : 9);
      if (this.stepDistance > (sprinting ? 1.8 : 2.35)) {
        this.stepDistance = 0;
        const ground = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.12), Math.floor(this.position.z));
        this.callbacks.onStep?.(ground);
      }
    } else this.bob *= Math.max(0, 1 - dt * 6);
    this.updateCamera(dt, moving && this.grounded && !options.reducedMotion);
    return moved;
  }

  updateCamera(_dt, moving) {
    const bob = moving ? Math.sin(this.bob) * 0.035 : 0;
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  damage(amount) {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.callbacks.onDamage?.(amount);
    if (this.health <= 0) this.respawn();
  }

  heal(amount) {
    const old = this.health;
    this.health = Math.min(10, this.health + amount);
    if (this.health > old) this.callbacks.onHeal?.(this.health - old);
    return this.health > old;
  }

  respawn() {
    this.position.set(this.spawn.x + 0.5, this.spawn.y + 0.1, this.spawn.z + 0.5);
    this.velocity.set(0, 0, 0);
    this.health = 10;
    this.callbacks.onRespawn?.();
    this.updateCamera(0, false);
  }

  serialize() {
    return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, pitch: this.pitch, health: this.health };
  }
}

export function raycastBlocks(world, origin, direction, reach = 6.5) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const sx = Math.sign(direction.x), sy = Math.sign(direction.y), sz = Math.sign(direction.z);
  const dx = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
  const dy = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
  const dz = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);
  let tx = sx === 0 ? Infinity : sx > 0 ? (x + 1 - origin.x) * dx : (origin.x - x) * dx;
  let ty = sy === 0 ? Infinity : sy > 0 ? (y + 1 - origin.y) * dy : (origin.y - y) * dy;
  let tz = sz === 0 ? Infinity : sz > 0 ? (z + 1 - origin.z) * dz : (origin.z - z) * dz;
  let distance = 0;
  let normal = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < 100 && distance <= reach; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, normal, distance };
    if (tx < ty && tx < tz) {
      x += sx; distance = tx; tx += dx; normal = { x: -sx, y: 0, z: 0 };
    } else if (ty < tz) {
      y += sy; distance = ty; ty += dy; normal = { x: 0, y: -sy, z: 0 };
    } else {
      z += sz; distance = tz; tz += dz; normal = { x: 0, y: 0, z: -sz };
    }
  }
  return null;
}