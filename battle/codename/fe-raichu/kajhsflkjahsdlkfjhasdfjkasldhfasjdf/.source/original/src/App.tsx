import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SimWorker from './sim/worker?worker&inline';
import type { FromWorker, FrameStats, LoadedInfo, ToWorker } from './sim/worker';
import { SCENES, type Quality } from './sim/scenes';
import { Renderer } from './render/renderer';

const COLOR_MODES = [
  { id: 0, label: 'Material colour' },
  { id: 1, label: 'Velocity' },
  { id: 2, label: 'CPIC side / affinity' },
  { id: 3, label: 'Constitutive model' },
  { id: 4, label: 'Plastic state (Jp, J)' },
];
const STAGES = [
  ['Sort + sparse grid', '#64748b'],
  ['Rigid collisions (MPR)', '#f472b6'],
  ['Articulations', '#c084fc'],
  ['Rasterize rigid (CPIC)', '#fb923c'],
  ['Gather CDF (CPIC)', '#facc15'],
  ['P2G (MLS-MPM)', '#38bdf8'],
  ['Grid update', '#2dd4bf'],
  ['Boundary conditions', '#a3e635'],
  ['G2P + plasticity', '#60a5fa'],
  ['Clean boundary', '#94a3b8'],
  ['Advect rigid bodies', '#f87171'],
] as const;
const PORTED = [
  ['mpm.h / mpm.cpp', 'MPM<dim> driver: substep pipeline, particle sorting, page maps, boundary conditions, particle deletion, general actions'],
  ['transfer.cpp', 'MLS-MPM P2G/G2P with APIC affine momentum, RPIC/APIC damping, optimized non-rigid block path and CPIC path'],
  ['rigid_transfer.cpp', 'CPIC: rigid boundary rasterization (distance + affinity/side bits) and colored-distance-field reconstruction'],
  ['mpm_rigid_body.cpp', 'Rigid body creation from segment/triangle meshes, boundary particle sampling, advection, level-set collision'],
  ['particles.cpp', 'Snow, jelly, sand (Drucker–Prager), water, von Mises, elastic, linear and visco models with plasticity'],
  ['articulation.cpp', 'Rotation, frozen, distance, axial rotation, motor and stepper articulations'],
  ['rigid_body_solver.h', 'Rigid–rigid contact via a C++ port of libccd’s Minkowski Portal Refinement + impulse projection'],
  ['taichi (legacy)', 'Vectors/matrices, McAdams 3×3 SVD, polar decomposition, rotations, level sets, textures, config'],
  ['SPGrid → page maps', 'Block-sparse grid (8×8 / 4×4×4 blocks) with active, fat and rigid page maps and radix-sorted particles'],
  ['poisson_disk_sampler.h', 'Periodic Poisson-disk tiles, density textures and continuous PD sources (pd_source)'],
];

interface LogLine {
  id: number;
  line: string;
  level: 'info' | 'warn' | 'error';
}

const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');

