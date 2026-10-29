import * as THREE from 'three';
import { Block, isSolid } from './blocks';

export const CHUNK = 16;
export const HEIGHT = 64;
export const WATER_LEVEL = 12;
export const WORLD_RADIUS = 5;
export function hash(x: number, z: number, seed = 1): number {
  let h = Math.imul(x ^ seed, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
export const riverCenter = (z: number) => 23 + Math.sin(z * .031) * 15 + Math.sin(z * .017) * 7;
export function terrainHeight(x: number, z: number, seed: number): number {
  const broad = noise(x * .022, z * .022, seed);
  const detail = noise(x * .085, z * .085, seed + 90);
  const distance = Math.abs(x - riverCenter(z));
  const mountains = Math.max(0, Math.min(1, (-z - 37) / 54)) * 20 + Math.max(0, (Math.abs(x - 15) - 48) / 32) * 12;
  const valley = 14.2 + broad * 5.6 + detail * 2.4 + mountains * (.42 + broad * .92);
  const smoothBank = smooth(Math.max(0, Math.min(1, (distance - 4.8) / 10)));
  return Math.max(4, Math.min(HEIGHT - 7, Math.floor(THREE.MathUtils.lerp(7.1, valley, smoothBank))));
}
export function biomeAt(x: number, z: number, y: number, seed: number): 'Meadow' | 'Woodland' | 'Riverlands' | 'Highlands' {
  if (y > 29) return 'Highlands';
  if (Math.abs(x - riverCenter(z)) < 15) return 'Riverlands';
  return noise(x * .018, z * .018, seed + 41) < .53 ? 'Woodland' : 'Meadow';
}
export type Change = [number, number, number, number];
interface ChunkData { cx: number; cz: number; blocks: Uint8Array; mesh: THREE.Mesh | null; height: Float32Array; }

export function createTextureAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const colors = ['#83ab54', '#a1aaa3', '#acabb9', '#96744f', '#89683e', '#b28a54', '#649044', '#bd985e', '#d6c699', '#939a91', '#c0dfdb', '#f4d99a', '#93877a', '#777e72', '#d9e5df', '#a98250', '#e3bb67', '#b97455', '#c9ccba', '#84a354', '#849149', '#43504d', '#e69a53', '#b4beaa', '#abbabd', '#a7b3ad', '#506335'];
  for (let tile = 0; tile < colors.length; tile++) {
    const tx = tile % 8 * 64, ty = Math.floor(tile / 8) * 64;
    ctx.fillStyle = colors[tile]; ctx.fillRect(tx, ty, 64, 64);
    if (tile === 10 || tile === 16) { ctx.globalAlpha = .55; ctx.fillStyle = tile === 10 ? '#80aaa7' : '#d3aa60'; ctx.fillRect(tx, ty, 64, 64); ctx.globalAlpha = 1; }
    for (let k = 0; k < 250; k++) {
      ctx.globalAlpha = .05 + hash(k, tile, 334) * .11;
      ctx.fillStyle = hash(k * 6, tile, 50) > .48 ? '#ffffff' : '#102719';
      const s = 3 + Math.floor(hash(k, tile, 17) * 6);
      ctx.fillRect(tx + Math.floor(hash(k, tile, 322) * 15) * 4, ty + Math.floor(hash(k, tile, 500) * 15) * 4, s, s);
    }
    ctx.globalAlpha = 1;
    if ([7, 9, 15, 17, 21].includes(tile)) {
      for (let row = 0; row < (tile === 7 || tile === 15 ? 8 : 4); row++) {
        const yy = row * (64 / (tile === 7 || tile === 15 ? 8 : 4));
        const width = tile === 7 || tile === 15 ? 64 : 32;
        for (let col = 0; col < 64 / width; col++) {
          const xx = col * width + (row % 2 ? -width / 2 : 0);
          ctx.strokeStyle = '#35433035'; ctx.lineWidth = 1.5;
          ctx.strokeRect(tx + xx, ty + yy, width - 1, 64 / (tile === 7 || tile === 15 ? 8 : 4) - 1);
          ctx.fillStyle = '#ffffff18'; ctx.fillRect(tx + xx + 2, ty + yy + 2, width - 4, 1);
        }
      }
    }
    if (tile === 4 || tile === 18) { ctx.fillStyle = '#49392130'; for (let x = 0; x < 64; x += 12) ctx.fillRect(tx + x, ty, 2, 64); if (tile === 18) { for (let k = 0; k < 9; k++) { ctx.fillStyle = '#394439'; ctx.fillRect(tx + hash(k, 0) * 48, ty + hash(k, 7) * 60, 6, 3); } } }
    if (tile === 14) { ctx.fillStyle = '#edf3e9'; ctx.fillRect(tx, ty, 64, 7); }
    if (tile === 12 || tile === 13) { ctx.fillStyle = tile === 12 ? '#b98663' : '#404a42'; for (let k = 0; k < 10; k++) ctx.fillRect(tx + hash(k, tile) * 52, ty + hash(k, tile + 7) * 52, 8, 7); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class VoxelWorld {
  scene: THREE.Scene;
  seed: number;
  chunks = new Map<string, ChunkData>();
  changes = new Map<string, number>();
  queue: string[] = [];
  dirty = new Set<string>();
  centerX = Infinity;
  centerZ = Infinity;
  material: THREE.MeshLambertMaterial;
  transparent: THREE.MeshLambertMaterial;
  ready = 0;
  radius = WORLD_RADIUS;
  constructor(scene: THREE.Scene, seed: number, changes: Change[] = [], lowPower = false) {
    this.scene = scene; this.seed = seed; this.radius = lowPower ? 3 : WORLD_RADIUS;
    for (const [x, y, z, id] of changes) this.changes.set(`${x},${y},${z}`, id);
    const texture = createTextureAtlas();
    this.material = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
    this.transparent = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true, transparent: true, opacity: .46, depthWrite: false });
  }
  private index(x: number, y: number, z: number) { return x + CHUNK * (z + CHUNK * y); }
  private key(x: number, y: number, z: number) { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; }
  getRaw(x: number, y: number, z: number): number {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return Block.Bedrock; if (y >= HEIGHT) return Block.Air;
    const change = this.changes.get(this.key(x, y, z)); if (change !== undefined) return change;
    const data = this.chunks.get(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`);
    return data ? data.blocks[this.index(x - Math.floor(x / CHUNK) * CHUNK, y, z - Math.floor(z / CHUNK) * CHUNK)] : Block.Air;
  }
  get(x: number, y: number, z: number): number {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return Block.Bedrock; if (y >= HEIGHT) return Block.Air;
    const change = this.changes.get(this.key(x, y, z)); if (change !== undefined) return change;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    let data = this.chunks.get(`${cx},${cz}`);
    if (!data) { this.generate(cx, cz); data = this.chunks.get(`${cx},${cz}`)!; }
    return data.blocks[this.index(x - cx * CHUNK, y, z - cz * CHUNK)];
  }
  highest(x: number, z: number): number { for (let y = HEIGHT - 1; y >= 0; y--) { if (isSolid(this.get(x, y, z))) return y; } return 0; }
  generate(cx: number, cz: number): void {
    const key = `${cx},${cz}`; if (this.chunks.has(key)) return;
    const blocks = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const data: ChunkData = { cx, cz, blocks, mesh: null, height: new Float32Array(CHUNK * CHUNK) };
    const set = (x: number, y: number, z: number, id: Block) => {
      if (x >= 16 || x < 0 || z >= 16 || z < 0 || y < 0 || y >= HEIGHT) return;
      if (this.changes.has(this.key(cx * CHUNK + x, y, cz * CHUNK + z))) return;
      blocks[this.index(x, y, z)] = id;
    };
    for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const wx = cx * CHUNK + x, wz = cz * CHUNK + z, h = terrainHeight(wx, wz, this.seed);
      data.height[z * CHUNK + x] = h;
      const river = Math.abs(wx - riverCenter(wz));
      const top = h >= 29 ? Block.Snow : (h >= 25 && hash(wx, wz, this.seed) > .3 ? Block.Stone : (river < 10 || h < WATER_LEVEL ? Block.Sand : Block.Grass));
      for (let y = 0; y <= h; y++) {
        let id = y === 0 ? Block.Bedrock : (y === h ? top : (y >= h - 3 ? (h >= 25 ? Block.Stone : Block.Dirt) : Block.Stone));
        if (id === Block.Stone && y > 2 && y < h - 3) {
          const ore = hash(wx + Math.floor(y / 2), wz + Math.floor(y / 2), this.seed + 66);
          if (ore > .992) id = Block.Iron;
          if (ore > .974 && ore < .983) id = Block.Coal;
        }
        set(x, y, z, id);
      }
    }
    // Gather the footprints of neighboring trees before building any meshes.
    for (let tz = cz * CHUNK - 4; tz <= (cz + 1) * CHUNK + 3; tz++) for (let tx = cx * CHUNK - 4; tx <= (cx + 1) * CHUNK + 3; tx++) {
      const h = terrainHeight(tx, tz, this.seed), roll = hash(tx, tz, this.seed + 382);
      if (h < 15 || h > 28 || roll > .021 || !this.canTree(tx, tz)) continue;
      const offsetX = tx + Math.floor(hash(tx, tz, 222) * 2), offsetZ = tz + Math.floor(hash(tx, tz, 333) * 2);
      const birch = hash(tx + 7, tz, 47) > .72;
      const trunk = birch ? 5 : 4 + Math.floor(hash(tx, tz, 324) * 3), crown = birch ? 2 : 2.5;
      for (let y = 1; y <= trunk + 3; y++) set(tx - cx * CHUNK, h + y, tz - cz * CHUNK, birch ? Block.BirchLog : Block.Log);
      for (let dy = -2; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const r = dx * dx + dz * dz + (dy * (birch ? 1.3 : 1.1)) ** 2;
        if (r > crown * crown * (dy >= 2 ? .65 : 1)) continue;
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (r > 4.7 && hash(dx + tx * 4, dz + tz * 9 + dy * 3, 19) > .5) continue;
        const ox = offsetX - cx * CHUNK + dx, oz = offsetZ - cz * CHUNK + dz, y = h + trunk + dy;
        if (ox >= 0 && ox < CHUNK && oz >= 0 && oz < CHUNK && y >= 0 && y < HEIGHT && !blocks[this.index(ox, y, oz)]) set(ox, y, oz, birch ? Block.BirchLeaves : Block.Leaves);
      }
    }
    // A humble riverside cabin, generated identically across chunk boundaries.
    this.settlement(set, cx, cz);
    for (const [x, id] of this.changes) {
      const [wx, wy, wz] = x.split(',').map(Number);
      if (Math.floor(wx / CHUNK) === cx && Math.floor(wz / CHUNK) === cz && wy >= 0 && wy < HEIGHT) blocks[this.index(wx - cx * CHUNK, wy, wz - cz * CHUNK)] = id;
    }
    this.chunks.set(key, data);
    if (cx >= this.centerX - this.radius && cx <= this.centerX + this.radius && cz >= this.centerZ - this.radius && cz <= this.centerZ + this.radius) this.dirty.add(key);
  }
  private canTree(x: number, z: number): boolean {
    return Math.abs(x - riverCenter(z)) > 13 && !(x > -8 && x < 6 && z > 5 && z < 20) && !(x > -35 && x < 15 && z > 24 && z < 52);
  }
  private settlement(set: (x: number, y: number, z: number, id: Block) => void, cx: number, cz: number): void {
    const hx = 0, hz = 12, hy = terrainHeight(-1, hz, this.seed) + 1;
    // Clear flat ground around the cabin without modifying water or player bedrock.
    for (let z = 4; z < 22; z++) for (let x = -7; x < 9; x++) for (let y = terrainHeight(x, z, this.seed) + 1; y <= hy; y++) set(x - cx * CHUNK, y, z - cz * CHUNK, y === hy ? Block.Dirt : Block.Air);
    for (let z = 8; z <= 17; z++) for (let x = -4; x <= 4; x++) {
      for (let y = hy; y <= hy + 6; y++) {
        const wall = x === -4 || x === 4 || z === 8 || z === 17;
        let id = Block.Air;
        if (y === hy) id = Block.Planks;
        else if (wall && y <= hy + 4) id = ((x === 0 || x === 1) && z === 17) || ((z === 11 || z === 12) && (x === -4 || x === 4) && y <= hy + 2) ? Block.Air : (y === hy + 4 || x === -4 || x === 4) ? Block.Log : ((x === -1 && z === 17) ? Block.Glass : Block.Planks);
        if ((x === -2 && z === 14 && y === hy + 1) || (x === 2 && z === 10 && y === hy + 1)) id = Block.Workbench;
        set(x - cx * CHUNK, y, z - cz * CHUNK, id);
      }
      const layers = 4 - Math.abs(x - hx);
      if (layers >= 0) for (let y = 0; y < 2; y++) set(x - cx * CHUNK, hy + 5 + layers, z - cz * CHUNK, Block.Brick);
    }
    for (let i = 0; i < 3; i++) set(2 - cx * CHUNK, hy + 5 + i, 10 - cz * CHUNK, Block.Cobble);
    for (let z = 18; z <= 22; z++) for (let x = -1; x <= 1; x++) set(x - cx * CHUNK, hy, z - cz * CHUNK, Block.Cobble);
    set(-5 - cx * CHUNK, hy + 1, 19 - cz * CHUNK, Block.Torch);
    set(4 - cx * CHUNK, hy, 19 - cz * CHUNK, Block.Workbench);
    // A short wooden dock extends over the river, just a walk from the cabin.
    for (let x = 5; x < 19; x++) for (let z = 12; z <= 14; z++) { set(x - cx * CHUNK, Math.max(hy - 1, WATER_LEVEL + 1), z - cz * CHUNK, Block.Planks); if (x % 4 === 0 && (z === 12 || z === 14)) set(x - cx * CHUNK, Math.max(hy - 1, WATER_LEVEL + 1) - 1, z - cz * CHUNK, Block.Log); }
  }
  ensure(): void {
    for (const key of this.queue.splice(0, 1)) this.generate(...key.split(',').map(Number) as [number, number]);
    for (const key of this.dirty) {
      this.dirty.delete(key);
      const chunk = this.chunks.get(key);
      if (chunk) this.buildMesh(chunk);
      if (performance.now() > this.frameDeadline) break;
    }
  }
  frameDeadline = 0;
  stream(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    if (cx === this.centerX && cz === this.centerZ) return;
    const previous = new Set(this.queue); this.centerX = cx; this.centerZ = cz;
    this.queue = [];
    for (let dz = -this.radius; dz <= this.radius; dz++) for (let dx = -this.radius; dx <= this.radius; dx++) {
      const key = `${cx + dx},${cz + dz}`;
      if (!this.chunks.has(key)) { if (previous.has(key)) this.queue.unshift(key); else this.queue.push(key); }
    }
    this.queue.sort((a, b) => { const aa = a.split(',').map(Number), bb = b.split(',').map(Number); return (aa[0] - cx) ** 2 + (aa[1] - cz) ** 2 - ((bb[0] - cx) ** 2 + (bb[1] - cz) ** 2); });
    for (const [key, chunk] of this.chunks) {
      const distance = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
      if (distance > this.radius + 1) { if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); } this.chunks.delete(key); this.dirty.delete(key); }
    }
  }
  warmStart(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK); this.centerX = cx; this.centerZ = cz;
    const positions: [number, number][] = [];
    for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) positions.push([cx + x, cz + z]);
    positions.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cz) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2));
    for (const [x, z] of positions) this.generate(x, z);
    this.stream(x + CHUNK, z); this.stream(x, z);
  }
  set(x: number, y: number, z: number, id: Block): void {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y <= 0 || y >= HEIGHT) return;
    this.changes.set(this.key(x, y, z), id);
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), data = this.chunks.get(`${cx},${cz}`);
    if (data) { data.blocks[this.index(x - cx * CHUNK, y, z - cz * CHUNK)] = id; this.dirty.add(`${cx},${cz}`); }
    if (x % CHUNK === 0) this.dirty.add(`${cx - 1},${cz}`); if ((x - 15) % CHUNK === 0) this.dirty.add(`${cx + 1},${cz}`);
    if (z % CHUNK === 0) this.dirty.add(`${cx},${cz - 1}`); if ((z - 15) % CHUNK === 0) this.dirty.add(`${cx},${cz + 1}`);
  }
  buildMesh(data: ChunkData): void {


    if (Math.max(Math.abs(data.cx - this.centerX), Math.abs(data.cz - this.centerZ)) > this.radius + 1) return;
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [], colors: number[] = [];
    const faces = [
      { d: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], shade: .83 },
      { d: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], shade: .89 },
      { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
      { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: .56 },
      { d: [0, 0, 1], c: [[1, 1, 1], [0, 1, 1], [0, 0, 1], [1, 0, 1]], shade: .94 },
      { d: [0, 0, -1], c: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]], shade: .76 },
    ];
    const cache = new Map<string, number>();
    function tileFor(id: Block, side: number, top: boolean, bottom: boolean) {
      const lookup = `${id}-${side}`; if (cache.has(lookup)) return cache.get(lookup)!;
      const base = [Block.Air, Block.Stone, Block.Stone, Block.Dirt, Block.Grass, Block.Log, Block.BirchLog, Block.Snow][id] || Block.Snow;
      const block = bottom ? base : top ? id : id;
      const tile = ({ 0: 0, 1: 1, 2: 1, 3: 3, 4: 5, 5: 5, 6: 6, 7: 7, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16, 16: 17, 17: 18, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25 } as Record<number, number>)[block] || 0;
      cache.set(lookup, tile); return tile;
    }
    function tileCorners(tile: number) { const u = tile % 8 / 8, v = 1 - Math.ceil((tile + 1) / 8) / 8; return [[u + .001, v + .123], [u + .124, v + .123], [u + .124, v + .001], [u + .001, v + .001]] as number[][]; }
    for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const id = data.blocks[this.index(x, y, z)] as Block; if (id === Block.Air) continue;
      const wx = x + data.cx * CHUNK, wz = z + data.cz * CHUNK;
      for (let side = 0; side < 6; side++) {
        const face = faces[side], nx = wx + face.d[0], ny = y + face.d[1], nz = wz + face.d[2];
        const neighbor = this.getRaw(nx, ny, nz);
        if (isSolid(neighbor) || neighbor === Block.Glass) continue;
        const corners = tileCorners(tileFor(id, side, side === 2, side === 3)); const start = positions.length / 3;
        const factor = face.shade * (.94 + hash(wx + wx, wz * 11 + nz + y, this.seed + side) * .09);
        for (let c = 0; c < 4; c++) { positions.push(wx + face.c[c][0], y + face.c[c][1], wz + face.c[c][2]); normals.push(...face.d); uvs.push(...corners[c]); colors.push(factor, factor, factor); }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
    if (data.mesh) { this.scene.remove(data.mesh); data.mesh.geometry.dispose(); }
    if (!positions.length) { data.mesh = null; return; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeBoundingSphere();
    data.mesh = new THREE.Mesh(geometry, this.material);
    data.mesh.castShadow = true; data.mesh.receiveShadow = true;
    this.scene.add(data.mesh); this.ready++;
  }
  dispose(): void {
    for (const chunk of this.chunks.values()) if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
    this.material.map?.dispose(); this.material.dispose(); this.transparent.dispose();
  }
}
