import * as THREE from 'three';
import { moveEntity, applyGravity, collides } from './physics.js';
import { BLOCKS, B, I, getDef, isBlock, blockDrop } from './blocks.js';
import { itemGeometry } from './drops.js';

const EYE = 1.62, EYE_SNEAK = 1.35;

export class Player {
  constructor(game) {
    this.g = game;
    this.pos = { x: 0, y: 80, z: 0 }; this.vel = { x: 0, y: 0, z: 0 };
    this.w = 0.3; this.h = 1.8; this.yaw = 0; this.pitch = 0;
    this.hp = 20; this.food = 20; this.saturation = 5; this.air = 10; this.alive = true;
    this.onGround = false; this.inWater = false; this.inLava = false; this.onLadder = false;
    this.flying = false; this.sprinting = false; this.sneaking = false; this.underwater = false; this.sheltered = false;
    this.fallStart = null; this.breaking = null; this.breakProgress = 0; this.placeCd = 0; this.attackCd = 0; this.hurtCd = 0;
    this.hungerTimer = 0; this.regenTimer = 0; this.damageFlash = 0; this.eyeH = EYE; this.bob = 0; this.lastJumpTap = 0;
    this.target = null; this.xp = 0; this.level = 0; this.stats = { mined: 0, placed: 0, kills: 0, deaths: 0, crafted: 0 };
    this.camera = game.camera;
    this.buildViewObjects();
  }
  buildViewObjects() {
    const scene = this.g.scene;
    // selection outline
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.outline = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: true }));
    this.outline.visible = false; scene.add(this.outline);
    // crack overlay
    this.crackTex = [];
    for (let s = 0; s < 8; s++) {
      const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = 'rgba(0,0,0,0.75)';
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < (s + 1) * 5; i++) { const x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16); const l = 1 + Math.floor(rnd() * 3); if (rnd() < 0.5) ctx.fillRect(x, y, l, 1); else ctx.fillRect(x, y, 1, l); }
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; this.crackTex.push(t);
    }
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.crack.visible = false; scene.add(this.crack);
    // held item view
    this.heldGroup = new THREE.Group(); this.camera.add(this.heldGroup);
    this.heldMesh = null; this.heldId = -1; this.swing = 0;
    this.handMat = new THREE.MeshBasicMaterial({ map: this.g.atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0xd9a37a }));
  }

  get eye() { return { x: this.pos.x, y: this.pos.y + this.eyeH, z: this.pos.z }; }
  get dir() { const cp = Math.cos(this.pitch); return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
  get heldItem() { return this.g.inventory.held; }
  get heldDef() { const h = this.heldItem; return h ? getDef(h.id) : null; }

  setPosition(x, y, z) { this.pos.x = x; this.pos.y = y; this.pos.z = z; this.vel.x = this.vel.y = this.vel.z = 0; this.fallStart = null; }

  // ---------- main update ----------
  update(dt, input) {
    const g = this.g, world = g.world;
    if (!world.isLoaded(this.pos.x, this.pos.z)) { this.updateCamera(dt); return; }
    if (!this.alive) { this.updateCamera(dt); return; }
    const creative = g.mode === 'creative';
    this.placeCd -= dt; this.attackCd -= dt; this.hurtCd -= dt; this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
    this.sneaking = input.keys.ControlLeft || input.keys.KeyC;
    const wantSprint = (input.keys.ShiftLeft || input.keys.ShiftRight) && input.keys.KeyW && this.food > 6 && !this.sneaking;
    this.sprinting = wantSprint;
    // movement input
    let fx = 0, fz = 0;
    if (input.keys.KeyW) fz -= 1; if (input.keys.KeyS) fz += 1; if (input.keys.KeyA) fx -= 1; if (input.keys.KeyD) fx += 1;
    const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = fx * cos - fz * sin, mz = fx * sin + fz * cos;
    let speed = 4.3 * (this.sprinting ? 1.35 : 1) * (this.sneaking ? 0.35 : 1);
    if (this.flying && creative) {
      speed = 11 * (this.sprinting ? 2 : 1);
      this.vel.x += (mx * speed - this.vel.x) * Math.min(1, 10 * dt); this.vel.z += (mz * speed - this.vel.z) * Math.min(1, 10 * dt);
      let vy = 0; if (input.keys.Space) vy = speed * 0.8; if (this.sneaking) vy = -speed * 0.8;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 10 * dt);
      moveEntity(world, this, dt);
      if (this.onGround && !input.keys.Space && this.vel.y <= 0 && !this.sneaking) { /* stay flying */ }
    } else {
      const inFluid = this.inWater || this.inLava;
      const control = this.onGround ? 1 : (inFluid ? 0.6 : 0.25);
      const accel = inFluid ? 5 : 14;
      if (inFluid) speed *= 0.55;
      const targetX = mx * speed, targetZ = mz * speed;
      const slippery = this.onGround && BLOCKS[world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z))].slippery;
      const k = Math.min(1, accel * control * dt * (slippery ? 0.12 : 1));
      this.vel.x += (targetX - this.vel.x) * k; this.vel.z += (targetZ - this.vel.z) * k;
      if (!this.onGround && !inFluid && !(mx || mz)) { this.vel.x *= Math.pow(0.9, dt * 60); this.vel.z *= Math.pow(0.9, dt * 60); }
      // jump / swim / climb
      if (input.keys.Space) {
        if (inFluid) this.vel.y = Math.min(this.vel.y + 24 * dt, 3.5);
        else if (this.onLadder) this.vel.y = 3;
        else if (this.onGround) { this.vel.y = 8.6; this.onGround = false; if (this.sprinting) { this.vel.x += mx * 1.5; this.vel.z += mz * 1.5; } }
      } else if (this.onLadder && !this.sneaking) { /* slide slowly */ }
      if (this.onLadder && this.sneaking) this.vel.y = 0;
      if (this.onLadder && (mx || mz) && this.hitWall) this.vel.y = 2.5;
      // sneaking: don't walk off edges
      if (this.sneaking && this.onGround) {
        const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
        if (!collides(world, nx, this.pos.y - 0.1, this.pos.z, this.w, 0.1) && !this.groundBelow(nx, this.pos.z)) this.vel.x = 0;
        if (!collides(world, this.pos.x, this.pos.y - 0.1, nz, this.w, 0.1) && !this.groundBelow(this.pos.x, nz)) this.vel.z = 0;
      }
      applyGravity(this, dt);
      const wasInWater = this.inWater, vy = this.vel.y;
      const prevOnGround = this.onGround;
      moveEntity(world, this, dt);
      if (this.inWater && !wasInWater && vy < -4) { g.audio.splash(); g.particles.burst(this.pos.x, this.pos.y + 0.5, this.pos.z, [0.6, 0.75, 1], 14, 3, 0.5, 0.1); }
      // fall damage
      if (!this.onGround && !this.inWater && !this.onLadder) { if (this.fallStart === null || this.pos.y > this.fallStart) this.fallStart = this.pos.y; }
      if (this.onGround && !prevOnGround && this.fallStart !== null) {
        const fall = this.fallStart - this.pos.y;
        if (fall > 3.5 && !creative && !this.inWater) this.damage(Math.floor(fall - 3), 'fall');
        if (fall > 1.2) { const b = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z)); g.audio.blockSound('hit', b); }
        this.fallStart = null;
      }
      if (this.onGround || this.inWater || this.onLadder) this.fallStart = this.inWater ? null : this.fallStart;
      if (this.inWater) this.fallStart = null;
      if (this.flying && !creative) this.flying = false;
      // footsteps
      if (this.onGround && (Math.abs(this.vel.x) > 1 || Math.abs(this.vel.z) > 1)) {
        this.bob += dt * (this.sprinting ? 12 : 9);
        const b = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
        if (b) g.audio.step(b, this.sprinting);
      } else this.bob *= 0.9;
    }
    // survival stats
    if (!creative) this.updateSurvival(dt);
    // environment awareness
    const hx = Math.floor(this.pos.x), hz = Math.floor(this.pos.z);
    this.underwater = world.getBlock(hx, Math.floor(this.pos.y + this.eyeH), hz) === B.WATER;
    this.sheltered = world.getSky(hx, Math.floor(this.pos.y + 1), hz) < 15;
    g.audio.setUnderwater(this.underwater);
    // targeting & actions
    this.updateTarget();
    this.handleActions(dt, input);
    this.updateCamera(dt);
    this.updateHeld(dt);
  }
  groundBelow(x, z) { return collides(this.g.world, x, this.pos.y - 0.6, z, this.w, 0.5); }

  updateSurvival(dt) {
    const g = this.g, world = g.world;
    // hunger
    const exertion = this.sprinting ? 4 : (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.5 ? 1.2 : 0.6);
    this.hungerTimer += dt * exertion;
    if (this.hungerTimer > 40) { this.hungerTimer = 0; if (this.saturation > 0) this.saturation--; else this.food = Math.max(0, this.food - 1); }
    // regen / starve
    this.regenTimer += dt;
    if (this.food >= 18 && this.hp < 20 && this.regenTimer > 3) { this.regenTimer = 0; this.hp = Math.min(20, this.hp + 1); this.hungerTimer += 6; }
    if (this.food <= 0 && this.regenTimer > 4) { this.regenTimer = 0; if (this.hp > 1) this.damage(1, 'starve'); }
    // breathing
    if (this.underwater) { this.airTimer = (this.airTimer || 0) + dt; if (this.airTimer > 1) { this.airTimer = 0; if (this.air > 0) this.air--; else this.damage(2, 'drown'); } }
    else { this.air = Math.min(10, this.air + dt * 4); }
    // hazards
    if (this.inLava) { this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.damage(4, 'lava'); } }
    const cact = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => world.getBlock(Math.floor(this.pos.x + dx * 0.35), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z + dz * 0.35)) === B.CACTUS);
    if (cact) { this.cactT = (this.cactT || 0) + dt; if (this.cactT > 0.6) { this.cactT = 0; this.damage(1, 'cactus'); } }
    if (this.pos.y < -5) this.damage(4, 'void');
  }

  damage(amount, cause, from) {
    if (!this.alive || amount <= 0) return;
    if (this.g.mode === 'creative' && cause !== 'void') return;
    if (this.hurtCd > 0 && cause === 'mob') return;
    this.hurtCd = 0.5; this.hp -= amount; this.damageFlash = 1;
    this.g.audio.hurt();
    if (from && from.pos) { const dx = this.pos.x - from.pos.x, dz = this.pos.z - from.pos.z; const d = Math.hypot(dx, dz) || 1; this.vel.x += dx / d * 6; this.vel.z += dz / d * 6; this.vel.y = Math.max(this.vel.y, 4); }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.stats.deaths++; this.g.onDeath(cause); }
    this.g.ui.updateStats();
  }
  eat(def) {
    if (this.food >= 20) return false;
    this.food = Math.min(20, this.food + def.food); this.saturation = Math.min(10, this.saturation + def.food * 0.6);
    this.g.audio.eat(); this.g.inventory.consumeHeld(1); this.g.ui.updateStats(); this.placeCd = 0.6;
    return true;
  }
  respawn() {
    this.hp = 20; this.food = 20; this.saturation = 5; this.air = 10; this.alive = true; this.breaking = null; this.fallStart = null;
    const s = this.g.spawn; this.setPosition(s.x, s.y + 0.5, s.z); this.flying = false;
  }

  // ---------- interaction ----------
  updateTarget() {
    const reach = this.g.mode === 'creative' ? 6 : 4.8;
    const eye = this.eye, d = this.dir;
    const origin = new THREE.Vector3(eye.x, eye.y, eye.z);
    const hit = this.g.world.raycast(origin, d, reach);
    const mobHit = this.g.mobs.raycast(origin, d, hit ? hit.dist : reach);
    this.targetMob = mobHit ? mobHit.mob : null;
    this.target = (mobHit ? null : hit);
    if (this.target) { this.outline.visible = true; this.outline.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5); }
    else this.outline.visible = false;
  }
  handleActions(dt, input) {
    const g = this.g, world = g.world, inv = g.inventory;
    const creative = g.mode === 'creative';
    // --- break / attack ---
    if (input.mouse.left) {
      if (this.targetMob) {
        if (this.attackCd <= 0) {
          this.attackCd = 0.45; this.swing = 1; g.audio.swing();
          const hd = this.heldDef; const dmg = hd && hd.damage ? hd.damage : 1;
          const killed = g.mobs.hurt(this.targetMob, dmg, this.pos, world, hd && hd.tool === 'sword' ? 8 : 5);
          if (hd && hd.durability) inv.damageHeld(hd.tool === 'sword' ? 1 : 2);
          if (killed) { this.stats.kills++; this.addXp(this.targetMob.T.hostile ? 5 : 1); }
        }
        this.breaking = null; this.crack.visible = false;
      } else if (this.target) {
        const t = this.target, def = BLOCKS[t.block];
        if (this.swing <= 0.2) this.swing = 1;
        if (!this.breaking || this.breaking.x !== t.x || this.breaking.y !== t.y || this.breaking.z !== t.z) { this.breaking = { x: t.x, y: t.y, z: t.z }; this.breakProgress = 0; }
        if (creative) {
          if (this.attackCd <= 0) { this.attackCd = 0.2; this.breakBlock(t, true); }
        } else if (def.hard !== Infinity) {
          const hd = this.heldDef;
          const toolMatch = hd && hd.tool && hd.tool === def.tool;
          let speed = toolMatch ? hd.speed : 1;
          if (hd && hd.tool === 'sword' && (t.block === B.LEAVES || t.block === B.TALL_GRASS)) speed = 3;
          const lacksTool = def.tool && def.minTier > 0 && (!toolMatch || hd.tier < def.minTier);
          let time = def.hard / speed * (lacksTool ? 3.3 : 1);
          if (this.inWater) time *= 3; if (!this.onGround && !this.inWater) time *= 1.5;
          this.breakProgress += dt / time;
          this.hitTimer = (this.hitTimer || 0) + dt;
          if (this.hitTimer > 0.22) { this.hitTimer = 0; g.audio.blockSound('hit', t.block); g.particles.blockHit(t.x, t.y, t.z, t.face, t.block, this.lightAt(t.x + t.face[0], t.y + t.face[1], t.z + t.face[2])); }
          this.crack.visible = true; this.crack.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
          this.crack.material.map = this.crackTex[Math.min(7, Math.floor(this.breakProgress * 8))];
          if (this.breakProgress >= 1) { this.breakBlock(t, false, lacksTool); this.breaking = null; this.crack.visible = false; }
        }
      } else { this.breaking = null; this.crack.visible = false; if (this.swing <= 0 && this.attackCd <= 0) { this.swing = 1; this.attackCd = 0.3; } }
    } else { this.breaking = null; this.breakProgress = 0; this.crack.visible = false; }
    // --- place / use ---
    if (input.mouse.right && this.placeCd <= 0) {
      const held = this.heldItem, hd = this.heldDef;
      if (this.target) {
        const t = this.target;
        // interact with stations
        if (!this.sneaking && (t.block === B.CRAFTING_TABLE || t.block === B.FURNACE)) { g.ui.openInventory(t.block === B.CRAFTING_TABLE ? 'table' : 'furnace'); this.placeCd = 0.3; input.mouse.right = false; return; }
        if (held && isBlock(held.id)) {
          const px = t.x + t.face[0], py = t.y + t.face[1], pz = t.z + t.face[2];
          this.tryPlace(px, py, pz, held.id, t);
          this.placeCd = 0.22;
        } else if (hd && hd.food) { if (this.eat(hd)) this.swing = 1; this.placeCd = 0.6; }
        else this.placeCd = 0.2;
      } else if (hd && hd.food) { if (this.eat(hd)) this.swing = 1; this.placeCd = 0.6; }
      else if (held && isBlock(held.id)) {
        // placing on water surface: target water block
        const eye = this.eye; const hit = world.raycast(new THREE.Vector3(eye.x, eye.y, eye.z), this.dir, 4.8, true);
        if (hit && BLOCKS[hit.block].liquid) { this.tryPlace(hit.x, hit.y, hit.z, held.id, hit, true); this.placeCd = 0.22; }
      }
    }
  }
  lightAt(x, y, z) { const w = this.g.world; return Math.max(0.15, Math.max(w.getSky(x, y, z) / 15 * this.g.env.daylight, w.getLight(x, y, z) / 15)); }
  tryPlace(px, py, pz, id, t, replacing = false) {
    const g = this.g, world = g.world, def = BLOCKS[id];
    const existing = world.getBlock(px, py, pz);
    if (!replacing && existing !== B.AIR && !BLOCKS[existing].liquid && BLOCKS[existing].shape !== 'cross') return;
    if (BLOCKS[existing].shape === 'cross' && BLOCKS[existing].solid) return;
    // support rules
    if (def.shape === 'cross' && id !== B.TORCH && id !== B.FENCE && id !== B.LADDER) { const below = world.getBlock(px, py - 1, pz); if (![B.GRASS, B.DIRT, B.SNOW_GRASS, B.SAND].includes(below)) return; }
    if (id === B.TORCH || id === B.LADDER) { const anySolid = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.isSolid(px + a, py + b, pz + c)); if (!anySolid) return; }
    if (def.solid) {
      if (collides({ getBlock: (x, y, z) => (x === px && y === py && z === pz) ? id : B.AIR }, this.pos.x, this.pos.y, this.pos.z, this.w, this.h)) return;
      for (const m of g.mobs.list) if (collides({ getBlock: (x, y, z) => (x === px && y === py && z === pz) ? id : B.AIR }, m.pos.x, m.pos.y, m.pos.z, m.w, m.h)) return;
    }
    if (!world.setBlock(px, py, pz, id)) return;
    g.audio.blockSound('place', id); this.swing = 1; this.stats.placed++;
    if (g.mode !== 'creative') g.inventory.consumeHeld(1);
    void t;
  }
  breakBlock(t, creative, lacksTool) {
    const g = this.g, world = g.world;
    const id = t.block, def = BLOCKS[id];
    world.setBlock(t.x, t.y, t.z, B.AIR);
    g.audio.blockSound('break', id);
    g.particles.blockBreak(t.x, t.y, t.z, id, 22, this.lightAt(t.x + t.face[0], t.y + t.face[1], t.z + t.face[2]));
    this.stats.mined++;
    if (!creative) {
      if (!lacksTool) { const drop = blockDrop(id, Math.random); if (drop !== null) g.drops.spawn(t.x + 0.5, t.y + 0.3, t.z + 0.5, drop, 1); }
      const hd = this.heldDef; if (hd && hd.durability && hd.tool !== 'sword' && def.hard > 0.1) g.inventory.damageHeld(1);
      if (id === B.COAL_ORE || id === B.DIAMOND_ORE || id === B.IRON_ORE || id === B.GOLD_ORE) this.addXp(id === B.DIAMOND_ORE ? 6 : 2);
    }
    // gravity blocks above fall
    const above = world.getBlock(t.x, t.y + 1, t.z);
    if (above === B.SAND || above === B.GRAVEL) this.g.scheduleFall(t.x, t.y + 1, t.z);
    // plants on top break
    if (BLOCKS[above].shape === 'cross' && above !== B.TORCH && above !== B.LADDER && above !== B.FENCE) { world.setBlock(t.x, t.y + 1, t.z, B.AIR); const d = blockDrop(above, Math.random); if (d !== null && !creative) g.drops.spawn(t.x + 0.5, t.y + 1.3, t.z + 0.5, d, 1); }
    if (above === B.CACTUS) { world.setBlock(t.x, t.y + 1, t.z, B.AIR); if (!creative) g.drops.spawn(t.x + 0.5, t.y + 1.3, t.z + 0.5, B.CACTUS, 1); }
  }
  addXp(n) { this.xp += n; const need = 7 + this.level * 3; if (this.xp >= need) { this.xp -= need; this.level++; this.g.audio.levelUp(); this.g.ui.message(`Level ${this.level}!`); } this.g.ui.updateStats(); }
  dropHeld() {
    const held = this.heldItem; if (!held) return;
    const d = this.dir; const e = this.eye;
    this.g.drops.spawn(e.x + d.x * 0.5, e.y - 0.3, e.z + d.z * 0.5, held.id, 1, { x: d.x * 6, y: d.y * 6 + 2, z: d.z * 6 });
    const s = this.g.inventory.held; if (s.dur !== undefined) this.g.drops.list[this.g.drops.list.length - 1].dur = s.dur;
    this.g.inventory.consumeHeld(1);
  }

  // ---------- camera & hand ----------
  updateCamera(dt) {
    const targetEye = this.sneaking && !this.flying ? EYE_SNEAK : EYE;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 15);
    const bobY = Math.sin(this.bob * 2) * 0.03 * (this.onGround ? 1 : 0), bobX = Math.cos(this.bob) * 0.025 * (this.onGround ? 1 : 0);
    this.camera.position.set(this.pos.x + bobX * Math.cos(this.yaw), this.pos.y + this.eyeH + bobY, this.pos.z + bobX * Math.sin(this.yaw));
    this.camera.rotation.set(0, 0, 0, 'YXZ'); this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.damageFlash > 0.5 ? (this.damageFlash - 0.5) * 0.1 : 0;
    const targetFov = this.g.settings.fov * (this.sprinting ? 1.12 : 1) * (this.flying && this.sprinting ? 1.1 : 1);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix();
  }
  updateHeld(dt) {
    const held = this.heldItem; const id = held ? held.id : 0;
    if (id !== this.heldId) {
      this.heldId = id;
      if (this.heldMesh) this.heldGroup.remove(this.heldMesh);
      if (id) {
        const d = getDef(id);
        this.heldMesh = new THREE.Mesh(itemGeometry(id), this.handMat.clone());
        if (d.tint) this.heldMesh.material.color.setRGB(...d.tint);
        if (id < 100 && d.shape === 'cube') { this.heldMesh.scale.setScalar(0.35); this.heldMesh.rotation.set(0.1, -0.6, 0); }
        else { this.heldMesh.scale.setScalar(0.5); this.heldMesh.rotation.set(0, -0.3, 0.45); if (id >= 100 && d.tool) this.heldMesh.rotation.set(0.3, -0.5, 0.9); }
      } else { this.heldMesh = this.armMesh; this.heldMesh.rotation.set(-0.3, 0.4, 0.2); }
      this.heldGroup.add(this.heldMesh);
      this.swapAnim = 1;
    }
    this.swing = Math.max(0, this.swing - dt * 4); this.swapAnim = Math.max(0, (this.swapAnim || 0) - dt * 4);
    const s = Math.sin(this.swing * Math.PI);
    const bobY = Math.sin(this.bob * 2) * 0.015, bobX = Math.cos(this.bob) * 0.015;
    const isCube = id && id < 100 && BLOCKS[id].shape === 'cube';
    this.heldGroup.position.set(0.42 + bobX - s * 0.25, -0.38 + bobY - s * 0.2 - this.swapAnim * 0.5, -0.7 + s * 0.1);
    this.heldGroup.rotation.set(-s * 1.1, s * 0.5, isCube ? 0 : -s * 0.3);
    // local light tint
    const l = this.lightAt(Math.floor(this.pos.x), Math.floor(this.pos.y + 1), Math.floor(this.pos.z));
    if (this.heldMesh && this.heldMesh !== this.armMesh) { const d = getDef(id); const t = d.tint || [1, 1, 1]; this.heldMesh.material.color.setRGB(t[0] * l, t[1] * l, t[2] * l); }
  }
  serialize() { return { pos: this.pos, yaw: this.yaw, pitch: this.pitch, hp: this.hp, food: this.food, saturation: this.saturation, xp: this.xp, level: this.level, stats: this.stats, flying: this.flying }; }
  load(d) { if (!d) return; Object.assign(this.pos, d.pos); this.yaw = d.yaw || 0; this.pitch = d.pitch || 0; this.hp = d.hp ?? 20; this.food = d.food ?? 20; this.saturation = d.saturation ?? 5; this.xp = d.xp || 0; this.level = d.level || 0; if (d.stats) this.stats = d.stats; this.flying = !!d.flying; this.alive = this.hp > 0; }
}
void I;
