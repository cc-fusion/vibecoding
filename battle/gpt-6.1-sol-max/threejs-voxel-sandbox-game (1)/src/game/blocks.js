import * as THREE from 'three';
import { hash } from './noise.js';

export const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, SAND: 6, WATER: 7, PLANKS: 8, COBBLE: 9, GLASS: 10, BRICK: 11, COAL: 12, COPPER: 13, BENCH: 14, TORCH: 15, BEDROCK: 16, FLOWER: 17, TUFT: 18, SNOW: 19, CACTUS: 20, COPPER_BLOCK: 21 };
export const I = { STICK: 101, COAL: 102, COPPER: 103, WOOD_PICK: 104, STONE_PICK: 105, COPPER_PICK: 106, APPLE: 107 };
export const BLOCKS = {
  0: { name: 'Air', solid: false },
  1: { name: 'Meadow grass', color: '#83a945', top: 0, side: 1, bottom: 2, hardness: 0.42 },
  2: { name: 'Earth', color: '#927251', top: 2, hardness: 0.35 },
  3: { name: 'Stone', color: '#9b9d91', top: 3, hardness: 1.5, drop: 9 },
  4: { name: 'Oak log', color: '#8d7350', top: 5, side: 4, hardness: 0.9 },
  5: { name: 'Oak leaves', color: '#648e3d', top: 6, hardness: 0.2 },
  6: { name: 'River sand', color: '#dfcf9d', top: 7, hardness: 0.35 },
  7: { name: 'Water', color: '#67a8a0', solid: false, top: 7 },
  8: { name: 'Oak planks', color: '#bb985f', top: 8, hardness: 0.7 },
  9: { name: 'Cobblestone', color: '#8f9589', top: 9, hardness: 1.2 },
  10: { name: 'Glass', color: '#b4d9d1', top: 10, transparent: true, hardness: 0.3 },
  11: { name: 'Clay brick', color: '#b67758', top: 11, hardness: 1.1 },
  12: { name: 'Coal ore', color: '#777d76', top: 12, hardness: 1.8, drop: 102 },
  13: { name: 'Copper ore', color: '#ae8970', top: 13, hardness: 2.0, drop: 103 },
  14: { name: 'Crafting table', color: '#9e7446', top: 14, side: 15, hardness: 0.8 },
  15: { name: 'Torch', color: '#f5c66a', top: 16, solid: false, decor: true, hardness: 0.1 },
  16: { name: 'Bedrock', color: '#535952', top: 17, hardness: Infinity },
  17: { name: 'Wildflower', color: '#f1ce79', top: 18, solid: false, decor: true, hardness: 0.1 },
  18: { name: 'Wild grass', color: '#819945', top: 19, solid: false, decor: true, hardness: 0.1, drop: 0 },
  19: { name: 'Alpine snow', color: '#e7eae1', top: 20, side: 3, hardness: 0.4 },
  20: { name: 'Cactus', color: '#6e9653', top: 21, hardness: 0.6 },
  21: { name: 'Copper block', color: '#c38762', top: 22, hardness: 1.4 },
  101: { name: 'Stick', color: '#a17b4d', item: true },
  102: { name: 'Coal', color: '#454d49', item: true },
  103: { name: 'Raw copper', color: '#b98261', item: true },
  104: { name: 'Wooden pickaxe', color: '#b28a54', item: true, tool: 2.1 },
  105: { name: 'Stone pickaxe', color: '#a2a898', item: true, tool: 3.8 },
  106: { name: 'Copper pickaxe', color: '#ce9672', item: true, tool: 5.8 },
  107: { name: 'Wild apple', color: '#ce795c', item: true },
};

export const isSolid = id => !!id && BLOCKS[id]?.solid !== false;
export const isOpaque = id => isSolid(id) && !BLOCKS[id]?.transparent;
export const itemName = id => BLOCKS[id]?.name || 'Unknown';
export const RECIPES = [
  { id: 'planks', name: 'Oak planks', out: 8, count: 4, input: [[4, 1]], description: 'A good beginning for just about anything.' },
  { id: 'sticks', name: 'Sticks', out: 101, count: 4, input: [[8, 2]], description: 'The backbone of a trusty tool.' },
  { id: 'bench', name: 'Crafting table', out: 14, count: 1, input: [[8, 4]], description: 'Place it, then use F nearby to make better tools.' },
  { id: 'woodpick', name: 'Wooden pickaxe', out: 104, count: 1, input: [[8, 3], [101, 2]], description: 'A first step beneath the surface.' },
  { id: 'stonepick', name: 'Stone pickaxe', out: 105, count: 1, input: [[9, 3], [101, 2]], bench: true, description: 'More stone. Less effort.' },
  { id: 'copperpick', name: 'Copper pickaxe', out: 106, count: 1, input: [[103, 3], [101, 2]], bench: true, description: 'The finest tool a wanderer could want.' },
  { id: 'torch', name: 'Torches', out: 15, count: 4, input: [[102, 1], [101, 1]], description: 'A little light goes a long way.' },
  { id: 'glass', name: 'Glass', out: 10, count: 4, input: [[6, 4], [102, 1]], bench: true, description: 'Let the outside in.' },
  { id: 'brick', name: 'Clay bricks', out: 11, count: 4, input: [[9, 4], [102, 1]], bench: true, description: 'Something a little more permanent.' },
  { id: 'copperblock', name: 'Copper block', out: 21, count: 1, input: [[103, 4]], bench: true, description: 'Warm, weathered, and worth showing off.' },
];

