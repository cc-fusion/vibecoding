// Chunk meshing: face-culled voxel geometry with per-vertex ambient occlusion
// and smooth baked lighting. Separate passes: opaque / cutout / water / lava.
import * as THREE from 'three';
import { B, blockDef } from './blocks';
import { CHUNK, WORLD_H, idx, type Chunk, type World } from './world';
import { initTextures, getTileUV, getWaterTexture, getLavaTexture } from './textures';

// corner: [x,y,z,u,v]; indices per quad: 0,1,2, 2,1,3
const FACES: { dir: [number, number, number]; tile: number; corners: [number, number, number, number, number][] }[] = [
  { dir: [-1, 0, 0], tile: 1, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], tile: 0, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], tile: 3, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], tile: 2, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], tile: 5, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], tile: 4, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_CURVE = [0.45, 0.65, 0.82, 1.0];

function faceShade(dir: [number, number, number]): number {
  if (dir[1] === 1) return 1.0;
  if (dir[1] === -1) return 0.52;
  if (dir[0] !== 0) return 0.78;
  return 0.63;
}

// ---------- materials ----------
export const terrainUniforms = {
  uDay: { value: 1 },
  uTime: { value: 0 },
};

const VERT = /* glsl */`
attribute vec3 aColor;
attribute vec2 aLight;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vLight;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vColor = aColor;
  vLight = aLight;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform float uDay;
uniform float uOpacity;
uniform float uEmissive;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vLight;
#include <fog_pars_fragment>
void main() {
  vec4 tex = texture2D(map, vUv);
  #ifdef ALPHATEST
    if (tex.a < 0.5) discard;
  #endif
  float sunI = pow(vLight.x, 1.35) * mix(0.06, 1.0, uDay);
  float blkI = pow(vLight.y, 1.5);
  vec3 skyCol = mix(vec3(0.5, 0.62, 0.95), vec3(1.02, 0.99, 0.94), uDay);
  vec3 lightCol = max(skyCol * sunI, vec3(1.0, 0.7, 0.4) * blkI);
  lightCol = max(lightCol, vec3(1.0, 0.75, 0.5) * uEmissive);
  vec3 col = tex.rgb * vColor * lightCol;
  gl_FragColor = vec4(col, tex.a * uOpacity);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

function makeMat(opts: { map: THREE.Texture; alphaTest?: boolean; transparent?: boolean; opacity?: number; emissive?: number; doubleSide?: boolean }) {
  const uniforms: Record<string, THREE.IUniform> = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    map: { value: opts.map },
    uDay: terrainUniforms.uDay,
    uTime: terrainUniforms.uTime,
    uOpacity: { value: opts.opacity ?? 1 },
    uEmissive: { value: opts.emissive ?? 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    defines: opts.alphaTest ? { ALPHATEST: 1 } : {},
    transparent: !!opts.transparent,
    depthWrite: !opts.transparent,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    fog: true,
  });
  return m;
}

export interface TerrainMaterials { opaque: THREE.Material; cutout: THREE.Material; water: THREE.Material; lava: THREE.Material }
let mats: TerrainMaterials | null = null;
export function getTerrainMaterials(): TerrainMaterials {
  if (mats) return mats;
  const atlas = initTextures();
  mats = {
    opaque: makeMat({ map: atlas }),
    cutout: makeMat({ map: atlas, alphaTest: true, doubleSide: true }),
    water: makeMat({ map: getWaterTexture(), transparent: true, opacity: 0.75, doubleSide: true }),
    lava: makeMat({ map: getLavaTexture(), transparent: true, opacity: 0.92, emissive: 0.55, doubleSide: true }),
  };
  return mats;
}

// ---------- geometry building ----------
class GeoBucket {
  pos: number[] = []; uv: number[] = []; col: number[] = []; light: number[] = []; index: number[] = [];
  quad(corners: [number, number, number][], uvs: [number, number][], shadeCols: number[], lights: [number, number][], flip: boolean) {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(corners[i][0], corners[i][1], corners[i][2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const s = shadeCols[i];
      this.col.push(s, s, s);
      this.light.push(lights[i][0], lights[i][1]);
    }
    if (flip) this.index.push(base, base + 1, base + 3, base, base + 3, base + 2);
    else this.index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  build(): THREE.BufferGeometry | null {
    if (!this.index.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aLight', new THREE.Float32BufferAttribute(this.light, 2));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

export function buildChunkGeometry(world: World, chunk: Chunk): Record<keyof TerrainMaterials, THREE.BufferGeometry | null> {
  initTextures();
  const bOpaque = new GeoBucket(), bCutout = new GeoBucket(), bWater = new GeoBucket(), bLava = new GeoBucket();
  const { cx, cz } = chunk;

  // 3x3 chunk neighbourhood for fast sampling (coords are chunk-local, -1..16 needed)
  const datas: (Uint8Array | null)[] = [], lights: (Uint8Array | null)[] = [], metas: (Uint8Array | null)[] = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.getChunk(cx + dx, cz + dz);
    datas.push(c ? c.data : null); lights.push(c ? c.light : null); metas.push(c ? c.meta : null);
  }
  const sampleB = (x: number, y: number, z: number): number => {
    if (y < 0) return B.Bedrock; if (y >= WORLD_H) return B.Air;
    const ci = ((z < 0 ? 0 : z > 15 ? 2 : 1)) * 3 + ((x < 0 ? 0 : x > 15 ? 2 : 1));
    const d = datas[ci]; if (!d) return B.Air;
    return d[idx(x & 15, y, z & 15)];
  };
  const sampleL = (x: number, y: number, z: number): number => {
    if (y >= WORLD_H) return 15 << 4; if (y < 0) return 0;
    const ci = ((z < 0 ? 0 : z > 15 ? 2 : 1)) * 3 + ((x < 0 ? 0 : x > 15 ? 2 : 1));
    const l = lights[ci]; if (!l) return 15 << 4;
    return l[idx(x & 15, y, z & 15)];
  };
  const sampleM = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= WORLD_H) return 0;
    const ci = ((z < 0 ? 0 : z > 15 ? 2 : 1)) * 3 + ((x < 0 ? 0 : x > 15 ? 2 : 1));
    const m = metas[ci]; return m ? m[idx(x & 15, y, z & 15)] : 0;
  };
  const occludes = (id: number) => blockDef(id).opaque;

  for (let y = 0; y < WORLD_H; y++) for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    const id = chunk.data[idx(lx, y, lz)];
    if (id === B.Air) continue;
    const def = blockDef(id);

    if (def.shape === 'cross') {
      const [u0, v0, u1, v1] = getTileUV(def.tiles[0]);
      const l = sampleL(lx, y, lz);
      const li: [number, number] = [(l >> 4) / 15, (l & 15) / 15];
      const uvs: [number, number][] = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      const shades = [1, 1, 1, 1];
      const lights4: [number, number][] = [li, li, li, li];
      bCutout.quad([[lx, y, lz], [lx + 1, y, lz + 1], [lx, y + 1, lz], [lx + 1, y + 1, lz + 1]], uvs, shades, lights4, false);
      bCutout.quad([[lx + 1, y, lz], [lx, y, lz + 1], [lx + 1, y + 1, lz], [lx, y + 1, lz + 1]], uvs, shades, lights4, false);
      continue;
    }

    const isLiquid = def.shape === 'liquid';
    const bucket = isLiquid ? (id === B.Water ? bWater : bLava) : (id === B.Glass ? bCutout : bOpaque);
    const level = isLiquid ? sampleM(lx, y, lz) : 0;
    const aboveSame = isLiquid && sampleB(lx, y + 1, lz) === id;
    const yDrop = isLiquid && !aboveSame ? 0.14 + level * 0.04 : 0;
    const inset = def.shape === 'cactus' ? 0.075 : 0;

    for (const face of FACES) {
      const [dx, dy, dz] = face.dir;
      const nx = lx + dx, ny = y + dy, nz = lz + dz;
      const nid = sampleB(nx, ny, nz);
      const ndef = blockDef(nid);
      // culling
      if (isLiquid) {
        if (nid === id) continue;
        if (ndef.opaque) continue;
        if (dy === 1 && aboveSame) continue;
      } else if (def.shape === 'cactus') {
        if (dy !== 0 && nid === B.Cactus) continue;
        if (ndef.opaque && dy === 0) continue;
      } else {
        if (ndef.opaque) continue;
        if (id === B.Glass && nid === B.Glass) continue;
      }

      const shade = faceShade(face.dir);
      const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
      const t1 = (axis + 1) % 3, t2 = (axis + 2) % 3;

      let tileUV: [number, number, number, number];
      if (isLiquid) tileUV = [0, 0, 1, 1];
      else tileUV = getTileUV(def.tiles[face.tile]);
      const [tu0, tv0, tu1, tv1] = tileUV;

      const corners: [number, number, number][] = [];
      const uvs: [number, number][] = [];
      const shadeCols: number[] = [];
      const lightArr: [number, number][] = [];
      const aoVals: number[] = [];

      for (const c of face.corners) {
        const px = lx + inset + c[0] * (1 - inset * 2);
        const py = y + c[1] - (c[1] === 1 ? yDrop : 0);
        const pz = lz + inset + c[2] * (1 - inset * 2);
        corners.push([px, py, pz]);
        uvs.push([tu0 + c[3] * (tu1 - tu0), tv0 + c[4] * (tv1 - tv0)]);

        if (isLiquid || id === B.Glass || def.shape === 'cactus') {
          const l = isLiquid ? sampleL(lx, y, lz) : sampleL(nx, ny, nz);
          lightArr.push([(l >> 4) / 15, (l & 15) / 15]);
          shadeCols.push(shade);
          aoVals.push(3);
        } else {
          // AO + smooth light
          const o1 = c[t1] === 1 ? 1 : -1, o2 = c[t2] === 1 ? 1 : -1;
          const s1 = [nx, ny, nz]; s1[t1] += o1;
          const s2 = [nx, ny, nz]; s2[t2] += o2;
          const cc = [nx, ny, nz]; cc[t1] += o1; cc[t2] += o2;
          const occ1 = occludes(sampleB(s1[0], s1[1], s1[2])) ? 1 : 0;
          const occ2 = occludes(sampleB(s2[0], s2[1], s2[2])) ? 1 : 0;
          const occC = occludes(sampleB(cc[0], cc[1], cc[2])) ? 1 : 0;
          const ao = (occ1 && occ2) ? 0 : 3 - (occ1 + occ2 + occC);
          aoVals.push(ao);
          const lN = sampleL(nx, ny, nz);
          const l1 = occ1 ? lN : sampleL(s1[0], s1[1], s1[2]);
          const l2 = occ2 ? lN : sampleL(s2[0], s2[1], s2[2]);
          const lC = occC ? lN : sampleL(cc[0], cc[1], cc[2]);
          const sun = ((lN >> 4) + (l1 >> 4) + (l2 >> 4) + (lC >> 4)) / 4 / 15;
          const blk = ((lN & 15) + (l1 & 15) + (l2 & 15) + (lC & 15)) / 4 / 15;
          lightArr.push([sun, blk]);
          shadeCols.push(shade * AO_CURVE[ao]);
        }
      }
      // flip quad diagonal to avoid AO interpolation artifacts
      const flip = (aoVals[0] + aoVals[3]) > (aoVals[1] + aoVals[2]);
      bucket.quad(corners, uvs, shadeCols, lightArr, flip);
    }
  }

  return { opaque: bOpaque.build(), cutout: bCutout.build(), water: bWater.build(), lava: bLava.build() };
}
