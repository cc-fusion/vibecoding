import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DIFFICULTIES, MODS, SCENARIOS } from "../game/data";
import { Game, type Summary } from "../game/engine";
import { draw, npcAt, roomAt, squadAt, toWorld, type View } from "../game/render";
import { initAudio, resumeAudio, setIntensity, setMusicMode, sfx, startMusic, suspendAudio } from "../game/audio";
import type { SaveData, Settings } from "../game/save";
import { Bar, Btn, Card, Chip, Overlay } from "./common";
import { AgentsTab, CoupTab, IntelTab, LogTab } from "./Sidebar";
import { HelpModal, type RunCfg } from "./Menus";

type Tab = "intel" | "agents" | "coup" | "log";

interface Props {
  cfg: RunCfg;
  save: SaveData;
  settings: Settings;
  onFinished: (s: Summary) => void;
  onRetry: () => void;
  onNav: (to: "title" | "campaign" | "next") => void;
  hasNext: boolean;
  onSettings: () => void;
  onToggleMute: () => void;
}

function Meter({ icon, label, value, color, title, pulse, max = 100 }: { icon: string; label: string; value: number; color: string; title: string; pulse?: boolean; max?: number }) {
  return (
    <div title={title} className={`flex flex-col min-w-[74px] flex-1 max-w-[130px] ${pulse ? "anim-pulse-red rounded" : ""}`}>
      <div className="flex justify-between text-[11px] leading-none mb-0.5"><span className="text-[#a89a80]">{icon} {label}</span><span style={{ color }}>{max === 100 ? Math.round(value) : value.toFixed(1)}</span></div>
      <Bar value={value} max={max} color={color} h={6} />
    </div>
  );
}

