import * as THREE from 'three';
import { getBlock } from './blocks.js';

const DROP_COLORS = {
  coal: '#343a3d', raw_iron: '#b88970', iron_ingot: '#d8dfdc', crystal: '#61e2da', apple: '#c94f45', berries: '#b84256',
  raw_meat: '#c77772', cooked_meat: '#a96b3f', plant_fiber: '#7a9b4c', guardian_core: '#e8bd55', oak_log: '#795236', dirt: '#765037',
};
const tempVec = new THREE.Vector3();
const tempBox = new THREE.Box3();
const HIT_COLOR = new THREE.Color('#7a1e1e');
const NO_EMISSION = new THREE.Color('#000000');

function part(group, size, position, color, emissive = '#000000') {
  const material = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive === '#000000' ? 0 : 0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.userData.baseEmissive = new THREE.Color(emissive);
  group.add(mesh);
  return mesh;
}

function createModel(type) {
  const group = new THREE.Group();
  const parts = { legs: [], arms: [] };
  let width = 0.8; let height = 1.6;
  if (type === 'grazer') {
    width = 1.1; height = 1.35;
    part(group, [1.25, 0.72, 0.68], [0, 0.9, 0], '#a58b68');
    parts.head = part(group, [0.62, 0.62, 0.62], [0, 1.05, -0.65], '#b39a77');
    part(group, [0.16, 0.13, 0.05], [-0.17, 1.12, -0.98], '#20282a', '#20282a');
    part(group, [0.16, 0.13, 0.05], [0.17, 1.12, -0.98], '#20282a', '#20282a');
    part(group, [0.5, 0.15, 0.45], [0, 1.35, -0.58], '#6f8d4b');
    for (const x of [-0.42, 0.42]) for (const z of [-0.22, 0.22]) {
      const leg = part(group, [0.22, 0.65, 0.22], [x, 0.34, z], '#79654f');
      parts.legs.push(leg);
    }
  } else if (type === 'duskling') {
    width = 0.75; height = 1.85;
    part(group, [0.68, 0.78, 0.4], [0, 1.08, 0], '#29384b');
    parts.head = part(group, [0.62, 0.62, 0.58], [0, 1.75, 0], '#344a5b');
    part(group, [0.13, 0.09, 0.04], [-0.16, 1.8, -0.31], '#78e3d4', '#4ca99f');
    part(group, [0.13, 0.09, 0.04], [0.16, 1.8, -0.31], '#78e3d4', '#4ca99f');
    for (const x of [-0.22, 0.22]) parts.legs.push(part(group, [0.25, 0.75, 0.28], [x, 0.38, 0], '#202d3d'));
    for (const x of [-0.47, 0.47]) parts.arms.push(part(group, [0.2, 0.8, 0.24], [x, 1.08, 0], '#304459'));
  } else if (type === 'skitter') {
    width = 1.25; height = 0.85;
    part(group, [0.85, 0.42, 1.0], [0, 0.52, 0.1], '#3f344b');
    parts.head = part(group, [0.65, 0.46, 0.55], [0, 0.5, -0.62], '#55415d');
    for (const x of [-0.18, 0.18]) part(group, [0.11, 0.09, 0.04], [x, 0.57, -0.91], '#dc7b75', '#8f3434');
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const leg = part(group, [0.75, 0.13, 0.14], [side * 0.63, 0.28, -0.4 + i * 0.4], '#302a3b');
      leg.rotation.z = side * -0.35;
      parts.legs.push(leg);
    }
  } else if (type === 'spitter') {
    width = 0.9; height = 1.65;
    part(group, [0.72, 0.85, 0.6], [0, 0.92, 0], '#385c50');
    parts.head = part(group, [0.78, 0.58, 0.68], [0, 1.52, -0.04], '#426e5b');
    parts.core = part(group, [0.32, 0.25, 0.08], [0, 1.48, -0.4], '#a8c96c', '#52682e');
    for (const x of [-0.23, 0.23]) parts.legs.push(part(group, [0.24, 0.65, 0.28], [x, 0.33, 0], '#2c473f'));
    for (const x of [-0.49, 0.49]) parts.arms.push(part(group, [0.2, 0.7, 0.22], [x, 1.0, 0], '#315247'));
  } else if (type === 'guardian') {
    width = 1.7; height = 3.8;
    part(group, [1.55, 1.5, 0.9], [0, 2.15, 0], '#56646a');
    part(group, [1.2, 0.32, 1.0], [0, 2.65, 0], '#78817d');
    parts.head = part(group, [1.05, 0.95, 0.9], [0, 3.35, 0], '#647278');
    parts.core = part(group, [0.58, 0.68, 0.12], [0, 2.15, -0.51], '#62d9ce', '#318b88');
    for (const x of [-0.28, 0.28]) part(group, [0.16, 0.12, 0.05], [x, 3.45, -0.47], '#e7c760', '#9b762a');
    for (const x of [-0.48, 0.48]) parts.legs.push(part(group, [0.58, 1.35, 0.65], [x, 0.68, 0], '#47545b'));
    for (const x of [-1.03, 1.03]) parts.arms.push(part(group, [0.55, 1.7, 0.65], [x, 2.05, 0], '#4e5c63'));
    part(group, [0.32, 0.55, 0.32], [-0.55, 2.95, 0], '#5dc8be', '#266c68');
    part(group, [0.32, 0.55, 0.32], [0.55, 2.95, 0], '#5dc8be', '#266c68');
  }
  group.userData.parts = parts;
  return { group, width, height, parts };
}

