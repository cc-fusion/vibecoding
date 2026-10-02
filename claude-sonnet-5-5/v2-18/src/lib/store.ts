import { useSyncExternalStore } from "react";
import { audio } from "./audio";
import { CASE_COUNT, generateCase, pairKey } from "./caseGen";
import { DIFFS, MODS, TELLS, TRAIT_INFO, UPGRADES } from "./content";
import type { CaseDef, Career, Clue, Deduction, Meta, Pillar, Settings } from "./types";
import { PILLARS } from "./types";

// ------------------------------------------------------------ persistence
const KEY = "mind-palace-detective-v1";

const defaultSettings = (): Settings => ({
  master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, difficulty: 1,
  mods: { hazy: false, liar: false, insomnia: false, nightmares: false },
});

const defaultMeta = (): Meta => ({
  insight: 0, up: {}, settings: defaultSettings(), best: {}, career: null, tutorialDone: false, won: false, cold: 0,
  stats: { solved: 0, lies: 0, careers: 0, wins: 0, bestScore: 0, deaths: 0 },
});

function loadMeta(): Meta {
  const d = defaultMeta();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Meta>;
    return {
      ...d, ...o,
      settings: { ...d.settings, ...(o.settings || {}), mods: { ...d.settings.mods, ...((o.settings && o.settings.mods) || {}) } },
      stats: { ...d.stats, ...(o.stats || {}) },
      up: o.up || {}, best: o.best || {},
    };
  } catch {
    return d;
  }
}

export const meta: Meta = loadMeta();

export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* storage unavailable */ }
}

export function resetAllProgress() {
  const d = defaultMeta();
  d.settings = meta.settings;
  Object.assign(meta, d);
  saveMeta();
  notify();
}

// ------------------------------------------------------------ pub/sub
let version = 0;
const listeners = new Set<() => void>();
export function notify() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function useStore() {
  return useSyncExternalStore(subscribe, () => version);
}

export function applyAudioSettings() {
  const s = meta.settings;
  audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
}

// ------------------------------------------------------------ params
export function P() {
  const d = DIFFS[meta.settings.difficulty];
  const m = meta.settings.mods;
  const lv = (id: string) => meta.up[id] || 0;
  let scoreMul = d.score;
  MODS.forEach((x) => { if (m[x.id]) scoreMul += x.score; });
  return {
    maxFocus: 100 + lv("focus") * 12,
    regen: (2.2 + lv("regen") * 0.6) * d.regen * (m.insomnia ? 0.5 : 1),
    dmg: 1 - lv("nerves") * 0.1,
    decay: d.decay * (m.hazy ? 1.6 : 1) * (1 - lv("anchor") * 0.12),
    lieBonus: lv("lie") * 0.08,
    falseCut: lv("lie") * 0.05,
    patience: lv("tongue") + d.patience,
    speed: 1 + lv("feet") * 0.07,
    pulseCost: 20 - lv("pulse") * 3,
    pulseR: 200 + lv("pulse") * 15,
    hints: lv("intuit"),
    assoc: lv("assoc") > 0,
    enemy: d.enemy * (m.nightmares ? 1.6 : 1),
    scoreMul,
    liar: m.liar,
    dawn: d.dawn,
  };
}

// ------------------------------------------------------------ types
export type Mode = "career" | "replay" | "cold" | "tutorial";
export type StmtState = "pending" | "accepted" | "broken";
export interface Dialog { who: "you" | "them" | "sys"; text: string }

export interface CaseResult {
  solved: boolean;
  reason: "solved" | "dawn" | "breakdown" | "fired";
  title: string;
  culprit: string;
  score: number;
  stars: number;
  insight: number;
  evidence: number;
  ruledOut: number;
  lies: number;
  wrong: number;
  seconds: number;
  sanityLeft: number;
  examined: number;
  combos: number;
  next: "campaign" | "retry" | "gameover" | "victory";
  tutorial: boolean;
  mode: Mode;
}

