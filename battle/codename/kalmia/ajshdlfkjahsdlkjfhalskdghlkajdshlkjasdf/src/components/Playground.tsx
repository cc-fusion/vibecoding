import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Repeat,
  Hand,
  Droplets,
  Compass,
  MousePointer2,
  Fan,
  Terminal,
  Code2,
  Activity,
  Trash2,
  Plus,
  Loader2,
  FlaskConical,
  Box as BoxIcon,
} from "lucide-react";
import { loadMPM, type MPMType } from "../mpm";
import { cn } from "../utils/cn";

export interface PlaygroundHandle {
  runCode: (code: string) => void;
  loadExample: (code: string) => void;
  focus: () => void;
}

type LogEntry = { line: string; level: string; at: string };

const EXAMPLES: { id: string; label: string; code: string }[] = [
  {
    id: "declarative",
    label: "Custom declarative scene",
    code: `// A scene is plain data — no source edits needed.
sim.loadScene({
  name: 'Sand mill', dim: 2, duration: 0,
  levelset: {
    planes: [{ normal: [0, 1], d: -0.06 },
             { normal: [1, 0], d: -0.06 },
             { normal: [-1, 0], d: 0.94 }],
    friction: 0.6,
  },
  wheels: [{ center: [0.5, 0.38], radius: 0.2, blades: 10,
             mode: 'free', friction: -2, damping: 1.6 }],
  sources: [{ type: 'sand', position: [0.34, 0.92],
              size: [0.05, 0.03], velocity: [0.2, -1], ppc: 3,
              density: 1200, color: [0.93, 0.76, 0.45] }],
});`,
  },
  {
    id: "scripted",
    label: "Scripted scene (setup fn)",
    code: `// setup() runs inside the simulation worker.
sim.loadScene({
  name: 'Jelly rain', dim: 2, duration: 0,
  setup(ctx) {
    ctx.mpm({ res: 176 });
    ctx.levelset({
      planes: [{ normal: [0, 1], d: -0.06 },
               { normal: [1, 0], d: -0.06 },
               { normal: [-1, 0], d: 0.94 }],
      friction: 0.4,
    });
    ctx.add({ type: 'rigid', codimensional: true,
      scripted_position: [0.5, 0.3],
      scripted_rotation: '80 * t',
      shape: { segment: [[-0.18, 0], [0.18, 0]] },
      friction: 0.1, color: [0.95, 0.8, 0.4] });
    return {};
  },
});
// drop jelly every 1.5 s, live:
sim.onUpdate(function (t, dt, api) {
  if (Math.floor(t / 1.5) !== Math.floor((t - dt) / 1.5)) {
    api.addParticles({ type: 'jelly', E: 2e4, nu: 0.3,
      density: 400, color: [0.96, 0.42, 0.56],
      density_tex: { type: 'sphere',
        center: [0.2 + 0.6 * api.random(), 0.85],
        radius: 0.055, mul: 4 } });
  }
});`,
  },
  {
    id: "runtime",
    label: "Modify a running scene",
    code: `// Everything below happens LIVE — no reload.
sim.addWheel({ center: [0.28, 0.62], radius: 0.11,
               blades: 7, mode: 'motor', speed: 220 });
sim.addWheel({ center: [0.72, 0.55], radius: 0.13,
               mode: 'free' });
sim.addSource({ type: 'water', position: [0.72, 0.92],
  size: [0.05, 0.025], velocity: [0, -1.6], ppc: 2.5,
  color: [0.3, 0.6, 1], until: 6 });
sim.addRigid({ codimensional: false,
  initial_position: [0.5, 0.9], density: 500,
  shape: { star: [8, 0.05, 0.035] },
  color: [0.95, 0.55, 0.4] });
sim.setGravity([0, -6]);`,
  },
  {
    id: "touch",
    label: "Touch / mouse tools",
    code: `// Try dragging inside the canvas after running this.
sim.setPointer({
  mode: 'spawn',            // 'push' | 'spawn' | 'tilt' | 'off'
  size: 0.028,
  material: { type: 'sand', density: 1200,
              color: [0.93, 0.76, 0.45], ppc: 3 },
});
// Other tools:
// sim.setPointer({ mode: 'push' });   // shove & cut material
// sim.setPointer({ mode: 'tilt', strength: 12 });`,
  },
  {
    id: "waves",
    label: "Gravity waves (onUpdate)",
    code: `// Rock the whole world like a boat.
sim.loadScene('buoyancy');
sim.onUpdate(function (t, dt, api) {
  api.setConfig({
    gravity: [7 * Math.sin(t * 1.6), -10],
  });
});`,
  },
];

