// Chunk streaming: worker pool (terrain gen + meshing), light scheduling, GPU mesh management, materials.
import * as THREE from 'three';
import GameWorker from './worker?worker&inline';
import { handleJob } from './workerCore';
import { World, Chunk, ckey } from './world';
import { CH } from './blocks';
import type { ChunkStore } from './storage';
import type { GeoData } from './mesher';

export const U = {
  map: { value: null as THREE.Texture | null },
  uSun: { value: 1 },
  uSkyTint: { value: new THREE.Color(1, 1, 1) },
  uFogColor: { value: new THREE.Color(0.7, 0.8, 1) },
  uFogNear: { value: 40 },
  uFogFar: { value: 100 },
  uTime: { value: 0 },
  uMinLight: { value: 0.03 },
  uFlash: { value: 0 },
};

const VERT = `
attribute vec4 aColor;
attribute vec4 aLight;
uniform float uTime;
varying vec2 vUv; varying vec3 vCol; varying vec3 vLight; varying float vDist; varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  #ifdef WATER
    if (aLight.w > 0.5) wp.y += sin(wp.x * 1.7 + uTime * 1.6) * 0.03 + cos(wp.z * 1.9 + uTime * 1.3) * 0.03 - 0.02;
  #else
    if (aLight.z > 0.0) {
      float sw = aLight.z;
      wp.x += sin(uTime * 1.8 + wp.x * 0.9 + wp.z * 0.7) * 0.06 * sw;
      wp.z += cos(uTime * 1.5 + wp.z * 0.8 + wp.x * 0.6) * 0.06 * sw;
    }
  #endif
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vCol = aColor.rgb; vLight = vec3(aLight.x, aLight.y, aLight.w);
  vDist = length(mv.xyz); vWorld = wp.xyz;
}`;
const FRAG = `
uniform sampler2D map;
uniform float uSun; uniform vec3 uSkyTint; uniform vec3 uFogColor;
uniform float uFogNear; uniform float uFogFar; uniform float uTime; uniform float uMinLight; uniform float uFlash;
varying vec2 vUv; varying vec3 vCol; varying vec3 vLight; varying float vDist; varying vec3 vWorld;
float curve(float l) { return pow(0.8, (1.0 - clamp(l, 0.0, 1.0)) * 15.0); }
void main() {
  float sb = curve(vLight.x * uSun);
  float bb = curve(vLight.y);
  vec3 light = sb * uSkyTint + bb * vec3(1.0, 0.8, 0.58);
  light = clamp(max(light, vec3(uMinLight)), 0.0, 1.0);
  vec3 color;
  float alpha = 1.0;
  #ifdef WATER
    vec4 tex = texture2D(map, vUv);
    vec2 q = floor(vWorld.xz * 4.0) / 4.0;
    float w = sin(q.x * 2.1 + uTime * 1.2) + sin(q.y * 2.7 - uTime) + sin((q.x + q.y) * 1.6 + uTime * 0.8);
    vec3 base = vec3(0.14, 0.36, 0.7) * (0.93 + 0.07 * w / 3.0) + vec3(0.09) * smoothstep(1.7, 2.7, w);
    if (vUv.x == 0.0 && vUv.y == 0.0) { color = base * vCol * light; alpha = 0.7; }
    else { color = tex.rgb * vCol * light; alpha = tex.a; }
  #else
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.5) discard;
    color = tex.rgb * vCol * light;
    if (vLight.z > 0.4 && vLight.z < 0.6) {
      color = tex.rgb * (0.85 + 0.2 * sin(uTime * 2.0 + vWorld.x * 3.0 + vWorld.z * 2.0 + vWorld.y * 3.0)) * vec3(1.0, 0.95, 0.9);
    }
  #endif
  color += vec3(uFlash) * 0.5;
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(color, uFogColor, f), alpha);
}`;

export function createMaterials(tex: THREE.Texture) {
  U.map.value = tex;
  const opaque = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG });
  const water = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, defines: { WATER: '' } });
  return { opaque, water };
}

