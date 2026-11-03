import * as THREE from "three";
import { B, TEXLUT, block, item } from "./blocks";
import type { World } from "./world";
import { makeBody, moveBody, type Body } from "./physics";
import { audio } from "./audio";
import type { ParticleSystem } from "./particles";

// ── mob definitions ────────────────────────────────────────────────────────
interface Part {
  p: [number, number, number];
  s: [number, number, number];
  c: number;
  role?: "head" | "legFL" | "legFR" | "legBL" | "legBR" | "wing";
}
export interface MobDef {
  key: MobKind;
  name: string;
  w: number;
  h: number;
  hp: number;
  speed: number;
  hostile: boolean;
  damage: number;
  parts: Part[];
  drops: { id: string; min: number; max: number }[];
  xp: number;
}

export type MobKind = "pig" | "cow" | "sheep" | "chicken" | "zombie" | "spider";

const PINK = 0xe79aa0,
  SNOUT = 0xd37b86,
  BROWN = 0x4b3621,
  WHITE = 0xe8e8e2,
  CREAM = 0xd6c6a8,
  ZGREEN = 0x4f7a33,
  ZSKIN = 0x5f9a4a,
  ZSHIRT = 0x3d5e8c,
  SPIDER = 0x30211c,
  RED = 0xaa1111,
  YELLOW = 0xe8c33a;