export function createAtlas() {
  const size = 16, cols = 8, rows = 4;
  const canvas = document.createElement('canvas');
  canvas.width = size * cols; canvas.height = size * rows;
  const ctx = canvas.getContext('2d');
  const colors = ['#9bbd60', '#a4865b', '#a4865b', '#b1b5a6', '#a28a5b', '#c4a874', '#83aa55', '#e4d6a8', '#c9aa74', '#a4aa9c', '#c0ded1', '#bd8c70', '#a1a79b', '#abb0a0', '#c4a16c', '#af8a57', '#f7c961', '#737b70', '#f3d27a', '#90ae56', '#eef0e5', '#8ca55c', '#cd9873'];
  colors.forEach((base, tile) => {
    const ox = tile % cols * size, oy = Math.floor(tile / cols) * size;
    ctx.fillStyle = base; ctx.fillRect(ox, oy, size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const n = hash(x, y, tile, 1361);
      ctx.fillStyle = n > 0.5 ? `rgba(255,255,224,${(n - 0.5) * 0.24})` : `rgba(38,49,29,${(0.5 - n) * 0.23})`;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    if (tile === 1) { ctx.fillStyle = '#91b757'; ctx.fillRect(ox, oy, 16, 4); for (let x = 0; x < 16; x += 2) ctx.fillRect(ox + x, oy + 3, 2, 1 + hash(x, 1, 1) * 3); }
    if (tile === 4) for (let x = 1; x < 16; x += 4) { ctx.fillStyle = '#7f6948'; ctx.fillRect(ox + x, oy, 1, 16); ctx.fillRect(ox + x + 1, oy + 5, 1, 6); }
    if (tile === 5) { ctx.strokeStyle = '#a58a59'; for (let r = 2; r < 8; r += 2) ctx.strokeRect(ox + 8 - r, oy + 8 - r, r * 2, r * 2); }
    if (tile === 6) for (let k = 0; k < 15; k++) { ctx.fillStyle = k % 2 ? '#719d48' : '#9aba68'; ctx.fillRect(ox + hash(k, 1) * 14, oy + hash(k, 2) * 14, 3, 2); }
    if (tile === 8 || tile === 15) { ctx.fillStyle = '#9f8055'; [3, 7, 11, 15].forEach(y => ctx.fillRect(ox, oy + y, 16, 1)); ctx.fillRect(ox + 5, oy, 1, 3); ctx.fillRect(ox + 11, oy + 4, 1, 3); }
    if (tile === 9 || tile === 11) { ctx.fillStyle = tile === 9 ? '#7f897c' : '#dcc4a4'; [4, 9, 14].forEach(y => ctx.fillRect(ox, oy + y, 16, 1)); for (let r = 0; r < 4; r++) ctx.fillRect(ox + (r % 2 ? 5 : 11), oy + r * 5, 1, 4); }
    if (tile === 10) { ctx.fillStyle = '#9fbeb1'; ctx.fillRect(ox, oy, 16, 1); ctx.fillRect(ox, oy, 1, 16); ctx.fillRect(ox + 15, oy, 1, 16); ctx.fillRect(ox, oy + 15, 16, 1); ctx.fillStyle = '#dcece0'; ctx.fillRect(ox + 3, oy + 4, 2, 6); }
    if (tile === 12 || tile === 13) for (let k = 0; k < 7; k++) { ctx.fillStyle = tile === 12 ? '#505b51' : (k % 2 ? '#c68c62' : '#8fa886'); ctx.fillRect(ox + Math.floor(hash(k, 4) * 13), oy + Math.floor(hash(k, 8) * 13), 3, 2); }
    if (tile === 14) { ctx.strokeStyle = '#795c39'; ctx.lineWidth = 2; ctx.strokeRect(ox + 2, oy + 2, 12, 12); ctx.beginPath(); ctx.moveTo(ox + 8, oy + 2); ctx.lineTo(ox + 8, oy + 14); ctx.moveTo(ox + 2, oy + 8); ctx.lineTo(ox + 14, oy + 8); ctx.stroke(); }
    if (tile === 21) { ctx.fillStyle = '#5d8445'; [3, 8, 13].forEach(x => ctx.fillRect(ox + x, oy, 1, 16)); }
    if (tile === 22) { ctx.strokeStyle = '#9d7357'; ctx.strokeRect(ox + 1, oy + 1, 14, 14); }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function iconHTML(id, className = '') {
  const def = BLOCKS[id];
  if (!def) return '';
  if (def.tool) return `<span class="item-icon pick-icon ${className}" style="--item:${def.color}"><i></i><b></b></span>`;
  if (id === I.STICK) return `<span class="item-icon stick-icon ${className}"></span>`;
  if (id === I.APPLE) return `<span class="item-icon apple-icon ${className}"></span>`;
  if (id === B.TORCH) return `<span class="item-icon torch-icon ${className}"></span>`;
  if (id === B.FLOWER) return `<span class="item-icon flower-icon ${className}"><i></i></span>`;
  return `<span class="item-icon cube-icon ${className}" style="--item:${def.color};--top:${id === 1 ? '#98b96a' : def.color}"><i></i><b></b><em></em></span>`;
}