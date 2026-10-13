import { useEffect, useRef, useState } from "react";

type Difficulty = "gentle" | "standard" | "pursuit";
type ToolId = "brush" | "trowel" | "pick";
type Panel = "field" | "museum" | "research";
type Modal = "none" | "pause" | "manual" | "tutorial" | "replace";
type Screen = "title" | "game" | "archive";
type Hazard = "clear" | "roots" | "rubble" | "sand" | "seep" | "ash";

interface DifficultyInfo {
  title: string;
  short: string;
  description: string;
  turns: number;
  rivalRate: number;
}

const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  gentle: {
    title: "Open record",
    short: "GENTLE",
    description: "More field time. Voss is in no hurry.",
    turns: 42,
    rivalRate: 2.05,
  },
  standard: {
    title: "Field standard",
    short: "STANDARD",
    description: "A measured race against a well-funded rival.",
    turns: 35,
    rivalRate: 2.9,
  },
  pursuit: {
    title: "Rival's shadow",
    short: "PURSUIT",
    description: "Tighter allowances. Voss moves quickly.",
    turns: 30,
    rivalRate: 3.65,
  },
};

interface RelicTemplate {
  key: string;
  name: string;
  period: string;
  theme: string;
  mark: string;
  note: string;
  rarity: string;
}

interface BuriedRelic extends RelicTemplate {
  id: string;
  x: number;
  y: number;
  depth: number;
  mandatory: boolean;
  found: boolean;
}

interface Relic extends RelicTemplate {
  id: string;
  siteIndex: number;
  siteName: string;
  quality: number;
  recoveredWith: ToolId | "hand";
}

interface Signal {
  distance: number;
  bearing: string;
  strength: string;
}

interface Tile {
  id: string;
  x: number;
  y: number;
  depth: number;
  maxDepth: number;
  layers: string[];
  hazard: Hazard;
  hazardDepth: number;
  hazardTriggered: boolean;
  signal?: Signal;
  artifactFound: boolean;
}

interface Site {
  index: number;
  name: string;
  region: string;
  description: string;
  strataNote: string;
  tiles: Tile[];
  artifacts: BuriedRelic[];
  integrity: number;
}

interface RestorationPuzzle {
  artifactId: string;
  targetRotations: number[];
  rotations: number[];
  mistakes: number;
  condition: number;
  recoveredWith: ToolId | "hand";
}

interface Report {
  siteName: string;
  grant: number;
  finds: number;
  score: number;
}

interface Run {
  seed: number;
  difficulty: Difficulty;
  siteIndex: number;
  site: Site;
  turnsLeft: number;
  turnsMax: number;
  funds: number;
  supplies: number;
  tools: Record<ToolId, number>;
  reputation: number;
  rivalProgress: number;
  peakRival: number;
  inventory: Relic[];
  exhibits: (string | null)[];
  totalActions: number;
  totalFinds: number;
  score: number;
  reports: Report[];
  log: string[];
  status: "active" | "won" | "lost";
  lossReason?: string;
  restoration: RestorationPuzzle | null;
}

interface Profile {
  insight: number;
  upgrades: string[];
  archive: Relic[];
  wins: number;
  bestScore: number;
  tutorialSeen: boolean;
  soundEnabled: boolean;
  volume: number;
}

interface SiteConfig {
  name: string;
  region: string;
  description: string;
  strataNote: string;
  strata: [string, string, string, string];
  artifacts: RelicTemplate[];
}

const SITE_CONFIG: SiteConfig[] = [
  {
    name: "Lowhaven Floodplain",
    region: "NORTH DELTA / TRANSECT 04",
    description: "A seasonal river moved this settlement three times. Read the flood deposits before the water table rises.",
    strataNote: "peat over tidal silt, then blue clay",
    strata: ["PEAT", "TIDAL SILT", "BLUE CLAY", "RIVER CHALK"],
    artifacts: [
      { key: "ebb-token", name: "Ebb-Tide Token", period: "LOWHAVEN / 3RD CYCLE", theme: "Ritual", mark: "ET", note: "A copper promise left at the old river gate.", rarity: "COMMISSIONED" },
      { key: "marsh-ledger", name: "Marsh Ledger", period: "LOWHAVEN / 3RD CYCLE", theme: "Record", mark: "ML", note: "Water levels scored into a strip of fired clay.", rarity: "COMMISSIONED" },
      { key: "reed-lure", name: "Reed-Woven Lure", period: "EARLY FLOODPLAIN", theme: "Craft", mark: "RL", note: "A tiny fish lure, still threaded with river reed.", rarity: "FIELD FIND" },
    ],
  },
  {
    name: "The Glass Orchard",
    region: "EASTERN HIGHLANDS / GROVE 02",
    description: "Blackened roots cross a ceremonial grove. The ash lenses are thin, but they preserve an entire harvest calendar.",
    strataNote: "leaf loam over hearth ash and pale marl",
    strata: ["LEAF LOAM", "HEARTH ASH", "PALE MARL", "OLD LIMESTONE"],
    artifacts: [
      { key: "canopy-mask", name: "Canopy Mask", period: "ORCHARD PERIOD / LATE", theme: "Ritual", mark: "CM", note: "A glass-eyed mask darkened by a long-ago fire.", rarity: "COMMISSIONED" },
      { key: "amber-moth", name: "Amber Moth", period: "ORCHARD PERIOD / LATE", theme: "Craft", mark: "AM", note: "A pendant cast around the wing of a moth.", rarity: "COMMISSIONED" },
      { key: "seed-vessel", name: "Seed Vessel", period: "ORCHARD PERIOD / EARLY", theme: "Trade", mark: "SV", note: "A sealed cup of fruit stones from a lost orchard.", rarity: "FIELD FIND" },
    ],
  },
  {
    name: "The Amber Cut",
    region: "SOUTHERN CAUSEWAY / MILE 18",
    description: "A caravan stop was swallowed by a moving dune. Stone packing marks a way through the loose sand.",
    strataNote: "windblown sand over kiln ash and red stone",
    strata: ["WIND SAND", "KILN ASH", "RED SANDSTONE", "IRON BEDROCK"],
    artifacts: [
      { key: "road-seal", name: "Wayfarer's Seal", period: "CAUSEWAY / MIDDLE", theme: "Trade", mark: "WS", note: "A merchant's seal, stamped with a road no longer on maps.", rarity: "COMMISSIONED" },
      { key: "night-map", name: "Night Route Map", period: "CAUSEWAY / MIDDLE", theme: "Record", mark: "NM", note: "Star paths scratched onto a sliver of black glass.", rarity: "COMMISSIONED" },
      { key: "camel-bell", name: "Dusk Bell", period: "CAUSEWAY / EARLY", theme: "Ritual", mark: "DB", note: "Its clapper is wrapped in faded blue thread.", rarity: "FIELD FIND" },
    ],
  },
  {
    name: "The Crown Below",
    region: "CROWN BASIN / SEALED CHAMBER",
    description: "Voss has opened a second shaft. The chamber is unstable; recover the crown before the rival crew breaches it.",
    strataNote: "volcanic glass above burial ash and basalt",
    strata: ["GLASS DUST", "BURIAL ASH", "OBSIDIAN GRIT", "BLACK BASALT"],
    artifacts: [
      { key: "black-crown", name: "The Black Crown", period: "CROWN BASIN / FINAL DYNASTY", theme: "Cosmology", mark: "BC", note: "A ruler's crown fused by heat into one unbroken dark ring.", rarity: "CAPSTONE RELIC" },
      { key: "glass-censer", name: "Glass Censer", period: "CROWN BASIN / FINAL DYNASTY", theme: "Ritual", mark: "GC", note: "The last vessel named in the chamber's ash record.", rarity: "COMMISSIONED" },
      { key: "eclipse-key", name: "Eclipse Key", period: "CROWN BASIN / EARLIER DYNASTY", theme: "Craft", mark: "EK", note: "A small obsidian key, polished on only one side.", rarity: "FIELD FIND" },
    ],
  },
];

const UPGRADE_LIST = [
  { id: "resonance", code: "01 / SURVEY", name: "Resonance Lens", cost: 12, detail: "Survey results include a bearing toward the nearest buried find.", effect: "Adds a compass bearing to every sonar reading." },
  { id: "alloy", code: "02 / TOOLS", name: "Tempered Implements", cost: 16, detail: "Reinforced heads hold their edge through rubble and roots.", effect: "Tools gain reserve durability and wear down more slowly." },
  { id: "quiet", code: "03 / CAMP", name: "Quiet Field Camp", cost: 20, detail: "A decoy trench and a strict light discipline confuse Voss's spotters.", effect: "Rival progress advances 24% more slowly." },
  { id: "longDays", code: "04 / LOGISTICS", name: "Longer Field Permit", cost: 22, detail: "A longer permit buys time to document the hard-to-reach layers.", effect: "Adds five work turns to every site." },
  { id: "patrons", code: "05 / INSTITUTE", name: "Patron Network", cost: 26, detail: "A circle of donors funds careful work and coherent exhibitions.", effect: "Adds a 22-credit grant to every filed site report." },
  { id: "conservators", code: "06 / LAB", name: "Senior Conservators", cost: 30, detail: "A better field lab keeps recovered objects stable until restoration.", effect: "Finds arrive in better condition, especially after a rough dig." },
];

const TOOL_LABELS: Record<ToolId, string> = {
  brush: "Soft brush",
  trowel: "Field trowel",
  pick: "Rock pick",
};

const TOOL_MAX: Record<ToolId, number> = {
  brush: 38,
  trowel: 32,
  pick: 22,
};

const HAZARD_INFO: Record<Hazard, { name: string; short: string; detail: string }> = {
  clear: { name: "Clear deposit", short: "--", detail: "No immediate obstruction." },
  roots: { name: "Root lattice", short: "RT", detail: "Brushes pass cleanly; other tools can fracture fragile joins." },
  rubble: { name: "Masonry fall", short: "RB", detail: "A pick clears it efficiently. Lighter tools cost time and wear." },
  sand: { name: "Running sand", short: "SD", detail: "A heavy pick can collapse a neighboring open square." },
  seep: { name: "Rising water", short: "WT", detail: "A supply kit pumps the square dry. Without one, the site loses integrity." },
  ash: { name: "Ash lens", short: "AS", detail: "A sealed hearth layer preserves useful context and grants research insight." },
};

const TUTORIAL = [
  {
    title: "Read the square before you open it.",
    text: "Every cell holds a stack of strata. Choose a tool, then click a square to expose its next layer. A survey costs one work turn, but its signal can save several blind digs.",
    tag: "01 / STRATIGRAPHY",
  },
  {
    title: "Precision protects the record.",
    text: "The brush is slow and gentle, the trowel is balanced, and the pick opens two layers at once. A heavy strike can chip a relic. Tools wear down; a field refit restores their edges.",
    tag: "02 / IMPLEMENTS",
  },
  {
    title: "Recover, restore, then tell a story.",
    text: "Align three broken seams in the conservation lab. Curate distinct themes in the museum to improve your grant. Research earned in the field permanently unlocks better equipment.",
    tag: "03 / ARCHIVE",
  },
];

const DEFAULT_PROFILE: Profile = {
  insight: 8,
  upgrades: [],
  archive: [],
  wins: 0,
  bestScore: 0,
  tutorialSeen: false,
  soundEnabled: true,
  volume: 0.46,
};

const STORAGE_PROFILE = "archaeology-of-ruin.profile.v1";
const STORAGE_RUN = "archaeology-of-ruin.expedition.v1";
const COLS = 9;
const ROWS = 7;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled or full; the active expedition remains playable in memory.
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A failed save removal should not interrupt the expedition.
  }
}

