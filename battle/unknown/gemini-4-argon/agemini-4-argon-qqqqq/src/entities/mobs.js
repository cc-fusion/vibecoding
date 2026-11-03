import * as THREE from 'three';
import { BLOCK, ITEM, getDef } from '../world/blocks.js';
import { BIOME } from '../world/biomes.js';

function makeBox(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = opts.unlit
    ? new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 })
    : new THREE.MeshLambertMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}

class Mob {
  constructor(type, x, y, z) {
    this.type = type;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;

    this.hostile = type === 'stalker' || type === 'slime';
    this.maxHealth = type === 'stalker' ? 18 : type === 'slime' ? 12 : 10;
    this.health = this.maxHealth;
    this.halfW = type === 'slime' ? 0.36 : 0.38;
    this.height = type === 'stalker' ? 1.82 : type === 'slime' ? 0.78 : 1.05;
    this.speed = type === 'stalker' ? 3.25 : type === 'slime' ? 2.6 : 1.75;

    this.onGround = false;
    this.aiTimer = Math.random() * 2;
    this.moving = false;
    this.fleeTimer = 0;
    this.hurtFlash = 0;
    this.attackCooldown = 0;
    this.walkTime = Math.random() * 10;

    this.root = new THREE.Group();
    this.legs = [];
    this.materials = [];
    this.head = null;
    this.buildModel();
    this.root.position.copy(this.pos);
  }

  buildModel() {
    const addPart = (parent, mesh, saveTint = true) => {
      parent.add(mesh);
      if (saveTint && mesh.material && mesh.material.color) {
        mesh.userData.baseHex = mesh.material.color.getHex();
        this.materials.push(mesh.material);
      }
      return mesh;
    };

    if (this.type === 'sheep') {
      addPart(this.root, makeBox(0.68, 0.56, 0.96, 0xf2efe6, 0, 0.62, 0));
      this.head = new THREE.Group();
      this.head.position.set(0, 0.78, 0.52);
      addPart(this.head, makeBox(0.42, 0.4, 0.44, 0xd8c3ab, 0, 0, 0.08));
      addPart(this.head, makeBox(0.46, 0.18, 0.36, 0xf2efe6, 0, 0.16, 0.04));
      addPart(this.head, makeBox(0.07, 0.07, 0.05, 0x222222, -0.13, 0.02, 0.3), false);
      addPart(this.head, makeBox(0.07, 0.07, 0.05, 0x222222, 0.13, 0.02, 0.3), false);
      this.root.add(this.head);

      const legCoords = [[-0.2, 0.34, 0.3], [0.2, 0.34, 0.3], [-0.2, 0.34, -0.3], [0.2, 0.34, -0.3]];
      for (const [lx, ly, lz] of legCoords) {
        const pivot = new THREE.Group();
        pivot.position.set(lx, ly, lz);
        addPart(pivot, makeBox(0.18, 0.36, 0.18, 0xcab49b, 0, -0.17, 0));
        this.root.add(pivot);
        this.legs.push(pivot);
      }
    } else if (this.type === 'boar') {
      addPart(this.root, makeBox(0.64, 0.5, 0.92, 0xd98c82, 0, 0.54, 0));
      this.head = new THREE.Group();
      this.head.position.set(0, 0.62, 0.5);
      addPart(this.head, makeBox(0.44, 0.42, 0.42, 0xd98c82, 0, 0, 0.08));
      addPart(this.head, makeBox(0.24, 0.18, 0.14, 0xc47368, 0, -0.06, 0.32));
      addPart(this.head, makeBox(0.07, 0.07, 0.05, 0x1e1e1e, -0.14, 0.06, 0.29), false);
      addPart(this.head, makeBox(0.07, 0.07, 0.05, 0x1e1e1e, 0.14, 0.06, 0.29), false);
      this.root.add(this.head);

      const legCoords = [[-0.2, 0.3, 0.28], [0.2, 0.3, 0.28], [-0.2, 0.3, -0.28], [0.2, 0.3, -0.28]];
      for (const [lx, ly, lz] of legCoords) {
        const pivot = new THREE.Group();
        pivot.position.set(lx, ly, lz);
        addPart(pivot, makeBox(0.18, 0.3, 0.18, 0xbf746b, 0, -0.15, 0));
        this.root.add(pivot);
        this.legs.push(pivot);
      }
    } else if (this.type === 'stalker') {
      // Mossy night guardian biped with glowing cyan eyes
      addPart(this.root, makeBox(0.52, 0.72, 0.3, 0x3b5241, 0, 1.02, 0));
      this.head = new THREE.Group();
      this.head.position.set(0, 1.56, 0);
      addPart(this.head, makeBox(0.46, 0.46, 0.46, 0x48634e, 0, 0, 0));
      addPart(this.head, makeBox(0.1, 0.07, 0.05, 0x5ff7ee, -0.11, 0.02, 0.23, { unlit: true }), false);
      addPart(this.head, makeBox(0.1, 0.07, 0.05, 0x5ff7ee, 0.11, 0.02, 0.23, { unlit: true }), false);
      this.root.add(this.head);

      // Outstretched arms
      addPart(this.root, makeBox(0.18, 0.62, 0.18, 0x48634e, -0.36, 1.12, 0.22)).rotation.x = -1.25;
      addPart(this.root, makeBox(0.18, 0.62, 0.18, 0x48634e, 0.36, 1.12, 0.22)).rotation.x = -1.25;

      for (const lx of [-0.14, 0.14]) {
        const pivot = new THREE.Group();
        pivot.position.set(lx, 0.66, 0);
        addPart(pivot, makeBox(0.2, 0.66, 0.2, 0x2f4034, 0, -0.33, 0));
        this.root.add(pivot);
        this.legs.push(pivot);
      }
    } else if (this.type === 'slime') {
      this.bodyPivot = new THREE.Group();
      addPart(this.bodyPivot, makeBox(0.72, 0.72, 0.72, 0x3be8c8, 0, 0.36, 0, { opacity: 0.72 }));
      addPart(this.bodyPivot, makeBox(0.42, 0.42, 0.42, 0x99fff0, 0, 0.36, 0, { unlit: true }), false);
      addPart(this.bodyPivot, makeBox(0.09, 0.09, 0.05, 0x133b35, -0.14, 0.44, 0.36), false);
      addPart(this.bodyPivot, makeBox(0.09, 0.09, 0.05, 0x133b35, 0.14, 0.44, 0.36), false);
      this.root.add(this.bodyPivot);
    }
  }

