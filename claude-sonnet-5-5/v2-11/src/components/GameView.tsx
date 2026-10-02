import { useEffect, useRef, useState } from "react";
import { Engine, H, W, type Snapshot } from "../game/engine";
import type { RunState } from "../game/data";
import { DIFF_MAP, ORDER_MAP, RELIC_MAP } from "../game/data";
import type { SaveData, Settings } from "../game/save";
import { audio } from "../game/audio";
import { cn } from "../utils/cn";
import CardView from "./CardView";
import { Codex, SettingsPanel } from "./Panels";

interface Props {
  run: RunState;
  kind: "wave" | "boss" | "tutorial";
  save: SaveData;
  onSettings: (s: Settings) => void;
  onDiff: (d: string) => void;
  onClear: () => void;
  onDeath: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

export default function GameView(props: Props) {
  const { run, kind, save } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"menu" | "settings" | "help" | "deck" | "confirm">("menu");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const eng = new Engine(canvas, run, kind, propsRef.current.save.settings, propsRef.current.save.meta, {
      onSnap: (s) => setSnap(s),
      onClear: () => propsRef.current.onClear(),
      onDeath: () => propsRef.current.onDeath(),
      onPause: (toggle) => setPaused((p) => (toggle ? !p : true)),
    });
    engRef.current = eng;
    const fitNow = () => {
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      if (cw < 10 || ch < 10) return;
      const w = Math.floor(Math.min(cw, (ch * W) / H));
      eng.fit(w, (w * H) / W);
    };
    fitNow();
    const ro = new ResizeObserver(fitNow);
    ro.observe(wrap);
    window.addEventListener("resize", fitNow);
    eng.start();
    audio.startMusic(kind === "boss" ? 1 : 0);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fitNow);
      eng.destroy();
      engRef.current = null;
    };
    // engine is bound to this stage; component is remounted per stage via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engRef.current?.setPaused(paused);
    if (!paused) setPanel("menu");
  }, [paused]);

  useEffect(() => {
    if (engRef.current) engRef.current.settings = save.settings;
  }, [save.settings]);

  const changeDiff = (d: string) => {
    props.onDiff(d);
    const e = engRef.current;
    if (e) e.recomputeDiff();
  };

  const eng = engRef.current;
  const s = snap;
  const diff = DIFF_MAP[run.diff];

  return (
    <div className="h-full w-full flex flex-col glass-bg">
      {/* top bar */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-1.5 bg-black/55 border-b border-amber-200/20 text-sm">
        <div className="flex items-center gap-0.5 min-w-[60px]" title="Hit points">
          {s && Array.from({ length: s.maxHp }).map((_, i) => (
            <span key={i} className={cn("text-lg sm:text-xl leading-none transition-all", i < s.hp ? "text-rose-400 drop-shadow-[0_0_6px_rgba(255,80,110,0.8)]" : "text-white/15 scale-90")}>♥</span>
          ))}
          {s && Array.from({ length: s.shield }).map((_, i) => (
            <span key={"s" + i} className="text-lg leading-none text-amber-300 drop-shadow-[0_0_6px_rgba(246,211,122,0.8)]">⛨</span>
          ))}
        </div>
        <div className="flex-1 text-center leading-tight">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-amber-200/70">{s?.label} · {diff?.name}</div>
          <div className="text-base sm:text-lg font-bold tabular-nums text-amber-50">{(s?.score ?? 0).toLocaleString()}</div>
        </div>
        <div className="w-24 sm:w-40" title="Fervor: boosts damage and score; shattered when hit">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-orange-200/80">
            <span>Fervor</span><span>×{(1 + (s?.fervor ?? 0) / 25).toFixed(1)}</span>
          </div>
          <div className="h-2 bg-black/60 border border-orange-300/40 rounded-sm overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-200 transition-[width] duration-100" style={{ width: (s?.fervor ?? 0) + "%" }} />
          </div>
        </div>
        <button className="btn !px-2 !py-1" aria-label="Mute" onClick={() => props.onSettings({ ...save.settings, muted: !save.settings.muted })}>{save.settings.muted ? "🔇" : "🔊"}</button>
        <button className="btn !px-2 !py-1" aria-label="Pause" onClick={() => setPaused(true)}>❚❚</button>
      </div>

      {/* field */}
      <div ref={wrapRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="border-x border-amber-200/20 shadow-[0_0_60px_rgba(120,60,200,0.35)]" />
        {s && s.effects.length > 0 && (
          <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 max-w-[70%] pointer-events-none">
            {s.effects.map((e) => (
              <div key={e.name} className="relative text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-black/70 border overflow-hidden" style={{ borderColor: e.color }}>
                <div className="absolute inset-y-0 left-0 opacity-30" style={{ width: Math.max(0, Math.min(1, e.t / e.max)) * 100 + "%", background: e.color }} />
                <span className="relative">{e.icon} {e.name} {e.t.toFixed(0)}s</span>
              </div>
            ))}
          </div>
        )}
        {s?.tut && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[min(94%,560px)] panel rounded p-2 sm:p-3 text-center fade-up" key={s.tut.step}>
            <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 mb-1">Tutorial · {s.tut.step + 1} / {s.tut.total}</div>
            <div className="font-sans text-sm sm:text-[15px] text-amber-50">{s.tut.text}</div>
            <button className="btn !py-0.5 !px-2 !text-[10px] mt-2" onClick={props.onQuit}>Skip tutorial</button>
          </div>
        )}
      </div>

      {/* hand */}
      <div className="shrink-0 bg-black/60 border-t border-amber-200/20 px-2 pt-1 pb-1.5">
        <div className="flex items-center gap-2 mb-1 max-w-[760px] mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-sky-200/80">
              <span>Faith</span><span className="tabular-nums">{(s?.faith ?? 0).toFixed(1)} / {s?.maxFaith ?? 0}</span>
            </div>
            <div className="flex gap-[2px] h-3">
              {s && Array.from({ length: s.maxFaith }).map((_, i) => {
                const f = Math.max(0, Math.min(1, s.faith - i));
                return (
                  <div key={i} className="flex-1 bg-black/70 border border-sky-300/40 rounded-[2px] overflow-hidden">
                    <div className="h-full bg-gradient-to-t from-sky-500 to-cyan-100" style={{ width: f * 100 + "%", boxShadow: f >= 1 ? "0 0 8px #7dd8ff" : undefined }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-[10px] sm:text-xs text-violet-200/80 leading-tight text-center w-[68px] sm:w-[92px] font-sans" title="Draw pile / discard pile">
            <div>Draw <b>{s?.drawN ?? 0}</b> · Disc <b>{s?.discardN ?? 0}</b></div>
            <div className="h-1 bg-black/60 mt-0.5"><div className="h-full bg-violet-300" style={{ width: (s?.drawProg ?? 0) * 100 + "%" }} /></div>
          </div>
          <button
            className="btn !px-2 !py-1 !text-[10px] relative overflow-hidden"
            onClick={() => eng?.cycle()}
            disabled={!s || s.cycleProg < 1 || s.faith < 1}
            title="Recite (R): pay 1 Faith, discard your hand and redraw"
          >
            <span className="relative">⟳ Recite <span className="opacity-60">R</span></span>
            <span className="absolute bottom-0 left-0 h-[3px] bg-violet-300" style={{ width: (s?.cycleProg ?? 1) * 100 + "%" }} />
          </button>
        </div>
        <div className="flex justify-center gap-1.5 sm:gap-2 min-h-[104px] sm:min-h-[148px]">
          {s?.hand.map((h, i) => (
            <CardView key={h.inst.uid} inst={h.inst} cost={h.cost} ok={h.ok} size="hand" hotkey={String(i + 1)} deny={s.denyUid === h.inst.uid} onClick={() => eng?.playCard(i)} />
          ))}
          {s && s.hand.length === 0 && <div className="self-center text-xs text-violet-200/60 font-sans italic">Your hand is empty… the next card arrives soon.</div>}
        </div>
      </div>

      {/* pause overlay */}
      {paused && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="panel rounded-lg p-5 w-[min(96vw,720px)] max-h-[94vh] overflow-y-auto fade-up">
            {panel === "menu" && (
              <div className="flex flex-col gap-2 items-stretch max-w-xs mx-auto">
                <h2 className="text-center text-2xl tracking-[0.3em] text-amber-100 title-glow mb-2">PAUSED</h2>
                <button className="btn btn-primary" onClick={() => { audio.sfx("ui"); setPaused(false); }}>Resume</button>
                <button className="btn" onClick={() => { audio.sfx("ui"); setPanel("deck"); }}>Deck &amp; Relics</button>
                <button className="btn" onClick={() => { audio.sfx("ui"); setPanel("settings"); }}>Settings &amp; Difficulty</button>
                <button className="btn" onClick={() => { audio.sfx("ui"); setPanel("help"); }}>Help &amp; Controls</button>
                {kind !== "tutorial" && <button className="btn" onClick={() => { audio.sfx("ui2"); setPanel("confirm"); }}>Restart / Abandon</button>}
                {kind === "tutorial" && <button className="btn" onClick={props.onQuit}>Leave Tutorial</button>}
                <div className="text-center text-xs text-violet-200/60 font-sans mt-2">{ORDER_MAP[run.order]?.name} · Act {run.act} · {Math.floor(run.stats.time)}s</div>
              </div>
            )}
            {panel === "settings" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-center text-xl tracking-[0.3em] text-amber-100">SETTINGS</h2>
                <SettingsPanel settings={save.settings} onChange={props.onSettings} diff={kind === "tutorial" ? undefined : run.diff} onDiff={changeDiff} />
                <button className="btn self-center" onClick={() => setPanel("menu")}>Back</button>
              </div>
            )}
            {panel === "help" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-center text-xl tracking-[0.3em] text-amber-100">CODEX</h2>
                <Codex save={save} compact />
                <button className="btn self-center" onClick={() => setPanel("menu")}>Back</button>
              </div>
            )}
            {panel === "deck" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-center text-xl tracking-[0.3em] text-amber-100">DECK · {run.deck.length} CARDS</h2>
                <div className="flex flex-wrap gap-2 justify-center max-h-[48vh] overflow-y-auto">
                  {run.deck.map((c) => <CardView key={c.uid} inst={c} size="mini" />)}
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs font-sans">
                  {run.relics.length === 0 && <span className="opacity-60">No relics yet.</span>}
                  {run.relics.map((r) => <span key={r} className="px-2 py-1 border border-amber-200/30 rounded bg-black/30" title={RELIC_MAP[r].text}>{RELIC_MAP[r].icon} {RELIC_MAP[r].name}: {RELIC_MAP[r].text}</span>)}
                </div>
                <button className="btn self-center" onClick={() => setPanel("menu")}>Back</button>
              </div>
            )}
            {panel === "confirm" && (
              <div className="flex flex-col gap-2 items-stretch max-w-xs mx-auto">
                <h2 className="text-center text-xl tracking-[0.2em] text-amber-100 mb-1">LEAVE THE VIGIL?</h2>
                <p className="text-center text-sm font-sans text-violet-100/80 mb-2">Restarting begins a fresh run with the same setup. Abandoning ends this run and awards Ash for progress so far.</p>
                <button className="btn btn-primary" onClick={props.onRestart}>Restart Run</button>
                <button className="btn" onClick={props.onDeath}>Abandon &amp; See Results</button>
                <button className="btn" onClick={() => setPanel("menu")}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