const SCENE_META: { id: string; label: string; dim: number }[] = [
  { id: "sand-wheel", label: "Sand Wheel", dim: 2 },
  { id: "water-wheel-2d", label: "Water Wheel", dim: 2 },
  { id: "cutting", label: "CPIC Cutting", dim: 2 },
  { id: "buoyancy", label: "Buoyancy", dim: 2 },
  { id: "sand-car", label: "Crawler", dim: 2 },
  { id: "materials", label: "Materials", dim: 2 },
  { id: "water-wheel-3d", label: "Water Wheel", dim: 3 },
  { id: "sand-stir-3d", label: "Sand Stir", dim: 3 },
  { id: "jelly-cut-3d", label: "Jelly Cut", dim: 3 },
  { id: "rigid-pile-3d", label: "Rigid Pool", dim: 3 },
];

const label = "text-[10px] font-semibold uppercase tracking-[0.14em] text-mut";
const chip =
  "rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 cursor-pointer select-none";
const chipOff =
  "border-line bg-ink-800/60 text-mut hover:border-ink-600 hover:text-fg";
const chipOn =
  "border-amber/60 bg-amber/15 text-amber shadow-[0_0_14px_rgba(255,178,36,0.15)]";

const Playground = forwardRef<PlaygroundHandle>(function Playground(_, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<MPMType>(null);
  const mpmRef = useRef<MPMType>(null);
  const statsRef = useRef<MPMType>(null);

  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState("sand-wheel");
  const [sceneName, setSceneName] = useState("Sand Wheel");
  const [dim, setDim] = useState(2);
  const [running, setRunning] = useState(false);
  const [loop, setLoop] = useState(true);
  const [quality, setQuality] = useState("medium");
  const [colorMode, setColorMode] = useState("material");
  const [blocks, setBlocks] = useState(false);
  const [pointScale, setPointScale] = useState(1);
  const [stats, setStats] = useState<MPMType>(null);
  const [duration, setDuration] = useState(6);
  const [tool, setTool] = useState("off");
  const [spawnMat, setSpawnMat] = useState("water");
  const [gx, setGx] = useState(0);
  const [gy, setGy] = useState(-10);
  const [faucet, setFaucet] = useState(false);
  const faucetId = useRef<number | null>(null);
  const [tab, setTab] = useState<"code" | "console" | "stats">("code");
  const [exampleId, setExampleId] = useState("declarative");
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState("worker");
  const toastTimer = useRef<number>(0);

  const pushLog = useCallback((line: string, level = "info") => {
    const at = new Date().toLocaleTimeString([], { hour12: false });
    setLogs((l) => [...l.slice(-120), { line, level, at }]);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- boot -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let sim: MPMType = null;
    loadMPM().then((MPM) => {
      if (cancelled || !hostRef.current) return;
      mpmRef.current = MPM;
      sim = MPM.create(hostRef.current, {
        scene: "sand-wheel",
        quality: "medium",
        loop: true,
        background: "#0b1120",
      });
      simRef.current = sim;
      sim.on("ready", (e: MPMType) => {
        setBooting(false);
        setMode(e.mode);
        pushLog(`Engine ready — WASM ${e.simd ? "SIMD" : "baseline"}, ${e.mode} thread`);
      });
      sim.on("loaded", (info: MPMType) => {
        setSceneName(info.name);
        setDim(info.dim);
        setDuration(info.duration);
        setFaucet(false);
        faucetId.current = null;
        setSceneId(info.sceneId === "custom" ? "" : info.sceneId);
      });
      sim.on("state", (s: MPMType) => setRunning(s.running));
      sim.on("frame", (s: MPMType) => { statsRef.current = s; });
      sim.on("log", (e: MPMType) => pushLog(e.line, e.level));
      sim.on("error", (e: MPMType) => {
        pushLog(e.message, "error");
        showToast("Error — see console");
      });
    }).catch((e) => {
      setBooting(false);
      setBootError(String(e));
    });
    const iv = window.setInterval(() => {
      if (statsRef.current) setStats({ ...statsRef.current });
    }, 300);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      if (sim) sim.destroy();
      simRef.current = null;
    };
  }, [pushLog, showToast]);

  // ---- actions ----------------------------------------------------------
  const loadScene = (id: string) => {
    const sim = simRef.current;
    if (!sim) return;
    setSceneId(id);
    setTool("off");
    sim.setPointer({ mode: "off" });
    sim.loadScene(id, { quality, autostart: true });
  };
  const changeQuality = (q: string) => {
    setQuality(q);
    simRef.current?.setQuality(q);
  };
  const applyTool = (t: string, matOverride?: string) => {
    setTool(t);
    const mats: Record<string, MPMType> = {
      water: { type: "water", density: 1000, color: [0.3, 0.6, 1] },
      sand: { type: "sand", density: 1200, color: [0.93, 0.76, 0.45] },
      jelly: { type: "jelly", E: 2e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56], ppc: 3 },
      snow: { type: "snow", youngs_modulus: 3e4, hardening: 10, density: 400, color: [0.92, 0.96, 1], ppc: 3 },
    };
    simRef.current?.setPointer({ mode: t, material: mats[matOverride || spawnMat], size: 0.026, strength: 12 });
    if (t !== "off") showToast(t === "push" ? "Drag on the canvas to push & cut" : t === "spawn" ? `Hold to pour ${spawnMat}` : "Hold & drag to tilt gravity");
  };
  const applyGravity = (x: number, y: number) => {
    setGx(x); setGy(y);
    simRef.current?.setGravity([x, y]);
  };
  const addWheel = async (motor: boolean) => {
    const sim = simRef.current;
    if (!sim || dim !== 2) return;
    const id = await sim.addWheel({
      center: [0.2 + Math.random() * 0.6, 0.45 + Math.random() * 0.3],
      radius: 0.09 + Math.random() * 0.05,
      blades: 6 + Math.floor(Math.random() * 5),
      mode: motor ? "motor" : "free",
      speed: (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 160),
    });
    pushLog(`addWheel(${motor ? "motor" : "free"}) → rigid #${id}`);
    showToast(`${motor ? "Motor" : "Free"} wheel added while running — id ${id}`);
  };
  const toggleFaucet = async () => {
    const sim = simRef.current;
    if (!sim) return;
    if (faucet && faucetId.current !== null) {
      await sim.removeSource(faucetId.current);
      faucetId.current = null;
      setFaucet(false);
      pushLog("Sand faucet removed");
    } else {
      const id = await sim.addSource({
        type: "sand", position: [0.5, 0.94], size: [0.06, 0.03],
        velocity: [0, -1.2], ppc: 3, density: 1200,
        color: [0.93, 0.76, 0.45],
      });
      faucetId.current = id;
      setFaucet(true);
      pushLog(`addSource(sand) → source #${id}`);
      showToast("Sand faucet pouring — added live");
    }
  };
  const runCode = useCallback((src: string) => {
    const sim = simRef.current;
    const MPM = mpmRef.current;
    if (!sim || !MPM) return;
    setTab("code");
    pushLog("▶ Running editor code…");
    try {
      // eslint-disable-next-line no-new-func
      new Function("sim", "MPM", `"use strict";\n${src}`)(sim, MPM);
      showToast("Code executed on the live simulation");
    } catch (e) {
      pushLog(String(e), "error");
      setTab("console");
      showToast("Code error — see console");
    }
  }, [pushLog, showToast]);

  useImperativeHandle(ref, () => ({
    runCode: (src: string) => { setCode(src); runCode(src); },
    loadExample: (src: string) => { setCode(src); setTab("code"); },
    focus: () => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
  }), [runCode]);

  const progress = duration > 0 && stats ? Math.min(1, stats.t / duration) : 0;

  // ---- render -----------------------------------------------------------
  return (
    <div ref={sectionRef} className="scroll-mt-24">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* left: canvas + tabs */}
        <div className="min-w-0">
          <div className="panel relative overflow-hidden rounded-xl">
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <div ref={hostRef} className="absolute inset-0" />
              {/* HUD */}
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded-md bg-ink-950/80 px-2.5 py-1 font-display text-[11px] font-semibold tracking-wide text-fg backdrop-blur">
                  {sceneName}
                </span>
                <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold backdrop-blur", dim === 3 ? "bg-sky/20 text-sky" : "bg-aqua/15 text-aqua")}>
                  {dim}D
                </span>
                {running && (
                  <span className="flex items-center gap-1.5 rounded-md bg-ink-950/70 px-2 py-1 text-[10px] font-medium text-aqua backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-blink rounded-full bg-aqua" /> LIVE
                  </span>
                )}
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-ink-950/80 px-2.5 py-1 font-mono text-[11px] text-mut backdrop-blur">
                {stats ? `${stats.particles.toLocaleString()} pts · ${stats.simSpeed.toFixed(2)}×` : "—"}
              </div>
              {dim === 3 && (
                <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-ink-950/70 px-2.5 py-1 text-[10px] text-mut backdrop-blur">
                  drag to orbit · scroll to zoom · double-click to reset
                </div>
              )}
              {toast && (
                <div className="absolute bottom-8 left-3 max-w-[80%] animate-rise rounded-lg border border-amber/40 bg-ink-950/90 px-3 py-2 text-[12px] font-medium text-amber shadow-lg backdrop-blur">
                  {toast}
                </div>
              )}
              {booting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/85">
                  <Loader2 className="animate-spin text-amber" size={28} />
                  <p className="text-[13px] text-mut">Compiling WebAssembly solver…</p>
                </div>
              )}
              {bootError && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink-950/90 p-6 text-center text-[13px] text-coral">
                  {bootError}
                </div>
              )}
              {/* progress */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-800/80">
                <div className="h-full bg-gradient-to-r from-amber to-coral transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </div>

          {/* transport */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => simRef.current?.toggle()}
              className="flex h-10 items-center gap-2 rounded-lg bg-amber px-4 text-[13px] font-semibold text-ink-950 shadow-[0_4px_18px_rgba(255,178,36,0.3)] transition-transform hover:scale-[1.03] active:scale-95"
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
              {running ? "Pause" : "Play"}
            </button>
            <button onClick={() => simRef.current?.step()} title="Advance one frame"
              className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-ink-800/70 px-3 text-[12px] font-medium text-mut transition-colors hover:text-fg">
              <StepForward size={14} /> Step
            </button>
            <button onClick={() => { simRef.current?.reset({ autostart: true }); }} title="Rebuild scene"
              className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-ink-800/70 px-3 text-[12px] font-medium text-mut transition-colors hover:text-fg">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={() => { const v = !loop; setLoop(v); if (simRef.current) simRef.current.loop = v; }}
              className={cn("flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors", loop ? "border-aqua/50 bg-aqua/10 text-aqua" : "border-line bg-ink-800/70 text-mut hover:text-fg")}>
              <Repeat size={14} /> Loop
            </button>
            <div className="ml-auto font-mono text-[11px] text-mut">
              t = {stats ? stats.t.toFixed(2) : "0.00"}s{duration > 0 ? ` / ${duration}s` : ""} · {mode}
            </div>
          </div>

          {/* tabs */}
          <div className="panel mt-3 overflow-hidden rounded-xl">
            <div className="flex items-center border-b border-line">
              {([["code", "Live code", Code2], ["console", "Console", Terminal], ["stats", "Stats", Activity]] as const).map(([id, lbl, Icon]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition-colors", tab === id ? "border-b-2 border-amber bg-ink-800/50 text-fg" : "text-mut hover:text-fg")}>
                  <Icon size={13} /> {lbl}
                  {id === "console" && logs.some((l) => l.level === "error") && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}
                </button>
              ))}
              {tab === "code" && (
                <div className="ml-auto flex items-center gap-2 pr-2">
                  <select value={exampleId}
                    onChange={(e) => { setExampleId(e.target.value); const ex = EXAMPLES.find((x) => x.id === e.target.value); if (ex) setCode(ex.code); }}
                    className="rounded-md border border-line bg-ink-800 px-2 py-1 text-[11px] text-mut outline-none focus:border-amber/50">
                    {EXAMPLES.map((ex) => <option key={ex.id} value={ex.id}>{ex.label}</option>)}
                  </select>
                  <button onClick={() => runCode(code)}
                    className="flex items-center gap-1.5 rounded-md bg-aqua px-3 py-1.5 text-[11px] font-bold text-ink-950 transition-transform hover:scale-105 active:scale-95">
                    <Play size={11} /> RUN
                  </button>
                </div>
              )}
            </div>
            {tab === "code" && (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="code-scroll h-64 w-full resize-y bg-[#0b1120] p-4 font-mono text-[12px] leading-relaxed text-[#d7e3f8] outline-none"
              />
            )}
            {tab === "console" && (
              <div className="code-scroll h-64 overflow-auto bg-[#0b1120] p-3 font-mono text-[11.5px] leading-relaxed">
                {logs.length === 0 && <p className="text-mut">Solver output and editor results appear here.</p>}
                {logs.map((l, i) => (
                  <p key={i} className={cn("whitespace-pre-wrap", l.level === "error" ? "text-coral" : l.level === "warn" ? "text-amber" : "text-[#9fb2d4]")}>
                    <span className="text-[#54688c]">{l.at} </span>{l.line}
                  </p>
                ))}
              </div>
            )}
            {tab === "stats" && stats && (
              <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
                {[
                  ["Particles", stats.particles.toLocaleString()],
                  ["Rigid bodies", String(stats.rigids)],
                  ["Sim speed", `${stats.simSpeed.toFixed(2)}×`],
                  ["Substeps/s", stats.substepsPerSec.toFixed(0)],
                  ["ms / substep", stats.msPerSubstep.toFixed(2)],
                  ["Active blocks", stats.blocks.toLocaleString()],
                  ["Cutting blocks", String(stats.cutting)],
                  ["WASM memory", `${stats.memoryMB.toFixed(1)} MB`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-ink-850 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-mut">{k}</p>
                    <p className="mt-1 font-mono text-[15px] font-medium text-fg">{v}</p>
                  </div>
                ))}
              </div>
            )}
            {tab === "stats" && !stats && <p className="p-4 text-[12px] text-mut">Waiting for first frame…</p>}
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-4">
          <div className="panel rounded-xl p-4">
            <p className={label}>Scenes</p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {SCENE_META.map((s) => (
                <button key={s.id} onClick={() => loadScene(s.id)}
                  className={cn(chip, "flex items-center justify-between", sceneId === s.id ? chipOn : chipOff)}>
                  <span className="truncate">{s.label}</span>
                  <span className={cn("ml-1 text-[9px] font-bold", sceneId === s.id ? "text-amber/80" : "text-mut/60")}>{s.dim}D</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={label}>Quality</span>
              <div className="ml-auto flex overflow-hidden rounded-md border border-line">
                {["low", "medium", "high"].map((q) => (
                  <button key={q} onClick={() => changeQuality(q)}
                    className={cn("px-2.5 py-1 text-[11px] font-medium capitalize transition-colors", quality === q ? "bg-amber/20 text-amber" : "bg-ink-800/60 text-mut hover:text-fg")}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel rounded-xl p-4">
            <p className={label}>Touch / pointer tool</p>
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {([["off", "Off", MousePointer2], ["push", "Push", Hand], ["spawn", "Spawn", Droplets], ["tilt", "Tilt", Compass]] as const).map(([id, lbl, Icon]) => (
                <button key={id} onClick={() => applyTool(id)} disabled={dim === 3}
                  className={cn(chip, "flex flex-col items-center gap-1 py-2 disabled:cursor-not-allowed disabled:opacity-40", tool === id ? chipOn : chipOff)}>
                  <Icon size={15} />
                  <span className="text-[10px]">{lbl}</span>
                </button>
              ))}
            </div>
            {tool === "spawn" && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] text-mut">Material:</span>
                {["water", "sand", "jelly", "snow"].map((m) => (
                  <button key={m} onClick={() => { setSpawnMat(m); applyTool("spawn", m); }}
                    className={cn("rounded px-2 py-0.5 text-[11px] capitalize", spawnMat === m ? "bg-sky/20 text-sky" : "text-mut hover:text-fg")}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] leading-snug text-mut">
              {dim === 3 ? "Pointer tools are 2D — orbit the camera instead." : tool === "off" ? "Pick a tool, then drag on the canvas." : tool === "push" ? "A kinematic paddle follows your finger — it shoves and cuts." : tool === "spawn" ? "Hold to pour material at the pointer." : "Gravity leans toward your pointer while held."}
            </p>
          </div>

          <div className="panel rounded-xl p-4">
            <p className={label}>Live physics</p>
            <div className="mt-2.5 space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-mut">
                  <span>Gravity X</span><span className="font-mono text-fg">{gx.toFixed(1)}</span>
                </div>
                <input type="range" min={-20} max={20} step={0.5} value={gx}
                  onChange={(e) => applyGravity(Number(e.target.value), gy)}
                  className="w-full accent-[#ffb224]" />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-mut">
                  <span>Gravity Y</span><span className="font-mono text-fg">{gy.toFixed(1)}</span>
                </div>
                <input type="range" min={-20} max={20} step={0.5} value={gy}
                  onChange={(e) => applyGravity(gx, Number(e.target.value))}
                  className="w-full accent-[#ffb224]" />
              </div>
              <div className="flex gap-1.5">
                {[["Earth", 0, -10], ["Moon", 0, -1.6], ["Zero", 0, 0], ["Flip", 0, 10]].map(([n, x, y]) => (
                  <button key={n as string} onClick={() => applyGravity(x as number, y as number)}
                    className={cn(chip, chipOff, "flex-1 py-1 text-[11px]")}>{n}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button onClick={() => addWheel(true)} disabled={dim === 3}
                className={cn(chip, chipOff, "flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40")}>
                <Fan size={13} className="text-amber" /> Motor wheel
              </button>
              <button onClick={() => addWheel(false)} disabled={dim === 3}
                className={cn(chip, chipOff, "flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40")}>
                <Fan size={13} className="text-aqua" /> Free wheel
              </button>
              <button onClick={toggleFaucet} disabled={dim === 3}
                className={cn(chip, "flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40", faucet ? chipOn : chipOff)}>
                <Plus size={13} /> Sand faucet
              </button>
              <button onClick={() => { simRef.current?.clearSources(); setFaucet(false); faucetId.current = null; pushLog("Sources cleared"); }}
                className={cn(chip, chipOff, "flex items-center justify-center gap-1.5")}>
                <Trash2 size={13} /> Clear sources
              </button>
            </div>
          </div>

          <div className="panel rounded-xl p-4">
            <p className={label}>Rendering</p>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[11px] text-mut">Color</span>
              <select value={colorMode}
                onChange={(e) => { setColorMode(e.target.value); simRef.current?.setColorMode(e.target.value); }}
                className="ml-auto rounded-md border border-line bg-ink-800 px-2 py-1 text-[11px] text-fg outline-none focus:border-amber/50">
                <option value="material">Material</option>
                <option value="velocity">Velocity heat</option>
                <option value="cpic">CPIC side</option>
                <option value="plasticity">Plasticity</option>
              </select>
            </div>
            <div className="mt-2.5">
              <div className="flex justify-between text-[11px] text-mut">
                <span>Point size</span><span className="font-mono text-fg">{pointScale.toFixed(1)}×</span>
              </div>
              <input type="range" min={0.5} max={2.5} step={0.1} value={pointScale}
                onChange={(e) => { const v = Number(e.target.value); setPointScale(v); simRef.current?.setPointScale(v); }}
                className="w-full accent-[#3ed6c4]" />
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-mut">
              <input type="checkbox" checked={blocks}
                onChange={(e) => { setBlocks(e.target.checked); simRef.current?.setShowBlocks(e.target.checked); }}
                className="accent-[#ff6b81]" />
              Show sparse blocks (debug)
            </label>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-ink-900/60 p-2.5 text-[11px] leading-snug text-mut">
              <FlaskConical size={22} className="shrink-0 text-coral" />
              Every control here calls the public API on the running simulation — the same calls you can make from your own scripts.
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-mut">
        <BoxIcon size={12} />
        Solver: MLS-MPM + CPIC (taichi_mpm full solver) · WebAssembly {[stats ? "" : ""]}· rendered with WebGL2
      </div>
    </div>
  );
});

export default Playground;
