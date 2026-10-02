import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Btn, Panel, Stars, Stardust, UnitIcon } from './ui';
import { Save, Settings } from '../game/save';
import { DIFFS, LevelDef, TUT_STEPS, UNITS } from '../game/data';
import {
  Game, Result, Unit, calcDamage, clearSel, clickTile, computeResult, createGame, doBrace, doUndo, doWait, driftOf, driftPlan, driftThreshold,
  endTurn, fieldAt, findOpt, massOf, selectNext, setPulseKind, toggleField, togglePulse, unitAt, updateGame,
} from '../game/engine';
import { draw, layout, tileFromPoint, View } from '../game/render';
import { audio } from '../game/audio';

const COACH = [
  'Welcome, Commander. Click one of your cyan pieces to select it. (Keyboard: arrows + Enter.)',
  'Blue tiles are where it can move. The number is the movement cost: gravity makes it cheaper to move TOWARD heavy masses (green) and costlier away (orange). Click a tile.',
  'Now act: hover an outlined enemy to see the beam curve toward heavy masses, then click to fire. Or press Wait (W) / Brace (B) to end this piece\'s turn.',
  'Move your other pieces, then press End Turn (E). After the enemy phase, gravity DRIFT pulls light pieces toward heavy masses - watch the small arrows on pieces.',
  'Press G (or the Field button) to reveal the gravity field. Arrows show the pull; notice how the grid itself warps.',
  'You have Energy! Press P, then click an empty tile to drop a Gravity Pulse - a temporary well that pulls pieces and bends beams. Keys 1/2 swap well and repulsor.',
  'Objective: destroy the enemy Core (the glowing heart piece). Beware black holes and drift. You are ready - good luck!',
];

interface Props {
  lvl: LevelDef;
  save: Save;
  deployed: string[];
  modalOpen: boolean;
  onResult: (r: Result, g: Game) => void;
  onRetry: () => void;
  onNext: (() => void) | null;
  onMap: () => void;
  onBarracks: () => void;
  openHelp: () => void;
  openSettings: () => void;
  setSettings: (s: Settings) => void;
}

