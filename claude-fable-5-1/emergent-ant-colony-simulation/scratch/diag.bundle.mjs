// src/sim/constants.ts
var WORLD_W = 1600;
var WORLD_H = 1e3;
var CELL = 8;
var GRID_W = WORLD_W / CELL;
var GRID_H = WORLD_H / CELL;
var SIM_DT = 1 / 30;
var DIFFUSE_INTERVAL = 3;
var PH_FOOD = 0;
var PH_HOME = 1;
var PH_ALARM = 2;
var PH_EXPLORE = 3;
var PH_COUNT = 4;
var PHEROMONE_DEFS = [
  { key: "food", label: "Food trail", evaporation: 0.028, diffusion: 0.025 },
  { key: "home", label: "Home", evaporation: 0.012, diffusion: 0.02 },
  { key: "alarm", label: "Alarm", evaporation: 0.22, diffusion: 0.09 },
  { key: "explore", label: "Exploration", evaporation: 0.05, diffusion: 0 }
];
var TUNING = {
  // Deposits are "per second" and multiplied by colony production & signal budget.
  foodDepositPerSec: 1,
  homeDepositPerSec: 1,
  exploreDepositPerSec: 0.12,
  alarmDepositPerSec: 3.5,
  /** Travel distance (world units) over which a signal budget decays by 1/e. */
  foodSignalRange: 600,
  homeSignalRange: 900,
  /** Pheromone probe geometry (local sampling ahead-left / ahead / ahead-right). */
  probeDist: 14,
  probeAngle: 0.75,
  /** Obstacle probes. */
  obstacleProbeLen: 20,
  obstacleProbeAngle: 0.65,
  obstacleProbeStep: 4,
  maxTurnPerTick: 0.38,
  // radians
  baseWander: 0.085,
  // gaussian sigma of random turn per tick
  /** Below this (sensitivity-scaled) concentration a trail is not perceived. */
  trailThreshold: 0.012,
  contactRange: 7,
  // world units for combat contact
  collectTime: 0.7,
  // seconds spent picking up food
  encounterMargin: 4,
  // extra radius around food/nest where contact counts
  energyDrainPerSec: 32e-4,
  restRecoverPerSec: 0.22,
  restFoodBoost: 0.25,
  // extra recovery per second if colony has stored food
  restFoodCostPerSec: 0.02,
  deliveryEnergy: 0.3,
  // energy restored when delivering food
  lowEnergy: 0.22,
  // below this ants prefer heading home
  damagePerSec: 9,
  retreatHealth: 0.3,
  fleeSeconds: 3,
  growthCost: 4,
  // stored food per new ant
  growthInterval: 3,
  // seconds between growth checks per colony
  maxColonyPop: 1500,
  depletedLingerSec: 10,
  /** Territory metric: cells whose exploration pheromone exceeds this. */
  territoryThreshold: 0.03,
  statsSampleInterval: 1,
  // seconds
  historyLength: 240
};
var NN_INPUTS = 24;
var NN_HIDDEN = 20;
var NN_OUTPUTS = 8;
var OUT_STEER = 0;
var OUT_FORWARD = 1;
var OUT_TRAIL = 2;
var OUT_EXPLORE = 3;
var OUT_ALARM = 4;
var OUT_ENGAGE = 5;
var OUT_AVOID = 6;
var OUT_HOME = 7;

// src/sim/ant.ts
var AntState = /* @__PURE__ */ ((AntState2) => {
  AntState2[AntState2["Exploring"] = 0] = "Exploring";
  AntState2[AntState2["FollowingFoodTrail"] = 1] = "FollowingFoodTrail";
  AntState2[AntState2["CollectingFood"] = 2] = "CollectingFood";
  AntState2[AntState2["ReturningWithFood"] = 3] = "ReturningWithFood";
  AntState2[AntState2["FollowingHomeSignal"] = 4] = "FollowingHomeSignal";
  AntState2[AntState2["InvestigatingAlarm"] = 5] = "InvestigatingAlarm";
  AntState2[AntState2["Fighting"] = 6] = "Fighting";
  AntState2[AntState2["AvoidingObstacle"] = 7] = "AvoidingObstacle";
  AntState2[AntState2["Resting"] = 8] = "Resting";
  AntState2[AntState2["Retreating"] = 9] = "Retreating";
  return AntState2;
})(AntState || {});
function emptySenses() {
  return {
    foodL: 0,
    foodA: 0,
    foodR: 0,
    homeL: 0,
    homeA: 0,
    homeR: 0,
    alarmL: 0,
    alarmA: 0,
    alarmR: 0,
    foodHere: 0,
    homeHere: 0,
    alarmHere: 0,
    exploreHere: 0,
    obsF: 0,
    obsL: 0,
    obsR: 0,
    foodSeen: false,
    foodDist: 0,
    foodBearing: 0,
    foodId: -1,
    nestSeen: false,
    nestDist: 0,
    nestBearing: 0,
    nestId: -1,
    rivalSeen: false,
    rivalDist: 0,
    rivalBearing: 0,
    rivalIndex: -1,
    friends: 0,
    rivals: 0
  };
}
var Ant = class {
  id;
  colonyId;
  x;
  y;
  heading;
  health;
  energy = 1;
  carrying = 0;
  alive = true;
  age = 0;
  state = 0 /* Exploring */;
  prevState = 0 /* Exploring */;
  stateTimer = 0;
  /** Signal budgets: decay with distance travelled, reset at food / nest. */
  foodBudget = 0;
  homeBudget = 1;
  // short-term memory
  avoidDir = 0;
  // +1 turn right / -1 turn left while skirting an obstacle
  avoidTimer = 0;
  stuck = 0;
  // 0..1 stuck indicator
  sampleX;
  sampleY;
  sampleTimer = 0;
  lostTimer = 0;
  // seconds without useful trail signal
  downhill = 0;
  // consecutive ticks moving against the gradient
  ignoreTrailTimer = 0;
  // seconds during which food trails are ignored
  frustration = 0;
  // time spent on a strong trail with no food in sight
  alarmCooldown = 0;
  // seconds before this ant will answer another alarm
  retreatCheck = 0;
  target = null;
  // combat opponent
  targetFoodId = -1;
  /** per-ant variation of speed / wander (0.85..1.15) */
  variation;
  // brain buffers (reused; never reallocated)
  inputs = new Float32Array(NN_INPUTS);
  outputs = new Float32Array(NN_OUTPUTS);
  senses = emptySenses();
  lastTurn = 0;
  effectiveSpeed = 0;
  constructor(id, colonyId, x, y, heading, health, variation) {
    this.id = id;
    this.colonyId = colonyId;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.health = health;
    this.sampleX = x;
    this.sampleY = y;
    this.variation = variation;
  }
  setState(s) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTimer = 0;
  }
};
function foodRadius(f) {
  return 4 + Math.sqrt(Math.max(0, f.quantity)) * 0.8 + f.radiusBonus;
}

// src/sim/pheromone.ts
var PheromoneField = class {
  channels = [];
  scratch = new Float32Array(GRID_W * GRID_H);
  constructor() {
    for (let c = 0; c < PH_COUNT; c++) this.channels.push(new Float32Array(GRID_W * GRID_H));
  }
  clear() {
    for (const ch of this.channels) ch.fill(0);
  }
  /** Sample the cell containing world point (x,y). Out-of-bounds returns 0. */
  sample(channel, x, y) {
    const gx = x / CELL | 0, gy = y / CELL | 0;
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return 0;
    return this.channels[channel][gy * GRID_W + gx];
  }
  deposit(channel, x, y, amount) {
    const gx = x / CELL | 0, gy = y / CELL | 0;
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return;
    const arr = this.channels[channel];
    const i = gy * GRID_W + gx;
    const v = arr[i] + amount;
    arr[i] = v > 1 ? 1 : v;
  }
  /**
   * Decay and diffuse all channels.
   * @param seconds elapsed simulated seconds since last pass
   * @param decayMod colony decay modifier (>1 = fades faster)
   * @param evapMul world-level evaporation multiplier
   * @param diffMul world-level diffusion multiplier
   */
  update(seconds, decayMod, evapMul, diffMul) {
    for (let c = 0; c < PH_COUNT; c++) {
      const def = PHEROMONE_DEFS[c];
      const keep = Math.pow(1 - Math.min(0.95, def.evaporation * decayMod * evapMul), seconds);
      const k = def.diffusion * diffMul;
      const src = this.channels[c];
      if (k <= 0) {
        for (let i = 0; i < src.length; i++) {
          const v = src[i] * keep;
          src[i] = v < 5e-4 ? 0 : v;
        }
        continue;
      }
      const dst = this.scratch;
      const centerKeep = 1 - 4 * k;
      for (let y = 0; y < GRID_H; y++) {
        const row = y * GRID_W;
        const up = y > 0 ? row - GRID_W : row;
        const down = y < GRID_H - 1 ? row + GRID_W : row;
        for (let x = 0; x < GRID_W; x++) {
          const i = row + x;
          const l = x > 0 ? src[i - 1] : src[i];
          const r = x < GRID_W - 1 ? src[i + 1] : src[i];
          const v = (src[i] * centerKeep + k * (l + r + src[up + x] + src[down + x])) * keep;
          dst[i] = v < 5e-4 ? 0 : v;
        }
      }
      this.channels[c] = dst;
      this.scratch = src;
    }
  }
  /** Count cells above threshold (used for territory metric). */
  countAbove(channel, threshold) {
    const arr = this.channels[channel];
    let n = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > threshold) n++;
    return n;
  }
};

