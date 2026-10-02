export type GoodId = "furs" | "medicine" | "crystal" | "parts";
export type ModuleId =
  | "turbo" | "tank" | "rack" | "heater" | "bridge" | "radar" | "anchor" | "winch" | "armor" | "turret";
export type VType = "tractor" | "sled" | "crawler" | "cabin";
export type Role = "driver" | "mechanic" | "scout" | "medic" | "cook";
export type Trait = "optimist" | "hardy" | "gloomy" | "frugal" | "brave" | "hothead";
export type WeatherType = "clear" | "snow" | "blizzard" | "whiteout" | "aurora";

export const GOODS: Record<GoodId, { name: string; icon: string; base: number; color: string }> = {
  furs: { name: "Arctic Furs", icon: "🦊", base: 30, color: "#e0a060" },
  medicine: { name: "Medicine", icon: "💊", base: 55, color: "#7fe0a0" },
  crystal: { name: "Aurorite Crystal", icon: "💎", base: 90, color: "#8fd0ff" },
  parts: { name: "Machine Parts", icon: "⚙️", base: 45, color: "#c0c8d8" },
};
export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

export interface ModuleDef {
  id: ModuleId; name: string; icon: string; desc: string; cost: number; weight: number; unlock?: string;
}
export const MODULES: Record<ModuleId, ModuleDef> = {
  turbo: { id: "turbo", name: "Turbo Engine", icon: "🚀", desc: "+12% top speed, +10% fuel burn. Stacks up to 3.", cost: 220, weight: 6 },
  tank: { id: "tank", name: "Fuel Tank", icon: "⛽", desc: "+60 fuel capacity. Heavy when full.", cost: 120, weight: 3 },
  rack: { id: "rack", name: "Cargo Rack", icon: "📦", desc: "+10 cargo capacity for trade goods.", cost: 90, weight: 2 },
  heater: { id: "heater", name: "Stove Heater", icon: "🔥", desc: "+7°C of crew warmth. Burns a little fuel.", cost: 100, weight: 3 },
  bridge: { id: "bridge", name: "Bridge Layer", icon: "🌉", desc: "+4 plank capacity, stronger bridges.", cost: 140, weight: 4 },
  radar: { id: "radar", name: "Ice Radar", icon: "📡", desc: "Reveals hidden crevasses in a wide radius.", cost: 200, weight: 3, unlock: "u_radar" },
  anchor: { id: "anchor", name: "Ice Spikes", icon: "📍", desc: "+25% grip, resists drift and thin-ice slip.", cost: 130, weight: 3 },
  winch: { id: "winch", name: "Rescue Winch", icon: "🪝", desc: "Halves the time a fallen vehicle stays stuck.", cost: 150, weight: 4 },
  armor: { id: "armor", name: "Armor Plates", icon: "🛡️", desc: "+60 hull. Halves raider damage on this vehicle.", cost: 160, weight: 8 },
  turret: { id: "turret", name: "Auto-Turret", icon: "🎯", desc: "Shoots raiders within range automatically.", cost: 240, weight: 5, unlock: "u_turret" },
};
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

export interface VTypeDef {
  id: VType; name: string; icon: string; slots: number; hull: number; weight: number; cargo: number;
  fuel: number; planks: number; cost: number; desc: string; unlock?: string; color: string;
}
export const VTYPES: Record<VType, VTypeDef> = {
  tractor: { id: "tractor", name: "Snow Tractor", icon: "🚜", slots: 3, hull: 120, weight: 20, cargo: 4, fuel: 80, planks: 6, cost: 0, desc: "The lead vehicle. Lose it and the expedition ends.", color: "#e8892b" },
  sled: { id: "sled", name: "Haul Sled", icon: "🛷", slots: 2, hull: 70, weight: 8, cargo: 8, fuel: 0, planks: 0, cost: 180, desc: "Light, cheap, carries cargo.", color: "#4aa3c7" },
  crawler: { id: "crawler", name: "Crawler Wagon", icon: "🚛", slots: 3, hull: 130, weight: 16, cargo: 12, fuel: 0, planks: 0, cost: 360, desc: "Sturdy wagon with three module slots.", unlock: "u_crawler", color: "#6d7fa8" },
  cabin: { id: "cabin", name: "Crew Cabin", icon: "🏕️", slots: 1, hull: 80, weight: 10, cargo: 0, fuel: 0, planks: 0, cost: 260, desc: "+2 bunks, built-in warmth and morale bonus.", color: "#b05a7a" },
};

export const ROLES: Record<Role, { name: string; icon: string; desc: string }> = {
  driver: { name: "Driver", icon: "🧭", desc: "Better grip and steering on slick ice." },
  mechanic: { name: "Mechanic", icon: "🔧", desc: "Stronger bridges, faster rescues, camp repairs." },
  scout: { name: "Scout", icon: "🔭", desc: "Spots hidden crevasses and forecasts weather." },
  medic: { name: "Medic", icon: "⚕️", desc: "Slows frostbite, heals the crew at camp." },
  cook: { name: "Cook", icon: "🍲", desc: "Saves food and lifts morale at camp." },
};
export const ROLE_IDS = Object.keys(ROLES) as Role[];

