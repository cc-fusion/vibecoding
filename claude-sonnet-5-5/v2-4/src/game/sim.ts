import {
  CITIES, clamp, DEATH_LIMIT, DIFFS, DTYPES, MODS, POLICIES, STRAINS, TECHS, TYPE_ORDER, type DType,
} from "./data";
import { pickEvent } from "./events";
import {
  active, addLog, adjTrust, alive, avgPanic, banner, bedsFor, burst, diffOf, flash, floater, floaterAt,
  hasMod, hospitalCost, leak, neighbors, perk, resolveEffective, ring, rnd, sfx, shake, strainOf, totals,
} from "./helpers";
import type { District, Edge, Sim, SimConfig } from "./types";

const INF_PERIOD = 6;
const BASE_R0 = 2.5;
const IMPORT_K = 0.35;
const INC_K = 0.001;
const FOOD_PC = 0.0006;
const pr = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segCross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const o = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function buildCity(cityIdx: number): { districts: District[]; edges: Edge[] } {
  const city = CITIES[cityIdx];
  const rng = mulberry(city.seed * 7919);
  const n = city.count;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let best = { x: 0.5, y: 0.5 }, bestD = -1;
    for (let k = 0; k < 40; k++) {
      const c = { x: 0.07 + rng() * 0.86, y: 0.12 + rng() * 0.76 };
      let md = Infinity;
      for (const p of pts) { const dx = (c.x - p.x) * 1.5, dy = c.y - p.y; md = Math.min(md, dx * dx + dy * dy); }
      if (md > bestD) { bestD = md; best = c; }
    }
    pts.push(best);
  }
  // types: inner list to central points, outer farms/docks to the rim
  const inner: DType[] = ["market", "nobles", "temple", "apothecary", "slums", "university", "slums", "barracks", "market", "slums", "apothecary", "temple", "slums", "university", "barracks", "nobles", "slums"];
  const outerList: DType[] = ["farms", "docks", "farms", "docks", "farms", "farms"];
  const outerCount = Math.max(2, Math.round(n * 0.3));
  const types: DType[] = [...inner.slice(0, n - outerCount), ...outerList.slice(0, outerCount)];
  while (types.length < n) types.push(TYPE_ORDER[types.length % TYPE_ORDER.length]);
  const order = pts.map((p, i) => ({ i, d: Math.hypot((p.x - 0.5) * 1.5, p.y - 0.5) })).sort((a, b) => a.d - b.d);
  const counters: Record<string, number> = {};
  const districts: District[] = [];
  order.forEach((o, rank) => {
    const type = types[rank];
    const info = DTYPES[type];
    const c = counters[type] || 0; counters[type] = c + 1;
    const pop0 = Math.round((3200 * city.popScale * info.pop * (0.85 + rng() * 0.3)) / 10) * 10;
    districts[o.i] = {
      id: o.i, name: info.names[c % info.names.length], type, x: pts[o.i].x, y: pts[o.i].y, pop0,
      S: pop0, E: 0, I: 0, H: 0, R: 0, D: 0, bodies: 0, hosp: 0, beds: 0, build: null,
      quarantine: false, qDays: 0, panic: 4, rumor: 0, hunger: 0, detected: false, seenI: 0, trace: 0, tracedEver: false,
      addrCd: 0, disCd: 0, cureCd: 0, disinfect: 0, deathsEma: 0, deathAcc: 0, srcLocal: 0, srcFrom: {},
      cured: 0, peakI: 0, pulse: 0, fleeCd: 0, edges: [],
    };
  });
  // edges: MST + planar extras
  const pairs: { a: number; b: number; len: number }[] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    pairs.push({ a, b, len: Math.hypot((pts[a].x - pts[b].x) * 1.5, pts[a].y - pts[b].y) });
  }
  pairs.sort((p, q) => p.len - q.len);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const chosen: { a: number; b: number }[] = [];
  const has = new Set<string>();
  for (const p of pairs) {
    if (find(p.a) !== find(p.b)) { parent[find(p.a)] = find(p.b); chosen.push(p); has.add(`${p.a}-${p.b}`); }
  }
  const deg = new Array(n).fill(0);
  chosen.forEach((c) => { deg[c.a]++; deg[c.b]++; });
  let extras = Math.floor(n * 0.55);
  for (const p of pairs) {
    if (extras <= 0) break;
    if (has.has(`${p.a}-${p.b}`) || p.len > 0.42 || deg[p.a] >= 4 || deg[p.b] >= 4) continue;
    if (chosen.some((c) => c.a !== p.a && c.a !== p.b && c.b !== p.a && c.b !== p.b && segCross(pts[p.a], pts[p.b], pts[c.a], pts[c.b]))) continue;
    chosen.push(p); has.add(`${p.a}-${p.b}`); deg[p.a]++; deg[p.b]++; extras--;
  }
  const edges: Edge[] = chosen.map((c, id) => {
    let traffic = 0.45 + rng() * 0.55;
    const ta = districts[c.a].type, tb = districts[c.b].type;
    if (ta === "market" || ta === "docks" || tb === "market" || tb === "docks") traffic = Math.min(1, traffic * 1.2);
    districts[c.a].edges.push(id); districts[c.b].edges.push(id);
    return { id, a: c.a, b: c.b, traffic, closed: false, fab: 0, fba: 0, accAB: 0, accBA: 0, revealed: false };
  });
  return { districts, edges };
}

