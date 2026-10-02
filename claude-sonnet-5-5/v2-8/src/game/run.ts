import {
  CREW_ICONS, DIFFS, GOODS, GOOD_IDS, LEGS, MODS, MODULES, NAMES, ROLE_IDS, STATIONS, TRAIT_IDS, VTYPES,
  type GoodId, type ModuleId, type Role, type Trait, type VType,
} from "./data";

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Vehicle {
  id: number; type: VType; modules: (ModuleId | null)[]; hull: number;
  x: number; y: number; ang: number; air: number; stuck: number; stuckMax: number; immune: number;
  flash: number; bridgeId: number; thin: number; gunCd: number;
}
export interface Crew {
  id: number; name: string; role: Role; trait: Trait; icon: string;
  morale: number; warmth: number; health: number; alive: boolean; lowT: number;
}
export interface Contract { good: GoodId; qty: number; dest: number; reward: number; }
export interface Candidate { crew: Crew; cost: number; }
export interface Market {
  prices: number[]; shock: { good: GoodId; mult: number; text: string } | null;
  fuel: number; food: number; plank: number; flare: number; offer: Contract | null;
  candidates: Candidate[]; feasted: boolean;
}
export interface Stats {
  distance: number; legs: number; time: number; jumps: number; bridges: number; falls: number; raiders: number;
  raids: number; profit: number; crewLost: number; quakes: number; camps: number; pickups: number;
  contracts: number; crashes: number; flares: number; vehiclesLost: number;
}
export interface Run {
  seed: number; diffIdx: number; mods: string[]; levels: Record<string, number>;
  station: number; credits: number; fuel: number; food: number; planks: number; flares: number;
  goods: Record<GoodId, number>; goodsCost: Record<GoodId, number>;
  vehicles: Vehicle[]; crew: Crew[]; bonds: Record<string, number>;
  market: Market; contract: Contract | null; stats: Stats; nextId: number; clock: number;
}

export const bondKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const getBond = (r: Run, a: number, b: number) => r.bonds[bondKey(a, b)] ?? 0;
export const addBond = (r: Run, a: number, b: number, d: number) => {
  const k = bondKey(a, b);
  r.bonds[k] = Math.max(-100, Math.min(100, (r.bonds[k] ?? 0) + d));
};

export function newVehicle(r: { nextId: number }, type: VType): Vehicle {
  return {
    id: r.nextId++, type, modules: Array(VTYPES[type].slots).fill(null), hull: VTYPES[type].hull,
    x: 0, y: 0, ang: 0, air: -1, stuck: 0, stuckMax: 0, immune: 0, flash: 0, bridgeId: -1, thin: 0, gunCd: 0,
  };
}

export function newCrew(r: { nextId: number }, rng: () => number, role?: Role, used: string[] = []): Crew {
  const pool = NAMES.filter((n) => !used.includes(n));
  const name = (pool.length ? pool : NAMES)[Math.floor(rng() * (pool.length || NAMES.length))];
  return {
    id: r.nextId++, name, role: role ?? ROLE_IDS[Math.floor(rng() * ROLE_IDS.length)],
    trait: TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)], icon: CREW_ICONS[Math.floor(rng() * CREW_ICONS.length)],
    morale: 70 + Math.floor(rng() * 20), warmth: 90, health: 100, alive: true, lowT: 0,
  };
}

export interface Derived {
  weight: number; fuelCap: number; cargoCap: number; plankCap: number; top: number; grip: number; reveal: number;
  heat: number; crewCap: number; turbo: number; cabins: number; winch: number; bridgeMods: number; heaters: number;
  goodsTotal: number; loadFactor: number;
}
export const count = (r: Run, m: ModuleId) =>
  r.vehicles.reduce((a, v) => a + v.modules.filter((x) => x === m).length, 0);
export const goodsTotal = (r: Run) => GOOD_IDS.reduce((a, g) => a + r.goods[g], 0);

export function roleFactor(r: Run, role: Role): number {
  let s = 0;
  for (const c of r.crew) {
    if (!c.alive || c.role !== role) continue;
    s += c.morale >= 25 ? 0.65 + (0.35 * c.morale) / 100 : 0.35;
  }
  return Math.min(1.5, s);
}

export function hullMax(v: Vehicle): number {
  return VTYPES[v.type].hull + 60 * v.modules.filter((m) => m === "armor").length;
}

