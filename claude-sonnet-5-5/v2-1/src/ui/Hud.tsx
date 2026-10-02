import { useState, type ReactNode } from 'react';
import { ABILITIES, BDEFS, BType, clamp, EDEF, ENGDEFS, hasCharter, PLOT_BY_ID, TIDE_T, TUT, WAVE_COUNT, type EType } from '../game/data';
import type { Building, Game } from '../game/sim';
import { audio } from '../game/audio';
import { Btn, CostChips, fmt, Meter } from './common';

export interface HudProps { g: Game; speed: number; setSpeed: (n: number) => void; paused: boolean; onPause: () => void; muted: boolean; onMute: () => void; bump: () => void; onMenu: () => void }

const SHIP_ICON: Record<EType, string> = { skiff: '⛵', galley: '🚣', fireship: '🔥', bombard: '💥', tidecaller: '🔮', ironclad: '🛡️', maelstrom: '☠️', leviathan: '🐉' };

function Chip({ icon, v, title, warn }: { icon: string; v: string | number; title: string; warn?: boolean }) {
  return (
    <div title={title} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold tabular-nums ${warn ? 'border-rose-500/70 bg-rose-950/60 text-rose-200' : 'border-slate-600/50 bg-slate-900/70 text-slate-100'}`}>
      <span>{icon}</span><span>{v}</span>
    </div>
  );
}

export function TopBar({ g, speed, setSpeed, paused, onPause, muted, onMute, bump, onMenu }: HudProps) {
  const mood = g.morale > 75 ? '😄' : g.morale > 52 ? '🙂' : g.morale > 32 ? '😐' : g.morale > 15 ? '😟' : '😡';
  const canCall = Number.isFinite(g.countdown) && g.countdown > 4 && (g.wave < WAVE_COUNT || g.endless);
  const tutCall = g.tutActive && !g.tutWave && g.wave === 0;
  const waveTxt = g.wave === 0
    ? Number.isFinite(g.countdown) ? `First ships in ${Math.ceil(g.countdown)}s` : 'Awaiting your signal'
    : `Wave ${g.wave}${g.endless ? '' : '/' + WAVE_COUNT}` + (Number.isFinite(g.countdown) ? ` · next ${Math.ceil(g.countdown)}s` : g.waveActive ? ' · battle!' : '');
  const net = g.powerGen - g.powerUse;
  return (
    <div className="relative z-20 flex flex-wrap items-center gap-1.5 border-b border-cyan-900/60 bg-gradient-to-b from-slate-900 to-slate-950 px-2 py-1.5">
      <div className="mr-1 hidden font-display text-sm font-bold tracking-wider text-amber-200 xl:block">TIDAL FORGE</div>
      <Chip icon="🪨" v={fmt(g.res.stone)} title="Stone: builds and repairs everything" />
      <Chip icon="⚙️" v={fmt(g.res.iron)} title="Iron: ammunition and upgrades" warn={g.res.iron < 3} />
      <Chip icon="🪙" v={fmt(g.res.gold)} title="Gold: recruits, trade, advanced works" />
      <Chip icon="🐟" v={fmt(g.rations)} title="Rations: eaten by the crew; feeds morale" warn={g.rations < 15} />
      <div className="flex w-32 flex-col gap-0.5 rounded-md border border-slate-600/50 bg-slate-900/70 px-2 py-0.5" title={`Power ${g.power.toFixed(0)}/${g.powerCap}. Generation ${g.powerGen.toFixed(1)}/s, use ${g.powerUse.toFixed(1)}/s`}>
        <div className="flex justify-between text-[11px] font-semibold text-yellow-200"><span>⚡ {Math.floor(g.power)}</span><span className={net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{net >= 0 ? '+' : ''}{net.toFixed(1)}/s</span></div>
        <Meter v={g.power} max={g.powerCap} color="linear-gradient(90deg,#facc15,#fde68a)" />
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-slate-600/50 bg-slate-900/70 px-2 py-1 text-sm font-semibold" title="Crew: free / total / housing. Assign crew in building panels.">
        <span>⚓</span><span className="tabular-nums">{Math.max(0, g.freeCrew())}/{g.crew}</span><span className="text-xs text-slate-400">/{g.housing}</span>
      </div>
      <div className="flex w-28 flex-col gap-0.5 rounded-md border border-slate-600/50 bg-slate-900/70 px-2 py-0.5" title={`Morale ${g.morale.toFixed(0)}. Boosts workshop and engine speed. Low morale causes desertion.`}>
        <div className="flex justify-between text-[11px] font-semibold"><span>{mood} Morale</span><span className="tabular-nums">{Math.round(g.morale)}</span></div>
        <Meter v={g.morale} max={100} color={g.morale > 50 ? 'linear-gradient(90deg,#34d399,#a7f3d0)' : g.morale > 25 ? '#fbbf24' : '#f43f5e'} />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 text-sm font-semibold text-amber-200">{waveTxt}</div>
        {(canCall || tutCall) && <Btn small kind="primary" onClick={() => { g.callWave(); bump(); }} title="Space: summon the next wave early for a gold bonus">Call Wave ␣</Btn>}
        <div className="flex overflow-hidden rounded-md border border-slate-600/60">
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => { audio.sfx('tick'); setSpeed(s); }} className={`px-2 py-1 text-xs font-bold ${speed === s ? 'bg-cyan-500/40 text-cyan-100' : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800'}`}>{s}x</button>
          ))}
        </div>
        <Btn small onClick={onPause} title="Pause (Esc)">{paused ? '▶' : '⏸'}</Btn>
        <Btn small onClick={onMute} title="Mute (M)">{muted ? '🔇' : '🔊'}</Btn>
        <Btn small onClick={onMenu} title="Menu (Esc)">☰</Btn>
      </div>
    </div>
  );
}

