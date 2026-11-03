// First-person player: movement, physics, health/hunger/breath, flight.
import { moveEntity, inWater } from './physics.js';
import { clamp, lerp } from './noise.js';
import { B } from './blocks.js';

export class Player {
  constructor(world, spawn, mode) {
    this.world = world;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.w = 0.6; this.h = 1.8;
    this.eye = 1.62;
    this.yaw = 0; this.pitch = 0;
    this.mode = mode; // 'survival' | 'creative'
    this.hp = 20; this.hunger = 20; this.breath = 10;
    this.onGround = false;
    this.flying = false;
    this.sprinting = false;
    this.inWater = false;
    this.headUnder = false;
    this.invuln = 0;
    this.fallStart = null;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.stepDist = 0;
    this.dead = false;
    this.spawn = { ...spawn };
    this.bobPhase = 0;
    this.lastDamageCause = '';
  }

  get creative() { return this.mode === 'creative'; }

  update(dt, input, hooks) {
    if (this.dead) return;
    const world = this.world;
    this.invuln = Math.max(0, this.invuln - dt);

    const wasInWater = this.inWater;
    this.inWater = inWater(world, this);
    this.headUnder = inWater(world, this, true);
    if (this.inWater && !wasInWater && this.vel.y < -5) hooks.splash?.();

    // movement direction in world space
    let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let iz = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
    const len = Math.hypot(ix, iz) || 1;
    ix /= len; iz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = ix * cos - iz * sin;
    const mz = ix * sin + iz * cos;

    this.sprinting = input.sprint && input.forward && !this.flying && this.hunger > 6;
    const moving = ix !== 0 || iz !== 0;

    if (this.flying) {
      const speed = input.sprint ? 21 : 11;
      this.vel.x = lerp(this.vel.x, mx * speed, 1 - Math.exp(-10 * dt));
      this.vel.z = lerp(this.vel.z, mz * speed, 1 - Math.exp(-10 * dt));
      const vy = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0);
      this.vel.y = lerp(this.vel.y, vy * speed * 0.8, 1 - Math.exp(-10 * dt));
      this.fallStart = null;
    } else if (this.inWater) {
      const speed = 3.2;
      this.vel.x = lerp(this.vel.x, mx * speed, 1 - Math.exp(-5 * dt));
      this.vel.z = lerp(this.vel.z, mz * speed, 1 - Math.exp(-5 * dt));
      this.vel.y -= 10 * dt;
      if (input.jump) this.vel.y = lerp(this.vel.y, 4.2, 1 - Math.exp(-8 * dt));
      this.vel.y = clamp(this.vel.y, -4, 5);
      this.fallStart = null;
    } else {
      const speed = this.sprinting ? 5.9 : 4.3;
      const accel = this.onGround ? 14 : 4.5;
      this.vel.x = lerp(this.vel.x, mx * speed, 1 - Math.exp(-accel * dt));
      this.vel.z = lerp(this.vel.z, mz * speed, 1 - Math.exp(-accel * dt));
      this.vel.y -= 28 * dt;
      this.vel.y = Math.max(this.vel.y, -50);
      if (input.jump && this.onGround) {
        this.vel.y = 8.6;
        this.exhaustion += 0.08;
        hooks.jump?.();
      }
      // fall tracking
      if (!this.onGround && this.vel.y < 0 && this.fallStart === null) this.fallStart = this.pos.y;
      if (this.vel.y >= 0) this.fallStart = null;
    }

    const prevY = this.pos.y;
    const res = moveEntity(world, this, dt);
    const wasGround = this.onGround;
    this.onGround = res.onGround || (this.flying && Math.abs(this.vel.y) < 0.01 && res.hitY);

    // landing
    if (!wasGround && res.onGround && this.fallStart !== null) {
      const fall = this.fallStart - this.pos.y;
      if (fall > 3.5 && !this.creative) {
        this.damage(Math.floor(fall - 3), 'fall', hooks);
        hooks.land?.(true);
      } else if (fall > 1) hooks.land?.(false);
      this.fallStart = null;
    }
    if (res.onGround) this.fallStart = null;

