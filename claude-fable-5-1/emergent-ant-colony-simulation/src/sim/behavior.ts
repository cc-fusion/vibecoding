/**
 * Ant decision + movement logic.
 *
 * Pipeline per ant per tick:
 *   1. sense()      – strictly local sampling (pheromone probes, obstacle rays,
 *                     objects/ants within sensory range)
 *   2. think()      – fill neural inputs, run the colony's tiny policy network
 *   3. decide()     – finite-state controller; rules decide what is valid,
 *                     network outputs bias priorities & steering
 *   4. move()       – heading integration, wall collision, budgets, energy
 *
 * No function in this file receives world coordinates of anything the ant
 * cannot perceive locally.
 */
import { Ant, AntState, foodRadius } from './ant';
import type { Colony } from './colony';
import {
  NN_HIDDEN, OUT_ALARM, OUT_AVOID, OUT_ENGAGE, OUT_EXPLORE, OUT_FORWARD, OUT_HOME, OUT_STEER, OUT_TRAIL,
  PH_ALARM, PH_EXPLORE, PH_FOOD, PH_HOME, TUNING,
} from './constants';
import { forward, IN } from './policy';
import type { World } from './world';

const hidden = new Float32Array(NN_HIDDEN);
const TWO_PI = Math.PI * 2;

export function wrapAngle(a: number): number {
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  else if (a < -Math.PI) a += TWO_PI;
  return a;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Normalised left/right gradient turn: positive turns right (toward R). */
function gradientTurn(L: number, A: number, R: number, gain: number): number {
  return ((R - L) / (L + A + R + 0.02)) * gain;
}

// ---------------------------------------------------------------------------
// 1. Sensing
// ---------------------------------------------------------------------------
export function sense(w: World, a: Ant, col: Colony): void {
  const s = a.senses;
  const ph = col.pheromones;
  const range = col.traits.sensoryRange;
  const h = a.heading;

  // Pheromone probes: ahead-left, ahead, ahead-right
  const pd = TUNING.probeDist, pa = TUNING.probeAngle;
  const lx = a.x + Math.cos(h - pa) * pd, ly = a.y + Math.sin(h - pa) * pd;
  const ax = a.x + Math.cos(h) * pd, ay = a.y + Math.sin(h) * pd;
  const rx = a.x + Math.cos(h + pa) * pd, ry = a.y + Math.sin(h + pa) * pd;
  s.foodL = ph.sample(PH_FOOD, lx, ly); s.foodA = ph.sample(PH_FOOD, ax, ay); s.foodR = ph.sample(PH_FOOD, rx, ry);
  s.homeL = ph.sample(PH_HOME, lx, ly); s.homeA = ph.sample(PH_HOME, ax, ay); s.homeR = ph.sample(PH_HOME, rx, ry);
  s.alarmL = ph.sample(PH_ALARM, lx, ly); s.alarmA = ph.sample(PH_ALARM, ax, ay); s.alarmR = ph.sample(PH_ALARM, rx, ry);
  s.foodHere = ph.sample(PH_FOOD, a.x, a.y);
  s.homeHere = ph.sample(PH_HOME, a.x, a.y);
  s.alarmHere = ph.sample(PH_ALARM, a.x, a.y);
  s.exploreHere = ph.sample(PH_EXPLORE, a.x, a.y);

  // Obstacle rays
  s.obsF = probe(w, a.x, a.y, h);
  s.obsL = probe(w, a.x, a.y, h - TUNING.obstacleProbeAngle);
  s.obsR = probe(w, a.x, a.y, h + TUNING.obstacleProbeAngle);

  // Food within sensory range (edge distance)
  s.foodSeen = false; s.foodDist = 0; s.foodBearing = 0; s.foodId = -1;
  let best = Infinity;
  const foods = w.foods;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.quantity <= 0) continue;
    const dx = f.x - a.x, dy = f.y - a.y;
    const r = foodRadius(f);
    const lim = range + r;
    if (dx * dx + dy * dy > lim * lim) continue;
    const d = Math.sqrt(dx * dx + dy * dy) - r;
    if (d < best) {
      best = d;
      s.foodSeen = true;
      s.foodDist = Math.max(0, d);
      s.foodBearing = wrapAngle(Math.atan2(dy, dx) - h);
      s.foodId = f.id;
    }
  }

  // Own nest within sensory range
  s.nestSeen = false; s.nestDist = 0; s.nestBearing = 0; s.nestId = -1;
  best = Infinity;
  const nests = w.nests;
  for (let i = 0; i < nests.length; i++) {
    const n = nests[i];
    if (n.colonyId !== a.colonyId) continue;
    const dx = n.x - a.x, dy = n.y - a.y;
    const lim = range + n.radius;
    if (dx * dx + dy * dy > lim * lim) continue;
    const d = Math.sqrt(dx * dx + dy * dy) - n.radius;
    if (d < best) {
      best = d;
      s.nestSeen = true;
      s.nestDist = Math.max(0, d);
      s.nestBearing = wrapAngle(Math.atan2(dy, dx) - h);
      s.nestId = n.id;
    }
  }

  // Nearby ants via spatial hash
  s.friends = 0; s.rivals = 0; s.rivalSeen = false; s.rivalDist = 0; s.rivalBearing = 0; s.rivalIndex = -1;
  let bestR2 = Infinity;
  const r2 = range * range;
  const ants = w.ants;
  const count = w.hash.queryInto(a.x, a.y, range, neighborBuf);
  for (let k = 0; k < count; k++) {
    const i = neighborBuf[k];
    const b = ants[i];
    if (b === a || !b.alive) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (b.colonyId === a.colonyId) s.friends++;
    else {
      s.rivals++;
      if (d2 < bestR2) {
        bestR2 = d2;
        s.rivalSeen = true;
        s.rivalDist = Math.sqrt(d2);
        s.rivalBearing = wrapAngle(Math.atan2(dy, dx) - h);
        s.rivalIndex = i;
      }
    }
  }
}

