import * as THREE from 'three';
import { BLOCK, REGISTRY, isOpaqueBlock } from '../constants/Blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT, BIOME_TINTS, BIOME } from './WorldGen.js';

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

// 6 Cube Face definitions with verified CCW outward normals & top-aligned UVs
const FACES = [
  {
    key: 'top',
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 1], t1: [-1, 0, 0], t2: [0, 0, 1] },
      { pos: [1, 1, 1], uv: [1, 1], t1: [1, 0, 0], t2: [0, 0, 1] },
      { pos: [1, 1, 0], uv: [1, 0], t1: [1, 0, 0], t2: [0, 0, -1] },
      { pos: [0, 1, 0], uv: [0, 0], t1: [-1, 0, 0], t2: [0, 0, -1] },
    ],
  },
  {
    key: 'bottom',
    dir: [0, -1, 0],
    shade: 0.54,
    corners: [
      { pos: [0, 0, 0], uv: [0, 1], t1: [-1, 0, 0], t2: [0, 0, -1] },
      { pos: [1, 0, 0], uv: [1, 1], t1: [1, 0, 0], t2: [0, 0, -1] },
      { pos: [1, 0, 1], uv: [1, 0], t1: [1, 0, 0], t2: [0, 0, 1] },
      { pos: [0, 0, 1], uv: [0, 0], t1: [-1, 0, 0], t2: [0, 0, 1] },
    ],
  },
  {
    key: 'front', // +Z
    dir: [0, 0, 1],
    shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 1], t1: [-1, 0, 0], t2: [0, -1, 0] },
      { pos: [1, 0, 1], uv: [1, 1], t1: [1, 0, 0], t2: [0, -1, 0] },
      { pos: [1, 1, 1], uv: [1, 0], t1: [1, 0, 0], t2: [0, 1, 0] },
      { pos: [0, 1, 1], uv: [0, 0], t1: [-1, 0, 0], t2: [0, 1, 0] },
    ],
  },
  {
    key: 'back', // -Z
    dir: [0, 0, -1],
    shade: 0.82,
    corners: [
      { pos: [1, 0, 0], uv: [0, 1], t1: [1, 0, 0], t2: [0, -1, 0] },
      { pos: [0, 0, 0], uv: [1, 1], t1: [-1, 0, 0], t2: [0, -1, 0] },
      { pos: [0, 1, 0], uv: [1, 0], t1: [-1, 0, 0], t2: [0, 1, 0] },
      { pos: [1, 1, 0], uv: [0, 0], t1: [1, 0, 0], t2: [0, 1, 0] },
    ],
  },
  {
    key: 'right', // +X
    dir: [1, 0, 0],
    shade: 0.74,
    corners: [
      { pos: [1, 0, 1], uv: [0, 1], t1: [0, 0, 1], t2: [0, -1, 0] },
      { pos: [1, 0, 0], uv: [1, 1], t1: [0, 0, -1], t2: [0, -1, 0] },
      { pos: [1, 1, 0], uv: [1, 0], t1: [0, 0, -1], t2: [0, 1, 0] },
      { pos: [1, 1, 1], uv: [0, 0], t1: [0, 0, 1], t2: [0, 1, 0] },
    ],
  },
  {
    key: 'left', // -X
    dir: [-1, 0, 0],
    shade: 0.72,
    corners: [
      { pos: [0, 0, 0], uv: [0, 1], t1: [0, 0, -1], t2: [0, -1, 0] },
      { pos: [0, 0, 1], uv: [1, 1], t1: [0, 0, 1], t2: [0, -1, 0] },
      { pos: [0, 1, 1], uv: [1, 0], t1: [0, 0, 1], t2: [0, 1, 0] },
      { pos: [0, 1, 0], uv: [0, 0], t1: [0, 0, -1], t2: [0, 1, 0] },
    ],
  },
];

function createBufferBuilder() {
  return {
    positions: [],
    uvs: [],
    colors: [],
    lights: [],
    indices: [],
    vertCount: 0,
  };
}

