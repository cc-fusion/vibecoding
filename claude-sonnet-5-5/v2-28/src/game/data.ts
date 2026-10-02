// Shared constants, definitions and entity types for Weather Warden

export const COLS = 20;
export const ROWS = 12;
export const CELL = 48;
export const W = COLS * CELL;
export const H = ROWS * CELL;
export const WIN_WAVE = 12;

export type SpellId = "rain" | "wind" | "bolt" | "heat" | "frost";
export type StructId = "sprinkler" | "rod" | "fan" | "lamp" | "spire";
export type ToolId = SpellId | StructId;
export type PestKind = "aphid" | "beetle" | "slug" | "locust" | "raven" | "mole" | "titan" | "queen";

export interface SpellDef {
  id: SpellId;
  name: string;
  key: string;
  cost: number;
  cd: number;
  color: string;
  icon: string;
  desc: string;
  unlock?: string;
}

export const SPELLS: SpellDef[] = [
  { id: "rain", name: "Rain Cloud", key: "1", cost: 14, cd: 1.2, color: "#5aa9ff", icon: "🌧️", desc: "Summon a rain cloud. Soaks the ground: waters crops, slows pests, conducts lightning." },
  { id: "wind", name: "Gale Gust", key: "2", cost: 10, cd: 0.9, color: "#bfe9d8", icon: "🌬️", desc: "Click-drag to blow a gust. Shoves pests, drives clouds, fans fires, dries soil." },
  { id: "bolt", name: "Lightning", key: "3", cost: 24, cd: 0.8, color: "#ffe45e", icon: "⚡", desc: "Strike a point. Chains through wet ground, shatters ice, ignites dry tinder." },
  { id: "heat", name: "Heat Wave", key: "4", cost: 20, cd: 2, color: "#ff8a3d", icon: "🔥", desc: "Scorching zone. Boils wet ground into steam, melts ice, dries slugs and ignites grass.", unlock: "u_heat" },
  { id: "frost", name: "Cold Front", key: "5", cost: 20, cd: 2, color: "#9fe3ff", icon: "❄️", desc: "Freezing zone. Flash-freezes wet ground, chills pests, turns rain to hail. Frosts crops!", unlock: "u_frost" },
];

export interface StructDef {
  id: StructId;
  name: string;
  key: string;
  cost: number;
  color: string;
  icon: string;
  desc: string;
  unlock?: string;
}

export const STRUCTS: StructDef[] = [
  { id: "sprinkler", name: "Rain Totem", key: "6", cost: 55, color: "#5aa9ff", icon: "🪣", desc: "Constantly soaks nearby ground. Keeps crops thriving and feeds your chain lightning." },
  { id: "rod", name: "Lightning Rod", key: "7", cost: 90, color: "#ffe45e", icon: "🗼", desc: "Auto-strikes pests in range (faster over wet ground). Grounds nearby crops and attracts storm bolts." },
  { id: "fan", name: "Wind Fan", key: "8", cost: 70, color: "#bfe9d8", icon: "🪭", desc: "Blows a constant wind. Press R to rotate. Shoves pests and fans flames." },
  { id: "lamp", name: "Heat Lamp", key: "9", cost: 80, color: "#ff8a3d", icon: "🏮", desc: "Warms the ground around it. Speeds crops, melts ice, dries soil, scalds slugs.", unlock: "u_lamp" },
  { id: "spire", name: "Frost Spire", key: "0", cost: 100, color: "#9fe3ff", icon: "🧊", desc: "Chills and freezes the ground around it. Freezes pests solid. Keep crops out of range!", unlock: "u_spire" },
];

export interface PestDef {
  name: string;
  emoji: string;
  hp: number;
  spd: number;
  dmg: number;
  r: number;
  fly: boolean;
  wind: number;
  shock: number;
  burn: number;
  hail: number;
  scald: number;
  shatter: number;
  chillRes: number;
  bounty: number;
  cost: number;
  unlockWave: number;
  boss?: boolean;
  burrow?: boolean;
  desc: string;
}

