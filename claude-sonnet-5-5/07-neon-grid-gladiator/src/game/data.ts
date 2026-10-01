// Static definitions: weapon cores, modules, enemies, upgrades.

export type CoreId = "pulse" | "scatter" | "rail" | "burst" | "nova";
export type ModId =
  | "pierce"
  | "ricochet"
  | "homing"
  | "overcharge"
  | "overclock"
  | "explosive"
  | "chain"
  | "cryo"
  | "burn"
  | "multishot"
  | "vampiric"
  | "reflector";

export interface CoreDef {
  id: CoreId;
  name: string;
  desc: string;
  color: string;
  cost: number;
  damage: number;
  rate: number;
  count: number;
  spread: number;
  speed: number;
  life: number;
  size: number;
  pierce: number;
  burst: number;
  inaccuracy: number;
  ring: boolean;
}

export const CORES: Record<CoreId, CoreDef> = {
  pulse: {
    id: "pulse",
    name: "Pulse Core",
    desc: "Rapid-fire plasma bolts. Reliable and precise.",
    color: "#22e8ff",
    cost: 0,
    damage: 10,
    rate: 6.5,
    count: 1,
    spread: 0,
    speed: 820,
    life: 1.1,
    size: 4,
    pierce: 0,
    burst: 1,
    inaccuracy: 0.04,
    ring: false,
  },
  scatter: {
    id: "scatter",
    name: "Scatter Core",
    desc: "Wide cone of short-range pellets. Devastating up close.",
    color: "#ffb02e",
    cost: 260,
    damage: 6.5,
    rate: 1.8,
    count: 7,
    spread: 0.75,
    speed: 720,
    life: 0.55,
    size: 3.5,
    pierce: 0,
    burst: 1,
    inaccuracy: 0.05,
    ring: false,
  },
  rail: {
    id: "rail",
    name: "Rail Core",
    desc: "Slow, heavy slug that pierces through entire lines of foes.",
    color: "#ff4fd8",
    cost: 320,
    damage: 62,
    rate: 1.15,
    count: 1,
    spread: 0,
    speed: 1500,
    life: 1.2,
    size: 5.5,
    pierce: 3,
    burst: 1,
    inaccuracy: 0,
    ring: false,
  },
  burst: {
    id: "burst",
    name: "Burst Core",
    desc: "Four-round bursts with punishing stopping power.",
    color: "#7dff4f",
    cost: 280,
    damage: 11,
    rate: 2.1,
    count: 1,
    spread: 0,
    speed: 900,
    life: 1.1,
    size: 4,
    pierce: 0,
    burst: 4,
    inaccuracy: 0.05,
    ring: false,
  },
  nova: {
    id: "nova",
    name: "Nova Core",
    desc: "Fires a full ring of energy in every direction. Crowd control.",
    color: "#b56bff",
    cost: 340,
    damage: 8,
    rate: 1.5,
    count: 14,
    spread: 0,
    speed: 560,
    life: 0.85,
    size: 4,
    pierce: 0,
    burst: 1,
    inaccuracy: 0,
    ring: true,
  },
};

export interface ModDef {
  id: ModId;
  name: string;
  icon: string;
  color: string;
  cost: number;
  weight: number;
  desc: (lvl: number) => string;
}

export const MODS: Record<ModId, ModDef> = {
  pierce: {
    id: "pierce",
    name: "Phase Lance",
    icon: "➤",
    color: "#7af0ff",
    cost: 130,
    weight: 10,
    desc: (l) => `Bolts pierce ${l} extra foe${l > 1 ? "s" : ""}. −8% damage.`,
  },
  ricochet: {
    id: "ricochet",
    name: "Ricochet Coil",
    icon: "⟲",
    color: "#ffe14f",
    cost: 130,
    weight: 10,
    desc: (l) => `Bolts bounce off walls ${l + 1}×.`,
  },
  homing: {
    id: "homing",
    name: "Seeker Lens",
    icon: "◎",
    color: "#ff7a7a",
    cost: 150,
    weight: 8,
    desc: (l) => `Bolts curve toward enemies (steer ${(1.2 + l * 1.6).toFixed(1)}).`,
  },
  overcharge: {
    id: "overcharge",
    name: "Overcharger",
    icon: "✹",
    color: "#ff9d3d",
    cost: 140,
    weight: 10,
    desc: (l) => `+${40 * l}% damage, −${12 * l}% fire rate.`,
  },
  overclock: {
    id: "overclock",
    name: "Overclocker",
    icon: "≫",
    color: "#62ff9b",
    cost: 140,
    weight: 10,
    desc: (l) => `+${25 * l}% fire rate, −${4 * l}% damage.`,
  },
  explosive: {
    id: "explosive",
    name: "Volatile Tips",
    icon: "✸",
    color: "#ff5c3a",
    cost: 170,
    weight: 8,
    desc: (l) => `Hits detonate: ${45 + 15 * l}px blast for 55% damage.`,
  },
  chain: {
    id: "chain",
    name: "Arc Conductor",
    icon: "ϟ",
    color: "#b9a6ff",
    cost: 170,
    weight: 8,
    desc: (l) => `Hits arc to ${l} nearby foe${l > 1 ? "s" : ""} for 60% damage.`,
  },
  cryo: {
    id: "cryo",
    name: "Cryo Injector",
    icon: "❄",
    color: "#8fe8ff",
    cost: 140,
    weight: 8,
    desc: (l) => `Hits slow enemies ${Math.round((0.25 + 0.12 * l) * 100)}%. Burning + frozen = Thermal Shock.`,
  },
  burn: {
    id: "burn",
    name: "Plasma Igniter",
    icon: "♨",
    color: "#ff7a2e",
    cost: 140,
    weight: 8,
    desc: (l) => `Hits ignite for ${4 + 4 * l} dmg/sec for 3s.`,
  },
  multishot: {
    id: "multishot",
    name: "Split Barrel",
    icon: "⫶",
    color: "#ff6bd6",
    cost: 160,
    weight: 9,
    desc: (l) => `+${l} projectile${l > 1 ? "s" : ""}. −${6 * l}% damage each.`,
  },
  vampiric: {
    id: "vampiric",
    name: "Leech Node",
    icon: "✚",
    color: "#ff3b6e",
    cost: 150,
    weight: 6,
    desc: (l) => `Kills restore ${(1.5 * l).toFixed(1)} hull.`,
  },
  reflector: {
    id: "reflector",
    name: "Mirror Plating",
    icon: "◈",
    color: "#ffffff",
    cost: 160,
    weight: 7,
    desc: (l) => `Dash reflect: +${75 * l}% damage, +${25 * l}px radius, bigger refunds.`,
  },
};

