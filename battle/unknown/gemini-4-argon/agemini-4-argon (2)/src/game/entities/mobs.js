import * as THREE from 'three';
import { GRAVITY, SEA_LEVEL, GAME_MODES } from '../constants.js';
import { BLOCK, ITEM, getDef } from '../blocks.js';
import { moveEntityWithCollisions, entityIntersectsBlock, isBoxInWater } from '../player/physics.js';

const MOB_TYPES = {
  sheep: {
    name: 'Woolly Sheep',
    hostile: false,
    maxHealth: 10,
    speed: 1.9,
    fleeSpeed: 3.7,
    halfWidth: 0.42,
    height: 1.25,
    drops: [
      { id: BLOCK.WOOL, count: 1 },
      { id: ITEM.RAW_MEAT, count: 1 },
    ],
  },
  pig: {
    name: 'Meadow Pig',
    hostile: false,
    maxHealth: 10,
    speed: 2.0,
    fleeSpeed: 3.8,
    halfWidth: 0.4,
    height: 1.05,
    drops: [{ id: ITEM.RAW_MEAT, count: 2 }],
  },
  chicken: {
    name: 'Forest Fowl',
    hostile: false,
    maxHealth: 6,
    speed: 2.1,
    fleeSpeed: 4.0,
    halfWidth: 0.28,
    height: 0.8,
    drops: [{ id: ITEM.RAW_MEAT, count: 1 }],
  },
  zombie: {
    name: 'Dusk Stalker',
    hostile: true,
    maxHealth: 18,
    speed: 2.95,
    damage: 3,
    halfWidth: 0.34,
    height: 1.85,
    drops: [
      { id: ITEM.COAL, count: 1 },
    ],
  },
};

function buildMobRig(type) {
  const root = new THREE.Group();
  const mats = [];
  const makeMat = (hex) => {
    const m = new THREE.MeshLambertMaterial({ color: hex });
    mats.push(m);
    return m;
  };

  const legs = [];

  if (type === 'sheep' || type === 'pig') {
    const isSheep = type === 'sheep';
    const bodyMat = makeMat(isSheep ? 0xf2eee2 : 0xf0a3a8);
    const headMat = makeMat(isSheep ? 0x6b5c53 : 0xf0a3a8);
    const legMat = makeMat(isSheep ? 0x6b5c53 : 0xd98990);
    const eyeMat = makeMat(0x1e1e22);

    const bodyH = isSheep ? 0.56 : 0.48;
    const bodyY = isSheep ? 0.66 : 0.56;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, bodyH, 0.96), bodyMat);
    body.position.set(0, bodyY, 0);
    root.add(body);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, bodyY + 0.18, 0.52);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.44), headMat);
    headPivot.add(head);

    if (isSheep) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.46), bodyMat);
      cap.position.set(0, 0.18, -0.02);
      headPivot.add(cap);
    } else {
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.12), makeMat(0xe0828b));
      snout.position.set(0, -0.06, 0.25);
      headPivot.add(snout);
    }

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
    eyeL.position.set(-0.13, 0.05, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    headPivot.add(eyeL, eyeR);
    root.add(headPivot);

    const legPositions = [
      [-0.2, 0.36, 0.3],
      [0.2, 0.36, 0.3],
      [-0.2, 0.36, -0.3],
      [0.2, 0.36, -0.3],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, ly, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), legMat);
      leg.position.y = -0.18;
      pivot.add(leg);
      root.add(pivot);
      legs.push(pivot);
    }

    return { root, headPivot, legs, mats };
  }

  if (type === 'chicken') {
    const white = makeMat(0xf7f7f5);
    const beakMat = makeMat(0xe8ad38);
    const combMat = makeMat(0xd93832);
    const eyeMat = makeMat(0x1a1a1e);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.48), white);
    body.position.set(0, 0.38, 0);
    root.add(body);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.62, 0.2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), white);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), beakMat);
    beak.position.set(0, -0.02, 0.17);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.14), combMat);
    comb.position.set(0, 0.17, 0.02);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
    eyeL.position.set(-0.12, 0.04, 0.06);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    headPivot.add(head, beak, comb, eyeL, eyeR);
    root.add(headPivot);

    for (const lx of [-0.1, 0.1]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.22, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), beakMat);
      leg.position.y = -0.11;
      pivot.add(leg);
      root.add(pivot);
      legs.push(pivot);
    }

    return { root, headPivot, legs, mats };
  }

  // Hostile Dusk Stalker (Mossy Zombie)
  const skinMat = makeMat(0x527d58);
  const tunicMat = makeMat(0x375975);
  const pantsMat = makeMat(0x3a3652);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa6ffea });
  mats.push(eyeMat);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.28), tunicMat);
  torso.position.set(0, 1.04, 0);
  root.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.58, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skinMat);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.04), eyeMat);
  eyeL.position.set(-0.11, 0.02, 0.23);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.11;
  headPivot.add(head, eyeL, eyeR);
  root.add(headPivot);

  // Outstretched zombie arms
  for (const ax of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.64, 0.2), skinMat);
    arm.position.set(ax, 1.24, 0.24);
    arm.rotation.x = -Math.PI / 2.2;
    root.add(arm);
  }

  for (const lx of [-0.14, 0.14]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.7, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.7, 0.22), pantsMat);
    leg.position.y = -0.35;
    pivot.add(leg);
    root.add(pivot);
    legs.push(pivot);
  }

  return { root, headPivot, legs, mats };
}

