import { WORLD } from './config';
import { RNG } from './rng';
import type { ColonyTraits, WorldSetup } from './types';
import type { World } from './world';

export const COLONY_PALETTE = ['#f5b342', '#4fd1e0', '#f06fc4', '#a3e635', '#c084fc', '#fb7185', '#34d399', '#fbbf24'];

export const DEFAULT_TRAITS: ColonyTraits = {
  name: 'Colony',
  color: '#f5b342',
  startPopulation: 120,
  speed: 1.2,
  maxHealth: 100,
  strength: 8,
  carryCapacity: 3,
  senseRange: 36,
  pheromoneStrength: 1,
  pheromoneSensitivity: 1,
  pheromoneDecay: 1,
  exploration: 0.35,
  aggression: 0.3,
  energyUse: 1,
  autoGrow: true,
  maxPopulation: 300,
};

export interface TraitMeta {
  key: keyof ColonyTraits;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

export const TRAIT_META: TraitMeta[] = [
  { key: 'startPopulation', label: 'Start population', min: 5, max: 400, step: 5, hint: 'Ants spawned on reset.' },
  { key: 'maxPopulation', label: 'Population cap', min: 5, max: 800, step: 5, hint: 'Auto-growth stops here.' },
  { key: 'speed', label: 'Speed', min: 0.4, max: 3, step: 0.05, hint: 'Faster ants finish trips sooner and reinforce trails more often.' },
  { key: 'maxHealth', label: 'Health', min: 20, max: 300, step: 5, hint: 'Durability in fights and against starvation.' },
  { key: 'strength', label: 'Strength', min: 1, max: 40, step: 1, hint: 'Damage dealt per hit.' },
  { key: 'carryCapacity', label: 'Carry capacity', min: 1, max: 12, step: 1, hint: 'Food units per trip.' },
  { key: 'senseRange', label: 'Sense range', min: 12, max: 90, step: 2, hint: 'How far ants see food, nests and rivals.' },
  { key: 'pheromoneStrength', label: 'Pheromone production', min: 0.2, max: 3, step: 0.05, hint: 'Deposit strength; higher builds trails faster.' },
  { key: 'pheromoneSensitivity', label: 'Pheromone sensitivity', min: 0.2, max: 3, step: 0.05, hint: 'How strongly faint signals are perceived.' },
  { key: 'pheromoneDecay', label: 'Pheromone decay', min: 0.4, max: 2.5, step: 0.05, hint: '>1 trails fade faster; <1 they linger.' },
  { key: 'exploration', label: 'Exploration', min: 0, max: 1, step: 0.01, hint: 'Willingness to wander and leave trails.' },
  { key: 'aggression', label: 'Aggression', min: 0, max: 1, step: 0.01, hint: 'Chance to challenge rivals and answer alarms.' },
  { key: 'energyUse', label: 'Energy use', min: 0.2, max: 3, step: 0.05, hint: 'Metabolism; hungry ants return to rest and eat.' },
];

const emptyWalls = (cols: number, rows: number) => [0, cols * rows];

/** Default demonstration: two contrasting colonies, several food patches, a few walls. */
export function defaultScenario(world: World): WorldSetup {
  const { cols, rows } = world;
  const W = WORLD.width;
  const H = WORLD.height;
  const setup: WorldSetup = {
    version: 1,
    seed: 1337,
    colonies: [
      {
        id: 1,
        storedFood: 20,
        traits: {
          ...DEFAULT_TRAITS,
          name: 'Amber Runners',
          color: '#f5b342',
          speed: 1.5,
          maxHealth: 70,
          strength: 6,
          carryCapacity: 2,
          exploration: 0.5,
          aggression: 0.25,
          startPopulation: 130,
        },
      },
      {
        id: 2,
        storedFood: 20,
        traits: {
          ...DEFAULT_TRAITS,
          name: 'Teal Haulers',
          color: '#4fd1e0',
          speed: 0.95,
          maxHealth: 150,
          strength: 12,
          carryCapacity: 5,
          exploration: 0.25,
          aggression: 0.35,
          startPopulation: 100,
        },
      },
    ],
    nests: [
      { id: 101, colonyId: 1, x: W * 0.2, y: H * 0.3, radius: 20 },
      { id: 102, colonyId: 2, x: W * 0.8, y: H * 0.7, radius: 20 },
    ],
    food: [
      { id: 201, x: W * 0.46, y: H * 0.22, amount: 180, maxAmount: 180 },
      { id: 202, x: W * 0.12, y: H * 0.78, amount: 120, maxAmount: 120 },
      { id: 203, x: W * 0.5, y: H * 0.55, amount: 260, maxAmount: 260 },
      { id: 204, x: W * 0.86, y: H * 0.25, amount: 140, maxAmount: 140 },
      { id: 205, x: W * 0.62, y: H * 0.86, amount: 110, maxAmount: 110 },
    ],
    walls: emptyWalls(cols, rows),
    pathMemory: true,
  };
  return setup;
}

/** Draw the default walls after loading (uses World.paintWall so nests/food are protected). */
export function paintDefaultWalls(world: World) {
  const W = WORLD.width;
  const H = WORLD.height;
  strokeWall(world, W * 0.36, H * 0.3, W * 0.36, H * 0.62, 7);
  strokeWall(world, W * 0.6, H * 0.12, W * 0.6, H * 0.4, 7);
  strokeWall(world, W * 0.62, H * 0.62, W * 0.9, H * 0.62, 7);
  strokeWall(world, W * 0.18, H * 0.55, W * 0.3, H * 0.55, 7);
  world.rememberCurrentAsInitial();
}

export function strokeWall(world: World, x0: number, y0: number, x1: number, y1: number, r: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / (r * 0.5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    world.paintWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, 1);
  }
}

