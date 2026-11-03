// Mobs: procedural skins, box models, animation, AI (passive + hostile), spawning.
import * as THREE from 'three';
import type { Game } from './game';
import { newBody, moveBody, raycast, type Body } from './physics';
import { B, T_OPAQUE, T_SOLID, SEA } from './blocks';
import { I } from './items';
import { Arrow } from './entities';
import { hash3 } from './noise';
import { BIOME } from './terrain';

type RGB = number[];
class Skin {
  c = document.createElement('canvas'); ctx: CanvasRenderingContext2D; n = 0;
  constructor(public W: number, public H: number) { this.c.width = W; this.c.height = H; this.ctx = this.c.getContext('2d')!; }
  rect(x: number, y: number, w: number, h: number, c: RGB) { this.ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; this.ctx.fillRect(x, y, w, h); }
  fill(x: number, y: number, w: number, h: number, c: RGB, jit: number, f = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = f * (1 + (hash3(x + i, y + j, this.n++ & 7, 99) - 0.5) * 2 * jit);
      this.rect(x + i, y + j, 1, 1, [c[0] * k, c[1] * k, c[2] * k]);
    }
  }
  box(u: number, v: number, w: number, h: number, d: number, c: RGB, jit = 0.07) {
    this.fill(u + d, v, w, d, c, jit, 1.1); this.fill(u + d + w, v, w, d, c, jit, 0.7);
    this.fill(u, v + d, d, h, c, jit, 0.88); this.fill(u + d, v + d, w, h, c, jit, 1); this.fill(u + d + w, v + d, d, h, c, jit, 0.8); this.fill(u + 2 * d + w, v + d, w, h, c, jit, 0.9);
  }
  tex() { const t = new THREE.CanvasTexture(this.c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
}

interface Part { n: string; s: number[]; uv: number[]; p: number[]; c: number[]; parent?: string }
interface MobType {
  key: string; name: string; w: number; h: number; hp: number; speed: number; hostile: boolean; aggro: number;
  tw: number; th: number; parts: Part[]; paint: (s: Skin) => void; snd: string;
  drops: (r: () => number) => [number, number][]; kind: 'quad' | 'biped' | 'chicken' | 'boomer';
}
const rr = (a: number, b: number, r: () => number) => a + Math.floor(r() * (b - a + 1));
const quadLegs = (y: number, lh: number, dx: number, dz: number, uv: number[]): Part[] => [
  { n: 'l0', s: [4, lh, 4], uv, p: [dx, y, dz], c: [0, -lh / 2, 0] }, { n: 'l1', s: [4, lh, 4], uv, p: [-dx, y, dz], c: [0, -lh / 2, 0] },
  { n: 'l2', s: [4, lh, 4], uv, p: [dx, y, -dz], c: [0, -lh / 2, 0] }, { n: 'l3', s: [4, lh, 4], uv, p: [-dx, y, -dz], c: [0, -lh / 2, 0] },
];
const eye = (s: Skin, x: number, y: number) => { s.rect(x, y, 2, 2, [250, 250, 250]); s.rect(x + (x < 12 ? 1 : 0), y, 1, 2, [30, 30, 50]); };

export const MOBS: Record<string, MobType> = {
  pig: {
    key: 'pig', name: 'Pig', w: 0.9, h: 0.9, hp: 10, speed: 2.1, hostile: false, aggro: 0, tw: 64, th: 64, kind: 'quad', snd: 'pig',
    parts: [
      { n: 'body', s: [10, 8, 16], uv: [0, 32], p: [0, 10, 0], c: [0, 0, 0] },
      { n: 'head', s: [8, 8, 8], uv: [0, 0], p: [0, 11, 8], c: [0, 0, 4] },
      { n: 'snout', s: [4, 3, 1], uv: [32, 0], p: [0, -1.5, 8.5], c: [0, 0, 0], parent: 'head' },
      ...quadLegs(6, 6, 3, 5, [0, 16]),
    ],
    paint: (s) => { const P = [240, 160, 160]; s.box(0, 0, 8, 8, 8, P); s.box(0, 16, 4, 6, 4, [226, 140, 140]); s.box(32, 0, 4, 3, 1, [255, 176, 176]); s.box(0, 32, 10, 8, 16, P); eye(s, 9, 11); eye(s, 13, 11); s.rect(34, 2, 1, 1, [180, 90, 90]); s.rect(36, 2, 1, 1, [180, 90, 90]); },
    drops: (r) => [[I.RAW_PORK, rr(1, 3, r)]],
  },
  cow: {
    key: 'cow', name: 'Cow', w: 0.9, h: 1.4, hp: 10, speed: 1.9, hostile: false, aggro: 0, tw: 64, th: 64, kind: 'quad', snd: 'cow',
    parts: [
      { n: 'body', s: [12, 10, 18], uv: [0, 32], p: [0, 17, 0], c: [0, 0, 0] },
      { n: 'head', s: [8, 8, 6], uv: [0, 0], p: [0, 20, 9], c: [0, 0, 3] },
      { n: 'h1', s: [1, 3, 1], uv: [32, 0], p: [-4.5, 3.5, 2], c: [0, 1, 0], parent: 'head' },
      { n: 'h2', s: [1, 3, 1], uv: [32, 0], p: [4.5, 3.5, 2], c: [0, 1, 0], parent: 'head' },
      ...quadLegs(12, 12, 4, 7, [0, 16]),
    ],
    paint: (s) => {
      s.box(0, 32, 12, 10, 18, [72, 54, 44], 0.1); s.box(0, 0, 8, 8, 6, [72, 54, 44], 0.1); s.box(0, 16, 4, 12, 4, [200, 190, 180]); s.box(32, 0, 1, 3, 1, [230, 225, 200]);
      for (let i = 0; i < 26; i++) { const x = Math.floor(hash3(i, 1, 2, 5) * 52), y = 32 + Math.floor(hash3(i, 2, 3, 5) * 26); s.rect(x, y, 2 + (i % 4), 2 + (i % 3), [236, 236, 230]); }
      s.rect(6, 6, 8, 8, [72, 54, 44]); s.rect(7, 9, 2, 2, [20, 20, 20]); s.rect(11, 9, 2, 2, [20, 20, 20]); s.rect(8, 12, 4, 2, [210, 175, 160]);
      s.rect(6, 6, 3, 3, [236, 236, 230]);
    },
    drops: (r) => [[I.RAW_BEEF, rr(1, 3, r)], [I.LEATHER, rr(0, 2, r)]],
  },
  sheep: {
    key: 'sheep', name: 'Sheep', w: 0.9, h: 1.3, hp: 8, speed: 2.0, hostile: false, aggro: 0, tw: 64, th: 64, kind: 'quad', snd: 'sheep',
    parts: [
      { n: 'body', s: [12, 10, 18], uv: [0, 32], p: [0, 17, 0], c: [0, 0, 0] },
      { n: 'head', s: [6, 6, 8], uv: [0, 0], p: [0, 19, 8], c: [0, 0, 4] },
      ...quadLegs(12, 12, 4, 7, [0, 16]),
    ],
    paint: (s) => { s.box(0, 32, 12, 10, 18, [232, 232, 226], 0.06); s.box(0, 0, 6, 6, 8, [206, 178, 150]); s.box(0, 16, 4, 12, 4, [206, 178, 150]); s.rect(8, 8, 6, 6, [206, 178, 150]); s.rect(9, 10, 1, 2, [20, 20, 20]); s.rect(12, 10, 1, 2, [20, 20, 20]); },
    drops: (r) => [[B.WOOL, 1], [I.RAW_MUTTON, rr(1, 2, r)]],
  },
  chicken: {
    key: 'chicken', name: 'Chicken', w: 0.4, h: 0.7, hp: 4, speed: 1.8, hostile: false, aggro: 0, tw: 64, th: 64, kind: 'chicken', snd: 'chicken',
    parts: [
      { n: 'body', s: [6, 6, 8], uv: [0, 16], p: [0, 8, 0], c: [0, 0, 0] },
      { n: 'head', s: [4, 6, 3], uv: [0, 0], p: [0, 9, 4], c: [0, 3, 1.5] },
      { n: 'beak', s: [4, 2, 2], uv: [20, 0], p: [0, 4, 3], c: [0, 0, 1], parent: 'head' },
      { n: 'wattle', s: [2, 2, 2], uv: [32, 0], p: [0, 2, 3], c: [0, 0, 0.5], parent: 'head' },
      { n: 'wl', s: [1, 4, 6], uv: [32, 16], p: [3.5, 10, 0], c: [0, -2, 0] }, { n: 'wr', s: [1, 4, 6], uv: [32, 16], p: [-3.5, 10, 0], c: [0, -2, 0] },
      { n: 'l0', s: [2, 5, 2], uv: [0, 32], p: [1.5, 5, 0], c: [0, -2.5, 0] }, { n: 'l1', s: [2, 5, 2], uv: [0, 32], p: [-1.5, 5, 0], c: [0, -2.5, 0] },
    ],
    paint: (s) => { const W = [244, 244, 240]; s.box(0, 0, 4, 6, 3, W); s.box(20, 0, 4, 2, 2, [240, 170, 40]); s.box(32, 0, 2, 2, 2, [210, 40, 40]); s.box(0, 16, 6, 6, 8, W); s.box(32, 16, 1, 4, 6, [228, 228, 222]); s.box(0, 32, 2, 5, 2, [240, 170, 40]); s.rect(3, 5, 1, 1, [20, 20, 20]); s.rect(6, 5, 1, 1, [20, 20, 20]); },
    drops: (r) => [[I.RAW_CHICKEN, 1], [I.FEATHER, rr(0, 2, r)]],
  },
  zombie: {
    key: 'zombie', name: 'Zombie', w: 0.6, h: 1.85, hp: 20, speed: 2.7, hostile: true, aggro: 20, tw: 64, th: 32, kind: 'biped', snd: 'zombie',
    parts: [
      { n: 'head', s: [8, 8, 8], uv: [0, 0], p: [0, 24, 0], c: [0, 4, 0] },
      { n: 'body', s: [8, 12, 4], uv: [16, 16], p: [0, 24, 0], c: [0, -6, 0] },
      { n: 'ar', s: [4, 12, 4], uv: [40, 16], p: [-6, 22, 0], c: [0, -4, 0] }, { n: 'al', s: [4, 12, 4], uv: [40, 16], p: [6, 22, 0], c: [0, -4, 0] },
      { n: 'lr', s: [4, 12, 4], uv: [0, 16], p: [-2, 12, 0], c: [0, -6, 0] }, { n: 'll', s: [4, 12, 4], uv: [0, 16], p: [2, 12, 0], c: [0, -6, 0] },
    ],
    paint: (s) => { const G = [92, 148, 76]; s.box(0, 0, 8, 8, 8, G, 0.1); s.box(16, 16, 8, 12, 4, [42, 140, 160]); s.box(40, 16, 4, 12, 4, G, 0.1); s.box(0, 16, 4, 12, 4, [50, 50, 140]); s.rect(9, 11, 2, 1, [20, 20, 30]); s.rect(13, 11, 2, 1, [20, 20, 30]); s.rect(10, 14, 4, 1, [50, 70, 40]); s.rect(8, 8, 8, 1, [60, 100, 50]); },
    drops: (r) => [[I.ROTTEN, rr(0, 2, r)], ...(r() < 0.04 ? [[I.IRON_INGOT, 1] as [number, number]] : [])],
  },
  skeleton: {
    key: 'skeleton', name: 'Skeleton', w: 0.6, h: 1.85, hp: 20, speed: 2.4, hostile: true, aggro: 22, tw: 64, th: 32, kind: 'biped', snd: 'skeleton',
    parts: [
      { n: 'head', s: [8, 8, 8], uv: [0, 0], p: [0, 24, 0], c: [0, 4, 0] },
      { n: 'body', s: [8, 12, 4], uv: [16, 16], p: [0, 24, 0], c: [0, -6, 0] },
      { n: 'ar', s: [2, 12, 2], uv: [40, 16], p: [-5, 22, 0], c: [0, -4, 0] }, { n: 'al', s: [2, 12, 2], uv: [40, 16], p: [5, 22, 0], c: [0, -4, 0] },
      { n: 'lr', s: [2, 12, 2], uv: [0, 16], p: [-2, 12, 0], c: [0, -6, 0] }, { n: 'll', s: [2, 12, 2], uv: [0, 16], p: [2, 12, 0], c: [0, -6, 0] },
    ],
    paint: (s) => { const W = [208, 208, 198]; s.box(0, 0, 8, 8, 8, W, 0.05); s.box(16, 16, 8, 12, 4, W, 0.05); s.box(40, 16, 2, 12, 2, W, 0.05); s.box(0, 16, 2, 12, 2, W, 0.05); s.rect(9, 11, 2, 2, [20, 20, 20]); s.rect(13, 11, 2, 2, [20, 20, 20]); s.rect(10, 14, 4, 1, [70, 70, 70]); for (let y = 21; y < 28; y += 2) s.rect(20, y, 8, 1, [90, 90, 86]); },
    drops: (r) => [[I.BONE, rr(0, 2, r)]],
  },
  boomer: {
    key: 'boomer', name: 'Boomer', w: 0.6, h: 1.65, hp: 20, speed: 2.5, hostile: true, aggro: 18, tw: 64, th: 32, kind: 'boomer', snd: 'boomer',
    parts: [
      { n: 'head', s: [8, 8, 8], uv: [0, 0], p: [0, 18, 0], c: [0, 4, 0] },
      { n: 'body', s: [8, 12, 4], uv: [16, 16], p: [0, 18, 0], c: [0, -6, 0] },
      { n: 'l0', s: [4, 6, 4], uv: [0, 16], p: [2, 6, 4], c: [0, -3, 0] }, { n: 'l1', s: [4, 6, 4], uv: [0, 16], p: [-2, 6, 4], c: [0, -3, 0] },
      { n: 'l2', s: [4, 6, 4], uv: [0, 16], p: [2, 6, -4], c: [0, -3, 0] }, { n: 'l3', s: [4, 6, 4], uv: [0, 16], p: [-2, 6, -4], c: [0, -3, 0] },
    ],
    paint: (s) => { const G = [76, 172, 66]; s.box(0, 0, 8, 8, 8, G, 0.22); s.box(16, 16, 8, 12, 4, G, 0.22); s.box(0, 16, 4, 6, 4, G, 0.22); s.rect(9, 10, 2, 2, [8, 8, 8]); s.rect(13, 10, 2, 2, [8, 8, 8]); s.rect(11, 12, 2, 3, [8, 8, 8]); s.rect(10, 14, 1, 2, [8, 8, 8]); s.rect(13, 14, 1, 2, [8, 8, 8]); },
    drops: (r) => [[I.GUNPOWDER, rr(0, 2, r)]],
  },
};

const texCache: Record<string, THREE.CanvasTexture> = {};
const SHADE = [0.7, 0.7, 1.0, 0.5, 0.86, 0.86];
function partGeo(p: Part, W: number, H: number) {
  const [w, h, d] = p.s, [u, v] = p.uv;
  const g = new THREE.BoxGeometry(w / 16, h / 16, d / 16);
  const rects = [[u, v + d, d, h], [u + d + w, v + d, d, h], [u + d, v, w, d], [u + d + w, v, w, d], [u + d, v + d, w, h], [u + 2 * d + w, v + d, w, h]];
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const col = new Float32Array(24 * 3);
  rects.forEach((r, f) => {
    const u0 = r[0] / W, u1 = (r[0] + r[2]) / W, vt = 1 - r[1] / H, vb = 1 - (r[1] + r[3]) / H;
    const us = [u0, u1, u0, u1], vs = [vt, vt, vb, vb];
    for (let k = 0; k < 4; k++) { uv.setXY(f * 4 + k, us[k], vs[k]); for (let c = 0; c < 3; c++) col[(f * 4 + k) * 3 + c] = SHADE[f]; }
  });
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

let shadowTex: THREE.CanvasTexture | null = null;
const getShadowTex = () => {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d')!; const gr = x.createRadialGradient(16, 16, 2, 16, 16, 15);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  return (shadowTex = new THREE.CanvasTexture(c));
};

let mobId = 1;
export class Mob {
  id = mobId++; body: Body; group = new THREE.Group(); parts: Record<string, THREE.Group> = {}; mat: THREE.MeshBasicMaterial;
  hp: number; yaw = Math.random() * 6.28; age = 0; hurt = 0; dead = 0; fuse = -1; burning = 0; fleeT = 0; fleeX = 0; fleeZ = 0;
  walking = false; wanderT = Math.random() * 3; dir = 0; atk = 0; shootCD = 1.5; kb = 0; sndT = 3 + Math.random() * 8;
  phase = 0; lt = 0; bright = 1; los = true; losT = 0; strafe = 1; strafeT = 0; shadow: THREE.Mesh; head: THREE.Group | null;
  constructor(g: Game, public type: MobType, x: number, y: number, z: number, hp?: number) {
    this.body = newBody(type.w, type.h, x, y, z);
    this.hp = hp ?? type.hp;
    if (!texCache[type.key]) { const s = new Skin(type.tw, type.th); type.paint(s); texCache[type.key] = s.tex(); }
    this.mat = new THREE.MeshBasicMaterial({ map: texCache[type.key], vertexColors: true, alphaTest: 0.1 });
    const inner = new THREE.Group();
    for (const p of type.parts) {
      const pivot = new THREE.Group();
      pivot.position.set(p.p[0] / 16, p.p[1] / 16, p.p[2] / 16);
      const m = new THREE.Mesh(partGeo(p, type.tw, type.th), this.mat);
      m.position.set(p.c[0] / 16, p.c[1] / 16, p.c[2] / 16);
      pivot.add(m);
      this.parts[p.n] = pivot;
      (p.parent ? this.parts[p.parent] : inner).add(pivot);
    }
    this.head = this.parts.head || null;
    this.group.add(inner);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(type.w * 1.5, type.w * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    g.scene.add(this.group, this.shadow);
  }

  serialize() { return { k: this.type.key, x: this.body.x, y: this.body.y, z: this.body.z, hp: this.hp }; }

  hit(g: Game, dmg: number, fx: number, fz: number) {
    if (this.dead > 0) return;
    this.hp -= dmg; this.hurt = 0.4;
    const b = this.body, dx = b.x - fx, dz = b.z - fz, d = Math.hypot(dx, dz) || 1;
    b.vx = (dx / d) * 6; b.vz = (dz / d) * 6; b.vy = 5.5; b.onGround = false; this.kb = 0.3;
    if (!this.type.hostile) { this.fleeT = 4; this.fleeX = fx; this.fleeZ = fz; }
    g.audio.play('mob_hurt', b, 0.9);
    g.particles.puff(b.x, b.y + this.type.h * 0.6, b.z, 0.9, 0.2, 0.2, 5, 2, 1, 0.18, 0.5);
    if (this.hp <= 0) this.die(g);
  }
  die(g: Game) {
    this.dead = 0.55;
    g.audio.play('mob_die', this.body, 0.9);
    for (const [id, n] of this.type.drops(Math.random)) if (n > 0) g.spawnItem(id, n, this.body.x, this.body.y + 0.5, this.body.z);
    g.onMobKilled(this);
  }

  update(dt: number, g: Game): boolean {
    const T = this.type, b = this.body, w = g.world!, p = g.player;
    this.age += dt;
    if (!w.isLoaded(Math.floor(b.x), Math.floor(b.z))) return true;
    if (this.dead > 0) {
      this.dead -= dt;
      b.vy -= 30 * dt; b.vx *= 0.9; b.vz *= 0.9;
      moveBody(w, b, dt);
      this.group.rotation.z = Math.min(Math.PI / 2, (0.55 - this.dead) * 5);
      this.group.position.set(b.x, b.y, b.z);
      if (this.dead <= 0) { g.particles.puff(b.x, b.y + 0.5, b.z, 0.85, 0.85, 0.85, 10, 2, 0.8, 0.3, 0.7); return false; }
      return true;
    }
    this.hurt = Math.max(0, this.hurt - dt); this.atk -= dt; this.kb -= dt; this.shootCD -= dt; this.losT -= dt;
    const px = p ? p.body.x : b.x + 1e3, pz = p ? p.body.z : b.z + 1e3;
    const dxp = px - b.x, dzp = pz - b.z, dist = Math.hypot(dxp, dzp), dy = p ? p.body.y - b.y : 0;
    if (p && dist > (T.hostile ? 72 : 110)) return false;
    const bx = Math.floor(b.x), bz = Math.floor(b.z);
    const inWater = w.getBlock(bx, Math.floor(b.y + 0.3), bz) === B.WATER;
    if (w.getBlock(bx, Math.floor(b.y + 0.2), bz) === B.LAVA) { this.hit(g, 4 * dt + 0.01, b.x, b.z); this.burning = 4; }
    // sunlight burning for undead
    if (T.key === 'zombie' || T.key === 'skeleton') {
      if (g.sky.daylight > 0.6 && g.weather.rain < 0.3 && !inWater && w.skyExposed(bx, Math.floor(b.y + 1.8), bz) && this.burning <= 0) this.burning = 6;
      if (inWater) this.burning = 0;
    }
    if (this.burning > 0) {
      this.burning -= dt;
      if (Math.random() < 0.5) g.particles.flame(b.x + (Math.random() - 0.5) * 0.5, b.y + Math.random() * T.h, b.z + (Math.random() - 0.5) * 0.5);
      if (Math.floor(this.age * 2) !== Math.floor((this.age - dt) * 2)) this.hit(g, 1, b.x + (Math.random() - 0.5), b.z + (Math.random() - 0.5));
      if (this.dead > 0) return true;
    }
    // --- AI ---
    let wx = 0, wz = 0, speed = T.speed;
    const hostileActive = T.hostile && p && !p.dead && !g.creative && dist < T.aggro;
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      const dx = b.x - this.fleeX, dz = b.z - this.fleeZ, d = Math.hypot(dx, dz) || 1;
      wx = dx / d; wz = dz / d; speed *= 1.7;
    } else if (hostileActive && p) {
      const tx = dxp / (dist || 1), tz = dzp / (dist || 1);
      if (this.losT <= 0) {
        this.losT = 0.5;
        const ex = b.x, ey = b.y + 1.5, ez = b.z, dx = p.body.x - ex, dyy = p.body.y + 1.5 - ey, dz = p.body.z - ez, dd = Math.hypot(dx, dyy, dz) || 1;
        const h = raycast(w, ex, ey, ez, dx / dd, dyy / dd, dz / dd, dd, (id) => T_OPAQUE[id] === 1);
        this.los = !h;
      }
      if (T.key === 'zombie') {
        wx = tx; wz = tz;
        if (dist < 1.25 && Math.abs(dy) < 1.7 && this.atk <= 0) { this.atk = 1.0; g.damagePlayer(3, b.x, b.z, 'zombie'); g.audio.play('hit', b, 0.8); }
      } else if (T.key === 'skeleton') {
        this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 1 + Math.random() * 2; this.strafe = Math.random() < 0.5 ? -1 : 1; }
        if (dist < 5) { wx = -tx; wz = -tz; } else if (dist > 11) { wx = tx; wz = tz; } else { wx = -tz * this.strafe * 0.6; wz = tx * this.strafe * 0.6; }
        if (this.los && dist < 18 && this.shootCD <= 0) {
          this.shootCD = 1.8 + Math.random() * 1.2;
          const ex = b.x, ey = b.y + 1.5, ez = b.z, tx2 = p.body.x - ex, ty2 = p.body.y + 1.2 - ey, tz2 = p.body.z - ez, d3 = Math.hypot(tx2, ty2, tz2) || 1;
          const sp = 20;
          g.arrows.push(new Arrow(g, ex, ey, ez, (tx2 / d3) * sp, (ty2 / d3) * sp + d3 * 0.22, (tz2 / d3) * sp));
          g.audio.play('shoot', b, 0.9);
        }
      } else if (T.key === 'boomer') {
        if (this.fuse < 0 && dist < 3 && this.los) { this.fuse = 1.5; g.audio.play('fuse', b, 1); }
        if (this.fuse >= 0) {
          this.fuse -= dt;
          if (dist > 7) this.fuse = -1;
          else if (this.fuse <= 0) { g.explode(b.x, b.y + 0.7, b.z, 3.3, 'boomer'); this.hp = 0; this.dead = 0.01; this.type.drops = () => []; return false; }
        } else { wx = tx; wz = tz; }
        if (this.fuse >= 0) { wx = 0; wz = 0; }
      }
    } else {
      this.fuse = -1;
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        if (this.walking) { this.walking = false; this.wanderT = 1.5 + Math.random() * 4; }
        else { this.walking = true; this.wanderT = 1.5 + Math.random() * 3.5; this.dir = Math.random() * Math.PI * 2; }
      }
      if (this.walking) { wx = Math.sin(this.dir); wz = Math.cos(this.dir); speed *= 0.55; }
    }
    // edge / water avoidance when wandering or fleeing
    if ((wx || wz) && b.onGround && !hostileActive) {
      const ax = Math.floor(b.x + wx * 0.9), az = Math.floor(b.z + wz * 0.9), by = Math.floor(b.y);
      let ground = false;
      for (let k = 0; k <= 3; k++) if (w.solidAt(ax, by - k - 0, az)) { ground = true; break; }
      const wet = w.getBlock(ax, by, az) === B.WATER || w.getBlock(ax, by - 1, az) === B.WATER;
      if ((!ground || wet) && this.fleeT <= 0) { this.dir += Math.PI * (0.6 + Math.random() * 0.8); wx = wz = 0; this.walking = true; }
    }
    if (wx || wz) { const ty = Math.atan2(wx, wz); let d = ty - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.yaw += d * Math.min(1, dt * 9); }
    if (this.kb <= 0) {
      const k = Math.min(1, dt * (b.onGround ? 10 : 2.5));
      b.vx += (wx * speed - b.vx) * k; b.vz += (wz * speed - b.vz) * k;
    }
    if ((wx || wz) && b.onGround && (b.hitX || b.hitZ)) b.vy = 8.4;
    b.vy -= (T.key === 'chicken' ? 14 : 30) * dt;
    if (T.key === 'chicken' && b.vy < -1.6) b.vy = -1.6;
    if (inWater) { b.vy = Math.min(2.2, b.vy + 44 * dt); b.vx *= 1 - dt * 3; b.vz *= 1 - dt * 3; if (this.age % 1 < dt && Math.random() < 0.6) g.audio.play('swim', b, 0.3); }
    moveBody(w, b, dt);
    // sounds
    this.sndT -= dt;
    if (this.sndT <= 0) { this.sndT = 6 + Math.random() * 10; if (dist < 28) g.audio.play(T.snd, b, 0.8); }
    // --- animation ---
    const sp = Math.hypot(b.vx, b.vz);
    this.phase += sp * dt * 2.2;
    const sw = Math.sin(this.phase) * Math.min(1, sp / 1.5) * 0.9;
    const P = this.parts;
    if (T.kind === 'quad' || T.kind === 'boomer') {
      if (P.l0) { P.l0.rotation.x = sw; P.l3.rotation.x = sw; P.l1.rotation.x = -sw; P.l2.rotation.x = -sw; }
    } else if (T.kind === 'chicken') {
      if (P.l0) { P.l0.rotation.x = sw; P.l1.rotation.x = -sw; }
      const flap = b.onGround ? 0 : Math.sin(this.age * 30) * 0.9 + 0.8;
      P.wl.rotation.z = flap; P.wr.rotation.z = -flap;
    } else {
      P.ll.rotation.x = sw; P.lr.rotation.x = -sw;
      if (T.key === 'zombie') { P.ar.rotation.x = -1.45 - sw * 0.1; P.al.rotation.x = -1.45 + sw * 0.1; }
      else { const aim = hostileActive && this.los && this.shootCD < 0.6 ? -1.5 : 0; P.ar.rotation.x = aim || -sw; P.al.rotation.x = aim || sw; }
    }
    if (this.head) {
      let hy = 0, hp = 0;
      if (dist < 9 && p) { let d = Math.atan2(dxp, dzp) - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; hy = Math.max(-0.9, Math.min(0.9, d)); hp = Math.max(-0.5, Math.min(0.5, -Math.atan2(p.body.y + 1.5 - (b.y + T.h * 0.8), dist) * 0.6)); }
      this.head.rotation.y += (hy - this.head.rotation.y) * Math.min(1, dt * 6);
      this.head.rotation.x += (hp - this.head.rotation.x) * Math.min(1, dt * 6);
    }
    this.group.rotation.set(0, this.yaw, 0);
    this.group.position.set(b.x, b.y, b.z);
    let sc = 1;
    if (this.fuse >= 0) sc = 1 + Math.sin(this.age * 22) * 0.06 + (1.5 - this.fuse) * 0.18;
    this.group.scale.set(sc, sc, sc);
    this.lt -= dt;
    if (this.lt <= 0) { this.lt = 0.25; this.bright = g.brightnessAt(b.x, b.y + T.h * 0.5, b.z); }
    const flash = this.fuse >= 0 && Math.floor(this.fuse * 8) % 2 === 0;
    if (flash) this.mat.color.setRGB(2.5, 2.5, 2.5);
    else if (this.hurt > 0) this.mat.color.setRGB(this.bright * 1.2, this.bright * 0.35, this.bright * 0.35);
    else this.mat.color.setScalar(this.bright);
    // shadow
    let gy = Math.floor(b.y);
    for (let k = 0; k < 5 && !w.solidAt(bx, gy, bz); k++) gy--;
    this.shadow.position.set(b.x, gy + 1.02, b.z);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = b.y - gy > 3 ? 0 : 1 - (b.y - gy - 1) / 3;
    return true;
  }

  dispose(g: Game) {
    g.scene.remove(this.group, this.shadow);
    this.group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
    this.mat.dispose(); (this.shadow.material as THREE.Material).dispose(); this.shadow.geometry.dispose();
  }
}

