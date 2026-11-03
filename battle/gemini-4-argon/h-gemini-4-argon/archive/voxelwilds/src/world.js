import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from './constants.js';
import { BLOCK, getBlockDef, isOpaqueBlock, getLightEmission } from './blocks.js';
import { TerrainGenerator } from './terrain.js';
import { buildChunkGeometries } from './chunkMesher.js';

export class World {
  constructor({ scene, seed, textures, materials, renderDistance = 5, initialEdits = null }) {
    this.scene = scene;
    this.seed = seed;
    this.textures = textures;
    this.materials = materials;
    this.renderDistance = renderDistance;

    this.generator = new TerrainGenerator(seed);
    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    // Loaded chunks: key "cx,cz" -> chunk object
    this.chunks = new Map();
    // Persistent block edits across loaded & unloaded chunks: "cx,cz" -> Map<voxelIndex, blockId>
    this.edits = new Map();

    if (initialEdits) {
      this.importEdits(initialEdits);
    }

    this.dirtyChunks = new Set();
    this.loadQueue = [];
    this.lastCenterKey = '';
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  voxelIndex(lx, y, lz) {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz)) || null;
  }

  ensureChunkData(cx, cz) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const voxels = this.generator.generateChunkData(cx, cz);
    const chunkEdits = this.edits.get(key);
    if (chunkEdits) {
      for (const [vIdx, blockId] of chunkEdits.entries()) {
        voxels[vIdx] = blockId;
      }
    }

    chunk = {
      cx,
      cz,
      key,
      voxels,
      light: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
      lightDirty: true,
      opaqueMesh: null,
      cutoutMesh: null,
      waterMesh: null,
    };

    this.chunks.set(key, chunk);
    this.computeChunkLighting(chunk);
    return chunk;
  }

  getBlock(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= CHUNK_HEIGHT) return BLOCK.AIR;

    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;

    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.voxels[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getSkyLight(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y >= CHUNK_HEIGHT) return 15;
    if (y < 0) return 0;

    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return 15;

    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] >> 4;
  }

  getTorchLight(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;

    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return 0;

    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] & 15;
  }

  computeChunkLighting(chunk) {
    const { cx, cz, voxels, light } = chunk;
    light.fill(0);
    const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    // 1. Vertical Skylight column pass
    const skyQueue = [];
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let sky = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const i = idx(lx, y, lz);
          const b = voxels[i];
          if (isOpaqueBlock(b)) {
            sky = 0;
          } else if (b === BLOCK.WATER) {
            sky = Math.max(0, sky - 2);
          } else if (b !== BLOCK.AIR && getBlockDef(b).renderType === 'leaves') {
            sky = Math.max(0, sky - 1);
          }
          light[i] = sky << 4;
          if (sky > 1 && y < CHUNK_HEIGHT - 4) {
            // Seed horizontal skylight spread only near overhangs
            if (
              (lx > 0 && isOpaqueBlock(voxels[idx(lx - 1, y + 1, lz)]) && !isOpaqueBlock(voxels[idx(lx - 1, y, lz)])) ||
              (lx < 15 && isOpaqueBlock(voxels[idx(lx + 1, y + 1, lz)]) && !isOpaqueBlock(voxels[idx(lx + 1, y, lz)])) ||
              (lz > 0 && isOpaqueBlock(voxels[idx(lx, y + 1, lz - 1)]) && !isOpaqueBlock(voxels[idx(lx, y, lz - 1)])) ||
              (lz < 15 && isOpaqueBlock(voxels[idx(lx, y + 1, lz + 1)]) && !isOpaqueBlock(voxels[idx(lx, y, lz + 1)]))
            ) {
              skyQueue.push(lx, y, lz, sky);
            }
          }
        }
      }
    }

    // Fast bounded intra-chunk skylight BFS for soft cave mouths / tree shade
    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];
    let head = 0;
    while (head < skyQueue.length) {
      const lx = skyQueue[head++];
      const y = skyQueue[head++];
      const lz = skyQueue[head++];
      const level = skyQueue[head++];
      if (level <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const nx = lx + dirs[d][0];
        const ny = y + dirs[d][1];
        const nz = lz + dirs[d][2];
        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT) continue;
        const ni = idx(nx, ny, nz);
        if (isOpaqueBlock(voxels[ni])) continue;
        const curSky = light[ni] >> 4;
        const nextSky = level - 1;
        if (nextSky > curSky) {
          light[ni] = (nextSky << 4) | (light[ni] & 15);
          skyQueue.push(nx, ny, nz, nextSky);
        }
      }
    }

    // 2. Cross-chunk Torch / Block Light propagation (pads by 14 blocks around chunk!)
    const PAD = 14;
    const SPAN = CHUNK_SIZE + PAD * 2;
    const baseWX = cx * CHUNK_SIZE - PAD;
    const baseWZ = cz * CHUNK_SIZE - PAD;

    const torchQueue = [];

    // Scan chunk + neighbor border ring for light-emitting blocks
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
        const nChunk = this.chunks.get(this.chunkKey(ncx, ncz));
        if (!nChunk) continue;
        const lMinX = ncx < cx ? CHUNK_SIZE - PAD : 0;
        const lMaxX = ncx > cx ? PAD - 1 : CHUNK_SIZE - 1;
        const lMinZ = ncz < cz ? CHUNK_SIZE - PAD : 0;
        const lMaxZ = ncz > cz ? PAD - 1 : CHUNK_SIZE - 1;

        const nv = nChunk.voxels;
        for (let y = 1; y < CHUNK_HEIGHT; y++) {
          for (let lz = lMinZ; lz <= lMaxZ; lz++) {
            const row = (y * CHUNK_SIZE + lz) * CHUNK_SIZE;
            for (let lx = lMinX; lx <= lMaxX; lx++) {
              const b = nv[row + lx];
              if (b === BLOCK.AIR) continue;
              const emit = getLightEmission(b);
              if (emit > 0) {
                const wx = ncx * CHUNK_SIZE + lx;
                const wz = ncz * CHUNK_SIZE + lz;
                torchQueue.push(wx - baseWX, y, wz - baseWZ, emit);
              }
            }
          }
        }
      }
    }

    if (torchQueue.length > 0) {
      const visited = new Uint8Array(SPAN * CHUNK_HEIGHT * SPAN);
      const vIdx = (px, y, pz) => (y * SPAN + pz) * SPAN + px;

      for (let i = 0; i < torchQueue.length; i += 4) {
        const px = torchQueue[i];
        const y = torchQueue[i + 1];
        const pz = torchQueue[i + 2];
        const emit = torchQueue[i + 3];
        visited[vIdx(px, y, pz)] = emit;
        const lx = px - PAD;
        const lz = pz - PAD;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
          const ci = idx(lx, y, lz);
          light[ci] = (light[ci] & 0xf0) | Math.max(light[ci] & 15, emit);
        }
      }

      let tHead = 0;
      while (tHead < torchQueue.length) {
        const px = torchQueue[tHead++];
        const y = torchQueue[tHead++];
        const pz = torchQueue[tHead++];
        const level = torchQueue[tHead++];
        if (level <= 1) continue;
        const nextLevel = level - 1;

        for (let d = 0; d < 6; d++) {
          const npx = px + dirs[d][0];
          const ny = y + dirs[d][1];
          const npz = pz + dirs[d][2];
          if (npx < 0 || npx >= SPAN || npz < 0 || npz >= SPAN || ny < 0 || ny >= CHUNK_HEIGHT) continue;

          const vi = vIdx(npx, ny, npz);
          if (visited[vi] >= nextLevel) continue;

          const wx = baseWX + npx;
          const wz = baseWZ + npz;
          if (isOpaqueBlock(this.getBlock(wx, ny, wz))) continue;

          visited[vi] = nextLevel;
          const lx = npx - PAD;
          const lz = npz - PAD;
          if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
            const ci = idx(lx, ny, lz);
            light[ci] = (light[ci] & 0xf0) | Math.max(light[ci] & 15, nextLevel);
          }
          torchQueue.push(npx, ny, npz, nextLevel);
        }
      }
    }

    chunk.lightDirty = false;
  }

  setBlock(wx, wy, wz, blockId, { settleGravity = true } = {}) {
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    const z = Math.floor(wz);
    if (y <= 0 || y >= CHUNK_HEIGHT) return false;

    const { cx, cz, lx, lz } = this.worldToChunk(x, z);
    const chunk = this.ensureChunkData(cx, cz);
    const vIdx = this.voxelIndex(lx, y, lz);
    const prevBlock = chunk.voxels[vIdx];
    if (prevBlock === blockId) return false;

    chunk.voxels[vIdx] = blockId;

    const key = this.chunkKey(cx, cz);
    let editMap = this.edits.get(key);
    if (!editMap) {
      editMap = new Map();
      this.edits.set(key, editMap);
    }
    editMap.set(vIdx, blockId);

    // If flora or torch rests on top of a broken block, pop it cleanly
    if (blockId === BLOCK.AIR && y + 1 < CHUNK_HEIGHT) {
      const above = this.getBlock(x, y + 1, z);
      const aboveDef = getBlockDef(above);
      if (above !== BLOCK.AIR && (aboveDef.renderType === 'cross' || aboveDef.renderType === 'torch' || above === BLOCK.CACTUS)) {
        this.setBlock(x, y + 1, z, BLOCK.AIR, { settleGravity: false });
      }
    }

    // Settle gravity blocks (Sand, Red Sand, Gravel)
    if (settleGravity) {
      if (blockId !== BLOCK.AIR && getBlockDef(blockId).gravity) {
        let dropY = y;
        while (dropY > 1) {
          const below = this.getBlock(x, dropY - 1, z);
          if (below === BLOCK.AIR || below === BLOCK.WATER || getBlockDef(below).replaceable) {
            dropY--;
          } else {
            break;
          }
        }
        if (dropY !== y) {
          chunk.voxels[vIdx] = BLOCK.AIR;
          editMap.set(vIdx, BLOCK.AIR);
          this.setBlock(x, dropY, z, blockId, { settleGravity: false });
        }
      } else if (blockId === BLOCK.AIR) {
        // Check column above for sand/gravel cascade
        let scanY = y + 1;
        while (scanY < CHUNK_HEIGHT) {
          const aboveId = this.getBlock(x, scanY, z);
          if (aboveId !== BLOCK.AIR && getBlockDef(aboveId).gravity) {
            this.setBlock(x, scanY, z, BLOCK.AIR, { settleGravity: false });
            this.setBlock(x, scanY - 1, z, aboveId, { settleGravity: true });
            scanY++;
          } else {
            break;
          }
        }
      }
    }

    const lightChanged = getLightEmission(prevBlock) > 0 || getLightEmission(blockId) > 0 || isOpaqueBlock(prevBlock) !== isOpaqueBlock(blockId);

    this.markChunkDirty(cx, cz, true);
    if (lx === 0 || lightChanged) this.markChunkDirty(cx - 1, cz, lightChanged);
    if (lx === CHUNK_SIZE - 1 || lightChanged) this.markChunkDirty(cx + 1, cz, lightChanged);
    if (lz === 0 || lightChanged) this.markChunkDirty(cx, cz - 1, lightChanged);
    if (lz === CHUNK_SIZE - 1 || lightChanged) this.markChunkDirty(cx, cz + 1, lightChanged);
    if (lightChanged) {
      this.markChunkDirty(cx - 1, cz - 1, true);
      this.markChunkDirty(cx + 1, cz - 1, true);
      this.markChunkDirty(cx - 1, cz + 1, true);
      this.markChunkDirty(cx + 1, cz + 1, true);
    }

    return true;
  }

  markChunkDirty(cx, cz, recomputeLight = false) {
    const key = this.chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    if (recomputeLight) chunk.lightDirty = true;
    this.dirtyChunks.add(key);
  }

  rebuildChunkMesh(chunk) {
    if (chunk.lightDirty) {
      this.computeChunkLighting(chunk);
    }

    this.disposeChunkMeshes(chunk);

    const geoms = buildChunkGeometries(chunk.cx, chunk.cz, this, this.textures);
    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    if (geoms.opaque) {
      chunk.opaqueMesh = new THREE.Mesh(geoms.opaque, this.materials.opaqueMaterial);
      chunk.opaqueMesh.position.set(worldX, 0, worldZ);
      chunk.opaqueMesh.matrixAutoUpdate = false;
      chunk.opaqueMesh.updateMatrix();
      this.chunkGroup.add(chunk.opaqueMesh);
    }

    if (geoms.cutout) {
      chunk.cutoutMesh = new THREE.Mesh(geoms.cutout, this.materials.cutoutMaterial);
      chunk.cutoutMesh.position.set(worldX, 0, worldZ);
      chunk.cutoutMesh.matrixAutoUpdate = false;
      chunk.cutoutMesh.updateMatrix();
      this.chunkGroup.add(chunk.cutoutMesh);
    }

    if (geoms.water) {
      chunk.waterMesh = new THREE.Mesh(geoms.water, this.materials.waterMaterial);
      chunk.waterMesh.position.set(worldX, 0, worldZ);
      chunk.waterMesh.renderOrder = 2;
      chunk.waterMesh.matrixAutoUpdate = false;
      chunk.waterMesh.updateMatrix();
      this.chunkGroup.add(chunk.waterMesh);
    }
  }

  disposeChunkMeshes(chunk) {
    for (const prop of ['opaqueMesh', 'cutoutMesh', 'waterMesh']) {
      const m = chunk[prop];
      if (m) {
        this.chunkGroup.remove(m);
        m.geometry.dispose();
        chunk[prop] = null;
      }
    }
  }

  unloadChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.disposeChunkMeshes(chunk);
    this.chunks.delete(key);
    this.dirtyChunks.delete(key);
  }

  setRenderDistance(dist) {
    this.renderDistance = Math.max(2, Math.min(8, Math.round(dist)));
    this.lastCenterKey = '';
    const fogFar = (this.renderDistance + 0.5) * CHUNK_SIZE;
    this.materials.sharedUniforms.uFogNear.value = fogFar * 0.52;
    this.materials.sharedUniforms.uFogFar.value = fogFar;
  }

  prewarmAround(wx, wz, radius = 3) {
    const centerCX = Math.floor(wx / CHUNK_SIZE);
    const centerCZ = Math.floor(wz / CHUNK_SIZE);
    const coords = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        coords.push([centerCX + dx, centerCZ + dz]);
      }
    }
    // Generate voxel data first so neighbor AO/culling is complete
    for (const [cx, cz] of coords) {
      this.ensureChunkData(cx, cz);
    }
    for (const [cx, cz] of coords) {
      const chunk = this.getChunk(cx, cz);
      if (chunk) {
        chunk.lightDirty = true;
        this.rebuildChunkMesh(chunk);
      }
    }
    this.setRenderDistance(this.renderDistance);
  }

  updateStreaming(playerX, playerZ) {
    const centerCX = Math.floor(playerX / CHUNK_SIZE);
    const centerCZ = Math.floor(playerZ / CHUNK_SIZE);
    const r = this.renderDistance;
    const centerKey = `${centerCX},${centerCZ},${r}`;

    if (centerKey !== this.lastCenterKey) {
      this.lastCenterKey = centerKey;
      const needed = new Set();
      const spiral = [];

      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz <= (r + 0.5) * (r + 0.5)) {
            const cx = centerCX + dx;
            const cz = centerCZ + dz;
            const key = this.chunkKey(cx, cz);
            needed.add(key);
            if (!this.chunks.has(key) || !this.chunks.get(key).opaqueMesh) {
              spiral.push({ cx, cz, dist: dx * dx + dz * dz });
            }
          }
        }
      }

      spiral.sort((a, b) => a.dist - b.dist);
      this.loadQueue = spiral;

      // Unload chunks safely outside hysteresis ring
      for (const [key, chunk] of this.chunks.entries()) {
        const dx = chunk.cx - centerCX;
        const dz = chunk.cz - centerCZ;
        if (dx * dx + dz * dz > (r + 2) * (r + 2) && !needed.has(key)) {
          this.unloadChunk(key);
        }
      }
    }

    // Immediate priority rebuilds for player block edits
    let dirtyProcessed = 0;
    for (const key of Array.from(this.dirtyChunks)) {
      this.dirtyChunks.delete(key);
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.rebuildChunkMesh(chunk);
        dirtyProcessed++;
        if (dirtyProcessed >= 6) break;
      }
    }

    // Frame-budgeted streaming of new chunks (up to 2 per frame for silky 60fps)
    let streamed = 0;
    while (this.loadQueue.length > 0 && streamed < 2) {
      const next = this.loadQueue.shift();
      // Ensure 4 cardinal neighbors have voxel data for clean border culling
      this.ensureChunkData(next.cx, next.cz);
      this.ensureChunkData(next.cx - 1, next.cz);
      this.ensureChunkData(next.cx + 1, next.cz);
      this.ensureChunkData(next.cx, next.cz - 1);
      this.ensureChunkData(next.cx, next.cz + 1);

      const chunk = this.getChunk(next.cx, next.cz);
      if (chunk && !chunk.opaqueMesh) {
        chunk.lightDirty = true;
        this.rebuildChunkMesh(chunk);
        streamed++;
      }
    }
  }

  findSafeSpawn(searchX = 0, searchZ = 0) {
    let best = { x: 0.5, y: SEA_LEVEL + 10, z: 0.5 };
    let bestScore = -Infinity;

    for (let r = 0; r <= 32; r += 4) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const wx = Math.round(searchX + Math.cos(angle) * r);
        const wz = Math.round(searchZ + Math.sin(angle) * r);
        const { cx, cz } = this.worldToChunk(wx, wz);
        this.ensureChunkData(cx, cz);

        let topY = CHUNK_HEIGHT - 2;
        while (topY > 1) {
          const b = this.getBlock(wx, topY, wz);
          if (b !== BLOCK.AIR && getBlockDef(b).solid) break;
          topY--;
        }

        const ground = this.getBlock(wx, topY, wz);
        const above1 = this.getBlock(wx, topY + 1, wz);
        const above2 = this.getBlock(wx, topY + 2, wz);

        if (ground === BLOCK.WATER || above1 === BLOCK.WATER || ground === BLOCK.CACTUS) continue;
        if (topY < SEA_LEVEL) continue;
        if (getBlockDef(above1).solid || getBlockDef(above2).solid) continue;

        let score = 100 - r * 0.8;
        if (ground === BLOCK.GRASS) score += 35;
        if (topY >= SEA_LEVEL + 2 && topY <= SEA_LEVEL + 16) score += 20;

        if (score > bestScore) {
          bestScore = score;
          best = { x: wx + 0.5, y: topY + 1.05, z: wz + 0.5 };
        }
        if (score > 140) return best;
      }
    }
    return best;
  }

  getSurfaceHeight(wx, wz) {
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    for (let y = CHUNK_HEIGHT - 2; y > 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== BLOCK.AIR && getBlockDef(b).solid) return y;
    }
    return SEA_LEVEL;
  }

  hasNearbyBlock(wx, wy, wz, targetBlockId, radius = 5) {
    const cx = Math.floor(wx);
    const cy = Math.floor(wy);
    const cz = Math.floor(wz);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (this.getBlock(cx + dx, cy + dy, cz + dz) === targetBlockId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Amanatides & Woo fast exact voxel traversal
  raycast(origin, direction, maxDist = 6.0) {
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

    let tMaxX =
      stepX > 0 ? (x + 1 - origin.x) * tDeltaX :
      stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
    let tMaxY =
      stepY > 0 ? (y + 1 - origin.y) * tDeltaY :
      stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
    let tMaxZ =
      stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ :
      stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

    let dist = 0;
    let nx = 0, ny = 0, nz = 0;

    while (dist <= maxDist) {
      if (y >= 0 && y < CHUNK_HEIGHT) {
        const blockId = this.getBlock(x, y, z);
        if (blockId !== BLOCK.AIR) {
          const def = getBlockDef(blockId);
          if (def.raycastable) {
            return {
              x,
              y,
              z,
              nx,
              ny,
              nz,
              placeX: def.replaceable ? x : x + nx,
              placeY: def.replaceable ? y : y + ny,
              placeZ: def.replaceable ? z : z + nz,
              blockId,
              def,
              distance: dist,
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

  exportEdits() {
    const out = {};
    for (const [key, map] of this.edits.entries()) {
      if (map.size === 0) continue;
      const flat = [];
      for (const [vIdx, bId] of map.entries()) {
        flat.push(vIdx, bId);
      }
      out[key] = flat;
    }
    return out;
  }

  importEdits(serialized) {
    this.edits.clear();
    if (!serialized || typeof serialized !== 'object') return;
    for (const [key, flat] of Object.entries(serialized)) {
      if (!Array.isArray(flat)) continue;
      const map = new Map();
      for (let i = 0; i < flat.length; i += 2) {
        map.set(flat[i], flat[i + 1]);
      }
      this.edits.set(key, map);
    }
  }

  dispose() {
    for (const key of Array.from(this.chunks.keys())) {
      this.unloadChunk(key);
    }
    this.scene.remove(this.chunkGroup);
  }
}
