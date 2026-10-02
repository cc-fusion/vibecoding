import { useCallback, useEffect, useRef, useState } from 'react';
import { Battle, type BattleConfig, type BattleResult, type BUnit } from '../game/battle';
import { renderBattle } from '../game/render';
import { CLASSES, ENEMIES, GEAR, PERKS, RANKS, TERRAIN, WEATHER_INFO, WIND_ARROWS } from '../game/data';
import { audio } from '../game/audio';
import { saveMeta, type Meta } from '../game/campaign';
import { Btn, Chip, Modal } from './ui';
import { HelpPanel, SettingsPanel, applyAudio } from './Panels';
import { cn } from '../utils/cn';

interface Props {
  cfg: BattleConfig;
  meta: Meta;
  setMeta: (m: Meta) => void;
  onFinish: (r: BattleResult) => void;
  onRetry: () => void;
  onQuit: () => void;
}

interface TStep {
  text: string;
  done?: (b: Battle) => boolean;
}

const TUTORIAL: TStep[] = [
  { text: 'Welcome, Commander! Click your Fusilier (⚔️) to select it. Blue hexes show where it can move.', done: (b) => !!b.selected },
  { text: 'Click a blue hex to move toward the Raider (🗡️). Forests cost 2 movement; hills give cover.', done: (b) => b.movedEver },
  { text: 'Enemies in range get a red ring. Hover one to preview damage, then click it to attack. Melee foes counter-attack!', done: (b) => b.attackedEver },
  { text: 'See the flashing cracked hex marked "1"? It COLLAPSES at round end, and your Sapper (🔧) is standing on it! Select the Sapper, press Ability (A) and click its own hex to SHORE it.', done: (b) => b.stats.shores > 0 },
  { text: 'Press End Turn (Space). After the enemy moves, the Hazard Phase resolves every marked hex.', done: (b) => b.round >= 2 },
  { text: 'Green dashes are supply lines from your HQ 🏰. Fire, flood, chasms and enemies cut them, and unsupplied units (orange !) weaken. Defeat the Raider to finish the tutorial. Use T for threat range, U to undo a move.' },
];

