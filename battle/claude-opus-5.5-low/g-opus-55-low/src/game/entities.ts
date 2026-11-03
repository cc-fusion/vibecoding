import * as THREE from 'three';
import { BLOCKS, I, isBlock, ITEMS, tileUV, B, buildAtlas, tileOf, ATLAS_COLS, TILE } from './blocks';
import { isSolid, isLiquid } from './world';

export interface WorldAccess {
  getBlock(x: number, y: number, z: number): number;
  heightAt(x: number, z: number): number;
}

export interface Body { pos: THREE.Vector3; vel: THREE.Vector3; hw: number; h: number; onGround: boolean; hitWall: boolean; inWater: boolean }

const EPS = 1e-4;
export function collides(w: WorldAccess, p: THREE.Vector3, hw: number, h: number) {
  const x0 = Math.floor(p.x - hw), x1 = Math.floor(p.x + hw - EPS);
  const y0 = Math.floor(p.y), y1 = Math.floor(p.y + h - EPS);
  const z0 = Math.floor(p.z - hw), z1 = Math.floor(p.z + hw - EPS);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (isSolid(w.getBlock(x, y, z))) return true;
  return false;
}

export function moveBody(w: WorldAccess, b: Body, dt: number, sneakGuard = false) {
  const d = b.vel.clone().multiplyScalar(dt);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)) / 0.4));
  d.divideScalar(steps);
  b.onGround = false; b.hitWall = false;
  for (let s = 0; s < steps; s++) {
    // Y
    b.pos.y += d.y;
    if (collides(w, b.pos, b.hw, b.h)) {
      if (d.y < 0) { b.pos.y = Math.floor(b.pos.y) + 1; b.onGround = true; }
      else b.pos.y = Math.ceil(b.pos.y + b.h) - 1 - b.h - EPS;
      b.vel.y = 0; d.y = 0;
    }
    for (const ax of ['x', 'z'] as const) {
      const prev = b.pos[ax];
      b.pos[ax] += d[ax];
      if (collides(w, b.pos, b.hw, b.h)) {
        b.pos[ax] = prev; b.vel[ax] = 0; d[ax] = 0; b.hitWall = true;
      } else if (sneakGuard && b.onGround) {
        // don't walk off edges while sneaking
        const test = b.pos.clone(); test.y -= 0.6;
        if (!collides(w, test, b.hw, 0.55)) { b.pos[ax] = prev; b.vel[ax] = 0; d[ax] = 0; }
      }
    }
  }
  if (!b.onGround) { const t = b.pos.clone(); t.y -= 0.02; if (collides(w, t, b.hw, 0.01) && b.vel.y <= 0) b.onGround = true; }
  const fb = w.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y + 0.4), Math.floor(b.pos.z));
  b.inWater = isLiquid(fb);
}

// -------------------------------------------------------------- textures for mobs
function faceTex(draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noisyTex(base: string, spots: string[] = [], n = 0) {
  return faceTex((c) => {
    c.fillStyle = base; c.fillRect(0, 0, 8, 8);
    for (let i = 0; i < 64; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.fillRect(i % 8, Math.floor(i / 8), 1, 1); }
    for (let i = 0; i < n; i++) { c.fillStyle = spots[i % spots.length]; c.fillRect(Math.floor(Math.random() * 7), Math.floor(Math.random() * 7), 2 + Math.floor(Math.random() * 2), 2); }
  });
}

export type MobType = 'pig' | 'cow' | 'sheep' | 'zombie';
interface MobSpec { hp: number; speed: number; hw: number; h: number; hostile: boolean; drops: () => [number, number][] }
export const MOB_SPECS: Record<MobType, MobSpec> = {
  pig: { hp: 10, speed: 1.6, hw: 0.45, h: 0.9, hostile: false, drops: () => [[I.RAW_PORK, 1 + Math.floor(Math.random() * 2)]] },
  cow: { hp: 10, speed: 1.4, hw: 0.45, h: 1.3, hostile: false, drops: () => [[I.RAW_BEEF, 1 + Math.floor(Math.random() * 2)], [I.LEATHER, Math.floor(Math.random() * 2)]] },
  sheep: { hp: 8, speed: 1.5, hw: 0.45, h: 1.2, hostile: false, drops: () => [[B.WOOL, 1], [I.MUTTON, 1 + Math.floor(Math.random() * 2)]] },
  zombie: { hp: 20, speed: 2.6, hw: 0.3, h: 1.85, hostile: true, drops: () => [[I.ROTTEN_FLESH, Math.floor(Math.random() * 3)], ...(Math.random() < 0.06 ? [[I.IRON_INGOT, 1] as [number, number]] : [])] },
};

const texCache: Record<string, THREE.Texture> = {};
const tex = (k: string, f: () => THREE.Texture) => (texCache[k] ??= f());

function boxMesh(w: number, h: number, d: number, mats: THREE.Material | THREE.Material[]) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}
function lam(t: THREE.Texture) { return new THREE.MeshLambertMaterial({ map: t }); }

