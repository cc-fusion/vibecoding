import { CARDS, Keyword, Opponent, Side, Terrain } from "./cards";

export interface Unit {
  uid: number;
  cardId: string;
  owner: Side;
  atk: number;
  hp: number;
  maxHp: number;
  ready: boolean;
  keyword?: Keyword;
}

export interface Tile {
  terrain: Terrain;
  unit: Unit | null;
}

export type Fx =
  | { t: "float"; idx: number; text: string; kind: "dmg" | "heal" | "info" }
  | { t: "keepFloat"; side: Side; text: string; kind: "dmg" | "heal" }
  | { t: "lunge"; idx: number; dir: number }
  | { t: "ghost"; idx: number; art: string }
  | { t: "terra"; idx: number }
  | { t: "sfx"; name: string }
  | { t: "shake" };

export interface State {
  tiles: Tile[];
  side: Side;
  round: number;
  energy: Record<Side, number>;
  keep: Record<Side, number>;
  keepMax: Record<Side, number>;
  hand: Record<Side, string[]>;
  drawPile: Record<Side, string[]>;
  discard: Record<Side, string[]>;
  perks: string[];
  nextUid: number;
  over: boolean;
  winner: Side | null;
  log: string[];
  oppName: string;
}

export interface Step {
  state: State;
  fx: Fx[];
  msg?: string;
  delay: number;
}

export const HAND_LIMIT = 7;
export const FATIGUE_ROUND = 10;

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const other = (s: Side): Side => (s === "p" ? "e" : "p");
export const rowOf = (i: number) => Math.floor(i / 3);
export const colOf = (i: number) => i % 3;
export const dirOf = (s: Side) => (s === "p" ? -1 : 1);

export function neighbors(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const out: number[] = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
}

