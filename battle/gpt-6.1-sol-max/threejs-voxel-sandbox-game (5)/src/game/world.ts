import * as THREE from 'three';
import { B, BLOCKS, isOpaque, isPlant } from './blocks';
import type { Target } from './types';

export const CHUNK = 16;
export const HEIGHT = 72;
export const SEA = 16;
const index = (x: number, y: number, z: number) => (x * CHUNK + z) * HEIGHT + y;
export const chunkKey = (x: number, z: number) => `${x},${z}`;

export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Noise {
  seed: number;
  constructor(seed: string) { this.seed = hashSeed(seed); }
  hash(x: number, z: number, salt = 0): number {
    let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(this.seed ^ salt, 144269);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  noise(x: number, z: number, salt = 0): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = this.hash(ix, iz, salt), b = this.hash(ix + 1, iz, salt);
    const c = this.hash(ix, iz + 1, salt), d = this.hash(ix + 1, iz + 1, salt);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  }
  fbm(x: number, z: number, octaves = 4): number {
    let n = 0, amplitude = 0.5, sum = 0;
    for (let i = 0; i < octaves; i++) { n += this.noise(x, z, i * 591) * amplitude; sum += amplitude; x *= 2.07; z *= 2.07; amplitude *= 0.5; }
    return n / sum;
  }
}

export interface Column { height: number; biome: string; tree: number; }
export interface ChunkData { cx: number; cz: number; blocks: Uint8Array; group: THREE.Group | null; dirty: boolean; }

const faces = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], light: 0.82 },
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], light: 0.92 },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], light: 0.66 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], light: 1 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], light: 0.86 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], light: 0.96 },
];

interface MeshArrays { positions: number[]; normals: number[]; colors: number[]; uvs: number[]; indices: number[]; }
const meshArrays = (): MeshArrays => ({ positions: [], normals: [], colors: [], uvs: [], indices: [] });

export class VoxelWorld {
  noise: Noise;
  chunks = new Map<string, ChunkData>();
  edits: Map<string, number>;
  private editsByChunk = new Map<string, [number, number, number, number][]>();
  columns = new Map<string, Column>();
  dirty = new Set<string>();
  constructor(seed: string, edits: [string, number][]) {
    this.noise = new Noise(seed); this.edits = new Map(edits);
    for (const [key, id] of edits) {
      const [x, y, z] = key.split(',').map(Number);
      const ck = chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
      const entries = this.editsByChunk.get(ck) || [];
      entries.push([x, y, z, id]); this.editsByChunk.set(ck, entries);
    }
  }

  column(x: number, z: number): Column {
    const key = chunkKey(x, z);
    const cached = this.columns.get(key);
    if (cached) return cached;
    const broad = this.noise.fbm(x * 0.012, z * 0.012);
    const detail = this.noise.fbm(x * 0.055, z * 0.055, 2);
    const riverX = -15 + Math.sin(z * 0.022) * 15 + Math.sin(z * 0.057) * 3;
    const riverDistance = Math.abs(x - riverX);
    const carve = 12 * Math.exp(-Math.pow(riverDistance / 18, 2));
    const highlands = Math.max(0, this.noise.noise(x * 0.009, z * 0.009, 991) - 0.48) * 65;
    const distantRidge = Math.max(0, Math.min(1, (-z - 40) / 80)) * (9 + broad * 16);
    let height = Math.floor(20 + broad * 10 + (detail - 0.5) * 5 + highlands + distantRidge - carve);
    // A gentle, dry arrival point is guaranteed for every seed.
    const spawnDistance = Math.hypot(x - 24, z - 34);
    if (spawnDistance < 11) height = Math.round(height * (spawnDistance / 11) + 30 * (1 - spawnDistance / 11));
    height = Math.max(6, Math.min(61, height));
    const moisture = this.noise.noise(x * 0.018, z * 0.018, 71);
    const biome = height > 39 ? 'Highlands' : height <= SEA + 1 ? 'Riverlands' : moisture > 0.58 ? 'Golden grove' : moisture < 0.32 ? 'Pine woods' : 'Wildflower meadow';
    const result = { height, biome, tree: moisture };
    this.columns.set(key, result);
    return result;
  }