/** Scratch buffer for neighbour queries (max candidates considered per ant). */
const neighborBuf = new Int32Array(512);

/** March a ray through the wall grid; returns proximity 0 (clear) .. 1 (touching). */
function probe(w: World, x: number, y: number, angle: number): number {
  const len = TUNING.obstacleProbeLen, step = TUNING.obstacleProbeStep;
  const cx = Math.cos(angle), cy = Math.sin(angle);
  for (let d = step; d <= len; d += step) {
    if (w.walls.isSolidWorld(x + cx * d, y + cy * d)) return 1 - (d - step) / len;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 2. Neural evaluation
// ---------------------------------------------------------------------------
function think(w: World, a: Ant, col: Colony): void {
  const s = a.senses, t = col.traits, inp = a.inputs;
  const g = t.pheromoneSensitivity;
  const range = t.sensoryRange;
  inp[IN.FOOD_L] = Math.min(1, s.foodL * g);
  inp[IN.FOOD_A] = Math.min(1, s.foodA * g);
  inp[IN.FOOD_R] = Math.min(1, s.foodR * g);
  inp[IN.HOME_L] = Math.min(1, s.homeL * g);
  inp[IN.HOME_A] = Math.min(1, s.homeA * g);
  inp[IN.HOME_R] = Math.min(1, s.homeR * g);
  inp[IN.ALARM] = Math.min(1, Math.max(s.alarmHere, s.alarmA, s.alarmL, s.alarmR) * 3);
  inp[IN.EXPLORE] = Math.min(1, s.exploreHere);
  inp[IN.OBS_F] = s.obsF;
  inp[IN.OBS_L] = s.obsL;
  inp[IN.OBS_R] = s.obsR;
  inp[IN.FOOD_SEEN] = s.foodSeen ? 1 - s.foodDist / range : 0;
  inp[IN.FOOD_BEARING] = s.foodSeen ? s.foodBearing / Math.PI : 0;
  inp[IN.NEST_SEEN] = s.nestSeen ? 1 - s.nestDist / range : 0;
  inp[IN.NEST_BEARING] = s.nestSeen ? s.nestBearing / Math.PI : 0;
  inp[IN.RIVAL_NEAR] = s.rivalSeen ? 1 - s.rivalDist / range : 0;
  inp[IN.RIVAL_BEARING] = s.rivalSeen ? s.rivalBearing / Math.PI : 0;
  inp[IN.FRIENDS] = Math.min(1, s.friends / 8);
  inp[IN.CARRYING] = a.carrying > 0 ? 1 : 0;
  inp[IN.HEALTH] = a.health / t.maxHealth;
  inp[IN.ENERGY] = a.energy;
  inp[IN.HOME_BUDGET] = a.homeBudget;
  inp[IN.STUCK] = a.stuck;
  inp[IN.NOISE] = w.rng.range(-1, 1);
  forward(col.policy, inp, hidden, a.outputs);
}

// ---------------------------------------------------------------------------
// 3 + 4. Decision and movement
// ---------------------------------------------------------------------------
const MOVING_STATES = new Set<AntState>([
  AntState.Exploring, AntState.FollowingFoodTrail, AntState.ReturningWithFood, AntState.FollowingHomeSignal,
  AntState.InvestigatingAlarm, AntState.AvoidingObstacle, AntState.Retreating,
]);

export function updateAnt(w: World, a: Ant, dt: number): void {
  const col = w.colonyById(a.colonyId);
  if (!col) return;
  const t = col.traits;
  const ph = col.pheromones;
  const rng = w.rng;
  const s = a.senses;

  a.age += dt;
  a.stateTimer += dt;
  if (a.ignoreTrailTimer > 0) a.ignoreTrailTimer -= dt;
  if (a.alarmCooldown > 0) a.alarmCooldown -= dt;

  sense(w, a, col);
  think(w, a, col);

  const inf = t.neuralInfluence;
  const out = a.outputs;
  const nnSteer = out[OUT_STEER] * inf;
  const trailN = (out[OUT_TRAIL] + 1) * 0.5;     // 0..1
  const exploreN = (out[OUT_EXPLORE] + 1) * 0.5; // 0..1
  const alarmU = out[OUT_ALARM] * inf;
  const engageU = out[OUT_ENGAGE] * inf;
  const avoidU = out[OUT_AVOID] * inf;
  const homeU = out[OUT_HOME] * inf;
  const g = t.pheromoneSensitivity;
  const thr = TUNING.trailThreshold;
  const healthFrac = a.health / t.maxHealth;

  let turn = 0;
  let speedMul = 1;

  // ---- universal contact events -------------------------------------------
  const carrying = a.carrying > 0;
  const busy = a.state === AntState.Fighting || a.state === AntState.Resting || a.state === AntState.CollectingFood;
  if (!busy) {
    if (carrying && s.nestSeen && s.nestDist <= TUNING.encounterMargin) {
      deliver(w, a, col);
    } else if (!carrying && s.nestSeen && s.nestDist <= TUNING.encounterMargin) {
      a.homeBudget = 1;
      if (a.state === AntState.FollowingHomeSignal || (a.energy < TUNING.lowEnergy + 0.1 && a.state !== AntState.Retreating)) {
        a.setState(AntState.Resting);
      } else if (a.state === AntState.Retreating && healthFrac < 0.6) {
        a.setState(AntState.Resting);
      }
    } else if (!carrying && s.foodSeen && s.foodDist <= TUNING.encounterMargin &&
      (a.state === AntState.Exploring || a.state === AntState.FollowingFoodTrail || a.state === AntState.AvoidingObstacle || a.state === AntState.InvestigatingAlarm)) {
      a.targetFoodId = s.foodId;
      a.frustration = 0;
      a.setState(AntState.CollectingFood);
    }
  }

  // ---- state behaviour ----------------------------------------------------
  const wanderBase = TUNING.baseWander * a.variation;
  switch (a.state) {
    case AntState.Exploring: {
      const sigma = wanderBase * (0.4 + 1.4 * t.exploration) * (0.5 + exploreN);
      turn += rng.gauss() * sigma;
      if (rng.chance(0.006 * (0.3 + t.exploration))) turn += rng.range(-1.5, 1.5);
      // crowded / already-explored areas nudge explorers to spread (weak)
      if (s.exploreHere > 0.5) turn += rng.gauss() * sigma * 0.5;

      if (s.foodSeen) {
        turn += s.foodBearing * 1.4;
      } else if (a.ignoreTrailTimer <= 0) {
        const fL = s.foodL * g, fA = s.foodA * g, fR = s.foodR * g;
        const maxF = Math.max(fL, fA, fR);
        if (maxF > thr) {
          // Probabilistic recruitment: weak attraction now, commitment by chance.
          const commit = (0.25 + 0.75 * trailN) * (1.15 - t.exploration) * Math.sqrt(g);
          turn += gradientTurn(fL, fA, fR, 0.35 * commit);
          if (rng.chance(0.08 * commit * Math.min(1, maxF / (thr * 4)))) a.setState(AntState.FollowingFoodTrail);
        }
      }
      maybeInvestigateAlarm(w, a, t, alarmU);
      if (a.energy < TUNING.lowEnergy && homeU + (TUNING.lowEnergy - a.energy) * 4 > 0) a.setState(AntState.FollowingHomeSignal);
      break;
    }

    case AntState.FollowingFoodTrail: {
      const fL = s.foodL * g, fA = s.foodA * g, fR = s.foodR * g;
      const maxF = Math.max(fL, fA, fR);
      if (s.foodSeen) {
        turn += s.foodBearing * 1.4;
        a.lostTimer = 0;
      } else if (maxF > thr && a.ignoreTrailTimer <= 0) {
        const commit = (0.5 + 0.8 * trailN) * (1.2 - 0.6 * t.exploration);
        turn += gradientTurn(fL, fA, fR, 0.9 * commit);
        turn += rng.gauss() * wanderBase * 0.45 * (0.5 + t.exploration);
        a.lostTimer = 0;
        // Heading away from the source? (concentration ahead lower than here)
        const here = s.foodHere * g;
        if (here > thr * 2 && fA < here * 0.75 && maxF < here * 0.92) a.downhill++;
        else a.downhill = Math.max(0, a.downhill - 1);
        if (a.downhill > 14) {
          a.heading += Math.PI + rng.gauss() * 0.6; // confused: turn around
          a.downhill = 0;
        }
        // Strong trail but nothing to collect: give up on it for a while
        if (here > 0.6) a.frustration += dt; else a.frustration = Math.max(0, a.frustration - dt * 0.5);
        if (a.frustration > 8) {
          a.frustration = 0;
          a.ignoreTrailTimer = 8;
          a.heading += rng.range(-2, 2);
          a.setState(AntState.Exploring);
        }
        // spontaneous deviation
        if (rng.chance(0.0015 * t.exploration * (1.5 - trailN))) {
          a.ignoreTrailTimer = 3;
          a.setState(AntState.Exploring);
        }
      } else {
        a.lostTimer += dt;
        turn += rng.gauss() * wanderBase * 1.5;
        if (a.lostTimer > 1.5) {
          a.lostTimer = 0;
          a.setState(AntState.Exploring);
        }
      }
      maybeInvestigateAlarm(w, a, t, alarmU);
      if (a.energy < TUNING.lowEnergy && homeU > -0.2) a.setState(AntState.FollowingHomeSignal);
      break;
    }

    case AntState.CollectingFood: {
      speedMul = 0;
      if (a.stateTimer >= TUNING.collectTime) {
        const f = w.foodById(a.targetFoodId);
        if (f && f.quantity > 0) {
          const take = Math.min(t.carryCapacity, f.quantity);
          f.quantity -= take;
          if (f.quantity <= 0.001) {
            f.quantity = 0;
            f.depletedAt = w.time;
          }
          a.carrying = take;
          a.foodBudget = 1;
          a.heading += Math.PI + rng.gauss() * 0.4; // head back the way we came
          a.setState(AntState.ReturningWithFood);
        } else {
          a.setState(AntState.Exploring);
        }
      }
      break;
    }

    case AntState.ReturningWithFood:
    case AntState.FollowingHomeSignal: {
      if (s.nestSeen) {
        turn += s.nestBearing * 1.6;
        a.lostTimer = 0;
      } else {
        const hL = s.homeL * g, hA = s.homeA * g, hR = s.homeR * g;
        const maxH = Math.max(hL, hA, hR);
        if (maxH > thr) {
          turn += gradientTurn(hL, hA, hR, 0.8 * (0.6 + 0.5 * trailN));
          turn += rng.gauss() * wanderBase * 0.4;
          a.lostTimer = 0;
          const here = s.homeHere * g;
          if (here > thr * 2 && hA < here * 0.75 && maxH < here * 0.92) a.downhill++;
          else a.downhill = Math.max(0, a.downhill - 1);
          if (a.downhill > 14) {
            a.heading += Math.PI + rng.gauss() * 0.6;
            a.downhill = 0;
          }
        } else {
          // lost: keep moving fairly straight (covers ground) with occasional sharp turns
          a.lostTimer += dt;
          turn += rng.gauss() * wanderBase * (0.8 + 0.4 * Math.min(1, a.lostTimer / 10));
          if (rng.chance(0.008)) turn += rng.range(-1.5, 1.5);
        }
      }
      break;
    }

    case AntState.Resting: {
      speedMul = 0;
      let rec = TUNING.restRecoverPerSec;
      if (col.storedFood > 0) {
        rec += TUNING.restFoodBoost;
        col.storedFood = Math.max(0, col.storedFood - TUNING.restFoodCostPerSec * dt);
      }
      a.energy = Math.min(1, a.energy + rec * dt);
      a.health = Math.min(t.maxHealth, a.health + t.maxHealth * 0.08 * dt);
      if (a.energy >= 0.95 && healthFrac > 0.6) {
        a.heading = rng.range(-Math.PI, Math.PI);
        a.homeBudget = 1;
        a.setState(AntState.Exploring);
      }
      break;
    }

    case AntState.InvestigatingAlarm: {
      const maxA = Math.max(s.alarmL, s.alarmA, s.alarmR, s.alarmHere);
      if (s.rivalSeen) {
        turn += s.rivalBearing * 1.2;
      } else if (maxA > 0.01) {
        turn += gradientTurn(s.alarmL, s.alarmA, s.alarmR, 0.8);
        turn += rng.gauss() * wanderBase * 0.6;
      } else {
        turn += rng.gauss() * wanderBase;
      }
      // Investigation is short-lived; aggressive colonies persist longer.
      const maxDur = 2.5 + 4 * t.aggression;
      if (a.stateTimer > maxDur || (maxA < 0.01 && !s.rivalSeen && a.stateTimer > 1.5)) {
        a.alarmCooldown = 12;
        a.setState(AntState.Exploring);
      }
      break;
    }

    case AntState.Fighting: {
      speedMul = 0;
      const tgt = a.target;
      if (!tgt || !tgt.alive || dist(a, tgt) > TUNING.contactRange * 1.8) {
        a.target = null;
        a.setState(carrying ? AntState.ReturningWithFood : AntState.Exploring);
        break;
      }
      turn += wrapAngle(Math.atan2(tgt.y - a.y, tgt.x - a.x) - a.heading) * 1.5;
      // The defender reacts to being hit (local contact only): timid colonies
      // tend to flee, others fight back.
      if (tgt.state !== AntState.Fighting && tgt.state !== AntState.Retreating) {
        const tcol = w.colonyById(tgt.colonyId);
        const tAggr = tcol ? tcol.traits.aggression : 0.5;
        if (rng.chance(clamp(0.6 - tAggr * 1.2, 0, 0.7))) {
          tgt.heading = Math.atan2(tgt.y - a.y, tgt.x - a.x) + rng.gauss() * 0.4;
          tgt.target = null;
          tgt.setState(AntState.Retreating);
        } else {
          tgt.target = a;
          tgt.setState(AntState.Fighting);
        }
      }
      const support = clamp(s.friends - s.rivals, -3, 3);
      const dmg = TUNING.damagePerSec * t.strength * (0.7 + 0.6 * rng.next()) * (1 + 0.15 * support) * dt;
      tgt.health -= dmg;
      ph.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * t.pheromoneProduction * dt);
      if (tgt.health <= 0) {
        w.killAnt(tgt, col);
        a.target = null;
        a.setState(carrying ? AntState.ReturningWithFood : AntState.Exploring);
        break;
      }
      a.retreatCheck += dt;
      if (a.retreatCheck > 0.5) {
        a.retreatCheck = 0;
        const fear = (1 - t.aggression) * 0.5 + avoidU * 0.3 - engageU * 0.2;
        if (healthFrac < TUNING.retreatHealth && rng.chance(clamp(fear, 0.05, 0.9))) {
          a.heading = Math.atan2(a.y - tgt.y, a.x - tgt.x) + rng.gauss() * 0.4;
          a.target = null;
          a.setState(AntState.Retreating);
        }
      }
      break;
    }

    case AntState.Retreating: {
      speedMul = 1.15;
      if (s.rivalSeen) turn += wrapAngle(s.rivalBearing + Math.PI) * 1.0;
      turn += rng.gauss() * wanderBase;
      ph.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * 0.5 * t.pheromoneProduction * dt);
      if (a.stateTimer > TUNING.fleeSeconds) {
        if (carrying) a.setState(AntState.ReturningWithFood);
        else if (healthFrac < 0.5) a.setState(AntState.FollowingHomeSignal);
        else a.setState(AntState.Exploring);
      }
      break;
    }

    case AntState.AvoidingObstacle: {
      // Steering handled by the universal obstacle rule below; keep a little wander.
      turn += rng.gauss() * wanderBase * 0.5;
      if (s.foodSeen && !carrying) turn += s.foodBearing * 0.8;
      if (s.nestSeen && carrying) turn += s.nestBearing * 0.8;
      break;
    }
  }

  // ---- rival handling (local perception only) -----------------------------
  if (s.rivalSeen && MOVING_STATES.has(a.state)) handleRival(w, a, col, engageU, avoidU, healthFrac, dt, (v) => { turn += v; });

  // ---- universal obstacle rule (safety layer) -----------------------------
  if (MOVING_STATES.has(a.state)) {
    if (s.obsF > 0.02 || s.obsL > 0.35 || s.obsR > 0.35) {
      if (a.avoidDir === 0) a.avoidDir = s.obsL > s.obsR ? 1 : s.obsR > s.obsL ? -1 : rng.sign();
      turn += a.avoidDir * (0.12 + 0.55 * s.obsF) + (s.obsL - s.obsR) * 0.35;
      a.avoidTimer = 0.5;
      if (s.obsF > 0.45 && a.state !== AntState.AvoidingObstacle && a.state !== AntState.Retreating) a.setState(AntState.AvoidingObstacle);
    } else if (a.avoidTimer > 0) {
      a.avoidTimer -= dt;
      if (a.avoidTimer <= 0) {
        a.avoidDir = 0;
        if (a.state === AntState.AvoidingObstacle) {
          const prev = a.prevState;
          a.setState(MOVING_STATES.has(prev) && prev !== AntState.AvoidingObstacle ? prev : carrying ? AntState.ReturningWithFood : AntState.Exploring);
        }
      }
    }
  }

  // ---- neural steering bias -----------------------------------------------
  turn += nnSteer * 0.6;
  if (a.stuck > 0.5 && rng.chance(0.1)) turn += rng.range(-2.5, 2.5);

  // ---- movement -----------------------------------------------------------
  const fwd = 1 + (0.8 + 0.3 * out[OUT_FORWARD] - 1) * inf; // network forward preference
  if (carrying) speedMul *= 0.82;
  speedMul *= 0.55 + 0.45 * healthFrac;
  if (a.energy < TUNING.lowEnergy) speedMul *= 0.65;
  speedMul *= clamp(fwd, 0.4, 1.15);
  const speed = t.speed * speedMul * a.variation;
  a.effectiveSpeed = speed;

  turn = clamp(turn, -TUNING.maxTurnPerTick, TUNING.maxTurnPerTick);
  a.lastTurn = turn;
  a.heading = wrapAngle(a.heading + turn);

  let moved = 0;
  if (speed > 0) {
    const step = speed * dt;
    const nx = a.x + Math.cos(a.heading) * step;
    const ny = a.y + Math.sin(a.heading) * step;
    const walls = w.walls;
    if (walls.isSolidWorld(a.x, a.y)) {
      // Buried by a wall drawn on top of us: dig out to the nearest free cell.
      const free = walls.nearestFree(a.x, a.y);
      if (free) {
        a.heading = Math.atan2(free.y - a.y, free.x - a.x);
        a.x = free.x; a.y = free.y;
        a.avoidDir = 0;
      }
    } else if (!walls.isSolidWorld(nx, ny)) {
      a.x = nx; a.y = ny; moved = step;
    } else if (!walls.isSolidWorld(nx, a.y)) {
      a.x = nx; moved = step * 0.5;
      a.heading = wrapAngle(a.heading + a.avoidDir * 0.3);
    } else if (!walls.isSolidWorld(a.x, ny)) {
      a.y = ny; moved = step * 0.5;
      a.heading = wrapAngle(a.heading + a.avoidDir * 0.3);
    } else {
      // pinned against geometry: rotate sharply
      a.heading = wrapAngle(a.heading + (a.avoidDir || rng.sign()) * rng.range(1.2, 2.6));
      a.stuck = Math.min(1, a.stuck + 0.15);
    }
  }

  // ---- pheromone deposits (universal, budget based) -----------------------
  const prod = t.pheromoneProduction;
  if (moved > 0) {
    if (carrying) {
      ph.deposit(PH_FOOD, a.x, a.y, TUNING.foodDepositPerSec * prod * a.foodBudget * dt);
      a.foodBudget *= Math.exp(-moved / TUNING.foodSignalRange);
    } else if (a.state !== AntState.Retreating) {
      ph.deposit(PH_HOME, a.x, a.y, TUNING.homeDepositPerSec * prod * a.homeBudget * dt);
      a.homeBudget *= Math.exp(-moved / TUNING.homeSignalRange);
    }
    ph.deposit(PH_EXPLORE, a.x, a.y, TUNING.exploreDepositPerSec * dt);
  }

  // ---- stuck detection (1s window) ----------------------------------------
  a.sampleTimer += dt;
  if (a.sampleTimer >= 1) {
    const d = Math.hypot(a.x - a.sampleX, a.y - a.sampleY);
    const expected = t.speed * a.sampleTimer * 0.15;
    if (MOVING_STATES.has(a.state) && d < expected) {
      a.stuck = Math.min(1, a.stuck + 0.5);
      a.heading = wrapAngle(a.heading + rng.range(-Math.PI, Math.PI));
      a.avoidDir = 0;
    } else {
      a.stuck = Math.max(0, a.stuck - 0.35);
    }
    a.sampleX = a.x; a.sampleY = a.y; a.sampleTimer = 0;
  }

  // ---- energy -------------------------------------------------------------
  if (a.state !== AntState.Resting) {
    let drain = TUNING.energyDrainPerSec * t.energyConsumption;
    if (carrying) drain *= 1.3;
    if (a.state === AntState.Fighting) drain *= 2;
    a.energy = Math.max(0, a.energy - drain * dt);
  }
}