export function forwardIdx(i: number, side: Side): number {
  const r = rowOf(i) + dirOf(side);
  if (r < 0 || r > 2) return -1;
  return r * 3 + colOf(i);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function energyFor(s: State, side: Side): number {
  return Math.min(s.round + 1, 6) + (side === "p" && s.perks.includes("energy") ? 1 : 0);
}

export function newBattle(deck: string[], perks: string[], opp: Opponent): State {
  const s: State = {
    tiles: Array.from({ length: 9 }, () => ({ terrain: "plains" as Terrain, unit: null })),
    side: "p",
    round: 1,
    energy: { p: 0, e: 0 },
    keep: { p: 20 + (perks.includes("keep") ? 6 : 0), e: opp.keep },
    keepMax: { p: 20 + (perks.includes("keep") ? 6 : 0), e: opp.keep },
    hand: { p: [], e: [] },
    drawPile: { p: shuffle(deck), e: shuffle(opp.deck) },
    discard: { p: [], e: [] },
    perks,
    nextUid: 1,
    over: false,
    winner: null,
    log: [`Battle begins against ${opp.name}.`],
    oppName: opp.name,
  };
  drawCards(s, "p", 3);
  drawCards(s, "e", 3);
  beginTurn(s, []);
  return s;
}

export function drawCards(s: State, side: Side, n: number): number {
  let drawn = 0;
  for (let k = 0; k < n; k++) {
    if (s.drawPile[side].length === 0) {
      if (s.discard[side].length === 0) break;
      s.drawPile[side] = shuffle(s.discard[side]);
      s.discard[side] = [];
    }
    const c = s.drawPile[side].pop()!;
    if (s.hand[side].length >= HAND_LIMIT) {
      s.discard[side].push(c);
    } else {
      s.hand[side].push(c);
      drawn++;
    }
  }
  return drawn;
}

function beginTurn(s: State, fx: Fx[]) {
  const side = s.side;
  s.energy[side] = energyFor(s, side);
  for (const t of s.tiles) if (t.unit && t.unit.owner === side) t.unit.ready = true;
  const n = 2 + (side === "p" && s.perks.includes("draw") ? 1 : 0);
  drawCards(s, side, n);
  fx.push({ t: "sfx", name: "turn" });
}

export function effAtk(s: State, u: Unit, terrain: Terrain): number {
  let a = u.atk;
  if (terrain === "mountain") a += 1;
  if (terrain === "water" && !(u.owner === "p" && s.perks.includes("tide"))) a = Math.max(1, a - 1);
  if (terrain === "lava" && u.keyword === "fire") a += 1;
  return a;
}

export function attackTargets(s: State, idx: number): { units: number[]; keep: boolean } {
  const u = s.tiles[idx].unit;
  if (!u) return { units: [], keep: false };
  const dir = dirOf(u.owner);
  const col = colOf(idx);
  const list: number[] = [];
  for (let r = rowOf(idx) + dir; r >= 0 && r <= 2; r += dir) {
    const t = r * 3 + col;
    const tu = s.tiles[t].unit;
    if (tu && tu.owner !== u.owner) list.push(t);
  }
  if (list.length === 0) return { units: [], keep: true };
  if (u.keyword === "pierce") return { units: list, keep: false };
  return { units: [list[0]], keep: false };
}

function checkOver(s: State) {
  if (s.over) return;
  const pd = s.keep.p <= 0;
  const ed = s.keep.e <= 0;
  if (!pd && !ed) return;
  s.over = true;
  if (pd && ed) s.winner = s.keep.p >= s.keep.e ? "p" : "e";
  else s.winner = pd ? "e" : "p";
}

function damageUnit(s: State, idx: number, amount: number, fx: Fx[], attack: boolean): boolean {
  const t = s.tiles[idx];
  const u = t.unit;
  if (!u) return false;
  let d = amount;
  if (attack && t.terrain === "forest") d = Math.max(1, d - 1);
  u.hp -= d;
  fx.push({ t: "float", idx, text: `-${d}`, kind: "dmg" });
  if (u.hp <= 0) {
    fx.push({ t: "ghost", idx, art: CARDS[u.cardId].art });
    fx.push({ t: "sfx", name: "die" });
    s.log.push(`${CARDS[u.cardId].name} (${u.owner === "p" ? "yours" : "foe"}) falls.`);
    t.unit = null;
    return true;
  }
  fx.push({ t: "sfx", name: "hit" });
  return false;
}

function damageKeep(s: State, side: Side, amount: number, fx: Fx[]) {
  s.keep[side] = Math.max(0, s.keep[side] - amount);
  fx.push({ t: "keepFloat", side, text: `-${amount}`, kind: "dmg" });
  fx.push({ t: "sfx", name: "keep" });
  fx.push({ t: "shake" });
  checkOver(s);
}

function healUnit(s: State, idx: number, amount: number, fx: Fx[]) {
  const u = s.tiles[idx].unit;
  if (!u || u.hp >= u.maxHp) return;
  const h = Math.min(amount, u.maxHp - u.hp);
  u.hp += h;
  fx.push({ t: "float", idx, text: `+${h}`, kind: "heal" });
  fx.push({ t: "sfx", name: "heal" });
}

function setTerrain(s: State, i: number, terrain: Terrain, fx: Fx[]) {
  if (i < 0) return;
  if (s.tiles[i].terrain === terrain) return;
  s.tiles[i].terrain = terrain;
  fx.push({ t: "terra", idx: i });
}

export function validTargets(s: State, cardId: string): number[] {
  const c = CARDS[cardId];
  const out: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (c.target === "empty" && !s.tiles[i].unit) out.push(i);
    else if (c.target === "any") out.push(i);
    else if (c.target === "unit" && s.tiles[i].unit) out.push(i);
  }
  return out;
}

export function canAfford(s: State, side: Side, cardId: string): boolean {
  return CARDS[cardId].cost <= s.energy[side];
}

export function isPlayable(s: State, side: Side, cardId: string): boolean {
  if (!canAfford(s, side, cardId)) return false;
  const c = CARDS[cardId];
  if (c.target === "none") return true;
  return validTargets(s, cardId).length > 0;
}

const ALL_TERRAIN: Terrain[] = ["plains", "forest", "mountain", "water", "lava"];

