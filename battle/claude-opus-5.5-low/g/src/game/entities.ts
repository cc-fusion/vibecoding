import * as THREE from 'three';
import type { World } from './world';
import { ATLAS_TILES, FACE_TILES, BLOCKS, isBlockItem, getIcon, B, I } from './blocks';

export interface Body { pos: THREE.Vector3; vel: THREE.Vector3; w: number; h: number; onGround: boolean }

/** Axis-separated AABB movement against voxel world. Returns collision flags. */
export function moveBody(world: World, b: Body, dt: number, sneakGuard = false) {
  const hw = b.w / 2;
  let hitX = false, hitZ = false, hitY = false;
  const p = b.pos;
  const collides = (x: number, y: number, z: number) => world.boxCollides(x - hw, y, z - hw, x + hw, y + b.h, z + hw);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt / 0.4));
  const sdt = dt / steps;
  const wasGround = b.onGround;
  b.onGround = false;
  for (let s = 0; s < steps; s++) {
    // Y
    const dy = b.vel.y * sdt;
    if (dy) {
      if (collides(p.x, p.y + dy, p.z)) {
        if (dy < 0) { p.y = Math.floor(p.y + dy) + 1; b.onGround = true; if (collides(p.x, p.y, p.z)) p.y += 0; }
        else p.y = Math.ceil(p.y + b.h + dy) - 1 - b.h - 0.001;
        b.vel.y = 0; hitY = true;
      } else p.y += dy;
    }
    const guard = sneakGuard && (wasGround || b.onGround);
    const dx = b.vel.x * sdt;
    if (dx) {
      if (collides(p.x + dx, p.y, p.z) || (guard && !collides(p.x + dx, p.y - 0.6, p.z))) {
        hitX = true;
        if (!guard || collides(p.x + dx, p.y, p.z)) b.vel.x = 0;
        else b.vel.x = 0;
      } else p.x += dx;
    }
    const dz = b.vel.z * sdt;
    if (dz) {
      if (collides(p.x, p.y, p.z + dz) || (guard && !collides(p.x, p.y - 0.6, p.z + dz))) { hitZ = true; b.vel.z = 0; }
      else p.z += dz;
    }
  }
  if (!b.onGround && b.vel.y <= 0 && collides(p.x, p.y - 0.02, p.z)) b.onGround = true;
  return { hitX, hitZ, hitY };
}

export function blockGeometry(id: number, size: number) {
  const g = new THREE.BoxGeometry(size, size, size);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const ts = 1 / ATLAS_TILES;
  for (let f = 0; f < 6; f++) {
    const ti = FACE_TILES[id * 6 + f];
    const u0 = (ti % ATLAS_TILES) * ts, v0 = 1 - (Math.floor(ti / ATLAS_TILES) + 1) * ts;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, u0 + uv.getX(i) * ts, v0 + uv.getY(i) * ts);
    }
  }
  uv.needsUpdate = true;
  return g;
}

const iconTextures: Record<number, THREE.Texture> = {};
export function iconTexture(id: number) {
  if (!iconTextures[id]) {
    const t = new THREE.TextureLoader().load(getIcon(id));
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    iconTextures[id] = t;
  }
  return iconTextures[id];
}

export function itemObject(id: number, size: number, atlasMat: THREE.Material): THREE.Object3D {
  if (isBlockItem(id) && BLOCKS[id].render !== 'cross') return new THREE.Mesh(blockGeometry(id, size), atlasMat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 1.6), new THREE.MeshBasicMaterial({ map: iconTexture(id), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  return m;
}

// ---------------- Drops ----------------
export class Drop implements Body {
  pos: THREE.Vector3; vel: THREE.Vector3; w = 0.25; h = 0.25; onGround = false; age = 0;
  obj: THREE.Object3D;
  constructor(public id: number, public count: number, pos: THREE.Vector3, atlasMat: THREE.Material, public dur?: number) {
    this.pos = pos.clone();
    this.vel = new THREE.Vector3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3);
    this.obj = itemObject(id, 0.25, atlasMat);
  }
  update(world: World, dt: number) {
    this.age += dt;
    const inWater = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)) === B.WATER;
    this.vel.y -= (inWater ? 4 : 22) * dt;
    if (inWater) this.vel.y = Math.max(this.vel.y, -1);
    const f = this.onGround ? Math.pow(0.002, dt) : Math.pow(0.5, dt);
    this.vel.x *= f; this.vel.z *= f;
    // push out if stuck in a block
    if (world.boxCollides(this.pos.x - 0.12, this.pos.y, this.pos.z - 0.12, this.pos.x + 0.12, this.pos.y + 0.25, this.pos.z + 0.12)) this.pos.y += 4 * dt;
    else moveBody(world, this, dt);
    this.obj.position.set(this.pos.x, this.pos.y + 0.15 + Math.sin(this.age * 3) * 0.06, this.pos.z);
    this.obj.rotation.y = this.age * 1.5;
  }
}

