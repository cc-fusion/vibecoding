// Creatures (passive animals, zombie, creeper) and dropped items.
// Box-model mobs with procedural skins, simple AI, shared AABB physics.
import * as THREE from 'three';
import { B, blockDef } from './blocks';
import { I, type Stack } from './items';
import { makeBody, moveBody, groundY, type Body } from './physics';
import type { World } from './world';
import { makeCanvas, canvasTexture, getTileMaterial, getBlockMaterials, getItemIcon } from './textures';
import type { ParticleSystem } from './particles';
import { Sfx, volAt } from './audio';

export type MobKind = 'pig' | 'cow' | 'sheep' | 'chicken' | 'zombie' | 'creeper';
export const HOSTILES: MobKind[] = ['zombie', 'creeper'];

export interface EntityHooks {
  damagePlayer: (amount: number, from: THREE.Vector3) => void;
  tryPickup: (stack: Stack) => number; // returns leftover count
  onExplosion: (pos: THREE.Vector3, radius: number) => void;
  onMobDeath: (kind: MobKind, pos: THREE.Vector3, byPlayer: boolean) => void;
}

interface MobDef { halfW: number; height: number; hp: number; speed: number }
const DEFS: Record<MobKind, MobDef> = {
  pig: { halfW: 0.45, height: 0.9, hp: 10, speed: 1.5 },
  cow: { halfW: 0.5, height: 1.35, hp: 10, speed: 1.3 },
  sheep: { halfW: 0.45, height: 1.15, hp: 8, speed: 1.4 },
  chicken: { halfW: 0.3, height: 0.75, hp: 4, speed: 1.6 },
  zombie: { halfW: 0.35, height: 1.9, hp: 20, speed: 2.35 },
  creeper: { halfW: 0.35, height: 1.65, hp: 20, speed: 2.2 },
};

export interface Mob {
  kind: MobKind;
  body: Body;
  hp: number;
  group: THREE.Group;
  yaw: number;
  targetYaw: number;
  walkPhase: number;
  state: 'idle' | 'wander' | 'chase' | 'flee' | 'fuse';
  stateT: number;
  hurtT: number;
  attackCd: number;
  fuseT: number;
  dead: boolean;
  deadT: number;
  burnT: number;
  voiceT: number;
  eggT: number;
  parts: { legs: THREE.Object3D[]; head?: THREE.Object3D; wings?: THREE.Object3D[]; body?: THREE.Object3D };
  mats: { m: THREE.MeshLambertMaterial; base: THREE.Color }[];
  shadow: THREE.Mesh;
}

interface Drop {
  stack: Stack;
  body: Body;
  mesh: THREE.Object3D;
  age: number;
  bobPhase: number;
}

