import * as THREE from 'three';
import { Noise, hash3 } from './noise';
import { B, OPAQUE, RENDER, EMIT, FACE_TILES, ATLAS_TILES, SOLID } from './blocks';

export const CS = 16;
export const H = 96;
export const SEA = 40;
const PAD = 8;
const W = CS + PAD * 2;

export const BIOME = { OCEAN: 0, PLAINS: 1, FOREST: 2, DESERT: 3, SNOW: 4, MOUNTAINS: 5, BEACH: 6 } as const;
export const BIOME_NAMES = ['Ocean', 'Plains', 'Forest', 'Desert', 'Snowy Tundra', 'Mountains', 'Beach'];

export const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export class Chunk {
  blocks = new Uint8Array(CS * CS * H);
  sky = new Uint8Array(CS * CS * H);
  blk = new Uint8Array(CS * CS * H);
  meshes: THREE.Mesh[] = [];
  dirty = true;
  meshed = false;
  constructor(public cx: number, public cz: number) {}
  get(x: number, y: number, z: number) { return this.blocks[(y * CS + z) * CS + x]; }
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Generator {
  n: Noise; n2: Noise; n3: Noise;
  constructor(public seed: number) {
    this.n = new Noise(seed); this.n2 = new Noise(seed + 1); this.n3 = new Noise(seed + 2);
  }
  column(wx: number, wz: number) {
    const n = this.n;
    const cont = n.fbm2(wx / 700, wz / 700, 4) + 0.1;
    const temp = this.n2.fbm2(wx / 520 + 100, wz / 520, 3);
    const hum = this.n2.fbm2(wx / 460 - 300, wz / 460 + 70, 3);
    const detail = n.fbm2(wx / 110, wz / 110, 4);
    const mount = smooth(0.1, 0.45, n.fbm2(wx / 380 + 50, wz / 380 - 20, 3));
    const ridge = 1 - Math.abs(this.n3.n2(wx / 140, wz / 140));
    const land = 44 + cont * 16 + detail * 7 + mount * ridge * ridge * 42 + Math.max(0, detail) * mount * 8;
    const ocean = SEA - 6 + (cont + 0.25) * 30 + detail * 4;
    const lf = smooth(-0.35, -0.15, cont);
    let h = Math.round(ocean + (land - ocean) * lf);
    h = Math.max(4, Math.min(H - 8, h));
    let biome: number;
    if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (h <= SEA + 1 && temp > -0.3) biome = BIOME.BEACH;
    else if (mount > 0.5 && h > 64) biome = BIOME.MOUNTAINS;
    else if (temp > 0.3 && hum < 0.15) biome = BIOME.DESERT;
    else if (temp < -0.28) biome = BIOME.SNOW;
    else if (hum > 0.05) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    return { h, biome, temp };
  }
  generate(c: Chunk) {
    const b = c.blocks;
    const s = this.seed;
    const set = (x: number, y: number, z: number, id: number) => { if (x >= 0 && x < CS && z >= 0 && z < CS && y > 0 && y < H) b[(y * CS + z) * CS + x] = id; };
    const heights = new Int16Array(CS * CS), biomes = new Uint8Array(CS * CS);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = c.cx * CS + x, wz = c.cz * CS + z;
      const { h, biome } = this.column(wx, wz);
      heights[z * CS + x] = h; biomes[z * CS + x] = biome;
      for (let y = 0; y < H; y++) {
        let id: number = B.AIR;
        if (y === 0 || (y < 3 && hash3(wx, y, wz, s) < 0.5)) id = B.BEDROCK;
        else if (y <= h) {
          const depth = h - y;
          if (depth > 3 + (hash3(wx, 1, wz, s) * 2 | 0)) id = B.STONE;
          else switch (biome) {
            case BIOME.DESERT: id = depth < 3 ? B.SAND : B.SANDSTONE; break;
            case BIOME.BEACH: id = B.SAND; break;
            case BIOME.OCEAN: id = (hash3(wx >> 2, 0, wz >> 2, s) < 0.3) ? B.GRAVEL : B.SAND; break;
            case BIOME.SNOW: id = depth === 0 ? B.SNOW : B.DIRT; break;
            case BIOME.MOUNTAINS: id = depth === 0 && h > 74 ? B.SNOW : (depth === 0 && h < 70 ? B.GRASS : B.STONE); break;
            default: id = depth === 0 ? B.GRASS : B.DIRT;
          }
        } else if (y <= SEA) id = (y === SEA && biome === BIOME.SNOW) ? B.ICE : B.WATER;
        if (id === B.STONE) {
          const r = hash3(wx >> 1, y >> 1, wz >> 1, s + 9), r2 = hash3(wx, y, wz, s + 3);
          if (r2 < 0.65) {
            if (y < 16 && r < 0.006) id = B.DIAMOND_ORE;
            else if (y < 30 && r < 0.012) id = B.GOLD_ORE;
            else if (y < 56 && r < 0.035) id = B.IRON_ORE;
            else if (r < 0.07 && r > 0.035) id = B.COAL_ORE;
          }
        }
        b[(y * CS + z) * CS + x] = id;
      }
      // caves
      const top = biome === BIOME.OCEAN || biome === BIOME.BEACH ? h - 5 : h;
      for (let y = 1; y < top; y++) {
        const i = (y * CS + z) * CS + x;
        if (b[i] === B.BEDROCK) continue;
        const a = this.n3.n3(wx / 42, y / 24, wz / 42), a2 = this.n.n3(wx / 42 + 90, y / 24, wz / 42 - 40);
        let carve = a * a + a2 * a2 < 0.006;
        if (!carve && y < 34) carve = this.n2.n3(wx / 64, y / 32, wz / 64) > 0.55;
        if (carve) b[i] = y < 8 ? B.WATER : B.AIR;
      }
    }
    // decorations (plants, cactus) within chunk
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const h = heights[z * CS + x], biome = biomes[z * CS + x];
      const wx = c.cx * CS + x, wz = c.cz * CS + z;
      const surf = b[(h * CS + z) * CS + x];
      if (h + 1 >= H || b[((h + 1) * CS + z) * CS + x] !== B.AIR) continue;
      const r = hash3(wx, 7, wz, s);
      if (surf === B.GRASS) {
        if (r < (biome === BIOME.PLAINS ? 0.2 : 0.1)) set(x, h + 1, z, B.TALLGRASS);
        else if (r < 0.215) set(x, h + 1, z, B.FLOWER_RED);
        else if (r < 0.23) set(x, h + 1, z, B.FLOWER_YELLOW);
      } else if (surf === B.SAND && biome === BIOME.DESERT && r < 0.006) {
        const ch = 1 + (hash3(wx, 8, wz, s) * 3 | 0);
        for (let k = 1; k <= ch; k++) set(x, h + k, z, B.CACTUS);
      }
    }
    // trees: consider columns overlapping this chunk
    for (let z = -3; z < CS + 3; z++) for (let x = -3; x < CS + 3; x++) {
      const wx = c.cx * CS + x, wz = c.cz * CS + z;
      const r = hash3(wx, 3, wz, s);
      if (r > 0.06) continue;
      const inside = x >= 0 && x < CS && z >= 0 && z < CS;
      let h: number, biome: number;
      if (inside) { h = heights[z * CS + x]; biome = biomes[z * CS + x]; } else { const col = this.column(wx, wz); h = col.h; biome = col.biome; }
      const chance = biome === BIOME.FOREST ? 0.06 : biome === BIOME.PLAINS ? 0.005 : biome === BIOME.SNOW ? 0.02 : biome === BIOME.MOUNTAINS && h < 70 ? 0.01 : 0;
      if (r > chance || h <= SEA) continue;
      if (inside) { const sb = b[(h * CS + z) * CS + x]; if (sb !== B.GRASS && sb !== B.SNOW) continue; }
      const t = hash3(wx, 4, wz, s);
      const th = 4 + (t * 3 | 0);
      if (biome === BIOME.SNOW || (biome === BIOME.MOUNTAINS)) {
        // spruce
        const sh = th + 2;
        for (let k = 1; k <= sh; k++) set(x, h + k, z, B.SPRUCE_LOG);
        for (let k = 2; k <= sh + 1; k++) {
          const rad = k === sh + 1 ? 0 : Math.max(0, Math.floor((sh + 1 - k) / 2.2)) + ((sh - k) % 2 === 0 ? 0 : 0);
          for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
            if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
            const lx = x + dx, lz = z + dz, ly = h + k;
            if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && ly < H && b[(ly * CS + lz) * CS + lx] === B.AIR) b[(ly * CS + lz) * CS + lx] = B.SPRUCE_LEAVES;
          }
        }
        set(x, h + sh + 1, z, B.SPRUCE_LEAVES);
      } else {
        const birch = biome === BIOME.FOREST && t > 0.65;
        const log = birch ? B.BIRCH_LOG : B.LOG, leaf = birch ? B.BIRCH_LEAVES : B.LEAVES;
        for (let k = th - 2; k <= th + 1; k++) {
          const rad = k >= th ? 1 : 2;
          for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
            if (Math.abs(dx) === rad && Math.abs(dz) === rad && (k === th + 1 || hash3(wx + dx, k, wz + dz, s) < 0.5)) continue;
            const lx = x + dx, lz = z + dz, ly = h + k;
            if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && ly < H && b[(ly * CS + lz) * CS + lx] === B.AIR) b[(ly * CS + lz) * CS + lx] = leaf;
          }
        }
        for (let k = 1; k <= th; k++) set(x, h + k, z, log);
        if (inside) set(x, h, z, B.DIRT);
      }
    }
  }
}

