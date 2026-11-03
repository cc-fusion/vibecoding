import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants.js';
import { BLOCK_IDS, getItemDef } from '../data/blocks.js';
import { getSmeltingRecipe } from '../data/recipes.js';
import { Chunk, chunkKey } from './Chunk.js';
import { TerrainGenerator } from './TerrainGenerator.js';
import { computeChunkLighting } from './Lighting.js';
import { ChunkMesher, createChunkMaterials } from './ChunkMesher.js';

export function blockCoordKey(x, y, z) {
  return `${x},${y},${z}`;
}

export class World {
  constructor({ scene, atlas, seed = 'voxelwild', renderDistance = 5, savedState = null }) {
    this.scene = scene;
    this.atlas = atlas;
    this.renderDistance = renderDistance;

    this.generator = new TerrainGenerator(seed);
    this.materials = createChunkMaterials(atlas.texture);
    this.mesher = new ChunkMesher(this, atlas);

    this.chunks = new Map();
    this.savedChunkDeltas = new Map(); // chunkKey -> delta array
    this.chests = new Map(); // "x,y,z" -> 18-slot array
    this.furnaces = new Map(); // "x,y,z" -> furnace state
    this.gravityQueue = [];

    this.chunkGroup = new THREE.Group();
    if (this.scene) {
      this.scene.add(this.chunkGroup);
    }

    this.spiralOffsets = [];
    this.rebuildSpiralOffsets();

    if (savedState) {
      this.restoreSavedData(savedState);
    }

    this.onDropItem = null; // Hook `(wx, wy, wz, id, count) => void`
  }

  restoreSavedData(savedState) {
    if (savedState.chunkDeltas) {
      for (const [key, deltaArr] of Object.entries(savedState.chunkDeltas)) {
        this.savedChunkDeltas.set(key, deltaArr);
      }
    }
    if (savedState.chests) {
      for (const [key, slots] of Object.entries(savedState.chests)) {
        this.chests.set(key, slots);
      }
    }
    if (savedState.furnaces) {
      for (const [key, fState] of Object.entries(savedState.furnaces)) {
        this.furnaces.set(key, fState);
      }
    }
  }

  serializeWorldData() {
    // Sync active chunks' deltas into savedChunkDeltas
    for (const [key, chunk] of this.chunks.entries()) {
      const serialized = chunk.serializeDeltas();
      if (serialized) {
        this.savedChunkDeltas.set(key, serialized);
      }
    }

    const chunkDeltas = {};
    for (const [key, arr] of this.savedChunkDeltas.entries()) {
      if (arr && arr.length > 0) chunkDeltas[key] = arr;
    }

    const chests = {};
    for (const [key, slots] of this.chests.entries()) {
      chests[key] = slots;
    }

    const furnaces = {};
    for (const [key, fState] of this.furnaces.entries()) {
      furnaces[key] = fState;
    }

    return { chunkDeltas, chests, furnaces };
  }

  setRenderDistance(dist) {
    const clamped = Math.max(3, Math.min(8, Math.round(dist)));
    if (clamped !== this.renderDistance) {
      this.renderDistance = clamped;
      this.rebuildSpiralOffsets();
    }
  }

