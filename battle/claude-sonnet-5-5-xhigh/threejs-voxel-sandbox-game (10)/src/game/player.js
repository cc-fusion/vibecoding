// Player: movement physics, survival stats, block interaction (mine / place / use / attack / eat).
import { B, I, DEFS, LIQUID, SOLID, dropsFor, SHAPE, S_CROSS } from './blocks.js';
import { GRAVITY, REACH, CH } from './constants.js';
import { moveBox, boxCollides } from './physics.js';

const HEAD_CLEAR = 1.8;

export class Player {
  constructor(game) {
    this.game = game;
    this.x = 0; this.y = 80; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.hw = 0.3; this.h = HEAD_CLEAR; this.height = HEAD_CLEAR;
    this.onGround = false;
    this.inWater = false; this.headUnder = false; this.inLava = false;
    this.flying = false; this.sprinting = false; this.sneaking = false;
    this.creative = false;
    this.health = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 15; this.dead = false; this.invuln = 0;
    this.input = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false };
    this.eyeH = 1.62;
    this.fallStartY = null;
    this.stepDist = 0; this.bobPhase = 0; this.bobAmp = 0;
    this.regenT = 0; this.starveT = 0; this.drownT = 0; this.lavaT = 0; this.burnT = 0; this.cactusT = 0; this.voidT = 0;
    this.spawn = null;
    // interaction
    this.target = null;
    this.mine = { key: '', progress: 0, hitT: 0, stage: -1 };
    this.swingT = 0;
    this.useT = 0; this.placeCd = 0; this.eatT = 0; this.eating = false;
    this.attackCd = 0; this.attackQueued = false;
    this.mouseL = false; this.mouseR = false;
    this.distTravelled = 0;
    this.lastSwimSound = 0;
  }

  eyePos() { return [this.x, this.y + this.eyeH, this.z]; }
  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  serialize() {
    return {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, health: this.health, hunger: this.hunger,
      saturation: this.saturation, air: this.air, flying: this.flying, spawn: this.spawn,
    };
  }
  load(s) {
    if (!s) return;
    Object.assign(this, { x: s.x, y: s.y, z: s.z, yaw: s.yaw || 0, pitch: s.pitch || 0, health: s.health ?? 20, hunger: s.hunger ?? 20, saturation: s.saturation ?? 5, air: s.air ?? 15, flying: !!s.flying, spawn: s.spawn || null });
  }

  respawnReset() {
    this.health = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0; this.air = 15;
    this.vx = this.vy = this.vz = 0; this.dead = false; this.invuln = 2; this.burnT = 0; this.fallStartY = null; this.flying = false;
  }

  // ---- fixed-step physics ---------------------------------------------------------------------------
  step(dt) {
    if (this.dead) return;
    const g = this.game, w = g.world, inp = this.input;
    const ctrl = g.canControl();
    const feetB = w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z));
    const bodyB = w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.9), Math.floor(this.z));
    const eyeB = w.getBlock(Math.floor(this.x), Math.floor(this.y + this.eyeH), Math.floor(this.z));
    const wasWater = this.inWater;
    this.inWater = feetB === B.WATER || bodyB === B.WATER;
    this.inLava = feetB === B.LAVA || bodyB === B.LAVA;
    this.headUnder = eyeB === B.WATER;
    this.headLava = eyeB === B.LAVA;
    if (this.inWater && !wasWater && this.vy < -3) {
      g.audio.play('splash', { pos: [this.x, this.y, this.z], vol: Math.min(1, -this.vy / 12 + 0.3) });
      g.particles.splash(this.x, this.y + 0.9, this.z, 14);
    }
    if (this.creative && this.onGround && this.flying) this.flying = false;

    let fx = ctrl ? (inp.forward ? 1 : 0) - (inp.back ? 1 : 0) : 0;
    let sx = ctrl ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
    const jump = ctrl && inp.jump, sneakIn = ctrl && inp.sneak;
    this.sneaking = sneakIn && !this.flying && !this.inWater;
    if (!ctrl || fx <= 0 || this.sneaking || (this.hunger <= 6 && !this.creative) || this.headUnder) { if (!(this.flying && inp.sprint && fx > 0)) this.sprinting = false; }
    if (ctrl && fx > 0 && inp.sprint && !this.sneaking && (this.hunger > 6 || this.creative)) this.sprinting = true;
    const len = Math.hypot(fx, sx);
    if (len > 0) { fx /= len; sx /= len; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const dirX = -sy * fx + cy * sx, dirZ = -cy * fx - sy * sx;

    let speed = this.sneaking ? 1.31 : this.sprinting ? 5.6 : 4.3;
    if (this.flying) speed = this.sprinting ? 17 : 10.8;
    if (this.inLava) speed *= 0.3; else if (this.inWater) speed *= this.sprinting ? 0.8 : 0.62;
    const tvx = dirX * speed, tvz = dirZ * speed;

    if (this.flying) {
      const k = Math.min(1, dt * 7);
      this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
      const ty = (jump ? 8 : 0) - (sneakIn ? 8 : 0);
      this.vy += (ty * (this.sprinting ? 1.5 : 1) - this.vy) * Math.min(1, dt * 8);
    } else if (this.inWater || this.inLava) {
      const k = Math.min(1, dt * 5);
      this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
      this.vy -= (this.inLava ? 4 : 7) * dt;
      if (jump) this.vy += (this.inLava ? 14 : 20) * dt;
      this.vy = Math.max(-4, Math.min(this.inLava ? 2.2 : 3.4, this.vy));
      this.vy *= 1 - Math.min(0.9, 1.8 * dt);
      // hop out of the water onto a ledge
      if (jump && this.hitXprev && this.inWater && !w.isSolid(Math.floor(this.x), Math.floor(this.y + 1.3), Math.floor(this.z))) this.vy = Math.max(this.vy, 6.2);
      this.fallStartY = null;
    } else {
      const k = Math.min(1, dt * (this.onGround ? 14 : 2.6));
      this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
      this.vy -= GRAVITY * dt;
      if (this.vy < -60) this.vy = -60;
      if (jump && this.onGround) {
        this.vy = 8.9; this.onGround = false;
        if (this.sprinting) { this.vx += dirX * 1.6; this.vz += dirZ * 1.6; this.exhaustion += 0.2; } else this.exhaustion += 0.05;
      }
    }

    const px = this.x, py = this.y, pz = this.z;
    const wasGround = this.onGround;
    // horizontal (separately so sneaking can stop at ledges)
    this.h = this.sneaking ? 1.5 : HEAD_CLEAR; this.height = this.h;
    const dxm = this.vx * dt, dzm = this.vz * dt;
    if (dxm !== 0) {
      moveBox(w, this, dxm, 0, 0);
      this.hitXprev = this.hitX;
      if (this.hitX) this.vx = 0;
      if (this.sneaking && wasGround && !this.groundBelow()) { this.x = px; this.vx = 0; }
    }
    if (dzm !== 0) {
      moveBox(w, this, 0, 0, dzm);
      if (this.hitZ) this.vz = 0;
      if (this.sneaking && wasGround && !this.groundBelow()) { this.z = pz; this.vz = 0; }
    }
    if (this.hitX || this.hitZ) { this.hitXprev = true; if (this.sprinting && this.hitX && this.hitZ) this.sprinting = false; } else this.hitXprev = false;
    moveBox(w, this, 0, this.vy * dt, 0);
    if (this.hitY) {
      if (this.vy < 0 && !wasGround) this.land();
      this.vy = 0;
    }
    if (!this.onGround && !this.flying && !this.inWater && !this.inLava) {
      if (this.fallStartY === null) this.fallStartY = py;
      if (this.y > this.fallStartY) this.fallStartY = this.y;
    }
    if (this.onGround) this.fallStartY = null;
    // safety: stuck inside blocks (e.g. block placed on us)
    if (boxCollides(w, this)) this.y += 0.05;
    if (this.y < -64) { this.y = -64; }

    // distance for steps / bobbing / hunger
    const moved = Math.hypot(this.x - px, this.z - pz);
    if ((this.onGround || this.inWater) && !this.flying) {
      this.stepDist += moved; this.distTravelled += moved;
      if (this.sprinting) this.exhaustion += moved * 0.1;
      const stride = this.sprinting ? 2.5 : this.sneaking ? 1.6 : 2.0;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        if (this.inWater) g.audio.play('swim', { vol: 0.4 });
        else if (!this.sneaking) {
          const below = w.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
          g.audio.blockSound(below, 'step', null, 0.7);
        }
      }
    }
    this.bobPhase += moved * 1.55;
    this.bobAmp += (((this.onGround && moved > 0.001 / dt * dt) ? Math.min(1, moved / (dt * 4.3)) : 0) - this.bobAmp) * Math.min(1, dt * 8);
    // eye height smoothing
    const targetEye = this.sneaking ? 1.27 : 1.62;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 12);
  }

  groundBelow() {
    const w = this.game.world;
    return boxCollides(w, { x: this.x, y: this.y - 0.6, z: this.z, hw: this.hw, h: 0.55 });
  }

  land() {
    const g = this.game;
    if (this.fallStartY !== null && !this.creative) {
      const dist = this.fallStartY - this.y;
      if (dist > 3.1) {
        const dmg = Math.ceil(dist - 3);
        g.damagePlayer(dmg, 'hit the ground too hard', 0, 0, 0, true);
      }
    }
    const below = g.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    if (this.fallStartY !== null && this.fallStartY - this.y > 1.2) g.audio.blockSound(below, 'step', null, 1.2);
    this.fallStartY = null;
  }

  // ---- survival ticks (per frame) ---------------------------------------------------------------
  updateSurvival(dt) {
    if (this.dead) return;
    const g = this.game, w = g.world;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.creative) { this.health = 20; this.hunger = 20; this.air = 15; this.burnT = 0; return; }
    // hunger / exhaustion
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
    this.exhaustion += dt * 0.01; // tiny passive drain
    if (this.hunger >= 18 && this.health < 20) {
      this.regenT += dt;
      const need = this.hunger >= 20 && this.saturation > 0 ? 0.6 : 4;
      if (this.regenT >= need) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.exhaustion += need < 1 ? 1.5 : 3; }
    } else this.regenT = 0;
    if (this.hunger <= 0) {
      this.starveT += dt;
      if (this.starveT >= 4) { this.starveT = 0; if (this.health > 1) g.damagePlayer(1, 'starved to death', 0, 0, 0, true); }
    } else this.starveT = 0;
    // drowning
    if (this.headUnder) {
      this.air -= dt;
      if (Math.random() < dt * 1.5) g.audio.play('bubble', { vol: 0.5 });
      if (this.air <= 0) { this.drownT += dt; if (this.drownT >= 1) { this.drownT = 0; g.damagePlayer(2, 'drowned', 0, 0, 0, true); } }
    } else { this.air = Math.min(15, this.air + dt * 6); this.drownT = 0; }
    // lava & burning
    if (this.inLava) { this.burnT = 6; this.lavaT += dt; if (this.lavaT >= 0.5) { this.lavaT = 0; g.damagePlayer(4, 'tried to swim in lava', 0, 0, 0, true); } }
    else this.lavaT = 0;
    if (this.inWater) this.burnT = 0;
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (Math.floor(this.burnT + dt) !== Math.floor(this.burnT)) g.damagePlayer(1, 'burned to death', 0, 0, 0, true);
      if (Math.random() < dt * 14) g.particles.flame(this.x, this.y + 0.3, this.z, 1);
    }
    // cactus
    this.cactusT -= dt;
    if (this.cactusT <= 0) {
      for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
        if (w.getBlock(Math.floor(this.x + dx), Math.floor(this.y + 0.5), Math.floor(this.z + dz)) === B.CACTUS) { g.damagePlayer(1, 'was pricked to death', 0, 0, 0, true); break; }
      }
      this.cactusT = 0.5;
    }
    if (this.y < -20) { this.voidT += dt; if (this.voidT > 0.4) { this.voidT = 0; g.damagePlayer(4, 'fell out of the world', 0, 0, 0, true); } }
  }

  // ---- interaction --------------------------------------------------------------------------------
  reach() { return this.creative ? REACH + 0.8 : REACH; }

  updateTarget() {
    const g = this.game;
    const [ex, ey, ez] = this.eyePos();
    const [dx, dy, dz] = this.lookDir();
    this.eye = [ex, ey, ez]; this.dir = [dx, dy, dz];
    this.target = g.world.raycast(ex, ey, ez, dx, dy, dz, this.reach());
    const m = g.mobs.raycast(ex, ey, ez, dx, dy, dz, Math.min(3.6, this.target ? this.target.t : 3.6));
    this.mobTarget = m;
  }

  breakTime(id) {
    const d = DEFS[id];
    if (d.hardness < 0) return Infinity;
    if (this.creative) return 0;
    if (d.hardness === 0) return 0.05;
    const held = this.game.inventory.held();
    const hd = held ? DEFS[held.id] : null;
    let speed = 1;
    const matches = hd && hd.tool && hd.tool === d.tool;
    if (matches) speed = hd.speed;
    const harvest = d.tier === 0 || (matches && hd.tier >= d.tier);
    let t = (d.hardness * (harvest ? 1.5 : 5)) / speed;
    if (this.inWater) t *= 3;
    return Math.max(0.05, t);
  }

  canHarvest(id) {
    const d = DEFS[id];
    if (this.creative) return false;
    const held = this.game.inventory.held();
    const hd = held ? DEFS[held.id] : null;
    return d.tier === 0 || !!(hd && hd.tool === d.tool && hd.tier >= d.tier);
  }

  update(dt) {
    const g = this.game;
    this.placeCd = Math.max(0, this.placeCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt * 3.6);
    if (this.dead) return;
    this.updateTarget();
    const ctrl = g.canControl();
    const held = g.inventory.held();
    const hd = held ? DEFS[held.id] : null;

    // ---- left button: attack or mine
    if (ctrl && (this.mouseL || this.attackQueued)) {
      if (this.mobTarget && (this.attackQueued || this.attackCd <= 0)) {
        this.attack(this.mobTarget.mob);
        this.attackQueued = false;
        this.resetMining();
      } else if (!this.mobTarget && this.target) {
        this.mineBlock(dt);
      } else if (!this.mobTarget) this.resetMining();
      if (!this.target && !this.mobTarget && this.attackQueued) { this.swing(); this.attackQueued = false; }
    } else this.resetMining();
    this.attackQueued = false;

    // ---- right button: use / place / eat
    this.eating = false;
    if (ctrl && (this.mouseR || this.rightClicked)) {
      if (hd && hd.food && this.hunger < 20) {
        this.eating = true;
        this.eatT += dt;
        if (Math.floor(this.eatT / 0.25) !== Math.floor((this.eatT - dt) / 0.25)) {
          g.audio.play('eat', { vol: 0.5 });
          const [r, gg, b] = g.particles.blockColor(B.DIRT, 4);
          const [dx, dy, dz] = this.lookDir();
          g.particles.crumbs(this.x + dx * 0.6, this.y + this.eyeH - 0.3 + dy * 0.3, this.z + dz * 0.6, r + 0.3, gg + 0.1, b, 3);
        }
        if (this.eatT >= 1.6) this.finishEating(held, hd);
      } else {
        this.eatT = 0;
        if (this.rightClicked) { this.rightClicked = false; this.useOrPlace(true); }
        else if (this.placeCd <= 0 && held && held.id < 256 && !(this.target && DEFS[this.target.id].ui)) this.useOrPlace(false);
      }
    } else { this.eatT = 0; }
    this.rightClicked = false;
  }

  swing() { this.swingT = 1; }

  resetMining() {
    if (this.mine.progress > 0 || this.mine.key) { this.mine.progress = 0; this.mine.key = ''; this.mine.stage = -1; this.game.setCrack(null, -1); }
  }

  mineBlock(dt) {
    const g = this.game, t = this.target;
    const key = t.x + ',' + t.y + ',' + t.z;
    const id = t.id;
    const bt = this.breakTime(id);
    if (this.mine.key !== key) { this.mine.key = key; this.mine.progress = 0; this.mine.hitT = 0; this.mine.stage = -1; this.mine.fresh = true; }
    if (bt === Infinity) {
      this.mine.hitT -= dt;
      if (this.mine.hitT <= 0) { this.mine.hitT = 0.25; this.swing(); g.audio.blockSound(id, 'step', [t.x + 0.5, t.y + 0.5, t.z + 0.5], 0.8); }
      return;
    }
    if (this.creative) {
      if (this.mine.fresh || (this.mine.hitT -= dt) <= 0) {
        this.mine.fresh = false; this.mine.hitT = 0.25;
        this.swing();
        this.breakBlock(t.x, t.y, t.z);
        this.mine.key = '';
      }
      return;
    }
    this.mine.progress += dt / bt;
    this.mine.hitT -= dt;
    if (this.mine.hitT <= 0) {
      this.mine.hitT = 0.22; this.swing();
      g.audio.blockSound(id, 'step', [t.x + 0.5, t.y + 0.5, t.z + 0.5], 1.3);
      g.particles.hitBlock(t.x, t.y, t.z, id, t.nx, t.ny, t.nz);
    }
    const stage = Math.min(9, Math.floor(this.mine.progress * 10));
    if (stage !== this.mine.stage) { this.mine.stage = stage; g.setCrack(t, stage); }
    if (this.mine.progress >= 1) {
      this.breakBlock(t.x, t.y, t.z);
      this.mine.key = ''; this.mine.progress = 0; this.mine.stage = -1;
      g.setCrack(null, -1);
      this.mine.fresh = true;
    }
  }

  breakBlock(x, y, z) {
    const g = this.game, w = g.world;
    const id = w.getBlock(x, y, z);
    if (!id) return;
    const d = DEFS[id];
    const harvest = this.canHarvest(id);
    g.audio.blockSound(id, 'break', [x + 0.5, y + 0.5, z + 0.5], 1.4);
    g.particles.breakBlock(x, y, z, id, 16);
    // block entity contents spill
    const be = w.getBE(x, y, z);
    if (be) {
      if (!this.creative) g.spillBlockEntity(x, y, z, be);
      w.removeBE(x, y, z);
      if (g.ui.containerPos && g.ui.containerPos.key === w.beKey(x, y, z)) g.ui.closeContainer();
    }
    w.setBlock(x, y, z, 0);
    w.checkFluidNeighbours(x, y, z);
    if (!this.creative) {
      const drops = d.hardness === 0 && !d.drops && d.plant ? [] : dropsFor(id, Math.random, harvest || d.tier === 0);
      for (const [did, n] of drops) g.entities.spawnItem(x + 0.5, y + 0.4, z + 0.5, { id: did, count: n }, (Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2, 0.5);
      if (d.hardness > 0) {
        this.exhaustion += 0.005;
        const broke = g.inventory.damageHeld(1);
        if (broke) { g.audio.play('break_tool'); g.ui.toastSimple('Your tool broke!'); }
      }
    }
    g.onBlockBroken(id, x, y, z);
  }

  attack(mob) {
    const g = this.game;
    const held = g.inventory.held();
    const hd = held ? DEFS[held.id] : null;
    let dmg = hd && hd.damage ? hd.damage : 1;
    const crit = !this.onGround && this.vy < -0.1 && !this.inWater && !this.flying;
    if (crit) dmg *= 1.5;
    const dx = mob.x - this.x, dz = mob.z - this.z, l = Math.hypot(dx, dz) || 1;
    this.swing();
    this.attackCd = 0.45;
    g.audio.play('hit', { pos: [mob.x, mob.y + 1, mob.z] });
    if (crit) { g.audio.play('crit'); g.particles.crit(mob.x, mob.y + mob.h * 0.8, mob.z, 10); }
    mob.hurt(dmg, (dx / l) * (this.sprinting ? 1.5 : 1), (dz / l) * (this.sprinting ? 1.5 : 1), true);
    this.exhaustion += 0.1;
    if (!this.creative && hd && hd.durability) {
      const broke = g.inventory.damageHeld(hd.tool === 'sword' ? 1 : 2);
      if (broke) { g.audio.play('break_tool'); g.ui.toastSimple('Your tool broke!'); }
    }
  }

  finishEating(held, hd) {
    const g = this.game;
    this.eatT = 0;
    this.hunger = Math.min(20, this.hunger + hd.food[0]);
    this.saturation = Math.min(this.hunger, this.saturation + hd.food[1]);
    if (hd.rotten && Math.random() < 0.8) { this.hunger = Math.max(0, this.hunger - 2); g.ui.toastSimple('That tasted terrible…'); }
    g.audio.play('burp', { vol: 0.5 });
    if (!this.creative) g.inventory.decrementHeld();
    g.onAte(held.id);
  }

  // right click: interact with block entities, beds, or place a block
  useOrPlace(isClick) {
    const g = this.game, w = g.world, t = this.target;
    const held = g.inventory.held();
    const hd = held ? DEFS[held.id] : null;
    if (t) {
      const td = DEFS[t.id];
      if (td.ui && !this.sneaking && isClick) { g.interactBlock(t); return; }
      // flint and steel -> TNT
      if (held && held.id === I.FLINT_STEEL && isClick) {
        if (t.id === B.TNT) {
          w.setBlock(t.x, t.y, t.z, 0);
          g.entities.spawnTNT(t.x, t.y, t.z, 4);
          g.audio.play('ignite');
          this.swing();
          if (!this.creative && g.inventory.damageHeld(1)) g.audio.play('break_tool');
        } else { g.audio.play('ignite', { vol: 0.5 }); this.swing(); }
        return;
      }
      if (held && held.id === I.BONE_MEAL && isClick) { g.useBoneMeal(t); return; }
      if (!held || held.id >= 256 || !hd || hd.kind !== 'block') return;
      this.placeBlock(t, held, hd);
    }
  }

  placeBlock(t, held, hd) {
    const g = this.game, w = g.world;
    if (hd.hidden) return;
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    const targetDef = DEFS[t.id];
    if (targetDef.replaceable && !LIQUID[t.id]) { px = t.x; py = t.y; pz = t.z; }
    if (py < 0 || py >= CH) return;
    const cur = w.getBlock(px, py, pz);
    const cd = DEFS[cur];
    if (cur !== 0 && !LIQUID[cur] && !(cd && cd.replaceable)) return;
    const id = held.id;
    // geometry checks
    if (SOLID[id] || DEFS[id].shape === 6) {
      if (px + 1 > this.x - this.hw && px < this.x + this.hw && pz + 1 > this.z - this.hw && pz < this.z + this.hw && py + 1 > this.y && py < this.y + this.height) return;
      for (const m of g.mobs.mobs) {
        if (m.dying > 0) continue;
        if (px + 1 > m.x - m.hw && px < m.x + m.hw && pz + 1 > m.z - m.hw && pz < m.z + m.hw && py + 1 > m.y && py < m.y + m.h) return;
      }
    }
    const below = w.getBlock(px, py - 1, pz);
    let meta;
    if (DEFS[id].plant) {
      if (id === B.DEAD_BUSH) { if (below !== B.SAND && below !== B.DIRT && below !== B.GRASS) return; }
      else if (!(below === B.GRASS || below === B.DIRT || below === B.SNOW_GRASS)) return;
    }
    if (id === B.CACTUS && !(below === B.SAND || below === B.CACTUS)) return;
    if (id === B.TORCH) {
      if (t.ny === -1) return;
      if (t.ny === 1) meta = 0;
      else meta = t.nx === 1 ? 1 : t.nx === -1 ? 2 : t.nz === 1 ? 3 : 4;
      const att = meta === 0 ? [0, -1, 0] : meta === 1 ? [-1, 0, 0] : meta === 2 ? [1, 0, 0] : meta === 3 ? [0, 0, -1] : [0, 0, 1];
      const ab = w.getBlock(px + att[0], py + att[1], pz + att[2]);
      if (!SOLID[ab] || SHAPE[ab] === S_CROSS) return;
    }
    if (DEFS[id].facing) {
      const sx = Math.sin(this.yaw), cz = Math.cos(this.yaw);
      meta = Math.abs(sx) > Math.abs(cz) ? (sx > 0 ? 1 : 3) : (cz > 0 ? 2 : 0);
    }
    w.setBlock(px, py, pz, id, meta);
    g.audio.blockSound(id, 'place', [px + 0.5, py + 0.5, pz + 0.5], 1);
    this.swing();
    this.placeCd = 0.22;
    if (!this.creative) g.inventory.decrementHeld();
    g.onBlockPlaced(id, px, py, pz);
  }
}
