// Creatures: box models, wander/chase AI, spawning and drops.
import * as THREE from "three";
import { moveBody, rayAABB, type Body } from "./physics";
import type { World } from "./world";
import { B, I, BLOCKS } from "./blocks";
import { SEA } from "./worldgen";

export type MobKind = "pig" | "sheep" | "cow" | "zombie" | "chicken";

interface MobDef {
  w: number;
  h: number;
  speed: number;
  health: number;
  hostile: boolean;
  drops: [number, number, number][];
  attack?: number;
  sound: string;
}

export const MOB_DEFS: Record<MobKind, MobDef> = {
  pig: { w: 0.45, h: 0.9, speed: 1.6, health: 10, hostile: false, drops: [[I.PORKCHOP, 1, 3]], sound: "pig" },
  sheep: { w: 0.45, h: 1.1, speed: 1.5, health: 8, hostile: false, drops: [[B.WOOL, 1, 2], [I.MUTTON, 1, 2]], sound: "sheep" },
  cow: { w: 0.45, h: 1.3, speed: 1.4, health: 10, hostile: false, drops: [[I.BEEF, 1, 3]], sound: "cow" },
  chicken: { w: 0.2, h: 0.6, speed: 1.8, health: 4, hostile: false, drops: [[I.PORKCHOP, 0, 1]], sound: "chicken" },
  zombie: { w: 0.3, h: 1.9, speed: 2.6, health: 20, hostile: true, drops: [[B.MUSHROOM, 0, 1], [I.APPLE, 0, 1]], attack: 3, sound: "zombie" },
};

type RGB = [number, number, number];

function box(w: number, h: number, d: number, color: RGB, mat: THREE.Material, accents?: { face: number; color: RGB }[]): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const count = g.attributes.position.count;
  const col = new Float32Array(count * 3);
  // faces order: +x, -x, +y, -y, +z, -z (4 verts each)
  const shades = [0.8, 0.8, 1.0, 0.5, 0.9, 0.7];
  for (let f = 0; f < 6; f++) {
    let c = color;
    const acc = accents?.find((a) => a.face === f);
    if (acc) c = acc.color;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      col[i * 3] = (c[0] / 255) * shades[f];
      col[i * 3 + 1] = (c[1] / 255) * shades[f];
      col[i * 3 + 2] = (c[2] / 255) * shades[f];
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, mat);
}

interface Model {
  group: THREE.Group;
  legs: THREE.Mesh[];
  head: THREE.Mesh;
  arms: THREE.Mesh[];
}

