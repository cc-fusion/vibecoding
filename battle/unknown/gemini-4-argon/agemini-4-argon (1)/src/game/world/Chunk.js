import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants.js';

export const CHUNK_VOLUME = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE; // 32768

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);

    this.blocks = new Uint8Array(CHUNK_VOLUME);
    this.meta = new Uint8Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME); // high 4 bits = sky, low 4 bits = block

    this.deltas = new Map(); // index -> (meta << 8) | blockId
    this.dirtyMesh = true;
    this.dirtyLight = true;
    this.generated = false;

    this.meshes = {
      opaque: null,
      cutout: null,
      translucent: null,
    };
  }

  index(lx, y, lz) {
    return (y << 8) | (lz << 4) | lx;
  }

  inBounds(lx, y, lz) {
    return lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT && lz >= 0 && lz < CHUNK_SIZE;
  }

  getBlock(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blocks[(y << 8) | (lz << 4) | lx];
  }

  setBlockGenerated(lx, y, lz, id, meta = 0) {
    if (!this.inBounds(lx, y, lz)) return;
    const idx = (y << 8) | (lz << 4) | lx;
    this.blocks[idx] = id;
    this.meta[idx] = meta;
  }

  setBlockModified(lx, y, lz, id, meta = 0) {
    if (!this.inBounds(lx, y, lz)) return;
    const idx = (y << 8) | (lz << 4) | lx;
    this.blocks[idx] = id;
    this.meta[idx] = meta;
    this.deltas.set(idx, ((meta & 0xff) << 8) | (id & 0xff));
    this.dirtyMesh = true;
    this.dirtyLight = true;
  }

  getMeta(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.meta[(y << 8) | (lz << 4) | lx];
  }

  getSkyLight(lx, y, lz) {
    if (y >= WORLD_HEIGHT) return 15;
    if (y < 0) return 0;
    return (this.light[(y << 8) | (lz << 4) | lx] >> 4) & 0x0f;
  }

  setSkyLight(lx, y, lz, val) {
    const idx = (y << 8) | (lz << 4) | lx;
    this.light[idx] = ((val & 0x0f) << 4) | (this.light[idx] & 0x0f);
  }

  getBlockLight(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.light[(y << 8) | (lz << 4) | lx] & 0x0f;
  }

  setBlockLight(lx, y, lz, val) {
    const idx = (y << 8) | (lz << 4) | lx;
    this.light[idx] = (this.light[idx] & 0xf0) | (val & 0x0f);
  }

  applyDeltas(serializedDeltas) {
    if (!serializedDeltas) return;
    // serializedDeltas is a flat Int32Array or Array [idx0, packed0, idx1, packed1, ...]
    for (let i = 0; i < serializedDeltas.length; i += 2) {
      const idx = serializedDeltas[i];
      const packed = serializedDeltas[i + 1];
      const id = packed & 0xff;
      const meta = (packed >> 8) & 0xff;
      if (idx >= 0 && idx < CHUNK_VOLUME) {
        this.blocks[idx] = id;
        this.meta[idx] = meta;
        this.deltas.set(idx, packed);
      }
    }
    this.dirtyLight = true;
    this.dirtyMesh = true;
  }

  serializeDeltas() {
    if (this.deltas.size === 0) return null;
    const out = new Array(this.deltas.size * 2);
    let ptr = 0;
    for (const [idx, packed] of this.deltas.entries()) {
      out[ptr++] = idx;
      out[ptr++] = packed;
    }
    return out;
  }

  disposeMeshes(scene) {
    for (const key of ['opaque', 'cutout', 'translucent']) {
      const mesh = this.meshes[key];
      if (mesh) {
        if (scene) scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        this.meshes[key] = null;
      }
    }
  }
}
