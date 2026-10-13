export type Biome = "meadow" | "pinewood" | "dunes" | "frost" | "cinder";

export type BlockId =
  | "bedrock" | "grass" | "pineGrass" | "snow" | "sand" | "basalt"
  | "dirt" | "stone" | "coalOre" | "ironOre" | "diamondOre"
  | "wood" | "pineWood" | "leaves" | "pineLeaves" | "water"
  | "farmland" | "crop" | "cropRipe" | "plank" | "glass"
  | "workbench" | "furnace" | "enchanter" | "bed" | "torch";

export type ItemId =
  | "wood" | "plank" | "dirt" | "stone" | "sand" | "glass"
  | "coal" | "ironOre" | "ironIngot" | "diamond" | "seeds" | "wheat"
  | "berry" | "bread" | "bandage" | "rawMeat" | "cookedMeat" | "leather"
  | "string" | "wool" | "pearl" | "woodPick" | "stonePick"
  | "ironPick" | "diamondPick" | "stoneSword" | "ironSword"
  | "diamondSword" | "bow" | "arrow" | "hoe" | "workbench"
  | "furnace" | "enchanter" | "bed" | "torch";

export type MobType = "zombie" | "skeleton" | "spider" | "creeper" | "enderman" | "pig" | "cow" | "sheep" | "chicken";
export type DifficultyId = "explorer" | "survivor" | "nightmare";
export type Phase = "title" | "playing" | "paused" | "dead" | "won";
export type Panel = "help" | "settings" | "inventory" | "craft" | "smelt" | "enchant" | "ritual" | "map" | "legacy" | "newGame" | null;

export interface BlockInfo {
  name: string;
  color: string;
  top?: string;
  side?: string;
  hardness: number;
  drop?: ItemId;
  tier?: number;
  solid?: boolean;
}

export const BLOCKS: Record<BlockId, BlockInfo> = {
  bedrock: { name: "Bedrock", color: "#30343b", hardness: 999 },
  grass: { name: "Meadow grass", color: "#7eae6d", side: "#886f52", hardness: 0.65, drop: "dirt" },
  pineGrass: { name: "Forest floor", color: "#567a67", side: "#705e4d", hardness: 0.7, drop: "dirt" },
  snow: { name: "Frosted earth", color: "#dce3df", side: "#84918e", hardness: 0.75, drop: "dirt" },
  sand: { name: "Sunbleached sand", color: "#dbc694", hardness: 0.55, drop: "sand" },
  basalt: { name: "Cinderstone", color: "#5f6268", hardness: 2.15, drop: "stone", tier: 1 },
  dirt: { name: "Dirt", color: "#947354", hardness: 0.6, drop: "dirt" },
  stone: { name: "Stone", color: "#9ca3a0", hardness: 2.2, drop: "stone", tier: 1 },
  coalOre: { name: "Coal seam", color: "#828e91", hardness: 2.3, drop: "coal", tier: 1 },
  ironOre: { name: "Iron seam", color: "#a29585", hardness: 2.8, drop: "ironOre", tier: 1 },
  diamondOre: { name: "Star crystal", color: "#6ba8a9", hardness: 4.2, drop: "diamond", tier: 3 },
  wood: { name: "Oak timber", color: "#9c7954", top: "#b8946a", hardness: 1.3, drop: "wood" },
  pineWood: { name: "Pine timber", color: "#80684f", top: "#ae8b60", hardness: 1.3, drop: "wood" },
  leaves: { name: "Oak leaves", color: "#5e9369", hardness: 0.35 },
  pineLeaves: { name: "Pine needles", color: "#407361", hardness: 0.4 },
  water: { name: "Water", color: "#5a9ea9", hardness: 999, solid: false },
  farmland: { name: "Tilled earth", color: "#725438", hardness: 0.65, drop: "dirt" },
  crop: { name: "Young wheat", color: "#80a861", hardness: 0.15, solid: false },
  cropRipe: { name: "Ripe wheat", color: "#dfb968", hardness: 0.15, solid: false },
  plank: { name: "Timber planks", color: "#b58d5f", hardness: 1.15, drop: "plank" },
  glass: { name: "Glass", color: "#9ac4c5", hardness: 0.3, drop: "glass" },
  workbench: { name: "Workbench", color: "#9b704c", hardness: 1.8, drop: "workbench" },
  furnace: { name: "Furnace", color: "#777c7c", hardness: 2.6, drop: "furnace", tier: 1 },
  enchanter: { name: "Enchanter", color: "#544f6a", hardness: 2.4, drop: "enchanter", tier: 1 },
  bed: { name: "Camp bed", color: "#b3645e", hardness: 0.8, drop: "bed" },
  torch: { name: "Torch", color: "#efae5e", hardness: 0.15, drop: "torch", solid: false },
};

