// Civilization Micro — AI opponents and barbarians
import { TERRAIN, UNITS, IMPROVEMENTS, DIFFICULTY } from './data.js';
import {
  G, bus, reach, moveTo, attack, targetsFrom, combatStats, cityAt, unitsAt, campAt, atWar,
  isMil, canCapture, nbrs, ringTiles, dist, foundCity, canFound, makeUnit, researchable,
  setRel, civScore, tileYields, isCoastal, availableItems, log,
} from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- entry points ---------- */

export function aiTurn(ci) {
  const civ = G.civs[ci];
  if (!civ || !civ.alive) return;
  aiDiplomacy(civ);
  if (!civ.alive) return;
  aiCities(civ);
  aiResearch(civ);
  const ids = G.units.filter((u) => u.o === ci).map((u) => u.id);
  for (const id of ids) {
    const u = G.units.find((x) => x.id === id);
    if (u && u.o === ci) aiUnit(u);
  }
}

export function barbarianTurn() {
  for (const cp of G.camps) {
    cp.cd = (cp.cd || 0) - 1;
    const alive = G.units.filter((u) => u.o === -1 && u.home === cp.id).length;
    if (cp.cd <= 0 && alive < 3) {
      const spots = nbrs(cp.i).filter((j) => TERRAIN[G.tiles[j].t].pass && unitsAt(j).length === 0);
      if (spots.length) {
        const j = spots[Math.floor(Math.random() * spots.length)];
        const u = makeUnit(Math.random() < 0.4 ? 'barb_archer' : 'barb_warrior', -1, j);
        u.home = cp.id;
        cp.cd = 3 + Math.floor(Math.random() * 2);
        if (G.vis[cp.i]) {
          bus.emit('fx', { type: 'text', i: cp.i, text: 'Barbarians!', col: '#ff6b6b' });
          log('Barbarians emerge from a camp!', 'bad');
          bus.emit('sfx', 'barb');
        }
      } else cp.cd = 1;
    }
  }
  const ids = G.units.filter((u) => u.o === -1).map((u) => u.id);
  for (const id of ids) {
    const u = G.units.find((x) => x.id === id);
    if (u) barbarianUnit(u);
  }
}

/* ---------- diplomacy ---------- */

function aiDiplomacy(civ) {
  const diff = DIFFICULTY[G.diff] || DIFFICULTY.monarch;
  let d = 0;
  const r = G.rel[civ.i][0];
  if (r === 'peace') d += 1;
  else if (r === 'ally') d += 2;
  else d -= 2;
  if (G.units.some((u) => u.o === 0 && G.tiles[u.i].own === civ.i)) d -= 2;
  if (civScore(0) > civScore(civ.i)) d -= 0.5;
  civ.op = clamp(civ.op * 0.96 + d, -100, 100);

  if (r === 'peace' && G.turn > 12 && civ.op < -35 && Math.random() < 0.12 * diff.aggr) {
    setRel(civ.i, 0, 'war');
    civ.op -= 15;
    log(`${civ.name} declares war on you!`, 'bad');
    bus.emit('sfx', 'war');
  } else if (r === 'peace' && G.turn > 60 && civScore(0) > civScore(civ.i) * 1.3 && Math.random() < 0.02 * diff.aggr) {
    setRel(civ.i, 0, 'war');
    civ.op -= 15;
    log(`${civ.name} sees your lead as a threat and declares war!`, 'bad');
    bus.emit('sfx', 'war');
  } else if (r === 'war' && civ.op > 10 && Math.random() < 0.12) {
    setRel(civ.i, 0, 'peace');
    log(`${civ.name} accepts a return to peace.`, '');
  }

  for (const o of G.civs) {
    if (o.i === 0 || o.i === civ.i || !o.alive || !civ.alive) continue;
    if (o.i < civ.i) continue; // handle each pair once
    const rr = G.rel[civ.i][o.i];
    if (rr === 'peace' && G.turn > 30 && Math.random() < 0.015 * diff.aggr) {
      setRel(civ.i, o.i, 'war');
      log(`${civ.name} declares war on ${o.name}.`, '');
    } else if (rr === 'war' && Math.random() < 0.03) {
      setRel(civ.i, o.i, 'peace');
      log(`${civ.name} and ${o.name} make peace.`, '');
    }
  }
}

// Answers for the player's diplomatic proposals.
export function respond(kind, ci) {
  const op = G.civs[ci].op;
  if (kind === 'peace') return op > -25;
  if (kind === 'trade') return op > -10;
  if (kind === 'ally') return op >= 40;
  return false;
}

/* ---------- cities & research ---------- */

function aiCities(civ) {
  for (const c of G.cities.filter((x) => x.o === civ.i)) {
    if (!c.prod || G.turn - c.lastPick >= 4 || (c.prod.k === 'w' && G.wonders[c.prod.id])) {
      c.prod = aiPick(civ, c);
      c.lastPick = G.turn;
    }
  }
}

