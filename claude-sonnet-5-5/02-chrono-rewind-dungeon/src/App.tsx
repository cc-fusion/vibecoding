import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { UPGRADES, type ClearInfo, type Engine, type UpgradeDef, type Upgrades } from './game/engine';
import { LEVELS } from './game/levels';
import { sfx } from './game/audio';

const SAVE_KEY = 'chrono-rewind-dungeon-v1';

interface Save {
  level: number;
  upgrades: Upgrades;
  stars: number[];
  seconds: number;
  echoes: number;
}

function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (typeof s.level !== 'number' || s.level < 0 || s.level >= LEVELS.length) return null;
    return { level: s.level, upgrades: s.upgrades || {}, stars: s.stars || [], seconds: s.seconds || 0, echoes: s.echoes || 0 };
  } catch {
    return null;
  }
}
function writeSave(s: Save | null) {
  try {
    if (s) localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function starsFor(ghosts: number, par: number) {
  return ghosts <= par ? 3 : ghosts <= par + 1 ? 2 : 1;
}

function pickChoices(u: Upgrades): UpgradeDef[] {
  const pool = UPGRADES.filter((d) => (u[d.id] || 0) < d.max);
  const out: UpgradeDef[] = [];
  const copy = [...pool];
  while (out.length < 3 && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

const Stars = ({ n, size = 'text-2xl' }: { n: number; size?: string }) => (
  <span className={size}>
    {[1, 2, 3].map((i) => (
      <span key={i} className={i <= n ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]' : 'text-slate-700'}>
        ★
      </span>
    ))}
  </span>
);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[11px] font-mono text-cyan-200 shadow-[0_2px_0_#0f172a]">
      {children}
    </kbd>
  );
}

function Title({ onNew, onContinue, save }: { onNew: () => void; onContinue: () => void; save: Save | null }) {
  const [help, setHelp] = useState(false);
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05060f] flex items-center justify-center text-slate-100">
      <style>{`
        @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }
        @keyframes pulseGlow { 0%,100% { opacity:.35 } 50% { opacity:.8 } }
        @keyframes scan { from { transform: translateY(-100%) } to { transform: translateY(100vh) } }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12),transparent_60%)]" />
      <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan-300/5 to-transparent" style={{ animation: 'scan 6s linear infinite' }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute w-10 h-14 rounded-t-full"
          style={{
            left: `${10 + i * 19}%`,
            top: `${20 + ((i * 37) % 55)}%`,
            background: `hsla(${[185, 275, 320, 45, 140][i]},90%,70%,0.25)`,
            boxShadow: `0 0 40px hsla(${[185, 275, 320, 45, 140][i]},100%,60%,0.5)`,
            animation: `floaty ${4 + i}s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
      <div className="relative z-10 max-w-xl w-full px-6 py-10 text-center">
        <p className="tracking-[0.5em] text-xs text-cyan-300/80 mb-3" style={{ animation: 'pulseGlow 3s infinite' }}>
          ◀◀ A TEMPORAL DUNGEON CRAWLER
        </p>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none bg-gradient-to-b from-white via-cyan-200 to-violet-400 bg-clip-text text-transparent">
          CHRONO-REWIND
          <br />
          DUNGEON
        </h1>
        <p className="mt-5 text-slate-400 text-sm leading-relaxed">
          Every run you rewind becomes an <span className="text-cyan-300">echo</span> that replays your every step and
          strike. Work alongside your own past selves to hold plates, slay guardians, and break the Chronos Warden.
        </p>

        {!help ? (
          <div className="mt-8 flex flex-col gap-3 items-center">
            {save && (
              <button
                onClick={onContinue}
                className="w-64 py-3 rounded-lg font-bold bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(56,189,248,0.4)]"
              >
                CONTINUE · ROOM {save.level + 1}
              </button>
            )}
            <button
              onClick={onNew}
              className={`w-64 py-3 rounded-lg font-bold transition hover:scale-105 active:scale-95 ${
                save
                  ? 'border border-slate-600 text-slate-200 hover:border-cyan-400'
                  : 'bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.4)]'
              }`}
            >
              {save ? 'NEW GAME' : 'ENTER THE DUNGEON'}
            </button>
            <button
              onClick={() => setHelp(true)}
              className="w-64 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:border-violet-400 transition"
            >
              HOW TO PLAY
            </button>
          </div>
        ) : (
          <div className="mt-6 text-left bg-slate-900/80 border border-slate-700 rounded-xl p-5 text-sm space-y-3 backdrop-blur">
            <p>
              <b className="text-cyan-300">The loop.</b> Each room has a timeline. Press <Kbd>R</Kbd> at any moment to
              rewind: your run is recorded as an echo, and you restart while every echo replays its run. Echoes freeze
              where their story ends, so one can hold a plate forever.
            </p>
            <p>
              <b className="text-cyan-300">Puzzles.</b> Coloured <b>plates</b> open doors of the same colour (all plates of a
              colour must be lit). <b>Timed plates</b> stay lit for 2.5s. Crimson gates open when every slime is dead.
            </p>
            <p>
              <b className="text-cyan-300">Ghost privileges.</b> Echoes are immune to spikes, bolts and slimes — only you can
              be hurt. Echoes also swing your exact blade strikes, so they can kill, and break boss shields.
            </p>
            <p>
              <b className="text-cyan-300">Stars.</b> Clear a room with few echoes for ★★★. Pick one relic after every
              room. Beat the Chronos Warden to win.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-slate-300">
              <span>
                <Kbd>WASD</Kbd> / <Kbd>←↑↓→</Kbd> move
              </span>
              <span>
                <Kbd>SPACE</Kbd> / <Kbd>J</Kbd> slash
              </span>
              <span>
                <Kbd>SHIFT</Kbd> / <Kbd>K</Kbd> dash (i-frames)
              </span>
              <span>
                <Kbd>R</Kbd> record echo + rewind
              </span>
              <span>
                <Kbd>X</Kbd> retry, no echo
              </span>
              <span>
                <Kbd>T</Kbd> wipe all echoes
              </span>
              <span>
                <Kbd>ESC</Kbd> pause
              </span>
              <span>
                <Kbd>M</Kbd> mute
              </span>
            </div>
            <button onClick={() => setHelp(false)} className="mt-2 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'title' | 'play' | 'victory'>('title');
  const [levelIndex, setLevelIndex] = useState(0);
  const [upgrades, setUpgrades] = useState<Upgrades>({});
  const [runKey, setRunKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clear, setClear] = useState<(ClearInfo & { stars: number; choices: UpgradeDef[] }) | null>(null);
  const [save, setSave] = useState<Save | null>(() => loadSave());
  const [muted, setMuted] = useState(false);
  const progress = useRef<{ stars: number[]; seconds: number; echoes: number }>({ stars: [], seconds: 0, echoes: 0 });
  const engineRef = useRef<Engine | null>(null);

  const begin = useCallback((lvl: number, up: Upgrades, p: { stars: number[]; seconds: number; echoes: number }) => {
    sfx.init();
    progress.current = p;
    setUpgrades(up);
    setLevelIndex(lvl);
    setClear(null);
    setPaused(false);
    setRunKey((k) => k + 1);
    setScreen('play');
  }, []);

  const newGame = () => {
    writeSave(null);
    setSave(null);
    begin(0, {}, { stars: [], seconds: 0, echoes: 0 });
  };
  const continueGame = () => {
    if (save) begin(save.level, save.upgrades, { stars: save.stars, seconds: save.seconds, echoes: save.echoes });
  };

  const onClear = useCallback(
    (info: ClearInfo) => {
      const stars = starsFor(info.ghosts, LEVELS[levelIndex].par);
      const pr = progress.current;
      pr.stars[levelIndex] = Math.max(pr.stars[levelIndex] || 0, stars);
      pr.seconds += info.seconds;
      pr.echoes += info.ghosts;
      if (levelIndex >= LEVELS.length - 1) {
        writeSave(null);
        setSave(null);
        window.setTimeout(() => {
          setClear(null);
          setScreen('victory');
        }, 1600);
        setClear({ ...info, stars, choices: [] });
        return;
      }
      setClear({ ...info, stars, choices: pickChoices(upgrades) });
    },
    [levelIndex, upgrades],
  );

  const pick = (u: UpgradeDef | null) => {
    sfx.select();
    const up = { ...upgrades };
    if (u) up[u.id] = (up[u.id] || 0) + 1;
    const next = levelIndex + 1;
    const s: Save = { level: next, upgrades: up, stars: progress.current.stars, seconds: progress.current.seconds, echoes: progress.current.echoes };
    writeSave(s);
    setSave(s);
    begin(next, up, progress.current);
  };

  const toggleMute = () => {
    sfx.init();
    sfx.setMuted(!sfx.muted);
    setMuted(sfx.muted);
  };

  useEffect(() => {
    document.title = 'Chrono-Rewind Dungeon';
  }, []);

  if (screen === 'title') return <Title onNew={newGame} onContinue={continueGame} save={save} />;

  if (screen === 'victory') {
    const total = progress.current.stars.reduce((a, b) => a + (b || 0), 0);
    return (
      <div className="min-h-screen bg-[#05060f] text-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,rgba(250,204,21,0.15),transparent_60%)]">
        <div className="max-w-lg w-full text-center bg-slate-900/80 border border-amber-300/30 rounded-2xl p-8 shadow-[0_0_80px_rgba(250,204,21,0.15)]">
          <p className="tracking-[0.4em] text-xs text-amber-300/80">THE TIMELINE IS MENDED</p>
          <h2 className="text-4xl font-black mt-2 bg-gradient-to-b from-white to-amber-300 bg-clip-text text-transparent">VICTORY</h2>
          <p className="text-slate-400 mt-3 text-sm">
            The Chronos Warden is shards of brass and dust. You and your echoes walk out of the dungeon together — a
            party of one, across many moments.
          </p>
          <div className="grid grid-cols-3 gap-3 my-6">
            <div className="bg-slate-950/70 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-300">
                {total}/{LEVELS.length * 3}
              </div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">Stars</div>
            </div>
            <div className="bg-slate-950/70 rounded-lg p-3">
              <div className="text-2xl font-bold text-cyan-300">{progress.current.echoes}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">Echoes used</div>
            </div>
            <div className="bg-slate-950/70 rounded-lg p-3">
              <div className="text-2xl font-bold text-violet-300">
                {Math.floor(progress.current.seconds / 60)}:{String(progress.current.seconds % 60).padStart(2, '0')}
              </div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">Time in dungeon</div>
            </div>
          </div>
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            {LEVELS.map((l, i) => (
              <div key={l.name} className="bg-slate-950/70 rounded px-2 py-1 text-center" title={l.name}>
                <div className="text-[10px] text-slate-500">R{i + 1}</div>
                <Stars n={progress.current.stars[i] || 0} size="text-xs" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={newGame} className="px-6 py-3 rounded-lg font-bold bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 hover:scale-105 transition">
              PLAY AGAIN
            </button>
            <button onClick={() => setScreen('title')} className="px-6 py-3 rounded-lg border border-slate-600 hover:border-slate-400 transition">
              TITLE
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lv = LEVELS[levelIndex];
  return (
    <div className="min-h-screen bg-[#05060f] text-slate-200 flex flex-col items-center justify-center p-2 gap-2 select-none">
      <div className="relative w-full flex justify-center">
        <GameCanvas
          levelIndex={levelIndex}
          upgrades={upgrades}
          runKey={runKey}
          engineRef={engineRef}
          callbacks={{ onClear, onPause: setPaused }}
        />

        {paused && !clear && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-72 text-center space-y-3">
              <h3 className="text-xl font-black tracking-widest text-cyan-200">PAUSED</h3>
              <button onClick={() => engineRef.current?.setPaused(false)} className="w-full py-2.5 rounded-lg font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                RESUME
              </button>
              <button
                onClick={() => {
                  setPaused(false);
                  setRunKey((k) => k + 1);
                }}
                className="w-full py-2.5 rounded-lg border border-slate-600 hover:border-cyan-400"
              >
                RESTART ROOM
              </button>
              <button onClick={toggleMute} className="w-full py-2.5 rounded-lg border border-slate-600 hover:border-cyan-400">
                SOUND: {muted ? 'OFF' : 'ON'}
              </button>
              <button
                onClick={() => {
                  setPaused(false);
                  setScreen('title');
                }}
                className="w-full py-2.5 rounded-lg border border-slate-600 hover:border-rose-400 text-slate-300"
              >
                QUIT TO TITLE
              </button>
              <p className="text-[11px] text-slate-500">Progress is saved after every cleared room.</p>
            </div>
          </div>
        )}

        {clear && clear.choices.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm z-20 p-3 overflow-auto">
            <div className="w-full max-w-2xl text-center">
              <p className="tracking-[0.4em] text-[11px] text-violet-300/80">ROOM {levelIndex + 1} CLEARED</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white">{lv.name}</h3>
              <div className="my-2">
                <Stars n={clear.stars} size="text-4xl" />
              </div>
              <p className="text-sm text-slate-400 mb-4">
                {clear.ghosts} echo{clear.ghosts === 1 ? '' : 'es'} used (par {lv.par}) · {clear.attempts} attempt
                {clear.attempts === 1 ? '' : 's'} · {clear.seconds}s
              </p>
              <p className="text-xs text-cyan-200 mb-2 uppercase tracking-widest">Choose a temporal relic</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {clear.choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c)}
                    className="group bg-slate-900 border border-slate-700 hover:border-cyan-400 rounded-xl p-4 text-left transition hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                  >
                    <div className="text-3xl mb-1">{c.icon}</div>
                    <div className="font-bold text-slate-100">{c.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{c.desc}</div>
                    <div className="text-[10px] text-violet-300 mt-2">
                      Level {(upgrades[c.id] || 0) + 1} / {c.max}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => pick(null)} className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline">
                skip relic
              </button>
            </div>
          </div>
        )}

        {clear && clear.choices.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="text-4xl font-black text-amber-200 tracking-widest animate-pulse">THE WARDEN FALLS</div>
          </div>
        )}
      </div>
      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span>
          <Kbd>WASD</Kbd> move
        </span>
        <span>
          <Kbd>SPACE</Kbd> slash
        </span>
        <span>
          <Kbd>SHIFT</Kbd> dash
        </span>
        <span>
          <Kbd>R</Kbd> record echo &amp; rewind
        </span>
        <span>
          <Kbd>X</Kbd> retry
        </span>
        <span>
          <Kbd>T</Kbd> wipe echoes
        </span>
        <span>
          <Kbd>ESC</Kbd> pause
        </span>
        <span>
          <Kbd>M</Kbd> mute
        </span>
      </div>
    </div>
  );
}
