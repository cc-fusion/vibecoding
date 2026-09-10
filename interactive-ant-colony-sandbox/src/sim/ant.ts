import { SIM } from './config';
import type { Ant, PheromoneType } from './types';
import { foodRadius, type Colony, type World } from './world';

// ---------------------------------------------------------------------------
// Ant behaviour. Every rule below uses only information available within the
// ant's sense range: nearby food/nests/ants (line-of-sight checked), and the
// concentrations of its own colony's pheromones sampled a short distance
// ahead. There is no global pathfinding and no access to distant objects.
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;
const samples = new Float64Array(SIM.sampleAngles.length); // reused, no per-ant allocation

function wrap(a: number) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

/** Blend heading toward a desired absolute angle. */
function steer(a: Ant, desired: number, rate: number) {
  a.heading += wrap(desired - a.heading) * rate;
}

/**
 * Sample a pheromone channel at several angles around the ant's heading.
 * Returns the *strongest* sampled value; fills `samples` with all values.
 * Cells behind walls / outside the world read as zero.
 */
function samplePheromone(w: World, c: Colony, a: Ant, type: PheromoneType, dist: number): number {
  const ch = c.pheromones.channels[type];
  const sens = c.traits.pheromoneSensitivity;
  let best = 0;
  for (let i = 0; i < SIM.sampleAngles.length; i++) {
    const ang = a.heading + SIM.sampleAngles[i];
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const sx = a.x + cx * dist;
    const sy = a.y + cy * dist;
    let v = 0;
    // Antennae cannot "smell through rock": check two intermediate points along the probe.
    if (
      !w.isWall(sx, sy) &&
      !w.isWall(a.x + cx * dist * 0.66, a.y + cy * dist * 0.66) &&
      !w.isWall(a.x + cx * dist * 0.33, a.y + cy * dist * 0.33)
    )
      v = ch[w.cellIndexAt(sx, sy)] * sens;
    samples[i] = v;
    if (v > best) best = v;
  }
  return best;
}

/**
 * Probabilistic direction choice from the last sample set: directions with
 * stronger signal are proportionally more likely (squared to sharpen), but
 * weaker ones still get picked sometimes — this keeps trails "organized but
 * imperfect" and lets ants discover shortcuts.
 */
function chooseSampledDirection(w: World, a: Ant): number {
  let total = 0;
  for (let i = 0; i < samples.length; i++) total += samples[i] * samples[i] + 1e-6;
  let r = w.rng.next() * total;
  for (let i = 0; i < samples.length; i++) {
    r -= samples[i] * samples[i] + 1e-6;
    if (r <= 0) return a.heading + SIM.sampleAngles[i];
  }
  return a.heading;
}

/** Direction of the *weakest* sample (used to avoid over-explored areas). */
function weakestSampledDirection(a: Ant): number {
  let bi = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i] < samples[bi]) bi = i;
  return a.heading + SIM.sampleAngles[bi];
}

function sampleDistance(c: Colony) {
  const d = c.traits.senseRange * 0.55;
  return d < 10 ? 10 : d > 28 ? 28 : d;
}