export function derive(r: Run): Derived {
  let weight = 0, fuelCap = 0, cargoCap = 0, plankCap = 0, cabins = 0;
  for (const v of r.vehicles) {
    const t = VTYPES[v.type];
    weight += t.weight; fuelCap += t.fuel; cargoCap += t.cargo; plankCap += t.planks;
    if (v.type === "cabin") cabins++;
    for (const m of v.modules) if (m) weight += MODULES[m].weight;
  }
  const tanks = count(r, "tank"), racks = count(r, "rack"), bm = count(r, "bridge");
  fuelCap += 60 * tanks; cargoCap += 10 * racks; plankCap += 4 * bm;
  const gt = goodsTotal(r);
  weight += gt + r.fuel * 0.1 + r.food * 0.1;
  const turbo = Math.min(3, count(r, "turbo"));
  const top = (135 * (1 + 0.12 * turbo)) / (1 + 0.0025 * weight);
  const driver = roleFactor(r, "driver"), scout = roleFactor(r, "scout");
  const grip = 1 + 0.25 * Math.min(3, count(r, "anchor")) + 0.2 * driver;
  const reveal = 90 + 150 * scout + 260 * Math.min(2, count(r, "radar")) + 60 * (r.levels.sense || 0);
  const heaters = count(r, "heater");
  return {
    weight, fuelCap, cargoCap, plankCap, top, grip, reveal, heat: 7 * heaters + 5 * cabins,
    crewCap: 4 + 2 * cabins, turbo, cabins, winch: count(r, "winch"), bridgeMods: bm, heaters,
    goodsTotal: gt, loadFactor: 1 + weight / 250,
  };
}

export function clampResources(r: Run) {
  const d = derive(r);
  r.fuel = Math.max(0, Math.min(d.fuelCap, r.fuel));
  r.planks = Math.max(0, Math.min(d.plankCap, r.planks));
  r.food = Math.max(0, r.food);
}

export function createRun(diffIdx: number, mods: string[], levels: Record<string, number>, seed: number): Run {
  const rng = mulberry32(seed);
  const diff = DIFFS[diffIdx] ?? DIFFS[1];
  const lean = mods.includes("lean") ? 0.5 : 1;
  const base = { nextId: 1 };
  const r: Run = {
    seed, diffIdx, mods, levels, station: 0,
    credits: Math.round(450 * diff.credits) + 90 * (levels.credits || 0),
    fuel: Math.round(70 * lean), food: Math.round(60 * lean), planks: Math.round((4 + 2 * (levels.planks || 0)) * lean), flares: 2,
    goods: { furs: 0, medicine: 0, crystal: 0, parts: 0 }, goodsCost: { furs: 0, medicine: 0, crystal: 0, parts: 0 },
    vehicles: [], crew: [], bonds: {},
    market: { prices: [], shock: null, fuel: 3, food: 4, plank: 12, flare: 25, offer: null, candidates: [], feasted: false },
    contract: null, nextId: 1, clock: 0,
    stats: {
      distance: 0, legs: 0, time: 0, jumps: 0, bridges: 0, falls: 0, raiders: 0, raids: 0, profit: 0, crewLost: 0,
      quakes: 0, camps: 0, pickups: 0, contracts: 0, crashes: 0, flares: 0, vehiclesLost: 0,
    },
  };
  r.nextId = base.nextId;
  const tractor = newVehicle(r, "tractor");
  tractor.modules[0] = "heater"; tractor.modules[1] = "bridge";
  r.vehicles.push(tractor, newVehicle(r, "sled"));
  const used: string[] = [];
  for (const role of ["driver", "mechanic", "scout", "cook"] as Role[]) {
    const c = newCrew(r, rng, role, used); used.push(c.name); r.crew.push(c);
  }
  if ((levels.crew || 0) > 0) {
    const c = newCrew(r, rng, "medic", used); c.morale = 95; c.trait = "optimist"; r.crew.push(c);
  }
  for (let i = 0; i < r.crew.length; i++)
    for (let j = i + 1; j < r.crew.length; j++) {
      addBond(r, r.crew[i].id, r.crew[j].id, Math.round(-15 + rng() * 45) + ((levels.crew || 0) > 0 && j === r.crew.length - 1 ? 25 : 0));
    }
  clampResources(r);
  r.fuel = Math.min(r.fuel, derive(r).fuelCap);
  refreshMarket(r, 0);
  return r;
}