export class MobManager {
  constructor(scene, world, dropsManager, particles, sound) {
    this.scene = scene;
    this.world = world;
    this.drops = dropsManager;
    this.particles = particles;
    this.sound = sound;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.mobs = [];
    this.spawnTimer = 1.5;
  }

  spawnInitialFauna(centerPos) {
    const types = ['sheep', 'pig', 'sheep', 'chicken', 'pig'];
    for (let i = 0; i < types.length; i++) {
      const angle = (i / types.length) * Math.PI * 2 + 0.4;
      const dist = 7 + (i % 3) * 4;
      const wx = Math.floor(centerPos.x + Math.cos(angle) * dist);
      const wz = Math.floor(centerPos.z + Math.sin(angle) * dist);
      const h = this.world.generator.getSurfaceHeight(wx, wz);
      if (h > SEA_LEVEL + 1 && h < 66) {
        this.spawnMob(types[i], wx + 0.5, h + 1.05, wz + 0.5);
      }
    }
  }

  spawnMob(type, x, y, z) {
    const spec = MOB_TYPES[type];
    if (!spec) return null;
    const rig = buildMobRig(type);
    rig.root.position.set(x, y, z);
    this.group.add(rig.root);

    const mob = {
      type,
      spec,
      rig,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: Math.random() * Math.PI * 2,
      targetYaw: Math.random() * Math.PI * 2,
      halfWidth: spec.halfWidth,
      height: spec.height,
      onGround: false,
      health: spec.maxHealth,
      hurtTimer: 0,
      aiTimer: 1 + Math.random() * 2,
      moving: false,
      fleeTimer: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
      burnTimer: 0,
    };

    // Store base colors for red hurt flash restoration
    mob.baseColors = rig.mats.map((m) => m.color.getHex());
    this.mobs.push(mob);
    return mob;
  }

  canPlaceBlockAt(bx, by, bz) {
    for (const m of this.mobs) {
      if (entityIntersectsBlock(m.pos, m.halfWidth, m.height, bx, by, bz)) {
        return false;
      }
    }
    return true;
  }

