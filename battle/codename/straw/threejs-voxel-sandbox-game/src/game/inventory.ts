// Player inventory: 9 hotbar + 27 main slots, stacking rules, tool wear.
import { itemDef, mkStack, type Stack } from './items';

export function canStack(a: Stack, b: Stack): boolean {
  return a.id === b.id && a.dur === b.dur && itemDef(a.id).maxStack > 1;
}

/** Add stack into a slot array over the given index ranges. Mutates stack.count; returns leftover. */
export function addToSlots(slots: (Stack | null)[], stack: Stack, ranges: [number, number][]): number {
  const max = itemDef(stack.id).maxStack;
  for (const [a, b] of ranges) {
    for (let i = a; i <= b && stack.count > 0; i++) {
      const s = slots[i];
      if (s && canStack(s, stack) && s.count < max) {
        const move = Math.min(max - s.count, stack.count);
        s.count += move; stack.count -= move;
      }
    }
  }
  for (const [a, b] of ranges) {
    for (let i = a; i <= b && stack.count > 0; i++) {
      if (!slots[i]) {
        const move = Math.min(max, stack.count);
        slots[i] = { ...stack, count: move };
        stack.count -= move;
      }
    }
  }
  return stack.count;
}

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  selected = 0;

  held(): Stack | null { return this.slots[this.selected]; }

  /** returns leftover count that didn't fit */
  add(stack: Stack): number {
    return addToSlots(this.slots, stack, [[0, 8], [9, 35]]);
  }

  canFit(stack: Stack): boolean {
    const probe = { ...stack };
    const copy = this.slots.map(s => (s ? { ...s } : null));
    return addToSlots(copy, probe, [[0, 8], [9, 35]]) === 0;
  }

  count(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  consumeHeld(n = 1) {
    const h = this.held();
    if (!h) return;
    h.count -= n;
    if (h.count <= 0) this.slots[this.selected] = null;
  }

  /** damage held tool; returns true if it broke */
  damageHeld(n = 1): boolean {
    const h = this.held();
    if (!h || h.dur === undefined) return false;
    h.dur -= n;
    if (h.dur <= 0) { this.slots[this.selected] = null; return true; }
    return false;
  }

  give(id: number, count = 1): number {
    return this.add(mkStack(id, count));
  }

  serialize(): (Stack | null)[] { return this.slots.map(s => (s ? { ...s } : null)); }
  deserialize(data: (Stack | null)[]) {
    this.slots = new Array(36).fill(null);
    data.forEach((s, i) => { if (i < 36 && s) this.slots[i] = { ...s }; });
  }
}
