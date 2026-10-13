export type DifficultyId = "gentle" | "standard" | "hardcore";

export type MetaUpgrades = {
  vitality: number;
  quarry: number;
  edge: number;
  fortune: number;
};

export type MetaProfile = {
  moonshards: number;
  bestDepth: number;
  bossWins: number;
  runs: number;
  totalKills: number;
  upgrades: MetaUpgrades;
};

export const DEFAULT_PROFILE: MetaProfile = {
  moonshards: 0,
  bestDepth: 0,
  bossWins: 0,
  runs: 0,
  totalKills: 0,
  upgrades: { vitality: 0, quarry: 0, edge: 0, fortune: 0 },
};

export const DIFFICULTIES: Record<DifficultyId, { name: string; hint: string; damage: number; spawn: number; health: number }> = {
  gentle: { name: "Wayfarer", hint: "A kinder descent, generous healing.", damage: 0.7, spawn: 0.8, health: 125 },
  standard: { name: "Pathfinder", hint: "The world as it was meant to be.", damage: 1, spawn: 1, health: 100 },
  hardcore: { name: "Nightbound", hint: "Sharper foes. One life. Richer salvage.", damage: 1.45, spawn: 1.22, health: 82 },
};

export const BOSS_INFO = [
  { name: "The Gloam Eye", epithet: "Watcher in the canopy", item: "lumen_seal", color: "#ef8977", unlock: "A copper blade and a little nerve." },
  { name: "The Bone Regent", epithet: "Keeper of the hollow court", item: "bone_crown", color: "#ddd4a3", unlock: "Defeat the Gloam Eye." },
  { name: "The Abyss Maw", epithet: "The world beneath the world", item: "abyss_heart", color: "#dc7656", unlock: "Defeat the Bone Regent." },
  { name: "The Ember Titan", epithet: "A furnace given form", item: "ember_idol", color: "#ff9a58", unlock: "Break the old world. Defeat the Maw." },
  { name: "The Star Hydra", epithet: "Last light, many mouths", item: "astral_lure", color: "#a9a1ff", unlock: "Defeat the Titan in the awakened deep." },
];

export const ITEM_INFO: Record<string, { name: string; icon: string; color: string; category?: string }> = {
  wood: { name: "Heartwood", icon: "▰", color: "#bd8150", category: "Material" },
  dirt: { name: "Loam", icon: "▪", color: "#98704f", category: "Block" },
  stone: { name: "Stone", icon: "◆", color: "#a3a7a1", category: "Block" },
  copper_ore: { name: "Copper ore", icon: "◈", color: "#e29559", category: "Ore" },
  iron_ore: { name: "Iron ore", icon: "◈", color: "#c6d1d3", category: "Ore" },
  crystal_ore: { name: "Deepglass", icon: "✦", color: "#79dcd4", category: "Ore" },
  soul_ore: { name: "Emberstone", icon: "✦", color: "#f07968", category: "Ore" },
  star_ore: { name: "Star ore", icon: "✦", color: "#c6a5ff", category: "Ore" },
  copper_ingot: { name: "Copper ingot", icon: "▬", color: "#e6a166", category: "Material" },
  iron_ingot: { name: "Iron ingot", icon: "▬", color: "#d6e2df", category: "Material" },
  bone: { name: "Old bone", icon: "╱", color: "#e7dfc0", category: "Material" },
  mushroom: { name: "Glowcap", icon: "✿", color: "#d884c9", category: "Forage" },
  lens: { name: "Gloam lens", icon: "◉", color: "#f0a19a", category: "Relic" },
  abyss_core: { name: "Abyss heart", icon: "⬟", color: "#ff826d", category: "Relic" },
  titan_heart: { name: "Titan heart", icon: "⬟", color: "#ffc06d", category: "Relic" },
  star_core: { name: "Star seed", icon: "✧", color: "#d3b4ff", category: "Relic" },
  lumen_seal: { name: "Lumen seal", icon: "◉", color: "#f0a19a", category: "Boss seal" },
  bone_crown: { name: "Bone crown", icon: "♜", color: "#e7dfc0", category: "Boss seal" },
  abyss_heart: { name: "Abyss heart", icon: "⬟", color: "#ff826d", category: "Boss seal" },
  ember_idol: { name: "Ember idol", icon: "♨", color: "#ffc06d", category: "Boss seal" },
  astral_lure: { name: "Astral lure", icon: "✧", color: "#d3b4ff", category: "Boss seal" },
  moonshard: { name: "Moonshard", icon: "☾", color: "#a9bcff", category: "Keepsake" },
  coin: { name: "Copper coins", icon: "●", color: "#efc474", category: "Currency" },
  healing_tonic: { name: "Healing tonic", icon: "♥", color: "#ff8290", category: "Consumable" },
  arrow: { name: "Wooden arrow", icon: "➶", color: "#d7d9bc", category: "Ammo" },
  wood_wall: { name: "Timber wall", icon: "▤", color: "#b9875c", category: "Build" },
  platform: { name: "Root platform", icon: "▬", color: "#a9784c", category: "Build" },
  torch: { name: "Glow lantern", icon: "♨", color: "#ffd77f", category: "Build" },
  workbench: { name: "Workbench", icon: "⌑", color: "#cf9a5c", category: "Station" },
  forge: { name: "Stone forge", icon: "⌂", color: "#f19060", category: "Station" },
  copper_pick: { name: "Copper pick", icon: "⛏", color: "#e7a05d", category: "Tool" },
  iron_pick: { name: "Iron pick", icon: "⛏", color: "#d5e3e0", category: "Tool" },
  copper_blade: { name: "Copper sabre", icon: "⚔", color: "#e5a15f", category: "Weapon" },
  iron_blade: { name: "Iron greatblade", icon: "⚔", color: "#e4e9d8", category: "Weapon" },
  dusk_bow: { name: "Duskwood bow", icon: "⌁", color: "#c0a778", category: "Weapon" },
  bark_armor: { name: "Barkweave vest", icon: "◈", color: "#92b17c", category: "Armor" },
  iron_armor: { name: "Ironbound coat", icon: "◈", color: "#c5d6d4", category: "Armor" },
  rift_ward: { name: "Rift ward", icon: "◉", color: "#a88cff", category: "Buff" },
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  category: "Gear" | "Stations" | "Survival" | "Building" | "Boss seals";
  materials: Record<string, number>;
  station?: "workbench" | "forge" | "altar";
  unlockBoss?: number;
  result?: string;
  amount?: number;
};

export const RECIPES: Recipe[] = [
  { id: "copper_ingot", name: "Smelt copper", description: "Warm raw ore into workable metal.", category: "Stations", materials: { copper_ore: 3, wood: 1 }, station: "forge", result: "copper_ingot" },
  { id: "iron_ingot", name: "Smelt iron", description: "A dependable metal for the deeper dark.", category: "Stations", materials: { iron_ore: 3, wood: 1 }, station: "forge", result: "iron_ingot" },
  { id: "workbench", name: "Field workbench", description: "A portable station for field repairs.", category: "Stations", materials: { wood: 8 }, result: "workbench" },
  { id: "forge", name: "Stone forge", description: "A small forge for turning ore into ingots.", category: "Stations", materials: { stone: 8, copper_ore: 4, wood: 3 }, station: "workbench", result: "forge" },
  { id: "copper_pick", name: "Copper pick", description: "Bites through stone and ore faster.", category: "Gear", materials: { copper_ingot: 5, wood: 4 }, station: "workbench" },
  { id: "copper_blade", name: "Copper sabre", description: "A quick, honest answer to a monster.", category: "Gear", materials: { copper_ingot: 5, wood: 3 }, station: "workbench" },
  { id: "iron_pick", name: "Iron pick", description: "Strong enough for the deepglass seams.", category: "Gear", materials: { iron_ingot: 6, wood: 4 }, station: "workbench" },
  { id: "iron_blade", name: "Iron greatblade", description: "Heavy reach and a clean, bright edge.", category: "Gear", materials: { iron_ingot: 7, wood: 4, crystal_ore: 2 }, station: "workbench" },
  { id: "dusk_bow", name: "Duskwood bow", description: "A measured shot from the edge of the light.", category: "Gear", materials: { wood: 6, copper_ingot: 2 }, station: "workbench" },
  { id: "bark_armor", name: "Barkweave vest", description: "A little extra protection, woven from heartwood.", category: "Gear", materials: { wood: 10, mushroom: 3 }, station: "workbench" },
  { id: "iron_armor", name: "Ironbound coat", description: "Heavy layers that take the sting from a hit.", category: "Gear", materials: { iron_ingot: 8, crystal_ore: 3 }, station: "workbench" },
  { id: "healing_tonic", name: "Healing tonic", description: "Restore 42 health. The warmth lingers.", category: "Survival", materials: { mushroom: 2, wood: 1 }, station: "workbench", result: "healing_tonic" },
  { id: "rift_ward", name: "Rift ward", description: "Reduce incoming damage for 28 seconds.", category: "Survival", materials: { mushroom: 3, crystal_ore: 2, iron_ingot: 1 }, station: "workbench", result: "rift_ward" },
  { id: "arrows", name: "Bundle of arrows", description: "Eight arrows for a Duskwood bow.", category: "Survival", materials: { wood: 1, stone: 1 }, station: "workbench", result: "arrow", amount: 8 },
  { id: "timber_walls", name: "Timber wall x12", description: "Background walls make a room feel like home.", category: "Building", materials: { wood: 3 }, station: "workbench", result: "wood_wall", amount: 12 },
  { id: "root_platform", name: "Root platforms x6", description: "A one-way ledge for building upward.", category: "Building", materials: { wood: 2 }, station: "workbench", result: "platform", amount: 6 },
  { id: "lantern", name: "Glow lantern", description: "Place it to push the dark back.", category: "Building", materials: { wood: 2, mushroom: 1 }, station: "workbench", result: "torch" },
  { id: "lumen_seal", name: "Lumen seal", description: "Call the Gloam Eye beneath an open sky.", category: "Boss seals", materials: { copper_ingot: 5, mushroom: 3, wood: 4 }, station: "altar", result: "lumen_seal" },
  { id: "bone_crown", name: "Bone crown", description: "Summon the regent of the hollow court.", category: "Boss seals", materials: { bone: 8, iron_ingot: 6, crystal_ore: 5 }, station: "altar", unlockBoss: 1, result: "bone_crown" },
  { id: "abyss_heart", name: "Abyss heart", description: "Wake the ancient maw below the shale.", category: "Boss seals", materials: { lens: 1, iron_ingot: 10, crystal_ore: 12 }, station: "altar", unlockBoss: 2, result: "abyss_heart" },
  { id: "ember_idol", name: "Ember idol", description: "The old world must burn before it can change.", category: "Boss seals", materials: { abyss_core: 1, soul_ore: 12, iron_ingot: 10 }, station: "altar", unlockBoss: 3, result: "ember_idol" },
  { id: "astral_lure", name: "Astral lure", description: "A final beacon for the star-born hydra.", category: "Boss seals", materials: { titan_heart: 1, star_ore: 16, soul_ore: 10 }, station: "altar", unlockBoss: 4, result: "astral_lure" },
];

export type World = {
  width: number;
  height: number;
  tiles: string[][];
  walls: string[][];
  surface: number[];
  startX: number;
  chests: { x: number; y: number; opened: boolean }[];
  homes: { x: number; y: number; resident: number }[];
  seed: number;
};

export type Player = {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  knockback: number;
  hp: number; maxHp: number; defense: number; damage: number; pickPower: number; pickTier: number; weaponTier: number; bow: boolean;
  facing: number; onGround: boolean; invulnerable: number; attackCooldown: number; shootCooldown: number; swing: number; healCooldown: number; wet: boolean;
};

export type Enemy = {
  kind: string; x: number; y: number; vx: number; vy: number; w: number; h: number;
  hp: number; maxHp: number; damage: number; cooldown: number; jumpTimer: number; flash: number; dead: boolean;
  bossIndex?: number; telegraph: number; attackKind: number; phase: number;
};

export type Drop = { item: string; amount: number; x: number; y: number; vx: number; vy: number; life: number; phase: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; shape: "square" | "spark" | "ring" };
export type FloatText = { x: number; y: number; text: string; color: string; life: number; maxLife: number };

