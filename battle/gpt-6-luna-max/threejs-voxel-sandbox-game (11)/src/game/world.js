import * as THREE from "three";

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 28;
export const WATER_LEVEL = 8;

export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  LEAVES: 7,
  PLANKS: 8,
  COBBLE: 9,
  FLOWER: 10,
  CLAY: 11,
  COAL_ORE: 12,
  MOSS: 13,
  LANTERN: 14,
  CAMPFIRE: 15,
  BEDROCK: 16,
});

const BLOCKS = {
  [BLOCK.AIR]: { name: "Air", solid: false, occludes: false },
  [BLOCK.GRASS]: { name: "Grass", solid: true, occludes: true, side: "grass-side", top: "grass-top", bottom: "dirt" },
  [BLOCK.DIRT]: { name: "Dirt", solid: true, occludes: true, side: "dirt", top: "dirt", bottom: "dirt" },
  [BLOCK.STONE]: { name: "Stone", solid: true, occludes: true, side: "stone", top: "stone", bottom: "stone" },
  [BLOCK.SAND]: { name: "Sand", solid: true, occludes: true, side: "sand", top: "sand", bottom: "sand" },
  [BLOCK.WATER]: { name: "Water", solid: false, occludes: false, side: "water", top: "water", bottom: "water" },
  [BLOCK.LOG]: { name: "Wood", solid: true, occludes: true, side: "bark", top: "wood-end", bottom: "wood-end" },
  [BLOCK.LEAVES]: { name: "Leaves", solid: true, occludes: true, side: "leaves", top: "leaves", bottom: "leaves" },
  [BLOCK.PLANKS]: { name: "Planks", solid: true, occludes: true, side: "planks", top: "planks", bottom: "planks" },
  [BLOCK.COBBLE]: { name: "Cobblestone", solid: true, occludes: true, side: "cobble", top: "cobble", bottom: "cobble" },
  [BLOCK.FLOWER]: { name: "Wildflower", solid: false, occludes: false, side: "flower", top: "flower", bottom: "flower" },
  [BLOCK.CLAY]: { name: "Clay", solid: true, occludes: true, side: "clay", top: "clay", bottom: "clay" },
  [BLOCK.COAL_ORE]: { name: "Coal ore", solid: true, occludes: true, side: "coal-ore", top: "coal-ore", bottom: "coal-ore" },
  [BLOCK.MOSS]: { name: "Moss", solid: true, occludes: true, side: "moss", top: "moss", bottom: "moss" },
  [BLOCK.LANTERN]: { name: "Lantern", solid: true, occludes: true, side: "lantern", top: "lantern", bottom: "lantern", glow: 0xf4bd66 },
  [BLOCK.CAMPFIRE]: { name: "Campfire", solid: true, occludes: true, side: "campfire", top: "campfire", bottom: "campfire", glow: 0xf08b48 },
  [BLOCK.BEDROCK]: { name: "Bedrock", solid: true, occludes: true, side: "bedrock", top: "bedrock", bottom: "bedrock" },
};

const PALETTES = {
  "grass-top": ["#78944e", "#667e43", "#91a65a", "#748d48", "#809b52"],
  "grass-side": ["#826047", "#6f513c", "#9b7150", "#748d48", "#78944e"],
  dirt: ["#88674d", "#77583f", "#967454", "#826047", "#8e6b4e"],
  stone: ["#85877f", "#71766f", "#98998d", "#797d77", "#8d8e82"],
  sand: ["#d3bd86", "#c7ad73", "#e0cf9b", "#bda46b", "#d8c18d"],
  water: ["#75aeb0", "#689b9e", "#91c5bf", "#78b9b6", "#5f969d"],
  bark: ["#79543a", "#684a35", "#916540", "#725139", "#846044"],
  "wood-end": ["#aa8056", "#966d48", "#c09565", "#a87b51", "#b1875a"],
  leaves: ["#54734c", "#486647", "#668354", "#5c794e", "#75905b"],
  planks: ["#b18a5d", "#9c774e", "#c39a68", "#a98457", "#b89160"],
  cobble: ["#85877e", "#71756e", "#9b9a8d", "#767a75", "#8d8d82"],
  clay: ["#b79d7c", "#a68c70", "#c8ae88", "#af9577", "#bea482"],
  "coal-ore": ["#777970", "#222a2a", "#111918", "#909087", "#515854"],
  moss: ["#536f4c", "#476346", "#648056", "#5d774e", "#70895a"],
  lantern: ["#8c6340", "#b38a4f", "#d9ad60", "#edc675", "#714d37"],
  campfire: ["#584735", "#856343", "#e5964b", "#f2bd65", "#382f2a"],
  bedrock: ["#343c3d", "#46504b", "#252d30", "#51584f", "#3b4343"],
};