export const PESTS: Record<PestKind, PestDef> = {
  aphid: { name: "Aphid Swarm", emoji: "🐜", hp: 14, spd: 54, dmg: 3.2, r: 7, fly: false, wind: 1.1, shock: 1, burn: 1.3, hail: 1, scald: 1, shatter: 1, chillRes: 1, bounty: 1.5, cost: 3, unlockWave: 1, desc: "Fast, fragile and numerous. Light enough to be blown backwards by wind. Perish to any chain lightning." },
  beetle: { name: "Armor Beetle", emoji: "🪲", hp: 72, spd: 34, dmg: 7, r: 11, fly: false, wind: 0.35, shock: 0.55, burn: 1.5, hail: 1, scald: 1, shatter: 1.6, chillRes: 1, bounty: 5, cost: 4, unlockWave: 2, desc: "Insulated shell halves lightning damage. Burns well, and shatters badly when frozen." },
  locust: { name: "Locust", emoji: "🦗", hp: 30, spd: 86, dmg: 5, r: 9, fly: true, wind: 1.9, shock: 1, burn: 1, hail: 1.2, scald: 1.2, shatter: 1, chillRes: 1, bounty: 3, cost: 4, unlockWave: 3, desc: "Flies over everything and is tossed around by wind. Soaking its wings in rain grounds it and slows it." },
  slug: { name: "Mire Slug", emoji: "🐌", hp: 105, spd: 22, dmg: 9, r: 11, fly: false, wind: 0.5, shock: 1, burn: 1.8, hail: 1, scald: 1.5, shatter: 1, chillRes: 1, bounty: 7, cost: 5, unlockWave: 4, desc: "Heals and speeds up in mud. Heat and dry air wither it, so don't rain on it." },
  raven: { name: "Blight Raven", emoji: "🐦", hp: 135, spd: 62, dmg: 12, r: 11, fly: true, wind: 0.3, shock: 1.4, burn: 1, hail: 1.6, scald: 1, shatter: 1, chillRes: 1.3, bounty: 10, cost: 7, unlockWave: 5, desc: "Strong flier that shrugs off wind. Soaking it with rain makes lightning hit hard. Hates hail." },
  mole: { name: "Thorn Mole", emoji: "🦔", hp: 95, spd: 38, dmg: 10, r: 10, fly: false, wind: 0.1, shock: 1.1, burn: 1.2, hail: 1, scald: 1, shatter: 1.2, chillRes: 1, bounty: 9, cost: 6, unlockWave: 7, burrow: true, desc: "Burrows underground and is immune to everything. Flood the soil, freeze it or burn it to force it out." },
  titan: { name: "Thornback Titan", emoji: "🪲", hp: 1150, spd: 24, dmg: 30, r: 30, fly: false, wind: 0.05, shock: 0.35, burn: 1.3, hail: 1, scald: 1, shatter: 3.2, chillRes: 2.2, bounty: 90, cost: 0, unlockWave: 6, boss: true, desc: "BOSS. Shell nearly immune to lightning. Freeze it solid, then shatter it with a bolt for triple damage." },
  queen: { name: "Locust Queen", emoji: "🦗", hp: 1750, spd: 30, dmg: 22, r: 30, fly: true, wind: 0.14, shock: 1.3, burn: 1, hail: 1.3, scald: 1, shatter: 1, chillRes: 2, bounty: 150, cost: 0, unlockWave: 12, boss: true, desc: "BOSS. Calls locust swarms. Soak her under storm clouds and strike her out of the sky." },
};

export interface ResearchNode {
  id: string;
  name: string;
  desc: string;
  cost: number;
  req?: string;
  icon: string;
  branch: "Aether" | "Growth" | "Storm" | "Arsenal";
}