export function createSim(cfg: SimConfig): Sim {
  const city = CITIES[cfg.cityIdx];
  const diff = DIFFS.find((d) => d.id === cfg.diffId) || DIFFS[1];
  const { districts, edges } = buildCity(cfg.cityIdx);
  const pk = (id: string) => cfg.perks[id] || 0;
  const poor = cfg.mods.includes("poor") ? 0.5 : 1;
  const seedTypes: DType[][] = [["slums"], ["docks"], ["slums", "docks"], ["docks", "slums"]];
  const seeds: District[] = [];
  for (const t of seedTypes[cfg.cityIdx] || ["slums"]) {
    const c = districts.find((d) => d.type === t && !seeds.includes(d));
    if (c && seeds.length < city.seeds) seeds.push(c);
  }
  while (seeds.length < city.seeds) { const c = districts.find((d) => !seeds.includes(d)); if (c) seeds.push(c); else break; }
  seeds.forEach((d, i) => {
    const inf = i === 0 ? 6 : 4, ex = i === 0 ? 4 : 3;
    d.S -= inf + ex; d.I += inf; d.E += ex;
  });
  seeds[0].detected = true; seeds[0].seenI = 6;
  const pop0 = districts.reduce((a, d) => a + d.pop0, 0);
  const s: Sim = {
    cfg, rs: city.seed * 1013 + cfg.diffId.length * 31 + Math.floor(Math.random() * 1e6),
    time: 0, day: 0, districts, edges,
    funds: Math.round((300 + 120 * pk("purse")) * poor * (0.9 + 0.1 * diff.res)),
    food: Math.round((70 + 20 * pk("guild")) * diff.res), med: 40 + 25 * pk("guild"), rp: 0,
    trust: Math.min(100, 65 + 8 * pk("faith")),
    rates: { income: 0, upkeep: 0, food: 0, med: 0, rp: 0 },
    foodRatio: 1, broke: false,
    research: { current: null, progress: 0, partial: {} },
    techs: {}, policies: {}, teamsMax: 2 + pk("tracers"),
    strain: 0, mutMult: 1, bossDay: diff.bossDay - (cfg.mods.includes("mutating") ? 4 : 0),
    bossEmerged: false, bossPulled: false, bossOrigin: [], bossStartActive: 0,
    selected: { kind: null, id: -1 }, speed: 1, paused: true,
    pendingEvent: null, eventTimer: cfg.tutorial ? 10 : 6, eventLast: {}, temp: {},
    log: [], history: [],
    stats: {
      peakActive: 0, totalInfected: 0, recovered: 0, hospBuilt: 0, quarantines: 0, traces: 0, events: 0,
      minTrust: 100, researchDone: 0, riots: 0, cures: 0, addresses: 0, disinfects: 0, roadsClosed: 0, peakPanic: 0,
    },
    over: null,
    vis: { particles: [], floaters: [], rings: [], shake: 0, flash: 0, flashColor: "#ff0000", banner: "", bannerSub: "", bannerT: 0, bannerColor: "#fff" },
    sfxQueue: [], flags: {}, tutStep: 0, pop0, lastBell: -1, sporeT: 0, seedId: seeds[0].id,
  };
  s.stats.minTrust = s.trust;
  for (const d of districts) d.beds = bedsFor(s, d);
  addLog(s, `Plague reported in ${seeds[0].name}. The council looks to you, Doctor.`, "warn");
  s.history.push({ day: 0, actual: seeds.reduce((a, d) => a + active(d), 0), seen: 6, dead: 0, panic: 4, trust: s.trust });
  return s;
}

