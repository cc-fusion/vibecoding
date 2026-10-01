import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type KeyName, type Stats } from "./game/engine";
import { LEVELS } from "./game/levels";
import { AudioEngine } from "./game/audio";

const audio = new AudioEngine();

type Screen = "menu" | "select" | "help" | "play" | "ending";

interface Save {
  unlocked: number;
  best: Record<number, { stars: number; time: number }>;
}

const SAVE_KEY = "shadow-puppeteer-save-v1";

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (typeof s.unlocked === "number" && s.best) return s;
    }
  } catch {
    /* ignore */
  }
  return { unlocked: 0, best: {} };
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Stars({ n, size = "text-xl" }: { n: number; size?: string }) {
  return (
    <span className={`${size} tracking-widest`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "text-amber-200" : "text-indigo-300/25"}>
          ★
        </span>
      ))}
    </span>
  );
}

function PuppetLogo() {
  return (
    <svg width="64" height="110" viewBox="0 0 64 110" className="puppet-sway" aria-hidden>
      <g stroke="rgba(200,240,255,0.35)" strokeWidth="1">
        <line x1="32" y1="0" x2="32" y2="30" />
        <line x1="8" y1="0" x2="18" y2="60" />
        <line x1="56" y1="0" x2="46" y2="60" />
      </g>
      <g fill="#0b0917" stroke="#9cf4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px #7ff)" }}>
        <circle cx="32" cy="38" r="8" />
        <path d="M23 50 L41 50 L38 78 L26 78 Z" />
        <path d="M23 53 L15 66 M41 53 L49 66 M29 78 L26 100 M35 78 L38 100" fill="none" />
      </g>
      <circle cx="29.5" cy="37" r="1.6" fill="#fff" />
      <circle cx="35.5" cy="37" r="1.6" fill="#fff" />
    </svg>
  );
}

function MenuScreen({ onPlay, onSelect, onHelp, hasProgress }: { onPlay: () => void; onSelect: () => void; onHelp: () => void; hasProgress: boolean }) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[#07050f]">
      <div className="absolute inset-x-0 top-0 h-0 flex justify-center pointer-events-none">
        <div className="lamp-sway relative">
          <div className="absolute left-1/2 -translate-x-1/2 w-px h-24 -top-20 bg-indigo-200/30" />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-2 rounded-full"
            style={{
              width: "140vmax",
              height: "140vmax",
              marginTop: "-70vmax",
              background: "radial-gradient(circle, rgba(255,210,140,0.32) 0%, rgba(255,190,110,0.12) 18%, rgba(255,190,110,0) 40%)",
            }}
          />
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-4 h-4 rounded-full bg-amber-100 shadow-[0_0_40px_14px_rgba(255,210,140,0.8)]" />
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-24 bg-[#0d0920] border-t border-indigo-300/20" />
      <div className="absolute bottom-24 left-[14%] w-24 h-28 bg-[#0d0920] border border-indigo-300/20" />
      <div className="absolute bottom-24 right-[18%] w-40 h-16 bg-[#0d0920] border border-indigo-300/20" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 fade-up">
        <PuppetLogo />
        <h1 className="title-glow text-5xl md:text-7xl font-black tracking-[0.12em] mt-2 text-[#f4ecff]">SHADOW</h1>
        <h1 className="title-glow text-4xl md:text-6xl font-black tracking-[0.3em] -mt-1 text-[#f4ecff]">PUPPETEER</h1>
        <p className="mt-4 max-w-md text-indigo-200/80 italic text-sm md:text-base">
          You exist only in the dark. The lanterns of the theatre are hunting you.
        </p>
        <div className="mt-8 flex flex-col gap-3 w-64">
          <button className="btn btn-primary" onClick={onPlay}>
            {hasProgress ? "Continue" : "Begin the Show"}
          </button>
          <button className="btn" onClick={onSelect}>
            Choose Act
          </button>
          <button className="btn" onClick={onHelp}>
            How to Play
          </button>
        </div>
        <p className="mt-6 text-xs text-indigo-300/50 tracking-widest">HEADPHONES RECOMMENDED · M TO MUTE</p>
      </div>
    </div>
  );
}