// ---------------- skin textures ----------------
let skinCache: Record<string, THREE.Texture> | null = null;
function skins(): Record<string, THREE.Texture> {
  if (skinCache) return skinCache;
  const mk = (fn: (ctx: CanvasRenderingContext2D) => void, w = 16, h = 16) => {
    const [c, ctx] = makeCanvas(w, h); fn(ctx); return canvasTexture(c);
  };
  const R = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  skinCache = {
    pigFace: mk(ctx => {
      R(ctx, 0, 0, 16, 16, '#ef9cb1');
      R(ctx, 2, 5, 3, 2, '#fff'); R(ctx, 11, 5, 3, 2, '#fff');
      R(ctx, 3, 5, 1, 2, '#201818'); R(ctx, 12, 5, 1, 2, '#201818');
      R(ctx, 5, 9, 6, 4, '#e07d94'); R(ctx, 6, 10, 1, 2, '#a34a5e'); R(ctx, 9, 10, 1, 2, '#a34a5e');
    }),
    cowFace: mk(ctx => {
      R(ctx, 0, 0, 16, 16, '#8a6a52');
      R(ctx, 0, 0, 6, 7, '#f0ead8'); R(ctx, 11, 0, 5, 5, '#f0ead8');
      R(ctx, 2, 6, 3, 2, '#fff'); R(ctx, 11, 6, 3, 2, '#fff');
      R(ctx, 3, 6, 1, 2, '#1a1210'); R(ctx, 12, 6, 1, 2, '#1a1210');
      R(ctx, 3, 11, 10, 5, '#c9a08a'); R(ctx, 5, 13, 2, 1, '#5f4030'); R(ctx, 9, 13, 2, 1, '#5f4030');
    }),
    cowBody: mk(ctx => {
      R(ctx, 0, 0, 32, 16, '#f0ead8');
      const blotches: [number, number, number, number][] = [[2, 2, 8, 6], [14, 6, 9, 5], [24, 1, 6, 5], [8, 10, 7, 5], [25, 10, 6, 4]];
      for (const [x, y, w, h] of blotches) R(ctx, x, y, w, h, '#8a6a52');
    }, 32, 16),
    sheepFace: mk(ctx => {
      R(ctx, 0, 0, 16, 16, '#8d7d6b');
      R(ctx, 2, 6, 3, 2, '#fff'); R(ctx, 11, 6, 3, 2, '#fff');
      R(ctx, 3, 6, 1, 2, '#1a1210'); R(ctx, 12, 6, 1, 2, '#1a1210');
      R(ctx, 6, 11, 4, 2, '#6e5f4e'); R(ctx, 0, 0, 16, 3, '#e8e8e8');
    }),
    chickenFace: mk(ctx => {
      R(ctx, 0, 0, 16, 16, '#f4f4f4');
      R(ctx, 3, 6, 2, 2, '#1a1210'); R(ctx, 11, 6, 2, 2, '#1a1210');
    }),
    zombieFace: mk(ctx => {
      R(ctx, 0, 0, 16, 16, '#4d8a3d');
      R(ctx, 2, 6, 4, 2, '#12240c'); R(ctx, 10, 6, 4, 2, '#12240c');
      R(ctx, 6, 12, 4, 1, '#2c521f');
      R(ctx, 0, 0, 16, 3, '#427534');
    }),
    creeperFace: mk(ctx => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) R(ctx, x, y, 1, 1, ['#57a83a', '#4c9a33', '#63b544', '#458c2d'][(Math.random() * 4) | 0]);
      R(ctx, 2, 4, 3, 3, '#0d1a08'); R(ctx, 11, 4, 3, 3, '#0d1a08');
      R(ctx, 7, 8, 2, 2, '#0d1a08'); R(ctx, 6, 10, 4, 2, '#0d1a08');
      R(ctx, 4, 12, 2, 3, '#0d1a08'); R(ctx, 10, 12, 2, 3, '#0d1a08'); R(ctx, 6, 12, 4, 1, '#0d1a08');
    }),
    creeperBody: mk(ctx => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) R(ctx, x, y, 1, 1, ['#57a83a', '#4c9a33', '#63b544', '#458c2d', '#6fbf4e'][(Math.random() * 5) | 0]);
    }),
  };
  return skinCache;
}

function lam(color: string | number, map?: THREE.Texture): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, map });
}
function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function legAt(parent: THREE.Group, w: number, h: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = box(w, h, w, mat, 0, -h / 2, 0);
  g.add(m); parent.add(g);
  return g;
}
function faceMats(side: THREE.Material, faceTex: THREE.Texture, top?: THREE.Material): THREE.Material[] {
  const face = lam(0xffffff, faceTex);
  return [side, side, top ?? side, side, face, side];
}