/* ---------------------------------------------------------------- simulation step */
export function step(s: Sim, dt: number) {
  if (s.over) return;
  const diff = diffOf(s);
  const strain = strainOf(s);
  const D = s.districts;
  const n = D.length;
  s.time += dt;

  const prev = new Array<number>(n), pan = new Array<number>(n), rum = new Array<number>(n), leaks = new Array<number>(n);
  const hl = s.techs.wards ? 0.015 : 0.06;
  for (const d of D) {
    const a = alive(d);
    prev[d.id] = a > 1 ? (d.I + 0.35 * d.E + hl * d.H + 0.03 * d.bodies) / a : 0;
    pan[d.id] = d.panic; rum[d.id] = d.rumor;
    leaks[d.id] = d.quarantine ? leak(s, d) : 1;
  }
  const maskOn = s.policies.masks && s.techs.masks;
  const gMul = diff.r0 * strain.r * s.mutMult * (maskOn ? 0.75 : 1) * (s.policies.curfew ? 0.82 : 1) * ((s.temp.rats || 0) > 0 ? 1.12 : 1);
  const traceMul = s.techs.registry ? 0.7 : 0.85;
  const rumorMill = hasMod(s, "rumor");
  const fog = hasMod(s, "fog");
  let deathsStep = 0, recStep = 0, newInfStep = 0, hospNow = 0, bedsNow = 0, infNow = 0;

  for (const d of D) {
    const info = DTYPES[d.type];
    d.beds = bedsFor(s, d);
    d.addrCd = Math.max(0, d.addrCd - dt); d.disCd = Math.max(0, d.disCd - dt);
    d.cureCd = Math.max(0, d.cureCd - dt); d.disinfect = Math.max(0, d.disinfect - dt);
    d.fleeCd = Math.max(0, d.fleeCd - dt);
    if (d.quarantine) d.qDays += dt;
    if (d.build) {
      d.build.left -= dt;
      if (d.build.left <= 0) {
        d.hosp = d.build.level; d.build = null; d.beds = bedsFor(s, d);
        s.stats.hospBuilt++; sfx(s, "build"); d.pulse = 1;
        floaterAt(s, d, `✚ Hospital L${d.hosp}`, "#8fcf74", 15);
        burst(s, d.x, d.y, "#8fcf74", 18); addLog(s, `${d.name}: hospital level ${d.hosp} opens (${d.beds} beds).`, "good");
      }
    }
    const a = alive(d);
    if (a < 1) continue;

    /* --- transmission --- */
    const dens = info.density * (s.techs.sewers && d.type === "slums" ? 0.85 : 1);
    const trMul = d.trace > 0 ? traceMul : 1;
    const disMul = d.disinfect > 0 ? 0.78 : 1;
    const beta = (BASE_R0 / INF_PERIOD) * gMul * dens * trMul * disMul;
    const local = beta * d.S * prev[d.id] * dt;
    const contrib: { nid: number; amt: number; ei: number }[] = [];
    let imp = 0;
    for (const ei of d.edges) {
      const e = s.edges[ei];
      const nid = e.a === d.id ? e.b : e.a;
      const nd = D[nid];
      const open = (e.closed ? 0.04 : 1) * leaks[d.id] * leaks[nid];
      const mobF = ((info.mobility + DTYPES[nd.type].mobility) / 2) * (1 + (d.panic + nd.panic) / 400);
      const amt = IMPORT_K * e.traffic * open * mobF * prev[nid] * d.S * dt * gMul * trMul;
      if (amt > 0) { contrib.push({ nid, amt, ei }); imp += amt; }
    }
    let total = local + imp;
    const cap = d.S * 0.95;
    const scale = total > cap && total > 0 ? cap / total : 1;
    total *= scale;
    d.srcLocal += local * scale;
    for (const c of contrib) {
      const amt = c.amt * scale;
      d.srcFrom[c.nid] = (d.srcFrom[c.nid] || 0) + amt;
      const e = s.edges[c.ei];
      if (c.nid === e.a) e.accAB += amt; else e.accBA += amt;
    }

    /* --- progression --- */
    const dEI = d.E * pr(1 / strain.incub, dt);
    const free = Math.max(0, d.beds - d.H);
    const admit = d.hosp > 0 ? Math.min(d.I * pr(s.techs.wards ? 0.5 : 0.35, dt), free) : 0;
    const outI = (d.I - admit) * pr(1 / INF_PERIOD, dt);
    const mortI = Math.min(0.9, 0.32 * diff.mort * strain.mort * (1 + d.hunger * 0.5));
    const dieI = outI * mortI, recI = outI - dieI;
    const outH = d.H * pr(1 / 5, dt);
    const mortH = Math.min(0.9, mortI * (s.med > 0 ? 0.45 : 0.9) * (s.techs.poultice ? 0.75 : 1) * (s.techs.wards ? 0.85 : 1));
    const dieH = outH * mortH, recH = outH - dieH;
    d.S -= total; d.E += total - dEI; d.I += dEI - admit - outI; d.H += admit - outH;
    d.R += recI + recH; d.D += dieI + dieH; d.bodies += dieI + dieH;
    if (d.E < 0) d.E = 0; if (d.I < 0) d.I = 0; if (d.H < 0) d.H = 0; if (d.S < 0) d.S = 0;
    const act = d.E + d.I + d.H;
    if (act > 0 && act < 0.4) { d.R += act; d.E = 0; d.I = 0; d.H = 0; }

    const dd = dieI + dieH;
    deathsStep += dd; recStep += recI + recH; newInfStep += total;
    d.deathAcc += dd;
    d.deathsEma += (dd / dt - d.deathsEma) * Math.min(1, dt * 0.6);
    d.peakI = Math.max(d.peakI, d.I + d.H);
    hospNow += d.H; bedsNow += d.beds; infNow += d.I + d.H;
    d.bodies = Math.max(0, d.bodies - d.bodies * pr(0.05 + (s.techs.sewers ? 0.05 : 0) + (s.policies.carts && !s.broke ? 0.45 : 0), dt));

    if (d.deathAcc >= Math.max(8, d.pop0 * 0.003)) {
      floaterAt(s, d, `† ${Math.round(d.deathAcc)}`, "#b8b0a0", 15);
      ring(s, d.x, d.y, "rgba(180,170,150,0.7)", 0.05);
      if (s.time - s.lastBell > 0.25) { s.lastBell = s.time; sfx(s, "bell"); shake(s, 3); }
      d.deathAcc = 0;
    }

    /* --- panic, rumour, hunger --- */
    const nbs = neighbors(s, d);
    let nbP = 0, nbR = 0;
    for (const nb of nbs) { nbP += pan[nb.id]; nbR += rum[nb.id]; }
    if (nbs.length) { nbP /= nbs.length; nbR /= nbs.length; }
    const aliveNow = Math.max(1, alive(d));
    let target = ((d.I + d.H) / aliveNow) * 260 + (d.deathsEma / aliveNow) * 4000 + (d.bodies / aliveNow) * 600 + d.rumor * 0.4 + d.hunger * 45
      + (d.quarantine ? 10 : 0) + nbP * (rumorMill ? 0.35 : 0.2) + (s.policies.rations ? 6 : 0) + (s.policies.curfew ? 4 : 0) + (s.bossEmerged ? 5 : 0);
    if (d.type === "temple") target -= 10; else if (nbs.some((x) => x.type === "temple")) target -= 4;
    if (d.type === "barracks") target -= 5;
    target = clamp(target, 0, 100);
    d.panic += (target - d.panic) * Math.min(1, dt * 0.5);
    d.rumor = clamp(d.rumor + dt * ((rumorMill ? 0.5 : 0.25) * (nbR - d.rumor) + Math.max(0, d.panic - 70) * 0.05 + (rumorMill ? 0.15 : 0) - (1.2 + (s.techs.pulpit ? 1.2 : 0))), 0, 100);
    const ht = clamp((1 - s.foodRatio) * (d.quarantine ? 1.5 : 0.8), 0, 1);
    d.hunger += (ht - d.hunger) * Math.min(1, dt * 0.3);

    /* --- flight --- */
    if (d.panic > 65 && nbs.length) {
      let f = ((d.panic - 65) / 35) * 0.035 * dt;
      if (d.quarantine) f *= Math.min(1, leaks[d.id] * 1.5);
      let bestE: Edge | null = null, bestP = Infinity;
      for (const ei of d.edges) {
        const e = s.edges[ei];
        if (e.closed && Math.random() > 0.1) continue;
        const nid = e.a === d.id ? e.b : e.a;
        if (prev[nid] < bestP) { bestP = prev[nid]; bestE = e; }
      }
      if (bestE && f > 0) {
        const nid = bestE.a === d.id ? bestE.b : bestE.a;
        const nd = D[nid];
        const mS = d.S * f, mE = d.E * f, mI = d.I * f;
        d.S -= mS; d.E -= mE; d.I -= mI; nd.S += mS; nd.E += mE; nd.I += mI;
        if (bestE.a === nid) bestE.accBA += mE + mI; else bestE.accAB += mE + mI;
        if (mE + mI > 0.5 && d.fleeCd <= 0) { floaterAt(s, d, "Flight!", "#e0a53f", 13); d.fleeCd = 3; }
      }
    }

    /* --- detection --- */
    const detMult = (1 + (s.techs.logs ? 0.5 : 0)) * (s.techs.assays ? 1.8 : 1) * (fog ? 0.55 : 1) * (1 - d.rumor / 150) * (d.hosp > 0 ? 2.5 : 1);
    if (!d.detected) {
      const pd = 1 - Math.exp(-detMult * 0.02 * (d.I + d.H + 0.3 * d.E) * dt);
      if ((d.I + d.H > 0.5 && rnd(s) < pd) || d.D >= 4) {
        d.detected = true; d.pulse = 1;
        addLog(s, `Cases confirmed in ${d.name}.`, "warn");
        floaterAt(s, d, "📣 Cases confirmed", "#ff8a6a", 14);
        ring(s, d.x, d.y, "rgba(255,120,90,0.8)", 0.08); sfx(s, "alert");
      }
    }
    if (d.detected) {
      const exact = d.I + d.H + d.E;
      if (d.trace > 0) d.seenI = exact;
      else {
        const noise = 1 + (s.techs.assays ? 0.08 : 0.3) * Math.sin(s.time * 0.7 + d.id * 2.1);
        const tgt = (d.I + d.H + (s.techs.serology ? d.E : 0)) * noise;
        d.seenI += (tgt - d.seenI) * Math.min(1, dt * (0.4 * detMult + 0.1));
      }
    }

    /* --- contact tracing: reveals the transmission graph --- */
    if (d.trace > 0) {
      d.trace = Math.max(0, d.trace - dt);
      for (const ei of d.edges) {
        const e = s.edges[ei];
        if (e.fab + e.fba < 0.4) continue;
        if (!e.revealed) e.revealed = true;
        const nid = e.a === d.id ? e.b : e.a;
        const nd = D[nid];
        if (!nd.detected && alive(nd) > 1) {
          nd.detected = true; nd.pulse = 1;
          addLog(s, `Contact tracing from ${d.name} uncovers hidden cases in ${nd.name}.`, "warn");
          floaterAt(s, nd, "🕸️ Traced", "#55b3b0", 14); ring(s, nd.x, nd.y, "rgba(85,179,176,0.8)", 0.08); sfx(s, "alert");
        }
      }
      if (d.trace <= 0) { floaterAt(s, d, "Trace complete", "#55b3b0", 13); addLog(s, `Trace in ${d.name} complete.`, "info"); }
    }
  }

  /* --- edge flow smoothing --- */
  for (const e of s.edges) {
    e.fab += (e.accAB / dt - e.fab) * Math.min(1, dt * 1.2);
    e.fba += (e.accBA / dt - e.fba) * Math.min(1, dt * 1.2);
    e.accAB = 0; e.accBA = 0;
  }
  for (const k of Object.keys(s.temp)) s.temp[k] = Math.max(0, s.temp[k] - dt);

  /* --- economy --- */
  const scarce = hasMod(s, "scarcity") ? 0.7 : 1;
  let income = 0, foodProd = 0, foodCons = 0, medProd = 0, rpRate = 2, upkeep = 0, qDrain = 0, traceN = 0, qN = 0;
  for (const d of D) {
    const info = DTYPES[d.type];
    const a = alive(d);
    const work = clamp((d.S + d.E + d.R) / Math.max(1, d.pop0), 0, 1.2) * (1 - d.panic / 160) * (1 - d.hunger * 0.3);
    foodCons += a * FOOD_PC * (s.policies.rations ? 0.72 : 1);
    if (!d.quarantine) {
      income += a * info.income * INC_K * work * (0.5 + s.trust / 200) * (s.policies.curfew ? 0.65 : 1);
      foodProd += info.food * work * scarce;
      medProd += info.med * work * (s.techs.gardens ? 1.6 : 1) * scarce;
      rpRate += info.research * work;
    } else { qN++; qDrain += 0.25 * (1 + d.panic / 100); }
    upkeep += d.hosp * 2;
    if (d.trace > 0) traceN++;
  }
  income *= diff.res; foodProd *= diff.res;
  medProd = (0.8 + medProd) * diff.res * (hasMod(s, "scarcity") ? 0.85 : 1);
  rpRate *= 1 + 0.12 * perk(s, "scholar");
  if (maskOn) upkeep += 3;
  if (s.policies.carts) upkeep += 4;
  upkeep += traceN * 1.5 + qN * 1.2;
  qDrain *= (s.techs.protocols ? 0.6 : 1) * (1 - 0.12 * perk(s, "watchp"));
  const medUse = hospNow * 0.012 * (s.techs.poultice ? 0.8 : 1);
  s.rates = { income, upkeep, food: foodProd - foodCons, med: medProd - medUse, rp: rpRate };

  s.funds += (income - upkeep) * dt;
  if (s.funds <= 0) {
    s.funds = 0;
    if (income - upkeep < 0) {
      if (!s.broke) addLog(s, "The treasury is empty! Costly policies lapse.", "bad");
      s.broke = true;
      if (s.policies.carts) { s.policies.carts = false; addLog(s, "Corpse carts disbanded - no wages.", "bad"); }
      else if (s.policies.masks) { s.policies.masks = false; addLog(s, "Mask Edict lapsed - no funds.", "bad"); }
    }
  } else if (s.funds > 15) s.broke = false;

  s.food += (foodProd - foodCons) * dt;
  if (s.food <= 0) { s.food = 0; s.foodRatio = foodCons > 0 ? clamp(foodProd / foodCons, 0, 1) : 1; } else s.foodRatio = 1;
  s.med = Math.max(0, s.med + (medProd - medUse) * dt);

  /* --- research --- */
  s.rp += rpRate * dt;
  if (s.research.current) {
    s.research.progress += s.rp; s.rp = 0;
    const tech = TECHS.find((t) => t.id === s.research.current);
    if (tech && s.research.progress >= tech.cost) {
      s.rp += s.research.progress - tech.cost;
      s.techs[tech.id] = true; s.research.current = null; s.research.progress = 0;
      s.stats.researchDone++;
      s.teamsMax = 2 + perk(s, "tracers") + (s.techs.registry ? 1 : 0);
      addLog(s, `Research complete: ${tech.name}.`, "good");
      banner(s, "Research Complete", `${tech.icon} ${tech.name}`, "#8fcf74");
      sfx(s, "research"); flash(s, "#8fcf74", 0.15);
    }
  }

  /* --- trust --- */
  const cov = clamp(bedsNow / Math.max(20, infNow), 0, 1);
  let dTrust = 0.0015 * recStep - 0.006 * deathsStep;
  dTrust += dt * (0.2 * cov - qDrain - (1 - s.foodRatio) * 3 - (s.broke ? 0.5 : 0) - Math.max(0, avgPanic(s) - 55) * 0.02 - (s.policies.curfew ? 0.12 : 0) - (s.policies.rations ? 0.08 : 0));
  adjTrust(s, dTrust);

  s.stats.totalInfected += newInfStep;
  s.stats.recovered += recStep;

  /* --- riots (checked continuously, low odds) --- */
  for (const d of D) {
    if (d.panic > 88 && alive(d) > 50 && rnd(s) < dt * 0.06 * (neighbors(s, d).some((x) => x.type === "barracks") ? 0.5 : 1)) {
      d.panic = 70; s.stats.riots++;
      const wasQ = d.quarantine; d.quarantine = false;
      adjTrust(s, -4); shake(s, 14); flash(s, "#ff7a2a", 0.3); sfx(s, "alert");
      floaterAt(s, d, "🔥 RIOT", "#ff7a2a", 18); burst(s, d.x, d.y, "#ff7a2a", 30, 0.18);
      addLog(s, `Riot in ${d.name}!${wasQ ? " The quarantine is broken." : ""}`, "bad");
    }
  }

  while (s.time >= s.day + 1) { s.day++; dailyTick(s); }
  checkEnd(s);
}

