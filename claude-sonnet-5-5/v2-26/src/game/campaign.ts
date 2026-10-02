import {
  BOSS_RANK,
  CLIENTS,
  CLIENT_IDS,
  CLIENT_TASTE,
  CONSUMABLES,
  CONTRACT_TITLES,
  DIFFS,
  KINDS,
  LOOT,
  LOOT_KINDS,
  MAX_ITEMS,
  MAX_PICKS,
  MODS,
  PICK_COST,
  RANKS,
  UPGRADES,
} from "./data";
import type {
  Campaign,
  ClientId,
  ConsumableId,
  Contract,
  JobResult,
  JobSpec,
  LootItem,
  LootKind,
  MarketEntry,
  ModId,
  Settings,
  Stats,
  UpgradeId,
} from "./types";
import { bossStages, genStages, STAGE_COUNT_BY_TIER } from "./vault";
import { clamp, mulberry32, pick } from "./util";

const PAY_BY_TIER = [0, 70, 150, 270, 460, 760];

export function emptyStats(): Stats {
  return {
    jobsDone: 0,
    jobsFailed: 0,
    stagesCracked: 0,
    goldEarned: 0,
    goldSpent: 0,
    picksBroken: 0,
    faults: 0,
    alarms: 0,
    perfect: 0,
    lootSold: 0,
    patrolsDodged: 0,
    patrolsCaught: 0,
    playTime: 0,
    bestPay: 0,
  };
}

export function rankIndex(renown: number): number {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (renown >= r.at) idx = i;
  });
  return idx;
}
export const rankName = (renown: number) => RANKS[rankIndex(renown)].name;
export function nextRank(renown: number) {
  const i = rankIndex(renown);
  return i + 1 < RANKS.length ? RANKS[i + 1] : null;
}

export const hasPerk = (c: Campaign, id: ClientId) => c.rep[id] >= 50;
export const bossUnlocked = (c: Campaign) => rankIndex(c.renown) >= BOSS_RANK;

export function heatLabel(h: number): string {
  if (h < 25) return "Cold";
  if (h < 50) return "Noticed";
  if (h < 75) return "Hunted";
  return "Manhunt";
}

export function hintLevel(c: Campaign): number {
  return clamp(c.upgrades.stetho + (hasPerk(c, "scholars") ? 1 : 0), 0, 2);
}

export function shopMul(c: Campaign): number {
  return hasPerk(c, "merchants") ? 0.8 : 1;
}

export function upgradeCost(c: Campaign, id: UpgradeId): number {
  const u = UPGRADES[id];
  const lvl = c.upgrades[id];
  return Math.round((u.base * Math.pow(u.mul, lvl) * shopMul(c)) / 5) * 5;
}
export const consumableCost = (c: Campaign, id: ConsumableId) => Math.round(CONSUMABLES[id].cost * shopMul(c));
export const pickCost = (c: Campaign) => Math.max(1, Math.round(PICK_COST * shopMul(c)));

export function rentFor(c: Campaign, s: Settings): number {
  return Math.round((8 + 5 * rankIndex(c.renown)) * DIFFS[s.difficulty].rent);
}

export function fenceMul(c: Campaign): number {
  return (hasPerk(c, "underworld") ? 1.15 : 1) * (1 - c.heat / 250);
}
export function lootValue(c: Campaign, item: LootItem): number {
  return Math.round(item.base * c.market[item.kind].price * fenceMul(c));
}

export function rentLabel(c: Campaign, s: Settings) {
  return `${rentFor(c, s)}g/day`;
}

function newMarket(): Record<LootKind, MarketEntry> {
  const m = {} as Record<LootKind, MarketEntry>;
  LOOT_KINDS.forEach((k) => (m[k] = { price: 1, trend: 0, hist: [1, 1, 1] }));
  return m;
}

