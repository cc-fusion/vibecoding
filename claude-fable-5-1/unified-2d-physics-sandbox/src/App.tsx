import { useEffect, useReducer, useRef, useState } from 'react';
import { Sandbox } from './app/sandbox';
import type { Tool } from './editor/editor';
import { Inspector } from './ui/Inspector';
import { Btn } from './ui/fields';
import { cn } from './utils/cn';

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Select', icon: '⬚', hint: 'Select / move / throw (V)' },
  { id: 'fluid', label: 'Fluid', icon: '≈', hint: 'Fluid fill region or emitter (F)' },
  { id: 'soft', label: 'Soft', icon: '◉', hint: 'Soft body: blob, rectangle, star, polygon (S)' },
  { id: 'rect', label: 'Rect', icon: '▭', hint: 'Rigid rectangle (R)' },
  { id: 'circle', label: 'Circle', icon: '○', hint: 'Rigid circle (C)' },
  { id: 'polygon', label: 'Polygon', icon: '⬠', hint: 'Regular or custom rigid polygon (P)' },
  { id: 'constraint', label: 'Constraint', icon: '⟜', hint: 'Spring, link or pin (J)' },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sb, setSb] = useState<Sandbox | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [message, setMessage] = useState<{ text: string; kind: 'info' | 'error' } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selfTest, setSelfTest] = useState<string[] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const app = new Sandbox(canvas);
    app.onStateChange = bump;
    app.editor.onChange = bump;
    let msgTimer = 0;
    app.onMessage = (text, kind = 'info') => { setMessage({ text, kind }); clearTimeout(msgTimer); msgTimer = window.setTimeout(() => setMessage(null), 4000); };
    app.start();
    setSb(app);
    if (location.search.includes('selftest')) {
      import('./app/selftest').then(m => {
        const res = m.reportSelfTests();
        setSelfTest(res.map(r => `${r.pass ? '✔' : '✘'} ${r.name}${r.info ? ` — ${r.info}` : ''}`));
      });
    }
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Tool> = { v: 'select', f: 'fluid', s: 'soft', r: 'rect', c: 'circle', p: 'polygon', j: 'constraint' };
      const tool = map[e.key.toLowerCase()];
      if (tool) app.editor.setTool(tool);
      else if (e.key === ' ') { e.preventDefault(); if (app.runState === 'running') app.pause(); else app.play(); }
    };
    window.addEventListener('keydown', key);
    // live refresh of inspector values while running (throttled, outside the render loop)
    const iv = window.setInterval(() => { if (app.runState === 'running') bump(); }, 250);
    return () => { window.removeEventListener('keydown', key); clearInterval(iv); clearTimeout(msgTimer); app.dispose(); };
  }, []);

  const running = sb?.runState === 'running';
  const selection = sb ? [...sb.editor.selection] : [];
  const tool = sb?.editor.tool ?? 'select';
  const hasSel = selection.length > 0;

  const inspector = sb && <Inspector sb={sb} selection={selection} tool={tool} tick={sb.world.version} />;

  return (
    <div className="h-dvh w-full flex flex-col bg-[#0f1216] text-zinc-200 text-[12px] overflow-hidden select-none">
      {/* Toolbar */}
      <header className="flex items-stretch gap-2 px-2 py-1.5 border-b border-zinc-800 bg-[#171b21] overflow-x-auto shrink-0 no-scrollbar">
        <div className="flex items-center gap-1 pr-2 border-r border-zinc-800 shrink-0">
          <span className="font-semibold text-zinc-100 tracking-tight hidden sm:inline">Unified Physics Sandbox</span>
          <span className="font-semibold text-zinc-100 sm:hidden">UPS</span>
          <Btn small title="Toggle properties panel" active={drawer} className="lg:hidden ml-1" onClick={() => setDrawer(d => !d)}>☰ Props</Btn>
        </div>
        <div className="flex items-center gap-1 shrink-0" role="toolbar" aria-label="Creation tools">
          {TOOLS.map(t => (
            <Btn key={t.id} title={t.hint} active={tool === t.id} onClick={() => sb?.editor.setTool(t.id)}>
              <span className="text-[13px] leading-none w-4 inline-block text-center">{t.icon}</span><span className="hidden md:inline ml-1">{t.label}</span>
            </Btn>
          ))}
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-zinc-800 shrink-0">
          <Btn title="Duplicate selection (Ctrl+D)" disabled={!hasSel} onClick={() => sb?.editor.duplicateSelection()}>⧉<span className="hidden lg:inline ml-1">Duplicate</span></Btn>
          <Btn title="Delete selection (Del)" disabled={!hasSel} danger onClick={() => sb?.editor.deleteSelection()}>✕<span className="hidden lg:inline ml-1">Delete</span></Btn>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-zinc-800 shrink-0" role="group" aria-label="Simulation controls">
          <Btn title="Start / resume (Space)" active={running} className={cn(running && 'bg-emerald-700/60! border-emerald-500!')} onClick={() => sb?.play()}>▶<span className="hidden lg:inline ml-1">Play</span></Btn>
          <Btn title="Pause" active={sb?.runState === 'paused'} disabled={!running} onClick={() => sb?.pause()}>❚❚<span className="hidden lg:inline ml-1">Pause</span></Btn>
          <Btn title="Advance one fixed step (1/60 s)" onClick={() => sb?.step()}>⏭<span className="hidden lg:inline ml-1">Step</span></Btn>
          <Btn title="Stop (non-running state, scene retained)" disabled={sb?.runState === 'stopped'} onClick={() => sb?.stop()}>■<span className="hidden lg:inline ml-1">Stop</span></Btn>
          <Btn title="Reset to the authored scene" onClick={() => sb?.reset()}>↺<span className="hidden lg:inline ml-1">Reset</span></Btn>
          {confirmClear ? (
            <span className="flex items-center gap-1 px-1 rounded bg-red-950/60 border border-red-800">
              <span className="text-red-200 text-[11px]">Clear all?</span>
              <Btn small danger onClick={() => { sb?.clearScene(); setConfirmClear(false); }}>Yes</Btn>
              <Btn small onClick={() => setConfirmClear(false)}>No</Btn>
            </span>
          ) : <Btn title="Remove all scene objects" onClick={() => setConfirmClear(true)}>⌫<span className="hidden lg:inline ml-1">Clear</span></Btn>}
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-zinc-800 shrink-0">
          <Btn title="Save to browser storage" onClick={() => sb?.save()}>💾<span className="hidden lg:inline ml-1">Save</span></Btn>
          <Btn title="Load from browser storage" onClick={() => sb?.load()}>📂<span className="hidden lg:inline ml-1">Load</span></Btn>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 relative min-w-0">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: 'none' }} aria-label="Simulation workspace" />
          {sb?.editor.message && (
            <div className="absolute left-2 top-2 px-2 py-1 rounded bg-black/70 border border-amber-500/40 text-amber-200 text-[11px] pointer-events-none max-w-[80%]">{sb.editor.message}</div>
          )}
          {message && (
            <div className={cn('absolute left-1/2 -translate-x-1/2 top-2 px-3 py-1.5 rounded border text-[11.5px] pointer-events-none shadow-lg', message.kind === 'error' ? 'bg-red-950/90 border-red-700 text-red-100' : 'bg-zinc-900/90 border-zinc-600 text-zinc-100')}>{message.text}</div>
          )}
          {selfTest && (
            <div className="absolute right-2 bottom-2 max-w-[520px] max-h-[70%] overflow-auto rounded border border-zinc-600 bg-black/85 p-2 text-[10.5px] font-mono text-zinc-200 select-text">
              <div className="flex justify-between mb-1"><b>Self-test ({selfTest.filter(s => s.startsWith('✔')).length}/{selfTest.length} passed)</b><button className="text-zinc-400 hover:text-white" onClick={() => setSelfTest(null)}>close</button></div>
              {selfTest.map((s, i) => <div key={i} className={s.startsWith('✔') ? 'text-emerald-300' : 'text-red-300'}>{s}</div>)}
            </div>
          )}
        </main>

        {/* Desktop inspector */}
        <aside className="hidden lg:block w-[320px] shrink-0 border-l border-zinc-800 bg-[#14181d] overflow-y-auto p-3 select-text">{inspector}</aside>

        {/* Mobile drawer */}
        <div className={cn('lg:hidden absolute inset-x-0 bottom-0 z-20 transition-transform duration-200 bg-[#14181d] border-t border-zinc-700 rounded-t-xl shadow-2xl max-h-[60%] flex flex-col', drawer ? 'translate-y-0' : 'translate-y-full')}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
            <div className="w-10 h-1 rounded bg-zinc-600 mx-auto" onClick={() => setDrawer(false)} />
            <Btn small onClick={() => setDrawer(false)}>Close</Btn>
          </div>
          <div className="overflow-y-auto p-3 select-text">{inspector}</div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex items-center gap-3 px-2 py-1 border-t border-zinc-800 bg-[#171b21] text-[10.5px] text-zinc-400 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
        <span className={cn('font-semibold uppercase tracking-wide', running ? 'text-emerald-400' : sb?.runState === 'paused' ? 'text-amber-400' : 'text-zinc-500')}>{sb?.runState ?? '…'}</span>
        <span className="tabular-nums">t = {(sb?.world.time ?? 0).toFixed(2)} s</span>
        <span className="tabular-nums">{sb?.fps.toFixed(0) ?? 0} fps</span>
        <span className="tabular-nums">fluid {sb?.world.fluid.numParticles ?? 0} p · {sb?.world.stats.fluidMs.toFixed(1)} ms</span>
        <span className="tabular-nums">rigid {sb?.world.rigid.size ?? 0} · soft {sb?.world.soft.size ?? 0} · constraints {sb?.world.constraints.size ?? 0}</span>
        <span className="tabular-nums hidden sm:inline">grid {sb?.world.fluid.numX ?? 0}×{sb?.world.fluid.numY ?? 0} · FLIP {sb?.world.fluidSettings.flipRatio.toFixed(2)}</span>
        <span className="ml-auto hidden md:inline">{hasSel ? `${selection.length} selected` : 'Nothing selected'} · Space: play/pause · Del: delete · Esc: deselect</span>
      </footer>
    </div>
  );
}