  attackAlongRay(origin, dir, maxDist, player, heldItemId) {
    let closest = null;
    let bestT = maxDist;

    for (const m of this.mobs) {
      const center = new THREE.Vector3(m.pos.x, m.pos.y + m.height * 0.52, m.pos.z);
      const toMob = center.clone().sub(origin);
      const proj = toMob.dot(dir);
      if (proj < 0 || proj > bestT) continue;

      const closestPt = origin.clone().addScaledVector(dir, proj);
      const radius = Math.max(m.halfWidth * 1.45, m.height * 0.45);
      if (closestPt.distanceTo(center) <= radius) {
        bestT = proj;
        closest = m;
      }
    }

    if (!closest) return false;

    const heldDef = heldItemId ? getDef(heldItemId) : null;
    const damage = (heldDef && heldDef.damage) ? heldDef.damage : 2;
    const kb = new THREE.Vector3(closest.pos.x - player.pos.x, 0, closest.pos.z - player.pos.z).normalize();

    this.damageMob(closest, damage, kb);
    if (player.gameMode === GAME_MODES.SURVIVAL) {
      player.inventory.damageHeldTool(1);
    }
    return true;
  }

  damageMob(mob, amount, knockDir = null) {
    mob.health -= amount;
    mob.hurtTimer = 0.28;
    this.sound.playMobHit();
    this.particles.emitCombatHit(mob.pos.x, mob.pos.y + mob.height * 0.5, mob.pos.z);

    mob.rig.mats.forEach((m) => m.color.setHex(0xff5252));

    if (knockDir) {
      mob.vel.x = knockDir.x * 6.2;
      mob.vel.z = knockDir.z * 6.2;
      mob.vel.y = 4.6;
      if (!mob.spec.hostile) {
        mob.fleeTimer = 3.6;
        mob.targetYaw = Math.atan2(knockDir.x, knockDir.z);
      }
    }

    if (mob.health <= 0) {
      for (const drop of mob.spec.drops) {
        this.drops.spawnDrop(mob.pos.x, mob.pos.y + 0.4, mob.pos.z, drop.id, drop.count);
      }
      this.particles.emitBlockBreak(mob.pos.x - 0.5, mob.pos.y + 0.2, mob.pos.z - 0.5, '#f0f0f0', 20);
      this._removeMob(mob);
    }
  }

  _removeMob(mob) {
    const idx = this.mobs.indexOf(mob);
    if (idx >= 0) this.mobs.splice(idx, 1);
    this.group.remove(mob.rig.root);
    mob.rig.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    mob.rig.mats.forEach((m) => m.dispose());
  }

  update(dt, player, isNight, peacefulMobs = false) {
    // Periodic natural spawning/despawning around player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      this._managePopulation(player, isNight, peacefulMobs);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];

      const distToPlayer = m.pos.distanceTo(player.pos);
      if (distToPlayer > 68) {
        this._removeMob(m);
        continue;
      }

      if (peacefulMobs && m.spec.hostile) {
        this._removeMob(m);
        continue;
      }

      // Restore hurt color flash
      if (m.hurtTimer > 0) {
        m.hurtTimer -= dt;
        if (m.hurtTimer <= 0) {
          m.rig.mats.forEach((mat, idx) => mat.color.setHex(m.baseColors[idx]));
        }
      }

      // Hostile Dusk Stalkers burn in bright daylight if exposed to sky
      if (m.spec.hostile && !isNight) {
        const surfY = this.world.generator.getSurfaceHeight(Math.floor(m.pos.x), Math.floor(m.pos.z));
        if (m.pos.y >= surfY) {
          m.burnTimer += dt;
          if (m.burnTimer >= 1.1) {
            m.burnTimer = 0;
            this.damageMob(m, 3, null);
            if (!this.mobs.includes(m)) continue;
          }
        }
      }

      m.attackCooldown = Math.max(0, m.attackCooldown - dt);

      // AI Decision
      let moveSpeed = 0;
      if (m.spec.hostile && player.gameMode === GAME_MODES.SURVIVAL && distToPlayer < 18) {
        const dx = player.pos.x - m.pos.x;
        const dz = player.pos.z - m.pos.z;
        m.targetYaw = Math.atan2(dx, dz);
        moveSpeed = m.spec.speed;

        if (distToPlayer < 1.35 && Math.abs(player.pos.y - m.pos.y) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.05;
          const kb = new THREE.Vector3(dx, 0, dz).normalize();
          player.takeDamage(m.spec.damage, kb);
        }
      } else if (m.fleeTimer > 0) {
        m.fleeTimer -= dt;
        moveSpeed = m.spec.fleeSpeed;
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.5;
          m.moving = Math.random() < 0.62;
          if (m.moving) {
            m.targetYaw += (Math.random() - 0.5) * Math.PI * 1.3;
          }
        }
        moveSpeed = m.moving ? m.spec.speed : 0;
      }

