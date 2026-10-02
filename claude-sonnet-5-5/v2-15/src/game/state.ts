import {
  CREATURES, DIFFS, ESCORTS, GOODS, GOOD_IDS, PERKS, REGIONS, ROLES, TRIBUTE_INTERVAL, UPGRADES,
  clamp, pick, rnd, rndi,
} from "./data";
import type { CreatureId, EscortKind, FrontKind, GoodId, Role, UpgId } from "./data";

export interface Crew { id: number; name: string; role: Role; level: number; morale: number }
export interface Escort { id: number; kind: EscortKind; hp: number }
export interface RegionState { pop: number; threat: number; cleared: boolean; forecast: FrontKind[]; kills: number }
export interface MarketEntry { m: number; sat: number }
export interface MarketEvent { port: number; good: GoodId; mult: number; days: number; label: string }
export interface Stats {
  kills: number; byType: Record<string, number>; sorties: number; earned: number; spent: number; wrecks: number;
  apex: number; harpoons: number; hits: number; bullseyes: number; snaps: number; amber: number; tribute: number; days: number;
}
export interface Campaign {
  v: number; diff: number; storm: boolean; iron: boolean; perks: Record<string, number>;
  day: number; crowns: number; fuel: number; rations: number; hull: number; nextId: number;
  upg: Record<UpgId, number>; crew: Crew[]; hire: Crew[]; escorts: Escort[];
  cargo: Record<GoodId, number>; loc: number; unlocked: number;
  regions: RegionState[]; market: MarketEntry[][]; events: MarketEvent[];
  tributeIdx: number; stats: Stats; log: string[]; won: boolean; over: null | string; hireDay: number; renownPaid?: number;
}

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; tips: boolean }
export interface Meta { renown: number; perks: Record<string, number>; ach: string[]; settings: Settings; tutorialDone: boolean; campaigns: number; wins: number; bestDays: number }

export interface SortieResult {
  outcome: "return" | "wreck" | "adrift" | "apex";
  cargo: Record<GoodId, number>; crowns: number; kills: Record<string, number>;
  hull: number; fuel: number; escortHp: Record<number, number>; apexSlain: CreatureId | null;
  harpoons: number; hits: number; bullseyes: number; snaps: number; damage: number; time: number; lost: number; gained: Record<GoodId, number>;
}

const SAVE_KEY = "skywhaler.save.v1";
const META_KEY = "skywhaler.meta.v1";

export const emptyCargo = (): Record<GoodId, number> => ({ oil: 0, bone: 0, amber: 0, gel: 0, hide: 0, spice: 0, ore: 0, silk: 0 });
export const defaultSettings = (): Settings => ({ master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, tips: true });

export function loadMeta(): Meta {
  const d: Meta = { renown: 0, perks: {}, ach: [], settings: defaultSettings(), tutorialDone: false, campaigns: 0, wins: 0, bestDays: 0 };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) } };
    }
  } catch { /* storage unavailable */ }
  return d;
}
export function saveMeta(m: Meta) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
export function saveCampaign(c: Campaign | null) {
  try { if (c && !c.over && !c.won) localStorage.setItem(SAVE_KEY, JSON.stringify(c)); else localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
export function loadCampaign(): Campaign | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Campaign;
    if (c && c.v === 1 && c.crew && c.market) return c;
  } catch { /* ignore */ }
  return null;
}
export function hasSave() { return loadCampaign() !== null; }

const NAMES = ["Ishmael", "Brynn", "Odessa", "Tobias", "Marrow", "Keziah", "Fenwick", "Isolde", "Barnaby", "Sable", "Quill", "Hester", "Corwin", "Mabel", "Jory", "Petra", "Ansel", "Dagny", "Rook", "Lorne", "Wren", "Thaddeus", "Nell", "Gideon"];
export const wageOf = (level: number) => 4 + 5 * level;
export const hireCost = (level: number) => 60 * level;
export const trainCost = (level: number) => 90 * level;
export const MAX_CREW = 8;
export const MAX_ESCORTS = 3;
export const moraleF = (m: number) => 0.6 + 0.5 * clamp(m, 0, 100) / 100;

function makeCrew(c: { nextId: number }, role: Role, level: number, morale: number): Crew {
  return { id: c.nextId++, name: pick(NAMES), role, level, morale };
}

