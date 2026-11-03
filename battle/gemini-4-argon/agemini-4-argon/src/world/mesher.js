import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_TYPE } from './constants.js';
import { BLOCK, getDef } from './blocks.js';

// Verified CCW outward-facing faces with upright UVs
const FACES = [
  {
    name: 'top',
    dir: [0, 1, 0],
    shade: 1.0,
    texKey: 'top',
    verts: [
      { pos: [0, 1, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 0], uv: [1, 0] },
    ],
  },
  {
    name: 'bottom',
    dir: [0, -1, 0],
    shade: 0.54,
    texKey: 'bottom',
    verts: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [0, 1] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [1, 0, 1], uv: [1, 0] },
    ],
  },
  {
    name: 'front', // +Z
    dir: [0, 0, 1],
    shade: 0.86,
    texKey: 'front',
    verts: [
      { pos: [0, 1, 1], uv: [0, 0] },
      { pos: [0, 0, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [1, 0] },
    ],
  },
  {
    name: 'back', // -Z
    dir: [0, 0, -1],
    shade: 0.82,
    texKey: 'side',
    verts: [
      { pos: [1, 1, 0], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
    ],
  },
  {
    name: 'right', // +X
    dir: [1, 0, 0],
    shade: 0.74,
    texKey: 'side',
    verts: [
      { pos: [1, 1, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [0, 1] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [1, 1, 0], uv: [1, 0] },
    ],
  },
  {
    name: 'left', // -X
    dir: [-1, 0, 0],
    shade: 0.72,
    texKey: 'side',
    verts: [
      { pos: [0, 1, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [0, 1] },
      { pos: [0, 0, 1], uv: [1, 1] },
      { pos: [0, 1, 1], uv: [1, 0] },
    ],
  },
];

class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.lights = [];
    this.indices = [];
    this.vertCount = 0;
  }

  pushVertex(px, py, pz, nx, ny, nz, u, v, r, g, b, skyL, blkL) {
    this.positions.push(px, py, pz);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.colors.push(r, g, b);
    this.lights.push(skyL, blkL);
    return this.vertCount++;
  }

  pushQuad(v0, v1, v2, v3, flipDiag = false) {
    if (flipDiag) {
      this.indices.push(v1, v2, v3, v1, v3, v0);
    } else {
      this.indices.push(v0, v1, v2, v0, v2, v3);
    }
  }

  toBufferGeometry() {
    if (this.vertCount === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geom.setAttribute('aLight', new THREE.Float32BufferAttribute(this.lights, 2));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }
}

export function createVoxelMaterials(atlasTexture) {
  const sharedUniforms = {
    uSunBrightness: { value: 1.0 },
    uSkyLightTint: { value: new THREE.Color(1.0, 0.99, 0.96) },
    uTorchTint: { value: new THREE.Color(1.0, 0.82, 0.52) },
    uTime: { value: 0.0 },
    uHeldLightPos: { value: new THREE.Vector3() },
    uHeldLightPower: { value: 0.0 },
  };

  const injectVoxelLighting = (shader, isFluid = false) => {
    shader.uniforms.uSunBrightness = sharedUniforms.uSunBrightness;
    shader.uniforms.uSkyLightTint = sharedUniforms.uSkyLightTint;
    shader.uniforms.uTorchTint = sharedUniforms.uTorchTint;
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uHeldLightPos = sharedUniforms.uHeldLightPos;
    shader.uniforms.uHeldLightPower = sharedUniforms.uHeldLightPower;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec2 aLight;
        varying vec2 vVoxelLight;
        varying vec3 vVoxelWorldPos;
        uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        isFluid
          ? `#include <begin_vertex>
            vVoxelLight = aLight;
            vec4 wp = modelMatrix * vec4(transformed, 1.0);
            if (fract(transformed.y) > 0.5) {
              float wWave = sin(wp.x * 1.45 + uTime * 2.4) * 0.035 + cos(wp.z * 1.35 + uTime * 1.9) * 0.035;
              transformed.y += wWave;
              wp.y += wWave;
            }
            vVoxelWorldPos = wp.xyz;`
          : `#include <begin_vertex>
            vVoxelLight = aLight;
            vec4 wp = modelMatrix * vec4(transformed, 1.0);
            vVoxelWorldPos = wp.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vVoxelLight;
        varying vec3 vVoxelWorldPos;
        uniform float uSunBrightness;
        uniform vec3 uSkyLightTint;
        uniform vec3 uTorchTint;
        uniform float uTime;
        uniform vec3 uHeldLightPos;
        uniform float uHeldLightPower;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float skyFactor = pow(clamp(vVoxelLight.x, 0.0, 1.0), 1.35);
        float blkFactor = pow(clamp(vVoxelLight.y, 0.0, 1.0), 1.25);
        if (uHeldLightPower > 0.01) {
          float heldDist = distance(vVoxelWorldPos, uHeldLightPos);
          float heldFactor = pow(clamp(1.0 - heldDist / 11.5, 0.0, 1.0), 1.5) * uHeldLightPower;
          blkFactor = max(blkFactor, heldFactor);
        }
        float flicker = 0.97 + 0.03 * sin(uTime * 7.5);
        vec3 skyLum = uSkyLightTint * (skyFactor * uSunBrightness);
        vec3 blkLum = uTorchTint * (blkFactor * flicker);
        vec3 finalLight = max(skyLum, blkLum) + vec3(0.048);
        diffuseColor.rgb *= clamp(finalLight, 0.045, 1.22);`
      );
  };

  const solidMat = new THREE.MeshBasicMaterial({
    map: atlasTexture,
    vertexColors: true,
    alphaTest: 0.45,
    side: THREE.FrontSide,
    fog: true,
  });
  solidMat.onBeforeCompile = (shader) => injectVoxelLighting(shader, false);
  solidMat.customProgramCacheKey = () => 'voxel-solid-v1';

  const fluidMat = new THREE.MeshBasicMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  fluidMat.onBeforeCompile = (shader) => injectVoxelLighting(shader, true);
  fluidMat.customProgramCacheKey = () => 'voxel-fluid-v1';

  return { solidMat, fluidMat, sharedUniforms };
}

// Compute smooth corner AO + averaged skylight/blocklight for a face vertex
function sampleVertexAOAndLight(world, wx, wy, wz, nx, ny, nz, vx, vy, vz) {
  // Corner sign in {-1, +1} along the two tangent axes of this face
  const sx = vx === 0 ? -1 : 1;
  const sy = vy === 0 ? -1 : 1;
  const sz = vz === 0 ? -1 : 1;

  // Base neighbor voxel in face normal direction
  const bx = wx + nx;
  const by = wy + ny;
  const bz = wz + nz;

  let s1x = bx, s1y = by, s1z = bz;
  let s2x = bx, s2y = by, s2z = bz;
  let cx = bx, cy = by, cz = bz;

  if (ny !== 0) {
    s1x += sx;
    s2z += sz;
    cx += sx;
    cz += sz;
  } else if (nx !== 0) {
    s1y += sy;
    s2z += sz;
    cy += sy;
    cz += sz;
  } else {
    s1x += sx;
    s2y += sy;
    cx += sx;
    cy += sy;
  }

  const occ1 = getDef(world.getBlock(s1x, s1y, s1z)).opaque ? 1 : 0;
  const occ2 = getDef(world.getBlock(s2x, s2y, s2z)).opaque ? 1 : 0;
  const occC = (occ1 && occ2) ? 1 : (getDef(world.getBlock(cx, cy, cz)).opaque ? 1 : 0);

  const aoLevel = 3 - (occ1 + occ2 + occC); // 0..3
  const aoFactor = 0.46 + (aoLevel / 3) * 0.54;

  // Average light from non-opaque samples around the vertex
  let skySum = world.getSkyLight(bx, by, bz);
  let blkSum = world.getBlockLight(bx, by, bz);
  let count = 1;

  if (!occ1) {
    skySum += world.getSkyLight(s1x, s1y, s1z);
    blkSum += world.getBlockLight(s1x, s1y, s1z);
    count++;
  }
  if (!occ2) {
    skySum += world.getSkyLight(s2x, s2y, s2z);
    blkSum += world.getBlockLight(s2x, s2y, s2z);
    count++;
  }
  if (!occC && !(occ1 && occ2)) {
    skySum += world.getSkyLight(cx, cy, cz);
    blkSum += world.getBlockLight(cx, cy, cz);
    count++;
  }

  return {
    ao: aoFactor,
    sky: (skySum / count) / 15,
    blk: (blkSum / count) / 15,
  };
}

function shouldRenderFace(selfId, selfDef, neighborId, neighborDef) {
  if (neighborId === BLOCK.AIR) return true;
  if (selfDef.renderType === RENDER_TYPE.FLUID) {
    if (neighborId === selfId) return false;
    return !neighborDef.opaque;
  }
  if (selfDef.renderType === RENDER_TYPE.CUTOUT) {
    if (neighborId === selfId && selfId === BLOCK.GLASS) return false;
    return !neighborDef.opaque;
  }
  return !neighborDef.opaque;
}

export function buildChunkMeshes(chunk, world, textureManager) {
  const solidBuilder = new GeometryBuilder();
  const fluidBuilder = new GeometryBuilder();

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const wx = baseX + lx;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const id = chunk.get(lx, y, lz);
        if (id === BLOCK.AIR) continue;

        const def = getDef(id);
        const rt = def.renderType;

        if (rt === RENDER_TYPE.CROSS) {
          emitCrossFlora(solidBuilder, lx, y, lz, wx, wz, def, world, textureManager);
          continue;
        }

        if (rt === RENDER_TYPE.TORCH) {
          emitTorchMesh(solidBuilder, lx, y, lz, wx, wz, id, def, world, textureManager);
          continue;
        }

        const isFluid = rt === RENDER_TYPE.FLUID;
        const builder = isFluid ? fluidBuilder : solidBuilder;
        // Slightly lower top surface of fluids unless another fluid is above
        const fluidTopDrop = isFluid && world.getBlock(wx, y + 1, wz) !== id ? 0.12 : 0.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.dir;
          const nId = world.getBlock(wx + nx, y + ny, wz + nz);
          const nDef = getDef(nId);

          if (!shouldRenderFace(id, def, nId, nDef)) continue;

          const uv = textureManager.getUV(def.tex[face.texKey]);
          const vertIndices = [];
          const aos = [];

          for (let v = 0; v < 4; v++) {
            const fv = face.verts[v];
            const [vx, vy, vz] = fv.pos;
            const py = vy === 1 ? y + 1 - fluidTopDrop : y;
            const uCoord = fv.uv[0] === 0 ? uv.u0 : uv.u1;
            const vCoord = fv.uv[1] === 0 ? uv.v0 : uv.v1;

            let ao = 1.0, sky = 1.0, blk = 0.0;
            if (isFluid) {
              sky = world.getSkyLight(wx + nx, y + ny, wz + nz) / 15;
              blk = Math.max(def.light, world.getBlockLight(wx + nx, y + ny, wz + nz)) / 15;
            } else {
              const s = sampleVertexAOAndLight(world, wx, y, wz, nx, ny, nz, vx, vy, vz);
              ao = s.ao;
              sky = s.sky;
              blk = Math.max(def.light / 15, s.blk);
            }

            aos.push(ao);
            const c = face.shade * ao;
            vertIndices.push(
              builder.pushVertex(
                lx + vx, py, lz + vz,
                nx, ny, nz,
                uCoord, vCoord,
                c, c, c,
                sky, blk
              )
            );
          }

          const flip = aos[0] + aos[2] < aos[1] + aos[3];
          builder.pushQuad(vertIndices[0], vertIndices[1], vertIndices[2], vertIndices[3], flip);
        }
      }
    }
  }

  return {
    solidGeometry: solidBuilder.toBufferGeometry(),
    fluidGeometry: fluidBuilder.toBufferGeometry(),
  };
}

