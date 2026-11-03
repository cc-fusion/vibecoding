import { useEffect, useRef, type ReactNode } from "react";
import {
  Download,
  BookOpen,
  ArrowUpRight,
  Fan,
  Hand,
  Waves,
  FileCode2,
  Cpu,
  Layers,
  Zap,
  PackageOpen,
  GitBranch,
  Terminal,
} from "lucide-react";
import Playground, { type PlaygroundHandle } from "./Playground";
import CodeBlock from "./CodeBlock";
import { downloadLibrary } from "../mpm";

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(22px)";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.style.transition = `opacity 0.7s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms, transform 0.7s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms`;
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref}>{children}</div>;
}

const MATERIALS = [
  { name: "Water", color: "#4da3ff", model: "Weakly-compressible EOS fluid", params: "density: 1000" },
  { name: "Sand", color: "#edb85c", model: "Drucker–Prager granular (Klár 2016)", params: "friction_angle: 35" },
  { name: "Snow", color: "#e8f2ff", model: "Hardening snow (Stomakhin 2013)", params: "hardening: 10" },
  { name: "Jelly", color: "#f56b8e", model: "Fixed corotated elasticity", params: "E: 2e4, nu: 0.3" },
  { name: "Plastic", color: "#8cd966", model: "Von Mises yield plasticity", params: "yield_stress: 150" },
  { name: "Elastic", color: "#fa9e40", model: "Hencky elasticity", params: "E: 3e4, nu: 0.3" },
  { name: "Rigid", color: "#b9c2d6", model: "Solid / thin-shell CPIC + MPR contacts", params: "codimensional: true|false" },
];

const RECIPES: { icon: typeof Fan; title: string; desc: string; code: string; accent: string }[] = [
  {
    icon: Fan,
    title: "Automatic wheel",
    desc: "A motor wheel spins up inside whatever is already running — added live, no reload.",
    accent: "text-amber",
    code: `sim.addWheel({
  center: [0.5, 0.55], radius: 0.15, blades: 8,
  mode: 'motor', speed: 180,   // deg per second
});`,
  },
  {
    icon: Waves,
    title: "Sand mill (declarative)",
    desc: "A whole scene as plain data: free wheel + sand faucet. The stream drives the wheel.",
    accent: "text-aqua",
    code: `sim.loadScene({
  name: 'Sand mill', dim: 2, duration: 0,
  wheels: [{ center: [0.5, 0.38], radius: 0.2,
    blades: 10, mode: 'free', friction: -2, damping: 1.6 }],
  sources: [{ type: 'sand', position: [0.34, 0.92],
    size: [0.05, 0.03], velocity: [0.2, -1], ppc: 3,
    density: 1200, color: [0.93, 0.76, 0.45] }],
});`,
  },
  {
    icon: Hand,
    title: "Touch interactions",
    desc: "Push & cut with a kinematic paddle, paint material, or tilt gravity with a finger.",
    accent: "text-coral",
    code: `sim.setPointer({ mode: 'push' });   // shove & slice
sim.setPointer({ mode: 'spawn',    // paint jelly
  material: { type: 'jelly', E: 2e4, nu: 0.3,
    density: 400, color: [0.96, 0.42, 0.56], ppc: 3 } });
sim.setPointer({ mode: 'tilt', strength: 12 });`,
  },
  {
    icon: Zap,
    title: "Per-frame scripting",
    desc: "onUpdate runs inside the sim loop — drive gravity, spawn bodies, build machines.",
    accent: "text-sky",
    code: `sim.onUpdate(function (t, dt, api) {
  api.setConfig({ gravity: [7 * Math.sin(t * 1.6), -10] });
});`,
  },
];

const API_GROUPS: { title: string; icon: typeof Cpu; items: [string, string][] }[] = [
  {
    title: "Lifecycle",
    icon: Cpu,
    items: [
      ["MPM.create(el, opts)", "mount a simulation"],
      ["sim.loadScene(scene)", "id · data · setup fn"],
      ["sim.play() / pause() / step()", "transport"],
      ["sim.reset() · setQuality(q)", "rebuild"],
      ["sim.destroy()", "tear down"],
    ],
  },
  {
    title: "Live authoring",
    icon: Layers,
    items: [
      ["sim.addParticles(cfg)", "inject any material"],
      ["sim.addRigid(cfg)", "bodies & blades"],
      ["sim.addWheel(opts)", "motor or free wheel"],
      ["sim.addSource(opts)", "continuous emitters"],
      ["sim.addArticulation(cfg)", "rotation · motor · distance"],
    ],
  },
  {
    title: "Interaction",
    icon: Hand,
    items: [
      ["sim.setPointer(opts)", "push · spawn · tilt"],
      ["sim.setGravity([x, y])", "live gravity"],
      ["sim.setConfig(cfg)", "penalty, pushing force"],
      ["sim.onUpdate(fn)", "per-frame hook"],
      ["MPM.registerScene(id, def)", "reusable scenes"],
    ],
  },
  {
    title: "Telemetry & render",
    icon: Terminal,
    items: [
      ["sim.on('frame', fn)", "stats every frame"],
      ["sim.stats / time / state", "live readings"],
      ["sim.setColorMode(mode)", "velocity · CPIC · plastic"],
      ["sim.setShowBlocks(v)", "sparse-block debug"],
      ["sim.energy()", "mechanical energy"],
    ],
  },
];

