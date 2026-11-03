import * as THREE from 'three';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  RENDER_TYPE,
  voxelIndex,
  chunkKey,
  worldToChunkCoord,
  worldToLocalCoord,
} from './constants.js';
import { BLOCK, getDef } from './blocks.js';
import { Chunk } from './chunk.js';
import { WorldGenerator } from './worldgen.js';
import { buildChunkMeshes, createVoxelMaterials } from './mesher.js';

const DIRS6 = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export class World {
  constructor(scene, textureManager, seed = 'TerraCraft', renderDistance = 5) {
    this.scene = scene;
    this.textureManager = textureManager;
    this.generator = new WorldGenerator(seed);
    this.renderDistance = renderDistance;

    this.chunks = new Map();
    // Persistent sparse modifications: Map<chunkKey, Map<voxelIdx, blockId>>
    this.edits = new Map();

    const mats = createVoxelMaterials(textureManager.atlasTexture);
    this.solidMaterial = mats.solidMat;
    this.fluidMaterial = mats.fluidMat;
    this.shaderUniforms = mats.sharedUniforms;

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.genQueue = [];
    this.meshQueue = [];
    this.fluidQueue = [];
    this.fluidTimer = 0;

    this.lastCenterCx = null;
    this.lastCenterCz = null;
  }

  get seed() {
    return this.generator.seedString;
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  getBlock(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk || !chunk.generated) return BLOCK.AIR;
    return chunk.get(worldToLocalCoord(wx), y, worldToLocalCoord(wz));
  }

  getSkyLight(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y >= CHUNK_HEIGHT) return 15;
    if (y < 0) return 0;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk || !chunk.lit) return 15;
    return chunk.getSkyLight(worldToLocalCoord(wx), y, worldToLocalCoord(wz));
  }

  getBlockLight(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk || !chunk.lit) return 0;
    return chunk.getBlockLight(worldToLocalCoord(wx), y, worldToLocalCoord(wz));
  }

  setSkyLightWorld(wx, wy, wz, val) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    chunk.setSkyLight(worldToLocalCoord(wx), wy, worldToLocalCoord(wz), val);
  }

  setBlockLightWorld(wx, wy, wz, val) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    chunk.setBlockLight(worldToLocalCoord(wx), wy, worldToLocalCoord(wz), val);
  }

  // Record edit & update world block immediately with lighting & remeshing
  setBlock(wx, wy, wz, blockId, recordEdit = true, onBreakDrop = null) {
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    const z = Math.floor(wz);
    if (y < 1 || y >= CHUNK_HEIGHT) return false;

    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk || !chunk.generated) return false;

    const lx = worldToLocalCoord(x);
    const lz = worldToLocalCoord(z);
    const prev = chunk.get(lx, y, lz);
    if (prev === blockId) return false;

    chunk.set(lx, y, lz, blockId);

    if (recordEdit) {
      let chunkEdits = this.edits.get(key);
      if (!chunkEdits) {
        chunkEdits = new Map();
        this.edits.set(key, chunkEdits);
      }
      chunkEdits.set(voxelIndex(lx, y, lz), blockId);
    }

    // Check unsupported flora/torches/cactus when breaking a block
    if (blockId === BLOCK.AIR) {
      const aboveId = this.getBlock(x, y + 1, z);
      const aboveDef = getDef(aboveId);
      if (aboveDef.renderType === RENDER_TYPE.CROSS || aboveId === BLOCK.CACTUS) {
        if (onBreakDrop) onBreakDrop(x, y + 1, z, aboveId);
        this.setBlock(x, y + 1, z, BLOCK.AIR, recordEdit, onBreakDrop);
      }
      // Check torches above or adjacent that may have lost their last support
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        const tx = x + dx, ty = y + dy, tz = z + dz;
        const tid = this.getBlock(tx, ty, tz);
        if (getDef(tid).renderType === RENDER_TYPE.TORCH) {
          const stillSupported =
            getDef(this.getBlock(tx, ty - 1, tz)).solid ||
            getDef(this.getBlock(tx + 1, ty, tz)).solid ||
            getDef(this.getBlock(tx - 1, ty, tz)).solid ||
            getDef(this.getBlock(tx, ty, tz + 1)).solid ||
            getDef(this.getBlock(tx, ty, tz - 1)).solid;
          if (!stillSupported) {
            if (onBreakDrop) onBreakDrop(tx, ty, tz, tid);
            this.setBlock(tx, ty, tz, BLOCK.AIR, recordEdit, onBreakDrop);
          }
        }
      }
      // Schedule neighboring water to flow into newly opened pocket
      this.enqueueFluidNeighbors(x, y, z);
    } else if (blockId === BLOCK.WATER) {
      this.fluidQueue.push({ x, y, z, depth: 0 });
    }

    // Recompute lighting for affected chunk and nearby border chunks
    const affectedChunks = new Set([chunk]);
    const borderDist = 14;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (dx === -1 && lx >= borderDist) continue;
        if (dx === 1 && lx < CHUNK_SIZE - borderDist) continue;
        if (dz === -1 && lz >= borderDist) continue;
        if (dz === 1 && lz < CHUNK_SIZE - borderDist) continue;
        const nc = this.getChunk(cx + dx, cz + dz);
        if (nc && nc.generated) affectedChunks.add(nc);
      }
    }

    for (const ac of affectedChunks) {
      this.computeChunkLighting(ac, false);
    }
    // Cross-chunk light bleed pass
    for (const ac of affectedChunks) {
      this.propagateBorderLight(ac);
    }
    // Immediate remesh of directly touched chunk + immediate edge neighbors for zero visual latency
    this.rebuildChunkMesh(chunk);
    if (lx === 0) this.rebuildIfLoaded(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.rebuildIfLoaded(cx + 1, cz);
    if (lz === 0) this.rebuildIfLoaded(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.rebuildIfLoaded(cx, cz + 1);

    for (const ac of affectedChunks) {
      if (ac !== chunk) this.markDirty(ac.cx, ac.cz);
    }

    return true;
  }

  rebuildIfLoaded(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c && c.generated) this.rebuildChunkMesh(c);
  }

  markDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c && c.generated && !c.dirty) {
      c.dirty = true;
      this.meshQueue.push(c);
    }
  }

  enqueueFluidNeighbors(x, y, z) {
    const checks = [
      [x, y + 1, z],
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];
    for (const [nx, ny, nz] of checks) {
      if (this.getBlock(nx, ny, nz) === BLOCK.WATER) {
        this.fluidQueue.push({ x: nx, y: ny, z: nz, depth: 0 });
      }
    }
  }

  stepFluids(dt) {
    if (this.fluidQueue.length === 0) return;
    this.fluidTimer += dt;
    if (this.fluidTimer < 0.22) return;
    this.fluidTimer = 0;

    const batch = this.fluidQueue.splice(0, 24);
    for (const item of batch) {
      const { x, y, z, depth } = item;
      if (this.getBlock(x, y, z) !== BLOCK.WATER) continue;
      if (depth > 4 || y <= 1) continue;

      const below = this.getBlock(x, y - 1, z);
      if (below === BLOCK.AIR || getDef(below).renderType === RENDER_TYPE.CROSS) {
        this.setBlock(x, y - 1, z, BLOCK.WATER, true);
        this.fluidQueue.push({ x, y: y - 1, z, depth: depth + 1 });
        continue;
      }

      // Spread horizontally up to 3 blocks if supported underneath
      if (depth < 3) {
        for (const [dx, , dz] of DIRS6) {
          if (dx === 0 && dz === 0) continue;
          const nx = x + dx;
          const nz = z + dz;
          if (this.getBlock(nx, y, nz) === BLOCK.AIR && getDef(this.getBlock(nx, y - 1, nz)).solid) {
            this.setBlock(nx, y, nz, BLOCK.WATER, true);
            this.fluidQueue.push({ x: nx, y, z: nz, depth: depth + 1 });
          }
        }
      }
    }
  }

  applySavedEditsToChunk(chunk) {
    const key = chunkKey(chunk.cx, chunk.cz);
    const chunkEdits = this.edits.get(key);
    if (!chunkEdits) return;
    for (const [idx, blockId] of chunkEdits.entries()) {
      chunk.voxels[idx] = blockId;
    }
  }

  computeChunkLighting(chunk, propagateNeighbors = true) {
    chunk.light.fill(0);

    const skyQueue = [];
    const blkQueue = [];

    // 1. Vertical sunlight columns + collect blocklight emitters
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        let sky = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const id = chunk.get(lx, y, lz);
          const def = getDef(id);

          if (def.opaque) {
            sky = 0;
          } else if (sky > 0) {
            const atten = Math.max(0, def.lightAttenuation - 1);
            sky = Math.max(0, sky - atten);
          }

          if (sky > 0) {
            chunk.setSkyLight(lx, y, lz, sky);
          }

          if (def.light > 0) {
            chunk.setBlockLight(lx, y, lz, def.light);
            blkQueue.push(lx, y, lz, def.light);
          }
        }
      }
    }

    // Seed skylight horizontal spread into shadowed overhangs inside chunk
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 1; y < CHUNK_HEIGHT - 1; y++) {
          const s = chunk.getSkyLight(lx, y, lz);
          if (s <= 1) continue;
          if (
            (lx > 0 && chunk.getSkyLight(lx - 1, y, lz) + 1 < s) ||
            (lx < 15 && chunk.getSkyLight(lx + 1, y, lz) + 1 < s) ||
            (lz > 0 && chunk.getSkyLight(lx, y, lz - 1) + 1 < s) ||
            (lz < 15 && chunk.getSkyLight(lx, y, lz + 1) + 1 < s)
          ) {
            skyQueue.push(lx, y, lz, s);
          }
        }
      }
    }

    // Intra-chunk skylight BFS
    let head = 0;
    while (head < skyQueue.length) {
      const x = skyQueue[head++];
      const y = skyQueue[head++];
      const z = skyQueue[head++];
      const val = skyQueue[head++];
      if (val <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS6[d][0];
        const ny = y + DIRS6[d][1];
        const nz = z + DIRS6[d][2];
        if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) continue;
        const nDef = getDef(chunk.get(nx, ny, nz));
        if (nDef.opaque) continue;
        const nextVal = val - Math.max(1, nDef.lightAttenuation);
        if (nextVal > chunk.getSkyLight(nx, ny, nz)) {
          chunk.setSkyLight(nx, ny, nz, nextVal);
          if (nextVal > 1) skyQueue.push(nx, ny, nz, nextVal);
        }
      }
    }

    // World-space blocklight BFS (can cross into loaded neighbor chunks!)
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    head = 0;
    while (head < blkQueue.length) {
      const lx = blkQueue[head++];
      const y = blkQueue[head++];
      const lz = blkQueue[head++];
      const val = blkQueue[head++];
      if (val <= 1) continue;

      const wx = baseX + lx;
      const wz = baseZ + lz;

      for (let d = 0; d < 6; d++) {
        const nwx = wx + DIRS6[d][0];
        const ny = y + DIRS6[d][1];
        const nwz = wz + DIRS6[d][2];
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

        const ncx = worldToChunkCoord(nwx);
        const ncz = worldToChunkCoord(nwz);
        const targetChunk = (ncx === chunk.cx && ncz === chunk.cz) ? chunk : this.getChunk(ncx, ncz);
        if (!targetChunk || !targetChunk.generated) continue;

        const nlx = worldToLocalCoord(nwx);
        const nlz = worldToLocalCoord(nwz);
        const nDef = getDef(targetChunk.get(nlx, ny, nlz));
        if (nDef.opaque) continue;

        const nextVal = val - Math.max(1, nDef.lightAttenuation);
        if (nextVal > targetChunk.getBlockLight(nlx, ny, nlz)) {
          targetChunk.setBlockLight(nlx, ny, nlz, nextVal);
          if (propagateNeighbors && targetChunk !== chunk) {
            targetChunk.dirty = true;
          }
          if (nextVal > 1) {
            blkQueue.push(nwx - baseX, ny, nwz - baseZ, nextVal);
          }
        }
      }
    }

    chunk.lit = true;
  }

  // Pull stronger light across the 4 borders from already-lit neighbors
  propagateBorderLight(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const queue = [];

    const checkEdge = (lx, lz, nwx, nwz) => {
      for (let y = 1; y < CHUNK_HEIGHT - 1; y++) {
        const def = getDef(chunk.get(lx, y, lz));
        if (def.opaque) continue;
        const nBlk = this.getBlockLight(nwx, y, nwz) - Math.max(1, def.lightAttenuation);
        if (nBlk > chunk.getBlockLight(lx, y, lz)) {
          chunk.setBlockLight(lx, y, lz, nBlk);
          queue.push(lx, y, lz, nBlk, 0);
        }
        const nSky = this.getSkyLight(nwx, y, nwz) - Math.max(1, def.lightAttenuation);
        if (nSky > chunk.getSkyLight(lx, y, lz)) {
          chunk.setSkyLight(lx, y, lz, nSky);
          queue.push(lx, y, lz, nSky, 1);
        }
      }
    };

    for (let i = 0; i < CHUNK_SIZE; i++) {
      checkEdge(0, i, baseX - 1, baseZ + i);
      checkEdge(15, i, baseX + 16, baseZ + i);
      checkEdge(i, 0, baseX + i, baseZ - 1);
      checkEdge(i, 15, baseX + i, baseZ + 16);
    }

    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      const val = queue[head++];
      const isSky = queue[head++];
      if (val <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS6[d][0];
        const ny = y + DIRS6[d][1];
        const nz = z + DIRS6[d][2];
        if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) continue;
        const nDef = getDef(chunk.get(nx, ny, nz));
        if (nDef.opaque) continue;
        const nextVal = val - Math.max(1, nDef.lightAttenuation);
        if (isSky) {
          if (nextVal > chunk.getSkyLight(nx, ny, nz)) {
            chunk.setSkyLight(nx, ny, nz, nextVal);
            queue.push(nx, ny, nz, nextVal, 1);
          }
        } else {
          if (nextVal > chunk.getBlockLight(nx, ny, nz)) {
            chunk.setBlockLight(nx, ny, nz, nextVal);
            queue.push(nx, ny, nz, nextVal, 0);
          }
        }
      }
    }
  }

  rebuildChunkMesh(chunk) {
    if (!chunk.generated) return;
    if (!chunk.lit) this.computeChunkLighting(chunk, false);

    chunk.disposeMeshes(this.chunkGroup);
    const { solidGeometry, fluidGeometry } = buildChunkMeshes(chunk, this, this.textureManager);

    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    if (solidGeometry) {
      const mesh = new THREE.Mesh(solidGeometry, this.solidMaterial);
      mesh.position.set(worldX, 0, worldZ);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.chunkGroup.add(mesh);
      chunk.solidMesh = mesh;
    }

    if (fluidGeometry) {
      const fMesh = new THREE.Mesh(fluidGeometry, this.fluidMaterial);
      fMesh.position.set(worldX, 0, worldZ);
      fMesh.renderOrder = 2;
      fMesh.matrixAutoUpdate = false;
      fMesh.updateMatrix();
      this.chunkGroup.add(fMesh);
      chunk.fluidMesh = fMesh;
    }

    chunk.dirty = false;
  }

  // Ensure immediate spawn chunks are ready synchronously so player never falls into unloaded void
  preloadSpawnArea(wx, wz, radius = 2) {
    const centerCx = worldToChunkCoord(wx);
    const centerCz = worldToChunkCoord(wz);

    const coords = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        coords.push([centerCx + dx, centerCz + dz]);
      }
    }

    for (const [cx, cz] of coords) {
      const key = chunkKey(cx, cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = new Chunk(cx, cz);
        this.chunks.set(key, chunk);
      }
      if (!chunk.generated) {
        this.generator.generateChunk(chunk);
        this.applySavedEditsToChunk(chunk);
      }
    }

    for (const [cx, cz] of coords) {
      const chunk = this.getChunk(cx, cz);
      this.computeChunkLighting(chunk, false);
    }

    for (const [cx, cz] of coords) {
      const chunk = this.getChunk(cx, cz);
      this.propagateBorderLight(chunk);
      this.rebuildChunkMesh(chunk);
    }
  }

  update(playerX, playerZ, dt, timeSec) {
    this.shaderUniforms.uTime.value = timeSec;
    this.stepFluids(dt);

    const centerCx = worldToChunkCoord(playerX);
    const centerCz = worldToChunkCoord(playerZ);

    if (centerCx !== this.lastCenterCx || centerCz !== this.lastCenterCz) {
      this.lastCenterCx = centerCx;
      this.lastCenterCz = centerCz;
      this.refreshStreamingQueues(centerCx, centerCz);
    }

    // Frame-budgeted chunk generation & meshing (prevents frame spikes)
    const startMs = performance.now();
    const budgetMs = 4.5;

    while (this.genQueue.length > 0 && performance.now() - startMs < budgetMs) {
      const chunk = this.genQueue.shift();
      if (!this.chunks.has(chunkKey(chunk.cx, chunk.cz))) continue;
      if (!chunk.generated) {
        this.generator.generateChunk(chunk);
        this.applySavedEditsToChunk(chunk);
        this.computeChunkLighting(chunk, true);
        this.meshQueue.push(chunk);
        // Mark neighbors dirty so border faces cull cleanly once neighbor arrives
        this.markDirty(chunk.cx - 1, chunk.cz);
        this.markDirty(chunk.cx + 1, chunk.cz);
        this.markDirty(chunk.cx, chunk.cz - 1);
        this.markDirty(chunk.cx, chunk.cz + 1);
      }
    }

    while (this.meshQueue.length > 0 && performance.now() - startMs < budgetMs + 1.5) {
      const chunk = this.meshQueue.shift();
      if (!this.chunks.has(chunkKey(chunk.cx, chunk.cz))) continue;
      if (chunk.dirty && chunk.generated) {
        this.propagateBorderLight(chunk);
        this.rebuildChunkMesh(chunk);
      }
    }
  }

  refreshStreamingQueues(centerCx, centerCz) {
    const R = this.renderDistance;
    const unloadR = R + 2;

    // Unload distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (Math.abs(chunk.cx - centerCx) > unloadR || Math.abs(chunk.cz - centerCz) > unloadR) {
        chunk.disposeMeshes(this.chunkGroup);
        this.chunks.delete(key);
      }
    }

    const needed = [];
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
        needed.push({ cx: centerCx + dx, cz: centerCz + dz, d2: dx * dx + dz * dz });
      }
    }
    needed.sort((a, b) => a.d2 - b.d2);

    this.genQueue.length = 0;
    this.meshQueue.length = 0;

    for (const { cx, cz } of needed) {
      const key = chunkKey(cx, cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = new Chunk(cx, cz);
        this.chunks.set(key, chunk);
      }
      if (!chunk.generated) {
        this.genQueue.push(chunk);
      } else if (chunk.dirty) {
        this.meshQueue.push(chunk);
      }
    }
  }

  setRenderDistance(dist) {
    this.renderDistance = Math.max(3, Math.min(8, dist | 0));
    if (this.lastCenterCx !== null) {
      this.refreshStreamingQueues(this.lastCenterCx, this.lastCenterCz);
    }
  }

  // Exact 3D DDA Voxel Raycast (Amanatides & Woo)
  raycast(origin, direction, maxDist = 6.0, includeFluids = false) {
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
    let t = 0;

    for (let i = 0; i < 64 && t <= maxDist; i++) {
      const blockId = this.getBlock(x, y, z);
      if (blockId !== BLOCK.AIR) {
        const def = getDef(blockId);
        const isFluid = def.renderType === RENDER_TYPE.FLUID;
        if (!isFluid || includeFluids) {
          return {
            hit: true,
            x, y, z,
            nx, ny, nz,
            px: x + nx,
            py: y + ny,
            pz: z + nz,
            blockId,
            def,
            distance: t,
          };
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          t = tMaxX;
          tMaxX += tDeltaX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          t = tMaxY;
          tMaxY += tDeltaY;
          nx = 0; ny = -stepY; nz = 0;
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      }
    }

    return { hit: false };
  }

  hasNearbyBlock(wx, wy, wz, radius, targetBlockId) {
    const r = Math.ceil(radius);
    const cx = Math.floor(wx);
    const cy = Math.floor(wy);
    const cz = Math.floor(wz);
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let z = cz - r; z <= cz + r; z++) {
          if (this.getBlock(x, y, z) === targetBlockId) return true;
        }
      }
    }
    return false;
  }

  getSurfaceY(wx, wz) {
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    for (let y = CHUNK_HEIGHT - 2; y >= 1; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR && getDef(id).solid) return y + 1;
    }
    return this.generator.sampleColumn(x, z).height + 1;
  }

  serializeEdits() {
    const out = {};
    for (const [key, map] of this.edits.entries()) {
      if (map.size === 0) continue;
      const pairs = [];
      for (const [idx, id] of map.entries()) {
        pairs.push(idx, id);
      }
      out[key] = pairs;
    }
    return out;
  }

  loadSerializedEdits(serialized) {
    this.edits.clear();
    if (!serialized || typeof serialized !== 'object') return;
    for (const [key, pairs] of Object.entries(serialized)) {
      if (!Array.isArray(pairs)) continue;
      const map = new Map();
      for (let i = 0; i < pairs.length; i += 2) {
        map.set(pairs[i], pairs[i + 1]);
      }
      this.edits.set(key, map);
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.disposeMeshes(this.chunkGroup);
    }
    this.chunks.clear();
    this.scene.remove(this.chunkGroup);
    this.solidMaterial.dispose();
    this.fluidMaterial.dispose();
  }
}
