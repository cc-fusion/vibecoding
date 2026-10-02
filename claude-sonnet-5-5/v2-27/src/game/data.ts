export type DmgType = "energy" | "kinetic" | "explosive"; // damage families used by adaptation
export type ModId =
  | "bridge" | "reactor" | "solar" | "engine" | "gyro" | "quarters" | "corridor" | "armor"
  | "pulse" | "turret" | "railgun" | "missile" | "shield" | "radiator" | "sink" | "battery"
  | "repair" | "targeting" | "cargo";
/** Module palette categories. */
export type Cat = "Structure" | "Power" | "Propulsion" | "Weapons" | "Defense" | "Thermal" | "Crew" | "Utility";
export type Layout = (ModId | null)[];
export type Resist = { energy: number; kinetic: number; explosive: number };
export type ModsState = { glass: boolean; blackout: boolean; swarm: boolean };
export type DiffKey = "cadet" | "veteran" | "warlord";

export interface WeaponDef {
  kind: "pulse" | "turret" | "rail" | "missile";
  group: "cannon" | "missile" | "turret";
  dmg: number; rate: number; speed: number; range: number; type: DmgType; heatShot: number;
}
export interface ModDef {
  id: ModId; name: string; cat: Cat; desc: string; color: string;
  cost: number; mass: number; hp: number;
  power: number; active: number; heat: number; heatActive: number;
  crew: number; crewProv: number; passable: boolean;
  thrust: number; torque: number; shield: number; heatCap: number; dissip: number; battery: number; repair: number;
  weapon?: WeaponDef;
}

const base = {
  power: 0, active: 0, heat: 0, heatActive: 0, crew: 0, crewProv: 0, passable: true,
  thrust: 0, torque: 0, shield: 0, heatCap: 0, dissip: 0, battery: 0, repair: 0,
};
type Req = Pick<ModDef, "id" | "name" | "cat" | "desc" | "color" | "cost" | "mass" | "hp">;
function mk(p: Req & Partial<ModDef>): ModDef {
  return { ...base, ...p } as ModDef;
}

