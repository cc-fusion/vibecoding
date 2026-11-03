import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, BIOMES } from './constants.js';
import { BLOCK, REGISTRY } from './blocks.js';

const AO_CURVE = [1.0, 0.83, 0.67, 0.50];

const FACES = [
  {
    name: 'top',
    dir: [0, 1, 0],
    shade: 1.0,
    verts: [
      { pos: [0, 1, 1], uv: [0, 0], t1: [-1, 0, 0], t2: [0, 0, 1] },
      { pos: [1, 1, 1], uv: [1, 0], t1: [1, 0, 0], t2: [0, 0, 1] },
      { pos: [1, 1, 0], uv: [1, 1], t1: [1, 0, 0], t2: [0, 0, -1] },
      { pos: [0, 1, 0], uv: [0, 1], t1: [-1, 0, 0], t2: [0, 0, -1] },
    ],
  },
  {
    name: 'bottom',
    dir: [0, -1, 0],
    shade: 0.56,
    verts: [
      { pos: [0, 0, 0], uv: [0, 0], t1: [-1, 0, 0], t2: [0, 0, -1] },
      { pos: [1, 0, 0], uv: [1, 0], t1: [1, 0, 0], t2: [0, 0, -1] },
      { pos: [1, 0, 1], uv: [1, 1], t1: [1, 0, 0], t2: [0, 0, 1] },
      { pos: [0, 0, 1], uv: [0, 1], t1: [-1, 0, 0], t2: [0, 0, 1] },
    ],
  },
  {
    name: 'front', // +Z
    dir: [0, 0, 1],
    shade: 0.86,
    verts: [
      { pos: [0, 0, 1], uv: [0, 0], t1: [-1, 0, 0], t2: [0, -1, 0] },
      { pos: [1, 0, 1], uv: [1, 0], t1: [1, 0, 0], t2: [0, -1, 0] },
      { pos: [1, 1, 1], uv: [1, 1], t1: [1, 0, 0], t2: [0, 1, 0] },
      { pos: [0, 1, 1], uv: [0, 1], t1: [-1, 0, 0], t2: [0, 1, 0] },
    ],
  },
  {
    name: 'back', // -Z
    dir: [0, 0, -1],
    shade: 0.82,
    verts: [
      { pos: [1, 0, 0], uv: [0, 0], t1: [1, 0, 0], t2: [0, -1, 0] },
      { pos: [0, 0, 0], uv: [1, 0], t1: [-1, 0, 0], t2: [0, -1, 0] },
      { pos: [0, 1, 0], uv: [1, 1], t1: [-1, 0, 0], t2: [0, 1, 0] },
      { pos: [1, 1, 0], uv: [0, 1], t1: [1, 0, 0], t2: [0, 1, 0] },
    ],
  },
  {
    name: 'right', // +X
    dir: [1, 0, 0],
    shade: 0.75,
    verts: [
      { pos: [1, 0, 1], uv: [0, 0], t1: [0, 0, 1], t2: [0, -1, 0] },
      { pos: [1, 0, 0], uv: [1, 0], t1: [0, 0, -1], t2: [0, -1, 0] },
      { pos: [1, 1, 0], uv: [1, 1], t1: [0, 0, -1], t2: [0, 1, 0] },
      { pos: [1, 1, 1], uv: [0, 1], t1: [0, 0, 1], t2: [0, 1, 0] },
    ],
  },
  {
    name: 'left', // -X
    dir: [-1, 0, 0],
    shade: 0.73,
    verts: [
      { pos: [0, 0, 0], uv: [0, 0], t1: [0, 0, -1], t2: [0, -1, 0] },
      { pos: [0, 0, 1], uv: [1, 0], t1: [0, 0, 1], t2: [0, -1, 0] },
      { pos: [0, 1, 1], uv: [1, 1], t1: [0, 0, 1], t2: [0, 1, 0] },
      { pos: [0, 1, 0], uv: [0, 1], t1: [0, 0, -1], t2: [0, 1, 0] },
    ],
  },
];

class GeometryBuilder {
  constructor(hasWave = false) {
    this.positions = [];
    this.uvs = [];
    this.colors = [];
    this.lights = [];
    this.extras = []; // aSway or aWave
    this.indices = [];
    this.vertCount = 0;
    this.hasWave = hasWave;
  }

