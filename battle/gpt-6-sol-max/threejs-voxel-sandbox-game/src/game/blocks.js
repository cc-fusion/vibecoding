export const B = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  LEAVES: 7,
  COBBLE: 8,
  PLANKS: 9,
  COAL_ORE: 10,
  IRON_ORE: 11,
  SNOW: 12,
  DRY_GRASS: 13,
  TORCH: 14,
  SLEEPING_ROLL: 15,
  CAMPFIRE: 16,
  CLAY: 17,
  GRAVEL: 18,
  BERRY_BUSH: 19,
});

export const BLOCKS = [
  { name: "Air", solid: false },
  { name: "Meadow grass", solid: true, hardness: 0.55, drop: "dirt", top: "grass", side: "grassSide", bottom: "dirt", color: "#88a96e" },
  { name: "Dirt", solid: true, hardness: 0.55, drop: "dirt", top: "dirt", color: "#997554" },
  { name: "Stone", solid: true, hardness: 2.2, drop: "cobble", tool: 1, top: "stone", color: "#87918b" },
  { name: "Sand", solid: true, hardness: 0.6, drop: "sand", top: "sand", color: "#ddc595" },
  { name: "Water", solid: false, liquid: true, color: "#6aadb7" },
  { name: "Oak log", solid: true, hardness: 1.25, drop: "log", top: "logTop", side: "logSide", bottom: "logTop", color: "#a8845e" },
  { name: "Leaves", solid: false, hardness: 0.28, drop: "leaves", top: "leaves", color: "#6f986d" },
  { name: "Cobblestone", solid: true, hardness: 1.65, drop: "cobble", tool: 1, top: "cobble", color: "#858d83" },
  { name: "Oak planks", solid: true, hardness: 0.85, drop: "planks", top: "planks", color: "#bb9a6b" },
  { name: "Coal ore", solid: true, hardness: 2.65, drop: "coal", tool: 2, top: "coalOre", color: "#616a66" },
  { name: "Iron ore", solid: true, hardness: 3.0, drop: "iron", tool: 2, top: "ironOre", color: "#a88970" },
  { name: "Snow", solid: true, hardness: 0.65, drop: "snow", top: "snow", side: "snowSide", bottom: "dirt", color: "#e4e8dd" },
  { name: "Dry grass", solid: true, hardness: 0.55, drop: "dirt", top: "dryGrass", side: "drySide", bottom: "dirt", color: "#b5a572" },
  { name: "Torch", solid: false, hardness: 0.2, drop: "torch", special: true, color: "#ffcb79" },
  { name: "Sleeping roll", solid: false, hardness: 0.55, drop: "sleeping_roll", special: true, color: "#bd8570" },
  { name: "Campfire", solid: false, hardness: 0.65, drop: "campfire", special: true, color: "#ffad61" },
  { name: "Clay", solid: true, hardness: 0.7, drop: "clay", top: "clay", color: "#99a7a2" },
  { name: "Gravel", solid: true, hardness: 0.65, drop: "gravel", top: "gravel", color: "#a59a87" },
  { name: "Wild berry bush", solid: false, hardness: 0.3, drop: "berry", special: true, color: "#8aab72" },
];

