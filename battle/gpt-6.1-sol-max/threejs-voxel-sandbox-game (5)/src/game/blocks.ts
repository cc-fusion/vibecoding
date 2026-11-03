import * as THREE from 'three';
import type { Recipe, Stats } from './types';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, COBBLE: 8, GLASS: 9, WATER: 10, COAL: 11, IRON: 12,
  BIRCH: 13, GOLD_LEAVES: 14, PINE_LEAVES: 15, BENCH: 16, TORCH: 17,
  BRICK: 18, SNOW: 19, CACTUS: 20, FURNACE: 21, CAMPFIRE: 22,
  BEDROCK: 23, FLOWER: 24, TALL_GRASS: 25,
  STICK: 101, WOOD_PICK: 102, STONE_PICK: 103, INGOT: 104, IRON_PICK: 105,
  APPLE: 106, BLOOM: 107, AXE: 108,
} as const;

export interface BlockDefinition {
  name: string;
  color: string;
  top?: string;
  side?: string;
  tile: number;
  topTile?: number;
  bottomTile?: number;
  hardness: number;
  solid: boolean;
  placeable: boolean;
  description: string;
}

function block(name: string, color: string, tile: number, hardness = 0.5, extra: Partial<BlockDefinition> = {}): BlockDefinition {
  return { name, color, tile, hardness, solid: true, placeable: true, description: 'A little piece of your world.', ...extra };
}

export const BLOCKS: Record<number, BlockDefinition> = {
  0: block('Air', '#ffffff', 0, 0, { solid: false, placeable: false }),
  1: block('Meadow grass', '#8da85b', 2, 0.35, { topTile: 0, bottomTile: 1, top: '#a5bb70', side: '#8b6b48', description: 'A soft green foundation for a fresh beginning.' }),
  2: block('Earth', '#95714c', 1, 0.3, { description: 'Humble earth. The start of something good.' }),
  3: block('Stone', '#969a92', 3, 1.4, { description: 'Solid, dependable, and better with a pickaxe.' }),
  4: block('River sand', '#decea0', 4, 0.3, { description: 'Sun-warmed sand from the water\'s edge.' }),
  5: block('Oak log', '#8c6741', 5, 0.85, { topTile: 6, bottomTile: 6, top: '#c7a473', description: 'Turn logs into planks, and ideas into homes.' }),
  6: block('Oak leaves', '#6f944a', 7, 0.2, { top: '#91ad58', description: 'A little canopy, wherever you need one.' }),
  7: block('Oak planks', '#c19a64', 8, 0.6, { top: '#d6b681', description: 'For cabins, bridges, and all the in-betweens.' }),
  8: block('Cobblestone', '#8d948d', 9, 1.3, { description: 'Rugged stone with a reassuring weight.' }),
  9: block('Glass', '#b2d8d1', 10, 0.25, { top: '#d3ece4', description: 'A window into the world you are making.' }),
  10: block('Water', '#55b6bb', 0, 0, { solid: false, placeable: false }),
  11: block('Coal ore', '#74786f', 11, 1.6, { description: 'A spark of possibility. Mine with a pickaxe.' }),
  12: block('Iron ore', '#af9e86', 12, 2.1, { description: 'Smelt at a furnace to make iron ingots.' }),
  13: block('Birch log', '#e5dfc5', 13, 0.8, { topTile: 14, bottomTile: 14, top: '#cbbc8d', description: 'Pale wood from the golden grove.' }),
  14: block('Golden leaves', '#b6b65d', 15, 0.2, { top: '#d0ca73' }),
  15: block('Pine needles', '#4f7854', 16, 0.2, { top: '#6a9366' }),
  16: block('Workbench', '#9c774b', 17, 0.7, { topTile: 18, bottomTile: 8, description: 'Keep nearby to craft better tools and useful things.' }),
  17: block('Torch', '#e8b65e', 19, 0.1, { solid: false, description: 'A warm light for long evenings and deep caves.' }),
  18: block('Stone bricks', '#a1a798', 20, 1.4, { description: 'For a home that will outlast the seasons.' }),
  19: block('Snow', '#e7ede4', 21, 0.2, { description: 'A quiet souvenir from the highlands.' }),
  20: block('Cactus', '#6b9462', 22, 0.5),
  21: block('Furnace', '#79817b', 23, 1.6, { topTile: 24, bottomTile: 9, description: 'Keep nearby to smelt ore and make glass.' }),
  22: block('Campfire', '#b5844c', 25, 0.5, { solid: false, description: 'Place, then press R nearby to make it your home.' }),
  23: block('Bedrock', '#444c47', 26, Infinity, { placeable: false }),
  24: block('Wildflower', '#ecc78f', 28, 0.1, { solid: false, placeable: false }),
  25: block('Wild grass', '#9cb66b', 27, 0.1, { solid: false, placeable: false }),
  101: block('Sticks', '#b68c57', 0, 0, { placeable: false, description: 'The small beginning of a useful tool.' }),
  102: block('Wooden pickaxe', '#b99562', 0, 0, { placeable: false, description: 'Mines stone and coal twice as quickly.' }),
  103: block('Stone pickaxe', '#a4aa9c', 0, 0, { placeable: false, description: 'Mines stone quickly. Strong enough for iron.' }),
  104: block('Iron ingot', '#c1c8bf', 0, 0, { placeable: false, description: 'Refined iron, ready for something wonderful.' }),
  105: block('Iron pickaxe', '#d4dbd0', 0, 0, { placeable: false, description: 'Your most efficient companion underground.' }),
  106: block('Wild apple', '#cd6852', 0, 0, { placeable: false, description: 'Right-click to eat. Restores three hearts.' }),
  107: block('Wildflowers', '#e8c07e', 28, 0.1, { solid: false, placeable: true, description: 'A little color makes any place feel like home.' }),
  108: block('Wooden axe', '#bea171', 0, 0, { placeable: false, description: 'Gathers wood three times faster.' }),
};