export class Mob implements Body {
  pos: THREE.Vector3; vel = new THREE.Vector3(); hw: number; h: number; onGround = false; hitWall = false; inWater = false;
  hp: number; group = new THREE.Group(); legs: THREE.Object3D[] = []; head!: THREE.Object3D;
  yaw = Math.random() * Math.PI * 2; targetYaw = this.yaw; wanderT = 0; moving = false; walkPhase = 0;
  hurtT = 0; fleeT = 0; attackCD = 0; soundT = 5 + Math.random() * 10; dead = false; deathT = 0; burnT = 0;
  mats: THREE.MeshLambertMaterial[] = [];
  constructor(public type: MobType, x: number, y: number, z: number) {
    const s = MOB_SPECS[type];
    this.pos = new THREE.Vector3(x, y, z); this.hw = s.hw; this.h = s.h; this.hp = s.hp;
    this.build();
  }
  private build() {
    const g = this.group;
    const t = this.type;
    const addLeg = (x: number, z: number, w: number, h: number, m: THREE.Material, y = h) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, z);
      const leg = boxMesh(w, h, w, m); leg.position.y = -h / 2; pivot.add(leg); g.add(pivot); this.legs.push(pivot);
    };
    if (t === 'pig' || t === 'cow' || t === 'sheep') {
      const bodyT = t === 'pig' ? tex('pig', () => noisyTex('#f0a8a0')) : t === 'cow' ? tex('cow', () => noisyTex('#4a3222', ['#f2f2f2'], 5)) : tex('wool', () => noisyTex('#ecebe6', ['#d6d4cc'], 8));
      const bm = lam(bodyT); this.mats.push(bm);
      const legH = t === 'pig' ? 0.35 : 0.55;
      const bodyH = t === 'pig' ? 0.55 : 0.7;
      const body = boxMesh(t === 'sheep' ? 0.85 : 0.75, bodyH, 1.15, bm); body.position.y = legH + bodyH / 2; g.add(body);
      const legM = t === 'sheep' ? lam(tex('sheepleg', () => noisyTex('#d8c8b0'))) : bm; if (legM !== bm) this.mats.push(legM as THREE.MeshLambertMaterial);
      for (const [x, z] of [[-0.22, 0.38], [0.22, 0.38], [-0.22, -0.38], [0.22, -0.38]]) addLeg(x, z, 0.24, legH, legM);
      const faceT = tex(t + 'face', () => faceTex((c) => {
        c.fillStyle = t === 'pig' ? '#f0a8a0' : t === 'cow' ? '#4a3222' : '#d8c8b0'; c.fillRect(0, 0, 8, 8);
        c.fillStyle = '#fff'; c.fillRect(1, 2, 2, 1); c.fillRect(5, 2, 2, 1);
        c.fillStyle = '#111'; c.fillRect(2, 2, 1, 1); c.fillRect(5, 2, 1, 1);
        if (t === 'pig') { c.fillStyle = '#e07a80'; c.fillRect(2, 4, 4, 3); c.fillStyle = '#7a3030'; c.fillRect(2, 5, 1, 1); c.fillRect(5, 5, 1, 1); }
        if (t === 'cow') { c.fillStyle = '#c8b0a0'; c.fillRect(1, 5, 6, 3); c.fillStyle = '#222'; c.fillRect(2, 6, 1, 1); c.fillRect(5, 6, 1, 1); }
        if (t === 'sheep') { c.fillStyle = '#c0a8a0'; c.fillRect(3, 5, 2, 2); }
      }));
      const headSide = t === 'sheep' ? lam(tex('sheephead', () => noisyTex('#d8c8b0'))) : bm;
      const fm = lam(faceT); this.mats.push(fm); if (headSide !== bm) this.mats.push(headSide as THREE.MeshLambertMaterial);
      const hs = t === 'pig' ? 0.5 : 0.45;
      const head = boxMesh(hs, hs, hs, [headSide, headSide, headSide, headSide, fm, headSide]);
      const hp = new THREE.Group(); hp.position.set(0, legH + bodyH * 0.75, 0.6); head.position.z = hs / 2 - 0.05; hp.add(head); g.add(hp); this.head = hp;
      if (t === 'cow') { const hm = new THREE.MeshLambertMaterial({ color: '#d8d0b8' }); for (const x of [-0.25, 0.25]) { const horn = boxMesh(0.08, 0.15, 0.08, hm); horn.position.set(x, 0.28, 0.2); hp.add(horn); } }
    } else {
      const skin = lam(tex('zskin', () => noisyTex('#5a8a4a'))), shirt = lam(tex('zshirt', () => noisyTex('#2aa8a8'))), pants = lam(tex('zpants', () => noisyTex('#3a3a9a')));
      this.mats.push(skin, shirt, pants);
      const faceT = tex('zface', () => faceTex((c) => {
        c.fillStyle = '#5a8a4a'; c.fillRect(0, 0, 8, 8); c.fillStyle = '#1a2a12'; c.fillRect(1, 3, 2, 1); c.fillRect(5, 3, 2, 1);
        c.fillStyle = '#2f4a26'; c.fillRect(2, 5, 4, 1); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, 0, 8, 2);
      }));
      const fm = lam(faceT); this.mats.push(fm);
      for (const x of [-0.13, 0.13]) addLeg(x, 0, 0.25, 0.75, pants);
      const body = boxMesh(0.52, 0.72, 0.28, shirt); body.position.y = 0.75 + 0.36; g.add(body);
      for (const x of [-0.38, 0.38]) {
        const pivot = new THREE.Group(); pivot.position.set(x, 1.4, 0);
        const arm = boxMesh(0.24, 0.24, 0.72, skin); arm.position.z = 0.32; pivot.add(arm); g.add(pivot);
      }
      const head = boxMesh(0.48, 0.48, 0.48, [skin, skin, skin, skin, fm, skin]); head.position.y = 0.24;
      const hp = new THREE.Group(); hp.position.y = 1.47; hp.add(head); g.add(hp); this.head = hp;
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  }
  updateVisual(dt: number, sun: number) {
    this.group.position.copy(this.pos);
    let dy = this.targetYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 6);
    this.group.rotation.y = this.yaw;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += sp * dt * 3.2;
    const sw = Math.sin(this.walkPhase) * Math.min(1, sp) * 0.7;
    this.legs.forEach((l, i) => (l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw)));
    const flash = this.hurtT > 0 ? 1 : 0;
    const light = 0.35 + sun * 0.65;
    for (const m of this.mats) { m.emissive.setRGB(flash * 0.6, 0, 0); m.color.setScalar(1).multiplyScalar(light < 1 ? 1 : 1); }
    if (this.dead) { this.group.rotation.z = Math.min(Math.PI / 2, this.deathT * 6); }
  }
}

