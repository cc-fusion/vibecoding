import * as THREE from 'three';
import { BLOCK, isSolid } from './catalog';
import { biomeAt, hash2, hasTree, terrainHeight, WATER_LEVEL } from './noise';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 40;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 3;
const TILE = 16;

interface Chunk {
  x: number;
  z: number;
  blocks: Uint8Array;
  group: THREE.Group;
}

interface MeshData {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
}

const emptyMesh = (): MeshData => ({ positions: [], normals: [], colors: [], uvs: [], indices: [] });
const chunkKey = (x: number, z: number) => `${x},${z}`;
const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
const indexOf = (x: number, y: number, z: number) => (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;

const FACES = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], light: 0.83 },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], light: 0.76 },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], light: 1 },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], light: 0.62 },
  { normal: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], light: 0.88 },
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], light: 0.8 },
];

function tileFor(id: number, face: number) {
  switch (id) {
    case BLOCK.GRASS: return face === 2 ? 0 : face === 3 ? 2 : 1;
    case BLOCK.DIRT: return 2;
    case BLOCK.STONE: return 3;
    case BLOCK.LOG: return face === 2 || face === 3 ? 5 : 4;
    case BLOCK.LEAVES: return 6;
    case BLOCK.SAND: return 7;
    case BLOCK.WATER: return 8;
    case BLOCK.PLANKS: return 9;
    case BLOCK.BRICKS: return 10;
    case BLOCK.COBBLE: return 11;
    case BLOCK.PINE_LEAVES: return 12;
    case BLOCK.SANDSTONE: return 13;
    case BLOCK.WOOL: return 14;
    default: return 2;
  }
}

function addUv(data: MeshData, tile: number) {
  const col = tile % ATLAS_COLUMNS;
  const row = Math.floor(tile / ATLAS_COLUMNS);
  const inset = 0.08;
  const u0 = (col * TILE + inset) / (ATLAS_COLUMNS * TILE);
  const u1 = ((col + 1) * TILE - inset) / (ATLAS_COLUMNS * TILE);
  const v0 = 1 - ((row + 1) * TILE - inset) / (ATLAS_ROWS * TILE);
  const v1 = 1 - (row * TILE + inset) / (ATLAS_ROWS * TILE);
  data.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
}