export const ITEMS = {
  dirt: { name: "Dirt", tile: "dirt", block: B.DIRT, description: "Earth, ready to be shaped." },
  sand: { name: "Sand", tile: "sand", block: B.SAND, description: "A little piece of the shoreline." },
  log: { name: "Oak log", tile: "logSide", block: B.LOG, description: "The beginning of many good things." },
  leaves: { name: "Leaves", tile: "leaves", block: B.LEAVES, description: "A canopy, wherever you need one." },
  cobble: { name: "Cobblestone", tile: "cobble", block: B.COBBLE, description: "Sturdy enough to build a home." },
  planks: { name: "Oak planks", tile: "planks", block: B.PLANKS, description: "Warm timber for building." },
  coal: { name: "Coal", icon: "coal", description: "A spark waiting to happen." },
  iron: { name: "Iron", icon: "iron", description: "The good stuff, found deep below." },
  stick: { name: "Sticks", icon: "stick", description: "A useful little beginning." },
  wood_pick: { name: "Wooden pickaxe", icon: "wood_pick", tool: "pick", power: 1, speed: 2.5, durability: 48, description: "Can mine stone. A first step underground." },
  stone_pick: { name: "Stone pickaxe", icon: "stone_pick", tool: "pick", power: 2, speed: 4.5, durability: 110, description: "Can uncover coal and iron ore." },
  stone_axe: { name: "Stone axe", icon: "stone_axe", tool: "axe", power: 1, speed: 4, durability: 110, description: "Makes quick work of trees." },
  iron_pick: { name: "Iron pickaxe", icon: "iron_pick", tool: "pick", power: 3, speed: 7, durability: 220, description: "Strong and ready for the long haul." },
  torch: { name: "Torch", icon: "torch", block: B.TORCH, description: "A warm light in the dark." },
  campfire: { name: "Campfire", icon: "campfire", block: B.CAMPFIRE, description: "A place to pause and heal." },
  sleeping_roll: { name: "Sleeping roll", icon: "sleeping_roll", block: B.SLEEPING_ROLL, description: "Sleep through the night and wake restored." },
  berry: { name: "Wild berries", icon: "berry", food: 2, description: "Eat to restore a little health." },
  wool: { name: "Soft wool", icon: "wool", description: "Gently gathered from a mossling." },
  snow: { name: "Snow", tile: "snow", block: B.SNOW, description: "A piece of the high country." },
  clay: { name: "Clay", tile: "clay", block: B.CLAY, description: "Smooth riverbank earth." },
  gravel: { name: "Gravel", tile: "gravel", block: B.GRAVEL, description: "Small stones with a satisfying crunch." },
};

export const RECIPES = [
  { id: "planks", output: 4, ingredients: { log: 1 }, note: "From forest to foundation" },
  { id: "stick", output: 4, ingredients: { planks: 2 }, note: "For tools and firelight" },
  { id: "wood_pick", output: 1, ingredients: { planks: 3, stick: 2 }, note: "Mine your first stone" },
  { id: "stone_pick", output: 1, ingredients: { cobble: 3, stick: 2 }, note: "Find ore beneath the hills" },
  { id: "stone_axe", output: 1, ingredients: { cobble: 3, stick: 2 }, note: "Gather wood faster" },
  { id: "torch", output: 4, ingredients: { coal: 1, stick: 1 }, note: "Keep the dark at bay" },
  { id: "campfire", output: 1, ingredients: { log: 3, cobble: 2 }, note: "A warm place to recover" },
  { id: "sleeping_roll", output: 1, ingredients: { wool: 3, planks: 2 }, note: "Skip the night, wake restored" },
  { id: "iron_pick", output: 1, ingredients: { iron: 3, stick: 2 }, note: "A faithful companion" },
];

export const MILESTONES = [
  { id: "log", title: "The first timber", description: "Gather an oak log." },
  { id: "planks", title: "Made by hand", description: "Craft oak planks." },
  { id: "pick", title: "Beneath the surface", description: "Craft a pickaxe." },
  { id: "coal", title: "A spark of discovery", description: "Find coal underground." },
  { id: "torch", title: "A light of your own", description: "Place a torch." },
  { id: "mossling", title: "A friendly face", description: "Gather wool from a mossling." },
  { id: "home", title: "Somewhere to return to", description: "Place a sleeping roll." },
  { id: "sleep", title: "A new morning", description: "Sleep through the night." },
];

export const TILES = [
  "grass", "grassSide", "dirt", "stone", "sand", "logSide", "logTop", "leaves",
  "cobble", "planks", "coalOre", "ironOre", "snow", "snowSide", "dryGrass", "drySide",
  "clay", "gravel",
];

