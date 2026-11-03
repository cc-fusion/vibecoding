import * as THREE from 'three';
import { B, BLOCKS, createAtlas, isOpaque } from './blocks.js';
import { seedNumber, hash, fbm, noise3 } from './noise.js';

export const CHUNK = 16;
export const HEIGHT = 64;
export const SEA = 14;
const indexOf = (x, y, z) => x + z * CHUNK + y * CHUNK * CHUNK;
const keyOf = (x, z) => `${x},${z}`;
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  quad(corners, normal, tile, shades = [1, 1, 1, 1], tint = [1, 1, 1]) {
    const start = this.p.length / 3, tx = tile % 8, ty = Math.floor(tile / 8), pad = 0.025;
    const u0 = (tx + pad) / 8, u1 = (tx + 1 - pad) / 8;
    const v0 = 1 - (ty + 1 - pad) / 4, v1 = 1 - (ty + pad) / 4;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let j = 0; j < 4; j++) {
      this.p.push(...corners[j]); this.n.push(...normal); this.uv.push(...uv[j]);
      this.c.push(tint[0] * shades[j], tint[1] * shades[j], tint[2] * shades[j]);
    }
    if (shades[0] + shades[2] > shades[1] + shades[3]) this.i.push(start, start + 1, start + 3, start + 1, start + 2, start + 3);
    else this.i.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  box(x, y, z, sx, sy, sz, tile, tint = [1, 1, 1]) {
    for (const face of FACES) this.quad(face.c.map(c => [x + c[0] * sx, y + c[1] * sy, z + c[2] * sz]), face.n, tile, [1, 1, 1, 1], tint);
  }
  geometry() {
    if (!this.p.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    geo.setIndex(this.i); geo.computeBoundingSphere();
    return geo;
  }
}

