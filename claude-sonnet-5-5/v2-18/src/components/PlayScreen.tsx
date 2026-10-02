import { useEffect, useRef, useState } from "react";
import { palace } from "../game/palace";
import { audio } from "../lib/audio";
import { G, TUT_STEPS, accuse, applyAudioSettings, evidence, fmtTime, meta, notify, saveMeta, tickRun, tutEvent, tutSkip, useStore } from "../lib/store";
import { Board } from "./Board";
import { Interrogation } from "./Interrogation";
import { HelpContent, Modal, SettingsPanel } from "./Screens";
import { Bar, PillarRow } from "./ui";

type View = "palace" | "board" | "talk";

function AccuseModal({ initial, forced, onClose }: { initial: number | null; forced: boolean; onClose: () => void }) {
  const run = G.run!;
  const [pick, setPick] = useState<number | null>(initial);
  const cost = run.mode === "career" ? "A wrong accusation costs 1 Credibility." : "A wrong accusation costs score.";
  return (
    <Modal title="⚖️ Make your accusation" onClose={forced ? undefined : onClose} wide>
      <p className="text-sm text-violet-100/80 mb-3">
        {forced ? "Dawn has broken. You must name the culprit now. " : ""}
        Choose the suspect you can prove had <b>Means, Motive and Opportunity</b>. {cost}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {run.def.suspects.map((s) => {
          const out = run.wrongAccused.includes(s.id);
          return (
            <button key={s.id} disabled={out} onClick={() => setPick(s.id)}
              className={`suspect-tab text-left ${pick === s.id ? "on" : ""} ${out ? "opacity-35" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-3xl">{s.emoji}</span>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-violet-200/60">{s.job} · evidence {evidence(run, s.id)}/3</div>
                </div>
              </div>
              <div className="mt-1"><PillarRow run={run} s={s.id} /></div>
              {out && <div className="text-xs text-red-300 mt-1">Already cleared at trial</div>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        {!forced && <button className="btn btn-ghost" onClick={onClose}>Keep investigating</button>}
        <button disabled={pick === null} className="btn btn-danger btn-lg" onClick={() => { if (pick !== null) { accuse(pick); onClose(); } }}>
          {pick === null ? "Select a suspect" : `Accuse ${run.def.suspects[pick].name}`}
        </button>
      </div>
    </Modal>
  );
}

export function PlayScreen({ onFinish, onQuit, onRestart }: { onFinish: () => void; onQuit: () => void; onRestart: () => void }) {
  useStore();
  const run = G.run;
  const [view, setView] = useState<View>("palace");
  const [paused, setPaused] = useState(false);
  const [accuseFor, setAccuseFor] = useState<number | null | undefined>(undefined);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [, setTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const pausedRef = useRef(paused);
  viewRef.current = view;
  pausedRef.current = paused || help || settings;

  useEffect(() => {
    if (view === "board") tutEvent("board");
  }, [view]);

  // reset local UI when a new run starts
  useEffect(() => {
    setView("palace");
    setPaused(false);
    setAccuseFor(undefined);
    setHelp(false);
    setSettings(false);
  }, [run]);

  // main loop
  useEffect(() => {
    audio.init();
    audio.startMusic();
    applyAudioSettings();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const r = G.run;
      if (!r) return;
      const frozen = pausedRef.current || r.over || r.forced || !!r.verdict;
      if (!frozen) {
        tickRun(dt);
        if (viewRef.current === "palace") palace.update(dt);
      }
      if (viewRef.current === "palace") palace.render();
      const v = viewRef.current;
      audio.setMood(v === "palace" ? "palace" : v === "board" ? "board" : "talk", v === "palace" ? palace.threat() : Math.min(1, 0.1 + (100 - r.sanity) / 220));
    };
    raf = requestAnimationFrame(loop);
    const tk = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tk);
      palace.clearInput();
    };
  }, []);

  // canvas attach and resize
  useEffect(() => {
    const cv = canvasRef.current;
    const box = boxRef.current;
    if (!cv || !box) return;
    palace.attach(cv);
    const fit = () => palace.resize(box.clientWidth, box.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      palace.detach();
    };
  }, []);

  // keyboard + blur
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "Escape" || code === "KeyP") {
        e.preventDefault();
        if (e.repeat) return;
        if (settings) setSettings(false);
        else if (help) setHelp(false);
        else if (accuseFor !== undefined && !(G.run && G.run.forced)) setAccuseFor(undefined);
        else setPaused((p) => !p);
        return;
      }
      if (code === "KeyM") {
        meta.settings.muted = !meta.settings.muted;
        applyAudioSettings();
        saveMeta();
        notify();
        return;
      }
      const r = G.run;
      if (!r || r.over || pausedRef.current) return;
      if (accuseFor !== undefined) return;
      if (code === "Digit1") setView("palace");
      else if (code === "Digit2") { setView("board"); palace.clearInput(); }
      else if (code === "Digit3") { setView("talk"); palace.clearInput(); }
      else if (code === "KeyF") { if (!e.repeat) { setAccuseFor(null); palace.clearInput(); } }
      if (viewRef.current === "palace") {
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
        palace.keyDown(code, e.repeat);
      }
    };
    const up = (e: KeyboardEvent) => palace.keyUp(e.code);
    const blur = () => {
      palace.clearInput();
      if (G.run && !G.run.over) setPaused(true);
    };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [settings, help, accuseFor]);

  // clear wrong-accusation verdict
  useEffect(() => {
    if (run && run.verdict && !run.over) {
      const id = window.setTimeout(() => { if (G.run === run) { run.verdict = null; notify(); } }, 2300);
      return () => window.clearTimeout(id);
    }
  }, [run, run?.verdict]);

  if (!run) return null;
  const tut = run.mode === "tutorial";
  const shaking = performance.now() < G.uiShakeUntil;
  const showAccuse = (accuseFor !== undefined || run.forced) && !run.over && !run.verdict;
  const tutStep = tut && run.tut < TUT_STEPS.length ? TUT_STEPS[run.tut] : null;
  const press = (code: string) => { palace.edge.push(code); };

  return (
    <div className={`absolute inset-0 flex flex-col ${shaking ? "ui-shake" : ""}`}>
      {/* top bar */}
      <header className="shrink-0 bg-black/60 border-b border-white/10 px-2 py-1.5 flex items-center gap-2 flex-wrap z-30">
        <div className="hidden lg:block text-sm font-serif text-amber-100 max-w-[220px] truncate">{run.def.title}</div>
        <div className={`px-2 py-0.5 rounded-lg border text-sm font-bold tabular-nums ${!tut && run.dawn < 60 ? "border-red-400 text-red-300 animate-pulse" : "border-white/15 text-amber-200"}`}>
          {tut ? "🎓 Training" : `⏳ ${fmtTime(run.dawn)}`}
        </div>
        <Bar value={run.focus} max={run.maxFocus} color="linear-gradient(90deg,#0ea5e9,#38bdf8)" label="Focus" icon="⚡" />
        <Bar value={run.sanity} max={run.maxSanity} color={run.sanity < 35 ? "linear-gradient(90deg,#dc2626,#f87171)" : "linear-gradient(90deg,#7c3aed,#c084fc)"} label="Sanity" icon="💜" />
        <nav className="flex gap-1">
          {([["palace", "1 🏛️ Palace"], ["board", "2 🧩 Board"], ["talk", "3 🗣️ Talk"]] as [View, string][]).map(([v, l]) => (
            <button key={v} className={`btn !py-1 !px-2 !text-xs ${view === v ? "btn-gold" : "btn-ghost"}`} onClick={() => { setView(v); palace.clearInput(); audio.play("ui"); }}>{l}</button>
          ))}
        </nav>
        <div className="text-xs text-violet-200/70 hidden sm:block">🔎 {run.found.length} clues · ✅ {run.deds.length} deductions</div>
        {run.mode === "career" && meta.career && <div className="text-sm">{"❤️".repeat(meta.career.cred)}</div>}
        {run.hints > 0 && <div className="text-xs text-emerald-300">💡{run.hints}</div>}
        <button className="btn btn-danger !py-1 !px-2 !text-xs ml-auto" onClick={() => { setAccuseFor(null); palace.clearInput(); }}>⚖️ Accuse (F)</button>
        <button className="btn btn-ghost !py-1 !px-2 !text-xs" onClick={() => setPaused(true)}>⏸ Pause</button>
      </header>

      <main className="relative flex-1 min-h-0">
        <div ref={boxRef} className="absolute inset-0 bg-black">
          <canvas ref={canvasRef} className="block w-full h-full touch-none" style={{ width: "100%", height: "100%" }}
            onPointerDown={(e) => {
              audio.init();
              const rect = e.currentTarget.getBoundingClientRect();
              palace.pointer(e.clientX - rect.left, e.clientY - rect.top);
            }} />
          {view === "palace" && (
            <>
              <div className="absolute left-1.5 top-1.5 flex md:flex-col gap-1 max-w-[calc(100%-12px)] overflow-x-auto z-10">
                <button onClick={() => palace.travel(-1)} className={`room-chip ${run.room === -1 ? "on" : ""}`}>🏛️ Atrium</button>
                {run.def.rooms.map((r, i) => {
                  const left = r.objects.filter((o) => !run.searched[o.id]).length;
                  const cl = run.clarity[i];
                  return (
                    <button key={i} onClick={() => palace.travel(i)} className={`room-chip ${run.room === i ? "on" : ""}`} title="Fast travel (3 Focus)">
                      <span className="truncate text-left">{r.name}</span>
                      <span className="flex items-center gap-1 w-full">
                        <span className="h-1.5 flex-1 rounded-full bg-black/60 overflow-hidden"><span className="block h-full" style={{ width: `${cl}%`, background: `hsl(${cl * 1.2},75%,55%)` }} /></span>
                        <span className="text-[10px] opacity-70">{left}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                <button className="ability" onPointerDown={() => press("Space")}>👟<small>Dash [Space]</small></button>
                <button className="ability" onPointerDown={() => press("KeyQ")}>🔔<small>Pulse [Q] {Math.round(20 - (meta.up.pulse || 0) * 3)}⚡</small></button>
                <button className="ability" onPointerDown={() => press("KeyH")}>💡<small>Hint [H] x{run.hints}</small></button>
                <button className="ability" onPointerDown={() => { palace.touchE = true; }} onPointerUp={() => { palace.touchE = false; }} onPointerLeave={() => { palace.touchE = false; }} onPointerCancel={() => { palace.touchE = false; }}>🔍<small>Hold [E]</small></button>
              </div>
            </>
          )}
        </div>
        {view === "board" && <Board onAccuse={(s) => setAccuseFor(s)} />}
        {view === "talk" && <Interrogation />}

        {tutStep && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-[min(92%,640px)] rounded-xl border border-amber-300/60 bg-[#1a1233]/95 p-3 shadow-xl fade-in">
            <div className="flex gap-2 items-start">
              <div className="text-xl">🎓</div>
              <div className="flex-1 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-amber-300">Tutorial {run.tut + 1}/{TUT_STEPS.length}</div>
                {tutStep.text}
              </div>
              <button className="btn btn-ghost !py-0.5 !text-xs" onClick={tutSkip}>Skip ▸</button>
            </div>
          </div>
        )}

        <div className="absolute right-2 bottom-14 z-30 flex flex-col gap-1.5 items-end pointer-events-none">
          {G.toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
          ))}
        </div>

        {/* verdict overlays */}
        {run.verdict && !run.over && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 fade-in">
            <div className="text-center verdict">
              <div className="text-6xl">⚖️</div>
              <div className="text-4xl font-serif text-red-300">{run.verdict.name} is INNOCENT!</div>
              <div className="text-violet-200 mt-2">Your credibility suffers. Keep investigating.</div>
            </div>
          </div>
        )}
        {run.over && run.result && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 fade-in">
            <div className="text-center verdict px-4">
              <div className="text-7xl">{run.result.solved ? "🔎" : run.result.reason === "breakdown" ? "🌀" : "🌅"}</div>
              <div className={`text-4xl md:text-5xl font-serif ${run.result.solved ? "text-emerald-300" : "text-red-300"}`}>
                {run.result.solved ? "CASE SOLVED!" : run.result.reason === "breakdown" ? "MENTAL BREAKDOWN" : run.result.reason === "fired" ? "CREDIBILITY LOST" : "DAWN HAS BROKEN"}
              </div>
              <div className="text-violet-100 mt-2">{run.result.solved ? `${run.result.culprit} is the culprit, with ${run.result.evidence}/3 pillars proven.` : `The culprit was ${run.result.culprit}.`}</div>
              <button className="btn btn-gold btn-lg mt-5" onClick={onFinish}>View Case Report →</button>
            </div>
          </div>
        )}

        {showAccuse && <AccuseModal initial={accuseFor === undefined ? null : accuseFor} forced={run.forced} onClose={() => setAccuseFor(undefined)} />}

        {paused && !help && !settings && !run.over && (
          <Modal title="⏸ Paused">
            <div className="grid gap-2">
              <button className="btn btn-gold btn-lg" onClick={() => setPaused(false)}>▶ Resume</button>
              <button className="btn btn-ghost" onClick={() => setHelp(true)}>📖 How to Play and Controls</button>
              <button className="btn btn-ghost" onClick={() => setSettings(true)}>⚙️ Settings (volume, difficulty)</button>
              <button className="btn btn-ghost" onClick={() => { setPaused(false); onRestart(); }}>↻ Restart Case</button>
              <button className="btn btn-danger" onClick={onQuit}>⌂ Quit to Title</button>
            </div>
          </Modal>
        )}
        {help && <Modal title="📖 How to Play" wide onClose={() => setHelp(false)}><HelpContent /></Modal>}
        {settings && <SettingsPanel onClose={() => setSettings(false)} />}
      </main>
    </div>
  );
}
