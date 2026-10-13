const META_KEY = "veilfall.meta.v1";
const PREF_KEY = "veilfall.prefs.v1";

const THEMES = [
  { name: "The Ossuary", subtitle: "The dead keep what they are given.", floor: "THE FIRST DESCENT", bg: "#111116", floorColor: "#343137", trim: "#a98a68", glow: "#d8a66d", danger: "#d26b5e" },
  { name: "Ashen Chapel", subtitle: "Every prayer returns as smoke.", floor: "THE CINDER CHOIR", bg: "#171111", floorColor: "#403130", trim: "#c18b64", glow: "#f09a56", danger: "#f06e47" },
  { name: "The Drowned Choir", subtitle: "Something sings below the waterline.", floor: "THE SUNKEN HALLS", bg: "#0d1719", floorColor: "#263a3c", trim: "#6aa4a0", glow: "#7ac8bc", danger: "#72cdb9" },
  { name: "Gilded Nursery", subtitle: "All the little kings are hungry.", floor: "THE LITTLE KINGDOM", bg: "#17150f", floorColor: "#40392a", trim: "#c7a35e", glow: "#efd080", danger: "#dc9c47" },
  { name: "The Fungal Archive", subtitle: "The books have started to breathe.", floor: "THE SPORE LIBRARY", bg: "#111711", floorColor: "#303b30", trim: "#89a275", glow: "#aed281", danger: "#b0cb68" },
  { name: "The Pale Crown", subtitle: "The last light has learned to hate you.", floor: "THE VEIL'S HEART", bg: "#11131b", floorColor: "#2b2e3b", trim: "#a8a8c0", glow: "#c5c9f1", danger: "#bb9fe7" },
];

const CHARACTERS = [
  { id: "stray", name: "The Stray", mark: "S", blurb: "A steady hand. Six hearts, even steps.", maxHp: 6, speed: 208, damage: 1, fireDelay: 0.34, color: "#efe1c2", cost: 0, unlock: "Available" },
  { id: "moth", name: "Moth", mark: "M", blurb: "Quick feet, fragile wings, rapid tears.", maxHp: 4, speed: 252, damage: 0.84, fireDelay: 0.27, color: "#c5d9cc", cost: 42, unlock: "42 embers" },
  { id: "warden", name: "The Warden", mark: "W", blurb: "A heavy heart. Starts with an extra key.", maxHp: 8, speed: 174, damage: 1.12, fireDelay: 0.38, color: "#d6c5ab", cost: 68, unlock: "Clear floor 3 or pay 68" },
  { id: "wisp", name: "Wisp", mark: "*", blurb: "A crackling soul. Tears jump to a neighbor.", maxHp: 5, speed: 224, damage: 0.92, fireDelay: 0.31, color: "#9ddbd4", cost: 96, unlock: "Win once or pay 96" },
];

const UPGRADES = [
  { id: "vessel", name: "Bigger Vessel", desc: "+1 permanent heart container", max: 3, cost: [32, 61, 98] },
  { id: "edge", name: "Sharpened Tears", desc: "+12% damage each rank", max: 4, cost: [36, 66, 104, 151] },
  { id: "step", name: "Quiet Soles", desc: "+8% movement speed each rank", max: 3, cost: [30, 58, 91] },
  { id: "purse", name: "Pilgrim's Purse", desc: "+7 starting coins each rank", max: 4, cost: [26, 49, 78, 115] },
];

const ITEMS = [
  { id: "glass-heart", name: "Glass Heart", mark: "G", color: "#e89b8e", desc: "+0.45 tear damage. Fragile things cut deep.", price: 7 },
  { id: "cat-eye", name: "Cat's Eye", mark: "C", color: "#e9d07f", desc: "Fire an extra tear in a gentle spread.", price: 8 },
  { id: "rubber-soul", name: "Rubber Soul", mark: "R", color: "#95b9d4", desc: "Your tears ricochet once off a wall.", price: 8 },
  { id: "ember-crown", name: "Ember Crown", mark: "E", color: "#f29b61", desc: "Tears have a chance to set foes ablaze.", price: 9 },
  { id: "static-halo", name: "Static Halo", mark: "S", color: "#9bd4d0", desc: "Tears leap between nearby enemies.", price: 9 },
  { id: "widow-thread", name: "Widow's Thread", mark: "W", color: "#b99ad0", desc: "Tears sometimes leave a venomous wound.", price: 7 },
  { id: "pocket-watch", name: "Pocket Watch", mark: "P", color: "#d5caab", desc: "All creatures in the halls move slower.", price: 8 },
  { id: "moonstone", name: "Moonstone", mark: "M", color: "#a8b5e8", desc: "+12% movement speed. The dark bends away.", price: 7 },
  { id: "heart-vessel", name: "Heart Vessel", mark: "H", color: "#e4736a", desc: "+1 heart container and refill it.", price: 10 },
  { id: "long-sight", name: "Long Sight", mark: "L", color: "#a8d1bb", desc: "Tears travel farther and faster.", price: 7 },
  { id: "black-candle", name: "Black Candle", mark: "B", color: "#d5ae78", desc: "+0.2 damage. Shops are a little kinder.", price: 8 },
  { id: "feast-bell", name: "Feast Bell", mark: "F", color: "#e3c578", desc: "A cleared room may restore a heart.", price: 9 },
  { id: "porcelain-mask", name: "Porcelain Mask", mark: "O", color: "#d3d0c7", desc: "Absorb one hit. Reforms at each new floor.", price: 10 },
  { id: "magnet-child", name: "Magnet Child", mark: "A", color: "#cd8d70", desc: "Coins, keys and hearts drift toward you.", price: 8 },
  { id: "quickening", name: "Quickening", mark: "Q", color: "#e4b3bf", desc: "Fire tears 22% faster.", price: 9 },
  { id: "brimstone", name: "Brimstone Shard", mark: "V", color: "#ee7062", desc: "Tears pierce one foe and burn hotter.", price: 10 },
  { id: "nine-lives", name: "Nine Lives", mark: "9", color: "#a6a0c9", desc: "Return from death once with two hearts.", price: 11 },
  { id: "parasite-egg", name: "Parasite Egg", mark: "X", color: "#bbd184", desc: "Foes burst into two smaller searching tears.", price: 9 },
  { id: "mimic-fang", name: "Mimic Fang", mark: "T", color: "#dda86c", desc: "A better chance to find coins and hearts.", price: 8 },
  { id: "bone-spool", name: "Bone Spool", mark: "N", color: "#d4cec0", desc: "Every fourth tear carries extra force.", price: 8 },
];

const ENEMY_DEFS = {
  husk: { name: "Husk", r: 13, hp: 3, speed: 72, color: "#a8a28f", score: 10 },
  gnat: { name: "Grave Gnat", r: 9, hp: 1.5, speed: 132, color: "#c9a780", score: 12 },
  brute: { name: "Mourner", r: 18, hp: 8, speed: 48, color: "#9a726d", score: 18 },
  spitter: { name: "Spore Spitter", r: 13, hp: 3.7, speed: 48, color: "#a4b779", score: 16 },
  charger: { name: "Red Runner", r: 13, hp: 4.5, speed: 66, color: "#db7963", score: 17 },
  leaper: { name: "Pale Leaper", r: 12, hp: 3.3, speed: 62, color: "#baa8c7", score: 17 },
  wraith: { name: "Mourning Wraith", r: 14, hp: 3.6, speed: 72, color: "#809ead", score: 20 },
  turret: { name: "Bell Totem", r: 15, hp: 4.8, speed: 0, color: "#d2a05e", score: 18 },
  shield: { name: "Shell Acolyte", r: 15, hp: 6, speed: 54, color: "#92a6a0", score: 20 },
  bomber: { name: "Powder Imp", r: 12, hp: 3.4, speed: 104, color: "#d98050", score: 17 },
  blossom: { name: "Rot Bloom", r: 16, hp: 5.4, speed: 24, color: "#9ba960", score: 22 },
};

const BOSSES = [
  { id: "bellower", name: "The Bellower", epithet: "A mouth without a prayer", color: "#cf806c", mark: "B", hp: 48, pattern: "charge" },
  { id: "maw", name: "Maw of Velvet", epithet: "It remembers being held", color: "#a76f9a", mark: "M", hp: 57, pattern: "fan" },
  { id: "bride", name: "The Gilded Bride", epithet: "Something old, something hungry", color: "#d5b673", mark: "G", hp: 62, pattern: "summon" },
  { id: "lantern", name: "Lantern King", epithet: "The wick is almost gone", color: "#e0a55e", mark: "L", hp: 68, pattern: "radial" },
  { id: "knight", name: "The Hollow Knight", epithet: "Armor for an empty thing", color: "#899ca6", mark: "K", hp: 72, pattern: "charge" },
  { id: "bloom", name: "The Bloom", epithet: "A garden beneath the skin", color: "#a4b678", mark: "F", hp: 78, pattern: "bloom" },
  { id: "choir", name: "The Choir Below", epithet: "Many mouths, one song", color: "#84b6b1", mark: "C", hp: 84, pattern: "choir" },
  { id: "crown", name: "The Pale Crown", epithet: "The last light, turned inward", color: "#c2c5e4", mark: "P", hp: 130, pattern: "final" },
];

const DIFFICULTIES = {
  gentle: { name: "Gentle", hp: 0.78, speed: 0.88, damage: 0.75, reward: 0.9, startCoins: 13, desc: "A forgiving descent. More room to learn." },
  veiled: { name: "Veiled", hp: 1, speed: 1, damage: 1, reward: 1, startCoins: 9, desc: "The intended balance. The dark is fair, not kind." },
  revenant: { name: "Revenant", hp: 1.27, speed: 1.14, damage: 1.25, reward: 1.45, startCoins: 5, desc: "Faster, fiercer, richer. No forgiveness." },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (array, random) => array[Math.floor(random() * array.length)];
const coordKey = (x, y) => `${x},${y}`;
const safeJSON = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const safeStorage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* Private browsing can disable storage. */ } },
};

function defaultMeta() {
  return {
    embers: 0, runs: 0, wins: 0, bestFloor: 0, bestKills: 0, bestScore: 0, totalKills: 0,
    upgrades: { vessel: 0, edge: 0, step: 0, purse: 0 },
    unlocked: { stray: true, moth: false, warden: false, wisp: false },
  };
}

function loadMeta() {
  const saved = safeJSON(safeStorage.get(META_KEY) || "", null);
  if (!saved || typeof saved !== "object") return defaultMeta();
  const base = defaultMeta();
  return {
    ...base,
    ...saved,
    embers: Math.max(0, Number(saved.embers) || 0),
    runs: Math.max(0, Number(saved.runs) || 0),
    wins: Math.max(0, Number(saved.wins) || 0),
    bestFloor: clamp(Number(saved.bestFloor) || 0, 0, THEMES.length),
    bestKills: Math.max(0, Number(saved.bestKills) || 0),
    bestScore: Math.max(0, Number(saved.bestScore) || 0),
    totalKills: Math.max(0, Number(saved.totalKills) || 0),
    upgrades: { ...base.upgrades, ...(saved.upgrades || {}) },
    unlocked: { ...base.unlocked, ...(saved.unlocked || {}) },
  };
}

function loadPrefs() {
  const defaults = { difficulty: "veiled", volume: 0.32, muted: false, character: "stray" };
  const saved = safeJSON(safeStorage.get(PREF_KEY) || "", null);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
  return { ...defaults, ...saved };
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

function drawHeartIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.bezierCurveTo(10, 19, 2, 13, 2, 7.5);
  ctx.bezierCurveTo(2, 2.5, 8, 1, 12, 6);
  ctx.bezierCurveTo(16, 1, 22, 2.5, 22, 7.5);
  ctx.bezierCurveTo(22, 13, 14, 19, 12, 21);
  ctx.fill();
  ctx.restore();
}

function AudioEngine() {
  this.context = null;
  this.master = null;
  this.volume = 0.32;
  this.muted = false;
  this.nextNote = 0;
  this.noteIndex = 0;
  this.mood = { floor: 1, boss: false, danger: 0 };
}

AudioEngine.prototype.unlock = function unlock() {
  if (this.context) {
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    context.resume().catch(() => {});
  } catch { this.context = null; }
};

AudioEngine.prototype.setVolume = function setVolume(value) {
  this.volume = clamp(Number(value) || 0, 0, 1);
  if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.035);
};

AudioEngine.prototype.setMuted = function setMuted(value) {
  this.muted = Boolean(value);
  if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
};

AudioEngine.prototype.tone = function tone(frequency, duration, shape, volume, slide) {
  if (!this.context || this.muted) return;
  const context = this.context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = shape || "sine";
  oscillator.frequency.setValueAtTime(Math.max(35, frequency), context.currentTime);
  if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + slide), context.currentTime + duration);
  gain.gain.setValueAtTime(Math.max(0.0001, volume || 0.06), context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(this.master);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.02);
};

AudioEngine.prototype.play = function play(name, strength) {
  if (!this.context || this.muted) return;
  const power = clamp(strength || 1, 0.45, 1.6);
  const sounds = {
    shoot: [490, 0.065, "triangle", 0.024, -100],
    hit: [170, 0.11, "square", 0.045, -70],
    hurt: [110, 0.28, "sawtooth", 0.08, -55],
    kill: [245, 0.12, "triangle", 0.045, 160],
    pickup: [530, 0.24, "sine", 0.055, 360],
    coin: [740, 0.1, "sine", 0.038, 140],
    bomb: [75, 0.46, "sawtooth", 0.12, -40],
    dash: [300, 0.18, "triangle", 0.045, 440],
    door: [180, 0.4, "sine", 0.045, 210],
    boss: [82, 0.62, "sawtooth", 0.08, 34],
    clear: [390, 0.55, "sine", 0.05, 310],
    button: [300, 0.09, "triangle", 0.03, 90],
    damage: [140, 0.18, "square", 0.035, -50],
  };
  const sound = sounds[name];
  if (sound) this.tone(sound[0], sound[1], sound[2], sound[3] * power, sound[4]);
  if (name === "pickup" || name === "clear") this.tone((name === "clear" ? 520 : 790), 0.2, "sine", 0.035 * power, 240);
};

AudioEngine.prototype.update = function update(now, floor, boss, danger) {
  this.mood = { floor, boss, danger };
  if (!this.context || this.muted || now < this.nextNote) return;
  const context = this.context;
  const base = [55, 61.74, 65.41, 73.42, 82.41, 46.25][clamp(floor - 1, 0, 5)];
  const scale = [1, 1.189, 1.414, 1.587, 1.782, 2, 2.378];
  const step = scale[(this.noteIndex * 3 + floor + (boss ? 2 : 0)) % scale.length];
  const frequency = base * step * (boss ? 1.5 : 1);
  const duration = boss ? 0.42 : 0.64;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  osc.type = this.noteIndex % 4 === 0 ? "triangle" : "sine";
  osc.frequency.setValueAtTime(frequency, context.currentTime);
  filter.type = "lowpass";
  filter.frequency.value = boss ? 740 : 480;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.linearRampToValueAtTime((boss ? 0.026 : 0.012) * (1 + danger * 0.35), context.currentTime + 0.055);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(this.master);
  osc.start();
  osc.stop(context.currentTime + duration + 0.02);
  if (boss && this.noteIndex % 2 === 0) this.tone(base * 0.5, 0.45, "sine", 0.025, -4);
  this.noteIndex += 1;
  this.nextNote = now + (boss ? 0.44 : 0.78 + Math.random() * 0.16);
};

export function mountGame(host) {
  const game = new VeilfallGame(host);
  game.mount();
  return () => game.destroy();
}

function VeilfallGame(host) {
  this.host = host;
  this.root = null;
  this.canvas = null;
  this.ctx = null;
  this.overlay = null;
  this.state = "menu";
  this.overlayView = "title";
  this.overlayReturn = null;
  this.meta = loadMeta();
  this.prefs = loadPrefs();
  if (!DIFFICULTIES[this.prefs.difficulty]) this.prefs.difficulty = "veiled";
  const savedVolume = Number(this.prefs.volume ?? 0.32);
  this.prefs.volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : 0.32;
  this.prefs.muted = Boolean(this.prefs.muted);
  this.selectedCharacter = CHARACTERS.some((character) => character.id === this.prefs.character && this.meta.unlocked[character.id]) ? this.prefs.character : "stray";
  this.seedDraft = "";
  this.audio = new AudioEngine();
  this.audio.volume = this.prefs.volume;
  this.audio.muted = this.prefs.muted;
  this.rng = Math.random;
  this.canvasWidth = 0;
  this.canvasHeight = 0;
  this.pixelRatio = 1;
  this.frame = 0;
  this.raf = 0;
  this.lastFrame = 0;
  this.hudClock = 0;
  this.gameClock = 0;
  this.player = null;
  this.run = null;
  this.floorRooms = {};
  this.currentRoom = null;
  this.floorNo = 1;
  this.keys = Object.create(null);
  this.mouse = { x: 0, y: 0, down: false, seen: false };
  this.stick = { x: 0, y: 0, aimX: 0, aimY: 0, firing: false };
  this.gamepadInput = { x: 0, y: 0, aimX: 0, aimY: 0, firing: false };
  this.touchPointers = new Map();
  this.lastLockToast = 0;
  this.lastInteractionHTML = null;
  this.lastAmbientText = "";
  this.particles = [];
  this.texts = [];
  this.floatingToast = [];
  this.toastTimers = [];
  this.nextEntity = 1;
  this.shake = 0;
  this.hitFlash = 0;
  this.roomFade = 0;
  this.damagePulse = 0;
  this.backgroundSeed = Array.from({ length: 55 }, (_, i) => ({ u: (i * 0.618033 + 0.11) % 1, v: (i * 0.37973 + 0.23) % 1, s: 0.4 + ((i * 17) % 10) / 10, a: 0.12 + ((i * 7) % 14) / 100 }));
  this.destroyed = false;
  this.bound = {};
}

VeilfallGame.prototype.mount = function mount() {
  this.host.innerHTML = `
    <div class="veil-game">
      <canvas class="world-canvas" aria-label="Veilfall dungeon game canvas"></canvas>
      <div class="film-grain"></div>
      <header class="topbar">
        <div class="brand-lockup"><div class="brand-sigil" aria-hidden="true"></div><div><div class="brand-name">VEILFALL</div><span class="brand-sub">THE LAST LANTERN</span></div></div>
        <div class="top-center" id="topHeading">The Ossuary<small id="topSubheading">THE FIRST DESCENT</small></div>
        <div class="top-actions"><button class="text-button" data-action="help">Field guide</button><button class="icon-button" data-action="settings" aria-label="Settings">&#9881;</button><button class="icon-button" data-action="pause" aria-label="Pause">&#9208;</button></div>
      </header>
      <section class="hud-left hud-panel health-panel">
        <div class="micro-label">Vessel <span id="hpReadout" style="float:right"></span></div>
        <div class="heart-row" id="heartRow"></div>
        <div class="resource-row"><span class="resource">COIN <b id="coinReadout">0</b></span><span class="resource">KEY <b class="resource-key" id="keyReadout">0</b></span><span class="resource">BOMB <b id="bombReadout">0</b></span></div>
        <div class="relic-strip" id="relicStrip"></div>
      </section>
      <section class="minimap hud-panel" id="miniMap"></section>
      <div class="boss-bar-wrap" id="bossBar"><div class="boss-title" id="bossName"></div><div class="boss-meter"><i id="bossMeter"></i></div></div>
      <div class="room-label" id="roomLabel"><strong>Quiet Room</strong><span>Nothing stirs</span></div>
      <div class="bottom-hud">
        <div class="run-stats">
          <div class="stat-unit">Floor<strong id="floorReadout">01 / 06</strong></div>
          <div class="stat-unit">Time<strong id="timeReadout">00:00</strong></div>
          <div class="stat-unit">Fallen<strong id="killReadout">0</strong></div>
          <div class="stat-unit hide-mobile">Tears<strong id="shotReadout">0</strong></div>
        </div>
        <div class="control-hint"><span class="hint-item"><kbd>WASD</kbd> MOVE</span><span class="hint-item"><kbd>MOUSE</kbd> AIM</span><span class="hint-item"><kbd>CLICK</kbd> TEARS</span><span class="hint-item"><kbd>E</kbd> USE</span></div>
        <div class="hud-cta"><button class="hud-action hide-mobile" data-action="inventory">RELICS <kbd>I</kbd></button><button class="hud-action" data-action="map">MAP <kbd>M</kbd></button><button class="hud-action" data-action="pause">PAUSE <kbd>ESC</kbd></button></div>
      </div>
      <div class="interaction-hint" id="interactionHint"></div>
      <div class="ambient-prompt" id="ambientPrompt">Hold to weep</div>
      <div class="toast-stack" id="toastStack"></div>
      <div class="screen-shade" id="screenShade"></div>
      <div class="touch-controls" id="touchControls">
        <div class="touch-pad" id="touchPad" aria-label="Move"><div class="touch-knob" id="touchKnob"></div></div>
        <button class="touch-action interact" id="touchInteract" aria-label="Interact">USE</button>
        <button class="touch-action dash" id="touchDash" aria-label="Dash">DASH</button>
        <button class="touch-action" id="touchFire" aria-label="Fire">TEARS</button>
      </div>
      <div class="overlay" id="overlay"></div>
    </div>`;

  this.root = this.host.querySelector(".veil-game");
  this.canvas = this.host.querySelector("canvas");
  this.ctx = this.canvas.getContext("2d", { alpha: false });
  this.overlay = this.host.querySelector("#overlay");
  this.cacheNodes();
  this.audio.setVolume(this.prefs.volume);
  this.audio.setMuted(this.prefs.muted);
  this.bindEvents();
  this.resize();
  this.renderOverlay();
  this.updateChrome();
  this.lastFrame = performance.now();
  this.raf = requestAnimationFrame((time) => this.loop(time));
};

VeilfallGame.prototype.cacheNodes = function cacheNodes() {
  const ids = ["topHeading", "topSubheading", "heartRow", "hpReadout", "coinReadout", "keyReadout", "bombReadout", "relicStrip", "miniMap", "bossBar", "bossName", "bossMeter", "roomLabel", "floorReadout", "timeReadout", "killReadout", "shotReadout", "interactionHint", "ambientPrompt", "toastStack", "screenShade", "touchPad", "touchKnob", "touchFire", "touchDash", "touchInteract"];
  this.nodes = {};
  ids.forEach((id) => { this.nodes[id] = this.host.querySelector(`#${id}`); });
};

