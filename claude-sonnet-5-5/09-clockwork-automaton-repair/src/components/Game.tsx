import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell, DEFS, MANUAL_ORDER, SimResult, simulate } from '../game/engine';
import { LevelDef, parseLevel } from '../game/levels';
import { Stats } from '../game/save';
import { sfx } from '../game/audio';
import Tile, { buildInfos } from './Tile';
import { Gauge, Robot, RobotMood } from './Hud';

export interface FinishInfo {
  won: boolean;
  pressure: number;
  stars: number;
  score: number;
}
export interface Award {
  cogs: number;
  newBest: boolean;
  note?: string;
}

interface GameProps {
  level: LevelDef;
  seed: number;
  stats: Stats;
  mode: 'campaign' | 'overtime';
  index: number; // level index (campaign) or shift number
  onFinish: (f: FinishInfo) => Award;
  onExit: () => void;
  onRetry: () => void;
  onNext: () => void;
  isLast?: boolean;
  overtimeBest?: number;
}

const TARGET_LABEL: Record<string, string> = {
  P: 'Pistons extended',
  F: 'Flywheels spinning',
  f: 'Flywheels spinning',
  M: 'Lamps glowing',
  m: 'Alarm bells silent',
};

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, k) => ({
        k,
        dx: (Math.random() - 0.5) * 700,
        dy: -120 - Math.random() * 380,
        rot: (Math.random() - 0.5) * 900,
        c: ['#ffd45c', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][k % 5],
        d: Math.random() * 0.25,
        s: 6 + Math.random() * 8,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b) => (
        <div
          key={b.k}
          className="confetti absolute"
          style={{ ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg`, background: b.c, width: b.s, height: b.s * 0.5, animationDelay: `${b.d}s` }}
        />
      ))}
    </div>
  );
}

function Shards() {
  const bits = useMemo(
    () =>
      Array.from({ length: 40 }, (_, k) => ({
        k,
        dx: (Math.random() - 0.5) * 900,
        dy: (Math.random() - 0.5) * 700,
        rot: (Math.random() - 0.5) * 1400,
        c: ['#b9772f', '#7c2d12', '#ffb347', '#6b7280', '#c9a24a'][k % 5],
        s: 8 + Math.random() * 18,
      })),
    []
  );
  return (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-40">
      <div className="boom-ring absolute -left-40 -top-40 h-80 w-80 rounded-full" style={{ background: 'radial-gradient(circle, #fff7d6, #ffb347 40%, #d1342a 70%, transparent 72%)' }} />
      {bits.map((b) => (
        <div
          key={b.k}
          className="shard absolute"
          style={{ ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg`, background: b.c, width: b.s, height: b.s * 0.6, clipPath: 'polygon(0 0, 100% 30%, 60% 100%)' }}
        />
      ))}
    </div>
  );
}

