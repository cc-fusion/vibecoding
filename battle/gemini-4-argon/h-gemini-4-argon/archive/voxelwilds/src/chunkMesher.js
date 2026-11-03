import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants.js';
import { BLOCK, getBlockDef, isOpaqueBlock } from './blocks.js';

const FACES = [
  {
    dir: 'top',
    normal: [0, 1, 0],
    baseShade: 1.0,
    verts: [
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
  {
    dir: 'bottom',
    normal: [0, -1, 0],
    baseShade: 0.54,
    verts: [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 0, 1, 1, 1],
      [0, 0, 1, 0, 1],
    ],
  },
  {
    dir: 'south',
    normal: [0, 0, 1],
    baseShade: 0.86,
    verts: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 1],
    ],
  },
  {
    dir: 'north',
    normal: [0, 0, -1],
    baseShade: 0.82,
    verts: [
      [1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 1, 0, 1, 1],
      [1, 1, 0, 0, 1],
    ],
  },
  {
    dir: 'east',
    normal: [1, 0, 0],
    baseShade: 0.74,
    verts: [
      [1, 0, 1, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 0, 1],
    ],
  },
  {
    dir: 'west',
    normal: [-1, 0, 0],
    baseShade: 0.74,
    verts: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 1, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
];

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

function createBucket() {
  return {
    positions: [],
    uvs: [],
    shades: [],
    skies: [],
    torches: [],
    sways: [],
    indices: [],
    vertCount: 0,
  };
}

