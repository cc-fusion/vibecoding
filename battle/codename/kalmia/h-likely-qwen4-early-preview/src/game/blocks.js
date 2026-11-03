// Block & item registry. Blocks are ids 1..99, items 100+.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6,
  LOG: 7, LEAVES: 8, PLANKS: 9, COAL_ORE: 10, IRON_ORE: 11, GOLD_ORE: 12,
  DIAMOND_ORE: 13, BEDROCK: 14, SNOW_GRASS: 15, CACTUS: 16, GLASS: 17,
  TABLE: 18, FURNACE: 19, TORCH: 20, WOOL: 21, GRAVEL: 22, SNOW: 23,
};

export const I = {
  STICK: 100, COAL: 101, IRON: 103, GOLD: 104,
  PORK_RAW: 105, PORK_COOKED: 106, APPLE: 107,
  W_PICK: 110, W_AXE: 111, W_SHOVEL: 112, W_SWORD: 113,
  S_PICK: 114, S_AXE: 115, S_SHOVEL: 116, S_SWORD: 117,
  I_PICK: 118, I_AXE: 119, I_SHOVEL: 120, I_SWORD: 121,
  D_PICK: 122, D_AXE: 123, D_SHOVEL: 124, D_SWORD: 125,
};

// tiles: [top, bottom, side] names into the texture atlas
// tool: preferred tool; tier: min tool tier for drops; hardness: seconds by hand
export const BLOCKS = {
  [B.GRASS]:      { name: 'Grass Block', tiles: ['grass_top', 'dirt', 'grass_side'], hardness: 0.65, tool: 'shovel', tint: 'grass', drops: [{ id: B.DIRT, n: 1 }] },
  [B.DIRT]:       { name: 'Dirt', tiles: ['dirt', 'dirt', 'dirt'], hardness: 0.55, tool: 'shovel' },
  [B.STONE]:      { name: 'Stone', tiles: ['stone', 'stone', 'stone'], hardness: 2.2, tool: 'pick', tier: 1, drops: [{ id: B.COBBLE, n: 1 }] },
  [B.COBBLE]:     { name: 'Cobblestone', tiles: ['cobble', 'cobble', 'cobble'], hardness: 2.4, tool: 'pick', tier: 1 },
  [B.SAND]:       { name: 'Sand', tiles: ['sand', 'sand', 'sand'], hardness: 0.55, tool: 'shovel' },
  [B.WATER]:      { name: 'Water', tiles: ['water', 'water', 'water'], hardness: -1, fluid: true },
  [B.LOG]:        { name: 'Oak Log', tiles: ['log_top', 'log_top', 'log_side'], hardness: 1.7, tool: 'axe' },
  [B.LEAVES]:     { name: 'Oak Leaves', tiles: ['leaves', 'leaves', 'leaves'], hardness: 0.3, cutout: true, tint: 'leaves', drops: 'leaves' },
  [B.PLANKS]:     { name: 'Oak Planks', tiles: ['planks', 'planks', 'planks'], hardness: 1.7, tool: 'axe' },
  [B.COAL_ORE]:   { name: 'Coal Ore', tiles: ['coal_ore', 'coal_ore', 'coal_ore'], hardness: 3, tool: 'pick', tier: 1, drops: [{ id: I.COAL, n: 1 }] },
  [B.IRON_ORE]:   { name: 'Iron Ore', tiles: ['iron_ore', 'iron_ore', 'iron_ore'], hardness: 3, tool: 'pick', tier: 2 },
  [B.GOLD_ORE]:   { name: 'Gold Ore', tiles: ['gold_ore', 'gold_ore', 'gold_ore'], hardness: 3, tool: 'pick', tier: 3 },
  [B.DIAMOND_ORE]:{ name: 'Diamond Ore', tiles: ['diamond_ore', 'diamond_ore', 'diamond_ore'], hardness: 3.2, tool: 'pick', tier: 3, drops: [{ id: 102, n: 1 }] },
  [B.BEDROCK]:    { name: 'Bedrock', tiles: ['bedrock', 'bedrock', 'bedrock'], hardness: -1 },
  [B.SNOW_GRASS]: { name: 'Snowy Grass', tiles: ['snow', 'dirt', 'snow_grass_side'], hardness: 0.65, tool: 'shovel', drops: [{ id: B.DIRT, n: 1 }] },
  [B.CACTUS]:     { name: 'Cactus', tiles: ['cactus_top', 'cactus_top', 'cactus_side'], hardness: 0.5, cutout: true },
  [B.GLASS]:      { name: 'Glass', tiles: ['glass', 'glass', 'glass'], hardness: 0.4, transparent: true, drops: [] },
  [B.TABLE]:      { name: 'Crafting Table', tiles: ['table_top', 'planks', 'table_side'], hardness: 1.7, tool: 'axe', station: 'craft' },
  [B.FURNACE]:    { name: 'Furnace', tiles: ['furnace_top', 'furnace_top', 'furnace_side'], hardness: 2.8, tool: 'pick', tier: 1, station: 'smelt' },
  [B.TORCH]:      { name: 'Torch', tiles: ['torch', 'torch', 'torch'], hardness: 0.05, shape: 'torch', transparent: true, light: 1 },
  [B.WOOL]:       { name: 'Wool', tiles: ['wool', 'wool', 'wool'], hardness: 0.8 },
  [B.GRAVEL]:     { name: 'Gravel', tiles: ['gravel', 'gravel', 'gravel'], hardness: 0.65, tool: 'shovel' },
  [B.SNOW]:       { name: 'Snow Block', tiles: ['snow', 'snow', 'snow'], hardness: 0.45, tool: 'shovel' },
};

