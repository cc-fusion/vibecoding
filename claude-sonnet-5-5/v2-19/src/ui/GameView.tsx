import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { HudSnap, Tool, GameResult } from '../game/engine';
import { CASTES, CASTE_INFO, CHAMBER_TYPES, CHAMBER_INFO, WEATHER_INFO, DIFFS, LEVELS, fmtTime, techLevel } from '../game/data';
import { Btn, Panel, SettingsPanel, HelpPanel } from './common';

export interface RunConfig {
  levelId: number;
  diffId: string;
  mods: string[];
  tutorial: boolean;
  key: number;
}

const TOOLS: { id: Tool; icon: string; label: string; key: string; tip: string }[] = [
  { id: 'forage', icon: '🟢', label: 'Forage', key: '1', tip: 'Paint a food trail. Workers follow it outward from the nest.' },
  { id: 'war', icon: '🔴', label: 'War', key: '2', tip: 'Paint a war trail. Soldiers & spitters follow it and fight at its end.' },
  { id: 'dig', icon: '⛏️', label: 'Dig', key: '3', tip: 'Mark soil for workers to excavate.' },
  { id: 'erase', icon: '🧽', label: 'Erase', key: '4', tip: 'Erase trails and dig marks.' },
  { id: 'build', icon: '🏗️', label: 'Build', key: '5', tip: 'Place a chamber.' },
  { id: 'pan', icon: '✋', label: 'Pan', key: '6', tip: 'Drag to move the camera (or hold right mouse).' },
];

function Bar({ value, max, color, label, warn }: { value: number; max: number; color: string; label: string; warn?: boolean }) {
  const p = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-md border border-white/10 bg-black/50">
      <div className={`h-full transition-[width] duration-200 ${warn ? 'animate-pulse' : ''}`} style={{ width: `${p * 100}%`, background: color }} />
      <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-bold text-white drop-shadow">{label}</div>
    </div>
  );
}

function Chip({ children, title, className = '' }: { children: React.ReactNode; title?: string; className?: string }) {
  return <div title={title} className={`flex items-center gap-1 rounded-lg border border-amber-100/15 bg-black/55 px-2.5 py-1 text-sm font-bold text-amber-50 backdrop-blur ${className}`}>{children}</div>;
}