interface Slot { w: Worker | null; busy: boolean }

function makeGeo(d: GeoData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  g.setAttribute('aColor', new THREE.BufferAttribute(d.col, 4, true));
  g.setAttribute('aLight', new THREE.BufferAttribute(d.lit, 4, true));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1));
  const y0 = d.minY - 1, y1 = d.maxY + 1;
  g.boundingBox = new THREE.Box3(new THREE.Vector3(0, y0, 0), new THREE.Vector3(16, y1, 16));
  const c = new THREE.Vector3(8, (y0 + y1) / 2, 8);
  g.boundingSphere = new THREE.Sphere(c, Math.hypot(8, (y1 - y0) / 2, 8) + 1);
  return g;
}

export class ChunkManager {
  group = new THREE.Group();
  slots: Slot[] = [];
  fallback = false;
  renderDist = 6;
  cx = 1e9; cz = 1e9;
  genQueue: { cx: number; cz: number; d: number }[] = [];
  inflightGen = new Set<number>();
  meshJobs = new Map<number, { c: Chunk; v: number }>();
  lightQ: Chunk[] = [];
  jobId = 1;
  needScan = true;
  store: ChunkStore | null = null;
  seed: number;
  disposed = false;

  constructor(public world: World, private scene: THREE.Scene, private mats: { opaque: THREE.Material; water: THREE.Material }) {
    this.seed = world.seed;
    scene.add(this.group);
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    try {
      for (let i = 0; i < n; i++) {
        const w = new GameWorker();
        const s: Slot = { w, busy: false };
        w.onmessage = (e) => { s.busy = false; this.onMsg(e.data); this.pump(); };
        w.onerror = (e) => { console.error('worker error', e); s.busy = false; };
        this.slots.push(s);
      }
    } catch (e) {
      console.warn('Workers unavailable, using main thread', e);
      this.fallback = true;
      this.slots = [{ w: null, busy: false }];
    }
  }

  private run(slot: Slot, msg: any, transfer: ArrayBuffer[]) {
    slot.busy = true;
    if (slot.w) slot.w.postMessage(msg, transfer);
    else setTimeout(() => { const r = handleJob(msg); slot.busy = false; this.onMsg(r.res); this.pump(); }, 0);
  }

  setRenderDistance(n: number) { this.renderDist = n; this.needScan = true; }

