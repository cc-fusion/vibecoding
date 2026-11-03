import { item, type ItemDef } from "./blocks";

export interface Stack {
  id: string;
  count: number;
  dur?: number;
}

export const INV_SIZE = 36;

export function stackMax(id: string): number {
  return item(id)?.stack ?? 64;
}

export function cloneStack(s: Stack | null): Stack | null {
  return s ? { ...s } : null;
}

export class Inventory {
  slots: (Stack | null)[] = new Array(INV_SIZE).fill(null);
  selected = 0;

  get held(): Stack | null {
    return this.slots[this.selected];
  }

  /** returns number of items that did NOT fit */
  add(id: string, count: number, dur?: number): number {
    const max = stackMax(id);
    if (max > 1) {
      for (let i = 0; i < INV_SIZE && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const take = Math.min(max - s.count, count);
          s.count += take;
          count -= take;
        }
      }
    }
    for (let i = 0; i < INV_SIZE && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, count);
        this.slots[i] = { id, count: take, dur };
        count -= take;
      }
    }
    return count;
  }

  has(id: string, count: number): boolean {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n >= count;
  }

  countOf(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id: string, count: number): boolean {
    if (!this.has(id, count)) return false;
    for (let i = 0; i < INV_SIZE && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, count);
        s.count -= take;
        count -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  consumeSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
  }

  /** damage the held tool; returns true if it broke */
  damageSelected(amount = 1): boolean {
    const s = this.slots[this.selected];
    if (!s) return false;
    const def = item(s.id);
    if (!def?.tool) return false;
    s.dur = (s.dur ?? def.tool.durability) - amount;
    if (s.dur <= 0) {
      this.slots[this.selected] = null;
      return true;
    }
    return false;
  }

  heldTool(): ItemDef | undefined {
    const s = this.slots[this.selected];
    return s ? item(s.id) : undefined;
  }

  serialize() {
    return this.slots.map((s) => (s ? [s.id, s.count, s.dur ?? 0] : null));
  }
  load(data: any) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(INV_SIZE).fill(null);
    for (let i = 0; i < Math.min(INV_SIZE, data.length); i++) {
      const d = data[i];
      if (!d) continue;
      if (!item(d[0])) continue;
      this.slots[i] = { id: d[0], count: d[1], dur: d[2] || undefined };
    }
  }
}

// ── crafting ───────────────────────────────────────────────────────────────
export interface Recipe {
  out: { id: string; count: number };
  pattern?: string[];
  key?: Record<string, string>;
  shapeless?: string[];
  /** requires 3x3 table */
  big?: boolean;
}

export const RECIPES: Recipe[] = [];

function shaped(out: string, count: number, pattern: string[], key: Record<string, string>) {
  const big = pattern.length > 2 || pattern.some((r) => r.length > 2);
  RECIPES.push({ out: { id: out, count }, pattern, key, big });
}
function shapeless(out: string, count: number, ing: string[]) {
  RECIPES.push({ out: { id: out, count }, shapeless: ing, big: ing.length > 4 });
}

const WOODS = [
  ["oak_log", "oak_planks"],
  ["birch_log", "birch_planks"],
  ["spruce_log", "spruce_planks"],
];

export function initRecipes() {
  if (RECIPES.length) return;
  for (const [log, planks] of WOODS) shapeless(planks, 4, [log]);
  shaped("stick", 4, ["P", "P"], { P: "oak_planks" });
  shaped("stick", 4, ["P", "P"], { P: "birch_planks" });
  shaped("stick", 4, ["P", "P"], { P: "spruce_planks" });
  shaped("crafting_table", 1, ["PP", "PP"], { P: "oak_planks" });
  shaped("crafting_table", 1, ["PP", "PP"], { P: "birch_planks" });
  shaped("crafting_table", 1, ["PP", "PP"], { P: "spruce_planks" });
  shaped("furnace", 1, ["CCC", "C C", "CCC"], { C: "cobblestone" });
  shaped("chest", 1, ["PPP", "P P", "PPP"], { P: "oak_planks" });
  shaped("chest", 1, ["PPP", "P P", "PPP"], { P: "spruce_planks" });
  shaped("chest", 1, ["PPP", "P P", "PPP"], { P: "birch_planks" });
  shaped("torch", 4, ["C", "S"], { C: "coal", S: "stick" });
  shaped("torch", 4, ["C", "S"], { C: "charcoal", S: "stick" });
  shaped("ladder", 3, ["S S", "SSS", "S S"], { S: "stick" });
  shaped("glass", 1, ["S"], { S: "sand" }); // placeholder replaced by smelting; removed below
  RECIPES.pop();
  shaped("sandstone", 1, ["SS", "SS"], { S: "sand" });
  shaped("stone_bricks", 4, ["SS", "SS"], { S: "stone" });
  shaped("bricks", 1, ["BB", "BB"], { B: "brick" });
  shapeless("bread", 1, ["wheat", "wheat", "wheat"]);
  shaped("white_wool", 1, ["SS", "SS"], { S: "string" });
  shaped("block_of_coal", 1, ["CCC", "CCC", "CCC"], { C: "coal" });
  shaped("block_of_iron", 1, ["CCC", "CCC", "CCC"], { C: "iron_ingot" });
  shaped("block_of_gold", 1, ["CCC", "CCC", "CCC"], { C: "gold_ingot" });
  shaped("block_of_diamond", 1, ["CCC", "CCC", "CCC"], { C: "diamond" });
  shapeless("coal", 9, ["block_of_coal"]);
  shapeless("iron_ingot", 9, ["block_of_iron"]);
  shapeless("diamond", 9, ["block_of_diamond"]);

  const mats: [string, string][] = [
    ["wooden", "oak_planks"],
    ["stone", "cobblestone"],
    ["iron", "iron_ingot"],
    ["diamond", "diamond"],
  ];
  for (const [name, mat] of mats) {
    shaped(`${name}_pickaxe`, 1, ["MMM", " S ", " S "], { M: mat, S: "stick" });
    shaped(`${name}_axe`, 1, ["MM", "MS", " S"], { M: mat, S: "stick" });
    shaped(`${name}_shovel`, 1, ["M", "S", "S"], { M: mat, S: "stick" });
    shaped(`${name}_sword`, 1, ["M", "M", "S"], { M: mat, S: "stick" });
  }
}

