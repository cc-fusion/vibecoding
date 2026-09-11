/**
 * Tiny feed-forward policy network shared by all ants of a colony.
 *
 *   24 inputs -> 20 ReLU hidden -> 8 tanh outputs
 *
 * The baseline weights are hand-designed so the simulation works with no
 * training: hidden neurons act as small "feature detectors" (e.g. "food
 * gradient to the right while NOT carrying food"). ReLU + a large negative
 * bias term driven by the `carrying` input gives cheap gating, so the same
 * network steers outbound ants along food gradients and inbound ants along
 * home gradients. Colony presets add structured variation on top of this and
 * users may mutate / randomise the weights further.
 */
import { NN_HIDDEN, NN_INPUTS, NN_OUTPUTS } from './constants';
import type { Rng } from './rng';

export interface Policy {
  w1: Float32Array; // [hidden][input]
  b1: Float32Array; // [hidden]
  w2: Float32Array; // [output][hidden]
  b2: Float32Array; // [output]
}

// Input indices (must match ant sensing order)
export const IN = {
  FOOD_L: 0, FOOD_A: 1, FOOD_R: 2,
  HOME_L: 3, HOME_A: 4, HOME_R: 5,
  ALARM: 6, EXPLORE: 7,
  OBS_F: 8, OBS_L: 9, OBS_R: 10,
  FOOD_SEEN: 11, FOOD_BEARING: 12,
  NEST_SEEN: 13, NEST_BEARING: 14,
  RIVAL_NEAR: 15, RIVAL_BEARING: 16,
  FRIENDS: 17, CARRYING: 18, HEALTH: 19, ENERGY: 20, HOME_BUDGET: 21, STUCK: 22, NOISE: 23,
} as const;

export function emptyPolicy(): Policy {
  return {
    w1: new Float32Array(NN_HIDDEN * NN_INPUTS),
    b1: new Float32Array(NN_HIDDEN),
    w2: new Float32Array(NN_OUTPUTS * NN_HIDDEN),
    b2: new Float32Array(NN_OUTPUTS),
  };
}

export function clonePolicy(p: Policy): Policy {
  return { w1: new Float32Array(p.w1), b1: new Float32Array(p.b1), w2: new Float32Array(p.w2), b2: new Float32Array(p.b2) };
}

/** Behavioural "flavour" knobs used to derive preset policies. */
export interface PolicyProfile {
  trailGain: number;     // how strongly pheromone gradients steer
  visionGain: number;    // how strongly directly seen food/nest steer
  wallGain: number;      // obstacle steering strength
  noiseGain: number;     // random steering contribution
  alarmGain: number;     // alarm response utility
  engageGain: number;    // rival engagement utility
  caution: number;       // health/energy driven retreat/home bias
}

export const DEFAULT_PROFILE: PolicyProfile = {
  trailGain: 1.0, visionGain: 1.0, wallGain: 1.0, noiseGain: 1.0, alarmGain: 1.0, engageGain: 1.0, caution: 1.0,
};

/**
 * Build the baseline policy. Hidden neuron roles:
 *  0/1  food gradient right/left   (outbound only)
 *  2/3  home gradient right/left   (carrying only)
 *  4/5  seen food right/left       (outbound only)
 *  6/7  seen nest right/left       (carrying only)
 *  8/9  obstacle left/right (steer away)
 *  10   obstacle ahead
 *  11   trail presence (food pheromone anywhere in probes)
 *  12   alarm level
 *  13   rival proximity
 *  14   friendly density
 *  15   low energy
 *  16   low health
 *  17   stuck
 *  18/19 noise +/-
 */