export const RECIPES: Recipe[] = [
  { id: 'planks', name: 'Oak planks', description: 'A good beginning for a cozy place.', output: B.PLANKS, count: 4, ingredients: [[B.LOG, 1]], category: 'Essentials' },
  { id: 'birch-planks', name: 'Planks from birch', description: 'Golden-grove wood, put to good use.', output: B.PLANKS, count: 4, ingredients: [[B.BIRCH, 1]], category: 'Essentials' },
  { id: 'sticks', name: 'Sticks', description: 'The backbone of every good tool.', output: B.STICK, count: 4, ingredients: [[B.PLANKS, 2]], category: 'Essentials' },
  { id: 'bench', name: 'Workbench', description: 'Carry or place nearby to unlock new recipes.', output: B.BENCH, count: 1, ingredients: [[B.PLANKS, 4]], category: 'Essentials' },
  { id: 'wood-pick', name: 'Wooden pickaxe', description: 'A first step below the surface.', output: B.WOOD_PICK, count: 1, ingredients: [[B.PLANKS, 3], [B.STICK, 2]], station: B.BENCH, category: 'Tools' },
  { id: 'axe', name: 'Wooden axe', description: 'Less chopping. More creating.', output: B.AXE, count: 1, ingredients: [[B.PLANKS, 3], [B.STICK, 2]], station: B.BENCH, category: 'Tools' },
  { id: 'stone-pick', name: 'Stone pickaxe', description: 'A sturdy tool for deeper discoveries.', output: B.STONE_PICK, count: 1, ingredients: [[B.STONE, 3], [B.STICK, 2]], station: B.BENCH, category: 'Tools' },
  { id: 'torches', name: 'Torches', description: 'Bring a little daylight with you.', output: B.TORCH, count: 4, ingredients: [[B.COAL, 1], [B.STICK, 1]], category: 'Essentials' },
  { id: 'campfire', name: 'Campfire', description: 'A warm glow and a place to call home.', output: B.CAMPFIRE, count: 1, ingredients: [[B.LOG, 3], [B.STONE, 2], [B.STICK, 2]], category: 'Essentials' },
  { id: 'furnace', name: 'Furnace', description: 'Turn raw discoveries into useful materials.', output: B.FURNACE, count: 1, ingredients: [[B.STONE, 8]], station: B.BENCH, category: 'Essentials' },
  { id: 'iron', name: 'Iron ingot', description: 'Smelt ore into something stronger.', output: B.INGOT, count: 1, ingredients: [[B.IRON, 2], [B.COAL, 1]], station: B.FURNACE, category: 'Essentials' },
  { id: 'iron-pick', name: 'Iron pickaxe', description: 'For the explorer who keeps going.', output: B.IRON_PICK, count: 1, ingredients: [[B.INGOT, 3], [B.STICK, 2]], station: B.BENCH, category: 'Tools' },
  { id: 'glass', name: 'Glass', description: 'Let the morning light in.', output: B.GLASS, count: 4, ingredients: [[B.SAND, 4], [B.COAL, 1]], station: B.FURNACE, category: 'Building' },
  { id: 'brick', name: 'Stone bricks', description: 'A little more considered. A little more home.', output: B.BRICK, count: 4, ingredients: [[B.STONE, 4]], station: B.BENCH, category: 'Building' },
  { id: 'cobble', name: 'Cobblestone', description: 'A rustic finish for walls and paths.', output: B.COBBLE, count: 4, ingredients: [[B.STONE, 4]], category: 'Building' },
];

