/**
 * Setup-level persistence: colonies (traits + policies), nests, food, walls,
 * world params and seed. Individual ants and pheromone values are not saved;
 * loading a setup re-spawns populations at their nests.
 */
import { DEFAULT_TRAITS, hexToRgb, type Colony } from './colony';
import { DEFAULT_PROFILE, deserializePolicy, serializePolicy } from './policy';
import { gridInfo, World, type SavedSetup } from './world';

const LS_KEY = 'ant-colony-lab:setup';

export function serializeSetup(world: World): SavedSetup {
  return {
    version: 1,
    seed: world.seed,
    params: { ...world.params },
    colonies: world.colonies.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      traits: { ...c.traits },
      profileName: c.profileName,
      policy: serializePolicy(c.policy),
      basePolicy: serializePolicy(c.basePolicy),
    })),
    nests: world.nests.map((n) => ({ colonyId: n.colonyId, x: n.x, y: n.y, radius: n.radius })),
    foods: world.foods.filter((f) => f.quantity > 0).map((f) => ({ x: f.x, y: f.y, quantity: f.quantity, maxQuantity: f.maxQuantity, radiusBonus: f.radiusBonus })),
    walls: world.walls.encode(),
    grid: gridInfo(),
  };
}

export function applySetup(world: World, s: SavedSetup): void {
  world.colonies = [];
  world.clearWorld();
  world.params = { ...world.params, ...s.params };
  const idMap = new Map<number, number>();
  for (const sc of s.colonies) {
    const added: Colony = world.addColony({ name: sc.name, color: sc.color, traits: sc.traits, profile: DEFAULT_PROFILE, description: '' });
    added.name = sc.name;
    added.color = sc.color;
    added.rgb = hexToRgb(sc.color);
    added.traits = { ...DEFAULT_TRAITS, ...sc.traits };
    added.profileName = sc.profileName;
    const p = deserializePolicy(sc.policy);
    const bp = deserializePolicy(sc.basePolicy);
    if (bp) added.basePolicy = bp;
    if (p) added.policy = p;
    idMap.set(sc.id, added.id);
  }
  for (const n of s.nests) {
    const cid = idMap.get(n.colonyId);
    if (cid !== undefined) world.addNest(cid, n.x, n.y, n.radius);
  }
  for (const f of s.foods) {
    const food = world.addFood(f.x, f.y, f.quantity, f.radiusBonus);
    food.maxQuantity = f.maxQuantity;
  }
  if (s.grid && s.grid.w === gridInfo().w && s.grid.h === gridInfo().h) world.walls.decode(s.walls);
  world.resetRuntime(s.seed);
}

export function saveToLocal(world: World): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(serializeSetup(world)));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocal(world: World): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    applySetup(world, JSON.parse(raw) as SavedSetup);
    return true;
  } catch {
    return false;
  }
}

export function hasLocalSave(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

export function exportSetupFile(world: World): void {
  const blob = new Blob([JSON.stringify(serializeSetup(world), null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ant-colony-setup-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importSetupFile(world: World): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(false);
      file.text().then((txt) => {
        try {
          applySetup(world, JSON.parse(txt) as SavedSetup);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
    };
    input.click();
  });
}
