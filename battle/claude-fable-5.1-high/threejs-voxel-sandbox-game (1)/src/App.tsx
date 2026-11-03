import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "./game/game";
import { store, useHud } from "./game/store";
import { loadSettings, saveSettings, type Settings, type WorldMeta } from "./game/save";
import { buildAtlas } from "./game/textures";
import { MainMenu, LoadingScreen, PauseMenu, DeathScreen } from "./ui/Menus";
import { HUD } from "./ui/HUD";
import { InventoryScreen } from "./ui/InventoryScreen";

buildAtlas();

export default function App() {
  const hud = useHud();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [, bump] = useState(0);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    gameRef.current?.applySettings(s);
  }, []);

  const play = useCallback(
    (meta: WorldMeta) => {
      if (!canvasRef.current) return;
      gameRef.current?.dispose();
      const game = new Game(canvasRef.current, meta, settings);
      gameRef.current = game;
      (window as unknown as { __game: Game }).__game = game;
      bump((n) => n + 1);
      game.start().catch((e) => {
        console.error(e);
        store.toast("Failed to start world", String(e));
        store.set({ screen: "menu" });
      });
    },
    [settings],
  );

  const quit = useCallback(() => {
    const g = gameRef.current;
    if (g) {
      g.save();
      g.dispose();
    }
    gameRef.current = null;
    store.set({ screen: "menu", toasts: [] });
  }, []);

  useEffect(() => {
    return () => gameRef.current?.dispose();
  }, []);

  const game = gameRef.current;
  const inGame = hud.screen !== "menu";
  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" style={{ visibility: inGame && hud.screen !== "loading" ? "visible" : "hidden" }} />
      {hud.screen === "menu" && <MainMenu settings={settings} onSettings={updateSettings} onPlay={play} />}
      {hud.screen === "loading" && <LoadingScreen />}
      {inGame && hud.screen !== "loading" && game && (
        <>
          <HUD onClickToPlay={() => game.requestLock()} />
          {hud.screen === "inventory" && <InventoryScreen game={game} />}
          {hud.screen === "paused" && <PauseMenu settings={settings} onSettings={updateSettings} onResume={() => game.resume()} onQuit={quit} stats={game.stats} achievements={game.achievements.size} />}
          {hud.screen === "dead" && <DeathScreen onRespawn={() => game.respawn()} onQuit={quit} />}
        </>
      )}
    </>
  );
}
