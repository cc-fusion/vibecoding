import * as THREE from 'three';
import { World } from './world';
import { isSolid, B } from './blocks';

export type MobKind = 'pig' | 'cow' | 'sheep' | 'zombie' | 'skeleton' | 'spider' | 'creeper' | 'slime' | 'chicken' | 'wolf' | 'villager' | 'enderman' | 'blaze' | 'ghast' | 'squid' | 'bat' | 'phantom' | 'iron_golem' | 'snow_golem' | 'witch' | 'guardian' | 'shulker' | 'ender_dragon' | 'wither' | 'piglin' | 'hoglin' | 'zoglin' | 'strider' | 'bee' | 'cat' | 'horse' | 'donkey' | 'mule' | 'llama' | 'trader_llama' | 'mooshroom' | 'rabbit' | 'fox' | 'panda' | 'polar_bear' | 'parrot' | 'dolphin' | 'turtle' | 'cod' | 'salmon' | 'tropical_fish' | 'pufferfish' | 'axolotl' | 'frog' | 'tadpole' | 'goat' | 'glow_squid' | 'allay' | 'sniffer' | 'camel' | 'armadillo' | 'bogged' | 'breeze' | 'stray' | 'husk' | 'drowned' | 'zombie_villager' | 'zombie_piglin' | 'zoglin2' | 'magma_cube' | 'slime2' | 'silverfish' | 'cave_spider' | 'witch2' | 'evoker' | 'vindicator' | 'pillager' | 'vex' | 'ravager' | 'illusioner' | 'warden' | 'frog2';

export interface Mob {
  id: number;
  kind: MobKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  health: number;
  maxHealth: number;
  onGround: boolean;
  wanderTimer: number;
  targetYaw: number;
  hurtTimer: number;
  dead: boolean;
  hostile: boolean;
  damage: number;
  speed: number;
  drops: { item: string; count: number }[];
  xp: number;
  attackCooldown: number;
  legPhase: number;
}

let nextId = 1;

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