export function newCampaign(diff: number, storm: boolean, iron: boolean, meta: Meta): Campaign {
  const perks = { ...meta.perks };
  const pl = (id: string) => perks[id] || 0;
  const c: Campaign = {
    v: 1, diff, storm, iron, perks,
    day: 1, crowns: DIFFS[diff].crowns + 150 * pl("capital"), fuel: 70 + 30 * pl("charts"), rations: 16 + 10 * pl("charts"), hull: 100, nextId: 1,
    upg: { hull: 0, engine: 0, tank: 0, hold: 0, gun: 0, winch: 0, launcher: 0, cannon: 0, rods: 0 },
    crew: [], hire: [], escorts: [], cargo: emptyCargo(), loc: 0, unlocked: 0,
    regions: REGIONS.map(() => ({ pop: 100, threat: 0, cleared: false, forecast: [], kills: 0 })),
    market: REGIONS.map(() => GOOD_IDS.map(() => ({ m: 1, sat: 0 }))) as unknown as MarketEntry[][],
    events: [], tributeIdx: 0,
    stats: { kills: 0, byType: {}, sorties: 0, earned: 0, spent: 0, wrecks: 0, apex: 0, harpoons: 0, hits: 0, bullseyes: 0, snaps: 0, amber: 0, tribute: 0, days: 0 },
    log: ["The Guild grants you a charter. Fill your hold, pay your tribute, and slay the Leviathan."], won: false, over: null, hireDay: 0,
  };
  // market stored as arrays by good index; convert into per-good records
  c.market = REGIONS.map(() => GOOD_IDS.map(() => ({ m: 1, sat: 0 })));
  const morale = 65 + 10 * pl("legs");
  c.crew.push(makeCrew(c, "pilot", 1, morale), makeCrew(c, "harpooner", 1 + pl("veteran"), morale), makeCrew(c, "engineer", 1, morale));
  REGIONS.forEach((_, i) => { c.regions[i].forecast = rollForecast(c, i); });
  c.hire = genHire(c);
  return c;
}

const gi = (g: GoodId) => GOOD_IDS.indexOf(g);

export function rollForecast(c: Campaign, region: number): FrontKind[] {
  const w = REGIONS[region].weather;
  const kinds = Object.keys(w) as FrontKind[];
  const mult = DIFFS[c.diff].weather * (c.storm ? 1.5 : 1);
  const out: FrontKind[] = [];
  const n = 1 + (Math.random() < 0.55 * mult ? 1 : 0) + (Math.random() < 0.25 * mult ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const weights = kinds.map((k) => (out.includes(k) ? 0 : w[k] * (k === "storm" && c.storm ? 1.6 : 1)));
    const tot = weights.reduce((a, b) => a + b, 0);
    if (tot <= 0) break;
    let r = Math.random() * tot;
    for (let j = 0; j < kinds.length; j++) { r -= weights[j]; if (r <= 0) { out.push(kinds[j]); break; } }
  }
  return out;
}

export function genHire(c: Campaign): Crew[] {
  const have = ROLES.map((r) => c.crew.filter((x) => x.role === r).length);
  const out: Crew[] = [];
  for (let i = 0; i < 3; i++) {
    const weights = ROLES.map((_, k) => (have[k] === 0 ? 3 : 1));
    const tot = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; let role = ROLES[0];
    for (let k = 0; k < ROLES.length; k++) { r -= weights[k]; if (r <= 0) { role = ROLES[k]; break; } }
    const lvl = clamp(rndi(1, 2 + Math.floor(c.unlocked / 2) + (Math.random() < 0.2 ? 1 : 0)), 1, 5);
    out.push(makeCrew(c, role, lvl, rndi(55, 85)));
  }
  return out;
}

