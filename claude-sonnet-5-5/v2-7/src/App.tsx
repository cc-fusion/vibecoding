import { useEffect, useRef, useState } from "react";
import FxCanvas from "./components/FxCanvas";
import Chamber from "./components/Chamber";
import Hud from "./components/Hud";
import { BillPanel, FactionPanel, NewsLog } from "./components/Panels";
import { Banner, BoonModal, ElectionModal, ElectionResult, EventModal, HelpModal, PauseMenu, ResultSheet, SettingsPanel, TutorialCoach, VotingOverlay } from "./components/Modals";
import { OverScreen, RoostScreen, SetupScreen, TitleScreen } from "./components/Screens";
import type { Setup } from "./components/Screens";
import { Btn, Modal, Title } from "./components/ui";
import { SAVE, commit, getG, useGame } from "./game/core";
import { audio } from "./game/audio";
import { fx } from "./game/fx";
import { FACTION_ORDER, ISSUES } from "./game/data";
import type { DiffId } from "./game/data";
import {
  adjourn, callVote, closeEvent, continueElection, continueFlow, chooseBoon, doBlackmail, doBribe, doCover, doPledge, doScandalize, doSnoop, doSpeech, newRun,
  quitRun, resolveEvent, runElection, selectFaction, setStance, skipReveal, stepReveal, tutNext,
} from "./game/flow";
import { applySettings, setSetting } from "./game/settings";

type Screen = "title" | "setup" | "roost" | "game";

