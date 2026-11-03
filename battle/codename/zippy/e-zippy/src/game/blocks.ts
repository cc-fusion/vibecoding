export const CHUNK = 16;
export const HEIGHT = 64;
export const SEA = 30;

export enum B {
  Air = 0, Grass = 1, Dirt = 2, Stone = 3, Cobble = 4, Planks = 5, Log = 6, Leaves = 7,
  Sand = 8, Glass = 9, Brick = 10, Bedrock = 11, Water = 12, Snow = 13, Sandstone = 14,
  Gravel = 15, CoalOre = 16, IronOre = 17, DiamondOre = 18, GoldOre = 19, Glowstone = 20,
  Crafting = 21, Furnace = 22, MossyCobble = 23, Ice = 24, Obsidian = 25, TNT = 26,
  WoolWhite = 27, WoolRed = 28, WoolBlue = 29, WoolYellow = 30, Pumpkin = 31, Melon = 32,
  Sponge = 33, Clay = 34, StoneBrick = 35, Bookshelf = 36, Mushroom = 37, Cactus = 38,
  Lava = 39, Netherrack = 40, SoulSand = 41, RedstoneOre = 42, LapisOre = 43, EmeraldOre = 44,
  SnowGrass = 45, Prismarine = 46, EndStone = 47, Quartz = 48, OakStairs = 49,
}

export interface BlockDef {
  id: number; name: string; tiles: { top: number; side: number; bottom: number };
  hardness: number; // seconds with hand
  tool: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
  solid: boolean; transparent: boolean; liquid?: boolean; emissive?: boolean;
  color: number; // particle / minimap
  drop?: number; // block id dropped (0 = nothing)
  xp?: number;
}

const T = {
  grassTop: 0, grassSide: 1, dirt: 2, stone: 3, cobble: 4, planks: 5, logSide: 6, logTop: 7,
  leaves: 8, sand: 9, glass: 10, brick: 11, bedrock: 12, snow: 13, sandstone: 14, gravel: 15,
  coal: 16, iron: 17, diamond: 18, gold: 19, glow: 20, craftSide: 21, craftTop: 22,
  furnaceSide: 23, furnaceTop: 24, mossy: 25, ice: 26, obsidian: 27, tntSide: 28, tntTop: 29,
  woolW: 30, woolR: 31, woolB: 32, woolY: 33, pumpSide: 34, pumpTop: 35, melonSide: 36, melonTop: 37,
  sponge: 38, clay: 39, stoneBrick: 40, bookshelf: 41, mushroom: 42, cactusSide: 43, cactusTop: 44,
  lava: 45, nether: 46, soul: 47, redstone: 48, lapis: 49, emerald: 50, snowGrassSide: 51,
  snowGrassTop: 52, prismarine: 53, endstone: 54, quartz: 55, water: 56,
};

function def(id: number, name: string, top: number, side: number, bottom: number, hardness: number, tool: BlockDef['tool'], color: number, extra: Partial<BlockDef> = {}): BlockDef {
  return { id, name, tiles: { top, side, bottom }, hardness, tool, color, solid: true, transparent: false, drop: id, ...extra };
}

export const BLOCKS: Record<number, BlockDef> = {};
function reg(d: BlockDef) { BLOCKS[d.id] = d; }

