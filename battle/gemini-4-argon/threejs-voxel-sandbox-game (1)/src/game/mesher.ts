import * as THREE from 'three';
import { BLOCKS } from './blocks';
import { CHUNK_SIZE, MAX_LIGHT, WORLD_HEIGHT } from './constants';
import { ChunkLookup } from './lighting';
import { getTileUVRect } from './textures';
import { BlockId } from './types';
import { ChunkData } from './worldGen';

class GeometryBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  shades: number[] = [];
  lights: number[] = [];
  sways: number[] = [];
  indices: number[] = [];
  vertexCount = 0;

  pushQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
    uv3: [number, number],
    s0: number,
    s1: number,
    s2: number,
    s3: number,
    l0: [number, number],
    l1: [number, number],
    l2: [number, number],
    l3: [number, number],
    sw0: number,
    sw1: number,
    sw2: number,
    sw3: number,
    flipDiagonal = false
  ) {
    const base = this.vertexCount;
    this.positions.push(
      p0[0], p0[1], p0[2],
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2]
    );
    this.uvs.push(
      uv0[0], uv0[1],
      uv1[0], uv1[1],
      uv2[0], uv2[1],
      uv3[0], uv3[1]
    );
    this.shades.push(s0, s1, s2, s3);
    this.lights.push(
      l0[0], l0[1],
      l1[0], l1[1],
      l2[0], l2[1],
      l3[0], l3[1]
    );
    this.sways.push(sw0, sw1, sw2, sw3);

    if (flipDiagonal) {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base + 0);
    } else {
      this.indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    }
    this.vertexCount += 4;
  }

  toBufferGeometry(): THREE.BufferGeometry | null {
    if (this.vertexCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shades, 1));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 2));
    geom.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sways, 1));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

export interface ChunkMeshResult {
  opaque: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
  translucent: THREE.BufferGeometry | null;
}

interface FaceSpec {
  // Faces index order in BlockDefinition.faces: [top, bottom, north(-Z), south(+Z), east(+X), west(-X)]
  faceSlot: number;
  dir: [number, number, number];
  baseShade: number;
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  // Two tangent axes along the face plane to compute smooth 4-neighbor AO cleanly!
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  cornerSigns: [[number, number], [number, number], [number, number], [number, number]];
}

