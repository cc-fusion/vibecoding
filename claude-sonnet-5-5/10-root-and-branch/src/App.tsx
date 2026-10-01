import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import type { EndInfo, Snapshot } from './game/engine';
import { H, LEVELS, TOOLS, UPGRADES, W, emptyUpgrades, upgradeCost } from './game/data';
import type { ToolId, UpgradeId, Upgrades } from './game/data';
import { isMuted, setMuted, sfx, startDrone, stopDrone, unlockAudio } from './game/audio';

interface Save {
  spores: number;
  up: Upgrades;
  unlocked: number;
  cleared: number[];
}

const SAVE_KEY = 'root-and-branch-save-v1';

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      return {
        spores: s.spores ?? 0,
        up: { ...emptyUpgrades(), ...(s.up ?? {}) },
        unlocked: Math.min(LEVELS.length - 1, s.unlocked ?? 0),
        cleared: s.cleared ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return { spores: 0, up: emptyUpgrades(), unlocked: 0, cleared: [] };
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Screen = 'menu' | 'play' | 'result' | 'shop' | 'howto';

export default function App() {
  const [save, setSave] = useState<Save>(loadSave);
  const [screen, setScreen] = useState<Screen>('menu');
  const [level, setLevel] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<EndInfo | null>(null);
  const [shopFrom, setShopFrom] = useState<Screen>('menu');

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }, [save]);

  const startLevel = (i: number) => {
    unlockAudio();
    sfx.click();
    setLevel(i);
    setAttempt((a) => a + 1);
    setScreen('play');
  };

  const handleEnd = useCallback(
    (info: EndInfo) => {
      setResult(info);
      setSave((s) => ({
        ...s,
        spores: s.spores + info.spores,
        unlocked: info.won ? Math.max(s.unlocked, Math.min(LEVELS.length - 1, level + 1)) : s.unlocked,
        cleared: info.won && !s.cleared.includes(level) ? [...s.cleared, level] : s.cleared,
      }));
      setScreen('result');
    },
    [level],
  );

  const buy = (id: UpgradeId) => {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const lv = save.up[id];
    const cost = upgradeCost(def, lv);
    if (cost === null || save.spores < cost) {
      sfx.error();
      return;
    }
    sfx.buy();
    setSave((s) => ({ ...s, spores: s.spores - cost, up: { ...s.up, [id]: s.up[id] + 1 } }));
  };

  const resetSave = () => {
    if (window.confirm('Erase all progress and upgrades?')) {
      setSave({ spores: 0, up: emptyUpgrades(), unlocked: 0, cleared: [] });
    }
  };

  const openShop = (from: Screen) => {
    unlockAudio();
    sfx.click();
    setShopFrom(from);
    setScreen('shop');
  };

  const isFinalWin = !!result && result.won && level === LEVELS.length - 1;

  return (
    <div className="min-h-screen w-full bg-[#120d0a] text-stone-200 select-none" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {screen === 'menu' && (
        <Menu
          save={save}
          onStart={startLevel}
          onShop={() => openShop('menu')}
          onHow={() => {
            unlockAudio();
            sfx.click();
            setScreen('howto');
          }}
          onReset={resetSave}
        />
      )}
      {screen === 'howto' && <HowTo onBack={() => setScreen('menu')} />}
      {screen === 'shop' && (
        <Shop
          save={save}
          onBuy={buy}
          onBack={() => {
            sfx.click();
            setScreen(shopFrom === 'result' ? 'result' : 'menu');
          }}
        />
      )}
      {screen === 'play' && (
        <GameView key={`${level}-${attempt}`} levelIdx={level} up={save.up} onEnd={handleEnd} onQuit={() => setScreen('menu')} />
      )}
      {screen === 'result' && result && (
        <Result
          info={result}
          level={level}
          final={isFinalWin}
          spores={save.spores}
          onNext={() => startLevel(Math.min(LEVELS.length - 1, level + 1))}
          onRetry={() => startLevel(level)}
          onShop={() => openShop('result')}
          onMenu={() => {
            sfx.click();
            setScreen('menu');
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ menu
function Menu(props: { save: Save; onStart: (i: number) => void; onShop: () => void; onHow: () => void; onReset: () => void }) {
  const { save } = props;
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a2f4a] via-[#8a5a50] to-[#1a110c]" style={{ backgroundSize: '100% 100%' }} />
      <div className="absolute left-0 right-0 bottom-0 h-[62%] bg-gradient-to-b from-[#3a2418] to-[#0e0807]" />
      <div className="absolute left-0 right-0 bottom-[62%] h-2 bg-[#3f7a3a]" />
      <svg className="absolute left-0 bottom-0 w-full h-[62%] opacity-80" viewBox="0 0 800 400" preserveAspectRatio="none">
        <g stroke="#f4f1d0" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8">
          <path d="M400 0 C 380 60, 420 90, 400 140 S 360 220, 300 250 S 220 300, 160 340" />
          <path d="M400 140 C 440 190, 500 200, 540 250 S 600 330, 680 360" />
          <path d="M300 250 C 330 300, 310 340, 340 400" />
          <path d="M540 250 C 520 300, 560 340, 520 400" />
          <path d="M400 60 C 450 80, 480 70, 520 90" />
        </g>
        <circle cx="400" cy="140" r="9" fill="#ffd88a" />
        <circle cx="400" cy="140" r="26" fill="#ffd88a" opacity="0.18" />
      </svg>
      <div className="relative z-10 text-center max-w-3xl">
        <div className="text-7xl mb-2 drop-shadow-lg">🍄</div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-wide text-amber-100" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
          Root &amp; Branch
        </h1>
        <p className="mt-3 text-lg sm:text-xl text-amber-100/90 italic" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          Grow a fungal network beneath the town. Undermine every foundation. Evade the exterminators.
        </p>

        <div className="mt-8 bg-black/55 backdrop-blur rounded-2xl p-5 border border-amber-200/20">
          <div className="text-sm uppercase tracking-widest text-amber-200/70 mb-3">Choose a town</div>
          <div className="grid gap-2">
            {LEVELS.map((l, i) => {
              const locked = i > save.unlocked;
              const done = save.cleared.includes(i);
              return (
                <button
                  key={i}
                  disabled={locked}
                  onClick={() => props.onStart(i)}
                  className={`text-left px-4 py-3 rounded-xl border transition flex items-center gap-3 ${
                    locked
                      ? 'border-stone-700 bg-stone-900/60 text-stone-500 cursor-not-allowed'
                      : i === save.unlocked
                        ? 'border-amber-300/70 bg-amber-300/10 hover:bg-amber-300/20 text-amber-100'
                        : 'border-stone-600 bg-stone-800/50 hover:bg-stone-700/60 text-stone-200'
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{locked ? '🔒' : done ? '✅' : '🏘️'}</span>
                  <span className="flex-1">
                    <span className="block font-bold">
                      {i + 1}. {l.name}
                    </span>
                    <span className="block text-xs opacity-75">{l.subtitle}</span>
                  </span>
                  {!locked && <span className="text-xs text-amber-200/80">{i === save.unlocked && !done ? 'PLAY ▸' : 'REPLAY ▸'}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <button onClick={props.onShop} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold">
              🧬 Mutations ({save.spores} spores)
            </button>
            <button onClick={props.onHow} className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white font-bold">
              📖 How to Play
            </button>
            <button onClick={props.onReset} className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-red-900/70 text-stone-400 text-sm">
              Reset progress
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ how to
function HowTo({ onBack }: { onBack: () => void }) {
  const items: [string, string][] = [
    ['🎯 Goal', 'Collapse every building on the surface. Each has foundation stone (grey bricks) beneath it. Roots growing inside that stone erode the building until it falls.'],
    ['🕸️ Growing', 'Pick Hypha, then click soil cells touching your network (or drag to paint a path). Growth takes a moment and costs nutrients. Bedrock blocks you until an Acid Cyst dissolves it.'],
    ['💰 Nutrients', 'Your Mother Heart and every connected root absorb nutrients. Humus and water pockets are rich; buried carcasses give a one-off feast. Roots cut off from the heart wither and die.'],
    ['☣️ Poison', 'Exterminators from Guilds walk the surface and inject poison that seeps down through the soil. Poison kills roots. Rock blocks it, water dilutes it, Antidote Glands neutralise it, Rhizomorphs resist it.'],
    ['🍄 Fruiting Bodies', 'Place on the surface row. Exterminators hunt them first, and they puff toxic spores that sicken anything nearby. Cheap bait and defence in one.'],
    ['🧂 Salt Wards', 'Towers, chapels and the Keep emit a salt ward that burns roots inside its dashed circle. Thick roots and antidote glands blunt it. Collapse the building and the ward dies.'],
    ['✈️ Crop Duster', 'In later towns a plane sweeps the surface dropping poison on the top rows. Keep your shallow roots thick or protected.'],
    ['🧬 Mutations', 'Collapsing buildings earns spores. Spend them on permanent mutations between towns. Even a defeat banks half your spores.'],
    ['⌨️ Controls', '1–5 select tools • Click / drag to use • Space pauses • F toggles 2x speed.'],
  ];
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-stone-900/90 border border-amber-200/20 rounded-2xl p-6">
        <h2 className="text-3xl font-bold text-amber-100 mb-4">How to Play</h2>
        <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-2">
          {items.map(([t, d]) => (
            <div key={t} className="bg-black/30 rounded-lg p-3">
              <div className="font-bold text-amber-200">{t}</div>
              <div className="text-sm text-stone-300">{d}</div>
            </div>
          ))}
        </div>
        <button onClick={onBack} className="mt-5 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-bold text-white">
          ◂ Back
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shop
function Shop({ save, onBuy, onBack }: { save: Save; onBuy: (id: UpgradeId) => void; onBack: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-stone-900/90 border border-emerald-300/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-3xl font-bold text-emerald-200">🧬 Mutations</h2>
          <div className="px-4 py-2 rounded-full bg-emerald-900/60 border border-emerald-400/30 text-emerald-100 font-bold">✨ {save.spores} spores</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {UPGRADES.map((u) => {
            const lv = save.up[u.id];
            const cost = upgradeCost(u, lv);
            const can = cost !== null && save.spores >= cost;
            return (
              <div key={u.id} className="bg-black/35 rounded-xl p-4 border border-stone-700">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{u.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-amber-100">{u.name}</div>
                    <div className="text-xs text-stone-400 mb-2">{u.desc}</div>
                    <div className="flex gap-1">
                      {u.costs.map((_, k) => (
                        <div key={k} className={`h-2 w-7 rounded ${k < lv ? 'bg-emerald-400' : 'bg-stone-700'}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    disabled={!can}
                    onClick={() => onBuy(u.id)}
                    className={`px-3 py-2 rounded-lg font-bold text-sm min-w-[84px] ${
                      cost === null ? 'bg-stone-800 text-stone-500' : can ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {cost === null ? 'MAX' : `✨ ${cost}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onBack} className="mt-5 px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 font-bold text-white">
          ◂ Back
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ result
function Result(props: {
  info: EndInfo;
  level: number;
  final: boolean;
  spores: number;
  onNext: () => void;
  onRetry: () => void;
  onShop: () => void;
  onMenu: () => void;
}) {
  const { info, level, final } = props;
  const won = info.won;
  useEffect(() => {
    stopDrone();
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className={`absolute inset-0 ${won ? 'bg-gradient-to-b from-[#3a3a1a] to-[#120d0a]' : 'bg-gradient-to-b from-[#2a3a10] to-[#120d0a]'}`} />
      <div className="relative max-w-xl w-full bg-stone-900/90 border border-amber-200/20 rounded-2xl p-7 text-center">
        <div className="text-6xl mb-2">{won ? (final ? '👑' : '🏚️') : '☠️'}</div>
        <h2 className={`text-4xl font-bold mb-1 ${won ? 'text-amber-200' : 'text-lime-300'}`}>
          {final ? 'The Edict is Broken!' : won ? 'Town Undermined!' : 'The Heart Has Fallen'}
        </h2>
        <p className="text-stone-400 italic mb-5">
          {final
            ? 'Crown City lies in ruins. Your mycelium now spans the whole kingdom. Nothing will ever clear it out again.'
            : won
              ? `${LEVELS[level].name} is nothing but rubble and mushrooms.`
              : 'The exterminators prevail... for now. The spores you gathered live on.'}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm mb-5">
          <Stat label="Buildings toppled" value={`${info.collapsed}/${info.total}`} />
          <Stat label="Exterminators dispatched" value={`${info.kills}`} />
          <Stat label="Time" value={fmtTime(info.time)} />
          <Stat label={won ? `Spores (incl. +${info.bonus} bonus)` : 'Spores (half kept)'} value={`✨ ${info.spores}`} />
        </div>
        <div className="text-emerald-300 mb-4 font-bold">Spore bank: ✨ {props.spores}</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {won && !final && (
            <button onClick={props.onNext} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
              Next Town ▸
            </button>
          )}
          <button onClick={props.onRetry} className="px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 font-bold text-white">
            {won ? 'Replay' : 'Try Again'}
          </button>
          <button onClick={props.onShop} className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 font-bold text-white">
            🧬 Mutations
          </button>
          <button onClick={props.onMenu} className="px-5 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 font-bold text-white">
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/35 rounded-lg p-3">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-xl font-bold text-amber-100">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------------ game view
function GameView(props: { levelIdx: number; up: Upgrades; onEnd: (e: EndInfo) => void; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const onEndRef = useRef(props.onEnd);
  onEndRef.current = props.onEnd;
  const speedRef = useRef(1);
  const draggingRef = useRef(false);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tool, setTool] = useState<ToolId>('grow');
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [helpTool, setHelpTool] = useState<ToolId | null>(null);

  useEffect(() => {
    const game = new Game(props.levelIdx, props.up, (e) => onEndRef.current(e));
    gameRef.current = game;
    startDrone();
    const canvas = canvasRef.current as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      let rem = dt * speedRef.current;
      while (rem > 0) {
        const s = Math.min(0.05, rem);
        game.update(s);
        rem -= s;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      game.draw(g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = window.setInterval(() => setSnap(game.snapshot()), 120);
    setSnap(game.snapshot());

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tdef = TOOLS.find((x) => x.key === k);
      if (tdef) {
        setTool(tdef.id);
        sfx.click();
      } else if (k === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (k === 'f') {
        setSpeed((s) => (s === 1 ? 2 : 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
      window.removeEventListener('keydown', onKey);
      stopDrone();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gameRef.current) gameRef.current.tool = tool;
  }, [tool]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = paused;
  }, [paused]);

  const toCell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    return gameRef.current ? gameRef.current.cellAt(px, py) : null;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    const game = gameRef.current;
    if (!game) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    const cell = toCell(e);
    game.hover = cell;
    if (cell) game.useTool(cell.c, cell.r, false);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = gameRef.current;
    if (!game) return;
    const cell = toCell(e);
    game.hover = cell;
    if (draggingRef.current && cell && game.tool === 'grow') game.useTool(cell.c, cell.r, true);
  };
  const onUp = () => {
    draggingRef.current = false;
  };
  const onLeave = () => {
    if (gameRef.current) gameRef.current.hover = null;
  };

  const level = LEVELS[props.levelIdx];
  const heartPct = snap ? (snap.heartHp / snap.heartMax) * 100 : 100;

  return (
    <div className="min-h-screen flex flex-col items-center py-2 px-2">
      <div className="w-full max-w-[1100px]">
        {/* HUD */}
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-amber-200/20">
            <span className="text-amber-200 font-bold">{level.name}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-400/30 font-bold text-emerald-200" title="Nutrients">
            🌿 {snap ? snap.nutrients : 0} <span className="text-emerald-400/70 text-xs">+{snap ? snap.income.toFixed(1) : '0.0'}/s</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-stone-700 flex items-center gap-2" title="Mother Heart health">
            ❤️
            <div className="w-28 h-3 rounded bg-stone-800 overflow-hidden">
              <div className={`h-full ${heartPct > 50 ? 'bg-lime-400' : heartPct > 25 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${heartPct}%` }} />
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-stone-700" title="Buildings standing">
            🏰 {snap ? snap.left : 0}/{snap ? snap.total : 0} standing
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-stone-700" title="Exterminators on the surface">
            🧑‍🚒 {snap ? snap.ext : 0}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-stone-700" title="Spores earned this run">
            ✨ {snap ? snap.spores : 0}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-stone-700">⏱ {snap ? fmtTime(snap.time) : '0:00'}</div>
          <div className="flex-1" />
          <button onClick={() => setPaused((p) => !p)} className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 font-bold">
            {paused ? '▶' : '⏸'}
          </button>
          <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} className={`px-3 py-1.5 rounded-lg font-bold ${speed === 2 ? 'bg-amber-600' : 'bg-stone-700 hover:bg-stone-600'}`}>
            {speed}x
          </button>
          <button
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Abandon this town and return to the menu?')) props.onQuit();
            }}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-red-900 text-stone-300"
          >
            ✕
          </button>
        </div>

        {/* Canvas */}
        <div className="relative rounded-xl overflow-hidden border-2 border-amber-900/60 shadow-2xl bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full block touch-none"
            style={{ cursor: 'crosshair' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
          {snap && snap.msg && !snap.over && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/70 text-amber-100 text-sm border border-amber-200/30 pointer-events-none whitespace-nowrap max-w-[95%] overflow-hidden text-ellipsis">
              {snap.msg}
            </div>
          )}
          {snap && snap.warning && (
            <div className="absolute inset-0 pointer-events-none border-4 border-red-500/70 animate-pulse rounded-xl" />
          )}
          {paused && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
              <div className="text-5xl font-bold text-amber-100">Paused</div>
              <button onClick={() => setPaused(false)} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
                Resume
              </button>
            </div>
          )}
          {snap && snap.over && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="text-4xl font-bold text-amber-100 drop-shadow-lg animate-pulse">…</div>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="mt-2 text-center text-sm text-amber-100/80 italic min-h-[1.25rem]">{snap ? snap.hint : ''}</div>

        {/* Toolbar */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TOOLS.map((t) => {
            const afford = snap ? snap.nutrients >= t.cost : true;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTool(t.id);
                  sfx.click();
                }}
                onMouseEnter={() => setHelpTool(t.id)}
                onMouseLeave={() => setHelpTool(null)}
                className={`relative text-left px-3 py-2 rounded-xl border-2 transition ${
                  tool === t.id ? 'border-amber-300 bg-amber-300/15' : 'border-stone-700 bg-stone-900/80 hover:border-stone-500'
                }`}
              >
                <span className="absolute top-1 right-2 text-[10px] text-stone-500">[{t.key}]</span>
                <div className="text-lg leading-none">{t.icon}</div>
                <div className="font-bold text-sm text-amber-100">{t.name}</div>
                <div className={`text-xs ${afford ? 'text-emerald-300' : 'text-red-400'}`}>🌿 {t.cost}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-stone-400 text-center min-h-[2.5rem]">
          {TOOLS.find((t) => t.id === (helpTool ?? tool))?.desc}
        </div>
      </div>
    </div>
  );
}
