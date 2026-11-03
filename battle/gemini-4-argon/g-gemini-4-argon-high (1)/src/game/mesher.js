// High-Performance L1-Cache Culled Voxel Chunk Mesher with Smooth AO & Smooth Dual Lighting
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, ATLAS_SIZE, CELL_PIXELS, TILE_PAD, ATLAS_COLS } from './constants.js';
import { BLOCK, REGISTRY, getDef } from './items.js';
import { getTileUVs } from './textures.js';

// Precompute fast lookup tables once
const OCCLUDE_LUT = new Uint8Array(256);
const OPAQUE_OR_SAME_LUT = new Uint8Array(256);
for (const key of Object.keys(REGISTRY)) {
  const id = Number(key);
  const def = REGISTRY[id];
  if (def && def.opaque && def.renderType === 'cube') {
    OCCLUDE_LUT[id] = 1;
  }
  if (def && (def.translucent || def.opaque || id === BLOCK.GLASS)) {
    OPAQUE_OR_SAME_LUT[id] = 1;
  }
}

const UV_LUT = new Float32Array(64 * 4);
for (let t = 0; t < 64; t++) {
  const [u0, v0, u1, v1] = getTileUVs(t);
  UV_LUT[t * 4 + 0] = u0;
  UV_LUT[t * 4 + 1] = v0;
  UV_LUT[t * 4 + 2] = u1;
  UV_LUT[t * 4 + 3] = v1;
}

// Padded 18 x 98 x 18 scratch buffers (reused across chunk builds — zero GC churn!)
const PW = CHUNK_SIZE + 2; // 18
const PH = CHUNK_HEIGHT + 2; // 98
const PSTRIDE_Y = PW * PW; // 324
const padBlocks = new Uint8Array(PW * PH * PW);
const padLights = new Uint8Array(PW * PH * PW);

// 6 Cube Face Definitions (all verified CCW outward normals & upright UVs)
const FACES = [
  {
    key: 'top',
    dir: [0, 1, 0],
    pOffset: PSTRIDE_Y,
    shade: 1.0,
    verts: [
      { pos: [0, 1, 1], s1: -1, s2: PW, c: PW - 1, uvIdx: [0, 3] },
      { pos: [1, 1, 1], s1: 1, s2: PW, c: PW + 1, uvIdx: [2, 3] },
      { pos: [1, 1, 0], s1: 1, s2: -PW, c: -PW + 1, uvIdx: [2, 1] },
      { pos: [0, 1, 0], s1: -1, s2: -PW, c: -PW - 1, uvIdx: [0, 1] },
    ],
  },
  {
    key: 'bottom',
    dir: [0, -1, 0],
    pOffset: -PSTRIDE_Y,
    shade: 0.54,
    verts: [
      { pos: [0, 0, 0], s1: -1, s2: -PW, c: -PW - 1, uvIdx: [0, 3] },
      { pos: [1, 0, 0], s1: 1, s2: -PW, c: -PW + 1, uvIdx: [2, 3] },
      { pos: [1, 0, 1], s1: 1, s2: PW, c: PW + 1, uvIdx: [2, 1] },
      { pos: [0, 0, 1], s1: -1, s2: PW, c: PW - 1, uvIdx: [0, 1] },
    ],
  },
  {
    key: 'south', // +Z
    dir: [0, 0, 1],
    pOffset: PW,
    shade: 0.84,
    verts: [
      { pos: [0, 0, 1], s1: -1, s2: -PSTRIDE_Y, c: -PSTRIDE_Y - 1, uvIdx: [0, 3] },
      { pos: [1, 0, 1], s1: 1, s2: -PSTRIDE_Y, c: -PSTRIDE_Y + 1, uvIdx: [2, 3] },
      { pos: [1, 1, 1], s1: 1, s2: PSTRIDE_Y, c: PSTRIDE_Y + 1, uvIdx: [2, 1] },
      { pos: [0, 1, 1], s1: -1, s2: PSTRIDE_Y, c: PSTRIDE_Y - 1, uvIdx: [0, 1] },
    ],
  },
  {
    key: 'north', // -Z
    dir: [0, 0, -1],
    pOffset: -PW,
    shade: 0.80,
    verts: [
      { pos: [1, 0, 0], s1: 1, s2: -PSTRIDE_Y, c: -PSTRIDE_Y + 1, uvIdx: [0, 3] },
      { pos: [0, 0, 0], s1: -1, s2: -PSTRIDE_Y, c: -PSTRIDE_Y - 1, uvIdx: [2, 3] },
      { pos: [0, 1, 0], s1: -1, s2: PSTRIDE_Y, c: PSTRIDE_Y - 1, uvIdx: [2, 1] },
      { pos: [1, 1, 0], s1: 1, s2: PSTRIDE_Y, c: PSTRIDE_Y + 1, uvIdx: [0, 1] },
    ],
  },
  {
    key: 'east', // +X
    dir: [1, 0, 0],
    pOffset: 1,
    shade: 0.72,
    verts: [
      { pos: [1, 0, 1], s1: PW, s2: -PSTRIDE_Y, c: -PSTRIDE_Y + PW, uvIdx: [0, 3] },
      { pos: [1, 0, 0], s1: -PW, s2: -PSTRIDE_Y, c: -PSTRIDE_Y - PW, uvIdx: [2, 3] },
      { pos: [1, 1, 0], s1: -PW, s2: PSTRIDE_Y, c: PSTRIDE_Y - PW, uvIdx: [2, 1] },
      { pos: [1, 1, 1], s1: PW, s2: PSTRIDE_Y, c: PSTRIDE_Y + PW, uvIdx: [0, 1] },
    ],
  },
  {
    key: 'west', // -X
    dir: [-1, 0, 0],
    pOffset: -1,
    shade: 0.68,
    verts: [
      { pos: [0, 0, 0], s1: -PW, s2: -PSTRIDE_Y, c: -PSTRIDE_Y - PW, uvIdx: [0, 3] },
      { pos: [0, 0, 1], s1: PW, s2: -PSTRIDE_Y, c: -PSTRIDE_Y + PW, uvIdx: [2, 3] },
      { pos: [0, 1, 1], s1: PW, s2: PSTRIDE_Y, c: PSTRIDE_Y + PW, uvIdx: [2, 1] },
      { pos: [0, 1, 0], s1: -PW, s2: PSTRIDE_Y, c: PSTRIDE_Y - PW, uvIdx: [0, 1] },
    ],
  },
];

