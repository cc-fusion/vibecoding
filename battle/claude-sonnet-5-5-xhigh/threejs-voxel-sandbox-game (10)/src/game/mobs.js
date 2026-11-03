// Creatures: procedural skins, box-part models, AI (passive animals + hostile monsters), spawning.
import * as THREE from 'three';
import { B, I } from './blocks.js';
import { CH } from './constants.js';
import { mulberry32 } from './noise.js';
import { moveBox, rayAABB } from './physics.js';

// ---------------------------------------------------------------------------------------------
// skin painting
const rgb = (c) => `rgb(${Math.max(0, Math.min(255, c[0])) | 0},${Math.max(0, Math.min(255, c[1])) | 0},${Math.max(0, Math.min(255, c[2])) | 0})`;
class Painter {
  constructor(ctx, seed) { this.ctx = ctx; this.rnd = mulberry32(seed); }
  rect(x, y, w, h, c) { this.ctx.fillStyle = rgb(c); this.ctx.fillRect(x, y, w, h); }
  noise(x, y, w, h, base, amp = 0.12) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = 1 + (this.rnd() - 0.5) * amp * 2;
      this.rect(x + i, y + j, 1, 1, [base[0] * f, base[1] * f, base[2] * f]);
    }
  }
  regs(u, v, w, h, d) {
    return { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
  }
  boxAll(r, base, amp) { for (const k in r) this.noise(r[k][0], r[k][1], r[k][2], r[k][3], base, amp); }
  px(r, face, x, y, c, w = 1, h = 1) { const f = r[face]; this.rect(f[0] + x, f[1] + y, w, h, c); }
}

