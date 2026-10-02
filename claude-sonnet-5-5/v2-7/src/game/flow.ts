// Game flow: run setup, sittings, actions, AI, votes, scandals, elections, endings.
import { audio } from "./audio";
import { fx } from "./fx";
import { BASE_MODS, BOONS, BOSSES, CRISES, DIFFS, EVENTS, FACTION_ORDER, FACTIONS, ISSUES, ISSUE_META, LEADERS, META_UPGRADES, TEMPLATES, TUTORIAL } from "./data";
import type { DiffId, FId, Issue } from "./data";
import {
  SAVE, addHeat, addRenown, addStat, addTrust, allocate, ambition, apMaxOf, billName, bribeCost, charterOk, clamp, commit, forecast, getG, logL, mandateBonus,
  modsFromSave, mutateSave, newSeat, pick, riderCostOf, riderSlots, riderTotal, rnd, rollTempers, satisfaction, setG, shuffle, syncSeats, RIVALS, TOTAL_SEATS,
} from "./core";
import type { FState, Game, Kind, Lobby, ResultInfo, Sitting } from "./core";

const SCHEDULE: Kind[][] = [
  ["draft", "rival", "draft", "budget"],
  ["draft", "crisis", "rival", "confidence"],
  ["rival", "draft", "crisis", "confidence"],
  ["draft", "rival", "crisis", "boss"],
];
export const ROMAN = ["", "I", "II", "III", "IV"];
export const KIND_LABEL: Record<Kind, string> = { draft: "Open Session — draft your bill", rival: "Rival Motion — whip your caucus", crisis: "Emergency Sitting — a crisis demands action", budget: "The Budget — it must pass", confidence: "Confidence Vote — survive the motion", boss: "The Great Charter" };
const SIT_MODS = [
  { id: "filibuster", name: "Filibuster", emoji: "🗣️", desc: "" }, { id: "rain", name: "Rainy Day", emoji: "🌧️", desc: "About 12% of seats are absent." },
  { id: "fog", name: "Restless House", emoji: "🌫️", desc: "Seats waver 30% more — less predictable." }, { id: "bonanza", name: "Shiny Bonanza", emoji: "✨", desc: "+15 shinies fall into your lap." },
  { id: "spotlight", name: "Press Spotlight", emoji: "📸", desc: "Heat gains ×1.5 this sitting." }, { id: "recess", name: "Long Recess", emoji: "☕", desc: "+1 Action Point this sitting." },
];
const ATTACK_FOR: Record<string, string> = { bribe: "expose", speech: "gag", pledge: "poach", snoop: "bidding", blackmail: "filibuster" };
const usedEvents = new Set<string>();

const ID = (sel: string) => sel;
const deny = (msg: string) => { audio.error(); fx.text(window.innerWidth / 2, window.innerHeight * 0.42, msg, "#fb7185", 18); };
const posNeg = (n: number) => (n > 0 ? "+" : "") + Math.round(n);
const blankLobby = (g: Game): Record<FId, Lobby> => {
  const out = {} as Record<FId, Lobby>;
  for (const f of FACTION_ORDER) out[f] = { bribe: 0, speech: 0, pledge: 0, blackmail: 0, mod: 0, bribed: 0, spoke: 0, tags: [], hidden: f === "crows" ? 0 : (Math.random() + Math.random() - 1) * 9 * DIFFS[g.diff].hidden };
  return out;
};
const blankSitting = (g: Game, kind: Kind): Sitting => ({
  kind, ap: 0, apMax: 0, bill: { stance: { wealth: 0, order: 0, welfare: 0, nature: 0 }, riders: [] }, dir: 1, whip: null, lobby: blankLobby(g), modifier: null,
  reading: 1, won: 0, lost: 0, noPersuade: false, owlCounter: null, thr: 0.5, fog: 1, heatMult: 1, title: KIND_LABEL[kind],
});
export function updateTension(g: Game) {
  const k = g.sitting.kind;
  audio.setTension(clamp(g.heat / 130 + (k === "boss" ? 0.5 : k === "confidence" ? 0.3 : 0) + (g.phase === "voting" ? 0.2 : 0) + g.term * 0.04, 0, 1));
  audio.setMode(k === "boss" ? "boss" : "game");
}

// ───────── tutorial ─────────
export function tutEvent(g: Game, ev: string) {
  if (!g.tut.on) return;
  const st = TUTORIAL[g.tut.step];
  if (st && st.wait === ev) { g.tut.step++; audio.click(); if (g.tut.step >= TUTORIAL.length) { g.tut.on = false; mutateSave(s => { s.seenTutorial = true; }); } }
}
export function tutNext() { const g = getG(); if (g) { tutEvent(g, "next"); commit(); } }
export function tutSkip() { const g = getG(); if (g) { g.tut.on = false; mutateSave(s => { s.seenTutorial = true; }); commit(); } }

// ───────── run creation ─────────
export function newRun(o: { leader: string; diff: DiffId; mandates: string[]; tutorial: boolean }) {
  audio.resume(); fx.clear(); usedEvents.clear();
  const d = DIFFS[o.diff]; const leader = LEADERS.find(l => l.id === o.leader) || LEADERS[0];
  let mods = BASE_MODS();
  for (const [k, v] of Object.entries(leader.mods)) (mods as any)[k] += v as number;
  mods = modsFromSave(SAVE, leader.id, mods);
  if (o.mandates.includes("short")) mods.ap -= 1;
  const crowsSeats = d.crows + mods.startSeats;
  const ironbeak = o.mandates.includes("ironbeak");
  const alloc = allocate(RIVALS.map(f => FACTIONS[f].baseSeats + (f === "owls" && ironbeak ? 10 : 0)), TOTAL_SEATS - crowsSeats, 4);
  const factions = {} as Record<FId, FState>;
  for (const f of FACTION_ORDER) {
    const def = FACTIONS[f];
    factions[f] = { id: f, seats: f === "crows" ? crowsSeats : alloc[RIVALS.indexOf(f)], trust: def.baseTrust, dirt: 0, pledges: 0, bribesTerm: 0, bribesTotal: 0, betrayals: 0, coalition: 0, grudge: 0, prefs: { ...(f === "crows" ? leader.prefs : def.prefs) } };
  }
  for (const f of RIVALS) factions[f].dirt = mods.startDirtAll;
  if (mods.startDirt) factions[pick(RIVALS)].dirt += mods.startDirt;
  const g = {
    phase: "sitting", diff: o.diff, mandates: o.mandates, leader: leader.id, mods, term: 1, idx: 0, factions, seats: [], shinies: d.shinies + mods.startShinies,
    heat: 5, renown: clamp(40 + mods.startRenown, 5, 100), stats: { wealth: 55, order: 55, welfare: 55, nature: 55 }, sitting: null as any, vote: null, reveal: 0,
    result: null, event: null, election: null, boons: null, owned: [], selected: "magpies", log: [], style: { bribe: 0, speech: 0, pledge: 0, snoop: 0, blackmail: 0 },
    run: { passed: 0, failed: 0, bribes: 0, speeches: 0, scandals: 0, peakSeats: crowsSeats, peakHeat: 5, termsDone: 0, shiniesSpent: 0, betrayals: 0, blackmails: 0, defections: 0, sittings: 0 },
    tut: { on: o.tutorial, step: 0 }, banner: null, over: null, pendingScandal: false, focusIssue: 0,
  } as Game;
  syncSeats(g);
  g.sitting = blankSitting(g, "draft");
  setG(g);
  logL(g, `${leader.title} ${leader.name} takes the Speaker's perch. Term I begins.`, "good");
  startSitting(g, true);
}
export function quitRun() { setG(null); fx.clear(); audio.setTension(0); audio.setMode("menu"); commit(); }
export function changeDifficulty(d: DiffId) { const g = getG(); if (g) { g.diff = d; logL(g, `Difficulty changed to ${DIFFS[d].name}.`, "warn"); commit(); } }

