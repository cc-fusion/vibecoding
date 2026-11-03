import { useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import { useGame } from './ui/common';
import { Hud, ChatInput, AdvScreen } from './ui/Hud';
import { MainMenu, Loading, PauseMenu, Death } from './ui/Menus';
import { InventoryScreen } from './ui/InventoryUI';

let singleton: Game | null = null;

function Root({ g }: { g: Game }) {
  useGame(g);
  const s = g.screen;
  return (
    <>
      {g.phase === 'menu' && <MainMenu g={g} />}
      {g.phase === 'loading' && <Loading g={g} />}
      {g.phase === 'playing' && (
        <>
          <Hud g={g} />
          {s === 'pause' && <PauseMenu g={g} />}
          {s === 'death' && <Death g={g} />}
          {s === 'chat' && <ChatInput g={g} />}
          {s === 'adv' && <AdvScreen g={g} />}
          {(s === 'inventory' || s === 'table' || s === 'furnace' || s === 'chest') && <InventoryScreen g={g} />}
        </>
      )}
    </>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(singleton);
  const [error, setError] = useState('');
  useEffect(() => {
    if (singleton || !canvasRef.current) return;
    try {
      singleton = new Game(canvasRef.current);
      (window as any).__game = singleton;
      singleton.startMenu();
      setGame(singleton);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    }
  }, []);
  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="game" tabIndex={-1} />
      {game && <Root g={game} />}
      {error && (
        <div className="fixed inset-0 flex items-center justify-center bg-black text-center p-8">
          <div><div className="text-2xl mb-2">WebGL could not start</div><div className="text-white/60 max-w-md">{error}</div></div>
        </div>
      )}
    </div>
  );
}