const SKINS = {
  pig(P) {
    const head = P.regs(0, 0, 8, 8, 8), body = P.regs(0, 28, 10, 8, 16), leg = P.regs(0, 16, 4, 6, 4), snout = P.regs(32, 0, 4, 3, 1);
    P.boxAll(head, [242, 160, 170], 0.07); P.boxAll(body, [236, 152, 162], 0.07); P.boxAll(leg, [228, 140, 152], 0.07);
    P.boxAll(snout, [222, 126, 138], 0.05);
    P.px(head, 'front', 1, 3, [30, 30, 40]); P.px(head, 'front', 6, 3, [30, 30, 40]);
    P.px(head, 'front', 2, 3, [250, 250, 250]); P.px(head, 'front', 5, 3, [250, 250, 250]);
    P.px(snout, 'front', 1, 1, [120, 50, 60]); P.px(snout, 'front', 2, 1, [120, 50, 60]);
  },
  cow(P) {
    const head = P.regs(0, 0, 8, 8, 6), body = P.regs(0, 14, 12, 10, 18), leg = P.regs(0, 42, 4, 12, 4), horn = P.regs(32, 0, 1, 3, 1), muz = P.regs(36, 0, 6, 3, 1);
    P.boxAll(head, [96, 66, 48], 0.1); P.boxAll(body, [238, 236, 230], 0.04); P.boxAll(leg, [225, 222, 216], 0.05);
    P.boxAll(horn, [225, 220, 200], 0.05); P.boxAll(muz, [206, 170, 150], 0.05);
    for (let k = 0; k < 9; k++) {
      const f = ['top', 'right', 'left', 'front', 'back'][k % 5];
      const r = body[f];
      P.rect(r[0] + Math.floor(P.rnd() * (r[2] - 3)), r[1] + Math.floor(P.rnd() * (r[3] - 3)), 3 + Math.floor(P.rnd() * 4), 3 + Math.floor(P.rnd() * 4), [74, 52, 40]);
    }
    P.rect(head.front[0] + 3, head.front[1], 2, 8, [235, 232, 225]);
    P.px(head, 'front', 1, 3, [20, 20, 20]); P.px(head, 'front', 6, 3, [20, 20, 20]);
    P.px(muz, 'front', 1, 1, [90, 50, 50]); P.px(muz, 'front', 4, 1, [90, 50, 50]);
    for (const f of ['right', 'left', 'front', 'back']) P.rect(leg[f][0], leg[f][1] + 8, leg[f][2], 4, [70, 52, 42]);
  },
  sheep(P) {
    const head = P.regs(0, 0, 6, 6, 8), body = P.regs(0, 14, 12, 10, 18), leg = P.regs(0, 42, 4, 10, 4);
    P.boxAll(head, [214, 194, 164], 0.07); P.boxAll(leg, [206, 186, 156], 0.07);
    P.boxAll(body, [240, 240, 238], 0.06);
    for (let i = 0; i < 80; i++) P.rect(body.top[0] + Math.floor(P.rnd() * 12), body.top[1] + Math.floor(P.rnd() * 18), 1, 1, [222, 224, 226]);
    P.px(head, 'front', 1, 2, [30, 30, 30]); P.px(head, 'front', 4, 2, [30, 30, 30]);
    P.rect(head.front[0] + 2, head.front[1] + 4, 2, 1, [150, 110, 100]);
  },
  chicken(P) {
    const body = P.regs(0, 0, 6, 6, 8), head = P.regs(0, 14, 4, 6, 3), beak = P.regs(14, 14, 4, 2, 2), wattle = P.regs(26, 14, 2, 2, 2), leg = P.regs(0, 24, 1, 5, 1), wing = P.regs(0, 30, 1, 4, 6);
    P.boxAll(body, [246, 246, 244], 0.05); P.boxAll(head, [248, 248, 246], 0.04); P.boxAll(beak, [238, 178, 44], 0.04);
    P.boxAll(wattle, [208, 40, 40], 0.04); P.boxAll(leg, [220, 170, 50], 0.04); P.boxAll(wing, [236, 236, 232], 0.05);
    P.px(head, 'front', 0, 2, [20, 20, 20]); P.px(head, 'front', 3, 2, [20, 20, 20]);
  },
  zombie(P) {
    const head = P.regs(0, 0, 8, 8, 8), body = P.regs(16, 16, 8, 12, 4), arm = P.regs(40, 16, 4, 12, 4), leg = P.regs(0, 16, 4, 12, 4);
    P.boxAll(head, [96, 150, 84], 0.12); P.boxAll(body, [28, 150, 160], 0.1); P.boxAll(arm, [96, 150, 84], 0.12); P.boxAll(leg, [50, 52, 150], 0.1);
    for (const f of ['right', 'left', 'front', 'back']) P.rect(arm[f][0], arm[f][1], arm[f][2], 4, [28, 150, 160]);
    P.rect(head.top[0], head.top[1], 8, 8, [72, 120, 66]);
    P.px(head, 'front', 1, 3, [20, 30, 90], 2, 2); P.px(head, 'front', 5, 3, [20, 30, 90], 2, 2);
    P.px(head, 'front', 3, 5, [60, 100, 56], 2, 1); P.px(head, 'front', 2, 6, [50, 40, 40], 4, 1);
    for (const f of ['right', 'left', 'front', 'back']) P.rect(leg[f][0], leg[f][1] + 10, leg[f][2], 2, [34, 34, 70]);
  },
  skeleton(P) {
    const head = P.regs(0, 0, 8, 8, 8), body = P.regs(16, 16, 8, 12, 4), arm = P.regs(40, 16, 2, 12, 2), leg = P.regs(0, 16, 2, 12, 2);
    P.boxAll(head, [206, 206, 196], 0.08); P.boxAll(body, [190, 190, 180], 0.08); P.boxAll(arm, [200, 200, 190], 0.08); P.boxAll(leg, [200, 200, 190], 0.08);
    for (const f of ['front', 'back']) for (let y = 1; y < 12; y += 3) P.rect(body[f][0], body[f][1] + y, 8, 1, [60, 60, 56]);
    P.rect(body.front[0] + 3, body.front[1], 2, 12, [70, 70, 64]);
    P.px(head, 'front', 1, 3, [20, 20, 20], 2, 2); P.px(head, 'front', 5, 3, [20, 20, 20], 2, 2);
    P.px(head, 'front', 3, 5, [90, 90, 84], 2, 1); P.px(head, 'front', 2, 6, [70, 70, 64], 4, 1);
  },
  creeper(P) {
    const head = P.regs(0, 0, 8, 8, 8), body = P.regs(16, 16, 8, 12, 4), leg = P.regs(0, 16, 4, 6, 4);
    for (const r of [head, body, leg]) {
      P.boxAll(r, [88, 176, 78], 0.14);
      for (const k in r) for (let n = 0; n < Math.max(2, r[k][2] * r[k][3] / 14); n++) P.rect(r[k][0] + Math.floor(P.rnd() * r[k][2]), r[k][1] + Math.floor(P.rnd() * r[k][3]), 1 + Math.floor(P.rnd() * 2), 1, [48, 120, 44]);
    }
    const D = [12, 28, 12];
    P.px(head, 'front', 1, 2, D, 2, 2); P.px(head, 'front', 5, 2, D, 2, 2);
    P.px(head, 'front', 3, 4, D, 2, 2); P.px(head, 'front', 2, 5, D, 1, 3); P.px(head, 'front', 5, 5, D, 1, 3);
  },
};

const skinCache = {};
function getSkin(type) {
  if (skinCache[type]) return skinCache[type];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  SKINS[type](new Painter(ctx, type.length * 977 + type.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.NoColorSpace;
  skinCache[type] = tex;
  return tex;
}

function makeBoxGeo(s, t, regsFn) {
  const [w, h, d] = s;
  const g = new THREE.BoxGeometry(w / 16, h / 16, d / 16);
  const r = regsFn(t[0], t[1], w, h, d);
  const order = [r.left, r.right, r.top, r.bottom, r.front, r.back];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [x, y, rw, rh] = order[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (x + u * rw) / 64, 1 - (y + (1 - v) * rh) / 64);
    }
  }
  return g;
}
const regsFn = (u, v, w, h, d) => ({ top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] });

