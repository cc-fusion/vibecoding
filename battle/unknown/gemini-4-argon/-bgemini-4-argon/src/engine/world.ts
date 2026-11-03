import * as THREE from 'three';
import { BLOCK, ITEMS } from './blocks';
import { buildChunkMeshes, WorldLightReader } from './chunkMesher';
import { BiomeId, CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from './constants';
import { getAtlasTexture } from './textureAtlas';
import { createTerrainMaterial, createWaterMaterial, createWorldUniforms, WorldUniforms } from './shaders';
import { BIOME_NAMES, WorldGenerator } from './worldGen';

export interface ChunkRecord {
  cx: number;
  cz: number;
  key: string;
  blocks: Uint8Array;
  skyLight: Uint8Array;
  blockLight: Uint8Array;
  dirtyMesh: boolean;
  dirtyLight: boolean;
  group: THREE.Group;
  solidMesh: THREE.Mesh | null;
  cutoutMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
}

const CHUNK_VOL = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class VoxelWorld implements WorldLightReader {
  readonly sceneGroup = new THREE.Group();
  readonly generator: WorldGenerator;
  readonly uniforms: WorldUniforms;
  readonly solidMaterial: THREE.ShaderMaterial;
  readonly cutoutMaterial: THREE.ShaderMaterial;
  readonly waterMaterial: THREE.ShaderMaterial;

  chunks = new Map<string, ChunkRecord>();
  // Persistent sparse user block edits: chunkKey -> Map<localIdx, blockId>
  savedEdits = new Map<string, Map<number, number>>();

  renderDistance = 5;
  private genQueue: { cx: number; cz: number; dist2: number }[] = [];
  private lastCenterChunkX = 999999;
  private lastCenterChunkZ = 999999;

  constructor(seed: number, serializedEdits?: Record<string, [number, number][]>) {
    this.generator = new WorldGenerator(seed);
    const atlas = getAtlasTexture();
    this.uniforms = createWorldUniforms(atlas);
    this.solidMaterial = createTerrainMaterial(this.uniforms, { cutout: false, doubleSide: false });
    this.cutoutMaterial = createTerrainMaterial(this.uniforms, { cutout: true, doubleSide: true });
    this.waterMaterial = createWaterMaterial(this.uniforms);

    if (serializedEdits) {
      for (const [k, pairs] of Object.entries(serializedEdits)) {
        const m = new Map<number, number>();
        for (const [idx, bid] of pairs) m.set(idx, bid);
        this.savedEdits.set(k, m);
      }
    }
  }

  serializeEdits(): Record<string, [number, number][]> {
    const out: Record<string, [number, number][]> = {};
    for (const [k, map] of this.savedEdits.entries()) {
      if (map.size > 0) {
        out[k] = Array.from(map.entries());
      }
    }
    return out;
  }

  private toChunkCoords(wx: number, wz: number): [number, number, number, number] {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return [cx, cz, lx, lz];
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0) return BLOCK.BEDROCK;
    if (wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const [cx, cz, lx, lz] = this.toChunkCoords(Math.floor(wx), Math.floor(wz));
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    return chunk.blocks[(Math.floor(wy) * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getSkyLight(wx: number, wy: number, wz: number): number {
    if (wy < 0) return 0;
    if (wy >= WORLD_HEIGHT) return 15;
    const [cx, cz, lx, lz] = this.toChunkCoords(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return wy >= SEA_LEVEL ? 15 : 4;
    return chunk.skyLight[(wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getBlockLight(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= WORLD_HEIGHT) return 0;
    const [cx, cz, lx, lz] = this.toChunkCoords(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    return chunk.blockLight[(wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  isChunkLoadedAt(wx: number, wz: number): boolean {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    return this.chunks.has(chunkKey(cx, cz));
  }

  getBiomeInfo(wx: number, wz: number): { id: BiomeId; label: string } {
    const id = this.generator.getBiomeAt(Math.floor(wx), Math.floor(wz));
    return { id, label: BIOME_NAMES[id] };
  }

  findSpawnPosition(): { x: number; y: number; z: number } {
    // Pass 1: Prefer open sunlit meadow or forest clearing with clear sky above
    for (let radius = 0; radius <= 96; radius += 6) {
      const steps = radius === 0 ? 1 : 12;
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const col = this.generator.sampleColumn(wx, wz);
        if (
          col.height >= SEA_LEVEL + 2 &&
          col.height <= 49 &&
          col.biome === 'plains'
        ) {
          this.ensureChunkGenerated(Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE));
          let skyClear = ITEMS[this.getBlock(wx, col.height, wz)]?.solid ?? false;
          for (let dy = 1; dy <= 10 && skyClear; dy++) {
            if (this.getBlock(wx, col.height + dy, wz) !== BLOCK.AIR) skyClear = false;
          }
          if (skyClear) {
            return { x: wx + 0.5, y: col.height + 1.05, z: wz + 0.5 };
          }
        }
      }
    }

    // Pass 2: Any dry non-ocean land
    for (let radius = 0; radius <= 96; radius += 4) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const col = this.generator.sampleColumn(wx, wz);
        if (col.height > SEA_LEVEL + 1 && col.height < 64 && col.biome !== 'ocean') {
          this.ensureChunkGenerated(Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE));
          let topY = col.height + 1;
          while (topY < WORLD_HEIGHT - 3 && ITEMS[this.getBlock(wx, topY, wz)]?.solid) {
            topY++;
          }
          return { x: wx + 0.5, y: topY + 0.05, z: wz + 0.5 };
        }
      }
    }
    const fallbackH = Math.max(SEA_LEVEL + 2, this.generator.getSurfaceHeight(0, 0) + 2);
    return { x: 0.5, y: fallbackH, z: 0.5 };
  }

  findScenicYaw(wx: number, wz: number): number {
    let bestYaw = 0;
    let lowestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const yaw = (i / 16) * Math.PI * 2;
      const dx = -Math.sin(yaw);
      const dz = -Math.cos(yaw);
      let score = 0;
      for (const dist of [8, 16, 28]) {
        score += this.generator.getSurfaceHeight(wx + dx * dist, wz + dz * dist);
      }
      if (score < lowestScore) {
        lowestScore = score;
        bestYaw = yaw;
      }
    }
    return bestYaw;
  }

  sampleTopBlockColor(wx: number, wz: number): string {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const [cx, cz, lx, lz] = this.toChunkCoords(ix, iz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      for (let y = WORLD_HEIGHT - 2; y >= 1; y--) {
        const id = chunk.blocks[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
        if (id !== BLOCK.AIR && id !== BLOCK.TALL_GRASS) {
          return ITEMS[id]?.colorHex ?? '#59a646';
        }
      }
    }
    const col = this.generator.sampleColumn(ix, iz);
    if (col.height <= SEA_LEVEL) return col.biome === 'taiga' ? '#93c5fd' : '#2c82e0';
    if (col.biome === 'desert') return '#e2cf8b';
    if (col.biome === 'taiga') return '#f1f6fa';
    if (col.biome === 'mountains') return col.height >= 61 ? '#f5fbff' : '#7c8087';
    if (col.biome === 'forest') return '#3f8a36';
    return '#59a646';
  }

  ensureChunkGenerated(cx: number, cz: number): ChunkRecord {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_VOL);
    this.generator.generateChunkBlocks(cx, cz, blocks);

    // Apply any user edits from save storage
    const edits = this.savedEdits.get(key);
    if (edits) {
      for (const [idx, bid] of edits.entries()) {
        if (idx >= 0 && idx < CHUNK_VOL) blocks[idx] = bid;
      }
    }

    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    this.sceneGroup.add(group);

    const rec: ChunkRecord = {
      cx,
      cz,
      key,
      blocks,
      skyLight: new Uint8Array(CHUNK_VOL),
      blockLight: new Uint8Array(CHUNK_VOL),
      dirtyMesh: true,
      dirtyLight: true,
      group,
      solidMesh: null,
      cutoutMesh: null,
      waterMesh: null,
    };
    this.chunks.set(key, rec);
    this.computeChunkLighting(rec);

    // Neighbor chunks should refresh boundary faces
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nb = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (nb) nb.dirtyMesh = true;
    }

    return rec;
  }

  computeChunkLighting(chunk: ChunkRecord): void {
    const { blocks, skyLight, blockLight, cx, cz } = chunk;
    skyLight.fill(0);
    blockLight.fill(0);

    const skyQueue: number[] = [];
    const blkQueue: number[] = [];

    // 1. Vertical sunlight cast from top of chunk down
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let currentSky = 15;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          const id = blocks[idx];
          const def = ITEMS[id];

          if (def && def.opaque) {
            currentSky = 0;
          } else if (id === BLOCK.WATER || id === BLOCK.ICE) {
            currentSky = Math.max(2, currentSky - 2);
          } else if (def && def.transparent && def.solid) {
            // Leaves filter sky light slightly
            currentSky = Math.max(4, currentSky - 1);
          }

          skyLight[idx] = currentSky;
          if (currentSky > 1) skyQueue.push(idx);

          if (def && def.lightEmission > 0) {
            blockLight[idx] = def.lightEmission;
            blkQueue.push(idx);
          }
        }
      }
    }

    // Also pull emissive light across 1-chunk border so torches right next to chunk seams shine smoothly!
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const borderChecks: [number, number, number, number][] = [
          [0, i, -1, i],
          [CHUNK_SIZE - 1, i, CHUNK_SIZE, i],
          [i, 0, i, -1],
          [i, CHUNK_SIZE - 1, i, CHUNK_SIZE],
        ];
        for (const [lx, lz, nx, nz] of borderChecks) {
          const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          if (ITEMS[blocks[idx]]?.opaque) continue;
          const neighborLight = this.getBlockLight(baseX + nx, y, baseZ + nz);
          if (neighborLight > 1 && neighborLight - 1 > blockLight[idx]) {
            blockLight[idx] = neighborLight - 1;
            blkQueue.push(idx);
          }
        }
      }
    }

    // 2. Horizontal + cave mouth sky light bounce (fast in-chunk BFS)
    let head = 0;
    while (head < skyQueue.length) {
      const idx = skyQueue[head++];
      const level = skyLight[idx];
      if (level <= 1) continue;

      const lx = idx % CHUNK_SIZE;
      const rem = (idx - lx) / CHUNK_SIZE;
      const lz = rem % CHUNK_SIZE;
      const y = (rem - lz) / CHUNK_SIZE;

      const nextLevel = level - 2; // smooth cave entrance shadow falloff
      if (nextLevel <= 0) continue;

      const neighbors = [
        lx > 0 ? idx - 1 : -1,
        lx < CHUNK_SIZE - 1 ? idx + 1 : -1,
        lz > 0 ? idx - CHUNK_SIZE : -1,
        lz < CHUNK_SIZE - 1 ? idx + CHUNK_SIZE : -1,
        y > 0 ? idx - CHUNK_SIZE * CHUNK_SIZE : -1,
        y < WORLD_HEIGHT - 1 ? idx + CHUNK_SIZE * CHUNK_SIZE : -1,
      ];
      for (let n = 0; n < 6; n++) {
        const nIdx = neighbors[n];
        if (nIdx < 0) continue;
        if (!ITEMS[blocks[nIdx]]?.opaque && skyLight[nIdx] < nextLevel) {
          skyLight[nIdx] = nextLevel;
          skyQueue.push(nIdx);
        }
      }
    }

    // 3. Emissive Block Light BFS (Torches, Lava, Glowstone, Furnaces, Mushrooms)
    head = 0;
    while (head < blkQueue.length) {
      const idx = blkQueue[head++];
      const level = blockLight[idx];
      if (level <= 1) continue;

      const lx = idx % CHUNK_SIZE;
      const rem = (idx - lx) / CHUNK_SIZE;
      const lz = rem % CHUNK_SIZE;
      const y = (rem - lz) / CHUNK_SIZE;
      const nextLevel = level - 1;

      const neighbors = [
        lx > 0 ? idx - 1 : -1,
        lx < CHUNK_SIZE - 1 ? idx + 1 : -1,
        lz > 0 ? idx - CHUNK_SIZE : -1,
        lz < CHUNK_SIZE - 1 ? idx + CHUNK_SIZE : -1,
        y > 0 ? idx - CHUNK_SIZE * CHUNK_SIZE : -1,
        y < WORLD_HEIGHT - 1 ? idx + CHUNK_SIZE * CHUNK_SIZE : -1,
      ];
      for (let n = 0; n < 6; n++) {
        const nIdx = neighbors[n];
        if (nIdx < 0) continue;
        if (!ITEMS[blocks[nIdx]]?.opaque && blockLight[nIdx] < nextLevel) {
          blockLight[nIdx] = nextLevel;
          blkQueue.push(nIdx);
        }
      }
    }

    chunk.dirtyLight = false;
  }

  rebuildChunkMesh(chunk: ChunkRecord): void {
    if (chunk.dirtyLight) {
      this.computeChunkLighting(chunk);
    }

    const meshes = buildChunkMeshes(chunk.cx, chunk.cz, chunk.blocks, this);

    const disposeMesh = (m: THREE.Mesh | null) => {
      if (m) {
        chunk.group.remove(m);
        m.geometry.dispose();
      }
    };

    disposeMesh(chunk.solidMesh);
    disposeMesh(chunk.cutoutMesh);
    disposeMesh(chunk.waterMesh);
    chunk.solidMesh = null;
    chunk.cutoutMesh = null;
    chunk.waterMesh = null;

    if (meshes.solid) {
      chunk.solidMesh = new THREE.Mesh(meshes.solid, this.solidMaterial);
      chunk.solidMesh.renderOrder = 0;
      chunk.group.add(chunk.solidMesh);
    }
    if (meshes.cutout) {
      chunk.cutoutMesh = new THREE.Mesh(meshes.cutout, this.cutoutMaterial);
      chunk.cutoutMesh.renderOrder = 1;
      chunk.group.add(chunk.cutoutMesh);
    }
    if (meshes.water) {
      chunk.waterMesh = new THREE.Mesh(meshes.water, this.waterMaterial);
      chunk.waterMesh.renderOrder = 3;
      chunk.group.add(chunk.waterMesh);
    }

    chunk.dirtyMesh = false;
  }

  setBlock(wx: number, wy: number, wz: number, blockId: number, immediateRemesh = true): void {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);
    if (iy <= 0 || iy >= WORLD_HEIGHT) return;

    const [cx, cz, lx, lz] = this.toChunkCoords(ix, iz);
    const chunk = this.ensureChunkGenerated(cx, cz);
    const localIdx = (iy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    let finalId = blockId;
    // Natural water flood if digging an air pocket directly beside/under surface water!
    if (blockId === BLOCK.AIR && iy <= SEA_LEVEL) {
      const adjWater =
        this.getBlock(ix + 1, iy, iz) === BLOCK.WATER ||
        this.getBlock(ix - 1, iy, iz) === BLOCK.WATER ||
        this.getBlock(ix, iy, iz + 1) === BLOCK.WATER ||
        this.getBlock(ix, iy, iz - 1) === BLOCK.WATER ||
        this.getBlock(ix, iy + 1, iz) === BLOCK.WATER;
      if (adjWater) finalId = BLOCK.WATER;
    }

    chunk.blocks[localIdx] = finalId;

    // Break unsupported flora/torch directly above if block removed
    if (finalId === BLOCK.AIR && iy + 1 < WORLD_HEIGHT) {
      const aboveId = this.getBlock(ix, iy + 1, iz);
      const aboveDef = ITEMS[aboveId];
      if (aboveDef && (aboveDef.renderType === 'cross' || aboveDef.renderType === 'torch')) {
        this.setBlock(ix, iy + 1, iz, BLOCK.AIR, false);
      }
    }

    let editMap = this.savedEdits.get(chunk.key);
    if (!editMap) {
      editMap = new Map();
      this.savedEdits.set(chunk.key, editMap);
    }
    editMap.set(localIdx, finalId);

    const affected: ChunkRecord[] = [chunk];
    chunk.dirtyLight = true;
    chunk.dirtyMesh = true;

    // Also update neighboring chunks so light & culled border faces stay 100% seamless
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nb = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (nb) {
        nb.dirtyLight = true;
        nb.dirtyMesh = true;
        affected.push(nb);
      }
    }

    if (immediateRemesh) {
      for (const c of affected) this.computeChunkLighting(c);
      // Second pass ensures cross-chunk torch light crosses seam cleanly in both directions
      for (const c of affected) this.computeChunkLighting(c);
      for (const c of affected) this.rebuildChunkMesh(c);
    }
  }

  prewarmAround(wx: number, wz: number, radiusChunks: number, onProgress?: (p: number) => void): void {
    const ccx = Math.floor(wx / CHUNK_SIZE);
    const ccz = Math.floor(wz / CHUNK_SIZE);
    const coords: [number, number][] = [];
    for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
      for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
        if (dx * dx + dz * dz <= radiusChunks * radiusChunks + 1) {
          coords.push([ccx + dx, ccz + dz]);
        }
      }
    }
    coords.sort((a, b) => (a[0] - ccx) ** 2 + (a[1] - ccz) ** 2 - ((b[0] - ccx) ** 2 + (b[1] - ccz) ** 2));

    for (let i = 0; i < coords.length; i++) {
      this.ensureChunkGenerated(coords[i][0], coords[i][1]);
      if (onProgress) onProgress(((i + 1) / (coords.length * 2)) * 100);
    }
    let idx = 0;
    for (const [x, z] of coords) {
      const c = this.chunks.get(chunkKey(x, z));
      if (c) this.rebuildChunkMesh(c);
      idx++;
      if (onProgress) onProgress(50 + (idx / coords.length) * 50);
    }
    this.lastCenterChunkX = ccx;
    this.lastCenterChunkZ = ccz;
  }

  updateStreaming(playerX: number, playerZ: number): void {
    const ccx = Math.floor(playerX / CHUNK_SIZE);
    const ccz = Math.floor(playerZ / CHUNK_SIZE);
    const rd = this.renderDistance;

    if (ccx !== this.lastCenterChunkX || ccz !== this.lastCenterChunkZ || this.genQueue.length === 0) {
      this.lastCenterChunkX = ccx;
      this.lastCenterChunkZ = ccz;
      this.genQueue = [];

      for (let dz = -rd; dz <= rd; dz++) {
        for (let dx = -rd; dx <= rd; dx++) {
          const dist2 = dx * dx + dz * dz;
          if (dist2 > rd * rd + 2) continue;
          const cx = ccx + dx;
          const cz = ccz + dz;
          const existing = this.chunks.get(chunkKey(cx, cz));
          if (!existing || existing.dirtyMesh) {
            this.genQueue.push({ cx, cz, dist2 });
          }
        }
      }
      this.genQueue.sort((a, b) => a.dist2 - b.dist2);

      // Unload distant chunks well outside render distance to cap memory cleanly
      const unloadDist2 = (rd + 3) * (rd + 3);
      for (const [key, ch] of this.chunks.entries()) {
        const dx = ch.cx - ccx;
        const dz = ch.cz - ccz;
        if (dx * dx + dz * dz > unloadDist2) {
          if (ch.solidMesh) ch.solidMesh.geometry.dispose();
          if (ch.cutoutMesh) ch.cutoutMesh.geometry.dispose();
          if (ch.waterMesh) ch.waterMesh.geometry.dispose();
          this.sceneGroup.remove(ch.group);
          this.chunks.delete(key);
        }
      }
    }

    // Time-budgeted streaming (max ~4.5ms per frame so framerate stays silky 60fps!)
    const start = performance.now();
    let processed = 0;
    while (this.genQueue.length > 0 && processed < 3 && performance.now() - start < 4.5) {
      const next = this.genQueue.shift()!;
      const chunk = this.ensureChunkGenerated(next.cx, next.cz);
      if (chunk.dirtyMesh) {
        this.rebuildChunkMesh(chunk);
      }
      processed++;
    }

    // Also flush any dirty neighbor meshes
    if (performance.now() - start < 4.5) {
      for (const ch of this.chunks.values()) {
        if (ch.dirtyMesh) {
          this.rebuildChunkMesh(ch);
          if (performance.now() - start >= 5.5) break;
        }
      }
    }
  }

  dispose(): void {
    for (const ch of this.chunks.values()) {
      if (ch.solidMesh) ch.solidMesh.geometry.dispose();
      if (ch.cutoutMesh) ch.cutoutMesh.geometry.dispose();
      if (ch.waterMesh) ch.waterMesh.geometry.dispose();
      this.sceneGroup.remove(ch.group);
    }
    this.chunks.clear();
    this.solidMaterial.dispose();
    this.cutoutMaterial.dispose();
    this.waterMaterial.dispose();
  }
}