// src/sim/policy.ts
var IN = {
  FOOD_L: 0,
  FOOD_A: 1,
  FOOD_R: 2,
  HOME_L: 3,
  HOME_A: 4,
  HOME_R: 5,
  ALARM: 6,
  EXPLORE: 7,
  OBS_F: 8,
  OBS_L: 9,
  OBS_R: 10,
  FOOD_SEEN: 11,
  FOOD_BEARING: 12,
  NEST_SEEN: 13,
  NEST_BEARING: 14,
  RIVAL_NEAR: 15,
  RIVAL_BEARING: 16,
  FRIENDS: 17,
  CARRYING: 18,
  HEALTH: 19,
  ENERGY: 20,
  HOME_BUDGET: 21,
  STUCK: 22,
  NOISE: 23
};
function emptyPolicy() {
  return {
    w1: new Float32Array(NN_HIDDEN * NN_INPUTS),
    b1: new Float32Array(NN_HIDDEN),
    w2: new Float32Array(NN_OUTPUTS * NN_HIDDEN),
    b2: new Float32Array(NN_OUTPUTS)
  };
}
function clonePolicy(p) {
  return { w1: new Float32Array(p.w1), b1: new Float32Array(p.b1), w2: new Float32Array(p.w2), b2: new Float32Array(p.b2) };
}
var DEFAULT_PROFILE = {
  trailGain: 1,
  visionGain: 1,
  wallGain: 1,
  noiseGain: 1,
  alarmGain: 1,
  engageGain: 1,
  caution: 1
};
function buildBaselinePolicy(profile = DEFAULT_PROFILE) {
  const p = emptyPolicy();
  const W1 = (h, i, v) => {
    p.w1[h * NN_INPUTS + i] = v;
  };
  const B1 = (h, v) => {
    p.b1[h] = v;
  };
  const W2 = (o, h, v) => {
    p.w2[o * NN_HIDDEN + h] = v;
  };
  const B2 = (o, v) => {
    p.b2[o] = v;
  };
  W1(0, IN.FOOD_R, 3);
  W1(0, IN.FOOD_L, -3);
  W1(0, IN.CARRYING, -6);
  W1(1, IN.FOOD_L, 3);
  W1(1, IN.FOOD_R, -3);
  W1(1, IN.CARRYING, -6);
  W1(2, IN.HOME_R, 3);
  W1(2, IN.HOME_L, -3);
  W1(2, IN.CARRYING, 6);
  B1(2, -6);
  W1(3, IN.HOME_L, 3);
  W1(3, IN.HOME_R, -3);
  W1(3, IN.CARRYING, 6);
  B1(3, -6);
  W1(4, IN.FOOD_BEARING, 2);
  W1(4, IN.CARRYING, -6);
  W1(5, IN.FOOD_BEARING, -2);
  W1(5, IN.CARRYING, -6);
  W1(6, IN.NEST_BEARING, 2);
  W1(6, IN.CARRYING, 6);
  B1(6, -6);
  W1(7, IN.NEST_BEARING, -2);
  W1(7, IN.CARRYING, 6);
  B1(7, -6);
  W1(8, IN.OBS_L, 1.5);
  W1(8, IN.OBS_R, -1.5);
  W1(9, IN.OBS_R, 1.5);
  W1(9, IN.OBS_L, -1.5);
  W1(10, IN.OBS_F, 1.5);
  W1(11, IN.FOOD_L, 1);
  W1(11, IN.FOOD_A, 1.2);
  W1(11, IN.FOOD_R, 1);
  B1(11, -0.05);
  W1(12, IN.ALARM, 1.5);
  W1(13, IN.RIVAL_NEAR, 1.5);
  W1(14, IN.FRIENDS, 1.2);
  W1(15, IN.ENERGY, -2);
  B1(15, 0.8);
  W1(16, IN.HEALTH, -2);
  B1(16, 1);
  W1(17, IN.STUCK, 1.5);
  W1(18, IN.NOISE, 1.5);
  W1(19, IN.NOISE, -1.5);
  const tg = profile.trailGain, vg = profile.visionGain, wg = profile.wallGain;
  const ng = profile.noiseGain, ag = profile.alarmGain, eg = profile.engageGain, cg = profile.caution;
  W2(0, 0, 0.9 * tg);
  W2(0, 1, -0.9 * tg);
  W2(0, 2, 0.9 * tg);
  W2(0, 3, -0.9 * tg);
  W2(0, 4, 1.2 * vg);
  W2(0, 5, -1.2 * vg);
  W2(0, 6, 1.2 * vg);
  W2(0, 7, -1.2 * vg);
  W2(0, 8, 1 * wg);
  W2(0, 9, -1 * wg);
  W2(0, 18, 0.2 * ng);
  W2(0, 19, -0.2 * ng);
  B2(1, 0.8);
  W2(1, 10, -1.6 * wg);
  W2(1, 13, -0.3);
  B2(2, 0.2);
  W2(2, 11, 1.2 * tg);
  W2(2, 15, -0.4);
  W2(2, 17, -0.8);
  B2(3, 0.1);
  W2(3, 11, -0.8 * tg);
  W2(3, 17, 1.2);
  W2(3, 18, 0.5 * ng);
  W2(3, 15, -0.5 * cg);
  B2(4, -0.3);
  W2(4, 12, 1.6 * ag);
  W2(4, 13, 0.4 * ag);
  W2(4, 14, 0.4);
  W2(4, 16, -1.2 * cg);
  W2(4, 15, -0.8 * cg);
  B2(5, -0.4);
  W2(5, 13, 1 * eg);
  W2(5, 14, 0.6 * eg);
  W2(5, 12, 0.4 * ag);
  W2(5, 16, -1.6 * cg);
  W2(5, 15, -0.8 * cg);
  B2(6, -0.2);
  W2(6, 13, 0.9);
  W2(6, 16, 1.6 * cg);
  W2(6, 14, -0.6 * eg);
  W2(6, 12, 0.3);
  B2(7, -0.6);
  W2(7, 15, 1.8 * cg);
  W2(7, 16, 1 * cg);
  return p;
}
function forward(p, inputs, hidden2, out) {
  const w1 = p.w1, b1 = p.b1, w2 = p.w2, b2 = p.b2;
  for (let h = 0; h < NN_HIDDEN; h++) {
    let s = b1[h];
    const base = h * NN_INPUTS;
    for (let i = 0; i < NN_INPUTS; i++) s += w1[base + i] * inputs[i];
    hidden2[h] = s > 0 ? s : 0;
  }
  for (let o = 0; o < NN_OUTPUTS; o++) {
    let s = b2[o];
    const base = o * NN_HIDDEN;
    for (let h = 0; h < NN_HIDDEN; h++) s += w2[base + h] * hidden2[h];
    out[o] = Math.tanh(s);
  }
}
function mutatePolicy(p, rng, amount = 0.15) {
  const q = clonePolicy(p);
  const jitter = (arr, scale) => {
    for (let i = 0; i < arr.length; i++) {
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
function randomPolicy(rng) {
  const profile = {
    trailGain: rng.range(0.4, 1.8),
    visionGain: rng.range(0.5, 1.6),
    wallGain: rng.range(0.7, 1.4),
    noiseGain: rng.range(0.3, 2.2),
    alarmGain: rng.range(0.2, 2),
    engageGain: rng.range(0.2, 2),
    caution: rng.range(0.3, 1.8)
  };
  return mutatePolicy(buildBaselinePolicy(profile), rng, 0.3);
}
function clampPolicy(p) {
  const c = (arr, lim) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.max(-lim, Math.min(lim, arr[i]));
  };
  c(p.w1, 8);
  c(p.b1, 8);
  c(p.w2, 4);
  c(p.b2, 3);
}

// src/sim/colony.ts
var DEFAULT_TRAITS = {
  population: 120,
  speed: 45,
  maxHealth: 100,
  strength: 1,
  carryCapacity: 1,
  sensoryRange: 45,
  pheromoneProduction: 1,
  pheromoneSensitivity: 1,
  pheromoneDecay: 1,
  exploration: 0.4,
  aggression: 0.3,
  energyConsumption: 1,
  neuralInfluence: 1,
  autoGrow: true
};
var COLONY_PRESETS = [
  {
    name: "Amber Scouts",
    color: "#f5a524",
    description: "Fast, curious, long-sighted, fragile.",
    traits: { speed: 58, exploration: 0.62, sensoryRange: 60, maxHealth: 70, strength: 0.8, carryCapacity: 1, aggression: 0.28, population: 130 },
    profile: { ...DEFAULT_PROFILE, trailGain: 0.85, noiseGain: 1.5, visionGain: 1.2, alarmGain: 0.8, engageGain: 0.8, caution: 1.2 }
  },
  {
    name: "Cobalt Harvesters",
    color: "#38bdf8",
    description: "Slow, tough, strong, heavy loads, trail-committed.",
    traits: { speed: 36, exploration: 0.22, sensoryRange: 40, maxHealth: 150, strength: 1.5, carryCapacity: 2, aggression: 0.36, population: 110 },
    profile: { ...DEFAULT_PROFILE, trailGain: 1.4, noiseGain: 0.6, visionGain: 1, alarmGain: 1.1, engageGain: 1.2, caution: 0.8 }
  },
  {
    name: "Crimson Raiders",
    color: "#ef4444",
    description: "Aggressive and alarm-driven. Fights over resources.",
    traits: { speed: 48, exploration: 0.4, maxHealth: 110, strength: 1.8, aggression: 0.8, carryCapacity: 1, population: 100 },
    profile: { ...DEFAULT_PROFILE, alarmGain: 1.8, engageGain: 1.8, caution: 0.5, noiseGain: 1 }
  },
  {
    name: "Jade Pacifists",
    color: "#4ade80",
    description: "Peaceful and efficient foragers that avoid conflict.",
    traits: { speed: 44, exploration: 0.35, aggression: 0.02, maxHealth: 90, strength: 0.7, carryCapacity: 1.5, population: 120 },
    profile: { ...DEFAULT_PROFILE, alarmGain: 0.4, engageGain: 0.2, caution: 1.6, trailGain: 1.2 }
  },
  {
    name: "Violet Wanderers",
    color: "#a78bfa",
    description: "Extreme explorers that rarely commit to trails.",
    traits: { speed: 50, exploration: 0.9, sensoryRange: 55, pheromoneSensitivity: 0.7, aggression: 0.2, population: 110 },
    profile: { ...DEFAULT_PROFILE, trailGain: 0.6, noiseGain: 2.2, caution: 1 }
  }
];
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function createColony(id, preset, overrides = {}) {
  const traits = { ...DEFAULT_TRAITS, ...preset.traits, ...overrides };
  const basePolicy = buildBaselinePolicy(preset.profile);
  return {
    id,
    name: preset.name,
    color: preset.color,
    traits,
    policy: clonePolicy(basePolicy),
    basePolicy,
    profileName: preset.name,
    pheromones: new PheromoneField(),
    storedFood: 0,
    collected: 0,
    deaths: 0,
    kills: 0,
    trips: 0,
    growthTimer: 0,
    stats: { living: 0, storedFood: 0, collected: 0, deaths: 0, kills: 0, avgHealth: 0, explorers: 0, carrying: 0, followers: 0, fighting: 0, territory: 0, trips: 0 },
    rgb: hexToRgb(preset.color)
  };
}

// src/sim/behavior.ts
var hidden = new Float32Array(NN_HIDDEN);
var TWO_PI = Math.PI * 2;
function wrapAngle(a) {
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  else if (a < -Math.PI) a += TWO_PI;
  return a;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
function gradientTurn(L, A, R, gain) {
  return (R - L) / (L + A + R + 0.02) * gain;
}
function sense(w, a, col) {
  const s = a.senses;
  const ph = col.pheromones;
  const range = col.traits.sensoryRange;
  const h = a.heading;
  const pd = TUNING.probeDist, pa = TUNING.probeAngle;
  const lx = a.x + Math.cos(h - pa) * pd, ly = a.y + Math.sin(h - pa) * pd;
  const ax = a.x + Math.cos(h) * pd, ay = a.y + Math.sin(h) * pd;
  const rx = a.x + Math.cos(h + pa) * pd, ry = a.y + Math.sin(h + pa) * pd;
  s.foodL = ph.sample(PH_FOOD, lx, ly);
  s.foodA = ph.sample(PH_FOOD, ax, ay);
  s.foodR = ph.sample(PH_FOOD, rx, ry);
  s.homeL = ph.sample(PH_HOME, lx, ly);
  s.homeA = ph.sample(PH_HOME, ax, ay);
  s.homeR = ph.sample(PH_HOME, rx, ry);
  s.alarmL = ph.sample(PH_ALARM, lx, ly);
  s.alarmA = ph.sample(PH_ALARM, ax, ay);
  s.alarmR = ph.sample(PH_ALARM, rx, ry);
  s.foodHere = ph.sample(PH_FOOD, a.x, a.y);
  s.homeHere = ph.sample(PH_HOME, a.x, a.y);
  s.alarmHere = ph.sample(PH_ALARM, a.x, a.y);
  s.exploreHere = ph.sample(PH_EXPLORE, a.x, a.y);
  s.obsF = probe(w, a.x, a.y, h);
  s.obsL = probe(w, a.x, a.y, h - TUNING.obstacleProbeAngle);
  s.obsR = probe(w, a.x, a.y, h + TUNING.obstacleProbeAngle);
  s.foodSeen = false;
  s.foodDist = 0;
  s.foodBearing = 0;
  s.foodId = -1;
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
  s.nestSeen = false;
  s.nestDist = 0;
  s.nestBearing = 0;
  s.nestId = -1;
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
  s.friends = 0;
  s.rivals = 0;
  s.rivalSeen = false;
  s.rivalDist = 0;
  s.rivalBearing = 0;
  s.rivalIndex = -1;
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
var neighborBuf = new Int32Array(512);
function probe(w, x, y, angle) {
  const len = TUNING.obstacleProbeLen, step = TUNING.obstacleProbeStep;
  const cx = Math.cos(angle), cy = Math.sin(angle);
  for (let d = step; d <= len; d += step) {
    if (w.walls.isSolidWorld(x + cx * d, y + cy * d)) return 1 - (d - step) / len;
  }
  return 0;
}
function think(w, a, col) {
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
var MOVING_STATES = /* @__PURE__ */ new Set([
  0 /* Exploring */,
  1 /* FollowingFoodTrail */,
  3 /* ReturningWithFood */,
  4 /* FollowingHomeSignal */,
  5 /* InvestigatingAlarm */,
  7 /* AvoidingObstacle */,
  9 /* Retreating */
]);
function updateAnt(w, a, dt) {
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
  const trailN = (out[OUT_TRAIL] + 1) * 0.5;
  const exploreN = (out[OUT_EXPLORE] + 1) * 0.5;
  const alarmU = out[OUT_ALARM] * inf;
  const engageU = out[OUT_ENGAGE] * inf;
  const avoidU = out[OUT_AVOID] * inf;
  const homeU = out[OUT_HOME] * inf;
  const g = t.pheromoneSensitivity;
  const thr = TUNING.trailThreshold;
  const healthFrac = a.health / t.maxHealth;
  let turn = 0;
  let speedMul = 1;
  const carrying = a.carrying > 0;
  const busy = a.state === 6 /* Fighting */ || a.state === 8 /* Resting */ || a.state === 2 /* CollectingFood */;
  if (!busy) {
    if (carrying && s.nestSeen && s.nestDist <= TUNING.encounterMargin) {
      deliver(w, a, col);
    } else if (!carrying && s.nestSeen && s.nestDist <= TUNING.encounterMargin) {
      a.homeBudget = 1;
      if (a.state === 4 /* FollowingHomeSignal */ || a.energy < TUNING.lowEnergy + 0.1 && a.state !== 9 /* Retreating */) {
        a.setState(8 /* Resting */);
      } else if (a.state === 9 /* Retreating */ && healthFrac < 0.6) {
        a.setState(8 /* Resting */);
      }
    } else if (!carrying && s.foodSeen && s.foodDist <= TUNING.encounterMargin && (a.state === 0 /* Exploring */ || a.state === 1 /* FollowingFoodTrail */ || a.state === 7 /* AvoidingObstacle */ || a.state === 5 /* InvestigatingAlarm */)) {
      a.targetFoodId = s.foodId;
      a.frustration = 0;
      a.setState(2 /* CollectingFood */);
    }
  }
  const wanderBase = TUNING.baseWander * a.variation;
  switch (a.state) {
    case 0 /* Exploring */: {
      const sigma = wanderBase * (0.4 + 1.4 * t.exploration) * (0.5 + exploreN);
      turn += rng.gauss() * sigma;
      if (rng.chance(6e-3 * (0.3 + t.exploration))) turn += rng.range(-1.5, 1.5);
      if (s.exploreHere > 0.5) turn += rng.gauss() * sigma * 0.5;
      if (s.foodSeen) {
        turn += s.foodBearing * 1.4;
      } else if (a.ignoreTrailTimer <= 0) {
        const fL = s.foodL * g, fA = s.foodA * g, fR = s.foodR * g;
        const maxF = Math.max(fL, fA, fR);
        if (maxF > thr) {
          const commit = (0.25 + 0.75 * trailN) * (1.15 - t.exploration) * Math.sqrt(g);
          turn += gradientTurn(fL, fA, fR, 0.35 * commit);
          if (rng.chance(0.08 * commit * Math.min(1, maxF / (thr * 4)))) a.setState(1 /* FollowingFoodTrail */);
        }
      }
      maybeInvestigateAlarm(w, a, t, alarmU);
      if (a.energy < TUNING.lowEnergy && homeU + (TUNING.lowEnergy - a.energy) * 4 > 0) a.setState(4 /* FollowingHomeSignal */);
      break;
    }
    case 1 /* FollowingFoodTrail */: {
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
        const here = s.foodHere * g;
        if (here > thr * 2 && fA < here * 0.75 && maxF < here * 0.92) a.downhill++;
        else a.downhill = Math.max(0, a.downhill - 1);
        if (a.downhill > 14) {
          a.heading += Math.PI + rng.gauss() * 0.6;
          a.downhill = 0;
        }
        if (here > 0.6) a.frustration += dt;
        else a.frustration = Math.max(0, a.frustration - dt * 0.5);
        if (a.frustration > 8) {
          a.frustration = 0;
          a.ignoreTrailTimer = 8;
          a.heading += rng.range(-2, 2);
          a.setState(0 /* Exploring */);
        }
        if (rng.chance(15e-4 * t.exploration * (1.5 - trailN))) {
          a.ignoreTrailTimer = 3;
          a.setState(0 /* Exploring */);
        }
      } else {
        a.lostTimer += dt;
        turn += rng.gauss() * wanderBase * 1.5;
        if (a.lostTimer > 1.5) {
          a.lostTimer = 0;
          a.setState(0 /* Exploring */);
        }
      }
      maybeInvestigateAlarm(w, a, t, alarmU);
      if (a.energy < TUNING.lowEnergy && homeU > -0.2) a.setState(4 /* FollowingHomeSignal */);
      break;
    }
    case 2 /* CollectingFood */: {
      speedMul = 0;
      if (a.stateTimer >= TUNING.collectTime) {
        const f = w.foodById(a.targetFoodId);
        if (f && f.quantity > 0) {
          const take = Math.min(t.carryCapacity, f.quantity);
          f.quantity -= take;
          if (f.quantity <= 1e-3) {
            f.quantity = 0;
            f.depletedAt = w.time;
          }
          a.carrying = take;
          a.foodBudget = 1;
          a.heading += Math.PI + rng.gauss() * 0.4;
          a.setState(3 /* ReturningWithFood */);
        } else {
          a.setState(0 /* Exploring */);
        }
      }
      break;
    }
    case 3 /* ReturningWithFood */:
    case 4 /* FollowingHomeSignal */: {
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
          a.lostTimer += dt;
          turn += rng.gauss() * wanderBase * (0.8 + 0.4 * Math.min(1, a.lostTimer / 10));
          if (rng.chance(8e-3)) turn += rng.range(-1.5, 1.5);
        }
      }
      break;
    }
    case 8 /* Resting */: {
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
        a.setState(0 /* Exploring */);
      }
      break;
    }
    case 5 /* InvestigatingAlarm */: {
      const maxA = Math.max(s.alarmL, s.alarmA, s.alarmR, s.alarmHere);
      if (s.rivalSeen) {
        turn += s.rivalBearing * 1.2;
      } else if (maxA > 0.01) {
        turn += gradientTurn(s.alarmL, s.alarmA, s.alarmR, 0.8);
        turn += rng.gauss() * wanderBase * 0.6;
      } else {
        turn += rng.gauss() * wanderBase;
      }
      const maxDur = 2.5 + 4 * t.aggression;
      if (a.stateTimer > maxDur || maxA < 0.01 && !s.rivalSeen && a.stateTimer > 1.5) {
        a.alarmCooldown = 12;
        a.setState(0 /* Exploring */);
      }
      break;
    }
    case 6 /* Fighting */: {
      speedMul = 0;
      const tgt = a.target;
      if (!tgt || !tgt.alive || dist(a, tgt) > TUNING.contactRange * 1.8) {
        a.target = null;
        a.setState(carrying ? 3 /* ReturningWithFood */ : 0 /* Exploring */);
        break;
      }
      turn += wrapAngle(Math.atan2(tgt.y - a.y, tgt.x - a.x) - a.heading) * 1.5;
      if (tgt.state !== 6 /* Fighting */ && tgt.state !== 9 /* Retreating */) {
        const tcol = w.colonyById(tgt.colonyId);
        const tAggr = tcol ? tcol.traits.aggression : 0.5;
        if (rng.chance(clamp(0.6 - tAggr * 1.2, 0, 0.7))) {
          tgt.heading = Math.atan2(tgt.y - a.y, tgt.x - a.x) + rng.gauss() * 0.4;
          tgt.target = null;
          tgt.setState(9 /* Retreating */);
        } else {
          tgt.target = a;
          tgt.setState(6 /* Fighting */);
        }
      }
      const support = clamp(s.friends - s.rivals, -3, 3);
      const dmg = TUNING.damagePerSec * t.strength * (0.7 + 0.6 * rng.next()) * (1 + 0.15 * support) * dt;
      tgt.health -= dmg;
      ph.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * t.pheromoneProduction * dt);
      if (tgt.health <= 0) {
        w.killAnt(tgt, col);
        a.target = null;
        a.setState(carrying ? 3 /* ReturningWithFood */ : 0 /* Exploring */);
        break;
      }
      a.retreatCheck += dt;
      if (a.retreatCheck > 0.5) {
        a.retreatCheck = 0;
        const fear = (1 - t.aggression) * 0.5 + avoidU * 0.3 - engageU * 0.2;
        if (healthFrac < TUNING.retreatHealth && rng.chance(clamp(fear, 0.05, 0.9))) {
          a.heading = Math.atan2(a.y - tgt.y, a.x - tgt.x) + rng.gauss() * 0.4;
          a.target = null;
          a.setState(9 /* Retreating */);
        }
      }
      break;
    }
    case 9 /* Retreating */: {
      speedMul = 1.15;
      if (s.rivalSeen) turn += wrapAngle(s.rivalBearing + Math.PI) * 1;
      turn += rng.gauss() * wanderBase;
      ph.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * 0.5 * t.pheromoneProduction * dt);
      if (a.stateTimer > TUNING.fleeSeconds) {
        if (carrying) a.setState(3 /* ReturningWithFood */);
        else if (healthFrac < 0.5) a.setState(4 /* FollowingHomeSignal */);
        else a.setState(0 /* Exploring */);
      }
      break;
    }
    case 7 /* AvoidingObstacle */: {
      turn += rng.gauss() * wanderBase * 0.5;
      if (s.foodSeen && !carrying) turn += s.foodBearing * 0.8;
      if (s.nestSeen && carrying) turn += s.nestBearing * 0.8;
      break;
    }
  }
  if (s.rivalSeen && MOVING_STATES.has(a.state)) handleRival(w, a, col, engageU, avoidU, healthFrac, dt, (v) => {
    turn += v;
  });
  if (MOVING_STATES.has(a.state)) {
    if (s.obsF > 0.02 || s.obsL > 0.35 || s.obsR > 0.35) {
      if (a.avoidDir === 0) a.avoidDir = s.obsL > s.obsR ? 1 : s.obsR > s.obsL ? -1 : rng.sign();
      turn += a.avoidDir * (0.12 + 0.55 * s.obsF) + (s.obsL - s.obsR) * 0.35;
      a.avoidTimer = 0.5;
      if (s.obsF > 0.45 && a.state !== 7 /* AvoidingObstacle */ && a.state !== 9 /* Retreating */) a.setState(7 /* AvoidingObstacle */);
    } else if (a.avoidTimer > 0) {
      a.avoidTimer -= dt;
      if (a.avoidTimer <= 0) {
        a.avoidDir = 0;
        if (a.state === 7 /* AvoidingObstacle */) {
          const prev = a.prevState;
          a.setState(MOVING_STATES.has(prev) && prev !== 7 /* AvoidingObstacle */ ? prev : carrying ? 3 /* ReturningWithFood */ : 0 /* Exploring */);
        }
      }
    }
  }
  turn += nnSteer * 0.6;
  if (a.stuck > 0.5 && rng.chance(0.1)) turn += rng.range(-2.5, 2.5);
  const fwd = 1 + (0.8 + 0.3 * out[OUT_FORWARD] - 1) * inf;
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
      const free = walls.nearestFree(a.x, a.y);
      if (free) {
        a.heading = Math.atan2(free.y - a.y, free.x - a.x);
        a.x = free.x;
        a.y = free.y;
        a.avoidDir = 0;
      }
    } else if (!walls.isSolidWorld(nx, ny)) {
      a.x = nx;
      a.y = ny;
      moved = step;
    } else if (!walls.isSolidWorld(nx, a.y)) {
      a.x = nx;
      moved = step * 0.5;
      a.heading = wrapAngle(a.heading + a.avoidDir * 0.3);
    } else if (!walls.isSolidWorld(a.x, ny)) {
      a.y = ny;
      moved = step * 0.5;
      a.heading = wrapAngle(a.heading + a.avoidDir * 0.3);
    } else {
      a.heading = wrapAngle(a.heading + (a.avoidDir || rng.sign()) * rng.range(1.2, 2.6));
      a.stuck = Math.min(1, a.stuck + 0.15);
    }
  }
  const prod = t.pheromoneProduction;
  if (moved > 0) {
    if (carrying) {
      ph.deposit(PH_FOOD, a.x, a.y, TUNING.foodDepositPerSec * prod * a.foodBudget * dt);
      a.foodBudget *= Math.exp(-moved / TUNING.foodSignalRange);
    } else if (a.state !== 9 /* Retreating */) {
      ph.deposit(PH_HOME, a.x, a.y, TUNING.homeDepositPerSec * prod * a.homeBudget * dt);
      a.homeBudget *= Math.exp(-moved / TUNING.homeSignalRange);
    }
    ph.deposit(PH_EXPLORE, a.x, a.y, TUNING.exploreDepositPerSec * dt);
  }
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
    a.sampleX = a.x;
    a.sampleY = a.y;
    a.sampleTimer = 0;
  }
  if (a.state !== 8 /* Resting */) {
    let drain = TUNING.energyDrainPerSec * t.energyConsumption;
    if (carrying) drain *= 1.3;
    if (a.state === 6 /* Fighting */) drain *= 2;
    a.energy = Math.max(0, a.energy - drain * dt);
  }
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function deliver(w, a, col) {
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
  if (a.energy < TUNING.lowEnergy + 0.1) a.setState(8 /* Resting */);
  else a.setState(0 /* Exploring */);
}
function maybeInvestigateAlarm(w, a, t, alarmU) {
  const s = a.senses;
  const maxA = Math.max(s.alarmL, s.alarmA, s.alarmR, s.alarmHere);
  if (maxA < 0.03 || a.alarmCooldown > 0) return;
  const u = alarmU + (t.aggression - 0.55) * 3 + maxA;
  if (u > 0 && w.rng.chance(0.03 * u)) a.setState(5 /* InvestigatingAlarm */);
}
function handleRival(w, a, col, engageU, avoidU, healthFrac, dt, addTurn) {
  const s = a.senses, t = col.traits;
  const rival = w.ants[s.rivalIndex];
  if (!rival || !rival.alive) return;
  const carrying = a.carrying > 0;
  const adv = clamp((s.friends - s.rivals) / 3, -1, 1);
  const carryPenalty = carrying ? 1 : 0;
  const investigating = a.state === 5 /* InvestigatingAlarm */ ? 0.2 : 0;
  const eng = engageU + (t.aggression - 0.55) * 4 + 0.4 * adv + 0.5 * (healthFrac - 0.5) - carryPenalty + investigating;
  const avd = avoidU + (0.6 - t.aggression) * 2.5 + (1 - healthFrac) + carryPenalty * 0.5;
  if (s.rivalDist < TUNING.contactRange) {
    if (eng > avd && rival.state !== 8 /* Resting */ && w.rng.chance(sigmoid(eng))) {
      a.target = rival;
      a.retreatCheck = 0;
      a.setState(6 /* Fighting */);
      col.pheromones.deposit(PH_ALARM, a.x, a.y, 0.2 * t.pheromoneProduction);
      return;
    }
    if (avd > 0) addTurn(wrapAngle(s.rivalBearing + Math.PI) * 0.8);
    if (a.state === 5 /* InvestigatingAlarm */) {
      a.alarmCooldown = 12;
      a.setState(0 /* Exploring */);
    }
  } else if (eng > 0.6 && !carrying && a.state !== 5 /* InvestigatingAlarm */ && a.alarmCooldown <= 0 && w.rng.chance(0.05 * eng)) {
    a.setState(5 /* InvestigatingAlarm */);
  }
  if (s.rivalDist < TUNING.contactRange * 2.5 && t.aggression > 0.4) {
    const k = (t.aggression - 0.4) / 0.6;
    col.pheromones.deposit(PH_ALARM, a.x, a.y, TUNING.alarmDepositPerSec * 0.4 * k * t.pheromoneProduction * dt);
  }
}

