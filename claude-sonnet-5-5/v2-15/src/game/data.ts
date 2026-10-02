export type GoodId = "oil" | "bone" | "amber" | "gel" | "hide" | "spice" | "ore" | "silk";
export const GOOD_IDS: GoodId[] = ["oil", "bone", "amber", "gel", "hide", "spice", "ore", "silk"];

export interface GoodDef {
  name: string;
  icon: string;
  base: number;
  hunt: boolean;
  color: string;
  demand: number[]; // per region price multiplier
}

export const GOODS: Record<GoodId, GoodDef> = {
  oil: { name: "Whale Oil", icon: "🛢️", base: 14, hunt: true, color: "#e8b04a", demand: [1.0, 1.05, 0.95, 1.1, 1.0, 1.2] },
  bone: { name: "Skybone", icon: "🦴", base: 20, hunt: true, color: "#e9e2cf", demand: [0.9, 1.0, 1.1, 1.2, 1.0, 1.1] },
  amber: { name: "Ambergris", icon: "🟠", base: 120, hunt: true, color: "#f08a2c", demand: [1.0, 1.1, 1.0, 1.0, 1.4, 1.3] },
  gel: { name: "Lumen Gel", icon: "💠", base: 45, hunt: true, color: "#6ee7ff", demand: [0.9, 1.0, 1.3, 0.9, 1.4, 1.2] },
  hide: { name: "Manta Hide", icon: "🧵", base: 28, hunt: true, color: "#8fb3ff", demand: [1.0, 1.4, 0.9, 1.1, 0.9, 1.0] },
  spice: { name: "Cloud Spice", icon: "🌶️", base: 22, hunt: false, color: "#ff7a59", demand: [0.6, 0.8, 1.0, 1.4, 1.6, 1.7] },
  ore: { name: "Iron Ore", icon: "⛏️", base: 14, hunt: false, color: "#a0a8b8", demand: [1.5, 1.3, 0.7, 0.6, 1.1, 1.0] },
  silk: { name: "Aether Silk", icon: "🧶", base: 38, hunt: false, color: "#d6a5ff", demand: [1.3, 0.65, 1.0, 1.2, 0.8, 1.5] },
};

export type FrontKind = "gale" | "storm" | "fog" | "aurora";
export const FRONT_INFO: Record<FrontKind, { name: string; icon: string; color: string; desc: string }> = {
  gale: { name: "Gale Front", icon: "💨", color: "#9be7ff", desc: "Strong crosswinds bend harpoon arcs and shove your ship." },
  storm: { name: "Thunderhead", icon: "⛈️", color: "#8b7bff", desc: "Lightning strikes the fleet. Eels swarm. Lightning rods help." },
  fog: { name: "Murk Bank", icon: "🌫️", color: "#b8c4cf", desc: "Visibility collapses. A Navigator's radar sees through it." },
  aurora: { name: "Aurora Drift", icon: "🌌", color: "#6dffb2", desc: "Rare calm: gel and ambergris drops swell, crew spirits lift." },
};

export type CreatureId =
  | "drifter" | "manta" | "jelly" | "eel" | "bull" | "skiff"
  | "mossback" | "empress" | "thunderjaw" | "admiral" | "auroraleth" | "leviathan";

export interface CreatureDef {
  id: CreatureId;
  name: string;
  shape: "whale" | "manta" | "jelly" | "eel" | "skiff";
  ai: "drift" | "flee" | "float" | "hunt" | "bull" | "ship" | "apex";
  r: number;
  hp: number;
  stam: number;
  speed: number;
  col: string;
  col2: string;
  hostile: boolean;
  contact: number;
  loot: [GoodId, number, number, number][];
  crowns: [number, number];
  threat: number;
  alt: [number, number];
  desc: string;
  apexRegion?: number;
  attacks?: string[];
  minion?: CreatureId;
}