export const MOBS: Record<MobKind, MobDef> = {
  pig: {
    key: "pig",
    name: "Pig",
    w: 0.8,
    h: 0.9,
    hp: 10,
    speed: 1.5,
    hostile: false,
    damage: 0,
    xp: 2,
    parts: [
      { p: [0, 0.6, 0], s: [0.65, 0.5, 1.0], c: PINK },
      { p: [0, 0.62, 0.62], s: [0.5, 0.42, 0.3], c: PINK, role: "head" },
      { p: [0, 0.58, 0.79], s: [0.22, 0.16, 0.1], c: SNOUT, role: "head" },
      { p: [0.22, 0.18, 0.33], s: [0.2, 0.42, 0.2], c: PINK, role: "legFR" },
      { p: [-0.22, 0.18, 0.33], s: [0.2, 0.42, 0.2], c: PINK, role: "legFL" },
      { p: [0.22, 0.18, -0.33], s: [0.2, 0.42, 0.2], c: PINK, role: "legBR" },
      { p: [-0.22, 0.18, -0.33], s: [0.2, 0.42, 0.2], c: PINK, role: "legBL" },
    ],
    drops: [{ id: "porkchop_raw", min: 1, max: 3 }],
  },
  cow: {
    key: "cow",
    name: "Cow",
    w: 0.9,
    h: 1.3,
    hp: 14,
    speed: 1.3,
    hostile: false,
    damage: 0,
    xp: 3,
    parts: [
      { p: [0, 0.9, 0], s: [0.75, 0.6, 1.2], c: BROWN },
      { p: [0, 1.05, 0.75], s: [0.5, 0.5, 0.4], c: BROWN, role: "head" },
      { p: [0, 0.95, 0.96], s: [0.34, 0.24, 0.1], c: WHITE, role: "head" },
      { p: [0.26, 1.28, 0.72], s: [0.1, 0.12, 0.1], c: WHITE, role: "head" },
      { p: [-0.26, 1.28, 0.72], s: [0.1, 0.12, 0.1], c: WHITE, role: "head" },
      { p: [0.26, 0.3, 0.42], s: [0.22, 0.62, 0.22], c: BROWN, role: "legFR" },
      { p: [-0.26, 0.3, 0.42], s: [0.22, 0.62, 0.22], c: BROWN, role: "legFL" },
      { p: [0.26, 0.3, -0.42], s: [0.22, 0.62, 0.22], c: BROWN, role: "legBR" },
      { p: [-0.26, 0.3, -0.42], s: [0.22, 0.62, 0.22], c: BROWN, role: "legBL" },
    ],
    drops: [
      { id: "leather", min: 1, max: 2 },
      { id: "porkchop_raw", min: 1, max: 2 },
    ],
  },
  sheep: {
    key: "sheep",
    name: "Sheep",
    w: 0.85,
    h: 1.2,
    hp: 12,
    speed: 1.35,
    hostile: false,
    damage: 0,
    xp: 2,
    parts: [
      { p: [0, 0.85, 0], s: [0.8, 0.7, 1.15], c: WHITE },
      { p: [0, 0.98, 0.72], s: [0.42, 0.42, 0.4], c: CREAM, role: "head" },
      { p: [0.24, 0.3, 0.4], s: [0.2, 0.6, 0.2], c: CREAM, role: "legFR" },
      { p: [-0.24, 0.3, 0.4], s: [0.2, 0.6, 0.2], c: CREAM, role: "legFL" },
      { p: [0.24, 0.3, -0.4], s: [0.2, 0.6, 0.2], c: CREAM, role: "legBR" },
      { p: [-0.24, 0.3, -0.4], s: [0.2, 0.6, 0.2], c: CREAM, role: "legBL" },
    ],
    drops: [{ id: "white_wool", min: 1, max: 2 }],
  },
  chicken: {
    key: "chicken",
    name: "Chicken",
    w: 0.45,
    h: 0.7,
    hp: 4,
    speed: 1.2,
    hostile: false,
    damage: 0,
    xp: 1,
    parts: [
      { p: [0, 0.42, 0], s: [0.34, 0.36, 0.42], c: WHITE },
      { p: [0, 0.65, 0.18], s: [0.24, 0.26, 0.24], c: WHITE, role: "head" },
      { p: [0, 0.64, 0.33], s: [0.1, 0.08, 0.12], c: YELLOW, role: "head" },
      { p: [0, 0.8, 0.14], s: [0.08, 0.1, 0.14], c: RED, role: "head" },
      { p: [0.2, 0.44, 0], s: [0.06, 0.3, 0.34], c: CREAM, role: "wing" },
      { p: [-0.2, 0.44, 0], s: [0.06, 0.3, 0.34], c: CREAM, role: "wing" },
      { p: [0.1, 0.12, 0], s: [0.07, 0.26, 0.07], c: YELLOW, role: "legFR" },
      { p: [-0.1, 0.12, 0], s: [0.07, 0.26, 0.07], c: YELLOW, role: "legFL" },
    ],
    drops: [{ id: "porkchop_raw", min: 1, max: 1 }],
  },
  zombie: {
    key: "zombie",
    name: "Zombie",
    w: 0.6,
    h: 1.85,
    hp: 20,
    speed: 1.55,
    hostile: true,
    damage: 3,
    xp: 5,
    parts: [
      { p: [0, 1.1, 0], s: [0.55, 0.72, 0.3], c: ZSHIRT },
      { p: [0, 1.68, 0], s: [0.45, 0.45, 0.45], c: ZSKIN, role: "head" },
      { p: [0.42, 1.25, 0.2], s: [0.22, 0.65, 0.22], c: ZGREEN, role: "wing" },
      { p: [-0.42, 1.25, 0.2], s: [0.22, 0.65, 0.22], c: ZGREEN, role: "wing" },
      { p: [0.15, 0.37, 0], s: [0.24, 0.75, 0.24], c: 0x2b3a6b, role: "legFR" },
      { p: [-0.15, 0.37, 0], s: [0.24, 0.75, 0.24], c: 0x2b3a6b, role: "legFL" },
    ],
    drops: [
      { id: "bone", min: 0, max: 2 },
      { id: "string", min: 0, max: 1 },
    ],
  },
  spider: {
    key: "spider",
    name: "Spider",
    w: 1.1,
    h: 0.75,
    hp: 16,
    speed: 2.3,
    hostile: true,
    damage: 2,
    xp: 5,
    parts: [
      { p: [0, 0.4, -0.25], s: [0.7, 0.5, 0.7], c: SPIDER },
      { p: [0, 0.4, 0.35], s: [0.5, 0.4, 0.45], c: SPIDER, role: "head" },
      { p: [0.16, 0.5, 0.55], s: [0.1, 0.1, 0.06], c: RED, role: "head" },
      { p: [-0.16, 0.5, 0.55], s: [0.1, 0.1, 0.06], c: RED, role: "head" },
      { p: [0.48, 0.3, 0.2], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legFR" },
      { p: [-0.48, 0.3, 0.2], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legFL" },
      { p: [0.48, 0.3, -0.1], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legBR" },
      { p: [-0.48, 0.3, -0.1], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legBL" },
      { p: [0.48, 0.3, -0.45], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legBR" },
      { p: [-0.48, 0.3, -0.45], s: [0.55, 0.1, 0.1], c: SPIDER, role: "legBL" },
    ],
    drops: [{ id: "string", min: 1, max: 2 }],
  },
};

const matCache = new Map<number, THREE.MeshLambertMaterial>();
function mat(c: number) {
  let m = matCache.get(c);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    matCache.set(c, m);
  }
  return m;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export class Mob {
  body: Body;
  group = new THREE.Group();
  def: MobDef;
  hp: number;
  yaw = Math.random() * Math.PI * 2;
  targetYaw = this.yaw;
  state: "idle" | "wander" | "chase" | "flee" = "idle";
  timer = Math.random() * 3;
  walkPhase = 0;
  attackCd = 0;
  hurtFlash = 0;
  legs: THREE.Object3D[] = [];
  head: THREE.Object3D[] = [];
  dead = false;
  soundCd = Math.random() * 15;
  burn = 0;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.def = MOBS[kind];
    this.hp = this.def.hp;
    this.body = makeBody(x, y, z, this.def.w, this.def.h);
    this.body.stepHeight = 0.6;
    for (const part of this.def.parts) {
      const m = new THREE.Mesh(boxGeo, mat(part.c));
      m.scale.set(part.s[0], part.s[1], part.s[2]);
      m.castShadow = false;
      if (part.role && part.role !== "head") {
        const pivot = new THREE.Group();
        pivot.position.set(part.p[0], part.p[1] + part.s[1] / 2, part.p[2]);
        m.position.set(0, -part.s[1] / 2, 0);
        pivot.add(m);
        this.group.add(pivot);
        this.legs.push(pivot);
      } else {
        m.position.set(part.p[0], part.p[1], part.p[2]);
        this.group.add(m);
        if (part.role === "head") this.head.push(m);
      }
    }
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, isDay: boolean, particles: ParticleSystem) {
    const b = this.body;
    this.timer -= dt;
    this.attackCd -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.soundCd -= dt;

    const dist = b.pos.distanceTo(playerPos);
    const def = this.def;

    if (def.hostile) {
      if (dist < 18) {
        this.state = "chase";
        const dx = playerPos.x - b.pos.x;
        const dz = playerPos.z - b.pos.z;
        this.targetYaw = Math.atan2(dx, dz);
      } else if (this.timer <= 0) {
        this.state = Math.random() < 0.5 ? "idle" : "wander";
        this.targetYaw = Math.random() * Math.PI * 2;
        this.timer = 2 + Math.random() * 4;
      }
      // burn in sunlight
      if (isDay && def.key === "zombie") {
        const sky = world.getLight(
          Math.floor(b.pos.x),
          Math.floor(b.pos.y + 1.6),
          Math.floor(b.pos.z),
        ) >> 4;
        if (sky > 12) {
          this.burn += dt;
          if (Math.random() < dt * 14)
            particles.spawn(
              b.pos.x + (Math.random() - 0.5) * 0.5,
              b.pos.y + Math.random() * def.h,
              b.pos.z + (Math.random() - 0.5) * 0.5,
              0,
              1.4,
              0,
              1,
              0.6,
              0.1,
              0.12,
              0.5,
              -2,
            );
          if (this.burn > 1) {
            this.burn = 0;
            this.damage(2);
          }
        }
      }
    } else {
      if (this.state === "flee") {
        if (this.timer <= 0) this.state = "wander";
      } else if (this.timer <= 0) {
        this.state = Math.random() < 0.45 ? "idle" : "wander";
        this.targetYaw = Math.random() * Math.PI * 2;
        this.timer = 2 + Math.random() * 5;
      }
    }

    if (this.soundCd <= 0) {
      this.soundCd = 14 + Math.random() * 22;
      if (dist < 22) audio.mob(def.key);
    }

    // turn smoothly
    let d = this.targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 6);

    const moving = this.state === "wander" || this.state === "chase" || this.state === "flee";
    let speed = def.speed * (this.state === "chase" ? 1.15 : this.state === "flee" ? 1.5 : 1);
    if (b.inWater) speed *= 0.6;
    if (moving && !(this.state === "chase" && dist < 1.4)) {
      b.vel.x = Math.sin(this.yaw) * speed;
      b.vel.z = Math.cos(this.yaw) * speed;
      this.walkPhase += dt * speed * 4.5;
      // jump over obstacles
      if (b.onGround) {
        const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.7);
        const fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.7);
        if (world.isSolid(fx, Math.floor(b.pos.y), fz) && !world.isSolid(fx, Math.floor(b.pos.y) + 1, fz)) {
          b.vel.y = 7.4;
        }
      }
    } else {
      b.vel.x *= 0.8;
      b.vel.z *= 0.8;
    }
    if (b.inWater && b.vel.y < 1.5) b.vel.y += 14 * dt;

    moveBody(world, b, dt);
    if (b.onGround) {
      b.vel.x *= Math.pow(0.02, dt);
      b.vel.z *= Math.pow(0.02, dt);
    }

    this.group.position.copy(b.pos);
    this.group.rotation.y = this.yaw;
    // leg animation
    const swing = moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    for (let i = 0; i < this.legs.length; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      const back = i >= 2 ? -1 : 1;
      this.legs[i].rotation.x = swing * sign * back;
    }
    // hurt flash
    const s = 1 + this.hurtFlash * 0.12;
    this.group.scale.setScalar(s);

    // light based tint
    const l = world.lightLevel(
      Math.floor(b.pos.x),
      Math.floor(b.pos.y + def.h * 0.5),
      Math.floor(b.pos.z),
      1,
    );
    const br = 0.22 + (l / 15) * 0.78;
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m && m.isMeshLambertMaterial) {
        // handled by scene lights; keep emissive subtle for dark areas
      }
    });
    (this.group as any).__bright = br;
  }

  damage(n: number): boolean {
    this.hp -= n;
    this.hurtFlash = 1;
    if (!this.def.hostile) {
      this.state = "flee";
      this.timer = 4;
      this.targetYaw = this.yaw + Math.PI + (Math.random() - 0.5);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }
}

