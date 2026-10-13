import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOSS_INFO,
  DEFAULT_PROFILE,
  DIFFICULTIES,
  ITEM_INFO,
  RECIPES,
  biomeName,
  bossStatus,
  buildCabin,
  canCraft,
  craftRecipe,
  createGame,
  drawGame,
  formatClock,
  objectiveText,
  openNearbyChest,
  phaseName,
  setDifficulty as setGameDifficulty,
  stepGame,
  summonBoss,
  tradeNpc,
  useWard,
  type DifficultyId,
  type GameState,
  type MetaProfile,
  type MetaUpgrades,
  type Recipe,
} from "./game";

type Screen = "title" | "playing" | "paused" | "gameover" | "victory";
type Panel = "none" | "help" | "craft" | "inventory" | "camp" | "settings" | "map" | "bosses" | "keepsakes";
type CraftFilter = "All" | Recipe["category"];
type AudioEngine = { context: AudioContext; master: GainNode; timer: number | null; beat: number };

const PROFILE_KEY = "moonroot-profile-v1";
const DIFFICULTY_KEY = "moonroot-difficulty-v1";
const RESIDENTS = [
  { name: "Moss", title: "Forester", offer: "8 heartwood for 8 coins", color: "#91b976" },
  { name: "Pip", title: "Tinker", offer: "2 healing tonics for 12 coins", color: "#d0a26e" },
  { name: "Nima", title: "Wayfarer", offer: "3 iron ingots for 16 coins", color: "#8daeb2" },
  { name: "Sol", title: "Oracle", offer: "3 moonshards for 20 coins", color: "#b09ad5" },
];

const HELP_PAGES = [
  {
    eyebrow: "01 / Find your feet",
    title: "The grove is a map, not a menu.",
    copy: "Follow the green canopy to find copper. The terrain changes as you dig: shale gives way to glowcap caves, deepglass, and the old infernal layers. Light is safety, but the seams are where the story starts.",
    keys: ["A / D or arrows", "Move", "Space / W", "Jump"],
  },
  {
    eyebrow: "02 / Read the ground",
    title: "Hold to mine. Make room to build.",
    copy: "Point at a nearby tile and hold the left mouse button. Ore takes longer than loam. Right-click places your selected block or station. Open a sealed cache with G when you are close enough.",
    keys: ["Mouse 1", "Mine", "Mouse 2", "Place selected"],
  },
  {
    eyebrow: "03 / Make a mark",
    title: "The altar turns finds into futures.",
    copy: "E opens recipes; use the forge to smelt ore, then make a better pick and blade at the workbench. Build a cabin in the Camp ledger to invite a resident. Their trades can bridge a bad run.",
    keys: ["E", "Crafting", "I / C / B", "Pack / camp / bosses"],
  },
  {
    eyebrow: "04 / Hunt the hush",
    title: "Five seals. One world that remembers.",
    copy: "Craft each boss seal at the rune altar, then use the Boss ledger to call the next guardian. The third victory awakens hardmode, reseeding the deep with Emberstone and Star ore. Rootfall invasions begin after the first boss.",
    keys: ["F", "Blade", "R", "Bow shot", "Q", "Use tonic"],
  },
];

const UPGRADE_INFO: { key: keyof MetaUpgrades; name: string; description: string; glyph: string; base: number }[] = [
  { key: "vitality", name: "Heartwood core", description: "+18 starting health each rank.", glyph: "+HP", base: 4 },
  { key: "quarry", name: "Deep hands", description: "+20% mining speed each rank.", glyph: "+PICK", base: 4 },
  { key: "edge", name: "Moonlit edge", description: "+3 damage on every descent.", glyph: "+DMG", base: 5 },
  { key: "fortune", name: "Forager's pull", description: "A wider salvage magnet; rarer drops linger.", glyph: "+LOOT", base: 4 },
];

