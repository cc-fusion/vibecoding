import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, RENDER_PASS, MESH_SHAPE } from '../constants.js';
import { BLOCK_IDS, getItemDef } from '../data/blocks.js';

const AO_CURVE = [0.46, 0.65, 0.83, 1.0];

// Precomputed face descriptors (CCW winding verified)
const CUBE_FACES = [
  {
    name: 'top',
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], s1: [-1, 1, 0], s2: [0, 1, 1], c: [-1, 1, 1] },
      { pos: [1, 1, 1], uv: [1, 0], s1: [1, 1, 0], s2: [0, 1, 1], c: [1, 1, 1] },
      { pos: [1, 1, 0], uv: [1, 1], s1: [1, 1, 0], s2: [0, 1, -1], c: [1, 1, -1] },
      { pos: [0, 1, 0], uv: [0, 1], s1: [-1, 1, 0], s2: [0, 1, -1], c: [-1, 1, -1] },
    ],
  },
  {
    name: 'bottom',
    dir: [0, -1, 0],
    shade: 0.52,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], s1: [-1, -1, 0], s2: [0, -1, -1], c: [-1, -1, -1] },
      { pos: [1, 0, 0], uv: [1, 0], s1: [1, -1, 0], s2: [0, -1, -1], c: [1, -1, -1] },
      { pos: [1, 0, 1], uv: [1, 1], s1: [1, -1, 0], s2: [0, -1, 1], c: [1, -1, 1] },
      { pos: [0, 0, 1], uv: [0, 1], s1: [-1, -1, 0], s2: [0, -1, 1], c: [-1, -1, 1] },
    ],
  },
  {
    name: 'pz',
    dir: [0, 0, 1],
    shade: 0.84,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], s1: [-1, 0, 1], s2: [0, -1, 1], c: [-1, -1, 1] },
      { pos: [1, 0, 1], uv: [1, 0], s1: [1, 0, 1], s2: [0, -1, 1], c: [1, -1, 1] },
      { pos: [1, 1, 1], uv: [1, 1], s1: [1, 0, 1], s2: [0, 1, 1], c: [1, 1, 1] },
      { pos: [0, 1, 1], uv: [0, 1], s1: [-1, 0, 1], s2: [0, 1, 1], c: [-1, 1, 1] },
    ],
  },
  {
    name: 'nz',
    dir: [0, 0, -1],
    shade: 0.84,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], s1: [1, 0, -1], s2: [0, -1, -1], c: [1, -1, -1] },
      { pos: [0, 0, 0], uv: [1, 0], s1: [-1, 0, -1], s2: [0, -1, -1], c: [-1, -1, -1] },
      { pos: [0, 1, 0], uv: [1, 1], s1: [-1, 0, -1], s2: [0, 1, -1], c: [-1, 1, -1] },
      { pos: [1, 1, 0], uv: [0, 1], s1: [1, 0, -1], s2: [0, 1, -1], c: [1, 1, -1] },
    ],
  },
  {
    name: 'px',
    dir: [1, 0, 0],
    shade: 0.72,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], s1: [1, 0, 1], s2: [1, -1, 0], c: [1, -1, 1] },
      { pos: [1, 0, 0], uv: [1, 0], s1: [1, 0, -1], s2: [1, -1, 0], c: [1, -1, -1] },
      { pos: [1, 1, 0], uv: [1, 1], s1: [1, 0, -1], s2: [1, 1, 0], c: [1, 1, -1] },
      { pos: [1, 1, 1], uv: [0, 1], s1: [1, 0, 1], s2: [1, 1, 0], c: [1, 1, 1] },
    ],
  },
  {
    name: 'nx',
    dir: [-1, 0, 0],
    shade: 0.72,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], s1: [-1, 0, -1], s2: [-1, -1, 0], c: [-1, -1, -1] },
      { pos: [0, 0, 1], uv: [1, 0], s1: [-1, 0, 1], s2: [-1, -1, 0], c: [-1, -1, 1] },
      { pos: [0, 1, 1], uv: [1, 1], s1: [-1, 0, 1], s2: [-1, 1, 0], c: [-1, 1, 1] },
      { pos: [0, 1, 0], uv: [0, 1], s1: [-1, 0, -1], s2: [-1, 1, 0], c: [-1, 1, -1] },
    ],
  },
];

