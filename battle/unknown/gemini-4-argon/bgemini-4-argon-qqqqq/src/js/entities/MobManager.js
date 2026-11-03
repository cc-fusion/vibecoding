import * as THREE from 'three';
import { GAME_MODES, GRAVITY, SEA_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';
import { ITEM } from '../data/items.js';

const MOB_SPECS = {
  sheep: {
    hostile: false,
    maxHp: 10,
    speed: 1.9,
    fleeSpeed: 3.8,
    width: 0.8,
    height: 1.25,
    drops: () => [
      { id: BLOCK.WOOL, count: 1 + (Math.random() < 0.45 ? 1 : 0) },
      { id: ITEM.RAW_MUTTON, count: 1 + (Math.random() < 0.5 ? 1 : 0) },
    ],
  },
  pig: {
    hostile: false,
    maxHp: 10,
    speed: 2.0,
    fleeSpeed: 3.9,
    width: 0.8,
    height: 0.95,
    drops: () => [
      { id: ITEM.RAW_PORK, count: 1 + Math.floor(Math.random() * 2) },
    ],
  },
  chicken: {
    hostile: false,
    maxHp: 5,
    speed: 2.1,
    fleeSpeed: 4.1,
    width: 0.5,
    height: 0.75,
    slowFall: true,
    drops: () => [
      { id: ITEM.RAW_CHICKEN, count: 1 },
    ],
  },
  zombie: {
    hostile: true,
    maxHp: 20,
    speed: 2.65,
    damage: 3,
    width: 0.65,
    height: 1.85,
    burnsInSun: true,
    drops: () => {
      const r = Math.random();
      if (r < 0.22) return [{ id: ITEM.IRON_INGOT, count: 1 }];
      if (r < 0.55) return [{ id: ITEM.COAL, count: 1 + Math.floor(Math.random() * 2) }];
      return [];
    },
  },
  spider: {
    hostile: true,
    maxHp: 14,
    speed: 3.45,
    damage: 2,
    width: 0.95,
    height: 0.75,
    burnsInSun: false,
    drops: () => [
      { id: ITEM.FLINT, count: 1 },
    ],
  },
};

function makeBox(w, h, d, hex, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color: hex });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function buildMobModel(type) {
  const root = new THREE.Group();
  const mats = [];
  const register = (mesh) => {
    mats.push({ mat: mesh.material, origEmissive: 0x000000 });
    return mesh;
  };

  const legs = [];
  let head = null;
  let wings = [];

  if (type === 'sheep') {
    const body = register(makeBox(0.76, 0.62, 1.05, 0xf2f0ea, 0, 0.72, 0));
    root.add(body);

    head = new THREE.Group();
    head.position.set(0, 0.95, 0.58);
    head.add(register(makeBox(0.46, 0.46, 0.48, 0xd8bfa3, 0, 0, 0.1)));
    head.add(register(makeBox(0.50, 0.24, 0.42, 0xf5f4ef, 0, 0.16, 0.05))); // wool cap
    head.add(register(makeBox(0.08, 0.08, 0.05, 0x222222, -0.14, 0.03, 0.35)));
    head.add(register(makeBox(0.08, 0.08, 0.05, 0x222222, 0.14, 0.03, 0.35)));
    root.add(head);

    const legCoords = [[-0.22, 0.32], [0.22, 0.32], [-0.22, -0.34], [0.22, -0.34]];
    for (const [lx, lz] of legCoords) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.44, lz);
      pivot.add(register(makeBox(0.20, 0.44, 0.20, 0xd8bfa3, 0, -0.22, 0)));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (type === 'pig') {
    root.add(register(makeBox(0.70, 0.54, 0.98, 0xf29ca3, 0, 0.56, 0)));
    head = new THREE.Group();
    head.position.set(0, 0.68, 0.52);
    head.add(register(makeBox(0.48, 0.46, 0.46, 0xf4a4ab, 0, 0, 0.12)));
    head.add(register(makeBox(0.24, 0.18, 0.12, 0xe07e88, 0, -0.06, 0.38))); // snout
    head.add(register(makeBox(0.08, 0.08, 0.05, 0x222222, -0.15, 0.06, 0.36)));
    head.add(register(makeBox(0.08, 0.08, 0.05, 0x222222, 0.15, 0.06, 0.36)));
    root.add(head);

    const legCoords = [[-0.21, 0.30], [0.21, 0.30], [-0.21, -0.32], [0.21, -0.32]];
    for (const [lx, lz] of legCoords) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.32, lz);
      pivot.add(register(makeBox(0.20, 0.32, 0.20, 0xe68c95, 0, -0.16, 0)));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (type === 'chicken') {
    root.add(register(makeBox(0.42, 0.36, 0.52, 0xfafafa, 0, 0.40, 0)));
    head = new THREE.Group();
    head.position.set(0, 0.62, 0.24);
    head.add(register(makeBox(0.26, 0.32, 0.26, 0xfafafa, 0, 0.06, 0)));
    head.add(register(makeBox(0.18, 0.10, 0.16, 0xe8b527, 0, 0.04, 0.18))); // beak
    head.add(register(makeBox(0.10, 0.12, 0.10, 0xd62b2b, 0, -0.06, 0.15))); // wattle
    head.add(register(makeBox(0.05, 0.05, 0.05, 0x1a1a1a, -0.11, 0.10, 0.11)));
    head.add(register(makeBox(0.05, 0.05, 0.05, 0x1a1a1a, 0.11, 0.10, 0.11)));
    root.add(head);

    for (const sx of [-0.24, 0.24]) {
      const wing = new THREE.Group();
      wing.position.set(sx, 0.52, 0);
      wing.add(register(makeBox(0.07, 0.26, 0.38, 0xededed, 0, -0.12, 0)));
      root.add(wing);
      wings.push(wing);
    }

    for (const lx of [-0.10, 0.10]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.22, 0);
      pivot.add(register(makeBox(0.06, 0.22, 0.06, 0xe6b122, 0, -0.11, 0)));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (type === 'zombie') {
    // Torso
    root.add(register(makeBox(0.50, 0.68, 0.28, 0x2b8c96, 0, 1.04, 0)));
    head = new THREE.Group();
    head.position.set(0, 1.38, 0);
    head.add(register(makeBox(0.46, 0.46, 0.46, 0x56874b, 0, 0.23, 0)));
    head.add(register(makeBox(0.10, 0.07, 0.05, 0x182416, -0.11, 0.24, 0.22)));
    head.add(register(makeBox(0.10, 0.07, 0.05, 0x182416, 0.11, 0.24, 0.22)));
    root.add(head);

    // Outstretched zombie arms
    for (const sx of [-0.36, 0.36]) {
      root.add(register(makeBox(0.20, 0.20, 0.66, 0x56874b, sx, 1.24, 0.24)));
    }

    for (const lx of [-0.13, 0.13]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.70, 0);
      pivot.add(register(makeBox(0.22, 0.70, 0.24, 0x3b3d85, 0, -0.35, 0)));
      root.add(pivot);
      legs.push(pivot);
    }
  } else if (type === 'spider') {
    root.add(register(makeBox(0.46, 0.36, 0.50, 0x2a2529, 0, 0.36, 0.15)));
    root.add(register(makeBox(0.62, 0.44, 0.68, 0x1f1b1e, 0, 0.40, -0.36)));
    head = new THREE.Group();
    head.position.set(0, 0.38, 0.42);
    head.add(register(makeBox(0.40, 0.34, 0.34, 0x2e282d, 0, 0, 0)));
    // Glowing red arachnid eyes
    const eyeL = makeBox(0.10, 0.08, 0.05, 0xff2222, -0.11, 0.04, 0.16);
    eyeL.material.emissive.setHex(0xaa1111);
    const eyeR = makeBox(0.10, 0.08, 0.05, 0xff2222, 0.11, 0.04, 0.16);
    eyeR.material.emissive.setHex(0xaa1111);
    head.add(eyeL);
    head.add(eyeR);
    root.add(head);

    for (let zIdx = 0; zIdx < 3; zIdx++) {
      const zOff = -0.25 + zIdx * 0.25;
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.25, 0.34, zOff);
        const limb = register(makeBox(0.52, 0.10, 0.10, 0x362f35, side * 0.22, -0.10, 0));
        limb.rotation.z = side * -0.48;
        pivot.add(limb);
        root.add(pivot);
        legs.push(pivot);
      }
    }
  }

  return { root, mats, legs, head, wings };
}

