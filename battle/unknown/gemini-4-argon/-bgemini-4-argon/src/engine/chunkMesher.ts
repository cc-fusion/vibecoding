import * as THREE from 'three';
import { BLOCK, ITEMS } from './blocks';
import { CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { getTileUV } from './textureAtlas';

class MeshBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  shades: number[] = [];
  skyLights: number[] = [];
  blockLights: number[] = [];
  indices: number[] = [];
  vertCount = 0;

  pushQuad(
    v0: [number, number, number],
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    uvRect: [number, number, number, number],
    ao: [number, number, number, number],
    sky: [number, number, number, number],
    blk: [number, number, number, number],
    faceShade: number
  ) {
    const base = this.vertCount;
    const [u0, t0, u1, t1] = uvRect;

    this.positions.push(
      v0[0], v0[1], v0[2],
      v1[0], v1[1], v1[2],
      v2[0], v2[1], v2[2],
      v3[0], v3[1], v3[2]
    );
    this.uvs.push(u0, t0, u1, t0, u1, t1, u0, t1);

    this.shades.push(ao[0] * faceShade, ao[1] * faceShade, ao[2] * faceShade, ao[3] * faceShade);
    this.skyLights.push(sky[0], sky[1], sky[2], sky[3]);
    this.blockLights.push(blk[0], blk[1], blk[2], blk[3]);

    // Anisotropy-free AO diagonal selection
    if (ao[0] + ao[2] > ao[1] + ao[3]) {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    } else {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
    this.vertCount += 4;
  }

  toGeometry(): THREE.BufferGeometry | null {
    if (this.vertCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shades, 1));
    geom.setAttribute('aSkyLight', new THREE.Float32BufferAttribute(this.skyLights, 1));
    geom.setAttribute('aBlockLight', new THREE.Float32BufferAttribute(this.blockLights, 1));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

interface FaceDef {
  dir: [number, number, number];
  shade: number;
  texKey: 'top' | 'side' | 'bottom';
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
}

// Counter-clockwise winding when viewed from outside (+dir)
const FACES: FaceDef[] = [
  {
    // +Y Top
    dir: [0, 1, 0],
    shade: 1.0,
    texKey: 'top',
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, -1],
  },
  {
    // -Y Bottom
    dir: [0, -1, 0],
    shade: 0.54,
    texKey: 'bottom',
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
  },
  {
    // +Z South
    dir: [0, 0, 1],
    shade: 0.84,
    texKey: 'side',
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
  },
  {
    // -Z North
    dir: [0, 0, -1],
    shade: 0.84,
    texKey: 'side',
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uAxis: [-1, 0, 0],
    vAxis: [0, 1, 0],
  },
  {
    // +X East
    dir: [1, 0, 0],
    shade: 0.72,
    texKey: 'side',
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uAxis: [0, 0, -1],
    vAxis: [0, 1, 0],
  },
  {
    // -X West
    dir: [-1, 0, 0],
    shade: 0.72,
    texKey: 'side',
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
  },
];

const AO_TABLE = [1.0, 0.82, 0.65, 0.48];

export interface ChunkMeshResult {
  solid: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
}

export interface WorldLightReader {
  getBlock(wx: number, wy: number, wz: number): number;
  getSkyLight(wx: number, wy: number, wz: number): number; // 0..15
  getBlockLight(wx: number, wy: number, wz: number): number; // 0..15
}

function isOccluding(id: number): boolean {
  const def = ITEMS[id];
  return !!def && def.opaque;
}

export function buildChunkMeshes(
  cx: number,
  cz: number,
  blocks: Uint8Array,
  world: WorldLightReader
): ChunkMeshResult {
  const solid = new MeshBuilder();
  const cutout = new MeshBuilder();
  const water = new MeshBuilder();

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      const rowOffset = (y * CHUNK_SIZE + lz) * CHUNK_SIZE;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[rowOffset + lx];
        if (id === BLOCK.AIR) continue;

        const def = ITEMS[id];
        if (!def) continue;
        const wx = baseX + lx;

        if (def.renderType === 'cross') {
          const uv = getTileUV(def.textures.side);
          const sky = world.getSkyLight(wx, y, wz) / 15;
          const blk = Math.max(def.lightEmission, world.getBlockLight(wx, y, wz)) / 15;
          const ao: [number, number, number, number] = [0.85, 0.85, 1.0, 1.0];
          const skyArr: [number, number, number, number] = [sky, sky, sky, sky];
          const blkArr: [number, number, number, number] = [blk, blk, blk, blk];

          cutout.pushQuad(
            [lx + 0.14, y, lz + 0.14],
            [lx + 0.86, y, lz + 0.86],
            [lx + 0.86, y + 0.92, lz + 0.86],
            [lx + 0.14, y + 0.92, lz + 0.14],
            uv,
            ao,
            skyArr,
            blkArr,
            0.96
          );
          cutout.pushQuad(
            [lx + 0.14, y, lz + 0.86],
            [lx + 0.86, y, lz + 0.14],
            [lx + 0.86, y + 0.92, lz + 0.14],
            [lx + 0.14, y + 0.92, lz + 0.86],
            uv,
            ao,
            skyArr,
            blkArr,
            0.96
          );
          continue;
        }

        if (def.renderType === 'torch') {
          // Crisp 3D slim voxel torch post + glowing head
          const uv = getTileUV(def.textures.side);
          const sky = world.getSkyLight(wx, y, wz) / 15;
          const s4: [number, number, number, number] = [sky, sky, sky, sky];
          const b4: [number, number, number, number] = [1, 1, 1, 1];
          const ao: [number, number, number, number] = [0.95, 0.95, 1, 1];

          cutout.pushQuad(
            [lx + 0.0, y, lz + 0.5],
            [lx + 1.0, y, lz + 0.5],
            [lx + 1.0, y + 0.85, lz + 0.5],
            [lx + 0.0, y + 0.85, lz + 0.5],
            uv,
            ao,
            s4,
            b4,
            1.0
          );
          cutout.pushQuad(
            [lx + 0.5, y, lz + 0.0],
            [lx + 0.5, y, lz + 1.0],
            [lx + 0.5, y + 0.85, lz + 1.0],
            [lx + 0.5, y + 0.85, lz + 0.0],
            uv,
            ao,
            s4,
            b4,
            1.0
          );
          continue;
        }

        const isWaterPass = id === BLOCK.WATER || id === BLOCK.ICE;
        const isCutoutCube = !isWaterPass && def.transparent;
        const target = isWaterPass ? water : isCutoutCube ? cutout : solid;

        const waterTopLowered = id === BLOCK.WATER && world.getBlock(wx, y + 1, wz) !== BLOCK.WATER;
        const topY = waterTopLowered ? 0.88 : 1.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];

          const neighborId = world.getBlock(nx, ny, nz);
          if (neighborId === id) {
            // Cull internal water, ice, glass, and solid faces between identical blocks;
            // keep leaf-to-leaf faces skipped as well for super clean canopy performance
            continue;
          }
          const neighborDef = ITEMS[neighborId];
          if (neighborDef && neighborDef.opaque) {
            continue;
          }

          const uv = getTileUV(def.textures[face.texKey]);

          // Compute smooth 4-vertex AO & lighting for solid/cutout cubes
          const aoVals: [number, number, number, number] = [1, 1, 1, 1];
          const skyVals: [number, number, number, number] = [1, 1, 1, 1];
          const blkVals: [number, number, number, number] = [0, 0, 0, 0];

          const centerSky = world.getSkyLight(nx, ny, nz);
          const centerBlk = Math.max(def.lightEmission, world.getBlockLight(nx, ny, nz));

          for (let c = 0; c < 4; c++) {
            // Map corner index c -> (-1 or +1) along face uAxis & vAxis
            const su = c === 1 || c === 2 ? 1 : -1;
            const sv = c === 2 || c === 3 ? 1 : -1;

            const s1x = nx + face.uAxis[0] * su;
            const s1y = ny + face.uAxis[1] * su;
            const s1z = nz + face.uAxis[2] * su;

            const s2x = nx + face.vAxis[0] * sv;
            const s2y = ny + face.vAxis[1] * sv;
            const s2z = nz + face.vAxis[2] * sv;

            const crx = nx + face.uAxis[0] * su + face.vAxis[0] * sv;
            const cry = ny + face.uAxis[1] * su + face.vAxis[1] * sv;
            const crz = nz + face.uAxis[2] * su + face.vAxis[2] * sv;

            const occ1 = isOccluding(world.getBlock(s1x, s1y, s1z)) ? 1 : 0;
            const occ2 = isOccluding(world.getBlock(s2x, s2y, s2z)) ? 1 : 0;
            const occC = occ1 && occ2 ? 1 : isOccluding(world.getBlock(crx, cry, crz)) ? 1 : 0;

            const aoLevel = occ1 && occ2 ? 3 : occ1 + occ2 + occC;
            aoVals[c] = def.lightEmission >= 12 ? 1.0 : AO_TABLE[aoLevel];

            // Average open neighbor light for smooth light gradients on walls/caves!
            let sumSky = centerSky;
            let sumBlk = centerBlk;
            let samples = 1;
            if (!occ1) {
              sumSky += world.getSkyLight(s1x, s1y, s1z);
              sumBlk += world.getBlockLight(s1x, s1y, s1z);
              samples++;
            }
            if (!occ2) {
              sumSky += world.getSkyLight(s2x, s2y, s2z);
              sumBlk += world.getBlockLight(s2x, s2y, s2z);
              samples++;
            }
            if (!occC && !(occ1 && occ2)) {
              sumSky += world.getSkyLight(crx, cry, crz);
              sumBlk += world.getBlockLight(crx, cry, crz);
              samples++;
            }
            skyVals[c] = sumSky / (samples * 15);
            blkVals[c] = Math.max(def.lightEmission / 15, sumBlk / (samples * 15));
          }

          const c0 = face.corners[0];
          const c1 = face.corners[1];
          const c2 = face.corners[2];
          const c3 = face.corners[3];

          target.pushQuad(
            [lx + c0[0], y + (c0[1] ? topY : 0), lz + c0[2]],
            [lx + c1[0], y + (c1[1] ? topY : 0), lz + c1[2]],
            [lx + c2[0], y + (c2[1] ? topY : 0), lz + c2[2]],
            [lx + c3[0], y + (c3[1] ? topY : 0), lz + c3[2]],
            uv,
            aoVals,
            skyVals,
            blkVals,
            def.lightEmission >= 12 ? 1.0 : face.shade
          );
        }
      }
    }
  }

  return {
    solid: solid.toGeometry(),
    cutout: cutout.toGeometry(),
    water: water.toGeometry(),
  };
}