// ---------------------------------------------------------------------------------------------
const ZOMBIE_PARTS = [
  { n: 'head', s: [8, 8, 8], t: [0, 0], p: [0, 24, 0], c: [0, 4, 0], a: 'head' },
  { n: 'body', s: [8, 12, 4], t: [16, 16], p: [0, 18, 0], c: [0, 0, 0] },
  { n: 'armR', s: [4, 12, 4], t: [40, 16], p: [-6, 22, 0], c: [0, -4, 0], a: 'armR' },
  { n: 'armL', s: [4, 12, 4], t: [40, 16], p: [6, 22, 0], c: [0, -4, 0], a: 'armL' },
  { n: 'legR', s: [4, 12, 4], t: [0, 16], p: [-2, 12, 0], c: [0, -6, 0], a: 'legA' },
  { n: 'legL', s: [4, 12, 4], t: [0, 16], p: [2, 12, 0], c: [0, -6, 0], a: 'legB' },
];
const SKELETON_PARTS = [
  { n: 'head', s: [8, 8, 8], t: [0, 0], p: [0, 24, 0], c: [0, 4, 0], a: 'head' },
  { n: 'body', s: [8, 12, 4], t: [16, 16], p: [0, 18, 0], c: [0, 0, 0] },
  { n: 'armR', s: [2, 12, 2], t: [40, 16], p: [-5, 22, 0], c: [0, -4, 0], a: 'armR' },
  { n: 'armL', s: [2, 12, 2], t: [40, 16], p: [5, 22, 0], c: [0, -4, 0], a: 'armL' },
  { n: 'legR', s: [2, 12, 2], t: [0, 16], p: [-2, 12, 0], c: [0, -6, 0], a: 'legA' },
  { n: 'legL', s: [2, 12, 2], t: [0, 16], p: [2, 12, 0], c: [0, -6, 0], a: 'legB' },
];