function dailyTick(s: Sim) {
  const t = totals(s);
  s.stats.peakActive = Math.max(s.stats.peakActive, t.active);
  s.stats.peakPanic = Math.max(s.stats.peakPanic, avgPanic(s));
  s.history.push({ day: s.day, actual: t.active, seen: t.seen, dead: t.dead, panic: avgPanic(s), trust: s.trust });

  s.eventTimer -= 1;
  if (s.eventTimer <= 0 && !s.pendingEvent) {
    const ev = pickEvent(s);
    if (ev) {
      s.pendingEvent = ev; sfx(s, "event");
      s.eventTimer = (6 + rnd(s) * 6) * (hasMod(s, "rumor") ? 0.8 : 1) * (s.cfg.tutorial && s.day < 20 ? 1.5 : 1);
    } else s.eventTimer = 2;
  }

  if (hasMod(s, "mutating") && s.day % 10 === 0 && !s.bossEmerged) {
    s.mutMult = clamp(1 + (rnd(s) - 0.4) * 0.3, 0.9, 1.3);
    addLog(s, s.mutMult > 1.05 ? "The strain drifts: it spreads faster." : "The strain drifts: it weakens slightly.", s.mutMult > 1.05 ? "warn" : "info");
  }

  if (s.strain === 0 && s.day >= Math.floor(s.bossDay * 0.5) && !s.bossEmerged && !s.bossPulled) {
    s.strain = 1;
    for (const d of s.districts) { const loss = d.R * STRAINS[1].escape; d.R -= loss; d.S += loss; }
    banner(s, "Pneumonic Shift", "The plague has mutated: faster incubation, deadlier lungs.", "#e0a53f");
    addLog(s, "The plague mutates into the Pneumonic strain. Some of the recovered are vulnerable again.", "bad");
    shake(s, 10); flash(s, "#e0a53f", 0.25); sfx(s, "alert");
  }

  if (!s.bossEmerged && !s.bossPulled && s.day >= 10 && t.active < 1) {
    s.bossPulled = true; s.bossDay = Math.min(s.bossDay, s.day + 3);
    banner(s, "The Plague Stirs", "A dormant mutation wakes beneath the city. The Crimson Mutation arrives in 3 days.", "#ff6a4a");
    addLog(s, "No cases remain - but something is stirring in the sewers. The Crimson Mutation approaches.", "warn");
    sfx(s, "boss");
  }
  if (!s.bossEmerged && s.day >= s.bossDay) emergeBoss(s);
}

