// First-person player: movement, swimming, flying, health/hunger/air.
import { moveBody, type Body } from "./physics";
import type { World } from "./world";
import { B, BLOCKS } from "./blocks";

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

export class Player {
  body: Body = { x: 0, y: 80, z: 0, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, onGround: false, hitWall: false, inWater: false, inLava: false };
  yaw = 0;
  pitch = 0;
  health = 20;
  maxHealth = 20;
  hunger = 20;
  saturation = 5;
  air = 300;
  maxAir = 300;
  xp = 0;
  flying = false;
  creative = false;
  sprinting = false;
  sneaking = false;
  dead = false;
  fallStart = 0;
  exhaustion = 0;
  regenTimer = 0;
  starveTimer = 0;
  hurtTimer = 0;
  lastJumpPress = -10;
  walkCycle = 0;
  distanceWalked = 0;
  headInWater = false;
  spawn = { x: 0, y: 80, z: 0 };
  onHurt: ((amount: number, cause: string) => void) | null = null;
  onDeath: ((cause: string) => void) | null = null;
  onStep: ((block: number) => void) | null = null;
  onSplash: (() => void) | null = null;
  private stepAccum = 0;
  private wasInWater = false;

  get eyeHeight() {
    return this.sneaking ? 1.5 : 1.62;
  }
  get eyeY() {
    return this.body.y + this.eyeHeight;
  }

  teleport(x: number, y: number, z: number) {
    this.body.x = x;
    this.body.y = y;
    this.body.z = z;
    this.body.vx = this.body.vy = this.body.vz = 0;
    this.fallStart = y;
  }

  respawn() {
    this.teleport(this.spawn.x, this.spawn.y, this.spawn.z);
    this.health = this.maxHealth;
    this.hunger = 20;
    this.saturation = 5;
    this.air = this.maxAir;
    this.dead = false;
    this.hurtTimer = 0;
  }

