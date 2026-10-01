import {
  CHARTS,
  CAPTAINS,
  CRATE_INFO,
  FISH,
  FISH_KINDS,
  LEVY,
  MAX_UPGRADE,
  MONSTERS,
  RELICS,
  STORM_DELAY,
  STORM_INTERVAL,
  UPGRADES,
  relicById,
} from "./data";
import {
  DIRS,
  R,
  allHexes,
  dist,
  inBounds,
  key,
  neighbors,
  pick,
  rand,
  randInt,
  shuffle,
  type Hex,
} from "./hex";
import type {
  CrateKind,
  Ev,
  FishKind,
  Game,
  LogEntry,
  Monster,
  MonsterKind,
  Player,
  Shoal,
  SoundName,
  Tile,
} from "./types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const addEv = (g: Game, e: Ev) => g.events.push(e);
const snd = (g: Game, name: SoundName) => addEv(g, { t: "snd", name });
const say = (g: Game, text: string, tone: LogEntry["tone"] = "info") => {
  g.log.push({ text, tone, turn: g.turn });
  if (g.log.length > 80) g.log.shift();
};
const floatAt = (g: Game, h: Hex, text: string, color: string) =>
  addEv(g, { t: "float", q: h.q, r: h.r, text, color });

export const monsterAt = (g: Game, q: number, r: number) => g.monsters.find((m) => m.q === q && m.r === r);
export const shoalAt = (g: Game, q: number, r: number) => g.shoals.find((s) => s.q === q && s.r === r);
export const holdUsed = (p: Player) => p.hold.sardine + p.hold.tuna + p.hold.glow;
export const tileAt = (g: Game, q: number, r: number) => g.tiles[key(q, r)];
export const isVisible = (g: Game, q: number, r: number) => dist(g.p, { q, r }) <= g.p.vision;

export function sellPrice(g: Game, kind: FishKind): number {
  const mod = g.harbor ? g.harbor.mods[kind] : 1;
  return Math.max(1, Math.round(FISH[kind].value * mod * (1 + g.p.sellBonus)));
}
export function holdValue(g: Game): number {
  return FISH_KINDS.reduce((s, k) => s + g.p.hold[k] * sellPrice(g, k), 0);
}
export function currentLevy(g: Game): number {
  return LEVY[Math.min(g.chart - 1, LEVY.length - 1)];
}
export function stormDelay(g: Game) {
  return STORM_DELAY[g.chart - 1] + g.p.stormBonus;
}
export function stormCap(g: Game) {
  return g.chart === 5 ? R + 1 : R;
}
export function stormTurnsLeft(g: Game): number | null {
  if (g.stormQ >= stormCap(g)) return null;
  const delay = stormDelay(g);
  const interval = STORM_INTERVAL[g.chart - 1];
  if (g.turn < delay) return delay - g.turn;
  return interval - ((g.turn - delay) % interval);
}
export const fuelPrice = (g: Game) => Math.ceil(g.chart / 2);
export const upgradeCost = (g: Game, k: keyof typeof UPGRADES) =>
  UPGRADES[k].base + UPGRADES[k].step * g.p.upg[k];

export function computeScore(g: Game): number {
  const s = g.stats;
  const completed = g.phase === "harbor" ? g.chart : g.chart - 1;
  return s.earned + s.slain * 10 + s.relics * 15 + completed * 50 + (g.phase === "won" ? 300 + g.p.hull * 10 : 0);
}

/* ------------------------------------------------------------------ */
/* game creation                                                       */
/* ------------------------------------------------------------------ */

function newPlayer(captainId: string): Player {
  const p: Player = {
    q: 0,
    r: 0,
    hull: 10,
    maxHull: 10,
    fuel: 24,
    maxFuel: 24,
    nets: 7,
    maxNets: 7,
    harpoons: 5,
    maxHarpoons: 5,
    hold: { sardine: 0, tuna: 0, glow: 0 },
    holdMax: 10,
    gold: 10,
    relics: [],
    netRange: 2,
    harpRange: 3,
    harpDmg: 2,
    vision: 3,
    oilBonus: 0,
    sellBonus: 0,
    armor: 0,
    reel: false,
    lucky: false,
    piston: false,
    moves: 0,
    stormBonus: 0,
    upg: { hold: 0, hull: 0, fuel: 0, net: 0, rack: 0 },
  };
  const cap = CAPTAINS.find((c) => c.id === captainId) ?? CAPTAINS[0];
  Object.assign(p, cap.mods);
  p.hull = p.maxHull;
  p.fuel = p.maxFuel;
  p.nets = p.maxNets;
  p.harpoons = p.maxHarpoons;
  return p;
}

export function createGame(captainId: string): Game {
  const g: Game = {
    phase: "sail",
    captain: captainId,
    chart: 1,
    turn: 0,
    stormQ: -R,
    tiles: {},
    shoals: [],
    monsters: [],
    p: newPlayer(captainId),
    log: [],
    events: [],
    evSeq: 0,
    pending: null,
    nextId: 1,
    harbor: null,
    stats: { earned: 0, fish: 0, relics: 0, slain: 0, turns: 0 },
    overCause: "",
    score: 0,
  };
  startChart(g);
  return g;
}