const palettes = {
  grass: ["#819e65", "#90ac72", "#75935c", "#a0b77d", "#698a59"],
  dirt: ["#947254", "#a07d5b", "#866649", "#ae8962", "#755c46"],
  stone: ["#87918a", "#939c93", "#79847f", "#a3a99d", "#6e7a76"],
  sand: ["#ddc89b", "#e9d5aa", "#d2b988", "#f0dbb4", "#c8af80"],
  leaves: ["#72996f", "#83a778", "#608761", "#93b384", "#537b5c"],
  cobble: ["#88918a", "#a0a69b", "#6e7d76", "#8a968b", "#65726c"],
  planks: ["#b99a6b", "#cbaa79", "#a9865e", "#d1b587", "#9e7d59"],
  snow: ["#e6e9dd", "#f1f0e7", "#d5ddd8", "#ffffff", "#c6d2d2"],
  dryGrass: ["#b6a873", "#c7b57b", "#a79768", "#d1bd84", "#9c9066"],
  clay: ["#9daba7", "#adbab3", "#8d9b99", "#bbc3b7", "#829391"],
  gravel: ["#a69f8c", "#b8ae99", "#8d8d82", "#c3b9a6", "#82857e"],
};

function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function drawTile(ctx, name, tx, ty, index) {
  const x = tx * 32;
  const y = ty * 32;
  const rng = random(index * 77731 + 423);
  const baseName = name === "grassSide" || name === "snowSide" || name === "drySide"
    ? "dirt" : name === "coalOre" || name === "ironOre" ? "stone" : name === "logTop" || name === "logSide" ? "planks" : name;
  const colors = palettes[baseName] || palettes.stone;
  ctx.fillStyle = colors[0];
  ctx.fillRect(x, y, 32, 32);

  for (let i = 0; i < 106; i++) {
    ctx.fillStyle = colors[1 + Math.floor(rng() * 4)];
    ctx.fillRect(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), 1 + Math.floor(rng() * 4), 1 + Math.floor(rng() * 3));
  }

  if (name === "grassSide" || name === "drySide" || name === "snowSide") {
    const top = name === "grassSide" ? palettes.grass : name === "drySide" ? palettes.dryGrass : palettes.snow;
    ctx.fillStyle = top[0];
    ctx.fillRect(x, y, 32, 6);
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = top[1 + Math.floor(rng() * 4)];
      ctx.fillRect(x + Math.floor(rng() * 32), y + Math.floor(rng() * 7), 1 + Math.floor(rng() * 3), 2 + Math.floor(rng() * 4));
    }
  }

  if (name === "logSide") {
    ctx.fillStyle = "#826347";
    ctx.fillRect(x, y, 32, 32);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = ["#a7825c", "#bd976c", "#715a43", "#96734f"][Math.floor(rng() * 4)];
      ctx.fillRect(x + Math.floor(rng() * 32), y + Math.floor(rng() * 29), 1 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 14));
    }
  }

  if (name === "logTop") {
    ctx.fillStyle = "#725c42";
    ctx.fillRect(x, y, 32, 32);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? "#c5a57b" : "#a88761";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3 + i * 3, y + 3 + i * 3, 26 - i * 6, 26 - i * 6);
    }
  }

  if (name === "planks") {
    ctx.fillStyle = "#8c6d4b";
    for (const row of [10, 21, 31]) ctx.fillRect(x, y + row, 32, 1);
    ctx.fillRect(x + 17, y, 1, 10);
    ctx.fillRect(x + 8, y + 11, 1, 10);
    ctx.fillRect(x + 23, y + 22, 1, 10);
  }

  if (name === "cobble") {
    ctx.strokeStyle = "#68756f";
    ctx.lineWidth = 2;
    for (const [a, b, w, h] of [[1, 2, 13, 11], [16, 1, 15, 14], [2, 16, 17, 14], [21, 18, 12, 13]]) ctx.strokeRect(x + a, y + b, w, h);
  }

  if (name === "coalOre" || name === "ironOre") {
    const ore = name === "coalOre" ? ["#3b4546", "#4f5957", "#252e33"] : ["#c39069", "#aa775e", "#dfaa7c"];
    for (let i = 0; i < 11; i++) {
      ctx.fillStyle = ore[Math.floor(rng() * ore.length)];
      ctx.fillRect(x + 2 + Math.floor(rng() * 26), y + 2 + Math.floor(rng() * 26), 3 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 4));
    }
  }

  if (name === "leaves") {
    for (let i = 0; i < 1; i++) {
      const hx = x + 2 + Math.floor(rng() * 28);
      const hy = y + 2 + Math.floor(rng() * 28);
      ctx.clearRect(hx, hy, 1, 2);
    }
  }
}

