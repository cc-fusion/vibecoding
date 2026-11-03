import * as THREE from 'three';
import { SEA_LEVEL, GRAVITY, GAME_MODES, BIOMES } from './constants.js';
import { BLOCK, ITEM, getBlockDef, isSolidBlock, isWaterBlock } from './blocks.js';

const MAX_MOBS = 18;
const MAX_DROPS = 90;

function makeBox(w, h, d, hex, pivotTop = false) {
  const geom = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) {
    geom.translate(0, -h * 0.5, 0);
  }
  const mat = new THREE.MeshLambertMaterial({ color: hex });
  return new THREE.Mesh(geom, mat);
}

function buildMobModel(type) {
  const root = new THREE.Group();
  const limbs = [];
  const materials = [];

  const registerMesh = (m) => {
    materials.push(m.material);
    return m;
  };

  if (type === 'sheep') {
    const body = registerMesh(makeBox(0.68, 0.58, 0.96, 0xf2f2ee));
    body.position.set(0, 0.68, 0);
    root.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.88, 0.52);
    const head = registerMesh(makeBox(0.42, 0.42, 0.44, 0xd8c5ad));
    const woolCap = registerMesh(makeBox(0.46, 0.2, 0.42, 0xf5f5f0));
    woolCap.position.set(0, 0.16, -0.02);
    const eyeL = registerMesh(makeBox(0.07, 0.07, 0.05, 0x222222));
    eyeL.position.set(-0.13, 0.03, 0.22);
    const eyeR = registerMesh(makeBox(0.07, 0.07, 0.05, 0x222222));
    eyeR.position.set(0.13, 0.03, 0.22);
    headGroup.add(head, woolCap, eyeL, eyeR);
    root.add(headGroup);

    const legCoords = [
      [-0.2, 0.42, 0.3],
      [0.2, 0.42, 0.3],
      [-0.2, 0.42, -0.3],
      [0.2, 0.42, -0.3],
    ];
    for (const [lx, ly, lz] of legCoords) {
      const leg = registerMesh(makeBox(0.18, 0.42, 0.18, 0xcab69e, true));
      leg.position.set(lx, ly, lz);
      root.add(leg);
      limbs.push(leg);
    }

    return { root, headGroup, limbs, materials, halfW: 0.36, height: 1.15 };
  }

  if (type === 'pig') {
    const body = registerMesh(makeBox(0.62, 0.5, 0.88, 0xf29bb0));
    body.position.set(0, 0.55, 0);
    root.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0.5);
    const head = registerMesh(makeBox(0.46, 0.44, 0.44, 0xf5a6b9));
    const snout = registerMesh(makeBox(0.22, 0.15, 0.1, 0xe07e96));
    snout.position.set(0, -0.06, 0.25);
    const eyeL = registerMesh(makeBox(0.07, 0.07, 0.05, 0x241c1e));
    eyeL.position.set(-0.14, 0.06, 0.22);
    const eyeR = registerMesh(makeBox(0.07, 0.07, 0.05, 0x241c1e));
    eyeR.position.set(0.14, 0.06, 0.22);
    headGroup.add(head, snout, eyeL, eyeR);
    root.add(headGroup);

    const legCoords = [
      [-0.18, 0.32, 0.28],
      [0.18, 0.32, 0.28],
      [-0.18, 0.32, -0.28],
      [0.18, 0.32, -0.28],
    ];
    for (const [lx, ly, lz] of legCoords) {
      const leg = registerMesh(makeBox(0.17, 0.32, 0.17, 0xe3889e, true));
      leg.position.set(lx, ly, lz);
      root.add(leg);
      limbs.push(leg);
    }

    return { root, headGroup, limbs, materials, halfW: 0.34, height: 0.95 };
  }

  if (type === 'chicken') {
    const body = registerMesh(makeBox(0.38, 0.34, 0.46, 0xfafafa));
    body.position.set(0, 0.38, 0);
    root.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62, 0.22);
    const head = registerMesh(makeBox(0.24, 0.28, 0.24, 0xffffff));
    const beak = registerMesh(makeBox(0.14, 0.08, 0.12, 0xf0b429));
    beak.position.set(0, 0.0, 0.16);
    const wattle = registerMesh(makeBox(0.08, 0.1, 0.08, 0xd93030));
    wattle.position.set(0, -0.09, 0.14);
    headGroup.add(head, beak, wattle);
    root.add(headGroup);

    const legL = registerMesh(makeBox(0.06, 0.22, 0.06, 0xe8a923, true));
    legL.position.set(-0.09, 0.22, 0);
    const legR = registerMesh(makeBox(0.06, 0.22, 0.06, 0xe8a923, true));
    legR.position.set(0.09, 0.22, 0);
    root.add(legL, legR);
    limbs.push(legL, legR);

    return { root, headGroup, limbs, materials, halfW: 0.24, height: 0.78 };
  }

  if (type === 'slime') {
    const outerMat = new THREE.MeshLambertMaterial({
      color: 0x57d962,
      transparent: true,
      opacity: 0.68,
    });
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.76, 0.76), outerMat);
    outer.position.set(0, 0.38, 0);
    materials.push(outerMat);

    const core = registerMesh(makeBox(0.44, 0.44, 0.44, 0x2f9e3b));
    core.position.set(0, 0.38, 0);
    const eyeL = registerMesh(makeBox(0.1, 0.1, 0.06, 0x16381a));
    eyeL.position.set(-0.14, 0.46, 0.36);
    const eyeR = registerMesh(makeBox(0.1, 0.1, 0.06, 0x16381a));
    eyeR.position.set(0.14, 0.46, 0.36);
    root.add(core, eyeL, eyeR, outer);

    return { root, headGroup: null, limbs, materials, halfW: 0.38, height: 0.8 };
  }

  // Hostile 'zombie'
  const torso = registerMesh(makeBox(0.48, 0.68, 0.26, 0x2b8a8e));
  torso.position.set(0, 1.04, 0);
  root.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.58, 0);
  const head = registerMesh(makeBox(0.46, 0.46, 0.46, 0x5d9451));
  const eyeL = registerMesh(makeBox(0.09, 0.07, 0.05, 0x141f12));
  eyeL.position.set(-0.11, 0.02, 0.23);
  const eyeR = registerMesh(makeBox(0.09, 0.07, 0.05, 0x141f12));
  eyeR.position.set(0.11, 0.02, 0.23);
  headGroup.add(head, eyeL, eyeR);
  root.add(headGroup);

  // Outstretched zombie arms
  const armL = registerMesh(makeBox(0.2, 0.64, 0.2, 0x5d9451, true));
  armL.position.set(-0.35, 1.34, 0);
  armL.rotation.x = -Math.PI * 0.44;
  const armR = registerMesh(makeBox(0.2, 0.64, 0.2, 0x5d9451, true));
  armR.position.set(0.35, 1.34, 0);
  armR.rotation.x = -Math.PI * 0.44;
  root.add(armL, armR);

  const legL = registerMesh(makeBox(0.22, 0.7, 0.22, 0x3b448c, true));
  legL.position.set(-0.13, 0.7, 0);
  const legR = registerMesh(makeBox(0.22, 0.7, 0.22, 0x3b448c, true));
  legR.position.set(0.13, 0.7, 0);
  root.add(legL, legR);
  limbs.push(legL, legR);

  return { root, headGroup, limbs, materials, halfW: 0.32, height: 1.82 };
}

