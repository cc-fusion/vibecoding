import { useEffect, useRef, useState } from "react";
import { Game, type Snap, type EndReport } from "../game/engine";
import type { AudioEngine } from "../game/audio";
import { ENEMIES, RELICS, SPELLS, WEATHER, DIFFICULTIES, MUTATORS, ELEMENT_COLOR } from "../game/data";
import type { Settings } from "../game/save";

export interface RunCfg { difficulty: string; mutators: string[]; tutorial: boolean; key: number }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const RARITY: Record<string, string> = { common: "#9fb4d8", rare: "#6fb0ff", epic: "#d28bff" };

interface Props {
  cfg: RunCfg;
  research: Record<string, number>;
  settings: Settings;
  audio: AudioEngine;
  aether: number;
  modalOpen: boolean;
  onReport: (r: EndReport) => void;
  onQuit: () => void;
  onRetry: () => void;
  onSanctum: () => void;
  openModal: (m: "settings" | "help") => void;
  toggleMute: () => void;
}

function Bar({ value, max, color, h = 10, back = "#0b1224" }: { value: number; max: number; color: string; h?: number; back?: string }) {
  const f = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full border border-white/10" style={{ height: h, background: back }}>
      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${f * 100}%`, background: color }} />
    </div>
  );
}

export default function GameView(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [hover, setHover] = useState<string>("");
  const snapRef = useRef<Snap | null>(null);
  const propsRef = useRef(p);
  propsRef.current = p;
  snapRef.current = snap;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const g = new Game(
      canvas,
      p.audio,
      { difficulty: p.cfg.difficulty, mutators: p.cfg.mutators, research: p.research, tutorial: p.cfg.tutorial },
      () => propsRef.current.settings,
      { ui: (s) => setSnap(s), onEnd: (r) => propsRef.current.onReport(r) },
    );
    gameRef.current = g;
    const doResize = () => {
      const r = wrap.getBoundingClientRect();
      g.resize(Math.max(50, r.width), Math.max(50, r.height), Math.min(2, window.devicePixelRatio || 1));
    };
    doResize();
    const ro = new ResizeObserver(doResize);
    ro.observe(wrap);
    const onKey = (e: KeyboardEvent) => {
      if (propsRef.current.modalOpen) return;
      const s = snapRef.current;
      if (s && s.phase === "relic") {
        const idx = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
        if (idx >= 0 && s.draft[idx]) g.chooseRelic(s.draft[idx]);
        return;
      }
      if (["Space", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].includes(e.code)) e.preventDefault();
      g.onKey(e);
    };
    const onBlur = () => {
      if (propsRef.current.settings.autoPause) g.setPaused(true);
    };
    const onVis = () => {
      if (document.hidden) onBlur();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    g.start();
    setSnap(g.snapshot());
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cfg.key]);

  // pause while modal is open
  useEffect(() => {
    const g = gameRef.current;
    if (g && p.modalOpen) g.setPaused(true);
  }, [p.modalOpen]);

  const g = gameRef.current;
  const pdown = (e: React.PointerEvent) => {
    const gm = gameRef.current;
    if (!gm) return;
    p.audio.init();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const w = gm.toWorld(e.clientX, e.clientY);
    gm.pointerDown(w.x, w.y, e.button);
  };
  const pmove = (e: React.PointerEvent) => {
    const gm = gameRef.current;
    if (!gm) return;
    const w = gm.toWorld(e.clientX, e.clientY);
    gm.pointerMove(w.x, w.y);
  };

  const s = snap;
  const quit = () => { gameRef.current?.abandon(); p.onQuit(); };
  const retry = () => { gameRef.current?.abandon(); p.onRetry(); };
  const sanctum = () => { gameRef.current?.abandon(); p.onSanctum(); };

  const toolInfo = (id: string) => {
    if (id === "wall") return { name: "Raise Wall", desc: `Click or drag to raise stone walls (${s?.wallCost ?? 2} stone each). Click a damaged wall to reinforce it for 1 stone. Right-click removes walls.` };
    if (id === "dig") return { name: "Dig", desc: "Click or drag to remove walls and refund some stone. (Right-click always digs.)" };
    const sp = SPELLS.find((x) => x.id === id);
    return sp ? { name: sp.name, desc: sp.desc } : { name: "", desc: "" };
  };
  const info = s ? toolInfo(hover || s.tool) : { name: "", desc: "" };
  const weather = s ? WEATHER[s.weather] : WEATHER.clear;
  const nextWeather = s ? WEATHER[s.nextWeather] : WEATHER.clear;
  const live = !!s && (s.phase === "prep" || s.phase === "wave");

  return (
    <div className="relative flex h-full w-full flex-col bg-[#070b14]">
      {/* top HUD */}
      <div className="z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 bg-[#0a1122]/95 px-3 py-1.5 text-sm">
        <div className="flex min-w-[170px] flex-1 items-center gap-2" title="Gate health. If it falls, the run is lost.">
          <span className="text-lg">🏰</span>
          <div className="flex-1">
            <Bar value={s?.gate ?? 0} max={s?.gateMax ?? 1} h={12} color={s && s.gate / s.gateMax < 0.3 ? "linear-gradient(90deg,#ff5a5a,#ff8a8a)" : "linear-gradient(90deg,#4fd08a,#9cf0b8)"} />
          </div>
          <span className="w-14 text-right font-bold tabular-nums">{s?.tutorial ? "∞" : `${Math.ceil(s?.gate ?? 0)}/${s?.gateMax ?? 0}`}</span>
        </div>
        <div className="font-title text-base font-bold text-sky-100">
          {s?.tutorial ? "Training" : s?.wave ? `Wave ${s.wave}${s.endless ? " ∞" : `/${s.maxWave}`}` : "Prepare"}
        </div>
        <div className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5" title={`${weather.name}: ${weather.desc}`}>
          <span className="text-lg">{weather.icon}</span>
          <span className="hidden text-xs text-slate-300 sm:inline">{weather.name}</span>
        </div>
        {s && !s.tutorial && (
          <div className="flex items-center gap-1 text-xs text-slate-400" title={`Next wave's weather: ${nextWeather.name}. ${nextWeather.desc}`}>
            next <span className="text-lg">{nextWeather.icon}</span>
          </div>
        )}
        <div className="flex items-center gap-1 font-bold tabular-nums text-stone-200" title="Stone for walls. Regenerates slowly; kills yield more.">
          🪨 {Math.floor(s?.stone ?? 0)}<span className="text-xs text-slate-400">/{s?.stoneCap}</span>
        </div>
        <div className="hidden text-xs text-slate-300 md:block">Score <b className="text-amber-200">{(s?.score ?? 0).toLocaleString()}</b> · Foes left <b>{s?.left ?? 0}</b></div>
        <div className="ml-auto flex items-center gap-1">
          <button className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/15" title="Game speed (F)" onClick={() => g?.toggleSpeed()}>⏩{s?.speed === 2 ? "×2" : "×1"}</button>
          <button className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/15" title="Mute (M)" onClick={p.toggleMute}>{p.settings.muted ? "🔇" : "🔊"}</button>
          <button className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/15" title="Help" onClick={() => p.openModal("help")}>❓</button>
          <button className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/15" title="Pause (Esc)" onClick={() => g?.setPaused(true)}>⏸</button>
        </div>
      </div>

      {/* canvas area */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={pdown}
          onPointerMove={pmove}
          onPointerUp={() => gameRef.current?.pointerUp()}
          onPointerCancel={() => gameRef.current?.pointerLeave()}
          onPointerLeave={() => gameRef.current?.pointerLeave()}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* boss bar */}
        {s?.boss && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 w-[min(560px,90%)] -translate-x-1/2 fade-in">
            <div className="panel px-3 py-1.5">
              <div className="flex items-center justify-between text-sm font-bold text-red-200"><span>{s.boss.icon} {s.boss.name}</span>
                {s.boss.ward && <span style={{ color: ELEMENT_COLOR[s.boss.ward] }}>Ward: {s.boss.ward.toUpperCase()} · weak to {s.boss.weak.toUpperCase()}</span>}
                {s.boss.weak === "frozen" && <span className="text-cyan-200">Freeze it to break its Stone Hide</span>}
              </div>
              <Bar value={s.boss.hp} max={1} h={12} color="linear-gradient(90deg,#d94a4a,#ff9a6a)" />
            </div>
          </div>
        )}

        {/* prep panel */}
        {s && s.phase === "prep" && !s.tutorial && !s.paused && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2" style={{ marginTop: s.boss ? 60 : 0 }}>
            <div className="panel pop-in pointer-events-auto flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm">
              <div>
                <div className="font-title font-bold text-sky-100">
                  Wave {s.wave + 1} {s.nextBoss && <span className="text-red-300">— BOSS: {ENEMIES[s.nextBoss].name}</span>}
                </div>
                <div className="text-xs text-slate-400">arrives in <b className="text-amber-200">{Math.max(0, Math.ceil(s.prepT))}s</b> · {nextWeather.icon} {nextWeather.name}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.forecast).map(([k, n]) => (
                  <span key={k} title={`${ENEMIES[k].name}: ${ENEMIES[k].tip}`} className="rounded-md bg-white/10 px-1.5 py-0.5 text-sm">{ENEMIES[k].icon}×{n}</span>
                ))}
              </div>
              <button className="btn gold !px-4 !py-1.5 text-sm" onClick={() => g?.callWave()}>Call Wave (Space)</button>
            </div>
          </div>
        )}

        {/* tutorial */}
        {s?.tutorial && !s.paused && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 w-[min(380px,92%)]">
            <div className="panel pop-in pointer-events-auto p-3" key={s.tutStep}>
              <div className="mb-1 flex items-center justify-between">
                <div className="font-title text-lg font-bold text-amber-200">{s.tutTitle}</div>
                <div className="flex gap-1">{Array.from({ length: s.tutTotal }).map((_, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < s.tutStep ? "#7fe0a0" : i === s.tutStep ? "#ffe29a" : "#33405f" }} />)}</div>
              </div>
              <div className="text-sm leading-snug text-slate-200">{s.tutText}</div>
              <div className="mt-2 flex gap-2">
                {s.tutDone ? <button className="btn primary !px-4 !py-1 text-sm" onClick={quit}>Finish Training ✔</button> : <button className="btn !px-3 !py-1 text-xs" onClick={quit}>Skip tutorial</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* tool info strip */}
      <div className="z-20 flex min-h-[26px] items-center gap-2 border-t border-white/10 bg-[#0a1122]/95 px-3 py-1 text-xs text-slate-300">
        <b className="text-sky-200">{info.name}</b><span className="truncate">{info.desc}</span>
      </div>

      {/* toolbar */}
      <div className="z-20 flex flex-wrap items-stretch justify-center gap-2 border-t border-white/10 bg-[#0a1122]/95 px-2 py-2">
        <div className="flex w-[170px] flex-col justify-center gap-1 px-1">
          <div className="flex items-center justify-between text-xs"><span className="text-sky-300">💧 Mana</span><b className="tabular-nums">{Math.floor(s?.mana ?? 0)}/{s?.manaMax}</b></div>
          <Bar value={s?.mana ?? 0} max={s?.manaMax ?? 1} color="linear-gradient(90deg,#3d7bff,#7fc4ff)" h={12} />
          <div className="text-[11px] text-violet-300" title="Cast different elements in a row for bonus damage. Repeating an element resets it.">
            🎶 Harmony {s?.harmony ?? 0}/{s?.harmonyCap ?? 0}
          </div>
        </div>
        <Tool active={s?.tool === "wall"} icon="🧱" k="Q" label="Wall" sub={`${s?.wallCost ?? 2}🪨`} onClick={() => g?.selectTool("wall")} onHover={(h) => setHover(h ? "wall" : "")} />
        <Tool active={s?.tool === "dig"} icon="⛏️" k="E" label="Dig" sub="refund" onClick={() => g?.selectTool("dig")} onHover={(h) => setHover(h ? "dig" : "")} />
        <div className="mx-1 w-px bg-white/10" />
        {SPELLS.map((sp) => {
          const unlocked = !!s?.unlocked.includes(sp.id);
          const cost = s?.cost[sp.id] ?? sp.cost;
          return (
            <Tool key={sp.id} active={s?.tool === sp.id} locked={!unlocked} icon={unlocked ? sp.icon : "🔒"} k={sp.key} label={sp.name.split(" ")[0]}
              sub={unlocked ? `${cost}💧` : "Sanctum"} color={sp.color} cd={s?.cd[sp.id] ?? 0} poor={unlocked && (s?.mana ?? 0) < cost}
              onClick={() => g?.selectTool(sp.id)} onHover={(h) => setHover(h ? sp.id : "")} />
          );
        })}
        <div className="mx-1 w-px bg-white/10" />
        <button
          onClick={() => g?.castTempest()}
          title="Tempest Call (R): rain, freeze and lightning across the whole pass. Fill the meter with reactions and kills."
          className={`relative flex w-[104px] flex-col items-center justify-center overflow-hidden rounded-lg border px-2 py-1 text-xs transition ${s && s.tempest >= 100 ? "pulse-glow border-amber-300 bg-amber-400/20" : "border-white/15 bg-white/5"}`}
        >
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yellow-300/40 to-transparent" style={{ height: `${s?.tempestT ? 100 : s?.tempest ?? 0}%` }} />
          <span className="relative text-xl">🌩️</span>
          <span className="relative font-bold">{s?.tempestT ? `${s.tempestT.toFixed(1)}s` : `Tempest ${Math.floor(s?.tempest ?? 0)}%`}</span>
          <span className="relative text-[10px] text-slate-400">R</span>
        </button>
      </div>

      {/* relic bar (owned) */}
      {s && s.relics.length > 0 && (
        <div className="pointer-events-none absolute right-2 top-14 z-10 flex max-w-[40%] flex-wrap justify-end gap-1">
          {s.relics.map((id) => {
            const r = RELICS.find((x) => x.id === id);
            return r ? <span key={id} title={`${r.name}: ${r.desc}`} className="pointer-events-auto rounded-md border bg-black/50 px-1 text-lg" style={{ borderColor: RARITY[r.rarity] }}>{r.icon}</span> : null;
          })}
        </div>
      )}

      {/* relic draft */}
      {s?.phase === "relic" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-3 fade-in">
          <div className="w-full max-w-4xl text-center">
            <h2 className="font-title text-3xl font-bold text-amber-200">{s.wave > 0 ? `Wave ${s.wave} Repelled` : "Begin with a Boon"}</h2>
            <p className="mb-4 text-slate-300">Choose a relic to carry through the rest of this run. <span className="text-slate-500">(keys 1-3)</span></p>
            <div className="grid gap-3 sm:grid-cols-3">
              {s.draft.map((id, i) => {
                const r = RELICS.find((x) => x.id === id)!;
                return (
                  <button key={id} onClick={() => g?.chooseRelic(id)} className="panel pop-in p-4 text-left transition hover:-translate-y-2 hover:brightness-125" style={{ borderColor: RARITY[r.rarity], boxShadow: `0 0 24px ${RARITY[r.rarity]}33`, animationDelay: `${i * 90}ms` }}>
                    <div className="text-5xl">{r.icon}</div>
                    <div className="font-title mt-2 text-lg font-bold text-slate-50">{r.name}</div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: RARITY[r.rarity] }}>{r.rarity}</div>
                    <div className="text-sm text-slate-300">{r.desc}</div>
                  </button>
                );
              })}
            </div>
            <button className="btn mt-4" onClick={() => g?.chooseRelic("provisions")}>🍞 Take provisions instead (+5 gate, +30 stone, full mana)</button>
          </div>
        </div>
      )}

      {/* pause */}
      {s?.paused && !p.modalOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-3 fade-in">
          <div className="panel pop-in flex w-full max-w-sm flex-col gap-3 p-6 text-center">
            <h2 className="font-title text-3xl font-bold text-sky-100">Paused</h2>
            <button className="btn primary" onClick={() => g?.setPaused(false)}>▶ Resume</button>
            <button className="btn" onClick={() => p.openModal("settings")}>⚙️ Settings</button>
            <button className="btn" onClick={() => p.openModal("help")}>❓ Help & Controls</button>
            <button className="btn" onClick={retry}>↻ Restart Run</button>
            <button className="btn danger" onClick={quit}>⌂ Abandon to Title</button>
          </div>
        </div>
      )}

      {/* result */}
      {s?.result && <ResultView s={s} onRetry={retry} onQuit={quit} onSanctum={sanctum} onContinue={() => g?.continueEndless()} aether={p.aether} />}
      {!live && !s?.result && s?.phase !== "relic" && null}
    </div>
  );
}