export function spawnMob(g: Game, key: string, x: number, y: number, z: number, hp?: number) {
  const m = new Mob(g, { ...MOBS[key] }, x, y, z, hp);
  g.mobs.push(m);
  return m;
}

export class Spawner {
  passT = 1; hostT = 4;
  tryPassive(g: Game, near: number, far: number) {
    const p = g.player!, w = g.world!;
    const a = Math.random() * Math.PI * 2, d = near + Math.random() * (far - near);
    const x = Math.floor(p.body.x + Math.cos(a) * d), z = Math.floor(p.body.z + Math.sin(a) * d);
    if (!w.isLoaded(x, z)) return;
    const h = w.heightAt(x, z);
    if (h < SEA) return;
    const top = w.getBlock(x, h, z);
    if (top !== B.GRASS && top !== B.SNOW_GRASS) return;
    if ((w.lightAt(x, h + 1, z) & 15) < 9) return;
    const biome = w.biomeAt(x, z);
    const pool = biome === BIOME.TUNDRA || biome === BIOME.TAIGA ? ['sheep', 'cow', 'pig'] : biome === BIOME.MOUNTAINS ? ['sheep', 'sheep', 'cow'] : ['pig', 'cow', 'sheep', 'chicken', 'sheep'];
    const key = pool[Math.floor(Math.random() * pool.length)];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const sx = x + Math.floor(Math.random() * 5) - 2, sz = z + Math.floor(Math.random() * 5) - 2;
      const sh = w.heightAt(sx, sz);
      if (sh < SEA || !w.isLoaded(sx, sz) || w.getBlock(sx, sh + 1, sz) !== 0 && w.getBlock(sx, sh + 1, sz) < 33) continue;
      spawnMob(g, key, sx + 0.5, sh + 1.05, sz + 0.5);
    }
  }
  tryHostile(g: Game) {
    const p = g.player!, w = g.world!;
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 20;
    const x = Math.floor(p.body.x + Math.cos(a) * d), z = Math.floor(p.body.z + Math.sin(a) * d);
    if (!w.isLoaded(x, z)) return;
    const h = w.heightAt(x, z);
    const underground = Math.random() < 0.5;
    let y = h + 1;
    if (underground) {
      y = 6 + Math.floor(Math.random() * Math.max(1, h - 10));
      if (w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0 || !w.solidAt(x, y - 1, z)) return;
    } else if (g.sky.daylight > 0.35 && g.weather.rain < 0.5) return;
    if (y < 2) return;
    const l = w.lightAt(x, y, z);
    const sky = (l & 15) * 1, blk = l >> 4;
    const eff = Math.max(sky * (underground ? 1 : g.skyFactor()), blk);
    if (eff > 8.5 || w.getBlock(x, y - 1, z) === B.WATER || w.getBlock(x, y, z) === B.WATER) return;
    if (!T_SOLID[w.getBlock(x, y - 1, z)]) return;
    const r = Math.random();
    spawnMob(g, r < 0.55 ? 'zombie' : r < 0.82 ? 'skeleton' : 'boomer', x + 0.5, y + 0.05, z + 0.5);
  }
  update(dt: number, g: Game) {
    const passive = g.mobs.filter((m) => !m.type.hostile).length, hostile = g.mobs.length - passive;
    this.passT -= dt;
    if (this.passT <= 0) { this.passT = 3; if (passive < 16) this.tryPassive(g, 16, 46); }
    this.hostT -= dt;
    if (this.hostT <= 0) { this.hostT = 2.2; if (hostile < 9 && !g.creative) this.tryHostile(g); }
  }
}
