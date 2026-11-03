import * as THREE from 'three';
import type { ItemStack, Recipe } from './types';

export enum Block {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Log = 4,
  Leaves = 5,
  Sand = 6,
  Water = 7,
  Planks = 8,
  Cobble = 9,
  Crafting = 10,
  CoalOre = 11,
  Flower = 12,
  TallGrass = 13,
  Snow = 14,
  Torch = 15,
  Bricks = 16,
}

export interface ItemDefinition {
  id: string;
  name: string;
  block?: Block;
  tile: number;
  color: string;
  tool?: 'wood' | 'stone';
}

export const ITEMS: Record<string, ItemDefinition> = {
  grass: { id: 'grass', name: 'Grass block', block: Block.Grass, tile: 0, color: '#86ac59' },
  dirt: { id: 'dirt', name: 'Earth', block: Block.Dirt, tile: 2, color: '#936848' },
  stone: { id: 'stone', name: 'Stone', block: Block.Stone, tile: 3, color: '#a0a19a' },
  log: { id: 'log', name: 'Oak log', block: Block.Log, tile: 4, color: '#98764b' },
  leaves: { id: 'leaves', name: 'Oak leaves', block: Block.Leaves, tile: 6, color: '#629452' },
  sand: { id: 'sand', name: 'Sand', block: Block.Sand, tile: 7, color: '#d8c48e' },
  planks: { id: 'planks', name: 'Oak planks', block: Block.Planks, tile: 9, color: '#c99d65' },
  cobble: { id: 'cobble', name: 'Cobblestone', block: Block.Cobble, tile: 10, color: '#8c918a' },
  crafting: { id: 'crafting', name: 'Crafting table', block: Block.Crafting, tile: 11, color: '#ae8050' },
  coal: { id: 'coal', name: 'Coal', tile: 13, color: '#414746' },
  flower: { id: 'flower', name: 'Wildflower', block: Block.Flower, tile: 14, color: '#ead681' },
  snow: { id: 'snow', name: 'Snow', block: Block.Snow, tile: 16, color: '#e9f0e8' },
  torch: { id: 'torch', name: 'Torch', block: Block.Torch, tile: 17, color: '#f5bf5a' },
  bricks: { id: 'bricks', name: 'Stone bricks', block: Block.Bricks, tile: 18, color: '#9d9d93' },
  stick: { id: 'stick', name: 'Stick', tile: 4, color: '#987044' },
  wood_pickaxe: { id: 'wood_pickaxe', name: 'Wooden pickaxe', tile: 9, color: '#bd8d5a', tool: 'wood' },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Stone pickaxe', tile: 3, color: '#929995', tool: 'stone' },
};

export const RECIPES: Recipe[] = [
  { id: 'planks', output: 'planks', count: 4, ingredients: [{ id: 'log', count: 1 }], description: 'The beginning of something good.' },
  { id: 'stick', output: 'stick', count: 4, ingredients: [{ id: 'planks', count: 2 }], description: 'A little building essential.' },
  { id: 'crafting', output: 'crafting', count: 1, ingredients: [{ id: 'planks', count: 4 }], description: 'Make a home for your ideas.' },
  { id: 'wood_pickaxe', output: 'wood_pickaxe', count: 1, ingredients: [{ id: 'planks', count: 3 }, { id: 'stick', count: 2 }], description: 'A trusty tool for mining stone.' },
  { id: 'stone_pickaxe', output: 'stone_pickaxe', count: 1, ingredients: [{ id: 'cobble', count: 3 }, { id: 'stick', count: 2 }], description: 'A sturdier, quicker mining tool.' },
  { id: 'torch', output: 'torch', count: 4, ingredients: [{ id: 'coal', count: 1 }, { id: 'stick', count: 1 }], description: 'Bring a little light along.' },
  { id: 'bricks', output: 'bricks', count: 4, ingredients: [{ id: 'cobble', count: 4 }], description: 'A neat finish for your builds.' },
];

export const INITIAL_INVENTORY: (ItemStack | null)[] = [
  { id: 'wood_pickaxe', count: 1 },
  { id: 'log', count: 6 },
  { id: 'planks', count: 24 },
  { id: 'cobble', count: 18 },
  { id: 'dirt', count: 24 },
  { id: 'sand', count: 12 },
  { id: 'leaves', count: 8 },
  { id: 'torch', count: 8 },
  { id: 'crafting', count: 1 },
  ...Array.from({ length: 18 }, () => null),
];

