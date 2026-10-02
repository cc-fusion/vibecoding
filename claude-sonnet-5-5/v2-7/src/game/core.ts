// Core state, store, derived math (lean / forecast), helpers.
import { useSyncExternalStore } from "react";
import { BASE_MODS, BOONS, CRISES, DIFFS, FACTION_ORDER, FACTIONS, ISSUES, ISSUE_META, MANDATES, META_UPGRADES } from "./data";
import type { BoonDef, DiffId, FId, Issue, Mods, Prefs } from "./data";
import { loadSave, writeSave } from "./save";
import type { SaveData } from "./save";

export type Kind = "draft" | "rival" | "crisis" | "budget" | "confidence" | "boss";
export type Phase = "sitting" | "voting" | "result" | "event" | "election" | "electionResult" | "boon" | "over";
export interface FState { id: FId; seats: number; trust: number; dirt: number; pledges: number; bribesTerm: number; bribesTotal: number; betrayals: number; coalition: number; grudge: number; prefs: Prefs; }
export interface Seat { f: FId; temper: number; absent: boolean; }
export interface Lobby { bribe: number; speech: number; pledge: number; blackmail: number; mod: number; hidden: number; bribed: number; spoke: number; tags: string[]; }
export interface Bill { stance: Prefs; riders: { id: string; target?: FId }[]; }
export interface Sitting {
  kind: Kind; ap: number; apMax: number; bill: Bill; dir: 1 | -1; whip: null | "aye" | "nay"; lobby: Record<FId, Lobby>;
  modifier: null | { id: string; name: string; desc: string; emoji: string }; crisis?: (typeof CRISES)[number]; sponsor?: FId;
  boss?: "judge" | "queen" | "strix"; reading: number; won: number; lost: number; attack?: { id: string; name: string; text: string };
  noPersuade: boolean; owlCounter: string | null; thr: number; fog: number; heatMult: number; title: string;
}
export interface VoteRes { votes: ("y" | "n" | "a")[]; yes: number; no: number; absent: number; needed: number; passed: boolean; per: Record<FId, { yes: number; no: number; absent: number }>; }
export interface ResultInfo { passed: boolean; title: string; lines: { text: string; tone: string }[]; next: "continue" | "over"; }
export interface EventState { kind: "random" | "scandal"; id: string; title: string; emoji: string; text: string; options: { label: string; desc: string; disabled?: boolean }[]; outcome: string | null; }
export interface ElectionState { picks: string[]; smear: FId | null; result: null | { rows: { f: FId; before: number; after: number; approval: number }[]; lost: boolean; news: string[] }; }
export interface OverInfo { win: boolean; cause: string; title: string; text: string; feathers: number; }
export interface RunStats { passed: number; failed: number; bribes: number; speeches: number; scandals: number; peakSeats: number; peakHeat: number; termsDone: number; shiniesSpent: number; betrayals: number; blackmails: number; defections: number; sittings: number; }
export interface LogLine { id: number; text: string; tone: string; }
export interface Game {
  phase: Phase; diff: DiffId; mandates: string[]; leader: string; mods: Mods; term: number; idx: number;
  factions: Record<FId, FState>; seats: Seat[]; shinies: number; heat: number; renown: number; stats: Record<Issue, number>;
  sitting: Sitting; vote: VoteRes | null; reveal: number; result: ResultInfo | null; event: EventState | null; election: ElectionState | null;
  boons: BoonDef[] | null; owned: string[]; selected: FId; log: LogLine[]; style: Record<string, number>; run: RunStats;
  tut: { on: boolean; step: number }; banner: { key: number; text: string; sub: string } | null; over: OverInfo | null;
  lastCrisis?: string; pendingScandal: boolean; focusIssue: number;
}

// ───────── store ─────────
export let SAVE: SaveData = loadSave();
let G: Game | null = null;
let snap = { g: G as Game | null, save: SAVE, v: 0 };
const listeners = new Set<() => void>();
export const getG = () => G;
export const setG = (g: Game | null) => { G = g; };
export function commit() { snap = { g: G, save: SAVE, v: snap.v + 1 }; listeners.forEach(l => l()); }
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useGame = () => useSyncExternalStore(subscribe, () => snap);
export function mutateSave(fn: (s: SaveData) => void) { fn(SAVE); SAVE = { ...SAVE }; writeSave(SAVE); commit(); }