export const CREATURES: Record<CreatureId, CreatureDef> = {
  drifter: { id: "drifter", name: "Cloud Drifter", shape: "whale", ai: "flee", r: 34, hp: 30, stam: 42, speed: 70, col: "#7aa6c9", col2: "#d9ecf7", hostile: false, contact: 0, loot: [["oil", 3, 5, 1], ["bone", 1, 2, 0.8]], crowns: [0, 0], threat: 4, alt: [350, 1300], desc: "Placid, slow, and rich in oil. The bread and butter of any fleet." },
  manta: { id: "manta", name: "Gale Manta", shape: "manta", ai: "flee", r: 30, hp: 26, stam: 55, speed: 170, col: "#6f7fd1", col2: "#c9d4ff", hostile: false, contact: 0, loot: [["oil", 2, 3, 1], ["hide", 2, 3, 0.9]], crowns: [0, 0], threat: 4, alt: [250, 1100], desc: "Fast and skittish. Zigzags away; its hide fetches fine coin." },
  jelly: { id: "jelly", name: "Lantern Jelly", shape: "jelly", ai: "float", r: 28, hp: 18, stam: 18, speed: 35, col: "#4fd1e8", col2: "#c9fbff", hostile: false, contact: 0, loot: [["gel", 2, 3, 1]], crowns: [0, 0], threat: 3, alt: [200, 1400], desc: "Drifting glow-bags of Lumen Gel. Bursts violently when slain — keep your distance." },
  eel: { id: "eel", name: "Thunder Eel", shape: "eel", ai: "hunt", r: 24, hp: 42, stam: 65, speed: 200, col: "#6b5bd6", col2: "#ffe566", hostile: true, contact: 12, loot: [["oil", 2, 3, 1], ["bone", 2, 2, 0.8], ["gel", 1, 1, 0.4]], crowns: [0, 0], threat: 5, alt: [250, 1300], desc: "Hunts your fleet in lunging strikes. Crackles in storms." },
  bull: { id: "bull", name: "Ambergris Bull", shape: "whale", ai: "bull", r: 54, hp: 95, stam: 140, speed: 85, col: "#8a6f5a", col2: "#e8d3b0", hostile: false, contact: 22, loot: [["oil", 8, 11, 1], ["bone", 4, 6, 1], ["amber", 1, 2, 0.65]], crowns: [0, 0], threat: 9, alt: [500, 1450], desc: "Colossal and enraged when hooked. The only reliable source of ambergris." },
  skiff: { id: "skiff", name: "Reaver Skiff", shape: "skiff", ai: "ship", r: 32, hp: 48, stam: 70, speed: 120, col: "#b5483a", col2: "#f0d2a0", hostile: true, contact: 10, loot: [["ore", 2, 4, 0.8], ["spice", 1, 3, 0.5]], crowns: [70, 130], threat: 6, alt: [300, 1200], desc: "Sky pirates. Fire cannons at range and plunder your hold if you let them." },
  mossback: { id: "mossback", name: "Old Mossback", shape: "whale", ai: "apex", r: 105, hp: 280, stam: 230, speed: 95, col: "#5d7a52", col2: "#c8d9a2", hostile: true, contact: 28, loot: [["oil", 14, 18, 1], ["bone", 8, 10, 1], ["amber", 3, 4, 1]], crowns: [500, 600], threat: 0, alt: [500, 1200], desc: "A moss-crowned elder who has sunk a hundred ships.", apexRegion: 0, attacks: ["charge", "charge", "summon"], minion: "drifter" },
  empress: { id: "empress", name: "Gale Empress", shape: "manta", ai: "apex", r: 110, hp: 380, stam: 290, speed: 150, col: "#4c5fc4", col2: "#ffd2f0", hostile: true, contact: 26, loot: [["hide", 12, 14, 1], ["oil", 10, 12, 1], ["amber", 3, 5, 1]], crowns: [800, 950], threat: 0, alt: [450, 1100], desc: "Queen of the winds. Summons gusts and her mantas.", apexRegion: 1, attacks: ["gust", "charge", "summon", "gust"], minion: "manta" },
  thunderjaw: { id: "thunderjaw", name: "Thunderjaw", shape: "eel", ai: "apex", r: 70, hp: 520, stam: 360, speed: 150, col: "#4a3fb0", col2: "#fff27a", hostile: true, contact: 30, loot: [["gel", 8, 10, 1], ["bone", 10, 12, 1], ["amber", 4, 5, 1]], crowns: [1200, 1400], threat: 0, alt: [450, 1150], desc: "A storm-serpent whose jaws call down lightning.", apexRegion: 2, attacks: ["lightning", "charge", "lightning", "summon"], minion: "eel" },
  admiral: { id: "admiral", name: "Admiral Rust", shape: "skiff", ai: "apex", r: 110, hp: 650, stam: 520, speed: 100, col: "#8f3a2f", col2: "#ffcf8a", hostile: true, contact: 30, loot: [["ore", 10, 14, 1], ["spice", 8, 10, 1], ["amber", 3, 4, 1]], crowns: [2200, 2600], threat: 0, alt: [450, 1100], desc: "A reaver dreadnought bristling with cannon.", apexRegion: 3, attacks: ["volley", "ring", "summon", "volley", "charge"], minion: "skiff" },
  auroraleth: { id: "auroraleth", name: "Auroraleth", shape: "jelly", ai: "apex", r: 105, hp: 820, stam: 520, speed: 110, col: "#52e0b6", col2: "#f2ffcc", hostile: true, contact: 28, loot: [["gel", 14, 16, 1], ["amber", 5, 6, 1], ["silk", 8, 10, 1]], crowns: [2800, 3200], threat: 0, alt: [400, 1000], desc: "A cathedral of living light. Its orbs weave deadly patterns.", apexRegion: 4, attacks: ["ring", "summon", "lightning", "ring"], minion: "jelly" },
  leviathan: { id: "leviathan", name: "Leviathan Aurelion", shape: "whale", ai: "apex", r: 140, hp: 1050, stam: 640, speed: 130, col: "#2d3f7a", col2: "#ffd36e", hostile: true, contact: 34, loot: [["amber", 8, 10, 1], ["oil", 20, 24, 1], ["gel", 10, 12, 1]], crowns: [6000, 7000], threat: 0, alt: [450, 1100], desc: "The Storm Heart's sovereign. The one every whaler dreams of — and dies to.", apexRegion: 5, attacks: ["charge", "lightning", "ring", "gust", "volley", "summon"], minion: "eel" },
};