VeilfallGame.prototype.bindEvents = function bindEvents() {
  this.bound.click = (event) => this.onClick(event);
  this.bound.input = (event) => this.onInput(event);
  this.bound.keydown = (event) => this.onKeyDown(event);
  this.bound.keyup = (event) => this.onKeyUp(event);
  this.bound.resize = () => this.resize();
  this.bound.blur = () => this.clearInput();
  this.bound.visibility = () => {
    if (document.hidden) {
      this.clearInput();
      if (this.state === "playing") this.pauseGame();
    }
  };
  this.bound.pointermove = (event) => this.onPointerMove(event);
  this.bound.pointerdown = (event) => this.onPointerDown(event);
  this.bound.pointerup = (event) => this.onPointerUp(event);
  this.bound.touchPadDown = (event) => this.onTouchPadDown(event);
  this.bound.touchPadMove = (event) => this.onTouchPadMove(event);
  this.bound.touchPadUp = () => this.resetStick();
  this.bound.touchFireDown = (event) => { event.preventDefault(); this.stick.firing = true; this.audio.unlock(); };
  this.bound.touchFireUp = () => { this.stick.firing = false; };
  this.bound.touchDash = (event) => { event.preventDefault(); this.audio.unlock(); this.tryDash(); };
  this.bound.touchInteract = (event) => { event.preventDefault(); this.audio.unlock(); this.interact(); };
  this.bound.context = (event) => event.preventDefault();

  this.root.addEventListener("click", this.bound.click);
  this.root.addEventListener("input", this.bound.input);
  this.canvas.addEventListener("pointermove", this.bound.pointermove);
  this.canvas.addEventListener("pointerdown", this.bound.pointerdown);
  window.addEventListener("pointerup", this.bound.pointerup);
  window.addEventListener("keydown", this.bound.keydown);
  window.addEventListener("keyup", this.bound.keyup);
  window.addEventListener("resize", this.bound.resize);
  window.addEventListener("blur", this.bound.blur);
  document.addEventListener("visibilitychange", this.bound.visibility);
  this.canvas.addEventListener("contextmenu", this.bound.context);
  this.nodes.touchPad.addEventListener("pointerdown", this.bound.touchPadDown);
  this.nodes.touchPad.addEventListener("pointermove", this.bound.touchPadMove);
  this.nodes.touchPad.addEventListener("pointerup", this.bound.touchPadUp);
  this.nodes.touchPad.addEventListener("pointercancel", this.bound.touchPadUp);
  this.nodes.touchFire.addEventListener("pointerdown", this.bound.touchFireDown);
  window.addEventListener("pointerup", this.bound.touchFireUp);
  this.nodes.touchDash.addEventListener("pointerdown", this.bound.touchDash);
  this.nodes.touchInteract.addEventListener("pointerdown", this.bound.touchInteract);
};

VeilfallGame.prototype.destroy = function destroy() {
  this.destroyed = true;
  if (this.raf) cancelAnimationFrame(this.raf);
  this.clearToastTimers();
  if (!this.root) return;
  this.root.removeEventListener("click", this.bound.click);
  this.root.removeEventListener("input", this.bound.input);
  this.canvas.removeEventListener("pointermove", this.bound.pointermove);
  this.canvas.removeEventListener("pointerdown", this.bound.pointerdown);
  window.removeEventListener("pointerup", this.bound.pointerup);
  window.removeEventListener("keydown", this.bound.keydown);
  window.removeEventListener("keyup", this.bound.keyup);
  window.removeEventListener("resize", this.bound.resize);
  window.removeEventListener("blur", this.bound.blur);
  document.removeEventListener("visibilitychange", this.bound.visibility);
  this.canvas.removeEventListener("contextmenu", this.bound.context);
  this.nodes.touchPad.removeEventListener("pointerdown", this.bound.touchPadDown);
  this.nodes.touchPad.removeEventListener("pointermove", this.bound.touchPadMove);
  this.nodes.touchPad.removeEventListener("pointerup", this.bound.touchPadUp);
  this.nodes.touchPad.removeEventListener("pointercancel", this.bound.touchPadUp);
  this.nodes.touchFire.removeEventListener("pointerdown", this.bound.touchFireDown);
  window.removeEventListener("pointerup", this.bound.touchFireUp);
  this.nodes.touchDash.removeEventListener("pointerdown", this.bound.touchDash);
  this.nodes.touchInteract.removeEventListener("pointerdown", this.bound.touchInteract);
  if (this.audio.context) this.audio.context.close().catch(() => {});
};

VeilfallGame.prototype.onClick = function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !this.root.contains(button) || button.tagName === "INPUT") return;
  event.preventDefault();
  this.audio.unlock();
  this.audio.play("button");
  this.handleAction(button.dataset.action, button.dataset.value || "", button);
};

VeilfallGame.prototype.onInput = function onInput(event) {
  const target = event.target;
  if (target.matches("[data-action='volume']")) {
    this.prefs.volume = Number(target.value) / 100;
    this.audio.setVolume(this.prefs.volume);
    this.savePrefs();
    const valueLabel = target.closest(".settings-row")?.querySelector("label span:last-child");
    if (valueLabel) valueLabel.textContent = `${Math.round(this.prefs.volume * 100)}%`;
  }
  if (target.matches("[data-action='seed-input']")) this.seedDraft = target.value.slice(0, 22);
};

VeilfallGame.prototype.onKeyDown = function onKeyDown(event) {
  const tag = event.target && event.target.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable;
  if (typing) {
    if (event.key === "Escape") event.target.blur();
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.target?.closest?.("button")) return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (event.repeat && ["escape", "m", "i", "e", "q", "shift"].includes(key)) return;
  this.keys[key] = true;
  if (key === "escape") {
    if (this.overlayView && this.state === "paused") this.closeOverlay();
    else if (this.state === "playing") this.pauseGame();
    else if (this.overlayView && this.state === "menu" && this.overlayView !== "title") this.closeOverlay();
    return;
  }
  if ((key === "enter" || key === " ") && this.state === "menu" && this.overlayView === "title") {
    this.audio.unlock();
    this.beginRun();
    return;
  }
  if (this.state !== "playing") return;
  if (key === "e") this.interact();
  if (key === "q") this.useBomb();
  if (key === "shift") this.tryDash();
  if (key === "m") this.openOverlay("map");
  if (key === "i") this.openOverlay("inventory");
  if (key === "h") this.openOverlay("help");
};

VeilfallGame.prototype.onKeyUp = function onKeyUp(event) {
  this.keys[event.key.toLowerCase()] = false;
};

VeilfallGame.prototype.clearInput = function clearInput() {
  this.keys = Object.create(null);
  this.mouse.down = false;
  this.stick.firing = false;
  this.resetStick();
};

VeilfallGame.prototype.onPointerMove = function onPointerMove(event) {
  const rect = this.canvas.getBoundingClientRect();
  this.mouse.x = event.clientX - rect.left;
  this.mouse.y = event.clientY - rect.top;
  this.mouse.seen = true;
};

VeilfallGame.prototype.onPointerDown = function onPointerDown(event) {
  if (event.pointerType !== "mouse" || event.button !== 0 || this.state !== "playing") return;
  this.mouse.down = true;
  this.audio.unlock();
  this.canvas.focus?.({ preventScroll: true });
};

VeilfallGame.prototype.onPointerUp = function onPointerUp(event) {
  if (event.button === 0 || event.pointerType !== "mouse") this.mouse.down = false;
};

VeilfallGame.prototype.onTouchPadDown = function onTouchPadDown(event) {
  event.preventDefault();
  this.audio.unlock();
  this.nodes.touchPad.setPointerCapture(event.pointerId);
  this.touchPointers.set(event.pointerId, "move");
  this.onTouchPadMove(event);
};

VeilfallGame.prototype.onTouchPadMove = function onTouchPadMove(event) {
  if (!this.touchPointers.has(event.pointerId)) return;
  const rect = this.nodes.touchPad.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const max = rect.width * 0.34;
  const length = Math.hypot(dx, dy) || 1;
  const ratio = Math.min(1, length / max);
  this.stick.x = (dx / length) * ratio;
  this.stick.y = (dy / length) * ratio;
  this.nodes.touchKnob.style.setProperty("--knob-x", `${this.stick.x * max}px`);
  this.nodes.touchKnob.style.setProperty("--knob-y", `${this.stick.y * max}px`);
};

VeilfallGame.prototype.resetStick = function resetStick() {
  this.touchPointers.clear();
  this.stick.x = 0;
  this.stick.y = 0;
  if (this.nodes.touchKnob) {
    this.nodes.touchKnob.style.setProperty("--knob-x", "0px");
    this.nodes.touchKnob.style.setProperty("--knob-y", "0px");
  }
};

VeilfallGame.prototype.handleAction = function handleAction(action, value, button) {
  switch (action) {
    case "start": this.beginRun(); break;
    case "restart": this.beginRun(); break;
    case "continue": this.returnToTitle(); break;
    case "locker": this.openOverlay("locker"); break;
    case "help": this.openOverlay("help"); break;
    case "settings": this.openOverlay("settings"); break;
    case "pause": if (this.state === "playing") this.pauseGame(); else if (this.state === "paused") this.closeOverlay(); break;
    case "resume": this.closeOverlay(); break;
    case "close-overlay": this.closeOverlay(); break;
    case "map": this.openOverlay("map"); break;
    case "inventory": this.openOverlay("inventory"); break;
    case "difficulty": this.setDifficulty(value); break;
    case "character": this.selectCharacter(value); break;
    case "buy-character": this.buyCharacter(value); break;
    case "buy-upgrade": this.buyUpgrade(value); break;
    case "daily-seed": this.setDailySeed(); break;
    case "daily-start": this.setDailySeed(); this.beginRun(); break;
    case "mute": this.toggleMute(); break;
    case "volume": break;
    case "quit-run": this.returnToTitle(); break;
    case "new-seed": this.seedDraft = ""; this.beginRun(); break;
    default: break;
  }
  if (button && action === "difficulty") this.savePrefs();
};

VeilfallGame.prototype.savePrefs = function savePrefs() {
  this.prefs.character = this.selectedCharacter;
  safeStorage.set(PREF_KEY, JSON.stringify(this.prefs));
};

VeilfallGame.prototype.saveMeta = function saveMeta() {
  safeStorage.set(META_KEY, JSON.stringify(this.meta));
};

VeilfallGame.prototype.setDifficulty = function setDifficulty(value) {
  if (!DIFFICULTIES[value]) return;
  this.prefs.difficulty = value;
  if (this.run) this.run.difficulty = value;
  this.savePrefs();
  if (this.state === "playing" || this.state === "paused") this.toast(`Descent shifted to ${DIFFICULTIES[value].name}.`);
  this.renderOverlay();
  this.updateHUD();
};

VeilfallGame.prototype.toggleMute = function toggleMute() {
  this.prefs.muted = !this.prefs.muted;
  this.audio.setMuted(this.prefs.muted);
  this.savePrefs();
  this.renderOverlay();
};

VeilfallGame.prototype.setDailySeed = function setDailySeed() {
  const date = new Date();
  this.seedDraft = `DAILY-${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const input = this.overlay.querySelector("[data-action='seed-input']");
  if (input) input.value = this.seedDraft;
  this.toast("Today's seed is ready.");
};

VeilfallGame.prototype.openOverlay = function openOverlay(view) {
  if (this.overlayView === view) return;
  this.overlayReturn = { state: this.state, view: this.overlayView };
  if (this.state === "playing") this.state = "paused";
  this.overlayView = view;
  this.renderOverlay();
  this.updateChrome();
};

VeilfallGame.prototype.closeOverlay = function closeOverlay() {
  if (this.overlayReturn) {
    this.state = this.overlayReturn.state === "playing" ? "playing" : this.overlayReturn.state;
    this.overlayView = this.overlayReturn.view;
    this.overlayReturn = null;
  } else if (this.state === "paused") {
    this.state = "playing";
    this.overlayView = null;
  } else if (this.state === "menu") {
    this.overlayView = "title";
  }
  this.renderOverlay();
  this.updateChrome();
};

VeilfallGame.prototype.pauseGame = function pauseGame() {
  if (this.state !== "playing") return;
  this.clearInput();
  this.state = "paused";
  this.overlayView = "pause";
  this.overlayReturn = null;
  this.renderOverlay();
  this.updateChrome();
};

VeilfallGame.prototype.selectCharacter = function selectCharacter(id) {
  if (!CHARACTERS.some((character) => character.id === id) || !this.meta.unlocked[id]) return;
  this.selectedCharacter = id;
  this.savePrefs();
  this.renderOverlay();
};

VeilfallGame.prototype.buyCharacter = function buyCharacter(id) {
  const character = CHARACTERS.find((item) => item.id === id);
  if (!character || this.meta.unlocked[id]) return;
  if ((id === "warden" && this.meta.bestFloor >= 3) || (id === "wisp" && this.meta.wins > 0)) {
    this.meta.unlocked[id] = true;
  } else if ((id === "warden" && this.meta.bestFloor < 3) || (id === "wisp" && this.meta.wins === 0)) {
    if (this.meta.embers < character.cost) return;
    this.meta.embers -= character.cost;
    this.meta.unlocked[id] = true;
  } else {
    if (this.meta.embers < character.cost) return;
    this.meta.embers -= character.cost;
    this.meta.unlocked[id] = true;
  }
  this.selectedCharacter = id;
  this.saveMeta();
  this.savePrefs();
  this.renderOverlay();
}

VeilfallGame.prototype.buyUpgrade = function buyUpgrade(id) {
  const upgrade = UPGRADES.find((item) => item.id === id);
  if (!upgrade) return;
  const rank = Number(this.meta.upgrades[id]) || 0;
  if (rank >= upgrade.max) return;
  const cost = upgrade.cost[rank];
  if (this.meta.embers < cost) return;
  this.meta.embers -= cost;
  this.meta.upgrades[id] = rank + 1;
  this.saveMeta();
  this.renderOverlay();
};

VeilfallGame.prototype.renderOverlay = function renderOverlay() {
  if (!this.overlay) return;
  const views = {
    title: () => this.titleHTML(),
    locker: () => this.lockerHTML(),
    help: () => this.helpHTML(),
    settings: () => this.settingsHTML(),
    pause: () => this.pauseHTML(),
    map: () => this.mapHTML(),
    inventory: () => this.inventoryHTML(),
    dead: () => this.endHTML(false),
    victory: () => this.endHTML(true),
  };
  const html = views[this.overlayView] ? views[this.overlayView]() : "";
  this.overlay.innerHTML = html;
  this.overlay.hidden = !html;
  if (this.overlayView === "title") {
    const input = this.overlay.querySelector("[data-action='seed-input']");
    if (input) input.value = this.seedDraft;
  }
};

VeilfallGame.prototype.difficultyButtonsHTML = function difficultyButtonsHTML() {
  return Object.entries(DIFFICULTIES).map(([id, difficulty]) => `<button class="difficulty-option ${this.prefs.difficulty === id ? "selected" : ""}" data-action="difficulty" data-value="${id}" title="${escapeHTML(difficulty.desc)}">${difficulty.name}</button>`).join("");
};

VeilfallGame.prototype.titleHTML = function titleHTML() {
  const selected = CHARACTERS.find((character) => character.id === this.selectedCharacter) || CHARACTERS[0];
  const lastSeed = this.seedDraft ? escapeHTML(this.seedDraft) : "RANDOM";
  return `<section class="title-screen">
    <div class="title-copy">
      <div class="eyebrow"><i class="eyebrow-dot"></i> A PROCEDURAL ROGUELITE DESCENT</div>
      <div class="hero-sigil" aria-hidden="true"></div>
      <h1 class="title-wordmark">VEIL<span>FALL</span></h1>
      <div class="title-subtitle">The last lantern burns on borrowed time.</div>
      <p class="title-description">Six shifting floors. Relics with strange appetites. A thing at the bottom that remembers your name. Find a way down, and make the dark pay for every step.</p>
      <div class="title-buttons"><button class="primary-button" data-action="start">Begin the descent <kbd>ENTER</kbd></button><button class="secondary-button" data-action="locker">The reliquary</button><button class="secondary-button" data-action="help">Field guide</button></div>
      <div class="difficulty-select"><span class="difficulty-label">Choose your veil</span>${this.difficultyButtonsHTML()}</div>
      <div class="seed-row"><span>Seed</span><input class="seed-input" data-action="seed-input" maxlength="22" aria-label="Optional run seed" placeholder="${lastSeed}"><button class="difficulty-option" data-action="daily-seed">Daily rite</button><span>ENTER FOR RANDOM</span></div>
    </div>
    <aside class="title-art"><div class="title-art-corner">NO. 01 / THE OSSUARY</div><div class="art-copy"><strong>Six floors. One last light.</strong><p>Find keys. Break the rooms. Take what the dead were saving. The things below have been waiting longer than you.</p><div class="art-index">RELICS <b>+</b> RISK <b>+</b> REMEMBRANCE</div></div></aside>
    <div class="menu-footer"><span>SELECTED VESSEL <b>${selected.name}</b></span><span>BEST DESCENT <b>FLOOR ${String(this.meta.bestFloor || 0).padStart(2, "0")} / ${this.meta.bestScore} SCORE</b></span><span>EMBER BANK <b>${this.meta.embers}</b></span></div>
  </section>`;
};

VeilfallGame.prototype.lockerHTML = function lockerHTML() {
  const characterCards = CHARACTERS.map((character) => {
    const unlocked = Boolean(this.meta.unlocked[character.id]);
    const selected = this.selectedCharacter === character.id;
    const earned = (character.id === "warden" && this.meta.bestFloor >= 3) || (character.id === "wisp" && this.meta.wins > 0);
    const canBuy = earned || this.meta.embers >= character.cost;
    const state = unlocked ? (selected ? "SELECTED VESSEL" : "CHOOSE VESSEL") : (earned ? "UNLOCK / HONOR EARNED" : canBuy ? `UNLOCK / ${character.cost} EMBERS` : character.unlock.toUpperCase());
    const action = unlocked ? "character" : "buy-character";
    return `<button class="character-choice ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="${action}" data-value="${character.id}" ${!unlocked && !canBuy ? "disabled" : ""}><div class="character-portrait">${character.mark}</div><strong>${character.name}</strong><span>${character.blurb}</span><div class="choice-state">${state}</div></button>`;
  }).join("");
  const upgradeRows = UPGRADES.map((upgrade) => {
    const rank = Number(this.meta.upgrades[upgrade.id]) || 0;
    const cost = upgrade.cost[rank];
    const maxed = rank >= upgrade.max;
    const disabled = maxed || this.meta.embers < cost;
    return `<div class="upgrade-row"><div class="upgrade-copy"><strong>${upgrade.name} <span style="display:inline;color:#bd9e64">${rank}/${upgrade.max}</span></strong><span>${upgrade.desc}</span></div><button class="upgrade-action" data-action="buy-upgrade" data-value="${upgrade.id}" ${disabled ? "disabled" : ""}>${maxed ? "MAX" : `${cost} EMBER`}</button></div>`;
  }).join("");
  return `<section class="screen-panel">
    <div class="panel-heading"><div><div class="panel-kicker">Sanctuary / Persistent upgrades</div><h2 class="panel-title">The Reliquary</h2><p class="panel-intro">Embers survive a failed descent. Spend them here to ready a different vessel or make every future attempt a little less cruel.</p></div><button class="close-button" data-action="close-overlay" aria-label="Close">x</button></div>
    <div class="character-grid">${characterCards}</div>
    <div class="locker-bottom"><div class="currency-display">Unspent embers<strong>${this.meta.embers}</strong><p class="panel-intro">You carry ${this.meta.runs} descent${this.meta.runs === 1 ? "" : "s"} into the dark. ${this.meta.wins} completed.</p><button class="secondary-button" data-action="start" style="margin-top:12px">Descend as ${selectedName(this.selectedCharacter)}</button></div><div class="upgrade-list">${upgradeRows}</div></div>
    <div class="locker-actions"><button class="secondary-button" data-action="close-overlay">Return to the lantern</button></div>
  </section>`;
};

function selectedName(id) {
  return (CHARACTERS.find((character) => character.id === id) || CHARACTERS[0]).name;
}

VeilfallGame.prototype.helpHTML = function helpHTML() {
  return `<section class="screen-panel">
    <div class="panel-heading"><div><div class="panel-kicker">Field guide / Read by candlelight</div><h2 class="panel-title">How to survive the Veil</h2><p class="panel-intro">A clear room is a safe room. A quiet room is rarely empty. Your run persists only as long as your heart does.</p></div><button class="close-button" data-action="close-overlay" aria-label="Close">x</button></div>
    <div class="help-grid">
      <div class="help-section"><h3>Move, aim, answer</h3><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to move. Point with the mouse and hold <strong>left click</strong> or <kbd>SPACE</kbd> to fire. <kbd>SHIFT</kbd> dashes through danger. On touch, steer the left disc and hold TEARS.</p></div>
      <div class="help-section"><h3>Take what the room offers</h3><p>Move near a relic, shop shelf, altar or floor gate and press <kbd>E</kbd>. Coins, keys and hearts are gathered by walking over them. <kbd>Q</kbd> spends a bomb to blast nearby foes. <kbd>M</kbd> shows the whole floor; <kbd>I</kbd> opens your relic book.</p></div>
      <div class="help-section"><h3>Six floors. Six thresholds.</h3><p>Explore side rooms for a treasure, shop, sacrifice altar and locked vault. Clear the room to unseal its doors. Find and defeat its boss, then claim the lantern gate to descend. Floor six ends at the Pale Crown.</p></div>
      <div class="help-section"><h3>Learn what hunts you</h3><p>Runners telegraph before charging; leapers mark a landing; spitters keep their distance; bell totems fire from the edge. Brutes can split, and powder imps explode. Dash during a tell, not after the hit.</p></div>
      <div class="help-section"><h3>Relics remember each other</h3><p>Relics alter tear shape, speed, damage, survivability and the halls themselves. <strong>Ember Crown + Static Halo</strong> makes flame jump between foes. <strong>Rubber Soul + Long Sight</strong> becomes a long-range ricochet. A red deal costs one heart; an angel room lets you choose one of two gifts.</p></div>
      <div class="help-section"><h3>Keep the flame alive</h3><p>At death, unspent run coins become persistent embers. Upgrade the vessel in the Reliquary; unlock Moth with embers, the Warden by reaching floor three, and Wisp by completing a descent. The seed field lets you replay a floor plan.</p></div>
    </div>
    <div class="menu-bottom-line"><span><kbd>ESC</kbd> Pause at any time</span><i></i><span>Sound and difficulty can be changed mid-descent</span></div>
    <div class="locker-actions"><button class="primary-button" data-action="close-overlay">Understood</button></div>
  </section>`;
};

VeilfallGame.prototype.settingsHTML = function settingsHTML() {
  const inRun = this.state === "paused";
  return `<section class="screen-panel settings-screen">
    <div class="panel-heading"><div><div class="panel-kicker">Sanctuary / Accessibility</div><h2 class="panel-title">Settings</h2><p class="panel-intro">Sound, difficulty and the shape of the dark. Difficulty may be changed at any time; new rooms will answer to it.</p></div><button class="close-button" data-action="close-overlay" aria-label="Close">x</button></div>
    <div class="settings-body">
      <div class="settings-row"><label><span>Descent difficulty</span><span>${this.run ? "CURRENT RUN" : "NEXT RUN"}</span></label><div class="difficulty-select">${this.difficultyButtonsHTML()}</div></div>
      <div class="settings-row"><label for="volume-control"><span>Master volume</span><span>${Math.round(this.prefs.volume * 100)}%</span></label><input id="volume-control" type="range" min="0" max="100" value="${Math.round(this.prefs.volume * 100)}" data-action="volume"></div>
      <div class="settings-row"><button class="secondary-button" data-action="mute">${this.prefs.muted ? "Unmute the lantern" : "Mute all sound"}</button><span style="margin-left:10px;color:#73737a;font-size:8px">Synthesized ambience and effects / Web Audio</span></div>
    </div>
    <div class="locker-actions"><button class="primary-button" data-action="close-overlay">${inRun ? "Return to the descent" : "Return"}</button></div>
  </section>`;
};