      // Smooth yaw turn
      let diff = m.targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, dt * 7);

      const targetVx = Math.sin(m.yaw) * moveSpeed;
      const targetVz = Math.cos(m.yaw) * moveSpeed;
      m.vel.x += (targetVx - m.vel.x) * Math.min(1, dt * 8);
      m.vel.z += (targetVz - m.vel.z) * Math.min(1, dt * 8);

      const inWater = isBoxInWater(this.world, m.pos, m.halfWidth, m.height);
      if (inWater) {
        m.vel.y = Math.min(2.6, m.vel.y + 12 * dt);
      } else {
        m.vel.y = Math.max(-32, m.vel.y - GRAVITY * dt);
      }

      const res = moveEntityWithCollisions(this.world, m, dt, false);
      // Hop over 1-block steps automatically when walking into terrain
      if (res.hitWall && m.onGround && moveSpeed > 0.2) {
        m.vel.y = 8.4;
      }

      // Limb walk animation & head look toward player when close
      const actualSpeed = Math.hypot(m.vel.x, m.vel.z);
      if (actualSpeed > 0.15) {
        m.walkPhase += dt * actualSpeed * 3.8;
      } else {
        m.walkPhase *= 0.88;
      }
      const swing = Math.sin(m.walkPhase) * Math.min(0.65, actualSpeed * 0.25);
      for (let li = 0; li < m.rig.legs.length; li++) {
        m.rig.legs[li].rotation.x = (li % 2 === 0 ? 1 : -1) * swing;
      }

      if (distToPlayer < 7 && !m.spec.hostile) {
        const lookYaw = Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z) - m.yaw;
        const clamped = Math.max(-0.6, Math.min(0.6, Math.sin(lookYaw)));
        m.rig.headPivot.rotation.y = clamped;
      } else {
        m.rig.headPivot.rotation.y *= 0.9;
      }

      m.rig.root.position.copy(m.pos);
      m.rig.root.rotation.y = m.yaw;
    }
  }

  _managePopulation(player, isNight, peacefulMobs) {
    const passiveCount = this.mobs.filter((m) => !m.spec.hostile).length;
    const hostileCount = this.mobs.filter((m) => m.spec.hostile).length;

    if (passiveCount < 9) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 18;
      const wx = Math.floor(player.pos.x + Math.cos(angle) * dist);
      const wz = Math.floor(player.pos.z + Math.sin(angle) * dist);
      const h = this.world.generator.getSurfaceHeight(wx, wz);
      const ground = this.world.getBlock(wx, h, wz);
      if (h > SEA_LEVEL + 1 && (ground === BLOCK.GRASS || ground === BLOCK.SNOW_GRASS)) {
        const pick = ['sheep', 'pig', 'chicken'][Math.floor(Math.random() * 3)];
        this.spawnMob(pick, wx + 0.5, h + 1.05, wz + 0.5);
      }
    }

    if (isNight && !peacefulMobs && player.gameMode === GAME_MODES.SURVIVAL && hostileCount < 5) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 14;
      const wx = Math.floor(player.pos.x + Math.cos(angle) * dist);
      const wz = Math.floor(player.pos.z + Math.sin(angle) * dist);
      const h = this.world.generator.getSurfaceHeight(wx, wz);
      if (h > SEA_LEVEL + 1 && h < 70) {
        this.spawnMob('zombie', wx + 0.5, h + 1.05, wz + 0.5);
      }
    }
  }

  dispose() {
    while (this.mobs.length > 0) this._removeMob(this.mobs[0]);
    this.scene.remove(this.group);
  }
}