export class EntityManager {
  constructor({ scene, world, textures, particles, sound }) {
    this.scene = scene;
    this.world = world;
    this.textures = textures;
    this.particles = particles;
    this.sound = sound;

    this.entityGroup = new THREE.Group();
    this.scene.add(this.entityGroup);

    this.drops = [];
    this.mobs = [];
    this.spawnTimer = 2.0;

    // Shared mini block geometry cache for item drops
    this.dropMeshCache = new Map();
  }

  setWorld(world) {
    this.clearAll();
    this.world = world;
  }

  clearAll() {
    for (const d of this.drops) {
      this.entityGroup.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
    }
    this.drops = [];

    for (const m of this.mobs) {
      this.entityGroup.remove(m.model.root);
    }
    this.mobs = [];
  }

  createDropVisual(itemId) {
    const def = getBlockDef(itemId);
    if (def.isBlock && def.renderType !== 'cross' && def.renderType !== 'torch') {
      const geom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const uvAttr = geom.attributes.uv;
      const dirs = ['east', 'west', 'top', 'bottom', 'south', 'north'];
      for (let f = 0; f < 6; f++) {
        const uv = this.textures.getBlockFaceUVs(itemId, dirs[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, uv.u0, uv.v1);
        uvAttr.setXY(base + 1, uv.u1, uv.v1);
        uvAttr.setXY(base + 2, uv.u0, uv.v0);
        uvAttr.setXY(base + 3, uv.u1, uv.v0);
      }
      uvAttr.needsUpdate = true;
      const mat = new THREE.MeshLambertMaterial({ map: this.textures.atlasTexture });
      return new THREE.Mesh(geom, mat);
    }

    // Flat 2D crisp sprite/plate for tools, ores, flora, torches
    const iconUrl = this.textures.getItemIconURL(itemId);
    const tex = new THREE.TextureLoader().load(iconUrl);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const geom = new THREE.PlaneGeometry(0.38, 0.38);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geom, mat);
  }