export default function GameView({ run, onResult, onExit, onRestart }: {
  run: RunConfig;
  onResult: (r: GameResult) => void;
  onExit: (to: 'title' | 'campaign') => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [snap, setSnap] = useState<HudSnap | null>(null);
  const [menu, setMenu] = useState<'main' | 'settings' | 'help'>('main');
  const [diffId, setDiffId] = useState(run.diffId);
  const [panelOpen, setPanelOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : true));

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const level = LEVELS.find((l) => l.id === run.levelId) || LEVELS[0];
    const diff = DIFFS.find((d) => d.id === run.diffId) || DIFFS[1];
    const g = new Game(canvas, miniRef.current, { level, diff, mods: run.mods, tutorial: run.tutorial });
    gameRef.current = g;
    g.onHud = setSnap;
    g.onEnd = (r) => resultRef.current(r);
    g.start();
    g.pushHud();
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(box);
    return () => {
      ro.disconnect();
      g.destroy();
      gameRef.current = null;
    };
  }, [run.key, run.levelId, run.diffId, run.mods, run.tutorial]);

  useEffect(() => { if (snap && !snap.paused) setMenu('main'); }, [snap?.paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = gameRef.current;
  const act = useCallback((fn: (g: Game) => void) => {
    const gm = gameRef.current;
    if (!gm) return;
    fn(gm);
    gm.pushHud();
  }, []);

  const miniPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === 'pointermove' && e.buttons !== 1) return;
    const gm = gameRef.current;
    const c = miniRef.current;
    if (!gm || !c) return;
    const r = c.getBoundingClientRect();
    gm.centerOn(((e.clientX - r.left) / r.width) * 2400, ((e.clientY - r.top) / r.height) * 1600);
    gm.flags.moved += 100;
  };

  const s = snap;
  const noFocus = (e: React.MouseEvent) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); };

  return (
    <div ref={boxRef} className="fixed inset-0 overflow-hidden bg-black text-amber-50" style={{ fontFamily: "'Fredoka', system-ui, sans-serif" }}>
      <canvas ref={canvasRef} className="block touch-none" />
      {s && (
        <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2" onMouseDown={noFocus}>
          {/* top bar */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <Chip title={`Food stockpile. Net rate ${s.foodRate.toFixed(1)}/s (upkeep included)`}>
              🍞 <span className="tabular-nums">{Math.floor(s.food)}</span><span className="text-xs opacity-60">/{s.foodCap}</span>
              <span className={`text-xs ${s.foodRate >= 0 ? 'text-lime-300' : 'text-red-300'}`}>{s.foodRate >= 0 ? '+' : ''}{s.foodRate.toFixed(1)}/s</span>
            </Chip>
            <Chip title="Population / cap (build Barracks for more)">🐜 <span className="tabular-nums">{s.pop}</span><span className="text-xs opacity-60">/{s.popCap}</span></Chip>
            <Chip title="Brood slots in use (build Nurseries for more)">🥚 <span className="tabular-nums">{s.brood}</span><span className="text-xs opacity-60">/{s.broodCap}</span></Chip>
            <div className="min-w-[180px] flex-1 basis-[240px]">
              <div className="rounded-lg border border-amber-100/15 bg-black/55 px-3 py-1 backdrop-blur">
                <div className="flex justify-between text-xs font-bold text-amber-200"><span>🎯 {s.levelName}</span><span className="tabular-nums">{fmtTime(s.time)}</span></div>
                <div className="truncate text-[13px] leading-tight">{s.objective}</div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-gradient-to-r from-amber-400 to-lime-400 transition-[width] duration-300" style={{ width: `${s.objProgress * 100}%` }} /></div>
              </div>
            </div>
            <Chip title={WEATHER_INFO[s.weather].desc}>{WEATHER_INFO[s.weather].icon}<span className="hidden sm:inline">{WEATHER_INFO[s.weather].name}</span></Chip>
            <Chip title={`Forecast: ${WEATHER_INFO[s.nextWeather].name} — ${WEATHER_INFO[s.nextWeather].desc}`} className="opacity-90">
              <span className="text-xs opacity-60">next</span>{WEATHER_INFO[s.nextWeather].icon}<span className="text-xs tabular-nums">{Math.ceil(s.weatherT)}s</span>
            </Chip>
            <div className="flex overflow-hidden rounded-lg border border-amber-100/15 bg-black/55 backdrop-blur">
              {[1, 2, 3].map((n) => (
                <button key={n} title="Game speed (T)" onClick={() => act((gm) => gm.setSpeed(n))} className={`px-2.5 py-1 text-sm font-bold ${s.speed === n ? 'bg-amber-400 text-stone-950' : 'text-amber-100 hover:bg-white/10'}`}>{n}×</button>
              ))}
            </div>
            <button title="Pause (Space / Esc)" onClick={() => act((gm) => gm.setPaused(true))} className="rounded-lg border border-amber-100/15 bg-black/55 px-3 py-1 text-sm font-bold hover:bg-white/10">⏸</button>
          </div>

          <div className="flex min-h-0 flex-1 justify-between gap-2">
            {/* left status */}
            <div className="flex w-56 flex-col gap-1.5 sm:w-64">
              <div className="pointer-events-auto space-y-1 rounded-xl border border-amber-100/10 bg-black/45 p-1.5 backdrop-blur">
                <Bar value={s.queenHp} max={s.queenMax} color="linear-gradient(90deg,#c0392b,#f5b041)" label={`👑 Queen ${Math.ceil(s.queenHp)}/${Math.round(s.queenMax)}`} warn={s.queenHp < s.queenMax * 0.35} />
                <Bar value={s.energy} max={s.energyMax} color="linear-gradient(90deg,#1e9e6a,#7dffb0)" label={`🧪 Glands ${Math.floor(s.energy)}`} />
              </div>
              <div className="flex flex-col gap-1">
                {s.log.map((l) => (
                  <div key={l.id} className={`animate-[fadeIn_.3s_ease-out] rounded-lg border px-2 py-1 text-[12px] leading-snug backdrop-blur ${l.kind === 'bad' ? 'border-red-400/40 bg-red-950/70' : l.kind === 'good' ? 'border-lime-400/40 bg-green-950/70' : l.kind === 'warn' ? 'border-amber-400/40 bg-amber-950/70' : 'border-white/10 bg-black/60'}`}>{l.text}</div>
                ))}
              </div>
            </div>

            {/* center: tutorial / boss */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              {s.boss && (
                <div className="w-full max-w-xl rounded-xl border border-red-400/40 bg-black/65 p-2 backdrop-blur">
                  <div className="mb-1 text-center text-sm font-bold tracking-widest text-red-300">🦡 {s.boss.name.toUpperCase()}</div>
                  <Bar value={s.boss.hp} max={s.boss.max} color="linear-gradient(90deg,#7f1d1d,#ef4444)" label={`${Math.ceil(s.boss.hp)} / ${s.boss.max}`} />
                </div>
              )}
              {s.rivals.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {s.rivals.map((r) => (
                    <div key={r.name} className="w-36 rounded-lg border border-white/10 bg-black/55 px-2 py-1 backdrop-blur">
                      <div className="flex items-center gap-1 text-[11px] font-bold"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color, boxShadow: '0 0 0 1px #fff8' }} />{r.name}{!r.alive && ' ☠'}</div>
                      <Bar value={r.alive ? r.hp : 0} max={r.max} color="linear-gradient(90deg,#6b21a8,#d946ef)" label={r.alive ? '👑 Queen' : 'Fallen'} />
                    </div>
                  ))}
                </div>
              )}
              {s.tutorial && (
                <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-amber-300/50 bg-[#2a1a08]/90 p-3 shadow-xl backdrop-blur">
                  <div className="mb-1 flex items-center justify-between text-xs font-bold text-amber-300">
                    <span>📘 TUTORIAL {s.tutorial.step + 1}/{s.tutorial.total}</span>
                    <button className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20" onClick={() => act((gm) => gm.skipTutorial())}>Skip</button>
                  </div>
                  <div className="text-[14px] leading-snug">{s.tutorial.text}</div>
                  {s.tutorial.last && <Btn className="mt-2 !py-1 text-sm" onClick={() => act((gm) => gm.advanceTutorial())}>Got it!</Btn>}
                </div>
              )}
            </div>

            {/* right: colony panel */}
            <div className="pointer-events-auto flex min-h-0 w-56 flex-col items-end gap-1.5 sm:w-60">
              <button onClick={() => setPanelOpen((o) => !o)} className="rounded-lg border border-amber-100/15 bg-black/60 px-3 py-1 text-xs font-bold hover:bg-white/10">🐜 Colony {panelOpen ? '▾' : '▸'}</button>
              {panelOpen && (
                <Panel className="min-h-0 w-full overflow-y-auto p-2.5">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-300">Caste mix</div>
                  <div className="space-y-1.5">
                    {CASTES.filter((c) => s.unlockedCastes.includes(c)).map((c) => (
                      <div key={c} title={CASTE_INFO[c].desc}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{CASTE_INFO[c].icon} {CASTE_INFO[c].name} <span className="opacity-50">({CASTE_INFO[c].cost}🍞)</span></span>
                          <span className="font-bold tabular-nums" style={{ color: CASTE_INFO[c].color }}>{s.counts[c]}</span>
                        </div>
                        <input type="range" min={0} max={10} step={1} value={s.mix[c]} onChange={(e) => act((gm) => gm.setMix(c, parseInt(e.target.value, 10)))} onPointerUp={(e) => (e.target as HTMLElement).blur()} className="h-2 w-full" style={{ accentColor: CASTE_INFO[c].color }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {(['boom', 'balanced', 'war'] as const).map((p) => (
                      <button key={p} onClick={() => act((gm) => gm.setMixPreset(p))} className="rounded-md bg-white/10 px-1 py-1 text-[11px] font-bold capitalize hover:bg-white/20">{p}</button>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] leading-snug opacity-60">Queen lays toward this ratio. Needs food, brood slots and population room.</div>
                </Panel>
              )}
            </div>
          </div>

          {/* bottom */}
          <div className="flex items-end justify-between gap-2">
            <div className="pointer-events-auto flex min-w-0 flex-col gap-1.5">
              {s.tool === 'build' && (
                <Panel className="flex flex-wrap gap-1.5 p-1.5">
                  {CHAMBER_TYPES.map((t) => {
                    const info = CHAMBER_INFO[t];
                    const locked = !!info.tech && techLevel(info.tech) < 1;
                    const sel = s.chamberSel === t;
                    const cost = s.chamberCost[t];
                    return (
                      <button
                        key={t}
                        title={locked ? 'Locked: unlock via the Evolution tree' : info.desc}
                        onClick={() => act((gm) => gm.setChamber(t))}
                        className={`w-[104px] rounded-lg border px-2 py-1 text-left transition-all ${sel ? 'border-amber-300 bg-amber-400/20' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${locked ? 'opacity-45' : ''}`}
                      >
                        <div className="text-sm font-bold">{info.icon} {info.name.split(' ')[0]}</div>
                        <div className={`text-[11px] ${s.food >= cost ? 'text-lime-300' : 'text-red-300'}`}>{locked ? '🔒 Locked' : `${cost} 🍞 · ×${s.chamberCount[t]}`}</div>
                      </button>
                    );
                  })}
                </Panel>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Panel className="flex gap-1 p-1">
                  {TOOLS.map((t) => (
                    <button
                      key={t.id}
                      title={`${t.label} (${t.key}) — ${t.tip}`}
                      onClick={() => act((gm) => gm.setTool(t.id))}
                      className={`flex w-12 flex-col items-center rounded-lg px-1 py-1 transition-all sm:w-14 ${s.tool === t.id ? 'bg-amber-400 text-stone-950 shadow-lg -translate-y-0.5' : 'text-amber-50 hover:bg-white/10'}`}
                    >
                      <span className="text-lg leading-none">{t.icon}</span>
                      <span className="text-[10px] font-bold">{t.label}</span>
                      <span className="hidden text-[9px] opacity-60 sm:block">{t.key}</span>
                    </button>
                  ))}
                </Panel>
                {s.tool !== 'build' && s.tool !== 'pan' && (
                  <Panel className="flex items-center gap-1 p-1">
                    <span className="px-1 text-[10px] font-bold opacity-60">BRUSH</span>
                    {[1, 2, 3].map((b) => (
                      <button key={b} onClick={() => act((gm) => gm.setBrush(b))} className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.brush === b ? 'bg-amber-400 text-stone-950' : 'hover:bg-white/10'}`}>
                        <span className="rounded-full bg-current" style={{ width: 4 + b * 4, height: 4 + b * 4 }} />
                      </button>
                    ))}
                  </Panel>
                )}
              </div>
            </div>
            <div className="pointer-events-auto shrink-0 overflow-hidden rounded-xl border border-amber-100/25 bg-black/70 shadow-2xl">
              <canvas
                ref={miniRef}
                width={200}
                height={133}
                className="block h-[89px] w-[134px] cursor-crosshair touch-none sm:h-[133px] sm:w-[200px]"
                onPointerDown={miniPointer}
                onPointerMove={miniPointer}
              />
            </div>
          </div>
        </div>
      )}

      {/* pause menu */}
      {s && s.paused && !s.ended && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-md p-6">
            {menu === 'main' && (
              <div className="space-y-3">
                <h2 className="text-center text-3xl font-bold text-amber-300">Paused</h2>
                <p className="text-center text-sm opacity-70">{s.levelName} · {fmtTime(s.time)}</p>
                <Btn className="w-full" onClick={() => act((gm) => gm.setPaused(false))}>▶ Resume</Btn>
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-60">Difficulty (live)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DIFFS.map((d) => (
                      <Btn key={d.id} kind={diffId === d.id ? 'primary' : 'ghost'} className="!px-1 !py-1.5 text-xs" title={d.desc} onClick={() => { setDiffId(d.id); act((gm) => gm.setDiff(d.id)); }}>{d.name}</Btn>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] opacity-60">Jelly rewards use the lowest difficulty played this run.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Btn kind="ghost" onClick={() => setMenu('settings')}>⚙ Settings</Btn>
                  <Btn kind="ghost" onClick={() => setMenu('help')}>❓ How to play</Btn>
                  <Btn kind="ghost" onClick={onRestart}>↻ Restart</Btn>
                  <Btn kind="ghost" onClick={() => onExit('campaign')}>🗺 Campaign</Btn>
                </div>
                <Btn kind="danger" className="w-full" onClick={() => onExit('title')}>Quit to title</Btn>
              </div>
            )}
            {menu === 'settings' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-amber-300">Settings</h2>
                <SettingsPanel />
                <Btn className="w-full" onClick={() => setMenu('main')}>← Back</Btn>
              </div>
            )}
            {menu === 'help' && (
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-amber-300">How to play</h2>
                <HelpPanel />
                <Btn className="w-full" onClick={() => setMenu('main')}>← Back</Btn>
              </div>
            )}
          </Panel>
        </div>
      )}
      {!g && !s && <div className="absolute inset-0 flex items-center justify-center text-amber-200">Digging tunnels…</div>}
    </div>
  );
}