export default function App() {
  const { g } = useGame();
  const [screen, setScreen] = useState<Screen>("title");
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const last = useRef<Setup | null>(null);
  const st = useRef({ screen, g, paused, help, settings });
  st.current = { screen, g, paused, help, settings };

  // init: settings, first-interaction audio unlock, blur/visibility handling
  useEffect(() => {
    applySettings();
    const unlock = () => { audio.resume(); audio.startMusic(); };
    const click = (e: MouseEvent) => { const b = (e.target as HTMLElement)?.closest?.("button"); if (b) (b as HTMLButtonElement).blur(); };
    const vis = () => {
      const hidden = document.hidden; audio.setHidden(hidden);
      const s = st.current; if (hidden && s.screen === "game" && s.g && s.g.phase !== "over") setPaused(true);
    };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock); window.addEventListener("click", click);
    document.addEventListener("visibilitychange", vis); window.addEventListener("blur", vis);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); window.removeEventListener("click", click); document.removeEventListener("visibilitychange", vis); window.removeEventListener("blur", vis); };
  }, []);

  useEffect(() => { fx.ambient = screen !== "game"; }, [screen]);
  useEffect(() => { if (screen !== "game") { audio.setMode("menu"); audio.setTension(0.05); } }, [screen]);
  useEffect(() => { if (g?.phase === "over") { audio.setMode("menu"); audio.setTension(0.1); } }, [g?.phase]);

  // vote reveal animation (paused-safe, single interval)
  const voting = g?.phase === "voting" && !paused;
  useEffect(() => {
    if (!voting) return;
    const id = window.setInterval(() => stepReveal(3), 46);
    return () => clearInterval(id);
  }, [voting]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { screen: sc, g: G, paused: pz, help: hp, settings: se } = st.current; const k = e.key; const tag = (e.target as HTMLElement)?.tagName;
      if (k === "m" || k === "M") { if (tag !== "INPUT" || (e.target as HTMLInputElement).type !== "text") { setSetting({ muted: !SAVE.settings.muted }); return; } }
      if (k === "Escape") {
        if (hp) { setHelp(false); return; }
        if (se) { setSettings(false); return; }
        if (sc === "game" && G && G.phase !== "over") { setPaused(p => !p); audio.click(); }
        else if (sc === "setup" || sc === "roost") setScreen(sc === "setup" ? "title" : "title");
        return;
      }
      if (sc !== "game" || !G || pz || hp) return;
      if (e.repeat && k !== "ArrowLeft" && k !== "ArrowRight") return;
      const act = (k === "Enter" || k === " ") && tag !== "BUTTON";
      if (G.phase === "sitting") {
        const lk = k.toLowerCase();
        if (/^[1-6]$/.test(k)) selectFaction(FACTION_ORDER[parseInt(k) - 1]);
        else if (lk === "b") doBribe(G.selected); else if (lk === "s") doSpeech(G.selected); else if (lk === "p") doPledge(G.selected);
        else if (lk === "n") doSnoop(G.selected); else if (lk === "k") doBlackmail(G.selected); else if (lk === "x") doScandalize(G.selected); else if (lk === "c") doCover();
        else if (k === "ArrowUp" || k === "ArrowDown") { G.focusIssue = (G.focusIssue + (k === "ArrowDown" ? 1 : 3)) % 4; commit(); e.preventDefault(); }
        else if (k === "ArrowLeft" || k === "ArrowRight") { const is = ISSUES[G.focusIssue]; setStance(is, G.sitting.bill.stance[is] + (k === "ArrowRight" ? 1 : -1)); e.preventDefault(); }
        else if (act) { e.preventDefault(); callVote(); }
        else if (lk === "j" && G.sitting.kind !== "boss") adjourn();
        else if (k === "Enter" && G.tut.on && tag === "BUTTON") tutNext();
      } else if (G.phase === "event" && G.event) {
        if (G.event.outcome !== null) { if (act) { e.preventDefault(); closeEvent(); } }
        else if (/^[1-4]$/.test(k)) resolveEvent(parseInt(k) - 1);
      } else if (G.phase === "result") { if (act) { e.preventDefault(); continueFlow(); } }
      else if (G.phase === "voting") { if (act) { e.preventDefault(); skipReveal(); } }
      else if (G.phase === "boon") { if (/^[1-3]$/.test(k)) chooseBoon(parseInt(k) - 1); }
      else if (G.phase === "election") { if (act) { e.preventDefault(); runElection(); } }
      else if (G.phase === "electionResult") { if (act) { e.preventDefault(); continueElection(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = (s: Setup) => {
    last.current = s; newRun({ leader: s.leader, diff: s.diff, mandates: s.mandates, tutorial: s.tutorial });
    audio.resume(); audio.startMusic(); setPaused(false); setHelp(false); setScreen("game");
  };
  const leaveToTitle = (to: Screen = "title") => { quitRun(); setPaused(false); setScreen(to); };
  const harder = () => { const s = last.current; if (!s) return; const next: DiffId = s.diff === "fledgling" ? "corvid" : "raven"; start({ ...s, diff: next, tutorial: false }); };

  let body;
  if (screen === "title") body = <TitleScreen onPlay={() => setScreen("setup")} onRoost={() => setScreen("roost")} onHelp={() => setHelp(true)} onSettings={() => setSettings(true)} />;
  else if (screen === "setup") body = <SetupScreen onStart={start} onBack={() => setScreen("title")} />;
  else if (screen === "roost") body = <RoostScreen onBack={() => setScreen("title")} />;
  else if (g) {
    body = (
      <div className="h-full flex flex-col gap-2 p-2">
        <Hud g={g} muted={SAVE.settings.muted} onPause={() => setPaused(true)} onHelp={() => setHelp(true)} onMute={() => setSetting({ muted: !SAVE.settings.muted })} />
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid gap-2 lg:grid-cols-[minmax(290px,340px)_minmax(0,1fr)_minmax(290px,350px)] auto-rows-min lg:grid-rows-[minmax(0,1fr)]">
          <div className="order-2 lg:order-1 lg:overflow-y-auto lg:min-h-0"><BillPanel g={g} /></div>
          <div className="order-1 lg:order-2 flex flex-col gap-2 lg:min-h-0">
            <div className="panel h-[300px] sm:h-[360px] lg:h-auto lg:flex-1 lg:min-h-[240px] overflow-hidden"><Chamber g={g} /></div>
            <NewsLog g={g} />
          </div>
          <div className="order-3 lg:overflow-y-auto lg:min-h-0"><FactionPanel g={g} /></div>
        </div>
        {g.phase === "event" && g.event && <EventModal g={g} />}
        {g.phase === "result" && g.result && <ResultSheet g={g} />}
        {g.phase === "voting" && <VotingOverlay g={g} />}
        {g.phase === "election" && g.election && <ElectionModal g={g} />}
        {g.phase === "electionResult" && g.election?.result && <ElectionResult g={g} />}
        {g.phase === "boon" && g.boons && <BoonModal g={g} />}
        {g.tut.on && g.phase === "sitting" && !paused && <TutorialCoach g={g} />}
        {g.phase === "sitting" && <Banner g={g} />}
        {g.phase === "over" && g.over && <OverScreen g={g} onRetry={() => last.current && start({ ...last.current, tutorial: false })} onHarder={harder} onRoost={() => leaveToTitle("roost")} onTitle={() => leaveToTitle("title")} />}
        {paused && g.phase !== "over" && <PauseMenu g={g} onResume={() => setPaused(false)} onHelp={() => setHelp(true)} onRestart={() => last.current && start({ ...last.current, tutorial: false })} onQuit={() => leaveToTitle("title")} />}
      </div>
    );
  } else body = null;

  return (
    <>
      <div id="shake-root" className="h-full w-full relative">
        {body}
        {help && <HelpModal onClose={() => setHelp(false)} />}
        {settings && <Modal z={90}><Title>⚙️ Settings</Title><SettingsPanel /><Btn kind="gold" className="mt-4 w-full" onClick={() => setSettings(false)}>Done</Btn></Modal>}
      </div>
      <FxCanvas />
    </>
  );
}
void getG;