function pickMil(ids, role) {
  const mil = ids.filter((id) => !UNITS[id].civil && !UNITS[id].siege);
  if (!mil.length) return 'warrior';
  mil.sort((a, b) => {
    const va = (role === 'def' ? UNITS[a].def : UNITS[a].atk + UNITS[a].def * 0.3) / (UNITS[a].cost + 10);
    const vb = (role === 'def' ? UNITS[b].def : UNITS[b].atk + UNITS[b].def * 0.3) / (UNITS[b].cost + 10);
    return vb - va;
  });
  return mil[0];
}

function aiPick(civ, c) {
  const av = availableItems(c);
  const myCities = G.cities.filter((x) => x.o === civ.i);
  const myUnits = G.units.filter((u) => u.o === civ.i);
  const settlers = myUnits.filter((u) => u.type === 'settler').length;
  const workers = myUnits.filter((u) => u.type === 'worker').length;
  const defenders = unitsAt(c.i).filter((u) => u.o === civ.i && isMil(u)).length;
  const mil = myUnits.filter((u) => isMil(u)).length;
  const hostile = G.civs.some((o) => o.i !== civ.i && o.alive && G.rel[civ.i][o.i] === 'war')
    || G.camps.some((cp) => dist(cp.i, c.i) <= 6);
  const want = 4 + (G.diff === 'deity' ? 1 : 0);

  if (myCities.length < want && settlers === 0 && c.size >= 2 && G.turn < 150 && av.u.includes('settler')) return { k: 'u', id: 'settler' };
  if (workers < Math.ceil(myCities.length / 2) && c.size >= 2 && av.u.includes('worker')) return { k: 'u', id: 'worker' };
  if (defenders === 0) return { k: 'u', id: pickMil(av.u, 'def') };
  const prio = ['library', 'market', 'temple', 'harbor', 'walls', 'aqueduct', 'forge', 'colosseum', 'university', 'bank', 'factory'];
  for (const id of prio) {
    if (!av.b.includes(id)) continue;
    if (id === 'walls' && !hostile) continue;
    if (id === 'aqueduct' && c.size < 7) continue;
    if (id === 'factory' && c.size < 8) continue;
    return { k: 'b', id };
  }
  if (av.w.length && c.size >= 4 && Math.random() < 0.45) return { k: 'w', id: av.w[0] };
  if (mil < myCities.length * 2 + (hostile ? 2 : 0)) return { k: 'u', id: pickMil(av.u, 'atk') };
  return { k: 'u', id: pickMil(av.u, 'def') };
}

function aiResearch(civ) {
  if (civ.researching) return;
  const av = researchable(civ);
  if (!av.length) return;
  av.sort((a, b) => a.cost - b.cost);
  let pick = av[0];
  if (av.length > 1 && Math.random() < 0.3) pick = av[1];
  civ.researching = pick.id;
}

/* ---------- units ---------- */

function aiUnit(u) {
  if (u.type === 'settler') return aiSettler(u);
  if (u.type === 'worker') return aiWorker(u);
  if (UNITS[u.type].civil) return;
  return aiMilitary(u);
}

function siteOK(j, o) {
  const t = G.tiles[j];
  if (!TERRAIN[t.t].pass) return false;
  if (t.own >= 0 && t.own !== o) return false;
  if (G.cities.some((c) => dist(c.i, j) < 4)) return false;
  if (G.units.some((v) => v.i === j && atWar(o, v.o))) return false;
  return true;
}

function findSite(u) {
  let best = -1, bs = -1e9;
  const my = G.cities.filter((c) => c.o === u.o);
  for (const t of G.tiles) {
    const j = t.i;
    if (!siteOK(j, u.o)) continue;
    const d = dist(u.i, j);
    if (d > 9) continue;
    let s = 0;
    for (const k of [j, ...ringTiles(j, 1)]) {
      const y = tileYields(k);
      s += y.f * 1.2 + y.p + y.g * 0.6 + y.s * 0.5 + y.cu * 0.5;
      if (G.tiles[k].own === -1) s += 0.3;
    }
    if (isCoastal(j)) s += 2;
    s -= d * 0.8;
    if (my.length) {
      const dm = Math.min(...my.map((c) => dist(c.i, j)));
      if (dm > 6) s -= (dm - 6) * 1.5;
    }
    if (s > bs) { bs = s; best = j; }
  }
  return best < 0 ? null : best;
}

function stepToward(u, goal) {
  const r = reach(u);
  if (!r.size) return false;
  let best = -1, bs = 1e9;
  for (const [j, c] of r) {
    const s = dist(j, goal) * 10 + c;
    if (s < bs) { bs = s; best = j; }
  }
  if (best < 0 || dist(best, goal) > dist(u.i, goal)) return false;
  return moveTo(u, best);
}

function aiSettler(u) {
  if (u.goal === null || u.goal === undefined || !siteOK(u.goal, u.o)) u.goal = findSite(u);
  if (u.goal === null || u.goal === undefined) {
    if (!canFound(u)) foundCity(u);
    return;
  }
  if (u.i !== u.goal) stepToward(u, u.goal);
  if (u.i === u.goal && !canFound(u)) foundCity(u);
}

