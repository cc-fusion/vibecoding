import type { CrateKind, FishKind, MonsterKind, Player } from "./types";

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  apply: (p: Player) => void;
}

export const RELICS: RelicDef[] = [
  {
    id: "barnacle",
    name: "Barnacle Plating",
    icon: "🐚",
    desc: "+3 max hull, and the plating mends 3 hull now.",
    price: 35,
    apply: (p) => {
      p.maxHull += 3;
      p.hull = Math.min(p.maxHull, p.hull + 3);
    },
  },
  {
    id: "lamp",
    name: "Whale-Oil Lamp",
    icon: "🏮",
    desc: "Rendering a fish into oil yields +2 extra fuel.",
    price: 35,
    apply: (p) => {
      p.oilBonus += 2;
    },
  },
  {
    id: "silk",
    name: "Kraken-Silk Net",
    icon: "🕸️",
    desc: "+3 max net durability, and the net is re-strung by 3.",
    price: 40,
    apply: (p) => {
      p.maxNets += 3;
      p.nets = Math.min(p.maxNets, p.nets + 3);
    },
  },
  {
    id: "longshaft",
    name: "Longshaft Harpoon",
    icon: "🔱",
    desc: "+1 harpoon range.",
    price: 50,
    apply: (p) => {
      p.harpRange += 1;
    },
  },
  {
    id: "barbed",
    name: "Barbed Heads",
    icon: "🗡️",
    desc: "Harpoons deal +1 damage.",
    price: 65,
    apply: (p) => {
      p.harpDmg += 1;
    },
  },
  {
    id: "spyglass",
    name: "Captain's Spyglass",
    icon: "🔭",
    desc: "+1 vision radius. See further through the fog.",
    price: 35,
    apply: (p) => {
      p.vision += 1;
    },
  },
  {
    id: "astrolabe",
    name: "Golden Astrolabe",
    icon: "🧭",
    desc: "Harbor merchants pay 25% more for your catch.",
    price: 45,
    apply: (p) => {
      p.sellBonus += 0.25;
    },
  },
  {
    id: "barrel",
    name: "Bottomless Barrel",
    icon: "🛢️",
    desc: "+4 hold capacity.",
    price: 40,
    apply: (p) => {
      p.holdMax += 4;
    },
  },
  {
    id: "spread",
    name: "Trawler's Spread",
    icon: "🪢",
    desc: "+1 net casting range.",
    price: 50,
    apply: (p) => {
      p.netRange += 1;
    },
  },
  {
    id: "coral",
    name: "Coral Charm",
    icon: "🪸",
    desc: "Every monster attack deals 1 less damage (min 1).",
    price: 55,
    apply: (p) => {
      p.armor += 1;
    },
  },
  {
    id: "bell",
    name: "Stormcaller's Bell",
    icon: "🔔",
    desc: "The squall arrives 6 turns later on every chart.",
    price: 35,
    apply: (p) => {
      p.stormBonus += 6;
    },
  },
  {
    id: "reel",
    name: "Hemp Reel",
    icon: "🪝",
    desc: "40% chance each harpoon hit is reeled straight back.",
    price: 45,
    apply: (p) => {
      p.reel = true;
    },
  },
  {
    id: "hook",
    name: "Lucky Hook",
    icon: "🎣",
    desc: "Every net haul that catches fish brings up +1 bonus sardine.",
    price: 30,
    apply: (p) => {
      p.lucky = true;
    },
  },
  {
    id: "piston",
    name: "Steam Piston",
    icon: "⚙️",
    desc: "Every third move costs no fuel.",
    price: 50,
    apply: (p) => {
      p.piston = true;
    },
  },
];

export const relicById = (id: string) => RELICS.find((r) => r.id === id)!;

export const FISH: Record<FishKind, { name: string; icon: string; value: number; color: string }> = {
  sardine: { name: "Sardine", icon: "🐟", value: 2, color: "#cfe4ee" },
  tuna: { name: "Tuna", icon: "🐠", value: 5, color: "#ff9f5a" },
  glow: { name: "Glowfin", icon: "✨", value: 11, color: "#52ffe0" },
};
export const FISH_KINDS: FishKind[] = ["sardine", "tuna", "glow"];

