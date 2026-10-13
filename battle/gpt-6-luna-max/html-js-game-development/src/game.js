const WORLD = { width: 960, height: 560, left: 48, right: 912, top: 44, bottom: 516 };
const SAVE_KEY = "vesper-hollow-profile-v1";
const DIFFICULTIES = {
  Pilgrim: { hp: 0.78, speed: 0.88, damage: 0.7, count: 0.84, label: "A kinder descent" },
  Hollow: { hp: 1, speed: 1, damage: 1, count: 1, label: "The house is awake" },
  Torment: { hp: 1.28, speed: 1.16, damage: 1.42, count: 1.25, label: "No mercy below" },
};

const CHARACTERS = {
  pilgrim: { name: "The Pilgrim", mark: "P", hp: 6, speed: 206, damage: 1, fireDelay: 0.34, desc: "A steady hand. One spare heart." },
  moth: { name: "The Moth", mark: "M", hp: 4, speed: 244, damage: 0.94, fireDelay: 0.31, desc: "Quick feet. Finds the dark between shots.", cost: 22 },
  bellkeeper: { name: "Bellkeeper", mark: "B", hp: 8, speed: 184, damage: 1.07, fireDelay: 0.39, desc: "An iron heart and a very old bell.", cost: 30 },
  ashborn: { name: "Ashborn", mark: "A", hp: 5, speed: 205, damage: 1.42, fireDelay: 0.37, desc: "Hits hard. The house hits harder.", cost: 42 },
};

const UPGRADES = {
  heart: { name: "Second Breath", mark: "+", desc: "Begin each descent with one extra heart container.", costs: [6, 10, 16, 24] },
  eye: { name: "Witchglass Eye", mark: "o", desc: "Permanent tear damage, +8% per seal.", costs: [7, 11, 17, 25, 36] },
  feather: { name: "Quiet Soles", mark: "^", desc: "Move a little faster, +4% per seal.", costs: [6, 10, 15, 22] },
  purse: { name: "Saint's Purse", mark: "$", desc: "Carry one extra coin into every run.", costs: [5, 9, 16] },
};

const ITEMS = [
  { id: "moon-milk", name: "Moon Milk", mark: "m", line: "Tears come quicker. Fire rate +22%.", apply: (p) => { p.fireDelay *= 0.78; } },
  { id: "glass-saint", name: "Glass Saint", mark: "g", line: "Every tear carries a harder truth. Damage +34%.", apply: (p) => { p.damage *= 1.34; } },
  { id: "twin-candle", name: "Twin Candle", mark: "2", line: "Two tears, splayed wide. A little less force.", apply: (p) => { p.shotCount += 1; p.damage *= 0.83; } },
  { id: "hemlock", name: "Hemlock Rosary", mark: "h", line: "Tears poison anything they touch.", apply: (p) => { p.poison = true; } },
  { id: "echo-chamber", name: "Echo Chamber", mark: "e", line: "Tears pass through one extra body.", apply: (p) => { p.pierce += 1; } },
  { id: "black-mirror", name: "Black Mirror", mark: "b", line: "A dark reflection follows your last shot.", apply: (p) => { p.ricochet = true; } },
  { id: "burial-boots", name: "Burial Boots", mark: "^", line: "Walk like the ground owes you money. Speed +9%.", apply: (p) => { p.speed *= 1.09; } },
  { id: "saint-heart", name: "Saint's Heart", mark: "<3", line: "Gain one heart container and heal it fully.", apply: (p) => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); } },
  { id: "long-thread", name: "Long Thread", mark: "~", line: "Tears travel farther and hit harder. +18% damage.", apply: (p) => { p.range *= 1.35; p.damage *= 1.18; } },
  { id: "firefly", name: "Little Firefly", mark: "*", line: "A familiar spits a seeking spark every second.", apply: (p) => { p.familiar = true; } },
  { id: "moth-orbit", name: "Orbit of Moths", mark: "o", line: "Two hungry motes circle and bite nearby foes.", apply: (p) => { p.orbitals += 2; } },
  { id: "baptism", name: "Baptismal Water", mark: "w", line: "A hit splashes a little damage into the crowd.", apply: (p) => { p.splash = true; } },
  { id: "bell-dusk", name: "Bell of Dusk", mark: "d", line: "The active relic returns 25% sooner.", apply: (p) => { p.activeRate *= 0.75; } },
  { id: "bad-penny", name: "Bad Penny", mark: "$", line: "Found coins are worth double. Begin with 3 coins.", apply: (p, r) => { p.coinBonus += 1; r.coins += 3; } },
  { id: "bone-dice", name: "Bone Dice", mark: "6", line: "An old wager. Damage +18%, but your tears drift.", apply: (p) => { p.damage *= 1.18; p.wobble = true; } },
  { id: "salt-circle", name: "Circle of Salt", mark: "s", line: "The first hit in every room does not hurt you.", apply: (p) => { p.saltWard = true; } },
  { id: "sable-compass", name: "Sable Compass", mark: "c", line: "Your active relic becomes a room-wide time snare.", apply: (p) => { p.active = "Compass"; } },
];

const FLOORS = ["THE FLOODED VESTRY", "THE CINDER CHOIR", "THE BONE ORCHARD", "THE GLASS NURSERY", "THE BLACK TIDE", "THE HOUSE WITHOUT A FACE"];
const FLOOR_SUBTITLES = ["Where the bells have drowned", "Where no hymn ends", "Where roots remember", "Where the glass learns to breathe", "Where the water turns black", "Where your shadow waits"];
const BOSS_NAMES = ["The Bellmouth", "The Choir of Teeth", "Mother Silt", "The Face Behind You", "The Red Gardener", "The Clockmaker", "The Hunger Below", "The House Heart"];
const FLOOR_PALETTES = [
  { glow: "#26342f", light: "#26312c", mid: "#202722", deep: "#1a211f", edge: "#56746b", stain: "rgba(70,135,124,.11)", line: "rgba(165,200,184,.045)" },
  { glow: "#39251f", light: "#30231e", mid: "#261d1a", deep: "#211917", edge: "#825346", stain: "rgba(172,76,53,.12)", line: "rgba(221,164,127,.04)" },
  { glow: "#343226", light: "#2e2b22", mid: "#25241e", deep: "#20211d", edge: "#77704e", stain: "rgba(153,144,94,.11)", line: "rgba(213,202,158,.04)" },
  { glow: "#302937", light: "#2a2531", mid: "#231f29", deep: "#1d1b24", edge: "#76628a", stain: "rgba(152,126,193,.11)", line: "rgba(211,187,233,.045)" },
  { glow: "#1d3034", light: "#202b2e", mid: "#1b2427", deep: "#171f22", edge: "#4d747b", stain: "rgba(58,117,128,.13)", line: "rgba(172,206,204,.04)" },
  { glow: "#392521", light: "#302321", mid: "#261c1c", deep: "#211819", edge: "#8e5650", stain: "rgba(156,63,64,.12)", line: "rgba(228,162,146,.045)" },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
let gameplayRandom = Math.random;
const pick = (list) => list[Math.floor(gameplayRandom() * list.length)];
const rand = (min, max) => min + gameplayRandom() * (max - min);
const fxRand = (min, max) => min + Math.random() * (max - min);
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function freshProfile() {
  return {
    embers: 12,
    upgrades: { heart: 0, eye: 0, feather: 0, purse: 0 },
    unlocked: ["pilgrim"],
    totalRuns: 0,
    victories: 0,
    bestFloor: 0,
    bestScore: 0,
    totalKills: 0,
    settings: { volume: 0.34, muted: false, difficulty: "Hollow" },
  };
}

function loadProfile() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return freshProfile();
    const saved = JSON.parse(raw);
    const base = freshProfile();
    return {
      ...base,
      ...saved,
      embers: Math.max(0, Number(saved.embers) || 0),
      upgrades: { ...base.upgrades, ...(saved.upgrades || {}) },
      unlocked: Array.isArray(saved.unlocked) ? [...new Set(["pilgrim", ...saved.unlocked.filter((id) => CHARACTERS[id])])] : ["pilgrim"],
      settings: { ...base.settings, ...(saved.settings || {}) },
    };
  } catch (_) {
    return freshProfile();
  }
}

class HollowAudio {
  constructor(profile) {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.timer = null;
    this.step = 0;
    this.mode = "menu";
    const savedVolume = Number(profile.settings.volume);
    this.volume = clamp(Number.isFinite(savedVolume) ? savedVolume : 0.34, 0, 1);
    this.muted = !!profile.settings.muted;
    this.drone = [];
  }

  unlock() {
    if (this.context) {
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.context = new AudioCtx();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = 0.23;
      this.musicBus.connect(this.master);
      this.startDrone();
      this.startSequence();
    } catch (_) {
      this.context = null;
    }
  }

  startDrone() {
    if (!this.context || !this.musicBus) return;
    const ctx = this.context;
    const pad = ctx.createGain();
    pad.gain.value = 0.18;
    pad.connect(this.musicBus);
    [55, 82.41, 110.2].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const tone = ctx.createGain();
      osc.type = index === 1 ? "triangle" : "sine";
      osc.frequency.value = frequency;
      tone.gain.value = index === 0 ? 0.24 : 0.075;
      osc.connect(tone);
      tone.connect(pad);
      osc.start();
      this.drone.push(osc, tone);
    });
  }

  startSequence() {
    if (this.timer) window.clearInterval(this.timer);
    if (!this.context) return;
    const interval = this.mode === "boss" ? 205 : this.mode === "combat" ? 285 : this.mode === "paused" ? 900 : 430;
    this.timer = window.setInterval(() => this.musicStep(), interval);
  }

  musicStep() {
    if (!this.context || !this.musicBus || this.context.state !== "running") return;
    const ctx = this.context;
    const scale = [0, 3, 7, 10, 12, 10, 7, 5, 3, 0, 7, 12, 10, 7, 3, -2];
    const degree = scale[this.step % scale.length];
    const base = this.mode === "boss" ? 82.4 : this.mode === "combat" ? 73.4 : 55;
    const frequency = base * Math.pow(2, degree / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = this.step % 4 === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(this.mode === "boss" ? 0.12 : 0.075, ctx.currentTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.46);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.48);
    this.step += 1;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.context) {
      const target = mode === "paused" ? 0.035 : mode === "boss" ? 0.38 : mode === "combat" ? 0.29 : 0.2;
      this.musicBus.gain.setTargetAtTime(target, this.context.currentTime, 0.3);
      this.startSequence();
    }
  }

  setVolume(value) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.05);
  }

  tone(frequency, duration, shape = "sine", strength = 0.12, bend = 1) {
    if (!this.context || !this.master || this.muted) return;
    try {
      const ctx = this.context;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = shape;
      osc.frequency.setValueAtTime(Math.max(20, frequency), ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * bend), ctx.currentTime + Math.max(0.04, duration));
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength), ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch (_) { /* Audio can be unavailable or suspended in embedded browsers. */ }
  }

  sfx(name) {
    const sounds = {
      shoot: [460, 0.075, "triangle", 0.035, 0.65],
      hit: [190, 0.09, "sawtooth", 0.07, 0.52],
      kill: [310, 0.17, "triangle", 0.09, 1.75],
      hurt: [115, 0.28, "sawtooth", 0.16, 0.58],
      pickup: [620, 0.16, "sine", 0.11, 1.55],
      coin: [880, 0.11, "square", 0.055, 1.2],
      door: [245, 0.26, "triangle", 0.09, 1.4],
      bomb: [72, 0.42, "sawtooth", 0.19, 0.48],
      relic: [415, 0.5, "sine", 0.13, 2],
      boss: [125, 0.7, "sawtooth", 0.17, 0.42],
      dodge: [300, 0.12, "triangle", 0.06, 1.8],
      clear: [523, 0.38, "sine", 0.09, 1.5],
    };
    const values = sounds[name];
    if (values) this.tone(...values);
  }

  destroy() {
    if (this.timer) window.clearInterval(this.timer);
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}