function buildModel(kind: MobKind, mat: THREE.Material): Model {
  const group = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const arms: THREE.Mesh[] = [];
  let head: THREE.Mesh;
  const eye: RGB = [20, 20, 30];
  const addEyes = (h: THREE.Mesh, w: number, y: number, z: number, spacing: number) => {
    for (const s of [-1, 1]) {
      const e = box(0.08, 0.08, 0.02, eye, mat);
      e.position.set(s * spacing, y, z + 0.005);
      h.add(e);
    }
    void w;
  };
  if (kind === "pig") {
    const body = box(0.6, 0.5, 0.9, [240, 160, 160], mat);
    body.position.y = 0.55;
    group.add(body);
    head = box(0.45, 0.45, 0.45, [245, 170, 170], mat);
    head.position.set(0, 0.65, 0.6);
    const snout = box(0.2, 0.15, 0.08, [230, 130, 140], mat);
    snout.position.set(0, -0.08, 0.26);
    head.add(snout);
    addEyes(head, 0.45, 0.08, 0.225, 0.13);
    group.add(head);
    for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) {
      const leg = box(0.2, 0.35, 0.2, [235, 150, 150], mat);
      leg.geometry.translate(0, -0.175, 0);
      leg.position.set(x, 0.35, z);
      group.add(leg);
      legs.push(leg);
    }
  } else if (kind === "sheep") {
    const body = box(0.7, 0.65, 1.0, [235, 235, 235], mat);
    body.position.y = 0.7;
    group.add(body);
    head = box(0.4, 0.4, 0.4, [220, 200, 190], mat, [{ face: 2, color: [235, 235, 235] }]);
    head.position.set(0, 0.95, 0.65);
    addEyes(head, 0.4, 0.05, 0.2, 0.11);
    group.add(head);
    for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) {
      const leg = box(0.2, 0.45, 0.2, [200, 190, 180], mat);
      leg.geometry.translate(0, -0.225, 0);
      leg.position.set(x, 0.45, z);
      group.add(leg);
      legs.push(leg);
    }
  } else if (kind === "cow") {
    const body = box(0.75, 0.7, 1.1, [90, 60, 40], mat, [{ face: 2, color: [110, 75, 50] }]);
    body.position.y = 0.85;
    group.add(body);
    const patch = box(0.3, 0.3, 0.3, [240, 240, 240], mat);
    patch.position.set(0.25, 0.9, -0.2);
    group.add(patch);
    head = box(0.45, 0.45, 0.4, [80, 55, 35], mat, [{ face: 4, color: [230, 230, 230] }]);
    head.position.set(0, 1.1, 0.7);
    addEyes(head, 0.45, 0.08, 0.2, 0.13);
    for (const s of [-1, 1]) {
      const horn = box(0.08, 0.15, 0.08, [220, 210, 190], mat);
      horn.position.set(s * 0.22, 0.28, 0);
      head.add(horn);
    }
    group.add(head);
    for (const [x, z] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) {
      const leg = box(0.22, 0.55, 0.22, [80, 55, 35], mat);
      leg.geometry.translate(0, -0.275, 0);
      leg.position.set(x, 0.55, z);
      group.add(leg);
      legs.push(leg);
    }
  } else if (kind === "chicken") {
    const body = box(0.35, 0.35, 0.45, [240, 240, 240], mat);
    body.position.y = 0.4;
    group.add(body);
    head = box(0.22, 0.3, 0.2, [240, 240, 240], mat);
    head.position.set(0, 0.68, 0.22);
    const beak = box(0.12, 0.08, 0.1, [240, 180, 40], mat);
    beak.position.set(0, -0.02, 0.14);
    head.add(beak);
    const wattle = box(0.08, 0.1, 0.06, [220, 50, 50], mat);
    wattle.position.set(0, -0.12, 0.1);
    head.add(wattle);
    addEyes(head, 0.22, 0.06, 0.1, 0.07);
    group.add(head);
    for (const x of [-0.1, 0.1]) {
      const leg = box(0.06, 0.25, 0.06, [240, 180, 40], mat);
      leg.geometry.translate(0, -0.125, 0);
      leg.position.set(x, 0.25, 0);
      group.add(leg);
      legs.push(leg);
    }
  } else {
    // zombie
    const body = box(0.5, 0.75, 0.25, [40, 120, 140], mat);
    body.position.y = 1.1;
    group.add(body);
    head = box(0.5, 0.5, 0.5, [70, 140, 70], mat);
    head.position.set(0, 1.72, 0);
    addEyes(head, 0.5, 0.08, 0.25, 0.13);
    const mouth = box(0.2, 0.05, 0.02, [30, 60, 30], mat);
    mouth.position.set(0, -0.12, 0.255);
    head.add(mouth);
    group.add(head);
    for (const x of [-0.125, 0.125]) {
      const leg = box(0.24, 0.75, 0.24, [40, 50, 120], mat);
      leg.geometry.translate(0, -0.375, 0);
      leg.position.set(x, 0.75, 0);
      group.add(leg);
      legs.push(leg);
    }
    for (const x of [-0.37, 0.37]) {
      const arm = box(0.22, 0.7, 0.22, [70, 140, 70], mat);
      arm.geometry.translate(0, -0.35, 0);
      arm.position.set(x, 1.42, 0);
      arm.rotation.x = -Math.PI / 2;
      group.add(arm);
      arms.push(arm);
    }
  }
  return { group, legs, head, arms };
}