export interface ItemInfo { name: string; color: string; kind: "block" | "tool" | "material" | "food" | "station"; description: string; food?: number; }
export const ITEMS: Record<ItemId, ItemInfo> = {
  wood: { name: "Timber", color: "#a87b50", kind: "block", description: "The beginning of almost everything." },
  plank: { name: "Planks", color: "#c79d68", kind: "block", description: "Useful for building and crafting." },
  dirt: { name: "Dirt", color: "#9c7651", kind: "block", description: "Shape the land beneath your feet." },
  stone: { name: "Stone", color: "#929c9b", kind: "block", description: "Strong enough to make real tools." },
  sand: { name: "Sand", color: "#dfc995", kind: "block", description: "Smelt into glass or build with it." },
  glass: { name: "Glass", color: "#a8d3d0", kind: "block", description: "A clear window into the wild." },
  coal: { name: "Coal", color: "#424d55", kind: "material", description: "Fuels three furnace jobs or makes torches." },
  ironOre: { name: "Iron ore", color: "#bd9375", kind: "material", description: "Smelt this at a furnace." },
  ironIngot: { name: "Iron ingot", color: "#d3d7cc", kind: "material", description: "Forged for stronger equipment." },
  diamond: { name: "Star crystal", color: "#76d4cb", kind: "material", description: "Rare. An iron pick is required." },
  seeds: { name: "Wheat seeds", color: "#b6bf69", kind: "material", description: "Plant on tilled earth." },
  wheat: { name: "Wheat", color: "#dfb968", kind: "material", description: "Bake three into bread." },
  berry: { name: "Wild berries", color: "#dc696e", kind: "food", description: "Eat to restore 17 hunger.", food: 17 },
  bread: { name: "Bread", color: "#d7a96a", kind: "food", description: "Restores 38 hunger and 1 health.", food: 38 },
  bandage: { name: "Field bandage", color: "#dfd6bd", kind: "food", description: "Use to restore 5 health.", food: 1 },
  rawMeat: { name: "Raw meat", color: "#bd6865", kind: "food", description: "Edible, but better cooked.", food: 10 },
  cookedMeat: { name: "Roast meat", color: "#b87551", kind: "food", description: "Restores 48 hunger and 2 health.", food: 48 },
  leather: { name: "Leather", color: "#a2734e", kind: "material", description: "A trophy from the pasture." },
  string: { name: "Spider silk", color: "#dad7cb", kind: "material", description: "Weave this into a bow." },
  wool: { name: "Wool", color: "#e7e4d7", kind: "material", description: "Make a bed to survive the night." },
  pearl: { name: "Void pearl", color: "#9d85be", kind: "material", description: "The key to waking the altar." },
  woodPick: { name: "Wood pickaxe", color: "#c39a6d", kind: "tool", description: "Tier I. A modest start." },
  stonePick: { name: "Stone pickaxe", color: "#a9b2ad", kind: "tool", description: "Tier II. Mine faster." },
  ironPick: { name: "Iron pickaxe", color: "#d8dcd3", kind: "tool", description: "Tier III. Break star crystal." },
  diamondPick: { name: "Crystal pickaxe", color: "#87e6d6", kind: "tool", description: "Tier IV. The earth yields quickly." },
  stoneSword: { name: "Stone blade", color: "#a9b2ad", kind: "tool", description: "A dependable first weapon." },
  ironSword: { name: "Iron blade", color: "#d8dcd3", kind: "tool", description: "A sharper answer to the dark." },
  diamondSword: { name: "Crystal blade", color: "#87e6d6", kind: "tool", description: "Forged for the final hunt." },
  bow: { name: "Longbow", color: "#b28c67", kind: "tool", description: "Hold arrows. Strike from a distance." },
  arrow: { name: "Arrows", color: "#d5c4a3", kind: "material", description: "Ammunition for the longbow." },
  hoe: { name: "Stone hoe", color: "#a4a99c", kind: "tool", description: "Right click grass to till it." },
  workbench: { name: "Workbench", color: "#bc8b5c", kind: "station", description: "Place it to unlock advanced recipes." },
  furnace: { name: "Furnace", color: "#919898", kind: "station", description: "Place it, then press E to smelt." },
  enchanter: { name: "Enchanter", color: "#9984b6", kind: "station", description: "Place it, then press E to spend XP." },
  bed: { name: "Camp bed", color: "#cb7771", kind: "station", description: "Place it, then press E at night." },
  torch: { name: "Torch", color: "#efb760", kind: "station", description: "Light wards off nearby monsters." },
};

export const PLACEABLES: Partial<Record<ItemId, BlockId>> = {
  wood: "wood", plank: "plank", dirt: "dirt", stone: "stone", sand: "sand", glass: "glass",
  workbench: "workbench", furnace: "furnace", enchanter: "enchanter", bed: "bed", torch: "torch",
};

