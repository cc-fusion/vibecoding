import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants.js';
import { BLOCK_IDS, getItemDef } from '../data/blocks.js';

const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// Preallocated BFS queue (triplets wx, y, wz)
const MAX_QUEUE = 65536 * 3;
const QUEUE = new Int32Array(MAX_QUEUE);

function getOpacity(blockId) {
  if (blockId === BLOCK_IDS.AIR) return 0;
  const def = getItemDef(blockId);
  if (def.opaque) return 15;
  if (blockId === BLOCK_IDS.WATER || blockId === BLOCK_IDS.ICE) return 2;
  if (
    blockId === BLOCK_IDS.OAK_LEAVES ||
    blockId === BLOCK_IDS.BIRCH_LEAVES ||
    blockId === BLOCK_IDS.SPRUCE_LEAVES
  ) {
    return 2;
  }
  return 1; // Horizontal step decay is at least 1
}

export function computeChunkLighting(world, chunk) {
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  // Clear chunk's light buffer
  chunk.light.fill(0);

  let qHead = 0;
  let qTail = 0;

  const pushQueue = (lx, y, lz) => {
    if (qTail + 3 >= MAX_QUEUE) return;
    QUEUE[qTail++] = lx;
    QUEUE[qTail++] = y;
    QUEUE[qTail++] = lz;
  };

  // 1. Vertical Skylight Pass + Seed Emissive Blocks
  const blockEmissiveSeeds = [];

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      let sky = 15;
      for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const id = chunk.getBlock(lx, y, lz);
        if (id !== BLOCK_IDS.AIR) {
          const def = getItemDef(id);
          if (def.lightLevel > 0) {
            chunk.setBlockLight(lx, y, lz, def.lightLevel);
            blockEmissiveSeeds.push(lx, y, lz);
          }
          if (def.opaque) {
            sky = 0;
          } else {
            const atten =
              id === BLOCK_IDS.WATER ||
              id === BLOCK_IDS.ICE ||
              id === BLOCK_IDS.OAK_LEAVES ||
              id === BLOCK_IDS.BIRCH_LEAVES ||
              id === BLOCK_IDS.SPRUCE_LEAVES
                ? 2
                : 0;
            sky = Math.max(0, sky - atten);
          }
        }
        if (sky > 0) {
          chunk.setSkyLight(lx, y, lz, sky);
        }
      }
    }
  }

  // Seed Skylight BFS where a lit column borders a shaded non-opaque voxel or neighbor chunk edge
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
        const s = chunk.getSkyLight(lx, y, lz);
        if (s <= 1) continue;
        // Only enqueue if adjacent to a darker air/transparent space
        if (
          (lx > 0 && chunk.getSkyLight(lx - 1, y, lz) + 1 < s && getOpacity(chunk.getBlock(lx - 1, y, lz)) < 15) ||
          (lx < 15 && chunk.getSkyLight(lx + 1, y, lz) + 1 < s && getOpacity(chunk.getBlock(lx + 1, y, lz)) < 15) ||
          (lz > 0 && chunk.getSkyLight(lx, y, lz - 1) + 1 < s && getOpacity(chunk.getBlock(lx, y, lz - 1)) < 15) ||
          (lz < 15 && chunk.getSkyLight(lx, y, lz + 1) + 1 < s && getOpacity(chunk.getBlock(lx, y, lz + 1)) < 15) ||
          (chunk.getSkyLight(lx, y - 1, lz) + 1 < s && getOpacity(chunk.getBlock(lx, y - 1, lz)) < 15)
        ) {
          pushQueue(lx, y, lz);
        }
      }
    }
  }

  // Pull border skylight & blocklight from already-loaded neighbor chunks so torches/caves cross chunk seams smoothly!
  const borderChecks = [
    [-1, 0, 15, 0, 'x'],
    [16, 0, 0, 0, 'x'],
    [0, -1, 0, 15, 'z'],
    [0, 16, 0, 0, 'z'],
  ];

  for (const [edgeLx, edgeLz, targetLx, targetLz, axis] of borderChecks) {
    const nChunk =
      axis === 'x'
        ? world.getChunk(chunk.cx + (edgeLx < 0 ? -1 : 1), chunk.cz)
        : world.getChunk(chunk.cx, chunk.cz + (edgeLz < 0 ? -1 : 1));
    if (!nChunk || !nChunk.generated) continue;

    for (let i = 0; i < CHUNK_SIZE; i++) {
      const nlx = axis === 'x' ? targetLx : i;
      const nlz = axis === 'z' ? targetLz : i;
      const clx = axis === 'x' ? (edgeLx < 0 ? 0 : 15) : i;
      const clz = axis === 'z' ? (edgeLz < 0 ? 0 : 15) : i;

      for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
        const cBlock = chunk.getBlock(clx, y, clz);
        const op = Math.max(1, getOpacity(cBlock));
        if (op >= 15) continue;

        const nSky = nChunk.getSkyLight(nlx, y, nlz);
        if (nSky - op > chunk.getSkyLight(clx, y, clz)) {
          chunk.setSkyLight(clx, y, clz, nSky - op);
          pushQueue(clx, y, clz);
        }

        const nBlk = nChunk.getBlockLight(nlx, y, nlz);
        if (nBlk - op > chunk.getBlockLight(clx, y, clz)) {
          chunk.setBlockLight(clx, y, clz, nBlk - op);
          blockEmissiveSeeds.push(clx, y, clz);
        }
      }
    }
  }

  // Flood-fill Skylight within chunk
  while (qHead < qTail) {
    const lx = QUEUE[qHead++];
    const y = QUEUE[qHead++];
    const lz = QUEUE[qHead++];
    const current = chunk.getSkyLight(lx, y, lz);
    if (current <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nlx = lx + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nlz = lz + DIRS[d][2];
      if (nlx < 0 || nlx >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT || nlz < 0 || nlz >= CHUNK_SIZE) {
        continue;
      }
      const nBlock = chunk.getBlock(nlx, ny, nlz);
      const stepCost = Math.max(1, getOpacity(nBlock));
      if (stepCost >= 15) continue;
      const nextVal = current - stepCost;
      if (nextVal > chunk.getSkyLight(nlx, ny, nlz)) {
        chunk.setSkyLight(nlx, ny, nlz, nextVal);
        if (nextVal > 1) pushQueue(nlx, ny, nlz);
      }
    }
  }

  // 2. Flood-fill Blocklight within chunk
  qHead = 0;
  qTail = 0;
  for (let i = 0; i < blockEmissiveSeeds.length; i += 3) {
    pushQueue(blockEmissiveSeeds[i], blockEmissiveSeeds[i + 1], blockEmissiveSeeds[i + 2]);
  }

  while (qHead < qTail) {
    const lx = QUEUE[qHead++];
    const y = QUEUE[qHead++];
    const lz = QUEUE[qHead++];
    const current = chunk.getBlockLight(lx, y, lz);
    if (current <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nlx = lx + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nlz = lz + DIRS[d][2];
      if (nlx < 0 || nlx >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT || nlz < 0 || nlz >= CHUNK_SIZE) {
        continue;
      }
      const nBlock = chunk.getBlock(nlx, ny, nlz);
      const def = getItemDef(nBlock);
      if (def.opaque) continue;
      const stepCost = nBlock === BLOCK_IDS.WATER ? 2 : 1;
      const nextVal = current - stepCost;
      if (nextVal > chunk.getBlockLight(nlx, ny, nlz)) {
        chunk.setBlockLight(nlx, ny, nlz, nextVal);
        if (nextVal > 1) pushQueue(nlx, ny, nlz);
      }
    }
  }

  // Track unused baseX/baseZ suppressed
  void baseX;
  void baseZ;
  chunk.dirtyLight = false;
}