export function getQuests(stats: Stats) {
  return [
    { id: 'timber', title: 'A fresh start', text: 'Gather 3 oak or birch logs', current: (stats.gathered[B.LOG] || 0) + (stats.gathered[B.BIRCH] || 0), goal: 3, reward: '2 wild apples' },
    { id: 'workbench', title: 'Made by you', text: 'Craft your first workbench', current: stats.crafted[B.BENCH] || 0, goal: 1, reward: '4 torches' },
    { id: 'builder', title: 'Leave your mark', text: 'Place 10 blocks in the world', current: stats.placed, goal: 10, reward: '2 wild apples' },
    { id: 'stone-age', title: 'A deeper curiosity', text: 'Craft a stone pickaxe', current: stats.crafted[B.STONE_PICK] || 0, goal: 1, reward: '4 torches' },
    { id: 'wanderer', title: 'The scenic route', text: 'Discover 3 different biomes', current: stats.biomes.length, goal: 3, reward: '2 wild apples' },
    { id: 'iron-age', title: 'Something stronger', text: 'Smelt your first iron ingot', current: stats.crafted[B.INGOT] || 0, goal: 1, reward: '4 torches' },
  ];
}

export function isSolid(id: number) { return BLOCKS[id]?.solid ?? false; }
export function isOpaque(id: number) { return isSolid(id) && id !== B.GLASS; }
export function isPlant(id: number) { return id === B.TALL_GRASS || id === B.FLOWER || id === B.BLOOM; }