export const MOB_DEFS = {
  pig: {
    name: 'Pig', hw: 0.45, h: 0.9, hp: 10, speed: 1.5, ai: 'passive', sound: 'pig',
    parts: [
      { n: 'body', s: [10, 8, 16], t: [0, 28], p: [0, 10, 0], c: [0, 0, 0] },
      { n: 'head', s: [8, 8, 8], t: [0, 0], p: [0, 10, 8], c: [0, 1, 2], a: 'head' },
      { n: 'snout', s: [4, 3, 1], t: [32, 0], p: [0, 10, 8], c: [0, -0.5, 6.5], parent: 'head' },
      { n: 'legFR', s: [4, 6, 4], t: [0, 16], p: [-3, 6, 5], c: [0, -3, 0], a: 'legB' },
      { n: 'legFL', s: [4, 6, 4], t: [0, 16], p: [3, 6, 5], c: [0, -3, 0], a: 'legA' },
      { n: 'legBR', s: [4, 6, 4], t: [0, 16], p: [-3, 6, -5], c: [0, -3, 0], a: 'legA' },
      { n: 'legBL', s: [4, 6, 4], t: [0, 16], p: [3, 6, -5], c: [0, -3, 0], a: 'legB' },
    ],
    drops: (r) => [[I.RAW_PORK, 1 + Math.floor(r() * 3)]],
  },
  cow: {
    name: 'Cow', hw: 0.45, h: 1.4, hp: 10, speed: 1.4, ai: 'passive', sound: 'cow',
    parts: [
      { n: 'body', s: [12, 10, 18], t: [0, 14], p: [0, 17, 0], c: [0, 0, 0] },
      { n: 'head', s: [8, 8, 6], t: [0, 0], p: [0, 20, 9], c: [0, 0, 3], a: 'head' },
      { n: 'hornL', s: [1, 3, 1], t: [32, 0], p: [0, 20, 9], c: [4.5, 5.5, 1.5], parent: 'head' },
      { n: 'hornR', s: [1, 3, 1], t: [32, 0], p: [0, 20, 9], c: [-4.5, 5.5, 1.5], parent: 'head' },
      { n: 'muzzle', s: [6, 3, 1], t: [36, 0], p: [0, 20, 9], c: [0, -2.5, 6.5], parent: 'head' },
      { n: 'legFR', s: [4, 12, 4], t: [0, 42], p: [-4, 12, 7], c: [0, -6, 0], a: 'legB' },
      { n: 'legFL', s: [4, 12, 4], t: [0, 42], p: [4, 12, 7], c: [0, -6, 0], a: 'legA' },
      { n: 'legBR', s: [4, 12, 4], t: [0, 42], p: [-4, 12, -7], c: [0, -6, 0], a: 'legA' },
      { n: 'legBL', s: [4, 12, 4], t: [0, 42], p: [4, 12, -7], c: [0, -6, 0], a: 'legB' },
    ],
    drops: (r) => [[I.RAW_BEEF, 1 + Math.floor(r() * 3)]],
  },
  sheep: {
    name: 'Sheep', hw: 0.45, h: 1.3, hp: 8, speed: 1.4, ai: 'passive', sound: 'sheep',
    parts: [
      { n: 'body', s: [12, 10, 18], t: [0, 14], p: [0, 15, 0], c: [0, 0, 0] },
      { n: 'head', s: [6, 6, 8], t: [0, 0], p: [0, 18, 9], c: [0, 0, 3], a: 'head' },
      { n: 'legFR', s: [4, 10, 4], t: [0, 42], p: [-3, 10, 6], c: [0, -5, 0], a: 'legB' },
      { n: 'legFL', s: [4, 10, 4], t: [0, 42], p: [3, 10, 6], c: [0, -5, 0], a: 'legA' },
      { n: 'legBR', s: [4, 10, 4], t: [0, 42], p: [-3, 10, -6], c: [0, -5, 0], a: 'legA' },
      { n: 'legBL', s: [4, 10, 4], t: [0, 42], p: [3, 10, -6], c: [0, -5, 0], a: 'legB' },
    ],
    drops: (r) => [[B.WOOL, 1], [I.RAW_MUTTON, 1 + Math.floor(r() * 2)]],
  },
  chicken: {
    name: 'Chicken', hw: 0.2, h: 0.7, hp: 4, speed: 1.3, ai: 'passive', sound: 'chicken',
    parts: [
      { n: 'body', s: [6, 6, 8], t: [0, 0], p: [0, 8, 0], c: [0, 0, 0] },
      { n: 'head', s: [4, 6, 3], t: [0, 14], p: [0, 11, 4], c: [0, 2, 1], a: 'head' },
      { n: 'beak', s: [4, 2, 2], t: [14, 14], p: [0, 11, 4], c: [0, 1, 3.5], parent: 'head' },
      { n: 'wattle', s: [2, 2, 2], t: [26, 14], p: [0, 11, 4], c: [0, -1, 2.5], parent: 'head' },
      { n: 'legR', s: [1, 5, 1], t: [0, 24], p: [-1.5, 5, 0], c: [0, -2.5, 0], a: 'legA' },
      { n: 'legL', s: [1, 5, 1], t: [0, 24], p: [1.5, 5, 0], c: [0, -2.5, 0], a: 'legB' },
      { n: 'wingR', s: [1, 4, 6], t: [0, 30], p: [-3.5, 10, 0], c: [0, -2, 0], a: 'wingR' },
      { n: 'wingL', s: [1, 4, 6], t: [0, 30], p: [3.5, 10, 0], c: [0, -2, 0], a: 'wingL' },
    ],
    drops: (r) => [[I.RAW_CHICKEN, 1]],
  },
  zombie: {
    name: 'Zombie', hw: 0.3, h: 1.95, hp: 20, speed: 2.4, ai: 'zombie', hostile: true, sound: 'zombie', burns: true, parts: ZOMBIE_PARTS,
    drops: (r) => (r() < 0.8 ? [[I.ROTTEN_FLESH, 1 + Math.floor(r() * 2)]] : []),
  },
  skeleton: {
    name: 'Skeleton', hw: 0.3, h: 1.99, hp: 20, speed: 2.2, ai: 'skeleton', hostile: true, sound: 'skeleton', burns: true, parts: SKELETON_PARTS,
    drops: (r) => [[I.BONE, Math.floor(r() * 3)], [I.COAL, r() < 0.3 ? 1 : 0]].filter((d) => d[1] > 0),
  },
  creeper: {
    name: 'Creeper', hw: 0.3, h: 1.7, hp: 20, speed: 2.3, ai: 'creeper', hostile: true, sound: 'hiss',
    parts: [
      { n: 'head', s: [8, 8, 8], t: [0, 0], p: [0, 18, 0], c: [0, 4, 0], a: 'head' },
      { n: 'body', s: [8, 12, 4], t: [16, 16], p: [0, 12, 0], c: [0, 6, 0] },
      { n: 'legFR', s: [4, 6, 4], t: [0, 16], p: [-2, 6, 4], c: [0, -3, 0], a: 'legB' },
      { n: 'legFL', s: [4, 6, 4], t: [0, 16], p: [2, 6, 4], c: [0, -3, 0], a: 'legA' },
      { n: 'legBR', s: [4, 6, 4], t: [0, 16], p: [-2, 6, -4], c: [0, -3, 0], a: 'legA' },
      { n: 'legBL', s: [4, 6, 4], t: [0, 16], p: [2, 6, -4], c: [0, -3, 0], a: 'legB' },
    ],
    drops: (r) => (r() < 0.8 ? [[I.GUNPOWDER, 1 + Math.floor(r() * 2)]] : []),
  },
};

function buildModel(type) {
  const def = MOB_DEFS[type];
  const mat = new THREE.MeshBasicMaterial({ map: getSkin(type), side: THREE.FrontSide });
  const group = new THREE.Group();
  const pivots = {};
  const anim = [];
  for (const p of def.parts) {
    const mesh = new THREE.Mesh(makeBoxGeo(p.s, p.t, regsFn), mat);
    mesh.position.set(p.c[0] / 16, p.c[1] / 16, p.c[2] / 16);
    const pivot = new THREE.Group();
    pivots[p.n] = pivot;
    if (p.parent) {
      const pp = def.parts.find((q) => q.n === p.parent);
      pivot.position.set((p.p[0] - pp.p[0]) / 16, (p.p[1] - pp.p[1]) / 16, (p.p[2] - pp.p[2]) / 16);
      pivots[p.parent].add(pivot);
    } else {
      pivot.position.set(p.p[0] / 16, p.p[1] / 16, p.p[2] / 16);
      group.add(pivot);
    }
    pivot.add(mesh);
    if (p.a) anim.push({ role: p.a, pivot });
  }
  return { group, mat, anim, pivots };
}