function terraform(s: State, id: string, idx: number, side: Side, fx: Fx[]) {
  const nb = neighbors(idx);
  const fwd = forwardIdx(idx, side);
  switch (id) {
    case "militia":
      setTerrain(s, idx, "plains", fx);
      break;
    case "sapper":
    case "ballista":
      setTerrain(s, idx, "mountain", fx);
      break;
    case "druid":
      setTerrain(s, idx, "forest", fx);
      for (const n of nb) if (s.tiles[n].terrain === "plains") setTerrain(s, n, "forest", fx);
      break;
    case "tidecaller":
      for (const n of nb) setTerrain(s, n, "water", fx);
      break;
    case "pyromancer":
      setTerrain(s, fwd, "lava", fx);
      break;
    case "archer":
      setTerrain(s, idx, "forest", fx);
      break;
    case "knight":
      for (const n of nb) if (s.tiles[n].terrain === "water" || s.tiles[n].terrain === "lava") setTerrain(s, n, "plains", fx);
      break;
    case "geomancer":
      setTerrain(s, idx, "mountain", fx);
      setTerrain(s, fwd, "mountain", fx);
      break;
    case "phoenix":
      setTerrain(s, idx, "lava", fx);
      break;
    case "wyrm":
      for (const n of nb) if (s.tiles[n].terrain === "plains" || s.tiles[n].terrain === "forest") setTerrain(s, n, "lava", fx);
      break;
    case "colossus":
      setTerrain(s, idx, "mountain", fx);
      for (const n of nb) if (s.tiles[n].terrain === "plains") setTerrain(s, n, "mountain", fx);
      break;
    case "leviathan":
      setTerrain(s, idx, "water", fx);
      for (const n of nb) setTerrain(s, n, "water", fx);
      break;
    default:
      break;
  }
}

/** Mutates s. handIdx indexes the side's hand; tileIdx = -1 for untargeted cards. */
export function playCard(s: State, side: Side, handIdx: number, tileIdx: number, fx: Fx[]) {
  const id = s.hand[side][handIdx];
  const card = CARDS[id];
  s.hand[side].splice(handIdx, 1);
  s.energy[side] -= card.cost;
  s.discard[side].push(id);
  s.log.push(`${side === "p" ? "You play" : s.oppName + " plays"} ${card.name}.`);

  if (card.kind === "unit") {
    const bonus = side === "p" && s.perks.includes("hardy") ? 1 : 0;
    const u: Unit = {
      uid: s.nextUid++,
      cardId: id,
      owner: side,
      atk: card.atk!,
      hp: card.hp! + bonus,
      maxHp: card.hp! + bonus,
      ready: false,
      keyword: card.keyword,
    };
    s.tiles[tileIdx].unit = u;
    fx.push({ t: "sfx", name: "place" });
    terraform(s, id, tileIdx, side, fx);
    if (fx.some((f) => f.t === "terra")) fx.push({ t: "sfx", name: "terra" });
    return;
  }

  fx.push({ t: "sfx", name: "spell" });
  switch (id) {
    case "raise":
      setTerrain(s, tileIdx, "mountain", fx);
      break;
    case "bloom":
      setTerrain(s, tileIdx, "forest", fx);
      healUnit(s, tileIdx, 2, fx);
      break;
    case "flood":
      setTerrain(s, tileIdx, "water", fx);
      break;
    case "scorch":
      setTerrain(s, tileIdx, "lava", fx);
      damageUnit(s, tileIdx, 2, fx, false);
      break;
    case "lightning":
      damageUnit(s, tileIdx, 3, fx, false);
      break;
    case "shift": {
      const r = rowOf(tileIdx);
      const old = [0, 1, 2].map((c) => s.tiles[r * 3 + c]);
      for (let c = 0; c < 3; c++) {
        s.tiles[r * 3 + ((c + 1) % 3)] = old[c];
        fx.push({ t: "terra", idx: r * 3 + c });
      }
      break;
    }
    case "drift": {
      const c = colOf(tileIdx);
      const d = dirOf(side);
      const old = [0, 1, 2].map((r) => s.tiles[r * 3 + c]);
      for (let r = 0; r < 3; r++) {
        s.tiles[((r + d + 3) % 3) * 3 + c] = old[r];
        fx.push({ t: "terra", idx: r * 3 + c });
      }
      break;
    }
    case "level":
      for (let i = 0; i < 9; i++) setTerrain(s, i, "plains", fx);
      break;
    case "hearth": {
      const h = Math.min(5, s.keepMax[side] - s.keep[side]);
      s.keep[side] += h;
      fx.push({ t: "keepFloat", side, text: `+${h}`, kind: "heal" });
      fx.push({ t: "sfx", name: "heal" });
      break;
    }
    case "insight":
      drawCards(s, side, 2);
      break;
    case "cataclysm":
      for (let i = 0; i < 9; i++) setTerrain(s, i, ALL_TERRAIN[Math.floor(Math.random() * 5)], fx);
      for (let i = 0; i < 9; i++) damageUnit(s, i, 2, fx, false);
      fx.push({ t: "shake" });
      break;
    default:
      break;
  }
  if (fx.some((f) => f.t === "terra")) fx.push({ t: "sfx", name: "terra" });
}