  setFlash(active) {
    for (const mat of this.materials) {
      mat.color.setHex(active ? 0xff4d4d : mat.userData.baseHex ?? mat.color.getHex());
    }
  }
}

export class MobManager {
  constructor(scene, world, dropManager, particleSystem, sound) {
    this.scene = scene;
    this.world = world;
    this.dropManager = dropManager;
    this.particles = particleSystem;
    this.sound = sound;

    this.mobs = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.spawnTimer = 1.5;
  }

  spawnInitialPassiveMobs(spawnPos) {
    const offsets = [
      [8, 6, 'sheep'], [-10, 7, 'sheep'], [12, -9, 'boar'], [-7, -11, 'sheep'],
    ];
    for (const [ox, oz, type] of offsets) {
      const wx = spawnPos.x + ox;
      const wz = spawnPos.z + oz;
      const sy = this.world.getSurfaceY(wx, wz);
      if (sy > 29 && this.world.getBlock(wx, sy, wz) !== BLOCK.WATER) {
        this.addMob(type, wx, sy + 0.1, wz);
      }
    }
  }

  addMob(type, x, y, z) {
    const mob = new Mob(type, x, y, z);
    for (const mat of mob.materials) {
      mat.userData.baseHex = mat.color.getHex();
    }
    this.group.add(mob.root);
    this.mobs.push(mob);
    return mob;
  }

  removeMob(idx) {
    const m = this.mobs[idx];
    if (!m) return;
    this.group.remove(m.root);
    m.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this.mobs.splice(idx, 1);
  }

  clear() {
    while (this.mobs.length > 0) this.removeMob(this.mobs.length - 1);
  }