function dist(a: Ant, b: Ant): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function deliver(w: World, a: Ant, col: Colony): void {
  col.storedFood += a.carrying;
  col.collected += a.carrying;
  col.trips++;
  if (col.trips === 1) w.logEvent(`${col.name} delivered its first food (ant #${a.id})`, col.color);
  else if (col.trips % 100 === 0) w.logEvent(`${col.name} completed ${col.trips} trips`, col.color);
  a.carrying = 0;
  a.foodBudget = 0;
  a.homeBudget = 1;
  a.energy = Math.min(1, a.energy + TUNING.deliveryEnergy);
  a.heading = wrapAngle(a.heading + Math.PI + w.rng.gauss() * 0.5);
  a.frustration = 0;
  if (a.energy < TUNING.lowEnergy + 0.1) a.setState(AntState.Resting);
  else a.setState(AntState.Exploring);
}

function maybeInvestigateAlarm(w: World, a: Ant, t: Colony['traits'], alarmU: number): void {
  const s = a.senses;
  const maxA = Math.max(s.alarmL, s.alarmA, s.alarmR, s.alarmHere);
  if (maxA < 0.03 || a.alarmCooldown > 0) return;
  const u = alarmU + (t.aggression - 0.55) * 3 + maxA;
  if (u > 0 && w.rng.chance(0.03 * u)) a.setState(AntState.InvestigatingAlarm);
}

