import { SIM, WORLD } from './config';
import { PheromoneField } from './pheromone';
import { RNG } from './rng';
import { updateAnt } from './ant';
import type {
  Ant,
  ColonyStats,
  ColonyTraits,
  FoodSource,
  HistorySample,
  Nest,
  PheromoneType,
  WorldSetup,
} from './types';

export interface Colony {
  id: number;
  traits: ColonyTraits;
  storedFood: number;
  totalCollected: number;
  deaths: number;
  kills: number;
  pheromones: PheromoneField;
  /** last tick each coarse territory cell was visited by this colony (-1 = never) */
  territory: Int32Array;
  history: HistorySample[];
  stats: ColonyStats;
  growTimer: number;
}

const emptyStats = (): ColonyStats => ({
  living: 0,
  avgHealth: 0,
  explorers: 0,
  carrying: 0,
  fighting: 0,
  territoryCells: 0,
  territoryArea: 0,
});

/**
 * The simulation world. Pure state + rules, no rendering or React here.
 * Everything an ant can perceive goes through the local query helpers below
 * (findVisibleFood, findVisibleNest, nearestRival, pheromone sampling), which
 * are all limited by the ant's sense range.
 */
export class World {
  readonly width = WORLD.width;
  readonly height = WORLD.height;
  readonly cellSize = WORLD.cellSize;
  readonly cols = Math.ceil(WORLD.width / WORLD.cellSize);
  readonly rows = Math.ceil(WORLD.height / WORLD.cellSize);
  readonly walls: Uint8Array;
  wallsVersion = 0; // bumped whenever walls change (renderer caches wall layer)

  rng: RNG;
  seed: number;
  tick = 0;
  pathMemory = true;

  colonies: Colony[] = [];
  nests: Nest[] = [];
  food: FoodSource[] = [];
  ants: Ant[] = [];

  private nextId = 1;
  private initialSetup: WorldSetup | null = null;

  // Spatial hash (counting sort into flat arrays; rebuilt every tick, no allocations)
  readonly hashCols = Math.ceil(WORLD.width / WORLD.hashCell);
  readonly hashRows = Math.ceil(WORLD.height / WORLD.hashCell);
  private cellStart = new Int32Array(this.hashCols * this.hashRows + 1);
  private cellItems = new Int32Array(1024);
  private antCell = new Int32Array(1024);

  readonly terrCols = Math.ceil(WORLD.width / WORLD.territoryCell);
  readonly terrRows = Math.ceil(WORLD.height / WORLD.territoryCell);

