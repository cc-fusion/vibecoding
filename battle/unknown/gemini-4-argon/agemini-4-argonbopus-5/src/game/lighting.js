import { CHUNK_SIZE, WORLD_HEIGHT } from './constants.js';
import { BLOCK, REGISTRY } from './blocks.js';

const MAX_QUEUE = 131072;
const qX = new Int32Array(MAX_QUEUE);
const qY = new Int32Array(MAX_QUEUE);
const qZ = new Int32Array(MAX_QUEUE);

const DIRS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export function unpackSkyLight(packed) {
  return (packed >> 4) & 0x0f;
}

export function unpackBlockLight(packed) {
  return packed & 0x0f;
}

/**
 * Rebuilds skyLight and blockLight for a single chunk and propagates light across
 * adjacent loaded chunk seams cleanly.
 */
export function computeChunkLighting(chunk, world) {
  const blocks = chunk.blocks;
  const light = chunk.light;
  light.fill(0);
  chunk.lightSources.length = 0;

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;
  const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

  let head = 0;
  let tail = 0;

  // 1. Vertical SkyLight column sweep + collect block light emitters
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      let sky = 15;
      for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const i = idx(lx, y, lz);
        const id = blocks[i];
        const def = REGISTRY[id] || REGISTRY[BLOCK.AIR];

        if (sky > 0) {
          if (def.opaque) {
            sky = 0;
          } else if (def.lightOpacity > 0) {
            sky = Math.max(0, sky - def.lightOpacity);
          }
        }

        const emit = def.light || 0;
        if (emit > 0) {
          chunk.lightSources.push({ wx: baseX + lx, y, wz: baseZ + lz, level: emit });
        }

        light[i] = (sky << 4) | emit;
      }
    }
  }

  // 2. Seed SkyLight horizontal flood-fill inside chunk & 1-block neighbor seams
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wz = baseZ + lz;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
        const i = idx(lx, y, lz);
        const sky = (light[i] >> 4) & 0x0f;
        if (sky <= 1) continue;

        // Only enqueue if adjacent to a darker non-opaque block (huge speedup!)
        const checkLow =
          (lx > 0 && ((light[idx(lx - 1, y, lz)] >> 4) & 0x0f) < sky - 1 && !REGISTRY[blocks[idx(lx - 1, y, lz)]]?.opaque) ||
          (lx < 15 && ((light[idx(lx + 1, y, lz)] >> 4) & 0x0f) < sky - 1 && !REGISTRY[blocks[idx(lx + 1, y, lz)]]?.opaque) ||
          (lz > 0 && ((light[idx(lx, y, lz - 1)] >> 4) & 0x0f) < sky - 1 && !REGISTRY[blocks[idx(lx, y, lz - 1)]]?.opaque) ||
          (lz < 15 && ((light[idx(lx, y, lz + 1)] >> 4) & 0x0f) < sky - 1 && !REGISTRY[blocks[idx(lx, y, lz + 1)]]?.opaque) ||
          lx === 0 || lx === 15 || lz === 0 || lz === 15;

        if (checkLow && tail < MAX_QUEUE) {
          qX[tail] = wx;
          qY[tail] = y;
          qZ[tail] = wz;
          tail++;
        }
      }
    }
  }

  // Also pull sky light from immediate loaded neighbor chunk edges into this chunk
  const pullEdgeSky = (wx, wz) => {
    const nb = world.getChunkAtBlock(wx, wz);
    if (!nb || !nb.lightReady) return;
    const nlx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const nlz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
      const s = (nb.light[(y * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx] >> 4) & 0x0f;
      if (s > 1 && tail < MAX_QUEUE) {
        qX[tail] = wx;
        qY[tail] = y;
        qZ[tail] = wz;
        tail++;
      }
    }
  };

  for (let i = 0; i < CHUNK_SIZE; i++) {
    pullEdgeSky(baseX - 1, baseZ + i);
    pullEdgeSky(baseX + CHUNK_SIZE, baseZ + i);
    pullEdgeSky(baseX + i, baseZ - 1);
    pullEdgeSky(baseX + i, baseZ + CHUNK_SIZE);
  }

  // Propagate SkyLight BFS
  while (head < tail) {
    const x = qX[head];
    const y = qY[head];
    const z = qZ[head];
    head++;

    const curLight = world.getPackedLight(x, y, z);
    const curSky = (curLight >> 4) & 0x0f;
    if (curSky <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (ny < 0 || ny >= WORLD_HEIGHT) continue;

      const nChunk = world.getChunkAtBlock(nx, nz);
      if (!nChunk) continue;

      const nlx = ((nx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const nlz = ((nz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ni = (ny * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx;

      const nDef = REGISTRY[nChunk.blocks[ni]];
      if (!nDef || nDef.opaque) continue;

      const stepCost = Math.max(1, nDef.lightOpacity || 1);
      const nextSky = curSky - stepCost;
      const existingSky = (nChunk.light[ni] >> 4) & 0x0f;

      if (nextSky > existingSky) {
        nChunk.light[ni] = (nextSky << 4) | (nChunk.light[ni] & 0x0f);
        if (nextSky > 1 && tail < MAX_QUEUE) {
          qX[tail] = nx;
          qY[tail] = ny;
          qZ[tail] = nz;
          tail++;
        }
      }
    }
  }

  // 3. Seed & Propagate BlockLight (from this chunk + adjacent chunks' emitters)
  head = 0;
  tail = 0;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nb = world.getChunk(chunk.cx + dx, chunk.cz + dz);
      if (!nb) continue;
      for (let s = 0; s < nb.lightSources.length; s++) {
        const src = nb.lightSources[s];
        // Ensure source chunk still holds the emitter level
        const slx = ((src.wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const slz = ((src.wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const si = (src.y * CHUNK_SIZE + slz) * CHUNK_SIZE + slx;
        if ((nb.light[si] & 0x0f) < src.level) {
          nb.light[si] = (nb.light[si] & 0xf0) | src.level;
        }
        if (tail < MAX_QUEUE) {
          qX[tail] = src.wx;
          qY[tail] = src.y;
          qZ[tail] = src.wz;
          tail++;
        }
      }
    }
  }

  while (head < tail) {
    const x = qX[head];
    const y = qY[head];
    const z = qZ[head];
    head++;

    const curLight = world.getPackedLight(x, y, z);
    const curBlk = curLight & 0x0f;
    if (curBlk <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (ny < 0 || ny >= WORLD_HEIGHT) continue;

      const nChunk = world.getChunkAtBlock(nx, nz);
      if (!nChunk) continue;

      const nlx = ((nx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const nlz = ((nz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ni = (ny * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx;

      const nDef = REGISTRY[nChunk.blocks[ni]];
      if (!nDef || nDef.opaque) continue;

      const stepCost = Math.max(1, nDef.lightOpacity || 1);
      const nextBlk = curBlk - stepCost;
      const existingBlk = nChunk.light[ni] & 0x0f;

      if (nextBlk > existingBlk) {
        nChunk.light[ni] = (nChunk.light[ni] & 0xf0) | nextBlk;
        if (nextBlk > 1 && tail < MAX_QUEUE) {
          qX[tail] = nx;
          qY[tail] = ny;
          qZ[tail] = nz;
          tail++;
        }
      }
    }
  }

  chunk.lightReady = true;
}
