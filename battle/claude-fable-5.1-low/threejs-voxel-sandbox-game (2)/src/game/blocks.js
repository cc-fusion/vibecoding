// Block and item registry. Blocks are ids < 100, items >= 100.
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6, LOG: 7, LEAVES: 8, PLANKS: 9,
  BEDROCK: 10, COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14, GRAVEL: 15, SNOW: 16,
  CACTUS: 17, GLASS: 18, CRAFTING_TABLE: 19, TORCH: 20, FURNACE: 21, BRICKS: 22, STONE_BRICKS: 23,
  TALL_GRASS: 24, FLOWER_RED: 25, FLOWER_YELLOW: 26, BIRCH_LOG: 27, BIRCH_LEAVES: 28, CLAY: 29,
  ICE: 30, GLOWSTONE: 31, SANDSTONE: 32, SPRUCE_LOG: 33, SPRUCE_LEAVES: 34, SNOW_GRASS: 35,
  DEAD_BUSH: 36, MUSHROOM: 37, WOOL: 38, LAVA: 39, OBSIDIAN: 40, BOOKSHELF: 41, MOSSY_COBBLE: 42,
  PUMPKIN: 43, JACK_O_LANTERN: 44, FENCE: 45, LADDER: 46,
};
export const I = {
  STICK: 100, WOOD_PICKAXE: 101, STONE_PICKAXE: 102, IRON_PICKAXE: 103, DIAMOND_PICKAXE: 104,
  WOOD_SWORD: 105, STONE_SWORD: 106, IRON_SWORD: 107, DIAMOND_SWORD: 108,
  WOOD_AXE: 109, STONE_AXE: 110, IRON_AXE: 111, WOOD_SHOVEL: 112, STONE_SHOVEL: 113, IRON_SHOVEL: 114,
  COAL: 115, IRON_INGOT: 116, GOLD_INGOT: 117, DIAMOND: 118, PORKCHOP_RAW: 119, PORKCHOP_COOKED: 120,
  APPLE: 121, MUTTON_RAW: 122, MUTTON_COOKED: 123, ROTTEN_FLESH: 124, BRICK: 125, FEATHER: 126,
  CHICKEN_RAW: 127, CHICKEN_COOKED: 128, DIAMOND_AXE: 129, DIAMOND_SHOVEL: 130, BREAD: 131, WHEAT: 132,
};

// shape: 'cube' | 'cross' | 'none'; tex: [top, side, bottom] tile names or single name
// hard: seconds to break by hand; tool: 'pickaxe'|'axe'|'shovel'|null; minTier: 0 none,1 wood,2 stone,3 iron
// drop: item id or function; light: emitted light 0-15; solid: collision; opaque: light blocking / face culling
const def = (name, o) => ({
  name, shape: 'cube', hard: 1, tool: null, minTier: 0, drop: undefined, light: 0, solid: true, opaque: true,
  transparent: false, liquid: false, stack: 64, ...o,
});

