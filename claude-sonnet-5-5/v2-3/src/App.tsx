import { useCallback, useEffect, useState } from "react";
import { audio } from "./game/audio";
import { Game } from "./game/engine";
import { loadSave } from "./game/save";
import type { RunConfig } from "./game/types";
import { GameView } from "./components/GameView";
import { ArchiveScreen, HelpScreen, PrepareScreen, SettingsScreen, TitleBackdrop, TitleScreen } from "./components/Screens";

type Screen = "title" | "prep" | "archive" | "help" | "settings" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [game, setGame] = useState<Game | null>(null);
  const [cfg, setCfg] = useState<RunConfig | null>(null);

  useEffect(() => {
    const s = loadSave().settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    const wake = () => {
      audio.resume();
      audio.startMusic();
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      audio.stopMusic();
    };
  }, []);

  const start = useCallback((c: RunConfig) => {
    audio.resume();
    audio.startMusic();
    audio.setMood({ sanity: 100, night: false, combat: false, boss: false, unwrite: 0 });
    audio.sfx("page");
    setCfg(c);
    setGame(new Game(c));
    setScreen("game");
  }, []);

  const toTitle = useCallback(() => {
    audio.setMood({ sanity: 100, night: false, combat: false, boss: false, unwrite: 0 });
    setGame(null);
    setScreen("title");
  }, []);

  return (
    <div className="fixed inset-0 bg-[#120d08] overflow-hidden">
      {screen === "title" && (
        <TitleScreen onPlay={() => setScreen("prep")} onArchive={() => setScreen("archive")} onHelp={() => setScreen("help")} onSettings={() => setScreen("settings")} />
      )}
      {screen === "prep" && <PrepareScreen onStart={start} onBack={() => setScreen("title")} />}
      {screen === "archive" && <ArchiveScreen onBack={() => setScreen("title")} />}
      {screen === "help" && (
        <div className="absolute inset-0">
          <TitleBackdrop />
          <HelpScreen onClose={() => setScreen("title")} />
        </div>
      )}
      {screen === "settings" && (
        <div className="absolute inset-0">
          <TitleBackdrop />
          <SettingsScreen onClose={() => setScreen("title")} />
        </div>
      )}
      {screen === "game" && game && (
        <GameView
          key={game.seed}
          g={game}
          onRetry={() => { const c = cfg ?? game.cfg; start({ ...c, tutorial: c.tutorial && !loadSave().tutorialDone }); }}
          onArchive={() => { setGame(null); setScreen("archive"); }}
          onTitle={toTitle}
        />
      )}
    </div>
  );
}