const STATS = {
  grazer: { name: 'Meadow Grazer', health: 12, speed: 1.35, xp: 8 },
  duskling: { name: 'Duskling', health: 18, speed: 2.55, damage: 3, xp: 24 },
  skitter: { name: 'Skitter', health: 11, speed: 3.4, damage: 2, xp: 20 },
  spitter: { name: 'Mire Spitter', health: 16, speed: 1.9, damage: 2, xp: 28 },
  guardian: { name: 'Ancient Guardian', health: 200, speed: 1.75, damage: 7, xp: 320 },
};

export class EntityManager {
  constructor(scene, world, player, inventory, particles, audio, hooks = {}, mode = 'survival') {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.particles = particles;
    this.audio = audio;
    this.hooks = hooks;
    this.mode = mode;
    this.entities = [];
    this.drops = [];
    this.projectiles = [];
    this.spawnTimer = 2;
    this.sunDamageTimer = 0;
    this.boss = null;
    this.nextId = 1;
    this.projectileGeometry = new THREE.SphereGeometry(0.14, 6, 5);
    this.projectileMaterials = {
      spitter: new THREE.MeshBasicMaterial({ color: '#a4c96c' }),
      guardian: new THREE.MeshBasicMaterial({ color: '#63ddd3' }),
    };
  }

  spawn(type, position, saved = null) {
    const model = createModel(type);
    const stats = STATS[type];
    const entity = {
      id: this.nextId++, type, name: stats.name, group: model.group, position: model.group.position,
      width: model.width, height: model.height, parts: model.parts,
      velocity: new THREE.Vector3(), health: saved?.health ?? stats.health, maxHealth: stats.health,
      speed: stats.speed, damage: stats.damage || 0, xp: stats.xp, hostile: type !== 'grazer', boss: type === 'guardian',
      onGround: false, age: saved?.age || 0, walkPhase: 0, wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 0, attackCooldown: 0, specialCooldown: 1 + Math.random() * 2,
      hurtTimer: 0, hitFlash: 0, dead: false, windup: 0, pendingAttack: null,
      phase: saved?.phase || 1, attackState: null, strafe: Math.random() > 0.5 ? 1 : -1,
    };
    entity.position.copy(position);
    this.scene.add(entity.group);
    this.entities.push(entity);
    if (entity.boss) {
      this.boss = entity;
      this.hooks.onBoss?.(entity);
    }
    return entity;
  }