VeilfallGame.prototype.pauseHTML = function pauseHTML() {
  return `<section class="screen-panel">
    <div class="panel-heading"><div><div class="panel-kicker">The world waits</div><h2 class="panel-title">Take a breath.</h2><p class="panel-intro">Floor ${this.floorNo} / ${this.currentRoom ? escapeHTML(this.currentRoom.name) : "The Ossuary"} / ${formatTime(this.run?.elapsed || 0)} elapsed</p></div><button class="close-button" data-action="resume" aria-label="Resume">x</button></div>
    <div class="pause-layout">
      <div class="pause-choices"><button class="pause-choice" data-action="resume">Return to the descent <kbd>ESC</kbd></button><button class="pause-choice" data-action="map">Read the floor map <kbd>M</kbd></button><button class="pause-choice" data-action="inventory">Study collected relics <kbd>I</kbd></button><button class="pause-choice" data-action="help">Field guide &amp; controls</button><button class="pause-choice" data-action="settings">Audio and difficulty</button><button class="pause-choice danger" data-action="quit-run">Abandon this descent</button></div>
      <div class="settings-column"><h3>Run so far</h3><div class="settings-row">${this.run?.kills || 0} fallen / ${this.run?.itemsFound || 0} relics / ${this.run?.roomsCleared || 0} rooms</div><div class="settings-row"><label><span>Difficulty</span><span>LIVE</span></label><div class="difficulty-select">${this.difficultyButtonsHTML()}</div></div><div class="settings-row"><label for="volume-control"><span>Volume</span><span>${Math.round(this.prefs.volume * 100)}%</span></label><input id="volume-control" type="range" min="0" max="100" value="${Math.round(this.prefs.volume * 100)}" data-action="volume"></div><button class="secondary-button" data-action="mute">${this.prefs.muted ? "Unmute audio" : "Mute audio"}</button></div>
    </div>
  </section>`;
};

VeilfallGame.prototype.helpMapVisibility = function helpMapVisibility(room) {
  if (!this.run || !room) return false;
  if (room.visited) return true;
  return Object.values(this.floorRooms).some((visited) => visited.visited && Math.abs(visited.x - room.x) + Math.abs(visited.y - room.y) === 1);
};

VeilfallGame.prototype.mapHTML = function mapHTML() {
  const cells = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const room = this.floorRooms[coordKey(x, y)];
      if (!room) { cells.push(`<div class="large-map-cell empty"></div>`); continue; }
      const visible = this.helpMapVisibility(room);
      const seen = room.visited;
      const isCurrent = room === this.currentRoom;
      const roomClass = room.type === "boss" ? "boss" : room.type === "treasure" ? "treasure" : room.type === "shop" ? "shop" : room.type === "devil" ? "devil" : room.type === "angel" ? "angel" : room.type === "vault" ? "locked" : "";
      const glyph = !visible ? "?" : room.type === "boss" ? "!" : room.type === "treasure" ? "*" : room.type === "shop" ? "+" : room.type === "altar" ? "^" : room.type === "devil" ? "D" : room.type === "angel" ? "A" : room.type === "vault" ? "V" : room.type === "start" ? "S" : ".";
      const label = visible ? room.name : "Unknown";
      cells.push(`<div class="large-map-cell ${visible ? "adjacent" : ""} ${seen ? "seen" : ""} ${isCurrent ? "current" : ""} ${roomClass}"><span>${glyph}</span><span class="map-cell-name">${escapeHTML(label)}</span></div>`);
    }
  }
  return `<section class="screen-panel map-panel">
    <div class="panel-heading"><div><div class="panel-kicker">Floor ${String(this.floorNo).padStart(2, "0")} / ${escapeHTML(THEMES[this.floorNo - 1]?.name || "The Ossuary")}</div><h2 class="panel-title">The rooms remember.</h2><p class="panel-intro">Only visited rooms and their immediate neighbors are known. The Crown waits at the top of this map.</p></div><button class="close-button" data-action="close-overlay" aria-label="Close">x</button></div>
    <div class="large-map">${cells.join("")}</div>
    <div class="map-key"><span><b>S</b> Start</span><span><b>*</b> Treasure</span><span><b>+</b> Shop</span><span><b>D/A</b> Deal or gift</span><span><b>V</b> Vault</span><span><b>!</b> Boss</span></div>
    <div class="locker-actions"><button class="primary-button" data-action="close-overlay">Back to the room</button></div>
  </section>`;
};

VeilfallGame.prototype.inventoryHTML = function inventoryHTML() {
  const items = this.player?.items || [];
  const content = items.length ? items.map((id) => {
    const item = ITEMS.find((entry) => entry.id === id);
    if (!item) return "";
    return `<div class="inventory-item"><div class="relic-token" style="color:${item.color};border-color:${item.color}55">${item.mark}</div><div><strong>${item.name}</strong><span>${item.desc}</span></div></div>`;
  }).join("") : `<p class="panel-intro">No relics yet. A treasure room waits somewhere on each floor. Press E beside its pedestal to take what it offers.</p>`;
  const synergies = this.currentSynergies();
  return `<section class="screen-panel">
    <div class="panel-heading"><div><div class="panel-kicker">Vessel / ${this.player ? escapeHTML(this.player.character.name) : "The Stray"}</div><h2 class="panel-title">Relics kept close.</h2><p class="panel-intro">${items.length} found / Damage ${this.player ? this.player.stats.damage.toFixed(2) : "1.00"} / Tears ${this.player ? (1 / this.player.stats.fireDelay).toFixed(1) : "2.9"}/sec / ${this.player ? Math.round(this.player.stats.speed) : 208} pace</p></div><button class="close-button" data-action="close-overlay" aria-label="Close">x</button></div>
    <div class="inventory-grid">${content}</div>
    ${synergies.length ? `<div class="synergy-box"><strong>RESONANCES</strong><br>${synergies.map((line) => escapeHTML(line)).join("<br>")}</div>` : `<div class="synergy-box">Relics change your tears, body and the rooms around you. Some awaken together.</div>`}
    <div class="locker-actions"><button class="primary-button" data-action="close-overlay">Close the relic book</button></div>
  </section>`;
};

VeilfallGame.prototype.endHTML = function endHTML(victory) {
  const run = this.run || { elapsed: 0, kills: 0, roomsVisited: 0, itemsFound: 0, damageDealt: 0, coins: 0, floor: 1, seedLabel: "-" };
  const title = victory ? "The lantern holds." : "The dark takes its due.";
  const line = victory ? "The Pale Crown is quiet. For the first time, the Veil has nothing left to ask of you." : `Your light went out on floor ${String(run.floor || this.floorNo).padStart(2, "0")}. The rooms will be here when you are ready to return.`;
  const sigil = victory ? "V" : "x";
  return `<section class="screen-panel end-panel ${victory ? "victory" : "defeat"}">
    <div class="end-seal">${sigil}</div><div class="panel-kicker">${victory ? "The final threshold" : "Descent concluded"}</div><h1>${title}</h1><p class="end-lede">${line}</p>
    <div class="end-stats"><div class="end-stat"><span>Time in the Veil</span><strong>${formatTime(run.elapsed)}</strong></div><div class="end-stat"><span>Foes fallen</span><strong>${run.kills}</strong></div><div class="end-stat"><span>Rooms opened</span><strong>${run.roomsVisited}</strong></div><div class="end-stat"><span>Relics kept</span><strong>${run.itemsFound}</strong></div><div class="end-stat"><span>Bosses fallen</span><strong>${run.bossesDefeated || 0} / 6</strong></div><div class="end-stat"><span>Damage dealt</span><strong>${Math.round(run.damageDealt)}</strong></div><div class="end-stat"><span>Final score</span><strong>${Math.floor(run.score || 0)}</strong></div><div class="end-stat"><span>Seed</span><strong style="font-size:10px;letter-spacing:.08em">${escapeHTML(run.seedLabel || "- ")}</strong></div></div>
    <div class="end-reward">${victory ? "The Reliquary remembers your name." : ""} +${run.banked || 0} EMBERS RETURN TO THE SANCTUARY</div>
    <div class="end-actions"><button class="primary-button" data-action="restart">${victory ? "Descend again" : "Try again"}</button><button class="secondary-button" data-action="continue">Return to the lantern</button></div>
  </section>`;
};