export default function Battle(props: Props) {
  const { lvl, save } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  const bumpRef = useRef<() => void>(() => {});
  const [tick, setTick] = useState(0);
  const [pause, setPause] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [coachOff, setCoachOff] = useState(false);
  const resultSent = useRef(false);
  const touchPending = useRef<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [G] = useState<Game>(() =>
    createGame({
      lvl, roster: save.roster, deployed: props.deployed, settings: save.settings, research: save.research,
      tutOn: lvl.id === 1 && save.settings.coach, notify: () => bumpRef.current(),
    })
  );
  bumpRef.current = () => setTick((t) => t + 1);

  const pausedRef = useRef(false);
  pausedRef.current = pause || props.modalOpen;

  // main loop + resize
  useEffect(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const w = Math.max(50, wrap.clientWidth);
      const h = Math.max(50, wrap.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewRef.current = layout(w, h, G);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!pausedRef.current) updateGame(G, dt);
      if (viewRef.current) draw(ctx, G, viewRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [G]);

  // audio + visibility
  useEffect(() => {
    audio.init();
    audio.startMusic();
    const vis = () => {
      if (document.hidden) {
        setPause(true);
        audio.suspend();
      } else audio.resume();
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  // live settings sync
  useEffect(() => {
    G.diff = DIFFS.find((d) => d.id === save.settings.diff) || G.diff;
    G.shakeOn = save.settings.shake;
    G.pf = save.settings.particles === 0 ? 0.4 : 1;
  }, [G, save.settings.diff, save.settings.shake, save.settings.particles]);

  // result
  useEffect(() => {
    if (G.resultReady && !resultSent.current) {
      resultSent.current = true;
      const r = computeResult(G, propsRef.current.save.research);
      setResult(r);
      propsRef.current.onResult(r, G);
    }
  }, [G, tick]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = propsRef.current;
      if (p.modalOpen) return;
      const k = e.key;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (tag === 'BUTTON' && (k === 'Enter' || k === ' ')) {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      if (k === 'Escape') {
        if (G.over) return;
        if (G.mode === 'pulse') G.mode = 'idle';
        else if (G.sel) clearSel(G);
        else setPause((v) => !v);
        G.notify();
        return;
      }
      if (k === 'm' || k === 'M') {
        p.setSettings({ ...p.save.settings, muted: !p.save.settings.muted });
        return;
      }
      if (pausedRef.current || G.over) return;
      const move = (dx: number, dy: number) => {
        e.preventDefault();
        G.cursor = { x: Math.max(0, Math.min(G.W - 1, G.cursor.x + dx)), y: Math.max(0, Math.min(G.H - 1, G.cursor.y + dy)) };
        G.hover = { ...G.cursor };
        G.notify();
      };
      switch (k) {
        case 'ArrowUp': move(0, -1); break;
        case 'ArrowDown': move(0, 1); break;
        case 'ArrowLeft': move(-1, 0); break;
        case 'ArrowRight': move(1, 0); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          clickTile(G, G.cursor.x, G.cursor.y);
          break;
        case 'e': case 'E': endTurn(G); break;
        case 'w': case 'W': doWait(G); break;
        case 'b': case 'B': doBrace(G); break;
        case 'z': case 'Z': case 'Backspace': doUndo(G); break;
        case 'g': case 'G': toggleField(G); break;
        case 'p': case 'P': togglePulse(G); break;
        case '1': setPulseKind(G, 'well'); break;
        case '2': setPulseKind(G, 'rep'); break;
        case 'Tab': case 'n': case 'N': e.preventDefault(); selectNext(G); break;
        case 'h': case 'H': p.openHelp(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [G]);

  const tileFromEvent = (e: RPointerEvent) => {
    const cv = cvRef.current;
    const v = viewRef.current;
    if (!cv || !v) return null;
    const r = cv.getBoundingClientRect();
    return tileFromPoint(v, G, e.clientX - r.left, e.clientY - r.top);
  };
  const onMove = (e: RPointerEvent) => {
    const t = tileFromEvent(e);
    const h = G.hover;
    if ((t?.x ?? -1) !== (h?.x ?? -1) || (t?.y ?? -1) !== (h?.y ?? -1)) {
      G.hover = t;
      G.notify();
    }
  };
  const onDown = (e: RPointerEvent) => {
    audio.init();
    if (pausedRef.current) return;
    if (e.button === 2) {
      if (G.mode === 'pulse') G.mode = 'idle';
      else clearSel(G);
      G.notify();
      return;
    }
    const t = tileFromEvent(e);
    if (!t) return;
    if (e.pointerType === 'touch' && G.sel && G.phase === 'player' && G.mode === 'idle') {
      const u = unitAt(G, t.x, t.y);
      if (u && u.team === 'e' && findOpt(G.attacks, u) && touchPending.current !== u.id) {
        touchPending.current = u.id;
        G.hover = t;
        G.notify();
        return;
      }
    }
    touchPending.current = null;
    G.hover = t;
    clickTile(G, t.x, t.y);
  };

  // ---- HUD derived values ----
  const hov = G.hover ? unitAt(G, G.hover.x, G.hover.y) : null;
  const info: Unit | null = hov || G.sel;
  const sel = G.sel;
  const optHover = sel && hov && hov.team === 'e' ? findOpt(G.attacks, hov) : null;
  const dmgPrev = sel && hov && optHover ? calcDamage(G, sel, hov, optHover, optHover.targets.indexOf(hov)) : 0;
  const fld = G.hover ? fieldAt(G, G.hover.x, G.hover.y, null) : null;
  const dangers = G.phase === 'over' ? [] : driftPlan(G).filter((d) => d.u.team === 'p' && d.fate === 'hole');
  const myTurn = G.phase === 'player' && !G.over;
  const unready = G.units.filter((u) => u.alive && u.team === 'p' && !u.acted).length;
  const diff = DIFFS.find((d) => d.id === save.settings.diff);
  const objText =
    lvl.obj === 'king' ? (lvl.boss ? 'Destroy the boss' : 'Destroy the enemy Core') : lvl.obj === 'annihilate' ? 'Eliminate all hostiles' : `Survive ${lvl.surviveRounds} rounds`;
  const enemies = G.units.filter((u) => u.alive && u.team === 'e').length;
  const coachShow = G.tutOn && save.settings.coach && !coachOff && !G.over;

  const dr = info ? driftOf(G, info) : null;

  const lastLvl = lvl.id === 10;

  return (
    <div className="relative flex h-full w-full flex-col bg-[#05060f]">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-cyan-400/20 bg-slate-950/90 px-3 py-1.5 text-sm">
        <div className="font-display text-xs font-bold tracking-widest text-cyan-200 sm:text-sm">{lvl.id}. {lvl.name.toUpperCase()}</div>
        <div className="text-slate-300">
          Round <b className="text-white">{G.round}</b>
          {lvl.obj === 'survive' ? `/${lvl.surviveRounds}` : ` (par ${lvl.par})`}
        </div>
        <div className="hidden text-fuchsia-300 sm:block">{objText}</div>
        <div className="text-slate-300">Hostiles <b className="text-rose-300">{enemies}</b></div>
        <div className="flex items-center gap-1" title="Energy: spend 2 on a Gravity Pulse">
          <span className="text-xs text-slate-400">ENERGY</span>
          {Array.from({ length: G.maxEnergy }).map((_, i) => (
            <span key={i} className={`h-3 w-3 rotate-45 border ${i < G.energy ? 'border-amber-200 bg-amber-300 shadow-[0_0_8px_#ffd24f]' : 'border-slate-600'}`} />
          ))}
        </div>
        <div className="text-xs text-slate-500">{diff?.name}{G.mods.length ? ' + ' + G.mods.length + ' mod' : ''}</div>
        <div className="ml-auto flex gap-1.5">
          <Btn small active={G.showField} onClick={() => toggleField(G)} title="G">Field</Btn>
          <Btn small onClick={props.openHelp} title="H">Help</Btn>
          <Btn small onClick={() => setPause(true)} title="Esc">Pause</Btn>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div ref={wrapRef} className="relative min-h-0 min-w-0 flex-1 touch-none">
          <canvas
            ref={cvRef}
            className="absolute inset-0 block cursor-crosshair"
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse' && G.hover) {
                G.hover = null;
                G.notify();
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* phase chip */}
          <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
            <span className={`rounded px-2 py-0.5 text-xs font-bold tracking-widest ${myTurn ? 'bg-cyan-400/20 text-cyan-200' : 'bg-rose-500/20 text-rose-200'}`}>
              {G.over ? 'BATTLE OVER' : G.phase === 'player' ? 'YOUR TURN' : G.phase === 'enemy' ? 'ENEMY PHASE' : 'GRAVITY DRIFT'}
            </span>
            {G.mode === 'pulse' && (
              <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-200">PULSE: click an empty tile ({G.pulseKind === 'well' ? 'well' : 'repulsor'}) · Esc cancels</span>
            )}
            {dangers.length > 0 && myTurn && (
              <span className="animate-pulse rounded bg-red-600/40 px-2 py-0.5 text-xs font-bold text-red-100">⚠ DRIFT DANGER: {dangers.map((d) => d.u.name).join(', ')} will fall into a black hole!</span>
            )}
            {G.telegraph && <span className="rounded bg-fuchsia-500/30 px-2 py-0.5 text-xs font-bold text-fuchsia-100">⚠ Collapse marked - leave the purple tiles</span>}
          </div>
        </div>

        {/* side panel */}
        <div className="flex max-h-[42%] shrink-0 flex-col gap-2 overflow-y-auto border-t border-cyan-400/20 bg-slate-950/90 p-2 md:max-h-none md:w-72 md:border-l md:border-t-0">
          {coachShow && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-300/10 p-2 shadow-[0_0_18px_rgba(255,210,79,0.25)]">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-widest text-amber-300">
                <span>TUTORIAL {Math.min(G.tut + 1, COACH.length)}/{COACH.length}</span>
                <button className="text-slate-300 hover:text-white" onClick={() => setCoachOff(true)}>
                  {G.tut >= TUT_STEPS.length - 1 ? 'Got it ✕' : 'Skip ✕'}
                </button>
              </div>
              <p className="text-xs leading-snug text-slate-100">{COACH[Math.min(G.tut, COACH.length - 1)]}</p>
            </div>
          )}
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-2 text-sm">
            {info ? (
              <>
                <div className="flex items-center gap-2">
                  <UnitIcon type={info.type} team={info.team} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{info.name} {info.team === 'e' && <span className="text-xs text-rose-300">HOSTILE</span>}</div>
                    <div className="text-xs text-slate-400">{UNITS[info.type].name} ({UNITS[info.type].role}) {'★'.repeat(info.promo.length)}</div>
                  </div>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
                  <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, (info.hp / info.maxHp) * 100)}%` }} />
                </div>
                <div className="mt-1 grid grid-cols-3 gap-x-2 text-xs text-cyan-200">
                  <span>HP {info.hp}/{info.maxHp}</span>
                  <span>Mass {massOf(info)}</span>
                  <span>ATK {info.stats.atk}</span>
                  <span>Move {info.stats.move.toFixed(1)}</span>
                  <span>Range {UNITS[info.type].adirs === 'knight' ? 'L' : info.stats.range}</span>
                  <span>Armor {info.stats.armor}</span>
                </div>
                {info.stats.flags.length > 0 && <div className="text-[11px] text-fuchsia-300">Traits: {info.stats.flags.join(', ')}</div>}
                <div className="mt-1 text-[11px] text-slate-400">
                  Drift threshold {driftThreshold(G, info).toFixed(1)}
                  {dr ? <span className={dr.fate === 'hole' ? 'font-bold text-red-400' : 'text-sky-300'}> · drifting ({dr.dx},{dr.dy}) {dr.fate === 'hole' ? '→ VOID' : dr.fate === 'collide' ? '→ collision' : ''}</span> : ' · stable'}
                </div>
                {optHover && (
                  <div className="mt-1 rounded bg-rose-500/15 p-1 text-xs text-rose-100">
                    Attack: <b>{dmgPrev}</b> dmg → {Math.max(0, hov!.hp - dmgPrev)}/{hov!.maxHp} HP
                    {dmgPrev >= hov!.hp ? ' · LETHAL' : ''}
                    {optHover.targets.length > 1 ? ' · pierces' : ''}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-400">Hover or select a piece to inspect it. Mass bends everything - heavier pieces glow larger.</div>
            )}
            {fld && G.hover && (
              <div className="mt-1 text-[11px] text-slate-500">Tile ({G.hover.x},{G.hover.y}) field strength <b className="text-sky-300">{Math.hypot(fld[0], fld[1]).toFixed(1)}</b></div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <Btn small disabled={!sel || !myTurn} onClick={() => doWait(G)} title="W">Wait</Btn>
            <Btn small disabled={!sel || !myTurn} onClick={() => doBrace(G)} title="B: +3 mass">Brace</Btn>
            <Btn small disabled={!sel || !sel.prev || !myTurn} onClick={() => doUndo(G)} title="Z">Undo</Btn>
          </div>
          <div className="rounded-lg border border-amber-300/30 bg-slate-900/70 p-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-bold tracking-widest text-amber-300">GRAVITY PULSE</span>
              <span className="text-slate-400">cost 2 ◆</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Btn small active={G.pulseKind === 'well'} variant={G.pulseKind === 'well' ? 'primary' : 'ghost'} onClick={() => setPulseKind(G, 'well')} title="1">◎ Well</Btn>
              <Btn small active={G.pulseKind === 'rep'} variant={G.pulseKind === 'rep' ? 'gold' : 'ghost'} onClick={() => setPulseKind(G, 'rep')} title="2">✺ Repulsor</Btn>
            </div>
            <Btn small className="mt-1.5 w-full" variant="gold" active={G.mode === 'pulse'} disabled={!myTurn || (G.energy < 2 && G.mode !== 'pulse')} onClick={() => togglePulse(G)} title="P">
              {G.mode === 'pulse' ? 'Cancel pulse' : `Deploy pulse (str ${G.pulseStr}, ${G.pulseDur} rds)`}
            </Btn>
          </div>
          <Btn
            variant="primary"
            disabled={!myTurn}
            onClick={() => endTurn(G)}
            className={`py-3 text-base ${myTurn && unready === 0 ? 'animate-pulse' : ''}`}
            title="E"
          >
            End Turn {unready > 0 && myTurn ? `(${unready} ready)` : ''}
          </Btn>
          <div className="hidden text-[11px] leading-relaxed text-slate-500 md:block">
            <b className="text-slate-400">Keys</b> arrows+Enter cursor · Tab next · W wait · B brace · Z undo · P pulse · G field · E end · Esc pause
          </div>
        </div>
      </div>

      {/* pause */}
      {pause && !result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
          <Panel title="Paused" className="w-full max-w-sm p-4">
            <div className="mt-2 flex flex-col gap-2">
              <Btn variant="primary" onClick={() => setPause(false)}>Resume</Btn>
              <Btn onClick={props.openHelp}>How to Play / Controls</Btn>
              <Btn onClick={props.openSettings}>Settings &amp; Volume</Btn>
              <Btn variant="danger" onClick={props.onRetry}>Restart battle</Btn>
              <Btn variant="danger" onClick={props.onMap}>Abandon to campaign map</Btn>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Round {G.round} · {G.stats.kills} kills · {G.stats.losses} losses</p>
          </Panel>
        </div>
      )}

      {/* result */}
      {result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
          <Panel className="my-auto w-full max-w-xl p-5">
            <div className="text-center">
              <div className={`font-display text-4xl font-black tracking-widest ${result.win ? 'text-cyan-300 drop-shadow-[0_0_18px_rgba(79,240,255,0.7)]' : 'text-rose-400 drop-shadow-[0_0_18px_rgba(255,79,154,0.7)]'}`}>
                {result.win ? (lastLvl ? 'SPACE IS FLAT AGAIN' : 'VICTORY') : 'DEFEAT'}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {result.win
                  ? lastLvl
                    ? 'The Event Horizon collapses. The campaign is complete - keep playing on higher difficulty!'
                    : lvl.name + ' secured.'
                  : G.units.some((u) => u.team === 'p' && u.type === 'core' && !u.alive)
                    ? 'Your Core was destroyed.'
                    : 'Your forces were wiped out.'}
              </div>
              {result.win && <div className="mt-2"><Stars n={result.stars} size={32} /></div>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                ['Rounds', G.round - (G.over === 'win' && lvl.obj === 'survive' ? 1 : 0)],
                ['Kills', G.stats.kills],
                ['Pieces lost', G.stats.losses],
                ['Damage dealt', G.stats.dmgDealt],
                ['Damage taken', G.stats.dmgTaken],
                ['Biggest hit', G.stats.maxHit],
                ['Void kills', G.stats.hazardKills],
                ['Pulses', G.stats.pulses],
                ['Collisions', G.stats.collisions],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-md border border-slate-700 bg-slate-900/70 p-2">
                  <div className="text-lg font-bold text-white">{v}</div>
                  <div className="text-slate-400">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2">
              <span className="text-sm text-amber-100">Salvage (×{result.mult.toFixed(2)}{!result.win ? ', defeat' : ''})</span>
              <span className="text-lg"><Stardust n={result.stardust} /></span>
            </div>
            <div className="mt-2 max-h-28 overflow-y-auto text-xs text-slate-300">
              {Object.entries(result.xp).filter(([, v]) => v.xp > 0).map(([id, v]) => {
                const r = save.roster.find((x) => x.id === id);
                return (
                  <span key={id} className="mr-2 inline-block">
                    {r ? r.name : id} <span className="text-cyan-300">+{v.xp}xp</span>
                  </span>
                );
              })}
              {result.dead.length > 0 && save.settings.mods.includes('iron') && <div className="mt-1 text-rose-300">Ironman: {result.dead.length} piece(s) lost forever.</div>}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {result.win && props.onNext && <Btn variant="primary" onClick={props.onNext}>Next battle →</Btn>}
              <Btn variant={result.win ? 'ghost' : 'primary'} onClick={props.onRetry}>{result.win ? 'Replay' : 'Retry'}</Btn>
              <Btn variant="gold" onClick={props.onBarracks}>Barracks</Btn>
              <Btn onClick={props.onMap}>Campaign map</Btn>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