// ---------------- Particles ----------------
export class Particles {
  max = 1200;
  pos = new Float32Array(this.max * 3);
  col = new Float32Array(this.max * 3);
  vel = new Float32Array(this.max * 3);
  life = new Float32Array(this.max);
  grav = new Float32Array(this.max);
  geo = new THREE.BufferGeometry();
  points: THREE.Points;
  next = 0;
  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    this.pos.fill(-9999);
  }
  emit(x: number, y: number, z: number, rgb: number[], n: number, speed = 3, gravity = 18, life = 0.8, spread = 0.4) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread * 2; this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread * 2; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread * 2;
      this.vel[i * 3] = (Math.random() - 0.5) * speed; this.vel[i * 3 + 1] = Math.random() * speed; this.vel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      const v = 0.75 + Math.random() * 0.35;
      this.col[i * 3] = rgb[0] / 255 * v; this.col[i * 3 + 1] = rgb[1] / 255 * v; this.col[i * 3 + 2] = rgb[2] / 255 * v;
      this.life[i] = life * (0.6 + Math.random() * 0.6); this.grav[i] = gravity;
    }
  }
  update(world: World, dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const nx = this.pos[i * 3] + this.vel[i * 3] * dt, ny = this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt, nz = this.pos[i * 3 + 2] + this.vel[i * 3 + 2] * dt;
      if (this.grav[i] > 0 && BLOCKS[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]?.solid) {
        this.vel[i * 3] *= 0.3; this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] *= 0.3;
      } else { this.pos[i * 3] = nx; this.pos[i * 3 + 1] = ny; this.pos[i * 3 + 2] = nz; }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------- Mobs ----------------
export type MobKind = 'pig' | 'sheep' | 'zombie' | 'cow';