// ------------------------------------------------------------------ main
export function updateAnt(w: World, a: Ant, c: Colony) {
  const T = c.traits;
  const rng = w.rng;
  a.age++;
  if (a.attackCooldown > 0) a.attackCooldown--;
  if (a.avoidTimer > 0) a.avoidTimer--;

  // ---- energy & starvation ------------------------------------------------
  if (a.state !== 'resting') {
    a.energy -= SIM.baseEnergyPerTick * T.energyUse;
    if (a.energy <= 0) {
      a.energy = 0;
      a.health -= SIM.starveDamagePerTick;
      if (a.health <= 0) return;
    }
  }

  // ---- perception snapshot at own position (for the inspector) -------------
  const idx = w.cellIndexAt(a.x, a.y);
  const ph = c.pheromones;
  const sens = T.pheromoneSensitivity;
  a.senseFood = ph.channels.food[idx] * sens;
  a.senseHome = ph.channels.home[idx] * sens;
  a.senseAlarm = ph.channels.alarm[idx] * sens;
  a.senseExplore = ph.channels.explore[idx] * sens;
  a.seesFood = false;
  a.seesNest = false;

  const sDist = sampleDistance(c);
  const injured = a.health / T.maxHealth;
  let speed = T.speed * (0.55 + 0.45 * injured) * (a.energy <= 0 ? 0.6 : 1);
  if (a.carrying > 0) speed *= 0.85;

  switch (a.state) {
    // ------------------------------------------------------- outbound
    case 'exploring':
    case 'followingFood': {
      if (a.energy < SIM.hungerThreshold) {
        a.state = 'homing';
        break;
      }
      // At home? refresh home signal + path memory (the ant *knows* it is at its nest).
      if (a.age % 5 === 0) {
        const home = w.findVisibleNest(a, 0);
        if (home) {
          a.homeSignal = 1;
          a.memX = 0;
          a.memY = 0;
          a.memValid = true;
          a.seesNest = true;
        }
      }
      // Directly visible food wins over everything (unless the ant recently gave up on unreachable food).
      if (a.foodBlind > 0) a.foodBlind--;
      const f = a.foodBlind > 0 ? undefined : w.findVisibleFood(a, T.senseRange);
      if (f) {
        a.seesFood = true;
        a.targetFoodId = f.id;
        a.state = 'collecting';
        a.timer = 0;
        break;
      }
      if (perceiveThreats(w, a, c, idx)) break;

      if (a.timer > 0) a.timer--; // "trail blindness" window after deliberately leaving a trail
      const best = a.timer > 0 ? 0 : samplePheromone(w, c, a, 'food', sDist);
      let following = false;
      if (best > SIM.detectFloor) {
        if (a.state === 'followingFood') {
          // Exploratory ants occasionally abandon a trail to look for shortcuts / new food.
          if (rng.next() < SIM.trailIgnoreBase * (0.2 + T.exploration * 2.5)) {
            a.timer = 60 + T.exploration * 240;
            a.heading += rng.gauss() * 1.2;
          } else following = true;
        } else if (rng.next() < 0.06 + 0.3 * (1 - T.exploration)) {
          following = true; // decided to join a trail
        }
      }
      if (following) {
        a.state = 'followingFood';
        steer(a, chooseSampledDirection(w, a), SIM.turnRate);
        a.heading += rng.gauss() * SIM.wanderJitter * 0.35;
      } else {
        a.state = 'exploring';
        // Weak repulsion from heavily explored empty areas (exploration pheromone).
        const ex = samplePheromone(w, c, a, 'explore', sDist);
        if (ex > 0.25 && rng.next() < 0.25) steer(a, weakestSampledDirection(a), 0.15);
        a.heading += rng.gauss() * SIM.wanderJitter * (0.55 + T.exploration);
      }
      // Outbound ants lay a home signal whose strength fades with time since leaving the nest,
      // plus a faint exploration marker.
      ph.deposit('home', idx, SIM.depositHome * T.pheromoneStrength * a.homeSignal);
      ph.deposit('explore', idx, SIM.depositExplore * T.pheromoneStrength);
      a.homeSignal *= 0.9975;
      move(w, a, speed);
      break;
    }

    // --------------------------------------------------- collecting
    case 'collecting': {
      const f = w.foodById(a.targetFoodId);
      if (!f || f.amount <= 0) {
        a.state = 'exploring';
        a.targetFoodId = -1;
        break;
      }
      a.seesFood = true;
      const d = Math.hypot(f.x - a.x, f.y - a.y);
      if (d > foodRadius(f) + 3) {
        steer(a, Math.atan2(f.y - a.y, f.x - a.x), 0.45);
        ph.deposit('home', idx, SIM.depositHome * T.pheromoneStrength * a.homeSignal);
        a.homeSignal *= 0.9975;
        move(w, a, speed);
        // give up if blocked for too long (food behind a wall it can't reach)
        if (++a.timer > 400) {
          a.state = 'exploring';
          a.timer = 0;
          a.foodBlind = 300;
          a.heading += Math.PI * 0.7;
        }
      } else if (a.timer >= 0) {
        a.timer = -SIM.collectTicks; // arrived: start the (stationary) collection countdown
      } else if (++a.timer >= 0) {
        const take = Math.min(T.carryCapacity, f.amount);
        f.amount -= take;
        a.carrying = take;
        a.foodSignal = 1;
        a.state = 'returning';
        a.heading += Math.PI + rng.gauss() * 0.4;
        a.timer = 0;
      }
      break;
    }

    // ------------------------------------------------------- inbound
    case 'returning':
    case 'homing': {
      const nest = w.findVisibleNest(a, T.senseRange * SIM.nestSenseBonus);
      if (nest) {
        a.seesNest = true;
        const d = Math.hypot(nest.x - a.x, nest.y - a.y);
        if (d < nest.radius * 0.8) {
          // Delivery: food enters colony storage.
          if (a.carrying > 0) {
            c.storedFood += a.carrying;
            c.totalCollected += a.carrying;
            a.carrying = 0;
          }
          a.foodSignal = 0;
          a.homeSignal = 1;
          a.memX = 0;
          a.memY = 0;
          a.memValid = true;
          if (a.energy < SIM.hungerThreshold + 0.15 || a.health < T.maxHealth * 0.6) {
            a.state = 'resting';
          } else {
            a.state = 'exploring';
            a.heading = rng.range(0, TWO_PI);
          }
          break;
        }
        steer(a, Math.atan2(nest.y - a.y, nest.x - a.x), 0.4);
      } else {
        const best = samplePheromone(w, c, a, 'home', sDist);
        if (best > SIM.detectFloor) {
          // Faint signal → weak steering; strong signal → committed following.
          const conf = Math.min(1, best / 0.08);
          steer(a, chooseSampledDirection(w, a), SIM.turnRate * (0.35 + 0.65 * conf));
        }
        if (w.pathMemory && a.memValid && Math.hypot(a.memX, a.memY) > 25) {
          // Noisy path-integration memory (imperfect; drifts with distance). Strong when the
          // home signal is absent, only a faint nudge when the ant is on a good signal — this
          // also keeps ants from circling local maxima of the home field.
          const conf = Math.min(1, best / 0.08);
          steer(a, Math.atan2(a.memY, a.memX), 0.02 + 0.1 * (1 - conf));
        }
        a.heading += rng.gauss() * SIM.wanderJitter * 0.6;
      }
      if (a.state === 'returning') {
        // Food trail: strongest near the food, fading toward the nest → usable gradient.
        ph.deposit('food', idx, SIM.depositFood * T.pheromoneStrength * a.foodSignal);
        a.foodSignal *= 0.9985;
      }
      if (a.age % 2 === 0) perceiveThreats(w, a, c, idx, true);
      move(w, a, speed);
      break;
    }

    // ------------------------------------------------------- resting
    case 'resting': {
      const need = SIM.restEnergyPerTick;
      const cost = need * SIM.restFoodPerEnergy;
      if (c.storedFood >= cost) {
        c.storedFood -= cost;
        a.energy += need;
      } else {
        a.energy += need * 0.3; // forgiving: slow recovery even when the larder is empty
      }
      if (a.health < T.maxHealth) a.health = Math.min(T.maxHealth, a.health + SIM.healPerTick);
      a.heading += rng.gauss() * 0.1;
      if (a.energy >= SIM.restUntil) {
        a.energy = Math.min(1, a.energy);
        a.state = 'exploring';
        a.homeSignal = 1;
        a.heading = rng.range(0, TWO_PI);
      }
      break;
    }

    // -------------------------------------------------- investigating
    case 'investigating': {
      if (--a.timer <= 0) {
        a.state = 'exploring';
        break;
      }
      if (perceiveThreats(w, a, c, idx)) break;
      const best = samplePheromone(w, c, a, 'alarm', sDist);
      if (best > SIM.detectFloor) steer(a, chooseSampledDirection(w, a), SIM.turnRate);
      else a.heading += rng.gauss() * SIM.wanderJitter;
      ph.deposit('home', idx, SIM.depositHome * T.pheromoneStrength * a.homeSignal);
      a.homeSignal *= 0.9975;
      move(w, a, speed * 1.1);
      break;
    }

    // ------------------------------------------------------- fighting
    case 'fighting': {
      const t = w.antById(a.targetAntId);
      if (!t || t.health <= 0 || t.colonyId === a.colonyId) {
        a.targetAntId = -1;
        a.state = a.carrying > 0 ? 'returning' : 'exploring';
        break;
      }
      const dx = t.x - a.x;
      const dy = t.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > T.senseRange * 1.2) {
        a.targetAntId = -1;
        a.state = a.carrying > 0 ? 'returning' : 'exploring';
        break;
      }
      // Badly hurt and not very aggressive → break off
      if (a.health < T.maxHealth * SIM.fleeHealthFraction && rng.next() < (1 - T.aggression) * 0.05) {
        a.state = 'fleeing';
        a.timer = 120;
        a.heading = Math.atan2(-dy, -dx);
        break;
      }
      ph.deposit('alarm', idx, SIM.depositAlarm * T.pheromoneStrength * 0.5);
      steer(a, Math.atan2(dy, dx), 0.6);
      if (d > SIM.contactRange) move(w, a, speed);
      else if (a.attackCooldown <= 0) attack(w, a, t, c);
      break;
    }

    // -------------------------------------------------------- fleeing
    case 'fleeing': {
      if (--a.timer <= 0) {
        a.state = a.carrying > 0 ? 'returning' : 'exploring';
        break;
      }
      ph.deposit('alarm', idx, SIM.depositAlarm * T.pheromoneStrength * 0.3);
      a.heading += rng.gauss() * 0.3;
      move(w, a, speed * 1.15);
      break;
    }
  }
}

