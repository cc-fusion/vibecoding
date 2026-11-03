import * as THREE from 'three';
import { GRAVITY, SEA_LEVEL, GAME_MODES, BIOMES } from '../constants.js';
import { BLOCK_IDS, ITEM_IDS, getItemDef } from '../data/blocks.js';

const MOB_DEFS = {
  sheep: {
    name: 'Meadow Sheep',
    hostile: false,
    maxHp: 10,
    speed: 1.9,
    fleeSpeed: 4.1,
    width: 0.8,
    height: 1.2,
    drops: () => [
      { id: BLOCK_IDS.WOOL, count: 1 + (Math.random() < 0.45 ? 1 : 0) },
      { id: ITEM_IDS.RAW_MEAT, count: 1 },
    ],
  },
  cow: {
    name: 'Highland Cow',
    hostile: false,
    maxHp: 12,
    speed: 1.75,
    fleeSpeed: 3.9,
    width: 0.85,
    height: 1.35,
    drops: () => [
      { id: ITEM_IDS.RAW_MEAT, count: 1 + (Math.random() < 0.6 ? 1 : 0) },
      { id: ITEM_IDS.LEATHER, count: 1 },
    ],
  },
  pig: {
    name: 'Rosy Pig',
    hostile: false,
    maxHp: 10,
    speed: 2.0,
    fleeSpeed: 4.2,
    width: 0.75,
    height: 0.95,
    drops: () => [{ id: ITEM_IDS.RAW_MEAT, count: 1 + (Math.random() < 0.5 ? 1 : 0) }],
  },
  chicken: {
    name: 'Wild Chicken',
    hostile: false,
    maxHp: 6,
    speed: 2.2,
    fleeSpeed: 4.4,
    width: 0.5,
    height: 0.7,
    drops: () => [{ id: ITEM_IDS.RAW_MEAT, count: 1 }],
  },
  zombie: {
    name: 'Night Husk',
    hostile: true,
    burnsInSun: true,
    maxHp: 18,
    speed: 3.1,
    attackDamage: 3,
    width: 0.65,
    height: 1.85,
    drops: () =>
      Math.random() < 0.35
        ? [{ id: ITEM_IDS.IRON_INGOT, count: 1 }]
        : [{ id: ITEM_IDS.COAL, count: 1 }],
  },
  stalker: {
    name: 'Shadow Crawler',
    hostile: true,
    burnsInSun: false,
    maxHp: 14,
    speed: 3.7,
    attackDamage: 2,
    width: 0.95,
    height: 0.75,
    drops: () => [{ id: ITEM_IDS.COAL, count: 1 + (Math.random() < 0.4 ? 1 : 0) }],
  },
};

function makeBox(w, h, d, colorHex, x = 0, y = 0, z = 0) {
  const mat = new THREE.MeshLambertMaterial({ color: colorHex });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.userData.baseColor = colorHex;
  return mesh;
}

