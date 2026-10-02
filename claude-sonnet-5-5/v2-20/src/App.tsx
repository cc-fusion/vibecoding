import { useEffect, useReducer, useRef, useState } from "react";
import { Game, loadSave, type Save } from "./game";
import { audio } from "./audio";
import { CASE_META, type DiffId } from "./data";
import { Hud, PhaseOverlay } from "./ui/Hud";
import { Journal, ModalHost } from "./ui/Panels";
import { Archive, Brief, CaseSelect, GameOver, HelpScreen, Pause, SettingsScreen, Title, Victory } from "./ui/Menus";

type Screen = "title" | "cases" | "brief" | "play" | "archive" | "help" | "settings";
interface Cfg { id: string; d: DiffId; mods: string[] }

function PlayScreen({ g, onQuit, onNext, onRetry }: { g: Game; onQuit: () => void; onNext: (() => void) | null; onRetry: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    g.attach(c);
    return () => g.destroy();
  }, [g]);
  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-0"><canvas ref={ref} className="block touch-none" /></div>
      <Hud g={g} />
      <PhaseOverlay g={g} />
      <ModalHost g={g} />
      {g.overlay === "journal" && <Journal g={g} onClose={() => g.toggleOverlay("journal")} />}
      {(g.overlay === "pause" || g.overlay === "help" || g.overlay === "settings") && <Pause key={g.overlay} g={g} onQuit={onQuit} />}
      {g.phase === "won" && <Victory g={g} onNext={onNext} onMenu={onQuit} />}
      {g.phase === "lost" && <GameOver g={g} onRetry={onRetry} onMenu={onQuit} />}
    </div>
  );
}

export default function App() {
  const saveRef = useRef<Save>(loadSave());
  const save = saveRef.current;
  const [screen, setScreen] = useState<Screen>("title");
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [g, setG] = useState<Game | null>(null);
  const [runId, setRunId] = useState(0);
  const cfg = useRef<Cfg | null>(null);
  const interacted = useRef(false);

  useEffect(() => { audio.setVolumes(save.set, save.set.muted); }, [save]);

  // menu music once the user has interacted
  useEffect(() => {
    const start = () => {
      if (!interacted.current) {
        interacted.current = true;
        if (screenRef.current !== "play") { audio.startMusic(45); audio.setTension(0.05); }
      }
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    return () => { window.removeEventListener("pointerdown", start); window.removeEventListener("keydown", start); };
  }, []);
  const screenRef = useRef<Screen>(screen);
  useEffect(() => {
    screenRef.current = screen;
    if (screen !== "play" && interacted.current) { audio.startMusic(45); audio.setTension(0.05); audio.setDuck(false); }
  }, [screen]);

  // HUD refresh while playing
  useEffect(() => {
    if (screen !== "play") return;
    const i = setInterval(force, 100);
    return () => clearInterval(i);
  }, [screen]);

  const create = (c: Cfg) => {
    cfg.current = c;
    const ng = new Game(save, c.id, c.d, c.mods, force);
    setG(ng);
    setRunId((r) => r + 1);
    return ng;
  };
  const toMenu = () => { setG(null); setScreen("cases"); };
  const nextIdx = g ? CASE_META.findIndex((c) => c.id === g.cd.id) + 1 : 0;
  const onNext = g && g.phase === "won" && nextIdx > 0 && nextIdx < CASE_META.length
    ? () => { const c = cfg.current!; create({ ...c, id: CASE_META[nextIdx].id }); setScreen("brief"); }
    : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#03050a] text-slate-100" style={{ fontFamily: "'Chakra Petch', ui-sans-serif, system-ui, sans-serif" }}>
      {screen === "title" && <Title save={save} onPlay={() => setScreen("cases")} onArchive={() => setScreen("archive")} onHelp={() => setScreen("help")} onSettings={() => setScreen("settings")} />}
      {screen === "cases" && <CaseSelect save={save} onChange={force} onBack={() => setScreen("title")} onStart={(id, d, mods) => { create({ id, d, mods }); setScreen("brief"); }} />}
      {screen === "brief" && g && <Brief g={g} onBack={() => { setG(null); setScreen("cases"); }} onBegin={() => setScreen("play")} />}
      {screen === "archive" && <Archive save={save} onChange={force} onBack={() => setScreen("title")} />}
      {screen === "help" && <HelpScreen onBack={() => setScreen("title")} />}
      {screen === "settings" && <SettingsScreen save={save} onChange={force} onBack={() => setScreen("title")} />}
      {screen === "play" && g && (
        <PlayScreen key={runId} g={g} onQuit={toMenu} onNext={onNext} onRetry={() => { create(cfg.current!); }} />
      )}
    </div>
  );
}
