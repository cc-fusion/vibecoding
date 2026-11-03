import * as THREE from 'three';
import { BLOCK, ITEM, ITEMS } from './blocks';
import { GRAVITY, SEA_LEVEL } from './constants';
import { VoxelWorld } from './world';
import { ParticleSystem } from './particles';
import { SoundEngine } from './audio';

export interface DroppedItem {
  id: number;
  count: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  pickupDelay: number;
}

export interface PrimedTNT {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
}

export type MobKind = 'sheep' | 'pig' | 'cow' | 'zombie' | 'slime';

export interface MobEntity {
  uid: number;
  kind: MobKind;
  hostile: boolean;
  group: THREE.Group;
  legs: THREE.Mesh[];
  arms: THREE.Mesh[];
  bodyMaterials: THREE.MeshLambertMaterial[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  onGround: boolean;
  health: number;
  maxHealth: number;
  hurtTimer: number;
  aiTimer: number;
  moveDirX: number;
  moveDirZ: number;
  attackCooldown: number;
  animTime: number;
}

let nextMobUid = 1;

export class EntityManager {
  readonly group = new THREE.Group();
  drops: DroppedItem[] = [];
  tnts: PrimedTNT[] = [];
  mobs: MobEntity[] = [];

  private dropGeom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  private tntGeom = new THREE.BoxGeometry(0.96, 0.96, 0.96);
  private dropMatCache = new Map<number, THREE.MeshLambertMaterial>();
  private spawnTimer = 2.0;