export type GameState = {
  world: World; player: Player; entities: Enemy[]; projectiles: { x: number; y: number; vx: number; vy: number; damage: number; life: number; owner: "enemy" | "player"; kind: string; radius: number }[];
  drops: Drop[]; particles: Particle[]; texts: FloatText[]; camera: { x: number; y: number }; viewport: { width: number; height: number };
  inventory: Record<string, number>; selectedSlot: number; hotbar: string[]; difficulty: DifficultyId; meta: MetaUpgrades;
  elapsed: number; dayClock: number; spawnTimer: number; wave: number; depth: number; maxDepth: number; toast: string; toastTimer: number;
  mine: { x: number; y: number; progress: number }; placeCooldown: number; bosses: boolean[]; bossActive: boolean; hardmode: boolean;
  runShards: number; settled: boolean; ended: boolean; shake: number; combo: number; comboTimer: number; freeplay: boolean; bankReward?: number;
  input: { keys: Set<string>; jumpPressed: boolean; attackPressed: boolean; shootPressed: boolean; mouseX: number; mouseY: number; mouseActive: boolean; left: boolean; right: boolean };
  stats: { kills: number; mined: number; items: number; damage: number; peakCombo: number; chests: number; time: number; visited: string[] };
  rng: () => number; events: string[]; invasion: { active: boolean; kills: number; goal: number; timer: number; cooldown: number; spawnTimer: number };
  bossLabelTimer: number; bossLabel: string; riftTimer: number; wardTimer: number;
};

export const TILE = 32;
const WORLD_W = 190;
const WORLD_H = 78;
const SOLID = new Set(["grass", "dirt", "stone", "copper_ore", "iron_ore", "crystal_ore", "soul_ore", "star_ore", "wood", "platform", "altar", "workbench", "forge"]);
const MINEABLE = new Set(["grass", "dirt", "stone", "copper_ore", "iron_ore", "crystal_ore", "soul_ore", "star_ore", "wood", "leaves", "glow_mushroom"]);

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function cell(world: World, x: number, y: number) { return y < 0 ? "air" : (world.tiles[y]?.[x] ?? (x < 0 || x >= world.width || y >= world.height ? "stone" : "air")); }
function solid(world: World, x: number, y: number) { return SOLID.has(cell(world, x, y)); }

function makeWorld(seed: number): World {
  const rng = seededRandom(seed);
  const tiles = Array.from({ length: WORLD_H }, () => Array<string>(WORLD_W).fill("air"));
  const walls = Array.from({ length: WORLD_H }, () => Array<string>(WORLD_W).fill(""));
  const surface: number[] = [];
  for (let x = 0; x < WORLD_W; x++) {
    const ridge = Math.sin(x * 0.075) * 1.7 + Math.sin(x * 0.021 + 1.4) * 2.1 + Math.sin(x * 0.19) * 0.6;
    const sy = Math.round(18 + ridge);
    surface.push(sy);
    for (let y = sy; y < WORLD_H; y++) {
      tiles[y][x] = y === sy ? "grass" : y < sy + 5 ? "dirt" : "stone";
      if (y > sy + 3) walls[y][x] = "shale_wall";
    }
  }

  for (let i = 0; i < 112; i++) {
    const cx = 8 + Math.floor(rng() * (WORLD_W - 16));
    const cy = surface[cx] + 7 + Math.floor(rng() * 39);
    const rx = 2 + Math.floor(rng() * 7);
    const ry = 2 + Math.floor(rng() * 4);
    for (let y = Math.max(1, cy - ry); y <= Math.min(WORLD_H - 2, cy + ry); y++) {
      for (let x = Math.max(1, cx - rx); x <= Math.min(WORLD_W - 2, cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny < 0.9 && tiles[y][x] !== "grass") tiles[y][x] = "air";
      }
    }
  }

  const veins: { id: string; count: number; min: number; max: number }[] = [
    { id: "copper_ore", count: 95, min: 5, max: 24 },
    { id: "iron_ore", count: 86, min: 14, max: 38 },
    { id: "crystal_ore", count: 64, min: 24, max: 48 },
  ];
  veins.forEach(({ id, count, min, max }) => {
    for (let i = 0; i < count; i++) {
      const x = 3 + Math.floor(rng() * (WORLD_W - 6));
      const depth = min + Math.floor(rng() * (max - min));
      const y = clamp(surface[x] + depth, 2, WORLD_H - 2);
      if (tiles[y][x] === "stone" || tiles[y][x] === "dirt") tiles[y][x] = id;
      for (let n = 0; n < 2 + Math.floor(rng() * 5); n++) {
        const ox = x + Math.floor(rng() * 5) - 2;
        const oy = y + Math.floor(rng() * 5) - 2;
        if (tiles[oy]?.[ox] === "stone") tiles[oy][ox] = id;
      }
    }
  });

  for (let x = 5; x < WORLD_W - 5; x += 3 + Math.floor(rng() * 5)) {
    if (Math.abs(x - WORLD_W / 2) < 7 || rng() > 0.78) continue;
    const sy = surface[x];
    const trunk = 3 + Math.floor(rng() * 3);
    for (let y = sy - trunk; y < sy; y++) if (y >= 0) tiles[y][x] = "wood";
    const crownY = sy - trunk;
    for (let oy = -2; oy <= 1; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const tx = x + ox;
        const ty = crownY + oy;
        if (Math.abs(ox) + Math.abs(oy) < 4 && tiles[ty]?.[tx] === "air") tiles[ty][tx] = "leaves";
      }
    }
  }

  for (let x = 4; x < WORLD_W - 4; x++) {
    for (let y = surface[x] + 6; y < WORLD_H - 2; y++) {
      if (tiles[y][x] === "air" && (tiles[y + 1][x] === "stone" || tiles[y + 1][x] === "dirt") && rng() < 0.022) tiles[y][x] = "glow_mushroom";
    }
  }

  const startX = Math.floor(WORLD_W / 2);
  const chests: World["chests"] = [];
  [17, 28, 39].forEach((depth, index) => {
    const x = Math.max(4, Math.min(WORLD_W - 5, startX + (index % 2 ? -1 : 1) * (18 + index * 8)));
    let y = Math.min(WORLD_H - 4, surface[x] + depth);
    while (y < WORLD_H - 3 && tiles[y][x] !== "air") y++;
    tiles[y][x] = "chest";
    chests.push({ x, y, opened: false });
  });

  const baseY = surface[startX];
  tiles[baseY - 1][startX - 4] = "altar";
  tiles[baseY - 1][startX + 3] = "workbench";
  tiles[baseY - 1][startX + 5] = "forge";
  tiles[baseY - 1][startX - 6] = "lantern";
  return { width: WORLD_W, height: WORLD_H, tiles, walls, surface, startX, chests, homes: [], seed };
}

export function createGame(difficulty: DifficultyId, meta: MetaUpgrades): GameState {
  const seed = Math.floor(Math.random() * 0x7fffffff);
  const world = makeWorld(seed);
  const rng = seededRandom(seed ^ 0x9e3779b9);
  const spawnX = world.startX * TILE + 6;
  const spawnY = world.surface[world.startX] * TILE - 30;
  const profile = DIFFICULTIES[difficulty];
  const maxHp = profile.health + meta.vitality * 18;
  return {
    world,
    player: {
      x: spawnX, y: spawnY, vx: 0, vy: 0, knockback: 0, w: 20, h: 30,
      hp: maxHp, maxHp, defense: 0, damage: 10 + meta.edge * 3, pickPower: 1 + meta.quarry * 0.2, pickTier: 0, weaponTier: 0, bow: false,
      facing: 1, onGround: false, invulnerable: 0, attackCooldown: 0, shootCooldown: 0, swing: 0, healCooldown: 0, wet: false,
    },
    entities: [], projectiles: [], drops: [], particles: [], texts: [], camera: { x: 0, y: Math.max(0, spawnY - 240) }, viewport: { width: 1000, height: 600 },
    inventory: { wood: 8, dirt: 18, stone: 4, copper_ore: 0, iron_ore: 0, crystal_ore: 0, soul_ore: 0, star_ore: 0, copper_ingot: 0, iron_ingot: 0, mushroom: 0, bone: 0, coin: 12, moonshard: 0, arrow: 0, healing_tonic: 1, wood_wall: 0, platform: 0, torch: 0 },
    selectedSlot: 0, hotbar: ["dirt", "wood", "stone", "copper_ore", "iron_ore", "crystal_ore", "healing_tonic", "arrow"], difficulty, meta,
    elapsed: 0, dayClock: 0.3, spawnTimer: 2.2, wave: 1, depth: 0, maxDepth: 0, toast: "A quiet forest. A very deep world.", toastTimer: 4,
    mine: { x: -1, y: -1, progress: 0 }, placeCooldown: 0, bosses: [false, false, false, false, false], bossActive: false, hardmode: false,
    runShards: 0, settled: false, ended: false, shake: 0, combo: 0, comboTimer: 0, freeplay: false,
    input: { keys: new Set(), jumpPressed: false, attackPressed: false, shootPressed: false, mouseX: 500, mouseY: 300, mouseActive: false, left: false, right: false },
    stats: { kills: 0, mined: 0, items: 0, damage: 0, peakCombo: 0, chests: 0, time: 0, visited: ["The Rootward Grove"] },
    rng, events: [], invasion: { active: false, kills: 0, goal: 9, timer: 0, cooldown: 92, spawnTimer: 0 },
    bossLabelTimer: 0, bossLabel: "", riftTimer: 0, wardTimer: 0,
  };
}

export function setDifficulty(game: GameState, difficulty: DifficultyId) {
  const old = game.player.maxHp;
  game.difficulty = difficulty;
  const next = DIFFICULTIES[difficulty].health + game.meta.vitality * 18;
  game.player.hp = Math.min(next, game.player.hp + Math.max(0, next - old));
  game.player.maxHp = next;
  say(game, `The descent is now ${DIFFICULTIES[difficulty].name.toLowerCase()}.`);
}

export function canCraft(game: GameState, recipe: Recipe): string | null {
  if (recipe.unlockBoss && game.bosses.filter(Boolean).length < recipe.unlockBoss) return `Defeat ${BOSS_INFO[recipe.unlockBoss - 1].name} first.`;
  if (recipe.station && !nearStation(game, recipe.station)) return `Find a ${recipe.station === "altar" ? "rune altar" : recipe.station === "forge" ? "forge" : "workbench"}.`;
  for (const [item, amount] of Object.entries(recipe.materials)) {
    if ((game.inventory[item] ?? 0) < amount) return `Need ${amount} ${ITEM_INFO[item]?.name ?? item}.`;
  }
  return null;
}

export function craftRecipe(game: GameState, recipeId: string): { ok: boolean; message: string } {
  const recipe = RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) return { ok: false, message: "That recipe is not in the field guide." };
  const reason = canCraft(game, recipe);
  if (reason) return { ok: false, message: reason };
  Object.entries(recipe.materials).forEach(([item, amount]) => { game.inventory[item] = (game.inventory[item] ?? 0) - amount; });
  if (recipe.result) game.inventory[recipe.result] = (game.inventory[recipe.result] ?? 0) + (recipe.amount ?? 1);
  if (recipeId === "copper_pick") { game.player.pickTier = Math.max(game.player.pickTier, 1); game.player.pickPower = 1.55 + game.meta.quarry * 0.2; }
  if (recipeId === "iron_pick") { game.player.pickTier = 2; game.player.pickPower = 2.35 + game.meta.quarry * 0.2; }
  if (recipeId === "copper_blade") { game.player.weaponTier = Math.max(game.player.weaponTier, 1); game.player.damage = 21 + game.meta.edge * 3; }
  if (recipeId === "iron_blade") { game.player.weaponTier = 2; game.player.damage = 34 + game.meta.edge * 3; }
  if (recipeId === "dusk_bow") game.player.bow = true;
  if (recipeId === "bark_armor") game.player.defense = Math.max(game.player.defense, 3);
  if (recipeId === "iron_armor") game.player.defense = Math.max(game.player.defense, 7);
  if (recipeId === "workbench") game.toast = "Workbench crafted. Place it with right-click.";
  else if (recipeId === "forge") game.toast = "Forge crafted. Place it with right-click.";
  else if (recipeId === "lumen_seal" || recipeId === "bone_crown" || recipeId === "abyss_heart" || recipeId === "ember_idol" || recipeId === "astral_lure") game.toast = `${ITEM_INFO[recipe.result ?? ""]?.name ?? recipe.name} ready. Open the boss ledger to summon.`;
  else game.toast = `${recipe.name} crafted.`;
  game.toastTimer = 3;
  game.events.push("craft");
  addText(game, game.player.x + game.player.w / 2, game.player.y - 20, "CRAFTED", "#efc67c");
  return { ok: true, message: game.toast };
}