function buildModel(kind: MobKind): { group: THREE.Group; parts: Mob['parts'] } {
  const S = skins();
  const g = new THREE.Group();
  const parts: Mob['parts'] = { legs: [] };
  if (kind === 'pig') {
    const pink = lam('#ef9cb1'), dark = lam('#d97f97');
    const body = box(0.85, 0.62, 1.15, pink, 0, 0.62, 0); g.add(body); parts.body = body;
    const head = new THREE.Group(); head.position.set(0, 0.72, 0.62);
    head.add(box(0.55, 0.5, 0.5, faceMats(pink, S.pigFace), 0, 0.05, 0.12));
    g.add(head); parts.head = head;
    for (const [x, z] of [[-0.28, 0.38], [0.28, 0.38], [-0.28, -0.38], [0.28, -0.38]]) parts.legs.push(legAt(g, 0.2, 0.35, dark, x, 0.35, z));
  } else if (kind === 'cow') {
    const bodyMat = lam(0xffffff, S.cowBody);
    const legMat = lam('#7a5c44');
    const body = box(0.95, 0.7, 1.35, bodyMat, 0, 0.85, 0); g.add(body); parts.body = body;
    const head = new THREE.Group(); head.position.set(0, 1.05, 0.72);
    head.add(box(0.55, 0.55, 0.5, faceMats(lam('#8a6a52'), S.cowFace), 0, 0.05, 0.1));
    head.add(box(0.12, 0.08, 0.08, lam('#d8cfc0'), -0.38, 0.22, 0.05));
    head.add(box(0.12, 0.08, 0.08, lam('#d8cfc0'), 0.38, 0.22, 0.05));
    g.add(head); parts.head = head;
    for (const [x, z] of [[-0.32, 0.48], [0.32, 0.48], [-0.32, -0.48], [0.32, -0.48]]) parts.legs.push(legAt(g, 0.22, 0.55, legMat, x, 0.55, z));
  } else if (kind === 'sheep') {
    const wool = getTileMaterial('wool') as THREE.MeshLambertMaterial;
    const woolC = wool.clone();
    const body = box(0.92, 0.78, 1.2, woolC, 0, 0.82, 0); g.add(body); parts.body = body;
    const head = new THREE.Group(); head.position.set(0, 0.95, 0.62);
    head.add(box(0.48, 0.48, 0.45, faceMats(lam('#8d7d6b'), S.sheepFace, woolC), 0, 0.02, 0.1));
    g.add(head); parts.head = head;
    const legMat = lam('#6e5f4e');
    for (const [x, z] of [[-0.3, 0.42], [0.3, 0.42], [-0.3, -0.42], [0.3, -0.42]]) parts.legs.push(legAt(g, 0.18, 0.45, legMat, x, 0.45, z));
  } else if (kind === 'chicken') {
    const white = lam('#f4f4f4');
    const body = box(0.5, 0.55, 0.7, white, 0, 0.48, 0); g.add(body); parts.body = body;
    const head = new THREE.Group(); head.position.set(0, 0.72, 0.3);
    head.add(box(0.36, 0.38, 0.34, faceMats(white, S.chickenFace), 0, 0.08, 0.05));
    head.add(box(0.16, 0.08, 0.14, lam('#e8a41e'), 0, 0.02, 0.28));
    head.add(box(0.1, 0.14, 0.05, lam('#d92b20'), 0, -0.14, 0.22));
    g.add(head); parts.head = head;
    const wingL = box(0.06, 0.34, 0.44, lam('#e8e8e8'), -0.29, 0.52, 0);
    const wingR = box(0.06, 0.34, 0.44, lam('#e8e8e8'), 0.29, 0.52, 0);
    g.add(wingL, wingR); parts.wings = [wingL, wingR];
    const tail = box(0.3, 0.34, 0.1, white, 0, 0.62, -0.38); tail.rotation.x = -0.6; g.add(tail);
    for (const [x, z] of [[-0.14, 0.05], [0.14, 0.05]]) parts.legs.push(legAt(g, 0.07, 0.22, lam('#e8a41e'), x, 0.22, z));
  } else if (kind === 'zombie') {
    const skin = lam('#4d8a3d');
    const shirt = lam('#2a7d8a');
    const pants = lam('#3a3f8a');
    const torso = box(0.62, 0.72, 0.32, shirt, 0, 1.18, 0); g.add(torso); parts.body = torso;
    const head = new THREE.Group(); head.position.set(0, 1.54, 0);
    head.add(box(0.52, 0.52, 0.5, faceMats(skin, S.zombieFace), 0, 0.26, 0));
    g.add(head); parts.head = head;
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sx * 0.42, 1.45, 0);
      const a = box(0.2, 0.72, 0.2, skin, 0, -0.3, 0); arm.add(a);
      arm.rotation.x = -Math.PI / 2 + 0.12;
      g.add(arm); parts.legs.push(arm);
    }
    for (const sx of [-1, 1]) parts.legs.push(legAt(g, 0.24, 0.82, pants, sx * 0.16, 0.82, 0));
  } else if (kind === 'creeper') {
    const bodyMat = lam(0xffffff, S.creeperBody);
    const body = box(0.55, 0.85, 0.35, bodyMat, 0, 0.72, 0); g.add(body); parts.body = body;
    const head = new THREE.Group(); head.position.set(0, 1.15, 0);
    head.add(box(0.56, 0.56, 0.54, faceMats(bodyMat, S.creeperFace), 0, 0.28, 0));
    g.add(head); parts.head = head;
    for (const [x, z] of [[-0.17, 0.13], [0.17, 0.13], [-0.17, -0.13], [0.17, -0.13]]) parts.legs.push(legAt(g, 0.2, 0.3, bodyMat, x, 0.3, z));
  }
  return { group: g, parts };
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class EntityManager {
  mobs: Mob[] = [];
  private drops: Drop[] = [];
  private group = new THREE.Group();
  private itemTexCache = new Map<number, THREE.Texture>();
  private shadowGeo = new THREE.CircleGeometry(1, 20);
  private shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

  constructor(
    private world: World,
    scene: THREE.Scene,
    private sfx: Sfx,
    private particles: ParticleSystem,
    private hooks: EntityHooks,
  ) { scene.add(this.group); }

  spawnMob(kind: MobKind, x: number, y: number, z: number): Mob {
    const def = DEFS[kind];
    const { group, parts } = buildModel(kind);
    const body = makeBody(new THREE.Vector3(x, y, z), def.halfW, def.height);
    group.position.copy(body.pos);
    const mats: Mob['mats'] = [];
    group.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const ms = (o as THREE.Mesh).material;
        for (const m of Array.isArray(ms) ? ms : [ms]) {
          const lm = m as THREE.MeshLambertMaterial;
          if (lm.isMeshLambertMaterial && !mats.find(e => e.m === lm)) mats.push({ m: lm, base: lm.color.clone() });
        }
      }
    });
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(def.halfW * 1.5);
    shadow.renderOrder = 1;
    this.group.add(shadow);
    const mob: Mob = {
      kind, body, hp: def.hp, group, yaw: Math.random() * Math.PI * 2, targetYaw: 0,
      walkPhase: Math.random() * 6, state: 'idle', stateT: 1 + Math.random() * 3,
      hurtT: 0, attackCd: 0, fuseT: 0, dead: false, deadT: 0, burnT: 0,
      voiceT: 3 + Math.random() * 8, eggT: 30 + Math.random() * 60, parts, mats, shadow,
    };
    mob.targetYaw = mob.yaw;
    this.group.add(group);
    this.mobs.push(mob);
    return mob;
  }

  spawnDrop(x: number, y: number, z: number, stack: Stack, vel?: THREE.Vector3) {
    if (this.drops.length > 240) return;
    let mesh: THREE.Object3D;
    if (stack.id < 256 && blockDef(stack.id).shape === 'cube') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), getBlockMaterials(stack.id));
    } else {
      let tex = this.itemTexCache.get(stack.id);
      if (!tex) {
        const img = new Image();
        img.src = getItemIcon(stack.id);
        tex = new THREE.Texture(img);
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        img.onload = () => { tex!.needsUpdate = true; };
        this.itemTexCache.set(stack.id, tex);
      }
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
    }
    const body = makeBody(new THREE.Vector3(x, y, z), 0.16, 0.32);
    if (vel) body.vel.copy(vel);
    else body.vel.set((Math.random() - 0.5) * 1.6, 3.2 + Math.random(), (Math.random() - 0.5) * 1.6);
    mesh.position.copy(body.pos);
    this.group.add(mesh);
    this.drops.push({ stack: { ...stack }, body, mesh, age: 0, bobPhase: Math.random() * 6 });
  }

  countKind(kind: MobKind) { return this.mobs.filter(m => m.kind === kind && !m.dead).length; }
  countHostiles() { return this.mobs.filter(m => HOSTILES.includes(m.kind) && !m.dead).length; }
  countAnimals() { return this.mobs.filter(m => !HOSTILES.includes(m.kind) && !m.dead).length; }

  damageMob(mob: Mob, dmg: number, kbFrom: THREE.Vector3, byPlayer: boolean) {
    if (mob.dead) return;
    mob.hp -= dmg;
    mob.hurtT = 0.35;
    _v1.copy(mob.body.pos).sub(kbFrom); _v1.y = 0;
    if (_v1.lengthSq() < 0.01) _v1.set(1, 0, 0);
    _v1.normalize();
    mob.body.vel.x += _v1.x * 5.5;
    mob.body.vel.z += _v1.z * 5.5;
    mob.body.vel.y = Math.max(mob.body.vel.y, 3.4);
    if (!HOSTILES.includes(mob.kind)) {
      mob.state = 'flee'; mob.stateT = 1.6;
      mob.targetYaw = Math.atan2(_v1.x, _v1.z);
    }
    if (mob.kind === 'creeper' && mob.state === 'fuse') { mob.state = 'chase'; mob.fuseT = 0; }
    if (mob.hp <= 0) this.killMob(mob, byPlayer);
  }

  private killMob(mob: Mob, byPlayer: boolean) {
    mob.dead = true; mob.deadT = 0;
    const p = mob.body.pos;
    const drop = (id: number, n: number) => { if (n > 0) this.spawnDrop(p.x, p.y + 0.4, p.z, { id, count: n }); };
    const rnd = (a: number, b: number) => a + ((Math.random() * (b - a + 1)) | 0);
    if (mob.kind === 'pig') drop(I.RawPork, rnd(1, 2));
    else if (mob.kind === 'cow') drop(I.RawBeef, rnd(1, 2));
    else if (mob.kind === 'sheep') drop(B.Wool, rnd(1, 2));
    else if (mob.kind === 'chicken') { drop(I.RawChicken, 1); drop(I.Feather, rnd(0, 2)); }
    else if (mob.kind === 'zombie') drop(I.RottenFlesh, rnd(0, 2));
    this.particles.spawn(p.x, p.y + 0.6, p.z, { count: 16, color: '#c9c9c9', speed: 1.2, up: 0.8, gravity: -0.5, life: 0.7, size: 0.14 });
    this.sfx.mobDie(volAt(p.distanceTo(this.lastPlayerPos)));
    this.hooks.onMobDeath(mob.kind, p.clone(), byPlayer);
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): { mob: Mob; dist: number } | null {
    const ray = new THREE.Ray(origin, dir);
    let best: { mob: Mob; dist: number } | null = null;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const p = m.body.pos;
      const box3 = new THREE.Box3(
        new THREE.Vector3(p.x - m.body.halfW - 0.08, p.y, p.z - m.body.halfW - 0.08),
        new THREE.Vector3(p.x + m.body.halfW + 0.08, p.y + m.body.height, p.z + m.body.halfW + 0.08),
      );
      const hit = ray.intersectBox(box3, _v2);
      if (hit) {
        const d = origin.distanceTo(hit);
        if (d <= maxDist && (!best || d < best.dist)) best = { mob: m, dist: d };
      }
    }
    return best;
  }

  private lastPlayerPos = new THREE.Vector3();

  update(dt: number, playerPos: THREE.Vector3, dayFactor: number, canHurtPlayer: boolean) {
    this.lastPlayerPos.copy(playerPos);
    // ---- mobs ----
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const b = m.body;
      const distP = b.pos.distanceTo(playerPos);
      if (m.dead) {
        m.deadT += dt;
        m.group.rotation.z = Math.min(Math.PI / 2, m.deadT * 5);
        m.group.position.y = b.pos.y + 0.2;
        if (m.deadT > 0.55) { this.removeMob(i); }
        continue;
      }
      if (distP > 96) { // despawn far hostiles; animals linger but freeze
        if (HOSTILES.includes(m.kind)) { this.removeMob(i); continue; }
        if (Math.random() < dt * 0.05) { this.removeMob(i); continue; }
      }
      const hostile = HOSTILES.includes(m.kind);
      m.hurtT = Math.max(0, m.hurtT - dt);
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.stateT -= dt;

      // voices
      m.voiceT -= dt;
      if (m.voiceT <= 0) {
        m.voiceT = 5 + Math.random() * 11;
        const v = volAt(distP, 20) * 0.9;
        if (v > 0.03) {
          if (m.kind === 'pig') this.sfx.pig(v);
          else if (m.kind === 'cow') this.sfx.cow(v);
          else if (m.kind === 'sheep') this.sfx.sheep(v);
          else if (m.kind === 'chicken') this.sfx.chicken(v);
          else if (m.kind === 'zombie') this.sfx.zombie(v);
        }
      }
      if (m.kind === 'chicken') {
        m.eggT -= dt;
        if (m.eggT <= 0) { m.eggT = 50 + Math.random() * 90; this.spawnDrop(b.pos.x, b.pos.y + 0.2, b.pos.z, { id: I.Egg, count: 1 }); }
      }
      // zombie daylight burning
      if (m.kind === 'zombie' && dayFactor > 0.55) {
        const sun = this.world.getLightPacked(Math.floor(b.pos.x), Math.floor(b.pos.y + 1), Math.floor(b.pos.z)) >> 4;
        if (sun >= 14) {
          m.burnT += dt;
          if (Math.random() < dt * 8) this.particles.spawn(b.pos.x, b.pos.y + 1.2, b.pos.z, { count: 2, color: ['#ff9d2e', '#ffc93f', '#e25822'], speed: 0.4, up: 1.4, gravity: -2, life: 0.5, size: 0.11 });
          if (m.burnT > 0.9) { m.burnT = 0; m.hp -= 1.5; if (m.hp <= 0) { this.killMob(m, false); continue; } }
        }
      }

      // ---- AI decisions ----
      let moveSpeed = 0;
      const def = DEFS[m.kind];
      if (hostile && canHurtPlayer) {
        if (m.state !== 'fuse') m.state = distP < 30 ? 'chase' : 'wander';
        if (m.state === 'chase') {
          m.targetYaw = Math.atan2(playerPos.x - b.pos.x, playerPos.z - b.pos.z);
          moveSpeed = def.speed * (m.kind === 'creeper' && distP < 7 ? 1.2 : 1);
          if (m.kind === 'zombie' && distP < 1.9 && m.attackCd <= 0) {
            m.attackCd = 0.9;
            this.hooks.damagePlayer(3, b.pos.clone());
          }
          if (m.kind === 'creeper' && distP < 2.5) {
            m.state = 'fuse'; m.fuseT = 0;
            this.sfx.fuse();
          }
        } else if (m.state === 'fuse') {
          moveSpeed = 0;
          m.fuseT += dt;
          if (distP > 5.5) { m.state = 'chase'; m.fuseT = 0; }
          else if (m.fuseT >= 1.3) {
            const pos = b.pos.clone(); pos.y += 0.8;
            this.removeMob(i);
            this.hooks.onExplosion(pos, 3.4);
            continue;
          }
        } else {
          if (m.stateT <= 0) { m.stateT = 2 + Math.random() * 3; m.targetYaw = Math.random() * Math.PI * 2; }
          moveSpeed = def.speed * 0.35;
        }
      } else if (!hostile) {
        if (m.state === 'flee') {
          moveSpeed = def.speed * 2.1;
          if (m.stateT <= 0) m.state = 'idle';
        } else if (m.stateT <= 0) {
          if (m.state === 'idle') { m.state = 'wander'; m.stateT = 2 + Math.random() * 3; m.targetYaw = Math.random() * Math.PI * 2; }
          else { m.state = 'idle'; m.stateT = 2 + Math.random() * 4; }
        }
        if (m.state === 'wander') moveSpeed = def.speed;
      } else {
        // hostile but player invulnerable (creative / dead): wander
        if (m.stateT <= 0) { m.stateT = 2 + Math.random() * 3; m.targetYaw = Math.random() * Math.PI * 2; }
        moveSpeed = def.speed * 0.4;
      }

      // smooth yaw
      let dy = m.targetYaw - m.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.yaw += THREE.MathUtils.clamp(dy, -dt * 6, dt * 6);

      // ---- movement physics ----
      const inFluid = b.inWater || b.inLava;
      const accel = b.onGround ? 14 : 2.5;
      const wishX = Math.sin(m.yaw) * moveSpeed, wishZ = Math.cos(m.yaw) * moveSpeed;
      b.vel.x += THREE.MathUtils.clamp(wishX - b.vel.x, -accel * dt, accel * dt);
      b.vel.z += THREE.MathUtils.clamp(wishZ - b.vel.z, -accel * dt, accel * dt);
      if (inFluid) {
        b.vel.y -= 6 * dt;
        b.vel.y *= Math.max(0, 1 - 2.2 * dt);
        if (b.headInWater || b.inLava) b.vel.y += 22 * dt; // paddle up
        b.vel.y = THREE.MathUtils.clamp(b.vel.y, -3, 2.5);
      } else {
        b.vel.y -= 26 * dt;
        if (m.kind === 'chicken') b.vel.y = Math.max(b.vel.y, -2.6); // flutter down
        b.vel.y = Math.max(b.vel.y, -48);
      }
      if (b.inLava) { m.hp -= 6 * dt; if (m.hp <= 0) { this.killMob(m, false); continue; } }
      const prevVelY = b.vel.y;
      moveBody(this.world, b, dt);
      if (b.hitWall && b.onGround && moveSpeed > 0.1 && !inFluid) b.vel.y = 8.2; // hop up blocks
      if (inFluid && b.hitWall) b.vel.y = Math.max(b.vel.y, 3.2);
      void prevVelY;

      // ---- visuals ----
      const hSpeed = Math.hypot(b.vel.x, b.vel.z);
      m.walkPhase += dt * (2 + hSpeed * 3.2);
      const swing = Math.min(1, hSpeed / 1.2) * 0.65;
      m.parts.legs.forEach((leg, li) => {
        if (m.kind === 'zombie' && li < 2) return; // arms frozen forward
        leg.rotation.x = Math.sin(m.walkPhase + (li % 2 === 0 ? 0 : Math.PI) + (li > 1 ? Math.PI : 0)) * swing;
      });
      if (m.parts.wings) {
        const flap = !b.onGround ? Math.sin(m.walkPhase * 3) * 0.7 : 0;
        m.parts.wings[0].rotation.z = 0.15 + flap;
        m.parts.wings[1].rotation.z = -0.15 - flap;
      }
      if (m.parts.head) {
        // graze / look
        const grazing = !hostile && m.state === 'idle' && Math.sin(m.walkPhase * 0.35) > 0.55 && m.kind !== 'chicken';
        m.parts.head.rotation.x = grazing ? 0.75 : 0;
        if (distP < 6 && !hostile) {
          const ly = Math.atan2(playerPos.x - b.pos.x, playerPos.z - b.pos.z) - m.yaw;
          m.parts.head.rotation.y = THREE.MathUtils.clamp(((ly + Math.PI) % (Math.PI * 2)) - Math.PI, -0.6, 0.6);
        } else m.parts.head.rotation.y *= 0.9;
      }
      m.group.position.copy(b.pos);
      m.group.rotation.y = m.yaw;
      if (m.state === 'fuse') {
        const s = 1 + Math.sin(m.fuseT * 24) * 0.06 + m.fuseT * 0.08;
        m.group.scale.setScalar(s);
      } else m.group.scale.setScalar(1);

      // light tint + hurt/fuse flash
      const lp = this.world.getLightPacked(Math.floor(b.pos.x), Math.floor(b.pos.y + 1), Math.floor(b.pos.z));
      const bright = 0.22 + 0.78 * Math.max(((lp >> 4) / 15) * dayFactor, (lp & 15) / 15);
      const flashWhite = m.state === 'fuse' ? (Math.sin(m.fuseT * 24) > 0 ? 0.75 : 0) : 0;
      for (const { m: mat, base } of m.mats) {
        mat.color.copy(base).multiplyScalar(bright);
        if (m.hurtT > 0) mat.emissive.setRGB(0.65, 0.08, 0.05);
        else if (flashWhite) mat.emissive.setRGB(flashWhite, flashWhite, flashWhite);
        else mat.emissive.setRGB(0, 0, 0);
      }
      // shadow blob
      const gy = groundY(this.world, Math.floor(b.pos.x), Math.floor(b.pos.z), b.pos.y + 0.4);
      m.shadow.position.set(b.pos.x, gy + 0.03, b.pos.z);
      const shScale = THREE.MathUtils.clamp(1 - (b.pos.y - gy) * 0.06, 0.3, 1);
      m.shadow.scale.setScalar(DEFS[m.kind].halfW * 1.5 * shScale);
      m.shadow.visible = b.pos.y - gy < 12;
    }

    // ---- drops ----
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const b = d.body;
      if (d.age > 260 || b.pos.y < -8) { this.removeDrop(i); continue; }
      const toPlayer = _v1.copy(playerPos); toPlayer.y += 0.7;
      const dist = b.pos.distanceTo(toPlayer);
      if (d.age > 0.55 && dist < 2.6) {
        _v1.sub(b.pos).normalize().multiplyScalar(9);
        b.vel.lerp(_v1, 1 - Math.pow(0.0001, dt));
      } else {
        if (b.inWater) { b.vel.y += 14 * dt; b.vel.multiplyScalar(Math.max(0, 1 - 2.4 * dt)); b.vel.y = Math.min(b.vel.y, 1.6); }
        else b.vel.y -= 20 * dt;
        if (b.onGround) { b.vel.x *= Math.max(0, 1 - 8 * dt); b.vel.z *= Math.max(0, 1 - 8 * dt); }
      }
      if (b.inLava) { this.removeDrop(i); continue; }
      moveBody(this.world, b, dt);
      if (d.age > 0.55 && dist < 1.15) {
        const left = this.hooks.tryPickup({ ...d.stack });
        if (left === 0) { this.removeDrop(i); continue; }
        d.stack.count = left;
        d.age = 0.3; // retry shortly (inventory full)
      }
      d.bobPhase += dt * 2.4;
      d.mesh.position.set(b.pos.x, b.pos.y + 0.22 + Math.sin(d.bobPhase) * 0.06, b.pos.z);
      d.mesh.rotation.y += dt * 1.8;
    }
  }

  private removeMob(i: number) {
    const m = this.mobs[i];
    this.group.remove(m.group);
    this.group.remove(m.shadow);
    m.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    for (const { m: mat } of m.mats) mat.dispose();
    this.mobs.splice(i, 1);
  }
  private removeDrop(i: number) {
    const d = this.drops[i];
    this.group.remove(d.mesh);
    if ((d.mesh as THREE.Mesh).isMesh) (d.mesh as THREE.Mesh).geometry.dispose();
    this.drops.splice(i, 1);
  }

  /** hurt all mobs near a point (explosions) */
  explosionDamage(center: THREE.Vector3, radius: number, maxDmg: number) {
    for (const m of [...this.mobs]) {
      const d = m.body.pos.distanceTo(center);
      if (d < radius + 1.5) {
        const dmg = Math.max(1, Math.round(maxDmg * (1 - d / (radius + 1.5))));
        this.damageMob(m, dmg, center, false);
      }
    }
  }

  clearAll() {
    for (let i = this.mobs.length - 1; i >= 0; i--) this.removeMob(i);
    for (let i = this.drops.length - 1; i >= 0; i--) this.removeDrop(i);
  }
}