function pickTask(u) {
  const civ = G.civs[u.o];
  let best = null, bs = -1e9;
  const mine = G.cities.filter((c) => c.o === u.o);
  for (const t of G.tiles) {
    if (t.own !== u.o || t.imp || cityAt(t.i) || !TERRAIN[t.t].pass) continue;
    if (!mine.some((c) => dist(c.i, t.i) <= 3)) continue;
    if (G.units.some((v) => v.job && v.job.i === t.i && v.id !== u.id)) continue;
    const d = dist(u.i, t.i);
    if (d > 10) continue;
    let bt = null, bv = -1;
    for (const k of Object.keys(IMPROVEMENTS)) {
      const I = IMPROVEMENTS[k];
      if (!I.on.includes(t.t)) continue;
      if (I.req && !civ.researched.includes(I.req)) continue;
      const y = I.y;
      const v = (y.f || 0) * 1.5 + (y.p || 0) * 1.2 + (y.g || 0) + (t.r ? 1.5 : 0);
      if (v > bv) { bv = v; bt = k; }
    }
    if (!bt) continue;
    const s = bv * 2 - d;
    if (s > bs) { bs = s; best = { t: bt, j: t.i }; }
  }
  return best;
}

function aiWorker(u) {
  if (u.job && (G.tiles[u.job.i].imp || G.tiles[u.job.i].own !== u.o)) u.job = null;
  if (!u.job) {
    const pick = pickTask(u);
    if (!pick) return;
    u.job = { t: pick.t, i: pick.j, p: 0 };
  }
  if (u.i !== u.job.i) stepToward(u, u.job.i);
  if (u.i === u.job.i) u.busy = true;
}

function nearestEnemyCity(u, maxD) {
  let best = null, bd = 99;
  for (const c of G.cities) {
    if (!atWar(u.o, c.o)) continue;
    const d = dist(u.i, c.i);
    if (d <= maxD && d < bd) { bd = d; best = c.i; }
  }
  return best;
}

function nearestOwnCity(u) {
  let best = null, bd = 99;
  for (const c of G.cities) {
    if (c.o !== u.o) continue;
    const d = dist(u.i, c.i);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Best attack or capture plan for a unit over all reachable tiles.
function bestPlan(u) {
  const r = reach(u);
  r.set(u.i, 0);
  let best = null;
  for (const [to, cost] of r) {
    const city = cityAt(to);
    if (city && atWar(u.o, city.o) && unitsAt(to).length === 0) {
      if (canCapture(u) && to !== u.i) {
        const s = 2.5 - cost * 0.05;
        if (!best || s > best.score) best = { to, j: null, score: s };
      }
      continue;
    }
    if (to !== u.i && cost >= u.mp) continue;
    for (const tg of targetsFrom(u, to)) {
      if (tg.kind === 'camp' && u.o < 0) continue;
      const st = combatStats(u, tg, to);
      const val = tg.city ? 1.6 : tg.kind === 'camp' ? 1.3 : 1;
      let score = st.p * val - cost * 0.05;
      if (st.ranged) score += 0.15;
      if (!best || score > best.score) best = { to, j: tg.j, score };
    }
  }
  return best;
}

function aiMilitary(u) {
  const plan = bestPlan(u);
  if (plan && plan.score > 0.45) {
    if (plan.to !== u.i) moveTo(u, plan.to);
    if (plan.j !== null && u.mp > 0) attack(u, plan.j);
    return;
  }
  const atWarAny = G.civs.some((o) => o.i !== u.o && o.alive && G.rel[u.o][o.i] === 'war');
  if (atWarAny && u.hp >= 70) {
    const tgt = nearestEnemyCity(u, 14);
    if (tgt !== null && stepToward(u, tgt)) return;
  }
  const home = nearestOwnCity(u);
  if (home && u.i !== home.i && dist(u.i, home.i) > 1) {
    stepToward(u, home.i);
    return;
  }
  u.fort = true;
  u.mp = 0;
}

function barbarianUnit(u) {
  const plan = bestPlan(u);
  if (plan && plan.score > 0.3 && plan.j !== null) {
    if (plan.to !== u.i) moveTo(u, plan.to);
    if (u.mp > 0) attack(u, plan.j);
    return;
  }
  const camp = G.camps.find((c) => c.id === u.home);
  if (camp && dist(u.i, camp.i) > 4) { stepToward(u, camp.i); return; }
  const tc = nearestEnemyCity(u, 10);
  if (tc !== null && Math.random() < 0.7 && stepToward(u, tc)) return;
  const r = [...reach(u).keys()];
  if (r.length && Math.random() < 0.6) moveTo(u, r[Math.floor(Math.random() * r.length)]);
}

// Exported for the UI: whether an AI civ would likely accept a city-free deal.
export function canAfford(civ, cost) { return civ.gold >= cost; }
export { campAt, clamp };
