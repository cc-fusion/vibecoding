import { useEffect, useRef, useState } from "react";
import { COMPS, DIFFS, type ModId, type ShiftDef } from "../game/data";
import { audio } from "../game/audio";
import { CH, CW, PH, PW, Renderer, drawChart } from "../game/render";
import { Sim, clamp, type ShiftResult } from "../game/sim";
import type { Settings } from "../game/storage";
import { Bar, Btn, Modal, Panel, Slider, Toggle, cx } from "./ui";
import { HelpPanel, SettingsPanel } from "./Screens";
import { TUTORIAL } from "./tutorial";

interface Props {
  shift: ShiftDef;
  mods: ModId[];
  upgrades: Record<string, number>;
  settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  onFinish: (r: ShiftResult) => void;
  onQuit: () => void;
  onRestart: () => void;
}

type Menu = "ready" | "none" | "pause" | "settings" | "help";


const fmtClock = (h: number) => {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const OUTCOME_TEXT: Record<string, [string, string]> = {
  complete: ["SHIFT COMPLETE", "#7dff9b"],
  tutorial: ["TRAINING COMPLETE", "#7dff9b"],
  meltdown: ["CORE MELTDOWN", "#ff4040"],
  breach: ["CONTAINMENT BREACH", "#ff4040"],
  rupture: ["VESSEL RUPTURE", "#ff4040"],
  license: ["LICENSE REVOKED", "#ffb040"],
  abort: ["SHIFT ABORTED", "#aaa"],
};

export default function GameScreen(props: Props) {
  const settingsRef = useRef(props.settings);
  settingsRef.current = props.settings;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [sim] = useState(() => new Sim({ shift: props.shift, getDiff: () => settingsRef.current.diff, mods: props.mods, upgrades: props.upgrades }));
  const [renderer] = useState(() => new Renderer());
  const plantRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [menu, setMenuState] = useState<Menu>("ready");
  const menuRef = useRef<Menu>("ready");
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(1);
  const [tab, setTab] = useState<"sys" | "safe" | "maint">("sys");
  const [banner, setBanner] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tutIdx, setTutIdx] = useState(0);
  const tut = useRef({ idx: 0, inited: false, mem: {} as Record<string, number> });
  const endTimer = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const [endShown, setEndShown] = useState(false);

  const setMenu = (m: Menu) => { menuRef.current = m; setMenuState(m); };
  const setSpeed = (s: number) => { speedRef.current = s; setSpeedState(s); };
  const resume = () => setMenu("none");

  useEffect(() => {
    audio.init();
    audio.setVolumes({ master: settingsRef.current.master, music: settingsRef.current.music, sfx: settingsRef.current.sfx, muted: settingsRef.current.muted });
    audio.startAmbient();
    audio.startMusic();
    sim.events.length = 0;
    renderer.reset();
    const keys = new Set<string>();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pc = plantRef.current, cc = chartRef.current;
    if (pc) { pc.width = PW * dpr; pc.height = PH * dpr; }
    if (cc) { cc.width = CW * dpr; cc.height = CH * dpr; }
    const pctx = pc?.getContext("2d") ?? null;
    const cctx = cc?.getContext("2d") ?? null;

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.current = timers.current.filter((x) => x !== id); fn(); }, ms);
      timers.current.push(id);
    };

    const handleEvents = () => {
      const evs = sim.events.splice(0, sim.events.length);
      for (const ev of evs) {
        switch (ev.kind) {
          case "float": renderer.addFloat(ev.msg || "", ev.anchor || "reactor", ev.color || "#fff"); break;
          case "banner": setBanner(ev.msg || ""); later(() => setBanner(null), 3200); audio.handleSimEvent("banner"); break;
          case "advisory": setToast(ev.msg || ""); later(() => setToast(null), 5000); audio.handleSimEvent("advisory"); break;
          case "fail": renderer.burst(140, 330, 16, "#ff9a50"); audio.handleSimEvent("fail"); break;
          case "scram": renderer.burst(140, 300, 24, "#ff5050", 160); audio.handleSimEvent("scram"); break;
          case "hit": renderer.burst(130, 390, 14, "#ff4020"); audio.handleSimEvent("hit"); break;
          case "boom": renderer.burst(130, 380, 120, "#ff7040", 360); audio.handleSimEvent("boom"); break;
          default: audio.handleSimEvent(ev.kind, ev.mag);
        }
      }
    };

    const toggleMenu = () => {
      if (sim.over) return;
      if (menuRef.current === "none") setMenu("pause");
      else if (menuRef.current === "pause") setMenu("none");
      else if (menuRef.current === "settings" || menuRef.current === "help") setMenu("pause");
    };

    const advanceTut = () => {
      const t = tut.current;
      t.idx++; t.inited = false; t.mem = {};
      audio.play("good");
      setTutIdx(t.idx);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "SELECT" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range"))) return;
      audio.init();
      if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); toggleMenu(); return; }
      if (e.code === "KeyM") { propsRef.current.onSettings({ muted: !settingsRef.current.muted }); return; }
      if (menuRef.current !== "none") return;
      const onRange = el && el.tagName === "INPUT";
      switch (e.code) {
        case "Space": e.preventDefault(); sim.scram(true); break;
        case "KeyR": sim.resetTrip(); break;
        case "KeyT": sim.setRodAuto(!sim.rodAuto); break;
        case "KeyA": sim.ackAll(); break;
        case "Digit1": setSpeed(1); break;
        case "Digit2": setSpeed(2); break;
        case "Digit3": setSpeed(4); break;
        case "KeyW": case "ArrowUp":
          if (e.code === "ArrowUp" && onRange) break;
          e.preventDefault(); keys.add("up"); if (!e.repeat) sim.nudgeRods(e.shiftKey ? -0.03 : -0.01); break;
        case "KeyS": case "ArrowDown":
          if (e.code === "ArrowDown" && onRange) break;
          e.preventDefault(); keys.add("down"); if (!e.repeat) sim.nudgeRods(e.shiftKey ? 0.03 : 0.01); break;
        default: break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") keys.delete("up");
      if (e.code === "KeyS" || e.code === "ArrowDown") keys.delete("down");
    };
    const onVis = () => { if (document.hidden && menuRef.current === "none" && !sim.over) setMenu("pause"); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onVis);
    document.addEventListener("visibilitychange", onVis);

    let raf = 0;
    let last = performance.now();
    let acc = 0, uiT = 0, tickT = 0, tension = 0;
    const padPrev: Record<number, boolean> = {};

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const running = menuRef.current === "none" && !sim.over;
      if (running) {
        acc += dt * speedRef.current;
        let n = 0;
        while (acc >= 0.1 && n < 48) { sim.step(0.1); acc -= 0.1; n++; }
        if (n >= 48) acc = 0;
        if (keys.has("up")) sim.nudgeRods(-(0.04 * dt));
        if (keys.has("down")) sim.nudgeRods(0.04 * dt);
        // gamepad
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && pads[0];
        if (gp) {
          const ay = gp.axes[1] || 0;
          if (Math.abs(ay) > 0.25) sim.nudgeRods(ay * 0.05 * dt);
          const edge = (i: number, fn: () => void) => { const p = !!gp.buttons[i]?.pressed; if (p && !padPrev[i]) fn(); padPrev[i] = p; };
          edge(0, () => sim.setRodAuto(!sim.rodAuto));
          edge(2, () => sim.ackAll());
          edge(3, () => sim.scram(true));
          edge(4, () => setSpeed(Math.max(1, speedRef.current / 2)));
          edge(5, () => setSpeed(Math.min(4, speedRef.current * 2)));
        }
        // tutorial
        if (sim.tutorial) {
          const t = tut.current;
          const step = TUTORIAL[t.idx];
          if (step) {
            if (!t.inited) { t.inited = true; step.init?.(sim, t.mem); }
            else if (step.check && step.check(sim, t.mem)) advanceTut();
          }
        }
        // rod tick
        tickT -= dt;
        if (tickT <= 0 && sim.rods.some((r) => !r.stuck && Math.abs(sim.scrammed ? 1 - r.pos : r.tgt - r.pos) > 0.003)) { tickT = 0.28; audio.play("tick"); }
      }
      handleEvents();
      if (menuRef.current !== "ready") renderer.update(menuRef.current === "none" ? dt : 0, sim);
      if (pctx) { pctx.setTransform(dpr, 0, 0, dpr, 0, 0); renderer.draw(pctx, sim, settingsRef.current.shake); }
      if (cctx) { cctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawChart(cctx, sim); }
      const wrap = wrapRef.current;
      if (wrap) {
        if (settingsRef.current.shake && sim.shake > 0.03 && menuRef.current === "none") {
          const s = sim.shake * 6;
          wrap.style.transform = `translate(${((Math.random() - 0.5) * s).toFixed(1)}px,${((Math.random() - 0.5) * s).toFixed(1)}px)`;
        } else if (wrap.style.transform) wrap.style.transform = "";
      }
      // audio reactivity
      let tn = 0;
      for (const a of sim.alarms) if (a.active) tn += a.level === 2 ? 0.14 : 0.04;
      tn += clamp((sim.Tf - 900) / 400, 0, 0.4) + sim.Pc / 8 + (1 - sim.fuel) * 2 + (sim.scrammed ? 0.15 : 0);
      tension += (clamp(tn, 0, 1) - tension) * Math.min(1, dt * 0.8);
      audio.setTension(tension);
      audio.updateAmbient(sim.P, sim.MWe, sim.flow);

      uiT += dt;
      if (uiT > 0.1) { uiT = 0; setTick((x) => (x + 1) % 1000000); }

      if (sim.over && endTimer.current === null) {
        const oc = sim.outcome;
        setEndShown(true);
        setSpeed(1);
        if (oc === "complete" || oc === "tutorial") audio.play("win"); else if (oc === "license") audio.play("lose"); else audio.play("lose");
        endTimer.current = window.setTimeout(() => propsRef.current.onFinish(sim.result()), oc === "tutorial" ? 600 : 3000);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onVis);
      document.removeEventListener("visibilitychange", onVis);
      if (endTimer.current !== null) { clearTimeout(endTimer.current); endTimer.current = null; }
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
      audio.silence();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diff = DIFFS[props.settings.diff];
  const gridPct = sim.gridPct();
  const quota = sim.quotaTarget();
  const crit = sim.alarms.some((a) => a.active && a.level === 2);
  const oc = OUTCOME_TEXT[sim.outcome] || OUTCOME_TEXT.abort;
  const step = sim.tutorial ? TUTORIAL[tutIdx] : null;
  const progress = sim.shift.endless ? 0 : clamp(sim.t / sim.shift.duration, 0, 1);

  return (
    <div className="h-full w-full bg-[#050c12] text-slate-200 flex flex-col overflow-hidden">
      <div ref={wrapRef} className="flex-1 min-h-0 flex flex-col">
        {/* TOP BAR */}
        <div className={cx("flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 border-b border-cyan-900/70 bg-[#07111a]", crit && "border-red-600/70")}>
          <div>
            <div className="text-[10px] text-cyan-400 uppercase tracking-[0.2em]">{sim.shift.name}{sim.tutorial ? " · training" : ""}</div>
            <div className="font-mono text-xl leading-5 text-white">{fmtClock(sim.hour)}{sim.shift.endless && <span className="text-xs text-cyan-300 ml-2">{(sim.t / 30).toFixed(1)} h survived</span>}</div>
          </div>
          {!sim.shift.endless && (
            <div className="flex-1 min-w-[90px] max-w-[260px]">
              <div className="h-1.5 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${progress * 100}%` }} /></div>
              <div className="text-[10px] text-slate-400 mt-0.5">{Math.max(0, Math.ceil(sim.shift.duration - sim.t))} s to handover</div>
            </div>
          )}
          <Stat label="Demand" value={sim.offsite ? `${sim.demand.toFixed(0)} MW` : "ISLANDED"} color="text-amber-200" />
          <Stat label="Output" value={`${sim.disp.MWe.toFixed(0)} MW`} color={Math.abs(sim.MWe - sim.demand) < 0.06 * Math.max(100, sim.demand) + 10 ? "text-emerald-300" : "text-red-300"} />
          <Stat label="Freq" value={sim.offsite ? `${sim.freq.toFixed(2)} Hz` : "—"} color={Math.abs(sim.freq - 50) > 0.8 ? "text-red-300" : "text-cyan-200"} />
          <Stat label="Cash" value={`${sim.revenue >= 0 ? "$" : "-$"}${Math.abs(sim.revenue).toFixed(0)}k`} color={sim.revenue >= 0 ? "text-emerald-300" : "text-red-300"} />
          {!sim.tutorial && !sim.shift.boss && <Stat label={`Grid (need ${(quota * 100).toFixed(0)}%)`} value={`${(gridPct * 100).toFixed(0)}%`} color={gridPct >= quota ? "text-emerald-300" : "text-amber-300"} />}
          {!sim.tutorial && (
            <div className="w-28">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Compliance</div>
              <div className="h-2 bg-slate-800 rounded overflow-hidden"><div className={cx("h-full", sim.compliance > 60 ? "bg-emerald-400" : sim.compliance > 30 ? "bg-amber-400" : "bg-red-500")} style={{ width: `${sim.compliance}%` }} /></div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-slate-500 mr-1 hidden md:inline">{diff.name}</span>
            {[1, 2, 4].map((s) => <Btn key={s} small active={speed === s} onClick={() => setSpeed(s)} title={`Speed ${s}x`}>{s}x</Btn>)}
            <Btn small tone={props.settings.muted ? "red" : "slate"} onClick={() => props.onSettings({ muted: !props.settings.muted })} title="Mute (M)">{props.settings.muted ? "🔇" : "🔊"}</Btn>
            <Btn small tone="amber" onClick={() => setMenu("pause")} title="Pause (P / Esc)">⏸ Menu</Btn>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid gap-2 p-2 lg:grid-cols-[270px_minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-2 lg:overflow-y-auto lg:pr-1 order-2 lg:order-1">
            <ReactorPanel sim={sim} />
            <AlarmPanel sim={sim} />
          </div>

          <div className="flex flex-col gap-2 min-w-0 lg:overflow-y-auto order-1 lg:order-2">
            {step && (
              <div className="rounded-lg border border-amber-400/70 bg-amber-950/40 p-3 shadow-[0_0_18px_rgba(251,191,36,0.2)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-amber-200 font-bold text-sm">🎓 {step.title}</div>
                  <div className="text-[10px] text-amber-300/70">step {Math.min(tutIdx + 1, TUTORIAL.length)} / {TUTORIAL.length}</div>
                </div>
                <p className="text-sm text-amber-50/90 mt-1 leading-snug">{step.text}</p>
                <div className="flex gap-2 mt-2">
                  {tutIdx >= TUTORIAL.length - 1 ? (
                    <Btn tone="green" small onClick={() => sim.finish("tutorial")}>Finish training ✔</Btn>
                  ) : step.check === null ? (
                    <Btn tone="amber" small onClick={() => { const t = tut.current; t.idx++; t.inited = false; t.mem = {}; setTutIdx(t.idx); }}>Next ▶</Btn>
                  ) : (
                    <Btn tone="slate" small onClick={() => { const t = tut.current; t.idx++; t.inited = false; t.mem = {}; setTutIdx(t.idx); }}>Skip step</Btn>
                  )}
                </div>
              </div>
            )}
            <div className="relative rounded-lg border border-cyan-900/70 overflow-hidden bg-black">
              <canvas ref={plantRef} className="w-full block" style={{ aspectRatio: `${PW}/${PH}` }} />
              {toast && <div className="absolute top-2 left-1/2 -translate-x-1/2 max-w-[90%] bg-amber-950/90 border border-amber-400 text-amber-100 text-xs px-3 py-1.5 rounded shadow-lg">⚠ {toast}</div>}
              {banner && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-3xl md:text-5xl font-black tracking-[0.2em] text-red-300 drop-shadow-[0_0_20px_rgba(255,60,40,0.9)] animate-pulse text-center">{banner}</div></div>}
              {sim.scrammed && !sim.over && <div className="absolute bottom-2 left-2 text-xs font-bold text-red-300 bg-red-950/80 border border-red-500 px-2 py-1 rounded animate-pulse">REACTOR TRIPPED — {sim.tripReason}</div>}
              {!sim.offsite && !sim.over && <div className="absolute top-2 right-2 text-xs font-bold text-red-200 bg-red-950/80 border border-red-500 px-2 py-1 rounded">STATION BLACKOUT {sim.diesel === "running" ? "· DIESEL SUPPLYING" : ""}</div>}
            </div>
            <div className="rounded-lg border border-cyan-900/70 overflow-hidden">
              <canvas ref={chartRef} className="w-full block" style={{ aspectRatio: `${CW}/${CH}` }} />
              <div className="flex flex-wrap gap-x-3 px-2 py-1 text-[10px] bg-[#08121a] text-slate-400">
                <span className="text-yellow-200">┅ demand/forecast MW</span><span className="text-emerald-300">━ output MW</span>
                <span className="text-cyan-300">━ power %</span><span className="text-orange-300">━ Tavg</span>
                <span className="text-fuchsia-400">━ RCS bar</span><span className="text-purple-300">━ xenon</span>
              </div>
            </div>
            <LogPanel sim={sim} />
          </div>

          <div className="flex flex-col gap-2 lg:overflow-y-auto lg:pl-1 order-3">
            <div className="grid grid-cols-3 gap-1">
              <Btn small active={tab === "sys"} onClick={() => setTab("sys")}>SYSTEMS</Btn>
              <Btn small active={tab === "safe"} tone={sim.leaks.some((l) => !l.isolated) || !sim.offsite ? "red" : "cyan"} onClick={() => setTab("safe")}>SAFETY</Btn>
              <Btn small active={tab === "maint"} onClick={() => setTab("maint")}>MAINT</Btn>
            </div>
            {tab === "sys" && <SystemsPanel sim={sim} />}
            {tab === "safe" && <SafetyPanel sim={sim} />}
            {tab === "maint" && <MaintPanel sim={sim} />}
          </div>
        </div>
      </div>

      {/* OVERLAYS */}
      {menu === "ready" && (
        <Modal>
          <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-400">Shift briefing</div>
          <h2 className="text-2xl font-black text-white mt-1">{sim.shift.name} <span className="text-cyan-300 text-base font-semibold">— {sim.shift.subtitle}</span></h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{sim.shift.brief}</p>
          <ul className="mt-3 text-sm text-amber-100/90 list-disc pl-5 space-y-1">{sim.shift.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          <div className="mt-3 text-xs text-slate-400">Difficulty: <b className="text-cyan-200">{diff.name}</b>{props.mods.length > 0 && <> · Modifiers: <b className="text-amber-200">{props.mods.join(", ")}</b></>}</div>
          <div className="mt-4 flex gap-2">
            <Btn tone="green" className="flex-1 py-3 text-base" onClick={() => { audio.init(); resume(); }}>▶ TAKE THE CONN</Btn>
            <Btn tone="slate" onClick={() => setMenu("help")}>How to play</Btn>
            <Btn tone="slate" onClick={props.onQuit}>Back</Btn>
          </div>
        </Modal>
      )}
      {menu === "pause" && (
        <Modal>
          <h2 className="text-2xl font-black text-white tracking-wider">PAUSED</h2>
          <div className="text-xs text-slate-400 mb-3">{sim.shift.name} · {fmtClock(sim.hour)}</div>
          <div className="grid gap-2">
            <Btn tone="green" onClick={resume}>▶ Resume</Btn>
            <Btn onClick={() => setMenu("settings")}>⚙ Settings & difficulty</Btn>
            <Btn onClick={() => setMenu("help")}>❓ Help & controls</Btn>
            <Btn tone="amber" onClick={props.onRestart}>↻ Restart shift</Btn>
            <Btn tone="red" onClick={props.onQuit}>⏏ Abandon shift (return to menu)</Btn>
          </div>
        </Modal>
      )}
      {menu === "settings" && (
        <Modal>
          <h2 className="text-xl font-black text-white mb-3">Settings</h2>
          <SettingsPanel settings={props.settings} onChange={props.onSettings} liveDiff />
          <Btn className="mt-4 w-full" onClick={() => setMenu("pause")}>← Back</Btn>
        </Modal>
      )}
      {menu === "help" && (
        <Modal wide>
          <HelpPanel />
          <Btn className="mt-4 w-full" onClick={() => setMenu(sim.t > 0.5 ? "pause" : "ready")}>← Back</Btn>
        </Modal>
      )}
      {endShown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 pointer-events-none">
          <div className="text-center">
            <div className="text-4xl md:text-6xl font-black tracking-[0.15em] animate-pulse" style={{ color: oc[1], textShadow: `0 0 30px ${oc[1]}` }}>{oc[0]}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat(p: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{p.label}</div>
      <div className={cx("font-mono text-base leading-5", p.color)}>{p.value}</div>
    </div>
  );
}

function trend(sim: Sim, key: "P" | "Tc" | "Pp") {
  const h = sim.history;
  if (h.length < 7) return "";
  const a = h[h.length - 1][key] - h[h.length - 7][key];
  const th = key === "P" ? 0.01 : key === "Tc" ? 1 : 1.5;
  return a > th ? " ▲" : a < -th ? " ▼" : " ▬";
}

function ReactorPanel({ sim }: { sim: Sim }) {
  const avg = sim.rods.reduce((a, r) => a + r.tgt, 0) / 4;
  const avgPos = sim.rods.reduce((a, r) => a + r.pos, 0) / 4;
  const diag = sim.up.diag || 0;
  const d = sim.disp;
  const setRods = (v: number) => { if (sim.rodAuto) sim.setRodAuto(false); sim.setAllRods(v); };
  const tilt = sim.tilt();
  return (
    <Panel title="Reactor" right={<span className={cx("text-[10px] font-bold", sim.scrammed ? "text-red-400 animate-pulse" : "text-emerald-300")}>{sim.scrammed ? "TRIPPED" : "CRITICAL"}</span>}>
      <Btn tone="red" className="w-full text-lg py-2.5 font-black tracking-[0.3em]" onClick={() => sim.scram(true)} title="Space">⚠ SCRAM</Btn>
      {sim.scrammed && <Btn tone="amber" className="w-full mt-1.5" onClick={() => sim.resetTrip()} title="R">RESET TRIP · {sim.tripReason}</Btn>}
      <div className="flex gap-1 mt-2">
        <Toggle on={sim.rodAuto} onClick={() => sim.setRodAuto(!sim.rodAuto)} tone="green" className="flex-1" title="Hold Tavg on the load program (T)">🤖 AUTOPILOT {sim.rodAuto ? "ON" : "OFF"}</Toggle>
      </div>
      <div className="mt-2">
        <Slider label="Master rods (insertion)" value={avg} onChange={setRods} actual={avgPos} disabled={sim.scrammed} hint="W / S keys. Left = withdraw = more power." />
        {sim.rods.map((r, i) => (
          <Slider key={i} label={`Bank ${i + 1}${r.stuck ? " ⛔ STUCK" : ""}`} value={r.stuck ? r.pos : r.tgt} actual={r.pos} disabled={r.stuck || sim.scrammed}
            onChange={(v) => { if (sim.rodAuto) sim.setRodAuto(false); sim.setRod(i, v); }} color={r.stuck ? "accent-red-500" : "accent-cyan-400"} />
        ))}
      </div>
      <div className="mt-1">
        <Bar label={`Neutron power${trend(sim, "P") && diag >= 2 ? trend(sim, "P") : ""}`} value={d.P} max={1.2} marker={1} right={`${(d.P * 100).toFixed(1)}%`} color={d.P > 1.08 ? "bg-red-500" : d.P > 1.02 ? "bg-amber-400" : "bg-cyan-400"} />
        <Bar label="Decay heat" value={sim.D} max={0.1} right={`${(sim.D * 100).toFixed(1)}%`} color="bg-orange-400" />
        <Bar label={`Xenon-135${diag >= 1 ? ` → ${sim.forecastXe(30).toFixed(2)} (30 s)` : ""}`} value={d.Xe} max={2} marker={1} right={d.Xe.toFixed(2)} color={d.Xe > 1.25 ? "bg-fuchsia-500" : "bg-purple-400"} />
        <Bar label="Fuel integrity" value={sim.fuel} right={`${(sim.fuel * 100).toFixed(1)}%`} color={sim.fuel > 0.9 ? "bg-emerald-400" : sim.fuel > 0.5 ? "bg-amber-400" : "bg-red-500"} />
        {sim.boron > 0.005 && <Bar label="Boron poison" value={sim.boron} max={1.5} color="bg-teal-400" right={`${(sim.boron * 100).toFixed(0)}%`} />}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[11px] font-mono">
        <Read k="Reactivity" v={`${sim.rho * 1e5 >= 0 ? "+" : ""}${(sim.rho * 1e5).toFixed(0)} pcm`} bad={Math.abs(sim.rho) > 0.01} />
        <Read k="Rod tilt" v={`${(tilt * 100).toFixed(0)}%`} bad={tilt > 0.25} />
        <Read k={`Tavg${diag >= 2 ? trend(sim, "Tc") : ""}`} v={`${d.Tc.toFixed(0)}°C`} bad={d.Tc > 330} />
        <Read k="Fuel temp" v={`${d.Tf.toFixed(0)}°C`} bad={d.Tf > 1000} />
        <Read k={`RCS press${diag >= 2 ? trend(sim, "Pp") : ""}`} v={`${d.Pp.toFixed(0)} bar`} bad={d.Pp > 165 || d.Pp < 135} />
        <Read k="Inventory" v={`${(d.inv * 100).toFixed(0)}%`} bad={d.inv < 0.85} />
        <Read k="Flow" v={`${(sim.flow * 100).toFixed(0)}%`} bad={sim.flow < 0.5 && sim.P > 0.2} />
        <Read k="Void" v={`${(sim.voidF * 100).toFixed(0)}%`} bad={sim.voidF > 0.02} />
      </div>
    </Panel>
  );
}

function Read({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={bad ? "text-red-300" : "text-cyan-100"}>{v}</span>
    </div>
  );
}

function AlarmPanel({ sim }: { sim: Sim }) {
  const act = sim.alarms.filter((a) => a.active);
  return (
    <Panel title={`Annunciator (${act.length})`} right={<Btn small tone="amber" onClick={() => sim.ackAll()} title="A">ACK</Btn>}>
      <div className="grid grid-cols-2 gap-1 min-h-[34px]">
        {act.length === 0 && <div className="col-span-2 text-emerald-400/80 text-xs">● ALL CLEAR</div>}
        {act.map((a) => (
          <div key={a.id} className={cx("text-[10px] font-bold px-1 py-1 rounded border text-center leading-tight", a.level === 2 ? "bg-red-600/30 border-red-400 text-red-100" : "bg-amber-500/20 border-amber-400 text-amber-100", !a.acked && "animate-pulse")}>{a.text}</div>
        ))}
      </div>
    </Panel>
  );
}

function LogPanel({ sim }: { sim: Sim }) {
  const col = ["text-slate-400", "text-amber-200", "text-orange-300", "text-red-300 font-bold"];
  return (
    <Panel title="Shift log">
      <div className="h-28 overflow-y-auto font-mono text-[11px] space-y-0.5">
        {sim.log.slice(0, 14).map((l, i) => (
          <div key={`${l.t}-${i}-${l.text}`} className={col[l.level]}><span className="text-slate-600">{fmtClock(sim.shift.startHour + l.t / 30)}</span> {l.text}</div>
        ))}
      </div>
    </Panel>
  );
}

function SystemsPanel({ sim }: { sim: Sim }) {
  const pA = sim.pumps.A, pB = sim.pumps.B;
  return (
    <>
      <Panel title="Primary coolant">
        <Slider label={`Pump A · health ${sim.comps.pumpA.health.toFixed(0)}%`} value={pA.cmd} actual={pA.speed} onChange={(v) => sim.setPump("A", v)} disabled={sim.offline("pumpA")} right={sim.offline("pumpA") ? "OFFLINE" : undefined} />
        <Slider label={`Pump B · health ${sim.comps.pumpB.health.toFixed(0)}%`} value={pB.cmd} actual={pB.speed} onChange={(v) => sim.setPump("B", v)} disabled={sim.offline("pumpB")} right={sim.offline("pumpB") ? "OFFLINE" : undefined} />
        <div className="text-[10px] text-slate-500">Flow {(sim.flow * 100).toFixed(0)}% · higher speed = more cooling, more wear.</div>
      </Panel>
      <Panel title="Pressurizer" right={<Toggle on={sim.pressAuto} tone="green" onClick={() => sim.setPressAuto(!sim.pressAuto)}>AUTO</Toggle>}>
        <Slider label="Heaters" value={sim.heat} onChange={(v) => sim.setHeat(v)} />
        <Slider label="Spray" value={sim.spray} onChange={(v) => sim.setSpray(v)} />
        <div className="text-[10px] text-slate-500">RCS {sim.Pp.toFixed(0)} bar · limit 172 trip · 200 rupture</div>
      </Panel>
      <Panel title="Turbine & grid" right={<Toggle on={sim.govAuto} tone="green" onClick={() => sim.setGov(!sim.govAuto)}>AUTO GOV</Toggle>}>
        <Slider label="Governor valve" value={sim.valveCmd} actual={sim.valve} onChange={(v) => sim.setValve(v)} disabled={sim.turbTripped} />
        {sim.turbTripped && <Btn tone="amber" small className="w-full mb-2" onClick={() => sim.resetTurbine()}>RESET TURBINE{sim.turbCooldown > 0 ? ` (${Math.ceil(sim.turbCooldown)}s)` : ""}</Btn>}
        <div className="flex items-center justify-between text-[11px] text-slate-300 mb-0.5"><span>Steam bypass</span><Toggle on={sim.bypassAuto} tone="green" onClick={() => sim.setBypassAuto(!sim.bypassAuto)}>AUTO</Toggle></div>
        <Slider label="Bypass valve" value={sim.bypass} onChange={(v) => sim.setBypass(v)} />
        <Slider label={`Cooling tower fans · health ${sim.comps.tower.health.toFixed(0)}%`} value={sim.towerCmd} onChange={(v) => sim.setTower(v)} right={`${(sim.towerCmd * 100).toFixed(0)}% → cool ${(sim.coolEff * 100).toFixed(0)}%`} />
        <div className="text-[10px] text-slate-500">Steam {sim.Ps.toFixed(0)} bar · SG level {(sim.sgL * 100).toFixed(0)}% · condenser penalty {(sim.condPen * 100).toFixed(0)}%</div>
      </Panel>
    </>
  );
}

function SafetyPanel({ sim }: { sim: Sim }) {
  const dsl = sim.diesel;
  return (
    <>
      <Panel title="Power sources">
        <div className="flex gap-2 text-[11px] mb-2">
          <span className={cx("px-2 py-0.5 rounded border", sim.offsite ? "border-emerald-500 text-emerald-300" : "border-red-500 text-red-300 animate-pulse")}>OFFSITE {sim.offsite ? "OK" : "LOST"}</span>
          <span className={cx("px-2 py-0.5 rounded border", dsl === "running" ? "border-emerald-500 text-emerald-300" : dsl === "starting" ? "border-amber-400 text-amber-200" : dsl === "failed" ? "border-red-500 text-red-300" : "border-slate-600 text-slate-400")}>DIESEL {dsl.toUpperCase()}</span>
        </div>
        <Btn small className="w-full" tone={dsl === "running" ? "red" : "amber"} onClick={() => sim.toggleDiesel()}>{dsl === "running" || dsl === "starting" ? "STOP DIESEL" : "START DIESEL"}</Btn>
        <div className="mt-2"><Bar label="Diesel fuel" value={sim.dieselFuel} color="bg-yellow-400" /></div>
        {!sim.offsite && <div className="text-[10px] text-slate-400 mt-1">Offsite returns in ~{Math.max(0, Math.ceil(sim.restoreAt - sim.t))} s (estimate).</div>}
      </Panel>
      <Panel title="Emergency systems">
        <div className="grid grid-cols-2 gap-1">
          <Toggle on={sim.eccs} tone="green" onClick={() => sim.toggle("eccs")} title="Inject borated water: restores inventory, poisons the core">💉 ECCS</Toggle>
          <Toggle on={sim.afw} tone="green" onClick={() => sim.toggle("afw")} title="Aux feedwater to the SGs (no AC power needed)">💧 AFW</Toggle>
          <Toggle on={sim.rhr} tone="green" onClick={() => sim.toggle("rhr")} title="Residual heat removal: extra cooling, needs power">❄ RHR</Toggle>
          <Toggle on={sim.cspray} tone="green" onClick={() => sim.toggle("cspray")} title="Containment spray: cuts building pressure, needs power">🚿 CONT SPRAY</Toggle>
          <Toggle on={sim.vent} tone="red" className="col-span-2" onClick={() => sim.toggle("vent")} title="Dump containment pressure to atmosphere — releases activity!">☢ CONTAINMENT VENT {((sim.up.vent || 0) > 0) ? "(filtered)" : "(UNFILTERED)"}</Toggle>
        </div>
        <div className="mt-2">
          <Bar label="ECCS borated tank" value={sim.tank} color={sim.tank < 0.25 ? "bg-red-500" : "bg-teal-400"} />
          <Bar label="Primary inventory" value={sim.inv} color={sim.inv < 0.6 ? "bg-red-500" : sim.inv < 0.85 ? "bg-amber-400" : "bg-cyan-400"} />
          <Bar label="Containment pressure" value={sim.Pc} max={4} right={`${sim.Pc.toFixed(2)} / 4.0 bar`} color={sim.Pc > 2.8 ? "bg-red-500" : sim.Pc > 1.5 ? "bg-amber-400" : "bg-emerald-400"} />
          <div className="text-[11px] flex justify-between text-slate-300"><span>Release rate</span><span className={cx("font-mono", sim.releaseRate > 0.15 ? "text-red-300" : "text-slate-100")}>{sim.releaseRate.toFixed(2)} /s · total {sim.release.toFixed(1)}</span></div>
        </div>
      </Panel>
      <Panel title={`Leaks (${sim.leaks.filter((l) => !l.isolated).length} active)`}>
        {sim.leaks.length === 0 && <div className="text-xs text-slate-500">No leaks detected.</div>}
        {sim.leaks.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className={l.isolated ? "text-slate-500" : "text-red-300"}>{l.kind === "pipe" ? "Primary pipe" : "SG tube"} · {(l.rate * 1000).toFixed(1)} ‰/s</span>
            {l.isolated ? <span className="text-emerald-400 text-[11px]">ISOLATED</span> : l.isolating > 0 ? <span className="text-amber-300 text-[11px]">closing {Math.round((l.isolating / 6) * 100)}%</span> : <Btn small tone="red" onClick={() => sim.isolateLeak(l.id)}>ISOLATE</Btn>}
          </div>
        ))}
      </Panel>
    </>
  );
}

function MaintPanel({ sim }: { sim: Sim }) {
  const diag = sim.up.diag || 0;
  return (
    <Panel title="Maintenance" right={<span className="text-[10px] text-slate-400">crews free {sim.crewsFree()} / {sim.crews.length}</span>}>
      <div className="space-y-2">
        {COMPS.map((c) => {
          const s = sim.comps[c.id];
          const status = s.failed && s.crew < 0 ? "FAILED" : s.crew >= 0 ? `REPAIR ${Math.round((s.progress / Math.max(1, s.need)) * 100)}%` : s.health < 40 ? "DEGRADED" : "OK";
          const col = status === "FAILED" ? "text-red-400" : status.startsWith("REPAIR") ? "text-sky-300" : status === "DEGRADED" ? "text-amber-300" : "text-emerald-300";
          const life = diag >= 3 && s.rate > 0.01 && !s.failed && !s.tagged ? `~${Math.round(s.health / s.rate)} s left` : "";
          return (
            <div key={c.id} className="border border-slate-700/60 rounded-md p-1.5" title={c.desc}>
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs font-semibold">{c.icon} {c.name}</div>
                <span className={cx("text-[10px] font-bold", col)}>{status}</span>
              </div>
              <Bar label={life || " "} value={s.health} max={100} right={`${s.health.toFixed(0)}%`} color={s.health > 60 ? "bg-emerald-400" : s.health > 30 ? "bg-amber-400" : "bg-red-500"} />
              {s.crew >= 0 ? (
                <Btn small tone="slate" className="w-full" onClick={() => sim.cancelCrew(c.id)}>Cancel repair</Btn>
              ) : (
                <Btn small tone={s.health < 40 ? "amber" : "slate"} className="w-full" disabled={s.health >= 99.5 && !s.failed} onClick={() => sim.assignCrew(c.id)}>🔧 Repair (~{Math.round((8 + (100 - s.health) * 0.3) / (1 + 0.3 * (sim.up.crew || 0)) * (sim.tutorial ? 0.4 : 1))} s)</Btn>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