const FACES = [
  { dir: [1, 0, 0], normal: [1, 0, 0], vertices: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], side: "side" },
  { dir: [-1, 0, 0], normal: [-1, 0, 0], vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], side: "side" },
  { dir: [0, 1, 0], normal: [0, 1, 0], vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], side: "top" },
  { dir: [0, -1, 0], normal: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], side: "bottom" },
  { dir: [0, 0, 1], normal: [0, 0, 1], vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], side: "side" },
  { dir: [0, 0, -1], normal: [0, 0, -1], vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], side: "side" },
];

const QUAD_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const QUAD_ORDER = [0, 1, 2, 0, 2, 3];

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function hash2(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 0.017) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = hash2(x0, z0, seed) * 2 - 1;
  const b = hash2(x0 + 1, z0, seed) * 2 - 1;
  const c = hash2(x0, z0 + 1, seed) * 2 - 1;
  const d = hash2(x0 + 1, z0 + 1, seed) * 2 - 1;
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

export function terrainHeightAt(x, z, seed) {
  const broad = valueNoise(x * 0.022, z * 0.022, seed) * 4.1;
  const rolling = valueNoise(x * 0.066, z * 0.066, seed + 91) * 1.55;
  const fine = valueNoise(x * 0.16, z * 0.16, seed + 213) * 0.48;
  const basinX = (x - 19) / 11;
  const basinZ = (z + 11) / 8.5;
  const pond = Math.exp(-(basinX * basinX + basinZ * basinZ) * 1.5) * 7.4;
  return Math.max(2, Math.min(17, Math.floor(12 + broad + rolling + fine - pond)));
}