// ---------------------------------------------------------------- threats
/**
 * Look for rival ants and alarm signal. Returns true if the ant changed state.
 * Runs every other tick (cheap enough with the spatial hash).
 */
function perceiveThreats(w: World, a: Ant, c: Colony, idx: number, passive = false): boolean {
  if (a.age % 2 !== 0) return false;
  const T = c.traits;
  const range = T.senseRange;
  let rival: Ant | undefined;
  let rd = Infinity;
  let enemies = 0;
  w.forEachAntNear(a.x, a.y, range, (o) => {
    if (o.colonyId === a.colonyId || o.health <= 0) return;
    enemies++;
    const d = (o.x - a.x) ** 2 + (o.y - a.y) ** 2;
    if (d < rd) {
      rd = d;
      rival = o;
    }
  });
  a.seesEnemies = enemies;
  const rng = w.rng;
  const ph = c.pheromones;

  if (rival) {
    const r = rival as Ant;
    const d = Math.sqrt(rd);
    const ag = T.aggression;
    // Rival at threatening distance → release alarm (touchy colonies raise the alarm more readily)
    if (d < range * 0.4) ph.deposit('alarm', idx, SIM.depositAlarm * T.pheromoneStrength * (0.15 + ag * 0.5));
    if (!passive && ag >= 0.08) {
      const alarmHere = Math.min(1, a.senseAlarm);
      // Cubic in aggression: default (~0.3) colonies rarely start fights; ~1.0 colonies almost always do.
      let chance = ag * ag * ag * 0.1 + ag * ag * alarmHere * 0.1;
      if (a.state === 'investigating') chance += ag * ag * 0.5;
      if (d < range * 0.7 && rng.next() < chance) {
        a.state = 'fighting';
        a.targetAntId = r.id;
        return true;
      }
    }
    // Peaceful ants keep their distance from rivals
    if (ag < 0.25 && d < range * 0.6) {
      steer(a, Math.atan2(a.y - r.y, a.x - r.x), 0.2 * (1 - ag / 0.25));
    }
  }

  if (!passive && (a.state === 'exploring' || a.state === 'followingFood')) {
    const best = samplePheromone(w, c, a, 'alarm', sampleDistance(c));
    if (best > 0.03) {
      const chance = T.aggression * T.aggression * 0.15 + Math.min(best, 1) * 0.02;
      if (rng.next() < chance) {
        a.state = 'investigating';
        a.timer = SIM.alarmInvestigateTicks;
        steer(a, chooseSampledDirection(w, a), 0.8);
        return true;
      }
    }
  }
  return false;
}