  findSpawnPosition(hostile) {
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 13 + Math.random() * 15;
      const x = Math.floor(this.player.position.x + Math.cos(angle) * distance) + 0.5;
      const z = Math.floor(this.player.position.z + Math.sin(angle) * distance) + 0.5;
      const underground = hostile && this.player.position.y < 20;
      const maxY = underground ? this.player.position.y + 4 : Math.min(71, this.player.position.y + 14);
      const y = this.world.highestSolid(x, z, maxY);
      if (y <= 0 || Math.abs(y - this.player.position.y) > 12) continue;
      if (this.world.isWater(x, y, z) || this.world.isSolid(x, y, z) || this.world.isSolid(x, y + 1, z)) continue;
      return new THREE.Vector3(x, y + 0.02, z);
    }
    return null;
  }

  trySpawn(environment) {
    const hostiles = this.entities.filter((e) => e.hostile && !e.boss).length;
    const passives = this.entities.filter((e) => !e.hostile).length;
    const underground = this.player.position.y < 20;
    const shouldHostile = this.mode !== 'peaceful' && (environment.isNight || underground) && hostiles < (underground ? 7 : 8);
    if (shouldHostile && Math.random() < 0.72) {
      const position = this.findSpawnPosition(true);
      if (position) {
        const roll = Math.random();
        this.spawn(roll < 0.48 ? 'duskling' : roll < 0.75 ? 'skitter' : 'spitter', position);
      }
    } else if (!environment.isNight && passives < 6 && Math.random() < 0.55) {
      const position = this.findSpawnPosition(false);
      if (position) this.spawn('grazer', position);
    }
  }

  summonGuardian(saved = null) {
    if (this.boss) return this.boss;
    let position;
    if (saved?.position) position = new THREE.Vector3().fromArray(saved.position);
    else {
      const direction = this.player.lookDirection(new THREE.Vector3()); direction.y = 0; direction.normalize();
      position = this.player.position.clone().addScaledVector(direction, 7);
      position.y = this.world.highestSolid(position.x, position.z, this.player.position.y + 8) + 0.02;
    }
    const boss = this.spawn('guardian', position, saved);
    this.audio.play('summon');
    this.particles.burst(position.clone().add(new THREE.Vector3(0, 2, 0)), '#65e1d7', 55, { speed: 6, life: 1.5, gravity: 2 });
    return boss;
  }

  spawnDrop(id, count, position, velocity = null) {
    if (!id || count <= 0) return;
    const material = new THREE.MeshLambertMaterial({ color: DROP_COLORS[id] || '#9a8c76', emissive: id === 'crystal' || id === 'guardian_core' ? '#174c4b' : '#000000' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), material);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * 0.35;
    mesh.position.z += (Math.random() - 0.5) * 0.35;
    this.scene.add(mesh);
    this.drops.push({ id, count, mesh, position: mesh.position, velocity: velocity?.clone() || new THREE.Vector3((Math.random() - 0.5) * 2, 2.5 + Math.random(), (Math.random() - 0.5) * 2), age: 0 });
    if (this.drops.length > 120) this.removeDrop(this.drops[0]);
  }

  removeDrop(drop) {
    this.scene.remove(drop.mesh);
    drop.mesh.geometry.dispose(); drop.mesh.material.dispose();
    const index = this.drops.indexOf(drop);
    if (index >= 0) this.drops.splice(index, 1);
  }

  shoot(owner, target, kind = 'spitter', spread = 0) {
    const origin = owner.position.clone().add(new THREE.Vector3(0, owner.boss ? 2.2 : 1.35, 0));
    const direction = target.clone().sub(origin).normalize();
    if (spread) {
      direction.x += (Math.random() - 0.5) * spread;
      direction.y += (Math.random() - 0.5) * spread;
      direction.z += (Math.random() - 0.5) * spread;
      direction.normalize();
    }
    const mesh = new THREE.Mesh(this.projectileGeometry, this.projectileMaterials[kind]);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, position: mesh.position, velocity: direction.multiplyScalar(owner.boss ? 8 : 7), life: 6, damage: owner.boss ? 4 : 2, kind, owner });
  }

  entityCollisions(entity, position = entity.position) {
    const radius = entity.width / 2;
    const collisions = [];
    const minX = position.x - radius; const maxX = position.x + radius;
    const minY = position.y; const maxY = position.y + entity.height;
    const minZ = position.z - radius; const maxZ = position.z + radius;
    for (let y = Math.floor(minY + 0.001); y <= Math.floor(maxY - 0.001); y++) {
      for (let z = Math.floor(minZ + 0.001); z <= Math.floor(maxZ - 0.001); z++) {
        for (let x = Math.floor(minX + 0.001); x <= Math.floor(maxX - 0.001); x++) {
          if (getBlock(this.world.getBlock(x, y, z)).solid) collisions.push({ x, y, z });
        }
      }
    }
    return collisions;
  }

  moveAxis(entity, axis, amount) {
    if (!amount) return false;
    entity.position[axis] += amount;
    const collisions = this.entityCollisions(entity);
    if (!collisions.length) return false;
    const radius = entity.width / 2;
    for (const block of collisions) {
      if (axis === 'x') entity.position.x = amount > 0 ? Math.min(entity.position.x, block.x - radius - 0.001) : Math.max(entity.position.x, block.x + 1 + radius + 0.001);
      if (axis === 'z') entity.position.z = amount > 0 ? Math.min(entity.position.z, block.z - radius - 0.001) : Math.max(entity.position.z, block.z + 1 + radius + 0.001);
      if (axis === 'y') entity.position.y = amount > 0 ? Math.min(entity.position.y, block.y - entity.height - 0.001) : Math.max(entity.position.y, block.y + 1 + 0.001);
    }
    entity.velocity[axis] = 0;
    return true;
  }

  moveEntity(entity, direction, speed, dt) {
    const hasDirection = direction.lengthSq() > 0.001;
    if (hasDirection) {
      direction.normalize();
      const targetYaw = Math.atan2(-direction.x, -direction.z);
      let delta = targetYaw - entity.group.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      entity.group.rotation.y += delta * Math.min(1, dt * 8);
    }
    const blend = 1 - Math.exp(-dt * (entity.onGround ? 9 : 2.5));
    entity.velocity.x += ((hasDirection ? direction.x * speed : 0) - entity.velocity.x) * blend;
    entity.velocity.z += ((hasDirection ? direction.z * speed : 0) - entity.velocity.z) * blend;
    entity.velocity.y = Math.max(-30, entity.velocity.y - 21 * dt);
    const hitX = this.moveAxis(entity, 'x', entity.velocity.x * dt);
    const hitZ = this.moveAxis(entity, 'z', entity.velocity.z * dt);
    if ((hitX || hitZ) && entity.onGround && hasDirection) entity.velocity.y = entity.boss ? 7.5 : 6.2;
    entity.onGround = false;
    const verticalVelocity = entity.velocity.y;
    if (this.moveAxis(entity, 'y', verticalVelocity * dt) && verticalVelocity <= 0) entity.onGround = true;
    entity.walkPhase += Math.hypot(entity.velocity.x, entity.velocity.z) * dt * 3;
    const swing = Math.sin(entity.walkPhase) * Math.min(0.65, Math.hypot(entity.velocity.x, entity.velocity.z) * 0.2);
    entity.parts.legs.forEach((leg, index) => { leg.rotation.x = swing * (index % 2 ? -1 : 1); });
    entity.parts.arms.forEach((arm, index) => { arm.rotation.x = swing * (index % 2 ? 1 : -1) * 0.7; });
  }

  melee(entity, distance) {
    if (entity.attackCooldown > 0 || distance > (entity.boss ? 2.4 : 1.65)) return;
    entity.attackCooldown = entity.boss ? 1.3 : 1.05;
    const knockback = this.player.position.clone().sub(entity.position).setY(0).normalize().multiplyScalar(entity.boss ? 7 : 4);
    this.player.damage(entity.damage, entity.name, knockback);
  }

  beginBossAttack(boss, kind) {
    const duration = kind === 'slam' ? (boss.phase === 3 ? 0.72 : 1.05) : kind === 'volley' ? 0.9 : 1.25;
    const material = new THREE.MeshBasicMaterial({ color: kind === 'slam' ? '#e8a04f' : '#62d9d0', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
    const geometry = new THREE.RingGeometry(0.82, 1, 48);
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(boss.position).add(new THREE.Vector3(0, 0.06, 0));
    ring.scale.setScalar(0.2);
    this.scene.add(ring);
    boss.attackState = { kind, timer: duration, duration, ring };
    boss.parts.core.material.emissiveIntensity = 1.4;
  }

  finishBossAttack(boss, attack) {
    if (attack.kind === 'slam') {
      const distance = this.player.position.distanceTo(boss.position);
      if (distance < 5.8) {
        const knockback = this.player.position.clone().sub(boss.position).setY(0).normalize().multiplyScalar(9);
        this.player.damage(boss.phase === 3 ? 9 : 7, 'Guardian slam', knockback);
      }
      this.particles.burst(boss.position.clone().add(new THREE.Vector3(0, 0.3, 0)), '#b49b72', 48, { speed: 8, life: 1, gravity: 12 });
      this.audio.play('boss');
    } else if (attack.kind === 'volley') {
      const target = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      for (let i = 0; i < (boss.phase === 3 ? 7 : 4); i++) this.shoot(boss, target, 'guardian', 0.28);
      this.audio.play('summon');
    } else if (attack.kind === 'summon') {
      for (let i = 0; i < 2 + (boss.phase === 3 ? 1 : 0); i++) {
        const position = boss.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
        position.y = this.world.highestSolid(position.x, position.z, boss.position.y + 4) + 0.02;
        this.spawn(i % 2 ? 'skitter' : 'duskling', position);
      }
    }
    this.scene.remove(attack.ring);
    attack.ring.geometry.dispose(); attack.ring.material.dispose();
    boss.attackState = null;
    boss.parts.core.material.emissiveIntensity = 0.5;
    boss.specialCooldown = boss.phase === 3 ? 1.4 : boss.phase === 2 ? 2.2 : 2.8;
  }

  updateBoss(boss, dt, distance, direction) {
    const healthRatio = boss.health / boss.maxHealth;
    const newPhase = healthRatio <= 0.3 ? 3 : healthRatio <= 0.65 ? 2 : 1;
    if (newPhase !== boss.phase) {
      boss.phase = newPhase;
      boss.parts.core.material.color.set(newPhase === 3 ? '#e39a55' : '#62d9ce');
      boss.parts.core.material.emissive.set(newPhase === 3 ? '#8b3d24' : '#318b88');
      this.hooks.onBossPhase?.(newPhase);
      this.audio.play('boss');
    }
    if (boss.attackState) {
      const attack = boss.attackState;
      attack.timer -= dt;
      const progress = 1 - attack.timer / attack.duration;
      const radius = attack.kind === 'slam' ? 5.8 : 2.4;
      attack.ring.scale.setScalar(Math.max(0.2, progress * radius));
      attack.ring.material.opacity = 0.35 + Math.sin(progress * Math.PI * 8) * 0.18 + progress * 0.25;
      attack.ring.position.copy(boss.position).add(new THREE.Vector3(0, 0.06, 0));
      this.moveEntity(boss, tempVec.set(0, 0, 0), 0, dt);
      if (attack.timer <= 0) this.finishBossAttack(boss, attack);
      return;
    }
    this.moveEntity(boss, direction, boss.speed * (boss.phase === 3 ? 1.45 : 1), dt);
    this.melee(boss, distance);
    if (boss.specialCooldown <= 0 && distance < 18) {
      let kind = 'slam';
      if (boss.phase >= 2) {
        const options = boss.phase === 3 ? ['slam', 'volley', 'volley', 'summon'] : ['slam', 'volley', 'summon'];
        kind = options[Math.floor(Math.random() * options.length)];
      }
      this.beginBossAttack(boss, kind);
    }
  }

  update(dt, environment) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.8 + Math.random() * 2;
      this.trySpawn(environment);
    }
    this.sunDamageTimer -= dt;
    const sunlightDamage = this.sunDamageTimer <= 0;
    if (sunlightDamage) this.sunDamageTimer = 2;

    for (const entity of [...this.entities]) {
      if (entity.dead) continue;
      entity.age += dt;
      entity.attackCooldown = Math.max(0, entity.attackCooldown - dt);
      entity.specialCooldown -= dt;
      entity.hurtTimer = Math.max(0, entity.hurtTimer - dt);
      entity.hitFlash = Math.max(0, entity.hitFlash - dt);
      entity.group.traverse((object) => {
        if (object.isMesh) object.material.emissive.copy(entity.hitFlash > 0 ? HIT_COLOR : object.userData.baseEmissive || NO_EMISSION);
      });
      const toPlayer = this.player.position.clone().sub(entity.position);
      const distance = toPlayer.length();
      const direction = toPlayer.setY(0);
      if (!entity.boss && (distance > 62 || entity.position.y < -10)) {
        this.removeEntity(entity);
        continue;
      }
      if (entity.boss && entity.position.y < -10) {
        entity.position.copy(this.player.position).add(new THREE.Vector3(6, 0, 0));
        entity.position.y = this.world.highestSolid(entity.position.x, entity.position.z, this.player.position.y + 10) + 0.02;
        entity.velocity.set(0, 0, 0);
      }
      if (entity.boss) {
        if (distance > 55) {
          entity.velocity.set(0, 0, 0);
          this.hooks.onBoss?.(entity);
          continue;
        }
        this.updateBoss(entity, dt, distance, direction);
        this.hooks.onBoss?.(entity);
        continue;
      }
      if (entity.type === 'grazer') {
        entity.wanderTimer -= dt;
        if (entity.hurtTimer > 0) {
          direction.copy(entity.position).sub(this.player.position).setY(0);
          this.moveEntity(entity, direction, entity.speed * 2, dt);
        } else {
          if (entity.wanderTimer <= 0) {
            entity.wanderTimer = 2 + Math.random() * 4;
            entity.wanderAngle += (Math.random() - 0.5) * 3;
            entity.idle = Math.random() < 0.35;
          }
          direction.set(Math.sin(entity.wanderAngle), 0, Math.cos(entity.wanderAngle));
          this.moveEntity(entity, entity.idle ? tempVec.set(0, 0, 0) : direction, entity.speed, dt);
        }
      } else if (entity.type === 'spitter') {
        if (entity.windup > 0) {
          entity.windup -= dt;
          entity.parts.core.material.emissiveIntensity = 1.5;
          this.moveEntity(entity, tempVec.set(0, 0, 0), 0, dt);
          if (entity.windup <= 0) {
            this.shoot(entity, this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 'spitter', 0.06);
            entity.parts.core.material.emissiveIntensity = 0.5;
            entity.specialCooldown = 2.4;
          }
        } else {
          const move = direction.clone();
          if (distance < 6) move.negate();
          else if (distance < 11) move.set(-direction.z * entity.strafe, 0, direction.x * entity.strafe);
          this.moveEntity(entity, move, entity.speed, dt);
          if (entity.specialCooldown <= 0 && distance < 17) entity.windup = 0.65;
        }
        this.melee(entity, distance);
      } else if (entity.type === 'skitter') {
        const strafe = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(Math.sin(entity.age * 2.2) * 0.65);
        direction.normalize().add(strafe);
        if (entity.specialCooldown <= 0 && entity.onGround && distance > 3 && distance < 8) {
          entity.velocity.y = 7.2;
          entity.specialCooldown = 3;
        }
        this.moveEntity(entity, direction, entity.speed, dt);
        this.melee(entity, distance);
      } else {
        const chaseSpeed = entity.speed * (distance > 5 && entity.specialCooldown < 0 ? 1.65 : 1);
        if (entity.specialCooldown < -1.2) entity.specialCooldown = 2.5 + Math.random() * 2;
        this.moveEntity(entity, direction, chaseSpeed, dt);
        this.melee(entity, distance);
      }
      if (entity.hostile && sunlightDamage && !environment.isNight && environment.daylight > 0.7 && entity.position.y >= this.world.highestSolid(entity.position.x, entity.position.z) - 0.1) {
        this.damageEntity(entity, 2, null, true);
      }
    }
    this.updateDrops(dt);
    this.updateProjectiles(dt);
  }

  updateDrops(dt) {
    const playerCenter = this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    for (const drop of [...this.drops]) {
      drop.age += dt;
      const toPlayer = playerCenter.clone().sub(drop.position);
      const distance = toPlayer.length();
      if (drop.age > 0.35 && distance < 3.2) drop.velocity.addScaledVector(toPlayer.normalize(), dt * 18);
      drop.velocity.y -= 12 * dt;
      drop.velocity.multiplyScalar(Math.exp(-1.2 * dt));
      const next = drop.position.clone().addScaledVector(drop.velocity, dt);
      if (this.world.isSolid(next.x, next.y - 0.15, next.z) && drop.velocity.y < 0) {
        next.y = Math.floor(next.y - 0.15) + 1.16;
        drop.velocity.y = Math.abs(drop.velocity.y) * 0.2;
        drop.velocity.x *= 0.7; drop.velocity.z *= 0.7;
      }
      drop.position.copy(next);
      drop.mesh.rotation.x += dt * 1.8; drop.mesh.rotation.y += dt * 2.6;
      if (drop.age > 0.4 && distance < 1.25) {
        const leftover = this.inventory.addItem(drop.id, drop.count);
        const picked = drop.count - leftover;
        if (picked > 0) {
          this.audio.play('pickup');
          this.hooks.onPickup?.(drop.id, picked);
          if (leftover > 0) { drop.count = leftover; drop.age = 0; }
          else this.removeDrop(drop);
        }
      }
      if (drop.age > 180 || drop.position.y < -10) this.removeDrop(drop);
    }
  }

  updateProjectiles(dt) {
    const playerCenter = this.player.position.clone().add(new THREE.Vector3(0, 0.85, 0));
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.life -= dt;
      projectile.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.rotation.x += dt * 5;
      let remove = projectile.life <= 0;
      if (this.world.isSolid(projectile.position.x, projectile.position.y, projectile.position.z)) remove = true;
      if (projectile.position.distanceTo(playerCenter) < 0.72) {
        const knockback = projectile.velocity.clone().setY(0).normalize().multiplyScalar(3);
        this.player.damage(projectile.damage, projectile.kind === 'guardian' ? 'Guardian bolt' : 'Mire spit', knockback);
        remove = true;
      }
      if (remove) {
        this.particles.burst(projectile.position, projectile.kind === 'guardian' ? '#62d9d0' : '#a4c96c', 7, { speed: 2, life: 0.4 });
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  raycast(origin, direction, maxDistance = 4) {
    const ray = new THREE.Ray(origin, direction);
    let closest = null;
    for (const entity of this.entities) {
      if (entity.dead) continue;
      const radius = entity.width / 2;
      tempBox.min.set(entity.position.x - radius, entity.position.y, entity.position.z - radius);
      tempBox.max.set(entity.position.x + radius, entity.position.y + entity.height, entity.position.z + radius);
      const hit = ray.intersectBox(tempBox, new THREE.Vector3());
      if (hit) {
        const distance = hit.distanceTo(origin);
        if (distance <= maxDistance && (!closest || distance < closest.distance)) closest = { entity, distance };
      }
    }
    return closest;
  }

  damageEntity(entity, amount, attackDirection = null, silent = false) {
    if (!entity || entity.dead || amount <= 0) return false;
    entity.health -= amount;
    entity.hurtTimer = entity.type === 'grazer' ? 5 : entity.hurtTimer;
    entity.hitFlash = 0.13;
    if (attackDirection) {
      entity.velocity.addScaledVector(attackDirection, entity.boss ? 1.2 : 4.5);
      entity.velocity.y = Math.max(entity.velocity.y, entity.boss ? 1 : 3.2);
    }
    if (!silent) {
      this.audio.play('hit');
      this.particles.burst(entity.position.clone().add(new THREE.Vector3(0, entity.height * 0.55, 0)), entity.boss ? '#65d9d0' : '#b55d56', 8, { speed: 2.5, life: 0.45 });
    }
    if (entity.health <= 0) this.killEntity(entity);
    return true;
  }

  killEntity(entity) {
    if (entity.dead) return;
    entity.dead = true;
    const position = entity.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    this.particles.burst(position, entity.boss ? '#65e1d7' : '#7f6571', entity.boss ? 80 : 22, { speed: entity.boss ? 8 : 4, life: 1.1 });
    if (entity.type === 'grazer') this.spawnDrop('raw_meat', 1 + Math.floor(Math.random() * 2), position);
    if (entity.type === 'duskling' && Math.random() < 0.55) this.spawnDrop('coal', 1, position);
    if (entity.type === 'spitter') this.spawnDrop(Math.random() < 0.35 ? 'crystal' : 'plant_fiber', 1, position);
    if (entity.type === 'skitter' && Math.random() < 0.45) this.spawnDrop('plant_fiber', 2, position);
    if (entity.boss) {
      this.spawnDrop('guardian_core', 1, position);
      this.spawnDrop('crystal', 5, position);
      this.boss = null;
    }
    this.hooks.onKill?.(entity);
    if (entity.boss) {
      this.hooks.onBossDefeated?.();
      this.hooks.onBoss?.(null);
    }
    this.removeEntity(entity);
  }

  removeEntity(entity) {
    if (entity.attackState) {
      this.scene.remove(entity.attackState.ring);
      entity.attackState.ring.geometry.dispose(); entity.attackState.ring.material.dispose();
      entity.attackState = null;
    }
    this.scene.remove(entity.group);
    entity.group.traverse((object) => {
      if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); }
    });
    const index = this.entities.indexOf(entity);
    if (index >= 0) this.entities.splice(index, 1);
    if (this.boss === entity) this.boss = null;
  }

  serializeBoss() {
    if (!this.boss) return null;
    return { position: this.boss.position.toArray(), health: this.boss.health, phase: this.boss.phase, age: this.boss.age };
  }

  dispose() {
    for (const entity of [...this.entities]) this.removeEntity(entity);
    for (const drop of [...this.drops]) this.removeDrop(drop);
    for (const projectile of this.projectiles) this.scene.remove(projectile.mesh);
    this.projectiles.length = 0;
    this.projectileGeometry.dispose();
    Object.values(this.projectileMaterials).forEach((material) => material.dispose());
  }
}
