import * as THREE from 'three';
import { GRAVITY, SEA_LEVEL, WORLD_HEIGHT } from './constants';
import { aabbIntersectsSolid } from './physics';
import { WorldBlockGetter } from './raycast';
import { BiomeId, BlockId, ItemId, MobKind, MobState } from './types';

interface ArticulatedMobVisual {
  root: THREE.Group;
  head: THREE.Group;
  legs: THREE.Mesh[];
  materials: THREE.MeshLambertMaterial[];
  baseColors: number[];
}

export interface MobSystemEvents {
  onPlayerDamaged: (amount: number, knockX: number, knockZ: number, reason: string) => void;
  onCreeperDetonate: (x: number, y: number, z: number) => void;
  onCreeperHiss: () => void;
  onDropLoot: (x: number, y: number, z: number, itemId: ItemId, count: number) => void;
}

const MOB_SPECS: Record<
  MobKind,
  {
    hostile: boolean;
    maxHealth: number;
    speed: number;
    width: number;
    height: number;
  }
> = {
  sheep: { hostile: false, maxHealth: 8, speed: 1.8, width: 0.8, height: 1.25 },
  pig: { hostile: false, maxHealth: 10, speed: 1.9, width: 0.8, height: 0.95 },
  cow: { hostile: false, maxHealth: 10, speed: 1.75, width: 0.85, height: 1.35 },
  chicken: { hostile: false, maxHealth: 4, speed: 2.1, width: 0.5, height: 0.75 },
  zombie: { hostile: true, maxHealth: 16, speed: 2.65, width: 0.65, height: 1.85 },
  creeper: { hostile: true, maxHealth: 14, speed: 2.35, width: 0.65, height: 1.65 },
};

export class MobManager {
  readonly states: MobState[] = [];
  private visuals = new Map<string, ArticulatedMobVisual>();
  private scene: THREE.Scene | null;
  private spawnTimer = 2.0;
  private nextId = 1;

  constructor(scene: THREE.Scene | null) {
    this.scene = scene;
  }

