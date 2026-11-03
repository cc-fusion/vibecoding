import * as THREE from 'three';
import { BLOCK, ITEM, REGISTRY, WATER_LEVEL } from './constants.js';

export class EntityManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = [];
    this.drops = [];
    this.maxMobs = 16;
    this._spawnCooldown = 1.5;
  }

  clearAll() {
    for (const m of this.mobs) {
      this.scene.remove(m.group);
    }
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
    }
    this.mobs = [];
    this.drops = [];
  }

  spawnDroppedItem(x, y, z, itemId, count = 1) {
    const def = REGISTRY[itemId];
    if (!def) return;
    const color = def.particleColor ?? (def.isTool ? 0x68d8d6 : 0xf2b84b);
    const size = def.isBlock ? 0.28 : 0.22;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: def.light ? 0x553300 : 0x111111,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.25, z);
    this.scene.add(mesh);

    this.drops.push({
      itemId,
      count,
      mesh,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2.8 + Math.random() * 1.4,
      vz: (Math.random() - 0.5) * 2.2,
      age: 0,
      pickupDelay: 0.28,
    });
  }

  spawnMobNearPlayer(playerPos, isNight, gameMode) {
    if (this.mobs.length >= this.maxMobs) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 18;
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
    const wy = this.world.getHighestSolidY(wx, wz);

    if (wy <= WATER_LEVEL || wy > 54) return;
    const groundId = this.world.getBlock(wx, wy, wz);
    if (groundId === BLOCK.WATER || groundId === BLOCK.AIR) return;

    let type = 'sheep';
    const roll = Math.random();
    if (isNight && gameMode === 'survival' && roll < 0.42) {
      type = 'zombie';
    } else if (roll < 0.34) {
      type = 'sheep';
    } else if (roll < 0.64) {
      type = 'pig';
    } else if (roll < 0.86) {
      type = 'cow';
    } else {
      type = 'slime';
    }

    this.createMob(type, wx + 0.5, wy + 1.05, wz + 0.5);
  }

  createMob(type, x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const legs = [];
    const mats = [];

    const makeBox = (w, h, d, hex, px, py, pz) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshLambertMaterial({ color: hex });
      mats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      group.add(m);
      return m;
    };

    let maxHp = 10;
    let speed = 1.8;
    let hostile = false;

    if (type === 'sheep') {
      maxHp = 10;
      speed = 1.7;
      // Fluffy body
      makeBox(0.75, 0.55, 1.05, 0xf2f4f7, 0, 0.58, 0);
      // Head
      makeBox(0.44, 0.42, 0.46, 0xd8cfc4, 0, 0.78, 0.58);
      // Eyes
      makeBox(0.08, 0.08, 0.05, 0x1e1e1e, -0.13, 0.82, 0.82);
      makeBox(0.08, 0.08, 0.05, 0x1e1e1e, 0.13, 0.82, 0.82);
      // 4 legs
      legs.push(makeBox(0.18, 0.42, 0.18, 0xd8cfc4, -0.22, 0.21, 0.32));
      legs.push(makeBox(0.18, 0.42, 0.18, 0xd8cfc4, 0.22, 0.21, 0.32));
      legs.push(makeBox(0.18, 0.42, 0.18, 0xd8cfc4, -0.22, 0.21, -0.32));
      legs.push(makeBox(0.18, 0.42, 0.18, 0xd8cfc4, 0.22, 0.21, -0.32));
    } else if (type === 'pig') {
      maxHp = 10;
      speed = 1.9;
      makeBox(0.68, 0.48, 0.95, 0xf29bb0, 0, 0.5, 0);
      makeBox(0.44, 0.42, 0.44, 0xf5a6b9, 0, 0.64, 0.52);
      // Snout
      makeBox(0.22, 0.16, 0.12, 0xe07b93, 0, 0.58, 0.76);
      makeBox(0.07, 0.07, 0.05, 0x1e1e1e, -0.13, 0.68, 0.74);
      makeBox(0.07, 0.07, 0.05, 0x1e1e1e, 0.13, 0.68, 0.74);
      legs.push(makeBox(0.16, 0.34, 0.16, 0xe589a0, -0.2, 0.17, 0.3));
      legs.push(makeBox(0.16, 0.34, 0.16, 0xe589a0, 0.2, 0.17, 0.3));
      legs.push(makeBox(0.16, 0.34, 0.16, 0xe589a0, -0.2, 0.17, -0.3));
      legs.push(makeBox(0.16, 0.34, 0.16, 0xe589a0, 0.2, 0.17, -0.3));
    } else if (type === 'cow') {
      maxHp = 14;
      speed = 1.65;
      makeBox(0.78, 0.62, 1.12, 0x5c3e26, 0, 0.66, 0);
      makeBox(0.46, 0.46, 0.46, 0x6b492e, 0, 0.86, 0.62);
      // White patch & horns
      makeBox(0.4, 0.35, 0.5, 0xedeae4, 0, 0.82, -0.05);
      makeBox(0.08, 0.18, 0.08, 0xd9d2c5, -0.24, 1.06, 0.62);
      makeBox(0.08, 0.18, 0.08, 0xd9d2c5, 0.24, 1.06, 0.62);
      legs.push(makeBox(0.18, 0.46, 0.18, 0x4f3520, -0.24, 0.23, 0.36));
      legs.push(makeBox(0.18, 0.46, 0.18, 0x4f3520, 0.24, 0.23, 0.36));
      legs.push(makeBox(0.18, 0.46, 0.18, 0x4f3520, -0.24, 0.23, -0.36));
      legs.push(makeBox(0.18, 0.46, 0.18, 0x4f3520, 0.24, 0.23, -0.36));
    } else if (type === 'zombie') {
      maxHp = 18;
      speed = 2.55;
      hostile = true;
      // Head
      makeBox(0.46, 0.46, 0.46, 0x568f49, 0, 1.48, 0);
      makeBox(0.09, 0.07, 0.05, 0x151515, -0.11, 1.5, 0.24);
      makeBox(0.09, 0.07, 0.05, 0x151515, 0.11, 1.5, 0.24);
      // Torso
      makeBox(0.48, 0.66, 0.26, 0x2d7d9a, 0, 0.92, 0);
      // Raised Zombie Arms
      makeBox(0.18, 0.18, 0.58, 0x568f49, -0.34, 1.14, 0.22);
      makeBox(0.18, 0.18, 0.58, 0x568f49, 0.34, 1.14, 0.22);
      // Legs
      legs.push(makeBox(0.2, 0.6, 0.22, 0x3b3f73, -0.12, 0.3, 0));
      legs.push(makeBox(0.2, 0.6, 0.22, 0x3b3f73, 0.12, 0.3, 0));
    } else {
      // Slime
      maxHp = 8;
      speed = 2.0;
      makeBox(0.65, 0.65, 0.65, 0x5fd64b, 0, 0.33, 0);
      makeBox(0.1, 0.1, 0.06, 0x1d4716, -0.14, 0.42, 0.33);
      makeBox(0.1, 0.1, 0.06, 0x1d4716, 0.14, 0.42, 0.33);
    }

    this.scene.add(group);
    const mob = {
      type,
      group,
      legs,
      mats,
      hp: maxHp,
      maxHp,
      speed,
      hostile,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      aiTimer: 1 + Math.random() * 3,
      moving: true,
      hurtTimer: 0,
      attackCooldown: 0,
      walkPhase: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  // Check if player swing hits a mob
  tryAttackMob(origin, dir, damage, audio, particles, maxDist = 4.3) {
    let closestMob = null;
    let closestDist = maxDist;

    for (const mob of this.mobs) {
      const center = mob.group.position.clone().add(new THREE.Vector3(0, 0.65, 0));
      const toMob = center.sub(origin);
      const dist = toMob.length();
      if (dist > closestDist) continue;
      const dot = toMob.normalize().dot(dir);
      if (dot > 0.84) {
        closestDist = dist;
        closestMob = mob;
      }
    }

    if (!closestMob) return null;

    closestMob.hp -= damage;
    closestMob.hurtTimer = 0.28;
    for (const mat of closestMob.mats) {
      mat.emissive.setHex(0xaa1111);
    }

    // Knockback
    closestMob.vx = dir.x * 6.5;
    closestMob.vy = 4.2;
    closestMob.vz = dir.z * 6.5;

    if (audio) audio.playHit(closestMob.hostile);

    if (closestMob.hp <= 0) {
      const pos = closestMob.group.position;
      if (particles) {
        particles.spawnBlockBreak(pos.x - 0.5, pos.y, pos.z - 0.5, BLOCK.WOOL, 18);
      }
      // Drop loot
      if (closestMob.type === 'sheep') {
        this.spawnDroppedItem(pos.x, pos.y, pos.z, BLOCK.WOOL, 1);
        this.spawnDroppedItem(pos.x + 0.2, pos.y, pos.z, ITEM.COOKED_MEAT, 1);
      } else if (closestMob.type === 'pig' || closestMob.type === 'cow') {
        this.spawnDroppedItem(pos.x, pos.y, pos.z, ITEM.COOKED_MEAT, 2);
      } else if (closestMob.type === 'zombie') {
        const dropId = Math.random() < 0.25 ? ITEM.DIAMOND : ITEM.IRON_INGOT;
        this.spawnDroppedItem(pos.x, pos.y, pos.z, dropId, 1);
      } else {
        this.spawnDroppedItem(pos.x, pos.y, pos.z, ITEM.COAL, 1);
      }

      this.scene.remove(closestMob.group);
      this.mobs = this.mobs.filter((m) => m !== closestMob);
      return { killed: true, mob: closestMob };
    }

    // Passive mobs flee when hit
    if (!closestMob.hostile) {
      closestMob.yaw = Math.atan2(dir.x, dir.z);
      closestMob.moving = true;
      closestMob.aiTimer = 2.5;
    }

    return { killed: false, mob: closestMob };
  }

  update(dt, player, isNight, audio, onPickupCallback) {
    const playerPos = player.position;

    // 1. Periodic spawning
    this._spawnCooldown -= dt;
    if (this._spawnCooldown <= 0) {
      this._spawnCooldown = 2.5;
      this.spawnMobNearPlayer(playerPos, isNight, player.mode);
    }

    // 2. Update Mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const pos = m.group.position;

      // Despawn if too far
      const dxP = playerPos.x - pos.x;
      const dzP = playerPos.z - pos.z;
      const distSq = dxP * dxP + dzP * dzP;
      if (distSq > 55 * 55) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
        continue;
      }

      if (m.hurtTimer > 0) {
        m.hurtTimer -= dt;
        if (m.hurtTimer <= 0) {
          for (const mat of m.mats) mat.emissive.setHex(0x000000);
        }
      }

      if (m.attackCooldown > 0) m.attackCooldown -= dt;

      // AI Decision
      if (m.hostile && player.mode === 'survival' && distSq < 18 * 18) {
        m.yaw = Math.atan2(dxP, dzP);
        m.moving = true;
        if (distSq < 1.55 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.25;
          player.takeDamage(2, audio);
        }
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.5 + Math.random() * 3.5;
          m.moving = Math.random() < 0.68;
          if (m.moving) {
            m.yaw += (Math.random() - 0.5) * 2.2;
          }
        }
      }

      const moveSpeed = m.hurtTimer > 0 ? m.speed * 1.6 : m.speed;
      if (m.moving && m.hurtTimer <= 0) {
        m.vx = Math.sin(m.yaw) * moveSpeed;
        m.vz = Math.cos(m.yaw) * moveSpeed;
      } else if (m.hurtTimer <= 0) {
        m.vx *= 0.8;
        m.vz *= 0.8;
      }

      // Gravity
      m.vy -= 22.0 * dt;

      // Check forward obstacle to auto-hop 1 block
      const nextX = pos.x + m.vx * dt;
      const nextZ = pos.z + m.vz * dt;
      const footY = Math.floor(pos.y + 0.05);

      if (this.world.isSolidAt(nextX, footY, nextZ)) {
        // Can we jump 1 block up?
        if (!this.world.isSolidAt(nextX, footY + 1, nextZ) && !this.world.isSolidAt(nextX, footY + 2, nextZ)) {
          if (Math.abs(m.vy) < 0.2) {
            m.vy = 6.8;
          }
        } else {
          m.vx = 0;
          m.vz = 0;
          m.yaw += Math.PI * 0.6;
        }
      } else {
        pos.x = nextX;
        pos.z = nextZ;
      }

      // Vertical resolution
      pos.y += m.vy * dt;
      const groundCheckY = Math.floor(pos.y);
      if (this.world.isSolidAt(pos.x, groundCheckY, pos.z)) {
        pos.y = groundCheckY + 1.001;
        m.vy = m.type === 'slime' && m.moving ? 5.2 : 0;
      }

      m.group.rotation.y = m.yaw;

      // Animate legs
      if (m.legs.length > 0) {
        if (Math.abs(m.vx) + Math.abs(m.vz) > 0.15) {
          m.walkPhase += dt * 9;
          const swing = Math.sin(m.walkPhase) * 0.55;
          m.legs[0].rotation.x = swing;
          if (m.legs[1]) m.legs[1].rotation.x = -swing;
          if (m.legs[2]) m.legs[2].rotation.x = -swing;
          if (m.legs[3]) m.legs[3].rotation.x = swing;
        } else {
          for (const leg of m.legs) leg.rotation.x *= 0.85;
        }
      }
    }

    // 3. Update Dropped Items
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.pickupDelay > 0) d.pickupDelay -= dt;

      if (d.age > 90) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.drops.splice(i, 1);
        continue;
      }

      const pos = d.mesh.position;
      d.vy -= 16.0 * dt;
      pos.x += d.vx * dt;
      pos.y += d.vy * dt;
      pos.z += d.vz * dt;
      d.vx *= 0.92;
      d.vz *= 0.92;

      const by = Math.floor(pos.y - 0.15);
      if (this.world.isSolidAt(pos.x, by, pos.z)) {
        pos.y = by + 1.16;
        d.vy = 0;
      }

      d.mesh.rotation.y += dt * 2.4;

      // Magnetic pickup toward player
      if (d.pickupDelay <= 0) {
        const dx = playerPos.x - pos.x;
        const dy = playerPos.y + 0.9 - pos.y;
        const dz = playerPos.z - pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 4.2) {
          pos.x += (dx / dist) * 11.5 * dt;
          pos.y += (dy / dist) * 11.5 * dt;
          pos.z += (dz / dist) * 11.5 * dt;
          if (dist < 0.85) {
            if (onPickupCallback) {
              onPickupCallback(d.itemId, d.count);
            }
            this.scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
            this.drops.splice(i, 1);
          }
        }
      }
    }
  }
}