export interface RegionDef {
  name: string;
  port: string;
  blurb: string;
  sky: [string, string, string];
  spawn: [CreatureId, number][];
  weather: Record<FrontKind, number>;
  fuel: number;
  apex: CreatureId;
  danger: number;
}

export const REGIONS: RegionDef[] = [
  { name: "Cloudmeadow Reach", port: "Haven Lantern", blurb: "Gentle trade-winds and fat drifters. A fine place to learn the harpoon.", sky: ["#1b2a5c", "#4a8fd0", "#f6d9a8"], spawn: [["drifter", 6], ["manta", 3], ["jelly", 2]], weather: { gale: 1, storm: 0.4, fog: 0.6, aurora: 0.3 }, fuel: 1.1, apex: "mossback", danger: 1 },
  { name: "Gale Reach", port: "Windbreak Quay", blurb: "Mantas ride endless crosswinds. Harpoon arcs bend like willow.", sky: ["#14305e", "#3fa7c9", "#f4e3b0"], spawn: [["manta", 6], ["drifter", 3], ["jelly", 2], ["eel", 1]], weather: { gale: 2.4, storm: 0.7, fog: 0.4, aurora: 0.3 }, fuel: 1.25, apex: "empress", danger: 2 },
  { name: "Thunderhead Shoals", port: "Stormanchor", blurb: "Permanent thunder-cells, eels, and the finest bulls in the sky.", sky: ["#150f33", "#4a4690", "#c79ac4"], spawn: [["eel", 4], ["bull", 3], ["jelly", 3], ["drifter", 2]], weather: { gale: 1, storm: 2.6, fog: 0.6, aurora: 0.2 }, fuel: 1.4, apex: "thunderjaw", danger: 3 },
  { name: "Rustwind Narrows", port: "Scrapjaw Dock", blurb: "Reaver territory. Smog, wreckage, and toll-takers with cannon.", sky: ["#2a1712", "#8a5a3c", "#e5b27a"], spawn: [["skiff", 5], ["bull", 3], ["eel", 2], ["manta", 2]], weather: { gale: 1.2, storm: 0.8, fog: 2.2, aurora: 0.1 }, fuel: 1.5, apex: "admiral", danger: 4 },
  { name: "Aurora Drift", port: "Halcyon Spire", blurb: "A shimmering high-altitude lull. Gel and ambergris glitter in the lights.", sky: ["#07163b", "#1f6f7d", "#a9f0d6"], spawn: [["jelly", 5], ["bull", 3], ["eel", 2], ["manta", 3]], weather: { gale: 0.8, storm: 0.8, fog: 0.5, aurora: 2.8 }, fuel: 1.6, apex: "auroraleth", danger: 5 },
  { name: "The Storm Heart", port: "Eye Station", blurb: "The eye of the world's oldest tempest. Everything hunts here — including you.", sky: ["#0a0720", "#3a2b72", "#e88f8f"], spawn: [["eel", 4], ["bull", 3], ["skiff", 3], ["manta", 2], ["jelly", 2]], weather: { gale: 1.6, storm: 2.2, fog: 1.2, aurora: 0.4 }, fuel: 1.8, apex: "leviathan", danger: 6 },
];