function handleRival(
  w: World, a: Ant, col: Colony, engageU: number, avoidU: number, healthFrac: number, dt: number, addTurn: (v: number) => void,
): void {
  const s = a.senses, t = col.traits;
  const rival = w.ants[s.rivalIndex];
  if (!rival || !rival.alive) return;
  const carrying = a.carrying > 0;
  const adv = clamp((s.friends - s.rivals) / 3, -1, 1);
  const carryPenalty = carrying ? 1 : 0;
  const investigating = a.state === AntState.InvestigatingAlarm ? 0.2 : 0;
  // Aggression is the dominant term: ~0.3 practically never initiates, ~0.35-0.45
  // fights only when healthy and clearly outnumbering, 0.6+ picks fights readily.
  const eng = engageU + (t.aggression - 0.55) * 4 + 0.4 * adv + 0.5 * (healthFrac - 0.5) - carryPenalty + investigating;
  const avd = avoidU + (0.6 - t.aggression) * 2.5 + (1 - healthFrac) + carryPenalty * 0.5;

  if (s.rivalDist < TUNING.contactRange) {
    if (eng > avd && rival.state !== AntState.Resting && w.rng.chance(sigmoid(eng))) {
      a.target = rival;
      a.retreatCheck = 0;
      a.setState(AntState.Fighting);
      col.pheromones.deposit(PH_ALARM, a.x, a.y, 0.2 * t.pheromoneProduction);
      return;
    }
    if (avd > 0) addTurn(wrapAngle(s.rivalBearing + Math.PI) * 0.8);
    if (a.state === AntState.InvestigatingAlarm) {
      // Looked, decided not to engage: go back to work.
      a.alarmCooldown = 12;
      a.setState(AntState.Exploring);
    }
  } else if (eng > 0.6 && !carrying && a.state !== AntState.InvestigatingAlarm && a.alarmCooldown <= 0 && w.rng.chance(0.05 * eng)) {
    a.setState(AntState.InvestigatingAlarm); // approach / confront
  }
  // Only genuinely aggressive ants raise alarm from mere proximity; fights and
  // retreats always do (see Fighting / Retreating states).
  if (s.rivalDist < TUNING.contactRange * 2.5 && t.aggression > 0.4) {
    const k = (t.aggression - 0.4) / 0.6;
    col.pheromones.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * 0.4 * k * t.pheromoneProduction * dt);
  }
}