  spawnDrop(x, y, z, itemId, count = 1) {
    if (!itemId || count <= 0) return;
    while (this.drops.length >= MAX_DROPS) {
      const oldest = this.drops.shift();
      this.entityGroup.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
      oldest.mesh.material.dispose();
    }

    const mesh = this.createDropVisual(itemId);
    mesh.position.set(x, y, z);
    this.entityGroup.add(mesh);

    this.drops.push({
      id: itemId,
      count,
      mesh,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 1.35,
      vy: 3.1 + Math.random() * 1.1,
      vz: (Math.random() - 0.5) * 1.35,
      age: 0,
      pickupDelay: 0.24,
    });
  }

  spawnMob(type, x, y, z) {
    if (this.mobs.length >= MAX_MOBS) return null;
    const model = buildMobModel(type);
    model.root.position.set(x, y, z);
    this.entityGroup.add(model.root);

    const isHostile = type === 'zombie' || type === 'slime';
    const maxHp =
      type === 'zombie' ? 16 :
      type === 'slime' ? 10 :
      type === 'sheep' || type === 'pig' ? 8 : 5;

    const mob = {
      type,
      hostile: isHostile,
      model,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      targetYaw: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      hurtTimer: 0,
      attackCooldown: 0,
      aiTimer: 1 + Math.random() * 3,
      moving: false,
      onGround: false,
      walkPhase: Math.random() * 10,
      hopTimer: 0.8,
      baseColors: model.materials.map((m) => m.color.getHex()),
    };
    this.mobs.push(mob);
    return mob;
  }