export function crewPower(c: Campaign, role: Role): number {
  const vals = c.crew.filter((x) => x.role === role).map((x) => x.level * moraleF(x.morale)).sort((a, b) => b - a);
  return (vals[0] || 0) + 0.4 * (vals[1] || 0);
}
export const wagesTotal = (c: Campaign) => c.crew.reduce((a, x) => a + wageOf(x.level), 0) + c.escorts.length * 12;
export const cargoUsed = (c: Campaign) => GOOD_IDS.reduce((a, g) => a + c.cargo[g], 0);
export const cargoCap = (c: Campaign) => 20 + 8 * c.upg.hold + (c.escorts.some((e) => e.kind === "hauler") ? 14 : 0);
export const maxHull = (c: Campaign) => 100 + 30 * c.upg.hull;
export const maxFuel = (c: Campaign) => 100 + 25 * c.upg.tank;
export const fuelPrice = (c: Campaign) => Math.round(REGIONS[c.loc].fuel * 10 * (c.storm ? 1.1 : 1)) / 10;
export const ration_price = 4;

export function shipStats(c: Campaign) {
  const u = c.upg;
  const pilot = crewPower(c, "pilot"), har = crewPower(c, "harpooner"), gun = crewPower(c, "gunner"), eng = crewPower(c, "engineer"), nav = crewPower(c, "navigator");
  return {
    maxHp: maxHull(c),
    thrust: 1 + 0.12 * u.engine + 0.06 * pilot,
    maxFuel: maxFuel(c),
    hold: cargoCap(c),
    harpDmg: (1 + 0.12 * u.gun) * (1 + 0.07 * har),
    harpSpeed: 1 + 0.06 * u.gun,
    lance: (16 + 5 * u.gun) * (1 + 0.05 * har),
    reel: 1 + 0.12 * u.winch,
    maxT: 120 + 14 * u.winch,
    slots: 1 + u.launcher,
    cannonDmg: 5 + 2 * u.cannon,
    cannonCd: 0.95 / (1 + 0.1 * gun),
    rods: u.rods,
    burn: Math.max(0.4, (1 - 0.05 * eng) * (1 + 0.1 * c.escorts.length)),
    regen: 0.25 * eng,
    radar: 1500 * (1 + 0.12 * nav),
    preview: 0.45 + 0.1 * har,
    nav,
  };
}

export function upgCost(c: Campaign, id: UpgId) {
  const d = UPGRADES.find((u) => u.id === id)!;
  return Math.round((d.base * Math.pow(1.7, c.upg[id])) / 10) * 10;
}

// ---------- market ----------
export function price(c: Campaign, p: number, g: GoodId): number {
  const e = c.market[p][gi(g)] as MarketEntry;
  let v = GOODS[g].base * GOODS[g].demand[p] * e.m * (1 - e.sat);
  for (const ev of c.events) if (ev.port === p && ev.good === g) v *= ev.mult;
  if (c.storm && g === "oil") v *= 1.25;
  return Math.max(1, Math.round(v));
}
const sat = (c: Campaign, p: number, g: GoodId) => c.market[p][gi(g)] as MarketEntry;

export function sellQuote(c: Campaign, g: GoodId, n: number): number {
  const e = sat(c, c.loc, g);
  const save = e.sat; let total = 0;
  for (let i = 0; i < n; i++) { total += price(c, c.loc, g); e.sat = Math.min(0.6, e.sat + 0.02); }
  e.sat = save;
  return total;
}
export function sellGood(c: Campaign, g: GoodId, n: number): string {
  n = Math.min(n, c.cargo[g]);
  if (n <= 0) return "Nothing to sell.";
  const total = sellQuote(c, g, n);
  const e = sat(c, c.loc, g);
  e.sat = Math.min(0.6, e.sat + 0.02 * n);
  c.cargo[g] -= n; c.crowns += total; c.stats.earned += total;
  return `Sold ${n} ${GOODS[g].name} for ${total}¢`;
}
export function buyPrice(c: Campaign, g: GoodId) { return Math.round(price(c, c.loc, g) * 1.12); }
export function buyGood(c: Campaign, g: GoodId, n: number): string {
  if (GOODS[g].hunt) return "That cannot be bought.";
  let bought = 0; let spent = 0;
  const e = sat(c, c.loc, g);
  for (let i = 0; i < n; i++) {
    const p = buyPrice(c, g);
    if (c.crowns < p || cargoUsed(c) >= cargoCap(c)) break;
    c.crowns -= p; spent += p; c.cargo[g]++; bought++;
    e.sat = Math.max(-0.5, e.sat - 0.015);
  }
  c.stats.spent += spent;
  if (!bought) return cargoUsed(c) >= cargoCap(c) ? "Your hold is full." : "Not enough crowns.";
  return `Bought ${bought} ${GOODS[g].name} for ${spent}¢`;
}
export function sellAllHunt(c: Campaign): string {
  let total = 0, units = 0;
  for (const g of GOOD_IDS) {
    if (!GOODS[g].hunt || c.cargo[g] <= 0) continue;
    const n = c.cargo[g]; const q = sellQuote(c, g, n);
    const e = sat(c, c.loc, g); e.sat = Math.min(0.6, e.sat + 0.02 * n);
    c.cargo[g] = 0; total += q; units += n;
  }
  c.crowns += total; c.stats.earned += total;
  return units ? `Sold ${units} units of hunt goods for ${total}¢` : "No hunt goods to sell.";
}