// -------------------------------------------------------------- dropped items
export class Drop implements Body {
  pos: THREE.Vector3; vel: THREE.Vector3; hw = 0.12; h = 0.25; onGround = false; hitWall = false; inWater = false;
  age = 0; mesh: THREE.Object3D;
  constructor(public id: number, public count: number, p: THREE.Vector3, v?: THREE.Vector3, public dur?: number) {
    this.pos = p.clone(); this.vel = v ?? new THREE.Vector3((Math.random() - 0.5) * 3, 3.5, (Math.random() - 0.5) * 3);
    this.mesh = itemMesh(id, 0.25);
  }
}

const geoCache: Record<string, THREE.BufferGeometry> = {};
let sharedLam: THREE.MeshLambertMaterial | null = null;
export function atlasLambert(map: THREE.Texture) {
  if (!sharedLam) sharedLam = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  return sharedLam;
}
let atlasRef: THREE.Texture;
export function setAtlas(t: THREE.Texture) { atlasRef = t; }

export function blockGeometry(id: number, size: number) {
  const key = id + ':' + size;
  if (geoCache[key]) return geoCache[key];
  const def = BLOCKS[id];
  let g: THREE.BufferGeometry;
  if (def.cross || !isBlock(id)) {
    g = new THREE.PlaneGeometry(size, size);
    const uv = tileUV(isBlock(id) ? def.tiles[0] : ITEMS[id].tile);
    const a = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) ? uv[2] : uv[0], a.getY(i) ? uv[3] : uv[1]);
  } else {
    g = new THREE.BoxGeometry(size, size, size);
    const a = g.attributes.uv as THREE.BufferAttribute;
    const faces = [def.tiles[2], def.tiles[2], def.tiles[0], def.tiles[1], def.tiles[2], def.tiles[2]];
    for (let f = 0; f < 6; f++) {
      const uv = tileUV(faces[f]);
      for (let v = 0; v < 4; v++) { const i = f * 4 + v; a.setXY(i, a.getX(i) ? uv[2] : uv[0], a.getY(i) ? uv[3] : uv[1]); }
    }
  }
  geoCache[key] = g;
  return g;
}
export function itemMesh(id: number, size: number) {
  return new THREE.Mesh(blockGeometry(id, size), atlasLambert(atlasRef));
}