function Tool(props: {
  active?: boolean; locked?: boolean; poor?: boolean; icon: string; k: string; label: string; sub: string; color?: string; cd?: number;
  onClick: () => void; onHover: (h: boolean) => void;
}) {
  const c = props.color || "#bcd0ff";
  return (
    <button
      onClick={props.onClick}
      onPointerEnter={() => props.onHover(true)}
      onPointerLeave={() => props.onHover(false)}
      className={`relative flex w-[74px] flex-col items-center justify-center overflow-hidden rounded-lg border px-1 py-1 text-xs transition hover:-translate-y-0.5 ${props.active ? "scale-105" : ""} ${props.locked ? "opacity-45" : ""}`}
      style={{ borderColor: props.active ? c : "rgba(255,255,255,0.15)", background: props.active ? c + "30" : "rgba(255,255,255,0.05)", boxShadow: props.active ? `0 0 16px ${c}66` : "none" }}
    >
      {!!props.cd && props.cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/60" style={{ height: `${props.cd * 100}%` }} />}
      <span className="absolute left-1 top-0.5 text-[10px] font-bold text-slate-400">{props.k}</span>
      <span className="relative text-2xl leading-7">{props.icon}</span>
      <span className="relative max-w-full truncate font-semibold text-slate-100">{props.label}</span>
      <span className={`relative text-[10px] ${props.poor ? "text-red-300" : "text-slate-400"}`}>{props.sub}</span>
    </button>
  );
}

function ResultView({ s, onRetry, onQuit, onSanctum, onContinue, aether }: { s: Snap; onRetry: () => void; onQuit: () => void; onSanctum: () => void; onContinue: () => void; aether: number }) {
  const r = s.result!;
  const win = r.kind === "victory";
  const d = DIFFICULTIES.find((x) => x.id === r.difficulty);
  const reacts = Object.entries(r.stats.reactions).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const row = (k: string, v: string | number) => (
    <div className="flex justify-between border-b border-white/5 py-1"><span className="text-slate-400">{k}</span><b className="tabular-nums text-slate-100">{v}</b></div>
  );
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-3 fade-in">
      <div className="panel pop-in w-full max-w-3xl p-5">
        <div className="text-center">
          <div className="text-5xl">{win ? "🏆" : "💀"}</div>
          <h2 className={`font-title text-4xl font-black ${win ? "text-amber-200" : "text-red-300"}`}>{win ? "The Pass Holds!" : "The Gate Has Fallen"}</h2>
          <p className="text-slate-300">{win ? "The armies are broken and the storm calms. You may press on into Endless mode." : `You held out until wave ${r.wave}. The mountain remembers.`}</p>
        </div>
        <div className="mt-4 grid gap-x-8 text-sm sm:grid-cols-2">
          <div>
            {row("Difficulty", d?.name ?? r.difficulty)}
            {row("Mutators", r.mutators.length ? r.mutators.map((m) => MUTATORS.find((x) => x.id === m)?.icon).join(" ") : "none")}
            {row("Wave reached", r.wave)}
            {row("Time survived", fmtTime(r.stats.time))}
            {row("Score", r.score.toLocaleString())}
            {row("Foes slain", r.stats.kills)}
            {row("Bosses felled", r.stats.bossKills)}
          </div>
          <div>
            {row("Damage dealt", Math.round(r.stats.damage).toLocaleString())}
            {row("Spells cast", r.stats.spells)}
            {row("Walls raised / lost", `${r.stats.wallsBuilt} / ${r.stats.wallsLost}`)}
            {row("Gate breaches", r.stats.breaches)}
            {row("Peak Harmony", r.stats.peakHarmony)}
            {row("Tempests called", r.stats.tempests)}
            {row("Waves cleared", r.stats.wavesCleared)}
          </div>
        </div>
        {reacts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {reacts.map(([n, c]) => <span key={n} className="rounded-full bg-sky-500/15 px-3 py-1 text-sky-100">{n} ×{c}</span>)}
          </div>
        )}
        {r.relics.length > 0 && <div className="mt-3 text-sm text-slate-300">Relics: {r.relics.map((id) => RELICS.find((x) => x.id === id)?.icon).join(" ")}</div>}
        <div className="mt-4 rounded-lg bg-amber-300/10 p-3 text-center text-amber-100">
          🔮 <b>{r.aether} Aether</b> earned this run · <span className="text-amber-200">Sanctum balance: {aether}</span>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {win && <button className="btn gold" onClick={onContinue}>♾ Continue (Endless)</button>}
          <button className="btn primary" onClick={onRetry}>↻ {win ? "New Run" : "Try Again"}</button>
          <button className="btn" onClick={onSanctum}>🔮 Sanctum</button>
          <button className="btn" onClick={onQuit}>⌂ Title</button>
        </div>
      </div>
    </div>
  );
}
