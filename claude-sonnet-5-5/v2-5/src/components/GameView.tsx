import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import { Game, type HudState, type Mods } from '../game/engine';
import { drawGame } from '../game/render';
import type { DiffId } from '../game/defs';
import type { SaveData, Settings } from '../game/save';
import EndScreen from './EndScreen';
import Help from './Help';
import { Hotbar, Inspector, Overlays, PauseMenu, SidePanel, TechModal, TopBar } from './Hud';
import SettingsPanel from './SettingsPanel';

export interface RunConfig {
  diff: DiffId;
  mods: Mods;
  tutorial: boolean;
  seed: number;
}

type Ov = 'none' | 'pause' | 'tech' | 'help' | 'settings' | 'end';

export default function GameView({
  cfg,
  settings,
  onSettings,
  save,
  onSave,
  onRetry,
  onTitle,
}: {
  cfg: RunConfig;
  settings: Settings;
  onSettings: (s: Settings) => void;
  save: SaveData;
  onSave: (s: SaveData) => void;
  onRetry: () => void;
  onTitle: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [overlay, setOverlay] = useState<Ov>('none');
  const [end, setEnd] = useState<{ kind: 'victory' | 'defeat'; lp: number } | null>(null);
  const [showSide, setShowSide] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const fromPause = useRef(false);
  const saveRef = useRef(save);
  const settingsRef = useRef(settings);
  const onSaveRef = useRef(onSave);
  const onSettingsRef = useRef(onSettings);
  const counted = useRef({ run: false, kills: 0, tut: false });
  saveRef.current = save;
  settingsRef.current = settings;
  onSaveRef.current = onSave;
  onSettingsRef.current = onSettings;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const handleMenu = (m: 'pause' | 'tech' | 'help') => {
      setOverlay((o) => {
        if (o === 'end') return o;
        if (o === 'none') {
          fromPause.current = false;
          return m;
        }
        if (m === 'pause') {
          if ((o === 'help' || o === 'settings') && fromPause.current) return 'pause';
          return 'none';
        }
        return m === o ? 'none' : o;
      });
    };
    const g = new Game(
      { diff: cfg.diff, mods: { ...cfg.mods }, tutorial: cfg.tutorial, upgrades: saveRef.current.upgrades, settings: settingsRef.current, seed: cfg.seed },
      {
        onEnd: (kind) => {
          const gain = Math.max(0, g.legacyEarned() - g.lpAwarded);
          g.lpAwarded += gain;
          const s = saveRef.current;
          const c = counted.current;
          const ns: SaveData = {
            ...s,
            legacy: s.legacy + gain,
            best: {
              wave: Math.max(s.best.wave, g.stats.waves),
              score: Math.max(s.best.score, g.score()),
              wins: s.best.wins + (kind === 'victory' ? 1 : 0),
              runs: s.best.runs + (c.run ? 0 : 1),
              kills: s.best.kills + (g.stats.kills - c.kills),
            },
          };
          c.run = true;
          c.kills = g.stats.kills;
          saveRef.current = ns;
          onSaveRef.current(ns);
          setEnd({ kind, lp: gain });
          setOverlay('end');
        },
        onMenu: handleMenu,
        onMute: () => onSettingsRef.current({ ...settingsRef.current, muted: !settingsRef.current.muted }),
      },
      drawGame,
    );
    gameRef.current = g;
    g.attach(canvas);
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      g.resize(r.width, r.height, Math.min(2, window.devicePixelRatio || 1));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    measure();
    audio.ensure();
    audio.startMusic();
    setHud(g.hud());
    const iv = window.setInterval(() => {
      setHud(g.hud());
      if (g.tutDone && !counted.current.tut) {
        counted.current.tut = true;
        const s = saveRef.current;
        const ns = { ...s, tutorialDone: true };
        saveRef.current = ns;
        onSaveRef.current(ns);
      }
    }, 100);
    return () => {
      window.clearInterval(iv);
      ro.disconnect();
      g.detach();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = gameRef.current;
    if (g) g.paused = overlay === 'pause' || overlay === 'tech' || overlay === 'help' || overlay === 'settings';
  }, [overlay]);

  useEffect(() => {
    const g = gameRef.current;
    if (g) g.opts.settings = settings;
  }, [settings]);

  const g = gameRef.current;
  const closeToGame = () => setOverlay('none');
  const sub = (o: Ov) => {
    fromPause.current = overlay === 'pause';
    setOverlay(o);
  };
  const back = () => setOverlay(fromPause.current ? 'pause' : 'none');

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" style={{ touchAction: 'none', cursor: hud?.tool === 'erase' ? 'not-allowed' : hud?.tool && hud.tool !== 'select' ? 'crosshair' : 'default' }} />
      </div>
      {hud && g && (
        <>
          <TopBar h={hud} g={g} onMenu={(m) => (m === 'pause' ? sub('pause') : sub('tech'))} />
          {showSide && <SidePanel h={hud} g={g} />}
          <button
            className="absolute right-2 top-[2.9rem] z-30 rounded-md border border-white/10 bg-slate-900/85 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
            onClick={() => setShowSide((s) => !s)}
          >
            {showSide ? 'Hide panel ▸' : '◂ Ring control'}
          </button>
          <Hotbar h={hud} g={g} />
          <Inspector h={hud} g={g} />
          <Overlays h={hud} onSkipTutorial={() => g.skipTutorial()} />
          {overlay === 'pause' && (
            <PauseMenu
              h={hud}
              g={g}
              onResume={closeToGame}
              onHelp={() => sub('help')}
              onSettings={() => sub('settings')}
              onRestart={() => {
                if (window.confirm('Restart this run? Progress in this run will be lost.')) onRetry();
              }}
              onTitle={() => {
                if (window.confirm('Quit to the title screen? Progress in this run will be lost.')) onTitle();
              }}
            />
          )}
          {overlay === 'tech' && <TechModal h={hud} g={g} onClose={closeToGame} />}
          {overlay === 'help' && <Help onClose={back} />}
          {overlay === 'settings' && <SettingsPanel settings={settings} onChange={onSettings} onClose={back} />}
          {overlay === 'end' && end && (
            <EndScreen
              game={g}
              kind={end.kind}
              lp={end.lp}
              onRetry={onRetry}
              onTitle={onTitle}
              onContinue={() => {
                g.continueEndless();
                setEnd(null);
                setOverlay('none');
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