export const TRAITS: Record<Trait, { name: string; desc: string }> = {
  optimist: { name: "Optimist", desc: "Morale decays 35% slower." },
  hardy: { name: "Hardy", desc: "Loses warmth 35% slower." },
  gloomy: { name: "Gloomy", desc: "Morale decays faster, bonds form slowly." },
  frugal: { name: "Frugal", desc: "Eats 30% less food." },
  brave: { name: "Brave", desc: "Shrugs off crashes and raids." },
  hothead: { name: "Hothead", desc: "Prone to feuds. Bonds fray faster." },
};
export const TRAIT_IDS = Object.keys(TRAITS) as Trait[];

export const NAMES = [
  "Ilya", "Marta", "Odd", "Sunniva", "Bram", "Katya", "Tobias", "Neve", "Rurik", "Halla",
  "Dmitri", "Ysolde", "Anders", "Pilar", "Wren", "Soren", "Tamsin", "Joaquin", "Freya", "Kolya",
];
export const CREW_ICONS = ["🧑‍🚀", "👩‍🔧", "🧔", "👩‍🦰", "🧑‍🍳", "👨‍🦳", "👩‍⚕️", "🧑‍🌾", "👱‍♀️", "🧑‍🦱"];

export interface WeatherDef { wind: number; vis: number; tempOff: number; snow: number; fuel: number; label: string; icon: string; }
export const WEATHER: Record<WeatherType, WeatherDef> = {
  clear: { wind: 0.15, vis: 1, tempOff: 0, snow: 0.1, fuel: 1, label: "Clear", icon: "☀️" },
  snow: { wind: 0.35, vis: 0.8, tempOff: -2, snow: 1, fuel: 1.05, label: "Snowfall", icon: "🌨️" },
  blizzard: { wind: 1, vis: 0.5, tempOff: -8, snow: 3, fuel: 1.25, label: "Blizzard", icon: "🌬️" },
  whiteout: { wind: 1.4, vis: 0.28, tempOff: -13, snow: 4, fuel: 1.4, label: "Whiteout", icon: "❄️" },
  aurora: { wind: 0.1, vis: 1, tempOff: 1, snow: 0.05, fuel: 1, label: "Aurora", icon: "🌌" },
};

export interface DiffDef {
  id: string; name: string; desc: string; crev: number; fuel: number; cold: number; raid: number;
  credits: number; renown: number; quake: number; drain: number; color: string;
}
export const DIFFS: DiffDef[] = [
  { id: "explorer", name: "Explorer", desc: "Forgiving ice, gentle cold, generous funds.", crev: 0.7, fuel: 0.8, cold: 0.7, raid: 0.5, credits: 1.4, renown: 0.7, quake: 0.6, drain: 0.7, color: "#7fe0a0" },
  { id: "trekker", name: "Trekker", desc: "The intended expedition. Balanced and fair.", crev: 1, fuel: 1, cold: 1, raid: 1, credits: 1, renown: 1, quake: 1, drain: 1, color: "#ffd166" },
  { id: "polar", name: "Polar Veteran", desc: "Brutal fractures, bitter cold, hungry raiders.", crev: 1.35, fuel: 1.2, cold: 1.3, raid: 1.6, credits: 0.8, renown: 1.7, quake: 1.4, drain: 1.3, color: "#ff6b6b" },
];

export interface ModDef { id: string; name: string; desc: string; bonus: number; }
export const MODS: ModDef[] = [
  { id: "thin", name: "Thin Ice", desc: "+30% crevasses, double thin-ice patches.", bonus: 0.25 },
  { id: "night", name: "Long Night", desc: "Darker, colder, more blizzards.", bonus: 0.25 },
  { id: "lean", name: "Lean Supplies", desc: "Start with half the fuel, food and planks.", bonus: 0.2 },
  { id: "raiders", name: "Raider Season", desc: "Raiders strike twice as often, from leg one.", bonus: 0.2 },
];

export const STATIONS = [
  { name: "Meridian Depot", blurb: "The southern depot. Outfit your caravan before the long haul.", mult: [0.8, 1.2, 1.1, 0.9] },
  { name: "Rimhold", blurb: "A fur-trappers' settlement built into a nunatak.", mult: [0.7, 1.3, 1.3, 1.1] },
  { name: "Pike Hollow", blurb: "Miners dig machine parts out of the old shelf.", mult: [1.2, 0.8, 1.4, 0.8] },
  { name: "Saltmere Post", blurb: "A brine-lake outpost. Crystals are plentiful here.", mult: [1.3, 1.1, 0.7, 1.2] },
  { name: "Kestrel Reach", blurb: "A hospital-fort. Medicine flows, everything else is scarce.", mult: [0.9, 1.5, 0.9, 1.0] },
  { name: "Aurora Landing", blurb: "The last port before the Rift. Everyone is nervous.", mult: [1.4, 1.3, 0.6, 1.3] },
  { name: "Polaris Station", blurb: "The destination. Warm light, hot food, and silence.", mult: [1.5, 1.5, 1.5, 1.5] },
];