reg(def(B.Grass, 'Grass Block', T.grassTop, T.grassSide, T.dirt, 0.6, 'shovel', 0x5fae3f));
reg(def(B.Dirt, 'Dirt', T.dirt, T.dirt, T.dirt, 0.5, 'shovel', 0x8a5a33));
reg(def(B.Stone, 'Stone', T.stone, T.stone, T.stone, 1.5, 'pickaxe', 0x7d7d7d));
reg(def(B.Cobble, 'Cobblestone', T.cobble, T.cobble, T.cobble, 2.0, 'pickaxe', 0x6e6e6e));
reg(def(B.Planks, 'Oak Planks', T.planks, T.planks, T.planks, 2.0, 'axe', 0xb08a4f));
reg(def(B.Log, 'Oak Log', T.logTop, T.logSide, T.logTop, 2.0, 'axe', 0x6b4f2a));
reg(def(B.Leaves, 'Oak Leaves', T.leaves, T.leaves, T.leaves, 0.2, 'none', 0x3d7a26, { transparent: true, drop: 0 }));
reg(def(B.Sand, 'Sand', T.sand, T.sand, T.sand, 0.5, 'shovel', 0xdbd29a));
reg(def(B.Glass, 'Glass', T.glass, T.glass, T.glass, 0.3, 'none', 0xcfeef5, { transparent: true }));
reg(def(B.Brick, 'Bricks', T.brick, T.brick, T.brick, 2.0, 'pickaxe', 0x9a4a3a));
reg(def(B.Bedrock, 'Bedrock', T.bedrock, T.bedrock, T.bedrock, Infinity, 'none', 0x2b2b2b, { drop: 0 }));
reg(def(B.Water, 'Water', T.water, T.water, T.water, Infinity, 'none', 0x2f6fd0, { solid: false, transparent: true, liquid: true, drop: 0 }));
reg(def(B.Snow, 'Snow Block', T.snow, T.snow, T.snow, 0.5, 'shovel', 0xf2f7f7));
reg(def(B.Sandstone, 'Sandstone', T.sandstone, T.sandstone, T.sandstone, 2.0, 'pickaxe', 0xd8cfa8));
reg(def(B.Gravel, 'Gravel', T.gravel, T.gravel, T.gravel, 0.6, 'shovel', 0x8a7f7a));
reg(def(B.CoalOre, 'Coal Ore', T.coal, T.coal, T.coal, 3.0, 'pickaxe', 0x3a3a3a, { xp: 2 }));
reg(def(B.IronOre, 'Iron Ore', T.iron, T.iron, T.iron, 3.0, 'pickaxe', 0xd8a488, { xp: 3 }));
reg(def(B.DiamondOre, 'Diamond Ore', T.diamond, T.diamond, T.diamond, 3.0, 'pickaxe', 0x5fe8e0, { xp: 7 }));
reg(def(B.GoldOre, 'Gold Ore', T.gold, T.gold, T.gold, 3.0, 'pickaxe', 0xf5d13d, { xp: 5 }));
reg(def(B.Glowstone, 'Glowstone', T.glow, T.glow, T.glow, 0.3, 'none', 0xffc94d, { emissive: true }));
reg(def(B.Crafting, 'Crafting Table', T.craftTop, T.craftSide, T.planks, 2.0, 'axe', 0xb08a4f));
reg(def(B.Furnace, 'Furnace', T.furnaceTop, T.furnaceSide, T.furnaceTop, 3.0, 'pickaxe', 0x5a5a5a));
reg(def(B.MossyCobble, 'Mossy Cobblestone', T.mossy, T.mossy, T.mossy, 2.0, 'pickaxe', 0x5f7a4a));
reg(def(B.Ice, 'Ice', T.ice, T.ice, T.ice, 0.5, 'none', 0xa8d8f0, { transparent: true, drop: 0 }));
reg(def(B.Obsidian, 'Obsidian', T.obsidian, T.obsidian, T.obsidian, 9.0, 'pickaxe', 0x2a1a4a));
reg(def(B.TNT, 'TNT', T.tntTop, T.tntSide, T.tntTop, 0.1, 'none', 0xd43a2a));
reg(def(B.WoolWhite, 'White Wool', T.woolW, T.woolW, T.woolW, 0.4, 'none', 0xf0f0f0));
reg(def(B.WoolRed, 'Red Wool', T.woolR, T.woolR, T.woolR, 0.4, 'none', 0xc03028));
reg(def(B.WoolBlue, 'Blue Wool', T.woolB, T.woolB, T.woolB, 0.4, 'none', 0x2a4ac8));
reg(def(B.WoolYellow, 'Yellow Wool', T.woolY, T.woolY, T.woolY, 0.4, 'none', 0xf0d028));
reg(def(B.Pumpkin, 'Pumpkin', T.pumpTop, T.pumpSide, T.pumpTop, 1.0, 'axe', 0xe07a1a));
reg(def(B.Melon, 'Melon', T.melonTop, T.melonSide, T.melonTop, 1.0, 'axe', 0x5aa832));
reg(def(B.Sponge, 'Sponge', T.sponge, T.sponge, T.sponge, 0.6, 'none', 0xe8d83a));
reg(def(B.Clay, 'Clay', T.clay, T.clay, T.clay, 0.6, 'shovel', 0x9aa4b8));
reg(def(B.StoneBrick, 'Stone Bricks', T.stoneBrick, T.stoneBrick, T.stoneBrick, 2.0, 'pickaxe', 0x7a7a7a));
reg(def(B.Bookshelf, 'Bookshelf', T.planks, T.bookshelf, T.planks, 1.5, 'axe', 0x8a5a33));
reg(def(B.Mushroom, 'Mushroom Block', T.mushroom, T.mushroom, T.mushroom, 0.2, 'none', 0xc83a2a, { drop: 0 }));
reg(def(B.Cactus, 'Cactus', T.cactusTop, T.cactusSide, T.cactusTop, 0.4, 'none', 0x3a8a3a, { drop: 0 }));
reg(def(B.Lava, 'Lava', T.lava, T.lava, T.lava, Infinity, 'none', 0xff6a1a, { solid: false, transparent: true, liquid: true, emissive: true, drop: 0 }));
reg(def(B.Netherrack, 'Netherrack', T.nether, T.nether, T.nether, 1.5, 'pickaxe', 0x7a2a22));
reg(def(B.SoulSand, 'Soul Sand', T.soul, T.soul, T.soul, 0.5, 'shovel', 0x4a3428));
reg(def(B.RedstoneOre, 'Redstone Ore', T.redstone, T.redstone, T.redstone, 3.0, 'pickaxe', 0xff2a2a, { xp: 5 }));
reg(def(B.LapisOre, 'Lapis Lazuli Ore', T.lapis, T.lapis, T.lapis, 3.0, 'pickaxe', 0x2a4ac8, { xp: 5 }));
reg(def(B.EmeraldOre, 'Emerald Ore', T.emerald, T.emerald, T.emerald, 3.0, 'pickaxe', 0x2ad84a, { xp: 10 }));
reg(def(B.SnowGrass, 'Snowy Grass', T.snowGrassTop, T.snowGrassSide, T.dirt, 0.6, 'shovel', 0xe8f0f0));
reg(def(B.Prismarine, 'Prismarine', T.prismarine, T.prismarine, T.prismarine, 1.5, 'pickaxe', 0x3aa8a0));
reg(def(B.EndStone, 'End Stone', T.endstone, T.endstone, T.endstone, 3.0, 'pickaxe', 0xd8d88a));
reg(def(B.Quartz, 'Quartz Block', T.quartz, T.quartz, T.quartz, 3.0, 'pickaxe', 0xf0ead8));
reg(def(B.OakStairs, 'Oak Stairs', T.planks, T.planks, T.planks, 2.0, 'axe', 0xb08a4f));

