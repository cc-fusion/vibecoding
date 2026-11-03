export const BLOCK = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  oakLog: 6,
  leaves: 7,
  planks: 8,
  coalOre: 9,
  copperOre: 10,
  amethyst: 11,
  snow: 12,
  workbench: 13,
  lantern: 14,
} as const;

export type BlockId = (typeof BLOCK)[keyof typeof BLOCK];

export const ITEM_IDS = [
  "grass",
  "dirt",
  "stone",
  "sand",
  "oak_log",
  "oak_leaves",
  "oak_planks",
  "coal",
  "copper_fragment",
  "amethyst_shard",
  "snow_block",
  "workbench",
  "lantern",
  "sticks",
  "stone_pickaxe",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDefinition {
  id: ItemId;
  name: string;
  shortName: string;
  description: string;
  color: string;
  block?: BlockId;
  stackSize: number;
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  grass: {
    id: "grass",
    name: "Meadow turf",
    shortName: "Turf",
    description: "A square of sun-warmed meadow.",
    color: "#82a85e",
    block: BLOCK.grass,
    stackSize: 64,
  },
  dirt: {
    id: "dirt",
    name: "Rich earth",
    shortName: "Dirt",
    description: "Good ground for building on.",
    color: "#8c674c",
    block: BLOCK.dirt,
    stackSize: 64,
  },
  stone: {
    id: "stone",
    name: "Fieldstone",
    shortName: "Stone",
    description: "A dependable building block.",
    color: "#929a9a",
    block: BLOCK.stone,
    stackSize: 64,
  },
  sand: {
    id: "sand",
    name: "Pale sand",
    shortName: "Sand",
    description: "Fine-grained stone from the shore.",
    color: "#d2bd85",
    block: BLOCK.sand,
    stackSize: 64,
  },
  oak_log: {
    id: "oak_log",
    name: "Oak log",
    shortName: "Oak log",
    description: "Fresh timber, ready to work.",
    color: "#855a3c",
    block: BLOCK.oakLog,
    stackSize: 64,
  },
  oak_leaves: {
    id: "oak_leaves",
    name: "Oak leaves",
    shortName: "Leaves",
    description: "A little canopy for a little shelter.",
    color: "#658653",
    block: BLOCK.leaves,
    stackSize: 64,
  },
  oak_planks: {
    id: "oak_planks",
    name: "Oak planks",
    shortName: "Planks",
    description: "Smoothed timber for tools and shelter.",
    color: "#bd9160",
    block: BLOCK.planks,
    stackSize: 64,
  },
  coal: {
    id: "coal",
    name: "Coal",
    shortName: "Coal",
    description: "A dark, useful fuel.",
    color: "#353c42",
    stackSize: 64,
  },
  copper_fragment: {
    id: "copper_fragment",
    name: "Copper fragment",
    shortName: "Copper",
    description: "Warm metal, still rough from the earth.",
    color: "#c17b4d",
    stackSize: 64,
  },
  amethyst_shard: {
    id: "amethyst_shard",
    name: "Amethyst shard",
    shortName: "Amethyst",
    description: "A clear violet crystal from deep stone.",
    color: "#a17bda",
    stackSize: 64,
  },
  snow_block: {
    id: "snow_block",
    name: "Packed snow",
    shortName: "Snow",
    description: "A cool block gathered from the highlands.",
    color: "#d9e7e5",
    block: BLOCK.snow,
    stackSize: 64,
  },
  workbench: {
    id: "workbench",
    name: "Worktable",
    shortName: "Table",
    description: "A small, sturdy station for careful work.",
    color: "#9b7048",
    block: BLOCK.workbench,
    stackSize: 16,
  },
  lantern: {
    id: "lantern",
    name: "Copper lantern",
    shortName: "Lantern",
    description: "A warm beacon for long evenings.",
    color: "#eab66e",
    block: BLOCK.lantern,
    stackSize: 16,
  },
  sticks: {
    id: "sticks",
    name: "Sticks",
    shortName: "Sticks",
    description: "Simple handles for tools and lights.",
    color: "#ac8054",
    stackSize: 64,
  },
  stone_pickaxe: {
    id: "stone_pickaxe",
    name: "Stone pickaxe",
    shortName: "Pickaxe",
    description: "Breaks stone and ore much faster.",
    color: "#788487",
    stackSize: 1,
  },
};

export interface BlockDefinition {
  id: BlockId;
  name: string;
  drop?: ItemId;
  hardness: number;
  solid: boolean;
}

export const BLOCKS: Record<BlockId, BlockDefinition> = {
  [BLOCK.air]: { id: BLOCK.air, name: "Air", hardness: 0, solid: false },
  [BLOCK.grass]: { id: BLOCK.grass, name: "Meadow turf", drop: "dirt", hardness: 0.42, solid: true },
  [BLOCK.dirt]: { id: BLOCK.dirt, name: "Rich earth", drop: "dirt", hardness: 0.38, solid: true },
  [BLOCK.stone]: { id: BLOCK.stone, name: "Fieldstone", drop: "stone", hardness: 1.08, solid: true },
  [BLOCK.sand]: { id: BLOCK.sand, name: "Pale sand", drop: "sand", hardness: 0.35, solid: true },
  [BLOCK.water]: { id: BLOCK.water, name: "Fresh water", hardness: 0.3, solid: false },
  [BLOCK.oakLog]: { id: BLOCK.oakLog, name: "Oak log", drop: "oak_log", hardness: 0.72, solid: true },
  [BLOCK.leaves]: { id: BLOCK.leaves, name: "Oak leaves", drop: "oak_leaves", hardness: 0.22, solid: true },
  [BLOCK.planks]: { id: BLOCK.planks, name: "Oak planks", drop: "oak_planks", hardness: 0.58, solid: true },
  [BLOCK.coalOre]: { id: BLOCK.coalOre, name: "Coal seam", drop: "coal", hardness: 1.18, solid: true },
  [BLOCK.copperOre]: { id: BLOCK.copperOre, name: "Copper ore", drop: "copper_fragment", hardness: 1.28, solid: true },
  [BLOCK.amethyst]: { id: BLOCK.amethyst, name: "Amethyst geode", drop: "amethyst_shard", hardness: 1.38, solid: true },
  [BLOCK.snow]: { id: BLOCK.snow, name: "Packed snow", drop: "snow_block", hardness: 0.32, solid: true },
  [BLOCK.workbench]: { id: BLOCK.workbench, name: "Worktable", drop: "workbench", hardness: 0.58, solid: true },
  [BLOCK.lantern]: { id: BLOCK.lantern, name: "Copper lantern", drop: "lantern", hardness: 0.38, solid: true },
};

export const DEFAULT_HOTBAR: ItemId[] = [
  "dirt",
  "stone",
  "oak_log",
  "oak_planks",
  "grass",
  "sand",
  "workbench",
  "lantern",
  "stone_pickaxe",
];

export const STARTING_INVENTORY: Partial<Record<ItemId, number>> = {
  dirt: 18,
  stone: 8,
  oak_log: 2,
  oak_planks: 8,
  sand: 4,
};

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Partial<Record<ItemId, number>>;
  output: Partial<Record<ItemId, number>>;
  requiresWorkbench?: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: "planks",
    name: "Oak planks",
    description: "Turn one log into four smooth boards.",
    ingredients: { oak_log: 1 },
    output: { oak_planks: 4 },
  },
  {
    id: "sticks",
    name: "Carved sticks",
    description: "Split two planks into four handles.",
    ingredients: { oak_planks: 2 },
    output: { sticks: 4 },
  },
  {
    id: "workbench",
    name: "Worktable",
    description: "A station for making stronger tools.",
    ingredients: { oak_planks: 4 },
    output: { workbench: 1 },
  },
  {
    id: "stone-pickaxe",
    name: "Stone pickaxe",
    description: "A sturdy pick for seams of stone and ore.",
    ingredients: { stone: 3, sticks: 2 },
    output: { stone_pickaxe: 1 },
    requiresWorkbench: true,
  },
  {
    id: "lantern",
    name: "Copper lantern",
    description: "A little warmth for a long night.",
    ingredients: { copper_fragment: 2, coal: 1, sticks: 1 },
    output: { lantern: 1 },
    requiresWorkbench: true,
  },
];

export const SAVE_KEY = "moss-and-mica-world-v1";