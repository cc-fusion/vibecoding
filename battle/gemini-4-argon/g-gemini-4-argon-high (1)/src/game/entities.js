// Living World Entities: 3D Dropped Item Pickups & Articulated Voxel Creatures
import * as THREE from 'three';
import { BLOCK, ITEM, getDef } from './items.js';
import { GAME_MODES, SEA_LEVEL } from './constants.js';

export class EntityManager {
  constructor(scene, world, particles, sound) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.sound = sound;

    this.drops = [];
    this.mobs = [];
    this.spawnTimer = 2.0;

    this.group = new THREE.Group();
    if (this.scene) this.scene.add(this.group);
  }

  // --- Dropped 3D Item Pickups ---
  spawnDrop(x, y, z, itemId, count = 1, opts = null) {
    if (!itemId || count <= 0) return;
    const def = getDef(itemId);

    const color = def.isBlock ? (def.particleColor || '#cccccc') : (def.iconColor || '#ffd54f');
    const size = def.isBlock ? 0.28 : 0.22;
    const geom = new THREE.BoxGeometry(size, size, def.isBlock ? size : 0.08);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.drops.push({
      mesh,
      id: itemId,
      count,
      x,
      y,
      z,
      vx: opts && opts.vx !== undefined ? opts.vx : (Math.random() - 0.5) * 2.4,
      vy: opts && opts.vy !== undefined ? opts.vy : 3.4 + Math.random() * 1.4,
      vz: opts && opts.vz !== undefined ? opts.vz : (Math.random() - 0.5) * 2.4,
      age: opts && opts.pickupDelay ? -opts.pickupDelay : 0,
      phase: Math.random() * 2 * Math.PI,
    });
  }

  // --- Articulated Voxel Creatures ---
  spawnMob(type, x, y, z) {
    const model = buildMobModel(type);
    model.root.position.set(x, y, z);
    this.group.add(model.root);

    const stats = MOB_STATS[type] || MOB_STATS.sheep;
    this.mobs.push({
      type,
      hostile: Boolean(stats.hostile),
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      radius: stats.radius,
      height: stats.height,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      targetYaw: Math.random() * Math.PI * 2,
      state: 'idle', // 'idle' | 'wander' | 'flee' | 'chase'
      stateTimer: 1.5 + Math.random() * 3.0,
      hurtTimer: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
      onGround: false,
      model,
    });
  }

  // Raycast against mobs within reach for melee combat
  raycastMob(origin, dir, maxDist = 4.0) {
    let closest = null;
    let bestT = maxDist;

    for (const mob of this.mobs) {
      const minX = mob.x - mob.radius - 0.1;
      const maxX = mob.x + mob.radius + 0.1;
      const minY = mob.y;
      const maxY = mob.y + mob.height + 0.1;
      const minZ = mob.z - mob.radius - 0.1;
      const maxZ = mob.z + mob.radius + 0.1;

      const t = intersectRayAABB(origin, dir, minX, minY, minZ, maxX, maxY, maxZ);
      if (t !== null && t >= 0 && t < bestT) {
        bestT = t;
        closest = mob;
      }
    }
    return closest;
  }

  hitMob(mob, damage, knockDirX, knockDirZ) {
    if (!mob || mob.hurtTimer > 0.25) return false;
    mob.hp -= damage;
    mob.hurtTimer = 0.38;

    const len = Math.hypot(knockDirX, knockDirZ) || 1;
    mob.vx = (knockDirX / len) * 6.2;
    mob.vz = (knockDirZ / len) * 6.2;
    mob.vy = 5.2;

    if (!mob.hostile) {
      mob.state = 'flee';
      mob.stateTimer = 4.0;
      mob.targetYaw = Math.atan2(knockDirX, knockDirZ);
    }

    // Tint meshes red briefly
    setModelFlash(mob.model, true);
    if (this.sound) this.sound.playMob(mob.type, true);
    if (this.particles) {
      this.particles.emitHitSpark(mob.x, mob.y + mob.height * 0.6, mob.z, '#ff5c5c', 12);
    }

    if (mob.hp <= 0) {
      this.killMob(mob);
    }
    return true;
  }

  killMob(mob) {
    if (this.particles) {
      this.particles.emitHitSpark(mob.x, mob.y + 0.6, mob.z, '#f0f0f0', 20);
    }
    // Spawn drops
    if (mob.type === 'sheep') {
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, BLOCK.WOOL, 1 + ((Math.random() * 2) | 0));
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, ITEM.RAW_MEAT, 1);
    } else if (mob.type === 'pig' || mob.type === 'cow') {
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, ITEM.RAW_MEAT, 1 + ((Math.random() * 2) | 0));
    } else if (mob.type === 'chicken') {
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, ITEM.RAW_MEAT, 1);
    } else if (mob.type === 'zombie') {
      this.spawnDrop(mob.x, mob.y + 0.5, mob.z, Math.random() < 0.5 ? ITEM.COAL : ITEM.APPLE, 1);
    }

    this.removeMob(mob);
  }

  removeMob(mob) {
    const idx = this.mobs.indexOf(mob);
    if (idx !== -1) this.mobs.splice(idx, 1);
    this.group.remove(mob.model.root);
    mob.model.root.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        obj.material.dispose();
      }
    });
  }

  update(dt, player, isNight, gameMode) {
    this.updateDrops(dt, player);
    this.updateSpawning(dt, player, isNight, gameMode);
    this.updateMobs(dt, player, isNight, gameMode);
  }

  updateDrops(dt, player) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > 180) {
        this.disposeDrop(i);
        continue;
      }

      d.vy -= 22.0 * dt;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      const nz = d.z + d.vz * dt;

      if (getDef(this.world.getBlock(nx, d.y, d.z)).solid) d.vx *= -0.4;
      else d.x = nx;

      if (getDef(this.world.getBlock(d.x, d.y, nz)).solid) d.vz *= -0.4;
      else d.z = nz;

      if (getDef(this.world.getBlock(d.x, ny - 0.14, d.z)).solid) {
        d.y = Math.floor(ny - 0.14) + 1.15;
        d.vy = 0;
        d.vx *= 0.8;
        d.vz *= 0.8;
      } else {
        d.y = ny;
      }

      // Magnetic pickup toward player after 0.3s grace
      if (d.age > 0.3 && player && !player.dead) {
        const px = player.pos.x;
        const py = player.pos.y + 0.9;
        const pz = player.pos.z;
        const dx = px - d.x;
        const dy = py - d.y;
        const dz = pz - d.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 2.35) {
          const pull = (1.0 - dist / 2.35) * 14.0 * dt;
          d.x += (dx / (dist || 1)) * pull;
          d.y += (dy / (dist || 1)) * pull;
          d.z += (dz / (dist || 1)) * pull;

          if (dist < 0.75) {
            const leftover = player.inventory.addItem(d.id, d.count);
            if (leftover === 0) {
              if (this.sound) this.sound.playPickup();
              this.disposeDrop(i);
              continue;
            } else {
              d.count = leftover;
            }
          }
        }
      }

      d.mesh.rotation.y += dt * 2.1;
      const bob = Math.sin(d.age * 3.2 + d.phase) * 0.07;
      d.mesh.position.set(d.x, d.y + bob, d.z);
    }
  }

  disposeDrop(idx) {
    const d = this.drops[idx];
    this.group.remove(d.mesh);
    d.mesh.geometry.dispose();
    d.mesh.material.dispose();
    this.drops.splice(idx, 1);
  }

  updateSpawning(dt, player, isNight, gameMode) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 3.5;

    // Despawn hostile mobs if switched out of Survival
    if (gameMode !== GAME_MODES.SURVIVAL) {
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        if (this.mobs[i].hostile) this.removeMob(this.mobs[i]);
      }
    }

    if (this.mobs.length >= 16) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 20;
    const sx = Math.floor(player.pos.x + Math.cos(angle) * dist);
    const sz = Math.floor(player.pos.z + Math.sin(angle) * dist);

    const topY = this.world.getTopSolidY(sx, sz);
    if (topY <= SEA_LEVEL) return;
    const groundId = this.world.getBlock(sx, topY, sz);
    if (groundId === BLOCK.WATER || groundId === BLOCK.LAVA || groundId === BLOCK.CACTUS) return;

    if (isNight && gameMode === GAME_MODES.SURVIVAL && Math.random() < 0.48) {
      this.spawnMob('zombie', sx + 0.5, topY + 1.05, sz + 0.5);
    } else if (
      groundId === BLOCK.GRASS ||
      groundId === BLOCK.SNOW_GRASS ||
      groundId === BLOCK.SAND
    ) {
      const passiveTypes = ['sheep', 'pig', 'cow', 'chicken'];
      const chosen = passiveTypes[(Math.random() * passiveTypes.length) | 0];
      this.spawnMob(chosen, sx + 0.5, topY + 1.05, sz + 0.5);
    }
  }

  updateMobs(dt, player, isNight, gameMode) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];

      const distToPlayer = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
      if (distToPlayer > 68 || m.y < -10) {
        this.removeMob(m);
        continue;
      }

      // Zombies burn in bright morning daylight under open sky
      if (m.hostile && !isNight) {
        const pk = this.world.getPackedLight(m.x, m.y + 1, m.z);
        if (((pk >> 4) & 15) >= 13) {
          m.hp -= dt * 3.5;
          if (Math.random() < dt * 4 && this.particles) {
            this.particles.emitHitSpark(m.x, m.y + 1.1, m.z, '#ff8f1f', 3);
          }
          if (m.hp <= 0) {
            this.killMob(m);
            continue;
          }
        }
      }

      if (m.hurtTimer > 0) {
        m.hurtTimer -= dt;
        if (m.hurtTimer <= 0) setModelFlash(m.model, false);
      }
      if (m.attackCooldown > 0) m.attackCooldown -= dt;

      // AI state updates
      if (m.hostile && gameMode === GAME_MODES.SURVIVAL && !player.dead && distToPlayer < 18) {
        m.state = 'chase';
        m.targetYaw = Math.atan2(player.pos.x - m.x, player.pos.z - m.z);

        if (distToPlayer < 1.25 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.15;
          player.takeDamage(3, player.pos.x - m.x, player.pos.z - m.z);
        }
      } else {
        m.stateTimer -= dt;
        if (m.stateTimer <= 0) {
          if (m.state === 'idle') {
            m.state = 'wander';
            m.targetYaw = Math.random() * Math.PI * 2;
            m.stateTimer = 2.0 + Math.random() * 3.5;
            if (Math.random() < 0.25 && distToPlayer < 16 && this.sound) {
              this.sound.playMob(m.type, false);
            }
          } else {
            m.state = 'idle';
            m.stateTimer = 1.5 + Math.random() * 3.0;
          }
        }
      }

      // Smooth yaw turn
      let diff = m.targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, dt * 6.0);

      let moveSpeed = 0;
      if (m.state === 'wander') moveSpeed = m.speed;
      else if (m.state === 'flee') moveSpeed = m.speed * 1.9;
      else if (m.state === 'chase') moveSpeed = m.speed * 1.25;

      const desiredVx = Math.sin(m.yaw) * moveSpeed;
      const desiredVz = Math.cos(m.yaw) * moveSpeed;
      m.vx += (desiredVx - m.vx) * Math.min(1, dt * 7.0);
      m.vz += (desiredVz - m.vz) * Math.min(1, dt * 7.0);

      const inWater = this.world.getBlock(m.x, m.y + 0.3, m.z) === BLOCK.WATER;
      if (inWater) {
        m.vy += 12.0 * dt;
        m.vy = Math.min(m.vy, 2.6);
      } else {
        m.vy -= 26.0 * dt;
      }

      // Axis-separated mob collision + auto 1-block step jump
      const prevX = m.x;
      const prevZ = m.z;
      this.moveMobAxis(m, dt);

      const blockedHoriz =
        moveSpeed > 0.2 &&
        Math.hypot(m.x - prevX, m.z - prevZ) < moveSpeed * dt * 0.25;
      if (blockedHoriz && m.onGround) {
        m.vy = 8.4;
        m.onGround = false;
      }

      // Animate articulated limbs
      const horizVel = Math.hypot(m.vx, m.vz);
      if (horizVel > 0.15) {
        m.walkPhase += dt * horizVel * 4.2;
      } else {
        m.walkPhase *= 0.88;
      }

      const swing = Math.sin(m.walkPhase) * 0.65 * Math.min(1, horizVel);
      const legs = m.model.legs;
      if (legs.length === 4) {
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
        legs[2].rotation.x = -swing;
        legs[3].rotation.x = swing;
      } else if (legs.length === 2) {
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
      }
      if (m.model.head) {
        m.model.head.rotation.x = m.state === 'idle' ? Math.sin(performance.now() * 0.002 + i) * 0.08 : 0;
      }

      m.model.root.position.set(m.x, m.y, m.z);
      m.model.root.rotation.y = m.yaw;
    }
  }

  moveMobAxis(m, dt) {
    // Y axis
    const nextY = m.y + m.vy * dt;
    if (!this.mobCollides(m.x, nextY, m.z, m.radius, m.height)) {
      m.y = nextY;
      m.onGround = false;
    } else {
      if (m.vy < 0) {
        m.y = Math.floor(nextY) + 1.001;
        m.onGround = true;
      }
      m.vy = 0;
    }

    // X axis
    const nextX = m.x + m.vx * dt;
    if (!this.mobCollides(nextX, m.y, m.z, m.radius, m.height)) {
      m.x = nextX;
    }

    // Z axis
    const nextZ = m.z + m.vz * dt;
    if (!this.mobCollides(m.x, m.y, nextZ, m.radius, m.height)) {
      m.z = nextZ;
    }
  }

  mobCollides(x, y, z, r, h) {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + h - 0.01);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (getDef(this.world.getBlock(bx, by, bz)).solid) return true;
        }
      }
    }
    return false;
  }

  dispose() {
    while (this.drops.length) this.disposeDrop(0);
    while (this.mobs.length) this.removeMob(this.mobs[0]);
    if (this.scene && this.group) this.scene.remove(this.group);
  }
}