export function biomeAt(x, z, seed) {
  const height = terrainHeightAt(x, z, seed);
  if (height <= WATER_LEVEL + 1) return "Stillwater";
  const climate = valueNoise(x * 0.012 + 70, z * 0.012 - 44, seed + 517);
  if (climate > 0.29) return "Wildflower meadow";
  if (climate < -0.38) return "Pinewood";
  return "Mosswood";
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture(key, palette, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  const random = seededRandom(seed);

  if (key === "flower") {
    context.clearRect(0, 0, 32, 32);
    context.fillStyle = "#536e43";
    context.fillRect(15, 18, 2, 12);
    context.fillRect(10, 23, 6, 2);
    context.fillRect(17, 25, 5, 2);
    context.fillStyle = "#e9d388";
    context.fillRect(11, 8, 5, 5);
    context.fillRect(18, 10, 5, 5);
    context.fillRect(14, 4, 5, 5);
    context.fillStyle = "#f4e5ad";
    context.fillRect(13, 9, 2, 2);
    context.fillRect(20, 11, 2, 2);
    context.fillRect(16, 5, 2, 2);
  } else {
    context.fillStyle = palette[0];
    context.fillRect(0, 0, 32, 32);

    if (key === "grass-side") {
      context.fillStyle = palette[3];
      context.fillRect(0, 0, 32, 6);
      context.fillStyle = palette[4];
      context.fillRect(0, 5, 32, 2);
    }

    if (key === "wood-end") {
      context.fillStyle = palette[1];
      context.fillRect(4, 4, 24, 24);
      context.fillStyle = palette[2];
      context.fillRect(8, 8, 16, 16);
      context.fillStyle = palette[0];
      context.fillRect(12, 12, 8, 8);
    }

    for (let i = 0; i < (key === "coal-ore" ? 74 : 108); i += 1) {
      const tone = palette[Math.floor(random() * palette.length)];
      context.globalAlpha = 0.45 + random() * 0.45;
      context.fillStyle = tone;
      const size = random() > 0.84 ? 3 : 1 + Math.floor(random() * 2);
      context.fillRect(Math.floor(random() * 32), Math.floor(random() * 32), size, size);
    }

    if (key === "bark") {
      context.globalAlpha = 0.62;
      context.fillStyle = palette[1];
      for (let x = 4; x < 32; x += 8) context.fillRect(x, 0, 2, 32);
    }
    if (key === "planks") {
      context.globalAlpha = 0.55;
      context.fillStyle = palette[1];
      context.fillRect(0, 10, 32, 1);
      context.fillRect(0, 22, 32, 1);
      context.fillRect(10, 0, 1, 10);
      context.fillRect(22, 11, 1, 11);
      context.fillRect(8, 23, 1, 9);
    }
    if (key === "coal-ore") {
      for (let i = 0; i < 11; i += 1) {
        context.fillStyle = i % 2 ? "#192321" : "#272f2c";
        context.fillRect(Math.floor(random() * 29), Math.floor(random() * 29), 3, 3);
      }
    }
    context.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 1;
  return texture;
}

function createMaterials() {
  const textures = new Map();
  let textureIndex = 1;

  for (const [key, palette] of Object.entries(PALETTES)) {
    textures.set(key, makeTexture(key, palette, textureIndex * 331 + 19));
    textureIndex += 1;
  }
  textures.set("flower", makeTexture("flower", ["#e7d290"], 173));

  const atlasColumns = 8;
  const atlasRows = Math.ceil(textures.size / atlasColumns);
  const tileSize = 32;
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = atlasColumns * tileSize;
  atlasCanvas.height = atlasRows * tileSize;
  const context = atlasCanvas.getContext("2d");
  const tiles = new Map();
  let tileIndex = 0;

  for (const [key, texture] of textures.entries()) {
    const column = tileIndex % atlasColumns;
    const row = Math.floor(tileIndex / atlasColumns);
    const x = column * tileSize;
    const y = row * tileSize;
    context.drawImage(texture.image, x, y, tileSize, tileSize);
    const inset = 0.5;
    tiles.set(key, {
      u0: (x + inset) / atlasCanvas.width,
      u1: (x + tileSize - inset) / atlasCanvas.width,
      v0: 1 - (y + tileSize - inset) / atlasCanvas.height,
      v1: 1 - (y + inset) / atlasCanvas.height,
    });
    texture.dispose();
    tileIndex += 1;
  }

  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.NearestFilter;
  atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  const solid = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.92, alphaTest: 0.22, side: THREE.DoubleSide });
  const water = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.24, metalness: 0.035, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  return { atlas, tiles, solid, water };
}