export function createMobMesh(kind: MobKind): THREE.Group {
  const g = new THREE.Group();
  const add = (m: THREE.Mesh) => { g.add(m); return m; };
  switch (kind) {
    case 'pig':
      add(box(0.9, 0.6, 0.6, 0xf0a0b0, 0, 0.55, 0));
      add(box(0.3, 0.3, 0.3, 0xf0a0b0, 0.55, 0.65, 0));
      add(box(0.12, 0.12, 0.05, 0xd87080, 0.72, 0.6, 0));
      [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]].forEach(([x, z]) => add(box(0.15, 0.35, 0.15, 0xe090a0, x, 0.18, z)));
      break;
    case 'cow':
      add(box(1.1, 0.7, 0.7, 0x5a3a2a, 0, 0.65, 0));
      add(box(0.35, 0.35, 0.35, 0x6a4a3a, 0.65, 0.8, 0));
      add(box(0.1, 0.1, 0.05, 0xf0c8c8, 0.85, 0.72, 0));
      [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]].forEach(([x, z]) => add(box(0.16, 0.4, 0.16, 0x4a2e20, x, 0.2, z)));
      add(box(0.3, 0.2, 0.2, 0x8a5a4a, 0.3, 0.4, 0));
      break;
    case 'sheep':
      add(box(0.9, 0.6, 0.7, 0xf0f0f0, 0, 0.6, 0));
      add(box(0.3, 0.3, 0.3, 0x3a3a3a, 0.55, 0.75, 0));
      [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]].forEach(([x, z]) => add(box(0.14, 0.35, 0.14, 0x3a3a3a, x, 0.18, z)));
      break;
    case 'chicken':
      add(box(0.4, 0.4, 0.4, 0xf0f0f0, 0, 0.45, 0));
      add(box(0.2, 0.2, 0.2, 0xf0f0f0, 0.25, 0.65, 0));
      add(box(0.12, 0.08, 0.08, 0xf0a020, 0.38, 0.6, 0));
      add(box(0.08, 0.12, 0.08, 0xe03028, 0.2, 0.8, 0));
      break;
    case 'zombie':
      add(box(0.5, 0.7, 0.3, 0x2a6a4a, 0, 1.15, 0)); // torso
      add(box(0.4, 0.4, 0.4, 0x3a8a5a, 0, 1.7, 0)); // head
      add(box(0.15, 0.6, 0.15, 0x2a4a8a, -0.15, 0.55, 0));
      add(box(0.15, 0.6, 0.15, 0x2a4a8a, 0.15, 0.55, 0));
      add(box(0.15, 0.6, 0.15, 0x3a8a5a, -0.35, 1.15, 0.2));
      add(box(0.15, 0.6, 0.15, 0x3a8a5a, 0.35, 1.15, 0.2));
      break;
    case 'skeleton':
      add(box(0.5, 0.7, 0.3, 0xe8e8e8, 0, 1.15, 0));
      add(box(0.4, 0.4, 0.4, 0xf0f0f0, 0, 1.7, 0));
      add(box(0.15, 0.6, 0.15, 0xe0e0e0, -0.15, 0.55, 0));
      add(box(0.15, 0.6, 0.15, 0xe0e0e0, 0.15, 0.55, 0));
      add(box(0.12, 0.6, 0.12, 0xe8e8e8, -0.35, 1.15, 0));
      add(box(0.12, 0.6, 0.12, 0xe8e8e8, 0.35, 1.15, 0));
      break;
    case 'spider':
      add(box(1.2, 0.5, 0.9, 0x2a2a2a, 0, 0.45, 0));
      add(box(0.5, 0.4, 0.5, 0x3a3a3a, 0.7, 0.5, 0));
      for (let i = 0; i < 4; i++) {
        add(box(0.5, 0.08, 0.08, 0x2a2a2a, -0.4 + (i % 2) * 0.8, 0.3, -0.5 + Math.floor(i / 2) * 1.0));
      }
      break;
    case 'creeper':
      add(box(0.5, 0.7, 0.5, 0x4ad84a, 0, 0.85, 0));
      add(box(0.5, 0.5, 0.5, 0x4ad84a, 0, 1.45, 0));
      [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].forEach(([x, z]) => add(box(0.15, 0.4, 0.15, 0x3ac83a, x, 0.2, z)));
      break;
    case 'slime':
      add(box(0.7, 0.7, 0.7, 0x5ad84a, 0, 0.35, 0));
      break;
    case 'wolf':
      add(box(0.8, 0.5, 0.4, 0x9a9a9a, 0, 0.55, 0));
      add(box(0.3, 0.3, 0.3, 0xa8a8a8, 0.5, 0.75, 0));
      [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]].forEach(([x, z]) => add(box(0.12, 0.3, 0.12, 0x8a8a8a, x, 0.15, z)));
      break;
    case 'villager':
      add(box(0.5, 0.7, 0.3, 0x6a4a2a, 0, 1.15, 0));
      add(box(0.4, 0.4, 0.4, 0xd8a888, 0, 1.7, 0));
      add(box(0.5, 0.15, 0.5, 0x4a3a1a, 0, 1.95, 0));
      break;
    case 'enderman':
      add(box(0.5, 1.2, 0.3, 0x1a1a2a, 0, 1.4, 0));
      add(box(0.4, 0.4, 0.4, 0x1a1a2a, 0, 2.2, 0));
      add(box(0.15, 0.9, 0.15, 0x1a1a2a, -0.35, 1.4, 0));
      add(box(0.15, 0.9, 0.15, 0x1a1a2a, 0.35, 1.4, 0));
      break;
    case 'blaze':
      add(box(0.5, 0.8, 0.5, 0xffaa2a, 0, 1.0, 0));
      add(box(0.4, 0.4, 0.4, 0xffcc4a, 0, 1.6, 0));
      break;
    case 'ghast':
      add(box(1.2, 1.2, 1.2, 0xf0f0f0, 0, 0, 0));
      break;
    case 'squid':
      add(box(0.5, 0.6, 0.5, 0x2a4ac8, 0, 0.5, 0));
      break;
    case 'bat':
      add(box(0.3, 0.2, 0.3, 0x2a2a2a, 0, 0, 0));
      break;
    case 'phantom':
      add(box(0.8, 0.2, 0.4, 0x4a4a6a, 0, 0, 0));
      break;
    case 'iron_golem':
      add(box(0.8, 1.0, 0.5, 0xd8d8d8, 0, 1.2, 0));
      add(box(0.5, 0.5, 0.5, 0xe8e8e8, 0, 1.95, 0));
      break;
    case 'snow_golem':
      add(box(0.6, 0.6, 0.6, 0xf0f8f8, 0, 0.5, 0));
      add(box(0.4, 0.4, 0.4, 0xf8ffff, 0, 1.0, 0));
      break;
    case 'witch':
      add(box(0.5, 0.7, 0.3, 0x4a2a6a, 0, 1.15, 0));
      add(box(0.4, 0.4, 0.4, 0xd8a888, 0, 1.7, 0));
      add(box(0.6, 0.3, 0.6, 0x2a1a4a, 0, 1.95, 0));
      break;
    case 'guardian':
      add(box(0.8, 0.5, 0.8, 0x2a8ac8, 0, 0.5, 0));
      break;
    case 'shulker':
      add(box(0.8, 0.8, 0.8, 0x7a3ac8, 0, 0.4, 0));
      break;
    default:
      add(box(0.6, 0.6, 0.6, 0x888888, 0, 0.5, 0));
  }
  return g;
}