  pushQuad(v0, v1, v2, v3, flipDiag = false) {
    const base = this.vertCount;
    const verts = [v0, v1, v2, v3];
    for (let i = 0; i < 4; i++) {
      const v = verts[i];
      this.positions.push(v.x, v.y, v.z);
      this.uvs.push(v.u, v.v);
      this.colors.push(v.r, v.g, v.b);
      this.lights.push(v.sky, v.blk);
      this.extras.push(v.extra);
    }
    if (flipDiag) {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    } else {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    this.vertCount += 4;
  }

  toBufferGeometry() {
    if (this.vertCount === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 2));
    geo.setAttribute(
      this.hasWave ? 'aWave' : 'aSway',
      new THREE.Float32BufferAttribute(this.extras, 1)
    );
    geo.setIndex(this.indices);
    geo.computeBoundingSphere();
    return geo;
  }
}

function getFaceTextureName(def, faceName) {
  const t = def.textures;
  if (!t) return 'stone';
  if (t.all) return t.all;
  if (faceName === 'top') return t.top || t.side;
  if (faceName === 'bottom') return t.bottom || t.top || t.side;
  if (faceName === 'front' && t.front) return t.front;
  return t.side || t.top;
}

function isAOOccluder(id) {
  const def = REGISTRY[id];
  return Boolean(def && def.solid && def.renderType === 'cube' && !def.translucent);
}