export interface Preview {
  terrain: Terrain[];
  changed: number[];
  dies: number[]; // tile positions (before) of units that die
  keepDelta: Record<Side, number>;
}

export function previewPlay(s: State, handIdx: number, tileIdx: number): Preview {
  const sim = clone(s);
  const fx: Fx[] = [];
  playCard(sim, s.side, handIdx, tileIdx, fx);
  const terrain = sim.tiles.map((t) => t.terrain);
  const changed: number[] = [];
  terrain.forEach((t, i) => {
    if (t !== s.tiles[i].terrain) changed.push(i);
  });
  const alive = new Set(sim.tiles.map((t) => t.unit?.uid).filter((x) => x !== undefined));
  const dies: number[] = [];
  s.tiles.forEach((t, i) => {
    if (t.unit && !alive.has(t.unit.uid)) dies.push(i);
  });
  return {
    terrain,
    changed,
    dies,
    keepDelta: { p: sim.keep.p - s.keep.p, e: sim.keep.e - s.keep.e },
  };
}

/** Resolve the current side's attack phase, end-of-turn effects, reactions and start the next turn. */
export function endTurn(start: State): Step[] {
  const s = clone(start);
  const steps: Step[] = [];
  const snap = (fx: Fx[], delay: number, msg?: string) => steps.push({ state: clone(s), fx, delay, msg });
  const side = s.side;
  const foe = other(side);

  const rows = side === "p" ? [0, 1, 2] : [2, 1, 0];
  const order: number[] = [];
  for (const r of rows) for (let c = 0; c < 3; c++) order.push(r * 3 + c);

  for (const idx of order) {
    const u = s.tiles[idx].unit;
    if (!u || u.owner !== side || !u.ready) continue;
    const atk = effAtk(s, u, s.tiles[idx].terrain);
    const tg = attackTargets(s, idx);
    const fx: Fx[] = [
      { t: "lunge", idx, dir: dirOf(side) },
      { t: "sfx", name: "attack" },
    ];
    if (tg.keep) {
      damageKeep(s, foe, atk, fx);
      s.log.push(`${CARDS[u.cardId].name} strikes the ${foe === "p" ? "your" : "enemy"} Keep for ${atk}.`);
    } else {
      for (const t of tg.units) damageUnit(s, t, atk, fx, true);
    }
    snap(fx, 460);
    if (s.over) return steps;
  }

  // End-of-turn terrain effects for this side's units
  {
    const fx: Fx[] = [];
    for (let i = 0; i < 9; i++) {
      const t = s.tiles[i];
      const u = t.unit;
      if (!u || u.owner !== side) continue;
      if (t.terrain === "lava") {
        const immune = u.keyword === "fire" || (side === "p" && s.perks.includes("ember"));
        if (!immune) damageUnit(s, i, 1, fx, false);
      } else if (t.terrain === "water") {
        healUnit(s, i, side === "p" && s.perks.includes("tide") ? 2 : 1, fx);
      }
    }
    if (fx.length) snap(fx, 500);
  }

  if (side === "e") {
    // Round end: elemental reactions
    const before = s.tiles.map((t) => t.terrain);
    const fx: Fx[] = [];
    const notes: string[] = [];
    for (let i = 0; i < 9; i++) {
      const nb = neighbors(i);
      if (before[i] === "lava" && nb.some((n) => before[n] === "water")) {
        setTerrain(s, i, "mountain", fx);
        notes.push("Steam cools Lava into Obsidian Mountain!");
      } else if (before[i] === "forest" && nb.some((n) => before[n] === "lava")) {
        setTerrain(s, i, "plains", fx);
        notes.push("Forest burns to ash.");
      }
    }
    if (fx.length) {
      fx.push({ t: "sfx", name: "react" });
      const uniq = Array.from(new Set(notes));
      uniq.forEach((n) => s.log.push(n));
      snap(fx, 700, uniq[0]);
    }
    // Fatigue
    if (s.round >= FATIGUE_ROUND) {
      const d = s.round - FATIGUE_ROUND + 1;
      const f2: Fx[] = [];
      s.log.push(`Dusk falls: both Keeps take ${d}.`);
      damageKeep(s, "p", d, f2);
      damageKeep(s, "e", d, f2);
      snap(f2, 700, `Dusk falls - both Keeps take ${d}`);
      if (s.over) return steps;
    }
  }

  // Next turn
  s.side = foe;
  if (foe === "p") s.round += 1;
  const fx: Fx[] = [];
  beginTurn(s, fx);
  if (foe === "p") s.log.push(`— Round ${s.round} —`);
  snap(fx, 300);
  return steps;
}

