import * as THREE from "three";
import {
  BLOCK,
  CHUNK_SIZE,
  WATER_LEVEL,
  VoxelWorld,
  blockData,
  blockName,
  biomeAt,
  itemForBlock,
} from "./world.js";

const SAVE_KEY = "mosslight-world-v1";
const DAY_LENGTH = 260;
const BOOT_RADIUS = 2;
const VIEW_RADIUS = 4;
const HOTBAR = ["dirt", "planks", "stone", "leaves", "lantern", "campfire", "wooden_pickaxe", "berries"];
const INVENTORY_ITEMS = ["wood", "planks", "sticks", "dirt", "stone", "coal", "leaves", "berries", "lantern", "campfire", "wildflower", "moss", "trailmix", "wooden_pickaxe"];

const ITEM_NAMES = {
  wood: "Timber",
  planks: "Planks",
  sticks: "Sticks",
  dirt: "Soil",
  stone: "Stone",
  coal: "Coal",
  leaves: "Leaves",
  berries: "Berries",
  lantern: "Lantern",
  campfire: "Campfire",
  wildflower: "Wildflower",
  moss: "Moss",
  trailmix: "Trail mix",
  wooden_pickaxe: "Wooden pickaxe",
};

const PLACEABLE = {
  dirt: BLOCK.DIRT,
  planks: BLOCK.PLANKS,
  stone: BLOCK.COBBLE,
  leaves: BLOCK.LEAVES,
  lantern: BLOCK.LANTERN,
  campfire: BLOCK.CAMPFIRE,
  wildflower: BLOCK.FLOWER,
  moss: BLOCK.MOSS,
};

const RECIPES = [
  { id: "planks", name: "Wooden planks", detail: "1 timber makes 4 planks", inputs: { wood: 1 }, outputs: { planks: 4 } },
  { id: "sticks", name: "Carved sticks", detail: "2 planks make 4 sticks", inputs: { planks: 2 }, outputs: { sticks: 4 } },
  { id: "wooden_pickaxe", name: "Wooden pickaxe", detail: "A little quicker underground", inputs: { planks: 3, sticks: 2 }, outputs: { wooden_pickaxe: 1 }, unique: true },
  { id: "lantern", name: "Pocket lanterns", detail: "2 warm lights for the trail", inputs: { sticks: 1, coal: 1 }, outputs: { lantern: 2 } },
  { id: "campfire", name: "Trail campfire", detail: "A warm place to gather", inputs: { planks: 3, stone: 2 }, outputs: { campfire: 1 } },
  { id: "trailmix", name: "Trail mix", detail: "A berry-rich little meal", inputs: { berries: 3 }, outputs: { trailmix: 1 } },
];

const ITEM_TINTS = {
  dirt: ["#ab7e54", "#896341", "#c09061"],
  planks: ["#dfb97d", "#ba8e59", "#f0cd91"],
  stone: ["#b9c0b6", "#838e88", "#d5d8ca"],
  leaves: ["#86a06b", "#5c794e", "#adc184"],
  lantern: ["#f2ca7b", "#9e683f", "#ffe6a1"],
  campfire: ["#f29d58", "#765139", "#ffd17c"],
  wooden_pickaxe: ["#d2ad75", "#704f37", "#f1d18c"],
  berries: ["#d77a70", "#833e49", "#f3ae88"],
  wood: ["#bd8d5e", "#80583c", "#e1b67c"],
  sticks: ["#d8b581", "#826141", "#f0d4a0"],
  coal: ["#7c8984", "#242d2c", "#c5ccc0"],
  wildflower: ["#e1c881", "#557747", "#f5e7af"],
  moss: ["#78966c", "#516e50", "#a4ba82"],
  trailmix: ["#d88f64", "#805447", "#f2c37b"],
};

const CRAFT_ICONS = {
  planks: "planks",
  sticks: "sticks",
  wooden_pickaxe: "wooden_pickaxe",
  lantern: "lantern",
  campfire: "campfire",
  trailmix: "trailmix",
};

function iconSvg(name, extraClass = "") {
  const colors = ITEM_TINTS[name] || ITEM_TINTS.dirt;
  if (name === "berries" || name === "trailmix") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 12c-7 0-12 4-12 10 0 5 5 9 12 9s12-4 12-9c0-6-5-10-12-10Z" fill="${colors[0]}"/><circle cx="13" cy="21" r="3" fill="${colors[2]}"/><circle cx="21" cy="18" r="3" fill="${colors[1]}"/><circle cx="23" cy="25" r="3" fill="${colors[2]}"/><path d="M17 13c-1-4 1-7 5-8-1 4-2 7-5 8Z" fill="#779367"/><path d="M17 13c-4-3-7-3-10-1 3 3 6 4 10 1Z" fill="#90a775"/></svg>`;
  }
  if (name === "wooden_pickaxe") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M14 31 18 9l4 1-4 22Z" fill="${colors[1]}"/><path d="M8 9c5-5 13-5 21 1l-3 4c-6-4-11-4-16 1l-4-3Z" fill="${colors[0]}"/><path d="M10 12c5-4 11-4 16 0" fill="none" stroke="${colors[2]}" stroke-width="1.5"/></svg>`;
  }
  if (name === "lantern") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M14 7h8v3h-8z" fill="${colors[1]}"/><path d="M12 10h12v17H12z" fill="${colors[1]}"/><path d="M15 13h6v11h-6z" fill="${colors[0]}"/><path d="M17 14h2v9h-2z" fill="${colors[2]}"/><path d="M10 27h16v3H10z" fill="${colors[1]}"/><path d="M14 7c0-3 2-4 4-4s4 1 4 4" fill="none" stroke="${colors[1]}" stroke-width="2"/></svg>`;
  }
  if (name === "campfire") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="m8 26 20-11 2 3L10 29zM7 18l20 9-2 3L6 21z" fill="${colors[1]}"/><path d="M18 8c4 5 2 7 5 10 1 2-1 7-5 7s-7-3-6-7c1-3 4-5 6-10Z" fill="${colors[0]}"/><path d="M18 15c2 3 1 4 3 6 0 2-1 3-3 3s-3-2-2-4c0-1 1-2 2-5Z" fill="${colors[2]}"/></svg>`;
  }
  if (name === "wood" || name === "sticks") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M11 7h14v22H11z" fill="${colors[0]}"/><path d="M14 7h8v22h-8z" fill="${colors[1]}" opacity=".58"/><path d="M11 10h14M11 26h14" stroke="${colors[2]}" stroke-width="1.5"/><path d="M15 9v2m6 14v2" stroke="${colors[2]}" stroke-width="1.2"/></svg>`;
  }
  if (name === "wildflower") {
    return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 16v15m0-7-6-4m6 7 6-4" stroke="#6d8a5a" stroke-width="2"/><circle cx="18" cy="12" r="4" fill="${colors[0]}"/><circle cx="12" cy="10" r="3" fill="${colors[2]}"/><circle cx="24" cy="10" r="3" fill="${colors[0]}"/><circle cx="18" cy="5" r="3" fill="${colors[2]}"/><circle cx="18" cy="11" r="1.5" fill="#a67244"/></svg>`;
  }
  const isLeaf = name === "leaves" || name === "moss";
  return `<svg class="item-svg ${extraClass}" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 3 32 10.5 18 18 4 10.5Z" fill="${colors[2]}"/><path d="M4 10.5 18 18v15L4 25.5Z" fill="${colors[1]}"/><path d="M32 10.5 18 18v15l14-7.5Z" fill="${colors[0]}"/><path d="M8 11 18 16.3 28 11" fill="none" stroke="${isLeaf ? "#c3d09a" : "#ffffff"}" stroke-opacity=".32" stroke-width="1"/></svg>`;
}

function smallIcon(name, size = 16) {
  const icons = {
    leaf: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 3C9 3 5 6 5 11c0 3 2 5 5 5 5 0 6-6 6-13Z" stroke="currentColor" stroke-width="1.5"/><path d="M4 17c3-5 6-7 10-10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    sun: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 1.8v2m0 12.4v2M1.8 10h2m12.4 0h2M4.2 4.2l1.4 1.4m8.8 8.8 1.4 1.4m0-11.6-1.4 1.4m-8.8 8.8-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    cloud: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.2 14.8a3.2 3.2 0 0 1-.3-6.4A5 5 0 0 1 14.4 7a3.9 3.9 0 0 1 .2 7.8H5.2Z" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    rain: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 11a3 3 0 0 1-.1-6A4.7 4.7 0 0 1 13.8 5a3.1 3.1 0 0 1 .5 6H5Z" stroke="currentColor" stroke-width="1.25"/><path d="m7 13-1 2m5-2-1 2m5-2-1 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    sound: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8v4h3l4 3V5L6 8H3Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M13 7a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>`,
    mute: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8v4h3l4 3V5L6 8H3Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m14 8 4 4m0-4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    pause: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.5 4.5h2.8v11H6.5zm4.2 0h2.8v11h-2.8z" fill="currentColor"/></svg>`,
    heart: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 16.4 3.7 10.3A3.8 3.8 0 0 1 9 4.9l1 1 1-1a3.8 3.8 0 0 1 5.3 5.4L10 16.4Z" fill="currentColor"/></svg>`,
    bowl: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 9h14c-.5 4-2.7 6-7 6S3.5 13 3 9Z" stroke="currentColor" stroke-width="1.35"/><path d="M5 6h10M7 4h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    close: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10m0-10L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    jump: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 16V4m0 0L5 9m5-5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    build: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 5.5 10 2l6 3.5v7L10 16l-6-3.5v-7Z" stroke="currentColor" stroke-width="1.3"/><path d="m4.3 5.7 5.7 3.2 5.7-3.2M10 9v6.5" stroke="currentColor" stroke-width="1.3"/></svg>`,
    gather: `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 14 14.5 3.5l2 2L6 16H4v-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m11.8 6.2 2 2" stroke="currentColor" stroke-width="1.3"/></svg>`,
  };
  return icons[name] || "";
}