export default function Home({ onDocs }: { onDocs: () => void }) {
  const pgRef = useRef<PlaygroundHandle>(null);

  const runRecipe = (code: string) => {
    pgRef.current?.focus();
    setTimeout(() => pgRef.current?.runCode(code), 350);
  };

  return (
    <div>
      {/* ============================== HERO ============================== */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-aqua">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-aqua" />
              MLS-MPM · CPIC · WebAssembly · zero dependencies
            </p>
            <h1 className="mt-4 font-display text-[clamp(1.9rem,5vw,3.4rem)] font-bold leading-[1.06] tracking-tight">
              One script tag.
              <br />
              <span className="text-amber">Every material.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mut">
              MPM.js is the full <span className="text-fg">taichi_mpm</span> physics
              solver — water, sand, snow, jelly, plastic and rigid bodies, in 2D and
              3D — packed into a single JavaScript file. Author scenes as{" "}
              <span className="text-fg">plain data or scripts</span>, and reshape the
              simulation <span className="text-fg">while it runs</span>. No frameworks.
              No build step. No source edits.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={downloadLibrary}
                className="flex items-center gap-2 rounded-lg bg-amber px-5 py-3 text-[13px] font-bold text-ink-950 shadow-[0_6px_24px_rgba(255,178,36,0.35)] transition-transform hover:scale-[1.04] active:scale-95"
              >
                <Download size={15} /> Download mpm.js
              </button>
              <button
                onClick={onDocs}
                className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-5 py-3 text-[13px] font-semibold text-fg transition-colors hover:border-aqua/50 hover:text-aqua"
              >
                <BookOpen size={15} /> Read the docs
              </button>
              <span className="font-mono text-[11px] text-mut">v1.0.0 · MIT · ~1.1 MB</span>
            </div>
          </div>
          <div className="panel hidden rounded-xl p-4 lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mut">Spec sheet</p>
            <dl className="mt-3 space-y-2.5 font-mono text-[12px]">
              {[
                ["file", "mpm.js (self-contained)"],
                ["deps", "none"],
                ["solver", "taichi_mpm → WASM"],
                ["thread", "auto worker + fallback"],
                ["render", "WebGL2, 2D + 3D"],
                ["scenes", "10 built-in + yours"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-2 last:border-0 last:pb-0">
                  <dt className="text-mut">{k}</dt>
                  <dd className="text-right text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* material ticker */}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3">
          {MATERIALS.map((m) => (
            <span key={m.name} className="flex items-center gap-2 font-display text-[11px] font-semibold tracking-[0.14em] text-mut">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}66` }} />
              {m.name.toUpperCase()}
            </span>
          ))}
          <span className="ml-auto hidden font-mono text-[10px] text-mut/70 sm:block">
            ↓ everything below is running live
          </span>
        </div>
      </section>

      {/* =========================== PLAYGROUND =========================== */}
      <section id="playground" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <Playground ref={pgRef} />
      </section>

      {/* =========================== QUICK START ========================== */}
      <section id="quickstart" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aqua">Quick start</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight">
                Three steps.
                <br />
                No build.
              </h2>
              <p className="mt-4 text-[13.5px] leading-relaxed text-mut">
                The WASM engine is embedded in the file, so there is exactly one
                asset to serve. The library spawns its own worker from its own
                source — you never wire anything up.
              </p>
              <button onClick={downloadLibrary}
                className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-amber transition-colors hover:text-fg">
                <Download size={14} /> Get mpm.js <ArrowUpRight size={13} />
              </button>
            </div>
          </Reveal>
          <div className="space-y-6">
            {[
              {
                n: "01",
                t: "Drop in the script",
                d: "One tag exposes window.MPM. That's the whole install.",
                code: `<script src="mpm.js"></script>`,
              },
              {
                n: "02",
                t: "Give it a container",
                d: "Any element with a size — a canvas is created inside it.",
                code: `<div id="sim" style="width: 100%; height: 70vh"></div>`,
              },
              {
                n: "03",
                t: "Create, then keep creating",
                d: "Start from a built-in scene, then modify everything at runtime.",
                code: `const sim = MPM.create('#sim', {
  scene: 'sand-wheel',
  loop: true,
  pointer: { mode: 'push' },   // touch interaction on
});

// later — while it's running:
sim.addWheel({ center: [0.3, 0.6], mode: 'motor', speed: 160 });
sim.setGravity([0, -3]);`,
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="font-display text-[13px] font-bold text-amber">{s.n}</span>
                    {i < 2 && <span className="mt-2 w-px flex-1 bg-line" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-2">
                    <h3 className="text-[15px] font-semibold text-fg">{s.t}</h3>
                    <p className="mt-1 text-[13px] text-mut">{s.d}</p>
                    <CodeBlock code={s.code} className="mt-3" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= LIVE MODIFICATION ====================== */}
      <section id="live" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-coral">Runtime API</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
                Built to be modified <span className="text-coral">while it runs</span>
              </h2>
            </div>
            <p className="max-w-md text-[13px] leading-relaxed text-mut">
              Every recipe below runs against the playground above — press{" "}
              <span className="font-semibold text-fg">Run in playground</span> and watch
              the change land in the live simulation.
            </p>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {RECIPES.map((r, i) => (
            <Reveal key={r.title} delay={i * 60}>
              <div className="panel group flex h-full flex-col rounded-xl p-5 transition-colors hover:border-ink-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <r.icon size={18} className={r.accent} />
                    <h3 className="text-[15px] font-semibold">{r.title}</h3>
                  </div>
                  <button
                    onClick={() => runRecipe(r.code)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-ink-800/70 px-3 py-1.5 text-[11px] font-semibold text-mut transition-all hover:border-aqua/60 hover:text-aqua"
                  >
                    <ArrowUpRight size={12} /> Run in playground
                  </button>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-mut">{r.desc}</p>
                <CodeBlock code={r.code} className="mt-3 flex-1" maxHeight={190} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================ MATERIALS =========================== */}
      <section id="materials" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber">Constitutive models</p>
          <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Seven materials, one solver</h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-mut">
            Real constitutive models from the graphics literature — not sprites.
            Codimensional rigid shells cut soft bodies cleanly thanks to CPIC
            affinity tracking, and everything couples two-way through the grid.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="panel mt-6 overflow-x-auto rounded-xl">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.16em] text-mut">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">type</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Key params</th>
                </tr>
              </thead>
              <tbody>
                {MATERIALS.map((m) => (
                  <tr key={m.name} className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink-700/20">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5 font-semibold text-fg">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}88` }} />
                        {m.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-sky">{m.name.toLowerCase() === "plastic" ? "von_mises" : m.name.toLowerCase()}</td>
                    <td className="px-4 py-3 text-mut">{m.model}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-amber/90">{m.params}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* ============================== API =============================== */}
      <section id="api" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sky">API surface</p>
              <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Small API, deep engine</h2>
            </div>
            <button onClick={onDocs}
              className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-4 py-2.5 text-[12.5px] font-semibold text-fg transition-colors hover:border-sky/60 hover:text-sky">
              <BookOpen size={14} /> Full reference <ArrowUpRight size={13} />
            </button>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {API_GROUPS.map((g, i) => (
            <Reveal key={g.title} delay={i * 60}>
              <div className="panel h-full rounded-xl p-5">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-mut">
                  <g.icon size={14} className="text-amber" /> {g.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {g.items.map(([sig, desc]) => (
                    <li key={sig} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line/50 pb-2.5 last:border-0 last:pb-0">
                      <code className="font-mono text-[12px] text-aqua">{sig}</code>
                      <span className="text-[12px] text-mut">{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================== CTA =============================== */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="panel relative overflow-hidden rounded-2xl p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 animate-drift rounded-full bg-amber/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 animate-drift rounded-full bg-aqua/10 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl">
                  Ship physics on your page today.
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-mut">
                  <span className="flex items-center gap-1.5"><PackageOpen size={13} className="text-amber" /> single file</span>
                  <span className="flex items-center gap-1.5"><GitBranch size={13} className="text-aqua" /> MIT licensed</span>
                  <span className="flex items-center gap-1.5"><FileCode2 size={13} className="text-coral" /> docs.md included</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={downloadLibrary}
                  className="flex items-center gap-2 rounded-lg bg-amber px-5 py-3 text-[13px] font-bold text-ink-950 shadow-[0_6px_24px_rgba(255,178,36,0.35)] transition-transform hover:scale-[1.04] active:scale-95">
                  <Download size={15} /> mpm.js
                </button>
                <button onClick={onDocs}
                  className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/70 px-5 py-3 text-[13px] font-semibold transition-colors hover:border-aqua/50 hover:text-aqua">
                  <BookOpen size={15} /> Documentation
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