function buildMobModel(type) {
  const root = new THREE.Group();
  const limbs = [];
  const meshes = [];

  const addPart = (parent, part) => {
    parent.add(part);
    meshes.push(part);
    return part;
  };

  if (type === 'sheep') {
    addPart(root, makeBox(0.72, 0.62, 1.02, 0xf2f3f7, 0, 0.74, 0)); // Fluffy wool coat
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.95, 0.52);
    addPart(headPivot, makeBox(0.42, 0.42, 0.46, 0x594d46, 0, 0, 0.14));
    addPart(headPivot, makeBox(0.46, 0.18, 0.36, 0xf2f3f7, 0, 0.18, 0.08)); // Wool cap
    root.add(headPivot);

    const legCoords = [[-0.2, 0.34], [0.2, 0.34], [-0.2, -0.34], [0.2, -0.34]];
    for (const [lx, lz] of legCoords) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.45, lz);
      addPart(piv, makeBox(0.18, 0.45, 0.18, 0x594d46, 0, -0.225, 0));
      root.add(piv);
      limbs.push(piv);
    }
    return { root, headPivot, limbs, meshes };
  }

  if (type === 'cow') {
    addPart(root, makeBox(0.76, 0.66, 1.12, 0x5e3e29, 0, 0.82, 0));
    addPart(root, makeBox(0.78, 0.36, 0.42, 0xebe6dc, 0, 0.86, 0.1)); // Cream patch
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.02, 0.58);
    addPart(headPivot, makeBox(0.46, 0.46, 0.44, 0x5e3e29, 0, 0, 0.16));
    addPart(headPivot, makeBox(0.32, 0.18, 0.12, 0xd9b39b, 0, -0.1, 0.39)); // Muzzle
    addPart(headPivot, makeBox(0.08, 0.18, 0.08, 0xd8d2c5, -0.25, 0.24, 0.12)); // Horn L
    addPart(headPivot, makeBox(0.08, 0.18, 0.08, 0xd8d2c5, 0.25, 0.24, 0.12)); // Horn R
    root.add(headPivot);

    const legCoords = [[-0.22, 0.38], [0.22, 0.38], [-0.22, -0.38], [0.22, -0.38]];
    for (const [lx, lz] of legCoords) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.5, lz);
      addPart(piv, makeBox(0.2, 0.5, 0.2, 0x4a3020, 0, -0.25, 0));
      root.add(piv);
      limbs.push(piv);
    }
    return { root, headPivot, limbs, meshes };
  }

  if (type === 'pig') {
    addPart(root, makeBox(0.64, 0.52, 0.92, 0xf09ca8, 0, 0.58, 0));
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.68, 0.46);
    addPart(headPivot, makeBox(0.44, 0.42, 0.42, 0xf09ca8, 0, 0, 0.16));
    addPart(headPivot, makeBox(0.22, 0.16, 0.12, 0xe07b8a, 0, -0.06, 0.39)); // Snout
    root.add(headPivot);

    const legCoords = [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]];
    for (const [lx, lz] of legCoords) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.34, lz);
      addPart(piv, makeBox(0.17, 0.34, 0.17, 0xd98290, 0, -0.17, 0));
      root.add(piv);
      limbs.push(piv);
    }
    return { root, headPivot, limbs, meshes };
  }

  if (type === 'chicken') {
    addPart(root, makeBox(0.38, 0.34, 0.46, 0xf7f8fa, 0, 0.38, 0));
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.56, 0.2);
    addPart(headPivot, makeBox(0.24, 0.3, 0.24, 0xf7f8fa, 0, 0.08, 0.06));
    addPart(headPivot, makeBox(0.14, 0.08, 0.14, 0xf2b632, 0, 0.08, 0.22)); // Beak
    addPart(headPivot, makeBox(0.08, 0.1, 0.08, 0xd92b2b, 0, -0.02, 0.19)); // Wattle
    root.add(headPivot);

    for (const lx of [-0.1, 0.1]) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.22, 0);
      addPart(piv, makeBox(0.06, 0.22, 0.06, 0xe8a628, 0, -0.11, 0));
      root.add(piv);
      limbs.push(piv);
    }
    return { root, headPivot, limbs, meshes };
  }

  if (type === 'zombie') {
    addPart(root, makeBox(0.48, 0.68, 0.26, 0x2f7d87, 0, 1.06, 0)); // Tunic
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.4, 0);
    addPart(headPivot, makeBox(0.46, 0.46, 0.46, 0x4d8249, 0, 0.23, 0));
    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8ef5a2 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), eyeMat);
    eyeL.position.set(-0.1, 0.24, 0.23);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    headPivot.add(eyeL, eyeR);
    root.add(headPivot);

    // Outstretched zombie arms
    for (const ax of [-0.35, 0.35]) {
      addPart(root, makeBox(0.2, 0.2, 0.62, 0x4d8249, ax, 1.28, 0.24));
    }

    for (const lx of [-0.13, 0.13]) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.72, 0);
      addPart(piv, makeBox(0.21, 0.72, 0.22, 0x3b4978, 0, -0.36, 0));
      root.add(piv);
      limbs.push(piv);
    }
    return { root, headPivot, limbs, meshes };
  }

  // Shadow Crawler (spider-like)
  addPart(root, makeBox(0.52, 0.36, 0.78, 0x22242b, 0, 0.36, -0.08));
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.38, 0.32);
  addPart(headPivot, makeBox(0.38, 0.32, 0.34, 0x2c2f38, 0, 0, 0.1));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b4e });
  for (const ex of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), eyeMat);
    eye.position.set(ex, 0.04, 0.27);
    headPivot.add(eye);
  }
  root.add(headPivot);

  for (const [lx, lz] of [[-0.36, 0.18], [0.36, 0.18], [-0.36, -0.22], [0.36, -0.22]]) {
    const piv = new THREE.Group();
    piv.position.set(lx, 0.3, lz);
    addPart(piv, makeBox(0.28, 0.1, 0.1, 0x1c1e24, lx < 0 ? -0.1 : 0.1, -0.1, 0));
    root.add(piv);
    limbs.push(piv);
  }
  return { root, headPivot, limbs, meshes };
}

