// Chunk meshing: flood-fill sky/block lighting + culled faces with smooth AO.
import { B, BLOCKS, OPAQUE, LIGHT, LIGHT_ATTEN } from "./blocks";
import { CHUNK, HEIGHT, BIOME_GRASS } from "./worldgen";
import { tileIndex, ATLAS_TILES, GRASS_TINT, FOLIAGE_TINT } from "./textures";
import type { World, Chunk } from "./world";

const M = 16; // margin
const S = CHUNK + M * 2; // 48
const SH = S * HEIGHT;
const REGION = S * S * HEIGHT;

const rBlocks = new Uint8Array(REGION);
const rSky = new Uint8Array(REGION);
const rBlk = new Uint8Array(REGION);
const rBiome = new Uint8Array(S * S);
const heightMap = new Int16Array(S * S);
const QSIZE = 1 << 20;
const queue = new Int32Array(QSIZE);

const ridx = (rx: number, y: number, rz: number) => (rx * S + rz) * HEIGHT + y;

export interface MeshBuffers {
  position: Float32Array;
  uv: Float32Array;
  light: Float32Array;
  color: Float32Array;
  index: Uint32Array;
}
export interface MeshData {
  opaque: MeshBuffers;
  water: MeshBuffers;
}

class Builder {
  pos: number[] = [];
  uv: number[] = [];
  light: number[] = [];
  color: number[] = [];
  idx: number[] = [];
  vcount = 0;
  toBuffers(): MeshBuffers {
    return {
      position: new Float32Array(this.pos),
      uv: new Float32Array(this.uv),
      light: new Float32Array(this.light),
      color: new Float32Array(this.color),
      index: new Uint32Array(this.idx),
    };
  }
}

// Face table: normal, u axis, v axis, shade
interface Face {
  n: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  shade: number;
  texSlot: number; // 0 top,1 bottom,2 side (index into tex array semantics)
}
const FACES: Face[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], shade: 0.8, texSlot: 2 }, // +X
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.8, texSlot: 2 }, // -X
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], shade: 1.0, texSlot: 0 }, // +Y
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.55, texSlot: 1 }, // -Y
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.88, texSlot: 2 }, // +Z
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], shade: 0.88, texSlot: 2 }, // -Z
];
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const AO_CURVE = [0.4, 0.62, 0.82, 1.0];

// Resolved per-block texture tile indices [px, nx, py, ny, pz, nz]
let blockTiles: Int16Array | null = null;
let tintKind: Uint8Array | null = null; // 0 none, 1 grass, 2 foliage, 3 water
function resolveTiles() {
  blockTiles = new Int16Array(100 * 6);
  tintKind = new Uint8Array(100);
  for (let id = 1; id < 100; id++) {
    const def = BLOCKS[id];
    if (!def) continue;
    const t = def.tex;
    let faces: string[];
    if (t.length === 1) faces = [t[0], t[0], t[0], t[0], t[0], t[0]];
    else if (t.length === 3) faces = [t[2], t[2], t[0], t[1], t[2], t[2]];
    else if (t.length === 4) faces = [t[3], t[3], t[0], t[1], t[2], t[3]]; // front on +Z
    else faces = t;
    for (let f = 0; f < 6; f++) blockTiles[id * 6 + f] = tileIndex(faces[f]);
    tintKind[id] = def.tint === "grass" ? 1 : def.tint === "foliage" ? 2 : def.tint === "water" ? 3 : 0;
  }
}

function fillRegion(world: World, chunk: Chunk) {
  rBlocks.fill(0);
  rBiome.fill(2);
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const c = world.getChunk(chunk.cx + ox, chunk.cz + oz);
      if (!c) continue;
      for (let lx = 0; lx < CHUNK; lx++) {
        const rx = M + ox * CHUNK + lx;
        for (let lz = 0; lz < CHUNK; lz++) {
          const rz = M + oz * CHUNK + lz;
          const src = (lx * CHUNK + lz) * HEIGHT;
          rBlocks.set(c.blocks.subarray(src, src + HEIGHT), (rx * S + rz) * HEIGHT);
          rBiome[rx * S + rz] = c.biomes[lx * CHUNK + lz];
        }
      }
    }
  }
}