export interface Run {
  def: CaseDef;
  mode: Mode;
  found: string[];
  searched: Record<string, boolean>;
  deds: string[];
  boardPos: Record<string, { x: number; y: number }>;
  focus: number; maxFocus: number; sanity: number; maxSanity: number;
  dawn: number; dawnTotal: number;
  clarity: number[];
  room: number;
  state: Record<string, StmtState>;
  press: Record<string, number>;
  tells: Record<string, { fired: boolean; label: string }>;
  claims: Record<string, { value: boolean; src: "testimony" | "exposed" }>;
  patience: number[];
  dialog: Record<number, Dialog[]>;
  wrongAccused: number[];
  stats: { examined: number; combos: number; wrongCombos: number; hits: number; pulses: number; lies: number; wrongEvid: number; wrongAcc: number; dashes: number };
  hints: number; hintUntil: number;
  bossHp: number; bossDown: boolean;
  tut: number;
  clock: number;
  forced: boolean;
  over: boolean;
  result: CaseResult | null;
  verdict: { correct: boolean; name: string; evidence: number } | null;
  warned: number;
}

export interface Toast { id: number; text: string; kind: "good" | "bad" | "info"; }

export const G = {
  run: null as Run | null,
  toasts: [] as Toast[],
  shake: 0,
  flash: 0,
  uiShakeUntil: 0,
  lastCareer: null as Career | null,
  lastResult: null as CaseResult | null,
};

let tid = 0;
export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = ++tid;
  G.toasts.push({ id, text, kind });
  if (G.toasts.length > 5) G.toasts.shift();
  notify();
  window.setTimeout(() => {
    G.toasts = G.toasts.filter((t) => t.id !== id);
    notify();
  }, 2800);
}

export function addShake(n: number) {
  if (meta.settings.shake) G.shake = Math.max(G.shake, n);
}
export function uiShake() {
  if (meta.settings.shake) {
    G.uiShakeUntil = performance.now() + 380;
    notify();
  }
}

export const skey = (s: number, p: Pillar) => `${s}:${p}`;

// ------------------------------------------------------------ tutorial
export const TUT_STEPS = [
  { ev: "move", text: "Welcome to your Mind Palace. Move with WASD / Arrow keys, or click or tap the floor." },
  { ev: "examine", text: "Walk up to a glowing object and HOLD E (or click it) to examine it for clues. Each search costs Focus." },
  { ev: "gather", text: "Keep searching. Find two clues that share the same golden keyword. Press H for a hint if you're lost." },
  { ev: "board", text: "You hold a matching pair! Press 2 to open the Deduction Board." },
  { ev: "deduce", text: "Click one clue card, then another card that shares its golden keyword, to combine them into a deduction." },
  { ev: "ask", text: "Press 3 to open Interrogation. Pick a suspect and ask them a topic. Watch their tell." },
  { ev: "resolve", text: "Accept a statement, Press it, or Present evidence. Lies can be broken with the right clue!" },
  { ev: "accuse", text: "Prove Means, Motive and Opportunity against one suspect, then press F (or click Accuse) and name them. Case Zero ends there." },
];

export function tutEvent(ev: string) {
  const run = G.run;
  if (!run || run.mode !== "tutorial" || run.over) return;
  const i = TUT_STEPS.findIndex((s, k) => k >= run.tut && s.ev === ev);
  if (i >= 0) {
    run.tut = i + 1;
    audio.play("select");
    notify();
  }
}
export function tutSkip() {
  const run = G.run;
  if (run && run.mode === "tutorial" && run.tut < TUT_STEPS.length) {
    run.tut++;
    notify();
  }
}
function tutCheckGather() {
  const run = G.run;
  if (!run || run.mode !== "tutorial") return;
  if (TUT_STEPS[run.tut]?.ev === "gather" && hasPair(run)) tutEvent("gather");
}