export function newCampaign(house: string, generation: number): Campaign {
  const c: Campaign = {
    house,
    day: 1,
    gold: 120 + generation * 100,
    heat: 0,
    renown: 0,
    rep: { merchants: 0, nobles: 0, underworld: 0, scholars: 0 },
    upgrades: {
      steel: Math.min(2, generation),
      wrench: 0,
      stetho: generation >= 2 ? 1 : 0,
      gloves: 0,
      oil: 0,
      hourglass: 0,
      cloak: 0,
    },
    items: { oil: 1, smoke: 1, sand: 0, skeleton: 0 },
    picks: 4,
    loot: [],
    lootSeq: 1,
    market: newMarket(),
    board: [],
    stats: emptyStats(),
    generation,
    seed: Math.floor(Math.random() * 1e9),
    log: [`House ${house} opens its workshop. The city sleeps — for now.`],
    bossDone: false,
  };
  c.board = generateBoard(c);
  return c;
}

function makeContract(c: Campaign, rng: () => number, client: ClientId, idx: number): Contract {
  const rank = rankIndex(c.renown);
  const cap = clamp(Math.min(1 + Math.floor(Math.max(0, c.rep[client]) / 22), rank + 2), 1, 5);
  const tier = clamp(cap - (rng() < 0.45 ? 1 : 0) - (rng() < 0.15 ? 1 : 0), 1, 5);
  const kind = pick(rng, CLIENTS[client].kinds);
  const count = STAGE_COUNT_BY_TIER[tier] + KINDS[kind].stageBonus;
  const stages = genStages(rng, kind, tier, count);
  const pay = Math.round((PAY_BY_TIER[tier] * (0.8 + count * 0.12) * KINDS[kind].payMul * (0.92 + rng() * 0.16)) / 5) * 5;
  return {
    id: `c${c.day}-${idx}-${client}`,
    client,
    kind,
    title: pick(rng, CONTRACT_TITLES[kind]),
    tier,
    stages,
    pay,
    timeLimit: 55 + count * 40 + tier * 6,
    renown: tier * 7 + count * 2,
    lootCount: 1 + (kind === "grandheist" ? 1 : 0),
  };
}

export function generateBoard(c: Campaign): Contract[] {
  const rng = mulberry32(c.seed + c.day * 7919);
  const board: Contract[] = [];
  const open = CLIENT_IDS.filter((id) => c.rep[id] > -40);
  open.forEach((id, i) => board.push(makeContract(c, rng, id, i)));
  if (open.length > 0) board.push(makeContract(c, rng, pick(rng, open), 9));
  // odd job: always available so you can never soft-lock
  const oddStages = genStages(rng, "odd", 1, 2);
  board.push({
    id: `odd-${c.day}`,
    client: "odd",
    kind: "odd",
    title: pick(rng, CONTRACT_TITLES.odd),
    tier: 1,
    stages: oddStages,
    pay: 55 + Math.floor(rng() * 20),
    timeLimit: 120,
    renown: 4,
    lootCount: 1,
  });
  if (bossUnlocked(c)) {
    board.push({
      id: "boss",
      client: "boss",
      kind: "sovereign",
      title: "The Sovereign's Vault",
      tier: 6,
      stages: bossStages(c.seed),
      pay: 2600,
      timeLimit: 470,
      renown: 0,
      lootCount: 3,
      boss: true,
    });
  }
  return board;
}

export function modPayMul(mods: ModId[]): number {
  return mods.reduce((m, id) => m * MODS[id].pay, 1);
}

export function contractPay(c: Campaign, ct: Contract, mods: ModId[], s: Settings): number {
  let m = DIFFS[s.difficulty].pay * modPayMul(mods);
  if (ct.client !== "odd" && ct.client !== "boss") {
    m *= 1 + clamp(c.rep[ct.client] / 200, -0.15, 0.35);
  }
  if (hasPerk(c, "nobles")) m *= 1.12;
  return Math.round(ct.pay * m);
}

