// Creatures (pig, sheep, zombie) + dropped item entities.
import * as THREE from 'three';
import { moveEntity, rayEntity, inWater } from './physics.js';
import { B, I, isBlock } from './blocks.js';
import { makeBlockGeometry, makeIconTexture } from './textures.js';

const MOB_STATS = {
  pig:   { hp: 10, w: 0.8, h: 0.85, speed: 1.2, hostile: false },
  sheep: { hp: 10, w: 0.8, h: 1.0, speed: 1.1, hostile: false },
  zombie:{ hp: 20, w: 0.6, h: 1.8, speed: 2.1, hostile: true },
};

function box(w, h, d, color, pivotTop = false) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) g.translate(0, -h / 2, 0);
  const m = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

function buildModel(kind) {
  const group = new THREE.Group();
  const legs = [];
  let head = null;
  if (kind === 'pig' || kind === 'sheep') {
    const isPig = kind === 'pig';
    const bodyColor = isPig ? 0xef9a9a : 0xeceae4;
    const legColor = isPig ? 0xe58e8e : 0xbdb8ae;
    const body = box(0.62, 0.5, 0.95, bodyColor);
    body.position.y = 0.62;
    group.add(body);
    head = box(0.42, 0.42, 0.4, isPig ? 0xef9a9a : 0xcac3b8);
    head.position.set(0, 0.78, 0.62);
    group.add(head);
    if (isPig) {
      const snout = box(0.18, 0.12, 0.08, 0xd97f7f);
      snout.position.set(0, 0.72, 0.85);
      group.add(snout);
    } else {
      const fluff = box(0.46, 0.2, 0.44, 0xeceae4);
      fluff.position.set(0, 0.98, 0.6);
      group.add(fluff);
    }
    // eyes
    const eyeL = box(0.06, 0.06, 0.02, 0x1a1a1a); eyeL.position.set(-0.12, 0.85, 0.83);
    const eyeR = box(0.06, 0.06, 0.02, 0x1a1a1a); eyeR.position.set(0.12, 0.85, 0.83);
    group.add(eyeL, eyeR);
    for (const [lx, lz] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
      const leg = box(0.18, 0.4, 0.18, legColor, true);
      leg.position.set(lx, 0.4, lz);
      group.add(leg);
      legs.push(leg);
    }
  } else {
    // zombie
    const skin = 0x5d9e4a, shirt = 0x2e8b8b, pants = 0x3a4a8c;
    head = box(0.45, 0.45, 0.45, skin);
    head.position.y = 1.58;
    group.add(head);
    const eyeL = box(0.08, 0.06, 0.02, 0x111111); eyeL.position.set(-0.11, 1.62, 0.24);
    const eyeR = box(0.08, 0.06, 0.02, 0x111111); eyeR.position.set(0.11, 1.62, 0.24);
    group.add(eyeL, eyeR);
    const torso = box(0.5, 0.65, 0.28, shirt);
    torso.position.y = 1.03;
    group.add(torso);
    for (const sx of [-0.35, 0.35]) {
      const arm = box(0.18, 0.6, 0.18, skin, true);
      arm.position.set(sx, 1.32, 0);
      arm.rotation.x = -Math.PI / 2.1;
      group.add(arm);
    }
    for (const sx of [-0.13, 0.13]) {
      const leg = box(0.2, 0.7, 0.2, pants, true);
      leg.position.set(sx, 0.7, 0);
      group.add(leg);
      legs.push(leg);
    }
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, legs, head };
}

export class EntityManager {
  constructor(scene, world, atlasMat, hooks) {
    this.scene = scene;
    this.world = world;
    this.atlasMat = atlasMat;
    this.hooks = hooks; // { audio, particles, player, inv, mobKilled, pickup }
    this.mobs = [];
    this.items = [];
    this.spawnTimer = 3;
    this.iconTexCache = new Map();
    this.blockGeoCache = new Map();
  }