// ---------- port services ----------
export function refuel(c: Campaign, n: number): string {
  const room = maxFuel(c) - c.fuel;
  n = Math.min(n, Math.floor(room));
  const unit = fuelPrice(c);
  n = Math.min(n, Math.floor(c.crowns / unit));
  if (n <= 0) return room <= 0 ? "Tanks are full." : "Not enough crowns.";
  const cost = Math.round(n * unit);
  c.crowns -= cost; c.fuel += n; c.stats.spent += cost;
  return `Loaded ${n} fuel for ${cost}¢`;
}
export const repairCost = (c: Campaign) => Math.ceil((maxHull(c) - c.hull) * 1.5);
export function repairHull(c: Campaign): string {
  const cost = repairCost(c);
  if (cost <= 0) return "Hull is sound.";
  if (c.crowns < cost) return "Not enough crowns for full repairs.";
  c.crowns -= cost; c.hull = maxHull(c); c.stats.spent += cost;
  return `Hull repaired for ${cost}¢`;
}
export function buyRations(c: Campaign, n: number): string {
  const cost = n * ration_price;
  if (c.crowns < cost) return "Not enough crowns.";
  c.crowns -= cost; c.rations += n; c.stats.spent += cost;
  return `Bought ${n} rations.`;
}
export function buyUpgrade(c: Campaign, id: UpgId): string {
  const d = UPGRADES.find((u) => u.id === id)!;
  if (c.upg[id] >= d.max) return "Already at maximum.";
  const cost = upgCost(c, id);
  if (c.crowns < cost) return "Not enough crowns.";
  c.crowns -= cost; c.upg[id]++; c.stats.spent += cost;
  if (id === "hull") c.hull += 30;
  return `${d.name} upgraded to level ${c.upg[id]}.`;
}
export function hireCrew(c: Campaign, id: number): string {
  const cand = c.hire.find((x) => x.id === id);
  if (!cand) return "Candidate left.";
  if (c.crew.length >= MAX_CREW) return `Bunks full (max ${MAX_CREW}).`;
  const cost = hireCost(cand.level);
  if (c.crowns < cost) return "Not enough crowns for the signing fee.";
  c.crowns -= cost; c.stats.spent += cost;
  c.crew.push(cand); c.hire = c.hire.filter((x) => x.id !== id);
  return `${cand.name} joins as ${cand.role}.`;
}
export function trainCrew(c: Campaign, id: number): string {
  const m = c.crew.find((x) => x.id === id);
  if (!m) return "No such crew.";
  if (m.level >= 5) return "Already a master.";
  const cost = trainCost(m.level);
  if (c.crowns < cost) return "Not enough crowns.";
  c.crowns -= cost; c.stats.spent += cost; m.level++; m.morale = Math.min(100, m.morale + 6);
  return `${m.name} trained to level ${m.level}.`;
}
export function dismissCrew(c: Campaign, id: number): string {
  const m = c.crew.find((x) => x.id === id);
  if (!m) return "";
  if (c.crew.length <= 1) return "You can't sail alone.";
  c.crew = c.crew.filter((x) => x.id !== id);
  c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 3); });
  return `${m.name} was let go. The crew grumbles.`;
}
export function buyEscort(c: Campaign, kind: EscortKind): string {
  const d = ESCORTS[kind];
  if (c.escorts.length >= MAX_ESCORTS) return `Fleet is full (max ${MAX_ESCORTS} escorts).`;
  if (c.crowns < d.price) return "Not enough crowns.";
  c.crowns -= d.price; c.stats.spent += d.price;
  c.escorts.push({ id: c.nextId++, kind, hp: d.hp });
  return `${d.name} joins the fleet.`;
}
export const escortRepairCost = (e: Escort) => Math.ceil(ESCORTS[e.kind].price * 0.5 * (1 - e.hp / ESCORTS[e.kind].hp));
export function repairEscort(c: Campaign, id: number): string {
  const e = c.escorts.find((x) => x.id === id);
  if (!e) return "";
  const cost = escortRepairCost(e);
  if (cost <= 0) return "Already seaworthy.";
  if (c.crowns < cost) return "Not enough crowns.";
  c.crowns -= cost; c.stats.spent += cost; e.hp = ESCORTS[e.kind].hp;
  return `${ESCORTS[e.kind].name} repaired for ${cost}¢`;
}
export function sellEscort(c: Campaign, id: number): string {
  const e = c.escorts.find((x) => x.id === id);
  if (!e) return "";
  const v = Math.round(ESCORTS[e.kind].price * 0.5);
  c.crowns += v; c.escorts = c.escorts.filter((x) => x.id !== id);
  return `Sold ${ESCORTS[e.kind].name} for ${v}¢`;
}
export function buyChum(c: Campaign): string {
  const r = c.regions[c.loc];
  if (c.crowns < 80) return "Not enough crowns.";
  if (r.threat >= 100) return "The apex is already stirring.";
  c.crowns -= 80; c.stats.spent += 80; r.threat = Math.min(100, r.threat + 25);
  return "Chum barrel dumped. Something big is circling...";
}
export function begRelief(c: Campaign): string {
  c.crowns += 60; c.fuel = Math.min(maxFuel(c), c.fuel + 40); c.rations += 6;
  c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 6); });
  return "The Guild dole: 60¢, 40 fuel, 6 rations. The crew is ashamed.";
}
export const isBroke = (c: Campaign) => c.crowns < 40 && c.fuel < 20 && GOOD_IDS.every((g) => c.cargo[g] === 0);