export function buildJobSpec(c: Campaign, ct: Contract, mods: ModId[], s: Settings): JobSpec {
  const d = DIFFS[s.difficulty];
  const heat = c.heat / 100;
  const hint = hintLevel(c);
  const timeBonus = 1 + 0.1 * c.upgrades.hourglass + (hasPerk(c, "scholars") ? 0.1 : 0);
  const timeLimit =
    ct.timeLimit * d.time * timeBonus * (1 - heat * 0.2) * (mods.includes("rush") ? 0.7 : 1);
  const baseInterval = Math.max(14, 30 - ct.tier * 2.5);
  return {
    mode: "job",
    title: ct.title,
    theme: ct.client,
    stages: ct.stages,
    timeLimit: Math.round(timeLimit),
    picks: Math.max(1, c.picks),
    pickDur: 4 + 2 * c.upgrades.steel,
    items: { ...c.items },
    tolMul: (1 + 0.08 * c.upgrades.wrench + 0.04 * c.generation) * d.tol,
    noiseMul: d.noise * (1 - 0.1 * c.upgrades.gloves) * (mods.includes("silent") ? 1.6 : 1),
    wearMul: mods.includes("ironhands") ? 2 : 1,
    noiseDecay: Math.max(0.8, 2.2 + 0.7 * c.upgrades.oil - heat * 1.0),
    patrolEnabled: !mods.includes("silent"),
    patrolInterval: baseInterval * d.patrol * (1 - heat * 0.4),
    patrolReduce: 0.25 * c.upgrades.cloak,
    patrolWarn: 3 + 0.8 * c.upgrades.cloak,
    hint,
    seed: Math.floor(Math.random() * 1e9),
    shake: s.shake,
    particles: s.particles,
  };
}

export interface JobReport {
  outcome: JobResult["outcome"];
  success: boolean;
  stars: number;
  pay: number;
  starBonus: number;
  fine: number;
  renownGain: number;
  repChanges: { client: ClientId; delta: number }[];
  heatDelta: number;
  loot: LootItem[];
  rent: number;
  gameOver: null | "arrested" | "bankrupt";
  victory: boolean;
  newRank: string | null;
  result: JobResult;
  title: string;
}

export function starsFor(r: JobResult): number {
  if (r.outcome !== "success") return 0;
  let s = 3;
  if (r.faults > 3) s--;
  if (r.peakNoise > 75) s--;
  if (r.timeLeft / Math.max(1, r.timeLimit) < 0.12) s--;
  if (r.skeletonUsed) s--;
  return clamp(s, 1, 3);
}

function endOfDay(c: Campaign, s: Settings, extraCool: number): { rent: number; news: string[] } {
  const news: string[] = [];
  const rent = rentFor(c, s);
  c.gold -= rent;
  c.day += 1;
  const cool = 6 + (hasPerk(c, "underworld") ? 3 : 0) + extraCool;
  c.heat = clamp(c.heat - cool, 0, 100);
  // market walk
  const rng = mulberry32(c.seed + c.day * 104729);
  LOOT_KINDS.forEach((k) => {
    const m = c.market[k];
    m.trend = m.trend * 0.55 + (rng() - 0.5) * 0.4;
    m.price = clamp(m.price + m.trend + (1 - m.price) * 0.12, 0.45, 1.9);
    m.hist = [...m.hist, m.price].slice(-14);
    if (m.price > 1.45) news.push(`${LOOT[k].label} are in hot demand at the fence!`);
    if (m.price < 0.6) news.push(`${LOOT[k].label} prices have collapsed.`);
  });
  // reputation drifts back toward neutral for grudges
  CLIENT_IDS.forEach((id) => {
    if (c.rep[id] < 0) c.rep[id] = Math.min(0, c.rep[id] + 1);
  });
  c.board = generateBoard(c);
  c.log = [`Day ${c.day}: paid ${rent}g rent.`, ...news.slice(0, 2), ...c.log].slice(0, 14);
  return { rent, news };
}

export function checkGameOver(c: Campaign): null | "arrested" | "bankrupt" {
  if (c.heat >= 100) return "arrested";
  if (c.gold < -150) return "bankrupt";
  return null;
}