function emergeBoss(s: Sim) {
  s.bossEmerged = true; s.strain = 2;
  const esc = STRAINS[2].escape * (s.techs.adaptive ? 0.5 : 1);
  for (const d of s.districts) { const loss = d.R * esc; d.R -= loss; d.S += loss; }
  const cands = [...s.districts].sort((a, b) => DTYPES[b.type].mobility * (0.8 + rnd(s) * 0.4) - DTYPES[a.type].mobility * (0.8 + rnd(s) * 0.4)).slice(0, 2);
  s.bossOrigin = cands.map((c) => c.id);
  for (const c of cands) {
    const seed = Math.min(c.S, 10); c.S -= seed; c.E += seed; c.pulse = 1;
    burst(s, c.x, c.y, "#ff3b2a", 36, 0.2); ring(s, c.x, c.y, "rgba(255,59,42,0.9)", 0.12);
    floaterAt(s, c, "☠ CRIMSON", "#ff3b2a", 18);
  }
  banner(s, "THE CRIMSON MUTATION", "The plague has changed. It spreads faster, kills harder, and many recovered are vulnerable again.", "#ff3b2a");
  addLog(s, "THE CRIMSON MUTATION has emerged. Eradicate it to save the city.", "bad");
  shake(s, 24); flash(s, "#ff1a1a", 0.5); sfx(s, "boss");
  s.bossStartActive = totals(s).active;
  s.stats.peakActive = Math.max(s.stats.peakActive, s.bossStartActive);
}