  tryNaturalSpawns(playerPos, isNight, gameMode) {
    if (!this.world || this.mobs.length >= MAX_MOBS) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 20;
    const sx = Math.floor(playerPos.x + Math.cos(angle) * dist) + 0.5;
    const sz = Math.floor(playerPos.z + Math.sin(angle) * dist) + 0.5;

    const { cx, cz } = this.world.worldToChunk(sx, sz);
    if (!this.world.getChunk(cx, cz)) return;

    const sy = this.world.getSurfaceHeight(sx, sz);
    if (sy <= SEA_LEVEL) return;

    const groundBlock = this.world.getBlock(sx, sy, sz);
    const aboveBlock = this.world.getBlock(sx, sy + 1, sz);
    if (isWaterBlock(groundBlock) || isWaterBlock(aboveBlock) || groundBlock === BLOCK.CACTUS) return;

    const biome = this.world.generator.getBiomeAt(sx, sz);

    if (isNight && gameMode === GAME_MODES.SURVIVAL) {
      const torchLight = this.world.getTorchLight(sx, sy + 1, sz);
      if (torchLight < 6) {
        const hostileType = Math.random() < 0.68 ? 'zombie' : 'slime';
        this.spawnMob(hostileType, sx, sy + 1.02, sz);
        return;
      }
    }

    // Daytime passive animals on grassy/snowy terrain
    if (biome !== BIOMES.DESERT && (groundBlock === BLOCK.GRASS || groundBlock === BLOCK.SNOW_GRASS)) {
      const r = Math.random();
      const animalType = r < 0.42 ? 'sheep' : r < 0.76 ? 'pig' : 'chicken';
      this.spawnMob(animalType, sx, sy + 1.02, sz);
    }
  }

  collidesMob(x, y, z, halfW, height) {
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height - 0.01);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolidBlock(this.world.getBlock(bx, by, bz))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  raycastMob(origin, dir, maxDist = 4.2) {
    let closest = null;
    let closestT = maxDist;
    const ray = new THREE.Ray(origin, dir);
    const box = new THREE.Box3();

    for (const mob of this.mobs) {
      const hw = mob.model.halfW + 0.1;
      box.min.set(mob.x - hw, mob.y, mob.z - hw);
      box.max.set(mob.x + hw, mob.y + mob.model.height + 0.1, mob.z + hw);
      const hitPt = new THREE.Vector3();
      if (ray.intersectBox(box, hitPt)) {
        const t = origin.distanceTo(hitPt);
        if (t < closestT) {
          closestT = t;
          closest = mob;
        }
      }
    }
    return closest;
  }

  damageMob(mob, amount, knockDirX = 0, knockDirZ = 0) {
    if (!mob || mob.hurtTimer > 0.12) return false;
    mob.hp -= amount;
    mob.hurtTimer = 0.26;
    mob.vy = 4.6;
    mob.vx += knockDirX * 6.5;
    mob.vz += knockDirZ * 6.5;

    this.sound.playHurt();
    this.particles.spawnHitBurst(mob.x, mob.y + mob.model.height * 0.55, mob.z, '#ff5959');

    // Passive animals panic-sprint briefly when struck
    if (!mob.hostile) {
      mob.moving = true;
      mob.aiTimer = 2.2;
      mob.targetYaw = Math.atan2(knockDirX, knockDirZ);
    }

    if (mob.hp <= 0) {
      this.killMob(mob);
    }
    return true;
  }