function HelpScreen({ onBack }: { onBack: () => void }) {
  const rows: [string, string][] = [
    ["A / D  or  ← / →", "Walk"],
    ["W / ↑ / Space", "Jump (hold for height)"],
    ["Shift  or  K", "Dash — a quick, light-resistant burst"],
    ["E  or  S / ↓", "Use a lever"],
    ["R", "Restart the act"],
    ["P  or  Esc", "Pause"],
    ["M", "Mute / unmute"],
  ];
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#07050f] p-4 overflow-auto">
      <div className="max-w-2xl w-full fade-up">
        <h2 className="text-3xl font-black tracking-[0.2em] text-center mb-6">HOW TO PLAY</h2>
        <div className="space-y-3 text-indigo-100/90 text-sm md:text-base leading-relaxed normal-case" style={{ fontFamily: "Georgia, serif" }}>
          <p>
            You are a puppet of pure shadow. <b className="text-amber-200">Light dissolves you</b> — stand in a lit area and your
            Essence drains. Rest in shade and it slowly returns. Run out and a Thread snaps.
          </p>
          <p>
            Solid walls and platforms cast shadows away from every lamp. Lamps <b className="text-amber-200">swing, orbit, patrol and flicker</b>,
            so the shadows move. Paper screens are <i>not</i> solid, but their shadows are real — ride them.
          </p>
          <p>
            Reach the glowing doorway to finish an act. Collect every <b className="text-violet-200">memory shard</b> and lose no thread for
            three stars. Touch a candle totem to set a checkpoint.
          </p>
        </div>
        <div className="mt-6 border border-indigo-300/25 rounded bg-indigo-950/30 divide-y divide-indigo-300/10">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2 text-sm">
              <span className="text-amber-200 font-bold tracking-wider">{k}</span>
              <span className="text-indigo-100/80" style={{ fontFamily: "Georgia, serif" }}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <button className="btn btn-primary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectScreen({ save, onPick, onBack }: { save: Save; onPick: (i: number) => void; onBack: () => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#07050f] p-4 overflow-auto">
      <div className="max-w-4xl w-full fade-up">
        <h2 className="text-3xl font-black tracking-[0.25em] text-center mb-1">THE PROGRAMME</h2>
        <p className="text-center text-indigo-300/60 italic mb-6 text-sm">Eight acts. One puppet. Endless light.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LEVELS.map((l, i) => {
            const locked = i > save.unlocked;
            const b = save.best[i];
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => onPick(i)}
                className={`relative text-left p-3 rounded border transition-all h-36 flex flex-col justify-between ${
                  locked
                    ? "border-indigo-300/10 bg-indigo-950/20 opacity-40 cursor-not-allowed"
                    : "border-indigo-300/40 bg-indigo-950/40 hover:border-amber-200 hover:bg-indigo-800/30 hover:shadow-[0_0_24px_rgba(255,210,140,0.25)] cursor-pointer"
                }`}
              >
                <div>
                  <div className="text-xs tracking-[0.3em] text-indigo-300/70">ACT {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][i]}</div>
                  <div className="font-bold text-sm mt-1 leading-tight">{locked ? "— Locked —" : l.name}</div>
                </div>
                <div>
                  {b ? (
                    <div className="flex items-center justify-between">
                      <Stars n={b.stars} size="text-base" />
                      <span className="text-xs text-indigo-300/70">{fmt(b.time)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-indigo-300/40">{locked ? "🔒" : "Not cleared"}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-center mt-6">
          <button className="btn" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function TouchControls({ gameRef }: { gameRef: React.MutableRefObject<Game | null> }) {
  const mk = (k: KeyName, label: string, extra = "") => (
    <button
      className={`w-16 h-16 rounded-full border-2 border-indigo-200/50 bg-indigo-950/60 text-indigo-100 font-bold text-sm active:bg-indigo-500/50 ${extra}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        gameRef.current?.setKey(k, true);
      }}
      onPointerUp={() => gameRef.current?.setKey(k, false)}
      onPointerCancel={() => gameRef.current?.setKey(k, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
  return (
    <div className="absolute bottom-3 inset-x-3 flex justify-between items-end pointer-events-none">
      <div className="flex gap-3 pointer-events-auto">
        {mk("left", "◀")}
        {mk("right", "▶")}
      </div>
      <div className="flex gap-3 pointer-events-auto">
        {mk("use", "E")}
        {mk("dash", "DASH")}
        {mk("jump", "JUMP")}
      </div>
    </div>
  );
}

type Overlay = null | "pause" | "complete" | "lose";

function GameView({
  level,
  hasNext,
  onQuit,
  onNext,
  onComplete,
}: {
  level: number;
  hasNext: boolean;
  onQuit: () => void;
  onNext: () => void;
  onComplete: (level: number, s: Stats) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [muted, setMuted] = useState(audio.muted);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const touch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, level, audio, (e) => {
      if (e.type === "pause") {
        setOverlay((o) => (o === null ? "pause" : o === "pause" ? null : o));
      } else if (e.type === "complete") {
        setStats(e.stats);
        setOverlay("complete");
        completeRef.current(level, e.stats);
      } else if (e.type === "lose") {
        setStats(e.stats);
        setOverlay("lose");
      }
    });
    gameRef.current = g;
    g.start();
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, [level]);

  useEffect(() => {
    gameRef.current?.setPaused(overlay !== null);
  }, [overlay]);

  const retry = useCallback(() => {
    gameRef.current?.restart();
    setOverlay(null);
  }, []);

  const toggleMute = () => {
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black"
      onClick={() => {
        const a = document.activeElement as HTMLElement | null;
        if (a && a.tagName === "BUTTON") a.blur();
      }}
    >
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 960 / 560))", aspectRatio: "960 / 560" }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2">
          <button className="btn btn-small" onClick={() => setOverlay((o) => (o === null ? "pause" : o))}>
            Pause
          </button>
        </div>
        {touch && overlay === null && <TouchControls gameRef={gameRef} />}

        {overlay && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center fade-up">
            <div className="text-center px-6 py-6 max-w-md w-[92%] border border-indigo-300/30 bg-[#0a0718]/95 rounded">
              {overlay === "pause" && (
                <>
                  <h2 className="text-3xl font-black tracking-[0.3em] mb-1">INTERVAL</h2>
                  <p className="text-indigo-300/70 italic text-sm mb-5">{LEVELS[level].name}</p>
                  <div className="flex flex-col gap-3">
                    <button className="btn btn-primary" onClick={() => setOverlay(null)}>
                      Resume
                    </button>
                    <button className="btn" onClick={retry}>
                      Restart Act
                    </button>
                    <button className="btn" onClick={toggleMute}>
                      Sound: {muted ? "Off" : "On"}
                    </button>
                    <button className="btn" onClick={onQuit}>
                      Leave Stage
                    </button>
                  </div>
                </>
              )}
              {overlay === "complete" && stats && (
                <>
                  <h2 className="text-3xl font-black tracking-[0.2em] mb-1">ACT CLEARED</h2>
                  <p className="text-indigo-300/70 italic text-sm mb-3">{LEVELS[level].name}</p>
                  <Stars n={stats.stars} size="text-5xl" />
                  <div className="grid grid-cols-3 gap-2 my-5 text-sm">
                    <div className="border border-indigo-300/20 rounded p-2">
                      <div className="text-indigo-300/60 text-xs tracking-widest">TIME</div>
                      <div className="font-bold text-lg">{fmt(stats.time)}</div>
                    </div>
                    <div className="border border-indigo-300/20 rounded p-2">
                      <div className="text-indigo-300/60 text-xs tracking-widest">SHARDS</div>
                      <div className="font-bold text-lg">
                        {stats.shards}/{stats.totalShards}
                      </div>
                    </div>
                    <div className="border border-indigo-300/20 rounded p-2">
                      <div className="text-indigo-300/60 text-xs tracking-widest">SNAPPED</div>
                      <div className="font-bold text-lg">{stats.deaths}</div>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-300/60 mb-4 normal-case" style={{ fontFamily: "Georgia, serif" }}>
                    ★ clear · ★ every shard · ★ no thread lost
                  </p>
                  <div className="flex flex-col gap-3">
                    <button className="btn btn-primary" onClick={onNext}>
                      {hasNext ? "Next Act" : "Take Your Bow"}
                    </button>
                    <button className="btn" onClick={retry}>
                      Replay Act
                    </button>
                    <button className="btn" onClick={onQuit}>
                      Programme
                    </button>
                  </div>
                </>
              )}
              {overlay === "lose" && (
                <>
                  <h2 className="text-3xl font-black tracking-[0.2em] mb-1 text-orange-200">CONSUMED</h2>
                  <p className="text-indigo-200/80 italic text-sm mb-5 normal-case" style={{ fontFamily: "Georgia, serif" }}>
                    Every thread has snapped. The lanterns burn on without you.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button className="btn btn-primary" onClick={retry}>
                      Try Again
                    </button>
                    <button className="btn" onClick={onQuit}>
                      Programme
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EndingScreen({ save, onMenu }: { save: Save; onMenu: () => void }) {
  const total = LEVELS.reduce((a, _, i) => a + (save.best[i]?.stars ?? 0), 0);
  const time = LEVELS.reduce((a, _, i) => a + (save.best[i]?.time ?? 0), 0);
  const max = LEVELS.length * 3;
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#07050f] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 30%, rgba(255,210,140,0.25), rgba(0,0,0,0) 55%)" }}
      />
      <div className="relative text-center px-4 fade-up">
        <PuppetLogo />
        <h2 className="title-glow text-4xl md:text-6xl font-black tracking-[0.2em] mt-2">CURTAIN CALL</h2>
        <p className="mt-4 max-w-md mx-auto text-indigo-100/85 italic normal-case" style={{ fontFamily: "Georgia, serif" }}>
          The last lantern gutters out. In the quiet dark, the audience rises — and the puppet, at last, takes a bow.
        </p>
        <div className="mt-6 text-2xl text-amber-200">
          ★ {total} / {max}
        </div>
        <div className="text-indigo-300/70 text-sm mt-1">Total best time {fmt(time)}</div>
        <p className="text-indigo-300/60 text-xs mt-2 normal-case" style={{ fontFamily: "Georgia, serif" }}>
          {total === max ? "A flawless performance. The stage is yours." : "Return to earlier acts to collect every shard and lose no thread."}
        </p>
        <div className="mt-8">
          <button className="btn btn-primary" onClick={onMenu}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [level, setLevel] = useState(0);
  const [save, setSave] = useState<Save>(() => loadSave());
  const [runId, setRunId] = useState(0);

  const startAudio = () => {
    audio.init();
    audio.startAmbient();
  };

  const play = (i: number) => {
    startAudio();
    audio.sfx("ui");
    setLevel(i);
    setRunId((r) => r + 1);
    setScreen("play");
  };

  const onComplete = useCallback(
    (lvl: number, s: Stats) => {
      setSave((prev) => {
        const old = prev.best[lvl];
        const best = {
          ...prev.best,
          [lvl]: {
            stars: Math.max(old?.stars ?? 0, s.stars),
            time: old ? Math.min(old.time, s.time) : s.time,
          },
        };
        const next: Save = { unlocked: Math.max(prev.unlocked, Math.min(lvl + 1, LEVELS.length - 1)), best };
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  // global mute key on menu screens
  useEffect(() => {
    if (screen === "play") return;
    const h = (e: KeyboardEvent) => {
      if (e.code === "KeyM") audio.setMuted(!audio.muted);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen]);

  const hasProgress = Object.keys(save.best).length > 0;

  return (
    <div className="w-screen h-screen overflow-hidden bg-black select-none">
      {screen === "menu" && (
        <MenuScreen
          hasProgress={hasProgress}
          onPlay={() => play(Math.min(save.unlocked, LEVELS.length - 1))}
          onSelect={() => {
            startAudio();
            setScreen("select");
          }}
          onHelp={() => setScreen("help")}
        />
      )}
      {screen === "help" && <HelpScreen onBack={() => setScreen("menu")} />}
      {screen === "select" && <SelectScreen save={save} onPick={play} onBack={() => setScreen("menu")} />}
      {screen === "play" && (
        <GameView
          key={runId}
          level={level}
          hasNext={level < LEVELS.length - 1}
          onQuit={() => setScreen("select")}
          onNext={() => {
            if (level < LEVELS.length - 1) play(level + 1);
            else setScreen("ending");
          }}
          onComplete={onComplete}
        />
      )}
      {screen === "ending" && <EndingScreen save={save} onMenu={() => setScreen("menu")} />}
    </div>
  );
}