const AO_CURVE = [1.0, 0.81, 0.64, 0.47];

class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.lights = [];
    this.anims = [];
    this.indices = [];
    this.vertCount = 0;
  }

  pushVertex(x, y, z, u, v, aoShade, skyLight, blockLight, anim = 0) {
    this.positions.push(x, y, z);
    this.uvs.push(u, v);
    this.lights.push(aoShade, skyLight, blockLight);
    this.anims.push(anim);
    return this.vertCount++;
  }

  pushQuad(flip = false) {
    const base = this.vertCount - 4;
    if (flip) {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base + 0);
    } else {
      this.indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    }
  }

  toBufferGeometry() {
    if (this.vertCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 3));
    geom.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anims, 1));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

function populatePaddedSlice(world, cx, cz) {
  // Floor py=0 is bedrock, ceiling py=CHUNK_HEIGHT+1 is open sky
  padBlocks.fill(BLOCK.AIR);
  padLights.fill(0xf0);
  for (let i = 0; i < PSTRIDE_Y; i++) {
    padBlocks[i] = BLOCK.BEDROCK;
    padLights[i] = 0;
  }

  // Grab 3x3 chunk references ONLY ONCE (9 Map lookups total!)
  const grid = new Array(9);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      grid[(dz + 1) * 3 + (dx + 1)] = world.getChunk(cx + dx, cz + dz);
    }
  }

  for (let pz = 0; pz < PW; pz++) {
    const gz = pz === 0 ? 0 : pz === PW - 1 ? 2 : 1;
    const slz = pz === 0 ? CHUNK_SIZE - 1 : pz === PW - 1 ? 0 : pz - 1;
    for (let px = 0; px < PW; px++) {
      const gx = px === 0 ? 0 : px === PW - 1 ? 2 : 1;
      const slx = px === 0 ? CHUNK_SIZE - 1 : px === PW - 1 ? 0 : px - 1;
      const src = grid[gz * 3 + gx];
      if (!src) continue;

      const sBlocks = src.blocks;
      const sLights = src.light;
      let colOffset = slz * CHUNK_SIZE + slx;
      let dstOffset = PSTRIDE_Y + pz * PW + px; // py = 1 corresponds to y = 0

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        padBlocks[dstOffset] = sBlocks[colOffset];
        padLights[dstOffset] = sLights[colOffset];
        colOffset += 256; // CHUNK_SIZE * CHUNK_SIZE
        dstOffset += PSTRIDE_Y;
      }
    }
  }
}

