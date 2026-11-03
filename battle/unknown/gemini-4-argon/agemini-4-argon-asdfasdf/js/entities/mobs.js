// Articulated 3D Voxel Creatures (Sheep, Cows, Pigs, Chickens + Night Zombies & Slimes)

import * as THREE from 'three';
import { BIOMES, GAME_MODES, SEA_LEVEL, WEATHER_TYPES } from '../constants.js';
import { BLOCK, isBlockSolid } from '../game/blocks.js';

const MOB_SPECS = {
  sheep: {
    name: 'Meadow Sheep',
    hostile: false,
    maxHp: 8,
    speed: 1.55,
    radius: 0.42,
    height: 1.15,
    drops: [
      { id: `block:${BLOCK.WOOL_WHITE}`, count: 2 },
      { id: 'item:raw_meat', count: 1 },
    ],
  },
  cow: {
    name: 'Highland Cow',
    hostile: false,
    maxHp: 10,
    speed: 1.45,
    radius: 0.46,
    height: 1.3,
    drops: [{ id: 'item:raw_meat', count: 2 }],
  },
  pig: {
    name: 'Wild Pig',
    hostile: false,
    maxHp: 8,
    speed: 1.7,
    radius: 0.4,
    height: 0.95,
    drops: [{ id: 'item:raw_meat', count: 2 }],
  },
  chicken: {
    name: 'Meadow Chicken',
    hostile: false,
    maxHp: 4,
    speed: 1.9,
    radius: 0.28,
    height: 0.72,
    drops: [{ id: 'item:raw_meat', count: 1 }],
  },
  zombie: {
    name: 'Night Zombie',
    hostile: true,
    maxHp: 14,
    speed: 2.35,
    damage: 3,
    radius: 0.36,
    height: 1.85,
    drops: [
      { id: 'item:coal', count: 1 },
      { id: 'item:iron_ingot', count: 1, chance: 0.35 },
    ],
  },
  slime: {
    name: 'Emerald Slime',
    hostile: true,
    maxHp: 8,
    speed: 2.0,
    damage: 2,
    radius: 0.45,
    height: 0.9,
    drops: [{ id: `block:${BLOCK.GLOW_CRYSTAL}`, count: 1, chance: 0.5 }],
  },
};