export function TideChart({ g }: { g: Game }) {
  const Wd = 300, Ht = 74;
  const cycles = 0.9 + 0.4 * g.c('almanac') + (g.obsRange > 0 ? 0.5 : 0);
  const past = 10; const total = past + cycles * TIDE_T;
  const yOf = (s: number) => clamp(((s - 300) / (600 - 300)) * Ht, 1, Ht - 1);
  const xOf = (t: number) => ((t - (g.t - past)) / total) * Wd;
  const pts: string[] = [];
  const N = 70;
  for (let i = 0; i <= N; i++) { const t = g.t - past + (i / N) * total; pts.push(`${(i / N) * Wd},${yOf(g.tideAt(t))}`); }
  const sel = g.selB();
  const fl = sel && BDEFS[sel.type].engine && sel.type !== 'hydro' ? PLOT_BY_ID[sel.plot].floatY : undefined;
  const wx = Number.isFinite(g.countdown) ? xOf(g.t + g.countdown) : -1;
  const rising = g.tideRate < -1; const falling = g.tideRate > 1;
  const sn = g.ampAt(g.t) / (g.mods.has('spring') ? 1.3 : 1);
  return (
    <div className="relative rounded-md border border-cyan-900/70 bg-slate-950/80 p-1" title="Tide forecast. Cyan dashes = lagoon level. Green band = selected engine's float band. Gold line = next wave.">
      <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
        <span>🌙 Tide {rising ? '▲ rising' : falling ? '▼ falling' : '● slack'}</span>
        <span className="text-slate-400">{sn > 98 ? 'Spring tide' : sn < 74 ? 'Neap tide' : 'Mean tide'} · {Math.round(g.S)}</span>
      </div>
      <svg width={Wd} height={Ht} viewBox={`0 0 ${Wd} ${Ht}`} className="block max-w-full">
        <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3cc4d8" stopOpacity="0.7" /><stop offset="1" stopColor="#0b3550" stopOpacity="0.4" /></linearGradient></defs>
        {fl !== undefined && <rect x={0} y={yOf(fl - 65)} width={Wd} height={yOf(fl + 65) - yOf(fl - 65)} fill="#7fe3a0" opacity="0.22" />}
        <polygon points={`0,${Ht} ${pts.join(' ')} ${Wd},${Ht}`} fill="url(#tg)" />
        <polyline points={pts.join(' ')} fill="none" stroke="#bff3ff" strokeWidth="1.8" />
        {g.gates.map((gt, i) => <line key={i} x1={0} x2={Wd} y1={yOf(gt.sill)} y2={yOf(gt.sill)} stroke="#ffffff" strokeOpacity="0.14" strokeDasharray="2 4" />)}
        <line x1={0} x2={Wd} y1={yOf(g.L)} y2={yOf(g.L)} stroke="#2dd4bf" strokeDasharray="5 3" strokeWidth="1.3" />
        <text x={Wd - 3} y={yOf(g.L) - 2} fontSize="8" fill="#2dd4bf" textAnchor="end">lagoon</text>
        <line x1={xOf(g.t)} x2={xOf(g.t)} y1={0} y2={Ht} stroke="#ffd166" strokeWidth="1.2" />
        <circle cx={xOf(g.t)} cy={yOf(g.S)} r="3.5" fill="#ffd166" />
        {wx > 0 && wx < Wd && <g><line x1={wx} x2={wx} y1={0} y2={Ht} stroke="#ff8a70" strokeDasharray="3 2" /><text x={wx + 2} y={10} fontSize="9" fill="#ff8a70">⚑ wave</text></g>}
      </svg>
    </div>
  );
}

