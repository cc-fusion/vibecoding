/**
 * World: owns all simulation state and the fixed-timestep update.
 * UI code mutates the world only through the editing methods below.
 */
import { Ant, AntState, foodRadius, type FoodSource, type Nest } from './ant';
import { updateAnt } from './behavior';
import { COLONY_PRESETS, createColony, hexToRgb, type Colony, type ColonyPreset, type ColonyTraits } from './colony';
import { CELL, DIFFUSE_INTERVAL, GRID_H, GRID_W, PH_EXPLORE, SIM_DT, TUNING, WORLD_H, WORLD_W } from './constants';
import { buildBaselinePolicy, clonePolicy, DEFAULT_PROFILE, mutatePolicy, randomPolicy } from './policy';
import { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { WallGrid } from './walls';

export interface WorldParams {
  evaporation: number; // global multiplier
  diffusion: number;   // global multiplier
  foodQuantity: number; // default for newly placed food
  wallBrush: number;    // world units
  antBrush: number;     // ants per click for add tool
}

export interface HistorySeries {
  time: number[];
  living: number[];
  stored: number[];
  collected: number[];
  deaths: number[];
}

export interface WorldEvent {
  time: number;
  text: string;
  color: string;
}

export const DEFAULT_PARAMS: WorldParams = { evaporation: 1, diffusion: 1, foodQuantity: 300, wallBrush: 14, antBrush: 5 };

export class World {
  seed: number;
  rng: Rng;
  time = 0;
  tick = 0;
  walls = new WallGrid();
  colonies: Colony[] = [];
  ants: Ant[] = [];
  foods: FoodSource[] = [];
  nests: Nest[] = [];
  hash = new SpatialHash();
  params: WorldParams = { ...DEFAULT_PARAMS };
  history = new Map<number, HistorySeries>();
  events: WorldEvent[] = [];
  /** bumped whenever colony list / structure changes so UI can refresh */
  structureVersion = 0;

  private nextAntId = 1;
  private nextFoodId = 1;
  private nextNestId = 1;
  private nextColonyId = 1;
  private xs = new Float32Array(2048);
  private ys = new Float32Array(2048);
  private statsTimer = 0;
  private pheromoneTimer = 0;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
  }

  // ------------------------------------------------------------------ lookup
  colonyById(id: number): Colony | undefined {
    const cs = this.colonies;
    for (let i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return undefined;
  }
  foodById(id: number): FoodSource | undefined {
    return this.foods.find((f) => f.id === id);
  }

  // -------------------------------------------------------------------- step
  step(dt: number = SIM_DT): void {
    this.tick++;
    this.time += dt;

    // spatial hash rebuild
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
    // compact dead ants
    let w = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      if (a.alive) this.ants[w++] = a;
    }
    this.ants.length = w;

    // pheromone decay/diffusion at reduced frequency
    this.pheromoneTimer += dt;
    if (this.tick % DIFFUSE_INTERVAL === 0) {
      for (const c of this.colonies) {
        c.pheromones.update(this.pheromoneTimer, c.traits.pheromoneDecay, this.params.evaporation, this.params.diffusion);
      }
      this.pheromoneTimer = 0;
    }

    // depleted food fades out then disappears
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      if (f.quantity <= 0 && f.depletedAt >= 0 && this.time - f.depletedAt > TUNING.depletedLingerSec) this.foods.splice(i, 1);
    }

    // population growth (costs stored food)
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

  killAnt(a: Ant, killer?: Colony): void {
    if (!a.alive) return;
    a.alive = false;
    const col = this.colonyById(a.colonyId);
    if (col) col.deaths++;
    if (killer) {
      killer.kills++;
      if (this.events.length < 200 && col) this.logEvent(`${killer.name} killed a ${col.name} ant`, killer.color);
    }
  }

  logEvent(text: string, color = '#ccc'): void {
    this.events.push({ time: this.time, text, color });
    if (this.events.length > 60) this.events.splice(0, this.events.length - 60);
  }

  countAnts(colonyId: number): number {
    let n = 0;
    for (const a of this.ants) if (a.colonyId === colonyId && a.alive) n++;
    return n;
  }

  randomNest(colonyId: number): Nest | undefined {
    const own = this.nests.filter((n) => n.colonyId === colonyId);
    if (own.length === 0) return undefined;
    return own[this.rng.int(0, own.length - 1)];
  }

  // ------------------------------------------------------------------- stats
  updateStats(sample: boolean): void {
    for (const c of this.colonies) {
      const st = c.stats;
      st.living = 0; st.explorers = 0; st.carrying = 0; st.followers = 0; st.fighting = 0;
      let hp = 0;
      for (const a of this.ants) {
        if (a.colonyId !== c.id || !a.alive) continue;
        st.living++;
        hp += a.health / c.traits.maxHealth;
        if (a.carrying > 0) st.carrying++;
        if (a.state === AntState.Exploring) st.explorers++;
        else if (a.state === AntState.FollowingFoodTrail) st.followers++;
        else if (a.state === AntState.Fighting) st.fighting++;
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
        h.time.push(this.time); h.living.push(st.living); h.stored.push(c.storedFood); h.collected.push(c.collected); h.deaths.push(c.deaths);
        if (h.time.length > TUNING.historyLength) {
          h.time.shift(); h.living.shift(); h.stored.shift(); h.collected.shift(); h.deaths.shift();
        }
      }
    }
  }

  // ------------------------------------------------------------ colony admin
  addColony(preset?: ColonyPreset, overrides: Partial<ColonyTraits> = {}): Colony {
    const p = preset ?? COLONY_PRESETS[this.colonies.length % COLONY_PRESETS.length];
    const c = createColony(this.nextColonyId++, p, overrides);
    // keep names unique
    if (this.colonies.some((o) => o.name === c.name)) c.name = `${c.name} ${this.colonies.length + 1}`;
    this.colonies.push(c);
    this.structureVersion++;
    return c;
  }

  removeColony(id: number): void {
    if (this.colonies.length <= 1) return;
    this.colonies = this.colonies.filter((c) => c.id !== id);
    this.ants = this.ants.filter((a) => a.colonyId !== id);
    this.nests = this.nests.filter((n) => n.colonyId !== id);
    this.history.delete(id);
    this.structureVersion++;
  }

  duplicateColony(id: number, mutate = true): Colony | undefined {
    const src = this.colonyById(id);
    if (!src) return undefined;
    const c = createColony(this.nextColonyId++, { name: `${src.name} II`, color: src.color, traits: { ...src.traits }, profile: DEFAULT_PROFILE, description: '' });
    c.basePolicy = clonePolicy(src.basePolicy);
    c.policy = mutate ? mutatePolicy(src.policy, this.rng, 0.2) : clonePolicy(src.policy);
    // shift hue a little so it is distinguishable
    const [r, g, b] = src.rgb;
    c.color = rgbToHex([(r + 60) % 256, (g + 30) % 256, (b + 90) % 256]);
    c.rgb = hexToRgb(c.color);
    this.colonies.push(c);
    this.structureVersion++;
    return c;
  }

  setColonyColor(c: Colony, color: string): void {
    c.color = color;
    c.rgb = hexToRgb(color);
  }

  mutateColonyPolicy(c: Colony, amount = 0.15): void {
    c.policy = mutatePolicy(c.policy, this.rng, amount);
  }
  randomizeColonyPolicy(c: Colony): void {
    c.policy = randomPolicy(this.rng);
  }
  resetColonyPolicy(c: Colony): void {
    c.policy = clonePolicy(c.basePolicy);
  }

  /** Adjust living population toward traits.population (spawn/remove at nests). */
  syncPopulation(c: Colony): void {
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
  spawnAnt(c: Colony, x: number, y: number, scatter = 10): Ant {
    const ang = this.rng.range(-Math.PI, Math.PI);
    const r = this.rng.range(0, scatter);
    const a = new Ant(this.nextAntId++, c.id, x + Math.cos(ang) * r, y + Math.sin(ang) * r, this.rng.range(-Math.PI, Math.PI), c.traits.maxHealth, this.rng.range(0.85, 1.15));
    a.energy = this.rng.range(0.75, 1);
    this.ants.push(a);
    return a;
  }

  spawnAnts(colonyId: number, x: number, y: number, count: number): void {
    const c = this.colonyById(colonyId);
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const a = this.spawnAnt(c, x, y, 12);
      if (this.walls.isSolidWorld(a.x, a.y)) { a.x = x; a.y = y; }
    }
  }

  removeAntsNear(x: number, y: number, radius: number): number {
    const r2 = radius * radius;
    const before = this.ants.length;
    this.ants = this.ants.filter((a) => {
      const dx = a.x - x, dy = a.y - y;
      return dx * dx + dy * dy > r2;
    });
    return before - this.ants.length;
  }

  antAt(x: number, y: number, radius = 8): Ant | undefined {
    let best: Ant | undefined;
    let bd = radius * radius;
    for (const a of this.ants) {
      const dx = a.x - x, dy = a.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = a; }
    }
    return best;
  }

  // ------------------------------------------------------------------- food
  addFood(x: number, y: number, quantity = this.params.foodQuantity, radiusBonus = 0): FoodSource {
    const f: FoodSource = { id: this.nextFoodId++, x, y, quantity, maxQuantity: quantity, radiusBonus, depletedAt: -1 };
    this.foods.push(f);
    return f;
  }
  removeFood(id: number): void {
    this.foods = this.foods.filter((f) => f.id !== id);
  }
  foodAt(x: number, y: number): FoodSource | undefined {
    for (const f of this.foods) {
      const r = foodRadius(f) + 6;
      const dx = f.x - x, dy = f.y - y;
      if (dx * dx + dy * dy <= r * r) return f;
    }
    return undefined;
  }
  clearFood(): void {
    this.foods = [];
  }

  // ------------------------------------------------------------------- nests
  addNest(colonyId: number, x: number, y: number, radius = 22): Nest {
    const n: Nest = { id: this.nextNestId++, colonyId, x, y, radius };
    this.nests.push(n);
    this.walls.clearDisc(x, y, radius + 6);
    // A colony that had no nest (hence no ants) gets its population when its first nest is placed.
    const col = this.colonyById(colonyId);
    if (col && this.nests.filter((o) => o.colonyId === colonyId).length === 1 && this.countAnts(colonyId) === 0) {
      this.syncPopulation(col);
    }
    return n;
  }
  removeNest(id: number): void {
    this.nests = this.nests.filter((n) => n.id !== id);
  }
  nestAt(x: number, y: number): Nest | undefined {
    for (const n of this.nests) {
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return undefined;
  }

  // ------------------------------------------------------------------- misc
  clearPheromones(): void {
    for (const c of this.colonies) c.pheromones.clear();
  }
  clearWalls(): void {
    this.walls.clear();
  }
  clearWorld(): void {
    this.ants = [];
    this.foods = [];
    this.nests = [];
    this.walls.clear();
    this.clearPheromones();
    this.events = [];
    for (const c of this.colonies) {
      c.storedFood = 0; c.collected = 0; c.deaths = 0; c.kills = 0; c.trips = 0;
    }
    this.history.clear();
    this.time = 0;
    this.tick = 0;
    this.updateStats(false);
  }

  /** Re-seed RNG and clear runtime state, keeping colonies/foods/nests/walls. */
  resetRuntime(seed = this.seed): void {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.ants = [];
    this.clearPheromones();
    this.events = [];
    this.history.clear();
    for (const f of this.foods) { f.quantity = f.maxQuantity; f.depletedAt = -1; }
    for (const c of this.colonies) {
      c.storedFood = 0; c.collected = 0; c.deaths = 0; c.kills = 0; c.trips = 0; c.growthTimer = 0;
      const nest = this.randomNest(c.id);
      if (nest) for (let i = 0; i < c.traits.population; i++) this.spawnAnt(c, nest.x, nest.y);
    }
    this.time = 0;
    this.tick = 0;
    this.statsTimer = 0;
    this.updateStats(true);
  }

  /** Whether a world position is inside the grid. */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
  }
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- scenarios
export function buildDefaultScenario(world: World): void {
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
  world.addFood(800, 500, 800, 4); // contested centre

  // strategic walls
  const w = world.walls;
  w.fillRect(620, 330, 634, 460);
  w.fillRect(620, 540, 634, 670);
  w.fillRect(920, 340, 1160, 354);
  w.fillRect(1000, 650, 1200, 664);
  w.fillRect(380, 170, 470, 184);
  w.fillRect(1180, 820, 1194, 940);

  world.resetRuntime(world.seed);
}

