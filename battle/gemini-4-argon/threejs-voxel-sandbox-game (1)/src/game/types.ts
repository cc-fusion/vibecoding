export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Bedrock = 5,
  Sand = 6,
  Sandstone = 7,
  Gravel = 8,
  Clay = 9,
  SnowGrass = 10,
  Snow = 11,
  Ice = 12,
  Water = 13,
  OakLog = 14,
  OakLeaves = 15,
  BirchLog = 16,
  BirchLeaves = 17,
  SpruceLog = 18,
  SpruceLeaves = 19,
  Cactus = 20,
  CoalOre = 21,
  IronOre = 22,
  GoldOre = 23,
  DiamondOre = 24,
  EmeraldOre = 25,
  Glowstone = 26,
  OakPlanks = 27,
  BirchPlanks = 28,
  SprucePlanks = 29,
  CraftingTable = 30,
  Furnace = 31,
  Glass = 32,
  Bricks = 33,
  Bookshelf = 34,
  TNT = 35,
  Torch = 36,
  TallGrass = 37,
  RedFlower = 38,
  YellowFlower = 39,
  BlueFlower = 40,
  DeadBush = 41,
  MossyCobble = 42,
  Chest = 43,
}

export type NonBlockItemId =
  | 'stick'
  | 'coal'
  | 'iron_ingot'
  | 'gold_ingot'
  | 'diamond'
  | 'emerald'
  | 'clay_ball'
  | 'brick_item'
  | 'flint'
  | 'apple'
  | 'raw_meat'
  | 'cooked_meat'
  | 'bread'
  | 'wood_pickaxe'
  | 'wood_axe'
  | 'wood_shovel'
  | 'wood_sword'
  | 'stone_pickaxe'
  | 'stone_axe'
  | 'stone_shovel'
  | 'stone_sword'
  | 'iron_pickaxe'
  | 'iron_axe'
  | 'iron_shovel'
  | 'iron_sword'
  | 'gold_pickaxe'
  | 'diamond_pickaxe'
  | 'diamond_axe'
  | 'diamond_shovel'
  | 'diamond_sword';

export type ItemId = `block:${BlockId}` | NonBlockItemId;

export type ToolCategory = 'none' | 'pickaxe' | 'axe' | 'shovel' | 'sword';
export type ToolTier = 0 | 1 | 2 | 3 | 4; // 0=hand, 1=wood, 2=stone, 3=iron/gold, 4=diamond

export type SoundMaterial =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'wood'
  | 'sand'
  | 'glass'
  | 'snow'
  | 'leaves'
  | 'water';

export type RenderPass = 'opaque' | 'cutout' | 'translucent';
export type BlockShape = 'cube' | 'cross' | 'torch' | 'cactus' | 'fluid';

export interface BlockDefinition {
  id: BlockId;
  name: string;
  hardness: number; // seconds with bare hand baseline; <0 unbreakable
  preferredTool: ToolCategory;
  minTier: ToolTier;
  renderPass: RenderPass;
  shape: BlockShape;
  solid: boolean;
  opaque: boolean;
  lightEmission: number; // 0..15
  windSway?: boolean;
  soundMaterial: SoundMaterial;
  particleColor: string;
  // Atlas tile indices: [top, bottom, north, south, east, west]
  faces: [number, number, number, number, number, number];
  dropItem?: ItemId | null;
  dropCount?: number;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  maxStack: number;
  blockId?: BlockId;
  toolCategory: ToolCategory;
  toolTier: ToolTier;
  miningSpeed: number;
  attackDamage: number;
  maxDurability?: number;
  foodRestore?: number;
  healthRestore?: number;
  fuelSeconds?: number;
  accentColor: string;
  secondaryColor?: string;
}

export interface InventorySlot {
  itemId: ItemId;
  count: number;
  durability?: number;
}