function addFace(data: MeshData, x: number, y: number, z: number, id: number, faceIndex: number, shade: number) {
  const face = FACES[faceIndex];
  const base = data.positions.length / 3;
  const light = shade * face.light;
  for (const corner of face.corners) {
    const waterOffset = id === BLOCK.WATER && corner[1] === 1 ? 0.13 : 0;
    data.positions.push(x + corner[0], y + corner[1] - waterOffset, z + corner[2]);
    data.normals.push(...face.normal);
    data.colors.push(light, light, light);
  }
  addUv(data, tileFor(id, faceIndex));
  data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addPlant(data: MeshData, x: number, y: number, z: number, tile: number) {
  const planes = [
    [[0.12, 0, 0.12], [0.12, 0.9, 0.12], [0.88, 0.9, 0.88], [0.88, 0, 0.88]],
    [[0.88, 0, 0.12], [0.88, 0.9, 0.12], [0.12, 0.9, 0.88], [0.12, 0, 0.88]],
  ];
  for (const plane of planes) {
    const base = data.positions.length / 3;
    for (const point of plane) {
      data.positions.push(x + point[0], y + point[1], z + point[2]);
      data.normals.push(0, 1, 0);
      data.colors.push(1, 1, 1);
    }
    addUv(data, tile);
    data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function geometryFrom(data: MeshData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * TILE;
  canvas.height = ATLAS_ROWS * TILE;
  const ctx = canvas.getContext('2d')!;
  const tile = (id: number, base: string, colors: string[], density = 0.28) => {
    const ox = (id % ATLAS_COLUMNS) * TILE;
    const oy = Math.floor(id / ATLAS_COLUMNS) * TILE;
    ctx.fillStyle = base;
    ctx.fillRect(ox, oy, TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const r = hash2(x + id * 71, y * 7 + id * 13, 341);
        if (r < density) {
          ctx.fillStyle = colors[Math.floor(r / density * colors.length) % colors.length];
          ctx.fillRect(ox + x, oy + y, r < density * 0.3 ? 2 : 1, 1);
        }
      }
    }
  };
  tile(0, '#7eaf58', ['#96c86c', '#6f9e4d', '#88ba5c'], 0.3);
  tile(1, '#97704b', ['#a97c51', '#805a3d', '#aa8055'], 0.32);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(hash2(x, 3, 18) * 3);
    ctx.fillStyle = x % 3 === 0 ? '#87b75d' : '#78aa52';
    ctx.fillRect(16 + x, 0, 1, depth);
  }
  tile(2, '#96704d', ['#a77d56', '#805a3e', '#a87b50'], 0.34);
  tile(3, '#a4aaa0', ['#b5bab0', '#92998f', '#b0b5aa'], 0.27);
  tile(4, '#9a7046', ['#aa7e4d', '#805b39', '#b08651'], 0.2);
  for (let x = 0; x < 16; x += 4) {
    ctx.fillStyle = x % 8 ? '#805b39' : '#b08350';
    ctx.fillRect(4 * TILE + x, 0, 1, 16);
  }
  tile(5, '#c59b65', ['#d4ad77', '#b58955'], 0.16);
  ctx.strokeStyle = '#9d774a';
  ctx.strokeRect(5 * TILE + 3.5, 3.5, 9, 9);
  ctx.strokeRect(5 * TILE + 6.5, 6.5, 3, 3);
  tile(6, '#6da353', ['#83b960', '#568d46', '#78ae57', '#96c471'], 0.43);
  tile(7, '#dfcf9b', ['#e9dbaa', '#d2c08b', '#e3d3a0'], 0.27);
  tile(8, '#6ab5be', ['#80c5cb', '#5daab6', '#a0d4d3'], 0.13);
  tile(9, '#c99d68', ['#d7ad78', '#bb8e5b'], 0.17);
  ctx.fillStyle = '#a77b4b';
  for (let y = 3; y < 16; y += 5) ctx.fillRect(TILE + 0, TILE + y, 16, 1);
  tile(10, '#aab0a5', ['#bbc0b5', '#9aa197'], 0.17);
  ctx.fillStyle = '#818b80';
  for (let y = 0; y < 16; y += 5) {
    ctx.fillRect(2 * TILE, TILE + y, 16, 1);
    for (let x = (y % 10 ? 4 : 0); x < 16; x += 8) ctx.fillRect(2 * TILE + x, TILE + y, 1, 5);
  }
  tile(11, '#929c90', ['#a8b0a4', '#7f8a80', '#b3baae'], 0.34);
  tile(12, '#568b5b', ['#6ba36b', '#43794d', '#78ad75'], 0.42);
  tile(13, '#dfcda0', ['#ebdab1', '#ccb98a'], 0.17);
  tile(14, '#e5e5d8', ['#f5f3e9', '#d2d4c8'], 0.3);

  const plant = (id: number, flower?: string) => {
    const ox = (id % ATLAS_COLUMNS) * TILE;
    const oy = Math.floor(id / ATLAS_COLUMNS) * TILE;
    ctx.clearRect(ox, oy, TILE, TILE);
    ctx.fillStyle = '#57944b';
    ctx.fillRect(ox + 7, oy + 5, 2, 11);
    ctx.fillRect(ox + 4, oy + 10, 3, 2);
    ctx.fillRect(ox + 9, oy + 8, 3, 2);
    ctx.fillStyle = '#7cad54';
    ctx.fillRect(ox + 3, oy + 8, 2, 4);
    ctx.fillRect(ox + 11, oy + 6, 2, 4);
    if (flower) {
      ctx.fillStyle = flower;
      ctx.fillRect(ox + 5, oy + 3, 6, 4);
      ctx.fillRect(ox + 6, oy + 1, 4, 8);
      ctx.fillStyle = '#e9bb54';
      ctx.fillRect(ox + 7, oy + 4, 2, 2);
    }
  };
  plant(15);
  plant(16, '#f8f5e8');
  plant(17, '#f6d45e');
  plant(18, '#e58576');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class VoxelWorld {
  readonly chunks = new Map<string, Chunk>();
  readonly edits: Record<string, number>;
  private editsByChunk = new Map<string, Map<string, number>>();
  private pending = new Set<string>();
  private center = '';
  private atlas = makeAtlas();
  private terrainMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
  private waterMaterial = new THREE.MeshPhongMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, shininess: 80, specular: 0x9cdbd5 });
  private plantMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });

  constructor(private scene: THREE.Scene, readonly seed: number, edits: Record<string, number> = {}, private viewRadius = 3) {
    this.edits = { ...edits };
    for (const [key, id] of Object.entries(this.edits)) {
      const [x, , z] = key.split(',').map(Number);
      const ck = chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      if (!this.editsByChunk.has(ck)) this.editsByChunk.set(ck, new Map());
      this.editsByChunk.get(ck)!.set(key, id);
    }
  }

  get pendingCount() { return this.pending.size; }

  updateStreaming(x: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const center = chunkKey(cx, cz);
    if (center === this.center) return;
    this.center = center;
    const wanted: [number, number][] = [];
    for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
      for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) wanted.push([cx + dx, cz + dz]);
    }
    wanted.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cz) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2));
    for (const [x1, z1] of wanted) {
      const key = chunkKey(x1, z1);
      if (!this.chunks.has(key)) {
        this.chunks.set(key, this.generateChunk(x1, z1));
        this.pending.add(key);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const neighbor = chunkKey(x1 + dx, z1 + dz);
          if (this.chunks.has(neighbor)) this.pending.add(neighbor);
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.x - cx) > this.viewRadius + 1 || Math.abs(chunk.z - cz) > this.viewRadius + 1) {
        this.removeChunk(chunk);
        this.chunks.delete(key);
        this.pending.delete(key);
      }
    }
  }

  processQueue(limit = 2) {
    for (let i = 0; i < limit && this.pending.size; i++) {
      const key = this.pending.values().next().value as string;
      this.pending.delete(key);
      const chunk = this.chunks.get(key);
      if (chunk) this.rebuild(chunk);
    }
  }

  private generateChunk(cx: number, cz: number): Chunk {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    this.scene.add(group);
    const put = (x: number, y: number, z: number, id: number, onlyAir = false) => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      const index = indexOf(x, y, z);
      if (!onlyAir || blocks[index] === BLOCK.AIR) blocks[index] = id;
    };

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const h = terrainHeight(wx, wz, this.seed);
        const sandy = h <= WATER_LEVEL + 1;
        for (let y = 0; y <= h; y++) {
          const id = y === h ? (sandy ? BLOCK.SAND : BLOCK.GRASS) : y > h - 4 ? (sandy ? BLOCK.SAND : BLOCK.DIRT) : BLOCK.STONE;
          put(x, y, z, id);
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) put(x, y, z, BLOCK.WATER);
      }
    }

    // Include neighboring tree origins so canopies are seamless at chunk edges.
    for (let wz = cz * CHUNK_SIZE - 3; wz < (cz + 1) * CHUNK_SIZE + 3; wz++) {
      for (let wx = cx * CHUNK_SIZE - 3; wx < (cx + 1) * CHUNK_SIZE + 3; wx++) {
        if (!hasTree(wx, wz, this.seed)) continue;
        const localX = wx - cx * CHUNK_SIZE;
        const localZ = wz - cz * CHUNK_SIZE;
        const ground = terrainHeight(wx, wz, this.seed);
        const pine = biomeAt(wx, wz, this.seed) === 'Pine woodland';
        const trunk = (pine ? 5 : 4) + Math.floor(hash2(wx, wz, this.seed + 44) * 2);
        const leaves = pine ? BLOCK.PINE_LEAVES : BLOCK.LEAVES;
        for (let y = 1; y <= trunk; y++) put(localX, ground + y, localZ, BLOCK.LOG);
        for (let dy = -2; dy <= 2; dy++) {
          const radius = pine ? (dy <= -1 ? 2 : dy === 0 ? 2 : 1) : (dy === 2 ? 1 : 2);
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 2 || hash2(wx + dx, wz + dz, this.seed + dy + 90) > 0.35)) continue;
              if (dx === 0 && dz === 0 && dy <= 0) continue;
              put(localX + dx, ground + trunk + dy, localZ + dz, leaves, true);
            }
          }
        }
      }
    }

    const changed = this.editsByChunk.get(chunkKey(cx, cz));
    if (changed) {
      for (const [key, id] of changed) {
        const [wx, y, wz] = key.split(',').map(Number);
        put(wx - cx * CHUNK_SIZE, y, wz - cz * CHUNK_SIZE, id);
      }
    }
    return { x: cx, z: cz, blocks, group };
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return BLOCK.STONE;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    return chunk.blocks[indexOf(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (y <= 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.blocks[indexOf(lx, y, lz)] = id;
    const key = blockKey(x, y, z);
    const ck = chunkKey(cx, cz);
    this.edits[key] = id;
    if (!this.editsByChunk.has(ck)) this.editsByChunk.set(ck, new Map());
    this.editsByChunk.get(ck)!.set(key, id);
    const affected = [[cx, cz]];
    if (lx === 0) affected.push([cx - 1, cz]);
    if (lx === CHUNK_SIZE - 1) affected.push([cx + 1, cz]);
    if (lz === 0) affected.push([cx, cz - 1]);
    if (lz === CHUNK_SIZE - 1) affected.push([cx, cz + 1]);
    for (const [ax, az] of affected) {
      const ckey = chunkKey(ax, az);
      const neighbor = this.chunks.get(ckey);
      if (neighbor) {
        this.pending.delete(ckey);
        this.rebuild(neighbor);
      }
    }
    return true;
  }

  private rebuild(chunk: Chunk) {
    while (chunk.group.children.length) {
      const child = chunk.group.children[0] as THREE.Mesh;
      chunk.group.remove(child);
      child.geometry.dispose();
    }
    const opaque = emptyMesh();
    const water = emptyMesh();
    const plants = emptyMesh();
    const { x: cx, z: cz, blocks } = chunk;
    const get = (x: number, y: number, z: number) => {
      if (y < 0) return BLOCK.STONE;
      if (y >= WORLD_HEIGHT) return BLOCK.AIR;
      if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) return blocks[indexOf(x, y, z)];
      return this.getBlock(cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z);
    };
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = blocks[indexOf(x, y, z)];
          if (!id) continue;
          const wx = cx * CHUNK_SIZE + x;
          const wz = cz * CHUNK_SIZE + z;
          const shade = 0.94 + hash2(wx, wz, this.seed + y * 19) * 0.1;
          for (let f = 0; f < FACES.length; f++) {
            const n = FACES[f].normal;
            const neighbor = get(x + n[0], y + n[1], z + n[2]);
            const visible = id === BLOCK.WATER ? neighbor === BLOCK.AIR : !isSolid(neighbor);
            if (visible) addFace(id === BLOCK.WATER ? water : opaque, x, y, z, id, f, shade);
          }
          if (id === BLOCK.GRASS && get(x, y + 1, z) === BLOCK.AIR) {
            const flower = hash2(wx, wz, this.seed + 847);
            const nearSpawn = (wx - 0.5) ** 2 + (wz + 12.5) ** 2 < 25;
            if (!nearSpawn && flower > 0.88) {
              const type = flower > 0.992 ? 18 : flower > 0.98 ? 17 : flower > 0.965 ? 16 : 15;
              addPlant(plants, x, y + 1, z, type);
            }
          }
        }
      }
    }
    if (opaque.indices.length) chunk.group.add(new THREE.Mesh(geometryFrom(opaque), this.terrainMaterial));
    if (plants.indices.length) chunk.group.add(new THREE.Mesh(geometryFrom(plants), this.plantMaterial));
    if (water.indices.length) {
      const mesh = new THREE.Mesh(geometryFrom(water), this.waterMaterial);
      mesh.renderOrder = 2;
      chunk.group.add(mesh);
    }
  }

  private removeChunk(chunk: Chunk) {
    while (chunk.group.children.length) {
      const child = chunk.group.children[0] as THREE.Mesh;
      chunk.group.remove(child);
      child.geometry.dispose();
    }
    this.scene.remove(chunk.group);
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.removeChunk(chunk);
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.waterMaterial.dispose();
    this.plantMaterial.dispose();
    this.atlas.dispose();
  }
}