export function itemForBlock(block: Block): string | null {
  const drops: Partial<Record<Block, string>> = {
    [Block.Grass]: 'grass', [Block.Dirt]: 'dirt', [Block.Stone]: 'cobble',
    [Block.Log]: 'log', [Block.Leaves]: 'leaves', [Block.Sand]: 'sand',
    [Block.Planks]: 'planks', [Block.Cobble]: 'cobble', [Block.Crafting]: 'crafting',
    [Block.CoalOre]: 'coal', [Block.Flower]: 'flower', [Block.Snow]: 'snow',
    [Block.Torch]: 'torch', [Block.Bricks]: 'bricks',
  };
  return drops[block] ?? null;
}

export function isPlant(block: Block): boolean {
  return block === Block.Flower || block === Block.TallGrass || block === Block.Torch;
}

export function isSolid(block: Block): boolean {
  return block !== Block.Air && block !== Block.Water && !isPlant(block);
}

export function blockName(block: Block): string {
  if (block === Block.CoalOre) return 'Coal ore';
  if (block === Block.TallGrass) return 'Tall grass';
  return ITEMS[itemForBlock(block) ?? '']?.name ?? '';
}

export function faceTile(block: Block, face: number): number {
  switch (block) {
    case Block.Grass: return face === 2 ? 0 : face === 3 ? 2 : 1;
    case Block.Dirt: return 2;
    case Block.Stone: return 3;
    case Block.Log: return face === 2 || face === 3 ? 5 : 4;
    case Block.Leaves: return 6;
    case Block.Sand: return 7;
    case Block.Water: return 8;
    case Block.Planks: return 9;
    case Block.Cobble: return 10;
    case Block.Crafting: return face === 2 ? 12 : face === 3 ? 9 : 11;
    case Block.CoalOre: return 13;
    case Block.Flower: return 14;
    case Block.TallGrass: return 15;
    case Block.Snow: return face === 2 ? 16 : face === 3 ? 2 : 19;
    case Block.Torch: return 17;
    case Block.Bricks: return 18;
    default: return 2;
  }
}

const TILE = 16;
const COLS = 8;
const ROWS = 3;

function tileNoise(ctx: CanvasRenderingContext2D, x: number, y: number, base: string, colors: string[], seed: number) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, TILE, TILE);
  let value = seed;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  for (let i = 0; i < 62; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    const px = Math.floor(random() * 16);
    const py = Math.floor(random() * 16);
    ctx.fillRect(x + px, y + py, random() > 0.62 ? 2 : 1, random() > 0.75 ? 2 : 1);
  }
}

