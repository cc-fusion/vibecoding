// Item drop entities and block-break particles.
import * as THREE from "three";
import { B, BLOCKS, isBlock, itemTexture } from "./blocks";
import type { Atlas } from "./textures";
import { TILE, ATLAS_COLS } from "./textures";
import type { World } from "./world";
import type { Stack } from "./inventory";
import { LIGHT_CURVE } from "./mesher";

const geoCache = new Map<number, THREE.BufferGeometry>();

function itemGeometry(id: number, atlas: Atlas): THREE.BufferGeometry {
  let g = geoCache.get(id);
  if (g) return g;
  if (isBlock(id) && BLOCKS[id].model !== "cross") {
    const def = BLOCKS[id];
    const s = 0.14;
    const faces = [
      { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], sh: 0.8 },
      { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], sh: 0.8 },
      { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], sh: 1.0 },
      { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], sh: 0.5 },
      { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], sh: 0.9 },
      { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], sh: 0.9 },
    ];
    const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    faces.forEach((f, fi) => {
      const t = atlas.tileUV(def.tex[fi]);
      const base = fi * 4;
      f.v.forEach((c) => {
        pos.push((c[0] - 0.5) * 2 * s, (c[1] - 0.5) * 2 * s, (c[2] - 0.5) * 2 * s);
        let u: number, v: number;
        if (fi === 2 || fi === 3) { u = c[0]; v = c[2]; } else { u = fi < 2 ? c[2] : c[0]; v = 1 - c[1]; }
        uv.push(t[0] + u * (t[2] - t[0]), t[1] + v * (t[3] - t[1]));
        col.push(f.sh, f.sh, f.sh);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
  } else {
    const t = atlas.tileUV(itemTexture(id));
    const s = 0.18;
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([t[0], t[3], t[2], t[3], t[2], t[1], t[0], t[1]], 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
  }
  geoCache.set(id, g);
  return g;
}

export class ItemDrop {
  mesh: THREE.Mesh;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  age = 0;
  pickupDelay: number;
  material: THREE.MeshBasicMaterial;
  constructor(public stack: Stack, pos: THREE.Vector3, vel: THREE.Vector3, atlas: Atlas, baseMat: THREE.MeshBasicMaterial, pickupDelay = 0.6) {
    this.material = baseMat.clone();
    this.mesh = new THREE.Mesh(itemGeometry(stack.id, atlas), this.material);
    this.pos.copy(pos);
    this.mesh.position.copy(pos);
    this.vel.copy(vel);
    this.pickupDelay = pickupDelay;
    this.mesh.rotation.y = Math.random() * Math.PI * 2;
  }
}

export class DropManager {
  drops: ItemDrop[] = [];
  private baseMat: THREE.MeshBasicMaterial;
  private lightTimer = 0;
  constructor(private scene: THREE.Scene, private atlas: Atlas) {
    this.baseMat = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide });
  }

  spawn(stack: Stack, x: number, y: number, z: number, vel?: THREE.Vector3, pickupDelay = 0.6) {
    const v = vel ?? new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3);
    const d = new ItemDrop(stack, new THREE.Vector3(x, y, z), v, this.atlas, this.baseMat, pickupDelay);
    this.drops.push(d);
    this.scene.add(d.mesh);
    if (this.drops.length > 250) this.remove(this.drops[0]);
  }

  remove(d: ItemDrop) {
    const i = this.drops.indexOf(d);
    if (i >= 0) this.drops.splice(i, 1);
    this.scene.remove(d.mesh);
    d.material.dispose();
  }

  clear() {
    for (const d of [...this.drops]) this.remove(d);
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, tryPickup: (s: Stack) => boolean, time: number) {
    this.lightTimer -= dt;
    const doLight = this.lightTimer <= 0;
    if (doLight) this.lightTimer = 0.25;
    for (const d of [...this.drops]) {
      d.age += dt;
      d.pickupDelay -= dt;
      if (d.age > 300) {
        this.remove(d);
        continue;
      }
      const p = d.pos;
      // magnet toward player
      const dx = playerPos.x - p.x, dy = playerPos.y + 0.9 - p.y, dz = playerPos.z - p.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d.pickupDelay <= 0 && dist < 2.2) {
        const pull = 12 * dt;
        p.x += (dx / dist) * pull;
        p.y += (dy / dist) * pull;
        p.z += (dz / dist) * pull;
        if (dist < 0.9) {
          if (tryPickup(d.stack)) {
            this.remove(d);
            continue;
          }
        }
      }
      // physics
      d.vel.y -= 18 * dt;
      if (d.vel.y < -30) d.vel.y = -30;
      const bx = Math.floor(p.x), bz = Math.floor(p.z);
      const inLiquid = BLOCKS[world.getBlock(bx, Math.floor(p.y), bz)].model === "liquid";
      if (inLiquid) {
        d.vel.y = Math.max(d.vel.y, 0.8);
        d.vel.x *= 0.95;
        d.vel.z *= 0.95;
      }
      // burn in lava
      if (world.getBlock(bx, Math.floor(p.y), bz) === B.LAVA) {
        this.remove(d);
        continue;
      }
      let ny = p.y + d.vel.y * dt;
      const r = 0.15;
      if (d.vel.y < 0 && world.isSolid(bx, Math.floor(ny - r), bz)) {
        ny = Math.floor(ny - r) + 1 + r;
        d.vel.y = 0;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      } else if (d.vel.y > 0 && world.isSolid(bx, Math.floor(ny + r), bz)) {
        d.vel.y = 0;
      }
      p.y = ny;
      const nx = p.x + d.vel.x * dt, nz = p.z + d.vel.z * dt;
      if (!world.isSolid(Math.floor(nx), Math.floor(p.y), bz)) p.x = nx; else d.vel.x = 0;
      if (!world.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(nz))) p.z = nz; else d.vel.z = 0;
      // stuck inside a block? push up
      if (world.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) p.y += 2 * dt;

      d.mesh.rotation.y += dt * 1.5;
      const bob = Math.sin(time * 2 + d.age) * 0.04;
      d.mesh.position.set(p.x, p.y + 0.12 + bob, p.z);
      if (doLight) {
        const l = world.getLight(bx, Math.floor(p.y + 0.5), bz);
        const b = Math.max(LIGHT_CURVE[l >> 4] * this.sunLight, LIGHT_CURVE[l & 15]);
        d.material.color.setScalar(0.1 + 0.9 * b);
      }
    }
  }
  sunLight = 1;
}

