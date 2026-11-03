import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants.js';
import { BLOCK, getDef, isOpaqueBlock } from '../blocks.js';

const FACES = [
  {
    dir: 'top',
    normal: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], ao: [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]] },
      { pos: [1, 1, 1], uv: [1, 0], ao: [[1, 1, 0], [0, 1, 1], [1, 1, 1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 1, 0], [0, 1, -1], [1, 1, -1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]] },
    ],
  },
  {
    dir: 'bottom',
    normal: [0, -1, 0],
    shade: 0.55,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, -1, 0], [0, -1, -1], [1, -1, -1]] },
      { pos: [1, 0, 1], uv: [1, 1], ao: [[1, -1, 0], [0, -1, 1], [1, -1, 1]] },
      { pos: [0, 0, 1], uv: [0, 1], ao: [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]] },
    ],
  },
  {
    dir: 'side', // +Z
    normal: [0, 0, 1],
    shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], ao: [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]] },
      { pos: [1, 0, 1], uv: [1, 0], ao: [[1, 0, 1], [0, -1, 1], [1, -1, 1]] },
      { pos: [1, 1, 1], uv: [1, 1], ao: [[1, 0, 1], [0, 1, 1], [1, 1, 1]] },
      { pos: [0, 1, 1], uv: [0, 1], ao: [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]] },
    ],
  },
  {
    dir: 'side', // -Z
    normal: [0, 0, -1],
    shade: 0.86,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], ao: [[1, 0, -1], [0, -1, -1], [1, -1, -1]] },
      { pos: [0, 0, 0], uv: [1, 0], ao: [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]] },
      { pos: [0, 1, 0], uv: [1, 1], ao: [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]] },
      { pos: [1, 1, 0], uv: [0, 1], ao: [[1, 0, -1], [0, 1, -1], [1, 1, -1]] },
    ],
  },
  {
    dir: 'side', // +X
    normal: [1, 0, 0],
    shade: 0.74,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], ao: [[1, 0, 1], [1, -1, 0], [1, -1, 1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, 0, -1], [1, -1, 0], [1, -1, -1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 0, -1], [1, 1, 0], [1, 1, -1]] },
      { pos: [1, 1, 1], uv: [0, 1], ao: [[1, 0, 1], [1, 1, 0], [1, 1, 1]] },
    ],
  },
  {
    dir: 'side', // -X
    normal: [-1, 0, 0],
    shade: 0.74,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]] },
      { pos: [0, 0, 1], uv: [1, 0], ao: [[-1, 0, 1], [-1, -1, 0], [-1, -1, 1]] },
      { pos: [0, 1, 1], uv: [1, 1], ao: [[-1, 0, 1], [-1, 1, 0], [-1, 1, 1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 0, -1], [-1, 1, 0], [-1, 1, -1]] },
    ],
  },
];

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

class LayerBuilder {
  constructor(withSway = true) {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.lights = [];
    this.sways = [];
    this.indices = [];
    this.vertexCount = 0;
    this.withSway = withSway;
  }

  pushQuad(verts, flipDiag = false) {
    const base = this.vertexCount;
    for (let i = 0; i < 4; i++) {
      const v = verts[i];
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(v.nx, v.ny, v.nz);
      this.uvs.push(v.u, v.v);
      this.lights.push(v.shadeAO, v.sky, v.block);
      if (this.withSway) this.sways.push(v.sway || 0);
    }
    if (flipDiag) {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base + 0);
    } else {
      this.indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    }
    this.vertexCount += 4;
  }

  toGeometry() {
    if (this.vertexCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 3));
    if (this.withSway) {
      geom.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sways, 1));
    }
    if (this.vertexCount > 65535) {
      geom.setIndex(new THREE.Uint32BufferAttribute(this.indices, 1));
    } else {
      geom.setIndex(new THREE.Uint16BufferAttribute(this.indices, 1));
    }
    geom.computeBoundingSphere();
    return geom;
  }
}