export const MODS: Record<ModId, ModDef> = {
  bridge: mk({ id: "bridge", name: "Command Bridge", cat: "Structure", color: "#7dd3fc", cost: 0, mass: 4, hp: 120, power: 2, heat: 0.3, crewProv: 2,
    desc: "The heart of your ship. If it is destroyed, the sortie is lost. Generates a little power and houses 2 crew." }),
  reactor: mk({ id: "reactor", name: "Fusion Reactor", cat: "Power", color: "#fbbf24", cost: 120, mass: 6, hp: 40, power: 10, heat: 3, crew: 1,
    desc: "+10 power, runs hot (+3 heat/s). Needs 1 crew. Explodes violently when destroyed." }),
  solar: mk({ id: "solar", name: "Solar Array", cat: "Power", color: "#38bdf8", cost: 45, mass: 2, hp: 16, power: 3, passable: false,
    desc: "+3 power, no heat, no crew. Fragile and blocks crew corridors. Great on the hull's edge." }),
  engine: mk({ id: "engine", name: "Ion Thruster", cat: "Propulsion", color: "#fb923c", cost: 60, mass: 4, hp: 30, power: -0.3, active: -2.5, heatActive: 2.5, crew: 1, thrust: 14,
    desc: "+14 thrust. Draws power and heat while thrusting. Needs 1 crew. Thrust / mass sets your speed." }),
  gyro: mk({ id: "gyro", name: "Gyro Stabiliser", cat: "Propulsion", color: "#a78bfa", cost: 40, mass: 2, hp: 24, power: -0.2, active: -1, heat: 0.1, torque: 1,
    desc: "Improves turn rate. No crew needed." }),
  quarters: mk({ id: "quarters", name: "Crew Quarters", cat: "Crew", color: "#86efac", cost: 50, mass: 3, hp: 30, power: -0.5, heat: 0.3, crewProv: 4,
    desc: "Houses 4 crew. Crew walk only through connected, non-armor modules to reach stations." }),
  corridor: mk({ id: "corridor", name: "Corridor", cat: "Crew", color: "#94a3b8", cost: 8, mass: 1, hp: 20,
    desc: "Cheap connector that lets crew flow between modules." }),
  armor: mk({ id: "armor", name: "Armor Plate", cat: "Structure", color: "#64748b", cost: 25, mass: 4, hp: 90, passable: false,
    desc: "Tough plating that physically absorbs hits. Crew cannot walk through it." }),
  pulse: mk({ id: "pulse", name: "Pulse Cannon", cat: "Weapons", color: "#f472b6", cost: 70, mass: 3, hp: 24, active: -2.5, crew: 1,
    weapon: { kind: "pulse", group: "cannon", dmg: 7, rate: 3.5, speed: 720, range: 650, type: "energy", heatShot: 1.1 },
    desc: "Fixed forward energy bolts. Fast and reliable, runs warm." }),
  turret: mk({ id: "turret", name: "Auto-Turret", cat: "Weapons", color: "#fda4af", cost: 80, mass: 3, hp: 24, active: -1.5, crew: 1,
    weapon: { kind: "turret", group: "turret", dmg: 4, rate: 4, speed: 650, range: 380, type: "kinetic", heatShot: 0.6 },
    desc: "360° self-aiming kinetic gun. Prioritises incoming missiles (point defence)." }),
  railgun: mk({ id: "railgun", name: "Railgun", cat: "Weapons", color: "#c084fc", cost: 220, mass: 8, hp: 36, active: -6, crew: 2,
    weapon: { kind: "rail", group: "cannon", dmg: 48, rate: 0.7, speed: 1500, range: 1100, type: "kinetic", heatShot: 9 },
    desc: "Piercing kinetic slug. Huge damage, huge heat spike, needs 2 crew and lots of power." }),
  missile: mk({ id: "missile", name: "Missile Pod", cat: "Weapons", color: "#f87171", cost: 160, mass: 5, hp: 28, active: -1, crew: 1,
    weapon: { kind: "missile", group: "missile", dmg: 34, rate: 0.55, speed: 330, range: 900, type: "explosive", heatShot: 3.5 },
    desc: "Homing explosive missiles with area damage. Fired with the missile trigger." }),
  shield: mk({ id: "shield", name: "Shield Generator", cat: "Defense", color: "#22d3ee", cost: 200, mass: 5, hp: 30, power: -3.5, heat: 1.8, crew: 1, shield: 60,
    desc: "+60 shield capacity and fast regen. Constant power draw and heat. Needs 1 crew." }),
  radiator: mk({ id: "radiator", name: "Radiator", cat: "Thermal", color: "#ff7a59", cost: 40, mass: 2, hp: 14, dissip: 4.5, passable: false,
    desc: "Sheds heat. Exposed to open space it works ×1.5; buried inside the hull only ×0.5." }),
  sink: mk({ id: "sink", name: "Heat Sink", cat: "Thermal", color: "#60a5fa", cost: 50, mass: 4, hp: 40, heatCap: 50,
    desc: "+50 heat capacity: a thermal buffer for burst fire." }),
  battery: mk({ id: "battery", name: "Capacitor Bank", cat: "Power", color: "#a3e635", cost: 90, mass: 4, hp: 30, battery: 40,
    desc: "Stores 40 energy. Covers power deficits so systems don't brown out during bursts." }),
  repair: mk({ id: "repair", name: "Repair Bay", cat: "Utility", color: "#4ade80", cost: 150, mass: 4, hp: 30, power: -2.5, heat: 0.8, crew: 1, repair: 6,
    desc: "Nanite drones restore 6 HP/s to the most damaged module within 3 cells." }),
  targeting: mk({ id: "targeting", name: "Targeting Computer", cat: "Utility", color: "#facc15", cost: 140, mass: 3, hp: 24, power: -2, heat: 0.6, crew: 1,
    desc: "+8% damage to all weapons per unit (max +40%)." }),
  cargo: mk({ id: "cargo", name: "Salvage Hold", cat: "Utility", color: "#d6a45a", cost: 90, mass: 4, hp: 40,
    desc: "+12% credits per hold (max +60%) and a wider scrap magnet. Adds mass." }),
};