// src/sim/rng.ts
var Rng = class {
  s;
  constructor(seed) {
    this.s = seed >>> 0;
  }
  next() {
    let t = this.s += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, maxInclusive) {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  /** Approximate gaussian (sum of 3 uniforms, variance-normalised). */
  gauss() {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
  chance(p) {
    return this.next() < p;
  }
};

// src/sim/spatialHash.ts
var HASH_CELL = 40;
var HW = Math.ceil(WORLD_W / HASH_CELL);
var HH = Math.ceil(WORLD_H / HASH_CELL);
var SpatialHash = class {
  cellStart = new Int32Array(HW * HH + 1);
  cellCount = new Int32Array(HW * HH);
  items = new Int32Array(1024);
  cellOf = new Int32Array(1024);
  n = 0;
  /** Rebuild from parallel position arrays (ant index = id into `xs`). */
  build(xs, ys, count) {
    this.n = count;
    if (this.items.length < count) {
      this.items = new Int32Array(count * 2);
      this.cellOf = new Int32Array(count * 2);
    }
    this.cellCount.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = Math.min(HW - 1, Math.max(0, xs[i] / HASH_CELL | 0));
      const cy = Math.min(HH - 1, Math.max(0, ys[i] / HASH_CELL | 0));
      const c = cy * HW + cx;
      this.cellOf[i] = c;
      this.cellCount[c]++;
    }
    let acc = 0;
    for (let c = 0; c < HW * HH; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
    }
    this.cellStart[HW * HH] = acc;
    this.cellCount.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.cellOf[i];
      this.items[this.cellStart[c] + this.cellCount[c]++] = i;
    }
  }
  /**
   * Fill `out` with indices of items whose cell intersects the circle; returns
   * the count. Allocation-free hot path used by ant sensing.
   */
  queryInto(x, y, r, out) {
    if (this.n === 0) return 0;
    const x0 = Math.max(0, (x - r) / HASH_CELL | 0);
    const x1 = Math.min(HW - 1, (x + r) / HASH_CELL | 0);
    const y0 = Math.max(0, (y - r) / HASH_CELL | 0);
    const y1 = Math.min(HH - 1, (y + r) / HASH_CELL | 0);
    let n = 0;
    const cap = out.length;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * HW + cx;
        const s = this.cellStart[c], e = this.cellStart[c + 1];
        for (let k = s; k < e && n < cap; k++) out[n++] = this.items[k];
      }
    }
    return n;
  }
  /** Invoke `fn(index)` for every item whose cell intersects the circle. */
  query(x, y, r, fn) {
    if (this.n === 0) return;
    const x0 = Math.max(0, (x - r) / HASH_CELL | 0);
    const x1 = Math.min(HW - 1, (x + r) / HASH_CELL | 0);
    const y0 = Math.max(0, (y - r) / HASH_CELL | 0);
    const y1 = Math.min(HH - 1, (y + r) / HASH_CELL | 0);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * HW + cx;
        const s = this.cellStart[c], e = this.cellStart[c + 1];
        for (let k = s; k < e; k++) fn(this.items[k]);
      }
    }
  }
};