const FACE_SPECS: FaceSpec[] = [
  // 0: Top (+Y)
  {
    faceSlot: 0,
    dir: [0, 1, 0],
    baseShade: 1.0,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, -1],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  // 1: Bottom (-Y)
  {
    faceSlot: 1,
    dir: [0, -1, 0],
    baseShade: 0.54,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  // 2: North (-Z)
  {
    faceSlot: 2,
    dir: [0, 0, -1],
    baseShade: 0.84,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uAxis: [-1, 0, 0],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  // 3: South (+Z)
  {
    faceSlot: 3,
    dir: [0, 0, 1],
    baseShade: 0.84,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  // 4: East (+X)
  {
    faceSlot: 4,
    dir: [1, 0, 0],
    baseShade: 0.72,
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uAxis: [0, 0, -1],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  // 5: West (-X)
  {
    faceSlot: 5,
    dir: [-1, 0, 0],
    baseShade: 0.72,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
];

const AO_CURVE = [0.46, 0.65, 0.83, 1.0];

function vertexAO(side1: number, side2: number, corner: number): number {
  if (side1 === 1 && side2 === 1) return 0;
  return 3 - (side1 + side2 + corner);
}

export function buildChunkMeshes(chunk: ChunkData, getChunk: ChunkLookup): ChunkMeshResult {
  const opaqueBuilder = new GeometryBuilder();
  const cutoutBuilder = new GeometryBuilder();
  const translucentBuilder = new GeometryBuilder();

  // Pre-fetch 3x3 chunk neighborhood once (0 Map lookups or string allocations in hot loop!)
  const grid: Array<ChunkData | undefined> = [
    getChunk(chunk.cx - 1, chunk.cz - 1),
    getChunk(chunk.cx, chunk.cz - 1),
    getChunk(chunk.cx + 1, chunk.cz - 1),
    getChunk(chunk.cx - 1, chunk.cz),
    chunk,
    getChunk(chunk.cx + 1, chunk.cz),
    getChunk(chunk.cx - 1, chunk.cz + 1),
    getChunk(chunk.cx, chunk.cz + 1),
    getChunk(chunk.cx + 1, chunk.cz + 1),
  ];

  const blocks = chunk.blocks;
  const chunkLight = chunk.light;

  const sampleBlock = (lx: number, y: number, lz: number): BlockId => {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockId.Air;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return blocks[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] as BlockId;
    }
    const gx = lx < 0 ? 0 : lx >= CHUNK_SIZE ? 2 : 1;
    const gz = lz < 0 ? 0 : lz >= CHUNK_SIZE ? 2 : 1;
    const neighbor = grid[gz * 3 + gx];
    if (!neighbor) return BlockId.Stone;
    const nlx = lx < 0 ? lx + CHUNK_SIZE : lx >= CHUNK_SIZE ? lx - CHUNK_SIZE : lx;
    const nlz = lz < 0 ? lz + CHUNK_SIZE : lz >= CHUNK_SIZE ? lz - CHUNK_SIZE : lz;
    return neighbor.blocks[(y * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx] as BlockId;
  };

  // Zero-allocation packed byte return: high nibble = sky (0..15), low nibble = block (0..15)
  const sampleLightPacked = (lx: number, y: number, lz: number): number => {
    if (y >= WORLD_HEIGHT) return 0xf0;
    if (y < 0) return 0;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return chunkLight[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    }
    const gx = lx < 0 ? 0 : lx >= CHUNK_SIZE ? 2 : 1;
    const gz = lz < 0 ? 0 : lz >= CHUNK_SIZE ? 2 : 1;
    const neighbor = grid[gz * 3 + gx];
    if (!neighbor) return 0xe0;
    const nlx = lx < 0 ? lx + CHUNK_SIZE : lx >= CHUNK_SIZE ? lx - CHUNK_SIZE : lx;
    const nlz = lz < 0 ? lz + CHUNK_SIZE : lz >= CHUNK_SIZE ? lz - CHUNK_SIZE : lz;
    return neighbor.light[(y * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx];
  };

  const isOccluding = (lx: number, y: number, lz: number): number => {
    const id = sampleBlock(lx, y, lz);
    return BLOCKS[id]?.opaque ? 1 : 0;
  };

  const invMaxLight = 1 / MAX_LIGHT;
  const yLimit = Math.min(WORLD_HEIGHT - 1, chunk.maxY + 1);
  const aoLevels: [number, number, number, number] = [3, 3, 3, 3];
  const cornerLights: [
    [number, number],
    [number, number],
    [number, number],
    [number, number]
  ] = [
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
  ];
  const pts: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let y = 0; y <= yLimit; y++) {
    const yOffset = y * CHUNK_SIZE * CHUNK_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const zOffset = yOffset + lz * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = blocks[zOffset + lx] as BlockId;
        if (blockId === BlockId.Air) continue;

        const def = BLOCKS[blockId];
        if (!def) continue;

        // Cross-quad flora (Tall Grass, Wildflowers, Shrubs)
        if (def.shape === 'cross') {
          const [u0, v0, u1, v1] = getTileUVRect(def.faces[0]);
          const pl = sampleLightPacked(lx, y, lz);
          const light: [number, number] = [
            ((pl >> 4) & 15) * invMaxLight,
            (pl & 15) * invMaxLight,
          ];
          const sway = def.windSway ? 1 : 0;
          cutoutBuilder.pushQuad(
            [lx + 0.12, y, lz + 0.12],
            [lx + 0.88, y, lz + 0.88],
            [lx + 0.88, y + 0.94, lz + 0.88],
            [lx + 0.12, y + 0.94, lz + 0.12],
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0],
            0.94,
            0.94,
            1.0,
            1.0,
            light,
            light,
            light,
            light,
            0,
            0,
            sway,
            sway
          );
          cutoutBuilder.pushQuad(
            [lx + 0.12, y, lz + 0.88],
            [lx + 0.88, y, lz + 0.12],
            [lx + 0.88, y + 0.94, lz + 0.12],
            [lx + 0.12, y + 0.94, lz + 0.88],
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0],
            0.94,
            0.94,
            1.0,
            1.0,
            light,
            light,
            light,
            light,
            0,
            0,
            sway,
            sway
          );
          continue;
        }

        // Torch (crisp crossed standing torch sprite with bright full emissive light)
        if (def.shape === 'torch') {
          const [u0, v0, u1, v1] = getTileUVRect(def.faces[0]);
          const light: [number, number] = [
            Math.max(0.25, chunk.getSkyLight(lx, y, lz) / MAX_LIGHT),
            1.0,
          ];
          cutoutBuilder.pushQuad(
            [lx + 0.18, y, lz + 0.5],
            [lx + 0.82, y, lz + 0.5],
            [lx + 0.82, y + 0.85, lz + 0.5],
            [lx + 0.18, y + 0.85, lz + 0.5],
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0],
            1,
            1,
            1,
            1,
            light,
            light,
            light,
            light,
            0,
            0,
            0,
            0
          );
          cutoutBuilder.pushQuad(
            [lx + 0.5, y, lz + 0.18],
            [lx + 0.5, y, lz + 0.82],
            [lx + 0.5, y + 0.85, lz + 0.82],
            [lx + 0.5, y + 0.85, lz + 0.18],
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0],
            1,
            1,
            1,
            1,
            light,
            light,
            light,
            light,
            0,
            0,
            0,
            0
          );
          continue;
        }

        const builder =
          def.renderPass === 'translucent'
            ? translucentBuilder
            : def.renderPass === 'cutout'
            ? cutoutBuilder
            : opaqueBuilder;

        const inset = def.shape === 'cactus' ? 0.0625 : 0;

        for (let f = 0; f < 6; f++) {
          const spec = FACE_SPECS[f];
          const nx = lx + spec.dir[0];
          const ny = y + spec.dir[1];
          const nz = lz + spec.dir[2];

          const neighborId = sampleBlock(nx, ny, nz);
          const neighborDef = BLOCKS[neighborId];

          // Face culling rules:
          // - Never draw against an opaque cube unless current block is inset cactus side
          // - Never draw internal shared faces between identical glass / water / ice blocks
          if (inset === 0) {
            if (neighborDef?.opaque) continue;
            if (neighborId === blockId && (def.renderPass === 'translucent' || blockId === BlockId.Glass)) {
              continue;
            }
          } else if (f <= 1 && neighborDef?.opaque) {
            continue;
          }

          const [u0, v0, u1, v1] = getTileUVRect(def.faces[spec.faceSlot]);
          const sway =
            def.windSway || (blockId === BlockId.Water && f === 0 && neighborId === BlockId.Air)
              ? 1
              : 0;

          const basePacked = sampleLightPacked(nx, ny, nz);
          const baseSky = (basePacked >> 4) & 15;
          const baseBlk = basePacked & 15;

          // Compute 4-neighbor smooth Ambient Occlusion + smooth light averaging per vertex!
          for (let c = 0; c < 4; c++) {
            const su = spec.cornerSigns[c][0];
            const sv = spec.cornerSigns[c][1];
            const s1x = nx + spec.uAxis[0] * su;
            const s1y = ny + spec.uAxis[1] * su;
            const s1z = nz + spec.uAxis[2] * su;

            const s2x = nx + spec.vAxis[0] * sv;
            const s2y = ny + spec.vAxis[1] * sv;
            const s2z = nz + spec.vAxis[2] * sv;

            const cxPos = s1x + spec.vAxis[0] * sv;
            const cyPos = s1y + spec.vAxis[1] * sv;
            const czPos = s1z + spec.vAxis[2] * sv;

            const occ1 = isOccluding(s1x, s1y, s1z);
            const occ2 = isOccluding(s2x, s2y, s2z);
            const occC = isOccluding(cxPos, cyPos, czPos);

            aoLevels[c] = vertexAO(occ1, occ2, occC);

            let skySum = baseSky;
            let blkSum = baseBlk;
            let count = 1;
            if (!occ1) {
              const l = sampleLightPacked(s1x, s1y, s1z);
              skySum += (l >> 4) & 15;
              blkSum += l & 15;
              count++;
            }
            if (!occ2) {
              const l = sampleLightPacked(s2x, s2y, s2z);
              skySum += (l >> 4) & 15;
              blkSum += l & 15;
              count++;
            }
            if (!(occ1 && occ2) && !occC) {
              const l = sampleLightPacked(cxPos, cyPos, czPos);
              skySum += (l >> 4) & 15;
              blkSum += l & 15;
              count++;
            }
            const norm = invMaxLight / count;
            cornerLights[c][0] = skySum * norm;
            cornerLights[c][1] = blkSum * norm;

            let px = lx + spec.corners[c][0];
            const py = y + spec.corners[c][1];
            let pz = lz + spec.corners[c][2];
            if (inset > 0) {
              if (spec.dir[0] !== 0) px -= spec.dir[0] * inset;
              if (spec.dir[2] !== 0) pz -= spec.dir[2] * inset;
            }
            pts[c][0] = px;
            pts[c][1] = py;
            pts[c][2] = pz;
          }

          const flipDiag = aoLevels[0] + aoLevels[2] < aoLevels[1] + aoLevels[3];

          builder.pushQuad(
            pts[0],
            pts[1],
            pts[2],
            pts[3],
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0],
            spec.baseShade * AO_CURVE[aoLevels[0]],
            spec.baseShade * AO_CURVE[aoLevels[1]],
            spec.baseShade * AO_CURVE[aoLevels[2]],
            spec.baseShade * AO_CURVE[aoLevels[3]],
            cornerLights[0],
            cornerLights[1],
            cornerLights[2],
            cornerLights[3],
            sway,
            sway,
            sway,
            sway,
            flipDiag
          );
        }
      }
    }
  }

  chunk.dirty = false;
  return {
    opaque: opaqueBuilder.toBufferGeometry(),
    cutout: cutoutBuilder.toBufferGeometry(),
    translucent: translucentBuilder.toBufferGeometry(),
  };
}
