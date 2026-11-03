import { useEffect, useRef, useState } from 'react';
import { Game, type UIState } from './game/game';
import { HUD } from './ui/HUD';
import { ContainerScreen } from './ui/Containers';
import { TitleScreen, LoadingScreen, PauseScreen, DeathScreen, SettingsModal, HelpModal } from './ui/Menus';
import { ItemIcon } from './ui/ItemIcon';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UIState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mouse, setMouse] = useState({ x: -100, y: -100 });

  useEffect(() => {
    if (!containerRef.current) return;
    const game = new Game(containerRef.current, (s) => setUi(s));
    gameRef.current = game;
    return () => { game.dispose(); gameRef.current = null; };
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  const game = gameRef.current;
  const inContainer = ui && ['inventory', 'crafting', 'furnace', 'chest'].includes(ui.screen);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0b0e13] text-white select-none" onContextMenu={(e) => e.preventDefault()}>
      <div ref={containerRef} className="absolute inset-0 [&>canvas]:block" />
      {!ui && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="font-pixel animate-pulse text-sm text-white/70">Loading VoxelCraft…</div>
        </div>
      )}
      {ui && game && (
        <>
          <HUD ui={ui} game={game} />
          {ui.screen === 'title' && <TitleScreen ui={ui} game={game} onSettings={() => setShowSettings(true)} onHelp={() => setShowHelp(true)} />}
          {ui.screen === 'loading' && <LoadingScreen ui={ui} />}
          {ui.screen === 'paused' && <PauseScreen ui={ui} game={game} onSettings={() => setShowSettings(true)} onHelp={() => setShowHelp(true)} />}
          {ui.screen === 'dead' && <DeathScreen ui={ui} game={game} />}
          {inContainer && <ContainerScreen ui={ui} game={game} />}
          {showSettings && <SettingsModal ui={ui} game={game} onClose={() => setShowSettings(false)} />}
          {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
          {ui.carry && (
            <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 22, top: mouse.y - 22 }}>
              <div className="relative">
                <ItemIcon id={ui.carry.id} size={44} />
                {ui.carry.count > 1 && (
                  <span className="absolute right-0 bottom-0 font-pixel text-[13px] text-white" style={{ textShadow: '1px 1px 0 #222' }}>
                    {ui.carry.count}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
