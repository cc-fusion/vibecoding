// Chunk storage, streaming and block access.
import * as THREE from "three";
import { B, OPAQUE, LIGHT, BLOCKS } from "./blocks";
import { CHUNK, HEIGHT, WorldGen, SEA } from "./worldgen";
import { buildChunkMesh, type MeshData } from "./mesher";
import { getMaterials } from "./materials";

export const chunkKey = (cx: number, cz: number) => ((cx & 0xffff) << 16) | (cz & 0xffff);
export const blockIndex = (lx: number, y: number, lz: number) => (lx * CHUNK + lz) * HEIGHT + y;

export class Chunk {
  cx: number;
  cz: number;
  key: number;
  blocks = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  biomes = new Uint8Array(CHUNK * CHUNK);
  skyLight: Uint8Array | null = null;
  blockLight: Uint8Array | null = null;
  meshed = false;
  dirty = false; // needs immediate rebuild
  lightDirty = false; // needs background rebuild
  opaqueMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  lastMeshTime = 0;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
  }
}

// Spiral offsets sorted by distance, up to radius 20
const OFFSETS: { dx: number; dz: number; d: number }[] = [];
for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) OFFSETS.push({ dx, dz, d: Math.sqrt(dx * dx + dz * dz) });
OFFSETS.sort((a, b) => a.d - b.d);

export class World {
  gen: WorldGen;
  chunks = new Map<number, Chunk>();
  diffs = new Map<number, Map<number, number>>();
  group = new THREE.Group();
  renderDistance = 8;
  private lastCenter = { cx: NaN, cz: NaN };
  private genQueue: { cx: number; cz: number; key: number }[] = [];
  private meshQueue: Chunk[] = [];
  stats = { generated: 0, meshed: 0, visible: 0 };
  onBlockChanged: ((x: number, y: number, z: number, prev: number, next: number) => void) | null = null;

  constructor(seed: number) {
    this.gen = new WorldGen(seed);
    this.group.name = "world";
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return B.AIR;
    return c.blocks[blockIndex(x & 15, y, z & 15)];
  }

  isLoaded(x: number, z: number): boolean {
    return this.chunks.has(chunkKey(x >> 4, z >> 4));
  }

  getBiome(x: number, z: number): number {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return this.gen.column(x, z).biome;
    return c.biomes[(x & 15) * CHUNK + (z & 15)];
  }