let cachedAtlas;
let cachedIcons = {};

export function createAtlas() {
  if (cachedAtlas) return cachedAtlas;
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  TILES.forEach((name, i) => drawTile(ctx, name, i % 6, Math.floor(i / 6), i));
  cachedAtlas = canvas;
  return canvas;
}

export function tileUV(name) {
  const index = Math.max(0, TILES.indexOf(name));
  const col = index % 6;
  const row = Math.floor(index / 6);
  const pad = 0.014;
  return [(col + pad) / 6, 1 - (row + 1 - pad) / 3, (col + 1 - pad) / 6, 1 - (row + pad) / 3];
}

export function itemIcon(id) {
  if (cachedIcons[id]) return cachedIcons[id];
  const item = ITEMS[id];
  if (!item) return "";
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (item.tile) {
    const i = TILES.indexOf(item.tile);
    ctx.fillStyle = "#314542";
    ctx.fillRect(7, 9, 34, 34);
    ctx.drawImage(createAtlas(), (i % 6) * 32, Math.floor(i / 6) * 32, 32, 32, 9, 7, 30, 30);
    ctx.fillStyle = "rgba(29,42,40,.27)";
    ctx.fillRect(9, 33, 30, 4);
    ctx.fillRect(35, 7, 4, 30);
  } else {
    const pixel = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    if (id.includes("pick") || id.includes("axe")) {
      pixel("#563d2f", 19, 26, 7, 17);
      pixel("#ae8359", 20, 25, 4, 15);
      const head = id.startsWith("iron") ? "#bdc8bf" : id.startsWith("stone") ? "#929d94" : "#c5a879";
      pixel(head, id.includes("axe") ? 10 : 7, 10, id.includes("axe") ? 19 : 34, 7);
      pixel(head, 13, 16, 9, 7);
      if (!id.includes("axe")) pixel(head, 8, 17, 6, 6);
      pixel("rgba(255,255,255,.28)", 12, 10, 22, 2);
    } else if (id === "stick") {
      ctx.save(); ctx.translate(24, 24); ctx.rotate(-0.6); pixel("#735139", -3, -18, 7, 37); pixel("#b28a5f", -1, -18, 3, 36); ctx.restore();
    } else if (id === "torch") {
      pixel("#8b6645", 21, 22, 7, 20); pixel("#e8ba70", 22, 22, 3, 18);
      pixel("#f19350", 17, 12, 16, 15); pixel("#ffda8b", 21, 7, 8, 19); pixel("#fff0bd", 23, 11, 4, 9);
    } else if (id === "campfire") {
      pixel("#71523c", 7, 31, 34, 7); pixel("#a67a54", 14, 27, 29, 7);
      pixel("#ed9651", 18, 13, 15, 20); pixel("#ffd68b", 21, 9, 9, 22);
    } else if (id === "sleeping_roll") {
      pixel("#7b957b", 4, 16, 40, 25); pixel("#c67f6e", 5, 13, 38, 22); pixel("#ebc6a8", 9, 16, 31, 4); pixel("#d9ddc4", 9, 18, 11, 10);
    } else if (id === "berry") {
      for (const [x, y] of [[13, 20], [22, 17], [30, 24], [20, 29]]) { pixel("#a75258", x, y, 9, 9); pixel("#d77b77", x + 2, y + 1, 3, 2); }
      pixel("#6d9767", 22, 13, 9, 5);
    } else if (id === "wool") {
      pixel("#d8dfcc", 9, 13, 30, 27); pixel("#f1f0df", 13, 10, 23, 29); pixel("#b8c8b7", 9, 33, 29, 6);
    } else {
      const color = id === "coal" ? "#45514e" : "#b9a993";
      pixel("#65736e", 12, 12, 23, 26); pixel(color, 9, 16, 30, 21); pixel("rgba(255,255,255,.25)", 13, 15, 10, 5);
    }
  }
  cachedIcons[id] = canvas.toDataURL();
  return cachedIcons[id];
}