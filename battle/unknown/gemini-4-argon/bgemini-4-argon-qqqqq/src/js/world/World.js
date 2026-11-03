import { CHUNK_SIZE, CHUNK_VOLUME, DEFAULT_RENDER_DISTANCE, WORLD_HEIGHT } from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';
import { getEntry } from '../data/items.js';
import { getFuelBurnTime, getSmeltingResult } from '../data/recipes.js';
import { Chunk } from './Chunk.js';
import { ChunkMesher } from './ChunkMesher.js';
import { TerrainGenerator } from './TerrainGenerator.js';

export class World {
  constructor(scene, atlas, materials, seedInput = 'Voxterra') {
    this.scene = scene;
    this.atlas = atlas;
    this.materials = materials;

    this.generator = new TerrainGenerator(seedInput);
    this.seed = this.generator.seed;
    this.seedString = String(seedInput || this.seed);

    this.mesher = new ChunkMesher(atlas);
    this.chunks = new Map();
    this.modifiedVoxels = new Map(); // chunkKey -> Map<voxelIndex, blockId>

    this.chests = new Map();         // "x,y,z" -> Array(27)
    this.furnaces = new Map();       // "x,y,z" -> furnaceState

    this.renderDistance = DEFAULT_RENDER_DISTANCE;

    // Reusable typed arrays for fast BFS lighting
    this._bfsQueue = new Int32Array(CHUNK_VOLUME * 2);

    // Scheduled water updates
    this._waterQueue = [];
    this._waterTimer = 0;

    // Callback when breaking a block spawns dropped items
    this.onSpawnDrop = null;
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  coordKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getChunk(cx, cz) {
    return this.chunks.get(`${cx},${cz}`) || null;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return BLOCK.AIR;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.voxels[(wy << 8) | (lz << 4) | lx];
  }

  getSkyLight(wx, wy, wz) {
    if (wy >= WORLD_HEIGHT) return 15;
    if (wy < 0) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 15;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    if (!chunk._everLit) {
      return wy > chunk.heightMap[(lz << 4) | lx] ? 15 : 0;
    }
    return chunk.skyLight[(wy << 8) | (lz << 4) | lx];
  }

  getBlockLight(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 0;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.blockLight[(wy << 8) | (lz << 4) | lx];
  }

  getBiomeAt(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk) {
      const lx = wx - cx * CHUNK_SIZE;
      const lz = wz - cz * CHUNK_SIZE;
      return chunk.getBiomeAt(lx, lz);
    }
    return this.generator.sampleColumnCached(Math.floor(wx), Math.floor(wz)).biome;
  }

  ensureChunkGenerated(cx, cz) {
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    chunk = new Chunk(cx, cz);
    this.generator.generateChunk(chunk, (chestX, chestY, chestZ, lootSlots) => {
      const ck = this.coordKey(chestX, chestY, chestZ);
      if (!this.chests.has(ck)) {
        this.chests.set(ck, lootSlots);
      }
    });

    // Apply any saved player modifications for this chunk
    const mods = this.modifiedVoxels.get(key);
    if (mods) {
      for (const [idx, blockId] of mods.entries()) {
        chunk.voxels[idx] = blockId;
      }
      chunk.modified = true;
    }

    this.chunks.set(key, chunk);

    // Mark adjacent already-loaded chunks dirty so border faces & cross-chunk lights sync
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = this.chunks.get(`${cx + dx},${cz + dz}`);
      if (nb) {
        nb.lightDirty = true;
        nb.dirty = true;
      }
    }

