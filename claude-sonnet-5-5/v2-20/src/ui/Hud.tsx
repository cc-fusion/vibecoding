import { useRef } from "react";
import type { Game } from "../game";
import { ITEMS, fmtTime, npcDef, ROOMS } from "../data";

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);

function Joystick({ g }: { g: Game }) {
  const ref = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const set = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    g.stick.x = Math.abs(dx) > 0.2 ? dx : 0; g.stick.y = Math.abs(dy) > 0.2 ? dy : 0;
    if (knob.current) knob.current.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
  };
  const end = () => { g.stick.x = 0; g.stick.y = 0; if (knob.current) knob.current.style.transform = "translate(0,0)"; };
  return (
    <div ref={ref} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }} onPointerUp={end} onPointerCancel={end}
      className="pointer-events-auto absolute bottom-6 left-6 flex h-28 w-28 touch-none items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10">
      <div ref={knob} className="pointer-events-none h-12 w-12 rounded-full border border-cyan-300 bg-cyan-400/40" />
    </div>
  );
}

const reasons: Record<string, string> = {
  crime: "The crime happens. Time folds back on itself.",
  detained: "Security detains you. You wake at 19:00.",
  accused: "A false accusation! Security detains you.",
  failed: "The interrogation collapsed. The killer slips away.",
  manual: "You wrench the timeline back to 19:00.",
};

