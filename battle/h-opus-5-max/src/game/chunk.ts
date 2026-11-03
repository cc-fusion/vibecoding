import * as THREE from "three";
import { CHUNK_AREA, CHUNK_VOLUME, CHUNK_X, CHUNK_Z, WORLD_HEIGHT, idx } from "./constants";

export const enum ChunkState {
  EMPTY = 0,
  TERRAIN = 1,
  DECORATED = 2,
  READY = 3,
}

export class Chunk {
  blocks = new Uint8Array(CHUNK_VOLUME);
  /** high nibble = skylight, low nibble = blocklight */
  light = new Uint8Array(CHUNK_VOLUME);
  biomes = new Uint8Array(CHUNK_AREA);
  heightmap = new Int16Array(CHUNK_AREA);
  state: ChunkState = ChunkState.EMPTY;
  minY = WORLD_HEIGHT;
  maxY = 0;
  dirty = true;
  lightDirty = true;
  /** player edits, index -> block id (for persistence) */
  edits: Map<number, number> | null = null;
  meshes: (THREE.Mesh | null)[] = [null, null, null];
  group: THREE.Group | null = null;

  constructor(
    public cx: number,
    public cz: number,
  ) {}

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blocks[idx(x, y, z)];
  }
  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[idx(x, y, z)] = id;
    if (id !== 0) {
      if (y < this.minY) this.minY = y;
      if (y > this.maxY) this.maxY = y;
    }
  }
  getLight(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return y >= WORLD_HEIGHT ? 0xf0 : 0;
    return this.light[idx(x, y, z)];
  }
  recomputeBounds() {
    let min = WORLD_HEIGHT,
      max = 0;
    const b = this.blocks;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      let any = false;
      const base = y * CHUNK_X * CHUNK_Z;
      for (let i = 0; i < CHUNK_X * CHUNK_Z; i++) {
        if (b[base + i] !== 0) {
          any = true;
          break;
        }
      }
      if (any) {
        if (y < min) min = y;
        max = y;
      }
    }
    this.minY = min;
    this.maxY = max;
  }
  markEdit(x: number, y: number, z: number, id: number) {
    if (!this.edits) this.edits = new Map();
    this.edits.set(idx(x, y, z), id);
  }
  dispose() {
    for (const m of this.meshes) {
      if (m) {
        m.geometry.dispose();
        m.removeFromParent();
      }
    }
    this.meshes = [null, null, null];
    if (this.group) {
      this.group.removeFromParent();
      this.group = null;
    }
  }
}