export function createAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const bases = ['#92ad5b', '#95704e', '#95704e', '#999e94', '#ded0a5', '#8b6944', '#b79a6b', '#77984c', '#c5a16b', '#92998e', '#b5dbd2', '#96998d', '#9f9d8e', '#dedac1', '#c7b987', '#b9b768', '#577d52', '#a38152', '#bf9b64', '#a37840', '#9ca291', '#e8eee3', '#719863', '#798479', '#939b8e', '#885f37', '#535d53', '#98ad60', '#e2bc79'];
  let randomSeed = 1451;
  const rand = () => { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; };
  for (let tile = 0; tile < bases.length; tile++) {
    const x = (tile % 8) * 16;
    const y = Math.floor(tile / 8) * 16;
    if (tile === 27 || tile === 28) {
      ctx.fillStyle = '#6a924a';
      ctx.fillRect(x + 7, y + 6, 2, 10);
      ctx.fillRect(x + 4, y + 9, 3, 2);
      ctx.fillRect(x + 9, y + 7, 3, 2);
      if (tile === 27) {
        ctx.fillStyle = '#a5b971';
        ctx.fillRect(x + 4, y + 5, 2, 7);
        ctx.fillRect(x + 10, y + 3, 2, 8);
      } else {
        ctx.fillStyle = '#f4dca0';
        ctx.fillRect(x + 5, y + 2, 6, 6);
        ctx.fillRect(x + 3, y + 4, 10, 2);
        ctx.fillStyle = '#d18e5c';
        ctx.fillRect(x + 7, y + 4, 2, 2);
      }
      continue;
    }
    ctx.fillStyle = bases[tile];
    ctx.fillRect(x, y, 16, 16);
    for (let n = 0; n < 50; n++) {
      ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,224,${0.035 + rand() * 0.09})` : `rgba(27,35,23,${0.035 + rand() * 0.1})`;
      ctx.fillRect(x + Math.floor(rand() * 16), y + Math.floor(rand() * 16), 1 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 2));
    }
    if (tile === 2) {
      ctx.fillStyle = '#8ca555';
      ctx.fillRect(x, y, 16, 4);
      for (let n = 0; n < 8; n++) ctx.fillRect(x + n * 2, y + 4, 2, Math.floor(rand() * 4));
    }
    if (tile === 5 || tile === 13) {
      ctx.fillStyle = tile === 13 ? '#777d63' : '#725234';
      for (let n = 0; n < 7; n++) ctx.fillRect(x + Math.floor(rand() * 15), y + Math.floor(rand() * 12), tile === 13 ? 4 : 1, tile === 13 ? 2 : 5);
    }
    if (tile === 6 || tile === 14) {
      ctx.strokeStyle = '#95774e';
      ctx.lineWidth = 1;
      for (let n = 2; n < 8; n += 2) ctx.strokeRect(x + n, y + n, 16 - n * 2, 16 - n * 2);
    }
    if (tile === 8 || tile === 18) {
      ctx.fillStyle = '#9b7b50';
      for (let n = 4; n < 16; n += 4) ctx.fillRect(x, y + n, 16, 1);
      ctx.fillRect(x + 6, y, 1, 4);
      ctx.fillRect(x + 12, y + 4, 1, 4);
      ctx.fillRect(x + 3, y + 8, 1, 4);
      if (tile === 18) {
        ctx.fillStyle = '#715a3b';
        for (let n = 4; n <= 12; n += 4) { ctx.fillRect(x + n, y + 2, 1, 12); ctx.fillRect(x + 2, y + n, 12, 1); }
      }
    }
    if (tile === 9 || tile === 20 || tile === 24 || tile === 26) {
      ctx.fillStyle = tile === 26 ? '#39473c' : '#727d70';
      for (let n = 0; n < 16; n += tile === 20 ? 5 : 8) {
        ctx.fillRect(x, y + n, 16, 1);
        ctx.fillRect(x + ((n % 2) * 5 + 3), y + n, 1, 7);
      }
    }
    if (tile === 11 || tile === 12) {
      ctx.fillStyle = tile === 11 ? '#424a40' : '#cbb08b';
      for (let n = 0; n < 7; n++) ctx.fillRect(x + 1 + Math.floor(rand() * 12), y + 1 + Math.floor(rand() * 12), 2 + Math.floor(rand() * 2), 2);
    }
    if (tile === 10) {
      ctx.fillStyle = '#cce8dc';
      ctx.fillRect(x, y, 16, 1); ctx.fillRect(x, y, 1, 16);
      ctx.fillRect(x, y + 15, 16, 1); ctx.fillRect(x + 15, y, 1, 16);
      ctx.fillStyle = '#e8f5e7';
      ctx.fillRect(x + 3, y + 3, 1, 5); ctx.fillRect(x + 4, y + 2, 3, 1);
    }
    if (tile === 19 || tile === 25) {
      ctx.fillStyle = '#f7b64c'; ctx.fillRect(x + 3, y, 10, 8);
      ctx.fillStyle = '#ffdf88'; ctx.fillRect(x + 5, y, 6, 5);
    }
    if (tile === 23) {
      ctx.fillStyle = '#34433b'; ctx.fillRect(x + 3, y + 6, 10, 7);
      ctx.fillStyle = '#b8864a'; ctx.fillRect(x + 5, y + 10, 6, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}