export interface MonsterDef {
  name: string;
  hp: number;
  dmg: number;
  bounty: number;
  blurb: string;
}
export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  eel: {
    name: "Razor Eel",
    hp: 4,
    dmg: 2,
    bounty: 6,
    blurb: "Hunts you within 5 hexes. Bites when adjacent (2).",
  },
  angler: {
    name: "Gloom Angler",
    hp: 6,
    dmg: 3,
    bounty: 12,
    blurb: "Stationary. Lure drags you in from 2 hexes. Bites adjacent (3).",
  },
  whale: {
    name: "Bonecrusher Whale",
    hp: 9,
    dmg: 3,
    bounty: 30,
    blurb: "Acts every other turn. Bites adjacent (3).",
  },
  kraken: {
    name: "The Abyssal Leviathan",
    hp: 14,
    dmg: 2,
    bounty: 100,
    blurb: "Lashes everything within 2 hexes. Hatches eels. Enrages at half health.",
  },
};

export const CHARTS = [
  { name: "Shallow Reach", sub: "Calm waters to learn the trade." },
  { name: "Kelp Labyrinth", sub: "Rich shoals, tangled lanes." },
  { name: "Gloom Banks", sub: "Something vast stirs below." },
  { name: "Bone Trench", sub: "Wrecks, fangs, and thunder." },
  { name: "The Maw", sub: "The Abyssal Leviathan awaits." },
];

export const LEVY = [12, 26, 42, 62];
export const STORM_DELAY = [20, 18, 16, 14, 14];
export const STORM_INTERVAL = [5, 5, 4, 4, 4];

export interface Captain {
  id: string;
  name: string;
  title: string;
  icon: string;
  blurb: string;
  mods: Partial<Pick<Player, "maxHull" | "maxFuel" | "maxNets" | "maxHarpoons" | "holdMax">>;
  perks: string[];
}
export const CAPTAINS: Captain[] = [
  {
    id: "marrow",
    name: "Old Marrow",
    title: "The Harpooner",
    icon: "🔱",
    blurb: "Grizzled leviathan hunter. Fewer nets, more iron.",
    mods: { maxHarpoons: 8, maxNets: 6, holdMax: 9 },
    perks: ["8 harpoons", "6 net durability", "9 hold"],
  },
  {
    id: "isla",
    name: "Captain Isla",
    title: "The Netmaster",
    icon: "🕸️",
    blurb: "Hauls more than anyone. Dreads the deep things.",
    mods: { maxNets: 10, holdMax: 14, maxHarpoons: 4 },
    perks: ["10 net durability", "14 hold", "4 harpoons"],
  },
  {
    id: "brannoch",
    name: "Brannoch",
    title: "The Stoker",
    icon: "🔥",
    blurb: "Runs the boiler hot and the hull thick.",
    mods: { maxFuel: 32, maxHull: 13, maxHarpoons: 4, maxNets: 6 },
    perks: ["32 fuel", "13 hull", "6 net durability"],
  },
];

export const CRATE_INFO: Record<CrateKind, { icon: string; label: string }> = {
  fuel: { icon: "🛢️", label: "Fuel drums" },
  harpoon: { icon: "🔱", label: "Harpoon bundle" },
  net: { icon: "🧵", label: "Net twine" },
  gold: { icon: "💰", label: "Strongbox" },
  hull: { icon: "🪵", label: "Timber" },
};

export const UPGRADES = {
  hold: { name: "Expand Hold", icon: "📦", desc: "+4 hold capacity", base: 20, step: 15 },
  hull: { name: "Reinforced Hull", icon: "🛡️", desc: "+2 max hull (and mend 2)", base: 25, step: 15 },
  fuel: { name: "Bigger Boiler", icon: "🔥", desc: "+6 max fuel (and fill 6)", base: 20, step: 10 },
  net: { name: "Net Loom", icon: "🧶", desc: "+2 max net durability", base: 15, step: 10 },
  rack: { name: "Harpoon Rack", icon: "🎯", desc: "+2 max harpoons", base: 15, step: 10 },
} as const;
export const UPGRADE_KEYS = Object.keys(UPGRADES) as (keyof typeof UPGRADES)[];
export const MAX_UPGRADE = 3;