export function BottomBar({ g, bump }: HudProps) {
  const [market, setMarket] = useState(false);
  const m = g.marketMul;
  return (
    <div className="relative z-20 flex flex-wrap items-stretch gap-2 border-t border-cyan-900/60 bg-gradient-to-t from-slate-900 to-slate-950 px-2 py-1.5">
      <div className="flex gap-1.5">
        {g.gates.map((gt, i) => (
          <button key={i} onClick={() => { g.toggleGate(i); bump(); }} title={`Key ${i + 1}: cycle Shut / Open / Auto. Sill y=${gt.sill}. Water flows from the higher surface to the lower and spins the turbine.`}
            className={`w-28 rounded-md border px-2 py-1 text-left transition active:scale-95 ${gt.mode === 1 ? 'border-amber-300/70 bg-amber-900/30' : gt.mode === 2 ? 'border-emerald-300/70 bg-emerald-900/30' : 'border-slate-600/60 bg-slate-900/70'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-300">[{i + 1}] {gt.name}</div>
            <div className="text-sm font-bold" style={{ color: gt.mode === 1 ? '#fcd34d' : gt.mode === 2 ? '#6ee7b7' : '#94a3b8' }}>{gt.mode === 0 ? 'SHUT' : gt.mode === 1 ? 'OPEN' : 'AUTO'} · Lv{gt.lvl}</div>
            <Meter v={gt.flow} max={40} color="linear-gradient(90deg,#22d3ee,#a5f3fc)" className="mt-0.5" />
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {ABILITIES.map((a) => {
          const cd = g.cd[a.id] || 0; const ready = cd <= 0;
          return (
            <button key={a.id} onClick={() => { g.useAbility(a.id); bump(); }} title={`${a.name} [${a.key}]: ${a.desc}`}
              className={`relative h-full min-h-[52px] w-[58px] overflow-hidden rounded-md border text-center transition active:scale-95 ${ready ? 'border-amber-300/60 bg-slate-800/80 hover:bg-slate-700' : 'border-slate-700 bg-slate-900/80 opacity-70'}`}>
              <div className="text-xl leading-none pt-1">{a.icon}</div>
              <div className="text-[9px] font-bold text-slate-300">{a.name.split(' ')[0]}</div>
              <div className="absolute left-0.5 top-0 text-[9px] font-bold text-amber-300">{a.key}</div>
              {!ready && <div className="absolute inset-x-0 bottom-0 bg-slate-950/70" style={{ height: `${(cd / a.cd) * 100}%` }} />}
              {!ready && <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{Math.ceil(cd)}</div>}
            </button>
          );
        })}
      </div>
      <div className="relative">
        <Btn small onClick={() => setMarket(!market)} active={market} className="h-full" title="Trade stone, iron and gold">💱 Market{m > 1 ? ' ★' : ''}</Btn>
        {market && (
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-amber-700/60 bg-slate-900/95 p-2 shadow-xl anim-pop">
            <div className="mb-1 text-xs font-bold text-amber-200">Harbor Market {m > 1 && <span className="text-emerald-300">· Convoy prices!</span>}</div>
            <div className="flex flex-col gap-1">
              <Btn small onClick={() => { g.trade('sellStone'); bump(); }}>Sell 40 🪨 → {Math.round(18 * m)} 🪙</Btn>
              <Btn small onClick={() => { g.trade('buyStone'); bump(); }}>Buy 40 🪨 ← {Math.round(24 / m)} 🪙</Btn>
              <Btn small onClick={() => { g.trade('buyIron'); bump(); }}>Buy 20 ⚙️ ← {Math.round(30 / m)} 🪙</Btn>
              <Btn small onClick={() => { g.trade('sellIron'); bump(); }}>Sell 20 ⚙️ → {Math.round(24 * m)} 🪙</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="ml-auto hidden sm:block"><TideChart g={g} /></div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2 text-xs"><span className="text-slate-400">{k}</span><span className="text-right font-semibold text-slate-100">{v}</span></div>;
}

function prodText(g: Game, b: Building): string {
  const lv = 1 + 0.35 * (b.level - 1); const a = (1 + 0.12 * g.c('artisan')) * g.diff.res;
  switch (b.type) {
    case 'quarry': return `+${(0.85 * b.eff * lv * a).toFixed(2)} stone/s`;
    case 'ironworks': return `+${(0.32 * b.eff * lv * a).toFixed(2)} iron/s (eats ${(0.45 * b.eff).toFixed(2)} stone/s)`;
    case 'saltworks': return `+${(0.5 * b.eff * lv * a * (1 + 0.12 * g.c('merchant'))).toFixed(2)} gold/s at best`;
    case 'fishery': return `+${(1.0 * b.eff * lv * a).toFixed(2)} rations/s when exposed`;
    case 'mess': return 'Raises morale equilibrium';
    case 'barracks': return `Housing +${6 * b.level}`;
    case 'carpenter': return `Repairs ${(3 * b.eff * b.level).toFixed(1)} HP/s`;
    case 'battery': return `+${120 * b.level} power storage`;
    case 'observatory': return `+${6 * b.level}% range, longer forecast`;
    default: return '';
  }
}

export function SidePanel({ g, bump }: { g: Game; bump: () => void }) {
  const sel = g.sel;
  if (!sel) return null;
  const close = () => { g.sel = null; bump(); };
  const shell = (title: string, sub: string | null, body: ReactNode) => (
    <div className="pointer-events-auto absolute right-2 top-2 z-30 max-h-[calc(100%-1rem)] w-72 max-w-[88vw] overflow-y-auto rounded-xl border border-cyan-800/70 bg-slate-900/92 p-3 shadow-2xl shadow-black/60 backdrop-blur anim-pop">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><div className="font-display text-lg leading-tight text-amber-200">{title}</div>{sub && <div className="text-[11px] text-slate-400">{sub}</div>}</div>
        <button onClick={() => { audio.sfx('back'); close(); }} className="rounded px-1.5 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
      </div>
      {body}
    </div>
  );

  if (sel.k === 'gate') {
    const gt = g.gates[sel.i]; const head = Math.abs(g.S - g.L);
    return shell(gt.name, `Sluice in the seawall · sill y=${gt.sill}`, (
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {(['SHUT', 'OPEN', 'AUTO'] as const).map((l, i) => <Btn key={l} small active={gt.mode === i} onClick={() => { while (gt.mode !== i) g.toggleGate(sel.i); bump(); }}>{l}</Btn>)}
        </div>
        <Row k="Tide head" v={`${head.toFixed(0)} px (${g.S > g.L ? 'lagoon drains' : 'lagoon fills'})`} />
        <Row k="Flow" v={`${gt.flow.toFixed(1)} px/s`} />
        <Row k="Lagoon / Sea level" v={`${g.L.toFixed(0)} / ${g.S.toFixed(0)}`} />
        <div className="rounded bg-slate-950/60 p-2 text-[11px] leading-snug text-slate-300">Water runs from the higher surface to the lower, turning the turbine. Power scales with head x flow. Closing a gate at high tide traps a full lagoon (for Hydro-Rams and brine pans) but may flood low terraces. AUTO opens when head &gt; 55.</div>
        <div className="flex items-center justify-between"><span className="text-xs text-slate-300">Gate & turbine Lv{gt.lvl}</span>{gt.lvl < 3 ? <Btn small kind="good" disabled={!g.canAfford(g.gateUpCost(gt))} onClick={() => { g.upgradeGate(sel.i); bump(); }}>Upgrade <CostChips cost={g.gateUpCost(gt)} g={g} /></Btn> : <span className="text-xs text-amber-300">MAX</span>}</div>
      </div>
    ));
  }

  if (sel.k === 'wall' || sel.k === 'keep') {
    const b = sel.k === 'wall' ? g.wall : g.keep;
    const isWall = sel.k === 'wall';
    const missing = b.maxHp - b.hp;
    return shell(isWall ? 'Seawall' : 'The Keep', isWall ? `Level ${b.level} · crest y=${g.wallTop}${g.breached ? ' · BREACHED' : ''}` : 'Your citadel heart', (
      <div className="flex flex-col gap-2">
        <Meter v={b.hp} max={b.maxHp} color={b.hp / b.maxHp > 0.4 ? '#34d399' : '#f43f5e'} />
        <Row k="Hull" v={`${Math.ceil(b.hp)} / ${Math.round(b.maxHp)}`} />
        <Btn small kind="good" disabled={missing < 1 || g.res.stone < 1} onClick={() => { g.repair(b); bump(); }}>Repair (🪨 {Math.ceil(missing * (isWall ? 0.05 : 0.08))})</Btn>
        {isWall && (
          <>
            <div className="rounded bg-slate-950/60 p-2 text-[11px] leading-snug text-slate-300">A taller wall resists overtopping by storm surges. If it breaks, the lagoon floods freely and the sluices are lost until repaired.</div>
            {b.level < 3 ? <Btn small kind="good" disabled={!g.canAfford(g.upCost(b))} onClick={() => { g.upgrade(b); bump(); }}>Raise wall to Lv{b.level + 1} <CostChips cost={g.upCost(b)} g={g} /></Btn> : <div className="text-xs text-amber-300">Maximum height</div>}
          </>
        )}
        {!isWall && (
          <>
            <Row k="Crew" v={`${g.crew} / housing ${g.housing}`} />
            <Btn small kind="primary" disabled={g.crew >= g.housing || g.res.gold < g.recruitCost()} onClick={() => { g.recruit(); bump(); }}>Recruit sailor (🪙 {g.recruitCost()})</Btn>
            <div className="text-xs text-slate-300">Ration policy</div>
            <div className="flex gap-1">
              {(['Short', 'Normal', 'Feast'] as const).map((l, i) => <Btn key={l} small active={g.policy === i} onClick={() => { g.policy = i as 0 | 1 | 2; bump(); }}>{l}</Btn>)}
            </div>
            <div className="text-[11px] text-slate-400">Short: -40% food, -10 morale. Feast: +50% food, +10 morale.</div>
          </>
        )}
      </div>
    ));
  }

  const plot = PLOT_BY_ID[sel.id];
  const b = g.buildingAt(sel.id);
  if (!b) {
    const locked = !!plot.req && !hasCharter(g.save, plot.req);
    const where = plot.kind === 'terrace' ? 'Floods whenever the lagoon surface rises above this terrace.' : plot.kind === 'beach' ? 'Outside the wall: submerged at high tide, exposed to raiders.' : plot.kind === 'mount' ? (plot.floatY! < 420 ? 'Engines here charge fastest around HIGH tide.' : plot.floatY! < 470 ? 'Engines here charge fastest around MID tide.' : 'Engines here charge fastest around LOW tide.') : 'Safe from water. Good for workshops.';
    const types = (Object.keys(BDEFS) as BType[]).filter((t) => { const d = BDEFS[t]; return !d.hidden && d.kinds.includes(plot.kind) && (!d.wallOnly || plot.wallMount); });
    return shell(plot.label, where, locked ? <div className="text-sm text-amber-300">🔒 Locked. Unlock it in the Charter on the title screen.</div> : (
      <div className="flex flex-col gap-1.5">
        {types.map((t) => {
          const d = BDEFS[t]; const lk = !!d.unlock && !hasCharter(g.save, d.unlock); const ok = !lk && g.canAfford(d.cost);
          return (
            <button key={t} disabled={lk} onClick={() => { g.build(sel.id, t); bump(); }} title={d.desc}
              className={`rounded-lg border p-2 text-left transition active:scale-[0.98] ${lk ? 'border-slate-700 bg-slate-900/50 opacity-50' : ok ? 'border-cyan-700/70 bg-slate-800/70 hover:bg-slate-700/80' : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-100">{d.icon} {d.name}</span>{lk ? <span className="text-[10px] text-amber-300">🔒 Charter</span> : <CostChips cost={d.cost} g={g} />}</div>
              <div className="text-[11px] leading-snug text-slate-400">{d.desc}</div>
              {!lk && d.crew > 0 && <div className="text-[10px] text-slate-500">Crew {d.crew}</div>}
            </button>
          );
        })}
      </div>
    ));
  }

  const d = BDEFS[b.type]; const eng = !!d.engine; const ed = ENGDEFS[b.type];
  const missing = b.maxHp - b.hp;
  return shell(`${d.icon} ${d.name}`, `${plot.label} · Level ${b.level}`, (
    <div className="flex flex-col gap-2">
      <Meter v={b.hp} max={b.maxHp} color={b.hp / b.maxHp > 0.4 ? '#34d399' : '#f43f5e'} />
      <Row k="Status" v={b.burning > 0 ? '🔥 On fire!' : b.status || '-'} />
      {eng && ed && (
        <>
          <Row k="Damage" v={b.type === 'hydro' ? `${Math.round(g.engDmg(b) + clamp(g.S - g.L, 0, 130) * 0.5)} (with head)` : `${Math.round(g.engDmg(b))}${ed.aoe ? ` · splash ${ed.aoe}` : ''}`} />
          <Row k="Full-charge time" v={`${g.engPeriod(b).toFixed(1)}s`} />
          <Row k="Range" v={`${Math.round(g.engRange(b))}px`} />
          <Row k="Ammo" v={ed.ammo ? `${ed.ammo} iron / shot` : 'lagoon water'} />
          {b.type === 'hydro'
            ? <Row k="Lagoon head" v={`${Math.max(0, g.S - g.L).toFixed(0)} px (needs > 30)`} />
            : <Row k="Float fit" v={`${Math.round(b.band * 100)}% (tide near y=${PLOT_BY_ID[b.plot].floatY})`} />}
          <Meter v={b.charge} max={1} color="linear-gradient(90deg,#fbbf24,#86efac)" />
        </>
      )}
      {!eng && <Row k="Output" v={prodText(g, b) || '-'} />}
      {!eng && b.flooded && <div className="rounded bg-sky-950/70 p-1.5 text-[11px] text-sky-200">Flooded! Lower the lagoon via the sluices, or relocate.</div>}
      {d.crew > 0 && (
        <div className="flex items-center justify-between rounded bg-slate-950/50 px-2 py-1">
          <span className="text-xs text-slate-300">Crew {b.crew}/{d.crew} <span className="text-slate-500">(free {Math.max(0, g.freeCrew())})</span></span>
          <span className="flex gap-1"><Btn small onClick={() => { g.setCrew(b, -1); bump(); }}>−</Btn><Btn small onClick={() => { g.setCrew(b, 1); bump(); }}>+</Btn></span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {b.level < 3 ? <Btn small kind="good" disabled={!g.canAfford(g.upCost(b))} onClick={() => { g.upgrade(b); bump(); }}>Upgrade <CostChips cost={g.upCost(b)} g={g} /></Btn> : <span className="self-center text-xs text-amber-300">MAX LEVEL</span>}
        <Btn small disabled={missing < 1 || g.res.stone < 1} onClick={() => { g.repair(b); bump(); }}>Repair 🪨{Math.ceil(missing * 0.08)}</Btn>
        <Btn small kind="danger" onClick={() => { g.demolish(b); bump(); }}>Demolish</Btn>
      </div>
      <div className="text-[11px] leading-snug text-slate-400">{d.desc}</div>
    </div>
  ));
}

export function Banner({ g }: { g: Game }) {
  if (!g.banner) return null;
  const b = g.banner;
  return (
    <div key={b.text + b.sub} className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 text-center anim-banner">
      <div className="font-display text-3xl font-extrabold tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-5xl" style={{ color: b.col }}>{b.text}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{b.sub}</div>
    </div>
  );
}

export function BossBar({ g }: { g: Game }) {
  const boss = g.enemies.find((e) => EDEF[e.type].boss);
  if (!boss) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-20 w-[min(560px,80vw)] -translate-x-1/2">
      <div className="text-center font-display text-sm font-bold tracking-wider text-rose-200 drop-shadow">{EDEF[boss.type].name} · Phase {boss.phase + 1}/3</div>
      <div className="h-3.5 overflow-hidden rounded-full border border-rose-300/50 bg-slate-950/80">
        <div className="h-full bg-gradient-to-r from-rose-700 to-rose-400 transition-[width] duration-200" style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
      </div>
    </div>
  );
}