// ───────── sitting setup ─────────
export function startSitting(g: Game, first = false) {
  const kind = SCHEDULE[g.term - 1][g.idx]; const d = DIFFS[g.diff];
  g.run.sittings++;
  if (!first) {
    const inc = Math.round((6 + g.stats.wealth / 8 + g.mods.income) * d.income * (g.mandates.includes("austerity") ? 0.7 : 1));
    g.shinies += inc;
    for (const k of ISSUES) addStat(g, k, -(1 + (Math.random() < 0.4 ? 1 : 0)));
    addHeat(g, -(5 + g.mods.heatDecay), true); addRenown(g, g.mods.renownPerSitting);
    logL(g, `Treasury dividend: +${inc} ✦. The nation's mood sags a little.`, "info");
    if (ISSUES.some(k => g.stats[k] <= 0)) { endGame(g, false, "collapse"); return; }
  }
  const s = blankSitting(g, kind); g.sitting = s; g.vote = null; g.result = null; g.reveal = 0;
  for (const seat of g.seats) seat.absent = false;
  rollTempers(g);
  const quiet = first && g.tut.on;
  if (!quiet && (kind === "draft" || kind === "rival" || kind === "crisis" || kind === "budget") && Math.random() < 0.28 + g.term * 0.06 * d.aggro) applyModifier(g);
  s.apMax = apMaxOf(g); s.ap = s.apMax;
  if (kind === "draft") { s.bill.stance = { ...pick(TEMPLATES).stance }; }
  else if (kind === "rival") {
    const holders = RIVALS.filter(f => g.factions[f].pledges > 0).sort((a, b) => g.factions[b].pledges - g.factions[a].pledges);
    const sp = holders[0] || pick(RIVALS); s.sponsor = sp;
    const pr = g.factions[sp].prefs; const st = { wealth: 0, order: 0, welfare: 0, nature: 0 } as Record<Issue, number>;
    for (const k of ISSUES) st[k] = clamp(pr[k] + pick([-1, 0, 0, 1]), -2, 2);
    if (ambition(st) < 3) st[ISSUES.reduce((a, k) => (Math.abs(pr[k]) > Math.abs(pr[a]) ? k : a), "wealth" as Issue)] = pr.wealth >= 0 ? 2 : -2;
    s.bill.stance = st; s.title = `${billName(st)} — tabled by the ${FACTIONS[sp].name}`; s.dir = 1;
  } else if (kind === "crisis") {
    const pool = CRISES.filter(c => c.id !== g.lastCrisis); const c = pick(pool); s.crisis = c; g.lastCrisis = c.id;
    s.bill.stance[c.issue] = 1; s.title = `Emergency: ${c.name}`;
  } else if (kind === "budget") { s.title = "The Budget Bill"; }
  else if (kind === "confidence") {
    const boss = g.term === 2 ? "judge" : "queen"; s.boss = boss; const B = BOSSES[boss]; s.title = B.title;
    s.lobby[B.faction].mod -= 28; if (boss === "queen") { s.lobby.owls.mod -= 12; s.thr = 0.52; }
    logL(g, `${B.emoji} ${B.name}: "${B.text}"`, "bad"); audio.boss(); fx.shake(10);
  } else if (kind === "boss") {
    s.boss = "strix"; s.title = "The Great Charter"; s.bill.stance = { wealth: 1, order: 1, welfare: 1, nature: 1 };
    logL(g, `🦉 ${BOSSES.strix.name}: "${BOSSES.strix.text}"`, "bad"); audio.boss(); fx.shake(14);
    setupReading(g, true);
  }
  if (!quiet && kind !== "boss") aiTurn(g);
  g.banner = { key: Date.now() + Math.random(), text: kind === "boss" ? "Reading 1 of 3" : `Term ${ROMAN[g.term]} · Sitting ${g.idx + 1}`, sub: KIND_LABEL[kind] };
  g.phase = "sitting"; updateTension(g);
  if (!quiet) maybeEvent(g, kind !== "boss" && kind !== "confidence");
  commit();
}
function applyModifier(g: Game) {
  const s = g.sitting; const m = pick(SIT_MODS); s.modifier = { ...m };
  if (m.id === "filibuster") { const f = pick(RIVALS); s.lobby[f].mod -= 28; s.modifier.name = `Filibuster: ${FACTIONS[f].name}`; s.modifier.desc = `The ${FACTIONS[f].name} talk the bill to death (−28 lean).`; }
  if (m.id === "rain") for (const seat of g.seats) if (Math.random() < 0.12) seat.absent = true;
  if (m.id === "fog") s.fog = 1.3;
  if (m.id === "bonanza") g.shinies += 15;
  if (m.id === "spotlight") s.heatMult = 1.5;
  logL(g, `${s.modifier.emoji} ${s.modifier.name}: ${s.modifier.desc}`, "warn");
}
function setupReading(g: Game, firstReading = false) {
  const s = g.sitting;
  if (!firstReading) { s.lobby = blankLobby(g); rollTempers(g); s.noPersuade = false; s.owlCounter = null; s.fog = 1; }
  s.lobby.owls.mod -= 25; s.apMax = apMaxOf(g);
  const order = Object.entries(g.style).filter(([k]) => k in ATTACK_FOR).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const style = order[(s.reading - 1) % order.length];
  const atk = ATTACK_FOR[style];
  const B = BOSSES.strix;
  if (atk === "expose") { addHeat(g, 15); g.pendingScandal = true; s.attack = { id: atk, name: "Exposé", text: "Strix leaks your ledgers to the Daily Caw! (+Heat, scandal hearing)" }; }
  else if (atk === "gag") { s.noPersuade = true; s.attack = { id: atk, name: "Gag Rule", text: "Strix invokes the Gag Rule: your speeches are ignored this reading." }; }
  else if (atk === "poach") { const f = RIVALS.filter(x => x !== "owls").sort((a, b) => g.factions[b].trust - g.factions[a].trust)[0]; s.lobby[f].mod -= 28; s.attack = { id: atk, name: "Poach", text: `Strix poaches your closest ally — the ${FACTIONS[f].name} (−28 lean).` }; }
  else if (atk === "bidding") { const top = RIVALS.filter(x => x !== "owls").sort((a, b) => FACTIONS[b].greed - FACTIONS[a].greed).slice(0, 3); top.forEach(f => { s.lobby[f].mod -= 12; }); s.attack = { id: atk, name: "Bidding War", text: `The Owls outbid you for the ${top.map(f => FACTIONS[f].name).join(", ")} (−12 each).` }; }
  else { s.apMax = Math.max(1, s.apMax - 1); s.attack = { id: atk, name: "Filibuster", text: "Strix filibusters — you lose 1 Action Point this reading." }; }
  s.ap = s.apMax;
  logL(g, `${B.emoji} Strix has studied your ${style}. ${s.attack.text}`, "bad"); fx.shake(8); audio.caw(0.55, 0.2);
}