function loadProfile(): MetaProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<MetaProfile> | null;
    if (!parsed) return DEFAULT_PROFILE;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      upgrades: { ...DEFAULT_PROFILE.upgrades, ...(parsed.upgrades ?? {}) },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function loadDifficulty(): DifficultyId {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY);
    return value === "gentle" || value === "hardcore" ? value : "standard";
  } catch {
    return "standard";
  }
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const screenRef = useRef<Screen>("title");
  const panelRef = useRef<Panel>("none");
  const profileRef = useRef<MetaProfile>(DEFAULT_PROFILE);
  const difficultyRef = useRef<DifficultyId>("standard");
  const volumeRef = useRef(0.58);
  const mutedRef = useRef(false);
  const finishRef = useRef<(ending: "gameover" | "victory") => void>(() => undefined);
  const startRef = useRef<() => void>(() => undefined);
  const playEffectRef = useRef<(name: string) => void>(() => undefined);

  const [profile, setProfile] = useState<MetaProfile>(loadProfile);
  const [difficulty, setDifficulty] = useState<DifficultyId>(loadDifficulty);
  const [screen, setScreen] = useState<Screen>("title");
  const [panel, setPanel] = useState<Panel>("none");
  const [volume, setVolume] = useState(0.58);
  const [muted, setMuted] = useState(false);
  const [shakeOn, setShakeOn] = useState(true);
  const [craftFilter, setCraftFilter] = useState<CraftFilter>("All");
  const [helpPage, setHelpPage] = useState(0);
  const [revision, setRevision] = useState(0);

  profileRef.current = profile;
  difficultyRef.current = difficulty;
  volumeRef.current = volume;
  mutedRef.current = muted;
  screenRef.current = screen;
  panelRef.current = panel;

  if (!gameRef.current) gameRef.current = createGame(difficulty, profile.upgrades);
  const changeScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    if (next !== "playing" && gameRef.current) {
      gameRef.current.input.keys.clear();
      gameRef.current.input.left = false;
      gameRef.current.input.right = false;
    }
    setScreen(next);
  }, []);
  const changePanel = useCallback((next: Panel) => {
    panelRef.current = next;
    setPanel(next);
    if (gameRef.current && next !== "none") {
      gameRef.current.input.keys.clear();
      gameRef.current.input.left = false;
      gameRef.current.input.right = false;
    }
  }, []);

  const playTone = useCallback((frequency: number, duration: number, volumeValue: number, wave: OscillatorType = "sine", detune = 0) => {
    const engine = audioRef.current;
    if (!engine) return;
    const now = engine.context.currentTime;
    const oscillator = engine.context.createOscillator();
    const gain = engine.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detune, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volumeValue), now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(engine.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.025);
  }, []);

  const beginAudio = useCallback(() => {
    if (!audioRef.current) {
      try {
        const context = new window.AudioContext();
        const master = context.createGain();
        master.gain.value = mutedRef.current ? 0 : volumeRef.current;
        master.connect(context.destination);
        audioRef.current = { context, master, timer: null, beat: 0 };
      } catch {
        return;
      }
    }
    const engine = audioRef.current;
    if (!engine) return;
    void engine.context.resume();
    if (engine.timer !== null) return;
    engine.timer = window.setInterval(() => {
      const active = audioRef.current;
      if (!active) return;
      const current = gameRef.current;
      const mode = screenRef.current;
      const deep = current?.depth ?? 0;
      const boss = current?.bossActive ?? false;
      const night = current ? phaseName(current) === "Moonrise" || phaseName(current) === "Sundown" : false;
      const scale = boss ? [110, 130.8, 164.8, 196] : deep > 35 ? [130.8, 155.6, 196, 233.1] : night ? [146.8, 174.6, 220, 261.6] : [164.8, 196, 246.9, 293.7];
      const index = active.beat % 8;
      const rest = mode === "paused" || panelRef.current !== "none";
      const note = scale[[0, 2, 1, 3, 1, 2, 0, 1][index]];
      if (!rest) {
        playTone(note / 2, 0.7, boss ? 0.045 : 0.025, "triangle");
        if (index === 0 || index === 4) playTone(note, 0.42, boss ? 0.026 : 0.016, "sine");
      } else if (index === 0) {
        playTone(mode === "title" ? 196 : 130.8, 0.85, 0.012, "sine");
      }
      active.beat++;
    }, 460);
  }, [playTone]);

  const playEffect = useCallback((name: string) => {
    if (!audioRef.current) return;
    const map: Record<string, [number, number, number, OscillatorType]> = {
      jump: [245, 0.16, 0.055, "triangle"], break: [150, 0.12, 0.052, "square"], craft: [550, 0.22, 0.05, "sine"],
      boss: [64, 0.72, 0.08, "sawtooth"], hurt: [92, 0.22, 0.075, "sawtooth"], hit: [285, 0.1, 0.048, "square"],
      swish: [210, 0.1, 0.025, "triangle"], shoot: [680, 0.14, 0.042, "triangle"], heal: [660, 0.36, 0.045, "sine"],
      kill: [410, 0.18, 0.033, "triangle"], pickup: [810, 0.12, 0.035, "sine"], bossDown: [392, 0.68, 0.07, "triangle"],
      invasion: [98, 0.55, 0.06, "sawtooth"], victoryChime: [880, 0.55, 0.05, "sine"], death: [73, 0.8, 0.07, "sawtooth"], victory: [523.25, 0.95, 0.06, "sine"],
    };
    const effect = map[name];
    if (effect) playTone(...effect);
    if (name === "bossDown" || name === "victory") {
      window.setTimeout(() => playTone(659.25, 0.65, 0.045, "sine"), 130);
      window.setTimeout(() => playTone(783.99, 0.8, 0.04, "sine"), 260);
    }
  }, [playTone]);
  playEffectRef.current = playEffect;

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* Storage may be disabled in private browsing. */ }
  }, [profile]);

  useEffect(() => {
    try { localStorage.setItem(DIFFICULTY_KEY, difficulty); } catch { /* The run still works without persistence. */ }
    if (gameRef.current && screenRef.current !== "title") setGameDifficulty(gameRef.current, difficulty);
  }, [difficulty]);

  useEffect(() => {
    const engine = audioRef.current;
    if (engine) engine.master.gain.setTargetAtTime(muted ? 0 : volume, engine.context.currentTime, 0.035);
  }, [volume, muted]);

  const startRun = useCallback(() => {
    beginAudio();
    const next = createGame(difficultyRef.current, profileRef.current.upgrades);
    const canvas = canvasRef.current;
    next.viewport.width = canvas?.clientWidth ?? window.innerWidth;
    next.viewport.height = canvas?.clientHeight ?? window.innerHeight;
    next.camera.x = Math.max(0, next.player.x - next.viewport.width / 2);
    next.camera.y = Math.max(0, next.player.y - next.viewport.height * 0.54);
    gameRef.current = next;
    changePanel("none");
    changeScreen("playing");
    setRevision((value) => value + 1);
  }, [beginAudio, changePanel, changeScreen]);
  startRef.current = startRun;

  const finishRun = useCallback((ending: "gameover" | "victory") => {
    const current = gameRef.current;
    if (!current) return;
    if (!current.settled) {
      current.settled = true;
      const bonus = ending === "victory" ? 24 : Math.floor(current.maxDepth / 45);
      const nextProfile: MetaProfile = {
        ...profileRef.current,
        moonshards: profileRef.current.moonshards + current.runShards + bonus,
        bestDepth: Math.max(profileRef.current.bestDepth, current.maxDepth),
        bossWins: profileRef.current.bossWins + (current.freeplay ? 0 : current.bosses.filter(Boolean).length),
        runs: profileRef.current.runs + 1,
        totalKills: profileRef.current.totalKills + current.stats.kills,
      };
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      current.bankReward = current.runShards + bonus;
    }
    current.input.keys.clear();
    current.input.left = false;
    current.input.right = false;
    changePanel("none");
    changeScreen(ending);
  }, [changePanel, changeScreen]);
  finishRef.current = finishRun;

  const returnToCamp = useCallback(() => {
    const current = gameRef.current;
    if (current && screenRef.current !== "title" && !current.settled) {
      current.settled = true;
      current.bankReward = current.runShards;
      const nextProfile: MetaProfile = {
        ...profileRef.current,
        moonshards: profileRef.current.moonshards + current.runShards,
        bestDepth: Math.max(profileRef.current.bestDepth, current.maxDepth),
        bossWins: profileRef.current.bossWins + (current.freeplay ? 0 : current.bosses.filter(Boolean).length),
        runs: profileRef.current.runs + 1,
        totalKills: profileRef.current.totalKills + current.stats.kills,
      };
      profileRef.current = nextProfile;
      setProfile(nextProfile);
    }
    const preview = createGame(difficultyRef.current, profileRef.current.upgrades);
    preview.viewport.width = canvasRef.current?.clientWidth ?? window.innerWidth;
    preview.viewport.height = canvasRef.current?.clientHeight ?? window.innerHeight;
    preview.camera.x = Math.max(0, preview.player.x - preview.viewport.width / 2);
    preview.camera.y = Math.max(0, preview.player.y - preview.viewport.height * 0.54);
    gameRef.current = preview;
    changePanel("none");
    changeScreen("title");
    setRevision((value) => value + 1);
  }, [changePanel, changeScreen]);

  const selectDifficulty = useCallback((value: DifficultyId) => {
    difficultyRef.current = value;
    setDifficulty(value);
    const current = gameRef.current;
    if (current && screenRef.current !== "title") setGameDifficulty(current, value);
  }, []);

  const buyUpgrade = useCallback((key: keyof MetaUpgrades) => {
    const currentProfile = profileRef.current;
    const level = currentProfile.upgrades[key];
    if (level >= 5) return;
    const info = UPGRADE_INFO.find((entry) => entry.key === key);
    if (!info) return;
    const cost = info.base + level * 4;
    if (currentProfile.moonshards < cost) return;
    const upgrades = { ...currentProfile.upgrades, [key]: level + 1 };
    const nextProfile = { ...currentProfile, moonshards: currentProfile.moonshards - cost, upgrades };
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    const current = gameRef.current;
    if (current && screenRef.current !== "title") {
      current.meta = upgrades;
      if (key === "vitality") { current.player.maxHp += 18; current.player.hp = Math.min(current.player.maxHp, current.player.hp + 18); }
      if (key === "quarry") current.player.pickPower += 0.2;
      if (key === "edge") { current.player.damage += 3; }
      current.toast = `${info.name} rank ${level + 1} carried into the descent.`;
      current.toastTimer = 3;
    }
    setRevision((value) => value + 1);
  }, []);

  const handleCraft = (recipeId: string) => {
    if (!gameRef.current) return;
    craftRecipe(gameRef.current, recipeId);
    setRevision((value) => value + 1);
  };

  const handleSummon = (index: number) => {
    const current = gameRef.current;
    if (!current) return;
    const result = summonBoss(current, index);
    if (result.ok) { beginAudio(); changePanel("none"); changeScreen("playing"); }
    setRevision((value) => value + 1);
  };

  const runTrade = (resident: number) => {
    if (!gameRef.current) return;
    const result = tradeNpc(gameRef.current, resident);
    gameRef.current.toast = result.message;
    gameRef.current.toastTimer = 3;
    setRevision((value) => value + 1);
  };

  const runBuildCabin = () => {
    if (!gameRef.current) return;
    const result = buildCabin(gameRef.current);
    gameRef.current.toast = result.message;
    gameRef.current.toastTimer = 3.5;
    setRevision((value) => value + 1);
  };

  const continueFreeplay = () => {
    if (!gameRef.current) return;
    const current = gameRef.current;
    current.freeplay = true;
    current.ended = false;
    current.settled = false;
    current.runShards = 0;
    current.bankReward = 0;
    current.maxDepth = current.depth;
    current.stats.kills = 0;
    current.stats.mined = 0;
    current.stats.items = 0;
    current.stats.damage = 0;
    current.stats.peakCombo = 0;
    current.stats.chests = 0;
    current.toast = "The Star Hydra is gone. The world is yours to keep.";
    current.toastTimer = 4;
    changeScreen("playing");
    changePanel("none");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let frame = 0;
    let lastTime = 0;

    const resize = () => {
      const current = gameRef.current;
      if (!current) return;
      current.viewport.width = canvas.clientWidth || window.innerWidth;
      current.viewport.height = canvas.clientHeight || window.innerHeight;
      if (screenRef.current === "title" && current.elapsed === 0) {
        current.camera.x = Math.max(0, current.player.x - current.viewport.width / 2);
        current.camera.y = Math.max(0, current.player.y - current.viewport.height * 0.54);
      }
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    window.addEventListener("resize", resize);
    resize();

    const render = (time: number) => {
      const current = gameRef.current;
      if (!current) return;
      const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      current.viewport.width = canvas.clientWidth || window.innerWidth;
      current.viewport.height = canvas.clientHeight || window.innerHeight;
      if (screenRef.current === "playing" && panelRef.current === "none") {
        const result = stepGame(current, dt);
        if (!shakeOnRef.current) current.shake = 0;
        if (result) finishRef.current(result);
      }
      const events = current.events.splice(0, current.events.length);
      events.forEach((event) => playEffectRef.current(event));
      drawGame(ctx, current, current.viewport.width, current.viewport.height, screenRef.current === "title");
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  const shakeOnRef = useRef(shakeOn);
  shakeOnRef.current = shakeOn;

  useEffect(() => {
    const interval = window.setInterval(() => setRevision((value) => value + 1), 150);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const current = gameRef.current;
      const key = event.key.toLowerCase();
      const activeScreen = screenRef.current;
      const activePanel = panelRef.current;
      if (key === "escape") {
        event.preventDefault();
        if (activePanel !== "none") changePanel("none");
        else if (activeScreen === "playing") changeScreen("paused");
        else if (activeScreen === "paused") changeScreen("playing");
        else if (activeScreen === "gameover" || activeScreen === "victory") changeScreen("title");
        return;
      }
      if ((activeScreen === "title" || activeScreen === "gameover" || activeScreen === "victory") && key === "enter") {
        event.preventDefault();
        if (activeScreen === "title") {
          if (activePanel === "none") startRef.current();
        } else startRef.current();
        return;
      }
      if (activeScreen === "title" && activePanel === "none" && key === "h") { changePanel("help"); return; }
      if (activeScreen === "title" && activePanel === "none" && key === "o") { changePanel("settings"); return; }
      if (activeScreen === "paused") {
        if (activePanel !== "none") return;
        if (key === "p" || key === " " || key === "enter") changeScreen("playing");
        return;
      }
      if (activeScreen !== "playing" || !current) return;
      if (activePanel !== "none") return;
      if (key === "o") { changePanel("settings"); return; }
      if (key === "p") { changeScreen("paused"); return; }
      if (key === "e") { changePanel("craft"); return; }
      if (key === "i") { changePanel("inventory"); return; }
      if (key === "c") { changePanel("camp"); return; }
      if (key === "b") { changePanel("bosses"); return; }
      if (key === "m") { changePanel("map"); return; }
      if (key === "h") { changePanel("help"); return; }
      if (key === "g") {
        const message = openNearbyChest(current);
        current.toast = message; current.toastTimer = 3;
        setRevision((value) => value + 1);
        return;
      }
      if (key === "v") {
        const result = useWard(current);
        current.toast = result.message; current.toastTimer = 3;
        setRevision((value) => value + 1);
        return;
      }
      if (/^[1-8]$/.test(key)) { current.selectedSlot = Number(key) - 1; setRevision((value) => value + 1); return; }
      if (key === "f") { event.preventDefault(); current.input.attackPressed = true; return; }
      if (key === "r") { current.input.shootPressed = true; return; }
      if (key === "q") { current.input.keys.add("q"); return; }
      if (["a", "d", "w", " ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        if (key.startsWith("arrow") || key === " ") event.preventDefault();
        if (!event.repeat && (key === "w" || key === " " || key === "arrowup")) current.input.jumpPressed = true;
        current.input.keys.add(key);
      }
    };
    const keyup = (event: KeyboardEvent) => {
      gameRef.current?.input.keys.delete(event.key.toLowerCase());
    };
    const pointerUp = () => {
      if (!gameRef.current) return;
      gameRef.current.input.left = false;
      gameRef.current.input.right = false;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("pointerup", pointerUp);
    const blur = () => {
      if (gameRef.current) {
        gameRef.current.input.keys.clear();
        gameRef.current.input.left = false;
        gameRef.current.input.right = false;
      }
      if (screenRef.current === "playing" && panelRef.current === "none") changeScreen("paused");
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("blur", blur);
    };
  }, [changePanel, changeScreen]);

  useEffect(() => () => {
    const engine = audioRef.current;
    if (engine?.timer !== null && engine?.timer !== undefined) window.clearInterval(engine.timer);
    void engine?.context.close();
  }, []);

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = gameRef.current;
    if (!current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    current.input.mouseX = event.clientX - rect.left;
    current.input.mouseY = event.clientY - rect.top;
    current.input.mouseActive = true;
  };
  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = gameRef.current;
    if (!current || screenRef.current !== "playing" || panelRef.current !== "none") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onCanvasPointerMove(event);
    if (event.button === 2) current.input.right = true;
    else current.input.left = true;
  };
  const onCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gameRef.current) return;
    if (event.button === 2) gameRef.current.input.right = false;
    else gameRef.current.input.left = false;
  };
  const onCanvasContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => event.preventDefault();

  const setHeld = (key: string, held: boolean) => {
    const current = gameRef.current;
    if (!current) return;
    current.input.mouseActive = false;
    if (held) {
      current.input.keys.add(key);
      if (key === "w" || key === " ") current.input.jumpPressed = true;
      if (key === "f") current.input.attackPressed = true;
      if (key === "r") current.input.shootPressed = true;
    } else current.input.keys.delete(key);
  };

  const current = gameRef.current!;
  const stage = current.depth < 4 ? "THE CANOPY" : current.depth < 12 ? "SHALE HOLLOW" : current.depth < 21 ? "GLOWCAP GROTTO" : current.depth < 31 ? "DEEPGLASS" : current.depth < 42 ? "THE OLD DEEP" : "THE ROOT BELOW";
  const filledHealth = current.player.hp / Math.max(1, current.player.maxHp);
  const recipeCategories: CraftFilter[] = ["All", "Gear", "Stations", "Survival", "Building", "Boss seals"];
  const filteredRecipes = craftFilter === "All" ? RECIPES : RECIPES.filter((recipe) => recipe.category === craftFilter);

  return (
    <main className={`game-shell ${screen === "title" ? "title-mode" : "play-mode"}`}>
      <canvas
        ref={canvasRef}
        className="world-canvas"
        aria-label="Moonroot underground world"
        onPointerMove={onCanvasPointerMove}
        onPointerDown={onCanvasPointerDown}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onContextMenu={onCanvasContextMenu}
      />
      <div className="scene-vignette" />

      {screen === "title" && panel === "none" && (
        <section className="title-screen" aria-label="Moonroot title screen">
          <div className="title-topline">
            <div className="wordmark-mini"><span className="root-mark">M</span><span>MOONROOT <i>/</i> FIELD JOURNAL</span></div>
            <button className="sound-toggle title-sound" onClick={() => { beginAudio(); setMuted((value) => !value); }} aria-label={muted ? "Unmute audio" : "Mute audio"}>
              <SoundGlyph muted={muted} /> <span>{muted ? "SOUND OFF" : "SOUND ON"}</span>
            </button>
          </div>
          <div className="title-copy">
            <div className="chapter-line"><span className="chapter-dot" /> AN UNDERGROUND TALE</div>
            <h1>MOONROOT</h1>
            <p className="title-subhead">The earth keeps what the daylight forgets.</p>
            <p className="title-description">Dig beneath an old forest, make a home in the hollow, and follow five forgotten guardians into the deep.</p>
            <div className="title-actions">
              <button className="button-primary descend-button" onClick={startRun}><span>DESCEND</span><b>↘</b></button>
              <div className="difficulty-picker" aria-label="Choose difficulty">
                {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => (
                  <button key={id} className={difficulty === id ? "difficulty-active" : ""} onClick={() => selectDifficulty(id)}>
                    <span>{DIFFICULTIES[id].name}</span><small>{id === "gentle" ? "GENTLE" : id === "standard" ? "NORMAL" : "HARD"}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="title-links">
              <button onClick={() => { setHelpPage(0); changePanel("help"); }}>FIELD GUIDE <span>H</span></button>
              <button onClick={() => changePanel("keepsakes")}>KEEPSAKES <span>{profile.moonshards} SHARDS</span></button>
              <button onClick={() => changePanel("settings")}>SETTINGS <span>O</span></button>
            </div>
          </div>
          <aside className="title-right-note">
            <div className="journal-rule" />
            <div className="title-stat"><span className="small-label">LAST KNOWN DEPTH</span><strong>{profile.bestDepth}<small>m</small></strong></div>
            <span className="note-divider" />
            <div className="title-stat"><span className="small-label">GUARDIANS REMEMBERED</span><strong>{profile.bossWins}<small> / 5</small></strong></div>
            <span className="note-divider" />
            <div className="title-stat"><span className="small-label">EXPEDITIONS</span><strong>{profile.runs.toString().padStart(2, "0")}</strong></div>
            <p>{difficulty === "hardcore" ? "One life. Leave a good story." : "A hand-drawn world, under one very old tree."}</p>
          </aside>
          <div className="title-footer"><span>WASD TO WANDER <i>·</i> MOUSE TO SHAPE THE WORLD</span><span>YOUR CAMP WILL REMEMBER</span></div>
        </section>
      )}

      {screen === "playing" && (
        <div className="game-hud" key={`hud-${revision >= 0 ? "live" : ""}`}>
          <header className="hud-topbar">
            <div className="hud-brand"><span className="root-mark small">M</span><span>MOONROOT <em>EXPEDITION {current.wave.toString().padStart(2, "0")}</em></span></div>
            <div className="hud-top-center"><span className="sun-symbol">{phaseName(current) === "Moonrise" ? "◐" : phaseName(current) === "Sundown" ? "◒" : "◌"}</span><span>{phaseName(current).toUpperCase()}</span><i /> <span>{biomeName(current).toUpperCase()}</span></div>
            <div className="hud-actions">
              <button onClick={() => changePanel("craft")} title="Crafting (E)"><span className="action-glyph">⌁</span><small>CRAFT</small></button>
              <button onClick={() => changePanel("inventory")} title="Pack (I)"><span className="action-glyph">▦</span><small>PACK</small></button>
              <button onClick={() => changePanel("camp")} title="Camp (C)"><span className="action-glyph">⌂</span><small>CAMP</small></button>
              <button onClick={() => changePanel("bosses")} title="Boss ledger (B)"><span className="action-glyph">✧</span><small>SEALS</small></button>
              <button onClick={() => changePanel("settings")} title="Settings"><span className="action-glyph">⚙</span><small>SET</small></button>
              <button className="pause-button" onClick={() => changeScreen("paused")} title="Pause (Esc)"><span>Ⅱ</span><small>PAUSE</small></button>
            </div>
          </header>

          <div className="hud-left-column">
            <div className="health-readout">
              <div className="health-heading"><span>VITALITY</span><strong>{Math.ceil(current.player.hp)} <i>/</i> {current.player.maxHp}</strong></div>
              <div className="health-track"><span style={{ width: `${clampValue(filledHealth * 100, 0, 100)}%` }} /><i style={{ left: "25%" }} /><i style={{ left: "50%" }} /><i style={{ left: "75%" }} /></div>
              <div className="health-under"><span>{current.player.defense ? `ARMOR ${current.player.defense}` : "NO ARMOR"}</span><span>{current.player.weaponTier >= 2 ? "IRONBOUND" : current.player.weaponTier === 1 ? "COPPER EDGE" : "WORN EDGE"}</span></div>
            </div>
            <div className="objective-readout">
              <div className="objective-eyebrow"><span className="chapter-dot" /> CURRENT THREAD</div>
              <p>{objectiveText(current)}</p>
              <div className="objective-progress"><span>{current.bosses.filter(Boolean).length}/5 GUARDIANS</span><span>{current.depth}m</span></div>
              <div className="boss-dots">{BOSS_INFO.map((boss, index) => <span key={boss.name} className={current.bosses[index] ? "boss-dot down" : current.bossActive && index === current.bosses.filter(Boolean).length ? "boss-dot active" : "boss-dot"} title={boss.name} />)}</div>
            </div>
          </div>

          <div className="hud-right-column">
            <div className="depth-readout"><span className="small-label">DEPTH</span><strong>{current.depth}<small>m</small></strong><span>{stage}</span><div className="depth-track"><i style={{ top: `${clampValue(current.depth / 64 * 100, 2, 96)}%` }} /></div></div>
            <div className="expedition-readout"><span className="small-label">FIELD TIME</span><strong>{formatClock(current.elapsed)}</strong><span>WAVE {current.wave.toString().padStart(2, "0")}</span></div>
            <button className="quick-ledger" onClick={() => changePanel("map")}><span>⌖</span> SURVEY MAP <b>M</b></button>
          </div>

          {current.bossLabelTimer > 0 && <div className="boss-banner"><span>✧</span>{current.bossLabel}<span>✧</span></div>}
          {current.invasion.active && <div className="invasion-strip"><span>ROOTFALL</span><div><i style={{ width: `${current.invasion.kills / current.invasion.goal * 100}%` }} /></div><b>{current.invasion.kills}/{current.invasion.goal}</b></div>}

          <div className="bottom-gamebar">
            <div className="quick-stats"><span><i className="resource-glyph wood">▰</i>{current.inventory.wood}</span><span><i className="resource-glyph ore">◈</i>{current.inventory.copper_ore + current.inventory.iron_ore + current.inventory.crystal_ore}</span><span><i className="resource-glyph shard">☾</i>{current.inventory.moonshard}</span></div>
            <div className="hotbar" role="toolbar" aria-label="Hotbar, use 1 through 8 to select">
              {current.hotbar.map((item, index) => {
                const info = ITEM_INFO[item] ?? { name: item, icon: "?", color: "#dfd6bd" };
                return <button key={`${item}-${index}`} className={`hotbar-slot ${current.selectedSlot === index ? "selected" : ""}`} onClick={() => { current.selectedSlot = index; setRevision((v) => v + 1); }} aria-label={`${index + 1}: ${info.name}`}>
                  <span className="slot-key">{index + 1}</span><span className="slot-icon" style={{ color: info.color }}>{info.icon}</span><span className="slot-count">{current.inventory[item] ?? 0}</span>
                </button>;
              })}
            </div>
            <div className="bar-help"><button onClick={() => changePanel("help")}>? <span>FIELD GUIDE</span></button><span className="coin-count"><i>●</i> {current.inventory.coin}</span></div>
          </div>
          <div className="control-whisper"><span>A / D</span> MOVE <i>·</i><span>SPACE</span> JUMP <i>·</i><span>F</span> STRIKE <i>·</i><span>Q</span> TONIC</div>

          <div className="touch-controls" aria-label="Touch controls">
            <div className="touch-movement"><button onPointerDown={(e) => { e.preventDefault(); setHeld("a", true); }} onPointerUp={() => setHeld("a", false)} onPointerLeave={() => setHeld("a", false)}>‹</button><button onPointerDown={(e) => { e.preventDefault(); setHeld("d", true); }} onPointerUp={() => setHeld("d", false)} onPointerLeave={() => setHeld("d", false)}>›</button><button onPointerDown={(e) => { e.preventDefault(); setHeld(" ", true); }} onPointerUp={() => setHeld(" ", false)} onPointerLeave={() => setHeld(" ", false)}>JUMP</button></div>
            <div className="touch-actions"><button onPointerDown={(e) => { e.preventDefault(); setHeld("mine", true); }} onPointerUp={() => setHeld("mine", false)} onPointerLeave={() => setHeld("mine", false)}>MINE</button><button onPointerDown={(e) => { e.preventDefault(); setHeld("f", true); }} onPointerUp={() => setHeld("f", false)}>STRIKE</button><button onPointerDown={(e) => { e.preventDefault(); setHeld("r", true); }} onPointerUp={() => setHeld("r", false)}>SHOT</button></div>
          </div>
        </div>
      )}

      {screen === "paused" && panel === "none" && (
        <div className="pause-screen overlay-screen">
          <section className="pause-panel">
            <div className="chapter-line"><span className="chapter-dot" /> EXPEDITION HELD</div>
            <h2>Take a breath.</h2>
            <p className="pause-summary">{biomeName(current)} <i>·</i> {current.depth}m below the canopy <i>·</i> {formatClock(current.elapsed)} elapsed</p>
            <div className="pause-divider" />
            <button className="button-primary full-button" onClick={() => changeScreen("playing")}>RESUME DESCENT <span>↗</span></button>
            <div className="pause-links"><button onClick={() => changePanel("settings")}>SETTINGS</button><button onClick={() => changePanel("help")}>FIELD GUIDE</button><button onClick={() => changePanel("camp")}>CAMP LEDGER</button></div>
            <div className="pause-footer"><span>ESC / P TO RETURN</span><button onClick={returnToCamp}>END DESCENT & RETURN</button></div>
          </section>
        </div>
      )}

      {(screen === "gameover" || screen === "victory") && (
        <div className="end-screen overlay-screen">
          <section className={`end-panel ${screen === "victory" ? "end-victory" : "end-loss"}`}>
            <div className="chapter-line"><span className="chapter-dot" /> {screen === "victory" ? "THE ROOTS ARE QUIET" : "THE GROVE WILL REMEMBER"}</div>
            <h2>{screen === "victory" ? "A light returned." : "The deep took its due."}</h2>
            <p>{screen === "victory" ? "Five old guardians have fallen. You can keep the world and wander, or carry its spoils back to camp." : "Every descent leaves something behind. Your moonshards are safe, and the next expedition begins with more."}</p>
            <div className="run-summary">
              <div><span>DEEPEST</span><strong>{current.maxDepth}<small>m</small></strong></div>
              <div><span>GUARDIANS</span><strong>{current.bosses.filter(Boolean).length}<small> / 5</small></strong></div>
              <div><span>CREATURES</span><strong>{current.stats.kills}</strong></div>
              <div><span>BLOCKS MINED</span><strong>{current.stats.mined}</strong></div>
              <div><span>TIME BELOW</span><strong>{formatClock(current.elapsed)}</strong></div>
              <div><span>NEW SHARDS</span><strong className="reward-shards">+{current.bankReward ?? current.runShards}<small> ☾</small></strong></div>
            </div>
            <div className="end-actions">
              {screen === "victory" && <button className="button-primary" onClick={continueFreeplay}>KEEP EXPLORING <span>↗</span></button>}
              <button className={screen === "victory" ? "button-quiet" : "button-primary"} onClick={startRun}>{screen === "victory" ? "START A NEW EXPEDITION" : "TRY ANOTHER DESCENT"} <span>↻</span></button>
              <button className="button-quiet" onClick={returnToCamp}>RETURN TO CAMP</button>
            </div>
          </section>
        </div>
      )}

      {panel !== "none" && (
        <div className={`panel-backdrop ${screen === "title" ? "title-panel-backdrop" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) changePanel("none"); }}>
          <section className="menu-panel" role="dialog" aria-modal="true" aria-label={`${panel} panel`}>
            <div className="panel-header">
              <div><span className="panel-kicker">{screen === "title" ? "MOONROOT FIELD JOURNAL" : `EXPEDITION ${formatClock(current.elapsed)}`}</span><h2>{panelTitle(panel)}</h2></div>
              <button className="close-panel" onClick={() => changePanel("none")} aria-label="Close panel">× <small>ESC</small></button>
            </div>

            {panel === "help" && (
              <div className="help-content">
                <div className="help-page-index">{HELP_PAGES.map((page, index) => <button key={page.eyebrow} className={helpPage === index ? "active" : ""} onClick={() => setHelpPage(index)}><span>0{index + 1}</span><i>{page.title.split(" ").slice(0, 3).join(" ")}</i></button>)}</div>
                <article className="help-article"><span className="panel-kicker">{HELP_PAGES[helpPage].eyebrow}</span><h3>{HELP_PAGES[helpPage].title}</h3><p>{HELP_PAGES[helpPage].copy}</p>
                  <div className="help-key-grid">{HELP_PAGES[helpPage].keys.map((item) => <div key={item}><span>{item}</span></div>)}</div>
                  <div className="help-navigation"><button className="button-quiet" onClick={() => setHelpPage((page) => (page + HELP_PAGES.length - 1) % HELP_PAGES.length)}>← PREVIOUS</button><span>0{helpPage + 1} / 04</span><button className="button-primary compact-button" onClick={() => setHelpPage((page) => (page + 1) % HELP_PAGES.length)}>NEXT NOTE →</button></div>
                </article>
                <div className="all-controls"><span>KEYBOARD + MOUSE</span><p><b>A / D</b> move <b>SPACE</b> jump <b>LEFT CLICK</b> mine <b>RIGHT CLICK</b> build <b>F</b> strike <b>R</b> bow <b>E</b> craft <b>I</b> pack <b>C</b> camp <b>B</b> seals <b>M</b> map <b>G</b> chest <b>Q</b> tonic <b>ESC</b> pause</p></div>
              </div>
            )}

            {panel === "settings" && (
              <div className="settings-content">
                <div className="setting-row sound-setting"><div><span className="panel-kicker">SYNTHESIZED SOUND</span><strong>Volume & ambience</strong><p>Layered chiptune, hand-shaped in real time.</p></div><div className="volume-controls"><button className={`toggle-button ${muted ? "toggle-off" : "toggle-on"}`} onClick={() => { beginAudio(); setMuted((value) => !value); }}>{muted ? "MUTED" : "ON"}</button><input aria-label="Audio volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { beginAudio(); setVolume(Number(event.target.value)); }} /></div></div>
                <div className="setting-row"><div><span className="panel-kicker">IMPACT</span><strong>Screen shake</strong><p>Keep the weight of mining and boss hits.</p></div><button className={`toggle-button ${shakeOn ? "toggle-on" : "toggle-off"}`} onClick={() => setShakeOn((value) => !value)}>{shakeOn ? "ON" : "OFF"}</button></div>
                <div className="setting-difficulty"><div><span className="panel-kicker">LIVE WORLD MODIFIER</span><strong>Difficulty</strong><p>Changes incoming damage and the pace of the world now.</p></div><div className="difficulty-options">{(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => <button key={id} className={difficulty === id ? "chosen" : ""} onClick={() => selectDifficulty(id)}><strong>{DIFFICULTIES[id].name}</strong><span>{id === "gentle" ? "LOW PRESSURE" : id === "standard" ? "BALANCED" : "HIGH RISK"}</span></button>)}</div></div>
                <div className="settings-note"><span>CONTROLS</span><p>Move with WASD or arrows. Mouse and touch both work. Press <b>Esc</b> at any time to pause.</p></div>
              </div>
            )}

            {panel === "craft" && (
              <div className="craft-content">
                <div className="craft-intro"><p>Turn what the world gives you into a way forward. Stations are physical: the workbench, forge, and rune altar are waiting at your first camp.</p><span>{current.player.pickTier === 0 ? "WORN PICK" : current.player.pickTier === 1 ? "COPPER PICK" : "IRON PICK"}<i />{current.player.weaponTier === 0 ? "WORN EDGE" : current.player.weaponTier === 1 ? "COPPER SABRE" : "IRON GREATBLADE"}</span></div>
                <div className="filter-tabs">{recipeCategories.map((category) => <button key={category} className={craftFilter === category ? "selected" : ""} onClick={() => setCraftFilter(category)}>{category === "Boss seals" ? "SEALS" : category.toUpperCase()}</button>)}</div>
                <div className="recipe-list">
                  {filteredRecipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} current={current} onCraft={() => handleCraft(recipe.id)} />)}
                </div>
                <div className="panel-footer"><span><kbd>E</kbd> OPEN / <kbd>ESC</kbd> CLOSE</span><button onClick={() => changePanel("bosses")}>OPEN BOSS LEDGER <span>↗</span></button></div>
              </div>
            )}

            {panel === "inventory" && (
              <div className="inventory-content">
                <div className="inventory-intro"><p>Eight quick slots. Select a slot, then click a material below to assign it. Place blocks and stations with right-click.</p><div><span>MOONSHARDS BANKED</span><strong>{profile.moonshards} <i>☾</i></strong></div></div>
                <div className="inventory-hotbar">{current.hotbar.map((item, index) => <button key={`${item}-${index}`} className={current.selectedSlot === index ? "selected" : ""} onClick={() => { current.selectedSlot = index; setRevision((value) => value + 1); }}><span>{index + 1}</span><i style={{ color: ITEM_INFO[item]?.color }}>{ITEM_INFO[item]?.icon}</i><small>{current.inventory[item] ?? 0}</small></button>)}</div>
                <div className="inventory-grid">{Object.entries(current.inventory).filter(([, count]) => count > 0).sort((a, b) => (ITEM_INFO[a[0]]?.category ?? "").localeCompare(ITEM_INFO[b[0]]?.category ?? "")).map(([item, count]) => {
                  const info = ITEM_INFO[item] ?? { name: item, icon: "?", color: "#e0d5b5", category: "Other" };
                  return <button key={item} className="inventory-item" onClick={() => { current.hotbar[current.selectedSlot] = item; setRevision((value) => value + 1); }}><span className="item-glyph" style={{ color: info.color }}>{info.icon}</span><span className="item-label"><strong>{info.name}</strong><small>{info.category}</small></span><b>{count}</b></button>;
                })}</div>
                <div className="panel-footer"><span>SELECTED SLOT {current.selectedSlot + 1}</span><span>Q USES A TONIC <i>·</i> V USES A RIFT WARD</span></div>
              </div>
            )}

            {panel === "camp" && (
              <div className="camp-content">
                <div className="camp-banner"><div><span className="panel-kicker">A ROOM WITH A LANTERN</span><h3>Good company is its own armor.</h3><p>Build a valid timber cabin to invite a resident. Each guardian opens another room and another trade.</p></div><div className="cabin-sketch"><span>⌂</span><i>6W / 3S</i></div></div>
                <div className="housing-progress"><span>HOMES {current.world.homes.length} / 4</span><div>{RESIDENTS.map((resident, index) => <i key={resident.name} className={current.world.homes[index] ? "occupied" : ""} />)}</div><span>{current.inventory.wood} WOOD <i>·</i> {current.inventory.stone} STONE</span></div>
                <button className="build-home-button" onClick={runBuildCabin} disabled={current.world.homes.length >= 4}><span className="build-glyph">+</span><span><strong>{current.world.homes.length === 0 ? "Raise the first cabin" : "Raise another cabin"}</strong><small>{current.world.homes.length === 0 ? "6 heartwood + 3 stone" : "12 heartwood + 8 stone · next resident needs a guardian"}</small></span><b>BUILD ↗</b></button>
                <div className="resident-list">{RESIDENTS.map((resident, index) => {
                  const housed = Boolean(current.world.homes[index]);
                  const unlocked = index === 0 || current.bosses[index - 1];
                  return <div className={`resident-row ${housed ? "resident-home" : "resident-empty"}`} key={resident.name}>
                    <div className="resident-portrait" style={{ "--resident-color": resident.color } as React.CSSProperties}>{housed ? resident.name.slice(0, 1) : "·"}</div>
                    <div className="resident-info"><span>{resident.title.toUpperCase()} {housed ? "· AT HOME" : unlocked ? "· ROOM TO LET" : "· STILL AFRAID"}</span><strong>{housed ? resident.name : unlocked ? "A future neighbor" : "A locked door"}</strong><small>{housed ? resident.offer : unlocked ? "Build another timber cabin to invite them." : BOSS_INFO[index - 1]?.name + " must fall first."}</small></div>
                    {housed && <button className="trade-button" onClick={() => runTrade(index)}>TRADE <span>↗</span></button>}
                  </div>;
                })}</div>
                <div className="panel-footer"><span>G TO OPEN A SEALED CACHE</span><button onClick={() => changePanel("craft")}>CRAFT BUILDING PARTS <span>↗</span></button></div>
              </div>
            )}

            {panel === "bosses" && (
              <div className="boss-ledger">
                <div className="boss-ledger-intro"><div><span className="panel-kicker">THE DESCENT HAS A MEMORY</span><h3>Five guardians. Five eras.</h3><p>Each seal is made at the rune altar. A defeated guardian changes what the world can offer.</p></div><div className="boss-tally"><strong>{current.bosses.filter(Boolean).length}<i>/5</i></strong><span>FALLEN</span></div></div>
                <div className="boss-list">{BOSS_INFO.map((boss, index) => {
                  const defeated = current.bosses[index];
                  const status = bossStatus(current, index);
                  const available = status.unlocked;
                  const lockedByPredecessor = index > current.bosses.filter(Boolean).length;
                  const tokenCount = current.inventory[boss.item] ?? 0;
                  return <article className={`boss-row ${defeated ? "boss-defeated" : ""} ${available ? "boss-call-ready" : ""}`} key={boss.name}>
                    <div className="boss-index" style={{ "--boss-color": boss.color } as React.CSSProperties}>{defeated ? "✓" : `0${index + 1}`}</div>
                    <div className="boss-detail"><span>{boss.epithet.toUpperCase()}</span><strong>{boss.name}</strong><small>{defeated ? "The guardian's seal is quiet." : lockedByPredecessor ? boss.unlock : status.reason}</small></div>
                    <div className="boss-relic"><i style={{ color: ITEM_INFO[boss.item]?.color }}>{ITEM_INFO[boss.item]?.icon}</i><small>{tokenCount} {ITEM_INFO[boss.item]?.name}</small></div>
                    {!defeated && <button className="boss-action" disabled={!available} onClick={() => handleSummon(index)}>{available ? "CALL" : tokenCount > 0 && current.bosses.filter(Boolean).length === index ? "ALTAR" : lockedByPredecessor ? "SEALED" : "MAKE SEAL"}</button>}
                  </article>;
                })}</div>
                <div className="panel-footer"><span>{current.hardmode ? "HARDMODE AWAKENED · NEW ORE HAS FORMED" : "THIRD VICTORY AWAKENS THE OLD DEEP"}</span><button onClick={() => { setCraftFilter("Boss seals"); changePanel("craft"); }}>CRAFT A SEAL <span>↗</span></button></div>
              </div>
            )}

            {panel === "map" && (
              <div className="map-content">
                <div className="map-header-note"><span className="panel-kicker">FIELD SURVEY / SECTOR {Math.floor((current.player.x / 32) / 20).toString().padStart(2, "0")}</span><strong>{biomeName(current)}</strong><p>The ground is procedural. Veins, caves, and caches are scattered anew with every expedition.</p></div>
                <div className="world-map">
                  <div className="map-landmark map-canopy"><span>01</span><div><b>ROOTWARD GROVE</b><small>Heartwood / copper / camp</small></div></div>
                  <div className="map-line"><i style={{ top: `${clampValue(current.depth / 64 * 100, 2, 96)}%` }} /><span style={{ top: `${clampValue(current.depth / 64 * 100, 2, 96)}%` }}>YOU · {current.depth}m</span></div>
                  <div className="map-landmark"><span>02</span><div><b>SHALE HOLLOW</b><small>Iron / old bone / first caches</small></div></div>
                  <div className="map-landmark"><span>03</span><div><b>GLOWCAP GROTTO</b><small>Glowcaps / bone scouts</small></div></div>
                  <div className="map-landmark"><span>04</span><div><b>DEEPGLASS REACH</b><small>Deepglass / hollow court</small></div></div>
                  <div className="map-landmark"><span>05</span><div><b>EMBER VEINS</b><small>{current.hardmode ? "Emberstone / star ore / awakened" : "Sealed until the third guardian falls"}</small></div></div>
                </div>
                <div className="map-side-note"><span>THREAD OF THE DAY</span><p>{objectiveText(current)}</p><div><b>{current.stats.visited.length}</b> BIOMES FOUND <i>·</i> <b>{current.stats.chests}</b> CACHES OPENED</div></div>
                <div className="panel-footer"><span>DEPTH IS MEASURED FROM THE NEAREST CANOPY</span><button onClick={() => changePanel("bosses")}>VIEW GUARDIANS <span>↗</span></button></div>
              </div>
            )}

            {panel === "keepsakes" && (
              <div className="keepsake-content">
                <div className="keepsake-banner"><span className="moon-token">☾</span><div><span className="panel-kicker">SALVAGED BETWEEN DESCENTS</span><h3>{profile.moonshards}<small> moonshards</small></h3><p>Every run brings something home. Permanent keepsakes apply at the start of every new expedition.</p></div></div>
                <div className="upgrade-list">{UPGRADE_INFO.map((upgrade) => {
                  const level = profile.upgrades[upgrade.key];
                  const cost = upgrade.base + level * 4;
                  const canBuy = profile.moonshards >= cost && level < 5;
                  return <div className="upgrade-row" key={upgrade.key}>
                    <span className="upgrade-glyph">{upgrade.glyph}</span>
                    <div className="upgrade-info"><strong>{upgrade.name}</strong><small>{upgrade.description}</small><div className="upgrade-pips">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < level ? "lit" : ""} />)}</div></div>
                    <button disabled={!canBuy} onClick={() => buyUpgrade(upgrade.key)}>{level >= 5 ? "MAX" : <>{cost} <i>☾</i></>}</button>
                  </div>;
                })}</div>
                <div className="panel-footer"><span>SHARDS BANK AUTOMATICALLY WHEN A RUN ENDS</span><button onClick={() => changePanel("none")}>BACK TO JOURNAL <span>↗</span></button></div>
              </div>
            )}
          </section>
        </div>
      )}

      <div className="sr-only" aria-live="polite">{screen === "playing" ? `${current.depth} meters deep. ${Math.ceil(current.player.hp)} health. ${current.toastTimer > 0 ? current.toast : ""}` : ""}</div>
    </main>
  );
}

function panelTitle(panel: Panel) {
  const titles: Record<Panel, string> = { none: "", help: "Field guide", craft: "Make something useful", inventory: "Your pack", camp: "The grove camp", settings: "Sound & settings", map: "A world below", bosses: "The guardian ledger", keepsakes: "What you carry forward" };
  return titles[panel];
}

function RecipeRow({ recipe, current, onCraft }: { recipe: Recipe; current: GameState; onCraft: () => void }) {
  const reason = canCraft(current, recipe);
  const ingredientNames = Object.entries(recipe.materials).map(([item, amount]) => ({ item, amount, info: ITEM_INFO[item], count: current.inventory[item] ?? 0 }));
  const crafted = recipe.id === "copper_pick" ? current.player.pickTier >= 1 : recipe.id === "iron_pick" ? current.player.pickTier >= 2 : recipe.id === "copper_blade" ? current.player.weaponTier >= 1 : recipe.id === "iron_blade" ? current.player.weaponTier >= 2 : recipe.id === "dusk_bow" ? current.player.bow : false;
  return <article className={`recipe-row ${reason ? "recipe-locked" : ""} ${crafted ? "recipe-owned" : ""}`}>
    <div className="recipe-icon" style={{ color: ITEM_INFO[recipe.result ?? recipe.id]?.color ?? "#e5c894" }}>{ITEM_INFO[recipe.result ?? recipe.id]?.icon ?? "✧"}</div>
    <div className="recipe-main"><span className="recipe-category">{recipe.category.toUpperCase()}{recipe.station ? ` · ${recipe.station.toUpperCase()}` : ""}</span><strong>{recipe.name}{crafted && <i> · EQUIPPED</i>}</strong><p>{recipe.description}</p><div className="ingredients">{ingredientNames.map(({ item, amount, info, count }) => <span key={item} className={count >= amount ? "enough" : "missing"}><i style={{ color: info?.color }}>{info?.icon}</i>{info?.name ?? item} {count}/{amount}</span>)}</div></div>
    <button className="craft-button" disabled={Boolean(reason) || crafted} onClick={onCraft}>{crafted ? "MADE" : reason ? "NEED MORE" : "MAKE"}<span>{reason && !crafted ? <small>{reason}</small> : "↗"}</span></button>
  </article>;
}

function SoundGlyph({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d={muted ? "m17 9 5 6m0-6-5 6" : "M16 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"} /></svg>;
}