// ------------------------------------------------------------ helpers
export const clueOf = (run: Run, id: string): Clue => run.def.clues.find((c) => c.id === id)!;
export function dedOf(run: Run, a: string, b: string): Deduction | undefined {
  const k = pairKey(a, b);
  return run.def.deductions.find((d) => pairKey(d.a, d.b) === k);
}
export function hasPair(run: Run) {
  const f = run.found;
  for (let i = 0; i < f.length; i++)
    for (let j = i + 1; j < f.length; j++) {
      const d = dedOf(run, f[i], f[j]);
      if (d && !run.deds.includes(d.id)) return true;
    }
  return false;
}
export function proven(run: Run, s: number, p: Pillar): boolean | null {
  for (const id of run.deds) {
    const d = run.def.deductions.find((x) => x.id === id);
    if (d && d.suspect === s && d.pillar === p) return d.value;
  }
  return null;
}
export function evidence(run: Run, s: number) {
  return PILLARS.filter((p) => proven(run, s, p) === true).length;
}
export function hintTarget(run: Run): { room: number; objId: string } | null {
  const cands = run.def.clues.filter((c) => !run.found.includes(c.id) && !(c.sealed && !run.bossDown));
  const pri = cands.filter((c) => c.suspect === run.def.culprit || (c.kind === "opp" && c.suspect === undefined));
  const c = (pri.length ? pri : cands)[0];
  return c ? { room: c.room, objId: c.objId } : null;
}
export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// ------------------------------------------------------------ career
export function newCareer() {
  meta.career = { idx: 0, cred: 3, score: 0, solved: 0, stars: 0, lies: 0, seconds: 0, seed: 1 + Math.floor(Math.random() * 99999), stars_by: [] };
  meta.stats.careers++;
  saveMeta();
  notify();
}

export function startCase(idx: number, mode: Mode, seed?: number) {
  const p = P();
  const tutorial = mode === "tutorial";
  const sd = seed ?? (tutorial ? 424242 : mode === "career" && meta.career ? meta.career.seed : Math.floor(Math.random() * 999999));
  const def = generateCase(tutorial ? 0 : idx, sd, tutorial);
  const dawnTotal = tutorial ? 99999 : p.dawn + (def.suspects.length - 4) * 45;
  G.shake = 0;
  G.flash = 0;
  G.toasts = [];
  G.run = {
    def, mode, found: [], searched: {}, deds: [], boardPos: {},
    focus: p.maxFocus, maxFocus: p.maxFocus, sanity: 100, maxSanity: 100,
    dawn: dawnTotal, dawnTotal, clarity: def.rooms.map(() => 100), room: -1,
    state: {}, press: {}, tells: {}, claims: {},
    patience: def.suspects.map((s) => Math.max(2, s.patience + p.patience)),
    dialog: {}, wrongAccused: [],
    stats: { examined: 0, combos: 0, wrongCombos: 0, hits: 0, pulses: 0, lies: 0, wrongEvid: 0, wrongAcc: 0, dashes: 0 },
    hints: p.hints, hintUntil: 0,
    bossHp: 8, bossDown: false, tut: 0, clock: 0, forced: false, over: false, result: null, verdict: null, warned: 0,
  };
  notify();
}

// ------------------------------------------------------------ simulation tick (global systems)
export function hurtSanity(n: number, shake = 0.5) {
  const run = G.run;
  if (!run || run.over || run.mode === "tutorial") return;
  const v = n * P().dmg;
  run.sanity = Math.max(0, run.sanity - v);
  run.stats.hits++;
  G.flash = 1;
  addShake(shake * 10);
  audio.play("hurt");
}