function emitCrossFlora(builder, lx, y, lz, wx, wz, def, world, textureManager) {
  const uv = textureManager.getUV(def.tex.side);
  const sky = world.getSkyLight(wx, y, wz) / 15;
  const blk = Math.max(def.light, world.getBlockLight(wx, y, wz)) / 15;
  const c = 0.92;

  // Deterministic subtle organic offset within block so meadows look natural
  const jx = (((wx * 73856093) ^ (wz * 19349663)) & 15) / 15 * 0.22 - 0.11;
  const jz = (((wx * 83492791) ^ (wz * 2971215073)) & 15) / 15 * 0.22 - 0.11;

  const planes = [
    [0.15 + jx, 0.15 + jz, 0.85 + jx, 0.85 + jz],
    [0.15 + jx, 0.85 + jz, 0.85 + jx, 0.15 + jz],
  ];

  for (const [x0, z0, x1, z1] of planes) {
    // Both sides of each diagonal plane
    const emitSide = (ax, az, bx, bz) => {
      const i0 = builder.pushVertex(lx + ax, y + 1, lz + az, 0, 1, 0, uv.u0, uv.v0, c, c, c, sky, blk);
      const i1 = builder.pushVertex(lx + ax, y, lz + az, 0, 1, 0, uv.u0, uv.v1, c * 0.82, c * 0.82, c * 0.82, sky, blk);
      const i2 = builder.pushVertex(lx + bx, y, lz + bz, 0, 1, 0, uv.u1, uv.v1, c * 0.82, c * 0.82, c * 0.82, sky, blk);
      const i3 = builder.pushVertex(lx + bx, y + 1, lz + bz, 0, 1, 0, uv.u1, uv.v0, c, c, c, sky, blk);
      builder.pushQuad(i0, i1, i2, i3, false);
    };
    emitSide(x0, z0, x1, z1);
    emitSide(x1, z1, x0, z0);
  }
}