export const tributeDue = (c: Campaign) => (c.tributeIdx + 1) * TRIBUTE_INTERVAL;
export function tributeAmount(c: Campaign, idx = c.tributeIdx): number {
  const base = 200 + 250 * idx + 40 * idx * idx;
  return Math.round(base * DIFFS[c.diff].tribute * (1 - 0.06 * (c.perks.favor || 0)));
}

function note(c: Campaign, m: string) { c.log.unshift(`Day ${c.day}: ${m}`); if (c.log.length > 14) c.log.length = 14; }

// ---------- calendar ----------
export function advanceDay(c: Campaign, msgs: string[], rest = false) {
  const start = msgs.length;
  c.day++; c.stats.days++;
  const w = wagesTotal(c);
  if (c.crowns >= w) { c.crowns -= w; } else {
    c.crowns = 0; c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 15); });
    msgs.push("Wages unpaid! The crew's morale plummets.");
  }
  const need = c.crew.length;
  if (c.rations >= need) c.rations -= need; else {
    c.rations = 0; c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 8); });
    msgs.push("The crew went hungry. Buy rations!");
  }
  if (!rest) c.crew.forEach((x) => { x.morale = clamp(x.morale + (x.morale < 50 ? 1 : -0.5), 0, 100); });
  // market tick
  c.market.forEach((port, p) => port.forEach((e, k) => {
    e.m = clamp(e.m + (1 - e.m) * 0.18 + rnd(-0.07, 0.07), 0.7, 1.4);
    e.sat *= 0.82;
    void p; void k;
  }));
  c.events.forEach((e) => e.days--);
  c.events = c.events.filter((e) => e.days > 0);
  if (Math.random() < 0.3 && c.events.length < 4) {
    const port = rndi(0, Math.min(5, c.unlocked + 1));
    const good = pick(GOOD_IDS);
    const short = Math.random() < 0.55;
    const mult = short ? rnd(1.35, 1.65) : rnd(0.6, 0.78);
    c.events.push({ port, good, mult, days: rndi(4, 7), label: `${REGIONS[port].port}: ${short ? "shortage of" : "glut of"} ${GOODS[good].name}` });
  }
  c.regions.forEach((r, i) => {
    r.pop = Math.min(100, r.pop + 4);
    r.threat = Math.max(0, r.threat - (r.threat >= 100 ? 0 : 1.2));
    r.forecast = rollForecast(c, i);
  });
  if (c.day - c.hireDay >= 3) { c.hire = genHire(c); c.hireDay = c.day; }
  // tribute
  if (c.day >= tributeDue(c)) {
    const amt = tributeAmount(c);
    if (c.crowns < amt) {
      // liquidate cargo at 85%
      for (const g of GOOD_IDS) {
        while (c.cargo[g] > 0 && c.crowns < amt) { c.crowns += Math.round(price(c, c.loc, g) * 0.85); c.cargo[g]--; }
      }
      if (c.crowns < amt) { c.over = "tribute"; msgs.push(`The Guild collectors arrive for ${amt}¢ and find you short.`); msgs.slice(start).forEach((m) => note(c, m)); return; }
      msgs.push("The Guild seized part of your cargo to cover tribute.");
    }
    c.crowns -= amt; c.stats.tribute += amt; c.tributeIdx++;
    msgs.push(`Guild tribute of ${amt}¢ paid. Next due day ${tributeDue(c)}.`);
    c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 4); });
  }
  msgs.slice(start).forEach((m) => note(c, m));
}