export const MOD_ORDER: ModId[] = [
  "armor", "corridor", "reactor", "solar", "battery", "engine", "gyro", "quarters",
  "pulse", "turret", "railgun", "missile", "shield", "radiator", "sink", "repair", "targeting", "cargo",
];
export const STARTER_MODS: ModId[] = ["bridge", "reactor", "solar", "engine", "gyro", "quarters", "corridor", "armor", "pulse", "turret", "radiator"];

/* ---------------- Hulls ---------------- */
export interface HullDef {
  id: string; name: string; w: number; h: number; widths: number[]; cap: number; bridge: { x: number; y: number }; desc: string;
}
export const HULLS: HullDef[] = [
  { id: "skiff", name: "Wasp Skiff", w: 7, h: 7, widths: [1, 3, 5, 5, 7, 7, 5], cap: 60, bridge: { x: 3, y: 2 }, desc: "Nimble starter hull. Tight mass budget." },
  { id: "corvette", name: "Hornet Corvette", w: 9, h: 9, widths: [1, 3, 5, 7, 7, 9, 9, 7, 5], cap: 105, bridge: { x: 4, y: 3 }, desc: "Balanced hull with room for a shield and a railgun." },
  { id: "frigate", name: "Lance Frigate", w: 11, h: 11, widths: [1, 3, 5, 7, 9, 9, 11, 11, 9, 9, 7], cap: 165, bridge: { x: 5, y: 4 }, desc: "Heavy hull for layered defense and wide arsenals." },
  { id: "cruiser", name: "Bulwark Cruiser", w: 13, h: 13, widths: [3, 5, 7, 9, 11, 11, 13, 13, 13, 11, 11, 9, 7], cap: 250, bridge: { x: 6, y: 5 }, desc: "Capital-class platform. Thermal and crew logistics become the puzzle." },
];
export const hullById = (id: string): HullDef => HULLS.find((h) => h.id === id) || HULLS[0];

export const STARTER_BUILD: [number, number, ModId][] = [
  [3, 0, "pulse"],
  [2, 1, "armor"], [3, 1, "corridor"], [4, 1, "armor"],
  [1, 2, "pulse"], [2, 2, "corridor"], [3, 2, "bridge"], [4, 2, "corridor"], [5, 2, "pulse"],
  [1, 3, "radiator"], [2, 3, "quarters"], [3, 3, "corridor"], [4, 3, "reactor"], [5, 3, "radiator"],
  [3, 4, "corridor"],
  [2, 5, "engine"], [3, 5, "corridor"], [4, 5, "engine"],
];