function makeShell(root) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-lockup" aria-label="Vesper, The Hollow Below">
          <div class="brand-seal" aria-hidden="true">V</div>
          <div><p class="brand-name">VESPER</p><span class="brand-sub">THE HOLLOW BELOW</span></div>
        </div>
        <div class="topbar-right">
          <div class="run-record">Deepest descent <strong id="best-floor">No record</strong></div>
          <button class="top-action audio-button" data-action="audio" aria-label="Toggle audio" title="Toggle audio">&#9835;</button>
          <button class="top-action" data-action="help">Field notes</button>
        </div>
      </header>
      <div class="game-layout">
        <main class="play-column">
          <section class="scene-frame" aria-label="Dungeon game">
            <div class="scene-cap">
              <div class="scene-cap-left"><i class="live-dot"></i><b id="scene-name">A room with no name</b></div>
              <div class="scene-cap-right"><span class="floor-tag" id="scene-floor">ABOVE GROUND</span><button class="pause-button" data-action="pause">Pause / Esc</button></div>
            </div>
            <div class="canvas-wrap" id="canvas-wrap">
              <canvas id="game-canvas" width="960" height="560" aria-label="Vesper dungeon. Move with WASD, aim and fire with the mouse."></canvas>
              <div class="game-hud" id="game-hud" hidden>
                <div class="hud-block">
                  <div class="hud-hearts" id="hud-hearts" aria-label="Health"></div><i class="hud-divider"></i>
                  <span class="hud-resource"><i>KEY</i><b id="hud-keys">0</b></span>
                  <span class="hud-resource"><i>BMB</i><b id="hud-bombs">0</b></span>
                  <span class="hud-resource"><i>COIN</i><b id="hud-coins">0</b></span>
                </div>
                <div class="hud-floor"><b id="hud-floor-name">FLOODED VESTRY</b><span id="hud-floor-sub">ROOM 01 / 09</span><div class="floor-meter"><i id="hud-progress"></i></div></div>
              </div>
              <div class="room-toast" id="room-toast" aria-live="polite"><b></b><span></span></div>
              <div class="canvas-vignette"></div>
              <div class="title-screen" id="title-screen">
                <div class="title-content">
                  <div class="title-mark" aria-hidden="true">V</div>
                  <div class="title-kicker">A descent roguelite</div>
                  <h1>THE HOLLOW<span>BELOW</span></h1>
                  <p class="title-copy">Six floors under the chapel, the old house is still breathing. Keep the lamp lit. Bring back what you can.</p>
                  <div class="title-actions">
                    <button class="primary-button" data-action="start">Begin the descent</button>
                    <button class="secondary-button" data-action="help">Read the field notes</button>
                  </div>
                  <div class="title-notice">One life. Six guardians. No two descents alike.</div>
                </div>
              </div>
            </div>
            <div class="stage-caption">
              <div><strong id="room-title">The chapel door is open</strong><span id="room-description">Choose a path. The house is listening.</span></div>
              <div class="caption-r" id="room-prompt">The descent begins when you do</div>
            </div>
          </section>
          <div class="keybar" aria-label="Keyboard controls">
            <span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span class="key-label">move</span></span>
            <span class="key-group"><kbd>MOUSE</kbd><span class="key-label">aim / fire</span></span>
            <span class="key-group"><kbd>SHIFT</kbd><span class="key-label">dodge</span></span>
            <span class="key-group"><kbd>F</kbd><span class="key-label">bomb</span></span>
            <span class="key-group"><kbd>Q</kbd><span class="key-label">relic</span></span>
            <span class="key-group"><kbd>E</kbd><span class="key-label">interact</span></span>
          </div>
          <div class="touch-controls" aria-label="Touch controls">
            <div class="touch-dpad">
              <button data-touch="up" aria-label="Move up">&#9650;</button><button data-touch="left" aria-label="Move left">&#9664;</button><button data-touch="down" aria-label="Move down">&#9660;</button><button data-touch="right" aria-label="Move right">&#9654;</button>
            </div>
            <div class="touch-actions">
              <button data-touch="bomb">BOMB</button><button data-touch="dodge">DODGE</button><button data-touch="active">RELIC</button><button data-touch="interact">USE</button><button data-touch="fire">FIRE</button>
            </div>
          </div>
        </main>
        <aside class="sidebar" id="sidebar" aria-label="Run information"></aside>
      </div>
      <footer class="bottom-note"><span><strong>VESPER / 01</strong> &nbsp;A house that eats its saints</span><span>Every room remembers how you left it</span></footer>
    </div>
    <div class="modal-layer" id="modal" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title"></div>
    <div id="sr-announcer" class="sr-only" aria-live="polite"></div>`;
}

function generateFloor(floorNumber, bossIndex = 0) {
  const nodes = [];
  const add = (x, y, type) => nodes.push({ id: `${floorNumber}-${x}-${y}`, x, y, type, visited: false, cleared: false, room: null });
  add(2, 3, "start");
  add(2, 2, "combat");
  add(2, 1, "combat");
  add(2, 0, "boss");
  const specialKinds = ["treasure", "shop", "shrine", "challenge", "curse", "combat"];
  while (nodes.length < 10) {
    const frontier = [];
    for (const node of nodes) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const x = node.x + dx;
        const y = node.y + dy;
        if (x < 0 || x > 4 || y < 0 || y > 3 || nodes.some((other) => other.x === x && other.y === y)) continue;
        frontier.push([x, y]);
      }
    }
    if (!frontier.length) break;
    const [x, y] = pick(frontier);
    const nextKind = specialKinds[nodes.length - 4] || pick(["combat", "combat", "treasure", "shrine"]);
    add(x, y, nextKind);
  }

  // A few lateral links make the map feel like a branching place rather than a corridor.
  const edges = [];
  for (const node of nodes) {
    for (const other of nodes) {
      if (node.id < other.id && Math.abs(node.x - other.x) + Math.abs(node.y - other.y) === 1) edges.push([node.id, other.id]);
    }
  }
  const degree = (node) => edges.filter(([a, b]) => a === node.id || b === node.id).length;
  const occupied = new Set(nodes.map((node) => `${node.x},${node.y}`));
  const secretHosts = nodes.filter((node) => node.type !== "boss" && degree(node) >= 2);
  let secret = null;
  for (const host of secretHosts) {
    const blanks = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [host.x + dx, host.y + dy])
      .filter(([x, y]) => x >= 0 && x <= 4 && y >= 0 && y <= 3 && !occupied.has(`${x},${y}`));
    if (blanks.length) {
      const [x, y] = pick(blanks);
      secret = { x, y, hostId: host.id, revealed: false, claimed: false };
      break;
    }
  }
  return { number: floorNumber, nodes, edges, secret, bossDone: false, bossIndex };
}

function makeEnemy(type, x, y, floor, difficulty, bossIndex = 0) {
  const base = {
    grub: { hp: 26, r: 15, speed: 74, damage: 1, color: "#aa665b" },
    spitter: { hp: 32, r: 16, speed: 48, damage: 1, color: "#8b9b72" },
    bat: { hp: 20, r: 12, speed: 95, damage: 1, color: "#a27b9b" },
    brute: { hp: 70, r: 23, speed: 43, damage: 2, color: "#b08057" },
    turret: { hp: 44, r: 17, speed: 0, damage: 1, color: "#829994" },
    leech: { hp: 34, r: 14, speed: 64, damage: 1, color: "#b96b73" },
    wisp: { hp: 28, r: 13, speed: 66, damage: 1, color: "#8f91bd" },
    mite: { hp: 12, r: 9, speed: 110, damage: 1, color: "#bf8b70" },
  };
  const spec = base[type] || base.grub;
  const scaler = DIFFICULTIES[difficulty] || DIFFICULTIES.Hollow;
  const floorScale = 1 + (floor - 1) * 0.17;
  const isBoss = type === "boss";
  const bossHealth = [260, 320, 390, 450, 515, 585, 680, 820][bossIndex] * scaler.hp;
  return {
    type,
    x, y,
    r: isBoss ? 38 : spec.r,
    hp: isBoss ? bossHealth : spec.hp * floorScale * scaler.hp,
    maxHp: isBoss ? bossHealth : spec.hp * floorScale * scaler.hp,
    speed: isBoss ? 63 + bossIndex * 4 : spec.speed * scaler.speed * (1 + (floor - 1) * 0.035),
    damage: Math.max(1, Math.round((isBoss ? 2 : spec.damage) * scaler.damage)),
    color: isBoss ? ["#c18b57", "#ad6667", "#87906a", "#a985b4", "#bd6849", "#a8a46a", "#776b87", "#c79674"][bossIndex] : spec.color,
    cooldown: rand(0.5, 1.8),
    age: rand(0, 4),
    phase: "idle",
    phaseTime: 0,
    flash: 0,
    knockX: 0,
    knockY: 0,
    poison: 0,
    poisonTick: 0,
    bossIndex,
    bossName: BOSS_NAMES[bossIndex],
    attackNo: 0,
    chargeAngle: 0,
    split: type === "leech",
    value: isBoss ? 1000 : Math.round(spec.hp * 1.5),
  };
}

function mountGame(root) {
  makeShell(root);

  const canvas = root.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const sidebar = root.querySelector("#sidebar");
  const modal = root.querySelector("#modal");
  const titleScreen = root.querySelector("#title-screen");
  const hud = root.querySelector("#game-hud");
  const toast = root.querySelector("#room-toast");
  const canvasWrap = root.querySelector("#canvas-wrap");
  const profile = loadProfile();
  const audio = new HollowAudio(profile);
  const keys = Object.create(null);
  const touchKeys = Object.create(null);
  let screen = "title";
  let modalKind = null;
  let modalReturn = "title";
  let helpTab = "basics";
  let titleTab = "dive";
  let runTab = "map";
  let difficulty = DIFFICULTIES[profile.settings.difficulty] ? profile.settings.difficulty : "Hollow";
  let selectedCharacter = profile.unlocked[0] || "pilgrim";
  let selectedSeed = "";
  let run = null;
  let raf = 0;
  let lastTime = 0;
  let uiClock = 0;
  let toastTimer = 0;
  let shake = 0;
  let lastFireTone = 0;
  let pointerDown = false;
  let pointer = { x: WORLD.width * 0.7, y: WORLD.height * 0.5, inside: false };
  let touchFiring = false;
  let autoAim = false;
  let dpr = 1;
  let previousEnemyCount = 0;
  let disposed = false;

  const saveProfile = () => {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch (_) { /* Private browsing can disable storage. */ }
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round((rect.width || WORLD.width) * dpr));
    const height = Math.max(1, Math.round((rect.height || WORLD.height) * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(width / WORLD.width, 0, 0, height / WORLD.height, 0, 0);
  }

  function toastMessage(title, detail = "", duration = 1700) {
    const bold = toast.querySelector("b");
    const sub = toast.querySelector("span");
    bold.textContent = title;
    sub.textContent = detail;
    toast.classList.add("show");
    toastTimer = duration;
  }

  function updateHeader() {
    const best = root.querySelector("#best-floor");
    best.textContent = profile.bestFloor ? `FLOOR ${String(profile.bestFloor).padStart(2, "0")}` : "No record";
    const audioButton = root.querySelector('[data-action="audio"]');
    audioButton.textContent = audio.muted ? "OFF" : "♫";
    audioButton.setAttribute("aria-label", audio.muted ? "Turn audio on" : "Mute audio");
  }

  function updateTitleScreen() {
    titleScreen.hidden = screen !== "title";
    hud.hidden = screen === "title";
    root.querySelector('[data-action="pause"]').disabled = screen === "title" || screen === "ended";
    root.querySelector('[data-action="pause"]').style.opacity = screen === "title" ? ".45" : "1";
  }

  function updateSceneLabels() {
    const name = root.querySelector("#scene-name");
    const floorLabel = root.querySelector("#scene-floor");
    const title = root.querySelector("#room-title");
    const description = root.querySelector("#room-description");
    const prompt = root.querySelector("#room-prompt");
    if (!run) {
      name.textContent = "A room with no name";
      floorLabel.textContent = "ABOVE GROUND";
      title.textContent = "The chapel door is open";
      description.textContent = "Choose a path. The house is listening.";
      prompt.textContent = "The descent begins when you do";
      return;
    }
    const node = currentNode();
    const room = node && node.room;
    const typeName = room ? roomName(room.type) : "A room below";
    name.textContent = typeName;
    floorLabel.textContent = `FLOOR ${String(run.floor).padStart(2, "0")}`;
    title.textContent = room ? roomTitle(room) : typeName;
    description.textContent = room ? roomDescription(room) : "A hush settles over the stone.";
    prompt.textContent = room ? roomPrompt(room) : "Find the way forward";
  }

  function roomName(type) {
    return ({ start: "The antechamber", combat: "A hungry room", treasure: "The tithe room", shop: "The peddler's nook", shrine: "A bargain in candlelight", challenge: "The penitent's test", curse: "The red room", boss: currentBossName(), secret: "A room kept secret" })[type] || "The hollow";
  }

  function currentBossName() {
    const index = run && run.floorMap ? run.floorMap.bossIndex : 0;
    return BOSS_NAMES[index] || BOSS_NAMES[0];
  }

  function roomTitle(room) {
    if (room.type === "boss" && room.bossDefeated) return "The guardian is silent";
    if (room.type === "boss") return currentBossName();
    if (room.type === "treasure" && room.opened) return "The tithe has been paid";
    if (room.type === "shrine" && room.resolved) return "The candle has gone out";
    if (room.type === "shop") return "A peddler beneath the floor";
    if (room.cleared) return "The room remembers";
    return roomName(room.type);
  }

  function roomDescription(room) {
    if (room.type === "boss" && room.bossDefeated) return "A stairway waits where the great thing fell.";
    if (room.type === "boss") return "The guardian has heard your footsteps.";
    if (room.type === "treasure") return room.opened ? "The chest is open. Take what the house left behind." : "The old lock wants a key. Press E beside the chest.";
    if (room.type === "shop") return "Press E beside a shelf to make an offer.";
    if (room.type === "shrine") return room.resolved ? "The bargain is already sealed." : "Two offerings. Neither is free.";
    if (room.type === "challenge") return room.cleared ? "You kept your feet. The reward is yours." : "The doors stay shut until the room is quiet.";
    if (room.type === "curse") return room.cleared ? "The red light recedes from the walls." : "Spikes wake in the red light. Watch the floor.";
    if (room.cleared) return "The doors are open. Choose the next room.";
    if (room.type === "start") return "A lamp, a key, and the long way down.";
    return "Keep moving. They know where you are.";
  }

  function roomPrompt(room) {
    if (room.type === "treasure" && !room.opened) return "E  /  USE A KEY";
    if (room.type === "shop") return "E  /  MAKE AN OFFER";
    if (room.type === "shrine" && !room.resolved) return "E  /  ACCEPT A BARGAIN";
    if (room.type === "boss" && room.bossDefeated && run.floor < FLOORS.length) return "E  /  DESCEND";
    if (room.type === "boss" && room.bossDefeated) return "THE HOUSE IS QUIET";
    if (room.stairs) return "E  /  DESCEND";
    if (room.cleared) return "DOORS OPEN  /  CHOOSE A WAY";
    return "WASD MOVE  /  MOUSE AIM AND FIRE";
  }

  function renderHearts() {
    if (!run) return;
    const player = run.player;
    const hearts = [];
    const count = Math.ceil(player.maxHp / 2);
    for (let i = 0; i < count; i += 1) {
      const left = player.hp - i * 2;
      const className = left >= 2 ? "heart" : left === 1 ? "heart half" : "heart empty";
      hearts.push(`<span class="${className}" aria-hidden="true">&#9829;</span>`);
    }
    root.querySelector("#hud-hearts").innerHTML = hearts.join("");
    root.querySelector("#hud-hearts").setAttribute("aria-label", `${player.hp} of ${player.maxHp} half-hearts`);
    root.querySelector("#hud-keys").textContent = String(player.keys);
    root.querySelector("#hud-bombs").textContent = String(player.bombs);
    root.querySelector("#hud-coins").textContent = String(run.coins);
    root.querySelector("#hud-floor-name").textContent = FLOORS[run.floor - 1] || "THE DEEPEST ROOM";
    const total = run.floorMap ? run.floorMap.nodes.length : 1;
    const cleared = run.floorMap ? run.floorMap.nodes.filter((node) => node.cleared).length : 0;
    root.querySelector("#hud-floor-sub").textContent = `ROOM ${String(cleared + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    root.querySelector("#hud-progress").style.width = `${Math.round((cleared / Math.max(1, total)) * 100)}%`;
  }

  function renderMap() {
    const map = run.floorMap;
    const known = new Set();
    for (const node of map.nodes) {
      if (node.visited) {
        known.add(node.id);
        for (const [a, b] of map.edges) {
          if (a === node.id) known.add(b);
          if (b === node.id) known.add(a);
        }
      }
    }
    if (map.secret && map.secret.revealed) known.add(`secret-${map.number}`);
    const visible = map.nodes.filter((node) => known.has(node.id));
    const coords = (node) => ({ x: ((node.x + 0.5) / 5) * 100, y: ((node.y + 0.5) / 4) * 100 });
    const lines = map.edges.map(([a, b]) => {
      const left = map.nodes.find((node) => node.id === a);
      const right = map.nodes.find((node) => node.id === b);
      if (!left || !right || !known.has(a) || !known.has(b)) return "";
      const from = coords(left); const to = coords(right);
      return `<line class="${left.visited || right.visited ? "discovered" : ""}" x1="${from.x}%" y1="${from.y}%" x2="${to.x}%" y2="${to.y}%" />`;
    }).join("");
    const glyphs = { start: "S", boss: "B", shop: "$", treasure: "T", shrine: "+", challenge: "!", curse: "!", combat: ".", secret: "?" };
    const nodes = visible.map((node) => {
      const pos = coords(node);
      const classes = ["map-node", node.visited ? "visited" : "hidden", node.cleared ? "cleared" : "", currentNode() && currentNode().id === node.id ? "current" : "", node.type === "boss" ? "boss" : ""].filter(Boolean).join(" ");
      const secretClass = node.type === "secret" ? "secret" : "";
      return `<span class="${classes} ${secretClass}" style="left:${pos.x}%;top:${pos.y}%" title="${esc(node.visited ? roomName(node.type) : "Unvisited room")}">${glyphs[node.visited ? node.type : "combat"] || "."}</span>`;
    }).join("");
    return `<div class="map-wrap"><div class="map-caption"><span>Floor map</span><span>${map.nodes.length} chambers</span></div><div class="map-board"><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${nodes}</div></div>`;
  }

  function renderTitleSidebar() {
    const tabNames = [["dive", "Descend"], ["reliquary", "Reliquary"], ["ledger", "Ledger"]];
    const tabs = `<div class="side-tabs">${tabNames.map(([id, name]) => `<button class="side-tab ${titleTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("")}</div>`;
    let body = "";
    if (titleTab === "dive") {
      body = `<div class="section-kicker">Your next life</div><h3 class="side-title">The lamp is lit.</h3><p class="side-copy">Rooms are stitched anew each descent. Find relics, spend your keys carefully, and learn the guardians' tells.</p>
        <div class="separator"></div>
        <div class="difficulty-label"><span>Depth of the dark</span><span>${esc(DIFFICULTIES[difficulty].label)}</span></div>
        <div class="difficulty-options">${Object.keys(DIFFICULTIES).map((name) => `<button class="difficulty-option ${difficulty === name ? "active" : ""}" data-difficulty="${name}">${name}</button>`).join("")}</div>
        <div class="seed-control"><div class="difficulty-label"><span>Run seed</span><span>Share a maze</span></div><div class="seed-entry-row"><input id="seed-entry" data-seed-entry type="text" maxlength="16" value="${esc(selectedSeed)}" placeholder="RANDOM MAZE" autocomplete="off" spellcheck="false" aria-label="Run seed"><button class="secondary-button" data-action="seed-random" aria-label="Generate a random seed">ROLL</button><button class="secondary-button seed-copy" data-action="seed-copy" aria-label="Copy the seed">COPY</button></div><small>Leave blank for a fresh run. Re-enter a seed to replay it.</small></div>
        <div class="separator"></div>
        <div class="difficulty-label"><span>Choose a pilgrim</span><span>${profile.unlocked.length} awake</span></div>
        <div class="character-list">${Object.entries(CHARACTERS).map(([id, person]) => {
          const unlocked = profile.unlocked.includes(id);
          return `<button class="character-choice ${id === selectedCharacter ? "selected" : ""}" data-character="${id}" ${unlocked ? "" : `title="Unlock in the Reliquary for ${person.cost} embers"`}>
            <span class="character-stamp">${person.mark}</span><span><b>${person.name}</b><small>${person.desc}</small></span>${unlocked ? "" : `<span class="char-lock">${person.cost} EMB</span>`}
          </button>`;
        }).join("")}</div>
        <div class="separator"></div><button class="primary-button" data-action="start">Begin the descent</button>
        <div class="menu-tail"><button class="text-button" data-action="help">Controls &amp; lore</button><span class="side-eyebrow">${profile.totalRuns} descents logged</span></div>
        <div class="side-quote">"The house doesn't want your life. It wants to know what you will spend it on."</div>`;
    } else if (titleTab === "reliquary") {
      body = `<div class="section-kicker">Between descents</div><h3 class="side-title">The Reliquary</h3><p class="side-copy">Spend the embers you carried back. These vows remain when the house takes everything else.</p>
        <div class="profile-strip"><div class="profile-stat"><b>${profile.embers}</b><span>Embers</span></div><div class="profile-stat"><b>${profile.upgrades.heart + profile.upgrades.eye + profile.upgrades.feather + profile.upgrades.purse}</b><span>Seals</span></div><div class="profile-stat"><b>${profile.unlocked.length}</b><span>Pilgrims</span></div></div>
        <div class="upgrade-list">${Object.entries(UPGRADES).map(([id, upgrade]) => {
          const level = Number(profile.upgrades[id]) || 0;
          const cost = upgrade.costs[level];
          const full = level >= upgrade.costs.length;
          return `<div class="upgrade-row"><div class="upgrade-heading"><b>${upgrade.name}</b><span>SEAL ${level}/${upgrade.costs.length}</span></div><p>${upgrade.desc}</p><button data-buy="${id}" ${full || profile.embers < cost ? "disabled" : ""}>${full ? "Fully bound" : `Bind the seal / ${cost} embers`}</button></div>`;
        }).join("")}</div>
        <div class="separator"></div><div class="section-kicker">Other lives</div><div class="character-list" style="margin-top:9px">${Object.entries(CHARACTERS).filter(([id]) => id !== "pilgrim").map(([id, person]) => `<div class="character-choice"><span class="character-stamp">${person.mark}</span><span><b>${person.name}</b><small>${person.desc}</small></span>${profile.unlocked.includes(id) ? `<span class="char-lock">AWAKE</span>` : `<button class="text-button" data-unlock="${id}" ${profile.embers < person.cost ? "disabled" : ""}>${person.cost} EMB</button>`}</div>`).join("")}</div>`;
    } else {
      const winRate = profile.totalRuns ? Math.round(profile.victories / profile.totalRuns * 100) : 0;
      body = `<div class="section-kicker">The things that remain</div><h3 class="side-title">The ledger</h3><p class="side-copy">The house forgets each pilgrim. The ledger does not.</p>
        <div class="profile-strip"><div class="profile-stat"><b>${profile.totalRuns}</b><span>Runs</span></div><div class="profile-stat"><b>${profile.victories}</b><span>Escapes</span></div><div class="profile-stat"><b>${winRate}%</b><span>Survival</span></div></div>
        <div class="run-line"><span>Deepest floor</span><strong>${profile.bestFloor ? `${String(profile.bestFloor).padStart(2, "0")} / 04` : "--"}</strong></div>
        <div class="run-line"><span>Lifetime kills</span><strong>${profile.totalKills}</strong></div>
        <div class="run-line"><span>Best score</span><strong>${profile.bestScore.toLocaleString()}</strong></div>
        <div class="separator"></div><p class="side-copy">The chapel keeps no online leaderboard. Your record belongs to this browser, and your embers are saved between visits.</p>
        <button class="secondary-button full-button" style="margin-top:15px" data-action="help">Read the field notes</button>`;
    }
    return `<div class="side-top"><div><div class="side-eyebrow">The chapel archive</div><h2>VESPER / 01</h2></div><div class="ember-counter">&#9670; ${profile.embers}</div></div>${tabs}<div class="side-content">${body}</div><div class="side-bottom"><div class="side-bottom-row"><small>Saved to this device</small><button data-action="help">How to play</button></div></div>`;
  }

  function renderRunSidebar() {
    const tabs = `<div class="side-tabs"><button class="side-tab ${runTab === "map" ? "active" : ""}" data-tab="map">Map</button><button class="side-tab ${runTab === "satchel" ? "active" : ""}" data-tab="satchel">Satchel</button><button class="side-tab ${runTab === "record" ? "active" : ""}" data-tab="record">Run log</button></div>`;
    const player = run.player;
    let body = "";
    if (runTab === "map") {
      const node = currentNode(); const room = node.room;
      const open = adjacentNodes(node).filter((other) => other.visited).length;
      body = `<div class="section-kicker">${esc(FLOORS[run.floor - 1])}</div><h3 class="side-title">${esc(roomName(room.type))}</h3><p class="side-copy">${esc(roomDescription(room))}</p>
        <div style="margin:14px 0">${renderMap()}</div><button class="secondary-button full-button" data-action="copy-run-seed">Copy run seed / ${esc(run.seed)}</button>
        <div class="run-line"><span>House depth</span><strong>${run.floor} / ${FLOORS.length}</strong></div><div class="run-line"><span>Rooms quieted</span><strong>${run.roomsCleared}</strong></div><div class="run-line"><span>Doors in reach</span><strong>${open}</strong></div>
        <div class="separator"></div><div class="active-relic"><div class="relic-icon">${player.active === "Compass" ? "c" : "V"}</div><div><b>${player.active}</b><span>Q to call it / ${player.activeCd > 0 ? `${player.activeCd.toFixed(1)}s` : "ready"}</span></div></div>
        <div class="run-line"><span>Depth setting</span><strong>${esc(run.difficulty)}</strong></div><div class="run-line"><span>Run time</span><strong>${formatTime(run.elapsed)}</strong></div>`;
    } else if (runTab === "satchel") {
      const items = run.items.map((id) => ITEMS.find((item) => item.id === id)).filter(Boolean);
      const synergy = synergyName();
      body = `<div class="section-kicker">What the house let you keep</div><h3 class="side-title">The satchel</h3><p class="side-copy">A relic changes the next room. Two relics may change one another.</p>
        <div class="inventory-title"><span>Passive relics</span><span>${items.length} / ${ITEMS.length}</span></div>
        <div class="inventory-list">${items.length ? items.map((item) => `<div class="inventory-item"><i>${item.mark}</i><div><b>${esc(item.name)}</b><span>${esc(item.line)}</span></div></div>`).join("") : `<div class="empty-inventory">An empty pocket is still a choice. Search the gold room, or take a chance with the peddler.</div>`}</div>
        ${synergy ? `<div class="synergy-note"><strong>UNHOLY SYNC / </strong>${esc(synergy)}</div>` : ""}
        <div class="separator"></div><div class="inventory-title"><span>Carried supplies</span><span>ON PERSON</span></div>
        <div class="run-line"><span>Keys / unlock old chests</span><strong>${player.keys}</strong></div><div class="run-line"><span>Bombs / break stone and flesh</span><strong>${player.bombs}</strong></div><div class="run-line"><span>Coins / peddler's currency</span><strong>${run.coins}</strong></div>
        <div class="separator"></div><button class="secondary-button full-button" data-action="help">Item &amp; synergy notes</button>`;
    } else {
      body = `<div class="section-kicker">A record in progress</div><h3 class="side-title">The run log</h3><p class="side-copy">The six guardians know you are here. Make each room count.</p>
        <div class="separator"></div><div class="run-line"><span>Rooms cleared</span><strong>${run.roomsCleared}</strong></div><div class="run-line"><span>Enemies put down</span><strong>${run.kills}</strong></div><div class="run-line"><span>Tears fired</span><strong>${run.shots}</strong></div><div class="run-line"><span>Damage given</span><strong>${Math.round(run.damageDealt)}</strong></div><div class="run-line"><span>Damage taken</span><strong>${run.damageTaken}</strong></div><div class="run-line"><span>Secrets opened</span><strong>${run.secrets}</strong></div><div class="run-line"><span>Time below</span><strong>${formatTime(run.elapsed)}</strong></div>
        <div class="separator"></div><div class="end-banner">${run.difficulty === "Torment" ? "The house is louder on Torment. Every guardian has a quicker hand." : run.difficulty === "Pilgrim" ? "The Pilgrim's path leaves a little more room to breathe." : "The house grows teeth with every floor. Listen for the tell before the strike."}</div>`;
    }
    return `<div class="side-top"><div><div class="side-eyebrow">Descent ${String(run.seed).slice(-5)}</div><h2>THE HOUSE / ${String(run.floor).padStart(2, "0")}</h2></div><div class="ember-counter">&#9670; ${profile.embers}</div></div>${tabs}<div class="side-content">${body}</div><div class="side-bottom"><div class="side-bottom-row"><small>${esc(CHARACTERS[run.character].name)} / ${esc(run.difficulty)}</small><button data-action="help">Field notes</button></div></div>`;
  }

  function renderSidebar() {
    sidebar.innerHTML = screen === "title" ? renderTitleSidebar() : run ? renderRunSidebar() : renderTitleSidebar();
  }

  function currentNode() {
    if (!run || !run.floorMap) return null;
    return run.floorMap.nodes.find((node) => node.id === run.currentNodeId) || null;
  }

  function adjacentNodes(node) {
    if (!run || !node) return [];
    return run.floorMap.edges.map(([a, b]) => {
      if (a === node.id) return run.floorMap.nodes.find((other) => other.id === b);
      if (b === node.id) return run.floorMap.nodes.find((other) => other.id === a);
      return null;
    }).filter(Boolean);
  }

  function edgeDirection(from, to) {
    if (to.x > from.x) return "right";
    if (to.x < from.x) return "left";
    if (to.y > from.y) return "down";
    return "up";
  }

  function exitNode(node, direction) {
    if (!node) return null;
    return adjacentNodes(node).find((other) => edgeDirection(node, other) === direction) || null;
  }

  function canLeave(room, direction) {
    if (!room || !room.cleared) return null;
    const node = currentNode();
    const connected = exitNode(node, direction);
    if (connected) return connected;
    const secret = run.floorMap.secret;
    if (secret && secret.revealed && secret.hostId === node.id && edgeDirection(node, { x: secret.x, y: secret.y }) === direction) {
      return run.floorMap.nodes.find((candidate) => candidate.id === `secret-${run.floor}`) || null;
    }
    return null;
  }

  function makeRoom(node) {
    const room = {
      type: node.type,
      nodeId: node.id,
      enemies: [],
      shots: [],
      playerShots: [],
      bombs: [],
      pickups: [],
      obstacles: [],
      hazards: [],
      cleared: node.type === "start",
      started: true,
      opened: false,
      resolved: false,
      bossDefeated: false,
      stairs: false,
      chest: node.type === "treasure" || node.type === "secret",
      chestOpened: false,
      shop: [],
      eventKind: pick(["tithe", "fountain", "well"]),
      trapClock: rand(0, 1.5),
      clearClock: 0,
      decorationSeed: hashSeed(node.id),
      promptFlash: 0,
      slowTimer: 0,
      bossWarnings: [],
    };
    if (room.type === "start") {
      node.cleared = true;
      room.obstacles = [{ x: 284, y: 190, r: 16, hp: 2, maxHp: 2, kind: "urn" }, { x: 672, y: 365, r: 16, hp: 2, maxHp: 2, kind: "urn" }];
    }
    if (["combat", "challenge", "curse", "boss"].includes(room.type)) {
      const scaler = DIFFICULTIES[run.difficulty] || DIFFICULTIES.Hollow;
      if (room.type === "boss") {
        room.enemies.push(makeEnemy("boss", WORLD.width / 2, WORLD.height / 2 - 10, run.floor, run.difficulty, run.floorMap.bossIndex));
      } else {
        let count = room.type === "challenge" ? 3 + Math.floor(run.floor / 2) : 2 + Math.floor(run.floor * 0.62);
        if (room.type === "curse") count += 1;
        count = Math.max(2, Math.round(count * scaler.count));
        const pool = ["grub", "spitter", "bat", "brute", "turret", "leech", "wisp"];
        for (let i = 0; i < count; i += 1) {
          let type = pick(pool.slice(0, Math.min(pool.length, 3 + run.floor)));
          if (room.type === "challenge" && i === 0) type = run.floor > 1 ? "brute" : "spitter";
          const position = safeEnemyPosition(room.enemies, room.obstacles);
          room.enemies.push(makeEnemy(type, position.x, position.y, run.floor, run.difficulty));
        }
        if (room.type === "curse") createHazards(room);
      }
      room.cleared = false;
    }
    if (room.type === "treasure" || room.type === "secret") {
      room.chestX = 480;
      room.chestY = 278;
      room.opened = false;
    }
    if (room.type === "shop") {
      const itemIds = ITEMS.filter((item) => !run.items.includes(item.id)).map((item) => item.id);
      room.shop = [
        { kind: "item", id: pick(itemIds.length ? itemIds : ITEMS.map((item) => item.id)), x: 295, y: 280, cost: 6 + run.floor },
        { kind: "heart", x: 480, y: 280, cost: 3, amount: 2 },
        { kind: "supplies", x: 665, y: 280, cost: 4, amount: 2 },
      ];
      room.cleared = true;
    }
    if (["shrine", "curse"].includes(room.type) && room.type === "shrine") room.cleared = true;
    if (room.type === "curse") room.cleared = false;
    if (room.type === "challenge") room.cleared = false;
    if (room.type === "start") room.cleared = true;

    if (["combat", "challenge", "curse", "treasure", "shop", "shrine", "start"].includes(room.type)) {
      const amount = room.type === "challenge" || room.type === "curse" ? 3 : room.type === "combat" ? 2 : 1;
      for (let i = 0; i < amount; i += 1) {
        const x = rand(175, 785);
        const y = rand(120, 445);
        if (dist(x, y, 480, 280) < 105 || room.obstacles.some((obstacle) => dist(x, y, obstacle.x, obstacle.y) < 70)) continue;
        room.obstacles.push({ x, y, r: rand(10, 17), hp: 2, maxHp: 2, kind: gameplayRandom() < 0.72 ? "urn" : "bone" });
      }
    }
    return room;
  }

  function hashSeed(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeedCode() {
    try {
      const values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      return `${values[0].toString(36)}${values[1].toString(36)}`.toUpperCase().slice(0, 10);
    } catch (_) {
      return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`.toUpperCase().slice(-10);
    }
  }

  function safeEnemyPosition(enemies, obstacles) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const x = rand(155, 805);
      const y = rand(115, 452);
      if (dist(x, y, run.player.x, run.player.y) < 140) continue;
      if (enemies.some((enemy) => dist(x, y, enemy.x, enemy.y) < 56)) continue;
      if (obstacles.some((obstacle) => dist(x, y, obstacle.x, obstacle.y) < 48)) continue;
      return { x, y };
    }
    return { x: rand(160, 800), y: rand(115, 450) };
  }

  function createHazards(room) {
    const positions = [[220, 190], [385, 380], [715, 180], [735, 400], [310, 300]];
    for (const [x, y] of positions) {
      room.hazards.push({ x: x + rand(-23, 23), y: y + rand(-20, 20), r: 24, phase: rand(0, 2.5), active: false, warning: false });
    }
  }

  function createBossOrder() {
    const pool = [0, 1, 2, 3, 4, 5, 6];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(gameplayRandom() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return [...pool.slice(0, FLOORS.length - 1), 7];
  }

  function startRun() {
    audio.unlock();
    if (!profile.unlocked.includes(selectedCharacter)) selectedCharacter = "pilgrim";
    const seedField = root.querySelector("#seed-entry");
    if (seedField) selectedSeed = seedField.value.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 16);
    const seed = (selectedSeed || randomSeedCode()).toUpperCase();
    selectedSeed = seed;
    gameplayRandom = seededRandom(hashSeed(seed));
    difficulty = DIFFICULTIES[difficulty] ? difficulty : "Hollow";
    profile.settings.difficulty = difficulty;
    saveProfile();
    const character = CHARACTERS[selectedCharacter] || CHARACTERS.pilgrim;
    const heartLevel = Number(profile.upgrades.heart) || 0;
    const player = {
      x: WORLD.width / 2,
      y: WORLD.height / 2 + 75,
      r: 15,
      hp: character.hp + heartLevel * 2,
      maxHp: character.hp + heartLevel * 2,
      speed: character.speed * (1 + (Number(profile.upgrades.feather) || 0) * 0.04),
      damage: character.damage * (1 + (Number(profile.upgrades.eye) || 0) * 0.08),
      fireDelay: character.fireDelay,
      fireCd: 0,
      shotSpeed: 440,
      shotCount: 1,
      range: 440,
      pierce: 0,
      poison: false,
      ricochet: false,
      wobble: false,
      splash: false,
      familiar: false,
      orbitals: 0,
      active: "Censer",
      activeCd: 0,
      activeRate: 1,
      coinBonus: 0,
      saltWard: false,
      roomWard: false,
      keys: 1,
      bombs: 1,
      aimX: 1,
      aimY: 0,
      invuln: 1.4,
      dodgeCd: 0,
      dodgeTime: 0,
      dodgeX: 0,
      dodgeY: 0,
      hurtFlash: 0,
      familiarCd: 0.7,
      anim: 0,
      moved: false,
    };
    const now = Date.now();
    const bossOrder = createBossOrder();
    run = {
      seed,
      startedAt: now,
      elapsed: 0,
      floor: 1,
      bossOrder,
      floorMap: generateFloor(1, bossOrder[0]),
      currentNodeId: null,
      player,
      difficulty,
      character: selectedCharacter,
      items: [],
      coins: Number(profile.upgrades.purse) || 0,
      roomsCleared: 0,
      kills: 0,
      shots: 0,
      damageDealt: 0,
      damageTaken: 0,
      secrets: 0,
      bosses: 0,
      score: 0,
      effects: [],
      floats: [],
      slowTimer: 0,
      lastDoor: 0,
      lastRoomId: null,
      lastInteract: 0,
      finished: false,
    };
    profile.totalRuns += 1;
    const start = run.floorMap.nodes.find((node) => node.type === "start");
    run.currentNodeId = start.id;
    enterNode(start, null);
    screen = "playing";
    modalKind = null;
    modal.hidden = true;
    pointerDown = false;
    touchFiring = false;
    autoAim = false;
    Object.keys(keys).forEach((key) => delete keys[key]);
    audio.setMode("ambient");
    updateTitleScreen();
    updateSceneLabels();
    renderHearts();
    renderSidebar();
    updateHeader();
    saveProfile();
    toastMessage("THE DESCENT", "The lamp is all you have", 1900);
  }

  function enterNode(node, fromDirection) {
    if (!node) return;
    const player = run.player;
    if (!node.room) node.room = makeRoom(node);
    node.visited = true;
    if (node.type === "secret" && run.floorMap.secret) run.floorMap.secret.claimed = true;
    run.currentNodeId = node.id;
    if (fromDirection === "left") { player.x = WORLD.right - 72; player.y = WORLD.height / 2; }
    else if (fromDirection === "right") { player.x = WORLD.left + 72; player.y = WORLD.height / 2; }
    else if (fromDirection === "up") { player.x = WORLD.width / 2; player.y = WORLD.bottom - 70; }
    else if (fromDirection === "down") { player.x = WORLD.width / 2; player.y = WORLD.top + 70; }
    else { player.x = WORLD.width / 2; player.y = WORLD.height / 2 + 75; }
    player.invuln = Math.max(player.invuln, 0.35);
    player.roomWard = false;
    run.lastRoomId = node.id;
    run.lastDoor = 0.35;
    audio.sfx("door");
    audio.setMode(node.room.type === "boss" ? "boss" : node.room.enemies.length ? "combat" : "ambient");
    const line = node.room.type === "boss" ? currentBossName() : roomName(node.room.type);
    toastMessage(line, node.room.enemies.length ? "The doors seal behind you" : node.room.cleared ? "The doors are open" : "The house is listening", 1400);
    updateSceneLabels();
    renderSidebar();
  }

  function makePickup(type, x, y, extra = {}) {
    const item = { type, x, y, r: type === "item" ? 17 : 12, age: 0, taken: false, ...extra };
    const room = currentNode() && currentNode().room;
    if (room) room.pickups.push(item);
    return item;
  }

  function onRoomCleared(room) {
    if (room.cleared) return;
    room.cleared = true;
    room.clearClock = 1.3;
    const node = currentNode();
    if (node) node.cleared = true;
    run.roomsCleared += 1;
    run.score += room.type === "challenge" ? 400 : 130;
    burst(WORLD.width / 2, WORLD.height / 2, "#d9b46c", 30, 170);
    floatText("ROOM QUIETED", WORLD.width / 2, WORLD.height / 2 - 38, "#f1cb84", 14);
    audio.sfx("clear");
    if (room.type === "boss") {
      room.bossDefeated = true;
      room.stairs = run.floor < FLOORS.length;
      run.floorMap.bossDone = true;
      run.bosses += 1;
      run.coins += 4;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 1);
      const pool = ITEMS.filter((item) => !run.items.includes(item.id));
      makePickup("item", WORLD.width / 2 - 70, WORLD.height / 2 - 5, { itemId: pick(pool.length ? pool : ITEMS).id });
      if (run.floor < FLOORS.length) {
        room.stairs = true;
        room.stairsX = WORLD.width / 2 + 84;
        room.stairsY = WORLD.height / 2 + 32;
        floatText("THE STAIR OPENS", WORLD.width / 2, WORLD.height / 2 + 90, "#e5bd7a", 12);
      }
      if (run.floor >= FLOORS.length) {
        endRun(true);
        return;
      }
    } else {
      const coins = room.type === "challenge" ? 3 : 1 + (gameplayRandom() < 0.3 ? 1 : 0);
      for (let i = 0; i < coins; i += 1) makePickup("coin", WORLD.width / 2 + rand(-58, 58), WORLD.height / 2 + rand(-25, 25));
      if (gameplayRandom() < 0.17) makePickup(gameplayRandom() < 0.58 ? "heart" : "key", WORLD.width / 2 + rand(-90, 90), WORLD.height / 2 - 55);
      if (room.type === "challenge") {
        const pool = ITEMS.filter((item) => !run.items.includes(item.id));
        makePickup("item", WORLD.width / 2, WORLD.height / 2 - 62, { itemId: pick(pool.length ? pool : ITEMS).id });
      }
    }
    updateSceneLabels();
    renderHearts();
    renderSidebar();
  }

  function descend() {
    if (!run || run.floor >= FLOORS.length) return;
    run.floor += 1;
    run.floorMap = generateFloor(run.floor, run.bossOrder[run.floor - 1]);
    const start = run.floorMap.nodes.find((node) => node.type === "start");
    run.currentNodeId = start.id;
    run.player.keys += 1;
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 1);
    run.player.bombs = Math.max(1, run.player.bombs);
    run.score += 500;
    enterNode(start, null);
    toastMessage(`FLOOR ${run.floor}`, FLOOR_SUBTITLES[run.floor - 1], 2000);
    renderHearts();
    renderSidebar();
  }

  function addItem(itemId) {
    const item = ITEMS.find((candidate) => candidate.id === itemId);
    if (!item || run.items.includes(itemId)) return false;
    run.items.push(itemId);
    item.apply(run.player, run);
    run.score += 180;
    floatText(item.name.toUpperCase(), run.player.x, run.player.y - 34, "#e1bd7c", 12);
    burst(run.player.x, run.player.y, "#d9b36d", 25, 130);
    audio.sfx("relic");
    toastMessage(item.name, item.line, 2000);
    const synergy = synergyName();
    if (synergy) window.setTimeout(() => { if (!disposed && screen === "playing") toastMessage("UNHOLY SYNC", synergy, 1700); }, 800);
    renderSidebar();
    return true;
  }

  function synergyName() {
    const has = (id) => run && run.items.includes(id);
    if (has("hemlock") && has("twin-candle")) return "Venom spreads along every split tear.";
    if (has("glass-saint") && has("moon-milk")) return "A quick, hard critical hit now cracks into nearby foes.";
    if (has("echo-chamber") && has("black-mirror")) return "Piercing tears ricochet once toward another target.";
    if (has("moth-orbit") && has("firefly")) return "The familiar's spark leaves a moth-mark that stings twice.";
    return "";
  }

  function collectPickup(pickup) {
    if (pickup.type === "coin") {
      run.coins += 1 + run.player.coinBonus;
      run.score += 25;
      audio.sfx("coin");
      floatText(`+${1 + run.player.coinBonus} COIN`, pickup.x, pickup.y - 8, "#e9c46e", 11);
    } else if (pickup.type === "heart") {
      const healed = Math.min(2, run.player.maxHp - run.player.hp);
      if (healed <= 0) return false;
      run.player.hp += healed;
      audio.sfx("pickup");
      floatText(`+${healed} HEALTH`, pickup.x, pickup.y - 8, "#df8374", 11);
      renderHearts();
    } else if (pickup.type === "key") {
      run.player.keys += 1;
      audio.sfx("pickup");
      floatText("+1 KEY", pickup.x, pickup.y - 8, "#e2cd8e", 11);
    } else if (pickup.type === "bomb") {
      run.player.bombs += 1;
      audio.sfx("pickup");
      floatText("+1 BOMB", pickup.x, pickup.y - 8, "#aabcc0", 11);
    } else if (pickup.type === "item") {
      return addItem(pickup.itemId);
    }
    pickup.taken = true;
    return true;
  }

  function interact() {
    if (screen !== "playing" || !run) return;
    const now = performance.now();
    if (now - run.lastInteract < 230) return;
    run.lastInteract = now;
    const node = currentNode();
    const room = node && node.room;
    if (!room) return;
    const p = run.player;
    if (room.chest && !room.chestOpened && dist(p.x, p.y, room.chestX, room.chestY) < 72) {
      if (p.keys <= 0) { toastMessage("LOCKED", "You need a key for this chest", 1300); return; }
      p.keys -= 1;
      room.chestOpened = true;
      room.opened = true;
      const pool = ITEMS.filter((item) => !run.items.includes(item.id));
      makePickup("item", room.chestX, room.chestY - 24, { itemId: pick(pool.length ? pool : ITEMS).id });
      if (gameplayRandom() < 0.5) makePickup("coin", room.chestX + 34, room.chestY + 6);
      burst(room.chestX, room.chestY, "#e2bd76", 28, 155);
      audio.sfx("relic");
      toastMessage("THE LOCK REMEMBERS", "A relic, for the key you spent", 1600);
      renderHearts();
      return;
    }
    if (room.shop.length) {
      const shelf = room.shop.find((item) => !item.bought && dist(p.x, p.y, item.x, item.y) < 67);
      if (shelf) { buyShopItem(shelf); return; }
    }
    if (room.type === "shrine" && !room.resolved) {
      const left = dist(p.x, p.y, 355, 280) < 73;
      const right = dist(p.x, p.y, 605, 280) < 73;
      if (left) { resolveShrine(0); return; }
      if (right) { resolveShrine(1); return; }
    }
    if (room.stairs && dist(p.x, p.y, room.stairsX || 564, room.stairsY || 312) < 76) {
      descend();
      return;
    }
    if (room.type === "boss" && room.bossDefeated && run.floor < FLOORS.length) {
      if (dist(p.x, p.y, WORLD.width / 2, WORLD.height / 2) < 90) { descend(); return; }
    }
    toastMessage("NOTHING CLOSE ENOUGH", "Get nearer to a shelf, chest, or shrine", 1000);
  }

  function resolveShrine(choice) {
    const room = currentNode().room;
    const p = run.player;
    if (room.resolved) return;
    if (choice === 0) {
      if (p.hp <= 2) { toastMessage("THE CANDLE REFUSES", "You need more health to bargain", 1300); return; }
      p.hp -= 2;
      const pool = ITEMS.filter((item) => !run.items.includes(item.id));
      makePickup("item", 355, 237, { itemId: pick(pool.length ? pool : ITEMS).id });
      room.resolved = true;
      burst(355, 280, "#d36f64", 20, 120);
      audio.sfx("hurt");
      toastMessage("BLOOD FOR A NAME", "The candle accepts your offering", 1500);
    } else if (room.eventKind === "fountain") {
      const heal = Math.min(2, p.maxHp - p.hp);
      if (heal <= 0) { toastMessage("THE WELL IS DRY", "You are already whole", 1200); return; }
      p.hp += heal;
      p.keys += 1;
      room.resolved = true;
      burst(605, 280, "#8db9ae", 20, 120);
      audio.sfx("pickup");
      toastMessage("SALT WATER / +1 KEY", "The well gives back what it can", 1500);
    } else if (room.eventKind === "well") {
      if (run.coins < 3) { toastMessage("THE WELL WANTS THREE COINS", "Find a little more change", 1200); return; }
      run.coins -= 3;
      p.bombs += 2;
      p.activeCd = 0;
      room.resolved = true;
      burst(605, 280, "#d3aa6a", 22, 130);
      audio.sfx("relic");
      toastMessage("THE WELL TAKES / THE WELL RETURNS", "+2 bombs / relic restored", 1650);
    } else {
      if (run.coins < 4) { toastMessage("THE TOLL IS FOUR COINS", "The peddler will not take promises", 1300); return; }
      run.coins -= 4;
      p.keys += 2;
      room.resolved = true;
      burst(605, 280, "#d8b971", 22, 130);
      audio.sfx("coin");
      toastMessage("THE TOLL IS PAID", "+2 keys for the road", 1500);
    }
    renderHearts();
    renderSidebar();
  }

  function buyShopItem(shelf) {
    if (run.coins < shelf.cost) {
      toastMessage("NOT ENOUGH COIN", `The peddler asks ${shelf.cost}`, 1200);
      return;
    }
    if (shelf.kind === "heart" && run.player.hp >= run.player.maxHp) {
      toastMessage("NO ROOM IN YOUR HEART", "The peddler will not sell half a promise", 1300);
      return;
    }
    if (shelf.kind === "item" && run.items.includes(shelf.id)) {
      shelf.id = pick(ITEMS.filter((item) => !run.items.includes(item.id)).map((item) => item.id));
    }
    run.coins -= shelf.cost;
    shelf.bought = true;
    if (shelf.kind === "item") addItem(shelf.id);
    else if (shelf.kind === "heart") run.player.hp = Math.min(run.player.maxHp, run.player.hp + (shelf.amount || 2));
    else { run.player.bombs += shelf.amount; run.player.keys += 1; }
    audio.sfx("coin");
    floatText("OFFER ACCEPTED", shelf.x, shelf.y - 32, "#e9c46e", 10);
    renderHearts();
    renderSidebar();
  }

  function useActive() {
    if (screen !== "playing" || !run) return;
    const p = run.player;
    if (p.activeCd > 0) { toastMessage("THE RELIC IS RESTING", `${p.activeCd.toFixed(1)} seconds`, 850); return; }
    const room = currentNode().room;
    if (p.active === "Compass") {
      room.slowTimer = 4.2;
      room.shots.length = 0;
      for (const enemy of room.enemies) {
        enemy.phaseTime = Math.max(enemy.phaseTime, 1.5);
        enemy.flash = 0.3;
      }
      burst(p.x, p.y, "#a9a5d1", 40, 210);
      floatText("THE ROOM HOLDS ITS BREATH", p.x, p.y - 36, "#c8c5e9", 10);
      p.activeCd = 18 * p.activeRate;
    } else {
      const radius = 175;
      burst(p.x, p.y, "#eed08b", 54, 245);
      for (const enemy of room.enemies) {
        const distance = dist(p.x, p.y, enemy.x, enemy.y);
        if (distance < radius) {
          damageEnemy(enemy, 58 * (1 - distance / (radius * 2)), "#f6cf7c");
          const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
          enemy.knockX += Math.cos(angle) * 230;
          enemy.knockY += Math.sin(angle) * 230;
        }
      }
      room.shots.length = 0;
      floatText("CENSER / KEEP THE DARK BACK", p.x, p.y - 37, "#f4d48f", 11);
      p.activeCd = 13.5 * p.activeRate;
    }
    audio.sfx("relic");
    shake = Math.max(shake, 5);
    renderSidebar();
  }

  function placeBomb() {
    if (screen !== "playing" || !run) return;
    const p = run.player;
    if (p.bombs <= 0) { toastMessage("NO BOMBS", "A peddler may have some", 900); return; }
    p.bombs -= 1;
    const room = currentNode().room;
    room.bombs.push({ x: p.x + p.aimX * 38, y: p.y + p.aimY * 38, fuse: 1.15, age: 0, r: 11 });
    audio.tone(120, 0.09, "triangle", 0.07, 0.65);
    renderHearts();
  }

  function revealSecret(host, direction) {
    const secret = run.floorMap.secret;
    if (!secret || secret.revealed || secret.hostId !== host.id) return false;
    if (edgeDirection(host, { x: secret.x, y: secret.y }) !== direction) return false;
    secret.revealed = true;
    const node = { id: `secret-${run.floor}`, x: secret.x, y: secret.y, type: "secret", visited: false, cleared: false, room: null };
    run.floorMap.nodes.push(node);
    run.floorMap.edges.push([host.id, node.id]);
    run.secrets += 1;
    run.score += 250;
    burst(WORLD.width / 2, WORLD.height / 2, "#d8bd79", 34, 170);
    floatText("A WALL THAT WASN'T A WALL", WORLD.width / 2, WORLD.height / 2 - 38, "#ecd08d", 12);
    audio.sfx("relic");
    toastMessage("SECRET ROOM FOUND", "The map has another mark", 1700);
    renderSidebar();
    return true;
  }

  function detonateBomb(bomb, room) {
    const radius = 142;
    burst(bomb.x, bomb.y, "#edbd72", 52, 270);
    run.effects.push({ kind: "ring", x: bomb.x, y: bomb.y, r: 12, max: radius, life: 0.4, color: "#efc47e" });
    for (const enemy of room.enemies) {
      if (dist(bomb.x, bomb.y, enemy.x, enemy.y) < radius + enemy.r) damageEnemy(enemy, 115, "#f2c67d");
    }
    for (const obstacle of room.obstacles) {
      if (!obstacle.broken && dist(bomb.x, bomb.y, obstacle.x, obstacle.y) < radius + obstacle.r) {
        obstacle.hp -= 3;
        if (obstacle.hp <= 0) breakObstacle(obstacle);
      }
    }
    const player = run.player;
    if (dist(bomb.x, bomb.y, player.x, player.y) < radius * 0.56) hurtPlayer(1, bomb.x, bomb.y, true);
    const node = currentNode();
    for (const direction of ["left", "right", "up", "down"]) {
      const secret = run.floorMap.secret;
      if (!secret || secret.revealed || secret.hostId !== node.id || edgeDirection(node, { x: secret.x, y: secret.y }) !== direction) continue;
      const target = { left: { x: WORLD.left, y: WORLD.height / 2 }, right: { x: WORLD.right, y: WORLD.height / 2 }, up: { x: WORLD.width / 2, y: WORLD.top }, down: { x: WORLD.width / 2, y: WORLD.bottom } }[direction];
      if (dist(bomb.x, bomb.y, target.x, target.y) < 145) revealSecret(node, direction);
    }
    audio.sfx("bomb");
    shake = Math.max(shake, 10);
  }

  function breakObstacle(obstacle) {
    if (obstacle.broken) return;
    obstacle.broken = true;
    burst(obstacle.x, obstacle.y, obstacle.kind === "bone" ? "#b59a78" : "#b27b5c", 11, 100);
    if (gameplayRandom() < 0.3) makePickup(gameplayRandom() < 0.65 ? "coin" : "heart", obstacle.x, obstacle.y);
    audio.tone(170, 0.1, "triangle", 0.045, 0.45);
  }

  function transition(direction) {
    const room = currentNode().room;
    const target = canLeave(room, direction);
    if (!target) return false;
    enterNode(target, direction);
    return true;
  }

  function burst(x, y, color, count = 12, speed = 120) {
    if (!run) return;
    const limit = 260;
    for (let i = 0; i < count && run.effects.length < limit; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = fxRand(speed * 0.25, speed);
      const life = fxRand(0.24, 0.72);
      run.effects.push({ kind: "particle", x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, max: life, size: fxRand(1.2, 3.8), color, gravity: fxRand(-10, 40) });
    }
  }

  function floatText(text, x, y, color = "#eee0c6", size = 11) {
    if (!run) return;
    if (run.floats.length > 36) run.floats.shift();
    run.floats.push({ text, x, y, color, size, life: 1.15, max: 1.15 });
  }

  function damageEnemy(enemy, amount, color = "#f3d292") {
    if (!enemy || enemy.hp <= 0) return;
    enemy.hp -= amount;
    enemy.flash = 0.11;
    run.damageDealt += amount;
    burst(enemy.x + rand(-5, 5), enemy.y + rand(-5, 5), color, enemy.type === "boss" ? 5 : 3, 58);
    if (enemy.type === "boss") shake = Math.max(shake, 1.2);
    audio.sfx("hit");
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      killEnemy(enemy);
    }
  }

  function killEnemy(enemy) {
    const room = currentNode() && currentNode().room;
    if (!room || enemy.rewarded) return;
    enemy.rewarded = true;
    run.kills += 1;
    run.score += enemy.value || 40;
    burst(enemy.x, enemy.y, enemy.type === "boss" ? "#edc779" : enemy.color, enemy.type === "boss" ? 60 : 18, enemy.type === "boss" ? 280 : 155);
    floatText(enemy.type === "boss" ? "THE GUARDIAN FALLS" : `+${enemy.value || 35}`, enemy.x, enemy.y - enemy.r - 8, enemy.type === "boss" ? "#f2cd7f" : "#d8cab0", enemy.type === "boss" ? 14 : 10);
    audio.sfx(enemy.type === "boss" ? "boss" : "kill");
    if (enemy.type !== "boss") {
      const chance = gameplayRandom();
      if (chance < 0.16) makePickup("heart", enemy.x + rand(-12, 12), enemy.y);
      else if (chance < 0.4) makePickup("coin", enemy.x, enemy.y);
      else if (chance < 0.47) makePickup("bomb", enemy.x, enemy.y);
      else if (chance < 0.51) makePickup("key", enemy.x, enemy.y);
    }
    if (enemy.type === "leech" && enemy.split && !enemy.hasSplit) {
      enemy.hasSplit = true;
      for (const direction of [-1, 1]) {
        const mite = makeEnemy("mite", enemy.x + direction * 15, enemy.y + rand(-6, 6), run.floor, run.difficulty);
        mite.hp = mite.maxHp = 13;
        mite.value = 18;
        room.enemies.push(mite);
      }
    }
  }

  function hurtPlayer(amount, sourceX, sourceY, bypassInvuln = false) {
    if (!run || screen !== "playing") return;
    const player = run.player;
    const room = currentNode().room;
    if (player.invuln > 0 && !bypassInvuln) return;
    if (player.saltWard && !player.roomWard) {
      player.roomWard = true;
      player.invuln = 0.35;
      burst(player.x, player.y, "#c1d0d1", 18, 150);
      floatText("SALT HOLDS", player.x, player.y - 30, "#d4dddd", 10);
      audio.tone(680, 0.2, "sine", 0.08, 0.6);
      return;
    }
    player.hp = Math.max(0, player.hp - amount);
    run.damageTaken += amount;
    player.invuln = 1.05;
    player.hurtFlash = 0.35;
    const angle = Math.atan2(player.y - sourceY, player.x - sourceX);
    player.dodgeX = Math.cos(angle) * 165;
    player.dodgeY = Math.sin(angle) * 165;
    shake = Math.max(shake, 8);
    burst(player.x, player.y, "#d36e65", 19, 165);
    floatText(`-${amount} HEART`, player.x, player.y - 31, "#ea8477", 11);
    audio.sfx("hurt");
    renderHearts();
    if (player.hp <= 0) endRun(false);
  }

  function beginDodge() {
    if (screen !== "playing" || !run || run.player.dodgeCd > 0) return;
    const player = run.player;
    let dx = (isDown("d") || isDown("arrowright") ? 1 : 0) - (isDown("a") || isDown("arrowleft") ? 1 : 0);
    let dy = (isDown("s") || isDown("arrowdown") ? 1 : 0) - (isDown("w") || isDown("arrowup") ? 1 : 0);
    if (!dx && !dy) { dx = player.aimX; dy = player.aimY; }
    const length = Math.hypot(dx, dy) || 1;
    player.dodgeX = dx / length;
    player.dodgeY = dy / length;
    player.dodgeTime = 0.2;
    player.dodgeCd = 0.88;
    player.invuln = Math.max(player.invuln, 0.29);
    burst(player.x, player.y, "#bcae94", 12, 65);
    audio.sfx("dodge");
  }

  function isDown(key) {
    return !!keys[key] || !!touchKeys[key];
  }

  function readGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    const pad = pads && Array.from(pads).find(Boolean);
    if (!pad) return null;
    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    const axis = (value) => Math.abs(value || 0) < 0.2 ? 0 : value;
    const current = {
      x: axis(axes[0]),
      y: axis(axes[1]),
      aimX: axis(axes[2]),
      aimY: axis(axes[3]),
      fire: !!(buttons[7] && buttons[7].pressed) || !!(buttons[0] && buttons[0].pressed),
      dodge: !!(buttons[1] && buttons[1].pressed),
      bomb: !!(buttons[2] && buttons[2].pressed),
      active: !!(buttons[3] && buttons[3].pressed),
      pause: !!(buttons[9] && buttons[9].pressed),
    };
    if (run) {
      const previous = run.padPrevious || {};
      if (current.dodge && !previous.dodge) beginDodge();
      if (current.bomb && !previous.bomb) placeBomb();
      if (current.active && !previous.active) useActive();
      if (current.pause && !previous.pause) togglePause();
      run.padPrevious = current;
    }
    return current;
  }

  function updateAimAndFire(dt, pad) {
    const player = run.player;
    let arrowX = (isDown("arrowright") ? 1 : 0) - (isDown("arrowleft") ? 1 : 0);
    let arrowY = (isDown("arrowdown") ? 1 : 0) - (isDown("arrowup") ? 1 : 0);
    const arrowLength = Math.hypot(arrowX, arrowY);
    if (arrowLength > 0) {
      arrowX /= arrowLength;
      arrowY /= arrowLength;
      player.aimX = arrowX;
      player.aimY = arrowY;
    } else if (pad && Math.hypot(pad.aimX, pad.aimY) > 0.2) {
      const length = Math.hypot(pad.aimX, pad.aimY);
      player.aimX = pad.aimX / length;
      player.aimY = pad.aimY / length;
    } else if (pointer.inside && !touchFiring) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      const length = Math.hypot(dx, dy);
      if (length > 12) { player.aimX = dx / length; player.aimY = dy / length; }
    }
    if (autoAim || (touchFiring && !pointer.inside)) {
      const target = nearestEnemy(currentNode().room, player.x, player.y);
      if (target) {
        const dx = target.x - player.x; const dy = target.y - player.y; const length = Math.hypot(dx, dy) || 1;
        player.aimX = dx / length; player.aimY = dy / length;
      }
    }
    const shouldFire = pointerDown || isDown(" ") || arrowLength > 0 || (pad && pad.fire) || touchFiring;
    if (shouldFire && player.fireCd <= 0) fireTears();
    player.fireCd = Math.max(0, player.fireCd - dt);
  }

  function nearestEnemy(room, x, y) {
    let nearest = null;
    let distance = Infinity;
    for (const enemy of room.enemies) {
      if (enemy.dead) continue;
      const next = dist(x, y, enemy.x, enemy.y);
      if (next < distance) { distance = next; nearest = enemy; }
    }
    return nearest;
  }

  function fireTears() {
    const player = run.player;
    const room = currentNode().room;
    const baseAngle = Math.atan2(player.aimY, player.aimX);
    const count = Math.max(1, player.shotCount);
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * (count > 1 ? 0.16 : 0);
      const angle = baseAngle + spread + (player.wobble ? Math.sin(run.elapsed * 11) * 0.025 : 0);
      const speed = player.shotSpeed * (player.wobble ? rand(0.94, 1.06) : 1);
      room.playerShots.push({
        x: player.x + Math.cos(angle) * 18,
        y: player.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 5.3,
        damage: player.damage,
        life: player.range / speed,
        pierce: player.pierce,
        hit: [],
        poison: player.poison,
        color: player.poison ? "#b8cb83" : player.ricochet ? "#d8b4d5" : "#e7d7ac",
      });
    }
    run.shots += count;
    player.fireCd = player.fireDelay;
    burst(player.x + player.aimX * 17, player.y + player.aimY * 17, player.poison ? "#b7cb81" : "#e9d9b5", 2, 30);
    if (run.elapsed - lastFireTone > 0.1) { audio.sfx("shoot"); lastFireTone = run.elapsed; }
  }

  function updatePlayer(dt, pad) {
    const p = run.player;
    let mx = (isDown("d") ? 1 : 0) - (isDown("a") ? 1 : 0) + (pad ? pad.x : 0);
    let my = (isDown("s") ? 1 : 0) - (isDown("w") ? 1 : 0) + (pad ? pad.y : 0);
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    p.moved = Math.hypot(mx, my) > 0.08;
    p.anim += dt * (p.moved ? 12 : 3);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.activeCd = Math.max(0, p.activeCd - dt);
    p.familiarCd -= dt;
    if (p.dodgeTime > 0) {
      p.dodgeTime -= dt;
      p.x += p.dodgeX * 570 * dt;
      p.y += p.dodgeY * 570 * dt;
    } else {
      p.x += mx * p.speed * dt;
      p.y += my * p.speed * dt;
    }
    const room = currentNode().room;
    for (const obstacle of room.obstacles) {
      if (obstacle.broken) continue;
      const separation = dist(p.x, p.y, obstacle.x, obstacle.y);
      const min = p.r + obstacle.r * 0.78;
      if (separation > 0 && separation < min) {
        const force = (min - separation) / separation;
        p.x += (p.x - obstacle.x) * force;
        p.y += (p.y - obstacle.y) * force;
      }
    }
    const middle = WORLD.height / 2;
    const inLeftDoor = Math.abs(p.y - middle) < 60 && canLeave(room, "left");
    const inRightDoor = Math.abs(p.y - middle) < 60 && canLeave(room, "right");
    const inTopDoor = Math.abs(p.x - WORLD.width / 2) < 60 && canLeave(room, "up");
    const inBottomDoor = Math.abs(p.x - WORLD.width / 2) < 60 && canLeave(room, "down");
    if (p.x < WORLD.left + (inLeftDoor ? -4 : 27)) {
      if (inLeftDoor && p.x < WORLD.left - 1) transition("left");
      else p.x = WORLD.left + (inLeftDoor ? -3 : 27);
    }
    if (!run) return;
    if (p.x > WORLD.right - (inRightDoor ? -4 : 27)) {
      if (inRightDoor && p.x > WORLD.right + 1) transition("right");
      else p.x = WORLD.right - (inRightDoor ? -3 : 27);
    }
    if (!run) return;
    if (p.y < WORLD.top + (inTopDoor ? -4 : 27)) {
      if (inTopDoor && p.y < WORLD.top - 1) transition("up");
      else p.y = WORLD.top + (inTopDoor ? -3 : 27);
    }
    if (!run) return;
    if (p.y > WORLD.bottom - (inBottomDoor ? -4 : 27)) {
      if (inBottomDoor && p.y > WORLD.bottom + 1) transition("down");
      else p.y = WORLD.bottom - (inBottomDoor ? -3 : 27);
    }
    if (!run) return;
    updateAimAndFire(dt, pad);
  }

  function spawnEnemyShot(enemy, angle, speed = 155, size = 6, color = "#d78981") {
    const room = currentNode().room;
    room.shots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: size, life: 4.6, damage: enemy.damage, color });
  }

  function aimedShot(enemy, speed, spread = 0, count = 1, color = "#d78981") {
    const p = run.player;
    const center = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    for (let i = 0; i < count; i += 1) {
      const angle = center + (i - (count - 1) / 2) * spread;
      spawnEnemyShot(enemy, angle, speed, enemy.type === "boss" ? 7 : 5.3, color);
    }
  }

  function updateBoss(enemy, dt, room) {
    const p = run.player;
    const dx = p.x - enemy.x; const dy = p.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.age += dt;
    if (enemy.flash > 0) enemy.flash -= dt;
    if (enemy.type === "boss" && enemy.phase === "charge") {
      enemy.phaseTime -= dt;
      enemy.x += Math.cos(enemy.chargeAngle) * 325 * dt;
      enemy.y += Math.sin(enemy.chargeAngle) * 325 * dt;
      if (enemy.phaseTime <= 0) { enemy.phase = "rest"; enemy.phaseTime = 0.45; }
    } else if (enemy.phase === "tell-charge") {
      enemy.phaseTime -= dt;
      if (enemy.phaseTime <= 0) {
        enemy.phase = "charge";
        enemy.phaseTime = 0.54;
        enemy.chargeAngle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.chargeHit = false;
      }
    } else if (enemy.phase === "rest") {
      enemy.phaseTime -= dt;
      if (enemy.phaseTime <= 0) enemy.phase = "idle";
    } else {
      const approach = enemy.bossIndex === 3 ? 0.12 : 0.25;
      enemy.x += dx / distance * enemy.speed * approach * dt;
      enemy.y += dy / distance * enemy.speed * approach * dt;
      enemy.age += dt;
      enemy.cooldown -= dt;
      if (enemy.cooldown < 0.55) enemy.phase = "tell";
      if (enemy.cooldown <= 0) {
        const index = enemy.bossIndex;
        if (index === 0) {
          if (enemy.attackNo % 2 === 0) {
            for (let i = 0; i < 12; i += 1) spawnEnemyShot(enemy, (Math.PI * 2 * i) / 12 + enemy.age * 0.22, 132, 6.5, "#e09c6c");
          } else aimedShot(enemy, 205, 0.12, 3, "#df8b79");
          enemy.cooldown = 2.45;
        } else if (index === 1) {
          if (enemy.attackNo % 3 === 2 && room.enemies.length < 5) {
            for (const side of [-1, 1]) room.enemies.push(makeEnemy("mite", enemy.x + side * 38, enemy.y + 36, run.floor, run.difficulty));
            floatText("THE CHOIR CALLS", enemy.x, enemy.y - 54, "#dca6a0", 10);
          } else aimedShot(enemy, 175, 0.22, 5, "#de8e98");
          enemy.cooldown = 1.7;
        } else if (index === 2) {
          for (let i = -2; i <= 2; i += 1) spawnEnemyShot(enemy, Math.atan2(dy, dx) + i * 0.2 + 1.18, 175, 6, "#b1ba73");
          enemy.cooldown = 1.5;
        } else if (index === 3) {
          if (enemy.attackNo % 2 === 0) {
            enemy.phase = "tell-charge";
            enemy.phaseTime = 0.7;
            enemy.cooldown = 2.5;
            floatText("IT KNOWS YOUR NEXT STEP", enemy.x, enemy.y - 55, "#dca4cb", 10);
          } else {
            for (let i = 0; i < 9; i += 1) spawnEnemyShot(enemy, (Math.PI * 2 * i) / 9 + enemy.age * 0.3, 158, 6.5, "#c7a0c7");
            enemy.cooldown = 2.0;
          }
        } else if (index === 4) {
          if (enemy.attackNo % 3 === 2 && room.enemies.length < 6) {
            for (const side of [-1, 1]) room.enemies.push(makeEnemy("spitter", clamp(enemy.x + side * 110, WORLD.left + 60, WORLD.right - 60), enemy.y + 82, run.floor, run.difficulty));
            floatText("SEEDS TAKE ROOT", enemy.x, enemy.y - 55, "#d6a979", 10);
          } else {
            const count = 10;
            for (let i = 0; i < count; i += 1) spawnEnemyShot(enemy, Math.PI * 2 * i / count + enemy.age * 0.16, 122, 6.2, "#db9771");
          }
          enemy.cooldown = 2.05;
        } else if (index === 5) {
          const rotation = Math.floor(enemy.attackNo / 2) % 2 ? Math.PI / 4 : 0;
          for (let i = 0; i < 4; i += 1) spawnEnemyShot(enemy, rotation + i * Math.PI / 2, 148, 7, "#c5bd7c");
          aimedShot(enemy, 180, 0.18, 3, "#d4ca89");
          enemy.cooldown = 1.65;
        } else if (index === 6) {
          if (enemy.attackNo % 3 === 2 && room.enemies.length < 7) {
            for (const side of [-1, 1]) room.enemies.push(makeEnemy("leech", enemy.x + side * 48, enemy.y + rand(-55, 55), run.floor, run.difficulty));
            floatText("THE HUNGER DIVIDES", enemy.x, enemy.y - 55, "#bda8d1", 10);
          } else {
            for (let i = 0; i < 13; i += 1) spawnEnemyShot(enemy, Math.PI * 2 * i / 13 + enemy.attackNo * 0.33, 138, 6.2, "#a393be");
          }
          enemy.cooldown = 1.8;
        } else {
          const healthRatio = enemy.hp / enemy.maxHp;
          if (healthRatio > 0.58) {
            for (let i = 0; i < 12; i += 1) spawnEnemyShot(enemy, Math.PI * 2 * i / 12 + enemy.age * 0.24, 142, 6.5, "#e0a480");
            enemy.cooldown = 1.75;
          } else if (healthRatio > 0.28) {
            aimedShot(enemy, 190, 0.19, 5, "#e19991");
            for (let i = 0; i < 6; i += 1) spawnEnemyShot(enemy, Math.PI * 2 * i / 6 + enemy.age * 0.38, 115, 5.5, "#c58f9d");
            enemy.cooldown = 1.35;
          } else {
            enemy.phase = "tell-charge";
            enemy.phaseTime = 0.55;
            enemy.cooldown = 1.55;
            for (let i = 0; i < 8; i += 1) spawnEnemyShot(enemy, Math.PI * 2 * i / 8 + enemy.age * 0.31, 162, 6.5, "#efc18d");
            floatText("THE HOUSE OPENS ITS EYE", enemy.x, enemy.y - 60, "#f0c8a5", 10);
          }
        }
        enemy.attackNo += 1;
        if (enemy.phase !== "tell-charge") enemy.phase = "idle";
      }
    }
    enemy.x = clamp(enemy.x, WORLD.left + enemy.r + 10, WORLD.right - enemy.r - 10);
    enemy.y = clamp(enemy.y, WORLD.top + enemy.r + 10, WORLD.bottom - enemy.r - 10);
    const gap = dist(enemy.x, enemy.y, p.x, p.y);
    if (gap < enemy.r + p.r && p.invuln <= 0 && enemy.phase === "charge" && !enemy.chargeHit) {
      enemy.chargeHit = true;
      hurtPlayer(2, enemy.x, enemy.y);
    } else if (gap < enemy.r + p.r - 1 && p.invuln <= 0 && enemy.phase !== "charge") {
      hurtPlayer(2, enemy.x, enemy.y);
    }
  }

  function updateEnemies(dt, room) {
    const player = run.player;
    room.slowTimer = Math.max(0, room.slowTimer - dt);
    const slow = room.slowTimer > 0 ? 0.34 : 1;
    for (const enemy of room.enemies) {
      if (enemy.dead) continue;
      if (enemy.type === "boss") { updateBoss(enemy, dt, room); continue; }
      enemy.age += dt;
      enemy.cooldown -= dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.knockX *= Math.max(0, 1 - dt * 7);
      enemy.knockY *= Math.max(0, 1 - dt * 7);
      if (enemy.poison > 0) {
        enemy.poison -= dt;
        enemy.poisonTick -= dt;
        if (enemy.poisonTick <= 0) {
          enemy.poisonTick = 0.55;
          enemy.hp -= 3.5;
          enemy.flash = 0.08;
          run.damageDealt += 3.5;
          burst(enemy.x, enemy.y, "#accc77", 2, 30);
          if (enemy.hp <= 0) { enemy.hp = 0; enemy.dead = true; killEnemy(enemy); continue; }
        }
      }
      const dx = player.x - enemy.x; const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      let vx = dx / distance;
      let vy = dy / distance;
      const effectiveSpeed = enemy.speed * slow;
      if (enemy.type === "spitter" || enemy.type === "turret") {
        if (enemy.type === "spitter" && distance < 175) { vx *= -1; vy *= -1; }
        else if (enemy.type === "spitter" && distance > 275) { /* Close the gap only when the room is safe. */ }
        else if (enemy.type === "turret") { vx = 0; vy = 0; }
        if (enemy.cooldown <= 0) {
          if (enemy.type === "turret") {
            for (let i = 0; i < 6; i += 1) spawnEnemyShot(enemy, enemy.age * 0.28 + Math.PI * 2 * i / 6, 118 * slow, 5.5, "#8eb4b1");
            enemy.cooldown = 2.25;
          } else {
            aimedShot(enemy, 147 * slow, 0, 1, "#a5c17c");
            enemy.cooldown = rand(1.45, 2.05);
          }
        }
      } else if (enemy.type === "brute") {
        if (enemy.phase === "charging") {
          enemy.phaseTime -= dt;
          enemy.x += Math.cos(enemy.chargeAngle) * 290 * slow * dt;
          enemy.y += Math.sin(enemy.chargeAngle) * 290 * slow * dt;
          if (dist(enemy.x, enemy.y, player.x, player.y) < enemy.r + player.r + 2 && player.invuln <= 0 && !enemy.chargeHit) {
            enemy.chargeHit = true;
            hurtPlayer(2, enemy.x, enemy.y);
          }
          if (enemy.phaseTime <= 0) { enemy.phase = "rest"; enemy.phaseTime = 0.72; enemy.cooldown = 1.3; }
        } else if (enemy.phase === "tell") {
          enemy.phaseTime -= dt;
          if (enemy.phaseTime <= 0) {
            enemy.phase = "charging";
            enemy.phaseTime = 0.48;
            enemy.chargeHit = false;
            enemy.chargeAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          }
        } else if (enemy.phase === "rest") {
          enemy.phaseTime -= dt;
          if (enemy.phaseTime <= 0) enemy.phase = "idle";
        } else if (enemy.cooldown <= 0 && distance < 310) {
          enemy.phase = "tell";
          enemy.phaseTime = 0.52;
        } else {
          enemy.x += vx * effectiveSpeed * 0.7 * dt;
          enemy.y += vy * effectiveSpeed * 0.7 * dt;
        }
      } else if (enemy.type === "bat") {
        const angle = Math.atan2(dy, dx) + Math.sin(enemy.age * 4.8) * 0.7;
        enemy.x += Math.cos(angle) * effectiveSpeed * dt;
        enemy.y += Math.sin(angle) * effectiveSpeed * dt;
      } else if (enemy.type === "wisp") {
        const angle = Math.atan2(dy, dx) + Math.sin(enemy.age * 2.7) * 1.12;
        enemy.x += Math.cos(angle) * effectiveSpeed * dt;
        enemy.y += Math.sin(angle) * effectiveSpeed * dt;
        if (enemy.cooldown <= 0) {
          aimedShot(enemy, 123 * slow, 0.32, 3, "#b5a2d4");
          enemy.cooldown = 2.4;
        }
      } else {
        const wiggle = enemy.type === "leech" ? Math.sin(enemy.age * 3) * 0.25 : Math.sin(enemy.age * 5) * 0.08;
        enemy.x += (vx - vy * wiggle) * effectiveSpeed * dt;
        enemy.y += (vy + vx * wiggle) * effectiveSpeed * dt;
      }
      enemy.x += enemy.knockX * dt;
      enemy.y += enemy.knockY * dt;
      enemy.x = clamp(enemy.x, WORLD.left + enemy.r + 9, WORLD.right - enemy.r - 9);
      enemy.y = clamp(enemy.y, WORLD.top + enemy.r + 9, WORLD.bottom - enemy.r - 9);
      for (const obstacle of room.obstacles) {
        if (obstacle.broken) continue;
        const gap = dist(enemy.x, enemy.y, obstacle.x, obstacle.y);
        if (gap > 0 && gap < enemy.r + obstacle.r * 0.65) {
          const force = (enemy.r + obstacle.r * 0.65 - gap) / gap;
          enemy.x += (enemy.x - obstacle.x) * force;
          enemy.y += (enemy.y - obstacle.y) * force;
        }
      }
      const touchGap = dist(enemy.x, enemy.y, player.x, player.y);
      if (touchGap < enemy.r + player.r && player.invuln <= 0 && enemy.phase !== "charging" && enemy.phase !== "tell") hurtPlayer(enemy.damage, enemy.x, enemy.y);
    }
    room.enemies = room.enemies.filter((enemy) => !enemy.dead);
  }

  function updateShots(dt, room) {
    const player = run.player;
    for (let i = room.playerShots.length - 1; i >= 0; i -= 1) {
      const shot = room.playerShots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      let removed = shot.life <= 0 || shot.x < WORLD.left - 10 || shot.x > WORLD.right + 10 || shot.y < WORLD.top - 10 || shot.y > WORLD.bottom + 10;
      if (!removed) {
        for (const obstacle of room.obstacles) {
          if (!obstacle.broken && dist(shot.x, shot.y, obstacle.x, obstacle.y) < obstacle.r + shot.r) {
            obstacle.hp -= shot.damage > 2 ? 1 : 0.45;
            if (obstacle.hp <= 0) breakObstacle(obstacle);
            removed = true;
            burst(shot.x, shot.y, "#cfba90", 2, 28);
            break;
          }
        }
      }
      if (!removed) {
        for (const enemy of room.enemies) {
          if (enemy.dead || shot.hit.includes(enemy)) continue;
          if (dist(shot.x, shot.y, enemy.x, enemy.y) < enemy.r + shot.r) {
            shot.hit.push(enemy);
            let damage = shot.damage;
            const pairCritical = run.items.includes("glass-saint") && run.items.includes("moon-milk") && gameplayRandom() < 0.12;
            if (pairCritical) { damage *= 2.1; floatText("CRACK!", enemy.x, enemy.y - 27, "#ffe2a4", 11); burst(enemy.x, enemy.y, "#f1d28d", 10, 100); }
            damageEnemy(enemy, damage, shot.color);
            if (shot.poison) { enemy.poison = Math.max(enemy.poison, 3.4); enemy.poisonTick = 0.3; }
            const push = Math.atan2(shot.vy, shot.vx);
            enemy.knockX += Math.cos(push) * 26;
            enemy.knockY += Math.sin(push) * 26;
            if (player.splash) {
              for (const other of room.enemies) if (other !== enemy && !other.dead && dist(other.x, other.y, enemy.x, enemy.y) < 52) damageEnemy(other, shot.damage * 0.26, "#a9d1c7");
            }
            if (shot.pierce > 0) shot.pierce -= 1;
            else removed = true;
            if (player.ricochet && !shot.bounced && room.enemies.length > 1) {
              let next = null;
              let nearest = Infinity;
              for (const candidate of room.enemies) {
                if (candidate.dead || candidate === enemy || shot.hit.includes(candidate)) continue;
                const gap = dist(candidate.x, candidate.y, enemy.x, enemy.y);
                if (gap < nearest) { nearest = gap; next = candidate; }
              }
              if (next) {
                const angle = Math.atan2(next.y - enemy.y, next.x - enemy.x);
                shot.vx = Math.cos(angle) * player.shotSpeed * 0.9;
                shot.vy = Math.sin(angle) * player.shotSpeed * 0.9;
                shot.life = Math.min(shot.life, 0.68);
                shot.bounced = true;
                if (run.items.includes("echo-chamber")) shot.pierce = Math.max(shot.pierce, 1);
                removed = false;
              }
            }
            break;
          }
        }
      }
      if (removed) room.playerShots.splice(i, 1);
    }

    for (let i = room.shots.length - 1; i >= 0; i -= 1) {
      const shot = room.shots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < WORLD.left - 8 || shot.x > WORLD.right + 8 || shot.y < WORLD.top - 8 || shot.y > WORLD.bottom + 8) {
        room.shots.splice(i, 1);
        continue;
      }
      if (dist(shot.x, shot.y, player.x, player.y) < shot.r + player.r && player.invuln <= 0) {
        room.shots.splice(i, 1);
        hurtPlayer(shot.damage, shot.x, shot.y);
      }
    }
    room.enemies = room.enemies.filter((enemy) => !enemy.dead);
  }

  function updateRoomThings(dt, room) {
    for (let i = room.bombs.length - 1; i >= 0; i -= 1) {
      const bomb = room.bombs[i];
      bomb.fuse -= dt;
      bomb.age += dt;
      if (bomb.fuse <= 0) {
        detonateBomb(bomb, room);
        room.bombs.splice(i, 1);
      }
    }
    for (let i = room.pickups.length - 1; i >= 0; i -= 1) {
      const item = room.pickups[i];
      item.age += dt;
      const player = run.player;
      if (item.type === "coin" && run.items.includes("bad-penny")) item.attract = true;
      if (item.attract && dist(item.x, item.y, player.x, player.y) < 185) {
        const angle = Math.atan2(player.y - item.y, player.x - item.x);
        item.x += Math.cos(angle) * 235 * dt;
        item.y += Math.sin(angle) * 235 * dt;
      }
      if (dist(item.x, item.y, player.x, player.y) < item.r + player.r + 4) {
        const pickedUp = collectPickup(item);
        if (pickedUp) room.pickups.splice(i, 1);
      }
    }
    for (const hazard of room.hazards) {
      hazard.phase += dt;
      if (hazard.phase > 3.25) hazard.phase -= 3.25;
      hazard.warning = hazard.phase > 2.0 && hazard.phase < 2.55;
      hazard.active = hazard.phase >= 2.55;
      if (hazard.active && dist(run.player.x, run.player.y, hazard.x, hazard.y) < hazard.r + run.player.r - 2) hurtPlayer(1, hazard.x, hazard.y);
    }
    for (const obstacle of room.obstacles) {
      if (obstacle.broken) continue;
      if (obstacle.hp < obstacle.maxHp) obstacle.flash = Math.max(0, (obstacle.flash || 0) - dt);
    }
    if (run.player.familiar && run.player.familiarCd <= 0 && room.enemies.length) {
      const target = nearestEnemy(room, run.player.x, run.player.y);
      if (target) {
        const angle = Math.atan2(target.y - run.player.y, target.x - run.player.x);
        room.playerShots.push({ x: run.player.x - 19, y: run.player.y - 18, vx: Math.cos(angle) * 365, vy: Math.sin(angle) * 365, r: 4, damage: run.player.damage * 0.45, life: 1.2, pierce: 0, hit: [], poison: false, color: "#c9a9dc", familiar: true });
        run.player.familiarCd = 1.18;
        burst(run.player.x - 20, run.player.y - 18, "#c9a9dc", 4, 32);
      }
    }
    if (run.player.orbitals > 0) {
      const t = run.elapsed * 1.65;
      for (let i = 0; i < run.player.orbitals; i += 1) {
        const angle = t + i * Math.PI * 2 / run.player.orbitals;
        const ox = run.player.x + Math.cos(angle) * 36;
        const oy = run.player.y + Math.sin(angle) * 36;
        for (const enemy of room.enemies) {
          if (!enemy.dead && dist(ox, oy, enemy.x, enemy.y) < enemy.r + 8 && !enemy.orbitHit) {
            damageEnemy(enemy, 4.5, "#dac7ee");
            enemy.orbitHit = true;
            window.setTimeout(() => { if (!disposed) enemy.orbitHit = false; }, 330);
          }
        }
      }
    }
  }

  function updateEffects(dt) {
    for (let i = run.effects.length - 1; i >= 0; i -= 1) {
      const effect = run.effects[i];
      effect.life -= dt;
      if (effect.kind === "ring") effect.r += (effect.max - effect.r) * Math.min(1, dt * 14);
      else {
        effect.x += effect.vx * dt;
        effect.y += effect.vy * dt;
        effect.vx *= Math.max(0, 1 - dt * 1.8);
        effect.vy = effect.vy * Math.max(0, 1 - dt * 1.8) + (effect.gravity || 0) * dt;
      }
      if (effect.life <= 0) run.effects.splice(i, 1);
    }
    for (let i = run.floats.length - 1; i >= 0; i -= 1) {
      const item = run.floats[i];
      item.life -= dt;
      item.y -= 22 * dt;
      if (item.life <= 0) run.floats.splice(i, 1);
    }
  }

  function updateGame(dt) {
    if (screen !== "playing" || !run) return;
    run.elapsed += dt;
    run.player.anim += dt;
    const pad = readGamepad();
    updatePlayer(dt, pad);
    if (!run || screen !== "playing") return;
    const node = currentNode();
    if (!node || !node.room) return;
    const room = node.room;
    if (room.enemies.length) updateEnemies(dt, room);
    if (!run || screen !== "playing") return;
    updateShots(dt, room);
    if (!run || screen !== "playing") return;
    updateRoomThings(dt, room);
    updateEffects(dt);
    if (room.enemies.length === 0 && !room.cleared) onRoomCleared(room);
    if (!run || screen !== "playing") return;
    if (room.clearClock > 0) room.clearClock = Math.max(0, room.clearClock - dt);
    if (run.lastDoor > 0) run.lastDoor = Math.max(0, run.lastDoor - dt);
    const enemiesNow = room.enemies.length;
    if (enemiesNow !== previousEnemyCount) {
      previousEnemyCount = enemiesNow;
      audio.setMode(room.type === "boss" && enemiesNow ? "boss" : enemiesNow ? "combat" : "ambient");
    }
    uiClock += dt;
    if (uiClock >= 0.2) {
      uiClock = 0;
      renderHearts();
      updateSceneLabels();
      if (Math.floor(run.elapsed * 2) % 2 === 0) renderSidebar();
    }
    profile.bestFloor = Math.max(profile.bestFloor, run.floor);
    if (toastTimer > 0) {
      toastTimer -= dt * 1000;
      if (toastTimer <= 0) toast.classList.remove("show");
    }
    shake = Math.max(0, shake - dt * 20);
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawRoomBase(room, time) {
    const { width: w, height: h, left, right, top, bottom } = WORLD;
    const floorIndex = run ? clamp(run.floor - 1, 0, FLOOR_PALETTES.length - 1) : 0;
    const palette = FLOOR_PALETTES[floorIndex];
    ctx.fillStyle = "#111110";
    ctx.fillRect(0, 0, w, h);
    const outerGlow = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 570);
    outerGlow.addColorStop(0, palette.glow);
    outerGlow.addColorStop(0.55, "#171614");
    outerGlow.addColorStop(1, "#0d0d0c");
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, w, h);

    const floorGradient = ctx.createLinearGradient(left, top, right, bottom);
    floorGradient.addColorStop(0, palette.light);
    floorGradient.addColorStop(0.52, palette.mid);
    floorGradient.addColorStop(1, palette.deep);
    ctx.fillStyle = floorGradient;
    ctx.fillRect(left, top, right - left, bottom - top);

    const seed = room ? room.decorationSeed : 9471;
    const random = seededRandom(seed);
    for (let y = top + 12; y < bottom; y += 42) {
      for (let x = left + 10; x < right; x += 44) {
        const offset = random() * 4;
        ctx.strokeStyle = random() > 0.55 ? palette.line : "rgba(7,7,7,.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + offset, y);
        ctx.lineTo(x + offset, y + 42);
        ctx.lineTo(x + 44, y + 42);
        ctx.stroke();
        if (random() > 0.965) {
          ctx.fillStyle = "rgba(125,74,55,.07)";
          ctx.beginPath();
          ctx.ellipse(x + random() * 40, y + random() * 35, random() * 13 + 4, random() * 6 + 2, random(), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (let i = 0; i < 9; i += 1) {
      const fx = left + 55 + random() * (right - left - 110);
      const fy = top + 42 + random() * (bottom - top - 84);
      const rx = 22 + random() * 34;
      const ry = 5 + random() * 8;
      ctx.fillStyle = i % 3 === 0 ? palette.stain : "rgba(0,0,0,.09)";
      ctx.beginPath();
      ctx.ellipse(fx, fy, rx, ry, random() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.75)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#141311";
    ctx.fillRect(left - 4, top - 7, right - left + 8, bottom - top + 14);
    ctx.restore();
    ctx.fillStyle = floorGradient;
    ctx.fillRect(left, top, right - left, bottom - top);
    for (let y = top + 12; y < bottom; y += 42) {
      for (let x = left + 10; x < right; x += 44) {
    ctx.strokeStyle = palette.line;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 42); ctx.lineTo(x + 44, y + 42); ctx.stroke();
      }
    }

    // A little age in the stone: scuffs are deterministic per room, so revisits feel familiar.
    const scuffRandom = seededRandom(seed ^ 0x3319);
    for (let i = 0; i < 19; i += 1) {
      const x = left + 20 + scuffRandom() * (right - left - 40);
      const y = top + 20 + scuffRandom() * (bottom - top - 40);
      ctx.strokeStyle = scuffRandom() > 0.5 ? "rgba(191,161,117,.08)" : "rgba(0,0,0,.16)";
      ctx.lineWidth = scuffRandom() * 1.3 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + scuffRandom() * 25 - 12, y + scuffRandom() * 10 - 5);
      ctx.stroke();
    }
    drawFloorMotif(floorIndex, room, time);

    ctx.fillStyle = "#11100f";
    ctx.fillRect(left - 7, top - 8, right - left + 14, 10);
    ctx.fillRect(left - 7, bottom - 2, right - left + 14, 10);
    ctx.fillRect(left - 8, top, 10, bottom - top);
    ctx.fillRect(right - 2, top, 10, bottom - top);
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(left + 1, top + 1, right - left - 2, bottom - top - 2);
    ctx.strokeStyle = "rgba(0,0,0,.75)";
    ctx.lineWidth = 4;
    ctx.strokeRect(left - 5, top - 5, right - left + 10, bottom - top + 10);

    const current = currentNode();
    for (const direction of ["up", "right", "down", "left"]) {
      let target = room && current ? exitNode(current, direction) : null;
      let secretDoor = false;
      if (!target && room && current && run && run.floorMap.secret && run.floorMap.secret.revealed && run.floorMap.secret.hostId === current.id && edgeDirection(current, { x: run.floorMap.secret.x, y: run.floorMap.secret.y }) === direction) {
        target = true;
        secretDoor = true;
      }
      if (!target) continue;
      const open = !!(room && room.cleared);
      drawDoor(direction, open, secretDoor, time);
    }

    // Candle alcoves anchor the room and give the floor a soft, living pulse.
    drawCandle(left + 33, top + 34, time, 0.2);
    drawCandle(right - 33, top + 34, time, 1.4);
    drawCandle(left + 33, bottom - 34, time, 2.2);
    drawCandle(right - 33, bottom - 34, time, 3.1);

    const centerRune = room && room.type === "boss" ? 1 : room && room.type === "curse" ? 2 : 0;
    if (centerRune) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(time * (centerRune === 1 ? 0.08 : -0.06));
      ctx.strokeStyle = centerRune === 1 ? "rgba(182,116,94,.19)" : "rgba(193,66,60,.12)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 53, Math.sin(a) * 53); ctx.lineTo(Math.cos(a) * 63, Math.sin(a) * 63); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFloorMotif(index, room, time) {
    const random = seededRandom((room ? room.decorationSeed : 9471) ^ ((index + 1) * 0x9e3779b9));
    const palette = FLOOR_PALETTES[index] || FLOOR_PALETTES[0];
    ctx.save();
    ctx.globalAlpha = 0.56;
    if (index === 0) {
      for (let i = 0; i < 6; i += 1) {
        const x = 155 + random() * 650; const y = 105 + random() * 350;
        ctx.fillStyle = "rgba(53,111,104,.09)";
        ctx.beginPath(); ctx.ellipse(x, y, 34 + random() * 45, 7 + random() * 8, random() * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(128,178,157,.13)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - 4, y - 1, 18 + random() * 26, 3, 0, Math.PI, Math.PI * 1.8); ctx.stroke();
      }
    } else if (index === 1) {
      ctx.strokeStyle = "rgba(172,91,66,.22)"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i += 1) {
        let x = 135 + random() * 680; let y = 95 + random() * 365;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 4; j += 1) { x += random() * 28 - 14; y += random() * 22 - 11; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = `rgba(225,139,81,${.07 + Math.sin(time * 2 + i) * .025})`;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (index === 2) {
      ctx.strokeStyle = "rgba(198,185,138,.14)"; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const x = 175 + random() * 610; const y = 110 + random() * 335;
        ctx.beginPath(); ctx.ellipse(x, y, 28 + random() * 26, 8, random() * 0.7, Math.PI * .15, Math.PI * 1.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 16, y + 2); ctx.lineTo(x + 13, y - 3); ctx.stroke();
      }
    } else if (index === 3) {
      for (let i = 0; i < 8; i += 1) {
        const x = 145 + random() * 670; const y = 100 + random() * 350;
        const size = 8 + random() * 18;
        ctx.fillStyle = "rgba(166,136,194,.06)";
        ctx.strokeStyle = "rgba(194,169,216,.2)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .32, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size * .28, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .32, y); ctx.stroke();
      }
    } else if (index === 4) {
      for (let i = 0; i < 5; i += 1) {
        const x = 155 + random() * 650; const y = 105 + random() * 350;
        ctx.strokeStyle = "rgba(97,160,165,.14)"; ctx.lineWidth = 1;
        for (let ring = 0; ring < 3; ring += 1) {
          ctx.beginPath(); ctx.ellipse(x, y, 16 + ring * 11 + Math.sin(time + i) * 1.5, 5 + ring * 4, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else {
      const x = WORLD.width / 2; const y = WORLD.height / 2;
      ctx.strokeStyle = "rgba(190,105,98,.14)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, 116 + Math.sin(time * 1.8) * 2, 57 + Math.sin(time * 1.8) * 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, 93, 42, 0, Math.PI * .1, Math.PI * .9); ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const angle = i * Math.PI / 4;
        const r = 78 + random() * 22;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * 56, y + Math.sin(angle) * 30); ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r * .52); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawDoor(direction, open, secret, time) {
    const color = secret ? "#b99659" : open ? "#9d8055" : "#7e514b";
    ctx.save();
    ctx.shadowColor = open ? "rgba(217,174,104,.22)" : "rgba(179,78,68,.18)";
    ctx.shadowBlur = open ? 12 : 5;
    if (direction === "up" || direction === "down") {
      const x = WORLD.width / 2 - 60;
      const y = direction === "up" ? WORLD.top - 8 : WORLD.bottom - 3;
      ctx.fillStyle = open ? "#151310" : "#291c1a";
      ctx.fillRect(x, y, 120, 16);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + (direction === "up" ? 6 : 0), 4, 12);
      ctx.fillRect(x + 116, y + (direction === "up" ? 6 : 0), 4, 12);
      ctx.fillStyle = open ? "rgba(208,170,106,.48)" : "rgba(177,92,78,.52)";
      ctx.fillRect(x + 13, y + (direction === "up" ? 9 : 3), 94, 2);
      if (!open) {
        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = "#6f5146";
          ctx.fillRect(x + 18 + i * 25, y - (direction === "up" ? 1 : 0), 3, 17);
        }
      }
    } else {
      const x = direction === "left" ? WORLD.left - 8 : WORLD.right - 8;
      const y = WORLD.height / 2 - 60;
      ctx.fillStyle = open ? "#151310" : "#291c1a";
      ctx.fillRect(x, y, 16, 120);
      ctx.fillStyle = color;
      ctx.fillRect(x + (direction === "left" ? 6 : 0), y, 12, 4);
      ctx.fillRect(x + (direction === "left" ? 6 : 0), y + 116, 12, 4);
      ctx.fillStyle = open ? "rgba(208,170,106,.48)" : "rgba(177,92,78,.52)";
      ctx.fillRect(x + (direction === "left" ? 9 : 3), y + 13, 2, 94);
      if (!open) {
        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = "#6f5146";
          ctx.fillRect(x - (direction === "left" ? 1 : 0), y + 18 + i * 25, 17, 3);
        }
      }
    }
    if (secret) {
      ctx.strokeStyle = `rgba(229,191,119,${0.48 + Math.sin(time * 2) * 0.16})`;
      ctx.lineWidth = 1;
      if (direction === "left" || direction === "right") {
        const x = direction === "left" ? WORLD.left + 4 : WORLD.right - 4;
        ctx.beginPath(); ctx.moveTo(x, WORLD.height / 2 - 25); ctx.lineTo(x, WORLD.height / 2 + 25); ctx.stroke();
      } else {
        const y = direction === "up" ? WORLD.top + 4 : WORLD.bottom - 4;
        ctx.beginPath(); ctx.moveTo(WORLD.width / 2 - 25, y); ctx.lineTo(WORLD.width / 2 + 25, y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCandle(x, y, time, phase) {
    const flicker = Math.sin(time * 11 + phase) * 1.6 + Math.sin(time * 17 + phase * 2) * 0.8;
    const glow = ctx.createRadialGradient(x, y - 8, 1, x, y - 8, 46 + flicker * 2);
    glow.addColorStop(0, "rgba(229,169,88,.19)");
    glow.addColorStop(1, "rgba(229,169,88,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 8, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#63513c"; ctx.fillRect(x - 4, y - 7, 8, 14);
    ctx.fillStyle = "#c0a77b"; ctx.fillRect(x - 3, y - 7, 6, 2);
    ctx.fillStyle = "#e5a850";
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x - 5 - flicker, y - 18, x + flicker * 0.35, y - 24 - Math.abs(flicker)); ctx.quadraticCurveTo(x + 5 + flicker, y - 17, x, y - 9); ctx.fill();
    ctx.fillStyle = "rgba(255,226,164,.8)"; ctx.fillRect(x - 1, y - 14, 2, 6);
  }

  function drawObstacle(obstacle) {
    if (obstacle.broken) {
      ctx.fillStyle = "rgba(119,101,80,.42)";
      ctx.beginPath(); ctx.ellipse(obstacle.x, obstacle.y + 7, obstacle.r * 1.4, 4, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.fillStyle = "rgba(0,0,0,.33)";
    ctx.beginPath(); ctx.ellipse(1, obstacle.r * 0.66, obstacle.r * 1.1, obstacle.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    if (obstacle.kind === "bone") {
      ctx.strokeStyle = "#756a59"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-obstacle.r * 0.8, -4); ctx.lineTo(obstacle.r * 0.7, 2); ctx.stroke();
      ctx.fillStyle = "#a8977e";
      for (const x of [-obstacle.r * 0.8, obstacle.r * 0.7]) { ctx.beginPath(); ctx.arc(x, x < 0 ? -4 : 2, 5, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const gradient = ctx.createLinearGradient(-obstacle.r, -obstacle.r, obstacle.r, obstacle.r);
      gradient.addColorStop(0, obstacle.flash > 0 ? "#e9d2ae" : "#9b785c");
      gradient.addColorStop(1, "#4b3e33");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-obstacle.r * .72, obstacle.r * .55);
      ctx.lineTo(-obstacle.r * .82, -obstacle.r * .34);
      ctx.quadraticCurveTo(-obstacle.r * .4, -obstacle.r * 1.2, obstacle.r * .2, -obstacle.r * .92);
      ctx.quadraticCurveTo(obstacle.r * .83, -obstacle.r * .68, obstacle.r * .74, obstacle.r * .48);
      ctx.quadraticCurveTo(0, obstacle.r * 1.08, -obstacle.r * .72, obstacle.r * .55);
      ctx.fill();
      ctx.strokeStyle = "rgba(236,204,159,.34)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = "rgba(39,30,24,.65)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-5, -obstacle.r * .2); ctx.lineTo(3, 4); ctx.lineTo(-2, obstacle.r * .63); ctx.stroke();
    }
    ctx.restore();
  }

  function drawChest(room, time) {
    const x = room.chestX; const y = room.chestY;
    const opened = room.chestOpened;
    const glow = ctx.createRadialGradient(x, y, 3, x, y, opened ? 28 : 62);
    glow.addColorStop(0, opened ? "rgba(226,189,112,.12)" : `rgba(224,178,96,${.14 + Math.sin(time * 2.7) * .025})`);
    glow.addColorStop(1, "rgba(224,178,96,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(x, y + 13, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (!opened) {
      ctx.fillStyle = "#614626"; ctx.fillRect(x - 26, y - 15, 52, 32);
      ctx.fillStyle = "#9b713d"; ctx.fillRect(x - 28, y - 17, 56, 8);
      ctx.fillStyle = "#c59b57"; ctx.fillRect(x - 28, y - 10, 56, 3);
      ctx.fillStyle = "#bd985a"; ctx.fillRect(x - 4, y - 10, 8, 26);
      ctx.fillStyle = "#d5b36d"; ctx.fillRect(x - 2, y - 6, 4, 7);
      ctx.fillStyle = "#342619"; ctx.fillRect(x - 2, y - 2, 4, 5);
      ctx.strokeStyle = "rgba(244,205,124,.48)"; ctx.lineWidth = 1; ctx.strokeRect(x - 26, y - 15, 52, 32);
    } else {
      ctx.fillStyle = "#5c442b"; ctx.fillRect(x - 24, y + 3, 48, 13);
      ctx.fillStyle = "#90683b"; ctx.fillRect(x - 23, y - 12, 46, 7);
      ctx.save(); ctx.translate(x, y - 8); ctx.rotate(-0.28); ctx.fillRect(-25, -9, 50, 8); ctx.restore();
      ctx.strokeStyle = "rgba(224,189,118,.45)"; ctx.beginPath(); ctx.arc(x, y - 14, 15 + Math.sin(time * 4) * 2, Math.PI, 0); ctx.stroke();
    }
    if (!opened) {
      ctx.fillStyle = "#cfb579"; ctx.font = "9px Arial"; ctx.textAlign = "center"; ctx.fillText("E", x, y + 33);
    }
  }

  function drawShrine(room, time) {
    const options = [
      { x: 355, color: "#a85c54", mark: "!", label: room.eventKind === "tithe" ? "BLOOD" : "OFFER" },
      { x: 605, color: room.eventKind === "fountain" ? "#81aa9c" : "#c09b5f", mark: room.eventKind === "well" ? "$" : "+", label: room.eventKind === "fountain" ? "WELL" : room.eventKind === "well" ? "TOLL" : "TITHE" },
    ];
    for (let i = 0; i < options.length; i += 1) {
      const option = options[i];
      const active = !room.resolved && dist(run.player.x, run.player.y, option.x, 280) < 85;
      ctx.save();
      ctx.translate(option.x, 280);
      const pulse = 0.5 + Math.sin(time * 2.5 + i) * 0.08;
      const glow = ctx.createRadialGradient(0, -12, 2, 0, -12, active ? 67 : 46);
      glow.addColorStop(0, `${option.color}${Math.round(pulse * 62).toString(16).padStart(2, "0")}`);
      glow.addColorStop(1, `${option.color}00`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -12, active ? 67 : 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#342c24"; ctx.fillRect(-21, 6, 42, 17);
      ctx.fillStyle = "#574534"; ctx.beginPath(); ctx.moveTo(-27, 7); ctx.lineTo(-18, -13); ctx.lineTo(17, -13); ctx.lineTo(27, 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = option.color; ctx.lineWidth = active ? 2 : 1; ctx.stroke();
      ctx.fillStyle = option.color; ctx.font = "17px Georgia"; ctx.textAlign = "center"; ctx.fillText(option.mark, 0, 3);
      ctx.fillStyle = "#b4a78e"; ctx.font = "8px Arial"; ctx.fillText(option.label, 0, 37);
      if (active) { ctx.fillStyle = "#e7d1a4"; ctx.font = "8px Arial"; ctx.fillText("E / OFFER", 0, 51); }
      ctx.restore();
    }
  }

  function drawShop(room, time) {
    const labels = room.shop.map((shelf) => ({
      shelf,
      title: shelf.kind === "item" ? (ITEMS.find((item) => item.id === shelf.id) || ITEMS[0]).name : shelf.kind === "heart" ? "HEARTS" : "SUPPLIES",
      mark: shelf.kind === "item" ? (ITEMS.find((item) => item.id === shelf.id) || ITEMS[0]).mark : shelf.kind === "heart" ? "<3" : "B+",
    }));
    for (const { shelf, title, mark } of labels) {
      const x = shelf.x; const y = shelf.y;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x, y + 27, 48, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#382f26"; ctx.fillRect(x - 41, y + 8, 82, 17);
      ctx.fillStyle = "#6c5538"; ctx.fillRect(x - 46, y + 4, 92, 7);
      ctx.strokeStyle = "rgba(199,165,106,.36)"; ctx.lineWidth = 1; ctx.strokeRect(x - 46, y + 4, 92, 20);
      if (!shelf.bought) {
        const pulse = Math.sin(time * 3 + x) * 1.5;
        ctx.shadowColor = "rgba(233,190,116,.44)"; ctx.shadowBlur = 15;
        ctx.fillStyle = shelf.kind === "heart" ? "#c76c62" : "#d6b578";
        ctx.beginPath(); ctx.arc(x, y - 6 + pulse, 15, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#35281a"; ctx.font = "12px Georgia"; ctx.textAlign = "center"; ctx.fillText(mark, x, y - 1 + pulse);
        ctx.fillStyle = "#c9b98f"; ctx.font = "8px Arial"; ctx.fillText(title.toUpperCase(), x, y - 34);
        ctx.fillStyle = "#e3c077"; ctx.fillText(`${shelf.cost} COIN`, x, y + 43);
        if (dist(run.player.x, run.player.y, x, y) < 70) { ctx.fillStyle = "#f0dbad"; ctx.fillText("E / BUY", x, y + 57); }
      } else {
        ctx.fillStyle = "#746b5d"; ctx.font = "8px Arial"; ctx.textAlign = "center"; ctx.fillText("SOLD", x, y - 3);
      }
    }
  }

  function drawStairs(room, time) {
    if (!room.stairs) return;
    const x = room.stairsX || WORLD.width / 2;
    const y = room.stairsY || WORLD.height / 2 + 48;
    const glow = ctx.createRadialGradient(x, y, 5, x, y, 90);
    glow.addColorStop(0, `rgba(226,188,112,${.21 + Math.sin(time * 3) * .05})`);
    glow.addColorStop(1, "rgba(226,188,112,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 90, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#181611"; ctx.beginPath(); ctx.ellipse(0, 0, 39, 25, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const inset = i * 5;
      ctx.strokeStyle = `rgba(221,185,113,${.72 - i * .1})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(0, 0, 34 - inset, 20 - inset * 0.54, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    if (dist(run.player.x, run.player.y, x, y) < 76) {
      ctx.fillStyle = "#eed59c"; ctx.font = "9px Arial"; ctx.textAlign = "center"; ctx.fillText("E / DESCEND", x, y + 43);
    }
  }

  function drawPickup(pickup, time) {
    const bob = Math.sin(time * 3.7 + pickup.age * 3) * 3.5;
    const y = pickup.y + bob;
    ctx.save(); ctx.translate(pickup.x, y);
    const colors = { coin: "#dfb75e", heart: "#d96f67", key: "#d3c18a", bomb: "#8cb4b3", item: "#d7b978" };
    const color = colors[pickup.type] || "#d4bd8c";
    const radius = pickup.type === "item" ? 25 : 19;
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
    glow.addColorStop(0, `${color}5e`); glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    if (pickup.type === "coin") {
      ctx.fillStyle = "#ab8042"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, Math.sin(time * 4) * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f1ce7a"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = "#f2d48c"; ctx.font = "9px Georgia"; ctx.textAlign = "center"; ctx.fillText("v", 0, 3);
    } else if (pickup.type === "heart") {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-16, -2, -7, -13, 0, -6); ctx.bezierCurveTo(8, -14, 16, -2, 0, 8); ctx.fill();
      ctx.fillStyle = "rgba(255,221,190,.42)"; ctx.fillRect(-5, -7, 2, 5);
    } else if (pickup.type === "key") {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-4, -3, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(8, 8); ctx.lineTo(5, 11); ctx.moveTo(5, 5); ctx.lineTo(8, 2); ctx.stroke();
    } else if (pickup.type === "bomb") {
      ctx.fillStyle = "#38403d"; ctx.beginPath(); ctx.arc(0, 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#a8b9b2"; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = "#c9b070"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(5, -11); ctx.stroke();
    } else if (pickup.type === "item") {
      const item = ITEMS.find((candidate) => candidate.id === pickup.itemId) || ITEMS[0];
      ctx.fillStyle = "#42331e"; ctx.fillRect(-15, 3, 30, 10);
      ctx.fillStyle = "#ba9658"; ctx.fillRect(-18, 0, 36, 5);
      ctx.fillStyle = "#e0c27e"; ctx.beginPath(); ctx.arc(0, -8, 11 + Math.sin(time * 4) * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#342719"; ctx.font = item.mark.length > 1 ? "8px Georgia" : "12px Georgia"; ctx.textAlign = "center"; ctx.fillText(item.mark, 0, -4);
      ctx.fillStyle = "#d8c39d"; ctx.font = "8px Arial"; ctx.fillText(item.name.toUpperCase(), 0, 22);
    }
    ctx.restore();
  }

  function drawHazard(hazard, time) {
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.fillStyle = hazard.active ? "rgba(209,72,60,.24)" : hazard.warning ? `rgba(216,124,69,${.14 + Math.sin(time * 19) * .05})` : "rgba(0,0,0,.15)";
    ctx.beginPath(); ctx.arc(0, 0, hazard.r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hazard.active ? "rgba(221,91,68,.85)" : hazard.warning ? "rgba(225,157,89,.72)" : "rgba(139,94,70,.34)";
    ctx.lineWidth = hazard.active ? 2 : 1; ctx.beginPath(); ctx.arc(0, 0, hazard.r, 0, Math.PI * 2); ctx.stroke();
    if (hazard.active) {
      ctx.fillStyle = "#bd6554";
      for (let i = 0; i < 5; i += 1) {
        const a = i * Math.PI * 2 / 5 + time;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a + .3) * 19, Math.sin(a + .3) * 19); ctx.lineTo(Math.cos(a + .6) * 12, Math.sin(a + .6) * 12); ctx.fill();
      }
    } else {
      ctx.fillStyle = hazard.warning ? "#ce8863" : "#75614c";
      ctx.font = "12px Georgia"; ctx.textAlign = "center"; ctx.fillText("*", 0, 4);
    }
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const isBoss = enemy.type === "boss";
    const scale = isBoss ? 2.35 : enemy.type === "brute" ? 1.2 : 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + Math.sin(time * 3 + enemy.age) * (isBoss ? 1.5 : 2));
    ctx.scale(scale, scale);
    const radius = isBoss ? 18 : enemy.r;
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.beginPath(); ctx.ellipse(1, radius * .69, radius * 1.05, radius * .43, 0, 0, Math.PI * 2); ctx.fill();
    if (enemy.type === "bat") {
      const flap = Math.sin(time * 17 + enemy.age) * 4;
      ctx.fillStyle = enemy.flash > 0 ? "#fff0d4" : "#55445e";
      ctx.beginPath(); ctx.moveTo(-5, -1); ctx.quadraticCurveTo(-17, -15 - flap, -21, -7); ctx.quadraticCurveTo(-18, 5, -4, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5, -1); ctx.quadraticCurveTo(17, -15 - flap, 21, -7); ctx.quadraticCurveTo(18, 5, 4, 6); ctx.fill();
    }
    const shade = enemy.flash > 0 ? "#f6e6c9" : enemy.color;
    const body = ctx.createRadialGradient(-radius * .35, -radius * .4, 2, 0, 0, radius * 1.3);
    body.addColorStop(0, shade);
    body.addColorStop(1, isBoss ? "#382b32" : "#3a3030");
    ctx.fillStyle = body;
    ctx.beginPath();
    if (enemy.type === "turret") {
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
        const r = i % 2 ? radius * 0.76 : radius * 1.08;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    } else if (enemy.type === "brute" || isBoss) {
      ctx.moveTo(-radius * .77, radius * .45);
      ctx.quadraticCurveTo(-radius * 1.2, -radius * .22, -radius * .52, -radius * .73);
      ctx.quadraticCurveTo(0, -radius * 1.06, radius * .54, -radius * .7);
      ctx.quadraticCurveTo(radius * 1.16, -radius * .24, radius * .78, radius * .47);
      ctx.quadraticCurveTo(0, radius * 1.08, -radius * .77, radius * .45);
      ctx.closePath();
    } else {
      ctx.ellipse(0, 0, radius * (enemy.type === "wisp" ? .76 : 1), radius * (enemy.type === "wisp" ? 1.08 : .83), Math.sin(enemy.age) * .08, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = isBoss ? "rgba(237,190,126,.72)" : "rgba(238,201,163,.36)";
    ctx.lineWidth = isBoss ? 1.25 : .8;
    ctx.stroke();

    if (isBoss) {
      ctx.strokeStyle = enemy.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -12); ctx.quadraticCurveTo(-20, -30, -24, -23); ctx.moveTo(12, -12); ctx.quadraticCurveTo(20, -30, 24, -23); ctx.stroke();
      ctx.fillStyle = "rgba(222,189,136,.24)"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    }
    if (enemy.type === "leech" || enemy.type === "grub" || isBoss) {
      ctx.fillStyle = "rgba(35,19,21,.55)";
      ctx.beginPath(); ctx.ellipse(0, radius * .34, radius * .42, radius * .19, 0, 0, Math.PI * 2); ctx.fill();
    }
    const eyeColor = enemy.type === "wisp" ? "#dbd4f2" : enemy.type === "spitter" ? "#d7d78d" : isBoss ? "#ffdc9c" : "#e78a79";
    ctx.fillStyle = "#171413";
    ctx.beginPath(); ctx.arc(-radius * .31, -radius * .1, radius * .13, 0, Math.PI * 2); ctx.arc(radius * .31, -radius * .1, radius * .13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc(-radius * .31, -radius * .11, radius * .07, 0, Math.PI * 2); ctx.arc(radius * .31, -radius * .11, radius * .07, 0, Math.PI * 2); ctx.fill();
    if (enemy.type === "turret") {
      ctx.strokeStyle = "#344341"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(enemy.age * .3) * 17, Math.sin(enemy.age * .3) * 17); ctx.stroke();
    }
    if (enemy.phase === "tell" || enemy.phase === "tell-charge") {
      ctx.strokeStyle = `rgba(235,132,103,${.4 + Math.sin(time * 25) * .18})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(0, 0, radius + 8 + Math.sin(time * 20) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    if (enemy.poison > 0) {
      ctx.fillStyle = "#bad187"; ctx.beginPath(); ctx.arc(0, -radius * .82, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (isBoss) {
      const width = 180;
      const x = WORLD.width / 2 - width / 2;
      const y = WORLD.top + 21;
      ctx.fillStyle = "rgba(10,9,9,.78)"; ctx.fillRect(x, y, width, 12);
      ctx.fillStyle = "#793d41"; ctx.fillRect(x + 2, y + 2, (width - 4) * Math.max(0, enemy.hp / enemy.maxHp), 8);
      ctx.fillStyle = "#d78d78"; ctx.fillRect(x + 2, y + 2, (width - 4) * Math.max(0, enemy.hp / enemy.maxHp), 2);
      ctx.fillStyle = "#e4d2b7"; ctx.font = "9px Arial"; ctx.textAlign = "center"; ctx.fillText(enemy.bossName.toUpperCase(), WORLD.width / 2, y - 5);
    } else if (enemy.flash > 0 || enemy.hp < enemy.maxHp * .65) {
      const width = enemy.r * 2.2;
      ctx.fillStyle = "rgba(8,8,8,.65)"; ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 10, width, 3);
      ctx.fillStyle = "#d18172"; ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 10, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
    }
  }

  function drawProjectile(shot) {
    const glow = ctx.createRadialGradient(shot.x, shot.y, 0.5, shot.x, shot.y, shot.r * 3.6);
    glow.addColorStop(0, shot.color);
    glow.addColorStop(1, `${shot.color}00`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r * 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shot.color;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,246,218,.68)";
    ctx.beginPath(); ctx.arc(shot.x - shot.r * .25, shot.y - shot.r * .25, shot.r * .35, 0, Math.PI * 2); ctx.fill();
  }

  function drawBomb(bomb, time) {
    const blink = bomb.fuse < 0.4 && Math.sin(time * 36) > 0;
    ctx.fillStyle = "rgba(0,0,0,.36)"; ctx.beginPath(); ctx.ellipse(bomb.x, bomb.y + 9, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? "#f0d290" : "#3a3c38"; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#9a9080"; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = "#d3ad67"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bomb.x + 2, bomb.y - 8); ctx.lineTo(bomb.x + 7, bomb.y - 13); ctx.stroke();
    if (bomb.fuse < 0.38) {
      ctx.fillStyle = "#e7a55a"; ctx.beginPath(); ctx.arc(bomb.x + 7, bomb.y - 14, 3 + Math.sin(time * 45), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPilgrim(player, time, preview = false) {
    const bob = Math.sin((player.anim || time * 3) * 2.1) * (player.moved ? 2.4 : 1.2);
    const invuln = !preview && player.invuln > 0 && Math.sin(time * 37) > 0.12;
    const has = (id) => !preview && run && run.items.includes(id);
    const robeColor = !preview && run ? ({ moth: "#424552", bellkeeper: "#565044", ashborn: "#573b38" }[run.character] || "#41403a") : "#41403a";
    if (invuln) ctx.globalAlpha = 0.47;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    if (player.dodgeTime > 0) {
      ctx.globalAlpha *= 0.3;
      ctx.fillStyle = "#e4d1ab"; ctx.beginPath(); ctx.ellipse(-player.dodgeX * 10, -player.dodgeY * 10, 11, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = invuln ? 0.48 : 1;
    }
    if (has("glass-saint")) {
      ctx.strokeStyle = `rgba(244,210,143,${.58 + Math.sin(time * 3) * .14})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(0, -15, 15, 5 + Math.sin(time * 3) * 1.2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#f0cc82"; ctx.beginPath(); ctx.arc(0, -21, 2.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,.48)"; ctx.beginPath(); ctx.ellipse(0, 12, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2d302e";
    ctx.beginPath(); ctx.moveTo(-13, 3); ctx.quadraticCurveTo(-18, 17, -10, 18); ctx.lineTo(11, 18); ctx.quadraticCurveTo(18, 13, 11, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = robeColor;
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.quadraticCurveTo(-17, 8, -13, 17); ctx.quadraticCurveTo(0, 22, 14, 15); ctx.lineTo(9, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(199,174,135,.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#b49b76"; ctx.fillRect(-9, 9, 18, 3);
    ctx.fillStyle = "#c8b89d"; ctx.beginPath(); ctx.ellipse(0, -7, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5a4d41";
    ctx.beginPath(); ctx.moveTo(-14, -9); ctx.quadraticCurveTo(-12, -23, 0, -23); ctx.quadraticCurveTo(13, -23, 15, -8); ctx.lineTo(8, -2); ctx.quadraticCurveTo(0, -8, -9, -1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#a79373"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#201e1b";
    const eyeX = player.aimX || 1;
    const eyeY = player.aimY || 0;
    ctx.beginPath(); ctx.arc(-3 + eyeX * 2, -6 + eyeY * 1.5, 1.35, 0, Math.PI * 2); ctx.arc(4 + eyeX * 2, -6 + eyeY * 1.5, 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,234,196,.32)"; ctx.beginPath(); ctx.arc(-4, -10, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c89451"; ctx.fillRect(10, 1, 4, 9);
    ctx.fillStyle = "#e8c681"; ctx.fillRect(11, -1, 2, 3);
    if (has("saint-heart")) {
      ctx.fillStyle = "#d86e67";
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-6, 5, -3, 1, 0, 4); ctx.bezierCurveTo(4, 1, 6, 6, 0, 9); ctx.fill();
    }
    if (has("twin-candle")) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#d2b584"; ctx.fillRect(side * 12 - 1, 4, 3, 7);
        ctx.fillStyle = "#f0bd68"; ctx.beginPath(); ctx.ellipse(side * 12, 2, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (has("hemlock")) {
      ctx.strokeStyle = "#adc17e"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-3, 2); ctx.lineTo(1, 5); ctx.stroke();
      ctx.fillStyle = "#aabe7c"; ctx.beginPath(); ctx.arc(-4, 4, 1.4, 0, Math.PI * 2); ctx.arc(-1, 5, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawOrbitals(player, time) {
    if (!player.orbitals) return;
    for (let i = 0; i < player.orbitals; i += 1) {
      const angle = time * 1.65 + i * Math.PI * 2 / player.orbitals;
      const x = player.x + Math.cos(angle) * 36;
      const y = player.y + Math.sin(angle) * 36;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, 14);
      glow.addColorStop(0, "rgba(205,180,232,.55)"); glow.addColorStop(1, "rgba(205,180,232,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d7c2e7"; ctx.beginPath(); ctx.ellipse(x, y, 4, 6, angle, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#65546e"; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEffects() {
    if (!run) return;
    for (const effect of run.effects) {
      const alpha = clamp(effect.life / effect.max, 0, 1);
      if (effect.kind === "ring") {
        ctx.globalAlpha = alpha * 0.68;
        ctx.strokeStyle = effect.color; ctx.lineWidth = 3 + alpha * 2;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.color;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.size * alpha, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const item of run.floats) {
      ctx.globalAlpha = clamp(item.life / item.max, 0, 1);
      ctx.fillStyle = item.color;
      ctx.font = `600 ${item.size}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 5;
      ctx.fillText(item.text, item.x, item.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawRoom(time) {
    const node = currentNode();
    const room = node && node.room;
    if (!room) { drawRoomBase(null, time); return; }
    drawRoomBase(room, time);
    for (const hazard of room.hazards) drawHazard(hazard, time);
    for (const obstacle of room.obstacles) drawObstacle(obstacle);
    if (room.chest) drawChest(room, time);
    if (room.type === "shrine") drawShrine(room, time);
    if (room.shop.length) drawShop(room, time);
    drawStairs(room, time);
    for (const pickup of room.pickups) drawPickup(pickup, time);
    for (const bomb of room.bombs) drawBomb(bomb, time);

    const light = ctx.createRadialGradient(run.player.x, run.player.y, 7, run.player.x, run.player.y, 160);
    light.addColorStop(0, "rgba(222,180,111,.055)"); light.addColorStop(1, "rgba(222,180,111,0)");
    ctx.fillStyle = light; ctx.fillRect(WORLD.left, WORLD.top, WORLD.right - WORLD.left, WORLD.bottom - WORLD.top);

    for (const shot of room.shots) drawProjectile(shot);
    for (const shot of room.playerShots) drawProjectile(shot);
    const actors = room.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ type: "enemy", value: enemy, y: enemy.y }));
    actors.push({ type: "player", value: run.player, y: run.player.y });
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.type === "enemy") drawEnemy(actor.value, time);
      else drawPilgrim(actor.value, time);
    }
    drawOrbitals(run.player, time);
    if (run.player.familiar) {
      const x = run.player.x - 24 + Math.sin(time * 2) * 3;
      const y = run.player.y - 22 + Math.cos(time * 2.6) * 4;
      ctx.fillStyle = "#b69bc5"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e1c9e5"; ctx.beginPath(); ctx.arc(x - 1, y - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    drawEffects();

    if (room.slowTimer > 0) {
      ctx.fillStyle = `rgba(143,151,186,${.035 + Math.sin(time * 4) * .012})`;
      ctx.fillRect(WORLD.left, WORLD.top, WORLD.right - WORLD.left, WORLD.bottom - WORLD.top);
    }
    if (run.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(163,42,42,${run.player.hurtFlash * 0.2})`;
      ctx.fillRect(WORLD.left, WORLD.top, WORLD.right - WORLD.left, WORLD.bottom - WORLD.top);
    }
  }

  function drawPreview(time) {
    drawRoomBase(null, time);
    const seed = seededRandom(318);
    for (let i = 0; i < 8; i += 1) {
      const x = 150 + seed() * 650;
      const y = 110 + seed() * 330;
      if (dist(x, y, 480, 280) > 175) drawObstacle({ x, y, r: 12 + seed() * 7, hp: 2, maxHp: 2, kind: i % 3 ? "urn" : "bone" });
    }
    ctx.save();
    ctx.strokeStyle = "rgba(209,177,125,.13)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(480, 275, 78 + Math.sin(time) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(480, 275, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const player = { x: 480, y: 280 + Math.sin(time * 1.5) * 4, r: 15, aimX: Math.cos(time * .3), aimY: Math.sin(time * .3), anim: time, moved: false, invuln: 0, dodgeTime: 0 };
    const ghost = { x: 648 + Math.sin(time * .4) * 22, y: 228 + Math.cos(time * .5) * 18, r: 16, type: "wisp", hp: 35, maxHp: 35, speed: 44, color: "#a895bc", age: time, flash: 0, phase: "idle", damage: 1 };
    drawEnemy(ghost, time);
    drawPilgrim(player, time, true);
    const dust = seededRandom(7622);
    for (let i = 0; i < 16; i += 1) {
      const x = (dust() * WORLD.width + time * (7 + i % 3)) % WORLD.width;
      const y = (dust() * WORLD.height + time * (2 + i % 2)) % WORLD.height;
      ctx.fillStyle = `rgba(237,213,171,${0.06 + Math.sin(time * 2 + i) * .035})`;
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function draw(time) {
    if (disposed) return;
    resizeCanvas();
    ctx.save();
    if (screen !== "title" && shake > 0.2) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    if (run) drawRoom(time);
    else drawPreview(time);
    ctx.restore();
    raf = window.requestAnimationFrame(frame);
  }

  function frame(timestamp) {
    if (disposed) return;
    const dt = lastTime ? Math.min(0.033, Math.max(0, (timestamp - lastTime) / 1000)) : 0;
    lastTime = timestamp;
    if (screen === "playing") updateGame(dt);
    else if (screen === "paused" && modalKind === "pause") readGamepad();
    else if (toastTimer > 0) {
      toastTimer -= dt * 1000;
      if (toastTimer <= 0) toast.classList.remove("show");
    }
    draw(timestamp / 1000);
  }

  function pauseGame() {
    if (screen !== "playing") return;
    screen = "paused";
    modalKind = "pause";
    audio.setMode("paused");
    renderModal();
    updateTitleScreen();
    renderSidebar();
  }

  function resumeGame() {
    if (screen !== "paused") return;
    screen = "playing";
    modalKind = null;
    modal.hidden = true;
    const room = currentNode() && currentNode().room;
    audio.setMode(room && room.type === "boss" && room.enemies.length ? "boss" : room && room.enemies.length ? "combat" : "ambient");
    updateTitleScreen();
  }

  function togglePause() {
    if (screen === "playing") pauseGame();
    else if (screen === "paused" && modalKind === "pause") resumeGame();
  }

  function openHelp() {
    const previous = screen;
    modalReturn = previous;
    if (screen === "playing") {
      screen = "paused";
      audio.setMode("paused");
      updateTitleScreen();
    }
    modalKind = "help";
    helpTab = "basics";
    renderModal();
  }

  function closeModal() {
    if (modalKind === "pause") { resumeGame(); return; }
    if (modalKind === "help") {
      const returnTo = modalReturn;
      modalKind = null;
      modal.hidden = true;
      if (returnTo === "playing") {
        screen = "playing";
        const room = currentNode() && currentNode().room;
        audio.setMode(room && room.type === "boss" && room.enemies.length ? "boss" : room && room.enemies.length ? "combat" : "ambient");
      } else if (returnTo === "paused") {
        screen = "paused";
        modalKind = "pause";
        renderModal();
      } else screen = returnTo;
      updateTitleScreen();
      return;
    }
  }

  function applyDifficulty(next) {
    if (!DIFFICULTIES[next] || next === difficulty) return;
    const old = DIFFICULTIES[difficulty] || DIFFICULTIES.Hollow;
    const current = DIFFICULTIES[next];
    difficulty = next;
    profile.settings.difficulty = next;
    if (run && (screen === "playing" || screen === "paused")) {
      run.difficulty = next;
      const room = currentNode() && currentNode().room;
      if (room) {
        for (const enemy of room.enemies) {
          const ratio = current.hp / old.hp;
          const healthRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
          enemy.maxHp = Math.max(1, enemy.maxHp * ratio);
          enemy.hp = Math.max(1, enemy.maxHp * healthRatio);
          enemy.speed *= current.speed / old.speed;
          enemy.damage = Math.max(1, Math.round(enemy.damage * current.damage / old.damage));
        }
      }
      toastMessage(`DEPTH SET TO ${next.toUpperCase()}`, "The house changes its hand", 1600);
      renderSidebar();
    }
    saveProfile();
    updateHeader();
    if (modalKind === "pause") renderModal();
    else renderSidebar();
  }

  function renderHelpBody() {
    if (helpTab === "basics") {
      return `<div class="help-section"><h3>A room is a small promise</h3><p>Enter a hungry room and its doors seal. Clear every creature to open them. The antechamber is safe, and shops, shrines, and treasure rooms stay quiet.</p><h3>Spend the key. Save the bomb.</h3><p>Gold chests hold a relic and cost one key. Bombs hurt everything nearby and can uncover a secret room when placed against a hidden wall. A new floor grants a key.</p><h3>Six guardians, one way back</h3><p>Find the boss door high on each floor. Read the tell, dodge through danger, then walk to the stair or relic and press E. The House Heart ends the run.</p><h3>Relics remember each other</h3><p>Passive relics change your tears, speed, health, or active power. Some pairs form an unholy sync: Hemlock + Twin Candle spreads poison, for example. The Satchel shows active synergies.</p><h3>Replay the same descent</h3><p>Enter a seed on the chapel screen or copy it from the run map. The maze, room types, enemies, and rewards are generated from that seed.</p><h3>Keep the embers</h3><p>Every run pays out embers for rooms cleared, bosses defeated, and how far you descend. Bind permanent seals in the Reliquary or wake another pilgrim.</p><div class="end-banner">The first few seconds are safe. Walk through a door, hold the mouse button, and learn how the room moves.</div></div>`;
    }
    if (helpTab === "controls") {
      return `<div class="help-section"><table class="control-table"><tbody><tr><td>W A S D</td><td>Move through the room</td></tr><tr><td>Mouse / click + hold</td><td>Aim and fire tears continuously</td></tr><tr><td>Arrow keys</td><td>Aim and fire in a direction</td></tr><tr><td>Shift</td><td>Dodge with a short invulnerable roll</td></tr><tr><td>F</td><td>Place a bomb at your aim</td></tr><tr><td>Q</td><td>Use the active relic</td></tr><tr><td>E</td><td>Open chest, buy, bargain, or descend</td></tr><tr><td>Esc / P</td><td>Pause and open settings</td></tr><tr><td>Controller</td><td>Left stick move, right stick aim, RT fire, A dodge, B bomb, X relic, Start pause</td></tr><tr><td>Touch</td><td>Use the on-screen pad and action buttons</td></tr></tbody></table><p>Mouse aiming follows the cursor relative to your pilgrim, not the center of the screen. Releasing the mouse stops fire.</p></div>`;
    }
      return `<div class="help-section"><h3>Depth changes the house</h3><p><strong>Pilgrim</strong> softens enemy bodies, pace, and damage. <strong>Hollow</strong> is the intended balance. <strong>Torment</strong> adds enemies and makes attacks hit harder. Difficulty can be changed from the pause menu during a run.</p><h3>Enemies have tells</h3><p>Spitters stop to aim. Brutes flash before a charge. Bats sweep and circle. Turrets rake the room. Wisps bend around your path. Eight guardians are possible; the same seed always ends at the House Heart.</p><h3>Damage, hearts, and room wards</h3><p>One heart in the HUD equals two health pips. Red hearts restore two pips. The Circle of Salt absorbs your first hit in each new room. A dodge is brief and returns quickly.</p><h3>Audio</h3><p>Music and all effects are synthesized locally. Use the music-note button to mute, or change the master level in Pause / Settings.</p><h3>End of the line</h3><p>A run ends at zero health or after the sixth guardian falls. Your score, kills, rooms, secrets, time, and ember payout are saved to this browser.</p></div>`;
  }

  function renderModal() {
    modal.hidden = false;
    if (modalKind === "pause") {
      modal.innerHTML = `<div class="modal-box"><div class="modal-header"><div><div class="section-kicker">The world holds still</div><h2 id="modal-title">Pause / settings</h2></div><button class="modal-close" data-action="resume" aria-label="Resume">&#215;</button></div><div class="modal-body">
        <div class="settings-row"><div>Master volume<small>Music and synthesized effects</small></div><input type="range" min="0" max="1" step="0.01" value="${audio.volume}" data-setting="volume" aria-label="Master volume"></div>
        <div class="settings-row"><div>Audio<small>${audio.muted ? "Muted" : "Sound is on"}</small></div><button class="secondary-button" data-action="audio">${audio.muted ? "Turn on" : "Mute"}</button></div>
        <div class="settings-row"><div>Depth setting<small>Applies to living enemies now</small></div><select data-setting="difficulty" aria-label="Difficulty">${Object.keys(DIFFICULTIES).map((name) => `<option ${difficulty === name ? "selected" : ""}>${name}</option>`).join("")}</select></div>
        <div class="modal-actions"><button class="primary-button" data-action="resume">Return to room</button></div>
        <div class="modal-actions"><button class="secondary-button" data-action="restart">Restart descent</button><button class="secondary-button" data-action="abandon">Abandon run</button></div>
        <p>Changing depth rescales the enemies still alive and all rooms ahead. Your score and current inventory stay with you.</p>
      </div></div>`;
    } else if (modalKind === "help") {
      modal.innerHTML = `<div class="modal-box"><div class="modal-header"><div><div class="section-kicker">VESPER / FIELD MANUAL</div><h2 id="modal-title">Field notes</h2></div><button class="modal-close" data-action="close-modal" aria-label="Close field notes">&#215;</button></div><div class="modal-body"><div class="help-tabs">${[["basics", "Descent"], ["controls", "Controls"], ["depth", "Systems"]].map(([id, name]) => `<button class="help-tab ${helpTab === id ? "active" : ""}" data-help-tab="${id}">${name}</button>`).join("")}</div>${renderHelpBody()}<div class="modal-actions"><button class="secondary-button" data-action="close-modal">Back</button>${screen === "title" ? `<button class="primary-button" data-action="start">Begin the descent</button>` : ""}</div></div></div>`;
    } else if (modalKind === "end") {
      const won = run && run.won;
      const heading = won ? "The house goes quiet" : "The lamp has gone out";
      const detail = won ? "You walked out through the sixth floor. The chapel door closes behind you." : "The house has kept another name. The embers are still yours.";
      const earned = run ? run.emberAward || 0 : 0;
      const score = run ? run.score + run.kills * 30 + run.roomsCleared * 20 : 0;
      modal.innerHTML = `<div class="modal-box"><div class="modal-header"><div><div class="section-kicker">${won ? "A LIFE RETURNED" : "A LIFE REMEMBERED"}</div><h2 id="modal-title">${heading}</h2></div><span class="ember-counter">&#9670; +${earned}</span></div><div class="modal-body"><div class="end-banner ${won ? "" : "lost"}">${detail}</div><div class="stats-grid"><div class="end-stat"><strong>${score.toLocaleString()}</strong><span>Score</span></div><div class="end-stat"><strong>${run ? run.kills : 0}</strong><span>Enemies</span></div><div class="end-stat"><strong>${run ? run.roomsCleared : 0}</strong><span>Rooms cleared</span></div><div class="end-stat"><strong>${run ? `${run.floor} / ${FLOORS.length}` : "--"}</strong><span>Deepest floor</span></div><div class="end-stat"><strong>${run ? run.secrets : 0}</strong><span>Secrets found</span></div><div class="end-stat"><strong>${run ? formatTime(run.elapsed) : "00:00"}</strong><span>Time below</span></div></div><p>Run ${esc(run.seed)} / ${esc(CHARACTERS[run.character].name)} / ${esc(run.difficulty)}. ${earned} ember${earned === 1 ? "" : "s"} added to the Reliquary.</p><div class="modal-actions"><button class="primary-button" data-action="retry">${won ? "Descend again" : "Try again"}</button><button class="secondary-button" data-action="title">Return to chapel</button></div></div></div>`;
    }
    const focus = modal.querySelector("button, input, select");
    if (focus && modalKind !== "pause") focus.focus({ preventScroll: true });
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(value / 60).toString().padStart(2, "0");
    const remainder = (value % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  }

  function endRun(won) {
    if (!run || run.finished) return;
    run.finished = true;
    run.won = won;
    run.score += run.kills * 30 + run.roomsCleared * 20 + Math.max(0, Math.floor(run.elapsed / 20));
    run.emberAward = Math.max(1, Math.floor(run.roomsCleared * 0.7 + run.floor * 1.5 + run.bosses * 2 + (won ? 9 : 0)));
    profile.embers += run.emberAward;
    profile.totalKills += run.kills;
    profile.bestFloor = Math.max(profile.bestFloor, run.floor);
    profile.bestScore = Math.max(profile.bestScore, run.score);
    if (won) profile.victories += 1;
    saveProfile();
    screen = "ended";
    modalKind = "end";
    modal.hidden = false;
    audio.setMode("ambient");
    updateTitleScreen();
    renderSidebar();
    renderModal();
    updateHeader();
    announce(won ? "Victory. The house goes quiet." : "Game over. The lamp has gone out.");
  }

  function announce(message) {
    const announcer = root.querySelector("#sr-announcer");
    announcer.textContent = "";
    window.setTimeout(() => { if (!disposed) announcer.textContent = message; }, 20);
  }

  function buyUpgrade(id) {
    const upgrade = UPGRADES[id];
    if (!upgrade) return;
    const level = Number(profile.upgrades[id]) || 0;
    const cost = upgrade.costs[level];
    if (cost === undefined || profile.embers < cost) return;
    profile.embers -= cost;
    profile.upgrades[id] = level + 1;
    saveProfile();
    renderSidebar();
    updateHeader();
    audio.unlock(); audio.sfx("relic");
    toastMessage("A SEAL IS BOUND", upgrade.name, 1500);
  }

  function unlockCharacter(id) {
    const character = CHARACTERS[id];
    if (!character || profile.unlocked.includes(id) || profile.embers < character.cost) return;
    profile.embers -= character.cost;
    profile.unlocked.push(id);
    selectedCharacter = id;
    saveProfile();
    titleTab = "dive";
    renderSidebar();
    updateHeader();
    audio.unlock(); audio.sfx("relic");
    toastMessage(`${character.name.toUpperCase()} AWAKES`, "A new life for the next descent", 1700);
  }

  function goToTitle() {
    screen = "title";
    modalKind = null;
    modal.hidden = true;
    run = null;
    pointerDown = false;
    touchFiring = false;
    autoAim = false;
    Object.keys(keys).forEach((key) => delete keys[key]);
    Object.keys(touchKeys).forEach((key) => delete touchKeys[key]);
    audio.setMode("menu");
    updateTitleScreen();
    updateSceneLabels();
    renderSidebar();
    updateHeader();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement("textarea");
        field.value = text;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      toastMessage("SEED COPIED", text, 1300);
    } catch (_) {
      toastMessage("YOUR RUN SEED", text, 1600);
    }
  }

  function handleAction(action, target) {
    if (action === "start" || action === "retry") startRun();
    else if (action === "help") openHelp();
    else if (action === "pause") togglePause();
    else if (action === "resume") resumeGame();
    else if (action === "close-modal") closeModal();
    else if (action === "audio") {
      audio.unlock(); audio.toggleMute();
      profile.settings.muted = audio.muted;
      profile.settings.volume = audio.volume;
      saveProfile(); updateHeader();
      if (modalKind === "pause") renderModal();
    } else if (action === "restart") startRun();
    else if (action === "abandon" || action === "title") goToTitle();
    else if (action === "seed-random") { selectedSeed = randomSeedCode(); renderSidebar(); }
    else if (action === "seed-copy") {
      const field = root.querySelector("#seed-entry");
      selectedSeed = (field ? field.value.trim().replace(/[^a-z0-9-]/gi, "") : selectedSeed) || randomSeedCode();
      renderSidebar();
      copyText(selectedSeed);
    } else if (action === "copy-run-seed" && run) copyText(run.seed);
  }

  function onClick(event) {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleAction(actionButton.dataset.action, actionButton);
      return;
    }
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      if (screen === "title") titleTab = tab.dataset.tab;
      else runTab = tab.dataset.tab;
      renderSidebar();
      return;
    }
    const difficultyButton = event.target.closest("[data-difficulty]");
    if (difficultyButton) {
      applyDifficulty(difficultyButton.dataset.difficulty);
      renderSidebar();
      return;
    }
    const characterButton = event.target.closest("[data-character]");
    if (characterButton) {
      const id = characterButton.dataset.character;
      if (profile.unlocked.includes(id)) {
        selectedCharacter = id;
        renderSidebar();
      } else {
        titleTab = "reliquary";
        renderSidebar();
      }
      return;
    }
    const buyButton = event.target.closest("[data-buy]");
    if (buyButton) { buyUpgrade(buyButton.dataset.buy); return; }
    const unlockButton = event.target.closest("[data-unlock]");
    if (unlockButton) { unlockCharacter(unlockButton.dataset.unlock); return; }
    const helpButton = event.target.closest("[data-help-tab]");
    if (helpButton) { helpTab = helpButton.dataset.helpTab; renderModal(); return; }
  }

  function onInput(event) {
    const seedField = event.target.closest("[data-seed-entry]");
    if (seedField) {
      selectedSeed = seedField.value.replace(/[^a-z0-9-]/gi, "").slice(0, 16);
      return;
    }
    const input = event.target.closest("[data-setting]");
    if (!input) return;
    if (input.dataset.setting === "volume") {
      audio.setVolume(input.value);
      profile.settings.volume = audio.volume;
      saveProfile();
    }
  }

  function onChange(event) {
    const input = event.target.closest("[data-setting]");
    if (input && input.dataset.setting === "difficulty") applyDifficulty(input.value);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    if (key === "escape") {
      if (modalKind === "help") closeModal();
      else if (modalKind === "pause") resumeGame();
      else if (screen === "playing") pauseGame();
      return;
    }
    if (modalKind) {
      if (key === "enter" && modalKind === "end") startRun();
      return;
    }
    if (key === "enter" && screen === "title") { startRun(); return; }
    if (key === "h" && screen !== "ended") { openHelp(); return; }
    if (key === "p") { togglePause(); return; }
    if (screen !== "playing") return;
    keys[key] = true;
    if (!event.repeat) {
      if (key === "shift") beginDodge();
      else if (key === "f") placeBomb();
      else if (key === "q") useActive();
      else if (key === "e") interact();
    }
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    keys[key] = false;
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = (event.clientX - rect.left) / rect.width * WORLD.width;
    pointer.y = (event.clientY - rect.top) / rect.height * WORLD.height;
    pointer.inside = pointer.x >= 0 && pointer.x <= WORLD.width && pointer.y >= 0 && pointer.y <= WORLD.height;
  }

  function onPointerDown(event) {
    const control = event.target.closest("[data-touch]");
    if (control) {
      const value = control.dataset.touch;
      const mapping = { up: "w", down: "s", left: "a", right: "d" };
      if (mapping[value]) touchKeys[mapping[value]] = true;
      else if (value === "fire") { touchFiring = true; autoAim = true; }
      if (value === "bomb") placeBomb();
      if (value === "dodge") beginDodge();
      if (value === "active") useActive();
      if (value === "interact") interact();
      event.preventDefault();
      try { control.setPointerCapture(event.pointerId); } catch (_) { /* Pointer capture may not exist in an embedded webview. */ }
      return;
    }
    if (event.target !== canvas) return;
    audio.unlock();
    pointerPosition(event);
    if (event.button === 0 && screen === "playing") {
      pointerDown = true;
      autoAim = false;
      event.preventDefault();
    }
  }

  function releasePointer() {
    pointerDown = false;
    touchFiring = false;
    autoAim = false;
    Object.keys(touchKeys).forEach((key) => { touchKeys[key] = false; });
  }

  function onPointerMove(event) {
    if (event.target === canvas || canvas.contains(event.target)) pointerPosition(event);
  }

  function onPointerLeave() {
    pointer.inside = false;
  }

  function onVisibilityChange() {
    if (document.hidden && screen === "playing") pauseGame();
  }

  function onWindowBlur() {
    releasePointer();
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    if (screen === "playing") pauseGame();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", releasePointer);
  window.addEventListener("pointercancel", releasePointer);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", resizeCanvas);

  updateHeader();
  updateTitleScreen();
  updateSceneLabels();
  renderSidebar();
  resizeCanvas();
  raf = window.requestAnimationFrame(frame);

  return () => {
    disposed = true;
    if (raf) window.cancelAnimationFrame(raf);
    if (toastTimer) window.clearTimeout(toastTimer);
    root.removeEventListener("click", onClick);
    root.removeEventListener("input", onInput);
    root.removeEventListener("change", onChange);
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", releasePointer);
    window.removeEventListener("pointercancel", releasePointer);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", resizeCanvas);
    audio.destroy();
    root.innerHTML = "";
  };
}

export { mountGame };