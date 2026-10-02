import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../game/audio";
import { DIFFS } from "../game/data";
import { Game } from "../game/engine";
import type { Run } from "../game/run";
import type { Settings } from "../game/save";
import type { EventView, Hud as HudData } from "../game/types";
import CrewPanel from "./CrewPanel";
import EndScreen, { type EndInfo } from "./EndScreen";
import EventModal from "./EventModal";
import Help from "./Help";
import Hud from "./Hud";
import SettingsPanel from "./Settings";
import Station from "./Station";
import { Modal } from "./ui";

type Panel = null | "pause" | "crew" | "help" | "settings" | "confirmRestart" | "confirmQuit";

interface Props {
  run: Run; tutorial: boolean; settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  onFinish: (run: Run, win: boolean) => { score: number; renown: number; best: boolean };
  onTutorialDone: () => void;
  onRetry: () => void; onSetup: () => void; onTitle: () => void; onArchive: () => void;
}

export default function GameView(props: Props) {
  const { run, tutorial, settings } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [station, setStation] = useState(false);
  const [ev, setEv] = useState<EventView | null>(null);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [tutDone, setTutDone] = useState(false);
  const [, bump] = useState(0);
  const st = useRef({ panel, station, ev, end, tutDone });
  st.current = { panel, station, ev, end, tutDone };
  const propsRef = useRef(props);
  propsRef.current = props;

  const openPanel = useCallback((p: Panel) => {
    setPanel(p); gameRef.current?.setPaused(p !== null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.init(); audio.startMusic();
    const g = new Game(canvas, run, { tutorial, shake: propsRef.current.settings.shake }, {
      onHud: (h) => setHud(h),
      onArrive: () => { setStation(true); },
      onEvent: (e) => setEv(e),
      onEnd: (win, reason) => {
        const r = propsRef.current.onFinish(run, win);
        setEnd({ win, reason, ...r });
      },
      onTutorialDone: () => { setTutDone(true); propsRef.current.onTutorialDone(); },
      onPauseKey: () => {
        const s = st.current;
        if (s.station || s.ev || s.end || s.tutDone) return;
        if (s.panel) openPanel(null); else openPanel("pause");
      },
      onCrewKey: () => {
        const s = st.current;
        if (s.station || s.ev || s.end || s.tutDone) return;
        if (s.panel === "crew") openPanel(null); else if (!s.panel) openPanel("crew");
      },
    });
    gameRef.current = g;
    g.start();
    if (!tutorial) { g.modal = true; setStation(true); }
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvas);
    const onVis = () => {
      const s = st.current;
      if (document.hidden && !s.panel && !s.station && !s.ev && !s.end && !s.tutDone) openPanel("pause");
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onVis);
      ro.disconnect();
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { gameRef.current?.setShake(settings.shake); }, [settings.shake]);

  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);
  const showTouch = settings.touch || isTouch;
  const g = gameRef.current;

  const depart = () => {
    const eg = gameRef.current;
    if (!eg) return;
    eg.depart(); setStation(false); setHud(null);
  };
  const pickEvent = (i: number) => { gameRef.current?.resolveEvent(i); setEv(null); };
  const abandon = () => { openPanel(null); gameRef.current?.end(false, "You abandoned the expedition and turned back to the depot."); };

  const setDiff = (i: number) => { run.diffIdx = i; bump((x) => x + 1); audio.sfx("click"); };

  return (
    <div className="absolute inset-0 bg-[#b9d6ec]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      {hud && !station && !end && <Hud h={hud} onCrew={() => openPanel("crew")} onPause={() => openPanel("pause")} />}
      {showTouch && !station && !end && !panel && !ev && <TouchControls game={g} />}

      {station && !end && <Station run={run} onDepart={depart} onHelp={() => openPanel("help")} />}
      {ev && !end && <EventModal ev={ev} onPick={pickEvent} />}

      {panel === "pause" && (
        <Modal>
          <h2 className="font-display text-4xl text-amber-300 text-center">PAUSED</h2>
          <div className="mt-4 grid gap-2">
            <button className="btn btn-primary" onClick={() => openPanel(null)}>▶ Resume</button>
            <button className="btn" onClick={() => openPanel("crew")}>👥 Crew & Bonds</button>
            <button className="btn" onClick={() => openPanel("help")}>❓ How to Play & Controls</button>
            <button className="btn" onClick={() => openPanel("settings")}>⚙ Audio, Difficulty & Settings</button>
            {!tutorial && <button className="btn" onClick={() => openPanel("confirmRestart")}>↻ Restart Expedition</button>}
            {!tutorial && <button className="btn btn-danger" onClick={abandon}>🏳 Abandon Expedition (ends the run)</button>}
            <button className="btn" onClick={() => openPanel("confirmQuit")}>⌂ Quit to Title</button>
          </div>
        </Modal>
      )}
      {panel === "settings" && (
        <Modal>
          <h2 className="font-display text-3xl text-amber-300 mb-3">SETTINGS</h2>
          <SettingsPanel s={settings} onChange={props.onSettings} />
          {!tutorial && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-sm text-sky-100 mb-2">Difficulty (applies immediately; Renown is scored on the final setting)</div>
              <div className="grid grid-cols-3 gap-2">
                {DIFFS.map((d, i) => (
                  <button key={d.id} className={`btn ${run.diffIdx === i ? "btn-primary" : ""}`} onClick={() => setDiff(i)}>{d.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-right"><button className="btn" onClick={() => openPanel("pause")}>← Back</button></div>
        </Modal>
      )}
      {panel === "help" && (
        <Modal wide>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-3xl text-amber-300">HOW TO PLAY</h2>
            <button className="btn btn-sm" onClick={() => openPanel(station ? null : "pause")}>{station ? "Close" : "← Back"}</button>
          </div>
          <Help />
        </Modal>
      )}
      {panel === "crew" && (
        <Modal wide>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-3xl text-amber-300">CREW & BONDS</h2>
            <button className="btn btn-sm" onClick={() => openPanel(null)}>Resume ▶</button>
          </div>
          <CrewPanel run={run} />
        </Modal>
      )}
      {panel === "confirmRestart" && (
        <Modal>
          <h2 className="font-display text-3xl text-amber-300">Restart the expedition?</h2>
          <p className="text-sky-100/80 mt-2">All progress in this run will be lost (Renown is not awarded).</p>
          <div className="mt-4 flex gap-2 justify-end">
            <button className="btn" onClick={() => openPanel("pause")}>Cancel</button>
            <button className="btn btn-danger" onClick={() => props.onRetry()}>Restart</button>
          </div>
        </Modal>
      )}
      {panel === "confirmQuit" && (
        <Modal>
          <h2 className="font-display text-3xl text-amber-300">Quit to title?</h2>
          <p className="text-sky-100/80 mt-2">This run will be lost.</p>
          <div className="mt-4 flex gap-2 justify-end">
            <button className="btn" onClick={() => openPanel("pause")}>Cancel</button>
            <button className="btn btn-danger" onClick={() => props.onTitle()}>Quit</button>
          </div>
        </Modal>
      )}
      {tutDone && (
        <Modal z={50}>
          <div className="text-center">
            <div className="text-5xl">🎓</div>
            <h2 className="font-display text-4xl text-amber-300">TRAINING COMPLETE</h2>
            <p className="mt-2 text-sky-100/85">You can drive, jump, bridge, camp and fend off raiders. The real ice is far less forgiving — manage your fuel, your crew, and your cargo.</p>
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              <button className="btn btn-primary" onClick={props.onSetup}>Start an Expedition ➜</button>
              <button className="btn" onClick={props.onRetry}>Repeat tutorial</button>
              <button className="btn" onClick={props.onTitle}>Title</button>
            </div>
          </div>
        </Modal>
      )}
      {end && <EndScreen run={run} info={end} onRetry={props.onRetry} onSetup={props.onSetup} onTitle={props.onTitle} onArchive={props.onArchive} />}
    </div>
  );
}

function TouchBtn({ label, onDown, onUp, className = "" }: { label: string; onDown: () => void; onUp?: () => void; className?: string }) {
  return (
    <button
      className={`pointer-events-auto rounded-full bg-sky-900/60 border border-sky-200/50 text-sky-50 font-bold active:bg-amber-500/70 touch-none ${className}`}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); onDown(); }}
      onPointerUp={() => onUp?.()} onPointerCancel={() => onUp?.()} onPointerLeave={() => onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
    >{label}</button>
  );
}

function TouchControls({ game }: { game: Game | null }) {
  if (!game) return null;
  const hold = (a: string) => ({ onDown: () => game.hold(a, true), onUp: () => game.hold(a, false) });
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20 p-3 flex justify-between items-end">
      <div className="flex gap-2 items-end mb-12">
        <TouchBtn label="◀" className="w-16 h-16 text-2xl" {...hold("left")} />
        <TouchBtn label="▶" className="w-16 h-16 text-2xl" {...hold("right")} />
      </div>
      <div className="flex flex-col gap-2 items-end mb-12">
        <div className="flex gap-2">
          <TouchBtn label="JUMP" className="w-14 h-14 text-[11px]" onDown={() => game.press("jump")} />
          <TouchBtn label="BRIDGE" className="w-14 h-14 text-[10px]" onDown={() => game.press("bridge")} />
          <TouchBtn label="CAMP" className="w-14 h-14 text-[11px]" onDown={() => game.press("camp")} />
        </div>
        <div className="flex gap-2">
          <TouchBtn label="FLARE" className="w-14 h-14 text-[11px]" onDown={() => game.press("flare")} />
          <TouchBtn label="BURN" className="w-14 h-14 text-[11px]" onDown={() => game.press("jettison")} />
          <TouchBtn label="▼" className="w-14 h-14 text-xl" {...hold("down")} />
          <TouchBtn label="▲" className="w-16 h-16 text-2xl" {...hold("up")} />
        </div>
      </div>
    </div>
  );
}
