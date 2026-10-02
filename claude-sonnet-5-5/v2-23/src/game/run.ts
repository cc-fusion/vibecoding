import {
  PART_LIST, PARTS, SLOTS, DIFFICULTIES, MUTAGENS, BOSSES, ARCHETYPES, NAMES, FINAL_ROUND, FORGE_COSTS, SHOP_WEIGHTS, RARITY_COST,
  TAGS, type Tag, type BossDef,
} from "./data";
import { mulberry32, hashSeed, type Meta } from "./save";
import type { Chimera, PartInst, BattleConfig, BattleResult } from "./battle";
import type { Settings } from "./save";

export type Loc = { t: "bench"; i: number } | { t: "sock"; c: number; s: number } | { t: "shop"; i: number };

export interface RunStats {
  kills: number; dmg: number; bought: number; sold: number; merges: number; rerolls: number; goldEarned: number;
  roundsWon: number; roundsLost: number; bosses: number; bestStreak: number; time: number; maxTier: number;
}
export interface RunState {
  v: 1; seed: string; diff: string; mutagens: string[]; round: number; gold: number; lives: number; maxLives: number;
  forge: number; team: Chimera[]; bench: PartInst[]; shop: (PartInst | null)[]; frozen: boolean; freeUsed: boolean;
  uidc: number; streakW: number; streakL: number; mercy: boolean; stats: RunStats; paid: number;
  over: "win" | "lose" | null; endless: boolean; tut: number; moves: number; counted: boolean; evolve: { id: string; tier: number; k: number } | null;
  last: string; // last round recap
  sk: number[]; // stats already banked into meta
}

export const lab = (meta: Meta, id: string) => meta.up[id] ?? 0;
export const benchSize = (meta: Meta) => 5 + lab(meta, "bench");
export const diffOf = (run: RunState) => DIFFICULTIES.find((d) => d.id === run.diff) ?? DIFFICULTIES[1];
export const hasMut = (run: RunState, id: string) => run.mutagens.includes(id);
export const rerollCost = (run: RunState, meta: Meta) => (!run.freeUsed && lab(meta, "reroll") > 0 ? 0 : hasMut(run, "hungry") ? 2 : 1);
export const forgeCost = (run: RunState) => (run.forge >= 4 ? 0 : FORGE_COSTS[run.forge] + (hasMut(run, "hungry") ? 2 : 0));
export const partCost = (id: string) => RARITY_COST[PARTS[id].rarity];
export const sellValue = (p: PartInst, meta: Meta) => [0, 1, 3, 8][p.tier] + lab(meta, "salvage");
export const isBossRound = (r: number) => r % 5 === 0;

export function newRun(meta: Meta, diffId: string, mutagens: string[], seed: string, tutorial: boolean): RunState {
  const diff = DIFFICULTIES.find((d) => d.id === diffId) ?? DIFFICULTIES[1];
  const lives = diff.lives + lab(meta, "life") + (tutorial ? 2 : 0);
  const run: RunState = {
    v: 1, seed, diff: diff.id, mutagens, round: 1, gold: diff.gold + lab(meta, "gold") + (tutorial ? 4 : 0), lives, maxLives: lives, forge: 1,
    team: [0, 1, 2].map((i) => ({ name: NAMES[(hashSeed(seed) + i * 3) % NAMES.length], parts: [null, null, null, null] })),
    bench: [], shop: [], frozen: false, freeUsed: false, uidc: 1, streakW: 0, streakL: 0, mercy: false,
    stats: { kills: 0, dmg: 0, bought: 0, sold: 0, merges: 0, rerolls: 0, goldEarned: 0, roundsWon: 0, roundsLost: 0, bosses: 0, bestStreak: 0, time: 0, maxTier: 1 },
    paid: 0, over: null, endless: false, tut: tutorial ? 0 : -1, moves: 0, counted: false, evolve: null, last: "", sk: [0, 0, 0, 0],
  };
  // make names unique
  const used = new Set<string>();
  run.team.forEach((c, i) => { while (used.has(c.name)) c.name = NAMES[(NAMES.indexOf(c.name) + 1 + i) % NAMES.length]; used.add(c.name); });
  rollShop(run, meta, false);
  return run;
}