function computeLight() {
  rSky.fill(0);
  rBlk.fill(0);
  // height map (highest non-air)
  for (let rx = 0; rx < S; rx++) {
    for (let rz = 0; rz < S; rz++) {
      const base = (rx * S + rz) * HEIGHT;
      let h = -1;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        if (rBlocks[base + y] !== B.AIR) {
          h = y;
          break;
        }
      }
      heightMap[rx * S + rz] = h;
      rSky.fill(15, base + h + 1, base + HEIGHT);
    }
  }
  // Sky seeds
  let qh = 0,
    qt = 0;
  for (let rx = 0; rx < S; rx++) {
    for (let rz = 0; rz < S; rz++) {
      const h = heightMap[rx * S + rz];
      let maxN = h + 1;
      if (rx > 0) maxN = Math.max(maxN, heightMap[(rx - 1) * S + rz]);
      if (rx < S - 1) maxN = Math.max(maxN, heightMap[(rx + 1) * S + rz]);
      if (rz > 0) maxN = Math.max(maxN, heightMap[rx * S + rz - 1]);
      if (rz < S - 1) maxN = Math.max(maxN, heightMap[rx * S + rz + 1]);
      const base = (rx * S + rz) * HEIGHT;
      const topBlock = h >= 0 ? rBlocks[base + h] : 0;
      const start = OPAQUE[topBlock] ? h + 2 : h + 1;
      for (let y = Math.max(start, 0); y <= Math.min(maxN, HEIGHT - 1); y++) {
        queue[qt++ & (QSIZE - 1)] = base + y;
      }
    }
  }
  qt = propagate(rSky, qh, qt);
  // Block light seeds
  qh = 0;
  qt = 0;
  for (let i = 0; i < REGION; i++) {
    const l = LIGHT[rBlocks[i]];
    if (l > 0) {
      rBlk[i] = l;
      queue[qt++ & (QSIZE - 1)] = i;
    }
  }
  propagate(rBlk, qh, qt);
}

function propagate(arr: Uint8Array, qh: number, qt: number): number {
  while (qh < qt) {
    const i = queue[qh++ & (QSIZE - 1)];
    const l = arr[i];
    if (l <= 1) continue;
    const y = i % HEIGHT;
    const col = (i - y) / HEIGHT;
    const rz = col % S;
    const rx = (col - rz) / S;
    // 6 neighbors
    if (y < HEIGHT - 1) spread(arr, i + 1, l, qt) && (queue[qt++ & (QSIZE - 1)] = i + 1);
    if (y > 0) spread(arr, i - 1, l, qt) && (queue[qt++ & (QSIZE - 1)] = i - 1);
    if (rz < S - 1) spread(arr, i + HEIGHT, l, qt) && (queue[qt++ & (QSIZE - 1)] = i + HEIGHT);
    if (rz > 0) spread(arr, i - HEIGHT, l, qt) && (queue[qt++ & (QSIZE - 1)] = i - HEIGHT);
    if (rx < S - 1) spread(arr, i + SH, l, qt) && (queue[qt++ & (QSIZE - 1)] = i + SH);
    if (rx > 0) spread(arr, i - SH, l, qt) && (queue[qt++ & (QSIZE - 1)] = i - SH);
  }
  return qt;
}
function spread(arr: Uint8Array, j: number, l: number, _qt: number): boolean {
  const b = rBlocks[j];
  if (OPAQUE[b]) return false;
  const nl = l - 1 - LIGHT_ATTEN[b];
  if (nl > arr[j]) {
    arr[j] = nl;
    return true;
  }
  return false;
}

function shouldRender(self: number, nb: number, selfDef: { cullSame?: boolean; shape: string }): boolean {
  if (nb === B.AIR) return true;
  if (OPAQUE[nb]) return false;
  if (nb === self && selfDef.cullSame) return false;
  return true;
}