// ───────── AI ─────────
function aiTurn(g: Game) {
  const s = g.sitting; const ag = DIFFS[g.diff].aggro; const ironbeak = g.mandates.includes("ironbeak");
  for (const f of RIVALS) {
    const F = g.factions[f];
    if (F.grudge >= 2) { const m = Math.min(18, F.grudge * 3); s.lobby[f].mod -= m; logL(g, `${FACTIONS[f].emoji} The ${FACTIONS[f].name} nurse a grudge (−${m} lean).`, "ai"); }
    if (F.coalition >= 3 && F.trust > 20) { s.lobby[f].mod += 4; }
  }
  if (g.heat > 40 && Math.random() < 0.6 * ag) { addHeat(g, Math.round(3 * ag), true); logL(g, "⚖️ The Ravens open an inquiry into your finances. Heat rises.", "ai"); }
  if (Math.random() < 0.4 * ag) { s.lobby.magpies.hidden -= 12 * ag; logL(g, "💎 Whispers of rival gold flowing through the Magpie guild…", "ai"); }
  const jd = clamp((g.renown - 50) / 25, -2, 2); g.factions.jackdaws.trust = clamp(g.factions.jackdaws.trust + jd - (g.heat > 50 ? 3 : 0), -100, 100);
  g.factions.rooks.trust *= 0.95;
  const entries = Object.entries(g.style).sort((a, b) => b[1] - a[1]); const [dom, cnt] = entries[0];
  if (cnt >= 2 && (ironbeak || Math.random() < 0.55 * ag)) {
    if (dom === "bribe") { addHeat(g, Math.round(6 * ag), true); logL(g, "🦉 The Owls plant informants in your bribery network (+Heat).", "ai"); }
    else if (dom === "speech") { s.owlCounter = "speech"; logL(g, "🦉 The Owls publish rebuttals — your speeches are half as persuasive this sitting.", "ai"); }
    else if (dom === "pledge") { const f = RIVALS.filter(x => g.factions[x].pledges > 0 && x !== "owls")[0] || pick(RIVALS.filter(x => x !== "owls")); s.lobby[f].mod -= 10; logL(g, `🦉 The Owls remind the ${FACTIONS[f].name} of your broken-promise history (−10).`, "ai"); }
    else { const f = RIVALS.find(x => g.factions[x].dirt > 0); if (f) { g.factions[f].dirt--; logL(g, `🦉 The Owls burn your file on the ${FACTIONS[f].name}.`, "ai"); } }
  }
}