export function tickRun(dt: number) {
  const run = G.run;
  if (!run || run.over) return;
  const p = P();
  const tut = run.mode === "tutorial";
  run.clock += dt;
  if (!tut) run.dawn -= dt;
  else tutCheckGather();
  const hub = run.room === -1;
  run.focus = Math.min(run.maxFocus, run.focus + p.regen * (hub ? 1.4 : 1) * (run.sanity < 30 ? 0.7 : 1) * dt);
  if (hub && !tut) run.sanity = Math.min(run.maxSanity, run.sanity + 0.9 * dt);
  if (!tut) {
    run.clarity = run.clarity.map((c, i) => Math.max(0, c - 0.28 * p.decay * (i === run.room ? 0.35 : 1) * dt));
    if (run.dawn < 60 && run.warned < 1) { run.warned = 1; toast("One minute until dawn!", "bad"); audio.play("dawn"); }
    if (run.dawn < 20 && run.warned < 2) { run.warned = 2; toast("Dawn is breaking. Decide now!", "bad"); }
    if (run.dawn <= 0 && !run.forced) {
      run.dawn = 0;
      run.forced = true;
      audio.play("dawn");
      notify();
    }
    if (run.sanity <= 0) finish("breakdown");
  }
}

// ------------------------------------------------------------ palace actions
export type ExamineResult = { kind: "clue"; clue: Clue } | { kind: "empty" } | { kind: "already" } | { kind: "tired" } | { kind: "sealed" };

const EXAM_COST = 7;
export function canExamine() {
  const run = G.run;
  return !!run && run.focus >= EXAM_COST;
}

export function addClue(id: string) {
  const run = G.run;
  if (!run || run.found.includes(id)) return false;
  run.found.push(id);
  const n = run.found.length - 1;
  run.boardPos[id] = { x: 24 + (n % 6) * 205, y: 24 + Math.floor(n / 6) * 128 };
  const c = clueOf(run, id);
  run.searched[c.objId] = true;
  tutCheckGather();
  notify();
  return true;
}

export function examineObject(roomIdx: number, objId: string): ExamineResult {
  const run = G.run;
  if (!run) return { kind: "empty" };
  if (run.searched[objId]) return { kind: "already" };
  const obj = run.def.rooms[roomIdx].objects.find((o) => o.id === objId);
  if (!obj) return { kind: "empty" };
  if (run.focus < EXAM_COST) return { kind: "tired" };
  if (obj.clueId) {
    const c = clueOf(run, obj.clueId);
    if (c.sealed && !run.bossDown) return { kind: "sealed" };
  }
  run.focus -= EXAM_COST;
  run.stats.examined++;
  tutEvent("examine");
  if (obj.clueId) {
    addClue(obj.clueId);
    audio.play("found");
    return { kind: "clue", clue: clueOf(run, obj.clueId) };
  }
  run.searched[objId] = true;
  audio.play("empty");
  notify();
  return { kind: "empty" };
}

export function pulseCost() {
  return P().pulseCost;
}

export function useHint() {
  const run = G.run;
  if (!run || run.over) return;
  if (run.hints <= 0) { toast("No Hint charges left. Buy Intuition in the Mind Gym.", "info"); return; }
  run.hints--;
  run.hintUntil = run.clock + 9;
  audio.play("heal");
  toast("Intuition: a pulsing ring marks something relevant.", "good");
  notify();
}

// ------------------------------------------------------------ board
export type CombineResult =
  | { kind: "ded"; ded: Deduction }
  | { kind: "known"; ded: Deduction }
  | { kind: "coincidence" } | { kind: "unrelated" } | { kind: "tired" } | { kind: "same" };

export function combine(a: string, b: string): CombineResult {
  const run = G.run;
  if (!run || a === b) return { kind: "same" };
  const ca = clueOf(run, a);
  const cb = clueOf(run, b);
  const ded = dedOf(run, a, b);
  if (ded && run.deds.includes(ded.id)) return { kind: "known", ded };
  if (run.focus < 4) return { kind: "tired" };
  if (ded) {
    run.focus -= 4;
    run.deds.push(ded.id);
    run.stats.combos++;
    run.sanity = Math.min(run.maxSanity, run.sanity + 4);
    run.clarity[ca.room] = Math.min(100, run.clarity[ca.room] + 22);
    run.clarity[cb.room] = Math.min(100, run.clarity[cb.room] + 22);
    const ia = run.deds.length - 1;
    run.boardPos[ded.id] = { x: 1290 + (ia % 2) * 215, y: 24 + Math.floor(ia / 2) * 128 };
    audio.play("deduce");
    tutEvent("deduce");
    notify();
    return { kind: "ded", ded };
  }
  if (ca.key === cb.key) {
    run.focus -= 3;
    run.stats.wrongCombos++;
    audio.play("coincidence");
    notify();
    return { kind: "coincidence" };
  }
  run.focus -= 2;
  run.stats.wrongCombos++;
  hurtSanity(3, 0.15);
  audio.play("wrong");
  notify();
  return { kind: "unrelated" };
}