  private createVisual(kind: MobKind): ArticulatedMobVisual {
    const root = new THREE.Group();
    const head = new THREE.Group();
    const legs: THREE.Mesh[] = [];
    const materials: THREE.MeshLambertMaterial[] = [];
    const baseColors: number[] = [];

    const part = (
      w: number,
      h: number,
      d: number,
      color: number,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = root
    ) => {
      const mat = new THREE.MeshLambertMaterial({ color });
      materials.push(mat);
      baseColors.push(color);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    if (kind === 'sheep' || kind === 'pig' || kind === 'cow') {
      const bodyColor =
        kind === 'sheep' ? 0xf3f4f6 : kind === 'pig' ? 0xf4a3b5 : 0x5c3c24;
      const headColor =
        kind === 'sheep' ? 0xd6c3a5 : kind === 'pig' ? 0xf4a3b5 : 0x6e492d;
      const legColor =
        kind === 'sheep' ? 0xc8b294 : kind === 'pig' ? 0xe58ca0 : 0x4a2f1b;
      const legH = kind === 'pig' ? 0.34 : 0.48;
      const bodyH = kind === 'pig' ? 0.48 : 0.56;

      part(0.72, bodyH, 1.02, bodyColor, 0, legH + bodyH * 0.5, 0);
      if (kind === 'cow') {
        part(0.74, 0.32, 0.4, 0xf3f4f6, 0, legH + bodyH * 0.55, -0.1);
      }

      head.position.set(0, legH + bodyH * 0.78, -0.58);
      part(0.46, 0.44, 0.46, headColor, 0, 0, 0, head);
      // Eyes
      part(0.08, 0.08, 0.05, 0x18181b, -0.14, 0.06, -0.24, head);
      part(0.08, 0.08, 0.05, 0x18181b, 0.14, 0.06, -0.24, head);
      if (kind === 'pig') {
        part(0.22, 0.16, 0.12, 0xe07a92, 0, -0.06, -0.26, head);
      } else if (kind === 'cow') {
        part(0.07, 0.16, 0.07, 0xe5e7eb, -0.24, 0.24, -0.08, head);
        part(0.07, 0.16, 0.07, 0xe5e7eb, 0.24, 0.24, -0.08, head);
      } else if (kind === 'sheep') {
        part(0.5, 0.2, 0.5, 0xffffff, 0, 0.18, 0.02, head);
      }
      root.add(head);

      const offsets = [
        [-0.22, -0.34],
        [0.22, -0.34],
        [-0.22, 0.34],
        [0.22, 0.34],
      ];
      for (const [lx, lz] of offsets) {
        legs.push(part(0.2, legH, 0.2, legColor, lx, legH * 0.5, lz));
      }
    } else if (kind === 'chicken') {
      part(0.4, 0.36, 0.48, 0xfafafa, 0, 0.42, 0);
      head.position.set(0, 0.68, -0.22);
      part(0.26, 0.3, 0.26, 0xfafafa, 0, 0, 0, head);
      part(0.14, 0.08, 0.14, 0xf59e0b, 0, -0.02, -0.18, head);
      part(0.08, 0.1, 0.08, 0xdc2626, 0, -0.12, -0.14, head);
      root.add(head);
      legs.push(part(0.07, 0.26, 0.07, 0xf59e0b, -0.1, 0.13, 0));
      legs.push(part(0.07, 0.26, 0.07, 0xf59e0b, 0.1, 0.13, 0));
    } else if (kind === 'zombie') {
      part(0.5, 0.72, 0.28, 0x2563eb, 0, 1.06, 0);
      head.position.set(0, 1.64, 0);
      part(0.46, 0.46, 0.46, 0x4d8b55, 0, 0, 0, head);
      part(0.1, 0.07, 0.05, 0x111827, -0.11, 0.02, -0.24, head);
      part(0.1, 0.07, 0.05, 0x111827, 0.11, 0.02, -0.24, head);
      root.add(head);
      // Outstretched zombie arms!
      part(0.2, 0.2, 0.62, 0x4d8b55, -0.35, 1.3, -0.25);
      part(0.2, 0.2, 0.62, 0x4d8b55, 0.35, 1.3, -0.25);
      legs.push(part(0.22, 0.7, 0.24, 0x3730a3, -0.13, 0.35, 0));
      legs.push(part(0.22, 0.7, 0.24, 0x3730a3, 0.13, 0.35, 0));
    } else {
      // Creeper!
      part(0.46, 0.78, 0.28, 0x3ca342, 0, 0.74, 0);
      head.position.set(0, 1.36, 0);
      part(0.46, 0.46, 0.46, 0x46b84d, 0, 0, 0, head);
      // Iconic creeper face
      part(0.1, 0.1, 0.05, 0x111827, -0.11, 0.07, -0.24, head);
      part(0.1, 0.1, 0.05, 0x111827, 0.11, 0.07, -0.24, head);
      part(0.16, 0.14, 0.05, 0x111827, 0, -0.07, -0.24, head);
      root.add(head);
      const offsets = [
        [-0.16, -0.2],
        [0.16, -0.2],
        [-0.16, 0.2],
        [0.16, 0.2],
      ];
      for (const [lx, lz] of offsets) {
        legs.push(part(0.2, 0.36, 0.2, 0x2f8535, lx, 0.18, lz));
      }
    }

    return { root, head, legs, materials, baseColors };
  }

  spawnMob(kind: MobKind, x: number, y: number, z: number): MobState {
    const spec = MOB_SPECS[kind];
    const state: MobState = {
      id: `mob_${this.nextId++}`,
      kind,
      hostile: spec.hostile,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      hurtTimer: 0,
      onGround: false,
      walkPhase: 0,
      aiTimer: 1 + Math.random() * 2,
      targetYaw: Math.random() * Math.PI * 2,
      wandering: true,
      fuseTimer: 0,
    };
    this.states.push(state);
    if (this.scene) {
      const vis = this.createVisual(kind);
      vis.root.position.set(x, y, z);
      this.scene.add(vis.root);
      this.visuals.set(state.id, vis);
    }
    return state;
  }

  attackRay(
    originX: number,
    originY: number,
    originZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDist: number,
    damage: number,
    events: MobSystemEvents
  ): MobState | null {
    let bestMob: MobState | null = null;
    let bestDist = maxDist;

    for (const mob of this.states) {
      const spec = MOB_SPECS[mob.kind];
      const cx = mob.x;
      const cy = mob.y + spec.height * 0.5;
      const cz = mob.z;

      const toX = cx - originX;
      const toY = cy - originY;
      const toZ = cz - originZ;
      const proj = toX * dirX + toY * dirY + toZ * dirZ;
      if (proj < 0 || proj > bestDist) continue;

      const closestX = originX + dirX * proj;
      const closestY = originY + dirY * proj;
      const closestZ = originZ + dirZ * proj;

      const hitRadius = Math.max(0.55, spec.width * 0.72);
      const distSq =
        (closestX - cx) ** 2 +
        ((closestY - cy) * 0.75) ** 2 +
        (closestZ - cz) ** 2;

      if (distSq <= hitRadius * hitRadius) {
        bestDist = proj;
        bestMob = mob;
      }
    }

    if (bestMob) {
      bestMob.health -= damage;
      bestMob.hurtTimer = 0.28;
      bestMob.vx += dirX * 6.5;
      bestMob.vy = 4.6;
      bestMob.vz += dirZ * 6.5;
      if (!bestMob.hostile) {
        bestMob.wandering = true;
        bestMob.targetYaw = Math.atan2(-dirX, -dirZ);
        bestMob.aiTimer = 3.0;
      }
      if (bestMob.health <= 0) {
        const dropItem: ItemId =
          bestMob.kind === 'creeper'
            ? 'coal'
            : bestMob.kind === 'zombie'
            ? 'flint'
            : 'raw_meat';
        events.onDropLoot(
          bestMob.x,
          bestMob.y + 0.5,
          bestMob.z,
          dropItem,
          bestMob.kind === 'cow' ? 2 : 1
        );
        this.removeMob(bestMob.id);
      }
      return bestMob;
    }

    return null;
  }

  removeMob(id: string): void {
    const idx = this.states.findIndex((m) => m.id === id);
    if (idx >= 0) this.states.splice(idx, 1);
    const vis = this.visuals.get(id);
    if (vis && this.scene) {
      this.scene.remove(vis.root);
      vis.root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      this.visuals.delete(id);
    }
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    isNight: boolean,
    peacefulMobs: boolean,
    dayLightFactor: number,
    getBlock: WorldBlockGetter,
    getBiomeAt: (wx: number, wz: number) => BiomeId,
    events: MobSystemEvents
  ): void {
    // Remove hostiles immediately if Peaceful Mobs toggled on, or mobs far away
    for (let i = this.states.length - 1; i >= 0; i--) {
      const m = this.states[i];
      const dist = Math.hypot(m.x - playerX, m.z - playerZ);
      if ((peacefulMobs && m.hostile) || dist > 56 || m.y < -10) {
        this.removeMob(m.id);
      }
    }

    // Periodic natural spawning around player ring (16..38 blocks out)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.states.length < 16) {
      this.spawnTimer = 2.8;
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 20;
      const sx = Math.floor(playerX + Math.cos(angle) * dist);
      const sz = Math.floor(playerZ + Math.sin(angle) * dist);

      // Find surface column
      let sy = -1;
      for (let y = WORLD_HEIGHT - 4; y > SEA_LEVEL; y--) {
        const b = getBlock(sx, y, sz);
        if (
          b === BlockId.Grass ||
          b === BlockId.SnowGrass ||
          b === BlockId.Sand ||
          b === BlockId.Stone
        ) {
          if (
            getBlock(sx, y + 1, sz) === BlockId.Air &&
            getBlock(sx, y + 2, sz) === BlockId.Air
          ) {
            sy = y + 1;
          }
          break;
        }
      }

      if (sy > 0) {
        const biome = getBiomeAt(sx, sz);
        if (isNight && !peacefulMobs && Math.random() < 0.55) {
          const kind: MobKind = Math.random() < 0.35 ? 'creeper' : 'zombie';
          this.spawnMob(kind, sx + 0.5, sy + 0.05, sz + 0.5);
        } else if (biome !== 'desert') {
          const pool: MobKind[] = ['sheep', 'pig', 'cow', 'chicken'];
          const kind = pool[Math.floor(Math.random() * pool.length)];
          this.spawnMob(kind, sx + 0.5, sy + 0.05, sz + 0.5);
        }
      }
    }

    // Step AI + Physics + Articulated Animations
    for (let i = this.states.length - 1; i >= 0; i--) {
      const m = this.states[i];
      const spec = MOB_SPECS[m.kind];
      const hw = spec.width * 0.5;

      m.hurtTimer = Math.max(0, m.hurtTimer - dt);

      const dxP = playerX - m.x;
      const dyP = playerY - m.y;
      const dzP = playerZ - m.z;
      const distP = Math.hypot(dxP, dyP, dzP);

      let moveSpeed = 0;

      if (m.hostile && distP < 20) {
        m.targetYaw = Math.atan2(-dxP, -dzP);
        if (m.kind === 'creeper') {
          if (distP < 3.1) {
            if (m.fuseTimer === 0) events.onCreeperHiss();
            m.fuseTimer += dt;
            if (m.fuseTimer >= 1.55) {
              const ex = m.x;
              const ey = m.y + 0.6;
              const ez = m.z;
              this.removeMob(m.id);
              events.onCreeperDetonate(ex, ey, ez);
              continue;
            }
          } else {
            m.fuseTimer = Math.max(0, m.fuseTimer - dt * 1.4);
            moveSpeed = spec.speed;
          }
        } else {
          // Zombie melee attack
          moveSpeed = spec.speed;
          if (distP < 1.35 && m.aiTimer <= 0) {
            m.aiTimer = 1.05;
            const inv = 1 / Math.max(0.01, distP);
            events.onPlayerDamaged(3, dxP * inv * 5.5, dzP * inv * 5.5, 'Zombie');
          }
          m.aiTimer = Math.max(0, m.aiTimer - dt);
        }
      } else {
        m.fuseTimer = Math.max(0, m.fuseTimer - dt);
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.wandering = Math.random() < 0.6;
          m.targetYaw = Math.random() * Math.PI * 2;
          m.aiTimer = 1.8 + Math.random() * 3.5;
        }
        if (m.wandering) {
          moveSpeed = spec.speed * (m.hurtTimer > 0 ? 1.8 : 0.65);
        }
      }

      // Smooth yaw turn
      let diff = m.targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, 7 * dt);

