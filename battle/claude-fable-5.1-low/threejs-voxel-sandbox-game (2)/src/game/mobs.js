import * as THREE from 'three';
import { moveEntity, applyGravity } from './physics.js';
import { B, I } from './blocks.js';

const TYPES = {
  pig: { hp: 10, w: 0.4, h: 0.9, speed: 1.6, hostile: false, body: [0.9, 0.6, 0.6], head: [0.5, 0.5, 0.5], legs: 0.35, colors: { body: 0xf0a0a8, head: 0xf0a0a8, leg: 0xe08890, face: 0xd07880 }, drops: [[I.PORKCHOP_RAW, 1, 3]], sound: 'pig' },
  sheep: { hp: 8, w: 0.45, h: 1.2, speed: 1.4, hostile: false, body: [0.9, 0.8, 0.7], head: [0.4, 0.45, 0.45], legs: 0.5, colors: { body: 0xeeeeee, head: 0xc8b8a8, leg: 0xc8b8a8, face: 0x8a7a6a }, drops: [[I.MUTTON_RAW, 1, 2], [B.WOOL, 1, 2]], sound: 'sheep' },
  chicken: { hp: 4, w: 0.25, h: 0.7, speed: 1.5, hostile: false, body: [0.4, 0.4, 0.55], head: [0.25, 0.4, 0.25], legs: 0.3, colors: { body: 0xf5f5f5, head: 0xf5f5f5, leg: 0xe0a040, face: 0xd03030 }, drops: [[I.CHICKEN_RAW, 1, 1], [I.FEATHER, 0, 2]], sound: 'chicken' },
  zombie: { hp: 20, w: 0.3, h: 1.9, speed: 2.4, hostile: true, body: [0.55, 0.8, 0.3], head: [0.5, 0.5, 0.5], legs: 0.75, humanoid: true, colors: { body: 0x3b8a9c, head: 0x5a9c5a, leg: 0x3a3a8a, face: 0x203020 }, drops: [[I.ROTTEN_FLESH, 0, 2]], damage: 3, sound: 'zombie' },
  skeleton: { hp: 16, w: 0.3, h: 1.9, speed: 2.0, hostile: true, ranged: true, body: [0.45, 0.8, 0.25], head: [0.5, 0.5, 0.5], legs: 0.75, humanoid: true, colors: { body: 0xd8d8d8, head: 0xe8e8e8, leg: 0xcacaca, face: 0x303030 }, drops: [[I.STICK, 0, 2], [I.COAL, 0, 1]], damage: 2, sound: 'skeleton' },
  spider: { hp: 14, w: 0.6, h: 0.8, speed: 2.8, hostile: true, body: [1.1, 0.5, 1.2], head: [0.6, 0.5, 0.6], legs: 0.3, colors: { body: 0x2a2a2a, head: 0x3a2a2a, leg: 0x222222, face: 0xc02020 }, drops: [[I.STICK, 0, 1]], damage: 2, sound: 'spider', canClimb: true },
};

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  return m;
}