function nearStation(game: GameState, station: "workbench" | "forge" | "altar") {
  const px = Math.floor((game.player.x + game.player.w / 2) / TILE);
  const py = Math.floor((game.player.y + game.player.h / 2) / TILE);
  for (let y = py - 5; y <= py + 5; y++) for (let x = px - 6; x <= px + 6; x++) {
    if (cell(game.world, x, y) === station && Math.hypot(x - px, y - py) < 7) return true;
  }
  return false;
}

export function bossStatus(game: GameState, index: number): { unlocked: boolean; reason: string; token: string } {
  const token = BOSS_INFO[index]?.item ?? "";
  if (index > game.bosses.filter(Boolean).length) return { unlocked: false, reason: "Defeat the previous guardian first.", token };
  if (game.bosses[index]) return { unlocked: false, reason: "This guardian has already fallen.", token };
  if (game.bossActive) return { unlocked: false, reason: "A guardian is already hunting you.", token };
  if (!nearStation(game, "altar")) return { unlocked: false, reason: "Return to a rune altar to call it.", token };
  if ((game.inventory[token] ?? 0) < 1) return { unlocked: false, reason: `Craft a ${ITEM_INFO[token]?.name ?? token} at the altar.`, token };
  return { unlocked: true, reason: "The seal is ready. Make sure your blade is sharp.", token };
}

export function summonBoss(game: GameState, index: number): { ok: boolean; message: string } {
  const status = bossStatus(game, index);
  if (!status.unlocked) return { ok: false, message: status.reason };
  game.inventory[status.token]--;
  const names = ["The Gloam Eye", "The Bone Regent", "The Abyss Maw", "The Ember Titan", "The Star Hydra"];
  const hpBase = [185, 280, 385, 470, 590][index];
  const difficultyScale = game.difficulty === "gentle" ? 0.78 : game.difficulty === "hardcore" ? 1.32 : 1;
  const size = [58, 66, 100, 76, 102][index];
  const boss: Enemy = {
    kind: "boss", bossIndex: index, x: clamp(game.player.x + game.player.facing * 250, 120, (game.world.width - 5) * TILE),
    y: game.player.y - (index === 1 || index === 3 ? 6 : 90), vx: 0, vy: 0,
    w: index === 2 ? 132 : size, h: index === 1 ? 90 : index === 3 ? 92 : size,
    hp: Math.round(hpBase * difficultyScale), maxHp: Math.round(hpBase * difficultyScale), damage: [15, 18, 23, 24, 28][index], cooldown: 1.2, jumpTimer: 0,
    flash: 0, dead: false, telegraph: 0, attackKind: 0, phase: 0,
  };
  if (index === 1 || index === 3) {
    let floor = Math.floor((boss.x + boss.w / 2) / TILE);
    let y = game.world.surface[clamp(floor, 0, game.world.width - 1)] * TILE - boss.h;
    if (game.depth > 5) y = game.player.y;
    boss.y = y;
  }
  game.entities.push(boss);
  game.bossActive = true;
  game.bossLabel = names[index];
  game.bossLabelTimer = 5;
  game.shake = 10;
  game.events.push("boss");
  say(game, `${names[index]} answers the call.`);
  addText(game, game.player.x + 10, game.player.y - 50, "A PRESENCE STIRS", "#ff9c84");
  return { ok: true, message: `${names[index]} has entered the world.` };
}

export function buildCabin(game: GameState): { ok: boolean; message: string } {
  const count = game.world.homes.length;
  const requirements = [0, 1, 2, 3];
  if (count >= 4) return { ok: false, message: "Every room in the grove is spoken for." };
  if (count > 0 && game.bosses.filter(Boolean).length < requirements[count]) return { ok: false, message: `Defeat ${BOSS_INFO[requirements[count] - 1].name} to attract a new resident.` };
  const cost = count === 0 ? { wood: 6, stone: 3 } : { wood: 12, stone: 8 };
  for (const [item, amount] of Object.entries(cost)) if ((game.inventory[item] ?? 0) < amount) return { ok: false, message: `Need ${amount} ${ITEM_INFO[item]?.name ?? item} to raise this cabin.` };
  Object.entries(cost).forEach(([item, amount]) => { game.inventory[item] -= amount; });
  const x = Math.min(game.world.width - 10, game.world.startX + 9 + count * 9);
  const groundY = game.world.surface[x];
  const left = x;
  const right = x + 6;
  const roof = groundY - 6;
  for (let hx = left; hx <= right; hx++) {
    game.world.tiles[roof][hx] = "wood";
    game.world.walls[roof + 1][hx] = "wood_wall";
    game.world.walls[roof + 2][hx] = "wood_wall";
    game.world.walls[roof + 3][hx] = "wood_wall";
    game.world.walls[roof + 4][hx] = "wood_wall";
  }
  for (let hy = roof + 1; hy < groundY; hy++) {
    game.world.tiles[hy][left] = "wood";
    game.world.tiles[hy][right] = "wood";
    for (let hx = left + 1; hx < right; hx++) {
      game.world.tiles[hy][hx] = "air";
      game.world.walls[hy][hx] = "wood_wall";
    }
  }
  game.world.tiles[groundY - 1][left] = "air";
  game.world.tiles[groundY - 1][left + 2] = "workbench";
  game.world.tiles[groundY - 1][left + 4] = "lantern";
  game.world.homes.push({ x: left, y: roof, resident: count });
  const residentNames = ["Moss, the Forester", "Pip, the Tinker", "Nima, the Wayfarer", "Sol, the Oracle"];
  say(game, `${residentNames[count]} has moved into the grove.`);
  game.events.push("craft");
  return { ok: true, message: `${residentNames[count]} has a home. Their trade is open in the Camp ledger.` };
}

export function tradeNpc(game: GameState, resident: number): { ok: boolean; message: string } {
  if (!game.world.homes[resident]) return { ok: false, message: "That room is still empty." };
  const trades = [
    { cost: 8, item: "wood", amount: 8, label: "8 heartwood" },
    { cost: 12, item: "healing_tonic", amount: 2, label: "2 healing tonics" },
    { cost: 16, item: "iron_ingot", amount: 3, label: "3 iron ingots" },
    { cost: 20, item: "moonshard", amount: 3, label: "3 moonshards" },
  ];
  const trade = trades[resident];
  if (game.inventory.coin < trade.cost) return { ok: false, message: `The trade costs ${trade.cost} copper coins.` };
  game.inventory.coin -= trade.cost;
  game.inventory[trade.item] = (game.inventory[trade.item] ?? 0) + trade.amount;
  if (trade.item === "moonshard") game.runShards += trade.amount;
  game.events.push("pickup");
  return { ok: true, message: `Trade complete: ${trade.label}.` };
}

export function openNearbyChest(game: GameState): string {
  const px = game.player.x + game.player.w / 2;
  const chest = game.world.chests.find((entry) => !entry.opened && Math.hypot((entry.x + 0.5) * TILE - px, (entry.y + 0.5) * TILE - game.player.y) < TILE * 3);
  if (!chest) return "No sealed cache nearby. Look for a gold glint in the deep.";
  chest.opened = true;
  game.world.tiles[chest.y][chest.x] = "open_chest";
  game.stats.chests++;
  const rewards = [
    ["coin", 10 + Math.floor(game.rng() * 10)], ["healing_tonic", 1], ["arrow", 12], ["copper_ore", 4], ["iron_ore", 3], ["moonshard", 2],
  ] as const;
  const reward = rewards[Math.floor(game.rng() * rewards.length)];
  game.inventory[reward[0]] = (game.inventory[reward[0]] ?? 0) + reward[1];
  if (reward[0] === "moonshard") game.runShards += reward[1];
  say(game, `Cache opened: ${reward[1]} ${ITEM_INFO[reward[0]]?.name ?? reward[0]}.`);
  game.events.push("pickup");
  return game.toast;
}

export function phaseName(game: GameState) {
  const t = game.dayClock % 1;
  if (t < 0.52) return "Daylight";
  if (t < 0.68) return "Sundown";
  if (t < 0.92) return "Moonrise";
  return "First light";
}

export function biomeName(game: GameState) {
  const d = game.depth;
  if (d < 4) return "Rootward Grove";
  if (d < 12) return "Shale Hollows";
  const x = Math.floor(game.player.x / TILE);
  if (d < 21 && Math.floor(x / 23) % 3 === 1) return "Glowcap Grotto";
  if (d < 31) return "Deepglass Reach";
  if (d < 42) return game.hardmode ? "Ember Veins" : "The Old Deep";
  return game.hardmode ? "Astral Fault" : "The Root Below";
}

export function objectiveText(game: GameState) {
  const defeated = game.bosses.filter(Boolean).length;
  const steps = [
    "Mine heartwood, gather copper, then craft a Lumen seal at the rune altar.",
    "The court stirs below. Gather old bones and deepglass; forge a Bone crown.",
    "Descend past the shale. The Abyss Maw needs iron, deepglass, and the Gloam lens.",
    "The world has changed. Mine Emberstone and craft an Ember idol at the altar.",
    "Find Star ore in the awakened deep. Craft an Astral lure for the last hunt.",
    "The roots are quiet again. Build, explore, and make this world your own.",
  ];
  return steps[defeated] ?? steps[5];
}

export function stepGame(game: GameState, dt: number): "gameover" | "victory" | null {
  if (game.ended) return null;
  dt = Math.min(dt, 0.04);
  game.elapsed += dt;
  game.stats.time = game.elapsed;
  game.dayClock = (game.dayClock + dt / 165) % 1;
  game.wave = 1 + Math.floor(game.elapsed / 64) + Math.floor(game.depth / 38) + (game.hardmode ? 1 : 0);
  game.toastTimer = Math.max(0, game.toastTimer - dt);
  game.bossLabelTimer = Math.max(0, game.bossLabelTimer - dt);
  game.player.invulnerable = Math.max(0, game.player.invulnerable - dt);
  game.player.attackCooldown = Math.max(0, game.player.attackCooldown - dt);
  game.player.shootCooldown = Math.max(0, game.player.shootCooldown - dt);
  game.player.healCooldown = Math.max(0, game.player.healCooldown - dt);
  game.player.swing = Math.max(0, game.player.swing - dt);
  game.shake = Math.max(0, game.shake - dt * 19);
  game.comboTimer = Math.max(0, game.comboTimer - dt);
  game.riftTimer = Math.max(0, game.riftTimer - dt);
  game.wardTimer = Math.max(0, game.wardTimer - dt);
  game.placeCooldown = Math.max(0, game.placeCooldown - dt);

  const input = game.input;
  const p = game.player;
  const keys = input.keys;
  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const jumpHeld = keys.has(" ") || keys.has("w") || keys.has("arrowup");
  const move = Number(right) - Number(left);
  if (move) p.facing = move;
  const inWater = touchesTile(game.world, p.x, p.y, p.w, p.h, "water");
  p.wet = inWater;
  p.vx = move * (inWater ? 150 : 205) + p.knockback;
  p.knockback *= Math.pow(0.025, dt);
  if (input.jumpPressed && p.onGround) { p.vy = inWater ? -330 : -455; p.onGround = false; game.events.push("jump"); }
  input.jumpPressed = false;
  if (!jumpHeld && p.vy < -170) p.vy += 1220 * dt;
  if (inWater && jumpHeld) p.vy = Math.max(-270, p.vy - 480 * dt);
  p.vy = Math.min(p.vy + (inWater ? 600 : 1120) * dt, 680);
  const moved = moveActor(game.world, p, p.vx * dt, p.vy * dt);
  p.onGround = moved.grounded;
  if (!moved.hitY && !p.onGround && p.vy === 0) p.onGround = true;

  const targetCamX = clamp(p.x + p.w / 2 - game.viewport.width / 2, 0, Math.max(0, game.world.width * TILE - game.viewport.width));
  const targetCamY = clamp(p.y + p.h / 2 - game.viewport.height * 0.54, 0, Math.max(0, game.world.height * TILE - game.viewport.height));
  game.camera.x += (targetCamX - game.camera.x) * Math.min(1, dt * 7);
  game.camera.y += (targetCamY - game.camera.y) * Math.min(1, dt * 6);
  game.depth = Math.max(0, Math.floor(p.y / TILE - game.world.surface[clamp(Math.floor((p.x + p.w / 2) / TILE), 0, game.world.width - 1)]));
  game.maxDepth = Math.max(game.maxDepth, game.depth);
  const biome = biomeName(game);
  if (!game.stats.visited.includes(biome)) game.stats.visited.push(biome);

  if (input.left || keys.has("mine")) mineTarget(game, dt);
  else { game.mine.x = -1; game.mine.y = -1; game.mine.progress = 0; }
  if (input.right && game.placeCooldown <= 0) placeTarget(game);
  if (input.attackPressed) attack(game);
  input.attackPressed = false;
  if (input.shootPressed) shoot(game);
  input.shootPressed = false;
  if (keys.has("q")) { keys.delete("q"); useTonic(game); }

  updateSpawns(game, dt);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updateDrops(game, dt);
  updateEffects(game, dt);
  updateInvasion(game, dt);

  if (p.hp <= 0 && !game.ended) { game.ended = true; game.events.push("death"); return "gameover"; }
  if (game.bosses.every(Boolean) && !game.ended && !game.freeplay) { game.ended = true; game.events.push("victory"); return "victory"; }
  return null;
}