function checkEnd(s: Sim) {
  if (s.over) return;
  const t = totals(s);
  if (s.trust <= 0) {
    s.over = { win: false, title: "The City Revolts", reason: "Trust has collapsed. The mob drags you from the lazaret, and the quarantine ends in flames." };
  } else if (t.alive / s.pop0 < 1 - DEATH_LIMIT) {
    s.over = { win: false, title: "The City Falls Silent", reason: "Too many have died. The survivors scatter and the plague takes whatever remains." };
  } else if (s.bossEmerged && t.active < 1 && s.day >= s.bossDay + 2) {
    s.over = { win: true, title: "The Plague Is Ended", reason: "No new cases for days. Bells ring across the city as the last quarantine banner comes down." };
  }
  if (s.over) {
    sfx(s, s.over.win ? "win" : "lose");
    addLog(s, s.over.title, s.over.win ? "good" : "bad");
    s.paused = true;
  }
}

/* ---------------------------------------------------------------- visual FX (real time) */
export function updateFx(s: Sim, rdt: number) {
  const v = s.vis;
  for (const p of v.particles) { p.x += p.vx * rdt; p.y += p.vy * rdt; p.life -= rdt; }
  v.particles = v.particles.filter((p) => p.life > 0);
  for (const f of v.floaters) { f.y -= 0.035 * rdt; f.life -= rdt; }
  v.floaters = v.floaters.filter((f) => f.life > 0);
  for (const r of v.rings) { r.r += 0.12 * rdt; r.life -= rdt; }
  v.rings = v.rings.filter((r) => r.life > 0);
  v.shake *= Math.pow(0.02, rdt);
  if (v.shake < 0.05) v.shake = 0;
  v.flash = Math.max(0, v.flash - rdt * 1.2);
  v.bannerT = Math.max(0, v.bannerT - rdt);
  s.sporeT -= rdt;
  for (const d of s.districts) d.pulse = Math.max(0, d.pulse - rdt * 1.1);
  if (s.sporeT <= 0 && !s.paused) {
    s.sporeT = 0.14;
    for (const d of s.districts) {
      if ((!d.detected && d.trace <= 0) || d.I < 3 || v.particles.length > 380) continue;
      const k = Math.min(3, Math.log10(d.I + 1));
      if (Math.random() < k * 0.35) {
        const a = Math.random() * Math.PI * 2;
        v.particles.push({ x: d.x + Math.cos(a) * 0.015, y: d.y + Math.sin(a) * 0.02, vx: Math.cos(a) * 0.015, vy: -0.01 - Math.random() * 0.02, life: 1.4, max: 1.4, color: s.bossEmerged ? "#ff4a3a" : "#9fd86a", size: 1.5 + Math.random() * 1.5 });
      }
    }
  }
}

