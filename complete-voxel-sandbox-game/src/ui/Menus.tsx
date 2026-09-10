import { useState } from "react";
import type { Game } from "@/game/Game";
import type { Settings } from "@/game/save";
import { Button, ControlsList, Panel, SettingsPanel, formatTime } from "./common";

export function PauseMenu({ game, onQuit }: { game: Game; onQuit: () => void }) {
  const [view, setView] = useState<"main" | "settings" | "controls">("main");
  const [settings, setSettings] = useState<Settings>(game.settings);
  const apply = (s: Settings) => {
    setSettings(s);
    game.applySettings(s);
  };
  const st = game.stats;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
      {view === "main" && (
        <Panel title="Game Paused" className="w-80">
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => game.closeScreen()}>
              Back to Game
            </Button>
            <Button onClick={() => game.save(true)}>Save World</Button>
            <Button onClick={() => setView("settings")}>Settings</Button>
            <Button onClick={() => setView("controls")}>Controls</Button>
            <Button
              variant="danger"
              onClick={() => {
                game.save(false);
                onQuit();
              }}
            >
              Save & Quit to Title
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-stone-600 pt-3 text-xs text-stone-300">
            <span>World</span>
            <span className="truncate text-right text-white">{game.meta.name}</span>
            <span>Seed</span>
            <span className="text-right text-white">{game.meta.seed}</span>
            <span>Play time</span>
            <span className="text-right text-white">{formatTime(st.playTime)}</span>
            <span>Blocks mined</span>
            <span className="text-right text-white">{st.blocksMined}</span>
            <span>Blocks placed</span>
            <span className="text-right text-white">{st.blocksPlaced}</span>
            <span>Items crafted</span>
            <span className="text-right text-white">{st.crafted}</span>
            <span>Deaths</span>
            <span className="text-right text-white">{st.deaths}</span>
          </div>
        </Panel>
      )}
      {view === "settings" && (
        <Panel title="Settings" className="w-96">
          <SettingsPanel settings={settings} onChange={apply} />
          <Button className="mt-4 w-full" onClick={() => setView("main")}>
            Done
          </Button>
        </Panel>
      )}
      {view === "controls" && (
        <Panel title="Controls" className="w-[28rem]">
          <ControlsList />
          <Button className="mt-4 w-full" onClick={() => setView("main")}>
            Done
          </Button>
        </Panel>
      )}
    </div>
  );
}

export function DeathScreen({ game, onQuit }: { game: Game; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-red-950/70">
      <div className="text-center">
        <h1 className="text-shadow mb-2 text-6xl font-black text-white">You died!</h1>
        <p className="mb-8 text-stone-200">Your items were dropped where you fell. Respawn to try again.</p>
        <div className="flex justify-center gap-3">
          <Button variant="primary" className="px-8 py-3 text-base" onClick={() => game.respawn()}>
            Respawn
          </Button>
          <Button
            className="px-8 py-3 text-base"
            onClick={() => {
              game.respawn();
              game.save(false);
              onQuit();
            }}
          >
            Title Screen
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900 text-white">
      <h1 className="mb-6 text-3xl font-black tracking-widest">VOXELCRAFT</h1>
      <div className="h-4 w-80 overflow-hidden rounded-sm border-2 border-stone-500 bg-stone-800">
        <div className="h-full bg-emerald-500 transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="mt-3 text-sm text-stone-300">{label}…</p>
      <p className="mt-10 max-w-md text-center text-xs text-stone-500">Tip: punch trees to get logs, craft planks and sticks, then a crafting table for tools. Coal + sticks make torches for the caves.</p>
    </div>
  );
}
