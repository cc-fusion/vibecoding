// Inventory, containers, crafting grid, furnace logic, slot click semantics.
import { ITEMDEF, findRecipe, SMELT, fuelValue, type Stack } from './items';
import { B } from './blocks';

export const stackMax = (id: number) => ITEMDEF[id]?.max ?? 64;

export function addToSlots(slots: (Stack | null)[], s: Stack, from = 0, to = slots.length): number {
  let n = s.n;
  const max = stackMax(s.id);
  if (max > 1 && s.d === undefined) {
    for (let i = from; i < to && n > 0; i++) {
      const t = slots[i];
      if (t && t.id === s.id && t.d === undefined && t.n < max) { const m = Math.min(max - t.n, n); t.n += m; n -= m; }
    }
  }
  for (let i = from; i < to && n > 0; i++) {
    if (!slots[i]) { const m = Math.min(max, n); slots[i] = { id: s.id, n: m, d: s.d }; n -= m; }
  }
  return n;
}

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  // hotbar = 0..8, main = 9..35. Pickups go to hotbar first then main.
  add(s: Stack): number { return addToSlots(this.slots, { ...s }); }
  canAdd(id: number) {
    const max = stackMax(id);
    return this.slots.some((t) => !t || (t.id === id && t.n < max && t.d === undefined && max > 1));
  }
  count(id: number) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; return n; }
  remove(id: number, n: number) {
    if (this.count(id) < n) return false;
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) { const m = Math.min(s.n, n); s.n -= m; n -= m; if (s.n <= 0) this.slots[i] = null; }
    }
    return true;
  }
  clear() { this.slots.fill(null); }
  serialize() { return this.slots.map((s) => (s ? [s.id, s.n, s.d ?? -1] : null)); }
  load(data: any[]) { this.slots = new Array(36).fill(null); (data || []).forEach((d, i) => { if (d && i < 36) this.slots[i] = { id: d[0], n: d[1], d: d[2] >= 0 ? d[2] : undefined }; }); }
}

export interface CraftGrid { grid: (Stack | null)[]; w: number; h: number; result: Stack | null }
export const newCraft = (w: number, h: number): CraftGrid => ({ grid: new Array(w * h).fill(null), w, h, result: null });
export function updateCraft(c: CraftGrid) {
  const r = findRecipe(c.grid, c.w, c.h);
  c.result = r ? { id: r.out, n: r.n } : null;
}