export function mobStats(kind: MobKind): { health: number; hostile: boolean; damage: number; speed: number; drops: { item: string; count: number }[]; xp: number } {
  switch (kind) {
    case 'pig': return { health: 10, hostile: false, damage: 0, speed: 1.2, drops: [{ item: 'porkchop', count: 2 }], xp: 3 };
    case 'cow': return { health: 10, hostile: false, damage: 0, speed: 1.0, drops: [{ item: 'beef', count: 2 }, { item: 'leather', count: 1 }], xp: 3 };
    case 'sheep': return { health: 8, hostile: false, damage: 0, speed: 1.0, drops: [{ item: 'wool', count: 1 }, { item: 'mutton', count: 1 }], xp: 2 };
    case 'chicken': return { health: 4, hostile: false, damage: 0, speed: 1.4, drops: [{ item: 'chicken', count: 1 }, { item: 'feather', count: 1 }, { item: 'egg', count: 1 }], xp: 2 };
    case 'zombie': return { health: 20, hostile: true, damage: 3, speed: 1.8, drops: [{ item: 'rotten_flesh', count: 2 }, { item: 'bone', count: 1 }], xp: 5 };
    case 'skeleton': return { health: 20, hostile: true, damage: 3, speed: 1.8, drops: [{ item: 'bone', count: 2 }, { item: 'arrow', count: 2 }], xp: 5 };
    case 'spider': return { health: 16, hostile: true, damage: 2, speed: 2.4, drops: [{ item: 'string', count: 2 }, { item: 'spider_eye', count: 1 }], xp: 5 };
    case 'creeper': return { health: 20, hostile: true, damage: 0, speed: 1.6, drops: [{ item: 'gunpowder', count: 2 }], xp: 5 };
    case 'slime': return { health: 8, hostile: true, damage: 1, speed: 1.5, drops: [{ item: 'slime', count: 2 }], xp: 3 };
    case 'wolf': return { health: 20, hostile: false, damage: 2, speed: 2.6, drops: [{ item: 'bone', count: 1 }], xp: 3 };
    case 'villager': return { health: 20, hostile: false, damage: 0, speed: 1.0, drops: [{ item: 'emerald', count: 1 }], xp: 8 };
    case 'enderman': return { health: 40, hostile: true, damage: 7, speed: 2.8, drops: [{ item: 'ender_pearl', count: 1 }], xp: 15 };
    case 'blaze': return { health: 20, hostile: true, damage: 6, speed: 2.0, drops: [{ item: 'blaze_powder', count: 2 }], xp: 10 };
    case 'ghast': return { health: 10, hostile: true, damage: 6, speed: 1.2, drops: [{ item: 'ghast_tear', count: 1 }, { item: 'gunpowder', count: 2 }], xp: 5 };
    case 'squid': return { health: 10, hostile: false, damage: 0, speed: 1.0, drops: [{ item: 'ink_sac', count: 2 } as unknown as { item: string; count: number }], xp: 2 };
    case 'bat': return { health: 6, hostile: false, damage: 0, speed: 2.0, drops: [], xp: 1 };
    case 'phantom': return { health: 20, hostile: true, damage: 4, speed: 2.2, drops: [{ item: 'phantom_membrane', count: 1 }], xp: 8 };
    case 'iron_golem': return { health: 100, hostile: false, damage: 7, speed: 1.6, drops: [{ item: 'iron_ingot', count: 3 }], xp: 10 };
    case 'snow_golem': return { health: 20, hostile: false, damage: 0, speed: 1.4, drops: [{ item: 'snow', count: 1 } as unknown as { item: string; count: number }], xp: 3 };
    case 'witch': return { health: 26, hostile: true, damage: 4, speed: 1.4, drops: [{ item: 'redstone', count: 2 }, { item: 'glowstone', count: 1 } as unknown as { item: string; count: number }], xp: 10 };
    case 'guardian': return { health: 30, hostile: true, damage: 4, speed: 1.8, drops: [{ item: 'prismarine', count: 1 } as unknown as { item: string; count: number }], xp: 8 };
    case 'shulker': return { health: 30, hostile: true, damage: 4, speed: 0.8, drops: [{ item: 'shulker_shell', count: 1 } as unknown as { item: string; count: number }], xp: 10 };
    default: return { health: 10, hostile: false, damage: 0, speed: 1.2, drops: [], xp: 2 };
  }
}