export function evaluate(s: State, me: Side): number {
  const you = other(me);
  let v = (s.keep[me] - s.keep[you]) * 1.2;
  if (s.keep[you] <= 0) v += 1000;
  if (s.keep[me] <= 0) v -= 1000;
  for (let i = 0; i < 9; i++) {
    const t = s.tiles[i];
    const u = t.unit;
    if (!u) continue;
    const sign = u.owner === me ? 1 : -1;
    const eff = effAtk(s, u, t.terrain);
    v += sign * (eff * 1.3 + u.hp * 1.0);
    if (t.terrain === "forest") v += sign * 0.5;
    const tg = attackTargets(s, i);
    if (tg.keep) {
      const k = s.keep[other(u.owner)];
      v += sign * eff * 0.9;
      if (eff >= k) v += sign * 40;
    } else {
      for (const ti of tg.units) {
        const tu = s.tiles[ti].unit!;
        v += sign * Math.min(eff, tu.hp) * 0.6;
        if (eff >= tu.hp) v += sign * 2;
      }
    }
    if (t.terrain === "lava" && u.keyword !== "fire") v -= sign * 1.4;
    if (t.terrain === "water") v += sign * 0.4;
  }
  return v;
}

export function enemyTurn(start: State, skill: number): Step[] {
  const s = clone(start);
  const steps: Step[] = [];
  const noise = (1 - skill) * 3.2;
  for (let guard = 0; guard < 14; guard++) {
    if (s.over) break;
    const base = evaluate(s, "e");
    let best: { hi: number; ti: number; score: number } | null = null;
    const seen = new Set<string>();
    for (let hi = 0; hi < s.hand.e.length; hi++) {
      const id = s.hand.e[hi];
      if (seen.has(id)) continue;
      seen.add(id);
      if (!isPlayable(s, "e", id)) continue;
      const card = CARDS[id];
      const targets = card.target === "none" ? [-1] : validTargets(s, id);
      for (const ti of targets) {
        const sim = clone(s);
        playCard(sim, "e", hi, ti, []);
        let score = evaluate(sim, "e") - base + card.cost * 0.4 + (Math.random() - 0.5) * noise;
        if (id === "insight") score = 0.9 - s.hand.e.length * 0.1 + (Math.random() - 0.5) * noise * 0.3;
        if (id === "hearth" && s.keep.e >= s.keepMax.e - 1) score -= 10;
        if (id === "level") score -= 0.5;
        if (!best || score > best.score) best = { hi, ti, score };
      }
    }
    if (!best || best.score < 0.25) break;
    const fx: Fx[] = [];
    const id = s.hand.e[best.hi];
    playCard(s, "e", best.hi, best.ti, fx);
    steps.push({
      state: clone(s),
      fx,
      delay: 750,
      msg: `${s.oppName} plays ${CARDS[id].name}`,
    });
  }
  if (s.over) return steps;
  return steps.concat(endTurn(s));
}
