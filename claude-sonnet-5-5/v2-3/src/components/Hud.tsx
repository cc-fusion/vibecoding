import { useEffect, useRef } from "react";
import type { Game } from "../game/engine";
import { TUT_STEPS } from "../game/engine";
import { DAY_LEN, LM, MAP_R, TERRAIN } from "../game/data";
import { clamp, hexDist, toPixel } from "../game/hex";
import { audio } from "../game/audio";
import { writeSave } from "../game/save";
import { Bar, Kbd } from "./ui";

function Minimap({ g }: { g: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const span = MAP_R * 2 + 1.6;
    const s = Math.min(W / (span * 1.732), H / (span * 1.5)) * 0.58;
    const cx = W / 2, cy = H / 2;
    for (const t of g.tiles) {
      const p = toPixel(t.q, t.r, s * 1.15);
      const x = cx + p.x, y = cy + p.y;
      if (t.state === 0) ctx.fillStyle = "rgba(255,255,255,0.05)";
      else if (t.erased) ctx.fillStyle = "#050302";
      else if (t.state === 1) ctx.fillStyle = TERRAIN[t.seen].color + "66";
      else ctx.fillStyle = TERRAIN[t.terrain].color;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      if (t.state === 2 && t.feature?.kind === "landmark" && t.ls.disc) {
        ctx.fillStyle = t.feature.id === "spire" ? "#c07bd8" : t.feature.id === "sigil" ? "#ffd36a" : "#fff";
        ctx.beginPath();
        ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const sp = toPixel(g.spire.q, g.spire.r, s * 1.15);
    ctx.strokeStyle = "#c07bd8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + sp.x, cy + sp.y, s * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    const pp = toPixel(g.p.q, g.p.r, s * 1.15);
    ctx.fillStyle = "#ff5040";
    ctx.beginPath();
    ctx.arc(cx + pp.x, cy + pp.y, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  return <canvas ref={ref} width={150} height={150} className="w-[110px] h-[110px] sm:w-[150px] sm:h-[150px] rounded-md" />;
}

export function Hud({ g }: { g: Game }) {
  const night = g.isNight();
  const phase = g.time % DAY_LEN;
  const nl = g.nightLen();
  const u = g.diff.unwrite;
  const tStart = 24 + DAY_LEN / u;
  const gap = hexDist(g.start, g.p) - g.front;
  const frontActive = g.time >= tStart;
  const toolBtn = (id: "walk" | "quill" | "pin", icon: string, label: string, k: string) => (
    <button
      key={id}
      className={`btn btn-sm flex items-center gap-1 ${g.tool === id ? "btn-gold" : "btn-ghost"}`}
      onClick={() => { g.tool = id; g.hoverPath = null; g.hover = null; audio.sfx("click"); g.emit(); }}
      title={label}
    >
      <span className="text-base">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <Kbd>{k}</Kbd>
    </button>
  );
  const here = g.curTile();
  const atLm = here.feature?.kind === "landmark";
  const tut = g.tut;
  const step = TUT_STEPS[Math.min(tut.step, TUT_STEPS.length - 1)];

  return (
    <>
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 p-2 flex flex-wrap items-start gap-2 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="panel-dark p-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 pointer-events-auto max-w-full" style={{ minWidth: 220 }}>
          <Bar icon="❤️" label="Vigor" value={g.vigor} max={g.maxVigor} color="linear-gradient(90deg,#a3392d,#e0604c)" warn={g.vigor <= g.maxVigor * 0.25} />
          <Bar icon="🧠" label="Sanity" value={g.sanity} max={g.maxSanity} color="linear-gradient(90deg,#6a3aa0,#b07be0)" warn={g.sanity <= g.maxSanity * 0.3} />
          <Bar icon="🍖" label="Supplies" value={g.supplies} max={g.maxSupplies} color="linear-gradient(90deg,#9a7a2c,#d9b24a)" warn={g.supplies <= 4} />
          <Bar icon="🖋️" label="Ink" value={g.ink} max={g.maxInk} color="linear-gradient(90deg,#2a3a5a,#5a7ab0)" warn={g.ink <= 2} />
          <div className="flex items-center gap-2 text-sm">
            <span title="Gold">🪙 <b>{g.gold}</b></span>
            <button className="btn btn-sm btn-ghost !px-1.5" disabled={g.tonics <= 0} onClick={() => g.useItem("tonic")} title="Tonic: +12 vigor (H)">🧪{g.tonics}</button>
            <button className="btn btn-sm btn-ghost !px-1.5" disabled={g.laud <= 0} onClick={() => g.useItem("laud")} title="Laudanum: +20 sanity (G)">💊{g.laud}</button>
          </div>
          <div className="text-[11px] opacity-80 leading-tight col-span-2 sm:col-span-1 self-center">
            Map {Math.round(g.pct())}% · 🔱 {g.sigils}/3 · 📌 {g.pinCount()}/{g.maxPins()}
          </div>
        </div>

        <div className="panel-dark p-2 pointer-events-auto flex flex-col gap-1.5" style={{ minWidth: 190 }}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-title font-bold text-sm">{night ? "🌙" : "☀️"} Day {g.day}</span>
            <div className="flex gap-[2px]" title="Time of day">
              {Array.from({ length: DAY_LEN }).map((_, i) => (
                <i key={i} className="block w-[7px] h-[10px] rounded-sm" style={{ background: i < phase ? (i >= DAY_LEN - nl ? "#6a7ad0" : "#d9b24a") : "rgba(255,255,255,0.12)", outline: i === phase ? "1px solid #fff" : "none" }} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] flex justify-between">
              <span>🌀 The Unwriting</span>
              <span className={frontActive && gap < 4 ? "text-red-300 font-bold" : ""}>
                {!frontActive ? `begins in ${Math.max(1, Math.ceil(tStart - g.time))}` : gap <= 0 ? "ENGULFED!" : `${Math.ceil(gap)} tiles behind`}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: (frontActive ? clamp(1 - gap / 10, 0.04, 1) * 100 : 3) + "%", background: "linear-gradient(90deg,#2a1a30,#8a5ab5)" }} />
            </div>
          </div>
          <div className="flex gap-1.5 justify-end">
            <button className="btn btn-sm btn-ghost" onClick={() => g.openJournal()} title="Journal (J)">📖 <Kbd>J</Kbd></button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const s = g.save.settings;
                s.muted = !s.muted;
                audio.setVolumes({ muted: s.muted });
                writeSave(g.save);
                g.emit();
              }}
              title="Mute (M)"
            >{g.save.settings.muted ? "🔇" : "🔊"}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { g.paused = true; g.emit(); }} title="Pause (Esc)">⏸</button>
          </div>
        </div>
      </div>

      {/* tutorial */}
      {tut.on && (
        <div className="absolute left-2 bottom-[136px] sm:bottom-[176px] panel-dark p-3 max-w-[300px] anim-fadeUp pointer-events-auto" style={{ zIndex: 9 }}>
          <div className="flex items-center justify-between mb-1">
            <b className="font-title text-xs tracking-widest text-amber-300">FIELD LESSON {Math.min(tut.step + 1, TUT_STEPS.length)}/{TUT_STEPS.length}</b>
            <button className="text-xs underline opacity-70 hover:opacity-100" onClick={() => g.tutSkip()}>skip</button>
          </div>
          <p className="text-sm leading-snug">{step.text}</p>
          <div className="flex gap-1 mt-2">
            {TUT_STEPS.map((_, i) => <i key={i} className="h-1.5 flex-1 rounded" style={{ background: i < tut.step ? "#d9b24a" : "rgba(255,255,255,0.2)" }} />)}
          </div>
          {tut.step >= TUT_STEPS.length - 1 && <button className="btn btn-sm btn-gold mt-2 w-full" onClick={() => g.tutSkip()}>Understood</button>}
        </div>
      )}

      {/* toasts */}
      <div className="absolute right-2 top-[168px] sm:top-[128px] flex flex-col gap-1.5 items-end pointer-events-none" style={{ zIndex: 12 }}>
        {g.toasts.map((t) => (
          <div key={t.id} className={`panel-dark px-3 py-1.5 text-sm max-w-[300px] ${t.kind === "warn" ? "!border-red-700/70" : t.kind === "discover" || t.kind === "relic" ? "!border-amber-400/70" : ""}`} style={{ animation: "toastIn 4.2s ease forwards" }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* banner */}
      {g.banner && (
        <div key={g.banner.id} className="absolute inset-x-0 top-[28%] text-center pointer-events-none" style={{ zIndex: 14, animation: `banner ${g.banner.t + 0.4}s ease forwards` }}>
          <div className="font-title font-black text-4xl sm:text-6xl text-amber-100" style={{ textShadow: "0 2px 0 #000, 0 0 30px rgba(200,150,46,0.8)" }}>{g.banner.text}</div>
          <div className="italic text-lg text-amber-50 mt-1" style={{ textShadow: "0 2px 4px #000" }}>{g.banner.sub}</div>
        </div>
      )}

      {/* whisper */}
      {g.whisper && g.save.settings.psycho && (
        <div key={g.whisper.id} className="absolute inset-x-0 bottom-[34%] text-center pointer-events-none italic text-2xl sm:text-3xl text-purple-200 anim-glitch" style={{ zIndex: 13, textShadow: "0 0 14px #a070d0, 0 2px 0 #000", animation: "whisper 3.2s ease forwards" }}>
          “{g.whisper.text}”
        </div>
      )}

      {/* minimap */}
      <div className="absolute left-2 bottom-2 panel-dark p-1 pointer-events-auto" style={{ zIndex: 10 }}>
        <Minimap g={g} />
      </div>

      {/* bottom toolbar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 panel-dark p-2 flex flex-wrap justify-center gap-1.5 pointer-events-auto max-w-[calc(100%-290px)] sm:max-w-[calc(100%-360px)]" style={{ zIndex: 10 }}>
        {toolBtn("walk", "🥾", "Walk", "1")}
        {toolBtn("quill", "🪶", "Quill", "2")}
        {toolBtn("pin", "📌", "Pin", "3")}
        <span className="w-px bg-white/20 mx-1" />
        <button className="btn btn-sm flex items-center gap-1" onClick={() => g.quickSurvey()} title="Chart all glimpsed tiles within 2 (S)">🗺️ <span className="hidden sm:inline">Survey</span> <Kbd>S</Kbd></button>
        <button className="btn btn-sm flex items-center gap-1" onClick={() => g.camp()} title="Make camp (R)">🔥 <span className="hidden sm:inline">Camp</span> <Kbd>R</Kbd></button>
        {atLm && <button className="btn btn-sm btn-gold flex items-center gap-1 anim-glow" onClick={() => g.interact()}>{LM[(here.feature as { id: keyof typeof LM }).id].emoji} Enter <Kbd>F</Kbd></button>}
      </div>

      {/* tool hint */}
      <div className="absolute bottom-[72px] sm:bottom-[66px] left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded bg-black/55 text-amber-100 pointer-events-none whitespace-nowrap" style={{ zIndex: 9 }}>
        {g.tool === "walk" && "Click a tile to travel · drag to pan · wheel to zoom"}
        {g.tool === "quill" && "Drag across pale tiles within sight to chart them with ink"}
        {g.tool === "pin" && "Click a tile to cycle notes: ⚠️ ⭐ 🏕️ ✖️"}
        {g.starving && <span className="text-red-300 font-bold"> · STARVING</span>}
      </div>
      {g.tip && g.tool === "walk" && !g.starving && (
        <div className="hidden lg:block absolute bottom-[100px] left-1/2 -translate-x-1/2 text-[11px] italic px-3 py-0.5 rounded bg-black/40 text-amber-100/80 pointer-events-none" style={{ zIndex: 9 }}>
          💡 {g.tip}
        </div>
      )}
    </>
  );
}