// ---------------------------------------------------------------------------------------------
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Mob {
  constructor(game, type, x, y, z) {
    this.game = game;
    this.type = type;
    this.def = MOB_DEFS[type];
    const m = buildModel(type);
    this.model = m;
    this.mesh = m.group;
    this.mat = m.mat;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hw = this.def.hw; this.h = this.def.h;
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.hp = this.def.hp;
    this.onGround = false;
    this.walkPhase = Math.random() * 6;
    this.walkAmp = 0;
    this.state = 'idle';
    this.timer = 1 + Math.random() * 3;
    this.dirX = 0; this.dirZ = 0;
    this.hurtT = 0; this.fleeT = 0; this.dying = 0;
    this.attackCd = 0; this.shootCd = 1.5 + Math.random();
    this.fuse = 0; this.burn = 0; this.burnTick = 0;
    this.soundT = 4 + Math.random() * 12;
    this.swing = 0;
    this.stuckT = 0;
    this.lastX = x; this.lastZ = z;
    this.removed = false;
    this.age = 0;
    this.mesh.position.set(x, y, z);
  }

  serialize() { return { t: this.type, x: this.x, y: this.y, z: this.z, yaw: this.yaw, hp: this.hp }; }

  hurt(dmg, kx, kz, byPlayer = false) {
    if (this.dying > 0) return;
    this.hp -= dmg;
    this.hurtT = 0.35;
    this.vx += kx * 5.5; this.vz += kz * 5.5; this.vy = Math.max(this.vy, 4.2);
    this.onGround = false;
    const g = this.game;
    g.audio.play(this.def.hostile ? this.def.sound : this.def.sound, { pos: [this.x, this.y + 1, this.z], pitch: 1.25, vol: 0.9 });
    if (!this.def.hostile) { this.fleeT = 4; this.state = 'flee'; const l = Math.hypot(kx, kz) || 1; this.dirX = kx / l; this.dirZ = kz / l; }
    if (this.hp <= 0) this.die(byPlayer);
  }

  die(byPlayer) {
    this.dying = 0.55;
    const g = this.game;
    g.audio.play('death', { pos: [this.x, this.y + 1, this.z], vol: 0.6, pitch: 1.3 });
    const r = Math.random;
    const drops = this.def.drops(r);
    for (const [id, n] of drops) g.entities.spawnItem(this.x, this.y + 0.5, this.z, { id, count: n });
    g.particles.poof(this.x, this.y, this.z, 14);
    if (byPlayer) g.onMobKilled(this);
  }

  inLiquid(dy) {
    const b = this.game.world.getBlock(Math.floor(this.x), Math.floor(this.y + dy), Math.floor(this.z));
    return b === B.WATER || b === B.LAVA ? b : 0;
  }

  groundAhead(dx, dz, dist = 0.9) {
    const w = this.game.world;
    const x = Math.floor(this.x + dx * dist), z = Math.floor(this.z + dz * dist), y = Math.floor(this.y);
    for (let k = 0; k <= 3; k++) {
      if (w.isSolid(x, y - k, z)) return true;
      const b = w.getBlock(x, y - k, z);
      if (b === B.WATER) return false;
    }
    return false;
  }

  update(dt) {
    const g = this.game, w = g.world, p = g.player;
    if (this.dying > 0) {
      this.dying -= dt;
      this.mesh.rotation.z = Math.min(1, (0.55 - this.dying) * 3) * Math.PI / 2;
      this.mat.color.setRGB(1, 0.35, 0.35);
      if (this.dying <= 0) this.removed = true;
      return;
    }
    if (!w.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    const def = this.def;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swing = Math.max(0, this.swing - dt);
    const dx = p.x - this.x, dz = p.z - this.z, dy = (p.y + 0.9) - (this.y + this.h * 0.5);
    const d2 = Math.hypot(dx, dz);
    const target = !p.dead && !p.creative && def.hostile && g.settings.hostile;
    let speed = 0, wantJump = false, dirX = 0, dirZ = 0;

    // ---- behaviour ----
    if (def.ai === 'passive') {
      this.timer -= dt;
      if (this.state === 'flee') {
        this.fleeT -= dt;
        dirX = this.dirX; dirZ = this.dirZ; speed = def.speed * 2.1;
        if (this.fleeT <= 0) { this.state = 'idle'; this.timer = 1; }
      } else if (this.state === 'idle') {
        if (this.timer <= 0) {
          this.state = 'wander'; this.timer = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2; this.dirX = Math.sin(a); this.dirZ = Math.cos(a);
        }
      } else if (this.state === 'wander') {
        dirX = this.dirX; dirZ = this.dirZ; speed = def.speed;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = 1.5 + Math.random() * 4; }
        else if (!this.groundAhead(dirX, dirZ)) { this.state = 'idle'; this.timer = 1; speed = 0; }
      }
      if (this.state === 'flee' && !this.groundAhead(dirX, dirZ, 0.8)) { this.dirX = -this.dirX; this.dirZ = -this.dirZ; }
    } else {
      const detect = def.ai === 'skeleton' ? 20 : def.ai === 'creeper' ? 17 : 22;
      const chase = target && d2 < detect && Math.abs(dy) < 14;
      if (chase) {
        const ux = dx / (d2 || 1), uz = dz / (d2 || 1);
        if (def.ai === 'zombie') {
          dirX = ux; dirZ = uz; speed = d2 > 1.1 ? def.speed : 0;
          if (d2 < 1.6 && Math.abs(dy) < 1.9 && this.attackCd <= 0) {
            this.attackCd = 1.0; this.swing = 0.3;
            g.damagePlayer(3, 'was slain by Zombie', ux, uz, 5);
          }
        } else if (def.ai === 'skeleton') {
          this.shootCd -= dt;
          if (d2 > 11) { dirX = ux; dirZ = uz; speed = def.speed; }
          else if (d2 < 5.5) { dirX = -ux; dirZ = -uz; speed = def.speed * 0.9; }
          else { // strafe
            this.timer -= dt;
            if (this.timer <= 0) { this.timer = 1 + Math.random() * 2; this.strafe = Math.random() < 0.5 ? 1 : -1; }
            dirX = -uz * (this.strafe || 1); dirZ = ux * (this.strafe || 1); speed = def.speed * 0.6;
          }
          this.targetYaw = Math.atan2(dx, dz);
          if (this.shootCd <= 0 && d2 < 17) {
            const ox = this.x, oy = this.y + 1.5, oz = this.z;
            const tx = p.x, ty = p.y + 1.2, tz = p.z;
            const L = Math.hypot(tx - ox, ty - oy, tz - oz);
            const hit = w.raycast(ox, oy, oz, (tx - ox) / L, (ty - oy) / L, (tz - oz) / L, L - 0.5);
            if (!hit) {
              this.shootCd = 2 + Math.random() * 0.8; this.swing = 0.4;
              const sp = 22, t = L / sp;
              const jx = (Math.random() - 0.5) * 0.04 * L, jz = (Math.random() - 0.5) * 0.04 * L;
              g.entities.spawnArrow(ox, oy, oz, ((tx + jx) - ox) / t, ((ty - oy) / t) + 7 * t, ((tz + jz) - oz) / t, 3 + Math.floor(Math.random() * 2));
            } else this.shootCd = 0.5;
          }
        } else if (def.ai === 'creeper') {
          dirX = ux; dirZ = uz; speed = this.fuse > 0 ? def.speed * 0.2 : def.speed;
          if (d2 < 3 && Math.abs(dy) < 2.2) {
            if (this.fuse === 0) g.audio.play('hiss', { pos: [this.x, this.y, this.z] });
            this.fuse += dt;
            if (this.fuse >= 1.5) { this.removed = true; g.explode(this.x, this.y + 0.9, this.z, 3.2, this); return; }
          } else if (this.fuse > 0) this.fuse = Math.max(0, this.fuse - dt * 1.5);
        }
      } else {
        this.fuse = Math.max(0, this.fuse - dt);
        this.timer -= dt;
        if (this.state === 'idle') {
          if (this.timer <= 0) { this.state = 'wander'; this.timer = 2 + Math.random() * 3; const a = Math.random() * 6.28; this.dirX = Math.sin(a); this.dirZ = Math.cos(a); }
        } else {
          dirX = this.dirX; dirZ = this.dirZ; speed = def.speed * 0.5;
          if (this.timer <= 0 || !this.groundAhead(dirX, dirZ)) { this.state = 'idle'; this.timer = 2 + Math.random() * 3; speed = 0; }
        }
      }
    }

    // ---- sunlight burning ----
    if (def.burns) {
      const day = g.sky.sunElev > 0.2 && g.weather.rain < 0.4;
      if (day && w.getSky(Math.floor(this.x), Math.floor(this.y + this.h), Math.floor(this.z)) >= 15 && !this.inLiquid(0.2)) this.burn = 3;
      if (this.burn > 0) {
        this.burn -= dt; this.burnTick -= dt;
        if (Math.random() < dt * 12) g.particles.flame(this.x, this.y + this.h * 0.4, this.z, 1);
        if (Math.random() < dt * 4) g.particles.smoke(this.x, this.y + this.h, this.z, 1, 0.3, 0.12);
        if (this.burnTick <= 0) { this.burnTick = 1; this.hurt(1.5, 0, 0, false); if (this.dying > 0) return; }
      }
    }

    // ---- movement ----
    const inWater = this.inLiquid(0.3) !== 0;
    const lava = this.inLiquid(0.2) === B.LAVA;
    if (lava) { this.burn = 3; }
    if (speed > 0) {
      this.targetYaw = def.ai === 'skeleton' && target && d2 < 20 ? Math.atan2(dx, dz) : Math.atan2(dirX, dirZ);
      if (def.ai === 'skeleton' && target && d2 < 20 && d2 > 5.5 && d2 < 11) { /* strafe keeps facing */ }
    }
    const tvx = dirX * speed * (inWater ? 0.6 : 1), tvz = dirZ * speed * (inWater ? 0.6 : 1);
    const k = Math.min(1, dt * (this.onGround ? 10 : 2.5));
    this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    if (inWater) {
      this.vy += (1.8 - this.vy) * Math.min(1, dt * 4);
    } else this.vy -= 28 * dt;
    if (this.vy < -40) this.vy = -40;
    // jump over obstacles
    if (speed > 0 && this.onGround && (this.hitXPrev || this.hitZPrev)) wantJump = true;
    if (wantJump) { this.vy = 8.2; this.onGround = false; }
    moveBox(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
    this.hitXPrev = this.hitX; this.hitZPrev = this.hitZ;
    if (this.hitY) this.vy = 0;
    if (this.hitX) this.vx = 0;
    if (this.hitZ) this.vz = 0;
    if (this.y < -20) { this.removed = true; return; }
    // unstick: wander away if blocked while moving
    if (speed > 0) {
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        if (Math.hypot(this.x - this.lastX, this.z - this.lastZ) < 0.3 && def.ai === 'passive') { const a = Math.random() * 6.28; this.dirX = Math.sin(a); this.dirZ = Math.cos(a); }
        this.stuckT = 0; this.lastX = this.x; this.lastZ = this.z;
      }
    }

    // ---- ambient sounds ----
    this.soundT -= dt;
    if (this.soundT <= 0) {
      this.soundT = 6 + Math.random() * 14;
      if (d2 < 24 && (!def.hostile || target)) g.audio.play(def.sound, { pos: [this.x, this.y + 1, this.z], vol: 0.7 });
    }

    // ---- animation ----
    const sp = Math.hypot(this.vx, this.vz);
    this.walkPhase += sp * dt * 3.2;
    this.walkAmp += ((Math.min(1, sp / 1.8)) - this.walkAmp) * Math.min(1, dt * 10);
    const dyaw = angDiff(this.yaw, this.targetYaw);
    this.yaw += dyaw * Math.min(1, dt * 8);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.rotation.z = 0;
    const swing = Math.sin(this.walkPhase) * 0.9 * this.walkAmp;
    let headYaw = 0, headPitch = 0;
    if (d2 < 10 && Math.abs(dy) < 5) { headYaw = Math.max(-0.9, Math.min(0.9, angDiff(this.yaw, Math.atan2(dx, dz)))); headPitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(dy, d2 + 0.01) * 0.6)); }
    const sw = this.swing > 0 ? Math.sin((1 - this.swing / 0.35) * Math.PI) : 0;
    for (const a of this.model.anim) {
      const pv = a.pivot;
      switch (a.role) {
        case 'legA': pv.rotation.x = swing; break;
        case 'legB': pv.rotation.x = -swing; break;
        case 'head': pv.rotation.y = headYaw; pv.rotation.x = headPitch; break;
        case 'armR': if (def.ai === 'zombie') pv.rotation.x = -1.45 + Math.sin(this.walkPhase * 0.5) * 0.08 - sw * 0.5; else if (def.ai === 'skeleton') pv.rotation.x = -1.35 - sw * 0.2; break;
        case 'armL': if (def.ai === 'zombie') pv.rotation.x = -1.45 - Math.sin(this.walkPhase * 0.5) * 0.08 - sw * 0.5; else if (def.ai === 'skeleton') { pv.rotation.x = -1.2; pv.rotation.y = 0.35; } break;
        case 'wingR': pv.rotation.z = this.onGround ? 0 : -1.0 + Math.sin(this.age * 40) * 0.5; break;
        case 'wingL': pv.rotation.z = this.onGround ? 0 : 1.0 - Math.sin(this.age * 40) * 0.5; break;
        default: break;
      }
    }
    // light + flashes
    const L = g.lightAt(this.x, this.y + this.h * 0.5, this.z);
    let r = L, gg = L, b = L;
    if (this.hurtT > 0) { r = Math.min(1.5, L + 0.6); gg = L * 0.35; b = L * 0.35; }
    if (this.fuse > 0) {
      const f = Math.floor(this.fuse * 8) % 2 === 0 ? 1.8 : 1;
      r *= f; gg *= f; b *= f;
      const s = 1 + (this.fuse / 1.5) * 0.25;
      this.mesh.scale.set(s, 1 + (this.fuse / 1.5) * 0.15, s);
    } else this.mesh.scale.set(1, 1, 1);
    if (this.burn > 0) { gg *= 0.8; b *= 0.6; }
    this.mat.color.setRGB(r, gg, b);
    this.age += dt;
  }
}