export function buildChunkMesh(world: World, chunk: Chunk): MeshData {
  if (!blockTiles) resolveTiles();
  const tiles = blockTiles!;
  const tints = tintKind!;
  fillRegion(world, chunk);
  computeLight();

  // Save interior light into chunk for sampling
  if (!chunk.skyLight) chunk.skyLight = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  if (!chunk.blockLight) chunk.blockLight = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  for (let lx = 0; lx < CHUNK; lx++)
    for (let lz = 0; lz < CHUNK; lz++) {
      const src = ((M + lx) * S + M + lz) * HEIGHT;
      const dst = (lx * CHUNK + lz) * HEIGHT;
      chunk.skyLight.set(rSky.subarray(src, src + HEIGHT), dst);
      chunk.blockLight.set(rBlk.subarray(src, src + HEIGHT), dst);
    }

  const opaque = new Builder();
  const water = new Builder();
  const ox = chunk.cx * CHUNK,
    oz = chunk.cz * CHUNK;
  const tileScale = 1 / ATLAS_TILES;
  const eps = 0.002 * tileScale;

  const ao = [0, 0, 0, 0];
  const lightS = [0, 0, 0, 0];
  const lightB = [0, 0, 0, 0];

  for (let lx = 0; lx < CHUNK; lx++) {
    const rx = lx + M;
    for (let lz = 0; lz < CHUNK; lz++) {
      const rz = lz + M;
      const colBase = (rx * S + rz) * HEIGHT;
      const biome = rBiome[rx * S + rz];
      const bg = BIOME_GRASS[biome] ?? BIOME_GRASS[2];
      for (let y = 0; y < HEIGHT; y++) {
        const id = rBlocks[colBase + y];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const tk = tints[id];
        let tr = 1, tg = 1, tb = 1;
        if (tk === 1) {
          tr = GRASS_TINT[0] * bg[0]; tg = GRASS_TINT[1] * bg[1]; tb = GRASS_TINT[2] * bg[2];
        } else if (tk === 2) {
          tr = FOLIAGE_TINT[0] * bg[0]; tg = FOLIAGE_TINT[1] * bg[1]; tb = FOLIAGE_TINT[2] * bg[2];
        } else if (tk === 3) {
          tr = 0.3; tg = 0.5; tb = 0.95;
        }
        const wx = ox + lx, wz = oz + lz;

        if (def.shape === "cross") {
          const tile = tiles[id * 6];
          const i = colBase + y;
          const sl = rSky[i] / 15, bl = rBlk[i] / 15;
          addCross(opaque, wx, y, wz, tile, tileScale, eps, sl, bl, tr, tg, tb);
          continue;
        }

        const isLiquid = def.shape === "liquid";
        const target = id === B.WATER ? water : opaque;
        const above = y < HEIGHT - 1 ? rBlocks[colBase + y + 1] : B.AIR;
        const topH = isLiquid && above !== id ? 0.875 : 1;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = rx + face.n[0], ny = y + face.n[1], nz = rz + face.n[2];
          if (ny < 0) continue;
          const nb = ny >= HEIGHT ? B.AIR : rBlocks[ridx(nx, ny, nz)];
          if (!shouldRender(id, nb, def)) continue;
          if (isLiquid && f !== 2 && nb === id) continue;

          const tile = tiles[id * 6 + f];
          // AO + smooth light per corner
          let flip = false;
          for (let c = 0; c < 4; c++) {
            const su = CORNERS[c][0], sv = CORNERS[c][1];
            const s1x = nx + su * face.u[0], s1y = ny + su * face.u[1], s1z = nz + su * face.u[2];
            const s2x = nx + sv * face.v[0], s2y = ny + sv * face.v[1], s2z = nz + sv * face.v[2];
            const cxx = s1x + sv * face.v[0], cyy = s1y + sv * face.v[1], czz = s1z + sv * face.v[2];
            const b1 = sample(s1x, s1y, s1z), b2 = sample(s2x, s2y, s2z), b3 = sample(cxx, cyy, czz);
            const o1 = OPAQUE[b1], o2 = OPAQUE[b2], o3 = OPAQUE[b3];
            let aoV: number;
            if (o1 && o2) aoV = 0;
            else aoV = 3 - (o1 + o2 + o3);
            ao[c] = aoV;
            // light average over non-opaque cells
            let ss = 0, bb = 0, n = 0;
            const i0 = lidx(nx, ny, nz);
            if (i0 >= 0) { ss += rSky[i0]; bb += rBlk[i0]; n++; }
            if (!o1) { const i1 = lidx(s1x, s1y, s1z); if (i1 >= 0) { ss += rSky[i1]; bb += rBlk[i1]; n++; } }
            if (!o2) { const i2 = lidx(s2x, s2y, s2z); if (i2 >= 0) { ss += rSky[i2]; bb += rBlk[i2]; n++; } }
            if (!o3 && !(o1 && o2)) { const i3 = lidx(cxx, cyy, czz); if (i3 >= 0) { ss += rSky[i3]; bb += rBlk[i3]; n++; } }
            if (n === 0) { ss = rSky[colBase + y] * 1; bb = rBlk[colBase + y]; n = 1; }
            lightS[c] = ss / n / 15;
            lightB[c] = bb / n / 15;
          }
          if (ao[0] + ao[2] > ao[1] + ao[3]) flip = true;
          if (isLiquid) { ao[0] = ao[1] = ao[2] = ao[3] = 3; }

          const tx = tile % ATLAS_TILES, ty = Math.floor(tile / ATLAS_TILES);
          const base = target.vcount;
          const cx0 = wx + 0.5 + face.n[0] * 0.5, cy0 = y + 0.5 + face.n[1] * 0.5, cz0 = wz + 0.5 + face.n[2] * 0.5;
          for (let c = 0; c < 4; c++) {
            const su = CORNERS[c][0], sv = CORNERS[c][1];
            let px = cx0 + su * face.u[0] * 0.5 + sv * face.v[0] * 0.5;
            let py = cy0 + su * face.u[1] * 0.5 + sv * face.v[1] * 0.5;
            let pz = cz0 + su * face.u[2] * 0.5 + sv * face.v[2] * 0.5;
            if (topH < 1 && py > y + 0.9) py = y + topH;
            target.pos.push(px, py, pz);
            const tu = (su + 1) / 2, tv = (sv + 1) / 2;
            target.uv.push((tx + tu) * tileScale + (tu === 0 ? eps : -eps), 1 - (ty + (1 - tv)) * tileScale + (tv === 0 ? eps : -eps));
            const aoF = AO_CURVE[ao[c]] * face.shade;
            target.light.push(lightS[c] * aoF, lightB[c] * aoF);
            target.color.push(tr, tg, tb);
          }
          target.vcount += 4;
          if (flip) target.idx.push(base + 1, base + 2, base + 3, base + 3, base + 0, base + 1);
          else target.idx.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
        }
      }
    }
  }
  return { opaque: opaque.toBuffers(), water: water.toBuffers() };
}