    return chunk;
  }

  // Generate & mesh immediate spawn area synchronously so player stands on solid ground on frame 1
  preloadAround(wx, wz, radius = 2) {
    const pcx = Math.floor(wx / CHUNK_SIZE);
    const pcz = Math.floor(wz / CHUNK_SIZE);
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        this.ensureChunkGenerated(pcx + dx, pcz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (c) {
          this.recomputeChunkLighting(c);
        }
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (c) {
          this.mesher.buildChunkMeshes(c, this, this.materials, this.scene);
        }
      }
    }
  }

  // Set block in world with immediate remesh & neighbor updates
  setBlock(wx, wy, wz, blockId, recordMod = true, immediateMesh = true) {
    wx = Math.floor(wx);
    wy = Math.floor(wy);
    wz = Math.floor(wz);
    if (wy < 0 || wy >= WORLD_HEIGHT) return false;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;

    const chunk = this.ensureChunkGenerated(cx, cz);
    const idx = (wy << 8) | (lz << 4) | lx;
    const prevId = chunk.voxels[idx];
    if (prevId === blockId) return false;

    // Handle chest or furnace cleanup if destroyed
    const ck = this.coordKey(wx, wy, wz);
    if (prevId === BLOCK.CHEST && blockId !== BLOCK.CHEST) {
      const slots = this.chests.get(ck);
      if (slots && this.onSpawnDrop) {
        for (const s of slots) {
          if (s && s.count > 0) this.onSpawnDrop(wx + 0.5, wy + 0.5, wz + 0.5, s.id, s.count, s.durability);
        }
      }
      this.chests.delete(ck);
    }
    if ((prevId === BLOCK.FURNACE || prevId === BLOCK.FURNACE_LIT) &&
        blockId !== BLOCK.FURNACE && blockId !== BLOCK.FURNACE_LIT) {
      const fState = this.furnaces.get(ck);
      if (fState && this.onSpawnDrop) {
        for (const slot of [fState.input, fState.fuel, fState.output]) {
          if (slot && slot.count > 0) {
            this.onSpawnDrop(wx + 0.5, wy + 0.5, wz + 0.5, slot.id, slot.count, slot.durability);
          }
        }
      }
      this.furnaces.delete(ck);
    }

    chunk.voxels[idx] = blockId;
    chunk.dirty = true;
    chunk.lightDirty = true;

    if (recordMod) {
      chunk.modified = true;
      let map = this.modifiedVoxels.get(chunk.key);
      if (!map) {
        map = new Map();
        this.modifiedVoxels.set(chunk.key, map);
      }
      map.set(idx, blockId);
    }

    // Check unsupported flora/torch/cactus above if block became non-solid
    if (blockId === BLOCK.AIR || blockId === BLOCK.WATER) {
      const aboveId = this.getBlock(wx, wy + 1, wz);
      const aboveDef = BLOCKS[aboveId];
      if (aboveDef && (aboveDef.shape === 'cross' || aboveId === BLOCK.TORCH || aboveId === BLOCK.CACTUS)) {
        const drops = aboveDef.drop ? aboveDef.drop() : [{ id: aboveId, count: 1 }];
        this.setBlock(wx, wy + 1, wz, BLOCK.AIR, true, false);
        if (this.onSpawnDrop) {
          for (const d of drops) {
            if (d.count > 0) this.onSpawnDrop(wx + 0.5, wy + 1.3, wz + 0.5, d.id, d.count);
          }
        }
      }
      // Schedule adjacent water check
      this._enqueueWaterCheck(wx, wy, wz);
    } else if (blockId === BLOCK.WATER) {
      this._enqueueWaterCheck(wx, wy, wz);
    }

    const prevLight = BLOCKS[prevId]?.lightLevel || 0;
    const nextLight = BLOCKS[blockId]?.lightLevel || 0;
    const affectsLightWide = prevLight > 0 || nextLight > 0 || BLOCKS[prevId]?.opaque !== BLOCKS[blockId]?.opaque;

    const affectedChunks = new Set([chunk]);
    if (lx === 0 || affectsLightWide) {
      const nb = this.getChunk(cx - 1, cz);
      if (nb) affectedChunks.add(nb);
    }
    if (lx === CHUNK_SIZE - 1 || affectsLightWide) {
      const nb = this.getChunk(cx + 1, cz);
      if (nb) affectedChunks.add(nb);
    }
    if (lz === 0 || affectsLightWide) {
      const nb = this.getChunk(cx, cz - 1);
      if (nb) affectedChunks.add(nb);
    }
    if (lz === CHUNK_SIZE - 1 || affectsLightWide) {
      const nb = this.getChunk(cx, cz + 1);
      if (nb) affectedChunks.add(nb);
    }

    for (const c of affectedChunks) {
      c.lightDirty = true;
      c.dirty = true;
    }

    if (immediateMesh) {
      for (const c of affectedChunks) {
        this.recomputeChunkLighting(c);
      }
      for (const c of affectedChunks) {
        this.mesher.buildChunkMeshes(c, this, this.materials, this.scene);
      }
    }

    return true;
  }

  _enqueueWaterCheck(wx, wy, wz) {
    const candidates = [
      [wx, wy, wz],
      [wx + 1, wy, wz],
      [wx - 1, wy, wz],
      [wx, wy, wz + 1],
      [wx, wy, wz - 1],
      [wx, wy + 1, wz],
      [wx, wy - 1, wz],
    ];
    for (const [cx, cy, cz] of candidates) {
      if (this._waterQueue.length < 180) {
        this._waterQueue.push({ x: cx, y: cy, z: cz, steps: 4 });
      }
    }
  }

  _stepWaterSimulation(dt) {
    if (this._waterQueue.length === 0) return;
    this._waterTimer += dt;
    if (this._waterTimer < 0.22) return;
    this._waterTimer = 0;

    const batch = this._waterQueue.splice(0, 16);
    const touchedChunks = new Set();

    for (const item of batch) {
      if (item.steps <= 0) continue;
      const cur = this.getBlock(item.x, item.y, item.z);
      if (cur !== BLOCK.WATER) continue;

      // Flow downward into air if directly open
      if (item.y > 1 && this.getBlock(item.x, item.y - 1, item.z) === BLOCK.AIR) {
        this.setBlock(item.x, item.y - 1, item.z, BLOCK.WATER, true, false);
        const { cx, cz } = this.worldToChunk(item.x, item.z);
        const c = this.getChunk(cx, cz);
        if (c) touchedChunks.add(c);
        this._waterQueue.push({ x: item.x, y: item.y - 1, z: item.z, steps: item.steps - 1 });
        continue;
      }

      // Spread horizontally 1 step into adjacent air if supported below by solid block (canal filling!)
      if (item.steps >= 3 && item.y > 1) {
        const below = BLOCKS[this.getBlock(item.x, item.y - 1, item.z)];
        if (below && below.solid) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = item.x + dx;
            const nz = item.z + dz;
            if (this.getBlock(nx, item.y, nz) === BLOCK.AIR) {
              const nbBelow = BLOCKS[this.getBlock(nx, item.y - 1, nz)];
              if (nbBelow && nbBelow.solid) {
                this.setBlock(nx, item.y, nz, BLOCK.WATER, true, false);
                const { cx, cz } = this.worldToChunk(nx, nz);
                const c = this.getChunk(cx, cz);
                if (c) touchedChunks.add(c);
              }
            }
          }
        }
      }
    }

    for (const c of touchedChunks) {
      this.recomputeChunkLighting(c);
      this.mesher.buildChunkMeshes(c, this, this.materials, this.scene);
    }
  }

  recomputeChunkLighting(chunk) {
    const voxels = chunk.voxels;
    const sky = chunk.skyLight;
    const blk = chunk.blockLight;
    sky.fill(0);
    blk.fill(0);

    const q = this._bfsQueue;
    let head = 0;
    let tail = 0;

    // 1. Vertical SkyLight columns
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let light = 15;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const idx = (y << 8) | (lz << 4) | lx;
          const id = voxels[idx];
          if (id !== BLOCK.AIR) {
            const def = BLOCKS[id];
            if (def.opaque) {
              light = 0;
            } else if (id === BLOCK.WATER || id === BLOCK.ICE) {
              light = Math.max(0, light - 2);
            } else if (def.cutout && def.shape === 'cube') {
              // Tree leaves filter sunlight softly
              light = Math.max(0, light - 1);
            }
          }
          sky[idx] = light;
          if (light > 1) {
            q[tail++] = idx;
          }
        }
      }
    }

    // Seed skylight from 4 neighbor chunk edges if available
    const pullNeighborSky = (nbChunk, srcLxFn, dstLxFn, srcLzFn, dstLzFn) => {
      if (!nbChunk) return;
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const slx = srcLxFn(i);
        const dlx = dstLxFn(i);
        const slz = srcLzFn(i);
        const dlz = dstLzFn(i);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const nbL = nbChunk.skyLight[(y << 8) | (slz << 4) | slx];
          if (nbL <= 1) continue;
          const dstIdx = (y << 8) | (dlz << 4) | dlx;
          if (!BLOCKS[voxels[dstIdx]].opaque && nbL - 1 > sky[dstIdx]) {
            sky[dstIdx] = nbL - 1;
            q[tail++] = dstIdx;
          }
        }
      }
    };

    pullNeighborSky(this.getChunk(chunk.cx - 1, chunk.cz), () => 15, () => 0, (i) => i, (i) => i);
    pullNeighborSky(this.getChunk(chunk.cx + 1, chunk.cz), () => 0, () => 15, (i) => i, (i) => i);
    pullNeighborSky(this.getChunk(chunk.cx, chunk.cz - 1), (i) => i, (i) => i, () => 15, () => 0);
    pullNeighborSky(this.getChunk(chunk.cx, chunk.cz + 1), (i) => i, (i) => i, () => 0, () => 15);

    // Flood-fill SkyLight inside chunk
    while (head < tail) {
      const idx = q[head++];
      const curL = sky[idx];
      if (curL <= 1) continue;
      const nextL = curL - 1;

      const lx = idx & 15;
      const lz = (idx >> 4) & 15;
      const y = idx >> 8;

      if (lx > 0) {
        const n = idx - 1;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
      if (lx < 15) {
        const n = idx + 1;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
      if (lz > 0) {
        const n = idx - 16;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
      if (lz < 15) {
        const n = idx + 16;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
      if (y > 0) {
        const n = idx - 256;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
      if (y < WORLD_HEIGHT - 1) {
        const n = idx + 256;
        if (!BLOCKS[voxels[n]].opaque && sky[n] < nextL) { sky[n] = nextL; q[tail++] = n; }
      }
    }

    // 2. Emissive Block Light (Torches, Lit Furnaces, Glowstone) including emitters up to 14 blocks outside chunk
    head = 0;
    tail = 0;

    for (let idx = 0; idx < CHUNK_VOLUME; idx++) {
      const id = voxels[idx];
      if (id !== BLOCK.AIR) {
        const ll = BLOCKS[id].lightLevel;
        if (ll > 0) {
          blk[idx] = ll;
          q[tail++] = idx;
        }
      }
    }

    // Check adjacent chunks for emitters near border so torch light crosses chunk seams seamlessly!
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nb = this.getChunk(chunk.cx + dx, chunk.cz + dz);
        if (!nb) continue;
        const nbBaseX = nb.cx * CHUNK_SIZE;
        const nbBaseZ = nb.cz * CHUNK_SIZE;
        for (let idx = 0; idx < CHUNK_VOLUME; idx++) {
          const id = nb.voxels[idx];
          if (id === BLOCK.AIR) continue;
          const ll = BLOCKS[id].lightLevel;
          if (ll <= 1) continue;
          const nlx = idx & 15;
          const nlz = (idx >> 4) & 15;
          const ny = idx >> 8;
          const ewx = nbBaseX + nlx;
          const ewz = nbBaseZ + nlz;

          // Closest point in current chunk to emitter
          const clx = Math.max(0, Math.min(15, ewx - baseX));
          const clz = Math.max(0, Math.min(15, ewz - baseZ));
          const manhattan = Math.abs(ewx - (baseX + clx)) + Math.abs(ewz - (baseZ + clz));
          const rem = ll - manhattan;
          if (rem > 0) {
            const dstIdx = (ny << 8) | (clz << 4) | clx;
            if (!BLOCKS[voxels[dstIdx]].opaque && blk[dstIdx] < rem) {
              blk[dstIdx] = rem;
              q[tail++] = dstIdx;
            }
          }
        }
      }
    }

    while (head < tail) {
      const idx = q[head++];
      const curL = blk[idx];
      if (curL <= 1) continue;
      const nextL = curL - 1;

      const lx = idx & 15;
      const lz = (idx >> 4) & 15;
      const y = idx >> 8;

      if (lx > 0) {
        const n = idx - 1;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
      if (lx < 15) {
        const n = idx + 1;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
      if (lz > 0) {
        const n = idx - 16;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
      if (lz < 15) {
        const n = idx + 16;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
      if (y > 0) {
        const n = idx - 256;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
      if (y < WORLD_HEIGHT - 1) {
        const n = idx + 256;
        if (!BLOCKS[voxels[n]].opaque && blk[n] < nextL) { blk[n] = nextL; q[tail++] = n; }
      }
    }

    chunk.lightDirty = false;
    if (!chunk._everLit) {
      chunk._everLit = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = this.chunks.get(`${chunk.cx + dx},${chunk.cz + dz}`);
        if (nb && nb._everLit) {
          nb.dirty = true;
        }
      }
    }
  }

  // Stream chunks radially around player position, building a bounded budget per frame
  updateStreaming(playerX, playerZ, dt) {
    this._stepWaterSimulation(dt);

    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    const R = this.renderDistance;

    // 1. Unload distant chunks
    const unloadRadiusSq = (R + 2) * (R + 2);
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > unloadRadiusSq) {
        chunk.disposeMeshes(this.scene);
        this.chunks.delete(key);
      }
    }

    // 2. Gather missing chunks first & compute lighting immediately
    const toGenerate = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > R * R + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.chunks.has(`${cx},${cz}`)) {
          toGenerate.push({ cx, cz, distSq });
        }
      }
    }

    toGenerate.sort((a, b) => a.distSq - b.distSq);
    const genBudget = 3;
    for (let i = 0; i < Math.min(genBudget, toGenerate.length); i++) {
      const { cx, cz } = toGenerate[i];
      const c = this.ensureChunkGenerated(cx, cz);
      this.recomputeChunkLighting(c);
    }

    // 3. Gather dirty chunks & mesh radially
    const toMesh = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > R * R + 1) continue;
        const chunk = this.chunks.get(`${pcx + dx},${pcz + dz}`);
        if (chunk && (chunk.dirty || chunk.lightDirty)) {
          toMesh.push({ chunk, distSq });
        }
      }
    }

    toMesh.sort((a, b) => a.distSq - b.distSq);
    const meshBudget = 4;
    for (let i = 0; i < Math.min(meshBudget, toMesh.length); i++) {
      const c = toMesh[i].chunk;
      if (c.lightDirty) this.recomputeChunkLighting(c);
    }
    for (let i = 0; i < Math.min(meshBudget, toMesh.length); i++) {
      const c = toMesh[i].chunk;
      if (c.dirty) this.mesher.buildChunkMeshes(c, this, this.materials, this.scene);
    }
  }

  // Chest accessors
  getOrCreateChest(wx, wy, wz) {
    const ck = this.coordKey(wx, wy, wz);
    let slots = this.chests.get(ck);
    if (!slots) {
      slots = new Array(27).fill(null);
      this.chests.set(ck, slots);
    }
    return slots;
  }

  // Furnace accessors & live tick
  getOrCreateFurnace(wx, wy, wz) {
    const ck = this.coordKey(wx, wy, wz);
    let f = this.furnaces.get(ck);
    if (!f) {
      f = {
        x: wx,
        y: wy,
        z: wz,
        input: null,
        fuel: null,
        output: null,
        burnTime: 0,
        maxBurnTime: 1,
        cookTime: 0,
        reqCookTime: 6.5,
      };
      this.furnaces.set(ck, f);
    }
    return f;
  }

  updateFurnaces(dt) {
    let anyChanged = false;
    for (const f of this.furnaces.values()) {
      const wasBurning = f.burnTime > 0;
      const recipe = f.input && f.input.count > 0 ? getSmeltingResult(f.input.id) : null;
      const canOutput = recipe && (
        !f.output ||
        (f.output.id === recipe.id && f.output.count + recipe.count <= (getEntry(recipe.id)?.stackSize || 64))
      );

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
        anyChanged = true;
      }

      if (f.burnTime <= 0 && canOutput && f.fuel && f.fuel.count > 0) {
        const fuelVal = getFuelBurnTime(f.fuel.id);
        if (fuelVal > 0) {
          f.burnTime = fuelVal;
          f.maxBurnTime = fuelVal;
          f.fuel.count -= 1;
          if (f.fuel.count <= 0) f.fuel = null;
          anyChanged = true;
        }
      }

      if (f.burnTime > 0 && canOutput) {
        f.reqCookTime = recipe.cookTime;
        f.cookTime += dt;
        if (f.cookTime >= recipe.cookTime) {
          f.cookTime = 0;
          f.input.count -= 1;
          if (f.input.count <= 0) f.input = null;
          if (!f.output) {
            f.output = { id: recipe.id, count: recipe.count };
          } else {
            f.output.count += recipe.count;
          }
          anyChanged = true;
        }
      } else {
        if (f.cookTime > 0) {
          f.cookTime = Math.max(0, f.cookTime - dt * 1.5);
          anyChanged = true;
        }
      }

      const nowBurning = f.burnTime > 0;
      if (wasBurning !== nowBurning) {
        const curBlock = this.getBlock(f.x, f.y, f.z);
        if (curBlock === BLOCK.FURNACE || curBlock === BLOCK.FURNACE_LIT) {
          this.setBlock(f.x, f.y, f.z, nowBurning ? BLOCK.FURNACE_LIT : BLOCK.FURNACE, true, true);
        }
      }
    }
    return anyChanged;
  }

  // Exact Amanatides & Woo fast voxel traversal raycast
  raycast(origin, direction, maxDist = 5.5, includeWater = false) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

    let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let dist = 0;

    for (let i = 0; i < 64 && dist <= maxDist; i++) {
      if (y >= 0 && y < WORLD_HEIGHT) {
        const id = this.getBlock(x, y, z);
        if (id !== BLOCK.AIR && (includeWater || id !== BLOCK.WATER)) {
          // For half-height bed block, ensure ray actually intersects y..y+0.56 or step further
          if (id === BLOCK.BED_BLOCK) {
            const hitY = origin.y + dy * dist;
            if (hitY <= y + 0.62 || ny === 1) {
              return {
                x, y, z,
                blockId: id,
                normal: { x: nx, y: ny, z: nz },
                distance: dist,
                hitPos: {
                  x: origin.x + dx * dist,
                  y: origin.y + dy * dist,
                  z: origin.z + dz * dist,
                },
              };
            }
          } else {
            return {
              x, y, z,
              blockId: id,
              normal: { x: nx, y: ny, z: nz },
              distance: dist,
              hitPos: {
                x: origin.x + dx * dist,
                y: origin.y + dy * dist,
                z: origin.z + dz * dist,
              },
            };
          }
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          nx = 0; ny = -stepY; nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      }
    }
    return null;
  }

  // Serialize compact world deltas + containers for IndexedDB persistence
  serializeState() {
    const chunksObj = {};
    for (const [key, map] of this.modifiedVoxels.entries()) {
      if (map.size === 0) continue;
      const arr = [];
      for (const [idx, bid] of map.entries()) {
        arr.push(idx, bid);
      }
      chunksObj[key] = arr;
    }

    const chestsObj = {};
    for (const [ck, slots] of this.chests.entries()) {
      chestsObj[ck] = slots;
    }

    const furnacesObj = {};
    for (const [ck, f] of this.furnaces.entries()) {
      furnacesObj[ck] = { ...f };
    }

    return {
      seed: this.seed,
      seedString: this.seedString,
      chunks: chunksObj,
      chests: chestsObj,
      furnaces: furnacesObj,
    };
  }

  restoreState(data) {
    if (!data) return;
    this.modifiedVoxels.clear();
    if (data.chunks) {
      for (const [key, arr] of Object.entries(data.chunks)) {
        const map = new Map();
        for (let i = 0; i < arr.length; i += 2) {
          map.set(arr[i], arr[i + 1]);
        }
        this.modifiedVoxels.set(key, map);
      }
    }
    this.chests.clear();
    if (data.chests) {
      for (const [ck, slots] of Object.entries(data.chests)) {
        this.chests.set(ck, slots);
      }
    }
    this.furnaces.clear();
    if (data.furnaces) {
      for (const [ck, f] of Object.entries(data.furnaces)) {
        this.furnaces.set(ck, f);
      }
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.disposeMeshes(this.scene);
    }
    this.chunks.clear();
  }
}
