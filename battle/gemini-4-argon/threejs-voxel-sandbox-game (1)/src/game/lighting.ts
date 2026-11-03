import { BLOCKS } from './blocks';
import {
  CHUNK_AREA,
  CHUNK_SIZE,
  CHUNK_VOLUME,
  MAX_LIGHT,
  WORLD_HEIGHT,
  voxelIndex,
} from './constants';
import { BlockId } from './types';
import { ChunkData } from './worldGen';

export type ChunkLookup = (cx: number, cz: number) => ChunkData | undefined;

const queueX = new Int16Array(CHUNK_VOLUME * 2);
const queueY = new Int16Array(CHUNK_VOLUME * 2);
const queueZ = new Int16Array(CHUNK_VOLUME * 2);
const queueL = new Uint8Array(CHUNK_VOLUME * 2);

const DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function lightOpacity(id: BlockId): number {
  if (id === BlockId.Air) return 0;
  const def = BLOCKS[id];
  if (!def || def.opaque) return 15;
  if (id === BlockId.Water || id === BlockId.Ice) return 2;
  if (
    id === BlockId.OakLeaves ||
    id === BlockId.BirchLeaves ||
    id === BlockId.SpruceLeaves
  ) {
    return 2;
  }
  return 0;
}

export function computeChunkLighting(
  chunk: ChunkData,
  getChunk: ChunkLookup,
  litFurnaces?: Set<string>
): void {
  const blocks = chunk.blocks;
  const light = chunk.light;

  const nNorth = getChunk(chunk.cx, chunk.cz - 1);
  const nSouth = getChunk(chunk.cx, chunk.cz + 1);
  const nWest = getChunk(chunk.cx - 1, chunk.cz);
  const nEast = getChunk(chunk.cx + 1, chunk.cz);

  const highestY = Math.min(
    WORLD_HEIGHT - 1,
    Math.max(
      chunk.maxY,
      nNorth?.maxY ?? 0,
      nSouth?.maxY ?? 0,
      nWest?.maxY ?? 0,
      nEast?.maxY ?? 0
    ) + 1
  );

  // Instant bulk fill: zero up to highestY, pure open sky (15 << 4 = 0xf0) above highestY!
  const skyStartOffset = (highestY + 1) * CHUNK_AREA;
  light.fill(0, 0, skyStartOffset);
  if (skyStartOffset < CHUNK_VOLUME) {
    light.fill(0xf0, skyStartOffset);
  }

  let head = 0;
  let tail = 0;

  // 1. Vertical Skylight Column Pass (only from highestY downward!)
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      let currentSky = MAX_LIGHT;
      for (let y = highestY; y >= 0; y--) {
        const idx = voxelIndex(lx, y, lz);
        const opacity = lightOpacity(blocks[idx] as BlockId);
        if (opacity >= 15) {
          currentSky = 0;
        } else if (opacity > 0) {
          currentSky = Math.max(0, currentSky - opacity);
        }
        light[idx] = currentSky << 4;
      }
    }
  }

  // Only seed BFS from sunlit cells that actually border a darker cell (cave mouths & canopy edges)!
  for (let y = 0; y <= highestY; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = voxelIndex(lx, y, lz);
        const sl = (light[idx] >> 4) & 15;
        if (sl <= 1) continue;

        const westSky =
          lx > 0
            ? (light[idx - 1] >> 4) & 15
            : nWest
            ? nWest.getSkyLight(CHUNK_SIZE - 1, y, lz)
            : sl;
        const eastSky =
          lx < CHUNK_SIZE - 1
            ? (light[idx + 1] >> 4) & 15
            : nEast
            ? nEast.getSkyLight(0, y, lz)
            : sl;
        const northSky =
          lz > 0
            ? (light[idx - CHUNK_SIZE] >> 4) & 15
            : nNorth
            ? nNorth.getSkyLight(lx, y, CHUNK_SIZE - 1)
            : sl;
        const southSky =
          lz < CHUNK_SIZE - 1
            ? (light[idx + CHUNK_SIZE] >> 4) & 15
            : nSouth
            ? nSouth.getSkyLight(lx, y, 0)
            : sl;

        if (
          westSky < sl - 1 ||
          eastSky < sl - 1 ||
          northSky < sl - 1 ||
          southSky < sl - 1
        ) {
          queueX[tail] = lx;
          queueY[tail] = y;
          queueZ[tail] = lz;
          queueL[tail] = sl;
          tail++;
        }
      }
    }
  }

  // Pull neighbor border sky light into queue where brighter than our border
  for (let y = 0; y <= highestY; y++) {
    for (let i = 0; i < CHUNK_SIZE && tail < queueX.length - 16; i++) {
      if (nWest) {
        const sl = nWest.getSkyLight(CHUNK_SIZE - 1, y, i);
        if (sl > chunk.getSkyLight(0, y, i) + 1) {
          queueX[tail] = -1;
          queueY[tail] = y;
          queueZ[tail] = i;
          queueL[tail] = sl;
          tail++;
        }
      }
      if (nEast) {
        const sl = nEast.getSkyLight(0, y, i);
        if (sl > chunk.getSkyLight(CHUNK_SIZE - 1, y, i) + 1) {
          queueX[tail] = CHUNK_SIZE;
          queueY[tail] = y;
          queueZ[tail] = i;
          queueL[tail] = sl;
          tail++;
        }
      }
      if (nNorth) {
        const sl = nNorth.getSkyLight(i, y, CHUNK_SIZE - 1);
        if (sl > chunk.getSkyLight(i, y, 0) + 1) {
          queueX[tail] = i;
          queueY[tail] = y;
          queueZ[tail] = -1;
          queueL[tail] = sl;
          tail++;
        }
      }
      if (nSouth) {
        const sl = nSouth.getSkyLight(i, y, 0);
        if (sl > chunk.getSkyLight(i, y, CHUNK_SIZE - 1) + 1) {
          queueX[tail] = i;
          queueY[tail] = y;
          queueZ[tail] = CHUNK_SIZE;
          queueL[tail] = sl;
          tail++;
        }
      }
    }
  }

  // Propagate Skylight horizontally & into overhangs
  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    const z = queueZ[head];
    const lvl = queueL[head];
    head++;

    if (lvl <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny > highestY || nz < 0 || nz >= CHUNK_SIZE) {
        continue;
      }
      const nIdx = voxelIndex(nx, ny, nz);
      const op = lightOpacity(blocks[nIdx] as BlockId);
      if (op >= 15) continue;
      const nextLvl = lvl - 1 - op;
      const existingSky = (light[nIdx] >> 4) & 15;
      if (nextLvl > existingSky) {
        light[nIdx] = (nextLvl << 4) | (light[nIdx] & 15);
        if (nextLvl > 1 && tail < queueX.length - 1) {
          queueX[tail] = nx;
          queueY[tail] = ny;
          queueZ[tail] = nz;
          queueL[tail] = nextLvl;
          tail++;
        }
      }
    }
  }

  // 2. Block Light BFS Pass (Torches, Glowstone, Active Furnaces + cross-chunk emitters!)
  head = 0;
  tail = 0;
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y <= highestY; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = voxelIndex(lx, y, lz);
        const b = blocks[idx] as BlockId;
        let emit = BLOCKS[b]?.lightEmission ?? 0;
        if (b === BlockId.Furnace && litFurnaces?.has(`${baseX + lx},${y},${baseZ + lz}`)) {
          emit = 13;
        }
        if (emit > 0) {
          light[idx] = (light[idx] & 0xf0) | emit;
          if (tail < queueX.length - 1) {
            queueX[tail] = lx;
            queueY[tail] = y;
            queueZ[tail] = lz;
            queueL[tail] = emit;
            tail++;
          }
        }
      }
    }
  }

  // Pull neighbor border block-light values across all 4 edges
  for (let y = 0; y <= highestY; y++) {
    for (let i = 0; i < CHUNK_SIZE && tail < queueX.length - 16; i++) {
      if (nWest) {
        const bl = nWest.getBlockLight(CHUNK_SIZE - 1, y, i);
        if (bl > 1) {
          queueX[tail] = -1;
          queueY[tail] = y;
          queueZ[tail] = i;
          queueL[tail] = bl;
          tail++;
        }
      }
      if (nEast) {
        const bl = nEast.getBlockLight(0, y, i);
        if (bl > 1) {
          queueX[tail] = CHUNK_SIZE;
          queueY[tail] = y;
          queueZ[tail] = i;
          queueL[tail] = bl;
          tail++;
        }
      }
      if (nNorth) {
        const bl = nNorth.getBlockLight(i, y, CHUNK_SIZE - 1);
        if (bl > 1) {
          queueX[tail] = i;
          queueY[tail] = y;
          queueZ[tail] = -1;
          queueL[tail] = bl;
          tail++;
        }
      }
      if (nSouth) {
        const bl = nSouth.getBlockLight(i, y, 0);
        if (bl > 1) {
          queueX[tail] = i;
          queueY[tail] = y;
          queueZ[tail] = i;
          queueL[tail] = bl;
          tail++;
        }
      }
    }
  }

  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    const z = queueZ[head];
    const lvl = queueL[head];
    head++;

    if (lvl <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny <= -1 || ny >= WORLD_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        continue;
      }
      const nIdx = voxelIndex(nx, ny, nz);
      const op = lightOpacity(blocks[nIdx] as BlockId);
      if (op >= 15) continue;
      const nextLvl = lvl - 1 - Math.min(2, op);
      const existingBlock = light[nIdx] & 15;
      if (nextLvl > existingBlock) {
        light[nIdx] = (light[nIdx] & 0xf0) | nextLvl;
        if (nextLvl > 1 && tail < queueX.length - 1) {
          queueX[tail] = nx;
          queueY[tail] = ny;
          queueZ[tail] = nz;
          queueL[tail] = nextLvl;
          tail++;
        }
      }
    }
  }

  chunk.lightDirty = false;
}