function Icon({ name }: { name: 'play' | 'pause' | 'step' | 'reset' }) {
  const paths = {
    play: <path d="M7 5v14l12-7z" fill="currentColor" />,
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />,
    step: <path d="M6 5v14l9-7zM16 5h3v14h-3z" fill="currentColor" />,
    reset: <path d="M12 5a7 7 0 1 1-6.32 4H3l3.5-4L10 9H7.86A5 5 0 1 0 12 7z" fill="currentColor" />,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4">{paths[name]}</svg>;
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const logId = useRef(0);
  const autoLoaded = useRef(false);
  const [ready, setReady] = useState(false);
  const [simd, setSimd] = useState<boolean | null>(null);
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [quality, setQuality] = useState<Quality>('medium');
  const [info, setInfo] = useState<LoadedInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [colorMode, setColorMode] = useState(0);
  const [showRigids, setShowRigids] = useState(true);
  const [showBlocks, setShowBlocks] = useState(false);
  const [pointScale, setPointScale] = useState(1);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const settings = useRef({ sceneId, quality, colorMode, showBlocks });
  settings.current = { sceneId, quality, colorMode, showBlocks };
  const scene = useMemo(() => SCENES.find((s) => s.id === sceneId)!, [sceneId]);

  const send = useCallback((msg: ToWorker) => workerRef.current?.postMessage(msg), []);
  const pushLog = useCallback((line: string, level: LogLine['level']) => {
    setLogs((l) => [...l.slice(-80), { id: logId.current++, line, level }]);
  }, []);

  const load = useCallback((id: string, q: Quality) => {
    setLoading(true);
    setError(null);
    setFinished(false);
    setStats(null);
    send({ type: 'load', sceneId: id, quality: q, colorMode: settings.current.colorMode, showBlocks: settings.current.showBlocks });
  }, [send]);

  useEffect(() => {
    try {
      rendererRef.current = new Renderer(canvasRef.current!);
    } catch (e) {
      setGlError((e as Error).message);
    }
    const worker = new SimWorker();
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const msg = ev.data;
      switch (msg.type) {
        case 'ready':
          setReady(true);
          setSimd(msg.simd);
          pushLog(`WebAssembly module ready (${msg.simd ? 'SIMD128' : 'scalar'} build)`, 'info');
          if (autoLoaded.current || !rendererRef.current) break;
          autoLoaded.current = true;
          send({ type: 'load', sceneId: settings.current.sceneId, quality: settings.current.quality, colorMode: settings.current.colorMode, showBlocks: settings.current.showBlocks });
          break;
        case 'loaded': {
          const def = SCENES.find((s) => s.id === msg.info.sceneId);
          setInfo(msg.info);
          setLoading(false);
          rendererRef.current?.setScene(msg.info, def?.camera, def?.decor);
          send({ type: 'play' });
          break;
        }
        case 'frame':
          rendererRef.current?.setFrame(msg.particles, msg.count, msg.rigids, msg.blocks, msg.stats.blockSize);
          setStats(msg.stats);
          requestAnimationFrame(() => send({ type: 'ack' }));
          break;
        case 'state':
          setRunning(msg.running);
          if (msg.finished) setFinished(true);
          break;
        case 'log':
          pushLog(msg.line, msg.level);
          break;
        case 'error':
          setError(msg.message);
          setLoading(false);
          pushLog(msg.message, 'error');
          break;
      }
    };
    return () => {
      worker.terminate();
      rendererRef.current?.dispose();
    };
  }, [pushLog, send]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.options = { showRigids, showBlocks, pointScale };
    r.requestRender();
  }, [showRigids, showBlocks, pointScale]);

  const selectScene = (id: string) => {
    setSceneId(id);
    if (ready) load(id, quality);
  };
  const selectQuality = (q: Quality) => {
    setQuality(q);
    if (ready) load(sceneId, q);
  };
  const totalProf = stats ? stats.prof.reduce((a, b) => a + b, 0) : 0;
  const progress = info && stats ? Math.min(1, stats.t / info.duration) : 0;
  const scenes2D = SCENES.filter((s) => s.dim === 2), scenes3D = SCENES.filter((s) => s.dim === 3);

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-200">
      <header className="border-b border-slate-800/80 bg-gradient-to-r from-[#0b1220] via-[#0d1426] to-[#101a2e]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              taichi_mpm <span className="text-sky-400">→</span> WebAssembly
            </h1>
            <p className="text-sm text-slate-400">
              The full MLS-MPM + CPIC solver (Hu et al., SIGGRAPH 2018) ported from C++ and running in a Web Worker
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-medium ${ready ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {ready ? '● WASM ready' : '○ loading WASM…'}
            </span>
            {simd !== null && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 font-medium text-sky-300">{simd ? 'SIMD128 build' : 'scalar build'}</span>}
            <span className="rounded-full bg-violet-500/15 px-2.5 py-1 font-medium text-violet-300">wasm32-wasi · clang 19</span>
            <a className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-slate-300 hover:bg-slate-700" href="https://github.com/yuanming-hu/taichi_mpm" target="_blank" rel="noreferrer">
              original repo ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b0f17] shadow-2xl shadow-black/40">
            <canvas ref={canvasRef} className={`block h-[min(76vh,880px)] min-h-[420px] w-full ${info?.dim === 3 ? 'cursor-grab active:cursor-grabbing' : ''}`} />
            {glError && <div className="absolute inset-0 grid place-items-center p-6 text-center text-red-300">{glError}</div>}
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg bg-black/55 px-3 py-2 font-mono text-[11px] leading-5 text-slate-300 backdrop-blur">
              <div className="text-sm font-semibold text-white">{scene.name} <span className="text-slate-400">· {scene.dim}D</span></div>
              <div>t = {fmt(stats?.t ?? 0, 3)} s · frame {stats?.frame ?? 0}</div>
              <div>{fmt(stats?.particles ?? 0)} particles · {fmt(stats?.rigidParticles ?? 0)} rigid</div>
              <div>{fmt(stats?.substepsPerSec ?? 0, 0)} substeps/s · {fmt(stats?.msPerSubstep ?? 0, 2)} ms</div>
              <div>Δt = {stats ? stats.dt.toExponential(2) : '–'} · grid {info?.res ?? '–'}{info?.dim === 3 ? '³' : '²'}</div>
              <div className="text-sky-300">{stats ? `${fmt(stats.simSpeed * 100, 1)}% of real time` : ''}</div>
            </div>
            {info?.dim === 3 && <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-400">drag to orbit · wheel to zoom · double-click to reset</div>}
            {(loading || error) && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <div className={`max-w-lg rounded-xl px-5 py-3 text-sm ${error ? 'bg-red-950/90 text-red-200' : 'bg-slate-900/90 text-slate-200'}`}>
                  {error ?? (ready ? 'Building scene (Poisson-disk sampling, rigid meshes)…' : 'Compiling WebAssembly…')}
                </div>
              </div>
            )}
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              <button onClick={() => send({ type: running ? 'pause' : 'play' })} disabled={!info} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 shadow hover:bg-sky-400 disabled:opacity-40">
                <Icon name={running ? 'pause' : 'play'} /> {running ? 'Pause' : finished ? 'Continue' : 'Play'}
              </button>
              <button title="Advance one frame" onClick={() => send({ type: 'step' })} disabled={!info || running} className="rounded-lg bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 disabled:opacity-40">
                <Icon name="step" />
              </button>
              <button title="Reset scene" onClick={() => load(sceneId, quality)} disabled={!ready} className="rounded-lg bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 disabled:opacity-40">
                <Icon name="reset" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-800/60">
              <div className="h-full bg-gradient-to-r from-sky-500 to-violet-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-white">{scene.name}</h2>
              {scene.original && <code className="text-xs text-slate-400">{scene.original}</code>}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{scene.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scene.features.map((f) => (
                <span key={f} className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{f}</span>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <Card title="Scenes">
            {[['2D', scenes2D], ['3D', scenes3D]].map(([label, list]) => (
              <div key={label as string} className="mb-2 last:mb-0">
                <div className="mb-1.5 text-[11px] font-medium text-slate-500">{label as string}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(list as typeof SCENES).map((s) => (
                    <button key={s.id} onClick={() => selectScene(s.id)} className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${s.id === sceneId ? 'border-sky-500/70 bg-sky-500/15 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-600'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-400">Quality</span>
              <div className="flex flex-1 rounded-lg bg-slate-950/60 p-0.5">
                {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                  <button key={q} onClick={() => selectQuality(q)} className={`flex-1 rounded-md py-1 text-xs capitalize ${q === quality ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{q}</button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-500">Single-threaded WebAssembly: 3D scenes advance slowly (the original targets multi-core CPUs). Use “low” for faster previews.</p>
          </Card>

          <Card title="Visualization">
            <select value={colorMode} onChange={(e) => { const m = Number(e.target.value); setColorMode(m); send({ type: 'colorMode', mode: m }); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200">
              {COLOR_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <label className="flex items-center justify-between gap-2"><span className="text-slate-300">Rigid bodies</span><input type="checkbox" checked={showRigids} onChange={(e) => setShowRigids(e.target.checked)} className="h-4 w-4 accent-sky-500" /></label>
              <label className="flex items-center justify-between gap-2"><span className="text-slate-300">Sparse grid blocks <span className="text-slate-500">(2D)</span></span><input type="checkbox" checked={showBlocks} onChange={(e) => { setShowBlocks(e.target.checked); send({ type: 'showBlocks', value: e.target.checked }); }} className="h-4 w-4 accent-sky-500" /></label>
              <label className="flex items-center justify-between gap-3"><span className="text-slate-300">Point size</span><input type="range" min={0.4} max={2.5} step={0.05} value={pointScale} onChange={(e) => setPointScale(Number(e.target.value))} className="w-36 accent-sky-500" /></label>
            </div>
            {colorMode === 2 && <p className="mt-2 text-[11px] text-slate-400"><span className="text-cyan-300">cyan</span>/<span className="text-orange-300">orange</span>: the two sides of a rigid shell for particles near it (CPIC affinity & side bits); dim: stale affinity; grey: no affinity.</p>}
            {showBlocks && <p className="mt-2 text-[11px] text-slate-400">Blue: active 8×8 blocks; orange: blocks in the rigid page map (CPIC path).</p>}
          </Card>

          <Card title="Profiler" right={<span className="font-mono text-[11px] text-slate-400">{fmt(totalProf, 2)} ms / substep</span>}>
            <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-800">
              {stats && STAGES.map(([n, c], i) => (
                <div key={n} style={{ width: `${totalProf > 0 ? (stats.prof[i] / totalProf) * 100 : 0}%`, background: c }} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-0.5 font-mono text-[11px]">
              {STAGES.map(([n, c], i) => (
                <div key={n} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{n}</span>
                  <span className="text-slate-300">{stats ? fmt(stats.prof[i], 3) : '–'}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Solver state">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
              {[
                ['Substeps', fmt(stats?.substeps ?? 0)],
                ['Rigid bodies', fmt(stats?.rigids ?? 0)],
                ['Active blocks', fmt(stats?.blocks ?? 0)],
                ['Fat blocks', fmt(stats?.fatBlocks ?? 0)],
                ['Rigid blocks', fmt(stats?.rigidBlocks ?? 0)],
                ['Total blocks', fmt(stats?.totalBlocks ?? 0)],
                ['Near boundary', fmt(stats?.nearBoundary ?? 0)],
                ['New affinities', fmt(stats?.cutting ?? 0)],
                ['WASM memory', `${fmt(stats?.memoryMB ?? 0)} MB`],
                ['Sim speed', stats ? `${fmt(stats.simSpeed, 3)} s/s` : '–'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-slate-500">{k}</span><span className="text-slate-200">{v}</span></div>
              ))}
            </div>
          </Card>

          <Card title="Solver log">
            <div className="h-36 overflow-y-auto rounded-lg bg-black/40 p-2 font-mono text-[10.5px] leading-4">
              {logs.length === 0 && <div className="text-slate-600">stderr of the WASM module appears here</div>}
              {logs.map((l) => (
                <div key={l.id} className={l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-400'}>{l.line}</div>
              ))}
            </div>
          </Card>
        </aside>
      </main>

      <section className="mx-auto max-w-[1600px] px-4 pb-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-base font-semibold text-white">What was ported</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-400">
            The high-performance solver in <code className="text-slate-300">src/</code> of taichi_mpm (not the 88-line version) was translated to self-contained C++17,
            compiled with the WASI SDK to a WebAssembly reactor module (with and without SIMD128), embedded into this page and driven through a C API that mirrors the original Python
            interface (<code className="text-slate-300">add_particles</code>, <code className="text-slate-300">add_articulation</code>, level sets, scripted motions, <code className="text-slate-300">frame_update</code> sources).
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {PORTED.map(([file, desc]) => (
              <div key={file} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="font-mono text-xs text-sky-300">{file}</div>
                <div className="mt-1 text-[12px] leading-snug text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
