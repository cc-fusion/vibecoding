import { useCallback, useEffect, useRef, useState } from "react";
import { Sim, LaunchOpts, RunResult, HudData, Input } from "../game/combat";
import { SaveData } from "../game/save";
import { audio } from "../game/audio";
import { Btn, Panel } from "./ui";
import { SettingsPanel, HelpPanel } from "./Menus";

interface Props { opts: LaunchOpts; save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void; onEnd: (r: RunResult) => void; onRestart: () => void }

/** Compact HUD gauge. */
function HudBar({ label, value, pct, color, blink }: { label: string; value: string; pct: number; color: string; blink?: boolean }) {
  return (
    <div className={blink ? "blink" : ""}>
      <div className="flex justify-between text-[10px] leading-none mb-0.5 font-display tracking-widest">
        <span className="text-slate-300">{label}</span><span className="text-slate-100 tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-slate-900/80 border border-slate-700 rounded-sm overflow-hidden">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, background: color, transition: "width 0.12s linear" }} />
      </div>
    </div>
  );
}

export function CombatView({ opts, save, setSave, onEnd }: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [paused, setPausedState] = useState(false);
  const [panel, setPanel] = useState<null | "settings" | "help">(null);
  const pausedRef = useRef(false);
  const panelRef = useRef<null | "settings" | "help">(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const touch = useRef({ mx: 0, my: 0, fire: false, missile: false, vent: false });
  const [joy, setJoy] = useState<null | { ox: number; oy: number; x: number; y: number }>(null);
  const joyId = useRef<number | null>(null);

  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    if (p) audio.sfx("ui");
  }, []);
  const setPanelBoth = (p: null | "settings" | "help") => { panelRef.current = p; setPanel(p); };

  useEffect(() => { simRef.current?.setDiff(save.diff); }, [save.diff]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const sim = new Sim(opts);
    simRef.current = sim;
    pausedRef.current = false;
    setPausedState(false);
    const input: Input = { mx: 0, my: 0, ax: window.innerWidth / 2, ay: window.innerHeight / 2 - 100, fire: false, missile: false, vent: false, autoAim: opts.touch };
    const keys = new Set<string>();
    let mouseFire = false, mouseMsl = false;
    let padVentPrev = false, padPausePrev = false;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth, h = window.innerHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      cv.style.width = w + "px"; cv.style.height = h + "px";
      sim.resize(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const togglePause = () => {
      if (sim.ended) return;
      if (panelRef.current) { panelRef.current = null; setPanel(null); return; }
      setPaused(!pausedRef.current);
    };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === "escape" || k === "p") { if (!e.repeat) togglePause(); return; }
      if (pausedRef.current) return;
      keys.add(k);
      if (k === " " && !e.repeat) input.vent = true;
    };
    const ku = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); };
    const md = (e: MouseEvent) => { audio.init(); if (e.button === 0) mouseFire = true; if (e.button === 2) mouseMsl = true; };
    const mu = (e: MouseEvent) => { if (e.button === 0) mouseFire = false; if (e.button === 2) mouseMsl = false; };
    const mm = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); input.ax = e.clientX - r.left; input.ay = e.clientY - r.top; };
    const cm = (e: Event) => e.preventDefault();
    const blur = () => { keys.clear(); mouseFire = false; mouseMsl = false; if (!sim.ended) setPaused(true); };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    cv.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    cv.addEventListener("mousemove", mm);
    cv.addEventListener("contextmenu", cm);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);

    audio.init();
    audio.startMusic("combat");
    audio.setIntensity(0.3);

    let raf = 0, last = performance.now(), hudT = 0, done = false;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && !sim.ended) {
        let mx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
        let my = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
        let fire = mouseFire || keys.has("j") || touch.current.fire;
        let msl = mouseMsl || keys.has("k") || touch.current.missile;
        // gamepad
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = pads && Array.from(pads).find((p) => p && p.connected);
        if (pad) {
          const dz = (v: number) => (Math.abs(v) < 0.22 ? 0 : v);
          const gx = dz(pad.axes[0] || 0), gy = dz(pad.axes[1] || 0);
          if (gx || gy) { mx = gx; my = gy; }
          const rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
          if (rx || ry) { input.ax = window.innerWidth / 2 + rx * 260; input.ay = window.innerHeight / 2 + ry * 260; }
          if (pad.buttons[7]?.pressed) fire = true;
          if (pad.buttons[6]?.pressed || pad.buttons[5]?.pressed) msl = true;
          const v = !!pad.buttons[0]?.pressed;
          if (v && !padVentPrev) input.vent = true;
          padVentPrev = v;
          const pp = !!pad.buttons[9]?.pressed;
          if (pp && !padPausePrev) togglePause();
          padPausePrev = pp;
        }
        if (touch.current.mx || touch.current.my) { mx = touch.current.mx; my = touch.current.my; }
        if (touch.current.vent) { input.vent = true; touch.current.vent = false; }
        input.mx = mx; input.my = my; input.fire = fire; input.missile = msl;
        sim.update(dt, input);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.draw(ctx);
      hudT += dt;
      if (hudT > 0.07) { hudT = 0; const h = sim.hud(); h.paused = pausedRef.current; setHud(h); }
      if (sim.ended && !done) {
        done = true;
        setHud(sim.hud());
        onEndRef.current(sim.ended);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cv.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      cv.removeEventListener("mousemove", mm);
      cv.removeEventListener("contextmenu", cm);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      audio.setIntensity(0);
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.id]);

  const retreat = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.finish(false, true);
    if (sim.ended) onEnd(sim.ended);
  };

  const h = hud;
  const heatPct = h ? h.heat / h.heatMax : 0;
  const heatColor = heatPct > 0.85 ? "#ef4444" : heatPct > 0.6 ? "#fb923c" : "#fbbf24";
  const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  // touch joystick handlers
  const onJoyDown = (e: React.PointerEvent) => {
    if (joyId.current !== null) return;
    joyId.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);
    setJoy({ ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current || !joy) return;
    const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 55);
    touch.current.mx = (dx / m) * k; touch.current.my = (dy / m) * k;
    setJoy({ ...joy, x: joy.ox + (dx / m) * Math.min(55, m), y: joy.oy + (dy / m) * Math.min(55, m) });
  };
  const onJoyUp = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current) return;
    joyId.current = null; touch.current.mx = 0; touch.current.my = 0; setJoy(null);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={cvRef} className="absolute inset-0 touch-none" style={{ cursor: opts.touch ? "default" : "none" }} />
      {h && (
        <div className="absolute inset-0 pointer-events-none">
          {/* top-left systems */}
          <div className="absolute top-2 left-2 w-52 sm:w-60 space-y-1.5 bg-slate-950/60 border border-slate-700/70 p-2 rounded-sm">
            <HudBar label="HULL" value={`${Math.round(h.hullPct * 100)}%`} pct={h.hullPct} color={h.hullPct > 0.5 ? "#4ade80" : h.hullPct > 0.25 ? "#fbbf24" : "#ef4444"} blink={h.hullPct < 0.25} />
            {h.shieldMax > 0 && <HudBar label="SHIELD" value={`${Math.round(h.shield)}/${Math.round(h.shieldMax)}`} pct={h.shield / h.shieldMax} color="#22d3ee" />}
            <HudBar label={h.overheated ? "OVERHEAT!" : h.ventLock > 0 ? "VENTING" : "HEAT"} value={`${Math.round(heatPct * 100)}%`} pct={heatPct} color={heatColor} blink={h.overheated || heatPct > 0.85} />
            <HudBar label={`POWER ${h.gen.toFixed(0)}/${h.demand.toFixed(0)}`} value={h.eff < 0.99 ? `BROWNOUT ${Math.round(h.eff * 100)}%` : "OK"} pct={Math.min(1, h.gen / Math.max(0.1, h.demand))} color={h.eff < 0.99 ? "#ef4444" : "#facc15"} blink={h.eff < 0.99} />
            {h.batteryMax > 0 && <HudBar label="CAPACITOR" value={`${Math.round(h.battery)}/${Math.round(h.batteryMax)}`} pct={h.battery / h.batteryMax} color="#a3e635" />}
            <div className="flex justify-between text-[10px] font-display tracking-widest text-slate-300">
              <span>CREW <span className={h.crewUsed < h.crewNeed ? "text-rose-400" : "text-emerald-300"}>{h.crewUsed}/{h.crewNeed}</span></span>
              <span>VENT <span className={h.ventCd > 0 ? "text-slate-500" : "text-cyan-300"}>{h.ventCd > 0 ? `${Math.ceil(h.ventCd)}s` : "READY"}</span></span>
              <span>MSL <span className="text-red-300">{h.missileReady}</span></span>
            </div>
          </div>
          {/* top-center */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center">
            <div className="font-display text-[10px] sm:text-xs tracking-[0.3em] text-slate-300 bg-slate-950/60 border border-slate-700/70 px-3 py-1 rounded-sm">
              {h.sortieName.toUpperCase()} · WAVE {h.wave}/{h.totalWaves} · <span className="text-rose-300">{h.enemies} HOSTILE</span>
            </div>
            {h.boss && (
              <div className="mt-2 w-64 sm:w-96">
                <div className="flex justify-between font-display text-[10px] tracking-widest text-fuchsia-200"><span>{h.boss.name.toUpperCase()}</span><span>PHASE {h.boss.phase}</span></div>
                <div className="h-3 bg-slate-950/80 border border-fuchsia-500/70 rounded-sm overflow-hidden"><div className="h-full bg-gradient-to-r from-fuchsia-600 to-rose-500" style={{ width: `${h.boss.pct * 100}%`, transition: "width 0.2s" }} /></div>
              </div>
            )}
          </div>
          {/* top-right */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
            <div className="bg-slate-950/60 border border-slate-700/70 px-3 py-1.5 rounded-sm font-display text-xs tracking-widest text-right space-y-0.5">
              <div className="text-amber-300">¢ {h.credits}</div>
              <div className="text-slate-300">KILLS {h.kills}</div>
              <div className="text-slate-500">{fmt(h.time)}</div>
            </div>
            <div className="pointer-events-auto"><Btn small onClick={() => setPaused(true)}>Pause</Btn></div>
          </div>
          {/* banner */}
          {h.banner && (
            <div key={h.banner.key} className="absolute top-[22%] left-0 right-0 text-center banner-in px-2">
              <div className="font-display font-black text-3xl sm:text-5xl text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.8)]">{h.banner.text}</div>
              <div className="font-display text-xs sm:text-sm tracking-[0.35em] text-cyan-200 mt-1">{h.banner.sub}</div>
            </div>
          )}
          {h.flare > 0 && <div className="absolute top-[14%] left-0 right-0 text-center font-display tracking-[0.3em] text-orange-300 text-sm blink">{h.flare === 1 ? "⚠ SOLAR FLARE INCOMING" : "☀ SOLAR FLARE – POWER COLLAPSING"}</div>}
          {h.oob && <div className="absolute top-[30%] left-0 right-0 text-center font-display tracking-[0.3em] text-rose-400 text-sm blink">RETURN TO COMBAT ZONE</div>}
          {h.hint && !h.paused && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-xl text-center fade-up">
              <div className="bg-slate-950/85 border border-cyan-400 text-cyan-100 px-4 py-2 rounded-sm text-sm sm:text-base pulse-glow">💡 {h.hint}</div>
            </div>
          )}
        </div>
      )}
      {/* touch controls */}
      {opts.touch && !paused && (
        <>
          <div className="absolute left-0 top-24 bottom-0 w-1/2 touch-none" onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp} />
          {joy && (
            <div className="absolute pointer-events-none rounded-full border-2 border-cyan-400/60 bg-cyan-400/10" style={{ left: joy.ox - 55, top: joy.oy - 55, width: 110, height: 110 }}>
              <div className="absolute rounded-full bg-cyan-300/60" style={{ left: joy.x - joy.ox + 55 - 22, top: joy.y - joy.oy + 55 - 22, width: 44, height: 44 }} />
            </div>
          )}
          <div className="absolute right-3 bottom-3 flex flex-col gap-3 items-end">
            <button className="w-20 h-20 rounded-full border-2 border-rose-400 bg-rose-500/25 font-display text-xs text-rose-100 active:bg-rose-500/60 touch-none"
              onPointerDown={() => { touch.current.fire = true; }} onPointerUp={() => { touch.current.fire = false; }} onPointerCancel={() => { touch.current.fire = false; }} onPointerLeave={() => { touch.current.fire = false; }}>FIRE</button>
            <div className="flex gap-3">
              <button className="w-14 h-14 rounded-full border-2 border-amber-400 bg-amber-500/25 font-display text-[10px] text-amber-100 active:bg-amber-500/60 touch-none"
                onPointerDown={() => { touch.current.missile = true; }} onPointerUp={() => { touch.current.missile = false; }} onPointerCancel={() => { touch.current.missile = false; }} onPointerLeave={() => { touch.current.missile = false; }}>MSL</button>
              <button className="w-14 h-14 rounded-full border-2 border-cyan-400 bg-cyan-500/25 font-display text-[10px] text-cyan-100 active:bg-cyan-500/60 touch-none"
                onPointerDown={() => { touch.current.vent = true; }}>VENT</button>
            </div>
          </div>
        </>
      )}
      {/* pause menu */}
      {paused && !panel && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-sm fade-up">
            <Panel title="Paused">
              <div className="p-4 flex flex-col gap-2.5">
                <div className="text-xs text-slate-400 mb-1">{opts.sortie.name} · Wave {h?.wave}/{h?.totalWaves}</div>
                <Btn variant="primary" onClick={() => setPaused(false)}>Resume</Btn>
                <Btn onClick={() => setPanelBoth("settings")}>Settings &amp; Difficulty</Btn>
                <Btn onClick={() => setPanelBoth("help")}>Controls &amp; Help</Btn>
                <Btn onClick={onRestart}>Restart sortie</Btn>
                <Btn variant="danger" onClick={retreat}>Retreat (keep 50% salvage)</Btn>
                <div className="text-[11px] text-slate-500">Esc / P to resume</div>
              </div>
            </Panel>
          </div>
        </div>
      )}
      {panel === "settings" && <SettingsPanel save={save} setSave={setSave} inGame onClose={() => setPanelBoth(null)} />}
      {panel === "help" && <HelpPanel onClose={() => setPanelBoth(null)} />}
    </div>
  );
}
