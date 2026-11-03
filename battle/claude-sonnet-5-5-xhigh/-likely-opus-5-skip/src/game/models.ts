// 3D item/block models for held items, drops and falling blocks.
import * as THREE from 'three';
import { BLOCKS, K, TINT_TILE } from './blocks';
import { ITEMDEF } from './items';
import { initAtlas, getAtlasData, TINT_GRASS, TINT_FOLIAGE } from './textures';

const cache = new Map<number, { geo: THREE.BufferGeometry; textured: boolean }>();
const SHADE = [0.7, 0.7, 1.0, 0.5, 0.85, 0.85];

export function cubeGeometry(blockId: number, size = 1) {
  const bd = BLOCKS[blockId];
  const g = new THREE.BoxGeometry(size, size, size);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) {
    const tile = bd.tiles[f];
    const u0 = (tile & 15) / 16 + 0.002, u1 = u0 + 1 / 16 - 0.004, v0 = 1 - ((tile >> 4) + 1) / 16 + 0.002, v1 = v0 + 1 / 16 - 0.004;
    const t = TINT_TILE[tile];
    const tint = t === 1 ? TINT_GRASS : t === 2 ? TINT_FOLIAGE : [1, 1, 1];
    const us = [u0, u1, u0, u1], vs = [v1, v1, v0, v0];
    for (let k = 0; k < 4; k++) {
      uv.setXY(f * 4 + k, us[k], vs[k]);
      for (let c = 0; c < 3; c++) col[(f * 4 + k) * 3 + c] = SHADE[f] * tint[c];
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function spriteGeometry(tile: number, thick = 1 / 16) {
  const d = getAtlasData().data;
  const ox = (tile & 15) * 16, oy = (tile >> 4) * 16;
  const px = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && d[((oy + y) * 256 + ox + x) * 4 + 3] > 128;
  const pos: number[] = [], col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], e: number[], r: number, g: number, bl: number) => {
    for (const p of [a, b, c, a, c, e]) { pos.push(p[0], p[1], p[2]); col.push(r, g, bl); }
  };
  const s = 1 / 16, h = thick / 2;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!px(x, y)) continue;
    const i = ((oy + y) * 256 + ox + x) * 4;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const x0 = (x - 8) * s, x1 = x0 + s, y1 = (8 - y) * s, y0 = y1 - s;
    quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], r, g, b);
    quad([x1, y0, -h], [x0, y0, -h], [x0, y1, -h], [x1, y1, -h], r * 0.8, g * 0.8, b * 0.8);
    if (!px(x - 1, y)) quad([x0, y0, -h], [x0, y0, h], [x0, y1, h], [x0, y1, -h], r * 0.7, g * 0.7, b * 0.7);
    if (!px(x + 1, y)) quad([x1, y0, h], [x1, y0, -h], [x1, y1, -h], [x1, y1, h], r * 0.7, g * 0.7, b * 0.7);
    if (!px(x, y - 1)) quad([x0, y1, h], [x1, y1, h], [x1, y1, -h], [x0, y1, -h], r * 0.95, g * 0.95, b * 0.95);
    if (!px(x, y + 1)) quad([x0, y0, -h], [x1, y0, -h], [x1, y0, h], [x0, y0, h], r * 0.6, g * 0.6, b * 0.6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function itemGeometry(id: number) {
  let c = cache.get(id);
  if (c) return c;
  const def = ITEMDEF[id]!;
  const bd = def.block ? BLOCKS[def.block] : null;
  if (bd && (bd.kind === K.CUBE || bd.kind === K.CACTUS)) c = { geo: cubeGeometry(def.block), textured: true };
  else c = { geo: spriteGeometry(def.tile), textured: false };
  cache.set(id, c);
  return c;
}

let texMat: THREE.MeshBasicMaterial | null = null;
export function itemMaterial(textured: boolean) {
  if (textured) return new THREE.MeshBasicMaterial({ map: initAtlas(), vertexColors: true, alphaTest: 0.5 });
  return new THREE.MeshBasicMaterial({ vertexColors: true });
}
export function disposeModels() { cache.clear(); texMat = null; }
export const _unused = () => texMat;
