import { useState, type ReactNode } from 'react';
import { BUILDINGS, CATS, DIFFS, ENEMIES, ITEMS, MODS, TECHS, WIN_WAVE, type BKind, type EnemyType } from '../game/defs';
import type { Game, HudState } from '../game/engine';
import { Btn, Modal } from './ui';

const EDGE = ['North', 'East', 'South', 'West'];

function Chip({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <div title={title} className={`pointer-events-auto rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-100 shadow backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function MiniBar({ f, color, className = '' }: { f: number; color: string; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded bg-slate-700 ${className}`}>
      <div className="h-full rounded transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, background: color }} />
    </div>
  );
}

export function TopBar({ h, g, onMenu }: { h: HudState; g: Game; onMenu: (m: 'pause' | 'tech') => void }) {
  const powerOk = h.sat >= 0.99;
  const hubF = h.hubHp / h.hubMax;
  const timer = h.waveTimer > 5000 ? '—' : `${Math.ceil(h.waveTimer)}s`;
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-wrap items-start gap-1.5 p-2">
      <Chip title="Credits">
        <span className="text-sm font-bold text-amber-300 tabular-nums">💰 {Math.floor(h.credits)}</span>
      </Chip>
      <Chip title="Research points (T to open the tech tree)">
        <span className="text-sm font-bold text-violet-300 tabular-nums">🔬 {Math.floor(h.rp)}</span>
      </Chip>
      <Chip className="min-w-[8.5rem]" title="Power: generation / demand. Machines slow down in a brownout.">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-bold tabular-nums ${h.emp ? 'text-cyan-300' : powerOk ? 'text-emerald-300' : 'text-rose-400'}`}>⚡ {h.emp ? 'EMP!' : `${h.gen.toFixed(0)}/${h.dem.toFixed(0)} kW`}</span>
          <span className="text-slate-400">{Math.round(h.sat * 100)}%</span>
        </div>
        <MiniBar f={h.cap > 0 ? h.batt / h.cap : 0} color="#4ade80" className="mt-1" />
        <div className="mt-0.5 text-[10px] text-slate-400">🔋 {Math.round(h.batt)}/{h.cap}</div>
      </Chip>
      <Chip className="min-w-[7.5rem]" title="Ring Core hull">
        <div className="flex justify-between">
          <span className="font-bold">🛰️ Core</span>
          <span className="tabular-nums">{Math.max(0, Math.ceil(h.hubHp))}</span>
        </div>
        <MiniBar f={hubF} color={hubF > 0.5 ? '#22d3ee' : hubF > 0.25 ? '#fbbf24' : '#f87171'} className="mt-1" />
      </Chip>
      <Chip className="min-w-[9rem]">
        {h.tut ? (
          <span className="font-bold text-emerald-300">🎓 Training</span>
        ) : h.bossWave ? (
          <span className="animate-pulse font-bold text-rose-400">☠ BOSS FIGHT</span>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-rose-300">
              ☠ Raid {h.plan.n}
              {h.endless ? '' : `/${WIN_WAVE}`} {h.plan.boss ? '(BOSS)' : ''}
            </span>
            <span className={`tabular-nums ${h.waveTimer < 12 ? 'animate-pulse text-rose-300' : ''}`}>{timer}</span>
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
          <span>👾 {h.enemies} hostile</span>
          <span>Score {h.score}</span>
        </div>
      </Chip>
      {!h.tut && !h.bossWave && h.waveTimer > 6 && h.waveTimer < 5000 && (
        <button
          className="pointer-events-auto rounded-lg border border-rose-400/40 bg-rose-900/60 px-2 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-800/70"
          onClick={() => g.callRaid()}
          title="Call the next raid now for a credit bonus (N)"
        >
          Call early +{Math.floor(h.waveTimer * 1.5)}c
        </button>
      )}
      {h.repairCost > 0 && (
        <button
          className="pointer-events-auto rounded-lg border border-emerald-400/40 bg-emerald-900/50 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-800/60"
          onClick={() => g.repairAll()}
          title="Repair every damaged structure"
        >
          🔧 Repair all {h.repairCost}c
        </button>
      )}
      <div className="ml-auto flex gap-1.5">
        <button className="pointer-events-auto rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1 text-xs font-bold hover:bg-slate-700" onClick={() => g.cycleSpeed()} title="Game speed (E)">
          {h.speed}×
        </button>
        <button className="pointer-events-auto rounded-lg border border-violet-400/30 bg-violet-900/50 px-2.5 py-1 text-xs font-bold hover:bg-violet-800/70" onClick={() => onMenu('tech')} title="Tech tree (T)">
          🧬 Tech
        </button>
        <button className="pointer-events-auto rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1 text-xs font-bold hover:bg-slate-700" onClick={() => onMenu('pause')} title="Pause (Esc)">
          ⏸
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-2 shadow backdrop-blur">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300/90">{title}</div>
      {children}
    </div>
  );
}

export function SidePanel({ h, g }: { h: HudState; g: Game }) {
  const safe = h.safeRun >= 99 ? '∞' : h.safeRun.toFixed(1);
  const danger = h.safeRun < 4;
  return (
    <div className="pointer-events-auto absolute right-2 top-[4.6rem] z-20 flex max-h-[calc(100%-10.5rem)] w-60 flex-col gap-2 overflow-y-auto pr-0.5 text-xs text-slate-200">
      <Section title="Ring Control">
        <div className="mb-1 flex justify-between">
          <span>Spin ω</span>
          <span className="tabular-nums text-cyan-200">{h.spin.toFixed(2)}</span>
        </div>
        <input type="range" min={0.4} max={3} step={0.1} value={h.spinSet} onChange={(e) => g.setSpin(parseFloat(e.target.value))} className="w-full accent-cyan-400" />
        <div className="mt-1 flex items-center justify-between">
          <span>{h.dirV >= 0 ? '⟳ Clockwise' : '⟲ Counter-CW'}</span>
          <button
            className="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-semibold hover:bg-slate-600 disabled:opacity-50"
            onClick={() => g.flipSpin()}
            title="Reverse the spin direction (F)"
          >
            Reverse{h.flipCd > 0 ? ` (${Math.ceil(h.flipCd)}s)` : ' (F)'}
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
          <div className="rounded bg-slate-800 px-1.5 py-1">
            <div className="text-slate-400">Drift / tile</div>
            <div className="font-bold tabular-nums text-sky-300">{(Math.abs(h.drift) * 100).toFixed(1)}%</div>
          </div>
          <div className={`rounded px-1.5 py-1 ${danger ? 'bg-rose-900/60' : 'bg-slate-800'}`}>
            <div className="text-slate-400">Safe belt run</div>
            <div className={`font-bold tabular-nums ${danger ? 'text-rose-300' : 'text-emerald-300'}`}>{safe} tiles</div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span>{h.sun > 0.5 ? '☀️' : h.sun > 0.05 ? '🌅' : '🌙'}</span>
          <MiniBar f={h.sun} color="#facc15" className="flex-1" />
          <span className="tabular-nums">{Math.round(h.sun * 100)}%</span>
        </div>
        <button className="mt-1.5 w-full rounded bg-slate-800 py-0.5 text-[11px] hover:bg-slate-700" onClick={() => (g.overlay = !g.overlay)}>
          Leak overlay (V): {h.overlay ? 'ON' : 'OFF'}
        </button>
        {h.evt && <div className="mt-1.5 animate-pulse rounded bg-amber-500/20 px-2 py-1 text-amber-200">⚠ {h.evt.name} · {Math.ceil(h.evt.t)}s</div>}
      </Section>
      <Section title={`Raid Intel · Wave ${h.plan.n}${h.plan.boss ? ' ☠' : ''}`}>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(h.plan.comp) as EnemyType[]).map((k) => (
            <span key={k} title={ENEMIES[k].desc} className="rounded bg-slate-800 px-1.5 py-0.5" style={{ color: ENEMIES[k].color }}>
              {ENEMIES[k].emoji} {h.plan.comp[k]}× {ENEMIES[k].name}
            </span>
          ))}
        </div>
        <div className="mt-1 text-slate-400">From: {h.plan.edges.map((e) => EDGE[e]).join(' & ')}</div>
      </Section>
      <Section title={`Contracts · Rep ${h.rep}`}>
        {h.contracts.length === 0 && <div className="text-slate-400">No open contracts. New offers arrive periodically.</div>}
        {h.contracts.map((c) => (
          <div key={c.id} className="mb-1.5 rounded bg-slate-800 p-1.5">
            <div className="flex justify-between">
              <span style={{ color: ITEMS[c.item].color }}>
                {c.have}/{c.qty} {ITEMS[c.item].name}
              </span>
              <span className="tabular-nums text-slate-400">{Math.ceil(c.t)}s</span>
            </div>
            <MiniBar f={c.have / c.qty} color={ITEMS[c.item].color} className="my-1" />
            <div className="text-amber-300">
              +{c.reward}c +{c.rp}RP
            </div>
          </div>
        ))}
      </Section>
      <Section title="Market">
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {h.market.map((m) => {
            const price = ITEMS[m.item].value * m.m;
            const up = m.target > 1.05;
            const down = m.target < 0.95;
            return (
              <div key={m.item} className="flex justify-between">
                <span className="truncate" style={{ color: ITEMS[m.item].color }}>
                  {ITEMS[m.item].name.replace('Hull ', '').replace('Iron ', '').replace('Copper ', '')}
                </span>
                <span className={`tabular-nums ${up ? 'text-emerald-300' : down ? 'text-rose-300' : m.m < 0.85 ? 'text-amber-200' : 'text-slate-300'}`}>
                  {price.toFixed(1)}
                  {up ? '▲' : down ? '▼' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

export function Hotbar({ h, g }: { h: HudState; g: Game }) {
  const [hov, setHov] = useState<BKind | null>(null);
  const list = g.catList(h.cat);
  const show: BKind | null = hov || (h.tool !== 'select' && h.tool !== 'erase' ? (h.tool as BKind) : null);
  const def = show ? BUILDINGS[show] : null;
  const arrows = ['→', '↓', '←', '↑'];
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-1 p-2">
      {def && (
        <div className="pointer-events-none max-w-xl rounded-lg border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 shadow">
          <b style={{ color: def.color }}>
            {def.emoji} {def.name}
          </b>{' '}
          · {def.cost}c{def.power > 0 ? ` · ${def.power} kW` : ''} · HP {def.hp} — {def.desc}
        </div>
      )}
      <div className="pointer-events-auto flex max-w-full flex-wrap items-end justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 p-1.5 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-1">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => g.setCat(c.id)}
              className={`rounded px-1.5 py-0.5 text-left text-[10px] font-semibold ${h.cat === c.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        <div className="flex max-w-[calc(100vw-9rem)] gap-1 overflow-x-auto pb-0.5">
          {list.map((k, i) => {
            const d = BUILDINGS[k];
            const locked = !g.unlocked(k);
            const sel = h.tool === k;
            const poor = h.credits < d.cost;
            return (
              <button
                key={k}
                onMouseEnter={() => setHov(k)}
                onMouseLeave={() => setHov(null)}
                onClick={() => g.setTool(k)}
                className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border text-center transition ${
                  sel ? 'border-cyan-300 bg-cyan-500/25 shadow-[0_0_12px_rgba(34,211,238,0.5)]' : 'border-white/10 bg-slate-800 hover:bg-slate-700'
                } ${locked ? 'opacity-45' : ''}`}
              >
                <span className="absolute left-0.5 top-0 text-[9px] text-slate-400">{i + 1}</span>
                <span className="text-xl leading-none">{locked ? '🔒' : d.emoji}</span>
                <span className="mt-0.5 line-clamp-1 w-full px-0.5 text-[9px] leading-tight text-slate-300">{d.name.split(' ')[0]}</span>
                <span className={`text-[9px] font-bold ${poor && !locked ? 'text-rose-400' : 'text-amber-300'}`}>{d.cost}c</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => g.setTool('select')} className={`rounded px-2 py-1 text-[11px] font-semibold ${h.tool === 'select' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`} title="Select / pan (Q)">
            🖱 Select
          </button>
          <button onClick={() => g.setTool('erase')} className={`rounded px-2 py-1 text-[11px] font-semibold ${h.tool === 'erase' ? 'bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700'}`} title="Erase (X or right-click)">
            🗑 Erase
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => (g.rot = (g.rot + 1) & 3)} className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold hover:bg-slate-700" title="Rotate (R)">
            ⟳ {arrows[h.rot]}
          </button>
          <div className="flex gap-1">
            <button onClick={() => g.zoomBy(1 / 1.2)} className="flex-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-bold hover:bg-slate-700">
              −
            </button>
            <button onClick={() => g.zoomBy(1.2)} className="flex-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-bold hover:bg-slate-700">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Inspector({ h, g }: { h: HudState; g: Game }) {
  const s = h.sel;
  if (!s) return null;
  const hf = s.hp / s.maxHp;
  const b = g.selectedBuilding();
  return (
    <div className="pointer-events-auto absolute bottom-[6.2rem] left-2 z-20 w-72 rounded-xl border border-cyan-400/30 bg-slate-900/90 p-3 text-xs text-slate-200 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-cyan-200">
          {BUILDINGS[s.kind].emoji} {s.name}
        </div>
        <button className="text-slate-400 hover:text-white" onClick={() => (g.selected = null)}>
          ✕
        </button>
      </div>
      <div className="mt-1 text-slate-300">{s.status}</div>
      <MiniBar f={hf} color={hf > 0.5 ? '#4ade80' : '#f87171'} className="my-1.5" />
      <div className="text-[10px] text-slate-400">
        Hull {Math.ceil(s.hp)}/{s.maxHp}
      </div>
      {s.lines.map((l, i) => (
        <div key={i} className="mt-0.5 text-slate-300">
          {l}
        </div>
      ))}
      {s.recipes.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="font-semibold text-slate-200">Recipe</div>
          {s.recipes.map((r, i) => (
            <button
              key={r.id}
              onClick={() => b && g.setRecipe(b, i)}
              className={`w-full rounded border px-2 py-1 text-left ${r.active ? 'border-cyan-400 bg-cyan-500/20' : 'border-white/10 bg-slate-800 hover:bg-slate-700'}`}
            >
              <div className="font-semibold">{r.name}</div>
              <div className="text-[10px] text-slate-400">{r.text}</div>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        {s.repairCost > 0 && (
          <button className="flex-1 rounded bg-emerald-700 py-1 font-semibold hover:bg-emerald-600" onClick={() => b && g.repair(b)}>
            🔧 Repair {s.repairCost}c
          </button>
        )}
        {s.canDemolish && (
          <button className="flex-1 rounded bg-rose-700 py-1 font-semibold hover:bg-rose-600" onClick={() => b && g.demolish(b)}>
            🗑 Demolish
          </button>
        )}
      </div>
    </div>
  );
}

export function Overlays({ h, onSkipTutorial }: { h: HudState; onSkipTutorial: () => void }) {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-[4.6rem] z-30 flex -translate-x-1/2 flex-col items-center gap-1">
        {h.toasts.map((t) => (
          <div key={t.id} className="rounded-lg border border-white/10 bg-slate-900/90 px-3 py-1 text-xs font-semibold shadow-lg" style={{ color: t.color, animation: 'toastIn .25s ease-out' }}>
            {t.text}
          </div>
        ))}
      </div>
      {h.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 z-30 flex flex-col items-center" style={{ animation: 'bannerIn .5s cubic-bezier(.2,1.4,.4,1)' }}>
          <div className="text-4xl font-black uppercase tracking-[0.3em] drop-shadow-[0_0_18px_currentColor] sm:text-6xl" style={{ color: h.banner.color }}>
            {h.banner.text}
          </div>
          <div className="mt-1 rounded bg-slate-950/70 px-3 py-1 text-sm text-slate-200">{h.banner.sub}</div>
        </div>
      )}
      {h.tut && (
        <div className="pointer-events-auto absolute left-2 top-[4.6rem] z-20 w-72 rounded-xl border border-emerald-400/40 bg-slate-900/92 p-3 text-xs text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="font-bold text-emerald-300">
              🎓 Training {h.tut.step + 1}/{h.tut.total}
            </div>
            <button className="text-slate-400 underline hover:text-white" onClick={onSkipTutorial}>
              skip
            </button>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">{h.tut.title}</div>
          <div className="mt-1 leading-relaxed text-slate-300">{h.tut.text}</div>
          <MiniBar f={(h.tut.step + 1) / h.tut.total} color="#34d399" className="mt-2" />
          <div className="mt-1.5 text-[10px] text-slate-500">Press H for the full field manual.</div>
        </div>
      )}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}} @keyframes bannerIn{from{opacity:0;transform:scale(1.6)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}

export function TechModal({ h, g, onClose }: { h: HudState; g: Game; onClose: () => void }) {
  const tiers = [0, 1, 2];
  const name = (id: string) => TECHS.find((t) => t.id === id)?.name || id;
  return (
    <Modal title={`🧬 Technology · ${Math.floor(h.rp)} RP`} onClose={onClose} wide>
      <p className="mb-3 text-xs text-slate-400">Feed goods to a Research Lab to earn research points. Higher-tier goods yield far more. Contracts also pay RP.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t} className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tier {t + 1}</div>
            {TECHS.filter((x) => x.tier === t).map((x) => {
              const owned = h.techs.includes(x.id);
              const reqOk = x.req.every((r) => h.techs.includes(r));
              const can = !owned && reqOk && h.rp >= x.cost;
              return (
                <div key={x.id} className={`rounded-xl border p-2.5 ${owned ? 'border-emerald-400/40 bg-emerald-900/20' : reqOk ? 'border-violet-400/30 bg-slate-800/70' : 'border-white/5 bg-slate-800/30 opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{x.icon}</span>
                    <div className="flex-1 text-sm font-semibold text-slate-100">{x.name}</div>
                    <span className="text-xs font-bold text-violet-300">{x.cost} RP</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{x.desc}</div>
                  {x.req.length > 0 && <div className="mt-1 text-[10px] text-slate-400">Requires: {x.req.map(name).join(', ')}</div>}
                  <div className="mt-2">
                    {owned ? (
                      <span className="text-xs font-semibold text-emerald-300">✔ Researched</span>
                    ) : (
                      <Btn variant="primary" disabled={!can} onClick={() => g.buyTech(x.id)}>
                        {reqOk ? 'Research' : 'Locked'}
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Btn variant="ghost" onClick={onClose}>
          Close (T)
        </Btn>
      </div>
    </Modal>
  );
}

export function PauseMenu({
  h,
  g,
  onResume,
  onHelp,
  onSettings,
  onRestart,
  onTitle,
}: {
  h: HudState;
  g: Game;
  onResume: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onRestart: () => void;
  onTitle: () => void;
}) {
  return (
    <Modal title="⏸ Paused" onClose={onResume}>
      <div className="grid gap-2">
        <Btn variant="primary" onClick={onResume}>
          ▶ Resume
        </Btn>
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={onHelp}>📘 Field Manual</Btn>
          <Btn onClick={onSettings}>⚙️ Settings</Btn>
        </div>
        <div className="mt-2 rounded-lg border border-white/10 bg-slate-800/50 p-2">
          <div className="mb-1 text-xs font-bold uppercase text-cyan-300">Difficulty (live)</div>
          <div className="flex gap-1">
            {DIFFS.map((d) => (
              <button key={d.id} onClick={() => g.setDiff(d.id)} className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${h.diff === d.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 hover:bg-slate-600'}`}>
                {d.name}
              </button>
            ))}
          </div>
          <div className="mb-1 mt-2 text-xs font-bold uppercase text-cyan-300">Modifiers</div>
          <div className="flex flex-wrap gap-1">
            {MODS.map((m) => (
              <button
                key={m.id}
                title={m.desc}
                onClick={() => g.setMod(m.id, !h.mods[m.id])}
                className={`rounded px-2 py-1 text-xs font-semibold ${h.mods[m.id] ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                {m.icon} {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn variant="danger" onClick={onRestart}>
            ↻ Restart Run
          </Btn>
          <Btn variant="ghost" onClick={onTitle}>
            Quit to Title
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