  private scan() {
    this.needScan = false;
    const R = this.renderDist + 1;
    const list: { cx: number; cz: number; d: number }[] = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dz * dz;
      if (d > R * R + 1) continue;
      const cx = this.cx + dx, cz = this.cz + dz, k = ckey(cx, cz);
      if (!this.world.chunks.has(k) && !this.inflightGen.has(k)) list.push({ cx, cz, d });
    }
    list.sort((a, b) => a.d - b.d);
    this.genQueue = list;
    const lim = (R + 2) * (R + 2);
    for (const c of [...this.world.chunks.values()]) {
      const dx = c.cx - this.cx, dz = c.cz - this.cz;
      if (dx * dx + dz * dz > lim) this.unload(c);
    }
  }

  unload(c: Chunk) {
    if (c.mesh) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.wmesh) { this.group.remove(c.wmesh); c.wmesh.geometry.dispose(); c.wmesh = null; }
    if (c.modified && this.store) this.store.save(c.cx, c.cz, c.blocks);
    this.world.chunks.delete(ckey(c.cx, c.cz));
    this.world.dirty.delete(c);
    c.state = 0;
  }

  saveAll() {
    if (!this.store) return;
    for (const c of this.world.chunks.values()) if (c.modified) { this.store.save(c.cx, c.cz, c.blocks); c.modified = false; }
  }

  private neighborsReady(c: Chunk) {
    const w = this.world;
    const a = w.getChunk(c.cx + 1, c.cz), b = w.getChunk(c.cx - 1, c.cz), d = w.getChunk(c.cx, c.cz + 1), e = w.getChunk(c.cx, c.cz - 1);
    return !!a && !!b && !!d && !!e && a.state === 2 && b.state === 2 && d.state === 2 && e.state === 2;
  }

  private buildPadded(c: Chunk) {
    const PW = 18;
    const blocks = new Uint8Array(PW * PW * CH), light = new Uint8Array(PW * PW * CH);
    const w = this.world;
    const nx = w.getChunk(c.cx + 1, c.cz)!, px = w.getChunk(c.cx - 1, c.cz)!, nz = w.getChunk(c.cx, c.cz + 1)!, pz = w.getChunk(c.cx, c.cz - 1)!;
    const dxz = [w.getChunk(c.cx + 1, c.cz + 1), w.getChunk(c.cx - 1, c.cz + 1), w.getChunk(c.cx + 1, c.cz - 1), w.getChunk(c.cx - 1, c.cz - 1)];
    const maxY = Math.min(CH - 1, c.top + 1);
    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < 16; z++) {
        const src = (y * 16 + z) * 16, dst = (y * PW + z + 1) * PW + 1;
        blocks.set(c.blocks.subarray(src, src + 16), dst);
        light.set(c.light.subarray(src, src + 16), dst);
        blocks[dst - 1] = px.blocks[src + 15]; light[dst - 1] = px.light[src + 15];
        blocks[dst + 16] = nx.blocks[src]; light[dst + 16] = nx.light[src];
      }
      const rowN = (y * 16 + 0) * 16, rowS = (y * 16 + 15) * 16;
      blocks.set(pz.blocks.subarray(rowS, rowS + 16), (y * PW) * PW + 1); light.set(pz.light.subarray(rowS, rowS + 16), (y * PW) * PW + 1);
      blocks.set(nz.blocks.subarray(rowN, rowN + 16), (y * PW + 17) * PW + 1); light.set(nz.light.subarray(rowN, rowN + 16), (y * PW + 17) * PW + 1);
      const corner = (ch: Chunk | undefined, sx: number, sz: number, dx: number, dz: number) => {
        if (!ch) return;
        const s = (y * 16 + sz) * 16 + sx, d = (y * PW + dz) * PW + dx;
        blocks[d] = ch.blocks[s]; light[d] = ch.light[s];
      };
      corner(dxz[0], 0, 0, 17, 17); corner(dxz[1], 15, 0, 0, 17); corner(dxz[2], 0, 15, 17, 0); corner(dxz[3], 15, 15, 0, 0);
    }
    return { blocks, light, maxY };
  }

  pump() {
    if (this.disposed) return;
    for (;;) {
      const slot = this.slots.find((s) => !s.busy);
      if (!slot) return;
      // mesh jobs first
      let best: Chunk | null = null, bs = Infinity;
      const R2 = this.renderDist * this.renderDist + 2;
      for (const c of this.world.dirty) {
        if (c.meshing || c.state < 2) continue;
        const dx = c.cx - this.cx, dz = c.cz - this.cz, d = dx * dx + dz * dz;
        if (d > R2 && !c.urgent) continue;
        const s = c.urgent ? -1 : d;
        if (s < bs && this.neighborsReady(c)) { bs = s; best = c; }
      }
      if (best) {
        const c = best;
        this.world.dirty.delete(c);
        c.urgent = false; c.meshing = true; c.dirty = false;
        const id = this.jobId++;
        this.meshJobs.set(id, { c, v: c.version });
        const p = this.buildPadded(c);
        const climate = c.climate.slice();
        this.run(slot, { type: 'mesh', id, cx: c.cx, cz: c.cz, blocks: p.blocks, light: p.light, climate, maxY: p.maxY }, [p.blocks.buffer as ArrayBuffer, p.light.buffer as ArrayBuffer, climate.buffer as ArrayBuffer]);
        continue;
      }
      const g = this.genQueue.shift();
      if (!g) return;
      const k = ckey(g.cx, g.cz);
      if (this.world.chunks.has(k) || this.inflightGen.has(k)) continue;
      this.inflightGen.add(k);
      this.run(slot, { type: 'gen', id: this.jobId++, seed: this.seed, cx: g.cx, cz: g.cz }, []);
    }
  }

  private async onMsg(res: any) {
    if (this.disposed) return;
    if (res.type === 'gen') {
      const k = ckey(res.cx, res.cz);
      let blocks: Uint8Array = res.blocks;
      let hm: Int16Array = res.hm;
      if (this.store && this.store.keys.has(`${res.cx},${res.cz}`)) {
        const saved = await this.store.load(res.cx, res.cz);
        if (saved) {
          blocks = saved;
          hm = new Int16Array(256);
          for (let ci = 0; ci < 256; ci++) {
            let y = CH - 1;
            for (; y > 0; y--) { const id = blocks[y * 256 + ci]; if (id !== 0 && id !== 32 && !(id >= 33 && id <= 37) && !(id >= 45 && id <= 48)) break; }
            hm[ci] = y;
          }
        }
      }
      this.inflightGen.delete(k);
      if (this.disposed) return;
      const dx = res.cx - this.cx, dz = res.cz - this.cz;
      if (dx * dx + dz * dz > (this.renderDist + 3) ** 2) return;
      const c = new Chunk(res.cx, res.cz, blocks, hm, res.biome, res.climate);
      this.world.chunks.set(k, c);
      this.lightQ.push(c);
    } else {
      const job = this.meshJobs.get(res.id);
      this.meshJobs.delete(res.id);
      if (!job) return;
      const c = job.c;
      c.meshing = false;
      if (c.state === 0) return;
      this.applyMesh(c, res.opaque, res.water);
    }
  }

  private applyMesh(c: Chunk, o: GeoData | null, w: GeoData | null) {
    const mk = (old: THREE.Mesh | null, d: GeoData | null, mat: THREE.Material, order: number) => {
      if (old) { this.group.remove(old); old.geometry.dispose(); }
      if (!d) return null;
      const m = new THREE.Mesh(makeGeo(d), mat);
      m.position.set(c.cx * 16, 0, c.cz * 16);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    c.mesh = mk(c.mesh, o, this.mats.opaque, 0);
    c.wmesh = mk(c.wmesh, w, this.mats.water, 2);
  }

  processLight(budgetMs: number) {
    const t0 = performance.now();
    while (this.lightQ.length && performance.now() - t0 < budgetMs) {
      let bi = 0, bd = Infinity;
      const n = Math.min(this.lightQ.length, 24);
      for (let i = 0; i < n; i++) {
        const c = this.lightQ[i];
        const d = (c.cx - this.cx) ** 2 + (c.cz - this.cz) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      const c = this.lightQ.splice(bi, 1)[0];
      if (c.state !== 1) continue;
      this.world.initLight(c);
    }
  }

  update(px: number, pz: number) {
    const cx = Math.floor(px / 16), cz = Math.floor(pz / 16);
    if (cx !== this.cx || cz !== this.cz || this.needScan) { this.cx = cx; this.cz = cz; this.scan(); }
    this.processLight(4);
    this.pump();
  }

  // fraction of the nearby chunks (within r) that are generated, lit and meshed
  progress(r: number) {
    let total = 0, ok = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      total++;
      const c = this.world.getChunk(this.cx + dx, this.cz + dz);
      if (c && c.state === 2 && !c.dirty && !c.meshing) ok++;
    }
    return total ? ok / total : 1;
  }

  dispose() {
    this.disposed = true;
    for (const s of this.slots) s.w?.terminate();
    for (const c of this.world.chunks.values()) {
      if (c.mesh) c.mesh.geometry.dispose();
      if (c.wmesh) c.wmesh.geometry.dispose();
    }
    this.scene.remove(this.group);
  }
}