// ---------- shop ----------
export function rollShop(run: RunState, meta: Meta, keepFrozen: boolean) {
  const pool = PART_LIST.filter((p) => meta.unlocked.includes(p.id));
  const w = SHOP_WEIGHTS[Math.min(3, run.forge - 1)];
  const draw = (): PartInst => {
    let r = Math.random() * 100, rar = 1;
    for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) { rar = i + 1; break; } }
    let cands = pool.filter((p) => p.rarity === rar);
    while (cands.length === 0 && rar > 1) { rar--; cands = pool.filter((p) => p.rarity === rar); }
    if (cands.length === 0) cands = pool;
    const d = cands[Math.floor(Math.random() * cands.length)];
    return { id: d.id, tier: 1, uid: run.uidc++ };
  };
  const next: (PartInst | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const cur = run.shop[i];
    next.push(keepFrozen && run.frozen && cur ? cur : draw());
  }
  run.shop = next;
  run.frozen = false;
}

export function allOwned(run: RunState): { p: PartInst; loc: Loc }[] {
  const out: { p: PartInst; loc: Loc }[] = [];
  run.team.forEach((c, ci) => c.parts.forEach((p, s) => { if (p) out.push({ p, loc: { t: "sock", c: ci, s } }); }));
  run.bench.forEach((p, i) => out.push({ p, loc: { t: "bench", i } }));
  return out;
}

export function getPart(run: RunState, l: Loc): PartInst | null {
  if (l.t === "bench") return run.bench[l.i] ?? null;
  if (l.t === "shop") return run.shop[l.i] ?? null;
  return run.team[l.c]?.parts[l.s] ?? null;
}

export function autoMerge(run: RunState): string[] {
  const names: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const groups = new Map<string, { p: PartInst; loc: Loc }[]>();
    for (const o of allOwned(run)) {
      if (o.p.tier >= 3) continue;
      const k = `${o.p.id}|${o.p.tier}`;
      groups.set(k, [...(groups.get(k) ?? []), o]);
    }
    let did = false;
    for (const arr of groups.values()) {
      if (arr.length < 3) continue;
      arr.sort((a, b) => (a.loc.t === "sock" ? 0 : 1) - (b.loc.t === "sock" ? 0 : 1));
      const keep = arr[0], rm = new Set([arr[1].p.uid, arr[2].p.uid]);
      run.bench = run.bench.filter((b) => !rm.has(b.uid));
      run.team.forEach((c) => c.parts.forEach((p, s) => { if (p && rm.has(p.uid)) c.parts[s] = null; }));
      keep.p.tier += 1;
      run.stats.merges++;
      run.stats.maxTier = Math.max(run.stats.maxTier, keep.p.tier);
      run.evolve = { id: keep.p.id, tier: keep.p.tier, k: (run.evolve?.k ?? 0) + 1 };
      names.push(`${PARTS[keep.p.id].name} → Tier ${keep.p.tier}`);
      did = true;
      break;
    }
    if (!did) break;
  }
  return names;
}

function firstEmptySock(run: RunState, slotIdx: number): { c: number; s: number } | null {
  for (let c = 0; c < 3; c++) if (!run.team[c].parts[slotIdx]) return { c, s: slotIdx };
  return null;
}

export interface ActResult { err?: string; msg?: string; sfx?: string }

