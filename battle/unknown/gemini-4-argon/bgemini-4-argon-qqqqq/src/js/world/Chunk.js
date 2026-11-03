import { CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT } from '../constants.js';
import { BIOMES, BIOME_IDS } from './BiomeManager.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = `${cx},${cz}`;

    this.voxels = new Uint8Array(CHUNK_VOLUME);
    this.skyLight = new Uint8Array(CHUNK_VOLUME);
    this.blockLight = new Uint8Array(CHUNK_VOLUME);

    this.heightMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    this.biomeGrid = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(BIOME_IDS.PLAINS);
    this.grassTint = new Float32Array(CHUNK_SIZE * CHUNK_SIZE * 3);
    this.foliageTint = new Float32Array(CHUNK_SIZE * CHUNK_SIZE * 3);

    this.dirty = true;
    this.lightDirty = true;
    this.modified = false;

    // Three.js meshes per material pass
    this.opaqueMesh = null;
    this.cutoutMesh = null;
    this.translucentMesh = null;
  }

  index(lx, y, lz) {
    return (y << 8) | (lz << 4) | lx;
  }

  get(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return 0;
    }
    return this.voxels[(y << 8) | (lz << 4) | lx];
  }

  set(lx, y, lz, id) {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return;
    }
    this.voxels[(y << 8) | (lz << 4) | lx] = id;
  }

  getSkyLight(lx, y, lz) {
    if (y >= WORLD_HEIGHT) return 15;
    if (y < 0) return 0;
    return this.skyLight[(y << 8) | (lz << 4) | lx];
  }

  getBlockLight(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blockLight[(y << 8) | (lz << 4) | lx];
  }

  setColumnBiome(lx, lz, biome) {
    const colIdx = (lz << 4) | lx;
    this.biomeGrid[colIdx] = biome.id;
    const c3 = colIdx * 3;
    this.grassTint[c3] = biome.grassTint[0];
    this.grassTint[c3 + 1] = biome.grassTint[1];
    this.grassTint[c3 + 2] = biome.grassTint[2];
    this.foliageTint[c3] = biome.foliageTint[0];
    this.foliageTint[c3 + 1] = biome.foliageTint[1];
    this.foliageTint[c3 + 2] = biome.foliageTint[2];
  }

  getBiomeAt(lx, lz) {
    const id = this.biomeGrid[(lz << 4) | lx] || BIOME_IDS.PLAINS;
    return BIOMES[id] || BIOMES[BIOME_IDS.PLAINS];
  }

  disposeMeshes(scene) {
    for (const key of ['opaqueMesh', 'cutoutMesh', 'translucentMesh']) {
      const m = this[key];
      if (m) {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        this[key] = null;
      }
    }
  }
}