  // ---------- mobs ----------
  spawnMob(kind, x, y, z) {
    const stats = MOB_STATS[kind];
    const { group, legs, head } = buildModel(kind);
    group.position.set(x, y, z);
    this.scene.add(group);
    const mob = {
      kind, ...stats, maxHp: stats.hp,
      pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 },
      yaw: Math.random() * Math.PI * 2,
      group, legs, head,
      state: 'idle', stateTimer: 1 + Math.random() * 2,
      onGround: false, hurtFlash: 0, attackCd: 0,
      ambientTimer: 4 + Math.random() * 10,
      fleeTimer: 0, fleeDir: { x: 0, z: 0 },
      burnTick: 0, dead: false, deathTimer: 0,
      walkPhase: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  damageMob(mob, dmg, fromDir) {
    if (mob.dead) return;
    mob.hp -= dmg;
    mob.hurtFlash = 0.25;
    if (fromDir) {
      mob.vel.x += fromDir.x * 6;
      mob.vel.z += fromDir.z * 6;
      mob.vel.y = Math.max(mob.vel.y, 4.5);
    }
    this.hooks.audio?.mobHurt(mob.kind);
    this.hooks.particles?.entityHit(mob.pos.x, mob.pos.y + mob.h * 0.6, mob.pos.z);
    if (!mob.hostile) {
      mob.fleeTimer = 4;
      const p = this.hooks.player;
      const dx = mob.pos.x - p.pos.x, dz = mob.pos.z - p.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      mob.fleeDir = { x: dx / l, z: dz / l };
    }
    if (mob.hp <= 0) {
      mob.dead = true;
      mob.deathTimer = 0.55;
      this.hooks.mobKilled?.(mob.kind);
      // drops
      const drops = [];
      if (mob.kind === 'pig') drops.push({ id: I.PORK_RAW, n: 1 + Math.floor(Math.random() * 2) });
      if (mob.kind === 'sheep') {
        drops.push({ id: B.WOOL, n: 1 });
        if (Math.random() < 0.6) drops.push({ id: I.PORK_RAW, n: 1 });
      }
      if (mob.kind === 'zombie' && Math.random() < 0.15) drops.push({ id: I.IRON, n: 1 });
      for (const d of drops) this.dropItem(d.id, d.n, mob.pos.x, mob.pos.y + 0.5, mob.pos.z, 0.5);
    }
  }

  attackRay(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const t = rayEntity(origin, dir, m, maxDist);
      if (t !== null && t < bestT) { best = m; bestT = t; }
    }
    return best;
  }

  updateMobs(dt, daylight, player) {
    const world = this.world;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (m.dead) {
        m.deathTimer -= dt;
        m.group.rotation.z = (1 - m.deathTimer / 0.55) * Math.PI / 2;
        m.group.position.y = m.pos.y + 0.1;
        if (m.deathTimer <= 0) {
          this.scene.remove(m.group);
          this.mobs.splice(i, 1);
        }
        continue;
      }

      const distToPlayer = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      if (distToPlayer > 80) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
        continue;
      }

      m.hurtFlash = Math.max(0, m.hurtFlash - dt);
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.group.traverse((o) => {
        if (o.isMesh) o.material.emissive?.setHex(m.hurtFlash > 0 ? 0x881111 : 0x000000);
      });