// ───────── events & scandals ─────────
function maybeEvent(g: Game, allowRandom: boolean) {
  const p = g.heat >= 25 ? clamp((g.heat - 15) / 110, 0, 0.85) * (1 - clamp(g.mods.scandalChance, -0.6, 0.8)) : 0;
  if (g.pendingScandal || Math.random() < p) startScandal(g);
  else if (allowRandom && Math.random() < 0.32) startRandomEvent(g);
}
const HEADLINES = ["“SHINIES FLOW LIKE RAIN THROUGH THE MURDER’S NEST”", "“LEADER SEEN AT MIDNIGHT WITH A MAGPIE FENCE”", "“LEDGERS DON’T ADD UP, SAYS THIN-BEAKED CLERK”", "“CROW ON THE TAKE? THE DAILY CAW INVESTIGATES”"];
function startScandal(g: Game) {
  g.pendingScandal = false; g.run.scandals++;
  addTrust(g, "ravens", -6); addTrust(g, "jackdaws", -6);
  audio.scandal(); fx.shake(10);
  g.event = { kind: "scandal", id: "scandal", title: "Scandal Hearing", emoji: "📰", text: `${pick(HEADLINES)} The House demands an explanation.`, outcome: null, options: [
    { label: "Deny", desc: `~${Math.round((0.35 + g.renown / 250) * 100)}% to hold. Fail: +20 Heat, −10 Renown. Success: −10 Heat.` },
    { label: "Spin (15 ✦)", desc: "~75% to work: −25 Heat. Fail: +10 Heat, −6 Renown.", disabled: g.shinies < 15 },
    { label: "Scapegoat", desc: "Sacrifice 3 of your seats: −40 Heat, Jackdaws −8 trust.", disabled: g.factions.crows.seats <= 8 },
    { label: "Confess", desc: "Heat falls to 30%, −12 Renown, Ravens +10 trust." },
  ] };
  g.phase = "event"; logL(g, "📰 A scandal breaks!", "bad");
}
function startRandomEvent(g: Game) {
  const pool = EVENTS.filter(e => !usedEvents.has(e.id)); const e = pick(pool.length ? pool : EVENTS); usedEvents.add(e.id);
  g.event = { kind: "random", id: e.id, title: e.title, emoji: e.emoji, text: e.text, outcome: null, options: e.options.map(o => ({ label: o.label, desc: o.desc })) };
  g.phase = "event"; audio.whoosh();
}
function defectSeats(g: Game, n: number, from?: FId): string {
  const src = from || RIVALS.slice().sort((a, b) => g.factions[b].seats - g.factions[a].seats)[0];
  const m = Math.max(0, Math.min(n, g.factions[src].seats - 4));
  if (!m) return "No one is willing to cross the floor.";
  g.factions[src].seats -= m; g.factions.crows.seats += m; g.run.defections += m; g.run.peakSeats = Math.max(g.run.peakSeats, g.factions.crows.seats);
  syncSeats(g); fx.textAt("#fac-crows", `+${m} seats`, "#a78bfa", 22); audio.unlock();
  return `${m} seat${m > 1 ? "s" : ""} defect from the ${FACTIONS[src].name} to The Murder!`;
}
function eventApi(g: Game) {
  const fl = (sel: string, t: string, c: string) => fx.textAt(sel, t, c, 20);
  return {
    shinies: (n: number) => { if (n < 0 && g.shinies < -n) return false; g.shinies += n; if (n < 0) g.run.shiniesSpent -= n; fl("#hud-shinies", `${posNeg(n)} ✦`, n > 0 ? "#f2c14e" : "#fca5a5"); if (n > 0) audio.coin(); return true; },
    heat: (n: number) => { const v = addHeat(g, n); fl("#hud-heat", `${posNeg(v)} Heat`, v > 0 ? "#fb7185" : "#86efac"); },
    renown: (n: number) => { addRenown(g, n); fl("#hud-renown", `${posNeg(n)} Renown`, n > 0 ? "#86efac" : "#fca5a5"); },
    trust: (f: FId, n: number) => addTrust(g, f, n), trustAll: (n: number) => RIVALS.forEach(f => addTrust(g, f, n)),
    stat: (k: Issue, n: number) => { addStat(g, k, n); fl(`#stat-${k}`, `${posNeg(n)}`, n > 0 ? "#86efac" : "#fca5a5"); },
    dirt: (f: FId, n: number) => { g.factions[f].dirt = clamp(g.factions[f].dirt + n, 0, 3); },
    rival: () => pick(RIVALS), defect: (n: number) => defectSeats(g, n),
  };
}
export function resolveEvent(i: number) {
  const g = getG(); if (!g || !g.event || g.event.outcome !== null || g.phase !== "event") return;
  const e = g.event; let msg = "";
  if (e.kind === "random") { msg = EVENTS.find(x => x.id === e.id)!.options[i].fn(eventApi(g)); audio.click(); }
  else if (i === 0) {
    if (Math.random() < 0.35 + g.renown / 250) { addHeat(g, -10, true); msg = "Your denial holds. For now. (−10 Heat)"; audio.click(); }
    else { addHeat(g, 20, true); addRenown(g, -10); msg = "The denial collapses spectacularly! (+20 Heat, −10 Renown)"; audio.scandal(); fx.shake(9); }
  } else if (i === 1) {
    if (g.shinies < 15) { deny("Need 15 ✦"); return; }
    g.shinies -= 15; g.run.shiniesSpent += 15;
    if (Math.random() < 0.75) { addHeat(g, -25, true); addRenown(g, -3); msg = "The spin doctors earn their shinies. (−25 Heat)"; audio.coin(); }
    else { addHeat(g, 10, true); addRenown(g, -6); msg = "The spin unravels in public. (+10 Heat, −6 Renown)"; audio.scandal(); }
  } else if (i === 2) {
    if (g.factions.crows.seats <= 8) { deny("Too few seats to sacrifice"); return; }
    g.factions.crows.seats -= 3; g.factions.rooks.seats += 1; g.factions.jackdaws.seats += 1; g.factions.owls.seats += 1; syncSeats(g);
    addHeat(g, -40, true); addTrust(g, "jackdaws", -8); msg = "Three backbenchers are thrown to the wolves. (−40 Heat, −3 seats)"; audio.caw(0.8, 0.18);
  } else { g.heat = Math.max(0, Math.round(g.heat * 0.3)); addRenown(g, -12); addTrust(g, "ravens", 10); msg = "You confess with trembling beak. The Ravens nod. (Heat ×0.3, −12 Renown)"; audio.click(); }
  e.outcome = msg; logL(g, msg, "warn");
  if (g.event && checkHeat(g)) return;
  commit();
}
export function closeEvent() {
  const g = getG(); if (!g || !g.event || g.event.outcome === null || g.phase === "over") return;
  g.event = null; g.phase = "sitting"; updateTension(g); audio.click(); commit();
}
function checkHeat(g: Game): boolean {
  if (g.phase === "over") return true;
  if (g.heat >= 100) {
    if (g.mods.pardon > 0) { g.mods.pardon--; g.heat = 50; logL(g, "🪶 A Pardon Feather saves you from impeachment! Heat reset to 50.", "good"); fx.text(window.innerWidth / 2, window.innerHeight / 3, "PARDONED!", "#f2c14e", 36); audio.unlock(); return false; }
    endGame(g, false, "impeached"); return true;
  }
  return false;
}