export function buildChunkGeometries(world, cx, cz) {
  const chunk = world.getChunk(cx, cz);
  if (!chunk) return null;

  populatePaddedSlice(world, cx, cz);

  const opaque = new GeometryBuilder();
  const cutout = new GeometryBuilder();
  const water = new GeometryBuilder();

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    const pyOffset = (y + 1) * PSTRIDE_Y;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const pzOffset = pyOffset + (lz + 1) * PW;
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const pCenter = pzOffset + (lx + 1);
        const id = padBlocks[pCenter];
        if (id === BLOCK.AIR) continue;

        const def = REGISTRY[id];
        const wx = baseX + lx;

        if (def.renderType === 'cross') {
          emitCrossFlora(cutout, lx, y, lz, wx, wz, def, padLights[pCenter]);
          continue;
        }

        if (def.renderType === 'torch') {
          emitTorch(cutout, lx, y, lz, def, padLights[pCenter]);
          continue;
        }

        const isWaterLike = def.translucent;
        const target = isWaterLike ? water : def.alphaTest ? cutout : opaque;
        const selfBlockLight = def.light / 15.0;
        const aboveId = padBlocks[pCenter + PSTRIDE_Y];
        const isLeaf =
          id === BLOCK.OAK_LEAVES || id === BLOCK.BIRCH_LEAVES || id === BLOCK.SPRUCE_LEAVES;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nCenter = pCenter + face.pOffset;
          const neighborId = padBlocks[nCenter];

          if (OCCLUDE_LUT[neighborId]) continue;
          if (neighborId === id && OPAQUE_OR_SAME_LUT[id]) continue;

          const isWaterSurface = id === BLOCK.WATER && aboveId === BLOCK.AIR;
          const tileBase = def.faces[face.key] * 4;
          let ao0 = 0, ao1 = 0, ao2 = 0, ao3 = 0;

          for (let v = 0; v < 4; v++) {
            const vd = face.verts[v];
            const i1 = nCenter + vd.s1;
            const i2 = nCenter + vd.s2;
            const ic = nCenter + vd.c;

            const b1 = OCCLUDE_LUT[padBlocks[i1]];
            const b2 = OCCLUDE_LUT[padBlocks[i2]];
            const bc = OCCLUDE_LUT[padBlocks[ic]];

            const occ = b1 & b2 ? 3 : b1 + b2 + bc;
            if (v === 0) ao0 = occ;
            else if (v === 1) ao1 = occ;
            else if (v === 2) ao2 = occ;
            else ao3 = occ;

            const aoShade = (selfBlockLight >= 0.9 ? 1.0 : AO_CURVE[occ]) * face.shade;

            const pk0 = padLights[nCenter];
            let skySum = (pk0 >> 4) & 15;
            let blkSum = pk0 & 15;
            let count = 1;

            if (!b1) {
              const pk = padLights[i1];
              skySum += (pk >> 4) & 15;
              blkSum += pk & 15;
              count++;
            }
            if (!b2) {
              const pk = padLights[i2];
              skySum += (pk >> 4) & 15;
              blkSum += pk & 15;
              count++;
            }
            if (!b1 && !b2 && !bc) {
              const pk = padLights[ic];
              skySum += (pk >> 4) & 15;
              blkSum += pk & 15;
              count++;
            }

            const denom = 1.0 / (count * 15.0);
            const skyExp = skySum * denom;
            const blkAvg = blkSum * denom;
            const blkExp = selfBlockLight > blkAvg ? selfBlockLight : blkAvg;

            let anim = 0;
            if (vd.pos[1] === 1) {
              if (isWaterSurface) anim = 2.0;
              else if (isLeaf) anim = 1.0;
            }

            target.pushVertex(
              lx + vd.pos[0],
              y + vd.pos[1],
              lz + vd.pos[2],
              UV_LUT[tileBase + vd.uvIdx[0]],
              UV_LUT[tileBase + vd.uvIdx[1]],
              aoShade,
              skyExp,
              blkExp,
              anim
            );
          }

          target.pushQuad(ao0 + ao2 > ao1 + ao3);
        }
      }
    }
  }

  return {
    opaque: opaque.toBufferGeometry(),
    cutout: cutout.toBufferGeometry(),
    water: water.toBufferGeometry(),
  };
}