export class MobManager {
  constructor(scene) {
    this.scene = scene;
    this.mobs = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._spawnTimer = 2.5;
  }

  spawnMob(type, x, y, z) {
    const spec = MOB_SPECS[type];
    if (!spec) return null;
    const model = buildMobModel(type);
    model.root.position.set(x, y, z);
    this.group.add(model.root);

    const mob = {
      type,
      spec,
      model,
      x, y, z,
      vx: 0, vy: 0, vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: spec.maxHp,
      onGround: false,
      hurtTimer: 0,
      attackCooldown: 0,
      aiTimer: 1 + Math.random() * 3,
      moving: false,
      fleeTimer: 0,
      walkPhase: Math.random() * 10,
      burnTimer: 0,
      soundTimer: 6 + Math.random() * 14,
    };
    this.mobs.push(mob);
    return mob;
  }

  _tryNaturalSpawning(world, playerPos, isNight, gameMode) {
    const passiveCount = this.mobs.filter((m) => !m.spec.hostile).length;
    const hostileCount = this.mobs.filter((m) => m.spec.hostile).length;

    // Spawn passive wildlife during day/anytime on grass up to cap 12
    if (passiveCount < 11) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 26;
      const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
      const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
      const { cx, cz, lx, lz } = world.worldToChunk(wx, wz);
      const chunk = world.getChunk(cx, cz);
      if (chunk) {
        const surfY = chunk.heightMap[(lz << 4) | lx];
        const ground = chunk.get(lx, surfY, lz);
        if (surfY > SEA_LEVEL && (ground === BLOCK.GRASS || ground === BLOCK.SNOW_GRASS)) {
          if (chunk.get(lx, surfY + 1, lz) === BLOCK.AIR && chunk.get(lx, surfY + 2, lz) === BLOCK.AIR) {
            const types = ['sheep', 'pig', 'chicken'];
            const pick = types[Math.floor(Math.random() * types.length)];
            this.spawnMob(pick, wx + 0.5, surfY + 1.02, wz + 0.5);
          }
        }
      }
    }

