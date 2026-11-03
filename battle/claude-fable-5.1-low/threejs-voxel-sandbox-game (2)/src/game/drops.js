import * as THREE from 'three';
import { blockTiles, tileOf, ATLAS_COLS, TILE } from './textures.js';
import { BLOCKS, getDef } from './blocks.js';
import { moveEntity, applyGravity } from './physics.js';

let atlasRows = 8;
export function setDropAtlasRows(r) { atlasRows = r; }

function faceUVs(t) {
  const col = t % ATLAS_COLS, row = Math.floor(t / ATLAS_COLS);
  const u0 = col / ATLAS_COLS, u1 = (col + 1) / ATLAS_COLS, v1 = 1 - row / atlasRows, v0 = 1 - (row + 1) / atlasRows;
  return [u0, v1, u1, v1, u0, v0, u1, v0];
}
const geoCache = new Map();
export function itemGeometry(id) {
  if (geoCache.has(id)) return geoCache.get(id);
  const d = getDef(id);
  let g;
  if (id < 100 && d.shape === 'cube') {
    g = new THREE.BoxGeometry(1, 1, 1);
    const [top, side, bottom] = blockTiles(id);
    const order = [side, side, top, bottom, side, side]; // +x,-x,+y,-y,+z,-z
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) { const fu = faceUVs(order[f]); for (let v = 0; v < 4; v++) uv.setXY(f * 4 + v, fu[v * 2], fu[v * 2 + 1]); }
    uv.needsUpdate = true;
  } else {
    g = new THREE.PlaneGeometry(1, 1);
    const t = id < 100 ? tileOf(Array.isArray(d.tex) ? d.tex[1] : d.tex) : tileOf(d.icon);
    const fu = faceUVs(t); const uv = g.attributes.uv;
    for (let v = 0; v < 4; v++) uv.setXY(v, fu[v * 2], fu[v * 2 + 1]);
    uv.needsUpdate = true;
  }
  geoCache.set(id, g);
  return g;
}

export class Drops {
  constructor(scene, atlasTexture) {
    this.scene = scene; this.list = [];
    this.baseMat = new THREE.MeshBasicMaterial({ map: atlasTexture, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  spawn(x, y, z, id, count = 1, vel = null) {
    const d = getDef(id); if (!d) return;
    const mesh = new THREE.Mesh(itemGeometry(id), this.baseMat.clone());
    const s = id < 100 && d.shape === 'cube' ? 0.28 : 0.4;
    mesh.scale.setScalar(s);
    if (d.tint) mesh.material.color.setRGB(...d.tint);
    this.scene.add(mesh);
    const e = {
      id, count, mesh, pos: { x, y, z }, vel: vel || { x: (Math.random() - 0.5) * 3, y: 3 + Math.random() * 2, z: (Math.random() - 0.5) * 3 },
      w: 0.12, h: 0.25, age: 0, onGround: false, inWater: false, baseTint: d.tint ? new THREE.Color(...d.tint) : new THREE.Color(1, 1, 1),
    };
    this.list.push(e);
    return e;
  }
  update(dt, world, player, onPickup, daylight) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      if (!world.isLoaded(e.pos.x, e.pos.z)) continue;
      applyGravity(e, dt, 0.7);
      if (e.inWater) e.vel.y = Math.min(e.vel.y + 8 * dt, 1.5);
      e.vel.x *= e.onGround ? 0.8 : 0.98; e.vel.z *= e.onGround ? 0.8 : 0.98;
      moveEntity(world, e, dt);
      // magnet toward player when close
      const dx = player.pos.x - e.pos.x, dy = (player.pos.y + 0.8) - e.pos.y, dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (e.age > 0.6 && dist < 2.4 && player.alive) {
        if (dist < 0.9) {
          const left = onPickup(e.id, e.count);
          if (left === 0) { this.remove(i); continue; } else e.count = left;
        } else { const p = 12 * dt / dist; e.pos.x += dx * p; e.pos.y += dy * p; e.pos.z += dz * p; }
      }
      if (e.age > 300 || e.pos.y < -10) { this.remove(i); continue; }
      e.mesh.position.set(e.pos.x, e.pos.y + 0.15 + Math.sin(e.age * 3) * 0.05, e.pos.z);
      e.mesh.rotation.y = e.age * 1.5;
      const l = Math.max(world.getSky(Math.floor(e.pos.x), Math.floor(e.pos.y + 0.3), Math.floor(e.pos.z)) / 15 * daylight, world.getLight(Math.floor(e.pos.x), Math.floor(e.pos.y + 0.3), Math.floor(e.pos.z)) / 15);
      const b = 0.12 + 0.88 * l;
      e.mesh.material.color.setRGB(e.baseTint.r * b, e.baseTint.g * b, e.baseTint.b * b);
    }
  }
  remove(i) { const e = this.list[i]; this.scene.remove(e.mesh); e.mesh.material.dispose(); this.list.splice(i, 1); }
  serialize() { return this.list.map(e => ({ id: e.id, count: e.count, x: e.pos.x, y: e.pos.y, z: e.pos.z })); }
  load(arr) { for (const d of arr || []) this.spawn(d.x, d.y, d.z, d.id, d.count, { x: 0, y: 0, z: 0 }); }
  clear() { while (this.list.length) this.remove(this.list.length - 1); }
}
void BLOCKS;
