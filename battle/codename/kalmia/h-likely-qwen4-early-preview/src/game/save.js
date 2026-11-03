// World persistence via localStorage (single slot) + achievement definitions.
const KEY = 'voxelheim_save_v1';
const SETTINGS_KEY = 'voxelheim_settings_v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to load save', e);
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to save', e);
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function writeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export const ACHIEVEMENTS = [
  { id: 'wood', name: 'Getting Wood', desc: 'Punch a tree and collect a log', icon: 'axe' },
  { id: 'planks', name: 'Carpentry 101', desc: 'Craft oak planks', icon: 'hammer' },
  { id: 'table', name: 'Workbench', desc: 'Craft a crafting table', icon: 'layout-grid' },
  { id: 'stone_pick', name: 'Stone Age', desc: 'Craft a stone pickaxe', icon: 'pickaxe' },
  { id: 'furnace', name: 'Hot Topic', desc: 'Build a furnace', icon: 'flame' },
  { id: 'iron', name: 'Iron Age', desc: 'Smelt an iron ingot', icon: 'anvil' },
  { id: 'diamond', name: 'DIAMONDS!', desc: 'Mine a diamond', icon: 'gem' },
  { id: 'torch', name: 'Let There Be Light', desc: 'Place a torch', icon: 'lightbulb' },
  { id: 'night', name: 'First Night', desc: 'Survive until morning', icon: 'moon' },
  { id: 'zombie', name: 'Monster Hunter', desc: 'Defeat a zombie', icon: 'swords' },
  { id: 'cooked', name: 'Gourmet', desc: 'Eat a cooked porkchop', icon: 'beef' },
  { id: 'builder', name: 'Master Builder', desc: 'Place 100 blocks', icon: 'building-2' },
  { id: 'deep', name: 'Rock Bottom', desc: 'Descend below Y=12', icon: 'arrow-down' },
];