import * as THREE from 'three';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 48;
export const SEA_LEVEL = 10;

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANK: 7,
  COAL_ORE: 8,
  IRON_ORE: 9,
  WATER: 10,
  GRAVEL: 11,
  SNOW: 12,
  TORCH: 13,
  BEDROCK: 14,
};

const ATLAS_TILE = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  bark: 5,
  logTop: 6,
  leaves: 7,
  plank: 8,
  coal: 9,
  iron: 10,
  gravel: 11,
  snow: 12,
  flame: 13,
  bedrock: 15,
};

const FACE_DEFS = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.78 },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.78 },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.08 },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.58 },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.91 },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.72 },
];

const BLOCK_FACES = {
  [BLOCK.GRASS]: [ATLAS_TILE.grassSide, ATLAS_TILE.grassSide, ATLAS_TILE.grassTop, ATLAS_TILE.dirt, ATLAS_TILE.grassSide, ATLAS_TILE.grassSide],
  [BLOCK.DIRT]: Array(6).fill(ATLAS_TILE.dirt),
  [BLOCK.STONE]: Array(6).fill(ATLAS_TILE.stone),
  [BLOCK.SAND]: Array(6).fill(ATLAS_TILE.sand),
  [BLOCK.LOG]: [ATLAS_TILE.bark, ATLAS_TILE.bark, ATLAS_TILE.logTop, ATLAS_TILE.logTop, ATLAS_TILE.bark, ATLAS_TILE.bark],
  [BLOCK.LEAVES]: Array(6).fill(ATLAS_TILE.leaves),
  [BLOCK.PLANK]: Array(6).fill(ATLAS_TILE.plank),
  [BLOCK.COAL_ORE]: Array(6).fill(ATLAS_TILE.coal),
  [BLOCK.IRON_ORE]: Array(6).fill(ATLAS_TILE.iron),
  [BLOCK.GRAVEL]: Array(6).fill(ATLAS_TILE.gravel),
  [BLOCK.SNOW]: Array(6).fill(ATLAS_TILE.snow),
  [BLOCK.BEDROCK]: Array(6).fill(ATLAS_TILE.bedrock),
};

const WATER_VERTEX = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 p = position;
    float wave = sin((position.x + position.z * 0.6) * 0.52 + uTime * 1.15) * 0.026
      + cos((position.z - position.x * 0.35) * 0.43 + uTime * 0.82) * 0.02;
    if (normal.y > 0.5) p.y += wave;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWave = wave;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.1);
    float ripple = 0.5 + 0.5 * sin((vWorld.x + vWorld.z) * 1.1 + uTime * 1.4);
    vec3 deep = vec3(0.055, 0.29, 0.34);
    vec3 bright = vec3(0.22, 0.67, 0.68);
    vec3 color = mix(deep, bright, 0.24 + fresnel * 0.72 + ripple * 0.08 + vWave * 1.6);
    gl_FragColor = vec4(color, 0.76);
  }