export function shoreLeave(c: Campaign): string[] {
  const cost = 15 * c.crew.length;
  if (c.crowns < cost) return ["Not enough crowns for shore leave."];
  c.crowns -= cost; c.stats.spent += cost;
  c.crew.forEach((x) => { x.morale = Math.min(100, x.morale + 25); });
  c.hull = Math.min(maxHull(c), c.hull + Math.round(maxHull(c) * 0.1));
  const msgs = ["Shore leave: the crew sings the night away (+25 morale)."];
  advanceDay(c, msgs, true);
  return msgs;
}

// ---------- travel ----------
export const travelFuel = (c: Campaign) => Math.round(25 * (1 + 0.1 * c.escorts.length));
export interface TravelEvent { id: string; title: string; text: string; choices: { label: string; run: (c: Campaign) => string }[] }

export function travelEvent(): TravelEvent {
  const events: TravelEvent[] = [
    { id: "wreck", title: "Drifting Wreck", text: "A hulk of a merchant ship tumbles in the wind, its cargo bays yawning open.", choices: [
      { label: "Salvage it (risky)", run: (c) => { if (Math.random() < 0.6) { const n = Math.min(4, cargoCap(c) - cargoUsed(c)); c.cargo.ore += n; c.crowns += 60; return `Lucky! Salvaged ${n} ore and 60¢.`; } c.hull = Math.max(10, c.hull - 15); return "The hulk collapsed on you. Hull -15."; } },
      { label: "Leave it", run: () => "You sail on, wary." },
    ] },
    { id: "toll", title: "Reaver Toll", text: "A reaver flotilla blocks the lane and demands a toll.", choices: [
      { label: "Pay 80¢", run: (c) => { if (c.crowns < 80) { c.hull = Math.max(10, c.hull - 20); return "You couldn't pay. They raked your hull. Hull -20."; } c.crowns -= 80; return "Toll paid. The reavers wave you through."; } },
      { label: "Fight them off", run: (c) => { if (c.upg.cannon >= 2 || c.escorts.some((e) => e.kind === "harrier")) { c.crowns += 90; c.crew.forEach((x) => { x.morale = Math.min(100, x.morale + 5); }); return "Your guns win the day! Plunder: 90¢, morale up."; } c.hull = Math.max(10, c.hull - 25); c.fuel = Math.max(0, c.fuel - 10); return "Outgunned! Hull -25, 10 fuel lost."; } },
      { label: "Run for it (-12 fuel)", run: (c) => { c.fuel = Math.max(0, c.fuel - 12); return "You outrun them, burning extra fuel."; } },
    ] },
    { id: "merchant", title: "Friendly Merchant", text: "A cheerful tinker-balloon hails you.", choices: [
      { label: "Buy 10 rations (25¢)", run: (c) => { if (c.crowns < 25) return "You can't afford it."; c.crowns -= 25; c.rations += 10; return "Rations stocked."; } },
      { label: "Sell 5 oil (+100¢)", run: (c) => { if (c.cargo.oil < 5) return "You don't have 5 oil."; c.cargo.oil -= 5; c.crowns += 100; return "A fine deal."; } },
      { label: "Wave goodbye", run: () => "Safe skies!" },
    ] },
    { id: "song", title: "Whale Song", text: "A far-off chorus of cloud-whales drifts through the hull. The crew falls silent.", choices: [
      { label: "Let the crew listen", run: (c) => { c.crew.forEach((x) => { x.morale = Math.min(100, x.morale + 12); }); return "Moved to tears. Morale +12."; } },
      { label: "Press on", run: (c) => { c.fuel = Math.min(maxFuel(c), c.fuel + 5); return "You save a little fuel by pressing on."; } },
    ] },
    { id: "fever", title: "Sky Fever", text: "A sailor shivers in his hammock — sky fever.", choices: [
      { label: "Buy medicine (60¢)", run: (c) => { if (c.crowns < 60) return "No crowns for medicine. Morale -8."; c.crowns -= 60; return "The fever breaks."; } },
      { label: "Tough it out", run: (c) => { c.crew.forEach((x) => { x.morale = Math.max(0, x.morale - 10); }); return "Crew morale -10."; } },
    ] },
    { id: "tail", title: "Lucky Tailwind", text: "A perfect jet-stream carries you across the lanes.", choices: [
      { label: "Ride it!", run: (c) => { c.fuel = Math.min(maxFuel(c), c.fuel + 12); return "+12 fuel."; } },
    ] },
    { id: "inspector", title: "Guild Inspector", text: "A Guild cutter hails you for a cargo inspection.", choices: [
      { label: "Pay the fee (40¢)", run: (c) => { if (c.crowns < 40) return "You can't pay. They shrug and let you go."; c.crowns -= 40; return "Fee paid."; } },
      { label: "Hide the goods", run: (c) => { if (Math.random() < 0.5) return "They found nothing. Phew."; const f = Math.min(c.crowns, 120); c.crowns -= f; return `Caught! Fined ${f}¢.`; } },
    ] },
  ];
  return pick(events);
}