export function createChunkMaterials(atlasTexture) {
  const sharedUniforms = {
    uMap: { value: atlasTexture },
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color(1.0, 0.98, 0.94) },
    uSunIntensity: { value: 1.0 },
    uAmbientFloor: { value: new THREE.Color(0.085, 0.095, 0.13) },
    uTorchColor: { value: new THREE.Color(1.08, 0.74, 0.36) },
    uFogColor: { value: new THREE.Color(0.58, 0.78, 0.96) },
    uFogNear: { value: 48.0 },
    uFogFar: { value: 112.0 },
  };

  const makeShader = ({ alphaTest = 0.0, translucent = false, doubleSided = false }) =>
    new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      transparent: translucent,
      depthWrite: !translucent,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      vertexShader: /* glsl */ `
        attribute float aShade;
        attribute vec2 aLight;
        attribute float aAnim;

        uniform float uTime;

        varying vec2 vUv;
        varying float vShade;
        varying vec2 vLight;
        varying float vFogDist;

        void main() {
          vUv = uv;
          vShade = aShade;
          vLight = aLight;

          vec3 pos = position;
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);

          if (aAnim > 0.5 && aAnim < 1.5) {
            // Subtle foliage sway
            worldPos.x += sin(uTime * 2.1 + worldPos.x * 0.7 + worldPos.z * 0.5) * 0.045;
            worldPos.z += cos(uTime * 1.8 + worldPos.z * 0.6) * 0.035;
          } else if (aAnim > 1.5) {
            // Gentle water wave
            worldPos.y += sin(uTime * 2.4 + worldPos.x * 0.9 + worldPos.z * 0.8) * 0.045 - 0.02;
          }

          vec4 mvPosition = viewMatrix * worldPos;
          vFogDist = length(mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uTime;
        uniform vec3 uSunColor;
        uniform float uSunIntensity;
        uniform vec3 uAmbientFloor;
        uniform vec3 uTorchColor;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;

        varying vec2 vUv;
        varying float vShade;
        varying vec2 vLight;
        varying float vFogDist;

        void main() {
          vec4 texel = texture2D(uMap, vUv);
          ${alphaTest > 0 ? `if (texel.a < ${alphaTest.toFixed(2)}) discard;` : ''}

          float skyFactor = pow(clamp(vLight.x, 0.0, 1.0), 1.35) * uSunIntensity;
          float flicker = 0.97 + 0.03 * sin(uTime * 7.5);
          float torchFactor = pow(clamp(vLight.y, 0.0, 1.0), 1.35) * flicker;

          vec3 skyLight = uSunColor * skyFactor;
          vec3 blockLight = uTorchColor * torchFactor;
          vec3 combinedLight = max(skyLight, blockLight * 0.92) + min(skyLight, blockLight) * 0.35;
          combinedLight = max(combinedLight, uAmbientFloor);

          vec3 litColor = texel.rgb * combinedLight * vShade;

          float fogFactor = smoothstep(uFogNear, uFogFar, vFogDist);
          vec3 finalRgb = mix(litColor, uFogColor, fogFactor);

          gl_FragColor = vec4(finalRgb, texel.a);
          #include <colorspace_fragment>
        }
      `,
    });

  return {
    uniforms: sharedUniforms,
    opaque: makeShader({ alphaTest: 0.0, translucent: false, doubleSided: false }),
    cutout: makeShader({ alphaTest: 0.45, translucent: false, doubleSided: true }),
    translucent: makeShader({ alphaTest: 0.05, translucent: true, doubleSided: true }),
  };
}

class MeshBucket {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.shades = [];
    this.lights = [];
    this.anims = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  pushVertex(x, y, z, u, v, shade, sky, block, anim = 0) {
    this.positions.push(x, y, z);
    this.uvs.push(u, v);
    this.shades.push(shade);
    this.lights.push(sky, block);
    this.anims.push(anim);
    return this.vertexCount++;
  }

  pushQuad(v0, v1, v2, v3, flip = false) {
    if (flip) {
      this.indices.push(v1, v2, v3, v1, v3, v0);
    } else {
      this.indices.push(v0, v1, v2, v0, v2, v3);
    }
  }

  toBufferGeometry() {
    if (this.vertexCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shades, 1));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 2));
    geom.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anims, 1));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

