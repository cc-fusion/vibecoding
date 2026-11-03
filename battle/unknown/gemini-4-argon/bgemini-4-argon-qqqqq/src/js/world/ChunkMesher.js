import * as THREE from 'three';
import { BLOCK_SHAPES, CHUNK_SIZE, MAX_LIGHT_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';

const FACES = [
  {
    name: 'top',
    dir: [0, 1, 0],
    shade: 1.0,
    verts: [
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
  {
    name: 'bottom',
    dir: [0, -1, 0],
    shade: 0.52,
    verts: [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 0, 1, 1, 1],
      [0, 0, 1, 0, 1],
    ],
  },
  {
    name: 'front', // +Z
    dir: [0, 0, 1],
    shade: 0.84,
    verts: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 1],
    ],
  },
  {
    name: 'side', // -Z
    dir: [0, 0, -1],
    shade: 0.84,
    verts: [
      [1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 1, 0, 1, 1],
      [1, 1, 0, 0, 1],
    ],
  },
  {
    name: 'side', // +X
    dir: [1, 0, 0],
    shade: 0.70,
    verts: [
      [1, 0, 1, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 0, 1],
    ],
  },
  {
    name: 'side', // -X
    dir: [-1, 0, 0],
    shade: 0.70,
    verts: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 1, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
];

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

class PassBuilder {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.colors = [];
    this.lights = [];
    this.indices = [];
    this.vertCount = 0;
  }

  pushQuad(v0, v1, v2, v3, uv0, uv1, uv2, uv3, c0, c1, c2, c3, l0, l1, l2, l3, flipDiag = false) {
    const base = this.vertCount;
    this.positions.push(
      v0[0], v0[1], v0[2],
      v1[0], v1[1], v1[2],
      v2[0], v2[1], v2[2],
      v3[0], v3[1], v3[2]
    );
    this.uvs.push(
      uv0[0], uv0[1],
      uv1[0], uv1[1],
      uv2[0], uv2[1],
      uv3[0], uv3[1]
    );
    this.colors.push(
      c0[0], c0[1], c0[2],
      c1[0], c1[1], c1[2],
      c2[0], c2[1], c2[2],
      c3[0], c3[1], c3[2]
    );
    this.lights.push(
      l0[0], l0[1],
      l1[0], l1[1],
      l2[0], l2[1],
      l3[0], l3[1]
    );

    if (flipDiag) {
      this.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
    } else {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    this.vertCount += 4;
  }

  toGeometry() {
    if (this.vertCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 2));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

export class ChunkMesher {
  constructor(atlas) {
    this.atlas = atlas;
  }

  buildChunkMeshes(chunk, world, materials, scene) {
    const opaqueBuilder = new PassBuilder();
    const cutoutBuilder = new PassBuilder();
    const transBuilder = new PassBuilder();

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    const isAoOccluder = (wx, wy, wz) => {
      const id = world.getBlock(wx, wy, wz);
      const b = BLOCKS[id];
      return b ? b.opaque : false;
    };

    const sampleVertexAOAndLight = (wx, wy, wz, dir, vx, vy, vz) => {
      const nx = wx + dir[0];
      const ny = wy + dir[1];
      const nz = wz + dir[2];

      const sx = vx === 0 ? -1 : 1;
      const sy = vy === 0 ? -1 : 1;
      const sz = vz === 0 ? -1 : 1;

      let s1x = nx, s1y = ny, s1z = nz;
      let s2x = nx, s2y = ny, s2z = nz;
      let cx = nx, cy = ny, cz = nz;

      if (dir[0] !== 0) {
        s1y += sy;
        s2z += sz;
        cy += sy; cz += sz;
      } else if (dir[1] !== 0) {
        s1x += sx;
        s2z += sz;
        cx += sx; cz += sz;
      } else {
        s1x += sx;
        s2y += sy;
        cx += sx; cy += sy;
      }

      const side1 = isAoOccluder(s1x, s1y, s1z) ? 1 : 0;
      const side2 = isAoOccluder(s2x, s2y, s2z) ? 1 : 0;
      const corner = isAoOccluder(cx, cy, cz) ? 1 : 0;

      const aoLevel = (side1 && side2) ? 0 : (3 - (side1 + side2 + corner));

      // Smooth vertex lighting averaged across open neighbors around this corner
      let skySum = world.getSkyLight(nx, ny, nz);
      let blkSum = world.getBlockLight(nx, ny, nz);
      let samples = 1;

      if (!side1) {
        skySum += world.getSkyLight(s1x, s1y, s1z);
        blkSum += world.getBlockLight(s1x, s1y, s1z);
        samples++;
      }
      if (!side2) {
        skySum += world.getSkyLight(s2x, s2y, s2z);
        blkSum += world.getBlockLight(s2x, s2y, s2z);
        samples++;
      }
      if (!(side1 && side2) && !corner) {
        skySum += world.getSkyLight(cx, cy, cz);
        blkSum += world.getBlockLight(cx, cy, cz);
        samples++;
      }

      return {
        ao: AO_CURVE[aoLevel],
        aoLevel,
        sky: (skySum / samples) / MAX_LIGHT_LEVEL,
        blk: (blkSum / samples) / MAX_LIGHT_LEVEL,
      };
    };

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.voxels[(y << 8) | (lz << 4) | lx];
          if (id === BLOCK.AIR) continue;

          const def = BLOCKS[id];
          if (!def) continue;

          const wx = baseX + lx;
          const colIdx3 = ((lz << 4) | lx) * 3;

          // Cross-quad flora (Flowers, Tall Grass, Mushrooms, Dead Bush)
          if (def.shape === BLOCK_SHAPES.CROSS) {
            this._emitCross(cutoutBuilder, chunk, world, lx, y, lz, wx, wz, def, colIdx3);
            continue;
          }

          // 3D Torch post
          if (def.shape === BLOCK_SHAPES.TORCH) {
            this._emitTorch(cutoutBuilder, world, lx, y, lz, wx, wz, def);
            continue;
          }

          const targetBuilder = def.translucent
            ? transBuilder
            : def.cutout
              ? cutoutBuilder
              : opaqueBuilder;

          const isWater = id === BLOCK.WATER;
          const topLowered = isWater && world.getBlock(wx, y + 1, wz) !== BLOCK.WATER;
          const isBed = def.shape === BLOCK_SHAPES.SLAB_BED;
          const isCactus = def.shape === BLOCK_SHAPES.CACTUS;
          const inset = isCactus ? 0.0625 : 0.0;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nbx = wx + face.dir[0];
            const nby = y + face.dir[1];
            const nbz = wz + face.dir[2];

            const neighborId = world.getBlock(nbx, nby, nbz);
            const neighborDef = BLOCKS[neighborId];

            // Face visibility culling rules
            if (!isCactus && !isBed) {
              if (isWater) {
                if (neighborId === BLOCK.WATER) continue;
                if (neighborDef && neighborDef.opaque && face.name !== 'top') continue;
              } else if (def.translucent || id === BLOCK.GLASS) {
                if (neighborId === id) continue;
                if (neighborDef && neighborDef.opaque) continue;
              } else if (def.cutout) {
                if (neighborDef && neighborDef.opaque) continue;
              } else {
                // Opaque block
                if (neighborDef && neighborDef.opaque) continue;
              }
            } else if (isBed && face.name === 'bottom' && neighborDef && neighborDef.opaque) {
              continue;
            }

            const uvRect = this.atlas.getBlockFaceUV(id, face.name);

            // Biome tinting
            let tr = 1.0, tg = 1.0, tb = 1.0;
            if ((def.tintTop === 'grass' && face.name === 'top') || def.tintAll === 'grass') {
              tr = chunk.grassTint[colIdx3];
              tg = chunk.grassTint[colIdx3 + 1];
              tb = chunk.grassTint[colIdx3 + 2];
            } else if (def.tintAll === 'foliage') {
              tr = chunk.foliageTint[colIdx3];
              tg = chunk.foliageTint[colIdx3 + 1];
              tb = chunk.foliageTint[colIdx3 + 2];
            } else if (def.tintAll === 'birch') {
              tr = 0.50; tg = 0.78; tb = 0.36;
            }

            const posVerts = [];
            const uvVerts = [];
            const colVerts = [];
            const lightVerts = [];
            const aoLevels = [];

            for (let vi = 0; vi < 4; vi++) {
              const vd = face.verts[vi];
              let vx = vd[0];
              let vy = vd[1];
              let vz = vd[2];

              if (topLowered && vy === 1) vy = 0.88;
              if (isBed && vy === 1) vy = 0.56;
              if (isCactus) {
                if (face.dir[0] !== 0) vx = vx === 0 ? inset : 1 - inset;
                if (face.dir[2] !== 0) vz = vz === 0 ? inset : 1 - inset;
              }

              posVerts.push([lx + vx, y + vy, lz + vz]);
              uvVerts.push([
                vd[3] === 0 ? uvRect.u0 : uvRect.u1,
                vd[4] === 0 ? uvRect.v0 : uvRect.v1,
              ]);

              if (def.lightLevel >= 14) {
                // Emissive block like Glowstone stays bright on its own surface
                colVerts.push([tr * face.shade, tg * face.shade, tb * face.shade]);
                lightVerts.push([world.getSkyLight(nbx, nby, nbz) / MAX_LIGHT_LEVEL, 1.0]);
                aoLevels.push(3);
              } else {
                const sample = sampleVertexAOAndLight(wx, y, wz, face.dir, vd[0], vd[1], vd[2]);
                const shade = sample.ao * face.shade;
                colVerts.push([tr * shade, tg * shade, tb * shade]);
                lightVerts.push([sample.sky, Math.max(sample.blk, def.lightLevel / MAX_LIGHT_LEVEL)]);
                aoLevels.push(sample.aoLevel);
              }
            }

            const flip = aoLevels[0] + aoLevels[2] < aoLevels[1] + aoLevels[3];
            targetBuilder.pushQuad(
              posVerts[0], posVerts[1], posVerts[2], posVerts[3],
              uvVerts[0], uvVerts[1], uvVerts[2], uvVerts[3],
              colVerts[0], colVerts[1], colVerts[2], colVerts[3],
              lightVerts[0], lightVerts[1], lightVerts[2], lightVerts[3],
              flip
            );
          }
        }
      }
    }

    // Replace Three.js meshes cleanly
    chunk.disposeMeshes(scene);

    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    const opaqueGeo = opaqueBuilder.toGeometry();
    if (opaqueGeo) {
      const m = new THREE.Mesh(opaqueGeo, materials.opaque);
      m.position.set(worldX, 0, worldZ);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      chunk.opaqueMesh = m;
    }

    const cutoutGeo = cutoutBuilder.toGeometry();
    if (cutoutGeo) {
      const m = new THREE.Mesh(cutoutGeo, materials.cutout);
      m.position.set(worldX, 0, worldZ);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      chunk.cutoutMesh = m;
    }

    const transGeo = transBuilder.toGeometry();
    if (transGeo) {
      const m = new THREE.Mesh(transGeo, materials.translucent);
      m.position.set(worldX, 0, worldZ);
      m.renderOrder = 2;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      chunk.translucentMesh = m;
    }

    chunk.dirty = false;
  }

  _emitCross(builder, chunk, world, lx, y, lz, wx, wz, def, colIdx3) {
    const uv = this.atlas.getBlockFaceUV(def.id, 'all');
    let tr = 1.0, tg = 1.0, tb = 1.0;
    if (def.tintAll === 'grass') {
      tr = chunk.grassTint[colIdx3];
      tg = chunk.grassTint[colIdx3 + 1];
      tb = chunk.grassTint[colIdx3 + 2];
    }
    const c = [tr * 0.92, tg * 0.92, tb * 0.92];
    const l = [
      world.getSkyLight(wx, y, wz) / MAX_LIGHT_LEVEL,
      world.getBlockLight(wx, y, wz) / MAX_LIGHT_LEVEL,
    ];

    const m = 0.08;
    const M = 0.92;
    builder.pushQuad(
      [lx + m, y, lz + m], [lx + M, y, lz + M], [lx + M, y + 0.95, lz + M], [lx + m, y + 0.95, lz + m],
      [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1],
      c, c, c, c, l, l, l, l
    );
    builder.pushQuad(
      [lx + m, y, lz + M], [lx + M, y, lz + m], [lx + M, y + 0.95, lz + m], [lx + m, y + 0.95, lz + M],
      [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1],
      c, c, c, c, l, l, l, l
    );
  }

  _emitTorch(builder, world, lx, y, lz, wx, wz, def) {
    const uv = this.atlas.getBlockFaceUV(def.id, 'all');
    const c = [1.0, 1.0, 1.0];
    const l = [world.getSkyLight(wx, y, wz) / MAX_LIGHT_LEVEL, 1.0];

    // Two orthogonal planes aligned through center (0.5, 0.5) so the 2px wide painted torch stick & flame look crisp from all angles
    builder.pushQuad(
      [lx, y, lz + 0.5], [lx + 1, y, lz + 0.5], [lx + 1, y + 1, lz + 0.5], [lx, y + 1, lz + 0.5],
      [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1],
      c, c, c, c, l, l, l, l
    );
    builder.pushQuad(
      [lx + 0.5, y, lz], [lx + 0.5, y, lz + 1], [lx + 0.5, y + 1, lz + 1], [lx + 0.5, y + 1, lz],
      [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1],
      c, c, c, c, l, l, l, l
    );
  }
}