// ------------------------------------------------------------ interrogation
function log(s: number, who: Dialog["who"], text: string) {
  const run = G.run!;
  (run.dialog[s] = run.dialog[s] || []).push({ who, text });
  if (run.dialog[s].length > 40) run.dialog[s].shift();
}

export function stmtOf(run: Run, s: number, p: Pillar) {
  return run.def.suspects[s].statements.find((x) => x.pillar === p)!;
}

export function askTopic(s: number, p: Pillar) {
  const run = G.run;
  if (!run || run.over) return;
  const sus = run.def.suspects[s];
  const st = stmtOf(run, s, p);
  const k = skey(s, p);
  if (!run.tells[k]) {
    const info = TRAIT_INFO[sus.trait];
    const pp = P();
    let prob = st.isLie ? info.lie + pp.lieBonus : info.fake - pp.falseCut;
    if (pp.liar && st.isLie) prob *= 0.6;
    if (run.sanity < 35) prob += st.isLie ? -0.1 : 0.2;
    prob = Math.max(0.03, Math.min(0.97, prob));
    const fired = run.mode === "tutorial" ? st.isLie : Math.random() < prob;
    run.tells[k] = { fired, label: TELLS[Math.floor(Math.random() * TELLS.length)] };
  }
  log(s, "you", `Tell me about ${p === "opp" ? "where you were" : p === "motive" ? "your relationship with " + run.def.victim : "the " + run.def.weapon}.`);
  log(s, "them", `"${st.text}"`);
  tutEvent("ask");
  audio.play("select");
  if (run.tells[k].fired) window.setTimeout(() => audio.play("tell"), 450);
  notify();
}

function loseP(s: number, n: number) {
  const run = G.run!;
  run.patience[s] = Math.max(0, run.patience[s] - n);
  if (run.patience[s] <= 0) {
    log(s, "sys", `${run.def.suspects[s].first} crosses their arms and refuses to say another word.`);
    toast(`${run.def.suspects[s].first} clams up!`, "bad");
  }
}

export function acceptStatement(s: number, p: Pillar) {
  const run = G.run;
  if (!run || run.patience[s] <= 0) return;
  const st = stmtOf(run, s, p);
  const k = skey(s, p);
  if (run.state[k] === "broken") return;
  run.state[k] = "accepted";
  if (st.claim !== null) run.claims[k] = { value: st.claim, src: "testimony" };
  log(s, "sys", "You note the testimony down. It may or may not be true.");
  audio.play("ui");
  tutEvent("resolve");
  notify();
}