export interface BlockEntity { type: 'furnace' | 'chest'; slots: (Stack | null)[]; burn: number; burnMax: number; cook: number }
export const newFurnace = (): BlockEntity => ({ type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
export const newChest = (): BlockEntity => ({ type: 'chest', slots: new Array(27).fill(null), burn: 0, burnMax: 0, cook: 0 });

// returns true if lit state changed
export function tickFurnace(be: BlockEntity, dt: number): boolean {
  const [input, fuel, out] = be.slots;
  const res = input ? SMELT[input.id] : undefined;
  const canSmelt = res !== undefined && (!out || (out.id === res && out.n < stackMax(res)));
  const wasLit = be.burn > 0;
  if (be.burn > 0) be.burn = Math.max(0, be.burn - dt);
  if (canSmelt && be.burn <= 0 && fuel && fuelValue(fuel.id) > 0) {
    be.burn = be.burnMax = fuelValue(fuel.id);
    fuel.n--;
    if (fuel.n <= 0) be.slots[1] = null;
  }
  if (be.burn > 0 && canSmelt) {
    be.cook += dt;
    if (be.cook >= 10) {
      be.cook = 0;
      if (out) out.n++; else be.slots[2] = { id: res!, n: 1 };
      input!.n--;
      if (input!.n <= 0) be.slots[0] = null;
    }
  } else be.cook = Math.max(0, be.cook - dt * 2);
  return wasLit !== be.burn > 0;
}

export interface Cursor { stack: Stack | null }
export type SlotKind = 'normal' | 'result' | 'furnace_out' | 'furnace_in' | 'furnace_fuel';

export function slotAccepts(kind: SlotKind, s: Stack) {
  if (kind === 'result' || kind === 'furnace_out') return false;
  if (kind === 'furnace_in') return SMELT[s.id] !== undefined;
  if (kind === 'furnace_fuel') return fuelValue(s.id) > 0;
  return true;
}

export interface ClickEnv {
  cursor: Cursor; inv: Inventory; creative: boolean; craft: CraftGrid | null;
  onCraft?: (id: number) => void; changed: () => void; others?: (Stack | null)[];
}

export function craftTake(env: ClickEnv, shift: boolean) {
  const c = env.craft;
  if (!c || !c.result) return;
  let guard = 0;
  while (c.result && guard++ < 64) {
    const r = c.result;
    if (shift) {
      const probe = env.inv.slots.map((s) => (s ? { ...s } : null));
      if (addToSlots(probe, r) > 0) break;
      env.inv.add(r);
    } else {
      const cur = env.cursor.stack;
      if (cur && (cur.id !== r.id || cur.n + r.n > stackMax(r.id) || cur.d !== undefined)) break;
      if (cur) cur.n += r.n; else env.cursor.stack = { ...r };
    }
    env.onCraft?.(r.id);
    for (let i = 0; i < c.grid.length; i++) { const s = c.grid[i]; if (s) { s.n--; if (s.n <= 0) c.grid[i] = null; } }
    updateCraft(c);
    if (!shift) break;
  }
  env.changed();
}

export function slotClick(env: ClickEnv, list: (Stack | null)[], idx: number, kind: SlotKind, button: number, shift: boolean) {
  const { cursor } = env;
  const slot = list[idx];
  const isGrid = env.craft && list === env.craft.grid;
  if (kind === 'result') { craftTake(env, shift); return; }
  if (shift && slot) {
    // quick move
    const s = { ...slot };
    let left = s.n;
    if (list === env.inv.slots) {
      if (env.others) {
        const t = env.others;
        const isFurnace = t.length === 3;
        if (isFurnace) {
          if (SMELT[s.id] !== undefined) left = addToSlots(t, { ...s, n: left }, 0, 1);
          else if (fuelValue(s.id) > 0) left = addToSlots(t, { ...s, n: left }, 1, 2);
        } else left = addToSlots(t, { ...s, n: left });
      }
      if (left === s.n) left = addToSlots(env.inv.slots, { ...s, n: left }, idx < 9 ? 9 : 0, idx < 9 ? 36 : 9);
    } else {
      left = addToSlots(env.inv.slots, { ...s, n: left }, 0, 36);
    }
    if (left !== s.n) { slot.n = left; if (left <= 0) list[idx] = null; if (isGrid) updateCraft(env.craft!); env.changed(); }
    return;
  }
  const cur = cursor.stack;
  if (env.creative && list === env.inv.slots && false) return;
  if (!cur) {
    if (!slot) return;
    if (kind === 'furnace_out' || button === 0) { cursor.stack = slot; list[idx] = null; }
    else { const take = Math.ceil(slot.n / 2); cursor.stack = { ...slot, n: take }; slot.n -= take; if (slot.n <= 0) list[idx] = null; }
  } else {
    if (!slotAccepts(kind, cur)) { if (kind === 'furnace_out' && slot && slot.id === cur.id && cur.n + slot.n <= stackMax(cur.id)) { cur.n += slot.n; list[idx] = null; } env.changed(); return; }
    const max = stackMax(cur.id);
    if (!slot) {
      if (button === 0 || cur.d !== undefined) { list[idx] = cur; cursor.stack = null; }
      else { list[idx] = { ...cur, n: 1 }; cur.n--; if (cur.n <= 0) cursor.stack = null; }
    } else if (slot.id === cur.id && slot.d === undefined && cur.d === undefined && max > 1) {
      const m = button === 0 ? Math.min(max - slot.n, cur.n) : Math.min(max - slot.n, 1);
      slot.n += m; cur.n -= m; if (cur.n <= 0) cursor.stack = null;
    } else if (button === 0) { list[idx] = cur; cursor.stack = slot; }
  }
  if (isGrid) updateCraft(env.craft!);
  env.changed();
}

// Auto-fill: move ingredients for a recipe from inventory into the crafting grid.
export function autofill(c: CraftGrid, inv: Inventory, cells: (number | string | null)[], rw: number, rh: number, match: (ing: number | string, id: number) => boolean, shapeless: boolean) {
  // return grid contents to inventory first
  for (let i = 0; i < c.grid.length; i++) { const s = c.grid[i]; if (s) { inv.add(s); c.grid[i] = null; } }
  const place: [number, number | string][] = [];
  if (shapeless) cells.forEach((ing, i) => place.push([i, ing!]));
  else cells.forEach((ing, i) => { if (ing !== null) place.push([(Math.floor(i / rw)) * c.w + (i % rw), ing]); });
  void rh;
  for (const [gi, ing] of place) {
    const si = inv.slots.findIndex((s) => s && match(ing, s.id));
    if (si < 0) continue;
    const s = inv.slots[si]!;
    c.grid[gi] = { id: s.id, n: 1, d: s.d };
    s.n--; if (s.n <= 0) inv.slots[si] = null;
  }
  updateCraft(c);
}

export const FURNACE_BLOCKS = [B.FURNACE, B.FURNACE_LIT];
