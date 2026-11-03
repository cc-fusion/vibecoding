import * as THREE from 'three';
import { BLOCK, ITEM, getItemDef } from './blocks.js';
import { aabbIntersectsWorld, getBlockTopY } from './physics.js';
import { SEA_LEVEL, GAME_MODES } from './constants.js';

function makeBox(w, h, d, colorHex, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color: colorHex });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function buildCreatureRig(type) {
  const root = new THREE.Group();
  const mats = [];
  const track = (m) => {
    mats.push(m.material);
    return m;
  };

  const legs = [];
  const makeLeg = (w, h, d, hex, px, py, pz) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, pz);
    const mesh = track(makeBox(w, h, d, hex, 0, -h * 0.5, 0));
    pivot.add(mesh);
    root.add(pivot);
    legs.push(pivot);
  };

  let headPivot = new THREE.Group();

  if (type === 'sheep') {
    const body = track(makeBox(0.76, 0.58, 1.05, 0xf2eee4, 0, 0.66, 0));
    root.add(body);
    headPivot.position.set(0, 0.84, 0.54);
    headPivot.add(track(makeBox(0.42, 0.40, 0.44, 0xd8c3a5, 0, 0, 0.12)));
    headPivot.add(track(makeBox(0.46, 0.20, 0.36, 0xf5f2ea, 0, 0.16, 0.08))); // Wool cap
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x222226, -0.13, 0.03, 0.34));
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x222226, 0.13, 0.03, 0.34));
    root.add(headPivot);

    makeLeg(0.20, 0.42, 0.20, 0xd4be9e, -0.22, 0.42, 0.34);
    makeLeg(0.20, 0.42, 0.20, 0xd4be9e, 0.22, 0.42, 0.34);
    makeLeg(0.20, 0.42, 0.20, 0xd4be9e, -0.22, 0.42, -0.34);
    makeLeg(0.20, 0.42, 0.20, 0xd4be9e, 0.22, 0.42, -0.34);
  } else if (type === 'pig') {
    const body = track(makeBox(0.68, 0.50, 0.96, 0xf0a1a8, 0, 0.54, 0));
    root.add(body);
    headPivot.position.set(0, 0.64, 0.48);
    headPivot.add(track(makeBox(0.44, 0.42, 0.42, 0xf2a6ae, 0, 0, 0.14)));
    headPivot.add(track(makeBox(0.22, 0.16, 0.12, 0xe0828c, 0, -0.06, 0.38))); // Snout
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x241e22, -0.14, 0.06, 0.35));
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x241e22, 0.14, 0.06, 0.35));
    root.add(headPivot);

    makeLeg(0.18, 0.32, 0.18, 0xe08d96, -0.20, 0.32, 0.30);
    makeLeg(0.18, 0.32, 0.18, 0xe08d96, 0.20, 0.32, 0.30);
    makeLeg(0.18, 0.32, 0.18, 0xe08d96, -0.20, 0.32, -0.30);
    makeLeg(0.18, 0.32, 0.18, 0xe08d96, 0.20, 0.32, -0.30);
  } else if (type === 'cow') {
    const body = track(makeBox(0.80, 0.64, 1.16, 0x5c4032, 0, 0.78, 0));
    root.add(body);
    root.add(track(makeBox(0.82, 0.36, 0.46, 0xede6da, 0, 0.84, 0.1))); // Cream patch
    headPivot.position.set(0, 0.94, 0.58);
    headPivot.add(track(makeBox(0.46, 0.44, 0.44, 0x5c4032, 0, 0, 0.14)));
    headPivot.add(makeBox(0.08, 0.18, 0.08, 0xd8d0c0, -0.25, 0.22, 0.12)); // Horns
    headPivot.add(makeBox(0.08, 0.18, 0.08, 0xd8d0c0, 0.25, 0.22, 0.12));
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x1e1b18, -0.15, 0.05, 0.36));
    headPivot.add(makeBox(0.07, 0.07, 0.05, 0x1e1b18, 0.15, 0.05, 0.36));
    root.add(headPivot);

    makeLeg(0.20, 0.48, 0.20, 0x4c3428, -0.24, 0.48, 0.38);
    makeLeg(0.20, 0.48, 0.20, 0x4c3428, 0.24, 0.48, 0.38);
    makeLeg(0.20, 0.48, 0.20, 0x4c3428, -0.24, 0.48, -0.38);
    makeLeg(0.20, 0.48, 0.20, 0x4c3428, 0.24, 0.48, -0.38);
  } else {
    // Nocturnal Shadow Stalker (hostile creature)
    const torso = track(makeBox(0.50, 0.68, 0.28, 0x2c3e35, 0, 1.04, 0));
    root.add(torso);
    headPivot.position.set(0, 1.38, 0);
    headPivot.add(track(makeBox(0.46, 0.46, 0.46, 0x364f42, 0, 0.23, 0)));
    // Glowing eyes!
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x56f2e8 });
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.05), eyeMat);
    e1.position.set(-0.11, 0.24, 0.23);
    const e2 = e1.clone();
    e2.position.set(0.11, 0.24, 0.23);
    headPivot.add(e1, e2);
    root.add(headPivot);

    // Outstretched arms
    const armL = track(makeBox(0.18, 0.60, 0.18, 0x364f42, -0.35, 1.12, 0.22));
    armL.rotation.x = -Math.PI * 0.42;
    const armR = track(makeBox(0.18, 0.60, 0.18, 0x364f42, 0.35, 1.12, 0.22));
    armR.rotation.x = -Math.PI * 0.42;
    root.add(armL, armR);

    makeLeg(0.20, 0.70, 0.20, 0x232d36, -0.13, 0.70, 0);
    makeLeg(0.20, 0.70, 0.20, 0x232d36, 0.13, 0.70, 0);
  }

  return { root, headPivot, legs, mats };
}

