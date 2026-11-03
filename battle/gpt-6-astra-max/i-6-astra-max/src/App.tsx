import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  Download,
  Expand,
  ExternalLink,
  FileCode2,
  Grab,
  Grid2X2,
  Layers3,
  LoaderCircle,
  Maximize,
  MousePointer2,
  Move,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  StepForward,
  X,
} from "lucide-react";
import { Viewport, type ViewportHandle } from "./Viewport";
import {
  initialSettings,
  materials,
  presets,
  type Settings,
  type SimulationFrame,
} from "./simulation";

function Github({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.8a3.3 3.3 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.8a5.3 5.3 0 0 0-1.5-3.7A5 5 0 0 0 18.7 1S17.5.7 15 2.4a13 13 0 0 0-6 0C6.5.7 5.3 1 5.3 1a5 5 0 0 0-.1 4.1 5.3 5.3 0 0 0-1.5 3.7c0 5.3 3.2 6.5 6.2 6.8a3.3 3.3 0 0 0-.9 2.6V22" />
    </svg>
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "brand-mark small" : "brand-mark"}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 3 31 10.5v15L18 33 5 25.5v-15L18 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m5 10.5 13 7.6 13-7.6M18 18.1V33M11.5 6.75l13 7.5v15M24.5 6.75l-13 7.5v15M5 18l13 7.5L31 18"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`icon-button ${active ? "active" : ""} ${className}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
      <button
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
      >
        <span />
      </button>
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  display?: string;
}) {
  const id = useId();
  return (
    <div className="range-field">
      <div className="field-label">
        <label htmlFor={id}>{label}</label>
        <span className="number-value">
          {display ?? value}
          <span>{unit}</span>
        </span>
      </div>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function PresetArt({ index }: { index: number }) {
  return (
    <div className={`preset-art preset-art-${index}`}>
      <div className="mini-grid" />
      <div className="mini-object">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

const emptyStats = {
  count: 0,
  frame: 0,
  time: 0,
  substeps: 0,
  blocks: 0,
  memory: 0,
  duration: 0,
};
type Modal = "examples" | "docs" | "about" | "export" | "help" | null;

export default function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [applied, setApplied] = useState<Settings>(initialSettings);
  const [tab, setTab] = useState("Scene");
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [fatalError, setFatalError] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [grid, setGrid] = useState(true);
  const [bounds, setBounds] = useState(true);
  const [coloring, setColoring] = useState("Material");
  const [pointSize, setPointSize] = useState(2.8);
  const [tool, setTool] = useState("orbit");
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const worker = useRef<Worker | null>(null);
  const viewport = useRef<ViewportHandle>(null);
  const canvasPanel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const appliedRef = useRef(applied);
  const latestFrame = useRef<SimulationFrame | null>(null);
  const initRef = useRef<(settings: Settings, play?: boolean) => void>(
    () => {},
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(applied);
  const preset = presets[applied.scene];
  const material = materials[applied.material];
  appliedRef.current = applied;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }, []);

  const download = useCallback((blob: Blob, name: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, []);

  const initialize = useCallback((next: Settings, play = true) => {
    generation.current += 1;
    setStatus("loading");
    setError("");
    setFatalError(false);
    setStats(emptyStats);
    setApplied(next);
    setSettings(next);
    setPlaying(play);
    latestFrame.current = null;
    worker.current?.postMessage({
      type: "init",
      settings: next,
      generation: generation.current,
      play,
    });
  }, []);
  initRef.current = initialize;

  useEffect(() => {
    const instance = new Worker(
      new URL("simulation-worker.js", document.baseURI),
      { type: "module" },
    );
    worker.current = instance;
    instance.onmessage = ({ data }) => {
      if (data.type === "ready") initRef.current(initialSettings);
      if (data.type === "initialized" && data.generation === generation.current)
        setStatus("ready");
      if (data.type === "frame" && data.generation === generation.current) {
        latestFrame.current = data;
        viewport.current?.update(data);
        setStats({
          count: data.count,
          frame: data.frame,
          time: data.time,
          substeps: data.substeps,
          blocks: data.blocks,
          memory: data.memory,
          duration: data.duration,
        });
      }
      if (data.type === "error") {
        setError(data.message);
        setFatalError(Boolean(data.fatal));
        setStatus("error");
        setPlaying(false);
        setExporting(false);
      }
      if (data.type === "snapshot") {
        download(
          new Blob([data.bytes], { type: "application/octet-stream" }),
          "taichi-mpm-snapshot.tcb",
        );
        setExporting(false);
        setModal(null);
        notify("Full solver state exported as a .tcb snapshot.");
      }
    };
    instance.onerror = (event) => {
      setFatalError(true);
      setError(
        event.message ||
          "Could not load the WebAssembly solver. Please reload to try again.",
      );
      setStatus("error");
      setPlaying(false);
    };
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, [download, notify]);

  const togglePlay = useCallback(() => {
    if (status !== "ready") return;
    const next = !playing;
    setPlaying(next);
    worker.current?.postMessage({ type: "play", value: next });
  }, [status, playing]);

  const step = useCallback(() => {
    if (status !== "ready") return;
    setPlaying(false);
    worker.current?.postMessage({ type: "step" });
  }, [status]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement ||
        modal
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      }
      if (event.key.toLowerCase() === "r") initialize(appliedRef.current);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step();
      }
      if (event.key.toLowerCase() === "g") setGrid((current) => !current);
      if (event.key === "?") setModal("help");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [togglePlay, initialize, step, modal]);

  useEffect(() => {
    if (!modal) return;
    lastFocus.current = document.activeElement as HTMLElement;
    modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const items = modalRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeys);
    return () => {
      document.removeEventListener("keydown", handleKeys);
      document.body.style.overflow = previousOverflow;
      lastFocus.current?.focus();
    };
  }, [modal]);

  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const update = (key: keyof Settings, value: number) =>
    setSettings((current) => ({ ...current, [key]: value }));
  const choosePreset = (index: number) => {
    const p = presets[index];
    initialize({ ...applied, scene: p.scene, material: p.material });
    setModal(null);
    setTab("Scene");
    viewport.current?.resetCamera();
  };
  const exportScene = () => {
    const frame = latestFrame.current;
    if (!frame) return;
    const particles = Array.from({ length: frame.count }, (_, i) => ({
      position: Array.from(frame.particles.slice(i * 8, i * 8 + 3)),
      velocity: Array.from(frame.particles.slice(i * 8 + 3, i * 8 + 6)),
      material: frame.particles[i * 8 + 6],
      id: frame.particles[i * 8 + 7],
    }));
    download(
      new Blob(
        [
          JSON.stringify({
            solver: "taichi_mpm/full",
            version: 1,
            settings: applied,
            time: stats.time,
            particles,
          }),
        ],
        { type: "application/json" },
      ),
      "taichi-mpm-particles.json",
    );
    setModal(null);
    notify("Particle positions, velocities, and scene settings exported.");
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          href="#"
          className="brand"
          aria-label="Taichi MPM workspace"
          onClick={(event) => {
            event.preventDefault();
            setModal(null);
          }}
        >
          <BrandMark />
          <span>
            taichi<span className="brand-divider">/</span>
            <span className="brand-mpm">mpm</span>
          </span>
          <span className="lab-label">LAB</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={
              !modal || modal === "export" || modal === "help" ? "selected" : ""
            }
            onClick={() => setModal(null)}
          >
            Playground
          </button>
          <button
            className={modal === "examples" ? "selected" : ""}
            onClick={() => setModal("examples")}
          >
            Examples
          </button>
          <button
            className={modal === "docs" ? "selected" : ""}
            onClick={() => setModal("docs")}
          >
            Documentation
            <ArrowUpRight size={12} />
          </button>
        </nav>
        <div className="header-right">
          <span className={`engine-state ${status}`}>
            <span className="status-dot" />
            {status === "ready"
              ? "WASM ready"
              : status === "loading"
                ? "Loading WASM"
                : "Solver stopped"}
          </span>
          <a
            className="source-link"
            href="https://github.com/yuanming-hu/taichi_mpm"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            <span>Source</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace-heading">
          <div>
            <div className="heading-line">
              <h1>Material playground</h1>
              <span className="beta-label">BROWSER EDITION</span>
            </div>
            <p>A little physics. A lot of possibility. Make matter move.</p>
          </div>
          <button
            className="button secondary export-button"
            disabled={status !== "ready"}
            onClick={() => setModal("export")}
          >
            <Download size={15} />
            Export scene
          </button>
        </section>

        <div className="workspace-layout">
          <aside className="inspector">
            <div
              className="inspector-tabs"
              role="tablist"
              aria-label="Simulation settings"
            >
              {["Scene", "Solver", "Display"].map((name) => (
                <button
                  key={name}
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={tab === name ? "selected" : ""}
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              className="inspector-content"
              role="tabpanel"
              aria-label={`${tab} settings`}
            >
              {tab === "Scene" && (
                <>
                  <div className="section-label">
                    <span>SCENE PRESET</span>
                    <button
                      onClick={() => setModal("examples")}
                      title="Browse all scenes"
                      aria-label="Browse all scenes"
                    >
                      <Grid2X2 size={13} />
                    </button>
                  </div>
                  <div className="preset-select">
                    <div className="preset-cube">
                      <Box size={22} strokeWidth={1.3} />
                    </div>
                    <div>
                      <select
                        aria-label="Scene preset"
                        value={settings.scene}
                        onChange={(e) => choosePreset(Number(e.target.value))}
                      >
                        {presets.map((p, i) => (
                          <option key={p.name} value={i}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <span>{presets[settings.scene].label}</span>
                    </div>
                    <ChevronDown size={14} />
                  </div>
                  <div className="dimension-row">
                    <span>Dimensions</span>
                    <div className="segmented">
                      {[2, 3].map((dim) => (
                        <button
                          key={dim}
                          className={
                            settings.dimension === dim ? "selected" : ""
                          }
                          onClick={() => update("dimension", dim)}
                        >
                          {dim}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="section-label material-label">MATERIAL</div>
                  <div className="material-grid">
                    {materials.slice(0, 4).map((m, i) => (
                      <button
                        key={m.name}
                        className={`material-option ${settings.material === i ? "selected" : ""}`}
                        onClick={() => update("material", i)}
                      >
                        <span
                          className={`material-swatch swatch-${i}`}
                          style={{ "--swatch": m.color } as React.CSSProperties}
                        />
                        {m.name}
                        {settings.material === i && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                  <p className="material-description">
                    {materials[settings.material].description}
                  </p>
                  <div className="section-divider" />
                  <button
                    className="section-label section-toggle"
                    aria-expanded={propertiesOpen}
                    onClick={() => setPropertiesOpen(!propertiesOpen)}
                  >
                    <span>MATERIAL PROPERTIES</span>
                    <ChevronDown
                      size={13}
                      className={propertiesOpen ? "" : "collapsed"}
                    />
                  </button>
                  {propertiesOpen && (
                    <div className="property-fields">
                      <Range
                        label="Young's modulus"
                        value={settings.stiffness}
                        min={1000}
                        max={100000}
                        step={1000}
                        display={`${settings.stiffness / 1000}`}
                        unit="kPa"
                        onChange={(v) => update("stiffness", v)}
                      />
                      <Range
                        label={
                          settings.material === 0
                            ? "Friction angle"
                            : "Friction angle (sand)"
                        }
                        value={settings.friction}
                        min={5}
                        max={55}
                        unit="deg"
                        onChange={(v) => update("friction", v)}
                      />
                    </div>
                  )}
                  <div className="section-divider" />
                  <div className="section-label">ENVIRONMENT</div>
                  <Range
                    label="Gravity"
                    value={settings.gravity}
                    min={-20}
                    max={0}
                    step={0.1}
                    display={settings.gravity.toFixed(1)}
                    unit="m/s^2"
                    onChange={(v) => update("gravity", v)}
                  />
                  <div className="boundary-label">
                    <Box size={13} />
                    <span>Closed boundary</span>
                    <span>Frictional</span>
                  </div>
                </>
              )}
              {tab === "Solver" && (
                <>
                  <div className="section-label">SIMULATION ENGINE</div>
                  <div className="solver-identity">
                    <Cpu size={21} />
                    <div>
                      <strong>Full MLS-MPM + CPIC</strong>
                      <small>Upstream C++ / WebAssembly SIMD</small>
                    </div>
                  </div>
                  <label className="select-field">
                    Grid resolution
                    <select
                      aria-label="Grid resolution"
                      value={settings.resolution}
                      onChange={(e) =>
                        update("resolution", Number(e.target.value))
                      }
                    >
                      {[32, 48, 64, 96].map((n) => (
                        <option key={n} value={n}>
                          {n} x {n}
                          {settings.dimension === 3 ? ` x ${n}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="select-field">
                    Particle count
                    <select
                      aria-label="Particle count"
                      value={settings.count}
                      onChange={(e) => update("count", Number(e.target.value))}
                    >
                      {[4000, 8000, 18000, 32000, 50000].map((n) => (
                        <option key={n} value={n}>
                          {n.toLocaleString()} particles
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="select-field">
                    Time step
                    <select
                      aria-label="Time step"
                      value={settings.dt}
                      onChange={(e) => update("dt", Number(e.target.value))}
                    >
                      <option value={0.0001}>0.0001 s / precise</option>
                      <option value={0.0002}>0.0002 s / balanced</option>
                      <option value={0.0004}>0.0004 s / fast</option>
                    </select>
                  </label>
                  <label className="select-field">
                    Constitutive model
                    <select
                      aria-label="Constitutive model"
                      value={settings.material}
                      onChange={(e) =>
                        update("material", Number(e.target.value))
                      }
                    >
                      {materials.map((m, i) => (
                        <option key={m.name} value={i}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="helper-text">
                    {materials[settings.material].model}
                  </p>
                  <div className="section-divider" />
                  <div className="solver-fact">
                    <span>Execution</span>
                    <span>Dedicated worker</span>
                  </div>
                  <div className="solver-fact">
                    <span>Transfers</span>
                    <span>APIC / MLS</span>
                  </div>
                  <div className="solver-fact">
                    <span>Grid storage</span>
                    <span>SPGrid</span>
                  </div>
                  <p className="solver-note">
                    <CircleHelp size={14} />
                    Higher resolutions and stiffer materials need a smaller time
                    step.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => setModal("docs")}
                  >
                    Understand the solver
                    <ArrowUpRight size={13} />
                  </button>
                </>
              )}
              {tab === "Display" && (
                <>
                  <div className="section-label">VIEWPORT</div>
                  <Toggle
                    label="Ground grid"
                    description="A little perspective"
                    checked={grid}
                    onChange={() => setGrid(!grid)}
                  />
                  <Toggle
                    label="Domain bounds"
                    description="Show the simulation volume"
                    checked={bounds}
                    onChange={() => setBounds(!bounds)}
                  />
                  <div className="section-divider" />
                  <Range
                    label="Particle size"
                    min={1}
                    max={5}
                    step={0.1}
                    value={pointSize}
                    display={pointSize.toFixed(1)}
                    unit="px"
                    onChange={setPointSize}
                  />
                  <label className="select-field">
                    Color particles by
                    <select
                      aria-label="Color particles by"
                      value={coloring}
                      onChange={(e) => setColoring(e.target.value)}
                    >
                      <option>Material</option>
                      <option>Velocity</option>
                      <option>Height</option>
                    </select>
                  </label>
                  <div className="color-scale">
                    <span />
                    <div>
                      <small>{coloring === "Velocity" ? "Rest" : "Low"}</small>
                      <small>
                        {coloring === "Velocity" ? "3 m/s" : "High"}
                      </small>
                    </div>
                  </div>
                  <div className="section-divider" />
                  <button
                    className="button secondary full-width"
                    onClick={() => viewport.current?.resetCamera()}
                  >
                    <Maximize size={15} />
                    Reset camera
                  </button>
                  <button
                    className="button secondary full-width"
                    onClick={() => {
                      viewport.current?.screenshot();
                      notify("Viewport saved as a PNG image.");
                    }}
                  >
                    <ArrowDownToLine size={15} />
                    Save image
                  </button>
                  <p className="helper-text">
                    Display changes are immediate and do not reset the
                    simulation.
                  </p>
                </>
              )}
            </div>
            <div className="inspector-bottom">
              <button
                className={`button apply-button ${dirty ? "has-changes" : ""}`}
                disabled={status === "loading"}
                onClick={() => {
                  initialize(settings);
                  if (dirty) notify("Scene settings applied. A fresh start.");
                }}
              >
                <RotateCcw size={14} />
                {dirty ? "Apply & restart" : "Restart simulation"}
                <span>R</span>
              </button>
              <span className="reset-hint">
                {dirty
                  ? "You have unapplied changes"
                  : "Change a parameter. See what happens."}
              </span>
            </div>
          </aside>

          <section
            className="simulation-column"
            aria-label="Simulation workspace"
          >
            <div
              className={`canvas-panel ${fullscreen ? "is-fullscreen" : ""}`}
              ref={canvasPanel}
            >
              <div className="viewport-header">
                <div className="viewport-title">
                  <Box size={14} />
                  <span>{preset.name}</span>
                  <ChevronRight size={12} />
                  <span className="view-type">
                    {applied.dimension === 3 ? "Perspective" : "Front view"}
                  </span>
                </div>
                <div className="viewport-header-right">
                  <span className="live-label">
                    <span
                      className={
                        playing && status === "ready"
                          ? "live-dot"
                          : "paused-dot"
                      }
                    />
                    {status === "loading"
                      ? "INITIALIZING"
                      : playing
                        ? "LIVE"
                        : "PAUSED"}
                  </span>
                  <span className="viewport-header-divider" />
                  <IconButton
                    label="Toggle fullscreen"
                    onClick={async () => {
                      try {
                        if (document.fullscreenElement)
                          await document.exitFullscreen();
                        else await canvasPanel.current?.requestFullscreen();
                      } catch {
                        notify("Fullscreen is not available in this browser.");
                      }
                    }}
                  >
                    <Expand size={14} />
                  </IconButton>
                </div>
              </div>
              <div className={`viewport-stage tool-${tool}`}>
                <Viewport
                  ref={viewport}
                  grid={grid}
                  bounds={bounds}
                  dimension={applied.dimension}
                  resolution={applied.resolution}
                  pointSize={pointSize}
                  coloring={coloring}
                  tool={tool}
                  onImpulse={(position) => {
                    worker.current?.postMessage({ type: "impulse", position });
                    if (!playing)
                      notify("Impulse added. Press play to see it move.");
                  }}
                />
                <div className="viewport-tools">
                  <IconButton
                    label="Orbit camera"
                    active={tool === "orbit"}
                    onClick={() => setTool("orbit")}
                  >
                    <MousePointer2 size={16} />
                  </IconButton>
                  <IconButton
                    label="Pan camera"
                    active={tool === "pan"}
                    onClick={() => setTool("pan")}
                  >
                    <Grab size={16} />
                  </IconButton>
                  <IconButton
                    label="Interact with material"
                    active={tool === "interact"}
                    onClick={() => {
                      setTool("interact");
                      notify(
                        "Click the material to give nearby particles a gentle push.",
                      );
                    }}
                  >
                    <Move size={16} />
                  </IconButton>
                  <div />
                  <IconButton
                    label="Toggle grid (G)"
                    active={grid}
                    onClick={() => setGrid(!grid)}
                  >
                    <Grid2X2 size={16} />
                  </IconButton>
                  <IconButton
                    label="Reset camera"
                    onClick={() => viewport.current?.resetCamera()}
                  >
                    <Maximize size={16} />
                  </IconButton>
                </div>
                <div className="viewport-caption">
                  <span
                    className="caption-dot"
                    style={{ background: material.color }}
                  />
                  <span>{material.name}</span>
                  <span className="caption-divider">/</span>
                  <span>
                    {stats.count
                      ? stats.count.toLocaleString()
                      : applied.count.toLocaleString()}{" "}
                    particles
                  </span>
                </div>
                <div className="axis-widget" aria-hidden="true">
                  <svg width="70" height="70" viewBox="0 0 70 70">
                    <path
                      d="M32 39V10M32 39 9 52M32 39 59 51"
                      stroke="#586467"
                      strokeWidth="1.4"
                    />
                    <path d="M32 39V15" stroke="#9ed7b6" strokeWidth="1.5" />
                    <path d="m32 39 22 10" stroke="#b88976" strokeWidth="1.5" />
                    <path d="m32 39-18 10" stroke="#849dbf" strokeWidth="1.5" />
                    <circle cx="32" cy="39" r="3" fill="#83938e" />
                    <text x="28" y="10" fill="#a8c9b9">
                      Y
                    </text>
                    <text x="61" y="55" fill="#c69f8b">
                      X
                    </text>
                    <text x="2" y="57" fill="#9cb0c8">
                      Z
                    </text>
                  </svg>
                </div>
                {status === "loading" && (
                  <div className="loading-overlay">
                    <LoaderCircle className="spin" size={26} />
                    <strong>Setting matter in motion</strong>
                    <span>Loading the full C++ solver into WebAssembly</span>
                  </div>
                )}
                {status === "error" && (
                  <div className="loading-overlay error-overlay">
                    <CircleHelp size={28} />
                    <strong>The solver needs a fresh start</strong>
                    <p>{error}</p>
                    <button
                      className="button apply-button"
                      onClick={() =>
                        fatalError
                          ? window.location.reload()
                          : initialize({ ...settings, dt: 0.0001 })
                      }
                    >
                      <RotateCcw size={14} />
                      {fatalError
                        ? "Reload the WASM engine"
                        : "Restart with a smaller time step"}
                    </button>
                  </div>
                )}
              </div>
              <div className="playback-bar">
                <div className="playback-actions">
                  <button
                    className="play-button"
                    disabled={status !== "ready"}
                    aria-label={
                      playing ? "Pause simulation" : "Play simulation"
                    }
                    title="Play / pause (Space)"
                    onClick={togglePlay}
                  >
                    {playing ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                  <IconButton
                    label="Advance one frame (Right arrow)"
                    disabled={status !== "ready"}
                    onClick={step}
                  >
                    <StepForward size={16} />
                  </IconButton>
                  <IconButton
                    label="Restart simulation (R)"
                    disabled={status === "loading"}
                    onClick={() => initialize(applied)}
                  >
                    <RotateCcw size={15} />
                  </IconButton>
                  <span className="playback-separator" />
                  <div className="time-readout">
                    <span>
                      {stats.time.toFixed(3)}
                      <small>s</small>
                    </span>
                    <span>SIMULATION TIME</span>
                  </div>
                </div>
                <div
                  className="timeline-track"
                  aria-label={`${stats.substeps} simulation substeps`}
                >
                  <div className="timeline-ticks" />
                  <div
                    className="timeline-progress"
                    style={{
                      width: `${(stats.time % 2) * 50}%`,
                    }}
                  />
                  <div
                    className="timeline-cursor"
                    style={{
                      left: `${(stats.time % 2) * 50}%`,
                    }}
                  />
                  <span>{Math.floor(stats.time / 2) * 2} s</span>
                  <span>{Math.floor(stats.time / 2) * 2 + 1} s</span>
                  <span>{Math.floor(stats.time / 2) * 2 + 2} s</span>
                </div>
                <div className="speed-select">
                  <select
                    aria-label="Playback speed"
                    value={speed}
                    onChange={(e) => {
                      setSpeed(Number(e.target.value));
                      worker.current?.postMessage({
                        type: "speed",
                        value: Number(e.target.value),
                      });
                    }}
                  >
                    <option value={0.25}>0.25x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1.0x</option>
                    <option value={2}>2.0x</option>
                  </select>
                  <ChevronDown size={11} />
                </div>
              </div>
            </div>
            <div className="simulation-status">
              <div>
                <span className="metric-name">PARTICLES</span>
                <strong>
                  {stats.count.toLocaleString()}
                  <span>pts</span>
                </strong>
              </div>
              <div>
                <span className="metric-name">GRID RESOLUTION</span>
                <strong>
                  {applied.resolution}
                  <sup>{applied.dimension}</sup>
                  <span>cells</span>
                </strong>
              </div>
              <div>
                <span className="metric-name">STEP TIME</span>
                <strong>
                  {stats.duration ? stats.duration.toFixed(2) : "0.00"}
                  <span>ms</span>
                </strong>
              </div>
              <div>
                <span className="metric-name">MEMORY</span>
                <strong>
                  {stats.memory.toFixed(0)}
                  <span>MB</span>
                </strong>
              </div>
              <div className="solver-status">
                <Cpu size={16} />
                <span>
                  Full solver<span>MLS-MPM + CPIC</span>
                </span>
                <span className="status-dot" />
              </div>
            </div>
            <div className="interaction-help">
              <span>
                <MousePointer2 size={13} />
                Drag to orbit<span className="help-dot">/</span>Scroll to zoom
                <span className="help-dot">/</span>
                <kbd>Space</kbd> to pause
              </span>
              <button onClick={() => setModal("help")}>
                Keyboard shortcuts
                <CircleHelp size={14} />
              </button>
            </div>
          </section>
        </div>

        <footer className="workspace-footer">
          <div>
            <BrandMark small />
            <span>Real physics. Right in your browser.</span>
            <span className="footer-muted">
              No installation. No server. Just matter.
            </span>
          </div>
          <button onClick={() => setModal("about")}>
            Built on Taichi MPM<span className="footer-divider">/</span>SIGGRAPH
            2018
            <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>

      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={14} />
          </span>
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal modal-${modal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
            ref={modalRef}
          >
            <IconButton
              className="modal-close"
              label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </IconButton>
            {modal === "examples" && (
              <>
                <div className="modal-eyebrow">A GOOD PLACE TO START</div>
                <h2 id="modal-title">Small worlds. Real physics.</h2>
                <p className="modal-intro">
                  Choose an experiment, then make it your own.
                </p>
                <div className="examples-grid">
                  {presets.map((p, index) => (
                    <button
                      key={p.name}
                      className="example-card"
                      onClick={() => choosePreset(index)}
                    >
                      <PresetArt index={index} />
                      <div className="example-card-body">
                        <small>{p.tag}</small>
                        <h3>
                          {p.name}
                          <ArrowUpRight size={16} />
                        </h3>
                        <p>{p.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="modal-footnote">
                  <Cpu size={14} />
                  Every example runs the full upstream solver locally.
                </div>
              </>
            )}
            {modal === "docs" && (
              <>
                <div className="modal-eyebrow">UNDER THE SURFACE</div>
                <h2 id="modal-title">The full solver. A new home.</h2>
                <p className="modal-intro">
                  The production Taichi MPM C++ code, compiled to WebAssembly.
                  Not the compact 88-line demo.
                </p>
                <div className="documentation-sections">
                  <section>
                    <h3>
                      <Layers3 size={18} />
                      Material models
                    </h3>
                    <p>
                      Sand, snow, jelly, water, von Mises plasticity,
                      viscoelastic, logarithmic elastic, and linear elastic
                      models retain the upstream stress and plasticity
                      implementations. Find all eight in the Solver tab.
                    </p>
                  </section>
                  <section>
                    <h3>
                      <Move size={18} />
                      Transfers & coupling
                    </h3>
                    <p>
                      Both 2D and 3D solvers include APIC / MLS particle-grid
                      transfers, SPGrid, CPIC distance fields, displacement
                      discontinuities, rigid-body dynamics, collision detection,
                      and articulations.
                    </p>
                  </section>
                  <section>
                    <h3>
                      <Cpu size={18} />
                      Browser adaptation
                    </h3>
                    <p>
                      Physics runs in a dedicated, single-threaded worker with
                      WASM SIMD. TBB scheduling is serial, SPGrid uses aligned
                      linear memory, and browser rendering replaces desktop
                      visualization. The experimental asynchronous scheduler,
                      Python runtime, and native Partio/Houdini exporters are
                      not included.
                    </p>
                  </section>
                  <section>
                    <h3>
                      <SlidersHorizontal size={18} />A stable experiment
                    </h3>
                    <p>
                      Change scene settings, then select Apply & restart. Use
                      0.0001 s for high stiffness or resolution. Performance
                      depends on your device. The displayed time is simulated
                      time, not wall-clock time.
                    </p>
                  </section>
                </div>
                <a
                  className="button apply-button docs-link"
                  href="https://github.com/yuanming-hu/taichi_mpm#python-3-api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read upstream documentation
                  <ExternalLink size={15} />
                </a>
              </>
            )}
            {modal === "about" && (
              <>
                <BrandMark />
                <div className="modal-eyebrow">BUILT ON OPEN RESEARCH</div>
                <h2 id="modal-title">A little more about the matter.</h2>
                <p className="modal-intro">
                  This playground brings the full synchronous Taichi MPM solver
                  to the browser, preserving its production physics pipeline.
                </p>
                <div className="paper-reference">
                  <span>SIGGRAPH 2018</span>
                  <h3>
                    A Moving Least Squares Material Point Method with
                    Displacement Discontinuity and Two-Way Rigid Body Coupling
                  </h3>
                  <p>
                    Yuanming Hu, Yu Fang, Ziheng Ge, Ziyin Qu, Yixin Zhu, Andre
                    Pradhana, and Chenfanfu Jiang.
                  </p>
                  <a
                    href="https://yuanming.taichi.graphics/publication/2018-mlsmpm/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the research
                    <ArrowUpRight size={15} />
                  </a>
                </div>
                <div className="about-bottom">
                  <span>Open source / MIT License</span>
                  <a
                    href="https://github.com/yuanming-hu/taichi_mpm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github size={16} />
                    View original project
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </>
            )}
            {modal === "export" && (
              <>
                <div className="modal-eyebrow">
                  TAKE YOUR EXPERIMENT WITH YOU
                </div>
                <h2 id="modal-title">Export the moment.</h2>
                <p className="modal-intro">
                  Save a view, particle data, or the full internal solver state.
                </p>
                <div className="export-options">
                  <button
                    onClick={() => {
                      viewport.current?.screenshot();
                      setModal(null);
                      notify("Viewport saved as a PNG image.");
                    }}
                  >
                    <div>
                      <Maximize size={21} />
                    </div>
                    <span>
                      <strong>Viewport image</strong>
                      <small>A clean capture of the current view</small>
                    </span>
                    <span className="file-type">PNG</span>
                    <ArrowDownToLine size={17} />
                  </button>
                  <button onClick={exportScene}>
                    <div>
                      <FileCode2 size={21} />
                    </div>
                    <span>
                      <strong>Particle data & scene</strong>
                      <small>Positions, velocities, IDs, and settings</small>
                    </span>
                    <span className="file-type">JSON</span>
                    <ArrowDownToLine size={17} />
                  </button>
                  <button
                    disabled={exporting}
                    onClick={() => {
                      setExporting(true);
                      worker.current?.postMessage({ type: "export" });
                    }}
                  >
                    <div>
                      <Cpu size={21} />
                    </div>
                    <span>
                      <strong>
                        {exporting
                          ? "Saving solver state..."
                          : "Full solver snapshot"}
                      </strong>
                      <small>
                        Deformation, plasticity, rigid bodies, and grid config
                      </small>
                    </span>
                    <span className="file-type">TCB</span>
                    {exporting ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ArrowDownToLine size={17} />
                    )}
                  </button>
                </div>
                <p className="export-note">
                  TCB snapshots use this WASM build's 32-bit format and are not
                  interchangeable with native 64-bit snapshots. JSON is a
                  particle-data export, not a restart checkpoint.
                </p>
              </>
            )}
            {modal === "help" && (
              <>
                <div className="modal-eyebrow">
                  LESS CLICKING. MORE EXPLORING.
                </div>
                <h2 id="modal-title">A few handy shortcuts.</h2>
                <div className="shortcut-list">
                  {[
                    ["Play / pause", "Space"],
                    ["Restart simulation", "R"],
                    ["Advance one frame", "Right arrow"],
                    ["Toggle ground grid", "G"],
                    ["Open this guide", "?"],
                    ["Close a dialog", "Esc"],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
                <div className="gesture-guide">
                  <MousePointer2 size={21} />
                  <p>
                    <strong>Make yourself at home.</strong>Drag to orbit. Scroll
                    to zoom. Use the hand tool to pan, or the interaction tool
                    to push the material.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
