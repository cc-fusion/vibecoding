import { useEffect, useRef, useState } from 'react';
import type { Campaign, Crew, GadgetId, HeistResult, Mode, P, Plan, Settings, Step, Thing } from '../game/types';
import { GADGET_IDS } from '../game/types';
import type { World } from '../game/types';
import { GADGETS, ROLE_INFO } from '../game/data';
import { abortAll, carryW, createSim, giveOrder, pickThing, startRun, thingDone, update } from '../game/sim';
import type { SimCfg } from '../game/sim';
import { render } from '../game/render';
import type { View } from '../game/render';
import { audio } from '../game/audio';
import { Btn, GameCanvas, Meter, Modal, money } from './ui';

type Tool = { k: 'order' | 'ambush' | 'distract' | 'gadget' | 'key'; g?: GadgetId };

export function Exec({ world, crew, plan, loadout, cfg, camp, settings, modalOpen, onFinish, onReplan, onQuit, onHelp, onSettings, toast }: {
  world: World; crew: Crew[]; plan: Plan; loadout: Record<GadgetId, number>; cfg: SimCfg; camp: Campaign; settings: Settings; modalOpen: boolean;
  onFinish: (r: HeistResult) => void; onReplan: () => void; onQuit: () => void; onHelp: () => void; onSettings: () => void; toast: (m: string, k?: string) => void;
}) {
  const [sim] = useState(() => { const s = createSim(world, crew, plan, loadout, cfg); startRun(s); return s; });
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(settings.speedDefault || 1);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>({ k: 'order' });
  const [mode, setMode] = useState<Mode>('walk');
  const [abortConfirm, setAbortConfirm] = useState(false);
  const [, setTick] = useState(0);
  const hover = useRef<P | null>(null);
  const finished = useRef(false);
  const stateRef = useRef({ paused, speed, sel, modalOpen });
  stateRef.current = { paused, speed, sel, modalOpen };

  useEffect(() => {
    audio.setScene('run');
    const id = window.setInterval(() => setTick(t => t + 1), 140);
    const vis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', vis); audio.sirenOff(); audio.setIntensity(0); audio.resume(); };
  }, []);
  useEffect(() => { sim.cfg.detect = [0.8, 1, 1.2][camp.diff]; sim.cfg.diff = camp.diff; }, [camp.diff, sim]);
  useEffect(() => { if (paused || modalOpen) audio.suspend(); else audio.resume(); }, [paused, modalOpen]);

  const alive = sim.crew.filter(c => c.state !== 'out' && c.state !== 'down');
  const select = (id: string | null) => { setSel(id); setTool({ k: 'order' }); if (id) audio.play('ping'); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
      else if (e.key === 'Escape') { if (stateRef.current.sel || tool.k !== 'order') { select(null); } else setPaused(p => !p); }
      else if (e.key === 'f' || e.key === 'F') setSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1));
      else if (e.key >= '1' && e.key <= '5') { const c = sim.crew[parseInt(e.key) - 1]; if (c && c.state !== 'out' && c.state !== 'down') select(stateRef.current.sel === c.id ? null : c.id); }
      else if (e.key === 'q' || e.key === 'Q') setMode(m => (m === 'sneak' ? 'walk' : m === 'walk' ? 'run' : 'sneak'));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const onFrame = (dt: number, ctx: CanvasRenderingContext2D, v: View) => {
    const st = stateRef.current;
    if (sim.status === 'run' && !st.paused && !st.modalOpen) {
      const total = dt * (st.sel ? 0.2 : 1) * st.speed;
      const n = Math.max(1, Math.ceil(total / 0.033));
      for (let i = 0; i < n; i++) update(sim, total / n);
      audio.setIntensity(sim.full ? 1 : Math.min(0.85, sim.alarm / 100 * 0.8 + (sim.guards.some(g => g.state === 'alert') ? 0.2 : 0)));
    }
    while (sim.sfx.length) audio.play(sim.sfx.shift()!);
    const paths = sel ? [] : [];
    render(ctx, sim, v, { mode: 'run', recon: 2, paths, hover: hover.current, selected: st.sel, focus: !!st.sel && !st.paused, shake: settings.shake });
    if (sim.status === 'done' && sim.result && !finished.current) {
      finished.current = true;
      const r = sim.result;
      window.setTimeout(() => onFinish(r), 700);
    }
  };

  const doOrder = (id: string, step: Step, cost: number) => {
    const err = giveOrder(sim, id, step, cost);
    if (err) { toast(err, 'bad'); audio.play('error'); return false; }
    audio.play('go');
    select(null);
    return true;
  };

  const onPointer = (kind: 'move' | 'down' | 'leave', t: P) => {
    if (kind === 'leave') { hover.current = null; return; }
    hover.current = t;
    if (kind !== 'down' || sim.status !== 'run') return;
    const near = sim.crew.find(c => c.state !== 'out' && c.state !== 'down' && Math.hypot(c.x - t.x, c.y - t.y) < 0.8);
    if (near && tool.k === 'order') { select(sel === near.id ? null : near.id); return; }
    if (!sel) return;
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    const floor = tx >= 0 && ty >= 0 && tx < sim.w.w && ty < sim.w.h && sim.w.tiles[ty * sim.w.w + tx] === 1;
    if (tool.k === 'gadget') { if (sim.gadgets[tool.g!] <= 0) { toast('Out of that gadget', 'bad'); return; } doOrder(sel, { k: 'gadget', g: tool.g!, x: t.x, y: t.y }, 0); return; }
    if (tool.k === 'ambush' || tool.k === 'distract') { if (!floor) return; doOrder(sel, { k: tool.k, x: tx + 0.5, y: ty + 0.5 }, 1); return; }
    const usable = (th: Thing) => (th.kind === 'door' ? th.locked : th.kind === 'safe' ? !th.opened : !thingDone(th));
    if (tool.k === 'key') {
      const th = pickThing(sim.w, t.x, t.y, x => usable(x) && x.kind !== 'loot');
      if (!th) { toast('Click a lock, terminal, camera or safe', 'bad'); return; }
      if (sim.gadgets.key <= 0) { toast('No master key left', 'bad'); return; }
      doOrder(sel, { k: 'use', oid: th.id, key: true }, 1); return;
    }
    if (Math.hypot(t.x - sim.w.van.x, t.y - sim.w.van.y) < 1.2) { doOrder(sel, { k: 'extract' }, 1); return; }
    const th = pickThing(sim.w, t.x, t.y, usable);
    if (th) { doOrder(sel, { k: 'use', oid: th.id }, 1); return; }
    if (!floor) { toast('Walls block movement', 'bad'); return; }
    doOrder(sel, { k: 'move', x: tx + 0.5, y: ty + 0.5, mode }, 1);
  };

  const selCrew = sim.crew.find(c => c.id === sel);
  const carried = sim.crew.reduce((a, c) => a + c.carry.reduce((x, i) => x + i.value, 0), 0);
  const banked = sim.extracted.reduce((a, i) => a + i.value, 0);
  const mm = Math.floor(sim.t / 60), ss = Math.floor(sim.t % 60);
  const alarmLabel = sim.full ? 'FULL ALARM' : sim.alarm >= 66 ? 'Heightened' : sim.alarm >= 33 ? 'Suspicious' : sim.alarm > 0 ? 'Uneasy' : 'Calm';
  const vanLeft = Math.max(0, 25 + sim.cfg.garage * 5 + sim.eta);
  const alarmCol = sim.alarm >= 100 ? '#ef4444' : sim.alarm >= 66 ? '#fb923c' : sim.alarm >= 33 ? '#fbbf24' : '#22d3ee';

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100 overflow-hidden select-none">
      <div className="bg-slate-950/95 border-b border-slate-800 px-2 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="w-44 sm:w-56">
          <div className="flex justify-between text-[10px] uppercase tracking-widest" style={{ color: alarmCol }}><span>🚨 {alarmLabel}</span><span>{Math.round(sim.alarm)}%</span></div>
          <Meter value={sim.alarm} color={alarmCol} h={8} />
        </div>
        {sim.full && !sim.police && <div className="text-red-400 font-black animate-pulse text-sm">🚓 POLICE IN {Math.max(0, Math.ceil(sim.eta))}s</div>}
        {sim.police && !sim.vanGone && <div className="text-blue-300 font-black animate-pulse text-sm">🚔 VAN LEAVES IN {Math.ceil(vanLeft)}s</div>}
        {sim.jam > 0 && <div className="text-sky-300 text-sm font-bold">📡 JAMMED {Math.ceil(sim.jam)}s</div>}
        <div className="text-sm font-mono">⏱ {mm}:{String(ss).padStart(2, '0')}</div>
        <div className="text-sm">💰 <b className="text-emerald-300">{money(banked)}</b> <span className="text-slate-400 text-xs">+{money(carried)} carried</span></div>
        <div className="text-sm" title="Improvise orders">🎙 {Array.from({ length: sim.cfg.improvMax }).map((_, i) => <span key={i} className={i < sim.improv ? 'text-amber-300' : 'text-slate-700'}>●</span>)}</div>
        <div className="ml-auto flex gap-1 items-center flex-wrap">
          {[1, 2, 4].map(sp => <Btn key={sp} variant={speed === sp ? 'primary' : 'ghost'} onClick={() => setSpeed(sp)}>{sp}x</Btn>)}
          <Btn onClick={() => setPaused(true)}>⏸</Btn>
          <Btn variant={abortConfirm ? 'danger' : 'ghost'} disabled={sim.abortFlag || alive.length === 0} onClick={() => { if (abortConfirm) { abortAll(sim); setAbortConfirm(false); } else { setAbortConfirm(true); window.setTimeout(() => setAbortConfirm(false), 2500); } }}>{abortConfirm ? 'Confirm Abort?' : sim.abortFlag ? 'Aborting…' : '🏃 Abort'}</Btn>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <GameCanvas w={sim.w.w} h={sim.w.h} onFrame={onFrame} onPointer={onPointer} />
        <div className="absolute right-2 bottom-2 w-64 sm:w-80 pointer-events-none space-y-0.5 text-right">
          {sim.log.slice(-6).map((l, i, a) => <div key={l.t + l.msg + i} className="text-[11px] sm:text-xs px-2 py-0.5 rounded bg-black/55 inline-block" style={{ color: l.color, opacity: 0.45 + (i / a.length) * 0.55 }}>{l.msg}</div>)}
        </div>
        {sel && selCrew && <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-blue-950/90 border border-blue-400 text-xs sm:text-sm text-blue-100 pointer-events-none">FOCUS · {selCrew.ref.name} · time slowed · {tool.k === 'order' ? `click map to order (${sim.improv} orders left)` : tool.k === 'gadget' ? `click target for ${tool.g}` : `click target for ${tool.k}`}</div>}
        {paused && !modalOpen && (
          <Modal title="Paused">
            <div className="flex flex-col gap-2">
              <Btn variant="primary" className="py-2.5" onClick={() => setPaused(false)}>▶ Resume</Btn>
              <Btn onClick={onSettings}>⚙ Settings &amp; Difficulty</Btn>
              <Btn onClick={onHelp}>? Controls &amp; Help</Btn>
              <Btn variant="danger" onClick={onReplan}>↺ Restart Planning (heist cancelled)</Btn>
              <Btn onClick={onQuit}>⏏ Quit to Title</Btn>
            </div>
          </Modal>
        )}
      </div>

      <div className="bg-slate-950/95 border-t border-slate-800 p-1.5">
        {sel && selCrew && (
          <div className="flex flex-wrap items-center gap-1 mb-1.5 pb-1.5 border-b border-slate-800">
            {(['sneak', 'walk', 'run'] as Mode[]).map(m => <Btn key={m} variant={mode === m ? 'primary' : 'ghost'} onClick={() => setMode(m)}>{m === 'sneak' ? '🐾' : m === 'walk' ? '🚶' : '🏃'} {m}</Btn>)}
            <Btn variant="gold" disabled={sim.improv < 1 && (selCrew.ref.role === 'hacker' || selCrew.ref.role === 'cracker')} title={ROLE_INFO[selCrew.ref.role].specialDesc} onClick={() => {
              const r = selCrew.ref.role;
              if (r === 'hacker') doOrder(selCrew.id, { k: 'jam' }, 1); else if (r === 'cracker') doOrder(selCrew.id, { k: 'blast' }, 1);
              else setTool({ k: r === 'face' ? 'distract' : 'ambush' });
            }}>★ {ROLE_INFO[selCrew.ref.role].special}</Btn>
            {GADGET_IDS.filter(g => sim.gadgets[g] > 0).map(g => <Btn key={g} active={(tool.k === 'gadget' && tool.g === g) || (g === 'key' && tool.k === 'key')} title={GADGETS[g].desc} onClick={() => setTool(g === 'key' ? { k: 'key' } : { k: 'gadget', g })}>{GADGETS[g].icon} {GADGETS[g].name} ×{sim.gadgets[g]}</Btn>)}
            <Btn variant="primary" onClick={() => doOrder(selCrew.id, { k: 'extract' }, 1)}>🚐 Extract now</Btn>
            <Btn onClick={() => select(null)}>Cancel</Btn>
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto">
          {sim.crew.map((c, i) => {
            const out = c.state === 'out', down = c.state === 'down';
            const col = ROLE_INFO[c.ref.role].color;
            return (
              <button key={c.id} disabled={out || down} onClick={() => select(sel === c.id ? null : c.id)} className={`min-w-[150px] flex-1 text-left rounded-md border p-1.5 transition ${sel === c.id ? 'border-white bg-slate-800' : 'border-slate-700 bg-slate-900/70'} ${out ? 'opacity-50' : ''} ${down ? 'opacity-60 border-red-700' : ''}`}>
                <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: col + '33', border: `2px solid ${col}` }}>{c.ref.icon}</span>
                  <b className="text-sm flex-1 truncate">{c.ref.name}</b><span className="text-[10px] text-slate-500">[{i + 1}]</span></div>
                <Meter value={c.hp} max={c.maxHp} color={c.hp / c.maxHp > 0.5 ? '#4ade80' : '#ef4444'} h={4} className="mt-1" />
                <div className="text-[11px] mt-0.5 truncate" style={{ color: down ? '#f87171' : out ? '#a7f3d0' : '#cbd5e1' }}>{down ? 'ARRESTED' : out ? 'In the van' : c.label}</div>
                {c.work && <Meter value={c.work.t} max={c.work.total} color="#fde047" h={3} className="mt-0.5" />}
                <div className="text-[11px] h-4">{c.carry.map(it => it.icon).join(' ')} {c.carry.length > 0 && <span className="text-slate-500">{carryW(c)}/{c.ref.role === 'muscle' ? 4 : 2}</span>}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