/* ---------------- Tech tree ---------------- */
export interface TechNode {
  id: string; name: string; desc: string; kind: "module" | "hull" | "passive" | "upgrade"; costs: number[]; req?: string[];
}
export const TECH: TechNode[] = [
  { id: "corvette", name: "Hornet Corvette Hull", kind: "hull", costs: [2], desc: "9×9 hull, 105 mass capacity." },
  { id: "frigate", name: "Lance Frigate Hull", kind: "hull", costs: [4], req: ["corvette"], desc: "11×11 hull, 165 mass capacity." },
  { id: "cruiser", name: "Bulwark Cruiser Hull", kind: "hull", costs: [6], req: ["frigate"], desc: "13×13 hull, 250 mass capacity." },
  { id: "battery", name: "Capacitor Bank", kind: "module", costs: [1], desc: "Unlocks power buffering." },
  { id: "sink", name: "Heat Sink", kind: "module", costs: [1], desc: "Unlocks thermal buffers." },
  { id: "cargo", name: "Salvage Hold", kind: "module", costs: [1], desc: "Unlocks credit-boosting cargo." },
  { id: "shield", name: "Shield Generator", kind: "module", costs: [2], desc: "Unlocks deflector shields." },
  { id: "missile", name: "Missile Pod", kind: "module", costs: [2], desc: "Unlocks homing explosive ordnance." },
  { id: "targeting", name: "Targeting Computer", kind: "module", costs: [2], desc: "Unlocks damage amplification." },
  { id: "railgun", name: "Railgun", kind: "module", costs: [3], req: ["battery"], desc: "Unlocks piercing kinetic cannons." },
  { id: "repair", name: "Repair Bay", kind: "module", costs: [3], req: ["p_alloy"], desc: "Unlocks nanite repair." },
  { id: "p_reactor", name: "Reactor Efficiency", kind: "passive", costs: [2, 3, 4], desc: "+12% power output per level." },
  { id: "p_coolant", name: "Coolant Coatings", kind: "passive", costs: [2, 3, 4], desc: "+15% heat dissipation per level." },
  { id: "p_alloy", name: "Reinforced Alloys", kind: "passive", costs: [2, 3, 4], desc: "+15% module HP per level." },
  { id: "p_ballistics", name: "Ballistics Lab", kind: "passive", costs: [2, 3, 4], desc: "+10% weapon damage per level." },
  { id: "p_thrust", name: "Thruster Tuning", kind: "passive", costs: [2, 3, 4], desc: "+12% engine thrust per level." },
  { id: "p_crew", name: "Crew Training", kind: "passive", costs: [2, 3], desc: "+1 crew capacity per Crew Quarters per level." },
  { id: "p_shield", name: "Deflector Harmonics", kind: "passive", costs: [3, 4], desc: "+20% shield capacity & regen per level.", req: ["shield"] },
  { id: "p_salvage", name: "Salvage Contracts", kind: "passive", costs: [2, 3], desc: "+15% credits earned per level." },
];
export const techById = (id: string) => TECH.find((t) => t.id === id)!;
export const isModUnlocked = (id: ModId, tech: Record<string, number>) => STARTER_MODS.includes(id) || (tech[id] || 0) > 0;
export const isHullUnlocked = (id: string, tech: Record<string, number>) => id === "skiff" || (tech[id] || 0) > 0;

/* ---------------- Difficulty ---------------- */
export const DIFFS: Record<DiffKey, { name: string; hp: number; dmg: number; cred: number; desc: string }> = {
  cadet: { name: "Cadet", hp: 0.75, dmg: 0.7, cred: 0.85, desc: "Enemies are fragile and hit softly. Credits ×0.85." },
  veteran: { name: "Veteran", hp: 1, dmg: 1, cred: 1, desc: "The intended experience." },
  warlord: { name: "Warlord", hp: 1.35, dmg: 1.3, cred: 1.4, desc: "Tough, aggressive fleets. Credits ×1.4." },
};
export const MOD_INFO: Record<keyof ModsState, { name: string; desc: string; cred: number }> = {
  glass: { name: "Glass Hull", desc: "Your modules have 40% less HP.", cred: 0.35 },
  blackout: { name: "Blackout", desc: "Solar flares strike constantly in every sector.", cred: 0.25 },
  swarm: { name: "Swarm Protocol", desc: "Enemy waves are 40% larger.", cred: 0.3 },
};

