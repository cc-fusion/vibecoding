const SAVE_KEY = "civilization-micro-save-v1";
const META_KEY = "civilization-micro-legacy-v1";
const MAP_RADIUS = 6;
const PI2 = Math.PI * 2;

const CIVILIZATIONS = [
  { id: "aurelia", name: "Aurelia Concord", leader: "First Consul Ione", sigil: "A", color: "#d8b96e", motto: "Build what outlasts you.", ability: "Civic architects", description: "Cities produce 15% more. Wonders produce 10% more." },
  { id: "veyra", name: "Veyran Institute", leader: "Rector Sol", sigil: "V", color: "#83add0", motto: "Every horizon has an answer.", ability: "Open inquiry", description: "All science yields are increased by 20%." },
  { id: "nacre", name: "Nacre League", leader: "Speaker Mirelle", sigil: "N", color: "#77bba5", motto: "Many voices, one tide.", ability: "Living culture", description: "Culture yields are increased by 25%; policies cost 20% less." },
  { id: "kharos", name: "Kharos Dominion", leader: "Marshal Oryn", sigil: "K", color: "#d98170", motto: "The frontier remembers strength.", ability: "Iron resolve", description: "Military units fight 15% harder and heal faster." },
];

const DIFFICULTIES = [
  { id: "settler", name: "Settler", note: "A generous first voyage", aiYield: 0.76, aiStrength: -3, barbRate: 0.72, playerYield: 1.1 },
  { id: "regent", name: "Regent", note: "A balanced contest", aiYield: 1, aiStrength: 0, barbRate: 1, playerYield: 1 },
  { id: "warlord", name: "Warlord", note: "The world will not wait", aiYield: 1.2, aiStrength: 4, barbRate: 1.35, playerYield: 0.94 },
];

const TECHS = [
  { id: "pottery", name: "Pottery", cost: 16, era: 1, desc: "Granaries and farms; food is the first promise.", unlock: "Farm improvements, Granary" },
  { id: "animal", name: "Animal Husbandry", cost: 18, era: 1, desc: "Harness the strength of the open plain.", unlock: "Horsemen, visible herds" },
  { id: "mining", name: "Mining", cost: 18, era: 1, desc: "Find value in the bones of the earth.", unlock: "Mine improvements, Iron" },
  { id: "writing", name: "Writing", cost: 20, era: 1, desc: "The first ideas travel farther than their authors.", unlock: "Libraries, Great Scientists" },
  { id: "archery", name: "Archery", cost: 22, era: 1, desc: "A trained archer can hold a much wider frontier.", unlock: "Archer units" },
  { id: "bronze", name: "Bronze Working", cost: 24, era: 1, desc: "Turn ore into dependable tools and arms.", unlock: "Swordsmen, reveal nearby iron" },
  { id: "masonry", name: "Masonry", cost: 22, era: 1, desc: "Raise walls that make a city worth defending.", unlock: "City walls" },
  { id: "wheel", name: "The Wheel", cost: 20, era: 1, desc: "Roads shorten distances and lengthen markets.", unlock: "Road improvements" },
  { id: "sailing", name: "Coastal Sailing", cost: 19, era: 1, desc: "The coast joins the map; water carries more than weather.", unlock: "+1 trade-route capacity" },
  { id: "currency", name: "Currency", cost: 30, era: 2, desc: "A common measure lets distant cities prosper together.", unlock: "Markets, trade pacts" },
  { id: "iron", name: "Iron Working", cost: 32, era: 2, prereq: ["bronze", "mining"], desc: "Iron weapons change the balance of the field.", unlock: "Swordsmen, iron mines" },
  { id: "mathematics", name: "Mathematics", cost: 32, era: 2, prereq: ["writing", "wheel"], desc: "Measure the world, then build beyond it.", unlock: "Catapults, Great Library" },
  { id: "literature", name: "Literature", cost: 31, era: 2, prereq: ["writing"], desc: "Stories, histories, and arguments bind a people across generations.", unlock: "+1 culture in every city" },
  { id: "construction", name: "Construction", cost: 33, era: 2, prereq: ["masonry"], desc: "Sturdy works make crowded cities possible.", unlock: "Aqueducts, stronger walls" },
  { id: "philosophy", name: "Philosophy", cost: 34, era: 2, prereq: ["writing"], desc: "A shared language for the life worth living.", unlock: "Theatres, policy traditions" },
  { id: "democracy", name: "Civic Assembly", cost: 37, era: 2, prereq: ["philosophy"], desc: "The people become more than a population to be counted.", unlock: "Civic policies arrive sooner" },
  { id: "engineering", name: "Engineering", cost: 36, era: 2, prereq: ["mathematics", "construction"], desc: "Great works join cities to their hinterlands.", unlock: "Aqueducts, stronger roads" },
  { id: "feudal", name: "Feudalism", cost: 44, era: 3, prereq: ["currency", "iron"], desc: "Land, service, and loyalty form new obligations.", unlock: "Veteran cavalry, alliances" },
  { id: "banking", name: "Banking", cost: 44, era: 3, prereq: ["currency"], desc: "Credit makes patient ambition possible.", unlock: "Mints, richer trade routes" },
  { id: "education", name: "Education", cost: 46, era: 3, prereq: ["philosophy", "mathematics"], desc: "Learning becomes an institution rather than an accident.", unlock: "Academies, +10% science" },
  { id: "medicine", name: "Medicine", cost: 43, era: 3, prereq: ["education"], desc: "Knowledge of the body gives citizens more years to build.", unlock: "Faster growth and city recovery" },
  { id: "gunpowder", name: "Gunpowder", cost: 50, era: 3, prereq: ["iron", "engineering"], desc: "The old walls no longer decide every battle.", unlock: "Musketeers" },
  { id: "printing", name: "The Printing Press", cost: 50, era: 3, prereq: ["education"], desc: "Ideas move faster than armies.", unlock: "Great Writers, +culture" },
  { id: "navigation", name: "Navigation", cost: 50, era: 3, prereq: ["banking", "engineering"], desc: "Coasts become roads and strangers become neighbors.", unlock: "Harbors, +trade routes" },
  { id: "steam", name: "Steam Power", cost: 62, era: 4, prereq: ["gunpowder", "banking"], desc: "A new engine multiplies the reach of human hands.", unlock: "Factories, +production" },
  { id: "electricity", name: "Electricity", cost: 66, era: 4, prereq: ["steam", "education"], desc: "Light and signal bind the farthest corners.", unlock: "Research laboratories" },
  { id: "industry", name: "Industrial Theory", cost: 68, era: 4, prereq: ["steam", "printing"], desc: "A thousand careful works become one great machine.", unlock: "Factories, +production" },
  { id: "combustion", name: "Combustion", cost: 66, era: 4, prereq: ["industry"], desc: "A controlled fire frees industry from the pace of the wheel.", unlock: "Armored Columns" },
  { id: "radio", name: "Radio", cost: 64, era: 4, prereq: ["electricity"], desc: "A voice can reach every city without a road between them.", unlock: "+1 culture in every city" },
  { id: "flight", name: "Flight", cost: 70, era: 4, prereq: ["electricity"], desc: "A horizon is no longer a boundary.", unlock: "Aircraft, rapid movement" },
  { id: "computing", name: "Computing", cost: 75, era: 4, prereq: ["electricity", "industry"], desc: "Knowledge can now organize itself.", unlock: "Global network, +science" },
  { id: "spaceflight", name: "Orbital Sciences", cost: 78, era: 4, prereq: ["computing"], desc: "The world becomes an observatory looking back at itself.", unlock: "+2 science in every city" },
  { id: "fusion", name: "The Unified Field", cost: 85, era: 4, prereq: ["computing", "flight"], desc: "A final theory changes what civilization can become.", unlock: "Scientific victory" },
];

const POLICIES = [
  { id: "scholarship", name: "Public Scholarship", glyph: "I", desc: "All cities generate 15% more science." },
  { id: "agrarian", name: "Common Granaries", glyph: "~", desc: "Cities gain +1 food; growth thresholds are reduced." },
  { id: "industry", name: "Civic Works", glyph: "II", desc: "All cities generate 15% more production." },
  { id: "commerce", name: "Open Markets", glyph: "S", desc: "Gain +3 gold each turn and trade routes pay more." },
  { id: "legions", name: "Frontier Legions", glyph: "X", desc: "Military units gain +3 strength and heal faster." },
  { id: "aesthetics", name: "The Living Archive", glyph: "*", desc: "All cities generate 20% more culture." },
];

const BUILD_OPTIONS = [
  { id: "settler", name: "Settler", kind: "unit", cost: 48, glyph: "S", desc: "Found a new city on open land.", unit: "settler" },
  { id: "builder", name: "Builder", kind: "unit", cost: 34, glyph: "B", desc: "Improve three tiles to shape local yields.", unit: "builder" },
  { id: "warrior", name: "Warrior", kind: "unit", cost: 39, glyph: "W", desc: "Reliable melee infantry for defense and conquest.", unit: "warrior" },
  { id: "archer", name: "Archer", kind: "unit", cost: 52, glyph: "A", req: "archery", desc: "A ranged defender that can strike from two tiles.", unit: "archer" },
  { id: "horseman", name: "Horseman", kind: "unit", cost: 62, glyph: "H", req: "animal", desc: "Fast cavalry with two movement points.", unit: "horseman" },
  { id: "swordsman", name: "Swordsman", kind: "unit", cost: 69, glyph: "X", req: "iron", desc: "Hard-hitting infantry. Iron nearby improves strength.", unit: "swordsman" },
  { id: "catapult", name: "Catapult", kind: "unit", cost: 82, glyph: "C", req: "mathematics", desc: "Siege engine with a three-tile attack range.", unit: "catapult" },
  { id: "musketeer", name: "Musketeer", kind: "unit", cost: 91, glyph: "M", req: "gunpowder", desc: "Disciplined ranged infantry of the next age.", unit: "musketeer" },
  { id: "tank", name: "Armored Column", kind: "unit", cost: 115, glyph: "T", req: "combustion", desc: "A fast, powerful late-era land unit.", unit: "tank" },
  { id: "monument", name: "Monument", kind: "building", cost: 30, glyph: "|", desc: "+2 culture each turn in this city.", effect: { culture: 2 } },
  { id: "granary", name: "Granary", kind: "building", cost: 30, req: "pottery", glyph: "G", desc: "+2 food and faster city growth.", effect: { food: 2 } },
  { id: "library", name: "Library", kind: "building", cost: 43, req: "writing", glyph: "L", desc: "+3 science each turn in this city.", effect: { science: 3 } },
  { id: "market", name: "Market", kind: "building", cost: 43, req: "currency", glyph: "$", desc: "+4 gold each turn and one trade-route capacity.", effect: { gold: 4 } },
  { id: "barracks", name: "Barracks", kind: "building", cost: 36, glyph: "B", desc: "+15% military production in this city.", effect: { barracks: 1 } },
  { id: "walls", name: "City Walls", kind: "building", cost: 40, req: "masonry", glyph: "#", desc: "+45 maximum city health and a stronger city strike.", effect: { walls: 1 } },
  { id: "theatre", name: "Theatre", kind: "building", cost: 60, req: "philosophy", glyph: "T", desc: "+5 culture each turn in this city.", effect: { culture: 5 } },
  { id: "mint", name: "Mint", kind: "building", cost: 66, req: "banking", glyph: "M", desc: "+6 gold each turn in this city.", effect: { gold: 6 } },
  { id: "academy", name: "Academy", kind: "building", cost: 72, req: "education", glyph: "A", desc: "+6 science each turn in this city.", effect: { science: 6 } },
  { id: "great-library", name: "Great Library", kind: "wonder", cost: 94, req: "mathematics", glyph: "W", desc: "+7 science and +3 culture. Only one can stand.", effect: { science: 7, culture: 3 } },
  { id: "colossus", name: "Colossus", kind: "wonder", cost: 98, req: "currency", glyph: "C", desc: "+8 gold and +4 culture. Only one can stand.", effect: { gold: 8, culture: 4 } },
];

const IMPROVEMENTS = {
  farm: { name: "Farm", glyph: "F", food: 2, desc: "+2 food" },
  mine: { name: "Mine", glyph: "M", production: 2, desc: "+2 production" },
  trade: { name: "Trading Post", glyph: "T", trade: 2, desc: "+2 trade" },
  road: { name: "Road", glyph: "R", trade: 1, desc: "+1 trade; faster frontier movement" },
};

const TERRAIN = {
  grass: { name: "Meadow", color: "#526f61", yields: { food: 2, production: 1, trade: 0 } },
  plains: { name: "Open plain", color: "#77826a", yields: { food: 1, production: 2, trade: 0 } },
  forest: { name: "Old forest", color: "#375a51", yields: { food: 1, production: 2, trade: 0 } },
  hills: { name: "Highland", color: "#747967", yields: { food: 0, production: 3, trade: 0 } },
  desert: { name: "Drylands", color: "#987b58", yields: { food: 0, production: 1, trade: 1 } },
  water: { name: "Coast", color: "#275466", yields: { food: 1, production: 0, trade: 2 } },
  mountain: { name: "High mountain", color: "#686f6b", yields: { food: 0, production: 0, trade: 0 } },
};

const UNIT_DEFS = {
  settler: { name: "Settler", glyph: "S", strength: 0, health: 70, moves: 1, range: 0, desc: "A patient beginning. Found a city on any open plain." },
  builder: { name: "Builder", glyph: "B", strength: 0, health: 80, moves: 1, range: 0, desc: "Three improvements can change a city's fortunes." },
  scout: { name: "Pathfinder", glyph: "P", strength: 11, health: 78, moves: 2, range: 1, desc: "Fast, observant, and at home beyond the roads." },
  warrior: { name: "Warrior", glyph: "W", strength: 20, health: 100, moves: 1, range: 1, desc: "A dependable close-combat defender." },
  archer: { name: "Archer", glyph: "A", strength: 17, health: 80, moves: 1, range: 2, ranged: true, desc: "Attacks from up to two hexes away." },
  horseman: { name: "Horseman", glyph: "H", strength: 25, health: 105, moves: 2, range: 1, desc: "A quick flank unit with two movement points." },
  swordsman: { name: "Swordsman", glyph: "X", strength: 32, health: 115, moves: 1, range: 1, desc: "Powerful infantry; nearby iron adds strength." },
  catapult: { name: "Catapult", glyph: "C", strength: 29, health: 76, moves: 1, range: 3, ranged: true, desc: "Siege fire reaches three hexes; weak in melee." },
  musketeer: { name: "Musketeer", glyph: "M", strength: 35, health: 112, moves: 1, range: 2, ranged: true, desc: "A modern line soldier with an accurate volley." },
  tank: { name: "Armored Column", glyph: "T", strength: 47, health: 145, moves: 2, range: 1, desc: "Fast, armored, and devastating at close range." },
  barbarian: { name: "Raider", glyph: "!", strength: 17, health: 83, moves: 1, range: 1, desc: "An unaligned raider drawn to the glow of cities." },
  warlord: { name: "Ashen Warlord", glyph: "!", strength: 35, health: 210, moves: 2, range: 1, desc: "A notorious champion leading the frontier clans." },
};

const UPGRADE_DEFS = [
  { id: "archive", name: "Founders' Archive", glyph: "I", desc: "Begin each campaign with +2 science per turn for each level.", effect: "+2 science / turn", costs: [2, 3, 5] },
  { id: "caravans", name: "Caravan Charter", glyph: "S", desc: "Begin with +35 treasury for each level.", effect: "+35 starting gold", costs: [2, 3, 5] },
  { id: "standard", name: "Veteran Standard", glyph: "X", desc: "All field units gain +2 strength for each level.", effect: "+2 unit strength", costs: [3, 4, 6] },
  { id: "surveyors", name: "Royal Surveyors", glyph: "O", desc: "Your frontier sight extends by one tile per level.", effect: "+1 vision radius", costs: [2, 4, 6] },
];

const TUTORIAL_STEPS = [
  { title: "01 / Claim a capital", text: "Your Settler is selected. Found a city from the action bar, or press F, on this open tile." },
  { title: "02 / Choose an ambition", text: "Open Research and choose a technology. Each turn's science will move that discovery forward." },
  { title: "03 / Explore the frontier", text: "Select your Warrior or Pathfinder and click a neighboring hex. Roads, hills, and rivers shape your route." },
  { title: "04 / Let the world turn", text: "End the turn to grow cities, produce goods, and give every rival a chance to act." },
];

const CITY_NAMES = {
  aurelia: ["Aurelion", "Sunward", "New Aster", "Bellwater", "Crownfield"],
  veyra: ["Veyra", "Northglass", "Axiom", "Lumen Vale", "The Archive"],
  nacre: ["Nacre", "Tidemark", "Pearl Reach", "Bluehaven", "The Sound"],
  kharos: ["Kharos", "Redoubt", "Ash Gate", "Stonewake", "Ironwatch"],
};

const randBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const tileKey = (q, r) => `${q},${r}`;
const hexDistance = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function safeLoad(key, fallback) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  return true;
}

function civById(id) {
  return CIVILIZATIONS.find((civ) => civ.id === id) || CIVILIZATIONS[0];
}

function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) || DIFFICULTIES[1];
}

