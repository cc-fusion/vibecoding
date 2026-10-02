import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { audio } from "../game/audio";
import { clamp, CITIES, DEATH_LIMIT, DIFFS, fmt, STRAINS, TECHS } from "../game/data";
import { resolveEvent, getEventDef } from "../game/events";
import { avgPanic, totals } from "../game/helpers";
import { draw, hitTest, type Lens, type View } from "../game/render";
import {
  administerCure, buildHospital, computeResult, createSim, deselect, disinfect, publicAddress, selectDistrict,
  selectEdge, startTrace, step, toggleEdge, toggleQuarantine, updateFx,
} from "../game/sim";
import type { Settings } from "../game/storage";
import type { Sim, SimConfig } from "../game/types";
import { EndScreen, EventModal, PauseMenu, TUT, TutorialCard } from "./overlays";
import { ChroniclePanel, DistrictPanel, PolicyPanel, ResearchPanel } from "./panels";
import { Bar } from "./ui";

const SEC_PER_DAY = 4;
const SPEEDS = [1, 2, 4];
type Tab = "district" | "research" | "policies" | "log";
type Result = ReturnType<typeof computeResult>;

interface Props {
  cfg: SimConfig; settings: Settings; onSettings: (s: Settings) => void;
  onResult: (r: Result, s: Sim) => { unlocked: string | null };
  onRetry: () => void; onNext: (() => void) | null; onMap: () => void; onTitle: () => void; onTutorialDone: () => void;
}

function Res({ icon, label, value, rate, warn, title }: { icon: string; label?: string; value: ReactNode; rate?: number; warn?: boolean; title: string }) {
  return (
    <div className={`px-2 py-1 rounded border ${warn ? "border-[#d8452f] bg-[#2a1511] anim-pulse" : "border-[#3a2e22] bg-[#181310]"} min-w-[64px]`} title={title}>
      <div className="text-[10px] text-[#a8977a] font-ui leading-none">{icon} {label}</div>
      <div className="font-ui text-[15px] leading-tight text-[#e8d9b5]">{value}</div>
      {rate !== undefined && <div className="text-[10px] leading-none" style={{ color: rate >= 0 ? "#8fcf74" : "#d8452f" }}>{rate >= 0 ? "+" : ""}{rate.toFixed(1)}/d</div>}
    </div>
  );
}