  constructor(seed = 1337) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.walls = new Uint8Array(this.cols * this.rows);
  }

  // ------------------------------------------------------------------ ids
  newId() {
    return this.nextId++;
  }

  // ---------------------------------------------------------------- grid
  cellIndexAt(x: number, y: number): number {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** Out-of-bounds counts as solid so ants treat the border like a wall. */
  isWall(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return this.walls[((y / this.cellSize) | 0) * this.cols + ((x / this.cellSize) | 0)] === 1;
  }

  /** Cheap ray-march through the wall grid. */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / (this.cellSize * 0.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWall(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  paintWall(x: number, y: number, radius: number, value: 0 | 1) {
    const r = radius / this.cellSize;
    const cx = x / this.cellSize;
    const cy = y / this.cellSize;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.cols - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.rows - 1, Math.ceil(cy + r));
    let changed = false;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const ddx = gx + 0.5 - cx;
        const ddy = gy + 0.5 - cy;
        if (ddx * ddx + ddy * ddy <= r * r) {
          const i = gy * this.cols + gx;
          if (value === 1) {
            // never bury a nest or food under rock
            const wx = (gx + 0.5) * this.cellSize;
            const wy = (gy + 0.5) * this.cellSize;
            if (this.nests.some((n) => Math.hypot(n.x - wx, n.y - wy) < n.radius + 6)) continue;
            if (this.food.some((f) => Math.hypot(f.x - wx, f.y - wy) < foodRadius(f) + 4)) continue;
          }
          if (this.walls[i] !== value) {
            this.walls[i] = value;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      this.wallsVersion++;
      // ants trapped inside freshly drawn rock get nudged out
      if (value === 1) for (const a of this.ants) if (this.isWall(a.x, a.y)) this.unstick(a);
    }
  }

  /** Move an ant to the nearest free cell (used when a wall is drawn over it). */
  unstick(a: Ant) {
    for (let r = 1; r < 12; r++) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const nx = a.x + Math.cos(ang) * r * this.cellSize;
        const ny = a.y + Math.sin(ang) * r * this.cellSize;
        if (!this.isWall(nx, ny)) {
          a.x = nx;
          a.y = ny;
          return;
        }
      }
    }
  }

  clearWalls() {
    this.walls.fill(0);
    this.wallsVersion++;
  }

  // ------------------------------------------------------------ colonies
  addColony(traits: ColonyTraits, id?: number): Colony {
    if (id !== undefined && id >= this.nextId) this.nextId = id + 1;
    const c: Colony = {
      id: id ?? this.newId(),
      traits: { ...traits },
      storedFood: 0,
      totalCollected: 0,
      deaths: 0,
      kills: 0,
      pheromones: new PheromoneField(this.cols, this.rows),
      territory: new Int32Array(this.terrCols * this.terrRows).fill(-1),
      history: [],
      stats: emptyStats(),
      growTimer: 0,
    };
    this.colonies.push(c);
    return c;
  }

  colonyById(id: number): Colony | undefined {
    return this.colonies.find((c) => c.id === id);
  }

  removeColony(id: number) {
    this.colonies = this.colonies.filter((c) => c.id !== id);
    this.nests = this.nests.filter((n) => n.colonyId !== id);
    this.ants = this.ants.filter((a) => a.colonyId !== id);
  }

  duplicateColony(id: number): Colony | undefined {
    const src = this.colonyById(id);
    if (!src) return;
    const c = this.addColony({ ...src.traits, name: src.traits.name + ' II', color: shiftHue(src.traits.color, 40) });
    return c;
  }

  // --------------------------------------------------------------- nests
  addNest(colonyId: number, x: number, y: number): Nest {
    const n: Nest = { id: this.newId(), colonyId, x, y, radius: SIM.nestRadius };
    this.nests.push(n);
    this.paintWall(x, y, n.radius + 8, 0);
    // A colony's first nest founds it: spawn its starting population there.
    const c = this.colonyById(colonyId);
    if (c && !this.ants.some((a) => a.colonyId === colonyId)) this.spawnAnts(c, c.traits.startPopulation);
    return n;
  }
  moveNest(n: Nest, x: number, y: number) {
    n.x = clamp(x, n.radius, this.width - n.radius);
    n.y = clamp(y, n.radius, this.height - n.radius);
    this.paintWall(n.x, n.y, n.radius + 8, 0);
  }
  removeNest(id: number) {
    this.nests = this.nests.filter((n) => n.id !== id);
  }
  nestAt(x: number, y: number): Nest | undefined {
    return this.nests.find((n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4);
  }

  // ---------------------------------------------------------------- food
  addFood(x: number, y: number, amount: number): FoodSource {
    const f: FoodSource = { id: this.newId(), x, y, amount, maxAmount: amount };
    this.food.push(f);
    this.paintWall(x, y, foodRadius(f) + 6, 0);
    return f;
  }
  moveFood(f: FoodSource, x: number, y: number) {
    f.x = clamp(x, 4, this.width - 4);
    f.y = clamp(y, 4, this.height - 4);
    this.paintWall(f.x, f.y, foodRadius(f) + 6, 0);
  }
  removeFood(id: number) {
    this.food = this.food.filter((f) => f.id !== id);
  }
  foodById(id: number): FoodSource | undefined {
    return this.food.find((f) => f.id === id);
  }
  foodAt(x: number, y: number): FoodSource | undefined {
    let best: FoodSource | undefined;
    let bd = Infinity;
    for (const f of this.food) {
      const d = Math.hypot(f.x - x, f.y - y) - foodRadius(f);
      if (d < 6 && d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }
  clearFood() {
    this.food = [];
  }

  // ---------------------------------------------------------------- ants
  spawnAnt(colony: Colony, x: number, y: number, heading?: number): Ant {
    const T = colony.traits;
    const a: Ant = {
      id: this.newId(),
      colonyId: colony.id,
      x,
      y,
      heading: heading ?? this.rng.range(0, Math.PI * 2),
      state: 'exploring',
      health: T.maxHealth,
      energy: this.rng.range(0.75, 1),
      carrying: 0,
      foodSignal: 0,
      homeSignal: 1,
      memX: 0,
      memY: 0,
      memBias: this.rng.range(-0.3, 0.3),
      memValid: true,
      targetFoodId: -1,
      targetAntId: -1,
      timer: 0,
      attackCooldown: 0,
      avoidTimer: 0,
      foodBlind: 0,
      age: 0,
      senseFood: 0,
      senseHome: 0,
      senseAlarm: 0,
      senseExplore: 0,
      seesFood: false,
      seesNest: false,
      seesEnemies: 0,
    };
    this.ants.push(a);
    return a;
  }

  /** Spawn n ants around a point (default: colony's nests). */
  spawnAnts(colony: Colony, n: number, x?: number, y?: number) {
    const nests = this.nests.filter((k) => k.colonyId === colony.id);
    for (let i = 0; i < n; i++) {
      let px: number, py: number, h: number | undefined;
      if (x !== undefined && y !== undefined) {
        const ang = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(0, 14);
        px = x + Math.cos(ang) * r;
        py = y + Math.sin(ang) * r;
      } else if (nests.length) {
        const nest = this.rng.pick(nests);
        const ang = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(0, nest.radius * 0.7);
        px = nest.x + Math.cos(ang) * r;
        py = nest.y + Math.sin(ang) * r;
        h = ang;
      } else {
        px = this.rng.range(20, this.width - 20);
        py = this.rng.range(20, this.height - 20);
      }
      if (this.isWall(px, py)) continue;
      const a = this.spawnAnt(colony, clamp(px, 2, this.width - 2), clamp(py, 2, this.height - 2), h);
      // ants placed in the field have no idea where home is
      if (x !== undefined) {
        a.homeSignal = 0.15;
        a.memValid = false;
      }
    }
  }

  removeAntsNear(x: number, y: number, r: number): number {
    const before = this.ants.length;
    this.ants = this.ants.filter((a) => Math.hypot(a.x - x, a.y - y) > r);
    return before - this.ants.length;
  }

  antById(id: number): Ant | undefined {
    for (let i = 0; i < this.ants.length; i++) if (this.ants[i].id === id) return this.ants[i];
    return undefined;
  }

  antAt(x: number, y: number, r = 8): Ant | undefined {
    let best: Ant | undefined;
    let bd = r * r;
    for (const a of this.ants) {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  // ------------------------------------------------------- spatial hash
  private rebuildHash() {
    const n = this.ants.length;
    if (this.cellItems.length < n) {
      this.cellItems = new Int32Array(Math.max(n, this.cellItems.length * 2));
      this.antCell = new Int32Array(this.cellItems.length);
    }
    const start = this.cellStart;
    start.fill(0);
    const hc = WORLD.hashCell;
    for (let i = 0; i < n; i++) {
      const a = this.ants[i];
      const cx = clamp((a.x / hc) | 0, 0, this.hashCols - 1);
      const cy = clamp((a.y / hc) | 0, 0, this.hashRows - 1);
      const cell = cy * this.hashCols + cx;
      this.antCell[i] = cell;
      start[cell + 1]++;
    }
    for (let c = 0; c < start.length - 1; c++) start[c + 1] += start[c];
    const fill = new Int32Array(start.length - 1);
    for (let i = 0; i < n; i++) {
      const cell = this.antCell[i];
      this.cellItems[start[cell] + fill[cell]++] = i;
    }
  }

  /** Visit all ants within radius r of (x,y). Callback returns true to stop early. */
  forEachAntNear(x: number, y: number, r: number, cb: (a: Ant) => boolean | void) {
    const hc = WORLD.hashCell;
    const x0 = clamp(((x - r) / hc) | 0, 0, this.hashCols - 1);
    const x1 = clamp(((x + r) / hc) | 0, 0, this.hashCols - 1);
    const y0 = clamp(((y - r) / hc) | 0, 0, this.hashRows - 1);
    const y1 = clamp(((y + r) / hc) | 0, 0, this.hashRows - 1);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = cy * this.hashCols + cx;
        const s = this.cellStart[cell];
        const e = this.cellStart[cell + 1];
        for (let k = s; k < e; k++) {
          const a = this.ants[this.cellItems[k]];
          const dx = a.x - x;
          const dy = a.y - y;
          if (dx * dx + dy * dy <= r2) if (cb(a)) return;
        }
      }
    }
  }

  // ------------------------------------------------------ perception API
  /** Nearest food within range and in line of sight (local perception only). */
  findVisibleFood(a: Ant, range: number): FoodSource | undefined {
    let best: FoodSource | undefined;
    let bd = Infinity;
    for (const f of this.food) {
      if (f.amount <= 0) continue;
      const d = Math.hypot(f.x - a.x, f.y - a.y) - foodRadius(f);
      if (d < range && d < bd && this.lineOfSight(a.x, a.y, f.x, f.y)) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  findVisibleNest(a: Ant, range: number): Nest | undefined {
    let best: Nest | undefined;
    let bd = Infinity;
    for (const n of this.nests) {
      if (n.colonyId !== a.colonyId) continue;
      const d = Math.hypot(n.x - a.x, n.y - a.y) - n.radius;
      if (d < range && d < bd && (d < 0 || this.lineOfSight(a.x, a.y, n.x, n.y))) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- step
  step() {
    this.tick++;
    this.rebuildHash();

    // 1. ants decide + move (local rules only)
    const colonyMap = new Map<number, Colony>();
    for (const c of this.colonies) colonyMap.set(c.id, c);
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      const c = colonyMap.get(a.colonyId);
      if (!c) continue;
      updateAnt(this, a, c);
      if ((this.tick + i) % 10 === 0) this.markTerritory(c, a);
    }

    // 2. bury the dead
    for (let i = this.ants.length - 1; i >= 0; i--) {
      const a = this.ants[i];
      if (a.health <= 0) {
        const c = colonyMap.get(a.colonyId);
        if (c) c.deaths++;
        this.ants[i] = this.ants[this.ants.length - 1];
        this.ants.pop();
      }
    }

    // 3. pheromone evaporation + diffusion
    if (this.tick % SIM.diffuseInterval === 0) {
      for (const c of this.colonies) c.pheromones.update(c.traits.pheromoneDecay, this.walls);
    }

    // 4. depleted food disappears
    if (this.food.some((f) => f.amount <= 0.01)) this.food = this.food.filter((f) => f.amount > 0.01);

    // 5. reproduction: new ants cost stored food, never free
    for (const c of this.colonies) {
      if (!c.traits.autoGrow) continue;
      if (++c.growTimer < SIM.growInterval) continue;
      c.growTimer = 0;
      const living = c.stats.living;
      if (living >= c.traits.maxPopulation) continue;
      if (c.storedFood < SIM.antFoodCost) continue;
      if (!this.nests.some((n) => n.colonyId === c.id)) continue;
      c.storedFood -= SIM.antFoodCost;
      this.spawnAnts(c, 1);
    }

    // 6. statistics
    if (this.tick % 20 === 0) this.computeStats();
    if (this.tick % SIM.historyInterval === 0) {
      for (const c of this.colonies) {
        c.history.push({
          tick: this.tick,
          population: c.stats.living,
          stored: c.storedFood,
          collected: c.totalCollected,
          deaths: c.deaths,
        });
        if (c.history.length > SIM.historyLength) c.history.shift();
      }
    }
  }

  private markTerritory(c: Colony, a: Ant) {
    const tx = clamp((a.x / WORLD.territoryCell) | 0, 0, this.terrCols - 1);
    const ty = clamp((a.y / WORLD.territoryCell) | 0, 0, this.terrRows - 1);
    c.territory[ty * this.terrCols + tx] = this.tick;
  }

  computeStats() {
    for (const c of this.colonies) {
      const s = c.stats;
      s.living = 0;
      s.explorers = 0;
      s.carrying = 0;
      s.fighting = 0;
      let hp = 0;
      for (const a of this.ants) {
        if (a.colonyId !== c.id) continue;
        s.living++;
        hp += a.health / c.traits.maxHealth;
        if (a.state === 'exploring' || a.state === 'followingFood') s.explorers++;
        if (a.carrying > 0) s.carrying++;
        if (a.state === 'fighting') s.fighting++;
      }
      s.avgHealth = s.living ? hp / s.living : 0;
      let cells = 0;
      const cutoff = this.tick - WORLD.territoryWindow;
      for (let i = 0; i < c.territory.length; i++) if (c.territory[i] >= cutoff) cells++;
      s.territoryCells = cells;
      s.territoryArea = cells * WORLD.territoryCell * WORLD.territoryCell;
    }
  }

  clearPheromones(type?: PheromoneType) {
    for (const c of this.colonies) c.pheromones.clear(type);
  }

  // -------------------------------------------------------- setup / io
  toSetup(): WorldSetup {
    // run-length encode walls
    const rle: number[] = [];
    let cur = this.walls[0];
    let run = 0;
    for (let i = 0; i < this.walls.length; i++) {
      if (this.walls[i] === cur) run++;
      else {
        rle.push(cur, run);
        cur = this.walls[i];
        run = 1;
      }
    }
    rle.push(cur, run);
    return {
      version: 1,
      seed: this.seed,
      colonies: this.colonies.map((c) => ({ id: c.id, traits: { ...c.traits }, storedFood: c.storedFood })),
      nests: this.nests.map((n) => ({ ...n })),
      food: this.food.map((f) => ({ ...f })),
      walls: rle,
      pathMemory: this.pathMemory,
    };
  }

  /** Rebuild the world from a setup: colonies, nests, food, walls, then spawn starting ants. */
  loadSetup(setup: WorldSetup, rememberAsInitial = true) {
    if (rememberAsInitial) this.initialSetup = JSON.parse(JSON.stringify(setup));
    this.seed = setup.seed;
    this.rng = new RNG(setup.seed);
    this.tick = 0;
    this.pathMemory = setup.pathMemory ?? true;
    this.colonies = [];
    this.nests = [];
    this.food = [];
    this.ants = [];
    this.nextId = 1;
    this.walls.fill(0);
    let i = 0;
    for (let k = 0; k < setup.walls.length; k += 2) {
      const v = setup.walls[k];
      const n = setup.walls[k + 1];
      if (v) this.walls.fill(1, i, i + n);
      i += n;
    }
    this.wallsVersion++;
    const idMap = new Map<number, number>();
    for (const sc of setup.colonies) {
      // keep colony ids stable so UI references (active colony, filters) survive a reset
      const taken = idMap.has(sc.id) || this.colonies.some((k) => k.id === sc.id);
      const c = this.addColony(sc.traits, taken ? undefined : sc.id);
      c.storedFood = sc.storedFood ?? 0;
      idMap.set(sc.id, c.id);
    }
    for (const n of setup.nests) {
      const cid = idMap.get(n.colonyId);
      if (cid !== undefined) this.addNest(cid, n.x, n.y);
    }
    for (const f of setup.food) {
      const nf = this.addFood(f.x, f.y, f.amount);
      nf.maxAmount = f.maxAmount ?? f.amount;
    }
    // (starting ants are spawned by addNest when a colony's first nest is placed)
    this.computeStats();
  }

  /** Reset to the last loaded/remembered setup (keeps user edits to layout since they were saved as initial). */
  reset() {
    if (this.initialSetup) this.loadSetup(this.initialSetup, true);
  }

  /** Remember the current layout as the reset point. */
  rememberCurrentAsInitial() {
    this.initialSetup = this.toSetup();
  }

  clearAll(keepColonies = true) {
    const cols = keepColonies ? this.colonies : [];
    this.loadSetup(
      {
        version: 1,
        seed: this.seed,
        colonies: cols.map((c) => ({ id: c.id, traits: { ...c.traits }, storedFood: 0 })),
        nests: [],
        food: [],
        walls: [0, this.walls.length],
        pathMemory: this.pathMemory,
      },
      true,
    );
  }
}

// ------------------------------------------------------------ helpers
export function foodRadius(f: FoodSource): number {
  return SIM.foodRadiusBase + Math.sqrt(Math.max(0, f.amount)) * SIM.foodRadiusScale;
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function shiftHue(hex: string, deg: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  let r = parseInt(m[1], 16) / 255,
    g = parseInt(m[2], 16) / 255,
    b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let rr = 0,
    gg = 0,
    bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + mm) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}