function loadProfile(): Profile {
  const saved = safeRead<Partial<Profile> | null>(STORAGE_PROFILE, null);
  if (!saved) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    upgrades: Array.isArray(saved.upgrades) ? saved.upgrades.filter((id): id is string => typeof id === "string" && UPGRADE_LIST.some((upgrade) => upgrade.id === id)) : [],
    archive: Array.isArray(saved.archive) ? saved.archive.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && Number.isFinite(item.quality)) : [],
    insight: Number.isFinite(saved.insight) ? Math.max(0, Number(saved.insight)) : DEFAULT_PROFILE.insight,
    volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, Number(saved.volume))) : DEFAULT_PROFILE.volume,
    soundEnabled: typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : DEFAULT_PROFILE.soundEnabled,
    tutorialSeen: typeof saved.tutorialSeen === "boolean" ? saved.tutorialSeen : DEFAULT_PROFILE.tutorialSeen,
    wins: Number.isFinite(saved.wins) ? Math.max(0, Number(saved.wins)) : DEFAULT_PROFILE.wins,
    bestScore: Number.isFinite(saved.bestScore) ? Math.max(0, Number(saved.bestScore)) : DEFAULT_PROFILE.bestScore,
  };
}

function loadSavedRun(): Run | null {
  const saved = safeRead<Partial<Run> | null>(STORAGE_RUN, null);
  const validDifficulty = saved && ["gentle", "standard", "pursuit"].includes(String(saved.difficulty));
  const validTiles = saved?.site && Array.isArray(saved.site.tiles) && saved.site.tiles.length > 0 && saved.site.tiles.every((tile) =>
    tile && typeof tile.id === "string" && Number.isFinite(tile.depth) && Number.isFinite(tile.maxDepth) && Array.isArray(tile.layers) && tile.layers.length > 0,
  );
  const validPuzzle = !saved?.restoration || (
    Array.isArray(saved.restoration.targetRotations) && saved.restoration.targetRotations.length === 3 &&
    Array.isArray(saved.restoration.rotations) && saved.restoration.rotations.length === 3
  );
  if (
    !saved ||
    saved.status !== "active" ||
    !validDifficulty ||
    !Number.isInteger(saved.siteIndex) || saved.siteIndex! < 0 || saved.siteIndex! >= SITE_CONFIG.length ||
    !saved.site ||
    !validTiles ||
    !Array.isArray(saved.site.artifacts) ||
    !Array.isArray(saved.inventory) ||
    !Array.isArray(saved.exhibits) ||
    !saved.tools ||
    !Array.isArray(saved.log) ||
    !Number.isFinite(saved.turnsLeft) ||
    !Number.isFinite(saved.turnsMax) || saved.turnsMax! <= 0 ||
    !validPuzzle
  ) {
    return null;
  }
  return saved as Run;
}

function makeRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getTurns(difficulty: Difficulty, siteIndex: number, upgrades: string[]) {
  return Math.max(22, DIFFICULTIES[difficulty].turns - siteIndex * 2 + (upgrades.includes("longDays") ? 5 : 0));
}

function toolMax(tool: ToolId, upgrades: string[]) {
  return TOOL_MAX[tool] + (upgrades.includes("alloy") ? 10 : 0);
}

function makeSite(index: number, seed: number): Site {
  const config = SITE_CONFIG[index];
  const random = makeRng(seed + (index + 1) * 9137);
  const tiles: Tile[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const middle = random() > 0.5 ? config.strata[1] : config.strata[2];
      const roll = random();
      const hazard: Hazard = roll < 0.12 ? "roots" : roll < 0.23 ? "rubble" : roll < 0.34 ? "sand" : roll < 0.45 ? "seep" : roll < 0.57 ? "ash" : "clear";
      tiles.push({
        id: `${x}-${y}`,
        x,
        y,
        depth: 0,
        maxDepth: 3,
        layers: [config.strata[0], middle, random() > 0.5 ? config.strata[2] : config.strata[1], config.strata[3]],
        hazard,
        hazardDepth: 1 + Math.floor(random() * 2),
        hazardTriggered: false,
        artifactFound: false,
      });
    }
  }

  const occupied: Array<{ x: number; y: number }> = [];
  const artifacts = config.artifacts.map((template, artifactIndex): BuriedRelic => {
    let x = 1 + Math.floor(random() * (COLS - 2));
    let y = 1 + Math.floor(random() * (ROWS - 2));
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const candidateX = 1 + Math.floor(random() * (COLS - 2));
      const candidateY = 1 + Math.floor(random() * (ROWS - 2));
      const separation = occupied.every((other) => Math.abs(other.x - candidateX) + Math.abs(other.y - candidateY) >= 3);
      if (separation || attempt === 69) {
        x = candidateX;
        y = candidateY;
        break;
      }
    }
    occupied.push({ x, y });
    return {
      ...template,
      id: `${seed.toString(36)}-${index}-${template.key}`,
      x,
      y,
      depth: artifactIndex === 0 ? 2 : artifactIndex === 1 ? 3 : 1 + Math.floor(random() * 2),
      mandatory: artifactIndex < 2,
      found: false,
    };
  });

  return {
    index,
    name: config.name,
    region: config.region,
    description: config.description,
    strataNote: config.strataNote,
    tiles,
    artifacts,
    integrity: 100,
  };
}

function makeRun(difficulty: Difficulty, profile: Profile): Run {
  const seed = Date.now() + Math.floor(Math.random() * 100000);
  const turns = getTurns(difficulty, 0, profile.upgrades);
  return {
    seed,
    difficulty,
    siteIndex: 0,
    site: makeSite(0, seed),
    turnsLeft: turns,
    turnsMax: turns,
    funds: 72,
    supplies: 7,
    tools: {
      brush: toolMax("brush", profile.upgrades) - 4,
      trowel: toolMax("trowel", profile.upgrades) - 3,
      pick: toolMax("pick", profile.upgrades) - 2,
    },
    reputation: 46,
    rivalProgress: 0,
    peakRival: 0,
    inventory: [],
    exhibits: [null, null, null],
    totalActions: 0,
    totalFinds: 0,
    score: 0,
    reports: [],
    log: ["The first transect is marked. Choose a square to begin."],
    status: "active",
    restoration: null,
  };
}

function pushLog(run: Run, message: string) {
  return { ...run, log: [message, ...run.log].slice(0, 6) };
}

function rivalRate(run: Run, upgrades: string[]) {
  const base = DIFFICULTIES[run.difficulty].rivalRate + run.siteIndex * 0.36;
  const bossPressure = run.siteIndex === 3 && run.rivalProgress >= 65 ? 1.42 : 1;
  return base * (upgrades.includes("quiet") ? 0.76 : 1) * bossPressure;
}

function advanceTurn(run: Run, upgrades: string[], cost = 1) {
  const progress = Math.min(100, run.rivalProgress + rivalRate(run, upgrades));
  let next: Run = {
    ...run,
    turnsLeft: Math.max(0, run.turnsLeft - cost),
    rivalProgress: progress,
    peakRival: Math.max(run.peakRival, progress),
    totalActions: run.totalActions + 1,
  };
  if (run.siteIndex === 3 && run.rivalProgress < 65 && progress >= 65) {
    next = pushLog(next, "Voss's crew has reached the sealed chamber. The Crown Below is now a race.");
  }
  if (progress >= 100 && run.rivalProgress < 100) {
    next = pushLog(next, "Voss's team has reached the chamber first.");
  }
  return next;
}

function requiredFound(run: Run) {
  return run.site.artifacts.filter((artifact) => artifact.mandatory).every((artifact) => artifact.found || run.inventory.some((relic) => relic.id === artifact.id));
}

function requiredRestored(run: Run) {
  return run.site.artifacts.filter((artifact) => artifact.mandatory).every((artifact) => run.inventory.some((relic) => relic.id === artifact.id));
}

function checkFailure(run: Run, restorationFailed = false): Run {
  if (run.status !== "active") return run;
  const exhausted = run.turnsLeft <= 0 || run.rivalProgress >= 100 || run.site.integrity <= 0;
  if (!exhausted) return run;
  if (requiredRestored(run)) return run;
  if (!restorationFailed && (requiredRestored(run) || requiredFound(run))) return run;
  let reason = "The field permit has expired before the commission was recovered.";
  if (run.rivalProgress >= 100) reason = "Professor Voss breached the site first and claimed the commission.";
  if (run.site.integrity <= 0) reason = "The trench became unsafe. The institute has ordered an evacuation.";
  return { ...pushLog(run, reason), status: "lost", lossReason: reason };
}

function directionTo(fromX: number, fromY: number, toX: number, toY: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W";
  if (dy !== 0) return dy > 0 ? "S" : "N";
  return "HERE";
}

function signalStrength(distance: number) {
  if (distance === 0) return "UNDERFOOT";
  if (distance === 1) return "STRONG ECHO";
  if (distance <= 3) return "FAINT TRACE";
  return "NO CLEAR ECHO";
}

function getPuzzleRotations(seed: number, relicId: string) {
  let hash = seed >>> 0;
  for (let i = 0; i < relicId.length; i += 1) hash = Math.imul(hash ^ relicId.charCodeAt(i), 16777619) >>> 0;
  const target = [0, 1, 2].map((_, index) => (hash + index * 7 + Math.floor(hash / (index + 1))) % 4);
  return { target, start: target.map((value, index) => (value + index + 1) % 4) };
}

function mergeArchive(profile: Profile, relic: Relic): Profile {
  if (profile.archive.some((item) => item.id === relic.id)) return profile;
  return { ...profile, archive: [relic, ...profile.archive] };
}

function getGalleryItems(run: Run | null, profile: Profile) {
  const merged = new Map<string, Relic>();
  profile.archive.forEach((relic) => merged.set(relic.id, relic));
  run?.inventory.forEach((relic) => merged.set(relic.id, relic));
  return [...merged.values()].reverse();
}

function getExhibitPreview(run: Run, profile: Profile) {
  const byId = new Map(getGalleryItems(run, profile).map((relic) => [relic.id, relic]));
  const displayed = run.exhibits.flatMap((id) => {
    const relic = id ? byId.get(id) : undefined;
    return relic ? [relic] : [];
  });
  const themes = new Set(displayed.map((relic) => relic.theme));
  const quality = displayed.reduce((total, relic) => total + relic.quality, 0);
  const coherent = displayed.length === 3 && themes.size === 3;
  const grant = 18 + run.siteIndex * 8 + displayed.length * 8 + themes.size * 5 + (coherent ? 14 : 0) + quality * 2 + Math.round(run.reputation * 0.08) + (profile.upgrades.includes("patrons") ? 22 : 0) - Math.floor((100 - run.site.integrity) / 8);
  const reputation = Math.min(100, run.reputation + 2 + displayed.length * 2 + themes.size * 2 + (coherent ? 4 : 0));
  return { displayed, themes, quality, coherent, grant: Math.max(0, grant), reputation };
}