export function pressStatement(s: number, p: Pillar) {
  const run = G.run;
  if (!run || run.patience[s] <= 0) return;
  const sus = run.def.suspects[s];
  const st = stmtOf(run, s, p);
  const k = skey(s, p);
  if (run.state[k] === "broken") return;
  if (run.focus < 8) { toast("Too drained to press. Wait for Focus to return.", "bad"); return; }
  run.focus -= 8;
  const n = (run.press[k] = (run.press[k] || 0) + 1);
  log(s, "you", "That doesn't sound right. Say it again.");
  audio.play("press");
  uiShake();
  if (sus.trait === "evasive" && n === 1) {
    log(s, "them", `"I've said all I intend to say."`);
    log(s, "sys", `${sus.first} deflects. Evasive suspects ignore the first Press.`);
  } else if (st.isLie) {
    const cl = clueOf(run, st.contra[0]);
    const lvl = n - (sus.trait === "evasive" ? 1 : 0);
    if (lvl === 1) {
      log(s, "them", `"...Why are you looking at me like that?"`);
      log(s, "sys", `The story wobbles around "${cl.key}". There is proof out there that touches it.`);
    } else {
      const unfound = st.contra.map((id) => clueOf(run, id)).find((c) => !run.found.includes(c.id));
      log(s, "them", `"Enough!"`);
      log(s, "sys", unfound ? `${sus.first} glances toward the ${run.def.rooms[unfound.room].name}. The proof is there.` : "You already hold the proof. Present it!");
    }
  } else {
    log(s, "them", `"I've told you the truth. Don't badger me."`);
    loseP(s, 1);
    hurtSanity(1.5, 0.1);
  }
  tutEvent("resolve");
  notify();
}

export function presentEvidence(s: number, p: Pillar, clueId: string) {
  const run = G.run;
  if (!run || run.patience[s] <= 0) return;
  const sus = run.def.suspects[s];
  const st = stmtOf(run, s, p);
  const k = skey(s, p);
  if (run.state[k] === "broken") return;
  const c = clueOf(run, clueId);
  log(s, "you", `Then explain this: ${c.text}`);
  if (st.isLie && st.contra.includes(clueId)) {
    run.state[k] = "broken";
    run.stats.lies++;
    const ded = run.def.deductions.find((d) => d.suspect === s && d.pillar === p)!;
    run.claims[k] = { value: ded.value, src: "exposed" };
    log(s, "them", `"...Fine! Alright. I lied."`);
    const partnerId = ded.a === clueId ? ded.b : ded.a;
    const partner = clueOf(run, partnerId);
    if (!run.found.includes(partnerId) && !(partner.sealed && !run.bossDown) && !run.def.clues.find((x) => x.id === partnerId)!.sealed) {
      addClue(partnerId);
      log(s, "sys", `LIE BROKEN! ${sus.first} lets slip a detail: "${partner.text}"`);
      toast(`Lie broken! New clue gained.`, "good");
    } else {
      run.focus = Math.min(run.maxFocus, run.focus + 12);
      run.sanity = Math.min(run.maxSanity, run.sanity + 6);
      log(s, "sys", "LIE BROKEN! The confession steadies your mind (+Focus, +Sanity).");
      toast("Lie broken!", "good");
    }
    audio.play("break");
    addShake(6);
  } else {
    const dbl = sus.trait === "arrogant" ? 2 : 1;
    run.stats.wrongEvid++;
    log(s, "them", st.isLie ? `"That proves nothing about what I said."` : `"Why show me that? I never denied it."`);
    log(s, "sys", `Wrong evidence. ${sus.first}'s patience drops${dbl > 1 ? " (Arrogant: double)" : ""}.`);
    audio.play("wrong");
    uiShake();
    hurtSanity(3, 0.15);
    loseP(s, dbl);
  }
  tutEvent("resolve");
  notify();
}

// ------------------------------------------------------------ accusation
export function accuse(s: number) {
  const run = G.run;
  if (!run || run.over) return;
  const sus = run.def.suspects[s];
  const ev = evidence(run, s);
  audio.play("accuse");
  addShake(8);
  if (s === run.def.culprit) {
    run.verdict = { correct: true, name: sus.name, evidence: ev };
    finish("solved");
    return;
  }
  run.wrongAccused.push(s);
  run.stats.wrongAcc++;
  run.verdict = { correct: false, name: sus.name, evidence: ev };
  if (run.mode === "career" && meta.career) {
    meta.career.cred = Math.max(0, meta.career.cred - 1);
    saveMeta();
    if (meta.career.cred <= 0) { finish("fired"); return; }
  }
  if (run.forced) { finish("dawn"); return; }
  audio.play("wrong");
  toast(`${sus.name} is innocent! Credibility lost.`, "bad");
  notify();
}