function sample(rx: number, y: number, rz: number): number {
  if (y < 0 || y >= HEIGHT || rx < 0 || rx >= S || rz < 0 || rz >= S) return B.AIR;
  return rBlocks[ridx(rx, y, rz)];
}
function lidx(rx: number, y: number, rz: number): number {
  if (y < 0 || y >= HEIGHT || rx < 0 || rx >= S || rz < 0 || rz >= S) return -1;
  return ridx(rx, y, rz);
}

function addCross(b: Builder, x: number, y: number, z: number, tile: number, tileScale: number, eps: number, sl: number, bl: number, tr: number, tg: number, tb: number) {
  const tx = tile % ATLAS_TILES, ty = Math.floor(tile / ATLAS_TILES);
  const u0 = tx * tileScale + eps, u1 = (tx + 1) * tileScale - eps;
  const v1 = 1 - ty * tileScale - eps, v0 = 1 - (ty + 1) * tileScale + eps;
  const quads: [number, number, number, number][] = [
    [x + 0.15, z + 0.15, x + 0.85, z + 0.85],
    [x + 0.85, z + 0.15, x + 0.15, z + 0.85],
  ];
  for (const [ax, az, bx, bz] of quads) {
    for (let side = 0; side < 2; side++) {
      const base = b.vcount;
      b.pos.push(ax, y, az, bx, y, bz, bx, y + 1, bz, ax, y + 1, az);
      b.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      for (let i = 0; i < 4; i++) {
        b.light.push(sl, bl);
        b.color.push(tr, tg, tb);
      }
      b.vcount += 4;
      if (side === 0) b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else b.idx.push(base + 2, base + 1, base, base + 3, base + 2, base);
    }
  }
}
