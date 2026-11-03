// Player: first-person movement physics, vitals (health, hunger, air, fire).
import type { Game } from './game';
import { newBody, moveBody, type Body } from './physics';
import { B, BLOCKS } from './blocks';

export interface Input { f: boolean; b: boolean; l: boolean; r: boolean; jump: boolean; sneak: boolean; sprint: boolean }

export class Player {
  body: Body = newBody(0.6, 1.8);
  yaw = 0; pitch = 0; flying = false; sneaking = false; sprinting = false;
  inWater = false; headInWater = false; inLava = false; headInLava = false;
  health = 20; maxHealth = 20; food = 20; saturation = 5; exhaustion = 0; air = 15;
  fallDist = 0; hurtT = 0; invul = 0; lastDmg = 0; regenT = 0; starveT = 0; drownT = 0; burn = 0;
  spawn = { x: 0, y: 80, z: 0 };
  dead = false; walkDist = 0; stepDist = 0; eye = 1.62; bobPhase = 0; jumpHeld = false; totalDist = 0;
  prevOnGround = false; prevY = 0; lavaT = 0;

  get x() { return this.body.x; } get y() { return this.body.y; } get z() { return this.body.z; }

  teleport(x: number, y: number, z: number) { const b = this.body; b.x = x; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; this.fallDist = 0; }

  damage(g: Game, amount: number, fromX?: number, fromZ?: number) {
    if (this.dead || g.creative) return;
    if (this.invul > 0 && amount <= this.lastDmg) return;
    const eff = this.invul > 0 ? amount - this.lastDmg : amount;
    this.lastDmg = amount; this.invul = 0.5;
    this.health = Math.max(0, this.health - eff);
    this.hurtT = 0.45;
    if (fromX !== undefined && fromZ !== undefined) {
      const dx = this.body.x - fromX, dz = this.body.z - fromZ, d = Math.hypot(dx, dz) || 1;
      this.body.vx += (dx / d) * 5; this.body.vz += (dz / d) * 5; this.body.vy = Math.max(this.body.vy, 4.5);
    }
    g.audio.play(this.health <= 0 ? 'death' : 'hurt', undefined, 1);
    g.bump();
    if (this.health <= 0) g.onPlayerDeath();
  }

