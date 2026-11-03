import * as THREE from 'three';
import { blockTiles, ATLAS_COLS, TILE } from './textures.js';
import { BLOCKS } from './blocks.js';
import { GRAVITY } from './physics.js';

const MAX = 1500;
export class Particles {
  constructor(scene, atlasCanvas) {
    this.atlas = atlasCanvas.getContext('2d');
    this.colorCache = new Map();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3); this.life = new Float32Array(MAX); this.size = new Float32Array(MAX);
    this.n = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { daylight: { value: 1 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 60 }, fogFar: { value: 110 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; varying float vDist;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); vDist = length(mv.xyz); gl_PointSize = size * 300.0 / vDist; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor; varying float vDist; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        void main(){ float f = smoothstep(fogNear, fogFar, vDist); gl_FragColor = vec4(mix(vColor, fogColor, f), 1.0); }`,
      transparent: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.world = null;
  }
  colorsOf(id) {
    if (this.colorCache.has(id)) return this.colorCache.get(id);
    const t = blockTiles(id)[1];
    const sx = (t % ATLAS_COLS) * TILE, sy = Math.floor(t / ATLAS_COLS) * TILE;
    const data = this.atlas.getImageData(sx, sy, TILE, TILE).data;
    const tint = BLOCKS[id].tint || [1, 1, 1];
    const out = [];
    for (let i = 0; i < 24; i++) {
      const p = Math.floor(Math.random() * TILE * TILE) * 4;
      if (data[p + 3] < 128) { i--; if (out.length === 0 && i > 60) break; continue; }
      out.push([data[p] / 255 * tint[0], data[p + 1] / 255 * tint[1], data[p + 2] / 255 * tint[2]]);
    }
    if (!out.length) out.push([0.5, 0.5, 0.5]);
    this.colorCache.set(id, out);
    return out;
  }
  spawn(x, y, z, vx, vy, vz, c, life, size) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    this.life[i] = life; this.size[i] = size;
  }
  blockBreak(x, y, z, id, count = 24, light = 1) {
    const cols = this.colorsOf(id);
    for (let i = 0; i < count; i++) {
      const c = cols[Math.floor(Math.random() * cols.length)];
      const lc = [c[0] * light, c[1] * light, c[2] * light];
      this.spawn(x + Math.random(), y + Math.random(), z + Math.random(), (Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4, lc, 0.6 + Math.random() * 0.6, 0.1 + Math.random() * 0.08);
    }
  }
  blockHit(x, y, z, face, id, light = 1) {
    const cols = this.colorsOf(id);
    for (let i = 0; i < 3; i++) {
      const c = cols[Math.floor(Math.random() * cols.length)];
      const px = x + 0.5 + face[0] * 0.55 + (face[0] ? 0 : (Math.random() - 0.5) * 0.8);
      const py = y + 0.5 + face[1] * 0.55 + (face[1] ? 0 : (Math.random() - 0.5) * 0.8);
      const pz = z + 0.5 + face[2] * 0.55 + (face[2] ? 0 : (Math.random() - 0.5) * 0.8);
      this.spawn(px, py, pz, face[0] * 2 + (Math.random() - 0.5) * 2, 2 + Math.random() * 2, face[2] * 2 + (Math.random() - 0.5) * 2, [c[0] * light, c[1] * light, c[2] * light], 0.4 + Math.random() * 0.3, 0.07);
    }
  }
  burst(x, y, z, color, count, speed = 3, life = 0.8, size = 0.12) {
    for (let i = 0; i < count; i++) this.spawn(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed, color, life * (0.5 + Math.random()), size);
  }
  update(dt, world) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.n--; this.swap(i, this.n); i--; continue; }
      this.vel[i * 3 + 1] -= GRAVITY * 0.6 * dt;
      let nx = this.pos[i * 3] + this.vel[i * 3] * dt, ny = this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt, nz = this.pos[i * 3 + 2] + this.vel[i * 3 + 2] * dt;
      if (world && world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        if (world.isSolid(Math.floor(this.pos[i * 3]), Math.floor(ny), Math.floor(this.pos[i * 3 + 2]))) { this.vel[i * 3 + 1] *= -0.3; ny = this.pos[i * 3 + 1]; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
        else { this.vel[i * 3] *= -0.3; this.vel[i * 3 + 2] *= -0.3; nx = this.pos[i * 3]; nz = this.pos[i * 3 + 2]; }
      }
      this.pos[i * 3] = nx; this.pos[i * 3 + 1] = ny; this.pos[i * 3 + 2] = nz;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
  swap(a, b) {
    if (a === b) return;
    for (let k = 0; k < 3; k++) { this.pos[a * 3 + k] = this.pos[b * 3 + k]; this.vel[a * 3 + k] = this.vel[b * 3 + k]; this.col[a * 3 + k] = this.col[b * 3 + k]; }
    this.life[a] = this.life[b]; this.size[a] = this.size[b];
  }
}