export function refreshMarket(r: Run, station: number) {
  const rng = mulberry32(r.seed * 31 + station * 977 + Math.floor(r.clock));
  const st = STATIONS[Math.min(station, STATIONS.length - 1)];
  const prices = GOOD_IDS.map((g, i) => Math.max(5, Math.round(GOODS[g].base * st.mult[i] * (0.85 + rng() * 0.3))));
  let shock: Market["shock"] = null;
  if (rng() < 0.45) {
    const gi = Math.floor(rng() * GOOD_IDS.length);
    const g = GOOD_IDS[gi];
    const up = rng() < 0.5;
    shock = {
      good: g, mult: up ? 1.45 : 0.68,
      text: up ? `${GOODS[g].name} are in short supply — prices spiked!` : `A glut of ${GOODS[g].name} — prices crashed!`,
    };
    prices[gi] = Math.round(prices[gi] * shock.mult);
  }
  let offer: Contract | null = null;
  if (station < 6 && rng() < 0.85) {
    const good = GOOD_IDS[Math.floor(rng() * GOOD_IDS.length)];
    const dest = Math.min(6, station + 1 + Math.floor(rng() * 2));
    const qty = 3 + Math.floor(rng() * 4);
    offer = { good, qty, dest, reward: Math.round(qty * GOODS[good].base * (1.5 + 0.15 * station) + 40) };
  }
  const cands: Candidate[] = [];
  const used = r.crew.map((c) => c.name);
  const c1 = { nextId: r.nextId + 1000 + station * 10 };
  for (let i = 0; i < 3; i++) {
    const c = newCrew(c1, rng, undefined, used); used.push(c.name);
    cands.push({ crew: c, cost: 80 + Math.floor(rng() * 50) + station * 10 });
  }
  r.market = {
    prices, shock, fuel: Math.ceil(3 * (1 + 0.12 * station)), food: Math.ceil(4 * (1 + 0.1 * station)),
    plank: 12, flare: 25, offer, candidates: cands, feasted: false,
  };
}

export const sellPrice = (r: Run, g: GoodId) => Math.floor(r.market.prices[GOOD_IDS.indexOf(g)] * 0.9);
export const buyPrice = (r: Run, g: GoodId) => r.market.prices[GOOD_IDS.indexOf(g)];
export const repairCost = (v: Vehicle) => Math.ceil(Math.max(0, hullMax(v) - v.hull) * 2);