function touchesTile(world: World, x: number, y: number, w: number, h: number, tileId: string) {
  for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + h - 1) / TILE); ty++) for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + w - 1) / TILE); tx++) if (cell(world, tx, ty) === tileId) return true;
  return false;
}

function collides(world: World, x: number, y: number, w: number, h: number) {
  const left = Math.floor(x / TILE); const right = Math.floor((x + w - 1) / TILE);
  const top = Math.floor(y / TILE); const bottom = Math.floor((y + h - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) for (let tx = left; tx <= right; tx++) if (solid(world, tx, ty)) return true;
  return false;
}

function moveActor(world: World, actor: { x: number; y: number; w: number; h: number; vy: number }, dx: number, dy: number) {
  let hitX = false; let hitY = false; let grounded = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
  const sx = dx / steps; const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    actor.x += sx;
    if (collides(world, actor.x, actor.y, actor.w, actor.h)) { actor.x -= sx; hitX = true; }
    actor.y += sy;
    if (collides(world, actor.x, actor.y, actor.w, actor.h)) {
      actor.y -= sy; hitY = true;
      if (sy > 0) grounded = true;
      actor.vy = 0;
    }
  }
  actor.x = clamp(actor.x, 0, world.width * TILE - actor.w);
  return { hitX, hitY, grounded };
}

function mouseTarget(game: GameState) {
  if (game.input.mouseActive) {
    return { x: Math.floor((game.input.mouseX + game.camera.x) / TILE), y: Math.floor((game.input.mouseY + game.camera.y) / TILE) };
  }
  return { x: Math.floor((game.player.x + game.player.w / 2 + game.player.facing * TILE * 1.25) / TILE), y: Math.floor((game.player.y + game.player.h + TILE * 0.45) / TILE) };
}

function targetInReach(game: GameState, tx: number, ty: number) {
  return Math.hypot((tx + 0.5) * TILE - (game.player.x + game.player.w / 2), (ty + 0.5) * TILE - (game.player.y + game.player.h / 2)) < TILE * 5.5;
}

function mineTarget(game: GameState, dt: number) {
  const { x, y } = mouseTarget(game);
  const tile = cell(game.world, x, y);
  if (!MINEABLE.has(tile) || !targetInReach(game, x, y)) { game.mine.progress = Math.max(0, game.mine.progress - 0.05); return; }
  if (x !== game.mine.x || y !== game.mine.y) game.mine = { x, y, progress: 0 };
  const hardness: Record<string, number> = { grass: 0.38, dirt: 0.42, wood: 0.48, leaves: 0.16, glow_mushroom: 0.22, stone: 0.8, copper_ore: 0.95, iron_ore: 1.12, crystal_ore: 1.25, soul_ore: 1.35, star_ore: 1.45 };
  const requiredTier = tile === "star_ore" ? 2 : tile === "crystal_ore" || tile === "soul_ore" ? 1 : 0;
  if (game.player.pickTier < requiredTier) { game.mine.progress = Math.min(game.mine.progress, 0.4); return; }
  game.mine.progress += game.player.pickPower * dt * 1.5;
  if (game.mine.progress >= (hardness[tile] ?? 0.6)) {
    game.world.tiles[y][x] = "air";
    const drop = tile === "grass" ? "dirt" : tile === "leaves" ? (game.rng() < 0.4 ? "wood" : "mushroom") : tile === "glow_mushroom" ? "mushroom" : tile;
    spawnDrop(game, drop, 1 + (drop === "wood" && game.rng() < 0.25 ? 1 : 0), (x + 0.5) * TILE, (y + 0.5) * TILE);
    game.stats.mined++;
    game.shake = Math.max(game.shake, 1.7);
    burst(game, (x + 0.5) * TILE, (y + 0.5) * TILE, tileColor(tile), 5);
    game.events.push("break");
    game.mine = { x: -1, y: -1, progress: 0 };
  }
}

function placeTarget(game: GameState) {
  const { x, y } = mouseTarget(game);
  if (!targetInReach(game, x, y)) return;
  if (x < 1 || y < 1 || x >= game.world.width - 1 || y >= game.world.height - 1) return;
  const item = game.hotbar[game.selectedSlot];
  if (!item || (game.inventory[item] ?? 0) <= 0) { game.placeCooldown = 0.24; return; }
  const placements: Record<string, string> = { dirt: "dirt", wood: "wood", stone: "stone", wood_wall: "wood_wall", torch: "lantern", platform: "platform", workbench: "workbench", forge: "forge" };
  const tile = placements[item];
  if (!tile) { game.placeCooldown = 0.24; return; }
  const px = game.player.x + game.player.w / 2; const py = game.player.y + game.player.h / 2;
  if (tile !== "wood_wall" && Math.abs((x + 0.5) * TILE - px) < game.player.w + 8 && Math.abs((y + 0.5) * TILE - py) < game.player.h + 8) return;
  if (tile === "wood_wall") {
    if (game.world.walls[y][x]) return;
    game.world.walls[y][x] = "wood_wall";
  } else {
    if (cell(game.world, x, y) !== "air" && cell(game.world, x, y) !== "water") return;
    game.world.tiles[y][x] = tile;
  }
  game.inventory[item]--;
  game.placeCooldown = 0.25;
  game.events.push("craft");
  burst(game, (x + 0.5) * TILE, (y + 0.5) * TILE, tileColor(tile), 4);
}

function attack(game: GameState) {
  const p = game.player;
  if (p.attackCooldown > 0) return;
  p.attackCooldown = p.weaponTier >= 2 ? 0.42 : 0.52;
  p.swing = 0.2;
  game.combo = game.comboTimer > 0 ? game.combo + 1 : 1;
  game.comboTimer = 2.1;
  game.stats.peakCombo = Math.max(game.stats.peakCombo, game.combo);
  const reach = p.weaponTier >= 2 ? 112 : 92;
  let hit = false;
  for (const enemy of game.entities) {
    if (enemy.dead) continue;
    const ex = enemy.x + enemy.w / 2; const ey = enemy.y + enemy.h / 2;
    const dx = ex - (p.x + p.w / 2); const dy = ey - (p.y + p.h / 2);
    if (Math.hypot(dx, dy) < reach + enemy.w * 0.22 && (Math.sign(dx) === p.facing || Math.abs(dx) < 25) && Math.abs(dy) < 100) {
      const damage = p.damage + (p.weaponTier >= 2 ? 7 : p.weaponTier === 1 ? 3 : 0);
      enemy.hp -= damage;
      enemy.flash = 0.18;
      enemy.vx += p.facing * (enemy.kind === "boss" ? 65 : 150);
      enemy.vy -= enemy.kind === "boss" ? 40 : 100;
      game.stats.damage += damage;
      game.shake = Math.max(game.shake, enemy.kind === "boss" ? 3 : 1.4);
      addText(game, ex, ey - 12, `${damage}`, enemy.kind === "boss" ? "#ffd27e" : "#f2e2bc");
      burst(game, ex, ey, enemy.kind === "boss" ? "#ffab80" : "#efe4c9", 7);
      game.events.push("hit");
      hit = true;
    }
  }
  if (!hit) game.events.push("swish");
}

function shoot(game: GameState) {
  const p = game.player;
  if (!p.bow || p.shootCooldown > 0 || game.inventory.arrow <= 0) return;
  p.shootCooldown = 0.55;
  game.inventory.arrow--;
  const damage = 18 + (p.weaponTier >= 2 ? 6 : 0);
  game.projectiles.push({ x: p.x + p.w / 2 + p.facing * 16, y: p.y + p.h * 0.43, vx: p.facing * 470, vy: -22, damage, life: 1.8, owner: "player", kind: "arrow", radius: 5 });
  game.events.push("shoot");
}

function useTonic(game: GameState) {
  if (game.player.healCooldown > 0 || game.inventory.healing_tonic <= 0 || game.player.hp >= game.player.maxHp) return;
  game.inventory.healing_tonic--;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + 42);
  game.player.healCooldown = 0.8;
  addText(game, game.player.x + 10, game.player.y - 18, "+42", "#95e0a3");
  burst(game, game.player.x + 10, game.player.y + 10, "#91dfa3", 12);
  game.events.push("heal");
}

function updateSpawns(game: GameState, dt: number) {
  game.spawnTimer -= dt;
  game.invasion.cooldown -= dt;
  if (game.bossActive) return;
  if (game.spawnTimer <= 0) {
    const cap = game.invasion.active ? 15 : 10 + Math.min(5, Math.floor(game.depth / 14));
    if (game.entities.filter((enemy) => !enemy.dead && enemy.kind !== "boss").length < cap) spawnEnemy(game);
    const night = phaseName(game) === "Moonrise" || phaseName(game) === "Sundown";
    game.spawnTimer = (night ? 2.2 : 4.2) / DIFFICULTIES[game.difficulty].spawn * (game.invasion.active ? 0.68 : 1) * (game.hardmode ? 0.82 : 1);
    game.spawnTimer *= 0.84 + game.rng() * 0.42;
  }
  if (game.bosses[0] && !game.invasion.active && game.invasion.cooldown <= 0 && phaseName(game) === "Moonrise") {
    game.invasion.active = true;
    game.invasion.kills = 0;
    game.invasion.timer = 72;
    game.invasion.spawnTimer = 0.8;
    say(game, "ROOTFALL! The grove is under siege.");
    game.bossLabel = "ROOTFALL INVASION";
    game.bossLabelTimer = 4.5;
    game.events.push("invasion");
  }
}

function spawnEnemy(game: GameState) {
  const d = game.depth;
  const night = phaseName(game) === "Moonrise" || phaseName(game) === "Sundown";
  const roll = game.rng();
  let kind: string;
  if (game.hardmode && roll < 0.26) kind = "starling";
  else if (d >= 38 && roll < 0.4) kind = "wisp";
  else if (d >= 16 && roll < 0.34) kind = "skeleton";
  else if (d >= 8 && roll < 0.63) kind = "crawler";
  else if (d >= 4 && roll < 0.73) kind = "bat";
  else if (night && roll < 0.5) kind = "skeleton";
  else if (night && roll < 0.72) kind = "wisp";
  else kind = "slime";
  const side = game.rng() < 0.5 ? -1 : 1;
  const px = game.player.x + game.player.w / 2;
  const x = clamp(px + side * (300 + game.rng() * 250), 40, game.world.width * TILE - 60);
  const col = Math.floor(x / TILE);
  const floor = game.world.surface[col] ?? 20;
  let y = game.player.y;
  if (kind === "bat" || kind === "wisp" || kind === "starling") y = Math.max(30, game.player.y + (game.rng() - 0.5) * 220);
  else if (game.depth < 3) y = floor * TILE - 28;
  else {
    const centerY = Math.floor(game.player.y / TILE);
    let found = false;
    for (let row = Math.max(floor + 2, centerY - 8); row < Math.min(game.world.height - 2, centerY + 8); row++) {
      if (!solid(game.world, col, row) && !solid(game.world, col, row + 1) && solid(game.world, col, row + 2)) { y = row * TILE - 26; found = true; break; }
    }
    if (!found) y = game.player.y;
  }
  const sizes: Record<string, [number, number, number, number]> = {
    slime: [28, 24, 28, 8], bat: [26, 20, 20, 7], crawler: [32, 24, 40, 11], skeleton: [26, 39, 48, 10], wisp: [25, 30, 35, 12], starling: [29, 29, 44, 14],
  };
  const [w, h, hp, damage] = sizes[kind] ?? sizes.slime;
  const scale = 1 + Math.min(0.8, game.wave * 0.035) + (game.hardmode ? 0.35 : 0);
  game.entities.push({ kind, x, y, vx: 0, vy: 0, w, h, hp: Math.round(hp * scale), maxHp: Math.round(hp * scale), damage: damage * (game.hardmode ? 1.22 : 1), cooldown: 1 + game.rng() * 1.8, jumpTimer: game.rng(), flash: 0, dead: false, telegraph: 0, attackKind: 0, phase: game.rng() * 5 });
}