export default function Game({ level, seed, stats, mode, index, onFinish, onExit, onRetry, onNext, isLast, overtimeBest }: GameProps) {
  const parsed = useMemo(() => parseLevel(level, seed), [level, seed]);
  const { R, C } = parsed;

  const [grid, setGrid] = useState<Cell[]>(() => parsed.start.map((c) => (c ? { ...c } : null)));
  const [tray, setTray] = useState<Record<string, number>>(parsed.tray);
  const trayTypes = useMemo(
    () => Object.keys(parsed.tray).sort((a, b) => MANUAL_ORDER.indexOf(a) - MANUAL_ORDER.indexOf(b)),
    [parsed]
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [handRot, setHandRot] = useState(0);
  const [tool, setTool] = useState<'rotate' | 'salvage'>('rotate');
  const [hover, setHover] = useState(-1);
  const [bumpIdx, setBumpIdx] = useState(-1);
  const [muted, setMuted] = useState(sfx.isMuted());

  const [status, setStatus] = useState<'ready' | 'playing' | 'paused' | 'won' | 'boom'>('ready');
  const [pressure, setPressure] = useState(0);
  const pressureRef = useRef(0);
  const [ventsLeft, setVentsLeft] = useState(stats.vents);
  const [hintsLeft, setHintsLeft] = useState(stats.hints);
  const [hintCell, setHintCell] = useState(-1);
  const [note, setNote] = useState('Select a part from the tray, then click an empty tile.');
  const [ventKey, setVentKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ stars: number; score: number; cogs: number; newBest: boolean; note?: string; pressure: number } | null>(null);
  const finished = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);
  const timeUsed = useRef(0);

  const sim = useMemo(() => simulate(grid, R, C), [grid, R, C]);
  const infos = useMemo(() => buildInfos(sim), [sim]);
  const simRef = useRef<SimResult>(sim);
  simRef.current = sim;

  const heatMult = useCallback(
    (s: SimResult) => 1 + stats.penaltyMul * (0.3 * Math.min(s.leaks.length, 5) + 0.6 * Math.min(s.jamCount, 2)),
    [stats.penaltyMul]
  );
  const mult = heatMult(sim);
  const baseRate = (100 / level.time) * stats.rateMul;

  const say = useCallback((m: string) => setNote(m), []);

  // ---------- finish handlers ----------
  const doWin = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const p = pressureRef.current;
    const stars = p < 40 ? 3 : p < 70 ? 2 : 1;
    const score = Math.max(100, Math.round((100 - p) * 10 + stars * 200));
    const award = onFinish({ won: true, pressure: p, stars, score });
    setResult({ stars, score, cogs: award.cogs, newBest: award.newBest, note: award.note, pressure: p });
    setStatus('won');
    sfx.stopHum();
    sfx.win();
  }, [onFinish]);

  const doBoom = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const award = onFinish({ won: false, pressure: 100, stars: 0, score: 0 });
    setResult({ stars: 0, score: 0, cogs: award.cogs, newBest: award.newBest, note: award.note, pressure: 100 });
    setStatus('boom');
    setShake(true);
    sfx.stopHum();
    sfx.boom();
    window.setTimeout(() => setShake(false), 800);
  }, [onFinish]);

  useEffect(() => {
    if (status === 'playing' && sim.allDone) doWin();
  }, [sim, status, doWin]);

  // cleanup audio on unmount
  useEffect(
    () => () => {
      sfx.stopHum();
      window.clearTimeout(hintTimer.current);
    },
    []
  );

  // ---------- pressure loop ----------
  useEffect(() => {
    if (status !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let tickT = 0;
    let alarmT = 0;
    let hissT = 0;
    let grindT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = simRef.current;
      pressureRef.current += baseRate * heatMult(s) * dt;
      timeUsed.current += dt;
      if (pressureRef.current >= 100) {
        pressureRef.current = 100;
        setPressure(100);
        doBoom();
        return;
      }
      acc += dt;
      if (acc > 0.05) {
        acc = 0;
        setPressure(pressureRef.current);
        sfx.setHum(pressureRef.current);
      }
      tickT += dt;
      if (tickT >= (pressureRef.current > 75 ? 0.5 : 1)) {
        tickT = 0;
        sfx.tick(pressureRef.current > 75);
      }
      if (pressureRef.current > 75) {
        alarmT += dt;
        if (alarmT > 0.8) {
          alarmT = 0;
          sfx.alarm();
        }
      }
      if (s.leaks.length) {
        hissT += dt;
        if (hissT > 0.9) {
          hissT = 0;
          sfx.hiss(0.05 + Math.min(0.1, s.leaks.length * 0.02));
        }
      }
      if (s.jamCount) {
        grindT += dt;
        if (grindT > 0.5) {
          grindT = 0;
          sfx.grind();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, baseRate, heatMult, doBoom]);

  // ---------- actions ----------
  const begin = () => {
    sfx.unlock();
    sfx.start();
    sfx.startHum();
    setStatus('playing');
    say(level.tip);
  };

  const place = (i: number) => {
    if (!selected || !(tray[selected] > 0)) {
      say('Pick a part from the tray first.');
      sfx.click();
      return;
    }
    const type = selected;
    setGrid((g) => {
      const n = [...g];
      n[i] = { type, rot: handRot, fixed: false, on: type === 's' };
      return n;
    });
    const left = tray[type] - 1;
    setTray((t) => ({ ...t, [type]: left }));
    if (left <= 0) setSelected(null);
    sfx.place();
  };

  const salvage = (i: number) => {
    const p = grid[i];
    if (!p || p.fixed) return;
    setGrid((g) => {
      const n = [...g];
      n[i] = null;
      return n;
    });
    setTray((t) => ({ ...t, [p.type]: (t[p.type] || 0) + 1 }));
    sfx.salvage();
  };

  const clickCell = (i: number) => {
    if (status !== 'playing') return;
    const p = grid[i];
    if (!p) {
      place(i);
      return;
    }
    if (p.type === 'S' || p.type === 's') {
      setGrid((g) => {
        const n = [...g];
        n[i] = { ...p, on: !p.on };
        return n;
      });
      sfx.toggle();
      return;
    }
    if (p.fixed) {
      sfx.bolted();
      setBumpIdx(i);
      window.setTimeout(() => setBumpIdx(-1), 250);
      say(`${DEFS[p.type].name}: ${DEFS[p.type].desc}`);
      return;
    }
    if (tool === 'salvage' || DEFS[p.type].period === 1) {
      salvage(i);
      if (tool !== 'salvage') say(`${DEFS[p.type].name} returned to the tray (round parts do not rotate).`);
      return;
    }
    setGrid((g) => {
      const n = [...g];
      n[i] = { ...p, rot: p.rot + 1 };
      return n;
    });
    sfx.rotate();
  };

  const rightClick = (i: number) => {
    if (status !== 'playing') return;
    const p = grid[i];
    if (p && p.fixed) {
      sfx.bolted();
      return;
    }
    salvage(i);
  };

  const selectTray = (t: string) => {
    if (status !== 'playing') return;
    if (!(tray[t] > 0)) return;
    sfx.click();
    if (selected === t) {
      setHandRot((r) => r + 1);
      sfx.rotate();
    } else {
      setSelected(t);
      setTool('rotate');
    }
    say(`${DEFS[t].name}: ${DEFS[t].desc}`);
  };

  const doVent = () => {
    if (status !== 'playing') return;
    if (ventsLeft <= 0) {
      sfx.error();
      say('Out of emergency vents!');
      return;
    }
    setVentsLeft((v) => v - 1);
    pressureRef.current = Math.max(0, pressureRef.current - 25);
    setPressure(pressureRef.current);
    setVentKey((k) => k + 1);
    sfx.vent();
    say('PSSSHHHT! Emergency vent released 25% pressure.');
  };

  const doHint = () => {
    if (status !== 'playing') return;
    if (hintsLeft <= 0) {
      sfx.error();
      say('No more hints this shift.');
      return;
    }
    const sol = parsed.solution;
    let h: { i: number; msg: string } | null = null;
    for (let i = 0; i < sol.length && !h; i++) {
      const s = sol[i];
      if (!s || s.fixed) continue;
      const cur = grid[i];
      if (!cur) h = { i, msg: `Install a ${DEFS[s.type].name} on the glowing tile.` };
      else if (cur.type !== s.type) h = { i, msg: `Replace this ${DEFS[cur.type].name} with a ${DEFS[s.type].name}.` };
    }
    for (let i = 0; i < sol.length && !h; i++) {
      const s = sol[i];
      const cur = grid[i];
      if (!s || s.fixed || !cur) continue;
      const per = DEFS[s.type].period;
      if ((((cur.rot - s.rot) % per) + per) % per !== 0) h = { i, msg: `This ${DEFS[s.type].name} is facing the wrong way. Rotate it.` };
    }
    for (let i = 0; i < sol.length && !h; i++) {
      const cur = grid[i];
      if (!sol[i] && cur && !cur.fixed) h = { i, msg: `Nothing belongs here. Salvage this ${DEFS[cur.type].name}.` };
    }
    for (let i = 0; i < grid.length && !h; i++) {
      const cur = grid[i];
      if (cur && (cur.type === 'S' || cur.type === 's')) h = { i, msg: 'All parts look right. Try flipping this lever switch.' };
    }
    setHintsLeft((v) => v - 1);
    pressureRef.current = Math.min(99, pressureRef.current + 6);
    setPressure(pressureRef.current);
    sfx.hint();
    if (h) {
      setHintCell(h.i);
      say('Hint (+6% heat): ' + h.msg);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHintCell(-1), 4500);
    } else say('Everything seems fine. Check for leaks or jammed gears.');
  };

  const togglePause = () => {
    if (status === 'playing') {
      setStatus('paused');
      sfx.stopHum();
    } else if (status === 'paused') {
      setStatus('playing');
      sfx.startHum();
    }
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') {
        togglePause();
        return;
      }
      if (status !== 'playing') return;
      if (k === 'r') {
        setHandRot((r) => r + 1);
        sfx.rotate();
      } else if (k === 'v') doVent();
      else if (k === 'h') doHint();
      else if (k === 'x') setTool((t) => (t === 'rotate' ? 'salvage' : 'rotate'));
      else if (/^[1-9]$/.test(k)) {
        const t = trayTypes[parseInt(k, 10) - 1];
        if (t) selectTray(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- derived UI ----------
  const mood: RobotMood = status === 'won' ? 'fixed' : status === 'boom' ? 'boom' : pressure > 75 ? 'critical' : status === 'playing' ? 'working' : 'idle';
  const objectives = useMemo(() => {
    const m = new Map<string, { label: string; done: number; total: number }>();
    grid.forEach((p, i) => {
      if (!p || !sim.isTarget[i]) return;
      const label = TARGET_LABEL[p.type];
      const e = m.get(label) || { label, done: 0, total: 0 };
      e.total++;
      if (sim.satisfied[i]) e.done++;
      m.set(label, e);
    });
    return [...m.values()];
  }, [grid, sim]);
  const piecesLeft = Object.values(tray).reduce((a, b) => a + b, 0);
  const vignette = Math.max(0, (pressure - 55) / 45);

  const boardWidth = `max(250px, min(100%, ${C * 90}px, calc((100vh - 360px) * ${C / R})))`;

  return (
    <div className={`workshop-bg relative min-h-screen ${shake ? 'screen-shake' : ''}`}>
      <div className="pointer-events-none fixed inset-0 z-30" style={{ boxShadow: `inset 0 0 ${60 + vignette * 140}px ${vignette * 40}px rgba(200,20,10,${vignette * 0.8})` }} />
      {ventKey > 0 && (
        <div key={ventKey} className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden">
          <div className="vent-cloud h-[60vmin] w-[60vmin] rounded-full" style={{ background: 'radial-gradient(circle, #ffffffee, #cfeff7aa 45%, transparent 70%)' }} />
        </div>
      )}

      {/* header */}
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-3 pt-3">
        <button className="btn-dark" onClick={onExit}>
          ◀ {mode === 'overtime' ? 'Quit' : 'Levels'}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-display truncate text-lg font-extrabold text-amber-200 sm:text-2xl">{level.name}</div>
          <div className="truncate text-xs text-amber-100/60">{level.patient}</div>
        </div>
        <button
          className="btn-dark"
          onClick={() => {
            sfx.setMuted(!muted);
            setMuted(!muted);
            if (muted && status === 'playing') sfx.startHum();
          }}
          title="Toggle sound"
          aria-label="Toggle sound"
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="btn-dark" onClick={togglePause} disabled={status !== 'playing' && status !== 'paused'}>
          {status === 'paused' ? '▶' : '❚❚'}
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-3 lg:flex-row">
        {/* left column */}
        <aside className="flex flex-col gap-3 lg:w-72">
          <div className="brass-panel flex items-center gap-3 p-3 lg:flex-col">
            <Robot mood={mood} size={96} seed={index} />
            <div className="flex-1 lg:w-full">
              <Gauge pressure={pressure} rateMul={mult} />
            </div>
          </div>

          <div className="brass-panel grid grid-cols-2 gap-2 p-3">
            <button className="btn-brass" onClick={doVent} disabled={status !== 'playing' || ventsLeft <= 0} title="Emergency vent (V): -25% pressure">
              ♨ Vent ({ventsLeft})<div className="text-[10px] font-normal opacity-70">key V</div>
            </button>
            <button className="btn-brass" onClick={doHint} disabled={status !== 'playing' || hintsLeft <= 0} title="Hint (H): costs 6% pressure">
              ◎ Hint ({hintsLeft})<div className="text-[10px] font-normal opacity-70">key H</div>
            </button>
          </div>

          <div className="brass-panel p-3 text-sm">
            <div className="font-display mb-1 text-amber-300">Repair Orders</div>
            {objectives.map((o) => (
              <div key={o.label} className="flex items-center justify-between py-0.5">
                <span className={o.done === o.total ? 'text-green-300' : 'text-amber-100/80'}>
                  {o.done === o.total ? '✔' : '○'} {o.label}
                </span>
                <span className="font-bold">
                  {o.done}/{o.total}
                </span>
              </div>
            ))}
            <div className={`mt-2 border-t border-amber-900/60 pt-2 text-xs ${sim.leaks.length ? 'text-orange-300' : 'text-amber-100/50'}`}>
              {sim.leaks.length ? `💨 ${sim.leaks.length} steam leak${sim.leaks.length > 1 ? 's' : ''}: boiler heating faster!` : '✔ No steam leaks'}
            </div>
            {sim.jamCount > 0 && <div className="text-xs font-bold text-red-400">⚠ Gear train jammed! Two engines are fighting each other.</div>}
          </div>
        </aside>

        {/* main column */}
        <main className="flex flex-1 flex-col items-center gap-3">
          <div className={`brass-panel w-full p-2 sm:p-3 ${status === 'playing' && pressure > 85 ? 'tremble' : ''}`} style={{ width: boardWidth }}>
            <div
              className="grid gap-[2px] overflow-hidden rounded-lg bg-black"
              style={{ gridTemplateColumns: `repeat(${C}, 1fr)`, aspectRatio: `${C} / ${R}`, cursor: tool === 'salvage' ? 'not-allowed' : 'pointer' }}
              onMouseLeave={() => setHover(-1)}
            >
              {grid.map((p, i) => {
                const showGhost = !p && hover === i && selected && tray[selected] > 0 && status === 'playing';
                return (
                  <div
                    key={i}
                    className={`relative ${bumpIdx === i ? 'bump' : ''}`}
                    onClick={() => clickCell(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      rightClick(i);
                    }}
                    onMouseEnter={() => setHover(i)}
                    style={{ outline: hover === i && status === 'playing' ? '2px solid #fde68a88' : undefined, outlineOffset: -2 }}
                  >
                    {showGhost ? (
                      <Tile piece={{ type: selected!, rot: handRot, fixed: false }} ghost parity={(((i / C) | 0) + (i % C)) & 1} />
                    ) : (
                      <Tile piece={p} info={infos[i]} parity={(((i / C) | 0) + (i % C)) & 1} hint={hintCell === i} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-[2.5rem] w-full max-w-3xl rounded-lg border border-amber-900/50 bg-black/40 px-3 py-2 text-center text-sm text-amber-100/90">
            🛠 {note}
          </div>

          {/* tray */}
          <div className="brass-panel w-full max-w-3xl p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-amber-300">Parts Tray <span className="text-xs text-amber-100/50">({piecesLeft} left)</span></div>
              <div className="flex gap-2">
                <button className="btn-dark text-sm" onClick={() => { setHandRot((r) => r + 1); sfx.rotate(); }} disabled={status !== 'playing'}>
                  ↻ Rotate <span className="opacity-60">(R)</span>
                </button>
                <button
                  className={`btn-dark text-sm ${tool === 'salvage' ? '!border-red-400 !bg-red-900/60' : ''}`}
                  onClick={() => setTool((t) => (t === 'rotate' ? 'salvage' : 'rotate'))}
                  disabled={status !== 'playing'}
                  title="Salvage mode: clicking a part returns it to the tray (or right-click)"
                >
                  🔧 Salvage {tool === 'salvage' ? 'ON' : 'off'} <span className="opacity-60">(X)</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {trayTypes.length === 0 && <div className="text-sm text-amber-100/50">No loose parts, only rotation required!</div>}
              {trayTypes.map((t, k) => {
                const count = tray[t] || 0;
                const sel = selected === t;
                return (
                  <button
                    key={t}
                    onClick={() => selectTray(t)}
                    disabled={count <= 0 || status !== 'playing'}
                    title={`${DEFS[t].name}: ${DEFS[t].desc}`}
                    className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition ${sel ? 'scale-110 border-yellow-300 shadow-[0_0_16px_#fde047aa]' : 'border-amber-800 hover:border-amber-400'} ${count <= 0 ? 'opacity-30' : ''}`}
                  >
                    <Tile piece={{ type: t, rot: sel ? handRot : 0, fixed: false, on: t === 's' }} parity={0} />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1.5 text-xs font-bold text-amber-200">×{count}</span>
                    <span className="absolute left-0 top-0 rounded-br bg-black/70 px-1 text-[10px] text-amber-100/60">{k + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pb-4 text-center text-[11px] text-amber-100/40">
            Click part → click tile • Click placed part: rotate • Right-click: salvage • Click levers to flip • P: pause
          </div>
        </main>
      </div>

      {/* overlays */}
      {status === 'ready' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="brass-panel pop-in max-w-lg p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-amber-100/50">{mode === 'overtime' ? `Overtime • Shift ${index}` : `Repair Job #${index + 1}`}</div>
            <div className="font-display mt-1 text-3xl font-extrabold text-amber-200">{level.name}</div>
            <div className="mb-2 text-sm text-amber-100/60">Patient: {level.patient}</div>
            <div className="mb-2 flex justify-center">
              <Robot mood="idle" size={90} seed={index} />
            </div>
            <p className="mb-3 text-amber-50/90">{level.blurb}</p>
            <p className="mb-4 rounded-lg bg-black/40 p-2 text-sm text-amber-200/80">💡 {level.tip}</p>
            <div className="mb-4 text-xs text-amber-100/60">
              Boiler bursts in about {level.time}s • Vents: {stats.vents} • Hints: {stats.hints}
            </div>
            <div className="flex justify-center gap-3">
              <button className="btn-dark" onClick={onExit}>Back</button>
              <button className="btn-brass text-lg" onClick={begin} autoFocus>
                🔥 Fire up the boiler
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'paused' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="brass-panel pop-in p-8 text-center">
            <div className="font-display mb-2 text-4xl text-amber-200">Paused</div>
            <p className="mb-5 text-amber-100/70">The boiler is holding its breath...</p>
            <div className="flex justify-center gap-3">
              <button className="btn-dark" onClick={onExit}>Abandon</button>
              <button className="btn-brass" onClick={onRetry}>Restart</button>
              <button className="btn-brass" onClick={togglePause}>Resume</button>
            </div>
          </div>
        </div>
      )}

      {status === 'won' && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Confetti />
          <div className="brass-panel pop-in relative max-w-md p-6 text-center">
            <div className="font-display text-3xl font-extrabold text-green-300">Automaton Repaired!</div>
            <div className="my-2 flex justify-center">
              <Robot mood="fixed" size={100} seed={index} />
            </div>
            <div className="mb-2 text-4xl tracking-widest">
              {[1, 2, 3].map((s) => (
                <span key={s} className={s <= result.stars ? 'text-yellow-300' : 'text-stone-700'} style={{ textShadow: s <= result.stars ? '0 0 12px #fde047' : undefined }}>
                  ★
                </span>
              ))}
            </div>
            <div className="text-sm text-amber-100/70">Finished with {Math.floor(result.pressure)}% boiler pressure</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-black/40 p-2">Score<div className="text-xl font-bold text-amber-200">{result.score}{result.newBest && <span className="ml-1 text-xs text-green-300">NEW BEST</span>}</div></div>
              <div className="rounded-lg bg-black/40 p-2">Cogs earned<div className="text-xl font-bold text-amber-200">⚙ {result.cogs}</div></div>
            </div>
            {result.note && <div className="mt-2 text-xs text-amber-100/60">{result.note}</div>}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn-dark" onClick={onExit}>{mode === 'overtime' ? 'Clock out' : 'Levels'}</button>
              <button className="btn-dark" onClick={onRetry}>Replay</button>
              <button className="btn-brass" onClick={onNext}>
                {mode === 'overtime' ? 'Next shift ▶' : isLast ? 'Finish ▶' : 'Next job ▶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'boom' && result && (
        <>
          <Shards />
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/70 p-4">
            <div className="brass-panel pop-in relative max-w-md border-red-700 p-6 text-center">
              <div className="font-display text-4xl font-extrabold text-red-400">BOILER BURST!</div>
              <div className="my-2 flex justify-center">
                <Robot mood="boom" size={90} seed={index} />
              </div>
              <p className="mb-3 text-amber-100/80">
                {level.patient.split(',')[0]} is in pieces and the workshop is covered in soot.
              </p>
              {mode === 'overtime' && (
                <div className="mb-3 rounded-lg bg-black/40 p-2 text-sm">
                  Shifts completed: <b className="text-amber-200">{index - 1}</b> • Best: <b className="text-amber-200">{Math.max(overtimeBest ?? 0, index - 1)}</b>
                  {result.note && <div className="text-xs text-amber-100/60">{result.note}</div>}
                </div>
              )}
              <div className="flex justify-center gap-2">
                <button className="btn-dark" onClick={onExit}>{mode === 'overtime' ? 'Menu' : 'Levels'}</button>
                <button className="btn-brass" onClick={onRetry}>{mode === 'overtime' ? 'New run' : 'Try again'}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