// ---------------- Meshing ----------------
// face: normal, 4 verts (x,y,z), uv per vertex
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO_CURVE = [0.45, 0.65, 0.82, 1.0];

class MeshBuf {
  pos: number[] = []; uv: number[] = []; light: number[] = []; idx: number[] = []; count = 0;
  build(): THREE.BufferGeometry | null {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aLight', new THREE.Float32BufferAttribute(this.light, 3));
    g.setIndex(this.count * 4 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const pb = new Uint8Array(W * W * H);
const psky = new Uint8Array(W * W * H);
const pblk = new Uint8Array(W * W * H);
const QSIZE = 1 << 18;
const queue = new Int32Array(QSIZE);
const pidx = (x: number, y: number, z: number) => (y * W + z) * W + x;

function propagate(arr: Uint8Array, head: number, tail: number) {
  while (head !== tail) {
    const i = queue[head]; head = (head + 1) & (QSIZE - 1);
    const l = arr[i];
    if (l <= 1) continue;
    const x = i % W, z = ((i / W) | 0) % W, y = (i / (W * W)) | 0;
    const nl = l - 1;
    const tryN = (n: number) => {
      const id = pb[n];
      if (OPAQUE[id]) return;
      const v = (id === B.WATER || RENDER[id] === 2) ? nl - 1 : nl;
      if (arr[n] < v) { arr[n] = v; queue[tail] = n; tail = (tail + 1) & (QSIZE - 1); }
    };
    if (x > 0) tryN(i - 1);
    if (x < W - 1) tryN(i + 1);
    if (z > 0) tryN(i - W);
    if (z < W - 1) tryN(i + W);
    if (y > 0) tryN(i - W * W);
    if (y < H - 1) tryN(i + W * W);
  }
}

export function buildChunkMesh(world: World, c: Chunk): { solid: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  // gather padded blocks
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nc = world.chunks.get(ckey(c.cx + dx, c.cz + dz));
    const x0 = Math.max(0, PAD + dx * CS), x1 = Math.min(W, PAD + dx * CS + CS);
    const z0 = Math.max(0, PAD + dz * CS), z1 = Math.min(W, PAD + dz * CS + CS);
    for (let y = 0; y < H; y++) for (let z = z0; z < z1; z++) {
      const lz = z - PAD - dz * CS;
      for (let x = x0; x < x1; x++) {
        pb[pidx(x, y, z)] = nc ? nc.blocks[(y * CS + lz) * CS + (x - PAD - dx * CS)] : B.STONE;
      }
    }
  }
  // sky light
  psky.fill(0); pblk.fill(0);
  let maxTop = 0;
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    let l = 15;
    for (let y = H - 1; y >= 0; y--) {
      const id = pb[pidx(x, y, z)];
      if (OPAQUE[id]) l = 0;
      else if (id === B.WATER || RENDER[id] === 2) l = Math.max(0, l - 2);
      if (l < 15 && y > maxTop) maxTop = y;
      psky[pidx(x, y, z)] = l;
      if (l === 0) { break; }
    }
  }
  let tail = 0;
  const lim = Math.min(H - 1, maxTop + 1);
  for (let y = 0; y <= lim; y++) for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const i = pidx(x, y, z);
    if (psky[i] > 1) { queue[tail] = i; tail = (tail + 1) & (QSIZE - 1); }
  }
  propagate(psky, 0, tail);
  tail = 0;
  for (let i = 0; i < pb.length; i++) {
    const e = EMIT[pb[i]];
    if (e) { pblk[i] = e; queue[tail++] = i; }
  }
  if (tail) propagate(pblk, 0, tail);
  // store inner light for entity lighting
  for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const i = pidx(x + PAD, y, z + PAD), o = (y * CS + z) * CS + x;
    c.sky[o] = psky[i]; c.blk[o] = pblk[i];
  }

  const solid = new MeshBuf(), water = new MeshBuf();
  const ts = 1 / ATLAS_TILES, eps = 0.0008;
  for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const px = x + PAD, pz = z + PAD;
    const i = pidx(px, y, pz);
    const id = pb[i];
    const r = RENDER[id];
    if (!r) continue;
    if (r === 4) {
      const ti = FACE_TILES[id * 6];
      const u0 = (ti % ATLAS_TILES) * ts + eps, v1 = 1 - Math.floor(ti / ATLAS_TILES) * ts - eps;
      const u1 = u0 + ts - 2 * eps, v0 = v1 - ts + 2 * eps;
      const sl = psky[i] / 15, bl = pblk[i] / 15;
      const s = id === B.TORCH ? 0.35 : 0.45;
      const quads = [[[0.5 - s, 0.5 - s], [0.5 + s, 0.5 + s]], [[0.5 - s, 0.5 + s], [0.5 + s, 0.5 - s]]];
      for (const [[ax, az], [bx, bz]] of quads) {
        for (const flip of [false, true]) {
          const base = solid.count * 4;
          const p = flip ? [[bx, az + (bz - az) * 0, bz]] : null; void p;
          const A = flip ? [bx, bz] : [ax, az], Bp = flip ? [ax, az] : [bx, bz];
          solid.pos.push(x + A[0], y, z + A[1], x + Bp[0], y, z + Bp[1], x + Bp[0], y + 1, z + Bp[1], x + A[0], y + 1, z + A[1]);
          solid.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let k = 0; k < 4; k++) solid.light.push(sl, bl, 0.95);
          solid.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          solid.count++;
        }
      }
      continue;
    }
    const isWater = r === 3;
    const waterTop = isWater && pb[i + W * W] !== B.WATER;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const ni = pidx(px + F.n[0], y + F.n[1], pz + F.n[2]);
      if (y + F.n[1] < 0) continue;
      const nb = y + F.n[1] >= H ? B.AIR : pb[ni];
      if (OPAQUE[nb]) continue;
      if (isWater) { if (nb === B.WATER || (nb === B.ICE)) continue; }
      else if (r === 2 && nb === id && id === B.GLASS) continue;
      const buf = isWater ? water : solid;
      const ti = FACE_TILES[id * 6 + f];
      const u0 = (ti % ATLAS_TILES) * ts + eps, v1 = 1 - Math.floor(ti / ATLAS_TILES) * ts - eps;
      const uw = ts - 2 * eps;
      const base = buf.count * 4;
      const aos = [0, 0, 0, 0];
      const axis = F.n[0] ? 0 : F.n[1] ? 1 : 2;
      for (let k = 0; k < 4; k++) {
        const v = F.v[k];
        let vy = v[1];
        if (waterTop && vy === 1) vy = 0.875;
        buf.pos.push(x + v[0], y + vy, z + v[2]);
        buf.uv.push(u0 + UVS[k][0] * uw, v1 - uw + UVS[k][1] * uw);
        // smooth lighting + AO
        const fx = px + F.n[0], fy = y + F.n[1], fz = pz + F.n[2];
        const d = [v[0] * 2 - 1, v[1] * 2 - 1, v[2] * 2 - 1];
        d[axis] = 0;
        let ao = 3, sl = 0, bl = 0, cnt = 0;
        if (fy >= 0 && fy < H) {
          const iF = pidx(fx, fy, fz);
          sl = psky[iF]; bl = pblk[iF]; cnt = 1;
          const t1 = [0, 0, 0], t2 = [0, 0, 0];
          let set1 = false;
          for (let a = 0; a < 3; a++) if (d[a]) { if (!set1) { t1[a] = d[a]; set1 = true; } else t2[a] = d[a]; }
          const sY = (yy: number) => yy >= 0 && yy < H;
          const i1 = sY(fy + t1[1]) ? pidx(fx + t1[0], fy + t1[1], fz + t1[2]) : -1;
          const i2 = sY(fy + t2[1]) ? pidx(fx + t2[0], fy + t2[1], fz + t2[2]) : -1;
          const i3 = sY(fy + t1[1] + t2[1]) ? pidx(fx + t1[0] + t2[0], fy + t1[1] + t2[1], fz + t1[2] + t2[2]) : -1;
          const o1 = i1 >= 0 ? OPAQUE[pb[i1]] : 0, o2 = i2 >= 0 ? OPAQUE[pb[i2]] : 0, o3 = i3 >= 0 ? OPAQUE[pb[i3]] : 0;
          if (!isWater) ao = o1 && o2 ? 0 : 3 - o1 - o2 - o3;
          if (i1 >= 0 && !o1) { sl += psky[i1]; bl += pblk[i1]; cnt++; }
          if (i2 >= 0 && !o2) { sl += psky[i2]; bl += pblk[i2]; cnt++; }
          if (i3 >= 0 && !o3 && !(o1 && o2)) { sl += psky[i3]; bl += pblk[i3]; cnt++; }
        } else if (fy >= H) { sl = 15; cnt = 1; }
        aos[k] = ao;
        buf.light.push(cnt ? sl / cnt / 15 : 0, cnt ? bl / cnt / 15 : 0, F.shade * AO_CURVE[ao]);
      }
      if (aos[0] + aos[2] >= aos[1] + aos[3]) buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      buf.count++;
    }
  }
  return { solid: solid.build(), water: water.build() };
}