function buildBufferGeometry(bucket) {
  if (bucket.vertCount === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
  geom.setAttribute('aShade', new THREE.Float32BufferAttribute(bucket.shades, 1));
  geom.setAttribute('aSky', new THREE.Float32BufferAttribute(bucket.skies, 1));
  geom.setAttribute('aTorch', new THREE.Float32BufferAttribute(bucket.torches, 1));
  geom.setAttribute('aSway', new THREE.Float32BufferAttribute(bucket.sways, 1));
  geom.setIndex(bucket.indices);
  geom.computeBoundingSphere();
  return geom;
}

function pushSimpleQuad(bucket, p0, p1, p2, p3, u0, v0, u1, v1, shade, sky, torch, swayTop = 0) {
  const base = bucket.vertCount;
  bucket.positions.push(
    p0[0], p0[1], p0[2],
    p1[0], p1[1], p1[2],
    p2[0], p2[1], p2[2],
    p3[0], p3[1], p3[2]
  );
  bucket.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  bucket.shades.push(shade, shade, shade, shade);
  bucket.skies.push(sky, sky, sky, sky);
  bucket.torches.push(torch, torch, torch, torch);
  bucket.sways.push(0, 0, swayTop, swayTop);
  bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  bucket.vertCount += 4;
}

export function buildChunkGeometries(cx, cz, world, textures) {
  const chunk = world.getChunk(cx, cz);
  if (!chunk) return { opaque: null, cutout: null, water: null };

  const opaque = createBucket();
  const cutout = createBucket();
  const water = createBucket();

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  const voxels = chunk.voxels;

  const sampleVertexAOAndLight = (wx, wy, wz, nx, ny, nz, px, py, pz) => {
    const cx0 = wx + nx;
    const cy0 = wy + ny;
    const cz0 = wz + nz;

    let s1x = cx0, s1y = cy0, s1z = cz0;
    let s2x = cx0, s2y = cy0, s2z = cz0;
    let crx = cx0, cry = cy0, crz = cz0;

    if (ny !== 0) {
      const dx = px ? 1 : -1;
      const dz = pz ? 1 : -1;
      s1x += dx;
      s2z += dz;
      crx += dx;
      crz += dz;
    } else if (nz !== 0) {
      const dx = px ? 1 : -1;
      const dy = py ? 1 : -1;
      s1x += dx;
      s2y += dy;
      crx += dx;
      cry += dy;
    } else {
      const dz = pz ? 1 : -1;
      const dy = py ? 1 : -1;
      s1z += dz;
      s2y += dy;
      crz += dz;
      cry += dy;
    }

    const b1 = world.getBlock(s1x, s1y, s1z);
    const b2 = world.getBlock(s2x, s2y, s2z);
    const bc = world.getBlock(crx, cry, crz);

    const occ1 = isOpaqueBlock(b1) ? 1 : 0;
    const occ2 = isOpaqueBlock(b2) ? 1 : 0;
    const occC = isOpaqueBlock(bc) ? 1 : 0;

    const aoLevel = occ1 && occ2 ? 0 : 3 - (occ1 + occ2 + occC);

    // Smooth light average across non-opaque neighbor cells
    let skySum = world.getSkyLight(cx0, cy0, cz0);
    let torchSum = world.getTorchLight(cx0, cy0, cz0);
    let count = 1;

    if (!occ1) {
      skySum += world.getSkyLight(s1x, s1y, s1z);
      torchSum += world.getTorchLight(s1x, s1y, s1z);
      count++;
    }
    if (!occ2) {
      skySum += world.getSkyLight(s2x, s2y, s2z);
      torchSum += world.getTorchLight(s2x, s2y, s2z);
      count++;
    }
    if (!(occ1 && occ2) && !occC) {
      skySum += world.getTorchLight ? world.getSkyLight(crx, cry, crz) : 15;
      torchSum += world.getTorchLight(crx, cry, crz);
      count++;
    }

    return {
      ao: AO_CURVE[aoLevel],
      sky: skySum / (count * 15),
      torch: torchSum / (count * 15),
    };
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      const rowOffset = (y * CHUNK_SIZE + lz) * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = voxels[rowOffset + lx];
        if (blockId === BLOCK.AIR) continue;

        const wx = baseX + lx;
        const def = getBlockDef(blockId);
        const rType = def.renderType;

        // Crossed-quad flora (Poppy, Dandelion, Tall Grass, Mushroom, Shrub)
        if (rType === 'cross') {
          const uv = textures.getBlockFaceUVs(blockId, 'side');
          const sky = world.getSkyLight(wx, y, wz) / 15;
          const torch = world.getTorchLight(wx, y, wz) / 15;
          // Slight deterministic positional jitter so meadow grass looks organic
          const jx = (((wx * 73856093) ^ (wz * 19349663)) & 15) / 15 * 0.16 - 0.08;
          const jz = (((wx * 83492791) ^ (wz * 2971215073)) & 15) / 15 * 0.16 - 0.08;

          const x0 = lx + 0.12 + jx;
          const x1 = lx + 0.88 + jx;
          const z0 = lz + 0.12 + jz;
          const z1 = lz + 0.88 + jz;
          const y0 = y;
          const y1 = y + 0.88;

          pushSimpleQuad(
            cutout,
            [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0],
            uv.u0, uv.v0, uv.u1, uv.v1,
            0.94, sky, torch, 1.0
          );
          pushSimpleQuad(
            cutout,
            [x0, y0, z1], [x1, y0, z0], [x1, y1, z0], [x0, y1, z1],
            uv.u0, uv.v0, uv.u1, uv.v1,
            0.92, sky, torch, 1.0
          );
          continue;
        }

        // 3D Voxel Torch
        if (rType === 'torch') {
          const uv = textures.getBlockFaceUVs(blockId, 'side');
          const sky = world.getSkyLight(wx, y, wz) / 15;
          const torch = 1.0;
          // Slim post centered in cell using center slice of torch tile
          const uMid0 = uv.u0 + (uv.u1 - uv.u0) * (7 / 16);
          const uMid1 = uv.u0 + (uv.u1 - uv.u0) * (9 / 16);
          const vTop = uv.v0 + (uv.v1 - uv.v0) * (13 / 16);

          const x0 = lx + 0.43;
          const x1 = lx + 0.57;
          const z0 = lz + 0.43;
          const z1 = lz + 0.57;
          const y0 = y;
          const y1 = y + 0.66;

          pushSimpleQuad(cutout, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], uMid0, uv.v0, uMid1, vTop, 1.0, sky, torch, 0);
          pushSimpleQuad(cutout, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], uMid0, uv.v0, uMid1, vTop, 1.0, sky, torch, 0);
          pushSimpleQuad(cutout, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], uMid0, uv.v0, uMid1, vTop, 0.95, sky, torch, 0);
          pushSimpleQuad(cutout, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], uMid0, uv.v0, uMid1, vTop, 0.95, sky, torch, 0);
          // Glowing ember cap
          const vCap0 = uv.v0 + (uv.v1 - uv.v0) * (11 / 16);
          pushSimpleQuad(cutout, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], uMid0, vCap0, uMid1, vTop, 1.0, sky, 1.0, 0);
          continue;
        }

        // Determine target mesh bucket
        const bucket =
          rType === 'water' ? water :
          rType === 'leaves' || rType === 'glass' || rType === 'cactus' ? cutout :
          opaque;

        const isWater = rType === 'water';
        const isLeaves = rType === 'leaves';
        const isCactus = rType === 'cactus';
        const waterTopDrop = isWater && world.getBlock(wx, y + 1, wz) !== BLOCK.WATER ? 0.12 : 0.0;
        const inset = isCactus ? 0.0625 : 0.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.normal;
          const nb = world.getBlock(wx + nx, y + ny, wz + nz);

          // Face culling rules
          if (isWater) {
            if (nb === BLOCK.WATER || isOpaqueBlock(nb)) continue;
          } else if (rType === 'glass') {
            if (nb === blockId || isOpaqueBlock(nb)) continue;
          } else if (isLeaves) {
            if (nb === blockId || isOpaqueBlock(nb)) continue;
          } else if (isCactus) {
            if ((ny !== 0 && nb === BLOCK.CACTUS) || (ny !== 0 && isOpaqueBlock(nb))) continue;
          } else {
            if (isOpaqueBlock(nb)) continue;
          }

          const uv = textures.getBlockFaceUVs(blockId, face.dir);
          const base = bucket.vertCount;
          const aoVals = [0, 0, 0, 0];

          const emitLight = def.lightLevel > 0 ? def.lightLevel / 15 : 0;

          for (let v = 0; v < 4; v++) {
            const [px, py, pz, uFlag, vFlag] = face.verts[v];

            let vx = lx + px;
            let vy = y + py;
            let vz = lz + pz;

            if (isWater && py === 1) {
              vy -= waterTopDrop;
            }
            if (isCactus && ny === 0) {
              vx += nx * -inset;
              vz += nz * -inset;
            }

            bucket.positions.push(vx, vy, vz);
            bucket.uvs.push(uFlag ? uv.u1 : uv.u0, vFlag ? uv.v1 : uv.v0);

            if (emitLight > 0) {
              aoVals[v] = 1.0;
              bucket.shades.push(1.0);
              bucket.skies.push(world.getSkyLight(wx + nx, y + ny, wz + nz) / 15);
              bucket.torches.push(emitLight);
            } else {
              const sample = sampleVertexAOAndLight(wx, y, wz, nx, ny, nz, px, py, pz);
              aoVals[v] = sample.ao;
              bucket.shades.push(face.baseShade * sample.ao);
              bucket.skies.push(sample.sky);
              bucket.torches.push(sample.torch);
            }

            bucket.sways.push(isLeaves ? 0.35 : 0.0);
          }

          // Anisotropy-free AO quad diagonal selection
          if (aoVals[0] + aoVals[2] < aoVals[1] + aoVals[3]) {
            bucket.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          } else {
            bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }

          bucket.vertCount += 4;
        }
      }
    }
  }

  return {
    opaque: buildBufferGeometry(opaque),
    cutout: buildBufferGeometry(cutout),
    water: buildBufferGeometry(water),
  };
}
