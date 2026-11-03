import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Code2,
  Maximize2,
  MousePointer2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Settings2,
} from "lucide-react";
import * as MPM from "../library/src/mpm.js";
import { CodeBlock } from "./components.jsx";

const MATERIALS = [
  ["sand", "Sand", "#d7a05d"],
  ["water", "Water", "#82b6ca"],
  ["jelly", "Jelly", "#ad97d3"],
  ["snow", "Snow", "#cad0c2"],
];

export default function Playground({
  expanded = false,
  initialMaterial = "sand",
  initialWheel = false,
  initialScene = null,
}) {
  const canvas = useRef(null);
  const container = useRef(null);
  const instance = useRef(null);
  const wheel = useRef(null);
  const materialRef = useRef(initialMaterial);
  const [material, setMaterial] = useState(initialScene ? "" : initialMaterial);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ particles: 0, fps: 0, time: 0 });
  const [error, setError] = useState(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(expanded);
  const [wheelAdded, setWheelAdded] = useState(false);
  const [wheelRunning, setWheelRunning] = useState(false);
  const [gravity, setGravity] = useState(initialScene ? 10 : 2.4);
  const [speed, setSpeed] = useState(90);
  const [pointer, setPointer] = useState(true);
  const [extraScene, setExtraScene] = useState(initialScene ?? "");

  useEffect(() => {
    let cancelled = false;
    MPM.create({
      canvas: canvas.current,
      scene: initialScene ?? MPM.demoScene(initialMaterial, 144),
      budget: 5.5,
      interactions: initialScene ? false : { material: initialMaterial },
    })
      .then((sim) => {
        if (cancelled) {
          sim.destroy();
          return;
        }
        instance.current = sim;
        window.mpmDemo = sim;
        window.MPM = MPM;
        sim.on("stats", setStats);
        sim.on("statechange", ({ running: active }) => setRunning(active));
        sim.on("error", (failure) => setError(failure.message));
        setStats(sim.stats);
        setReady(true);
        if (initialScene && sim.scene.dim === 2)
          sim.enableInteractions({ material: "sand" });
        if (initialWheel) {
          wheel.current = sim.addWheel({
            center: [0.52, 0.22],
            radius: 0.115,
            speed: 90,
          });
          setWheelAdded(true);
          setWheelRunning(true);
        }
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
      instance.current?.destroy();
      if (window.mpmDemo === instance.current) delete window.mpmDemo;
      instance.current = null;
    };
  }, []);

  const switchMaterial = (id) => {
    if (!instance.current) return;
    try {
      materialRef.current = id;
      setMaterial(id);
      setExtraScene("");
      setError(null);
      instance.current.loadScene(MPM.demoScene(id, 144));
      if (pointer) instance.current.enableInteractions({ material: id });
      wheel.current = null;
      setWheelAdded(false);
      setWheelRunning(false);
      setGravity(2.4);
      setStats(instance.current.stats);
    } catch (failure) {
      setError(failure.message);
    }
  };

  const reset = () => {
    try {
      const sim = instance.current;
      sim.reset();
      if (pointer && sim.scene.dim === 2)
        sim.enableInteractions({ material: materialRef.current });
      wheel.current = null;
      setWheelAdded(false);
      setWheelRunning(false);
      setGravity(extraScene ? 10 : 2.4);
      setError(null);
      setStats(sim.stats);
    } catch (failure) {
      setError(failure.message);
    }
  };

  const addWheel = () => {
    try {
      const sim = instance.current;
      if (!wheel.current) {
        wheel.current = sim.addWheel({
          center: [0.52, extraScene ? 0.35 : 0.22],
          radius: 0.115,
          speed,
        });
        setWheelAdded(true);
        setWheelRunning(true);
      } else {
        if (wheelRunning) wheel.current.stop();
        else wheel.current.start(speed);
        setWheelRunning(!wheelRunning);
      }
    } catch (failure) {
      setError(failure.message);
    }
  };

  const togglePointer = () => {
    if (pointer) instance.current.disableInteractions();
    else instance.current.enableInteractions({ material: materialRef.current });
    setPointer(!pointer);
  };

  const selectOriginal = (id) => {
    if (!id || !instance.current) return;
    try {
      instance.current.loadScene(id);
      setExtraScene(id);
      setMaterial("");
      setGravity(10);
      setError(null);
      setWheelAdded(false);
      setWheelRunning(false);
      wheel.current = null;
      materialRef.current = "sand";
      if (pointer && instance.current.scene.dim === 2)
        instance.current.enableInteractions({ material: "sand" });
      setStats(instance.current.stats);
    } catch (failure) {
      setError(failure.message);
    }
  };

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current.requestFullscreen();
    } catch {
      setError(
        "Fullscreen is not available in this browser. The simulation still works here.",
      );
    }
  };

  const is3d = instance.current?.scene.dim === 3;
  const code = `const sim = await MPM.create({
  canvas: '#world',
  scene: ${extraScene ? `'${extraScene}'` : `MPM.demoScene('${material || "sand"}')`},
  interactions: ${is3d ? "false" : `{ material: '${material || "sand"}' }`}
});${wheelAdded ? `\n\nsim.addWheel({ center: [0.52, 0.22], speed: ${wheelRunning ? speed : 0} });` : ""}`;

  return (
    <section
      className={`playground-section ${expanded ? "playground-expanded" : ""}`}
      id="live-playground"
    >
      <div className="playground-heading">
        <h2>
          {expanded
            ? "Your world, in real time."
            : "A little room to experiment."}
        </h2>
        <div className="live-label">
          <span />
          {ready ? "LIVE PLAYGROUND" : "WARMING UP"}
        </div>
      </div>
      <div className="playground" ref={container}>
        <div className="scene-toolbar">
          <div className="scene-tabs" role="tablist" aria-label="Material">
            {MATERIALS.map(([id, label, color]) => (
              <button
                key={id}
                role="tab"
                aria-selected={material === id}
                disabled={!ready}
                onClick={() => switchMaterial(id)}
                className={material === id ? "active" : ""}
              >
                <span style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
          <div className="scene-toolbar-right">
            {expanded && (
              <div className="original-select">
                <select
                  value={extraScene}
                  onChange={(event) => selectOriginal(event.target.value)}
                  aria-label="Original scene"
                  disabled={!ready}
                >
                  <option value="">Original scenes</option>
                  {MPM.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name} ({scene.dim}D)
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
            )}
            <button
              className={`view-code-button ${codeOpen ? "active" : ""}`}
              onClick={() => setCodeOpen(!codeOpen)}
              aria-expanded={codeOpen}
            >
              <Code2 size={15} />
              <span>View code</span>
            </button>
          </div>
        </div>
        <div className="canvas-wrap">
          <canvas
            ref={canvas}
            aria-label={`${material || extraScene} material physics simulation. Click and drag to pour particles.`}
          />
          {(!ready || error) && (
            <div
              className={`simulation-message ${error ? "simulation-error" : ""}`}
            >
              {error ? (
                <>
                  <strong>Let's try that again.</strong>
                  <span>{error}</span>
                  <button onClick={reset}>
                    <RotateCcw size={14} />
                    Reset simulation
                  </button>
                </>
              ) : (
                <>
                  <div className="engine-loader" />
                  <span>Putting a little world together...</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="simulation-toolbar">
          <div className="playback-controls">
            <button
              className="play-button"
              disabled={!ready}
              onClick={() =>
                running ? instance.current.pause() : instance.current.play()
              }
              aria-label={running ? "Pause simulation" : "Play simulation"}
            >
              {running ? (
                <Pause size={14} fill="currentColor" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              <span>{running ? "Pause" : "Play"}</span>
            </button>
            <button
              className="icon-button reset-button"
              disabled={!ready}
              onClick={reset}
              aria-label="Reset simulation"
              title="Reset simulation"
            >
              <RotateCcw size={16} />
            </button>
            <span className="toolbar-divider" />
            <button
              className={`pointer-button ${pointer ? "enabled" : ""}`}
              disabled={!ready || is3d}
              onClick={togglePointer}
              aria-pressed={pointer}
            >
              <MousePointer2 size={14} />
              <span>Interact</span>
              {pointer && <span className="interaction-dot" />}
            </button>
          </div>
          <div className="simulation-tools">
            <button
              className={`wheel-button ${wheelAdded ? "wheel-added" : ""}`}
              disabled={!ready || is3d}
              onClick={addWheel}
            >
              <Orbit
                size={16}
                className={wheelRunning && running ? "wheel-spinning" : ""}
              />
              <span>
                {!wheelAdded
                  ? "Add a wheel"
                  : wheelRunning
                    ? "Stop wheel"
                    : "Start wheel"}
              </span>
              <span className="plus-sign" aria-hidden="true">
                {!wheelAdded ? "+" : ""}
              </span>
            </button>
            <span className="toolbar-divider" />
            <button
              className={`icon-button ${controlsOpen ? "tool-active" : ""}`}
              onClick={() => setControlsOpen(!controlsOpen)}
              aria-label="Simulation settings"
              aria-expanded={controlsOpen}
            >
              <Settings2 size={17} />
            </button>
            <button
              className="icon-button fullscreen-button"
              onClick={fullscreen}
              aria-label="Fullscreen simulation"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {controlsOpen && (
            <motion.div
              className="advanced-controls"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <label>
                <span>
                  Gravity<output>{gravity.toFixed(1)}</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={gravity}
                  disabled={!ready}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setGravity(value);
                    instance.current.setGravity(
                      is3d ? [0, -value, 0] : [0, -value],
                    );
                  }}
                />
                <small>A gentler pull. Or a little more chaos.</small>
              </label>
              <label>
                <span>
                  Wheel speed<output>{speed} deg/s</output>
                </span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={speed}
                  disabled={!ready}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setSpeed(value);
                    if (wheel.current && wheelRunning)
                      wheel.current.setSpeed(value);
                  }}
                />
                <small>
                  {wheelAdded
                    ? "Changes apply to your wheel, live."
                    : "Add a wheel to see it in motion."}
                </small>
              </label>
              <button
                className="step-button"
                disabled={!ready}
                onClick={async () => {
                  try {
                    await instance.current.step();
                    setRunning(false);
                  } catch (failure) {
                    setError(failure.message);
                  }
                }}
              >
                <Play size={14} />
                Step one frame
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {codeOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="playground-code"
            >
              <CodeBlock code={code} filename="your-playground.js" compact />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="playground-caption">
        <span>
          <MousePointer2 size={12} />
          {is3d
            ? "Drag to orbit. Scroll to find a new perspective."
            : pointer
              ? "Click and drag to pour a little possibility."
              : "Interactions paused. Turn on Interact to pour."}
        </span>
        <span className="playground-stats">
          <span>{stats.particles.toLocaleString()} particles</span>
          <span className="caption-separator" />
          <span>{stats.fps || "--"} fps</span>
          <span className="caption-separator" />
          <span>
            <span className="engine-status-dot" />
            {ready ? "WASM" : "Initializing"}
          </span>
        </span>
      </div>
    </section>
  );
}