  getChunk(cx: number, cz: number): ChunkData {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;
    chunk = { cx, cz, blocks: new Uint8Array(CHUNK * CHUNK * HEIGHT), group: null, dirty: true };
    this.chunks.set(key, chunk);
    const sx = cx * CHUNK, sz = cz * CHUNK;
    const set = (x: number, y: number, z: number, id: number, empty = false) => {
      if (x < sx || x >= sx + CHUNK || z < sz || z >= sz + CHUNK || y < 0 || y >= HEIGHT) return;
      const i = index(x - sx, y, z - sz);
      if (!empty || chunk.blocks[i] === B.AIR || isPlant(chunk.blocks[i])) chunk.blocks[i] = id;
    };
    for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) {
      const wx = sx + x, wz = sz + z;
      const { height: h, biome } = this.column(wx, wz);
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id: number;
        if (y === 0) id = B.BEDROCK;
        else if (y > h) id = B.WATER;
        else if (y === h) id = h <= SEA + 1 ? B.SAND : h > 48 ? B.SNOW : biome === 'Highlands' && this.noise.hash(wx, wz, 42) > 0.55 ? B.STONE : B.GRASS;
        else if (y > h - 4) id = h <= SEA + 1 ? B.SAND : B.DIRT;
        else {
          const ore = this.noise.hash(wx + y * 97, wz - y * 71, 142);
          id = ore > 0.968 ? B.COAL : ore < 0.021 && y < h - 6 ? B.IRON : B.STONE;
          if (y > 4 && y < h - 7) {
            const cave = Math.sin(wx * 0.13 + y * 0.24) + Math.cos(wz * 0.15 - y * 0.19) + Math.sin((wx + wz) * 0.09 + y * 0.31);
            if (cave > 2.24) id = B.AIR;
          }
        }
        set(wx, y, wz, id);
      }
      if (h > SEA + 1 && h < 43) {
        const decoration = this.noise.hash(wx, wz, 881);
        if (decoration > 0.965) set(wx, h + 1, wz, B.FLOWER);
        else if (decoration > 0.86) set(wx, h + 1, wz, B.TALL_GRASS);
      }
    }
    // Trees are anchored on a world grid, so canopies match across chunk boundaries.
    for (let gx = Math.floor((sx - 4) / 6); gx <= Math.floor((sx + CHUNK + 4) / 6); gx++) {
      for (let gz = Math.floor((sz - 4) / 6); gz <= Math.floor((sz + CHUNK + 4) / 6); gz++) {
        const r = this.noise.hash(gx, gz, 567);
        const tx = gx * 6 + Math.floor(this.noise.hash(gx, gz, 18) * 4);
        const tz = gz * 6 + Math.floor(this.noise.hash(gx, gz, 19) * 4);
        const col = this.column(tx, tz);
        if (r < (col.biome === 'Wildflower meadow' ? 0.76 : 0.48) || col.height <= SEA + 2 || col.height > 48 || Math.hypot(tx - 24, tz - 34) < 17) continue;
        const pine = col.biome === 'Pine woods' || col.biome === 'Highlands';
        const golden = col.biome === 'Golden grove';
        const trunk = pine ? 6 + Math.floor(r * 3) : 4 + Math.floor(r * 2);
        const leaf = pine ? B.PINE_LEAVES : golden ? B.GOLD_LEAVES : B.LEAVES;
        const base = col.height + 1;
        if (pine) {
          for (let dy = 2; dy <= trunk + 2; dy++) {
            const radius = dy > trunk ? 0 : Math.max(1, Math.floor((trunk + 1 - dy) / 2));
            for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) + Math.abs(dz) <= radius + 1) set(tx + dx, base + dy, tz + dz, leaf, true);
            }
          }
        } else {
          for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
            const radius = dy === trunk + 1 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && this.noise.hash(tx + dx, tz + dz, dy) < 0.6) continue;
              set(tx + dx, base + dy, tz + dz, leaf, true);
            }
          }
        }
        for (let dy = 0; dy < trunk; dy++) set(tx, base + dy, tz, golden ? B.BIRCH : B.LOG);
      }
    }
    // Sparse edits are applied last, preserving both removals and constructions.
    for (const [x, y, z, id] of this.editsByChunk.get(key) || []) set(x, y, z, id);
    return chunk;
  }

  get(x: number, y: number, z: number): number {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    return this.getChunk(cx, cz).blocks[index(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  set(x: number, y: number, z: number, id: number) {
    if (y < 1 || y >= HEIGHT) return false;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const chunk = this.getChunk(cx, cz);
    chunk.blocks[index(x - cx * CHUNK, y, z - cz * CHUNK)] = id;
    this.edits.set(`${x},${y},${z}`, id);
    const key = chunkKey(cx, cz);
    const entries = this.editsByChunk.get(key) || [];
    const existing = entries.findIndex(e => e[0] === x && e[1] === y && e[2] === z);
    if (existing >= 0) entries[existing] = [x, y, z, id]; else entries.push([x, y, z, id]);
    this.editsByChunk.set(key, entries);
    this.dirty.add(chunkKey(cx, cz));
    if (x % CHUNK === 0) this.dirty.add(chunkKey(cx - 1, cz));
    if ((x + 1) % CHUNK === 0) this.dirty.add(chunkKey(cx + 1, cz));
    if (z % CHUNK === 0) this.dirty.add(chunkKey(cx, cz - 1));
    if ((z + 1) % CHUNK === 0) this.dirty.add(chunkKey(cx, cz + 1));
    return true;
  }

  mesh(chunk: ChunkData, materials: { opaque: THREE.Material; water: THREE.Material; glass: THREE.Material }): THREE.Group {
    const opaque = meshArrays(), water = meshArrays(), glass = meshArrays();
    const sx = chunk.cx * CHUNK, sz = chunk.cz * CHUNK;
    const read = (x: number, y: number, z: number) => {
      if (y < 0) return B.BEDROCK;
      if (y >= HEIGHT) return B.AIR;
      if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return chunk.blocks[index(x, y, z)];
      return this.get(sx + x, y, sz + z);
    };
    const quad = (data: MeshArrays, vertices: number[][], normal: number[], tile: number, shade: number, ao?: number[]) => {
      const ndx = data.positions.length / 3;
      const u = (tile % 8) / 8, v = 1 - Math.floor(tile / 8) / 4;
      const pad = 0.001;
      const uv = [[u + pad, v - pad], [u + pad, v - 0.25 + pad], [u + 0.125 - pad, v - pad], [u + 0.125 - pad, v - 0.25 + pad]];
      for (let i = 0; i < 4; i++) {
        data.positions.push(...vertices[i]); data.normals.push(...normal); data.uvs.push(...uv[i]);
        const light = shade * (ao?.[i] ?? 1);
        data.colors.push(light, light, light);
      }
      data.indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
    };
    for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) {
      for (let y = 0; y < HEIGHT; y++) {
        const id = chunk.blocks[index(x, y, z)];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        if (isPlant(id)) {
          const tile = id === B.TALL_GRASS ? 27 : 28;
          quad(opaque, [[x, y + 0.85, z], [x, y, z], [x + 1, y + 0.85, z + 1], [x + 1, y, z + 1]], [0, 1, 0], tile, 1);
          quad(opaque, [[x + 1, y + 0.85, z], [x + 1, y, z], [x, y + 0.85, z + 1], [x, y, z + 1]], [0, 1, 0], tile, 1);
          continue;
        }
        const data = id === B.WATER ? water : id === B.GLASS ? glass : opaque;
        for (let f = 0; f < faces.length; f++) {
          const face = faces[f], [dx, dy, dz] = face.dir;
          const neighbor = read(x + dx, y + dy, z + dz);
          if (id === B.WATER ? neighbor !== B.AIR && !isPlant(neighbor) : id === B.GLASS ? isOpaque(neighbor) || neighbor === B.GLASS : isOpaque(neighbor)) continue;
          if (id === B.WATER && f === 2) continue;
          const small = id === B.TORCH;
          const campfire = id === B.CAMPFIRE;
          const vertices = face.corners.map(c => [
            x + (small ? 0.42 + c[0] * 0.16 : c[0]),
            y + c[1] * (small ? 0.78 : campfire ? 0.32 : id === B.WATER ? 0.88 : 1),
            z + (small ? 0.42 + c[2] * 0.16 : c[2]),
          ]);
          const tile = f === 3 ? def.topTile ?? def.tile : f === 2 ? def.bottomTile ?? def.tile : def.tile;
          let ao: number[] | undefined;
          if (id !== B.WATER && id !== B.TORCH && id !== B.GLASS) {
            const axes = face.dir.map((d, i) => d === 0 ? i : -1).filter(i => i >= 0);
            ao = face.corners.map(c => {
              const p = [x + dx, y + dy, z + dz];
              const a = [...p], b = [...p], corner = [...p];
              a[axes[0]] += c[axes[0]] === 0 ? -1 : 1;
              b[axes[1]] += c[axes[1]] === 0 ? -1 : 1;
              corner[axes[0]] = a[axes[0]]; corner[axes[1]] = b[axes[1]];
              const occlusion = Number(isOpaque(read(...a as [number, number, number]))) + Number(isOpaque(read(...b as [number, number, number]))) + Number(isOpaque(read(...corner as [number, number, number])));
              return 1 - occlusion * 0.095;
            });
          }
          quad(data, vertices, face.dir, tile, id === B.WATER ? 1 : face.light, ao);
        }
      }
    }
    const group = new THREE.Group();
    group.position.set(sx, 0, sz);
    for (const [data, material, castShadow] of [[opaque, materials.opaque, true], [water, materials.water, false], [glass, materials.glass, false]] as const) {
      if (!data.positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setIndex(data.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = castShadow; mesh.receiveShadow = castShadow;
      group.add(mesh);
    }
    chunk.dirty = false;
    return group;
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, distance = 7): Target | null {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const step = [Math.sign(direction.x), Math.sign(direction.y), Math.sign(direction.z)];
    const delta = [Math.abs(1 / direction.x), Math.abs(1 / direction.y), Math.abs(1 / direction.z)];
    const t = [
      direction.x === 0 ? Infinity : ((step[0] > 0 ? x + 1 : x) - origin.x) / direction.x,
      direction.y === 0 ? Infinity : ((step[1] > 0 ? y + 1 : y) - origin.y) / direction.y,
      direction.z === 0 ? Infinity : ((step[2] > 0 ? z + 1 : z) - origin.z) / direction.z,
    ];
    let traveled = 0;
    let normal: [number, number, number] = [0, 0, 0];
    while (traveled <= distance) {
      const id = this.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER && id !== B.TALL_GRASS) return { x, y, z, id, normal, distance: traveled };
      const axis = t[0] < t[1] ? (t[0] < t[2] ? 0 : 2) : (t[1] < t[2] ? 1 : 2);
      traveled = t[axis]; t[axis] += delta[axis];
      normal = [0, 0, 0]; normal[axis] = -step[axis];
      if (axis === 0) x += step[0]; else if (axis === 1) y += step[1]; else z += step[2];
    }
    return null;
  }

  disposeGroup(group: THREE.Group) {
    group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    group.removeFromParent();
  }
  dispose() { this.chunks.forEach(c => { if (c.group) this.disposeGroup(c.group); }); this.chunks.clear(); this.columns.clear(); }
}