export class Mob {
  body: Body;
  model: Model;
  material: THREE.MeshBasicMaterial;
  health: number;
  yaw = Math.random() * Math.PI * 2;
  targetYaw = this.yaw;
  state: "idle" | "wander" | "chase" | "flee" = "idle";
  stateTimer = Math.random() * 3;
  walk = 0;
  hurtFlash = 0;
  attackCooldown = 0;
  soundTimer = 3 + Math.random() * 10;
  burning = false;
  age = 0;
  panicTimer = 0;
  def: MobDef;

  constructor(public kind: MobKind, x: number, y: number, z: number) {
    this.def = MOB_DEFS[kind];
    this.body = { x, y, z, vx: 0, vy: 0, vz: 0, w: this.def.w, h: this.def.h, onGround: false, hitWall: false, inWater: false, inLava: false };
    this.health = this.def.health;
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    this.model = buildModel(kind, this.material);
  }
}

export interface MobEvents {
  onDrop: (id: number, count: number, x: number, y: number, z: number) => void;
  onHurtPlayer: (dmg: number, kx: number, kz: number) => void;
  onSound: (kind: string, x: number, y: number, z: number) => void;
  onParticles: (x: number, y: number, z: number, type: "hit" | "fire" | "death") => void;
}

export class MobManager {
  mobs: Mob[] = [];
  group = new THREE.Group();
  spawnTimer = 0;
  peaceful = false;
  constructor(private world: World, private events: MobEvents) {}

  spawn(kind: MobKind, x: number, y: number, z: number): Mob {
    const m = new Mob(kind, x, y, z);
    this.mobs.push(m);
    this.group.add(m.model.group);
    return m;
  }