export function buy(run: RunState, meta: Meta, settings: Settings, i: number, target?: Loc): ActResult {
  const item = run.shop[i];
  if (!item) return { err: "Sold out" };
  const cost = partCost(item.id);
  if (run.gold < cost) return { err: `Need ${cost} gold` };
  const def = PARTS[item.id];
  const slotIdx = SLOTS.indexOf(def.slot);
  const owned = allOwned(run).filter((o) => o.p.id === item.id && o.p.tier === 1).length;
  const willMerge = owned >= 2;
  let dest: Loc | null = null;
  if (target && target.t === "sock" && target.s === slotIdx) dest = target;
  else if (settings.autoEquip) { const e = firstEmptySock(run, slotIdx); if (e) dest = { t: "sock", c: e.c, s: e.s }; }
  const benchFree = run.bench.length < benchSize(meta);
  if (dest && dest.t === "sock") {
    const occ = run.team[dest.c].parts[dest.s];
    if (occ && !benchFree && !willMerge) return { err: "Bench full" };
  } else if (!benchFree && !willMerge) return { err: "Bench full — sell or equip something" };
  run.gold -= cost; run.stats.bought++;
  run.shop[i] = null;
  if (!meta.seen.includes(item.id)) meta.seen.push(item.id);
  if (dest && dest.t === "sock") {
    const occ = run.team[dest.c].parts[dest.s];
    run.team[dest.c].parts[dest.s] = item;
    if (occ) run.bench.push(occ);
  } else run.bench.push(item);
  const merged = autoMerge(run);
  return merged.length ? { msg: `EVOLVED! ${merged[0]}`, sfx: "merge" } : { sfx: "buy" };
}

export function reroll(run: RunState, meta: Meta): ActResult {
  const c = rerollCost(run, meta);
  if (run.gold < c) return { err: `Need ${c} gold` };
  run.gold -= c; run.stats.rerolls++;
  if (c === 0) run.freeUsed = true;
  rollShop(run, meta, false);
  return { sfx: "reroll" };
}

export function toggleFreeze(run: RunState): ActResult {
  run.frozen = !run.frozen;
  return { msg: run.frozen ? "Shop frozen for next round" : "Shop unfrozen", sfx: "click" };
}

export function upgradeForge(run: RunState): ActResult {
  if (run.forge >= 4) return { err: "Forge is at max level" };
  const c = forgeCost(run);
  if (run.gold < c) return { err: `Need ${c} gold` };
  run.gold -= c; run.forge++;
  return { msg: `Forge level ${run.forge}! Rarer parts appear`, sfx: "upgrade" };
}

export function sell(run: RunState, meta: Meta, loc: Loc): ActResult {
  const p = getPart(run, loc);
  if (!p || loc.t === "shop") return { err: "Nothing to sell" };
  const v = sellValue(p, meta);
  run.gold += v; run.stats.sold++;
  if (loc.t === "bench") run.bench = run.bench.filter((b) => b.uid !== p.uid);
  else run.team[loc.c].parts[loc.s] = null;
  return { msg: `Sold ${PARTS[p.id].name} for ${v}g`, sfx: "sell" };
}

export function move(run: RunState, meta: Meta, from: Loc, to: Loc): ActResult {
  if (from.t === "shop") return buy(run, meta, { autoEquip: false } as Settings, from.i, to);
  const p = getPart(run, from);
  if (!p) return { err: "Nothing selected" };
  if (to.t === "shop") return { err: "Can't move there" };
  if (to.t === "bench") {
    if (from.t === "bench") return {};
    if (run.bench.length >= benchSize(meta)) return { err: "Bench full" };
    run.team[from.c].parts[from.s] = null;
    run.bench.push(p); run.moves++;
    return { sfx: "equip" };
  }
  const def = PARTS[p.id];
  if (SLOTS[to.s] !== def.slot) return { err: `${def.name} needs a ${SLOTS[to.s]} socket` };
  if (from.t === "sock" && from.c === to.c && from.s === to.s) return {};
  const occ = run.team[to.c].parts[to.s];
  run.team[to.c].parts[to.s] = p;
  if (from.t === "bench") {
    run.bench = run.bench.filter((b) => b.uid !== p.uid);
    if (occ) run.bench.push(occ);
  } else run.team[from.c].parts[from.s] = occ;
  run.moves++;
  autoMerge(run);
  return { sfx: "equip" };
}

export function quickEquip(run: RunState, meta: Meta, loc: Loc): ActResult {
  const p = getPart(run, loc);
  if (!p) return {};
  if (loc.t === "sock") return move(run, meta, loc, { t: "bench", i: 0 });
  const si = SLOTS.indexOf(PARTS[p.id].slot);
  const e = firstEmptySock(run, si);
  if (!e) return { err: "No empty socket for that part (drag onto one to swap)" };
  return move(run, meta, loc, { t: "sock", c: e.c, s: e.s });
}

