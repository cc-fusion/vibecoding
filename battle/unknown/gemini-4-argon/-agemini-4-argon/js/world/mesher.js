// High-Performance Voxel Chunk Mesher + Custom Atmospheric/Torch/AO Shader Pipeline

import * as THREE from 'three';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK, BLOCK_DEFS, getBlockLight, isBlockOpaque } from '../game/blocks.js';

// 6 Cube Faces aligned with BLOCK_DEFS.faces indices:
// 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z
const FACES = [
  {
    dir: [1, 0, 0],
    shade: 0.73,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
    ],
  },
  {
    dir: [-1, 0, 0],
    shade: 0.73,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0] },
      { pos: [1, 1, 1], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, -1, 0],
    shade: 0.54,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 0] },
      { pos: [1, 0, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 1], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 0, -1],
    shade: 0.84,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [0, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 0], uv: [0, 1] },
    ],
  },
];

const AO_CURVE = [0.42, 0.62, 0.82, 1.0];

// Reusable scratch buffers for halo block data, skylight columns, and 3D torchlight flood-fill
const HALO = 4;
const PADDED_W = CHUNK_SIZE + HALO * 2; // 24
const PADDED_AREA = PADDED_W * PADDED_W; // 576
const PADDED_VOL = PADDED_AREA * WORLD_HEIGHT; // 55,296 bytes (~55KB reusable static buffers!)

const padBlocks = new Uint8Array(PADDED_VOL);
const skyHeight = new Int16Array(PADDED_AREA);
const torchGrid = new Uint8Array(PADDED_VOL);
const bfsQueue = new Int32Array(PADDED_VOL);

// Zero-allocation scratch arrays for quad corners
const cX = new Float32Array(4);
const cY = new Float32Array(4);
const cZ = new Float32Array(4);
const cU = new Float32Array(4);
const cV = new Float32Array(4);
const cShade = new Float32Array(4);
const cSky = new Float32Array(4);
const cTorch = new Float32Array(4);
const cAnim = new Float32Array(4);
const cAO = new Float32Array(4);

function pIdx(px, y, pz) {
  return (y * PADDED_W + pz) * PADDED_W + px;
}

class MeshAccumulator {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.lights = [];
    this.indices = [];
    this.vertCount = 0;
  }

  emitBufferedQuad(flipDiagonal = false) {
    const base = this.vertCount;
    for (let i = 0; i < 4; i++) {
      this.positions.push(cX[i], cY[i], cZ[i]);
      this.uvs.push(cU[i], cV[i]);
      this.lights.push(cShade[i], cSky[i], cTorch[i], cAnim[i]);
    }
    if (flipDiagonal) {
      this.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
    } else {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    this.vertCount += 4;
  }

  toGeometry() {
    if (this.vertCount === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 4));
    geo.setIndex(
      this.vertCount > 65535
        ? new THREE.Uint32BufferAttribute(this.indices, 1)
        : new THREE.Uint16BufferAttribute(this.indices, 1)
    );
    geo.computeBoundingSphere();
    return geo;
  }
}

export function createVoxelMaterials(textureManager) {
  const sharedUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1.0 },
    uSunLight: { value: new THREE.Color(1.02, 1.0, 0.96) },
    uTorchLight: { value: new THREE.Color(1.12, 0.84, 0.50) },
    uFogColor: { value: new THREE.Color(0x9fd0ff) },
    uFogNear: { value: 52 },
    uFogFar: { value: 108 },
  };

  const vertexShader = `
    attribute vec4 aLight;
    uniform float uTime;
    uniform float uWindStrength;
    varying vec2 vUv;
    varying vec4 vLight;
    varying float vFogDepth;

    void main() {
      vec3 pos = position;
      if (aLight.w > 0.5 && aLight.w < 1.5) {
        pos.x += sin(uTime * 2.3 + pos.x * 0.85 + pos.z * 0.75) * 0.055 * uWindStrength;
        pos.z += cos(uTime * 1.9 + pos.z * 0.95) * 0.042 * uWindStrength;
      } else if (aLight.w > 1.5) {
        pos.y += sin(uTime * 2.0 + pos.x * 1.15 + pos.z * 0.95) * 0.032 - 0.075;
      }
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vFogDepth = -mvPosition.z;
      vUv = uv;
      vLight = aLight;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D uMap;
    uniform vec3 uSunLight;
    uniform vec3 uTorchLight;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uAlphaTest;
    uniform float uOpacity;
    uniform vec2 uUvScroll;

    varying vec2 vUv;
    varying vec4 vLight;
    varying float vFogDepth;

    void main() {
      vec4 texel = texture2D(uMap, vUv + uUvScroll);
      if (texel.a < uAlphaTest) discard;

      float shadeAO = vLight.x;
      float sky = vLight.y;
      float torch = vLight.z;

      vec3 skyLight = uSunLight * sky;
      vec3 blockLight = uTorchLight * torch;
      vec3 combined = max(skyLight, blockLight) + min(skyLight, blockLight) * 0.28;
      combined = max(combined, vec3(0.052, 0.058, 0.078));

      vec3 lit = texel.rgb * combined * shadeAO;
      float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
      gl_FragColor = vec4(mix(lit, uFogColor, fogFactor), texel.a * uOpacity);
      #include <colorspace_fragment>
    }
  `;

  const solidMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: textureManager.texture },
      uAlphaTest: { value: 0.5 },
      uOpacity: { value: 1.0 },
      uUvScroll: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });

  const floraMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: textureManager.texture },
      uAlphaTest: { value: 0.45 },
      uOpacity: { value: 1.0 },
      uUvScroll: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: textureManager.texture },
      uAlphaTest: { value: 0.02 },
      uOpacity: { value: 0.78 },
      uUvScroll: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    sharedUniforms,
    solidMaterial,
    floraMaterial,
    waterMaterial,
  };
}

