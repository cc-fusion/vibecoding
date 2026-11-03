export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  PLANKS: 8,
  BRICKS: 9,
  COBBLE: 10,
  PINE_LEAVES: 11,
  SANDSTONE: 12,
  WOOL: 13,
  AXE: 101,
  PICKAXE: 102,
} as const;

export interface ItemInfo {
  name: string;
  description: string;
  top: string;
  left: string;
  right: string;
  kind: 'block' | 'tool';
  hardness: number;
}

export const ITEMS: Record<number, ItemInfo> = {
  [BLOCK.GRASS]: { name: 'Grass block', description: 'A little piece of the meadow.', top: '#84b85b', left: '#79543a', right: '#9a6c47', kind: 'block', hardness: 0.38 },
  [BLOCK.DIRT]: { name: 'Dirt', description: 'The start of something good.', top: '#a5754c', left: '#795039', right: '#91603d', kind: 'block', hardness: 0.34 },
  [BLOCK.STONE]: { name: 'Stone', description: 'A sturdy building staple.', top: '#b3b7ad', left: '#777f78', right: '#989e94', kind: 'block', hardness: 1.1 },
  [BLOCK.LOG]: { name: 'Oak log', description: 'Gathered from the woodland.', top: '#cda66b', left: '#805932', right: '#a47643', kind: 'block', hardness: 0.8 },
  [BLOCK.LEAVES]: { name: 'Oak leaves', description: 'A handful of leafy green.', top: '#83b55b', left: '#4d873f', right: '#659e4a', kind: 'block', hardness: 0.22 },
  [BLOCK.SAND]: { name: 'Sand', description: 'A little bit of the riverbank.', top: '#e7d59a', left: '#bdac78', right: '#d5c48b', kind: 'block', hardness: 0.3 },
  [BLOCK.PLANKS]: { name: 'Oak planks', description: 'Made for building cozy places.', top: '#d8ad73', left: '#a77743', right: '#c4965c', kind: 'block', hardness: 0.65 },
  [BLOCK.BRICKS]: { name: 'Stone bricks', description: 'A more refined kind of stone.', top: '#c1c3b7', left: '#858c83', right: '#a3a89d', kind: 'block', hardness: 1 },
  [BLOCK.COBBLE]: { name: 'Cobblestone', description: 'Weathered and wonderfully solid.', top: '#9ea69c', left: '#6e776f', right: '#889088', kind: 'block', hardness: 1 },
  [BLOCK.PINE_LEAVES]: { name: 'Pine leaves', description: 'Fresh from the forest.', top: '#669c68', left: '#3b7048', right: '#528957', kind: 'block', hardness: 0.22 },
  [BLOCK.SANDSTONE]: { name: 'Sandstone', description: 'Sun-warmed building stone.', top: '#ebd7a4', left: '#c6b282', right: '#d9c696', kind: 'block', hardness: 0.7 },
  [BLOCK.WOOL]: { name: 'Wool', description: 'A gift from a friendly sheep.', top: '#f4f1df', left: '#c7c6b9', right: '#e0dfd2', kind: 'block', hardness: 0.35 },
  [BLOCK.AXE]: { name: 'Wooden axe', description: 'Best for gathering wood.', top: '#d6a770', left: '#825933', right: '#ad7f4a', kind: 'tool', hardness: 0 },
  [BLOCK.PICKAXE]: { name: 'Wooden pickaxe', description: 'Best for gathering stone.', top: '#d6a770', left: '#825933', right: '#ad7f4a', kind: 'tool', hardness: 0 },
};

export interface Slot {
  id: number;
  count: number;
}

export interface Recipe {
  id: string;
  output: number;
  amount: number;
  ingredients: { id: number; count: number }[];
  note: string;
}

export const RECIPES: Recipe[] = [
  { id: 'planks', output: BLOCK.PLANKS, amount: 4, ingredients: [{ id: BLOCK.LOG, count: 1 }], note: 'A building essential' },
  { id: 'bricks', output: BLOCK.BRICKS, amount: 4, ingredients: [{ id: BLOCK.STONE, count: 4 }], note: 'For the finer details' },
  { id: 'sandstone', output: BLOCK.SANDSTONE, amount: 4, ingredients: [{ id: BLOCK.SAND, count: 4 }], note: 'A little sun-warmed stone' },
];

export function starterInventory(): (Slot | null)[] {
  return [
    { id: BLOCK.AXE, count: 1 },
    { id: BLOCK.PICKAXE, count: 1 },
    { id: BLOCK.GRASS, count: 24 },
    { id: BLOCK.DIRT, count: 24 },
    { id: BLOCK.LOG, count: 8 },
    { id: BLOCK.PLANKS, count: 16 },
    { id: BLOCK.STONE, count: 16 },
    { id: BLOCK.SAND, count: 12 },
    { id: BLOCK.BRICKS, count: 12 },
    ...Array<null>(18).fill(null),
  ];
}

export const isSolid = (id: number) => id !== BLOCK.AIR && id !== BLOCK.WATER;