  private getDropMaterial(itemId: number): THREE.MeshLambertMaterial {
    let mat = this.dropMatCache.get(itemId);
    if (!mat) {
      const def = ITEMS[itemId];
      mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(def?.colorHex ?? '#ffffff'),
        emissive:
          def && def.lightEmission > 0 ? new THREE.Color(def.colorHex).multiplyScalar(0.35) : new THREE.Color(0x000000),
      });
      this.dropMatCache.set(itemId, mat);
    }
    return mat;
  }

  spawnDrop(x: number, y: number, z: number, itemId: number, count = 1, pickupDelay = 0.28): void {
    if (itemId === BLOCK.AIR || count <= 0) return;

    // Merge into nearby identical stack if close
    for (const d of this.drops) {
      if (d.id === itemId && d.count + count <= 64 && d.pos.distanceToSquared(new THREE.Vector3(x, y, z)) < 1.8) {
        d.count += count;
        return;
      }
    }
    if (this.drops.length > 90) {
      const oldest = this.drops.shift();
      if (oldest) this.group.remove(oldest.mesh);
    }

    const mesh = new THREE.Mesh(this.dropGeom, this.getDropMaterial(itemId));
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.drops.push({
      id: itemId,
      count,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.6, 3.4 + Math.random() * 1.4, (Math.random() - 0.5) * 2.6),
      age: 0,
      pickupDelay,
    });
  }

  igniteTNT(bx: number, by: number, bz: number, fuse = 2.6): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0x551111 });
    const mesh = new THREE.Mesh(this.tntGeom, mat);
    const pos = new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.tnts.push({
      mesh,
      pos,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 2.4, (Math.random() - 0.5) * 1.2),
      fuse,
    });
  }

  private buildMobRig(kind: MobKind): {
    group: THREE.Group;
    legs: THREE.Mesh[];
    arms: THREE.Mesh[];
    mats: THREE.MeshLambertMaterial[];
  } {
    const g = new THREE.Group();
    const legs: THREE.Mesh[] = [];
    const arms: THREE.Mesh[] = [];
    const mats: THREE.MeshLambertMaterial[] = [];

    const mkPart = (
      w: number,
      h: number,
      d: number,
      hex: number,
      px: number,
      py: number,
      pz: number,
      emissive = 0x000000,
      opacity = 1
    ) => {
      const mat = new THREE.MeshLambertMaterial({
        color: hex,
        emissive,
        transparent: opacity < 1,
        opacity,
      });
      mats.push(mat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz);
      g.add(m);
      return m;
    };

    if (kind === 'sheep' || kind === 'pig' || kind === 'cow') {
      const bodyColor = kind === 'sheep' ? 0xf8fafc : kind === 'pig' ? 0xf9a8d4 : 0x6b442a;
      const headColor = kind === 'sheep' ? 0xcbd5e1 : kind === 'pig' ? 0xf472b6 : 0x543622;
      const legH = kind === 'pig' ? 0.34 : 0.46;
      const bodyH = kind === 'pig' ? 0.48 : 0.56;

      // Body + Head + Eyes
      mkPart(0.68, bodyH, 0.96, bodyColor, 0, legH + bodyH * 0.5, 0);
      mkPart(0.46, 0.44, 0.46, headColor, 0, legH + bodyH * 0.78, 0.58);
      mkPart(0.08, 0.08, 0.05, 0x1e293b, -0.14, legH + bodyH * 0.83, 0.82);
      mkPart(0.08, 0.08, 0.05, 0x1e293b, 0.14, legH + bodyH * 0.83, 0.82);

      if (kind === 'pig') {
        mkPart(0.22, 0.15, 0.1, 0xec4899, 0, legH + bodyH * 0.68, 0.84);
      } else if (kind === 'cow') {
        mkPart(0.4, 0.32, 0.45, 0xf1f5f9, 0.16, legH + bodyH * 0.55, 0.1);
        mkPart(0.08, 0.16, 0.08, 0xe2e8f0, -0.24, legH + bodyH * 1.05, 0.6);
        mkPart(0.08, 0.16, 0.08, 0xe2e8f0, 0.24, legH + bodyH * 1.05, 0.6);
      }

      for (const [lx, lz] of [
        [-0.2, 0.32],
        [0.2, 0.32],
        [-0.2, -0.32],
        [0.2, -0.32],
      ]) {
        legs.push(mkPart(0.18, legH, 0.18, headColor, lx, legH * 0.5, lz));
      }
    } else if (kind === 'zombie') {
      // Iconic hostile voxel humanoid with outstretched arms & glowing eyes
      legs.push(mkPart(0.22, 0.68, 0.22, 0x3b4890, -0.13, 0.34, 0));
      legs.push(mkPart(0.22, 0.68, 0.22, 0x3b4890, 0.13, 0.34, 0));
      mkPart(0.48, 0.68, 0.26, 0x0e9aa7, 0, 1.02, 0);
      mkPart(0.46, 0.46, 0.46, 0x4d8b55, 0, 1.59, 0);
      // Glowing night eyes
      mkPart(0.1, 0.07, 0.05, 0x111827, -0.11, 1.62, 0.24, 0xdc2626);
      mkPart(0.1, 0.07, 0.05, 0x111827, 0.11, 1.62, 0.24, 0xdc2626);
      // Outstretched zombie arms
      arms.push(mkPart(0.2, 0.2, 0.62, 0x4d8b55, -0.35, 1.24, 0.25));
      arms.push(mkPart(0.2, 0.2, 0.62, 0x4d8b55, 0.35, 1.24, 0.25));
    } else {
      // Bouncy translucent Emerald Slime
      mkPart(0.44, 0.44, 0.44, 0x15803d, 0, 0.4, 0);
      mkPart(0.1, 0.1, 0.06, 0x052e16, -0.14, 0.48, 0.36);
      mkPart(0.1, 0.1, 0.06, 0x052e16, 0.14, 0.48, 0.36);
      mkPart(0.78, 0.78, 0.78, 0x4ade80, 0, 0.4, 0, 0x052e16, 0.68);
    }

    return { group: g, legs, arms, mats };
  }

  spawnMob(kind: MobKind, x: number, y: number, z: number): MobEntity {
    const rig = this.buildMobRig(kind);
    rig.group.position.set(x, y, z);
    this.group.add(rig.group);

    const hostile = kind === 'zombie' || kind === 'slime';
    const maxHealth = kind === 'zombie' ? 16 : kind === 'cow' ? 12 : 10;

    const mob: MobEntity = {
      uid: nextMobUid++,
      kind,
      hostile,
      group: rig.group,
      legs: rig.legs,
      arms: rig.arms,
      bodyMaterials: rig.mats,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: Math.random() * Math.PI * 2,
      onGround: false,
      health: maxHealth,
      maxHealth,
      hurtTimer: 0,
      aiTimer: Math.random() * 2,
      moveDirX: 0,
      moveDirZ: 0,
      attackCooldown: 0,
      animTime: Math.random() * 10,
    };
    this.mobs.push(mob);
    return mob;
  }

  raycastMob(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): MobEntity | null {
    let closest: MobEntity | null = null;
    let bestT = maxDist;
    const box = new THREE.Box3();
    const hitPt = new THREE.Vector3();
    const ray = new THREE.Ray(origin, dir.clone().normalize());

    for (const m of this.mobs) {
      const h = m.kind === 'zombie' ? 1.85 : 1.05;
      const hw = 0.42;
      box.min.set(m.pos.x - hw, m.pos.y, m.pos.z - hw);
      box.max.set(m.pos.x + hw, m.pos.y + h, m.pos.z + hw);
      if (ray.intersectBox(box, hitPt)) {
        const dist = origin.distanceTo(hitPt);
        if (dist < bestT) {
          bestT = dist;
          closest = m;
        }
      }
    }
    return closest;
  }

  hitMob(
    mob: MobEntity,
    damage: number,
    attackerPos: THREE.Vector3,
    particles: ParticleSystem,
    audio: SoundEngine
  ): boolean {
    if (mob.hurtTimer > 0.22) return false;
    mob.health -= damage;
    mob.hurtTimer = 0.35;
    audio.playHurt(true);

    const dx = mob.pos.x - attackerPos.x;
    const dz = mob.pos.z - attackerPos.z;
    const len = Math.hypot(dx, dz) || 1;
    mob.vel.x = (dx / len) * 6.8;
    mob.vel.z = (dz / len) * 6.8;
    mob.vel.y = 4.5;
    mob.onGround = false;

    particles.emitBurst(mob.pos.x, mob.pos.y + 0.8, mob.pos.z, ['#ef4444', '#fca5a5'], 12, 3.2, 0.5, 0.11);

    if (mob.health <= 0) {
      this.removeMob(mob, true, particles);
      return true;
    }
    return false;
  }

  private removeMob(mob: MobEntity, dropLoot: boolean, particles: ParticleSystem): void {
    const idx = this.mobs.indexOf(mob);
    if (idx >= 0) this.mobs.splice(idx, 1);
    this.group.remove(mob.group);
    mob.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        ((obj as THREE.Mesh).material as THREE.Material).dispose();
      }
    });

    if (dropLoot) {
      particles.emitBurst(mob.pos.x, mob.pos.y + 0.6, mob.pos.z, ['#f8fafc', '#cbd5e1'], 18, 2.6, 0.25, 0.15);
      if (mob.kind === 'sheep') {
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, BLOCK.WOOL, 1 + Math.floor(Math.random() * 2));
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, ITEM.RAW_MEAT, 1);
      } else if (mob.kind === 'pig' || mob.kind === 'cow') {
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, ITEM.RAW_MEAT, 1 + Math.floor(Math.random() * 2));
      } else if (mob.kind === 'zombie') {
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, ITEM.IRON_INGOT, Math.random() < 0.35 ? 1 : 0);
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, ITEM.COAL, 1);
      } else if (mob.kind === 'slime') {
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, ITEM.EMERALD, Math.random() < 0.45 ? 1 : 0);
        this.spawnDrop(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, BLOCK.GLOW_SHROOM, 1);
      }
    }
  }

  update(
    dt: number,
    world: VoxelWorld,
    playerPos: THREE.Vector3,
    isNight: boolean,
    survivalActive: boolean,
    particles: ParticleSystem,
    audio: SoundEngine,
    onCollectItem: (id: number, count: number) => boolean,
    onPlayerDamage: (dmg: number, knockX: number, knockZ: number) => void
  ): void {
    // 1. Update 3D Dropped Items
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.pickupDelay = Math.max(0, d.pickupDelay - dt);

      if (d.age > 180) {
        this.group.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      d.vel.y -= GRAVITY * 0.72 * dt;
      const nx = d.pos.x + d.vel.x * dt;
      const ny = d.pos.y + d.vel.y * dt;
      const nz = d.pos.z + d.vel.z * dt;

      if (ITEMS[world.getBlock(Math.floor(nx), Math.floor(d.pos.y), Math.floor(d.pos.z))]?.solid) {
        d.vel.x *= -0.3;
      } else {
        d.pos.x = nx;
      }
      if (ITEMS[world.getBlock(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(nz))]?.solid) {
        d.vel.z *= -0.3;
      } else {
        d.pos.z = nz;
      }
      if (ITEMS[world.getBlock(Math.floor(d.pos.x), Math.floor(ny - 0.14), Math.floor(d.pos.z))]?.solid) {
        d.pos.y = Math.floor(ny - 0.14) + 1.15;
        d.vel.y = 0;
        d.vel.x *= 0.82;
        d.vel.z *= 0.82;
      } else {
        d.pos.y = ny;
      }

      if (d.pickupDelay <= 0) {
        const dx = playerPos.x - d.pos.x;
        const dy = playerPos.y + 0.9 - d.pos.y;
        const dz = playerPos.z - d.pos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 2.35) {
          d.pos.x += (dx / dist) * 9.5 * dt;
          d.pos.y += (dy / dist) * 9.5 * dt;
          d.pos.z += (dz / dist) * 9.5 * dt;
          if (dist < 0.85 && onCollectItem(d.id, d.count)) {
            audio.playPickup();
            this.group.remove(d.mesh);
            this.drops.splice(i, 1);
            continue;
          }
        }
      }

      d.mesh.position.set(d.pos.x, d.pos.y + Math.sin(d.age * 3.4) * 0.08, d.pos.z);
      d.mesh.rotation.y = d.age * 2.1;
    }

    // 2. Update Primed TNT Charges & Detonations
    for (let i = this.tnts.length - 1; i >= 0; i--) {
      const t = this.tnts[i];
      t.fuse -= dt;
      t.vel.y -= GRAVITY * 0.85 * dt;
      const ny = t.pos.y + t.vel.y * dt;
      if (ITEMS[world.getBlock(Math.floor(t.pos.x), Math.floor(ny - 0.48), Math.floor(t.pos.z))]?.solid) {
        t.pos.y = Math.floor(ny - 0.48) + 1.48;
        t.vel.y = 0;
        t.vel.x *= 0.8;
        t.vel.z *= 0.8;
      } else {
        t.pos.y = ny;
      }
      t.pos.x += t.vel.x * dt;
      t.pos.z += t.vel.z * dt;

      const flash = Math.sin(t.fuse * 22) > 0;
      const mat = t.mesh.material as THREE.MeshLambertMaterial;
      mat.color.setHex(flash ? 0xffffff : 0xef4444);
      const swell = 1 + Math.max(0, 0.5 - t.fuse) * 0.35;
      t.mesh.scale.set(swell, swell, swell);
      t.mesh.position.copy(t.pos);

      if (t.fuse <= 0) {
        this.detonateAt(t.pos.x, t.pos.y, t.pos.z, world, playerPos, particles, audio, onPlayerDamage);
        this.group.remove(t.mesh);
        mat.dispose();
        this.tnts.splice(i, 1);
      }
    }

    // 3. Natural Creature Spawning & Despawning around Player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.mobs.length < 16) {
      this.spawnTimer = 2.6;
      const angle = Math.random() * Math.PI * 2;
      const dist = 13 + Math.random() * 16;
      const sx = Math.floor(playerPos.x + Math.cos(angle) * dist);
      const sz = Math.floor(playerPos.z + Math.sin(angle) * dist);
      if (world.isChunkLoadedAt(sx, sz)) {
        const col = world.generator.sampleColumn(sx, sz);
        if (col.height > SEA_LEVEL + 1 && col.biome !== 'ocean') {
          let kind: MobKind;
          if (isNight && Math.random() < 0.62) {
            kind = Math.random() < 0.72 ? 'zombie' : 'slime';
          } else {
            const r = Math.random();
            kind = r < 0.4 ? 'sheep' : r < 0.72 ? 'pig' : r < 0.92 ? 'cow' : 'slime';
          }
          this.spawnMob(kind, sx + 0.5, col.height + 1.05, sz + 0.5);
        }
      }
    }

    // 4. Mob AI, Physics, Combat & Limb Animation
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const distToPlayer = m.pos.distanceTo(playerPos);
      if (distToPlayer > 56) {
        this.removeMob(m, false, particles);
        continue;
      }
      if (!world.isChunkLoadedAt(m.pos.x, m.pos.z)) continue;

      // Burn zombies in bright daylight!
      if (m.kind === 'zombie' && !isNight && world.getSkyLight(Math.floor(m.pos.x), Math.floor(m.pos.y + 1), Math.floor(m.pos.z)) >= 13) {
        m.hurtTimer = Math.max(m.hurtTimer, 0.12);
        m.health -= dt * 2.2;
        if (Math.random() < 0.15) {
          particles.emitBurst(m.pos.x, m.pos.y + 1.3, m.pos.z, ['#f97316', '#fde047'], 2, 1.2, -0.2, 0.1);
        }
        if (m.health <= 0) {
          this.removeMob(m, true, particles);
          continue;
        }
      }

      m.hurtTimer = Math.max(0, m.hurtTimer - dt);
      m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      for (const mat of m.bodyMaterials) {
        mat.emissive.setHex(m.hurtTimer > 0 ? 0x991b1b : 0x000000);
      }

      // AI Decision State
      if (m.hostile && survivalActive && distToPlayer < 16) {
        const dx = playerPos.x - m.pos.x;
        const dz = playerPos.z - m.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        m.moveDirX = dx / len;
        m.moveDirZ = dz / len;
        m.yaw = Math.atan2(m.moveDirX, m.moveDirZ);

        if (m.kind === 'slime' && m.onGround && Math.random() < 0.08) {
          m.vel.y = 6.8;
          m.onGround = false;
        }

        if (distToPlayer < 1.35 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.1;
          onPlayerDamage(m.kind === 'zombie' ? 3 : 2, m.moveDirX, m.moveDirZ);
        }
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.2;
          if (Math.random() < 0.45) {
            m.moveDirX = 0;
            m.moveDirZ = 0;
          } else {
            const a = Math.random() * Math.PI * 2;
            m.moveDirX = Math.cos(a);
            m.moveDirZ = Math.sin(a);
            m.yaw = Math.atan2(m.moveDirX, m.moveDirZ);
          }
        }
        if (m.kind === 'slime' && m.onGround && (m.moveDirX !== 0 || m.moveDirZ !== 0) && Math.random() < 0.06) {
          m.vel.y = 6.2;
          m.onGround = false;
        }
      }

      const speed = m.kind === 'zombie' ? 3.05 : m.kind === 'slime' ? 2.4 : 1.55;
      m.vel.x += (m.moveDirX * speed - m.vel.x) * Math.min(1, dt * 6);
      m.vel.z += (m.moveDirZ * speed - m.vel.z) * Math.min(1, dt * 6);
      m.vel.y -= GRAVITY * dt;

      // Swim up if in water
      if (world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.4), Math.floor(m.pos.z)) === BLOCK.WATER) {
        m.vel.y = Math.min(2.8, m.vel.y + 34 * dt);
      }

      const mobBlocked = (px: number, py: number, pz: number) => {
        const hw = 0.34;
        const top = m.kind === 'zombie' ? 1.75 : 0.95;
        for (const cx of [px - hw, px + hw]) {
          for (const cz of [pz - hw, pz + hw]) {
            if (ITEMS[world.getBlock(Math.floor(cx), Math.floor(py + 0.05), Math.floor(cz))]?.solid) return true;
            if (ITEMS[world.getBlock(Math.floor(cx), Math.floor(py + top), Math.floor(cz))]?.solid) return true;
          }
        }
        return false;
      };

      let hitWall = false;
      const nx = m.pos.x + m.vel.x * dt;
      if (!mobBlocked(nx, m.pos.y, m.pos.z)) m.pos.x = nx;
      else hitWall = true;

      const nz = m.pos.z + m.vel.z * dt;
      if (!mobBlocked(m.pos.x, m.pos.y, nz)) m.pos.z = nz;
      else hitWall = true;

      const ny = m.pos.y + m.vel.y * dt;
      if (!mobBlocked(m.pos.x, ny, m.pos.z)) {
        m.pos.y = ny;
        m.onGround = false;
      } else {
        if (m.vel.y < 0) {
          m.pos.y = Math.floor(ny + 0.05) + 1.001;
          m.onGround = true;
        }
        m.vel.y = 0;
      }

      // Automatic 1-block step jump over hills
      if (hitWall && m.onGround) {
        m.vel.y = 7.7;
        m.onGround = false;
      }

      // Animate legs & arms smoothly
      const moving = Math.hypot(m.vel.x, m.vel.z);
      if (moving > 0.25) m.animTime += dt * moving * 4.2;
      const swing = moving > 0.25 ? Math.sin(m.animTime) * 0.55 : 0;
      for (let l = 0; l < m.legs.length; l++) {
        m.legs[l].rotation.x = l % 2 === 0 ? swing : -swing;
      }

      m.group.position.copy(m.pos);
      m.group.rotation.y = m.yaw;
      if (m.kind === 'slime') {
        const squash = m.onGround ? 1.0 : 0.86;
        m.group.scale.set(1 / squash, squash, 1 / squash);
      }
    }
  }

  private detonateAt(
    cx: number,
    cy: number,
    cz: number,
    world: VoxelWorld,
    playerPos: THREE.Vector3,
    particles: ParticleSystem,
    audio: SoundEngine,
    onPlayerDamage: (dmg: number, kx: number, kz: number) => void
  ): void {
    audio.playExplosion();
    particles.emitBurst(cx, cy, cz, ['#f97316', '#fde047', '#ef4444', '#475569', '#f8fafc'], 95, 9.5, 0.45, 0.22);

    const r = 3;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const iz = Math.floor(cz);

    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > r * r + 1.5) continue;
          const bx = ix + dx;
          const by = iy + dy;
          const bz = iz + dz;
          const bid = world.getBlock(bx, by, bz);
          if (bid === BLOCK.AIR || bid === BLOCK.BEDROCK) continue;
          if (bid === BLOCK.TNT && (dx !== 0 || dy !== 0 || dz !== 0)) {
            world.setBlock(bx, by, bz, BLOCK.AIR, false);
            this.igniteTNT(bx, by, bz, 0.45 + Math.random() * 0.4);
            continue;
          }
          const def = ITEMS[bid];
          world.setBlock(bx, by, bz, BLOCK.AIR, false);
          if (def && !def.fluid && Math.random() < 0.38) {
            this.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, def.dropId ?? bid, def.dropCount ?? 1);
          }
        }
      }
    }

    // Batch flush lighting & mesh updates around explosion crater cleanly!
    for (const ch of world.chunks.values()) {
      if (ch.dirtyLight) world.computeChunkLighting(ch);
    }
    for (const ch of world.chunks.values()) {
      if (ch.dirtyMesh) world.rebuildChunkMesh(ch);
    }

    // Blast damage to nearby mobs & player
    for (const m of [...this.mobs]) {
      const d = m.pos.distanceTo(new THREE.Vector3(cx, cy, cz));
      if (d < 6.5) {
        this.hitMob(m, Math.ceil((6.5 - d) * 3.2), new THREE.Vector3(cx, cy, cz), particles, audio);
      }
    }
    const pd = playerPos.distanceTo(new THREE.Vector3(cx, cy, cz));
    if (pd < 6.0) {
      const dx = playerPos.x - cx;
      const dz = playerPos.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      onPlayerDamage(Math.max(1, Math.floor((6.0 - pd) * 2.2)), dx / len, dz / len);
    }
  }

  dispose(): void {
    this.dropGeom.dispose();
    this.tntGeom.dispose();
    for (const m of this.dropMatCache.values()) m.dispose();
    this.group.clear();
  }
}