function emitTorchMesh(builder, lx, y, lz, wx, wz, id, def, world, textureManager) {
  const uv = textureManager.getUV(def.tex.side);
  const sky = world.getSkyLight(wx, y, wz) / 15;
  const blk = Math.max(def.light, world.getBlockLight(wx, y, wz)) / 15;

  const isLantern = id === BLOCK.LANTERN;
  const halfW = isLantern ? 0.2 : 0.085;
  const height = isLantern ? 0.72 : 0.68;

  // Small 3D rectangular prism centered at (0.5, y, 0.5)
  const x0 = lx + 0.5 - halfW;
  const x1 = lx + 0.5 + halfW;
  const z0 = lz + 0.5 - halfW;
  const z1 = lz + 0.5 + halfW;
  const y0 = y;
  const y1 = y + height;

  // Crop center column of torch/lantern texture so it maps cleanly onto thin 3D post
  const uMid0 = uv.u0 + (uv.u1 - uv.u0) * (isLantern ? 0.25 : 0.38);
  const uMid1 = uv.u0 + (uv.u1 - uv.u0) * (isLantern ? 0.75 : 0.62);
  const vTop = uv.v0 + (uv.v1 - uv.v0) * (isLantern ? 0.06 : 0.12);
  const vBot = uv.v1;

  const sides = [
    [x0, z1, x1, z1, 0.95], // +Z
    [x1, z0, x0, z0, 0.92], // -Z
    [x1, z1, x1, z0, 0.88], // +X
    [x0, z0, x0, z1, 0.88], // -X
  ];

  for (const [ax, az, bx, bz, sh] of sides) {
    const i0 = builder.pushVertex(ax, y1, az, 0, 1, 0, uMid0, vTop, sh, sh, sh, sky, blk);
    const i1 = builder.pushVertex(ax, y0, az, 0, 1, 0, uMid0, vBot, sh, sh, sh, sky, blk);
    const i2 = builder.pushVertex(bx, y0, bz, 0, 1, 0, uMid1, vBot, sh, sh, sh, sky, blk);
    const i3 = builder.pushVertex(bx, y1, bz, 0, 1, 0, uMid1, vTop, sh, sh, sh, sky, blk);
    builder.pushQuad(i0, i1, i2, i3, false);
  }

  // Glowing top cap
  const vCap1 = uv.v0 + (uv.v1 - uv.v0) * 0.32;
  const t0 = builder.pushVertex(x0, y1, z0, 0, 1, 0, uMid0, vTop, 1, 1, 1, sky, 1.0);
  const t1 = builder.pushVertex(x0, y1, z1, 0, 1, 0, uMid0, vCap1, 1, 1, 1, sky, 1.0);
  const t2 = builder.pushVertex(x1, y1, z1, 0, 1, 0, uMid1, vCap1, 1, 1, 1, sky, 1.0);
  const t3 = builder.pushVertex(x1, y1, z0, 0, 1, 0, uMid1, vTop, 1, 1, 1, sky, 1.0);
  builder.pushQuad(t0, t1, t2, t3, false);
}