function buildThreeGeometry(buf) {
  if (buf.vertCount === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geom.setAttribute('aColor', new THREE.Float32BufferAttribute(buf.colors, 3));
  geom.setAttribute('aLight', new THREE.Float32BufferAttribute(buf.lights, 2));
  geom.setIndex(buf.indices);
  geom.computeBoundingSphere();
  return geom;
}

export function buildChunkGeometries(world, chunk, uvMap) {
  const solidBuf = createBufferBuilder();
  const waterBuf = createBufferBuilder();

  const cx = chunk.cx;
  const cz = chunk.cz;
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  const isAoOccluder = (wx, wy, wz) => {
    const id = world.getBlock(wx, wy, wz);
    const def = REGISTRY[id];
    return Boolean(def && def.solid && def.renderType === 'cube' && id !== BLOCK.GLASS);
  };

  const sampleSmoothLight = (fx, fy, fz, t1, t2) => {
    let skySum = world.getSkyLight(fx, fy, fz);
    let blkSum = world.getVoxelLight(fx, fy, fz);
    let count = 1;

    const s1x = fx + t1[0], s1y = fy + t1[1], s1z = fz + t1[2];
    const s2x = fx + t2[0], s2y = fy + t2[1], s2z = fz + t2[2];
    const o1 = isOpaqueBlock(world.getBlock(s1x, s1y, s1z));
    const o2 = isOpaqueBlock(world.getBlock(s2x, s2y, s2z));

    if (!o1) {
      skySum += world.getSkyLight(s1x, s1y, s1z);
      blkSum += world.getVoxelLight(s1x, s1y, s1z);
      count++;
    }
    if (!o2) {
      skySum += world.getSkyLight(s2x, s2y, s2z);
      blkSum += world.getVoxelLight(s2x, s2y, s2z);
      count++;
    }
    if (!(o1 && o2)) {
      const cx2 = fx + t1[0] + t2[0];
      const cy2 = fy + t1[1] + t2[1];
      const cz2 = fz + t1[2] + t2[2];
      if (!isOpaqueBlock(world.getBlock(cx2, cy2, cz2))) {
        skySum += world.getSkyLight(cx2, cy2, cz2);
        blkSum += world.getVoxelLight(cx2, cy2, cz2);
        count++;
      }
    }

    return [skySum / (15 * count), blkSum / (15 * count)];
  };

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.getLocal(lx, y, lz);
        if (id === BLOCK.AIR) continue;

        const def = REGISTRY[id];
        if (!def) continue;
        const wx = baseX + lx;
        const biome = chunk.biomes[lz * CHUNK_SIZE + lx] || BIOME.PLAINS;
        const biomeTint = BIOME_TINTS[biome] || [1, 1, 1];

        // 1. Cross-quad flora (flowers, tall grass, cave mushrooms, shrubs)
        if (def.renderType === 'cross') {
          emitCrossMesh(solidBuf, lx, y, lz, wx, wz, def, biomeTint, uvMap, world);
          continue;
        }

        // 2. Slim 3D Torch or Lantern
        if (def.renderType === 'torch' || def.renderType === 'lantern') {
          emitInsetBox(
            solidBuf,
            lx,
            y,
            lz,
            wx,
            wz,
            def,
            uvMap,
            world,
            def.renderType === 'torch' ? [0.40, 0.0, 0.40, 0.60, 0.65, 0.60] : [0.28, 0.0, 0.28, 0.72, 0.76, 0.72]
          );
          continue;
        }

        // 3. Translucent Water
        if (def.renderType === 'liquid') {
          const aboveIsWater = world.getBlock(wx, y + 1, wz) === BLOCK.WATER;
          const topY = aboveIsWater ? 1.0 : 0.88;
          const uv = uvMap[def.textures.all];
          const sky = world.getSkyLight(wx, y + 1, wz) / 15;
          const blk = world.getVoxelLight(wx, y + 1, wz) / 15;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];
            const neighbor = world.getBlock(nx, ny, nz);
            if (neighbor === BLOCK.WATER || isOpaqueBlock(neighbor)) continue;

            const baseV = waterBuf.vertCount;
            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              const py = c.pos[1] === 1 ? topY : 0;
              waterBuf.positions.push(lx + c.pos[0], y + py, lz + c.pos[2]);
              waterBuf.uvs.push(c.uv[0] ? uv.u1 : uv.u0, c.uv[1] ? uv.v1 : uv.v0);
              waterBuf.colors.push(face.shade, face.shade, face.shade);
              waterBuf.lights.push(sky, blk);
            }
            waterBuf.indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
            waterBuf.vertCount += 4;
          }
          continue;
        }

        // 4. Standard Cube Blocks (Opaque + Cutout Leaves/Glass/Ice)
        for (const face of FACES) {
          const fx = wx + face.dir[0];
          const fy = y + face.dir[1];
          const fz = wz + face.dir[2];
          const neighbor = world.getBlock(fx, fy, fz);

          if (neighbor !== BLOCK.AIR) {
            if (isOpaqueBlock(neighbor)) continue;
            // Cull identical adjacent glass or ice faces so multi-block windows look crystal clear
            if ((id === BLOCK.GLASS || id === BLOCK.ICE) && neighbor === id) continue;
          }

          const texKey =
            (face.key === 'top' && def.textures.top) ||
            (face.key === 'bottom' && def.textures.bottom) ||
            (face.key === 'front' && def.textures.front) ||
            def.textures.side ||
            def.textures.all;
          const uv = uvMap[texKey] || uvMap.stone;

          const applyTint = def.tintAll || (def.tintTop && face.key === 'top');
          const tr = applyTint ? biomeTint[0] : 1.0;
          const tg = applyTint ? biomeTint[1] : 1.0;
          const tb = applyTint ? biomeTint[2] : 1.0;

          const baseV = solidBuf.vertCount;
          const aos = [3, 3, 3, 3];

          for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            const s1 = isAoOccluder(fx + c.t1[0], fy + c.t1[1], fz + c.t1[2]) ? 1 : 0;
            const s2 = isAoOccluder(fx + c.t2[0], fy + c.t2[1], fz + c.t2[2]) ? 1 : 0;
            const cn = (s1 && s2)
              ? 1
              : (isAoOccluder(fx + c.t1[0] + c.t2[0], fy + c.t1[1] + c.t2[1], fz + c.t1[2] + c.t2[2]) ? 1 : 0);

            const aoIdx = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
            aos[i] = aoIdx;
            const shade = face.shade * AO_CURVE[aoIdx];

            solidBuf.positions.push(lx + c.pos[0], y + c.pos[1], lz + c.pos[2]);
            solidBuf.uvs.push(c.uv[0] ? uv.u1 : uv.u0, c.uv[1] ? uv.v1 : uv.v0);
            solidBuf.colors.push(tr * shade, tg * shade, tb * shade);

            const [skyL, blkL] = sampleSmoothLight(fx, fy, fz, c.t1, c.t2);
            const selfGlow = (def.light || 0) / 15;
            solidBuf.lights.push(skyL, Math.max(blkL, selfGlow));
          }

          // Flip quad diagonal when needed to prevent smooth AO interpolation artifacts
          if (aos[0] + aos[2] < aos[1] + aos[3]) {
            solidBuf.indices.push(baseV + 1, baseV + 2, baseV + 3, baseV + 1, baseV + 3, baseV);
          } else {
            solidBuf.indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
          }
          solidBuf.vertCount += 4;
        }
      }
    }
  }

  return {
    solidGeometry: buildThreeGeometry(solidBuf),
    waterGeometry: buildThreeGeometry(waterBuf),
  };
}