export const RESEARCH: ResearchNode[] = [
  { id: "aether1", name: "Aether Well I", desc: "+25 max Aether.", cost: 3, icon: "🔮", branch: "Aether" },
  { id: "aether2", name: "Aether Well II", desc: "+25 max Aether.", cost: 6, req: "aether1", icon: "🔮", branch: "Aether" },
  { id: "aether3", name: "Aether Well III", desc: "+30 max Aether.", cost: 10, req: "aether2", icon: "🔮", branch: "Aether" },
  { id: "regen1", name: "Swift Winds I", desc: "+1.5 Aether regeneration per second.", cost: 3, icon: "💨", branch: "Aether" },
  { id: "regen2", name: "Swift Winds II", desc: "+2 Aether regeneration per second.", cost: 7, req: "regen1", icon: "💨", branch: "Aether" },
  { id: "rhythm", name: "Storm Rhythm", desc: "Reaction combo window lasts 2.5s longer.", cost: 6, req: "regen1", icon: "🥁", branch: "Aether" },
  { id: "hardy1", name: "Hardy Seeds I", desc: "+25% crop health.", cost: 4, icon: "🌱", branch: "Growth" },
  { id: "hardy2", name: "Hardy Seeds II", desc: "+35% crop health.", cost: 8, req: "hardy1", icon: "🌾", branch: "Growth" },
  { id: "cash1", name: "Cash Crops I", desc: "+20% harvest gold.", cost: 4, icon: "🪙", branch: "Growth" },
  { id: "cash2", name: "Cash Crops II", desc: "+30% harvest gold.", cost: 8, req: "cash1", icon: "💰", branch: "Growth" },
  { id: "purse", name: "Full Purse", desc: "+80 starting gold.", cost: 3, icon: "👛", branch: "Growth" },
  { id: "almanac", name: "Warden's Almanac", desc: "Reveals the exact makeup of the next wave.", cost: 4, icon: "📖", branch: "Growth" },
  { id: "rainmaker", name: "Rainmaker", desc: "Rain clouds are 30% larger and last longer.", cost: 4, icon: "☔", branch: "Storm" },
  { id: "conductor1", name: "Conductor I", desc: "Lightning chains 2 cells further, +15% damage.", cost: 5, icon: "🔌", branch: "Storm" },
  { id: "conductor2", name: "Conductor II", desc: "Lightning chains 2 cells further, +20% damage.", cost: 9, req: "conductor1", icon: "🔌", branch: "Storm" },
  { id: "thunder", name: "Thunder Spirit", desc: "Lightning cooldown reduced by 30%.", cost: 6, req: "conductor1", icon: "🌩️", branch: "Storm" },
  { id: "u_heat", name: "Heat Wave Spell", desc: "Unlocks the Heat Wave spell (key 4).", cost: 3, icon: "🔥", branch: "Arsenal" },
  { id: "u_frost", name: "Cold Front Spell", desc: "Unlocks the Cold Front spell (key 5).", cost: 3, icon: "❄️", branch: "Arsenal" },
  { id: "u_lamp", name: "Heat Lamp", desc: "Unlocks the Heat Lamp structure (key 9).", cost: 4, req: "u_heat", icon: "🏮", branch: "Arsenal" },
  { id: "u_spire", name: "Frost Spire", desc: "Unlocks the Frost Spire structure (key 0).", cost: 5, req: "u_frost", icon: "🧊", branch: "Arsenal" },
  { id: "ground", name: "Grounding Wire", desc: "Lightning rods fire 50% faster and reach farther.", cost: 5, icon: "🪢", branch: "Arsenal" },
];

export interface Perks {
  maxMana: number;
  regen: number;
  cloudMul: number;
  chain: number;
  boltMul: number;
  boltCd: number;
  cropHp: number;
  gold: number;
  startGold: number;
  rodMul: number;
  comboWindow: number;
  almanac: boolean;
  has: (id: string) => boolean;
}

export function computePerks(o: string[]): Perks {
  const h = (id: string) => o.includes(id);
  return {
    maxMana: 100 + (h("aether1") ? 25 : 0) + (h("aether2") ? 25 : 0) + (h("aether3") ? 30 : 0),
    regen: 4 + (h("regen1") ? 1.5 : 0) + (h("regen2") ? 2 : 0),
    cloudMul: h("rainmaker") ? 1.3 : 1,
    chain: (h("conductor1") ? 2 : 0) + (h("conductor2") ? 2 : 0),
    boltMul: 1 + (h("conductor1") ? 0.15 : 0) + (h("conductor2") ? 0.2 : 0),
    boltCd: h("thunder") ? 0.7 : 1,
    cropHp: 1 + (h("hardy1") ? 0.25 : 0) + (h("hardy2") ? 0.35 : 0),
    gold: 1 + (h("cash1") ? 0.2 : 0) + (h("cash2") ? 0.3 : 0),
    startGold: 160 + (h("purse") ? 80 : 0),
    rodMul: h("ground") ? 1.5 : 1,
    comboWindow: 4 + (h("rhythm") ? 2.5 : 0),
    almanac: h("almanac"),
    has: h,
  };
}

export interface DifficultyDef {
  id: string;
  name: string;
  desc: string;
  hp: number;
  count: number;
  spd: number;
  evt: number;
  regen: number;
  gold: number;
  seed: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "gentle", name: "Gentle Breeze", desc: "Fewer, softer pests and calm skies. Seeds x0.8.", hp: 0.8, count: 0.8, spd: 0.92, evt: 55, regen: 1.25, gold: 1.25, seed: 0.8 },
  { id: "farmer", name: "Seasoned Warden", desc: "The intended challenge. Seeds x1.", hp: 1, count: 1, spd: 1, evt: 40, regen: 1, gold: 1, seed: 1 },
  { id: "tempest", name: "Tempest", desc: "Tougher, faster pests and frequent wild weather. Seeds x1.7.", hp: 1.35, count: 1.25, spd: 1.1, evt: 27, regen: 0.85, gold: 0.9, seed: 1.7 },
];