`;

function intHash(x, z, seed = 0) {
  let h = Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(z | 0, 0x119de1f3) ^ (seed | 0);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

function intHash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ Math.imul(z | 0, 0x6c8e9cf5) ^ (seed | 0);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

export function hashUnit(x, z, seed = 0) {
  return intHash(x, z, seed) / 4294967295;
}

function hashUnit3(x, y, z, seed) {
  return intHash3(x, y, z, seed) / 4294967295;
}

function smooth(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function noise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hashUnit(ix, iz, seed);
  const b = hashUnit(ix + 1, iz, seed);
  const c = hashUnit(ix, iz + 1, seed);
  const d = hashUnit(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

function fractal2(x, z, seed, octaves = 4) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * frequency, z * frequency, seed + i * 97) * amplitude;
    weight += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return sum / weight;
}

function noise3(x, y, z, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const samples = [];
  for (let dz = 0; dz <= 1; dz += 1) {
    for (let dy = 0; dy <= 1; dy += 1) {
      samples.push([
        hashUnit3(ix, iy + dy, iz + dz, seed),
        hashUnit3(ix + 1, iy + dy, iz + dz, seed),
      ]);
    }
  }
  const z0 = lerp(lerp(samples[0][0], samples[0][1], fx), lerp(samples[1][0], samples[1][1], fx), fy);
  const z1 = lerp(lerp(samples[2][0], samples[2][1], fx), lerp(samples[3][0], samples[3][1], fx), fy);
  return lerp(z0, z1, fz);
}

function key2(x, z) {
  return `${x},${z}`;
}

function blockIndex(x, y, z) {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function colorCanvasTile(ctx, x, y, base, accents, seed, textureKind = 'speckle') {
  const size = 16;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, size, size);
  const random = (n) => hashUnit(n, seed, seed + 191);
  if (textureKind === 'bark') {
    for (let i = 0; i < 10; i += 1) {
      ctx.fillStyle = accents[i % accents.length];
      const px = x + Math.floor(random(i + 17) * 15);
      const py = y + Math.floor(random(i + 39) * 16);
      ctx.fillRect(px, py, 1 + Math.floor(random(i + 51) * 2), 3 + Math.floor(random(i + 61) * 7));
    }
    return;
  }
  if (textureKind === 'rings') {
    ctx.fillStyle = accents[0];
    ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = base;
    ctx.fillRect(x + 4, y + 4, 8, 8);
    ctx.fillStyle = accents[1];
    ctx.fillRect(x + 6, y + 6, 4, 4);
    ctx.fillStyle = base;
    ctx.fillRect(x + 7, y + 7, 2, 2);
    return;
  }
  if (textureKind === 'plank') {
    for (let row = 0; row < 4; row += 1) {
      const py = y + row * 4;
      ctx.fillStyle = accents[row % accents.length];
      ctx.fillRect(x, py, size, 1);
      ctx.fillStyle = row % 2 === 0 ? base : accents[(row + 1) % accents.length];
      ctx.fillRect(x + (row % 2) * 5 + 3, py + 2, 1, 1);
    }
    return;
  }
  if (textureKind === 'grassSide') {
    ctx.fillStyle = accents[0];
    ctx.fillRect(x, y, size, 4);
    ctx.fillStyle = accents[1];
    ctx.fillRect(x + 2, y + 3, 3, 2);
    ctx.fillRect(x + 10, y + 2, 2, 3);
  }
  const specks = textureKind === 'grassSide' ? 18 : 30;
  for (let i = 0; i < specks; i += 1) {
    ctx.fillStyle = accents[i % accents.length];
    const px = x + Math.floor(random(i + 3) * 16);
    const py = y + Math.floor(random(i + 41) * 16);
    const side = 1 + Math.floor(random(i + 101) * 2);
    ctx.fillRect(px, py, side, side);
  }
}

export function createBlockAtlas() {
  const tileSize = 16;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * 4;
  canvas.height = tileSize * 4;
  const ctx = canvas.getContext('2d');
  const tiles = [
    ['#75ad4a', ['#8cc657', '#568d3a', '#6ca247'], 'speckle'],
    ['#805837', ['#6e9b3f', '#81b34c', '#6d4a30'], 'grassSide'],
    ['#806043', ['#8e6b4a', '#73543b', '#98704a'], 'speckle'],
    ['#7a7e7b', ['#929690', '#646a68', '#858a86'], 'speckle'],
    ['#d2bd82', ['#e0ce98', '#bea975', '#e9d5a0'], 'speckle'],
    ['#785037', ['#936746', '#65442f', '#a0724e'], 'bark'],
    ['#986b48', ['#68472f', '#c3935e'], 'rings'],
    ['#477d48', ['#65a254', '#326b43', '#80ad5d'], 'speckle'],
    ['#ad8052', ['#bd9461', '#956b43', '#d0a36b'], 'plank'],
    ['#777c79', ['#262b2d', '#323738', '#a2a39a'], 'speckle'],
    ['#827f77', ['#d4b57f', '#a48e68', '#656b69'], 'speckle'],
    ['#99958a', ['#c4beaf', '#777972', '#aba79d'], 'speckle'],
    ['#e6ece7', ['#cadbdc', '#f6f5e8', '#bacdce'], 'speckle'],
    ['#f0a64d', ['#ffd978', '#ffcf66', '#e8753b'], 'speckle'],
    ['#45545a', ['#344045', '#5b6869', '#222c32'], 'speckle'],
    ['#424649', ['#313539', '#676964', '#292e32'], 'speckle'],
  ];
  tiles.forEach(([base, accents, kind], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    colorCanvasTile(ctx, col * tileSize, row * tileSize, base, accents, index * 31 + 7, kind);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function tileUv(tile) {
  const col = tile % 4;
  const row = Math.floor(tile / 4);
  const atlasSize = 64;
  const inset = 0.55 / atlasSize;
  const u0 = col / 4 + inset;
  const u1 = (col + 1) / 4 - inset;
  const v1 = 1 - row / 4 - inset;
  const v0 = 1 - (row + 1) / 4 + inset;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

function appendQuad(out, x, y, z, face, tile, shade = 1, variation = 1) {
  const base = out.positions.length / 3;
  const uvs = tileUv(tile);
  for (let i = 0; i < 4; i += 1) {
    const corner = face.corners[i];
    out.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    const tint = shade * variation;
    out.colors.push(tint, tint, tint);
    out.uvs.push(uvs[i][0], uvs[i][1]);
  }
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendBox(out, x, y, z, sx, sy, sz, tile, tint = 1) {
  for (const face of FACE_DEFS) {
    const base = out.positions.length / 3;
    const uvs = tileUv(tile);
    for (let i = 0; i < 4; i += 1) {
      const corner = face.corners[i];
      out.positions.push(x + corner[0] * sx, y + corner[1] * sy, z + corner[2] * sz);
      const light = tint * face.shade;
      out.colors.push(light, light, light);
      out.uvs.push(uvs[i][0], uvs[i][1]);
    }
    out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function appendPlantQuad(out, corners, color) {
  const base = out.positions.length / 3;
  for (const point of corners) {
    out.positions.push(point[0], point[1], point[2]);
    out.colors.push(color[0], color[1], color[2]);
  }
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function makeGeometry(data, withTexture = true) {
  if (data.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  if (withTexture) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function isOccluding(id) {
  return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.TORCH;
}

function emptyGeometryData() {
  return { positions: [], colors: [], uvs: [], indices: [] };
}

export class VoxelWorld {
  constructor(scene, seed, savedEdits = []) {
    this.scene = scene;
    this.seed = seed | 0;
    this.chunks = new Map();
    this.columnCache = new Map();
    this.treeCache = new Map();
    this.edits = new Map(savedEdits);
    this.meshQueue = new Set();
    this.centerChunk = null;
    this.radius = 2;
    this.blockTexture = createBlockAtlas();
    this.blockMaterial = new THREE.MeshLambertMaterial({ map: this.blockTexture, vertexColors: true });
    this.plantMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  column(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    const key = key2(x, z);
    const cached = this.columnCache.get(key);
    if (cached) return cached;

    const broad = fractal2(x * 0.012, z * 0.012, this.seed + 19, 4);
    const detail = noise2(x * 0.055, z * 0.055, this.seed + 271);
    const height = Math.max(3, Math.min(28, Math.floor(5 + broad * 19 + (detail - 0.5) * 3.2)));
    const temperature = fractal2((x + 470) * 0.0036, (z - 210) * 0.0036, this.seed + 901, 3);
    const moisture = fractal2((x - 760) * 0.006, (z + 380) * 0.006, this.seed + 1703, 3);
    let biome = 'meadow';
    if (height > 21 && temperature < 0.53) biome = 'snowfield';
    else if (height > 20) biome = 'highlands';
    else if (height <= SEA_LEVEL + 1) biome = 'shore';
    else if (moisture > 0.55 && temperature > 0.3) biome = 'woodland';
    else if (moisture < 0.28 && temperature > 0.61) biome = 'dryland';

    const info = { height, temperature, moisture, biome };
    this.columnCache.set(key, info);
    return info;
  }

  biomeLabel(x, z) {
    const biome = this.column(x, z).biome;
    return {
      meadow: 'Wildflower meadow',
      woodland: 'Whisperwood',
      shore: 'Sunlit shore',
      dryland: 'Amber drylands',
      highlands: 'Stoneback highlands',
      snowfield: 'Frostcap ridge',
    }[biome] || 'Open country';
  }

  surfaceBlock(info) {
    if (info.biome === 'shore' || info.biome === 'dryland') return BLOCK.SAND;
    if (info.biome === 'snowfield') return BLOCK.SNOW;
    if (info.biome === 'highlands' && info.height > 24) return BLOCK.STONE;
    return BLOCK.GRASS;
  }

  surfaceHeight(x, z) {
    return this.column(x, z).height;
  }

  treePlan(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    const key = key2(x, z);
    if (this.treeCache.has(key)) return this.treeCache.get(key);
    const info = this.column(x, z);
    const chance = info.biome === 'woodland' ? 0.043 : info.biome === 'meadow' ? 0.006 : 0;
    if (chance === 0 || info.height <= SEA_LEVEL + 1 || info.biome === 'snowfield') {
      this.treeCache.set(key, null);
      return null;
    }
    if (hashUnit(x, z, this.seed + 5137) > chance) {
      this.treeCache.set(key, null);
      return null;
    }
    const height = 4 + Math.floor(hashUnit(x, z, this.seed + 9821) * 2.5);
    const plan = { x, z, ground: info.height, height };
    this.treeCache.set(key, plan);
    return plan;
  }

  treeBlockAt(x, y, z) {
    for (let tx = x - 2; tx <= x + 2; tx += 1) {
      for (let tz = z - 2; tz <= z + 2; tz += 1) {
        const tree = this.treePlan(tx, tz);
        if (!tree || y <= tree.ground) continue;
        const trunkTop = tree.ground + tree.height;
        if (x === tx && z === tz && y >= tree.ground + 1 && y <= trunkTop) return BLOCK.LOG;
        const canopyBottom = trunkTop - 2;
        const canopyTop = trunkTop + 1;
        if (y < canopyBottom || y > canopyTop) continue;
        const layer = y - canopyBottom;
        const radius = layer === 0 || layer === 3 ? 1 : 2;
        if (Math.abs(x - tx) + Math.abs(z - tz) <= radius) return BLOCK.LEAVES;
      }
    }
    return BLOCK.AIR;
  }

  baseBlockAt(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    if (y === 0) return BLOCK.BEDROCK;
    const column = this.column(x, z);
    const h = column.height;
    if (y > h) {
      if (y <= SEA_LEVEL && h < SEA_LEVEL) return BLOCK.WATER;
      return this.treeBlockAt(x, y, z);
    }
    if (y === h) return this.surfaceBlock(column);

    const sandy = column.biome === 'shore' || column.biome === 'dryland';
    if (y > h - 4) return sandy ? BLOCK.SAND : BLOCK.DIRT;
    if (y > 2 && y < h - 2) {
      const cavern = noise3(x * 0.062, y * 0.09, z * 0.062, this.seed + 3001) * 0.72
        + noise3(x * 0.13, y * 0.16, z * 0.13, this.seed + 4229) * 0.28;
      if (cavern > 0.695) return BLOCK.AIR;
      const ore = hashUnit3(x, y, z, this.seed + 5511);
      if (y < 18 && ore > 0.993) return BLOCK.IRON_ORE;
      if (y < 27 && ore < 0.018) return BLOCK.COAL_ORE;
      if (y < 12 && ore > 0.985) return BLOCK.GRAVEL;
    }
    return BLOCK.STONE;
  }

  getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const editKey = `${x},${y},${z}`;
    if (this.edits.has(editKey)) return this.edits.get(editKey);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      const lx = x - cx * CHUNK_SIZE;
      const lz = z - cz * CHUNK_SIZE;
      return chunk.data[blockIndex(lx, y, lz)];
    }
    return this.baseBlockAt(x, y, z);
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const chunk = { cx, cz, data, solidMesh: null, waterMesh: null, plantMesh: null };
    this.chunks.set(chunkKey(cx, cz), chunk);

    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const column = this.column(wx, wz);
        const surface = this.surfaceBlock(column);
        for (let y = 0; y <= column.height; y += 1) {
          let id = BLOCK.STONE;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y === column.height) id = surface;
          else if (y > column.height - 4) id = surface === BLOCK.SAND ? BLOCK.SAND : BLOCK.DIRT;
          else if (y > 2 && y < column.height - 2) {
            const cavern = noise3(wx * 0.062, y * 0.09, wz * 0.062, this.seed + 3001) * 0.72
              + noise3(wx * 0.13, y * 0.16, wz * 0.13, this.seed + 4229) * 0.28;
            if (cavern > 0.695) id = BLOCK.AIR;
            else {
              const ore = hashUnit3(wx, y, wz, this.seed + 5511);
              if (y < 18 && ore > 0.993) id = BLOCK.IRON_ORE;
              else if (y < 27 && ore < 0.018) id = BLOCK.COAL_ORE;
              else if (y < 12 && ore > 0.985) id = BLOCK.GRAVEL;
            }
          }
          data[blockIndex(x, y, z)] = id;
        }
        if (column.height < SEA_LEVEL) {
          for (let y = column.height + 1; y <= SEA_LEVEL; y += 1) {
            data[blockIndex(x, y, z)] = BLOCK.WATER;
          }
        }
      }
    }

    // Trees are seeded outside the chunk edges so canopies line up across seams.
    for (let tz = cz * CHUNK_SIZE - 2; tz < (cz + 1) * CHUNK_SIZE + 2; tz += 1) {
      for (let tx = cx * CHUNK_SIZE - 2; tx < (cx + 1) * CHUNK_SIZE + 2; tx += 1) {
        const tree = this.treePlan(tx, tz);
        if (!tree) continue;
        const top = tree.ground + tree.height;
        for (let y = tree.ground + 1; y <= top; y += 1) {
          this.writeTreeBlock(chunk, tx, y, tz, BLOCK.LOG);
        }
        for (let y = top - 2; y <= top + 1; y += 1) {
          const layer = y - (top - 2);
          const radius = layer === 0 || layer === 3 ? 1 : 2;
          for (let dz = -radius; dz <= radius; dz += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              if (Math.abs(dx) + Math.abs(dz) > radius) continue;
              this.writeTreeBlock(chunk, tx + dx, y, tz + dz, BLOCK.LEAVES);
            }
          }
        }
      }
    }

    for (const [editKey, id] of this.edits) {
      const [wx, y, wz] = editKey.split(',').map(Number);
      if (Math.floor(wx / CHUNK_SIZE) !== cx || Math.floor(wz / CHUNK_SIZE) !== cz || y < 0 || y >= CHUNK_HEIGHT) continue;
      const lx = wx - cx * CHUNK_SIZE;
      const lz = wz - cz * CHUNK_SIZE;
      data[blockIndex(lx, y, lz)] = id;
    }
    return chunk;
  }

  writeTreeBlock(chunk, wx, y, wz, id) {
    const lx = wx - chunk.cx * CHUNK_SIZE;
    const lz = wz - chunk.cz * CHUNK_SIZE;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 1 || y >= CHUNK_HEIGHT) return;
    const at = blockIndex(lx, y, lz);
    if (chunk.data[at] === BLOCK.AIR) chunk.data[at] = id;
  }

  initialize(x = 0, z = 0) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    this.centerChunk = { cx, cz };
    for (let dz = -this.radius; dz <= this.radius; dz += 1) {
      for (let dx = -this.radius; dx <= this.radius; dx += 1) this.generateChunk(cx + dx, cz + dz);
    }
    for (const chunk of this.chunks.values()) this.buildChunk(chunk);
  }

  updateStreaming(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (this.centerChunk && this.centerChunk.cx === cx && this.centerChunk.cz === cz) return;
    this.centerChunk = { cx, cz };

    for (let dz = -this.radius; dz <= this.radius; dz += 1) {
      for (let dx = -this.radius; dx <= this.radius; dx += 1) {
        const key = chunkKey(cx + dx, cz + dz);
        if (this.chunks.has(key)) continue;
        const chunk = this.generateChunk(cx + dx, cz + dz);
        this.meshQueue.add(key);
        this.queueAdjacent(chunk.cx, chunk.cz);
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - cx) <= this.radius && Math.abs(chunk.cz - cz) <= this.radius) continue;
      this.removeChunkMeshes(chunk);
      this.chunks.delete(key);
      this.queueAdjacent(chunk.cx, chunk.cz);
    }
  }

  queueAdjacent(cx, cz) {
    const keys = [chunkKey(cx, cz), chunkKey(cx - 1, cz), chunkKey(cx + 1, cz), chunkKey(cx, cz - 1), chunkKey(cx, cz + 1)];
    for (const key of keys) if (this.chunks.has(key)) this.meshQueue.add(key);
  }

  setBlock(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y <= 0 || y >= CHUNK_HEIGHT) return false;
    const key = `${x},${y},${z}`;
    this.edits.set(key, id);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      const lx = x - cx * CHUNK_SIZE;
      const lz = z - cz * CHUNK_SIZE;
      chunk.data[blockIndex(lx, y, lz)] = id;
      this.meshQueue.add(chunkKey(cx, cz));
      if (lx === 0) this.meshQueue.add(chunkKey(cx - 1, cz));
      if (lx === CHUNK_SIZE - 1) this.meshQueue.add(chunkKey(cx + 1, cz));
      if (lz === 0) this.meshQueue.add(chunkKey(cx, cz - 1));
      if (lz === CHUNK_SIZE - 1) this.meshQueue.add(chunkKey(cx, cz + 1));
    }
    return true;
  }

  processMeshQueue(limit = 2) {
    let built = 0;
    for (const key of this.meshQueue) {
      this.meshQueue.delete(key);
      const chunk = this.chunks.get(key);
      if (chunk) this.buildChunk(chunk);
      built += 1;
      if (built >= limit) break;
    }
  }

  buildChunk(chunk) {
    this.removeChunkMeshes(chunk);
    const solid = emptyGeometryData();
    const water = emptyGeometryData();
    const plants = { positions: [], colors: [], indices: [] };
    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const id = chunk.data[blockIndex(x, y, z)];
          if (id === BLOCK.AIR) continue;
          const wx = originX + x;
          const wz = originZ + z;
          if (id === BLOCK.TORCH) {
            appendBox(solid, x + 0.43, y, z + 0.43, 0.14, 0.59, 0.14, ATLAS_TILE.bark, 1.1);
            appendBox(solid, x + 0.32, y + 0.54, z + 0.32, 0.36, 0.32, 0.36, ATLAS_TILE.flame, 1.18);
            continue;
          }
          const isWater = id === BLOCK.WATER;
          const faces = isWater ? null : BLOCK_FACES[id];
          for (let faceIndex = 0; faceIndex < FACE_DEFS.length; faceIndex += 1) {
            const face = FACE_DEFS[faceIndex];
            const nx = face.normal[0];
            const ny = face.normal[1];
            const nz = face.normal[2];
            const neighbor = this.getBlock(wx + nx, y + ny, wz + nz);
            if (isWater) {
              if (neighbor !== BLOCK.AIR && neighbor !== BLOCK.TORCH) continue;
              if (ny < 0) continue;
              appendQuad(water, x, y, z, face, 0, face.shade, 1);
            } else {
              if (isOccluding(neighbor)) continue;
              const variation = 0.94 + hashUnit(wx + faceIndex * 11, wz - y * 7, this.seed + 711) * 0.1;
              appendQuad(solid, x, y, z, face, faces ? faces[faceIndex] : ATLAS_TILE.stone, face.shade, variation);
            }
          }
        }
      }
    }

    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const wx = originX + x;
        const wz = originZ + z;
        const info = this.column(wx, wz);
        const surface = info.height;
        if (chunk.data[blockIndex(x, surface, z)] !== BLOCK.GRASS) continue;
        const chance = info.biome === 'meadow' ? 0.072 : info.biome === 'woodland' ? 0.025 : 0;
        const decoration = hashUnit(wx, wz, this.seed + 3607);
        if (decoration > chance) continue;
        const ox = x + 0.5;
        const oz = z + 0.5;
        const h = 0.28 + hashUnit(wx, wz, this.seed + 4201) * 0.22;
        const w = 0.17 + hashUnit(wx, wz, this.seed + 5843) * 0.08;
        const stem = [0.3 + hashUnit(wx, wz, this.seed + 623) * 0.13, 0.49, 0.27];
        appendPlantQuad(plants, [[ox - w, surface + 0.02, oz], [ox - w * 0.34, surface + h, oz], [ox + w, surface + h * 0.78, oz], [ox + w * 0.2, surface + 0.02, oz]], stem);
        appendPlantQuad(plants, [[ox, surface + 0.02, oz - w], [ox, surface + h * 0.78, oz - w * 0.32], [ox, surface + h, oz + w], [ox, surface + 0.02, oz + w * 0.2]], stem);
        if (decoration < chance * 0.55) {
          const palette = [
            [0.94, 0.65, 0.37],
            [0.92, 0.78, 0.88],
            [0.86, 0.77, 0.39],
            [0.79, 0.54, 0.76],
          ];
          const blossom = palette[Math.floor(hashUnit(wx, wz, this.seed + 721) * palette.length)];
          const top = surface + h;
          const r = 0.09;
          appendPlantQuad(plants, [[ox - r, top, oz], [ox, top + r, oz], [ox + r, top, oz], [ox, top - r, oz]], blossom);
          appendPlantQuad(plants, [[ox, top, oz - r], [ox, top + r, oz], [ox, top, oz + r], [ox, top - r, oz]], blossom);
        }
      }
    }

    const solidGeometry = makeGeometry(solid);
    if (solidGeometry) {
      chunk.solidMesh = new THREE.Mesh(solidGeometry, this.blockMaterial);
      chunk.solidMesh.position.set(originX, 0, originZ);
      chunk.solidMesh.castShadow = true;
      chunk.solidMesh.receiveShadow = true;
      chunk.solidMesh.userData.chunk = chunk;
      this.scene.add(chunk.solidMesh);
    }

    const waterGeometry = makeGeometry(water);
    if (waterGeometry) {
      chunk.waterMesh = new THREE.Mesh(waterGeometry, this.waterMaterial);
      chunk.waterMesh.position.set(originX, 0, originZ);
      chunk.waterMesh.renderOrder = 2;
      chunk.waterMesh.userData.chunk = chunk;
      this.scene.add(chunk.waterMesh);
    }

    const plantGeometry = makeGeometry(plants, false);
    if (plantGeometry) {
      chunk.plantMesh = new THREE.Mesh(plantGeometry, this.plantMaterial);
      chunk.plantMesh.position.set(originX, 0, originZ);
      chunk.plantMesh.castShadow = false;
      chunk.plantMesh.receiveShadow = true;
      this.scene.add(chunk.plantMesh);
    }
  }

  removeChunkMeshes(chunk) {
    for (const name of ['solidMesh', 'waterMesh', 'plantMesh']) {
      const mesh = chunk[name];
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      chunk[name] = null;
    }
  }

  raycastMeshes() {
    const meshes = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.solidMesh) meshes.push(chunk.solidMesh);
      if (chunk.waterMesh) meshes.push(chunk.waterMesh);
    }
    return meshes;
  }

  updateWater(time) {
    this.waterMaterial.uniforms.uTime.value = time;
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.removeChunkMeshes(chunk);
    this.chunks.clear();
    this.meshQueue.clear();
    this.blockTexture.dispose();
    this.blockMaterial.dispose();
    this.plantMaterial.dispose();
    this.waterMaterial.dispose();
  }
}