export function swapChimeras(run: RunState, a: number, b: number): ActResult {
  if (b < 0 || b > 2) return {};
  [run.team[a], run.team[b]] = [run.team[b], run.team[a]];
  run.moves++;
  return { sfx: "equip", msg: `Formation changed` };
}

// ---------- enemies ----------
export interface EnemyInfo { team: Chimera[]; name: string; tag: Tag | null; boss: BossDef | null; blurb: string; bossScale: number }

export function genEnemy(run: RunState, round = run.round): EnemyInfo {
  const rng = mulberry32(hashSeed(`${run.seed}:${round}`));
  const isBoss = isBossRound(round);
  const boss = isBoss ? BOSSES[(round / 5 - 1) % BOSSES.length] : null;
  const arch = isBoss ? null : ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const tag: Tag | null = boss ? boss.tag : arch ? arch.tag : null;
  const apex = hasMut(run, "apex") ? 0.2 : 0;
  const p2 = Math.min(0.95, Math.max(0, (round - 2) * 0.11) + apex);
  const p3 = Math.min(0.7, Math.max(0, (round - 9) * 0.1) + apex);
  const per = Math.min(4, round);
  const order = [1, 0, 2, 3];
  const names = [...NAMES].sort(() => rng() - 0.5);
  const team: Chimera[] = [0, 1, 2].map((pos) => {
    const isB = !!boss && boss.pos === pos;
    const parts: (PartInst | null)[] = [null, null, null, null];
    const n = isB ? 4 : per;
    for (let k = 0; k < n; k++) {
      const si = order[k];
      const themed = tag && rng() < (isB ? 0.95 : 0.6);
      const cands = PART_LIST.filter((p) => p.slot === SLOTS[si] && (themed ? p.tag === tag : true));
      const d = cands[Math.floor(rng() * cands.length)];
      const x = rng();
      let tier = x < p3 ? 3 : x < p2 ? 2 : 1;
      if (isB) tier = Math.min(3, tier + 1);
      parts[si] = { id: d.id, tier, uid: -(round * 100 + pos * 10 + k) };
    }
    return { name: isB && boss ? boss.name : names[pos], parts };
  });
  const bossScale = boss ? 1 + Math.max(0, Math.floor((round - 1) / 15)) * 0.4 : 1;
  return {
    team, name: boss ? boss.name : arch ? arch.name : "Unknown", tag, boss, bossScale,
    blurb: boss ? boss.title : arch ? arch.blurb : "",
  };
}

export function buildConfig(run: RunState, meta: Meta, settings: Settings): BattleConfig {
  const diff = diffOf(run);
  const en = genEnemy(run);
  const endlessMult = run.round > FINAL_ROUND ? 1 + (run.round - FINAL_ROUND) * 0.06 : 1;
  const m = diff.enemyMult * (run.mercy ? 0.93 : 1) * endlessMult;
  const glass = hasMut(run, "glass");
  return {
    player: run.team, enemy: en.team, round: run.round, boss: en.boss, bossScale: en.bossScale, enemyTag: en.tag, settings,
    bossPoison: 5 + run.round * 0.4,
    pOpts: { hpMult: 1, atkMult: 1, glass, labHp: lab(meta, "vigor") * 0.04, labAtk: lab(meta, "fang") * 0.03 },
    eOpts: { hpMult: m, atkMult: m, glass, labHp: 0, labAtk: 0 },
  };
}

// ---------- round resolution ----------
export interface RoundSummary {
  outcome: "win" | "lose" | "draw"; income: { label: string; v: number }[]; total: number; livesLost: number; boss: boolean; round: number; over: "win" | "lose" | null;
}