export function resolveJob(
  c0: Campaign,
  ct: Contract,
  mods: ModId[],
  r: JobResult,
  s: Settings,
): { campaign: Campaign; report: JobReport } {
  const c: Campaign = structuredClone(c0);
  const d = DIFFS[s.difficulty];
  const rankBefore = rankIndex(c.renown);
  const success = r.outcome === "success";
  const stars = starsFor(r);
  const rng = mulberry32(c.seed + c.day * 31 + c.lootSeq * 7);

  // inventory consequences
  c.picks = Math.max(0, r.picksLeft);
  (Object.keys(r.itemsUsed) as ConsumableId[]).forEach((k) => {
    c.items[k] = Math.max(0, c.items[k] - r.itemsUsed[k]);
  });

  // stats
  c.stats.picksBroken += r.picksBroken;
  c.stats.faults += r.faults;
  c.stats.stagesCracked += r.stagesDone;
  c.stats.patrolsDodged += r.patrolsDodged;
  c.stats.patrolsCaught += r.patrolsCaught;
  c.stats.playTime += r.timeUsed;

  let pay = 0;
  let starBonus = 0;
  let fine = 0;
  let renownGain = 0;
  let heatDelta = 0;
  const loot: LootItem[] = [];
  const repChanges: { client: ClientId; delta: number }[] = [];

  const client = ct.client === "odd" || ct.client === "boss" ? null : ct.client;
  const addRep = (id: ClientId, delta: number) => {
    const before = c.rep[id];
    c.rep[id] = clamp(c.rep[id] + delta, -100, 100);
    const real = c.rep[id] - before;
    if (real !== 0) repChanges.push({ client: id, delta: real });
  };

  if (success) {
    const base = contractPay(c, ct, mods, s);
    const mult = stars === 3 ? 1.2 : stars === 2 ? 1 : 0.88;
    pay = Math.round(base * mult);
    starBonus = pay - base;
    renownGain = Math.round(ct.renown * (stars === 3 ? 1.25 : stars === 2 ? 1 : 0.8) * (1 + (d.pay - 1) * 0.3));
    c.gold += pay;
    c.stats.goldEarned += pay;
    c.stats.bestPay = Math.max(c.stats.bestPay, pay);
    c.stats.jobsDone += 1;
    if (stars === 3) c.stats.perfect += 1;
    c.renown += renownGain;
    heatDelta = Math.round((3 + (r.peakNoise > 70 ? 3 : 0) + r.patrolsCaught * 5 - (stars === 3 ? 2 : 0)) * d.heat);
    if (client) {
      const gain = 6 + ct.tier * 2 + (stars === 3 ? 4 : 0);
      addRep(client, gain);
      addRep(CLIENTS[client].rival, -Math.round(gain / 2));
    }
    const n = ct.lootCount + (stars === 3 && !ct.boss ? 1 : 0);
    const taste = CLIENT_TASTE[ct.client];
    for (let i = 0; i < n; i++) {
      const kind = pick(rng, taste);
      const tierMul = ct.boss ? 4 : 0.7 + ct.tier * 0.5;
      loot.push({
        id: c.lootSeq++,
        kind,
        name: pick(rng, LOOT[kind].names),
        base: Math.round(LOOT[kind].base * tierMul),
        from: ct.client,
      });
    }
    c.loot.push(...loot);
    if (ct.boss) c.bossDone = true;
    c.log = [`Cracked "${ct.title}" for ${pay}g (${stars}★).`, ...c.log];
  } else {
    c.stats.jobsFailed += 1;
    const failTable = {
      alarm: { heat: 22, rep: -8, fine: 0.12 },
      timeout: { heat: 8, rep: -5, fine: 0 },
      nopicks: { heat: 10, rep: -6, fine: 0.05 },
      abandon: { heat: 4, rep: -3, fine: 0 },
      success: { heat: 0, rep: 0, fine: 0 },
    }[r.outcome];
    if (r.outcome === "alarm") c.stats.alarms += 1;
    heatDelta = Math.round(failTable.heat * d.heat) + r.patrolsCaught * 2;
    fine = Math.round(contractPay(c, ct, mods, s) * failTable.fine);
    c.gold -= fine;
    if (client) addRep(client, failTable.rep);
    c.log = [`Failed "${ct.title}" (${r.outcome}).`, ...c.log];
  }
  c.heat = clamp(c.heat + heatDelta, 0, 100);

  const arrestedNow = c.heat >= 100;
  let rent = 0;
  if (!arrestedNow) {
    rent = endOfDay(c, s, 0).rent;
  }
  const victory = success && !!ct.boss;
  let gameOver = victory ? null : checkGameOver(c);
  if (victory) gameOver = null;
  if (!c.board.length) c.board = generateBoard(c);

  const rankAfter = rankIndex(c.renown);
  const report: JobReport = {
    outcome: r.outcome,
    success,
    stars,
    pay,
    starBonus,
    fine,
    renownGain,
    repChanges,
    heatDelta,
    loot,
    rent,
    gameOver,
    victory,
    newRank: rankAfter > rankBefore ? RANKS[rankAfter].name : null,
    result: r,
    title: ct.title,
  };
  return { campaign: c, report };
}