// ───────── drafting & lobbying ─────────
export function selectFaction(f: FId) { const g = getG(); if (g) { g.selected = f; commit(); } }
export function setStance(k: Issue, v: number) {
  const g = getG(); if (!g || g.phase !== "sitting" || g.sitting.kind === "rival" || g.sitting.kind === "confidence") return;
  const nv = clamp(Math.round(v), -2, 2); if (g.sitting.bill.stance[k] === nv) return;
  g.sitting.bill.stance[k] = nv; audio.tick(nv >= 0, nv + 3); tutEvent(g, "stance"); commit();
}
export function applyTemplate(id: string) {
  const g = getG(); if (!g || g.phase !== "sitting" || g.sitting.kind === "rival" || g.sitting.kind === "confidence") return;
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  g.sitting.bill.stance = { ...t.stance }; if (g.sitting.crisis && g.sitting.bill.stance[g.sitting.crisis.issue] < 1) { /* player may choose to ignore the crisis */ }
  audio.click(); tutEvent(g, "stance"); commit();
}
export function toggleRider(id: string) {
  const g = getG(); if (!g || g.phase !== "sitting" || g.sitting.kind === "rival" || g.sitting.kind === "confidence") return;
  const b = g.sitting.bill; const i = b.riders.findIndex(r => r.id === id);
  if (i >= 0) b.riders.splice(i, 1);
  else {
    if (b.riders.length >= riderSlots(g)) return deny(`Only ${riderSlots(g)} riders allowed`);
    if (id === "pork" && g.selected === "crows") return deny("Select a rival faction first");
    b.riders.push({ id, target: id === "pork" ? g.selected : undefined });
  }
  audio.click(); commit();
}
export function setWhip(w: "aye" | "nay") { const g = getG(); if (!g || g.phase !== "sitting" || g.sitting.kind !== "rival") return; g.sitting.whip = w; g.sitting.dir = w === "aye" ? 1 : -1; audio.click(); commit(); }
function canAct(g: Game): boolean {
  if (g.phase !== "sitting") return false;
  if (g.sitting.kind === "rival" && !g.sitting.whip) { deny("Whip your caucus Aye or Nay first"); return false; }
  if (g.sitting.ap < 1) { deny("No Action Points left"); return false; }
  return true;
}
function afterAct(g: Game) { updateTension(g); if (!checkHeat(g)) commit(); else commit(); }
const sel = (f: FId) => `#fac-${f}`;
export function doBribe(f: FId) {
  const g = getG(); if (!g) return; if (f === "crows") return deny("You cannot bribe your own party"); if (!canAct(g)) return;
  const cost = bribeCost(g, f); if (g.shinies < cost) return deny(`Need ${cost} ✦`);
  const s = g.sitting, F = g.factions[f], L = s.lobby[f]; s.ap--; g.style.bribe++; tutEvent(g, "bribe");
  if (f === "ravens" && Math.random() < clamp(0.3 + g.heat / 200 + (F.trust < 0 ? 0.15 : -0.1), 0.1, 0.85)) {
    addHeat(g, 12); addTrust(g, f, -12); L.mod -= 8; audio.error(); fx.shake(6);
    fx.textAt(sel(f), "REFUSED & REPORTED!", "#fb7185", 20); logL(g, "⚖️ The Ravens refuse your bribe and report it to the press! (+Heat, −trust)", "bad"); afterAct(g); return;
  }
  g.shinies -= cost; g.run.shiniesSpent += cost; g.run.bribes++;
  const eff = (24 / (1 + L.bribed)) * (f === "owls" ? 0.5 : 1); L.bribe += eff; L.bribed++; F.bribesTerm++; F.bribesTotal++;
  if (f === "magpies" && Math.random() < 0.22) { L.hidden -= eff + 10; L.tags.push("risk"); }
  addHeat(g, (3 + 5 * FACTIONS[f].snitch) * (1 - clamp(g.mods.bribeHeat, -0.5, 0.8)));
  audio.coin(); fx.coinsAt(sel(f), 14); fx.textAt(sel(f), `+${Math.round(eff)} lean`, "#f2c14e"); fx.textAt("#hud-shinies", `−${cost} ✦`, "#fca5a5", 18);
  logL(g, `💰 You slip ${cost} ✦ to the ${FACTIONS[f].name}.`, "info"); afterAct(g);
}
export function doSpeech(f: FId) {
  const g = getG(); if (!g || !canAct(g)) return;
  const s = g.sitting, L = s.lobby[f];
  if (s.noPersuade) return deny("Gag Rule: speeches are ignored");
  let p = (9 + g.renown / 12 + g.mods.persuade) * FACTIONS[f].persuade * Math.pow(0.65, L.spoke);
  if (f === "crows") p *= 0.6; if (s.owlCounter === "speech") p *= 0.5;
  s.ap--; L.speech += p; L.spoke++; addTrust(g, f, 3); g.style.speech++; g.run.speeches++; tutEvent(g, "speech");
  audio.speech(); fx.burstAt(sel(f), FACTIONS[f].color, 12, "star"); fx.textAt(sel(f), `+${Math.round(p)} lean`, "#c4b5fd");
  logL(g, `🗣️ Your speech stirs the ${FACTIONS[f].name} (+${Math.round(p)}).`, "info"); afterAct(g);
}
export function doPledge(f: FId) {
  const g = getG(); if (!g || f === "crows") return; if (!canAct(g)) return;
  const F = g.factions[f]; if (F.pledges >= 2) return deny("They already hold two of your promises");
  const s = g.sitting, L = s.lobby[f]; s.ap--; const e = 20 * (1 + g.mods.pledgePower); L.pledge += e; F.pledges++; addTrust(g, f, 2); g.style.pledge++;
  audio.speech(); fx.burstAt(sel(f), "#86efac", 10, "star"); fx.textAt(sel(f), `PLEDGE +${Math.round(e)}`, "#86efac");
  logL(g, `🤝 You promise the ${FACTIONS[f].name} your vote on their next motion.`, "warn"); afterAct(g);
}
export function doSnoop(f: FId) {
  const g = getG(); if (!g || f === "crows") return; if (!canAct(g)) return;
  const F = g.factions[f]; if (F.dirt >= 3) return deny("Dirt file is full (3)");
  g.sitting.ap--; const n = Math.min(3 - F.dirt, 1 + g.mods.snoopBonus); F.dirt += n; g.style.snoop++; addHeat(g, f === "owls" ? 6 : 2);
  audio.snoop(); fx.burstAt(sel(f), "#94a3b8", 10); fx.textAt(sel(f), `+${n} Dirt`, "#cbd5e1");
  logL(g, `🔍 Your spies dig up dirt on the ${FACTIONS[f].name}.`, "info"); afterAct(g);
}
export function doBlackmail(f: FId) {
  const g = getG(); if (!g || f === "crows") return; if (!canAct(g)) return;
  const F = g.factions[f]; if (F.dirt < 1) return deny("You have no Dirt on them");
  const s = g.sitting, L = s.lobby[f]; s.ap--; F.dirt--; const e = 30 * (1 + g.mods.blackmailPower) * (f === "ravens" ? 0.7 : 1);
  L.blackmail += e; addTrust(g, f, -16); F.grudge++; addHeat(g, 3); g.style.blackmail++; g.run.blackmails++;
  audio.blackmail(); fx.shake(4); fx.burstAt(sel(f), "#7f1d1d", 14); fx.textAt(sel(f), `BLACKMAIL +${Math.round(e)}`, "#fca5a5");
  logL(g, `🗡️ The ${FACTIONS[f].name} receive an unsigned letter and reconsider.`, "warn"); afterAct(g);
}
export function doScandalize(f: FId) {
  const g = getG(); if (!g || f === "crows") return; if (!canAct(g)) return;
  const F = g.factions[f]; if (F.dirt < 1) return deny("You have no Dirt on them"); if (F.seats <= 5) return deny("They have too few seats to defect");
  g.sitting.ap--; F.dirt--; addTrust(g, f, -14); F.grudge++; addRenown(g, -2); addHeat(g, 4); g.style.blackmail++;
  const msg = defectSeats(g, 2, f); fx.shake(5); logL(g, `📣 You leak the ${FACTIONS[f].name} scandal. ${msg}`, "good"); afterAct(g);
}
export function doCover() {
  const g = getG(); if (!g || !canAct(g)) return; if (g.shinies < 12) return deny("Need 12 ✦");
  g.sitting.ap--; g.shinies -= 12; g.run.shiniesSpent += 12; addHeat(g, -18, true);
  audio.coin(); fx.textAt("#hud-heat", "−18 Heat", "#86efac", 22); fx.burstAt("#hud-heat", "#86efac", 12, "star");
  logL(g, "🧹 Evidence is quietly buried. (−18 Heat)", "good"); afterAct(g);
}