export function resolveRound(run: RunState, meta: Meta, res: BattleResult): RoundSummary {
  const boss = isBossRound(run.round);
  const income: { label: string; v: number }[] = [];
  let livesLost = 0;
  run.stats.kills += res.kills; run.stats.dmg += res.dmg; run.stats.time += res.time;
  const roundNow = run.round;
  if (res.outcome === "win") {
    run.streakW++; run.streakL = 0; run.mercy = false; run.stats.roundsWon++;
    run.stats.bestStreak = Math.max(run.stats.bestStreak, run.streakW);
    if (boss) run.stats.bosses++;
  } else if (res.outcome === "lose") {
    run.streakL++; run.streakW = 0; run.mercy = true; run.stats.roundsLost++;
    livesLost = boss ? 2 : 1;
    run.lives = Math.max(0, run.lives - livesLost);
  }
  if (res.outcome !== "draw") {
    const pending = res.outcome === "win" && roundNow === FINAL_ROUND && !run.endless;
    if (!pending && run.lives > 0) {
      income.push({ label: "Base income", v: 6 + (roundNow >= 5 ? 1 : 0) + (roundNow >= 10 ? 1 : 0) });
      if (res.outcome === "win") income.push({ label: "Victory bonus", v: 1 });
      if (res.outcome === "win" && boss) income.push({ label: "Boss spoils", v: 3 });
      if (res.outcome === "win" && run.streakW >= 2) income.push({ label: `Win streak ×${run.streakW}`, v: Math.min(2, Math.floor(run.streakW / 2)) });
      if (res.outcome === "lose" && run.streakL >= 2) income.push({ label: `Underdog aid ×${run.streakL}`, v: Math.min(2, run.streakL - 1) });
      const interest = Math.min(2 + lab(meta, "interest"), Math.floor(run.gold / 5));
      if (interest > 0) income.push({ label: "Interest", v: interest });
      if (hasMut(run, "scarce")) income.push({ label: "Scarce Scrap", v: -1 });
    }
  } else if (run.lives > 0) income.push({ label: "Stalemate stipend", v: 4 });
  const total = income.reduce((s, x) => s + x.v, 0);
  run.gold += Math.max(0, total); run.stats.goldEarned += Math.max(0, total);
  if (run.lives <= 0) run.over = "lose";
  else if (res.outcome === "win" && roundNow === FINAL_ROUND && !run.endless) run.over = "win";
  else {
    run.round++; run.freeUsed = false;
    rollShop(run, meta, true);
  }
  return { outcome: res.outcome, income, total, livesLost, boss, round: roundNow, over: run.over };
}

// ---------- scoring ----------
export const mutMult = (run: RunState) => run.mutagens.reduce((m, id) => m * (MUTAGENS.find((x) => x.id === id)?.mult ?? 1), 1);
export function calcScore(run: RunState) {
  const s = run.stats;
  const base = s.roundsWon * 100 + s.bosses * 300 + run.lives * 50 + s.merges * 15 + s.kills * 5 + (run.endless || run.over === "win" ? 1000 : 0);
  return Math.round(base * diffOf(run).essence * mutMult(run));
}
export function calcEssence(run: RunState) {
  const s = run.stats;
  const victory = run.endless || run.over === "win";
  return Math.floor((s.roundsWon * 2 + s.bosses * 6 + (victory ? 20 : 0)) * diffOf(run).essence * mutMult(run));
}

/** Pays out essence and records stats. Safe to call repeatedly (pays only the delta). Returns essence just paid. */
export function settleRun(run: RunState, meta: Meta): number {
  const due = calcEssence(run) - run.paid;
  const pay = Math.max(0, due);
  meta.essence += pay; run.paid += pay;
  const st = meta.stats;
  if (!run.counted) { st.runs++; run.counted = true; }
  if (run.over === "win" && !run.endless) st.wins++;
  st.bestRound = Math.max(st.bestRound, run.over === "lose" ? run.round : Math.max(run.round - 1, run.stats.roundsWon));
  st.bestScore = Math.max(st.bestScore, calcScore(run));
  const cur = [run.stats.kills, run.stats.roundsWon, run.stats.bosses, run.stats.merges];
  st.kills += cur[0] - run.sk[0]; st.rounds += cur[1] - run.sk[1]; st.bosses += cur[2] - run.sk[2]; st.merges += cur[3] - run.sk[3];
  run.sk = cur;
  return pay;
}

export const ALL_TAGS = TAGS; // re-export for convenience
