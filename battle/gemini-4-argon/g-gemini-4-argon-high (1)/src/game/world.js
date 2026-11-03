// World Manager: Chunk Streaming, Sky & Block Lighting, Water Flow, Deltas & 3D DDA Raycast
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, DEFAULT_RENDER_DISTANCE } from './constants.js';
import { BLOCK, REGISTRY, getDef } from './items.js';
import { SeededNoise } from './noise.js';
import { TerrainGenerator } from './terrain.js';
import { buildChunkGeometries } from './mesher.js';

// Precomputed lighting LUTs & reusable scratch buffers (zero GC pressure!)
const LIGHT_PAD = 6;
const LIGHT_W = CHUNK_SIZE + LIGHT_PAD * 2; // 28
const LIGHT_TOTAL = LIGHT_W * CHUNK_HEIGHT * LIGHT_W;
const skyScratch = new Uint8Array(LIGHT_TOTAL);
const blkScratch = new Uint8Array(LIGHT_TOTAL);
const opqScratch = new Uint8Array(LIGHT_TOTAL);
const bfsScratch = new Int32Array(LIGHT_TOTAL);

const LIGHT_OP_LUT = new Uint8Array(256); // 0: clear, 1: semi-attenuate 1, 2: opaque, 3: water-attenuate 2
const LIGHT_EMIT_LUT = new Uint8Array(256);
for (const k of Object.keys(REGISTRY)) {
  const id = Number(k);
  const d = REGISTRY[id];
  if (!d) continue;
  if (d.opaque && d.renderType === 'cube') LIGHT_OP_LUT[id] = 2;
  else if (id === BLOCK.WATER) LIGHT_OP_LUT[id] = 3;
  else if (id === BLOCK.ICE || id === BLOCK.OAK_LEAVES || id === BLOCK.BIRCH_LEAVES || id === BLOCK.SPRUCE_LEAVES) {
    LIGHT_OP_LUT[id] = 1;
  }
  LIGHT_EMIT_LUT[id] = d.light || 0;
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function localIdx(lx, y, lz) {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export class World {
  constructor(scene, materials, seed = 'EmeraldValley', savedMods = null) {
    this.scene = scene;
    this.materials = materials;
    this.seed = String(seed);
    this.noise = new SeededNoise(this.seed);
    this.terrain = new TerrainGenerator(this.noise);

    this.renderDistance = DEFAULT_RENDER_DISTANCE;
    this.chunks = new Map(); // key -> chunk object
    this.mods = new Map();   // key -> Map<localIdx, blockId>

    if (savedMods) {
      this.importMods(savedMods);
    }

    this.group = new THREE.Group();
    if (this.scene) this.scene.add(this.group);

    this.meshQueue = [];
    this.waterQueue = [];
    this.waterTimer = 0;
  }

  exportMods() {
    const out = {};
    for (const [k, map] of this.mods.entries()) {
      if (map.size === 0) continue;
      const arr = [];
      for (const [idx, id] of map.entries()) {
        arr.push(idx, id);
      }
      out[k] = arr;
    }
    return out;
  }

  importMods(raw) {
    this.mods.clear();
    if (!raw || typeof raw !== 'object') return;
    for (const [k, arr] of Object.entries(raw)) {
      if (!Array.isArray(arr)) continue;
      const map = new Map();
      for (let i = 0; i < arr.length; i += 2) {
        map.set(arr[i], arr[i + 1]);
      }
      this.mods.set(k, map);
    }
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  ensureChunkData(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const blocks = this.terrain.generateChunkData(cx, cz);
    const modMap = this.mods.get(key);
    if (modMap) {
      for (const [idx, id] of modMap.entries()) {
        blocks[idx] = id;
      }
    }

    chunk = {
      cx,
      cz,
      key,
      blocks,
      light: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
      lightDirty: true,
      meshDirty: true,
      meshes: { opaque: null, cutout: null, water: null },
    };
    this.chunks.set(key, chunk);
    return chunk;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getBlock(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0) return BLOCK.BEDROCK;
    if (iy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.blocks[localIdx(lx, iy, lz)];
  }

  getPackedLight(wx, y, wz) {
    const iy = Math.floor(y);
    if (iy < 0) return 0;
    if (iy >= CHUNK_HEIGHT) return 0xf0; // full skyLight = 15, blockLight = 0
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0xf0;
    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.light[localIdx(lx, iy, lz)];
  }

  setBlock(wx, y, wz, newId, recordMod = true) {
    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);
    if (iy <= 0 || iy >= CHUNK_HEIGHT) return false;

    const { cx, cz, lx, lz } = this.worldToChunk(ix, iz);
    const chunk = this.ensureChunkData(cx, cz);
    const idx = localIdx(lx, iy, lz);
    const prev = chunk.blocks[idx];
    if (prev === newId) return false;

    chunk.blocks[idx] = newId;

    if (recordMod) {
      let modMap = this.mods.get(chunk.key);
      if (!modMap) {
        modMap = new Map();
        this.mods.set(chunk.key, modMap);
      }
      modMap.set(idx, newId);
    }

    // Recompute local lighting across affected 3x3 chunk neighborhood & rebuild affected meshes immediately
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nb = this.getChunk(cx + dx, cz + dz);
        if (nb) nb.lightDirty = true;
      }
    }

    const rebuildSet = new Set([chunkKey(cx, cz)]);
    if (lx === 0) rebuildSet.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) rebuildSet.add(chunkKey(cx + 1, cz));
    if (lz === 0) rebuildSet.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) rebuildSet.add(chunkKey(cx, cz + 1));

    // If a light-emitting block was placed or broken, also refresh adjacent chunks within light reach
    if (getDef(prev).light > 0 || getDef(newId).light > 0) {
      rebuildSet.add(chunkKey(cx - 1, cz));
      rebuildSet.add(chunkKey(cx + 1, cz));
      rebuildSet.add(chunkKey(cx, cz - 1));
      rebuildSet.add(chunkKey(cx, cz + 1));
    }

    for (const k of rebuildSet) {
      const [rcx, rcz] = k.split(',').map(Number);
      const rc = this.getChunk(rcx, rcz);
      if (rc) {
        this.computeChunkLighting(rcx, rcz);
      }
    }

    for (const k of rebuildSet) {
      const [rcx, rcz] = k.split(',').map(Number);
      const rc = this.getChunk(rcx, rcz);
      if (rc) {
        this.rebuildChunkMesh(rc);
      }
    }

    // Remove unsupported flora/torch above broken solid block
    if (newId === BLOCK.AIR) {
      const above = this.getBlock(ix, iy + 1, iz);
      const aboveDef = getDef(above);
      if (aboveDef.renderType === 'cross' || above === BLOCK.TORCH || above === BLOCK.CACTUS) {
        this.setBlock(ix, iy + 1, iz, BLOCK.AIR, recordMod);
      }
    }

    // Trigger neighbor water check
    this.enqueueWaterCheck(ix, iy, iz);

    return true;
  }

  enqueueWaterCheck(wx, y, wz) {
    const coords = [
      [wx, y, wz],
      [wx + 1, y, wz],
      [wx - 1, y, wz],
      [wx, y + 1, wz],
      [wx, y - 1, wz],
      [wx, y, wz + 1],
      [wx, y, wz - 1],
    ];
    for (const [x, cy, z] of coords) {
      if (this.getBlock(x, cy, z) === BLOCK.WATER && this.waterQueue.length < 160) {
        this.waterQueue.push({ x, y: cy, z, depth: 0 });
      }
    }
  }

  tickWater(dt) {
    if (this.waterQueue.length === 0) return;
    this.waterTimer += dt;
    if (this.waterTimer < 0.18) return;
    this.waterTimer = 0;

    const batch = this.waterQueue.splice(0, 16);
    for (const node of batch) {
      const { x, y, z, depth } = node;
      if (this.getBlock(x, y, z) !== BLOCK.WATER) continue;
      if (y <= 1) continue;

      // Priority 1: Flow downward into air or replaceable flora
      const below = this.getBlock(x, y - 1, z);
      if (below === BLOCK.AIR || (getDef(below).replaceable && below !== BLOCK.WATER && below !== BLOCK.LAVA)) {
        this.setBlock(x, y - 1, z, BLOCK.WATER, false);
        if (this.waterQueue.length < 160) {
          this.waterQueue.push({ x, y: y - 1, z, depth: 0 });
        }
        continue;
      }

      // Priority 2: Spread horizontally up to 3 steps when resting on solid ground
      if (depth < 3 && getDef(below).solid) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of dirs) {
          const nb = this.getBlock(x + dx, y, z + dz);
          if (nb === BLOCK.AIR) {
            this.setBlock(x + dx, y, z + dz, BLOCK.WATER, false);
            if (this.waterQueue.length < 160) {
              this.waterQueue.push({ x: x + dx, y, z: z + dz, depth: depth + 1 });
            }
          }
        }
      }
    }
  }

  // Fast zero-allocation lighting pass: vertical sky columns + horizontal sky/block BFS
  computeChunkLighting(cx, cz) {
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    const PAD = LIGHT_PAD;
    const W = LIGHT_W;
    const H = CHUNK_HEIGHT;
    const strideY = W * W;

    const skyArr = skyScratch;
    const blkArr = blkScratch;
    const opqArr = opqScratch;
    blkArr.fill(0);

    // Fetch 3x3 chunk pointers once (9 lookups total)
    const grid = new Array(9);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        grid[(dz + 1) * 3 + (dx + 1)] = this.getChunk(cx + dx, cz + dz);
      }
    }

    const blkSeeds = [];

    for (let pz = 0; pz < W; pz++) {
      const gz = pz < PAD ? 0 : pz >= PAD + CHUNK_SIZE ? 2 : 1;
      const slz = pz < PAD ? pz + CHUNK_SIZE - PAD : pz >= PAD + CHUNK_SIZE ? pz - PAD - CHUNK_SIZE : pz - PAD;
      for (let px = 0; px < W; px++) {
        const gx = px < PAD ? 0 : px >= PAD + CHUNK_SIZE ? 2 : 1;
        const slx = px < PAD ? px + CHUNK_SIZE - PAD : px >= PAD + CHUNK_SIZE ? px - PAD - CHUNK_SIZE : px - PAD;
        const srcChunk = grid[gz * 3 + gx];
        const sBlocks = srcChunk ? srcChunk.blocks : null;

        let skyVal = 15;
        let colBase = slz * CHUNK_SIZE + slx + (H - 1) * 256;
        let pi = (H - 1) * strideY + pz * W + px;

        for (let y = H - 1; y >= 0; y--) {
          const id = sBlocks ? sBlocks[colBase] : BLOCK.AIR;
          const opCode = LIGHT_OP_LUT[id];

          if (opCode === 2) {
            opqArr[pi] = 2;
            skyVal = 0;
          } else if (opCode > 0) {
            opqArr[pi] = 1;
            skyVal -= opCode === 3 ? 2 : 1;
            if (skyVal < 0) skyVal = 0;
          } else {
            opqArr[pi] = 0;
          }

          skyArr[pi] = skyVal;

          const emit = LIGHT_EMIT_LUT[id];
          if (emit > 0) {
            blkArr[pi] = emit;
            blkSeeds.push(pi);
          }

          colBase -= 256;
          pi -= strideY;
        }
      }
    }

    // Seed horizontal sky BFS into bfsScratch
    let qTail = 0;
    for (let y = 1; y < H - 1; y++) {
      const yOff = y * strideY;
      for (let pz = 1; pz < W - 1; pz++) {
        let pi = yOff + pz * W + 1;
        for (let px = 1; px < W - 1; px++, pi++) {
          const s = skyArr[pi];
          if (s <= 1) continue;
          const thresh = s - 1;
          if (
            skyArr[pi - 1] < thresh ||
            skyArr[pi + 1] < thresh ||
            skyArr[pi - W] < thresh ||
            skyArr[pi + W] < thresh
          ) {
            bfsScratch[qTail++] = pi;
          }
        }
      }
    }

    const neighbors = [-1, 1, -W, W, -strideY, strideY];

    // Flood-fill skyLight
    let qHead = 0;
    while (qHead < qTail) {
      const pi = bfsScratch[qHead++];
      const cur = skyArr[pi];
      if (cur <= 1) continue;

      const rem = pi % strideY;
      const y = (pi / strideY) | 0;
      const pz = (rem / W) | 0;
      const px = rem % W;

      for (let d = 0; d < 6; d++) {
        if (d === 0 && px === 0) continue;
        if (d === 1 && px === W - 1) continue;
        if (d === 2 && pz === 0) continue;
        if (d === 3 && pz === W - 1) continue;
        if (d === 4 && y === 0) continue;
        if (d === 5 && y === H - 1) continue;

        const ni = pi + neighbors[d];
        const op = opqArr[ni];
        if (op === 2) continue;
        const nextVal = cur - (op === 1 ? 2 : 1);
        if (nextVal > skyArr[ni]) {
          skyArr[ni] = nextVal;
          if (nextVal > 1) bfsScratch[qTail++] = ni;
        }
      }
    }

    // Flood-fill warm blockLight
    qHead = 0;
    qTail = blkSeeds.length;
    for (let i = 0; i < qTail; i++) bfsScratch[i] = blkSeeds[i];

    while (qHead < qTail) {
      const pi = bfsScratch[qHead++];
      const cur = blkArr[pi];
      if (cur <= 1) continue;

      const rem = pi % strideY;
      const y = (pi / strideY) | 0;
      const pz = (rem / W) | 0;
      const px = rem % W;

      for (let d = 0; d < 6; d++) {
        if (d === 0 && px === 0) continue;
        if (d === 1 && px === W - 1) continue;
        if (d === 2 && pz === 0) continue;
        if (d === 3 && pz === W - 1) continue;
        if (d === 4 && y === 0) continue;
        if (d === 5 && y === H - 1) continue;

        const ni = pi + neighbors[d];
        if (opqArr[ni] === 2) continue;
        const nextVal = cur - 1;
        if (nextVal > blkArr[ni]) {
          blkArr[ni] = nextVal;
          if (nextVal > 1) bfsScratch[qTail++] = ni;
        }
      }
    }

    // Copy center 16x96x16 slice into chunk.light
    const dstLight = chunk.light;
    let dstIdx = 0;
    for (let y = 0; y < H; y++) {
      const yOff = y * strideY;
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        let pi = yOff + (lz + PAD) * W + PAD;
        for (let lx = 0; lx < CHUNK_SIZE; lx++, pi++, dstIdx++) {
          dstLight[dstIdx] = ((skyArr[pi] & 15) << 4) | (blkArr[pi] & 15);
        }
      }
    }

    chunk.lightDirty = false;
  }

  rebuildChunkMesh(chunk) {
    if (!this.materials || !this.scene) {
      chunk.meshDirty = false;
      return;
    }

    if (chunk.lightDirty) {
      this.computeChunkLighting(chunk.cx, chunk.cz);
    }

    const geoms = buildChunkGeometries(this, chunk.cx, chunk.cz);
    this.disposeChunkMeshes(chunk);

    if (!geoms) {
      chunk.meshDirty = false;
      return;
    }

    const wx = chunk.cx * CHUNK_SIZE;
    const wz = chunk.cz * CHUNK_SIZE;

    if (geoms.opaque) {
      const m = new THREE.Mesh(geoms.opaque, this.materials.opaqueMaterial);
      m.position.set(wx, 0, wz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      chunk.meshes.opaque = m;
    }

    if (geoms.cutout) {
      const m = new THREE.Mesh(geoms.cutout, this.materials.cutoutMaterial);
      m.position.set(wx, 0, wz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      chunk.meshes.cutout = m;
    }

    if (geoms.water) {
      const m = new THREE.Mesh(geoms.water, this.materials.waterMaterial);
      m.position.set(wx, 0, wz);
      m.renderOrder = 2;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      chunk.meshes.water = m;
    }

    chunk.meshDirty = false;
  }

  disposeChunkMeshes(chunk) {
    for (const key of ['opaque', 'cutout', 'water']) {
      const mesh = chunk.meshes[key];
      if (mesh) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        chunk.meshes[key] = null;
      }
    }
  }

  // Time-budgeted spiral chunk loader around player world coordinates
  updateStreaming(playerX, playerZ, immediateRadius = 0) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    const rd = this.renderDistance;

    // Ensure data exists for renderDistance + 1 so border AO/culling has full neighbor data
    const neededData = new Set();
    const targets = [];

    for (let dz = -rd - 1; dz <= rd + 1; dz++) {
      for (let dx = -rd - 1; dx <= rd + 1; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const distSq = dx * dx + dz * dz;
        if (distSq <= (rd + 1) * (rd + 1)) {
          neededData.add(chunkKey(cx, cz));
          if (Math.abs(dx) <= rd && Math.abs(dz) <= rd && distSq <= rd * rd + 1) {
            targets.push({ cx, cz, distSq });
          }
        }
      }
    }

    targets.sort((a, b) => a.distSq - b.distSq);

    const start = performance.now();
    const budgetMs = immediateRadius > 0 ? 500 : 5.5;

    // Ensure immediate radius data + neighbor data first
    for (const t of targets) {
      const isImmediate = t.distSq <= immediateRadius * immediateRadius;
      if (!isImmediate && performance.now() - start > budgetMs) break;

      // Ensure 3x3 neighbor block data exists before meshing so borders never show seams
      for (let nz = -1; nz <= 1; nz++) {
        for (let nx = -1; nx <= 1; nx++) {
          this.ensureChunkData(t.cx + nx, t.cz + nz);
        }
      }

      const chunk = this.ensureChunkData(t.cx, t.cz);
      if (chunk.meshDirty) {
        this.rebuildChunkMesh(chunk);
      }
    }

    // Unload distant chunks beyond rd + 2
    const unloadDistSq = (rd + 2.5) * (rd + 2.5);
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > unloadDistSq && !neededData.has(key)) {
        this.disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }
  }

  // Find a safe dry spawn coordinate near (0, 0)
  findSpawnPoint() {
    this.updateStreaming(0, 0, 2);
    let best = { x: 0.5, y: 48, z: 0.5 };
    for (let r = 0; r <= 24; r += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        for (let dz = -r; dz <= r; dz += 2) {
          this.ensureChunkData(Math.floor(dx / CHUNK_SIZE), Math.floor(dz / CHUNK_SIZE));
          for (let y = CHUNK_HEIGHT - 4; y > 10; y--) {
            const b = this.getBlock(dx, y, dz);
            if (b === BLOCK.WATER || b === BLOCK.LAVA) break;
            const def = getDef(b);
            if (def.solid && b !== BLOCK.CACTUS && !b.toString().includes('LEAVES')) {
              if (
                b === BLOCK.OAK_LEAVES ||
                b === BLOCK.BIRCH_LEAVES ||
                b === BLOCK.SPRUCE_LEAVES
              ) {
                continue;
              }
              const head1 = this.getBlock(dx, y + 1, dz);
              const head2 = this.getBlock(dx, y + 2, dz);
              if (!getDef(head1).solid && !getDef(head2).solid && head1 !== BLOCK.WATER) {
                return { x: dx + 0.5, y: y + 1.05, z: dz + 0.5 };
              }
              break;
            }
          }
        }
      }
    }
    return best;
  }

  getTopSolidY(wx, wz) {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    for (let y = CHUNK_HEIGHT - 2; y >= 1; y--) {
      const id = this.getBlock(ix, y, iz);
      if (getDef(id).solid) return y;
    }
    return 1;
  }

  // Exact 3D DDA Voxel Raycast (Amanatides & Woo)
  raycast(origin, dir, maxDist = 6.0, options = {}) {
    const includeWater = Boolean(options.includeWater);
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const dx = dir.x;
    const dy = dir.y;
    const dz = dir.z;

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

    let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;

    for (let i = 0; i < 64 && dist <= maxDist; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR) {
        const def = getDef(id);
        if (def.selectable || (includeWater && id === BLOCK.WATER)) {
          return {
            x,
            y,
            z,
            id,
            def,
            nx,
            ny,
            nz,
            dist,
            placeX: x + nx,
            placeY: y + ny,
            placeZ: z + nz,
          };
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else if (tMaxY < tMaxZ) {
        dist = tMaxY;
        tMaxY += tDeltaY;
        y += stepY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    }

    return null;
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      this.disposeChunkMeshes(chunk);
    }
    this.chunks.clear();
    if (this.scene && this.group) {
      this.scene.remove(this.group);
    }
  }
}