export class Mobs {
  constructor(scene, audio, particles, drops) {
    this.scene = scene; this.audio = audio; this.particles = particles; this.drops = drops;
    this.list = []; this.spawnTimer = 0; this.arrows = [];
  }
  spawn(type, x, y, z, hp) {
    const T = TYPES[type];
    const g = new THREE.Group();
    const parts = {};
    const bodyY = T.legs + T.body[1] / 2;
    parts.body = box(...T.body, T.colors.body); parts.body.position.y = bodyY; g.add(parts.body);
    const head = box(...T.head, T.colors.head);
    if (T.humanoid) head.position.set(0, T.legs + T.body[1] + T.head[1] / 2, 0);
    else head.position.set(0, bodyY + T.body[1] * 0.3, -(T.body[2] / 2 + T.head[2] / 2 - 0.1));
    // eyes / face
    const eye = box(T.head[0] * 0.2, T.head[1] * 0.15, 0.02, T.colors.face);
    eye.position.set(-T.head[0] * 0.25, T.head[1] * 0.1, -T.head[2] / 2 - 0.01); head.add(eye);
    const eye2 = eye.clone(); eye2.position.x = T.head[0] * 0.25; head.add(eye2);
    if (type === 'pig') { const snout = box(0.25, 0.15, 0.08, 0xe09098); snout.position.set(0, -0.08, -T.head[2] / 2 - 0.04); head.add(snout); }
    if (type === 'chicken') { const beak = box(0.12, 0.08, 0.1, 0xe0a040); beak.position.set(0, -0.02, -T.head[2] / 2 - 0.05); head.add(beak); }
    parts.head = head; g.add(head);
    parts.legs = [];
    const legW = T.humanoid ? T.body[0] / 2 - 0.02 : Math.min(0.25, T.body[0] / 3);
    const legPositions = T.humanoid ? [[-T.body[0] / 4, 0], [T.body[0] / 4, 0]] :
      type === 'chicken' ? [[-0.1, 0], [0.1, 0]] :
      [[-T.body[0] / 2 + legW / 2, -T.body[2] / 2 + legW / 2], [T.body[0] / 2 - legW / 2, -T.body[2] / 2 + legW / 2], [-T.body[0] / 2 + legW / 2, T.body[2] / 2 - legW / 2], [T.body[0] / 2 - legW / 2, T.body[2] / 2 - legW / 2]];
    if (type === 'spider') legPositions.push([-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]);
    for (const [lx, lz] of legPositions) {
      const leg = box(legW, T.legs, legW, T.colors.leg);
      leg.geometry.translate(0, -T.legs / 2, 0);
      leg.position.set(lx, T.legs, lz); g.add(leg); parts.legs.push(leg);
    }
    if (T.humanoid) {
      for (const s of [-1, 1]) { const arm = box(0.22, 0.75, 0.22, T.colors.head); arm.geometry.translate(0, -0.3, -0.05); arm.position.set(s * (T.body[0] / 2 + 0.12), T.legs + T.body[1] - 0.1, 0); arm.rotation.x = -Math.PI / 2 + 0.2; g.add(arm); }
    }
    g.position.set(x, y, z);
    this.scene.add(g);
    const mob = {
      type, T, pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, w: T.w, h: T.h, hp: hp ?? T.hp, maxHp: T.hp, yaw: Math.random() * Math.PI * 2,
      mesh: g, parts, state: 'idle', timer: Math.random() * 3, moveT: 0, flash: 0, onGround: false, canStep: true, age: 0, attackCd: 0, hurtCd: 0, soundT: Math.random() * 10 + 5, inWater: false,
    };
    this.list.push(mob);
    return mob;
  }