  damage(amount: number, cause: string) {
    if (this.dead || this.creative) return;
    if (this.hurtTimer > 0 && cause !== "lava" && cause !== "drown" && cause !== "starve" && cause !== "fire") return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.5;
    this.onHurt?.(amount, cause);
    if (this.health <= 0) {
      this.dead = true;
      this.onDeath?.(cause);
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(food: number) {
    this.hunger = Math.min(20, this.hunger + food);
    this.saturation = Math.min(this.hunger, this.saturation + food * 0.6);
  }

  update(dt: number, input: InputState, world: World, now: number) {
    const b = this.body;
    if (this.dead) {
      b.vx *= 0.9;
      b.vz *= 0.9;
      b.vy -= 32 * dt;
      moveBody(world, b, dt);
      return;
    }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.sneaking = input.sneak && !this.flying;
    this.sprinting = input.sprint && input.forward && !this.sneaking && (this.hunger > 6 || this.creative);

    // movement direction in world space
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (input.forward) { mx -= sin; mz -= cos; }
    if (input.back) { mx += sin; mz += cos; }
    if (input.left) { mx -= cos; mz += sin; }
    if (input.right) { mx += cos; mz -= sin; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }

    const inFluid = b.inWater || b.inLava;
    let speed = this.sneaking ? 1.4 : this.sprinting ? 5.8 : 4.3;
    if (this.flying) speed = this.sprinting ? 22 : 11;
    if (inFluid && !this.flying) speed *= b.inLava ? 0.4 : 0.6;

    if (this.flying) {
      const accel = 12;
      b.vx += (mx * speed - b.vx) * Math.min(1, accel * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, accel * dt);
      let vy = 0;
      if (input.jump) vy += speed * 0.8;
      if (input.sneak) vy -= speed * 0.8;
      b.vy += (vy - b.vy) * Math.min(1, accel * dt);
      moveBody(world, b, dt);
      if (b.onGround && !input.jump) {
        // landed while flying -> keep flying unless ground touch and creative double-space handles toggle
      }
      this.fallStart = b.y;
    } else if (inFluid) {
      const accel = 6;
      b.vx += (mx * speed - b.vx) * Math.min(1, accel * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, accel * dt);
      b.vy -= 9 * dt; // weak gravity
      b.vy *= 1 - 2.5 * dt;
      if (input.jump) b.vy += 24 * dt;
      if (b.vy < -3) b.vy = -3;
      if (b.vy > 3.5) b.vy = 3.5;
      // climb out of water edge
      if (input.jump && b.hitWall && b.vy < 2) b.vy = 3.5;
      moveBody(world, b, dt);
      this.fallStart = b.y;
    } else {
      const accel = b.onGround ? 14 : 3;
      b.vx += (mx * speed - b.vx) * Math.min(1, accel * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, accel * dt);
      if (input.jump && b.onGround) {
        b.vy = 9.2;
        if (this.sprinting) this.exhaustion += 0.2;
      }
      b.vy -= 32 * dt;
      if (b.vy < -60) b.vy = -60;
      const wasGround = b.onGround;
      if (wasGround) this.fallStart = Math.max(this.fallStart, b.y);
      const prevY = b.y;
      // Sneak edge protection
      if (this.sneaking && b.onGround) {
        const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
        if (!hasGroundBelow(world, b, nx, b.z)) b.vx = 0;
        if (!hasGroundBelow(world, b, b.x, nz)) b.vz = 0;
      }
      moveBody(world, b, dt);
      if (b.vy > 0 || prevY < b.y) { /* rising */ }
      if (!wasGround && b.onGround) {
        const fall = this.fallStart - b.y;
        if (fall > 3.5) {
          const dmg = Math.floor(fall - 3);
          this.damage(dmg, "fall");
          this.onStep?.(groundBlock(world, b));
        }
        this.fallStart = b.y;
      }
      if (!b.onGround && b.vy > 0) this.fallStart = Math.max(this.fallStart, b.y);
    }

    // Steps
    const hs = Math.hypot(b.vx, b.vz);
    if ((b.onGround || (inFluid && hs > 0.5)) && hs > 0.5) {
      this.walkCycle += dt * hs * 1.6;
      this.distanceWalked += hs * dt;
      this.stepAccum += hs * dt;
      if (this.stepAccum > (this.sprinting ? 2.2 : 1.9)) {
        this.stepAccum = 0;
        if (!inFluid) this.onStep?.(groundBlock(world, b));
        if (this.sprinting) this.exhaustion += 0.1;
      }
    } else {
      this.stepAccum = 0;
    }

    // Splash
    if (b.inWater && !this.wasInWater && Math.abs(b.vy) > 2) this.onSplash?.();
    this.wasInWater = b.inWater;

    // Environmental damage
    const headBlock = world.getBlock(Math.floor(b.x), Math.floor(this.eyeY), Math.floor(b.z));
    this.headInWater = headBlock === B.WATER;
    if (this.headInWater && !this.creative) {
      this.air -= dt * 60;
      if (this.air <= 0) {
        this.air = 0;
        this.starveTimer += dt;
        if (this.starveTimer > 1) {
          this.starveTimer = 0;
          this.damage(2, "drown");
        }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 120);
    }
    if (b.inLava) {
      this.damage(4 * dt + 0.01, "lava");
    }
    // Contact damage (cactus)
    const touching = [
      world.getBlock(Math.floor(b.x + b.w + 0.05), Math.floor(b.y + 0.5), Math.floor(b.z)),
      world.getBlock(Math.floor(b.x - b.w - 0.05), Math.floor(b.y + 0.5), Math.floor(b.z)),
      world.getBlock(Math.floor(b.x), Math.floor(b.y + 0.5), Math.floor(b.z + b.w + 0.05)),
      world.getBlock(Math.floor(b.x), Math.floor(b.y + 0.5), Math.floor(b.z - b.w - 0.05)),
      world.getBlock(Math.floor(b.x), Math.floor(b.y - 0.05), Math.floor(b.z)),
    ];
    for (const t of touching) {
      const def = BLOCKS[t];
      if (def?.damage && t !== B.LAVA) {
        this.damage(def.damage, "cactus");
        break;
      }
    }
    if (b.y < -10) this.damage(100, "void");

    // Hunger & regen
    if (!this.creative) {
      this.exhaustion += dt * 0.01;
      if (this.exhaustion > 4) {
        this.exhaustion -= 4;
        if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
        else this.hunger = Math.max(0, this.hunger - 1);
      }
      if (this.hunger >= 18 && this.health < this.maxHealth) {
        this.regenTimer += dt;
        if (this.regenTimer > 3) {
          this.regenTimer = 0;
          this.heal(1);
          this.exhaustion += 1.5;
        }
      } else if (this.hunger <= 0) {
        this.regenTimer += dt;
        if (this.regenTimer > 4) {
          this.regenTimer = 0;
          if (this.health > 1) this.damage(1, "starve");
        }
      }
    }
    void now;
  }
}

function hasGroundBelow(world: World, b: Body, x: number, z: number): boolean {
  const y = Math.floor(b.y - 0.1);
  for (const [dx, dz] of [[-b.w, -b.w], [b.w, -b.w], [-b.w, b.w], [b.w, b.w]]) {
    const id = world.getBlock(Math.floor(x + dx), y, Math.floor(z + dz));
    if (BLOCKS[id]?.solid) return true;
  }
  return false;
}

function groundBlock(world: World, b: Body): number {
  return world.getBlock(Math.floor(b.x), Math.floor(b.y - 0.1), Math.floor(b.z));
}