export const MOD_IDS = Object.keys(MODS) as ModId[];
export const CORE_IDS = Object.keys(CORES) as CoreId[];

export interface ModInst {
  id: ModId;
  lvl: number;
}

export interface WeaponStats {
  color: string;
  damage: number;
  rate: number;
  count: number;
  spread: number;
  speed: number;
  life: number;
  size: number;
  pierce: number;
  bounce: number;
  homing: number;
  explode: number;
  chain: number;
  slow: number;
  burn: number;
  vamp: number;
  reflectMult: number;
  reflectRadius: number;
  burst: number;
  inaccuracy: number;
  ring: boolean;
}

export function computeWeapon(core: CoreId, mods: ModInst[]): WeaponStats {
  const c = CORES[core];
  const w: WeaponStats = {
    color: c.color,
    damage: c.damage,
    rate: c.rate,
    count: c.count,
    spread: c.spread,
    speed: c.speed,
    life: c.life,
    size: c.size,
    pierce: c.pierce,
    bounce: 0,
    homing: 0,
    explode: 0,
    chain: 0,
    slow: 0,
    burn: 0,
    vamp: 0,
    reflectMult: 1,
    reflectRadius: 62,
    burst: c.burst,
    inaccuracy: c.inaccuracy,
    ring: c.ring,
  };
  for (const m of mods) {
    const l = m.lvl;
    switch (m.id) {
      case "pierce":
        w.pierce += l;
        w.damage *= 0.92;
        break;
      case "ricochet":
        w.bounce += l + 1;
        w.life *= 1.35;
        break;
      case "homing":
        w.homing += 1.2 + l * 1.6;
        break;
      case "overcharge":
        w.damage *= 1 + 0.4 * l;
        w.rate *= 1 - 0.12 * l;
        break;
      case "overclock":
        w.rate *= 1 + 0.25 * l;
        w.damage *= 1 - 0.04 * l;
        break;
      case "explosive":
        w.explode = Math.max(w.explode, 45 + 15 * l);
        break;
      case "chain":
        w.chain += l;
        break;
      case "cryo":
        w.slow = Math.max(w.slow, 0.25 + 0.12 * l);
        break;
      case "burn":
        w.burn += 4 + 4 * l;
        break;
      case "multishot":
        if (w.ring) {
          w.count += 4 * l;
        } else {
          w.count += l;
          w.spread += 0.12 * l;
        }
        w.damage *= 1 - 0.06 * l;
        break;
      case "vampiric":
        w.vamp += 1.5 * l;
        break;
      case "reflector":
        w.reflectMult += 0.75 * l;
        w.reflectRadius += 25 * l;
        break;
    }
  }
  return w;
}

