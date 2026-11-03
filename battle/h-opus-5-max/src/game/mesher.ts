// ───────────────────────────────────────────────────────────────────────────
//  Chunk mesher: face culling + per-vertex ambient occlusion + smooth light
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { B, KIND, OPAQUE, TEXLUT } from "./blocks";
import { CHUNK_X, CHUNK_Z, WORLD_HEIGHT, idx } from "./constants";
import { BIOME_TINT } from "./worldgen";
import type { Chunk } from "./chunk";

const PX = CHUNK_X + 2;
const PZ = CHUNK_Z + 2;
const PY = WORLD_HEIGHT + 2;
const PVOL = PX * PY * PZ;

const padBlocks = new Uint8Array(PVOL);
const padLight = new Uint8Array(PVOL);
const padBiome = new Uint8Array(PX * PZ);

function pidx(x: number, y: number, z: number) {
  return ((y + 1) * PZ + (z + 1)) * PX + (x + 1);
}

export interface NeighborSource {
  getChunk(cx: number, cz: number): Chunk | undefined;
}

export function buildPadded(src: NeighborSource, c: Chunk) {
  padBlocks.fill(0);
  padLight.fill(0);
  // centre
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      const srcBase = (y * CHUNK_Z + z) * CHUNK_X;
      const dstBase = ((y + 1) * PZ + (z + 1)) * PX + 1;
      for (let x = 0; x < CHUNK_X; x++) {
        padBlocks[dstBase + x] = c.blocks[srcBase + x];
        padLight[dstBase + x] = c.light[srcBase + x];
      }
    }
  }
  for (let z = 0; z < CHUNK_Z; z++)
    for (let x = 0; x < CHUNK_X; x++) padBiome[(z + 1) * PX + (x + 1)] = c.biomes[z * CHUNK_X + x];

  // neighbours (4 sides + 4 corners)
  const copyCol = (nx: number, nz: number, fromX: number, fromZ: number, toX: number, toZ: number) => {
    const n = src.getChunk(nx, nz);
    const bi = (toZ + 1) * PX + (toX + 1);
    if (!n) {
      padBiome[bi] = 2;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const pi = ((y + 1) * PZ + (toZ + 1)) * PX + (toX + 1);
        padBlocks[pi] = 0;
        padLight[pi] = 0xf0;
      }
      return;
    }
    padBiome[bi] = n.biomes[fromZ * CHUNK_X + fromX];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const si = (y * CHUNK_Z + fromZ) * CHUNK_X + fromX;
      const pi = ((y + 1) * PZ + (toZ + 1)) * PX + (toX + 1);
      padBlocks[pi] = n.blocks[si];
      padLight[pi] = n.light[si];
    }
  };
  for (let z = 0; z < CHUNK_Z; z++) {
    copyCol(c.cx - 1, c.cz, CHUNK_X - 1, z, -1, z);
    copyCol(c.cx + 1, c.cz, 0, z, CHUNK_X, z);
  }
  for (let x = 0; x < CHUNK_X; x++) {
    copyCol(c.cx, c.cz - 1, x, CHUNK_Z - 1, x, -1);
    copyCol(c.cx, c.cz + 1, x, 0, x, CHUNK_Z);
  }
  copyCol(c.cx - 1, c.cz - 1, CHUNK_X - 1, CHUNK_Z - 1, -1, -1);
  copyCol(c.cx + 1, c.cz - 1, 0, CHUNK_Z - 1, CHUNK_X, -1);
  copyCol(c.cx - 1, c.cz + 1, CHUNK_X - 1, 0, -1, CHUNK_Z);
  copyCol(c.cx + 1, c.cz + 1, 0, 0, CHUNK_X, CHUNK_Z);
}