// ───────── voting ─────────
export function callVote() {
  const g = getG(); if (!g || g.phase !== "sitting") return; const s = g.sitting;
  if (s.kind === "rival" && !s.whip) return deny("Whip your caucus Aye or Nay first");
  if (s.kind === "boss" && !charterOk(g)) return deny("Charter: no negative stances and ambition ≥ 4");
  const rc = riderTotal(g); if (g.shinies < rc) return deny(`Riders cost ${rc} ✦`);
  g.shinies -= rc; g.run.shiniesSpent += rc; tutEvent(g, "vote");
  const f = forecast(g, true);
  const per = {} as any; for (const id of FACTION_ORDER) per[id] = { yes: f.per[id].yes, no: f.per[id].no, absent: f.per[id].absent };
  g.vote = { votes: f.states, yes: f.yes, no: f.no, absent: f.absent, needed: f.needed, passed: f.yes >= f.needed, per };
  g.reveal = 0; g.phase = "voting"; audio.gavel(); fx.shake(5); updateTension(g); commit();
}
export function stepReveal(n = 3) {
  const g = getG(); if (!g || g.phase !== "voting" || !g.vote) return;
  const v = g.vote; const first = v.votes[g.reveal];
  if (first && first !== "a") audio.tick(first === "y", g.reveal);
  g.reveal = Math.min(v.votes.length, g.reveal + n);
  if (g.reveal >= v.votes.length) finishVote(g);
  commit();
}
export function skipReveal() { const g = getG(); if (!g || g.phase !== "voting" || !g.vote) return; g.reveal = g.vote.votes.length; finishVote(g); commit(); }

function finishVote(g: Game) {
  const v = g.vote!; const s = g.sitting; const lines: ResultInfo["lines"] = []; const add = (text: string, tone = "info") => lines.push({ text, tone });
  const passed = v.passed; let overInfo: { win: boolean; cause: string } | null = null;
  add(`${v.yes} Aye · ${v.no} Nay${v.absent ? ` · ${v.absent} absent` : ""}  (${v.needed} needed)`, passed ? "good" : "bad");
  for (const f of RIVALS) {
    const F = g.factions[f]; const pf = v.per[f]; const pres = pf.yes + pf.no; if (!pres) continue; const yf = pf.yes / pres; const L = s.lobby[f];
    if (s.kind !== "confidence" && s.kind !== "rival") {
      if (passed && yf > 0.6) { addTrust(g, f, 4); F.coalition++; }
      else if (passed && yf < 0.3) { addTrust(g, f, -4); F.grudge++; }
      else if (!passed && yf > 0.6) addTrust(g, f, 2);
    }
    if (f === "magpies" && L.bribed > 0 && yf < 0.4 && s.dir === 1 && s.kind !== "rival") { addTrust(g, f, -10); F.grudge++; add("💎 The Magpies pocketed your coin and voted Nay — a double-cross!", "bad"); }
  }
  const applyBill = () => {
    const half = s.bill.riders.some(r => r.id === "sunset") ? 0.5 : 1; const parts: string[] = [];
    for (const k of ISSUES) {
      let dlt = Math.round(s.bill.stance[k] * 3 * half); if (s.bill.riders.some(r => r.id === "emergency") && k === "order") dlt += 4;
      if (dlt) { addStat(g, k, dlt); parts.push(`${ISSUE_META[k].emoji} ${posNeg(dlt)}`); fx.textAt(`#stat-${k}`, posNeg(dlt), dlt > 0 ? "#86efac" : "#fca5a5", 22); }
    }
    if (parts.length) add(`Nation: ${parts.join("   ")}`);
  };
  const close = Math.abs(v.yes - v.needed) <= 3;
  if (s.kind === "confidence") {
    if (passed) { addRenown(g, 6); add(`You survive ${BOSSES[s.boss!].name}'s motion. (+6 Renown)`, "good"); } else { add("You have lost the confidence of the House.", "bad"); overInfo = { win: false, cause: "noconfidence" }; }
  } else if (s.kind === "boss") {
    if (passed) s.won++; else s.lost++;
    add(`Reading ${s.reading} ${passed ? "carried" : "defeated"}. Charter tally: ${s.won} – ${s.lost}.`, passed ? "good" : "bad");
    if (s.won >= 2) overInfo = { win: true, cause: "charter" }; else if (s.lost >= 2) overInfo = { win: false, cause: "charter" };
    else add(`Strix will return for Reading ${s.reading + 1}…`, "warn");
  } else if (s.kind === "rival") {
    const sp = g.factions[s.sponsor!]; const sn = FACTIONS[s.sponsor!].name;
    if (s.dir === -1 && sp.pledges > 0) { const t = 25 * (s.sponsor === "rooks" ? 1.6 : 1); addTrust(g, s.sponsor!, -t); addRenown(g, -4); sp.betrayals++; g.run.betrayals++; add(`You broke your pledge to the ${sn}! (−${Math.round(t)} trust, −4 Renown)`, "bad"); }
    else if (s.dir === 1 && sp.pledges > 0) add(`You honoured your pledge to the ${sn}.`, "good");
    if (s.dir === 1) { if (passed) { addTrust(g, s.sponsor!, 12); sp.coalition++; addRenown(g, 2); add(`The ${sn} are grateful. (+12 trust)`, "good"); } else addTrust(g, s.sponsor!, 3); }
    else if (passed) { addTrust(g, s.sponsor!, 3); add(`The motion passes despite your opposition.`, "warn"); }
    else { if (!(sp.pledges > 0)) addTrust(g, s.sponsor!, -10); sp.grudge++; add(`You blocked the ${sn}'s motion. They will remember.`, "warn"); }
    sp.pledges = 0;
    if (passed) { g.run.passed++; applyBill(); } else g.run.failed++;
  } else {
    if (passed) {
      g.run.passed++; const am = ambition(s.bill.stance); let rn = 2 + am * 0.6 + (s.kind === "budget" ? 3 : 0);
      for (const r of s.bill.riders) {
        if (r.id === "fanfare") rn += 8;
        if (r.id === "kickback") { g.shinies += 12; addHeat(g, 8); add("💸 Kickbacks: +12 ✦, +8 Heat", "warn"); }
        if (r.id === "gag") { addHeat(g, -12, true); add("🤐 Gag rider: −12 Heat", "info"); }
      }
      addRenown(g, rn); add(`"${billName(s.bill.stance)}" becomes law! (+${Math.round(rn)} Renown)`, "good"); applyBill();
      if (s.kind === "budget") { g.shinies += 10; for (const k of ISSUES) addStat(g, k, 2); add("The Budget passes: +10 ✦, all stats +2.", "good"); }
      if (s.kind === "crisis" && s.crisis) {
        const c = s.crisis;
        if (s.bill.stance[c.issue] >= 1) { addStat(g, c.issue, 8); addRenown(g, 5); add(`${c.emoji} Crisis averted! ${ISSUE_META[c.issue].name} +8, Renown +5.`, "good"); }
        else { addStat(g, c.issue, -8); add(`${c.emoji} The law ignores the crisis — ${ISSUE_META[c.issue].name} −8.`, "bad"); }
      }
    } else {
      g.run.failed++; addRenown(g, close ? -1 : -4); add(close ? "A narrow defeat. (−1 Renown)" : "A resounding defeat. (−4 Renown)", "bad");
      if (s.kind === "budget") { for (const k of ISSUES) addStat(g, k, -6); addRenown(g, -8); g.shinies = Math.floor(g.shinies / 2); add("GOVERNMENT SHUTDOWN: all stats −6, Renown −8, treasury halved.", "bad"); }
      if (s.kind === "crisis" && s.crisis) { addStat(g, s.crisis.issue, -12); add(`${s.crisis.emoji} The crisis rages on: ${ISSUE_META[s.crisis.issue].name} −12.`, "bad"); }
    }
  }
  g.run.peakSeats = Math.max(g.run.peakSeats, g.factions.crows.seats);
  if (!overInfo && ISSUES.some(k => g.stats[k] <= 0)) { overInfo = { win: false, cause: "collapse" }; add("A national stat has hit zero. The realm collapses!", "bad"); }
  g.result = { passed, title: passed ? "THE BILL PASSES" : "THE BILL FAILS", lines, next: overInfo ? "over" : "continue" } as ResultInfo; (g.result as any).over = overInfo;
  if (s.kind === "confidence") g.result.title = passed ? "CONFIDENCE HELD" : "NO CONFIDENCE";
  if (s.kind === "boss") g.result.title = passed ? `READING ${s.reading} CARRIED` : `READING ${s.reading} DEFEATED`;
  g.phase = "result";
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;
  const good = s.kind === "rival" && s.dir === -1 ? !passed : passed;
  if (good) { audio.pass(); fx.shake(8); fx.stars(cx, cy, "#f2c14e", 30); fx.feathers(cx, cy, 16, "#a78bfa"); fx.text(cx, cy - 40, passed ? "AYE!" : "BLOCKED!", "#f2c14e", 52); }
  else { audio.fail(); fx.shake(14); fx.feathers(cx, cy, 24, "#3b3470"); fx.text(cx, cy - 40, passed ? "AYE…" : "NAY!", "#fb7185", 52); }
  logL(g, `${g.result.title}: ${v.yes}–${v.no}.`, passed ? "good" : "bad");
  checkHeat(g); updateTension(g);
}