/* ---------- station actions: return an error string or null on success ---------- */
export function buyGood(r: Run, g: GoodId, n: number): string | null {
  const d = derive(r);
  n = Math.min(n, d.cargoCap - d.goodsTotal);
  if (n <= 0) return "Cargo bays are full.";
  const p = buyPrice(r, g);
  n = Math.min(n, Math.floor(r.credits / p));
  if (n <= 0) return "Not enough scrip.";
  r.credits -= p * n; r.goods[g] += n; r.goodsCost[g] += p * n;
  return null;
}
export function sellGood(r: Run, g: GoodId, n: number): string | null {
  n = Math.min(n, r.goods[g]);
  if (n <= 0) return "None to sell.";
  const p = sellPrice(r, g);
  const avg = r.goods[g] > 0 ? r.goodsCost[g] / r.goods[g] : 0;
  r.credits += p * n; r.goodsCost[g] = Math.max(0, r.goodsCost[g] - avg * n); r.goods[g] -= n;
  r.stats.profit += Math.round((p - avg) * n);
  return null;
}
export function buySupply(r: Run, kind: "fuel" | "food" | "plank" | "flare", n: number): string | null {
  const d = derive(r);
  const price = r.market[kind];
  let room = 0;
  if (kind === "fuel") room = Math.floor(d.fuelCap - r.fuel);
  else if (kind === "food") room = 200 - Math.floor(r.food);
  else if (kind === "plank") room = d.plankCap - r.planks;
  else room = 8 - r.flares;
  n = Math.min(n, room, Math.floor(r.credits / price));
  if (n <= 0) return room <= 0 ? "Storage is full." : "Not enough scrip.";
  r.credits -= price * n;
  if (kind === "fuel") r.fuel += n; else if (kind === "food") r.food += n;
  else if (kind === "plank") r.planks += n; else r.flares += n;
  return null;
}
export function repairVehicle(r: Run, v: Vehicle): string | null {
  const c = repairCost(v);
  if (c <= 0) return "Already in perfect shape.";
  if (r.credits < c) {
    const hp = Math.floor(r.credits / 2);
    if (hp <= 0) return "Not enough scrip.";
    r.credits -= hp * 2; v.hull += hp; return null;
  }
  r.credits -= c; v.hull = hullMax(v); return null;
}
function capsOk(r: Run): boolean {
  const d = derive(r);
  return r.fuel <= d.fuelCap + 0.01 && d.goodsTotal <= d.cargoCap && r.planks <= d.plankCap && r.crew.length <= d.crewCap;
}
export function installModule(r: Run, v: Vehicle, slot: number, m: ModuleId | null, levels: Record<string, number>): string | null {
  const old = v.modules[slot];
  if (m === old) return null;
  if (m) {
    const def = MODULES[m];
    if (def.unlock && !levels[def.unlock]) return "Locked — unlock it in the Expedition Archive.";
    const refund = old ? Math.floor(MODULES[old].cost / 2) : 0;
    if (r.credits + refund < def.cost) return "Not enough scrip.";
    v.modules[slot] = m;
    if (!capsOk(r)) { v.modules[slot] = old; return "Remove cargo/fuel first — capacity would be exceeded."; }
    r.credits += refund - def.cost;
  } else if (old) {
    v.modules[slot] = null;
    if (!capsOk(r)) { v.modules[slot] = old; return "Remove cargo/fuel first — capacity would be exceeded."; }
    r.credits += Math.floor(MODULES[old].cost / 2);
  }
  v.hull = Math.min(v.hull, hullMax(v));
  return null;
}
export function buyVehicle(r: Run, t: VType, levels: Record<string, number>): string | null {
  const def = VTYPES[t];
  if (def.unlock && !levels[def.unlock]) return "Locked — unlock it in the Expedition Archive.";
  if (r.vehicles.length >= 5) return "Caravan is at maximum length (5 vehicles).";
  if (r.credits < def.cost) return "Not enough scrip.";
  r.credits -= def.cost; r.vehicles.push(newVehicle(r, t));
  return null;
}
export function sellVehicle(r: Run, idx: number): string | null {
  const v = r.vehicles[idx];
  if (!v || v.type === "tractor") return "The tractor cannot be sold.";
  r.vehicles.splice(idx, 1);
  if (!capsOk(r)) { r.vehicles.splice(idx, 0, v); return "Remove cargo/fuel/crew first — capacity would be exceeded."; }
  let refund = Math.floor(VTYPES[v.type].cost / 2);
  for (const m of v.modules) if (m) refund += Math.floor(MODULES[m].cost / 2);
  r.credits += refund;
  return null;
}
export function hireCrew(r: Run, idx: number): string | null {
  const c = r.market.candidates[idx];
  if (!c) return "Candidate unavailable.";
  if (r.crew.filter((x) => x.alive).length >= derive(r).crewCap) return "No free bunks — add a Crew Cabin.";
  if (r.credits < c.cost) return "Not enough scrip.";
  r.credits -= c.cost;
  r.market.candidates.splice(idx, 1);
  const crew = { ...c.crew, id: r.nextId++ };
  for (const o of r.crew) addBond(r, crew.id, o.id, Math.round(Math.random() * 30 - 10));
  r.crew.push(crew);
  return null;
}
export function dismissCrew(r: Run, id: number): string | null {
  if (r.crew.filter((c) => c.alive).length <= 1) return "You need at least one crew member.";
  r.crew = r.crew.filter((c) => c.id !== id);
  for (const c of r.crew) c.morale = Math.max(0, c.morale - 6);
  return null;
}
export function feast(r: Run): string | null {
  if (r.market.feasted) return "You already held a feast here.";
  if (r.credits < 40 || r.food < 6) return "A feast costs 40 scrip and 6 food.";
  r.credits -= 40; r.food -= 6; r.market.feasted = true;
  for (const c of r.crew) { if (c.alive) { c.morale = Math.min(100, c.morale + 28); c.warmth = Math.min(100, c.warmth + 30); } }
  const al = r.crew.filter((c) => c.alive);
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) addBond(r, al[i].id, al[j].id, 4);
  return null;
}
export function acceptContract(r: Run): string | null {
  const o = r.market.offer;
  if (!o) return "No contract on offer.";
  if (r.contract) return "You already carry a contract.";
  r.contract = o; r.market.offer = null;
  return null;
}
export function claimContract(r: Run): string | null {
  const c = r.contract;
  if (!c) return "No active contract.";
  if (r.station !== c.dest) return "Wrong destination.";
  if (r.goods[c.good] < c.qty) return `Need ${c.qty} ${GOODS[c.good].name}.`;
  const avg = r.goods[c.good] > 0 ? r.goodsCost[c.good] / r.goods[c.good] : 0;
  r.goodsCost[c.good] = Math.max(0, r.goodsCost[c.good] - avg * c.qty);
  r.goods[c.good] -= c.qty; r.credits += c.reward; r.stats.profit += c.reward; r.stats.contracts++;
  r.contract = null;
  return null;
}

export function scoreOf(r: Run, won: boolean): number {
  const diff = DIFFS[r.diffIdx] ?? DIFFS[1];
  const modB = 1 + r.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus ?? 0), 0);
  const alive = r.crew.filter((c) => c.alive).length;
  const raw = r.stats.distance / 8 + r.stats.legs * 400 + r.credits / 2 + alive * 150 + r.stats.profit / 3 + (won ? 4000 : 0);
  return Math.round(raw * diff.renown * modB);
}
export function renownOf(r: Run, won: boolean): number {
  const diff = DIFFS[r.diffIdx] ?? DIFFS[1];
  const modB = 1 + r.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus ?? 0), 0);
  const alive = r.crew.filter((c) => c.alive).length;
  return Math.max(1, Math.floor((r.stats.distance / 1500 + r.stats.legs * 3 + alive + (won ? 14 : 0)) * diff.renown * modB));
}
export const legCount = LEGS.length;