// ----------------------------------------------------------------- combat
function attack(w: World, attacker: Ant, victim: Ant, c: Colony) {
  attacker.attackCooldown = SIM.attackInterval;
  const vc = w.colonyById(victim.colonyId);
  if (!vc) return;
  // Local numerical advantage
  let allies = 0;
  let enemies = 0;
  w.forEachAntNear(attacker.x, attacker.y, 30, (o) => {
    if (o.health <= 0) return;
    if (o.colonyId === attacker.colonyId) allies++;
    else if (o.colonyId === victim.colonyId) enemies++;
  });
  let adv = 1 + 0.15 * (allies - enemies);
  adv = adv < 0.6 ? 0.6 : adv > 1.6 ? 1.6 : adv;
  const dmg = c.traits.strength * w.rng.range(0.6, 1.4) * adv;
  victim.health -= dmg;
  const vIdx = w.cellIndexAt(victim.x, victim.y);
  vc.pheromones.deposit('alarm', vIdx, SIM.depositAlarm * vc.traits.pheromoneStrength);
  if (victim.health <= 0) {
    c.kills++;
    return;
  }
  // Victim response: fight back, or run if weak / peaceful
  if (victim.state !== 'fighting' && victim.state !== 'fleeing') {
    const vt = vc.traits;
    const weak = victim.health < vt.maxHealth * SIM.fleeHealthFraction;
    if ((weak && w.rng.next() < 0.8) || (vt.aggression < 0.15 && w.rng.next() < 0.6)) {
      victim.state = 'fleeing';
      victim.timer = 100;
      victim.heading = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
    } else {
      victim.state = 'fighting';
      victim.targetAntId = attacker.id;
    }
  }
}