export interface RecipeIngredient {
  itemId: ItemId;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'basics' | 'tools' | 'building' | 'utility';
  requiresTable: boolean;
  ingredients: RecipeIngredient[];
  output: {
    itemId: ItemId;
    count: number;
  };
  patternHint: string[]; // up to 3x3 visual grid labels for recipe preview
}

export interface SmeltingRecipe {
  id: string;
  input: ItemId;
  output: ItemId;
  cookTime: number; // seconds
}

export interface FurnaceData {
  key: string; // "x,y,z"
  input: InventorySlot | null;
  fuel: InventorySlot | null;
  output: InventorySlot | null;
  burnRemaining: number;
  burnTotal: number;
  cookProgress: number;
}

export type BiomeId =
  | 'plains'
  | 'forest'
  | 'desert'
  | 'mountains'
  | 'river'
  | 'beach';

export type WeatherKind = 'clear' | 'rain' | 'snow';
export type GameMode = 'survival' | 'creative';

export type MobKind = 'sheep' | 'pig' | 'cow' | 'chicken' | 'zombie' | 'creeper';

export interface MobState {
  id: string;
  kind: MobKind;
  hostile: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  health: number;
  maxHealth: number;
  hurtTimer: number;
  onGround: boolean;
  walkPhase: number;
  aiTimer: number;
  targetYaw: number;
  wandering: boolean;
  fuseTimer: number; // for creeper
}

export interface DroppedItemEntity {
  id: string;
  itemId: ItemId;
  count: number;
  durability?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  pickupDelay: number;
}

export interface ActiveTNT {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

export interface GameSettings {
  renderDistance: number; // 4..9 chunks
  fov: number; // 65..105
  soundVolume: number; // 0..1
  musicEnabled: boolean;
  peacefulMobs: boolean;
  invertY: boolean;
  mouseSensitivity: number; // 0.4..2.0
  autoStep: boolean;
}

export interface MilestoneStep {
  id: string;
  title: string;
  hint: string;
  completed: boolean;
}

export interface WorldSaveMeta {
  id: string;
  name: string;
  seed: number;
  seedText: string;
  mode: GameMode;
  createdAt: number;
  updatedAt: number;
  dayCount: number;
}

export interface WorldSaveData {
  meta: WorldSaveMeta;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    maxHealth: number;
    hunger: number;
    maxHunger: number;
    breath: number;
    flying: boolean;
    selectedHotbar: number;
  };
  timeOfDay: number; // 0..1 (0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0.0 = midnight)
  dayCount: number;
  weather: WeatherKind;
  inventory: (InventorySlot | null)[]; // 36 slots: 0..8 hotbar, 9..35 main bag
  furnaces: FurnaceData[];
  milestones: string[]; // completed milestone IDs
  modifiedBlocks: Array<[number, number, number, BlockId]>;
}

export interface EngineHUDState {
  ready: boolean;
  loadingProgress: number;
  loadingMessage: string;
  pointerLocked: boolean;
  paused: boolean;
  inventoryOpen: boolean;
  nearCraftingTable: boolean;
  activeFurnaceKey: string | null;
  activeFurnace: FurnaceData | null;
  gameOver: boolean;
  mode: GameMode;
  worldName: string;
  seed: number;
  fps: number;
  x: number;
  y: number;
  z: number;
  chunkX: number;
  chunkZ: number;
  loadedChunks: number;
  biome: BiomeId;
  weather: WeatherKind;
  timeOfDay: number;
  dayCount: number;
  isNight: boolean;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  breath: number;
  maxBreath: number;
  underwater: boolean;
  flying: boolean;
  sprinting: boolean;
  selectedHotbar: number;
  inventory: (InventorySlot | null)[];
  targetBlockName: string | null;
  targetBlockCoords: [number, number, number] | null;
  breakProgress: number; // 0..1
  damageFlash: number; // 0..1
  milestones: MilestoneStep[];
  toastMessage: string | null;
  debugOpen: boolean;
  helpOpen: boolean;
  entityCount: number;
}
