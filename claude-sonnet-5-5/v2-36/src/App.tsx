import { useEffect, useReducer, useRef, useState } from 'react';
import { Game } from './game/engine';
import { audio } from './game/audio';
import { GameCanvas } from './ui/GameCanvas';
import { Hud } from './ui/Hud';
import { Dawn, Dusk, GameOver, Help, Legacy, NewGame, Pause, Settings, Title, Victory } from './ui/Screens';

type Ov = null | 'help' | 'settings' | 'newgame' | 'legacy';

export default function App() {
  const [game] = useState(() => new Game());
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [overlay, setOverlay] = useState<Ov>(null);
  const ovRef = useRef<Ov>(null);
  const phase = game.phase;
  const ov: Ov = phase === 'title' ? overlay : overlay === 'help' || overlay === 'settings' ? overlay : null;
  ovRef.current = ov;

  useEffect(() => game.subscribe(force), [game]);
  useEffect(() => { const id = window.setInterval(force, 140); return () => window.clearInterval(id); }, []);
  useEffect(() => {
    const onHelp = () => setOverlay('help');
    window.addEventListener('bow-help', onHelp);
    return () => window.removeEventListener('bow-help', onHelp);
  }, []);
  useEffect(() => {
    const unfocus = () => { const a = document.activeElement as HTMLElement | null; if (a && a.tagName === 'BUTTON') a.blur(); };
    window.addEventListener('pointerup', unfocus);
    return () => window.removeEventListener('pointerup', unfocus);
  }, []);
  useEffect(() => {
    const first = () => { audio.init(); audio.startMusic(); };
    window.addEventListener('pointerdown', first, { once: true });
    window.addEventListener('keydown', first, { once: true });
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' && e.code !== 'Escape') return;
      audio.init();
      if (e.code === 'Escape') {
        if (ovRef.current) { setOverlay(null); return; }
        if (game.phase === 'night') { if (game.paused) game.setPaused(false); else if (game.talk) game.closeTalk(); else game.setPaused(true); }
        return;
      }
      if (game.phase !== 'night') return;
      if (e.code === 'KeyM') { game.setVol({ muted: !audio.vol.muted }); return; }
      if (game.paused || ovRef.current) return;
      if (game.setKey(e.code, true)) { e.preventDefault(); return; }
      if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); game.interact(); }
      else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); game.dash(); }
      else if (e.code === 'KeyP') game.setPaused(true);
    };
    const up = (e: KeyboardEvent) => { game.setKey(e.code, false); };
    const blur = () => { game.keys = { up: false, down: false, left: false, right: false }; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [game]);

  const retry = () => { const d = game.run.diff; const m = game.run.mods.slice(); game.newRun(d, m); };
  const help = () => setOverlay('help');
  const settings = () => setOverlay('settings');

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07091a] select-none">
      <GameCanvas game={game} />
      {phase === 'night' && <Hud game={game} />}
      {phase === 'title' && <Title game={game} onNew={() => setOverlay('newgame')} onHelp={help} onSettings={settings} onLegacy={() => setOverlay('legacy')} />}
      {phase === 'dusk' && <Dusk game={game} onHelp={help} onSettings={settings} />}
      {phase === 'dawn' && <Dawn game={game} />}
      {phase === 'over' && <GameOver game={game} onRetry={retry} />}
      {phase === 'victory' && <Victory game={game} onRetry={retry} />}
      {phase === 'night' && game.paused && <Pause game={game} onHelp={help} onSettings={settings} />}
      {ov === 'newgame' && <NewGame game={game} onBack={() => setOverlay(null)} />}
      {ov === 'legacy' && <Legacy game={game} onBack={() => setOverlay(null)} />}
      {ov === 'help' && <Help onClose={() => setOverlay(null)} />}
      {ov === 'settings' && <Settings game={game} onClose={() => setOverlay(null)} />}
    </div>
  );
}