// id 102 = diamond gem (kept out of I for brevity above)
I.DIAMOND = 102;

const TOOL_TIERS = [
  { key: 'W', tier: 1, speed: 2.4, dur: 60, name: 'Wooden' },
  { key: 'S', tier: 2, speed: 4.2, dur: 132, name: 'Stone' },
  { key: 'I', tier: 3, speed: 6.5, dur: 251, name: 'Iron' },
  { key: 'D', tier: 4, speed: 9, dur: 1200, name: 'Diamond' },
];
const TOOL_KINDS = [
  { key: 'PICK', kind: 'pick', name: 'Pickaxe', dmg: 2 },
  { key: 'AXE', kind: 'axe', name: 'Axe', dmg: 3 },
  { key: 'SHOVEL', kind: 'shovel', name: 'Shovel', dmg: 2 },
  { key: 'SWORD', kind: 'sword', name: 'Sword', dmg: 4 },
];

export const ITEMS = {
  [I.STICK]:      { name: 'Stick', icon: 'stick' },
  [I.COAL]:       { name: 'Coal', icon: 'coal' },
  [I.DIAMOND]:    { name: 'Diamond', icon: 'diamond' },
  [I.IRON]:       { name: 'Iron Ingot', icon: 'iron_ingot' },
  [I.GOLD]:       { name: 'Gold Ingot', icon: 'gold_ingot' },
  [I.PORK_RAW]:   { name: 'Raw Porkchop', icon: 'pork_raw', food: 3 },
  [I.PORK_COOKED]:{ name: 'Cooked Porkchop', icon: 'pork_cooked', food: 8 },
  [I.APPLE]:      { name: 'Apple', icon: 'apple', food: 4 },
};

let tid = 110;
export const TOOL_DEFS = [];
for (const t of TOOL_TIERS) {
  for (const k of TOOL_KINDS) {
    const def = {
      name: `${t.name} ${k.name}`, icon: `${k.kind}_${t.key.toLowerCase()}`,
      tool: k.kind, tier: t.tier, speed: t.speed,
      damage: k.kind === 'sword' ? 3 + t.tier : k.dmg, durability: t.dur, stack: 1,
    };
    ITEMS[tid] = def;
    TOOL_DEFS.push({ id: tid, ...def, matKey: t.key });
    tid++;
  }
}

export function defOf(id) {
  return id < 100 ? BLOCKS[id] : ITEMS[id];
}
export function nameOf(id) {
  const d = defOf(id);
  return d ? d.name : 'Unknown';
}
export function isBlock(id) { return id > 0 && id < 100; }
export function stackMax(id) {
  const d = defOf(id);
  return d && d.stack ? d.stack : 64;
}
export function isSolid(id) {
  if (id === B.AIR) return false;
  const d = BLOCKS[id];
  return !!(d && !d.fluid && d.shape !== 'torch');
}
// Does this block fully hide the neighboring face?
export function isOpaque(id) {
  if (id === B.AIR) return false;
  const d = BLOCKS[id];
  return !!(d && !d.fluid && !d.cutout && !d.transparent && d.shape !== 'torch');
}
export function breakable(id) {
  const d = BLOCKS[id];
  return !!d && d.hardness >= 0;
}