  /** Light at a cell: [sky 0..15, block 0..15] */
  getLight(x: number, y: number, z: number): [number, number] {
    if (y >= HEIGHT) return [15, 0];
    if (y < 0) return [0, 0];
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || !c.skyLight || !c.blockLight) return [15, 0];
    const i = blockIndex(x & 15, y, z & 15);
    return [c.skyLight[i], c.blockLight[i]];
  }

  /** Highest non-air block y in a column (or -1). */
  getSurfaceY(x: number, z: number): number {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return this.gen.column(x, z).height;
    const base = blockIndex(x & 15, 0, z & 15);
    for (let y = HEIGHT - 1; y >= 0; y--) if (c.blocks[base + y] !== B.AIR) return y;
    return -1;
  }

  setBlock(x: number, y: number, z: number, id: number, record = true): boolean {
    if (y < 0 || y >= HEIGHT) return false;
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x & 15,
      lz = z & 15;
    const i = blockIndex(lx, y, lz);
    const prev = c.blocks[i];
    if (prev === id) return false;
    c.blocks[i] = id;
    if (record) {
      let d = this.diffs.get(c.key);
      if (!d) {
        d = new Map();
        this.diffs.set(c.key, d);
      }
      d.set(i, id);
    }
    c.dirty = true;
    // Determine light influence radius to decide which neighbors need a rebuild
    let radius = 1;
    if (OPAQUE[prev] !== OPAQUE[id] || LIGHT[prev] !== LIGHT[id]) {
      const [s, b] = this.getLight(x, y, z);
      radius = Math.max(s, b, LIGHT[prev], LIGHT[id], 1);
      // A removed opaque block may let bright neighbors in
      for (const [dx, dy, dz] of NEIGH) {
        const [s2, b2] = this.getLight(x + dx, y + dy, z + dz);
        radius = Math.max(radius, s2, b2);
      }
    }
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        if (ox === 0 && oz === 0) continue;
        const distX = ox < 0 ? lx + 1 : ox > 0 ? CHUNK - lx : 0;
        const distZ = oz < 0 ? lz + 1 : oz > 0 ? CHUNK - lz : 0;
        if (Math.max(distX, distZ) <= radius) {
          const n = this.chunks.get(chunkKey(cx + ox, cz + oz));
          if (n && n.meshed) {
            if (Math.max(distX, distZ) <= 1) n.dirty = true;
            else n.lightDirty = true;
          }
        }
      }
    }
    this.onBlockChanged?.(x, y, z, prev, id);
    return true;
  }

  private generate(cx: number, cz: number): Chunk {
    const c = new Chunk(cx, cz);
    this.gen.generateChunk(cx, cz, c.blocks, c.biomes);
    const d = this.diffs.get(c.key);
    if (d) for (const [i, id] of d) c.blocks[i] = id;
    this.chunks.set(c.key, c);
    this.stats.generated++;
    return c;
  }

  ensureChunk(cx: number, cz: number): Chunk {
    return this.getChunk(cx, cz) ?? this.generate(cx, cz);
  }

  private neighborsGenerated(cx: number, cz: number): boolean {
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) if (!this.chunks.has(chunkKey(cx + ox, cz + oz))) return false;
    return true;
  }

  rebuildMesh(c: Chunk): void {
    const data: MeshData = buildChunkMesh(this, c);
    const mats = getMaterials();
    const ox = c.cx * CHUNK,
      oz = c.cz * CHUNK;
    const build = (prev: THREE.Mesh | null, d: MeshData["opaque"], mat: THREE.Material): THREE.Mesh | null => {
      if (prev) {
        this.group.remove(prev);
        prev.geometry.dispose();
      }
      if (d.index.length === 0) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(d.uv, 2));
      g.setAttribute("aLight", new THREE.BufferAttribute(d.light, 2));
      g.setAttribute("aColor", new THREE.BufferAttribute(d.color, 3));
      g.setIndex(new THREE.BufferAttribute(d.index, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(ox + 8, HEIGHT / 2, oz + 8), Math.sqrt(8 * 8 + 64 * 64 + 8 * 8));
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      return m;
    };
    c.opaqueMesh = build(c.opaqueMesh, data.opaque, mats.opaque);
    c.waterMesh = build(c.waterMesh, data.water, mats.water);
    if (c.waterMesh) c.waterMesh.renderOrder = 10;
    c.meshed = true;
    c.dirty = false;
    c.lightDirty = false;
    c.lastMeshTime = performance.now();
    this.stats.meshed++;
  }

  private unload(c: Chunk) {
    for (const m of [c.opaqueMesh, c.waterMesh]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.chunks.delete(c.key);
  }

  /** Returns true when all chunks around the center within radius are generated & meshed. */
  isAreaReady(px: number, pz: number, radius: number): boolean {
    const cx = Math.floor(px) >> 4,
      cz = Math.floor(pz) >> 4;
    for (const o of OFFSETS) {
      if (o.d > radius) break;
      const c = this.getChunk(cx + o.dx, cz + o.dz);
      if (!c || !c.meshed) return false;
    }
    return true;
  }

  /** Streams chunks around the player within a time budget (ms). Returns remaining work estimate. */
  update(px: number, pz: number, budgetMs: number): number {
    const start = performance.now();
    const cx = Math.floor(px) >> 4,
      cz = Math.floor(pz) >> 4;
    const rd = this.renderDistance;

    // 1. immediate dirty rebuilds
    for (const c of this.chunks.values()) {
      if (c.dirty && c.meshed) {
        this.rebuildMesh(c);
        if (performance.now() - start > budgetMs * 2) break;
      }
    }

    // 2. recompute queues when the center chunk changes
    if (cx !== this.lastCenter.cx || cz !== this.lastCenter.cz || (this.genQueue.length === 0 && this.meshQueue.length === 0)) {
      this.lastCenter = { cx, cz };
      this.genQueue.length = 0;
      this.meshQueue.length = 0;
      for (const o of OFFSETS) {
        if (o.d > rd + 1.5) break;
        const c = this.getChunk(cx + o.dx, cz + o.dz);
        if (!c) this.genQueue.push({ cx: cx + o.dx, cz: cz + o.dz, key: chunkKey(cx + o.dx, cz + o.dz) });
        else if (!c.meshed && o.d <= rd + 0.5) this.meshQueue.push(c);
      }
      // unload far chunks
      for (const c of this.chunks.values()) {
        const d = Math.sqrt((c.cx - cx) ** 2 + (c.cz - cz) ** 2);
        if (d > rd + 4) this.unload(c);
      }
      // visibility
      let visible = 0;
      for (const c of this.chunks.values()) {
        const d = Math.sqrt((c.cx - cx) ** 2 + (c.cz - cz) ** 2);
        const vis = d <= rd + 0.5;
        if (c.opaqueMesh) c.opaqueMesh.visible = vis;
        if (c.waterMesh) c.waterMesh.visible = vis;
        if (vis && c.meshed) visible++;
      }
      this.stats.visible = visible;
    }

    // 3. generate + mesh, nearest first, interleaved
    while (performance.now() - start < budgetMs) {
      let didWork = false;
      // mesh anything meshable whose neighbors exist, nearest first
      while (this.meshQueue.length) {
        const c = this.meshQueue[0];
        if (!this.chunks.has(c.key)) {
          this.meshQueue.shift();
          continue;
        }
        if (c.meshed) {
          this.meshQueue.shift();
          continue;
        }
        if (this.neighborsGenerated(c.cx, c.cz)) {
          this.meshQueue.shift();
          this.rebuildMesh(c);
          didWork = true;
          break;
        }
        break; // need generation first
      }
      if (didWork && performance.now() - start >= budgetMs) break;
      if (this.genQueue.length) {
        const ph = this.genQueue.shift()!;
        if (!this.chunks.has(ph.key)) {
          const c = this.generate(ph.cx, ph.cz);
          const d = Math.sqrt((c.cx - cx) ** 2 + (c.cz - cz) ** 2);
          if (d <= rd + 0.5) {
            this.meshQueue.push(c);
            this.meshQueue.sort((a, b) => dist2(a, cx, cz) - dist2(b, cx, cz));
          }
          didWork = true;
        }
      }
      if (!didWork) {
        // background light-dirty rebuild (one per update)
        for (const c of this.chunks.values()) {
          if (c.lightDirty && c.meshed) {
            this.rebuildMesh(c);
            didWork = true;
            break;
          }
        }
        if (!didWork) break;
      }
    }
    return this.genQueue.length + this.meshQueue.length;
  }

  /** Checks whether an AABB intersects any solid block. */
  isSolidAt(x: number, y: number, z: number): boolean {
    const id = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return !!BLOCKS[id]?.solid;
  }

  seaLevel() {
    return SEA;
  }
}

const dist2 = (c: Chunk, cx: number, cz: number) => (c.cx - cx) ** 2 + (c.cz - cz) ** 2;
const NEIGH: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