function makePart(w, h, d, color, x = 0, y = 0, z = 0, opacity = 1) {
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function buildMobRig(kind) {
  const root = new THREE.Group();
  const legs = [];
  let head = null;
  const flashMaterials = [];

  const registerMat = (obj) => {
    obj.traverse((c) => {
      if (c.isMesh && c.material) {
        c.userData.baseColor = c.material.color.getHex();
        flashMaterials.push(c);
      }
    });
  };

  if (kind === 'sheep') {
    const body = makePart(0.68, 0.58, 0.96, 0xf4f4ee, 0, 0.72, 0);
    head = new THREE.Group();
    head.position.set(0, 0.92, 0.54);
    head.add(makePart(0.42, 0.42, 0.44, 0xd8c8b4, 0, 0, 0));
    head.add(makePart(0.46, 0.22, 0.36, 0xf6f6f0, 0, 0.16, -0.04)); // wool cap
    head.add(makePart(0.08, 0.08, 0.04, 0x222222, -0.14, 0.03, 0.22));
    head.add(makePart(0.08, 0.08, 0.04, 0x222222, 0.14, 0.03, 0.22));
    root.add(body, head);
    for (const [lx, lz] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.46, lz);
      pivot.add(makePart(0.18, 0.46, 0.18, 0xd4c2ae, 0, -0.23, 0));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (kind === 'cow') {
    const body = makePart(0.74, 0.66, 1.08, 0x5c3c28, 0, 0.82, 0);
    body.add(makePart(0.76, 0.36, 0.42, 0xedeae4, 0, 0.1, 0.12)); // white patch
    head = new THREE.Group();
    head.position.set(0, 1.02, 0.64);
    head.add(makePart(0.46, 0.46, 0.44, 0x5c3c28, 0, 0, 0));
    head.add(makePart(0.36, 0.22, 0.12, 0xe3b8a6, 0, -0.1, 0.24)); // muzzle
    head.add(makePart(0.08, 0.18, 0.08, 0xd8d2c5, -0.24, 0.24, 0)); // left horn
    head.add(makePart(0.08, 0.18, 0.08, 0xd8d2c5, 0.24, 0.24, 0));  // right horn
    root.add(body, head);
    for (const [lx, lz] of [[-0.22, 0.36], [0.22, 0.36], [-0.22, -0.36], [0.22, -0.36]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.5, lz);
      pivot.add(makePart(0.2, 0.5, 0.2, 0x4d3120, 0, -0.25, 0));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (kind === 'pig') {
    const body = makePart(0.62, 0.52, 0.88, 0xf29ca8, 0, 0.6, 0);
    head = new THREE.Group();
    head.position.set(0, 0.68, 0.52);
    head.add(makePart(0.44, 0.42, 0.42, 0xf29ca8, 0, 0, 0));
    head.add(makePart(0.24, 0.16, 0.1, 0xe07b8b, 0, -0.06, 0.24)); // snout
    head.add(makePart(0.07, 0.07, 0.04, 0x222222, -0.14, 0.06, 0.21));
    head.add(makePart(0.07, 0.07, 0.04, 0x222222, 0.14, 0.06, 0.21));
    root.add(body, head);
    for (const [lx, lz] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.36, lz);
      pivot.add(makePart(0.16, 0.36, 0.16, 0xe88996, 0, -0.18, 0));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (kind === 'chicken') {
    const body = makePart(0.4, 0.36, 0.48, 0xfafafa, 0, 0.42, 0);
    head = new THREE.Group();
    head.position.set(0, 0.66, 0.22);
    head.add(makePart(0.24, 0.28, 0.24, 0xfafafa, 0, 0, 0));
    head.add(makePart(0.14, 0.08, 0.14, 0xf0b229, 0, -0.02, 0.16)); // beak
    head.add(makePart(0.08, 0.1, 0.08, 0xd93434, 0, 0.17, 0.02));   // comb
    root.add(body, head);
    for (const lx of [-0.1, 0.1]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.24, 0);
      pivot.add(makePart(0.06, 0.24, 0.06, 0xe8a825, 0, -0.12, 0));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (kind === 'zombie') {
    const torso = makePart(0.5, 0.72, 0.28, 0x2c8699, 0, 1.08, 0);
    head = new THREE.Group();
    head.position.set(0, 1.66, 0);
    head.add(makePart(0.46, 0.46, 0.46, 0x5c9652, 0, 0, 0));
    head.add(makePart(0.1, 0.07, 0.05, 0x162216, -0.11, 0.02, 0.23));
    head.add(makePart(0.1, 0.07, 0.05, 0x162216, 0.11, 0.02, 0.23));
    // Outstretched zombie arms!
    const armL = makePart(0.2, 0.2, 0.66, 0x5c9652, -0.36, 1.32, 0.26);
    const armR = makePart(0.2, 0.2, 0.66, 0x5c9652, 0.36, 1.32, 0.26);
    root.add(torso, head, armL, armR);
    for (const lx of [-0.14, 0.14]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.72, 0);
      pivot.add(makePart(0.22, 0.72, 0.24, 0x3b488c, 0, -0.36, 0));
      root.add(pivot);
      legs.push(pivot);
    }
  } else {
    // Translucent bouncy Emerald Slime!
    const outer = makePart(0.84, 0.84, 0.84, 0x5be068, 0, 0.42, 0, 0.68);
    const core = makePart(0.48, 0.48, 0.48, 0x2f9c3d, 0, 0.42, 0);
    const eyeL = makePart(0.12, 0.12, 0.06, 0x16381a, -0.18, 0.52, 0.41);
    const eyeR = makePart(0.12, 0.12, 0.06, 0x16381a, 0.18, 0.52, 0.41);
    root.add(outer, core, eyeL, eyeR);
  }

  registerMat(root);
  return { root, legs, head, flashMaterials };
}

export class MobManager {
  constructor(scene, chunkManager, dropManager, particleSystem, soundEngine) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.drops = dropManager;
    this.particles = particleSystem;
    this.sound = soundEngine;
    this.mobs = [];
    this.spawnTimer = 1.5;
  }

  spawnMob(kind, x, y, z) {
    const spec = MOB_SPECS[kind];
    if (!spec) return null;
    const rig = buildMobRig(kind);
    rig.root.position.set(x, y, z);
    this.scene.add(rig.root);

    const mob = {
      kind,
      spec,
      rig,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: spec.maxHp,
      onGround: false,
      aiTimer: 1 + Math.random() * 2.5,
      moving: true,
      fleeTimer: 0,
      hurtFlash: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
      voiceTimer: 6 + Math.random() * 14,
      burnTimer: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  populateInitialWildlife(playerPos) {
    const types = ['sheep', 'cow', 'pig', 'chicken', 'sheep', 'chicken'];
    let placed = 0;
    for (let attempt = 0; attempt < 45 && placed < 8; attempt++) {
      const angle = (attempt / 12) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 9 + Math.random() * 24;
      const wx = playerPos.x + Math.cos(angle) * dist;
      const wz = playerPos.z + Math.sin(angle) * dist;
      const surf = this.chunkManager.findSurfaceY(wx, wz);
      if (surf.underwater || surf.y <= SEA_LEVEL) continue;
      this.spawnMob(types[placed % types.length], wx, surf.y + 0.05, wz);
      placed++;
    }
  }

  // Raycast hit check from player camera for combat!
  raycastMob(origin, dir, maxDist = 4.6) {
    let closest = null;
    let minT = maxDist;

    for (const m of this.mobs) {
      const cx = m.x;
      const cy = m.y + m.spec.height * 0.52;
      const cz = m.z;
      const rad = m.spec.radius + 0.25;

      const ox = cx - origin.x;
      const oy = cy - origin.y;
      const oz = cz - origin.z;
      const proj = ox * dir.x + oy * dir.y + oz * dir.z;
      if (proj < 0 || proj > minT) continue;

      const dSq = ox * ox + oy * oy + oz * oz - proj * proj;
      if (dSq <= rad * rad) {
        minT = proj;
        closest = m;
      }
    }
    return closest;
  }

  damageMob(mob, amount, knockDirX = 0, knockDirZ = 0) {
    mob.hp -= amount;
    mob.hurtFlash = 0.26;
    mob.vy = 5.2;
    mob.vx = knockDirX * 6.5;
    mob.vz = knockDirZ * 6.5;
    if (!mob.spec.hostile) {
      mob.fleeTimer = 4.5;
      mob.yaw = Math.atan2(knockDirX, knockDirZ);
    }
    this.sound.playHit(false);
    this.particles.emitPuff(mob.x, mob.y + 0.5, mob.z, '#ff5959', 8);

    if (mob.hp <= 0) {
      this.killMob(mob);
      return true;
    }
    return false;
  }

  killMob(mob) {
    this.particles.emitPuff(mob.x, mob.y + 0.4, mob.z, '#ffffff', 16);
    for (const drop of mob.spec.drops) {
      if (drop.chance !== undefined && Math.random() > drop.chance) continue;
      this.drops.spawnDrop(mob.x, mob.y + 0.5, mob.z, drop.id, drop.count);
    }
    this.removeMob(mob);
  }

  removeMob(mob) {
    this.scene.remove(mob.rig.root);
    const idx = this.mobs.indexOf(mob);
    if (idx !== -1) this.mobs.splice(idx, 1);
  }

  clearAll() {
    for (const m of this.mobs) this.scene.remove(m.rig.root);
    this.mobs = [];
  }

  update(dt, player, atmosphere) {
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const isNight = atmosphere.isNight();

    // Dynamic biome & day/night spawning cap (16 active mobs near player)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.mobs.length < 16) {
      this.spawnTimer = 3.5;
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 20;
      const sx = px + Math.cos(angle) * dist;
      const sz = pz + Math.sin(angle) * dist;
      const surf = this.chunkManager.findSurfaceY(sx, sz);

      if (!surf.underwater && surf.y > SEA_LEVEL) {
        if (isNight && player.mode === GAME_MODES.SURVIVAL) {
          const kind = Math.random() < 0.68 ? 'zombie' : 'slime';
          this.spawnMob(kind, sx, surf.y + 0.05, sz);
        } else {
          const biome = this.chunkManager.worldGen.sampleColumn(Math.floor(sx), Math.floor(sz)).biome;
          if (biome !== BIOMES.DESERT) {
            const peaceful = ['sheep', 'cow', 'pig', 'chicken'];
            this.spawnMob(peaceful[(Math.random() * peaceful.length) | 0], sx, surf.y + 0.05, sz);
          }
        }
      }
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dx = px - m.x;
      const dy = py - m.y;
      const dz = pz - m.z;
      const dist = Math.hypot(dx, dz);

      // Despawn far mobs smoothly
      if (dist > 68 || m.y < -10) {
        this.removeMob(m);
        continue;
      }

      // Zombies burn in bright morning sunlight when clear!
      if (m.kind === 'zombie' && !isNight && atmosphere.weather === WEATHER_TYPES.CLEAR) {
        m.burnTimer += dt;
        if (m.burnTimer > 1.1) {
          m.burnTimer = 0;
          this.particles.emitPuff(m.x, m.y + 1.1, m.z, '#ff8833', 6);
          if (this.damageMob(m, 3, 0, 0)) continue;
        }
      }

      // Hurt red tint decay
      if (m.hurtFlash > 0) {
        m.hurtFlash = Math.max(0, m.hurtFlash - dt);
        for (const mesh of m.rig.flashMaterials) {
          mesh.material.color.setHex(m.hurtFlash > 0 ? 0xff4d4d : mesh.userData.baseColor);
        }
      }

      // Ambient animal/zombie sounds
      m.voiceTimer -= dt;
      if (m.voiceTimer <= 0 && dist < 22) {
        m.voiceTimer = 10 + Math.random() * 18;
        this.sound.playMobVoice(m.kind === 'zombie' ? 'zombie' : m.kind);
      }

      // AI Steering
      if (m.spec.hostile && player.mode === GAME_MODES.SURVIVAL && dist < 16) {
        m.yaw = Math.atan2(dx, dz);
        m.moving = dist > 0.95;

        // Slime playful hop!
        if (m.kind === 'slime' && m.onGround && Math.random() < dt * 2.4) {
          m.vy = 6.8;
        }

        // Melee attack check
        m.attackCooldown = Math.max(0, m.attackCooldown - dt);
        if (dist < 1.25 && Math.abs(dy) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.15;
          player.takeDamage(m.spec.damage, dx / Math.max(0.1, dist), dz / Math.max(0.1, dist));
        }
      } else {
        m.aiTimer -= dt;
        if (m.fleeTimer > 0) {
          m.fleeTimer -= dt;
          m.moving = true;
        } else if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.5;
          m.moving = Math.random() < 0.62;
          if (m.moving) {
            m.yaw += (Math.random() - 0.5) * 2.4;
          }
        }
      }

      const speed = m.fleeTimer > 0 ? m.spec.speed * 1.9 : m.moving ? m.spec.speed : 0;
      const targetVx = Math.sin(m.yaw) * speed;
      const targetVz = Math.cos(m.yaw) * speed;
      m.vx += (targetVx - m.vx) * Math.min(1, dt * 7);
      m.vz += (targetVz - m.vz) * Math.min(1, dt * 7);
      m.vy -= 24.0 * dt;

      // Step X & Z with auto-jump over 1-block terrain steps!
      const nextX = m.x + m.vx * dt;
      const nextZ = m.z + m.vz * dt;
      let blockedHoriz = false;

      if (!this.collidesAt(nextX, m.y, m.z, m.spec.radius, m.spec.height)) {
        m.x = nextX;
      } else {
        blockedHoriz = true;
      }

      if (!this.collidesAt(m.x, m.y, nextZ, m.spec.radius, m.spec.height)) {
        m.z = nextZ;
      } else {
        blockedHoriz = true;
      }

      if (blockedHoriz && m.onGround && speed > 0.2) {
        if (!this.collidesAt(nextX, m.y + 1.05, nextZ, m.spec.radius, m.spec.height)) {
          m.vy = 7.9;
          m.onGround = false;
        } else {
          m.yaw += Math.PI * (0.6 + Math.random() * 0.5);
        }
      }

      // Step Y
      const nextY = m.y + m.vy * dt;
      if (!this.collidesAt(m.x, nextY, m.z, m.spec.radius, m.spec.height)) {
        m.y = nextY;
        m.onGround = false;
      } else {
        if (m.vy < 0) {
          m.y = Math.floor(nextY) + 1.001;
          m.onGround = true;
        }
        m.vy = 0;
      }

      // Float in water
      if (this.chunkManager.getBlock(m.x, m.y + 0.35, m.z) === BLOCK.WATER) {
        m.vy = Math.min(3.2, m.vy + 32 * dt);
      }

      // Animate limbs & head
      m.rig.root.position.set(m.x, m.y, m.z);
      m.rig.root.rotation.y = m.yaw;

      const horizSpeed = Math.hypot(m.vx, m.vz);
      if (horizSpeed > 0.15) {
        m.walkPhase += dt * horizSpeed * 5.2;
        const swing = Math.sin(m.walkPhase) * 0.62;
        m.rig.legs.forEach((leg, idx) => {
          leg.rotation.x = idx % 2 === 0 ? swing : -swing;
        });
      } else {
        m.rig.legs.forEach((leg) => {
          leg.rotation.x *= 0.85;
        });
      }

      if (m.kind === 'slime') {
        const squash = m.onGround ? 1.0 : 0.86;
        m.rig.root.scale.set(1 / squash, squash, 1 / squash);
      } else if (m.rig.head && dist < 8 && !m.spec.hostile && m.fleeTimer <= 0) {
        // Peaceful animals curiously glance toward the player when nearby!
        const relAngle = Math.atan2(dx, dz) - m.yaw;
        m.rig.head.rotation.y = THREE.MathUtils.clamp(
          Math.atan2(Math.sin(relAngle), Math.cos(relAngle)),
          -0.65,
          0.65
        );
      }
    }
  }

  collidesAt(x, y, z, r, h) {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + h - 0.05);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isBlockSolid(this.chunkManager.getBlock(bx, by, bz))) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
