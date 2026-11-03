import * as THREE from 'three';
import { getBlock } from './blocks.js';

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const EPS = 0.001;

export class Player {
  constructor(camera, world, saved = null, hooks = {}) {
    this.camera = camera;
    this.world = world;
    this.hooks = hooks;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
    this.onGround = false;
    this.inWater = false;
    this.underwater = false;
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.damageCooldown = 0;
    this.attackCooldown = 0;
    this.dead = false;
    this.bobTime = 0;
    this.stepTimer = 0;
    this.baseFov = 75;
    this.sprinting = false;
    this.distanceWalked = 0;
    if (saved) this.restore(saved);
    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
  }

  restore(saved) {
    if (Array.isArray(saved.position) && saved.position.length === 3) this.position.fromArray(saved.position);
    this.yaw = Number(saved.yaw) || 0;
    this.pitch = Number(saved.pitch) || 0;
    const savedHealth = Number(saved.health);
    const savedHunger = Number(saved.hunger);
    this.health = Number.isFinite(savedHealth) ? Math.max(0, Math.min(this.maxHealth, savedHealth || 20)) : 20;
    this.hunger = Number.isFinite(savedHunger) ? Math.max(0, Math.min(20, savedHunger)) : 20;
    this.distanceWalked = Number(saved.distanceWalked) || 0;
  }

  setSpawn(spawn) {
    this.spawn = spawn.clone();
  }

  setKey(code, pressed) {
    this.keys[code] = pressed;
  }

  clearKeys() {
    this.keys = {};
  }