  update(dt, world, player, env, gameMode) {
    const day = env.daylight;
    // spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 1.2; this.trySpawn(world, player, env, gameMode); }
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i]; const T = m.T;
      m.age += dt;
      const dx = px - m.pos.x, dz = pz - m.pos.z, dy = py - m.pos.y;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 72) { this.remove(i); continue; }
      if (!world.isLoaded(m.pos.x, m.pos.z)) continue;
      if (dist > 40 && m.age > 2 && Math.random() < 0.002) { this.remove(i); continue; }
      m.timer -= dt; m.attackCd -= dt; m.hurtCd -= dt; m.soundT -= dt;
      if (m.soundT <= 0 && dist < 20) { m.soundT = 6 + Math.random() * 14; this.audio.mob(m.type); }
      // sunlight burns undead
      if ((m.type === 'zombie' || m.type === 'skeleton') && day > 0.75 && m.age > 1) {
        const sk = world.getSky(Math.floor(m.pos.x), Math.floor(m.pos.y + 1), Math.floor(m.pos.z));
        if (sk >= 14 && !m.inWater && !env.raining) { m.burnT = (m.burnT || 0) + dt; if (m.burnT > 1) { m.burnT = 0; this.hurt(m, 2, null, world); if (Math.random() < 0.5) this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, [1, 0.5, 0.1], 4, 2, 0.5, 0.1); } }
      }
      // --- AI ---
      let wantX = 0, wantZ = 0, speed = T.speed;
      const canSeePlayer = dist < (T.ranged ? 20 : 24) && player.alive && gameMode !== 'creative';
      if (T.hostile && canSeePlayer) {
        m.state = 'chase';
        const ang = Math.atan2(dx, dz);
        m.yaw = ang;
        if (T.ranged) {
          if (dist > 10) { wantX = Math.sin(ang); wantZ = Math.cos(ang); }
          else if (dist < 5) { wantX = -Math.sin(ang); wantZ = -Math.cos(ang); speed *= 0.8; }
          if (m.attackCd <= 0 && dist < 16) { m.attackCd = 2.2; this.shoot(m, player); }
        } else {
          wantX = Math.sin(ang); wantZ = Math.cos(ang);
          if (dist < 1.6 && m.attackCd <= 0 && Math.abs(dy) < 2) { m.attackCd = 1.1; player.damage(T.damage, 'mob', m); }
        }
      } else if (m.state === 'flee') {
        const ang = Math.atan2(-dx, -dz); m.yaw = ang; wantX = Math.sin(ang); wantZ = Math.cos(ang); speed *= 1.6;
        if (m.timer <= 0) m.state = 'idle';
      } else {
        if (m.timer <= 0) {
          if (m.state === 'idle') { m.state = 'walk'; m.timer = 1 + Math.random() * 3; m.yaw = Math.random() * Math.PI * 2; }
          else { m.state = 'idle'; m.timer = 1 + Math.random() * 4; }
        }
        if (m.state === 'walk') { wantX = Math.sin(m.yaw); wantZ = Math.cos(m.yaw); speed *= 0.6; }
      }
      // cliff avoidance for walkers: don't walk off > 3 block drops
      if ((wantX || wantZ) && m.onGround && m.state !== 'chase') {
        const ax = Math.floor(m.pos.x + wantX * 0.8), az = Math.floor(m.pos.z + wantZ * 0.8);
        let drop = 0; for (let y = Math.floor(m.pos.y) - 1; y > Math.floor(m.pos.y) - 5; y--) { if (world.isSolid(ax, y, az)) break; drop++; }
        if (drop >= 4) { m.yaw += Math.PI / 2 + Math.random(); wantX = 0; wantZ = 0; m.timer = 0.3; }
      }
      // steering
      const accel = m.onGround ? 10 : 2;
      m.vel.x += (wantX * speed - m.vel.x) * Math.min(1, accel * dt);
      m.vel.z += (wantZ * speed - m.vel.z) * Math.min(1, accel * dt);
      if (m.hitWall && m.onGround && (wantX || wantZ)) m.vel.y = 8.5;
      if (m.inWater) { m.vel.y += 14 * dt; if (m.vel.y > 2) m.vel.y = 2; }
      applyGravity(m, dt);
      const prevY = m.vel.y;
      moveEntity(world, m, dt);
      if (m.onGround && prevY < -14) this.hurt(m, Math.floor((-prevY - 12) / 2), null, world);
      if (m.inLava) { this.hurt(m, 4, null, world); }
      // --- visuals ---
      m.mesh.position.set(m.pos.x, m.pos.y, m.pos.z);
      const moving = Math.hypot(m.vel.x, m.vel.z) > 0.2;
      if (moving) { m.yawVis = Math.atan2(m.vel.x, m.vel.z); m.moveT += dt * 8 * (T.hostile ? 1 : 1.2); }
      if (m.yawVis === undefined) m.yawVis = m.yaw;
      m.mesh.rotation.y = m.yawVis + Math.PI;
      const sw = moving ? Math.sin(m.moveT) * 0.6 : 0;
      m.parts.legs.forEach((l, k) => { l.rotation.x = sw * (k % 2 ? -1 : 1) * ((k >> 1) ? -1 : 1); });
      if (canSeePlayer && T.hostile) m.parts.head.rotation.x = Math.atan2(-(py + 1.6 - (m.pos.y + T.h - 0.25)), Math.hypot(dx, dz)) * 0.6;
      // lighting tint from local light
      const sk = world.getSky(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.5), Math.floor(m.pos.z)) / 15 * day;
      const bl = world.getLight(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.5), Math.floor(m.pos.z)) / 15;
      const lv = 0.1 + 0.9 * Math.max(sk, bl);
      if (m.flash > 0) m.flash -= dt;
      const target = m.flash > 0 ? 0.6 : 0;
      m.mesh.traverse(o => { if (o.isMesh) { o.material.emissive.setRGB(target, 0, 0); o.material.color.setScalar(lv); } });
    }
    // arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]; a.life -= dt;
      a.vel.y -= 9 * dt;
      a.pos.x += a.vel.x * dt; a.pos.y += a.vel.y * dt; a.pos.z += a.vel.z * dt;
      a.mesh.position.set(a.pos.x, a.pos.y, a.pos.z);
      a.mesh.lookAt(a.pos.x + a.vel.x, a.pos.y + a.vel.y, a.pos.z + a.vel.z);
      const hitPlayer = Math.abs(a.pos.x - px) < 0.5 && Math.abs(a.pos.z - pz) < 0.5 && a.pos.y > py && a.pos.y < py + 1.8;
      if (hitPlayer && player.alive) { player.damage(2, 'arrow', a); a.life = 0; }
      if (a.life <= 0 || world.isSolid(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z))) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
  }
  shoot(m, player) {
    const sx = m.pos.x, sy = m.pos.y + 1.4, sz = m.pos.z;
    const tx = player.pos.x, ty = player.pos.y + 1.2, tz = player.pos.z;
    const d = Math.hypot(tx - sx, ty - sy, tz - sz); const spd = 22;
    const vel = { x: (tx - sx) / d * spd, y: (ty - sy) / d * spd + d * 0.2, z: (tz - sz) / d * spd };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: 0xd0c8a0 }));
    this.scene.add(mesh);
    this.arrows.push({ pos: { x: sx, y: sy, z: sz }, vel, mesh, life: 3 });
    this.audio.mob('skeleton');
  }
  hurt(m, dmg, from, world, knock = 6) {
    if (m.hurtCd > 0) return false;
    m.hurtCd = 0.4; m.hp -= dmg; m.flash = 0.3;
    if (from) { const dx = m.pos.x - from.x, dz = m.pos.z - from.z; const d = Math.hypot(dx, dz) || 1; m.vel.x += dx / d * knock; m.vel.z += dz / d * knock; m.vel.y = 5; }
    if (!m.T.hostile) { m.state = 'flee'; m.timer = 4; }
    this.audio.hitMob();
    if (m.hp <= 0) {
      const idx = this.list.indexOf(m);
      this.particles.burst(m.pos.x, m.pos.y + m.h / 2, m.pos.z, [0.6, 0.1, 0.1], 18, 4, 0.7, 0.1);
      for (const [id, min, max] of m.T.drops) { const n = min + Math.floor(Math.random() * (max - min + 1)); if (n > 0) this.drops.spawn(m.pos.x, m.pos.y + 0.5, m.pos.z, id, n); }
      this.remove(idx);
      return true;
    }
    return false;
  }
  remove(i) { if (i < 0) return; const m = this.list[i]; this.scene.remove(m.mesh); m.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.list.splice(i, 1); }

  trySpawn(world, player, env, gameMode) {
    const passive = this.list.filter(m => !m.T.hostile).length, hostile = this.list.filter(m => m.T.hostile).length;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ang = Math.random() * Math.PI * 2, r = 24 + Math.random() * 28;
      const x = Math.floor(player.pos.x + Math.cos(ang) * r), z = Math.floor(player.pos.z + Math.sin(ang) * r);
      if (!world.isLoaded(x, z)) continue;
      // pick a y: either surface or a random cave pocket
      let y;
      if (Math.random() < 0.6) y = world.surfaceY(x, z) + 1;
      else { y = 8 + Math.floor(Math.random() * 50); if (!world.isSolid(x, y - 1, z) || world.getBlock(x, y, z) !== B.AIR || world.getBlock(x, y + 1, z) !== B.AIR) continue; }
      if (y < 2 || world.getBlock(x, y, z) !== B.AIR || world.getBlock(x, y + 1, z) !== B.AIR) continue;
      const ground = world.getBlock(x, y - 1, z);
      if (ground === B.WATER || ground === B.LAVA || ground === B.AIR) continue;
      const sky = world.getSky(x, y, z) / 15 * env.daylight, bl = world.getLight(x, y, z) / 15;
      const light = Math.max(sky, bl);
      if (light < 0.22 && hostile < 10 && gameMode !== 'creative') {
        const roll = Math.random();
        const type = roll < 0.5 ? 'zombie' : roll < 0.8 ? 'skeleton' : 'spider';
        this.spawn(type, x + 0.5, y + 0.01, z + 0.5);
        if (type !== 'spider' && Math.random() < 0.4) this.spawn(type, x + 1.5, y + 0.01, z + 0.5);
        return;
      }
      if (light > 0.6 && passive < 12 && (ground === B.GRASS || ground === B.SNOW_GRASS || ground === B.SAND)) {
        const roll = Math.random();
        const type = roll < 0.4 ? 'pig' : roll < 0.75 ? 'sheep' : 'chicken';
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) { const ox = (Math.random() - 0.5) * 3, oz = (Math.random() - 0.5) * 3; if (world.getBlock(Math.floor(x + ox), y, Math.floor(z + oz)) === B.AIR) this.spawn(type, x + 0.5 + ox, y + 0.01, z + 0.5 + oz); }
        return;
      }
    }
  }
  // find mob hit by a ray from origin along dir within maxDist
  raycast(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    for (const m of this.list) {
      // ray vs AABB
      const minX = m.pos.x - m.w, maxX = m.pos.x + m.w, minY = m.pos.y, maxY = m.pos.y + m.h, minZ = m.pos.z - m.w, maxZ = m.pos.z + m.w;
      let tmin = 0, tmax = bestT;
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z], mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-8) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } }
        else { let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a]; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { ok = false; break; } }
      }
      if (ok) { best = m; bestT = tmin; }
    }
    return best ? { mob: best, dist: bestT } : null;
  }
  serialize() { return this.list.map(m => ({ t: m.type, x: m.pos.x, y: m.pos.y, z: m.pos.z, hp: m.hp })); }
  load(arr) { for (const m of arr || []) if (TYPES[m.t]) this.spawn(m.t, m.x, m.y, m.z, m.hp); }
  clear() { while (this.list.length) this.remove(this.list.length - 1); for (const a of this.arrows) this.scene.remove(a.mesh); this.arrows = []; }
}
