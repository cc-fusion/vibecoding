import * as THREE from "three";
import { B, BLOCKS, createAtlas, tileUV } from "./blocks.js";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const WATER_LEVEL = 11;

const FACES = [
  { d: [0, 1, 0], shade: 1, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], texture: "top" },
  { d: [0, -1, 0], shade: 0.61, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], texture: "bottom" },
  { d: [1, 0, 0], shade: 0.84, corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], texture: "side" },
  { d: [-1, 0, 0], shade: 0.78, corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], texture: "side" },
  { d: [0, 0, 1], shade: 0.9, corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], texture: "side" },
  { d: [0, 0, -1], shade: 0.74, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], texture: "side" },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

function geometryFromArrays(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  if (data.colors.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSpriteTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (kind === "grass") {
    ctx.fillStyle = "#f4f4df";
    for (const [x, h, w] of [[5, 13, 3], [9, 24, 3], [14, 17, 4], [20, 28, 3], [26, 16, 3]]) {
      ctx.fillRect(x, 32 - h, w, h);
      ctx.fillRect(x - 2, 32 - h + 5, w + 2, 3);
    }
  } else if (kind === "flower") {
    ctx.fillStyle = "#67956e";
    ctx.fillRect(14, 13, 4, 19);
    ctx.fillRect(9, 22, 6, 3);
    ctx.fillRect(18, 25, 6, 3);
    ctx.fillStyle = "#f7e6cf";
    for (const [x, y] of [[10, 8], [18, 8], [10, 16], [18, 16], [14, 5], [14, 19]]) ctx.fillRect(x, y, 6, 6);
    ctx.fillStyle = "#e7b56b";
    ctx.fillRect(14, 12, 5, 6);
  } else {
    ctx.fillStyle = "#719568";
    for (const [x, y, w, h] of [[7, 17, 19, 13], [11, 11, 14, 15], [4, 21, 12, 9], [20, 20, 9, 10]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#89aa73";
    for (const [x, y] of [[9, 18], [17, 13], [23, 20], [5, 24]]) ctx.fillRect(x, y, 5, 4);
    ctx.fillStyle = "#c56c70";
    for (const [x, y] of [[9, 24], [19, 17], [24, 25], [15, 28]]) ctx.fillRect(x, y, 4, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function crossedGeometry(width, height) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const dx = Math.cos(angle) * width / 2;
    const dz = Math.sin(angle) * width / 2;
    const offset = positions.length / 3;
    positions.push(-dx, 0, -dz, dx, 0, dz, dx, height, dz, -dx, height, -dz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class World {
  constructor(scene, seed, edits = {}, renderDistance = 3) {
    this.scene = scene;
    this.seed = String(seed);
    this.seedNumber = [...this.seed].reduce((n, char) => Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    this.edits = structuredClone(edits || {});
    this.chunks = new Map();
    this.terrainCache = new Map();
    this.queue = [];
    this.centerX = Infinity;
    this.centerZ = Infinity;
    this.renderDistance = renderDistance;

    const atlas = new THREE.CanvasTexture(createAtlas());
    atlas.magFilter = THREE.NearestFilter;
    atlas.minFilter = THREE.NearestFilter;
    atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas = atlas;
    this.solidMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.48 });
    this.waterMaterial = new THREE.MeshPhongMaterial({ color: 0x79b9c3, transparent: true, opacity: 0.69, shininess: 78, specular: 0x9fd8da, side: THREE.DoubleSide, depthWrite: false });
    this.grassMaterial = new THREE.MeshLambertMaterial({ map: makeSpriteTexture("grass"), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.flowerMaterial = new THREE.MeshLambertMaterial({ map: makeSpriteTexture("flower"), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.bushMaterial = new THREE.MeshLambertMaterial({ map: makeSpriteTexture("bush"), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.grassGeometry = crossedGeometry(0.68, 0.76);
    this.flowerGeometry = crossedGeometry(0.62, 0.8);
    this.bushGeometry = crossedGeometry(0.98, 1.05);
    this.woodMaterial = new THREE.MeshLambertMaterial({ color: 0x806047 });
    this.woodLightMaterial = new THREE.MeshLambertMaterial({ color: 0xb48b61 });
    this.fireMaterial = new THREE.MeshBasicMaterial({ color: 0xffb767 });
    this.fireCoreMaterial = new THREE.MeshBasicMaterial({ color: 0xffe6a5 });
    this.rollMaterial = new THREE.MeshLambertMaterial({ color: 0xbd8272 });
    this.rollTrimMaterial = new THREE.MeshLambertMaterial({ color: 0xe4c39c });
    this.pillowMaterial = new THREE.MeshLambertMaterial({ color: 0xe9e9d8 });
    this.spawn = this.findSpawn();
  }

  hash(x, z, salt = 0) {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 1442695041) + this.seedNumber) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  hash3(x, y, z, salt = 0) {
    return this.hash(x + Math.imul(y, 17471), z - Math.imul(y, 5297), salt);
  }

  noise2(x, z, salt = 0) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = mix(this.hash(ix, iz, salt), this.hash(ix + 1, iz, salt), fx);
    const b = mix(this.hash(ix, iz + 1, salt), this.hash(ix + 1, iz + 1, salt), fx);
    return mix(a, b, fz) * 2 - 1;
  }

  noise3(x, y, z, salt = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const sample = (dx, dy, dz) => this.hash3(ix + dx, iy + dy, iz + dz, salt);
    const bottom = mix(mix(sample(0, 0, 0), sample(1, 0, 0), fx), mix(sample(0, 0, 1), sample(1, 0, 1), fx), fz);
    const top = mix(mix(sample(0, 1, 0), sample(1, 1, 0), fx), mix(sample(0, 1, 1), sample(1, 1, 1), fx), fz);
    return mix(bottom, top, fy) * 2 - 1;
  }

  fbm(x, z, salt = 0) {
    return this.noise2(x, z, salt) * 0.58 + this.noise2(x * 2, z * 2, salt + 1) * 0.28 + this.noise2(x * 4, z * 4, salt + 2) * 0.14;
  }

  terrainInfo(x, z) {
    const key = `${x},${z}`;
    const cached = this.terrainCache.get(key);
    if (cached) return cached;
    const continental = this.fbm(x * 0.014, z * 0.014, 10);
    const mountain = smooth(clamp((this.fbm(x * 0.008 + 72, z * 0.008 - 42, 31) - 0.13) / 0.48, 0, 1));
    const moisture = this.fbm(x * 0.019 + 26, z * 0.019 - 88, 42);
    const height = clamp(Math.floor(13 + continental * 9 + this.fbm(x * 0.065, z * 0.065, 51) * 2.6 + mountain * 16), 4, 48);
    let biome = "meadow";
    if (height <= WATER_LEVEL + 2) biome = "coast";
    else if (height >= 29 || mountain > 0.59) biome = "highlands";
    else if (moisture < -0.23) biome = "drylands";
    else if (moisture > 0.09) biome = "woodland";
    const info = { height, biome, mountain, moisture };
    if (this.terrainCache.size > 95000) this.terrainCache.clear();
    this.terrainCache.set(key, info);
    return info;
  }

  findSpawn() {
    let best = null;
    for (let z = -24; z <= 24; z += 2) {
      for (let x = -24; x <= 24; x += 2) {
        const info = this.terrainInfo(x, z);
        if (info.height < WATER_LEVEL + 3 || info.height > 26 || info.biome === "highlands") continue;
        const slope = Math.abs(this.terrainInfo(x + 2, z).height - info.height) + Math.abs(this.terrainInfo(x, z + 2).height - info.height);
        const score = Math.hypot(x, z) + slope * 2 + (info.biome === "meadow" ? -5 : 4);
        if (!best || score < best.score) best = { x, z, y: info.height + 1, score };
      }
    }
    return best || { x: 0, z: 0, y: this.terrainInfo(0, 0).height + 1 };
  }

  index(x, y, z) {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const place = (wx, y, wz, id, onlyAir = false) => {
      const lx = wx - x0, lz = wz - z0;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      const index = this.index(lx, y, lz);
      if (!onlyAir || data[index] === B.AIR) data[index] = id;
    };

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = x0 + x, wz = z0 + z;
        const { height, biome } = this.terrainInfo(wx, wz);
        for (let y = 0; y <= Math.max(height, WATER_LEVEL); y++) {
          let id = B.AIR;
          if (y > height) id = B.WATER;
          else if (y === height) id = biome === "coast" ? B.SAND : biome === "highlands" && height > 33 ? B.SNOW : biome === "drylands" ? B.DRY_GRASS : B.GRASS;
          else if (y > height - 4) id = biome === "coast" ? B.SAND : biome === "highlands" && height > 33 ? B.STONE : B.DIRT;
          else if (y > 1) {
            id = B.STONE;
            if (y < height - 4 && y > 3) {
              const caveA = this.noise3(wx * 0.084, y * 0.095, wz * 0.084, 71);
              const caveB = this.noise3(wx * 0.084 + 47, y * 0.095 - 53, wz * 0.084 + 91, 72);
              if (caveA * caveA + caveB * caveB < 0.047) id = B.AIR;
              else if (this.hash3(wx, y, wz, 88) > 0.978) id = y < 19 && this.hash3(wx, y, wz, 89) > 0.58 ? B.IRON_ORE : B.COAL_ORE;
            }
          } else id = B.STONE;
          data[this.index(x, y, z)] = id;
        }
        if (biome === "coast" && height > WATER_LEVEL - 3 && this.hash(wx, wz, 155) > 0.77) {
          place(wx, height, wz, this.hash(wx, wz, 156) > 0.62 ? B.CLAY : B.GRAVEL);
        }
      }
    }

    const grid = 6;
    for (let gz = Math.floor((z0 - 3) / grid); gz <= Math.floor((z0 + CHUNK_SIZE + 3) / grid); gz++) {
      for (let gx = Math.floor((x0 - 3) / grid); gx <= Math.floor((x0 + CHUNK_SIZE + 3) / grid); gx++) {
        const wx = gx * grid + 1 + Math.floor(this.hash(gx, gz, 201) * 5);
        const wz = gz * grid + 1 + Math.floor(this.hash(gx, gz, 202) * 5);
        const info = this.terrainInfo(wx, wz);
        const chance = info.biome === "woodland" ? 0.66 : info.biome === "meadow" ? 0.21 : info.biome === "highlands" ? 0.27 : info.biome === "drylands" ? 0.065 : 0;
        if (this.hash(gx, gz, 203) > chance || info.height <= WATER_LEVEL + 1 || Math.hypot(wx - this.spawn.x, wz - this.spawn.z) < 7) continue;
        if (Math.abs(this.terrainInfo(wx + 2, wz).height - info.height) > 2 || Math.abs(this.terrainInfo(wx, wz + 2).height - info.height) > 2) continue;
        const pine = info.biome === "highlands" || this.hash(gx, gz, 204) > 0.86;
        const trunk = pine ? 6 + Math.floor(this.hash(gx, gz, 205) * 2) : 4 + Math.floor(this.hash(gx, gz, 206) * 2);
        const baseY = info.height + 1;

        if (pine) {
          for (let dy = 2; dy <= trunk + 1; dy++) {
            const radius = dy === trunk + 1 ? 0 : dy % 2 === 0 ? 2 : 1;
            for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
              place(wx + dx, baseY + dy, wz + dz, B.LEAVES, true);
            }
          }
        } else {
          for (let dy = trunk - 2; dy <= trunk + 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
              const distance = dx * dx + dz * dz + (dy - trunk) * (dy - trunk) * 1.35;
              if (distance > 7 || (distance > 5 && this.hash3(wx + dx, dy, wz + dz, 207) > 0.72)) continue;
              place(wx + dx, baseY + dy, wz + dz, B.LEAVES, true);
            }
          }
        }
        for (let dy = 0; dy < trunk; dy++) place(wx, baseY + dy, wz, B.LOG);
      }
    }

    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x0 + x, wz = z0 + z;
      const info = this.terrainInfo(wx, wz);
      if ((info.biome === "meadow" || info.biome === "woodland") && this.hash(wx, wz, 228) > 0.993 && info.height + 1 < WORLD_HEIGHT) {
        const index = this.index(x, info.height + 1, z);
        if (data[index] === B.AIR) data[index] = B.BERRY_BUSH;
      }
    }

    const changes = this.edits[`${cx},${cz}`];
    if (changes) for (const [index, id] of Object.entries(changes)) data[Number(index)] = id;
    return data;
  }

  createChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    const chunk = { cx, cz, data: this.generateChunk(cx, cz), group: new THREE.Group(), lights: [] };
    chunk.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    this.scene.add(chunk.group);
    this.chunks.set(key, chunk);
    this.buildMesh(chunk);
    return chunk;
  }

  loadInitial(x, z, radius = 1) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) this.createChunk(cx + dx, cz + dz);
    this.update(x, z);
  }

  getBlock(x, y, z) {
    if (y < 0) return B.STONE;
    if (y >= WORLD_HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return B.AIR;
    return chunk.data[this.index(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  setBlock(x, y, z, id) {
    if (y < 1 || y >= WORLD_HEIGHT - 1) return false;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.createChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    const index = this.index(lx, y, lz);
    if (chunk.data[index] === id) return false;
    chunk.data[index] = id;
    const key = `${cx},${cz}`;
    if (!this.edits[key]) this.edits[key] = {};
    this.edits[key][index] = id;
    this.buildMesh(chunk);
    if (lx === 0) this.rebuild(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.rebuild(cx + 1, cz);
    if (lz === 0) this.rebuild(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.rebuild(cx, cz + 1);
    return true;
  }

  rebuild(cx, cz) {
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk) this.buildMesh(chunk);
  }

  buildMesh(chunk) {
    for (const child of [...chunk.group.children]) {
      child.traverse((object) => {
        if (object.geometry && !object.userData.sharedGeometry) object.geometry.dispose();
      });
      chunk.group.remove(child);
    }
    chunk.lights = [];
    const solid = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const water = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const data = chunk.data;
    const local = (x, y, z) => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return B.AIR;
      return data[this.index(x, y, z)];
    };
    const occludes = (id) => id !== B.AIR && id !== B.WATER && id !== B.LEAVES && !BLOCKS[id]?.special;
    const appendFace = (target, x, y, z, face, tile, variation, watery = false) => {
      const offset = target.positions.length / 3;
      const uv = watery ? [0, 0, 1, 1] : tileUV(tile);
      for (let i = 0; i < 4; i++) {
        const vertex = face.corners[i];
        target.positions.push(x + vertex[0], y + (watery && vertex[1] ? 0.84 : vertex[1]), z + vertex[2]);
        target.normals.push(...face.d);
        target.uvs.push(i === 0 || i === 3 ? uv[0] : uv[2], i < 2 ? uv[1] : uv[3]);
        if (!watery) {
          const tangents = [];
          for (let axis = 0; axis < 3; axis++) if (face.d[axis] === 0) tangents.push(axis);
          const side = tangents.map((axis) => vertex[axis] === 0 ? -1 : 1);
          const a = [x + face.d[0], y + face.d[1], z + face.d[2]];
          const b = [...a], c = [...a], corner = [...a];
          b[tangents[0]] += side[0];
          c[tangents[1]] += side[1];
          corner[tangents[0]] += side[0]; corner[tangents[1]] += side[1];
          const sideA = occludes(local(...b)) ? 1 : 0;
          const sideB = occludes(local(...c)) ? 1 : 0;
          const diagonal = occludes(local(...corner)) ? 1 : 0;
          const ao = sideA && sideB ? 0.66 : 1 - (sideA + sideB + diagonal) * 0.095;
          const shade = face.shade * ao * variation;
          target.colors.push(shade, shade, shade);
        }
      }
      target.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    };

    for (let y = 0; y < WORLD_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const id = local(x, y, z);
      if (id === B.AIR || BLOCKS[id]?.special) continue;
      const block = BLOCKS[id];
      const variation = 0.95 + this.hash(chunk.cx * CHUNK_SIZE + x, chunk.cz * CHUNK_SIZE + z, 301) * 0.1;
      for (const face of FACES) {
        const neighbor = local(x + face.d[0], y + face.d[1], z + face.d[2]);
        if (id === B.WATER) {
          if (face.d[1] < 0 || neighbor === B.WATER || (face.d[1] === 0 && neighbor !== B.AIR && neighbor !== B.BERRY_BUSH)) continue;
          appendFace(water, x, y, z, face, "", 1, true);
        } else {
          if (id === B.LEAVES ? neighbor === B.LEAVES || occludes(neighbor) : occludes(neighbor)) continue;
          const tile = block[face.texture] || block.top;
          appendFace(solid, x, y, z, face, tile, variation);
        }
      }
    }

    if (solid.indices.length) {
      const mesh = new THREE.Mesh(geometryFromArrays(solid), this.solidMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chunk.group.add(mesh);
    }
    if (water.indices.length) {
      const mesh = new THREE.Mesh(geometryFromArrays(water), this.waterMaterial);
      mesh.renderOrder = 2;
      chunk.group.add(mesh);
    }
    this.addDecorations(chunk, local);
  }

  addDecorations(chunk, local) {
    const grass = [], flowers = [];
    const x0 = chunk.cx * CHUNK_SIZE, z0 = chunk.cz * CHUNK_SIZE;
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x0 + x, wz = z0 + z;
      const { height, biome } = this.terrainInfo(wx, wz);
      const above = local(x, height + 1, z);
      if (above === B.AIR && [B.GRASS, B.DRY_GRASS, B.SNOW].includes(local(x, height, z))) {
        const density = biome === "woodland" ? 0.37 : biome === "meadow" ? 0.39 : biome === "drylands" ? 0.24 : 0.11;
        if (this.hash(wx, wz, 340) < density) grass.push([x + 0.12 + this.hash(wx, wz, 341) * 0.76, height + 1, z + 0.12 + this.hash(wx, wz, 342) * 0.76, wx, wz, biome]);
        if ((biome === "meadow" || biome === "woodland") && this.hash(wx, wz, 343) < 0.045) flowers.push([x + 0.5, height + 1, z + 0.5, wx, wz]);
      }
      for (let y = 1; y < WORLD_HEIGHT; y++) {
        const id = local(x, y, z);
        if (id === B.TORCH || id === B.CAMPFIRE || id === B.SLEEPING_ROLL || id === B.BERRY_BUSH) this.addSpecial(chunk, id, x, y, z);
      }
    }

    if (grass.length) {
      const mesh = new THREE.InstancedMesh(this.grassGeometry, this.grassMaterial, grass.length);
      mesh.userData.sharedGeometry = true;
      const matrix = new THREE.Matrix4(), color = new THREE.Color();
      grass.forEach(([x, y, z, wx, wz, biome], i) => {
        const rotation = this.hash(wx, wz, 344) * Math.PI;
        const scale = 0.6 + this.hash(wx, wz, 345) * 0.65;
        matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation), new THREE.Vector3(scale, scale, scale));
        mesh.setMatrixAt(i, matrix);
        color.set(biome === "drylands" ? 0xc8b780 : biome === "highlands" ? 0xa1b7a4 : this.hash(wx, wz, 346) > 0.6 ? 0x8fae70 : 0x739b70);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      chunk.group.add(mesh);
    }
    if (flowers.length) {
      const mesh = new THREE.InstancedMesh(this.flowerGeometry, this.flowerMaterial, flowers.length);
      mesh.userData.sharedGeometry = true;
      const matrix = new THREE.Matrix4();
      flowers.forEach(([x, y, z, wx, wz], i) => {
        matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.hash(wx, wz, 347) * Math.PI), new THREE.Vector3(0.7, 0.7, 0.7));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      chunk.group.add(mesh);
    }
  }

  addSpecial(chunk, id, x, y, z) {
    const group = new THREE.Group();
    group.position.set(x + 0.5, y, z + 0.5);
    const box = (w, h, d, material, px, py, pz, rz = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(px, py, pz);
      mesh.rotation.z = rz;
      mesh.castShadow = true;
      group.add(mesh);
    };
    if (id === B.TORCH) {
      box(0.13, 0.56, 0.13, this.woodMaterial, 0, 0.29, 0);
      box(0.19, 0.2, 0.19, this.fireMaterial, 0, 0.66, 0);
      box(0.1, 0.15, 0.1, this.fireCoreMaterial, 0, 0.69, 0);
      chunk.lights.push({ x: chunk.cx * CHUNK_SIZE + x + 0.5, y: y + 0.72, z: chunk.cz * CHUNK_SIZE + z + 0.5, type: "torch" });
    } else if (id === B.CAMPFIRE) {
      box(0.76, 0.16, 0.19, this.woodMaterial, 0, 0.13, 0, Math.PI / 5);
      box(0.76, 0.16, 0.19, this.woodLightMaterial, 0, 0.15, 0, -Math.PI / 5);
      box(0.23, 0.48, 0.2, this.fireMaterial, -0.07, 0.42, 0, -0.24);
      box(0.14, 0.38, 0.15, this.fireCoreMaterial, 0.1, 0.43, 0, 0.25);
      chunk.lights.push({ x: chunk.cx * CHUNK_SIZE + x + 0.5, y: y + 0.55, z: chunk.cz * CHUNK_SIZE + z + 0.5, type: "campfire" });
    } else if (id === B.SLEEPING_ROLL) {
      box(0.88, 0.17, 0.94, this.rollMaterial, 0, 0.09, 0);
      box(0.88, 0.18, 0.13, this.rollTrimMaterial, 0, 0.1, 0.41);
      box(0.63, 0.07, 0.2, this.pillowMaterial, 0, 0.21, -0.27);
    } else if (id === B.BERRY_BUSH) {
      const mesh = new THREE.Mesh(this.bushGeometry, this.bushMaterial);
      mesh.userData.sharedGeometry = true;
      group.add(mesh);
    }
    chunk.group.add(group);
  }

  update(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    if (cx !== this.centerX || cz !== this.centerZ) {
      this.centerX = cx; this.centerZ = cz;
      const needed = [];
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        const key = `${cx + dx},${cz + dz}`;
        if (!this.chunks.has(key)) needed.push({ cx: cx + dx, cz: cz + dz, distance: dx * dx + dz * dz });
      }
      this.queue = needed.sort((a, b) => a.distance - b.distance);
      for (const [key, chunk] of this.chunks) {
        if (Math.abs(chunk.cx - cx) > this.renderDistance || Math.abs(chunk.cz - cz) > this.renderDistance) {
          this.unloadChunk(chunk);
          this.chunks.delete(key);
        }
      }
    }
  }

  processQueue(max = 2) {
    for (let i = 0; i < max && this.queue.length; i++) {
      const next = this.queue.shift();
      if (Math.abs(next.cx - this.centerX) <= this.renderDistance && Math.abs(next.cz - this.centerZ) <= this.renderDistance) this.createChunk(next.cx, next.cz);
    }
  }

  unloadChunk(chunk) {
    chunk.group.traverse((object) => {
      if (object.geometry && !object.userData.sharedGeometry) object.geometry.dispose();
    });
    this.scene.remove(chunk.group);
  }

  nearbyLights(x, z, distance = 19) {
    const lights = [];
    for (const chunk of this.chunks.values()) for (const light of chunk.lights) {
      const d = Math.hypot(light.x - x, light.z - z);
      if (d < distance) lights.push({ ...light, distance: d });
    }
    return lights.sort((a, b) => a.distance - b.distance).slice(0, 7);
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.unloadChunk(chunk);
    this.chunks.clear();
    this.atlas.dispose();
    for (const material of [this.solidMaterial, this.waterMaterial, this.grassMaterial, this.flowerMaterial, this.bushMaterial, this.woodMaterial, this.woodLightMaterial, this.fireMaterial, this.fireCoreMaterial, this.rollMaterial, this.rollTrimMaterial, this.pillowMaterial]) {
      if (material.map && material.map !== this.atlas) material.map.dispose();
      material.dispose();
    }
    this.grassGeometry.dispose(); this.flowerGeometry.dispose(); this.bushGeometry.dispose();
  }
}