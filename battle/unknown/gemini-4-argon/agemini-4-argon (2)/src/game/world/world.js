import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants.js';
import { BLOCK, getDef, getLightEmission } from '../blocks.js';
import { WorldGenerator } from './generator.js';
import { createChunkMaterials } from './materials.js';
import { buildChunkGeometries } from './mesher.js';

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export class World {
  constructor(scene, textureManager, seed = 'TerraVox', savedDeltas = null) {
    this.scene = scene;
    this.textureManager = textureManager;
    this.seed = String(seed);
    this.generator = new WorldGenerator(this.seed);

    this.materials = createChunkMaterials(textureManager.atlasTexture);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.chunks = new Map(); // key -> chunk object
    // Persistent block modifications: key -> Map<voxelIndex, blockId>
    this.deltas = new Map();
    if (savedDeltas && typeof savedDeltas === 'object') {
      for (const [k, entries] of Object.entries(savedDeltas)) {
        const m = new Map();
        for (const [idx, bid] of entries) {
          m.set(Number(idx), Number(bid));
        }
        this.deltas.set(k, m);
      }
    }

    this.genQueue = [];
    this.meshQueue = [];
    this.lastCenterKey = '';
    this.lastRenderDist = -1;
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      this._disposeChunkMeshes(chunk);
    }
    this.chunks.clear();
    this.scene.remove(this.group);
    this.materials.solidMaterial.dispose();
    this.materials.cutoutMaterial.dispose();
    this.materials.waterMaterial.dispose();
  }

  _disposeChunkMeshes(chunk) {
    for (const key of ['solidMesh', 'cutoutMesh', 'waterMesh']) {
      const m = chunk[key];
      if (m) {
        this.group.remove(m);
        if (m.geometry) m.geometry.dispose();
        chunk[key] = null;
      }
    }
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

  ensureChunkData(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const voxels = this.generator.generateChunkData(cx, cz);
    const deltaMap = this.deltas.get(key);
    if (deltaMap) {
      for (const [idx, bid] of deltaMap.entries()) {
        if (idx >= 0 && idx < voxels.length) {
          voxels[idx] = bid;
        }
      }
    }

    const emitters = new Map();
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          const level = getLightEmission(voxels[idx]);
          if (level > 0) {
            emitters.set(idx, {
              x: baseX + lx + 0.5,
              y: y + 0.5,
              z: baseZ + lz + 0.5,
              level,
            });
          }
        }
      }
    }

    chunk = {
      cx,
      cz,
      key,
      voxels,
      emitters,
      dirty: true,
      meshed: false,
      solidMesh: null,
      cutoutMesh: null,
      waterMesh: null,
    };
    this.chunks.set(key, chunk);
    return chunk;
  }

  getLightEmittersNearChunk(cx, cz) {
    const list = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ch = this.getChunk(cx + dx, cz + dz);
        if (!ch || ch.emitters.size === 0) continue;
        for (const e of ch.emitters.values()) {
          list.push(e);
        }
      }
    }
    return list;
  }

  getBlock(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0 || iy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    return chunk.voxels[(iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  setBlock(wx, y, wz, blockId, immediate = true) {
    const iy = Math.floor(y);
    if (iy < 0 || iy >= CHUNK_HEIGHT) return false;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.ensureChunkData(cx, cz);

    const lx = ix - cx * CHUNK_SIZE;
    const lz = iz - cz * CHUNK_SIZE;
    const idx = (iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    const prevId = chunk.voxels[idx];
    if (prevId === blockId) return false;

    const prevLight = getLightEmission(prevId);
    const newLight = getLightEmission(blockId);

    chunk.voxels[idx] = blockId;

    if (newLight > 0) {
      chunk.emitters.set(idx, { x: ix + 0.5, y: iy + 0.5, z: iz + 0.5, level: newLight });
    } else if (prevLight > 0) {
      chunk.emitters.delete(idx);
    }

    // Record persistent modification
    let deltaMap = this.deltas.get(chunk.key);
    if (!deltaMap) {
      deltaMap = new Map();
      this.deltas.set(chunk.key, deltaMap);
    }
    deltaMap.set(idx, blockId);

    // If a torch was resting on top of a broken block, pop it cleanly
    if (blockId === BLOCK.AIR && iy + 1 < CHUNK_HEIGHT) {
      const above = this.getBlock(ix, iy + 1, iz);
      if (getDef(above).crossMesh) {
        this.setBlock(ix, iy + 1, iz, BLOCK.AIR, false);
      }
    }

    const toRebuild = new Set([chunk.key]);
    const lightChanged = prevLight > 0 || newLight > 0;

    if (lx === 0 || lightChanged) toRebuild.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1 || lightChanged) toRebuild.add(chunkKey(cx + 1, cz));
    if (lz === 0 || lightChanged) toRebuild.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1 || lightChanged) toRebuild.add(chunkKey(cx, cz + 1));
    if (lightChanged) {
      toRebuild.add(chunkKey(cx - 1, cz - 1));
      toRebuild.add(chunkKey(cx + 1, cz - 1));
      toRebuild.add(chunkKey(cx - 1, cz + 1));
      toRebuild.add(chunkKey(cx + 1, cz + 1));
    }

    for (const k of toRebuild) {
      const ch = this.chunks.get(k);
      if (!ch) continue;
      ch.dirty = true;
      if (immediate) {
        this.rebuildChunkMesh(ch.cx, ch.cz);
      } else if (!this.meshQueue.includes(k)) {
        this.meshQueue.unshift(k);
      }
    }

    return true;
  }

  rebuildChunkMesh(cx, cz) {
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    // Ensure 4 neighbors have voxel data so chunk borders cull cleanly
    this.ensureChunkData(cx - 1, cz);
    this.ensureChunkData(cx + 1, cz);
    this.ensureChunkData(cx, cz - 1);
    this.ensureChunkData(cx, cz + 1);

    this._disposeChunkMeshes(chunk);

    const geoms = buildChunkGeometries(this, cx, cz, this.textureManager);
    const wx = cx * CHUNK_SIZE;
    const wz = cz * CHUNK_SIZE;

    if (geoms.solid) {
      const mesh = new THREE.Mesh(geoms.solid, this.materials.solidMaterial);
      mesh.position.set(wx, 0, wz);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.solidMesh = mesh;
    }

    if (geoms.cutout) {
      const mesh = new THREE.Mesh(geoms.cutout, this.materials.cutoutMaterial);
      mesh.position.set(wx, 0, wz);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.cutoutMesh = mesh;
    }

    if (geoms.water) {
      const mesh = new THREE.Mesh(geoms.water, this.materials.waterMaterial);
      mesh.position.set(wx, 0, wz);
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.waterMesh = mesh;
    }

    chunk.dirty = false;
    chunk.meshed = true;
  }

  preloadAround(wx, wz, radius = 2) {
    const ccx = Math.floor(wx / CHUNK_SIZE);
    const ccz = Math.floor(wz / CHUNK_SIZE);
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        this.ensureChunkData(ccx + dx, ccz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.rebuildChunkMesh(ccx + dx, ccz + dz);
      }
    }
  }

  updateStreaming(wx, wz, renderDistance = 5, budgetMs = 5.5) {
    const ccx = Math.floor(wx / CHUNK_SIZE);
    const ccz = Math.floor(wz / CHUNK_SIZE);
    const centerKey = `${ccx},${ccz}`;

    // Update fog distance smoothly to match renderDistance
    const maxWorldDist = renderDistance * CHUNK_SIZE;
    this.materials.uniforms.uFogNear.value = Math.max(24, maxWorldDist * 0.56);
    this.materials.uniforms.uFogFar.value = Math.max(44, maxWorldDist * 0.96);

    if (centerKey !== this.lastCenterKey || renderDistance !== this.lastRenderDist) {
      this.lastCenterKey = centerKey;
      this.lastRenderDist = renderDistance;

      const desired = [];
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
          const distSq = dx * dx + dz * dz;
          if (distSq <= (renderDistance + 0.5) * (renderDistance + 0.5)) {
            desired.push({ cx: ccx + dx, cz: ccz + dz, distSq });
          }
        }
      }
      desired.sort((a, b) => a.distSq - b.distSq);

      this.genQueue = [];
      this.meshQueue = [];

      for (const item of desired) {
        const k = chunkKey(item.cx, item.cz);
        const ch = this.chunks.get(k);
        if (!ch) {
          this.genQueue.push(item);
        } else if (ch.dirty || !ch.meshed) {
          this.meshQueue.push(k);
        }
      }

      // Unload far chunks beyond renderDistance + 2
      const unloadDistSq = (renderDistance + 2.5) * (renderDistance + 2.5);
      for (const [k, ch] of this.chunks.entries()) {
        const dx = ch.cx - ccx;
        const dz = ch.cz - ccz;
        if (dx * dx + dz * dz > unloadDistSq) {
          this._disposeChunkMeshes(ch);
          this.chunks.delete(k);
        }
      }
    }

    const start = performance.now();
    while (this.genQueue.length > 0 && performance.now() - start < budgetMs) {
      const next = this.genQueue.shift();
      const ch = this.ensureChunkData(next.cx, next.cz);
      if (ch.dirty || !ch.meshed) {
        this.meshQueue.push(ch.key);
      }
    }

    while (this.meshQueue.length > 0 && performance.now() - start < budgetMs) {
      const key = this.meshQueue.shift();
      const ch = this.chunks.get(key);
      if (ch && (ch.dirty || !ch.meshed)) {
        this.rebuildChunkMesh(ch.cx, ch.cz);
      }
    }
  }

  raycast(origin, direction, maxDist = 5.5) {
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

    let dist = 0;
    let nx = 0, ny = 0, nz = 0;

    for (let i = 0; i < 64; i++) {
      if (y >= 0 && y < CHUNK_HEIGHT) {
        const id = this.getBlock(x, y, z);
        if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
          return {
            x,
            y,
            z,
            blockId: id,
            distance: dist,
            normal: { x: nx, y: ny, z: nz },
            placePos: { x: x + nx, y: y + ny, z: z + nz },
          };
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

      if (dist > maxDist) break;
    }

    return null;
  }

  hasNearbyBlock(wx, wy, wz, targetBlockId, radius = 4.5) {
    const r = Math.ceil(radius);
    const cx = Math.floor(wx);
    const cy = Math.floor(wy);
    const cz = Math.floor(wz);
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (this.getBlock(cx + dx, cy + dy, cz + dz) === targetBlockId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  serializeDeltas() {
    const out = {};
    for (const [k, map] of this.deltas.entries()) {
      if (map.size > 0) {
        out[k] = Array.from(map.entries());
      }
    }
    return out;
  }
}