/* ---------------------------------------------------------------- player actions */
const spend = (s: Sim, n: number) => { if (s.funds < n) return false; s.funds -= n; return true; };
const need = (n: number) => `Need ${n} funds`;

export function selectDistrict(s: Sim, id: number) {
  s.selected = { kind: "d", id };
  if (id === s.seedId) s.flags.selectedSeed = true;
  s.flags.selected = true;
  sfx(s, "select");
}
export function selectEdge(s: Sim, id: number) { s.selected = { kind: "e", id }; sfx(s, "select"); }
export function deselect(s: Sim) { s.selected = { kind: null, id: -1 }; }

export function toggleQuarantine(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (d.quarantine) {
    d.quarantine = false; d.qDays = 0; sfx(s, "ok"); floaterAt(s, d, "Unsealed", "#8fcf74");
    addLog(s, `${d.name} is unsealed.`, "info"); return null;
  }
  if (!spend(s, 30)) return need(30);
  d.quarantine = true; d.qDays = 0; s.stats.quarantines++; s.flags.quarantined = true;
  sfx(s, "seal"); shake(s, 5); d.pulse = 1; ring(s, d.x, d.y, "rgba(255,150,70,0.8)", 0.07);
  floaterAt(s, d, "🔒 Sealed", "#ff9a4a", 15); addLog(s, `${d.name} is sealed. Guards man the barricades.`, "warn");
  return null;
}

export function buildHospital(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (d.build) return "Already under construction";
  if (d.hosp >= 3) return "Hospital is at maximum level";
  const cost = hospitalCost(s, d);
  if (!spend(s, cost)) return need(cost);
  d.build = { level: d.hosp + 1, left: 3 }; s.flags.hospital = true;
  sfx(s, "build"); floaterAt(s, d, `-${cost} 🪙`, "#e0a53f"); burst(s, d.x, d.y, "#e0a53f", 10);
  addLog(s, `Construction of a level ${d.hosp + 1} hospital begins in ${d.name}.`, "info");
  return null;
}

export function startTrace(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (d.trace > 0) { d.trace = 0; sfx(s, "click"); return null; }
  if (s.districts.filter((x) => x.trace > 0).length >= s.teamsMax) return `All ${s.teamsMax} tracer teams are deployed`;
  if (!spend(s, 20)) return need(20);
  d.trace = s.techs.registry ? 9 : 6; d.tracedEver = true; d.detected = true;
  s.stats.traces++; s.flags.traced = true; sfx(s, "trace"); d.pulse = 1;
  floaterAt(s, d, "🔍 Tracing", "#55b3b0", 15); ring(s, d.x, d.y, "rgba(85,179,176,0.8)", 0.07);
  addLog(s, `Tracer team dispatched to ${d.name}.`, "info");
  return null;
}

export function publicAddress(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (d.addrCd > 0) return `Cooling down (${d.addrCd.toFixed(1)}d)`;
  if (!spend(s, 15)) return need(15);
  const pot = 22 * (1 + 0.5 * (s.techs.pulpit ? 1 : 0)) * (1 + 0.25 * perk(s, "whisper"));
  d.panic = clamp(d.panic - pot, 0, 100); d.rumor = clamp(d.rumor - pot * 0.7, 0, 100);
  for (const nb of neighbors(s, d)) nb.panic = clamp(nb.panic - pot * 0.4, 0, 100);
  d.addrCd = 6; adjTrust(s, 0.8); s.stats.addresses++; s.flags.addressed = true;
  sfx(s, "calm"); floaterAt(s, d, `Calm -${Math.round(pot)}`, "#8fc7ff", 14); ring(s, d.x, d.y, "rgba(143,199,255,0.7)", 0.07);
  return null;
}