export function Hud({ g }: { g: Game }) {
  const cd = g.cd;
  const pct = Math.min(100, (g.t / cd.crime) * 100);
  const danger = pct > 80;
  const tut = g.tutorial();
  const ev = g.evidenceKnown().length;
  const zone = g.pz();
  const zoneName = zone === "hall" ? "Corridor" : zone ? ROOMS.find((r) => r.id === zone)?.name : "";
  const reveal = g.reveal ? cd.facts[g.reveal.id] : null;
  const btn = "pointer-events-auto rounded-lg border border-cyan-400/40 bg-[#08101d]/85 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 sm:text-sm";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none text-slate-100">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2 sm:p-3">
        <div className="rounded-xl border border-cyan-400/30 bg-[#08101d]/85 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Case {cd.num}</div>
          <div className="text-sm font-bold text-cyan-200">{cd.title}</div>
          <div className="mt-1 flex items-center gap-1" title="Loops remaining">
            {Array.from({ length: g.pool }).map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i < g.loopsLeft - 1 ? "bg-cyan-400" : i === g.loopsLeft - 1 ? "animate-pulse bg-amber-300" : "bg-slate-700"}`} />
            ))}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">Loop {g.loopNo} · {g.loopsLeft} left</div>
        </div>
        <div className="min-w-[200px] flex-1 sm:max-w-sm">
          <div className={`rounded-xl border bg-[#08101d]/85 px-3 py-2 text-center ${danger ? "border-red-500/60" : "border-cyan-400/30"}`}>
            <div className={`font-mono text-3xl font-bold tracking-widest ${danger ? "animate-pulse text-red-400" : "text-cyan-200"}`}>{fmtTime(g.t)}</div>
            <div className="relative mt-1 h-2 overflow-hidden rounded bg-slate-800">
              <div className={`h-full ${danger ? "bg-red-500" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
              {g.blackout && <div className="absolute inset-0 animate-pulse bg-amber-300/30" />}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>19:00</span><span className="text-red-300">☠ {fmtTime(cd.crime)} {npcDef(cd.victim).name.split(" ").slice(-1)[0]}</span></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            <button className={btn} onClick={() => g.toggleOverlay("journal")}>📓 Journal [J]</button>
            <button className={btn} onClick={() => g.onEscape()}>⏸</button>
          </div>
          <div className="w-44 rounded-xl border border-cyan-400/30 bg-[#08101d]/85 px-3 py-2">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-400"><span>{g.chaseOn ? "🚨 pursuit" : "Suspicion"}</span><span>{Math.round(g.sus)}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800"><div className="h-full transition-all" style={{ width: `${g.sus}%`, background: g.sus > 70 ? "#ff3b4e" : g.sus > 35 ? "#ff9f43" : "#4dffb0" }} /></div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-300"><span>🔎 Evidence {ev}/{cd.evidence.length}</span><span>{zoneName}</span></div>
          </div>
        </div>
      </div>

      {/* inventory */}
      {g.items.length > 0 && (
        <div className="absolute left-2 top-28 flex gap-1 sm:left-3 sm:top-32">
          {g.items.map((i) => <div key={i} title={ITEMS[i]?.name} className="rounded-lg border border-cyan-400/30 bg-[#08101d]/85 px-2 py-1 text-lg">{ITEMS[i]?.icon}{g.pocket === i ? "🧿" : ""}</div>)}
        </div>
      )}

      {/* tutorial */}
      {tut && (
        <div className="absolute left-1/2 top-[7.2rem] w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border border-amber-400/50 bg-amber-950/80 px-4 py-2 text-center text-sm text-amber-100 shadow-lg sm:top-28">
          <span className="mr-2 rounded bg-amber-400 px-1.5 text-xs font-bold text-slate-900">TUTORIAL</span>{tut}
        </div>
      )}

      {/* reveal banner */}
      {reveal && (
        <div className="reveal-pop absolute left-1/2 top-1/3 w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl border-2 border-amber-300/70 bg-[#1a1405]/95 p-4 text-center shadow-[0_0_50px_rgba(255,209,102,0.35)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">{reveal.kind === "evidence" ? `Evidence — ${reveal.cat}` : "New note"}</div>
          <div className="text-xl font-bold text-white">{reveal.title}</div>
          <p className="mt-1 text-sm text-amber-100/90">{reveal.text}</p>
        </div>
      )}

      {/* overheard */}
      {g.overheard && (
        <div className="absolute bottom-24 left-1/2 w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border border-sky-400/50 bg-[#06121f]/95 p-3 text-sm shadow-lg">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300">🎧 Overheard</div>
          {g.overheard.lines.map(([who, text], i) => <p key={i}><b style={{ color: npcDef(who).color }}>{npcDef(who).name.split(" ").slice(-1)[0]}:</b> {text}</p>)}
        </div>
      )}

      {/* prompt */}
      {g.prompt && g.canAct() && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/60 bg-[#08101d]/90 px-5 py-2 text-sm font-semibold text-amber-200">
          <span className="mr-2 rounded bg-amber-300 px-1.5 text-slate-900">E</span>{g.prompt}
        </div>
      )}

      {/* toasts */}
      <div className="absolute bottom-3 left-2 flex max-w-[min(90vw,26rem)] flex-col gap-1 sm:left-3" style={isTouch ? { bottom: "9rem" } : undefined}>
        {g.toasts.map((t) => (
          <div key={t.id} className="toast-in rounded-lg border border-white/10 bg-[#08101d]/90 px-3 py-1.5 text-xs shadow sm:text-sm" style={{ color: t.color, opacity: Math.min(1, t.t) }}>{t.text}</div>
        ))}
      </div>

      {g.blackout && <div className="absolute inset-x-0 top-24 text-center text-sm font-bold tracking-[0.4em] text-amber-300 animate-pulse sm:top-28">⚡ POWER FAILURE — SYSTEMS DOWN ⚡</div>}

      {/* key hints */}
      {!isTouch && <div className="absolute bottom-3 right-3 hidden rounded-lg bg-[#08101d]/70 px-3 py-1.5 text-[11px] text-slate-400 md:block">WASD move · Shift sprint · E interact · J journal · hold F fast-forward{g.save.ups.pulse ? ` · Q pulse${g.pulseCd > 0 ? ` (${Math.ceil(g.pulseCd)}s)` : ""}` : ""} · Esc pause</div>}

      {isTouch && (
        <>
          <Joystick g={g} />
          <div className="absolute bottom-6 right-4 flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {g.save.ups.pulse ? <button className={btn} onClick={() => g.usePulse()}>📡</button> : null}
              <button className={btn} onPointerDown={() => (g.ffHeld = true)} onPointerUp={() => (g.ffHeld = false)} onPointerLeave={() => (g.ffHeld = false)}>⏩ Hold</button>
            </div>
            <button className="pointer-events-auto h-16 w-16 rounded-full border-2 border-amber-300 bg-amber-300/20 text-xl font-bold text-amber-200 active:scale-95" onClick={() => g.interact()}>E</button>
          </div>
        </>
      )}
    </div>
  );
}

export function PhaseOverlay({ g }: { g: Game }) {
  if (g.phase === "crime") {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/50 p-6 text-center">
        <div className="crime-title text-5xl font-black tracking-[0.3em] text-red-500 drop-shadow-[0_0_20px_rgba(255,0,40,0.8)] sm:text-7xl">MURDER</div>
        <p className="mt-4 max-w-xl text-lg text-red-100">{g.cd.crimeText}</p>
      </div>
    );
  }
  if (g.phase === "rewind") {
    const nextLoop = g.loopNo + 1;
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#02060e]/70 p-6 text-center rewind-bg">
        <div className="rewind-spin mb-4 h-24 w-24 rounded-full border-4 border-cyan-300 border-t-transparent" />
        <div className="text-4xl font-black tracking-[0.35em] text-cyan-200 sm:text-5xl">{g.endsRun ? "COLLAPSE" : "REWIND"}</div>
        <p className="mt-3 max-w-lg text-cyan-100">{reasons[g.endReason] || reasons.manual}</p>
        <p className="mt-2 text-sm text-slate-300">
          {g.endsRun ? "That was the last stable loop…" : `Loop ${nextLoop} of ${g.pool} · knowledge retained: ${g.known.size} facts, ${g.evidenceKnown().length}/${g.cd.evidence.length} evidence`}
        </p>
      </div>
    );
  }
  return null;
}