export default function BattleScreen({ cfg, meta, setMeta, onFinish, onRetry, onQuit }: Props) {
  const bRef = useRef<Battle | null>(null);
  if (!bRef.current) bRef.current = new Battle(cfg);
  const b = bRef.current;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<'main' | 'settings' | 'help' | 'confirm'>('main');
  const [result, setResult] = useState<BattleResult | null>(null);
  const [step, setStep] = useState(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const tutorial = !!cfg.tutorial;

  useEffect(() => {
    b.paused = paused;
  }, [paused, b]);

  useEffect(() => {
    b.onOver = (r) => setResult(r);
    audio.init();
    audio.startMusic();
    return () => {
      b.onOver = undefined;
      audio.intensity = 0.25;
    };
  }, [b]);

  // main loop
  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let W = 100;
    let H = 100;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(50, wrap.clientWidth);
      H = Math.max(50, wrap.clientHeight);
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    let raf = 0;
    let last = performance.now();
    let lastVer = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) b.update(dt);
      renderBattle(ctx, b, W, H);
      if (b.ver !== lastVer) {
        lastVer = b.ver;
        force((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [b]);

  // tutorial progression
  useEffect(() => {
    if (!tutorial) return;
    const id = window.setInterval(() => {
      const s = TUTORIAL[step];
      if (s && s.done && s.done(b)) setStep((n) => Math.min(TUTORIAL.length - 1, n + 1));
    }, 250);
    return () => clearInterval(id);
  }, [tutorial, step, b]);

  // pause on tab hidden
  useEffect(() => {
    const f = () => {
      if (document.hidden && !b.result) setPaused(true);
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [b]);

  const toggleMute = useCallback(() => {
    const nm = { ...meta, settings: { ...meta.settings, muted: !meta.settings.muted } };
    applyAudio(nm.settings);
    saveMeta(nm);
    setMeta(nm);
  }, [meta, setMeta]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') {
        if (paused) {
          setPaused(false);
          setView('main');
        } else if (k === 'escape' && (b.mode === 'ability' || b.selected)) {
          if (b.mode === 'ability') b.setMode('move');
          else b.select(null);
        } else setPaused(true);
        e.preventDefault();
        return;
      }
      if (paused) return;
      if (k === ' ' || k === 'enter') {
        b.endTurn();
        e.preventDefault();
      } else if (k === 'tab') {
        b.cycleUnit();
        e.preventDefault();
      } else if (k === 'a' || k === 'q') b.setMode('ability');
      else if (k === 'u' || k === 'backspace') b.undoMove();
      else if (k === 't') b.toggleThreat();
      else if (k === 's') {
        b.showSupply = !b.showSupply;
        b.changed();
      } else if (k === 'm') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b, paused, result, toggleMute]);

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const sel = b.selected;
  const insp = b.inspected && !b.inspected.dead ? b.inspected : null;
  const shown = sel || insp;
  const fc = b.forecast();
  const wi = WEATHER_INFO[b.weather];
  const isPlayer = b.phase === 'player' && !b.busy() && !result;
  const readyCount = b.alive('player').filter((u) => !u.acted || u.mp > 0).length;
  const abilityDef = sel ? CLASSES[sel.kind]?.ability : undefined;

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0b16]">
      {/* top bar */}
      <div className="z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#2f2750] bg-[#120e20] px-2 py-1.5">
        <Btn small onClick={() => setPaused(true)} title="Pause (Esc)">
          ☰ Menu
        </Btn>
        <div className="font-display text-sm font-extrabold text-[#f5d78a] sm:text-base">{tutorial ? 'Tutorial' : b.mission.name}</div>
        <Chip color="#3a2f66">Round {b.round}</Chip>
        <Chip color={b.phase === 'player' ? '#1f6a52' : b.phase === 'enemy' ? '#7a2530' : '#8a5a1a'}>{b.phase === 'player' ? 'Your move' : b.phase === 'enemy' ? 'Enemy phase' : b.phase === 'hazard' ? 'Hazard phase' : 'Over'}</Chip>
        <div className="flex items-center gap-1.5 rounded-md bg-[#1d1733] px-2 py-0.5 text-xs" title={`Tonight: ${wi.name}. ${wi.desc}`}>
          <span className="text-base">{wi.icon}</span>
          <span className="font-semibold">{wi.name}</span>
          <span className="text-[#ffb36a]" title="Wind direction (fire spreads downwind)">
            wind {WIND_ARROWS[b.wind]}
          </span>
        </div>
        <div className="flex items-center gap-1" title="Hazards that resolve at the end of a round (counts of marked hexes)">
          <Chip color="#6b5a3e">💥 {fc.collapse}</Chip>
          <Chip color="#1f5a80">🌊 {fc.flood}</Chip>
          <Chip color="#8a4416">🔥 {fc.ignite}</Chip>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Btn small variant={b.showThreat ? 'gold' : 'default'} onClick={() => b.toggleThreat()} title="Enemy threat range (T)">
            ⚠ Threat
          </Btn>
          <Btn
            small
            variant={b.showSupply ? 'green' : 'default'}
            onClick={() => {
              b.showSupply = !b.showSupply;
              b.changed();
            }}
            title="Supply overlay (S)"
          >
            📦 Supply
          </Btn>
          <Btn small onClick={toggleMute} title="Mute (M)">
            {meta.settings.muted ? '🔇' : '🔊'}
          </Btn>
        </div>
      </div>

      {/* canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block cursor-pointer"
          onPointerMove={(e) => {
            const p = rel(e);
            const h = b.pick(p.x, p.y);
            if ((h?.c ?? -1) !== (b.hover?.c ?? -1) || (h?.r ?? -1) !== (b.hover?.r ?? -1)) {
              b.hover = h;
              b.changed();
            }
          }}
          onPointerLeave={() => (b.hover = null)}
          onClick={(e) => {
            if (paused) return;
            audio.init();
            const p = rel(e);
            const h = b.pick(p.x, p.y);
            b.hover = h;
            if (h) b.clickHex(h.c, h.r);
            else if (b.selected) b.select(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (b.mode === 'ability') b.setMode('move');
            else b.select(null);
          }}
        />
        <div className="pointer-events-none absolute left-2 top-2 max-w-[70%] rounded-lg border border-[#3d3460] bg-[#120e20]/85 px-3 py-1.5 text-xs font-semibold text-[#f5d78a] sm:text-sm">🎯 {b.objectiveText()}</div>
        {b.hover && b.inb(b.hover.c, b.hover.r) && (
          <div className="pointer-events-none absolute right-2 top-2 hidden max-w-[40%] rounded-lg border border-[#3d3460] bg-[#120e20]/85 px-3 py-1.5 text-xs text-[#cfc6ea] sm:block">{b.tileInfo(b.hover.c, b.hover.r)}</div>
        )}
        {tutorial && !result && (
          <div className="absolute bottom-2 left-1/2 w-[min(640px,94%)] -translate-x-1/2 rounded-xl border-2 border-[#f5d78a] bg-[#1a1430]/95 p-3 shadow-2xl anim-pop">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-sm font-extrabold text-[#f5d78a]">
                Tutorial {step + 1}/{TUTORIAL.length}
              </span>
              <Btn small variant="ghost" onClick={onQuit}>
                Skip ✕
              </Btn>
            </div>
            <p className="text-sm text-[#efe9ff]">{TUTORIAL[step].text}</p>
          </div>
        )}
        {mode(b, sel)}
      </div>

      {/* bottom panel */}
      <div className="z-10 border-t border-[#2f2750] bg-[#120e20] p-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div className="min-h-[84px] flex-1 rounded-lg border border-[#3d3460] bg-[#171326] p-2">{shown ? <UnitCard b={b} u={shown} /> : <div className="p-2 text-sm text-[#9a90b8]">Select a unit to see its details. Click enemies to inspect them.</div>}</div>
          <div className="flex flex-wrap items-center gap-1.5 lg:w-[360px] lg:flex-col lg:items-stretch">
            <div className="flex flex-1 flex-wrap gap-1.5">
              {b.alive('player').map((u) => (
                <button
                  key={u.id}
                  onClick={() => isPlayer && b.select(u)}
                  title={`${u.name} (${CLASSES[u.kind].name})`}
                  className={cn('relative h-9 w-9 rounded-lg border text-lg transition', u === sel ? 'border-[#f5d78a] bg-[#3a3060]' : 'border-[#3d3460] bg-[#1c1730] hover:bg-[#2a2342]', u.acted && u.mp <= 0 && 'opacity-45')}
                >
                  {CLASSES[u.kind].icon}
                  <span className="absolute -bottom-1 left-0 h-1 rounded bg-[#5be37a]" style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                  {u.pendingPerks > 0 && <span className="absolute -right-1 -top-1 text-[10px]">⭐</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {abilityDef && sel && (
                <Btn
                  small
                  variant={b.mode === 'ability' ? 'gold' : 'default'}
                  disabled={!isPlayer || !b.abilityReady(sel)}
                  onClick={() => b.setMode('ability')}
                  title={abilityDef.desc}
                >
                  ✨ {abilityDef.name}
                  {sel.cd > 0 ? ` (${sel.cd})` : ''} [A]
                </Btn>
              )}
              <Btn small disabled={!isPlayer || !sel || !sel.undo} onClick={() => b.undoMove()} title="Undo move (U)">
                ↩ Undo
              </Btn>
              <Btn small disabled={!isPlayer} onClick={() => b.cycleUnit()} title="Next unit (Tab)">
                ⇥ Next
              </Btn>
              <Btn variant="gold" disabled={!isPlayer} onClick={() => b.endTurn()} className={cn('flex-1', isPlayer && readyCount === 0 && 'anim-glow')}>
                {isPlayer ? 'End Turn ⏎' : b.phase === 'over' ? 'Battle over' : 'Resolving…'}
              </Btn>
            </div>
          </div>
        </div>
      </div>

      {/* pause menu */}
      {paused && !result && (
        <Modal title={view === 'settings' ? 'Settings' : view === 'help' ? 'Field Manual' : 'Paused'} wide={view === 'help'}>
          {view === 'main' && (
            <div className="grid gap-2">
              <Btn variant="gold" onClick={() => setPaused(false)}>
                ▶ Resume
              </Btn>
              <Btn onClick={() => setView('settings')}>⚙ Settings & Volume</Btn>
              <Btn onClick={() => setView('help')}>📖 Help & Controls</Btn>
              <Btn
                onClick={() => {
                  setPaused(false);
                  onRetry();
                }}
              >
                ↻ Restart Mission
              </Btn>
              <Btn variant="danger" onClick={() => setView('confirm')}>
                ⎋ Abandon Battle
              </Btn>
              <p className="pt-1 text-center text-xs text-[#9a90b8]">Press Esc to resume</p>
            </div>
          )}
          {view === 'settings' && (
            <>
              <SettingsPanel meta={meta} setMeta={setMeta} />
              <Btn className="mt-3" onClick={() => setView('main')}>
                ← Back
              </Btn>
            </>
          )}
          {view === 'help' && (
            <>
              <HelpPanel />
              <Btn className="mt-3" onClick={() => setView('main')}>
                ← Back
              </Btn>
            </>
          )}
          {view === 'confirm' && (
            <div className="space-y-3">
              <p className="text-sm text-[#ffd0d6]">Abandon this battle? Your roster returns to its state before the mission, but the attempt is forfeited.</p>
              <div className="flex gap-2">
                <Btn variant="danger" onClick={onQuit}>
                  Abandon
                </Btn>
                <Btn onClick={() => setView('main')}>Keep fighting</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}

      {result && <ResultModal r={result} cfg={cfg} tutorial={tutorial} onFinish={() => onFinish(result)} onRetry={onRetry} onQuit={onQuit} />}
    </div>
  );
}

function mode(b: Battle, sel: BUnit | null) {
  if (!sel || b.mode !== 'ability') return null;
  const a = CLASSES[sel.kind].ability;
  return (
    <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 rounded-lg border border-[#c9a0ff] bg-[#2a1a4a]/90 px-3 py-1 text-xs font-bold text-[#e9d4ff]">
      ✨ {a?.name}: choose a highlighted target (Right-click / Esc to cancel)
    </div>
  );
}

function UnitCard({ b, u }: { b: Battle; u: BUnit }) {
  const st = b.statsOf(u);
  const def = u.team === 'player' ? CLASSES[u.kind] : ENEMIES[u.kind];
  const gear = GEAR.find((g) => g.id === u.gear);
  const tile = b.tile(u.c, u.r);
  const pct = Math.round((u.hp / u.maxHp) * 100);
  return (
    <div className="flex gap-3">
      <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 text-3xl', u.team === 'player' ? 'border-[#8fe3ff] bg-[#1f4a66]' : 'border-[#ff9a8a] bg-[#6a2428]')}>{def.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-display text-base font-extrabold text-white">{u.name}</span>
          <span className={cn('text-xs font-bold', u.team === 'player' ? 'text-[#8fe3ff]' : 'text-[#ff9a8a]')}>
            {def.name}
            {u.team === 'player' ? ` · ${RANKS[u.level - 1]}` : ''}
          </span>
          {u.team === 'player' && <span className="text-[11px] text-[#9a90b8]">XP {u.xp} · {u.kills} kills</span>}
          {u.pendingPerks > 0 && <Chip color="#8a6a10">⭐ perk ready after battle</Chip>}
        </div>
        <div className="my-1 flex items-center gap-2">
          <div className="h-2.5 w-36 overflow-hidden rounded bg-black/60">
            <div className="h-full" style={{ width: `${pct}%`, background: pct > 55 ? '#5be37a' : pct > 28 ? '#f0c040' : '#f05a4a' }} />
          </div>
          <span className="text-xs font-bold tabular-nums">
            {u.hp}/{u.maxHp}
          </span>
          <span className="text-xs text-[#cfc6ea]">
            ⚔ {st.atk} · 👣 {u.team === 'player' ? u.mp : st.move}/{st.move} · 🛡 {st.armor} · 🎯 {st.rmin === st.rmax ? st.rmin : `${st.rmin}-${st.rmax}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip color="#2a2342">
            {TERRAIN[tile.t].name}
            {TERRAIN[tile.t].cover ? ` +${TERRAIN[tile.t].cover}` : ''}
          </Chip>
          {u.team === 'player' && (u.supplied ? <Chip color="#1f5a40">📦 Supplied</Chip> : <Chip color="#8a4a10">⚠ No supply{st.penal ? ': -1 ATK/MOVE' : ' (immune)'}</Chip>)}
          {tile.flood > 0 && <Chip color="#1f5a80">🌊 flooded</Chip>}
          {tile.burn > 0 && <Chip color="#8a4416">🔥 burning</Chip>}
          {gear && <Chip color="#3a3060">{gear.icon} {gear.name}</Chip>}
          {u.perks.map((p) => (
            <Chip key={p} color="#4a3a7a" className="cursor-help">
              {PERKS.find((x) => x.id === p)?.name}
            </Chip>
          ))}
          {u.team === 'enemy' && ENEMIES[u.kind].ability && <Chip color="#5a2a70">✨ {ENEMIES[u.kind].ability!.name}</Chip>}
          {u.team === 'player' && CLASSES[u.kind].ability && <Chip color="#5a2a70">✨ {CLASSES[u.kind].ability!.name}</Chip>}
          {u.flags.enraged && <Chip color="#8a1a1a">ENRAGED</Chip>}
        </div>
        <div className="mt-1 text-[11px] leading-snug text-[#9a90b8]">{def.desc}</div>
      </div>
    </div>
  );
}

function ResultModal({ r, cfg, tutorial, onFinish, onRetry, onQuit }: { r: BattleResult; cfg: BattleConfig; tutorial: boolean; onFinish: () => void; onRetry: () => void; onQuit: () => void }) {
  const stats: [string, string | number][] = [
    ['Rounds', r.rounds],
    ['Enemies slain', r.kills],
    ['Environment kills', r.envKills],
    ['Damage dealt', r.dealt],
    ['Damage taken', r.taken],
    ['Hazards shored', r.shores],
    ['Depots captured', r.depots],
    ['Tiles collapsed', r.collapsed],
    ['Units lost', r.lost],
  ];
  const ironman = cfg.diff.id === 'warlord' && !tutorial;
  const levelUps = r.units.filter((u) => {
    const old = cfg.roster.find((x) => x.id === u.id);
    return old && u.level > old.level;
  });
  return (
    <Modal wide>
      <div className="text-center">
        <h2 className={cn('font-display text-4xl font-black', r.won ? 'text-[#8dffb0]' : 'text-[#ff7a6a]')}>{r.won ? (tutorial ? 'TUTORIAL COMPLETE' : 'VICTORY') : 'DEFEAT'}</h2>
        <p className="mt-1 text-[#d9d1ee]">{r.reason}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[#3d3460] bg-[#1b1630] p-2 text-center">
            <div className="text-xl font-extrabold text-[#f5d78a]">{v}</div>
            <div className="text-[11px] text-[#9a90b8]">{k}</div>
          </div>
        ))}
      </div>
      {r.won && !tutorial && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-lg bg-[#1d1733] p-2 text-sm">
          <span className="font-bold text-[#ffd75a]">+{r.crowns} 👑 Crowns</span>
          <span className="font-bold text-[#8dffb0]">+{r.laurels} 🌿 Laurels</span>
        </div>
      )}
      {r.mercy.length > 0 && <p className="mt-2 text-center text-sm text-[#8dffb0]">🩺 Field Surgeons saved: {r.mercy.join(', ')}</p>}
      {levelUps.length > 0 && (
        <p className="mt-2 text-center text-sm text-[#ffe14d]">⭐ Promoted: {levelUps.map((u) => `${u.name} (${RANKS[u.level - 1]})`).join(', ')}. Choose perks in the War Room.</p>
      )}
      {r.fallen.length > 0 && (
        <div className="mt-3 rounded-lg border border-[#5a2d3a] bg-[#1d1018] p-2 text-sm">
          <div className="mb-1 font-bold text-[#ff9aa6]">☠ Fallen this battle</div>
          {r.fallen.map((f, i) => (
            <div key={i} className="text-[#d9c0c6]">
              {CLASSES[f.kind]?.icon} {f.name}, {RANKS[f.level - 1]} {CLASSES[f.kind]?.name} — {f.cause}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {r.won ? (
          <Btn variant="gold" onClick={onFinish}>
            {tutorial ? 'Return to Title' : 'Continue ▶'}
          </Btn>
        ) : ironman ? (
          <Btn variant="danger" onClick={onFinish}>
            The Campaign Ends…
          </Btn>
        ) : (
          <>
            <Btn variant="gold" onClick={onRetry}>
              ↻ Retry Mission
            </Btn>
            <Btn onClick={onQuit}>{tutorial ? 'Return to Title' : 'Retreat to War Room'}</Btn>
          </>
        )}
      </div>
      {ironman && <p className="mt-2 text-center text-xs text-[#ff9aa6]">Warlord is an Ironman difficulty: defeat ends the campaign.</p>}
    </Modal>
  );
}