function patch(tiles: Record<string, Tile>, type: Tile["type"], count: number, rmin: number, rmax: number, start: Hex, gate: Hex) {
  const hexes = allHexes();
  for (let i = 0; i < count; i++) {
    const c = pick(hexes);
    const rad = randInt(rmin, rmax);
    for (const h of hexes) {
      if (dist(c, h) <= rad && Math.random() < 0.85) {
        if (dist(h, start) < 2 || dist(h, gate) < 2) continue;
        const t = tiles[key(h.q, h.r)];
        if (!t.special) t.type = type;
      }
    }
  }
}

function bfs(tiles: Record<string, Tile>, start: Hex): Set<string> {
  const seen = new Set<string>([key(start.q, start.r)]);
  const queue: Hex[] = [start];
  while (queue.length) {
    const c = queue.shift()!;
    for (const n of neighbors(c.q, c.r)) {
      const k = key(n.q, n.r);
      if (seen.has(k) || tiles[k].type === "rock") continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

function mkMonster(g: Game, kind: MonsterKind, q: number, r: number): Monster {
  const d = MONSTERS[kind];
  return { id: g.nextId++, kind, q, r, hp: d.hp, maxHp: d.hp, cd: 0, cd2: 0, stun: 0, lodged: 0, aware: false };
}

function startChart(g: Game) {
  const chart = g.chart;
  let tiles: Record<string, Tile> = {};
  let start: Hex = { q: -R, r: 3 };
  let gate: Hex = { q: R, r: -3 };
  let reach = new Set<string>();
  let ok = false;

  for (let attempt = 0; attempt < 40 && !ok; attempt++) {
    tiles = {};
    for (const h of allHexes()) {
      tiles[key(h.q, h.r)] = {
        q: h.q,
        r: h.r,
        type: "deep",
        dir: 0,
        seen: false,
        relic: false,
        crate: null,
        special: null,
      };
    }
    start = { q: -R, r: randInt(1, 5) };
    gate = { q: R, r: -randInt(1, 5) };
    tiles[key(start.q, start.r)].special = "start";
    if (chart < 5) tiles[key(gate.q, gate.r)].special = "gate";

    patch(tiles, "shallow", randInt(4, 6), 1, 2, start, gate);
    patch(tiles, "kelp", randInt(3, 4) + (chart === 2 ? 2 : 0), 1, 1, start, gate);

    // rocks
    const seeds = 5 + chart;
    const hexes = allHexes();
    for (let i = 0; i < seeds; i++) {
      const c = pick(hexes);
      if (dist(c, start) < 3 || dist(c, gate) < 2) continue;
      let cur = c;
      tiles[key(c.q, c.r)].type = "rock";
      const grow = randInt(0, 3);
      for (let j = 0; j < grow; j++) {
        const ns = shuffle(neighbors(cur.q, cur.r)).filter(
          (n) => !tiles[key(n.q, n.r)].special && dist(n, start) >= 2 && dist(n, gate) >= 2
        );
        if (!ns.length) break;
        cur = ns[0];
        tiles[key(cur.q, cur.r)].type = "rock";
      }
    }

    // currents
    const cCount = randInt(3, 4);
    for (let i = 0; i < cCount; i++) {
      const c = pick(hexes);
      let cq = c.q;
      let cr = c.r;
      let d = rand(6);
      const len = randInt(3, 5);
      for (let j = 0; j < len; j++) {
        const t = tiles[key(cq, cr)];
        if (!t || t.type === "rock" || t.special || t.type === "current") break;
        t.type = "current";
        t.dir = d;
        cq += DIRS[d].q;
        cr += DIRS[d].r;
        if (Math.random() < 0.3) d = (d + (Math.random() < 0.5 ? 1 : 5)) % 6;
      }
    }

    reach = bfs(tiles, start);
    ok = (chart === 5 || reach.has(key(gate.q, gate.r))) && reach.size > 75;
  }
  if (!ok) {
    for (const k of Object.keys(tiles)) if (tiles[k].type === "rock") tiles[k].type = "deep";
    reach = bfs(tiles, start);
  }

  const reachList = shuffle(
    Array.from(reach)
      .map((k) => tiles[k])
      .filter((t) => !t.special)
  );
  const taken = new Set<string>();
  const take = (pred: (t: Tile) => boolean): Tile | null => {
    for (const t of reachList) {
      const k = key(t.q, t.r);
      if (taken.has(k)) continue;
      if (pred(t)) {
        taken.add(k);
        return t;
      }
    }
    return null;
  };

  // shoals
  const shoals: Shoal[] = [];
  const nShoals = 9 + chart;
  for (let i = 0; i < nShoals; i++) {
    const pref = Math.random() < 0.65;
    const t =
      take((t) => dist(t, start) >= 2 && (!pref || t.type === "shallow" || t.type === "kelp")) ??
      take((t) => dist(t, start) >= 2);
    if (!t) continue;
    const roll = Math.random();
    const glowC = 0.08 + chart * 0.03;
    let kind: FishKind = "sardine";
    if (roll < glowC) kind = "glow";
    else if (roll < glowC + 0.35) kind = "tuna";
    const count = kind === "sardine" ? randInt(2, 4) : kind === "tuna" ? randInt(1, 3) : randInt(1, 2);
    shoals.push({ id: g.nextId++, q: t.q, r: t.r, kind, count });
    taken.delete(key(t.q, t.r));
  }

  // relic sites
  const nRelics = 3 + (chart >= 3 ? 1 : 0);
  for (let i = 0; i < nRelics; i++) {
    const t = take((t) => dist(t, start) >= 3 && t.type !== "current");
    if (t) t.relic = true;
  }
  // crates
  const crateKinds: CrateKind[] = ["fuel", "fuel", "harpoon", "net", "gold", "hull"];
  const nCrates = 3 + (chart === 5 ? 1 : 0);
  for (let i = 0; i < nCrates; i++) {
    const t = take((t) => dist(t, start) >= 2 && t.type !== "current");
    if (t) t.crate = pick(crateKinds);
  }

  // monsters
  const spec: Record<number, [MonsterKind, number][]> = {
    1: [["eel", 2]],
    2: [["eel", 3], ["angler", 1]],
    3: [["eel", 2], ["angler", 1], ["whale", 1]],
    4: [["eel", 3], ["angler", 2], ["whale", 1]],
    5: [["eel", 2], ["angler", 1]],
  };
  const monsters: Monster[] = [];
  g.monsters = monsters;
  for (const [kind, n] of spec[chart]) {
    for (let i = 0; i < n; i++) {
      const t =
        take((t) => dist(t, start) >= 6 && t.type !== "current" && dist(t, gate) >= 2) ??
        take((t) => dist(t, start) >= 4 && t.type !== "current");
      if (t) monsters.push(mkMonster(g, kind, t.q, t.r));
    }
  }
  if (chart === 5) {
    const t =
      take((t) => t.q >= 2 && dist(t, start) >= 8 && t.type !== "current") ??
      take((t) => dist(t, start) >= 6 && t.type !== "current");
    if (t) {
      monsters.push(mkMonster(g, "kraken", t.q, t.r));
    }
  }

  g.tiles = tiles;
  g.shoals = shoals;
  g.p.q = start.q;
  g.p.r = start.r;
  g.stormQ = -R;
  g.turn = 0;
  g.pending = null;
  g.harbor = null;
  g.phase = "sail";
  revealAround(g);
  const c = CHARTS[chart - 1];
  say(g, `— Chart ${chart}: ${c.name} —`, "info");
  say(
    g,
    chart < 5
      ? `Reach the harbor 🗼 in the east and pay the ${LEVY[chart - 1]}g levy.`
      : "Slay the Abyssal Leviathan. There is no harbor beyond the Maw.",
    "info"
  );
}

export function revealAround(g: Game) {
  const v = g.p.vision;
  for (let dq = -v; dq <= v; dq++) {
    for (let dr = -v; dr <= v; dr++) {
      const q = g.p.q + dq;
      const r = g.p.r + dr;
      if (!inBounds(q, r)) continue;
      if (dist(g.p, { q, r }) <= v) g.tiles[key(q, r)].seen = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/* queries used by the UI                                              */
/* ------------------------------------------------------------------ */

export function moveCost(g: Game, q: number, r: number): number | null {
  if (dist(g.p, { q, r }) !== 1) return null;
  const t = tileAt(g, q, r);
  if (!t || t.type === "rock") return null;
  if (monsterAt(g, q, r)) return null;
  if (g.p.piston && (g.p.moves + 1) % 3 === 0) return 0;
  return t.type === "kelp" ? 2 : 1;
}

export function netArea(q: number, r: number): Hex[] {
  return [{ q, r }, ...neighbors(q, r)];
}

export function netTargetOk(g: Game, q: number, r: number): boolean {
  const t = tileAt(g, q, r);
  return !!t && t.type !== "rock" && g.p.nets > 0 && dist(g.p, { q, r }) <= g.p.netRange;
}

export function netPreview(g: Game, q: number, r: number) {
  const area = netArea(q, r);
  let fish = 0;
  let value = 0;
  let monsters = 0;
  let rocks = 0;
  let room = g.p.holdMax - holdUsed(g.p);
  for (const h of area) {
    const t = tileAt(g, h.q, h.r);
    if (t?.type === "rock") rocks++;
    const s = shoalAt(g, h.q, h.r);
    if (s && isVisible(g, h.q, h.r)) {
      const take = Math.min(s.count, room);
      room -= take;
      fish += take;
      value += take * FISH[s.kind].value;
    }
    const m = monsterAt(g, h.q, h.r);
    if (m && m.kind !== "kraken" && isVisible(g, h.q, h.r)) monsters++;
  }
  return { fish, value, monsters, rocks, cost: Math.min(g.p.nets, 1 + Math.min(2, rocks) + (monsters ? 1 : 0)) };
}

export function harpoonTargets(g: Game): { lines: Hex[]; targets: Map<string, Monster> } {
  const lines: Hex[] = [];
  const targets = new Map<string, Monster>();
  if (g.p.harpoons <= 0) return { lines, targets };
  for (const d of DIRS) {
    for (let i = 1; i <= g.p.harpRange; i++) {
      const q = g.p.q + d.q * i;
      const r = g.p.r + d.r * i;
      const t = tileAt(g, q, r);
      if (!t || t.type === "rock") break;
      lines.push({ q, r });
      const m = monsterAt(g, q, r);
      if (m) {
        targets.set(key(q, r), m);
        break;
      }
    }
  }
  return { lines, targets };
}

export function dredgeOk(g: Game, q: number, r: number): boolean {
  const t = tileAt(g, q, r);
  return !!t && t.relic && dist(g.p, { q, r }) <= 1 && g.p.fuel >= 1;
}

/* ------------------------------------------------------------------ */
/* terminal states                                                     */
/* ------------------------------------------------------------------ */

function lose(g: Game, cause: string) {
  if (g.phase === "over" || g.phase === "won") return;
  g.phase = "over";
  g.overCause = cause;
  g.score = computeScore(g);
  say(g, cause, "bad");
  snd(g, "lose");
}

function win(g: Game) {
  g.phase = "won";
  g.score = computeScore(g);
  say(g, "The Abyssal Leviathan sinks into the dark. The sea is yours!", "good");
  snd(g, "win");
}

/* ------------------------------------------------------------------ */
/* damage / kills / loot                                               */
/* ------------------------------------------------------------------ */

function hurtPlayer(g: Game, base: number, who: string, armor = true) {
  const dmg = armor ? Math.max(1, base - g.p.armor) : base;
  g.p.hull -= dmg;
  floatAt(g, g.p, `-${dmg}`, "#ff6b6b");
  addEv(g, { t: "shake", amount: 5 + dmg * 2 });
  addEv(g, { t: "flash", color: "rgba(255,40,40,0.25)" });
  snd(g, "bite");
  say(g, `${who} deals ${dmg} damage!`, "bad");
  if (g.p.hull <= 0) {
    g.p.hull = 0;
    lose(g, `Sunk by ${who.charAt(0).toLowerCase()}${who.slice(1)}.`);
  }
}

function killMonster(g: Game, m: Monster) {
  g.monsters = g.monsters.filter((x) => x.id !== m.id);
  const def = MONSTERS[m.kind];
  const back = Math.min(g.p.maxHarpoons - g.p.harpoons, m.lodged);
  g.p.harpoons += back;
  g.p.gold += def.bounty;
  g.stats.earned += def.bounty;
  g.stats.slain++;
  addEv(g, { t: "ring", q: m.q, r: m.r, color: "#ff9d3c", big: true });
  floatAt(g, m, `+${def.bounty}🪙`, "#ffd45c");
  addEv(g, { t: "shake", amount: m.kind === "kraken" ? 18 : 8 });
  snd(g, "kill");
  say(g, `${def.name} slain! Bounty ${def.bounty}g.${back ? ` ${back} harpoon(s) recovered.` : ""}`, "good");
  if (m.kind === "kraken") win(g);
}

function addGold(g: Game, n: number) {
  g.p.gold += n;
  g.stats.earned += n;
}

function gainRelic(g: Game, id: string) {
  const def = relicById(id);
  def.apply(g.p);
  g.p.relics.push(id);
  g.stats.relics++;
  g.pending = id;
  snd(g, "relic");
  say(g, `Artifact recovered: ${def.name}!`, "good");
}

function unownedRelics(g: Game): string[] {
  return RELICS.filter((r) => !g.p.relics.includes(r.id)).map((r) => r.id);
}

function collectCrate(g: Game) {
  const t = tileAt(g, g.p.q, g.p.r);
  if (!t.crate) return;
  const kind = t.crate;
  t.crate = null;
  const p = g.p;
  const info = CRATE_INFO[kind];
  let txt = "";
  if (kind === "fuel") {
    const n = Math.min(5, p.maxFuel - p.fuel);
    p.fuel += n;
    txt = `+${n} fuel`;
  } else if (kind === "harpoon") {
    const n = Math.min(2, p.maxHarpoons - p.harpoons);
    p.harpoons += n;
    txt = `+${n} harpoons`;
  } else if (kind === "net") {
    const n = Math.min(2, p.maxNets - p.nets);
    p.nets += n;
    txt = `+${n} net`;
  } else if (kind === "hull") {
    const n = Math.min(3, p.maxHull - p.hull);
    p.hull += n;
    txt = `+${n} hull`;
  } else {
    const n = 10 + g.chart * 3;
    addGold(g, n);
    txt = `+${n}g`;
  }
  floatAt(g, p, `${info.icon} ${txt}`, "#9df0a6");
  snd(g, "crate");
  say(g, `Salvaged ${info.label}: ${txt}.`, "good");
}

function enterHarbor(g: Game) {
  const mods = {} as Record<FishKind, number>;
  for (const k of FISH_KINDS) mods[k] = Math.round((0.7 + Math.random() * 0.8) * 100) / 100;
  g.harbor = {
    levyPaid: false,
    mods,
    offers: shuffle(unownedRelics(g)).slice(0, 3),
  };
  g.phase = "harbor";
  snd(g, "click");
  say(g, `Docked at the harbor. The Harbor Master demands ${currentLevy(g)}g.`, "info");
}

function arrive(g: Game) {
  collectCrate(g);
  const t = tileAt(g, g.p.q, g.p.r);
  if (t.special === "gate" && g.chart < 5) enterHarbor(g);
}

/* ------------------------------------------------------------------ */
/* enemy phase                                                         */
/* ------------------------------------------------------------------ */

function freeWater(g: Game, q: number, r: number) {
  const t = tileAt(g, q, r);
  return !!t && t.type !== "rock" && !monsterAt(g, q, r) && !(g.p.q === q && g.p.r === r);
}

function stepToward(g: Game, m: Monster): boolean {
  const cands = neighbors(m.q, m.r).filter((h) => freeWater(g, h.q, h.r));
  if (!cands.length) return false;
  const cur = dist(m, g.p);
  const best = Math.min(...cands.map((h) => dist(h, g.p)));
  if (best >= cur && Math.random() < 0.5) return false;
  const h = pick(cands.filter((c) => dist(c, g.p) === best));
  m.q = h.q;
  m.r = h.r;
  return true;
}

function wander(g: Game, m: Monster, chance: number) {
  if (Math.random() > chance) return;
  const cands = neighbors(m.q, m.r).filter((h) => freeWater(g, h.q, h.r));
  if (!cands.length) return;
  const h = pick(cands);
  m.q = h.q;
  m.r = h.r;
}

function spawnNear(g: Game, kind: MonsterKind, near: Hex): boolean {
  const cands = shuffle(neighbors(near.q, near.r).filter((h) => freeWater(g, h.q, h.r)));
  if (!cands.length) return false;
  const m = mkMonster(g, kind, cands[0].q, cands[0].r);
  m.aware = true;
  m.stun = 1;
  g.monsters.push(m);
  addEv(g, { t: "ring", q: m.q, r: m.r, color: "#c06bff" });
  return true;
}

function enemyPhase(g: Game) {
  for (const m of [...g.monsters]) {
    if (g.phase !== "sail") return;
    if (!g.monsters.includes(m)) continue;
    if (m.stun > 0) {
      m.stun--;
      continue;
    }
    const d = dist(m, g.p);
    const name = MONSTERS[m.kind].name;
    const vis = isVisible(g, m.q, m.r);
    const who = vis ? `The ${name}` : "Something in the dark";
    if (m.kind === "eel") {
      m.aware = d <= (m.aware ? 8 : 5);
      if (d === 1) {
        hurtPlayer(g, MONSTERS.eel.dmg, who);
      } else if (m.aware) stepToward(g, m);
      else wander(g, m, 0.5);
    } else if (m.kind === "angler") {
      if (m.cd > 0) m.cd--;
      if (d === 1) hurtPlayer(g, MONSTERS.angler.dmg, who);
      else if (d === 2 && m.cd === 0) {
        const cands = neighbors(g.p.q, g.p.r).filter((h) => dist(h, m) === 1 && freeWater(g, h.q, h.r));
        if (cands.length) {
          const h = pick(cands);
          g.p.q = h.q;
          g.p.r = h.r;
          m.cd = 2;
          say(g, `${who}'s lure drags you in!`, "warn");
          addEv(g, { t: "ring", q: h.q, r: h.r, color: "#ffd45c" });
          snd(g, "splash");
          arrive(g);
        }
      }
    } else if (m.kind === "whale") {
      if (m.cd > 0) {
        m.cd--;
        continue;
      }
      m.aware = d <= (m.aware ? 9 : 6);
      if (d === 1) {
        hurtPlayer(g, MONSTERS.whale.dmg, who);
        m.cd = 1;
      } else if (m.aware) {
        stepToward(g, m);
        m.cd = 1;
      } else wander(g, m, 0.3);
    } else if (m.kind === "kraken") {
      const enraged = m.hp <= m.maxHp / 2;
      if (d <= 9) m.aware = true;
      if (d <= 2) {
        addEv(g, { t: "ring", q: g.p.q, r: g.p.r, color: "#c06bff", big: true });
        hurtPlayer(g, enraged ? 3 : 2, who);
      } else if (m.aware && (enraged || m.cd <= 0)) {
        stepToward(g, m);
        m.cd = 1;
      } else if (m.cd > 0) m.cd--;
      if (m.aware) m.cd2++;
      if (m.cd2 >= 5 && g.monsters.length < 7 && g.phase === "sail") {
        if (spawnNear(g, "eel", m)) {
          m.cd2 = 0;
          say(g, "The Leviathan hatches an eel!", "warn");
        }
      }
    }
  }
}

function shoalsDrift(g: Game) {
  for (const s of g.shoals) {
    if (Math.random() > 0.35) continue;
    const cands = neighbors(s.q, s.r).filter((h) => {
      const t = tileAt(g, h.q, h.r);
      return t.type !== "rock" && !t.special && !shoalAt(g, h.q, h.r) && !(g.p.q === h.q && g.p.r === h.r);
    });
    if (!cands.length) continue;
    const h = pick(cands);
    s.q = h.q;
    s.r = h.r;
  }
}

function drift(g: Game) {
  const t = tileAt(g, g.p.q, g.p.r);
  if (t.type !== "current") return;
  const d = DIRS[t.dir];
  const nq = g.p.q + d.q;
  const nr = g.p.r + d.r;
  const nt = tileAt(g, nq, nr);
  if (!nt || nt.type === "rock" || monsterAt(g, nq, nr)) return;
  g.p.q = nq;
  g.p.r = nr;
  addEv(g, { t: "ring", q: nq, r: nr, color: "rgba(180,240,255,0.8)" });
  say(g, "The current carries you along.", "info");
  arrive(g);
}

function endTurn(g: Game) {
  drift(g);
  if (g.phase !== "sail") return;
  enemyPhase(g);
  if (g.phase !== "sail") return;
  shoalsDrift(g);
  g.turn++;
  g.stats.turns++;

  const delay = stormDelay(g);
  const interval = STORM_INTERVAL[g.chart - 1];
  if (g.turn >= delay && (g.turn - delay) % interval === 0 && g.stormQ < stormCap(g)) {
    g.stormQ++;
    say(g, "The squall rolls further east...", "warn");
    snd(g, "thunder");
    addEv(g, { t: "flash", color: "rgba(200,190,255,0.3)" });
    addEv(g, { t: "shake", amount: 6 });
  }
  if (g.p.q < g.stormQ) {
    g.p.hull -= 1;
    floatAt(g, g.p, "-1 ⚡", "#c9b6ff");
    addEv(g, { t: "shake", amount: 4 });
    snd(g, "hit");
    if (g.turn % 3 === 0) say(g, "The squall batters your hull!", "bad");
    if (g.p.hull <= 0) {
      g.p.hull = 0;
      lose(g, "Torn apart by the squall.");
      return;
    }
  }

  // stranded check
  const p = g.p;
  if (p.fuel < 1 && holdUsed(p) === 0 && p.hull <= 2) {
    const canNet = p.nets > 0 && g.shoals.some((s) => dist(p, s) <= p.netRange + 1);
    if (!canNet) lose(g, "Adrift with an empty tank and nothing left to burn.");
  }
}

/* ------------------------------------------------------------------ */
/* player actions                                                      */
/* ------------------------------------------------------------------ */

function doMove(g: Game, q: number, r: number) {
  const cost = moveCost(g, q, r);
  if (cost === null) return;
  if (g.p.fuel < cost) {
    say(g, "Not enough fuel! Render fish into oil (5) or burn planks (B).", "warn");
    snd(g, "click");
    return;
  }
  g.p.fuel -= cost;
  g.p.moves++;
  g.p.q = q;
  g.p.r = r;
  snd(g, "sail");
  addEv(g, { t: "ring", q, r, color: "rgba(255,255,255,0.45)" });
  if (cost === 0 && g.p.piston) floatAt(g, g.p, "⚙️ free!", "#ffd45c");
  arrive(g);
  if (g.phase !== "sail") return;
  endTurn(g);
}

function doNet(g: Game, q: number, r: number) {
  if (!netTargetOk(g, q, r)) return;
  const p = g.p;
  const area = netArea(q, r);
  let rocks = 0;
  let stunned = 0;
  for (const h of area) {
    if (tileAt(g, h.q, h.r).type === "rock") rocks++;
    const m = monsterAt(g, h.q, h.r);
    if (m && m.kind !== "kraken") {
      m.stun = 2;
      m.aware = true;
      stunned++;
      floatAt(g, m, "🕸️ tangled!", "#9de0ff");
    }
  }
  const cost = 1 + Math.min(2, rocks) + (stunned ? 1 : 0);
  p.nets = Math.max(0, p.nets - cost);
  let room = p.holdMax - holdUsed(p);
  const got: Record<FishKind, number> = { sardine: 0, tuna: 0, glow: 0 };
  let lost = 0;
  for (const h of area) {
    const s = shoalAt(g, h.q, h.r);
    if (!s) continue;
    const take = Math.min(s.count, room);
    lost += s.count - take;
    room -= take;
    s.count -= take;
    got[s.kind] += take;
  }
  g.shoals = g.shoals.filter((s) => s.count > 0);
  let total = got.sardine + got.tuna + got.glow;
  if (p.lucky && total > 0 && room > 0) {
    got.sardine++;
    total++;
    room--;
  }
  for (const k of FISH_KINDS) p.hold[k] += got[k];
  g.stats.fish += total;
  addEv(g, { t: "ring", q, r, color: "#7fe7ff", big: true });
  snd(g, "splash");
  if (total > 0) {
    const txt = FISH_KINDS.filter((k) => got[k] > 0)
      .map((k) => `+${got[k]}${FISH[k].icon}`)
      .join(" ");
    floatAt(g, { q, r }, txt, "#bdf3ff");
    say(g, `Net hauled in ${total} fish.${lost ? ` ${lost} spilled — hold full!` : ""}`, "good");
  } else {
    say(g, "The net comes up empty.", "info");
  }
  if (rocks) say(g, `The net snagged on rocks (-${Math.min(2, rocks)} extra).`, "warn");
  if (stunned) say(g, `Tangled ${stunned} creature(s) — they thrash for 2 turns!`, "good");
  if (p.nets === 0) say(g, "Your net is shredded! Mend it at harbor.", "warn");
  endTurn(g);
}

function doHarpoon(g: Game, q: number, r: number) {
  const { targets } = harpoonTargets(g);
  const m = targets.get(key(q, r));
  if (!m) return;
  const p = g.p;
  p.harpoons--;
  m.hp -= p.harpDmg;
  m.lodged++;
  m.aware = true;
  addEv(g, { t: "bolt", from: { q: p.q, r: p.r }, to: { q, r } });
  floatAt(g, m, `-${p.harpDmg}`, "#ffb347");
  addEv(g, { t: "shake", amount: 4 });
  snd(g, "harpoon");
  say(g, `Harpoon strikes the ${MONSTERS[m.kind].name} for ${p.harpDmg}.`, "good");
  if (m.hp <= 0) {
    killMonster(g, m);
    if (g.phase !== "sail") return;
  } else if (p.reel && Math.random() < 0.4 && p.harpoons < p.maxHarpoons) {
    p.harpoons++;
    m.lodged--;
    say(g, "The Hemp Reel snaps a harpoon back to you!", "good");
  }
  endTurn(g);
}

function doDredge(g: Game, q: number, r: number) {
  if (!dredgeOk(g, q, r)) return;
  const p = g.p;
  const t = tileAt(g, q, r);
  t.relic = false;
  p.fuel -= 1;
  snd(g, "splash");
  addEv(g, { t: "ring", q, r, color: "#ffd45c", big: true });
  const roll = Math.random();
  const pool = unownedRelics(g);
  if (roll < 0.4 || (roll < 0.65 && !pool.length)) {
    const n = 12 + g.chart * 6 + randInt(0, 10);
    addGold(g, n);
    floatAt(g, { q, r }, `+${n}g`, "#ffd45c");
    snd(g, "coin");
    say(g, `Dredged up salvage worth ${n}g.`, "good");
  } else if (roll < 0.65) {
    gainRelic(g, pick(pool));
  } else if (roll < 0.85) {
    p.fuel = Math.min(p.maxFuel, p.fuel + 6);
    p.harpoons = Math.min(p.maxHarpoons, p.harpoons + 1);
    p.nets = Math.min(p.maxNets, p.nets + 1);
    floatAt(g, { q, r }, "+6⛽ +1🔱 +1🧵", "#9df0a6");
    snd(g, "crate");
    say(g, "A sealed ship's locker: fuel, a harpoon and net twine!", "good");
  } else {
    const n = 10 + g.chart * 3;
    addGold(g, n);
    say(g, `A nest! You grab ${n}g, but something hatches nearby!`, "warn");
    if (!spawnNear(g, "eel", p)) spawnNear(g, "eel", { q, r });
  }
  endTurn(g);
}

function doOil(g: Game) {
  const p = g.p;
  if (p.fuel >= p.maxFuel) {
    say(g, "The tank is already full.", "warn");
    return;
  }
  const kind = FISH_KINDS.find((k) => p.hold[k] > 0);
  if (!kind) {
    say(g, "No fish in the hold to render.", "warn");
    return;
  }
  p.hold[kind]--;
  const gain = Math.min(p.maxFuel - p.fuel, 2 + p.oilBonus);
  p.fuel += gain;
  floatAt(g, p, `+${gain}⛽`, "#ffb347");
  snd(g, "oil");
  say(g, `Rendered a ${FISH[kind].name} into ${gain} fuel.`, "info");
  endTurn(g);
}

function doBurn(g: Game) {
  const p = g.p;
  if (p.hull <= 2) {
    say(g, "The hull is too weak to burn.", "warn");
    return;
  }
  if (p.fuel >= p.maxFuel) {
    say(g, "The tank is already full.", "warn");
    return;
  }
  p.hull -= 2;
  const gain = Math.min(p.maxFuel - p.fuel, 4);
  p.fuel += gain;
  floatAt(g, p, `-2 hull +${gain}⛽`, "#ff9d5c");
  addEv(g, { t: "shake", amount: 6 });
  snd(g, "oil");
  say(g, "You tear planks from the deck to feed the boiler.", "warn");
  endTurn(g);
}

/* ------------------------------------------------------------------ */
/* harbor                                                              */
/* ------------------------------------------------------------------ */

function buyUnits(
  g: Game,
  all: boolean,
  have: number,
  max: number,
  price: number,
  apply: (n: number) => void,
  label: string
) {
  const missing = max - have;
  if (missing <= 0) return;
  const afford = Math.floor(g.p.gold / price);
  const n = Math.min(all ? missing : 1, afford);
  if (n <= 0) return;
  g.p.gold -= n * price;
  apply(n);
  snd(g, "buy");
  say(g, `Bought ${n} ${label} for ${n * price}g.`, "info");
}

function harborBuy(g: Game, item: string) {
  const h = g.harbor;
  if (!h || !h.levyPaid) return;
  const p = g.p;
  const all = item.endsWith("Max");
  const base = item.replace("Max", "").replace("1", "");
  if (base === "fuel") buyUnits(g, all, p.fuel, p.maxFuel, fuelPrice(g), (n) => (p.fuel += n), "fuel");
  else if (base === "hull") buyUnits(g, all, p.hull, p.maxHull, 4, (n) => (p.hull += n), "hull repair");
  else if (base === "net") buyUnits(g, all, p.nets, p.maxNets, 2, (n) => (p.nets += n), "net mending");
  else if (base === "harp") buyUnits(g, all, p.harpoons, p.maxHarpoons, 3, (n) => (p.harpoons += n), "harpoon");
  else if (item.startsWith("up:")) {
    const k = item.slice(3) as keyof typeof UPGRADES;
    if (!UPGRADES[k] || p.upg[k] >= MAX_UPGRADE) return;
    const cost = upgradeCost(g, k);
    if (p.gold < cost) return;
    p.gold -= cost;
    p.upg[k]++;
    if (k === "hold") p.holdMax += 4;
    if (k === "hull") {
      p.maxHull += 2;
      p.hull += 2;
    }
    if (k === "fuel") {
      p.maxFuel += 6;
      p.fuel += 6;
    }
    if (k === "net") {
      p.maxNets += 2;
      p.nets += 2;
    }
    if (k === "rack") {
      p.maxHarpoons += 2;
      p.harpoons += 2;
    }
    snd(g, "buy");
    say(g, `Purchased ${UPGRADES[k].name}.`, "good");
  } else if (item.startsWith("relic:")) {
    const id = item.slice(6);
    if (!h.offers.includes(id)) return;
    const def = relicById(id);
    if (p.gold < def.price) return;
    p.gold -= def.price;
    h.offers = h.offers.filter((x) => x !== id);
    gainRelic(g, id);
  }
}

/* ------------------------------------------------------------------ */
/* reducer                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: "new"; captain: string }
  | { type: "move"; q: number; r: number }
  | { type: "net"; q: number; r: number }
  | { type: "harpoon"; q: number; r: number }
  | { type: "dredge"; q: number; r: number }
  | { type: "oil" }
  | { type: "burn" }
  | { type: "wait" }
  | { type: "ack" }
  | { type: "sell"; kind: FishKind; all: boolean }
  | { type: "levy" }
  | { type: "buy"; item: string }
  | { type: "leave" }
  | { type: "forfeit" }
  | { type: "abandon" };

export function reduce(state: Game, a: Action): Game {
  if (a.type === "new") return createGame(a.captain);
  if (state.phase === "over" || state.phase === "won") return state;
  if (state.pending && a.type !== "ack") return state;

  const g: Game = structuredClone(state);
  g.events = [];
  g.evSeq++;

  if (state.phase === "sail") {
    switch (a.type) {
      case "move":
        doMove(g, a.q, a.r);
        break;
      case "net":
        doNet(g, a.q, a.r);
        break;
      case "harpoon":
        doHarpoon(g, a.q, a.r);
        break;
      case "dredge":
        doDredge(g, a.q, a.r);
        break;
      case "oil":
        doOil(g);
        break;
      case "burn":
        doBurn(g);
        break;
      case "wait":
        say(g, "You hold position and watch the water.", "info");
        endTurn(g);
        break;
      case "abandon":
        lose(g, "You abandoned the voyage.");
        break;
      case "ack":
        g.pending = null;
        break;
    }
    if (g.phase === "sail") revealAround(g);
  } else if (state.phase === "harbor") {
    const h = g.harbor!;
    switch (a.type) {
      case "sell": {
        const n = a.all ? g.p.hold[a.kind] : Math.min(1, g.p.hold[a.kind]);
        if (n > 0) {
          const total = n * sellPrice(g, a.kind);
          g.p.hold[a.kind] -= n;
          addGold(g, total);
          snd(g, "coin");
          say(g, `Sold ${n} ${FISH[a.kind].name} for ${total}g.`, "good");
        }
        break;
      }
      case "levy": {
        const levy = currentLevy(g);
        if (!h.levyPaid && g.p.gold >= levy) {
          g.p.gold -= levy;
          h.levyPaid = true;
          snd(g, "coin");
          say(g, `Levy of ${levy}g paid. The shipwright and dealers will see you.`, "good");
        }
        break;
      }
      case "buy":
        harborBuy(g, a.item);
        break;
      case "ack":
        g.pending = null;
        break;
      case "leave":
        if (h.levyPaid) {
          g.chart++;
          startChart(g);
          snd(g, "sail");
        }
        break;
      case "forfeit":
        lose(g, "Bankrupt — you could not pay the harbor levy.");
        break;
    }
  }
  return g;
}
