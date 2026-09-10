/* Scratch headless diagnostics for the ant simulation (deleted after verification). */
import { AntState } from '../src/sim/ant';
import { COLONY_PRESETS } from '../src/sim/colony';
import { PH_FOOD, SIM_DT, PH_HOME } from '../src/sim/constants';
import { buildDefaultScenario, World } from '../src/sim/world';

const lines: string[] = [];
const log = (s: string) => { lines.push(s); };

function run(w: World, seconds: number) {
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n; i++) w.step(SIM_DT);
}

function stateCounts(w: World, colonyId: number) {
  const c: Record<string, number> = {};
  for (const a of w.ants) if (a.colonyId === colonyId) c[AntState[a.state]] = (c[AntState[a.state]] || 0) + 1;
  return JSON.stringify(c);
}

function sanity(w: World, label: string) {
  let bad = 0, inWall = 0;
  for (const a of w.ants) {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.heading)) bad++;
    if (!w.inBounds(a.x, a.y)) bad++;
    if (w.walls.isSolidWorld(a.x, a.y)) inWall++;
  }
  log(`  [sanity ${label}] nonfinite/out-of-bounds=${bad} insideWall=${inWall}`);
}

try {
  // ---------------- Test A: default scenario ----------------
  log('=== A. Default scenario (seed 1337) ===');
  const w = new World(1337);
  buildDefaultScenario(w);
  const t0 = Date.now();
  for (let s = 60; s <= 600; s += 60) {
    run(w, 60);
    const parts = w.colonies.map((c) => `${c.name}: living=${w.countAnts(c.id)} trips=${c.trips} collected=${c.collected.toFixed(0)} stored=${c.storedFood.toFixed(0)} deaths=${c.deaths} foodCells>0.05=${c.pheromones.countAbove(PH_FOOD, 0.05)} homeCells>0.02=${c.pheromones.countAbove(PH_HOME, 0.02)}`);
    log(`t=${s}s ` + parts.join(' | '));
    log('  states A ' + stateCounts(w, w.colonies[0].id));
    log('  states B ' + stateCounts(w, w.colonies[1].id));
    log('  food: ' + w.foods.map((f) => `${f.x},${f.y}:${f.quantity.toFixed(0)}`).join(' '));
  }
  const elapsed = Date.now() - t0;
  log(`  wall time for 600s sim: ${elapsed}ms (${(elapsed / 18000).toFixed(3)} ms/tick, ${w.ants.length} ants)`);
  sanity(w, 'default');
  log('  events: ' + w.events.slice(0, 8).map((e) => `${e.time.toFixed(0)}s ${e.text}`).join(' ; '));

  // ---------------- Test B: trail decay after food removal ----------------
  log('=== B. Trail decay after food removal ===');
  const before = w.colonies.map((c) => c.pheromones.countAbove(PH_FOOD, 0.05));
  w.clearFood();
  for (let s = 30; s <= 120; s += 30) {
    run(w, 30);
    log(`  +${s}s foodCells>0.05: ` + w.colonies.map((c, i) => `${c.name} ${before[i]} -> ${c.pheromones.countAbove(PH_FOOD, 0.05)}`).join(' | '));
  }

  // ---------------- Test C: single colony, single food, obstacle rerouting ----------------
  log('=== C. Obstacle adaptation ===');
  const w2 = new World(42);
  w2.colonies = [];
  w2.clearWorld();
  const c = w2.addColony(COLONY_PRESETS[1], { population: 120, aggression: 0 });
  w2.addNest(c.id, 400, 500);
  w2.addFood(820, 500, 5000);
  w2.resetRuntime(42);
  let lastTrips = 0;
  for (let s = 30; s <= 240; s += 30) {
    run(w2, 30);
    log(`  t=${s}s trips=${c.trips} (+${c.trips - lastTrips}) carrying=${w2.ants.filter((a) => a.carrying > 0).length} following=${w2.ants.filter((a) => a.state === AntState.FollowingFoodTrail).length} lostReturning=${w2.ants.filter((a) => a.state === AntState.ReturningWithFood && a.lostTimer > 5).length}`);
    lastTrips = c.trips;
  }
  // Food pheromone on the direct line (blocked segment) vs elsewhere
  const lineCells = () => {
    let sum = 0, n = 0;
    for (let x = 560; x <= 660; x += 8) { sum += c.pheromones.sample(PH_FOOD, x, 500); n++; }
    return sum / n;
  };
  const detourCells = () => {
    let sum = 0, n = 0;
    for (const y of [380, 620]) for (let x = 560; x <= 660; x += 8) { sum += c.pheromones.sample(PH_FOOD, x, y); n++; }
    return sum / n;
  };
  log(`  before wall: line food ph=${lineCells().toFixed(3)} detour food ph=${detourCells().toFixed(3)}`);
  // Wall across the trail: vertical at x=610 from y=400..600
  w2.walls.fillRect(604, 400, 618, 600);
  const tripsAtWall = c.trips;
  lastTrips = c.trips;
  for (let s = 30; s <= 300; s += 30) {
    run(w2, 30);
    log(`  +${s}s after wall trips=${c.trips} (+${c.trips - lastTrips}) line ph=${lineCells().toFixed(3)} detour ph=${detourCells().toFixed(3)} avoiding=${w2.ants.filter((a) => a.state === AntState.AvoidingObstacle).length} stuck>0.5=${w2.ants.filter((a) => a.stuck > 0.5).length}`);
    lastTrips = c.trips;
  }
  log(`  trips after wall: ${c.trips - tripsAtWall}`);
  sanity(w2, 'obstacle');

  // ---------------- Test D: aggression / competition ----------------
  log('=== D. Competition ===');
  for (const aggr of [0, 0.3, 0.5, 0.8]) {
    const w3 = new World(7);
    w3.colonies = [];
    w3.clearWorld();
    const a1 = w3.addColony(COLONY_PRESETS[0], { population: 100, aggression: aggr });
    const a2 = w3.addColony(COLONY_PRESETS[1], { population: 100, aggression: aggr });
    w3.addNest(a1.id, 600, 500);
    w3.addNest(a2.id, 1000, 500);
    w3.addFood(800, 500, 3000, 6);
    w3.resetRuntime(7);
    run(w3, 240);
    let fights = 0;
    for (const a of w3.ants) if (a.state === AntState.Fighting) fights++;
    log(`  aggression=${aggr}: deaths A=${a1.deaths} B=${a2.deaths} kills A=${a1.kills} B=${a2.kills} living A=${w3.countAnts(a1.id)} B=${w3.countAnts(a2.id)} trips A=${a1.trips} B=${a2.trips} fightingNow=${fights}`);
  }

  // ---------------- Test E: performance with 1200 ants ----------------
  log('=== E. Performance ===');
  const w4 = new World(99);
  buildDefaultScenario(w4);
  for (const c4 of w4.colonies) { c4.traits.population = 600; w4.syncPopulation(c4); }
  const p0 = Date.now();
  run(w4, 20);
  const pe = Date.now() - p0;
  log(`  ${w4.ants.length} ants: ${(pe / 600).toFixed(2)} ms/tick`);
  sanity(w4, 'perf');

  // ---------------- Test F: locality — food far away must not influence ----------------
  log('=== F. Locality ===');
  const w5 = new World(5);
  w5.colonies = [];
  w5.clearWorld();
  const c5 = w5.addColony(COLONY_PRESETS[0], { population: 1 });
  w5.addNest(c5.id, 300, 500);
  w5.resetRuntime(5);
  const ant = w5.ants[0];
  ant.x = 300; ant.y = 300; ant.heading = 0;
  // run a few ticks with and without far food; compare sensed inputs
  w5.step(SIM_DT);
  const inputsNoFood = Array.from(ant.inputs);
  w5.addFood(1400, 900, 200);
  w5.step(SIM_DT);
  const inputsFarFood = Array.from(ant.inputs);
  log(`  foodSeen with far food: ${ant.senses.foodSeen}; food inputs identical: ${inputsNoFood[11] === inputsFarFood[11] && inputsNoFood[12] === inputsFarFood[12]}`);
  w5.addFood(ant.x + 30, ant.y, 200);
  w5.step(SIM_DT);
  log(`  foodSeen with near food: ${ant.senses.foodSeen} dist=${ant.senses.foodDist.toFixed(1)} bearing=${ant.senses.foodBearing.toFixed(2)} nnSteer=${ant.outputs[0].toFixed(2)} state=${AntState[ant.state]}`);
} catch (e) {
  log('ERROR: ' + (e as Error).stack);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__diagOutput = lines.join('\n');
export const output = lines.join('\n');