export function buildRandomMap(world: World, seed: number): void {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const colonies = world.colonies.length ? world.colonies : [];
  world.clearWorld();
  if (colonies.length === 0) {
    world.addColony(COLONY_PRESETS[0]);
    world.addColony(COLONY_PRESETS[1]);
  }
  // walls: random thin rectangles
  const nWalls = rng.int(6, 12);
  for (let i = 0; i < nWalls; i++) {
    const horizontal = rng.chance(0.5);
    const len = rng.range(120, 360);
    const x = rng.range(80, WORLD_W - 80 - (horizontal ? len : 0));
    const y = rng.range(80, WORLD_H - 80 - (horizontal ? 0 : len));
    if (horizontal) world.walls.fillRect(x, y, x + len, y + 14);
    else world.walls.fillRect(x, y, x + 14, y + len);
  }
  // nests: well separated
  const placed: { x: number; y: number }[] = [];
  for (const c of world.colonies) {
    let pos = { x: 0, y: 0 };
    for (let tries = 0; tries < 60; tries++) {
      pos = { x: rng.range(120, WORLD_W - 120), y: rng.range(120, WORLD_H - 120) };
      if (placed.every((p) => Math.hypot(p.x - pos.x, p.y - pos.y) > 450)) break;
    }
    placed.push(pos);
    world.addNest(c.id, pos.x, pos.y);
    world.walls.clearDisc(pos.x, pos.y, 60);
  }
  // food
  const nFood = rng.int(6, 10);
  for (let i = 0; i < nFood; i++) {
    let fx = 0, fy = 0;
    for (let tries = 0; tries < 40; tries++) {
      fx = rng.range(60, WORLD_W - 60); fy = rng.range(60, WORLD_H - 60);
      if (placed.every((p) => Math.hypot(p.x - fx, p.y - fy) > 160) && !world.walls.isSolidWorld(fx, fy)) break;
    }
    const q = rng.int(80, 300);
    world.addFood(fx, fy, q);
    world.walls.clearDisc(fx, fy, 30);
  }
  world.resetRuntime(seed);
}

// ---------------------------------------------------------- serialization
export interface SavedSetup {
  version: 1;
  seed: number;
  params: WorldParams;
  colonies: {
    id: number; name: string; color: string; traits: ColonyTraits; profileName: string;
    policy: { w1: number[]; b1: number[]; w2: number[]; b2: number[] };
    basePolicy: { w1: number[]; b1: number[]; w2: number[]; b2: number[] };
  }[];
  nests: { colonyId: number; x: number; y: number; radius: number }[];
  foods: { x: number; y: number; quantity: number; maxQuantity: number; radiusBonus: number }[];
  walls: number[];
  grid: { w: number; h: number; cell: number };
}

export function gridInfo() {
  return { w: GRID_W, h: GRID_H, cell: CELL };
}

export { buildBaselinePolicy };