export function EventLog({ g }: { g: Game }) {
  const recent = g.log.filter((l) => g.t - l.t < 14).slice(-4);
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex max-w-[60%] flex-col items-end gap-0.5">
      {recent.map((l, i) => <div key={l.t + l.msg + i} className="rounded bg-slate-950/70 px-2 py-0.5 text-right text-[11px] font-semibold" style={{ color: l.col, opacity: clamp((14 - (g.t - l.t)) / 4, 0, 1) }}>{l.msg}</div>)}
    </div>
  );
}

export function WavePreview({ g }: { g: Game }) {
  const pk = g.peekWave(); const keys = Object.keys(pk) as EType[];
  if (g.demo || !keys.length) return null;
  const n = keys.reduce((a, k) => a + pk[k], 0);
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200">
      <div className="font-bold text-amber-200">Next wave intel</div>
      {g.obsRange > 0
        ? <div className="flex flex-wrap gap-x-2">{keys.map((k) => <span key={k} title={EDEF[k].name}>{SHIP_ICON[k]}×{pk[k]}</span>)}</div>
        : <div className="text-slate-400">~{n} ships · build an Observatory for details</div>}
    </div>
  );
}

export function TutorialCard({ g, bump }: { g: Game; bump: () => void }) {
  if (!g.tutActive) return null;
  const s = TUT[g.tutStep]; if (!s) return null;
  return (
    <div className="absolute bottom-2 left-2 z-30 w-[min(360px,90vw)] rounded-xl border-2 border-amber-400/70 bg-slate-900/95 p-3 shadow-2xl anim-glow">
      <div className="flex items-center justify-between">
        <div className="font-display text-base text-amber-200">{g.tutStep + 1}/{TUT.length} · {s.title}</div>
        <button className="text-[11px] text-slate-400 underline hover:text-white" onClick={() => { g.tutSkip(); bump(); }}>Skip</button>
      </div>
      <div className="mt-1 text-[13px] leading-snug text-slate-200">{s.body}</div>
      {s.cond === 'next' ? <div className="mt-2"><Btn small kind="primary" onClick={() => { g.tutNext(); bump(); }}>{g.tutStep === TUT.length - 1 ? 'Finish' : 'Next'}</Btn></div> : <div className="mt-2 text-[11px] font-semibold text-emerald-300">▶ Do it to continue…</div>}
    </div>
  );
}