const markup = `
  <div class="game-scene">
    <div class="render-host" id="render-host"></div>
    <div class="scene-grain" aria-hidden="true"></div>
    <div class="scene-vignette" aria-hidden="true"></div>
    <header class="topbar" id="topbar">
      <div class="brand-lockup">
        <div class="brand-mark">${smallIcon("leaf", 21)}</div>
        <div><div class="brand-name">Mosslight</div><div class="brand-caption">A little world of your own</div></div>
      </div>
      <div class="world-meta">
        <span class="meta-dot"></span><span id="biome-label">Mosswood</span><span class="meta-divider"></span>
        <span class="meta-weather" id="weather-icon">${smallIcon("sun", 16)}</span><span id="weather-label">Clear</span>
        <span class="meta-divider meta-time-divider"></span><span id="time-label">11:12</span>
      </div>
      <div class="top-actions">
        <span class="save-status" id="save-status"></span>
        <button class="icon-button sound-button" id="sound-toggle" type="button" aria-label="Turn sound off" title="Toggle sound">${smallIcon("sound", 18)}</button>
        <button class="icon-button pause-button" id="pause-toggle" type="button" aria-label="Pause world" title="Pause">${smallIcon("pause", 17)}</button>
      </div>
    </header>

    <div class="world-coordinates" id="coordinates">X 0 / Z 0</div>
    <div class="reticle" id="reticle" aria-hidden="true">
      <svg class="reticle-progress" viewBox="0 0 48 48"><circle class="reticle-track" cx="24" cy="24" r="20"/><circle class="reticle-fill" id="reticle-fill" cx="24" cy="24" r="20"/></svg>
      <span class="reticle-center"></span>
    </div>
    <div class="focus-label" id="focus-label" hidden></div>
    <div class="toast-stack" id="toast-stack" aria-live="polite"></div>

    <section class="intro-screen" id="intro-screen">
      <div class="intro-shade" aria-hidden="true"></div>
      <div class="intro-content">
        <div class="intro-overline"><span class="intro-overline-rule"></span><span id="intro-kicker">A POCKET-SIZED WILDERNESS</span></div>
        <h1>Mosslight<span class="intro-period">.</span></h1>
        <p class="intro-tagline" id="intro-tagline">Make a home in the quiet parts of the world.</p>
        <button class="enter-button" id="enter-world" type="button"><span id="enter-label">Step into the wild</span><span class="button-arrow">${smallIcon("leaf", 18)}</span></button>
        <button class="new-world-link" id="new-world" type="button">Begin somewhere new <span aria-hidden="true">&gt;</span></button>
        <div class="intro-controls"><span>W A S D <i>walk</i></span><span class="intro-separator"></span><span>Mouse <i>look</i></span><span class="intro-separator"></span><span>Click <i>gather</i></span></div>
      </div>
      <div class="intro-footnote" id="intro-footnote"></div>
    </section>

    <section class="play-hud" id="play-hud" hidden>
      <div class="vitals-panel">
        <div class="vital-line"><span class="vital-icon health-icon">${smallIcon("heart", 16)}</span><div class="vital-track"><span class="vital-fill health-fill" id="health-fill"></span></div><span class="vital-value" id="health-value">100</span></div>
        <div class="vital-line"><span class="vital-icon food-icon">${smallIcon("bowl", 16)}</span><div class="vital-track"><span class="vital-fill food-fill" id="food-fill"></span></div><span class="vital-value" id="food-value">100</span></div>
        <div class="stamina-track"><span id="stamina-fill"></span></div>
      </div>
      <div class="hotbar-wrap">
        <div class="hotbar" id="hotbar"></div>
        <div class="selected-item" id="selected-item"><span id="selected-name">Soil</span><span class="selected-count" id="selected-count">14</span></div>
        <div class="control-hints"><span><kbd>W A S D</kbd> move</span><span><kbd>SHIFT</kbd> run</span><span><kbd>SPACE</kbd> jump</span><span><kbd>E</kbd> pack</span></div>
      </div>
      <div class="right-hint"><span>LEFT</span> gather <span class="hint-dot">/</span> <span>RIGHT</span> build</div>
    </section>

    <div class="touch-controls" id="touch-controls" hidden>
      <div class="move-stick" id="move-stick" aria-label="Move joystick"><span class="stick-knob" id="stick-knob"></span></div>
      <div class="touch-actions">
        <button class="touch-action touch-pack" id="touch-pack" type="button" aria-label="Open pack">E</button>
        <button class="touch-action" id="touch-mine" type="button" aria-label="Gather block">${smallIcon("gather", 21)}</button>
        <button class="touch-action" id="touch-place" type="button" aria-label="Place block">${smallIcon("build", 21)}</button>
        <button class="touch-action touch-jump" id="touch-jump" type="button" aria-label="Jump">${smallIcon("jump", 21)}</button>
      </div>
    </div>

    <section class="pause-screen modal-screen" id="pause-screen" hidden>
      <div class="pause-panel">
        <div class="modal-kicker">TAKE YOUR TIME</div>
        <h2>Paused<span class="intro-period">.</span></h2>
        <p class="pause-copy">The woods will be right here.</p>
        <button class="modal-primary" id="resume-world" type="button">Back to the trail <span>${smallIcon("leaf", 16)}</span></button>
        <div class="pause-utilities"><button id="save-world" type="button">Save this world</button><span></span><button id="pause-new-world" type="button">Start a new world</button></div>
        <div class="pause-controls"><span>W A S D <i>move</i></span><span>SHIFT <i>run</i></span><span>SPACE <i>jump</i></span><span>E <i>pack & craft</i></span><span>ESC <i>pause</i></span></div>
      </div>
    </section>

    <section class="modal-screen inventory-screen" id="inventory-screen" hidden>
      <div class="inventory-panel">
        <header class="inventory-header"><div><div class="modal-kicker">WHAT YOU CARRY</div><h2>Pack & craft<span class="intro-period">.</span></h2></div><button class="close-button" id="inventory-close" type="button" aria-label="Close inventory">${smallIcon("close", 18)}</button></header>
        <div class="inventory-body">
          <section class="pack-column"><div class="section-label">YOUR PACK <span id="pack-total">0 things</span></div><div class="inventory-grid" id="inventory-grid"></div><p class="inventory-tip">Choose a stack to equip it in your hand.</p></section>
          <section class="craft-column"><div class="section-label">FIELD CRAFT <span>Made anywhere</span></div><div class="recipe-list" id="recipe-list"></div></section>
        </div>
        <footer class="inventory-footer"><span>ESC <i>close pack</i></span><span>Crafting uses the things you carry.</span></footer>
      </div>
    </section>

    <section class="modal-screen confirm-screen" id="confirm-screen" hidden>
      <div class="confirm-panel"><div class="modal-kicker">A NEW PATCH OF EARTH</div><h2>Start fresh?</h2><p>Your current world is saved in this browser. Starting somewhere new replaces it.</p><div class="confirm-actions"><button class="text-action" id="confirm-cancel" type="button">Stay here</button><button class="modal-primary danger-button" id="confirm-new" type="button">Grow a new world</button></div></div>
    </section>

    <div class="corner-note" id="corner-note">Mosslight / A world that remembers</div>
  </div>`;

class SynthAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.48 : 0, this.context.currentTime, 0.04);
    return this.enabled;
  }

  play(kind) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || this.context.state !== "running") return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const presets = {
      break: { start: 185, end: 82, duration: 0.12, wave: "triangle", volume: 0.24, filter: 1200 },
      place: { start: 270, end: 390, duration: 0.11, wave: "sine", volume: 0.14, filter: 1500 },
      gather: { start: 510, end: 740, duration: 0.16, wave: "sine", volume: 0.12, filter: 2200 },
      craft: { start: 390, end: 720, duration: 0.24, wave: "sine", volume: 0.14, filter: 2400 },
      step: { start: 88, end: 72, duration: 0.075, wave: "triangle", volume: 0.045, filter: 360 },
      hurt: { start: 110, end: 55, duration: 0.3, wave: "triangle", volume: 0.2, filter: 420 },
    };
    const preset = presets[kind] || presets.place;
    oscillator.type = preset.wave;
    oscillator.frequency.setValueAtTime(preset.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, preset.end), now + preset.duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(preset.filter, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.015);
  }
}

