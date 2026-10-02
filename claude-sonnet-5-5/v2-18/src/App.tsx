import { useEffect, useState } from "react";
import { PlayScreen } from "./components/PlayScreen";
import { CampaignScreen, GameOverScreen, HelpScreen, ResultScreen, SettingsPanel, TitleScreen, VictoryScreen } from "./components/Screens";
import { audio } from "./lib/audio";
import { G, applyAudioSettings, meta, newCareer, startCase, useStore } from "./lib/store";

type Screen = "title" | "help" | "campaign" | "play" | "result" | "gameover" | "victory";

export default function App() {
  useStore();
  const [screen, setScreen] = useState<Screen>("title");
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    applyAudioSettings();
    const unlock = () => {
      audio.init();
      applyAudioSettings();
      audio.startMusic();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (screen !== "play") audio.setMood("menu", screen === "gameover" ? 0.55 : screen === "victory" ? 0.05 : 0.12);
  }, [screen]);

  const play = (idx: number, mode: "career" | "replay" | "cold" | "tutorial", seed?: number) => {
    audio.init();
    startCase(idx, mode, seed);
    setScreen("play");
  };
  const tutorial = () => play(0, "tutorial");
  const newCareerFlow = () => {
    newCareer();
    if (!meta.tutorialDone) tutorial();
    else setScreen("campaign");
  };
  const cold = () => play(6 + meta.cold, "cold");
  const retry = () => {
    const r = G.run;
    if (!r) return setScreen("title");
    play(r.def.idx, r.mode, r.def.seed);
  };
  const finish = () => {
    const r = G.run && G.run.result;
    if (!r) return;
    setScreen(r.next === "gameover" ? "gameover" : r.next === "victory" ? "victory" : "result");
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {screen === "title" && (
        <TitleScreen go={(s) => setScreen(s)} onNew={newCareerFlow} onTutorial={tutorial} onCold={cold} onContinue={() => setScreen("campaign")} />
      )}
      {screen === "help" && <HelpScreen back={() => setScreen("title")} />}
      {screen === "campaign" && (
        <CampaignScreen back={() => setScreen("title")} onPlay={(idx, replay) => play(idx, replay ? "replay" : "career")} onNew={newCareerFlow} onCold={cold} onSettings={() => setSettings(true)} />
      )}
      {screen === "play" && G.run && <PlayScreen onFinish={finish} onQuit={() => setScreen("title")} onRestart={retry} />}
      {screen === "result" && <ResultScreen onNext={() => setScreen("campaign")} onRetry={retry} onMenu={() => setScreen("title")} />}
      {screen === "gameover" && <GameOverScreen onNew={newCareerFlow} onMenu={() => setScreen("title")} onGym={() => setScreen("campaign")} />}
      {screen === "victory" && <VictoryScreen onCold={cold} onMenu={() => setScreen("title")} onGym={() => setScreen("campaign")} />}
      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
    </div>
  );
}