function finish(reason: CaseResult["reason"]) {
  const run = G.run;
  if (!run || run.over) return;
  const def = run.def;
  run.over = true;
  const p = P();
  const ev = evidence(run, def.culprit);
  const ruledOut = def.suspects.filter((s) => !s.isCulprit && PILLARS.some((pl) => proven(run, s.id, pl) === false)).length;
  const solved = reason === "solved";
  const st = run.stats;
  let score = 0, stars = 0, insight = 0;
  if (solved) {
    score = Math.round((500 + 300 * ev + 80 * ruledOut + 60 * st.lies + (run.mode === "tutorial" ? 0 : Math.max(0, run.dawn)) + run.sanity * 3 - 100 * st.wrongAcc) * p.scoreMul);
    score = Math.max(50, score);
    stars = 1 + (ev === 3 ? 1 : 0) + (ev === 3 && st.wrongAcc === 0 && run.sanity >= 35 ? 1 : 0);
    insight = run.mode === "tutorial" ? 20 : Math.round((15 + 10 * Math.min(def.idx, 7) + 12 * stars + st.lies * 3) * (run.mode === "replay" ? 0.5 : 1) * (1 + (p.scoreMul - DIFFS[meta.settings.difficulty].score)));
  }
  if (reason === "breakdown" && run.mode === "career" && meta.career) meta.career.cred = Math.max(0, meta.career.cred - 1);
  let next: CaseResult["next"] = solved ? "campaign" : "retry";
  const c = meta.career;
  if (run.mode === "career" && c) {
    if (solved) {
      c.idx = Math.max(c.idx, def.idx + 1);
      c.score += score;
      c.solved++;
      c.stars += stars;
      c.lies += st.lies;
      c.stars_by[def.idx] = Math.max(c.stars_by[def.idx] || 0, stars);
      const b = meta.best[def.idx];
      if (!b || score > b.score) meta.best[def.idx] = { stars: Math.max(stars, b ? b.stars : 0), score };
      if (def.idx >= CASE_COUNT - 1) { next = "victory"; meta.won = true; meta.stats.wins++; }
    }
    c.seconds += run.clock;
    if (c.cred <= 0) { next = "gameover"; meta.stats.deaths++; }
    G.lastCareer = { ...c };
    if (next === "gameover" || next === "victory") meta.career = null;
  }
  if (run.mode === "tutorial" && solved) meta.tutorialDone = true;
  if (run.mode === "cold" && solved) meta.cold++;
  if (solved && run.mode !== "tutorial") {
    meta.stats.solved++;
    meta.stats.lies += st.lies;
    meta.stats.bestScore = Math.max(meta.stats.bestScore, score);
    const bb = meta.best[`${def.idx}`];
    if (run.mode !== "career" && (!bb || score > bb.score)) meta.best[def.idx] = { stars: Math.max(stars, bb ? bb.stars : 0), score };
  }
  meta.insight += insight;
  saveMeta();
  const res: CaseResult = {
    solved, reason, title: def.title, culprit: def.suspects[def.culprit].name, score, stars, insight, evidence: ev, ruledOut,
    lies: st.lies, wrong: st.wrongAcc, seconds: run.clock, sanityLeft: Math.round(run.sanity), examined: st.examined, combos: st.combos,
    next, tutorial: run.mode === "tutorial", mode: run.mode,
  };
  run.result = res;
  G.lastResult = res;
  audio.play(solved ? "win" : "lose");
  notify();
}

// ------------------------------------------------------------ meta
export function upgradeCost(id: string) {
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = meta.up[id] || 0;
  return u.base * (lvl + 1);
}
export function buyUpgrade(id: string) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return false;
  const lvl = meta.up[id] || 0;
  const cost = upgradeCost(id);
  if (lvl >= u.max || meta.insight < cost) { audio.play("wrong"); return false; }
  meta.insight -= cost;
  meta.up[id] = lvl + 1;
  saveMeta();
  audio.play("deduce");
  notify();
  return true;
}