VeilfallGame.prototype.beginRun = function beginRun() {
  this.audio.unlock();
  this.clearInput();
  this.clearToastTimers();
  if (this.nodes?.toastStack) this.nodes.toastStack.innerHTML = "";
  this.lastInteractionHTML = null;
  this.lastAmbientText = "";
  this.gameClock = 0;
  this.frame = 0;
  const customSeed = this.seedDraft.trim();
  const seedLabel = customSeed || `VEIL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  this.rng = makeRng(hashSeed(seedLabel));
  this.particles.length = 0;
  this.texts.length = 0;
  this.shake = 0;
  this.hitFlash = 0;
  this.damagePulse = 0;
  this.floorNo = 1;
  this.nextEntity = 1;
  const character = CHARACTERS.find((entry) => entry.id === this.selectedCharacter) || CHARACTERS[0];
  const difficulty = DIFFICULTIES[this.prefs.difficulty] || DIFFICULTIES.veiled;
  this.run = {
    seedLabel,
    seed: hashSeed(seedLabel),
    difficulty: this.prefs.difficulty,
    elapsed: 0,
    kills: 0,
    shots: 0,
    damageDealt: 0,
    damageTaken: 0,
    roomsVisited: 0,
    roomsCleared: 0,
    itemsFound: 0,
    bossesDefeated: 0,
    floor: 1,
    coins: difficulty.startCoins + (Number(this.meta.upgrades.purse) || 0) * 7,
    banked: 0,
    ended: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    roomKills: 0,
    seedDate: null,
  };
  this.player = {
    character,
    x: this.canvasWidth * 0.5,
    y: this.canvasHeight * 0.52,
    r: 13,
    hp: 0,
    maxHp: 0,
    keys: character.id === "warden" ? 3 : 2,
    bombs: 1,
    items: [],
    invuln: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashX: 1,
    dashY: 0,
    fireCooldown: 0,
    fireCount: 0,
    facing: 0,
    shield: 0,
    extraLives: 0,
    hurtCooldown: 0,
    footstep: 0,
    poisonTime: 0,
    burnTime: 0,
    knockX: 0,
    knockY: 0,
    stats: null,
  };
  this.player.stats = this.computeStats();
  this.player.maxHp = this.player.stats.maxHp;
  this.player.hp = this.player.maxHp;
  this.player.extraLives = 0;
  this.run.coins += 0;
  this.meta.runs += 1;
  this.saveMeta();
  this.savePrefs();
  this.state = "playing";
  this.overlayView = null;
  this.overlayReturn = null;
  this.root.classList.add("in-run");
  this.buildFloor(1, true);
  this.renderOverlay();
  this.updateChrome();
  this.updateHUD();
  this.toast(`A new descent begins. ${character.name} carries ${this.run.coins} coins.`);
  this.audio.play("door");
};

VeilfallGame.prototype.computeStats = function computeStats() {
  const player = this.player;
  const character = player?.character || CHARACTERS[0];
  const has = (id) => Boolean(player?.items?.includes(id));
  const rank = (id) => Number(this.meta.upgrades[id]) || 0;
  const synergies = this.synergyIds();
  const difficulty = DIFFICULTIES[this.run?.difficulty || this.prefs.difficulty] || DIFFICULTIES.veiled;
  let damage = character.damage + rank("edge") * 0.12;
  let speed = character.speed * (1 + rank("step") * 0.08);
  let fireDelay = character.fireDelay;
  let maxHp = character.maxHp + rank("vessel") * 2;
  let shots = has("cat-eye") ? 2 : 1;
  let range = 500;
  let shotSpeed = 550;
  let bounce = has("rubber-soul") ? 1 : 0;
  let pierce = has("brimstone") ? 1 : 0;
  let chain = has("static-halo") ? 1 : 0;
  let burn = has("ember-crown") ? 0.3 : 0;
  let poison = has("widow-thread") ? 0.27 : 0;
  let magnet = has("magnet-child") ? 125 : 0;
  let enemySlow = has("pocket-watch") ? 0.14 : 0;
  let discount = has("black-candle") ? 0.15 : 0;
  let burnDamage = has("brimstone") ? 0.7 : 0.42;
  let tearSize = 4.1;
  let luck = has("mimic-fang") ? 0.15 : 0;
  if (has("glass-heart")) damage += 0.45;
  if (has("moonstone")) speed *= 1.12;
  if (has("heart-vessel")) maxHp += 2;
  if (has("long-sight")) { range *= 1.38; shotSpeed *= 1.14; }
  if (has("quickening")) fireDelay *= 0.78;
  if (has("parasite-egg")) shots += 1;
  if (has("bone-spool")) damage += 0.04;
  if (has("brimstone")) { damage += 0.2; tearSize += 1.1; }
  if (has("mimic-fang")) luck += 0.12;
  if (synergies.includes("starfire")) { chain += 1; burn += 0.2; }
  if (synergies.includes("ricochet")) { shots += 1; bounce += 2; }
  if (synergies.includes("blood-bloom")) { poison += 0.18; damage += 0.12; }
  if (synergies.includes("black-sun")) pierce += 1;
  if (character.id === "wisp") chain += 1;
  return {
    damage,
    speed: speed,
    fireDelay: Math.max(0.14, fireDelay),
    maxHp,
    shots,
    range,
    shotSpeed,
    bounce,
    pierce,
    chain,
    burn,
    poison,
    magnet,
    enemySlow,
    discount,
    burnDamage,
    tearSize,
    luck,
    shade: has("black-candle") ? "#d7b56e" : has("brimstone") ? "#f27462" : character.color,
    wisp: character.id === "wisp",
  };
};

VeilfallGame.prototype.synergyIds = function synergyIds() {
  const items = new Set(this.player?.items || []);
  const result = [];
  if (items.has("ember-crown") && items.has("static-halo")) result.push("starfire");
  if (items.has("rubber-soul") && items.has("long-sight")) result.push("ricochet");
  if (items.has("widow-thread") && items.has("parasite-egg")) result.push("blood-bloom");
  if (items.has("brimstone") && items.has("black-candle")) result.push("black-sun");
  if (items.has("heart-vessel") && items.has("feast-bell")) result.push("full-belly");
  return result;
};

VeilfallGame.prototype.currentSynergies = function currentSynergies() {
  const names = {
    starfire: "Starfire: burning tears chain lightning between nearby foes.",
    ricochet: "Long Ricochet: add a third tear and two extra bounces.",
    "blood-bloom": "Blood Bloom: poisoned foes take heavier damage over time.",
    "black-sun": "Black Sun: brimstone tears pierce one additional enemy.",
    "full-belly": "Full Belly: the Feast Bell restores a heart after every cleared room.",
  };
  return this.synergyIds().map((id) => names[id]);
};

VeilfallGame.prototype.buildFloor = function buildFloor(depth, isNewRun) {
  this.floorNo = clamp(depth, 1, THEMES.length);
  this.run.floor = this.floorNo;
  this.run.roomKills = 0;
  this.floorBoss = this.chooseBoss(this.floorNo);
  this.meta.bestFloor = Math.max(this.meta.bestFloor, this.floorNo);
  if (this.meta.bestFloor >= 3) this.meta.unlocked.warden = true;
  this.saveMeta();
  this.floorRooms = this.generateFloorMap();
  const start = this.floorRooms[coordKey(2, 4)] || Object.values(this.floorRooms).find((room) => room.type === "start");
  this.currentRoom = start;
  const bounds = this.getBounds();
  this.player.x = (bounds.left + bounds.right) * 0.5;
  this.player.y = (bounds.top + bounds.bottom) * 0.5;
  this.player.invuln = isNewRun ? 0.4 : 1.1;
  this.player.shield = this.player.items.includes("porcelain-mask") ? 1 : 0;
  this.player.fireCooldown = 0;
  this.player.dashCooldown = 0;
  this.currentRoom.visited = true;
  this.prepareRoom(this.currentRoom, "center");
  this.roomFade = 0.75;
  this.audio.noteIndex = 0;
  this.audio.nextNote = 0;
  this.updateHUD();
};

VeilfallGame.prototype.chooseBoss = function chooseBoss(depth) {
  const pools = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [7]];
  return BOSSES[pick(pools[clamp(depth - 1, 0, pools.length - 1)], this.rng)];
};

VeilfallGame.prototype.generateFloorMap = function generateFloorMap() {
  const rooms = {};
  const add = (x, y, type) => {
    const key = coordKey(x, y);
    if (!rooms[key]) rooms[key] = { x, y, type: type || "normal", name: "", visited: false, entered: false, cleared: false, locked: false, mainPath: false, props: [], hazards: [], objects: [], enemies: [], shots: [], coinsCollected: 0, seed: Math.floor(this.rng() * 100000) };
    if (type) rooms[key].type = type;
    return rooms[key];
  };
  const markPath = (x, y, type) => {
    const room = add(x, y, type);
    room.mainPath = true;
    return room;
  };
  markPath(2, 4, "start");
  const turnY = 1 + Math.floor(this.rng() * 3);
  const sideX = this.rng() < 0.5 ? 1 : 3;
  for (let y = 3; y >= turnY; y -= 1) markPath(2, y);
  markPath(sideX, turnY);
  for (let y = turnY - 1; y >= 0; y -= 1) markPath(sideX, y);
  markPath(2, 0, "boss");

  const mainRooms = Object.values(rooms).filter((room) => room.y < 4 && room.type !== "boss");
  const desired = 8 + Math.floor(this.rng() * 4);
  let attempts = 0;
  while (Object.keys(rooms).length < desired && attempts < 80) {
    attempts += 1;
    const parents = Object.values(rooms).filter((room) => room.type !== "boss" && room.y > 0);
    const parent = pick(parents.length ? parents : mainRooms, this.rng);
    if (!parent) break;
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      const x = parent.x + dx;
      const y = parent.y + dy;
      return x >= 0 && x < 5 && y >= 0 && y < 5 && !(x === 2 && y === 0) && !rooms[coordKey(x, y)] && y > 0;
    });
    if (!options.length) continue;
    let [dx, dy] = pick(options, this.rng);
    let x = parent.x + dx;
    let y = parent.y + dy;
    add(x, y);
    if (Object.keys(rooms).length >= desired || this.rng() < 0.28) continue;
    const branchLength = this.rng() < 0.55 ? 1 : 2;
    for (let step = 0; step < branchLength && Object.keys(rooms).length < desired; step += 1) {
      const nextOptions = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([nx, ny]) => {
        const tx = x + nx;
        const ty = y + ny;
        return tx >= 0 && tx < 5 && ty > 0 && ty < 5 && !(tx === 2 && ty === 0) && !rooms[coordKey(tx, ty)];
      });
      if (!nextOptions.length) break;
      [dx, dy] = pick(nextOptions, this.rng);
      x += dx;
      y += dy;
      add(x, y);
    }
  }

  const candidates = Object.values(rooms).filter((room) => room.type === "normal" && room.y !== 4);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(this.rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const specials = ["treasure", "shop", "altar"];
  if (this.floorNo >= 2) specials.push(this.rng() < 0.5 ? "devil" : "angel");
  if (this.floorNo >= 3) specials.push("vault");
  if (this.floorNo >= 4) specials.push("challenge");
  specials.forEach((type) => {
    let available = candidates.filter((room) => room.type === "normal");
    if (type === "vault") available = available.filter((room) => !room.mainPath);
    const room = pick(available, this.rng);
    if (room) room.type = type;
  });
  const names = ["The Quiet Room", "A Shallow Grave", "The Dust Parlour", "The Unlit Niche", "Chamber of Last Words", "The Salt Cell", "A Small Ruin"];
  Object.values(rooms).forEach((room) => {
    const nameByType = { start: "Ash Door", boss: BOSSES[this.floorNo - 1]?.name || "The Threshold", treasure: "Reliquary", shop: "The Candle Stall", altar: "The Red Altar", devil: "The Red Bargain", angel: "The Quiet Gift", vault: "Locked Reliquary", challenge: "The Trial" };
    room.name = nameByType[room.type] || pick(names, this.rng);
    if (room.type === "boss") room.name = this.floorBoss?.name || room.name;
    if (room.type === "vault") room.locked = true;
  });
  return rooms;
};

VeilfallGame.prototype.getBounds = function getBounds() {
  const w = Math.max(320, this.canvasWidth || window.innerWidth || 960);
  const h = Math.max(360, this.canvasHeight || window.innerHeight || 600);
  const roomWidth = Math.min(w - Math.max(54, w * 0.07) * 2, Math.max(320, (h - 215) * 1.88));
  const left = (w - roomWidth) / 2;
  const top = Math.max(100, h * 0.145);
  const bottom = Math.max(top + 210, h - Math.max(105, h * 0.13));
  return { left, right: left + roomWidth, top, bottom, width: roomWidth, height: bottom - top, centerX: w / 2, centerY: (top + bottom) / 2 };
};

VeilfallGame.prototype.prepareRoom = function prepareRoom(room, entry) {
  if (!room) return;
  room.visited = true;
  if (!room.entered) {
    room.entered = true;
    this.run.roomsVisited += 1;
    room.props = this.makeRoomProps(room);
    room.hazards = this.makeRoomHazards(room);
    if (room.type === "boss") {
      const boss = this.floorBoss || BOSSES[BOSSES.length - 1];
      this.spawnEnemy("boss", room, null, boss);
      room.cleared = false;
      this.audio.play("boss");
      this.toast(`${boss.name} blocks the threshold.`);
    } else if (room.type === "treasure") {
      const item = this.randomAvailableItem();
      room.objects.push({ kind: "item", itemId: item.id, x: this.getBounds().centerX, y: this.getBounds().centerY + 16, taken: false });
      room.cleared = true;
    } else if (room.type === "shop") {
      this.makeShop(room);
      room.cleared = true;
    } else if (room.type === "altar") {
      room.objects.push({ kind: "altar", x: this.getBounds().centerX, y: this.getBounds().centerY, taken: false });
      room.cleared = true;
    } else if (room.type === "devil") {
      const item = this.randomAvailableItem();
      room.objects.push({ kind: "devil-deal", itemId: item.id, x: this.getBounds().centerX, y: this.getBounds().centerY, taken: false });
      room.cleared = true;
    } else if (room.type === "angel") {
      const first = this.randomAvailableItem();
      const second = this.randomAvailableItem();
      const bounds = this.getBounds();
      room.objects.push({ kind: "angel-item", itemId: first.id, x: bounds.centerX - 47, y: bounds.centerY, taken: false, offer: 1 });
      room.objects.push({ kind: "angel-item", itemId: second.id, x: bounds.centerX + 47, y: bounds.centerY, taken: false, offer: 2 });
      room.cleared = true;
    } else if (room.type === "vault" || room.type === "challenge") {
      const count = room.type === "challenge" ? 3 + Math.floor(this.floorNo * 0.45) : 2 + Math.floor(this.floorNo * 0.38);
      for (let i = 0; i < count; i += 1) this.spawnRandomEnemy(room, true);
      room.cleared = false;
    } else {
      const base = room.type === "start" ? 2 : 1 + Math.floor(this.floorNo * 0.58);
      const count = Math.min(6, base + (this.rng() < 0.42 ? 1 : 0));
      for (let i = 0; i < count; i += 1) this.spawnRandomEnemy(room, false);
      room.cleared = room.enemies.length === 0;
    }
    if (!room.enemies.length && room.type !== "boss" && room.type !== "treasure" && room.type !== "shop" && room.type !== "altar") room.cleared = true;
  }
  if (entry && entry !== "center") this.positionAtDoor(entry);
  this.updateHUD();
};

VeilfallGame.prototype.makeRoomProps = function makeRoomProps(room) {
  const bounds = this.getBounds();
  const props = [];
  const count = room.type === "boss" ? 2 : 2 + Math.floor(this.rng() * 3);
  for (let i = 0; i < count; i += 1) {
    let x = bounds.centerX;
    let y = bounds.centerY;
    let attempts = 0;
    while (attempts < 16) {
      attempts += 1;
      x = bounds.left + 58 + this.rng() * Math.max(8, bounds.width - 116);
      y = bounds.top + 64 + this.rng() * Math.max(8, bounds.height - 128);
      if (Math.hypot(x - bounds.centerX, y - bounds.centerY) > 90 && Math.abs(y - bounds.centerY) > 56 && Math.abs(x - bounds.centerX) > 56) break;
    }
    props.push({ x, y, r: 15 + this.rng() * 7, kind: this.rng() < 0.55 ? "pillar" : "urn", hue: Math.floor(this.rng() * 3), hp: 1 });
  }
  return props;
};

VeilfallGame.prototype.makeRoomHazards = function makeRoomHazards(room) {
  if (this.floorNo === 1 || ["treasure", "shop", "altar", "devil", "angel"].includes(room.type)) return [];
  const amount = room.type === "boss" ? 2 : 1 + (this.floorNo >= 4 && this.rng() < 0.45 ? 1 : 0);
  const bounds = this.getBounds();
  const hazards = [];
  for (let i = 0; i < amount; i += 1) {
    let x = bounds.centerX;
    let y = bounds.centerY;
    let tries = 0;
    while (tries < 20) {
      tries += 1;
      x = bounds.left + 50 + this.rng() * Math.max(12, bounds.width - 100);
      y = bounds.top + 54 + this.rng() * Math.max(12, bounds.height - 108);
      if (Math.hypot(x - bounds.centerX, y - bounds.centerY) > 90) break;
    }
    const kind = this.floorNo === 2 ? "ember" : this.floorNo === 3 ? "pool" : this.floorNo === 4 ? "shard" : this.floorNo === 5 ? "spore" : "void";
    hazards.push({ x, y, r: 25 + this.rng() * 13, kind, clock: this.rng() * 2, damageClock: 0 });
  }
  return hazards;
};

VeilfallGame.prototype.makeShop = function makeShop(room) {
  const bounds = this.getBounds();
  const items = [this.randomAvailableItem(), this.randomAvailableItem()];
  const centers = [bounds.centerX - Math.min(75, bounds.width * 0.2), bounds.centerX + Math.min(75, bounds.width * 0.2)];
  items.forEach((item, index) => {
    if (index === 1 && item.id === items[0].id) item = this.randomAvailableItem();
    const cost = Math.max(3, Math.round(item.price * (1 - this.player.stats.discount)));
    room.objects.push({ kind: "shop-item", itemId: item.id, x: centers[index], y: bounds.centerY - 12, cost, taken: false });
  });
  room.objects.push({ kind: "shop-heart", x: bounds.centerX, y: bounds.centerY + 90, cost: 5, taken: false });
  room.objects.push({ kind: "shop-bomb", x: bounds.centerX + Math.min(122, bounds.width * 0.36), y: bounds.centerY + 90, cost: 4, taken: false });
};

VeilfallGame.prototype.randomAvailableItem = function randomAvailableItem() {
  const held = new Set(this.player?.items || []);
  const available = ITEMS.filter((item) => !held.has(item.id));
  return pick(available.length ? available : ITEMS, this.rng);
};

VeilfallGame.prototype.spawnRandomEnemy = function spawnRandomEnemy(room, elite) {
  const pools = [
    ["husk", "gnat", "spitter"],
    ["husk", "gnat", "spitter", "charger", "leaper"],
    ["husk", "gnat", "brute", "spitter", "charger", "leaper", "wraith"],
    ["brute", "spitter", "charger", "leaper", "wraith", "turret", "shield", "bomber"],
    ["brute", "spitter", "charger", "leaper", "wraith", "turret", "shield", "bomber", "blossom"],
    ["brute", "spitter", "charger", "leaper", "wraith", "turret", "shield", "bomber", "blossom"],
  ];
  const type = pick(pools[clamp(this.floorNo - 1, 0, pools.length - 1)], this.rng);
  this.spawnEnemy(type, room, null, null, elite);
};

VeilfallGame.prototype.spawnEnemy = function spawnEnemy(type, room, at, bossDef, elite) {
  const bounds = this.getBounds();
  const definition = ENEMY_DEFS[type] || ENEMY_DEFS.husk;
  let x = at?.x || bounds.centerX;
  let y = at?.y || bounds.centerY;
  if (!at) {
    let attempts = 0;
    while (attempts < 30) {
      attempts += 1;
      x = bounds.left + 48 + this.rng() * Math.max(10, bounds.width - 96);
      y = bounds.top + 48 + this.rng() * Math.max(10, bounds.height - 96);
      const playerDistance = this.player ? Math.hypot(x - this.player.x, y - this.player.y) : 200;
      if (playerDistance > 130 && !(Math.abs(y - bounds.centerY) < 30 && Math.abs(x - bounds.centerX) < 50)) break;
    }
  }
  const difficulty = DIFFICULTIES[this.run.difficulty] || DIFFICULTIES.veiled;
  const depthScale = 1 + (this.floorNo - 1) * 0.125;
  const baseHp = bossDef ? bossDef.hp + (this.floorNo - 1) * 6 : definition.hp;
  const bossScale = bossDef ? (this.floorNo === 6 ? 1 : 0.9 + this.floorNo * 0.04) : 1;
  const e = {
    entityId: this.nextEntity++, type, bossDef, name: bossDef?.name || definition.name,
    x, y, vx: 0, vy: 0, r: bossDef ? (this.floorNo === 6 ? 37 : 31) : definition.r,
    hp: baseHp * difficulty.hp * depthScale * bossScale * (elite ? 1.75 : 1),
    maxHp: baseHp * difficulty.hp * depthScale * bossScale * (elite ? 1.75 : 1),
    speed: (bossDef ? 54 + this.floorNo * 5 : definition.speed) * difficulty.speed * (elite ? 1.12 : 1),
    color: bossDef?.color || definition.color, score: bossDef ? 180 + this.floorNo * 20 : definition.score,
    elite: Boolean(elite), flash: 0, hitClock: 0, shootClock: 0.8 + this.rng() * 1.4,
    state: "idle", stateClock: 0, attackClock: bossDef ? 1.4 + this.rng() * 1.2 : 1.1 + this.rng() * 1.8,
    facingX: 1, facingY: 0, wobble: this.rng() * Math.PI * 2, born: this.gameClock,
    poison: 0, burn: 0, phase: 1, wave: this.rng() * 4, armor: 0,
    bossSequence: 0, summoned: false, dead: false,
  };
  if (type === "shield") e.armor = 0.62;
  if (bossDef?.id === "bride") e.armor = 0.35;
  room.enemies.push(e);
  return e;
};

VeilfallGame.prototype.neighbors = function neighbors(room) {
  if (!room) return {};
  return {
    left: this.floorRooms[coordKey(room.x - 1, room.y)],
    right: this.floorRooms[coordKey(room.x + 1, room.y)],
    up: this.floorRooms[coordKey(room.x, room.y - 1)],
    down: this.floorRooms[coordKey(room.x, room.y + 1)],
  };
};

VeilfallGame.prototype.positionAtDoor = function positionAtDoor(entrySide) {
  const bounds = this.getBounds();
  const p = this.player;
  const offset = 30;
  if (entrySide === "left") { p.x = bounds.left + offset; p.y = bounds.centerY; }
  else if (entrySide === "right") { p.x = bounds.right - offset; p.y = bounds.centerY; }
  else if (entrySide === "up") { p.x = bounds.centerX; p.y = bounds.top + offset; }
  else if (entrySide === "down") { p.x = bounds.centerX; p.y = bounds.bottom - offset; }
  else { p.x = bounds.centerX; p.y = bounds.centerY; }
};

VeilfallGame.prototype.tryEnterRoom = function tryEnterRoom(direction) {
  const next = this.neighbors(this.currentRoom)[direction];
  if (!next || !this.currentRoom.cleared) return false;
  if (next.locked) {
    if (this.player.keys < 1) {
      if (this.gameClock - this.lastLockToast > 1.1) {
        this.toast("The vault is sealed. Find a key.");
        this.lastLockToast = this.gameClock;
      }
      this.player.x = direction === "left" ? this.getBounds().left + this.player.r : direction === "right" ? this.getBounds().right - this.player.r : this.player.x;
      this.player.y = direction === "up" ? this.getBounds().top + this.player.r : direction === "down" ? this.getBounds().bottom - this.player.r : this.player.y;
      return false;
    }
    this.player.keys -= 1;
    next.locked = false;
    this.toast("A key turns. The vault opens.");
    this.audio.play("pickup");
  }
  this.currentRoom.shots = [];
  const entry = { left: "right", right: "left", up: "down", down: "up" }[direction];
  this.currentRoom = next;
  this.currentRoom.visited = true;
  this.player.dashCooldown = Math.max(0, this.player.dashCooldown - 0.45);
  this.positionAtDoor(entry);
  this.prepareRoom(this.currentRoom, entry);
  this.particles.push({ x: this.player.x, y: this.player.y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: THEMES[this.floorNo - 1].glow, size: 34, ring: true });
  this.roomFade = 0.5;
  this.audio.play("door");
  this.updateHUD();
  return true;
};

VeilfallGame.prototype.findInteractable = function findInteractable() {
  if (!this.currentRoom || !this.player) return null;
  let found = null;
  let best = Infinity;
  for (const object of this.currentRoom.objects) {
    if (object.taken || ["coin", "heart", "key", "bomb"].includes(object.kind)) continue;
    const d = distance(this.player, object);
    if (d < best && d < this.player.r + (object.r || 40)) { found = object; best = d; }
  }
  return found;
};

VeilfallGame.prototype.interactionLabel = function interactionLabel(object) {
  if (!object) return "";
  if (object.kind === "item") {
    const item = ITEMS.find((entry) => entry.id === object.itemId);
    return `<kbd>E</kbd>Take ${escapeHTML(item?.name || "the relic")}`;
  }
  if (object.kind === "shop-item") {
    const item = ITEMS.find((entry) => entry.id === object.itemId);
    return `<kbd>E</kbd>Buy ${escapeHTML(item?.name || "relic")} / ${object.cost} coin${object.cost === 1 ? "" : "s"}`;
  }
  if (object.kind === "devil-deal") {
    const item = ITEMS.find((entry) => entry.id === object.itemId);
    return `<kbd>E</kbd>Trade one heart for ${escapeHTML(item?.name || "a relic")}`;
  }
  if (object.kind === "angel-item") {
    const item = ITEMS.find((entry) => entry.id === object.itemId);
    return `<kbd>E</kbd>Accept ${escapeHTML(item?.name || "the gift")} (one only)`;
  }
  if (object.kind === "shop-heart") return `<kbd>E</kbd>Purchase a heart / ${object.cost} coins`;
  if (object.kind === "shop-bomb") return `<kbd>E</kbd>Buy a bomb / ${object.cost} coins`;
  if (object.kind === "altar") return `<kbd>E</kbd>Trade one heart for a relic`;
  if (object.kind === "exit") return this.floorNo === THEMES.length ? `<kbd>E</kbd>Face the final light` : `<kbd>E</kbd>Descend to floor ${this.floorNo + 1}`;
  return `<kbd>E</kbd>Use`;
};

VeilfallGame.prototype.interact = function interact() {
  if (this.state !== "playing" || !this.currentRoom) return;
  const object = this.findInteractable();
  if (!object) return;
  if (object.kind === "item") {
    object.taken = true;
    this.obtainItem(object.itemId);
  } else if (object.kind === "shop-item") {
    if (this.run.coins < object.cost) { this.toast("Not enough coins. The shelf is patient."); return; }
    this.run.coins -= object.cost;
    object.taken = true;
    this.obtainItem(object.itemId);
  } else if (object.kind === "devil-deal") {
    if (this.player.hp <= 2) { this.toast("The bargain would take the last light in this vessel."); return; }
    this.player.hp -= 2;
    this.run.damageTaken += 2;
    object.taken = true;
    this.damagePulse = 0.42;
    this.shake = Math.max(this.shake, 5);
    this.obtainItem(object.itemId, true);
    this.audio.play("hurt");
    this.updateHUD();
  } else if (object.kind === "angel-item") {
    object.taken = true;
    this.currentRoom.objects.forEach((offer) => { if (offer.kind === "angel-item") offer.taken = true; });
    this.obtainItem(object.itemId);
    this.toast("One quiet gift. The other returns to the light.");
  } else if (object.kind === "shop-heart") {
    if (this.run.coins < object.cost) { this.toast("The apothecary wants more coin."); return; }
    if (this.player.hp >= this.player.maxHp) { this.toast("The vessel is already full."); return; }
    this.run.coins -= object.cost;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    object.taken = true;
    this.addParticles(object.x, object.y, "#e78374", 13);
    this.floatText(object.x, object.y - 20, "+1 HEART", "#f0aaa0");
    this.audio.play("pickup");
    this.updateHUD();
  } else if (object.kind === "shop-bomb") {
    if (this.run.coins < object.cost) { this.toast("The apothecary wants more coin."); return; }
    this.run.coins -= object.cost;
    this.player.bombs = Math.min(9, this.player.bombs + 1);
    object.taken = true;
    this.addParticles(object.x, object.y, "#d59267", 12);
    this.floatText(object.x, object.y - 20, "+1 BOMB", "#f0c28f");
    this.audio.play("pickup");
    this.updateHUD();
  } else if (object.kind === "altar") {
    if (object.taken) return;
    if (this.player.hp <= 2) { this.toast("The altar asks more than this vessel can give."); return; }
    this.player.hp -= 2;
    object.taken = true;
    this.run.damageTaken += 2;
    this.damagePulse = 0.5;
    this.shake = Math.max(this.shake, 7);
    this.addParticles(object.x, object.y, "#d76f72", 24);
    this.obtainItem(this.randomAvailableItem().id, true);
    this.audio.play("hurt");
    this.updateHUD();
  } else if (object.kind === "exit") {
    object.taken = true;
    if (this.floorNo >= THEMES.length) this.finishRun(true);
    else {
      const nextFloor = this.floorNo + 1;
      this.toast(`The lantern descends to ${THEMES[nextFloor - 1].name}.`);
      this.buildFloor(nextFloor, false);
      this.updateChrome();
      this.updateHUD();
    }
  }
};

VeilfallGame.prototype.obtainItem = function obtainItem(id, fromAltar) {
  const item = ITEMS.find((entry) => entry.id === id);
  if (!item) return;
  if (this.player.items.includes(id)) {
    this.run.coins += 3;
    this.toast(`${item.name} echoes into three coins.`);
    this.audio.play("coin");
    this.updateHUD();
    return;
  }
  const oldMax = this.player.stats.maxHp;
  this.player.items.push(id);
  this.player.stats = this.computeStats();
  this.player.maxHp = this.player.stats.maxHp;
  this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, this.player.maxHp - oldMax));
  if (id === "porcelain-mask") this.player.shield = Math.max(this.player.shield, 1);
  if (id === "nine-lives") this.player.extraLives = Math.max(this.player.extraLives, 1);
  this.run.itemsFound += 1;
  this.run.score += 40;
  this.addParticles(this.player.x, this.player.y, item.color, 28);
  this.particles.push({ x: this.player.x, y: this.player.y, vx: 0, vy: 0, life: 0.7, max: 0.7, color: item.color, size: 52, ring: true });
  this.floatText(this.player.x, this.player.y - 34, item.name.toUpperCase(), item.color);
  this.toast(fromAltar ? `A heart for ${item.name}.` : `${item.name} joins the vessel.`);
  this.audio.play("pickup", 1.2);
  this.updateHUD();
  this.renderOverlay();
};

VeilfallGame.prototype.collectPickup = function collectPickup(object) {
  if (object.taken) return;
  object.taken = true;
  const text = object.kind === "coin" ? `+${object.amount || 1} COIN${object.amount === 1 ? "" : "S"}` : object.kind === "heart" ? "+1 HEART" : object.kind === "key" ? "+1 KEY" : "+1 BOMB";
  if (object.kind === "coin") {
    this.run.coins += object.amount || 1;
    this.run.score += (object.amount || 1) * 5;
    this.audio.play("coin");
    this.floatText(object.x, object.y - 12, text, "#e9c978");
  } else if (object.kind === "heart") {
    if (this.player.hp >= this.player.maxHp) { object.taken = false; return; }
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + (object.amount || 2));
    this.audio.play("pickup");
    this.floatText(object.x, object.y - 12, text, "#eb8c80");
  } else if (object.kind === "key") {
    this.player.keys = Math.min(9, this.player.keys + 1);
    this.audio.play("pickup");
    this.floatText(object.x, object.y - 12, text, "#9dcab8");
  } else if (object.kind === "bomb") {
    this.player.bombs = Math.min(9, this.player.bombs + 1);
    this.audio.play("pickup");
    this.floatText(object.x, object.y - 12, text, "#d6a06f");
  }
  this.addParticles(object.x, object.y, object.kind === "heart" ? "#df8175" : object.kind === "key" ? "#9dcab8" : "#e8c47a", 8);
  this.updateHUD();
};

VeilfallGame.prototype.dropPickup = function dropPickup(kind, x, y, amount) {
  if (!this.currentRoom) return;
  this.currentRoom.objects.push({ kind, x, y, amount: amount || 1, taken: false, r: 13, born: this.gameClock });
};

VeilfallGame.prototype.onRoomCleared = function onRoomCleared(room) {
  if (!room || room.cleared) return;
  room.cleared = true;
  room.shots = room.shots.filter((shot) => shot.owner === "player");
  this.run.roomsCleared += 1;
  this.run.combo = Math.min(99, this.run.combo + 1);
  this.run.bestCombo = Math.max(this.run.bestCombo, this.run.combo);
  this.shake = Math.max(this.shake, room.type === "boss" ? 8 : 2.5);
  this.audio.play("clear", room.type === "boss" ? 1.3 : 0.8);
  const bounds = this.getBounds();
  if (room.type === "boss") {
    this.run.bossesDefeated += 1;
    this.meta.bestFloor = Math.max(this.meta.bestFloor, this.floorNo);
    if (this.floorNo >= 3) this.meta.unlocked.warden = true;
    this.saveMeta();
    const reward = this.randomAvailableItem();
    room.objects.push({ kind: "item", itemId: reward.id, x: bounds.centerX - 47, y: bounds.centerY + 6, taken: false });
    room.objects.push({ kind: "exit", x: bounds.centerX + 48, y: bounds.centerY + 6, taken: false });
    const rewardScale = DIFFICULTIES[this.run.difficulty]?.reward || 1;
    this.dropPickup("coin", bounds.centerX, bounds.centerY + 74, Math.max(3, Math.round((6 + Math.floor(this.floorNo * 1.4)) * rewardScale)));
    if (this.player.hp < this.player.maxHp) this.dropPickup("heart", bounds.centerX, bounds.centerY + 106, 2);
    this.toast(`${this.floorBoss?.name || "The boss"} falls. The threshold is open.`);
    this.particles.push({ x: bounds.centerX, y: bounds.centerY, vx: 0, vy: 0, life: 0.65, max: 0.65, color: THEMES[this.floorNo - 1].glow, size: 100, ring: true });
  } else if (room.type === "vault" || room.type === "challenge") {
    this.dropPickup("coin", bounds.centerX, bounds.centerY + 28, 4 + this.floorNo);
    if (this.rng() < 0.45 || room.type === "vault") this.dropPickup("key", bounds.centerX - 31, bounds.centerY + 28, 1);
    this.toast(room.type === "vault" ? "The vault has yielded its hoard." : "The trial is survived. The doors are yours.");
    if (room.type === "vault") {
      const item = this.randomAvailableItem();
      room.objects.push({ kind: "item", itemId: item.id, x: bounds.centerX + 34, y: bounds.centerY + 28, taken: false });
    }
  } else {
    const rewardScale = DIFFICULTIES[this.run.difficulty]?.reward || 1;
    const coins = Math.max(1, Math.round((1 + Math.floor(this.rng() * (1 + this.floorNo * 0.35))) * rewardScale));
    this.dropPickup("coin", bounds.centerX + (this.rng() - 0.5) * 32, bounds.centerY + (this.rng() - 0.5) * 30, coins);
    if (this.rng() < 0.17 + this.player.stats.luck * 0.35 && this.player.hp < this.player.maxHp) this.dropPickup("heart", bounds.centerX + (this.rng() - 0.5) * 50, bounds.centerY + 33, 2);
    if (this.rng() < 0.12 + this.player.stats.luck * 0.3) this.dropPickup(this.rng() < 0.55 ? "key" : "bomb", bounds.centerX + 30, bounds.centerY + 25, 1);
    const feastChance = this.synergyIds().includes("full-belly") ? 1 : 0.22;
    if (this.player.items.includes("feast-bell") && this.rng() < feastChance && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.floatText(this.player.x, this.player.y - 30, "THE BELL FEEDS", "#e9cf8b");
    }
    this.toast(`Room cleared / ${this.run.combo} room${this.run.combo === 1 ? "" : "s"} in a row.`);
  }
  this.updateHUD();
};

VeilfallGame.prototype.onEnemyDeath = function onEnemyDeath(enemy) {
  if (!this.currentRoom) return;
  enemy.dead = true;
  this.run.kills += 1;
  this.run.score += enemy.score * (1 + Math.min(2, this.run.combo * 0.06));
  this.run.roomKills += 1;
  this.run.combo += 1;
  this.run.bestCombo = Math.max(this.run.bestCombo, this.run.combo);
  this.addParticles(enemy.x, enemy.y, enemy.color, enemy.bossDef ? 42 : 15);
  this.floatText(enemy.x, enemy.y - enemy.r, `+${enemy.score}`, "#e5c98c");
  this.shake = Math.max(this.shake, enemy.bossDef ? 11 : enemy.elite ? 4 : 1.7);
  this.audio.play(enemy.bossDef ? "boss" : "kill", enemy.bossDef ? 1.2 : 0.75);
  const rewardScale = DIFFICULTIES[this.run.difficulty]?.reward || 1;
  if (!enemy.bossDef && this.rng() < 0.23 + this.player.stats.luck * 0.4) this.dropPickup("coin", enemy.x + (this.rng() - 0.5) * 20, enemy.y + (this.rng() - 0.5) * 20, Math.max(1, Math.round((1 + (this.rng() < 0.13 ? 1 : 0)) * rewardScale)));
  if (!enemy.bossDef && this.rng() < 0.055 + this.player.stats.luck * 0.12 && this.player.hp < this.player.maxHp) this.dropPickup("heart", enemy.x, enemy.y, 2);
  if (enemy.type === "brute" && !enemy.bossDef) {
    for (let i = 0; i < 2; i += 1) this.spawnEnemy("gnat", this.currentRoom, { x: enemy.x + (i ? 14 : -14), y: enemy.y + 8 });
    this.toast("The Mourner breaks apart.");
  }
  if (this.player.items.includes("parasite-egg")) {
    for (let i = 0; i < 2; i += 1) {
      const angle = i * Math.PI + this.rng() * 0.6;
      this.currentRoom.shots.push({ owner: "player", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 230, vy: Math.sin(angle) * 230, r: 3, damage: this.player.stats.damage * 0.35, life: 1.5, range: 300, color: "#b9d17a", bounce: 0, pierce: 0, chain: 0, burn: 0, poison: 0, hits: [] });
    }
  }
  if (enemy.bossDef) {
    this.currentRoom.enemies = this.currentRoom.enemies.filter((entry) => entry !== enemy);
  } else {
    this.currentRoom.enemies = this.currentRoom.enemies.filter((entry) => entry !== enemy);
  }
  if (this.currentRoom.enemies.length === 0) this.onRoomCleared(this.currentRoom);
  this.updateHUD();
};

VeilfallGame.prototype.damageEnemy = function damageEnemy(enemy, amount, shot, chained) {
  if (!enemy || enemy.dead || amount <= 0) return;
  let applied = amount;
  if (enemy.type === "shield" && shot) {
    const shotAngle = Math.atan2(shot.vy, shot.vx);
    const towardPlayer = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const difference = Math.abs(Math.atan2(Math.sin(shotAngle - towardPlayer), Math.cos(shotAngle - towardPlayer)));
    if (difference > Math.PI - 0.82) applied *= 0.12;
  }
  if (enemy.bossDef && enemy.armor > 0 && enemy.phase === 1) applied *= 1 - enemy.armor;
  enemy.hp -= applied;
  enemy.flash = 0.11;
  enemy.hitClock = 0.07;
  const dx = enemy.x - (shot?.x || this.player.x);
  const dy = enemy.y - (shot?.y || this.player.y);
  const length = Math.hypot(dx, dy) || 1;
  if (!enemy.bossDef) { enemy.vx += (dx / length) * Math.min(75, applied * 18); enemy.vy += (dy / length) * Math.min(75, applied * 18); }
  this.run.damageDealt += applied;
  if (!chained && shot) {
    if (shot.burn > 0 && this.rng() < shot.burn) enemy.burn = Math.max(enemy.burn, 2.6);
    if (shot.poison > 0 && this.rng() < shot.poison) enemy.poison = Math.max(enemy.poison, 3.2);
    if (shot.chain > 0) this.chainLightning(enemy, shot.damage * 0.45, shot.color);
  }
  this.addParticles(enemy.x, enemy.y, shot?.color || enemy.color, 3);
  if (enemy.hp <= 0) this.onEnemyDeath(enemy);
};

VeilfallGame.prototype.chainLightning = function chainLightning(origin, damage, color) {
  if (!this.currentRoom) return;
  const target = this.currentRoom.enemies.filter((enemy) => enemy !== origin && !enemy.dead).sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  if (!target || distance(target, origin) > 180) return;
  this.particles.push({ x: origin.x, y: origin.y, tx: target.x, ty: target.y, life: 0.18, max: 0.18, color: color || "#a7e0de", size: 2, line: true });
  this.damageEnemy(target, damage, { x: origin.x, y: origin.y, vx: target.x - origin.x, vy: target.y - origin.y, color: color || "#a7e0de" }, true);
};

VeilfallGame.prototype.takeDamage = function takeDamage(amount, source, knockX, knockY) {
  const p = this.player;
  if (!p || p.invuln > 0 || this.state !== "playing") return false;
  if (p.shield > 0) {
    p.shield -= 1;
    p.invuln = 0.72;
    this.addParticles(p.x, p.y, "#a9d6cd", 20);
    this.floatText(p.x, p.y - 26, "MASK BROKEN", "#b9dfd4");
    this.audio.play("hit");
    this.shake = Math.max(this.shake, 3);
    this.updateHUD();
    return true;
  }
  const difficulty = DIFFICULTIES[this.run.difficulty] || DIFFICULTIES.veiled;
  const damage = Math.max(0.5, Math.round(amount * difficulty.damage * 4) / 4);
  p.hp -= damage;
  p.invuln = 1.05;
  p.hurtCooldown = 0.5;
  p.knockX = knockX || 0;
  p.knockY = knockY || 0;
  this.run.damageTaken += damage;
  this.damagePulse = 0.48;
  this.hitFlash = 0.22;
  this.shake = Math.max(this.shake, 9);
  this.addParticles(p.x, p.y, "#e57a72", 17);
  this.floatText(p.x, p.y - 27, `-${damage} HEART`, "#f0998d");
  this.audio.play("hurt");
  if (p.hp <= 0) {
    if (p.extraLives > 0) {
      p.extraLives -= 1;
      p.hp = Math.min(p.maxHp, 2);
      p.invuln = 2.4;
      const bounds = this.getBounds();
      p.x = bounds.centerX;
      p.y = bounds.centerY;
      this.currentRoom.enemies.forEach((enemy) => { enemy.state = "stunned"; enemy.stateClock = 0.8; });
      this.toast("Nine Lives stirs. Once, and never again.");
      this.addParticles(p.x, p.y, "#afa9d5", 34);
    } else {
      this.finishRun(false);
    }
  }
  this.updateHUD();
  return true;
};

VeilfallGame.prototype.useBomb = function useBomb() {
  if (this.state !== "playing" || !this.player || this.player.bombs < 1) {
    if (this.state === "playing") this.toast("No bombs left.");
    return;
  }
  const p = this.player;
  p.bombs -= 1;
  this.audio.play("bomb", 1.2);
  this.shake = Math.max(this.shake, 13);
  this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.55, max: 0.55, color: "#e4b978", size: 245, ring: true });
  this.addParticles(p.x, p.y, "#e6bb76", 44);
  if (this.currentRoom) {
    this.currentRoom.shots = this.currentRoom.shots.filter((shot) => shot.owner !== "enemy");
    [...this.currentRoom.enemies].forEach((enemy) => {
      const d = distance(p, enemy);
      if (d < (enemy.bossDef ? 265 : 285)) this.damageEnemy(enemy, enemy.bossDef ? 18 + this.floorNo * 2 : enemy.hp + 1, { x: p.x, y: p.y, vx: enemy.x - p.x, vy: enemy.y - p.y, color: "#f5d598", burn: 0.1 }, false);
    });
  }
  this.updateHUD();
};

VeilfallGame.prototype.tryDash = function tryDash() {
  if (this.state !== "playing" || !this.player || this.player.dashCooldown > 0) return;
  const p = this.player;
  let dx = (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0) + this.stick.x + this.gamepadInput.x;
  let dy = (this.keys.s || this.keys.arrowdown ? 1 : 0) - (this.keys.w || this.keys.arrowup ? 1 : 0) + this.stick.y + this.gamepadInput.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.08) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
  else { dx /= length; dy /= length; }
  p.dashX = dx;
  p.dashY = dy;
  p.dashTime = 0.19;
  p.dashCooldown = 1.55;
  p.invuln = Math.max(p.invuln, 0.28);
  this.audio.play("dash");
  this.addParticles(p.x, p.y, p.stats.shade, 8);
  this.shake = Math.max(this.shake, 2.8);
};

VeilfallGame.prototype.advanceFloor = function advanceFloor() {
  if (this.floorNo >= THEMES.length) { this.finishRun(true); return; }
  this.buildFloor(this.floorNo + 1, false);
};

VeilfallGame.prototype.finishRun = function finishRun(victory) {
  if (!this.run || this.run.ended) return;
  this.run.ended = true;
  this.run.elapsed = Math.max(0, this.run.elapsed);
  this.meta.embers += Math.max(0, Math.floor(this.run.coins));
  this.run.banked = Math.max(0, Math.floor(this.run.coins));
  this.meta.totalKills += this.run.kills;
  this.meta.bestKills = Math.max(this.meta.bestKills, this.run.kills);
  this.meta.bestScore = Math.max(this.meta.bestScore, Math.floor(this.run.score));
  this.meta.bestFloor = Math.max(this.meta.bestFloor, this.run.floor);
  if (victory) {
    this.meta.wins += 1;
    this.meta.unlocked.wisp = true;
  }
  if (this.meta.bestFloor >= 3) this.meta.unlocked.warden = true;
  this.saveMeta();
  this.audio.play(victory ? "clear" : "hurt", victory ? 1.4 : 0.65);
  this.clearInput();
  this.state = victory ? "victory" : "dead";
  this.overlayView = victory ? "victory" : "dead";
  this.overlayReturn = null;
  this.renderOverlay();
  this.updateChrome();
  this.updateHUD();
};

VeilfallGame.prototype.returnToTitle = function returnToTitle() {
  if (this.state === "playing" || this.state === "paused") {
    if (this.run && !this.run.ended) {
      this.run.ended = true;
      this.meta.embers += Math.max(0, Math.floor(this.run.coins));
      this.run.banked = Math.max(0, Math.floor(this.run.coins));
      this.meta.totalKills += this.run.kills;
      this.meta.bestKills = Math.max(this.meta.bestKills, this.run.kills);
      this.meta.bestScore = Math.max(this.meta.bestScore, Math.floor(this.run.score));
      this.meta.bestFloor = Math.max(this.meta.bestFloor, this.run.floor);
      this.saveMeta();
    }
  }
  this.clearInput();
  this.clearToastTimers();
  if (this.nodes?.toastStack) this.nodes.toastStack.innerHTML = "";
  this.state = "menu";
  this.overlayView = "title";
  this.overlayReturn = null;
  this.renderOverlay();
  this.updateChrome();
};

VeilfallGame.prototype.toast = function toast(message) {
  if (!this.nodes?.toastStack) return;
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  this.nodes.toastStack.appendChild(element);
  const timer = window.setTimeout(() => {
    element.remove();
    this.toastTimers = this.toastTimers.filter((id) => id !== timer);
  }, 2300);
  this.toastTimers.push(timer);
};

VeilfallGame.prototype.clearToastTimers = function clearToastTimers() {
  this.toastTimers.forEach((timer) => window.clearTimeout(timer));
  this.toastTimers.length = 0;
};

VeilfallGame.prototype.floatText = function floatText(x, y, text, color) {
  if (this.texts.length > 64) this.texts.shift();
  this.texts.push({ x, y, text, color, life: 0.9, max: 0.9, vy: -28 });
};

VeilfallGame.prototype.addParticles = function addParticles(x, y, color, count) {
  const allowed = Math.min(count, Math.max(0, 420 - this.particles.length));
  for (let i = 0; i < allowed; i += 1) {
    const angle = this.rng() * Math.PI * 2;
    const speed = 22 + this.rng() * 155;
    const life = 0.24 + this.rng() * 0.55;
    this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color, size: 1.2 + this.rng() * 3.2, drag: 0.89 });
  }
};

VeilfallGame.prototype.resize = function resize() {
  if (!this.canvas) return;
  const oldW = this.canvasWidth || 1;
  const oldH = this.canvasHeight || 1;
  const rect = this.canvas.getBoundingClientRect();
  const width = Math.max(320, rect.width || window.innerWidth || 960);
  const height = Math.max(360, rect.height || window.innerHeight || 600);
  this.pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  this.canvas.width = Math.round(width * this.pixelRatio);
  this.canvas.height = Math.round(height * this.pixelRatio);
  this.canvasWidth = width;
  this.canvasHeight = height;
  this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  if (this.player && (oldW !== width || oldH !== height)) {
    const sx = width / oldW;
    const sy = height / oldH;
    const scaleObject = (object) => { object.x *= sx; object.y *= sy; };
    scaleObject(this.player);
    Object.values(this.floorRooms).forEach((room) => {
      [room.props, room.hazards, room.objects, room.enemies, room.shots].forEach((list) => list?.forEach(scaleObject));
    });
  }
  if (this.player && this.currentRoom) {
    const bounds = this.getBounds();
    this.player.x = clamp(this.player.x, bounds.left + this.player.r, bounds.right - this.player.r);
    this.player.y = clamp(this.player.y, bounds.top + this.player.r, bounds.bottom - this.player.r);
  }
};

VeilfallGame.prototype.loop = function loop(timestamp) {
  if (this.destroyed) return;
  this.frame += 1;
  const dt = clamp((timestamp - this.lastFrame) / 1000, 0, 0.04);
  this.lastFrame = timestamp;
  this.gameClock += dt;
  if (this.state === "playing") this.updateGame(dt);
  this.updateFX(dt);
  this.hudClock -= dt;
  if (this.hudClock <= 0) {
    this.hudClock = 0.11;
    this.updateHUD();
  }
  this.draw(timestamp / 1000);
  this.raf = requestAnimationFrame((time) => this.loop(time));
};

VeilfallGame.prototype.updateFX = function updateFX(dt) {
  for (let i = this.particles.length - 1; i >= 0; i -= 1) {
    const particle = this.particles[i];
    particle.life -= dt;
    if (!particle.ring && !particle.line) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(particle.drag || 0.9, dt * 60);
      particle.vy *= Math.pow(particle.drag || 0.9, dt * 60);
    }
    if (particle.life <= 0) this.particles.splice(i, 1);
  }
  for (let i = this.texts.length - 1; i >= 0; i -= 1) {
    const text = this.texts[i];
    text.life -= dt;
    text.y += text.vy * dt;
    if (text.life <= 0) this.texts.splice(i, 1);
  }
  this.shake = Math.max(0, this.shake - dt * 23);
  this.hitFlash = Math.max(0, this.hitFlash - dt);
  this.damagePulse = Math.max(0, this.damagePulse - dt);
  this.roomFade = Math.max(0, this.roomFade - dt * 1.7);
};

VeilfallGame.prototype.updateGame = function updateGame(dt) {
  if (!this.player || !this.currentRoom || !this.run || this.run.ended) return;
  this.run.elapsed += dt;
  this.pollGamepad();
  this.updatePlayer(dt);
  if (this.state !== "playing") return;
  this.updateEnemies(dt);
  if (this.state !== "playing") return;
  this.updateShots(dt);
  if (this.state !== "playing") return;
  this.updateHazards(dt);
  this.updatePickups(dt);
  this.audio.update(this.audio.context?.currentTime || 0, this.floorNo, Boolean(this.currentRoom.enemies.some((enemy) => enemy.bossDef)), this.player.hp / Math.max(1, this.player.maxHp) < 0.35 ? 1 : 0);
};

VeilfallGame.prototype.pollGamepad = function pollGamepad() {
  this.gamepadInput = { x: 0, y: 0, aimX: 0, aimY: 0, firing: false };
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const pad = pads && [...pads].find(Boolean);
  if (!pad) { this.gamepadDash = false; return; }
  const axis = (value) => Math.abs(value || 0) < 0.17 ? 0 : value;
  this.gamepadInput.x = axis(pad.axes?.[0]);
  this.gamepadInput.y = axis(pad.axes?.[1]);
  this.gamepadInput.aimX = axis(pad.axes?.[2]);
  this.gamepadInput.aimY = axis(pad.axes?.[3]);
  this.gamepadInput.firing = Boolean(pad.buttons?.[7]?.pressed || pad.buttons?.[5]?.pressed);
  const dash = Boolean(pad.buttons?.[0]?.pressed);
  if (dash && !this.gamepadDash) this.tryDash();
  if (pad.buttons?.[1]?.pressed && !this.gamepadInteract) this.interact();
  this.gamepadDash = dash;
  this.gamepadInteract = Boolean(pad.buttons?.[1]?.pressed);
};

VeilfallGame.prototype.getMoveInput = function getMoveInput() {
  let x = (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0) + this.stick.x + this.gamepadInput.x;
  let y = (this.keys.s || this.keys.arrowdown ? 1 : 0) - (this.keys.w || this.keys.arrowup ? 1 : 0) + this.stick.y + this.gamepadInput.y;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y };
};

VeilfallGame.prototype.updatePlayer = function updatePlayer(dt) {
  const p = this.player;
  const room = this.currentRoom;
  const bounds = this.getBounds();
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
  p.poisonTime = Math.max(0, p.poisonTime - dt);
  p.burnTime = Math.max(0, p.burnTime - dt);

  const movement = this.getMoveInput();
  p.stats = this.computeStats();
  let terrainSpeed = 1;
  for (const hazard of room.hazards) if (hazard.kind === "pool" && distance(p, hazard) < hazard.r + p.r) terrainSpeed = 0.76;
  if (p.dashTime > 0) {
    p.x += p.dashX * 690 * dt;
    p.y += p.dashY * 690 * dt;
    if (this.frame % 2 === 0) this.addParticles(p.x, p.y, p.stats.shade, 1);
  } else {
    const speed = p.stats.speed * terrainSpeed;
    p.x += (movement.x * speed + p.knockX) * dt;
    p.y += (movement.y * speed + p.knockY) * dt;
    p.knockX *= Math.pow(0.045, dt);
    p.knockY *= Math.pow(0.045, dt);
    if (movement.x || movement.y) {
      p.facing = Math.atan2(movement.y, movement.x);
      p.footstep += dt;
    }
  }
  this.resolveProps(p, room);

  const lane = 44;
  const exits = this.neighbors(room);
  const leftOpen = room.cleared && exits.left && Math.abs(p.y - bounds.centerY) < lane;
  const rightOpen = room.cleared && exits.right && Math.abs(p.y - bounds.centerY) < lane;
  const upOpen = room.cleared && exits.up && Math.abs(p.x - bounds.centerX) < lane;
  const downOpen = room.cleared && exits.down && Math.abs(p.x - bounds.centerX) < lane;
  if (leftOpen && p.x < bounds.left + 18) { this.tryEnterRoom("left"); return; }
  if (rightOpen && p.x > bounds.right - 18) { this.tryEnterRoom("right"); return; }
  if (upOpen && p.y < bounds.top + 18) { this.tryEnterRoom("up"); return; }
  if (downOpen && p.y > bounds.bottom - 18) { this.tryEnterRoom("down"); return; }
  p.x = clamp(p.x, bounds.left + p.r, bounds.right - p.r);
  p.y = clamp(p.y, bounds.top + p.r, bounds.bottom - p.r);

  let aimX = this.mouse.x;
  let aimY = this.mouse.y;
  if (!this.mouse.seen || this.gamepadInput.firing || this.stick.firing) {
    if (Math.hypot(this.gamepadInput.aimX, this.gamepadInput.aimY) > 0.25) {
      aimX = p.x + this.gamepadInput.aimX * 200;
      aimY = p.y + this.gamepadInput.aimY * 200;
    } else {
      const nearest = room.enemies.filter((enemy) => !enemy.dead).sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (nearest) { aimX = nearest.x; aimY = nearest.y; }
    }
  }
  if (this.mouse.seen && !this.stick.firing && !this.gamepadInput.firing) aimX = this.mouse.x, aimY = this.mouse.y;
  const firing = this.mouse.down || this.keys[" "] || this.stick.firing || this.gamepadInput.firing;
  if (firing) {
    p.facing = Math.atan2(aimY - p.y, aimX - p.x);
    this.tryFire(aimX, aimY);
  }
  if (p.poisonTime > 0 && p.hurtCooldown <= 0) {
    p.hurtCooldown = 1.2;
    this.takeDamage(1, "poison");
  }
  const nearestObject = this.findInteractable();
  const hint = nearestObject ? this.interactionLabel(nearestObject) : "";
  if (hint !== this.lastInteractionHTML) {
    this.lastInteractionHTML = hint;
    this.nodes.interactionHint.innerHTML = hint;
    this.nodes.interactionHint.classList.toggle("visible", Boolean(nearestObject));
  }
  const ambient = firing ? "The tears answer" : `Hold to weep / ${p.dashCooldown > 0 ? `dash ${p.dashCooldown.toFixed(1)}s` : "dash ready"}`;
  if (ambient !== this.lastAmbientText) {
    this.lastAmbientText = ambient;
    this.nodes.ambientPrompt.textContent = ambient;
  }
};

VeilfallGame.prototype.resolveProps = function resolveProps(entity, room) {
  if (!room) return;
  for (const prop of room.props) {
    if (prop.hp <= 0) continue;
    const dx = entity.x - prop.x;
    const dy = entity.y - prop.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const min = (entity.r || 12) + prop.r;
    if (d < min) {
      const push = min - d;
      entity.x += (dx / d) * push;
      entity.y += (dy / d) * push;
    }
  }
};

VeilfallGame.prototype.tryFire = function tryFire(aimX, aimY) {
  const p = this.player;
  if (p.fireCooldown > 0 || !this.currentRoom) return;
  const dx = aimX - p.x;
  const dy = aimY - p.y;
  const baseAngle = Math.atan2(dy, dx);
  if (!Number.isFinite(baseAngle)) return;
  p.facing = baseAngle;
  p.fireCooldown = p.stats.fireDelay;
  p.fireCount += 1;
  this.run.shots += 1;
  const extraPower = this.player.items.includes("bone-spool") && p.fireCount % 4 === 0;
  const count = clamp(p.stats.shots, 1, 5);
  const spread = count === 1 ? 0 : Math.min(0.34, 0.15 * (count - 1));
  for (let i = 0; i < count; i += 1) {
    const angle = baseAngle + (i - (count - 1) / 2) * spread;
    const speed = p.stats.shotSpeed;
    this.currentRoom.shots.push({
      owner: "player", x: p.x + Math.cos(angle) * 17, y: p.y + Math.sin(angle) * 17,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: p.stats.tearSize + (extraPower ? 2 : 0), damage: p.stats.damage * (extraPower ? 2.4 : 1),
      life: p.stats.range / speed, range: p.stats.range, color: extraPower ? "#fff0b8" : p.stats.shade,
      bounce: p.stats.bounce, pierce: p.stats.pierce, chain: p.stats.chain,
      burn: p.stats.burn, poison: p.stats.poison, hits: [],
    });
  }
  this.audio.play("shoot", count > 1 ? 0.75 : 0.58);
};

VeilfallGame.prototype.createEnemyShot = function createEnemyShot(enemy, angle, speed, options) {
  const settings = options || {};
  const difficulty = DIFFICULTIES[this.run.difficulty] || DIFFICULTIES.veiled;
  const depthSpeed = 1 + (this.floorNo - 1) * 0.045;
  const velocity = speed * difficulty.speed * depthSpeed;
  this.currentRoom.shots.push({
    owner: "enemy", x: enemy.x + Math.cos(angle) * (enemy.r + 4), y: enemy.y + Math.sin(angle) * (enemy.r + 4),
    vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
    r: settings.r || (enemy.bossDef ? 7 : 5), damage: settings.damage || 1,
    life: settings.life || 3.4, range: 1000, color: settings.color || enemy.color,
    kind: settings.kind || "tear",
  });
};

VeilfallGame.prototype.shootAtPlayer = function shootAtPlayer(enemy, speed, opts) {
  const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
  this.createEnemyShot(enemy, angle, speed, opts);
};

VeilfallGame.prototype.shootFan = function shootFan(enemy, count, arc, speed, offset, opts) {
  const direction = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) + (offset || 0);
  for (let i = 0; i < count; i += 1) {
    const angle = direction + (count === 1 ? 0 : (i / (count - 1) - 0.5) * arc);
    this.createEnemyShot(enemy, angle, speed, opts);
  }
};

VeilfallGame.prototype.shootRadial = function shootRadial(enemy, count, speed, offset, opts) {
  const rotation = offset || 0;
  for (let i = 0; i < count; i += 1) this.createEnemyShot(enemy, rotation + i / count * Math.PI * 2, speed, opts);
};

VeilfallGame.prototype.updateEnemies = function updateEnemies(dt) {
  const room = this.currentRoom;
  if (!room) return;
  const p = this.player;
  const bounds = this.getBounds();
  for (const enemy of [...room.enemies]) {
    if (enemy.dead) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.hitClock = Math.max(0, enemy.hitClock - dt);
    enemy.wobble += dt * (enemy.type === "gnat" ? 8 : 2.2);
    enemy.attackClock -= dt;
    enemy.shootClock -= dt;
    enemy.stateClock = Math.max(0, enemy.stateClock - dt);
    if (enemy.burn > 0) {
      enemy.burn -= dt;
      enemy.statusClock = (enemy.statusClock || 0) - dt;
      if (enemy.statusClock <= 0) {
        enemy.statusClock = 0.55;
        this.damageEnemy(enemy, p.stats.burnDamage, null, true);
        this.addParticles(enemy.x, enemy.y, "#f2995f", 2);
      }
    }
    if (enemy.poison > 0) {
      enemy.poison -= dt;
      enemy.poisonClock = (enemy.poisonClock || 0) - dt;
      if (enemy.poisonClock <= 0) {
        enemy.poisonClock = 0.68;
        this.damageEnemy(enemy, 0.34 + (this.synergyIds().includes("blood-bloom") ? 0.2 : 0), null, true);
      }
    }
    if (enemy.dead) continue;
    if (enemy.bossDef) this.updateBoss(enemy, dt);
    else this.updateRegularEnemy(enemy, dt, bounds);
    if (enemy.dead || this.state !== "playing") continue;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.vx *= Math.pow(0.11, dt);
    enemy.vy *= Math.pow(0.11, dt);
    this.resolveProps(enemy, room);
    enemy.x = clamp(enemy.x, bounds.left + enemy.r, bounds.right - enemy.r);
    enemy.y = clamp(enemy.y, bounds.top + enemy.r, bounds.bottom - enemy.r);
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < enemy.r + p.r - 1) {
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      this.takeDamage(enemy.bossDef ? 1.25 : 1, enemy.name, (dx / length) * 270, (dy / length) * 270);
      if (enemy.type === "bomber" && !enemy.bossDef) this.explodeEnemy(enemy);
    }
  }
  if (room.enemies.length === 0 && !room.cleared) this.onRoomCleared(room);
};

VeilfallGame.prototype.updateRegularEnemy = function updateRegularEnemy(enemy, dt) {
  const p = this.player;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  const distanceToPlayer = Math.hypot(dx, dy) || 1;
  const nx = dx / distanceToPlayer;
  const ny = dy / distanceToPlayer;
  const slow = 1 - p.stats.enemySlow;
  const baseSpeed = enemy.speed * slow;
  if (enemy.state === "stunned") {
    if (enemy.stateClock <= 0) enemy.state = "idle";
    return;
  }
  if (enemy.type === "spitter") {
    let direction = distanceToPlayer > 300 ? 1 : distanceToPlayer < 205 ? -0.7 : 0;
    enemy.vx += nx * baseSpeed * direction * dt * 5;
    enemy.vy += ny * baseSpeed * direction * dt * 5;
    if (enemy.shootClock <= 0) {
      this.shootFan(enemy, 3, 0.34, 145, 0, { r: 5, color: "#c3c778" });
      enemy.shootClock = 2.05 + this.rng() * 0.5;
    }
  } else if (enemy.type === "turret") {
    if (enemy.shootClock <= 0) {
      this.shootAtPlayer(enemy, 178, { r: 5.5, color: "#e6b76f" });
      if (this.floorNo >= 3) this.shootAtPlayer(enemy, 156, { r: 4, color: "#e9c98a" });
      enemy.shootClock = 1.45 + this.rng() * 0.5;
    }
  } else if (enemy.type === "charger") {
    if (enemy.state === "windup") {
      if (enemy.stateClock <= 0) {
        enemy.state = "charge";
        enemy.stateClock = 0.38;
        enemy.chargeX = nx;
        enemy.chargeY = ny;
      }
    } else if (enemy.state === "charge") {
      enemy.vx += (enemy.chargeX || nx) * baseSpeed * 4.1 * dt;
      enemy.vy += (enemy.chargeY || ny) * baseSpeed * 4.1 * dt;
      if (enemy.stateClock <= 0) { enemy.state = "recover"; enemy.stateClock = 0.65; }
    } else if (enemy.state === "recover") {
      if (enemy.stateClock <= 0) { enemy.state = "idle"; enemy.attackClock = 1.2; }
    } else {
      enemy.vx += nx * baseSpeed * dt * 4;
      enemy.vy += ny * baseSpeed * dt * 4;
      if (enemy.attackClock <= 0 && distanceToPlayer < 360) {
        enemy.state = "windup";
        enemy.stateClock = 0.58;
        enemy.chargeX = nx;
        enemy.chargeY = ny;
      }
    }
  } else if (enemy.type === "leaper") {
    if (enemy.state === "leap") {
      enemy.vx += (enemy.leapX || nx) * baseSpeed * 3.4 * dt;
      enemy.vy += (enemy.leapY || ny) * baseSpeed * 3.4 * dt;
      if (enemy.stateClock <= 0) { enemy.state = "rest"; enemy.stateClock = 0.85; }
    } else if (enemy.state === "rest") {
      if (enemy.stateClock <= 0) enemy.state = "idle";
    } else {
      enemy.vx += nx * baseSpeed * dt * 4;
      enemy.vy += ny * baseSpeed * dt * 4;
      if (enemy.attackClock <= 0 && distanceToPlayer > 105) {
        enemy.state = "tell";
        enemy.stateClock = 0.43;
        enemy.leapX = nx;
        enemy.leapY = ny;
      }
      if (enemy.state === "tell" && enemy.stateClock <= 0) { enemy.state = "leap"; enemy.stateClock = 0.35; }
    }
  } else if (enemy.type === "wraith") {
    const sway = Math.sin(enemy.wobble) * 0.8;
    enemy.vx += (nx + -ny * sway) * baseSpeed * dt * 3.4;
    enemy.vy += (ny + nx * sway) * baseSpeed * dt * 3.4;
    if (enemy.shootClock <= 0 && distanceToPlayer < 320) {
      this.shootAtPlayer(enemy, 134, { r: 6, color: "#9cb6ce" });
      enemy.shootClock = 2.2;
    }
  } else if (enemy.type === "shield") {
    enemy.facingX = nx;
    enemy.facingY = ny;
    if (distanceToPlayer > 155) {
      enemy.vx += nx * baseSpeed * dt * 3;
      enemy.vy += ny * baseSpeed * dt * 3;
    } else {
      enemy.vx += -ny * Math.sin(enemy.wobble) * baseSpeed * dt;
      enemy.vy += nx * Math.sin(enemy.wobble) * baseSpeed * dt;
    }
  } else if (enemy.type === "bomber") {
    enemy.vx += nx * baseSpeed * dt * 4;
    enemy.vy += ny * baseSpeed * dt * 4;
    if (distanceToPlayer < 126 || (enemy.attackClock <= 0 && distanceToPlayer < 230)) {
      enemy.fuse = (enemy.fuse || 0.7) - dt;
      enemy.state = "fuse";
      if (enemy.fuse <= 0) this.explodeEnemy(enemy);
    }
  } else if (enemy.type === "blossom") {
    if (enemy.shootClock <= 0) {
      this.shootFan(enemy, 5, 0.74, 125, Math.sin(enemy.wobble) * 0.12, { r: 5, color: "#b9cf70" });
      enemy.shootClock = 2.5;
    }
  } else {
    const pace = enemy.type === "gnat" ? 1.15 : 1;
    const wobble = enemy.type === "gnat" ? Math.sin(enemy.wobble) * 0.42 : 0;
    enemy.vx += (nx - ny * wobble) * baseSpeed * pace * dt * 4;
    enemy.vy += (ny + nx * wobble) * baseSpeed * pace * dt * 4;
  }
}

VeilfallGame.prototype.updateBoss = function updateBoss(enemy, dt) {
  const p = this.player;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const pattern = enemy.bossDef.pattern;
  const phase = enemy.hp < enemy.maxHp * 0.52 ? 2 : 1;
  if (phase !== enemy.phase) {
    enemy.phase = phase;
    enemy.attackClock = 0.45;
    this.shake = Math.max(this.shake, 7);
    this.addParticles(enemy.x, enemy.y, enemy.color, 28);
    this.toast(`${enemy.name} changes its shape.`);
  }
  const moveFactor = 1 - p.stats.enemySlow * 0.45;
  if (enemy.state === "stunned") {
    if (enemy.stateClock <= 0) enemy.state = "idle";
    return;
  }
  if (enemy.state === "tell") {
    if (enemy.stateClock <= 0) {
      enemy.state = "dash";
      enemy.stateClock = 0.42;
      enemy.vx += (enemy.chargeX || nx) * enemy.speed * 5.1;
      enemy.vy += (enemy.chargeY || ny) * enemy.speed * 5.1;
    }
  } else if (enemy.state === "dash") {
    if (enemy.stateClock <= 0) {
      enemy.state = "idle";
      enemy.attackClock = 1.35;
      this.shootRadial(enemy, phase === 2 ? 12 : 8, 125 + this.floorNo * 5, this.gameClock * 0.4, { r: 6, color: enemy.color });
      this.addParticles(enemy.x, enemy.y, enemy.color, 15);
    }
  }

  if (enemy.state !== "dash" && enemy.state !== "tell") {
    const orbit = Math.sin(this.gameClock * 0.65 + enemy.wobble) * 0.28;
    let direction = 0.56;
    if (length > 290) direction = 1;
    if (length < 175) direction = -0.32;
    enemy.vx += (nx * direction - ny * orbit) * enemy.speed * moveFactor * dt * 3.2;
    enemy.vy += (ny * direction + nx * orbit) * enemy.speed * moveFactor * dt * 3.2;
  }

  if (enemy.attackClock <= 0 && enemy.state === "idle") {
    const cooldown = phase === 2 ? 1.65 : 2.45;
    if (pattern === "charge" || (pattern === "final" && enemy.bossSequence % 3 === 1)) {
      enemy.state = "tell";
      enemy.stateClock = phase === 2 ? 0.43 : 0.68;
      enemy.chargeX = nx;
      enemy.chargeY = ny;
      enemy.attackClock = cooldown + 0.65;
    } else if (pattern === "fan") {
      this.shootFan(enemy, phase === 2 ? 9 : 7, phase === 2 ? 1.45 : 1.05, 142 + this.floorNo * 3, Math.sin(this.gameClock) * 0.3, { r: 7, color: enemy.color, damage: 1.15 });
      enemy.attackClock = cooldown;
    } else if (pattern === "summon") {
      if (this.currentRoom.enemies.length < 5) {
        for (let i = 0; i < 2; i += 1) this.spawnEnemy(i ? "gnat" : "husk", this.currentRoom, { x: enemy.x + (i ? 42 : -42), y: enemy.y + 32 });
      }
      this.shootRadial(enemy, phase === 2 ? 12 : 8, 130, this.gameClock * 0.32, { r: 6, color: enemy.color });
      enemy.attackClock = cooldown + 0.3;
    } else if (pattern === "radial") {
      this.shootRadial(enemy, phase === 2 ? 16 : 10, 145, this.gameClock * 0.45, { r: 6, color: enemy.color });
      this.shootAtPlayer(enemy, 178, { r: 7, color: "#ffd28b" });
      enemy.attackClock = cooldown;
    } else if (pattern === "bloom") {
      const bounds = this.getBounds();
      this.currentRoom.hazards.push({ x: clamp(p.x, bounds.left + 50, bounds.right - 50), y: clamp(p.y, bounds.top + 50, bounds.bottom - 50), r: 31, kind: "spore", clock: 0, damageClock: 0, born: this.gameClock });
      this.shootFan(enemy, phase === 2 ? 7 : 5, 0.8, 125, 0, { r: 6, color: enemy.color });
      enemy.attackClock = cooldown + 0.35;
    } else if (pattern === "choir") {
      this.shootFan(enemy, phase === 2 ? 11 : 8, Math.PI * 1.3, 136, Math.sin(this.gameClock * 0.7) * 0.5, { r: 6, color: enemy.color });
      if (phase === 2 && !enemy.summoned && this.currentRoom.enemies.length < 4) {
        enemy.summoned = true;
        this.spawnEnemy("wraith", this.currentRoom, { x: enemy.x - 48, y: enemy.y + 30 });
        this.spawnEnemy("wraith", this.currentRoom, { x: enemy.x + 48, y: enemy.y + 30 });
      }
      enemy.attackClock = cooldown;
    } else if (pattern === "final") {
      enemy.bossSequence += 1;
      if (phase === 2 && enemy.bossSequence % 3 === 0) {
        enemy.state = "tell";
        enemy.stateClock = 0.43;
        enemy.chargeX = nx;
        enemy.chargeY = ny;
        enemy.attackClock = cooldown + 0.45;
      } else {
        this.shootRadial(enemy, phase === 2 ? 22 : 14, phase === 2 ? 169 : 148, this.gameClock * (phase === 2 ? 1 : 0.5), { r: phase === 2 ? 7 : 6, color: enemy.color, damage: 1.15 });
        this.shootFan(enemy, 5, 0.54, 175, 0, { r: 6, color: "#f3c5d1" });
        enemy.attackClock = cooldown;
      }
    }
  }
};

VeilfallGame.prototype.explodeEnemy = function explodeEnemy(enemy) {
  if (!enemy || enemy.dead) return;
  enemy.dead = true;
  this.addParticles(enemy.x, enemy.y, "#eb9b62", 25);
  this.particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: "#eb9b62", size: 96, ring: true });
  this.shake = Math.max(this.shake, 4);
  if (distance(this.player, enemy) < 88) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    this.takeDamage(1, "powder burst", dx / length * 240, dy / length * 240);
  }
  this.onEnemyDeath(enemy);
};

VeilfallGame.prototype.updateShots = function updateShots(dt) {
  const room = this.currentRoom;
  const bounds = this.getBounds();
  for (let i = room.shots.length - 1; i >= 0; i -= 1) {
    const shot = room.shots[i];
    shot.life -= dt;
    shot.range -= Math.hypot(shot.vx, shot.vy) * dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.owner === "player") {
      let wallHit = false;
      if (shot.x < bounds.left + 8 || shot.x > bounds.right - 8 || shot.y < bounds.top + 8 || shot.y > bounds.bottom - 8) {
        if (shot.bounce > 0) {
          shot.bounce -= 1;
          if (shot.x < bounds.left + 8 || shot.x > bounds.right - 8) shot.vx *= -1;
          if (shot.y < bounds.top + 8 || shot.y > bounds.bottom - 8) shot.vy *= -1;
          shot.x = clamp(shot.x, bounds.left + 9, bounds.right - 9);
          shot.y = clamp(shot.y, bounds.top + 9, bounds.bottom - 9);
          shot.range *= 0.72;
        } else wallHit = true;
      }
      if (wallHit) { room.shots.splice(i, 1); continue; }
      let blocked = false;
      for (const prop of room.props) {
        if (prop.hp <= 0 || Math.hypot(shot.x - prop.x, shot.y - prop.y) > shot.r + prop.r) continue;
        if (shot.bounce > 0) {
          shot.bounce -= 1;
          const dx = shot.x - prop.x;
          const dy = shot.y - prop.y;
          if (Math.abs(dx) > Math.abs(dy)) shot.vx *= -1;
          else shot.vy *= -1;
          shot.x += Math.sign(dx || 1) * 6;
          shot.y += Math.sign(dy || 1) * 6;
          shot.range *= 0.76;
        } else blocked = true;
        break;
      }
      if (blocked) { room.shots.splice(i, 1); continue; }
      let consumed = false;
      for (const enemy of [...room.enemies]) {
        if (enemy.dead || shot.hits.includes(enemy.entityId)) continue;
        if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) > shot.r + enemy.r) continue;
        shot.hits.push(enemy.entityId);
        this.damageEnemy(enemy, shot.damage, shot, false);
        this.addParticles(shot.x, shot.y, shot.color, 3);
        if (shot.pierce > 0) {
          shot.pierce -= 1;
          shot.damage *= 0.72;
          shot.x += shot.vx * dt * 2;
        } else if (shot.bounce > 0 && !enemy.bossDef) {
          shot.bounce -= 1;
          const nearest = room.enemies.filter((target) => target !== enemy && !target.dead).sort((a, b) => distance(a, shot) - distance(b, shot))[0];
          if (nearest) {
            const angle = Math.atan2(nearest.y - shot.y, nearest.x - shot.x);
            const speed = Math.hypot(shot.vx, shot.vy);
            shot.vx = Math.cos(angle) * speed;
            shot.vy = Math.sin(angle) * speed;
          } else { shot.vx *= -0.82; shot.vy *= -0.82; }
          shot.damage *= 0.72;
        } else consumed = true;
        break;
      }
      if (consumed || shot.range <= 0 || shot.life <= 0) room.shots.splice(i, 1);
    } else {
      if (shot.life <= 0 || shot.x < bounds.left - 10 || shot.x > bounds.right + 10 || shot.y < bounds.top - 10 || shot.y > bounds.bottom + 10) {
        room.shots.splice(i, 1);
        continue;
      }
      let blocked = false;
      for (const prop of room.props) if (prop.hp > 0 && Math.hypot(shot.x - prop.x, shot.y - prop.y) < shot.r + prop.r) { blocked = true; break; }
      if (blocked) { room.shots.splice(i, 1); continue; }
      if (Math.hypot(shot.x - this.player.x, shot.y - this.player.y) < shot.r + this.player.r) {
        const dx = this.player.x - shot.x;
        const dy = this.player.y - shot.y;
        const length = Math.hypot(dx, dy) || 1;
        this.takeDamage(shot.damage, "enemy tear", dx / length * 175, dy / length * 175);
        room.shots.splice(i, 1);
      }
    }
  }
};

VeilfallGame.prototype.updateHazards = function updateHazards(dt) {
  const room = this.currentRoom;
  if (!room) return;
  for (const hazard of room.hazards) {
    hazard.clock += dt;
    hazard.damageClock = Math.max(0, hazard.damageClock - dt);
    if (hazard.kind === "ember" && Math.sin(hazard.clock * 3.6) > 0.45) hazard.active = true;
    else if (hazard.kind === "ember") hazard.active = false;
    if (hazard.kind === "void" && Math.sin(hazard.clock * 1.6) < -0.82) hazard.active = false;
    else if (hazard.kind === "void") hazard.active = true;
    const inside = distance(this.player, hazard) < hazard.r + this.player.r * 0.35;
    if (inside && hazard.active !== false && hazard.damageClock <= 0 && hazard.kind !== "pool") {
      hazard.damageClock = 0.86;
      const dx = this.player.x - hazard.x;
      const dy = this.player.y - hazard.y;
      const len = Math.hypot(dx, dy) || 1;
      this.takeDamage(1, hazard.kind, dx / len * 90, dy / len * 90);
      this.addParticles(this.player.x, this.player.y, this.theme().danger, 4);
    }
    if ((hazard.kind === "spore" || hazard.kind === "shard") && inside && hazard.damageClock < 0.35) this.player.poisonTime = Math.max(this.player.poisonTime, 0.8);
  }
};

VeilfallGame.prototype.updatePickups = function updatePickups(dt) {
  const room = this.currentRoom;
  const p = this.player;
  if (!room) return;
  for (const object of room.objects) {
    if (object.taken) continue;
    if (object.kind === "coin" || object.kind === "key" || object.kind === "bomb" || object.kind === "heart") {
      const d = distance(p, object);
      if (p.stats.magnet && d < p.stats.magnet + 60) {
        const force = (1 - d / (p.stats.magnet + 60)) * 250;
        const length = Math.max(1, d);
        object.x += ((p.x - object.x) / length) * force * dt;
        object.y += ((p.y - object.y) / length) * force * dt;
      }
      if (d < p.r + (object.r || 12) + 2) this.collectPickup(object);
    }
  }
};

VeilfallGame.prototype.updateChrome = function updateChrome() {
  if (!this.root) return;
  const inRun = this.state !== "menu";
  this.root.classList.toggle("in-run", inRun);
  const inTitle = this.state === "menu" && this.overlayView === "title";
  const pause = this.host.querySelector(".top-actions [data-action='pause']");
  if (pause) {
    pause.innerHTML = this.state === "playing" ? "&#9208;" : this.state === "paused" ? "&#9654;" : "&#9208;";
    pause.style.display = this.state === "playing" || this.state === "paused" ? "grid" : "none";
  }
  const currentHeading = this.nodes.topHeading;
  if (currentHeading) {
    const theme = THEMES[this.floorNo - 1] || THEMES[0];
    currentHeading.childNodes[0].nodeValue = inRun ? theme.name : "The Ossuary";
    this.nodes.topSubheading.textContent = inRun ? `${theme.floor} / ${this.prefs.difficulty.toUpperCase()}` : "THE FIRST DESCENT";
  }
  if (this.nodes.ambientPrompt) this.nodes.ambientPrompt.style.opacity = this.state === "playing" ? "1" : "0";
  if (inTitle && this.nodes.interactionHint) this.nodes.interactionHint.classList.remove("visible");
};

VeilfallGame.prototype.updateHUD = function updateHUD() {
  if (!this.nodes || !this.root) return;
  const inRun = this.state !== "menu" && Boolean(this.run);
  if (!inRun) {
    this.nodes.heartRow.innerHTML = "";
    this.nodes.hpReadout.textContent = "";
    this.nodes.coinReadout.textContent = "0";
    this.nodes.keyReadout.textContent = "0";
    this.nodes.bombReadout.textContent = "0";
    this.nodes.relicStrip.innerHTML = "";
    this.nodes.miniMap.innerHTML = "";
    this.nodes.floorReadout.textContent = "01 / 06";
    this.nodes.timeReadout.textContent = "00:00";
    this.nodes.killReadout.textContent = "0";
    this.nodes.shotReadout.textContent = "0";
    this.nodes.bossBar.classList.remove("active");
    this.nodes.roomLabel.innerHTML = `<strong>Quiet Room</strong><span>Nothing stirs</span>`;
    return;
  }
  const p = this.player;
  if (!p) return;
  const hearts = [];
  for (let i = 0; i < Math.ceil(p.maxHp / 2); i += 1) {
    const value = p.hp - i * 2;
    const fill = value >= 2 ? "#df756a" : value > 0 ? "#b56a66" : "#434149";
    hearts.push(`<span class="heart ${value >= 2 ? "full" : value > 0 ? "half" : "empty"}" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="${fill}" d="M12 21s-9-5.7-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.3-9 12-9 12z"/></svg></span>`);
  }
  if (p.shield > 0) hearts.push(`<span class="shield-mark" title="Mask absorbs one hit">O</span>`);
  if (p.extraLives > 0) hearts.push(`<span class="shield-mark" title="One extra life">+${p.extraLives} LIFE</span>`);
  this.nodes.heartRow.innerHTML = hearts.join("");
  this.nodes.hpReadout.textContent = `${Math.max(0, p.hp).toFixed(p.hp % 1 ? 1 : 0)} / ${p.maxHp}`;
  this.nodes.coinReadout.textContent = String(this.run.coins);
  this.nodes.keyReadout.textContent = String(p.keys);
  this.nodes.bombReadout.textContent = String(p.bombs);
  const uniqueItems = [...new Set(p.items)];
  this.nodes.relicStrip.innerHTML = `${uniqueItems.slice(0, 5).map((id) => {
    const item = ITEMS.find((entry) => entry.id === id);
    return item ? `<span class="relic-token" style="color:${item.color};border-color:${item.color}66" title="${escapeHTML(item.name)}: ${escapeHTML(item.desc)}">${item.mark}</span>` : "";
  }).join("")}${uniqueItems.length > 5 ? `<span class="relic-more">+${uniqueItems.length - 5}</span>` : uniqueItems.length === 0 ? `<span class="micro-label">No relics</span>` : ""}`;
  this.nodes.floorReadout.textContent = `${String(this.floorNo).padStart(2, "0")} / 06`;
  this.nodes.timeReadout.textContent = formatTime(this.run.elapsed);
  this.nodes.killReadout.textContent = String(this.run.kills);
  this.nodes.shotReadout.textContent = String(this.run.shots);
  const theme = this.theme();
  this.nodes.topHeading.childNodes[0].nodeValue = theme.name;
  this.nodes.topSubheading.textContent = `${theme.floor} / ${(DIFFICULTIES[this.run.difficulty] || DIFFICULTIES.veiled).name.toUpperCase()}`;
  if (this.currentRoom) {
    const isBoss = this.currentRoom.type === "boss";
    const hint = isBoss && this.currentRoom.enemies[0] ? this.currentRoom.enemies[0].bossDef.epithet : this.currentRoom.cleared ? "The doors have opened" : `${this.currentRoom.enemies.length} presence${this.currentRoom.enemies.length === 1 ? "" : "s"} remain`;
    this.nodes.roomLabel.innerHTML = `<strong>${escapeHTML(this.currentRoom.name)}</strong><span>${escapeHTML(hint)}</span>`;
  }
  const boss = this.currentRoom?.enemies.find((enemy) => enemy.bossDef && !enemy.dead);
  this.nodes.bossBar.classList.toggle("active", Boolean(boss));
  this.nodes.roomLabel.style.top = boss ? (this.canvasWidth < 620 ? "126px" : "139px") : (this.canvasWidth < 620 ? "75px" : "107px");
  if (boss) {
    this.nodes.bossName.textContent = `${boss.name} / PHASE ${boss.phase}`;
    this.nodes.bossMeter.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
  }
  this.nodes.miniMap.innerHTML = this.miniMapHTML();
  this.nodes.screenShade.classList.toggle("hit", this.damagePulse > 0);
};

VeilfallGame.prototype.miniMapHTML = function miniMapHTML() {
  const cells = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const room = this.floorRooms[coordKey(x, y)];
      if (!room) { cells.push(`<span class="map-cell"></span>`); continue; }
      const seen = room.visited;
      const adjacent = !seen && this.helpMapVisibility(room);
      const current = room === this.currentRoom;
      const type = room.type === "boss" ? "boss" : room.type === "treasure" ? "treasure" : room.type === "shop" ? "shop" : room.type === "vault" ? "locked" : room.type === "devil" ? "devil" : room.type === "angel" ? "angel" : "";
      const glyph = current ? "o" : !seen && !adjacent ? "" : room.type === "boss" ? "!" : room.type === "treasure" ? "*" : room.type === "shop" ? "+" : room.type === "vault" ? "V" : room.type === "altar" ? "^" : room.type === "devil" ? "D" : room.type === "angel" ? "A" : room.type === "start" ? "S" : ".";
      cells.push(`<span class="map-cell ${seen ? "seen" : adjacent ? "adjacent" : ""} ${current ? "current" : ""} ${type}">${glyph}</span>`);
    }
  }
  return `<div class="minimap-head"><span>Floor ${String(this.floorNo).padStart(2, "0")}</span><button data-action="map">OPEN MAP [M]</button></div><div class="minimap-grid">${cells.join("")}</div><div class="map-legend"><span>! BOSS</span><span>* RELIC</span><span>+ SHOP</span></div>`;
};

VeilfallGame.prototype.theme = function theme() {
  return THEMES[clamp(this.floorNo - 1, 0, THEMES.length - 1)] || THEMES[0];
};

VeilfallGame.prototype.draw = function draw(time) {
  if (!this.ctx || !this.canvasWidth || !this.canvasHeight) return;
  const ctx = this.ctx;
  const w = this.canvasWidth;
  const h = this.canvasHeight;
  ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const theme = this.theme();
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, theme.bg);
  bg.addColorStop(0.55, "#0b0d13");
  bg.addColorStop(1, "#090a0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  this.drawAtmosphere(time, theme);
  const bounds = this.getBounds();
  this.ctx.save();
  if (this.shake > 0.1) this.ctx.translate(Math.sin(this.gameClock * 83) * this.shake, Math.cos(this.gameClock * 71) * this.shake * 0.58);
  if (this.currentRoom && this.state !== "menu") this.drawRoom(time, bounds, theme);
  else this.drawTitleAtrium(time, bounds, theme);

  if (this.currentRoom && this.state !== "menu") {
    const room = this.currentRoom;
    this.drawHazards(time, room);
    this.drawProps(room);
    this.drawObjects(time, room);
    this.drawEnemies(time, room);
    this.drawShots(time, room);
    this.drawPlayer(time, this.player);
  }
  this.drawParticles();
  this.drawFloatingText();
  this.ctx.restore();
  this.drawVignette();
  if (this.roomFade > 0) {
    ctx.fillStyle = `rgba(233, 211, 166, ${clamp(this.roomFade * 0.21, 0, 0.16)})`;
    ctx.fillRect(0, 0, w, h);
  }
};

VeilfallGame.prototype.drawAtmosphere = function drawAtmosphere(time, theme) {
  const ctx = this.ctx;
  const w = this.canvasWidth;
  const h = this.canvasHeight;
  const glow = ctx.createRadialGradient(w * 0.52, h * 0.48, 0, w * 0.52, h * 0.48, Math.max(w, h) * 0.65);
  glow.addColorStop(0, `${theme.glow}11`);
  glow.addColorStop(0.46, `${theme.trim}08`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < this.backgroundSeed.length; i += 1) {
    const particle = this.backgroundSeed[i];
    const drift = (time * (2 + particle.s * 3) + i * 8) % 1;
    const x = (particle.u * w + Math.sin(time * 0.12 + i) * 18 + w) % w;
    const y = (particle.v * h - drift * 34 + h) % h;
    const alpha = particle.a * (0.65 + Math.sin(time * 0.9 + i * 2) * 0.35);
    ctx.fillStyle = `${theme.glow}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(x, y, particle.s, 0, Math.PI * 2);
    ctx.fill();
  }
  const vertical = ctx.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, "rgba(0,0,0,.35)");
  vertical.addColorStop(0.28, "transparent");
  vertical.addColorStop(0.72, "transparent");
  vertical.addColorStop(1, "rgba(0,0,0,.54)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, w, h);
};