const MOB_STATS = {
  sheep: { hp: 8, speed: 1.5, radius: 0.38, height: 1.25, hostile: false },
  pig: { hp: 8, speed: 1.65, radius: 0.36, height: 1.05, hostile: false },
  cow: { hp: 10, speed: 1.45, radius: 0.42, height: 1.38, hostile: false },
  chicken: { hp: 4, speed: 1.85, radius: 0.25, height: 0.8, hostile: false },
  zombie: { hp: 16, speed: 2.35, radius: 0.34, height: 1.85, hostile: true },
};

function makePart(w, h, d, color, x, y, z) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.baseColor = new THREE.Color(color);
  mesh.position.set(x, y, z);
  return mesh;
}

function makePivotLeg(w, h, d, color, px, py, pz) {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, pz);
  const mesh = makePart(w, h, d, color, 0, -h * 0.5, 0);
  pivot.add(mesh);
  return pivot;
}

function buildMobModel(type) {
  const root = new THREE.Group();
  const legs = [];
  let head = null;

  if (type === 'sheep') {
    const wool = makePart(0.72, 0.58, 0.96, 0xf2f0e8, 0, 0.72, 0);
    root.add(wool);
    head = new THREE.Group();
    head.position.set(0, 0.92, 0.52);
    head.add(makePart(0.42, 0.42, 0.44, 0xd8c3a8, 0, 0, 0.1));
    head.add(makePart(0.46, 0.2, 0.42, 0xf2f0e8, 0, 0.16, 0.08));
    head.add(makePart(0.07, 0.07, 0.05, 0x222222, -0.13, 0.03, 0.33));
    head.add(makePart(0.07, 0.07, 0.05, 0x222222, 0.13, 0.03, 0.33));
    root.add(head);

    const legCoords = [[-0.2, 0.45, 0.32], [0.2, 0.45, 0.32], [-0.2, 0.45, -0.32], [0.2, 0.45, -0.32]];
    for (const [lx, ly, lz] of legCoords) {
      const leg = makePivotLeg(0.18, 0.45, 0.18, 0xd8c3a8, lx, ly, lz);
      legs.push(leg);
      root.add(leg);
    }
  } else if (type === 'pig') {
    root.add(makePart(0.66, 0.52, 0.9, 0xf29cb8, 0, 0.58, 0));
    head = new THREE.Group();
    head.position.set(0, 0.72, 0.48);
    head.add(makePart(0.46, 0.44, 0.44, 0xf29cb8, 0, 0, 0.1));
    head.add(makePart(0.24, 0.16, 0.12, 0xe07b9b, 0, -0.06, 0.34)); // snout
    head.add(makePart(0.07, 0.07, 0.05, 0x222222, -0.14, 0.06, 0.33));
    head.add(makePart(0.07, 0.07, 0.05, 0x222222, 0.14, 0.06, 0.33));
    root.add(head);

    const legCoords = [[-0.19, 0.34, 0.3], [0.19, 0.34, 0.3], [-0.19, 0.34, -0.3], [0.19, 0.34, -0.3]];
    for (const [lx, ly, lz] of legCoords) {
      const leg = makePivotLeg(0.17, 0.34, 0.17, 0xe58aa8, lx, ly, lz);
      legs.push(leg);
      root.add(leg);
    }
  } else if (type === 'cow') {
    root.add(makePart(0.76, 0.64, 1.05, 0x5c3d28, 0, 0.84, 0));
    root.add(makePart(0.78, 0.34, 0.42, 0xede6d8, 0, 0.9, 0.1));
    head = new THREE.Group();
    head.position.set(0, 1.04, 0.56);
    head.add(makePart(0.46, 0.46, 0.44, 0x5c3d28, 0, 0, 0.12));
    head.add(makePart(0.08, 0.16, 0.08, 0xcfd4d8, -0.24, 0.24, 0.08)); // left horn
    head.add(makePart(0.08, 0.16, 0.08, 0xcfd4d8, 0.24, 0.24, 0.08));  // right horn
    head.add(makePart(0.07, 0.07, 0.05, 0x1e1e1e, -0.15, 0.05, 0.35));
    head.add(makePart(0.07, 0.07, 0.05, 0x1e1e1e, 0.15, 0.05, 0.35));
    root.add(head);

    const legCoords = [[-0.22, 0.54, 0.36], [0.22, 0.54, 0.36], [-0.22, 0.54, -0.36], [0.22, 0.54, -0.36]];
    for (const [lx, ly, lz] of legCoords) {
      const leg = makePivotLeg(0.18, 0.54, 0.18, 0x4a301f, lx, ly, lz);
      legs.push(leg);
      root.add(leg);
    }
  } else if (type === 'chicken') {
    root.add(makePart(0.38, 0.34, 0.46, 0xfafafa, 0, 0.42, 0));
    head = new THREE.Group();
    head.position.set(0, 0.64, 0.2);
    head.add(makePart(0.24, 0.28, 0.24, 0xfafafa, 0, 0, 0.05));
    head.add(makePart(0.16, 0.08, 0.14, 0xf2b632, 0, -0.02, 0.21)); // beak
    head.add(makePart(0.08, 0.1, 0.12, 0xd93838, 0, 0.17, 0.06));   // red comb
    root.add(head);

    const l1 = makePivotLeg(0.07, 0.26, 0.07, 0xf2b632, -0.1, 0.26, 0);
    const l2 = makePivotLeg(0.07, 0.26, 0.07, 0xf2b632, 0.1, 0.26, 0);
    legs.push(l1, l2);
    root.add(l1, l2);
  } else {
    // Dusk Walker Zombie
    root.add(makePart(0.5, 0.72, 0.28, 0x2e648a, 0, 1.06, 0));
    head = new THREE.Group();
    head.position.set(0, 1.44, 0);
    head.add(makePart(0.46, 0.46, 0.46, 0x558b52, 0, 0.22, 0));
    head.add(makePart(0.1, 0.07, 0.05, 0xffae2b, -0.11, 0.24, 0.24)); // glowing eyes
    head.add(makePart(0.1, 0.07, 0.05, 0xffae2b, 0.11, 0.24, 0.24));
    root.add(head);

    // Outstretched zombie arms
    root.add(makePart(0.18, 0.18, 0.64, 0x558b52, -0.35, 1.3, 0.24));
    root.add(makePart(0.18, 0.18, 0.64, 0x558b52, 0.35, 1.3, 0.24));

    const l1 = makePivotLeg(0.2, 0.7, 0.2, 0x343b5c, -0.13, 0.7, 0);
    const l2 = makePivotLeg(0.2, 0.7, 0.2, 0x343b5c, 0.13, 0.7, 0);
    legs.push(l1, l2);
    root.add(l1, l2);
  }

  return { root, legs, head };
}

function setModelFlash(model, flash) {
  model.root.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.userData.baseColor) {
      if (flash) obj.material.color.setHex(0xff5252);
      else obj.material.color.copy(obj.userData.baseColor);
    }
  });
}

function intersectRayAABB(origin, dir, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = -Infinity;
  let tmax = Infinity;

  const axes = [
    [origin.x, dir.x, minX, maxX],
    [origin.y, dir.y, minY, maxY],
    [origin.z, dir.z, minZ, maxZ],
  ];

  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmax >= 0 ? Math.max(0, tmin) : null;
}