function randomSeed() {
  const bytes = new Uint32Array(1);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else bytes[0] = Math.floor(Math.random() * 0xffffffff);
  return bytes[0] || 71931;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

function formatTime(cycle) {
  const totalMinutes = Math.floor((((cycle * 24 + 6) % 24) + 24) % 24 * 60);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatSavedAt(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `Last here ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function newInventory() {
  return {
    wood: 0,
    planks: 8,
    sticks: 0,
    dirt: 18,
    stone: 10,
    coal: 0,
    leaves: 0,
    berries: 5,
    lantern: 2,
    campfire: 0,
    wildflower: 0,
    moss: 0,
    trailmix: 0,
    wooden_pickaxe: 1,
  };
}

function readSave() {
  try {
    const value = localStorage.getItem(SAVE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || parsed.version !== 1 || !Number.isFinite(Number(parsed.seed))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uCycle: { value: 0.2 }, uRain: { value: 0 } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uCycle;
      uniform float uRain;
      varying vec3 vDirection;
      void main() {
        float phase = uCycle * 6.2831853;
        float sunHeight = sin(phase);
        float day = smoothstep(-0.20, 0.30, sunHeight);
        float dusk = pow(max(0.0, 1.0 - abs(sunHeight)), 5.0) * 0.72;
        float horizonMix = smoothstep(-0.16, 0.62, vDirection.y);
        vec3 nightHorizon = vec3(0.20, 0.29, 0.37);
        vec3 dayHorizon = vec3(0.64, 0.77, 0.82);
        vec3 duskHorizon = vec3(0.88, 0.50, 0.34);
        vec3 nightTop = vec3(0.045, 0.085, 0.14);
        vec3 dayTop = vec3(0.27, 0.47, 0.62);
        vec3 duskTop = vec3(0.38, 0.31, 0.41);
        vec3 horizon = mix(nightHorizon, dayHorizon, day);
        vec3 zenith = mix(nightTop, dayTop, day);
        horizon = mix(horizon, duskHorizon, dusk * (1.0 - day * 0.24));
        zenith = mix(zenith, duskTop, dusk * 0.44);
        vec3 color = mix(horizon, zenith, horizonMix);
        color *= 1.0 - uRain * 0.22;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

function blockKey(block) {
  return `${block.x},${block.y},${block.z}`;
}

export function mountVoxelGame(container) {
  const game = new MosslightGame(container);
  game.start();
  return () => game.destroy();
}

class MosslightGame {
  constructor(container) {
    this.container = container;
    this.container.innerHTML = markup;
    this.elements = {};
    this.findElements();
    this.cleanup = [];
    this.keys = new Set();
    this.inventoryOpen = false;
    this.started = false;
    this.paused = false;
    this.pointerLocked = false;
    this.fallbackLook = false;
    this.skipPauseUntil = 0;
    this.mineHeld = false;
    this.mining = { key: "", elapsed: 0 };
    this.target = null;
    this.currentBiome = "Mosswood";
    this.toastTimeout = 0;
    this.hudTimer = 0;
    this.autosaveTimer = 0;
    this.stateDirtyTimer = 0;
    this.lastSavedCell = "";
    this.stepTimer = 0;
    this.dirty = false;
    this.audio = new SynthAudio();
    this.save = readSave();
    this.seed = this.save?.seed ?? randomSeed();
    this.inventory = { ...newInventory(), ...(this.save?.inventory || {}) };
    this.inventory.wooden_pickaxe = Math.max(0, Number(this.inventory.wooden_pickaxe) || 0);
    this.selectedSlot = 0;
    this.toolDurability = Math.max(0, Math.min(64, Number(this.save?.toolDurability ?? 48)));
    this.stats = { blocksPlaced: 0, ...(this.save?.stats || {}) };
    this.achievements = { firstTimber: false, firstLantern: false, ...(this.save?.achievements || {}) };
    this.dayCycle = Number.isFinite(this.save?.dayCycle) ? this.save.dayCycle % 1 : 0.19;
    this.weather = { mode: "clear", remaining: 0, timer: 20 };
    this.player = {
      position: new THREE.Vector3(0.5, 14, 0.5),
      velocity: new THREE.Vector3(),
      yaw: Number.isFinite(this.save?.yaw) ? this.save.yaw : -0.22,
      pitch: Number.isFinite(this.save?.pitch) ? this.save.pitch : -0.02,
      onGround: false,
      health: Math.max(1, Math.min(100, Number(this.save?.health ?? 100))),
      hunger: Math.max(0, Math.min(100, Number(this.save?.hunger ?? 100))),
      stamina: 100,
      fallStart: 0,
      spawn: new THREE.Vector3(0.5, 14, 0.5),
    };
    this.previewTime = 0;
    this.lookPointer = null;
    this.touchMove = { x: 0, z: 0 };
    this.touchLook = null;
    this.gamepad = null;
    this.creatures = [];
    this.particles = [];
    this.clouds = [];
    this.renderer = null;
    this.scene = null;
    this.world = null;
    this.frameId = 0;
    this.lastFrame = 0;
  }

  findElements() {
    const ids = [
      "render-host", "biome-label", "weather-icon", "weather-label", "time-label", "save-status", "sound-toggle", "pause-toggle", "coordinates", "reticle", "reticle-fill", "focus-label", "toast-stack", "intro-screen", "intro-tagline", "intro-kicker", "enter-world", "enter-label", "new-world", "intro-footnote", "play-hud", "health-fill", "health-value", "food-fill", "food-value", "stamina-fill", "hotbar", "selected-name", "selected-count", "touch-controls", "move-stick", "stick-knob", "touch-pack", "touch-mine", "touch-place", "touch-jump", "pause-screen", "resume-world", "save-world", "pause-new-world", "inventory-screen", "inventory-close", "inventory-grid", "recipe-list", "pack-total", "confirm-screen", "confirm-cancel", "confirm-new", "corner-note",
    ];
    for (const id of ids) this.elements[id] = this.container.querySelector(`#${id}`);
  }

  start() {
    try {
      this.setupRenderer();
      this.setupScene();
      this.createWorld(this.seed, this.save?.edits || [], this.save);
      this.createClouds();
      this.createRain();
      this.createHud();
      this.bindEvents();
      this.setIntroState();
      this.lastFrame = performance.now();
      this.frameId = requestAnimationFrame((time) => this.frame(time));
    } catch (error) {
      console.error("Mosslight could not start:", error);
      this.showFatalError(error);
    }
  }

  setupRenderer() {
    const host = this.elements["render-host"];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "world-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Mosslight voxel world. Click to explore.");
    host.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(new THREE.Color(0xa5c6d3), 0.018);
    this.camera = new THREE.PerspectiveCamera(69, window.innerWidth / window.innerHeight, 0.1, 650);
    this.camera.rotation.order = "YXZ";
    this.clock = new THREE.Clock();
  }

  setupScene() {
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), createSkyMaterial());
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.hemisphere = new THREE.HemisphereLight(0xdcebf0, 0x555340, 1.15);
    this.scene.add(this.hemisphere);
    this.sunLight = new THREE.DirectionalLight(0xffe3b4, 1.75);
    this.sunLight.position.set(-35, 55, -25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -32;
    this.sunLight.shadow.camera.right = 32;
    this.sunLight.shadow.camera.top = 32;
    this.sunLight.shadow.camera.bottom = -32;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 125;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.035;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffedbd, fog: false }));
    this.sunDisc.frustumCulled = false;
    this.scene.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xdde5e4, fog: false }));
    this.moonDisc.frustumCulled = false;
    this.scene.add(this.moonDisc);

    const starRandom = this.randomGenerator(this.seed + 88);
    const starPositions = [];
    for (let i = 0; i < 520; i += 1) {
      const theta = starRandom() * Math.PI * 2;
      const y = 0.07 + starRandom() * 0.92;
      const radius = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(theta) * radius * 330, y * 330, Math.sin(theta) * radius * 330);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    this.starsMaterial = new THREE.PointsMaterial({ color: 0xe5eee7, size: 1.35, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false });
    this.stars = new THREE.Points(starGeometry, this.starsMaterial);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012));
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xf2ecd8, transparent: true, opacity: 0.9, depthTest: true });
    this.blockOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    this.blockOutline.visible = false;
    this.blockOutline.renderOrder = 8;
    this.scene.add(this.blockOutline);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 5.3;
    this.particleGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.075);
    this.environmentClock = 0;
  }

  createWorld(seed, edits, saveData = null) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    for (const creature of this.creatures) {
      this.scene.remove(creature.group);
      this.disposeObjectTree(creature.group);
    }
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      particle.mesh.material.dispose();
    }
    this.particles.length = 0;
    this.creatures.length = 0;
    this.seed = Number(seed) >>> 0;
    this.world = new VoxelWorld(this.seed, edits);

    const savedPosition = saveData?.position;
    const startX = Number.isFinite(savedPosition?.x) ? savedPosition.x : 0.5;
    const startZ = Number.isFinite(savedPosition?.z) ? savedPosition.z : 0.5;
    this.world.ensureAround(startX, startZ, BOOT_RADIUS);
    const spawn = this.findSpawn(startX, startZ);
    const savedY = Number.isFinite(savedPosition?.y) && savedPosition.y > 1 ? savedPosition.y : spawn.y;
    this.player.position.set(startX, savedY, startZ);
    if (this.collidesAt(this.player.position)) this.player.position.copy(spawn);
    this.player.spawn.copy(spawn);
    this.player.velocity.set(0, 0, 0);
    this.player.onGround = false;
    this.scene.add(this.world.group);

    this.createCreatures();
    this.updateCamera(0, true);
    this.updateEnvironment(0);
  }

  findSpawn(x, z) {
    const startX = Math.floor(x);
    const startZ = Math.floor(z);
    for (let radius = 0; radius <= 32; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const worldX = startX + dx;
          const worldZ = startZ + dz;
          const y = this.world.surfaceAt(worldX, worldZ);
          const top = this.world.blockAt(worldX, y, worldZ);
          if (top === BLOCK.SAND || top === BLOCK.CLAY || top === BLOCK.WATER) continue;
          if (y <= WATER_LEVEL + 1) continue;
          if (this.world.blockAt(worldX, y + 1, worldZ) !== BLOCK.AIR) continue;
          if (this.world.blockAt(worldX, y + 2, worldZ) !== BLOCK.AIR) continue;
          return new THREE.Vector3(worldX + 0.5, y + 1.015, worldZ + 0.5);
        }
      }
    }
    return new THREE.Vector3(startX + 0.5, this.world.surfaceAt(startX, startZ) + 2, startZ + 0.5);
  }

  randomGenerator(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  createCreatures() {
    const palette = [
      { body: 0x9f8767, light: 0xc4ad83, cheek: 0xd0b28a },
      { body: 0x776956, light: 0xb89b70, cheek: 0xd5bc94 },
    ];
    const materials = palette.map((colors) => ({
      body: new THREE.MeshStandardMaterial({ color: colors.body, roughness: 1, flatShading: true }),
      light: new THREE.MeshStandardMaterial({ color: colors.light, roughness: 1, flatShading: true }),
      cheek: new THREE.MeshStandardMaterial({ color: colors.cheek, roughness: 1, flatShading: true }),
      dark: new THREE.MeshStandardMaterial({ color: 0x27322a, roughness: 0.55, flatShading: true }),
    }));
    const random = this.randomGenerator(this.seed + 501);
    const placed = [];
    for (let index = 0; index < 2; index += 1) {
      let position = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = random() * Math.PI * 2;
        const distance = 5 + random() * 8;
        const x = Math.floor(this.player.spawn.x + Math.cos(angle) * distance);
        const z = Math.floor(this.player.spawn.z + Math.sin(angle) * distance);
        const floorY = this.world.surfaceAt(x, z);
        const top = this.world.blockAt(x, floorY, z);
        if ((top === BLOCK.GRASS || top === BLOCK.MOSS) && this.world.blockAt(x, floorY + 1, z) === BLOCK.AIR) {
          position = new THREE.Vector3(x + 0.5, floorY + 1, z + 0.5);
          break;
        }
      }
      if (!position) continue;
      const actor = this.buildCreature(index, materials[index], position);
      placed.push(actor);
      this.creatures.push(actor);
      this.scene.add(actor.group);
    }
    this.creatures.length = placed.length;
  }

  buildCreature(index, palette, position) {
    const root = new THREE.Group();
    root.position.copy(position);
    root.name = `Mossling ${index + 1}`;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const parts = [];
    const addPart = (name, material, size, offset) => {
      const mesh = new THREE.Mesh(box, material);
      mesh.name = name;
      mesh.scale.set(...size);
      mesh.position.set(...offset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      parts.push(mesh);
      return mesh;
    };
    addPart("soft body", palette.body, [0.76, 0.42, 0.92], [0, 0.48, 0.04]);
    addPart("bright face", palette.light, [0.42, 0.42, 0.4], [0, 0.71, -0.39]);
    addPart("muzzle", palette.cheek, [0.25, 0.18, 0.19], [0, 0.59, -0.62]);
    addPart("left ear", palette.light, [0.13, 0.36, 0.15], [-0.16, 1.04, -0.38]);
    addPart("right ear", palette.light, [0.13, 0.36, 0.15], [0.16, 1.04, -0.38]);
    addPart("tail", palette.body, [0.2, 0.2, 0.39], [0, 0.57, 0.55]);
    const leftEye = addPart("left eye", palette.dark, [0.055, 0.08, 0.045], [-0.12, 0.75, -0.596]);
    const rightEye = addPart("right eye", palette.dark, [0.055, 0.08, 0.045], [0.12, 0.75, -0.596]);
    leftEye.castShadow = false;
    rightEye.castShadow = false;
    const legs = [];
    for (const [x, z] of [[-0.23, -0.24], [0.23, -0.24], [-0.23, 0.32], [0.23, 0.32]]) {
      const leg = addPart("little paw", palette.body, [0.16, 0.33, 0.17], [x, 0.2, z]);
      legs.push(leg);
    }
    const actor = {
      group: root,
      home: position.clone(),
      destination: position.clone(),
      moodTimer: 2 + index,
      giftAt: 0,
      walk: 0,
      phase: Math.random() * 5,
      legs,
      index,
    };
    for (const part of parts) part.userData.actor = actor;
    root.userData.actor = actor;
    return actor;
  }

  disposeObjectTree(root) {
    const geometries = new Set();
    const materials = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  createClouds() {
    const random = this.randomGenerator(this.seed + 881);
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xe5ece7, roughness: 1, depthWrite: true });
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 12; i += 1) {
      const group = new THREE.Group();
      const width = 4.5 + random() * 5;
      const puffs = [
        [width * 0.62, 0.88, 2.9, 0, 0, 0],
        [width * 0.41, 1.06, 3.4, -width * 0.25, 0.22, 0.1],
        [width * 0.42, 0.97, 3.1, width * 0.24, 0.18, -0.1],
        [width * 0.34, 0.76, 2.55, -width * 0.02, 0.66, -0.15],
        [width * 0.34, 0.72, 2.2, width * 0.37, -0.05, 0.55],
      ];
      for (const [scaleX, scaleY, scaleZ, x, y, z] of puffs) {
        const mesh = new THREE.Mesh(cloudGeo, this.cloudMaterial);
        mesh.scale.set(scaleX, scaleY, scaleZ);
        mesh.position.set(x, y, z);
        group.add(mesh);
      }
      const cloud = { group, offsetX: (random() - 0.5) * 76, offsetZ: (random() - 0.5) * 76, y: 22 + random() * 12, drift: random() * 20 - 10 };
      this.clouds.push(cloud);
      this.scene.add(group);
    }
  }

  createRain() {
    const count = 240;
    const positions = new Float32Array(count * 3);
    const random = this.randomGenerator(this.seed + 331);
    this.rainDrops = [];
    for (let i = 0; i < count; i += 1) {
      const drop = { x: (random() - 0.5) * 24, y: random() * 17, z: (random() - 0.5) * 24, speed: 10 + random() * 8 };
      this.rainDrops.push(drop);
      positions[i * 3] = drop.x;
      positions[i * 3 + 1] = drop.y;
      positions[i * 3 + 2] = drop.z;
    }
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.rainMaterial = new THREE.PointsMaterial({ color: 0xd1e6eb, size: 0.075, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  createHud() {
    this.elements.hotbar.innerHTML = HOTBAR.map((item, index) => `<button class="hotbar-slot" data-slot="${index}" type="button" aria-label="${index + 1}: ${ITEM_NAMES[item]}"><span class="slot-key">${index + 1}</span><span class="slot-icon">${iconSvg(item)}</span><span class="slot-label">${item === "wooden_pickaxe" ? "PICK" : item === "campfire" ? "FIRE" : ITEM_NAMES[item].toUpperCase().slice(0, 6)}</span><span class="slot-count" id="slot-count-${index}">0</span><span class="slot-durability" id="slot-durability-${index}"></span></button>`).join("");
    this.elements.hotbar.querySelectorAll("[data-slot]").forEach((slot) => {
      const select = () => this.selectSlot(Number(slot.dataset.slot));
      slot.addEventListener("click", select);
      this.cleanup.push(() => slot.removeEventListener("click", select));
    });
    this.renderInventory();
    this.updateHotbar();
  }

  bindEvents() {
    const on = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      this.cleanup.push(() => target.removeEventListener(event, handler, options));
    };
    const canvas = this.canvas;

    on(this.elements["enter-world"], "click", () => this.enterWorld());
    on(this.elements["new-world"], "click", () => this.requestNewWorld());
    on(this.elements["resume-world"], "click", () => this.resumeWorld());
    on(this.elements["save-world"], "click", () => this.saveWorld(true));
    on(this.elements["pause-new-world"], "click", () => this.requestNewWorld());
    on(this.elements["sound-toggle"], "click", () => this.toggleSound());
    on(this.elements["pause-toggle"], "click", () => this.pauseWorld());
    on(this.elements["inventory-close"], "click", () => this.closeInventory(true));
    on(this.elements["confirm-cancel"], "click", () => this.closeConfirm());
    on(this.elements["confirm-new"], "click", () => this.beginNewWorld());
    on(this.elements["touch-pack"], "click", () => this.toggleInventory());
    on(this.elements["touch-jump"], "pointerdown", (event) => {
      event.preventDefault();
      this.keys.add("Space");
      this.elements["touch-jump"].setPointerCapture?.(event.pointerId);
    });
    const releaseJump = () => this.keys.delete("Space");
    on(this.elements["touch-jump"], "pointerup", releaseJump);
    on(this.elements["touch-jump"], "pointercancel", releaseJump);
    on(this.elements["touch-mine"], "pointerdown", (event) => { event.preventDefault(); this.mineHeld = true; this.elements["touch-mine"].setPointerCapture?.(event.pointerId); });
    on(this.elements["touch-mine"], "pointerup", () => { this.mineHeld = false; });
    on(this.elements["touch-mine"], "pointercancel", () => { this.mineHeld = false; });
    on(this.elements["touch-place"], "pointerdown", (event) => { event.preventDefault(); this.placeSelected(); });

    on(window, "resize", () => this.resize());
    on(window, "blur", () => {
      this.keys.clear();
      this.mineHeld = false;
    });
    on(document, "keydown", (event) => this.keyDown(event));
    on(document, "keyup", (event) => this.keys.delete(event.code));
    on(document, "pointerlockchange", () => this.onPointerLockChange());
    on(document, "visibilitychange", () => {
      if (document.hidden && this.started) this.saveWorld(false);
    });
    on(document, "mousedown", (event) => this.mouseDown(event));
    on(document, "mouseup", () => { this.mineHeld = false; });
    on(document, "mousemove", (event) => this.mouseMove(event));
    on(document, "wheel", (event) => {
      if (!this.started || this.inventoryOpen || this.paused) return;
      const direction = Math.sign(event.deltaY);
      this.selectSlot((this.selectedSlot + direction + HOTBAR.length) % HOTBAR.length);
    }, { passive: true });
    on(canvas, "contextmenu", (event) => event.preventDefault());
    on(canvas, "click", () => {
      if (!this.started) return;
      if (this.paused) this.resumeWorld();
      else if (!this.pointerLocked) this.capturePointer();
    });
    on(canvas, "pointerdown", (event) => this.touchLookStart(event));
    on(document, "pointermove", (event) => this.touchLookMove(event));
    on(document, "pointerup", (event) => this.touchLookEnd(event));
    on(document, "pointercancel", (event) => this.touchLookEnd(event));
    on(this.elements["move-stick"], "pointerdown", (event) => this.stickStart(event));
    on(this.elements["move-stick"], "pointermove", (event) => this.stickMove(event));
    on(this.elements["move-stick"], "pointerup", (event) => this.stickEnd(event));
    on(this.elements["move-stick"], "pointercancel", (event) => this.stickEnd(event));
  }

  setIntroState() {
    this.elements["enter-label"].textContent = this.save ? "Continue your world" : "Step into the wild";
    this.elements["intro-tagline"].textContent = this.save ? "The path is right where you left it." : "Make a home in the quiet parts of the world.";
    this.elements["intro-kicker"].textContent = this.save ? "YOUR WORLD IS WAITING" : "A POCKET-SIZED WILDERNESS";
    this.elements["intro-footnote"].textContent = this.save ? formatSavedAt(this.save.savedAt) : "";
    this.elements["corner-note"].textContent = `Mosslight / SEED ${this.seed.toString(36).toUpperCase()}`;
    this.elements["save-status"].textContent = this.save ? "WORLD SAVED" : "";
  }

  enterWorld() {
    if (this.started && !this.paused) return;
    this.audio.unlock();
    this.started = true;
    this.paused = false;
    this.elements["intro-screen"].hidden = true;
    this.elements["pause-screen"].hidden = true;
    this.elements["play-hud"].hidden = false;
    this.elements["touch-controls"].hidden = false;
    this.capturePointer();
    this.saveWorld(false);
    this.updateHud(1);
  }

  capturePointer() {
    if (!this.canvas || !this.started) return;
    if (typeof this.canvas.requestPointerLock !== "function") {
      this.fallbackLook = true;
      this.showToast("Look around by dragging", "Mouse capture is not available in this browser.");
      return;
    }
    try {
      const request = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (request?.catch) request.catch(() => {
        this.fallbackLook = true;
        this.showToast("Click and move to look around", "Your browser did not capture the pointer.");
      });
    } catch {
      this.fallbackLook = true;
    }
  }

  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) {
      this.paused = false;
      this.fallbackLook = false;
      this.elements["pause-screen"].hidden = true;
      return;
    }
    this.mineHeld = false;
    if (!this.started) return;
    if (this.inventoryOpen) return;
    if (performance.now() < this.skipPauseUntil) return;
    if (!this.paused) {
      this.paused = true;
      this.elements["pause-screen"].hidden = false;
      this.elements["touch-controls"].hidden = true;
      this.saveWorld(false);
    }
  }

  resumeWorld() {
    if (!this.started) return;
    this.elements["pause-screen"].hidden = true;
    this.paused = false;
    this.elements["touch-controls"].hidden = false;
    this.audio.unlock();
    this.capturePointer();
  }

  pauseWorld() {
    if (!this.started) return;
    if (this.inventoryOpen) {
      this.closeInventory(false);
      return;
    }
    if (this.pointerLocked) document.exitPointerLock();
    else {
      this.paused = true;
      this.elements["pause-screen"].hidden = false;
      this.elements["touch-controls"].hidden = true;
      this.saveWorld(false);
    }
  }

  toggleInventory() {
    if (!this.started || this.paused) return;
    if (this.inventoryOpen) this.closeInventory(true);
    else this.openInventory();
  }

  openInventory() {
    this.inventoryOpen = true;
    this.mineHeld = false;
    this.elements["inventory-screen"].hidden = false;
    this.elements["touch-controls"].hidden = true;
    this.renderInventory();
    if (this.pointerLocked) {
      this.skipPauseUntil = performance.now() + 450;
      document.exitPointerLock();
    }
  }

  closeInventory(relock = true) {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;
    this.elements["inventory-screen"].hidden = true;
    this.elements["touch-controls"].hidden = this.paused;
    if (relock && this.started && !this.paused) {
      this.skipPauseUntil = performance.now() + 500;
      this.capturePointer();
    }
  }

  requestNewWorld() {
    if (this.save || this.started) this.elements["confirm-screen"].hidden = false;
    else this.beginNewWorld();
  }

  closeConfirm() {
    this.elements["confirm-screen"].hidden = true;
  }

  beginNewWorld() {
    this.closeConfirm();
    if (document.pointerLockElement) document.exitPointerLock();
    try { localStorage.removeItem(SAVE_KEY); } catch { /* Private browsing can disable local storage. */ }
    this.save = null;
    this.started = false;
    this.paused = false;
    this.inventoryOpen = false;
    this.selectedSlot = 0;
    this.inventory = newInventory();
    this.toolDurability = 48;
    this.stats = { blocksPlaced: 0 };
    this.achievements = { firstTimber: false, firstLantern: false };
    this.dayCycle = 0.19;
    this.autosaveTimer = 0;
    this.stateDirtyTimer = 0;
    this.lastSavedCell = "";
    this.player.health = 100;
    this.player.hunger = 100;
    this.player.stamina = 100;
    this.weather = { mode: "clear", remaining: 0, timer: 20 };
    this.dirty = false;
    this.createWorld(randomSeed(), [], null);
    this.elements["intro-screen"].hidden = false;
    this.elements["play-hud"].hidden = true;
    this.elements["touch-controls"].hidden = true;
    this.elements["pause-screen"].hidden = true;
    this.elements["inventory-screen"].hidden = true;
    this.elements["save-status"].textContent = "";
    this.setIntroState();
    this.updateHotbar();
    this.renderInventory();
    this.showToast("A new world takes root", "Walk a little. See what it becomes.");
  }

  toggleSound() {
    const enabled = this.audio.toggle();
    this.elements["sound-toggle"].innerHTML = smallIcon(enabled ? "sound" : "mute", 18);
    this.elements["sound-toggle"].setAttribute("aria-label", enabled ? "Turn sound off" : "Turn sound on");
    this.showToast(enabled ? "Sound on" : "Sound off", enabled ? "Soft, handmade sounds are enabled." : "The forest will stay quiet.");
  }

  keyDown(event) {
    if (event.code === "Escape") {
      if (!this.elements["confirm-screen"].hidden) {
        this.closeConfirm();
        event.preventDefault();
        return;
      }
      if (this.inventoryOpen) {
        this.closeInventory(true);
        event.preventDefault();
        return;
      }
      if (this.started && !this.paused && !this.pointerLocked) {
        this.pauseWorld();
      }
      return;
    }
    if (event.code === "KeyE" && this.started && !this.paused) {
      this.toggleInventory();
      event.preventDefault();
      return;
    }
    if (event.code.startsWith("Digit") && event.code.length === 6) {
      const index = Number(event.code.slice(5)) - 1;
      if (index >= 0 && index < HOTBAR.length) this.selectSlot(index);
    }
    if (event.code === "Space" && this.started && !this.inventoryOpen) event.preventDefault();
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      this.keys.add(event.code);
      if (event.code === "Space" && !event.repeat) this.jump();
    }
  }

  mouseMove(event) {
    if (!this.started || this.paused || this.inventoryOpen) return;
    if (this.pointerLocked || this.fallbackLook) {
      this.player.yaw -= event.movementX * 0.0022;
      this.player.pitch -= event.movementY * 0.0022;
      this.player.pitch = Math.max(-1.48, Math.min(1.48, this.player.pitch));
    }
  }

  mouseDown(event) {
    if (!this.started || this.paused || this.inventoryOpen) return;
    if (event.button !== 0 && event.button !== 2) return;
    const onCanvas = event.target === this.canvas || event.target?.closest?.(".world-canvas");
    if (!this.pointerLocked && !onCanvas) return;
    if (!this.pointerLocked && !this.fallbackLook) {
      if (onCanvas) this.capturePointer();
      return;
    }
    event.preventDefault();
    if (event.button === 0) {
      if (this.target?.type === "creature") this.greetCreature(this.target.actor);
      else this.mineHeld = true;
    } else if (event.button === 2) this.placeSelected();
  }

  touchLookStart(event) {
    if (event.pointerType !== "touch" || !this.started || this.paused || this.inventoryOpen) return;
    if (event.target.closest(".touch-controls") || event.target.closest(".hotbar") || event.target.closest("button")) return;
    this.touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  touchLookMove(event) {
    if (!this.touchLook || event.pointerId !== this.touchLook.id) return;
    const dx = event.clientX - this.touchLook.x;
    const dy = event.clientY - this.touchLook.y;
    this.touchLook.x = event.clientX;
    this.touchLook.y = event.clientY;
    this.player.yaw -= dx * 0.0034;
    this.player.pitch = Math.max(-1.42, Math.min(1.42, this.player.pitch - dy * 0.0034));
  }

  touchLookEnd(event) {
    if (this.touchLook && event.pointerId === this.touchLook.id) this.touchLook = null;
  }

  stickStart(event) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    this.stickPointer = event.pointerId;
    this.elements["move-stick"].setPointerCapture?.(event.pointerId);
    this.stickMove(event);
  }

  stickMove(event) {
    if (this.stickPointer !== event.pointerId) return;
    const rect = this.elements["move-stick"].getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.33;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const scale = Math.min(1, radius / length);
    const x = dx * scale;
    const y = dy * scale;
    this.touchMove.x = x / radius;
    this.touchMove.z = y / radius;
    this.elements["stick-knob"].style.transform = `translate(${x}px, ${y}px)`;
  }

  stickEnd(event) {
    if (this.stickPointer !== event.pointerId) return;
    this.stickPointer = null;
    this.touchMove.x = 0;
    this.touchMove.z = 0;
    this.elements["stick-knob"].style.transform = "translate(0, 0)";
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  frame(now) {
    if (!this.renderer) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.previewTime += dt;

    if (this.started && !this.paused) {
      this.dayCycle = (this.dayCycle + dt / DAY_LENGTH) % 1;
      this.updateWeather(dt);
      this.updateEnvironment(dt);
      if (!this.inventoryOpen) {
        this.updatePlayer(dt);
        this.world.ensureAround(this.player.position.x, this.player.position.z, VIEW_RADIUS, 1);
        this.updateCreatures(dt);
        this.updateParticles(dt);
        this.updateTarget(dt);
        this.updateMining(dt);
        this.updateFootsteps(dt);
      }
      this.autosaveTimer += dt;
      this.stateDirtyTimer += dt;
      if (this.stateDirtyTimer >= 5) {
        this.dirty = true;
        this.stateDirtyTimer = 0;
      }
      if (this.autosaveTimer >= 12 && this.dirty) this.saveWorld(false);
    } else if (!this.started) {
      this.updateEnvironment(dt);
      this.world.ensureAround(this.player.position.x, this.player.position.z, VIEW_RADIUS, 1);
    } else {
      this.updateEnvironment(0);
      this.updateParticles(dt);
    }

    if (!this.started) this.updatePreviewCamera();
    else this.updateCamera(dt);
    this.updateClouds(dt);
    this.updateRain(dt);
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.updateHud(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  updatePreviewCamera() {
    const cameraYaw = this.player.yaw + Math.sin(this.previewTime * 0.13) * 0.16;
    const cameraPitch = this.player.pitch + Math.sin(this.previewTime * 0.08) * 0.018;
    this.setCameraFromPlayer(cameraYaw, cameraPitch);
    this.targetSunAndSky();
  }

  updateCamera() {
    this.setCameraFromPlayer(this.player.yaw, this.player.pitch);
    this.targetSunAndSky();
  }

  setCameraFromPlayer(yaw, pitch) {
    this.camera.position.set(this.player.position.x, this.player.position.y + 1.62, this.player.position.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(pitch, yaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
  }

  targetSunAndSky() {
    const cycle = this.dayCycle * Math.PI * 2;
    const sunDirection = new THREE.Vector3(Math.cos(cycle) * 0.68, Math.sin(cycle), Math.sin(cycle) * 0.62).normalize();
    const center = this.camera.position;
    this.sky.position.copy(center);
    this.stars.position.copy(center);
    this.sunDisc.position.copy(center).addScaledVector(sunDirection, 245);
    this.moonDisc.position.copy(center).addScaledVector(sunDirection, -245);
    this.sunLight.position.copy(center).addScaledVector(sunDirection, 70);
    this.sunLight.target.position.copy(center);
    this.sunLight.target.updateMatrixWorld();
  }

  updateEnvironment() {
    const sunHeight = Math.sin(this.dayCycle * Math.PI * 2);
    const day = smoothstep(-0.2, 0.3, sunHeight);
    const dawn = Math.pow(Math.max(0, 1 - Math.abs(sunHeight)), 5);
    const rain = this.weather.mode === "rain" ? 1 : 0;
    this.sky.material.uniforms.uCycle.value = this.dayCycle;
    this.sky.material.uniforms.uRain.value = rain;
    this.hemisphere.intensity = 0.32 + day * 1.12;
    this.hemisphere.color.set(day > 0.4 ? 0xdcebf0 : 0x93a6bb);
    this.hemisphere.groundColor.set(day > 0.4 ? 0x5a5a43 : 0x272c31);
    this.sunLight.intensity = 0.12 + day * (rain ? 1.02 : 1.78);
    this.sunLight.color.set(day > 0.24 ? 0xffe7c3 : dawn > 0.1 ? 0xf6a978 : 0x9baac8);
    this.sunDisc.visible = day > 0.035;
    this.sunDisc.material.color.set(dawn > 0.15 ? 0xffbb82 : 0xffedbd);
    this.moonDisc.visible = day < 0.2;
    this.starsMaterial.opacity = Math.max(0, (1 - day) * 0.86);
    const horizon = new THREE.Color(0x1b2933).lerp(new THREE.Color(0xa3c3d0), day);
    if (dawn > 0.28) horizon.lerp(new THREE.Color(0xc98a70), dawn * 0.34);
    if (rain) horizon.lerp(new THREE.Color(0x607684), 0.42);
    this.scene.fog.color.copy(horizon);
    this.scene.fog.density = 0.016 + (1 - day) * 0.0018 + rain * 0.004;
    if (this.cloudMaterial) {
      this.cloudMaterial.color.set(rain ? 0x91a0a1 : day > 0.3 ? 0xe7eee8 : 0x7d8996);
    }
  }

  updateWeather(dt) {
    if (this.weather.mode === "rain") {
      this.weather.remaining -= dt;
      if (this.weather.remaining <= 0) {
        this.weather.mode = "clear";
        this.weather.timer = 70 + Math.random() * 80;
        this.showToast("The rain lets up", "A few drops still cling to the leaves.");
      }
    } else {
      this.weather.timer -= dt;
      if (this.weather.timer <= 0) {
        if (Math.random() < 0.46) {
          this.weather.mode = "rain";
          this.weather.remaining = 27 + Math.random() * 25;
          this.showToast("A soft rain rolls in", "The forest takes a breath.");
        } else this.weather.timer = 45 + Math.random() * 60;
      }
    }
  }

  updateClouds(dt) {
    if (!this.player) return;
    for (const cloud of this.clouds) {
      cloud.drift = (cloud.drift + dt * 0.32) % 32;
      cloud.group.position.set(this.player.position.x + cloud.offsetX + cloud.drift - 16, cloud.y, this.player.position.z + cloud.offsetZ);
    }
  }

  updateRain(dt) {
    if (!this.rain || !this.rainDrops) return;
    const active = this.weather.mode === "rain" && this.started && !this.paused;
    this.rain.visible = active;
    this.rainMaterial.opacity = active ? 0.47 : 0;
    if (!active) return;
    const positions = this.rainGeometry.attributes.position.array;
    for (let i = 0; i < this.rainDrops.length; i += 1) {
      const drop = this.rainDrops[i];
      drop.y -= drop.speed * dt;
      drop.x += dt * 1.1;
      if (drop.y < -1) {
        drop.y = 14 + Math.random() * 7;
        drop.x = (Math.random() - 0.5) * 24;
        drop.z = (Math.random() - 0.5) * 24;
      }
      positions[i * 3] = drop.x;
      positions[i * 3 + 1] = drop.y;
      positions[i * 3 + 2] = drop.z;
    }
    this.rain.position.copy(this.camera.position);
    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  updatePlayer(dt) {
    const forward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) - this.touchMove.z;
    const strafe = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) + this.touchMove.x;
    const inputLength = Math.hypot(forward, strafe);
    const inputScale = inputLength > 1 ? 1 / inputLength : 1;
    const fwdX = -Math.sin(this.player.yaw);
    const fwdZ = -Math.cos(this.player.yaw);
    const rightX = Math.cos(this.player.yaw);
    const rightZ = -Math.sin(this.player.yaw);
    const directionX = (fwdX * forward + rightX * strafe) * inputScale;
    const directionZ = (fwdZ * forward + rightZ * strafe) * inputScale;
    const inWater = this.inWater();
    const wantsRun = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const running = wantsRun && inputLength > 0.05 && this.player.stamina > 1 && !inWater;
    const speed = inWater ? 2.45 : running ? 6.35 : 4.35;
    const acceleration = Math.min(1, dt * (inWater ? 6.8 : 12));
    this.player.velocity.x += (directionX * speed - this.player.velocity.x) * acceleration;
    this.player.velocity.z += (directionZ * speed - this.player.velocity.z) * acceleration;
    if (inputLength < 0.05) {
      const friction = Math.pow(inWater ? 0.91 : 0.76, dt * 60);
      this.player.velocity.x *= friction;
      this.player.velocity.z *= friction;
    }

    if (running) this.player.stamina = Math.max(0, this.player.stamina - dt * 21);
    else this.player.stamina = Math.min(100, this.player.stamina + dt * (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 7 : 14));
    if (inWater && this.keys.has("Space")) this.player.velocity.y = Math.min(4.5, this.player.velocity.y + dt * 13);
    this.player.velocity.y -= dt * (inWater ? 6.3 : 22);
    this.moveHorizontal("x", this.player.velocity.x * dt);
    this.moveHorizontal("z", this.player.velocity.z * dt);
    this.moveVertical(this.player.velocity.y * dt);

    const cell = `${Math.floor(this.player.position.x)},${Math.floor(this.player.position.y)},${Math.floor(this.player.position.z)}`;
    if (cell !== this.lastSavedCell) {
      this.lastSavedCell = cell;
      this.dirty = true;
    }

    this.player.hunger = Math.max(0, this.player.hunger - dt * (running ? 0.12 : 0.055));
    if (this.player.hunger > 62 && this.player.health < 100) this.player.health = Math.min(100, this.player.health + dt * 0.45);
    if (this.player.hunger <= 0) {
      this.player.health = Math.max(1, this.player.health - dt * 0.48);
    }
    if (this.player.position.y < -5) this.respawnPlayer();
  }

  collidesAt(position) {
    const radius = 0.29;
    const minX = Math.floor(position.x - radius + 0.001);
    const maxX = Math.floor(position.x + radius - 0.001);
    const minY = Math.floor(position.y + 0.06);
    const maxY = Math.floor(position.y + 1.77 - 0.04);
    const minZ = Math.floor(position.z - radius + 0.001);
    const maxZ = Math.floor(position.z + radius - 0.001);
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (this.world.isSolidAt(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  moveHorizontal(axis, amount) {
    if (Math.abs(amount) < 0.0001) return;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.12));
    const increment = amount / steps;
    for (let step = 0; step < steps; step += 1) {
      this.player.position[axis] += increment;
      if (this.collidesAt(this.player.position)) {
        this.player.position[axis] -= increment;
        this.player.velocity[axis] = 0;
        break;
      }
    }
  }

  moveVertical(amount) {
    if (Math.abs(amount) < 0.0001) {
      this.player.onGround = false;
      const probe = this.player.position.clone();
      probe.y -= 0.035;
      this.player.onGround = this.collidesAt(probe);
      return;
    }
    const wasGrounded = this.player.onGround;
    if (amount < 0 && !wasGrounded && !this.player.fallStart) this.player.fallStart = this.player.position.y;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.08));
    const increment = amount / steps;
    let landed = false;
    for (let step = 0; step < steps; step += 1) {
      this.player.position.y += increment;
      if (this.collidesAt(this.player.position)) {
        this.player.position.y -= increment;
        if (increment < 0) {
          landed = true;
          this.player.onGround = true;
          const fallDistance = this.player.fallStart ? this.player.fallStart - this.player.position.y : 0;
          if (fallDistance > 4.6) this.damagePlayer(Math.min(46, (fallDistance - 3.6) * 8));
          this.player.fallStart = 0;
        }
        this.player.velocity.y = 0;
        break;
      }
      this.player.onGround = false;
    }
    if (!landed && this.player.velocity.y < -0.1 && !this.player.fallStart) this.player.fallStart = this.player.position.y;
  }

  inWater() {
    const p = this.player.position;
    return this.world.blockAt(Math.floor(p.x), Math.floor(p.y + 0.86), Math.floor(p.z)) === BLOCK.WATER;
  }

  jump() {
    if (!this.started || this.paused || this.inventoryOpen) return;
    if (this.player.onGround) {
      this.player.velocity.y = 7.4;
      this.player.onGround = false;
      this.player.fallStart = this.player.position.y;
    } else if (this.inWater()) this.player.velocity.y = Math.max(this.player.velocity.y, 4.3);
  }

  damagePlayer(amount) {
    this.player.health = Math.max(0, this.player.health - amount);
    this.audio.play("hurt");
    this.showToast("That was a long way down", "Find a quiet place to catch your breath.");
    if (this.player.health <= 0) this.respawnPlayer();
  }

  respawnPlayer() {
    this.player.position.copy(this.player.spawn);
    this.player.velocity.set(0, 0, 0);
    this.player.health = 78;
    this.player.hunger = Math.max(35, this.player.hunger);
    this.player.onGround = false;
    this.player.fallStart = 0;
    this.showToast("Back at your first clearing", "Your things are still with you.");
  }

  updateFootsteps(dt) {
    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z) > 1.1 && this.player.onGround;
    this.stepTimer -= dt;
    if (moving && this.stepTimer <= 0) {
      this.audio.play("step");
      this.stepTimer = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) ? 0.28 : 0.42;
    }
  }

  traceBlocks() {
    const origin = this.camera.position;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);
    const deltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x);
    const deltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y);
    const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z);
    let maxX = stepX > 0 ? (x + 1 - origin.x) * deltaX : stepX < 0 ? (origin.x - x) * deltaX : Infinity;
    let maxY = stepY > 0 ? (y + 1 - origin.y) * deltaY : stepY < 0 ? (origin.y - y) * deltaY : Infinity;
    let maxZ = stepZ > 0 ? (z + 1 - origin.z) * deltaZ : stepZ < 0 ? (origin.z - z) * deltaZ : Infinity;
    let normal = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < 28; i += 1) {
      const id = this.world.blockAt(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && blockData(id).name !== "Air") {
        const distance = Math.sqrt((x + 0.5 - origin.x) ** 2 + (y + 0.5 - origin.y) ** 2 + (z + 0.5 - origin.z) ** 2);
        if (distance <= 6.2) return { type: "block", block: { x, y, z, id }, normal, distance };
        return null;
      }
      if (maxX < maxY && maxX < maxZ) {
        x += stepX;
        maxX += deltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (maxY < maxZ) {
        y += stepY;
        maxY += deltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        maxZ += deltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
      if (Math.min(maxX, maxY, maxZ) > 6.2) break;
    }
    return null;
  }

  traceCreature() {
    if (!this.creatures.length) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const roots = this.creatures.map((creature) => creature.group);
    const hits = this.raycaster.intersectObjects(roots, true);
    const hit = hits.find((candidate) => candidate.distance < 5.2 && candidate.object.userData.actor);
    if (!hit) return null;
    return { type: "creature", actor: hit.object.userData.actor, distance: hit.distance };
  }

  updateTarget() {
    if (!this.started || this.paused || this.inventoryOpen) {
      this.target = null;
      this.blockOutline.visible = false;
      this.elements["focus-label"].hidden = true;
      this.elements["reticle"].hidden = true;
      return;
    }
    const block = this.traceBlocks();
    const creature = this.traceCreature();
    this.target = creature && (!block || creature.distance < block.distance) ? creature : block;
    this.elements["reticle"].hidden = false;
    if (this.target?.type === "block") {
      const targetBlock = this.target.block;
      this.blockOutline.visible = true;
      this.blockOutline.position.set(targetBlock.x + 0.5, targetBlock.y + 0.5, targetBlock.z + 0.5);
      const name = blockName(targetBlock.id);
      this.setFocusLabel(`${name}<span>Hold to gather</span>`);
      if (this.mining.key === blockKey(targetBlock) && this.mining.elapsed > 0) {
        const hardness = this.breakTime(targetBlock.id);
        const progress = Math.min(1, this.mining.elapsed / hardness);
        this.elements["reticle"].classList.add("is-breaking");
        this.elements["reticle-fill"].style.strokeDashoffset = String(126 - 126 * progress);
        this.blockOutline.material.color.setHSL(0.11 - progress * 0.075, 0.7, 0.8);
      } else {
        this.elements["reticle"].classList.remove("is-breaking");
        this.elements["reticle-fill"].style.strokeDashoffset = "126";
        this.blockOutline.material.color.set(0xf2ecd8);
      }
    } else if (this.target?.type === "creature") {
      this.blockOutline.visible = false;
      this.setFocusLabel("A small forest friend<span>Click to say hello</span>");
      this.elements["reticle"].classList.remove("is-breaking");
      this.elements["reticle-fill"].style.strokeDashoffset = "126";
    } else {
      this.blockOutline.visible = false;
      this.elements["focus-label"].hidden = true;
      this.elements["reticle"].classList.remove("is-breaking");
      this.elements["reticle-fill"].style.strokeDashoffset = "126";
    }
  }

  setFocusLabel(html) {
    const label = this.elements["focus-label"];
    if (label.innerHTML !== html) label.innerHTML = html;
    label.hidden = false;
  }

  updateMining(dt) {
    if (!this.mineHeld || this.target?.type !== "block") {
      this.mining.key = "";
      this.mining.elapsed = 0;
      this.elements["reticle"].classList.remove("is-breaking");
      this.elements["reticle-fill"].style.strokeDashoffset = "126";
      return;
    }
    const block = this.target.block;
    const key = blockKey(block);
    if (this.mining.key !== key) {
      this.mining.key = key;
      this.mining.elapsed = 0;
    }
    const tool = this.selectedItem() === "wooden_pickaxe" && this.toolDurability > 0;
    const time = this.breakTime(block.id) * (tool ? 0.36 : 1);
    this.mining.elapsed += dt;
    const progress = Math.min(1, this.mining.elapsed / time);
    this.elements["reticle"].classList.add("is-breaking");
    this.elements["reticle-fill"].style.strokeDashoffset = String(126 - 126 * progress);
    if (progress >= 1) this.breakBlock(block, tool);
  }

  breakTime(id) {
    if (id === BLOCK.FLOWER || id === BLOCK.LEAVES) return 0.22;
    if (id === BLOCK.DIRT || id === BLOCK.GRASS || id === BLOCK.SAND || id === BLOCK.CLAY || id === BLOCK.MOSS) return 0.47;
    if (id === BLOCK.LOG || id === BLOCK.PLANKS) return 0.66;
    if (id === BLOCK.COAL_ORE) return 0.88;
    if (id === BLOCK.LANTERN || id === BLOCK.CAMPFIRE) return 0.56;
    if (id === BLOCK.BEDROCK) return Infinity;
    return 0.92;
  }

  breakBlock(block, usedTool) {
    if (block.id === BLOCK.BEDROCK) return;
    const key = blockKey(block);
    this.mineHeld = false;
    this.mining.key = "";
    this.mining.elapsed = 0;
    this.world.setBlock(block.x, block.y, block.z, BLOCK.AIR);
    const drop = itemForBlock(block.id);
    if (drop) {
      const amount = block.id === BLOCK.COAL_ORE && Math.random() < 0.15 ? 2 : 1;
      this.addItem(drop, amount);
      this.showToast(`+${amount} ${ITEM_NAMES[drop] || drop}`, this.breakLine(block.id));
      if (drop === "wood" && !this.achievements.firstTimber) {
        this.achievements.firstTimber = true;
        this.showToast("First timber", "Turn a log into planks in your pack.");
      }
    } else this.showToast("Block cleared", "The path is yours.");
    if (usedTool) {
      this.toolDurability = Math.max(0, this.toolDurability - 1);
      if (this.toolDurability === 0) this.inventory.wooden_pickaxe = 0;
    }
    this.audio.play("break");
    const color = block.id === BLOCK.GRASS || block.id === BLOCK.MOSS ? 0x8fa366 : block.id === BLOCK.LOG ? 0x9b704b : block.id === BLOCK.STONE || block.id === BLOCK.COAL_ORE ? 0x92958a : 0xb89368;
    this.spawnBlockParticles(block.x + 0.5, block.y + 0.5, block.z + 0.5, color, 9);
    this.dirty = true;
    this.updateHotbar();
    this.renderInventoryIfOpen();
    this.updateTarget(0);
    this.saveWorld(false);
  }

  breakLine(id) {
    if (id === BLOCK.LOG) return "Good wood makes good shelter.";
    if (id === BLOCK.COAL_ORE) return "A little fuel for the dark.";
    if (id === BLOCK.FLOWER) return "A bit of color for your pack.";
    if (id === BLOCK.LEAVES) return "The canopy makes room for light.";
    return "Tuck it away for a project.";
  }

  addItem(item, amount = 1) {
    this.inventory[item] = Math.max(0, Number(this.inventory[item] || 0)) + amount;
    this.dirty = true;
    this.updateHotbar();
    this.renderInventoryIfOpen();
  }

  selectedItem() {
    return HOTBAR[this.selectedSlot];
  }

  selectSlot(index) {
    if (index < 0 || index >= HOTBAR.length) return;
    this.selectedSlot = index;
    this.updateHotbar();
    this.audio.play("gather");
  }

  updateHotbar() {
    const slots = this.elements.hotbar.querySelectorAll("[data-slot]");
    slots.forEach((slot, index) => {
      slot.classList.toggle("is-selected", index === this.selectedSlot);
      const item = HOTBAR[index];
      const countElement = this.container.querySelector(`#slot-count-${index}`);
      const count = Number(this.inventory[item] || 0);
      if (countElement) countElement.textContent = count > 0 ? String(count) : "";
      slot.classList.toggle("is-empty", count < 1 && item !== "wooden_pickaxe");
      const durability = this.container.querySelector(`#slot-durability-${index}`);
      if (durability) {
        durability.style.width = item === "wooden_pickaxe" && count > 0 ? `${(this.toolDurability / 64) * 100}%` : "0%";
        durability.hidden = item !== "wooden_pickaxe" || count < 1;
      }
    });
    const selected = this.selectedItem();
    this.elements["selected-name"].textContent = ITEM_NAMES[selected] || selected;
    const count = Number(this.inventory[selected] || 0);
    this.elements["selected-count"].textContent = selected === "wooden_pickaxe" && count > 0 ? `${this.toolDurability}` : count > 0 ? `x${count}` : "empty";
  }

  placeSelected() {
    if (!this.started || this.paused || this.inventoryOpen || !this.target) return;
    const item = this.selectedItem();
    if (item === "berries" || item === "trailmix") {
      this.eatItem(item);
      return;
    }
    const id = PLACEABLE[item];
    if (!id) {
      this.showToast("Nothing to place", "Choose a block or a lantern in your hand.");
      return;
    }
    if (Number(this.inventory[item] || 0) < 1) {
      this.showToast(`No ${ITEM_NAMES[item]?.toLowerCase() || item} left`, "Gather a little more, or choose another slot.");
      return;
    }
    if (this.target.type !== "block") return;
    const place = {
      x: this.target.block.x + this.target.normal.x,
      y: this.target.block.y + this.target.normal.y,
      z: this.target.block.z + this.target.normal.z,
    };
    const occupant = this.world.blockAt(place.x, place.y, place.z);
    if (occupant !== BLOCK.AIR && occupant !== BLOCK.FLOWER && occupant !== BLOCK.WATER) return;
    const box = new THREE.Vector3(place.x + 0.5, place.y, place.z + 0.5);
    const player = this.player.position;
    const overlaps = Math.abs(box.x - player.x) < 0.79 && Math.abs(box.z - player.z) < 0.79 && place.y < player.y + 1.77 && place.y + 1 > player.y + 0.06;
    if (overlaps) {
      this.showToast("Make a little room", "That block would be right where you are standing.");
      return;
    }
    if (!this.world.setBlock(place.x, place.y, place.z, id)) return;
    this.inventory[item] -= 1;
    this.stats.blocksPlaced += 1;
    if (item === "lantern" && !this.achievements.firstLantern) {
      this.achievements.firstLantern = true;
      this.showToast("A light of your own", "Lanterns make the long evenings softer.");
    } else this.showToast(`${ITEM_NAMES[item]} placed`, "The little things make a place yours.");
    this.audio.play("place");
    this.spawnBlockParticles(place.x + 0.5, place.y + 0.6, place.z + 0.5, item === "lantern" ? 0xf7ce82 : 0xc5b28e, 6);
    this.dirty = true;
    this.updateHotbar();
    this.renderInventoryIfOpen();
    this.updateTarget(0);
    this.saveWorld(false);
  }

  eatItem(item) {
    if (!this.inventory[item]) {
      this.showToast("Nothing to eat", "Pick a berry or trail mix first.");
      return;
    }
    if (item === "berries") {
      this.player.hunger = Math.min(100, this.player.hunger + 22);
      this.player.health = Math.min(100, this.player.health + 3);
    } else {
      this.player.hunger = Math.min(100, this.player.hunger + 42);
      this.player.health = Math.min(100, this.player.health + 12);
    }
    this.inventory[item] -= 1;
    this.audio.play("gather");
    this.showToast(item === "berries" ? "A handful of berries" : "A good trail meal", "You feel a little more like yourself.");
    this.dirty = true;
    this.updateHotbar();
    this.renderInventoryIfOpen();
  }

  spawnBlockParticles(x, y, z, color, count) {
    const random = this.randomGenerator(Math.floor(x * 97 + y * 53 + z * 179 + performance.now()));
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true });
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.particleGeometry, material.clone());
      mesh.position.set(x + (random() - 0.5) * 0.46, y + (random() - 0.5) * 0.46, z + (random() - 0.5) * 0.46);
      mesh.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      mesh.castShadow = false;
      const particle = { mesh, velocity: new THREE.Vector3((random() - 0.5) * 3, 1.4 + random() * 2.7, (random() - 0.5) * 3), life: 0.45 + random() * 0.3, fullLife: 0.75 };
      this.particles.push(particle);
      this.scene.add(mesh);
    }
  }

  updateParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.material.dispose();
        this.particles.splice(index, 1);
        continue;
      }
      particle.velocity.y -= dt * 8;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 3;
      particle.mesh.rotation.y += dt * 3.8;
      particle.mesh.material.opacity = Math.min(1, particle.life / particle.fullLife);
    }
  }

  greetCreature(actor) {
    if (!actor) return;
    const now = performance.now() / 1000;
    if (now < actor.giftAt) {
      this.showToast("A tiny nose-boop", "Your forest friend is already happy to see you.");
      return;
    }
    actor.giftAt = now + 42;
    this.addItem("berries", 1);
    this.audio.play("gather");
    this.showToast("A berry from a mossling", "A small friend shares what it found.");
    const color = 0xd88f7f;
    this.spawnBlockParticles(actor.group.position.x, actor.group.position.y + 0.8, actor.group.position.z, color, 8);
    actor.moodTimer = 0.3;
  }

  updateCreatures(dt) {
    for (const actor of this.creatures) {
      if (Math.hypot(actor.group.position.x - this.player.position.x, actor.group.position.z - this.player.position.z) > 72) {
        const angle = Math.random() * Math.PI * 2;
        const x = Math.floor(this.player.position.x + Math.cos(angle) * 6);
        const z = Math.floor(this.player.position.z + Math.sin(angle) * 6);
        const floorY = this.world.surfaceAt(x, z);
        actor.home.set(x + 0.5, floorY + 1, z + 0.5);
        actor.destination.copy(actor.home);
        actor.group.position.copy(actor.home);
      }
      actor.moodTimer -= dt;
      actor.phase += dt * 2.4;
      const dxToPlayer = this.player.position.x - actor.group.position.x;
      const dzToPlayer = this.player.position.z - actor.group.position.z;
      if (actor.moodTimer <= 0) {
        actor.moodTimer = 2.8 + Math.random() * 3.8;
        const angle = Math.random() * Math.PI * 2;
        const distance = 1.5 + Math.random() * 4.2;
        let x = Math.floor(actor.home.x + Math.cos(angle) * distance);
        let z = Math.floor(actor.home.z + Math.sin(angle) * distance);
        if (Math.hypot(dxToPlayer, dzToPlayer) > 9) {
          x = Math.floor(this.player.position.x + Math.sign(dxToPlayer) * 4 + (Math.random() - 0.5) * 2);
          z = Math.floor(this.player.position.z + Math.sign(dzToPlayer) * 4 + (Math.random() - 0.5) * 2);
        }
        const floorY = this.world.surfaceAt(x, z);
        const top = this.world.blockAt(x, floorY, z);
        if ((top === BLOCK.GRASS || top === BLOCK.MOSS) && Math.hypot(x + 0.5 - this.player.position.x, z + 0.5 - this.player.position.z) > 1.5) {
          actor.destination.set(x + 0.5, floorY + 1, z + 0.5);
        }
      }
      const dx = actor.destination.x - actor.group.position.x;
      const dz = actor.destination.z - actor.group.position.z;
      const distance = Math.hypot(dx, dz);
      actor.walk = distance > 0.14 ? Math.min(1, actor.walk + dt * 3) : Math.max(0, actor.walk - dt * 4);
      if (distance > 0.08) {
        const move = Math.min(distance, dt * 0.78);
        actor.group.position.x += (dx / distance) * move;
        actor.group.position.z += (dz / distance) * move;
        actor.group.rotation.y = Math.atan2(-dx, -dz);
        const floorY = this.world.surfaceAt(Math.floor(actor.group.position.x), Math.floor(actor.group.position.z));
        actor.group.position.y += ((floorY + 1) - actor.group.position.y) * Math.min(1, dt * 6);
      }
      actor.group.position.y += Math.sin(actor.phase) * 0.004;
      for (let i = 0; i < actor.legs.length; i += 1) {
        actor.legs[i].rotation.x = Math.sin(actor.phase * 2 + (i % 2) * Math.PI) * 0.42 * actor.walk;
      }
    }
  }

  renderInventory() {
    if (!this.elements["inventory-grid"]) return;
    const total = Object.values(this.inventory).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
    this.elements["pack-total"].textContent = `${total} ${total === 1 ? "thing" : "things"}`;
    this.elements["inventory-grid"].innerHTML = INVENTORY_ITEMS.map((item) => {
      const amount = Number(this.inventory[item] || 0);
      const isTool = item === "wooden_pickaxe" && amount > 0;
      const countText = isTool ? `${this.toolDurability}/64` : amount;
      const selected = this.selectedItem() === item;
      const subtext = item === "berries" || item === "trailmix" ? "Tap to eat" : selected ? "In hand" : "";
      return `<button class="inventory-item ${amount < 1 ? "is-empty" : ""} ${selected ? "is-equipped" : ""}" data-item="${item}" type="button" aria-label="${ITEM_NAMES[item]}: ${amount}"><span class="inventory-item-icon">${iconSvg(item)}</span><span class="inventory-item-name">${ITEM_NAMES[item]}</span><span class="inventory-item-count">${countText}</span><span class="inventory-item-sub">${subtext}</span></button>`;
    }).join("");
    this.elements["inventory-grid"].querySelectorAll("[data-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = button.dataset.item;
        if (item === "berries" || item === "trailmix") {
          this.eatItem(item);
          return;
        }
        const slot = HOTBAR.indexOf(item);
        if (slot >= 0) this.selectSlot(slot);
        else this.showToast(ITEM_NAMES[item], `${Number(this.inventory[item] || 0)} in your pack.`);
      });
    });
    this.elements["recipe-list"].innerHTML = RECIPES.map((recipe) => {
      const canCraft = this.canCraft(recipe);
      const inputText = Object.entries(recipe.inputs).map(([item, count]) => `${count} ${ITEM_NAMES[item] || item}`).join(" / ");
      return `<button class="recipe-row ${canCraft ? "can-craft" : ""}" data-recipe="${recipe.id}" type="button" ${canCraft ? "" : "disabled"}><span class="recipe-icon">${iconSvg(CRAFT_ICONS[recipe.id])}</span><span class="recipe-copy"><strong>${recipe.name}</strong><span>${recipe.detail}</span></span><span class="recipe-cost">${inputText}</span><span class="recipe-make">${canCraft ? "MAKE" : "NEED MORE"}</span></button>`;
    }).join("");
    this.elements["recipe-list"].querySelectorAll("[data-recipe]").forEach((button) => {
      button.addEventListener("click", () => this.craft(button.dataset.recipe));
    });
  }

  renderInventoryIfOpen() {
    if (this.inventoryOpen) this.renderInventory();
  }

  canCraft(recipe) {
    if (recipe.unique && this.inventory.wooden_pickaxe > 0 && this.toolDurability > 0) return false;
    return Object.entries(recipe.inputs).every(([item, amount]) => Number(this.inventory[item] || 0) >= amount);
  }

  craft(recipeId) {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return;
    for (const [item, amount] of Object.entries(recipe.inputs)) this.inventory[item] -= amount;
    for (const [item, amount] of Object.entries(recipe.outputs)) this.inventory[item] = Number(this.inventory[item] || 0) + amount;
    if (recipe.id === "wooden_pickaxe") this.toolDurability = 64;
    this.audio.play("craft");
    this.dirty = true;
    this.showToast(`${recipe.name} made`, "A little more ready for the road.");
    this.updateHotbar();
    this.renderInventory();
  }

  updateHud() {
    if (!this.elements["time-label"]) return;
    const px = Math.floor(this.player.position.x);
    const pz = Math.floor(this.player.position.z);
    const biome = biomeAt(px, pz, this.seed);
    if (this.currentBiome !== biome) {
      this.currentBiome = biome;
      this.elements["biome-label"].textContent = biome;
      if (this.started && !this.paused) this.showToast(`You found ${biome.toLowerCase()}`, "A new part of the world unfolds.");
    }
    this.elements["time-label"].textContent = formatTime(this.dayCycle);
    const rainy = this.weather.mode === "rain";
    this.elements["weather-icon"].innerHTML = smallIcon(rainy ? "rain" : "sun", 16);
    this.elements["weather-label"].textContent = rainy ? "Rain" : "Clear";
    this.elements["coordinates"].textContent = `X ${px}  /  Z ${pz}`;
    this.elements["health-fill"].style.width = `${this.player.health}%`;
    this.elements["food-fill"].style.width = `${this.player.hunger}%`;
    this.elements["stamina-fill"].style.width = `${this.player.stamina}%`;
    this.elements["health-value"].textContent = `${Math.ceil(this.player.health)}`;
    this.elements["food-value"].textContent = `${Math.ceil(this.player.hunger)}`;
  }

  showToast(title, detail = "") {
    const stack = this.elements["toast-stack"];
    stack.innerHTML = `<div class="toast-item"><span class="toast-leaf">${smallIcon("leaf", 16)}</span><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ""}</span></div>`;
    stack.classList.add("is-visible");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => stack.classList.remove("is-visible"), 2800);
  }

  saveWorld(manual = false) {
    if (!this.world) return;
    const now = Date.now();
    const save = {
      version: 1,
      seed: this.seed,
      edits: this.world.exportEdits(),
      inventory: this.inventory,
      position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      health: this.player.health,
      hunger: this.player.hunger,
      toolDurability: this.toolDurability,
      dayCycle: this.dayCycle,
      stats: this.stats,
      achievements: this.achievements,
      savedAt: now,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      this.save = save;
      this.dirty = false;
      this.autosaveTimer = 0;
      this.elements["save-status"].textContent = "SAVED JUST NOW";
      if (manual) this.showToast("World saved", "Your trail will be right here next time.");
    } catch (error) {
      console.warn("Could not save Mosslight locally:", error);
      this.elements["save-status"].textContent = "SAVE FAILED";
      if (manual) this.showToast("Could not save here", "Browser storage may be unavailable.");
    }
  }

  showFatalError(error) {
    this.container.innerHTML = `<section class="fatal-error"><div class="fatal-leaf">${smallIcon("leaf", 25)}</div><h1>Mosslight could not open.</h1><p>This world needs a browser with WebGL enabled. Try updating your browser or turning on hardware acceleration.</p><small>${String(error?.message || "Rendering is unavailable.")}</small></section>`;
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.toastTimeout);
    for (const cleanup of this.cleanup) cleanup();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    if (this.renderer) {
      if (this.started) this.saveWorld(false);
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      if (this.world) {
        this.scene.remove(this.world.group);
        this.world.dispose();
        this.world = null;
      }
      const geometries = new Set();
      const materials = new Set();
      this.scene?.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
        else if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        material.map?.dispose?.();
        material.dispose?.();
      }
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement.remove();
    }
    this.particleGeometry?.dispose();
    this.container.innerHTML = "";
  }
}