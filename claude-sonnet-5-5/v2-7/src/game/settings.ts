import { audio } from "./audio";
import { fx } from "./fx";
import { SAVE, mutateSave } from "./core";
import type { SaveData } from "./save";

export function applySettings() {
  const st = SAVE.settings;
  audio.setVolumes({ master: st.master, music: st.music, sfx: st.sfx, muted: st.muted });
  fx.shakeOn = st.shake;
  try { fx.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { fx.reduce = false; }
}
export function setSetting(p: Partial<SaveData["settings"]>) {
  mutateSave(s => { s.settings = { ...s.settings, ...p }; });
  applySettings();
}
