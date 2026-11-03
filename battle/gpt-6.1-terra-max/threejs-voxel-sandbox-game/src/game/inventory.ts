import { ITEMS, RECIPES } from './blocks';
import type { ItemStack } from './types';

export function cloneInventory(inventory: (ItemStack | null)[]): (ItemStack | null)[] {
  return inventory.map(stack => stack ? { ...stack } : null);
}

export function addToInventory(inventory: (ItemStack | null)[], id: string, count: number): boolean {
  const copy = cloneInventory(inventory);
  const max = ITEMS[id]?.tool ? 1 : 64;
  let remaining = count;
  for (const stack of copy) {
    if (stack?.id === id && stack.count < max) {
      const amount = Math.min(max - stack.count, remaining);
      stack.count += amount; remaining -= amount;
      if (!remaining) break;
    }
  }
  for (let i = 0; i < copy.length && remaining > 0; i++) {
    if (!copy[i]) {
      const amount = Math.min(max, remaining);
      copy[i] = { id, count: amount }; remaining -= amount;
    }
  }
  if (remaining) return false;
  inventory.splice(0, inventory.length, ...copy);
  return true;
}

export function countItem(inventory: (ItemStack | null)[], id: string): number {
  return inventory.reduce((total, stack) => total + (stack?.id === id ? stack.count : 0), 0);
}

export function canCraft(inventory: (ItemStack | null)[], recipeId: string): boolean {
  const recipe = RECIPES.find(entry => entry.id === recipeId);
  return !!recipe && recipe.ingredients.every(ingredient => countItem(inventory, ingredient.id) >= ingredient.count);
}

export function craft(inventory: (ItemStack | null)[], recipeId: string): boolean {
  const recipe = RECIPES.find(entry => entry.id === recipeId);
  if (!recipe || !canCraft(inventory, recipeId)) return false;
  const copy = cloneInventory(inventory);
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.count;
    for (let i = 0; i < copy.length && remaining > 0; i++) {
      const stack = copy[i];
      if (stack?.id !== ingredient.id) continue;
      const amount = Math.min(remaining, stack.count);
      stack.count -= amount; remaining -= amount;
      if (!stack.count) copy[i] = null;
    }
  }
  if (!addToInventory(copy, recipe.output, recipe.count)) return false;
  inventory.splice(0, inventory.length, ...copy);
  return true;
}