  mouseMove(dx, dy, sensitivity = 1) {
    this.yaw -= dx * sensitivity * 0.0021;
    this.pitch -= dy * sensitivity * 0.0021;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  eyePosition(target = new THREE.Vector3()) {
    return target.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
  }

  lookDirection(target = new THREE.Vector3()) {
    return this.camera.getWorldDirection(target);
  }

  getAABB(position = this.position) {
    return {
      minX: position.x - WIDTH / 2, maxX: position.x + WIDTH / 2,
      minY: position.y, maxY: position.y + HEIGHT,
      minZ: position.z - WIDTH / 2, maxZ: position.z + WIDTH / 2,
    };
  }

  collisionsAt(position = this.position) {
    const box = this.getAABB(position);
    const collisions = [];
    for (let y = Math.floor(box.minY + EPS); y <= Math.floor(box.maxY - EPS); y++) {
      for (let z = Math.floor(box.minZ + EPS); z <= Math.floor(box.maxZ - EPS); z++) {
        for (let x = Math.floor(box.minX + EPS); x <= Math.floor(box.maxX - EPS); x++) {
          if (getBlock(this.world.getBlock(x, y, z)).solid) collisions.push({ x, y, z });
        }
      }
    }
    return collisions;
  }

  moveAxis(axis, amount) {
    if (!amount) return false;
    this.position[axis] += amount;
    const collisions = this.collisionsAt();
    if (!collisions.length) return false;
    if (axis === 'x') {
      for (const block of collisions) {
        if (amount > 0) this.position.x = Math.min(this.position.x, block.x - WIDTH / 2 - EPS);
        else this.position.x = Math.max(this.position.x, block.x + 1 + WIDTH / 2 + EPS);
      }
      this.velocity.x = 0;
    } else if (axis === 'z') {
      for (const block of collisions) {
        if (amount > 0) this.position.z = Math.min(this.position.z, block.z - WIDTH / 2 - EPS);
        else this.position.z = Math.max(this.position.z, block.z + 1 + WIDTH / 2 + EPS);
      }
      this.velocity.z = 0;
    } else {
      for (const block of collisions) {
        if (amount > 0) this.position.y = Math.min(this.position.y, block.y - HEIGHT - EPS);
        else this.position.y = Math.max(this.position.y, block.y + 1 + EPS);
      }
      this.velocity.y = 0;
    }
    return true;
  }

  update(dt) {
    if (this.dead) {
      this.syncCamera(dt);
      return;
    }
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.inWater = getBlock(this.world.getBlock(this.position.x, this.position.y + 0.5, this.position.z)).key === 'water';
    this.underwater = getBlock(this.world.getBlock(this.position.x, this.position.y + EYE_HEIGHT, this.position.z)).key === 'water';

    const forwardAmount = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const rightAmount = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const length = Math.hypot(forwardAmount, rightAmount) || 1;
    const forward = forwardAmount / length;
    const right = rightAmount / length;
    this.sprinting = !!this.keys.ShiftLeft && forwardAmount > 0 && this.hunger > 1 && !this.inWater;
    const speed = this.inWater ? 3 : this.sprinting ? 6.8 : 4.5;
    const sin = Math.sin(this.yaw); const cos = Math.cos(this.yaw);
    const targetX = (-sin * forward + cos * right) * speed;
    const targetZ = (-cos * forward - sin * right) * speed;
    const acceleration = this.onGround ? 16 : this.inWater ? 8 : 4;
    const blend = 1 - Math.exp(-acceleration * dt);
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;

    if (this.inWater) {
      this.velocity.y += -4.5 * dt;
      this.velocity.y *= Math.exp(-2.4 * dt);
      if (this.keys.Space) this.velocity.y = Math.min(4.2, this.velocity.y + 14 * dt);
    } else {
      if (this.keys.Space && this.onGround) {
        this.velocity.y = 8.2;
        this.onGround = false;
        this.exhaustion += this.sprinting ? 0.14 : 0.07;
      }
      this.velocity.y = Math.max(-38, this.velocity.y - 24 * dt);
    }

    const wasGrounded = this.onGround;
    const impactVelocity = this.velocity.y;
    const oldX = this.position.x; const oldZ = this.position.z;
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.onGround = false;
    const hitVertical = this.moveAxis('y', this.velocity.y * dt);
    if (hitVertical && impactVelocity <= 0) {
      this.onGround = true;
      if (!wasGrounded && impactVelocity < -11 && !this.inWater) {
        this.damage(Math.max(1, Math.floor((-impactVelocity - 9) * 0.8)), 'fall');
      }
    }
    if (this.position.y < -8) this.damage(100, 'void');

    const horizontalDistance = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
    this.distanceWalked += horizontalDistance;
    if (horizontalDistance > 0.0001 && (this.onGround || this.inWater)) {
      this.bobTime += horizontalDistance * (this.sprinting ? 2.2 : 1.8);
      this.exhaustion += horizontalDistance * (this.sprinting ? 0.014 : 0.004);
      this.stepTimer -= horizontalDistance;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 2.1 : 2.6;
        this.hooks.onStep?.(this.inWater ? 'splash' : 'step', this.world.getBlock(this.position.x, this.position.y - 0.1, this.position.z));
      }
    }
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      this.hunger = Math.max(0, this.hunger - 1);
    }
    if (this.hunger >= 17 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.exhaustion += 0.5;
      }
    } else this.regenTimer = 0;
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        this.damage(1, 'starvation');
      }
    } else this.starveTimer = 0;
    this.syncCamera(dt);
  }

  syncCamera(dt) {
    const moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.3 && this.onGround;
    const bob = moving ? Math.sin(this.bobTime * 3.1) * 0.035 : 0;
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, moving ? Math.sin(this.bobTime * 1.55) * 0.004 : 0);
    const targetFov = this.baseFov + (this.sprinting ? 6 : 0);
    const nextFov = dt ? this.camera.fov + (targetFov - this.camera.fov) * Math.min(1, dt * 8) : targetFov;
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  damage(amount, source = 'damage', knockback = null) {
    if (this.dead || this.damageCooldown > 0 || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.damageCooldown = 0.45;
    if (knockback) {
      this.velocity.x += knockback.x;
      this.velocity.z += knockback.z;
      this.velocity.y = Math.max(this.velocity.y, 4);
    }
    this.hooks.onDamage?.(amount, source);
    if (this.health <= 0) {
      this.dead = true;
      this.clearKeys();
      this.hooks.onDeath?.(source);
    }
    return true;
  }

  heal(amount) {
    const old = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - old;
  }

  consume(def) {
    if (!def || (!def.food && !def.heal)) return false;
    if (def.food && this.hunger >= 20 && !def.heal) return false;
    if (def.food) this.hunger = Math.min(20, this.hunger + def.food);
    if (def.heal) this.heal(def.heal);
    if (def.hurt) this.damage(def.hurt, 'food');
    return true;
  }

  intersectsBlock(x, y, z) {
    const box = this.getAABB();
    return box.maxX > x && box.minX < x + 1 && box.maxY > y && box.minY < y + 1 && box.maxZ > z && box.minZ < z + 1;
  }

  respawn() {
    this.position.copy(this.spawn || this.position);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = 20;
    this.dead = false;
    this.damageCooldown = 1;
    this.syncCamera(0);
  }

  serialize() {
    return {
      position: this.position.toArray(), yaw: this.yaw, pitch: this.pitch,
      health: this.health, hunger: this.hunger, distanceWalked: this.distanceWalked,
    };
  }
}