export function travel(c: Campaign, to: number): { ok: boolean; msgs: string[]; event?: TravelEvent } {
  if (to === c.loc) return { ok: false, msgs: ["Already here."] };
  if (to > c.unlocked) return { ok: false, msgs: ["That region is sealed by its apex."] };
  const hops = Math.abs(to - c.loc);
  const fuel = travelFuel(c) * hops;
  if (c.fuel < fuel) return { ok: false, msgs: [`Need ${fuel} fuel to sail there.`] };
  c.fuel -= fuel; c.loc = to;
  const msgs: string[] = [`Sailed to ${REGIONS[to].port}.`];
  for (let i = 0; i < hops; i++) { if (!c.over) advanceDay(c, msgs); }
  c.hire = genHire(c); c.hireDay = c.day;
  const ev = Math.random() < 0.5 && !c.over ? travelEvent() : undefined;
  return { ok: true, msgs, event: ev };
}

// ---------- sortie results ----------
export function applySortieResult(c: Campaign, r: SortieResult): string[] {
  const out: string[] = [];
  c.stats.sorties++;
  c.stats.harpoons += r.harpoons; c.stats.hits += r.hits; c.stats.bullseyes += r.bullseyes; c.stats.snaps += r.snaps;
  let kills = 0;
  for (const k of Object.keys(r.kills)) {
    const n = r.kills[k]; kills += n;
    c.stats.byType[k] = (c.stats.byType[k] || 0) + n;
    const def = CREATURES[k as CreatureId];
    const reg = c.regions[c.loc];
    if (def && !def.apexRegion && def.apexRegion !== 0) { reg.pop = Math.max(8, reg.pop - 3 * n); reg.threat = Math.min(100, reg.threat + def.threat * n); reg.kills += n; }
  }
  c.stats.kills += kills;
  c.stats.amber += r.gained.amber || 0;
  c.hull = Math.max(1, Math.round(r.hull)); c.fuel = Math.max(0, r.fuel);
  c.escorts.forEach((e) => { if (r.escortHp[e.id] !== undefined) e.hp = Math.max(0, r.escortHp[e.id]); });
  c.crowns += r.crowns; c.stats.earned += r.crowns;
  c.cargo = { ...r.cargo };
  let mor = Math.min(6, Math.floor(kills / 3));
  if (r.apexSlain) {
    mor += 25;
    const reg = c.regions[c.loc];
    reg.cleared = true; reg.threat = 0; c.stats.apex++;
    if (c.loc < REGIONS.length - 1) { c.unlocked = Math.max(c.unlocked, c.loc + 1); out.push(`${CREATURES[r.apexSlain].name} is slain! ${REGIONS[c.loc + 1].name} opens to you.`); }
    else { c.won = true; out.push("The Leviathan falls. The Storm Heart is yours."); }
  }
  if (r.outcome === "wreck") {
    c.stats.wrecks++; mor -= 25;
    c.cargo = emptyCargo();
    c.hull = Math.ceil(maxHull(c) * 0.3);
    const fee = Math.min(c.crowns, 80); c.crowns -= fee;
    out.push(`Your ship went down. Cargo lost, rescue fee ${fee}¢.`);
    if (c.iron && c.crew.length > 1) { const dead = pick(c.crew); c.crew = c.crew.filter((x) => x.id !== dead.id); out.push(`${dead.name} (${dead.role}) was lost to the clouds.`); }
  } else if (r.outcome === "adrift") {
    mor -= 6;
    const fee = Math.min(c.crowns, 40); c.crowns -= fee;
    out.push(`Out of fuel! A tug hauled you home for ${fee}¢ and a share of your cargo.`);
  }
  c.crew.forEach((x) => { x.morale = clamp(x.morale + mor, 0, 100); });
  if (r.lost > 0 && r.outcome !== "wreck") out.push(`${r.lost} unit(s) of loot were lost (hold full or plundered).`);
  advanceDay(c, out);
  note(c, `Sortie: ${kills} kills, +${r.crowns}¢ in plunder.`);
  return out;
}

