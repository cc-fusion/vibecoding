import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { RunConfig, RunResult } from '../game/engine';
import type { Settings } from '../game/data';
import { audio } from '../game/audio';
import { Btn, Modal, Title } from './common';
import { HelpPanel, SettingsPanel } from './Settings';

function TB({ label, act, game, className = '', sub }: { label: string; act: string; game: React.RefObject<Game | null>; className?: string; sub?: string }) {
  return (
    <button
      className={`select-none rounded-full border-2 border-cyan-300/60 bg-black/40 text-cyan-100 font-display font-bold active:bg-cyan-400/40 flex flex-col items-center justify-center ${className}`}
      style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); audio.init(); game.current?.press(act); }}
      onPointerUp={() => game.current?.release(act)} onPointerCancel={() => game.current?.release(act)} onLostPointerCapture={() => game.current?.release(act)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="text-sm leading-none">{label}</span>{sub && <span className="text-[9px] opacity-70 leading-none mt-0.5">{sub}</span>}
    </button>
  );
}

export function GameView({ cfg, settings, onSettings, onEnd, onRestart }: {
  cfg: RunConfig; settings: Settings; onSettings: (s: Settings) => void; onEnd: (r: RunResult) => void; onRestart: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [paused, setPaused] = useState(false);
  const [sub, setSub] = useState<null | 'settings' | 'help' | 'abandon'>(null);
  const endRef = useRef(onEnd); endRef.current = onEnd;
  const touch = settings.touch === 'on' || (settings.touch === 'auto' && typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));

  useEffect(() => {
    const canvas = ref.current!;
    const g = new Game(canvas, cfg, { onEnd: (r) => endRef.current(r), onPause: () => setPaused(true), onResume: () => { setPaused(false); setSub(null); } });
    game.current = g; g.start();
    return () => { g.destroy(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { game.current?.setSettings(settings); }, [settings]);

  const resume = () => { setSub(null); game.current?.resume(); setPaused(false); };
  return (
    <div className="relative h-full w-full bg-black overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={ref} className="w-full h-full" style={{ touchAction: 'none' }} tabIndex={0} />
      <button className="absolute top-2 right-2 z-10 w-11 h-11 rounded-md border border-cyan-300/60 bg-black/50 text-cyan-200 font-display text-lg hover:bg-cyan-400/30"
        onClick={() => { audio.init(); game.current?.togglePause(); }} aria-label="Pause">⏸</button>
      {touch && !paused && (
        <>
          <div className="absolute left-3 bottom-24 flex flex-col gap-3 z-10">
            <TB label="SLIDE" act="slide" game={game} className="w-16 h-16" />
            <TB label="BRAKE" act="brake" game={game} className="w-16 h-16" />
          </div>
          <div className="absolute right-3 bottom-4 z-10 flex items-end gap-3">
            <div className="flex flex-col gap-3">
              <TB label="DASH" act="dash" game={game} className="w-16 h-16" />
              <TB label="HACK" act="hack" game={game} className="w-16 h-16 !border-green-300/70" />
            </div>
            <TB label="JUMP" act="jump" game={game} className="w-24 h-24 !border-pink-300/70" sub="hold: wall-run" />
          </div>
          <div className="absolute right-3 top-16 z-10 flex flex-col gap-2">
            <TB label="EMP" act="emp" game={game} className="w-12 h-12 text-xs" />
            <TB label="SMOKE" act="smoke" game={game} className="w-12 h-12 text-[10px]" />
          </div>
        </>
      )}
      {paused && (
        <Modal onClose={() => { /* must use buttons */ }}>
          {sub === null && (
            <div className="space-y-3 text-center">
              <Title color="#28e0ff" size="text-3xl">PAUSED</Title>
              <div className="text-xs text-indigo-300/70">The city waits for no one — but it will wait for you.</div>
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <Btn solid onClick={resume}>▶ Resume</Btn>
                <Btn color="#ffb02e" onClick={() => setSub('help')}>Controls &amp; Help</Btn>
                <Btn color="#c9c4ff" onClick={() => setSub('settings')}>Settings</Btn>
                <Btn color="#7dff6b" onClick={() => { game.current?.destroy(); onRestart(); }}>↻ Restart run</Btn>
                <Btn color="#ff3355" onClick={() => setSub('abandon')}>Abandon contract</Btn>
              </div>
            </div>
          )}
          {sub === 'settings' && <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setSub(null)} showDifficulty />}
          {sub === 'help' && <HelpPanel onClose={() => setSub(null)} />}
          {sub === 'abandon' && (
            <div className="text-center space-y-3">
              <Title color="#ff3355">Abandon contract?</Title>
              <div className="text-sm text-indigo-100/80">{cfg.tutorial ? 'You will return to the menu.' : 'The client loses trust (−3 rep) and the Sentinels notice (+2% notoriety). Gadgets used stay used.'}</div>
              <div className="flex gap-2 justify-center"><Btn color="#ff3355" onClick={() => game.current?.abandon()}>Abandon</Btn><Btn onClick={() => setSub(null)}>Keep running</Btn></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