  /** Raycast against mob AABBs; returns nearest mob + distance. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { mob: Mob; dist: number } | null {
    let best: { mob: Mob; dist: number } | null = null;
    for (const m of this.mobs) {
      const b = m.body;
      const d = rayAABB(ox, oy, oz, dx, dy, dz, b.x - b.w, b.y, b.z - b.w, b.x + b.w, b.y + b.h, b.z + b.w);
      if (d >= 0 && d <= maxDist && (!best || d < best.dist)) best = { mob: m, dist: d };
    }
    return best;
  }

  hit(m: Mob, dmg: number, kx: number, kz: number) {
    m.health -= dmg;
    m.hurtFlash = 0.3;
    m.body.vx += kx * 6;
    m.body.vz += kz * 6;
    m.body.vy = Math.max(m.body.vy, 4.5);
    m.panicTimer = 6;
    this.events.onParticles(m.body.x, m.body.y + m.body.h * 0.6, m.body.z, "hit");
    this.events.onSound(m.def.sound + "_hurt", m.body.x, m.body.y, m.body.z);
    if (m.health <= 0) this.kill(m);
  }

  kill(m: Mob) {
    const i = this.mobs.indexOf(m);
    if (i < 0) return;
    for (const [id, min, max] of m.def.drops) {
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n > 0) this.events.onDrop(id, n, m.body.x, m.body.y + 0.5, m.body.z);
    }
    this.events.onParticles(m.body.x, m.body.y + m.body.h * 0.5, m.body.z, "death");
    this.remove(i);
  }

  private remove(i: number) {
    const m = this.mobs[i];
    this.group.remove(m.model.group);
    m.material.dispose();
    this.mobs.splice(i, 1);
  }

  clear() {
    for (let i = this.mobs.length - 1; i >= 0; i--) this.remove(i);
  }

  update(dt: number, px: number, py: number, pz: number, sun: number, playerDead: boolean, creative: boolean) {
    const world = this.world;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      this.trySpawn(px, py, pz, sun);
    }
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const b = m.body;
      m.age += dt;
      const dx = px - b.x, dz = pz - b.z;
      const distP = Math.sqrt(dx * dx + dz * dz);
      if (distP > 72 || b.y < -5) {
        this.remove(i);
        continue;
      }
      if (!world.isLoaded(Math.floor(b.x), Math.floor(b.z))) continue;
      m.hurtFlash = Math.max(0, m.hurtFlash - dt);
      m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      m.panicTimer = Math.max(0, m.panicTimer - dt);
      m.stateTimer -= dt;
      m.soundTimer -= dt;
      if (m.soundTimer <= 0 && distP < 24) {
        m.soundTimer = 6 + Math.random() * 14;
        this.events.onSound(m.def.sound, b.x, b.y, b.z);
      }

      // Zombie daylight burning
      if (m.def.hostile) {
        const [sky] = world.getLight(Math.floor(b.x), Math.floor(b.y + b.h), Math.floor(b.z));
        m.burning = sky >= 14 && sun > 0.55 && !b.inWater;
        if (m.burning) {
          m.health -= dt * 1.5;
          if (Math.random() < dt * 8) this.events.onParticles(b.x + (Math.random() - 0.5) * 0.5, b.y + Math.random() * b.h, b.z + (Math.random() - 0.5) * 0.5, "fire");
          if (m.health <= 0) {
            this.kill(m);
            continue;
          }
        }
      }
      if (b.inLava) {
        m.health -= dt * 4;
        if (m.health <= 0) {
          this.kill(m);
          continue;
        }
      }

      // AI
      let moveSpeed = 0;
      if (m.def.hostile && !playerDead && !creative && distP < 24 && m.state !== "chase") {
        m.state = "chase";
      }
      if (m.panicTimer > 0 && !m.def.hostile) {
        m.state = "flee";
      } else if (m.state === "flee") {
        m.state = "idle";
        m.stateTimer = 1;
      }
      if (m.state === "chase") {
        if (distP > 32 || playerDead || creative) {
          m.state = "idle";
          m.stateTimer = 2;
        } else {
          m.targetYaw = Math.atan2(dx, dz);
          moveSpeed = m.def.speed;
          if (distP < 1.6 && Math.abs(py - b.y) < 2 && m.attackCooldown <= 0) {
            m.attackCooldown = 1.2;
            this.events.onHurtPlayer(m.def.attack ?? 2, dx / (distP || 1), dz / (distP || 1));
            this.events.onSound("zombie_attack", b.x, b.y, b.z);
          }
          if (distP < 1.2) moveSpeed = 0;
        }
      } else if (m.state === "flee") {
        m.targetYaw = Math.atan2(-dx, -dz) + Math.sin(m.age * 3) * 0.5;
        moveSpeed = m.def.speed * 1.6;
      } else if (m.stateTimer <= 0) {
        if (m.state === "idle") {
          m.state = "wander";
          m.stateTimer = 1.5 + Math.random() * 4;
          m.targetYaw = Math.random() * Math.PI * 2;
        } else {
          m.state = "idle";
          m.stateTimer = 1 + Math.random() * 5;
        }
      }
      if (m.state === "wander") moveSpeed = m.def.speed * 0.7;

      // turn smoothly
      let dy = m.targetYaw - m.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.yaw += dy * Math.min(1, dt * 6);

      // avoid walking off cliffs / into water when wandering
      const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      if (moveSpeed > 0 && m.state !== "chase" && m.state !== "flee") {
        const ax = Math.floor(b.x + fx * 0.8), az = Math.floor(b.z + fz * 0.8);
        const ground = world.getBlock(ax, Math.floor(b.y) - 1, az);
        const ground2 = world.getBlock(ax, Math.floor(b.y) - 2, az);
        const ahead = world.getBlock(ax, Math.floor(b.y), az);
        if ((!BLOCKS[ground]?.solid && !BLOCKS[ground2]?.solid) || ahead === B.WATER || ahead === B.LAVA || ground === B.LAVA) {
          m.targetYaw += Math.PI * (0.5 + Math.random() * 0.5);
          moveSpeed = 0;
        }
      }
      const tvx = fx * moveSpeed, tvz = fz * moveSpeed;
      const accel = b.onGround ? 10 : 2;
      b.vx += (tvx - b.vx) * Math.min(1, accel * dt);
      b.vz += (tvz - b.vz) * Math.min(1, accel * dt);
      if (b.inWater) {
        b.vy += (2 - b.vy) * dt * 3;
      } else {
        b.vy -= 32 * dt;
        if (b.hitWall && b.onGround && moveSpeed > 0) b.vy = 8.5;
      }
      moveBody(world, b, dt);
      if (b.hitWall && b.onGround && moveSpeed > 0 && !b.inWater) b.vy = 8.5;

      // animate
      const hs = Math.hypot(b.vx, b.vz);
      m.walk += hs * dt * 3;
      const g = m.model.group;
      g.position.set(b.x, b.y, b.z);
      g.rotation.y = m.yaw;
      const swing = Math.sin(m.walk) * Math.min(1, hs) * 0.8;
      m.model.legs.forEach((l, i) => (l.rotation.x = (i % 2 === 0 ? swing : -swing) * (i >= 2 ? -1 : 1)));
      m.model.arms.forEach((a, i) => (a.rotation.x = -Math.PI / 2 + Math.sin(m.walk + i) * 0.2));
      if (m.state === "chase") m.model.head.rotation.y = 0;
      else m.model.head.rotation.y = Math.sin(m.age * 0.7) * 0.4;
      // lighting
      const [s, bl] = world.getLight(Math.floor(b.x), Math.floor(b.y + b.h * 0.5), Math.floor(b.z));
      let lum = Math.max((s / 15) * Math.max(sun, 0.08), (bl / 15) * 0.95, 0.1);
      if (m.hurtFlash > 0) m.material.color.setRGB(1, lum * 0.3, lum * 0.3);
      else if (m.burning) m.material.color.setRGB(lum * 1.2, lum * 0.8, lum * 0.6);
      else m.material.color.setScalar(lum);
    }
  }

  private trySpawn(px: number, py: number, pz: number, sun: number) {
    const world = this.world;
    const passive = this.mobs.filter((m) => !m.def.hostile).length;
    const hostile = this.mobs.filter((m) => m.def.hostile).length;
    const night = sun < 0.35;
    for (let attempt = 0; attempt < 6; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 28;
      const x = Math.floor(px + Math.cos(ang) * r), z = Math.floor(pz + Math.sin(ang) * r);
      if (!world.isLoaded(x, z)) continue;
      const c = world.getChunk(x >> 4, z >> 4);
      if (!c || !c.meshed) continue;
      // Find a valid spawn surface: either real surface or a cave floor near the player's height for hostiles
      let y = world.getSurfaceY(x, z);
      const ground = world.getBlock(x, y, z);
      if (y < SEA - 1 || ground === B.WATER || ground === B.LAVA || !BLOCKS[ground]?.solid || ground === B.LEAVES || ground === B.BIRCH_LEAVES || ground === B.SPRUCE_LEAVES) continue;
      const [sky, blk] = world.getLight(x, y + 1, z);
      const light = Math.max(sky * Math.max(sun, 0.1), blk);
      if (!this.peaceful && hostile < 8 && (night || light < 5) && light < 6) {
        if (Math.random() < 0.5) {
          this.spawn("zombie", x + 0.5, y + 1, z + 0.5);
          return;
        }
      }
      if (passive < 10 && (ground === B.GRASS || ground === B.SNOW_GRASS) && sky > 8) {
        const kinds: MobKind[] = ["pig", "sheep", "cow", "chicken"];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const ox = x + Math.floor(Math.random() * 5) - 2, oz = z + Math.floor(Math.random() * 5) - 2;
          const oy = world.getSurfaceY(ox, oz);
          const g = world.getBlock(ox, oy, oz);
          if (g === B.GRASS || g === B.SNOW_GRASS) this.spawn(kind, ox + 0.5, oy + 1, oz + 0.5);
        }
        return;
      }
    }
    void py;
  }
}