export type EnemyKind =
  | "drone"
  | "shooter"
  | "lancer"
  | "spinner"
  | "splitter"
  | "mini"
  | "sniper"
  | "tank"
  | "warden"
  | "hydra"
  | "overmind";

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  r: number;
  score: number;
  scrap: number;
  color: string;
  cost: number;
  minWave: number;
  weight: number;
  contact: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drone: { name: "Drone", hp: 22, speed: 150, r: 12, score: 10, scrap: 4, color: "#ff2e88", cost: 1, minWave: 1, weight: 10, contact: 12 },
  shooter: { name: "Gunner", hp: 34, speed: 110, r: 13, score: 20, scrap: 7, color: "#ffa62b", cost: 2, minWave: 2, weight: 7, contact: 10 },
  lancer: { name: "Lancer", hp: 40, speed: 120, r: 13, score: 25, scrap: 8, color: "#fff23d", cost: 2, minWave: 3, weight: 5, contact: 16 },
  spinner: { name: "Spinner", hp: 80, speed: 60, r: 17, score: 40, scrap: 12, color: "#b15cff", cost: 3, minWave: 4, weight: 4, contact: 12 },
  splitter: { name: "Splitter", hp: 64, speed: 95, r: 17, score: 30, scrap: 9, color: "#3dff8a", cost: 3, minWave: 5, weight: 4, contact: 14 },
  mini: { name: "Shard", hp: 14, speed: 235, r: 8, score: 5, scrap: 2, color: "#3dff8a", cost: 0, minWave: 99, weight: 0, contact: 8 },
  sniper: { name: "Sniper", hp: 32, speed: 90, r: 12, score: 45, scrap: 12, color: "#ff3b3b", cost: 3, minWave: 6, weight: 3, contact: 10 },
  tank: { name: "Bulwark", hp: 300, speed: 55, r: 27, score: 90, scrap: 28, color: "#ff6bd6", cost: 6, minWave: 7, weight: 2, contact: 22 },
  warden: { name: "THE WARDEN", hp: 2000, speed: 90, r: 48, score: 1000, scrap: 160, color: "#ff3355", cost: 0, minWave: 99, weight: 0, contact: 25 },
  hydra: { name: "HYDRA-9", hp: 4200, speed: 120, r: 46, score: 2500, scrap: 260, color: "#ffb000", cost: 0, minWave: 99, weight: 0, contact: 25 },
  overmind: { name: "THE OVERMIND", hp: 8000, speed: 110, r: 56, score: 6000, scrap: 420, color: "#d400ff", cost: 0, minWave: 99, weight: 0, contact: 28 },
};

export const BOSS_WAVES: Record<number, EnemyKind> = { 5: "warden", 10: "hydra", 15: "overmind" };
export const FINAL_WAVE = 15;

export type UpgradeId = "hull" | "dash" | "engine" | "magnet" | "slot" | "charge";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  color: string;
  max: number;
  base: number;
  step: number;
  desc: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "hull", name: "Hull Plating", icon: "♥", color: "#ff4f7a", max: 6, base: 110, step: 70, desc: "+25 max hull and instant repair of 25." },
  { id: "dash", name: "Dash Capacitor", icon: "»", color: "#22e8ff", max: 5, base: 140, step: 90, desc: "−12% dash recharge time." },
  { id: "engine", name: "Ion Thrusters", icon: "➶", color: "#7dff4f", max: 5, base: 100, step: 70, desc: "+7% movement speed." },
  { id: "magnet", name: "Scrap Magnet", icon: "U", color: "#ffe14f", max: 4, base: 90, step: 60, desc: "+35% scrap pickup radius." },
  { id: "charge", name: "Extra Dash Cell", icon: "⁝", color: "#b56bff", max: 1, base: 450, step: 0, desc: "+1 dash charge (up to 3)." },
  { id: "slot", name: "Third Module Slot", icon: "▣", color: "#ffb02e", max: 1, base: 520, step: 0, desc: "Equip three modules at once." },
];

export interface WaveModDef {
  id: string;
  name: string;
  desc: string;
  color: string;
}

export const WAVE_MODS: WaveModDef[] = [
  { id: "frenzy", name: "FRENZY", desc: "Enemies move 25% faster", color: "#ff9d3d" },
  { id: "armored", name: "ARMORED", desc: "Enemies +40% hull, +50% scrap", color: "#9ab0ff" },
  { id: "hell", name: "BULLET HELL", desc: "Enemies fire 35% faster", color: "#ff3b6e" },
  { id: "bounce", name: "RICOCHET FIELD", desc: "Enemy bullets bounce off walls", color: "#ffe14f" },
  { id: "gold", name: "GOLD RUSH", desc: "Double scrap, extra enemies", color: "#ffd700" },
  { id: "swarm", name: "SWARM", desc: "Many fragile enemies", color: "#3dff8a" },
];

export type BuffKind = "overdrive" | "quad" | "aegis" | "slowmo" | "phase" | "mutation" | "nova" | "magnet";

export const BUFFS: Record<BuffKind, { name: string; color: string; icon: string; dur: number }> = {
  overdrive: { name: "OVERDRIVE", color: "#62ff9b", icon: "≫", dur: 12 },
  quad: { name: "QUAD DAMAGE", color: "#ff9d3d", icon: "×4", dur: 12 },
  aegis: { name: "AEGIS", color: "#7af0ff", icon: "◍", dur: 18 },
  slowmo: { name: "TIME DILATION", color: "#b56bff", icon: "◴", dur: 7 },
  phase: { name: "PHASE DRIVE", color: "#ffffff", icon: "∞", dur: 9 },
  mutation: { name: "MUTATION", color: "#ff6bd6", icon: "?", dur: 14 },
  nova: { name: "NOVA BOMB", color: "#ffe14f", icon: "✺", dur: 0 },
  magnet: { name: "SCRAP STORM", color: "#ffd700", icon: "U", dur: 0 },
};