/* ---------- hub actions (pure; return new campaign or null if not allowed) ---------- */

export function buyUpgrade(c0: Campaign, id: UpgradeId): Campaign | null {
  const u = UPGRADES[id];
  if (c0.upgrades[id] >= u.max) return null;
  const cost = upgradeCost(c0, id);
  if (c0.gold < cost) return null;
  const c = structuredClone(c0);
  c.gold -= cost;
  c.stats.goldSpent += cost;
  c.upgrades[id] += 1;
  return c;
}

export function buyConsumable(c0: Campaign, id: ConsumableId): Campaign | null {
  const cost = consumableCost(c0, id);
  if (c0.gold < cost || c0.items[id] >= MAX_ITEMS) return null;
  const c = structuredClone(c0);
  c.gold -= cost;
  c.stats.goldSpent += cost;
  c.items[id] += 1;
  return c;
}

export function buyPick(c0: Campaign): Campaign | null {
  const cost = pickCost(c0);
  if (c0.gold < cost || c0.picks >= MAX_PICKS) return null;
  const c = structuredClone(c0);
  c.gold -= cost;
  c.stats.goldSpent += cost;
  c.picks += 1;
  return c;
}

export function sellLoot(c0: Campaign, ids: number[]): { campaign: Campaign; gained: number } {
  const c = structuredClone(c0);
  let gained = 0;
  const sold = new Set(ids);
  const keep: LootItem[] = [];
  for (const it of c.loot) {
    if (sold.has(it.id)) {
      const v = lootValue(c, it);
      gained += v;
      c.market[it.kind].price = clamp(c.market[it.kind].price * 0.94, 0.45, 1.9);
      c.stats.lootSold += 1;
    } else keep.push(it);
  }
  c.loot = keep;
  c.gold += gained;
  c.stats.goldEarned += gained;
  return { campaign: c, gained };
}

export function bribeCost(c: Campaign): number {
  return Math.round((70 + 12 * rankIndex(c.renown)) * shopMul(c));
}
export function bribeWatch(c0: Campaign): Campaign | null {
  const cost = bribeCost(c0);
  if (c0.gold < cost || c0.heat <= 0) return null;
  const c = structuredClone(c0);
  c.gold -= cost;
  c.stats.goldSpent += cost;
  c.heat = clamp(c.heat - 22, 0, 100);
  c.log = [`Bribed the watch captain (−${cost}g).`, ...c.log];
  return c;
}

export function layLow(c0: Campaign, s: Settings): { campaign: Campaign; gameOver: null | "bankrupt" | "arrested" } {
  const c = structuredClone(c0);
  endOfDay(c, s, 14);
  c.log = [`You lay low. The watch loses interest.`, ...c.log];
  return { campaign: c, gameOver: checkGameOver(c) };
}

export function nextGeneration(c: Campaign): Campaign {
  return newCampaign(c.house, c.generation + 1);
}