    // cactus damage
    this.cactusCheck(hooks);

    // void
    if (this.pos.y < -12) this.damage(4, 'void', hooks, true);

    // footsteps
    if (this.onGround && moving && !this.flying) {
      this.stepDist += Math.hypot(this.vel.x, this.vel.z) * dt;
      const stride = this.sprinting ? 2.6 : 2.1;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const under = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.3), Math.floor(this.pos.z));
        hooks.step?.(under);
      }
      this.bobPhase += Math.hypot(this.vel.x, this.vel.z) * dt * 1.6;
    }

    // ---- survival stats ----
    if (!this.creative) {
      this.exhaustion += dt * (this.sprinting ? 0.09 : moving ? 0.022 : 0.008);
      if (this.exhaustion >= 1) {
        this.exhaustion -= 1;
        this.hunger = Math.max(0, this.hunger - 1);
      }
      if (this.hunger >= 14 && this.hp < 20) {
        this.regenTimer += dt;
        if (this.regenTimer > 3) { this.regenTimer = 0; this.hp = Math.min(20, this.hp + 1); this.hunger = Math.max(0, this.hunger - 0.4); }
      } else this.regenTimer = 0;
      if (this.hunger <= 0) {
        this.starveTimer += dt;
        if (this.starveTimer > 4) {
          this.starveTimer = 0;
          if (this.hp > 1) this.damage(1, 'starve', hooks, true);
        }
      } else this.starveTimer = 0;

      // breath
      if (this.headUnder) {
        this.drownTimer += dt;
        this.breath = Math.max(0, 10 - this.drownTimer);
        if (this.breath <= 0) {
          this.breathTick = (this.breathTick || 0) + dt;
          if (this.breathTick > 1) { this.breathTick = 0; this.damage(2, 'drown', hooks, true); }
        }
      } else {
        this.drownTimer = 0; this.breath = 10; this.breathTick = 0;
      }
    }
  }

  cactusCheck(hooks) {
    if (this.creative || this.invuln > 0) return;
    const half = this.w / 2 + 0.05;
    for (let y = Math.floor(this.pos.y); y <= Math.floor(this.pos.y + this.h); y++)
      for (let z = Math.floor(this.pos.z - half); z <= Math.floor(this.pos.z + half); z++)
        for (let x = Math.floor(this.pos.x - half); x <= Math.floor(this.pos.x + half); x++)
          if (this.world.getBlock(x, y, z) === B.CACTUS) { this.damage(1, 'cactus', hooks); return; }
  }

  damage(amount, cause, hooks, pierceInvuln = false) {
    if (this.dead || amount <= 0) return;
    if (this.creative && cause !== 'void') return;
    if (this.invuln > 0 && !pierceInvuln) return;
    this.hp -= amount;
    this.invuln = 0.5;
    this.lastDamageCause = cause;
    hooks.hurt?.(amount, cause);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      hooks.died?.(cause);
    }
  }

  eat(value) {
    if (this.hunger >= 20) return false;
    this.hunger = Math.min(20, this.hunger + value);
    return true;
  }

  respawn() {
    this.pos = { ...this.spawn };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = 20; this.hunger = 20; this.breath = 10;
    this.dead = false; this.fallStart = null;
    this.exhaustion = 0; this.drownTimer = 0;
  }

  serialize() {
    return {
      pos: this.pos, yaw: this.yaw, pitch: this.pitch, hp: this.hp,
      hunger: this.hunger, spawn: this.spawn, flying: this.flying, mode: this.mode,
    };
  }

  deserialize(d) {
    if (!d) return;
    this.pos = { ...d.pos }; this.yaw = d.yaw || 0; this.pitch = d.pitch || 0;
    this.hp = d.hp ?? 20; this.hunger = d.hunger ?? 20;
    this.spawn = d.spawn || { ...d.pos };
    this.flying = !!d.flying && this.creative;
    if (this.hp <= 0) { this.hp = 20; this.hunger = 20; this.pos = { ...this.spawn }; }
  }
}