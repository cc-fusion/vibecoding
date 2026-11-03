import * as THREE from 'three';
import { Block, faceTile, isPlant, isSolid, tileUV } from './blocks';
import { fbm, hash2, noise2 } from './noise';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const SEA_LEVEL = 11;
const RENDER_DISTANCE = 3;

interface Chunk {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  group: THREE.Group;
  dirty: boolean;
}

interface GeometryData {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
}

const FACES = [
  { dir: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], light: 0.8 },
  { dir: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], light: 0.72 },
  { dir: [0, 1, 0], vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], light: 1 },
  { dir: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], light: 0.52 },
  { dir: [0, 0, 1], vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], light: 0.87 },
  { dir: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], light: 0.77 },
];

function index(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

function chunkKey(x: number, z: number): string { return `${x},${z}`; }
function emptyGeometry(): GeometryData { return { positions: [], normals: [], colors: [], uvs: [], indices: [] }; }

export class VoxelWorld {
  readonly chunks = new Map<string, Chunk>();
  readonly edits: Record<string, number>;
  readonly seed: number;
  private scene: THREE.Scene;
  private material: THREE.MeshLambertMaterial;
  private waterMaterial: THREE.MeshLambertMaterial;
  private editIndex = new Map<string, Map<string, number>>();
  private queue: [number, number][] = [];
  private centerX = Number.NaN;
  private centerZ = Number.NaN;

  constructor(scene: THREE.Scene, texture: THREE.Texture, seed: number, edits: Record<string, number> = {}) {
    this.scene = scene;
    this.seed = seed;
    this.edits = { ...edits };
    for (const [key, block] of Object.entries(this.edits)) {
      const [x, , z] = key.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      const chunk = chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      if (!this.editIndex.has(chunk)) this.editIndex.set(chunk, new Map());
      this.editIndex.get(chunk)!.set(key, block);
    }
    this.material = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true, alphaTest: 0.35, side: THREE.DoubleSide });
    this.waterMaterial = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide });
  }

  terrainHeight(x: number, z: number): number {
    const broad = fbm(x * 0.012, z * 0.012, this.seed);
    const detail = fbm(x * 0.042, z * 0.042, this.seed + 101);
    const mountain = Math.max(0, fbm(x * 0.007, z * 0.007, this.seed + 543) - 0.51);
    let height = 10 + broad * 9 + (detail - 0.5) * 6 + mountain * mountain * 120;

    // The first clearing and pond make every new world welcoming; everything beyond is seeded.
    const distance = Math.hypot(x, z - 4);
    const clearing = Math.max(0, 1 - distance / 48) * 0.8;
    const gentle = 14 + (detail - 0.5) * 3;
    height = height * (1 - clearing) + gentle * clearing;
    height += Math.exp(-(x ** 2 / 350 + (z - 8) ** 2 / 80)) * 5.4;
    const lake = Math.exp(-((x - 3) ** 2 / 170 + (z + 22) ** 2 / 130));
    height -= lake * 9.5;
    return Math.max(3, Math.min(WORLD_HEIGHT - 10, Math.floor(height)));
  }

  biomeAt(x: number, z: number): string {
    if (Math.hypot(x, z) < 48) return 'Meadow';
    const heat = noise2(x * 0.006, z * 0.006, this.seed + 682);
    const wet = noise2(x * 0.009, z * 0.009, this.seed + 231);
    const height = this.terrainHeight(x, z);
    if (height > 23) return 'Highlands';
    if (heat > 0.6 && wet < 0.47) return 'Sunlands';
    if (wet > 0.53) return 'Woodlands';
    return 'Meadow';
  }

  private treeAt(x: number, z: number, height: number, biome: string): boolean {
    const landmarks = [[-11, -8], [13, -11], [-15, -21], [17, -27], [-9, -37], [23, -38], [-22, -35], [20, 5], [-20, 9]];
    if (landmarks.some(([lx, lz]) => x === lx && z === lz)) return height > SEA_LEVEL;
    if (z < 7 && z > -42 && Math.abs(x) < 9) return false;
    if (Math.hypot(x, z - 7) < 9 || height <= SEA_LEVEL + 1 || biome === 'Sunlands' || biome === 'Highlands') return false;
    const chance = biome === 'Woodlands' ? 0.027 : 0.009;
    return hash2(x, z, this.seed + 730) < chance;
  }

  private generateChunk(cx: number, cz: number): Chunk {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    const chunk: Chunk = { cx, cz, blocks, group, dirty: true };
    const originX = cx * CHUNK_SIZE, originZ = cz * CHUNK_SIZE;
    const put = (wx: number, y: number, wz: number, block: Block, replace = false) => {
      const x = wx - originX, z = wz - originZ;
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      const at = index(x, y, z);
      if (replace || blocks[at] === Block.Air || isPlant(blocks[at] as Block)) blocks[at] = block;
    };

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = originX + x, wz = originZ + z;
        const height = this.terrainHeight(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const sandy = height <= SEA_LEVEL + 1 || biome === 'Sunlands';
        for (let y = 0; y <= height; y++) {
          let block = Block.Stone;
          if (y === height) block = sandy ? Block.Sand : biome === 'Highlands' && height > 25 ? Block.Snow : Block.Grass;
          else if (y > height - 4) block = sandy ? Block.Sand : Block.Dirt;
          else if (y > 2 && y < height - 3 && hash2(wx + y * 71, wz - y * 31, this.seed + 321) > 0.985) block = Block.CoalOre;
          blocks[index(x, y, z)] = block;
        }
        for (let y = height + 1; y <= SEA_LEVEL; y++) blocks[index(x, y, z)] = Block.Water;
        if (!sandy && height > SEA_LEVEL && height < WORLD_HEIGHT - 2) {
          const decoration = hash2(wx, wz, this.seed + 49);
          if (decoration > 0.986) blocks[index(x, height + 1, z)] = Block.Flower;
          else if (decoration > 0.915) blocks[index(x, height + 1, z)] = Block.TallGrass;
        }
      }
    }

    // Roots just outside this chunk are considered too, so canopies join without seams.
    for (let wz = originZ - 2; wz < originZ + CHUNK_SIZE + 2; wz++) {
      for (let wx = originX - 2; wx < originX + CHUNK_SIZE + 2; wx++) {
        const height = this.terrainHeight(wx, wz);
        const biome = this.biomeAt(wx, wz);
        if (!this.treeAt(wx, wz, height, biome)) continue;
        const trunk = 4 + Math.floor(hash2(wx, wz, this.seed + 818) * 2);
        for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
          const radius = dy === trunk + 1 ? 1 : 2;
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === trunk + 1 || hash2(wx + dx, wz + dz, this.seed + dy) > 0.42)) continue;
              put(wx + dx, height + 1 + dy, wz + dz, Block.Leaves);
            }
          }
        }
        for (let dy = 1; dy <= trunk; dy++) put(wx, height + dy, wz, Block.Log, true);
      }
    }

    for (const [key, block] of this.editIndex.get(chunkKey(cx, cz)) ?? []) {
      const [wx, y, wz] = key.split(',').map(Number);
      if (Math.floor(wx / CHUNK_SIZE) === cx && Math.floor(wz / CHUNK_SIZE) === cz && y >= 0 && y < WORLD_HEIGHT) {
        blocks[index(wx - originX, y, wz - originZ)] = block;
      }
    }
    this.chunks.set(chunkKey(cx, cz), chunk);
    this.scene.add(group);
    return chunk;
  }

  initialize(x: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) this.generateChunk(cx + dx, cz + dz);
    this.chunks.forEach(chunk => this.rebuild(chunk));
    this.schedule(x, z);
  }

  private schedule(x: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    if (cx === this.centerX && cz === this.centerZ) return;
    this.centerX = cx; this.centerZ = cz;
    this.queue = [];
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) this.queue.push([cx + dx, cz + dz]);
      }
    }
    this.queue.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cz) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2));
    this.chunks.forEach((chunk, key) => {
      if (Math.abs(chunk.cx - cx) > RENDER_DISTANCE + 1 || Math.abs(chunk.cz - cz) > RENDER_DISTANCE + 1) {
        this.disposeChunk(chunk); this.chunks.delete(key);
      }
    });
  }

  update(x: number, z: number) {
    this.waterMaterial.opacity = 0.72 + Math.sin(performance.now() * 0.0012) * 0.025;
    this.schedule(x, z);
    const next = this.queue.shift();
    if (next && !this.chunks.has(chunkKey(next[0], next[1]))) {
      this.generateChunk(next[0], next[1]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = this.chunks.get(chunkKey(next[0] + dx, next[1] + dz));
        if (neighbor) neighbor.dirty = true;
      }
    }
    let rebuilt = 0;
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        this.rebuild(chunk);
        if (++rebuilt >= 2) break;
      }
    }
  }

  getBlock(x: number, y: number, z: number): Block {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return Block.Stone;
    if (y >= WORLD_HEIGHT) return Block.Air;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return Block.Air;
    return chunk.blocks[index(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)] as Block;
  }

  ensureAt(x: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    if (this.chunks.has(chunkKey(cx, cz))) return;
    this.generateChunk(cx, cz);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.markDirty(cx + dx, cz + dz);
  }

  setBlock(x: number, y: number, z: number, block: Block): boolean {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 1 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    chunk.blocks[index(lx, y, lz)] = block;
    const editKey = `${x},${y},${z}`;
    this.edits[editKey] = block;
    const currentChunk = chunkKey(cx, cz);
    if (!this.editIndex.has(currentChunk)) this.editIndex.set(currentChunk, new Map());
    this.editIndex.get(currentChunk)!.set(editKey, block);
    chunk.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  private markDirty(cx: number, cz: number) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  surfaceAt(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const block = this.getBlock(x, y, z);
      if (isSolid(block) && block !== Block.Leaves && block !== Block.Log) return y + 1;
    }
    return this.terrainHeight(x, z) + 1;
  }

  private rebuild(chunk: Chunk) {
    while (chunk.group.children.length) {
      const child = chunk.group.children[0] as THREE.Mesh;
      chunk.group.remove(child); child.geometry.dispose();
    }
    const solid = emptyGeometry(), water = emptyGeometry();
    const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
    const localBlock = (x: number, y: number, z: number): Block => {
      if (y < 0) return Block.Stone;
      if (y >= WORLD_HEIGHT) return Block.Air;
      if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) return chunk.blocks[index(x, y, z)] as Block;
      return this.getBlock(ox + x, y, oz + z);
    };
    const append = (data: GeometryData, vertices: number[][], normal: number[], tile: number, light: number) => {
      const vertex = data.positions.length / 3;
      const [u0, v0, u1, v1] = tileUV(tile);
      for (const v of vertices) {
        data.positions.push(v[0], v[1], v[2]);
        data.normals.push(normal[0], normal[1], normal[2]);
        data.colors.push(light, light, light);
      }
      data.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
      data.indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
    };

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.blocks[index(x, y, z)] as Block;
          if (block === Block.Air) continue;
          if (isPlant(block)) {
            const tile = faceTile(block, 0);
            const inset = block === Block.Torch ? 0.15 : 0.03;
            const plantHeight = block === Block.TallGrass ? 0.82 : block === Block.Flower ? 0.88 : 1;
            const a = [[x + inset, y, z + inset], [x + inset, y + plantHeight, z + inset], [x + 1 - inset, y + plantHeight, z + 1 - inset], [x + 1 - inset, y, z + 1 - inset]];
            const b = [[x + 1 - inset, y, z + inset], [x + 1 - inset, y + plantHeight, z + inset], [x + inset, y + plantHeight, z + 1 - inset], [x + inset, y, z + 1 - inset]];
            append(solid, a, [0.7, 0, -0.7], tile, 1);
            append(solid, b, [-0.7, 0, -0.7], tile, 1);
            continue;
          }
          const isWater = block === Block.Water;
          for (let face = 0; face < FACES.length; face++) {
            const f = FACES[face];
            const neighbor = localBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            const visible = isWater ? neighbor === Block.Air || isPlant(neighbor) : neighbor === Block.Air || neighbor === Block.Water || isPlant(neighbor);
            if (!visible) continue;
            const tint = 0.96 + hash2(ox + x, oz + z, this.seed + y * 17) * 0.08;
            const vertices = f.vertices.map(v => [x + v[0], y + (isWater && v[1] === 1 ? 0.89 : v[1]), z + v[2]]);
            append(isWater ? water : solid, vertices, f.dir, faceTile(block, face), f.light * tint);
          }
        }
      }
    }
    const makeMesh = (data: GeometryData, material: THREE.Material) => {
      if (!data.indices.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setIndex(data.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      chunk.group.add(mesh);
    };
    makeMesh(solid, this.material); makeMesh(water, this.waterMaterial);
    chunk.dirty = false;
  }

  private disposeChunk(chunk: Chunk) {
    this.scene.remove(chunk.group);
    chunk.group.children.forEach(child => (child as THREE.Mesh).geometry.dispose());
  }

  dispose() {
    this.chunks.forEach(chunk => this.disposeChunk(chunk));
    this.chunks.clear(); this.material.dispose(); this.waterMaterial.dispose();
  }
}