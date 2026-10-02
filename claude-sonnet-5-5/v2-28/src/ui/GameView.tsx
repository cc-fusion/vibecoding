import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Game } from "../game/engine";
import type { HudState } from "../game/engine";
import { PESTS, SPELLS, STRUCTS, TUTORIAL } from "../game/data";
import type { ToolId } from "../game/data";
import { audio } from "../game/audio";
import { getSave, updateSave } from "../game/save";
import { Btn, Help, Panel, SettingsPanel } from "./Screens";

const noFocus = { tabIndex: -1, onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

const EVENT_ICON: Record<string, string> = { drizzle: "🌦️", heatwave: "🥵", coldsnap: "🥶", thunder: "⛈️", gale: "🌪️" };

function Bar({ f, from, to, children }: { f: number; from: string; to: string; children?: ReactNode }) {
  return (
    <div className="relative h-5 w-full min-w-24 overflow-hidden rounded-full border border-white/20 bg-black/50">
      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, background: `linear-gradient(90deg,${from},${to})` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow">{children}</div>
    </div>
  );
}

const BLANK: HudState = {
  gold: 0, mana: 0, maxMana: 100, wave: 0, winWave: 12, waveState: "prep", prepT: 0, remaining: 0, alive: 24, total: 24, combo: 0, comboFrac: 0,
  forecast: "Calm skies", eventName: null, wind: { x: 0, y: 0 }, tool: null, cds: {}, spells: [], structs: [], sel: null, paused: false, over: null,
  summary: null, boss: null, score: 0, tutStep: -1, tutText: "", speed: 1, preview: [], previewTotal: 0, previewBoss: false, difficulty: "farmer",
  toast: "", endless: false, night: 0,
};

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function GameView({ difficulty, mods, tutorial, onExit }: { difficulty: string; mods: string[]; tutorial: boolean; onExit: (to: "title" | "research" | "restart") => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(BLANK);
  const [menu, setMenu] = useState<"main" | "settings" | "help">("main");
  const [hover, setHover] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    audio.init();
    audio.setVolumes(getSave().settings);
    audio.startMusic();
    const g = new Game(cv, { difficulty, mods, tutorial, onHud: setHud });
    gameRef.current = g;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
      ro = new ResizeObserver(() => g.resize());
      ro.observe(wrapRef.current);
    }
    return () => {
      ro?.disconnect();
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hud && !hud.paused) setMenu("main");
  }, [hud?.paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = gameRef.current;

  const settings = getSave().settings;
  const toolInfo = (id: string | null) => {
    if (!id) return null;
    const sp = SPELLS.find((s) => s.id === id);
    if (sp) return { name: sp.name, desc: sp.desc, meta: `Aether ${sp.cost} · cooldown ${sp.cd}s · key ${sp.key}` };
    const st = STRUCTS.find((s) => s.id === id);
    if (st) return { name: st.name, desc: st.desc, meta: `${st.cost} gold · key ${st.key}` };
    return null;
  };
  const info = toolInfo(hover || hud.tool);
  const windSpd = Math.hypot(hud.wind.x, hud.wind.y);
  const windAng = (Math.atan2(hud.wind.y, hud.wind.x) * 180) / Math.PI;
  const vit = hud.total ? hud.alive / hud.total : 0;
  const danger = hud.alive <= Math.floor(hud.total * 0.2) + 3;

  const toolBtn = (id: ToolId, unlocked: boolean, icon: string, key: string, cost: string, afford: boolean, cd: number, color: string, name: string) => (
    <button
      key={id}
      {...noFocus}
      onClick={() => g?.setTool(hud.tool === id ? null : id)}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(null)}
      title={name}
      className={"relative flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 text-xl transition active:scale-95 md:h-16 md:w-16 " + (hud.tool === id ? "scale-105 bg-white/25" : "bg-white/5 hover:bg-white/15") + (unlocked ? "" : " opacity-40 grayscale")}
      style={{ borderColor: hud.tool === id ? color : "rgba(255,255,255,0.2)", boxShadow: hud.tool === id ? `0 0 14px ${color}` : "none" }}
    >
      <span className="leading-none">{unlocked ? icon : "🔒"}</span>
      <span className={"mt-0.5 text-[10px] font-bold leading-none " + (afford ? "text-white" : "text-rose-300")}>{cost}</span>
      <span className="absolute left-1 top-0.5 text-[9px] font-bold text-white/60">{key}</span>
      {cd > 0 && <span className="absolute inset-x-0 bottom-0 bg-black/60" style={{ height: `${cd * 100}%` }} />}
    </button>
  );

  const sum = hud.summary;
  const tally = sum ? Object.entries(sum.tally).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="relative flex h-full w-full flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs md:text-sm">
        <div className="flex items-center gap-1 font-black text-amber-300" title="Gold">🪙 <span className="w-12 text-base md:text-lg">{hud.gold}</span></div>
        <div className="w-32 md:w-44" title="Aether (spell mana)"><Bar f={hud.mana / hud.maxMana} from="#6a5cff" to="#47c9ff">⚡ {Math.floor(hud.mana)}/{hud.maxMana}</Bar></div>
        <div className="w-28 md:w-40" title="Farm vitality: crops alive"><Bar f={vit} from={danger ? "#ff5a4a" : "#3fbf5a"} to={danger ? "#ff9a4a" : "#a8e05a"}>🌾 {hud.alive}/{hud.total}</Bar></div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sky-200">Wave {hud.wave}{hud.endless ? " ∞" : "/" + hud.winWave}</span>
          {hud.waveState === "prep" ? (
            <>
              <span className="text-slate-300">{hud.prepT > 9000 ? "Waiting…" : `Next in ${Math.max(0, Math.ceil(hud.prepT))}s`}</span>
              <button {...noFocus} onClick={() => g?.callWave()} className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-black text-white shadow hover:bg-emerald-400 active:scale-95">▶ Call Wave</button>
            </>
          ) : (
            <span className="text-rose-300">🐛 {hud.remaining} left</span>
          )}
        </div>
        <div className="flex items-center gap-2" title="Reaction combo">
          <span className={"font-black " + (hud.combo > 1 ? "text-yellow-300" : "text-slate-500")}>🔗 x{hud.combo}</span>
          <div className="h-1.5 w-12 overflow-hidden rounded bg-black/50"><div className="h-full bg-yellow-300" style={{ width: `${hud.comboFrac * 100}%` }} /></div>
        </div>
        <div className="flex items-center gap-2" title="Weather forecast and wind">
          <span className="text-base">{hud.eventName ? EVENT_ICON[hud.eventName] : "🌤️"}</span>
          <span className={hud.eventName || hud.forecast !== "Calm skies" ? "font-bold text-orange-300" : "text-slate-400"}>{hud.forecast}</span>
          <span className="flex items-center gap-1 text-slate-300"><span style={{ display: "inline-block", transform: `rotate(${windAng}deg)`, opacity: Math.min(1, 0.25 + windSpd / 60) }}>➤</span>{Math.round(windSpd / 4)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-bold text-slate-300">★ {hud.score}</span>
          <button {...noFocus} onClick={() => g?.toggleSpeed()} className={"rounded-lg px-2 py-1 text-xs font-black " + (hud.speed === 2 ? "bg-amber-400 text-slate-900" : "bg-white/10")} title="Fast forward (F)">⏩ x{hud.speed}</button>
          <button
            {...noFocus}
            onClick={() => {
              const s = updateSave((d) => { d.settings.muted = !d.settings.muted; });
              audio.setVolumes(s.settings);
              force((x) => x + 1);
            }}
            className="rounded-lg bg-white/10 px-2 py-1 text-xs"
            title="Mute (M)"
          >{settings.muted ? "🔇" : "🔊"}</button>
          <button {...noFocus} onClick={() => g?.setPaused(true)} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold" title="Pause (P)">⏸</button>
        </div>
      </div>

      {/* Field */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="block touch-none" />
        {hud.tutStep >= 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
            <div className="pointer-events-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-300/60 bg-slate-900/90 p-3 text-sm shadow-xl">
              <div className="text-2xl">🎓</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Tutorial {Math.min(hud.tutStep + 1, TUTORIAL.length)}/{TUTORIAL.length}</div>
                <div className="text-slate-100">{hud.tutText}</div>
              </div>
              <button {...noFocus} onClick={() => g?.skipTutorial()} className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Skip</button>
            </div>
          </div>
        )}
        {hud.boss && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-4" style={{ top: hud.tutStep >= 0 ? 110 : 8 }}>
            <div className="w-full max-w-md">
              <div className="mb-0.5 text-center text-xs font-black uppercase tracking-widest text-rose-300 drop-shadow">{hud.boss.name}</div>
              <div className="h-3 overflow-hidden rounded-full border border-rose-200/50 bg-black/60"><div className="h-full bg-gradient-to-r from-rose-600 to-orange-400" style={{ width: `${hud.boss.frac * 100}%` }} /></div>
            </div>
          </div>
        )}
        {hud.waveState === "prep" && hud.tutStep < 0 && (
          <div className="pointer-events-none absolute right-2 top-2 max-w-48 rounded-xl border border-white/15 bg-slate-900/80 p-2 text-xs">
            <div className="font-bold text-sky-200">Next: Wave {hud.wave + 1}</div>
            {hud.previewBoss && <div className="font-black text-rose-300">⚠ BOSS INCOMING</div>}
            {getSave().owned.includes("almanac") ? (
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                {hud.preview.map((p) => <span key={p.kind}>{PESTS[p.kind].emoji}×{p.count}</span>)}
              </div>
            ) : (
              <div className="text-slate-300">~{hud.previewTotal} pests <span className="text-slate-500">(Almanac research reveals types)</span></div>
            )}
          </div>
        )}
        {hud.sel && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/90 p-2 text-xs shadow-xl">
            <div>
              <div className="font-black text-white">{hud.sel.name}</div>
              <div className="text-amber-300">Level {hud.sel.lvl}/3</div>
            </div>
            {hud.sel.lvl < 3 && <button {...noFocus} onClick={() => g?.upgrade()} className={"rounded-lg px-2 py-1 font-bold " + (hud.gold >= hud.sel.upCost ? "bg-emerald-500" : "bg-slate-600 text-slate-300")}>⬆ {hud.sel.upCost}g (U)</button>}
            {hud.sel.canRotate && <button {...noFocus} onClick={() => g?.rotate()} className="rounded-lg bg-sky-500 px-2 py-1 font-bold">↻ Rotate (R)</button>}
            <button {...noFocus} onClick={() => g?.sell()} className="rounded-lg bg-rose-500 px-2 py-1 font-bold">Sell +{hud.sel.sell}g (X)</button>
          </div>
        )}
        {hud.toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="rounded-full border border-white/20 bg-black/75 px-4 py-1.5 text-sm font-bold text-amber-100">{hud.toast}</div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-stretch gap-x-4 gap-y-1 border-t border-white/10 bg-slate-900/95 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {SPELLS.map((s) => toolBtn(s.id, hud.spells.includes(s.id), s.icon, s.key, `${s.cost}⚡`, hud.mana >= s.cost, hud.cds[s.id] || 0, s.color, s.name))}
        </div>
        <div className="w-px bg-white/15" />
        <div className="flex gap-1.5 overflow-x-auto">
          {STRUCTS.map((s) => toolBtn(s.id, hud.structs.includes(s.id), s.icon, s.key, `${s.cost}g`, hud.gold >= s.cost, 0, s.color, s.name))}
        </div>
        <div className="min-w-48 flex-1 text-xs">
          {info ? (
            <>
              <div className="font-black text-amber-200">{info.name} <span className="font-normal text-slate-400">{info.meta}</span></div>
              <div className="text-slate-300">{info.desc}</div>
            </>
          ) : (
            <div className="text-slate-400">Select a spell (1-5) or structure (6-0). Click a built structure to upgrade or sell it. Right-click clears your tool.</div>
          )}
        </div>
      </div>

      {/* Pause */}
      {hud.paused && !hud.over && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm">
          {menu === "main" && (
            <Panel className="flex w-72 flex-col gap-3 p-6 text-center">
              <h2 className="text-3xl font-black text-amber-100">Paused</h2>
              <Btn onClick={() => g?.setPaused(false)}>▶ Resume</Btn>
              <Btn kind="ghost" onClick={() => setMenu("settings")}>⚙ Settings</Btn>
              <Btn kind="ghost" onClick={() => setMenu("help")}>📖 How to Play</Btn>
              <Btn kind="ghost" onClick={() => onExit("restart")}>↻ Restart Run</Btn>
              <Btn kind="danger" onClick={() => onExit("title")}>⌂ Quit to Title</Btn>
              <div className="text-xs text-slate-400">Wave {hud.wave} · Score {hud.score}</div>
            </Panel>
          )}
          {menu === "settings" && <SettingsPanel inGame difficulty={hud.difficulty} onDifficulty={(id) => g?.setDifficulty(id)} onClose={() => setMenu("main")} />}
          {menu === "help" && <Help onClose={() => setMenu("main")} />}
        </div>
      )}

      {/* End screens */}
      {hud.over && sum && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
          <Panel className="w-full max-w-lg p-6 text-center">
            <div className="text-5xl">{hud.over === "victory" ? "🏆" : "🥀"}</div>
            <h2 className={"text-4xl font-black " + (hud.over === "victory" ? "text-amber-200" : "text-rose-300")}>{hud.over === "victory" ? "Harvest Saved!" : "The Farm Has Fallen"}</h2>
            <p className="mb-3 text-sm text-slate-300">{hud.over === "victory" ? "You weathered all 12 waves and felled the Locust Queen. The village feasts tonight!" : "Too many fields were lost. The pests have won this season…"}</p>
            <div className="grid grid-cols-2 gap-2 text-left text-sm sm:grid-cols-3">
              {[
                ["Waves cleared", sum.waves],
                ["Score", sum.score],
                ["Time", fmtTime(sum.time)],
                ["Pests defeated", sum.kills],
                ["Crops harvested", sum.harvested],
                ["Crops lost", sum.cropsLost],
                ["Reactions", sum.reactions],
                ["Best combo", "x" + sum.maxCombo],
                ["Bosses felled", sum.bossKills],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-white/5 px-3 py-1.5"><div className="text-[10px] uppercase tracking-wider text-slate-400">{k}</div><div className="font-black text-white">{v}</div></div>
              ))}
            </div>
            {tally.length > 0 && <div className="mt-2 text-xs text-slate-300">Reactions: {tally.slice(0, 4).map(([n, c]) => `${n} ×${c}`).join(" · ")}</div>}
            <div className="mt-3 rounded-xl bg-amber-300/15 px-3 py-2 text-lg font-black text-amber-200">🌱 +{sum.seeds} seeds earned</div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {hud.over === "victory" && <Btn kind="gold" onClick={() => g?.continueEndless()}>♾ Continue (Endless)</Btn>}
              <Btn onClick={() => onExit("restart")}>{hud.over === "victory" ? "New Season" : "↻ Retry"}</Btn>
              <Btn kind="ghost" onClick={() => onExit("research")}>🌱 Research</Btn>
              <Btn kind="ghost" onClick={() => onExit("title")}>⌂ Title</Btn>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