// ── item entities ──────────────────────────────────────────────────────────
const itemGeoCache = new Map<string, THREE.BufferGeometry>();
const spriteMatCache = new Map<string, THREE.SpriteMaterial>();

function cubeGeometryForBlock(id: number): THREE.BufferGeometry {
  const key = "b" + id;
  let g = itemGeoCache.get(key);
  if (g) return g;
  const positions: number[] = [];
  const uvs: number[] = [];
  const layers: number[] = [];
  const lights: number[] = [];
  const faces: number[] = [];
  const tints: number[] = [];
  const indices: number[] = [];
  const FD: [number[], number[], number[], number[]][] = [
    [[0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1], [0, 0, 0]],
    [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0], [0, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0], [0, 0, 0]],
  ];
  const UVS = [
    [[0, 0], [0, 1], [1, 1], [1, 0]],
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    [[0, 1], [0, 0], [1, 0], [1, 1]],
    [[0, 1], [1, 1], [1, 0], [0, 0]],
    [[0, 1], [1, 1], [1, 0], [0, 0]],
    [[0, 1], [0, 0], [1, 0], [1, 1]],
  ];
  for (let f = 0; f < 6; f++) {
    const [, u, v, base] = FD[f];
    const layer = TEXLUT[id * 6 + f];
    const start = positions.length / 3;
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (let ci = 0; ci < 4; ci++) {
      const [uc, vc] = corners[ci];
      positions.push(
        base[0] + u[0] * uc + v[0] * vc - 0.5,
        base[1] + u[1] * uc + v[1] * vc - 0.5,
        base[2] + u[2] * uc + v[2] * vc - 0.5,
      );
      uvs.push(UVS[f][ci][0], UVS[f][ci][1]);
      layers.push(layer);
      lights.push(1, 0, 1);
      faces.push(f);
      tints.push(1, 1, 1);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aUv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("aLayer", new THREE.Float32BufferAttribute(layers, 1));
  g.setAttribute("aLight", new THREE.Float32BufferAttribute(lights, 3));
  g.setAttribute("aFace", new THREE.Float32BufferAttribute(faces, 1));
  g.setAttribute("aTint", new THREE.Float32BufferAttribute(tints, 3));
  g.setIndex(indices);
  itemGeoCache.set(key, g);
  return g;
}

export class ItemEntity {
  body: Body;
  obj: THREE.Object3D;
  age = 0;
  pickupDelay = 0.5;
  constructor(
    public id: string,
    public count: number,
    x: number,
    y: number,
    z: number,
    voxelMat: THREE.Material,
    public dur?: number,
  ) {
    this.body = makeBody(x, y, z, 0.25, 0.25);
    this.body.stepHeight = 0;
    const def = item(id);
    if (def?.block && block(def.block).kind === "cube") {
      const geo = cubeGeometryForBlock(def.block);
      const m = new THREE.Mesh(geo, voxelMat);
      m.scale.setScalar(0.3);
      this.obj = m;
    } else {
      let smat = spriteMatCache.get(id);
      if (!smat) {
        const tex = new THREE.TextureLoader().load(def?.icon ?? "");
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        smat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        spriteMatCache.set(id, smat);
      }
      const sp = new THREE.Sprite(smat);
      sp.scale.setScalar(0.42);
      this.obj = sp;
    }
  }
  update(dt: number, world: World) {
    this.age += dt;
    this.pickupDelay -= dt;
    moveBody(world, this.body, dt, false);
    if (this.body.onGround) {
      this.body.vel.x *= Math.pow(0.001, dt);
      this.body.vel.z *= Math.pow(0.001, dt);
    }
    this.obj.position.copy(this.body.pos);
    this.obj.position.y += 0.22 + Math.sin(this.age * 2.6) * 0.07;
    if ((this.obj as THREE.Mesh).isMesh) this.obj.rotation.y = this.age * 1.3;
  }
}

export function pickSpawnKind(biome: number, night: boolean, rng: () => number): MobKind | null {
  if (night) {
    return rng() < 0.65 ? "zombie" : "spider";
  }
  const r = rng();
  if (biome === 7) return null; // desert
  if (biome === 6 || biome === 5) return r < 0.6 ? "sheep" : "chicken"; // snowy/taiga
  if (r < 0.3) return "pig";
  if (r < 0.6) return "cow";
  if (r < 0.85) return "sheep";
  return "chicken";
}

export { B };