/* ---------------- Enemies ---------------- */
export type EType = "drone" | "fighter" | "bomber" | "ion" | "lancer" | "minelayer" | "carrier" | "mine" | "boss1" | "boss2";
export interface EnemyDef { name: string; hp: number; r: number; value: number; cost: number; unlock: number; color: string; desc: string; counter: string }
export const ENEMIES: Record<EType, EnemyDef> = {
  drone: { name: "Kamikaze Drone", hp: 14, r: 9, value: 8, cost: 1, unlock: 1, color: "#fca5a5", desc: "Fast rammers that explode on your hull.", counter: "Turrets and armor on the nose." },
  fighter: { name: "Raider Fighter", hp: 34, r: 12, value: 18, cost: 2, unlock: 1, color: "#fdba74", desc: "Circles you, firing 3-round bolt bursts.", counter: "Shields soak the bolts; pulse cannons kill them quickly." },
  bomber: { name: "Missile Corvette", hp: 60, r: 16, value: 28, cost: 3, unlock: 2, color: "#f87171", desc: "Stays at range launching homing missiles.", counter: "Turrets shoot missiles down. Break line of fire behind rocks." },
  ion: { name: "Ion Skirmisher", hp: 50, r: 14, value: 30, cost: 3, unlock: 3, color: "#67e8f9", desc: "Ion bolts drain your capacitors and inject heat.", counter: "Keep heat headroom and a capacitor bank." },
  lancer: { name: "Beam Lancer", hp: 90, r: 18, value: 44, cost: 4, unlock: 5, color: "#fde047", desc: "Charges a telegraphed beam that slices through armor.", counter: "Move out of the beam line when it flashes." },
  minelayer: { name: "Mine Layer", hp: 70, r: 16, value: 36, cost: 3, unlock: 6, color: "#86efac", desc: "Drops drifting proximity mines.", counter: "Shoot mines at range; stay mobile." },
  carrier: { name: "Hive Carrier", hp: 220, r: 26, value: 90, cost: 6, unlock: 7, color: "#c4b5fd", desc: "Launches waves of drones. Priority target.", counter: "Railguns and missiles; keep turrets alive." },
  mine: { name: "Proximity Mine", hp: 8, r: 8, value: 0, cost: 0, unlock: 99, color: "#bef264", desc: "Explodes near your hull.", counter: "Shoot it." },
  boss1: { name: "The Matriarch", hp: 1100, r: 36, value: 400, cost: 0, unlock: 99, color: "#f0abfc", desc: "Hive-mother. Bolt fans, drone swarms, beam sweeps and missile salvos.", counter: "Kill escorts, dodge beams, pour on damage." },
  boss2: { name: "The Void Sovereign", hp: 2800, r: 46, value: 1000, cost: 0, unlock: 99, color: "#a5b4fc", desc: "Bullet spirals, nova rings, thermal surges and EMP storms.", counter: "Keep heat low and capacitors full. Weave the gaps." },
};

/* ---------------- Sorties ---------------- */
export type Env = "open" | "asteroids" | "nebula" | "flare";
export interface SortieDef { n: number; name: string; env: Env; waves: number; boss?: EType; blurb: string; pool: EType[] }
export const ENV_INFO: Record<Env, { name: string; desc: string }> = {
  open: { name: "Open Space", desc: "No hazards." },
  asteroids: { name: "Asteroid Field", desc: "Rocks block all projectiles and hurt on collision. Use them as cover." },
  nebula: { name: "Ion Nebula", desc: "Dense gas: heat dissipation −35%." },
  flare: { name: "Solar Tempest", desc: "Periodic flares cut power output by 65%. Capacitors matter." },
};
const CAMPAIGN: { name: string; env: Env; waves: number; boss?: EType; blurb: string }[] = [
  { name: "Shakedown at Cinder Gate", env: "open", waves: 3, blurb: "Prove your hull holds together. Light raider presence." },
  { name: "Rockfall Run", env: "asteroids", waves: 3, blurb: "Missile corvettes lurk in the debris." },
  { name: "Ion Veil", env: "nebula", waves: 4, blurb: "Ion skirmishers prey on overheating ships." },
  { name: "The Matriarch", env: "open", waves: 3, boss: "boss1", blurb: "A hive-mother blocks the lane. First capstone." },
  { name: "Lancer Corridor", env: "asteroids", waves: 4, blurb: "Beam lancers target armored ships." },
  { name: "Solar Tempest", env: "flare", waves: 4, blurb: "Flares will starve your reactors. Mine layers exploit it." },
  { name: "Hive Drift", env: "nebula", waves: 5, blurb: "Carriers flood the nebula with drones." },
  { name: "The Void Sovereign", env: "flare", waves: 4, boss: "boss2", blurb: "The final adversary. Everything you have learned will be tested." },
];
export const CAMPAIGN_LEN = CAMPAIGN.length;
const REG: EType[] = ["drone", "fighter", "bomber", "ion", "lancer", "minelayer", "carrier"];
export function getSortie(n: number): SortieDef {
  const pool = REG.filter((t) => ENEMIES[t].unlock <= n);
  if (n <= CAMPAIGN.length) {
    const c = CAMPAIGN[n - 1];
    return { n, name: c.name, env: c.env, waves: c.waves, boss: c.boss, blurb: c.blurb, pool };
  }
  const envs: Env[] = ["open", "asteroids", "nebula", "flare"];
  const boss: EType | undefined = n % 8 === 0 ? "boss2" : n % 4 === 0 ? "boss1" : undefined;
  return {
    n, name: `Endless Sortie ${n - CAMPAIGN.length}`, env: envs[n % 4], waves: Math.min(7, 4 + Math.floor((n - 8) / 3)), boss,
    blurb: "The war never ends. Enemy fleets keep evolving.", pool,
  };
}

