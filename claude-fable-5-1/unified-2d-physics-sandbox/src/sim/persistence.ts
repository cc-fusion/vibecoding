import type { SceneData } from './schema';
import { parseSceneJson, type ValidationResult } from './validate';

const KEY = 'unified-physics-sandbox:scene:v1';

export function saveToLocal(scene: SceneData): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(scene)); return true; } catch { return false; }
}

export function loadFromLocal(): ValidationResult | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return parseSceneJson(text);
  } catch { return null; }
}

export function clearLocal() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function hasLocal(): boolean { try { return localStorage.getItem(KEY) !== null; } catch { return false; } }

export function exportSceneJson(scene: SceneData): string { return JSON.stringify(scene, null, 1); }

export function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile(): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json'; input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      file.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    document.body.appendChild(input); input.click();
    setTimeout(() => document.body.removeChild(input), 0);
  });
}