export function buildChunkGeometries(chunk, world, uvMap) {
  const solidBuilder = new GeometryBuilder(false);
  const fluidBuilder = new GeometryBuilder(true);

  const blocks = chunk.blocks;
  const biomeGrid = chunk.biomeGrid;
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;
  const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

  const getBlockFast = (wx, y, wz) => {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    const lx = wx - baseX;
    const lz = wz - baseZ;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return blocks[idx(lx, y, lz)];
    }
    return world.getBlock(wx, y, wz);
  };

  const getLightFast = (wx, y, wz) => {
    if (y >= WORLD_HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const lx = wx - baseX;
    const lz = wz - baseZ;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return chunk.light[idx(lx, y, lz)];
    }
    return world.getPackedLight(wx, y, wz);
  };

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[idx(lx, y, lz)];
        if (id === BLOCK.AIR) continue;

        const def = REGISTRY[id];
        if (!def) continue;

        const wx = baseX + lx;
        const biome = biomeGrid ? (biomeGrid[lz * CHUNK_SIZE + lx] || BIOMES.PLAINS) : BIOMES.PLAINS;

        // 1. Crossed X-quad flora (Flowers, Tall Grass, Glowshroom)
        if (def.renderType === 'cross') {
          const uvRect = uvMap[def.textures.all] || uvMap.grass_top;
          const packed = getLightFast(wx, y, wz);
          const sky = ((packed >> 4) & 0x0f) / 15.0;
          const blk = Math.max((packed & 0x0f), def.light || 0) / 15.0;

          let tr = 0.92, tg = 0.92, tb = 0.92;
          if (def.tintType === 'grass_all') {
            tr = biome.grassTint[0];
            tg = biome.grassTint[1];
            tb = biome.grassTint[2];
          }

          emitCrossPlant(solidBuilder, lx, y, lz, uvRect, tr, tg, tb, sky, blk);
          continue;
        }

        // 2. Slim 3D Torch
        if (def.renderType === 'torch') {
          const uvRect = uvMap.torch;
          const packed = getLightFast(wx, y, wz);
          const sky = ((packed >> 4) & 0x0f) / 15.0;
          const blk = 1.0; // Torch glows brightly
          emitTorchMesh(solidBuilder, lx, y, lz, uvRect, sky, blk);
          continue;
        }

        // 3. Translucent Water & Ice / Lava Fluids
        if (def.renderType === 'fluid' || def.translucent) {
          const isWater = id === BLOCK.WATER;
          const isLava = id === BLOCK.LAVA;
          const builder = isLava ? solidBuilder : fluidBuilder;
          const uvRect = uvMap[def.textures.all] || uvMap.water;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];
            const nbId = getBlockFast(nx, ny, nz);
            if (nbId === id) continue;
            const nbDef = REGISTRY[nbId];
            if (nbDef && nbDef.opaque) continue;

            const packed = getLightFast(nx, ny, nz);
            const sky = ((packed >> 4) & 0x0f) / 15.0;
            const blk = Math.max(packed & 0x0f, def.light || 0) / 15.0;
            const shade = isLava ? 1.0 : face.shade;
            const waveFlag = isWater && (face.name === 'top' || getBlockFast(wx, y + 1, wz) !== BLOCK.WATER) ? 1.0 : 0.0;

            const qVerts = [];
            for (let vi = 0; vi < 4; vi++) {
              const vd = face.verts[vi];
              qVerts.push({
                x: lx + vd.pos[0],
                y: y + vd.pos[1],
                z: lz + vd.pos[2],
                u: vd.uv[0] === 0 ? uvRect.u0 : uvRect.u1,
                v: vd.uv[1] === 0 ? uvRect.v0 : uvRect.v1,
                r: shade,
                g: shade,
                b: shade,
                sky,
                blk,
                extra: isLava ? 0.0 : (vd.pos[1] === 1 ? waveFlag : 0.0),
              });
            }
            builder.pushQuad(qVerts[0], qVerts[1], qVerts[2], qVerts[3], false);
          }
          continue;
        }

        // 4. Standard Solid / Cutout Cubes (Stone, Grass, Logs, Leaves, Glass, Bed, etc.)
        const swayVal = def.tintType === 'leaf' ? 0.42 : 0.0;
        const heightScale = id === BLOCK.BED ? 0.5625 : 1.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const fx = wx + face.dir[0];
          const fy = y + face.dir[1];
          const fz = wz + face.dir[2];
          const nbId = getBlockFast(fx, fy, fz);

          if (id !== BLOCK.BED) {
            if (nbId === id && (def.opaque || id === BLOCK.GLASS)) continue;
            const nbDef = REGISTRY[nbId];
            if (nbDef && nbDef.opaque && nbId !== BLOCK.BED) continue;
          } else if (face.name === 'bottom') {
            const nbDef = REGISTRY[nbId];
            if (nbDef && nbDef.opaque) continue;
          }

          const texName = getFaceTextureName(def, face.name);
          const uvRect = uvMap[texName] || uvMap.stone;

          let tintR = 1.0, tintG = 1.0, tintB = 1.0;
          if (def.tintType === 'grass_top' && face.name === 'top') {
            tintR = biome.grassTint[0];
            tintG = biome.grassTint[1];
            tintB = biome.grassTint[2];
          } else if (def.tintType === 'leaf') {
            tintR = biome.leafTint[0];
            tintG = biome.leafTint[1];
            tintB = biome.leafTint[2];
          }

          const qVerts = [];
          const aoScores = [];

          for (let vi = 0; vi < 4; vi++) {
            const vd = face.verts[vi];

            // Sample 4 cells in front plane for smooth AO & smooth lighting
            const s1x = fx + vd.t1[0], s1y = fy + vd.t1[1], s1z = fz + vd.t1[2];
            const s2x = fx + vd.t2[0], s2y = fy + vd.t2[1], s2z = fz + vd.t2[2];
            const cx = fx + vd.t1[0] + vd.t2[0];
            const cy = fy + vd.t1[1] + vd.t2[1];
            const cz = fz + vd.t1[2] + vd.t2[2];

            const b1 = getBlockFast(s1x, s1y, s1z);
            const b2 = getBlockFast(s2x, s2y, s2z);
            const bc = getBlockFast(cx, cy, cz);

            const o1 = isAOOccluder(b1) ? 1 : 0;
            const o2 = isAOOccluder(b2) ? 1 : 0;
            const oc = isAOOccluder(bc) ? 1 : 0;

            const occLevel = (o1 && o2) ? 3 : (o1 + o2 + oc);
            const ao = def.light >= 10 ? 1.0 : AO_CURVE[occLevel];
            aoScores.push(ao);

            // Average skylight & blocklight across open neighbor cells
            let skySum = 0;
            let blkSum = 0;
            let samples = 0;

            const accumLight = (sx, sy, sz, bid) => {
              const bDef = REGISTRY[bid];
              if (bDef && bDef.opaque) return;
              const pl = getLightFast(sx, sy, sz);
              skySum += (pl >> 4) & 0x0f;
              blkSum += pl & 0x0f;
              samples++;
            };

            accumLight(fx, fy, fz, nbId);
            if (!(o1 && o2)) {
              if (!o1) accumLight(s1x, s1y, s1z, b1);
              if (!o2) accumLight(s2x, s2y, s2z, b2);
              if (!oc) accumLight(cx, cy, cz, bc);
            }

            let vSky = samples > 0 ? (skySum / samples) / 15.0 : 0.0;
            let vBlk = samples > 0 ? (blkSum / samples) / 15.0 : 0.0;
            if (def.light > 0) {
              vBlk = Math.max(vBlk, def.light / 15.0);
            }

            const shade = face.shade * ao;
            qVerts.push({
              x: lx + vd.pos[0],
              y: y + vd.pos[1] * heightScale,
              z: lz + vd.pos[2],
              u: vd.uv[0] === 0 ? uvRect.u0 : uvRect.u1,
              v: vd.uv[1] === 0 ? uvRect.v0 : (heightScale < 1 && face.dir[1] === 0
                ? uvRect.v0 + (uvRect.v1 - uvRect.v0) * heightScale
                : uvRect.v1),
              r: tintR * shade,
              g: tintG * shade,
              b: tintB * shade,
              sky: vSky,
              blk: vBlk,
              extra: swayVal,
            });
          }

          const flipDiag = (aoScores[0] + aoScores[2]) < (aoScores[1] + aoScores[3]);
          solidBuilder.pushQuad(qVerts[0], qVerts[1], qVerts[2], qVerts[3], flipDiag);
        }
      }
    }
  }

  return {
    solidGeo: solidBuilder.toBufferGeometry(),
    fluidGeo: fluidBuilder.toBufferGeometry(),
  };
}