export class EntityManager {
  constructor(scene, iconUrls) {
    this.scene = scene;
    this.iconUrls = iconUrls;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.drops = [];
    this.creatures = [];
    this.iconTexCache = new Map();
    this.spawnTimer = 2.0;
  }

  getIconTexture(id) {
    if (this.iconTexCache.has(id)) return this.iconTexCache.get(id);
    const url = this.iconUrls[id];
    const tex = new THREE.TextureLoader().load(url);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    this.iconTexCache.set(id, tex);
    return tex;
  }

  spawnDrop(id, count, x, y, z, impulse = null) {
    if (!id || id === BLOCK.AIR || count <= 0) return;
    const def = getItemDef(id);
    const tex = this.getIconTexture(id);

    let mesh;
    if (def.isBlock && def.renderType === 'cube') {
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      const geo = new THREE.PlaneGeometry(0.36, 0.36);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.drops.push({
      id,
      count,
      mesh,
      x,
      y,
      z,
      vx: impulse ? impulse.x : (Math.random() - 0.5) * 1.4,
      vy: impulse ? impulse.y : 2.5 + Math.random() * 1.0,
      vz: impulse ? impulse.z : (Math.random() - 0.5) * 1.4,
      age: 0,
    });
  }

  spawnCreature(type, x, y, z) {
    const rig = buildCreatureRig(type);
    rig.root.position.set(x, y, z);
    this.group.add(rig.root);

    const isHostile = type === 'stalker';
    const maxHp = type === 'cow' ? 14 : (isHostile ? 18 : 10);

    this.creatures.push({
      type,
      hostile: isHostile,
      rig,
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
      radius: isHostile ? 0.32 : 0.42,
      height: isHostile ? 1.82 : 1.15,
      onGround: false,
      aiTimer: 1 + Math.random() * 3,
      moving: false,
      panicTimer: 0,
      hurtFlash: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
    });
  }

  raycastCreature(ox, oy, oz, dx, dy, dz, maxDist = 4.3) {
    let closest = null;
    let bestT = maxDist;

    for (const c of this.creatures) {
      const minX = c.x - c.radius - 0.12;
      const maxX = c.x + c.radius + 0.12;
      const minY = c.y;
      const maxY = c.y + c.height + 0.1;
      const minZ = c.z - c.radius - 0.12;
      const maxZ = c.z + c.radius + 0.12;

      const invX = dx !== 0 ? 1 / dx : 1e9;
      const invY = dy !== 0 ? 1 / dy : 1e9;
      const invZ = dz !== 0 ? 1 / dz : 1e9;

      const t1 = (minX - ox) * invX, t2 = (maxX - ox) * invX;
      const t3 = (minY - oy) * invY, t4 = (maxY - oy) * invY;
      const t5 = (minZ - oz) * invZ, t6 = (maxZ - oz) * invZ;

      const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
      const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

      if (tmax >= 0 && tmin <= tmax && tmin < bestT) {
        bestT = Math.max(0, tmin);
        closest = { creature: c, distance: bestT };
      }
    }
    return closest;
  }

  hitCreature(creature, damage, fromPos, callbacks = {}) {
    creature.hp -= damage;
    creature.hurtFlash = 0.28;

    const kx = creature.x - fromPos.x;
    const kz = creature.z - fromPos.z;
    const kLen = Math.hypot(kx, kz) || 1;
    creature.vx = (kx / kLen) * 6.2;
    creature.vz = (kz / kLen) * 6.2;
    creature.vy = 4.6;
    creature.onGround = false;

    if (!creature.hostile) {
      creature.panicTimer = 4.0;
      creature.targetYaw = Math.atan2(kx, kz);
    }

    callbacks.onHitEffect?.(creature.x, creature.y + creature.height * 0.55, creature.z);

    if (creature.hp <= 0) {
      this.killCreature(creature);
      return true;
    }
    return false;
  }

  killCreature(c) {
    const idx = this.creatures.indexOf(c);
    if (idx !== -1) this.creatures.splice(idx, 1);

    this.group.remove(c.rig.root);

    // Spawn loot drops!
    if (c.type === 'sheep') {
      this.spawnDrop(BLOCK.WOOL_BLOCK, 1 + (Math.random() < 0.5 ? 1 : 0), c.x, c.y + 0.5, c.z);
      this.spawnDrop(ITEM.RAW_MEAT, 1 + (Math.random() < 0.5 ? 1 : 0), c.x, c.y + 0.5, c.z);
    } else if (c.type === 'pig' || c.type === 'cow') {
      this.spawnDrop(ITEM.RAW_MEAT, 2, c.x, c.y + 0.5, c.z);
    } else if (c.type === 'stalker') {
      this.spawnDrop(Math.random() < 0.5 ? ITEM.COAL : ITEM.CRYSTAL_SHARD, 1, c.x, c.y + 0.7, c.z);
      if (Math.random() < 0.4) {
        this.spawnDrop(ITEM.BREAD, 1, c.x, c.y + 0.7, c.z);
      }
    }
  }

  updateSpawning(dt, world, player, isNight, gameMode) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 3.5;

    // Despawn creatures very far from player
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      const d2 = (c.x - player.pos.x) ** 2 + (c.z - player.pos.z) ** 2;
      if (d2 > 68 * 68) {
        this.group.remove(c.rig.root);
        this.creatures.splice(i, 1);
      }
    }

