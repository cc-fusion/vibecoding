// Dropped item entities + shared mini block/item geometry builder.
import * as THREE from "three";
import { BLOCKS, isBlock, ITEMS } from "./blocks";
import { tileIndex, ATLAS_TILES, GRASS_TINT, FOLIAGE_TINT, buildAtlas } from "./textures";
import { moveBody, type Body } from "./physics";
import type { World } from "./world";

const geoCache = new Map<string, THREE.BufferGeometry>();
let baseMaterial: THREE.MeshBasicMaterial | null = null;

export function getEntityMaterial(): THREE.MeshBasicMaterial {
  if (!baseMaterial) {
    baseMaterial = new THREE.MeshBasicMaterial({ map: buildAtlas(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, fog: true });
  }
  return baseMaterial;
}

function tileUV(name: string): [number, number, number, number] {
  const t = tileIndex(name);
  const s = 1 / ATLAS_TILES;
  const tx = t % ATLAS_TILES, ty = Math.floor(t / ATLAS_TILES);
  const e = 0.002 * s;
  return [tx * s + e, 1 - (ty + 1) * s + e, (tx + 1) * s - e, 1 - ty * s - e];
}

/** Geometry for an item id: textured cube for blocks, flat quad for items/cross blocks. Centered at origin. */
export function makeItemGeometry(id: number, size: number): THREE.BufferGeometry {
  const key = `${id}:${size}`;
  const cached = geoCache.get(key);
  if (cached) return cached;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const h = size / 2;
  if (isBlock(id) && BLOCKS[id].shape !== "cross") {
    const def = BLOCKS[id];
    const t = def.tex;
    const faces = t.length === 1 ? [t[0], t[0], t[0], t[0], t[0], t[0]] : t.length === 3 ? [t[2], t[2], t[0], t[1], t[2], t[2]] : t.length === 4 ? [t[3], t[3], t[0], t[1], t[2], t[3]] : t;
    const tint = def.tint === "grass" ? GRASS_TINT : def.tint === "foliage" ? FOLIAGE_TINT : def.tint === "water" ? [0.3, 0.5, 0.95] : [1, 1, 1];
    const F: { n: number[]; u: number[]; v: number[]; s: number }[] = [
      { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], s: 0.8 },
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: 0.8 },
      { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], s: 1 },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], s: 0.55 },
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], s: 0.88 },
      { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], s: 0.88 },
    ];
    F.forEach((f, fi) => {
      const [u0, v0, u1, v1] = tileUV(faces[fi]);
      const base = pos.length / 3;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [su, sv] of corners) {
        pos.push(f.n[0] * h + su * f.u[0] * h + sv * f.v[0] * h, f.n[1] * h + su * f.u[1] * h + sv * f.v[1] * h, f.n[2] * h + su * f.u[2] * h + sv * f.v[2] * h);
        uv.push(su < 0 ? u0 : u1, sv < 0 ? v0 : v1);
        const useTint = def.tint !== "grass" || fi === 2;
        col.push(f.s * (useTint ? tint[0] : 1), f.s * (useTint ? tint[1] : 1), f.s * (useTint ? tint[2] : 1));
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
  } else {
    const name = isBlock(id) ? BLOCKS[id].tex[0] : ITEMS[id]?.tex ?? "stick";
    const [u0, v0, u1, v1] = tileUV(name);
    const tint = isBlock(id) && BLOCKS[id].tint === "grass" ? GRASS_TINT : [1, 1, 1];
    pos.push(-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) col.push(tint[0], tint[1], tint[2]);
    idx.push(0, 1, 2, 0, 2, 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  geoCache.set(key, g);
  return g;
}

export class ItemEntity {
  body: Body;
  mesh: THREE.Mesh;
  age = 0;
  pickupDelay: number;
  constructor(public id: number, public count: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, public durability?: number, delay = 0.6) {
    this.body = { x, y, z, vx, vy, vz, w: 0.125, h: 0.25, onGround: false, hitWall: false, inWater: false, inLava: false };
    const mat = getEntityMaterial().clone();
    this.mesh = new THREE.Mesh(makeItemGeometry(id, 0.28), mat);
    this.pickupDelay = delay;
  }
}

export class ItemManager {
  items: ItemEntity[] = [];
  group = new THREE.Group();
  constructor(private world: World) {}

  drop(id: number, count: number, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0, durability?: number, delay = 0.6) {
    const e = new ItemEntity(id, count, x, y, z, vx, vy, vz, durability, delay);
    this.items.push(e);
    this.group.add(e.mesh);
    return e;
  }

  update(dt: number, px: number, py: number, pz: number, sun: number, tryPickup: (e: ItemEntity) => boolean) {
    const t = performance.now() / 1000;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += dt;
      e.pickupDelay -= dt;
      const b = e.body;
      if (b.inWater) {
        b.vy += (1.5 - b.vy) * dt * 3;
      } else b.vy -= 24 * dt;
      b.vx *= 1 - 4 * dt;
      b.vz *= 1 - 4 * dt;
      // magnet
      const dx = px - b.x, dy = py + 0.8 - b.y, dz = pz - b.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (e.pickupDelay <= 0 && d < 2.6) {
        const pull = 14 * dt;
        b.vx += (dx / d) * pull * 3;
        b.vy += (dy / d) * pull * 3;
        b.vz += (dz / d) * pull * 3;
        if (d < 1.1 && tryPickup(e)) {
          this.remove(i);
          continue;
        }
      }
      moveBody(this.world, b, dt);
      if (b.inLava || e.age > 300 || b.y < -5) {
        this.remove(i);
        continue;
      }
      e.mesh.position.set(b.x, b.y + 0.15 + Math.sin(t * 2 + e.age) * 0.05, b.z);
      e.mesh.rotation.y = t * 1.5 + e.age;
      const [s, bl] = this.world.getLight(Math.floor(b.x), Math.floor(b.y + 0.2), Math.floor(b.z));
      (e.mesh.material as THREE.MeshBasicMaterial).color.setScalar(Math.max((s / 15) * sun, (bl / 15) * 0.9, 0.12));
    }
  }

  private remove(i: number) {
    const e = this.items[i];
    this.group.remove(e.mesh);
    (e.mesh.material as THREE.Material).dispose();
    this.items.splice(i, 1);
  }

  clear() {
    for (let i = this.items.length - 1; i >= 0; i--) this.remove(i);
  }
}
