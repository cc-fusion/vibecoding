import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './constants.js';
import { BLOCK, REGISTRY } from './blocks.js';
import { TerrainGenerator } from './terrain.js';
import { computeChunkLighting } from './lighting.js';
import { buildChunkGeometries } from './mesher.js';

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export function worldToChunkCoord(w) {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocalCoord(w) {
  return ((Math.floor(w) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

export class World {
  constructor({ scene, seed, materials, uvMap, savedDeltas = null, renderDistance = 5 }) {
    this.scene = scene;
    this.seed = seed;
    this.materials = materials;
    this.uvMap = uvMap;
    this.renderDistance = renderDistance;

    this.terrain = new TerrainGenerator(seed);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.chunks = new Map();
    this.modifiedBlocks = new Map(); // chunkKey -> Map<linearIndex, blockId>

    if (savedDeltas) {
      this.importDeltas(savedDeltas);
    }

    this.genQueue = [];
    this.remeshQueue = new Set();
    this.waterQueue = [];
    this.waterTickAccum = 0;
    this.lastCenterKey = '';
  }

  importDeltas(deltasObj) {
    for (const [key, entries] of Object.entries(deltasObj)) {
      const m = new Map();
      for (let i = 0; i < entries.length; i++) {
        m.set(entries[i][0], entries[i][1]);
      }
      this.modifiedBlocks.set(key, m);
    }
  }

  exportDeltas() {
    const out = {};
    for (const [key, map] of this.modifiedBlocks.entries()) {
      if (map.size > 0) {
        out[key] = Array.from(map.entries());
      }
    }
    return out;
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  getChunkAtBlock(wx, wz) {
    return this.getChunk(worldToChunkCoord(wx), worldToChunkCoord(wz));
  }

  getBlock(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0) return BLOCK.BEDROCK;
    if (iy >= WORLD_HEIGHT) return BLOCK.AIR;
    const chunk = this.getChunkAtBlock(Math.floor(wx), Math.floor(wz));
    if (!chunk) return BLOCK.AIR;
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    return chunk.blocks[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getPackedLight(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy >= WORLD_HEIGHT) return 0xf0;
    if (iy < 0) return 0;
    const chunk = this.getChunkAtBlock(Math.floor(wx), Math.floor(wz));
    if (!chunk) return 0xf0;
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    return chunk.light[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getBiomeAt(wx, wz) {
    const chunk = this.getChunkAtBlock(Math.floor(wx), Math.floor(wz));
    if (chunk && chunk.biomeGrid) {
      const lx = worldToLocalCoord(wx);
      const lz = worldToLocalCoord(wz);
      return chunk.biomeGrid[lz * CHUNK_SIZE + lx];
    }
    return this.terrain.getBiomeAt(Math.floor(wx), Math.floor(wz));
  }

  getSurfaceHeight(wx, wz) {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.getChunkAtBlock(ix, iz);
    if (chunk) {
      const lx = worldToLocalCoord(ix);
      const lz = worldToLocalCoord(iz);
      for (let y = WORLD_HEIGHT - 2; y >= 1; y--) {
        const id = chunk.blocks[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
        if (id !== BLOCK.AIR && REGISTRY[id]?.solid) return y;
      }
    }
    return this.terrain.sampleColumnInfo(ix, iz).height;
  }

  ensureChunkData(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const { blocks, biomeGrid, heightGrid } = this.terrain.generateChunk(cx, cz);

    // Replay saved player modifications
    const saved = this.modifiedBlocks.get(key);
    if (saved) {
      for (const [idx, val] of saved.entries()) {
        blocks[idx] = val;
      }
    }

    chunk = {
      cx,
      cz,
      key,
      blocks,
      biomeGrid,
      heightGrid,
      light: new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE),
      lightSources: [],
      lightReady: false,
      solidMesh: null,
      fluidMesh: null,
      dirty: true,
    };

    this.chunks.set(key, chunk);
    computeChunkLighting(chunk, this);
    return chunk;
  }

  rebuildChunkMesh(chunk) {
    if (!chunk) return;
    if (!chunk.lightReady) computeChunkLighting(chunk, this);

    const { solidGeo, fluidGeo } = buildChunkGeometries(chunk, this, this.uvMap);

    if (chunk.solidMesh) {
      this.group.remove(chunk.solidMesh);
      chunk.solidMesh.geometry.dispose();
      chunk.solidMesh = null;
    }
    if (chunk.fluidMesh) {
      this.group.remove(chunk.fluidMesh);
      chunk.fluidMesh.geometry.dispose();
      chunk.fluidMesh = null;
    }

    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    if (solidGeo) {
      const mesh = new THREE.Mesh(solidGeo, this.materials.solidMaterial);
      mesh.position.set(worldX, 0, worldZ);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.solidMesh = mesh;
    }

    if (fluidGeo) {
      const mesh = new THREE.Mesh(fluidGeo, this.materials.fluidMaterial);
      mesh.position.set(worldX, 0, worldZ);
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.fluidMesh = mesh;
    }

    chunk.dirty = false;
  }

  /**
   * Synchronously generates an initial area around spawn so player never falls into unloaded air.
   */
  preloadAround(wx, wz, radius = 2) {
    const pcx = worldToChunkCoord(wx);
    const pcz = worldToChunkCoord(wz);
    const coords = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        coords.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
    }
    coords.sort((a, b) => a[2] - b[2]);

    for (const [cx, cz] of coords) {
      this.ensureChunkData(cx, cz);
    }
    // Re-run lighting once neighbors exist so cross-chunk skylight/torches are seamless
    for (const [cx, cz] of coords) {
      const ch = this.getChunk(cx, cz);
      computeChunkLighting(ch, this);
    }
    for (const [cx, cz] of coords) {
      const ch = this.getChunk(cx, cz);
      this.rebuildChunkMesh(ch);
    }
  }

  setBlock(wx, y, wz, newId, recordDelta = true) {
    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);
    if (iy < 0 || iy >= WORLD_HEIGHT) return false;

    const cx = worldToChunkCoord(ix);
    const cz = worldToChunkCoord(iz);
    const chunk = this.ensureChunkData(cx, cz);
    const lx = worldToLocalCoord(ix);
    const lz = worldToLocalCoord(iz);
    const linearIdx = (iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    const oldId = chunk.blocks[linearIdx];
    if (oldId === newId) return false;

    chunk.blocks[linearIdx] = newId;

    if (recordDelta) {
      let deltaMap = this.modifiedBlocks.get(chunk.key);
      if (!deltaMap) {
        deltaMap = new Map();
        this.modifiedBlocks.set(chunk.key, deltaMap);
      }
      deltaMap.set(linearIdx, newId);
    }

    // Clean up unsupported flora/torches directly above if block broken
    const poppedDrops = [];
    if (newId === BLOCK.AIR && iy + 1 < WORLD_HEIGHT) {
      const aboveId = this.getBlock(ix, iy + 1, iz);
      const aboveDef = REGISTRY[aboveId];
      if (aboveDef && (aboveDef.renderType === 'cross' || aboveDef.renderType === 'torch' || aboveId === BLOCK.CACTUS)) {
        chunk.blocks[((iy + 1) * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = BLOCK.AIR;
        if (recordDelta) {
          this.modifiedBlocks.get(chunk.key).set(((iy + 1) * CHUNK_SIZE + lz) * CHUNK_SIZE + lx, BLOCK.AIR);
        }
        const dropId = aboveDef.drop !== undefined ? aboveDef.drop : aboveId;
        if (dropId !== BLOCK.AIR) {
          poppedDrops.push({ id: dropId, x: ix + 0.5, y: iy + 1.3, z: iz + 0.5 });
        }
      }
    }

    // Trigger bounded cellular water flow if air opened next to water
    if (newId === BLOCK.AIR) {
      this.scheduleWaterCheck(ix, iy, iz);
    } else if (newId === BLOCK.WATER) {
      this.waterQueue.push({ x: ix, y: iy, z: iz, depth: 0 });
    }

    // Recompute lighting for affected chunk and any neighbors within light range
    const oldLight = REGISTRY[oldId]?.light || 0;
    const newLight = REGISTRY[newId]?.light || 0;
    const lightChanged = oldLight > 0 || newLight > 0;

    const dirtyChunks = new Set([chunk]);
    const checkNeighbor = (ncx, ncz) => {
      const nb = this.getChunk(ncx, ncz);
      if (nb) dirtyChunks.add(nb);
    };

    if (lightChanged) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          checkNeighbor(cx + dx, cz + dz);
        }
      }
    } else {
      if (lx === 0) checkNeighbor(cx - 1, cz);
      if (lx === CHUNK_SIZE - 1) checkNeighbor(cx + 1, cz);
      if (lz === 0) checkNeighbor(cx, cz - 1);
      if (lz === CHUNK_SIZE - 1) checkNeighbor(cx, cz + 1);
    }

    for (const ch of dirtyChunks) {
      computeChunkLighting(ch, this);
    }
    for (const ch of dirtyChunks) {
      this.rebuildChunkMesh(ch);
    }

    return { changed: true, oldId, poppedDrops };
  }

  scheduleWaterCheck(ix, iy, iz) {
    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1], [0, 0, -1],
    ];
    for (const [dx, dy, dz] of dirs) {
      if (this.getBlock(ix + dx, iy + dy, iz + dz) === BLOCK.WATER) {
        this.waterQueue.push({ x: ix, y: iy, z: iz, depth: 0 });
        break;
      }
    }
  }

  updateWaterFlow(dt) {
    if (this.waterQueue.length === 0) return;
    this.waterTickAccum += dt;
    if (this.waterTickAccum < 0.22) return;
    this.waterTickAccum = 0;

    const batch = this.waterQueue.splice(0, 12);
    for (const item of batch) {
      if (item.depth > 5) continue;
      const cur = this.getBlock(item.x, item.y, item.z);
      if (cur === BLOCK.AIR) {
        this.setBlock(item.x, item.y, item.z, BLOCK.WATER, true);
        // Flow straight down if air below
        if (item.y > 1 && this.getBlock(item.x, item.y - 1, item.z) === BLOCK.AIR) {
          this.waterQueue.push({ x: item.x, y: item.y - 1, z: item.z, depth: item.depth + 1 });
        } else if (item.y <= SEA_LEVEL) {
          // Level out coastal canals/ponds near sea level
          const hDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dz] of hDirs) {
            if (this.getBlock(item.x + dx, item.y, item.z + dz) === BLOCK.AIR) {
              this.waterQueue.push({ x: item.x + dx, y: item.y, z: item.z + dz, depth: item.depth + 1 });
            }
          }
        }
      }
    }
  }

  hasBlockNearby(wx, wy, wz, targetBlockId, radius = 4) {
    const bx = Math.floor(wx);
    const by = Math.floor(wy);
    const bz = Math.floor(wz);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (this.getBlock(bx + dx, by + dy, bz + dz) === targetBlockId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  updateStreaming(playerX, playerZ, dt) {
    this.updateWaterFlow(dt);

    const pcx = worldToChunkCoord(playerX);
    const pcz = worldToChunkCoord(playerZ);
    const centerKey = `${pcx},${pcz},${this.renderDistance}`;

    if (centerKey !== this.lastCenterKey) {
      this.lastCenterKey = centerKey;
      const r = this.renderDistance;
      const desired = [];

      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist2 = dx * dx + dz * dz;
          if (dist2 <= (r + 0.5) * (r + 0.5)) {
            desired.push({ cx: pcx + dx, cz: pcz + dz, dist2 });
          }
        }
      }
      desired.sort((a, b) => a.dist2 - b.dist2);
      this.genQueue = desired;

      // Unload chunks far outside render distance + 2
      const maxUnload2 = (r + 2.5) * (r + 2.5);
      for (const [key, ch] of this.chunks.entries()) {
        const dx = ch.cx - pcx;
        const dz = ch.cz - pcz;
        if (dx * dx + dz * dz > maxUnload2) {
          if (ch.solidMesh) {
            this.group.remove(ch.solidMesh);
            ch.solidMesh.geometry.dispose();
          }
          if (ch.fluidMesh) {
            this.group.remove(ch.fluidMesh);
            ch.fluidMesh.geometry.dispose();
          }
          this.chunks.delete(key);
        }
      }
    }

    // Time-budgeted chunk streaming (~5.5ms per frame max)
    const start = performance.now();
    let processed = 0;

    while (this.genQueue.length > 0 && processed < 2 && (performance.now() - start) < 5.5) {
      const next = this.genQueue.shift();
      const existing = this.getChunk(next.cx, next.cz);
      if (existing && !existing.dirty && existing.solidMesh) continue;

      const ch = this.ensureChunkData(next.cx, next.cz);
      computeChunkLighting(ch, this);
      this.rebuildChunkMesh(ch);

      // Queue neighbor seam refresh if already meshed so borders cull interior faces cleanly
      const nbs = [
        this.getChunk(next.cx - 1, next.cz),
        this.getChunk(next.cx + 1, next.cz),
        this.getChunk(next.cx, next.cz - 1),
        this.getChunk(next.cx, next.cz + 1),
      ];
      for (const nb of nbs) {
        if (nb && nb.solidMesh) {
          this.remeshQueue.add(nb.key);
        }
      }
      processed++;
    }

    if (this.remeshQueue.size > 0 && (performance.now() - start) < 6.0) {
      const firstKey = this.remeshQueue.values().next().value;
      this.remeshQueue.delete(firstKey);
      const nb = this.chunks.get(firstKey);
      if (nb) {
        computeChunkLighting(nb, this);
        this.rebuildChunkMesh(nb);
      }
    }
  }

  setRenderDistance(dist) {
    this.renderDistance = Math.max(3, Math.min(8, Math.round(dist)));
    this.lastCenterKey = '';
  }

  getStats() {
    let triangles = 0;
    for (const ch of this.chunks.values()) {
      if (ch.solidMesh?.geometry?.index) triangles += ch.solidMesh.geometry.index.count / 3;
      if (ch.fluidMesh?.geometry?.index) triangles += ch.fluidMesh.geometry.index.count / 3;
    }
    return {
      loadedChunks: this.chunks.size,
      triangles: Math.round(triangles),
    };
  }

  dispose() {
    for (const ch of this.chunks.values()) {
      if (ch.solidMesh) ch.solidMesh.geometry.dispose();
      if (ch.fluidMesh) ch.fluidMesh.geometry.dispose();
    }
    this.chunks.clear();
    this.scene.remove(this.group);
  }
}