export function spawnMob(_world: World, kind: MobKind, x: number, y: number, z: number): Mob {
  const stats = mobStats(kind);
  const group = createMobMesh(kind);
  group.position.set(x, y, z);
  const mob: Mob = {
    id: nextId++, kind, group, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2, health: stats.health, maxHealth: stats.health,
    onGround: false, wanderTimer: 0, targetYaw: 0, hurtTimer: 0, dead: false,
    hostile: stats.hostile, damage: stats.damage, speed: stats.speed,
    drops: stats.drops, xp: stats.xp, attackCooldown: 0, legPhase: 0,
  };
  return mob;
}

export function updateMob(mob: Mob, world: World, playerPos: THREE.Vector3, dt: number, isNight: boolean, onAttackPlayer: (dmg: number) => void) {
  if (mob.dead) return;
  mob.hurtTimer = Math.max(0, mob.hurtTimer - dt);
  mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
  mob.wanderTimer -= dt;

  const dx = playerPos.x - mob.pos.x, dz = playerPos.z - mob.pos.z;
  const dist = Math.hypot(dx, dz);
  let moveX = 0, moveZ = 0;
  let speed = mob.speed;

  const shouldChase = mob.hostile && dist < 16 && (isNight || mob.kind === 'spider' || mob.kind === 'creeper' || mob.kind === 'slime' || mob.kind === 'enderman' || dist < 4);
  const burnsInDay = mob.kind === 'zombie' || mob.kind === 'skeleton';
  if (burnsInDay && !isNight && mob.pos.y > 0) {
    // check sunlight: block above empty and daytime
    const above = world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y) + 2, Math.floor(mob.pos.z));
    if (above === 0 || above === B.Water) {
      mob.health -= dt * 2;
      if (mob.health <= 0) mob.dead = true;
    }
  }

  if (shouldChase && dist > 1.2) {
    mob.targetYaw = Math.atan2(dx, dz);
    moveX = Math.sin(mob.targetYaw) * speed;
    moveZ = Math.cos(mob.targetYaw) * speed;
    if (dist < 2.2 && mob.attackCooldown <= 0) {
      if (mob.kind === 'creeper') {
        // handled by engine explosion proximity
      } else {
        onAttackPlayer(mob.damage);
        mob.attackCooldown = 1.0;
      }
    }
  } else {
    if (mob.wanderTimer <= 0) {
      mob.targetYaw = Math.random() * Math.PI * 2;
      mob.wanderTimer = 2 + Math.random() * 4;
      if (Math.random() < 0.3) mob.targetYaw = mob.yaw; // idle
    }
    // idle sometimes
    if (Math.random() < 0.002) mob.targetYaw += Math.PI;
    moveX = Math.sin(mob.targetYaw) * speed * 0.4;
    moveZ = Math.cos(mob.targetYaw) * speed * 0.4;
  }

  mob.yaw += (shortestAngle(mob.yaw, mob.targetYaw)) * Math.min(1, dt * 5);

  // gravity
  mob.vel.y -= 22 * dt;
  mob.vel.x = moveX;
  mob.vel.z = moveZ;

  // simple collision: move y then xz, check solid
  const half = 0.35, height = mob.kind === 'spider' ? 0.6 : mob.kind === 'slime' ? 0.7 : 1.4;
  const tryMove = (axis: 'x' | 'y' | 'z', amount: number) => {
    mob.pos[axis] += amount;
    const minX = Math.floor(mob.pos.x - half), maxX = Math.floor(mob.pos.x + half);
    const minY = Math.floor(mob.pos.y), maxY = Math.floor(mob.pos.y + height);
    const minZ = Math.floor(mob.pos.z - half), maxZ = Math.floor(mob.pos.z + half);
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const b = world.getBlock(x, y, z);
      if (b !== 0 && isSolid(b)) {
        if (axis === 'y') {
          if (amount < 0) { mob.pos.y = y + 1; mob.vel.y = 0; mob.onGround = true; }
          else { mob.pos.y = y - height - 0.01; mob.vel.y = 0; }
        } else if (axis === 'x') {
          mob.pos.x = amount > 0 ? x - half - 0.01 : x + 1 + half + 0.01;
          mob.vel.x = 0;
        } else {
          mob.pos.z = amount > 0 ? z - half - 0.01 : z + 1 + half + 0.01;
          mob.vel.z = 0;
        }
        return true;
      }
    }
    return false;
  };
  mob.onGround = false;
  tryMove('y', mob.vel.y * dt);
  tryMove('x', mob.vel.x * dt);
  tryMove('z', mob.vel.z * dt);

  // jump if blocked and on ground (simple step)
  if (mob.onGround && Math.random() < 0.01 && (Math.abs(mob.vel.x) > 0.1 || Math.abs(mob.vel.z) > 0.1)) {
    mob.vel.y = 7;
  }
  // water buoyancy
  const feetBlock = world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 0.3), Math.floor(mob.pos.z));
  if (feetBlock === B.Water) {
    mob.vel.y = Math.min(mob.vel.y + 30 * dt, 2);
    mob.pos.y += mob.vel.y * dt * 0.5;
  }
  if (mob.pos.y < 1) { mob.pos.y = 1; mob.vel.y = 0; }

  mob.group.position.copy(mob.pos);
  mob.group.rotation.y = mob.yaw;
  mob.legPhase += dt * (Math.abs(mob.vel.x) + Math.abs(mob.vel.z)) * 4;
  // hurt flash
  const flash = mob.hurtTimer > 0 ? 0.5 + Math.sin(mob.hurtTimer * 40) * 0.5 : 0;
  mob.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (mat && 'emissive' in mat) {
        (mat.emissive as THREE.Color).setRGB(flash * 0.6, flash * 0.1, flash * 0.1);
      }
    }
  });
  // despawn far
  if (dist > 80) mob.dead = true;
}

function shortestAngle(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