function emitCrossMesh(buf, lx, y, lz, wx, wz, def, biomeTint, uvMap, world) {
  const uv = uvMap[def.textures.all];
  const sky = world.getSkyLight(wx, y, wz) / 15;
  const blk = Math.max(world.getVoxelLight(wx, y, wz), def.light || 0) / 15;
  const tr = def.tintAll ? biomeTint[0] * 0.92 : 0.94;
  const tg = def.tintAll ? biomeTint[1] * 0.92 : 0.94;
  const tb = def.tintAll ? biomeTint[2] * 0.92 : 0.94;

  // Slight deterministic offset so wildflowers & grass blades don't sit on a rigid grid
  const jitterX = (((wx * 73856093) ^ (wz * 19349663)) & 15) / 15 * 0.18 - 0.09;
  const jitterZ = (((wx * 83492791) ^ (wz * 29712150)) & 15) / 15 * 0.18 - 0.09;

  const quads = [
    [[0.12, 0, 0.12], [0.88, 0, 0.88], [0.88, 0.94, 0.88], [0.12, 0.94, 0.12]],
    [[0.88, 0, 0.88], [0.12, 0, 0.12], [0.12, 0.94, 0.12], [0.88, 0.94, 0.88]],
    [[0.12, 0, 0.88], [0.88, 0, 0.12], [0.88, 0.94, 0.12], [0.12, 0.94, 0.88]],
    [[0.88, 0, 0.12], [0.12, 0, 0.88], [0.12, 0.94, 0.88], [0.88, 0.94, 0.12]],
  ];
  const uvs = [[uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v0]];

  for (const q of quads) {
    const baseV = buf.vertCount;
    for (let i = 0; i < 4; i++) {
      buf.positions.push(lx + q[i][0] + jitterX, y + q[i][1], lz + q[i][2] + jitterZ);
      buf.uvs.push(uvs[i][0], uvs[i][1]);
      buf.colors.push(tr, tg, tb);
      buf.lights.push(sky, blk);
    }
    buf.indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
    buf.vertCount += 4;
  }
}

function emitInsetBox(buf, lx, y, lz, wx, wz, def, uvMap, world, bounds) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const uv = uvMap[def.textures.all];
  const sky = world.getSkyLight(wx, y, wz) / 15;
  const blk = Math.max(world.getVoxelLight(wx, y, wz), def.light || 0) / 15;

  const boxFaces = [
    { shade: 1.0, pts: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
    { shade: 0.7, pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { shade: 0.95, pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { shade: 0.95, pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { shade: 0.9, pts: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },
    { shade: 0.9, pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
  ];
  const uvs = [[uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v0]];

  for (const f of boxFaces) {
    const baseV = buf.vertCount;
    for (let i = 0; i < 4; i++) {
      buf.positions.push(lx + f.pts[i][0], y + f.pts[i][1], lz + f.pts[i][2]);
      buf.uvs.push(uvs[i][0], uvs[i][1]);
      buf.colors.push(f.shade, f.shade, f.shade);
      buf.lights.push(sky, blk);
    }
    buf.indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
    buf.vertCount += 4;
  }
}