// ───────── helpers ─────────
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const RIVALS: FId[] = ["ravens", "magpies", "jackdaws", "rooks", "owls"];
export const TOTAL_SEATS = 99;
export function allocate(weights: number[], total: number, min: number): number[] {
  const n = weights.length; const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const free = total - min * n;
  const raw = weights.map(w => (w / sum) * free);
  const out = raw.map(r => Math.floor(r)); let rem = free - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; rem > 0 && i < order.length; i++, rem--) out[order[i][1]]++;
  return out.map(o => o + min);
}
export const ambition = (s: Prefs) => ISSUES.reduce((a, k) => a + Math.abs(s[k]), 0);
const WORDS: Record<string, string> = { "wealth+": "Prosperity", "wealth-": "Austerity", "order+": "Vigilance", "order-": "Liberty", "welfare+": "Gleaning", "welfare-": "Thrift", "nature+": "Hedgerow", "nature-": "Harvest" };
export function billName(s: Prefs): string {
  const ks = [...ISSUES].filter(k => s[k] !== 0).sort((a, b) => Math.abs(s[b]) - Math.abs(s[a]));
  if (!ks.length) return "Procedural Motion";
  const w = ks.slice(0, 2).map(k => WORDS[k + (s[k] > 0 ? "+" : "-")]);
  return `${w.join(" & ")} Act`;
}
export const heatMult = (g: Game) => DIFFS[g.diff].heat * (1 + g.mods.heatMult) * (g.mandates.includes("press") ? 1.4 : 1) * (g.sitting?.heatMult ?? 1);
export const apMaxOf = (g: Game) => Math.max(1, 3 + g.mods.ap + (g.sitting?.modifier?.id === "recess" ? 1 : 0));
export const riderCostOf = (g: Game, id: string) => { const r = { pork: 12, kickback: 0, sunset: 6, gag: 8, emergency: 5, fanfare: 10 } as Record<string, number>; return Math.round((r[id] || 0) * (1 - Math.min(0.8, g.mods.riderCost))); };
export const riderTotal = (g: Game) => g.sitting.bill.riders.reduce((a, r) => a + riderCostOf(g, r.id), 0);
export const riderSlots = (g: Game) => 2 + g.mods.riderSlots;

export function bribeCost(g: Game, f: FId): number {
  const F = g.factions[f]; const d = DIFFS[g.diff];
  const price = 1 + F.bribesTerm * 0.25 + (f === "magpies" ? F.bribesTotal * 0.03 : 0);
  return Math.max(3, Math.round(F.seats * 0.9 * FACTIONS[f].greed * price * d.bribe * (1 - Math.min(0.7, g.mods.bribeCost))));
}
export function satisfaction(g: Game, f: FId): number {
  const p = g.factions[f].prefs; const tot = ISSUES.reduce((a, k) => a + Math.abs(p[k]), 0);
  if (!tot) return 0;
  return clamp(ISSUES.reduce((a, k) => a + p[k] * ((g.stats[k] - 50) / 50), 0) / tot, -1, 1);
}
function riderLean(b: Bill, f: FId): number {
  let v = 0;
  for (const r of b.riders) {
    if (r.id === "pork" && r.target === f) v += 18;
    if (r.id === "kickback" && (f === "ravens" || f === "owls")) v -= 6;
    if (r.id === "sunset") v += 6;
    if (r.id === "gag") v += f === "jackdaws" ? -12 : f === "rooks" ? -4 : 0;
    if (r.id === "emergency") v += f === "jackdaws" ? -10 : f === "owls" ? 8 : 0;
    if (r.id === "fanfare") v += 3;
  }
  return v;
}
export function leanOf(g: Game, f: FId, hiddenK: number): number {
  const s = g.sitting, F = g.factions[f], L = s.lobby[f];
  let base: number;
  if (s.kind === "confidence") {
    base = satisfaction(g, f) * 55 + F.trust * 0.4 + (g.renown - 50) * 0.35 - 10 - Math.max(0, g.heat - 40) * 0.3;
    if (f === "crows") base += 30;
  } else {
    const dot = ISSUES.reduce((a, k) => a + F.prefs[k] * s.bill.stance[k], 0);
    base = (dot / 8) * 52 + F.trust * 0.32;
    if (f === "crows") base += 22;
    if (s.sponsor === f) base += 45;
  }
  let lean = base + s.dir * (L.bribe + L.speech + L.pledge + L.blackmail) + L.mod + L.hidden * hiddenK + riderLean(s.bill, f);
  if (f === "crows" && s.whip) lean += s.whip === "aye" ? 35 : -35;
  return lean;
}
export const spreadOf = (g: Game, f: FId) => (10 + (1 - FACTIONS[f].discipline) * 45) * (g.mandates.includes("fractured") ? 1.3 : 1) * g.sitting.fog;