  killMob(mob) {
    const idx = this.mobs.indexOf(mob);
    if (idx !== -1) this.mobs.splice(idx, 1);
    this.entityGroup.remove(mob.model.root);
    this.particles.spawnHitBurst(mob.x, mob.y + 0.5, mob.z, '#ffffff');

    // Loot drops
    if (mob.type === 'sheep') {
      this.spawnDrop(mob.x, mob.y + 0.4, mob.z, BLOCK.WOOL_WHITE, 1);
      this.spawnDrop(mob.x + 0.15, mob.y + 0.4, mob.z, ITEM.RAW_MEAT, 1);
    } else if (mob.type === 'pig') {
      this.spawnDrop(mob.x, mob.y + 0.4, mob.z, ITEM.RAW_MEAT, 2);
    } else if (mob.type === 'chicken') {
      this.spawnDrop(mob.x, mob.y + 0.35, mob.z, ITEM.RAW_MEAT, 1);
    } else if (mob.type === 'zombie') {
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, Math.random() < 0.5 ? ITEM.COAL : ITEM.APPLE, 1);
    } else if (mob.type === 'slime') {
      this.spawnDrop(mob.x, mob.y + 0.4, mob.z, BLOCK.GLOWSTONE, 1);
    }
  }

  update(dt, player, inventory, isNight, gameMode) {
    if (!this.world) return;
    const pPos = player.position;

    // 1. Periodic natural mob spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.8;
      this.tryNaturalSpawns(pPos, isNight, gameMode);
    }

    // 2. Update Dropped Items (physics + magnetic collection)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > 180) {
        this.entityGroup.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.drops.splice(i, 1);
        continue;
      }

      d.vy -= GRAVITY * 0.75 * dt;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      const nz = d.z + d.vz * dt;

      if (!isSolidBlock(this.world.getBlock(nx, d.y, d.z))) d.x = nx;
      else d.vx *= -0.3;

      if (!isSolidBlock(this.world.getBlock(d.x, d.y, nz))) d.z = nz;
      else d.vz *= -0.3;

      if (!isSolidBlock(this.world.getBlock(d.x, ny - 0.16, d.z))) {
        d.y = ny;
      } else {
        d.y = Math.floor(ny - 0.16) + 1.16;
        d.vy = 0;
        d.vx *= 0.8;
        d.vz *= 0.8;
      }

      // Magnetic pickup toward player
      const dx = pPos.x - d.x;
      const dy = (pPos.y + 0.85) - d.y;
      const dz = pPos.z - d.z;
      const dist = Math.hypot(dx, dy, dz);

      if (d.age >= d.pickupDelay && dist < 2.85) {
        const pull = (1 - dist / 2.85) * 16 * dt;
        d.x += (dx / Math.max(0.1, dist)) * pull;
        d.y += (dy / Math.max(0.1, dist)) * pull;
        d.z += (dz / Math.max(0.1, dist)) * pull;

        if (dist < 0.85) {
          const rem = inventory.addItem(d.id, d.count);
          if (rem < d.count) {
            this.sound.playPickup();
            player.notifyInventoryChange?.();
            if (rem <= 0) {
              this.entityGroup.remove(d.mesh);
              d.mesh.geometry.dispose();
              d.mesh.material.dispose();
              this.drops.splice(i, 1);
              continue;
            } else {
              d.count = rem;
            }
          }
        }
      }

      d.mesh.rotation.y += dt * 2.1;
      d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3.2) * 0.07, d.z);
    }

    // 3. Update Mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dxP = pPos.x - m.x;
      const dyP = pPos.y - m.y;
      const dzP = pPos.z - m.z;
      const distP = Math.hypot(dxP, dzP);

      // Despawn very distant mobs
      if (distP > 58 || m.y < -5) {
        this.entityGroup.remove(m.model.root);
        this.mobs.splice(i, 1);
        continue;
      }

      // Zombies burn in bright daylight under open sky
      if (m.type === 'zombie' && !isNight && this.world.getSkyLight(m.x, m.y + 1, m.z) >= 13) {
        m.burnTick = (m.burnTick || 0) + dt;
        if (m.burnTick > 1.2) {
          m.burnTick = 0;
          this.damageMob(m, 3, 0, 0);
          if (m.hp <= 0) continue;
        }
      }

      if (m.hurtTimer > 0) {
        m.hurtTimer -= dt;
        m.model.materials.forEach((mat, idx) => {
          mat.color.setHex(m.hurtTimer > 0 ? 0xff4d4d : m.baseColors[idx]);
        });
      }

      if (m.attackCooldown > 0) m.attackCooldown -= dt;

      // AI state selection
      let moveSpeed = 0;
      const aggro = m.hostile && gameMode === GAME_MODES.SURVIVAL && distP < 17 && Math.abs(dyP) < 10;

      if (aggro) {
        m.targetYaw = Math.atan2(dxP, dzP);
        m.moving = true;
        moveSpeed = m.type === 'zombie' ? 2.65 : 2.2;

        if (m.type === 'slime' && m.onGround) {
          m.hopTimer -= dt;
          if (m.hopTimer <= 0) {
            m.vy = 6.8;
            m.hopTimer = 0.75 + Math.random() * 0.35;
          }
        }

        // Melee contact hit against player
        if (distP < 1.08 && Math.abs(dyP) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.05;
          const dmg = m.type === 'zombie' ? 3 : 2;
          player.takeDamage(dmg, dxP / Math.max(0.1, distP), dzP / Math.max(0.1, distP));
        }
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.5;
          m.moving = Math.random() < 0.62;
          if (m.moving) {
            m.targetYaw += (Math.random() - 0.5) * Math.PI * 1.3;
          }
        }
        if (m.moving) {
          moveSpeed = m.hurtTimer > 0 ? 3.4 : 1.45;
        }
      }

      // Smooth yaw turn
      let diff = m.targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, dt * 7);

      const desiredVX = Math.sin(m.yaw) * moveSpeed;
      const desiredVZ = Math.cos(m.yaw) * moveSpeed;
      m.vx = m.vx * 0.78 + desiredVX * 0.22;
      m.vz = m.vz * 0.78 + desiredVZ * 0.22;

      const inWater = isWaterBlock(this.world.getBlock(m.x, m.y + 0.35, m.z));
      if (inWater) {
        m.vy += 12 * dt;
        m.vy = Math.min(2.5, m.vy);
      } else {
        const gravScale = m.type === 'chicken' && m.vy < 0 ? 0.38 : 1.0;
        m.vy -= GRAVITY * gravScale * dt;
      }

      const hw = m.model.halfW;
      const mh = m.model.height;

      // Move X
      const nextX = m.x + m.vx * dt;
      if (!this.collidesMob(nextX, m.y, m.z, hw, mh)) {
        m.x = nextX;
      } else if (m.onGround && !this.collidesMob(nextX, m.y + 1.05, m.z, hw, mh)) {
        m.vy = JUMP_MOB;
      } else {
        m.vx = 0;
        if (!aggro) m.targetYaw += Math.PI * 0.6;
      }

      // Move Z
      const nextZ = m.z + m.vz * dt;
      if (!this.collidesMob(m.x, m.y, nextZ, hw, mh)) {
        m.z = nextZ;
      } else if (m.onGround && !this.collidesMob(m.x, m.y + 1.05, nextZ, hw, mh)) {
        m.vy = JUMP_MOB;
      } else {
        m.vz = 0;
        if (!aggro) m.targetYaw += Math.PI * 0.6;
      }

      // Move Y
      const nextY = m.y + m.vy * dt;
      if (!this.collidesMob(m.x, nextY, m.z, hw, mh)) {
        m.y = nextY;
        m.onGround = false;
      } else {
        if (m.vy < 0) {
          m.y = Math.floor(nextY) + 1.001;
          m.onGround = true;
        }
        m.vy = 0;
      }

      // Animate legs & head
      const horizSpeed = Math.hypot(m.vx, m.vz);
      if (horizSpeed > 0.15) {
        m.walkPhase += dt * horizSpeed * 4.5;
        const swing = Math.sin(m.walkPhase) * 0.65;
        m.model.limbs.forEach((limb, idx) => {
          limb.rotation.x = idx % 2 === 0 ? swing : -swing;
        });
      } else {
        m.model.limbs.forEach((limb) => {
          limb.rotation.x *= 0.85;
        });
      }

      if (m.model.headGroup && distP < 9) {
        m.model.headGroup.rotation.x = Math.sin(performance.now() * 0.002 + i) * 0.08;
      }

      m.model.root.position.set(m.x, m.y, m.z);
      m.model.root.rotation.y = m.yaw;
    }
  }
}

const JUMP_MOB = 7.8;
