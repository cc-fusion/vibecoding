import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Game, type GameCallbacks, type GameConfig } from './game/game';
import { SECTORS, UPGRADES, MAX_LEVEL, emptyUpgrades, mergeStats, newStats, upgradeCost, type Stats, type Upgrades } from './game/data';
import { sfx } from './game/audio';
import { Briefing, GameOver, Menu, Pause, Shop, Victory } from './game/screens';

type Screen = 'menu' | 'briefing' | 'playing' | 'paused' | 'shop' | 'gameover' | 'victory';

interface Run {
  sector: number;
  credits: number;
  upgrades: Upgrades;
  earned: number;
  stats: Stats;
}

const freshRun = (): Run => ({ sector: 1, credits: 40, upgrades: emptyUpgrades(), earned: 0, stats: newStats() });

const BEST_KEY = 'orbital-courier-best';
const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

function GameCanvas({ gameKey, cfg, cb, gameRef }: { gameKey: number; cfg: GameConfig; cb: GameCallbacks; gameRef: MutableRefObject<Game | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, cfgRef.current, {
      onClear: (r) => cbRef.current.onClear(r),
      onOver: (r) => cbRef.current.onOver(r),
      onPause: (p) => cbRef.current.onPause(p),
    });
    gameRef.current = g;
    return () => {
      g.destroy();
      if (gameRef.current === g) gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [run, setRun] = useState<Run>(freshRun);
  const [gameKey, setGameKey] = useState(0);
  const [sectorStats, setSectorStats] = useState<Stats>(newStats);
  const [fail, setFail] = useState<{ cause: string; stats: Stats; score: number }>({ cause: '', stats: newStats(), score: 0 });
  const [best, setBest] = useState(loadBest);
  const [isBest, setIsBest] = useState(false);
  const gameRef = useRef<Game | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const saveBest = useCallback((score: number) => {
    const prev = loadBest();
    if (score > prev) {
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        /* ignore */
      }
      setBest(score);
      return true;
    }
    return false;
  }, []);

  const cb: GameCallbacks = {
    onClear: ({ credits, stats }) => {
      const r = runRef.current;
      const next: Run = { ...r, credits, earned: r.earned + stats.earned, stats: mergeStats(r.stats, stats) };
      setRun(next);
      setSectorStats(stats);
      if (r.sector >= SECTORS.length) {
        setIsBest(saveBest(next.earned));
        setScreen('victory');
      } else {
        setScreen('shop');
      }
    },
    onOver: ({ cause, stats }) => {
      const r = runRef.current;
      const score = r.earned + stats.earned;
      saveBest(score);
      setFail({ cause, stats: mergeStats(r.stats, stats), score });
      setScreen('gameover');
    },
    onPause: (p) => setScreen(p ? 'paused' : 'playing'),
  };

  // audio needs a user gesture; any click on the page initialises it
  useEffect(() => {
    const init = () => sfx.init();
    window.addEventListener('pointerdown', init);
    return () => window.removeEventListener('pointerdown', init);
  }, []);

  const start = () => {
    sfx.init();
    sfx.accept();
    setRun(freshRun());
    setScreen('briefing');
  };

  const launch = () => {
    sfx.init();
    sfx.click();
    setGameKey((k) => k + 1);
    setScreen('playing');
  };

  const buy = (key: keyof Upgrades) => {
    const def = UPGRADES.find((u) => u.key === key);
    if (!def) return;
    const lvl = run.upgrades[key];
    const cost = upgradeCost(def, lvl);
    if (lvl >= MAX_LEVEL || run.credits < cost) {
      sfx.deny();
      return;
    }
    sfx.buy();
    setRun({ ...run, credits: run.credits - cost, upgrades: { ...run.upgrades, [key]: lvl + 1 } });
  };

  const inGame = screen === 'playing' || screen === 'paused';
  const cfg: GameConfig = { sector: run.sector, credits: run.credits, upgrades: run.upgrades };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none">
      {inGame && <GameCanvas gameKey={gameKey} cfg={cfg} cb={cb} gameRef={gameRef} />}
      {screen === 'menu' && <Menu onStart={start} best={best} />}
      {screen === 'briefing' && (
        <Briefing sector={run.sector} credits={run.credits} upgrades={run.upgrades} onLaunch={launch} onMenu={() => setScreen('menu')} />
      )}
      {screen === 'paused' && (
        <Pause
          onResume={() => {
            gameRef.current?.setPaused(false);
            setScreen('playing');
          }}
          onRestart={() => setScreen('briefing')}
          onQuit={() => setScreen('menu')}
        />
      )}
      {screen === 'shop' && (
        <Shop
          sector={run.sector}
          credits={run.credits}
          upgrades={run.upgrades}
          stats={sectorStats}
          onBuy={buy}
          onNext={() => {
            sfx.click();
            setRun({ ...run, sector: run.sector + 1 });
            setScreen('briefing');
          }}
        />
      )}
      {screen === 'gameover' && (
        <GameOver
          cause={fail.cause}
          stats={fail.stats}
          score={fail.score}
          best={best}
          sector={run.sector}
          onRetry={() => setScreen('briefing')}
          onMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'victory' && <Victory stats={run.stats} score={run.earned} best={best} isBest={isBest} onMenu={() => setScreen('menu')} />}
    </div>
  );
}