      // AI decisions
      m.stateTimer -= dt;
      let moveX = 0, moveZ = 0, speed = m.speed;
      if (m.hostile && !player.dead && distToPlayer < 22) {
        m.state = 'chase';
        const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        moveX = dx / l; moveZ = dz / l;
        m.yaw = Math.atan2(moveX, moveZ);
        if (distToPlayer < 1.5 && m.attackCd <= 0) {
          m.attackCd = 1.2;
          player.damage(3, 'zombie', this.hooks.playerHooks);
          player.vel.x += moveX * 6; player.vel.z += moveZ * 6; player.vel.y = Math.max(player.vel.y, 4);
          this.hooks.audio?.zombieAttack();
        }
        if (distToPlayer < 1.2) { moveX = 0; moveZ = 0; }
      } else if (m.fleeTimer > 0) {
        m.fleeTimer -= dt;
        moveX = m.fleeDir.x; moveZ = m.fleeDir.z;
        speed = m.speed * 2.2;
        m.yaw = Math.atan2(moveX, moveZ);
      } else if (m.stateTimer <= 0) {
        if (m.state === 'walk' || Math.random() < 0.4) {
          m.state = 'idle';
          m.stateTimer = 1.5 + Math.random() * 3.5;
        } else {
          m.state = 'walk';
          m.stateTimer = 2 + Math.random() * 3;
          m.yaw = Math.random() * Math.PI * 2;
        }
      }
      if (m.state === 'walk' && m.fleeTimer <= 0) {
        moveX = Math.sin(m.yaw); moveZ = Math.cos(m.yaw);
      }

      // physics
      const swimming = inWater(world, m);
      const accel = m.onGround ? 8 : 2.5;
      const k = 1 - Math.exp(-accel * dt);
      m.vel.x += (moveX * speed - m.vel.x) * k;
      m.vel.z += (moveZ * speed - m.vel.z) * k;
      if (swimming) {
        m.vel.y += (2.2 - m.vel.y) * Math.min(1, dt * 3);
      } else {
        m.vel.y -= 28 * dt;
        m.vel.y = Math.max(m.vel.y, -40);
      }
      const res = moveEntity(world, m, dt);
      m.onGround = res.onGround;
      if ((res.hitX || res.hitZ) && m.onGround && (moveX || moveZ)) m.vel.y = 7.8;
      if ((res.hitX || res.hitZ) && m.state === 'walk') m.stateTimer = Math.min(m.stateTimer, 0.2);

      // zombies burn in daylight
      if (m.kind === 'zombie' && daylight > 0.6) {
        const skyY = world.surfaceY(Math.floor(m.pos.x), Math.floor(m.pos.z));
        if (m.pos.y >= skyY - 0.5) {
          m.burnTick += dt;
          if (Math.random() < dt * 8) this.hooks.particles?.flame(m.pos.x, m.pos.y + 1.2, m.pos.z);
          if (m.burnTick > 1) { m.burnTick = 0; this.damageMob(m, 2, null); }
        }
      }

      // ambient sounds
      m.ambientTimer -= dt;
      if (m.ambientTimer <= 0) {
        m.ambientTimer = 6 + Math.random() * 12;
        if (distToPlayer < 20) this.hooks.audio?.mobAmbient(m.kind);
      }

      // animation
      const spd = Math.hypot(m.vel.x, m.vel.z);
      m.walkPhase += spd * dt * 4;
      const swing = Math.min(1, spd / m.speed) * 0.7;
      m.legs.forEach((leg, li) => {
        leg.rotation.x = Math.sin(m.walkPhase + (li % 2) * Math.PI) * swing;
      });
      if (m.head && !m.hostile) m.head.rotation.x = m.state === 'idle' ? Math.sin(performance.now() * 0.001 + i) * 0.15 + 0.2 : 0;