export interface ModifierDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  seed: number;
}

export const MODIFIERS: ModifierDef[] = [
  { id: "drought", name: "Drought Year", icon: "🏜️", desc: "Water evaporates twice as fast.", seed: 0.25 },
  { id: "tinder", name: "Tinderbox", icon: "🔥", desc: "Fire spreads and ignites far more easily.", seed: 0.25 },
  { id: "swarm", name: "Plague Year", icon: "🦟", desc: "+40% more pests per wave (a bit weaker each).", seed: 0.2 },
  { id: "iron", name: "Ironhide", icon: "🛡️", desc: "Pests have +50% health but give +30% gold.", seed: 0.25 },
];

export const REACTIONS: { name: string; recipe: string; desc: string }[] = [
  { name: "CHAIN SHOCK", recipe: "Rain + Lightning", desc: "Bolts arc through every wet cell, hitting everything standing in the water." },
  { name: "STORMCELL", recipe: "Rain cloud + Lightning", desc: "Charges the cloud: it hurls its own bolts at pests beneath it." },
  { name: "HAILSTORM", recipe: "Rain cloud + Cold Front", desc: "The cloud turns to hail, battering and chilling everything below." },
  { name: "FLASH FREEZE", recipe: "Wet ground + Cold Front", desc: "Water instantly turns to ice and pests are chilled." },
  { name: "SHATTER", recipe: "Ice / frozen pest + Lightning", desc: "Ice explodes. Frozen pests take a huge bonus." },
  { name: "STEAM BURST", recipe: "Wet ground + Heat / Fire", desc: "Scalding steam drifts with the wind and boils pests." },
  { name: "FIRESTORM", recipe: "Fire + Gale", desc: "Wind carries flames downwind, igniting dry ground and crops." },
  { name: "BLIZZARD", recipe: "Cold + Gale", desc: "A gust through frozen ground flash-chills everything in its path." },
];

// ---------- entity types ----------
export interface Pest {
  id: number;
  kind: PestKind;
  x: number;
  y: number;
  hp: number;
  maxhp: number;
  chill: number;
  frozen: number;
  immune: number;
  burn: number;
  soak: number;
  hit: number;
  age: number;
  target: number;
  retarget: number;
  eat: number;
  summon: number;
  stomp: number;
  phase: number;
  exposed: boolean;
  dead: boolean;
  dmgAcc: number;
  bob: number;
  hpMul: number;
}

export interface Crop {
  i: number;
  c: number;
  r: number;
  x: number;
  y: number;
  type: number;
  growth: number;
  hp: number;
  maxhp: number;
  alive: boolean;
  thirst: number;
  flash: number;
}

export interface Struct {
  id: StructId;
  c: number;
  r: number;
  x: number;
  y: number;
  lvl: number;
  cd: number;
  dir: number;
  charge: number;
  spent: number;
  spin: number;
}

export interface Cloud {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  kind: "rain" | "storm" | "hail";
  vx: number;
  vy: number;
  t: number;
  seed: number;
  flash: number;
  nat: boolean;
}

export interface Gust {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  r: number;
  fired: boolean;
}

export interface Zone {
  x: number;
  y: number;
  r: number;
  target: number;
  str: number;
  life: number;
  max: number;
  kind: "heat" | "frost";
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  kind: 0 | 1 | 2;
}

export interface FText {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Arc {
  pts: number[][];
  life: number;
  max: number;
  color: string;
  w: number;
}

export const CROP_TYPES = [
  { name: "Wheat", value: 5, time: 20, color: "#e8c25a" },
  { name: "Cabbage", value: 6, time: 23, color: "#7fcf6a" },
  { name: "Pumpkin", value: 8, time: 28, color: "#f08a2a" },
];

export const TUTORIAL: string[] = [
  "Welcome, Warden! Press 1 (or tap Rain Cloud), then click your crops to water them. Crops need moisture to grow.",
  "Pests approach from the west. Press 2 and click-drag to blast a Gale Gust: it shoves pests back (watch the tiny aphids fly!).",
  "Now the key combo: wet ground conducts lightning. Make rain under the pests, then press 3 and strike the wet ground to CHAIN SHOCK them.",
  "Gold buys permanent defenses. Press 7 and click an empty tile to build a Lightning Rod. It zaps pests and protects nearby crops.",
  "Excellent! Press SPACE or the Start Wave button to call the first wave. Watch the Forecast and keep your crops alive!",
];