  update(dt: number, inp: Input, g: Game) {
    const w = g.world!, b = this.body, creative = g.creative;
    if (this.dead) return;
    this.invul = Math.max(0, this.invul - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    const cell = (dy: number) => w.getBlock(Math.floor(b.x), Math.floor(b.y + dy), Math.floor(b.z));
    this.inWater = cell(0.6) === B.WATER; this.headInWater = cell(1.62) === B.WATER;
    this.inLava = cell(0.4) === B.LAVA || cell(0.1) === B.LAVA; this.headInLava = cell(1.62) === B.LAVA;
    const fwd = (inp.f ? 1 : 0) - (inp.b ? 1 : 0), str = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    let wx = -s * fwd + c * str, wz = -c * fwd - s * str;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    this.sneaking = inp.sneak && !this.flying;
    const canSprint = this.food > 6 || creative;
    this.sprinting = inp.sprint && fwd > 0 && canSprint && !this.sneaking && !this.headInWater;
    if (fwd <= 0 && !inp.sprint) this.sprinting = false;
    let speed = this.sneaking ? 1.35 : this.sprinting ? 5.7 : 4.3;
    const inFluid = (this.inWater || this.inLava) && !this.flying;
    if (this.flying) {
      speed = this.sprinting ? 22 : 11;
      const k = Math.min(1, dt * 8);
      b.vx += (wx * speed - b.vx) * k; b.vz += (wz * speed - b.vz) * k;
      const vy = (inp.jump ? 1 : 0) - (inp.sneak ? 1 : 0);
      b.vy += (vy * (this.sprinting ? 14 : 9) - b.vy) * k;
    } else {
      if (inFluid) speed *= this.inLava ? 0.35 : 0.6;
      const k = Math.min(1, dt * (b.onGround ? 14 : inFluid ? 4 : 2.6));
      b.vx += (wx * speed - b.vx) * k; b.vz += (wz * speed - b.vz) * k;
      if (inFluid) {
        const lava = this.inLava;
        b.vy -= (lava ? 3 : 6) * dt;
        b.vy *= 1 - Math.min(1, dt * (lava ? 4 : 2.2));
        if (inp.jump) b.vy = Math.min(b.vy + 20 * dt, lava ? 2.5 : 3.8);
        if (inp.sneak) b.vy -= 8 * dt;
        if (inp.jump && (b.hitX || b.hitZ) && !this.headInWater) b.vy = 6.8;
        this.fallDist = 0;
      } else {
        b.vy = Math.max(-55, b.vy - 30 * dt);
        if (inp.jump && b.onGround) {
          b.vy = 8.7; g.addExhaustion(this.sprinting ? 0.2 : 0.05);
          if (this.sprinting) { b.vx += wx * 1.2; b.vz += wz * 1.2; }
        }
      }
    }
    this.prevY = b.y;
    const wasGround = b.onGround;
    moveBody(w, b, dt, this.sneaking && !creative ? true : this.sneaking);
    if (this.flying && b.onGround && inp.sneak) this.flying = false;
    // landing / fall damage
    if (!b.onGround && b.vy < 0 && !this.flying && !inFluid) this.fallDist += Math.max(0, this.prevY - b.y);
    if (b.onGround && !wasGround) {
      if (this.fallDist > 3 && !g.creative) this.damage(g, Math.ceil(this.fallDist - 3));
      if (this.fallDist > 1.5) { g.audio.block('step', BLOCKS[this.groundBlock(g)]?.sound || 'stone'); g.particles.debris(b.x, b.y + 0.1, b.z, BLOCKS[this.groundBlock(g)]?.tiles[2] ?? 0, null, 6, 2); }
      this.fallDist = 0;
    }
    if (this.flying) this.fallDist = 0;
    // fluid entry/exit effects
    // footsteps & exhaustion
    const hs = Math.hypot(b.vx, b.vz);
    if (b.onGround && hs > 0.5 && !this.flying) {
      this.stepDist += hs * dt;
      const interval = this.sprinting ? 2.4 : this.sneaking ? 3.6 : 2.0;
      if (this.stepDist > interval) {
        this.stepDist = 0;
        const id = this.groundBlock(g);
        g.audio.block('step', inFluid ? 'water' : BLOCKS[id]?.sound || 'stone');
        if (this.sprinting && Math.random() < 0.5) g.particles.debris(b.x, b.y + 0.05, b.z, BLOCKS[id]?.tiles[2] ?? 0, null, 2, 1.2);
      }
      if (this.sprinting) g.addExhaustion(0.1 * hs * dt);
      this.bobPhase += hs * dt * 1.55;
    } else if (inFluid && hs > 0.5) {
      this.stepDist += hs * dt;
      if (this.stepDist > 2.2) { this.stepDist = 0; g.audio.play('swim', undefined, 0.6); }
    }
    this.totalDist += hs * dt;
    // eye height smoothing
    const targetEye = this.sneaking ? 1.4 : 1.62;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 14);
    // water splash on entry
    // vitals
    if (!creative) {
      if (this.headInWater) {
        this.air -= dt;
        if (this.air <= 0) { this.drownT -= dt; if (this.drownT <= 0) { this.drownT = 1; this.damage(g, 2); this.air = 0; } }
      } else this.air = Math.min(15, this.air + dt * 6);
      if (this.inLava) { this.burn = 5; this.lavaT -= dt; if (this.lavaT <= 0) { this.lavaT = 0.5; this.damage(g, 4); } }
      if (this.inWater && !this.inLava) this.burn = 0;
      if (this.burn > 0) { this.burn -= dt; if (Math.floor(this.burn) !== Math.floor(this.burn + dt)) this.damage(g, 1); if (Math.random() < 0.4) g.particles.flame(b.x + (Math.random() - 0.5) * 0.6, b.y + Math.random() * 1.6, b.z + (Math.random() - 0.5) * 0.6); }
      // cactus contact
      if (g.touchingCactus()) { this.starveT += 0; if (Math.floor(g.time * 2) !== Math.floor((g.time - dt) * 2)) this.damage(g, 1); }
      if (this.exhaustion >= 4) { this.exhaustion -= 4; if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else this.food = Math.max(0, this.food - 1); g.bump(); }
      if (this.food >= 18 && this.health < this.maxHealth) {
        this.regenT += dt;
        if (this.regenT >= (this.food >= 20 && this.saturation > 0 ? 0.6 : 3.5)) { this.regenT = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.exhaustion += this.food >= 20 && this.saturation > 0 ? 0.3 : 1.5; g.bump(); }
      } else this.regenT = 0;
      if (this.food <= 0) { this.starveT += dt; if (this.starveT >= 4) { this.starveT = 0; if (this.health > 1) this.damage(g, 1); } } else this.starveT = 0;
    } else { this.air = 15; this.burn = 0; this.health = this.maxHealth; this.food = 20; }
    // void
    if (b.y < -30) { this.damage(g, 100); }
  }

  groundBlock(g: Game) {
    const b = this.body;
    return g.world!.getBlock(Math.floor(b.x), Math.floor(b.y - 0.2), Math.floor(b.z));
  }
}