      m.group.position.set(m.pos.x, m.pos.y, m.pos.z);
      m.group.rotation.y = m.yaw;
    }
  }

  // ---------- item drops ----------
  dropItem(id, n, x, y, z, delay = 0.6, dur = undefined) {
    let mesh;
    if (isBlock(id) && id !== B.TORCH) {
      let geo = this.blockGeoCache.get(id);
      if (!geo) { geo = makeBlockGeometry(id); this.blockGeoCache.set(id, geo); }
      mesh = new THREE.Mesh(geo, this.atlasMat);
      mesh.scale.setScalar(0.28);
    } else {
      let tex = this.iconTexCache.get(id);
      if (!tex) { tex = makeIconTexture(id); this.iconTexCache.set(id, tex); }
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
      );
    }
    mesh.castShadow = true;
    this.scene.add(mesh);
    const item = {
      id, n, dur, mesh,
      pos: { x, y, z }, vel: { x: (Math.random() - 0.5) * 2.5, y: 3.5, z: (Math.random() - 0.5) * 2.5 },
      w: 0.25, h: 0.25, age: 0, pickupDelay: delay,
    };
    this.items.push(item);
    return item;
  }

  updateItems(dt, player, inv) {
    const world = this.world;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age > 300) {
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
        continue;
      }
      it.vel.y -= 22 * dt;
      if (inWater(world, it)) it.vel.y = Math.min(it.vel.y + 30 * dt, 1.5);
      it.vel.x *= 1 - Math.min(1, dt * 3);
      it.vel.z *= 1 - Math.min(1, dt * 3);
      moveEntity(world, it, dt);

      const dx = player.pos.x - it.pos.x, dy = player.pos.y + 0.9 - it.pos.y, dz = player.pos.z - it.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (it.age > it.pickupDelay && !player.dead) {
        if (dist < 2.2) {
          // magnet pull
          it.vel.x += (dx / dist) * 20 * dt;
          it.vel.y += (dy / dist) * 20 * dt;
          it.vel.z += (dz / dist) * 20 * dt;
        }
        if (dist < 1.1) {
          const leftover = inv.add(it.id, it.n, it.dur);
          const taken = it.n - leftover;
          if (taken > 0) {
            this.hooks.audio?.pickup();
            this.hooks.pickup?.(it.id, taken);
          }
          if (leftover <= 0) {
            this.scene.remove(it.mesh);
            this.items.splice(i, 1);
            continue;
          }
          it.n = leftover;
          it.pickupDelay = it.age + 1.5;
        }
      }
      it.mesh.position.set(it.pos.x, it.pos.y + 0.18 + Math.sin(it.age * 2.5) * 0.06, it.pos.z);
      it.mesh.rotation.y = it.age * 1.8;
    }
  }

  // ---------- spawning ----------
  updateSpawning(dt, player, sky) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 2.5;
    const passive = this.mobs.filter((m) => !m.hostile && !m.dead).length;
    const hostile = this.mobs.filter((m) => m.hostile && !m.dead).length;
    const night = sky.isNight;
    const wantHostile = night && hostile < 5 && !player.creative;
    const wantPassive = passive < 7 && !night;
    if (!wantHostile && !wantPassive) return;

    for (let attempt = 0; attempt < 4; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 26;
      const x = Math.floor(player.pos.x + Math.cos(ang) * dist);
      const z = Math.floor(player.pos.z + Math.sin(ang) * dist);
      const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
      if (!this.world.chunks.has(cx + ',' + cz)) continue;
      const y = this.world.surfaceY(x, z);
      const ground = this.world.getBlock(x, y, z);
      if (y <= 43) continue; // no spawns in ocean
      const above = this.world.getBlock(x, y + 1, z);
      const above2 = this.world.getBlock(x, y + 2, z);
      if (above !== B.AIR || above2 !== B.AIR) continue;
      if (wantPassive && (ground === B.GRASS || ground === B.SNOW_GRASS)) {
        const kind = Math.random() < 0.5 ? 'pig' : 'sheep';
        this.spawnMob(kind, x + 0.5, y + 1.05, z + 0.5);
        if (Math.random() < 0.6) this.spawnMob(kind, x + 1.5, y + 1.05, z + 0.5);
        return;
      }
      if (wantHostile && ground !== B.WATER) {
        this.spawnMob('zombie', x + 0.5, y + 1.05, z + 0.5);
        return;
      }
    }
  }

  clearHostiles() {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].hostile) {
        this.scene.remove(this.mobs[i].group);
        this.mobs.splice(i, 1);
      }
    }
  }
}