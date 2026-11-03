// Chunk Lifecycle, Dynamic Streaming, Instant Edit Remeshing, and Delta Persistence State

import * as THREE from 'three';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK, isBlockSolid } from '../game/blocks.js';
import { buildChunkGeometries, createVoxelMaterials } from './mesher.js';
import { chunkIndex } from './worldGen.js';

export class ChunkManager {
  constructor(scene, worldGen, textureManager, initialRenderDistance = 6) {
    this.scene = scene;
    this.worldGen = worldGen;
    this.textureManager = textureManager;
    this.renderDistance = initialRenderDistance;

    this.materials = createVoxelMaterials(textureManager);
    this.chunkDataMap = new Map(); // "cx,cz" -> Uint8Array
    this.chunkMeshMap = new Map(); // "cx,cz" -> { solid, flora, water, cx, cz }
    this.deltas = new Map();       // "cx,cz" -> Map<localIdx, blockId> (only modified blocks!)
    this.dirtyQueue = [];
    this.dirtySet = new Set();

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.lastCenterCx = null;
    this.lastCenterCz = null;
    this.updateFogForDistance();
  }

  setRenderDistance(dist) {
    this.renderDistance = Math.max(3, Math.min(9, dist | 0));
    this.lastCenterCx = null;
    this.lastCenterCz = null;
    this.updateFogForDistance();
  }

  updateFogForDistance() {
    const far = this.renderDistance * CHUNK_SIZE * 0.96;
    const near = far * 0.48;
    this.materials.sharedUniforms.uFogNear.value = near;
    this.materials.sharedUniforms.uFogFar.value = far;
  }

  loadSavedDeltas(serializedDeltas) {
    this.deltas.clear();
    if (!serializedDeltas) return;
    for (const [chunkKey, entries] of Object.entries(serializedDeltas)) {
      const m = new Map();
      for (const [idxStr, blockId] of entries) {
        m.set(Number(idxStr), Number(blockId));
      }
      this.deltas.set(chunkKey, m);
    }
  }

  exportDeltas() {
    const out = {};
    for (const [chunkKey, map] of this.deltas.entries()) {
      if (map.size > 0) {
        out[chunkKey] = Array.from(map.entries());
      }
    }
    return out;
  }

  getModifiedBlockCount() {
    let count = 0;
    for (const m of this.deltas.values()) count += m.size;
    return count;
  }

  getOrCreateChunkData(cx, cz) {
    const key = `${cx},${cz}`;
    let data = this.chunkDataMap.get(key);
    if (!data) {
      data = this.worldGen.generateChunk(cx, cz);
      // Re-apply any saved player block modifications cleanly on top of procedural terrain!
      const deltaMap = this.deltas.get(key);
      if (deltaMap) {
        for (const [idx, blockId] of deltaMap.entries()) {
          data[idx] = blockId;
        }
      }
      this.chunkDataMap.set(key, data);
    }
    return data;
  }

  getBlock(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const data = this.getOrCreateChunkData(cx, cz);
    return data[chunkIndex(lx, y, lz)];
  }

  setBlock(wx, wy, wz, blockId, immediateRemesh = true) {
    const y = Math.floor(wy);
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const key = `${cx},${cz}`;
    const data = this.getOrCreateChunkData(cx, cz);
    const idx = chunkIndex(lx, y, lz);
    const prev = data[idx];
    if (prev === blockId) return false;

    data[idx] = blockId;

    // Record persistent delta
    let deltaMap = this.deltas.get(key);
    if (!deltaMap) {
      deltaMap = new Map();
      this.deltas.set(key, deltaMap);
    }
    deltaMap.set(idx, blockId);

    // Remesh edited chunk + any chunk within the 4-block torch/AO halo that shares lighting or faces!
    const affected = new Set([`${cx},${cz}`]);
    if (lx < 4) affected.add(`${cx - 1},${cz}`);
    if (lx >= CHUNK_SIZE - 4) affected.add(`${cx + 1},${cz}`);
    if (lz < 4) affected.add(`${cx},${cz - 1}`);
    if (lz >= CHUNK_SIZE - 4) affected.add(`${cx},${cz + 1}`);
    if (lx < 4 && lz < 4) affected.add(`${cx - 1},${cz - 1}`);
    if (lx >= CHUNK_SIZE - 4 && lz < 4) affected.add(`${cx + 1},${cz - 1}`);
    if (lx < 4 && lz >= CHUNK_SIZE - 4) affected.add(`${cx - 1},${cz + 1}`);
    if (lx >= CHUNK_SIZE - 4 && lz >= CHUNK_SIZE - 4) affected.add(`${cx + 1},${cz + 1}`);

    for (const k of affected) {
      const [acx, acz] = k.split(',').map(Number);
      if (immediateRemesh) {
        this.rebuildChunkMesh(acx, acz);
      } else {
        this.enqueueChunk(acx, acz);
      }
    }

    // Simple water spread if breaking a block right next to water!
    if (blockId === BLOCK.AIR) {
      const neighbors = [
        [x + 1, y, z],
        [x - 1, y, z],
        [x, y + 1, z],
        [x, y, z + 1],
        [x, y, z - 1],
      ];
      for (const [nx, ny, nz] of neighbors) {
        if (this.getBlock(nx, ny, nz) === BLOCK.WATER) {
          this.setBlock(x, y, z, BLOCK.WATER, immediateRemesh);
          break;
        }
      }
    }

    return true;
  }

  enqueueChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.dirtySet.has(key)) return;
    this.dirtySet.add(key);
    this.dirtyQueue.push({ cx, cz, key });
  }

  rebuildChunkMesh(cx, cz) {
    const key = `${cx},${cz}`;
    this.dirtySet.delete(key);

    this.disposeChunkMesh(key);

    const { solidGeo, floraGeo, waterGeo } = buildChunkGeometries(
      cx,
      cz,
      this,
      this.textureManager
    );

    const record = { cx, cz, solid: null, flora: null, water: null };

    if (solidGeo) {
      const mesh = new THREE.Mesh(solidGeo, this.materials.solidMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.rootGroup.add(mesh);
      record.solid = mesh;
    }
    if (floraGeo) {
      const mesh = new THREE.Mesh(floraGeo, this.materials.floraMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.rootGroup.add(mesh);
      record.flora = mesh;
    }
    if (waterGeo) {
      const mesh = new THREE.Mesh(waterGeo, this.materials.waterMaterial);
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.rootGroup.add(mesh);
      record.water = mesh;
    }

    this.chunkMeshMap.set(key, record);
  }

  disposeChunkMesh(key) {
    const existing = this.chunkMeshMap.get(key);
    if (!existing) return;
    for (const part of ['solid', 'flora', 'water']) {
      const mesh = existing[part];
      if (mesh) {
        this.rootGroup.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    this.chunkMeshMap.delete(key);
  }

  // Ensure spawn chunks are immediately generated & meshed so the player starts cleanly on solid ground
  warmStartAround(px, pz, radius = 3) {
    const centerCx = Math.floor(px / CHUNK_SIZE);
    const centerCz = Math.floor(pz / CHUNK_SIZE);
    const coords = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        coords.push({ cx: centerCx + dx, cz: centerCz + dz, d: dx * dx + dz * dz });
      }
    }
    coords.sort((a, b) => a.d - b.d);
    for (const c of coords) {
      this.rebuildChunkMesh(c.cx, c.cz);
    }
  }

  // Stream chunks smoothly around player with a frame-time budget so gameplay stays silky 60 FPS
  updateStreaming(px, pz, maxMsBudget = 7.5) {
    const centerCx = Math.floor(px / CHUNK_SIZE);
    const centerCz = Math.floor(pz / CHUNK_SIZE);
    const R = this.renderDistance;

    if (centerCx !== this.lastCenterCx || centerCz !== this.lastCenterCz) {
      this.lastCenterCx = centerCx;
      this.lastCenterCz = centerCz;

      const candidates = [];
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = `${cx},${cz}`;
          if (!this.chunkMeshMap.has(key) && !this.dirtySet.has(key)) {
            candidates.push({ cx, cz, distSq: dx * dx + dz * dz });
          }
        }
      }
      candidates.sort((a, b) => a.distSq - b.distSq);
      for (const c of candidates) {
        this.enqueueChunk(c.cx, c.cz);
      }

      // Unload distant meshes (while preserving chunk data/deltas cleanly)
      const unloadDistSq = (R + 2) * (R + 2);
      for (const [key, rec] of this.chunkMeshMap.entries()) {
        const dx = rec.cx - centerCx;
        const dz = rec.cz - centerCz;
        if (dx * dx + dz * dz > unloadDistSq) {
          this.disposeChunkMesh(key);
        }
      }

      // Evict far unmodified raw chunk arrays if cache grows large
      if (this.chunkDataMap.size > 420) {
        for (const key of this.chunkDataMap.keys()) {
          if (this.deltas.has(key)) continue;
          const [kcx, kcz] = key.split(',').map(Number);
          const dx = kcx - centerCx;
          const dz = kcz - centerCz;
          if (dx * dx + dz * dz > (R + 4) * (R + 4)) {
            this.chunkDataMap.delete(key);
          }
        }
      }
    }

    if (this.dirtyQueue.length === 0) return;

    // Sort closest dirty chunks first
    this.dirtyQueue.sort((a, b) => {
      const da = (a.cx - centerCx) ** 2 + (a.cz - centerCz) ** 2;
      const db = (b.cx - centerCx) ** 2 + (b.cz - centerCz) ** 2;
      return da - db;
    });

    const start = performance.now();
    let built = 0;
    while (this.dirtyQueue.length > 0) {
      const next = this.dirtyQueue.shift();
      this.dirtySet.delete(next.key);
      const dx = next.cx - centerCx;
      const dz = next.cz - centerCz;
      if (dx * dx + dz * dz <= (R + 1) * (R + 1)) {
        this.rebuildChunkMesh(next.cx, next.cz);
        built++;
      }
      if (built >= 1 && performance.now() - start >= maxMsBudget) break;
    }
  }

  // Find safe surface height at world (wx, wz) for spawning player or creatures
  findSurfaceY(wx, wz) {
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    for (let y = WORLD_HEIGHT - 2; y >= 1; y--) {
      const b = this.getBlock(x, y, z);
      if (isBlockSolid(b) || b === BLOCK.WATER) {
        return { y: y + 1, blockId: b, underwater: b === BLOCK.WATER && y >= SEA_LEVEL };
      }
    }
    return { y: SEA_LEVEL + 2, blockId: BLOCK.GRASS, underwater: false };
  }

  dispose() {
    for (const key of Array.from(this.chunkMeshMap.keys())) {
      this.disposeChunkMesh(key);
    }
    this.scene.remove(this.rootGroup);
    this.materials.solidMaterial.dispose();
    this.materials.floraMaterial.dispose();
    this.materials.waterMaterial.dispose();
    this.chunkDataMap.clear();
  }
}