export function buildChunkGeometries(world, cx, cz, textureManager) {
  const solid = new LayerBuilder(true);
  const cutout = new LayerBuilder(true);
  const water = new LayerBuilder(false);

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  // Padded 18x18 column roof height cache for fast skylight estimation
  const padSize = CHUNK_SIZE + 4; // -2 .. CHUNK_SIZE+1
  const roof = new Int16Array(padSize * padSize);
  for (let pz = -2; pz < CHUNK_SIZE + 2; pz++) {
    for (let px = -2; px < CHUNK_SIZE + 2; px++) {
      const wx = baseX + px;
      const wz = baseZ + pz;
      let topY = 0;
      for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
        const id = world.getBlock(wx, y, wz);
        if (id !== BLOCK.AIR && !getDef(id).crossMesh && id !== BLOCK.WATER) {
          topY = y;
          break;
        }
      }
      roof[(pz + 2) * padSize + (px + 2)] = topY;
    }
  }

  const getRoof = (lx, lz) => {
    const px = Math.max(-2, Math.min(CHUNK_SIZE + 1, lx)) + 2;
    const pz = Math.max(-2, Math.min(CHUNK_SIZE + 1, lz)) + 2;
    return roof[pz * padSize + px];
  };

  // Collect nearby light emitters in [cx-1..cx+1, cz-1..cz+1]
  const emitters = world.getLightEmittersNearChunk(cx, cz);

  const sampleSkyLight = (lx, y, lz) => {
    if (y >= getRoof(lx, lz)) return 1.0;
    // Check immediate horizontal openings for soft overhang / cave mouth bounce
    let openNeighbors = 0;
    if (y >= getRoof(lx + 1, lz)) openNeighbors++;
    if (y >= getRoof(lx - 1, lz)) openNeighbors++;
    if (y >= getRoof(lx, lz + 1)) openNeighbors++;
    if (y >= getRoof(lx, lz - 1)) openNeighbors++;
    if (openNeighbors >= 2) return 0.82;
    if (openNeighbors === 1) return 0.62;

    let ring2 = 0;
    if (y + 1 >= getRoof(lx + 2, lz)) ring2++;
    if (y + 1 >= getRoof(lx - 2, lz)) ring2++;
    if (y + 1 >= getRoof(lx, lz + 2)) ring2++;
    if (y + 1 >= getRoof(lx, lz - 2)) ring2++;
    if (ring2 > 0) return 0.36;

    // Subtle depth falloff so shallow alcoves aren't pitch black
    const depth = getRoof(lx, lz) - y;
    if (depth <= 3) return 0.42;
    if (depth <= 7) return 0.18;
    return 0.04;
  };

  const sampleBlockLight = (wx, y, wz) => {
    if (emitters.length === 0) return 0.0;
    let best = 0.0;
    for (let i = 0; i < emitters.length; i++) {
      const e = emitters[i];
      const dx = wx - e.x;
      const dy = y - e.y;
      const dz = wz - e.z;
      const manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (manhattan > e.level) continue;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const val = Math.max(0, (e.level - dist * 1.05) / 15.0);
      if (val > best) best = val;
    }
    return Math.min(1.0, best);
  };

  const isOccludingAO = (wx, y, wz) => {
    const id = world.getBlock(wx, y, wz);
    if (id === BLOCK.AIR || id === BLOCK.WATER) return 0;
    const def = getDef(id);
    return (def.solid && !def.crossMesh) ? 1 : 0;
  };

  const chunk = world.getChunk(cx, cz);
  if (!chunk) return { solid: null, cutout: null, water: null };
  const voxels = chunk.voxels;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = voxels[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
        if (id === BLOCK.AIR) continue;

        const wx = baseX + lx;
        const def = getDef(id);

        // 1. Cross-quad flora & torches
        if (def.crossMesh) {
          const uv = textureManager.getBlockFaceUV(id, 'all');
          const sky = sampleSkyLight(lx, y, lz);
          const blk = def.light ? 1.0 : sampleBlockLight(wx + 0.5, y + 0.5, wz + 0.5);
          const topSway = def.isTorch ? 0.0 : 1.0;
          const shade = def.isTorch ? 1.0 : 0.92;

          // Slight deterministic offset for organic wildflower/grass placement
          const jx = def.isTorch ? 0 : (((wx * 73 + wz * 37) & 7) - 3.5) * 0.035;
          const jz = def.isTorch ? 0 : (((wx * 29 - wz * 53) & 7) - 3.5) * 0.035;

          const pad = def.isTorch ? 0.06 : 0.08;
          const x0 = lx + pad + jx, x1 = lx + 1 - pad + jx;
          const z0 = lz + pad + jz, z1 = lz + 1 - pad + jz;

          cutout.pushQuad([
            { x: x0, y: y,     z: z0, nx: 0, ny: 1, nz: 0, u: uv.u0, v: uv.v0, shadeAO: shade, sky, block: blk, sway: 0 },
            { x: x1, y: y,     z: z1, nx: 0, ny: 1, nz: 0, u: uv.u1, v: uv.v0, shadeAO: shade, sky, block: blk, sway: 0 },
            { x: x1, y: y + 1, z: z1, nx: 0, ny: 1, nz: 0, u: uv.u1, v: uv.v1, shadeAO: shade, sky, block: blk, sway: topSway },
            { x: x0, y: y + 1, z: z0, nx: 0, ny: 1, nz: 0, u: uv.u0, v: uv.v1, shadeAO: shade, sky, block: blk, sway: topSway },
          ]);
          cutout.pushQuad([
            { x: x0, y: y,     z: z1, nx: 0, ny: 1, nz: 0, u: uv.u0, v: uv.v0, shadeAO: shade, sky, block: blk, sway: 0 },
            { x: x1, y: y,     z: z0, nx: 0, ny: 1, nz: 0, u: uv.u1, v: uv.v0, shadeAO: shade, sky, block: blk, sway: 0 },
            { x: x1, y: y + 1, z: z0, nx: 0, ny: 1, nz: 0, u: uv.u1, v: uv.v1, shadeAO: shade, sky, block: blk, sway: topSway },
            { x: x0, y: y + 1, z: z1, nx: 0, ny: 1, nz: 0, u: uv.u0, v: uv.v1, shadeAO: shade, sky, block: blk, sway: topSway },
          ]);
          continue;
        }

        // 2. Water blocks
        if (def.fluid) {
          for (let f = 0; f < FACES.length; f++) {
            const face = FACES[f];
            const nx = wx + face.normal[0];
            const ny = y + face.normal[1];
            const nz = wz + face.normal[2];
            if (ny < 0) continue;
            const neighbor = world.getBlock(nx, ny, nz);
            if (neighbor === BLOCK.WATER || isOpaqueBlock(neighbor)) continue;
            // Mainly render top surface & exposed waterfall sides
            if (face.dir === 'bottom' && neighbor !== BLOCK.AIR) continue;

            const uv = textureManager.getBlockFaceUV(id, face.dir);
            const sky = sampleSkyLight(lx + face.normal[0], ny, lz + face.normal[2]);
            const blk = sampleBlockLight(nx + 0.5, ny + 0.5, nz + 0.5);

            const verts = face.corners.map((c) => ({
              x: lx + c.pos[0],
              y: y + c.pos[1],
              z: lz + c.pos[2],
              nx: face.normal[0],
              ny: face.normal[1],
              nz: face.normal[2],
              u: c.uv[0] ? uv.u1 : uv.u0,
              v: c.uv[1] ? uv.v1 : uv.v0,
              shadeAO: face.shade,
              sky,
              block: blk,
            }));
            water.pushQuad(verts, false);
          }
          continue;
        }

        // 3. Solid & Cutout Cubes (Leaves, Glass, Terrain, Building Blocks)
        const targetBuilder = def.cutoutCube ? cutout : solid;
        const leafSway = (id === BLOCK.OAK_LEAVES || id === BLOCK.BIRCH_LEAVES || id === BLOCK.SPRUCE_LEAVES) ? 0.35 : 0.0;

        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const nx = wx + face.normal[0];
          const ny = y + face.normal[1];
          const nz = wz + face.normal[2];
          if (ny < 0) continue;

          const neighbor = world.getBlock(nx, ny, nz);
          if (isOpaqueBlock(neighbor)) continue;
          if (neighbor === id && id === BLOCK.GLASS) continue;

          const uv = textureManager.getBlockFaceUV(id, face.dir);
          const faceSky = sampleSkyLight(lx + face.normal[0], ny, lz + face.normal[2]);
          const selfGlow = def.light ? def.light / 15.0 : 0.0;
          const faceBlk = Math.max(selfGlow, sampleBlockLight(nx + 0.5, ny + 0.5, nz + 0.5));

          const aoVals = [3, 3, 3, 3];
          const verts = new Array(4);

          for (let ci = 0; ci < 4; ci++) {
            const c = face.corners[ci];
            let aoFactor = 1.0;
            if (!def.light) {
              const s1 = isOccludingAO(wx + c.ao[0][0], y + c.ao[0][1], wz + c.ao[0][2]);
              const s2 = isOccludingAO(wx + c.ao[1][0], y + c.ao[1][1], wz + c.ao[1][2]);
              const cr = isOccludingAO(wx + c.ao[2][0], y + c.ao[2][1], wz + c.ao[2][2]);
              const aoIdx = (s1 && s2) ? 0 : (3 - (s1 + s2 + cr));
              aoVals[ci] = aoIdx;
              aoFactor = AO_CURVE[aoIdx];
            }

            verts[ci] = {
              x: lx + c.pos[0],
              y: y + c.pos[1],
              z: lz + c.pos[2],
              nx: face.normal[0],
              ny: face.normal[1],
              nz: face.normal[2],
              u: c.uv[0] ? uv.u1 : uv.u0,
              v: c.uv[1] ? uv.v1 : uv.v0,
              shadeAO: def.light ? 1.0 : face.shade * aoFactor,
              sky: faceSky,
              block: faceBlk,
              sway: leafSway,
            };
          }

          const flipDiag = (aoVals[0] + aoVals[2]) < (aoVals[1] + aoVals[3]);
          targetBuilder.pushQuad(verts, flipDiag);
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