function layerSlug(layer: string) {
  return layer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function DustCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const makeParticles = () => Array.from({ length: width < 700 ? 18 : 38 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.5 + Math.random() * 1.15,
      vx: -3 + Math.random() * 7,
      vy: -5 - Math.random() * 8,
      alpha: 0.12 + Math.random() * 0.26,
    }));
    let particles = makeParticles();
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = makeParticles();
    };
    resize();
    let frame = 0;
    let previous = 0;
    const animate = (now: number) => {
      const dt = Math.min((now - previous) / 1000 || 0, 0.05);
      previous = now;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.y < -4) {
          particle.y = height + 4;
          particle.x = Math.random() * width;
        }
        if (particle.x < -4) particle.x = width + 4;
        if (particle.x > width + 4) particle.x = -4;
        context.beginPath();
        context.fillStyle = `rgba(220, 186, 130, ${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas className="dust-canvas" aria-hidden="true" ref={canvasRef} />;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? " brand-mark--compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 34 34" fill="none">
        <path d="M17 2.8 30 10.2v13.6L17 31.2 4 23.8V10.2L17 2.8Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="m11 20 6-11 6 11M13.2 16h7.6M10.2 23.5h13.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function SoundGlyph({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10v4h4l5 4V6l-5 4H4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {muted ? <path d="m17 9 4 6m0-6-4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

function ToolGlyph({ tool }: { tool: ToolId }) {
  if (tool === "brush") {
    return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m12 19 10-10 3 3-10 10M11 20c-4 0-6 2-6 5 4 1 8-1 8-5m8-11 2-2 4 4-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (tool === "trowel") {
    return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 5 8 12-8 4-8-4 8-12Zm0 16v7m-4 0h8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m8 24 14-14m-9 18 3-3M5 9c5-5 14-5 20 1l-6 6C13 10 5 9 5 9Zm-1 1 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SeamArrow({ rotation }: { rotation: number }) {
  return <span className="seam-compass"><span className="seam-arrow" style={{ transform: `rotate(${rotation * 90}deg)` }} /></span>;
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [savedRun, setSavedRun] = useState<Run | null>(loadSavedRun);
  const [run, setRun] = useState<Run | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [panel, setPanel] = useState<Panel>("field");
  const [modal, setModal] = useState<Modal>("none");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedTool, setSelectedTool] = useState<ToolId>("brush");
  const [surveyMode, setSurveyMode] = useState(false);
  const [selectedTile, setSelectedTile] = useState("4-3");
  const [selectedRelic, setSelectedRelic] = useState<string | null>(null);
  const [effects, setEffects] = useState<Array<{ id: number; left: number; top: number; text: string; kind: string; created: number }>>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const runRef = useRef<Run | null>(null);
  const profileRef = useRef(profile);
  const audioRef = useRef<{ context: AudioContext; master: GainNode; music: GainNode; timer: number | null } | null>(null);
  const effectIdRef = useRef(0);
  runRef.current = run;
  profileRef.current = profile;

  useEffect(() => {
    safeWrite(STORAGE_PROFILE, profile);
  }, [profile]);

  useEffect(() => {
    if (run?.status === "active") {
      safeWrite(STORAGE_RUN, run);
      setSavedRun(run);
    } else if (run) {
      safeRemove(STORAGE_RUN);
      setSavedRun(null);
    }
  }, [run]);

  useEffect(() => {
    const engine = audioRef.current;
    if (!engine) return;
    const target = profile.soundEnabled ? profile.volume : 0;
    engine.master.gain.setTargetAtTime(target, engine.context.currentTime, 0.04);
  }, [profile.soundEnabled, profile.volume]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!effects.length) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setEffects((current) => current.filter((effect) => now - effect.created < 950));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [effects]);

  useEffect(() => () => {
    const engine = audioRef.current;
    if (engine?.timer !== null && engine?.timer !== undefined) window.clearInterval(engine.timer);
    if (engine) void engine.context.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    const syncAudioVisibility = () => {
      const engine = audioRef.current;
      if (!engine) return;
      if (document.hidden) void engine.context.suspend().catch(() => undefined);
      else if (profileRef.current.soundEnabled) void engine.context.resume().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", syncAudioVisibility);
    return () => document.removeEventListener("visibilitychange", syncAudioVisibility);
  }, []);

  const ensureAudio = () => {
    if (!audioRef.current) {
      try {
        const context = new AudioContext();
        const master = context.createGain();
        const music = context.createGain();
        master.gain.value = profileRef.current.soundEnabled ? profileRef.current.volume : 0;
        music.gain.value = 0.48;
        music.connect(master);
        master.connect(context.destination);
        const drone = context.createOscillator();
        const droneGain = context.createGain();
        drone.type = "sine";
        drone.frequency.value = 55;
        droneGain.gain.value = 0.09;
        drone.connect(droneGain);
        droneGain.connect(music);
        drone.start();
        const engine = { context, master, music, timer: null as number | null };
        audioRef.current = engine;
        const melody = [0, 3, 5, 2, 7, 5, 3, 9];
        let beat = 0;
        engine.timer = window.setInterval(() => {
          if (!profileRef.current.soundEnabled || document.hidden) return;
          const live = runRef.current;
          const danger = live?.rivalProgress ?? 0;
          const site = live?.siteIndex ?? 0;
          const semitones = melody[beat % melody.length] + Math.floor(danger / 28);
          const frequency = 146.83 * Math.pow(2, semitones / 12) * (1 + site * 0.035);
          beat += 1;
          const note = context.createOscillator();
          const envelope = context.createGain();
          const now = context.currentTime;
          note.type = "triangle";
          note.frequency.setValueAtTime(frequency, now);
          envelope.gain.setValueAtTime(0.0001, now);
          envelope.gain.exponentialRampToValueAtTime(0.028 + danger * 0.00012, now + 0.06);
          envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
          note.connect(envelope);
          envelope.connect(music);
          note.start(now);
          note.stop(now + 1.35);
          note.onended = () => {
            note.disconnect();
            envelope.disconnect();
          };
        }, 1900);
      } catch {
        return;
      }
    }
    void audioRef.current?.context.resume().catch(() => undefined);
  };

  const playSound = (kind: "dig" | "survey" | "find" | "repair" | "error" | "win" | "restore") => {
    if (!profileRef.current.soundEnabled) return;
    const engine = audioRef.current;
    if (!engine) return;
    const presets: Record<string, { frequency: number; duration: number; wave: OscillatorType; volume: number; slide?: number }> = {
      dig: { frequency: 168, duration: 0.13, wave: "triangle", volume: 0.1, slide: 95 },
      survey: { frequency: 480, duration: 0.28, wave: "sine", volume: 0.07, slide: 760 },
      find: { frequency: 392, duration: 0.62, wave: "sine", volume: 0.12, slide: 587 },
      repair: { frequency: 218, duration: 0.2, wave: "triangle", volume: 0.075, slide: 330 },
      error: { frequency: 125, duration: 0.24, wave: "sawtooth", volume: 0.045, slide: 82 },
      win: { frequency: 330, duration: 0.85, wave: "sine", volume: 0.1, slide: 660 },
      restore: { frequency: 294, duration: 0.34, wave: "triangle", volume: 0.08, slide: 440 },
    };
    const preset = presets[kind];
    const { context, master } = engine;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = preset.wave;
    oscillator.frequency.setValueAtTime(preset.frequency, now);
    if (preset.slide) oscillator.frequency.exponentialRampToValueAtTime(preset.slide, now + preset.duration * 0.8);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    if (kind === "find" || kind === "win") {
      const high = context.createOscillator();
      const highGain = context.createGain();
      high.type = "sine";
      high.frequency.setValueAtTime(preset.frequency * 1.5, now + 0.07);
      highGain.gain.setValueAtTime(0.0001, now);
      highGain.gain.exponentialRampToValueAtTime(0.045, now + 0.1);
      highGain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration * 0.9);
      high.connect(highGain);
      highGain.connect(master);
      high.start(now + 0.04);
      high.stop(now + preset.duration);
      high.onended = () => {
        high.disconnect();
        highGain.disconnect();
      };
    }
  };

  const announce = (text: string) => setNotice({ id: Date.now() + Math.random(), text });

  const commitRun = (next: Run) => {
    runRef.current = next;
    setRun(next);
  };

  const addEffect = (tile: Tile, text: string, kind = "soil") => {
    const id = ++effectIdRef.current;
    setEffects((current) => [...current.slice(-7), {
      id,
      left: ((tile.x + 0.5) / COLS) * 100,
      top: ((tile.y + 0.5) / ROWS) * 100,
      text,
      kind,
      created: Date.now(),
    }]);
  };

  const startNewRun = (nextDifficulty: Difficulty) => {
    ensureAudio();
    const next = makeRun(nextDifficulty, profileRef.current);
    runRef.current = next;
    setRun(next);
    setDifficulty(nextDifficulty);
    setPanel("field");
    setSelectedTool("brush");
    setSelectedTile("4-3");
    setSurveyMode(false);
    setSelectedRelic(null);
    setScreen("game");
    setModal(profileRef.current.tutorialSeen ? "none" : "tutorial");
    playSound("restore");
  };

  const continueRun = () => {
    if (!savedRun) return;
    ensureAudio();
    runRef.current = savedRun;
    setRun(savedRun);
    setDifficulty(savedRun.difficulty);
    setPanel("field");
    setSelectedTile("4-3");
    setSelectedTool("brush");
    setSurveyMode(false);
    setScreen("game");
    setModal("none");
  };

  const finishTutorial = () => {
    setProfile((current) => ({ ...current, tutorialSeen: true }));
    setModal("none");
    playSound("restore");
  };

  const beginSurvey = (tileId: string) => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    if (current.turnsLeft <= 0) {
      announce("The field permit has no work turns remaining.");
      playSound("error");
      return;
    }
    const tile = current.site.tiles.find((item) => item.id === tileId);
    if (!tile) return;
    const buried = current.site.artifacts.filter((artifact) => !artifact.found);
    if (!buried.length) {
      announce("All signals at this site have been recovered.");
      setSurveyMode(false);
      return;
    }
    const closest = buried.reduce((best, artifact) => {
      const distance = Math.abs(artifact.x - tile.x) + Math.abs(artifact.y - tile.y);
      return !best || distance < best.distance ? { artifact, distance } : best;
    }, null as { artifact: BuriedRelic; distance: number } | null);
    if (!closest) return;
    const lens = profileRef.current.upgrades.includes("resonance");
    const signal: Signal = {
      distance: closest.distance,
      bearing: lens ? directionTo(tile.x, tile.y, closest.artifact.x, closest.artifact.y) : "",
      strength: signalStrength(closest.distance),
    };
    const tiles = current.site.tiles.map((item) => item.id === tileId ? { ...item, signal } : item);
    let next = {
      ...current,
      site: { ...current.site, tiles },
    };
    next = advanceTurn(next, profileRef.current.upgrades);
    next = pushLog(next, `Survey at ${String.fromCharCode(65 + tile.y)}${String(tile.x + 1).padStart(2, "0")}: ${signal.strength.toLowerCase()}${signal.bearing ? `, bearing ${signal.bearing}` : ""}.`);
    next = checkFailure(next);
    commitRun(next);
    setSelectedTile(tileId);
    setSurveyMode(false);
    addEffect(tile, signal.distance === 0 ? "UNDERFOOT" : `${signal.distance} PACE${signal.distance === 1 ? "" : "S"}`, "scan");
    playSound("survey");
    if (next.siteIndex === 3 && current.rivalProgress < 65 && next.rivalProgress >= 65) announce("Voss has reached the sealed chamber. The crown is a race now.");
    else announce(`${signal.strength}${signal.bearing ? ` · BEARING ${signal.bearing}` : ""}`);
    if (next.status === "lost") playSound("error");
  };

  const excavate = (tileId: string) => {
    const current = runRef.current;
    if (!current || current.status !== "active" || current.restoration) return;
    if (surveyMode) {
      beginSurvey(tileId);
      return;
    }
    if (current.turnsLeft <= 0) {
      announce("No work turns remain. File the report or review the archive.");
      playSound("error");
      return;
    }
    const tile = current.site.tiles.find((item) => item.id === tileId);
    if (!tile) return;
    if (tile.depth >= tile.maxDepth) {
      setSelectedTile(tileId);
      announce("Bedrock. This square has been fully recorded.");
      return;
    }
    const hand = selectedTool === "brush" && current.tools.brush <= 0;
    if (selectedTool !== "brush" && current.tools[selectedTool] <= 0) {
      announce(`${TOOL_LABELS[selectedTool]} is worn through. Refit it or choose another tool.`);
      playSound("error");
      return;
    }
    const steps = selectedTool === "pick" ? 2 : 1;
    const newDepth = Math.min(tile.maxDepth, tile.depth + steps);
    const target = current.site.artifacts.find((artifact) => !artifact.found && artifact.x === tile.x && artifact.y === tile.y && artifact.depth > tile.depth && artifact.depth <= newDepth);
    const crossesHazard = !tile.hazardTriggered && tile.hazard !== "clear" && tile.depth < tile.hazardDepth && newDepth >= tile.hazardDepth;
    let turnCost = hand ? 2 : 1;
    let wear = hand ? 0 : selectedTool === "brush" ? 1 : selectedTool === "trowel" ? 2 : 4;
    let damage = target && selectedTool === "pick" ? 1 : 0;
    let supplies = current.supplies;
    let integrity = current.site.integrity;
    let hazardTriggered = tile.hazardTriggered;
    let hazardMessage = "";
    let ashInsight = 0;
    let collapseId: string | null = null;
    const carefulBrush = selectedTool === "brush" && !hand;

    if (crossesHazard) {
      hazardTriggered = true;
      if (tile.hazard === "roots") {
        if (!carefulBrush) {
          wear += 3;
          damage += target ? 1 : 0;
          hazardMessage = "Root lattice strains the tool; fragile joins are at risk.";
        } else hazardMessage = "Root lattice parted with a soft brush.";
      } else if (tile.hazard === "rubble") {
        if (selectedTool !== "pick") {
          wear += 2;
          turnCost += 1;
          damage += target ? 1 : 0;
          hazardMessage = "Masonry fall: a light tool takes another turn to clear the fragments.";
        } else hazardMessage = "The pick clears a pocket through the old masonry.";
      } else if (tile.hazard === "sand") {
        if (selectedTool === "pick") {
          integrity = Math.max(0, integrity - 9);
          const neighbor = current.site.tiles.find((other) => Math.abs(other.x - tile.x) + Math.abs(other.y - tile.y) === 1 && other.depth > 0 && !other.artifactFound);
          if (neighbor) collapseId = neighbor.id;
          hazardMessage = neighbor ? "Running sand collapses a neighboring square. The trench loses integrity." : "Running sand slumps away from the heavy pick.";
        } else hazardMessage = "Loose sand shifts, but the careful cut holds.";
      } else if (tile.hazard === "seep") {
        if (supplies > 0) {
          supplies -= 1;
          hazardMessage = "A water pocket is pumped clear with one supply kit.";
        } else {
          turnCost += 1;
          integrity = Math.max(0, integrity - 14);
          hazardMessage = "No pump kit remains. Water is eating into the trench.";
        }
      } else if (tile.hazard === "ash") {
        ashInsight = 2;
        hazardMessage = "A sealed ash lens preserves a complete hearth layer. +2 research insight.";
      }
    }

    if (profileRef.current.upgrades.includes("alloy") && wear > 1) wear -= 1;
    const nextTools = { ...current.tools };
    if (selectedTool !== "brush" || !hand) nextTools[selectedTool] = Math.max(0, nextTools[selectedTool] - wear);
    const newTiles = current.site.tiles.map((item) => {
      if (item.id === tileId) return { ...item, depth: newDepth, hazardTriggered, artifactFound: Boolean(target) };
      if (collapseId && item.id === collapseId) return { ...item, depth: Math.max(0, item.depth - 1) };
      return item;
    });
    const newArtifacts = target ? current.site.artifacts.map((artifact) => artifact.id === target.id ? { ...artifact, found: true } : artifact) : current.site.artifacts;
    let next: Run = {
      ...current,
      tools: nextTools,
      supplies,
      site: { ...current.site, tiles: newTiles, artifacts: newArtifacts, integrity },
    };
    next = advanceTurn(next, profileRef.current.upgrades, turnCost);
    if (target) {
      const carefulnessBonus = profileRef.current.upgrades.includes("conservators") ? 1 : 0;
      const condition = Math.max(1, Math.min(4, 3 - damage + carefulnessBonus));
      const puzzle = getPuzzleRotations(current.seed, target.id);
      next = {
        ...next,
        restoration: {
          artifactId: target.id,
          targetRotations: puzzle.target,
          rotations: puzzle.start,
          mistakes: 0,
          condition,
          recoveredWith: hand ? "hand" : selectedTool,
        },
      };
    }
    const messages = [hazardMessage, target ? `${target.name} uncovered at ${String.fromCharCode(65 + tile.y)}${String(tile.x + 1).padStart(2, "0")}. Send it to conservation.` : `${String.fromCharCode(65 + tile.y)}${String(tile.x + 1).padStart(2, "0")} opened to ${tile.layers[newDepth]}.`].filter(Boolean);
    messages.reverse().forEach((message) => { next = pushLog(next, message); });
    next = checkFailure(next);
    commitRun(next);
    setSelectedTile(tileId);
    addEffect(tile, target ? "CONTEXT FOUND" : `+${newDepth - tile.depth} LAYER`, target ? "find" : "soil");
    setShakeKey((value) => value + 1);
    if (ashInsight) setProfile((value) => ({ ...value, insight: value.insight + ashInsight }));
    if (target) {
      playSound("find");
      announce(`Recovered in context: ${target.name}. Align the seams in the lab.`);
    } else {
      playSound("dig");
      if (hazardMessage) announce(hazardMessage);
    }
    if (next.siteIndex === 3 && current.rivalProgress < 65 && next.rivalProgress >= 65) announce("Voss's crew has breached the outer seal. Recover the crown before they do.");
    if (next.status === "lost") {
      playSound("error");
      setModal("none");
    }
  };

  const rotateFragment = (index: number) => {
    const current = runRef.current;
    if (!current?.restoration || current.status !== "active") return;
    const rotations = [...current.restoration.rotations];
    rotations[index] = (rotations[index] + 1) % 4;
    commitRun({ ...current, restoration: { ...current.restoration, rotations } });
    playSound("repair");
  };

  const sealRestoration = () => {
    const current = runRef.current;
    if (!current?.restoration || current.status !== "active") return;
    const puzzle = current.restoration;
    const correct = puzzle.rotations.every((rotation, index) => rotation === puzzle.targetRotations[index]);
    const target = current.site.artifacts.find((artifact) => artifact.id === puzzle.artifactId);
    if (!target) {
      commitRun({ ...current, restoration: null });
      announce("The field record was incomplete. Returning to the trench.");
      return;
    }
    if (!correct) {
      let next = advanceTurn(current, profileRef.current.upgrades, 1);
      next = { ...next, restoration: { ...puzzle, mistakes: puzzle.mistakes + 1 } };
      next = pushLog(next, "A seam is still under tension. One work turn is spent resetting the adhesive.");
      next = checkFailure(next, true);
      commitRun(next);
      playSound("error");
      if (next.status === "lost") {
        setModal("none");
        announce("The lab has run out of time to stabilize the find.");
      } else announce("The seams do not meet. Rotate each shard and try again; the lab has used one turn.");
      return;
    }

    const quality = Math.max(1, Math.min(5, puzzle.condition + (puzzle.mistakes === 0 ? 1 : 0)));
    const relic: Relic = {
      id: target.id,
      key: target.key,
      name: target.name,
      period: target.period,
      theme: target.theme,
      mark: target.mark,
      note: target.note,
      rarity: target.rarity,
      siteIndex: current.siteIndex,
      siteName: current.site.name,
      quality,
      recoveredWith: puzzle.recoveredWith,
    };
    const next: Run = {
      ...current,
      inventory: [...current.inventory.filter((item) => item.id !== relic.id), relic],
      restoration: null,
      totalFinds: current.totalFinds + 1,
      reputation: Math.min(100, current.reputation + (quality >= 4 ? 2 : 1)),
      log: [`${relic.name} stabilized at quality ${quality}/5 and entered the collection.`, ...current.log].slice(0, 6),
    };
    commitRun(next);
    setProfile((value) => ({
      ...mergeArchive(value, relic),
      insight: value.insight + (target.mandatory ? 4 : 3),
    }));
    setShakeKey((value) => value + 1);
    playSound("restore");
    announce(`${relic.name} restored · ${quality}/5 condition · +${target.mandatory ? 4 : 3} insight`);
  };

  const refitTools = () => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    const cost = 16;
    if (current.funds < cost) {
      announce("The institute account cannot cover a field refit.");
      playSound("error");
      return;
    }
    const tools = { ...current.tools };
    (Object.keys(tools) as ToolId[]).forEach((tool) => {
      tools[tool] = Math.min(toolMax(tool, profileRef.current.upgrades), tools[tool] + (tool === "pick" ? 9 : 13));
    });
    if (Object.keys(tools).every((tool) => tools[tool as ToolId] === current.tools[tool as ToolId])) {
      announce("All implements are already at working strength.");
      return;
    }
    commitRun(pushLog({ ...current, tools, funds: current.funds - cost }, "The workshop has reset the field implements."));
    playSound("repair");
    announce("Implements refitted · 16 credits");
  };

  const orderSupplies = () => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    if (current.turnsLeft <= 0) {
      announce("The field permit has expired; no more supply orders can be delivered.");
      return;
    }
    if (current.funds < 12) {
      announce("The institute account cannot cover a supply crate.");
      playSound("error");
      return;
    }
    const next = advanceTurn({ ...current, funds: current.funds - 12, supplies: current.supplies + 3 }, profileRef.current.upgrades);
    const checked = checkFailure(pushLog(next, "A supply crate arrives. The rival uses the delay to close the gap."));
    commitRun(checked);
    playSound("repair");
    announce("Supply crate delivered · +3 field kits · one work turn used");
    if (checked.status === "lost") playSound("error");
  };

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    const current = runRef.current;
    if (!current || current.status !== "active" || current.difficulty === nextDifficulty) return;
    const oldBase = getTurns(current.difficulty, current.siteIndex, profileRef.current.upgrades);
    const newBase = getTurns(nextDifficulty, current.siteIndex, profileRef.current.upgrades);
    let next = {
      ...current,
      difficulty: nextDifficulty,
      turnsLeft: Math.max(0, current.turnsLeft + (newBase - oldBase)),
      turnsMax: Math.max(1, current.turnsMax + (newBase - oldBase)),
    };
    next = pushLog(next, `Field protocol changed to ${DIFFICULTIES[nextDifficulty].title.toLowerCase()}.`);
    next = checkFailure(next);
    commitRun(next);
    setDifficulty(nextDifficulty);
    playSound("restore");
  };

  const buyUpgrade = (upgradeId: string) => {
    const upgrade = UPGRADE_LIST.find((item) => item.id === upgradeId);
    if (!upgrade || profileRef.current.upgrades.includes(upgradeId)) return;
    if (profileRef.current.insight < upgrade.cost) {
      announce(`The institute needs ${upgrade.cost - profileRef.current.insight} more insight to fund this research.`);
      playSound("error");
      return;
    }
    setProfile((current) => ({ ...current, insight: current.insight - upgrade.cost, upgrades: [...current.upgrades, upgradeId] }));
    const current = runRef.current;
    if (current?.status === "active") {
      let next = current;
      if (upgradeId === "longDays") {
        next = { ...next, turnsLeft: next.turnsLeft + 5, turnsMax: next.turnsMax + 5 };
      }
      if (upgradeId === "alloy") {
        const tools = { ...next.tools };
        (Object.keys(tools) as ToolId[]).forEach((tool) => { tools[tool] += 5; });
        next = { ...next, tools };
      }
      next = pushLog(next, `${upgrade.name} is now active at the institute.`);
      commitRun(next);
    }
    playSound("win");
    announce(`${upgrade.name} added to permanent research.`);
  };

  const changeExhibit = (slot: number) => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    const slots = [...current.exhibits];
    if (selectedRelic) {
      const existing = slots.indexOf(selectedRelic);
      if (existing !== -1) slots[existing] = null;
      slots[slot] = selectedRelic;
      setSelectedRelic(null);
    } else {
      slots[slot] = null;
    }
    commitRun({ ...current, exhibits: slots });
    playSound("repair");
  };

  const fileReport = () => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    if (!requiredRestored(current)) {
      announce("The institute needs both commissioned relics restored before it will sign the report.");
      return;
    }
    const preview = getExhibitPreview(current, profileRef.current);
    const findsAtSite = current.inventory.filter((item) => item.siteIndex === current.siteIndex).length;
    const grant = preview.grant;
    const siteScore = grant + current.turnsLeft * 3 + preview.quality * 12 + current.site.integrity;
    const report: Report = { siteName: current.site.name, grant, finds: findsAtSite, score: siteScore };
    const reports = [...current.reports, report];
    let next: Run = {
      ...current,
      funds: current.funds + grant,
      reputation: preview.reputation,
      score: current.score + siteScore,
      reports,
    };
    setProfile((value) => ({ ...value, insight: value.insight + 3 + Math.max(0, findsAtSite - 2) * 2 + (preview.coherent ? 2 : 0) }));
    if (current.siteIndex === SITE_CONFIG.length - 1) {
      next = {
        ...next,
        status: "won",
        score: next.score + 120 + current.turnsLeft * 5,
        log: ["The Crown Below is catalogued. The commission is complete.", ...next.log].slice(0, 6),
      };
      const finalScore = next.score;
      setProfile((value) => ({ ...value, wins: value.wins + 1, bestScore: Math.max(value.bestScore, finalScore), insight: value.insight + 8 }));
      playSound("win");
      announce("The crown is safe. The four-site commission is complete.");
      commitRun(next);
      setModal("none");
      return;
    }

    const nextSiteIndex = current.siteIndex + 1;
    const turns = getTurns(current.difficulty, nextSiteIndex, profileRef.current.upgrades);
    const tools = { ...current.tools };
    (Object.keys(tools) as ToolId[]).forEach((tool) => {
      tools[tool] = Math.min(toolMax(tool, profileRef.current.upgrades), tools[tool] + (tool === "pick" ? 5 : 8));
    });
    next = {
      ...next,
      siteIndex: nextSiteIndex,
      site: makeSite(nextSiteIndex, current.seed),
      turnsLeft: turns,
      turnsMax: turns,
      supplies: Math.min(12, current.supplies + 3),
      tools,
      rivalProgress: 0,
      restoration: null,
      log: [`Grant filed for ${current.site.name}. The next permit is open.`, ...next.log].slice(0, 6),
    };
    commitRun(next);
    setPanel("field");
    setSelectedTool("brush");
    setSelectedTile("4-3");
    setSurveyMode(false);
    setSelectedRelic(null);
    setShakeKey((value) => value + 1);
    playSound("win");
    announce(`${SITE_CONFIG[nextSiteIndex].name} is cleared for excavation.`);
  };

  const enterPause = () => setModal((current) => current === "pause" ? "none" : "pause");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape" && screen === "title" && modal !== "none") {
        event.preventDefault();
        setModal("none");
        return;
      }
      if (screen !== "game" || !runRef.current || runRef.current.status !== "active") return;
      const inputFocused = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (event.key === "Escape") {
        event.preventDefault();
        setModal((current) => current === "pause" ? "none" : current === "manual" || current === "tutorial" || current === "replace" ? "none" : "pause");
        return;
      }
      if (inputFocused || modal !== "none") return;
      const live = runRef.current;
      if (!live) return;
      if (live.restoration) {
        if (event.key === "1" || event.key === "2" || event.key === "3") {
          rotateFragment(Number(event.key) - 1);
          event.preventDefault();
        } else if (event.key === "Enter") {
          sealRestoration();
          event.preventDefault();
        }
        return;
      }
      if (panel !== "field") return;
      if ((event.key === "Enter" || event.code === "Space") && target?.classList.contains("soil-tile")) {
        event.preventDefault();
        excavate(selectedTile);
        return;
      }
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const nextTool = (["brush", "trowel", "pick"] as ToolId[])[Number(event.key) - 1];
        if (nextTool && (live.tools[nextTool] > 0 || nextTool === "brush")) setSelectedTool(nextTool);
      } else if (event.key.toLowerCase() === "q") {
        setSurveyMode((current) => !current);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const cell = live.site.tiles.find((tile) => tile.id === selectedTile) ?? live.site.tiles[0];
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        const x = Math.max(0, Math.min(COLS - 1, cell.x + dx));
        const y = Math.max(0, Math.min(ROWS - 1, cell.y + dy));
        setSelectedTile(`${x}-${y}`);
      } else if ((event.key === "Enter" || event.code === "Space") && target?.tagName !== "BUTTON") {
        event.preventDefault();
        excavate(selectedTile);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, modal, panel, selectedTile, selectedTool, surveyMode]);

  const toggleSound = () => {
    if (!profileRef.current.soundEnabled) ensureAudio();
    setProfile((current) => ({ ...current, soundEnabled: !current.soundEnabled }));
  };

  const openFreshCampaign = () => {
    if (savedRun) setModal("replace");
    else startNewRun(difficulty);
  };

  const archiveItems = getGalleryItems(run, profile);

  return (
    <div className="app-root">
      <DustCanvas />
      {screen === "title" && (
        <div className="title-screen">
          <header className="landing-header">
            <div className="brand-lockup"><BrandMark /><span><strong>FIELD ARCHIVE</strong><small>INSTITUTE FOR DEEP TIME</small></span></div>
            <div className="landing-utilities">
              <button className="text-button" onClick={() => setScreen("archive")}>ARCHIVE <span>{profile.archive.length.toString().padStart(2, "0")}</span></button>
              <button className="icon-button" aria-label={profile.soundEnabled ? "Mute sound" : "Enable sound"} onClick={toggleSound}><SoundGlyph muted={!profile.soundEnabled} /></button>
              <button className="text-button" onClick={() => setModal("manual")}>FIELD MANUAL <span>?</span></button>
            </div>
          </header>

          <main className="title-main">
            <section className="title-copy">
              <p className="eyebrow"><span className="eyebrow-rule" /> EXPEDITION SERIES / 04 SITES</p>
              <h1>Archaeology<br /><em>of Ruin</em></h1>
              <p className="title-deck">The past is not lost. It is buried in the wrong order.</p>
              <p className="title-description">Cut careful paths through a changing record, outpace a rival expedition, and restore the objects that can rewrite a vanished world.</p>
              <div className="difficulty-select" role="group" aria-label="Choose expedition difficulty">
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => (
                  <button key={id} type="button" className={`difficulty-choice${difficulty === id ? " is-selected" : ""}`} onClick={() => setDifficulty(id)} aria-pressed={difficulty === id}>
                    <span className="choice-radio" />
                    <span className="choice-copy"><strong>{DIFFICULTIES[id].short}</strong><small>{DIFFICULTIES[id].description}</small></span>
                  </button>
                ))}
              </div>
              <div className="title-actions">
                {savedRun && <button className="button button--primary" onClick={continueRun}>Resume expedition <span className="button-arrow">-&gt;</span></button>}
                <button className={`button ${savedRun ? "button--quiet" : "button--primary"}`} onClick={openFreshCampaign}>{savedRun ? "Begin new campaign" : "Begin excavation"} <span className="button-arrow">-&gt;</span></button>
                <span className="keyboard-note">KEYBOARD + MOUSE / TOUCH READY</span>
              </div>
              <div className="title-footnote"><span>01</span> FOUR SITES / ONE COMMISSION <span className="footnote-divider" /> BEST SCORE {profile.bestScore.toLocaleString()}</div>
            </section>

            <section className="hero-illustration" aria-label="Cutaway illustration of an excavation grid">
              <div className="hero-art-heading"><span>FIELD PLATE / 07</span><span>40° 12' N &nbsp; 18° 44' E</span></div>
              <div className="hero-cutaway">
                <div className="hero-map-grid">
                  {Array.from({ length: 63 }, (_, index) => {
                    const x = index % 9;
                    const y = Math.floor(index / 9);
                    const isCut = x >= 3 && x <= 5 && y >= 2 && y <= 4;
                    const isRelic = x === 4 && y === 3;
                    return <span key={index} className={`hero-map-cell tone-${(x * 7 + y * 3 + (x > 4 ? 2 : 0)) % 6}${isCut ? " hero-map-cell--cut" : ""}${isRelic ? " hero-map-cell--relic" : ""}`}>{isRelic ? <b>R</b> : null}</span>;
                  })}
                </div>
                <div className="hero-strata-line hero-strata-line--one" />
                <div className="hero-strata-line hero-strata-line--two" />
                <div className="hero-compass"><span>N</span><i /><span>S</span></div>
              </div>
              <div className="hero-art-caption"><span>TRANSECT 04 / LAYER 03</span><span>FLOODPLAIN CUTAWAY</span></div>
              <div className="hero-layers"><span><i className="layer-swatch swatch-peat" />PEAT</span><span><i className="layer-swatch swatch-ash" />ASH LENS</span><span><i className="layer-swatch swatch-clay" />BLUE CLAY</span><span><i className="layer-swatch swatch-chalk" />CHALK</span></div>
            </section>
          </main>

          <footer className="landing-footer"><span>FIELD NOTES, VOLUME IV</span><span>AN ARCHIVE IS A PROMISE TO THE FUTURE.</span><span>EST. 1926</span></footer>
          {savedRun && <div className="saved-ribbon"><span className="live-dot" /> SAVED TRANSECT / {SITE_CONFIG[savedRun.siteIndex]?.name ?? "ACTIVE SITE"} / {savedRun.turnsLeft} TURNS REMAINING</div>}
        </div>
      )}

      {screen === "title" && (modal === "manual" || modal === "replace") && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal("none"); }}>
        {modal === "manual" && <section className="modal-panel manual-panel" role="dialog" aria-modal="true" aria-labelledby="title-manual"><div className="modal-topline"><span>FIELD MANUAL / QUICK REFERENCE</span><button className="modal-close" onClick={() => setModal("none")}>CLOSE <b>ESC</b></button></div><p className="eyebrow"><span className="eyebrow-rule" /> THE RECORD IS FRAGILE</p><h2 id="title-manual">Field notes<br /><em>for the living.</em></h2><div className="manual-columns"><div><span className="manual-index">01 / CONTROLS</span><p><b>Click a square</b> to excavate. Arrow keys move the selected square; Enter opens it. Press <b>1, 2, 3</b> for brush, trowel, or pick. Press <b>Q</b> to survey. Escape opens pause and settings.</p></div><div><span className="manual-index">02 / STRATIGRAPHY</span><p>Brushes protect objects. Picks cut two layers quickly but may damage finds or collapse loose sand. Trowels are balanced. Roots, rubble, water, sand, and ash layers change the cost of work.</p></div><div><span className="manual-index">03 / COLLECTION</span><p>Restore both commissioned objects, then file a report. Different museum themes make a coherent story. Research insight buys permanent methods. Voss advances on every work turn.</p></div></div><div className="hazard-legend"><span>FIELD HAZARDS</span>{(["roots", "rubble", "sand", "seep", "ash"] as Hazard[]).map((hazard) => <div key={hazard}><b>{HAZARD_INFO[hazard].short}</b><span><strong>{HAZARD_INFO[hazard].name}</strong><small>{HAZARD_INFO[hazard].detail}</small></span></div>)}</div><div className="manual-footer"><span>04 SITES / RESTORATION / MUSEUM / PERMANENT RESEARCH</span><button className="button button--primary" onClick={() => setModal("none")}>Close manual <span className="button-arrow">-&gt;</span></button></div></section>}
        {modal === "replace" && <section className="modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="title-replace"><div className="modal-topline"><span>CAMPAIGN CONTROL / UNSAVED FIELDWORK</span><button className="modal-close" onClick={() => setModal("none")}>CANCEL</button></div><p className="eyebrow"><span className="eyebrow-rule" /> CONFIRM RESTART</p><h2 id="title-replace">Close this<br /><em>expedition?</em></h2><p>The saved field permit will be discarded. Restored objects and permanent research already in the archive will remain safe.</p><div className="confirm-actions"><button className="button button--quiet" onClick={() => setModal("none")}>Keep saved expedition</button><button className="button button--primary" onClick={() => startNewRun(difficulty)}>Discard &amp; restart <span className="button-arrow">-&gt;</span></button></div></section>}
      </div>}

      {screen === "archive" && (
        <main className="archive-screen">
          <header className="game-topbar archive-topbar">
            <div className="brand-lockup"><BrandMark /><span><strong>FIELD ARCHIVE</strong><small>INSTITUTE COLLECTION / {profile.archive.length.toString().padStart(2, "0")} OBJECTS</small></span></div>
            <div className="topbar-actions"><button className="icon-button" aria-label={profile.soundEnabled ? "Mute sound" : "Enable sound"} onClick={toggleSound}><SoundGlyph muted={!profile.soundEnabled} /></button><button className="button button--quiet button--small" onClick={() => setScreen("title")}>Return to title</button><button className="button button--primary button--small" onClick={() => savedRun ? setScreen("title") : startNewRun(difficulty)}>New expedition <span className="button-arrow">-&gt;</span></button></div>
          </header>
          <section className="archive-heading"><p className="eyebrow"><span className="eyebrow-rule" /> CATALOGUE / PERMANENT COLLECTION</p><h1>What survived<br /><em>the digging.</em></h1><p>Restored objects remain in the institute collection across every expedition. Curate them into new stories for better field grants.</p></section>
          <div className="archive-meta"><span>{profile.wins.toString().padStart(2, "0")} COMMISSIONS COMPLETED</span><span>{profile.insight} RESEARCH INSIGHT</span><span>BEST FIELD SCORE {profile.bestScore.toLocaleString()}</span></div>
          {profile.archive.length ? <div className="archive-list">{[...profile.archive].reverse().map((relic, index) => <div className="archive-row" key={relic.id}><span className="archive-index">{String(index + 1).padStart(2, "0")}</span><span className="relic-mark">{relic.mark}</span><span className="archive-relic-name"><strong>{relic.name}</strong><small>{relic.siteName} / {relic.period}</small></span><span className="archive-theme">{relic.theme}</span><span className="quality-readout">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < relic.quality ? "quality-on" : ""} />)}</span></div>)}</div> : <div className="archive-empty"><span className="empty-sigil">--</span><p>No objects have entered the archive yet.</p><small>Your first careful restoration will be catalogued here.</small><button className="button button--primary" onClick={() => { setScreen("title"); }}>Start the first expedition <span className="button-arrow">-&gt;</span></button></div>}
          <footer className="archive-footer"><span>PERMANENT RESEARCH / {profile.upgrades.length} OF {UPGRADE_LIST.length} METHODS</span><span>FIELD ARCHIVE / NORTHERN INSTITUTE</span></footer>
        </main>
      )}

      {screen === "game" && run && run.status !== "active" && (
        <main className="ending-screen">
          <header className="landing-header"><div className="brand-lockup"><BrandMark /><span><strong>FIELD ARCHIVE</strong><small>FINAL FIELD REPORT / {run.status === "won" ? "APPROVED" : "CLOSED"}</small></span></div><button className="icon-button" aria-label={profile.soundEnabled ? "Mute sound" : "Enable sound"} onClick={toggleSound}><SoundGlyph muted={!profile.soundEnabled} /></button></header>
          <section className={`ending-composition${run.status === "won" ? " ending-composition--won" : ""}`}>
            <div className="ending-copy"><p className="eyebrow"><span className="eyebrow-rule" /> {run.status === "won" ? "COMMISSION COMPLETE / CROWN BASIN" : "EXPEDITION CLOSED / FIELD REPORT"}</p><h1>{run.status === "won" ? <>The past<br /><em>is in safe hands.</em></> : <>The record<br /><em>is incomplete.</em></>}</h1><p>{run.status === "won" ? "The Crown Below has been catalogued. Every layer, seam, and witness is now part of the public archive." : run.lossReason ?? "The expedition ended before the commission could be completed."}</p>
              <div className="ending-actions"><button className="button button--primary" onClick={() => setScreen("archive")}>Continue to the archive <span className="button-arrow">-&gt;</span></button><button className="button button--quiet" onClick={() => { setScreen("title"); setModal("none"); }}>Return to title</button><button className="button button--line" onClick={() => startNewRun(difficulty)}>{run.status === "won" ? "Begin another campaign" : "Retry the campaign"} <span className="button-arrow">-&gt;</span></button></div>
            </div>
            <div className="final-report"><div className="report-heading"><span>INSTITUTE REPORT</span><span>NO. {String(run.seed).slice(-5)}</span></div><div className="report-score"><small>FIELD SCORE</small><strong>{run.score.toLocaleString()}</strong><span>{run.status === "won" ? "COMMISSION ACCEPTED" : "COMMISSION UNFINISHED"}</span></div><div className="report-row"><span>SITES FILED</span><strong>{run.reports.length} / 4</strong></div><div className="report-row"><span>OBJECTS RESTORED</span><strong>{run.totalFinds}</strong></div><div className="report-row"><span>WORK ACTIONS</span><strong>{run.totalActions}</strong></div><div className="report-row"><span>RIVAL'S PEAK</span><strong>{Math.round(run.peakRival)}%</strong></div><div className="report-row"><span>FINAL REPUTATION</span><strong>{run.reputation}</strong></div><div className="report-site-list">{run.reports.map((report, index) => <div key={`${report.siteName}-${index}`}><span>{String(index + 1).padStart(2, "0")} / {report.siteName}</span><strong>+{report.grant}</strong></div>)}</div><div className="report-stamp">{run.status === "won" ? "CATALOGUED" : "FIELD CLOSED"}</div></div>
          </section>
          <footer className="landing-footer"><span>FIELD NOTES, VOLUME IV</span><span>AN ARCHIVE IS A PROMISE TO THE FUTURE.</span><span>EST. 1926</span></footer>
        </main>
      )}

      {screen === "game" && run?.status === "active" && (
        <main className="game-screen">
          <header className="game-topbar">
            <div className="brand-lockup"><BrandMark compact /><span><strong>FIELD ARCHIVE</strong><small>EXPEDITION / {run.seed.toString().slice(-5)}</small></span></div>
            <div className="topbar-site"><span className="topbar-kicker">CURRENT SITE</span><strong>{run.site.name}</strong><small>{run.site.region}</small></div>
            <div className="topbar-resources"><div><small>INSTITUTE FUND</small><strong><i className="credit-mark">C</i>{run.funds}</strong></div><div><small>REPUTATION</small><strong>{run.reputation}<span className="resource-unit">/100</span></strong></div><div><small>INSIGHT</small><strong>{profile.insight}<span className="resource-unit">PTS</span></strong></div></div>
            <div className="topbar-actions"><button className="icon-button" aria-label={profile.soundEnabled ? "Mute sound" : "Enable sound"} onClick={toggleSound}><SoundGlyph muted={!profile.soundEnabled} /></button><button className="button button--quiet button--small" onClick={() => setModal("manual")}>Manual <span className="key-hint">?</span></button><button className="button button--line button--small" onClick={enterPause}>Pause <span className="key-hint">ESC</span></button></div>
          </header>

          <div className="campaign-ribbon" aria-label="Campaign progress">
            {SITE_CONFIG.map((site, index) => {
              const complete = index < run.siteIndex;
              const current = index === run.siteIndex;
              return <div className={`campaign-stop${complete ? " is-complete" : ""}${current ? " is-current" : ""}`} key={site.name}><span className="campaign-node">{complete ? <b>+</b> : String(index + 1).padStart(2, "0")}</span><span className="campaign-stop-name">{site.name}</span></div>;
            })}
            <span className="campaign-ribbon-note">{run.siteIndex === 3 ? "CAPSTONE / PROFESSOR VOSS" : `${DIFFICULTIES[run.difficulty].short} PROTOCOL`}</span>
          </div>

          <nav className="workbench-nav" aria-label="Expedition stations">
            {(["field", "museum", "research"] as Panel[]).map((item) => <button key={item} className={`station-tab${panel === item ? " is-active" : ""}`} onClick={() => { setPanel(item); setSelectedRelic(null); }} aria-current={panel === item ? "page" : undefined}><span className="station-index">{item === "field" ? "01" : item === "museum" ? "02" : "03"}</span>{item === "field" ? "Excavation" : item === "museum" ? "Museum" : "Research"}{item === "museum" && run.inventory.length > 0 && <i className="tab-count">{run.inventory.length}</i>}{item === "research" && <i className="tab-count tab-count--insight">{profile.insight}</i>}</button>)}
            <span className="nav-spacer" />
            <span className="workbench-caption">{panel === "field" ? "FIELD OPERATIONS" : panel === "museum" ? "PUBLIC COLLECTION" : "INSTITUTE METHODS"} <span>/</span> VOL. IV</span>
          </nav>

          {panel === "field" && (() => {
            const selected = run.site.tiles.find((tile) => tile.id === selectedTile) ?? run.site.tiles[0];
            const discovered = run.inventory.filter((item) => item.siteIndex === run.siteIndex).length;
            const mandatory = run.site.artifacts.filter((item) => item.mandatory).length;
            const recoveredMandatory = run.site.artifacts.filter((item) => item.mandatory && run.inventory.some((relic) => relic.id === item.id)).length;
            const selectedSignal = selected?.signal;
            const selectedArtifact = selected ? run.site.artifacts.find((item) => item.x === selected.x && item.y === selected.y && !item.found) : undefined;
            const integrityPercent = Math.max(0, Math.min(100, run.site.integrity));
            return (
              <section className="workbench field-workbench">
                <div className="primary-workspace">
                  <div className="section-heading field-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> {run.site.region}</p><h2>The open <em>trench.</em></h2><p>{run.site.description}</p></div><div className="site-condition"><span>RECORD INTEGRITY</span><strong>{run.site.integrity}<small>%</small></strong><div className="mini-meter"><i style={{ width: `${integrityPercent}%` }} /></div></div></div>
                  <div className="dig-station">
                    <div className="map-heading"><span><b>GRID / 09 x 07</b><i /> {run.site.strataNote}</span><span>CLICK A SQUARE TO {surveyMode ? "READ ITS SIGNAL" : "EXCAVATE"}</span></div>
                    <div className="map-body">
                      <div className="map-coordinate map-coordinate--left">{Array.from({ length: ROWS }, (_, index) => <span key={index}>{String.fromCharCode(65 + index)}</span>)}</div>
                      <div className="map-content">
                        <div className="grid-viewport">
                          <div className={`dig-grid${shakeKey ? (shakeKey % 2 ? " shake-a" : " shake-b") : ""}`} role="grid" aria-label="Excavation grid">
                            {run.site.tiles.map((tile) => {
                              const layer = tile.layers[Math.min(tile.depth, tile.layers.length - 1)];
                              const hazard = tile.hazardTriggered ? HAZARD_INFO[tile.hazard] : undefined;
                              const inSurveyMode = surveyMode;
                              return <button type="button" key={tile.id} role="gridcell" aria-label={`Square ${String.fromCharCode(65 + tile.y)} ${tile.x + 1}, ${layer}, depth ${tile.depth}${hazard ? `, ${hazard.name}` : ""}${tile.signal ? `, ${tile.signal.strength}` : ""}`} aria-selected={selectedTile === tile.id} title={`${String.fromCharCode(65 + tile.y)}${String(tile.x + 1).padStart(2, "0")} / ${layer}${hazard ? ` / ${hazard.name}` : ""}`} onClick={() => excavate(tile.id)} disabled={run.turnsLeft <= 0 || Boolean(run.restoration)} className={`soil-tile stratum--${layerSlug(layer)}${tile.depth > 0 ? " is-open" : ""}${tile.depth >= tile.maxDepth ? " is-bedrock" : ""}${selectedTile === tile.id ? " is-selected" : ""}${inSurveyMode ? " survey-ready" : ""}${tile.signal ? ` signal-${tile.signal.distance === 0 ? "zero" : tile.signal.distance <= 2 ? "near" : "far"}` : ""}`}>
                                <span className="tile-depth">{tile.depth}</span>
                                {tile.signal && <span className="tile-signal">{tile.signal.distance === 0 ? "!" : Math.min(9, tile.signal.distance)}{tile.signal.bearing && <i>{tile.signal.bearing}</i>}</span>}
                                {hazard && <span className="tile-hazard" title={hazard.name}>{hazard.short}</span>}
                                {tile.artifactFound && <span className="tile-found">R</span>}
                                {selectedArtifact && selectedTile === tile.id && tile.depth > 0 && <span className="tile-context">?</span>}
                              </button>;
                            })}
                          </div>
                        </div>
                        {effects.map((effect) => <div key={effect.id} className={`map-effect map-effect--${effect.kind}`} style={{ left: `${effect.left}%`, top: `${effect.top}%` }}><span>{effect.text}</span><i /><i /><i /></div>)}
                        <div className="map-coordinate map-coordinate--bottom">{Array.from({ length: COLS }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
                      </div>
                    </div>
                    <div className="map-legend"><span><i className="legend-chip legend-chip--surface" />SURFACE</span><span><i className="legend-chip legend-chip--ash" />ASH LENS</span><span><i className="legend-chip legend-chip--clay" />CLAY</span><span><i className="legend-chip legend-chip--bedrock" />BEDROCK</span><span className="legend-tail">DEPTH COUNTS EXPOSED LAYERS</span></div>
                  </div>

                  <div className="tool-bench">
                    <div className="tool-bench-label"><span>FIELD IMPLEMENTS</span><small>1 / 2 / 3 TO SELECT</small></div>
                    <div className="tool-rack">
                      {(["brush", "trowel", "pick"] as ToolId[]).map((tool, index) => {
                        const maximum = toolMax(tool, profile.upgrades);
                        const durability = Math.max(0, Math.min(maximum, run.tools[tool]));
                        return <button key={tool} type="button" onClick={() => { setSelectedTool(tool); setSurveyMode(false); }} className={`tool-choice${selectedTool === tool ? " is-selected" : ""}${durability === 0 && tool !== "brush" ? " is-worn" : ""}`} aria-pressed={selectedTool === tool}>
                          <span className="tool-glyph"><ToolGlyph tool={tool} /></span><span className="tool-copy"><strong>{tool === "brush" ? "Brush" : tool === "trowel" ? "Trowel" : "Pick"}<i>{index + 1}</i></strong><small>{tool === "brush" ? "1 layer / precise" : tool === "trowel" ? "1 layer / steady" : "2 layers / forceful"}</small><span className="tool-meter"><i style={{ width: `${maximum > 0 ? (durability / maximum) * 100 : 0}%` }} /></span><small className="tool-durability">{durability === 0 && tool === "brush" ? "HAND BRUSH / SLOW" : `${durability} / ${maximum} EDGE`}</small></span>
                        </button>;
                      })}
                      <button type="button" className={`survey-control${surveyMode ? " is-active" : ""}`} onClick={() => { setSurveyMode((value) => !value); playSound("survey"); }} aria-pressed={surveyMode}><span className="survey-lens" /><strong>Survey</strong><small>Q / 1 turn</small></button>
                    </div>
                    <div className="tool-bench-foot"><span>{selectedTool === "brush" ? "A soft pass keeps fragile evidence intact." : selectedTool === "trowel" ? "A reliable cut for ordinary layers." : "Fast through deep soil; never strike over a known find."}</span><button className="small-action" onClick={refitTools} disabled={run.funds < 16 || (run.tools.brush >= toolMax("brush", profile.upgrades) && run.tools.trowel >= toolMax("trowel", profile.upgrades) && run.tools.pick >= toolMax("pick", profile.upgrades))}>REFIT IMPLEMENTS <b>16 C</b></button></div>
                  </div>
                </div>

                <aside className="field-sidebar">
                  <div className="side-section work-allowance"><div className="side-label"><span>FIELD ALLOWANCE</span><span>{DIFFICULTIES[run.difficulty].short}</span></div><div className="turns-readout"><strong>{run.turnsLeft.toString().padStart(2, "0")}</strong><span>/ {run.turnsMax} WORK<br />TURNS LEFT</span></div><div className="long-meter"><i style={{ width: `${run.turnsMax ? (run.turnsLeft / run.turnsMax) * 100 : 0}%` }} /></div><button className="supply-order" onClick={orderSupplies} disabled={run.funds < 12 || run.turnsLeft <= 0}><span>ORDER A FIELD CRATE</span><strong>+3 KITS <i>12 C / 1 TURN</i></strong></button><div className="field-supply-line"><span>SUPPLIES <b>{run.supplies}</b></span><span>RIVAL PRESSURE <b>{Math.round(run.rivalProgress)}%</b></span></div></div>

                  <div className="side-section rival-section"><div className="side-label"><span>COMPETING EXPEDITION</span><span>{run.siteIndex === 3 ? "CAPSTONE" : `SITE 0${run.siteIndex + 1}`}</span></div><div className="rival-name"><span className="rival-sigil">V</span><span><strong>PROF. ELIAS VOSS</strong><small>{run.rivalProgress >= 65 ? "AT THE SEALED CHAMBER" : "NORTH SHAFT / ADVANCING"}</small></span></div><div className="rival-meter"><i style={{ width: `${Math.max(0, Math.min(100, run.rivalProgress))}%` }} /></div><p>{run.rivalProgress >= 65 ? "His crew has found the lower strata. You cannot afford another blind cut." : "Every work turn gives Voss's surveyors time to close the gap."}</p>{run.siteIndex === 3 && <div className="boss-warning"><span className="live-dot" /> VOSS / CROWN BREACH {Math.round(run.rivalProgress)}%</div>}</div>

                  <div className="side-section selected-square"><div className="side-label"><span>ACTIVE SQUARE</span><span>{String.fromCharCode(65 + (selected?.y ?? 0))}{String((selected?.x ?? 0) + 1).padStart(2, "0")}</span></div><div className="selected-layer"><span className={`selected-layer-swatch stratum--${layerSlug(selected?.layers[Math.min(selected.depth, selected.layers.length - 1)] ?? "PEAT")}`} /><div><strong>{selected?.layers[Math.min(selected.depth, selected.layers.length - 1)] ?? "NO LAYER"}</strong><small>EXPOSED DEPTH {selected?.depth ?? 0} / {selected?.maxDepth ?? 0}</small></div></div>{selectedSignal ? <div className={`signal-readout${selectedSignal.distance === 0 ? " signal-readout--strong" : ""}`}><span className="signal-pulse" /><span><strong>{selectedSignal.strength}</strong><small>{selectedSignal.distance === 0 ? "A relic lies directly below." : `${selectedSignal.distance} square${selectedSignal.distance === 1 ? "" : "s"} from this reading.`}{selectedSignal.bearing ? ` Bearing ${selectedSignal.bearing}.` : ""}</small></span></div> : <p className="square-help">{selected?.hazardTriggered ? HAZARD_INFO[selected.hazard].detail : selected?.depth === selected?.maxDepth ? "Bedrock recorded. Select another square." : "Choose this square to open the next layer."}</p>}{selected?.hazardTriggered && <div className="hazard-readout"><span>STRATIGRAPHIC OBSTRUCTION</span><strong>{HAZARD_INFO[selected.hazard].name}</strong></div>}</div>

                  <div className="side-section commissions"><div className="side-label"><span>COMMISSIONED OBJECTS</span><span>{recoveredMandatory}/{mandatory} RESTORED</span></div>{run.site.artifacts.filter((artifact) => artifact.mandatory).map((artifact, index) => { const relic = run.inventory.find((item) => item.id === artifact.id); return <div className={`commission-line${relic ? " is-restored" : artifact.found ? " is-opened" : ""}`} key={artifact.id}><span className="commission-number">0{index + 1}</span><span>{artifact.name}</span><b>{relic ? `${relic.quality}/5` : artifact.found ? "LAB" : "SEALED"}</b></div>; })}<button className="sidebar-link" onClick={() => setPanel("museum")}>{recoveredMandatory === mandatory ? "OPEN THE MUSEUM REPORT" : `${discovered} OBJECT${discovered === 1 ? "" : "S"} IN COLLECTION`} <span>-&gt;</span></button></div>

                  <div className="side-section field-log"><div className="side-label"><span>FIELD LOG</span><span>LIVE</span></div>{run.log.slice(0, 3).map((line, index) => <p key={`${line}-${index}`} className={index === 0 ? "log-latest" : ""}><i>{String(index + 1).padStart(2, "0")}</i>{line}</p>)}</div>
                </aside>
              </section>
            );
          })()}

          {panel === "museum" && (() => {
            const items = archiveItems;
            const byId = new Map(items.map((item) => [item.id, item]));
            const preview = getExhibitPreview(run, profile);
            const mandatory = run.site.artifacts.filter((artifact) => artifact.mandatory).length;
            const restored = run.site.artifacts.filter((artifact) => artifact.mandatory && run.inventory.some((relic) => relic.id === artifact.id)).length;
            const ready = restored === mandatory;
            return <section className="museum-workbench">
              <div className="section-heading museum-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> CURATION / SITE {String(run.siteIndex + 1).padStart(2, "0")}</p><h2>Give the finds<br /><em>a second life.</em></h2><p>A coherent exhibition gives the institute a stronger story to fund. Place three different themes to earn a narrative bonus.</p></div><div className="museum-heading-mark"><span>PUBLIC<br />TRUST</span><strong>{run.reputation}<small>/100</small></strong></div></div>
              <div className="museum-layout">
                <div className="museum-main">
                  <div className="plinth-heading"><span>THE SMALL GALLERY / THREE PLINTHS</span><span>{preview.displayed.length} / 3 OBJECTS DISPLAYED</span></div>
                  <div className="plinth-row">{run.exhibits.map((id, index) => { const relic = id ? byId.get(id) : undefined; return <button key={index} type="button" className={`exhibit-plinth${relic ? " has-relic" : ""}${selectedRelic ? " can-place" : ""}`} onClick={() => changeExhibit(index)} aria-label={`${relic ? `Plinth ${index + 1}: ${relic.name}` : `Empty plinth ${index + 1}`}. ${selectedRelic ? "Click to place selected object." : "Click to clear."}`}><span className="plinth-number">PLINTH / 0{index + 1}</span>{relic ? <><span className="plinth-mark">{relic.mark}</span><strong>{relic.name}</strong><small>{relic.theme.toUpperCase()} / QUALITY {relic.quality}</small><span className="plinth-base" /></> : <><span className="empty-plinth">+</span><strong>{selectedRelic ? "PLACE SELECTED OBJECT" : "EMPTY DISPLAY"}</strong><small>SELECT A FIND BELOW</small><span className="plinth-base" /></>}</button>; })}</div>
                  <div className="collection-heading"><span>INSTITUTE COLLECTION</span><span>{items.length} CATALOGUED OBJECT{items.length === 1 ? "" : "S"}</span></div>
                  {items.length ? <div className="collection-list">{items.map((relic) => { const selected = selectedRelic === relic.id; const displayed = run.exhibits.includes(relic.id); return <button key={relic.id} className={`collection-item${selected ? " is-selected" : ""}${displayed ? " is-displayed" : ""}`} onClick={() => { setSelectedRelic(selected ? null : relic.id); playSound("repair"); }} aria-pressed={selected}><span className="collection-mark">{relic.mark}</span><span className="collection-name"><strong>{relic.name}</strong><small>{relic.siteName} / {relic.period}</small></span><span className="collection-theme">{relic.theme}</span><span className="quality-readout">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < relic.quality ? "quality-on" : ""} />)}</span><span className="collection-action">{displayed ? "DISPLAYED" : selected ? "SELECTED" : "PLACE +"}</span></button>; })}</div> : <div className="collection-empty">Your first restored object will be catalogued here. Return to the trench to begin.</div>}
                  <div className="museum-guidance"><span className="guidance-mark">i</span><span>{selectedRelic ? "Now choose an empty plinth. Selecting an occupied plinth moves the object." : "Select an object, then choose a plinth. Click an occupied plinth to clear it."}</span><button onClick={() => { const current = runRef.current; if (current) commitRun({ ...current, exhibits: [null, null, null] }); setSelectedRelic(null); }}>CLEAR DISPLAY</button></div>
                </div>
                <aside className="museum-aside">
                  <div className="museum-score"><span className="side-label"><span>EXHIBITION OUTLOOK</span><span>LIVE ESTIMATE</span></span><div className="grant-preview"><small>PROJECTED GRANT</small><strong><i>C</i>{preview.grant}</strong></div><div className="outlook-row"><span>OBJECTS DISPLAYED</span><strong>{preview.displayed.length} / 3</strong></div><div className="outlook-row"><span>THEMES IN DIALOGUE</span><strong>{preview.themes.size}</strong></div><div className="outlook-row"><span>OBJECT QUALITY</span><strong>{preview.quality} / 15</strong></div>{preview.coherent ? <div className="coherence-note"><i>+</i><span><strong>COHERENT NARRATIVE</strong><small>Three themes in conversation / +14 credits</small></span></div> : <div className="coherence-hint">A different theme on every plinth completes a coherent narrative.</div>}</div>
                  <div className="site-report-status"><div className="side-label"><span>FIELD COMMISSION</span><span>{restored}/{mandatory}</span></div>{run.site.artifacts.filter((artifact) => artifact.mandatory).map((artifact) => <div key={artifact.id} className="report-commission"><i className={run.inventory.some((relic) => relic.id === artifact.id) ? "check-mark" : ""}>{run.inventory.some((relic) => relic.id === artifact.id) ? "+" : "-"}</i><span>{artifact.name}</span><small>{run.inventory.some((relic) => relic.id === artifact.id) ? "STABILIZED" : artifact.found ? "IN CONSERVATION" : "NOT RECOVERED"}</small></div>)}<button className="button button--primary report-button" onClick={fileReport} disabled={!ready}>{ready ? `File site report / +${preview.grant} C` : `Restore ${mandatory - restored} commissioned object${mandatory - restored === 1 ? "" : "s"} first`} <span className="button-arrow">-&gt;</span></button><small className="report-button-note">{run.siteIndex === 3 ? "FINAL REPORT / CAMPAIGN COMPLETE" : "A new site permit follows approval."}</small></div>
                  <div className="museum-reputation"><span>INSTITUTE REPUTATION</span><div className="mini-meter"><i style={{ width: `${run.reputation}%` }} /></div><small>Public support improves the next field grant.</small></div>
                </aside>
              </div>
            </section>;
          })()}

          {panel === "research" && <section className="research-workbench">
            <div className="section-heading research-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> INSTITUTE / PERMANENT METHODS</p><h2>Better tools.<br /><em>Better questions.</em></h2><p>Spend insight earned from discoveries on methods that change every future expedition. Unlocks persist between campaigns.</p></div><div className="insight-ledger"><span>AVAILABLE INSIGHT</span><strong>{profile.insight}<small>PTS</small></strong><small>{profile.upgrades.length} / {UPGRADE_LIST.length} METHODS ACTIVE</small></div></div>
            <div className="research-intro"><span>FIELD RESEARCH / TREE 01</span><span>UNLOCKED METHODS APPLY IMMEDIATELY</span></div>
            <div className="research-grid">{UPGRADE_LIST.map((upgrade, index) => { const unlocked = profile.upgrades.includes(upgrade.id); const affordable = profile.insight >= upgrade.cost; return <article className={`research-method${unlocked ? " is-unlocked" : ""}`} key={upgrade.id}><div className="method-top"><span>{upgrade.code}</span><span>{unlocked ? "ACTIVE" : `0${index + 1}`}</span></div><div className={`method-seal${unlocked ? " is-lit" : ""}`}><span>{String(index + 1).padStart(2, "0")}</span></div><h3>{upgrade.name}</h3><p>{upgrade.detail}</p><div className="method-effect"><span>FIELD EFFECT</span><small>{upgrade.effect}</small></div><button className={`method-button${unlocked ? " is-active" : ""}`} disabled={unlocked || !affordable} onClick={() => buyUpgrade(upgrade.id)}>{unlocked ? "RESEARCH COMPLETE" : affordable ? `AUTHORIZE / ${upgrade.cost} INSIGHT` : `NEED ${upgrade.cost - profile.insight} MORE INSIGHT`} {!unlocked && <span>-&gt;</span>}</button></article>; })}</div>
            <div className="research-footnote"><span>INSIGHT IS AWARDED FOR RESTORED FINDS, ASH LENSES, AND FILED SITE REPORTS.</span><span>PERMANENT RESEARCH / {profile.upgrades.length} ACTIVE</span></div>
          </section>}

          <footer className="game-footer"><span>ARCHAEOLOGY OF RUIN <i>/</i> FIELD JOURNAL</span><span>{run.totalActions.toString().padStart(3, "0")} ACTIONS RECORDED <i>/</i> {run.totalFinds.toString().padStart(2, "0")} OBJECTS RESTORED</span><button onClick={() => setScreen("title")}>SAVE & RETURN TO TITLE <span>-&gt;</span></button></footer>

          {run.restoration && modal !== "pause" && modal !== "manual" && modal !== "tutorial" && modal !== "replace" && (() => {
            const target = run.site.artifacts.find((artifact) => artifact.id === run.restoration?.artifactId);
            if (!target) return null;
            const puzzle = run.restoration;
            return <div className="modal-scrim restoration-scrim"><section className="restoration-modal" role="dialog" aria-modal="true" aria-labelledby="restoration-title"><div className="modal-topline"><span>CONSERVATION LAB / EMERGENCY BENCH</span><span>NO. {String(run.totalFinds + 1).padStart(2, "0")}</span></div><div className="restoration-intro"><div className="relic-mark restoration-mark">{target.mark}</div><div><p className="eyebrow"><span className="eyebrow-rule" /> FRAGILE CONTEXT / {target.rarity}</p><h2 id="restoration-title">Restore the<br /><em>{target.name}.</em></h2><p>{target.note}</p></div></div><div className="condition-row"><span>FIELD CONDITION</span><div className="quality-readout">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < puzzle.condition ? "quality-on" : ""} />)}</div><strong>{puzzle.condition}/5</strong></div><p className="puzzle-instruction">Rotate each shard until its seam points in the same direction as the ghost line. A failed seal costs one work turn.</p><div className="shard-row">{puzzle.rotations.map((rotation, index) => <div className={`shard-card${rotation === puzzle.targetRotations[index] ? " is-aligned" : ""}`} key={index}><span className="shard-number">FRAGMENT / 0{index + 1}</span><div className="shard-alignment"><div><small>GHOST SEAM</small><SeamArrow rotation={puzzle.targetRotations[index]} /></div><span className="alignment-rule" /><button type="button" aria-label={`Rotate fragment ${index + 1} clockwise`} onClick={() => rotateFragment(index)}><small>YOUR SHARD</small><SeamArrow rotation={rotation} /><b>ROTATE +90</b></button></div><span className="shard-status">{rotation === puzzle.targetRotations[index] ? "SEAM ALIGNED" : "CLICK TO ROTATE"}</span></div>)}</div><div className="restoration-footer"><span>{puzzle.mistakes ? `${puzzle.mistakes} FAILED SEAL${puzzle.mistakes === 1 ? "" : "S"} / QUALITY MAY FALL` : "FIRST ATTEMPT BONUS / +1 QUALITY"}<small>KEYS 1, 2, 3 ROTATE / ENTER TO SEAL</small></span><button className="button button--primary" onClick={sealRestoration}>Stabilize object <span className="button-arrow">-&gt;</span></button></div></section></div>;
          })()}

          {modal !== "none" && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && (modal === "manual" || modal === "pause")) setModal("none"); }}>
            {modal === "pause" && <section className="modal-panel pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div className="modal-topline"><span>FIELD OPERATIONS / SETTINGS</span><span>ESC TO RETURN</span></div><p className="eyebrow"><span className="eyebrow-rule" /> EXPEDITION PAUSED</p><h2 id="pause-title">Take a breath.<br /><em>Read the ground.</em></h2><div className="settings-group"><div className="settings-label"><span>FIELD PRESSURE</span><small>Changes remaining permit and rival pace.</small></div><div className="settings-difficulty">{(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => <button key={id} className={run.difficulty === id ? "is-selected" : ""} onClick={() => changeDifficulty(id)}><strong>{DIFFICULTIES[id].short}</strong><small>{DIFFICULTIES[id].title}</small></button>)}</div></div><div className="settings-group sound-settings"><div className="settings-label"><span>SOUND / SYNTH ENGINE</span><button className="sound-toggle" onClick={toggleSound}>{profile.soundEnabled ? "ON" : "MUTED"}</button></div><label className="volume-control"><span>MASTER VOLUME</span><input aria-label="Master volume" type="range" min="0" max="1" step="0.01" value={profile.volume} onChange={(event) => setProfile((current) => ({ ...current, volume: Number(event.target.value) }))} /><strong>{Math.round(profile.volume * 100)}%</strong></label><small className="settings-note">Synthesized field tones react to rival pressure. Audio begins after your first input.</small></div><div className="pause-actions"><button className="button button--primary" onClick={() => setModal("none")}>Return to the field <span className="button-arrow">-&gt;</span></button><button className="button button--quiet" onClick={() => setModal("manual")}>Open field manual</button><button className="button button--line" onClick={() => setModal("replace")}>Restart campaign</button><button className="button button--quiet" onClick={() => { setModal("none"); setScreen("title"); }}>Save & return to title</button></div></section>}

            {modal === "manual" && <section className="modal-panel manual-panel" role="dialog" aria-modal="true" aria-labelledby="manual-title"><div className="modal-topline"><span>FIELD MANUAL / QUICK REFERENCE</span><button className="modal-close" onClick={() => setModal("none")} aria-label="Close field manual">CLOSE <b>ESC</b></button></div><p className="eyebrow"><span className="eyebrow-rule" /> THE RECORD IS FRAGILE</p><h2 id="manual-title">Field notes<br /><em>for the living.</em></h2><div className="manual-columns"><div><span className="manual-index">01 / CONTROLS</span><p><b>Click a square</b> to excavate. Arrow keys move the selected square; Enter opens it. On keyboard, press <b>1, 2, 3</b> to choose brush, trowel, or pick. Press <b>Q</b> to survey the selected square.</p><p><b>Escape</b> opens pause and settings. In the restoration lab, click a shard or press 1, 2, 3 to rotate it; Enter seals the seams.</p></div><div><span className="manual-index">02 / STRATIGRAPHY</span><p>Brushes protect objects. Picks cut two layers quickly but can chip a find or collapse loose sand. Trowels are reliable. Refit worn tools with credits; a hand brush remains available at a slower pace.</p><p>Root lattices, masonry, running sand, rising water, and ash lenses change the cost of a dig. Supplies pump wet squares. A survey reads the nearest buried object; the Resonance Lens adds its bearing.</p></div><div><span className="manual-index">03 / COLLECTION</span><p>Restore both commissioned objects to file a site report. Optional finds reward insight. Display different themes in the museum for a coherent-narrative grant.</p><p>Research unlocks permanent tools. Professor Voss advances every time you work. On the final site, his crew enters a faster capstone phase at 65% pressure.</p></div></div><div className="hazard-legend"><span>FIELD HAZARDS</span>{(["roots", "rubble", "sand", "seep", "ash"] as Hazard[]).map((hazard) => <div key={hazard}><b>{HAZARD_INFO[hazard].short}</b><span><strong>{HAZARD_INFO[hazard].name}</strong><small>{HAZARD_INFO[hazard].detail}</small></span></div>)}</div><div className="manual-footer"><span>04 SITES / 02 COMMISSIONED FINDS PER SITE / ONE RIVAL</span><button className="button button--primary" onClick={() => setModal("none")}>Back to the field <span className="button-arrow">-&gt;</span></button></div></section>}

            {modal === "tutorial" && <section className="modal-panel tutorial-panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="modal-topline"><span>FIRST EXPEDITION / INTERACTIVE BRIEFING</span><span>{String(tutorialStep + 1).padStart(2, "0")} / 03</span></div><div className="tutorial-progress">{TUTORIAL.map((item, index) => <i key={item.tag} className={index <= tutorialStep ? "is-active" : ""} />)}</div><p className="eyebrow"><span className="eyebrow-rule" /> {TUTORIAL[tutorialStep].tag}</p><h2 id="tutorial-title">{TUTORIAL[tutorialStep].title}</h2><p className="tutorial-copy">{TUTORIAL[tutorialStep].text}</p><div className="tutorial-tip"><span>FIELD CONTROL</span><strong>{tutorialStep === 0 ? "CLICK A GRID SQUARE TO DIG / Q TO SURVEY" : tutorialStep === 1 ? "1 BRUSH / 2 TROWEL / 3 PICK / ESC PAUSE" : "RESTORE BOTH COMMISSIONED OBJECTS, THEN FILE THE REPORT"}</strong></div><div className="tutorial-footer"><button className="button button--quiet" onClick={finishTutorial}>Skip briefing</button><div>{tutorialStep > 0 && <button className="button button--line" onClick={() => setTutorialStep((step) => Math.max(0, step - 1))}>Previous</button>}<button className="button button--primary" onClick={() => tutorialStep < TUTORIAL.length - 1 ? setTutorialStep((step) => step + 1) : finishTutorial()}>{tutorialStep < TUTORIAL.length - 1 ? "Next field note" : "Start excavating"} <span className="button-arrow">-&gt;</span></button></div></div></section>}

            {modal === "replace" && <section className="modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="replace-title"><div className="modal-topline"><span>CAMPAIGN CONTROL / UNSAVED FIELDWORK</span><button className="modal-close" onClick={() => setModal("none")}>CANCEL</button></div><p className="eyebrow"><span className="eyebrow-rule" /> CONFIRM RESTART</p><h2 id="replace-title">Close this<br /><em>expedition?</em></h2><p>The current field permit will be discarded. Restored objects and permanent research already in the archive will remain safe.</p><div className="confirm-actions"><button className="button button--quiet" onClick={() => setModal("none")}>Keep excavating</button><button className="button button--primary" onClick={() => startNewRun(run?.difficulty ?? difficulty)}>Discard & restart <span className="button-arrow">-&gt;</span></button></div></section>}
          </div>}
        </main>
      )}

      {notice && <div key={notice.id} className="game-notice" role="status"><i />{notice.text}</div>}
    </div>
  );
}