export function buildBaselinePolicy(profile: PolicyProfile = DEFAULT_PROFILE): Policy {
  const p = emptyPolicy();
  const W1 = (h: number, i: number, v: number) => { p.w1[h * NN_INPUTS + i] = v; };
  const B1 = (h: number, v: number) => { p.b1[h] = v; };
  const W2 = (o: number, h: number, v: number) => { p.w2[o * NN_HIDDEN + h] = v; };
  const B2 = (o: number, v: number) => { p.b2[o] = v; };

  // -- gradient detectors (gated by carrying flag) --
  W1(0, IN.FOOD_R, 3); W1(0, IN.FOOD_L, -3); W1(0, IN.CARRYING, -6);
  W1(1, IN.FOOD_L, 3); W1(1, IN.FOOD_R, -3); W1(1, IN.CARRYING, -6);
  W1(2, IN.HOME_R, 3); W1(2, IN.HOME_L, -3); W1(2, IN.CARRYING, 6); B1(2, -6);
  W1(3, IN.HOME_L, 3); W1(3, IN.HOME_R, -3); W1(3, IN.CARRYING, 6); B1(3, -6);
  // -- direct perception --
  W1(4, IN.FOOD_BEARING, 2); W1(4, IN.CARRYING, -6);
  W1(5, IN.FOOD_BEARING, -2); W1(5, IN.CARRYING, -6);
  W1(6, IN.NEST_BEARING, 2); W1(6, IN.CARRYING, 6); B1(6, -6);
  W1(7, IN.NEST_BEARING, -2); W1(7, IN.CARRYING, 6); B1(7, -6);
  // -- obstacles --
  W1(8, IN.OBS_L, 1.5); W1(8, IN.OBS_R, -1.5);
  W1(9, IN.OBS_R, 1.5); W1(9, IN.OBS_L, -1.5);
  W1(10, IN.OBS_F, 1.5);
  // -- trail presence --
  W1(11, IN.FOOD_L, 1); W1(11, IN.FOOD_A, 1.2); W1(11, IN.FOOD_R, 1); B1(11, -0.05);
  // -- social --
  W1(12, IN.ALARM, 1.5);
  W1(13, IN.RIVAL_NEAR, 1.5);
  W1(14, IN.FRIENDS, 1.2);
  // -- internal state --
  W1(15, IN.ENERGY, -2); B1(15, 0.8);   // active when energy < 0.4
  W1(16, IN.HEALTH, -2); B1(16, 1.0);   // active when health < 0.5
  W1(17, IN.STUCK, 1.5);
  W1(18, IN.NOISE, 1.5);
  W1(19, IN.NOISE, -1.5);

  const tg = profile.trailGain, vg = profile.visionGain, wg = profile.wallGain;
  const ng = profile.noiseGain, ag = profile.alarmGain, eg = profile.engageGain, cg = profile.caution;

  // steer
  W2(0, 0, 0.9 * tg); W2(0, 1, -0.9 * tg); W2(0, 2, 0.9 * tg); W2(0, 3, -0.9 * tg);
  W2(0, 4, 1.2 * vg); W2(0, 5, -1.2 * vg); W2(0, 6, 1.2 * vg); W2(0, 7, -1.2 * vg);
  W2(0, 8, 1.0 * wg); W2(0, 9, -1.0 * wg);
  W2(0, 18, 0.2 * ng); W2(0, 19, -0.2 * ng);
  // forward preference: slow near walls, hurry when carrying is handled by rules
  B2(1, 0.8); W2(1, 10, -1.6 * wg); W2(1, 13, -0.3);
  // trail follow strength
  B2(2, 0.2); W2(2, 11, 1.2 * tg); W2(2, 15, -0.4); W2(2, 17, -0.8);
  // exploration / deviation tendency
  B2(3, 0.1); W2(3, 11, -0.8 * tg); W2(3, 17, 1.2); W2(3, 18, 0.5 * ng); W2(3, 15, -0.5 * cg);
  // alarm response utility
  B2(4, -0.3); W2(4, 12, 1.6 * ag); W2(4, 13, 0.4 * ag); W2(4, 14, 0.4); W2(4, 16, -1.2 * cg); W2(4, 15, -0.8 * cg);
  // engage utility
  B2(5, -0.4); W2(5, 13, 1.0 * eg); W2(5, 14, 0.6 * eg); W2(5, 12, 0.4 * ag); W2(5, 16, -1.6 * cg); W2(5, 15, -0.8 * cg);
  // avoid / retreat utility
  B2(6, -0.2); W2(6, 13, 0.9); W2(6, 16, 1.6 * cg); W2(6, 14, -0.6 * eg); W2(6, 12, 0.3);
  // go-home bias
  B2(7, -0.6); W2(7, 15, 1.8 * cg); W2(7, 16, 1.0 * cg);
  return p;
}