// ---------------------------------------------------------------------------------------------
export class MobManager {
  constructor(game) {
    this.game = game;
    this.mobs = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.spawnTimer = 2;
    this.hostileTimer = 3;
  }

  clear() {
    for (const m of this.mobs) this.group.remove(m.mesh);
    this.mobs.length = 0;
  }

  spawn(type, x, y, z) {
    const m = new Mob(this.game, type, x, y, z);
    this.mobs.push(m);
    this.group.add(m.mesh);
    return m;
  }

  count(hostile) { let n = 0; for (const m of this.mobs) if (!!m.def.hostile === hostile && m.dying <= 0) n++; return n; }

  load(list) {
    for (const s of list || []) {
      if (!MOB_DEFS[s.t]) continue;
      const m = this.spawn(s.t, s.x, s.y, s.z);
      m.yaw = m.targetYaw = s.yaw || 0; m.hp = s.hp || m.hp;
    }
  }
  serialize() {
    const p = this.game.player;
    return this.mobs.filter((m) => m.dying <= 0 && Math.hypot(m.x - p.x, m.z - p.z) < 90).map((m) => m.serialize());
  }

  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null, bt = maxDist;
    for (const m of this.mobs) {
      if (m.dying > 0) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, m.x - m.hw, m.y, m.z - m.hw, m.x + m.hw, m.y + m.h, m.z + m.hw, bt);
      if (t >= 0 && t < bt) { bt = t; best = m; }
    }
    return best ? { mob: best, t: bt } : null;
  }

  update(dt) {
    const g = this.game, p = g.player;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < 96) m.update(dt);
      m.mesh.visible = d < g.world.rd * 16 + 8;
      let despawn = m.removed;
      if (!despawn && m.def.hostile && d > 70) despawn = true;
      if (!despawn && !m.def.hostile && d > 130 && Math.random() < dt * 0.1) despawn = true;
      if (!despawn && m.def.hostile && !g.settings.hostile) despawn = true;
      if (despawn) { this.group.remove(m.mesh); this.mobs.splice(i, 1); }
    }
    this.spawnTimer -= dt; this.hostileTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 3 + Math.random() * 3; if (this.count(false) < 18) this.trySpawnAnimals(); }
    if (this.hostileTimer <= 0) { this.hostileTimer = 2 + Math.random() * 2; if (g.settings.hostile && !p.creative && !p.dead && this.count(true) < 12) this.trySpawnHostile(); }
  }

  findSpot(minD, maxD) {
    const g = this.game, w = g.world, p = g.player;
    const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
    if (!w.isLoaded(x, z)) return null;
    const startY = Math.min(CH - 2, Math.max(2, Math.floor(p.y) + 20));
    for (let y = startY; y > 1; y--) {
      if (w.isSolid(x, y, z)) {
        if (!w.isSolid(x, y + 1, z) && !w.isSolid(x, y + 2, z) && w.getBlock(x, y + 1, z) === 0) return { x, y: y + 1, z, ground: w.getBlock(x, y, z) };
        if (y < Math.floor(p.y) - 14) return null;
      }
    }
    return null;
  }

  trySpawnAnimals() {
    const g = this.game, w = g.world;
    const s = this.findSpot(20, 54);
    if (!s || s.ground !== B.GRASS && s.ground !== B.SNOW_GRASS) return;
    if (w.getSky(s.x, s.y, s.z) < 12) return;
    const biome = w.getBiome(s.x, s.z);
    const table = {
      2: ['pig', 'cow', 'sheep', 'chicken'], 3: ['pig', 'cow', 'chicken'], 8: ['cow', 'sheep', 'sheep'], 5: ['sheep', 'cow', 'pig'], 6: ['sheep'],
    };
    const list = table[biome];
    if (!list) return;
    const type = list[Math.floor(Math.random() * list.length)];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const x = s.x + Math.floor((Math.random() - 0.5) * 5), z = s.z + Math.floor((Math.random() - 0.5) * 5);
      const y = s.y;
      if (w.isSolid(x, y - 1, z) && !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z) && w.getBlock(x, y, z) === 0) this.spawn(type, x + 0.5, y, z + 0.5);
    }
  }

  lightLevel(x, y, z) {
    const g = this.game, w = g.world;
    const sky = w.getSky(x, y, z) - Math.round(11 * (1 - Math.min(1, g.sky.daylight * 1.4)));
    return Math.max(w.getBlockLight(x, y, z), sky);
  }

  trySpawnHostile() {
    const g = this.game, w = g.world;
    const s = this.findSpot(22, 44);
    if (!s || s.y <= 1) return;
    if (this.lightLevel(s.x, s.y, s.z) > 7) return;
    if (w.getBlock(s.x, s.y - 1, s.z) === B.LEAVES) return;
    const r = Math.random();
    const underground = w.getSky(s.x, s.y, s.z) < 8;
    const type = r < 0.5 ? 'zombie' : r < (underground ? 0.85 : 0.75) ? 'skeleton' : 'creeper';
    this.spawn(type, s.x + 0.5, s.y, s.z + 0.5);
  }

  populate(n = 14) {
    for (let i = 0; i < n * 3 && this.count(false) < n; i++) this.trySpawnAnimals();
  }
}