export class VoxelWorld {
  constructor(scene, seed = 'wildwood', changes = {}, distance = 4) {
    this.scene = scene; this.seed = seedNumber(seed); this.changes = changes;
    this.chunks = new Map(); this.columns = new Map(); this.queue = []; this.dirty = new Set();
    this.distance = distance; this.center = null; this.torches = new Map(); this.timeUniform = { value: 0 };
    this.atlas = createAtlas();
    this.material = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.glassMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });
    this.waterMaterial = new THREE.MeshPhongMaterial({ color: 0x66b4a8, specular: 0xc4eee0, shininess: 95, transparent: true, opacity: 0.77, depthWrite: false, vertexColors: true, side: THREE.DoubleSide });
    this.waterMaterial.onBeforeCompile = shader => {
      shader.uniforms.uWaterTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWaterTime; varying vec3 vWaterWorld;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.x * 0.65 + uWaterTime * 0.8) * 0.025 + sin(position.z * 0.9 + uWaterTime) * 0.02; vWaterWorld = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWaterTime; varying vec3 vWaterWorld;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat ripple = sin(vWaterWorld.x * 1.8 + vWaterWorld.z * 0.8 + uWaterTime) * sin(vWaterWorld.z * 2.5 - uWaterTime * 0.55); diffuseColor.rgb += smoothstep(0.89, 0.98, ripple) * 0.14;');
    };
    this.farMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.farMesh = null;
  }

  column(x, z) {
    const key = keyOf(x, z);
    if (this.columns.has(key)) return this.columns.get(key);
    const riverX = 11 + Math.sin(z * 0.026) * 13 + Math.sin(z * 0.061) * 3;
    const riverDistance = Math.abs(x - riverX);
    let h = 21 + fbm(x * 0.018, z * 0.018, this.seed) * 12 + fbm(x * 0.052, z * 0.052, this.seed + 812) * 3;
    const ridge = Math.max(0, fbm(x * 0.009 + 21, z * 0.009 - 38, this.seed + 1401) + 0.08);
    h += ridge * ridge * 66;
    if (riverDistance < 16) {
      const blend = Math.min(1, Math.max(0, (riverDistance - 4) / 12));
      const eased = blend * blend * (3 - 2 * blend);
      h = (10.5 + Math.min(riverDistance, 5) * 0.4) * (1 - eased) + h * eased;
    }
    h = Math.max(5, Math.min(HEIGHT - 12, Math.floor(h)));
    const moisture = fbm(x * 0.006 + 100, z * 0.006 + 100, this.seed + 801);
    const temperature = fbm(x * 0.005 - 200, z * 0.005 - 200, this.seed + 991);
    let biome = 'Meadow';
    if (h >= 34) biome = 'Alpine';
    else if (Math.abs(x) + Math.abs(z) > 95) {
      if (temperature > 0.08 && moisture < -0.04) biome = 'Dunes';
      else if (moisture > 0.025) biome = 'Woodland';
    }
    const value = { h, biome, riverDistance, moisture };
    this.columns.set(key, value);
    return value;
  }

  baseBlock(x, y, z, col = this.column(x, z)) {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    if (y === 0) return B.BEDROCK;
    if (y > col.h) return y <= SEA ? B.WATER : B.AIR;
    if (y === col.h) {
      if (col.h <= SEA + 1 || col.biome === 'Dunes') return B.SAND;
      if (col.biome === 'Alpine' && col.h > 39) return B.SNOW;
      return B.GRASS;
    }
    if (y > col.h - 3) return col.biome === 'Dunes' || col.h <= SEA ? B.SAND : B.DIRT;
    if (y > 3 && y < col.h - 5 && noise3(x * 0.085, y * 0.12, z * 0.085, this.seed + 991) > 0.77) return B.AIR;
    const ore = hash(x, y, z, this.seed);
    if (ore > 0.974 && y < col.h - 3) return B.COAL;
    if (ore < 0.018 && y < 22) return B.COPPER;
    return B.STONE;
  }

  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), key = keyOf(cx, cz);
    const idx = indexOf(x - cx * CHUNK, y, z - cz * CHUNK), chunk = this.chunks.get(key);
    if (chunk) return chunk.data[idx];
    if (this.changes[key]?.[idx] !== undefined) return this.changes[key][idx];
    return this.baseBlock(x, y, z);
  }

  setBlock(x, y, z, id) {
    if (y <= 0 || y >= HEIGHT) return false;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), key = keyOf(cx, cz);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK, idx = indexOf(lx, y, lz);
    if (!this.chunks.has(key)) this.generate(cx, cz);
    this.chunks.get(key).data[idx] = id;
    (this.changes[key] ||= {})[idx] = id;
    this.dirty.add(key);
    if (lx === 0) this.dirty.add(keyOf(cx - 1, cz));
    if (lx === 15) this.dirty.add(keyOf(cx + 1, cz));
    if (lz === 0) this.dirty.add(keyOf(cx, cz - 1));
    if (lz === 15) this.dirty.add(keyOf(cx, cz + 1));
    return true;
  }

  generate(cx, cz) {
    const key = keyOf(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT), ox = cx * CHUNK, oz = cz * CHUNK;
    for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const wx = ox + x, wz = oz + z, col = this.column(wx, wz);
      for (let y = 0; y <= Math.max(col.h, SEA); y++) data[indexOf(x, y, z)] = this.baseBlock(wx, y, wz, col);
      if (col.h > SEA + 1 && col.biome !== 'Dunes' && col.biome !== 'Alpine') {
        const plant = hash(wx, 79, wz, this.seed);
        if (plant > 0.963) data[indexOf(x, col.h + 1, z)] = B.FLOWER;
        else if (plant > 0.79) data[indexOf(x, col.h + 1, z)] = B.TUFT;
      }
      if (col.biome === 'Dunes' && hash(wx, 91, wz, this.seed) > 0.994) {
        for (let y = 1; y <= 3; y++) data[indexOf(x, col.h + y, z)] = B.CACTUS;
      }
    }
    const put = (x, y, z, id, replace = true) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 1 || y >= HEIGHT) return;
      const i = indexOf(lx, y, lz);
      if (replace || data[i] === 0 || data[i] === B.TUFT || data[i] === B.FLOWER) data[i] = id;
    };
    // Trees use world-space anchors, so canopies are identical on chunk boundaries.
    for (let az = Math.floor((oz - 4) / 6) * 6; az < oz + CHUNK + 4; az += 6) {
      for (let ax = Math.floor((ox - 4) / 6) * 6; ax < ox + CHUNK + 4; ax += 6) {
        const x = ax + Math.floor(hash(ax, 81, az, this.seed) * 4), z = az + Math.floor(hash(ax, 82, az, this.seed) * 4);
        const col = this.column(x, z), chance = col.biome === 'Woodland' ? 0.68 : 0.34;
        if (hash(ax, 83, az, this.seed) > chance || col.riverDistance < 12 || col.h < SEA + 2 || col.biome === 'Dunes' || col.h > 42) continue;
        if (Math.hypot(x - 6, z - 20) < 7) continue;
        const trunk = 4 + Math.floor(hash(ax, 84, az, this.seed) * 3), top = col.h + trunk;
        const pine = col.biome === 'Alpine' || hash(ax, 85, az, this.seed) > 0.85;
        if (pine) {
          for (let yy = 0; yy < 6; yy++) {
            const r = yy === 5 ? 0 : (yy < 2 ? 2 : 1);
            for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) <= r + 1) put(x + dx, top - 2 + yy, z + dz, B.LEAVES, false);
          }
        } else {
          for (let yy = -2; yy <= 1; yy++) {
            const r = yy === 1 ? 1 : 2;
            for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && hash(x + dx, yy, z + dz, this.seed) > 0.35) continue;
              put(x + dx, top + yy, z + dz, B.LEAVES, false);
            }
          }
        }
        for (let y = col.h + 1; y <= top; y++) put(x, y, z, B.LOG);
      }
    }
    if (this.changes[key]) for (const [idx, id] of Object.entries(this.changes[key])) data[Number(idx)] = id;
    const chunk = { cx, cz, data, meshes: [] };
    this.chunks.set(key, chunk);
    return chunk;
  }

  mesh(chunk) {
    for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    chunk.meshes = [];
    const opaque = new MeshBuilder(), water = new MeshBuilder(), glass = new MeshBuilder(), torches = [];
    const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
    const sample = (x, y, z) => {
      if (y < 0) return B.BEDROCK;
      if (y >= HEIGHT) return 0;
      if (x >= ox && x < ox + 16 && z >= oz && z < oz + 16) return chunk.data[indexOf(x - ox, y, z - oz)];
      return this.getBlock(x, y, z);
    };
    for (let y = 1; y < HEIGHT - 1; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const id = chunk.data[indexOf(x, y, z)];
      if (!id) continue;
      const wx = ox + x, wz = oz + z, def = BLOCKS[id];
      if (def.decor) {
        if (id === B.TORCH) {
          opaque.box(wx + 0.44, y, wz + 0.44, 0.12, 0.58, 0.12, 4);
          opaque.box(wx + 0.41, y + 0.52, wz + 0.41, 0.18, 0.22, 0.18, 16, [1.5, 1.4, 1.1]);
          torches.push(new THREE.Vector3(wx + 0.5, y + 0.8, wz + 0.5));
        } else if (id === B.FLOWER) {
          opaque.box(wx + 0.47, y, wz + 0.47, 0.06, 0.55, 0.06, 6);
          const tint = hash(wx, 97, wz, this.seed) > 0.5 ? [1.05, 0.88, 0.77] : [1, 1, 1];
          opaque.box(wx + 0.27, y + 0.42, wz + 0.39, 0.46, 0.08, 0.22, 20, tint);
          opaque.box(wx + 0.39, y + 0.42, wz + 0.27, 0.22, 0.08, 0.46, 20, tint);
          opaque.box(wx + 0.42, y + 0.49, wz + 0.42, 0.16, 0.06, 0.16, 18);
        }
        continue;
      }
      if (id === B.TUFT) {
        const h = 0.3 + hash(wx, 21, wz, this.seed) * 0.3;
        for (let k = 0; k < 2; k++) {
          const a = k * Math.PI / 2 + 0.65, dx = Math.cos(a) * 0.3, dz = Math.sin(a) * 0.3;
          const corners = [[wx + 0.5 - dx, y, wz + 0.5 - dz], [wx + 0.5 + dx, y, wz + 0.5 + dz], [wx + 0.53, y + h, wz + 0.53], [wx + 0.47, y + h * 0.5, wz + 0.47]];
          opaque.quad(corners, [0, 1, 0], 0, [0.85, 0.85, 1, 1]);
          opaque.quad([...corners].reverse(), [0, 1, 0], 0, [1, 1, 0.85, 0.85]);
        }
        continue;
      }
      if (id === B.WATER) {
        if (sample(wx, y + 1, wz) !== B.WATER && !isOpaque(sample(wx, y + 1, wz))) {
          const shore = isOpaque(sample(wx + 1, y, wz)) || isOpaque(sample(wx - 1, y, wz)) || isOpaque(sample(wx, y, wz + 1)) || isOpaque(sample(wx, y, wz - 1));
          water.quad([[wx, y + 0.86, wz + 1], [wx + 1, y + 0.86, wz + 1], [wx + 1, y + 0.86, wz], [wx, y + 0.86, wz]], [0, 1, 0], 0, [1, 1, 1, 1], shore ? [1.05, 1.1, 0.9] : [0.72, 0.91, 0.92]);
        }
        continue;
      }
      const target = id === B.GLASS ? glass : opaque;
      const variation = 0.94 + hash(wx, y, wz, this.seed) * 0.11;
      let tint = [variation, variation, variation];
      if ((id === B.GRASS || id === B.LEAVES) && this.column(wx, wz).biome === 'Woodland') tint = [variation * 0.87, variation, variation * 0.91];
      for (let fi = 0; fi < FACES.length; fi++) {
        const face = FACES[fi], n = face.n, next = sample(wx + n[0], y + n[1], wz + n[2]);
        if (isOpaque(next) || (id === B.GLASS && next === B.GLASS)) continue;
        const tile = fi === 2 ? def.top : fi === 3 ? (def.bottom ?? def.top) : (def.side ?? def.top);
        const axes = n[0] ? [1, 2] : n[1] ? [0, 2] : [0, 1];
        const shade = face.c.map(c => {
          if (id === B.GLASS) return 1;
          const base = [wx + n[0], y + n[1], wz + n[2]], a = [...base], b = [...base], corner = [...base];
          const sa = c[axes[0]] ? 1 : -1, sb = c[axes[1]] ? 1 : -1;
          a[axes[0]] += sa; b[axes[1]] += sb; corner[axes[0]] += sa; corner[axes[1]] += sb;
          const s1 = isOpaque(sample(...a)) ? 1 : 0, s2 = isOpaque(sample(...b)) ? 1 : 0, sc = isOpaque(sample(...corner)) ? 1 : 0;
          return (s1 && s2 ? 0.66 : 1 - (s1 + s2 + sc) * 0.1) * (fi === 3 ? 0.75 : 1);
        });
        target.quad(face.c.map(c => [wx + c[0], y + c[1], wz + c[2]]), n, tile, shade, tint);
      }
    }
    for (const [builder, material] of [[opaque, this.material], [water, this.waterMaterial], [glass, this.glassMaterial]]) {
      const geo = builder.geometry();
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = material === this.material; mesh.receiveShadow = true;
      if (material === this.waterMaterial) mesh.renderOrder = 2;
      this.scene.add(mesh); chunk.meshes.push(mesh);
    }
    this.torches.set(keyOf(chunk.cx, chunk.cz), torches);
  }

  initialize(x = 6, z = 20) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dz = -this.distance; dz <= this.distance; dz++) for (let dx = -this.distance; dx <= this.distance; dx++) this.generate(cx + dx, cz + dz);
    for (const chunk of this.chunks.values()) this.mesh(chunk);
    this.stream(x, z, true);
  }

  ensureNear(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const key = keyOf(cx + dx, cz + dz);
      if (!this.chunks.has(key)) { const chunk = this.generate(cx + dx, cz + dz); this.dirty.add(key); if (!chunk) return; }
    }
  }

  stream(x, z, force = false) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), center = keyOf(cx, cz);
    if (!force && this.center === center) return;
    this.center = center;
    this.queue = [];
    for (let dz = -this.distance; dz <= this.distance; dz++) for (let dx = -this.distance; dx <= this.distance; dx++) {
      if (!this.chunks.has(keyOf(cx + dx, cz + dz))) this.queue.push({ cx: cx + dx, cz: cz + dz, d: dx * dx + dz * dz });
    }
    this.queue.sort((a, b) => a.d - b.d);
    for (const [key, chunk] of this.chunks) if (Math.abs(chunk.cx - cx) > this.distance + 1 || Math.abs(chunk.cz - cz) > this.distance + 1) {
      for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); }
      this.chunks.delete(key); this.torches.delete(key);
    }
    this.buildDistant(cx * CHUNK, cz * CHUNK);
    if (this.columns.size > 160000) this.columns.clear();
  }

  update(time) {
    this.timeUniform.value = time;
    let done = 0;
    for (const key of this.dirty) {
      const chunk = this.chunks.get(key); if (chunk) this.mesh(chunk);
      this.dirty.delete(key); if (++done >= 2) break;
    }
    if (!this.queue.length) return;
    const next = this.queue.shift(), chunk = this.generate(next.cx, next.cz);
    this.mesh(chunk);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const key = keyOf(next.cx + dx, next.cz + dz);
      if (this.chunks.has(key)) this.dirty.add(key);
    }
  }

  buildDistant(cx, cz) {
    if (this.farMesh) { this.scene.remove(this.farMesh); this.farMesh.geometry.dispose(); }
    const p = [], n = [], c = [], indices = [], step = 4, inner = (this.distance + 0.25) * CHUNK, extent = 208;
    const color = new THREE.Color();
    const quad = (points, normal, hex, shade = 1) => {
      const start = p.length / 3; color.setHex(hex); color.multiplyScalar(shade);
      for (const point of points) { p.push(...point); n.push(...normal); c.push(color.r, color.g, color.b); }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (let z = cz - extent; z < cz + extent; z += step) for (let x = cx - extent; x < cx + extent; x += step) {
      if (Math.abs(x - cx) < inner && Math.abs(z - cz) < inner) continue;
      const col = this.column(x, z), h = col.h + 1, east = this.column(x + step, z).h + 1, south = this.column(x, z + step).h + 1;
      const hex = col.biome === 'Dunes' || h <= SEA + 2 ? 0xd2c497 : h > 40 ? 0xe1e5d9 : col.biome === 'Woodland' ? 0x789557 : 0x91ac60;
      if (h > SEA) quad([[x, h, z + step], [x + step, h, z + step], [x + step, h, z], [x, h, z]], [0, 1, 0], hex, 0.95 + hash(x, 4, z) * 0.08);
      else quad([[x, SEA + 0.85, z + step], [x + step, SEA + 0.85, z + step], [x + step, SEA + 0.85, z], [x, SEA + 0.85, z]], [0, 1, 0], 0x79b5a7);
      if (h !== east) quad([[x + step, Math.min(h, east), z + step], [x + step, Math.min(h, east), z], [x + step, Math.max(h, east), z], [x + step, Math.max(h, east), z + step]], [h > east ? 1 : -1, 0, 0], hex, 0.82);
      if (h !== south) quad([[x, Math.min(h, south), z + step], [x + step, Math.min(h, south), z + step], [x + step, Math.max(h, south), z + step], [x, Math.max(h, south), z + step]], [0, 0, h > south ? 1 : -1], hex, 0.88);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); geo.setIndex(indices); geo.computeBoundingSphere();
    this.farMesh = new THREE.Mesh(geo, this.farMaterial); this.farMesh.material.side = THREE.DoubleSide; this.farMesh.receiveShadow = true; this.scene.add(this.farMesh);
  }

  findSpawn() {
    for (let r = 0; r < 25; r++) {
      const x = 6 - Math.floor(r / 4), z = 20 + r % 4, h = this.column(x, z).h;
      this.ensureNear(x, z);
      if (h > SEA + 1 && !isOpaque(this.getBlock(x, h + 1, z)) && !isOpaque(this.getBlock(x, h + 2, z))) return new THREE.Vector3(x + 0.5, h + 1.01, z + 0.5);
    }
    return new THREE.Vector3(6.5, this.column(6, 20).h + 8, 20.5);
  }

  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z), distance = 0, normal = [0, 0, 0];
    const sx = direction.x >= 0 ? 1 : -1, sy = direction.y >= 0 ? 1 : -1, sz = direction.z >= 0 ? 1 : -1;
    const dx = Math.abs(1 / direction.x), dy = Math.abs(1 / direction.y), dz = Math.abs(1 / direction.z);
    let tx = (direction.x >= 0 ? x + 1 - origin.x : origin.x - x) * dx;
    let ty = (direction.y >= 0 ? y + 1 - origin.y : origin.y - y) * dy;
    let tz = (direction.z >= 0 ? z + 1 - origin.z : origin.z - z) * dz;
    if (!Number.isFinite(tx)) tx = Infinity; if (!Number.isFinite(ty)) ty = Infinity; if (!Number.isFinite(tz)) tz = Infinity;
    for (let i = 0; i < 128 && distance <= maxDistance; i++) {
      const id = this.getBlock(x, y, z);
      if (id && id !== B.WATER && id !== B.TUFT) return { x, y, z, id, normal, distance };
      if (tx < ty && tx < tz) { distance = tx; tx += dx; x += sx; normal = [-sx, 0, 0]; }
      else if (ty < tz) { distance = ty; ty += dy; y += sy; normal = [0, -sy, 0]; }
      else { distance = tz; tz += dz; z += sz; normal = [0, 0, -sz]; }
    }
    return null;
  }

  dispose() {
    for (const chunk of this.chunks.values()) for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    if (this.farMesh) { this.scene.remove(this.farMesh); this.farMesh.geometry.dispose(); }
    this.material.dispose(); this.waterMaterial.dispose(); this.glassMaterial.dispose(); this.farMaterial.dispose(); this.atlas.dispose();
    this.chunks.clear(); this.columns.clear();
  }
}