export interface Forecast { states: ("y" | "n" | "a")[]; margins: number[]; yes: number; no: number; absent: number; needed: number; per: Record<FId, { yes: number; no: number; absent: number; lean: number; uncertain: boolean }>; }
export function forecast(g: Game, real = false): Forecast {
  const k = real ? 1 : Math.min(1, g.mods.clarity);
  const leans = {} as Record<FId, number>; const per = {} as Forecast["per"];
  for (const f of FACTION_ORDER) { leans[f] = leanOf(g, f, k); per[f] = { yes: 0, no: 0, absent: 0, lean: leans[f], uncertain: !real && Math.abs(g.sitting.lobby[f].hidden * (1 - k)) > 5 }; }
  const states: Forecast["states"] = []; const margins: number[] = []; let yes = 0, no = 0, absent = 0;
  for (const seat of g.seats) {
    if (seat.absent) { states.push("a"); margins.push(0); absent++; per[seat.f].absent++; continue; }
    const m = leans[seat.f] + seat.temper * spreadOf(g, seat.f);
    margins.push(m);
    if (m > 0) { states.push("y"); yes++; per[seat.f].yes++; } else { states.push("n"); no++; per[seat.f].no++; }
  }
  const present = yes + no;
  return { states, margins, yes, no, absent, needed: Math.floor(present * g.sitting.thr) + 1, per };
}
export function charterOk(g: Game): boolean { const s = g.sitting.bill.stance; return ISSUES.every(k => s[k] >= 0) && ambition(s) >= 4; }

export const newSeat = (f: FId): Seat => ({ f, temper: Math.random() * 2 - 1, absent: false });
export function syncSeats(g: Game) {
  const by: Partial<Record<FId, Seat[]>> = {};
  for (const s of g.seats) (by[s.f] ||= []).push(s);
  const arr: Seat[] = [];
  for (const f of FACTION_ORDER) { const have = by[f] || []; for (let i = 0; i < g.factions[f].seats; i++) arr.push(have[i] ?? newSeat(f)); }
  g.seats = arr;
}
export function rollTempers(g: Game) { for (const s of g.seats) s.temper = Math.random() * 2 - 1; }

// ───────── logging & state mutators ─────────
let lid = 0;
export function logL(g: Game, text: string, tone = "info") { g.log.push({ id: ++lid, text, tone }); if (g.log.length > 60) g.log.shift(); }
export function addHeat(g: Game, n: number, raw = false) {
  const v = n > 0 && !raw ? n * heatMult(g) : n;
  g.heat = clamp(g.heat + v, 0, 100); g.run.peakHeat = Math.max(g.run.peakHeat, g.heat);
  return v;
}
export const addTrust = (g: Game, f: FId, n: number) => { const F = g.factions[f]; F.trust = clamp(F.trust + (n > 0 ? n * (1 + g.mods.trustGain) : n), -100, 100); };
export const addStat = (g: Game, k: Issue, n: number) => { g.stats[k] = clamp(g.stats[k] + n, 0, 100); };
export const addRenown = (g: Game, n: number) => { g.renown = clamp(g.renown + n, 0, 100); };
export const mandateBonus = (g: Game) => g.mandates.reduce((a, id) => a + (MANDATES.find(m => m.id === id)?.bonus || 0), 0);
export function modsFromSave(s: SaveData, leaderId: string, base: Mods): Mods {
  const m = { ...base };
  for (const up of META_UPGRADES) if (s.upgrades.includes(up.id)) for (const [k, v] of Object.entries(up.mods)) (m as any)[k] += v as number;
  void leaderId; return m;
}
export const ownedBoons = (g: Game) => BOONS.filter(b => g.owned.includes(b.id));
export const issueLabel = (k: Issue) => ISSUE_META[k].name;
export { BASE_MODS };