// ---------------- particles ----------------

const MAX_PARTICLES = 600;

export class ParticleSystem {
  points: THREE.Points;
  private pos = new Float32Array(MAX_PARTICLES * 3);
  private col = new Float32Array(MAX_PARTICLES * 3);
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES);
  private count = 0;
  private colorCache = new Map<string, [number, number, number][]>();
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene, private atlas: Atlas) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  private colorsFor(tex: string): [number, number, number][] {
    let c = this.colorCache.get(tex);
    if (c) return c;
    const idx = this.atlas.index.get(tex) ?? 0;
    const ctx = this.atlas.canvas.getContext("2d")!;
    const img = ctx.getImageData((idx % ATLAS_COLS) * TILE, Math.floor(idx / ATLAS_COLS) * TILE, TILE, TILE).data;
    c = [];
    // convert sRGB texel values to linear for the renderer
    const lin = (v: number) => Math.pow(v / 255, 2.2);
    for (let i = 0; i < img.length; i += 4) if (img[i + 3] > 128) c.push([lin(img[i]), lin(img[i + 1]), lin(img[i + 2])]);
    if (c.length === 0) c.push([0.5, 0.5, 0.5]);
    this.colorCache.set(tex, c);
    return c;
  }

  burst(x: number, y: number, z: number, blockId: number, n: number, brightness: number, dir?: [number, number, number]) {
    const def = BLOCKS[blockId] ?? BLOCKS[1];
    const cols = this.colorsFor(def.tex[0]);
    for (let i = 0; i < n; i++) {
      if (this.count >= MAX_PARTICLES) this.count = 0; // wrap around
      const k = this.count++;
      const c = cols[Math.floor(Math.random() * cols.length)];
      this.col[k * 3] = c[0] * brightness;
      this.col[k * 3 + 1] = c[1] * brightness;
      this.col[k * 3 + 2] = c[2] * brightness;
      if (dir) {
        // spawn on the face surface
        const ox = dir[0] !== 0 ? (dir[0] > 0 ? 1.02 : -0.02) : Math.random();
        const oy = dir[1] !== 0 ? (dir[1] > 0 ? 1.02 : -0.02) : Math.random();
        const oz = dir[2] !== 0 ? (dir[2] > 0 ? 1.02 : -0.02) : Math.random();
        this.pos[k * 3] = x + ox;
        this.pos[k * 3 + 1] = y + oy;
        this.pos[k * 3 + 2] = z + oz;
        this.vel[k * 3] = dir[0] * 2 + (Math.random() - 0.5) * 2;
        this.vel[k * 3 + 1] = dir[1] * 2 + Math.random() * 2;
        this.vel[k * 3 + 2] = dir[2] * 2 + (Math.random() - 0.5) * 2;
      } else {
        this.pos[k * 3] = x + Math.random();
        this.pos[k * 3 + 1] = y + Math.random();
        this.pos[k * 3 + 2] = z + Math.random();
        this.vel[k * 3] = (Math.random() - 0.5) * 4;
        this.vel[k * 3 + 1] = Math.random() * 4 + 1;
        this.vel[k * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      this.life[k] = 0.5 + Math.random() * 0.6;
    }
  }

  update(dt: number, world: World) {
    let alive = 0;
    for (let k = 0; k < MAX_PARTICLES; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) {
        this.pos[k * 3 + 1] = -1000;
        continue;
      }
      alive = k + 1;
      this.vel[k * 3 + 1] -= 16 * dt;
      const nx = this.pos[k * 3] + this.vel[k * 3] * dt;
      const ny = this.pos[k * 3 + 1] + this.vel[k * 3 + 1] * dt;
      const nz = this.pos[k * 3 + 2] + this.vel[k * 3 + 2] * dt;
      if (world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        this.vel[k * 3] *= 0.5;
        this.vel[k * 3 + 2] *= 0.5;
        if (this.vel[k * 3 + 1] < 0) this.vel[k * 3 + 1] = 0;
        continue;
      }
      this.pos[k * 3] = nx;
      this.pos[k * 3 + 1] = ny;
      this.pos[k * 3 + 2] = nz;
    }
    this.geo.setDrawRange(0, alive);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

export { itemGeometry };