VeilfallGame.prototype.drawTitleAtrium = function drawTitleAtrium(time, bounds, theme) {
  const ctx = this.ctx;
  const cx = bounds.centerX;
  const cy = bounds.centerY;
  const ring = 150 + Math.sin(time * 0.6) * 4;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "rgba(210, 174, 112, .17)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 12]);
  ctx.beginPath();
  ctx.arc(cx, cy - 15, ring, time * -0.08, Math.PI * 2 + time * -0.08);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(210, 174, 112, .11)";
  ctx.beginPath();
  ctx.arc(cx, cy - 15, ring * 0.77, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = i * Math.PI / 4 + time * 0.035;
    const x = cx + Math.cos(a) * ring * 0.77;
    const y = cy - 15 + Math.sin(a) * ring * 0.77;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
  ctx.restore();

  const light = ctx.createRadialGradient(cx, cy - 22, 4, cx, cy - 22, 155);
  light.addColorStop(0, `${theme.glow}2c`);
  light.addColorStop(1, "transparent");
  ctx.fillStyle = light;
  ctx.fillRect(cx - 170, cy - 190, 340, 340);
  this.drawTitleFigure(cx, cy + 25 + Math.sin(time * 1.1) * 4, time);
  this.drawCandle(bounds.left + 27, bounds.bottom - 37, time, theme);
  this.drawCandle(bounds.right - 27, bounds.bottom - 37, time + 1.5, theme);
  this.drawCandle(cx - 190, cy + 100, time + 2.4, theme);
  this.drawCandle(cx + 190, cy + 100, time + 3.2, theme);
  const steps = ctx.createLinearGradient(0, bounds.bottom - 88, 0, bounds.bottom + 36);
  steps.addColorStop(0, "rgba(7,8,13,0)");
  steps.addColorStop(1, "rgba(4,5,8,.92)");
  ctx.fillStyle = steps;
  ctx.fillRect(0, bounds.bottom - 88, this.canvasWidth, 140);
  for (let i = 0; i < 4; i += 1) {
    const inset = i * 25;
    ctx.strokeStyle = `rgba(199, 172, 126, ${0.11 - i * 0.018})`;
    ctx.beginPath();
    ctx.moveTo(cx - 100 - inset, bounds.bottom - 24 + i * 12);
    ctx.lineTo(cx + 100 + inset, bounds.bottom - 24 + i * 12);
    ctx.stroke();
  }
};

VeilfallGame.prototype.drawTitleFigure = function drawTitleFigure(x, y, time) {
  const ctx = this.ctx;
  const scale = 1.12 + Math.sin(time * 1.4) * 0.025;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(230, 189, 120, .38)";
  ctx.shadowBlur = 27;
  ctx.fillStyle = "rgba(11, 12, 18, .89)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 31, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#201d22";
  ctx.beginPath();
  ctx.moveTo(-24, -4);
  ctx.quadraticCurveTo(-22, -46, -14, -53);
  ctx.quadraticCurveTo(-4, -67, 10, -55);
  ctx.quadraticCurveTo(24, -45, 23, -8);
  ctx.quadraticCurveTo(10, 2, -24, -4);
  ctx.fill();
  ctx.fillStyle = "#d9c7a1";
  ctx.beginPath();
  ctx.ellipse(0, -48, 17, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2525";
  ctx.beginPath();
  ctx.moveTo(-18, -46);
  ctx.quadraticCurveTo(-21, -71, -8, -68);
  ctx.lineTo(-2, -59);
  ctx.quadraticCurveTo(8, -74, 18, -62);
  ctx.lineTo(17, -44);
  ctx.quadraticCurveTo(0, -57, -18, -46);
  ctx.fill();
  ctx.fillStyle = "#deaf6d";
  ctx.fillRect(-7, -48, 3, 2);
  ctx.fillRect(5, -48, 3, 2);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "#e8bd72";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const a = time * 0.55 + i * Math.PI * 2 / 3;
    ctx.beginPath();
    ctx.arc(0, -37, 49 + i * 5, a, a + 1.2);
    ctx.stroke();
  }
  ctx.restore();
};

VeilfallGame.prototype.drawCandle = function drawCandle(x, y, time, theme) {
  const ctx = this.ctx;
  const flicker = 0.8 + Math.sin(time * 15) * 0.13 + Math.sin(time * 8.1) * 0.08;
  const glow = ctx.createRadialGradient(x, y - 18, 1, x, y - 15, 49 * flicker);
  glow.addColorStop(0, `${theme.glow}34`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 52, y - 66, 104, 104);
  ctx.fillStyle = "#222027";
  ctx.fillRect(x - 5, y - 13, 10, 28);
  ctx.fillStyle = "#ad9a79";
  ctx.fillRect(x - 2, y - 19, 4, 8);
  ctx.fillStyle = theme.glow;
  ctx.beginPath();
  ctx.ellipse(x, y - 22, 2.6, 6 * flicker, Math.sin(time * 12) * 0.12, 0, Math.PI * 2);
  ctx.fill();
};

VeilfallGame.prototype.drawRoom = function drawRoom(time, bounds, theme) {
  const ctx = this.ctx;
  const room = this.currentRoom;
  const width = bounds.width;
  const height = bounds.height;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.62)";
  ctx.shadowBlur = 48;
  ctx.fillStyle = "#07080d";
  ctx.fillRect(bounds.left - 9, bounds.top - 8, width + 18, height + 17);
  ctx.restore();

  const floor = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
  floor.addColorStop(0, theme.floorColor);
  floor.addColorStop(0.48, `${theme.floorColor}d9`);
  floor.addColorStop(1, "#1c1c23");
  ctx.fillStyle = floor;
  ctx.fillRect(bounds.left, bounds.top, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.left, bounds.top, width, height);
  ctx.clip();
  const light = ctx.createRadialGradient(bounds.centerX, bounds.centerY, 5, bounds.centerX, bounds.centerY, Math.max(width, height) * 0.65);
  light.addColorStop(0, `${theme.glow}12`);
  light.addColorStop(0.48, `${theme.trim}08`);
  light.addColorStop(1, "transparent");
  ctx.fillStyle = light;
  ctx.fillRect(bounds.left, bounds.top, width, height);

  const tile = clamp(width / 18, 36, 57);
  ctx.lineWidth = 1;
  for (let x = bounds.left + tile; x < bounds.right; x += tile) {
    ctx.strokeStyle = "rgba(10,10,15,.15)";
    ctx.beginPath(); ctx.moveTo(x, bounds.top); ctx.lineTo(x, bounds.bottom); ctx.stroke();
    ctx.strokeStyle = "rgba(224,213,185,.026)";
    ctx.beginPath(); ctx.moveTo(x + 1, bounds.top); ctx.lineTo(x + 1, bounds.bottom); ctx.stroke();
  }
  for (let y = bounds.top + tile; y < bounds.bottom; y += tile) {
    ctx.strokeStyle = "rgba(10,10,15,.17)";
    ctx.beginPath(); ctx.moveTo(bounds.left, y); ctx.lineTo(bounds.right, y); ctx.stroke();
    ctx.strokeStyle = "rgba(224,213,185,.024)";
    ctx.beginPath(); ctx.moveTo(bounds.left, y + 1); ctx.lineTo(bounds.right, y + 1); ctx.stroke();
  }
  const detailCount = Math.min(20, Math.floor(width * height / 19000));
  for (let i = 0; i < detailCount; i += 1) {
    const px = bounds.left + ((room.seed * (i + 11) * 0.000037 + i * 0.618) % 1) * width;
    const py = bounds.top + ((room.seed * (i + 5) * 0.000029 + i * 0.382) % 1) * height;
    ctx.strokeStyle = `rgba(7,8,13,${0.07 + (i % 3) * 0.025})`;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 3 + (i % 4) * 2, py + 2 + (i % 3) * 2);
    ctx.stroke();
  }
  ctx.restore();

  const centerAlpha = room.type === "boss" ? 0.12 : room.type === "treasure" ? 0.17 : 0.075;
  ctx.strokeStyle = `${theme.trim}${Math.round(centerAlpha * 255).toString(16).padStart(2, "0")}`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bounds.centerX, bounds.centerY, Math.min(width, height) * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bounds.centerX, bounds.centerY, Math.min(width, height) * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI / 2 + Math.PI / 4;
    const radius = Math.min(width, height) * 0.18;
    const x = bounds.centerX + Math.cos(angle) * radius;
    const y = bounds.centerY + Math.sin(angle) * radius;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
  }

  ctx.strokeStyle = "rgba(216, 200, 171, .14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bounds.left + 6, bounds.top + 6, width - 12, height - 12);
  ctx.strokeStyle = "rgba(8, 9, 13, .7)";
  ctx.lineWidth = 15;
  ctx.strokeRect(bounds.left - 2, bounds.top - 2, width + 4, height + 4);
  ctx.strokeStyle = "rgba(174, 151, 115, .24)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bounds.left - 8, bounds.top - 8, width + 16, height + 16);

  this.drawDoors(time, bounds, room, theme);
  for (const corner of [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.left, bounds.bottom], [bounds.right, bounds.bottom]]) {
    ctx.fillStyle = "rgba(7,8,12,.74)";
    ctx.fillRect(corner[0] - 13, corner[1] - 13, 26, 26);
    ctx.strokeStyle = `${theme.trim}66`;
    ctx.strokeRect(corner[0] - 7, corner[1] - 7, 14, 14);
  }
  if (room.type === "boss") {
    const pulse = 0.35 + Math.sin(time * 1.5) * 0.12;
    const halo = ctx.createRadialGradient(bounds.centerX, bounds.centerY, 0, bounds.centerX, bounds.centerY, 94);
    halo.addColorStop(0, `${theme.danger}${Math.floor(pulse * 110).toString(16).padStart(2, "0")}`);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.fillRect(bounds.centerX - 100, bounds.centerY - 100, 200, 200);
  }
};