export function mountGame(host) {
  let root = null;
  try {
    const savedMeta = safeLoad(META_KEY, {});
    const meta = {
      legacy: Math.max(0, Number(savedMeta.legacy) || 0),
      upgrades: Object.assign({ archive: 0, caravans: 0, standard: 0, surveyors: 0 }, savedMeta.upgrades || {}),
      records: Object.assign({ games: 0, victories: 0, bestScore: 0, bestTurn: 0, lastCiv: "aurelia" }, savedMeta.records || {}),
    };

    let state = null;
    let lookup = Object.create(null);
    let currentScreen = "title";
    let selectedCiv = "aurelia";
    let selectedDifficulty = "regent";
    let guidedStart = true;
    let activeModal = null;
    let activeModalData = null;
    let isPaused = false;
    let time = 0;
    let previousFrame = 0;
    let animationId = 0;
    let resizeObserver = null;
    let titleResizeObserver = null;
    let recentEvents = [];
    let floatingTexts = [];
    let particles = [];
    let camera = { x: 0, y: 0, zoom: 1, dragging: false, pointerId: null, downX: 0, downY: 0, moved: false, lastX: 0, lastY: 0 };
    let mapMetrics = { width: 0, height: 0, radius: 25, centerX: 0, centerY: 0, dpr: 1 };
    let lastTitleCanvas = 0;
    let toastTimer = null;
    let transitionTimer = null;
    let resizeFrameId = 0;
    let endTurnBusy = false;
    let tutorialProgression = 0;
    let lastSaveAt = 0;

    class SynthAudio {
      constructor() {
        this.context = null;
        this.master = null;
        this.musicGain = null;
        this.muted = false;
        this.volume = 0.46;
        this.musicTimer = null;
        this.noteIndex = 0;
        this.oscillators = [];
      }
      unlock() {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.musicGain = this.context.createGain();
          this.master.gain.value = this.muted ? 0 : this.volume;
          this.musicGain.gain.value = 0.14;
          this.musicGain.connect(this.master);
          this.master.connect(this.context.destination);
          this.startAmbience();
        }
        if (this.context.state === "suspended") this.context.resume().catch(() => {});
      }
      startAmbience() {
        if (!this.context || this.musicTimer) return;
        const pads = [110, 146.83, 164.81];
        pads.forEach((frequency, index) => {
          const osc = this.context.createOscillator();
          const gain = this.context.createGain();
          osc.type = index === 0 ? "triangle" : "sine";
          osc.frequency.value = frequency;
          gain.gain.value = index === 0 ? 0.08 : 0.035;
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start();
          this.oscillators.push({ osc, gain });
        });
        const notes = [220, 261.63, 329.63, 293.66, 196, 246.94, 293.66, 369.99];
        this.musicTimer = window.setInterval(() => {
          if (!this.context || this.context.state !== "running") return;
          const now = this.context.currentTime;
          const frequency = notes[this.noteIndex % notes.length];
          const intensity = state && state.turn >= 20 ? 1.35 : 1;
          const osc = this.context.createOscillator();
          const gain = this.context.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(frequency, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.055 * intensity, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start(now);
          osc.stop(now + 1.3);
          this.noteIndex += 1;
        }, 1180);
      }
      setMuted(value) {
        this.muted = Boolean(value);
        if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
      }
      setVolume(value) {
        this.volume = clamp(Number(value) || 0, 0, 1);
        if (this.master && this.context && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.04);
      }
      sound(type = "select") {
        if (!this.context || !this.master || this.muted || this.context.state !== "running") return;
        const now = this.context.currentTime;
        const settings = {
          select: [520, 0.05, "sine"], click: [390, 0.055, "triangle"], found: [294, 0.28, "triangle"], research: [660, 0.28, "sine"],
          move: [245, 0.09, "triangle"], attack: [115, 0.2, "sawtooth"], hit: [165, 0.15, "square"], turn: [220, 0.3, "sine"],
          victory: [523, 0.8, "triangle"], defeat: [130, 0.7, "sawtooth"], coin: [780, 0.16, "sine"], capture: [185, 0.43, "triangle"],
        };
        const [frequency, duration, shape] = settings[type] || settings.select;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = shape;
        osc.frequency.setValueAtTime(frequency, now);
        if (type === "attack" || type === "defeat") osc.frequency.exponentialRampToValueAtTime(Math.max(55, frequency * 0.55), now + duration);
        if (type === "found" || type === "victory" || type === "research") osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration * 0.6);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(type === "attack" ? 0.085 : 0.06, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      }
      dispose() {
        if (this.musicTimer) window.clearInterval(this.musicTimer);
        this.musicTimer = null;
        this.oscillators.forEach(({ osc }) => { try { osc.stop(); } catch {} });
        if (this.context) this.context.close().catch(() => {});
        this.context = null;
      }
    }

    const audio = new SynthAudio();

    host.innerHTML = `
      <div id="gameRoot" class="game-root">
        <section id="titleScreen" class="screen title-screen">
          <div class="title-art">
            <canvas id="titleCanvas" class="title-canvas" aria-hidden="true"></canvas>
            <div class="title-art-copy">
              <span class="micro-label">An atlas of ambition</span>
              <h2>Every border begins<br>with a single step.</h2>
              <p>Found a home. Give an idea its first spark. Discover what your neighbors are willing to trade for peace.</p>
            </div>
          </div>
          <div class="title-side">
            <div class="brand-mark"><span class="brand-emblem">C</span><span class="brand-type">A small-world strategy<strong>Four roads to an empire</strong></span></div>
            <div class="title-lockup">
              <span class="eyebrow">A turn-based 4X campaign</span>
              <h1>CIVILIZATION<span>MICRO</span></h1>
              <p>Four rival powers. One uncharted continent. The future belongs to the civilization that can imagine more than it fears.</p>
            </div>
            <div class="title-actions">
              <button class="button-primary" data-action="open-setup"><span>Begin a new campaign</span><span aria-hidden="true">&#8594;</span></button>
              <button id="resumeButton" class="button-secondary title-continue hidden" data-action="resume-game">Continue campaign <span aria-hidden="true">&#8594;</span></button>
              <button class="button-quiet" data-action="open-manual">Field manual <span aria-hidden="true">&#8599;</span></button>
              <button class="button-quiet" data-action="open-legacy">Founders' legacy <span aria-hidden="true">&#8599;</span></button>
            </div>
            <div id="titleRecord" class="title-record"></div>
            <div class="title-footer">A living world, written one turn at a time</div>
          </div>
        </section>

        <section id="setupScreen" class="screen setup-screen hidden">
          <div class="setup-panel">
            <div class="setup-head"><div><div class="eyebrow">Campaign charter</div><h2>Choose the shape of your legacy</h2><p>Pick a civilization and a world that will push it beyond its first borders.</p></div><button class="close-button" data-action="close-setup" aria-label="Close setup">&#215;</button></div>
            <div class="setup-section"><div class="setup-section-head"><h3>Choose your civilization</h3><span>Four distinct ways to build a future</span></div><div id="civChoices" class="civ-grid"></div></div>
            <div class="setup-options">
              <div><div class="setup-section-head"><h3>World pressure</h3></div><div id="difficultyChoices" class="choice-row"></div></div>
              <label class="toggle-label"><input id="guidedToggle" type="checkbox" checked><span>Guide my first steps</span></label>
            </div>
            <div class="setup-bottom"><button class="button-quiet" data-action="open-manual">Read the field manual</button><button class="button-primary" data-action="start-campaign">Found your first city <span aria-hidden="true">&#8594;</span></button></div>
          </div>
        </section>

        <section id="gameScreen" class="screen game-screen hidden">
          <header id="gameHeader" class="topbar"></header>
          <main class="game-content">
            <aside class="side-panel left-panel"><div id="leftPanel" class="panel-inner"></div></aside>
            <section class="center-column">
              <div id="tutorialHost"></div>
              <div class="map-heading"><span><strong>Continent</strong> / The known world</span><span id="mapHint">A hand-drawn frontier</span></div>
              <div class="map-frame" id="mapFrame">
                <canvas id="worldCanvas" class="world-canvas" aria-label="Hex-grid world map. Click to select or move units; drag to pan."></canvas>
                <div class="map-overlay"><span class="map-compass">N</span><span id="mapStatus">The frontier awaits</span></div>
                <div class="zoom-controls"><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">&#8722;</button></div>
              </div>
              <div class="map-toolbar"><div id="actionButtons" class="action-buttons"></div><button class="end-turn-button" data-action="end-turn"><span class="turn-arrow">&#10148;</span> End turn <span class="keycap">Space</span></button></div>
            </section>
            <aside class="side-panel right-panel"><div id="rightPanel"></div></aside>
          </main>
          <footer class="feedbar"><span class="feed-label">Chronicle</span><div id="eventFeed" class="feed-events"></div><span id="feedSummary" class="feed-summary"></span></footer>
          <div id="turnTransition" class="turn-transition hidden"><span>TURN COMPLETE</span></div>
        </section>

        <section id="modalScreen" class="screen modal-screen hidden" role="dialog" aria-modal="true"><div id="modalPanel" class="modal-panel"></div></section>
        <section id="resultScreen" class="screen result-screen hidden" role="dialog" aria-modal="true"><div id="resultPanel" class="result-panel"></div></section>
        <div id="toastStack" class="toast-stack" aria-live="polite"></div>
      </div>`;

    root = host.querySelector("#gameRoot");
    const titleScreen = root.querySelector("#titleScreen");
    const setupScreen = root.querySelector("#setupScreen");
    const gameScreen = root.querySelector("#gameScreen");
    const modalScreen = root.querySelector("#modalScreen");
    const resultScreen = root.querySelector("#resultScreen");
    const titleCanvas = root.querySelector("#titleCanvas");
    const worldCanvas = root.querySelector("#worldCanvas");
    const mapFrame = root.querySelector("#mapFrame");
    const ctx = worldCanvas.getContext("2d");
    const titleCtx = titleCanvas.getContext("2d");

    function persistMeta() {
      safeSave(META_KEY, meta);
    }

    function hasSavedCampaign() {
      const saved = safeLoad(SAVE_KEY, null);
      return Boolean(saved && saved.version === 1 && saved.players && saved.tiles && saved.units);
    }

    function renderTitle() {
      const resume = root.querySelector("#resumeButton");
      const record = root.querySelector("#titleRecord");
      const saved = safeLoad(SAVE_KEY, null);
      resume.classList.toggle("hidden", !(saved && saved.version === 1 && saved.players && saved.tiles));
      const best = Number(meta.records.bestScore) || 0;
      record.innerHTML = `<div>Campaigns<strong>${Number(meta.records.games) || 0}</strong></div><div>Victories<strong>${Number(meta.records.victories) || 0}</strong></div><div>Best legacy<strong>${best.toLocaleString()}</strong></div>`;
      renderSetupChoices();
    }

    function renderSetupChoices() {
      const civHost = root.querySelector("#civChoices");
      const difficultyHost = root.querySelector("#difficultyChoices");
      if (!civHost || !difficultyHost) return;
      civHost.innerHTML = CIVILIZATIONS.map((civ) => `<button class="civ-choice ${civ.id === selectedCiv ? "selected" : ""}" style="--choice-color:${civ.color}" data-action="choose-civ" data-value="${civ.id}" aria-pressed="${civ.id === selectedCiv}"><span class="civ-seal">${civ.sigil}</span><strong>${civ.name}</strong><small>${civ.description}</small><span class="civ-leader">${civ.leader}</span></button>`).join("");
      difficultyHost.innerHTML = DIFFICULTIES.map((difficulty) => `<button class="choice-button ${difficulty.id === selectedDifficulty ? "selected" : ""}" data-action="choose-difficulty" data-value="${difficulty.id}" aria-pressed="${difficulty.id === selectedDifficulty}"><strong>${difficulty.name}</strong><small style="display:block;margin-top:4px;color:#819087;font-size:8px">${difficulty.note}</small></button>`).join("");
    }

    function showScreen(name) {
      currentScreen = name;
      titleScreen.classList.toggle("hidden", name !== "title");
      setupScreen.classList.toggle("hidden", name !== "setup");
      gameScreen.classList.toggle("hidden", name !== "game");
      if (name === "title") renderTitle();
      if (name === "setup") renderSetupChoices();
      if (name === "game") {
        if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
        resizeFrameId = requestAnimationFrame(() => { resizeFrameId = 0; resizeCanvas(); });
      }
    }

    function openSetup() {
      selectedCiv = meta.records.lastCiv || selectedCiv;
      root.querySelector("#guidedToggle").checked = true;
      showScreen("setup");
      audio.unlock();
      audio.sound("select");
    }

    renderTitle();

    function makeWorld() {
      const tiles = [];
      for (let r = -MAP_RADIUS; r <= MAP_RADIUS; r += 1) {
        const minQ = Math.max(-MAP_RADIUS, -r - MAP_RADIUS);
        const maxQ = Math.min(MAP_RADIUS, -r + MAP_RADIUS);
        for (let q = minQ; q <= maxQ; q += 1) {
          const noise = Math.sin(q * 1.71 + r * 0.81) + Math.cos(r * 1.24 - q * 0.49) * 0.72 + Math.sin((q + r) * 0.39) * 0.7;
          const roll = Math.random();
          let terrain = "grass";
          if (noise < -1.04 && roll < 0.74) terrain = "water";
          else if (roll < 0.07) terrain = "mountain";
          else if (roll < 0.24) terrain = "hills";
          else if (roll < 0.43) terrain = "forest";
          else if (roll < 0.59) terrain = "plains";
          else if (roll < 0.66) terrain = "desert";
          const tile = { q, r, key: tileKey(q, r), terrain, resource: null, improvement: null, explored: false, visible: false, ruin: false, camp: false, owner: null, seed: Math.random() };
          if (terrain === "grass" && roll > 0.72) tile.resource = "Wheat";
          if (terrain === "forest" && roll > 0.7) tile.resource = "Deer";
          if (terrain === "hills" && roll > 0.6) tile.resource = "Iron";
          if (terrain === "plains" && roll > 0.77) tile.resource = "Horses";
          if (terrain === "desert" && roll > 0.61) tile.resource = "Gems";
          if (terrain === "water" && roll > 0.55) tile.resource = "Fish";
          tiles.push(tile);
        }
      }
      return tiles;
    }

    function playerTemplate(id, civId, human, start) {
      const civ = civById(civId);
      return {
        id,
        civId,
        name: civ.name,
        leader: civ.leader,
        color: civ.color,
        sigil: civ.sigil,
        isHuman: human,
        alive: true,
        capitalId: null,
        home: { q: start.q, r: start.r },
        gold: human ? 120 + (meta.upgrades.caravans || 0) * 35 : 155,
        scienceTotal: 0,
        cultureTotal: 0,
        cultureBank: 0,
        greatProgress: 0,
        greatPeople: 0,
        greatPeopleUsed: 0,
        techs: human ? [] : ["pottery", "writing", "archery"],
        research: null,
        researchProgress: 0,
        researchBank: 0,
        techProgress: {},
        researchTurns: 0,
        policies: [],
        policyPending: 0,
        tradeRoutes: 0,
        warWins: 0,
        unitsLost: 0,
        citiesLost: 0,
        score: 0,
        rates: { food: 0, production: 0, gold: 0, science: 0, culture: 0, trade: 0 },
        cityCounter: 0,
        cityNames: [...(CITY_NAMES[civId] || CITY_NAMES.aurelia)],
        lastAggression: 0,
        militaryBonusTurns: 0,
      };
    }

    function newCity(ownerId, q, r, capital = false, aiProduction = false, formerOwner = null) {
      const owner = state.players.find((player) => player.id === ownerId);
      if (!owner) return null;
      const id = `city-${state.nextCityId++}`;
      const name = owner.cityNames.length ? owner.cityNames.shift() : `${owner.name.split(" ")[0]} ${owner.cityCounter + 1}`;
      const city = {
        id,
        name,
        ownerId,
        q,
        r,
        capital,
        originalOwnerId: formerOwner || ownerId,
        population: capital && !owner.isHuman ? 2 : 1,
        foodStore: 0,
        production: aiProduction ? { id: "warrior", progress: 0 } : { id: "monument", progress: 0 },
        buildings: [],
        health: capital && !owner.isHuman ? 110 : 100,
        maxHealth: capital && !owner.isHuman ? 110 : 100,
        captured: Boolean(formerOwner),
        foundedTurn: state.turn,
        rebellion: 0,
      };
      owner.cityCounter += 1;
      state.cities.push(city);
      if (capital && !owner.capitalId) owner.capitalId = city.id;
      return city;
    }

    function newUnit(ownerId, type, q, r, options = {}) {
      const def = UNIT_DEFS[type];
      if (!def) return null;
      const owner = state.players.find((player) => player.id === ownerId);
      const id = `unit-${state.nextUnitId++}`;
      const baseStrength = def.strength + (owner && owner.isHuman ? (meta.upgrades.standard || 0) * 2 : 0);
      const unit = {
        id,
        ownerId,
        type,
        q,
        r,
        health: options.health || def.health,
        maxHealth: def.health,
        strength: Math.max(0, baseStrength),
        baseMoves: def.moves,
        moves: def.moves,
        range: def.range,
        experience: 0,
        fortified: false,
        charges: type === "builder" ? 3 : 0,
        boss: Boolean(options.boss),
      };
      state.units.push(unit);
      return unit;
    }

    function createNewState() {
      const tiles = makeWorld();
      const starts = [{ q: -4, r: 0 }, { q: 4, r: 0 }, { q: 0, r: -4 }, { q: 0, r: 4 }];
      const civOrder = [selectedCiv, ...CIVILIZATIONS.map((civ) => civ.id).filter((id) => id !== selectedCiv)];
      const players = [playerTemplate("human", civOrder[0], true, starts[0])];
      for (let i = 1; i < 4; i += 1) players.push(playerTemplate(`rival-${i}`, civOrder[i], false, starts[i]));
      state = {
        version: 1,
        turn: 1,
        difficulty: selectedDifficulty,
        playerId: "human",
        players,
        cities: [],
        units: [],
        camps: [],
        tiles,
        relations: {},
        nextUnitId: 1,
        nextCityId: 1,
        nextCampId: 1,
        selected: { kind: "unit", id: null },
        selectedTile: tileKey(starts[0].q, starts[0].r),
        researchProgress: 0,
        activeTab: "empire",
        era: 1,
        policyCount: 0,
        tradeDeals: 0,
        bossSpawned: false,
        bossDefeated: false,
        tutorialStep: guidedStart ? 0 : -1,
        tutorialComplete: !guidedStart,
        winnerId: null,
        outcome: null,
        resolution: null,
        greatPersonCount: 0,
        ageEvent: 0,
      };
      lookup = Object.create(null);
      state.tiles.forEach((tile) => { lookup[tile.key] = tile; });
      const worldStarts = [starts[0], starts[1], starts[2], starts[3]];
      worldStarts.forEach((point) => {
        const tile = tileAt(point.q, point.r);
        if (tile) { tile.terrain = "grass"; tile.resource = "Wheat"; }
        for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const neighbor = tileAt(point.q + dq, point.r + dr);
          if (neighbor && neighbor.terrain === "water") neighbor.terrain = "plains";
        }
      });
      const playerStart = worldStarts[0];
      const starter = newUnit("human", "settler", playerStart.q, playerStart.r);
      newUnit("human", "warrior", playerStart.q - 1, playerStart.r);
      newUnit("human", "scout", playerStart.q, playerStart.r + 1);
      state.selected.id = starter ? starter.id : null;
      for (let i = 1; i < players.length; i += 1) {
        const rival = players[i];
        const point = worldStarts[i];
        const city = newCity(rival.id, point.q, point.r, true, true);
        city.buildings.push("monument");
        const warriorPoint = { q: point.q + (i === 1 ? -1 : 1), r: point.r };
        newUnit(rival.id, "warrior", warriorPoint.q, warriorPoint.r);
        newUnit(rival.id, "scout", point.q, point.r + (i === 2 ? 1 : -1));
      }
      const possibleCamps = state.tiles.filter((tile) => tile.terrain !== "water" && tile.terrain !== "mountain" && worldStarts.every((point) => hexDistance(tile, point) >= 3));
      for (let n = 0; n < 6 && possibleCamps.length; n += 1) {
        const at = Math.floor(Math.random() * possibleCamps.length);
        const tile = possibleCamps.splice(at, 1)[0];
        const camp = { id: state.nextCampId++, q: tile.q, r: tile.r, age: 0, boss: false };
        state.camps.push(camp);
        tile.camp = true;
      }
      const ruinCandidates = state.tiles.filter((tile) => tile.terrain !== "water" && tile.terrain !== "mountain" && !tile.camp && worldStarts.every((point) => hexDistance(tile, point) >= 2));
      for (let n = 0; n < 7 && ruinCandidates.length; n += 1) {
        const at = Math.floor(Math.random() * ruinCandidates.length);
        ruinCandidates.splice(at, 1)[0].ruin = true;
      }
      for (let i = 0; i < players.length; i += 1) {
        for (let j = i + 1; j < players.length; j += 1) {
          const key = relationKey(players[i].id, players[j].id);
          state.relations[key] = { status: "peace", friendship: 0, tradeUntil: 0, allianceUntil: 0, warTurns: 0 };
        }
      }
      state.cities.forEach((city) => { if (city.ownerId === "human") city.capital = true; });
      updateVisibility();
      state.selectedTile = tileKey(starter.q, starter.r);
      state.players.forEach((player) => { player.score = calculateScore(player); });
      state.players.forEach((player) => { player.rates = calculateRates(player); });
      recentEvents = [{ text: "The first survey party reaches the unknown shore.", tone: "gold", turn: 1 }];
      return state;
    }

    function tileAt(q, r) {
      return lookup[tileKey(q, r)] || null;
    }

    function playerById(id) {
      return state ? state.players.find((player) => player.id === id) || null : null;
    }

    function humanPlayer() {
      return playerById(state.playerId);
    }

    function citiesFor(ownerId) {
      return state.cities.filter((city) => city.ownerId === ownerId);
    }

    function unitsFor(ownerId) {
      return state.units.filter((unit) => unit.ownerId === ownerId);
    }

    function unitById(id) {
      return state.units.find((unit) => unit.id === id) || null;
    }

    function cityById(id) {
      return state.cities.find((city) => city.id === id) || null;
    }

    function relationKey(idA, idB) {
      return [idA, idB].sort().join("|");
    }

    function relationBetween(idA, idB) {
      return state.relations[relationKey(idA, idB)] || null;
    }

    function distanceToPlayer(point) {
      const human = humanPlayer();
      const anchors = [...citiesFor(human.id), ...unitsFor(human.id)];
      if (!anchors.length) return 99;
      return Math.min(...anchors.map((anchor) => hexDistance(anchor, point)));
    }

    function territoryOwner(tile) {
      let owner = null;
      let best = 99;
      for (const city of state.cities) {
        const distance = hexDistance(city, tile);
        const radius = city.population >= 6 ? 3 : 2;
        if (distance <= radius && distance < best) {
          best = distance;
          owner = playerById(city.ownerId);
        }
      }
      return owner;
    }

    function updateVisibility() {
      if (!state) return;
      const human = humanPlayer();
      if (!human) return;
      state.tiles.forEach((tile) => { tile.visible = false; });
      const sources = [
        ...unitsFor(human.id).map((unit) => ({ point: unit, radius: unit.type === "scout" ? 3 + (meta.upgrades.surveyors || 0) : 2 + (meta.upgrades.surveyors || 0) })),
        ...citiesFor(human.id).map((city) => ({ point: city, radius: 2 + (meta.upgrades.surveyors || 0) })),
      ];
      for (const tile of state.tiles) {
        if (sources.some((source) => hexDistance(source.point, tile) <= source.radius)) {
          tile.visible = true;
          tile.explored = true;
        }
      }
      state.units.forEach((unit) => {
        if (unit.ownerId !== human.id) {
          const tile = tileAt(unit.q, unit.r);
          if (tile && tile.visible) unit.seen = true;
        }
      });
    }

    function calculateCityOutputs(city) {
      const owner = playerById(city.ownerId);
      if (!owner) return { food: 0, production: 0, trade: 0, science: 0, culture: 0, gold: 0 };
      const candidates = state.tiles.filter((tile) => hexDistance(city, tile) <= (city.population >= 6 ? 3 : 2) && tile.terrain !== "mountain");
      const scoreTile = (tile) => {
        const base = TERRAIN[tile.terrain].yields;
        const improvement = tile.improvement && IMPROVEMENTS[tile.improvement] ? IMPROVEMENTS[tile.improvement] : null;
        return base.food * 1.1 + base.production * 0.78 + base.trade * 0.63 + (improvement ? (improvement.food || 0) * 1.1 + (improvement.production || 0) * 0.78 + (improvement.trade || 0) * 0.63 : 0) + (tile.resource ? 0.65 : 0);
      };
      candidates.sort((a, b) => {
        if (a.q === city.q && a.r === city.r) return -1;
        if (b.q === city.q && b.r === city.r) return 1;
        return scoreTile(b) - scoreTile(a);
      });
      const worked = candidates.slice(0, Math.max(1, city.population));
      const output = { food: 0.8, production: 0.5 + city.population * 1.3, trade: 1, science: 2.8 + city.population * 0.8, culture: 2.6 + city.population * 0.55, gold: 1.35 };
      worked.forEach((tile) => {
        const base = TERRAIN[tile.terrain].yields;
        output.food += base.food;
        output.production += base.production;
        output.trade += base.trade;
        if (tile.improvement && IMPROVEMENTS[tile.improvement]) {
          const improvement = IMPROVEMENTS[tile.improvement];
          output.food += improvement.food || 0;
          output.production += improvement.production || 0;
          output.trade += improvement.trade || 0;
        }
        if (tile.resource) {
          if (tile.resource === "Wheat" || tile.resource === "Fish" || tile.resource === "Deer") output.food += 1;
          if (tile.resource === "Iron" || tile.resource === "Horses") output.production += 1;
          if (tile.resource === "Gems") output.trade += 2;
        }
      });
      output.gold += output.trade * 0.65;
      for (const buildingId of city.buildings) {
        const option = BUILD_OPTIONS.find((item) => item.id === buildingId);
        if (!option || !option.effect) continue;
        output.food += option.effect.food || 0;
        output.science += option.effect.science || 0;
        output.culture += option.effect.culture || 0;
        output.gold += option.effect.gold || 0;
      }
      if (owner.techs.includes("sailing")) output.gold += 0.5;
      if (owner.techs.includes("literature")) output.culture += 1;
      if (owner.techs.includes("radio")) output.culture += 1;
      if (owner.techs.includes("spaceflight")) output.science += 2;
      if (owner.techs.includes("education")) output.science *= 1.1;
      if (owner.techs.includes("computing")) output.science *= 1.15;
      if (owner.techs.includes("industry")) output.production *= 1.12;
      if (owner.techs.includes("printing")) output.culture *= 1.1;
      if (owner.techs.includes("banking")) output.trade *= 1.1;
      if (owner.policies.includes("scholarship")) output.science *= 1.15;
      if (owner.policies.includes("industry")) output.production *= 1.15;
      if (owner.policies.includes("aesthetics")) output.culture *= 1.2;
      if (owner.civId === "veyra") output.science *= 1.2;
      if (owner.civId === "nacre") output.culture *= 1.25;
      if (owner.civId === "aurelia") output.production *= 1.15;
      if (owner.policies.includes("agrarian")) output.food += 1;
      return Object.fromEntries(Object.entries(output).map(([key, value]) => [key, Math.max(0, value)]));
    }

    function calculateRates(player) {
      const totals = { food: 0, production: 0, trade: 0, science: 0, culture: 0, gold: 0 };
      for (const city of citiesFor(player.id)) {
        const out = calculateCityOutputs(city);
        totals.food += out.food - city.population * 0.9;
        totals.production += out.production;
        totals.trade += out.trade;
        totals.science += out.science;
        totals.culture += out.culture;
        totals.gold += out.gold;
      }
      if (player.isHuman) totals.science += (meta.upgrades.archive || 0) * 2;
      if (player.policies.includes("commerce")) totals.gold += 3;
      if (player.tradeRoutes > 0) totals.gold += player.tradeRoutes * (player.techs.includes("banking") ? 7 : 5);
      const difficulty = difficultyById(state.difficulty);
      const multiplier = player.isHuman ? difficulty.playerYield : difficulty.aiYield;
      return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.max(0, value * multiplier)]));
    }

    function calculateScore(player) {
      const cities = citiesFor(player.id);
      const units = unitsFor(player.id);
      const population = cities.reduce((total, city) => total + city.population, 0);
      return Math.round(cities.length * 92 + population * 22 + player.techs.length * 17 + player.cultureTotal / 18 + player.gold / 12 + units.filter((unit) => unit.type !== "settler" && unit.type !== "builder").length * 8 + (player.warWins || 0) * 20);
    }

    function saveCampaign() {
      if (!state || state.winnerId) return;
      safeSave(SAVE_KEY, state);
      lastSaveAt = Date.now();
    }

    function loadSavedCampaign() {
      const saved = safeLoad(SAVE_KEY, null);
      if (!saved || saved.version !== 1 || !saved.players || !saved.tiles || !saved.units) {
        toast("No intact campaign save could be found.", "error");
        return;
      }
      state = saved;
      state.relations = state.relations || {};
      state.camps = state.camps || [];
      state.cities = state.cities || [];
      state.players.forEach((player) => {
        player.cityNames = player.cityNames || [];
        player.policies = player.policies || [];
        player.techs = player.techs || [];
        player.researchBank = player.researchBank || 0;
        player.techProgress = player.techProgress || {};
        player.rates = calculateRates(player);
      });
      lookup = Object.create(null);
      state.tiles.forEach((tile) => { lookup[tile.key] = tile; });
      recentEvents = [{ text: "The chronicle opens where the last council left it.", tone: "gold", turn: state.turn }];
      isPaused = false;
      activeModal = null;
      showScreen("game");
      renderUI();
      updateVisibility();
      audio.unlock();
      toast(`Campaign resumed at turn ${state.turn}.`);
      saveCampaign();
    }

    function beginCampaign() {
      guidedStart = Boolean(root.querySelector("#guidedToggle").checked);
      selectedCiv = CIVILIZATIONS.some((civ) => civ.id === selectedCiv) ? selectedCiv : "aurelia";
      audio.unlock();
      state = createNewState();
      isPaused = false;
      activeModal = null;
      recentEvents = [{ text: `${civById(selectedCiv).name} sends its first survey party ashore.`, tone: "gold", turn: 1 }];
      const human = humanPlayer();
      meta.records.games = (Number(meta.records.games) || 0) + 1;
      meta.records.lastCiv = selectedCiv;
      persistMeta();
      showScreen("game");
      renderUI();
      audio.sound("found");
      saveCampaign();
      if (guidedStart) toast("Field guide ready. Found your first city to begin.");
    }

    function requestResize() {
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(mapFrame);
        titleResizeObserver = new ResizeObserver(resizeTitleCanvas);
        titleResizeObserver.observe(root.querySelector(".title-art"));
      } else {
        window.addEventListener("resize", resizeCanvas);
        window.addEventListener("resize", resizeTitleCanvas);
      }
    }

    function numberText(value) {
      const rounded = Math.round(Number(value) || 0);
      return rounded.toLocaleString();
    }

    function signedText(value) {
      const rounded = Math.round(Number(value) || 0);
      return `${rounded >= 0 ? "+" : ""}${rounded}`;
    }

    function ownerLabel(ownerId) {
      const owner = playerById(ownerId);
      return owner ? owner.name : "Unclaimed";
    }

    function rateGlyph(kind) {
      return { food: "F", production: "P", gold: "$", science: "S", culture: "C", trade: "T" }[kind] || "•";
    }

    function rateColor(kind) {
      return { food: "#93bc87", production: "#d1a16e", gold: "#e2c574", science: "#87add5", culture: "#bd91c6", trade: "#72b6ac" }[kind] || "#d4b46a";
    }

    function eraName(era) {
      return ["", "Founding Age", "Classical Age", "Scholastic Age", "Industrial Age"][clamp(era, 1, 4)];
    }

    function humanSelectedUnit() {
      if (!state || !state.selected || state.selected.kind !== "unit") return null;
      const unit = unitById(state.selected.id);
      return unit && unit.ownerId === state.playerId ? unit : null;
    }

    function selectedCity() {
      if (!state || !state.selected || state.selected.kind !== "city") return null;
      const city = cityById(state.selected.id);
      return city && city.ownerId === state.playerId ? city : null;
    }

    function getCurrentTech(player) {
      return player && player.research ? TECHS.find((tech) => tech.id === player.research) || null : null;
    }

    function techAvailable(player, tech) {
      return !player.techs.includes(tech.id) && (tech.prereq || []).every((required) => player.techs.includes(required));
    }

    function militaryStrength(player) {
      return unitsFor(player.id).reduce((total, unit) => total + unit.strength, 0);
    }

    function capturedCapitals(player) {
      return citiesFor(player.id).filter((city) => city.capital && city.originalOwnerId !== player.id).length;
    }

    function countMarkets(player) {
      return citiesFor(player.id).filter((city) => city.buildings.includes("market")).length;
    }

    function techPathCount(techId, seen = new Set()) {
      if (seen.has(techId)) return seen.size;
      seen.add(techId);
      const tech = TECHS.find((item) => item.id === techId);
      (tech?.prereq || []).forEach((required) => techPathCount(required, seen));
      return seen.size;
    }

    function victoryProgress(player, type) {
      if (type === "domination") return { value: capturedCapitals(player), target: 3, display: `${capturedCapitals(player)} / 3 capitals held` };
      if (type === "science") {
        const count = techPathCount("fusion");
        return { value: player.techs.includes("fusion") ? 1 : Math.min(0.95, player.techs.length / count), target: 1, display: player.techs.includes("fusion") ? "Unified Field discovered" : `${player.techs.length} / ${count} path discoveries` };
      }
      if (type === "culture") return { value: clamp(Math.min(player.cultureTotal / 720, player.policies.length / 3), 0, 1), target: 1, display: `${numberText(player.cultureTotal)} / 720 culture / ${player.policies.length} doctrines` };
      const progress = Math.min(player.gold / 800, player.tradeRoutes / 3, countMarkets(player) / 2);
      return { value: clamp(progress, 0, 1), target: 1, display: `${numberText(player.gold)} gold / ${player.tradeRoutes} routes / ${countMarkets(player)} markets` };
    }

    function objectiveHTML(player, type, title, copy) {
      const progress = victoryProgress(player, type);
      return `<div class="goal-card"><strong>${title}</strong><p>${copy}</p><div class="goal-progress"><span style="width:${Math.round(progress.value * 100)}%"></span></div><div class="goal-value"><span>${progress.display}</span><span>${Math.round(progress.value * 100)}%</span></div></div>`;
    }

    function selectedInfoHTML() {
      const unit = humanSelectedUnit();
      const city = selectedCity();
      if (unit) {
        const def = UNIT_DEFS[unit.type];
        const healthPct = clamp((unit.health / unit.maxHealth) * 100, 0, 100);
        const status = unit.type === "builder" ? `${unit.charges} improvements remaining` : `${unit.moves} movement ${unit.moves === 1 ? "point" : "points"} remaining`;
        const strength = unit.strength > 0 ? `<span>Strength <strong>${unit.strength}</strong></span>` : "";
        return `<div class="section-kicker">Selected unit <span class="minor">${escapeHTML(unit.q)}, ${escapeHTML(unit.r)}</span></div><div class="selection-card"><div class="selection-head"><span class="unit-badge" style="--unit-color:${playerById(unit.ownerId).color}">${def.glyph}</span><span><strong>${def.name}</strong><small>${status}</small></span></div><div class="health-meter"><span style="width:${healthPct}%"></span></div><div class="meter-label"><span>Condition</span><span>${Math.ceil(unit.health)} / ${unit.maxHealth}</span></div><div class="stat-mini-row">${strength}<span>Range <strong>${unit.range}</strong></span>${unit.experience ? `<span>Veteran <strong>${unit.experience}</strong></span>` : ""}</div></div><p class="ability-note">${def.desc}</p>`;
      }
      if (city) {
        const production = BUILD_OPTIONS.find((option) => option.id === city.production?.id);
        const productionPct = production ? clamp(city.production.progress / production.cost * 100, 0, 100) : 0;
        return `<div class="section-kicker">City council <span class="minor">${city.q}, ${city.r}</span></div><div class="selection-card"><div class="selection-head"><span class="unit-badge" style="--unit-color:${playerById(city.ownerId).color}">C</span><span><strong>${escapeHTML(city.name)}</strong><small>${city.capital ? "Capital city" : "Settled frontier"} / ${city.population} citizens</small></span></div><div class="health-meter"><span style="width:${clamp(city.health / city.maxHealth * 100, 0, 100)}%"></span></div><div class="meter-label"><span>City defenses</span><span>${Math.ceil(city.health)} / ${city.maxHealth}</span></div><div class="tech-progress-track"><span style="width:${productionPct}%"></span></div><div class="tech-progress-caption"><span>Making: ${production ? escapeHTML(production.name) : "Choose a project"}</span><span>${production ? `${Math.round(city.production.progress)} / ${production.cost}` : "Council"}</span></div></div><p class="ability-note">City output grows with population, worked land, buildings, and the policies you choose.</p>`;
      }
      const tile = state.selectedTile ? tileAt(...state.selectedTile.split(",").map(Number)) : null;
      if (tile && tile.explored) {
        const owner = territoryOwner(tile);
        const terrain = TERRAIN[tile.terrain];
        const yieldText = `${terrain.yields.food} food / ${terrain.yields.production} production / ${terrain.yields.trade} trade`;
        return `<div class="section-kicker">Frontier tile <span class="minor">${tile.q}, ${tile.r}</span></div><div class="selection-card"><div class="selection-head"><span class="unit-badge" style="--unit-color:${owner ? owner.color : "#8b9a8c"}">${tile.improvement ? IMPROVEMENTS[tile.improvement].glyph : terrain.name.slice(0, 1)}</span><span><strong>${escapeHTML(terrain.name)}</strong><small>${owner ? escapeHTML(owner.name) : "Unclaimed ground"}</small></span></div><div class="stat-mini-row"><span>Yield <strong>${yieldText}</strong></span></div>${tile.resource ? `<div class="stat-mini-row"><span>Resource <strong>${escapeHTML(tile.resource)}</strong></span></div>` : ""}${tile.improvement ? `<div class="stat-mini-row"><span>Improved <strong>${escapeHTML(IMPROVEMENTS[tile.improvement].name)}</strong></span></div>` : ""}</div><p class="ability-note">${tile.ruin ? "Ancient ruins lie here. Move a unit onto this tile to recover what was left behind." : "Hexagonal distance sets movement, city reach, and the range of every battle."}</p>`;
      }
      return `<div class="section-kicker">Field command</div><div class="empty-note">Select a unit, city, or known hex to inspect its orders and local yields.</div>`;
    }

    function renderHeader() {
      const player = humanPlayer();
      const civ = civById(player.civId);
      const rates = player.rates || calculateRates(player);
      const research = getCurrentTech(player);
      root.querySelector("#gameHeader").innerHTML = `<div class="top-brand"><span class="brand-emblem">C</span><span class="brand-type">Civilization<strong>Micro</strong></span></div><div class="turn-block"><span class="turn-number">${String(state.turn).padStart(2, "0")}</span><span class="turn-caption">Turn<span>${escapeHTML(eraName(state.era))}</span></span></div><div class="resource-strip"><div class="resource-item" title="Net food per turn"><span class="resource-glyph" style="--resource-color:${rateColor("food")}">F</span><span class="resource-copy"><strong>${signedText(rates.food)}</strong><small>Food / turn</small></span></div><div class="resource-item" title="Production per turn"><span class="resource-glyph" style="--resource-color:${rateColor("production")}">P</span><span class="resource-copy"><strong>${signedText(rates.production)}</strong><small>Production</small></span></div><div class="resource-item" title="Treasury and gold per turn"><span class="resource-glyph" style="--resource-color:${rateColor("gold")}">$</span><span class="resource-copy"><strong>${numberText(player.gold)} <small style="display:inline;color:#7d8981;font-size:8px">${signedText(rates.gold)}</small></strong><small>Treasury</small></span></div><div class="resource-item" title="Science per turn"><span class="resource-glyph" style="--resource-color:${rateColor("science")}">S</span><span class="resource-copy"><strong>${signedText(rates.science)}</strong><small>${research ? escapeHTML(research.name) : "Choose research"}</small></span></div><div class="resource-item" title="Culture per turn"><span class="resource-glyph" style="--resource-color:${rateColor("culture")}">C</span><span class="resource-copy"><strong>${signedText(rates.culture)}</strong><small>Culture / turn</small></span></div></div><div class="top-actions"><button class="icon-button" data-action="open-manual" title="Field manual (H)" aria-label="Field manual"><span class="icon">?</span></button><button class="icon-button" data-action="toggle-sound" title="Toggle synthesized audio" aria-label="Toggle sound"><span class="icon">${audio.muted ? "◌" : "♫"}</span></button><button class="icon-button" data-action="open-settings" title="Settings" aria-label="Settings"><span class="icon">&#9881;</span></button><button class="icon-button" data-action="pause-game" title="Pause (Escape)" aria-label="Pause"><span class="icon">&#10074;&#10074;</span></button></div>`;
      root.querySelector("#mapStatus").textContent = research ? `${research.name} / ${state.tiles.filter((tile) => tile.explored).length} tiles surveyed` : "Choose a first discovery";
      root.querySelector("#feedSummary").textContent = `${citiesFor(player.id).length} ${citiesFor(player.id).length === 1 ? "city" : "cities"} / ${unitsFor(player.id).length} field units`;
    }

    function renderLeftPanel() {
      const player = humanPlayer();
      const civ = civById(player.civId);
      const ownCities = citiesFor(player.id);
      const military = unitsFor(player.id).filter((unit) => unit.strength > 0).length;
      const selectedUnit = humanSelectedUnit();
      const pendingPeople = player.greatPeople;
      const cityRows = ownCities.length ? ownCities.map((city) => {
        const output = calculateCityOutputs(city);
        const order = BUILD_OPTIONS.find((option) => option.id === city.production?.id);
        const isSelected = state.selected?.kind === "city" && state.selected.id === city.id;
        return `<button class="city-row ${isSelected ? "selected" : ""}" style="--city-color:${player.color}" data-action="select-city" data-id="${city.id}"><span class="city-dot"></span><span class="city-row-main"><strong>${escapeHTML(city.name)}${city.capital ? " &#9733;" : ""}</strong><small>${city.population} citizens / ${order ? escapeHTML(order.name) : "choose a project"}</small></span><span class="city-row-side">+${Math.round(output.production)} P</span></button>`;
      }).join("") : `<div class="empty-note">Your settlers have not yet claimed a capital. The world is still yours to name.</div>`;
      const score = calculateScore(player);
      player.score = score;
      const warlord = state.units.find((unit) => unit.boss && unit.ownerId === "barbarian");
      const selectionLabel = selectedUnit ? "Unit" : selectedCity() ? "City" : "Hex";
      const policyThreshold = player.civId === "nacre" ? 112 : player.techs.includes("democracy") ? 120 : 140;
      root.querySelector("#leftPanel").innerHTML = `<div class="section-kicker">Your civilization <span class="minor">${selectionLabel} selected</span></div><div class="civ-identity"><span class="identity-seal" style="--identity-color:${civ.color}">${civ.sigil}</span><span><h2>${civ.name}</h2><p>${civ.leader} / ${state.era === 4 ? "The new age" : eraName(state.era)}</p></span></div><p class="ability-note"><strong>${civ.ability}.</strong> ${civ.description}</p><div class="score-line"><span>Legacy score</span><strong>${numberText(score)}</strong></div><div class="score-line" style="margin-top:7px"><span>Culture bank</span><strong>${numberText(player.cultureBank)} / ${policyThreshold}</strong></div>
        <div class="section-rule"></div><div class="section-kicker">Settled ground <span class="minor">${ownCities.length} / 4 rivals</span></div>${cityRows}
        <div class="section-rule"></div>${selectedInfoHTML()}
        <div class="section-rule"></div><div class="section-kicker">A living objective <span class="minor">Choose your road</span></div><div class="objective-list"><div class="objective-item"><span class="objective-mark">I</span><span><strong>${capturedCapitals(player)} / 3</strong> rival capitals captured for domination.</span></div><div class="objective-item"><span class="objective-mark">II</span><span><strong>${player.techs.length} discoveries</strong> / the Unified Field leads science.</span></div><div class="objective-item"><span class="objective-mark">III</span><span><strong>${numberText(player.cultureTotal)} culture</strong> / three doctrines shape a cultural victory.</span></div><div class="objective-item"><span class="objective-mark">IV</span><span><strong>${numberText(player.gold)} gold</strong> / markets and three routes complete the economy.</span></div></div>
        ${pendingPeople > 0 ? `<div class="section-rule"></div><div class="section-kicker">An extraordinary mind</div><div class="empty-note" style="padding-top:3px">${pendingPeople} Great ${pendingPeople === 1 ? "Person is" : "People are"} ready to leave a mark.</div><button class="action-button" data-action="open-great-person" style="width:100%;justify-content:center"><span class="action-icon">&#10022;</span> Call a Great Person</button>` : ""}
        ${warlord ? `<div class="section-rule"></div><div class="section-kicker" style="color:#d98170">Frontier threat</div><div class="selection-card" style="border-color:rgba(203,121,108,.4)"><div class="selection-head"><span class="unit-badge" style="--unit-color:#d98170">!</span><span><strong>Ashen Warlord</strong><small>${Math.ceil(warlord.health)} / ${warlord.maxHealth} condition</small></span></div><div class="health-meter"><span style="width:${clamp(warlord.health / warlord.maxHealth * 100,0,100)}%"></span></div></div>` : ""}`;
    }

    function renderEmpireTab(player) {
      const rates = player.rates || calculateRates(player);
      const production = rates.production;
      const research = getCurrentTech(player);
      const turnsToTech = research && rates.science > 0 ? Math.max(1, Math.ceil((research.cost - player.researchProgress) / rates.science)) : null;
      const rateRows = [
        ["Food surplus", rates.food, "food"], ["Production", production, "production"], ["Science", rates.science, "science"], ["Culture", rates.culture, "culture"], ["Trade income", rates.gold, "gold"],
      ];
      return `<div class="tab-section"><div class="section-kicker">The public ledger <span class="minor">per turn</span></div>${rateRows.map(([label, value, kind]) => `<div class="yield-row"><span class="yield-label"><i class="yield-dot" style="--yield-color:${rateColor(kind)}"></i>${label}</span><strong>${signedText(value)}</strong></div>`).join("")}</div>
        <div class="tab-section"><div class="section-kicker">Current ambition</div>${research ? `<div class="tech-current"><div class="current-top"><span>Researching</span><span>${turnsToTech ? `${turnsToTech} turns` : "awaiting science"}</span></div><h3>${escapeHTML(research.name)}</h3><p>${escapeHTML(research.desc)}</p><div class="tech-progress-track"><span style="width:${clamp(player.researchProgress / research.cost * 100,0,100)}%"></span></div><div class="tech-progress-caption"><span>${Math.round(player.researchProgress)} / ${research.cost} science</span><span>${research.era === 1 ? "I" : research.era === 2 ? "II" : research.era === 3 ? "III" : "IV"} age</span></div></div>` : `<div class="empty-note">An empty research council will not change the future. Choose a first discovery.</div><button class="action-button" data-action="set-tab" data-value="research"><span class="action-icon">&#9672;</span> Choose research</button>`}</div>
        <div class="tab-section"><div class="section-kicker">Paths to victory</div><div style="display:grid;gap:8px">${objectiveHTML(player,"domination","Domination","Capture all three rival capitals. Build an army, then cross the border.")}${objectiveHTML(player,"science","Scientific victory","Complete the branching path to the Unified Field. Libraries accelerate the race.")}${objectiveHTML(player,"culture","Cultural victory","Reach 720 lifetime culture and adopt three civic doctrines.")}${objectiveHTML(player,"economy","Economic victory","Hold 800 gold, operate three trade routes, and build two markets.")}</div></div>
        <div class="tab-section"><div class="section-kicker">Frontier ledger</div><div class="yield-row"><span>Rival capitals captured</span><strong>${capturedCapitals(player)} / 3</strong></div><div class="yield-row"><span>Field strength</span><strong>${numberText(militaryStrength(player))}</strong></div><div class="yield-row"><span>Trade routes active</span><strong>${player.tradeRoutes} / ${routeCapacity(player)}</strong></div><div class="yield-row"><span>Great People claimed</span><strong>${player.greatPeopleUsed}</strong></div></div>
        ${player.policyPending > 0 ? `<div class="tab-section"><div class="section-kicker" style="color:var(--gold)">A doctrine awaits</div><div class="goal-card"><strong>Choose a civic policy</strong><p>Culture has brought your civilization to a threshold. Choose one permanent doctrine.</p><button class="action-button" data-action="open-policy" style="margin-top:10px"><span class="action-icon">&#10022;</span> Write a doctrine</button></div></div>` : ""}`;
    }

    function renderResearchTab(player) {
      const current = getCurrentTech(player);
      const techRows = TECHS.map((tech) => {
        const done = player.techs.includes(tech.id);
        const available = techAvailable(player, tech);
        const active = player.research === tech.id;
        const prerequisiteText = tech.prereq?.length ? `Needs ${tech.prereq.map((id) => TECHS.find((item) => item.id === id)?.name || id).join(" + ")}` : `Age ${tech.era} / foundational`;
        return `<div class="tech-row ${available ? "available" : ""} ${done ? "completed" : ""}"><span class="tech-era">${tech.era === 1 ? "I" : tech.era === 2 ? "II" : tech.era === 3 ? "III" : "IV"}</span><span class="tech-main"><strong>${escapeHTML(tech.name)}</strong><small>${done ? escapeHTML(tech.unlock) : escapeHTML(prerequisiteText)} / ${tech.cost} science</small></span>${done ? `<span class="tech-status">&#10003; Known</span>` : active ? `<span class="tech-status" style="color:#d9c27d">${Math.round(player.researchProgress)} / ${tech.cost}</span>` : available ? `<button class="tech-pick" data-action="research-tech" data-id="${tech.id}">Study</button>` : `<span class="tech-status">Locked</span>`}</div>`;
      }).join("");
      const currentHTML = current ? `<div class="tech-current"><div class="current-top"><span>Active discovery</span><span>${current.cost} insight</span></div><h3>${escapeHTML(current.name)}</h3><p>${escapeHTML(current.desc)}</p><div class="tech-progress-track"><span style="width:${clamp(player.researchProgress / current.cost * 100,0,100)}%"></span></div><div class="tech-progress-caption"><span>${Math.round(player.researchProgress)} / ${current.cost}</span><span>${Math.max(1,Math.ceil((current.cost-player.researchProgress)/Math.max(1,player.rates.science)))} turns</span></div><button class="button-quiet" data-action="clear-research" style="margin-top:7px">Set aside discovery</button></div>` : `<div class="tech-current"><div class="current-top"><span>Research council</span><span>${player.techs.length} known</span></div><h3>No active discovery</h3><p>Choose an available study below. A completed discovery opens its child technologies.</p></div>`;
      return `<div class="tab-section">${currentHTML}</div><div class="tab-section"><div class="section-kicker">The discovery tree <span class="minor">${player.techs.length} / ${TECHS.length} known</span></div>${techRows}</div>`;
    }

    function relationDescription(player, rival) {
      const relation = relationBetween(player.id, rival.id);
      if (!relation) return "Uncertain";
      if (relation.status === "war") return `War / ${relation.warTurns || 0} turns`;
      if (relation.allianceUntil > state.turn) return `Alliance / ${relation.allianceUntil - state.turn} turns`;
      if (relation.tradeUntil > state.turn) return `Trade pact / ${relation.tradeUntil - state.turn} turns`;
      return relation.friendship > 10 ? "Warm peace" : "Peace";
    }

    function renderCouncilTab(player) {
      const rivals = state.players.filter((other) => !other.isHuman && other.alive);
      const playerRows = rivals.map((rival) => {
        const rel = relationBetween(player.id, rival.id);
        return `<div class="diplomacy-row"><span class="diplomacy-seal" style="--diplomacy-color:${rival.color}">${rival.sigil}</span><span class="diplomacy-main"><strong>${escapeHTML(rival.name)}</strong><small>${escapeHTML(rival.leader)} / ${citiesFor(rival.id).length} cities</small></span><span class="diplomacy-state">${rel?.status === "war" ? "War" : rel?.allianceUntil > state.turn ? "Ally" : "Peace"}</span><button class="diplomacy-open" data-action="open-diplomacy" data-id="${rival.id}">Council</button></div>`;
      }).join("") || `<div class="empty-note">No rivals remain on the map.</div>`;
      const missingPolicies = POLICIES.filter((policy) => !player.policies.includes(policy.id));
      const policyCards = missingPolicies.slice(0, 3).map((policy) => `<button class="policy-option" data-action="choose-policy" data-id="${policy.id}"><span class="policy-glyph">${policy.glyph}</span><span><strong>${policy.name}</strong><small>${policy.desc}</small></span></button>`).join("");
      return `<div class="tab-section"><div class="section-kicker">The world council <span class="minor">${rivals.length} powers</span></div>${playerRows}</div><div class="tab-section"><div class="section-kicker">Current doctrines <span class="minor">${player.policies.length} adopted</span></div>${player.policies.length ? player.policies.map((id) => { const policy = POLICIES.find((item) => item.id === id); return policy ? `<div class="yield-row"><span class="yield-label"><i class="yield-dot" style="--yield-color:var(--gold)"></i>${policy.name}</span><strong>&#10003;</strong></div>` : ""; }).join("") : `<div class="empty-note">Culture is a resource. Every 140 points of civic influence lets your council write a permanent doctrine. Nacre requires only 112.</div>`}${player.policyPending ? `<div class="section-kicker" style="margin-top:16px;color:var(--gold)">Choose a doctrine</div>${policyCards}<button class="action-button" data-action="open-policy" style="margin-top:8px">View all doctrines</button>` : ""}</div><div class="tab-section"><div class="section-kicker">Diplomatic customs</div><div class="empty-note">A trade pact needs Currency and 60 gold. Alliances last 12 turns. Wars end only by negotiation. Open Council on any rival to send an offer.</div></div>`;
    }

    function renderRightPanel() {
      const player = humanPlayer();
      const tabs = [["empire", "Empire"], ["research", "Research"], ["council", "Council"]];
      let content = "";
      if (state.activeTab === "research") content = renderResearchTab(player);
      else if (state.activeTab === "council") content = renderCouncilTab(player);
      else content = renderEmpireTab(player);
      root.querySelector("#rightPanel").innerHTML = `<div class="intel-tabs">${tabs.map(([id, label]) => `<button class="intel-tab ${state.activeTab === id ? "active" : ""}" data-action="set-tab" data-value="${id}">${label}</button>`).join("")}</div><div class="intel-content">${content}</div>`;
    }

    function canFoundHere(unit) {
      if (!unit || unit.type !== "settler" || unit.ownerId !== state.playerId) return false;
      const tile = tileAt(unit.q, unit.r);
      if (!tile || ["water", "mountain"].includes(tile.terrain) || state.cities.some((city) => hexDistance(city, unit) < 3)) return false;
      const otherSettlers = unitsFor(state.playerId).filter((candidate) => candidate.type === "settler");
      return otherSettlers.length > 0;
    }

    function canBuildOn(unit, improvement) {
      if (!unit || unit.type !== "builder" || unit.charges <= 0 || unit.moves <= 0 || unit.ownerId !== state.playerId) return false;
      const tile = tileAt(unit.q, unit.r);
      if (!tile || tile.terrain === "water" || tile.terrain === "mountain" || tile.improvement || state.cities.some((city) => city.q === tile.q && city.r === tile.r)) return false;
      if (improvement === "farm" && !["grass", "plains", "forest"].includes(tile.terrain)) return false;
      if (improvement === "mine" && tile.terrain !== "hills") return false;
      if (improvement === "road" && !humanPlayer().techs.includes("wheel")) return false;
      if (improvement === "trade" && !humanPlayer().techs.includes("currency")) return false;
      return true;
    }

    function renderActionBar() {
      const hostActions = root.querySelector("#actionButtons");
      const unit = humanSelectedUnit();
      const city = selectedCity();
      const actions = [];
      const button = (action, label, icon, disabled = false, value = "") => `<button class="action-button" data-action="${action}" ${value ? `data-value="${value}"` : ""} ${disabled ? "disabled" : ""}><span class="action-icon">${icon}</span>${label}</button>`;
      if (unit?.type === "settler") actions.push(button("found-city", "Found city", "+", !canFoundHere(unit)));
      if (unit?.type === "builder") {
        actions.push(button("build-improvement", "Farm", "F", !canBuildOn(unit, "farm"), "farm"));
        actions.push(button("build-improvement", "Mine", "M", !canBuildOn(unit, "mine"), "mine"));
        actions.push(button("build-improvement", "Trade post", "T", !canBuildOn(unit, "trade"), "trade"));
        if (humanPlayer().techs.includes("wheel")) actions.push(button("build-improvement", "Road", "R", !canBuildOn(unit, "road"), "road"));
      }
      if (unit && unit.strength > 0) {
        actions.push(button("fortify-unit", unit.fortified ? "Stand down" : "Fortify", unit.fortified ? "U" : "D", unit.moves <= 0));
        if (unit.health < unit.maxHealth) actions.push(button("rest-unit", "Rest", "+", unit.moves <= 0));
        const nearbyCamp = state.camps.find((camp) => hexDistance(camp, unit) <= 1);
        if (nearbyCamp) actions.push(button("strike-camp", "Strike camp", "!", unit.moves <= 0));
      }
      if (city) {
        actions.push(button("choose-production", "City production", "P"));
        actions.push(button("rush-production", "Rush / 50g", "$", !city.production || humanPlayer().gold < 50));
        if (city.health < city.maxHealth) actions.push(button("repair-city", "Repair", "+", humanPlayer().gold < 30));
      }
      if (!unit && !city && state.selectedTile) {
        const tile = tileAt(...state.selectedTile.split(",").map(Number));
        if (tile?.explored) {
          const builder = unitsFor(state.playerId).find((candidate) => candidate.type === "builder" && candidate.q === tile.q && candidate.r === tile.r);
          if (builder) { state.selected = { kind: "unit", id: builder.id }; renderActionBar(); return; }
        }
      }
      if (!actions.length) actions.push(button("set-tab", "Choose research", "S", false, "research"));
      hostActions.innerHTML = actions.join("");
    }

    function renderTutorial() {
      const hostTutorial = root.querySelector("#tutorialHost");
      if (!state || state.tutorialStep < 0 || state.tutorialStep >= TUTORIAL_STEPS.length) {
        hostTutorial.innerHTML = "";
        return;
      }
      const step = TUTORIAL_STEPS[state.tutorialStep];
      hostTutorial.innerHTML = `<div class="tutorial-banner"><span class="tutorial-seal">&#10022;</span><span class="tutorial-copy"><strong>${step.title}</strong><span>${step.text}</span></span><span class="tutorial-progress">${state.tutorialStep + 1} / ${TUTORIAL_STEPS.length}</span><button class="tutorial-dismiss" data-action="skip-tutorial" aria-label="Dismiss field guide">&#215;</button></div>`;
    }

    function renderEvents() {
      root.querySelector("#eventFeed").innerHTML = recentEvents.slice(0, 4).map((event, index) => `<span class="feed-event ${index > 1 ? "old" : ""}" style="--feed-accent:${event.tone === "danger" ? "#d98170" : event.tone === "green" ? "#83bca0" : "#d4b46a"}">${escapeHTML(event.text)}</span>`).join("");
    }

    function renderUI() {
      if (!state) return;
      renderHeader();
      renderLeftPanel();
      renderRightPanel();
      renderActionBar();
      renderTutorial();
      renderEvents();
      if (currentScreen === "game") drawWorld();
    }

    function addEvent(text, tone = "gold") {
      recentEvents.unshift({ text, tone, turn: state.turn });
      recentEvents = recentEvents.slice(0, 12);
      if (currentScreen === "game") renderEvents();
    }

    function toast(message, kind = "") {
      const stack = root?.querySelector("#toastStack");
      if (!stack) return;
      stack.innerHTML = `<div class="toast ${kind}">${escapeHTML(message)}</div>`;
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { if (stack) stack.innerHTML = ""; }, 3000);
    }

    function tutorialAction(action) {
      if (!state || state.tutorialStep < 0) return;
      const expected = ["found", "research", "move", "end-turn"][state.tutorialStep];
      if (action !== expected) return;
      state.tutorialStep += 1;
      if (state.tutorialStep >= TUTORIAL_STEPS.length) {
        state.tutorialStep = -1;
        state.tutorialComplete = true;
        addEvent("The field guide is complete. The next page belongs to you.", "green");
        toast("Field guide complete. Your civilization is yours to lead.");
      } else toast(TUTORIAL_STEPS[state.tutorialStep].title.replace(" / ", ": "));
      renderUI();
      saveCampaign();
    }

    const HEX_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

    function playerIsAtWar(idA, idB) {
      const relation = relationBetween(idA, idB);
      return Boolean(relation && relation.status === "war");
    }

    function declareWar(attackerId, defenderId, quiet = false) {
      if (attackerId === defenderId || defenderId === "barbarian") return;
      const relation = relationBetween(attackerId, defenderId);
      if (!relation || relation.status === "war") return;
      relation.status = "war";
      relation.tradeUntil = 0;
      relation.allianceUntil = 0;
      relation.warTurns = 0;
      const attacker = playerById(attackerId);
      const defender = playerById(defenderId);
      if (!quiet && attacker && defender) addEvent(`${attacker.isHuman ? "Your council declares war on" : attacker.name + " declares war on"} ${defender.name}.`, "danger");
      if (attacker?.isHuman || defender?.isHuman) {
        audio.sound("attack");
        toast(`War declared: ${attacker?.isHuman ? defender.name : attacker?.name} is now a hostile power.`, "error");
      }
      relation.friendship = Math.max(-100, (relation.friendship || 0) - 35);
    }

    function setSelection(kind, id, tile) {
      if (!state) return;
      state.selected = { kind: kind || "tile", id: id || null };
      if (tile) state.selectedTile = tileKey(tile.q, tile.r);
      if (currentScreen === "game") renderUI();
    }

    function passable(tile) {
      return Boolean(tile && tile.terrain !== "water" && tile.terrain !== "mountain");
    }

    function unitOnTile(q, r, exceptId = null) {
      return state.units.find((unit) => unit.id !== exceptId && unit.q === q && unit.r === r) || null;
    }

    function cityOnTile(q, r) {
      return state.cities.find((city) => city.q === q && city.r === r) || null;
    }

    function canTraverse(unit, tile, goal) {
      if (!passable(tile)) return false;
      const occupant = unitOnTile(tile.q, tile.r, unit.id);
      if (occupant) {
        if (occupant.ownerId === "barbarian" || occupant.ownerId !== unit.ownerId) return Boolean(goal && occupant.ownerId !== unit.ownerId);
        return false;
      }
      return true;
    }

    function findPath(unit, destination, stopAdjacent = false) {
      const start = { q: unit.q, r: unit.r };
      const goals = [];
      if (stopAdjacent) {
        for (const [dq, dr] of HEX_DIRECTIONS) {
          const neighbor = tileAt(destination.q + dq, destination.r + dr);
          if (neighbor && canTraverse(unit, neighbor, false)) goals.push(neighbor);
        }
      } else {
        const target = tileAt(destination.q, destination.r);
        if (target && canTraverse(unit, target, true)) goals.push(target);
      }
      if (!goals.length) return [];
      const goalKeys = new Set(goals.map((tile) => tile.key));
      const queue = [start];
      const parents = new Map([[tileKey(start.q, start.r), null]]);
      let foundKey = null;
      while (queue.length) {
        const here = queue.shift();
        const key = tileKey(here.q, here.r);
        if (goalKeys.has(key)) { foundKey = key; break; }
        for (const [dq, dr] of HEX_DIRECTIONS) {
          const next = tileAt(here.q + dq, here.r + dr);
          if (!next || parents.has(next.key) || !canTraverse(unit, next, goalKeys.has(next.key))) continue;
          parents.set(next.key, key);
          queue.push({ q: next.q, r: next.r });
        }
      }
      if (!foundKey) return [];
      const path = [];
      let cursor = foundKey;
      while (cursor && cursor !== tileKey(start.q, start.r)) {
        const point = lookup[cursor];
        if (point) path.unshift(point);
        cursor = parents.get(cursor);
      }
      return path;
    }

    function unitStrength(unit) {
      const player = playerById(unit.ownerId);
      let strength = unit.strength;
      if (player && !player.isHuman) strength += difficultyById(state.difficulty).aiStrength;
      if (player?.civId === "kharos") strength *= 1.15;
      if (player?.policies.includes("legions")) strength += 3;
      if (player?.militaryBonusTurns > 0) strength += 6;
      if (unit.type === "swordsman" && state.tiles.some((tile) => tile.resource === "Iron" && hexDistance(tile, unit) <= 2)) strength += 3;
      if (unit.fortified) strength *= 1.15;
      return strength;
    }

    function shakeWorld(amount = 6) {
      camera.shake = Math.max(camera.shake || 0, amount);
      camera.shakeTime = 0.35;
    }

    function burstAt(q, r, color, count = 16) {
      const position = hexToScreen(q, r);
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * PI2;
        const speed = randBetween(22, 115);
        particles.push({ x: position.x, y: position.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: randBetween(0.35, 0.8), total: randBetween(0.35, 0.8), size: randBetween(1.3, 3.3), color });
      }
      if (particles.length > 260) particles.splice(0, particles.length - 260);
    }

    function floatAt(q, r, message, color = "#ecd189") {
      const position = hexToScreen(q, r);
      floatingTexts.push({ x: position.x, y: position.y - 10, text: message, color, life: 1.2, total: 1.2 });
      if (floatingTexts.length > 25) floatingTexts.splice(0, floatingTexts.length - 25);
    }

    function removeUnit(unit, defeatedBy = null) {
      if (!unit) return;
      const owner = playerById(unit.ownerId);
      if (owner) {
        owner.unitsLost += 1;
      }
      if (unit.boss) {
        state.bossDefeated = true;
        const victor = playerById(defeatedBy);
        if (victor) {
          victor.gold += 280;
          victor.greatProgress += 65;
          victor.warWins += 1;
          floatAt(unit.q, unit.r, "+280 / Warlord defeated", "#f0d28a");
          addEvent("The Ashen Warlord falls. The frontier remembers your name.", "green");
          audio.sound("victory");
        }
      } else if (unit.ownerId === "barbarian") {
        const killer = playerById(defeatedBy);
        if (killer) {
          killer.gold += 12;
          killer.warWins += 1;
        }
      }
      if (state.selected?.kind === "unit" && state.selected.id === unit.id) state.selected = { kind: "tile", id: null };
      state.units = state.units.filter((candidate) => candidate.id !== unit.id);
      if (owner) owner.alive = citiesFor(owner.id).length > 0 || unitsFor(owner.id).some((other) => other.type === "settler");
    }

    function revealRuin(unit, tile) {
      if (!tile.ruin) return;
      tile.ruin = false;
      const owner = playerById(unit.ownerId);
      if (!owner) return;
      const reward = Math.floor(Math.random() * 3);
      if (reward === 0) {
        owner.gold += 55;
        floatAt(tile.q, tile.r, "+55 gold", "#f0d28a");
        addEvent(`${owner.isHuman ? "A forgotten cache" : owner.name + " uncovers a cache"} yields 55 gold.`, "gold");
      } else if (reward === 1) {
        owner.cultureTotal += 50;
        owner.cultureBank += 50;
        floatAt(tile.q, tile.r, "+50 culture", "#c29bce");
        addEvent(`${owner.isHuman ? "A ruin" : owner.name + " finds a ruin"} preserves an old civic charter.`, "green");
      } else {
        owner.researchProgress += 42;
        floatAt(tile.q, tile.r, "+42 insight", "#9fc5e8");
        addEvent(`${owner.isHuman ? "A recovered tablet" : owner.name + " recovers a tablet"} advances research.`, "green");
        tryCompleteResearch(owner);
      }
      burstAt(tile.q, tile.r, "#e5ca82", 20);
      audio.sound("coin");
    }

    function moveAlong(unit, path, silent = false) {
      if (!unit || unit.moves <= 0) return false;
      let moved = 0;
      for (let index = 0; index < path.length; index += 1) {
        const next = path[index];
        const cost = next.improvement === "road" ? 0.5 : 1;
        if (unit.moves + 0.001 < cost) break;
        if (!canTraverse(unit, next, false)) break;
        unit.q = next.q;
        unit.r = next.r;
        unit.moves = Math.max(0, unit.moves - cost);
        unit.fortified = false;
        moved += 1;
        revealRuin(unit, next);
      }
      if (moved > 0) {
        if (unit.ownerId === state.playerId) state.selectedTile = tileKey(unit.q, unit.r);
        updateVisibility();
        if (!silent) {
          audio.sound("move");
          renderUI();
          saveCampaign();
        }
      }
      return moved > 0;
    }

    function attackUnit(attacker, defender, silent = false) {
      if (!attacker || !defender || attacker.moves <= 0 || attacker.strength <= 0) return false;
      if (defender.ownerId !== "barbarian" && defender.ownerId !== attacker.ownerId) declareWar(attacker.ownerId, defender.ownerId, true);
      const distance = hexDistance(attacker, defender);
      if (distance > attacker.range || (distance > 1 && !UNIT_DEFS[attacker.type].ranged)) {
        if (!silent && attacker.ownerId === state.playerId) toast("That target is outside this unit's attack range.", "error");
        return false;
      }
      const attackerPower = unitStrength(attacker);
      const defenderPower = Math.max(4, unitStrength(defender));
      let damage = Math.max(10, attackerPower * (attacker.type === "catapult" ? 0.7 : 0.83) + randBetween(-3, 7) - defenderPower * 0.12);
      if (attacker.type === "archer" || attacker.type === "musketeer") damage *= 0.96;
      if (defender.fortified) damage *= 0.72;
      const counter = Math.max(3, defenderPower * (defender.ownerId === "barbarian" ? 0.4 : 0.34) + randBetween(-2, 4) - attackerPower * 0.08);
      defender.health -= damage;
      attacker.health -= counter;
      attacker.moves = 0;
      attacker.fortified = false;
      attacker.experience += 1;
      shakeWorld(5 + damage * 0.11);
      burstAt(defender.q, defender.r, defender.ownerId === "barbarian" ? "#d98170" : "#e5c476", 15);
      floatAt(defender.q, defender.r, `-${Math.round(damage)}`, "#f0a193");
      floatAt(attacker.q, attacker.r, `-${Math.round(counter)}`, "#e4aa92");
      if (!silent) audio.sound("attack");
      if (defender.health <= 0) {
        const wasBoss = defender.boss;
        removeUnit(defender, attacker.ownerId);
        const owner = playerById(attacker.ownerId);
        if (!wasBoss) addEvent(`${UNIT_DEFS[defender.type].name} defeated in the field.`, "green");
        if (attacker.ownerId === state.playerId) audio.sound("coin");
        if (attacker.type === "settler" && owner) owner.alive = false;
      }
      if (attacker.health <= 0) {
        removeUnit(attacker, defender.ownerId);
        if (attacker.ownerId === state.playerId) addEvent(`${UNIT_DEFS[attacker.type].name} lost in battle.`, "danger");
      }
      if (!silent) renderUI();
      checkEndConditions();
      return true;
    }

    function attackCity(attacker, city, silent = false) {
      if (!attacker || !city || attacker.moves <= 0 || attacker.strength <= 0) return false;
      if (city.ownerId !== attacker.ownerId) declareWar(attacker.ownerId, city.ownerId, true);
      const distance = hexDistance(attacker, city);
      if (distance > attacker.range || (distance > 1 && !UNIT_DEFS[attacker.type].ranged)) {
        if (!silent && attacker.ownerId === state.playerId) toast("Move closer to bring that city within range.", "error");
        return false;
      }
      const attackPower = unitStrength(attacker);
      const damage = Math.max(9, attackPower * (attacker.type === "catapult" ? 0.92 : 0.64) + randBetween(-2, 5));
      city.health -= damage;
      attacker.moves = 0;
      attacker.fortified = false;
      attacker.experience += 1;
      const cityPower = 10 + (city.buildings.includes("walls") ? 8 : 0) + Math.max(0, city.population - 2) * 1.5;
      const counter = Math.max(0, city.health > 0 ? cityPower + randBetween(-3, 4) - attackPower * 0.1 : 0);
      attacker.health -= counter;
      shakeWorld(6 + damage * 0.12);
      burstAt(city.q, city.r, "#e5c476", 18);
      floatAt(city.q, city.r, `-${Math.round(damage)} city`, "#f0a193");
      if (counter > 0) floatAt(attacker.q, attacker.r, `-${Math.round(counter)}`, "#e4aa92");
      if (!silent) audio.sound("attack");
      if (city.health <= 0) {
        city.health = 0;
        addEvent(`${city.name} is besieged. Send an army onto the city tile to capture it.`, "danger");
        if (attacker.ownerId === state.playerId) toast(`${city.name} has fallen. Move a land unit onto its center to claim it.`);
      }
      if (attacker.health <= 0) removeUnit(attacker, city.ownerId);
      if (!silent) renderUI();
      return true;
    }

    function captureCity(attacker, city) {
      if (!attacker || !city || city.health > 0 || attacker.ownerId === city.ownerId || attacker.moves <= 0) return false;
      const formerOwner = playerById(city.ownerId);
      const captor = playerById(attacker.ownerId);
      const originalOwner = city.originalOwnerId;
      if (formerOwner && formerOwner.id !== "barbarian") formerOwner.citiesLost += 1;
      city.ownerId = attacker.ownerId;
      city.captured = true;
      city.health = Math.max(35, Math.round(city.maxHealth * 0.42));
      city.population = Math.max(1, city.population - 1);
      city.foodStore = 0;
      city.production = { id: "monument", progress: 0 };
      attacker.q = city.q;
      attacker.r = city.r;
      attacker.moves = 0;
      attacker.fortified = false;
      if (originalOwner !== attacker.ownerId) city.originalOwnerId = originalOwner;
      if (formerOwner && citiesFor(formerOwner.id).length === 0) {
        const settler = unitsFor(formerOwner.id).some((unit) => unit.type === "settler");
        formerOwner.alive = settler;
      }
      if (captor) {
        captor.gold += city.capital ? 85 : 45;
        captor.warWins += 1;
        floatAt(city.q, city.r, `+${city.capital ? 85 : 45} / ${city.name}`, "#f0d28a");
      }
      addEvent(`${city.name} changes hands. ${captor ? captor.name : "A new power"} takes the city.`, "danger");
      burstAt(city.q, city.r, captor?.color || "#e3c77d", 34);
      shakeWorld(12);
      audio.sound("capture");
      updateVisibility();
      if (captor?.isHuman) {
        toast(`${city.name} captured. Its people will need time to recover.`);
        state.selected = { kind: "unit", id: attacker.id };
      }
      renderUI();
      checkEndConditions();
      return true;
    }

    function moveToward(unit, destination, hostileUnit = null, hostileCity = null, silent = false) {
      if (!unit || unit.moves <= 0) return false;
      if (hostileUnit && hexDistance(unit, hostileUnit) <= unit.range && (hexDistance(unit, hostileUnit) <= 1 || UNIT_DEFS[unit.type].ranged)) return attackUnit(unit, hostileUnit, silent);
      if (hostileCity && hostileCity.health <= 0 && hexDistance(unit, hostileCity) === 1) {
        const cityTile = tileAt(hostileCity.q, hostileCity.r);
        if (cityTile && canTraverse(unit, cityTile, true)) return captureCity(unit, hostileCity);
      }
      if (hostileCity && hexDistance(unit, hostileCity) <= unit.range && (hexDistance(unit, hostileCity) <= 1 || UNIT_DEFS[unit.type].ranged)) return attackCity(unit, hostileCity, silent);
      const stopAdjacent = Boolean(hostileUnit || hostileCity);
      const path = findPath(unit, destination, stopAdjacent);
      if (!path.length) {
        if (!silent && unit.ownerId === state.playerId) toast("No clear route reaches that hex. Mountains and occupied tiles block movement.", "error");
        return false;
      }
      const moved = moveAlong(unit, path, silent);
      if (moved && hostileCity && hexDistance(unit, hostileCity) <= unit.range && unit.moves > 0 && UNIT_DEFS[unit.type].ranged) attackCity(unit, hostileCity, silent);
      if (moved && hostileUnit && hexDistance(unit, hostileUnit) <= unit.range && unit.moves > 0 && UNIT_DEFS[unit.type].ranged) attackUnit(unit, hostileUnit, silent);
      return moved;
    }

    function foundCity(unit = humanSelectedUnit()) {
      if (!canFoundHere(unit)) {
        toast("This ground cannot hold a city. Choose open land at least three hexes from another city.", "error");
        return false;
      }
      const q = unit.q;
      const r = unit.r;
      const city = newCity(unit.ownerId, q, r, true, false);
      const owner = playerById(unit.ownerId);
      if (owner && owner.isHuman) {
        city.production = { id: "monument", progress: 0 };
        owner.capitalId = city.id;
      }
      state.units = state.units.filter((candidate) => candidate.id !== unit.id);
      state.selected = { kind: "city", id: city.id };
      state.selectedTile = tileKey(q, r);
      updateVisibility();
      addEvent(`${city.name} is founded. A new border takes shape.`, "green");
      floatAt(q, r, `${city.name} founded`, "#f0d28a");
      burstAt(q, r, owner.color, 28);
      shakeWorld(4);
      audio.sound("found");
      if (owner.isHuman) {
        toast(`${city.name} is your capital. Choose a project for its new council.`);
        tutorialAction("found");
      }
      renderUI();
      saveCampaign();
      return true;
    }

    function buildImprovement(unit, type) {
      const improvement = IMPROVEMENTS[type];
      if (!improvement || !canBuildOn(unit, type)) {
        toast("This builder cannot improve the selected hex.", "error");
        return false;
      }
      const tile = tileAt(unit.q, unit.r);
      tile.improvement = type;
      unit.charges -= 1;
      unit.moves = 0;
      floatAt(tile.q, tile.r, `${improvement.name} / ${improvement.desc}`, "#b6d695");
      burstAt(tile.q, tile.r, "#9abf83", 13);
      addEvent(`${improvement.name} finished at ${tile.q}, ${tile.r}. Local yields increase.`, "green");
      audio.sound("coin");
      if (unit.charges <= 0) state.units = state.units.filter((candidate) => candidate.id !== unit.id);
      const owner = humanPlayer();
      owner.rates = calculateRates(owner);
      renderUI();
      saveCampaign();
      return true;
    }

    function fortifyUnit(unit) {
      if (!unit || unit.strength <= 0 || unit.moves <= 0) return;
      if (unit.fortified) unit.fortified = false;
      else unit.fortified = true;
      unit.moves = 0;
      audio.sound("select");
      renderUI();
      saveCampaign();
    }

    function restUnit(unit) {
      if (!unit || unit.strength <= 0 || unit.moves <= 0) return;
      unit.moves = 0;
      unit.fortified = true;
      unit.health = Math.min(unit.maxHealth, unit.health + (playerById(unit.ownerId)?.civId === "kharos" ? 34 : 24));
      floatAt(unit.q, unit.r, "Field dress / +health", "#a8c89b");
      audio.sound("select");
      renderUI();
      saveCampaign();
    }

    function strikeCamp(unit) {
      if (!unit || unit.moves <= 0) return;
      const camp = state.camps.find((candidate) => hexDistance(candidate, unit) <= 1);
      if (!camp) return;
      const guard = state.units.find((candidate) => candidate.ownerId === "barbarian" && !candidate.boss && hexDistance(candidate, camp) <= 1);
      if (guard) { attackUnit(unit, guard); return; }
      state.camps = state.camps.filter((candidate) => candidate.id !== camp.id);
      const campTile = tileAt(camp.q, camp.r);
      if (campTile) campTile.camp = false;
      const player = playerById(unit.ownerId);
      if (player) {
        player.gold += 70;
        player.cultureTotal += 26;
        player.cultureBank += 26;
      }
      unit.moves = 0;
      floatAt(camp.q, camp.r, "+70 / camp cleared", "#f0d28a");
      burstAt(camp.q, camp.r, "#d7b368", 24);
      addEvent("A raider camp is dismantled. The frontier can breathe again.", "green");
      audio.sound("capture");
      renderUI();
      saveCampaign();
    }

    function selectTileAt(tile) {
      if (!tile || !state) return;
      if (!tile.explored && !tile.visible) {
        toast("That part of the map has not been surveyed.");
        return;
      }
      const unit = humanSelectedUnit();
      const unitHere = unitOnTile(tile.q, tile.r);
      const ownUnitHere = unitHere && unitHere.ownerId === state.playerId ? unitHere : null;
      const hostileUnit = unitHere && (unitHere.ownerId === "barbarian" || unitHere.ownerId !== state.playerId) ? unitHere : null;
      const targetCity = cityOnTile(tile.q, tile.r);
      const hostileCity = targetCity && targetCity.ownerId !== state.playerId ? targetCity : null;
      if (unit && unit.moves > 0 && unit.id !== (ownUnitHere?.id || null)) {
        if (hostileUnit || hostileCity) {
          const enemyId = hostileUnit?.ownerId !== "barbarian" ? hostileUnit?.ownerId : hostileCity?.ownerId;
          if (enemyId) declareWar(state.playerId, enemyId, true);
          const moved = moveToward(unit, tile, hostileUnit, hostileCity);
          if (moved) { tutorialAction("move"); saveCampaign(); }
          return;
        }
        if (passable(tile) && !ownUnitHere) {
          const moved = moveToward(unit, tile);
          if (moved) { tutorialAction("move"); saveCampaign(); }
          return;
        }
      }
      state.selectedTile = tile.key;
      if (ownUnitHere) state.selected = { kind: "unit", id: ownUnitHere.id };
      else if (targetCity) state.selected = { kind: "city", id: targetCity.id };
      else state.selected = { kind: "tile", id: null };
      audio.sound("select");
      renderUI();
    }

    function routeCapacity(player) {
      const markets = countMarkets(player);
      return 1 + markets + (player.techs.includes("navigation") ? 2 : 0) + (player.techs.includes("sailing") ? 1 : 0);
    }

    function chooseResearch(player, techId, quiet = false) {
      const tech = TECHS.find((item) => item.id === techId);
      if (!tech || !techAvailable(player, tech)) {
        if (!quiet && player.isHuman) toast("That discovery is not available yet. Complete its prerequisite studies first.", "error");
        return false;
      }
      player.research = tech.id;
      player.researchProgress = Math.max(player.researchBank || 0, player.techProgress?.[tech.id] || 0);
      player.researchBank = 0;
      if (player.isHuman) {
        state.activeTab = "research";
        tutorialAction("research");
        addEvent(`The council begins work on ${tech.name}.`, "green");
        audio.sound("select");
        renderUI();
        saveCampaign();
      }
      return true;
    }

    function tryCompleteResearch(player) {
      let completed = false;
      while (player.research) {
        const tech = TECHS.find((item) => item.id === player.research);
        if (!tech || player.researchProgress < tech.cost) break;
        const excess = player.researchProgress - tech.cost;
        player.techs.push(tech.id);
        player.era = Math.max(player.era || 1, tech.era);
        state.era = Math.max(state.era || 1, player.isHuman ? tech.era : 1);
        player.research = null;
        player.researchProgress = 0;
        player.researchBank = Math.max(0, excess);
        if (player.isHuman) {
          addEvent(`${tech.name} complete. ${tech.unlock} now shape the world.`, "green");
          floatAt(player.home.q, player.home.r, `${tech.name} discovered`, "#a7c9e7");
          burstAt(player.home.q, player.home.r, "#8bb9d8", 26);
          shakeWorld(3);
          audio.sound("research");
          toast(`${tech.name} discovered / ${tech.unlock}`);
        }
        completed = true;
        if (!player.isHuman) {
          const next = TECHS.filter((candidate) => techAvailable(player, candidate)).sort((a, b) => a.cost - b.cost)[0];
          if (next) {
            player.research = next.id;
            player.researchProgress = player.researchBank;
            player.researchBank = 0;
          }
        }
      }
      return completed;
    }

    function chooseAIResearch(player) {
      if (player.research) return;
      const available = TECHS.filter((tech) => techAvailable(player, tech));
      const priority = ["archery", "animal", "writing", "wheel", "sailing", "bronze", "mining", "masonry", "currency", "mathematics", "literature", "iron", "philosophy", "democracy", "construction", "education", "medicine", "banking", "feudal", "engineering", "gunpowder", "printing", "navigation", "steam", "electricity", "industry", "combustion", "radio", "flight", "computing", "spaceflight", "fusion"];
      const next = available.sort((a, b) => (priority.indexOf(a.id) < 0 ? 999 : priority.indexOf(a.id)) - (priority.indexOf(b.id) < 0 ? 999 : priority.indexOf(b.id)))[0] || available[0];
      if (next) {
        player.research = next.id;
        player.researchProgress = Math.max(player.researchBank || 0, player.techProgress?.[next.id] || 0);
        player.researchBank = 0;
      }
    }

    function chooseAIProduction(city, owner) {
      const military = unitsFor(owner.id).filter((unit) => unit.strength > 0).length;
      if (military < 3 && !city.buildings.includes("barracks")) return "barracks";
      if (!city.buildings.includes("granary")) return owner.techs.includes("pottery") ? "granary" : "monument";
      if (!city.buildings.includes("library") && owner.techs.includes("writing")) return "library";
      if (!city.buildings.includes("market") && owner.techs.includes("currency")) return "market";
      if (owner.techs.includes("archery") && military < 5) return "archer";
      return military < 7 ? "warrior" : "monument";
    }

    function spawnProducedUnit(city, owner, type) {
      const emptyTiles = HEX_DIRECTIONS.map(([dq, dr]) => tileAt(city.q + dq, city.r + dr)).filter((tile) => tile && passable(tile) && !unitOnTile(tile.q, tile.r) && !cityOnTile(tile.q, tile.r));
      const cityTile = tileAt(city.q, city.r);
      const spawnAt = emptyTiles[0] || (cityTile && !unitOnTile(city.q, city.r) ? cityTile : null);
      if (!spawnAt) {
        addEvent(`${city.name} has nowhere to muster a new ${UNIT_DEFS[type]?.name || "unit"}.`, "gold");
        return false;
      }
      const unit = newUnit(owner.id, type, spawnAt.q, spawnAt.r);
      unit.moves = 0;
      if (owner.isHuman) {
        state.selected = { kind: "unit", id: unit.id };
        state.selectedTile = tileKey(unit.q, unit.r);
        addEvent(`${UNIT_DEFS[type].name} musters in ${city.name}.`, "green");
        toast(`${UNIT_DEFS[type].name} musters. The frontier grows stronger.`);
      }
      return true;
    }

    function completeProduction(city, owner) {
      const option = BUILD_OPTIONS.find((item) => item.id === city.production?.id);
      if (!option) return;
      if (option.req && !owner.techs.includes(option.req)) {
        city.production = { id: owner.isHuman ? "monument" : chooseAIProduction(city, owner), progress: 0 };
        return;
      }
      if (option.kind === "unit") {
        const success = spawnProducedUnit(city, owner, option.unit);
        if (!success) { city.production.progress = option.cost; return; }
      } else if (option.kind === "building" || option.kind === "wonder") {
        const wonderExists = option.kind === "wonder" && state.cities.some((other) => other.buildings.includes(option.id));
        if (wonderExists) {
          owner.gold += Math.floor(option.cost * 0.65);
          addEvent(`${option.name} was completed elsewhere. ${city.name} redirects the project to the treasury.`, "gold");
        } else if (!city.buildings.includes(option.id)) {
          city.buildings.push(option.id);
          if (option.id === "walls") {
            city.maxHealth += 45;
            city.health = Math.min(city.maxHealth, city.health + 45);
          }
          if (option.id === "great-library" || option.id === "colossus") {
            owner.cultureTotal += 85;
            owner.cultureBank += 85;
            addEvent(`${city.name} completes the ${option.name}. Its influence will outlive its builders.`, "green");
          } else addEvent(`${city.name} completes ${option.name}.`, "green");
          if (owner.isHuman) {
            burstAt(city.q, city.r, owner.color, 23);
            floatAt(city.q, city.r, `${option.name} complete`, "#e8cf8b");
            audio.sound("research");
          }
        }
      }
      city.production = { id: owner.isHuman ? "warrior" : chooseAIProduction(city, owner), progress: 0 };
    }

    function resolveEconomy(player, humanPhase = false) {
      if (!player.alive && !citiesFor(player.id).length) return;
      if (!player.research && !player.isHuman) chooseAIResearch(player);
      let totals = { food: 0, production: 0, science: 0, culture: 0, gold: 0, trade: 0 };
      const cities = citiesFor(player.id);
      for (const city of cities) {
        if (!city.production) city.production = { id: player.isHuman ? "monument" : chooseAIProduction(city, player), progress: 0 };
        const output = calculateCityOutputs(city);
        const netFood = output.food - city.population * 0.9;
        city.foodStore += netFood;
        const threshold = Math.max(13, 15 + city.population * 5 - (player.policies.includes("agrarian") ? 5 : 0) - (player.techs.includes("medicine") ? 4 : 0));
        if (city.foodStore < -5 && city.population > 1) {
          city.population -= 1;
          city.foodStore = 0;
          if (player.isHuman) addEvent(`${city.name} struggles to feed its people.`, "danger");
        }
        if (city.foodStore >= threshold) {
          city.foodStore -= threshold;
          city.population += 1;
          if (player.isHuman) {
            addEvent(`${city.name} grows to ${city.population} citizens. Its borders and yields expand.`, "green");
            floatAt(city.q, city.r, `Population ${city.population}`, "#9dc49c");
          }
        }
        let prodMultiplier = city.buildings.includes("barracks") && ["warrior", "archer", "horseman", "swordsman", "catapult", "musketeer", "tank"].includes(city.production.id) ? 1.15 : 1;
        if (player.civId === "aurelia" && BUILD_OPTIONS.find((option) => option.id === city.production.id)?.kind === "wonder") prodMultiplier *= 1.1;
        city.production.progress += output.production * prodMultiplier;
        if (city.production.progress >= (BUILD_OPTIONS.find((item) => item.id === city.production.id)?.cost || 70)) completeProduction(city, player);
        if (city.health < city.maxHealth && !state.units.some((unit) => unit.ownerId !== city.ownerId && hexDistance(unit, city) <= 1)) city.health = Math.min(city.maxHealth, city.health + (player.techs.includes("medicine") ? 6 : 3));
        totals.food += netFood;
        totals.production += output.production;
        totals.science += output.science;
        totals.culture += output.culture;
        totals.gold += output.gold;
        totals.trade += output.trade;
      }
      const difficulty = difficultyById(state.difficulty);
      const multiplier = player.isHuman ? difficulty.playerYield : difficulty.aiYield;
      for (const key of Object.keys(totals)) totals[key] *= multiplier;
      if (player.isHuman) totals.science += (meta.upgrades.archive || 0) * 2;
      if (player.policies.includes("commerce")) totals.gold += 3;
      if (player.tradeRoutes > 0) totals.gold += player.tradeRoutes * (player.techs.includes("banking") ? 7 : 5);
      player.rates = totals;
      player.gold += totals.gold;
      player.scienceTotal += totals.science;
      player.cultureTotal += totals.culture;
      player.cultureBank += totals.culture;
      player.greatProgress += totals.culture * 0.48 + totals.science * 0.075;
      if (player.isHuman && player.greatProgress >= 110) {
        const gained = Math.floor(player.greatProgress / 110);
        player.greatProgress -= gained * 110;
        player.greatPeople += gained;
        if (gained) {
          addEvent(`${gained} Great ${gained === 1 ? "Person is" : "People are"} ready to serve the civilization.`, "green");
          toast("A Great Person is ready. Their work can change the course of the campaign.");
        }
      }
      const cultureThreshold = player.civId === "nacre" ? 112 : player.techs.includes("democracy") ? 120 : 140;
      if (player.cultureBank >= cultureThreshold) {
        const earned = Math.floor(player.cultureBank / cultureThreshold);
        player.cultureBank -= earned * cultureThreshold;
        if (player.policies.length < POLICIES.length) player.policyPending += earned;
        else player.gold += earned * 45;
        if (!player.isHuman) {
          while (player.policyPending > 0) {
            const policy = POLICIES.find((candidate) => !player.policies.includes(candidate.id));
            if (!policy) { player.policyPending = 0; break; }
            player.policies.push(policy.id);
            player.policyPending -= 1;
          }
        }
        if (player.isHuman && earned) {
          addEvent("A new civic tradition can now be written.", "green");
          toast("A policy is ready. Choose a doctrine in the Council.");
        }
      }
      if (player.research) {
        player.researchProgress += totals.science;
        player.techProgress = player.techProgress || {};
        player.techProgress[player.research] = player.researchProgress;
        tryCompleteResearch(player);
      }
      player.score = calculateScore(player);
      if (humanPhase && player.isHuman && totals.gold > 0 && Math.floor(player.gold) % 175 < Math.ceil(totals.gold)) floatAt(player.home.q, player.home.r, `+${Math.round(totals.gold)} treasury`, "#f0d28a");
      return totals;
    }

    function chooseProduction(city, optionId) {
      const owner = playerById(city.ownerId);
      const option = BUILD_OPTIONS.find((item) => item.id === optionId);
      if (!owner || !option || (option.req && !owner.techs.includes(option.req))) {
        toast("That project is not available to this city yet.", "error");
        return;
      }
      if ((option.kind === "building" || option.kind === "wonder") && city.buildings.includes(option.id)) {
        toast("This city already has that building.", "error");
        return;
      }
      if (option.kind === "wonder" && state.cities.some((other) => other.buildings.includes(option.id))) {
        toast("That world wonder has already been completed.", "error");
        return;
      }
      city.production = { id: option.id, progress: 0 };
      closeModal();
      state.selected = { kind: "city", id: city.id };
      addEvent(`${city.name} begins work on ${option.name}.`, "gold");
      audio.sound("select");
      renderUI();
      saveCampaign();
    }

    function rushProduction(city) {
      const player = humanPlayer();
      const option = BUILD_OPTIONS.find((item) => item.id === city.production?.id);
      if (!option || player.gold < 50) return;
      player.gold -= 50;
      city.production.progress += 62;
      floatAt(city.q, city.r, "-50 gold / +62 production", "#e8cc87");
      addEvent(`The treasury rushes ${city.name}'s current project.`, "gold");
      if (city.production.progress >= option.cost) completeProduction(city, player);
      audio.sound("coin");
      renderUI();
      saveCampaign();
    }

    function repairCity(city) {
      const player = humanPlayer();
      if (player.gold < 30 || city.health >= city.maxHealth) return;
      player.gold -= 30;
      city.health = Math.min(city.maxHealth, city.health + 42);
      floatAt(city.q, city.r, "+42 defenses", "#a8c89b");
      addEvent(`${city.name} uses 30 gold to repair its defenses.`, "green");
      audio.sound("coin");
      renderUI();
      saveCampaign();
    }

    function choosePolicy(policyId) {
      const player = humanPlayer();
      const policy = POLICIES.find((item) => item.id === policyId);
      if (!policy || !player.policyPending || player.policies.includes(policyId)) return;
      player.policies.push(policy.id);
      player.policyPending -= 1;
      state.policyCount = player.policies.length;
      addEvent(`${policy.name} is written into the civic charter.`, "green");
      toast(`${policy.name} adopted / ${policy.desc}`);
      audio.sound("research");
      if (activeModal === "policy") closeModal();
      renderUI();
      saveCampaign();
    }

    function activateGreatPerson(person) {
      const player = humanPlayer();
      if (player.greatPeople <= 0) return;
      player.greatPeople -= 1;
      player.greatPeopleUsed += 1;
      if (person === "scientist") {
        if (!player.research) {
          const next = TECHS.filter((tech) => techAvailable(player, tech)).sort((a, b) => a.cost - b.cost)[0];
          if (next) chooseResearch(player, next.id, true);
        }
        player.researchProgress += 160;
        tryCompleteResearch(player);
        addEvent("A Great Scientist leaves a lifetime of notes to your research council.", "green");
        floatAt(player.home.q, player.home.r, "+160 insight", "#a6cae8");
      } else if (person === "merchant") {
        player.gold += 230;
        if (player.tradeRoutes < routeCapacity(player)) player.tradeRoutes += 1;
        addEvent("A Great Merchant opens a new road of trade and leaves 230 gold.", "green");
        floatAt(player.home.q, player.home.r, "+230 gold / +1 route", "#f0d28a");
      } else if (person === "general") {
        player.militaryBonusTurns = Math.max(player.militaryBonusTurns, 7);
        state.units.filter((unit) => unit.ownerId === player.id && unit.strength > 0).forEach((unit) => { unit.health = Math.min(unit.maxHealth, unit.health + 35); });
        addEvent("A Great General rallies the army. Units fight harder for seven turns.", "green");
        floatAt(player.home.q, player.home.r, "Veteran command / 7 turns", "#e1a093");
      } else if (person === "writer") {
        player.cultureTotal += 260;
        player.cultureBank += 260;
        addEvent("A Great Writer's work becomes the most copied book on the continent.", "green");
        floatAt(player.home.q, player.home.r, "+260 culture", "#c19acb");
      }
      closeModal();
      audio.sound("victory");
      renderUI();
      saveCampaign();
      checkEndConditions();
    }

    function establishDeal(rivalId, deal) {
      const player = humanPlayer();
      const rival = playerById(rivalId);
      const relation = rival && relationBetween(player.id, rival.id);
      if (!rival || !relation) return;
      if (deal === "war") {
        declareWar(player.id, rival.id);
        closeModal();
        renderUI();
        saveCampaign();
        return;
      }
      if (deal === "peace") {
        if (relation.status !== "war" || relation.warTurns < 2 || player.gold < 40) return;
        player.gold -= 40;
        relation.status = "peace";
        relation.warTurns = 0;
        relation.friendship = Math.max(0, relation.friendship + 10);
        addEvent(`A ceasefire with ${rival.name} gives both armies room to recover.`, "green");
        toast(`Peace signed with ${rival.name}.`);
      } else if (deal === "trade") {
        if (!player.techs.includes("currency") || relation.status === "war" || relation.tradeUntil > state.turn || player.gold < 60 || player.tradeRoutes >= routeCapacity(player)) return;
        player.gold -= 60;
        player.tradeRoutes += 1;
        state.tradeDeals += 1;
        relation.tradeUntil = state.turn + 12;
        relation.friendship += 12;
        addEvent(`A twelve-turn trade pact with ${rival.name} opens a new route.`, "green");
        toast(`Trade pact signed / +5 gold per turn for 12 turns.`);
        audio.sound("coin");
      } else if (deal === "alliance") {
        if (relation.status === "war" || relation.allianceUntil > state.turn || relation.friendship < 8 || player.gold < 100) return;
        player.gold -= 100;
        relation.allianceUntil = state.turn + 12;
        relation.friendship += 22;
        addEvent(`${rival.name} signs a twelve-turn alliance with your council.`, "green");
        toast(`Alliance with ${rival.name} / the border is safe for 12 turns.`);
      } else if (deal === "gift") {
        if (relation.status === "war" || player.gold < 50) return;
        player.gold -= 50;
        relation.friendship += 15;
        addEvent(`A diplomatic gift warms relations with ${rival.name}.`, "green");
        toast(`${rival.name} appreciates the 50 gold gift.`);
      }
      closeModal();
      audio.sound("select");
      renderUI();
      saveCampaign();
    }

    function maybeExpandAI(player) {
      const playerCities = citiesFor(player.id);
      if (playerCities.length >= 3 || state.turn < 5 || state.turn % (state.difficulty === "warlord" ? 5 : 7) !== 0) return;
      const sites = state.tiles.filter((tile) => passable(tile) && !cityOnTile(tile.q, tile.r) && !unitOnTile(tile.q, tile.r) && !tile.camp && playerCities.every((city) => hexDistance(city, tile) >= 3) && state.cities.every((city) => city.ownerId === player.id || hexDistance(city, tile) >= 2));
      sites.sort((a, b) => {
        const aDist = Math.min(...playerCities.map((city) => hexDistance(city, a)));
        const bDist = Math.min(...playerCities.map((city) => hexDistance(city, b)));
        const aScore = Math.abs(aDist - 4) + (a.resource ? -0.8 : 0) + (a.terrain === "grass" ? -0.4 : 0);
        const bScore = Math.abs(bDist - 4) + (b.resource ? -0.8 : 0) + (b.terrain === "grass" ? -0.4 : 0);
        return aScore - bScore;
      });
      if (sites.length > 0) {
        const site = sites[Math.floor(Math.random() * Math.min(4, sites.length))];
        const city = newCity(player.id, site.q, site.r, false, true);
        city.population = 1;
        addEvent(`${player.name} plants a new settlement at ${city.name}.`, "gold");
      }
    }

    function updateAIDiplomacy(player) {
      const human = humanPlayer();
      const relation = relationBetween(player.id, human.id);
      if (!relation || relation.status === "war" || relation.allianceUntil > state.turn) return;
      const near = citiesFor(human.id).some((city) => hexDistance(city, player.home) <= 5);
      const difficulty = difficultyById(state.difficulty);
      const temperament = player.civId === "kharos" ? 0.05 : 0;
      const chance = state.turn < 7 ? 0 : (state.difficulty === "warlord" ? 0.11 : 0.038) + temperament + (near ? 0.035 : 0);
      if (Math.random() < chance) {
        declareWar(player.id, human.id, true);
        addEvent(`${player.name} abandons the border treaty and declares war.`, "danger");
        if (human.isHuman) toast(`${player.name} declares war. Rally the field army.`, "error");
      } else if (state.turn % 5 === 0) {
        relation.friendship = Math.min(30, relation.friendship + (difficulty.id === "settler" ? 2 : 1));
      }
    }

    function nearestHumanTarget(unit) {
      const humanCities = citiesFor(state.playerId);
      const humanUnits = unitsFor(state.playerId).filter((candidate) => candidate.strength > 0);
      const targets = [...humanUnits, ...humanCities];
      return targets.sort((a, b) => hexDistance(unit, a) - hexDistance(unit, b))[0] || null;
    }

    function processAIMilitary(player) {
      const relation = relationBetween(player.id, state.playerId);
      if (!relation || relation.status !== "war") return;
      const attackers = unitsFor(player.id).filter((unit) => unit.strength > 0).sort((a, b) => b.strength - a.strength);
      for (const unit of attackers) {
        if (unit.moves <= 0 || !state.units.some((candidate) => candidate.id === unit.id)) continue;
        const target = nearestHumanTarget(unit);
        if (!target) break;
        const defender = target.id && target.ownerId === state.playerId && target.strength !== undefined ? target : null;
        const city = target.id && target.ownerId === state.playerId && target.population !== undefined ? target : null;
        if (defender && hexDistance(unit, defender) <= unit.range) attackUnit(unit, defender, true);
        else if (city && city.health <= 0 && hexDistance(unit, city) === 1) captureCity(unit, city);
        else if (city && hexDistance(unit, city) <= unit.range) attackCity(unit, city, true);
        else moveToward(unit, target, defender, city, true);
      }
    }

    function processBarbarianTurn() {
      const difficulty = difficultyById(state.difficulty);
      if (state.turn >= 24 && !state.bossSpawned) {
        const humanCities = citiesFor(state.playerId);
        const anchor = humanCities[0] || { q: -4, r: 0 };
        const candidates = state.tiles.filter((tile) => passable(tile) && !cityOnTile(tile.q, tile.r) && !unitOnTile(tile.q, tile.r) && hexDistance(anchor, tile) >= 3 && hexDistance(anchor, tile) <= 5);
        const spawnAt = candidates[Math.floor(Math.random() * Math.max(1, candidates.length))] || state.tiles.find((tile) => passable(tile) && !cityOnTile(tile.q, tile.r) && !unitOnTile(tile.q, tile.r));
        if (spawnAt) {
          const boss = newUnit("barbarian", "warlord", spawnAt.q, spawnAt.r, { boss: true });
          boss.health = boss.maxHealth;
          state.bossSpawned = true;
          addEvent("THE ASHEN WARLORD has emerged from the wilds. Defeat the champion for a treasury of 280 gold.", "danger");
          toast("Capstone threat / The Ashen Warlord is on the map. Defeating the champion yields 280 gold.", "error");
          burstAt(spawnAt.q, spawnAt.r, "#d98170", 42);
          shakeWorld(7);
        }
      }
      const existingCamps = state.camps.length;
      if (existingCamps < 6 && state.turn > 4 && state.turn % 5 === 0 && Math.random() < 0.54 * difficulty.barbRate) {
        const options = state.tiles.filter((tile) => passable(tile) && !tile.camp && !cityOnTile(tile.q, tile.r) && !unitOnTile(tile.q, tile.r) && distanceToPlayer(tile) >= 3);
        if (options.length) {
          const tile = options[Math.floor(Math.random() * options.length)];
          const camp = { id: state.nextCampId++, q: tile.q, r: tile.r, age: 0, boss: false };
          state.camps.push(camp);
          tile.camp = true;
          addEvent("Scouts report a new raider camp beyond the settled border.", "danger");
        }
      }
      for (const camp of [...state.camps]) {
        camp.age += 1;
        const guard = state.units.find((unit) => unit.ownerId === "barbarian" && !unit.boss && hexDistance(unit, camp) <= 1);
        if (!guard && camp.age >= 2) {
          const spawnAt = tileAt(camp.q, camp.r);
          const nearbyEmpty = HEX_DIRECTIONS.map(([dq, dr]) => tileAt(camp.q + dq, camp.r + dr)).find((tile) => tile && passable(tile) && !unitOnTile(tile.q, tile.r) && !cityOnTile(tile.q, tile.r));
          const place = spawnAt && !unitOnTile(spawnAt.q, spawnAt.r) && !cityOnTile(spawnAt.q, spawnAt.r) ? spawnAt : nearbyEmpty;
          if (place) {
            newUnit("barbarian", "barbarian", place.q, place.r);
            camp.age = 0;
            if (place.visible) addEvent("A raider emerges from a known camp.", "danger");
          }
        }
      }
      const raiders = state.units.filter((unit) => unit.ownerId === "barbarian").sort((a, b) => (a.boss ? -1 : 1));
      for (const raider of raiders) {
        if (raider.moves <= 0 || !state.units.some((unit) => unit.id === raider.id)) continue;
        const human = humanPlayer();
        const targets = [...unitsFor(human.id).filter((unit) => unit.strength > 0), ...citiesFor(human.id), ...state.players.filter((player) => !player.isHuman).flatMap((player) => citiesFor(player.id))];
        const target = targets.sort((a, b) => hexDistance(raider, a) - hexDistance(raider, b))[0];
        if (!target || hexDistance(raider, target) > 7) continue;
        const defender = target.strength !== undefined && target.ownerId !== "barbarian" ? target : null;
        const city = target.population !== undefined ? target : null;
        if (defender && hexDistance(raider, defender) <= 1) attackUnit(raider, defender, true);
        else if (city && hexDistance(raider, city) <= 1) {
          if (city.health <= 0) {
            const captor = { ...raider, ownerId: "barbarian" };
            city.health = 24;
            city.population = Math.max(1, city.population - 1);
            addEvent(`Raiders burn the outskirts of ${city.name}.`, "danger");
            raider.moves = 0;
          } else {
            city.health -= raider.type === "warlord" ? 19 : 11;
            raider.moves = 0;
            shakeWorld(4);
            floatAt(city.q, city.r, `-${raider.type === "warlord" ? 19 : 11} defenses`, "#e6a194");
            addEvent(`A raider strike damages ${city.name}.`, "danger");
          }
        } else moveToward(raider, target, defender, city, true);
      }
    }

    function updateRelations() {
      Object.values(state.relations).forEach((relation) => {
        if (relation.status === "war") relation.warTurns = (relation.warTurns || 0) + 1;
        if (relation.tradeUntil === state.turn) {
          const participants = Object.keys(state.relations).find((key) => state.relations[key] === relation)?.split("|") || [];
          const human = humanPlayer();
          if (participants.includes(human.id) && human.tradeRoutes > 0) human.tradeRoutes -= 1;
          relation.friendship += 2;
          addEvent("A trade pact ends. Its route can be renewed in Council.", "gold");
        }
        if (relation.allianceUntil === state.turn) {
          relation.friendship += 4;
          addEvent("A diplomatic alliance expires. The old treaty becomes a promise, not a shield.", "gold");
        }
      });
    }

    function checkVictoryFor(player) {
      if (!player || !player.alive) return null;
      if (capturedCapitals(player) >= 3) return { type: "domination", title: "A Continent United", description: "All three rival capitals now answer to your council. By strength and resolve, one civilization has joined the map together." };
      if (player.techs.includes("fusion")) return { type: "science", title: "Beyond the Known World", description: "The Unified Field changes more than the laws of nature. It changes the limits of what your civilization can become." };
      if (player.cultureTotal >= 720 && player.policies.length >= 3) return { type: "culture", title: "A Living Civilization", description: "Your ideas travel farther than your borders. Every rival now measures its future in the language your people wrote." };
      if (player.gold >= 800 && player.tradeRoutes >= 3 && countMarkets(player) >= 2) return { type: "economy", title: "The Golden Network", description: "Three trade routes and two great markets link the continent. Prosperity has become the strongest border of all." };
      return null;
    }

    function checkEndConditions() {
      if (!state || state.winnerId) return;
      const human = humanPlayer();
      for (const player of state.players) {
        if (!state.sandbox) {
          const victory = checkVictoryFor(player);
          if (victory) {
            finishGame(player.id, victory.type, victory.title, victory.description);
            return;
          }
        }
      }
      const humanSettler = unitsFor(human.id).some((unit) => unit.type === "settler");
      if (!citiesFor(human.id).length && !humanSettler) {
        finishGame("rival", "conquest", "A City Remembered", "Your last field party has fallen and no capital remains to carry the charter. A future was begun, even if it could not be held.");
        return;
      }
      if (state.sandbox) return;
      if (state.turn >= 56) {
        const winner = [...state.players].sort((a, b) => calculateScore(b) - calculateScore(a))[0];
        const description = winner.id === human.id ? "The world congress closes its final session. Your civilization leads every rival in the measure that endures: the score of a life well imagined." : `${winner.name} leads the continent as the world congress closes. The chronicle remembers your cities, discoveries, and the ground you held.`;
        finishGame(winner.id, "legacy", winner.id === human.id ? "The Leading Civilization" : "A Rival's Ascendancy", description);
      }
    }

    function finishGame(winnerId, type, title, description) {
      if (!state || state.winnerId) return;
      state.winnerId = winnerId;
      state.outcome = winnerId === state.playerId ? "victory" : "defeat";
      state.resolution = { type, title, description };
      const player = humanPlayer();
      player.score = calculateScore(player);
      const won = state.outcome === "victory";
      const reward = state.sandbox ? 0 : won ? (state.difficulty === "warlord" ? 5 : state.difficulty === "regent" ? 4 : 3) : state.turn >= 10 ? 1 : 0;
      meta.legacy += reward;
      if (won && !state.sandbox) meta.records.victories = (Number(meta.records.victories) || 0) + 1;
      meta.records.bestScore = Math.max(Number(meta.records.bestScore) || 0, player.score);
      meta.records.bestTurn = Math.max(Number(meta.records.bestTurn) || 0, state.turn);
      persistMeta();
      try { window.localStorage.removeItem(SAVE_KEY); } catch {}
      isPaused = false;
      closeModal();
      audio.sound(won ? "victory" : "defeat");
      renderUI();
      renderResult(reward);
      resultScreen.classList.remove("hidden");
    }

    function endTurn() {
      if (!state || isPaused || state.winnerId || endTurnBusy || activeModal) return;
      endTurnBusy = true;
      audio.unlock();
      audio.sound("turn");
      const resolvingTurn = state.turn;
      const human = humanPlayer();
      resolveEconomy(human, true);
      for (const rival of state.players.filter((player) => !player.isHuman && player.alive)) {
        chooseAIResearch(rival);
        resolveEconomy(rival);
        maybeExpandAI(rival);
        updateAIDiplomacy(rival);
      }
      for (const rival of state.players.filter((player) => !player.isHuman && player.alive)) {
        unitsFor(rival.id).forEach((unit) => { unit.moves = unit.baseMoves; });
        processAIMilitary(rival);
      }
      processBarbarianTurn();
      updateRelations();
      if (human.militaryBonusTurns > 0) human.militaryBonusTurns -= 1;
      for (const unit of unitsFor(human.id)) {
        unit.moves = unit.baseMoves;
        if (unit.fortified && unit.strength > 0) unit.health = Math.min(unit.maxHealth, unit.health + (human.civId === "kharos" ? 18 : 12));
      }
      state.turn += 1;
      state.era = Math.max(1, ...human.techs.map((id) => TECHS.find((tech) => tech.id === id)?.era || 1));
      for (const player of state.players) player.score = calculateScore(player);
      updateVisibility();
      const turnEvent = [
        "The frontier grows quieter as another council closes.",
        "New roads carry old promises into unfamiliar country.",
        "The map changes. Every border tells the story of a choice.",
        "The age advances by the work of ordinary hands.",
      ][resolvingTurn % 4];
      if (!recentEvents.some((event) => event.turn === resolvingTurn && event.text === turnEvent)) addEvent(turnEvent, "gold");
      checkEndConditions();
      renderUI();
      saveCampaign();
      const transition = root.querySelector("#turnTransition");
      transition.querySelector("span").textContent = `TURN ${String(state.turn).padStart(2, "0")}`;
      transition.classList.remove("hidden");
      if (transitionTimer) window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => { transition.classList.add("hidden"); transitionTimer = null; }, 680);
      endTurnBusy = false;
      if (state.tutorialStep === 3) tutorialAction("end-turn");
    }

    function renderResult(reward) {
      const player = humanPlayer();
      const won = state.outcome === "victory";
      const cities = citiesFor(player.id).length;
      const capitals = capturedCapitals(player);
      const resolution = state.resolution || { title: won ? "A Living Legacy" : "The Chronicle Closes", description: "The world has changed." };
      const rewardText = reward ? `+${reward} Legacy ${reward === 1 ? "Seal" : "Seals"} earned for the Founders' archive.` : "No legacy seals were earned this time. Every campaign writes a better map.";
      const accent = won ? "#d9bf79" : "#d98170";
      root.querySelector("#resultPanel").style.setProperty("--result-accent", accent);
      root.querySelector("#resultPanel").innerHTML = `<span class="result-symbol">${won ? "C" : "M"}</span><div class="eyebrow">${won ? "A civilization endures" : "The chronicle closes"} / ${String(state.turn).padStart(2, "0")} turns</div><h2>${escapeHTML(resolution.title)}</h2><p>${escapeHTML(resolution.description)}</p><div class="result-stats"><div class="result-stat"><strong>${numberText(player.score)}</strong><small>Legacy score</small></div><div class="result-stat"><strong>${cities}</strong><small>Cities held</small></div><div class="result-stat"><strong>${player.techs.length}</strong><small>Discoveries</small></div><div class="result-stat"><strong>${capitals}</strong><small>Capitals taken</small></div></div><div class="result-reward">${rewardText}</div><div class="result-actions"><button class="button-primary" data-action="replay-campaign">Play again <span aria-hidden="true">&#8594;</span></button><button class="button-secondary" data-action="back-to-title">Return to title</button></div>`;
    }

    function modalShell(kicker, title, subtitle, content, footer = "") {
      return `<div class="modal-head"><div><div class="eyebrow">${kicker}</div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="close-button" data-action="close-modal" aria-label="Close">&#215;</button></div><div class="modal-content">${content}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ""}`;
    }

    function openModal(type, data = null) {
      if (!root) return;
      activeModal = type;
      activeModalData = data;
      if (type === "pause") isPaused = true;
      renderModal();
      modalScreen.classList.remove("hidden");
      const close = root.querySelector("#modalPanel .close-button");
      if (close) close.focus({ preventScroll: true });
    }

    function closeModal() {
      activeModal = null;
      activeModalData = null;
      modalScreen.classList.add("hidden");
      if (isPaused) isPaused = false;
    }

    function openManual() {
      openModal("manual");
    }

    function manualContent() {
      const systemRows = [
        ["A small map, a wide world", "The hex grid is the board. Settlers found cities, and each city claims a changing ring of useful terrain. Population, resources, buildings, and tile improvements all change what a city can do."],
        ["Five yields, one decision", "Food grows a city. Production finishes a chosen unit or building. Science researches the 26-node technology tree. Culture writes policies and Great People into your civilization. Trade becomes gold and diplomatic routes."],
        ["The edge of the map moves", "Units move one or two hexes each turn. Click a neighboring hex or a distant reachable destination. Ranged units attack from their printed range. Siege a city, then move a land unit onto its center to capture it."],
        ["Not every border is a war", "Trade pacts bring lasting gold. Alliances guard a border for twelve turns. Declare war from Council, or make peace after two turns of fighting. Camps spawn raiders; a champion joins the wilds on turn 24."],
        ["Choose your own ending", "Domination takes all three rival capitals. Science follows 21 prerequisite discoveries to the Unified Field. Culture needs 720 lifetime culture and three policies. Economy needs 800 gold, three trade routes, and two markets. Otherwise, the leader at turn 56 wins."],
        ["The chronicle remembers", "A victory earns 3-5 Legacy Seals; a long defeat can earn one. Spend them on permanent starting science, treasury, strength, and survey range. Those upgrades persist on this device."],
      ];
      const content = `<div class="manual-grid">${systemRows.map(([title, text]) => `<div class="manual-item"><strong>${title}</strong><p>${text}</p></div>`).join("")}</div><div class="section-kicker" style="margin-top:17px">Controls / pointer, keyboard, touch</div><div class="control-list"><div class="control-row"><span>Select or move to a hex</span><span class="keycap">Click</span></div><div class="control-row"><span>Found a city</span><span class="keycap">F</span></div><div class="control-row"><span>End the turn</span><span class="keycap">Space / E</span></div><div class="control-row"><span>Move selected unit</span><span class="keycap">W A S D / Arrows</span></div><div class="control-row"><span>Research panel</span><span class="keycap">R</span></div><div class="control-row"><span>Field manual</span><span class="keycap">H</span></div><div class="control-row"><span>Pause / resume</span><span class="keycap">Esc</span></div><div class="control-row"><span>Pan / zoom map</span><span class="keycap">Drag / wheel</span></div></div>`;
      return modalShell("Civilization Micro / Field manual", "The field guide", "The world is legible, if you know where to look.", content, `<button class="button-secondary" data-action="close-modal">Close manual</button><button class="button-primary" data-action="restart-tutorial">Start field guide <span aria-hidden="true">&#8594;</span></button>`);
    }

    function settingContent() {
      const difficulty = state ? state.difficulty : selectedDifficulty;
      const volume = Math.round(audio.volume * 100);
      const soundLabel = audio.muted ? "Muted" : "Sound on";
      const difficultyButtons = DIFFICULTIES.map((item) => `<button class="choice-button ${item.id === difficulty ? "selected" : ""}" data-action="set-live-difficulty" data-value="${item.id}">${item.name}</button>`).join("");
      const restartButton = state ? `<button class="button-danger" data-action="restart-to-setup">Restart campaign</button>` : "";
      return `<div class="setting-row"><span class="setting-copy"><strong>World pressure</strong><small>Difficulty changes rival output and strength, plus the rate of raider camps. You can adjust it during a campaign.</small></span><div class="setting-difficulties">${difficultyButtons}</div></div><div class="setting-row"><span class="setting-copy"><strong>Synthesized sound / ${soundLabel}</strong><small>Procedural ambient score and reactive effects, made with the Web Audio API.</small></span><button class="action-button" data-action="toggle-sound">${audio.muted ? "Unmute" : "Mute"}</button></div><div class="setting-row"><span class="setting-copy"><strong>Master volume</strong><small>Ambient music and in-game sound effects.</small></span><input id="volumeControl" class="volume-range" type="range" min="0" max="100" value="${volume}" aria-label="Master volume"></div><div class="setting-row"><span class="setting-copy"><strong>Campaign autosave</strong><small>Every turn is saved locally. Leaving the page will not erase the active chronicle.</small></span><span style="color:#8fb89d;font-size:9px">${state ? "Active" : "Ready"}</span></div><div class="modal-footer"><button class="button-secondary" data-action="close-modal">Return to campaign</button>${restartButton}</div>`;
    }

    function productionContent(city) {
      if (!city) return `<div class="empty-note">Choose one of your cities to manage production.</div>`;
      const player = playerById(city.ownerId);
      const current = BUILD_OPTIONS.find((option) => option.id === city.production?.id);
      const options = BUILD_OPTIONS.map((option) => {
        const missingTech = option.req && !player.techs.includes(option.req);
        const alreadyBuilt = (option.kind === "building" || option.kind === "wonder") && city.buildings.includes(option.id);
        const wonderTaken = option.kind === "wonder" && state.cities.some((other) => other.buildings.includes(option.id));
        const locked = missingTech || alreadyBuilt || wonderTaken;
        let detail = option.desc;
        if (missingTech) detail = `Research ${TECHS.find((tech) => tech.id === option.req)?.name || option.req} first.`;
        else if (alreadyBuilt) detail = "Already built in this city.";
        else if (wonderTaken) detail = "This wonder has been completed elsewhere.";
        return `<button class="production-option" data-action="select-production" data-id="${option.id}" ${locked ? "disabled" : ""}><span class="production-icon">${option.glyph}</span><span class="production-copy"><strong>${escapeHTML(option.name)}</strong><small>${escapeHTML(detail)}</small></span><span class="production-cost">${option.cost} P</span></button>`;
      }).join("");
      const currentText = current ? `${current.name} / ${Math.round(city.production.progress)} of ${current.cost} production` : "Choose a new direction for this city.";
      return `<div class="legacy-title"><span class="identity-seal" style="--identity-color:${player.color};width:31px;height:34px">C</span><span><strong>${escapeHTML(city.name)} / ${city.population} citizens</strong><span>${currentText}</span></span></div><div class="production-grid">${options}</div>`;
    }

    function diplomacyContent(rivalId) {
      const player = humanPlayer();
      const rival = playerById(rivalId);
      if (!rival) return `<div class="empty-note">That civilization has left the council.</div>`;
      const relation = relationBetween(player.id, rival.id);
      const atWar = relation?.status === "war";
      const inAlliance = (relation?.allianceUntil || 0) > state.turn;
      const hasTrade = (relation?.tradeUntil || 0) > state.turn;
      const routeFull = player.tradeRoutes >= routeCapacity(player);
      const tradeAllowed = player.techs.includes("currency") && !atWar && !hasTrade && !routeFull && player.gold >= 60;
      const allianceAllowed = !atWar && !inAlliance && (relation?.friendship || 0) >= 8 && player.gold >= 100;
      const peaceAllowed = atWar && (relation?.warTurns || 0) >= 2 && player.gold >= 40;
      const offers = atWar ? `<button class="deal-option" data-action="diplomatic-deal" data-id="peace" ${peaceAllowed ? "" : "disabled"}><span><strong>Sign a ceasefire</strong><small>Peace is possible after two turns of war.</small></span><span class="deal-price">40 gold</span></button><button class="deal-option" data-action="diplomatic-deal" data-id="war" disabled><span><strong>War declared</strong><small>The front remains active.</small></span><span class="deal-price">${relation?.warTurns || 0} turns</span></button>` : `<button class="deal-option" data-action="diplomatic-deal" data-id="trade" ${tradeAllowed ? "" : "disabled"}><span><strong>${hasTrade ? "Trade pact active" : "Open a trade route"}</strong><small>${!player.techs.includes("currency") ? "Requires Currency." : routeFull ? "Your route capacity is full." : "A 12-turn pact earns 5 gold each turn."}</small></span><span class="deal-price">60 gold</span></button><button class="deal-option" data-action="diplomatic-deal" data-id="alliance" ${allianceAllowed ? "" : "disabled"}><span><strong>${inAlliance ? "Alliance active" : "Propose an alliance"}</strong><small>Needs warm relations. Protects this border for 12 turns.</small></span><span class="deal-price">100 gold</span></button><button class="deal-option" data-action="diplomatic-deal" data-id="gift" ${player.gold >= 50 ? "" : "disabled"}><span><strong>Send a diplomatic gift</strong><small>Improve relations by 15; may pave the way to an alliance.</small></span><span class="deal-price">50 gold</span></button><button class="deal-option" data-action="diplomatic-deal" data-id="war"><span><strong>Declare war</strong><small>Open hostility. Their armies may now cross your borders.</small></span><span class="deal-price">No return</span></button>`;
      return `<div class="diplomacy-banner"><span class="diplomacy-seal" style="--diplomacy-color:${rival.color}">${rival.sigil}</span><span><h3>${escapeHTML(rival.name)}</h3><p>${escapeHTML(rival.leader)} / ${escapeHTML(relationDescription(player, rival))} / ${citiesFor(rival.id).length} cities</p></span></div><div class="modal-body-copy">A treaty is only as strong as the civilization that stands behind it. Rival diplomacy reacts to your borders, and war consumes movement every turn.</div><div class="deal-list">${offers}</div>`;
    }

    function policyContent() {
      const player = humanPlayer();
      const options = POLICIES.filter((policy) => !player.policies.includes(policy.id));
      return `<div class="modal-body-copy">Choose one permanent doctrine. Its effects begin immediately and remain active for the rest of the campaign.</div><div class="deal-list">${options.map((policy) => `<button class="deal-option" data-action="choose-policy" data-id="${policy.id}"><span><strong>${policy.glyph} / ${policy.name}</strong><small>${policy.desc}</small></span><span class="deal-price">Adopt</span></button>`).join("")}</div>`;
    }

    function greatPersonContent() {
      const player = humanPlayer();
      return `<div class="modal-body-copy">One extraordinary person is ready to serve. Choose how their life changes the civilization; this choice cannot be undone.</div><div class="deal-list"><button class="deal-option" data-action="great-person" data-id="scientist"><span><strong>Great Scientist</strong><small>+160 insight. Completes research if enough science remains.</small></span><span class="deal-price">Research</span></button><button class="deal-option" data-action="great-person" data-id="merchant"><span><strong>Great Merchant</strong><small>+230 gold and one active trade route, if capacity allows.</small></span><span class="deal-price">Commerce</span></button><button class="deal-option" data-action="great-person" data-id="general"><span><strong>Great General</strong><small>Heal field units and grant +6 strength for seven turns.</small></span><span class="deal-price">Command</span></button><button class="deal-option" data-action="great-person" data-id="writer"><span><strong>Great Writer</strong><small>+260 lifetime culture. Help the civic victory and unlock policies.</small></span><span class="deal-price">Culture</span></button></div><div class="modal-body-copy" style="margin-top:12px">People remaining: ${player.greatPeople} / progress ${Math.round(player.greatProgress)} of 110.</div>`;
    }

    function legacyContent() {
      const upgrades = UPGRADE_DEFS.map((upgrade) => {
        const level = Math.max(0, Number(meta.upgrades[upgrade.id]) || 0);
        const cost = upgrade.costs[level];
        const maxed = level >= upgrade.costs.length;
        return `<div class="legacy-upgrade"><span class="legacy-icon">${upgrade.glyph}</span><span class="legacy-copy"><strong>${upgrade.name} / ${level} of ${upgrade.costs.length}</strong><small>${upgrade.desc}</small><em>${upgrade.effect}${maxed ? " / fully established" : ` / next charter costs ${cost} seals`}</em></span><button class="legacy-buy" data-action="buy-upgrade" data-id="${upgrade.id}" ${maxed || meta.legacy < cost ? "disabled" : ""}>${maxed ? "Complete" : "Invest"}</button></div>`;
      }).join("");
      const records = `<div class="yield-row"><span>Campaigns recorded</span><strong>${Number(meta.records.games) || 0}</strong></div><div class="yield-row"><span>Victories</span><strong>${Number(meta.records.victories) || 0}</strong></div><div class="yield-row"><span>Best legacy score</span><strong>${numberText(meta.records.bestScore)}</strong></div>`;
      return `<div class="legacy-title"><span class="legacy-count">${meta.legacy}</span><span><strong>Legacy seals</strong><span>Earned through victory and endurance. Persistent on this device.</span></span></div><div class="section-kicker" style="margin-top:19px">Permanent charters</div>${upgrades}<div class="section-kicker" style="margin-top:21px">The campaign archive</div>${records}<div class="modal-body-copy" style="margin-top:12px">A lost campaign that lasts ten turns can earn one seal. A victory awards more on higher difficulty. No combat or research progress is ever bought here; only a stronger first step.</div>`;
    }

    function renderModal() {
      let markup = "";
      if (activeModal === "manual") {
        root.querySelector("#modalPanel").innerHTML = manualContent();
        return;
      }
      if (activeModal === "settings") {
        markup = modalShell("Campaign settings", "Calibrate the expedition", "Audio, world pressure, and local save settings.", settingContent());
      } else if (activeModal === "pause") {
        markup = modalShell("The chronicle rests", "Pause the campaign", "Your world is safely held at the end of this decision.", `<div class="manual-grid"><div class="manual-item"><strong>While paused</strong><p>City growth, armies, raiders, and diplomacy wait. Your last choice is autosaved locally.</p></div><div class="manual-item"><strong>Resume anytime</strong><p>Settings and the field manual remain available without taking a turn.</p></div></div>`, `<button class="button-secondary" data-action="open-settings">Settings</button><button class="button-primary" data-action="resume-game-play">Resume campaign</button>`);
      } else if (activeModal === "production") {
        markup = modalShell("City council", "Direct the next project", "Production changes with population, terrain, buildings, and public policy.", productionContent(activeModalData));
      } else if (activeModal === "diplomacy") {
        const rival = playerById(activeModalData);
        markup = modalShell("World council", "A conversation across borders", "Offers affect route income, trust, and whether an army can cross a frontier.", diplomacyContent(activeModalData));
      } else if (activeModal === "policy") {
        markup = modalShell("Civic tradition", "Write a new doctrine", "Culture is more than a score. It changes how a civilization works.", policyContent());
      } else if (activeModal === "great-person") {
        markup = modalShell("An extraordinary life", "Choose a lasting contribution", "A Great Person makes one decisive contribution, then joins the chronicle.", greatPersonContent());
      } else if (activeModal === "legacy") {
        markup = modalShell("Progress between campaigns", "The Founders' legacy", "Permanent upgrades persist between campaigns. They do not buy a victory; they make every first decision more interesting.", legacyContent());
      }
      root.querySelector("#modalPanel").innerHTML = markup;
    }

    function openProduction(city = selectedCity()) {
      if (!city || city.ownerId !== state.playerId) return;
      state.selected = { kind: "city", id: city.id };
      openModal("production", city);
    }

    function pauseGame() {
      if (!state || state.winnerId) return;
      if (activeModal === "pause") { closeModal(); return; }
      if (activeModal) closeModal();
      openModal("pause");
    }

    function switchTab(tab) {
      if (!state || !["empire", "research", "council"].includes(tab)) return;
      state.activeTab = tab;
      renderRightPanel();
      if (tab === "research") audio.sound("select");
    }

    function buyUpgrade(upgradeId) {
      const upgrade = UPGRADE_DEFS.find((item) => item.id === upgradeId);
      if (!upgrade) return;
      const level = Math.max(0, Number(meta.upgrades[upgrade.id]) || 0);
      const cost = upgrade.costs[level];
      if (cost === undefined || meta.legacy < cost) return;
      meta.legacy -= cost;
      meta.upgrades[upgrade.id] = level + 1;
      persistMeta();
      audio.sound("coin");
      toast(`${upgrade.name} / charter level ${level + 1} recorded.`);
      if (state && !state.winnerId) {
        state.units.filter((unit) => unit.ownerId === state.playerId).forEach((unit) => { unit.strength += upgrade.id === "standard" ? 2 : 0; });
        if (upgrade.id === "archive") state.players.find((player) => player.isHuman).rates = calculateRates(humanPlayer());
      }
      renderModal();
      if (state) renderUI();
    }

    function setLiveDifficulty(id) {
      const difficulty = difficultyById(id);
      if (state) {
        state.difficulty = difficulty.id;
        addEvent(`World pressure changes to ${difficulty.name}. Rival output and raider activity adjust immediately.`, "gold");
        toast(`Difficulty set to ${difficulty.name}. Changes apply from this turn onward.`);
        state.players.forEach((player) => { player.rates = calculateRates(player); });
        renderUI();
        saveCampaign();
      } else {
        selectedDifficulty = difficulty.id;
        renderSetupChoices();
      }
      if (activeModal === "settings") renderModal();
    }

    function restartTutorial() {
      closeModal();
      if (!state) { openSetup(); return; }
      state.tutorialStep = 0;
      state.tutorialComplete = false;
      const settler = unitsFor(state.playerId).find((unit) => unit.type === "settler");
      if (settler) state.selected = { kind: "unit", id: settler.id };
      renderUI();
      saveCampaign();
      toast("Field guide restarted. Follow each objective in order.");
    }

    function openDiplomacy(rivalId) {
      openModal("diplomacy", rivalId);
    }

    function clickAction(action, value, id) {
      if (!action) return;
      if (action === "open-setup") openSetup();
      else if (action === "close-setup") showScreen("title");
      else if (action === "choose-civ") { selectedCiv = value; renderSetupChoices(); audio.sound("select"); }
      else if (action === "choose-difficulty") { selectedDifficulty = value; renderSetupChoices(); audio.sound("select"); }
      else if (action === "start-campaign") beginCampaign();
      else if (action === "resume-game") loadSavedCampaign();
      else if (action === "resume-game-play") { closeModal(); }
      else if (action === "open-manual") openManual();
      else if (action === "open-legacy") openModal("legacy");
      else if (action === "close-modal") closeModal();
      else if (action === "open-settings") openModal("settings");
      else if (action === "pause-game") pauseGame();
      else if (action === "toggle-sound") { audio.setMuted(!audio.muted); if (!audio.muted) audio.unlock(); if (activeModal === "settings") renderModal(); if (state) renderHeader(); audio.sound("click"); }
      else if (action === "set-live-difficulty") setLiveDifficulty(value);
      else if (action === "set-tab") switchTab(value);
      else if (action === "research-tech") { chooseResearch(humanPlayer(), id); }
      else if (action === "clear-research") { const player = humanPlayer(); if (player.research) { player.researchBank = player.researchProgress; player.research = null; player.researchProgress = 0; renderUI(); saveCampaign(); } }
      else if (action === "end-turn") endTurn();
      else if (action === "found-city") foundCity();
      else if (action === "build-improvement") buildImprovement(humanSelectedUnit(), value);
      else if (action === "fortify-unit") fortifyUnit(humanSelectedUnit());
      else if (action === "rest-unit") restUnit(humanSelectedUnit());
      else if (action === "strike-camp") strikeCamp(humanSelectedUnit());
      else if (action === "select-city") {
        const city = cityById(id);
        if (city && city.ownerId === state.playerId) { state.selected = { kind: "city", id: city.id }; state.selectedTile = tileKey(city.q, city.r); renderUI(); audio.sound("select"); }
      }
      else if (action === "choose-production") openProduction();
      else if (action === "select-production") chooseProduction(activeModalData, id);
      else if (action === "rush-production") { const city = selectedCity(); if (city) rushProduction(city); }
      else if (action === "repair-city") { const city = selectedCity(); if (city) repairCity(city); }
      else if (action === "open-policy") openModal("policy");
      else if (action === "choose-policy") choosePolicy(id);
      else if (action === "open-great-person") openModal("great-person");
      else if (action === "great-person") activateGreatPerson(id);
      else if (action === "open-diplomacy") openDiplomacy(id);
      else if (action === "diplomatic-deal") establishDeal(activeModalData, id);
      else if (action === "restart-tutorial") restartTutorial();
      else if (action === "skip-tutorial") { state.tutorialStep = -1; state.tutorialComplete = true; renderUI(); saveCampaign(); toast("Field guide dismissed. Press H for the manual."); }
      else if (action === "buy-upgrade") buyUpgrade(id);
      else if (action === "zoom-in") { camera.zoom = clamp(camera.zoom * 1.12, 0.65, 1.65); drawWorld(); }
      else if (action === "zoom-out") { camera.zoom = clamp(camera.zoom / 1.12, 0.65, 1.65); drawWorld(); }
      else if (action === "restart-to-setup") { closeModal(); state = null; try { window.localStorage.removeItem(SAVE_KEY); } catch {} selectedCiv = meta.records.lastCiv || selectedCiv; showScreen("setup"); }
      else if (action === "replay-campaign") { resultScreen.classList.add("hidden"); state = null; selectedCiv = meta.records.lastCiv || selectedCiv; selectedDifficulty = "regent"; showScreen("setup"); }
      else if (action === "back-to-title") { resultScreen.classList.add("hidden"); state = null; showScreen("title"); }
      else if (action === "restart-game") { state = null; beginCampaign(); }
      else if (action === "open-diplomacy-tab") switchTab("council");
    }

    root.addEventListener("click", (event) => {
      const actionElement = event.target.closest("[data-action]");
      if (actionElement) {
        if (actionElement.disabled) return;
        const action = actionElement.dataset.action;
        const value = actionElement.dataset.value;
        const id = actionElement.dataset.id;
        if (action === "diplomatic-deal" || action === "open-diplomacy") audio.unlock();
        if (["start-campaign", "found-city", "end-turn", "resume-game", "great-person"].includes(action)) audio.unlock();
        clickAction(action, value, id);
        return;
      }
      if (event.target === modalScreen) closeModal();
    });

    root.addEventListener("input", (event) => {
      if (event.target?.id === "volumeControl") {
        audio.setVolume(Number(event.target.value) / 100);
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target?.id === "volumeControl") {
        audio.setVolume(Number(event.target.value) / 100);
      }
    });

    root.addEventListener("wheel", (event) => {
      if (event.target === worldCanvas || mapFrame.contains(event.target)) {
        event.preventDefault();
        camera.zoom = clamp(camera.zoom * (event.deltaY < 0 ? 1.08 : 0.925), 0.65, 1.65);
        drawWorld();
      }
    }, { passive: false });

    worldCanvas.addEventListener("pointerdown", (event) => {
      if (!state || currentScreen !== "game" || isPaused || activeModal) return;
      worldCanvas.setPointerCapture(event.pointerId);
      camera.dragging = true;
      camera.pointerId = event.pointerId;
      camera.downX = event.clientX;
      camera.downY = event.clientY;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      camera.moved = false;
    });

    worldCanvas.addEventListener("pointermove", (event) => {
      if (!camera.dragging || camera.pointerId !== event.pointerId) return;
      const dx = event.clientX - camera.lastX;
      const dy = event.clientY - camera.lastY;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      if (Math.abs(event.clientX - camera.downX) + Math.abs(event.clientY - camera.downY) > 7) camera.moved = true;
      if (camera.moved) {
        camera.x -= dx / camera.zoom;
        camera.y -= dy / camera.zoom;
        drawWorld();
      }
    });

    worldCanvas.addEventListener("pointerup", (event) => {
      if (camera.pointerId !== event.pointerId) return;
      const dragged = camera.moved;
      camera.dragging = false;
      camera.pointerId = null;
      if (!dragged && state && currentScreen === "game" && !isPaused && !activeModal) {
        const rect = worldCanvas.getBoundingClientRect();
        const tile = tileFromPoint(event.clientX - rect.left, event.clientY - rect.top);
        if (tile) selectTileAt(tile);
      }
    });

    worldCanvas.addEventListener("pointercancel", () => { camera.dragging = false; camera.pointerId = null; });

    function moveSelectedBy(dq, dr) {
      const unit = humanSelectedUnit();
      if (!unit || unit.moves <= 0) return;
      const tile = tileAt(unit.q + dq, unit.r + dr);
      if (!tile) return;
      selectTileAt(tile);
    }

    function onKeyDown(event) {
      if (!state || currentScreen !== "game") return;
      if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        event.preventDefault();
        if (activeModal && activeModal !== "pause") closeModal();
        else pauseGame();
        return;
      }
      if (activeModal || isPaused || state.winnerId) return;
      if (key === " " || key === "e") { event.preventDefault(); endTurn(); }
      else if (key === "f") { event.preventDefault(); if (humanSelectedUnit()?.type === "settler") foundCity(); }
      else if (key === "r") { event.preventDefault(); switchTab("research"); }
      else if (key === "h") { event.preventDefault(); openManual(); }
      else if (key === "1") switchTab("empire");
      else if (key === "2") switchTab("research");
      else if (key === "3") switchTab("council");
      else if (key === "arrowright" || key === "d") { event.preventDefault(); moveSelectedBy(1, 0); }
      else if (key === "arrowleft" || key === "a") { event.preventDefault(); moveSelectedBy(-1, 0); }
      else if (key === "arrowup" || key === "w") { event.preventDefault(); moveSelectedBy(0, -1); }
      else if (key === "arrowdown" || key === "s") { event.preventDefault(); moveSelectedBy(0, 1); }
    }

    document.addEventListener("keydown", onKeyDown);
    const onBlur = () => {
      if (state && currentScreen === "game" && !state.winnerId && !activeModal) {
        isPaused = true;
        openModal("pause");
      }
    };
    const onVisibilityChange = () => { if (document.hidden) onBlur(); };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    function resizeCanvas() {
      if (!worldCanvas) return;
      const rect = mapFrame.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (worldCanvas.width !== Math.round(width * dpr) || worldCanvas.height !== Math.round(height * dpr)) {
        worldCanvas.width = Math.round(width * dpr);
        worldCanvas.height = Math.round(height * dpr);
      }
      mapMetrics.width = width;
      mapMetrics.height = height;
      mapMetrics.dpr = dpr;
      mapMetrics.centerX = width / 2;
      mapMetrics.centerY = height / 2 + 4;
      const radiusWidth = width / (Math.sqrt(3) * (MAP_RADIUS * 2 + 2));
      const radiusHeight = height / (1.5 * (MAP_RADIUS * 2 + 2));
      mapMetrics.radius = Math.max(12, Math.min(34, radiusWidth, radiusHeight));
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWorld();
    }

    function resizeTitleCanvas() {
      const rect = root.querySelector(".title-art").getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      titleCanvas.width = Math.round(rect.width * dpr);
      titleCanvas.height = Math.round(rect.height * dpr);
      titleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTitleCanvas(time);
    }

    function axialPixel(q, r, radius) {
      return { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r };
    }

    function hexToScreen(q, r) {
      const point = axialPixel(q, r, mapMetrics.radius);
      return {
        x: mapMetrics.centerX + (point.x - camera.x) * camera.zoom + (camera.renderShakeX || 0),
        y: mapMetrics.centerY + (point.y - camera.y) * camera.zoom + (camera.renderShakeY || 0),
      };
    }

    function hexVertices(x, y, radius) {
      const vertices = [];
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 180) * (60 * index - 30);
        vertices.push({ x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) });
      }
      return vertices;
    }

    function drawHexPath(context, x, y, radius) {
      const vertices = hexVertices(x, y, radius);
      context.beginPath();
      context.moveTo(vertices[0].x, vertices[0].y);
      for (let index = 1; index < vertices.length; index += 1) context.lineTo(vertices[index].x, vertices[index].y);
      context.closePath();
    }

    function pointInHex(x, y, cx, cy, radius) {
      const vertices = hexVertices(cx, cy, radius);
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const a = vertices[i];
        const b = vertices[j];
        const crosses = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1) + a.x;
        if (crosses) inside = !inside;
      }
      return inside;
    }

    function tileFromPoint(x, y) {
      if (!state) return null;
      let nearest = null;
      let nearestDistance = Infinity;
      const radius = mapMetrics.radius * camera.zoom;
      for (const tile of state.tiles) {
        const point = hexToScreen(tile.q, tile.r);
        const dx = x - point.x;
        const dy = y - point.y;
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance && distance <= radius * radius * 1.5 && pointInHex(x, y, point.x, point.y, radius * 0.99)) {
          nearest = tile;
          nearestDistance = distance;
        }
      }
      return nearest;
    }

    function rgba(hex, alpha) {
      const value = String(hex).replace("#", "");
      const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
      const parsed = Number.parseInt(normalized, 16);
      return `rgba(${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}, ${alpha})`;
    }

    function drawTileTexture(tile, x, y, radius) {
      const alpha = tile.visible ? 1 : 0.55;
      const seed = tile.seed || 0;
      if (tile.terrain === "water") {
        const shift = (time * (tile.seed > 0.5 ? 11 : -9)) % (radius * 1.7);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - radius * 0.8, y - radius * 0.7, radius * 1.6, radius * 1.4);
        ctx.clip();
        for (let i = -1; i < 3; i += 1) {
          const waveY = y - radius * 0.3 + i * radius * 0.45;
          ctx.beginPath();
          ctx.moveTo(x - radius + shift - i * 4, waveY);
          ctx.quadraticCurveTo(x - radius * 0.3 + shift, waveY - 3 * alpha, x + radius * 0.2 + shift, waveY);
          ctx.quadraticCurveTo(x + radius * 0.55 + shift, waveY + 3 * alpha, x + radius + shift, waveY);
          ctx.strokeStyle = `rgba(119, 178, 184, ${0.15 * alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      } else if (tile.terrain === "forest") {
        for (let index = 0; index < 3; index += 1) {
          const offsetX = (index - 1) * radius * 0.43 + (seed - 0.5) * radius * 0.12;
          const offsetY = (index % 2 ? 0.1 : -0.13) * radius;
          const size = radius * (0.36 + ((seed * 17 + index) % 0.2));
          ctx.fillStyle = index % 2 ? rgba("#27463f", 0.55 * alpha) : rgba("#769078", 0.38 * alpha);
          ctx.beginPath();
          ctx.moveTo(x + offsetX, y + offsetY - size);
          ctx.lineTo(x + offsetX - size * 0.58, y + offsetY + size * 0.35);
          ctx.lineTo(x + offsetX + size * 0.58, y + offsetY + size * 0.35);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = rgba("#b49a6b", 0.23 * alpha);
          ctx.fillRect(x + offsetX - 0.7, y + offsetY + size * 0.19, 1.4, size * 0.22);
        }
      } else if (tile.terrain === "mountain") {
        const peakX = x + (seed - 0.5) * radius * 0.28;
        const peakY = y - radius * 0.3;
        ctx.fillStyle = rgba("#3b4848", 0.72 * alpha);
        ctx.beginPath();
        ctx.moveTo(x - radius * 0.67, y + radius * 0.4);
        ctx.lineTo(peakX, peakY - radius * 0.2);
        ctx.lineTo(x + radius * 0.7, y + radius * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba("#c9c6b2", 0.55 * alpha);
        ctx.beginPath();
        ctx.moveTo(peakX, peakY - radius * 0.2);
        ctx.lineTo(peakX - radius * 0.24, peakY + radius * 0.24);
        ctx.lineTo(peakX + radius * 0.06, peakY + radius * 0.14);
        ctx.lineTo(peakX + radius * 0.29, peakY + radius * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba("#ece4cf", 0.24 * alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(peakX, peakY - radius * 0.2);
        ctx.lineTo(peakX + radius * 0.29, peakY + radius * 0.3);
        ctx.stroke();
      } else if (tile.terrain === "hills") {
        for (let index = 0; index < 3; index += 1) {
          const dx = (index - 1) * radius * 0.42;
          const dy = index % 2 ? radius * 0.12 : -radius * 0.12;
          ctx.beginPath();
          ctx.ellipse(x + dx, y + dy, radius * 0.34, radius * 0.17, -0.2, 0, PI2);
          ctx.fillStyle = rgba(index === 1 ? "#adb08f" : "#53685b", 0.38 * alpha);
          ctx.fill();
          ctx.strokeStyle = rgba("#d5c99b", 0.2 * alpha);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      } else if (tile.terrain === "desert") {
        for (let index = 0; index < 5; index += 1) {
          const dx = (((seed * 29 + index * 13) % 1) - 0.5) * radius * 1.35;
          const dy = (((seed * 17 + index * 23) % 1) - 0.5) * radius * 1.15;
          ctx.fillStyle = rgba("#e3c890", 0.29 * alpha);
          ctx.fillRect(x + dx, y + dy, 1.3, 1.3);
        }
      } else {
        ctx.strokeStyle = rgba(tile.terrain === "grass" ? "#bed09b" : "#e2c28b", 0.18 * alpha);
        ctx.lineWidth = 1;
        for (let index = 0; index < 3; index += 1) {
          const dx = (index - 1) * radius * 0.27;
          const baseY = y + radius * 0.3;
          ctx.beginPath();
          ctx.moveTo(x + dx, baseY);
          ctx.quadraticCurveTo(x + dx + 3, baseY - radius * 0.28, x + dx + (seed - 0.5) * 7, baseY - radius * 0.48);
          ctx.stroke();
        }
      }
    }

    function drawTile(tile, radius) {
      const point = hexToScreen(tile.q, tile.r);
      const x = point.x;
      const y = point.y;
      if (x < -radius * 2 || x > mapMetrics.width + radius * 2 || y < -radius * 2 || y > mapMetrics.height + radius * 2) return;
      const isKnown = tile.explored || tile.visible;
      const terrain = TERRAIN[tile.terrain];
      ctx.save();
      drawHexPath(ctx, x, y + radius * 0.13, radius * 0.99);
      ctx.fillStyle = isKnown ? "rgba(6,12,14,.52)" : "rgba(4,9,12,.45)";
      ctx.fill();
      drawHexPath(ctx, x, y, radius * 0.97);
      const tint = isKnown ? terrain.color : "#1a2528";
      const gradient = ctx.createLinearGradient(x - radius * 0.5, y - radius, x + radius * 0.35, y + radius);
      gradient.addColorStop(0, isKnown ? rgba("#e2ddc0", tile.terrain === "water" ? 0.11 : 0.09) : "#20292a");
      gradient.addColorStop(1, rgba(tint, 1));
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = isKnown ? "rgba(226,224,198,.17)" : "rgba(182,195,176,.075)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!isKnown) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + (tile.seed - 0.5) * radius * 0.4, y, 1, 0, PI2);
        ctx.fillStyle = "rgba(215,218,192,.16)";
        ctx.fill();
        ctx.restore();
        ctx.restore();
        return;
      }
      drawTileTexture(tile, x, y, radius);
      const owner = territoryOwner(tile);
      if (owner) {
        ctx.save();
        drawHexPath(ctx, x, y, radius * 0.94);
        ctx.fillStyle = rgba(owner.color, tile.visible ? 0.08 : 0.035);
        ctx.fill();
        ctx.strokeStyle = rgba(owner.color, tile.visible ? 0.54 : 0.3);
        ctx.lineWidth = state.selectedTile === tile.key ? 1.2 : 0.8;
        ctx.stroke();
        ctx.restore();
      }
      if (tile.improvement) {
        const improvement = IMPROVEMENTS[tile.improvement];
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + radius * 0.43, y + radius * 0.35, radius * 0.2, 0, PI2);
        ctx.fillStyle = "rgba(20,30,29,.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(226,213,180,.5)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.fillStyle = "#e8d28c";
        ctx.font = `700 ${Math.max(7, radius * 0.2)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(improvement.glyph, x + radius * 0.43, y + radius * 0.35 + 0.5);
        ctx.restore();
      }
      if (tile.resource && tile.visible) {
        const resourceColor = tile.resource === "Iron" ? "#d5d2c0" : tile.resource === "Gems" ? "#b6a4d4" : tile.resource === "Horses" ? "#ddb77b" : tile.resource === "Fish" ? "#9bd0d0" : "#d9ca88";
        ctx.beginPath();
        ctx.arc(x - radius * 0.42, y + radius * 0.38, radius * 0.12, 0, PI2);
        ctx.fillStyle = resourceColor;
        ctx.shadowColor = resourceColor;
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (tile.ruin && tile.visible) {
        const twinkle = 0.65 + Math.sin(time * 3 + tile.seed * 6) * 0.2;
        ctx.save();
        ctx.translate(x + radius * 0.1, y - radius * 0.27);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = `rgba(240,211,137,${twinkle})`;
        ctx.lineWidth = 1.1;
        ctx.strokeRect(-radius * 0.11, -radius * 0.11, radius * 0.22, radius * 0.22);
        ctx.restore();
      }
      if (tile.camp && tile.explored) {
        const camp = state.camps.find((candidate) => candidate.q === tile.q && candidate.r === tile.r);
        if (camp) {
          ctx.save();
          const flicker = 0.85 + Math.sin(time * 8 + tile.seed * 11) * 0.13;
          ctx.fillStyle = "rgba(25,22,20,.82)";
          ctx.beginPath();
          ctx.arc(x, y + radius * 0.2, radius * 0.36, 0, PI2);
          ctx.fill();
          ctx.fillStyle = `rgba(224,123,84,${flicker})`;
          ctx.beginPath();
          ctx.moveTo(x, y - radius * 0.34);
          ctx.quadraticCurveTo(x + radius * 0.39, y + radius * 0.1, x, y + radius * 0.12);
          ctx.quadraticCurveTo(x - radius * 0.29, y + radius * 0.03, x, y - radius * 0.34);
          ctx.fill();
          ctx.fillStyle = "#f4d48a";
          ctx.beginPath();
          ctx.arc(x, y + radius * 0.01, radius * 0.08, 0, PI2);
          ctx.fill();
          ctx.restore();
        }
      }
      if (!tile.visible) {
        ctx.save();
        drawHexPath(ctx, x, y, radius * 0.97);
        ctx.fillStyle = "rgba(5,10,13,.42)";
        ctx.fill();
        ctx.restore();
      }
      if (state.selectedTile === tile.key) {
        ctx.save();
        drawHexPath(ctx, x, y, radius * 0.93);
        ctx.strokeStyle = "#f1d68d";
        ctx.shadowColor = "rgba(240,210,133,.5)";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    function drawCity(city, radius) {
      const tile = tileAt(city.q, city.r);
      if (!tile || (!tile.visible && city.ownerId !== state.playerId)) return;
      const owner = playerById(city.ownerId);
      const color = owner?.color || "#d8b96e";
      const point = hexToScreen(city.q, city.r);
      const x = point.x;
      const y = point.y;
      const scale = clamp(radius / 28, 0.62, 1.12);
      ctx.save();
      ctx.globalAlpha = tile.visible ? 1 : 0.58;
      ctx.shadowColor = rgba(color, 0.75);
      ctx.shadowBlur = city.capital ? 10 : 5;
      ctx.fillStyle = "rgba(20,29,29,.93)";
      ctx.beginPath();
      ctx.arc(x, y, 12 * scale, 0, PI2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = city.capital ? 2 : 1.3;
      ctx.beginPath();
      ctx.arc(x, y, 11.5 * scale, 0, PI2);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.18);
      ctx.beginPath();
      ctx.arc(x, y, 8.5 * scale, 0, PI2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 6 * scale, y + 3 * scale);
      ctx.lineTo(x - 6 * scale, y - 1 * scale);
      ctx.lineTo(x - 2 * scale, y - 1 * scale);
      ctx.lineTo(x - 2 * scale, y - 5 * scale);
      ctx.lineTo(x + 2 * scale, y - 5 * scale);
      ctx.lineTo(x + 2 * scale, y - 1 * scale);
      ctx.lineTo(x + 6 * scale, y - 1 * scale);
      ctx.lineTo(x + 6 * scale, y + 3 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e6dbc0";
      ctx.fillRect(x - 1 * scale, y + 0.5 * scale, 2 * scale, 2.5 * scale);
      if (city.capital) {
        ctx.fillStyle = "#f1d48b";
        ctx.font = `700 ${7 * scale}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText("*", x + 9 * scale, y - 9 * scale);
      }
      const labelWidth = Math.max(40, ctx.measureText(city.name).width + 16);
      ctx.font = `600 ${Math.max(8, 9 * scale)}px Arial`;
      const measured = ctx.measureText(city.name).width;
      const boxWidth = Math.min(radius * 2.4, measured + 15 * scale);
      const labelY = y + radius * 0.63;
      ctx.fillStyle = "rgba(15,23,25,.9)";
      ctx.fillRect(x - boxWidth / 2, labelY - 5 * scale, boxWidth, 12 * scale);
      ctx.fillStyle = city.ownerId === state.playerId ? "#f1e5c4" : "#d5d2c4";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(city.name, x, labelY + 1 * scale, boxWidth - 5);
      const barW = 23 * scale;
      ctx.fillStyle = "rgba(9,13,14,.9)";
      ctx.fillRect(x - barW / 2, labelY + 8 * scale, barW, 2.5 * scale);
      ctx.fillStyle = city.health < city.maxHealth * 0.4 ? "#cf7770" : "#8eb894";
      ctx.fillRect(x - barW / 2, labelY + 8 * scale, barW * clamp(city.health / city.maxHealth, 0, 1), 2.5 * scale);
      ctx.restore();
    }

    function drawUnits(radius) {
      if (!state) return;
      const visibleUnits = state.units.filter((unit) => {
        const tile = tileAt(unit.q, unit.r);
        return tile && tile.visible;
      });
      const groups = new Map();
      visibleUnits.forEach((unit) => {
        const key = tileKey(unit.q, unit.r);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(unit);
      });
      visibleUnits.forEach((unit) => {
        const owner = playerById(unit.ownerId);
        const color = owner?.color || (unit.boss ? "#df7668" : "#da866a");
        const position = hexToScreen(unit.q, unit.r);
        const stack = groups.get(tileKey(unit.q, unit.r)) || [];
        const stackIndex = stack.indexOf(unit);
        const angle = (stackIndex / Math.max(1, stack.length)) * PI2 - Math.PI / 2;
        const offset = stack.length > 1 ? Math.min(radius * 0.25, stackIndex * radius * 0.06) : 0;
        const x = position.x + Math.cos(angle) * offset;
        const y = position.y - radius * 0.02 + Math.sin(angle) * offset;
        const size = (unit.boss ? 13.5 : 10.8) * clamp(radius / 28, 0.62, 1.14);
        const selected = state.selected?.kind === "unit" && state.selected.id === unit.id;
        ctx.save();
        if (selected) {
          ctx.beginPath();
          ctx.arc(x, y, size + 4 + Math.sin(time * 4) * 0.8, 0, PI2);
          ctx.strokeStyle = "#f2d991";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "rgba(242,217,145,.55)";
          ctx.shadowBlur = 9;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = "rgba(16,24,26,.97)";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, PI2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = unit.boss ? 2 : 1.3;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `700 ${size * 0.92}px Georgia`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(UNIT_DEFS[unit.type]?.glyph || "?", x, y + 0.5);
        const healthWidth = size * 1.9;
        ctx.fillStyle = "rgba(10,14,15,.86)";
        ctx.fillRect(x - healthWidth / 2, y + size + 2, healthWidth, 2.3);
        ctx.fillStyle = unit.health / unit.maxHealth < 0.35 ? "#d37a6e" : "#94bb91";
        ctx.fillRect(x - healthWidth / 2, y + size + 2, healthWidth * clamp(unit.health / unit.maxHealth, 0, 1), 2.3);
        ctx.restore();
      });
    }

    function drawMovementReach(radius) {
      const unit = humanSelectedUnit();
      if (!unit || unit.moves <= 0 || unit.strength <= 0) return;
      for (const tile of state.tiles) {
        const distance = hexDistance(unit, tile);
        if (distance > unit.moves || !passable(tile) || !tile.visible) continue;
        if (unit.q === tile.q && unit.r === tile.r) continue;
        const occupied = unitOnTile(tile.q, tile.r, unit.id);
        if (occupied && occupied.ownerId === unit.ownerId) continue;
        const point = hexToScreen(tile.q, tile.r);
        ctx.save();
        drawHexPath(ctx, point.x, point.y, radius * 0.87);
        ctx.fillStyle = "rgba(234,211,147,.075)";
        ctx.fill();
        ctx.strokeStyle = "rgba(234,211,147,.24)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawEffects() {
      particles.forEach((particle) => {
        const alpha = clamp(particle.life / particle.total, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.45 + alpha * 0.55), 0, PI2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      floatingTexts.forEach((floating) => {
        const progress = 1 - floating.life / floating.total;
        ctx.globalAlpha = clamp(floating.life / floating.total, 0, 1);
        ctx.fillStyle = floating.color;
        ctx.font = `700 ${floating.text.length > 18 ? 9 : 11}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,.9)";
        ctx.shadowBlur = 5;
        ctx.fillText(floating.text, floating.x, floating.y - progress * 24);
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    function drawWorld() {
      if (!ctx || !worldCanvas || mapMetrics.width <= 0 || mapMetrics.height <= 0) return;
      ctx.setTransform(mapMetrics.dpr, 0, 0, mapMetrics.dpr, 0, 0);
      ctx.clearRect(0, 0, mapMetrics.width, mapMetrics.height);
      const background = ctx.createRadialGradient(mapMetrics.centerX, mapMetrics.centerY, 15, mapMetrics.centerX, mapMetrics.centerY, Math.max(mapMetrics.width, mapMetrics.height) * 0.74);
      background.addColorStop(0, "#203432");
      background.addColorStop(1, "#121d21");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, mapMetrics.width, mapMetrics.height);
      ctx.save();
      ctx.strokeStyle = "rgba(181,192,167,.035)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 24; i += 1) {
        const x = (i * 97.31) % mapMetrics.width;
        const y = (i * 157.73 + 31) % mapMetrics.height;
        ctx.beginPath();
        ctx.arc(x, y, (i % 3) + 0.5, 0, PI2);
        ctx.stroke();
      }
      ctx.restore();
      if (!state) {
        ctx.fillStyle = "rgba(220,215,191,.28)";
        ctx.font = "11px Georgia";
        ctx.textAlign = "center";
        ctx.fillText("An uncharted world waits beyond the first step.", mapMetrics.centerX, mapMetrics.centerY);
        return;
      }
      const radius = mapMetrics.radius * camera.zoom;
      state.tiles.forEach((tile) => drawTile(tile, radius));
      drawMovementReach(radius);
      state.cities.forEach((city) => drawCity(city, radius));
      drawUnits(radius);
      drawEffects();
      const player = humanPlayer();
      const warlord = state.units.find((unit) => unit.boss && unit.ownerId === "barbarian");
      if (warlord && tileAt(warlord.q, warlord.r)?.visible) {
        ctx.save();
        ctx.fillStyle = "rgba(17,24,26,.88)";
        ctx.fillRect(mapMetrics.width / 2 - 75, 9, 150, 22);
        ctx.strokeStyle = "rgba(217,129,112,.65)";
        ctx.strokeRect(mapMetrics.width / 2 - 75, 9, 150, 22);
        ctx.fillStyle = "#e49a8b";
        ctx.font = "700 8px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`ASHEN WARLORD / ${Math.ceil(warlord.health)} HP`, mapMetrics.width / 2, 20);
        ctx.restore();
      }
    }

    function drawTitleCanvas(now = 0) {
      if (!titleCtx || !titleCanvas) return;
      const rect = titleCanvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width < 5 || height < 5) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      titleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      titleCtx.clearRect(0, 0, width, height);
      const gradient = titleCtx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#1a302d");
      gradient.addColorStop(0.52, "#192824");
      gradient.addColorStop(1, "#152126");
      titleCtx.fillStyle = gradient;
      titleCtx.fillRect(0, 0, width, height);
      const centerX = width * 0.52;
      const centerY = height * 0.43;
      const hexSize = Math.min(38, Math.max(23, width / 17));
      const colors = ["#486d5d", "#70816a", "#385a51", "#90795b", "#496c68", "#647164"];
      for (let r = -7; r <= 7; r += 1) {
        const minQ = Math.max(-7, -r - 7);
        const maxQ = Math.min(7, -r + 7);
        for (let q = minQ; q <= maxQ; q += 1) {
          const point = axialPixel(q, r, hexSize);
          const x = centerX + point.x;
          const y = centerY + point.y;
          const d = Math.abs(q) + Math.abs(r) + Math.abs(q + r);
          const wave = Math.sin(now * 0.32 + q * 0.6 + r * 0.34) * 0.03;
          const land = Math.sin(q * 0.75 + r * 1.12) + Math.cos(r * 1.2 - q * 0.2) * 0.62;
          const color = land < -0.9 ? "#315364" : colors[Math.abs(q * 3 + r * 5) % colors.length];
          const alpha = clamp(0.85 - d * 0.009 + wave, 0.22, 0.85);
          titleCtx.save();
          drawHexPath(titleCtx, x, y, hexSize * 0.97);
          titleCtx.fillStyle = rgba(color, alpha);
          titleCtx.fill();
          titleCtx.strokeStyle = "rgba(220,216,188,.13)";
          titleCtx.lineWidth = 1;
          titleCtx.stroke();
          if (land > 0.1 && (q + r) % 3 === 0) {
            titleCtx.fillStyle = "rgba(190,185,149,.26)";
            titleCtx.beginPath();
            titleCtx.arc(x + (q % 2) * 5, y - 4, 2, 0, PI2);
            titleCtx.fill();
          }
          titleCtx.restore();
        }
      }
      titleCtx.save();
      titleCtx.strokeStyle = "rgba(220,187,117,.28)";
      titleCtx.lineWidth = 1;
      const ring = Math.min(width, height) * 0.31;
      titleCtx.beginPath();
      titleCtx.arc(centerX, centerY, ring + Math.sin(now * 0.34) * 3, 0, PI2);
      titleCtx.stroke();
      titleCtx.strokeStyle = "rgba(221,216,191,.13)";
      titleCtx.beginPath();
      titleCtx.arc(centerX, centerY, ring + 24, 0, PI2);
      titleCtx.stroke();
      titleCtx.setLineDash([3, 10]);
      titleCtx.beginPath();
      titleCtx.arc(centerX, centerY, ring + 37, 0, PI2);
      titleCtx.stroke();
      titleCtx.setLineDash([]);
      titleCtx.fillStyle = "rgba(229,203,137,.86)";
      titleCtx.font = "9px Arial";
      titleCtx.textAlign = "center";
      titleCtx.textBaseline = "middle";
      titleCtx.fillText("THE KNOWN WORLD", centerX, centerY - ring - 15);
      const capitalPoints = [[-4, 0, "#d8b96e"], [4, 0, "#83add0"], [0, -4, "#77bba5"], [0, 4, "#d98170"]];
      capitalPoints.forEach(([q, r, color], index) => {
        const position = axialPixel(q, r, hexSize);
        const pulse = 1 + Math.sin(now * 2 + index * 1.7) * 0.16;
        titleCtx.beginPath();
        titleCtx.arc(centerX + position.x, centerY + position.y, 5 * pulse, 0, PI2);
        titleCtx.fillStyle = color;
        titleCtx.shadowColor = color;
        titleCtx.shadowBlur = 13;
        titleCtx.fill();
        titleCtx.shadowBlur = 0;
        titleCtx.beginPath();
        titleCtx.arc(centerX + position.x, centerY + position.y, 11 * pulse, 0, PI2);
        titleCtx.strokeStyle = rgba(color, 0.4);
        titleCtx.stroke();
      });
      titleCtx.restore();
      const vignette = titleCtx.createLinearGradient(0, 0, width, 0);
      vignette.addColorStop(0, "rgba(12,19,21,.05)");
      vignette.addColorStop(0.53, "rgba(12,19,21,.04)");
      vignette.addColorStop(1, "rgba(12,19,21,.8)");
      titleCtx.fillStyle = vignette;
      titleCtx.fillRect(0, 0, width, height);
    }

    function updateEffects(delta) {
      particles.forEach((particle) => {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 22 * delta;
        particle.vx *= 0.985;
      });
      particles = particles.filter((particle) => particle.life > 0);
      floatingTexts.forEach((floating) => { floating.life -= delta; });
      floatingTexts = floatingTexts.filter((floating) => floating.life > 0);
      if (camera.shakeTime > 0) {
        camera.shakeTime = Math.max(0, camera.shakeTime - delta);
        const force = (camera.shake || 0) * (camera.shakeTime / 0.35);
        camera.renderShakeX = randBetween(-force, force);
        camera.renderShakeY = randBetween(-force, force);
      } else {
        camera.renderShakeX = 0;
        camera.renderShakeY = 0;
        camera.shake = 0;
      }
    }

    function frame(timestamp) {
      const delta = previousFrame ? Math.min(0.05, Math.max(0, (timestamp - previousFrame) / 1000)) : 0;
      previousFrame = timestamp;
      time += delta;
      updateEffects(delta);
      if (currentScreen === "game") drawWorld();
      else if (currentScreen === "title" && timestamp - lastTitleCanvas > 50) {
        lastTitleCanvas = timestamp;
        drawTitleCanvas(time);
      }
      animationId = requestAnimationFrame(frame);
    }

    requestResize();
    renderTitle();
    showScreen("title");
    animationId = requestAnimationFrame(frame);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      if (titleResizeObserver) titleResizeObserver.disconnect();
      if (typeof ResizeObserver === "undefined") {
        window.removeEventListener("resize", resizeCanvas);
        window.removeEventListener("resize", resizeTitleCanvas);
      }
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      if (toastTimer) window.clearTimeout(toastTimer);
      if (transitionTimer) window.clearTimeout(transitionTimer);
      if (state && !state.winnerId) saveCampaign();
      audio.dispose();
      host.innerHTML = "";
    };
  } catch (error) {
    console.error("Civilization Micro failed to mount:", error);
    host.innerHTML = `<div style="display:grid;min-height:100vh;place-items:center;background:#111a1e;color:#eee5d2;font:14px system-ui"><div><strong>The chronicle could not open.</strong><p style="color:#9ba69d">Refresh the page to begin a new campaign.</p></div></div>`;
    return () => { host.innerHTML = ""; };
  }
}