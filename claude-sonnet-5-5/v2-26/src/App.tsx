import { useCallback, useEffect, useMemo, useState } from "react";
import { audio } from "./game/audio";
import { buildJobSpec, newCampaign, nextGeneration, type JobReport } from "./game/campaign";
import { loadSave, writeSave } from "./game/save";
import type { Campaign, Contract, DiffId, JobSpec, MechType, Meta, ModId, Settings } from "./game/types";
import Game from "./components/Game";
import Hub from "./components/Hub";
import { Academy, NewGame, Title } from "./components/Menus";
import { HelpModal, SettingsModal } from "./components/Modals";
import { GameOver, Victory } from "./components/EndScreens";

type Screen = "title" | "new" | "hub" | "game" | "academy" | "practice" | "over" | "victory";

interface JobCtx {
  contract: Contract;
  mods: ModId[];
  spec: JobSpec;
  key: number;
}
interface PracticeCtx {
  type: MechType;
  spec: JobSpec;
  key: number;
}

function practiceSpec(type: MechType, s: Settings): JobSpec {
  return {
    mode: "practice",
    title: "Academy Lesson",
    theme: "odd",
    stages: [{ type, level: 2, seed: Math.floor(Math.random() * 1e9) }],
    timeLimit: 0,
    picks: 99,
    pickDur: 99,
    items: { oil: 0, smoke: 0, sand: 0, skeleton: 0 },
    tolMul: 1.3,
    noiseMul: 1,
    wearMul: 0,
    noiseDecay: 3,
    patrolEnabled: false,
    patrolInterval: 99,
    patrolReduce: 0,
    patrolWarn: 3,
    hint: 0,
    seed: Math.floor(Math.random() * 1e9),
    shake: s.shake,
    particles: s.particles,
  };
}