export function disinfect(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (d.disCd > 0) return `Cooling down (${d.disCd.toFixed(1)}d)`;
  if (s.funds < 25) return need(25);
  if (s.med < 3) return "Need 3 medicine";
  s.funds -= 25; s.med -= 3;
  d.bodies *= 0.2; d.disinfect = 8; d.disCd = 8; d.panic = clamp(d.panic - 5, 0, 100);
  s.stats.disinfects++; s.flags.disinfected = true;
  sfx(s, "build"); burst(s, d.x, d.y, "#c8e6a0", 20, 0.1); floaterAt(s, d, "🧴 Disinfected", "#c8e6a0", 14);
  return null;
}

export function cureEffect(s: Sim): number {
  return resolveEffective(s) * (s.strain === 2 && !s.techs.adaptive ? 0.5 : 1);
}
export function cureCost(d: District): number { return Math.max(2, Math.round(alive(d) * 0.006)); }

export function administerCure(s: Sim, id: number): string | null {
  const d = s.districts[id];
  if (!d) return "No district selected";
  if (!s.techs.prototype) return "Research Cure Prototype first";
  if (d.cureCd > 0) return `Cooling down (${d.cureCd.toFixed(1)}d)`;
  const cost = cureCost(d);
  if (s.med < cost) return `Need ${cost} medicine`;
  const eff = cureEffect(s);
  s.med -= cost;
  const inf = (d.E + d.I + d.H) * eff, sus = d.S * eff * 0.6;
  d.E -= d.E * eff; d.I -= d.I * eff; d.H -= d.H * eff; d.S -= sus; d.R += inf + sus;
  d.cured += inf + sus; d.cureCd = 5; s.stats.cures++; s.flags.cured = true;
  d.panic = clamp(d.panic - 15, 0, 100); adjTrust(s, 1.5);
  sfx(s, "cure"); burst(s, d.x, d.y, "#9fe8ff", 34, 0.16); ring(s, d.x, d.y, "rgba(159,232,255,0.9)", 0.1);
  floaterAt(s, d, `💉 ${Math.round(inf + sus)} cured`, "#9fe8ff", 15); flash(s, "#9fe8ff", 0.15);
  addLog(s, `The cure is administered in ${d.name} (${Math.round(eff * 100)}% effective).`, "good");
  return null;
}

export function toggleEdge(s: Sim, id: number): string | null {
  const e = s.edges[id];
  if (!e) return "No road selected";
  if (e.closed) { e.closed = false; sfx(s, "ok"); return null; }
  if (!spend(s, 8)) return need(8);
  e.closed = true; adjTrust(s, -0.3); s.stats.roadsClosed++; s.flags.roadClosed = true; sfx(s, "seal");
  return null;
}

export function startResearch(s: Sim, id: string): string | null {
  const t = TECHS.find((x) => x.id === id);
  if (!t) return "Unknown project";
  if (s.techs[id]) return "Already researched";
  if (t.req.some((r) => !s.techs[r])) return "Prerequisites missing";
  if (s.research.current) s.research.partial[s.research.current] = s.research.progress;
  s.research.current = id; s.research.progress = s.research.partial[id] || 0;
  s.flags.research = true; sfx(s, "ok");
  return null;
}

export function commissionScholars(s: Sim): string | null {
  if (!spend(s, 50)) return need(50);
  s.rp += 6; sfx(s, "research"); floater(s, 0.5, 0.5, "+6 📜", "#8fcf74", 16);
  return null;
}

export function togglePolicy(s: Sim, id: string): string | null {
  const p = POLICIES.find((x) => x.id === id);
  if (!p) return "Unknown policy";
  if (p.req && !s.techs[p.req]) return "Research Beaked Masks first";
  s.policies[id] = !s.policies[id]; s.flags.policy = true; sfx(s, s.policies[id] ? "seal" : "click");
  addLog(s, `${p.name} ${s.policies[id] ? "enacted" : "revoked"}.`, "info");
  return null;
}

/* ---------------------------------------------------------------- results */
export function computeResult(s: Sim) {
  const t = totals(s);
  const survivors = t.alive / s.pop0;
  const diff = diffOf(s);
  const modMult = s.cfg.mods.reduce((a, id) => a + (MODS.find((m) => m.id === id)?.mult || 0), 0);
  const mult = diff.mult * (1 + modMult);
  const win = !!s.over?.win;
  const stars = win ? (survivors >= 0.85 && s.trust >= 40 ? 3 : survivors >= 0.7 ? 2 : 1) : 0;
  const score = Math.round((survivors * 1000 + s.trust * 3 + (win ? 500 : 0) + s.day * 2) * mult);
  const lp = Math.max(3, Math.round((s.day * 0.5 + survivors * 20 + (win ? 25 + stars * 10 : 0)) * mult));
  return { win, survivors, stars, score, lp, mult, totals: t };
}