export default function GameScreen(props: Props) {
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim(props.cfg);
  const s = simRef.current;
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [tab, setTab] = useState<Tab>("district");
  const [menu, setMenu] = useState(false);
  const [lens, setLens] = useState<Lens>("infection");
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [end, setEnd] = useState<{ result: Result; unlocked: string | null } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ w: 300, h: 300, t: 0, lens: "infection", hoverD: -1, hoverE: -1 });
  const menuRef = useRef(menu); menuRef.current = menu;
  const lensRef = useRef(lens); lensRef.current = lens;
  const settingsRef = useRef(props.settings); settingsRef.current = props.settings;
  const propsRef = useRef(props); propsRef.current = props;
  const reported = useRef(false);

  const showToast = useCallback((msg: string) => setToast({ msg, id: Math.random() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const run = useCallback((fn: () => string | null) => {
    const r = fn();
    if (r) { showToast(r); audio.sfx("err"); }
    bump();
  }, [showToast, bump]);

  const openTab = useCallback((t: Tab) => {
    setTab(t);
    if (t === "policies") s.flags.policiesOpen = true;
    audio.sfx("click");
  }, [s]);

  const togglePause = useCallback(() => {
    if (s.over || s.pendingEvent) return;
    s.paused = !s.paused; audio.sfx("click"); bump();
  }, [s, bump]);

  /* --- main loop --- */
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0, last = performance.now(), uiAcc = 0, dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      viewRef.current.w = Math.max(1, r.width); viewRef.current.h = Math.max(1, r.height);
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    audio.startMusic();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const rdt = clamp((now - last) / 1000, 0, 0.1); last = now;
      const v = viewRef.current; v.t += rdt; v.lens = lensRef.current;
      const running = !s.paused && !s.pendingEvent && !s.over && !menuRef.current;
      if (running) {
        let remaining = (rdt * s.speed) / SEC_PER_DAY;
        while (remaining > 1e-6) {
          const dt = Math.min(0.05, remaining);
          step(s, dt); remaining -= dt;
          if (s.over || s.pendingEvent) break;
        }
      }
      updateFx(s, rdt);
      if (!settingsRef.current.shake) s.vis.shake = 0;
      while (s.sfxQueue.length) audio.sfx(s.sfxQueue.shift()!);

      const T = s.cfg.tutorial ? TUT[s.tutStep] : undefined;
      if (T && !T.manual && T.done(s)) { s.tutStep++; audio.sfx("ok"); }

      if (s.over && !reported.current) {
        reported.current = true;
        const result = computeResult(s);
        const info = propsRef.current.onResult(result, s);
        setEnd({ result, unlocked: info.unlocked });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, s, v);

      uiAcc += rdt;
      if (uiAcc > 0.2) {
        uiAcc = 0;
        const t = totals(s);
        audio.setTension(clamp(t.active / Math.max(1, s.pop0 * 0.12), 0, 1) * 0.8 + clamp(avgPanic(s) / 100, 0, 1) * 0.2, s.bossEmerged && !s.over);
        audio.setPaused(s.paused || menuRef.current);
        setTick((x) => x + 1);
      }
    };
    raf = requestAnimationFrame(frame);

    const blur = () => { if (!s.over) { s.paused = true; } };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener("blur", blur); document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); audio.stopMusic();
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", vis);
    };
  }, [s]);

  /* --- keyboard --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" && (e.target as HTMLInputElement).type === "text") return;
      const k = e.key.toLowerCase();
      if (s.over) return;
      if (k === "escape") { setMenu((m) => !m); audio.sfx("click"); return; }
      if (menuRef.current) return;
      if (s.pendingEvent) {
        const idx = parseInt(k, 10) - 1;
        const def = getEventDef(s.pendingEvent.id);
        if (def && idx >= 0 && idx < def.choices.length) { const c = def.choices[idx]; if (!c.can || c.can(s)) { resolveEvent(s, idx); bump(); } }
        return;
      }
      const sel = s.selected;
      const did = sel.kind === "d" ? sel.id : -1;
      const needD = (fn: (id: number) => string | null) => run(() => (did >= 0 ? fn(did) : "Select a district first"));
      switch (k) {
        case " ": e.preventDefault(); togglePause(); break;
        case "1": case "2": case "3": s.speed = SPEEDS[parseInt(k, 10) - 1]; s.paused = false; audio.sfx("click"); bump(); break;
        case "q": needD((id) => toggleQuarantine(s, id)); break;
        case "h": needD((id) => buildHospital(s, id)); break;
        case "t": needD((id) => startTrace(s, id)); break;
        case "a": needD((id) => publicAddress(s, id)); break;
        case "f": needD((id) => disinfect(s, id)); break;
        case "c": needD((id) => administerCure(s, id)); break;
        case "x": run(() => (sel.kind === "e" ? toggleEdge(s, sel.id) : "Select a road first")); break;
        case "r": openTab("research"); break;
        case "p": openTab("policies"); break;
        case "l": openTab("log"); break;
        case "d": openTab("district"); break;
        case "v": setLens((l) => (["infection", "panic", "rumor", "hunger"] as Lens[])[(["infection", "panic", "rumor", "hunger"].indexOf(l) + 1) % 4]); audio.sfx("click"); break;
        case "m": { const n = { ...settingsRef.current, muted: !settingsRef.current.muted }; audio.setVol(n); propsRef.current.onSettings(n); break; }
        case "tab": {
          e.preventDefault();
          const n = s.districts.length;
          const next = did < 0 ? 0 : (did + (e.shiftKey ? n - 1 : 1)) % n;
          selectDistrict(s, next); setTab("district"); bump(); break;
        }
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, bump, run, togglePause, openTab]);

  /* --- pointer --- */
  const toLocal = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = toLocal(e); const h = hitTest(s, viewRef.current, p.x, p.y);
    const v = viewRef.current;
    v.hoverD = h?.kind === "d" ? h.id : -1; v.hoverE = h?.kind === "e" ? h.id : -1;
    canvasRef.current!.style.cursor = h ? "pointer" : "default";
  };
  const onDown = (e: React.PointerEvent) => {
    if (menu || s.over) return;
    const p = toLocal(e); const h = hitTest(s, viewRef.current, p.x, p.y);
    if (h?.kind === "d") { selectDistrict(s, h.id); setTab("district"); }
    else if (h?.kind === "e") { selectEdge(s, h.id); setTab("district"); }
    else deselect(s);
    bump();
  };

  const t = totals(s);
  const diff = DIFFS.find((d) => d.id === s.cfg.diffId) || DIFFS[1];
  const strain = STRAINS[s.strain];
  const cur = TECHS.find((x) => x.id === s.research.current);
  const deathFrac = (s.pop0 - t.alive) / Math.max(1, s.pop0);
  const idleResearch = !s.research.current;
  const tutActive = s.cfg.tutorial && s.tutStep < TUT.length;
  const bossLine = s.bossEmerged
    ? `☠ CRIMSON ACTIVE · ${fmt(t.active)} cases`
    : s.bossPulled ? `☠ Crimson in ${Math.max(0, s.bossDay - s.day)}d` : `☠ Mutation in ~${Math.max(0, s.bossDay - s.day)}d`;

  return (
    <div className="absolute inset-0 flex flex-col select-none" style={{ background: "#120f0d" }}>
      {/* HUD */}
      <div className="flex flex-wrap items-stretch gap-1.5 p-1.5 border-b border-[#3a2e22] bg-[#161210]">
        <button className="btn !px-2" onClick={() => { setMenu(true); audio.sfx("click"); }} title="Menu (Esc)">☰</button>
        <div className="px-2 py-1 rounded border border-[#3a2e22] bg-[#181310]">
          <div className="text-[10px] font-ui leading-none" style={{ color: strain.color }}>{strain.name.toUpperCase()}</div>
          <div className="font-title text-[17px] leading-tight text-[#e8d9b5]">Day {s.day}</div>
          <div className={`text-[10px] leading-none ${s.bossEmerged ? "text-[#ff3b2a] flicker" : "text-[#a8977a]"}`}>{bossLine}</div>
        </div>
        <div className="flex items-stretch gap-1">
          <button className={`btn !px-2 ${s.paused ? "btn-on anim-pulse" : ""}`} onClick={togglePause} title="Pause/Resume (Space)">{s.paused ? "▶" : "⏸"}</button>
          {SPEEDS.map((sp, i) => (
            <button key={sp} className={`btn !px-2 ${!s.paused && s.speed === sp ? "btn-on" : ""}`} onClick={() => { s.speed = sp; s.paused = false; audio.sfx("click"); bump(); }} title={`Speed x${sp} (${i + 1})`}>{"▶".repeat(i + 1)}</button>
          ))}
        </div>
        <Res icon="🪙" label="Funds" value={fmt(s.funds)} rate={s.rates.income - s.rates.upkeep} warn={s.broke} title="Funds: taxes minus upkeep" />
        <Res icon="🌾" label="Food" value={fmt(s.food)} rate={s.rates.food} warn={s.foodRatio < 1 || (s.food < 15 && s.rates.food < 0)} title="Food stock and daily balance" />
        <Res icon="⚗️" label="Medicine" value={fmt(s.med)} rate={s.rates.med} warn={s.med <= 0} title="Medicine stock and daily balance" />
        <button className="text-left" onClick={() => openTab("research")} title="Research">
          <Res icon="📜" label="Research" value={cur ? `${Math.floor((s.research.progress / cur.cost) * 100)}%` : "IDLE"} rate={s.rates.rp} warn={idleResearch} title="Current research" />
        </button>
        <div className="px-2 py-1 rounded border border-[#3a2e22] bg-[#181310] w-[92px]" title="Public trust: reach 0 and the city revolts">
          <div className="text-[10px] text-[#a8977a] font-ui leading-none flex justify-between"><span>🕊 TRUST</span><span>{Math.round(s.trust)}</span></div>
          <div className="mt-1"><Bar value={s.trust} color={s.trust < 25 ? "#d8452f" : s.trust < 50 ? "#e0a53f" : "#8fcf74"} h={8} /></div>
          <div className="text-[10px] text-[#a8977a] leading-none mt-1 font-ui flex justify-between"><span>😨 {Math.round(avgPanic(s))}%</span></div>
        </div>
        <div className="px-2 py-1 rounded border border-[#3a2e22] bg-[#181310] w-[118px]" title={`Lose if more than ${DEATH_LIMIT * 100}% of the city dies`}>
          <div className="text-[10px] text-[#a8977a] font-ui leading-none flex justify-between"><span>👥 {fmt(t.alive)}</span><span>† {fmt(t.dead)}</span></div>
          <div className="mt-1"><Bar value={deathFrac} max={DEATH_LIMIT} color="#9a968c" h={8} /></div>
          <div className="text-[10px] text-[#a8977a] leading-none mt-1">~{fmt(t.seen)} reported ill</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden md:inline text-xs font-ui" style={{ color: diff.color }}>{CITIES[s.cfg.cityIdx].name} · {diff.name}</span>
          <button className="btn !px-2" title="Mute (M)" onClick={() => { const n = { ...props.settings, muted: !props.settings.muted }; audio.setVol(n); props.onSettings(n); }}>{props.settings.muted ? "🔇" : "🔊"}</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div ref={wrapRef} className="relative flex-1 min-h-[220px] overflow-hidden">
          <canvas ref={canvasRef} onPointerMove={onMove} onPointerDown={onDown} />
          <div className="vignette" />
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {([["infection", "☣", "Infection"], ["panic", "😨", "Panic"], ["rumor", "🗯", "Rumour"], ["hunger", "🌾", "Hunger"]] as [Lens, string, string][]).map(([l, ic, nm]) => (
              <button key={l} className={`btn !px-2 !py-1 !text-xs ${lens === l ? "btn-on" : ""}`} onClick={() => { setLens(l); audio.sfx("click"); }} title={`${nm} lens (V)`}>{ic}<span className="hidden sm:inline"> {nm}</span></button>
            ))}
          </div>
          {s.paused && !menu && !s.pendingEvent && !s.over && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 border border-[#e0a53f] text-[#e0a53f] font-ui text-xs anim-pulse z-10 pointer-events-none">⏸ TIME STOPPED · press Space</div>
          )}
          {toast && <div key={toast.id} className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-[#3a1510] border border-[#d8452f] text-[#ffb09a] text-sm anim-pop z-20">{toast.msg}</div>}
          {s.log[0] && !tutActive && (
            <div className="hidden sm:block absolute bottom-2 left-3 right-3 text-sm text-center text-[#cdbd9a] pointer-events-none" style={{ textShadow: "0 1px 3px #000" }}>
              <span className="text-[#7d6e57] font-ui text-xs">Day {s.log[0].day} · </span>{s.log[0].text}
            </div>
          )}
          {tutActive && <TutorialCard s={s} onSkip={() => { s.tutStep = TUT.length; props.onTutorialDone(); bump(); }} onFinish={() => { s.tutStep = TUT.length; props.onTutorialDone(); bump(); }} />}
        </div>

        <div className="lg:w-[350px] h-[42%] lg:h-auto flex flex-col border-t lg:border-t-0 lg:border-l border-[#3a2e22] bg-[#161210]">
          <div className="flex border-b border-[#3a2e22]">
            {([["district", "🏘", "District"], ["research", "📜", "Research"], ["policies", "⚖", "Edicts"], ["log", "📖", "Chronicle"]] as [Tab, string, string][]).map(([k, ic, nm]) => (
              <button key={k} onClick={() => openTab(k)} className={`flex-1 py-1.5 text-xs font-ui relative ${tab === k ? "bg-[#2a2118] text-[#e0a53f] border-b-2 border-[#e0a53f]" : "text-[#a8977a] hover:bg-[#1f1913]"}`}>
                {ic} <span className="hidden sm:inline">{nm}</span>
                {k === "research" && idleResearch && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#d8452f] anim-pulse" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            {tab === "district" && <DistrictPanel s={s} run={run} />}
            {tab === "research" && <ResearchPanel s={s} run={run} />}
            {tab === "policies" && <PolicyPanel s={s} run={run} />}
            {tab === "log" && <ChroniclePanel s={s} />}
          </div>
        </div>
      </div>

      {s.pendingEvent && !end && <EventModal s={s} bump={bump} />}
      {menu && !end && (
        <PauseMenu s={s} settings={props.settings} onSettings={props.onSettings} bump={bump} onResume={() => setMenu(false)} onRestart={props.onRetry} onQuit={props.onTitle} />
      )}
      {end && (
        <EndScreen s={s} result={end.result} lp={end.result.lp} unlocked={end.unlocked} onRetry={props.onRetry} onNext={end.result.win ? props.onNext : null} onMap={props.onMap} onTitle={props.onTitle} />
      )}
    </div>
  );
}
