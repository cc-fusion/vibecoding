import { SAVE_KEY } from "./data";
import type { Campaign, Meta, MechType, Settings } from "./types";

export const defaultSettings = (): Settings => ({
  master: 0.8,
  sfx: 0.9,
  music: 0.55,
  muted: false,
  shake: true,
  particles: true,
  difficulty: "journeyman",
});

export const defaultMeta = (): Meta => ({
  generation: 0,
  victories: 0,
  bestRenown: 0,
  academy: { pins: false, dial: false, rings: false, sweep: false, cipher: false, runes: false } as Record<MechType, boolean>,
  settings: defaultSettings(),
});

interface SaveShape {
  meta: Meta;
  campaign: Campaign | null;
}

let memory: SaveShape | null = null;

export function loadSave(): SaveShape {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveShape>;
      const dm = defaultMeta();
      const meta: Meta = {
        ...dm,
        ...(p.meta || {}),
        academy: { ...dm.academy, ...(p.meta?.academy || {}) },
        settings: { ...dm.settings, ...(p.meta?.settings || {}) },
      };
      const c = p.campaign && typeof p.campaign === "object" && Array.isArray(p.campaign.board) ? p.campaign : null;
      memory = { meta, campaign: c };
      return memory;
    }
  } catch {
    /* storage unavailable or corrupt — fall back to memory */
  }
  memory = memory ?? { meta: defaultMeta(), campaign: null };
  return memory;
}

export function writeSave(meta: Meta, campaign: Campaign | null) {
  memory = { meta, campaign };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(memory));
  } catch {
    /* ignore quota / privacy-mode errors; session memory still holds state */
  }
}

export function wipeCampaign(meta: Meta) {
  writeSave(meta, null);
}
