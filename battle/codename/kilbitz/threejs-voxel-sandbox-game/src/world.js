import * as THREE from 'three';
import { B, BLOCKS, getBlock } from './blocks.js';
import { Noise } from './noise.js';
import { createWorldMaterials } from './textures.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 72;
export const SEA_LEVEL = 25;
const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.84 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.78 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.7 },
];

const chunkKey = (cx, cz) => `${cx},${cz}`;
const floorDiv = (n, d) => Math.floor(n / d);
const localPos = (n) => ((n % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
const indexOf = (x, y, z) => y * CHUNK_AREA + z * CHUNK_SIZE + x;

export class World {
  constructor(scene, seed, atlas, savedEdits = {}) {
    this.scene = scene;
    this.seed = seed;
    this.noise = new Noise(seed);
    this.atlas = atlas;
    this.materials = createWorldMaterials(atlas);
    this.group = new THREE.Group();
    this.group.name = 'Voxel world';
    scene.add(this.group);
    this.chunks = new Map();
    this.edits = new Map();
    this.desired = [];
    this.lastCenter = '';
    this.renderDistance = 4;
    this.loadedCount = 0;
    for (const [key, values] of Object.entries(savedEdits || {})) {
      this.edits.set(key, new Map(Object.entries(values).map(([index, id]) => [Number(index), Number(id)])));
    }
  }

  terrainHeight(x, z) {
    const continental = this.noise.fbm2(x * 0.0042, z * 0.0042, 4, 10);
    const hills = this.noise.fbm2(x * 0.016, z * 0.016, 4, 20);
    const mountainMask = Math.max(0, this.noise.fbm2(x * 0.005, z * 0.005, 3, 30) - 0.03);
    const ridge = this.noise.ridge2(x * 0.012, z * 0.012, 3, 40);
    const detail = this.noise.noise2(x * 0.055, z * 0.055, 50) * 1.3;
    return Math.max(5, Math.min(WORLD_HEIGHT - 9, Math.floor(28 + continental * 15 + hills * 5 + mountainMask * ridge * 43 + detail)));
  }

  biomeAt(x, z, height = this.terrainHeight(x, z)) {
    const temperature = this.noise.fbm2(x * 0.0031, z * 0.0031, 3, 100) - Math.max(0, height - 38) * 0.018;
    const moisture = this.noise.fbm2(x * 0.0047, z * 0.0047, 4, 200);
    if (height < SEA_LEVEL - 2) return { id: 'ocean', name: 'Shallow Ocean' };
    if (height <= SEA_LEVEL + 1) return { id: 'beach', name: 'Sunlit Beach' };
    if (height > 48 || temperature < -0.34) return { id: 'snow', name: 'Frostwood' };
    if (temperature > 0.18 && moisture < 0.04) return { id: 'desert', name: 'Amber Desert' };
    if (moisture > 0.31 && temperature > 0.02) return { id: 'jungle', name: 'Verdant Jungle' };
    if (height > 41) return { id: 'highlands', name: 'Highlands' };
    if (moisture > 0.07) return { id: 'forest', name: 'Old Growth Forest' };
    return { id: 'plains', name: 'Windgrass Plains' };
  }

  generateChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = new Uint8Array(CHUNK_AREA * WORLD_HEIGHT);
    const chunk = { cx, cz, key, data, group: new THREE.Group(), meshes: [], lights: [], dirty: true };
    chunk.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    chunk.group.name = `Chunk ${key}`;
    this.chunks.set(key, chunk);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = cx * CHUNK_SIZE + lx;
        const z = cz * CHUNK_SIZE + lz;
        const height = this.terrainHeight(x, z);
        const biome = this.biomeAt(x, z, height);
        for (let y = 0; y <= Math.max(height, SEA_LEVEL); y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y <= height) {
            const depth = height - y;
            if (biome.id === 'desert' || biome.id === 'beach') {
              id = depth === 0 ? B.SAND : depth < 4 ? B.SANDSTONE : B.STONE;
            } else if (biome.id === 'ocean') {
              const patch = this.noise.hash2(x, z, 310);
              id = depth === 0 ? (patch > 0.8 ? B.CLAY : patch > 0.62 ? B.GRAVEL : B.SAND) : depth < 3 ? B.SAND : B.STONE;
            } else if (biome.id === 'snow') {
              id = depth === 0 ? B.SNOW : depth < 3 ? B.DIRT : B.STONE;
            } else {
              id = depth === 0 ? B.GRASS : depth < 4 ? B.DIRT : B.STONE;
            }
            if (id === B.STONE && y > 2) {
              const ore = this.noise.hash3(x, y, z, 350);
              if (y < 17 && ore > 0.996) id = B.CRYSTAL_ORE;
              else if (y < 35 && ore > 0.988) id = B.IRON_ORE;
              else if (y < 51 && ore > 0.974) id = B.COAL_ORE;
              else if (y < 15 && ore < 0.0012) id = B.GLOWSTONE;
            }
            if (y > 3 && depth > 3 && y < height - 2) {
              const cave = this.noise.fbm3(x * 0.047, y * 0.07, z * 0.047, 2, 400);
              const tunnel = this.noise.noise3(x * 0.025, y * 0.045, z * 0.025, 440);
              if (cave > 0.37 || (Math.abs(tunnel) < 0.035 && y < height - 7)) id = B.AIR;
            }
          } else if (y <= SEA_LEVEL) id = B.WATER;
          if (id) data[indexOf(lx, y, lz)] = id;
        }
      }
    }

    this.decoratePlants(chunk);
    this.decorateTrees(chunk);
    const edits = this.edits.get(key);
    if (edits) for (const [index, id] of edits) data[index] = id;
    this.group.add(chunk.group);
    this.loadedCount++;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const neighbor = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (neighbor) neighbor.dirty = true;
    }
    return chunk;
  }

  decoratePlants(chunk) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = chunk.cx * CHUNK_SIZE + lx;
        const z = chunk.cz * CHUNK_SIZE + lz;
        const h = this.terrainHeight(x, z);
        if (h <= SEA_LEVEL + 1 || h + 1 >= WORLD_HEIGHT) continue;
        const biome = this.biomeAt(x, z, h);
        const ground = chunk.data[indexOf(lx, h, lz)];
        if (!ground || chunk.data[indexOf(lx, h + 1, lz)]) continue;
        const r = this.noise.hash2(x, z, 510);
        let id = B.AIR;
        if (ground === B.GRASS) {
          if (r > 0.955) id = B.TALL_GRASS;
          if (r > 0.982) id = B.FLOWER;
          if ((biome.id === 'forest' || biome.id === 'jungle') && r > 0.991) id = B.BERRY_BUSH;
          if (biome.id === 'plains' && r > 0.996) id = B.PUMPKIN;
        } else if (ground === B.SAND && biome.id === 'desert' && r > 0.992) id = B.CACTUS;
        if (id) chunk.data[indexOf(lx, h + 1, lz)] = id;
      }
    }
  }

  decorateTrees(chunk) {
    const cellSize = 7;
    const minCellX = Math.floor((chunk.cx * CHUNK_SIZE - 4) / cellSize);
    const maxCellX = Math.floor((chunk.cx * CHUNK_SIZE + CHUNK_SIZE + 4) / cellSize);
    const minCellZ = Math.floor((chunk.cz * CHUNK_SIZE - 4) / cellSize);
    const maxCellZ = Math.floor((chunk.cz * CHUNK_SIZE + CHUNK_SIZE + 4) / cellSize);
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const chance = this.noise.hash2(cellX, cellZ, 600);
        const x = cellX * cellSize + Math.floor(this.noise.hash2(cellX, cellZ, 601) * cellSize);
        const z = cellZ * cellSize + Math.floor(this.noise.hash2(cellX, cellZ, 602) * cellSize);
        const h = this.terrainHeight(x, z);
        if (h <= SEA_LEVEL + 1 || h > WORLD_HEIGHT - 15) continue;
        const biome = this.biomeAt(x, z, h);
        const density = { forest: 0.88, jungle: 0.95, snow: 0.65, highlands: 0.32, plains: 0.16 }[biome.id] || 0;
        if (chance > density) continue;
        this.paintTree(chunk, x, h + 1, z, biome.id);
      }
    }
  }

  paintTree(chunk, x, y, z, biome) {
    const pine = biome === 'snow' || (biome === 'highlands' && this.noise.hash2(x, z, 650) > 0.45);
    const jungle = biome === 'jungle';
    const trunkHeight = (pine ? 6 : jungle ? 8 : 4) + Math.floor(this.noise.hash2(x, z, 651) * (pine ? 3 : jungle ? 4 : 3));
    const log = pine ? B.PINE_LOG : B.OAK_LOG;
    const leaves = pine ? B.PINE_LEAVES : jungle ? B.JUNGLE_LEAVES : B.OAK_LEAVES;
    const set = (wx, wy, wz, id, replace = false) => {
      const lx = wx - chunk.cx * CHUNK_SIZE;
      const lz = wz - chunk.cz * CHUNK_SIZE;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || wy < 1 || wy >= WORLD_HEIGHT) return;
      const index = indexOf(lx, wy, lz);
      const current = chunk.data[index];
      const currentDef = getBlock(current);
      if (replace || current === B.AIR || !currentDef.solid || current === leaves) chunk.data[index] = id;
    };
    for (let dy = 0; dy < trunkHeight; dy++) set(x, y + dy, z, log, true);
    if (pine) {
      for (let dy = 2; dy <= trunkHeight + 1; dy++) {
        const fromTop = trunkHeight + 1 - dy;
        const radius = Math.max(1, Math.min(3, Math.floor(fromTop / 2) + (dy % 2 === 0 ? 1 : 0)));
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= radius + 1 && !(dx === 0 && dz === 0 && dy < trunkHeight)) set(x + dx, y + dy, z + dz, leaves);
        }
      }
    } else {
      const radius = jungle ? 3 : 2;
      for (let dy = trunkHeight - 3; dy <= trunkHeight + 1; dy++) {
        const layerRadius = dy >= trunkHeight ? Math.max(1, radius - 1) : radius;
        for (let dx = -layerRadius; dx <= layerRadius; dx++) for (let dz = -layerRadius; dz <= layerRadius; dz++) {
          const edge = Math.abs(dx) === layerRadius && Math.abs(dz) === layerRadius;
          if (!edge || this.noise.hash3(x + dx, y + dy, z + dz, 660) > 0.4) set(x + dx, y + dy, z + dz, leaves);
        }
      }
    }
  }

  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_HEIGHT) return B.AIR;
    const chunk = this.chunks.get(chunkKey(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE)));
    if (!chunk) return B.AIR;
    return chunk.data[indexOf(localPos(x), y, localPos(z))];
  }

  isSolid(x, y, z) {
    return getBlock(this.getBlock(x, y, z)).solid;
  }

  isWater(x, y, z) {
    return this.getBlock(x, y, z) === B.WATER;
  }

  setBlock(x, y, z, id, record = true) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 1 || y >= WORLD_HEIGHT) return false;
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key) || this.generateChunk(cx, cz);
    const lx = localPos(x); const lz = localPos(z);
    const index = indexOf(lx, y, lz);
    if (chunk.data[index] === id) return false;
    chunk.data[index] = id;
    if (record) {
      if (!this.edits.has(key)) this.edits.set(key, new Map());
      this.edits.get(key).set(index, id);
    }
    chunk.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  addFace(buffers, x, y, z, face, tile, id, worldX = x, worldZ = z) {
    const uv = this.atlas.tiles[tile] || this.atlas.tiles.stone;
    const base = buffers.positions.length / 3;
    const axes = [0, 1, 2].filter((axis) => face.n[axis] === 0);
    const variation = 0.96 + this.noise.hash3(worldX, y, worldZ, 750) * 0.07;
    for (let i = 0; i < 4; i++) {
      const corner = face.c[i];
      buffers.positions.push(x + corner[0], y + corner[1], z + corner[2]);
      buffers.normals.push(...face.n);
      buffers.uvs.push(i === 1 || i === 2 ? uv.u1 : uv.u0, i >= 2 ? uv.v1 : uv.v0);
      let ao = 1;
      if (getBlock(id).category !== 'water') {
        const origin = [worldX + face.n[0], y + face.n[1], worldZ + face.n[2]];
        const signs = axes.map((axis) => corner[axis] === 1 ? 1 : -1);
        const p1 = [...origin]; const p2 = [...origin]; const pc = [...origin];
        p1[axes[0]] += signs[0]; pc[axes[0]] += signs[0];
        p2[axes[1]] += signs[1]; pc[axes[1]] += signs[1];
        const s1 = getBlock(this.getBlock(...p1)).opaque ? 1 : 0;
        const s2 = getBlock(this.getBlock(...p2)).opaque ? 1 : 0;
        const sc = getBlock(this.getBlock(...pc)).opaque ? 1 : 0;
        ao = s1 && s2 ? 0.62 : 1 - (s1 + s2 + sc) * 0.095;
      }
      const shade = face.shade * ao * variation;
      buffers.colors.push(shade, shade, shade);
    }
    buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addCross(buffers, x, y, z, tile, scale = 1) {
    const uv = this.atlas.tiles[tile] || this.atlas.tiles.flower;
    const quads = [
      [[0.08, 0, 0.08], [0.92, 0, 0.92], [0.92, 1, 0.92], [0.08, 1, 0.08]],
      [[0.92, 0, 0.08], [0.08, 0, 0.92], [0.08, 1, 0.92], [0.92, 1, 0.08]],
    ];
    for (const quad of quads) {
      const base = buffers.positions.length / 3;
      for (let i = 0; i < 4; i++) {
        const c = quad[i];
        buffers.positions.push(x + 0.5 + (c[0] - 0.5) * scale, y + c[1] * scale, z + 0.5 + (c[2] - 0.5) * scale);
        buffers.normals.push(0, 1, 0);
        buffers.uvs.push(i === 1 || i === 2 ? uv.u1 : uv.u0, i >= 2 ? uv.v1 : uv.v0);
        buffers.colors.push(1, 1, 1);
      }
      buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  shouldDrawFace(id, neighborId) {
    if (neighborId === B.AIR) return true;
    const def = getBlock(id);
    const neighbor = getBlock(neighborId);
    if (def.category === 'water') return neighborId !== B.WATER && !neighbor.opaque;
    if (neighbor.opaque) return false;
    if (id === neighborId && (def.category === 'cutout' || def.category === 'water')) return false;
    return true;
  }

  buildChunkMesh(chunk) {
    for (const mesh of chunk.meshes) {
      chunk.group.remove(mesh);
      mesh.geometry.dispose();
    }
    chunk.meshes.length = 0;
    chunk.lights.length = 0;
    const categories = {};
    const getBuffers = (category) => categories[category] ||= { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.data[indexOf(lx, y, lz)];
          if (!id) continue;
          const def = getBlock(id);
          if (def.light && chunk.lights.length < 24) chunk.lights.push({ x: originX + lx + 0.5, y: y + 0.7, z: originZ + lz + 0.5, strength: def.light });
          const buffers = getBuffers(def.category);
          if (def.shape === 'cross') {
            this.addCross(buffers, lx, y, lz, def.tiles.side, id === B.TORCH ? 0.8 : 1);
            continue;
          }
          for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
            const face = FACES[faceIndex];
            const nx = originX + lx + face.n[0];
            const ny = y + face.n[1];
            const nz = originZ + lz + face.n[2];
            if (!this.shouldDrawFace(id, this.getBlock(nx, ny, nz))) continue;
            const tile = faceIndex === 2 ? def.tiles.top : faceIndex === 3 ? def.tiles.bottom : def.tiles.side;
            this.addFace(buffers, lx, y, lz, face, tile, id, originX + lx, originZ + lz);
          }
        }
      }
    }
    for (const [category, buffers] of Object.entries(categories)) {
      if (!buffers.indices.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
      geometry.setIndex(buffers.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.materials[category]);
      mesh.name = `${chunk.key} ${category}`;
      if (category === 'water') mesh.renderOrder = 2;
      chunk.group.add(mesh);
      chunk.meshes.push(mesh);
    }
    chunk.dirty = false;
  }

  rebuildDirtyAround(x, z) {
    const cx = floorDiv(x, CHUNK_SIZE); const cz = floorDiv(z, CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (chunk?.dirty) this.buildChunkMesh(chunk);
    }
  }

  update(position, renderDistance = this.renderDistance, budget = 1) {
    const cx = floorDiv(Math.floor(position.x), CHUNK_SIZE);
    const cz = floorDiv(Math.floor(position.z), CHUNK_SIZE);
    const center = `${cx},${cz},${renderDistance}`;
    if (center !== this.lastCenter) {
      this.lastCenter = center;
      this.renderDistance = renderDistance;
      this.desired = [];
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
          const distance = Math.sqrt(dx * dx + dz * dz);
          if (distance <= renderDistance + 0.45) this.desired.push({ cx: cx + dx, cz: cz + dz, distance });
        }
      }
      this.desired.sort((a, b) => a.distance - b.distance);
      const wanted = new Set(this.desired.map((c) => chunkKey(c.cx, c.cz)));
      for (const [key, chunk] of this.chunks) {
        const distance = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
        if (!wanted.has(key) && distance > renderDistance + 1) this.removeChunk(key);
      }
    }
    let work = 0;
    for (const entry of this.desired) {
      if (work >= budget) break;
      const key = chunkKey(entry.cx, entry.cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = this.generateChunk(entry.cx, entry.cz);
        this.buildChunkMesh(chunk);
        work++;
      } else if (chunk.dirty) {
        this.buildChunkMesh(chunk);
        work++;
      }
    }
    return { pending: this.desired.filter((c) => !this.chunks.has(chunkKey(c.cx, c.cz))).length, total: this.desired.length };
  }

  ensureAround(position, radius = 1) {
    const cx = floorDiv(Math.floor(position.x), CHUNK_SIZE);
    const cz = floorDiv(Math.floor(position.z), CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const chunk = this.generateChunk(cx + dx, cz + dz);
      this.buildChunkMesh(chunk);
    }
    this.lastCenter = '';
  }

  removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    for (const mesh of chunk.meshes) mesh.geometry.dispose();
    this.group.remove(chunk.group);
    this.chunks.delete(key);
    this.loadedCount--;
  }

  raycast(origin, direction, maxDistance = 5) {
    const dir = direction.clone().normalize();
    let x = Math.floor(origin.x); let y = Math.floor(origin.y); let z = Math.floor(origin.z);
    const stepX = dir.x >= 0 ? 1 : -1; const stepY = dir.y >= 0 ? 1 : -1; const stepZ = dir.z >= 0 ? 1 : -1;
    const deltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const deltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const deltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    let maxX = dir.x === 0 ? Infinity : (stepX > 0 ? x + 1 - origin.x : origin.x - x) * deltaX;
    let maxY = dir.y === 0 ? Infinity : (stepY > 0 ? y + 1 - origin.y : origin.y - y) * deltaY;
    let maxZ = dir.z === 0 ? Infinity : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * deltaZ;
    let distance = 0;
    const normal = new THREE.Vector3();
    for (let steps = 0; steps < 256 && distance <= maxDistance; steps++) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, normal: normal.clone(), distance };
      if (maxX < maxY && maxX < maxZ) {
        x += stepX; distance = maxX; maxX += deltaX; normal.set(-stepX, 0, 0);
      } else if (maxY < maxZ) {
        y += stepY; distance = maxY; maxY += deltaY; normal.set(0, -stepY, 0);
      } else {
        z += stepZ; distance = maxZ; maxZ += deltaZ; normal.set(0, 0, -stepZ);
      }
    }
    return null;
  }

  highestSolid(x, z, maxY = WORLD_HEIGHT - 1) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = Math.min(WORLD_HEIGHT - 1, Math.floor(maxY)); y >= 0; y--) {
      const def = getBlock(this.getBlock(x, y, z));
      if (def.solid && def.shape === 'cube') return y + 1;
    }
    return 0;
  }

  findSpawn() {
    for (let radius = 0; radius < 20; radius++) {
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * radius * 4);
        const z = Math.round(Math.sin(angle) * radius * 4);
        const h = this.terrainHeight(x, z);
        const biome = this.biomeAt(x, z, h);
        if (h > SEA_LEVEL + 2 && h < 48 && biome.id !== 'desert') return new THREE.Vector3(x + 0.5, h + 1.02, z + 0.5);
      }
    }
    const h = this.terrainHeight(0, 0);
    return new THREE.Vector3(0.5, Math.max(h, SEA_LEVEL) + 1.02, 0.5);
  }

  hasBlockNear(keyOrId, position, radius = 4) {
    const id = typeof keyOrId === 'number' ? keyOrId : BLOCKS.find((b) => b.key === keyOrId)?.id;
    if (!id) return false;
    const r = Math.ceil(radius);
    for (let y = Math.floor(position.y) - 2; y <= Math.floor(position.y) + 2; y++) {
      for (let z = Math.floor(position.z) - r; z <= Math.floor(position.z) + r; z++) {
        for (let x = Math.floor(position.x) - r; x <= Math.floor(position.x) + r; x++) {
          if (this.getBlock(x, y, z) === id) return true;
        }
      }
    }
    return false;
  }

  nearbyLights(position, radius = 14) {
    const result = [];
    const minCX = floorDiv(Math.floor(position.x - radius), CHUNK_SIZE);
    const maxCX = floorDiv(Math.floor(position.x + radius), CHUNK_SIZE);
    const minCZ = floorDiv(Math.floor(position.z - radius), CHUNK_SIZE);
    const maxCZ = floorDiv(Math.floor(position.z + radius), CHUNK_SIZE);
    for (let cz = minCZ; cz <= maxCZ; cz++) for (let cx = minCX; cx <= maxCX; cx++) {
      const chunk = this.chunks.get(chunkKey(cx, cz));
      if (!chunk) continue;
      for (const light of chunk.lights) {
        const distanceSq = (light.x - position.x) ** 2 + (light.y - position.y) ** 2 + (light.z - position.z) ** 2;
        if (distanceSq < radius * radius) result.push({ ...light, distanceSq });
      }
    }
    return result.sort((a, b) => a.distanceSq - b.distanceSq).slice(0, 6);
  }

  serializeEdits() {
    const output = {};
    for (const [key, values] of this.edits) {
      if (values.size) output[key] = Object.fromEntries(values);
    }
    return output;
  }

  animate(time) {
    const shader = this.materials.water.userData.shader;
    if (shader) shader.uniforms.uTime.value = time;
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this.removeChunk(key);
    this.scene.remove(this.group);
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
