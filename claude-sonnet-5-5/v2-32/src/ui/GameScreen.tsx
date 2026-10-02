import { useEffect, useRef, useState } from 'react';
import { BOONS, INST, INST_ORDER, PRESETS, STEPS, noteName } from '../game/data';
import type { InstId } from '../game/data';
import { Game } from '../game/engine';
import type { RunConfig, RunResult, Snapshot } from '../game/engine';
import type { SaveData } from '../game/save';
import { audio } from '../game/audio';
import { HelpPanel, SettingsPanel, applyAudio } from './Menus';

interface Props {
  save: SaveData;
  cfg: RunConfig;
  onEnd: (r: RunResult) => void;
  onQuit: () => void;
  onRestart: () => void;
  refresh: () => void;
}

export default function GameScreen({ save, cfg, onEnd, onQuit, onRestart, refresh }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [accentMode, setAccentMode] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState<null | 'quit' | 'restart'>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, save, cfg, (r) => endRef.current(r));
    gameRef.current = g;
    g.subscribe(setSnap);
    return () => {
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // modals swallow Escape so the engine does not resume/pause underneath
  useEffect(() => {
    if (!help && !settings && !confirmQuit) return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (help) setHelp(false);
        else if (settings) setSettings(false);
        else setConfirmQuit(null);
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [help, settings, confirmQuit]);

  const g = gameRef.current;
  const s = snap;
  const noPress = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  };

  const toggleMute = () => {
    save.settings.muted = !save.settings.muted;
    applyAudio(save);
    refresh();
    setSnap((x) => (x ? { ...x } : x));
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-[#070d13] select-none" onMouseDown={noPress}>
      {/* ---------- HUD ---------- */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-2 py-1.5 bg-black/40 border-b border-amber-300/20 text-sm">
        <div className="font-display font-bold text-amber-200 leading-tight">
          <div className="text-[13px] sm:text-sm">{s?.levelName ?? '…'}</div>
          <div className="text-[10px] font-sans font-normal text-amber-100/60">
            {s ? (s.levelId === 5 ? `Wave ${s.wave}` : s.wave === 0 ? 'Get ready' : `Wave ${s.wave}/${s.waves}`) : ''} · {s?.diffName}
          </div>
        </div>
        <div className="chip !text-sm !px-2.5" title="Cogs: spend them on automata">⚙️ <b className="text-amber-200">{s?.cogs ?? 0}</b></div>
        <div className="flex items-center gap-1" title="Harmony: foes that reach the podium drain it">
          <span>💗</span>
          <div className="w-20 sm:w-28 h-3 bg-white/10 rounded-full overflow-hidden border border-white/10">
            <div className="h-full transition-all duration-300" style={{ width: `${s ? (s.harmony / s.maxHarmony) * 100 : 0}%`, background: s && s.harmony / s.maxHarmony < 0.3 ? '#ff4d6d' : '#6be3a1' }} />
          </div>
          <span className="text-xs w-10">{s ? Math.ceil(s.harmony) : 0}/{s?.maxHarmony}</span>
        </div>
        <div className="flex items-center gap-1 chip !px-1.5" title="Tempo ([ and ]). Faster = more cogs per kill, but foes march faster and steam drains faster.">
          <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => g?.setBpm((s?.bpm ?? 100) - 5)}>−</button>
          <span className="w-16 text-center">♩ {s?.bpm} <span className="text-[10px] text-amber-300">×{s?.tempoMult.toFixed(2)}⚙</span></span>
          <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => g?.setBpm((s?.bpm ?? 100) + 5)}>+</button>
        </div>
        <div className="flex items-center gap-1.5" title="Conduct on the beat to build combo and Crescendo. Fill it and press F for Fortissimo.">
          <div className="w-24 sm:w-36 h-4 bg-white/10 rounded-full overflow-hidden border border-white/10 relative">
            <div className="h-full" style={{ width: `${s?.crescendo ?? 0}%`, background: 'linear-gradient(90deg,#c8942f,#ffe08a)' }} />
            <div className="absolute inset-0 text-[10px] text-center leading-4 font-bold text-black/70 mix-blend-screen text-white">CRESCENDO</div>
          </div>
          <button
            className={`btn btn-sm ${s && s.crescendo >= 100 && s.forte === 0 ? 'pulse-glow' : ''}`}
            disabled={!s || s.crescendo < 100 || s.forte > 0}
            onClick={() => g?.forte()}
          >
            {s && s.forte > 0 ? `🔥 ${s.forte}` : 'F · Fortissimo'}
          </button>
          {s && s.combo > 1 && <span className="chip !text-amber-200">🔥 ×{s.combo}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {s && s.phase === 'countdown' && s.mode === 'playing' && (
            <button className="btn btn-sm" onClick={() => g?.callWave()} title="N">
              ▶ Wave in {s.countdown} · call now
            </button>
          )}
          {s && s.phase === 'active' && <span className="chip">👹 {s.enemiesLeft} left</span>}
          <button className="btn btn-ghost btn-sm" onClick={toggleMute} aria-label="Mute">{save.settings.muted ? '🔇' : '🔊'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => g?.pause()} aria-label="Pause">⏸ Pause</button>
        </div>
      </div>

      {/* tutorial banner */}
      {s?.tutorial && (
        <div className="px-3 py-1.5 bg-amber-300/15 border-b border-amber-300/30 text-sm flex items-center gap-3">
          <span className="chip !bg-amber-300/25 text-amber-100 whitespace-nowrap">🎓 Step {Math.min(s.tutorial.step + 1, s.tutorial.total)}/{s.tutorial.total}</span>
          <span className="flex-1 text-amber-50">
            {s.tutorial.text}
            {s.tutorial.step === 2 && <b className="text-amber-200"> ({s.tutorial.progress}/4)</b>}
          </span>
        </div>
      )}

      {/* ---------- stage ---------- */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {s?.boss && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[min(520px,70%)] pointer-events-none">
            <div className="text-center font-display font-bold text-rose-200 text-xs sm:text-sm drop-shadow">{s.boss.name}</div>
            <div className="h-3 bg-black/60 rounded-full border border-rose-300/50 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-600 to-rose-300 transition-all" style={{ width: `${(s.boss.hp / s.boss.max) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <button className="btn !py-3 !px-5 text-base touch-none" onPointerDown={(e) => { e.preventDefault(); g?.conduct(); }}>
            🪄 CONDUCT <span className="text-[10px] opacity-70">Space</span>
          </button>
        </div>
        {s?.mode === 'ended' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center font-display text-3xl sm:text-5xl text-amber-100 pointer-events-none">
            {s.harmony > 0 ? 'Bravo!' : 'Silence…'}
          </div>
        )}
      </div>

      {/* ---------- bottom: palette + editor ---------- */}
      <div className="bg-black/50 border-t border-amber-300/25 p-2 flex flex-col lg:flex-row gap-2 max-h-[46vh] overflow-y-auto">
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible lg:w-[210px] shrink-0">
          <div className="hidden lg:block text-[10px] uppercase tracking-widest text-amber-200/60">Automata (1–7)</div>
          <div className="flex lg:grid lg:grid-cols-2 gap-1.5">
            {INST_ORDER.map((id, i) => {
              const d = INST[id];
              const open = !!s?.unlocked.includes(id);
              const cost = s?.costs[id] ?? d.cost;
              const afford = (s?.cogs ?? 0) >= cost;
              const armed = s?.armed === id;
              return (
                <button
                  key={id}
                  disabled={!open}
                  title={`${d.name} — ${d.desc}`}
                  onClick={() => g?.armInstrument(id as InstId)}
                  className={`relative panel !rounded-lg px-2 py-1 text-left min-w-[78px] lg:min-w-0 transition ${armed ? 'ring-2 ring-emerald-300 !bg-emerald-300/10' : ''} ${!open ? 'opacity-30' : afford ? 'hover:brightness-125' : 'opacity-60'}`}
                >
                  <span className="absolute top-0.5 right-1 text-[9px] text-amber-100/40">{i + 1}</span>
                  <div className="text-xl leading-none">{open ? d.icon : '🔒'}</div>
                  <div className="text-[10px] font-bold truncate">{d.name.split(' ')[0]}</div>
                  <div className={`text-[11px] ${afford ? 'text-amber-300' : 'text-rose-300'}`}>⚙️ {cost}</div>
                </button>
              );
            })}
          </div>
          <div className="hidden lg:block text-[10px] text-amber-100/50 leading-tight">
            {s?.armed ? `Placing ${INST[s.armed].name}: click a square. Right-click cancels.` : 'Pick a card, then click the staff. Click an automaton to compose.'}
          </div>
        </div>

        {s?.selected ? (
          <Editor key={s.selected.id} s={s} g={g} accentMode={accentMode} setAccentMode={setAccentMode} />
        ) : (
          <div className="panel flex-1 p-3 text-sm text-amber-100/60 flex flex-col justify-center min-h-[80px]">
            <div className="font-display text-amber-200">Composition Editor</div>
            Select an automaton on the staff to write its 16-step melody. Foes march one step per beat; the pips at the top of the stage show the playhead.
            <div className="mt-1 text-[11px]">Tip: line up consonant notes (same step, scale degrees 3 or 5 apart) for chord bonuses.</div>
          </div>
        )}
      </div>

      {/* ---------- boon interlude ---------- */}
      {s?.mode === 'interlude' && s.boonChoices && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3" onMouseDown={(e) => e.stopPropagation()}>
          <div className="max-w-3xl w-full pop-in">
            <h3 className="font-display text-3xl text-center text-amber-200 mb-1">Interlude</h3>
            <p className="text-center text-amber-100/70 text-sm mb-4">Choose a motif to carry through the rest of this performance.</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {s.boonChoices.map((id) => {
                const b = BOONS.find((x) => x.id === id)!;
                return (
                  <button key={id} className="panel p-4 text-center hover:brightness-125 hover:-translate-y-1 transition" onClick={() => g?.pickBoon(id)}>
                    <div className="text-4xl">{b.icon}</div>
                    <div className="font-display font-bold text-amber-100 mt-1">{b.name}</div>
                    <div className="text-xs text-amber-100/70 mt-1">{b.desc}</div>
                    {(s.boons[id] ?? 0) > 0 && <div className="chip mt-2">owned ×{s.boons[id]}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- pause ---------- */}
      {s?.mode === 'paused' && !help && !settings && !confirmQuit && (
        <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center p-3" onMouseDown={(e) => e.stopPropagation()}>
          <div className="panel p-6 w-full max-w-sm pop-in flex flex-col gap-2.5">
            <h3 className="font-display text-3xl text-amber-200 text-center">Intermission</h3>
            <div className="text-center text-xs text-amber-100/60 mb-1">{s.levelName} · Wave {s.wave} · {s.diffName}</div>
            <button className="btn" onClick={() => g?.resume()}>▶ Resume</button>
            <button className="btn btn-ghost" onClick={() => setSettings(true)}>⚙️ Settings, Volume & Difficulty</button>
            <button className="btn btn-ghost" onClick={() => setHelp(true)}>📖 Help & Controls</button>
            <button className="btn btn-ghost" onClick={() => setConfirmQuit('restart')}>↻ Restart Movement</button>
            <button className="btn btn-ghost" onClick={() => setConfirmQuit('quit')}>⏏ Leave to Conservatory</button>
          </div>
        </div>
      )}
      {confirmQuit && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onMouseDown={(e) => e.stopPropagation()}>
          <div className="panel p-6 max-w-sm w-full pop-in text-center">
            <div className="font-display text-xl text-amber-200 mb-2">{confirmQuit === 'quit' ? 'Leave this performance?' : 'Restart this movement?'}</div>
            <p className="text-sm text-amber-100/70 mb-4">Progress in this run will be lost (no Opus is awarded).</p>
            <div className="flex gap-2 justify-center">
              <button className="btn btn-danger" onClick={() => { audio.sfx('click'); if (confirmQuit === 'quit') onQuit(); else onRestart(); }}>Yes</button>
              <button className="btn btn-ghost" onClick={() => setConfirmQuit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {settings && <SettingsPanel save={save} onChange={() => { refresh(); setSnap((x) => (x ? { ...x } : x)); }} onClose={() => setSettings(false)} game={g} snap={s} />}
      {help && <HelpPanel onClose={() => setHelp(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ Editor
function Editor({ s, g, accentMode, setAccentMode }: { s: Snapshot; g: Game | null; accentMode: boolean; setAccentMode: (b: boolean) => void }) {
  const a = s.selected!;
  const d = INST[a.inst];
  const rows = [6, 5, 4, 3, 2, 1, 0];
  const notes = a.pattern.filter(Boolean).length;
  const drain = a.barCost;
  const barSec = (60 / s.bpm) * 4;
  const perSec = drain / barSec;
  const regen = 10;
  const overdrawn = perSec > regen * 1.05;

  return (
    <div className="panel flex-1 p-2 sm:p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">{d.icon}</span>
        <div className="leading-tight">
          <div className="font-display font-bold text-amber-100 text-sm">{d.name} <span className="text-amber-300">Lv {a.lvl}</span></div>
          <div className="text-[10px] text-amber-100/60">{d.role} · {notes} notes · {drain} steam/bar</div>
        </div>
        <div className="flex flex-col gap-0.5 w-24" title="Health">
          <div className="h-2 bg-white/10 rounded overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${(a.hp / a.maxHp) * 100}%` }} /></div>
          <div className="h-2 bg-white/10 rounded overflow-hidden" title="Steam"><div className={`h-full ${a.pressure < a.maxP * 0.15 ? 'bg-rose-400' : 'bg-sky-400'}`} style={{ width: `${(a.pressure / a.maxP) * 100}%` }} /></div>
        </div>
        {a.silence > 0 && <span className="chip !text-sky-200">🤫 silenced {a.silence}</span>}
        {overdrawn && <span className="chip !text-rose-200" title="This pattern uses more steam than regenerates">⚠ steam deficit</span>}
        <div className="ml-auto flex gap-1.5 flex-wrap">
          <button className="btn btn-sm" disabled={a.lvl >= 3 || s.cogs < a.upgradeCost} onClick={() => g?.upgradeSelected()}>
            {a.lvl >= 3 ? 'MAX' : `⬆ U · ⚙️${a.upgradeCost}`}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => g?.sellSelected()}>💰 X · +{a.sellValue}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => g?.selectAuto(null)}>✕</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[420px]" style={{ gridTemplateColumns: `30px repeat(${STEPS}, minmax(0, 1fr))`, gap: 1 }}>
          {rows.map((deg) => (
            <RollRow key={deg} deg={deg} s={s} g={g} accentMode={accentMode} color={d.color} />
          ))}
          <div />
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className={`text-center text-[9px] ${i % 4 === 0 ? 'text-amber-300' : 'text-white/25'}`}>{i % 4 === 0 ? i / 4 + 1 : '·'}</div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <button className={`btn btn-sm ${accentMode ? '' : 'btn-ghost'}`} onClick={() => setAccentMode(!accentMode)} title="Shift-click also toggles accents">
          {accentMode ? '◆ Accent mode ON' : '◇ Accent mode'}
        </button>
        <select
          className="bg-black/50 border border-amber-300/40 rounded-lg text-xs px-2 py-1"
          value=""
          onChange={(e) => { if (e.target.value !== '') g?.applyPreset(Number(e.target.value)); e.currentTarget.blur(); }}
        >
          <option value="">Presets…</option>
          {PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.shiftPattern(-1)} title="Shift earlier">◀</button>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.shiftPattern(1)} title="Shift later">▶</button>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.transpose(1)} title="Transpose up">♯ up</button>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.transpose(-1)} title="Transpose down">♭ down</button>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.mirrorPattern()} title="Copy first half to second half">⧉ Repeat ½</button>
        <button className="btn btn-ghost btn-sm" onClick={() => g?.clearPattern()}>Clear</button>
        <span className="text-[10px] text-amber-100/50 hidden xl:inline">Click = note · Shift/Right-click = accent · Foes tagged DOWNBEAT/OFFBEAT care about steps 1·5·9·13</span>
      </div>
    </div>
  );
}

function RollRow({ deg, s, g, accentMode, color }: { deg: number; s: Snapshot; g: Game | null; accentMode: boolean; color: string }) {
  const a = s.selected!;
  return (
    <>
      <div className="text-[9px] text-amber-100/50 text-right pr-1 leading-4 sm:leading-5 select-none">{noteName(s.root, deg)}{deg === 0 ? ' ●' : ''}</div>
      {Array.from({ length: STEPS }).map((_, i) => {
        const st = a.pattern[i];
        const on = st && st.d === deg;
        const head = s.step === i;
        return (
          <button
            key={i}
            aria-label={`step ${i + 1} ${noteName(s.root, deg)}`}
            className={`roll-cell h-4 sm:h-[18px] rounded-[3px] ${i % 4 === 0 ? 'beat' : ''} ${head ? 'head' : ''}`}
            style={on ? { background: color, boxShadow: st!.a ? `0 0 8px ${color}, inset 0 0 0 2px #fff` : undefined, opacity: head ? 1 : 0.85 } : undefined}
            onClick={(e) => g?.setNote(i, deg, accentMode || e.shiftKey)}
            onContextMenu={(e) => { e.preventDefault(); g?.setNote(i, deg, true); }}
          />
        );
      })}
    </>
  );
}