// ---------------- Chunk material ----------------
export function makeChunkMaterial(atlas: THREE.Texture, water: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      atlas: { value: atlas },
      daylight: { value: 1 },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 50 },
      fogFar: { value: 100 },
      time: { value: 0 },
      skyTint: { value: new THREE.Color(1, 1, 1) },
    },
    transparent: water,
    depthWrite: !water,
    side: water ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: `
      attribute vec3 aLight;
      varying vec2 vUv; varying vec3 vLight; varying float vDist;
      uniform float time;
      void main(){
        vUv = uv; vLight = aLight;
        vec3 p = position;
        ${water ? 'vec4 wp0 = modelMatrix * vec4(p,1.0); p.y += sin(wp0.x*0.8+time*1.5)*0.03 + cos(wp0.z*0.7+time*1.2)*0.03 - 0.03;' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D atlas; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      uniform vec3 skyTint; uniform float time;
      varying vec2 vUv; varying vec3 vLight; varying float vDist;
      void main(){
        vec4 t = texture2D(atlas, vUv);
        ${water ? '' : 'if (t.a < 0.5) discard;'}
        float sky = pow(0.82, (1.0 - vLight.x) * 15.0) * daylight;
        float blk = pow(0.8, (1.0 - vLight.y) * 15.0);
        vec3 lc = max(vec3(sky) * skyTint, vec3(blk) * vec3(1.0, 0.82, 0.6));
        lc = max(lc, vec3(0.035));
        vec3 col = t.rgb * lc * vLight.z;
        ${water ? 'col += vec3(0.02,0.05,0.1) * sky; col *= 1.0 + 0.06*sin(vUv.x*400.0+time*2.0);' : ''}
        float f = smoothstep(fogNear, fogFar, vDist);
        gl_FragColor = vec4(mix(col, fogColor, f), ${water ? '0.72' : '1.0'});
      }`,
  });
}

