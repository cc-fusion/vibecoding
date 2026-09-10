// Player physics & state: AABB collision, walking, swimming, flying, fall damage, drowning.
import * as THREE from "three";
import { B, BLOCKS } from "./blocks";
import type { World } from "./world";

export interface MoveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

export type PlayerEvent = "hurt" | "land" | "splash" | "jump" | "death" | "step";

export class Player {
  pos = new THREE.Vector3(0, 80, 0);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  readonly width = 0.6;
  readonly height = 1.8;
  eyeHeight = 1.62;
  onGround = false;
  inWater = false;
  inLava = false;
  headInWater = false;
  flying = false;
  sneaking = false;
  sprinting = false;
  health = 20;
  maxHealth = 20;
  air = 20;
  dead = false;
  fallDistance = 0;
  hurtTimer = 0;
  private drownTimer = 0;
  private stepDist = 0;
  private contactTimer = 0;
  onEvent: ((e: PlayerEvent, data?: number) => void) | null = null;
  creative = false;

  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  direction(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  hurt(amount: number) {
    if (this.dead || this.creative || this.hurtTimer > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.5;
    this.onEvent?.("hurt", amount);
    if (this.health <= 0) {
      this.dead = true;
      this.onEvent?.("death");
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  respawn(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.air = 20;
    this.dead = false;
    this.fallDistance = 0;
    this.hurtTimer = 0;
    this.flying = false;
  }

  private collides(world: World, px: number, py: number, pz: number): boolean {
    const hw = this.width / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw - 1e-6);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.height - 1e-6);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw - 1e-6);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (world.isSolid(x, y, z)) return true;
    return false;
  }

  /** would the player have ground under them at this position? (for sneak edge protection) */
  private hasGroundBelow(world: World, px: number, py: number, pz: number): boolean {
    const hw = this.width / 2;
    const y = Math.floor(py - 0.05);
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw - 1e-6);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw - 1e-6);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (world.isSolid(x, y, z)) return true;
    return false;
  }

  /** is the player's box currently overlapping solid blocks (e.g. after a block was placed on them)? */
  isStuck(world: World): boolean {
    return this.collides(world, this.pos.x, this.pos.y, this.pos.z);
  }

  private moveAxis(world: World, axis: 0 | 1 | 2, amount: number) {
    if (amount === 0) return;
    const STEP = 0.25;
    let remaining = amount;
    while (remaining !== 0) {
      const step = Math.abs(remaining) > STEP ? Math.sign(remaining) * STEP : remaining;
      remaining -= step;
      const nx = this.pos.x + (axis === 0 ? step : 0);
      const ny = this.pos.y + (axis === 1 ? step : 0);
      const nz = this.pos.z + (axis === 2 ? step : 0);
      if (this.collides(world, nx, ny, nz)) {
        // binary search the exact contact point
        let lo = 0, hi = step;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const tx = this.pos.x + (axis === 0 ? mid : 0);
          const ty = this.pos.y + (axis === 1 ? mid : 0);
          const tz = this.pos.z + (axis === 2 ? mid : 0);
          if (this.collides(world, tx, ty, tz)) hi = mid;
          else lo = mid;
        }
        if (axis === 0) this.pos.x += lo;
        else if (axis === 1) this.pos.y += lo;
        else this.pos.z += lo;
        if (axis === 1) {
          if (amount < 0) this.onGround = true;
          this.vel.y = 0;
        } else if (axis === 0) this.vel.x = 0;
        else this.vel.z = 0;
        return;
      }
      if (this.sneaking && this.onGround && !this.flying && axis !== 1 && !this.hasGroundBelow(world, nx, ny, nz)) {
        if (axis === 0) this.vel.x = 0;
        else this.vel.z = 0;
        return;
      }
      if (axis === 0) this.pos.x = nx;
      else if (axis === 1) this.pos.y = ny;
      else this.pos.z = nz;
    }
  }

  update(dt: number, input: MoveInput, world: World) {
    if (this.dead) return;
    dt = Math.min(dt, 0.05);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    // environment
    const feetBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z));
    const waistBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.9), Math.floor(this.pos.z));
    const eyeBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eyeHeight), Math.floor(this.pos.z));
    const wasInWater = this.inWater;
    this.inWater = feetBlock === B.WATER || waistBlock === B.WATER;
    this.inLava = feetBlock === B.LAVA || waistBlock === B.LAVA;
    this.headInWater = eyeBlock === B.WATER;
    const liquid = this.inWater || this.inLava;
    if (!wasInWater && this.inWater && this.vel.y < -3) this.onEvent?.("splash");
    if (liquid && this.flying) this.flying = false;

    this.sneaking = input.sneak && !this.flying;
    this.sprinting = input.sprint && input.forward && !this.sneaking;
    const targetEye = this.sneaking ? 1.42 : 1.62;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 15);

    // desired horizontal move
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = mx * cos + mz * sin;
    const wz = -mx * sin + mz * cos;

    let speed: number;
    if (this.flying) speed = this.sprinting ? 22 : 11;
    else if (liquid) speed = this.inLava ? 1.5 : 3;
    else if (this.sneaking) speed = 1.4;
    else speed = this.sprinting ? 5.8 : 4.3;

    const k = this.flying ? 6 : liquid ? 4 : this.onGround ? 14 : 2.5;
    const blend = 1 - Math.exp(-k * dt);
    this.vel.x += (wx * speed - this.vel.x) * blend;
    this.vel.z += (wz * speed - this.vel.z) * blend;

    // vertical
    if (this.flying) {
      let vy = 0;
      if (input.jump) vy += speed * 0.7;
      if (input.sneak) vy -= speed * 0.7;
      this.vel.y += (vy - this.vel.y) * blend;
      this.fallDistance = 0;
    } else if (liquid) {
      const g = this.inLava ? 4 : 9;
      this.vel.y -= g * dt;
      if (input.jump) this.vel.y += (this.inLava ? 12 : 26) * dt;
      const maxUp = 4, maxDown = this.inLava ? 1.5 : 3;
      this.vel.y = Math.max(-maxDown, Math.min(maxUp, this.vel.y));
      this.fallDistance = 0;
      // hop out of water onto land
      if (input.jump && this.horizontalBlocked(world) && this.vel.y > 0) this.vel.y = Math.max(this.vel.y, 5.5);
    } else {
      this.vel.y -= 28 * dt;
      if (this.vel.y < -60) this.vel.y = -60;
      if (input.jump && this.onGround) {
        this.vel.y = 8.6;
        this.onGround = false;
        this.onEvent?.("jump");
      }
    }

    const wasOnGround = this.onGround;
    const prevVy = this.vel.y;
    this.onGround = false;
    this.moveAxis(world, 1, this.vel.y * dt);
    this.moveAxis(world, 0, this.vel.x * dt);
    this.moveAxis(world, 2, this.vel.z * dt);

    // fall damage
    if (!this.onGround && prevVy < 0 && !liquid && !this.flying) this.fallDistance += -prevVy * dt;
    if (this.onGround && !wasOnGround) {
      if (this.fallDistance > 3.2 && !liquid) {
        const dmg = Math.floor(this.fallDistance - 3);
        this.onEvent?.("land", dmg);
        this.hurt(dmg);
      } else if (this.fallDistance > 0.5) this.onEvent?.("land", 0);
      this.fallDistance = 0;
    }
    if (liquid) this.fallDistance = 0;

    // footsteps
    if (this.onGround && !liquid) {
      this.stepDist += Math.hypot(this.vel.x, this.vel.z) * dt;
      if (this.stepDist > (this.sprinting ? 2.2 : 1.7)) {
        this.stepDist = 0;
        this.onEvent?.("step");
      }
    }

    // drowning
    if (this.headInWater && !this.creative) {
      this.drownTimer += dt;
      if (this.drownTimer > 1.5) {
        this.drownTimer = 0;
        if (this.air > 0) this.air--;
        else this.hurt(2);
      }
    } else {
      this.drownTimer = 0;
      if (this.air < 20) this.air = Math.min(20, this.air + dt * 8);
    }

    // contact damage (lava, cactus)
    this.contactTimer -= dt;
    if (this.contactTimer <= 0) {
      this.contactTimer = 0.5;
      const dmg = this.contactDamage(world);
      if (dmg > 0) this.hurt(dmg);
    }

    // safety: fell out of world
    if (this.pos.y < -10) this.hurt(4);
  }

  private horizontalBlocked(world: World): boolean {
    const d = this.direction();
    const px = this.pos.x + Math.sign(d.x) * 0.5, pz = this.pos.z + Math.sign(d.z) * 0.5;
    return world.isSolid(Math.floor(px), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)) || world.isSolid(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(pz));
  }

  private contactDamage(world: World): number {
    const hw = this.width / 2 + 0.05;
    const x0 = Math.floor(this.pos.x - hw), x1 = Math.floor(this.pos.x + hw);
    const y0 = Math.floor(this.pos.y - 0.05), y1 = Math.floor(this.pos.y + this.height);
    const z0 = Math.floor(this.pos.z - hw), z1 = Math.floor(this.pos.z + hw);
    let dmg = 0;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const def = BLOCKS[world.getBlock(x, y, z)];
          if (def.damage) {
            // cactus only hurts when actually touching its box, lava when inside it
            if (def.id === B.CACTUS) {
              const inside = this.pos.x + hw > x && this.pos.x - hw < x + 1 && this.pos.z + hw > z && this.pos.z - hw < z + 1 && this.pos.y + this.height > y && this.pos.y - 0.05 < y + 1;
              if (!inside) continue;
            } else if (!(this.pos.x + hw - 0.05 > x && this.pos.x - hw + 0.05 < x + 1 && this.pos.z + hw - 0.05 > z && this.pos.z - hw + 0.05 < z + 1 && this.pos.y + this.height > y && this.pos.y < y + 1)) continue;
            dmg = Math.max(dmg, def.damage);
          }
        }
    return dmg;
  }
}