export function buildChunkGeometries(cx, cz, chunkManager, textureManager) {
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  // Step 1: Copy chunk + 4-block halo into linear L1-cache-friendly buffer & enqueue light sources
  torchGrid.fill(0);
  let qHead = 0;
  let qTail = 0;
  let maxChunkY = 1;

  for (let pz = 0; pz < PADDED_W; pz++) {
    const wz = baseZ + pz - HALO;
    const neighborCz = Math.floor(wz / CHUNK_SIZE);
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    for (let px = 0; px < PADDED_W; px++) {
      const wx = baseX + px - HALO;
      const neighborCx = Math.floor(wx / CHUNK_SIZE);
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

      const chunkData = chunkManager.getOrCreateChunkData(neighborCx, neighborCz);
      let topOpaque = 0;
      const colStride = lz * CHUNK_SIZE + lx;

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const b = chunkData[y * 256 + colStride];
        const pi = pIdx(px, y, pz);
        padBlocks[pi] = b;

        if (b !== BLOCK.AIR) {
          if (y > maxChunkY) maxChunkY = y;
          if (isBlockOpaque(b)) {
            topOpaque = y;
          }
          const emit = getBlockLight(b);
          if (emit > 0) {
            torchGrid[pi] = emit;
            bfsQueue[qTail++] = pi;
          }
        }
      }
      skyHeight[pz * PADDED_W + px] = topOpaque;
    }
  }

  // Step 2: Fast 6-neighbor BFS flood-fill for all torches, lanterns, furnaces & glow crystals!
  const stepX = 1;
  const stepZ = PADDED_W;
  const stepY = PADDED_AREA;

  while (qHead < qTail) {
    const cur = bfsQueue[qHead++];
    const level = torchGrid[cur];
    if (level <= 2) continue;
    const nextLevel = level - 2; // smooth 7-8 block falloff radius!

    const py = (cur / PADDED_AREA) | 0;
    const rem = cur - py * PADDED_AREA;
    const pz = (rem / PADDED_W) | 0;
    const px = rem - pz * PADDED_W;

    if (px > 0) {
      const ni = cur - stepX;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
    if (px < PADDED_W - 1) {
      const ni = cur + stepX;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
    if (pz > 0) {
      const ni = cur - stepZ;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
    if (pz < PADDED_W - 1) {
      const ni = cur + stepZ;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
    if (py > 0) {
      const ni = cur - stepY;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
    if (py < WORLD_HEIGHT - 1) {
      const ni = cur + stepY;
      if (!isBlockOpaque(padBlocks[ni]) && torchGrid[ni] < nextLevel) {
        torchGrid[ni] = nextLevel;
        bfsQueue[qTail++] = ni;
      }
    }
  }

  const getPadded = (px, y, pz) => {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    return padBlocks[pIdx(px, y, pz)];
  };

  // Sample soft skylight at an air cell (px, y, pz) by checking nearby column heights
  const sampleSky = (px, y, pz) => {
    if (y < 0) return 0.08;
    if (y >= skyHeight[pz * PADDED_W + px]) return 1.0;
    // Check 4 cardinal columns so light spills softly into cave mouths & under tree canopies!
    let openNeighbors = 0;
    if (y >= skyHeight[pz * PADDED_W + (px + 1)]) openNeighbors++;
    if (y >= skyHeight[pz * PADDED_W + (px - 1)]) openNeighbors++;
    if (y >= skyHeight[(pz + 1) * PADDED_W + px]) openNeighbors++;
    if (y >= skyHeight[(pz - 1) * PADDED_W + px]) openNeighbors++;
    if (openNeighbors > 0) return 0.35 + openNeighbors * 0.14;
    // Slightly brighter shallow underwater than deep caves
    if (getPadded(px, y, pz) === BLOCK.WATER && y >= SEA_LEVEL - 8) {
      return Math.max(0.28, 1.0 - (SEA_LEVEL - y) * 0.09);
    }
    return 0.09;
  };

  const sampleTorch = (px, y, pz) => {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return torchGrid[pIdx(px, y, pz)] / 15.0;
  };

  const solidAcc = new MeshAccumulator();
  const floraAcc = new MeshAccumulator();
  const waterAcc = new MeshAccumulator();

  const emitCrossQuad = (acc, x0, z0, x1, z1, y0, y1, uv, shadeBot, shadeTop, sky, torch, animTop) => {
    cX[0] = x0; cY[0] = y0; cZ[0] = z0; cU[0] = uv.u0; cV[0] = uv.v0; cShade[0] = shadeBot; cSky[0] = sky; cTorch[0] = torch; cAnim[0] = 0;
    cX[1] = x1; cY[1] = y0; cZ[1] = z1; cU[1] = uv.u1; cV[1] = uv.v0; cShade[1] = shadeBot; cSky[1] = sky; cTorch[1] = torch; cAnim[1] = 0;
    cX[2] = x1; cY[2] = y1; cZ[2] = z1; cU[2] = uv.u1; cV[2] = uv.v1; cShade[2] = shadeTop; cSky[2] = sky; cTorch[2] = torch; cAnim[2] = animTop;
    cX[3] = x0; cY[3] = y1; cZ[3] = z0; cU[3] = uv.u0; cV[3] = uv.v1; cShade[3] = shadeTop; cSky[3] = sky; cTorch[3] = torch; cAnim[3] = animTop;
    acc.emitBufferedQuad(false);
  };

  // Step 3: Zero-allocation visible face meshing up to maxChunkY
  const topYLimit = Math.min(WORLD_HEIGHT - 1, maxChunkY);
  for (let y = 0; y <= topYLimit; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const pz = lz + HALO;
      const wz = baseZ + lz;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const px = lx + HALO;
        const wx = baseX + lx;
        const pi = pIdx(px, y, pz);
        const id = padBlocks[pi];
        if (id === BLOCK.AIR) continue;

        const def = BLOCK_DEFS[id];
        if (!def) continue;

        // Cross-quad flora (tall grass, flowers, mushrooms, sugar cane)
        if (def.renderType === 'cross') {
          const uv = textureManager.getTileUV(def.faces[0]);
          const sky = sampleSky(px, y, pz);
          const torch = Math.max(def.light / 15.0, sampleTorch(px, y, pz));
          emitCrossQuad(floraAcc, wx + 0.14, wz + 0.14, wx + 0.86, wz + 0.86, y, y + 0.96, uv, 0.81, 0.94, sky, torch, 1);
          emitCrossQuad(floraAcc, wx + 0.14, wz + 0.86, wx + 0.86, wz + 0.14, y, y + 0.96, uv, 0.81, 0.94, sky, torch, 1);
          continue;
        }

        // Torch cross/pillar mesh (bright self-lit!)
        if (def.renderType === 'torch') {
          const uv = textureManager.getTileUV(def.faces[0]);
          const sky = sampleSky(px, y, pz);
          emitCrossQuad(floraAcc, wx + 0.5, wz + 0.0, wx + 0.5, wz + 1.0, y, y + 0.95, uv, 1, 1, sky, 1.0, 0);
          emitCrossQuad(floraAcc, wx + 0.0, wz + 0.5, wx + 1.0, wz + 0.5, y, y + 0.95, uv, 1, 1, sky, 1.0, 0);
          continue;
        }

        // Fluid water mesh
        if (def.renderType === 'fluid') {
          const uv = textureManager.getTileUV(def.faces[2]);
          const topNeighbor = getPadded(px, y + 1, pz);
          const isSurfaceWave = topNeighbor !== BLOCK.WATER;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = px + face.dir[0];
            const ny = y + face.dir[1];
            const nz = pz + face.dir[2];
            const nb = getPadded(nx, ny, nz);
            if (nb === BLOCK.WATER || isBlockOpaque(nb)) continue;
            if (f === 3 && nb !== BLOCK.AIR) continue;

            const sky = sampleSky(nx, ny, nz);
            const torch = sampleTorch(nx, ny, nz);
            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              cX[c] = wx + corner.pos[0];
              cY[c] = y + corner.pos[1];
              cZ[c] = wz + corner.pos[2];
              cU[c] = corner.uv[0] ? uv.u1 : uv.u0;
              cV[c] = corner.uv[1] ? uv.v1 : uv.v0;
              cShade[c] = face.shade;
              cSky[c] = sky;
              cTorch[c] = torch;
              cAnim[c] = isSurfaceWave && corner.pos[1] === 1 ? 2 : 0;
            }
            waterAcc.emitBufferedQuad(false);
          }
          continue;
        }

        // Fast skip completely buried solid interior blocks (~92% of underground stone skipped in 6 integer reads!)
        if (
          y > 0 &&
          y < WORLD_HEIGHT - 1 &&
          isBlockOpaque(padBlocks[pi + 1]) &&
          isBlockOpaque(padBlocks[pi - 1]) &&
          isBlockOpaque(padBlocks[pi + PADDED_AREA]) &&
          isBlockOpaque(padBlocks[pi - PADDED_AREA]) &&
          isBlockOpaque(padBlocks[pi + PADDED_W]) &&
          isBlockOpaque(padBlocks[pi - PADDED_W])
        ) {
          continue;
        }

        // Standard solid & cutout cubes (Glass, Leaves, Stone, Planks, Ores, etc.)
        const selfGlow = def.light / 15.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = px + face.dir[0];
          const ny = y + face.dir[1];
          const nz = pz + face.dir[2];
          const nb = getPadded(nx, ny, nz);

          if (isBlockOpaque(nb)) continue;
          if (nb === id && id === BLOCK.GLASS) continue;

          const uv = textureManager.getTileUV(def.faces[f]);
          const baseSky = sampleSky(nx, ny, nz);
          const centerTorch = Math.max(selfGlow, sampleTorch(nx, ny, nz));

          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            const ox = face.dir[0] !== 0 ? 0 : corner.pos[0] === 1 ? 1 : -1;
            const oy = face.dir[1] !== 0 ? 0 : corner.pos[1] === 1 ? 1 : -1;
            const oz = face.dir[2] !== 0 ? 0 : corner.pos[2] === 1 ? 1 : -1;

            let s1 = 0;
            let s2 = 0;
            let sCorner = 0;
            let maxTorch = centerTorch;

            if (face.dir[1] !== 0) {
              s1 = isBlockOpaque(getPadded(nx + ox, ny, nz)) ? 1 : 0;
              s2 = isBlockOpaque(getPadded(nx, ny, nz + oz)) ? 1 : 0;
              sCorner = isBlockOpaque(getPadded(nx + ox, ny, nz + oz)) ? 1 : 0;
              maxTorch = Math.max(
                maxTorch,
                sampleTorch(nx + ox, ny, nz),
                sampleTorch(nx, ny, nz + oz),
                sampleTorch(nx + ox, ny, nz + oz)
              );
            } else if (face.dir[0] !== 0) {
              s1 = isBlockOpaque(getPadded(nx, ny + oy, nz)) ? 1 : 0;
              s2 = isBlockOpaque(getPadded(nx, ny, nz + oz)) ? 1 : 0;
              sCorner = isBlockOpaque(getPadded(nx, ny + oy, nz + oz)) ? 1 : 0;
              maxTorch = Math.max(
                maxTorch,
                sampleTorch(nx, ny + oy, nz),
                sampleTorch(nx, ny, nz + oz),
                sampleTorch(nx, ny + oy, nz + oz)
              );
            } else {
              s1 = isBlockOpaque(getPadded(nx + ox, ny, nz)) ? 1 : 0;
              s2 = isBlockOpaque(getPadded(nx, ny + oy, nz)) ? 1 : 0;
              sCorner = isBlockOpaque(getPadded(nx + ox, ny + oy, nz)) ? 1 : 0;
              maxTorch = Math.max(
                maxTorch,
                sampleTorch(nx + ox, ny, nz),
                sampleTorch(nx, ny + oy, nz),
                sampleTorch(nx + ox, ny + oy, nz)
              );
            }

            const aoIdx = s1 && s2 ? 0 : 3 - (s1 + s2 + sCorner);
            const ao = selfGlow > 0.6 ? 1.0 : AO_CURVE[aoIdx];
            cAO[c] = ao;
            cX[c] = wx + corner.pos[0];
            cY[c] = y + corner.pos[1];
            cZ[c] = wz + corner.pos[2];
            cU[c] = corner.uv[0] ? uv.u1 : uv.u0;
            cV[c] = corner.uv[1] ? uv.v1 : uv.v0;
            cShade[c] = selfGlow > 0.6 ? 1.0 : face.shade * ao;
            cSky[c] = baseSky;
            cTorch[c] = maxTorch;
            cAnim[c] = 0;
          }

          solidAcc.emitBufferedQuad(cAO[0] + cAO[2] < cAO[1] + cAO[3]);
        }
      }
    }
  }

  return {
    solidGeo: solidAcc.toGeometry(),
    floraGeo: floraAcc.toGeometry(),
    waterGeo: waterAcc.toGeometry(),
  };
}