// face tables ───────────────────────────────────────────────────────────────
// each face: normal, u axis, v axis, base corner; corners ordered CCW from outside
interface FaceDef {
  n: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  base: [number, number, number];
  uv: [number, number][];
}
const F: FaceDef[] = [
  // +Y
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], base: [0, 1, 0], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  // -Y
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], base: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  // +X
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], base: [1, 0, 0], uv: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  // -X
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], base: [0, 0, 0], uv: [[0, 1], [1, 1], [1, 0], [0, 0]] },
  // +Z
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], base: [0, 0, 1], uv: [[0, 1], [1, 1], [1, 0], [0, 0]] },
  // -Z
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], base: [0, 0, 0], uv: [[0, 1], [0, 0], [1, 0], [1, 1]] },
];
// corner (uCoef,vCoef) order matching CCW winding
const CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const AO_LEVELS = [0.42, 0.63, 0.82, 1.0];
const ao4 = new Int32Array(4);
const sky4 = new Float32Array(4);
const blk4 = new Float32Array(4);

// which blocks receive biome tint: 1 = all faces, 2 = top face only
const TINTED = new Uint8Array(256);
export function initMesherLuts() {
  TINTED[B.GRASS] = 2;
  TINTED[B.OAK_LEAVES] = 1;
  TINTED[B.BIRCH_LEAVES] = 1;
  TINTED[B.SPRUCE_LEAVES] = 1;
  TINTED[B.JUNGLE_LEAVES] = 1;
  TINTED[B.TALL_GRASS] = 1;
  TINTED[B.FERN] = 1;
}

// scratch buffers ───────────────────────────────────────────────────────────
const MAXV = 190000;
class Scratch {
  pos = new Float32Array(MAXV * 3);
  uv = new Uint8Array(MAXV * 2);
  layer = new Uint16Array(MAXV);
  lt = new Uint8Array(MAXV * 3);
  face = new Uint8Array(MAXV);
  tint = new Uint8Array(MAXV * 3);
  index = new Uint32Array(MAXV * 2);
  nv = 0;
  ni = 0;
  reset() {
    this.nv = 0;
    this.ni = 0;
  }
}
const G = [new Scratch(), new Scratch(), new Scratch()];

export interface GeomData {
  pos: Float32Array;
  uv: Uint8Array;
  layer: Uint16Array;
  lt: Uint8Array;
  face: Uint8Array;
  tint: Uint8Array;
  index: Uint32Array;
  count: number;
}

export interface MeshResult {
  groups: (GeomData | null)[];
}

function isOpaqueAt(i: number) {
  return OPAQUE[padBlocks[i]];
}

export function meshChunk(c: Chunk): MeshResult {
  for (const g of G) g.reset();

  const yLo = Math.max(0, c.minY - 1);
  const yHi = Math.min(WORLD_HEIGHT - 1, c.maxY + 1);

  for (let y = yLo; y <= yHi; y++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      for (let x = 0; x < CHUNK_X; x++) {
        const here = padBlocks[pidx(x, y, z)];
        if (here === 0) continue;
        const kind = KIND[here];
        if (kind === 0) continue;
        const biome = padBiome[(z + 1) * PX + (x + 1)];
        if (kind === 2) {
          emitCross(here, x, y, z, biome);
          continue;
        }
        const liquid = kind === 3;
        const group = liquid || here === B.GLASS || here === B.ICE ? 2 : OPAQUE[here] ? 0 : 1;
        const topCut =
          liquid && padBlocks[pidx(x, y + 1, z)] !== here ? 0.885 : 1;

        for (let f = 0; f < 6; f++) {
          const fd = F[f];
          const nx = x + fd.n[0],
            ny = y + fd.n[1],
            nz = z + fd.n[2];
          if (ny < 0 || ny >= WORLD_HEIGHT) {
            if (f === 1) continue;
          }
          const npi = pidx(nx, ny, nz);
          const nb = padBlocks[npi];
          if (nb === here) continue;
          if (OPAQUE[nb]) continue;
          if (liquid && KIND[nb] === 3) continue;
          if (!OPAQUE[here] && !liquid && nb !== 0 && KIND[nb] === 1 && !OPAQUE[nb]) {
            // glass next to ice etc: still draw
          }
          emitFace(G[group], here, f, x, y, z, biome, topCut, liquid);
        }
      }
    }
  }

  const out: (GeomData | null)[] = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const g = G[i];
    if (g.nv === 0) continue;
    out[i] = {
      pos: g.pos.slice(0, g.nv * 3),
      uv: g.uv.slice(0, g.nv * 2),
      layer: g.layer.slice(0, g.nv),
      lt: g.lt.slice(0, g.nv * 3),
      face: g.face.slice(0, g.nv),
      tint: g.tint.slice(0, g.nv * 3),
      index: g.index.slice(0, g.ni),
      count: g.ni,
    };
  }
  return { groups: out };
}