export class ChunkMesher {
  constructor(world, atlas) {
    this.world = world;
    this.atlas = atlas;
  }

  isAoOccluder(wx, y, wz) {
    const id = this.world.getBlock(wx, y, wz);
    if (id === BLOCK_IDS.AIR) return 0;
    const def = getItemDef(id);
    return def.opaque ? 1 : 0;
  }

  shouldRenderFace(selfId, selfDef, neighborId, faceName) {
    if (neighborId === BLOCK_IDS.AIR) return true;
    const nDef = getItemDef(neighborId);

    if (selfDef.shape === MESH_SHAPE.LIQUID) {
      if (neighborId === selfId) return false;
      if (faceName !== 'top' && nDef.opaque) return false;
      return true;
    }

    if (selfDef.shape === MESH_SHAPE.BED || selfDef.shape === MESH_SHAPE.CACTUS) {
      if (faceName === 'bottom' && nDef.opaque) return false;
      return true;
    }

    if (nDef.opaque) return false;

    // Cull identical adjacent transparent blocks like Glass or Ice (keep Leaves lush!)
    if (
      (selfId === BLOCK_IDS.GLASS || selfId === BLOCK_IDS.ICE) &&
      neighborId === selfId
    ) {
      return false;
    }

    return true;
  }

  buildChunkGeometries(chunk) {
    const buckets = {
      [RENDER_PASS.OPAQUE]: new MeshBucket(),
      [RENDER_PASS.CUTOUT]: new MeshBucket(),
      [RENDER_PASS.TRANSLUCENT]: new MeshBucket(),
    };

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.getBlock(lx, y, lz);
          if (id === BLOCK_IDS.AIR) continue;

          const def = getItemDef(id);
          const wx = baseX + lx;
          const meta = chunk.getMeta(lx, y, lz);
          const bucket = buckets[def.renderPass];

          if (def.shape === MESH_SHAPE.CROSS) {
            this.emitCrossPlant(bucket, def, chunk, lx, y, lz);
          } else if (def.shape === MESH_SHAPE.TORCH) {
            this.emitTorch(bucket, def, chunk, lx, y, lz);
          } else if (def.shape === MESH_SHAPE.LADDER) {
            this.emitLadder(bucket, def, chunk, lx, y, lz, meta);
          } else {
            this.emitBoxBlock(bucket, id, def, chunk, lx, y, lz, wx, wz, meta);
          }
        }
      }
    }

    return {
      opaque: buckets[RENDER_PASS.OPAQUE].toBufferGeometry(),
      cutout: buckets[RENDER_PASS.CUTOUT].toBufferGeometry(),
      translucent: buckets[RENDER_PASS.TRANSLUCENT].toBufferGeometry(),
    };
  }

  sampleSmoothLight(wx, y, wz, faceDir, corner) {
    const nx = wx + faceDir[0];
    const ny = y + faceDir[1];
    const nz = wz + faceDir[2];

    let skySum = this.world.getSkyLight(nx, ny, nz);
    let blkSum = this.world.getBlockLight(nx, ny, nz);
    let count = 1;

    const offsets = [corner.s1, corner.s2, corner.c];
    for (let i = 0; i < 3; i++) {
      const ox = wx + offsets[i][0];
      const oy = y + offsets[i][1];
      const oz = wz + offsets[i][2];
      const bid = this.world.getBlock(ox, oy, oz);
      if (!getItemDef(bid).opaque) {
        skySum += this.world.getSkyLight(ox, oy, oz);
        blkSum += this.world.getBlockLight(ox, oy, oz);
        count++;
      }
    }

    return [(skySum / count) / 15.0, (blkSum / count) / 15.0];
  }

  emitBoxBlock(bucket, id, def, chunk, lx, y, lz, wx, wz, meta) {
    const isLiquid = def.shape === MESH_SHAPE.LIQUID;
    const isBed = def.shape === MESH_SHAPE.BED;
    const isCactus = def.shape === MESH_SHAPE.CACTUS;
    const isLeaf =
      id === BLOCK_IDS.OAK_LEAVES ||
      id === BLOCK_IDS.BIRCH_LEAVES ||
      id === BLOCK_IDS.SPRUCE_LEAVES;

    let topHeight = 1.0;
    if (isLiquid) {
      const aboveId = this.world.getBlock(wx, y + 1, wz);
      topHeight = aboveId === id ? 1.0 : 0.88;
    } else if (isBed) {
      topHeight = 0.5625;
    }

    const sideInset = isCactus ? 0.0625 : 0.0;
    const selfEmissive = def.lightLevel / 15.0;

    for (let f = 0; f < 6; f++) {
      const face = CUBE_FACES[f];
      const nx = wx + face.dir[0];
      const ny = y + face.dir[1];
      const nz = wz + face.dir[2];

      const neighborId = this.world.getBlock(nx, ny, nz);
      if (!this.shouldRenderFace(id, def, neighborId, face.name)) continue;

      const uvRect = this.atlas.getBlockFaceUV(def, face.name, meta);
      const aoScores = [3, 3, 3, 3];
      const vIndices = [0, 0, 0, 0];

      for (let c = 0; c < 4; c++) {
        const corner = face.corners[c];
        let px = lx + corner.pos[0];
        let py = y + (corner.pos[1] === 1 ? topHeight : 0);
        let pz = lz + corner.pos[2];

        if (sideInset > 0) {
          if (face.name === 'px') px -= sideInset;
          else if (face.name === 'nx') px += sideInset;
          else if (face.name === 'pz') pz -= sideInset;
          else if (face.name === 'nz') pz += sideInset;
        }

        const u = corner.uv[0] === 0 ? uvRect.u0 : uvRect.u1;
        const v = corner.uv[1] === 0 ? uvRect.v0 : uvRect.v1;

        let ao = 3;
        if (!isLiquid) {
          const s1 = this.isAoOccluder(wx + corner.s1[0], y + corner.s1[1], wz + corner.s1[2]);
          const s2 = this.isAoOccluder(wx + corner.s2[0], y + corner.s2[1], wz + corner.s2[2]);
          const cn = this.isAoOccluder(wx + corner.c[0], y + corner.c[1], wz + corner.c[2]);
          ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cn);
        }
        aoScores[c] = ao;

        const [skyL, blkL] = this.sampleSmoothLight(wx, y, wz, face.dir, corner);
        const finalBlk = Math.max(blkL, selfEmissive);
        const shade = selfEmissive >= 0.9 ? 1.0 : face.shade * AO_CURVE[ao];

        let anim = 0;
        if (isLiquid && id === BLOCK_IDS.WATER && corner.pos[1] === 1 && topHeight < 1.0) {
          anim = 2.0;
        } else if (isLeaf) {
          anim = 1.0;
        }

        vIndices[c] = bucket.pushVertex(px, py, pz, u, v, shade, skyL, finalBlk, anim);
      }

      const flip = aoScores[0] + aoScores[2] < aoScores[1] + aoScores[3];
      bucket.pushQuad(vIndices[0], vIndices[1], vIndices[2], vIndices[3], flip);
    }

    void chunk;
  }

  emitCrossPlant(bucket, def, chunk, lx, y, lz) {
    const uv = this.atlas.getBlockFaceUV(def, 'side', 0);
    const sky = chunk.getSkyLight(lx, y, lz) / 15.0;
    const blk = Math.max(chunk.getBlockLight(lx, y, lz), def.lightLevel) / 15.0;
    const shade = 0.94;

    const x0 = lx + 0.08;
    const x1 = lx + 0.92;
    const z0 = lz + 0.08;
    const z1 = lz + 0.92;
    const y0 = y;
    const y1 = y + 0.95;

    // Diagonal 1
    const a0 = bucket.pushVertex(x0, y0, z0, uv.u0, uv.v0, shade, sky, blk, 0);
    const a1 = bucket.pushVertex(x1, y0, z1, uv.u1, uv.v0, shade, sky, blk, 0);
    const a2 = bucket.pushVertex(x1, y1, z1, uv.u1, uv.v1, shade, sky, blk, 1.0);
    const a3 = bucket.pushVertex(x0, y1, z0, uv.u0, uv.v1, shade, sky, blk, 1.0);
    bucket.pushQuad(a0, a1, a2, a3);

    // Diagonal 2
    const b0 = bucket.pushVertex(x0, y0, z1, uv.u0, uv.v0, shade, sky, blk, 0);
    const b1 = bucket.pushVertex(x1, y0, z0, uv.u1, uv.v0, shade, sky, blk, 0);
    const b2 = bucket.pushVertex(x1, y1, z0, uv.u1, uv.v1, shade, sky, blk, 1.0);
    const b3 = bucket.pushVertex(x0, y1, z1, uv.u0, uv.v1, shade, sky, blk, 1.0);
    bucket.pushQuad(b0, b1, b2, b3);
  }

  emitTorch(bucket, def, chunk, lx, y, lz) {
    const uv = this.atlas.getBlockFaceUV(def, 'side', 0);
    const sky = chunk.getSkyLight(lx, y, lz) / 15.0;
    const blk = 1.0;

    // Crossed planes centered narrowly on the torch pixel column so the stick + flame look crisp from every angle
    const x0 = lx + 0.05;
    const x1 = lx + 0.95;
    const z0 = lz + 0.05;
    const z1 = lz + 0.95;
    const cx = lx + 0.5;
    const cz = lz + 0.5;
    const y0 = y;
    const y1 = y + 0.88;

    // X-aligned plane
    const a0 = bucket.pushVertex(x0, y0, cz, uv.u0, uv.v0, 1.0, sky, blk, 0);
    const a1 = bucket.pushVertex(x1, y0, cz, uv.u1, uv.v0, 1.0, sky, blk, 0);
    const a2 = bucket.pushVertex(x1, y1, cz, uv.u1, uv.v1, 1.0, sky, blk, 0);
    const a3 = bucket.pushVertex(x0, y1, cz, uv.u0, uv.v1, 1.0, sky, blk, 0);
    bucket.pushQuad(a0, a1, a2, a3);

    // Z-aligned plane
    const b0 = bucket.pushVertex(cx, y0, z0, uv.u0, uv.v0, 1.0, sky, blk, 0);
    const b1 = bucket.pushVertex(cx, y0, z1, uv.u1, uv.v0, 1.0, sky, blk, 0);
    const b2 = bucket.pushVertex(cx, y1, z1, uv.u1, uv.v1, 1.0, sky, blk, 0);
    const b3 = bucket.pushVertex(cx, y1, z0, uv.u0, uv.v1, 1.0, sky, blk, 0);
    bucket.pushQuad(b0, b1, b2, b3);
  }

  emitLadder(bucket, def, chunk, lx, y, lz, meta) {
    const uv = this.atlas.getBlockFaceUV(def, 'side', 0);
    const sky = chunk.getSkyLight(lx, y, lz) / 15.0;
    const blk = chunk.getBlockLight(lx, y, lz) / 15.0;
    const shade = 0.9;
    const off = 0.06;

    // meta: 0 = against +Z wall, 1 = against -X wall, 2 = against -Z wall, 3 = against +X wall
    let p0, p1, p2, p3;
    const m = meta & 3;
    if (m === 0) {
      p0 = [lx, y, lz + 1 - off];
      p1 = [lx + 1, y, lz + 1 - off];
      p2 = [lx + 1, y + 1, lz + 1 - off];
      p3 = [lx, y + 1, lz + 1 - off];
    } else if (m === 1) {
      p0 = [lx + off, y, lz];
      p1 = [lx + off, y, lz + 1];
      p2 = [lx + off, y + 1, lz + 1];
      p3 = [lx + off, y + 1, lz];
    } else if (m === 3) {
      p0 = [lx + 1 - off, y, lz + 1];
      p1 = [lx + 1 - off, y, lz];
      p2 = [lx + 1 - off, y + 1, lz];
      p3 = [lx + 1 - off, y + 1, lz + 1];
    } else {
      p0 = [lx + 1, y, lz + off];
      p1 = [lx, y, lz + off];
      p2 = [lx, y + 1, lz + off];
      p3 = [lx + 1, y + 1, lz + off];
    }

    const v0 = bucket.pushVertex(p0[0], p0[1], p0[2], uv.u0, uv.v0, shade, sky, blk, 0);
    const v1 = bucket.pushVertex(p1[0], p1[1], p1[2], uv.u1, uv.v0, shade, sky, blk, 0);
    const v2 = bucket.pushVertex(p2[0], p2[1], p2[2], uv.u1, uv.v1, shade, sky, blk, 0);
    const v3 = bucket.pushVertex(p3[0], p3[1], p3[2], uv.u0, uv.v1, shade, sky, blk, 0);
    bucket.pushQuad(v0, v1, v2, v3);
  }
}
