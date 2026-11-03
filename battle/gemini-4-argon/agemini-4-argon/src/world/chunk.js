import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_VOLUME, voxelIndex } from './constants.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.voxels = new Uint8Array(CHUNK_VOLUME);
    // Upper 4 bits = skylight (0..15), lower 4 bits = blocklight (0..15)
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.generated = false;
    this.lit = false;
    this.dirty = true;

    this.solidMesh = null;
    this.fluidMesh = null;
  }

  get(lx, y, lz) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.voxels[voxelIndex(lx, y, lz)];
  }

  set(lx, y, lz, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    this.voxels[voxelIndex(lx, y, lz)] = id;
    this.dirty = true;
  }

  getSkyLight(lx, y, lz) {
    if (y >= CHUNK_HEIGHT) return 15;
    if (y < 0) return 0;
    return this.light[voxelIndex(lx, y, lz)] >> 4;
  }

  setSkyLight(lx, y, lz, val) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const idx = voxelIndex(lx, y, lz);
    this.light[idx] = ((val & 15) << 4) | (this.light[idx] & 15);
  }

  getBlockLight(lx, y, lz) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.light[voxelIndex(lx, y, lz)] & 15;
  }

  setBlockLight(lx, y, lz, val) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const idx = voxelIndex(lx, y, lz);
    this.light[idx] = (this.light[idx] & 0xf0) | (val & 15);
  }

  disposeMeshes(scene) {
    if (this.solidMesh) {
      scene.remove(this.solidMesh);
      this.solidMesh.geometry.dispose();
      this.solidMesh = null;
    }
    if (this.fluidMesh) {
      scene.remove(this.fluidMesh);
      this.fluidMesh.geometry.dispose();
      this.fluidMesh = null;
    }
  }
}