function emitFace(
  g: Scratch,
  id: number,
  f: number,
  x: number,
  y: number,
  z: number,
  biome: number,
  topCut: number,
  liquid: boolean,
) {
  if (g.nv + 4 > MAXV) return;
  const fd = F[f];
  const layer = TEXLUT[id * 6 + f];
  const tintMode = TINTED[id];
  const tintArr = BIOME_TINT[biome] ?? BIOME_TINT[2];
  const applyTint = tintMode === 1 || (tintMode === 2 && f === 0);
  const tr = applyTint ? tintArr[0] * 255 : 255;
  const tg = applyTint ? tintArr[1] * 255 : 255;
  const tb = applyTint ? tintArr[2] * 255 : 255;

  const nFront = pidx(x + fd.n[0], y + fd.n[1], z + fd.n[2]);
  const frontLight = padLight[nFront];

  for (let ci = 0; ci < 4; ci++) {
    const uc = CORNERS[ci][0];
    const vc = CORNERS[ci][1];
    const du = uc ? 1 : -1;
    const dv = vc ? 1 : -1;
    const bx = x + fd.n[0];
    const by = y + fd.n[1];
    const bz = z + fd.n[2];
    const s1 = pidx(bx + fd.u[0] * du, by + fd.u[1] * du, bz + fd.u[2] * du);
    const s2 = pidx(bx + fd.v[0] * dv, by + fd.v[1] * dv, bz + fd.v[2] * dv);
    const cc = pidx(
      bx + fd.u[0] * du + fd.v[0] * dv,
      by + fd.u[1] * du + fd.v[1] * dv,
      bz + fd.u[2] * du + fd.v[2] * dv,
    );
    const o1 = isOpaqueAt(s1);
    const o2 = isOpaqueAt(s2);
    const oc = isOpaqueAt(cc);
    ao4[ci] = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);

    let skySum = frontLight >> 4;
    let blkSum = frontLight & 15;
    let n = 1;
    if (!o1) {
      skySum += padLight[s1] >> 4;
      blkSum += padLight[s1] & 15;
      n++;
    }
    if (!o2) {
      skySum += padLight[s2] >> 4;
      blkSum += padLight[s2] & 15;
      n++;
    }
    if (!oc && !(o1 && o2)) {
      skySum += padLight[cc] >> 4;
      blkSum += padLight[cc] & 15;
      n++;
    }
    sky4[ci] = skySum / n / 15;
    blk4[ci] = blkSum / n / 15;
  }

  const base = g.nv;
  for (let ci = 0; ci < 4; ci++) {
    const uc = CORNERS[ci][0];
    const vc = CORNERS[ci][1];
    let px = x + fd.base[0] + fd.u[0] * uc + fd.v[0] * vc;
    let py = y + fd.base[1] + fd.u[1] * uc + fd.v[1] * vc;
    let pz = z + fd.base[2] + fd.u[2] * uc + fd.v[2] * vc;
    if (liquid && py === y + 1) py = y + topCut;
    const vi = g.nv;
    g.pos[vi * 3] = px;
    g.pos[vi * 3 + 1] = py;
    g.pos[vi * 3 + 2] = pz;
    g.uv[vi * 2] = fd.uv[ci][0] * 255;
    g.uv[vi * 2 + 1] = fd.uv[ci][1] * 255;
    g.layer[vi] = layer;
    g.face[vi] = f;
    g.lt[vi * 3] = sky4[ci] * 255;
    g.lt[vi * 3 + 1] = blk4[ci] * 255;
    g.lt[vi * 3 + 2] = AO_LEVELS[ao4[ci]] * 255;
    g.tint[vi * 3] = tr;
    g.tint[vi * 3 + 1] = tg;
    g.tint[vi * 3 + 2] = tb;
    g.nv++;
  }
  // flip quad to avoid AO interpolation artefacts
  const flip = ao4[0] + ao4[2] > ao4[1] + ao4[3];
  const i = g.ni;
  if (flip) {
    g.index[i] = base + 1;
    g.index[i + 1] = base + 2;
    g.index[i + 2] = base + 3;
    g.index[i + 3] = base + 1;
    g.index[i + 4] = base + 3;
    g.index[i + 5] = base;
  } else {
    g.index[i] = base;
    g.index[i + 1] = base + 1;
    g.index[i + 2] = base + 2;
    g.index[i + 3] = base;
    g.index[i + 4] = base + 2;
    g.index[i + 5] = base + 3;
  }
  g.ni += 6;
}