export default function GameScreen({ cfg, save, settings, onFinished, onRetry, onNav, hasNext, onSettings, onToggleMute }: Props) {
  const [g] = useState(() => new Game({ scenarioId: cfg.scenarioId, difficultyId: cfg.difficultyId, mods: cfg.mods, perks: save.perks, tutorial: cfg.tutorial }));
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ w: 800, h: 600, dpr: 1, hoverNpc: null, hoverRoom: null, hoverSquad: null, showWeb: false, shake: true, mx: 0, my: 0, pointerIn: false });
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [tab, setTab] = useState<Tab>("intel");
  const [userPaused, setUserPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmCoup, setConfirmCoup] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showWeb, setShowWeb] = useState(false);
  const [tutHidden, setTutHidden] = useState(false);
  const finished = useRef(false);
  const prevSel = useRef<number | null>(null);
  const prevPhase = useRef(g.phase);
  const ui = useRef({ menuOpen, helpOpen, confirmCoup });
  ui.current = { menuOpen, helpOpen, confirmCoup };

  const scn = SCENARIOS.find((s) => s.id === cfg.scenarioId) ?? SCENARIOS[0];

  /* pause plumbing */
  useEffect(() => { g.paused = userPaused || menuOpen || helpOpen || confirmCoup; }, [g, userPaused, menuOpen, helpOpen, confirmCoup]);
  useEffect(() => { view.current.showWeb = showWeb; }, [showWeb]);
  useEffect(() => { view.current.shake = settings.shake; }, [settings.shake]);

  /* audio lifecycle */
  useEffect(() => {
    initAudio();
    startMusic("play");
    setMusicMode("play");
    return () => { setMusicMode("menu"); setIntensity(0); };
  }, []);

  /* main loop */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      g.update(dt);
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) draw(ctx, g, view.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g]);

  /* resize */
  useEffect(() => {
    const el = wrapRef.current, cv = canvasRef.current;
    if (!el || !cv) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(100, Math.floor(r.width)), h = Math.max(100, Math.floor(r.height));
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      Object.assign(view.current, { w, h, dpr });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, []);

  /* UI refresh + bookkeeping */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (g.selected !== prevSel.current) { if (g.selected !== null) setTab("intel"); prevSel.current = g.selected; }
      if (g.phase !== prevPhase.current) { if (g.phase === "coup") setTab("coup"); prevPhase.current = g.phase; }
      if (g.summary && !finished.current) { finished.current = true; onFinished(g.summary); }
      force();
    }, 110);
    return () => clearInterval(id);
  }, [g, onFinished]);

  /* auto-pause on tab blur */
  useEffect(() => {
    const vis = () => {
      if (document.hidden) { if (g.phase === "plan" || g.phase === "coup") setMenuOpen(true); suspendAudio(); }
      else resumeAudio();
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [g]);

  const openCoupTab = useCallback(() => { g.flags.coupTab = true; setTab("coup"); }, [g]);

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      const o = ui.current;
      if (g.phase === "won" || g.phase === "lost") return;
      if (k === "escape") {
        if (o.helpOpen) setHelpOpen(false);
        else if (o.confirmCoup) setConfirmCoup(false);
        else if (o.menuOpen) setMenuOpen(false);
        else if (g.targeting) g.cancelTargeting();
        else if (g.coup && g.coup.sel.length) g.coup.sel = [];
        else if (g.selected !== null) g.selected = null;
        else setMenuOpen(true);
        return;
      }
      if (o.menuOpen || o.helpOpen || o.confirmCoup) return;
      if (k === " ") { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.(); setUserPaused((p) => !p); }
      else if (k === "1" || k === "2" || k === "3") { g.speed = Number(k) as 1 | 2 | 3; sfx("click"); }
      else if (k === "w") setShowWeb((s) => !s);
      else if (k === "c") openCoupTab();
      else if (k === "m") onToggleMute();
      else if (k === "h") setHelpOpen(true);
      else if (k === "a" && g.coup) g.coup.sel = g.coup.squads.filter((s) => s.side === "rebel").map((s) => s.id);
      else if (k === "tab") {
        e.preventDefault();
        if (g.coup) {
          const reb = g.coup.squads.filter((s) => s.side === "rebel");
          if (reb.length) { const i = reb.findIndex((s) => g.coup!.sel[0] === s.id); g.coup.sel = [reb[(i + 1) % reb.length].id]; sfx("select"); }
        } else {
          const list = g.npcs.filter((n) => n.status !== "dead");
          const i = list.findIndex((n) => n.id === g.selected);
          g.select(list[(i + 1) % list.length].id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [g, openCoupTab, onToggleMute]);

  /* pointer */
  const pointerInfo = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const v = view.current;
    const wp = toWorld(px, py, v.w, v.h);
    const n = npcAt(g, wp.x, wp.y);
    const sq = squadAt(g, wp.x, wp.y);
    return { px, py, wp, n, sq, room: roomAt(wp.x, wp.y) };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pointerInfo(e);
    const v = view.current;
    v.mx = p.px; v.my = p.py; v.pointerIn = true;
    v.hoverNpc = p.n ? p.n.id : null;
    v.hoverSquad = p.sq;
    v.hoverRoom = p.room;
  };
  const issue = (p: ReturnType<typeof pointerInfo>, shift: boolean, right: boolean) => {
    if (g.modal || g.phase === "won" || g.phase === "lost") return;
    initAudio();
    if (g.phase === "plan") {
      if (g.targeting) { if (p.n && !right) g.finishTargeting(p.n.id); return; }
      const sel = g.npc(g.selected);
      if (right) { if (sel && sel.status === "conspirator" && p.room) g.post(sel.id, p.room); return; }
      if (p.n) { g.select(p.n.id); setTab("intel"); return; }
      if (p.room && sel && sel.status === "conspirator") { g.post(sel.id, p.room); return; }
      if (!p.room) g.selected = null;
    } else if (g.phase === "coup" && g.coup) {
      const c = g.coup;
      if (!right && p.sq !== null) {
        c.sel = shift ? (c.sel.includes(p.sq) ? c.sel.filter((x) => x !== p.sq) : [...c.sel, p.sq]) : [p.sq];
        sfx("select");
        return;
      }
      if (p.room && c.sel.length) g.orderSquads(c.sel, p.room);
      else if (!p.room && !right) c.sel = [];
    }
  };

  const speedBtn = (s: 1 | 2 | 3) => (
    <button key={s} onClick={() => { g.speed = s; sfx("click"); }} className={`btn w-8 h-8 rounded font-display text-sm cursor-pointer border ${g.speed === s ? "bg-[#e3b95a] text-black border-[#ffe9a8]" : "bg-[#241c2e] border-[#4a3a2a] text-[#cdbd9a]"}`}>{s}×</button>
  );

  const hour = g.hour();
  const day = Math.min(g.totalDays, g.day());
  const daysLeft = g.timeLeft() / g.dayLen;
  const nHour = Math.floor(hour);
  const isDay = hour >= 6 && hour < 19;
  const ended = g.phase === "won" || g.phase === "lost";

  /* contextual hint */
  let hint = "";
  if (settings.hints && !ended) {
    if (g.phase === "coup") hint = "Select squads, then click rooms. Concentrate force — and take the Barracks to stop reinforcements!";
    else if (g.evidence > 70) hint = "Evidence critical! Stop acting loudly. Bury the Reports (Spymaster agent in the Tower) or frame him.";
    else if (daysLeft < 1.6) hint = "Succession is imminent — open the Coup tab and strike while you can!";
    else if (g.agents().length === 0) hint = "You have no agents. Recruit someone (couriers cost double).";
    else if (g.gold < 25 && g.agents().length > 0) hint = "Low on gold. Station the Treasurer in the Treasury to skim, or hold off on bribes.";
    else if (g.paranoia > 70) hint = "The Monarch is paranoid — a purge looms at 20:00 each night. Keep agents out of suspicion.";
  }

  const tutSteps = [
    { t: "Click a courtier token (or pick from the roster) to select them.", done: !!g.flags.selected },
    { t: "Press “Eavesdrop” to learn their true loyalty, trait and secret.", done: !!g.flags.investigated },
    { t: "Recruit someone — aim for low Crown loyalty. Agents get a gold ring.", done: !!g.flags.recruited },
    { t: "Select an agent, then click a room to station them. Roles gain powers in the right room (✦ glow).", done: !!g.flags.posted },
    { t: "Use an agent's special ability in its room (see the Agents tab).", done: !!g.flags.ability },
    { t: "Select anyone and “Sow Doubt” to start a rumor that spreads by gossip.", done: !!g.flags.rumor },
    { t: "Open the Coup tab, read the forecast — then launch before the heir is crowned!", done: !!g.flags.coupTab },
  ];
  const tutIdx = tutSteps.findIndex((s) => !s.done);
  const showTut = g.tutorial && settings.hints && !tutHidden && g.phase === "plan";

  const summary = g.summary;
  const showEnd = ended && g.endDelay > 1.8 && summary;

  return (
    <div className="h-full w-full flex flex-col relative bg-[#0d0a10]">
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gradient-to-b from-[#241a2c] to-[#17121c] border-b border-[#4a3a2a]">
        <div className="flex flex-col leading-tight min-w-[120px]">
          <span className="font-display text-[13px] font-bold" style={{ color: scn.accent }}>{scn.icon} {scn.court}</span>
          <span className="text-[13px] text-[#cdbd9a]">{isDay ? "☀️" : "🌙"} Day <b className="text-[#e3b95a]">{day}</b>/{g.totalDays} · {String(nHour).padStart(2, "0")}:00</span>
        </div>
        <div className="flex gap-1.5">
          <Chip color="#e3b95a" title="Gold: bribes, recruits, stipends (4/day per agent)">💰 {Math.floor(g.gold)}</Chip>
          <Chip color="#9fd8ff" title="Influence: whispers & rumors. Regenerates.">⚡ {Math.floor(g.infl)}</Chip>
          <Chip color="#e9dcc0" title="Forgeries: needed to Frame">📝 {g.forgeries}</Chip>
        </div>
        <div className="flex flex-1 gap-2 min-w-[260px] items-end">
          <Meter icon="👁" label="Evidence" value={g.evidence} color={g.evidence > 75 ? "#ff3b3b" : g.evidence > 50 ? "#ff9a4d" : "#e0c35a"} title="The Spymaster's case. 100 = exposed and executed." pulse={g.evidence > 75} />
          <Meter icon="🔥" label="Unrest" value={g.unrest} color="#e0704a" title="Unrest shrinks garrisons and raises paranoia." />
          <Meter icon="😨" label="Paranoia" value={g.paranoia} color="#c9a6ff" title="Above 65: nightly purges. Amplifies evidence." />
          <Meter icon="⛪" label="Legit." value={g.legit} color="#e8e8ff" title="Legitimacy: stronger rebels, weaker loyalists." />
          <Meter icon="🛡" label="Succession" value={Math.max(0, daysLeft)} max={g.totalDays} color={daysLeft < 2 ? "#ff3b3b" : "#7aa7c9"} title={`${daysLeft.toFixed(1)} days until the heir is crowned.`} />
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={() => { setUserPaused((p) => !p); sfx("click"); }} className={`btn w-8 h-8 rounded cursor-pointer border ${userPaused ? "bg-[#b3263e] border-[#ff7a8c]" : "bg-[#241c2e] border-[#4a3a2a]"}`} title="Pause (Space)">{userPaused ? "▶" : "⏸"}</button>
          {([1, 2, 3] as const).map(speedBtn)}
          <button onClick={() => setShowWeb((s) => !s)} className={`btn w-8 h-8 rounded cursor-pointer border ${showWeb ? "bg-[#3d2870] border-[#b99aff]" : "bg-[#241c2e] border-[#4a3a2a]"}`} title="Relationship web (W)">🕸</button>
          <button onClick={onToggleMute} className="btn w-8 h-8 rounded cursor-pointer border bg-[#241c2e] border-[#4a3a2a]" title="Mute (M)">{settings.muted ? "🔇" : "🔊"}</button>
          <button onClick={() => { setMenuOpen(true); sfx("click"); }} className="btn h-8 px-2 rounded cursor-pointer border bg-[#241c2e] border-[#4a3a2a] font-display text-xs" title="Menu (Esc)">☰ Menu</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* canvas */}
        <div ref={wrapRef} className="relative flex-1 min-h-[220px] overflow-hidden">
          <canvas
            ref={canvasRef}
            className={g.targeting ? "cursor-crosshair" : "cursor-pointer"}
            onPointerMove={onMove}
            onPointerLeave={() => { view.current.pointerIn = false; view.current.hoverNpc = null; view.current.hoverRoom = null; view.current.hoverSquad = null; }}
            onPointerDown={(e) => { onMove(e); }}
            onClick={(e) => issue(pointerInfo(e), e.shiftKey, false)}
            onContextMenu={(e) => { e.preventDefault(); issue(pointerInfo(e), false, true); }}
          />
          {g.banner && (
            <div key={g.banner.id} className="anim-banner absolute left-1/2 top-3 pointer-events-none text-center px-4 py-2 rounded-lg border bg-black/75 max-w-[92%]" style={{ borderColor: g.banner.color, boxShadow: `0 0 24px ${g.banner.color}55`, zIndex: 20 }}>
              <div className="font-display font-bold text-lg sm:text-2xl" style={{ color: g.banner.color }}>{g.banner.text}</div>
              {g.banner.sub && <div className="text-sm sm:text-base text-[#e9dcc0]">{g.banner.sub}</div>}
            </div>
          )}
          {userPaused && !menuOpen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="font-display text-4xl text-[#e3b95a]/80 tracking-[0.4em] bg-black/40 px-6 py-2 rounded">PAUSED</div></div>
          )}
          {showTut && (
            <div className="absolute left-2 bottom-2 max-w-[330px] rounded-lg border border-[#e3b95a] bg-black/80 p-2 anim-fadeup" style={{ zIndex: 15 }}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-display text-[11px] text-[#e3b95a]">TUTORIAL {Math.min(tutIdx < 0 ? 7 : tutIdx + 1, 7)}/7</span>
                <button className="text-[11px] text-[#8a7d66] cursor-pointer hover:text-white" onClick={() => setTutHidden(true)}>skip ✕</button>
              </div>
              <div className="flex gap-1 mb-1">{tutSteps.map((s, i) => <span key={i} className={`h-1.5 flex-1 rounded ${s.done ? "bg-[#7cff9f]" : i === tutIdx ? "bg-[#e3b95a]" : "bg-[#3c3046]"}`} />)}</div>
              <div className="text-[14px] leading-snug text-[#fff0c8]">{tutIdx < 0 ? "You know the basics. Gather your strength — and strike when the odds look good!" : tutSteps[tutIdx].t}</div>
            </div>
          )}
          {hint && !showTut && (
            <div className="absolute left-2 right-2 bottom-2 text-center text-[13px] sm:text-sm text-[#ffe9b0] bg-black/70 border border-[#5a4a34] rounded px-2 py-1 pointer-events-none" style={{ zIndex: 12 }}>💡 {hint}</div>
          )}
          {g.targeting && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-12 bg-[#2a1d45] border border-[#b99aff] rounded px-3 py-1 text-sm pointer-events-none" style={{ zIndex: 16 }}>🎯 Click a courtier to target · Esc cancels</div>
          )}
        </div>

        {/* sidebar */}
        <aside className="lg:w-[380px] h-[44%] lg:h-auto flex flex-col border-t-2 lg:border-t-0 lg:border-l-2 border-[#4a3a2a] bg-[#120e16] min-h-0">
          <div className="flex border-b border-[#3c3046]">
            {([["intel", "🔎 Intel"], ["agents", `🗝 Agents (${g.agents().length})`], ["coup", g.coup ? "⚔ BATTLE" : "⚔ Coup"], ["log", "📜 Log"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => { sfx("click"); if (k === "coup") openCoupTab(); else setTab(k); }}
                className={`btn flex-1 py-1.5 font-display text-[12px] sm:text-[13px] cursor-pointer border-b-2 ${tab === k ? "border-[#e3b95a] text-[#e3b95a] bg-[#1d1626]" : "border-transparent text-[#a89a80]"} ${k === "coup" && g.coup ? "animate-pulse text-[#ff7a8c]" : ""}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            {tab === "intel" && <IntelTab g={g} />}
            {tab === "agents" && <AgentsTab g={g} />}
            {tab === "coup" && <CoupTab g={g} onLaunch={() => setConfirmCoup(true)} />}
            {tab === "log" && <LogTab g={g} />}
          </div>
        </aside>
      </div>

      {/* event modal */}
      {g.modal && !ended && (
        <Overlay z={60}>
          <Card className="max-w-md w-full p-5 anim-pop">
            <div className="text-5xl text-center">{g.modal.icon}</div>
            <h3 className="font-display text-xl gold-text font-bold text-center mt-1">{g.modal.title}</h3>
            <p className="text-lg text-[#e9dcc0] text-center my-3 leading-snug">{g.modal.text}</p>
            <div className="flex flex-col gap-2">
              {g.modal.choices.map((c, i) => (
                <button key={i} onClick={() => g.chooseModal(i)} className="btn rounded-lg border border-[#6a5538] bg-[#2a2034] hover:border-[#e3b95a] p-2 text-left cursor-pointer">
                  <div className="font-display text-sm font-bold">{c.label}</div>
                  <div className="text-xs text-[#a89a80]">{c.hint}</div>
                </button>
              ))}
            </div>
          </Card>
        </Overlay>
      )}

      {/* coup confirm */}
      {confirmCoup && (() => {
        const f = g.forecast();
        return (
          <Overlay z={65} onBack={() => setConfirmCoup(false)}>
            <Card className="max-w-md w-full p-5 anim-pop">
              <h3 className="font-display text-2xl text-center font-bold text-[#ff7a8c]">Launch the Coup?</h3>
              <p className="text-center text-[#cdbd9a] mt-2">Your agents become squads where they stand. There is no turning back.</p>
              <div className="my-4 text-center">
                <div className="font-display text-3xl font-bold" style={{ color: f.odds > 55 ? "#7cff9f" : f.odds > 30 ? "#ffd27a" : "#ff7a7a" }}>{f.label}</div>
                <div className="text-[#a89a80]">Estimated odds {f.odds}% · ⚑ {f.rebels} vs 🛡 {f.loyal}</div>
                <Bar value={f.odds} color={f.odds > 55 ? "#5fd486" : f.odds > 30 ? "#e3b95a" : "#e04a4a"} h={10} className="mt-2" />
              </div>
              <div className="flex gap-3 justify-center">
                <Btn variant="dark" onClick={() => setConfirmCoup(false)}>Wait</Btn>
                <Btn variant="red" onClick={() => { setConfirmCoup(false); g.launchCoup(); }}>⚔ Strike!</Btn>
              </div>
            </Card>
          </Overlay>
        );
      })()}

      {/* pause menu */}
      {menuOpen && !ended && (
        <Overlay z={70} onBack={() => setMenuOpen(false)}>
          <Card className="max-w-sm w-full p-5 anim-pop">
            <h3 className="font-display text-2xl gold-text font-bold text-center mb-1">Paused</h3>
            <p className="text-center text-sm text-[#8a7d66] mb-3">{scn.name} · {DIFFICULTIES.find((d) => d.id === g.diff.id)?.name}{cfg.mods.length ? ` · ${cfg.mods.map((m) => MODS.find((x) => x.id === m)?.icon).join("")}` : ""}</p>
            <div className="flex flex-col gap-2">
              <Btn onClick={() => setMenuOpen(false)}>▶ Resume</Btn>
              <div className="rounded-lg border border-[#3c3046] p-2">
                <div className="font-display text-[11px] text-[#e3b95a] mb-1">DIFFICULTY (live)</div>
                <div className="grid grid-cols-3 gap-1">
                  {DIFFICULTIES.map((d) => (
                    <button key={d.id} onClick={() => { g.setDifficulty(d.id); sfx("click"); }} className={`btn rounded border py-1 text-xs font-display cursor-pointer ${g.diff.id === d.id ? "bg-[#e3b95a] text-black border-[#ffe9a8]" : "bg-[#241c2e] border-[#4a3a2a]"}`}>{d.name}</button>
                  ))}
                </div>
                <div className="text-[11px] text-[#8a7d66] mt-1">Score multiplier uses the easiest level you used.</div>
              </div>
              <Btn variant="dark" onClick={() => { setHelpOpen(true); }}>📖 Handbook & Controls</Btn>
              <Btn variant="dark" onClick={onSettings}>⚙ Settings & Volume</Btn>
              {confirmRestart ? (
                <div className="flex gap-2 items-center justify-center text-sm"><span>Restart this court?</span><Btn variant="red" className="!py-1 !text-xs" onClick={onRetry}>Yes</Btn><Btn variant="dark" className="!py-1 !text-xs" onClick={() => setConfirmRestart(false)}>No</Btn></div>
              ) : <Btn variant="dark" onClick={() => setConfirmRestart(true)}>↻ Restart</Btn>}
              <Btn variant="ghost" onClick={() => onNav("campaign")}>Abandon → Campaign Map</Btn>
              <Btn variant="ghost" onClick={() => onNav("title")}>Abandon → Title</Btn>
            </div>
          </Card>
        </Overlay>
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* end screen */}
      {showEnd && summary && (
        <Overlay z={75}>
          <Card className={`max-w-2xl w-full max-h-[94vh] overflow-y-auto p-5 anim-pop ${summary.won ? "border-[#e3b95a]" : "border-[#b3263e]"}`}>
            <div className="text-center">
              <div className="text-6xl">{summary.won ? "👑" : "💀"}</div>
              <h2 className={`font-display font-black text-3xl sm:text-4xl mt-1 ${summary.won ? "gold-text" : "text-[#ff4d6a]"}`}>{summary.won ? "VICTORY" : "DEFEAT"}</h2>
              <h3 className="font-display text-lg text-[#e9dcc0]">{summary.title}</h3>
              <p className="text-[#b9ab8c] italic mt-1">{summary.reason}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 text-center">
              {([["Days survived", summary.daysSurvived], ["Recruited", summary.recruited], ["Rooms seized", summary.roomsCaptured], ["Rumors", summary.rumors], ["Arrests caused", summary.arrests], ["Kills", summary.kills], ["Agents lost", summary.lostAgents], ["Peak evidence", `${summary.peakEvidence}%`], ["Eavesdrops", summary.investigations], ["Gold spent", summary.goldSpent], ["Coup time", `${summary.coupTime}s`], ["Multiplier", `×${summary.mult}`]] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-black/30 border border-[#3c3046] p-1.5"><div className="text-[10px] text-[#8a7d66] uppercase">{l}</div><div className="font-display font-bold text-[#e3b95a]">{v}</div></div>
              ))}
            </div>
            <div className="rounded-lg border border-[#3c3046] bg-black/25 p-2 text-sm">
              {summary.breakdown.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-[#a89a80]">{l}</span><span>{v}</span></div>)}
              <div className="flex justify-between border-t border-[#3c3046] mt-1 pt-1 font-display font-bold"><span>Final score (×{summary.mult})</span><span className="text-[#e3b95a]">{summary.score.toLocaleString()}</span></div>
              <div className="flex justify-between font-display font-bold"><span>Seals earned</span><span className="text-[#c9a6ff]">+{summary.seals} 🔱</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <Btn onClick={onRetry}>↻ {summary.won ? "Play Again" : "Retry"}</Btn>
              {summary.won && hasNext && <Btn variant="purple" onClick={() => onNav("next")}>Next Court →</Btn>}
              <Btn variant="dark" onClick={() => onNav("campaign")}>Campaign Map</Btn>
              <Btn variant="ghost" onClick={() => onNav("title")}>Title</Btn>
            </div>
            {summary.won && !hasNext && <p className="text-center text-[#e3b95a] mt-3 font-display text-sm">The final court has fallen. The realm is yours — a Dynasty begins.</p>}
          </Card>
        </Overlay>
      )}
      {ended && !showEnd && g.banner && <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none"><div className="font-display text-4xl sm:text-6xl font-black drop-shadow-lg" style={{ color: g.banner.color }}>{g.banner.text}</div></div>}
    </div>
  );
}