export function adjourn() {
  const g = getG(); if (!g || g.phase !== "sitting") return; const s = g.sitting;
  if (s.kind === "confidence" || s.kind === "boss") return deny("You cannot adjourn this vote");
  const lines: ResultInfo["lines"] = [{ text: "You adjourn without a vote. The House mutters.", tone: "warn" }];
  addRenown(g, -2); lines.push({ text: "Renown −2", tone: "bad" });
  if (s.kind === "crisis" && s.crisis) { addStat(g, s.crisis.issue, -10); lines.push({ text: `${s.crisis.emoji} ${ISSUE_META[s.crisis.issue].name} −10 as the crisis spreads.`, tone: "bad" }); }
  if (s.kind === "budget") { for (const k of ISSUES) addStat(g, k, -6); addRenown(g, -8); g.shinies = Math.floor(g.shinies / 2); lines.push({ text: "GOVERNMENT SHUTDOWN: all stats −6, Renown −8, treasury halved.", tone: "bad" }); }
  if (s.kind === "rival") { addTrust(g, s.sponsor!, -4); g.factions[s.sponsor!].pledges = 0; lines.push({ text: `The ${FACTIONS[s.sponsor!].name} feel ignored.`, tone: "warn" }); }
  const col = ISSUES.some(k => g.stats[k] <= 0);
  g.result = { passed: false, title: "ADJOURNED", lines, next: col ? "over" : "continue" }; (g.result as any).over = col ? { win: false, cause: "collapse" } : null;
  g.phase = "result"; g.vote = null; audio.fail(); commit();
}

export function continueFlow() {
  const g = getG(); if (!g || g.phase !== "result" || !g.result) return;
  const res = g.result; audio.click();
  if (res.next === "over") { const o = (res as any).over; endGame(g, o.win, o.cause); return; }
  g.result = null; g.vote = null; const s = g.sitting;
  if (s.kind === "boss") {
    s.reading++; s.ap = s.apMax; setupReading(g); s.bill.riders = [];
    g.banner = { key: Date.now() + Math.random(), text: `Reading ${s.reading} of 3`, sub: BOSSES.strix.name + " strikes again" };
    g.phase = "sitting"; updateTension(g); maybeEvent(g, false); commit(); return;
  }
  g.idx++;
  if (g.idx >= 4) { startElection(g); return; }
  startSitting(g);
}