export const PLACEABLE: number[] = [
  B.Grass, B.Dirt, B.Stone, B.Cobble, B.Planks, B.Log, B.Leaves, B.Sand, B.Glass, B.Brick,
  B.Snow, B.Sandstone, B.Gravel, B.Glowstone, B.Crafting, B.Furnace, B.MossyCobble, B.Ice,
  B.Obsidian, B.TNT, B.WoolWhite, B.WoolRed, B.WoolBlue, B.WoolYellow, B.Pumpkin, B.Melon,
  B.Sponge, B.Clay, B.StoneBrick, B.Bookshelf, B.Netherrack, B.SoulSand, B.Prismarine,
  B.EndStone, B.Quartz, B.SnowGrass,
];

export interface ItemDef {
  id: string; name: string; icon: string; // emoji-ish / css
  block?: number; tool?: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
  power: number; // multiplier
  food?: number; // hunger restore
  color: string;
}
export const ITEMS: Record<string, ItemDef> = {
  hand: { id: 'hand', name: 'Hand', icon: '✋', power: 1, color: '#f0c8a0' },
  wood_pick: { id: 'wood_pick', name: 'Wooden Pickaxe', icon: '⛏️', tool: 'pickaxe', power: 2, color: '#b08a4f' },
  stone_pick: { id: 'stone_pick', name: 'Stone Pickaxe', icon: '⛏️', tool: 'pickaxe', power: 4, color: '#9a9a9a' },
  iron_pick: { id: 'iron_pick', name: 'Iron Pickaxe', icon: '⛏️', tool: 'pickaxe', power: 6, color: '#e8e8e8' },
  diamond_pick: { id: 'diamond_pick', name: 'Diamond Pickaxe', icon: '⛏️', tool: 'pickaxe', power: 9, color: '#5fe8e0' },
  wood_axe: { id: 'wood_axe', name: 'Wooden Axe', icon: '🪓', tool: 'axe', power: 2, color: '#b08a4f' },
  stone_axe: { id: 'stone_axe', name: 'Stone Axe', icon: '🪓', tool: 'axe', power: 4, color: '#9a9a9a' },
  iron_axe: { id: 'iron_axe', name: 'Iron Axe', icon: '🪓', tool: 'axe', power: 6, color: '#e8e8e8' },
  diamond_axe: { id: 'diamond_axe', name: 'Diamond Axe', icon: '🪓', tool: 'axe', power: 9, color: '#5fe8e0' },
  wood_shovel: { id: 'wood_shovel', name: 'Wooden Shovel', icon: '🥄', tool: 'shovel', power: 2, color: '#b08a4f' },
  stone_shovel: { id: 'stone_shovel', name: 'Stone Shovel', icon: '🥄', tool: 'shovel', power: 4, color: '#9a9a9a' },
  iron_shovel: { id: 'iron_shovel', name: 'Iron Shovel', icon: '🥄', tool: 'shovel', power: 6, color: '#e8e8e8' },
  diamond_shovel: { id: 'diamond_shovel', name: 'Diamond Shovel', icon: '🥄', tool: 'shovel', power: 9, color: '#5fe8e0' },
  wood_sword: { id: 'wood_sword', name: 'Wooden Sword', icon: '🗡️', tool: 'sword', power: 4, color: '#b08a4f' },
  stone_sword: { id: 'stone_sword', name: 'Stone Sword', icon: '🗡️', tool: 'sword', power: 5, color: '#9a9a9a' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', icon: '🗡️', tool: 'sword', power: 7, color: '#e8e8e8' },
  diamond_sword: { id: 'diamond_sword', name: 'Diamond Sword', icon: '🗡️', tool: 'sword', power: 10, color: '#5fe8e0' },
  stick: { id: 'stick', name: 'Stick', icon: '🥢', power: 1, color: '#8a5a33' },
  coal: { id: 'coal', name: 'Coal', icon: '⚫', power: 1, color: '#222' },
  iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', icon: '⬜', power: 1, color: '#e8c8b0' },
  gold_ingot: { id: 'gold_ingot', name: 'Gold Ingot', icon: '🟨', power: 1, color: '#f5d13d' },
  diamond: { id: 'diamond', name: 'Diamond', icon: '💎', power: 1, color: '#5fe8e0' },
  emerald: { id: 'emerald', name: 'Emerald', icon: '💚', power: 1, color: '#2ad84a' },
  lapis: { id: 'lapis', name: 'Lapis Lazuli', icon: '🔷', power: 1, color: '#2a4ac8' },
  redstone: { id: 'redstone', name: 'Redstone', icon: '🔴', power: 1, color: '#ff2a2a' },
  apple: { id: 'apple', name: 'Apple', icon: '🍎', power: 1, food: 4, color: '#e03028' },
  bread: { id: 'bread', name: 'Bread', icon: '🍞', power: 1, food: 5, color: '#d8a858' },
  porkchop: { id: 'porkchop', name: 'Raw Porkchop', icon: '🥩', power: 1, food: 3, color: '#f0a0a0' },
  cooked_pork: { id: 'cooked_pork', name: 'Cooked Porkchop', icon: '🍖', power: 1, food: 8, color: '#a86838' },
  beef: { id: 'beef', name: 'Raw Beef', icon: '🥩', power: 1, food: 3, color: '#c03030' },
  cooked_beef: { id: 'cooked_beef', name: 'Cooked Beef', icon: '🍖', power: 1, food: 8, color: '#7a3a1a' },
  wool: { id: 'wool', name: 'Wool', icon: '🧶', power: 1, color: '#f0f0f0' },
  leather: { id: 'leather', name: 'Leather', icon: '🟫', power: 1, color: '#a86838' },
  feather: { id: 'feather', name: 'Feather', icon: '🪶', power: 1, color: '#f0f0f0' },
  bone: { id: 'bone', name: 'Bone', icon: '🦴', power: 1, color: '#f0f0f0' },
  arrow: { id: 'arrow', name: 'Arrow', icon: '➶', power: 1, color: '#c8b898' },
  string: { id: 'string', name: 'String', icon: '🧵', power: 1, color: '#e8e8e8' },
  gunpowder: { id: 'gunpowder', name: 'Gunpowder', icon: '💥', power: 1, color: '#555' },
  slime: { id: 'slime', name: 'Slime Ball', icon: '🟢', power: 1, color: '#5ad84a' },
  egg: { id: 'egg', name: 'Egg', icon: '🥚', power: 1, food: 1, color: '#f0ead8' },
  melon_slice: { id: 'melon_slice', name: 'Melon Slice', icon: '🍈', power: 1, food: 2, color: '#5aa832' },
  pumpkin_pie: { id: 'pumpkin_pie', name: 'Pumpkin Pie', icon: '🥧', power: 1, food: 8, color: '#e07a1a' },
  torch_item: { id: 'torch_item', name: 'Torch', icon: '🔥', power: 1, color: '#ffaa2a' },
  bucket: { id: 'bucket', name: 'Bucket', icon: '🪣', power: 1, color: '#9ab8c8' },
  bucket_water: { id: 'bucket_water', name: 'Water Bucket', icon: '🪣', power: 1, color: '#2f6fd0' },
  bucket_lava: { id: 'bucket_lava', name: 'Lava Bucket', icon: '🪣', power: 1, color: '#ff6a1a' },
  bow: { id: 'bow', name: 'Bow', icon: '🏹', power: 1, color: '#8a5a33' },
  shield: { id: 'shield', name: 'Shield', icon: '🛡️', power: 1, color: '#6a4a2a' },
  helmet_iron: { id: 'helmet_iron', name: 'Iron Helmet', icon: '⛑️', power: 1, color: '#e8e8e8' },
  chest_iron: { id: 'chest_iron', name: 'Iron Chestplate', icon: '🦺', power: 1, color: '#e8e8e8' },
  boots_iron: { id: 'boots_iron', name: 'Iron Boots', icon: '🥾', power: 1, color: '#e8e8e8' },
  helmet_diamond: { id: 'helmet_diamond', name: 'Diamond Helmet', icon: '⛑️', power: 1, color: '#5fe8e0' },
  chest_diamond: { id: 'chest_diamond', name: 'Diamond Chestplate', icon: '🦺', power: 1, color: '#5fe8e0' },
  boots_diamond: { id: 'boots_diamond', name: 'Diamond Boots', icon: '🥾', power: 1, color: '#5fe8e0' },
  enchant_book: { id: 'enchant_book', name: 'Enchanted Book', icon: '📖', power: 1, color: '#a84ad8' },
  netherite_ingot: { id: 'netherite_ingot', name: 'Netherite Ingot', icon: '⬛', power: 1, color: '#3a2a3a' },
  quartz: { id: 'quartz', name: 'Nether Quartz', icon: '⬜', power: 1, color: '#f0ead8' },
  blaze_powder: { id: 'blaze_powder', name: 'Blaze Powder', icon: '✨', power: 1, color: '#ffcc2a' },
  ender_pearl: { id: 'ender_pearl', name: 'Ender Pearl', icon: '🟣', power: 1, color: '#a84ad8' },
  ghast_tear: { id: 'ghast_tear', name: 'Ghast Tear', icon: '💧', power: 1, color: '#e8e8f0' },
  magma_cream: { id: 'magma_cream', name: 'Magma Cream', icon: '🟠', power: 1, color: '#ff6a1a' },
  phantom_membrane: { id: 'phantom_membrane', name: 'Phantom Membrane', icon: '🪽', power: 1, color: '#c8b8e8' },
  totem: { id: 'totem', name: 'Totem of Undying', icon: '🗿', power: 1, color: '#d8a858' },
  trident: { id: 'trident', name: 'Trident', icon: '🔱', power: 1, color: '#5fe8e0' },
  crossbow: { id: 'crossbow', name: 'Crossbow', icon: '🏹', power: 1, color: '#6a4a2a' },
  flint: { id: 'flint', name: 'Flint', icon: '🪨', power: 1, color: '#555' },
  clay_ball: { id: 'clay_ball', name: 'Clay Ball', icon: '⚪', power: 1, color: '#9aa4b8' },
  brick_item: { id: 'brick_item', name: 'Brick', icon: '🧱', power: 1, color: '#9a4a3a' },
  paper: { id: 'paper', name: 'Paper', icon: '📄', power: 1, color: '#f0f0f0' },
  book: { id: 'book', name: 'Book', icon: '📕', power: 1, color: '#a03028' },
  sugar: { id: 'sugar', name: 'Sugar', icon: '🍬', power: 1, color: '#f0f0f0' },
  honey: { id: 'honey', name: 'Honey Bottle', icon: '🍯', power: 1, food: 6, color: '#f0b028' },
  cookie: { id: 'cookie', name: 'Cookie', icon: '🍪', power: 1, food: 2, color: '#a86838' },
  cake: { id: 'cake', name: 'Cake', icon: '🍰', power: 1, food: 14, color: '#f0a8c8' },
  stew: { id: 'stew', name: 'Mushroom Stew', icon: '🍲', power: 1, food: 10, color: '#c83a2a' },
  golden_apple: { id: 'golden_apple', name: 'Golden Apple', icon: '🍏', power: 1, food: 4, color: '#f5d13d' },
  golden_carrot: { id: 'golden_carrot', name: 'Golden Carrot', icon: '🥕', power: 1, food: 6, color: '#f5d13d' },
  carrot: { id: 'carrot', name: 'Carrot', icon: '🥕', power: 1, food: 3, color: '#e07a1a' },
  potato: { id: 'potato', name: 'Potato', icon: '🥔', power: 1, food: 2, color: '#c8a858' },
  baked_potato: { id: 'baked_potato', name: 'Baked Potato', icon: '🥔', power: 1, food: 5, color: '#8a6a38' },
  beetroot: { id: 'beetroot', name: 'Beetroot', icon: '🫐', power: 1, food: 1, color: '#a03048' },
  berries: { id: 'berries', name: 'Sweet Berries', icon: '🫐', power: 1, food: 2, color: '#4a2a8a' },
  kelp: { id: 'kelp', name: 'Kelp', icon: '🌿', power: 1, food: 1, color: '#3a8a3a' },
  dried_kelp: { id: 'dried_kelp', name: 'Dried Kelp', icon: '🌿', power: 1, food: 1, color: '#6a8a3a' },
  pufferfish: { id: 'pufferfish', name: 'Pufferfish', icon: '🐡', power: 1, food: 1, color: '#d8c858' },
  tropical_fish: { id: 'tropical_fish', name: 'Tropical Fish', icon: '🐠', power: 1, food: 2, color: '#e07a3a' },
  salmon: { id: 'salmon', name: 'Raw Salmon', icon: '🐟', power: 1, food: 2, color: '#f08a6a' },
  cooked_salmon: { id: 'cooked_salmon', name: 'Cooked Salmon', icon: '🐟', power: 1, food: 6, color: '#c85a3a' },
  cod: { id: 'cod', name: 'Raw Cod', icon: '🐟', power: 1, food: 2, color: '#c8c8c8' },
  cooked_cod: { id: 'cooked_cod', name: 'Cooked Cod', icon: '🐟', power: 1, food: 5, color: '#a8a8a8' },
  rabbit: { id: 'rabbit', name: 'Raw Rabbit', icon: '🐰', power: 1, food: 3, color: '#f0a0a0' },
  cooked_rabbit: { id: 'cooked_rabbit', name: 'Cooked Rabbit', icon: '🍖', power: 1, food: 5, color: '#a86838' },
  mutton: { id: 'mutton', name: 'Raw Mutton', icon: '🥩', power: 1, food: 2, color: '#f0a0a0' },
  cooked_mutton: { id: 'cooked_mutton', name: 'Cooked Mutton', icon: '🍖', power: 1, food: 6, color: '#a86838' },
  chicken: { id: 'chicken', name: 'Raw Chicken', icon: '🍗', power: 1, food: 2, color: '#f0d8c8' },
  cooked_chicken: { id: 'cooked_chicken', name: 'Cooked Chicken', icon: '🍗', power: 1, food: 5, color: '#c88a48' },
  rotten_flesh: { id: 'rotten_flesh', name: 'Rotten Flesh', icon: '🍖', power: 1, food: 4, color: '#6a8a3a' },
  spider_eye: { id: 'spider_eye', name: 'Spider Eye', icon: '👁️', power: 1, food: 2, color: '#4a2a4a' },
  fermented_spider_eye: { id: 'fermented_spider_eye', name: 'Fermented Spider Eye', icon: '👁️', power: 1, food: 2, color: '#6a4a6a' },
  mushroom_item: { id: 'mushroom_item', name: 'Mushroom', icon: '🍄', power: 1, food: 1, color: '#c83a2a' },
  brown_mushroom: { id: 'brown_mushroom', name: 'Brown Mushroom', icon: '🍄', power: 1, food: 1, color: '#a86838' },
  red_mushroom: { id: 'red_mushroom', name: 'Red Mushroom', icon: '🍄', power: 1, food: 1, color: '#e03028' },
  wheat: { id: 'wheat', name: 'Wheat', icon: '🌾', power: 1, color: '#d8c858' },
  seeds: { id: 'seeds', name: 'Wheat Seeds', icon: '🌱', power: 1, color: '#8a9a3a' },
  beetroot_seeds: { id: 'beetroot_seeds', name: 'Beetroot Seeds', icon: '🌱', power: 1, color: '#a03048' },
  melon_seeds: { id: 'melon_seeds', name: 'Melon Seeds', icon: '🌱', power: 1, color: '#3a3a2a' },
  pumpkin_seeds: { id: 'pumpkin_seeds', name: 'Pumpkin Seeds', icon: '🌱', power: 1, color: '#e07a1a' },
  cocoa_beans: { id: 'cocoa_beans', name: 'Cocoa Beans', icon: '🫘', power: 1, color: '#6a3a1a' },
  nether_wart: { id: 'nether_wart', name: 'Nether Wart', icon: '🌿', power: 1, color: '#a03048' },
  chorus_fruit: { id: 'chorus_fruit', name: 'Chorus Fruit', icon: '🟣', power: 1, food: 4, color: '#a84ad8' },
  popped_chorus: { id: 'popped_chorus', name: 'Popped Chorus Fruit', icon: '🟣', power: 1, food: 5, color: '#c8a8e8' },
  golden_berries: { id: 'golden_berries', name: 'Glow Berries', icon: '✨', power: 1, food: 2, color: '#f5d13d' },
  honeycomb: { id: 'honeycomb', name: 'Honeycomb', icon: '🍯', power: 1, color: '#f0b028' },
  scute: { id: 'scute', name: 'Turtle Scute', icon: '🐢', power: 1, color: '#6a8a5a' },
  turtle_helmet: { id: 'turtle_helmet', name: 'Turtle Helmet', icon: '⛑️', power: 1, color: '#6a8a5a' },
  elytra: { id: 'elytra', name: 'Elytra', icon: '🪽', power: 1, color: '#c8b8e8' },
  totem2: { id: 'totem2', name: 'Totem', icon: '🗿', power: 1, color: '#d8a858' },
  name_tag: { id: 'name_tag', name: 'Name Tag', icon: '🏷️', power: 1, color: '#e8e8e8' },
  lead: { id: 'lead', name: 'Lead', icon: '🪢', power: 1, color: '#a8a8a8' },
  saddle: { id: 'saddle', name: 'Saddle', icon: '🐴', power: 1, color: '#6a4a2a' },
  horse_armor_iron: { id: 'horse_armor_iron', name: 'Iron Horse Armor', icon: '🐴', power: 1, color: '#e8e8e8' },
  horse_armor_diamond: { id: 'horse_armor_diamond', name: 'Diamond Horse Armor', icon: '🐴', power: 1, color: '#5fe8e0' },
  wolf_armor: { id: 'wolf_armor', name: 'Wolf Armor', icon: '🐺', power: 1, color: '#c03028' },
  banner_white: { id: 'banner_white', name: 'White Banner', icon: '🚩', power: 1, color: '#f0f0f0' },
  banner_black: { id: 'banner_black', name: 'Black Banner', icon: '🚩', power: 1, color: '#222' },
  banner_red: { id: 'banner_red', name: 'Red Banner', icon: '🚩', power: 1, color: '#c03028' },
  banner_blue: { id: 'banner_blue', name: 'Blue Banner', icon: '🚩', power: 1, color: '#2a4ac8' },
  banner_yellow: { id: 'banner_yellow', name: 'Yellow Banner', icon: '🚩', power: 1, color: '#f0d028' },
  banner_green: { id: 'banner_green', name: 'Green Banner', icon: '🚩', power: 1, color: '#3a8a3a' },
  banner_orange: { id: 'banner_orange', name: 'Orange Banner', icon: '🚩', power: 1, color: '#e07a1a' },
  banner_purple: { id: 'banner_purple', name: 'Purple Banner', icon: '🚩', power: 1, color: '#7a3ac8' },
  banner_pink: { id: 'banner_pink', name: 'Pink Banner', icon: '🚩', power: 1, color: '#f08ac8' },
  banner_cyan: { id: 'banner_cyan', name: 'Cyan Banner', icon: '🚩', power: 1, color: '#2ac8c8' },
  banner_lime: { id: 'banner_lime', name: 'Lime Banner', icon: '🚩', power: 1, color: '#8ad82a' },
  banner_brown: { id: 'banner_brown', name: 'Brown Banner', icon: '🚩', power: 1, color: '#6a4a2a' },
  banner_gray: { id: 'banner_gray', name: 'Gray Banner', icon: '🚩', power: 1, color: '#8a8a8a' },
  banner_light_gray: { id: 'banner_light_gray', name: 'Light Gray Banner', icon: '🚩', power: 1, color: '#c8c8c8' },
  banner_magenta: { id: 'banner_magenta', name: 'Magenta Banner', icon: '🚩', power: 1, color: '#c82ac8' },
  banner_light_blue: { id: 'banner_light_blue', name: 'Light Blue Banner', icon: '🚩', power: 1, color: '#6ac8f0' },
};

export interface Recipe {
  id: string; output: string; count: number;
  inputs: Record<string, number>; // item/block id -> count ; block ids prefixed b:
  shapeless?: boolean;
}
export const RECIPES: Recipe[] = [
  { id: 'planks', output: 'b5', count: 4, inputs: { b6: 1 } },
  { id: 'stick', output: 'stick', count: 4, inputs: { b5: 2 } },
  { id: 'torch', output: 'torch_item', count: 4, inputs: { coal: 1, stick: 1 } },
  { id: 'crafting', output: 'b21', count: 1, inputs: { b5: 4 } },
  { id: 'furnace', output: 'b22', count: 1, inputs: { b3: 8 } },
  { id: 'glass', output: 'b9', count: 1, inputs: { b8: 1 } },
  { id: 'brick', output: 'b10', count: 1, inputs: { brick_item: 4 } },
  { id: 'stonebrick', output: 'b35', count: 4, inputs: { b3: 4 } },
  { id: 'sandstone', output: 'b14', count: 1, inputs: { b8: 4 } },
  { id: 'bookshelf', output: 'b36', count: 1, inputs: { b5: 6, book: 3 } },
  { id: 'tnt', output: 'b26', count: 1, inputs: { gunpowder: 5, b8: 4 } },
  { id: 'glowstone', output: 'b20', count: 1, inputs: { blaze_powder: 4 } },
  { id: 'obsidian', output: 'b25', count: 1, inputs: { b3: 4, b40: 4 } },
  { id: 'woolw', output: 'b27', count: 1, inputs: { wool: 1 } },
  { id: 'woolr', output: 'b28', count: 1, inputs: { wool: 1, redstone: 1 } },
  { id: 'woolb', output: 'b29', count: 1, inputs: { wool: 1, lapis: 1 } },
  { id: 'wooly', output: 'b30', count: 1, inputs: { wool: 1, b31: 1 } },
  { id: 'sponge', output: 'b33', count: 1, inputs: { b8: 4, b34: 1 } },
  { id: 'clay', output: 'b34', count: 4, inputs: { clay_ball: 4 } },
  { id: 'prismarine', output: 'b46', count: 1, inputs: { b8: 4, b17: 1 } },
  { id: 'quartz', output: 'b48', count: 1, inputs: { quartz: 4 } },
  { id: 'wood_pick', output: 'wood_pick', count: 1, inputs: { b5: 3, stick: 2 } },
  { id: 'stone_pick', output: 'stone_pick', count: 1, inputs: { b4: 3, stick: 2 } },
  { id: 'iron_pick', output: 'iron_pick', count: 1, inputs: { iron_ingot: 3, stick: 2 } },
  { id: 'diamond_pick', output: 'diamond_pick', count: 1, inputs: { diamond: 3, stick: 2 } },
  { id: 'wood_axe', output: 'wood_axe', count: 1, inputs: { b5: 3, stick: 2 } },
  { id: 'stone_axe', output: 'stone_axe', count: 1, inputs: { b4: 3, stick: 2 } },
  { id: 'iron_axe', output: 'iron_axe', count: 1, inputs: { iron_ingot: 3, stick: 2 } },
  { id: 'diamond_axe', output: 'diamond_axe', count: 1, inputs: { diamond: 3, stick: 2 } },
  { id: 'wood_shovel', output: 'wood_shovel', count: 1, inputs: { b5: 1, stick: 2 } },
  { id: 'stone_shovel', output: 'stone_shovel', count: 1, inputs: { b4: 1, stick: 2 } },
  { id: 'iron_shovel', output: 'iron_shovel', count: 1, inputs: { iron_ingot: 1, stick: 2 } },
  { id: 'diamond_shovel', output: 'diamond_shovel', count: 1, inputs: { diamond: 1, stick: 2 } },
  { id: 'wood_sword', output: 'wood_sword', count: 1, inputs: { b5: 2, stick: 1 } },
  { id: 'stone_sword', output: 'stone_sword', count: 1, inputs: { b4: 2, stick: 1 } },
  { id: 'iron_sword', output: 'iron_sword', count: 1, inputs: { iron_ingot: 2, stick: 1 } },
  { id: 'diamond_sword', output: 'diamond_sword', count: 1, inputs: { diamond: 2, stick: 1 } },
  { id: 'bucket', output: 'bucket', count: 1, inputs: { iron_ingot: 3 } },
  { id: 'bow', output: 'bow', count: 1, inputs: { stick: 3, string: 3 } },
  { id: 'arrow', output: 'arrow', count: 4, inputs: { flint: 1, stick: 1, feather: 1 } },
  { id: 'shield', output: 'shield', count: 1, inputs: { b5: 6, iron_ingot: 1 } },
  { id: 'helmet_iron', output: 'helmet_iron', count: 1, inputs: { iron_ingot: 5 } },
  { id: 'chest_iron', output: 'chest_iron', count: 1, inputs: { iron_ingot: 8 } },
  { id: 'boots_iron', output: 'boots_iron', count: 1, inputs: { iron_ingot: 4 } },
  { id: 'helmet_diamond', output: 'helmet_diamond', count: 1, inputs: { diamond: 5 } },
  { id: 'chest_diamond', output: 'chest_diamond', count: 1, inputs: { diamond: 8 } },
  { id: 'boots_diamond', output: 'boots_diamond', count: 1, inputs: { diamond: 4 } },
  { id: 'bread', output: 'bread', count: 1, inputs: { wheat: 3 } },
  { id: 'cookie', output: 'cookie', count: 8, inputs: { wheat: 2, cocoa_beans: 1 } },
  { id: 'cake', output: 'cake', count: 1, inputs: { wheat: 3, sugar: 2, egg: 1 } },
  { id: 'pumpkin_pie', output: 'pumpkin_pie', count: 1, inputs: { b31: 1, sugar: 1, egg: 1 } },
  { id: 'golden_apple', output: 'golden_apple', count: 1, inputs: { apple: 1, gold_ingot: 8 } },
  { id: 'golden_carrot', output: 'golden_carrot', count: 1, inputs: { carrot: 1, gold_ingot: 8 } },
  { id: 'paper', output: 'paper', count: 3, inputs: { b8: 3 } },
  { id: 'book', output: 'book', count: 1, inputs: { paper: 3, leather: 1 } },
  { id: 'enchant_book', output: 'enchant_book', count: 1, inputs: { book: 1, diamond: 2, lapis: 3 } },
  { id: 'netherite', output: 'netherite_ingot', count: 1, inputs: { iron_ingot: 4, diamond: 1 } },
  { id: 'totem', output: 'totem', count: 1, inputs: { emerald: 8, gold_ingot: 1 } },
  { id: 'elytra', output: 'elytra', count: 1, inputs: { phantom_membrane: 6, netherite_ingot: 2 } },
  { id: 'trident', output: 'trident', count: 1, inputs: { diamond: 3, stick: 2, prismarine: 1 } },
  { id: 'crossbow', output: 'crossbow', count: 1, inputs: { stick: 3, string: 3, iron_ingot: 1 } },
  { id: 'lead', output: 'lead', count: 2, inputs: { string: 4, slime: 1 } },
  { id: 'saddle', output: 'saddle', count: 1, inputs: { leather: 3, iron_ingot: 2 } },
  { id: 'name_tag', output: 'name_tag', count: 1, inputs: { paper: 1, string: 1 } },
  { id: 'turtle_helmet', output: 'turtle_helmet', count: 1, inputs: { scute: 5 } },
  { id: 'honey', output: 'honey', count: 1, inputs: { honeycomb: 4, b9: 1 } },
  { id: 'stew', output: 'stew', count: 1, inputs: { brown_mushroom: 1, red_mushroom: 1, b5: 1 } },
  { id: 'fermented_eye', output: 'fermented_spider_eye', count: 1, inputs: { spider_eye: 1, mushroom_item: 1, sugar: 1 } },
  { id: 'magma_cream', output: 'magma_cream', count: 1, inputs: { blaze_powder: 1, slime: 1 } },
  { id: 'ender_pearl', output: 'ender_pearl', count: 1, inputs: { blaze_powder: 1, ghast_tear: 1 } },
  { id: 'ghast_tear', output: 'ghast_tear', count: 1, inputs: { b40: 1, b41: 1 } },
  { id: 'baked_potato', output: 'baked_potato', count: 1, inputs: { potato: 1 } },
  { id: 'cooked_pork', output: 'cooked_pork', count: 1, inputs: { porkchop: 1 } },
  { id: 'cooked_beef', output: 'cooked_beef', count: 1, inputs: { beef: 1 } },
  { id: 'cooked_chicken', output: 'cooked_chicken', count: 1, inputs: { chicken: 1 } },
  { id: 'cooked_mutton', output: 'cooked_mutton', count: 1, inputs: { mutton: 1 } },
  { id: 'cooked_rabbit', output: 'cooked_rabbit', count: 1, inputs: { rabbit: 1 } },
  { id: 'cooked_salmon', output: 'cooked_salmon', count: 1, inputs: { salmon: 1 } },
  { id: 'cooked_cod', output: 'cooked_cod', count: 1, inputs: { cod: 1 } },
  { id: 'dried_kelp', output: 'dried_kelp', count: 1, inputs: { kelp: 1 } },
  { id: 'sugar', output: 'sugar', count: 1, inputs: { b8: 1 } },
  { id: 'brick_item', output: 'brick_item', count: 4, inputs: { b34: 1 } },
  { id: 'clay_ball', output: 'clay_ball', count: 4, inputs: { b34: 1 } },
  { id: 'flint', output: 'flint', count: 1, inputs: { b15: 1 } },
  { id: 'bone_meal', output: 'bone', count: 1, inputs: { bone: 1 } },
];

export function blockName(id: number) { return BLOCKS[id]?.name ?? 'Unknown'; }
export function isSolid(id: number) { return !!BLOCKS[id]?.solid; }
export function isTransparent(id: number) { return id === 0 || !!BLOCKS[id]?.transparent; }
