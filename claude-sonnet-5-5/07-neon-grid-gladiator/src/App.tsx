import { useEffect, useReducer, useRef, useState } from "react";
import { Game, H, W } from "./game/engine";
import type { Mode } from "./game/engine";
import { EndOverlay, ForgeOverlay, MenuOverlay, PauseOverlay } from "./components/Overlays";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, {
      onMode: (m) => setMode(m),
      onChange: () => tick(),
    });
    setGame(g);
    return () => {
      g.destroy();
    };
  }, []);

  return (
    <div className="fixed inset-0 flex select-none items-center justify-center overflow-hidden bg-black font-mono text-white">
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-full w-full"
          style={{ cursor: mode === "playing" ? "none" : "default" }}
        />
      </div>

      {game && mode === "menu" && <MenuOverlay game={game} />}
      {game && mode === "paused" && <PauseOverlay game={game} />}
      {game && mode === "shop" && <ForgeOverlay game={game} />}
      {game && mode === "over" && <EndOverlay game={game} victory={false} />}
      {game && mode === "victory" && <EndOverlay game={game} victory />}

      {game && (
        <button
          onClick={(e) => {
            game.toggleMute();
            tick();
            (e.currentTarget as HTMLButtonElement).blur();
          }}
          className="fixed bottom-3 right-3 z-30 rounded border border-cyan-400/40 bg-black/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20"
        >
          {game.isMuted() ? "🔇 Muted" : "🔊 Sound"} <span className="text-slate-500">[M]</span>
        </button>
      )}
      {game && mode === "playing" && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-slate-600">
          WASD move · mouse aim/fire · space dash · P pause
        </div>
      )}
    </div>
  );
}
