// Builds render geometry for a chunk: face culling, smooth lighting, ambient occlusion.
import * as THREE from "three";
import { B, BLOCKS } from "./blocks";
import type { Atlas } from "./textures";
import type { World, Chunk } from "./world";
import { CHUNK, HEIGHT, bi } from "./worldgen";

const PW = CHUNK + 2; // padded width
const pidx = (x: number, y: number, z: number) => ((x + 1) * PW + (z + 1)) * HEIGHT + y;

// light curve: 0..15 -> brightness
export const LIGHT_CURVE = new Float32Array(16);
for (let i = 0; i < 16; i++) LIGHT_CURVE[i] = Math.pow(0.8, 15 - i);
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];

// faces: +X, -X, +Y, -Y, +Z, -Z
const FACE_NORMALS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const FACE_VERTS: number[][][] = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];
// tangent axes for each face (for AO side sampling)
const FACE_TANGENTS = [
  [1, 2],
  [1, 2],
  [0, 2],
  [0, 2],
  [0, 1],
  [0, 1],
];
const FACE_SHADE = [0.8, 0.8, 1.0, 0.5, 0.9, 0.9]; // directional shading
const CROSS_QUADS: number[][][] = [
  [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
  [[1, 0, 1], [0, 0, 0], [0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1]],
];

class GeoBuf {
  pos: number[] = [];
  uv: number[] = [];
  shade: number[] = [];
  idx: number[] = [];
  count = 0;
  quad(v: number[][], uvs: number[][], shades: number[][], flip: boolean) {
    const base = this.count;
    for (let i = 0; i < 4; i++) {
      this.pos.push(v[i][0], v[i][1], v[i][2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.shade.push(shades[i][0], shades[i][1], shades[i][2]);
    }
    if (flip) this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
  }
  build(): THREE.BufferGeometry | null {
    if (this.count === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aShade", new THREE.Float32BufferAttribute(this.shade, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// reusable padded buffers
const pBlocks = new Uint8Array(PW * PW * HEIGHT);
const pLight = new Uint8Array(PW * PW * HEIGHT);
let texCache: Map<number, number[][]> | null = null;

function faceUVs(atlas: Atlas): Map<number, number[][]> {
  if (texCache) return texCache;
  texCache = new Map();
  for (const def of BLOCKS) {
    if (!def) continue;
    texCache.set(
      def.id,
      def.tex.map((t) => atlas.tileUV(t) as unknown as number[]),
    );
  }
  return texCache;
}

export function buildChunkGeometry(world: World, chunk: Chunk, atlas: Atlas) {
  const uvTable = faceUVs(atlas);
  const ox = chunk.cx * CHUNK,
    oz = chunk.cz * CHUNK;
  // fill padded arrays
  for (let x = -1; x <= CHUNK; x++) {
    for (let z = -1; z <= CHUNK; z++) {
      const wx = ox + x,
        wz = oz + z;
      const c = world.getChunk(wx >> 4, wz >> 4);
      const p = pidx(x, 0, z);
      if (c) {
        const s = bi(wx & 15, 0, wz & 15);
        pBlocks.set(c.blocks.subarray(s, s + HEIGHT), p);
        pLight.set(c.light.subarray(s, s + HEIGHT), p);
      } else {
        pBlocks.fill(B.AIR, p, p + HEIGHT);
        pLight.fill(0xf0, p, p + HEIGHT);
      }
    }
  }

  const solid = new GeoBuf();
  const water = new GeoBuf();
  const cornerShade: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const cornerUV: number[][] = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const verts: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

  const opaqueAt = (x: number, y: number, z: number) => {
    if (y < 0) return true;
    if (y >= HEIGHT) return false;
    return BLOCKS[pBlocks[pidx(x, y, z)]].opaque;
  };
  const lightAt = (x: number, y: number, z: number) => {
    if (y < 0) return 0;
    if (y >= HEIGHT) return 0xf0;
    return pLight[pidx(x, y, z)];
  };

  for (let x = 0; x < CHUNK; x++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let y = 0; y < HEIGHT; y++) {
        const id = pBlocks[pidx(x, y, z)];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];
        const uvs = uvTable.get(id)!;

        if (def.model === "cross") {
          const l = lightAt(x, y, z);
          const sky = LIGHT_CURVE[l >> 4],
            bl = LIGHT_CURVE[l & 15];
          const uv = uvs[0];
          for (const q of CROSS_QUADS) {
            for (let i = 0; i < 4; i++) {
              verts[i][0] = x + q[i][0];
              verts[i][1] = y + q[i][1];
              verts[i][2] = z + q[i][2];
              const u = i === 1 || i === 2 ? 1 : 0;
              cornerUV[i][0] = uv[0] + u * (uv[2] - uv[0]);
              cornerUV[i][1] = uv[1] + (1 - q[i][1]) * (uv[3] - uv[1]);
              cornerShade[i][0] = sky;
              cornerShade[i][1] = bl;
              cornerShade[i][2] = 1;
            }
            solid.quad(verts, cornerUV, cornerShade, false);
          }
          continue;
        }

        const isLiquid = def.model === "liquid";
        const buf = id === B.WATER ? water : solid;
        const lowered = isLiquid && pBlocks[pidx(x, y + 1, z)] !== id && y + 1 < HEIGHT;
        const topY = lowered ? 0.875 : 1;

        for (let f = 0; f < 6; f++) {
          const n = FACE_NORMALS[f];
          const nx = x + n[0],
            ny = y + n[1],
            nz = z + n[2];
          // culling
          let nid: number;
          if (ny < 0) continue;
          if (ny >= HEIGHT) nid = B.AIR;
          else nid = pBlocks[pidx(nx, ny, nz)];
          const ndef = BLOCKS[nid];
          if (ndef.opaque) continue;
          if (nid === id && !def.opaque) continue; // same transparent block (glass-glass, water-water, leaves-leaves)
          if (isLiquid && f !== 2 && ndef.model === "liquid") continue;

          const uv = uvs[f];
          const tan = FACE_TANGENTS[f];
          const fv = FACE_VERTS[f];
          let aoSum02 = 0,
            aoSum13 = 0;
          for (let i = 0; i < 4; i++) {
            const c = fv[i];
            verts[i][0] = x + c[0];
            verts[i][1] = y + (c[1] === 1 ? topY : 0);
            verts[i][2] = z + c[2];
            // uv
            let u: number, v: number;
            if (f === 2 || f === 3) {
              u = c[0];
              v = c[2];
            } else {
              u = f < 2 ? c[2] : c[0];
              if (f === 0 || f === 5) u = 1 - u;
              v = 1 - c[1];
            }
            cornerUV[i][0] = uv[0] + u * (uv[2] - uv[0]);
            cornerUV[i][1] = uv[1] + v * (uv[3] - uv[1]);
            // smooth lighting + AO: sample the 4 cells in front of this corner
            const s1 = c[tan[0]] === 1 ? 1 : -1;
            const s2 = c[tan[1]] === 1 ? 1 : -1;
            const o1 = [0, 0, 0],
              o2 = [0, 0, 0];
            o1[tan[0]] = s1;
            o2[tan[1]] = s2;
            const ax = nx + o1[0], ay = ny + o1[1], az = nz + o1[2];
            const bx = nx + o2[0], by = ny + o2[1], bz = nz + o2[2];
            const cx2 = nx + o1[0] + o2[0], cy2 = ny + o1[1] + o2[1], cz2 = nz + o1[2] + o2[2];
            const sA = opaqueAt(ax, ay, az), sB = opaqueAt(bx, by, bz), sC = opaqueAt(cx2, cy2, cz2);
            let ao: number;
            if (sA && sB) ao = 0;
            else ao = 3 - ((sA ? 1 : 0) + (sB ? 1 : 0) + (sC ? 1 : 0));
            // average light over non-opaque cells
            let skyT = 0, blT = 0, cnt = 0;
            const l0 = lightAt(nx, ny, nz);
            skyT += l0 >> 4; blT += l0 & 15; cnt++;
            if (!sA) { const l = lightAt(ax, ay, az); skyT += l >> 4; blT += l & 15; cnt++; }
            if (!sB) { const l = lightAt(bx, by, bz); skyT += l >> 4; blT += l & 15; cnt++; }
            if (!sC && !(sA && sB)) { const l = lightAt(cx2, cy2, cz2); skyT += l >> 4; blT += l & 15; cnt++; }
            const skyAvg = skyT / cnt, blAvg = blT / cnt;
            const si = Math.floor(skyAvg), bIdx = Math.floor(blAvg);
            const skyV = LIGHT_CURVE[si] + (LIGHT_CURVE[Math.min(15, si + 1)] - LIGHT_CURVE[si]) * (skyAvg - si);
            const blV = LIGHT_CURVE[bIdx] + (LIGHT_CURVE[Math.min(15, bIdx + 1)] - LIGHT_CURVE[bIdx]) * (blAvg - bIdx);
            const aoV = AO_CURVE[ao] * FACE_SHADE[f];
            cornerShade[i][0] = skyV;
            cornerShade[i][1] = blV;
            cornerShade[i][2] = isLiquid ? FACE_SHADE[f] : aoV;
            const total = (skyV + blV) * aoV;
            if (i === 0 || i === 2) aoSum02 += total;
            else aoSum13 += total;
          }
          buf.quad(verts, cornerUV, cornerShade, aoSum02 <= aoSum13);
        }
      }
    }
  }

  return { solid: solid.build(), water: water.build() };
}