export interface Recipe { id: string; output: ItemId; amount: number; costs: Partial<Record<ItemId, number>>; station: "hand" | "bench"; category: "essentials" | "equipment" | "survival"; }
export const RECIPES: Recipe[] = [
  { id: "planks", output: "plank", amount: 4, costs: { wood: 1 }, station: "hand", category: "essentials" },
  { id: "workbench", output: "workbench", amount: 1, costs: { wood: 4 }, station: "hand", category: "essentials" },
  { id: "woodPick", output: "woodPick", amount: 1, costs: { wood: 2, plank: 2 }, station: "hand", category: "equipment" },
  { id: "stonePick", output: "stonePick", amount: 1, costs: { stone: 3, wood: 2 }, station: "bench", category: "equipment" },
  { id: "ironPick", output: "ironPick", amount: 1, costs: { ironIngot: 3, wood: 2 }, station: "bench", category: "equipment" },
  { id: "diamondPick", output: "diamondPick", amount: 1, costs: { diamond: 3, wood: 2 }, station: "bench", category: "equipment" },
  { id: "stoneSword", output: "stoneSword", amount: 1, costs: { stone: 2, wood: 1 }, station: "bench", category: "equipment" },
  { id: "ironSword", output: "ironSword", amount: 1, costs: { ironIngot: 2, wood: 1 }, station: "bench", category: "equipment" },
  { id: "diamondSword", output: "diamondSword", amount: 1, costs: { diamond: 2, wood: 1 }, station: "bench", category: "equipment" },
  { id: "bow", output: "bow", amount: 1, costs: { wood: 3, string: 2 }, station: "bench", category: "equipment" },
  { id: "arrow", output: "arrow", amount: 8, costs: { wood: 1, stone: 1 }, station: "hand", category: "equipment" },
  { id: "hoe", output: "hoe", amount: 1, costs: { stone: 2, wood: 1 }, station: "bench", category: "equipment" },
  { id: "furnace", output: "furnace", amount: 1, costs: { stone: 8 }, station: "bench", category: "essentials" },
  { id: "enchanter", output: "enchanter", amount: 1, costs: { stone: 4, diamond: 1, wood: 2 }, station: "bench", category: "essentials" },
  { id: "bed", output: "bed", amount: 1, costs: { wool: 3, wood: 3 }, station: "bench", category: "survival" },
  { id: "torch", output: "torch", amount: 4, costs: { coal: 1, wood: 1 }, station: "hand", category: "survival" },
  { id: "bandage", output: "bandage", amount: 2, costs: { leather: 1, wool: 1 }, station: "bench", category: "survival" },
  { id: "bread", output: "bread", amount: 1, costs: { wheat: 3 }, station: "hand", category: "survival" },
];

export const DIFFICULTIES: Record<DifficultyId, { name: string; subtitle: string; damage: number; hunger: number; spawns: number; boss: number }> = {
  explorer: { name: "Wanderer", subtitle: "More daylight. A gentler wilderness.", damage: 0.65, hunger: 0.7, spawns: 0.7, boss: 0.75 },
  survivor: { name: "Survivor", subtitle: "The intended expedition.", damage: 1, hunger: 1, spawns: 1, boss: 1 },
  nightmare: { name: "Nightfall", subtitle: "No shelter is safe for long.", damage: 1.5, hunger: 1.35, spawns: 1.45, boss: 1.3 },
};

export type PerkId = "heart" | "provisions" | "miner" | "warden";
export const PERKS: Record<PerkId, { name: string; subtitle: string; max: number; baseCost: number }> = {
  heart: { name: "Stout Heart", subtitle: "+2 maximum health per rank", max: 3, baseCost: 3 },
  provisions: { name: "Trail Rations", subtitle: "Start with more wood and berries", max: 3, baseCost: 2 },
  miner: { name: "Old Hands", subtitle: "+12% mining speed per rank", max: 3, baseCost: 3 },
  warden: { name: "Dusk Ward", subtitle: "Take 8% less damage per rank", max: 3, baseCost: 4 },
};

export const TOOL_DURABILITY: Partial<Record<ItemId, number>> = {
  woodPick: 110, stonePick: 190, ironPick: 300, diamondPick: 450,
  stoneSword: 170, ironSword: 280, diamondSword: 420, bow: 300, hoe: 220,
};

export const PICK_TIER: Partial<Record<ItemId, number>> = { woodPick: 1, stonePick: 2, ironPick: 3, diamondPick: 4 };
export const BIOME_NAMES: Record<Biome, string> = {
  meadow: "Sunlit Meadow", pinewood: "The Pinewilds", dunes: "Amber Dunes", frost: "Frostline", cinder: "Cinder Wastes",
};