function emitCrossFlora(builder, lx, y, lz, wx, wz, def, pk) {
  const tBase = def.faces.top * 4;
  const u0 = UV_LUT[tBase], v0 = UV_LUT[tBase + 1], u1 = UV_LUT[tBase + 2], v1 = UV_LUT[tBase + 3];
  const sky = ((pk >> 4) & 15) / 15.0;
  const blk = Math.max(def.light / 15.0, (pk & 15) / 15.0);

  const jx = ((((wx * 73856093) ^ (wz * 19349663)) & 15) / 15.0 - 0.5) * 0.22;
  const jz = ((((wx * 83492791) ^ (wz * 2971215073)) & 15) / 15.0 - 0.5) * 0.22;

  const x0 = lx + 0.12 + jx;
  const x1 = lx + 0.88 + jx;
  const z0 = lz + 0.12 + jz;
  const z1 = lz + 0.88 + jz;

  builder.pushVertex(x0, y, z0, u0, v1, 0.92, sky, blk, 0);
  builder.pushVertex(x1, y, z1, u1, v1, 0.92, sky, blk, 0);
  builder.pushVertex(x1, y + 0.92, z1, u1, v0, 0.98, sky, blk, 1.0);
  builder.pushVertex(x0, y + 0.92, z0, u0, v0, 0.98, sky, blk, 1.0);
  builder.pushQuad(false);

  builder.pushVertex(x0, y, z1, u0, v1, 0.92, sky, blk, 0);
  builder.pushVertex(x1, y, z0, u1, v1, 0.92, sky, blk, 0);
  builder.pushVertex(x1, y + 0.92, z0, u1, v0, 0.98, sky, blk, 1.0);
  builder.pushVertex(x0, y + 0.92, z1, u0, v0, 0.98, sky, blk, 1.0);
  builder.pushQuad(false);
}

function emitTorch(builder, lx, y, lz, def, pk) {
  const sky = ((pk >> 4) & 15) / 15.0;
  const blk = 1.0;

  const tileId = def.faces.top;
  const col = tileId % ATLAS_COLS;
  const row = (tileId / ATLAS_COLS) | 0;
  const px0 = col * CELL_PIXELS + TILE_PAD;
  const py0 = row * CELL_PIXELS + TILE_PAD;

  const su0 = (px0 + 7) / ATLAS_SIZE;
  const su1 = (px0 + 9) / ATLAS_SIZE;
  const sv0 = (py0 + 2) / ATLAS_SIZE;
  const sv1 = (py0 + 16) / ATLAS_SIZE;

  const tu0 = (px0 + 7) / ATLAS_SIZE;
  const tu1 = (px0 + 9) / ATLAS_SIZE;
  const tv0 = (py0 + 2) / ATLAS_SIZE;
  const tv1 = (py0 + 4) / ATLAS_SIZE;

  const x0 = lx + 7 / 16;
  const x1 = lx + 9 / 16;
  const z0 = lz + 7 / 16;
  const z1 = lz + 9 / 16;
  const y0 = y;
  const y1 = y + 11 / 16;

  const sides = [
    [x0, z1, x1, z1],
    [x1, z0, x0, z0],
    [x1, z1, x1, z0],
    [x0, z0, x0, z1],
  ];
  for (let s = 0; s < 4; s++) {
    const [ax, az, bx, bz] = sides[s];
    builder.pushVertex(ax, y0, az, su0, sv1, 1.0, sky, blk, 0);
    builder.pushVertex(bx, y0, bz, su1, sv1, 1.0, sky, blk, 0);
    builder.pushVertex(bx, y1, bz, su1, sv0, 1.0, sky, blk, 0);
    builder.pushVertex(ax, y1, az, su0, sv0, 1.0, sky, blk, 0);
    builder.pushQuad(false);
  }
  builder.pushVertex(x0, y1, z1, tu0, tv1, 1.0, sky, blk, 0);
  builder.pushVertex(x1, y1, z1, tu1, tv1, 1.0, sky, blk, 0);
  builder.pushVertex(x1, y1, z0, tu1, tv0, 1.0, sky, blk, 0);
  builder.pushVertex(x0, y1, z0, tu0, tv0, 1.0, sky, blk, 0);
  builder.pushQuad(false);
}
