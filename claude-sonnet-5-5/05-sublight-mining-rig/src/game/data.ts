export type Screen = "menu" | "playing" | "shop" | "paused" | "over" | "win";
export type SysKey = "engines" | "drill" | "weapons" | "cooling";
export type OreType = "iron" | "ice" | "crystal" | "core" | "scrap";
export type AstType = "iron" | "ice" | "crystal";
export type DroneType = "scout" | "breacher" | "jammer" | "overseer";

export const WORLD_W = 3000;
export const WORLD_H = 2200;
export const STATION = { x: WORLD_W / 2, y: WORLD_H / 2 };
export const MAX_SECTOR = 5;
export const MAX_PIPS = 5;

export const SYS: SysKey[] = ["engines", "drill", "weapons", "cooling"];
export const SYS_NAME: Record<SysKey, string> = {
  engines: "ENGINES",
  drill: "DRILL",
  weapons: "CANNON",
  cooling: "COOLING",
};

// index = pips allocated
export const ENG_F = [0.4, 0.7, 0.95, 1.15, 1.3, 1.45];
export const DRILL_F = [0, 0.55, 0.85, 1.1, 1.35, 1.6];
export const WEAP_F = [0, 0.6, 0.9, 1.2, 1.5, 1.8];

export const ORE: Record<OreType, { name: string; value: number; weight: number; color: string }> = {
  iron: { name: "Iron", value: 5, weight: 1, color: "#e8965c" },
  ice: { name: "Ice", value: 7, weight: 1, color: "#7fe8ff" },
  crystal: { name: "Crystal", value: 16, weight: 1, color: "#ff6bf0" },
  core: { name: "Core", value: 120, weight: 3, color: "#ffd84a" },
  scrap: { name: "Drone Scrap", value: 8, weight: 1, color: "#b8ff6b" },
};

export interface SectorCfg {
  name: string;
  quota: number;
  cap: number;
  base: number;
  w: { scout: number; breacher: number; jammer: number };
  asteroids: number;
  crystal: number;
  blurb: string;
}

export const SECTORS: SectorCfg[] = [
  {
    name: "KUIPER SHALLOWS",
    quota: 300,
    cap: 3,
    base: 16,
    w: { scout: 1, breacher: 0, jammer: 0 },
    asteroids: 14,
    crystal: 0.1,
    blurb: "Quiet rock, a few stray scout drones. Learn your rig.",
  },
  {
    name: "CERES DRIFT",
    quota: 650,
    cap: 5,
    base: 14,
    w: { scout: 0.6, breacher: 0.4, jammer: 0 },
    asteroids: 15,
    crystal: 0.18,
    blurb: "Breacher drones ram hulls. Keep them off you.",
  },
  {
    name: "VESTA GRAVEYARD",
    quota: 1100,
    cap: 6,
    base: 12,
    w: { scout: 0.4, breacher: 0.3, jammer: 0.3 },
    asteroids: 16,
    crystal: 0.25,
    blurb: "EMP jammers fry your power routing. Re-route fast.",
  },
  {
    name: "PALLAS FOUNDRY",
    quota: 1700,
    cap: 8,
    base: 10,
    w: { scout: 0.3, breacher: 0.4, jammer: 0.3 },
    asteroids: 16,
    crystal: 0.3,
    blurb: "Dense crystal veins. Dense hostile traffic.",
  },
  {
    name: "THE MOTHERLODE",
    quota: 2500,
    cap: 9,
    base: 9,
    w: { scout: 0.3, breacher: 0.35, jammer: 0.35 },
    asteroids: 18,
    crystal: 0.35,
    blurb: "The Overseer guards the richest field. Meet quota and destroy it.",
  },
];

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
  effect: (lvl: number) => string;
}

const curve = (base: number, mult: number) => (lvl: number) => Math.round((base * Math.pow(mult, lvl)) / 5) * 5;

export const UPGRADES: UpgradeDef[] = [
  {
    id: "drill",
    name: "Diamond Drill Bit",
    desc: "Faster rock carving and core breaching.",
    max: 5,
    cost: curve(90, 1.65),
    effect: (l) => `+${l * 22}% drill speed`,
  },
  {
    id: "range",
    name: "Extended Drill Arm",
    desc: "Reach rock from farther away.",
    max: 4,
    cost: curve(80, 1.6),
    effect: (l) => `${90 + l * 14}px reach`,
  },
  {
    id: "cargo",
    name: "Cargo Hold",
    desc: "More ore per trip. Cores weigh 3 units.",
    max: 5,
    cost: curve(70, 1.6),
    effect: (l) => `${20 + l * 10} units`,
  },
  {
    id: "hull",
    name: "Hull Plating",
    desc: "More structural integrity.",
    max: 5,
    cost: curve(85, 1.6),
    effect: (l) => `${100 + l * 30} hull`,
  },
  {
    id: "heat",
    name: "Heat Sink Fins",
    desc: "Bleed heat faster at any cooling level.",
    max: 5,
    cost: curve(100, 1.6),
    effect: (l) => `+${l * 20}% cooling`,
  },
  {
    id: "reactor",
    name: "Fusion Reactor Core",
    desc: "Adds a power pip to route. The key to everything.",
    max: 4,
    cost: curve(220, 1.9),
    effect: (l) => `${6 + l} power pips`,
  },
  {
    id: "cannon",
    name: "Pulse Cannon Lens",
    desc: "Harder-hitting shots against drones.",
    max: 5,
    cost: curve(90, 1.6),
    effect: (l) => `${10 + l * 5} damage`,
  },
  {
    id: "thrust",
    name: "Ion Thrusters",
    desc: "Stronger acceleration.",
    max: 4,
    cost: curve(75, 1.55),
    effect: (l) => `+${l * 12}% thrust`,
  },
  {
    id: "tractor",
    name: "Tractor Coil",
    desc: "Pulls ore from farther away.",
    max: 4,
    cost: curve(60, 1.6),
    effect: (l) => `${80 + l * 30}px pull`,
  },
];