function updateEnemies(game: GameState, dt: number) {
  const player = game.player;
  for (const enemy of game.entities) {
    if (enemy.dead) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.cooldown -= dt;
    enemy.jumpTimer -= dt;
    enemy.telegraph = Math.max(0, enemy.telegraph - dt);
    const dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    const dy = player.y + player.h / 2 - (enemy.y + enemy.h / 2);
    if (enemy.kind === "boss") {
      updateBoss(game, enemy, dx, dy, dt);
    } else if (enemy.kind === "bat" || enemy.kind === "wisp" || enemy.kind === "starling") {
      const speed = enemy.kind === "starling" ? 118 : enemy.kind === "wisp" ? 88 : 75;
      enemy.phase += dt * (enemy.kind === "starling" ? 4.5 : 2.7);
      enemy.vx += (Math.sign(dx) * speed - enemy.vx) * Math.min(1, dt * 2);
      enemy.vy += ((Math.sign(dy) * speed * 0.72 + Math.sin(enemy.phase) * 32) - enemy.vy) * Math.min(1, dt * 2);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.y = clamp(enemy.y, 10, game.world.height * TILE - 160);
      if (enemy.cooldown <= 0 && Math.abs(dx) < 390) {
        enemy.cooldown = enemy.kind === "starling" ? 1.8 : 2.7;
        launchProjectile(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, dx, dy, enemy.damage * 0.72, enemy.kind === "starling" ? "star" : "orb", 220);
      }
    } else {
      const dir = Math.sign(dx);
      const speed = enemy.kind === "crawler" ? 83 : enemy.kind === "skeleton" ? (Math.abs(dx) < 130 ? 0 : 64) : 66;
      enemy.vx += (dir * speed - enemy.vx) * Math.min(1, dt * 3.5);
      if (enemy.kind === "slime" && enemy.jumpTimer <= 0 && enemy.y + enemy.h < player.y + 180) {
        enemy.vy = -255 - game.rng() * 75;
        enemy.jumpTimer = 0.8 + game.rng() * 1.2;
      }
      enemy.vy = Math.min(enemy.vy + 1050 * dt, 650);
      const moved = moveActor(game.world, enemy, enemy.vx * dt, enemy.vy * dt);
      if (moved.hitX) enemy.vx = 0;
      if (moved.hitY) enemy.vy = 0;
      if (enemy.kind === "skeleton" && enemy.cooldown <= 0 && Math.abs(dx) < 460) {
        enemy.cooldown = 2.4;
        launchProjectile(game, enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.35, dx, dy, enemy.damage * 0.85, "bone", 245);
      }
    }
    if (enemy.kind !== "boss" && enemy.cooldown < 0 && Math.hypot(dx, dy) < (enemy.kind === "skeleton" ? 50 : 42)) enemy.cooldown = 0.7;
    if (enemy.kind !== "boss" && Math.abs(dx) < (player.w + enemy.w) / 2 + 2 && Math.abs(dy) < (player.h + enemy.h) / 2 && player.invulnerable <= 0) {
      hurtPlayer(game, enemy.damage, enemy.x + enemy.w / 2);
      enemy.vx = -Math.sign(dx) * 130;
    }
    if (enemy.hp <= 0) killEnemy(game, enemy);
  }
  game.entities = game.entities.filter((enemy) => !enemy.dead && (enemy.kind === "boss" || Math.abs(enemy.x - player.x) < 1750));
}

function updateBoss(game: GameState, boss: Enemy, dx: number, dy: number, dt: number) {
  const index = boss.bossIndex ?? 0;
  boss.phase += dt;
  const player = game.player;
  if (boss.telegraph > 0) {
    // The short tell leaves a readable dodge window before every attack.
  } else if (boss.cooldown <= 0) {
    boss.cooldown = index === 4 ? 1.8 : index === 2 ? 2.2 : 2.55;
    boss.telegraph = 0.62;
    boss.attackKind = Math.floor(game.rng() * 3);
    game.events.push("tell");
  }
  if (index === 0) {
    const targetX = player.x + dx * 0.28;
    const targetY = player.y - 85 + Math.sin(boss.phase * 2.3) * 32;
    boss.vx += (clamp(targetX - boss.x, -190, 190) - boss.vx) * Math.min(1, dt * 2.5);
    boss.vy += (clamp(targetY - boss.y, -170, 170) - boss.vy) * Math.min(1, dt * 2.3);
    boss.x += boss.vx * dt; boss.y += boss.vy * dt;
    if (boss.telegraph <= 0 && boss.cooldown < 0.08) boss.vy = Math.sign(dy) * 230;
  } else if (index === 2 || index === 4) {
    const targetX = player.x + dx * 0.32 + Math.sin(boss.phase) * 80;
    const targetY = player.y - 95 + Math.sin(boss.phase * 1.5) * 26;
    boss.vx += (clamp(targetX - boss.x, -210, 210) - boss.vx) * Math.min(1, dt * 1.8);
    boss.vy += (clamp(targetY - boss.y, -130, 130) - boss.vy) * Math.min(1, dt * 1.7);
    boss.x += boss.vx * dt; boss.y += boss.vy * dt;
  } else {
    const desired = Math.sign(dx) * (index === 1 ? 56 : 82);
    boss.vx += (desired - boss.vx) * Math.min(1, dt * 2.2);
    boss.vy = Math.min(boss.vy + 1000 * dt, 600);
    const moved = moveActor(game.world, boss, boss.vx * dt, boss.vy * dt);
    if (moved.hitX) boss.vx *= -0.5;
  }
  boss.x = clamp(boss.x, 20, game.world.width * TILE - boss.w - 20);
  boss.y = clamp(boss.y, 10, game.world.height * TILE - boss.h - 5);
  if (boss.telegraph <= 0 && boss.cooldown > 1.4 && boss.cooldown < 1.48) {
    const px = boss.x + boss.w / 2; const py = boss.y + boss.h / 2;
    if (index === 0) {
      launchProjectile(game, px, py, dx, dy, boss.damage * 0.8, "gloam", 245);
      if (boss.attackKind === 2) { boss.vy = 250; }
    } else if (index === 1) {
      for (const spread of [-0.22, 0, 0.22]) launchProjectile(game, px, py, dx + spread * 250, dy, boss.damage * 0.72, "bone", 260);
    } else if (index === 2) {
      launchProjectile(game, px, py, dx, dy, boss.damage * 0.8, "ember", 205);
      boss.vx = Math.sign(dx) * 220;
    } else if (index === 3) {
      launchProjectile(game, px, py, dx - 100, dy, boss.damage * 0.65, "ember", 190);
      launchProjectile(game, px, py, dx + 100, dy, boss.damage * 0.65, "ember", 190);
      if (boss.attackKind === 2) boss.vy = -420;
    } else {
      for (const spread of [-0.3, -0.12, 0.12, 0.3]) launchProjectile(game, px, py, dx + spread * 300, dy, boss.damage * 0.68, "star", 250);
    }
    game.events.push("bossAttack");
  }
  if (player.invulnerable <= 0 && Math.abs(dx) < (player.w + boss.w) / 2 && Math.abs(dy) < (player.h + boss.h) / 2) hurtPlayer(game, boss.damage * 0.82, boss.x + boss.w / 2);
}

function launchProjectile(game: GameState, x: number, y: number, dx: number, dy: number, damage: number, kind: string, speed: number) {
  const length = Math.max(1, Math.hypot(dx, dy));
  game.projectiles.push({ x, y, vx: dx / length * speed, vy: dy / length * speed, damage, life: 4, owner: "enemy", kind, radius: kind === "star" ? 7 : 6 });
}