  rebuildSpiralOffsets() {
    const r = this.renderDistance;
    const offsets = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 <= (r + 0.5) * (r + 0.5)) {
          offsets.push({ dx, dz, d2 });
        }
      }
    }
    offsets.sort((a, b) => a.d2 - b.d2);
    this.spiralOffsets = offsets;
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.generator.generateChunk(chunk);
      const savedDeltas = this.savedChunkDeltas.get(key);
      if (savedDeltas) {
        chunk.applyDeltas(savedDeltas);
      }
      this.chunks.set(key, chunk);

      // Mark immediate 4 neighbors dirty so border faces & cross-chunk lights stay seamless
      const neighbors = [
        this.getChunk(cx - 1, cz),
        this.getChunk(cx + 1, cz),
        this.getChunk(cx, cz - 1),
        this.getChunk(cx, cz + 1),
      ];
      for (const n of neighbors) {
        if (n) {
          n.dirtyLight = true;
          n.dirtyMesh = true;
        }
      }
    }
    return chunk;
  }

  preloadAround(wx, wz, radius = 2) {
    const pcx = Math.floor(wx) >> 4;
    const pcz = Math.floor(wz) >> 4;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (c && c.dirtyLight) computeChunkLighting(this, c);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (c && c.dirtyMesh) this.rebuildChunkMesh(c);
      }
    }
  }

  getBlock(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0 || iy >= WORLD_HEIGHT) return BLOCK_IDS.AIR;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(chunkKey(ix >> 4, iz >> 4));
    if (!chunk) return BLOCK_IDS.AIR;
    return chunk.getBlock(ix & 15, iy, iz & 15);
  }

  getMeta(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0 || iy >= WORLD_HEIGHT) return 0;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(chunkKey(ix >> 4, iz >> 4));
    if (!chunk) return 0;
    return chunk.getMeta(ix & 15, iy, iz & 15);
  }

  getSkyLight(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy >= WORLD_HEIGHT) return 15;
    if (iy < 0) return 0;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(chunkKey(ix >> 4, iz >> 4));
    if (!chunk) return 15;
    return chunk.getSkyLight(ix & 15, iy, iz & 15);
  }

  getBlockLight(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0 || iy >= WORLD_HEIGHT) return 0;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(chunkKey(ix >> 4, iz >> 4));
    if (!chunk) return 0;
    return chunk.getBlockLight(ix & 15, iy, iz & 15);
  }

  setBlock(wx, y, wz, blockId, meta = 0, immediateRemesh = true) {
    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);
    if (iy < 0 || iy >= WORLD_HEIGHT) return false;

    const cx = ix >> 4;
    const cz = iz >> 4;
    const lx = ix & 15;
    const lz = iz & 15;

    const chunk = this.ensureChunk(cx, cz);
    const prevId = chunk.getBlock(lx, iy, lz);
    const prevMeta = chunk.getMeta(lx, iy, lz);
    if (prevId === blockId && prevMeta === meta) return false;

    chunk.setBlockModified(lx, iy, lz, blockId, meta);

    // Check affected neighbors (within 14 blocks if light source changed, or adjacent chunk if on border)
    const prevLight = getItemDef(prevId).lightLevel;
    const nextLight = getItemDef(blockId).lightLevel;
    const lightChanged =
      prevLight !== nextLight ||
      getItemDef(prevId).opaque !== getItemDef(blockId).opaque;

    const affectedChunks = new Set([chunk]);
    if (lx === 0 || lightChanged) {
      const n = this.getChunk(cx - 1, cz);
      if (n) affectedChunks.add(n);
    }
    if (lx === 15 || lightChanged) {
      const n = this.getChunk(cx + 1, cz);
      if (n) affectedChunks.add(n);
    }
    if (lz === 0 || lightChanged) {
      const n = this.getChunk(cx, cz - 1);
      if (n) affectedChunks.add(n);
    }
    if (lz === 15 || lightChanged) {
      const n = this.getChunk(cx, cz + 1);
      if (n) affectedChunks.add(n);
    }

    for (const c of affectedChunks) {
      c.dirtyLight = true;
      c.dirtyMesh = true;
    }

    if (immediateRemesh) {
      // Compute center chunk light first, then neighbor lights so light crosses border cleanly!
      computeChunkLighting(this, chunk);
      for (const c of affectedChunks) {
        if (c !== chunk) computeChunkLighting(this, c);
      }
      // Second pass on center if neighbor bounced light back
      computeChunkLighting(this, chunk);

      for (const c of affectedChunks) {
        this.rebuildChunkMesh(c);
      }
    }

    if (blockId === BLOCK_IDS.AIR) {
      this.checkUnsupportedAbove(ix, iy + 1, iz);
    } else if (getItemDef(blockId).gravity) {
      this.enqueueGravityCheck(ix, iy, iz);
    }

    return true;
  }

  checkUnsupportedAbove(ix, iy, iz) {
    if (iy >= WORLD_HEIGHT) return;
    const aboveId = this.getBlock(ix, iy, iz);
    if (aboveId === BLOCK_IDS.AIR) return;

    const def = getItemDef(aboveId);
    const needsFloor =
      aboveId === BLOCK_IDS.TALL_GRASS ||
      aboveId === BLOCK_IDS.RED_FLOWER ||
      aboveId === BLOCK_IDS.YELLOW_FLOWER ||
      aboveId === BLOCK_IDS.BERRY_BUSH ||
      aboveId === BLOCK_IDS.MUSHROOM ||
      aboveId === BLOCK_IDS.DEAD_BUSH ||
      aboveId === BLOCK_IDS.REEDS ||
      aboveId === BLOCK_IDS.CACTUS ||
      aboveId === BLOCK_IDS.TORCH;

    if (needsFloor) {
      this.setBlock(ix, iy, iz, BLOCK_IDS.AIR, 0, true);
      if (this.onDropItem) {
        const drop = typeof def.drops === 'function' ? def.drops() : def.drops || { id: aboveId, count: 1 };
        if (drop) {
          this.onDropItem(ix + 0.5, iy + 0.35, iz + 0.5, drop.id, drop.count);
        }
      }
      return;
    }

    if (def.gravity) {
      this.enqueueGravityCheck(ix, iy, iz);
    }
  }

  enqueueGravityCheck(ix, iy, iz) {
    // Climb column of sand/gravel
    for (let y = iy; y < WORLD_HEIGHT; y++) {
      const id = this.getBlock(ix, y, iz);
      if (getItemDef(id).gravity) {
        this.gravityQueue.push({ x: ix, y, z: iz, delay: 0.09 + (y - iy) * 0.05 });
      } else {
        break;
      }
    }
  }

  updateGravityBlocks(dt) {
    if (this.gravityQueue.length === 0) return;
    for (let i = this.gravityQueue.length - 1; i >= 0; i--) {
      const item = this.gravityQueue[i];
      item.delay -= dt;
      if (item.delay <= 0) {
        this.gravityQueue.splice(i, 1);
        const id = this.getBlock(item.x, item.y, item.z);
        if (!getItemDef(id).gravity) continue;

        let targetY = item.y;
        while (targetY > 1) {
          const below = this.getBlock(item.x, targetY - 1, item.z);
          const belowDef = getItemDef(below);
          if (below === BLOCK_IDS.AIR || belowDef.liquid || belowDef.replaceable) {
            targetY--;
          } else {
            break;
          }
        }
        if (targetY < item.y) {
          this.setBlock(item.x, item.y, item.z, BLOCK_IDS.AIR, 0, true);
          this.setBlock(item.x, targetY, item.z, id, 0, true);
        }
      }
    }
  }

  getOrCreateChest(wx, y, wz) {
    const key = blockCoordKey(Math.floor(wx), Math.floor(y), Math.floor(wz));
    if (!this.chests.has(key)) {
      // Check if this chest was generated by TerrainGenerator (not in chunk deltas)
      const cx = Math.floor(wx) >> 4;
      const cz = Math.floor(wz) >> 4;
      const lx = Math.floor(wx) & 15;
      const lz = Math.floor(wz) & 15;
      const chunk = this.getChunk(cx, cz);
      const isNaturalChest = chunk && !chunk.deltas.has(chunk.index(lx, Math.floor(y), lz));
      if (isNaturalChest) {
        this.chests.set(key, this.generator.generateRuinLoot(Math.floor(wx), Math.floor(y), Math.floor(wz)));
      } else {
        this.chests.set(key, new Array(18).fill(null));
      }
    }
    return this.chests.get(key);
  }

  getOrCreateFurnace(wx, y, wz) {
    const key = blockCoordKey(Math.floor(wx), Math.floor(y), Math.floor(wz));
    if (!this.furnaces.has(key)) {
      this.furnaces.set(key, {
        x: Math.floor(wx),
        y: Math.floor(y),
        z: Math.floor(wz),
        input: null,
        fuel: null,
        output: null,
        burnTime: 0,
        maxBurnTime: 0,
        cookProgress: 0,
        cookTotal: 6.0,
      });
    }
    return this.furnaces.get(key);
  }

  removeContainerAt(wx, y, wz) {
    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);
    const key = blockCoordKey(ix, iy, iz);

    if (this.chests.has(key)) {
      const slots = this.chests.get(key);
      if (this.onDropItem) {
        for (const s of slots) {
          if (s && s.count > 0) this.onDropItem(ix + 0.5, iy + 0.5, iz + 0.5, s.id, s.count);
        }
      }
      this.chests.delete(key);
    }

    if (this.furnaces.has(key)) {
      const f = this.furnaces.get(key);
      if (this.onDropItem) {
        for (const s of [f.input, f.fuel, f.output]) {
          if (s && s.count > 0) this.onDropItem(ix + 0.5, iy + 0.5, iz + 0.5, s.id, s.count);
        }
      }
      this.furnaces.delete(key);
    }
  }

  updateFurnaces(dt) {
    for (const [, f] of this.furnaces.entries()) {
      const wasBurning = f.burnTime > 0;
      const recipe = f.input ? getSmeltingRecipe(f.input.id) : null;
      const canOutput =
        recipe &&
        (!f.output ||
          (f.output.id === recipe.output.id &&
            f.output.count + recipe.output.count <= getItemDef(recipe.output.id).maxStack));

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
      }

      if (f.burnTime <= 0 && canOutput && f.fuel && f.fuel.count > 0) {
        const fuelDef = getItemDef(f.fuel.id);
        if (fuelDef.fuelTime > 0) {
          f.burnTime = fuelDef.fuelTime;
          f.maxBurnTime = fuelDef.fuelTime;
          f.fuel.count--;
          if (f.fuel.count <= 0) f.fuel = null;
        }
      }

      if (f.burnTime > 0 && canOutput) {
        f.cookTotal = recipe.cookTime;
        f.cookProgress += dt;
        if (f.cookProgress >= f.cookTotal) {
          f.cookProgress = 0;
          f.input.count--;
          if (f.input.count <= 0) f.input = null;
          if (!f.output) {
            f.output = { id: recipe.output.id, count: recipe.output.count };
          } else {
            f.output.count += recipe.output.count;
          }
        }
      } else {
        f.cookProgress = Math.max(0, f.cookProgress - dt * 2.0);
      }

      const isBurning = f.burnTime > 0;
      if (wasBurning !== isBurning) {
        const currentId = this.getBlock(f.x, f.y, f.z);
        if (currentId === BLOCK_IDS.FURNACE || currentId === BLOCK_IDS.LIT_FURNACE) {
          const meta = this.getMeta(f.x, f.y, f.z);
          this.setBlock(
            f.x,
            f.y,
            f.z,
            isBurning ? BLOCK_IDS.LIT_FURNACE : BLOCK_IDS.FURNACE,
            meta,
            true
          );
        }
      }
    }
  }

  rebuildChunkMesh(chunk) {
    if (!this.scene) {
      chunk.dirtyMesh = false;
      return;
    }

    chunk.disposeMeshes(this.chunkGroup);
    const geoms = this.mesher.buildChunkGeometries(chunk);
    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    const attachPass = (passKey, geom, material, renderOrder) => {
      if (!geom) return;
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(worldX, 0, worldZ);
      mesh.renderOrder = renderOrder;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.chunkGroup.add(mesh);
      chunk.meshes[passKey] = mesh;
    };

    attachPass('opaque', geoms.opaque, this.materials.opaque, 0);
    attachPass('cutout', geoms.cutout, this.materials.cutout, 1);
    attachPass('translucent', geoms.translucent, this.materials.translucent, 2);

    chunk.dirtyMesh = false;
  }

  update(dt, playerX, playerZ, elapsedTime) {
    this.materials.uniforms.uTime.value = elapsedTime;
    this.updateGravityBlocks(dt);
    this.updateFurnaces(dt);

    const pcx = Math.floor(playerX) >> 4;
    const pcz = Math.floor(playerZ) >> 4;

    let generatedBudget = 3;
    let meshedBudget = 3;

    for (let i = 0; i < this.spiralOffsets.length; i++) {
      const off = this.spiralOffsets[i];
      const cx = pcx + off.dx;
      const cz = pcz + off.dz;
      let chunk = this.getChunk(cx, cz);

      if (!chunk) {
        if (generatedBudget > 0) {
          chunk = this.ensureChunk(cx, cz);
          generatedBudget--;
        } else {
          continue;
        }
      }

      if (chunk.dirtyLight && meshedBudget > 0) {
        computeChunkLighting(this, chunk);
      }

      if (chunk.dirtyMesh && meshedBudget > 0) {
        this.rebuildChunkMesh(chunk);
        meshedBudget--;
      }

      if (generatedBudget <= 0 && meshedBudget <= 0) {
        break;
      }
    }

    // Unload distant chunks beyond renderDistance + 2 while preserving deltas
    const unloadDistSq = (this.renderDistance + 2.5) * (this.renderDistance + 2.5);
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > unloadDistSq) {
        const deltas = chunk.serializeDeltas();
        if (deltas) {
          this.savedChunkDeltas.set(key, deltas);
        }
        chunk.disposeMeshes(this.chunkGroup);
        this.chunks.delete(key);
      }
    }
  }

  // Fast 3D Voxel DDA Raycast (Amanatides & Woo)
  raycast(origin, direction, maxDist = 5.6) {
    const dirLen = Math.hypot(direction.x, direction.y, direction.z);
    if (dirLen < 1e-6) return null;

    const dx = direction.x / dirLen;
    const dy = direction.y / dirLen;
    const dz = direction.z / dirLen;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDeltaX = dx === 0 ? 1e30 : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? 1e30 : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? 1e30 : Math.abs(1 / dz);

    let tMaxX = dx === 0 ? 1e30 : (dx > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX;
    let tMaxY = dy === 0 ? 1e30 : (dy > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY;
    let tMaxZ = dz === 0 ? 1e30 : (dz > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ;

    let dist = 0;
    let normX = 0;
    let normY = 0;
    let normZ = 0;

    for (let steps = 0; steps < 64 && dist <= maxDist; steps++) {
      if (y >= 0 && y < WORLD_HEIGHT) {
        const blockId = this.getBlock(x, y, z);
        if (blockId !== BLOCK_IDS.AIR) {
          const def = getItemDef(blockId);
          if (!def.liquid) {
            return {
              x,
              y,
              z,
              blockId,
              def,
              distance: dist,
              normal: { x: normX, y: normY, z: normZ },
              placePos: { x: x + normX, y: y + normY, z: z + normZ },
            };
          }
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          normX = -stepX; normY = 0; normZ = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normX = 0; normY = 0; normZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          normX = 0; normY = -stepY; normZ = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normX = 0; normY = 0; normZ = -stepZ;
        }
      }
    }

    return null;
  }

  isNearbyCraftingTable(wx, wy, wz, radius = 4) {
    const px = Math.floor(wx);
    const py = Math.floor(wy);
    const pz = Math.floor(wz);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (this.getBlock(px + dx, py + dy, pz + dz) === BLOCK_IDS.CRAFTING_TABLE) {
            return true;
          }
        }
      }
    }
    return false;
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.disposeMeshes(this.chunkGroup);
    }
    this.chunks.clear();
    if (this.scene && this.chunkGroup) {
      this.scene.remove(this.chunkGroup);
    }
    this.materials.opaque.dispose();
    this.materials.cutout.dispose();
    this.materials.translucent.dispose();
  }
}