// src/sim/walls.ts
var WallGrid = class {
  cells = new Uint8Array(GRID_W * GRID_H);
  /** Incremented whenever walls change so the renderer can re-cache. */
  version = 0;
  isSolidWorld(x, y) {
    const gx = x / CELL | 0, gy = y / CELL | 0;
    if (x < 0 || y < 0 || gx >= GRID_W || gy >= GRID_H) return true;
    return this.cells[gy * GRID_W + gx] === 1;
  }
  isSolidCell(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return true;
    return this.cells[gy * GRID_W + gx] === 1;
  }
  /** Paint / erase a disc of cells. */
  paint(x, y, radius, solid) {
    const r = Math.max(1, Math.round(radius / CELL));
    const cx = Math.round(x / CELL), cy = Math.round(y / CELL);
    const v = solid ? 1 : 0;
    let changed = false;
    for (let gy = cy - r; gy <= cy + r; gy++) {
      if (gy < 0 || gy >= GRID_H) continue;
      for (let gx = cx - r; gx <= cx + r; gx++) {
        if (gx < 0 || gx >= GRID_W) continue;
        const dx = gx + 0.5 - x / CELL, dy = gy + 0.5 - y / CELL;
        if (dx * dx + dy * dy <= r * r) {
          const i = gy * GRID_W + gx;
          if (this.cells[i] !== v) {
            this.cells[i] = v;
            changed = true;
          }
        }
      }
    }
    if (changed) this.version++;
  }
  /** Paint along a segment so fast drags produce continuous walls. */
  paintLine(x0, y0, x1, y1, radius, solid) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.paint(x0 + dx * t, y0 + dy * t, radius, solid);
    }
  }
  fillRect(x0, y0, x1, y1, solid = true) {
    const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GRID_W - 1, Math.floor(x1 / CELL));
    const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GRID_H - 1, Math.floor(y1 / CELL));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) this.cells[gy * GRID_W + gx] = solid ? 1 : 0;
    this.version++;
  }
  /**
   * Nearest free cell centre to (x,y) within `maxRings` cells, or null.
   * Used to push out ants that get buried when a wall is drawn over them.
   */
  nearestFree(x, y, maxRings = 6) {
    const cx = x / CELL | 0, cy = y / CELL | 0;
    for (let r = 1; r <= maxRings; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.isSolidCell(cx + dx, cy + dy)) return { x: (cx + dx + 0.5) * CELL, y: (cy + dy + 0.5) * CELL };
        }
      }
    }
    return null;
  }
  clearDisc(x, y, radius) {
    this.paint(x, y, radius, false);
  }
  clear() {
    this.cells.fill(0);
    this.version++;
  }
  /** Run-length encode for persistence. */
  encode() {
    const out = [];
    let cur = this.cells[0], run2 = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === cur) run2++;
      else {
        out.push(run2);
        cur = this.cells[i];
        run2 = 1;
      }
    }
    out.push(run2);
    return out;
  }
  decode(runs) {
    this.cells.fill(0);
    let i = 0, v = 0;
    for (const run2 of runs) {
      if (v === 1) this.cells.fill(1, i, Math.min(this.cells.length, i + run2));
      i += run2;
      v ^= 1;
    }
    this.version++;
  }
};

