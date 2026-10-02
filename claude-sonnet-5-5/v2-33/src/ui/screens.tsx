import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DIFFS, MODS, META, metaCost, fmt } from '../game/data';
import type { SaveData } from '../game/save';

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const stars = Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));
    const wrecks = Array.from({ length: 7 }, () => {
      const r = 18 + Math.random() * 40;
      const pts: number[] = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; const rr = r * (0.65 + Math.random() * 0.35); pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      return { x: Math.random(), y: 0.15 + Math.random() * 0.7, r, pts, rot: Math.random() * 6, rv: (Math.random() - 0.5) * 0.4, v: 0.01 + Math.random() * 0.02, hue: Math.floor(Math.random() * 3) };
    });
    let raf = 0;
    let last = performance.now();
    const resize = () => { c.width = c.clientWidth; c.height = c.clientHeight; };
    resize();
    window.addEventListener('resize', resize);
    const cols = ['#5b6b82', '#8a6a3a', '#3a6fb0'];
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const w = c.width, h = c.height;
      ctx.fillStyle = '#03060d';
      ctx.fillRect(0, 0, w, h);
      const gr = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.7);
      gr.addColorStop(0, 'rgba(60,40,130,0.3)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.x -= dt * 0.01 * s.z;
        if (s.x < 0) s.x += 1;
        ctx.fillStyle = `rgba(200,225,255,${0.2 + s.z * 0.6})`;
        ctx.fillRect(s.x * w, s.y * h, s.z * 2, s.z * 2);
      }
      wrecks.forEach((q, i) => {
        q.x -= dt * q.v;
        if (q.x < -0.1) q.x = 1.1;
        q.rot += q.rv * dt;
        const px = q.x * w, py = q.y * h;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(q.rot);
        ctx.beginPath();
        for (let k = 0; k < q.pts.length; k += 2) (k ? ctx.lineTo(q.pts[k], q.pts[k + 1]) : ctx.moveTo(q.pts[k], q.pts[k + 1]));
        ctx.closePath();
        ctx.fillStyle = cols[q.hue];
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#9ab';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        if (i === 0) {
          const tx = px + q.r + 50, ty = py - 10 + Math.sin(t / 700) * 6;
          ctx.strokeStyle = 'rgba(77,225,255,0.7)';
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -t / 20;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#4de1ff';
          ctx.beginPath();
          ctx.moveTo(tx - 14, ty);
          ctx.lineTo(tx + 8, ty - 8);
          ctx.lineTo(tx + 8, ty + 8);
          ctx.closePath();
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function Page({ title, onBack, children, wide }: { title: string; onBack: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-3">
        <div className={`panel anim-in flex max-h-full w-full flex-col rounded-lg ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
          <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-2">
            <h2 className="font-title text-lg text-cyan-200">{title}</h2>
            <button className="btn" onClick={onBack}>← Back</button>
          </div>
          <div className="scroll min-h-0 flex-1 p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface TitleProps {
  save: SaveData;
  onCampaign: () => void;
  onTraining: () => void;
  onArchives: () => void;
  onHelp: () => void;
  onSettings: () => void;
}
export function TitleScreen(p: TitleProps) {
  const s = p.save;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-auto p-4">
        <div className="text-center">
          <div className="font-title text-xs tracking-[0.5em] text-cyan-300/80">THE WRECK FIELDS ARE OPEN</div>
          <h1 className="shimmer font-title text-4xl font-extrabold leading-tight text-cyan-100 sm:text-6xl">
            SALVAGE<br />SYNDICATE <span className="text-amber-300">WARS</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-300 sm:text-base">
            Command a scavenger fleet. Tractor-beam dead warships home, hire crews, outbid rival syndicates for salvage rights, and haul the Leviathan home.
          </p>
        </div>
        <div className="grid w-full max-w-sm gap-2">
          <button className="btn btn-big btn-gold" onClick={p.onCampaign}>▶ New campaign</button>
          <button className={`btn btn-big ${!s.tutorialDone ? 'pulse' : ''}`} onClick={p.onTraining}>🎓 Training yard {!s.tutorialDone && <span className="text-xs">(recommended)</span>}</button>
          <button className="btn btn-big" onClick={p.onArchives}>🏛 Archives · {fmt(s.renown)} renown</button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-big" onClick={p.onHelp}>❓ Help</button>
            <button className="btn btn-big" onClick={p.onSettings}>⚙ Settings</button>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>Best score <b className="text-amber-200">{fmt(s.bestScore)}</b></span>
          <span>Deepest sector <b className="text-amber-200">{s.bestSector}</b></span>
          <span>Runs <b className="text-amber-200">{s.runs}</b></span>
          <span>Victories <b className="text-amber-200">{s.wins}</b></span>
          <span>Lifetime salvage <b className="text-amber-200">{fmt(s.totalDelivered)}</b></span>
        </div>
      </div>
    </div>
  );
}

interface SetupProps {
  save: SaveData;
  onBack: () => void;
  onLaunch: (diff: string, mods: string[]) => void;
}
export function SetupScreen(p: SetupProps) {
  const [diff, setDiff] = useState(DIFFS[p.save.lastDiff] ? p.save.lastDiff : 'operator');
  const [mods, setMods] = useState<string[]>(p.save.lastMods.filter((m) => MODS.some((x) => x.id === m)));
  const mult = DIFFS[diff].renown * (1 + 0.25 * mods.length);
  return (
    <Page title="Campaign setup" onBack={p.onBack} wide>
      <div className="grid gap-4">
        <div>
          <div className="mb-1 font-title text-sm text-amber-200">Difficulty</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.values(DIFFS).map((d) => (
              <button key={d.id} onClick={() => setDiff(d.id)} className={`rounded border p-3 text-left transition hover:-translate-y-0.5 ${diff === d.id ? 'border-amber-300 bg-amber-300/10' : 'border-cyan-400/25 bg-slate-900/50'}`}>
                <div className="font-title text-cyan-100">{d.name}</div>
                <div className="text-xs text-slate-300">{d.desc}</div>
                <div className="mt-1 text-[11px] text-slate-500">Enemy HP ×{d.hp} · dmg ×{d.dmg} · quota ×{d.quota} · start cash ×{d.credits}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 font-title text-sm text-amber-200">Modifiers (optional)</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODS.map((m) => {
              const on = mods.includes(m.id);
              return (
                <button key={m.id} onClick={() => setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id])} className={`rounded border p-3 text-left transition hover:-translate-y-0.5 ${on ? 'border-red-300 bg-red-400/10' : 'border-cyan-400/25 bg-slate-900/50'}`}>
                  <div className="font-semibold">{m.icon} {m.name} {on && '✔'}</div>
                  <div className="text-xs text-slate-300">{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-300">Renown multiplier: <b className="text-amber-200">×{mult.toFixed(2)}</b> · Five sectors, then endless.</div>
          <button className="btn btn-big btn-gold" onClick={() => p.onLaunch(diff, mods)}>Launch ▶</button>
        </div>
      </div>
    </Page>
  );
}

interface ArchivesProps {
  save: SaveData;
  onBack: () => void;
  onBuy: (id: string) => void;
}
export function ArchivesScreen(p: ArchivesProps) {
  return (
    <Page title="Syndicate archives" onBack={p.onBack} wide>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-300">Renown is earned by clearing sectors and delivering salvage. Upgrades are permanent and apply to every future run.</div>
        <div className="rounded border border-amber-300/50 bg-amber-300/10 px-3 py-1 font-title text-amber-200">🏅 {fmt(p.save.renown)}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {META.map((m) => {
          const lvl = p.save.meta[m.id] || 0;
          const maxed = lvl >= m.max;
          const cost = metaCost(m, lvl);
          return (
            <div key={m.id} className="flex items-center gap-3 rounded border border-cyan-400/25 bg-slate-900/50 p-3">
              <div className="text-2xl">{m.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <b className="text-cyan-100">{m.name}</b>
                  <span className="text-xs text-amber-300">{m.max > 1 ? `${lvl}/${m.max}` : lvl ? 'Unlocked' : 'Locked'}</span>
                </div>
                <div className="text-xs text-slate-400">{m.desc}</div>
              </div>
              <button className="btn btn-gold" disabled={maxed || p.save.renown < cost} onClick={() => p.onBuy(m.id)}>{maxed ? 'MAX' : `🏅 ${cost}`}</button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