/** In-place forward pass. `inputs` length NN_INPUTS, `out` length NN_OUTPUTS, `hidden` scratch. */
export function forward(p: Policy, inputs: Float32Array, hidden: Float32Array, out: Float32Array): void {
  const w1 = p.w1, b1 = p.b1, w2 = p.w2, b2 = p.b2;
  for (let h = 0; h < NN_HIDDEN; h++) {
    let s = b1[h];
    const base = h * NN_INPUTS;
    for (let i = 0; i < NN_INPUTS; i++) s += w1[base + i] * inputs[i];
    hidden[h] = s > 0 ? s : 0;
  }
  for (let o = 0; o < NN_OUTPUTS; o++) {
    let s = b2[o];
    const base = o * NN_HIDDEN;
    for (let h = 0; h < NN_HIDDEN; h++) s += w2[base + h] * hidden[h];
    out[o] = Math.tanh(s);
  }
}

/** Add gaussian noise to every weight (scaled so behaviour shifts but stays sane). */
export function mutatePolicy(p: Policy, rng: Rng, amount = 0.15): Policy {
  const q = clonePolicy(p);
  const jitter = (arr: Float32Array, scale: number) => {
    for (let i = 0; i < arr.length; i++) {
      // mostly perturb existing connections; occasionally grow a new small one
      if (arr[i] !== 0 || rng.chance(0.05)) arr[i] += rng.gauss() * scale;
    }
  };
  jitter(q.w1, amount * 0.6);
  jitter(q.b1, amount * 0.4);
  jitter(q.w2, amount);
  jitter(q.b2, amount * 0.6);
  clampPolicy(q);
  return q;
}

/** Fully random policy within safe bounds (baseline structure + strong noise). */
export function randomPolicy(rng: Rng): Policy {
  const profile: PolicyProfile = {
    trailGain: rng.range(0.4, 1.8), visionGain: rng.range(0.5, 1.6), wallGain: rng.range(0.7, 1.4),
    noiseGain: rng.range(0.3, 2.2), alarmGain: rng.range(0.2, 2.0), engageGain: rng.range(0.2, 2.0), caution: rng.range(0.3, 1.8),
  };
  return mutatePolicy(buildBaselinePolicy(profile), rng, 0.3);
}

function clampPolicy(p: Policy) {
  const c = (arr: Float32Array, lim: number) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.max(-lim, Math.min(lim, arr[i]));
  };
  c(p.w1, 8); c(p.b1, 8); c(p.w2, 4); c(p.b2, 3);
}

export function serializePolicy(p: Policy) {
  return { w1: Array.from(p.w1), b1: Array.from(p.b1), w2: Array.from(p.w2), b2: Array.from(p.b2) };
}

export function deserializePolicy(d: { w1: number[]; b1: number[]; w2: number[]; b2: number[] } | undefined): Policy | null {
  if (!d || !d.w1 || d.w1.length !== NN_HIDDEN * NN_INPUTS || d.w2.length !== NN_OUTPUTS * NN_HIDDEN) return null;
  return { w1: Float32Array.from(d.w1), b1: Float32Array.from(d.b1), w2: Float32Array.from(d.w2), b2: Float32Array.from(d.b2) };
}