function emitCrossPlant(builder, lx, y, lz, uvRect, r, g, b, sky, blk) {
  const planes = [
    [0.14, 0.14, 0.86, 0.86],
    [0.14, 0.86, 0.86, 0.14],
  ];
  for (const [x0, z0, x1, z1] of planes) {
    const a = { x: lx + x0, y, z: lz + z0, u: uvRect.u0, v: uvRect.v0, r, g, b, sky, blk, extra: 0.0 };
    const bV = { x: lx + x1, y, z: lz + z1, u: uvRect.u1, v: uvRect.v0, r, g, b, sky, blk, extra: 0.0 };
    const c = { x: lx + x1, y: y + 0.92, z: lz + z1, u: uvRect.u1, v: uvRect.v1, r, g, b, sky, blk, extra: 1.0 };
    const d = { x: lx + x0, y: y + 0.92, z: lz + z0, u: uvRect.u0, v: uvRect.v1, r, g, b, sky, blk, extra: 1.0 };
    // Front & back so plant is visible from every angle in single FrontSide pass
    builder.pushQuad(a, bV, c, d, false);
    builder.pushQuad(bV, a, d, c, false);
  }
}

function emitTorchMesh(builder, lx, y, lz, uvRect, sky, blk) {
  // Slim central wooden post with glowing flame tip using middle columns of torch tile
  const uMid0 = uvRect.u0 + (uvRect.u1 - uvRect.u0) * 0.42;
  const uMid1 = uvRect.u0 + (uvRect.u1 - uvRect.u0) * 0.58;
  const vTop = uvRect.v0 + (uvRect.v1 - uvRect.v0) * 0.82;

  const x0 = lx + 0.43, x1 = lx + 0.57;
  const z0 = lz + 0.43, z1 = lz + 0.57;
  const y0 = y, y1 = y + 0.65;

  const mk = (x, py, z, u, v, sh = 1.0) => ({
    x, y: py, z, u, v, r: sh, g: sh, b: sh, sky, blk, extra: 0.0,
  });

  // +Z
  builder.pushQuad(mk(x0, y0, z1, uMid0, uvRect.v0), mk(x1, y0, z1, uMid1, uvRect.v0), mk(x1, y1, z1, uMid1, vTop), mk(x0, y1, z1, uMid0, vTop));
  // -Z
  builder.pushQuad(mk(x1, y0, z0, uMid0, uvRect.v0), mk(x0, y0, z0, uMid1, uvRect.v0), mk(x0, y1, z0, uMid1, vTop), mk(x1, y1, z0, uMid0, vTop));
  // +X
  builder.pushQuad(mk(x1, y0, z1, uMid0, uvRect.v0), mk(x1, y0, z0, uMid1, uvRect.v0), mk(x1, y1, z0, uMid1, vTop), mk(x1, y1, z1, uMid0, vTop));
  // -X
  builder.pushQuad(mk(x0, y0, z0, uMid0, uvRect.v0), mk(x0, y0, z1, uMid1, uvRect.v0), mk(x0, y1, z1, uMid1, vTop), mk(x0, y1, z0, uMid0, vTop));
  // Top glowing ember cap
  const vFlame0 = uvRect.v0 + (uvRect.v1 - uvRect.v0) * 0.68;
  builder.pushQuad(mk(x0, y1, z1, uMid0, vFlame0, 1.1), mk(x1, y1, z1, uMid1, vFlame0, 1.1), mk(x1, y1, z0, uMid1, vTop, 1.1), mk(x0, y1, z0, uMid0, vTop, 1.1));
}