export class EntityManager {
  constructor(scene, world, atlas, particles, audio) {
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.particles = particles;
    this.audio = audio;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.droppedItems = [];
    this.mobs = [];
    this.spawnTimer = 2.0;

    // Hook world container / unsupported flora drops automatically
    this.world.onDropItem = (wx, wy, wz, id, count) => {
      this.spawnDroppedItem(wx, wy, wz, id, count);
    };
  }

  createDropMesh(id) {
    const def = getItemDef(id);
    if (def.isBlock && def.opaque) {
      const uvTop = this.atlas.getBlockFaceUV(def, 'top', 0);
      const uvSide = this.atlas.getBlockFaceUV(def, 'pz', 0);
      const geom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const uvAttr = geom.getAttribute('uv');
      // Map all faces cleanly to atlas UVs
      for (let face = 0; face < 6; face++) {
        const rect = face === 2 ? uvTop : uvSide;
        const base = face * 4;
        uvAttr.setXY(base + 0, rect.u0, rect.v1);
        uvAttr.setXY(base + 1, rect.u1, rect.v1);
        uvAttr.setXY(base + 2, rect.u0, rect.v0);
        uvAttr.setXY(base + 3, rect.u1, rect.v0);
      }
      const mat = new THREE.MeshLambertMaterial({ map: this.atlas.texture });
      return new THREE.Mesh(geom, mat);
    }

    // Non-opaque block or tool/resource item: crisp tinted prism or sprite card
    const iconUrl = this.atlas.getIconUrl(id);
    if (iconUrl && typeof Image !== 'undefined') {
      const tex = new THREE.TextureLoader().load(iconUrl);
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), mat);
    }

    const fallbackMat = new THREE.MeshLambertMaterial({ color: def.particleColor || 0xe0c068 });
    return new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), fallbackMat);
  }

  spawnDroppedItem(x, y, z, id, count = 1, throwDir = null) {
    if (!id || id === BLOCK_IDS.AIR || count <= 0) return;
    const mesh = this.createDropMesh(id);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.droppedItems.push({
      id,
      count,
      x,
      y,
      z,
      vx: throwDir ? throwDir.x * 4.2 : (Math.random() - 0.5) * 2.2,
      vy: throwDir ? throwDir.y * 4.2 + 2.2 : 3.2 + Math.random() * 1.4,
      vz: throwDir ? throwDir.z * 4.2 : (Math.random() - 0.5) * 2.2,
      age: 0,
      pickupDelay: throwDir ? 1.1 : 0.32,
      mesh,
    });
  }

  spawnMob(type, x, y, z) {
    const def = MOB_DEFS[type];
    if (!def) return null;
    const built = buildMobModel(type);
    built.root.position.set(x, y, z);
    this.group.add(built.root);

    const mob = {
      type,
      def,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: def.maxHp,
      onGround: false,
      aiTimer: 1.0 + Math.random() * 2.0,
      wandering: false,
      fleeTimer: 0,
      hurtTimer: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 6,
      ...built,
    };
    this.mobs.push(mob);
    return mob;
  }

  tryNaturalSpawning(playerPos, isNight, mode) {
    if (this.mobs.length >= 16) return;

    const passiveCount = this.mobs.filter((m) => !m.def.hostile).length;
    const hostileCount = this.mobs.filter((m) => m.def.hostile).length;

    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 18;
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);

    // Find ground height in loaded chunk
    let surfaceY = -1;
    for (let y = Math.min(115, Math.floor(playerPos.y + 24)); y >= 12; y--) {
      const bid = this.world.getBlock(wx, y, wz);
      const above1 = this.world.getBlock(wx, y + 1, wz);
      const above2 = this.world.getBlock(wx, y + 2, wz);
      if (
        bid !== BLOCK_IDS.AIR &&
        getItemDef(bid).solid &&
        !getItemDef(bid).liquid &&
        above1 === BLOCK_IDS.AIR &&
        above2 === BLOCK_IDS.AIR
      ) {
        surfaceY = y;
        break;
      }
    }
    if (surfaceY < 0) return;

    const groundId = this.world.getBlock(wx, surfaceY, wz);
    const skyLight = this.world.getSkyLight(wx, surfaceY + 1, wz);
    const blockLight = this.world.getBlockLight(wx, surfaceY + 1, wz);

    // Hostile spawn in Survival at night or in dark caves
    if (
      mode === GAME_MODES.SURVIVAL &&
      hostileCount < 6 &&
      blockLight <= 3 &&
      (isNight || skyLight <= 2)
    ) {
      const hType = Math.random() < 0.65 ? 'zombie' : 'stalker';
      this.spawnMob(hType, wx + 0.5, surfaceY + 1.05, wz + 0.5);
      return;
    }

    // Passive spawn on grass / snowy turf during daytime
    if (
      passiveCount < 10 &&
      !isNight &&
      surfaceY >= SEA_LEVEL &&
      (groundId === BLOCK_IDS.GRASS || groundId === BLOCK_IDS.SNOW_GRASS)
    ) {
      const biome = this.world.generator.getBiomeAt(wx, wz);
      const pool =
        biome.id === BIOMES.TAIGA.id
          ? ['sheep', 'cow']
          : ['sheep', 'cow', 'pig', 'chicken'];
      const pType = pool[Math.floor(Math.random() * pool.length)];
      this.spawnMob(pType, wx + 0.5, surfaceY + 1.05, wz + 0.5);
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
          const bid = this.world.getBlock(bx, by, bz);
          if (bid !== BLOCK_IDS.AIR && getItemDef(bid).solid) {
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

    for (const mob of this.mobs) {
      const hw = mob.def.width * 0.55;
      const minX = mob.x - hw;
      const maxX = mob.x + hw;
      const minY = mob.y;
      const maxY = mob.y + mob.def.height;
      const minZ = mob.z - hw;
      const maxZ = mob.z + hw;

      const invX = dir.x === 0 ? 1e30 : 1 / dir.x;
      const invY = dir.y === 0 ? 1e30 : 1 / dir.y;
      const invZ = dir.z === 0 ? 1e30 : 1 / dir.z;

      const t1 = (minX - origin.x) * invX;
      const t2 = (maxX - origin.x) * invX;
      const t3 = (minY - origin.y) * invY;
      const t4 = (maxY - origin.y) * invY;
      const t5 = (minZ - origin.z) * invZ;
      const t6 = (maxZ - origin.z) * invZ;

      const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
      const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

      if (tmax >= 0 && tmin <= tmax && tmin <= closestT) {
        closestT = Math.max(0, tmin);
        closest = mob;
      }
    }
    return closest;
  }

  damageMob(mob, amount, knockDirX, knockDirZ) {
    mob.hp -= amount;
    mob.hurtTimer = 0.28;
    mob.vx = knockDirX * 5.8;
    mob.vy = 4.6;
    mob.vz = knockDirZ * 5.8;

    if (!mob.def.hostile) {
      mob.fleeTimer = 4.5;
      mob.yaw = Math.atan2(knockDirX, knockDirZ);
    }

    this.audio.playHurt();
    this.particles.emitHitBurst(mob.x, mob.y + mob.def.height * 0.6, mob.z, 0xff5454);

    if (mob.hp <= 0) {
      const drops = mob.def.drops ? mob.def.drops() : [];
      for (const d of drops) {
        this.spawnDroppedItem(mob.x, mob.y + 0.4, mob.z, d.id, d.count);
      }
      this.removeMob(mob);
      return true;
    }
    return false;
  }

  removeMob(mob) {
    this.group.remove(mob.root);
    const idx = this.mobs.indexOf(mob);
    if (idx !== -1) this.mobs.splice(idx, 1);
  }

  update(dt, elapsedTime, player, isNight, mode) {
    const playerPos = player.position;

    // 1. Natural Spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      this.tryNaturalSpawning(playerPos, isNight, mode);
    }

    // 2. Dropped Items Physics & Magnetic Collection
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const d = this.droppedItems[i];
      d.age += dt;
      if (d.age > 240) {
        this.group.remove(d.mesh);
        this.droppedItems.splice(i, 1);
        continue;
      }

      d.vy = Math.max(-18, d.vy - 20.0 * dt);
      const nextY = d.y + d.vy * dt;
      if (getItemDef(this.world.getBlock(d.x, nextY - 0.14, d.z)).solid) {
        d.vy = 0;
        d.vx *= 0.8;
        d.vz *= 0.8;
        d.y = Math.floor(nextY - 0.14) + 1.15;
      } else {
        d.y = nextY;
      }

      const nextX = d.x + d.vx * dt;
      if (!getItemDef(this.world.getBlock(nextX, d.y, d.z)).solid) d.x = nextX;
      const nextZ = d.z + d.vz * dt;
      if (!getItemDef(this.world.getBlock(d.x, d.y, nextZ)).solid) d.z = nextZ;

      d.mesh.position.set(d.x, d.y + Math.sin(elapsedTime * 3.2 + i) * 0.08, d.z);
      d.mesh.rotation.y = elapsedTime * 1.8 + i;

      if (d.age >= d.pickupDelay && !player.isDead) {
        const dx = playerPos.x - d.x;
        const dy = (playerPos.y + 0.85) - d.y;
        const dz = playerPos.z - d.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 2.1) {
          // Magnetic pull
          d.x += (dx / Math.max(0.1, dist)) * dt * 8.5;
          d.y += (dy / Math.max(0.1, dist)) * dt * 8.5;
          d.z += (dz / Math.max(0.1, dist)) * dt * 8.5;

          if (dist < 0.85) {
            const leftover = player.inventory.addItem(d.id, d.count);
            if (leftover < d.count) {
              this.audio.playPickup();
              if (player.onItemCollected) {
                player.onItemCollected(d.id, d.count - leftover);
              }
              if (leftover <= 0) {
                this.group.remove(d.mesh);
                this.droppedItems.splice(i, 1);
                continue;
              } else {
                d.count = leftover;
              }
            }
          }
        }
      }
    }

    // 3. Creature AI & Terrain Movement
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dxToPlayer = playerPos.x - m.x;
      const dzToPlayer = playerPos.z - m.z;
      const distSq = dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer;

      // Despawn far mobs (> 68 blocks) or hostiles in Creative mode
      if (distSq > 68 * 68 || (m.def.hostile && mode === GAME_MODES.CREATIVE)) {
        this.removeMob(m);
        continue;
      }

      // Daylight burn for Zombies under open sky
      if (
        m.def.burnsInSun &&
        !isNight &&
        this.world.getSkyLight(m.x, m.y + 1, m.z) >= 14
      ) {
        m.hp -= dt * 3.5;
        m.hurtTimer = 0.15;
        if (Math.random() < dt * 6) {
          this.particles.emitHitBurst(m.x, m.y + 1.1, m.z, 0xff9326);
        }
        if (m.hp <= 0) {
          this.removeMob(m);
          continue;
        }
      }

      if (m.hurtTimer > 0) m.hurtTimer = Math.max(0, m.hurtTimer - dt);
      if (m.fleeTimer > 0) m.fleeTimer = Math.max(0, m.fleeTimer - dt);
      if (m.attackCooldown > 0) m.attackCooldown = Math.max(0, m.attackCooldown - dt);

      // Tint red briefly when hurt
      for (const part of m.meshes) {
        part.material.color.setHex(m.hurtTimer > 0 ? 0xff5c5c : part.userData.baseColor);
      }

      let targetSpeed = 0;
      if (m.def.hostile && !player.isDead && distSq < 18 * 18) {
        m.yaw = Math.atan2(dxToPlayer, dzToPlayer);
        targetSpeed = m.def.speed;

        // Melee attack check
        const horizDist = Math.hypot(dxToPlayer, dzToPlayer);
        if (horizDist < 1.15 && Math.abs(playerPos.y - m.y) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.15;
          player.takeDamage(m.def.attackDamage, dxToPlayer / Math.max(0.1, horizDist), dzToPlayer / Math.max(0.1, horizDist));
        }
      } else if (m.fleeTimer > 0) {
        targetSpeed = m.def.fleeSpeed;
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.4;
          m.wandering = Math.random() < 0.62;
          if (m.wandering) {
            m.yaw += (Math.random() - 0.5) * 2.4;
          }
        }
        targetSpeed = m.wandering ? m.def.speed : 0;
      }

      const desiredVx = Math.sin(m.yaw) * targetSpeed;
      const desiredVz = Math.cos(m.yaw) * targetSpeed;
      m.vx += (desiredVx - m.vx) * Math.min(1, dt * 7.0);
      m.vz += (desiredVz - m.vz) * Math.min(1, dt * 7.0);

      const inWater = this.world.getBlock(m.x, m.y + 0.3, m.z) === BLOCK_IDS.WATER;
      if (inWater) {
        m.vy = 2.6;
      } else {
        const grav = m.type === 'chicken' && m.vy < 0 ? GRAVITY * 0.32 : GRAVITY;
        m.vy = Math.max(-28, m.vy - grav * dt);
      }

      const hw = m.def.width * 0.45;
      // Move X
      const nx = m.x + m.vx * dt;
      if (!this.collidesMob(nx, m.y, m.z, hw, m.def.height)) {
        m.x = nx;
      } else if (m.onGround) {
        m.vy = 7.8; // Hop 1-block terrain steps!
        m.onGround = false;
      }

      // Move Z
      const nz = m.z + m.vz * dt;
      if (!this.collidesMob(m.x, m.y, nz, hw, m.def.height)) {
        m.z = nz;
      } else if (m.onGround) {
        m.vy = 7.8;
        m.onGround = false;
      }

      // Move Y
      const ny = m.y + m.vy * dt;
      if (!this.collidesMob(m.x, ny, m.z, hw, m.def.height)) {
        m.y = ny;
        m.onGround = false;
      } else {
        if (m.vy < 0) {
          m.y = Math.floor(ny) + 1.001;
          m.onGround = true;
        }
        m.vy = 0;
      }

      m.root.position.set(m.x, m.y, m.z);
      m.root.rotation.y = m.yaw;

      // Animate legs
      const horizSpeed = Math.hypot(m.vx, m.vz);
      if (horizSpeed > 0.15) {
        m.walkPhase += dt * horizSpeed * 3.8;
        const swing = Math.sin(m.walkPhase) * 0.55;
        for (let l = 0; l < m.limbs.length; l++) {
          m.limbs[l].rotation.x = (l % 2 === 0 ? 1 : -1) * swing;
        }
      } else {
        for (let l = 0; l < m.limbs.length; l++) {
          m.limbs[l].rotation.x *= 0.85;
        }
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.droppedItems.length = 0;
    this.mobs.length = 0;
  }
}