// src/sim/world.ts
var DEFAULT_PARAMS = { evaporation: 1, diffusion: 1, foodQuantity: 300, wallBrush: 14, antBrush: 5 };
var World = class {
  seed;
  rng;
  time = 0;
  tick = 0;
  walls = new WallGrid();
  colonies = [];
  ants = [];
  foods = [];
  nests = [];
  hash = new SpatialHash();
  params = { ...DEFAULT_PARAMS };
  history = /* @__PURE__ */ new Map();
  events = [];
  /** bumped whenever colony list / structure changes so UI can refresh */
  structureVersion = 0;
  nextAntId = 1;
  nextFoodId = 1;
  nextNestId = 1;
  nextColonyId = 1;
  xs = new Float32Array(2048);
  ys = new Float32Array(2048);
  statsTimer = 0;
  pheromoneTimer = 0;
  constructor(seed) {
    this.seed = seed;
    this.rng = new Rng(seed);
  }
  // ------------------------------------------------------------------ lookup
  colonyById(id) {
    const cs = this.colonies;
    for (let i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return void 0;
  }
  foodById(id) {
    return this.foods.find((f) => f.id === id);
  }
  // -------------------------------------------------------------------- step
  step(dt = SIM_DT) {
    this.tick++;
    this.time += dt;
    const n = this.ants.length;
    if (this.xs.length < n) {
      this.xs = new Float32Array(n * 2);
      this.ys = new Float32Array(n * 2);
    }
    for (let i = 0; i < n; i++) {
      this.xs[i] = this.ants[i].x;
      this.ys[i] = this.ants[i].y;
    }
    this.hash.build(this.xs, this.ys, n);
    for (let i = 0; i < n; i++) {
      const a = this.ants[i];
      if (a.alive) updateAnt(this, a, dt);
    }
    let w = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      if (a.alive) this.ants[w++] = a;
    }
    this.ants.length = w;
    this.pheromoneTimer += dt;
    if (this.tick % DIFFUSE_INTERVAL === 0) {
      for (const c of this.colonies) {
        c.pheromones.update(this.pheromoneTimer, c.traits.pheromoneDecay, this.params.evaporation, this.params.diffusion);
      }
      this.pheromoneTimer = 0;
    }
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      if (f.quantity <= 0 && f.depletedAt >= 0 && this.time - f.depletedAt > TUNING.depletedLingerSec) this.foods.splice(i, 1);
    }
    for (const c of this.colonies) {
      if (!c.traits.autoGrow) continue;
      c.growthTimer += dt;
      if (c.growthTimer < TUNING.growthInterval) continue;
      c.growthTimer = 0;
      const living = c.stats.living || this.countAnts(c.id);
      const cap = Math.min(TUNING.maxColonyPop, c.traits.population * 2);
      if (c.storedFood >= TUNING.growthCost && living < cap) {
        const nest = this.randomNest(c.id);
        if (nest) {
          c.storedFood -= TUNING.growthCost;
          this.spawnAnt(c, nest.x, nest.y);
          c.stats.living = living + 1;
        }
      }
    }
    this.statsTimer += dt;
    if (this.statsTimer >= TUNING.statsSampleInterval) {
      this.statsTimer = 0;
      this.updateStats(true);
    }
  }
  killAnt(a, killer) {
    if (!a.alive) return;
    a.alive = false;
    const col = this.colonyById(a.colonyId);
    if (col) col.deaths++;
    if (killer) {
      killer.kills++;
      if (this.events.length < 200 && col) this.logEvent(`${killer.name} killed a ${col.name} ant`, killer.color);
    }
  }
  logEvent(text, color = "#ccc") {
    this.events.push({ time: this.time, text, color });
    if (this.events.length > 60) this.events.splice(0, this.events.length - 60);
  }
  countAnts(colonyId) {
    let n = 0;
    for (const a of this.ants) if (a.colonyId === colonyId && a.alive) n++;
    return n;
  }
  randomNest(colonyId) {
    const own = this.nests.filter((n) => n.colonyId === colonyId);
    if (own.length === 0) return void 0;
    return own[this.rng.int(0, own.length - 1)];
  }
  // ------------------------------------------------------------------- stats
  updateStats(sample) {
    for (const c of this.colonies) {
      const st = c.stats;
      st.living = 0;
      st.explorers = 0;
      st.carrying = 0;
      st.followers = 0;
      st.fighting = 0;
      let hp = 0;
      for (const a of this.ants) {
        if (a.colonyId !== c.id || !a.alive) continue;
        st.living++;
        hp += a.health / c.traits.maxHealth;
        if (a.carrying > 0) st.carrying++;
        if (a.state === 0 /* Exploring */) st.explorers++;
        else if (a.state === 1 /* FollowingFoodTrail */) st.followers++;
        else if (a.state === 6 /* Fighting */) st.fighting++;
      }
      st.avgHealth = st.living ? hp / st.living : 0;
      st.storedFood = c.storedFood;
      st.collected = c.collected;
      st.deaths = c.deaths;
      st.kills = c.kills;
      st.trips = c.trips;
      st.territory = c.pheromones.countAbove(PH_EXPLORE, TUNING.territoryThreshold);
      if (sample) {
        let h = this.history.get(c.id);
        if (!h) {
          h = { time: [], living: [], stored: [], collected: [], deaths: [] };
          this.history.set(c.id, h);
        }
        h.time.push(this.time);
        h.living.push(st.living);
        h.stored.push(c.storedFood);
        h.collected.push(c.collected);
        h.deaths.push(c.deaths);
        if (h.time.length > TUNING.historyLength) {
          h.time.shift();
          h.living.shift();
          h.stored.shift();
          h.collected.shift();
          h.deaths.shift();
        }
      }
    }
  }
  // ------------------------------------------------------------ colony admin
  addColony(preset, overrides = {}) {
    const p = preset ?? COLONY_PRESETS[this.colonies.length % COLONY_PRESETS.length];
    const c = createColony(this.nextColonyId++, p, overrides);
    if (this.colonies.some((o) => o.name === c.name)) c.name = `${c.name} ${this.colonies.length + 1}`;
    this.colonies.push(c);
    this.structureVersion++;
    return c;
  }
  removeColony(id) {
    if (this.colonies.length <= 1) return;
    this.colonies = this.colonies.filter((c) => c.id !== id);
    this.ants = this.ants.filter((a) => a.colonyId !== id);
    this.nests = this.nests.filter((n) => n.colonyId !== id);
    this.history.delete(id);
    this.structureVersion++;
  }
  duplicateColony(id, mutate = true) {
    const src = this.colonyById(id);
    if (!src) return void 0;
    const c = createColony(this.nextColonyId++, { name: `${src.name} II`, color: src.color, traits: { ...src.traits }, profile: DEFAULT_PROFILE, description: "" });
    c.basePolicy = clonePolicy(src.basePolicy);
    c.policy = mutate ? mutatePolicy(src.policy, this.rng, 0.2) : clonePolicy(src.policy);
    const [r, g, b] = src.rgb;
    c.color = rgbToHex([(r + 60) % 256, (g + 30) % 256, (b + 90) % 256]);
    c.rgb = hexToRgb(c.color);
    this.colonies.push(c);
    this.structureVersion++;
    return c;
  }
  setColonyColor(c, color) {
    c.color = color;
    c.rgb = hexToRgb(color);
  }
  mutateColonyPolicy(c, amount = 0.15) {
    c.policy = mutatePolicy(c.policy, this.rng, amount);
  }
  randomizeColonyPolicy(c) {
    c.policy = randomPolicy(this.rng);
  }
  resetColonyPolicy(c) {
    c.policy = clonePolicy(c.basePolicy);
  }
  /** Adjust living population toward traits.population (spawn/remove at nests). */
  syncPopulation(c) {
    const living = this.countAnts(c.id);
    const target = c.traits.population;
    if (living < target) {
      const nest = this.randomNest(c.id);
      if (!nest) return;
      for (let i = living; i < target; i++) this.spawnAnt(c, nest.x, nest.y);
    } else if (living > target) {
      let excess = living - target;
      for (let i = this.ants.length - 1; i >= 0 && excess > 0; i--) {
        if (this.ants[i].colonyId === c.id) {
          this.ants.splice(i, 1);
          excess--;
        }
      }
    }
  }
  // ------------------------------------------------------------------- ants
  spawnAnt(c, x, y, scatter = 10) {
    const ang = this.rng.range(-Math.PI, Math.PI);
    const r = this.rng.range(0, scatter);
    const a = new Ant(this.nextAntId++, c.id, x + Math.cos(ang) * r, y + Math.sin(ang) * r, this.rng.range(-Math.PI, Math.PI), c.traits.maxHealth, this.rng.range(0.85, 1.15));
    a.energy = this.rng.range(0.75, 1);
    this.ants.push(a);
    return a;
  }
  spawnAnts(colonyId, x, y, count) {
    const c = this.colonyById(colonyId);
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const a = this.spawnAnt(c, x, y, 12);
      if (this.walls.isSolidWorld(a.x, a.y)) {
        a.x = x;
        a.y = y;
      }
    }
  }
  removeAntsNear(x, y, radius) {
    const r2 = radius * radius;
    const before = this.ants.length;
    this.ants = this.ants.filter((a) => {
      const dx = a.x - x, dy = a.y - y;
      return dx * dx + dy * dy > r2;
    });
    return before - this.ants.length;
  }
  antAt(x, y, radius = 8) {
    let best;
    let bd = radius * radius;
    for (const a of this.ants) {
      const dx = a.x - x, dy = a.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = a;
      }
    }
    return best;
  }
  // ------------------------------------------------------------------- food
  addFood(x, y, quantity = this.params.foodQuantity, radiusBonus = 0) {
    const f = { id: this.nextFoodId++, x, y, quantity, maxQuantity: quantity, radiusBonus, depletedAt: -1 };
    this.foods.push(f);
    return f;
  }
  removeFood(id) {
    this.foods = this.foods.filter((f) => f.id !== id);
  }
  foodAt(x, y) {
    for (const f of this.foods) {
      const r = foodRadius(f) + 6;
      const dx = f.x - x, dy = f.y - y;
      if (dx * dx + dy * dy <= r * r) return f;
    }
    return void 0;
  }
  clearFood() {
    this.foods = [];
  }
  // ------------------------------------------------------------------- nests
  addNest(colonyId, x, y, radius = 22) {
    const n = { id: this.nextNestId++, colonyId, x, y, radius };
    this.nests.push(n);
    this.walls.clearDisc(x, y, radius + 6);
    const col = this.colonyById(colonyId);
    if (col && this.nests.filter((o) => o.colonyId === colonyId).length === 1 && this.countAnts(colonyId) === 0) {
      this.syncPopulation(col);
    }
    return n;
  }
  removeNest(id) {
    this.nests = this.nests.filter((n) => n.id !== id);
  }
  nestAt(x, y) {
    for (const n of this.nests) {
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return void 0;
  }
  // ------------------------------------------------------------------- misc
  clearPheromones() {
    for (const c of this.colonies) c.pheromones.clear();
  }
  clearWalls() {
    this.walls.clear();
  }
  clearWorld() {
    this.ants = [];
    this.foods = [];
    this.nests = [];
    this.walls.clear();
    this.clearPheromones();
    this.events = [];
    for (const c of this.colonies) {
      c.storedFood = 0;
      c.collected = 0;
      c.deaths = 0;
      c.kills = 0;
      c.trips = 0;
    }
    this.history.clear();
    this.time = 0;
    this.tick = 0;
    this.updateStats(false);
  }
  /** Re-seed RNG and clear runtime state, keeping colonies/foods/nests/walls. */
  resetRuntime(seed = this.seed) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.ants = [];
    this.clearPheromones();
    this.events = [];
    this.history.clear();
    for (const f of this.foods) {
      f.quantity = f.maxQuantity;
      f.depletedAt = -1;
    }
    for (const c of this.colonies) {
      c.storedFood = 0;
      c.collected = 0;
      c.deaths = 0;
      c.kills = 0;
      c.trips = 0;
      c.growthTimer = 0;
      const nest = this.randomNest(c.id);
      if (nest) for (let i = 0; i < c.traits.population; i++) this.spawnAnt(c, nest.x, nest.y);
    }
    this.time = 0;
    this.tick = 0;
    this.statsTimer = 0;
    this.updateStats(true);
  }
  /** Whether a world position is inside the grid. */
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
  }
};
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function buildDefaultScenario(world) {
  world.colonies = [];
  world.clearWorld();
  const a = world.addColony(COLONY_PRESETS[0]);
  const b = world.addColony(COLONY_PRESETS[1]);
  world.addNest(a.id, 290, 520);
  world.addNest(b.id, 1310, 480);
  world.addFood(800, 170, 600);
  world.addFood(790, 830, 600);
  world.addFood(560, 250, 350);
  world.addFood(1060, 740, 350);
  world.addFood(210, 880, 400);
  world.addFood(1400, 130, 400);
  world.addFood(800, 500, 800, 4);
  const w = world.walls;
  w.fillRect(620, 330, 634, 460);
  w.fillRect(620, 540, 634, 670);
  w.fillRect(920, 340, 1160, 354);
  w.fillRect(1e3, 650, 1200, 664);
  w.fillRect(380, 170, 470, 184);
  w.fillRect(1180, 820, 1194, 940);
  world.resetRuntime(world.seed);
}