VeilfallGame.prototype.drawDoors = function drawDoors(time, bounds, room, theme) {
  const ctx = this.ctx;
  const neighbors = this.neighbors(room);
  const directions = [
    ["left", bounds.left, bounds.centerY, Math.PI / 2],
    ["right", bounds.right, bounds.centerY, -Math.PI / 2],
    ["up", bounds.centerX, bounds.top, 0],
    ["down", bounds.centerX, bounds.bottom, Math.PI],
  ];
  for (const [direction, x, y, angle] of directions) {
    if (!neighbors[direction]) continue;
    const open = room.cleared;
    const locked = neighbors[direction].locked;
    const doorColor = locked ? "#b58bc4" : open ? theme.glow : theme.danger;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const pulse = open ? 0.7 + Math.sin(time * 2.4) * 0.18 : 0.3;
    const glow = ctx.createRadialGradient(0, -1, 3, 0, -1, 54);
    glow.addColorStop(0, `${doorColor}${Math.floor(pulse * 60).toString(16).padStart(2, "0")}`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(-58, -50, 116, 70);
    ctx.fillStyle = open ? "#121319" : "#20191b";
    ctx.fillRect(-23, -5, 46, 19);
    ctx.beginPath();
    ctx.moveTo(-23, 10);
    ctx.lineTo(-23, -7);
    ctx.quadraticCurveTo(-23, -34, 0, -34);
    ctx.quadraticCurveTo(23, -34, 23, -7);
    ctx.lineTo(23, 10);
    ctx.closePath();
    ctx.fillStyle = open ? "#17171c" : "#21191c";
    ctx.fill();
    ctx.strokeStyle = `${doorColor}${open ? "c9" : "69"}`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, 11);
    ctx.lineTo(-25, -8);
    ctx.quadraticCurveTo(-25, -37, 0, -37);
    ctx.quadraticCurveTo(25, -37, 25, -8);
    ctx.lineTo(25, 11);
    ctx.stroke();
    if (open) {
      ctx.fillStyle = `${doorColor}b3`;
      ctx.fillRect(-1, -6, 2, 12);
    } else {
      ctx.strokeStyle = `${doorColor}7a`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(8, 3); ctx.stroke();
    }
    ctx.restore();
  }
};