// ---------------- World ----------------
export class World {
  chunks = new Map<number, Chunk>();
  gen: Generator;
  edits = new Map<number, Map<number, number>>();
  group = new THREE.Group();
  solidMat: THREE.ShaderMaterial;
  waterMat: THREE.ShaderMaterial;
  onBlockChange?: (x: number, y: number, z: number, id: number, old: number) => void;
  constructor(seed: number, atlas: THREE.Texture) {
    this.gen = new Generator(seed);
    this.solidMat = makeChunkMaterial(atlas, false);
    this.waterMat = makeChunkMaterial(atlas, true);
  }
  getChunk(cx: number, cz: number) { return this.chunks.get(ckey(cx, cz)); }
  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(ckey(cx, cz));
    if (!c) return y < SEA ? B.STONE : B.AIR;
    return c.blocks[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)];
  }
  isLoaded(x: number, z: number) { return !!this.chunks.get(ckey(Math.floor(x / CS), Math.floor(z / CS)))?.meshed; }
  getLight(x: number, y: number, z: number): [number, number] {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y >= H) return [15, 0];
    if (y < 0) return [0, 0];
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(ckey(cx, cz));
    if (!c) return [15, 0];
    const o = (y * CS + (z - cz * CS)) * CS + (x - cx * CS);
    return [c.sky[o], c.blk[o]];
  }
  setBlock(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= H) return;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const k = ckey(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return;
    const lx = x - cx * CS, lz = z - cz * CS;
    const idx = (y * CS + lz) * CS + lx;
    const old = c.blocks[idx];
    if (old === id) return;
    c.blocks[idx] = id;
    let e = this.edits.get(k);
    if (!e) { e = new Map(); this.edits.set(k, e); }
    e.set(idx, id);
    this.remesh(c);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const near = (dx === 0 || (dx < 0 ? lx < PAD : lx >= CS - PAD)) && (dz === 0 || (dz < 0 ? lz < PAD : lz >= CS - PAD));
      if (near) { const n = this.chunks.get(ckey(cx + dx, cz + dz)); if (n) n.dirty = true; }
    }
    this.onBlockChange?.(x, y, z, id, old);
  }
  generateChunk(cx: number, cz: number) {
    const c = new Chunk(cx, cz);
    this.gen.generate(c);
    const e = this.edits.get(ckey(cx, cz));
    if (e) for (const [i, id] of e) c.blocks[i] = id;
    this.chunks.set(ckey(cx, cz), c);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = this.getChunk(cx + dx, cz + dz); if (n) n.dirty = true; }
    return c;
  }
  hasNeighbors(c: Chunk) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.chunks.has(ckey(c.cx + dx, c.cz + dz))) return false;
    return true;
  }
  remesh(c: Chunk) {
    const { solid, water } = buildChunkMesh(this, c);
    for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); }
    c.meshes = [];
    const add = (g: THREE.BufferGeometry | null, mat: THREE.Material, order: number) => {
      if (!g) return;
      const m = new THREE.Mesh(g, mat);
      m.position.set(c.cx * CS, 0, c.cz * CS);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.renderOrder = order;
      this.group.add(m); c.meshes.push(m);
    };
    add(solid, this.solidMat, 0);
    add(water, this.waterMat, 1);
    c.dirty = false; c.meshed = true;
  }
  unload(c: Chunk) {
    for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); }
    this.chunks.delete(ckey(c.cx, c.cz));
  }
  /** Streams chunks around a position within a time budget (ms). */
  update(px: number, pz: number, radius: number, budgetMs: number) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const start = performance.now();
    const genR = radius + 1;
    // generate nearest missing chunks first
    const missing: [number, number, number][] = [];
    for (let dz = -genR; dz <= genR; dz++) for (let dx = -genR; dx <= genR; dx++) {
      const d = dx * dx + dz * dz;
      if (d > genR * genR + 1) continue;
      if (!this.chunks.has(ckey(pcx + dx, pcz + dz))) missing.push([d, pcx + dx, pcz + dz]);
    }
    missing.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of missing) {
      if (performance.now() - start > budgetMs * 0.5) break;
      this.generateChunk(cx, cz);
    }
    // mesh nearest dirty
    const toMesh: [number, Chunk][] = [];
    for (const c of this.chunks.values()) {
      const dx = c.cx - pcx, dz = c.cz - pcz, d = dx * dx + dz * dz;
      if (d > (radius + 3) * (radius + 3)) { this.unload(c); continue; }
      if (c.dirty && d <= radius * radius + 1 && this.hasNeighbors(c)) toMesh.push([d, c]);
      const vis = d <= radius * radius + 1;
      for (const m of c.meshes) m.visible = vis;
    }
    toMesh.sort((a, b) => a[0] - b[0]);
    for (const [, c] of toMesh) {
      if (performance.now() - start > budgetMs) break;
      this.remesh(c);
    }
    return missing.length + toMesh.length;
  }
  /** Voxel DDA raycast */
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number, hitFluids = false) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tmx = sx > 0 ? (x + 1 - o.x) * tdx : (o.x - x) * tdx;
    let tmy = sy > 0 ? (y + 1 - o.y) * tdy : (o.y - y) * tdy;
    let tmz = sz > 0 ? (z + 1 - o.z) * tdz : (o.z - z) * tdz;
    if (!isFinite(tmx)) tmx = Infinity; if (!isFinite(tmy)) tmy = Infinity; if (!isFinite(tmz)) tmz = Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id && (id !== B.WATER || hitFluids)) return { x, y, z, id, nx, ny, nz, dist: t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  /** returns true if AABB collides with any solid block */
  boxCollides(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    for (let y = Math.floor(minY); y <= Math.floor(maxY - 1e-6); y++)
      for (let z = Math.floor(minZ); z <= Math.floor(maxZ - 1e-6); z++)
        for (let x = Math.floor(minX); x <= Math.floor(maxX - 1e-6); x++)
          if (SOLID[this.getBlock(x, y, z)]) return true;
    return false;
  }
  surfaceY(x: number, z: number) {
    for (let y = H - 1; y > 0; y--) if (SOLID[this.getBlock(x, y, z)] || this.getBlock(x, y, z) === B.WATER) return y;
    return 0;
  }
}