  collides(mob, px, py, pz) {
    const minX = Math.floor(px - mob.halfW);
    const maxX = Math.floor(px + mob.halfW - 1e-4);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + mob.height - 1e-4);
    const minZ = Math.floor(pz - mob.halfW);
    const maxZ = Math.floor(pz + mob.halfW - 1e-4);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          if (id !== BLOCK.AIR && getDef(id).solid) return true;
        }
      }
    }
    return false;
  }

  // Ray-vs-AABB melee target test
  raycastMob(origin, dir, maxDist = 3.9) {
    let closest = null;
    let bestT = maxDist;

    for (const m of this.mobs) {
      const minX = m.pos.x - m.halfW - 0.12;
      const maxX = m.pos.x + m.halfW + 0.12;
      const minY = m.pos.y - 0.05;
      const maxY = m.pos.y + m.height + 0.12;
      const minZ = m.pos.z - m.halfW - 0.12;
      const maxZ = m.pos.z + m.halfW + 0.12;

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

      if (tmax >= 0 && tmin <= tmax && tmin <= bestT) {
        bestT = Math.max(0, tmin);
        closest = m;
      }
    }

    return closest;
  }

  hitMob(mob, damage, attackerPos) {
    mob.health -= damage;
    mob.hurtFlash = 0.24;
    mob.setFlash(true);

    const dx = mob.pos.x - attackerPos.x;
    const dz = mob.pos.z - attackerPos.z;
    const len = Math.hypot(dx, dz) || 1;
    mob.vel.x = (dx / len) * 6.5;
    mob.vel.z = (dz / len) * 6.5;
    mob.vel.y = 5.2;

    if (!mob.hostile) {
      mob.fleeTimer = 3.5;
      mob.targetYaw = Math.atan2(dx, dz);
    }

    if (this.sound) this.sound.playHitMob();
    if (this.particles) {
      this.particles.emitBlockBreak(mob.pos.x, mob.pos.y + mob.height * 0.5, mob.pos.z, '#ff6b6b', 10);
    }

    if (mob.health <= 0) {
      this.onMobKilled(mob);
      const idx = this.mobs.indexOf(mob);
      if (idx >= 0) this.removeMob(idx);
      return true;
    }
    return false;
  }

  onMobKilled(mob) {
    const x = mob.pos.x;
    const y = mob.pos.y + 0.4;
    const z = mob.pos.z;

    if (this.particles) {
      this.particles.emitBlockBreak(x, y, z, '#e2e8f0', 18);
    }

    if (mob.type === 'sheep') {
      this.dropManager.spawnDrop(x, y, z, BLOCK.WOOL, 1 + (Math.random() < 0.5 ? 1 : 0));
      this.dropManager.spawnDrop(x, y, z, ITEM.RAW_MEAT, 1);
    } else if (mob.type === 'boar') {
      this.dropManager.spawnDrop(x, y, z, ITEM.RAW_MEAT, 2);
    } else if (mob.type === 'stalker') {
      this.dropManager.spawnDrop(x, y, z, ITEM.COAL, 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.35) this.dropManager.spawnDrop(x, y, z, ITEM.RAW_IRON, 1);
    } else if (mob.type === 'slime') {
      this.dropManager.spawnDrop(x, y, z, BLOCK.GLOWSHROOM, 1);
      if (Math.random() < 0.25) this.dropManager.spawnDrop(x, y, z, ITEM.CRYSTAL_GEM, 1);
    }
  }

  tryNaturalSpawns(player, isNight) {
    if (this.mobs.length >= 18) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 18;
    const wx = Math.floor(player.pos.x + Math.cos(angle) * dist);
    const wz = Math.floor(player.pos.z + Math.sin(angle) * dist);

    const sy = this.world.getSurfaceY(wx, wz);
    if (sy <= 28 || sy >= 84) return;
    const ground = this.world.getBlock(wx, sy - 1, wz);
    const fluidCheck = this.world.getBlock(wx, sy, wz);
    if (fluidCheck === BLOCK.WATER || fluidCheck === BLOCK.LAVA) return;

    const biome = this.world.generator.getBiomeInfoAt(wx, wz);

    if (isNight && player.mode === 'survival') {
      const blkLight = this.world.getBlockLight(wx, sy, wz);
      if (blkLight < 6) {
        const type = Math.random() < 0.68 ? 'stalker' : 'slime';
        this.addMob(type, wx + 0.5, sy + 0.1, wz + 0.5);
      }
    } else if (!isNight && biome.id !== BIOME.DESERT && (ground === BLOCK.GRASS || ground === BLOCK.PODZOL || ground === BLOCK.SNOW_GRASS)) {
      const passiveCount = this.mobs.filter((m) => !m.hostile).length;
      if (passiveCount < 11) {
        const type = Math.random() < 0.55 ? 'sheep' : 'boar';
        this.addMob(type, wx + 0.5, sy + 0.1, wz + 0.5);
      }
    }
  }

  update(dt, player, sunBrightness) {
    const clampedDt = Math.min(0.05, dt);
    const isNight = sunBrightness < 0.35;

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      this.tryNaturalSpawns(player, isNight);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];

      // Despawn very distant creatures
      const distSq = m.pos.distanceToSquared(player.pos);
      if (distSq > 64 * 64) {
        this.removeMob(i);
        continue;
      }

      if (m.hurtFlash > 0) {
        m.hurtFlash -= clampedDt;
        if (m.hurtFlash <= 0) m.setFlash(false);
      }
      if (m.attackCooldown > 0) m.attackCooldown -= clampedDt;
      if (m.fleeTimer > 0) m.fleeTimer -= clampedDt;

      // Burn night stalkers in bright direct daylight
      if (m.type === 'stalker' && sunBrightness > 0.78 && this.world.getSkyLight(m.pos.x, m.pos.y + 1, m.pos.z) >= 13) {
        m.health -= clampedDt * 3.5;
        m.setFlash(Math.floor(performance.now() / 120) % 2 === 0);
        if (m.health <= 0) {
          this.onMobKilled(m);
          this.removeMob(i);
          continue;
        }
      }

      // AI Decision
      const dist = Math.sqrt(distSq);
      if (m.hostile && player.mode === 'survival' && dist < 17) {
        const dx = player.pos.x - m.pos.x;
        const dz = player.pos.z - m.pos.z;
        m.targetYaw = Math.atan2(dx, dz);
        m.moving = true;

        // Melee attack on contact
        if (dist < 1.25 && Math.abs(player.pos.y - m.pos.y) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.1;
          const knock = new THREE.Vector3(dx, 0, dz).normalize();
          player.damage(m.type === 'stalker' ? 3 : 2, knock);
        }
      } else {
        m.aiTimer -= clampedDt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.5 + Math.random() * 3.0;
          if (Math.random() < 0.62) {
            m.targetYaw = Math.random() * Math.PI * 2;
            m.moving = true;
          } else {
            m.moving = false;
          }
        }
      }

      // Smooth turn
      let diff = m.targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, clampedDt * 7);

      const moveSpd = m.fleeTimer > 0 ? m.speed * 1.65 : m.speed;
      if (m.moving || m.fleeTimer > 0) {
        const wx = Math.sin(m.yaw) * moveSpd;
        const wz = Math.cos(m.yaw) * moveSpd;
        m.vel.x += (wx - m.vel.x) * Math.min(1, clampedDt * 8);
        m.vel.z += (wz - m.vel.z) * Math.min(1, clampedDt * 8);

        // Slime rhythmic hop
        if (m.type === 'slime' && m.onGround && Math.sin(m.walkTime * 3) > 0.85) {
          m.vel.y = 6.8;
          m.onGround = false;
        }
      } else {
        m.vel.x *= Math.pow(0.08, clampedDt);
        m.vel.z *= Math.pow(0.08, clampedDt);
      }

      // Gravity & Water float
      const inWater = this.world.getBlock(m.pos.x, m.pos.y + 0.3, m.pos.z) === BLOCK.WATER;
      if (inWater) {
        m.vel.y = Math.min(2.6, m.vel.y + 12 * clampedDt);
      } else {
        m.vel.y = Math.max(-28, m.vel.y - 24 * clampedDt);
      }

      // Y collision
      const ny = m.pos.y + m.vel.y * clampedDt;
      if (!this.collides(m, m.pos.x, ny, m.pos.z)) {
        m.pos.y = ny;
        m.onGround = false;
      } else {
        if (m.vel.y < 0) m.onGround = true;
        m.vel.y = 0;
      }

      // X & Z collision + automatic 1-block step jump
      let blockedHoriz = false;
      const nx = m.pos.x + m.vel.x * clampedDt;
      if (!this.collides(m, nx, m.pos.y, m.pos.z)) {
        m.pos.x = nx;
      } else {
        blockedHoriz = true;
        m.vel.x = 0;
      }

      const nz = m.pos.z + m.vel.z * clampedDt;
      if (!this.collides(m, m.pos.x, m.pos.y, nz)) {
        m.pos.z = nz;
      } else {
        blockedHoriz = true;
        m.vel.z = 0;
      }

      if (blockedHoriz && m.onGround) {
        m.vel.y = 7.4;
        m.onGround = false;
      }

      // Animate legs / slime squash
      const hSpeed = Math.hypot(m.vel.x, m.vel.z);
      m.walkTime += clampedDt * (1.5 + hSpeed * 2.2);

      if (m.legs.length >= 2) {
        const amp = Math.min(0.65, hSpeed * 0.22);
        m.legs.forEach((leg, idx) => {
          const sign = idx % 2 === 0 ? 1 : -1;
          leg.rotation.x = Math.sin(m.walkTime * 2.6) * amp * sign;
        });
      }
      if (m.bodyPivot) {
        const squash = m.onGround ? 1 + Math.sin(m.walkTime * 4) * 0.08 : 1.15;
        m.bodyPivot.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      }
      if (m.head && dist < 8) {
        const lookYaw = Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z) - m.yaw;
        if (Math.abs(lookYaw) < 1.1) {
          m.head.rotation.y = lookYaw * 0.55;
        } else {
          m.head.rotation.y *= 0.9;
        }
      }

      m.root.position.copy(m.pos);
      m.root.rotation.y = m.yaw;
    }
  }
}