export function createAtlas(): { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * COLS;
  canvas.height = TILE * ROWS;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tile = (index: number, base: string, colors: string[]) => tileNoise(ctx, index % COLS * TILE, Math.floor(index / COLS) * TILE, base, colors, index * 837 + 21);
  tile(0, '#8bb860', ['#7fa957', '#9ac46c', '#a9c978', '#7ba755']);
  tile(1, '#94704d', ['#a47a52', '#805c40', '#a9865b', '#876343']);
  tile(2, '#95704e', ['#a47c56', '#805e42', '#ad835a', '#886547']);
  tile(3, '#9a9c96', ['#a9aba3', '#8a8e87', '#b1b2a7', '#858981']);
  tile(4, '#997349', ['#a27c50', '#88653f', '#ad8756', '#7f603c']);
  tile(5, '#c7a16c', ['#d4b17c', '#b38c5b', '#dec08d', '#aa8052']);
  tile(6, '#75a55a', ['#83b366', '#679653', '#90b96d', '#608a49']);
  tile(7, '#ddcb97', ['#e8d7a5', '#cfbd8c', '#e9d8ab', '#d2c294']);
  tile(8, '#6faab4', ['#83bbc1', '#78b1bb', '#96c8ca', '#659cae']);
  tile(9, '#cba473', ['#d7b17f', '#bb9162', '#dfba87', '#bf986b']);
  tile(10, '#949993', ['#a2a8a0', '#838982', '#b0b2a7', '#7e847e']);
  tile(11, '#b48b5d', ['#c39b6c', '#987348', '#d2a675', '#906c47']);
  tile(12, '#c8a174', ['#d4b386', '#b88c5d', '#e0bc8c', '#a98053']);
  tile(13, '#999b94', ['#a8aaa1', '#83877f', '#a6a9a0']);
  tile(16, '#e7eee5', ['#f4f6e9', '#d9e6e0', '#f7f7ec', '#d4e1dd']);
  tile(18, '#9fa29a', ['#adb0a6', '#92968e', '#b2b4aa', '#8c9088']);
  tile(19, '#95704e', ['#a47c56', '#805e42', '#ad835a', '#886547']);

  // Distinctive pixel details make adjacent materials legible at a distance.
  ctx.fillStyle = '#88b35b'; ctx.fillRect(16, 0, 16, 4);
  ctx.fillStyle = '#99c369'; ctx.fillRect(16, 0, 16, 2);
  ctx.fillStyle = '#7fa957';
  [1, 4, 7, 11, 14].forEach((p, i) => ctx.fillRect(16 + p, 3, 2, 2 + i % 3));
  ctx.fillStyle = '#76593c';
  [1, 5, 9, 13].forEach(p => { ctx.fillRect(4 * 16 + p, 0, 1, 16); ctx.fillRect(4 * 16 + p + 1, 3, 1, 5); });
  ctx.strokeStyle = '#a67e50'; ctx.lineWidth = 1;
  ctx.strokeRect(5 * 16 + 2.5, 2.5, 11, 11); ctx.strokeRect(5 * 16 + 5.5, 5.5, 5, 5);
  ctx.fillStyle = '#a47e51';
  [0, 5, 10, 15].forEach(y => ctx.fillRect(9 % COLS * 16, 16 + y, 16, 1));
  ctx.fillRect(9 % COLS * 16 + 8, 17, 1, 4); ctx.fillRect(9 % COLS * 16 + 3, 22, 1, 4); ctx.fillRect(9 % COLS * 16 + 11, 27, 1, 4);
  ctx.fillStyle = '#777f78';
  [[0, 4, 7], [8, 3, 7], [2, 9, 8], [11, 10, 5]].forEach(([x, y, w]) => ctx.fillRect(2 * 16 + x, 16 + y, w, 1));
  ctx.fillStyle = '#74573b'; ctx.fillRect(3 * 16 + 2, 16 + 3, 12, 2); ctx.fillRect(3 * 16 + 3, 16 + 6, 2, 8); ctx.fillRect(3 * 16 + 11, 16 + 6, 2, 8);
  ctx.strokeStyle = '#876544'; ctx.strokeRect(4 * 16 + 3.5, 16 + 3.5, 9, 9); ctx.beginPath(); ctx.moveTo(4 * 16 + 8, 18); ctx.lineTo(4 * 16 + 8, 30); ctx.moveTo(4 * 16 + 2, 24); ctx.lineTo(4 * 16 + 14, 24); ctx.stroke();
  ctx.fillStyle = '#4c524e';
  [[2, 2], [9, 3], [5, 8], [12, 11], [1, 13]].forEach(([x, y]) => ctx.fillRect(5 * 16 + x, 16 + y, 3, 3));
  ctx.fillStyle = '#f4f5e9'; ctx.fillRect(3 * 16, 32, 16, 4);
  [1, 5, 9, 13].forEach((x, i) => ctx.fillRect(3 * 16 + x, 35, 2, 2 + i % 2));
  ctx.fillStyle = '#858b84';
  [0, 5, 10, 15].forEach(y => ctx.fillRect(2 * 16, 32 + y, 16, 1));
  ctx.fillRect(2 * 16 + 7, 33, 1, 4); ctx.fillRect(2 * 16 + 3, 38, 1, 4); ctx.fillRect(2 * 16 + 11, 43, 1, 4);

  // Plants use transparent crossed planes instead of full cubes.
  const flowerX = 6 * 16, grassX = 7 * 16;
  ctx.fillStyle = '#587f43'; ctx.fillRect(flowerX + 7, 16 + 6, 2, 10); ctx.fillRect(flowerX + 4, 16 + 10, 4, 2); ctx.fillRect(flowerX + 8, 16 + 12, 4, 2);
  ctx.fillStyle = '#f1e6c0'; ctx.fillRect(flowerX + 5, 16 + 2, 6, 5); ctx.fillRect(flowerX + 6, 16 + 1, 4, 7);
  ctx.fillStyle = '#e4b650'; ctx.fillRect(flowerX + 7, 16 + 3, 2, 2);
  ctx.fillStyle = '#699b4c'; ctx.fillRect(grassX + 3, 16 + 8, 2, 8); ctx.fillRect(grassX + 7, 16 + 4, 2, 12); ctx.fillRect(grassX + 11, 16 + 7, 2, 9);
  ctx.fillStyle = '#89b45b'; ctx.fillRect(grassX + 2, 16 + 6, 2, 5); ctx.fillRect(grassX + 6, 16 + 2, 2, 6); ctx.fillRect(grassX + 10, 16 + 5, 2, 5);
  const torchX = 16;
  ctx.fillStyle = '#705039'; ctx.fillRect(torchX + 7, 32 + 7, 3, 9); ctx.fillStyle = '#ac7949'; ctx.fillRect(torchX + 7, 32 + 8, 1, 7);
  ctx.fillStyle = '#e28c3f'; ctx.fillRect(torchX + 6, 32 + 3, 5, 6); ctx.fillStyle = '#ffe195'; ctx.fillRect(torchX + 7, 32 + 2, 3, 5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}

export function tileUV(tile: number): [number, number, number, number] {
  const inset = 0.08;
  const x = tile % COLS;
  const y = Math.floor(tile / COLS);
  return [(x * TILE + inset) / (COLS * TILE), 1 - ((y + 1) * TILE - inset) / (ROWS * TILE), ((x + 1) * TILE - inset) / (COLS * TILE), 1 - (y * TILE + inset) / (ROWS * TILE)];
}

function drawTexturedFace(ctx: CanvasRenderingContext2D, atlas: HTMLCanvasElement, tile: number, p: [number, number][], shade: number) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  p.slice(1).forEach(point => ctx.lineTo(point[0], point[1]));
  ctx.closePath(); ctx.clip();
  ctx.setTransform((p[1][0] - p[0][0]) / 16, (p[1][1] - p[0][1]) / 16, (p[3][0] - p[0][0]) / 16, (p[3][1] - p[0][1]) / 16, p[0][0], p[0][1]);
  ctx.drawImage(atlas, tile % COLS * 16, Math.floor(tile / COLS) * 16, 16, 16, 0, 0, 16, 16);
  if (shade) { ctx.fillStyle = `rgba(25, 27, 22, ${shade})`; ctx.fillRect(0, 0, 16, 16); }
  ctx.restore();
}

