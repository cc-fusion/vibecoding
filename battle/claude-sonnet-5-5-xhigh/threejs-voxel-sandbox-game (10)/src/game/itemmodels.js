// Geometry for held / dropped items: extruded pixel sprites and mini block cubes.
import * as THREE from 'three';
import { DEFS, S_CROSS, S_TORCH } from './blocks.js';
import { spriteData } from './textures.js';
import { blockCubeData } from './mesher.js';

const spriteCache = new Map();
const blockCache = new Map();

// Extruded 16x16 sprite, centred, 1 unit wide, 1/16 deep
export function spriteGeometry(id) {
  if (spriteCache.has(id)) return spriteCache.get(id);
  const data = spriteData(id);
  const pos = [], col = [], idx = [];
  const px = 1 / 16, hd = 0.5 / 16;
  const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && data[(y * 16 + x) * 4 + 3] > 40;
  const quad = (a, b, c, d, r, g, bl) => {
    const i = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) col.push(r, g, bl);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!solid(x, y)) continue;
    const i = (y * 16 + x) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const x0 = x * px - 0.5, x1 = x0 + px, y1 = 0.5 - y * px, y0 = y1 - px;
    quad([x0, y0, hd], [x1, y0, hd], [x1, y1, hd], [x0, y1, hd], r, g, b);
    quad([x1, y0, -hd], [x0, y0, -hd], [x0, y1, -hd], [x1, y1, -hd], r * 0.85, g * 0.85, b * 0.85);
    if (!solid(x - 1, y)) quad([x0, y0, -hd], [x0, y0, hd], [x0, y1, hd], [x0, y1, -hd], r * 0.7, g * 0.7, b * 0.7);
    if (!solid(x + 1, y)) quad([x1, y0, hd], [x1, y0, -hd], [x1, y1, -hd], [x1, y1, hd], r * 0.7, g * 0.7, b * 0.7);
    if (!solid(x, y - 1)) quad([x0, y1, hd], [x1, y1, hd], [x1, y1, -hd], [x0, y1, -hd], r * 0.95, g * 0.95, b * 0.95);
    if (!solid(x, y + 1)) quad([x0, y0, -hd], [x1, y0, -hd], [x1, y0, hd], [x0, y0, hd], r * 0.6, g * 0.6, b * 0.6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  spriteCache.set(id, g);
  return g;
}

export function blockGeometry(id) {
  if (blockCache.has(id)) return blockCache.get(id);
  const data = blockCubeData(id, 1, 1);
  if (!data) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('aUvw', new THREE.BufferAttribute(data.uvw, 3));
  g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 4, true));
  g.setAttribute('aTint', new THREE.BufferAttribute(data.tint, 4, true));
  g.setIndex(new THREE.BufferAttribute(data.idx, 1));
  g.computeBoundingSphere();
  blockCache.set(id, g);
  return g;
}

export const isFlatItem = (id) => {
  const d = DEFS[id];
  return !d || d.kind === 'item' || d.shape === S_CROSS || d.shape === S_TORCH;
};

// Create a mesh for an item stack. mats: {createBlockMat()} supplies per-mesh voxel materials
export function createItemMesh(id, makeBlockMaterial) {
  if (isFlatItem(id)) {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const m = new THREE.Mesh(spriteGeometry(id), mat);
    m.userData.flat = true;
    return m;
  }
  const m = new THREE.Mesh(blockGeometry(id), makeBlockMaterial());
  m.userData.flat = false;
  return m;
}

export function setItemMeshLight(mesh, f, tr = 1, tg = 1, tb = 1) {
  if (mesh.userData.flat) mesh.material.color.setRGB(f * tr, f * tg, f * tb);
  else mesh.material.uniforms.uEntTint.value.set(f * tr, f * tg, f * tb);
}