export interface ShipProfile { shield: number; armor: number; speed: number; turrets: number }
export function doctrineNotes(p: ShipProfile): string[] {
  const out: string[] = [];
  if (p.shield > 80) out.push("Heavy shields detected → more Ion Skirmishers");
  if (p.armor >= 6) out.push("Thick armor detected → more Beam Lancers & Missile Corvettes");
  if (p.speed > 0.8) out.push("Fast ship detected → more Drones & Mine Layers");
  if (p.turrets >= 2) out.push("Point defense detected → missile saturation");
  if (!out.length) out.push("Balanced ship – no doctrine shift");
  return out;
}
export function composeWave(s: SortieDef, wave: number, p: ShipProfile, swarm: boolean): EType[] {
  let budget = (3 + wave * 2.2 + (s.n - 1) * 1.5) * (swarm ? 1.4 : 1);
  budget = Math.min(budget, 46);
  const w: Record<string, number> = {};
  for (const t of s.pool) {
    let k = 1;
    if (t === "ion") k = 1 + p.shield / 80;
    if (t === "lancer") k = 1 + p.armor / 6;
    if (t === "bomber") k = (1 + p.armor / 14) * (p.turrets >= 2 ? 1.6 : 1);
    if (t === "drone" || t === "minelayer") k = p.speed > 0.8 ? 1.6 : 1;
    if (t === "carrier" && wave < 2) k = 0;
    w[t] = k;
  }
  const out: EType[] = [];
  let guard = 0;
  while (budget > 0.5 && out.length < 24 && guard++ < 80) {
    const opts = s.pool.filter((t) => ENEMIES[t].cost <= budget && w[t] > 0);
    if (!opts.length) break;
    const tot = opts.reduce((a, t) => a + w[t], 0);
    let r = Math.random() * tot;
    let pick = opts[0];
    for (const t of opts) { r -= w[t]; if (r <= 0) { pick = t; break; } }
    out.push(pick);
    budget -= ENEMIES[pick].cost;
  }
  if (!out.length) out.push("drone");
  return out;
}
export function resistFromMemory(mem: Resist, sortieN: number): Resist {
  const tot = mem.energy + mem.kinetic + mem.explosive;
  const r: Resist = { energy: 0, kinetic: 0, explosive: 0 };
  if (tot < 80 || sortieN < 2) return r;
  (Object.keys(r) as (keyof Resist)[]).forEach((k) => {
    r[k] = Math.max(0, Math.min(0.35, (mem[k] / tot - 0.45) * 1.0));
  });
  return r;
}
