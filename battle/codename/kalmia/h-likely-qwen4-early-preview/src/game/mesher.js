// Chunk meshing: face culling + per-vertex AO + biome tints.
// Builds one opaque/cutout geometry and one translucent water geometry per chunk.
import * as THREE from 'three';
import { CHUNK, HEIGHT } from './world.js';
import { B, BLOCKS, isOpaque } from './blocks.js';
import { tileUV } from './textures.js';

// dir, 4 corners (pos + uv), ordered: 0 TL, 1 BL, 2 TR, 3 BR
const FACES = [
  { dir: [-1, 0, 0], corners: [ { p: [0, 1, 0], uv: [0, 1] }, { p: [0, 0, 0], uv: [0, 0] }, { p: [0, 1, 1], uv: [1, 1] }, { p: [0, 0, 1], uv: [1, 0] } ], shade: 0.82 },
  { dir: [1, 0, 0],  corners: [ { p: [1, 1, 1], uv: [0, 1] }, { p: [1, 0, 1], uv: [0, 0] }, { p: [1, 1, 0], uv: [1, 1] }, { p: [1, 0, 0], uv: [1, 0] } ], shade: 0.82 },
  { dir: [0, -1, 0], corners: [ { p: [1, 0, 1], uv: [1, 0] }, { p: [0, 0, 1], uv: [0, 0] }, { p: [1, 0, 0], uv: [1, 1] }, { p: [0, 0, 0], uv: [0, 1] } ], shade: 0.6 },
  { dir: [0, 1, 0],  corners: [ { p: [0, 1, 1], uv: [0, 0] }, { p: [1, 1, 1], uv: [1, 0] }, { p: [0, 1, 0], uv: [0, 1] }, { p: [1, 1, 0], uv: [1, 1] } ], shade: 1.0 },
  { dir: [0, 0, -1], corners: [ { p: [1, 0, 0], uv: [0, 0] }, { p: [0, 0, 0], uv: [1, 0] }, { p: [1, 1, 0], uv: [0, 1] }, { p: [0, 1, 0], uv: [1, 1] } ], shade: 0.72 },
  { dir: [0, 0, 1],  corners: [ { p: [0, 0, 1], uv: [0, 0] }, { p: [1, 0, 1], uv: [1, 0] }, { p: [0, 1, 1], uv: [0, 1] }, { p: [1, 1, 1], uv: [1, 1] } ], shade: 0.72 },
];

// tangent axes for AO lookups, precomputed per face
for (const f of FACES) {
  const normalAxis = f.dir[0] !== 0 ? 0 : f.dir[1] !== 0 ? 1 : 2;
  const axes = [0, 1, 2].filter((a) => a !== normalAxis);
  f.a1 = axes[0]; f.a2 = axes[1];
}

const AO_LEVELS = [0.42, 0.62, 0.8, 1.0];
const GRASS_TINTS = {
  2: [0.475, 0.714, 0.29],   // plains
  3: [0.38, 0.66, 0.24],     // forest
  4: [0.65, 0.72, 0.3],      // desert (unused for grass)
  5: [0.42, 0.6, 0.42],      // snowy
};
const DEFAULT_TINT = [0.475, 0.714, 0.29];