      const dirX = -Math.sin(m.yaw);
      const dirZ = -Math.cos(m.yaw);
      m.vx += (dirX * moveSpeed - m.vx) * Math.min(1, 9 * dt);
      m.vz += (dirZ * moveSpeed - m.vz) * Math.min(1, 9 * dt);

      const inWater = getBlock(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z)) === BlockId.Water;
      if (inWater) {
        m.vy = Math.min(2.6, m.vy + 14 * dt);
      } else {
        m.vy = Math.max(-36, m.vy - GRAVITY * dt);
      }

      // Y collision
      const dy = m.vy * dt;
      if (
        !aabbIntersectsSolid(
          m.x - hw,
          m.y + dy,
          m.z - hw,
          m.x + hw,
          m.y + dy + spec.height,
          m.z + hw,
          getBlock
        )
      ) {
        m.y += dy;
        m.onGround = false;
      } else {
        if (dy < 0) {
          m.y = Math.floor(m.y + dy) + 1.001;
          m.onGround = true;
        }
        m.vy = 0;
      }

      // X & Z movement with automatic hop over 1-block hills!
      const nx = m.x + m.vx * dt;
      const nz = m.z + m.vz * dt;
      let blockedHoriz = false;
      if (
        !aabbIntersectsSolid(
          nx - hw,
          m.y,
          m.z - hw,
          nx + hw,
          m.y + spec.height,
          m.z + hw,
          getBlock
        )
      ) {
        m.x = nx;
      } else {
        blockedHoriz = true;
      }

      if (
        !aabbIntersectsSolid(
          m.x - hw,
          m.y,
          nz - hw,
          m.x + hw,
          m.y + spec.height,
          nz + hw,
          getBlock
        )
      ) {
        m.z = nz;
      } else {
        blockedHoriz = true;
      }

      if (blockedHoriz && m.onGround && moveSpeed > 0.2) {
        m.vy = 7.8;
        m.onGround = false;
      }

      const speedHoriz = Math.hypot(m.vx, m.vz);
      if (speedHoriz > 0.15) {
        m.walkPhase += speedHoriz * dt * 4.2;
      }

      // Update visual rig
      const vis = this.visuals.get(m.id);
      if (vis) {
        vis.root.position.set(m.x, m.y, m.z);
        vis.root.rotation.y = m.yaw;

        // Creeper pre-detonation swell & flash
        if (m.fuseTimer > 0) {
          const s = 1 + m.fuseTimer * 0.22;
          vis.root.scale.set(s, s * 0.96, s);
        } else {
          vis.root.scale.set(1, 1, 1);
        }

        const swing = speedHoriz > 0.15 ? Math.sin(m.walkPhase) * 0.65 : 0;
        vis.legs.forEach((leg, idx) => {
          leg.rotation.x = idx % 2 === 0 ? swing : -swing;
        });

        const flashWhite = m.fuseTimer > 0 && Math.floor(m.fuseTimer * 12) % 2 === 0;
        const shade = Math.max(0.18, dayLightFactor);
        vis.materials.forEach((mat, idx) => {
          if (m.hurtTimer > 0) {
            mat.color.setHex(0xff4444);
          } else if (flashWhite) {
            mat.color.setHex(0xffffff);
          } else {
            mat.color.setHex(vis.baseColors[idx]).multiplyScalar(shade);
          }
        });
      }
    }
  }

  dispose(): void {
    for (const id of [...this.visuals.keys()]) {
      this.removeMob(id);
    }
  }
}