function blockIndex(x, y, z) {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function parseEdit(edit) {
  if (Array.isArray(edit) && edit.length >= 4) {
    return [Number(edit[0]), Number(edit[1]), Number(edit[2]), Number(edit[3])];
  }
  if (Array.isArray(edit) && edit.length === 2 && typeof edit[0] === "string") {
    const [x, y, z] = edit[0].split(",").map(Number);
    return [x, y, z, Number(edit[1])];
  }
  return null;
}

export class VoxelWorld {
  constructor(seed, savedEdits = []) {
    this.seed = Number(seed) >>> 0;
    this.chunks = new Map();
    this.edits = new Map();
    this.editsByChunk = new Map();
    this.materials = createMaterials();
    this.group = new THREE.Group();
    this.group.name = "voxel-world";
    this.revision = 0;

    for (const edit of savedEdits) {
      const parsed = parseEdit(edit);
      if (parsed) this.recordEdit(...parsed);
    }
  }

  recordEdit(x, y, z, id) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (y < 0 || y >= CHUNK_HEIGHT || id < BLOCK.AIR || id > BLOCK.BEDROCK) return;
    const key = `${x},${y},${z}`;
    this.edits.set(key, id);
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const groupKey = chunkKey(cx, cz);
    if (!this.editsByChunk.has(groupKey)) this.editsByChunk.set(groupKey, new Map());
    this.editsByChunk.get(groupKey).set(blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE)), id);
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const surfaceIds = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldZ = cz * CHUNK_SIZE + z;
        const height = terrainHeightAt(worldX, worldZ, this.seed);
        const biome = biomeAt(worldX, worldZ, this.seed);
        const column = z * CHUNK_SIZE + x;
        heights[column] = height;

        let surface = BLOCK.GRASS;
        if (height <= WATER_LEVEL + 1) surface = biome === "Stillwater" && hash2(worldX, worldZ, this.seed + 911) > 0.63 ? BLOCK.CLAY : BLOCK.SAND;
        else if (biome === "Pinewood" && height > WATER_LEVEL + 2) surface = BLOCK.MOSS;
        surfaceIds[column] = surface;

        for (let y = 0; y <= height; y += 1) {
          let id;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y === height) id = surface;
          else if (height - y <= 3) id = surface === BLOCK.SAND ? BLOCK.SAND : surface === BLOCK.CLAY ? BLOCK.CLAY : BLOCK.DIRT;
          else id = BLOCK.STONE;

          if (id === BLOCK.STONE && y > 1 && y < height - 2 && hash2(worldX * 3 + y, worldZ * 5 - y, this.seed + 1297) > 0.985) {
            id = BLOCK.COAL_ORE;
          }
          data[blockIndex(x, y, z)] = id;
        }

        if (height < WATER_LEVEL) {
          for (let y = height + 1; y <= WATER_LEVEL; y += 1) data[blockIndex(x, y, z)] = BLOCK.WATER;
        }
      }
    }

    for (let z = 2; z < CHUNK_SIZE - 2; z += 1) {
      for (let x = 2; x < CHUNK_SIZE - 2; x += 1) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldZ = cz * CHUNK_SIZE + z;
        const column = z * CHUNK_SIZE + x;
        const height = heights[column];
        const surface = surfaceIds[column];
        const biome = biomeAt(worldX, worldZ, this.seed);
        const chance = hash2(worldX, worldZ, this.seed + 603);
        const forestChance = biome === "Mosswood" ? 0.058 : biome === "Pinewood" ? 0.076 : 0.012;

        if ((surface !== BLOCK.GRASS && surface !== BLOCK.MOSS) || height <= WATER_LEVEL + 2) continue;

        if (chance < forestChance) {
          const trunkHeight = 3 + Math.floor(hash2(worldX, worldZ, this.seed + 81) * 3);
          for (let y = height + 1; y <= height + trunkHeight; y += 1) {
            data[blockIndex(x, y, z)] = BLOCK.LOG;
          }
          const crownY = height + trunkHeight;
          for (let dy = -1; dy <= 2; dy += 1) {
            const radius = dy === 2 ? 1 : 2;
            for (let dz = -radius; dz <= radius; dz += 1) {
              for (let dx = -radius; dx <= radius; dx += 1) {
                if (Math.abs(dx) + Math.abs(dz) > radius * 2 - 1) continue;
                if (dx === 0 && dz === 0 && dy <= 0) continue;
                const leafIndex = blockIndex(x + dx, crownY + dy, z + dz);
                if (data[leafIndex] === BLOCK.AIR) data[leafIndex] = BLOCK.LEAVES;
              }
            }
          }
        } else if (surface === BLOCK.GRASS && (chance > 0.91 || (biome === "Wildflower meadow" && chance > 0.79))) {
          data[blockIndex(x, height + 1, z)] = BLOCK.FLOWER;
        }
      }
    }

    const edits = this.editsByChunk.get(chunkKey(cx, cz));
    if (edits) {
      for (const [index, id] of edits.entries()) data[index] = id;
    }

    return { cx, cz, data, group: new THREE.Group() };
  }

  blockAt(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK.AIR;
    return chunk.data[blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))];
  }

  isSolidAt(x, y, z) {
    const data = BLOCKS[this.blockAt(x, y, z)];
    return Boolean(data && data.solid);
  }

  surfaceAt(x, z) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
      const id = this.blockAt(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.FLOWER) return y;
    }
    return 0;
  }

  biomeAt(x, z) {
    return biomeAt(Math.floor(x), Math.floor(z), this.seed);
  }

  ensureAround(worldX, worldZ, radius = 2, maxNew = Infinity) {
    const centerX = floorDiv(Math.floor(worldX), CHUNK_SIZE);
    const centerZ = floorDiv(Math.floor(worldZ), CHUNK_SIZE);
    const desired = new Set();
    const created = [];
    const missing = [];

    for (let cz = centerZ - radius; cz <= centerZ + radius; cz += 1) {
      for (let cx = centerX - radius; cx <= centerX + radius; cx += 1) {
        const key = chunkKey(cx, cz);
        desired.add(key);
        if (!this.chunks.has(key)) missing.push({ cx, cz });
      }
    }

    missing.sort((a, b) => Math.hypot(a.cx - centerX, a.cz - centerZ) - Math.hypot(b.cx - centerX, b.cz - centerZ));
    for (const { cx, cz } of missing.slice(0, Math.max(0, maxNew))) {
      const chunk = this.generateChunk(cx, cz);
      this.chunks.set(chunkKey(cx, cz), chunk);
      this.group.add(chunk.group);
      created.push(chunk);
    }

    const rebuild = new Set();
    for (const [key, chunk] of this.chunks.entries()) {
      if (desired.has(key)) continue;
      this.group.remove(chunk.group);
      this.disposeChunk(chunk);
      this.chunks.delete(key);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz));
        if (neighbor) rebuild.add(neighbor);
      }
    }

    for (const chunk of created) {
      rebuild.add(chunk);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz));
        if (neighbor) rebuild.add(neighbor);
      }
    }
    for (const chunk of rebuild) {
      if (this.chunks.get(chunkKey(chunk.cx, chunk.cz)) === chunk) this.rebuildChunk(chunk);
    }
  }

  rebuildChunk(chunk) {
    this.disposeChunkMeshes(chunk);
    const batches = new Map();
    const addQuad = (textureKey, vertices, normal, baseX, baseY, baseZ) => {
      const layer = textureKey === "water" ? "water" : "solid";
      if (!batches.has(layer)) batches.set(layer, { positions: [], normals: [], uvs: [] });
      const batch = batches.get(layer);
      const tile = this.materials.tiles.get(textureKey);
      for (const index of QUAD_ORDER) {
        const vertex = vertices[index];
        batch.positions.push(vertex[0] + baseX, vertex[1] + baseY, vertex[2] + baseZ);
        batch.normals.push(normal[0], normal[1], normal[2]);
        batch.uvs.push(
          tile.u0 + QUAD_UV[index][0] * (tile.u1 - tile.u0),
          tile.v0 + QUAD_UV[index][1] * (tile.v1 - tile.v0),
        );
      }
    };

    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const id = chunk.data[blockIndex(x, y, z)];
          if (id === BLOCK.AIR) continue;
          const block = BLOCKS[id];
          if (!block) continue;

          if (id === BLOCK.FLOWER) {
            addQuad("flower", [[x + 0.17, y, z + 0.17], [x + 0.83, y, z + 0.83], [x + 0.83, y + 0.92, z + 0.83], [x + 0.17, y + 0.92, z + 0.17]], [0, 0, 1], 0, 0, 0);
            addQuad("flower", [[x + 0.83, y, z + 0.17], [x + 0.17, y, z + 0.83], [x + 0.17, y + 0.92, z + 0.83], [x + 0.83, y + 0.92, z + 0.17]], [0, 0, -1], 0, 0, 0);
            continue;
          }

          const worldX = chunk.cx * CHUNK_SIZE + x;
          const worldZ = chunk.cz * CHUNK_SIZE + z;
          for (const face of FACES) {
            const neighbor = this.blockAt(worldX + face.dir[0], y + face.dir[1], worldZ + face.dir[2]);
            if (neighbor === id) continue;
            if (BLOCKS[neighbor]?.occludes) continue;
            addQuad(block[face.side], face.vertices, face.normal, x, y, z);
          }
        }
      }
    }

    for (const [layer, batch] of batches.entries()) {
      if (!batch.positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(batch.uvs, 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, layer === "water" ? this.materials.water : this.materials.solid);
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      mesh.castShadow = layer === "solid";
      mesh.receiveShadow = layer === "solid";
      if (layer === "water") mesh.renderOrder = 2;
      chunk.group.add(mesh);
    }

    let glowCount = 0;
    for (let y = 0; y < CHUNK_HEIGHT && glowCount < 12; y += 1) {
      for (let z = 0; z < CHUNK_SIZE && glowCount < 12; z += 1) {
        for (let x = 0; x < CHUNK_SIZE && glowCount < 12; x += 1) {
          const block = BLOCKS[chunk.data[blockIndex(x, y, z)]];
          if (!block?.glow) continue;
          const light = new THREE.PointLight(block.glow, 0.95, 7.5, 2);
          light.position.set(x + 0.5, y + 0.72, z + 0.5);
          chunk.group.add(light);
          glowCount += 1;
        }
      }
    }
  }

  disposeChunkMeshes(chunk) {
    for (const child of [...chunk.group.children]) {
      chunk.group.remove(child);
      if (child.isMesh) child.geometry.dispose();
    }
  }

  disposeChunk(chunk) {
    this.disposeChunkMeshes(chunk);
  }

  setBlock(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const index = blockIndex(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE));
    if (chunk.data[index] === id) return false;
    chunk.data[index] = id;
    this.recordEdit(x, y, z, id);
    this.revision += 1;
    this.rebuildChunk(chunk);

    const localX = mod(x, CHUNK_SIZE);
    const localZ = mod(z, CHUNK_SIZE);
    const neighbors = [];
    if (localX === 0) neighbors.push(this.chunks.get(chunkKey(cx - 1, cz)));
    if (localX === CHUNK_SIZE - 1) neighbors.push(this.chunks.get(chunkKey(cx + 1, cz)));
    if (localZ === 0) neighbors.push(this.chunks.get(chunkKey(cx, cz - 1)));
    if (localZ === CHUNK_SIZE - 1) neighbors.push(this.chunks.get(chunkKey(cx, cz + 1)));
    for (const neighbor of neighbors) if (neighbor) this.rebuildChunk(neighbor);
    return true;
  }

  exportEdits() {
    return Array.from(this.edits, ([key, id]) => [key, id]);
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.materials.atlas.dispose();
    this.materials.solid.dispose();
    this.materials.water.dispose();
    this.group.clear();
  }
}

export function blockData(id) {
  return BLOCKS[id] ?? BLOCKS[BLOCK.AIR];
}

export function blockName(id) {
  return blockData(id).name;
}

export function itemForBlock(id) {
  if (id === BLOCK.GRASS || id === BLOCK.DIRT || id === BLOCK.CLAY) return "dirt";
  if (id === BLOCK.STONE || id === BLOCK.COBBLE) return "stone";
  if (id === BLOCK.SAND) return "sand";
  if (id === BLOCK.LOG) return "wood";
  if (id === BLOCK.LEAVES) return "leaves";
  if (id === BLOCK.PLANKS) return "planks";
  if (id === BLOCK.COAL_ORE) return "coal";
  if (id === BLOCK.FLOWER) return "wildflower";
  if (id === BLOCK.MOSS) return "moss";
  if (id === BLOCK.LANTERN) return "lantern";
  if (id === BLOCK.CAMPFIRE) return "campfire";
  if (id === BLOCK.BEDROCK || id === BLOCK.WATER) return null;
  return null;
}