// ───────── elections ─────────
const PICK_COST: Record<string, number> = { rally: 0, gild: 25, smear: 10, bury: 12 };
export function startElection(g: Game) {
  g.phase = "election"; g.election = { picks: [], smear: null, result: null }; audio.election(); updateTension(g); logL(g, "🗳️ The term ends. Voters head to the polls!", "warn"); commit();
}
export function togglePick(id: string) {
  const g = getG(); if (!g || g.phase !== "election" || !g.election) return; const e = g.election;
  const i = e.picks.indexOf(id);
  if (i >= 0) { e.picks.splice(i, 1); if (id === "smear") e.smear = null; }
  else { if (e.picks.length >= 2) return deny("Only two campaign moves"); e.picks.push(id); if (id === "smear" && !e.smear) e.smear = RIVALS.slice().sort((a, b) => g.factions[b].seats - g.factions[a].seats)[0]; }
  audio.click(); commit();
}
export function setSmear(f: FId) { const g = getG(); if (g?.election) { g.election.smear = f; audio.click(); commit(); } }
export const electionCost = (picks: string[]) => picks.reduce((a, p) => a + (PICK_COST[p] || 0), 0);
export function runElection() {
  const g = getG(); if (!g || g.phase !== "election" || !g.election) return; const e = g.election;
  const cost = electionCost(e.picks); if (g.shinies < cost) return deny(`Campaign costs ${cost} ✦`);
  g.shinies -= cost; g.run.shiniesSpent += cost;
  const approvals = {} as Record<FId, number>;
  for (const f of FACTION_ORDER) approvals[f] = satisfaction(g, f) * 1.2 + rnd(-0.15, 0.15);
  const C = g.factions.crows;
  approvals.crows += (g.renown - 50) / 60 - Math.max(0, g.heat - 45) / 90 - C.betrayals * 0.08;
  if (e.picks.includes("rally")) approvals.crows += 0.25;
  if (e.picks.includes("gild")) { approvals.crows += 0.4; addHeat(g, 4); }
  if (e.picks.includes("bury")) addHeat(g, -10, true);
  if (e.picks.includes("smear") && e.smear) { const T = g.factions[e.smear]; approvals[e.smear] -= T.dirt > 0 ? 0.9 : 0.5; if (T.dirt > 0) T.dirt--; addHeat(g, 8); }
  approvals.jackdaws -= g.heat / 250; approvals.ravens -= Math.max(0, g.heat - 40) / 120;
  if (g.mandates.includes("ironbeak")) approvals.owls += 0.2;
  const weights = FACTION_ORDER.map(f => g.factions[f].seats * Math.exp(1.8 * approvals[f]));
  const alloc = allocate(weights, TOTAL_SEATS, 4);
  const rows = FACTION_ORDER.map((f, i) => ({ f, before: g.factions[f].seats, after: alloc[i], approval: approvals[f] }));
  rows.forEach(r => { g.factions[r.f].seats = r.after; });
  syncSeats(g); g.run.peakSeats = Math.max(g.run.peakSeats, g.factions.crows.seats);
  // rival ideological adaptation to reputation & coalition history
  const news: string[] = []; const lowest = ISSUES.slice().sort((a, b) => g.stats[a] - g.stats[b])[0];
  for (const f of RIVALS) {
    const F = g.factions[f]; const ck = ISSUES.filter(k => Math.abs(g.factions.crows.prefs[k]) >= 1);
    if (ck.length && Math.random() < 0.6) {
      const k = pick(ck); const target = g.factions.crows.prefs[k];
      if (F.trust > 25) { const nv = clamp(F.prefs[k] + Math.sign(target - F.prefs[k]), -2, 2); if (nv !== F.prefs[k]) { F.prefs[k] = nv; news.push(`${FACTIONS[f].emoji} Friendly ${FACTIONS[f].name} drift toward you on ${ISSUE_META[k].name}.`); } }
      else if (F.trust < -25) { const nv = clamp(F.prefs[k] - Math.sign(target - F.prefs[k] || 1), -2, 2); if (nv !== F.prefs[k]) { F.prefs[k] = nv; news.push(`${FACTIONS[f].emoji} Hostile ${FACTIONS[f].name} harden against you on ${ISSUE_META[k].name}.`); } }
    }
    if (Math.random() < 0.35 && F.prefs[lowest] < 2) { F.prefs[lowest]++; news.push(`${FACTIONS[f].emoji} The ${FACTIONS[f].name} now demand more ${ISSUE_META[lowest].name}.`); }
  }
  const lost = g.factions.crows.seats < DIFFS[g.diff].minSeats;
  e.result = { rows, lost, news }; g.phase = "electionResult";
  audio.election(); fx.shake(6);
  news.forEach(n => logL(g, n, "ai"));
  logL(g, `Election: The Murder hold ${g.factions.crows.seats} seats.`, lost ? "bad" : "good"); commit();
}
export function continueElection() {
  const g = getG(); if (!g || g.phase !== "electionResult" || !g.election?.result) return; audio.click();
  if (g.election.result.lost) { endGame(g, false, "ousted"); return; }
  g.run.termsDone++; g.term++; g.idx = 0;
  for (const f of RIVALS) { const F = g.factions[f]; F.bribesTerm = 0; F.grudge = Math.floor(F.grudge / 2); }
  for (const k of Object.keys(g.style)) g.style[k] = Math.floor(g.style[k] / 2);
  g.boons = shuffle(BOONS.filter(b => !g.owned.includes(b.id))).slice(0, 3); g.election = null; g.phase = "boon"; commit();
}
export function chooseBoon(i: number) {
  const g = getG(); if (!g || g.phase !== "boon" || !g.boons) return; const b = g.boons[i]; if (!b) return;
  const gg = g as any; gg.__defect = 0; gg.__dirtAll = 0; b.apply(g); g.owned.push(b.id);
  if (gg.__defect) defectSeats(g, gg.__defect); if (gg.__dirtAll) for (const f of RIVALS) g.factions[f].dirt = Math.min(3, g.factions[f].dirt + gg.__dirtAll);
  g.boons = null; addHeat(g, -10, true); g.shinies += 10; logL(g, `${b.emoji} You adopt ${b.name}. Term ${ROMAN[g.term]} begins.`, "good"); audio.unlock();
  g.sitting.ap = 0; startSitting(g);
}

// ───────── ending ─────────
const END_TEXT: Record<string, [string, string]> = {
  impeached: ["IMPEACHED", "The Daily Caw’s drumbeat grew too loud. Heat hit 100 and the House stripped you of your perch."],
  collapse: ["THE REALM COLLAPSES", "A national stat fell to zero. The Rookery burns while you counted votes."],
  ousted: ["OUSTED AT THE POLLS", "Too few seats remain for The Murder to command respect. The voters have spoken."],
  noconfidence: ["NO CONFIDENCE", "The House has withdrawn its confidence. Your term in the Speaker's perch is over."],
  charter: ["THE CHARTER FALLS", "Chancellor Strix dissolves your coalition. The Owls rule the night."],
};
export function endGame(g: Game, win: boolean, cause: string) {
  if (g.phase === "over") return;
  const raw = g.run.termsDone * 7 + g.run.passed * 1.5 + (win ? 45 : 0) + g.run.peakSeats / 10;
  const feathers = Math.max(1, Math.round(raw * DIFFS[g.diff].feather * (1 + mandateBonus(g))));
  const [title, text] = win ? ["THE GREAT CHARTER IS SEALED", "Chancellor Strix is dissolved, the Rookery is yours. Crows reign over the Parliament — for now."] : END_TEXT[cause] || ["DEFEAT", "Your reign has ended."];
  g.over = { win, cause, title, text, feathers }; g.phase = "over"; g.vote = null; g.event = null;
  const lead = g.leader, df = g.diff, term = g.term, seats = g.factions.crows.seats, passed = g.run.passed;
  mutateSave(s => {
    s.feathers += feathers; s.stats.runs++; if (win) { s.stats.wins++; s.winsByDiff[df] = (s.winsByDiff[df] || 0) + 1; }
    s.stats.bills += g.run.passed; s.stats.bestTerm = Math.max(s.stats.bestTerm, win ? 5 : term); s.stats.scandals += g.run.scandals; s.stats.bribes += g.run.bribes; s.stats.totalFeathers += feathers;
    s.history = [{ date: Date.now(), leader: lead, diff: df, result: (win ? "victory" : "defeat") as "victory" | "defeat", term, seats, passed, feathers, cause }, ...s.history].slice(0, 8);
    s.seenTutorial = true;
  });
  if (win) { audio.victory(); fx.shake(10); fx.stars(window.innerWidth / 2, window.innerHeight / 2, "#f2c14e", 60); } else { audio.defeat(); fx.shake(16); }
}

// ───────── meta progression ─────────
export function buyUpgrade(id: string): boolean {
  const u = META_UPGRADES.find(x => x.id === id); if (!u) return false;
  if (SAVE.upgrades.includes(id) || SAVE.feathers < u.cost || (u.req && !SAVE.upgrades.includes(u.req))) { audio.error(); return false; }
  mutateSave(s => { s.feathers -= u.cost; s.upgrades = [...s.upgrades, id]; }); audio.unlock(); return true;
}
export function unlockLeader(id: string): boolean {
  const l = LEADERS.find(x => x.id === id); if (!l || SAVE.leaders.includes(id) || SAVE.feathers < l.cost) { audio.error(); return false; }
  mutateSave(s => { s.feathers -= l.cost; s.leaders = [...s.leaders, id]; }); audio.unlock(); return true;
}
void ID; void newSeat; void riderCostOf; void billName;