    // Spawn hostile mobs in darkness / night in Survival mode up to cap 10
    if (gameMode === GAME_MODES.SURVIVAL && hostileCount < 9) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 24;
      const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
      const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
      const { cx, cz, lx, lz } = world.worldToChunk(wx, wz);
      const chunk = world.getChunk(cx, cz);
      if (chunk) {
        // Pick either surface at night or dark underground cavern
        let sy = chunk.heightMap[(lz << 4) | lx] + 1;
        if (!isNight) {
          // Try underground cave spot
          const caveY = 8 + Math.floor(Math.random() * Math.max(4, sy - 14));
          if (chunk.get(lx, caveY, lz) === BLOCK.AIR &&
              chunk.get(lx, caveY + 1, lz) === BLOCK.AIR &&
              BLOCKS[chunk.get(lx, caveY - 1, lz)]?.solid) {
            sy = caveY;
          } else {
            return;
          }
        }
        if (sy > 2 && sy < WORLD_HEIGHT - 3) {
          const blkL = chunk.getBlockLight(lx, sy, lz);
          const skyL = chunk.getSkyLight(lx, sy, lz);
          const effectiveLight = isNight ? Math.max(blkL, Math.floor(skyL * 0.25)) : Math.max(blkL, skyL);
          if (effectiveLight <= 6 &&
              chunk.get(lx, sy, lz) === BLOCK.AIR &&
              chunk.get(lx, sy + 1, lz) === BLOCK.AIR &&
              BLOCKS[chunk.get(lx, sy - 1, lz)]?.solid) {
            const pick = Math.random() < 0.65 ? 'zombie' : 'spider';
            this.spawnMob(pick, wx + 0.5, sy + 0.05, wz + 0.5);
          }
        }
      }
    }
  }

  _collidesSolid(world, x, y, z, hw, h) {
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + h);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const id = world.getBlock(bx, by, bz);
          if (BLOCKS[id]?.solid) return true;
        }
      }
    }
    return false;
  }

  // Raycast against mob AABBs for melee combat
  raycastMob(origin, dir, maxDist = 4.2) {
    let best = null;
    let bestDist = maxDist;

    for (const mob of this.mobs) {
      const hw = mob.spec.width * 0.55;
      const minX = mob.x - hw, maxX = mob.x + hw;
      const minY = mob.y, maxY = mob.y + mob.spec.height;
      const minZ = mob.z - hw, maxZ = mob.z + hw;

      const invX = dir.x !== 0 ? 1 / dir.x : 1e9;
      const invY = dir.y !== 0 ? 1 / dir.y : 1e9;
      const invZ = dir.z !== 0 ? 1 / dir.z : 1e9;

      const t1 = (minX - origin.x) * invX;
      const t2 = (maxX - origin.x) * invX;
      const t3 = (minY - origin.y) * invY;
      const t4 = (maxY - origin.y) * invY;
      const t5 = (minZ - origin.z) * invZ;
      const t6 = (maxZ - origin.z) * invZ;

      const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
      const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

      if (tmax >= 0 && tmin <= tmax && tmin <= bestDist) {
        bestDist = Math.max(0, tmin);
        best = mob;
      }
    }
    return best ? { mob: best, distance: bestDist } : null;
  }

  hitMob(mob, damage, knockDir, itemDrops, particles, sound) {
    mob.hp -= damage;
    mob.hurtTimer = 0.26;
    for (const entry of mob.model.mats) {
      entry.mat.emissive.setHex(0xaa1818);
    }

    if (knockDir) {
      mob.vx = knockDir.x * 6.5;
      mob.vy = 4.6;
      mob.vz = knockDir.z * 6.5;
    }

    if (!mob.spec.hostile) {
      mob.fleeTimer = 4.0;
      mob.yaw = Math.atan2(mob.vx, mob.vz);
    }

    sound.playHit(false);
    sound.playMob(mob.type);

    if (mob.hp <= 0) {
      this._killMob(mob, itemDrops, particles);
      return true;
    }
    return false;
  }

  _killMob(mob, itemDrops, particles) {
    for (let i = 0; i < 16; i++) {
      particles.spawn({
        x: mob.x + (Math.random() - 0.5) * 0.6,
        y: mob.y + 0.5 + (Math.random() - 0.5) * 0.5,
        z: mob.z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 3.0,
        vy: 1.5 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 3.0,
        size: 0.14,
        gravity: 4,
        life: 0.55,
        color: 0xe6e6eb,
      });
    }
    const drops = mob.spec.drops ? mob.spec.drops() : [];
    for (const d of drops) {
      if (d.count > 0) {
        itemDrops.spawnDrop(mob.x, mob.y + 0.4, mob.z, d.id, d.count);
      }
    }
    this.group.remove(mob.model.root);
    const idx = this.mobs.indexOf(mob);
    if (idx !== -1) this.mobs.splice(idx, 1);
  }

  applyExplosion(ex, ey, ez, radius, itemDrops, particles, sound) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dx = m.x - ex;
      const dy = (m.y + 0.6) - ey;
      const dz = m.z - ez;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius) {
        const power = 1 - dist / radius;
        this.hitMob(
          m,
          Math.ceil(power * 18),
          { x: dx / (dist || 1), z: dz / (dist || 1) },
          itemDrops,
          particles,
          sound
        );
      }
    }
  }

  // Prevent placing blocks directly overlapping a creature
  intersectsAnyMob(bx, by, bz) {
    for (const m of this.mobs) {
      const hw = m.spec.width * 0.45;
      if (bx + 1 > m.x - hw && bx < m.x + hw &&
          by + 1 > m.y && by < m.y + m.spec.height &&
          bz + 1 > m.z - hw && bz < m.z + hw) {
        return true;
      }
    }
    return false;
  }

  update(dt, world, player, skyWeather, itemDrops, particles, sound) {
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = 2.4;
      this._tryNaturalSpawning(world, player.pos, skyWeather.skyState.isNight, player.gameMode);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dxP = player.pos.x - m.x;
      const dyP = player.pos.y - m.y;
      const dzP = player.pos.z - m.z;
      const distSq = dxP * dxP + dzP * dzP;

      // Despawn very distant mobs
      if (distSq > 75 * 75 || m.y < -10) {
        this.group.remove(m.model.root);
        this.mobs.splice(i, 1);
        continue;
      }

      // Hurt flash recovery
      if (m.hurtTimer > 0) {
        m.hurtTimer -= dt;
        if (m.hurtTimer <= 0) {
          for (const entry of m.model.mats) {
            entry.mat.emissive.setHex(entry.origEmissive);
          }
        }
      }

      // Occasional ambient vocalization if close
      m.soundTimer -= dt;
      if (m.soundTimer <= 0) {
        m.soundTimer = 10 + Math.random() * 18;
        if (distSq < 18 * 18) sound.playMob(m.type);
      }

      // Morning sun-burn for Zombies under open clear sky!
      if (m.spec.burnsInSun && !skyWeather.skyState.isNight && skyWeather.activePrecipitation === 'clear') {
        const skyL = world.getSkyLight(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
        const inWater = world.getBlock(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z)) === BLOCK.WATER;
        if (skyL >= 14 && !inWater) {
          m.burnTimer += dt;
          if (Math.random() < 0.35) particles.emitTorchEmber(m.x, m.y + 0.8, m.z);
          if (m.burnTimer >= 1.1) {
            m.burnTimer = 0;
            if (this.hitMob(m, 2, null, itemDrops, particles, sound)) continue;
          }
        }
      }

      // AI Decision Making
      let targetSpeed = 0;
      if (m.attackCooldown > 0) m.attackCooldown -= dt;

      if (m.spec.hostile && player.gameMode === GAME_MODES.SURVIVAL && distSq < 20 * 20 && Math.abs(dyP) < 10) {
        // Chase player!
        m.yaw = Math.atan2(dxP, dzP);
        targetSpeed = m.spec.speed;
        m.moving = true;

        // Spider leap when close
        if (m.type === 'spider' && m.onGround && distSq < 14 && distSq > 3 && Math.random() < dt * 1.4) {
          m.vy = 6.8;
        }

        // Melee attack on contact
        if (distSq < 1.35 * 1.35 && Math.abs(dyP) < 1.8 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.05;
          const dist = Math.sqrt(distSq) || 1;
          player.applyDamage(m.spec.damage, {
            x: (dxP / dist) * 5.5,
            y: 3.6,
            z: (dzP / dist) * 5.5,
          });
        }
      } else {
        // Wander or flee
        if (m.fleeTimer > 0) {
          m.fleeTimer -= dt;
          targetSpeed = m.spec.fleeSpeed;
          m.moving = true;
        } else {
          m.aiTimer -= dt;
          if (m.aiTimer <= 0) {
            m.aiTimer = 1.8 + Math.random() * 3.5;
            m.moving = Math.random() < 0.62;
            if (m.moving) {
              m.yaw += (Math.random() - 0.5) * 2.4;
            }
          }
          targetSpeed = m.moving ? m.spec.speed : 0;
        }
      }

      const desiredVx = Math.sin(m.yaw) * targetSpeed;
      const desiredVz = Math.cos(m.yaw) * targetSpeed;
      m.vx += (desiredVx - m.vx) * Math.min(1, dt * 7.0);
      m.vz += (desiredVz - m.vz) * Math.min(1, dt * 7.0);

      // Gravity & Water swimming
      const inWater = world.getBlock(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z)) === BLOCK.WATER;
      if (inWater) {
        m.vy += (2.8 - m.vy) * Math.min(1, dt * 5.0);
      } else {
        m.vy -= GRAVITY * dt;
        if (m.spec.slowFall && m.vy < -2.4) {
          m.vy = -2.4; // Chickens flutter down gently!
        }
      }

      const hw = m.spec.width * 0.45;
      const h = m.spec.height;

      // Vertical move
      const ny = m.y + m.vy * dt;
      if (!this._collidesSolid(world, m.x, ny, m.z, hw, h)) {
        m.y = ny;
        m.onGround = false;
      } else {
        if (m.vy < 0) m.onGround = true;
        m.vy = 0;
      }

      // Horizontal X & Z move + automatic 1-block obstacle jump
      let blockedHoriz = false;
      const nx = m.x + m.vx * dt;
      if (!this._collidesSolid(world, nx, m.y + 0.02, m.z, hw, h - 0.04)) {
        m.x = nx;
      } else {
        blockedHoriz = true;
        m.vx = 0;
      }

      const nz = m.z + m.vz * dt;
      if (!this._collidesSolid(world, m.x, m.y + 0.02, nz, hw, h - 0.04)) {
        m.z = nz;
      } else {
        blockedHoriz = true;
        m.vz = 0;
      }

      if (blockedHoriz && m.onGround && targetSpeed > 0.2) {
        m.vy = 8.4;
        m.onGround = false;
      }

      // Animate articulated limbs & head look
      m.model.root.position.set(m.x, m.y, m.z);
      m.model.root.rotation.y = m.yaw;

      const horizSpeed = Math.hypot(m.vx, m.vz);
      if (horizSpeed > 0.15) {
        m.walkPhase += dt * horizSpeed * 3.8;
      } else {
        m.walkPhase += dt * 1.2;
      }

      const swing = horizSpeed > 0.15 ? Math.sin(m.walkPhase) * 0.65 : 0;
      for (let li = 0; li < m.model.legs.length; li++) {
        const leg = m.model.legs[li];
        if (m.type === 'spider') {
          leg.rotation.y = (li % 2 === 0 ? 1 : -1) * swing * 0.45;
        } else {
          leg.rotation.x = (li % 2 === 0 ? 1 : -1) * swing;
        }
      }

      if (m.model.wings.length > 0) {
        const flap = !m.onGround ? Math.abs(Math.sin(performance.now() * 0.022)) * 0.9 : 0.05;
        m.model.wings[0].rotation.z = flap;
        m.model.wings[1].rotation.z = -flap;
      }

      if (m.model.head && distSq < 9 * 9) {
        m.model.head.rotation.x = Math.sin(m.walkPhase * 0.5) * 0.06;
      }
    }
  }

  clear() {
    for (const m of this.mobs) {
      this.group.remove(m.model.root);
    }
    this.mobs = [];
  }
}