/** grid is row-major of size w*w */
export function matchRecipe(grid: (Stack | null)[], w: number): Recipe | null {
  const ids = grid.map((s) => (s ? s.id : null));
  // bounding box
  let minR = w,
    maxR = -1,
    minC = w,
    maxC = -1;
  for (let r = 0; r < w; r++)
    for (let c = 0; c < w; c++) {
      if (ids[r * w + c]) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  if (maxR < 0) return null;
  const h = maxR - minR + 1;
  const ww = maxC - minC + 1;

  for (const rec of RECIPES) {
    if (rec.big && w < 3) continue;
    if (rec.pattern && rec.key) {
      if (rec.pattern.length !== h) continue;
      if (rec.pattern[0].length !== ww) continue;
      let ok = true;
      for (let r = 0; r < h && ok; r++)
        for (let c = 0; c < ww; c++) {
          const ch = rec.pattern[r][c];
          const want = ch === " " ? null : rec.key[ch];
          const got = ids[(minR + r) * w + (minC + c)];
          if (want !== got) {
            ok = false;
            break;
          }
        }
      if (ok) return rec;
    } else if (rec.shapeless) {
      const present = ids.filter((i): i is string => !!i);
      if (present.length !== rec.shapeless.length) continue;
      const pool = [...rec.shapeless];
      let ok = true;
      for (const p of present) {
        const i = pool.indexOf(p);
        if (i < 0) {
          ok = false;
          break;
        }
        pool.splice(i, 1);
      }
      if (ok && pool.length === 0) return rec;
    }
  }
  return null;
}

// ── smelting ───────────────────────────────────────────────────────────────
export const SMELTING: Record<string, { id: string; count: number }> = {
  raw_iron: { id: "iron_ingot", count: 1 },
  raw_gold: { id: "gold_ingot", count: 1 },
  sand: { id: "glass", count: 1 },
  cobblestone: { id: "stone", count: 1 },
  clay_ball: { id: "brick", count: 1 },
  porkchop_raw: { id: "porkchop_cooked", count: 1 },
  oak_log: { id: "charcoal", count: 1 },
  birch_log: { id: "charcoal", count: 1 },
  spruce_log: { id: "charcoal", count: 1 },
  iron_ore: { id: "iron_ingot", count: 1 },
  gold_ore: { id: "gold_ingot", count: 1 },
};

export interface FurnaceState {
  input: Stack | null;
  fuel: Stack | null;
  output: Stack | null;
  burnTime: number;
  burnMax: number;
  cookTime: number;
}

export function newFurnace(): FurnaceState {
  return { input: null, fuel: null, output: null, burnTime: 0, burnMax: 0, cookTime: 0 };
}

export const COOK_TIME = 6;

export function tickFurnace(f: FurnaceState, dt: number): boolean {
  let changed = false;
  if (f.burnTime > 0) {
    f.burnTime -= dt;
    if (f.burnTime < 0) f.burnTime = 0;
    changed = true;
  }
  const recipe = f.input ? SMELTING[f.input.id] : undefined;
  const canOutput =
    !!recipe &&
    (!f.output ||
      (f.output.id === recipe.id && f.output.count + recipe.count <= stackMax(recipe.id)));

  if (canOutput && f.burnTime <= 0 && f.fuel) {
    const fu = item(f.fuel.id)?.fuel;
    if (fu) {
      f.burnTime = fu / 8;
      f.burnMax = f.burnTime;
      f.fuel.count--;
      if (f.fuel.count <= 0) f.fuel = null;
      changed = true;
    }
  }
  if (canOutput && f.burnTime > 0) {
    f.cookTime += dt;
    changed = true;
    if (f.cookTime >= COOK_TIME) {
      f.cookTime = 0;
      if (f.output) f.output.count += recipe!.count;
      else f.output = { id: recipe!.id, count: recipe!.count };
      f.input!.count--;
      if (f.input!.count <= 0) f.input = null;
    }
  } else if (f.cookTime > 0) {
    f.cookTime = Math.max(0, f.cookTime - dt * 2);
    changed = true;
  }
  return changed;
}
