// Crafting + smelting recipes and matching logic.
import { B, I, DEFS } from './blocks.js';

export const GROUPS = {
  log: [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG],
  planks: [B.PLANKS],
  coal: [I.COAL, I.CHARCOAL],
};

const specIds = (spec) => (typeof spec === 'string' ? GROUPS[spec] : Array.isArray(spec) ? spec : [spec]);
export const specMatches = (spec, id) => specIds(spec).includes(id);
export const specRepresentative = (spec) => specIds(spec)[0];

export const RECIPES = [];

function shaped(rows, key, result, count = 1) {
  const h = rows.length, w = rows[0].length;
  const pattern = [];
  for (const r of rows) for (const ch of r) pattern.push(ch === ' ' ? null : key[ch]);
  RECIPES.push({ w, h, pattern, result: [result, count], shapeless: false });
}
function shapeless(specs, result, count = 1) {
  RECIPES.push({ w: 0, h: 0, pattern: specs, result: [result, count], shapeless: true });
}

// materials
shapeless(['log'], B.PLANKS, 4);
shaped(['P', 'P'], { P: 'planks' }, I.STICK, 4);
shaped(['PP', 'PP'], { P: 'planks' }, B.CRAFTING_TABLE);
shaped(['CCC', 'C C', 'CCC'], { C: B.COBBLE }, B.FURNACE);
shaped(['PPP', 'P P', 'PPP'], { P: 'planks' }, B.CHEST);
shaped(['C', 'S'], { C: 'coal', S: I.STICK }, B.TORCH, 4);
shaped(['SS', 'SS'], { S: B.STONE }, B.STONE_BRICKS, 4);
shaped(['SS', 'SS'], { S: B.SAND }, B.SANDSTONE);
shaped(['WWW', 'PPP'], { W: B.WOOL, P: 'planks' }, B.BED);
shaped(['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: B.SAND }, B.TNT);
shapeless([I.IRON_INGOT, I.FLINT], I.FLINT_STEEL);
shapeless([I.BONE], I.BONE_MEAL, 3);

const TOOL_MATS = [['WOOD', 'planks'], ['STONE', B.COBBLE], ['IRON', I.IRON_INGOT], ['DIAMOND', I.DIAMOND]];
for (const [k, m] of TOOL_MATS) {
  shaped(['MMM', ' S ', ' S '], { M: m, S: I.STICK }, I[`${k}_PICKAXE`]);
  shaped(['MM', 'MS', ' S'], { M: m, S: I.STICK }, I[`${k}_AXE`]);
  shaped(['M', 'S', 'S'], { M: m, S: I.STICK }, I[`${k}_SHOVEL`]);
  shaped(['M', 'M', 'S'], { M: m, S: I.STICK }, I[`${k}_SWORD`]);
}

// ---- smelting -----------------------------------------------------------------------------------
export const SMELTING = new Map([
  [B.IRON_ORE, [I.IRON_INGOT, 1]], [B.GOLD_ORE, [I.GOLD_INGOT, 1]], [B.SAND, [B.GLASS, 1]], [B.COBBLE, [B.STONE, 1]],
  [B.LOG, [I.CHARCOAL, 1]], [B.BIRCH_LOG, [I.CHARCOAL, 1]], [B.SPRUCE_LOG, [I.CHARCOAL, 1]],
  [I.RAW_PORK, [I.COOKED_PORK, 1]], [I.RAW_BEEF, [I.COOKED_BEEF, 1]], [I.RAW_MUTTON, [I.COOKED_MUTTON, 1]], [I.RAW_CHICKEN, [I.COOKED_CHICKEN, 1]],
  [B.SANDSTONE, [B.SAND, 1]],
]);
export const fuelTime = (id) => (DEFS[id] && DEFS[id].fuel) || 0;

// ---- matching -----------------------------------------------------------------------------------
function trim(grid, gw, gh) {
  let minx = gw, miny = gh, maxx = -1, maxy = -1;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (grid[y * gw + x]) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  }
  if (maxx < 0) return null;
  return { minx, miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}

export function findRecipe(grid, gw, gh) {
  const box = trim(grid, gw, gh);
  if (!box) return null;
  const items = grid.filter(Boolean);
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (items.length !== r.pattern.length) continue;
      const used = new Array(items.length).fill(false);
      let ok = true;
      for (const spec of r.pattern) {
        let found = false;
        for (let i = 0; i < items.length; i++) if (!used[i] && specMatches(spec, items[i].id)) { used[i] = true; found = true; break; }
        if (!found) { ok = false; break; }
      }
      if (ok) return r;
    } else {
      if (r.w !== box.w || r.h !== box.h) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < box.h && ok; y++) for (let x = 0; x < box.w && ok; x++) {
          const spec = r.pattern[y * r.w + (mirror ? r.w - 1 - x : x)];
          const it = grid[(box.miny + y) * gw + box.minx + x];
          if (!spec) { if (it) ok = false; } else if (!it || !specMatches(spec, it.id)) ok = false;
        }
        if (ok) return r;
      }
    }
  }
  return null;
}

// can the recipe be made from the inventory counts? returns assignment (spec -> chosen id) or null
export function planFromInventory(recipe, inv) {
  const counts = new Map();
  for (const s of inv.slots) if (s) counts.set(s.id, (counts.get(s.id) || 0) + s.count);
  const picks = [];
  for (const spec of recipe.pattern) {
    if (!spec) { picks.push(null); continue; }
    let chosen = null;
    for (const id of specIds(spec)) if ((counts.get(id) || 0) > 0) { chosen = id; break; }
    if (chosen === null) return null;
    counts.set(chosen, counts.get(chosen) - 1);
    picks.push(chosen);
  }
  return picks;
}

export const recipeSize = (r) => (r.shapeless ? { w: Math.ceil(Math.sqrt(r.pattern.length)), h: Math.ceil(r.pattern.length / Math.ceil(Math.sqrt(r.pattern.length))) } : { w: r.w, h: r.h });
export const recipeFitsGrid = (r, gw, gh) => {
  const s = recipeSize(r);
  if (r.shapeless) return r.pattern.length <= gw * gh;
  return s.w <= gw && s.h <= gh;
};
export function describeIngredient(spec) {
  const ids = specIds(spec);
  if (typeof spec === 'string') return { name: spec === 'log' ? 'Any Log' : spec === 'planks' ? 'Planks' : 'Coal or Charcoal', id: ids[0] };
  return { name: DEFS[ids[0]].name, id: ids[0] };
}