    const passiveCount = this.creatures.filter((c) => !c.hostile).length;
    const hostileCount = this.creatures.filter((c) => c.hostile).length;

    // Spawn passive wildlife on nearby grassy terrain
    if (passiveCount < 9) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 24;
      const sx = Math.floor(player.pos.x + Math.cos(angle) * dist);
      const sz = Math.floor(player.pos.z + Math.sin(angle) * dist);
      const sy = world.getSurfaceHeight(sx, sz);
      const ground = world.getBlock(sx, sy, sz);

      if (sy > SEA_LEVEL && (ground === BLOCK.GRASS || ground === BLOCK.SNOW_GRASS)) {
        const types = ['sheep', 'sheep', 'pig', 'cow'];
        const pick = types[Math.floor(Math.random() * types.length)];
        this.spawnCreature(pick, sx + 0.5, sy + 1.05, sz + 0.5);
      }
    }

    // Spawn nocturnal stalkers in Survival mode at night
    if (gameMode === GAME_MODES.SURVIVAL && isNight && hostileCount < 4) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 18;
      const sx = Math.floor(player.pos.x + Math.cos(angle) * dist);
      const sz = Math.floor(player.pos.z + Math.sin(angle) * dist);
      const sy = world.getSurfaceHeight(sx, sz);
      const packed = world.getPackedLight(sx, sy + 1, sz);
      const blkLight = packed & 0x0f;

      if (sy > SEA_LEVEL && blkLight < 6) {
        this.spawnCreature('stalker', sx + 0.5, sy + 1.05, sz + 0.5);
      }
    }
  }

  update(dt, world, player, inventory, isNight, gameMode, callbacks = {}) {
    this.updateSpawning(dt, world, player, isNight, gameMode);

    // 1. Update 3D Dropped Items
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > 180) {
        this.group.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      d.vy = Math.max(-18, d.vy - 20 * dt);
      const nx = d.x + d.vx * dt;
      if (!getItemDef(world.getBlock(nx, Math.floor(d.y), d.z)).solid) {
        d.x = nx;
      } else {
        d.vx *= -0.4;
      }
      const nz = d.z + d.vz * dt;
      if (!getItemDef(world.getBlock(d.x, Math.floor(d.y), nz)).solid) {
        d.z = nz;
      } else {
        d.vz *= -0.4;
      }
      d.y += d.vy * dt;

      const belowId = world.getBlock(d.x, Math.floor(d.y - 0.15), d.z);
      if (belowId !== BLOCK.AIR && belowId !== BLOCK.WATER && getItemDef(belowId).solid) {
        const top = getBlockTopY(belowId, Math.floor(d.y - 0.15));
        if (d.y - 0.15 < top) {
          d.y = top + 0.16;
          d.vy = 0;
          d.vx *= 0.82;
          d.vz *= 0.82;
        }
      }

      // Magnetic pull toward player
      if (d.age > 0.30) {
        const targetY = Math.max(player.pos.y + 0.2, Math.min(player.pos.y + 1.4, d.y));
        const tx = player.pos.x - d.x;
        const ty = (player.pos.y + 0.85) - d.y;
        const tz = player.pos.z - d.z;
        const distCenter = Math.hypot(tx, ty, tz);
        const distBody = Math.hypot(tx, targetY - d.y, tz);

        if (distCenter < 2.95) {
          d.vx = 0;
          d.vy = 0;
          d.vz = 0;
          const pull = (1.0 - distCenter / 2.95) * 16.0 + 4.5;
          d.x += (tx / (distCenter || 1)) * pull * dt;
          d.y += (ty / (distCenter || 1)) * pull * dt;
          d.z += (tz / (distCenter || 1)) * pull * dt;
        }

        if (distBody < 1.15) {
          const rem = inventory.addItem(d.id, d.count);
          if (rem < d.count) {
            callbacks.onPickup?.(d.id, d.count - rem);
          }
          if (rem <= 0) {
            this.group.remove(d.mesh);
            this.drops.splice(i, 1);
            continue;
          } else {
            d.count = rem;
          }
        }
      }

      d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3.2) * 0.06, d.z);
      d.mesh.rotation.y += dt * 2.1;
    }

    // 2. Update Creatures
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];

      // Burn nocturnal stalkers in bright morning sun!
      if (c.hostile && !isNight) {
        const sky = (world.getPackedLight(c.x, c.y + 1, c.z) >> 4) & 0x0f;
        if (sky >= 12) {
          c.hurtFlash = 0.2;
          c.hp -= dt * 3.5;
          if (c.hp <= 0) {
            this.killCreature(c);
            continue;
          }
        }
      }

      // Hurt flash tint
      if (c.hurtFlash > 0) {
        c.hurtFlash = Math.max(0, c.hurtFlash - dt);
        const flashOn = c.hurtFlash > 0;
        for (const m of c.rig.mats) {
          m.emissive.setHex(flashOn ? 0xaa1818 : 0x000000);
        }
      }

      if (c.attackCooldown > 0) c.attackCooldown -= dt;
      if (c.panicTimer > 0) c.panicTimer -= dt;

      // AI Steering
      const toPlayerX = player.pos.x - c.x;
      const toPlayerZ = player.pos.z - c.z;
      const distPlayer = Math.hypot(toPlayerX, toPlayerZ);

      let speed = 0;
      if (c.hostile && gameMode === GAME_MODES.SURVIVAL && distPlayer < 15.5) {
        c.targetYaw = Math.atan2(toPlayerX, toPlayerZ);
        speed = 2.65;
        if (distPlayer < 1.15 && Math.abs(player.pos.y - c.y) < 1.6 && c.attackCooldown <= 0) {
          c.attackCooldown = 1.25;
          callbacks.onPlayerDamaged?.(3, 'Shadow Stalker', c);
        }
      } else if (c.panicTimer > 0) {
        speed = 3.5;
      } else {
        c.aiTimer -= dt;
        if (c.aiTimer <= 0) {
          c.aiTimer = 2.0 + Math.random() * 3.5;
          c.moving = Math.random() < 0.62;
          if (c.moving) {
            c.targetYaw += (Math.random() - 0.5) * 2.4;
          }
        }
        speed = c.moving ? 1.45 : 0;
      }

      // Smooth yaw turn
      let diff = c.targetYaw - c.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.yaw += diff * Math.min(1.0, dt * 6.0);

      const wishVx = Math.sin(c.yaw) * speed;
      const wishVz = Math.cos(c.yaw) * speed;
      c.vx += (wishVx - c.vx) * Math.min(1.0, dt * 7.0);
      c.vz += (wishVz - c.vz) * Math.min(1.0, dt * 7.0);

      // Gravity & Water float
      const inWater = world.getBlock(c.x, c.y + 0.3, c.z) === BLOCK.WATER;
      if (inWater) {
        c.vy = 2.2;
      } else {
        c.vy = Math.max(-28, c.vy - 26 * dt);
      }

      // Simple AABB step with auto-hop over 1-block ledges
      const r = c.radius;
      const h = c.height;

      c.y += c.vy * dt;
      const hitY = aabbIntersectsWorld(world, c.x - r, c.y, c.z - r, c.x + r, c.y + h, c.z + r);
      if (hitY) {
        if (c.vy < 0) {
          c.y = hitY.topY + 0.001;
          c.onGround = true;
        }
        c.vy = 0;
      } else {
        c.onGround = false;
      }

      const nextX = c.x + c.vx * dt;
      if (!aabbIntersectsWorld(world, nextX - r, c.y, c.z - r, nextX + r, c.y + h, c.z + r)) {
        c.x = nextX;
      } else if (c.onGround) {
        c.vy = 7.6; // Auto-hop up 1-block hills!
        c.onGround = false;
      }

      const nextZ = c.z + c.vz * dt;
      if (!aabbIntersectsWorld(world, c.x - r, c.y, nextZ - r, c.x + r, c.y + h, nextZ + r)) {
        c.z = nextZ;
      } else if (c.onGround) {
        c.vy = 7.6;
        c.onGround = false;
      }

      // Animate legs & head
      const moveMag = Math.hypot(c.vx, c.vz);
      if (moveMag > 0.2) {
        c.walkPhase += moveMag * dt * 3.8;
        const swing = Math.sin(c.walkPhase) * 0.65;
        if (c.rig.legs.length === 4) {
          c.rig.legs[0].rotation.x = swing;
          c.rig.legs[1].rotation.x = -swing;
          c.rig.legs[2].rotation.x = -swing;
          c.rig.legs[3].rotation.x = swing;
        } else if (c.rig.legs.length === 2) {
          c.rig.legs[0].rotation.x = swing;
          c.rig.legs[1].rotation.x = -swing;
        }
      } else {
        for (const leg of c.rig.legs) {
          leg.rotation.x *= 0.85;
        }
      }

      c.rig.root.position.set(c.x, c.y, c.z);
      c.rig.root.rotation.y = c.yaw;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.drops.length = 0;
    this.creatures.length = 0;
  }
}
