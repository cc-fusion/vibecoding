import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';
import { TOOLS, TRIBES, TECHS, TECH_BY_ID, type ToolId, type SaveData } from './data';
import { OVERLAY_NAMES, type Snapshot, type Overlay } from './game';

function Bar({ value, max, color, label, flash, icon }: { value: number; max: number; color: string; label: string; flash?: boolean; icon: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn('min-w-[120px] flex-1', flash && 'shake-x')}>
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-100/70"><span>{icon} {label}</span><span className="tabular-nums text-white">{Math.floor(value)}/{Math.floor(max)}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

const TUT = [
  { t: 'Shepherd the plates', d: 'Click and drag anywhere on the map to push the tectonic plate beneath your cursor. Drag it about 8 cells. Overlaps raise mountains; gaps open rifts.' },
  { t: 'Read the faults', d: 'Press Tab (or click an overlay button on the top bar) until you see FAULT STRESS. Red zones are loaded and will snap into quakes.' },
  { t: 'Vent the pressure', d: 'A red stress zone just appeared. Choose Tremor (key 2) and click on it to release the stress safely before it becomes a disaster.' },
  { t: 'Collect prayers', d: 'Tribes pray with glowing ✦ bubbles above their settlements. Click one to gain Favor — it pays for Blessings, Omens and Sanctuaries.' },
  { t: "Guide a tribe's research", d: 'Open the Tribes panel (key T) and click an available technology to set that tribe\'s focus. Tribes also adapt to the disasters they suffer.' },
  { t: 'You are ready', d: 'Meet each era\'s goals, watch diplomacy lines (green = trade, red = war), and survive until the Titan awakens — then vent it to win.' },
];

export interface HudProps {
  snap: Snapshot; save: SaveData; topH: number; onTopH: (h: number) => void; onDockH: (h: number) => void;
  panelOpen: boolean; setPanelOpen: (b: boolean) => void; tab: 'tribes' | 'diplomacy' | 'log'; setTab: (t: 'tribes' | 'diplomacy' | 'log') => void;
  selTribe: number; setSelTribe: (n: number) => void; desktop: boolean;
  onTool: (t: ToolId) => void; onOverlay: (o: Overlay) => void; onPause: () => void; onSpeed: () => void; onMute: () => void;
  onResearch: (tribe: number, tech: string | null) => void; onTutSkip: () => void; onTutFinish: () => void;
}

export function Hud(p: HudProps) {
  const { snap } = p;
  const topRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<ToolId | null>(null);
  useLayoutEffect(() => {
    const els: [HTMLElement | null, (h: number) => void][] = [[topRef.current, p.onTopH], [dockRef.current, p.onDockH]];
    const ros = els.map(([el, cb]) => { if (!el) return null; const ro = new ResizeObserver(() => cb(el.getBoundingClientRect().height)); ro.observe(el); cb(el.getBoundingClientRect().height); return ro; });
    return () => ros.forEach((r) => r?.disconnect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const affordable = (id: ToolId) => {
    const d = TOOLS.find((t) => t.id === id)!;
    return d.resource === 'energy' ? snap.energy >= d.cost : d.resource === 'favor' ? snap.favor >= d.cost : true;
  };
  const tipDef = tip ? TOOLS.find((t) => t.id === tip) : null;
  const tut = snap.tut.active ? TUT[Math.min(snap.tut.step, TUT.length - 1)] : null;

  return (
    <>
      {/* top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 p-2">
        <div ref={topRef} className="panel pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5">
          <button className="btn !px-2.5 !py-1" onClick={p.onPause} title="Pause (Space / Esc)">⏸</button>
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal-200/70">{snap.endless ? 'Eternal' : `Era ${snap.era + 1}/5`}</div>
            <div className="text-sm font-extrabold text-amber-200">{snap.endless ? 'Eternal Age' : snap.eraName}</div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {snap.goals.map((g) => {
              const ok = g.cur >= g.need;
              return (
                <div key={g.label} className="w-24">
                  <div className={cn('flex justify-between text-[10px] font-bold uppercase tracking-wide', ok ? 'text-teal-300' : 'text-indigo-100/70')}><span>{g.label}</span><span className="tabular-nums">{Math.min(g.cur, 9999)}/{g.need}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/50"><div className={cn('h-full rounded-full', ok ? 'bg-teal-300' : 'bg-indigo-300')} style={{ width: `${Math.min(100, (g.cur / Math.max(1, g.need)) * 100)}%` }} /></div>
                </div>
              );
            })}
            {snap.era >= 4 && <div className="text-xs font-bold text-red-300">Calm the Titan to win!</div>}
          </div>
          <div className="flex min-w-[260px] flex-1 gap-3">
            <Bar value={snap.energy} max={snap.maxEnergy} color="#4aa8ff" label="Energy" icon="⚡" flash={snap.energyFlash > 0.1} />
            <Bar value={snap.favor} max={100} color="#ffc94a" label="Favor" icon="✦" />
          </div>
          <div className="flex items-center gap-3 text-xs text-indigo-100/80">
            <span title="Total population">👥 <b className="text-white">{snap.pop}</b></span>
            <span title="Settlements">🏘 <b className="text-white">{snap.settlements}</b></span>
            <span title="Sea level">🌊 <b className={cn(snap.sea > 0.1 ? 'text-red-300' : 'text-white')}>{snap.sea >= 0 ? '+' : ''}{Math.round(snap.sea * 100)}</b></span>
          </div>
          <div className="flex items-center gap-1">
            {OVERLAY_NAMES.map((n, i) => (
              <button key={n} onClick={() => p.onOverlay(i as Overlay)} title={`${n} overlay (Tab)`} className={cn('btn !px-2 !py-1 text-[11px]', snap.overlay === i && '!border-amber-300 !bg-amber-300/20')}>{['🗺', '🧩', '🔥', '🌱'][i]}<span className="hidden xl:inline"> {n}</span></button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button className="btn !px-2.5 !py-1 text-xs" onClick={p.onSpeed} title="Speed (F)">×{snap.speed}</button>
            <button className="btn !px-2.5 !py-1 text-xs" onClick={p.onMute} title="Mute (M)">{p.save.settings.muted ? '🔇' : '🔊'}</button>
            <button className={cn('btn !px-2.5 !py-1 text-xs', p.panelOpen && '!border-teal-300')} onClick={() => p.setPanelOpen(!p.panelOpen)} title="Tribes panel (T)">📜</button>
          </div>
        </div>
        {snap.titan && !snap.titan.dead && (
          <div className="pointer-events-none mx-auto mt-2 max-w-xl fade-up">
            <div className="panel px-3 py-1.5">
              <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-red-200"><span>🌋 The Titan Beneath — Phase {snap.titan.phase + 1}</span><span className="tabular-nums">{Math.ceil(snap.titan.hp)}/{snap.titan.max}</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-black/60 ring-1 ring-red-400/30">
                <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${(snap.titan.hp / snap.titan.max) * 100}%`, background: 'linear-gradient(90deg,#ff4a2a,#ffb23a)' }} />
              </div>
              <div className="mt-0.5 text-center text-[10px] text-indigo-100/60">Cast Tremor near the Titan while its stress glows red. Use Sanctuary to shield towns from pulses.</div>
            </div>
          </div>
        )}
        <div className="pointer-events-none mx-auto mt-2 flex max-w-xl flex-col items-center gap-1">
          {snap.warnings.map((w, i) => <div key={i} className="warn-in rounded-lg border border-red-400/40 bg-red-950/80 px-3 py-1 text-sm font-bold text-red-100 shadow-lg">⚠ {w}</div>)}
        </div>
      </div>

      {/* tool dock */}
      <div ref={dockRef} className={cn('pointer-events-none fixed z-20', p.desktop ? 'left-2 top-0 flex flex-col justify-center' : 'inset-x-0 bottom-0 p-1.5')} style={p.desktop ? { top: p.topH + 8, bottom: 8 } : undefined}>
        <div className={cn('panel pointer-events-auto flex gap-1.5 p-1.5', p.desktop ? 'flex-col' : 'justify-center overflow-x-auto')}>
          {TOOLS.map((t) => {
            const locked = t.unlock > 0 && !p.save.unlocked.includes(t.id);
            const active = snap.tool === t.id; const ok = affordable(t.id);
            const cd = snap.cds[t.id] || 0;
            return (
              <button key={t.id} onClick={() => p.onTool(t.id)} onMouseEnter={() => setTip(t.id)} onMouseLeave={() => setTip(null)}
                className={cn('relative flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border text-xl transition', active ? 'border-amber-300 bg-amber-300/25 pulse-glow' : 'border-white/15 bg-white/5 hover:bg-white/12', locked && 'opacity-45')}
                aria-label={t.name}>
                <span className="leading-none">{locked ? '🔒' : t.id === 'tide' ? (snap.tideLower && active ? '🔽' : '🌊') : t.icon}</span>
                <span className="text-[9px] font-bold text-indigo-100/70">{t.key}{t.cost > 0 && <span className={cn('ml-1', ok ? (t.resource === 'energy' ? 'text-sky-300' : 'text-amber-300') : 'text-red-400')}>{t.cost}</span>}</span>
                {cd > 0.01 && <span className="absolute inset-x-0 bottom-0 bg-black/65" style={{ height: `${cd * 100}%` }} />}
              </button>
            );
          })}
        </div>
        {tipDef && p.desktop && (
          <div className="panel pointer-events-none absolute left-16 top-1/2 w-64 -translate-y-1/2 p-3 fade-up">
            <div className="font-extrabold text-amber-200">{tipDef.icon} {tipDef.name} <span className="ml-1 text-xs text-indigo-100/60">[{tipDef.key}]</span></div>
            <div className="mt-1 text-xs leading-snug text-indigo-100/85">{tipDef.desc}</div>
            <div className="mt-1.5 text-[11px] text-indigo-100/60">{tipDef.cost > 0 ? `Cost ${tipDef.cost} ${tipDef.resource === 'energy' ? '⚡ energy' : '✦ favor'} · cooldown ${tipDef.cd}s` : 'Costs energy per cell moved'}{tipDef.unlock > 0 && !p.save.unlocked.includes(tipDef.id) ? ` · unlock in Sanctum (${tipDef.unlock} 💠)` : ''}</div>
          </div>
        )}
      </div>

      {/* hover info */}
      {snap.hover && desktopHover(p) && (
        <div className="pointer-events-none fixed bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/55 px-3 py-1 text-center text-xs backdrop-blur">
          <b className="text-amber-100">{snap.hover.text}</b><span className="ml-2 text-indigo-100/70">{snap.hover.sub}</span>
        </div>
      )}

      {/* tutorial */}
      {tut && (
        <div className={cn('pointer-events-none fixed inset-x-0 z-20 flex justify-center px-2', p.desktop ? 'bottom-10' : 'bottom-20')}>
          <div className="panel pointer-events-auto pop-in w-full max-w-lg border-teal-300/40 p-3.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-widest text-teal-200">Tutorial {Math.min(snap.tut.step + 1, TUT.length)}/{TUT.length}</div>
              <div className="flex gap-1">{TUT.map((_, i) => <span key={i} className={cn('h-1.5 w-5 rounded', i < snap.tut.step ? 'bg-teal-300' : i === snap.tut.step ? 'bg-amber-300' : 'bg-white/15')} />)}</div>
            </div>
            <div className="mt-1 text-lg font-extrabold text-amber-200">{tut.t}</div>
            <p className="text-sm leading-snug text-indigo-100/90">{tut.d}</p>
            <div className="mt-2 flex justify-end gap-2">
              {snap.tut.step >= TUT.length - 1 ? <button className="btn btn-primary !py-1 text-sm" onClick={p.onTutFinish}>Finish tutorial ✓</button> : <button className="btn !py-1 text-xs" onClick={p.onTutSkip}>Skip tutorial</button>}
            </div>
          </div>
        </div>
      )}

      {/* banner */}
      {snap.banner && (
        <div key={snap.banner.text} className="pointer-events-none fixed inset-x-0 top-1/3 z-30 text-center">
          <div className="banner-anim">
            <div className="title-logo text-4xl font-black uppercase tracking-[0.12em] sm:text-6xl">{snap.banner.text}</div>
            <div className="mt-1 text-base font-semibold text-indigo-100 drop-shadow sm:text-lg">{snap.banner.sub}</div>
          </div>
        </div>
      )}

      {/* side panel */}
      {p.panelOpen && <SidePanel {...p} />}
    </>
  );
}

function desktopHover(p: HudProps) { return p.desktop; }

function relColor(v: number) { return v > 25 ? '#6ee79a' : v < -25 ? '#ff6a4d' : '#aab4ff'; }

function SidePanel(p: HudProps) {
  const { snap } = p;
  return (
    <div className={cn('panel fixed z-20 flex flex-col overflow-hidden', p.desktop ? 'right-2 w-[330px]' : 'inset-x-2 bottom-[72px]')}
      style={p.desktop ? { top: p.topH + 8, bottom: 8 } : { top: p.topH + 8 }}>
      <div className="flex border-b border-white/10">
        {([['tribes', '🏕 Tribes'], ['diplomacy', '🤝 Diplomacy'], ['log', '📜 Chronicle']] as const).map(([k, l]) => (
          <button key={k} onClick={() => p.setTab(k)} className={cn('flex-1 px-2 py-2 text-xs font-bold transition', p.tab === k ? 'bg-white/10 text-amber-200' : 'text-indigo-100/60 hover:bg-white/5')}>{l}</button>
        ))}
        <button className="px-3 text-indigo-100/60 hover:text-white" onClick={() => p.setPanelOpen(false)} aria-label="Close panel">✕</button>
      </div>
      <div className="scroll flex-1 overflow-y-auto p-2.5">
        {p.tab === 'tribes' && <TribesTab {...p} />}
        {p.tab === 'diplomacy' && (
          <div className="space-y-2">
            {snap.tribes.flatMap((a) => snap.tribes.filter((b) => b.id > a.id).map((b) => {
              const rel = a.rel[b.id]; const alive = a.alive && b.alive;
              const status = !alive ? 'Lost' : a.war[b.id] ? '⚔ War' : a.trade[b.id] ? '🤝 Trade' : a.contact[b.id] ? 'Contact' : 'Isolated';
              return (
                <div key={`${a.id}-${b.id}`} className={cn('rounded-lg border border-white/10 bg-white/5 p-2', !alive && 'opacity-40')}>
                  <div className="flex items-center justify-between text-xs"><span><b style={{ color: TRIBES[a.id].color }}>{TRIBES[a.id].icon}</b> ⇄ <b style={{ color: TRIBES[b.id].color }}>{TRIBES[b.id].icon}</b> <span className="text-indigo-100/70">{TRIBES[a.id].name} / {TRIBES[b.id].name}</span></span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', status.includes('War') ? 'bg-red-500/30 text-red-200' : status.includes('Trade') ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/10 text-indigo-100/70')}>{status}</span></div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-black/50">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-white/30" />
                    <div className="absolute top-0 h-full rounded-full" style={{ left: rel >= 0 ? '50%' : `${50 + rel / 2}%`, width: `${Math.abs(rel) / 2}%`, background: relColor(rel) }} />
                  </div>
                  <div className="mt-0.5 text-right text-[10px] tabular-nums" style={{ color: relColor(rel) }}>{rel > 0 ? '+' : ''}{rel}</div>
                </div>
              );
            }))}
            <p className="px-1 text-[11px] text-indigo-100/50">Tribes only interact when in contact. Drag plates apart to break contact; cast an Omen of Peace on a settlement to mend relations.</p>
          </div>
        )}
        {p.tab === 'log' && (
          <div className="space-y-1">
            {snap.log.length === 0 && <div className="text-xs text-indigo-100/50">Nothing yet.</div>}
            {snap.log.map((l, i) => (
              <div key={`${l.t}-${i}`} className={cn('rounded px-2 py-1 text-xs', l.kind === 'bad' ? 'bg-red-500/10 text-red-200' : l.kind === 'good' ? 'bg-emerald-500/10 text-emerald-200' : l.kind === 'war' ? 'bg-orange-500/15 text-orange-200' : l.kind === 'era' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/5 text-indigo-100/80')}>
                <span className="mr-1.5 tabular-nums opacity-50">{Math.floor(l.t / 60)}:{String(Math.floor(l.t % 60)).padStart(2, '0')}</span>{l.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TribesTab(p: HudProps) {
  const { snap } = p;
  return (
    <div className="space-y-2">
      {snap.tribes.map((t) => {
        const def = TRIBES[t.id]; const open = p.selTribe === t.id;
        return (
          <div key={t.id} className={cn('rounded-xl border bg-white/5', open ? 'border-white/30' : 'border-white/10', !t.alive && 'opacity-45')}>
            <button className="flex w-full items-center gap-2 p-2 text-left" onClick={() => p.setSelTribe(t.id)}>
              <span className="grid h-8 w-8 place-items-center rounded-full text-lg" style={{ background: def.color + '33', border: `1.5px solid ${def.color}` }}>{def.icon}</span>
              <span className="flex-1">
                <span className="block text-sm font-extrabold" style={{ color: def.color }}>{def.name}{!t.alive && ' — perished'}</span>
                <span className="block text-[11px] text-indigo-100/70">👥 {t.pop} · 🏘 {t.nset} · devotion {t.devotion}</span>
              </span>
              {t.alive && <span className="text-[10px] text-indigo-100/60">🔬 {t.rate.toFixed(2)}/s</span>}
            </button>
            {t.alive && (
              <div className="px-2 pb-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full" style={{ width: `${t.devotion}%`, background: def.color }} /></div>
                <div className="mt-1.5 text-[11px] text-indigo-100/80">
                  {t.current ? <>Researching <b>{TECH_BY_ID[t.current].icon} {TECH_BY_ID[t.current].name}</b> {t.focus === t.current && <span className="text-amber-200">(focus)</span>}</> : 'Nothing left to discover'}
                </div>
                {t.current && <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-sky-300" style={{ width: `${t.progress * 100}%` }} /></div>}
              </div>
            )}
            {open && t.alive && (
              <div className="border-t border-white/10 p-2">
                <div className="mb-1 text-[10px] italic text-indigo-100/60">{def.trait}</div>
                {[1, 2, 3].map((tier) => (
                  <div key={tier} className="mb-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-200/50">Tier {tier}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {TECHS.filter((x) => x.tier === tier).map((x) => {
                        const known = t.techs.includes(x.id); const avail = !known && x.req.every((r) => t.techs.includes(r));
                        const isFocus = t.focus === x.id;
                        return (
                          <button key={x.id} disabled={!avail} onClick={() => p.onResearch(t.id, isFocus ? null : x.id)}
                            title={`${x.name}: ${x.desc}${x.req.length ? ' (needs ' + x.req.map((r) => TECH_BY_ID[r].name).join(' + ') + ')' : ''}`}
                            className={cn('rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition', known ? 'border-transparent text-black' : avail ? 'border-white/30 bg-white/10 hover:bg-white/20' : 'border-white/5 bg-white/5 opacity-35', isFocus && '!border-amber-300 pulse-glow', t.current === x.id && !isFocus && 'border-sky-300')}
                            style={known ? { background: def.color } : undefined}>
                            {x.icon} {x.name}{known ? ' ✓' : isFocus ? ' ★' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-indigo-100/50">Click an available tech to set it as focus (★). Click again to release.</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