function updateProjectiles(game: GameState, dt: number) {
  for (const projectile of game.projectiles) {
    projectile.life -= dt;
    if (projectile.kind === "arrow" && projectile.owner === "player") projectile.vy += 260 * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (solid(game.world, Math.floor(projectile.x / TILE), Math.floor(projectile.y / TILE))) {
      projectile.life = 0;
      burst(game, projectile.x, projectile.y, projectile.kind === "star" ? "#d3b4ff" : "#f0bd80", 3);
      continue;
    }
    if (projectile.owner === "enemy") {
      const p = game.player;
      if (p.invulnerable <= 0 && Math.hypot(projectile.x - (p.x + p.w / 2), projectile.y - (p.y + p.h / 2)) < projectile.radius + 13) {
        hurtPlayer(game, projectile.damage, projectile.x);
        projectile.life = 0;
      }
    } else {
      const enemy = game.entities.find((target) => !target.dead && projectile.x > target.x - 8 && projectile.x < target.x + target.w + 8 && projectile.y > target.y - 6 && projectile.y < target.y + target.h + 6);
      if (enemy) {
        enemy.hp -= projectile.damage;
        enemy.flash = 0.16;
        game.stats.damage += projectile.damage;
        addText(game, enemy.x + enemy.w / 2, enemy.y, `${projectile.damage}`, "#fae4b5");
        projectile.life = 0;
        game.events.push("hit");
        if (enemy.hp <= 0) killEnemy(game, enemy);
      }
    }
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
}

function hurtPlayer(game: GameState, amount: number, sourceX = game.player.x + game.player.w / 2 - 1) {
  const p = game.player;
  if (p.invulnerable > 0) return;
  const ward = game.wardTimer > 0 ? 0.58 : 1;
  const dealt = Math.max(2, Math.round(amount * DIFFICULTIES[game.difficulty].damage * ward - p.defense * 0.65));
  p.hp = Math.max(0, p.hp - dealt);
  p.invulnerable = 0.78;
  p.vy = -190;
  p.knockback = Math.sign(p.x + p.w / 2 - sourceX) * 210;
  game.shake = Math.max(game.shake, 6.5);
  game.combo = 0;
  addText(game, p.x + p.w / 2, p.y - 8, `-${dealt}`, "#ff827e");
  burst(game, p.x + p.w / 2, p.y + p.h / 2, "#ff716d", 10);
  game.events.push("hurt");
}

function killEnemy(game: GameState, enemy: Enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  game.stats.kills++;
  game.combo += 1;
  game.comboTimer = 2.2;
  game.stats.peakCombo = Math.max(game.stats.peakCombo, game.combo);
  game.shake = Math.max(game.shake, enemy.kind === "boss" ? 9 : 2.6);
  burst(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.kind === "boss" ? "#ffd18c" : enemyColor(enemy.kind), enemy.kind === "boss" ? 48 : 14);
  addText(game, enemy.x + enemy.w / 2, enemy.y - 10, game.combo > 2 ? `${game.combo}x CHAIN` : "DOWN", "#f3d495");
  if (enemy.kind === "boss") {
    const i = enemy.bossIndex ?? 0;
    game.bosses[i] = true;
    game.bossActive = false;
    game.inventory.moonshard += 7 + i * 2;
    game.runShards += 7 + i * 2;
    if (i === 0) game.inventory.lens = (game.inventory.lens ?? 0) + 1;
    if (i === 2) { game.inventory.abyss_core = (game.inventory.abyss_core ?? 0) + 1; awakenHardmode(game); }
    if (i === 3) game.inventory.titan_heart = (game.inventory.titan_heart ?? 0) + 1;
    if (i === 4) game.inventory.star_core = (game.inventory.star_core ?? 0) + 1;
    say(game, i === 2 ? "THE OLD DEEP BREAKS OPEN. Hardmode has awakened." : `${BOSS_INFO[i].name} has fallen. The world remembers.`);
    game.bossLabel = i === 2 ? "HARDMODE AWAKENED" : `${BOSS_INFO[i].name.toUpperCase()} DEFEATED`;
    game.bossLabelTimer = 5;
    game.events.push("bossDown");
    if (i === 4) game.events.push("victory");
    return;
  }
  const loot: Record<string, [string, number, number][]> = {
    slime: [["coin", 2, 0.88], ["mushroom", 1, 0.26]],
    bat: [["coin", 3, 0.82], ["moonshard", 1, 0.12]],
    crawler: [["coin", 4, 0.88], ["copper_ore", 1, 0.35]],
    skeleton: [["bone", 1, 1], ["coin", 4, 0.88], ["iron_ore", 1, 0.28]],
    wisp: [["moonshard", 1, 0.32], ["crystal_ore", 1, 0.65]],
    starling: [["moonshard", 2, 1], ["star_ore", 1, 0.7]],
  };
  (loot[enemy.kind] ?? loot.slime).forEach(([item, amount, chance]) => {
    const salvage = game.difficulty === "hardcore" && item === "coin" ? Math.ceil(amount * 1.5) : amount;
    const bonusChance = game.meta.fortune * 0.035 + (game.difficulty === "hardcore" && item === "moonshard" ? 0.12 : 0);
    if (game.rng() < Math.min(0.98, chance + bonusChance)) spawnDrop(game, item, salvage, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
  });
  if (game.invasion.active) {
    game.invasion.kills++;
    if (game.invasion.kills >= game.invasion.goal) finishInvasion(game);
  }
  game.events.push("kill");
}

function awakenHardmode(game: GameState) {
  if (game.hardmode) return;
  game.hardmode = true;
  const rng = game.rng;
  for (let i = 0; i < 95; i++) {
    const x = 5 + Math.floor(rng() * (game.world.width - 10));
    const depth = 28 + Math.floor(rng() * 27);
    const y = Math.min(game.world.height - 3, game.world.surface[x] + depth);
    const ore = depth > 43 && rng() < 0.36 ? "star_ore" : "soul_ore";
    for (let n = 0; n < 4; n++) {
      const ox = x + Math.floor(rng() * 5) - 2; const oy = y + Math.floor(rng() * 5) - 2;
      if (game.world.tiles[oy]?.[ox] === "stone") game.world.tiles[oy][ox] = ore;
    }
  }
  game.stats.visited.push("Ember Veins");
}

function finishInvasion(game: GameState) {
  game.invasion.active = false;
  game.invasion.cooldown = 150;
  game.inventory.moonshard += 8;
  game.runShards += 8;
  game.inventory.coin += 35;
  say(game, "Rootfall repelled. The grove leaves you a bright reward.");
  game.bossLabel = "ROOTFALL REPELLED";
  game.bossLabelTimer = 4;
  game.events.push("victoryChime");
}

function updateInvasion(game: GameState, dt: number) {
  if (!game.invasion.active) return;
  game.invasion.timer -= dt;
  game.invasion.spawnTimer -= dt;
  if (game.invasion.spawnTimer <= 0 && game.entities.filter((enemy) => enemy.kind !== "boss" && !enemy.dead).length < 16) {
    spawnEnemy(game);
    game.invasion.spawnTimer = 1.1 + game.rng() * 0.8;
  }
  if (game.invasion.timer <= 0) {
    game.invasion.active = false;
    game.invasion.cooldown = 130;
    say(game, "The Rootfall fades back into the trees.");
  }
}

function spawnDrop(game: GameState, item: string, amount: number, x: number, y: number) {
  game.drops.push({ item, amount, x, y, vx: (game.rng() - 0.5) * 95, vy: -85 - game.rng() * 70, life: 42 + game.meta.fortune * 10, phase: game.rng() * 6 });
}

function updateDrops(game: GameState, dt: number) {
  for (const drop of game.drops) {
    drop.life -= dt;
    drop.phase += dt * 2.5;
    const dx = game.player.x + game.player.w / 2 - drop.x;
    const dy = game.player.y + game.player.h / 2 - drop.y;
    const distance = Math.hypot(dx, dy);
    const magnetRange = 62 + game.meta.fortune * 22;
    if (distance < magnetRange) {
      drop.vx += (dx / Math.max(1, distance) * 300 - drop.vx) * Math.min(1, dt * 5);
      drop.vy += (dy / Math.max(1, distance) * 300 - drop.vy) * Math.min(1, dt * 5);
    } else {
      drop.vy = Math.min(drop.vy + 480 * dt, 360);
      drop.vx *= Math.pow(0.2, dt);
    }
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    if (solid(game.world, Math.floor(drop.x / TILE), Math.floor((drop.y + 5) / TILE))) { drop.y = Math.floor(drop.y / TILE) * TILE + 13; drop.vy *= -0.2; }
    if (distance < 26) {
      game.inventory[drop.item] = (game.inventory[drop.item] ?? 0) + drop.amount;
      game.stats.items += drop.amount;
      if (drop.item === "moonshard") game.runShards += drop.amount;
      if (drop.item === "healing_tonic" && game.player.hp < game.player.maxHp * 0.55) { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 12); }
      game.events.push("pickup");
      addText(game, drop.x, drop.y - 10, `+${drop.amount} ${ITEM_INFO[drop.item]?.name ?? drop.item}`, drop.item === "moonshard" ? "#b4c6ff" : "#f4d89f");
      drop.life = 0;
    }
  }
  game.drops = game.drops.filter((drop) => drop.life > 0);
}

function updateEffects(game: GameState, dt: number) {
  for (const part of game.particles) {
    part.life -= dt;
    part.x += part.vx * dt; part.y += part.vy * dt;
    part.vy += 220 * dt;
    part.vx *= Math.pow(0.22, dt);
  }
  game.particles = game.particles.filter((part) => part.life > 0);
  for (const text of game.texts) { text.life -= dt; text.y -= 25 * dt; }
  game.texts = game.texts.filter((text) => text.life > 0);
}

function burst(game: GameState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = game.rng() * Math.PI * 2;
    const speed = 28 + game.rng() * 180;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + game.rng() * 0.55, maxLife: 0.8, size: 2 + game.rng() * 4, color, shape: game.rng() > 0.68 ? "spark" : "square" });
  }
}