export type UpgId = "hull" | "engine" | "tank" | "hold" | "gun" | "winch" | "launcher" | "cannon" | "rods";
export const UPGRADES: { id: UpgId; name: string; icon: string; desc: string; base: number; max: number }[] = [
  { id: "hull", name: "Ironwood Plating", icon: "🛡️", desc: "+30 max hull per level.", base: 150, max: 5 },
  { id: "engine", name: "Aether Engine", icon: "⚙️", desc: "+12% thrust & top speed per level.", base: 160, max: 5 },
  { id: "tank", name: "Fuel Bladder", icon: "⛽", desc: "+25 fuel capacity per level.", base: 120, max: 5 },
  { id: "hold", name: "Cargo Hold", icon: "📦", desc: "+8 hold slots per level.", base: 130, max: 5 },
  { id: "gun", name: "Harpoon Gun", icon: "🔱", desc: "+12% harpoon damage, +6% velocity, stronger lance per level.", base: 180, max: 5 },
  { id: "winch", name: "Rope Winch", icon: "🪢", desc: "+12% reel speed and +14 rope strength per level.", base: 170, max: 5 },
  { id: "launcher", name: "Twin Launchers", icon: "🔗", desc: "+1 simultaneous harpoon per level.", base: 420, max: 2 },
  { id: "cannon", name: "Deck Cannon", icon: "💥", desc: "+2 cannon damage per level. Auto-fires at hostiles.", base: 150, max: 5 },
  { id: "rods", name: "Lightning Rods", icon: "⚡", desc: "-15% lightning & eel shock damage per level.", base: 140, max: 4 },
];

export type Role = "pilot" | "harpooner" | "gunner" | "engineer" | "navigator";
export const ROLES: Role[] = ["pilot", "harpooner", "gunner", "engineer", "navigator"];
export const ROLE_INFO: Record<Role, { name: string; icon: string; desc: string }> = {
  pilot: { name: "Pilot", icon: "🧭", desc: "Sharper handling: more thrust." },
  harpooner: { name: "Harpooner", icon: "🔱", desc: "Harpoon damage, lance strength, longer trajectory preview." },
  gunner: { name: "Gunner", icon: "💣", desc: "Deck cannon fire-rate and damage." },
  engineer: { name: "Engineer", icon: "🔧", desc: "Lower fuel burn and in-flight hull repair." },
  navigator: { name: "Navigator", icon: "🔭", desc: "Weather forecasts and radar range." },
};

export const ESCORTS = {
  harrier: { name: "Harrier Gunship", icon: "⚔️", price: 700, hp: 70, desc: "Fires on nearby hostiles and draws enemy fire." },
  chaser: { name: "Chaser Skiff", icon: "🏹", price: 800, hp: 60, desc: "Tags creatures with ropes: slows them and drains stamina." },
  hauler: { name: "Bulk Hauler", icon: "🚢", price: 600, hp: 100, desc: "+14 hold slots and a wide tractor beam for loot." },
} as const;
export type EscortKind = keyof typeof ESCORTS;

export const DIFFS = [
  { name: "Calm Skies", desc: "Forgiving beasts, gentle tribute, generous start.", dmg: 0.7, hp: 0.85, tribute: 0.7, weather: 0.8, crowns: 900, snap: 1.2 },
  { name: "Trade Winds", desc: "The intended voyage. Balanced and fair.", dmg: 1, hp: 1, tribute: 1, weather: 1, crowns: 600, snap: 1 },
  { name: "Tempest", desc: "Savage creatures, wild weather, a hungry Guild.", dmg: 1.35, hp: 1.2, tribute: 1.35, weather: 1.5, crowns: 400, snap: 0.9 },
];

export const PERKS = [
  { id: "capital", name: "Seed Capital", desc: "+150 starting crowns per level.", max: 5, cost: 6 },
  { id: "veteran", name: "Veteran Harpooner", desc: "Your starting harpooner is +1 level per level.", max: 2, cost: 12 },
  { id: "charts", name: "Old Charts", desc: "+30 starting fuel and rations per level.", max: 3, cost: 8 },
  { id: "favor", name: "Guild Favor", desc: "-6% Guild tribute per level.", max: 3, cost: 14 },
  { id: "legs", name: "Sky Legs", desc: "Crew starts with +10 morale per level.", max: 3, cost: 7 },
];

export const TRIBUTE_INTERVAL = 10;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rndi = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
