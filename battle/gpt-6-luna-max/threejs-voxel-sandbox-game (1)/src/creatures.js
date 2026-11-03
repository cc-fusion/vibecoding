import * as THREE from 'three';
import { SEA_LEVEL, hashUnit } from './voxel-world.js';
import { ITEM } from './items.js';

export class CreatureSystem {
  constructor(scene, world, player, onDrop, onParticles, onHurt) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.onDrop = onDrop;
    this.onParticles = onParticles;
    this.onHurt = onHurt;
    this.entities = [];
    this.sharedBox = new THREE.BoxGeometry(1, 1, 1);
    this.mats = {
      moss: new THREE.MeshLambertMaterial({ color: 0x698457 }),
      cream: new THREE.MeshLambertMaterial({ color: 0xd3bd8f }),
      darkBrown: new THREE.MeshLambertMaterial({ color: 0x654735 }),
      warmBrown: new THREE.MeshLambertMaterial({ color: 0x9a6846 }),
      muzzle: new THREE.MeshLambertMaterial({ color: 0xe4d5b6 }),
      black: new THREE.MeshBasicMaterial({ color: 0x24272b }),
      glowBody: new THREE.MeshLambertMaterial({ color: 0x55558f, emissive: 0x252d74, emissiveIntensity: 0.65 }),
      glowTrim: new THREE.MeshBasicMaterial({ color: 0x9eabff }),
    };
    this.nightSpawnTimer = 11;
    this.attackCooldown = 0;
    this.spawnWanderers();
  }

  addBox(group, material, size, position) {
    const mesh = new THREE.Mesh(this.sharedBox, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  spawnWanderers() {
    const seed = this.world.seed;
    for (let z = -32; z <= 32; z += 16) {
      for (let x = -32; x <= 32; x += 16) {
        if (Math.hypot(x, z) < 10 || hashUnit(x, z, seed + 8761) > 0.22) continue;
        const jitterX = Math.floor(hashUnit(x, z, seed + 9271) * 7) - 3;
        const jitterZ = Math.floor(hashUnit(x, z, seed + 1327) * 7) - 3;
        this.spawnWanderer(x + jitterX, z + jitterZ, hashUnit(x, z, seed + 871) * Math.PI * 2);
      }
    }
  }

  groundAt(x, z) {
    const column = this.world.column(Math.floor(x), Math.floor(z));
    if (column.height <= SEA_LEVEL + 1 || column.biome === 'snowfield') return null;
    return column.height + 1;
  }

  spawnWanderer(x, z, rotation = 0) {
    const y = this.groundAt(x, z);
    if (y === null) return;
    const group = new THREE.Group();
    const fur = hashUnit(x, z, this.world.seed + 583) > 0.5 ? this.mats.moss : this.mats.warmBrown;
    this.addBox(group, fur, [0.92, 0.57, 0.58], [0, 0.88, 0]);
    this.addBox(group, this.mats.cream, [0.48, 0.47, 0.45], [0, 1.24, 0.37]);
    this.addBox(group, this.mats.muzzle, [0.3, 0.2, 0.26], [0, 1.13, 0.64]);
    this.addBox(group, fur, [0.18, 0.31, 0.16], [-0.2, 1.57, 0.39]);
    this.addBox(group, fur, [0.18, 0.31, 0.16], [0.2, 1.57, 0.39]);
    this.addBox(group, this.mats.black, [0.075, 0.075, 0.055], [-0.13, 1.29, 0.6]);
    this.addBox(group, this.mats.black, [0.075, 0.075, 0.055], [0.13, 1.29, 0.6]);
    this.addBox(group, fur, [0.22, 0.24, 0.24], [0, 1.04, -0.39]);
    const legs = [];
    for (const lx of [-0.28, 0.28]) {
      for (const lz of [-0.19, 0.19]) {
        const leg = this.addBox(group, this.mats.darkBrown, [0.17, 0.42, 0.17], [lx, 0.35, lz]);
        legs.push(leg);
      }
    }
    group.position.set(x + 0.5, y, z + 0.5);
    group.rotation.y = rotation;
    this.scene.add(group);
    this.entities.push({
      kind: 'wanderer',
      group,
      legs,
      health: 3,
      maxHealth: 3,
      alive: true,
      targetX: x,
      targetZ: z,
      moveTimer: 1 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      seed: hashUnit(x, z, this.world.seed + 2911) * 10000,
      speed: 0.68,
      hitFlash: 0,
    });
  }

  spawnGloam() {
    const player = this.player.position;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 14 + Math.random() * 11;
      const x = Math.floor(player.x + Math.cos(angle) * distance);
      const z = Math.floor(player.z + Math.sin(angle) * distance);
      const y = this.groundAt(x, z);
      if (y === null) continue;
      const group = new THREE.Group();
      this.addBox(group, this.mats.glowBody, [0.66, 0.82, 0.62], [0, 0.86, 0]);
      this.addBox(group, this.mats.glowBody, [0.86, 0.3, 0.82], [0, 1.15, 0]);
      this.addBox(group, this.mats.glowTrim, [0.13, 0.13, 0.055], [-0.17, 0.99, 0.43]);
      this.addBox(group, this.mats.glowTrim, [0.13, 0.13, 0.055], [0.17, 0.99, 0.43]);
      this.addBox(group, this.mats.glowBody, [0.24, 0.35, 0.24], [-0.47, 0.55, 0]);
      this.addBox(group, this.mats.glowBody, [0.24, 0.35, 0.24], [0.47, 0.55, 0]);
      const light = new THREE.PointLight(0x9ba8ff, 0.75, 6, 2);
      light.position.set(0, 1.05, 0);
      group.add(light);
      group.position.set(x + 0.5, y + 0.2, z + 0.5);
      this.scene.add(group);
      this.entities.push({
        kind: 'gloam',
        group,
        health: 5,
        maxHealth: 5,
        alive: true,
        targetX: player.x,
        targetZ: player.z,
        phase: Math.random() * Math.PI * 2,
        speed: 1.5,
        hitFlash: 0,
        attackTimer: 0,
        light,
      });
      return true;
    }
    return false;
  }

  update(dt, time, nightAmount, active) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.nightSpawnTimer -= dt;
    const gloams = this.entities.filter((entity) => entity.alive && entity.kind === 'gloam');
    if (active && nightAmount > 0.57 && gloams.length < 2 && this.nightSpawnTimer <= 0) {
      if (this.spawnGloam()) this.nightSpawnTimer = 35 + Math.random() * 20;
      else this.nightSpawnTimer = 8;
    }

    for (const entity of this.entities) {
      if (!entity.alive) continue;
      entity.phase += dt * (entity.kind === 'gloam' ? 2.1 : 5.5);
      entity.hitFlash = Math.max(0, entity.hitFlash - dt);
      if (entity.kind === 'wanderer') this.updateWanderer(entity, dt, time);
      else this.updateGloam(entity, dt, nightAmount, active);
    }
    this.entities = this.entities.filter((entity) => entity.alive);
  }

  updateWanderer(entity, dt) {
    entity.moveTimer -= dt;
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const dxPlayer = entity.group.position.x - px;
    const dzPlayer = entity.group.position.z - pz;
    const distance = Math.hypot(dxPlayer, dzPlayer);
    if (distance < 4 && entity.moveTimer <= 0) {
      entity.targetX = entity.group.position.x + (dxPlayer / Math.max(0.01, distance)) * (4 + Math.random() * 4);
      entity.targetZ = entity.group.position.z + (dzPlayer / Math.max(0.01, distance)) * (4 + Math.random() * 4);
      entity.moveTimer = 2 + Math.random() * 2;
    } else if (entity.moveTimer <= 0) {
      entity.targetX = entity.group.position.x + (Math.random() - 0.5) * 8;
      entity.targetZ = entity.group.position.z + (Math.random() - 0.5) * 8;
      entity.moveTimer = 2.5 + Math.random() * 4;
    }
    this.walkTo(entity, dt, 0.68);
    const walking = Math.hypot(entity.targetX - entity.group.position.x, entity.targetZ - entity.group.position.z) > 0.35;
    entity.legs.forEach((leg, index) => {
      leg.rotation.x = walking ? Math.sin(entity.phase + index * Math.PI * 0.5) * 0.38 : 0;
    });
  }

  updateGloam(entity, dt, nightAmount, active) {
    const p = entity.group.position;
    const dx = this.player.position.x - p.x;
    const dz = this.player.position.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (nightAmount < 0.3 && distance > 10) {
      entity.dawnTimer = (entity.dawnTimer || 0) + dt;
      if (entity.dawnTimer > 5) {
        entity.alive = false;
        this.scene.remove(entity.group);
        return;
      }
    } else entity.dawnTimer = 0;
    if (active && distance < 22) {
      entity.targetX = this.player.position.x;
      entity.targetZ = this.player.position.z;
      this.walkTo(entity, dt, distance < 1.2 ? 0.28 : 1.45);
      entity.group.rotation.y = Math.atan2(dx, dz);
    }
    p.y = (this.world.surfaceHeight(p.x, p.z) || 8) + 1.05 + Math.sin(entity.phase * 0.9) * 0.18;
    entity.light.intensity = 0.6 + Math.sin(entity.phase * 1.4) * 0.15;
    entity.attackTimer = Math.max(0, entity.attackTimer - dt);
    if (active && distance < 1.35 && entity.attackTimer === 0) {
      entity.attackTimer = 2.1;
      this.player.velocity.x += (dx / Math.max(0.1, distance)) * 3.5;
      this.player.velocity.z += (dz / Math.max(0.1, distance)) * 3.5;
      this.onHurt(16);
    }
  }

  walkTo(entity, dt, speed) {
    const p = entity.group.position;
    const dx = entity.targetX - p.x;
    const dz = entity.targetZ - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.22) return;
    const step = Math.min(distance, speed * dt);
    const nx = p.x + dx / distance * step;
    const nz = p.z + dz / distance * step;
    const nextY = this.groundAt(nx, nz);
    const currentY = this.groundAt(p.x, p.z);
    if (nextY === null || currentY === null || Math.abs(nextY - currentY) > 1.25) {
      entity.targetX = p.x;
      entity.targetZ = p.z;
      return;
    }
    p.x = nx;
    p.z = nz;
    if (entity.kind !== 'gloam') p.y = nextY;
  }

  pick(raycaster) {
    const objects = [];
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      objects.push(entity.group);
    }
    const hits = raycaster.intersectObjects(objects, true);
    if (!hits.length || hits[0].distance > 4.4) return null;
    let object = hits[0].object;
    while (object && !object.userData.entity) object = object.parent;
    if (!object) {
      object = hits[0].object;
      while (object && !objects.includes(object)) object = object.parent;
    }
    const entity = this.entities.find((candidate) => candidate.alive && candidate.group === object);
    return entity ? { entity, distance: hits[0].distance } : null;
  }

  attack(entity, heldItem) {
    if (!entity || !entity.alive || this.attackCooldown > 0) return false;
    this.attackCooldown = 0.38;
    const weapon = heldItem?.tool;
    const damage = weapon === 'sword' ? (heldItem.id === ITEM.IRON_SWORD ? 4.3 : heldItem.id === ITEM.STONE_SWORD ? 3.4 : 2.65) : 0.9;
    entity.health -= damage;
    entity.hitFlash = 0.14;
    const dx = entity.group.position.x - this.player.position.x;
    const dz = entity.group.position.z - this.player.position.z;
    const distance = Math.max(0.1, Math.hypot(dx, dz));
    entity.group.position.x += dx / distance * 0.38;
    entity.group.position.z += dz / distance * 0.38;
    this.onParticles(entity.group.position.clone().add(new THREE.Vector3(0, 1, 0)), entity.kind === 'gloam' ? 0xaaa7ff : 0xe8c292, 9);
    if (weapon) entity.durabilityUsed = (entity.durabilityUsed || 0) + 1;
    if (entity.health <= 0) {
      entity.alive = false;
      this.scene.remove(entity.group);
      const reward = entity.kind === 'gloam' ? [ITEM.COAL, 1] : [ITEM.HIDE, 1];
      this.onDrop(reward[0], reward[1], entity.group.position.clone());
    } else if (entity.kind === 'wanderer') {
      entity.targetX = entity.group.position.x + dx / distance * 7;
      entity.targetZ = entity.group.position.z + dz / distance * 7;
      entity.moveTimer = 2;
    }
    return true;
  }

  consumeDurability() {
    const used = this.entities.reduce((sum, entity) => sum + (entity.durabilityUsed || 0), 0);
    for (const entity of this.entities) entity.durabilityUsed = 0;
    return used;
  }

  dispose() {
    for (const entity of this.entities) this.scene.remove(entity.group);
    this.entities.length = 0;
    this.sharedBox.dispose();
    for (const material of Object.values(this.mats)) material.dispose();
  }
}