export function buildChunkMesh(world, chunk) {
  const { cx, cz, data, biomes } = chunk;
  const P = CHUNK + 2, PH = HEIGHT + 2;
  const pad = new Uint8Array(P * P * PH);
  const pidx = (x, y, z) => ((y + 1) * P + (z + 1)) * P + (x + 1);

  // interior copy
  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      const src = (y * CHUNK + z) * CHUNK;
      pad.set(data.subarray(src, src + CHUNK), pidx(0, y, z));
    }
  }
  // borders from neighbors
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let y = -1; y <= HEIGHT; y++) {
    for (let i = -1; i <= CHUNK; i++) {
      pad[pidx(i, y, -1)] = y < 0 ? B.STONE : world.getBlock(x0 + i, y, z0 - 1);
      pad[pidx(i, y, CHUNK)] = y < 0 ? B.STONE : world.getBlock(x0 + i, y, z0 + CHUNK);
      pad[pidx(-1, y, i)] = y < 0 ? B.STONE : world.getBlock(x0 - 1, y, z0 + i);
      pad[pidx(CHUNK, y, i)] = y < 0 ? B.STONE : world.getBlock(x0 + CHUNK, y, z0 + i);
    }
  }

  const sPos = [], sNorm = [], sUv = [], sCol = [], sIdx = [];
  const wPos = [], wNorm = [], wUv = [], wCol = [], wIdx = [];
  const lights = [];
  const uvCache = new Map();
  const getUV = (name) => {
    let uv = uvCache.get(name);
    if (!uv) { uv = tileUV(name); uvCache.set(name, uv); }
    return uv;
  };

  const solidAt = (x, y, z) => {
    const id = pad[pidx(x, y, z)];
    return isOpaque(id) ? 1 : 0;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = data[(y * CHUNK + z) * CHUNK + x];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];

        if (def.shape === 'torch') {
          addTorch(sPos, sNorm, sUv, sCol, sIdx, x, y, z, getUV('torch'));
          lights.push([x0 + x + 0.5, y + 0.65, z0 + z + 0.5]);
          continue;
        }

        const isWater = id === B.WATER;
        const tint = def.tint ? (GRASS_TINTS[biomes[z * CHUNK + x]] || DEFAULT_TINT) : null;
        const waterTop = isWater && pad[pidx(x, y + 1, z)] !== B.WATER;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
          const nid = ny < 0 ? B.STONE : ny >= HEIGHT ? B.AIR : pad[pidx(nx, ny, nz)];

          if (isWater) {
            if (nid === B.WATER || isOpaque(nid)) continue;
            if (f !== 3 && nid !== B.AIR && !BLOCKS[nid]?.fluid) continue; // sides only vs air
          } else {
            if (isOpaque(nid)) continue;
            if (nid === id && (def.transparent || def.cutout)) continue; // glass-glass, leaves-leaves
            if (nid === B.WATER && f === 3 && !def.transparent && !def.cutout) { /* draw top under water */ }
          }

          let tileName;
          if (f === 3) tileName = def.tiles[0];
          else if (f === 2) tileName = def.tiles[1];
          else tileName = def.tiles[2];
          const { u0, v0, du, dv } = getUV(tileName);

          const pos = isWater ? wPos : sPos;
          const norm = isWater ? wNorm : sNorm;
          const uvs = isWater ? wUv : sUv;
          const col = isWater ? wCol : sCol;
          const idx = isWater ? wIdx : sIdx;
          const base = pos.length / 3;
          const useTint = tint && (def.tint === 'leaves' || f === 3 || id !== B.GRASS);
          const ao = [3, 3, 3, 3];

          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            let py = corner.p[1];
            if (isWater && waterTop && py === 1) py = 0.86;
            pos.push(x + corner.p[0], y + py, z + corner.p[2]);
            norm.push(face.dir[0], face.dir[1], face.dir[2]);
            uvs.push(u0 + corner.uv[0] * du, v0 + corner.uv[1] * dv);

            let aoLevel = 3;
            if (!isWater && !def.transparent) {
              // vertex AO from the 3 neighbors around this corner on the face plane
              const a1 = face.a1, a2 = face.a2;
              const s1 = corner.p[a1] === 1 ? 1 : -1;
              const s2 = corner.p[a2] === 1 ? 1 : -1;
              const d1x = a1 === 0 ? s1 : 0, d1y = a1 === 1 ? s1 : 0, d1z = a1 === 2 ? s1 : 0;
              const d2x = a2 === 0 ? s2 : 0, d2y = a2 === 1 ? s2 : 0, d2z = a2 === 2 ? s2 : 0;
              const o1 = solidAt(nx + d1x, ny + d1y, nz + d1z);
              const o2 = solidAt(nx + d2x, ny + d2y, nz + d2z);
              const oc = solidAt(nx + d1x + d2x, ny + d1y + d2y, nz + d1z + d2z);
              aoLevel = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
            }
            ao[c] = aoLevel;
            let bright = AO_LEVELS[aoLevel] * face.shade;
            if (def.light) bright = 1.2;
            let r = bright, g = bright, bl = bright;
            if (useTint) { r *= tint[0] * 1.6; g *= tint[1] * 1.25; bl *= tint[2] * 1.9; }
            col.push(Math.min(r, 1), Math.min(g, 1), Math.min(bl, 1));
          }

          // flip quad diagonal for consistent AO interpolation
          if (ao[0] + ao[3] > ao[1] + ao[2]) {
            idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
          } else {
            idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
  }

  const make = (pos, norm, uv, col, idx) => {
    if (idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };

  return {
    solid: make(sPos, sNorm, sUv, sCol, sIdx),
    water: make(wPos, wNorm, wUv, wCol, wIdx),
    lights,
  };
}

function addTorch(pos, norm, uv, col, idx, x, y, z, tUV) {
  const x1 = 7 / 16, x2 = 9 / 16, h = 10 / 16;
  const { u0, v0, du, dv } = tUV;
  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    const base = pos.length / 3;
    for (let c = 0; c < 4; c++) {
      const corner = face.corners[c];
      pos.push(
        x + x1 + corner.p[0] * (x2 - x1),
        y + corner.p[1] * h,
        z + x1 + corner.p[2] * (x2 - x1)
      );
      norm.push(face.dir[0], face.dir[1], face.dir[2]);
      uv.push(u0 + (0.35 + corner.uv[0] * 0.3) * du, v0 + corner.uv[1] * dv);
      col.push(1, 1, 1);
    }
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}