// --------------------------------------------------------------- movement
/**
 * Move forward with local obstacle avoidance ("whiskers"): three short probes
 * detect rock ahead and turn the ant toward the open side. No global routing.
 */
function move(w: World, a: Ant, speed: number) {
  const L = SIM.whiskerLength;
  const fwdBlocked = w.isWall(a.x + Math.cos(a.heading) * L, a.y + Math.sin(a.heading) * L);
  const lh = a.heading - SIM.whiskerAngle;
  const rh = a.heading + SIM.whiskerAngle;
  const leftBlocked = w.isWall(a.x + Math.cos(lh) * L * 0.8, a.y + Math.sin(lh) * L * 0.8);
  const rightBlocked = w.isWall(a.x + Math.cos(rh) * L * 0.8, a.y + Math.sin(rh) * L * 0.8);
  if (fwdBlocked || leftBlocked || rightBlocked) {
    a.avoidTimer = 8;
    if (fwdBlocked && leftBlocked && rightBlocked) {
      a.heading += Math.PI + w.rng.gauss() * 0.8;
    } else if (fwdBlocked) {
      if (leftBlocked) a.heading += 0.5;
      else if (rightBlocked) a.heading -= 0.5;
      else a.heading += w.rng.next() < 0.5 ? 0.5 : -0.5;
    } else if (leftBlocked) a.heading += 0.25;
    else a.heading -= 0.25;
  }
  const dx = Math.cos(a.heading) * speed;
  const dy = Math.sin(a.heading) * speed;
  const nx = a.x + dx;
  const ny = a.y + dy;
  if (w.isWall(nx, ny)) {
    a.heading += Math.PI * 0.5 + w.rng.next() * Math.PI; // bumped into rock; turn away
    a.avoidTimer = 8;
    return;
  }
  a.x = nx;
  a.y = ny;
  // Path-integration memory with a per-ant systematic bias + random drift.
  const cb = Math.cos(a.memBias);
  const sb = Math.sin(a.memBias);
  a.memX -= dx * cb - dy * sb + w.rng.gauss() * speed * 0.6;
  a.memY -= dx * sb + dy * cb + w.rng.gauss() * speed * 0.6;
  a.heading = wrap(a.heading);
}