export interface LegDef {
  name: string; length: number; temp: number; density: number; serac: number; thin: number;
  raid: number; storm: number; hidden: number; blurb: string; ground: [string, string];
}
export const LEGS: LegDef[] = [
  { name: "The Fracture Plains", length: 7000, temp: -6, density: 0.9, serac: 0.5, thin: 0.15, raid: 0, storm: 0.15, hidden: 0.05, blurb: "Wide open ice, young cracks. A fair start.", ground: ["#dcefff", "#bfe0f7"] },
  { name: "The Shearline", length: 8000, temp: -10, density: 1.15, serac: 0.9, thin: 0.3, raid: 0.7, storm: 0.25, hidden: 0.12, blurb: "Ice slides against ice. Expect drift and wide breathing cracks.", ground: ["#d3e9fb", "#b0d4ee"] },
  { name: "The Blue Labyrinth", length: 9000, temp: -15, density: 1.35, serac: 1.5, thin: 0.45, raid: 1, storm: 0.3, hidden: 0.2, blurb: "Seracs and snow-bridged crevasses. Trust your radar.", ground: ["#c5e2fa", "#9cc8e8"] },
  { name: "The Howling Shelf", length: 10000, temp: -20, density: 1.2, serac: 1.0, thin: 0.5, raid: 1.3, storm: 0.5, hidden: 0.22, blurb: "Storm country. Whiteouts roll in without warning.", ground: ["#c9dff0", "#a3c1da"] },
  { name: "The Dead Glacier", length: 11000, temp: -26, density: 1.6, serac: 1.3, thin: 0.6, raid: 1.6, storm: 0.45, hidden: 0.3, blurb: "Bitter cold makes the ice brittle. Quakes are frequent.", ground: ["#bcd6ec", "#94b4d0"] },
  { name: "The Great Rift", length: 12000, temp: -30, density: 1.5, serac: 1.2, thin: 0.5, raid: 0.8, storm: 0.5, hidden: 0.25, blurb: "The shelf is tearing apart behind you. Outrun the Maw.", ground: ["#b4cde6", "#8aa9c8"] },
];

export interface MetaDef { id: string; name: string; desc: string; max: number; costs: number[]; icon: string; unlock?: boolean; }
export const META: MetaDef[] = [
  { id: "credits", name: "Patron Funding", desc: "+90 starting scrip per rank.", max: 5, costs: [10, 16, 24, 34, 46], icon: "💰" },
  { id: "efficiency", name: "Fuel Alchemy", desc: "-6% fuel burn per rank.", max: 3, costs: [14, 24, 38], icon: "⚗️" },
  { id: "morale", name: "Camp Culture", desc: "-10% morale decay per rank.", max: 3, costs: [12, 20, 32], icon: "🎻" },
  { id: "sense", name: "Ice Sense", desc: "+60 crevasse detection radius per rank.", max: 3, costs: [12, 20, 30], icon: "👁️" },
  { id: "planks", name: "Spare Planks", desc: "+2 starting bridge planks per rank.", max: 3, costs: [8, 14, 22], icon: "🪵" },
  { id: "crew", name: "Veteran Companion", desc: "An extra seasoned crew member joins you at the depot.", max: 1, costs: [30], icon: "🧑‍🤝‍🧑" },
  { id: "u_radar", name: "Unlock: Ice Radar", desc: "Radar modules appear in depot shops.", max: 1, costs: [25], icon: "📡", unlock: true },
  { id: "u_turret", name: "Unlock: Auto-Turret", desc: "Turret modules appear in depot shops.", max: 1, costs: [35], icon: "🎯", unlock: true },
  { id: "u_crawler", name: "Unlock: Crawler Wagon", desc: "Crawler wagons appear in depot shops.", max: 1, costs: [40], icon: "🚛", unlock: true },
];

export const TUTORIAL_STEPS = [
  "Hold W (or ↑) to throttle the tractor forward. Steer with A / D.",
  "Dodge the ice pillars (seracs). Steer around them — crashes hurt.",
  "A narrow crack! Build speed, then tap SPACE to jump the gap.",
  "Too wide to jump! Drive near it and press E to lay a plank bridge.",
  "Hidden crevasses lurk under snow. Watch for the ping when your scout spots one — then jump it.",
  "Brake to a stop and press C to make camp. Crew warm up and recover.",
  "Press R to fire a flare when raiders attack. Now drive to the station flag!",
];