// ---------- renown / achievements ----------
export function calcRenown(c: Campaign): number {
  const raw = c.stats.kills + c.stats.apex * 15 + c.stats.earned / 250 + (c.won ? 60 : 0) + c.unlocked * 5;
  return Math.floor(raw * (c.iron ? 1.3 : 1) * [0.8, 1, 1.3][c.diff]);
}
export const ACHIEVEMENTS: { id: string; name: string; desc: string; test: (c: Campaign) => boolean }[] = [
  { id: "first", name: "First Blood", desc: "Slay your first beast.", test: (c) => c.stats.kills >= 1 },
  { id: "fifty", name: "Fifty Fathoms Up", desc: "Slay 50 creatures.", test: (c) => c.stats.kills >= 50 },
  { id: "apex1", name: "Moss Off The Back", desc: "Slay an apex creature.", test: (c) => c.stats.apex >= 1 },
  { id: "apex3", name: "Apex Predator", desc: "Slay three apex creatures.", test: (c) => c.stats.apex >= 3 },
  { id: "win", name: "Leviathan's Bane", desc: "Win the campaign.", test: (c) => c.won },
  { id: "amber", name: "Ambergris Baron", desc: "Collect 10 ambergris.", test: (c) => c.stats.amber >= 10 },
  { id: "rich", name: "Gilded Ledger", desc: "Earn 10,000 crowns.", test: (c) => c.stats.earned >= 10000 },
  { id: "fleet", name: "Admiral of the Clouds", desc: "Field a fleet of 3 escorts.", test: (c) => c.escorts.length >= 3 },
  { id: "bull", name: "Dead Center", desc: "Land 10 bullseyes.", test: (c) => c.stats.bullseyes >= 10 },
  { id: "tribute", name: "Model Citizen", desc: "Pay 5 Guild tributes.", test: (c) => c.tributeIdx >= 5 },
  { id: "tuned", name: "Master Shipwright", desc: "Raise 5 upgrades to level 3+.", test: (c) => Object.values(c.upg).filter((v) => v >= 3).length >= 5 },
];
export function checkAchievements(c: Campaign, meta: Meta): string[] {
  const fresh = ACHIEVEMENTS.filter((a) => !meta.ach.includes(a.id) && a.test(c));
  fresh.forEach((a) => meta.ach.push(a.id));
  return fresh.map((a) => a.name);
}
export function perkCost(id: string, level: number) { const p = PERKS.find((x) => x.id === id)!; return p.cost * (level + 1); }
