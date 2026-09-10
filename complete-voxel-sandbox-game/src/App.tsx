import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Game } from "@/game/Game";
import { Saves, type Settings, type WorldSave } from "@/game/save";
import { MainMenu } from "@/ui/MainMenu";
import { HUD } from "@/ui/HUD";
import { InventoryScreen } from "@/ui/InventoryScreen";
import { DeathScreen, LoadingScreen, PauseMenu } from "@/ui/Menus";

type Phase = "menu" | "loading" | "playing";

function useGameState(game: Game | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!game) return;
    return game.subscribe(force);
  }, [game]);
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [settings, setSettings] = useState<Settings>(() => Saves.settings());
  const [game, setGame] = useState<Game | null>(null);
  const [progress, setProgress] = useState({ p: 0, label: "Preparing" });
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  useGameState(game);

  const startWorld = useCallback(
    async (save: WorldSave) => {
      if (!containerRef.current || gameRef.current) return;
      setPhase("loading");
      setProgress({ p: 0, label: "Preparing" });
      const g = new Game(containerRef.current, save, settings);
      gameRef.current = g;
      setGame(g);
      try {
        await g.prepare((p, label) => setProgress({ p, label }));
      } catch (err) {
        console.error(err);
      }
      if (g.disposed) return;
      g.start();
      setPhase("playing");
      g.requestLock();
    },
    [settings],
  );

  const quit = useCallback(() => {
    const g = gameRef.current;
    if (g) {
      setSettings(g.settings);
      g.dispose();
      gameRef.current = null;
    }
    setGame(null);
    setPhase("menu");
  }, []);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    Saves.saveSettings(s);
    gameRef.current?.applySettings(s);
  };

  useEffect(() => {
    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans">
      <div ref={containerRef} className="absolute inset-0" />
      {phase === "menu" && <MainMenu onPlay={startWorld} settings={settings} onSettings={updateSettings} />}
      {phase === "loading" && <LoadingScreen progress={progress.p} label={progress.label} />}
      {phase === "playing" && game && (
        <>
          <HUD game={game} />
          {game.screen === "inventory" && <InventoryScreen game={game} />}
          {game.screen === "pause" && <PauseMenu game={game} onQuit={quit} />}
          {game.screen === "dead" && <DeathScreen game={game} onQuit={quit} />}
        </>
      )}
    </div>
  );
}