function faceTexture(kind: MobKind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const c = cv.getContext('2d')!;
  const base = kind === 'pig' ? '#f0a0a0' : kind === 'sheep' ? '#d8c8b8' : kind === 'cow' ? '#4a3626' : '#5a8a4a';
  c.fillStyle = base; c.fillRect(0, 0, 8, 8);
  c.fillStyle = '#ffffff'; c.fillRect(1, 3, 2, 1); c.fillRect(5, 3, 2, 1);
  c.fillStyle = kind === 'zombie' ? '#202020' : '#000'; c.fillRect(kind === 'zombie' ? 1 : 2, 3, 1, 1); c.fillRect(kind === 'zombie' ? 6 : 5, 3, 1, 1);
  if (kind === 'pig') { c.fillStyle = '#e08080'; c.fillRect(2, 5, 4, 2); c.fillStyle = '#7a4040'; c.fillRect(2, 5, 1, 1); c.fillRect(5, 5, 1, 1); }
  if (kind === 'zombie') { c.fillStyle = '#3a5a30'; c.fillRect(2, 6, 4, 1); }
  if (kind === 'cow') { c.fillStyle = '#ddd'; c.fillRect(2, 5, 4, 3); c.fillStyle = '#222'; c.fillRect(3, 6, 1, 1); c.fillRect(5, 6, 1, 1); }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export class Mob implements Body {
  pos: THREE.Vector3; vel = new THREE.Vector3(); onGround = false;
  w: number; h: number; hp: number; maxHp: number;
  group = new THREE.Group();
  legs: THREE.Object3D[] = []; arms: THREE.Object3D[] = []; head!: THREE.Object3D;
  mats: { m: THREE.MeshLambertMaterial; base: THREE.Color }[] = [];
  yaw = Math.random() * Math.PI * 2; targetYaw = this.yaw;
  wanderTimer = 0; moving = false; walkPhase = 0; hurtTime = 0; fleeTime = 0;
  attackCd = 0; soundTimer = 5 + Math.random() * 10; dead = false; deathTime = 0; burnTimer = 0; fallStart = 0;
  constructor(public kind: MobKind, pos: THREE.Vector3) {
    this.pos = pos.clone();
    const humanoid = kind === 'zombie';
    this.w = humanoid ? 0.6 : 0.9; this.h = humanoid ? 1.8 : kind === 'cow' ? 1.3 : 0.9;
    this.maxHp = this.hp = humanoid ? 20 : kind === 'sheep' ? 8 : 10;
    const mat = (c: string, map?: THREE.Texture) => {
      const m = new THREE.MeshLambertMaterial(map ? { color: c, map } : { color: c });
      this.mats.push({ m, base: new THREE.Color(c) });
      return m;
    };
    const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, pivotTop = false) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (pivotTop) g.translate(0, -h / 2, 0);
      const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z);
      this.group.add(mesh); return mesh;
    };
    if (humanoid) {
      const skin = mat('#5a8a4a'), shirt = mat('#2f8a8a'), pants = mat('#3a3a9a');
      const face = mat('#ffffff', faceTexture(kind));
      this.head = box(0.5, 0.5, 0.5, [skin, skin, skin, skin, face, skin], 0, 1.55, 0);
      box(0.5, 0.75, 0.28, shirt, 0, 0.95 + 0.0, 0);
      this.legs = [box(0.24, 0.72, 0.24, pants, -0.13, 0.72, 0, true), box(0.24, 0.72, 0.24, pants, 0.13, 0.72, 0, true)];
      this.arms = [box(0.22, 0.72, 0.22, skin, -0.37, 1.32, 0, true), box(0.22, 0.72, 0.22, skin, 0.37, 1.32, 0, true)];
      this.arms.forEach(a => (a.rotation.x = -Math.PI / 2));
    } else {
      const colors: Record<string, [string, string]> = { pig: ['#f0a0a0', '#f0a0a0'], sheep: ['#eeeeee', '#d8c8b8'], cow: ['#4a3626', '#4a3626'] };
      const [bodyC, headC] = colors[kind];
      const body = mat(bodyC), headM = mat(headC), face = mat('#ffffff', faceTexture(kind));
      const legM = mat(kind === 'sheep' ? '#d8c8b8' : bodyC);
      const bh = kind === 'cow' ? 0.7 : 0.55, legH = kind === 'cow' ? 0.6 : 0.35;
      box(0.75, bh, 1.1, body, 0, legH + bh / 2, 0);
      if (kind === 'cow') { const spot = mat('#eeeeee'); box(0.77, 0.3, 0.4, spot, 0, legH + 0.45, 0.1); }
      this.head = box(0.5, 0.5, 0.45, [headM, headM, headM, headM, face, headM], 0, legH + bh - 0.05, 0.7);
      const lx = 0.24, lz = 0.38;
      this.legs = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z]) => box(0.22, legH, 0.22, legM, x, legH, z, true));
    }
    this.group.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  }
  setLight(f: number) {
    for (const { m, base } of this.mats) {
      m.color.copy(base).multiplyScalar(f);
      if (this.hurtTime > 0) m.color.lerp(new THREE.Color(1, 0.2, 0.2), 0.6);
    }
  }
  drops(): [number, number][] {
    const r = Math.random();
    switch (this.kind) {
      case 'pig': return [[I.RAW_PORK, 1 + (r < 0.5 ? 1 : 0)]];
      case 'sheep': return [[B.WOOL, 1], [I.RAW_MUTTON, 1]];
      case 'cow': return [[I.RAW_MUTTON, 2]];
      case 'zombie': return r < 0.7 ? [[I.ROTTEN_FLESH, 1 + (r < 0.3 ? 1 : 0)]] : r < 0.75 ? [[I.IRON_INGOT, 1]] : [];
    }
  }
}

// ---------------- TNT ----------------
export class PrimedTNT implements Body {
  pos: THREE.Vector3; vel = new THREE.Vector3(0, 5, 0); w = 0.98; h = 0.98; onGround = false; fuse = 3;
  mesh: THREE.Mesh;
  constructor(pos: THREE.Vector3, atlasMat: THREE.Material) {
    this.pos = pos.clone();
    this.mesh = new THREE.Mesh(blockGeometry(B.TNT, 0.98), (atlasMat as THREE.MeshBasicMaterial).clone());
  }
}