export const BLOCKS = {};
BLOCKS[B.AIR] = def('Air', { shape: 'none', solid: false, opaque: false });
BLOCKS[B.GRASS] = def('Grass Block', { tex: ['grass_top', 'grass_side', 'dirt'], hard: 0.9, tool: 'shovel', drop: B.DIRT });
BLOCKS[B.DIRT] = def('Dirt', { tex: 'dirt', hard: 0.75, tool: 'shovel' });
BLOCKS[B.STONE] = def('Stone', { tex: 'stone', hard: 2.2, tool: 'pickaxe', minTier: 1, drop: B.COBBLE });
BLOCKS[B.COBBLE] = def('Cobblestone', { tex: 'cobble', hard: 2.5, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.SAND] = def('Sand', { tex: 'sand', hard: 0.75, tool: 'shovel' });
BLOCKS[B.WATER] = def('Water', { tex: 'water', solid: false, opaque: false, transparent: true, liquid: true, hard: Infinity });
BLOCKS[B.LOG] = def('Oak Log', { tex: ['log_top', 'log_side', 'log_top'], hard: 2.5, tool: 'axe' });
BLOCKS[B.LEAVES] = def('Oak Leaves', { tex: 'leaves', hard: 0.3, opaque: false, transparent: true, drop: null, tint: [0.45, 0.78, 0.3] });
BLOCKS[B.PLANKS] = def('Oak Planks', { tex: 'planks', hard: 2.2, tool: 'axe' });
BLOCKS[B.BEDROCK] = def('Bedrock', { tex: 'bedrock', hard: Infinity });
BLOCKS[B.COAL_ORE] = def('Coal Ore', { tex: 'coal_ore', hard: 3.2, tool: 'pickaxe', minTier: 1, drop: I.COAL });
BLOCKS[B.IRON_ORE] = def('Iron Ore', { tex: 'iron_ore', hard: 3.4, tool: 'pickaxe', minTier: 2 });
BLOCKS[B.GOLD_ORE] = def('Gold Ore', { tex: 'gold_ore', hard: 3.4, tool: 'pickaxe', minTier: 3 });
BLOCKS[B.DIAMOND_ORE] = def('Diamond Ore', { tex: 'diamond_ore', hard: 3.6, tool: 'pickaxe', minTier: 3, drop: I.DIAMOND });
BLOCKS[B.GRAVEL] = def('Gravel', { tex: 'gravel', hard: 0.9, tool: 'shovel' });
BLOCKS[B.SNOW] = def('Snow Block', { tex: 'snow', hard: 0.5, tool: 'shovel' });
BLOCKS[B.CACTUS] = def('Cactus', { tex: ['cactus_top', 'cactus_side', 'cactus_top'], hard: 0.6, damage: 1 });
BLOCKS[B.GLASS] = def('Glass', { tex: 'glass', hard: 0.5, opaque: false, transparent: true, drop: null });
BLOCKS[B.CRAFTING_TABLE] = def('Crafting Table', { tex: ['table_top', 'table_side', 'planks'], hard: 2.5, tool: 'axe' });
BLOCKS[B.TORCH] = def('Torch', { tex: 'torch', shape: 'cross', hard: 0.1, solid: false, opaque: false, light: 14 });
BLOCKS[B.FURNACE] = def('Furnace', { tex: ['furnace_top', 'furnace_side', 'furnace_top'], hard: 3.5, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.BRICKS] = def('Bricks', { tex: 'bricks', hard: 2.5, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.STONE_BRICKS] = def('Stone Bricks', { tex: 'stone_bricks', hard: 2.5, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.TALL_GRASS] = def('Tall Grass', { tex: 'tall_grass', shape: 'cross', hard: 0.05, solid: false, opaque: false, drop: null, tint: [0.45, 0.78, 0.3] });
BLOCKS[B.FLOWER_RED] = def('Poppy', { tex: 'flower_red', shape: 'cross', hard: 0.05, solid: false, opaque: false });
BLOCKS[B.FLOWER_YELLOW] = def('Dandelion', { tex: 'flower_yellow', shape: 'cross', hard: 0.05, solid: false, opaque: false });
BLOCKS[B.BIRCH_LOG] = def('Birch Log', { tex: ['birch_top', 'birch_side', 'birch_top'], hard: 2.5, tool: 'axe' });
BLOCKS[B.BIRCH_LEAVES] = def('Birch Leaves', { tex: 'leaves', hard: 0.3, opaque: false, transparent: true, drop: null, tint: [0.55, 0.8, 0.35] });
BLOCKS[B.CLAY] = def('Clay', { tex: 'clay', hard: 0.8, tool: 'shovel' });
BLOCKS[B.ICE] = def('Ice', { tex: 'ice', hard: 0.6, tool: 'pickaxe', opaque: false, transparent: true, drop: null, slippery: true });
BLOCKS[B.GLOWSTONE] = def('Glowstone', { tex: 'glowstone', hard: 0.5, light: 15 });
BLOCKS[B.SANDSTONE] = def('Sandstone', { tex: ['sandstone_top', 'sandstone_side', 'sandstone_top'], hard: 1.2, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.SPRUCE_LOG] = def('Spruce Log', { tex: ['spruce_top', 'spruce_side', 'spruce_top'], hard: 2.5, tool: 'axe' });
BLOCKS[B.SPRUCE_LEAVES] = def('Spruce Leaves', { tex: 'leaves', hard: 0.3, opaque: false, transparent: true, drop: null, tint: [0.3, 0.55, 0.3] });
BLOCKS[B.SNOW_GRASS] = def('Snowy Grass', { tex: ['snow', 'snow_grass_side', 'dirt'], hard: 0.9, tool: 'shovel', drop: B.DIRT });
BLOCKS[B.DEAD_BUSH] = def('Dead Bush', { tex: 'dead_bush', shape: 'cross', hard: 0.05, solid: false, opaque: false, drop: I.STICK });
BLOCKS[B.MUSHROOM] = def('Mushroom', { tex: 'mushroom', shape: 'cross', hard: 0.05, solid: false, opaque: false, food: 2 });
BLOCKS[B.WOOL] = def('Wool', { tex: 'wool', hard: 1.0 });
BLOCKS[B.LAVA] = def('Lava', { tex: 'lava', solid: false, opaque: false, transparent: true, liquid: true, hard: Infinity, light: 15, damage: 4 });
BLOCKS[B.OBSIDIAN] = def('Obsidian', { tex: 'obsidian', hard: 12, tool: 'pickaxe', minTier: 4 });
BLOCKS[B.BOOKSHELF] = def('Bookshelf', { tex: ['planks', 'bookshelf', 'planks'], hard: 2, tool: 'axe' });
BLOCKS[B.MOSSY_COBBLE] = def('Mossy Cobblestone', { tex: 'mossy_cobble', hard: 2.5, tool: 'pickaxe', minTier: 1 });
BLOCKS[B.PUMPKIN] = def('Pumpkin', { tex: ['pumpkin_top', 'pumpkin_side', 'pumpkin_top'], hard: 1.2, tool: 'axe' });
BLOCKS[B.JACK_O_LANTERN] = def("Jack o'Lantern", { tex: ['pumpkin_top', 'pumpkin_face', 'pumpkin_top'], hard: 1.2, tool: 'axe', light: 15 });
BLOCKS[B.FENCE] = def('Fence', { tex: 'fence', shape: 'cross', hard: 2, tool: 'axe', solid: true, opaque: false });
BLOCKS[B.LADDER] = def('Ladder', { tex: 'ladder', shape: 'cross', hard: 0.6, tool: 'axe', solid: false, opaque: false, climbable: true });

const item = (name, o) => ({ name, stack: 64, ...o });
export const ITEMS = {};
ITEMS[I.STICK] = item('Stick', { icon: 'stick' });
const tool = (name, type, tier, dur, speed, dmg, icon) => item(name, { icon, tool: type, tier, stack: 1, durability: dur, speed, damage: dmg });
ITEMS[I.WOOD_PICKAXE] = tool('Wooden Pickaxe', 'pickaxe', 1, 60, 2, 2, 'pick_wood');
ITEMS[I.STONE_PICKAXE] = tool('Stone Pickaxe', 'pickaxe', 2, 132, 4, 3, 'pick_stone');
ITEMS[I.IRON_PICKAXE] = tool('Iron Pickaxe', 'pickaxe', 3, 251, 6, 4, 'pick_iron');
ITEMS[I.DIAMOND_PICKAXE] = tool('Diamond Pickaxe', 'pickaxe', 4, 1562, 8, 5, 'pick_diamond');
ITEMS[I.WOOD_SWORD] = tool('Wooden Sword', 'sword', 1, 60, 1, 4, 'sword_wood');
ITEMS[I.STONE_SWORD] = tool('Stone Sword', 'sword', 2, 132, 1, 5, 'sword_stone');
ITEMS[I.IRON_SWORD] = tool('Iron Sword', 'sword', 3, 251, 1, 6, 'sword_iron');
ITEMS[I.DIAMOND_SWORD] = tool('Diamond Sword', 'sword', 4, 1562, 1, 7, 'sword_diamond');
ITEMS[I.WOOD_AXE] = tool('Wooden Axe', 'axe', 1, 60, 2, 3, 'axe_wood');
ITEMS[I.STONE_AXE] = tool('Stone Axe', 'axe', 2, 132, 4, 4, 'axe_stone');
ITEMS[I.IRON_AXE] = tool('Iron Axe', 'axe', 3, 251, 6, 5, 'axe_iron');
ITEMS[I.DIAMOND_AXE] = tool('Diamond Axe', 'axe', 4, 1562, 8, 6, 'axe_diamond');
ITEMS[I.WOOD_SHOVEL] = tool('Wooden Shovel', 'shovel', 1, 60, 2, 2, 'shovel_wood');
ITEMS[I.STONE_SHOVEL] = tool('Stone Shovel', 'shovel', 2, 132, 4, 3, 'shovel_stone');
ITEMS[I.IRON_SHOVEL] = tool('Iron Shovel', 'shovel', 3, 251, 6, 4, 'shovel_iron');
ITEMS[I.DIAMOND_SHOVEL] = tool('Diamond Shovel', 'shovel', 4, 1562, 8, 5, 'shovel_diamond');
ITEMS[I.COAL] = item('Coal', { icon: 'coal' });
ITEMS[I.IRON_INGOT] = item('Iron Ingot', { icon: 'ingot_iron' });
ITEMS[I.GOLD_INGOT] = item('Gold Ingot', { icon: 'ingot_gold' });
ITEMS[I.DIAMOND] = item('Diamond', { icon: 'diamond' });
ITEMS[I.PORKCHOP_RAW] = item('Raw Porkchop', { icon: 'pork_raw', food: 3 });
ITEMS[I.PORKCHOP_COOKED] = item('Cooked Porkchop', { icon: 'pork_cooked', food: 8 });
ITEMS[I.APPLE] = item('Apple', { icon: 'apple', food: 4 });
ITEMS[I.MUTTON_RAW] = item('Raw Mutton', { icon: 'mutton_raw', food: 2 });
ITEMS[I.MUTTON_COOKED] = item('Cooked Mutton', { icon: 'mutton_cooked', food: 6 });
ITEMS[I.ROTTEN_FLESH] = item('Rotten Flesh', { icon: 'rotten', food: 1 });
ITEMS[I.BRICK] = item('Brick', { icon: 'brick' });
ITEMS[I.FEATHER] = item('Feather', { icon: 'feather' });
ITEMS[I.CHICKEN_RAW] = item('Raw Chicken', { icon: 'chicken_raw', food: 2 });
ITEMS[I.CHICKEN_COOKED] = item('Cooked Chicken', { icon: 'chicken_cooked', food: 6 });
ITEMS[I.BREAD] = item('Bread', { icon: 'bread', food: 5 });
ITEMS[I.WHEAT] = item('Wheat', { icon: 'wheat' });

export function isBlock(id) { return id > 0 && id < 100; }
export function getDef(id) { return id < 100 ? BLOCKS[id] : ITEMS[id]; }
export function nameOf(id) { const d = getDef(id); return d ? d.name : '?'; }
export function maxStack(id) { const d = getDef(id); return d ? d.stack : 64; }
export function isOpaque(id) { const d = BLOCKS[id]; return d ? d.opaque : false; }
export function isSolid(id) { const d = BLOCKS[id]; return d ? d.solid : false; }
export function blockDrop(id, rng) {
  const d = BLOCKS[id];
  if (!d) return null;
  if (d.drop === null) {
    // leaves have a chance to drop apples / sticks
    if (id === B.LEAVES && rng() < 0.05) return I.APPLE;
    if ((id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES) && rng() < 0.08) return I.STICK;
    return null;
  }
  if (d.drop === undefined) return id;
  return d.drop;
}
export const TIER_NAMES = ['', 'Wooden', 'Stone', 'Iron', 'Diamond'];