// scratch/diag.ts
var lines = [];
var log = (s) => {
  lines.push(s);
};
function run(w, seconds) {
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n; i++) w.step(SIM_DT);
}
function stateCounts(w, colonyId) {
  const c = {};
  for (const a of w.ants) if (a.colonyId === colonyId) c[AntState[a.state]] = (c[AntState[a.state]] || 0) + 1;
  return JSON.stringify(c);
}
function sanity(w, label) {
  let bad = 0, inWall = 0;
  for (const a of w.ants) {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.heading)) bad++;
    if (!w.inBounds(a.x, a.y)) bad++;
    if (w.walls.isSolidWorld(a.x, a.y)) inWall++;
  }
  log(`  [sanity ${label}] nonfinite/out-of-bounds=${bad} insideWall=${inWall}`);
}
try {
  log("=== A. Default scenario (seed 1337) ===");
  const w = new World(1337);
  buildDefaultScenario(w);
  const t0 = Date.now();
  for (let s = 60; s <= 600; s += 60) {
    run(w, 60);
    const parts = w.colonies.map((c2) => `${c2.name}: living=${w.countAnts(c2.id)} trips=${c2.trips} collected=${c2.collected.toFixed(0)} stored=${c2.storedFood.toFixed(0)} deaths=${c2.deaths} foodCells>0.05=${c2.pheromones.countAbove(PH_FOOD, 0.05)} homeCells>0.02=${c2.pheromones.countAbove(PH_HOME, 0.02)}`);
    log(`t=${s}s ` + parts.join(" | "));
    log("  states A " + stateCounts(w, w.colonies[0].id));
    log("  states B " + stateCounts(w, w.colonies[1].id));
    log("  food: " + w.foods.map((f) => `${f.x},${f.y}:${f.quantity.toFixed(0)}`).join(" "));
  }
  const elapsed = Date.now() - t0;
  log(`  wall time for 600s sim: ${elapsed}ms (${(elapsed / 18e3).toFixed(3)} ms/tick, ${w.ants.length} ants)`);
  sanity(w, "default");
  log("  events: " + w.events.slice(0, 8).map((e) => `${e.time.toFixed(0)}s ${e.text}`).join(" ; "));
  log("=== B. Trail decay after food removal ===");
  const before = w.colonies.map((c2) => c2.pheromones.countAbove(PH_FOOD, 0.05));
  w.clearFood();
  for (let s = 30; s <= 120; s += 30) {
    run(w, 30);
    log(`  +${s}s foodCells>0.05: ` + w.colonies.map((c2, i) => `${c2.name} ${before[i]} -> ${c2.pheromones.countAbove(PH_FOOD, 0.05)}`).join(" | "));
  }
  log("=== C. Obstacle adaptation ===");
  const w2 = new World(42);
  w2.colonies = [];
  w2.clearWorld();
  const c = w2.addColony(COLONY_PRESETS[1], { population: 120, aggression: 0 });
  w2.addNest(c.id, 400, 500);
  w2.addFood(820, 500, 5e3);
  w2.resetRuntime(42);
  let lastTrips = 0;
  for (let s = 30; s <= 240; s += 30) {
    run(w2, 30);
    log(`  t=${s}s trips=${c.trips} (+${c.trips - lastTrips}) carrying=${w2.ants.filter((a) => a.carrying > 0).length} following=${w2.ants.filter((a) => a.state === 1 /* FollowingFoodTrail */).length} lostReturning=${w2.ants.filter((a) => a.state === 3 /* ReturningWithFood */ && a.lostTimer > 5).length}`);
    lastTrips = c.trips;
  }
  const lineCells = () => {
    let sum = 0, n = 0;
    for (let x = 560; x <= 660; x += 8) {
      sum += c.pheromones.sample(PH_FOOD, x, 500);
      n++;
    }
    return sum / n;
  };
  const detourCells = () => {
    let sum = 0, n = 0;
    for (const y of [380, 620]) for (let x = 560; x <= 660; x += 8) {
      sum += c.pheromones.sample(PH_FOOD, x, y);
      n++;
    }
    return sum / n;
  };
  log(`  before wall: line food ph=${lineCells().toFixed(3)} detour food ph=${detourCells().toFixed(3)}`);
  w2.walls.fillRect(604, 400, 618, 600);
  const tripsAtWall = c.trips;
  lastTrips = c.trips;
  for (let s = 30; s <= 300; s += 30) {
    run(w2, 30);
    log(`  +${s}s after wall trips=${c.trips} (+${c.trips - lastTrips}) line ph=${lineCells().toFixed(3)} detour ph=${detourCells().toFixed(3)} avoiding=${w2.ants.filter((a) => a.state === 7 /* AvoidingObstacle */).length} stuck>0.5=${w2.ants.filter((a) => a.stuck > 0.5).length}`);
    lastTrips = c.trips;
  }
  log(`  trips after wall: ${c.trips - tripsAtWall}`);
  sanity(w2, "obstacle");
  log("=== D. Competition ===");
  for (const aggr of [0, 0.3, 0.5, 0.8]) {
    const w3 = new World(7);
    w3.colonies = [];
    w3.clearWorld();
    const a1 = w3.addColony(COLONY_PRESETS[0], { population: 100, aggression: aggr });
    const a2 = w3.addColony(COLONY_PRESETS[1], { population: 100, aggression: aggr });
    w3.addNest(a1.id, 600, 500);
    w3.addNest(a2.id, 1e3, 500);
    w3.addFood(800, 500, 3e3, 6);
    w3.resetRuntime(7);
    run(w3, 240);
    let fights = 0;
    for (const a of w3.ants) if (a.state === 6 /* Fighting */) fights++;
    log(`  aggression=${aggr}: deaths A=${a1.deaths} B=${a2.deaths} kills A=${a1.kills} B=${a2.kills} living A=${w3.countAnts(a1.id)} B=${w3.countAnts(a2.id)} trips A=${a1.trips} B=${a2.trips} fightingNow=${fights}`);
  }
  log("=== E. Performance ===");
  const w4 = new World(99);
  buildDefaultScenario(w4);
  for (const c4 of w4.colonies) {
    c4.traits.population = 600;
    w4.syncPopulation(c4);
  }
  const p0 = Date.now();
  run(w4, 20);
  const pe = Date.now() - p0;
  log(`  ${w4.ants.length} ants: ${(pe / 600).toFixed(2)} ms/tick`);
  sanity(w4, "perf");
  log("=== F. Locality ===");
  const w5 = new World(5);
  w5.colonies = [];
  w5.clearWorld();
  const c5 = w5.addColony(COLONY_PRESETS[0], { population: 1 });
  w5.addNest(c5.id, 300, 500);
  w5.resetRuntime(5);
  const ant = w5.ants[0];
  ant.x = 300;
  ant.y = 300;
  ant.heading = 0;
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
  log("ERROR: " + e.stack);
}
globalThis.__diagOutput = lines.join("\n");
var output = lines.join("\n");
export {
  output
};