VeilfallGame.prototype.drawHazards = function drawHazards(time, room) {
  const ctx = this.ctx;
  for (const hazard of room.hazards) {
    const pulse = 0.78 + Math.sin(hazard.clock * 2.2) * 0.13;
    const color = hazard.kind === "ember" ? "#e87843" : hazard.kind === "pool" ? "#6eb2b0" : hazard.kind === "shard" ? "#d7b75f" : hazard.kind === "spore" ? "#9cba63" : "#a49bd1";
    const active = hazard.active !== false;
    ctx.save();
    ctx.globalAlpha = active ? 0.68 : 0.2;
    const glow = ctx.createRadialGradient(hazard.x, hazard.y, 3, hazard.x, hazard.y, hazard.r * 1.7);
    glow.addColorStop(0, `${color}58`);
    glow.addColorStop(0.55, `${color}1c`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(hazard.x - hazard.r * 1.8, hazard.y - hazard.r * 1.8, hazard.r * 3.6, hazard.r * 3.6);
    ctx.beginPath();
    ctx.ellipse(hazard.x, hazard.y, hazard.r * (1 + pulse * 0.03), hazard.r * 0.67, Math.sin(hazard.clock) * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = `${color}22`;
    ctx.fill();
    ctx.strokeStyle = `${color}9a`;
    ctx.lineWidth = 1;
    ctx.setLineDash(hazard.kind === "pool" ? [4, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i += 1) {
      const angle = i * 2.1 + hazard.clock * (hazard.kind === "pool" ? 0.25 : 0.8);
      const x = hazard.x + Math.cos(angle) * hazard.r * (0.22 + i * 0.14);
      const y = hazard.y + Math.sin(angle) * hazard.r * (0.15 + i * 0.12);
      ctx.fillStyle = `${color}8a`;
      ctx.beginPath(); ctx.arc(x, y, hazard.kind === "ember" ? 2 + Math.sin(time * 11 + i) : 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
};

VeilfallGame.prototype.drawProps = function drawProps(room) {
  const ctx = this.ctx;
  for (const prop of room.props) {
    if (prop.hp <= 0) continue;
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(2, prop.r * 0.67, prop.r * 1.08, prop.r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    if (prop.kind === "pillar") {
      const stone = ctx.createLinearGradient(-prop.r, 0, prop.r, 0);
      stone.addColorStop(0, "#29272b"); stone.addColorStop(0.3, "#6b625a"); stone.addColorStop(0.55, "#514b48"); stone.addColorStop(1, "#27262b");
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.ellipse(0, 2, prop.r, prop.r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(213,194,163,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, -1, prop.r * 0.72, prop.r * 0.43, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#3f3b3a";
      ctx.beginPath(); ctx.ellipse(0, -prop.r * 0.42, prop.r * 0.82, prop.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(225,202,158,.3)";
      ctx.beginPath(); ctx.ellipse(0, -prop.r * 0.43, prop.r * 0.82, prop.r * 0.35, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(219,184,120,.48)";
      ctx.fillRect(-1, -prop.r * 0.73, 2, 8);
    } else {
      ctx.fillStyle = "#5b493e";
      ctx.beginPath(); ctx.moveTo(-prop.r * 0.7, prop.r * 0.4); ctx.lineTo(-prop.r * 0.8, -prop.r * 0.2); ctx.quadraticCurveTo(0, -prop.r * 1.4, prop.r * 0.8, -prop.r * 0.2); ctx.lineTo(prop.r * 0.65, prop.r * 0.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(215,180,132,.3)"; ctx.stroke();
      ctx.fillStyle = "rgba(234,188,111,.42)"; ctx.beginPath(); ctx.ellipse(0, -prop.r * 0.8, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
};

VeilfallGame.prototype.drawObjects = function drawObjects(time, room) {
  const ctx = this.ctx;
  const theme = this.theme();
  const bounds = this.getBounds();
  for (const object of room.objects) {
    if (object.taken) continue;
    const bob = Math.sin(time * 2.5 + object.x * 0.03) * 3;
    if (["item", "shop-item", "devil-deal", "angel-item"].includes(object.kind)) {
      const item = ITEMS.find((entry) => entry.id === object.itemId) || ITEMS[0];
      const y = object.y + bob;
      const glow = ctx.createRadialGradient(object.x, y - 7, 2, object.x, y - 7, 47);
      glow.addColorStop(0, `${item.color}46`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(object.x - 52, y - 58, 104, 100);
      ctx.fillStyle = "rgba(0,0,0,.32)";
      ctx.beginPath(); ctx.ellipse(object.x, object.y + 19, 27, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#38332f";
      ctx.beginPath(); ctx.moveTo(object.x - 20, object.y + 14); ctx.lineTo(object.x - 13, object.y + 4); ctx.lineTo(object.x + 13, object.y + 4); ctx.lineTo(object.x + 20, object.y + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(231,204,155,.55)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#75634d"; ctx.fillRect(object.x - 13, object.y - 5, 26, 10);
      ctx.fillStyle = "#2b2829"; ctx.fillRect(object.x - 17, object.y - 8, 34, 5);
      ctx.save();
      ctx.translate(object.x, y - 21);
      ctx.rotate(Math.sin(time * 1.3 + object.x) * 0.08);
      ctx.shadowColor = item.color; ctx.shadowBlur = 18;
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#17171a";
      ctx.font = "bold 11px Georgia, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(item.mark, 0, 1);
      ctx.restore();
      if (object.kind === "shop-item" || object.kind === "devil-deal") {
        ctx.fillStyle = "rgba(11,12,16,.78)";
        ctx.fillRect(object.x - 30, object.y + 23, 60, 16);
        ctx.fillStyle = object.kind === "devil-deal" ? "#df8b82" : "#e7cb8b";
        ctx.font = "8px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(object.kind === "devil-deal" ? "1 HEART" : `${object.cost} COIN`, object.x, object.y + 31);
      }
    } else if (object.kind === "exit") {
      const x = object.x;
      const y = object.y + bob * 0.4;
      const pulse = 0.55 + Math.sin(time * 2) * 0.2;
      const color = this.floorNo === THEMES.length ? "#b9d5cf" : theme.glow;
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 66);
      glow.addColorStop(0, `${color}55`); glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.strokeStyle = `${color}a8`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 22 + pulse * 2, 31 + pulse * 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `${color}55`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, 14, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `${color}32`;
      ctx.beginPath(); ctx.ellipse(x, y, 13, 23, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i += 1) {
        const a = time * 0.7 + i * Math.PI * 2 / 3;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 28, y + Math.sin(a) * 31, 2.3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (object.kind === "altar") {
      const x = object.x;
      const y = object.y;
      ctx.save();
      ctx.strokeStyle = "rgba(183,87,89,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 42, 29, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(219,171,132,.5)";
      ctx.beginPath(); ctx.ellipse(x, y, 31, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#393032";
      ctx.beginPath(); ctx.ellipse(x, y, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c2686a";
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (["coin", "heart", "key", "bomb"].includes(object.kind)) {
      const x = object.x;
      const y = object.y + bob * 0.6;
      ctx.save();
      ctx.shadowColor = object.kind === "heart" ? "#e77b73" : object.kind === "key" ? "#9acbb8" : "#e6c779";
      ctx.shadowBlur = 11;
      ctx.fillStyle = object.kind === "heart" ? "#d77770" : object.kind === "key" ? "#9dc9b5" : object.kind === "bomb" ? "#d59368" : "#e2bd6a";
      ctx.strokeStyle = "rgba(255,238,193,.75)"; ctx.lineWidth = 1;
      if (object.kind === "coin") {
        ctx.beginPath(); ctx.ellipse(x, y, 9, 11, Math.sin(time + x) * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = "#483c2b"; ctx.font = "bold 8px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", x, y + 0.5);
      } else if (object.kind === "heart") {
        drawHeartIcon(ctx, x, y, 22, "#e18176");
      } else if (object.kind === "key") {
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x - 3, y - 3, 5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x + 9, y + 5); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + 6, y + 10); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(x, y + 1, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#353134"; ctx.fillRect(x - 2, y - 10, 4, 3); ctx.strokeStyle = "#c7a581"; ctx.beginPath(); ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 8, y - 8); ctx.stroke();
      }
      ctx.restore();
      if (object.amount > 1 && object.kind === "coin") {
        ctx.font = "8px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#e5d4aa"; ctx.fillText(`x${object.amount}`, x, y + 12);
      }
    } else if (object.kind === "shop-heart" || object.kind === "shop-bomb") {
      const isHeart = object.kind === "shop-heart";
      const x = object.x;
      const y = object.y;
      ctx.fillStyle = "rgba(0,0,0,.29)";
      ctx.beginPath(); ctx.ellipse(x, y + 20, 27, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4b3e34"; ctx.fillRect(x - 21, y + 8, 42, 9);
      ctx.fillStyle = isHeart ? "#dc7971" : "#d69569";
      ctx.shadowColor = isHeart ? "#e77b73" : "#d69569"; ctx.shadowBlur = 10;
      ctx.font = "20px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (isHeart) drawHeartIcon(ctx, x, y - 5, 21, "#dc7971");
      else ctx.fillText("Q", x, y - 5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e6ca8b"; ctx.font = "8px ui-sans-serif, system-ui, sans-serif"; ctx.fillText(`${object.cost} COIN`, x, y + 29);
    }
  }
};

VeilfallGame.prototype.drawEnemies = function drawEnemies(time, room) {
  const ctx = this.ctx;
  for (const enemy of room.enemies) {
    if (enemy.dead) continue;
    if (enemy.bossDef) this.drawBoss(time, enemy);
    else this.drawEnemy(time, enemy);
  }
};

VeilfallGame.prototype.drawEnemy = function drawEnemy(time, enemy) {
  const ctx = this.ctx;
  const bob = Math.sin(enemy.wobble) * (enemy.type === "gnat" ? 2.6 : 1.5);
  const alpha = enemy.type === "wraith" ? (Math.sin(time * 3 + enemy.wobble) > 0.4 ? 0.64 : 0.91) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(enemy.x, enemy.y + bob);
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath(); ctx.ellipse(0, enemy.r * 0.8, enemy.r * 1.08, enemy.r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, enemy.r * 1.8);
  glow.addColorStop(0, `${enemy.color}1d`); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(-enemy.r * 2, -enemy.r * 2, enemy.r * 4, enemy.r * 4);
  if (enemy.state === "windup" || enemy.state === "tell" || enemy.state === "fuse") {
    ctx.strokeStyle = enemy.state === "fuse" ? "#ee9b56" : "rgba(232,117,101,.74)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + 7 + Math.sin(time * 12) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (enemy.state !== "fuse") {
      const aimX = enemy.chargeX || 0;
      const aimY = enemy.chargeY || 0;
      ctx.strokeStyle = "rgba(224,108,96,.28)";
      ctx.beginPath(); ctx.moveTo(aimX * enemy.r, aimY * enemy.r); ctx.lineTo(aimX * 135, aimY * 135); ctx.stroke();
    }
  }
  const body = enemy.flash > 0 ? "#fff1de" : enemy.color;
  if (enemy.type === "gnat") {
    ctx.fillStyle = "rgba(186, 202, 178, .58)";
    ctx.beginPath(); ctx.ellipse(-7, -3, 8, 3, -0.6 + Math.sin(time * 23) * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -3, 8, 3, 0.6 - Math.sin(time * 23) * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 1, enemy.r * 0.78, enemy.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  } else if (enemy.type === "spitter" || enemy.type === "blossom") {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 4, enemy.r * 0.8, enemy.r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -6, enemy.r * 0.98, enemy.r * 0.56, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(33,39,29,.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -6, enemy.r * 0.63, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#1f2420"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (enemy.type === "turret") {
    ctx.fillStyle = "#43352d";
    ctx.beginPath(); ctx.moveTo(-enemy.r, 7); ctx.lineTo(-enemy.r * 0.75, -9); ctx.lineTo(0, -enemy.r - 1); ctx.lineTo(enemy.r * 0.75, -9); ctx.lineTo(enemy.r, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e0b46f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(11, 10); ctx.stroke();
  } else if (enemy.type === "wraith") {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-enemy.r, 11); ctx.quadraticCurveTo(-enemy.r * 1.1, -13, -2, -enemy.r); ctx.quadraticCurveTo(enemy.r * 1.15, -enemy.r * 0.85, enemy.r, 12); ctx.lineTo(6, 7); ctx.lineTo(0, 14); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
  } else if (enemy.type === "shield") {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 1, enemy.r * 0.9, enemy.r * 0.76, 0, 0, Math.PI * 2); ctx.fill();
    const faceAngle = Math.atan2(enemy.facingY, enemy.facingX);
    ctx.save(); ctx.rotate(faceAngle);
    ctx.fillStyle = "#3b4543"; ctx.strokeStyle = "#c7c8ae"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(enemy.r * 0.15, -enemy.r * 0.72); ctx.lineTo(enemy.r + 3, -enemy.r * 0.55); ctx.lineTo(enemy.r + 4, 0); ctx.lineTo(enemy.r + 3, enemy.r * 0.55); ctx.lineTo(enemy.r * 0.15, enemy.r * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (enemy.type === "bomber") {
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 1, enemy.r * 0.84, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a3731"; ctx.beginPath(); ctx.moveTo(-6, -enemy.r * 0.6); ctx.lineTo(-2, -enemy.r - 7); ctx.lineTo(3, -enemy.r * 0.54); ctx.fill();
    ctx.strokeStyle = "#e2a561"; ctx.beginPath(); ctx.moveTo(0, -enemy.r - 4); ctx.lineTo(5, -enemy.r - 8); ctx.stroke();
  } else {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, enemy.r * 0.91, enemy.r * 0.78, Math.sin(enemy.wobble) * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(34,25,25,.55)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-2, 0, enemy.r * 0.54, Math.PI * 0.15, Math.PI * 0.88); ctx.stroke();
    if (enemy.type === "brute") {
      ctx.fillStyle = "#58413f";
      ctx.beginPath(); ctx.moveTo(-enemy.r * 0.7, -enemy.r * 0.55); ctx.lineTo(-enemy.r - 6, -enemy.r - 5); ctx.lineTo(-enemy.r * 0.15, -enemy.r * 0.45); ctx.fill();
      ctx.beginPath(); ctx.moveTo(enemy.r * 0.7, -enemy.r * 0.55); ctx.lineTo(enemy.r + 6, -enemy.r - 5); ctx.lineTo(enemy.r * 0.15, -enemy.r * 0.45); ctx.fill();
    }
  }
  ctx.fillStyle = "#1d1a1c";
  ctx.beginPath(); ctx.ellipse(-4, -2, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, -2, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  if (enemy.elite) {
    ctx.strokeStyle = "rgba(238,196,126,.88)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#edc278"; ctx.beginPath(); ctx.moveTo(-6, -enemy.r - 4); ctx.lineTo(-2, -enemy.r - 11); ctx.lineTo(0, -enemy.r - 4); ctx.lineTo(3, -enemy.r - 12); ctx.lineTo(7, -enemy.r - 4); ctx.closePath(); ctx.fill();
  }
  if (enemy.hp < enemy.maxHp && enemy.hp > 0) {
    ctx.fillStyle = "rgba(7,8,11,.8)"; ctx.fillRect(-enemy.r, enemy.r + 7, enemy.r * 2, 3);
    ctx.fillStyle = enemy.elite ? "#dfb86e" : "#cc7b6f"; ctx.fillRect(-enemy.r, enemy.r + 7, enemy.r * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
  }
  if (enemy.burn > 0) {
    ctx.fillStyle = "#f29a56"; ctx.beginPath(); ctx.arc(Math.sin(time * 12) * 8, -enemy.r - 3, 2, 0, Math.PI * 2); ctx.fill();
  }
  if (enemy.poison > 0) {
    ctx.strokeStyle = "rgba(179,210,119,.7)"; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
};

VeilfallGame.prototype.drawBoss = function drawBoss(time, enemy) {
  const ctx = this.ctx;
  const s = 1 + Math.sin(time * 2.4) * 0.025;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.ellipse(0, enemy.r * 0.8, enemy.r * 1.33, enemy.r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, enemy.r * 2.15);
  glow.addColorStop(0, `${enemy.color}43`); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(-enemy.r * 2.3, -enemy.r * 2.3, enemy.r * 4.6, enemy.r * 4.6);
  for (let ring = 0; ring < 2; ring += 1) {
    ctx.save();
    ctx.rotate(time * (ring ? -0.22 : 0.16) + ring * 0.8);
    ctx.strokeStyle = `${enemy.color}${ring ? "42" : "77"}`;
    ctx.lineWidth = ring ? 1 : 1.5;
    ctx.setLineDash(ring ? [4, 7] : []);
    ctx.beginPath(); ctx.ellipse(0, 0, enemy.r + 13 + ring * 12, enemy.r * 0.72 + 10 + ring * 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2;
      ctx.fillStyle = enemy.color;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * (enemy.r + 13 + ring * 12), Math.sin(angle) * (enemy.r * 0.72 + 10 + ring * 7), ring ? 1.5 : 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  const body = enemy.flash > 0 ? "#fff0dd" : enemy.color;
  ctx.fillStyle = "#262229";
  ctx.beginPath();
  ctx.moveTo(-enemy.r * 0.92, enemy.r * 0.43);
  ctx.lineTo(-enemy.r * 0.79, -enemy.r * 0.27);
  ctx.lineTo(-enemy.r * 0.47, -enemy.r * 0.57);
  ctx.lineTo(-enemy.r * 0.36, -enemy.r * 0.88);
  ctx.lineTo(-enemy.r * 0.06, -enemy.r * 0.61);
  ctx.lineTo(enemy.r * 0.19, -enemy.r * 0.95);
  ctx.lineTo(enemy.r * 0.38, -enemy.r * 0.58);
  ctx.lineTo(enemy.r * 0.83, -enemy.r * 0.39);
  ctx.lineTo(enemy.r * 0.95, enemy.r * 0.47);
  ctx.quadraticCurveTo(0, enemy.r * 1.06, -enemy.r * 0.92, enemy.r * 0.43);
  ctx.fill();
  ctx.strokeStyle = `${body}b8`; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, -2, enemy.r * 0.58, enemy.r * 0.56, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a171d";
  ctx.beginPath(); ctx.ellipse(-enemy.r * 0.24, -2, 4, 6, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(enemy.r * 0.24, -2, 4, 6, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f1d09a";
  ctx.beginPath(); ctx.arc(-enemy.r * 0.23, -4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(enemy.r * 0.25, -4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `${body}9c`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-enemy.r * 0.25, enemy.r * 0.34); ctx.quadraticCurveTo(0, enemy.r * 0.47, enemy.r * 0.25, enemy.r * 0.34); ctx.stroke();
  if (enemy.phase === 2) {
    ctx.strokeStyle = `rgba(255,231,194,${0.44 + Math.sin(time * 8) * 0.18})`;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 6, 0, Math.PI * 2); ctx.stroke();
  }
  if (enemy.state === "tell") {
    ctx.save();
    ctx.globalAlpha = 0.24 + Math.sin(time * 14) * 0.09;
    ctx.strokeStyle = "#f28376"; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo((enemy.chargeX || 0) * enemy.r, (enemy.chargeY || 0) * enemy.r); ctx.lineTo((enemy.chargeX || 0) * 185, (enemy.chargeY || 0) * 185); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

VeilfallGame.prototype.drawShots = function drawShots(time, room) {
  const ctx = this.ctx;
  for (const shot of room.shots) {
    const angle = Math.atan2(shot.vy, shot.vx);
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(angle);
    ctx.shadowColor = shot.color;
    ctx.shadowBlur = shot.owner === "player" ? 10 : 8;
    if (shot.owner === "player") {
      ctx.fillStyle = `${shot.color}46`;
      ctx.beginPath(); ctx.ellipse(-shot.r * 1.8, 0, shot.r * 2.4, shot.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shot.color;
      ctx.beginPath(); ctx.ellipse(0, 0, shot.r * 1.35, shot.r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.beginPath(); ctx.ellipse(shot.r * 0.25, -shot.r * 0.22, shot.r * 0.32, shot.r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = `${shot.color}65`;
      ctx.beginPath(); ctx.ellipse(-shot.r * 1.2, 0, shot.r * 1.8, shot.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shot.color;
      ctx.beginPath(); ctx.arc(0, 0, shot.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,240,213,.6)";
      ctx.beginPath(); ctx.arc(1, -1, shot.r * 0.34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (shot.owner === "player" && this.player?.stats.chain > 0 && time % 0.25 < 0.025) {
      ctx.globalAlpha = 0.18; ctx.strokeStyle = shot.color; ctx.beginPath(); ctx.arc(shot.x, shot.y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
};

VeilfallGame.prototype.drawPlayer = function drawPlayer(time, player) {
  if (!player) return;
  const ctx = this.ctx;
  const blink = player.invuln > 0 && Math.floor(time * 18) % 2 === 0;
  if (blink) return;
  const x = player.x;
  const y = player.y + Math.sin(time * 5) * 1.1;
  const color = player.character.color;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.46)";
  ctx.beginPath(); ctx.ellipse(0, player.r * 0.77, player.r * 1.2, player.r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  if (player.dashTime > 0) {
    ctx.strokeStyle = `${player.stats.shade}65`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-player.dashX * 10, -player.dashY * 10); ctx.lineTo(-player.dashX * 42, -player.dashY * 42); ctx.stroke();
  }
  if (player.stats.wisp) {
    ctx.strokeStyle = "rgba(143,221,215,.45)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -4, 20 + Math.sin(time * 2) * 2, 26, time * 0.35, 0, Math.PI * 2); ctx.stroke();
  }
  if (player.items.includes("ember-crown")) {
    ctx.strokeStyle = "rgba(236,147,91,.62)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -5, 23, 28, time * 0.28, 0, Math.PI * 2); ctx.stroke();
  }
  if (player.items.includes("static-halo")) {
    ctx.strokeStyle = "rgba(147,215,209,.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -11, 19, 10, -0.1, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-player.r * 0.95, -1);
  ctx.quadraticCurveTo(-player.r * 1.05, -20, -player.r * 0.52, -23);
  ctx.quadraticCurveTo(0, -30, player.r * 0.56, -22);
  ctx.quadraticCurveTo(player.r * 1.05, -12, player.r * 0.93, 0);
  ctx.quadraticCurveTo(player.r * 0.5, 7, 0, 8);
  ctx.quadraticCurveTo(-player.r * 0.54, 7, -player.r * 0.95, -1);
  ctx.fill();
  ctx.strokeStyle = "rgba(250,232,197,.42)"; ctx.lineWidth = 1; ctx.stroke();
  const robe = ctx.createLinearGradient(-player.r, 0, player.r, 0);
  robe.addColorStop(0, "#474044"); robe.addColorStop(0.48, "#80715f"); robe.addColorStop(1, "#353039");
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-player.r * 0.9, -3);
  ctx.quadraticCurveTo(-player.r * 1.15, 12, -player.r * 1.38, 23);
  ctx.quadraticCurveTo(0, 31, player.r * 1.38, 23);
  ctx.quadraticCurveTo(player.r * 1.15, 12, player.r * 0.9, -3);
  ctx.quadraticCurveTo(0, 3, -player.r * 0.9, -3);
  ctx.fill();
  ctx.strokeStyle = "rgba(227,203,163,.36)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#b99b70";
  ctx.beginPath(); ctx.ellipse(0, 0, player.r * 0.95, player.r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#282328";
  ctx.beginPath(); ctx.moveTo(-player.r * 1.05, -6); ctx.quadraticCurveTo(-player.r * 0.75, -player.r * 1.8, 0, -player.r * 1.65); ctx.quadraticCurveTo(player.r * 0.85, -player.r * 1.45, player.r * 1.05, -5); ctx.quadraticCurveTo(0, -player.r * 1.1, -player.r * 1.05, -6); ctx.fill();
  ctx.strokeStyle = "rgba(224,193,137,.58)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-player.r, -6); ctx.quadraticCurveTo(0, -player.r * 1.24, player.r, -6); ctx.stroke();
  const eyeAngle = player.facing;
  ctx.fillStyle = player.stats.wisp ? "#d8ffff" : "#f2d08e";
  ctx.shadowColor = player.stats.wisp ? "#8be4db" : "#e7bd72";
  ctx.shadowBlur = 7;
  const eyeX = Math.cos(eyeAngle) * 3;
  const eyeY = -9 + Math.sin(eyeAngle) * 2;
  ctx.fillRect(eyeX - 4, eyeY, 3, 2);
  ctx.fillRect(eyeX + 2, eyeY, 3, 2);
  ctx.shadowBlur = 0;
  if (player.character.id === "moth") {
    ctx.fillStyle = "rgba(166,202,183,.68)";
    ctx.beginPath(); ctx.ellipse(-player.r * 1.15, -10, 7, 11, -0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(player.r * 1.15, -10, 7, 11, 0.55, 0, Math.PI * 2); ctx.fill();
  } else if (player.character.id === "warden") {
    ctx.strokeStyle = "#d3b886"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(-12, -27); ctx.lineTo(-5, -23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -20); ctx.lineTo(12, -27); ctx.lineTo(5, -23); ctx.stroke();
  }
  if (player.shield > 0) {
    ctx.strokeStyle = "rgba(158,218,205,.62)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -4, player.r + 7 + Math.sin(time * 2) * 1.3, 0, Math.PI * 2); ctx.stroke();
  }
  const itemCount = player.items.length;
  if (itemCount > 2) {
    for (let i = 0; i < 3; i += 1) {
      const a = time * 0.8 + i * Math.PI * 2 / 3;
      ctx.fillStyle = `${player.stats.shade}ac`;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 22, -5 + Math.sin(a) * 21, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
};

VeilfallGame.prototype.drawParticles = function drawParticles() {
  const ctx = this.ctx;
  for (const particle of this.particles) {
    const ratio = clamp(particle.life / particle.max, 0, 1);
    if (particle.ring) {
      ctx.save();
      ctx.globalAlpha = ratio * 0.75;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * (1 - ratio * 0.72), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (particle.line) {
      ctx.save();
      ctx.globalAlpha = ratio;
      ctx.strokeStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = particle.size;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      const dx = particle.tx - particle.x;
      const dy = particle.ty - particle.y;
      const segments = 6;
      for (let i = 1; i < segments; i += 1) {
        const n = Math.sin(i * 17.2 + particle.tx * 0.02) * 6;
        ctx.lineTo(particle.x + dx * (i / segments) + n, particle.y + dy * (i / segments) - n * 0.6);
      }
      ctx.lineTo(particle.tx, particle.ty);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.globalAlpha = ratio;
      ctx.fillStyle = particle.color;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * (0.48 + ratio * 0.52), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
};

VeilfallGame.prototype.drawFloatingText = function drawFloatingText() {
  const ctx = this.ctx;
  for (const text of this.texts) {
    ctx.save();
    ctx.globalAlpha = clamp(text.life / text.max, 0, 1);
    ctx.fillStyle = text.color;
    ctx.strokeStyle = "rgba(8,9,12,.8)";
    ctx.lineWidth = 3;
    ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }
};

VeilfallGame.prototype.drawVignette = function drawVignette() {
  const ctx = this.ctx;
  const w = this.canvasWidth;
  const h = this.canvasHeight;
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.49, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.72, "rgba(4,5,8,.16)");
  vignette.addColorStop(1, "rgba(2,3,5,.73)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  if (this.shake > 0.1) {
    ctx.fillStyle = `rgba(225,177,108,${Math.min(0.06, this.shake / 210)})`;
    ctx.fillRect(0, 0, w, h);
  }
};







