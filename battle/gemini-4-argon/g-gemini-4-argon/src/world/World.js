import * as THREE from 'three';
import { BLOCK, REGISTRY, getBlockLight, isOpaqueBlock } from '../constants/Blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT, WorldGenerator, BIOME } from './WorldGen.js';
import { buildChunkGeometries } from './ChunkMesher.js';

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export function localIndex(lx, y, lz) {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export class Chunk {
  constructor(cx, cz, data) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
    this.blocks = data.blocks;
    this.biomes = data.biomes;
    this.heights = data.heights;
    this.skyLight = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.blockLight = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.lightSources = new Set();

    this.solidMesh = null;
    this.waterMesh = null;
    this.dirty = true;
    this.lightDirty = true;

    this.scanLightSources();
  }

  scanLightSources() {
    this.lightSources.clear();
    const len = this.blocks.length;
    for (let i = 0; i < len; i++) {
      if (getBlockLight(this.blocks[i]) > 0) {
        this.lightSources.add(i);
      }
    }
  }

  getLocal(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    return this.blocks[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  setLocal(lx, y, lz, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const i = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    this.blocks[i] = id;
    if (getBlockLight(id) > 0) this.lightSources.add(i);
    else this.lightSources.delete(i);
    this.dirty = true;
    this.lightDirty = true;
  }

  dispose(scene) {
    if (this.solidMesh) {
      scene.remove(this.solidMesh);
      this.solidMesh.geometry.dispose();
      this.solidMesh = null;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }
}

export class World {
  constructor(scene, atlas, seed = 'TerraCraft', initialEdits = null) {
    this.scene = scene;
    this.atlas = atlas;
    this.seed = seed;
    this.generator = new WorldGenerator(seed);
    this.chunks = new Map();
    this.edits = new Map(); // Map<chunkKey, Map<localIndex, blockId>>
    this.renderDistance = 5;
    this.fallingQueue = [];
    this.fallTimer = 0;

    if (initialEdits) {
      this.importEdits(initialEdits);
    }
  }

  importEdits(serializedEdits) {
    this.edits.clear();
    if (!serializedEdits) return;
    for (const [key, entries] of Object.entries(serializedEdits)) {
      const m = new Map();
      for (const [idxStr, blockId] of entries) {
        m.set(Number(idxStr), Number(blockId));
      }
      this.edits.set(key, m);
    }
  }

  exportEdits() {
    const out = {};
    for (const [key, map] of this.edits.entries()) {
      if (map.size > 0) {
        out[key] = Array.from(map.entries());
      }
    }
    return out;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const data = this.generator.generateChunk(cx, cz);
      const saved = this.edits.get(key);
      if (saved) {
        for (const [idx, blockId] of saved.entries()) {
          data.blocks[idx] = blockId;
        }
      }
      chunk = new Chunk(cx, cz, data);
      this.chunks.set(key, chunk);
      this.computeChunkSkyLight(chunk);

      // Mark immediate neighbors dirty so chunk borders cull & light seamlessly
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nb = this.getChunk(cx + dx, cz + dz);
        if (nb) {
          nb.dirty = true;
          nb.lightDirty = true;
        }
      }
    }
    return chunk;
  }

  getBlock(wx, wy, wz) {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);
    if (iy < 0) return BLOCK.BEDROCK;
    if (iy >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    return chunk.blocks[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getSkyLight(wx, wy, wz) {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);
    if (iy >= WORLD_HEIGHT) return 15;
    if (iy < 0) return 0;
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 15;
    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    return chunk.skyLight[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getVoxelLight(wx, wy, wz) {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);
    if (iy < 0 || iy >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    return chunk.blockLight[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getBiomeAt(wx, wz) {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      const lx = ix - cx * CHUNK_SIZE;
      const lz = iz - cz * CHUNK_SIZE;
      return chunk.biomes[lz * CHUNK_SIZE + lx] || BIOME.PLAINS;
    }
    return this.generator.getBiomeAt(ix, iz);
  }

  getSurfaceHeight(wx, wz) {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.ensureChunk(cx, cz);
    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
      const id = chunk.getLocal(lx, y, lz);
      const def = REGISTRY[id];
      if (def && (def.solid || def.liquid)) return y;
    }
    return 1;
  }

  computeChunkSkyLight(chunk) {
    const sky = chunk.skyLight;
    sky.fill(0);
    const queue = [];

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let level = 15;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const i = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          const id = chunk.blocks[i];
          if (isOpaqueBlock(id)) {
            level = 0;
          } else if (id === BLOCK.WATER || id === BLOCK.ICE) {
            level = Math.max(2, level - 2);
          } else if (
            id === BLOCK.OAK_LEAVES ||
            id === BLOCK.BIRCH_LEAVES ||
            id === BLOCK.SPRUCE_LEAVES
          ) {
            level = Math.max(4, level - 2);
          }
          sky[i] = level;
          if (level >= 3) {
            queue.push(lx, y, lz);
          }
        }
      }
    }

    // Intra-chunk horizontal daylight bleed into overhangs and cave mouths
    let head = 0;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]];
    while (head < queue.length) {
      const lx = queue[head++];
      const y = queue[head++];
      const lz = queue[head++];
      const cur = sky[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
      if (cur <= 2) continue;

      for (let d = 0; d < 6; d++) {
        const nx = lx + dirs[d][0];
        const ny = y + dirs[d][1];
        const nz = lz + dirs[d][2];
        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT) continue;
        const ni = (ny * CHUNK_SIZE + nz) * CHUNK_SIZE + nx;
        if (isOpaqueBlock(chunk.blocks[ni])) continue;
        const nextLevel = cur - 2;
        if (nextLevel > sky[ni]) {
          sky[ni] = nextLevel;
          if (nextLevel > 2) queue.push(nx, ny, nz);
        }
      }
    }
  }

  // Exact multi-source BFS for torch/crystal/furnace blockLight in chunk from 3x3 chunk neighborhood
  computeChunkBlockLight(chunk) {
    chunk.blockLight.fill(0);
    // Work in a padded 48 x WORLD_HEIGHT x 48 coordinate space centered on (chunk.cx - 1, chunk.cz - 1)
    // Wait: we only need light reaching [16..31] in X and Z, so [1..46] is sufficient!
    const SPAN = CHUNK_SIZE * 3;
    const visited = new Uint8Array(SPAN * WORLD_HEIGHT * SPAN);
    const queue = [];

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nb = this.getChunk(chunk.cx + dx, chunk.cz + dz);
        if (!nb || nb.lightSources.size === 0) continue;
        const offX = (dx + 1) * CHUNK_SIZE;
        const offZ = (dz + 1) * CHUNK_SIZE;
        for (const i of nb.lightSources) {
          const emit = getBlockLight(nb.blocks[i]);
          if (emit <= 0) continue;
          const lx = i % CHUNK_SIZE;
          const rem = (i / CHUNK_SIZE) | 0;
          const lz = rem % CHUNK_SIZE;
          const y = (rem / CHUNK_SIZE) | 0;
          const gx = offX + lx;
          const gz = offZ + lz;
          const vi = (y * SPAN + gz) * SPAN + gx;
          visited[vi] = emit;
          queue.push(gx, y, gz);
        }
      }
    }

    if (queue.length === 0) {
      chunk.lightDirty = false;
      return;
    }

    let head = 0;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    while (head < queue.length) {
      const gx = queue[head++];
      const y = queue[head++];
      const gz = queue[head++];
      const cur = visited[(y * SPAN + gz) * SPAN + gx];
      if (cur <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const nx = gx + dirs[d][0];
        const ny = y + dirs[d][1];
        const nz = gz + dirs[d][2];
        if (nx < 1 || nx >= SPAN - 1 || nz < 1 || nz >= SPAN - 1 || ny < 0 || ny >= WORLD_HEIGHT) continue;
        const vi = (ny * SPAN + nz) * SPAN + nx;
        if (visited[vi] >= cur - 1) continue;

        const ncx = chunk.cx - 1 + ((nx / CHUNK_SIZE) | 0);
        const ncz = chunk.cz - 1 + ((nz / CHUNK_SIZE) | 0);
        const nb = this.getChunk(ncx, ncz);
        if (!nb) continue;
        const nlx = nx % CHUNK_SIZE;
        const nlz = nz % CHUNK_SIZE;
        const blockId = nb.blocks[(ny * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx];
        if (isOpaqueBlock(blockId)) continue;

        visited[vi] = cur - 1;
        queue.push(nx, ny, nz);
      }
    }

    // Copy center [16..31] slice into chunk.blockLight
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const gz = CHUNK_SIZE + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const gx = CHUNK_SIZE + lx;
          const v = visited[(y * SPAN + gz) * SPAN + gx];
          if (v > 0) {
            chunk.blockLight[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = v;
          }
        }
      }
    }
    chunk.lightDirty = false;
  }

  rebuildChunkMesh(chunk) {
    if (chunk.lightDirty) {
      this.computeChunkBlockLight(chunk);
    }
    const { solidGeometry, waterGeometry } = buildChunkGeometries(this, chunk, this.atlas.uvMap);

    if (chunk.solidMesh) {
      this.scene.remove(chunk.solidMesh);
      chunk.solidMesh.geometry.dispose();
      chunk.solidMesh = null;
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    if (solidGeometry) {
      const mesh = new THREE.Mesh(solidGeometry, this.atlas.solidMaterial);
      mesh.position.set(baseX, 0, baseZ);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      chunk.solidMesh = mesh;
    }

    if (waterGeometry) {
      const wMesh = new THREE.Mesh(waterGeometry, this.atlas.waterMaterial);
      wMesh.position.set(baseX, 0, baseZ);
      wMesh.renderOrder = 2;
      wMesh.matrixAutoUpdate = false;
      wMesh.updateMatrix();
      this.scene.add(wMesh);
      chunk.waterMesh = wMesh;
    }

    chunk.dirty = false;
  }

  setBlock(wx, wy, wz, newId, immediate = true) {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);
    if (iy <= 0 || iy >= WORLD_HEIGHT) return false;

    const { cx, cz, lx, lz } = this.worldToChunk(ix, iz);
    const chunk = this.ensureChunk(cx, cz);
    const prevId = chunk.getLocal(lx, iy, lz);
    if (prevId === newId) return false;

    chunk.setLocal(lx, iy, lz, newId);

    // Record persistent delta
    let editMap = this.edits.get(chunk.key);
    if (!editMap) {
      editMap = new Map();
      this.edits.set(chunk.key, editMap);
    }
    editMap.set(localIndex(lx, iy, lz), newId);

    // If flora or torch rests above a broken block, pop it too
    if (newId === BLOCK.AIR) {
      const aboveId = this.getBlock(ix, iy + 1, iz);
      const aboveDef = REGISTRY[aboveId];
      if (aboveDef && (aboveDef.renderType === 'cross' || aboveId === BLOCK.TORCH || aboveId === BLOCK.CACTUS)) {
        this.setBlock(ix, iy + 1, iz, BLOCK.AIR, false);
      }
      // Simple water lateral fill at sea level or adjacent water
      if (iy <= 32) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.getBlock(ix + dx, iy, iz + dz) === BLOCK.WATER) {
            chunk.setLocal(lx, iy, lz, BLOCK.WATER);
            editMap.set(localIndex(lx, iy, lz), BLOCK.WATER);
            break;
          }
        }
      }
    }

    // Queue gravity check for sand/gravel column
    this.scheduleGravityCheck(ix, iy, iz);

    // Recompute skyLight on edited chunk
    this.computeChunkSkyLight(chunk);

    // Mark affected chunks (including light radius if light emitter changed)
    const lightChanged = getBlockLight(prevId) > 0 || getBlockLight(newId) > 0 || isOpaqueBlock(prevId) !== isOpaqueBlock(newId);
    const affected = new Set([chunk]);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const borderTouch =
          (dx === -1 && lx === 0) ||
          (dx === 1 && lx === CHUNK_SIZE - 1) ||
          (dz === -1 && lz === 0) ||
          (dz === 1 && lz === CHUNK_SIZE - 1);
        if (borderTouch || lightChanged) {
          const nb = this.getChunk(cx + dx, cz + dz);
          if (nb) {
            nb.dirty = true;
            if (lightChanged) nb.lightDirty = true;
            if (borderTouch || getBlockLight(prevId) > 0 || getBlockLight(newId) > 0) {
              affected.add(nb);
            }
          }
        }
      }
    }

    if (immediate) {
      for (const ch of affected) {
        this.rebuildChunkMesh(ch);
      }
    }

    return true;
  }

  scheduleGravityCheck(ix, iy, iz) {
    for (let checkY = iy; checkY <= Math.min(WORLD_HEIGHT - 2, iy + 6); checkY++) {
      const id = this.getBlock(ix, checkY, iz);
      if (REGISTRY[id]?.gravity) {
        const below = this.getBlock(ix, checkY - 1, iz);
        if (below === BLOCK.AIR || below === BLOCK.WATER || REGISTRY[below]?.replaceable) {
          this.fallingQueue.push({ x: ix, y: checkY, z: iz });
        }
      }
    }
  }

  // Update chunk streaming & falling sand around player
  update(px, pz, dt = 0.016, maxChunksPerFrame = 3) {
    // Process gravity sand/gravel ticks cleanly
    if (this.fallingQueue.length > 0) {
      this.fallTimer += dt;
      if (this.fallTimer >= 0.09) {
        this.fallTimer = 0;
        const batch = this.fallingQueue.splice(0, 12);
        for (const item of batch) {
          const id = this.getBlock(item.x, item.y, item.z);
          if (!REGISTRY[id]?.gravity) continue;
          const below = this.getBlock(item.x, item.y - 1, item.z);
          if (below === BLOCK.AIR || below === BLOCK.WATER || REGISTRY[below]?.replaceable) {
            this.setBlock(item.x, item.y, item.z, BLOCK.AIR, true);
            this.setBlock(item.x, item.y - 1, item.z, id, true);
            this.scheduleGravityCheck(item.x, item.y - 1, item.z);
          }
        }
      }
    }

    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const R = this.renderDistance;

    // Update fog range smoothly to match renderDistance
    const worldRadiusBlocks = R * CHUNK_SIZE;
    this.atlas.sharedUniforms.uFogNear.value = Math.max(24, worldRadiusBlocks * 0.56);
    this.atlas.sharedUniforms.uFogFar.value = Math.max(44, worldRadiusBlocks * 0.96);

    // Unload distant chunks beyond R + 2
    for (const [key, ch] of this.chunks.entries()) {
      if (Math.abs(ch.cx - pcx) > R + 2 || Math.abs(ch.cz - pcz) > R + 2) {
        ch.dispose(this.scene);
        this.chunks.delete(key);
      }
    }

    // Gather missing or dirty chunks sorted by distance from player
    const needed = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 0.5) * (R + 0.5)) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const existing = this.getChunk(cx, cz);
        if (!existing || existing.dirty) {
          needed.push({ cx, cz, d2 });
        }
      }
    }

    if (needed.length === 0) return;
    needed.sort((a, b) => a.d2 - b.d2);

    let built = 0;
    for (const item of needed) {
      const ch = this.ensureChunk(item.cx, item.cz);
      if (ch.dirty) {
        this.rebuildChunkMesh(ch);
        built++;
        if (built >= maxChunksPerFrame) break;
      }
    }
  }

  // Preload immediate spawn neighborhood synchronously so player never falls into unloaded air
  preloadAround(px, pz, radius = 2) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const ch = this.getChunk(pcx + dx, pcz + dz);
        if (ch) this.rebuildChunkMesh(ch);
      }
    }
  }

  dispose() {
    for (const ch of this.chunks.values()) {
      ch.dispose(this.scene);
    }
    this.chunks.clear();
  }
}