const CROSS_SCALE: Record<number, number> = { [B.TORCH]: 0.34 };

function emitCross(id: number, x: number, y: number, z: number, biome: number) {
  const g = G[1];
  if (g.nv + 16 > MAXV) return;
  const layer = TEXLUT[id * 6];
  const tintMode = TINTED[id];
  const tintArr = BIOME_TINT[biome] ?? BIOME_TINT[2];
  const tr = tintMode ? tintArr[0] * 255 : 255;
  const tg = tintMode ? tintArr[1] * 255 : 255;
  const tb = tintMode ? tintArr[2] * 255 : 255;

  const l = padLight[pidx(x, y, z)];
  const skyV = (l >> 4) / 15;
  const blkV = Math.max((l & 15) / 15, id === B.TORCH ? 0.95 : 0);

  const s = CROSS_SCALE[id] ?? 1;
  const lo = 0.5 - s * 0.5 + (1 - s) * 0;
  const hi = 0.5 + s * 0.5;
  const yTop = id === B.TORCH ? 0.62 : 1;
  const yBot = 0;

  const planes: [number, number, number, number][] = [
    [lo, lo, hi, hi],
    [lo, hi, hi, lo],
  ];
  for (const [x0, z0, x1, z1] of planes) {
    for (let dir = 0; dir < 2; dir++) {
      const base = g.nv;
      const quad: [number, number, number, number, number][] =
        dir === 0
          ? [
              [x0, yBot, z0, 0, 1],
              [x1, yBot, z1, 1, 1],
              [x1, yTop, z1, 1, 0],
              [x0, yTop, z0, 0, 0],
            ]
          : [
              [x1, yBot, z1, 0, 1],
              [x0, yBot, z0, 1, 1],
              [x0, yTop, z0, 1, 0],
              [x1, yTop, z1, 0, 0],
            ];
      for (const [vx, vy, vz, u, v] of quad) {
        const vi = g.nv;
        g.pos[vi * 3] = x + vx;
        g.pos[vi * 3 + 1] = y + vy;
        g.pos[vi * 3 + 2] = z + vz;
        g.uv[vi * 2] = u * 255;
        g.uv[vi * 2 + 1] = v * 255;
        g.layer[vi] = layer;
        g.face[vi] = 6;
        g.lt[vi * 3] = skyV * 255;
        g.lt[vi * 3 + 1] = blkV * 255;
        g.lt[vi * 3 + 2] = 255;
        g.tint[vi * 3] = tr;
        g.tint[vi * 3 + 1] = tg;
        g.tint[vi * 3 + 2] = tb;
        g.nv++;
      }
      const i = g.ni;
      g.index[i] = base;
      g.index[i + 1] = base + 1;
      g.index[i + 2] = base + 2;
      g.index[i + 3] = base;
      g.index[i + 4] = base + 2;
      g.index[i + 5] = base + 3;
      g.ni += 6;
    }
  }
}

export function geomFrom(d: GeomData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute("aUv", new THREE.BufferAttribute(d.uv, 2, true));
  g.setAttribute("aLayer", new THREE.BufferAttribute(d.layer, 1, false));
  g.setAttribute("aLight", new THREE.BufferAttribute(d.lt, 3, true));
  g.setAttribute("aFace", new THREE.BufferAttribute(d.face, 1, false));
  g.setAttribute("aTint", new THREE.BufferAttribute(d.tint, 3, true));
  g.setIndex(new THREE.BufferAttribute(d.index, 1));
  return g;
}

export { idx };