// -------------------------------------------------------------- particles
const MAXP = 800;
export class Particles {
  mesh: THREE.InstancedMesh;
  pos = new Float32Array(MAXP * 3); vel = new Float32Array(MAXP * 3); life = new Float32Array(MAXP); size = new Float32Array(MAXP);
  grav = new Float32Array(MAXP);
  n = 0;
  private dummy = new THREE.Object3D();
  private colorCache: Record<string, THREE.Color[]> = {};
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
  }
  tileColors(tile: string) {
    if (this.colorCache[tile]) return this.colorCache[tile];
    const cv = buildAtlas(); const ctx = cv.getContext('2d')!;
    const i = tileOf(tile);
    const d = ctx.getImageData((i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE, TILE, TILE).data;
    const out: THREE.Color[] = [];
    for (let k = 0; k < 256; k += 7) if (d[k * 4 + 3] > 100) out.push(new THREE.Color().setRGB(d[k * 4] / 255, d[k * 4 + 1] / 255, d[k * 4 + 2] / 255, THREE.SRGBColorSpace));
    if (!out.length) out.push(new THREE.Color(1, 1, 1));
    return (this.colorCache[tile] = out);
  }
  emit(x: number, y: number, z: number, cols: THREE.Color[], count: number, speed = 2.5, size = 0.1, grav = 14, life = 0.8, light = 1) {
    for (let k = 0; k < count; k++) {
      const i = this.n < MAXP ? this.n++ : Math.floor(Math.random() * MAXP);
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.8; this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.8; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
      this.vel[i * 3] = (Math.random() - 0.5) * speed; this.vel[i * 3 + 1] = Math.random() * speed * 1.2; this.vel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      this.life[i] = life * (0.6 + Math.random() * 0.6); this.size[i] = size * (0.6 + Math.random() * 0.8); this.grav[i] = grav;
      const c = cols[Math.floor(Math.random() * cols.length)].clone().multiplyScalar(light);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  blockBurst(id: number, x: number, y: number, z: number, count: number, light: number) {
    const t = BLOCKS[id]?.tiles[2] ?? 'stone';
    this.emit(x + 0.5, y + 0.5, z + 0.5, this.tileColors(t), count, 3, 0.1, 16, 0.9, light);
  }
  update(dt: number, w: WorldAccess) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap with last
        const j = --this.n;
        for (let a = 0; a < 3; a++) { this.pos[i * 3 + a] = this.pos[j * 3 + a]; this.vel[i * 3 + a] = this.vel[j * 3 + a]; }
        this.life[i] = this.life[j]; this.size[i] = this.size[j]; this.grav[i] = this.grav[j];
        const c = new THREE.Color(); this.mesh.getColorAt(j, c); this.mesh.setColorAt(i, c);
        i--; continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const nx = this.pos[i * 3] + this.vel[i * 3] * dt, ny = this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt, nz = this.pos[i * 3 + 2] + this.vel[i * 3 + 2] * dt;
      if (this.grav[i] > 0 && isSolid(w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) { this.vel[i * 3] *= 0.3; this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] *= 0.3; }
      else { this.pos[i * 3] = nx; this.pos[i * 3 + 1] = ny; this.pos[i * 3 + 2] = nz; }
      this.dummy.position.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.dummy.scale.setScalar(this.size[i] * Math.min(1, this.life[i] * 3));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
