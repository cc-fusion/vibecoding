/** Sparse, game-agnostic 16³ voxel storage. 0 is empty; 1–255 are palette IDs. */
export const CHUNK_SIZE = 16;
export const VOLUME = CHUNK_SIZE ** 3;
export const chunkKey = (x, y, z) => `${x},${y},${z}`;
export const index = (x, y, z) => x + CHUNK_SIZE * (y + CHUNK_SIZE * z);
const local = (n) => ((n % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
export class VoxelWorld {
  constructor() {
    this.chunks = new Map();
    this.dirty = new Set();
    this.voxelCount = 0;
  }
  get(x, y, z) {
    const c = this.chunks.get(
      chunkKey(Math.floor(x / 16), Math.floor(y / 16), Math.floor(z / 16)),
    );
    return c ? c.data[index(local(x), local(y), local(z))] : 0;
  }
  set(x, y, z, id) {
    if (
      ![x, y, z, id].every(Number.isSafeInteger) ||
      id < 0 ||
      id > 255 ||
      Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 1000000
    )
      throw new RangeError(
        "Expected integer coordinates within ±1,000,000 and an ID from 0 to 255.",
      );
    const cx = Math.floor(x / 16),
      cy = Math.floor(y / 16),
      cz = Math.floor(z / 16);
    const key = chunkKey(cx, cy, cz);
    let c = this.chunks.get(key);
    if (!c && !id) return;
    if (!c) {
      c = {
        key,
        x: cx,
        y: cy,
        z: cz,
        data: new Uint8Array(VOLUME),
        version: 0,
      };
      this.chunks.set(key, c);
    }
    const lx = local(x),
      ly = local(y),
      lz = local(z),
      i = index(lx, ly, lz),
      old = c.data[i];
    if (old === id) return;
    this.voxelCount += Number(id !== 0) - Number(old !== 0);
    c.data[i] = id;
    // AO reads diagonal neighbours too, not just the six face neighbours.
    const xs = [0],
      ys = [0],
      zs = [0];
    if (lx === 0) xs.push(-1);
    if (lx === 15) xs.push(1);
    if (ly === 0) ys.push(-1);
    if (ly === 15) ys.push(1);
    if (lz === 0) zs.push(-1);
    if (lz === 15) zs.push(1);
    for (const a of xs)
      for (const b of ys)
        for (const d of zs) {
          const k = chunkKey(cx + a, cy + b, cz + d),
            neighbour = this.chunks.get(k);
          if (neighbour) {
            neighbour.version++;
            this.dirty.add(k);
          }
        }
  }
  /** Include a one-voxel halo for seamless face culling and corner AO. */
  snapshot(c) {
    const data = new Uint8Array(18 ** 3);
    for (let z = -1; z <= 16; z++)
      for (let y = -1; y <= 16; y++)
        for (let x = -1; x <= 16; x++)
          data[x + 1 + 18 * (y + 1 + 18 * (z + 1))] = this.get(
            c.x * 16 + x,
            c.y * 16 + y,
            c.z * 16 + z,
          );
    return data;
  }
  invalidate() {
    for (const c of this.chunks.values()) {
      c.version++;
      this.dirty.add(c.key);
    }
  }
  toJSON() {
    return {
      format: "voxel-core",
      version: 1,
      chunks: [...this.chunks.values()].map((c) => ({
        position: [c.x, c.y, c.z],
        data: Array.from(c.data),
      })),
    };
  }
  /** Validate before replacing an existing scene. Import is bounded to 512 chunks. */
  static fromJSON(json) {
    if (
      json?.format !== "voxel-core" ||
      json.version !== 1 ||
      !Array.isArray(json.chunks) ||
      json.chunks.length > 512
    )
      throw new Error(
        "Not a supported Voxel Core scene (v1, maximum 512 chunks).",
      );
    const world = new VoxelWorld();
    for (const c of json.chunks) {
      if (
        !Array.isArray(c.position) ||
        c.position.length !== 3 ||
        !c.position.every((v) => Number.isInteger(v) && Math.abs(v) <= 62500) ||
        !Array.isArray(c.data) ||
        c.data.length !== VOLUME ||
        !c.data.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
      )
        throw new Error("Invalid chunk data.");
      const [x, y, z] = c.position,
        key = chunkKey(x, y, z);
      if (world.chunks.has(key))
        throw new Error("Duplicate chunk coordinates.");
      world.chunks.set(key, {
        key,
        x,
        y,
        z,
        data: Uint8Array.from(c.data),
        version: 1,
      });
      world.dirty.add(key);
      world.voxelCount += c.data.reduce((sum, v) => sum + Number(v !== 0), 0);
    }
    return world;
  }
}