function addText(game: GameState, x: number, y: number, text: string, color: string) {
  game.texts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

function say(game: GameState, text: string) { game.toast = text; game.toastTimer = 3.6; }

export function useWard(game: GameState) {
  if (game.inventory.rift_ward <= 0) return { ok: false, message: "No rift wards in your pack." };
  game.inventory.rift_ward--;
  game.wardTimer = 28;
  say(game, "Rift ward raised. Incoming damage is reduced for 28 seconds.");
  return { ok: true, message: game.toast };
}

function tileColor(tile: string) {
  const colors: Record<string, string> = { dirt: "#8a6043", grass: "#7aa765", stone: "#a4a79d", copper_ore: "#dd8c50", iron_ore: "#cbd7d4", crystal_ore: "#68d8d1", soul_ore: "#f07664", star_ore: "#bd9dff", wood: "#95613f", leaves: "#5f9160", glow_mushroom: "#cb7bbf", wood_wall: "#785438", lantern: "#ffd479", platform: "#a77b4c" };
  return colors[tile] ?? "#c7c5a5";
}

function enemyColor(kind: string) {
  return ({ slime: "#9dbd70", bat: "#9c8ed0", crawler: "#bb8863", skeleton: "#d8d0aa", wisp: "#ff9b6e", starling: "#c0a3ff" } as Record<string, string>)[kind] ?? "#f2d0a0";
}

function hashNoise(x: number, y: number) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

export function drawGame(ctx: CanvasRenderingContext2D, game: GameState, width: number, height: number, title = false) {
  if (!width || !height) return;
  const dpr = window.devicePixelRatio || 1;
  if (ctx.canvas.width !== Math.round(width * dpr) || ctx.canvas.height !== Math.round(height * dpr)) {
    ctx.canvas.width = Math.round(width * dpr); ctx.canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const camera = game.camera;
  const shakeX = title ? Math.sin(Date.now() / 800) * 1 : game.shake > 0.4 ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = title ? Math.cos(Date.now() / 1000) * 1 : game.shake > 0.4 ? (Math.random() - 0.5) * game.shake : 0;
  const camX = camera.x + shakeX;
  const camY = camera.y + shakeY;
  const daylight = game.dayClock % 1;
  const isNight = daylight >= 0.56 && daylight < 0.93;
  const surfaceY = game.world.surface[clamp(Math.floor((camX + width / 2) / TILE), 0, game.world.width - 1)] * TILE - camY;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  if (daylight < 0.52) {
    sky.addColorStop(0, "#78a7a0"); sky.addColorStop(0.48, "#c3c6a0"); sky.addColorStop(1, "#d2b78d");
  } else if (daylight < 0.68) {
    sky.addColorStop(0, "#342b4c"); sky.addColorStop(0.56, "#b36f63"); sky.addColorStop(1, "#d19a6d");
  } else if (daylight < 0.93) {
    sky.addColorStop(0, "#10192d"); sky.addColorStop(0.6, "#202b43"); sky.addColorStop(1, "#4b4253");
  } else {
    sky.addColorStop(0, "#25384a"); sky.addColorStop(0.55, "#b2776b"); sky.addColorStop(1, "#cfab7f");
  }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  drawSkyDetails(ctx, game, width, height, camX, surfaceY, isNight);

  const minX = Math.max(0, Math.floor(camX / TILE) - 1);
  const maxX = Math.min(game.world.width - 1, Math.ceil((camX + width) / TILE) + 1);
  const minY = Math.max(0, Math.floor(camY / TILE) - 1);
  const maxY = Math.min(game.world.height - 1, Math.ceil((camY + height) / TILE) + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const sx = Math.floor(x * TILE - camX); const sy = Math.floor(y * TILE - camY);
      const tile = game.world.tiles[y][x];
      const wall = game.world.walls[y][x];
      if (wall) {
        ctx.fillStyle = wall === "wood_wall" ? "#513e36" : y > game.world.surface[x] + 27 ? "#182d37" : "#25333a";
        ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = wall === "wood_wall" ? "rgba(187,137,85,.12)" : "rgba(170,190,175,.05)";
        ctx.fillRect(sx + 3, sy + 3, TILE - 6, 1); ctx.fillRect(sx + 3, sy + 3, 1, TILE - 6);
      } else if (y > game.world.surface[x] + 2 && tile === "air") {
        const zone = game.depth > 40 ? "#261f36" : game.depth > 26 ? "#1c343b" : "#253239";
        ctx.fillStyle = zone; ctx.fillRect(sx, sy, TILE, TILE);
      }
      if (tile !== "air") drawTile(ctx, tile, sx, sy, x, y, daylight);
    }
  }
  drawHomes(ctx, game, camX, camY);
  drawDrops(ctx, game, camX, camY);

  const underground = game.depth > 5;
  if (underground || isNight) {
    const alpha = underground ? Math.min(0.72, 0.36 + (game.depth - 5) / 150) : daylight > 0.68 ? 0.27 : 0.13;
    const px = game.player.x - camX + game.player.w / 2;
    const py = game.player.y - camY + game.player.h / 2;
    const radius = 120 + (game.inventory.torch ? 28 : 0) + (game.wardTimer > 0 ? 20 : 0);
    const light = ctx.createRadialGradient(px, py, 36, px, py, Math.max(width, height) * 0.86);
    light.addColorStop(0, "rgba(7,12,23,0)"); light.addColorStop(Math.min(0.45, radius / Math.max(width, height)), `rgba(7,12,23,${alpha * 0.18})`); light.addColorStop(1, `rgba(7,12,23,${alpha})`);
    ctx.fillStyle = light; ctx.fillRect(0, 0, width, height);
  }
  for (const enemy of game.entities) drawEnemy(ctx, enemy, camX, camY, game);
  drawProjectiles(ctx, game, camX, camY);
  drawPlayer(ctx, game, camX, camY);
  drawParticles(ctx, game, camX, camY);
  drawTexts(ctx, game, camX, camY);
  drawTarget(ctx, game, camX, camY);
  drawForeground(ctx, game, width, height, camX, camY, minX, maxX);
}

function drawSkyDetails(ctx: CanvasRenderingContext2D, game: GameState, width: number, height: number, camX: number, surfaceY: number, isNight: boolean) {
  const seed = game.world.seed;
  if (isNight) {
    for (let i = 0; i < 68; i++) {
      const x = (hashNoise(i, seed) * width + (game.elapsed * (i % 3 + 1) * 0.6)) % width;
      const y = hashNoise(i + 72, seed) * Math.max(80, Math.min(surfaceY, height * 0.7));
      ctx.fillStyle = `rgba(236,233,196,${0.22 + hashNoise(i, 14) * 0.58})`;
      ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
    }
    ctx.fillStyle = "#ebe6c4"; ctx.beginPath(); ctx.arc(width * 0.78, 82, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(21,31,48,.4)"; ctx.beginPath(); ctx.arc(width * 0.78 + 9, 76, 17, 0, Math.PI * 2); ctx.fill();
  } else {
    const sx = ((game.elapsed * 4 + width * 0.7) % (width + 200)) - 100;
    ctx.fillStyle = "rgba(255,224,155,.68)"; ctx.beginPath(); ctx.arc(sx, 105, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,225,175,.16)"; ctx.beginPath(); ctx.arc(sx, 105, 46, 0, Math.PI * 2); ctx.fill();
  }
  const ridge = (base: number, color: string, shift: number, amp: number) => {
    ctx.beginPath(); ctx.moveTo(0, height);
    for (let x = 0; x <= width + 20; x += 20) {
      const wx = x + camX * shift;
      const peak = base + Math.sin(wx * 0.0027) * amp + Math.sin(wx * 0.006) * amp * 0.28;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(width, height); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  ridge(Math.min(height * 0.59, surfaceY - 35), isNight ? "#273341" : "#839184", 0.12, 34);
  ridge(Math.min(height * 0.67, surfaceY - 4), isNight ? "#202c34" : "#657b6a", 0.22, 23);
  if (surfaceY > 0) {
    const trees = Math.ceil(width / 80) + 4;
    for (let i = 0; i < trees; i++) {
      const tx = ((i * 93 - camX * 0.35) % (width + 160) + width + 160) % (width + 160) - 80;
      const th = 42 + hashNoise(i + seed, 9) * 46;
      ctx.fillStyle = isNight ? "#233333" : "#496b54";
      ctx.beginPath(); ctx.moveTo(tx, surfaceY); ctx.lineTo(tx + 18, surfaceY - th); ctx.lineTo(tx + 38, surfaceY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = isNight ? "#1a2c2d" : "#3e6049";
      ctx.fillRect(tx + 17, surfaceY - th * 0.38, 4, th * 0.4);
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, tile: string, x: number, y: number, tx: number, ty: number, daylight: number) {
  const colors: Record<string, string> = {
    grass: "#6f9b5d", dirt: "#806047", stone: "#717b78", copper_ore: "#80624e", iron_ore: "#747d80", crystal_ore: "#316971", soul_ore: "#673e4b", star_ore: "#544b78",
    wood: "#795039", leaves: "#47784e", platform: "#926a47", altar: "#776148", workbench: "#785339", forge: "#56565a", water: "rgba(80,157,181,.75)", glow_mushroom: "rgba(174,92,169,.45)",
    lantern: "#5f5240", chest: "#9e733e", open_chest: "#695437",
  };
  if (tile === "water") { ctx.fillStyle = colors[tile]; ctx.fillRect(x, y + 7, TILE, TILE - 7); ctx.fillStyle = "rgba(188,226,220,.5)"; ctx.fillRect(x + 4, y + 8, 12, 2); return; }
  if (tile === "glow_mushroom") {
    const glow = ctx.createRadialGradient(x + 16, y + 18, 1, x + 16, y + 18, 22);
    glow.addColorStop(0, "rgba(238,126,218,.34)"); glow.addColorStop(1, "rgba(238,126,218,0)");
    ctx.fillStyle = glow; ctx.fillRect(x - 5, y - 5, TILE + 10, TILE + 10);
    ctx.fillStyle = "#c687cf"; ctx.fillRect(x + 11, y + 16, 9, 10); ctx.fillStyle = "#edafd9"; ctx.fillRect(x + 7, y + 13, 17, 6); ctx.fillStyle = "#765885"; ctx.fillRect(x + 11, y + 24, 9, 4); return;
  }
  ctx.fillStyle = colors[tile] ?? "#7a6047";
  ctx.fillRect(x, y, TILE, TILE);
  if (tile === "grass") { ctx.fillStyle = "#91bc6a"; ctx.fillRect(x, y, TILE, 5); ctx.fillStyle = "#658951"; ctx.fillRect(x, y + 6, TILE, 2); }
  if (tile === "dirt" || tile === "stone") {
    for (let i = 0; i < 4; i++) {
      const nx = hashNoise(tx * 5 + i, ty * 2 + i);
      ctx.fillStyle = tile === "dirt" ? (i % 2 ? "rgba(197,147,94,.19)" : "rgba(42,35,31,.2)") : "rgba(218,223,207,.11)";
      ctx.fillRect(x + 3 + nx * 22, y + 5 + hashNoise(tx + i, ty + i) * 22, 2 + i % 2, 2);
    }
  }
  if (tile.includes("ore")) {
    const ore = tile === "copper_ore" ? "#e69a57" : tile === "iron_ore" ? "#d5e2df" : tile === "crystal_ore" ? "#80eee2" : tile === "soul_ore" ? "#ff9075" : "#d1aaff";
    ctx.fillStyle = ore; ctx.fillRect(x + 8, y + 7, 5, 5); ctx.fillRect(x + 18, y + 16, 7, 6); ctx.fillRect(x + 5, y + 24, 4, 4);
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x + 10, y + 7, 2, 2);
  }
  if (tile === "wood") { ctx.fillStyle = "#a17048"; ctx.fillRect(x + 5, y, 3, TILE); ctx.fillRect(x + 23, y, 2, TILE); ctx.fillStyle = "rgba(35,24,20,.25)"; ctx.fillRect(x + 12, y, 2, TILE); }
  if (tile === "leaves") {
    ctx.fillStyle = "rgba(145,191,102,.8)"; ctx.fillRect(x + 4, y + 5, 12, 9); ctx.fillRect(x + 16, y + 18, 12, 9);
    ctx.fillStyle = "rgba(32,68,48,.3)"; ctx.fillRect(x + 19, y + 4, 8, 8);
  }
  if (tile === "platform") { ctx.fillStyle = "#c19761"; ctx.fillRect(x, y, TILE, 7); ctx.fillStyle = "#5c422e"; ctx.fillRect(x, y + 8, TILE, 3); }
  if (tile === "altar") { ctx.fillStyle = "#dfb36e"; ctx.fillRect(x + 4, y + 7, 24, 7); ctx.fillStyle = "#463c47"; ctx.fillRect(x + 7, y + 14, 18, 14); ctx.fillStyle = "#b79978"; ctx.fillRect(x + 9, y + 17, 14, 2); ctx.fillStyle = "#93dbd5"; ctx.fillRect(x + 14, y + 19, 4, 6); }
  if (tile === "workbench") { ctx.fillStyle = "#d4a56b"; ctx.fillRect(x + 2, y + 8, 28, 6); ctx.fillStyle = "#60422f"; ctx.fillRect(x + 5, y + 14, 4, 14); ctx.fillRect(x + 23, y + 14, 4, 14); ctx.fillStyle = "#edc88a"; ctx.fillRect(x + 5, y + 8, 7, 2); }
  if (tile === "forge") { ctx.fillStyle = "#92918a"; ctx.fillRect(x + 4, y + 12, 24, 16); ctx.fillStyle = "#3b4144"; ctx.fillRect(x + 9, y + 17, 14, 11); ctx.fillStyle = "#ff9a58"; ctx.fillRect(x + 12, y + 20, 8, 5); }
  if (tile === "lantern") { const glow = ctx.createRadialGradient(x + 16, y + 12, 2, x + 16, y + 12, 26); glow.addColorStop(0, "rgba(255,208,110,.36)"); glow.addColorStop(1, "rgba(255,208,110,0)"); ctx.fillStyle = glow; ctx.fillRect(x - 10, y - 10, TILE + 20, TILE + 20); ctx.fillStyle = "#be8851"; ctx.fillRect(x + 14, y + 14, 4, 12); ctx.fillStyle = "#ffdb83"; ctx.fillRect(x + 11, y + 5, 10, 12); ctx.fillStyle = "#fff2c2"; ctx.fillRect(x + 14, y + 7, 4, 8); }
  if (tile === "chest" || tile === "open_chest") { ctx.fillStyle = "#c0914b"; ctx.fillRect(x + 4, y + 12, 24, 15); ctx.fillStyle = "#76502f"; ctx.fillRect(x + 4, y + 12, 24, 4); ctx.fillStyle = "#e3c078"; ctx.fillRect(x + 14, y + 17, 5, 6); if (tile === "open_chest") { ctx.fillStyle = "#9b7142"; ctx.fillRect(x + 3, y + 5, 25, 6); } }
  if (tile === "door") { ctx.fillStyle = "#8e6342"; ctx.fillRect(x + 7, y + 2, 18, 29); ctx.fillStyle = "#e7ba70"; ctx.fillRect(x + 20, y + 15, 2, 2); }
  if (tile === "stone" && daylight > 0.7) { ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillRect(x, y, TILE, 2); }
}

function drawHomes(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  const names = ["MOSS", "PIP", "NIMA", "SOL"];
  game.world.homes.forEach((home, index) => {
    const x = (home.x + 3) * TILE - camX;
    const y = (home.y + 6) * TILE - camY;
    if (x < -120 || x > game.viewport.width + 120) return;
    const bob = Math.sin(game.elapsed * 1.7 + index) * 2;
    ctx.fillStyle = "#d6b184"; ctx.fillRect(x - 7, y - 24 + bob, 14, 22);
    ctx.fillStyle = ["#607e54", "#9e8056", "#718395", "#8e6d9b"][index]; ctx.fillRect(x - 8, y - 13 + bob, 16, 12);
    ctx.fillStyle = "#4b3930"; ctx.fillRect(x - 8, y - 26 + bob, 16, 7);
    ctx.fillStyle = "rgba(246,232,195,.88)"; ctx.font = "9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(names[index], x, y - 32 + bob);
  });
}

function drawDrops(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  for (const drop of game.drops) {
    const x = drop.x - camX; const y = drop.y - camY + Math.sin(drop.phase) * 3;
    const color = ITEM_INFO[drop.item]?.color ?? "#e7d2a0";
    ctx.fillStyle = color; ctx.shadowBlur = 12; ctx.shadowColor = color;
    ctx.fillRect(Math.round(x - 5), Math.round(y - 5), 10, 10);
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(Math.round(x - 3), Math.round(y - 4), 3, 2);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, camX: number, camY: number, game: GameState) {
  const x = Math.round(enemy.x - camX); const y = Math.round(enemy.y - camY);
  const color = enemy.kind === "boss" ? BOSS_INFO[enemy.bossIndex ?? 0].color : enemyColor(enemy.kind);
  if (enemy.kind === "boss") {
    if (enemy.telegraph > 0) { ctx.fillStyle = `rgba(255,103,95,${0.22 + Math.sin(Date.now() / 55) * 0.12})`; ctx.fillRect(x - 18, y - 15, enemy.w + 36, enemy.h + 30); }
    ctx.shadowBlur = 18; ctx.shadowColor = color;
    if (enemy.bossIndex === 0) {
      ctx.fillStyle = enemy.flash ? "#fff7dc" : "#d77b72"; ctx.beginPath(); ctx.ellipse(x + enemy.w / 2, y + enemy.h / 2, enemy.w * 0.47, enemy.h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f6ead1"; ctx.beginPath(); ctx.arc(x + enemy.w / 2, y + enemy.h / 2, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#492d42"; ctx.beginPath(); ctx.arc(x + enemy.w / 2 + Math.sin(enemy.phase) * 4, y + enemy.h / 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a1d31"; ctx.fillRect(x + 6, y + 8, 13, 4); ctx.fillRect(x + enemy.w - 19, y + 8, 13, 4);
    } else if (enemy.bossIndex === 1) {
      ctx.fillStyle = enemy.flash ? "#fff" : "#d6ca9f"; ctx.fillRect(x + 18, y + 18, enemy.w - 36, enemy.h - 18); ctx.fillRect(x + 8, y + 3, enemy.w - 16, 30);
      ctx.fillStyle = "#302b37"; ctx.fillRect(x + 18, y + 14, 7, 5); ctx.fillRect(x + enemy.w - 25, y + 14, 7, 5);
      ctx.fillStyle = "#cc615d"; ctx.fillRect(x + 10, y - 5, 6, 21); ctx.fillRect(x + enemy.w - 16, y - 5, 6, 21);
      ctx.fillStyle = "#7b674b"; ctx.fillRect(x + 17, y + enemy.h - 15, 12, 15); ctx.fillRect(x + enemy.w - 29, y + enemy.h - 15, 12, 15);
    } else if (enemy.bossIndex === 2) {
      ctx.fillStyle = enemy.flash ? "#fff" : "#bd6658"; ctx.beginPath(); ctx.ellipse(x + enemy.w / 2, y + enemy.h / 2, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#311f35"; ctx.fillRect(x + 18, y + 14, enemy.w - 36, enemy.h - 25); ctx.fillStyle = "#ffe0a1";
      for (let i = 0; i < 7; i++) ctx.fillRect(x + 20 + i * 14, y + 14, 5, 8);
      ctx.fillStyle = "#ffbe71"; ctx.fillRect(x + 18, y + enemy.h - 9, enemy.w - 36, 3);
    } else if (enemy.bossIndex === 3) {
      ctx.fillStyle = enemy.flash ? "#fff" : "#da7650"; ctx.fillRect(x + 10, y + 18, enemy.w - 20, enemy.h - 23);
      ctx.fillStyle = "#ffb35e"; ctx.fillRect(x + 22, y + 4, enemy.w - 44, 23); ctx.fillRect(x - 4, y + 34, 18, 22); ctx.fillRect(x + enemy.w - 14, y + 34, 18, 22);
      ctx.fillStyle = "#432b34"; ctx.fillRect(x + 28, y + 14, 6, 6); ctx.fillRect(x + enemy.w - 34, y + 14, 6, 6); ctx.fillStyle = "#ffdc8a"; ctx.fillRect(x + enemy.w / 2 - 3, y + 27, 6, 13);
    } else {
      ctx.fillStyle = enemy.flash ? "#fff" : "#8176bd"; ctx.fillRect(x + 24, y + 22, enemy.w - 48, enemy.h - 28);
      for (let i = 0; i < 3; i++) {
        const hx = x + 8 + i * (enemy.w - 16) / 2;
        const hy = y + 5 + Math.sin(enemy.phase * 2 + i * 2) * 7;
        ctx.fillStyle = i % 2 ? "#ad9be8" : "#9788dc"; ctx.beginPath(); ctx.ellipse(hx, hy + 16, 16, 23, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f6df9b"; ctx.fillRect(hx - 5, hy + 11, 3, 4); ctx.fillRect(hx + 3, hy + 11, 3, 4);
      }
    }
    ctx.shadowBlur = 0;
    const barW = Math.max(120, Math.min(270, game.viewport.width * 0.3));
    const barX = (game.viewport.width - barW) / 2; const barY = 22;
    ctx.fillStyle = "rgba(14,18,23,.86)"; ctx.fillRect(barX, barY, barW, 13);
    ctx.fillStyle = color; ctx.fillRect(barX + 2, barY + 2, (barW - 4) * Math.max(0, enemy.hp / enemy.maxHp), 9);
    ctx.strokeStyle = "rgba(255,236,200,.78)"; ctx.strokeRect(barX, barY, barW, 13);
    ctx.fillStyle = "#fff0d0"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(BOSS_INFO[enemy.bossIndex ?? 0].name.toUpperCase(), game.viewport.width / 2, barY - 5);
    return;
  }
  ctx.shadowBlur = enemy.kind === "wisp" || enemy.kind === "starling" ? 14 : 0; ctx.shadowColor = color;
  ctx.fillStyle = enemy.flash ? "#fff6df" : color;
  if (enemy.kind === "slime") {
    const squish = 1 + Math.sin(enemy.phase + Date.now() / 200) * 0.08;
    ctx.fillRect(x + 2, y + enemy.h * (1 - squish), enemy.w - 4, enemy.h * squish);
    ctx.fillStyle = "#243b3b"; ctx.fillRect(x + 7, y + 9, 3, 4); ctx.fillRect(x + 19, y + 9, 3, 4);
  } else if (enemy.kind === "bat") {
    ctx.fillRect(x + 7, y + 6, enemy.w - 14, enemy.h - 8); ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x - 5, y + Math.sin(enemy.phase * 4) * 9); ctx.lineTo(x + 8, y + 18); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + enemy.w - 8, y + 12); ctx.lineTo(x + enemy.w + 5, y + Math.sin(enemy.phase * 4) * 9); ctx.lineTo(x + enemy.w - 8, y + 18); ctx.fill();
    ctx.fillStyle = "#f0ca8a"; ctx.fillRect(x + 9, y + 9, 3, 3); ctx.fillRect(x + enemy.w - 12, y + 9, 3, 3);
  } else if (enemy.kind === "skeleton") {
    ctx.fillRect(x + 5, y + 2, enemy.w - 10, 16); ctx.fillRect(x + 7, y + 17, enemy.w - 14, 18); ctx.fillStyle = "#3f3940"; ctx.fillRect(x + 9, y + 8, 3, 4); ctx.fillRect(x + enemy.w - 12, y + 8, 3, 4); ctx.fillStyle = "#ddd1b0"; ctx.fillRect(x + 7, y + 34, 4, 5); ctx.fillRect(x + enemy.w - 11, y + 34, 4, 5);
  } else if (enemy.kind === "crawler") {
    ctx.fillRect(x + 1, y + 7, enemy.w - 2, enemy.h - 8); ctx.fillStyle = "#453c3a"; ctx.fillRect(x + 8, y + 7, 4, 4); ctx.fillRect(x + 21, y + 7, 4, 4);
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 7, y + enemy.h - 3, 2, 6);
  } else {
    ctx.beginPath(); ctx.arc(x + enemy.w / 2, y + enemy.h / 2, enemy.w * 0.48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy.kind === "starling" ? "#f8df9a" : "#492d46"; ctx.fillRect(x + 7, y + 11, 4, 4); ctx.fillRect(x + enemy.w - 11, y + 11, 4, 4);
  }
  ctx.shadowBlur = 0;
  if (enemy.hp < enemy.maxHp) { ctx.fillStyle = "rgba(25,22,25,.7)"; ctx.fillRect(x, y - 7, enemy.w, 3); ctx.fillStyle = color; ctx.fillRect(x, y - 7, enemy.w * Math.max(0, enemy.hp / enemy.maxHp), 3); }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  const colors: Record<string, string> = { bone: "#e6dcbe", ember: "#ff8b5f", star: "#d6b3ff", gloam: "#f1a69c", orb: "#b8a0e7", arrow: "#ead8a8" };
  for (const projectile of game.projectiles) {
    const x = projectile.x - camX; const y = projectile.y - camY;
    const color = colors[projectile.kind] ?? "#efe0c1";
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    ctx.fillStyle = color; ctx.shadowBlur = 12; ctx.shadowColor = color;
    if (projectile.kind === "arrow") { ctx.fillRect(-11, -1, 20, 2); ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(16, 0); ctx.lineTo(10, 4); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  const p = game.player;
  const x = Math.round(p.x - camX); const y = Math.round(p.y - camY);
  const blinking = p.invulnerable > 0 && Math.floor(Date.now() / 65) % 2 === 0;
  if (blinking) return;
  const run = Math.abs(p.vx) > 5 && p.onGround ? Math.sin(game.elapsed * 17) * 2 : 0;
  ctx.fillStyle = "rgba(10,17,17,.25)"; ctx.fillRect(x - 5, y + p.h - 2, p.w + 10, 5);
  ctx.fillStyle = p.weaponTier >= 2 ? "#aebeb9" : "#cfac7c"; ctx.fillRect(x + 3, y + 10 + run, 14, 15);
  ctx.fillStyle = p.weaponTier >= 2 ? "#647f83" : "#5d7759"; ctx.fillRect(x + 2, y + 17 + run, 16, 9);
  ctx.fillStyle = "#d5ab7c"; ctx.fillRect(x + 4, y + 2 + run, 13, 12);
  ctx.fillStyle = "#40313a"; ctx.fillRect(x + (p.facing > 0 ? 13 : 5), y + 6 + run, 3, 3);
  ctx.fillStyle = p.weaponTier >= 2 ? "#d2d9ce" : "#574433"; ctx.fillRect(x + 4, y + 24 + run, 5, 7); ctx.fillRect(x + 12, y + 24 - run, 5, 7);
  ctx.fillStyle = "#46362d"; ctx.fillRect(x + 2, y + 29 + run, 7, 2); ctx.fillRect(x + 11, y + 29 - run, 7, 2);
  if (p.swing > 0) {
    const progress = 1 - p.swing / 0.2;
    ctx.save(); ctx.translate(x + p.w / 2, y + 16); ctx.rotate(p.facing * (-0.85 + progress * 1.9));
    ctx.fillStyle = p.weaponTier >= 2 ? "#e3eadb" : p.weaponTier === 1 ? "#dba36e" : "#c7c7b0"; ctx.fillRect(8, -3, p.weaponTier >= 2 ? 38 : 28, 5);
    ctx.fillStyle = "#79573d"; ctx.fillRect(4, -2, 8, 4); ctx.restore();
  } else if (p.bow) {
    ctx.strokeStyle = "#d2ba85"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + p.w / 2 + p.facing * 12, y + 16, 10, -1.1, 1.1); ctx.stroke();
  }
  if (game.wardTimer > 0) {
    ctx.strokeStyle = `rgba(166,139,255,${0.48 + Math.sin(Date.now() / 150) * 0.18})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 10, y + 15, 19, 23, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  for (const part of game.particles) {
    const alpha = Math.max(0, part.life / part.maxLife);
    ctx.globalAlpha = alpha; ctx.fillStyle = part.color;
    const x = part.x - camX; const y = part.y - camY;
    if (part.shape === "spark") { ctx.fillRect(x, y, part.size * 0.65, part.size * 2.2); }
    else if (part.shape === "ring") { ctx.strokeStyle = part.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, part.size * (1 + (1 - alpha)), 0, Math.PI * 2); ctx.stroke(); }
    else ctx.fillRect(x, y, part.size, part.size);
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  ctx.textAlign = "center"; ctx.font = "bold 12px ui-monospace, monospace";
  for (const text of game.texts) {
    ctx.globalAlpha = Math.min(1, text.life * 1.5); ctx.fillStyle = "rgba(20,20,26,.8)"; ctx.fillText(text.text, text.x - camX + 1, text.y - camY + 1);
    ctx.fillStyle = text.color; ctx.fillText(text.text, text.x - camX, text.y - camY);
  }
  ctx.globalAlpha = 1;
}

function drawTarget(ctx: CanvasRenderingContext2D, game: GameState, camX: number, camY: number) {
  const { x, y } = mouseTarget(game);
  if (x < 0 || y < 0 || x >= game.world.width || y >= game.world.height) return;
  const sx = x * TILE - camX; const sy = y * TILE - camY;
  const isReachable = targetInReach(game, x, y);
  ctx.strokeStyle = isReachable ? "rgba(252,224,155,.88)" : "rgba(222,231,211,.26)"; ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, TILE - 2, TILE - 2);
  if (game.mine.x === x && game.mine.y === y && game.mine.progress > 0) {
    const progress = clamp(game.mine.progress / 1.45, 0, 1);
    ctx.strokeStyle = "rgba(28,25,30,.82)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + 9, sy + 7); ctx.lineTo(sx + 16, sy + 16); ctx.lineTo(sx + 11, sy + 24); ctx.moveTo(sx + 22, sy + 4); ctx.lineTo(sx + 16, sy + 16); ctx.lineTo(sx + 26, sy + 24); ctx.stroke();
    ctx.fillStyle = "rgba(249,223,163,.78)"; ctx.fillRect(sx, sy + TILE - 3, TILE * progress, 3);
  }
}

function drawForeground(ctx: CanvasRenderingContext2D, game: GameState, width: number, height: number, camX: number, camY: number, minX: number, maxX: number) {
  for (let x = minX; x <= maxX; x++) {
    const y = game.world.surface[x] - 1;
    const tile = game.world.tiles[y]?.[x];
    if (tile === "leaves") {
      const sx = x * TILE - camX; const sy = y * TILE - camY;
      ctx.globalAlpha = 0.18; ctx.fillStyle = "#b2c992"; ctx.fillRect(sx + 5, sy + 7, 5, 4); ctx.globalAlpha = 1;
    }
  }
  if (game.toastTimer > 0 && game.toast) {
    const w = Math.min(width - 36, Math.max(280, game.toast.length * 7.1));
    ctx.globalAlpha = Math.min(1, game.toastTimer * 1.7);
    ctx.fillStyle = "rgba(14,22,23,.74)"; ctx.fillRect((width - w) / 2, height - 109, w, 30);
    ctx.strokeStyle = "rgba(221,190,129,.48)"; ctx.strokeRect((width - w) / 2, height - 109, w, 30);
    ctx.textAlign = "center"; ctx.font = "11px ui-monospace, monospace"; ctx.fillStyle = "#f0e3c4"; ctx.fillText(game.toast, width / 2, height - 90);
    ctx.globalAlpha = 1;
  }
}

export function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
