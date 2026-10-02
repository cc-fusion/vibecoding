import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, type DiveResult, type PuzzleReq } from '../game/engine';
import { DIFFS, SITES, TRAINING_SITE } from '../game/data';
import type { SaveData, Settings } from '../game/save';
import { audio } from '../game/audio';
import { PuzzleOverlay } from './Puzzles';
import { Btn, DifficultyPicker, FONT, HelpPanel, Modal, SettingsPanel } from './Panels';

interface Props {
  siteId: number;
  tutorial: boolean;
  save: SaveData;
  onEnd: (r: DiveResult) => void;
  onRestart: () => void;
  onSettings: (s: Settings) => void;
  onDiff: (id: string) => void;
  onMods: (m: string[]) => void;
}

const isTouch = () => typeof window !== 'undefined' && ('ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

function TouchControls({ eng }: { eng: React.MutableRefObject<Engine | null> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const r = base.current?.getBoundingClientRect();
    if (!r || !eng.current) return;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const l = Math.hypot(dx, dy);
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
    setKnob({ x: dx, y: dy });
    eng.current.input.mx = dx / max; eng.current.input.my = dy / max;
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); if (eng.current) { eng.current.input.mx = 0; eng.current.input.my = 0; } };
  const hold = (key: 'fire' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); if (eng.current) eng.current.input[key] = true; },
    onPointerUp: () => { if (eng.current) eng.current.input[key] = false; },
    onPointerCancel: () => { if (eng.current) eng.current.input[key] = false; },
  });
  const tap = (a: string) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); audio.init(); eng.current?.press(a); } });
  const cls = 'w-14 h-14 rounded-full border-2 border-white/40 bg-slate-900/60 text-white text-lg flex items-center justify-center select-none active:bg-cyan-700/70';
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none select-none touch-none">
      <div className="absolute left-4 bottom-4 pointer-events-auto touch-none">
        <div
          ref={base}
          className="w-32 h-32 rounded-full border-2 border-white/30 bg-slate-900/40 relative"
          onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
          onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="absolute w-14 h-14 rounded-full bg-cyan-300/50 border border-white/60" style={{ left: 'calc(50% - 28px)', top: 'calc(50% - 28px)', transform: `translate(${knob.x}px,${knob.y}px)` }} />
        </div>
      </div>
      <div className="absolute right-3 bottom-3 pointer-events-auto touch-none grid grid-cols-3 gap-2">
        <button className={cls} {...tap('sonar')}>📡</button>
        <button className={cls} {...tap('flare')}>🎇</button>
        <button className={cls} {...tap('emp')}>⚡</button>
        <button className={cls} {...tap('lantern')}>💡</button>
        <button className={cls} {...hold('boost')}>🌀</button>
        <button className={cls} {...tap('use')}>E</button>
        <button className={`${cls} col-start-3 !w-16 !h-16 bg-rose-800/60`} {...hold('fire')}>🔱</button>
      </div>
      <button className="absolute right-3 top-40 pointer-events-auto w-10 h-10 rounded-full bg-slate-900/70 border border-white/30 text-white pointer-events-auto" {...tap('pause')}>⏸</button>
    </div>
  );
}

export default function GameView({ siteId, tutorial, save, onEnd, onRestart, onSettings, onDiff, onMods }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const [paused, setPaused] = useState(false);
  const [puzzle, setPuzzle] = useState<PuzzleReq | null>(null);
  const [panel, setPanel] = useState<'none' | 'settings' | 'help' | 'diff'>('none');
  const saveRef = useRef(save);
  saveRef.current = save;
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const muteRef = useRef(() => undefined as void);
  muteRef.current = () => onSettings({ ...saveRef.current.settings, muted: !saveRef.current.settings.muted });
  const touch = isTouch();

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const s = saveRef.current;
    const site = tutorial ? TRAINING_SITE : SITES[siteId];
    const e = new Engine(canvas, {
      site,
      save: { upgrades: s.upgrades, codex: s.codex, clears: s.clears },
      diff: DIFFS.find((d) => d.id === s.difficulty) || DIFFS[1],
      mods: tutorial ? [] : s.mods,
      settings: s.settings,
      tutorial,
      cb: {
        onEnd: (r) => endRef.current(r),
        onPause: (p) => { setPaused(p); if (!p) setPanel('none'); },
        onPuzzle: (p) => setPuzzle(p),
        onMute: () => muteRef.current(),
      },
    });
    e.input.touch = isTouch();
    eng.current = e;
    e.start();
    return () => { e.destroy(); eng.current = null; };
  }, [siteId, tutorial]);

  useEffect(() => { eng.current?.setSettings(save.settings); }, [save.settings]);
  useEffect(() => { eng.current?.setDiff(DIFFS.find((d) => d.id === save.difficulty) || DIFFS[1]); }, [save.difficulty]);
  useEffect(() => { if (!tutorial) eng.current?.setMods(save.mods); }, [save.mods, tutorial]);

  const finishPuzzle = useCallback((r: boolean | null) => { setPuzzle(null); eng.current?.finishPuzzle(r); }, []);
  const resume = () => { setPanel('none'); eng.current?.setPaused(false); };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={cv} className="absolute inset-0 w-full h-full block" style={{ cursor: touch ? 'default' : 'crosshair' }} />
      {touch && !paused && !puzzle && <TouchControls eng={eng} />}
      {puzzle && <PuzzleOverlay req={puzzle} onDone={finishPuzzle} />}
      {paused && panel === 'none' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-300/30 bg-[#06141f]/95 p-6 flex flex-col gap-3 text-center">
            <h2 className="text-3xl text-cyan-100" style={FONT}>Paused</h2>
            <p className="text-xs text-cyan-100/60 -mt-2">{tutorial ? 'Training Pool' : SITES[siteId]?.name}</p>
            <Btn onClick={resume}>▶ Resume</Btn>
            <Btn kind="ghost" onClick={() => setPanel('settings')}>🔊 Audio &amp; Settings</Btn>
            {!tutorial && <Btn kind="ghost" onClick={() => setPanel('diff')}>⚙️ Difficulty &amp; Modifiers</Btn>}
            <Btn kind="ghost" onClick={() => setPanel('help')}>❓ Controls &amp; Help</Btn>
            <Btn kind="ghost" onClick={onRestart}>↻ Restart dive</Btn>
            <Btn kind="danger" onClick={() => { eng.current?.setPaused(false); eng.current?.end('abandon', 'Dive abandoned'); }}>Abandon dive (lose cargo)</Btn>
          </div>
        </div>
      )}
      {paused && panel === 'settings' && <Modal title="Settings" onClose={() => setPanel('none')}><SettingsPanel settings={save.settings} onChange={onSettings} /></Modal>}
      {paused && panel === 'diff' && <Modal title="Difficulty" onClose={() => setPanel('none')} wide><p className="text-xs text-amber-200 mb-3">Changes apply immediately to the current dive.</p><DifficultyPicker save={save} onDiff={onDiff} onMods={onMods} /></Modal>}
      {paused && panel === 'help' && <Modal title="How to Dive" onClose={() => setPanel('none')} wide><HelpPanel /></Modal>}
    </div>
  );
}