export function createItemIcons(atlas: HTMLCanvasElement): Record<string, string> {
  const icons: Record<string, string> = {};
  Object.values(ITEMS).forEach(item => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    if (item.tool) {
      ctx.save(); ctx.translate(32, 32); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#795536'; ctx.fillRect(-3, -2, 6, 30);
      ctx.fillStyle = '#a67a4a'; ctx.fillRect(-2, 0, 2, 25);
      ctx.fillStyle = item.tool === 'stone' ? '#8c9691' : '#b28456';
      ctx.fillRect(-19, -14, 38, 7); ctx.fillRect(-21, -10, 7, 8); ctx.fillRect(14, -10, 7, 8);
      ctx.fillStyle = item.tool === 'stone' ? '#bdc6bd' : '#dfb47b'; ctx.fillRect(-15, -14, 30, 3);
      ctx.restore();
    } else if (item.id === 'stick') {
      ctx.save(); ctx.translate(32, 32); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#775336'; ctx.fillRect(-4, -24, 8, 48); ctx.fillStyle = '#b18554'; ctx.fillRect(-2, -21, 3, 42); ctx.restore();
    } else if (item.id === 'coal') {
      ctx.fillStyle = '#343b3a'; ctx.fillRect(15, 17, 32, 31); ctx.fillRect(20, 11, 23, 42); ctx.fillStyle = '#59615e'; ctx.fillRect(20, 17, 9, 7); ctx.fillRect(34, 27, 7, 6);
    } else if (item.id === 'flower' || item.id === 'torch') {
      ctx.drawImage(atlas, item.tile % COLS * 16, Math.floor(item.tile / COLS) * 16, 16, 16, 5, 5, 54, 54);
    } else {
      const block = item.block ?? Block.Dirt;
      drawTexturedFace(ctx, atlas, faceTile(block, 0), [[32, 29], [56, 17], [56, 43], [32, 56]], 0.22);
      drawTexturedFace(ctx, atlas, faceTile(block, 4), [[8, 17], [32, 29], [32, 56], [8, 43]], 0.1);
      drawTexturedFace(ctx, atlas, faceTile(block, 2), [[32, 4], [56, 17], [32, 29], [8, 17]], 0);
    }
    icons[item.id] = canvas.toDataURL();
  });
  return icons;
}