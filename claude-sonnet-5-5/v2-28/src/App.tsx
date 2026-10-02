import { useEffect, useState } from "react";
import { Title, Setup, Research, Help, SettingsPanel } from "./ui/Screens";
import { GameView } from "./ui/GameView";
import { audio } from "./game/audio";
import { getSave } from "./game/save";

type Screen = "title" | "setup" | "play" | "research" | "help" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState({ id: 0, difficulty: "farmer", mods: [] as string[], tutorial: false });
  const [, force] = useState(0);

  useEffect(() => {
    audio.setVolumes(getSave().settings);
    const unlock = () => {
      audio.init();
      audio.startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const start = (difficulty: string, mods: string[], tutorial: boolean) => {
    setRun((r) => ({ id: r.id + 1, difficulty, mods, tutorial }));
    setScreen("play");
  };

  return (
    <div className="ww-bg h-screen w-screen overflow-hidden text-white" style={{ fontFamily: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif" }}>
      {screen === "title" && <Title onPlay={() => setScreen("setup")} onResearch={() => setScreen("research")} onHelp={() => setScreen("help")} onSettings={() => setScreen("settings")} />}
      {screen === "setup" && <Setup onStart={start} onBack={() => setScreen("title")} />}
      {screen === "research" && <Research onBack={() => setScreen("title")} refresh={() => force((x) => x + 1)} />}
      {screen === "help" && (
        <div className="flex h-full w-full items-center justify-center p-3"><Help onClose={() => setScreen("title")} /></div>
      )}
      {screen === "settings" && (
        <div className="flex h-full w-full items-center justify-center p-3"><SettingsPanel onClose={() => setScreen("title")} /></div>
      )}
      {screen === "play" && (
        <GameView
          key={run.id}
          difficulty={run.difficulty}
          mods={run.mods}
          tutorial={run.tutorial}
          onExit={(to) => {
            if (to === "restart") {
              setRun((r) => ({ ...r, id: r.id + 1, tutorial: false }));
            } else setScreen(to);
          }}
        />
      )}
    </div>
  );
}
