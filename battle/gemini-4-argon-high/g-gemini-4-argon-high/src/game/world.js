import * as THREE from 'three';
import { BLOCK, REGISTRY, CHUNK_SIZE, CHUNK_HEIGHT } from './constants.js';
import { WorldGenerator } from './worldGen.js';
import { Chunk } from './chunk.js';

export class VoxelWorld {
  constructor(scene, textures, seed = 'VOXEL_REALMS_2026') {
    this.scene = scene;
    this.textures = textures;
    this.seed = seed;
    this.generator = new WorldGenerator(seed);

    this.chunks = new Map(); // "cx,cz" -> Chunk
    this.modifiedBlocks = new Map(); // "cx,cz" -> Object { "lx,y,lz": blockId }
    this.renderDistance = 4;

    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: textures.atlasTexture,
      vertexColors: true,
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: textures.atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.primedTnts = [];
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz)) || null;
  }

  ensureChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const data = this.generator.generateChunkVoxels(cx, cz);
      // Apply any saved player modifications for this chunk
      const mods = this.modifiedBlocks.get(key);
      if (mods) {
        for (const [localKey, blockId] of Object.entries(mods)) {
          const [lx, y, lz] = localKey.split(',').map(Number);
          if (y >= 0 && y < CHUNK_HEIGHT) {
            data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = blockId;
          }
        }
      }
      chunk = new Chunk(cx, cz, data, this);
      this.chunks.set(key, chunk);

      // Mark immediate neighbors dirty so their border faces update
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nb = this.getChunk(cx + dx, cz + dz);
        if (nb) nb.dirty = true;
      }
    }
    return chunk;
  }

  getBlock(wx, wy, wz) {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    return chunk.getLocal(lx, y, lz);
  }

  isSolidAt(wx, wy, wz) {
    const id = this.getBlock(wx, wy, wz);
    if (id === BLOCK.AIR) return false;
    const def = REGISTRY[id];
    return Boolean(def && !def.nonSolid);
  }

  setBlock(wx, wy, wz, blockId, recordModification = true) {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const chunk = this.ensureChunk(cx, cz);
    const prevId = chunk.getLocal(lx, y, lz);
    if (prevId === blockId) return false;

    chunk.setLocal(lx, y, lz, blockId);

    if (recordModification) {
      const cKey = this.chunkKey(cx, cz);
      let mods = this.modifiedBlocks.get(cKey);
      if (!mods) {
        mods = {};
        this.modifiedBlocks.set(cKey, mods);
      }
      mods[`${lx},${y},${lz}`] = blockId;
    }

    // Immediate remesh of affected chunk + border/lighting neighbors
    const prevDef = REGISTRY[prevId];
    const newDef = REGISTRY[blockId];
    const isLightChange = Boolean((prevDef && prevDef.light) || (newDef && newDef.light));

    chunk.rebuildMesh(this.textures, this.opaqueMaterial, this.transparentMaterial);

    const neighborsToUpdate = new Set();
    if (lx === 0 || isLightChange) neighborsToUpdate.add(this.getChunk(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1 || isLightChange) neighborsToUpdate.add(this.getChunk(cx + 1, cz));
    if (lz === 0 || isLightChange) neighborsToUpdate.add(this.getChunk(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1 || isLightChange) neighborsToUpdate.add(this.getChunk(cx, cz + 1));

    for (const nb of neighborsToUpdate) {
      if (nb) {
        nb.rebuildMesh(this.textures, this.opaqueMaterial, this.transparentMaterial);
      }
    }

    return true;
  }

  getHighestSolidY(wx, wz) {
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const chunk = this.ensureChunk(cx, cz);
    for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
      const id = chunk.getLocal(lx, y, lz);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && !REGISTRY[id]?.nonSolid) {
        return y;
      }
    }
    return this.generator.getSurfaceHeight(Math.floor(wx), Math.floor(wz));
  }

  updateStreaming(playerX, playerZ, maxChunksPerFrame = 3) {
    const centerCx = Math.floor(playerX / CHUNK_SIZE);
    const centerCz = Math.floor(playerZ / CHUNK_SIZE);
    const R = this.renderDistance;

    // 1. Unload distant chunks beyond R + 2
    for (const [key, chunk] of this.chunks.entries()) {
      if (Math.abs(chunk.cx - centerCx) > R + 2 || Math.abs(chunk.cz - centerCz) > R + 2) {
        chunk.disposeMeshes();
        this.chunks.delete(key);
      }
    }

    // 2. Gather needed chunks in spiral / distance order
    const needed = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz <= (R + 0.5) * (R + 0.5)) {
          needed.push({ cx: centerCx + dx, cz: centerCz + dz, dist: dx * dx + dz * dz });
        }
      }
    }
    needed.sort((a, b) => a.dist - b.dist);

    let builtCount = 0;
    for (const item of needed) {
      const chunk = this.ensureChunk(item.cx, item.cz);
      if (chunk.dirty) {
        chunk.rebuildMesh(this.textures, this.opaqueMaterial, this.transparentMaterial);
        builtCount++;
        if (builtCount >= maxChunksPerFrame) break;
      }
    }
  }

  // Build all chunks around spawn synchronously so player never falls through unbuilt floor
  preloadSpawnArea(playerX, playerZ, radius = 2) {
    const centerCx = Math.floor(playerX / CHUNK_SIZE);
    const centerCz = Math.floor(playerZ / CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunk(centerCx + dx, centerCz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getChunk(centerCx + dx, centerCz + dz);
        if (chunk && chunk.dirty) {
          chunk.rebuildMesh(this.textures, this.opaqueMaterial, this.transparentMaterial);
        }
      }
    }
  }

  // 3D Amanatides-Woo DDA Voxel Raycast
  raycast(origin, direction, maxDistance = 6.0) {
    const dir = direction.clone().normalize();
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

    let dist = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    while (dist <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
        return {
          blockId: id,
          x,
          y,
          z,
          nx,
          ny,
          nz,
          placeX: x + nx,
          placeY: y + ny,
          placeZ: z + nz,
          distance: dist,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }
    }

    return null;
  }

  // Ignite a TNT block at (x, y, z)
  igniteTNT(x, y, z, audio, particles, onExplodeCallback) {
    this.setBlock(x, y, z, BLOCK.AIR, true);
    if (audio) audio.playFuse();

    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const mat = new THREE.MeshLambertMaterial({ color: 0xe03b2b, emissive: 0x551100 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);

    this.primedTnts.push({
      x: x + 0.5,
      y: y + 0.5,
      z: z + 0.5,
      timer: 2.5,
      mesh,
      mat,
      audio,
      particles,
      onExplodeCallback,
    });
  }

  updatePrimedTNTs(dt) {
    for (let i = this.primedTnts.length - 1; i >= 0; i--) {
      const tnt = this.primedTnts[i];
      tnt.timer -= dt;
      const pulse = Math.sin(tnt.timer * 18) > 0;
      tnt.mat.emissive.setHex(pulse ? 0xffffff : 0x661100);
      const scale = 1 + Math.max(0, (2.5 - tnt.timer) * 0.08);
      tnt.mesh.scale.set(scale, scale, scale);

      if (tnt.particles && Math.random() < 0.6) {
        tnt.particles.spawnTorchFlame(tnt.x, tnt.y + 0.55, tnt.z);
      }

      if (tnt.timer <= 0) {
        this.scene.remove(tnt.mesh);
        tnt.mesh.geometry.dispose();
        tnt.mat.dispose();
        this.primedTnts.splice(i, 1);
        this._detonateExplosion(tnt.x, tnt.y, tnt.z, 3.2, tnt.audio, tnt.particles, tnt.onExplodeCallback);
      }
    }
  }

  _detonateExplosion(cx, cy, cz, radius, audio, particles, onExplodeCallback) {
    if (audio) audio.playExplosion();
    if (particles) particles.spawnExplosion(cx, cy, cz);

    const rCeil = Math.ceil(radius);
    const affectedChunks = new Set();
    const droppedBlocks = [];

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist <= radius) {
            const bx = Math.floor(cx + dx);
            const by = Math.floor(cy + dy);
            const bz = Math.floor(cz + dz);
            const id = this.getBlock(bx, by, bz);
            if (id !== BLOCK.AIR && id !== BLOCK.BEDROCK && id !== BLOCK.WATER) {
              if (id === BLOCK.TNT) {
                // Chain reaction!
                this.igniteTNT(bx, by, bz, audio, particles, onExplodeCallback);
                continue;
              }
              const def = REGISTRY[id];
              if (def && def.drop && Math.random() < 0.45) {
                droppedBlocks.push({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5, id: def.drop });
              }
              const { cx: chunkX, cz: chunkZ, lx, lz } = this.worldToChunk(bx, bz);
              const chunk = this.ensureChunk(chunkX, chunkZ);
              chunk.setLocal(lx, by, lz, BLOCK.AIR);
              const cKey = this.chunkKey(chunkX, chunkZ);
              let mods = this.modifiedBlocks.get(cKey);
              if (!mods) {
                mods = {};
                this.modifiedBlocks.set(cKey, mods);
              }
              mods[`${lx},${by},${lz}`] = BLOCK.AIR;
              affectedChunks.add(chunk);
            }
          }
        }
      }
    }

    for (const chunk of affectedChunks) {
      chunk.rebuildMesh(this.textures, this.opaqueMaterial, this.transparentMaterial);
    }

    if (onExplodeCallback) {
      onExplodeCallback(cx, cy, cz, radius, droppedBlocks);
    }
  }

  serializeModifications() {
    const obj = {};
    for (const [chunkKey, mods] of this.modifiedBlocks.entries()) {
      obj[chunkKey] = mods;
    }
    return obj;
  }

  loadModifications(serializedMods, newSeed) {
    // Clear existing chunks
    for (const chunk of this.chunks.values()) {
      chunk.disposeMeshes();
    }
    this.chunks.clear();
    this.modifiedBlocks.clear();

    if (newSeed && newSeed !== this.seed) {
      this.seed = newSeed;
      this.generator = new WorldGenerator(newSeed);
    }

    if (serializedMods && typeof serializedMods === 'object') {
      for (const [chunkKey, mods] of Object.entries(serializedMods)) {
        this.modifiedBlocks.set(chunkKey, { ...mods });
      }
    }
  }
}