export default function App() {
  const initial = useMemo(() => loadSave(), []);
  const [meta, setMeta] = useState<Meta>(initial.meta);
  const [campaign, setCampaign] = useState<Campaign | null>(initial.campaign);
  const [screen, setScreen] = useState<Screen>("title");
  const [job, setJob] = useState<JobCtx | null>(null);
  const [practice, setPractice] = useState<PracticeCtx | null>(null);
  const [overlay, setOverlay] = useState<null | "settings" | "help">(null);
  const [endKind, setEndKind] = useState<"arrested" | "bankrupt">("arrested");
  const [finalCampaign, setFinalCampaign] = useState<Campaign | null>(null);
  const [victoryCampaign, setVictoryCampaign] = useState<Campaign | null>(null);

  // persistence
  useEffect(() => {
    writeSave(meta, campaign);
  }, [meta, campaign]);

  // audio settings
  useEffect(() => {
    const s = meta.settings;
    audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music, muted: s.muted });
  }, [meta.settings]);

  // unlock audio on first gesture
  useEffect(() => {
    const unlock = () => audio.init();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // music per screen
  useEffect(() => {
    if (screen === "game" || screen === "practice") audio.startMusic("job");
    else if (screen === "hub") audio.startMusic("hub");
    else audio.startMusic("menu");
    if (screen !== "game" && screen !== "practice") audio.setIntensity(0);
  }, [screen]);

  const setSettings = useCallback((s: Settings) => setMeta((m) => ({ ...m, settings: s })), []);

  const startNew = (house: string, diff: DiffId) => {
    const m: Meta = { ...meta, settings: { ...meta.settings, difficulty: diff } };
    setMeta(m);
    setCampaign(newCampaign(house, m.generation));
    setScreen("hub");
  };

  const startJob = (contract: Contract, mods: ModId[]) => {
    if (!campaign) return;
    const spec = buildJobSpec(campaign, contract, mods, meta.settings);
    setJob({ contract, mods, spec, key: Date.now() });
    setScreen("game");
  };

  const endGame = useCallback((c: Campaign, kind: "arrested" | "bankrupt") => {
    setEndKind(kind);
    setFinalCampaign(c);
    setCampaign(null);
    setMeta((m) => ({ ...m, bestRenown: Math.max(m.bestRenown, c.renown) }));
    setScreen("over");
  }, []);

  const jobDone = (c: Campaign, r: JobReport) => {
    setJob(null);
    if (r.victory) {
      setCampaign(c);
      setVictoryCampaign(c);
      setMeta((m) => ({ ...m, victories: m.victories + 1, bestRenown: Math.max(m.bestRenown, c.renown) }));
      setScreen("victory");
      return;
    }
    if (r.gameOver) {
      endGame(c, r.gameOver);
      return;
    }
    setCampaign(c);
    setMeta((m) => ({ ...m, bestRenown: Math.max(m.bestRenown, c.renown) }));
    setScreen("hub");
  };

  const startPractice = (type: MechType) => {
    setPractice({ type, spec: practiceSpec(type, meta.settings), key: Date.now() });
    setScreen("practice");
  };

  const markAcademy = (t: MechType) => setMeta((m) => (m.academy[t] ? m : { ...m, academy: { ...m.academy, [t]: true } }));

  const nextGen = () => {
    if (!victoryCampaign) return;
    const nc = nextGeneration(victoryCampaign);
    setMeta((m) => ({ ...m, generation: nc.generation }));
    setCampaign(nc);
    setVictoryCampaign(null);
    setScreen("hub");
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {screen === "title" && (
        <Title
          hasSave={!!campaign}
          meta={meta}
          onContinue={() => setScreen("hub")}
          onNew={() => setScreen("new")}
          onAcademy={() => setScreen("academy")}
          onHelp={() => setOverlay("help")}
          onSettings={() => setOverlay("settings")}
        />
      )}
      {screen === "new" && <NewGame meta={meta} hasSave={!!campaign} onStart={startNew} onBack={() => setScreen("title")} />}
      {screen === "academy" && <Academy meta={meta} onPick={startPractice} onBack={() => setScreen("title")} />}
      {screen === "hub" && campaign && (
        <Hub
          campaign={campaign}
          settings={meta.settings}
          onCampaign={setCampaign}
          onStartJob={startJob}
          onGameOver={endGame}
          onSettings={() => setOverlay("settings")}
          onHelp={() => setOverlay("help")}
          onQuit={() => setScreen("title")}
        />
      )}
      {screen === "game" && job && campaign && (
        <Game
          key={job.key}
          spec={job.spec}
          settings={meta.settings}
          campaign={campaign}
          contract={job.contract}
          mods={job.mods}
          onJobDone={jobDone}
          onLeave={() => setScreen("hub")}
          onOpenSettings={() => setOverlay("settings")}
          onOpenHelp={() => setOverlay("help")}
        />
      )}
      {screen === "practice" && practice && (
        <Game
          key={practice.key}
          spec={practice.spec}
          settings={meta.settings}
          practiceType={practice.type}
          onPracticeAgain={() => startPractice(practice.type)}
          onPracticeComplete={markAcademy}
          onLeave={() => setScreen("academy")}
          onOpenSettings={() => setOverlay("settings")}
          onOpenHelp={() => setOverlay("help")}
        />
      )}
      {screen === "over" && finalCampaign && (
        <GameOver kind={endKind} campaign={finalCampaign} onRetry={() => setScreen("new")} onTitle={() => setScreen("title")} />
      )}
      {screen === "victory" && victoryCampaign && (
        <Victory
          campaign={victoryCampaign}
          onContinue={() => setScreen("hub")}
          onNextGen={nextGen}
          onTitle={() => setScreen("title")}
        />
      )}
      {overlay === "settings" && <SettingsModal settings={meta.settings} onChange={setSettings} onClose={() => setOverlay(null)} />}
      {overlay === "help" && <HelpModal onClose={() => setOverlay(null)} />}
    </div>
  );
}