/** Random experiment map: keeps the current colonies, randomizes nests, food and walls. */
export function randomScenario(world: World, seed: number) {
  const rng = new RNG(seed);
  const W = WORLD.width;
  const H = WORLD.height;
  const colonies = world.colonies.length
    ? world.colonies.map((c) => ({ id: c.id, traits: { ...c.traits }, storedFood: 10 }))
    : defaultScenario(world).colonies;
  const nests = colonies.map((c, i) => {
    const ang = (i / colonies.length) * Math.PI * 2 + rng.range(-0.4, 0.4);
    return {
      id: 1000 + i,
      colonyId: c.id,
      x: W / 2 + Math.cos(ang) * W * 0.36,
      y: H / 2 + Math.sin(ang) * H * 0.36,
      radius: 20,
    };
  });
  const food = [];
  const nFood = rng.int(4, 8);
  for (let i = 0; i < nFood; i++) {
    food.push({
      id: 2000 + i,
      x: rng.range(60, W - 60),
      y: rng.range(60, H - 60),
      amount: rng.int(80, 300),
      maxAmount: 0,
    });
  }
  for (const f of food) f.maxAmount = f.amount;
  world.loadSetup(
    { version: 1, seed, colonies, nests, food, walls: emptyWalls(world.cols, world.rows), pathMemory: world.pathMemory },
    true,
  );
  // Random wall segments
  const nWalls = rng.int(4, 9);
  for (let i = 0; i < nWalls; i++) {
    const x0 = rng.range(80, W - 80);
    const y0 = rng.range(80, H - 80);
    const len = rng.range(120, 380);
    const ang = rng.next() < 0.5 ? 0 : Math.PI / 2;
    const a2 = ang + rng.range(-0.3, 0.3);
    strokeWall(world, x0, y0, x0 + Math.cos(a2) * len, y0 + Math.sin(a2) * len, rng.range(6, 10));
  }
  world.rememberCurrentAsInitial();
}
