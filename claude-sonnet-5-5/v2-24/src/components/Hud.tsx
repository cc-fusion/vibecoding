import { TOOLS, TECHS, TECH_BY_ID, EVENT_INFO, SEASON_ICON } from '../game/data';
import type { Game, Snap } from '../game/engine';
import type { ToolId } from '../game/data';
import { Bar } from './ui';

function Stat({ icon, label, value, sub, bar, color, goal, warn }: { icon: string; label: string; value: string; sub?: string; bar?: number; color?: string; goal?: number; warn?: boolean }) {
  return (
    <div className={`flex min-w-[84px] flex-col gap-0.5 ${warn ? 'pulse-warn rounded-md' : ''}`} title={label}>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-extrabold tabular-nums">{value}</span>
        {sub && <span className="text-[10px] text-[var(--ink-dim)]">{sub}</span>}
      </div>
      {bar !== undefined && <Bar v={bar} color={color || 'var(--aqua)'} goal={goal} />}
    </div>
  );
}

export function TopBar({ s, onSpeed, onMenu, onTogglePanel }: { s: Snap; onSpeed: (n: number) => void; onMenu: () => void; onTogglePanel: () => void }) {
  const inc = s.income;
  return (
    <div className="panel m-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5">
      <div className="min-w-[120px]">
        <div className="font-display text-xs font-bold leading-none text-[var(--gold)]">{s.scName}</div>
        <div className="mt-0.5 text-sm font-bold leading-none">{SEASON_ICON[s.season]} {s.seasonName} · Yr {Math.min(s.year, s.years)}/{s.years}</div>
        <div className="mt-1"><Bar v={s.seasonProg} color="var(--gold)" /></div>
      </div>
      <Stat icon="🪙" label="Coin and net income per second" value={Math.floor(s.coins).toString()} sub={`${inc >= 0 ? '+' : ''}${inc.toFixed(1)}/s`} warn={s.debt} />
      <Stat icon="👥" label="Population / goal" value={Math.round(s.pop).toString()} sub={`/ ${s.goalPop}`} bar={s.pop / s.goalPop} color="#8ad07a" />
      <Stat icon="😊" label="Average happiness (goal marked)" value={Math.round(s.happy).toString()} sub={`goal ${s.goalHappy}`} bar={s.happy / 100} goal={s.goalHappy / 100} color={s.happy > 55 ? '#8ad07a' : s.happy > 35 ? '#f2d24a' : '#ef5a48'} />
      <Stat icon="💧" label="Water supplied vs demanded" value={`${Math.round(Math.min(1.2, s.ratio) * 100)}%`} sub="supply" bar={s.ratio} color={s.ratio > 0.8 ? 'var(--aqua)' : '#ef8a48'} warn={s.ratio < 0.5 && s.demand > 0.5} />
      <Stat icon="☣" label="Pollution of the sea" value={`${Math.round(s.pollution * 100)}%`} bar={s.pollution} color="#b5a040" />
      <Stat icon="✊" label="Unrest — 100% means revolt" value={`${Math.round(s.unrest)}%`} bar={s.unrest / 100} color="#ef5a48" warn={s.unrest > 60} />
      <Stat icon="★" label="Knowledge points" value={s.knowledgeInt.toString()} />
      <div className="ml-auto flex items-center gap-1">
        {[1, 2, 3].map(n => <button key={n} onClick={() => onSpeed(n)} className={`btn btn-sm !px-2 ${s.speed === n ? 'btn-gold' : 'btn-alt'}`}>{n}×</button>)}
        <button className="btn btn-sm btn-alt !px-2 md:hidden" onClick={onTogglePanel}>☰</button>
        <button className="btn btn-sm !px-2" onClick={onMenu} title="Pause (Space / Esc)">⏸</button>
      </div>
    </div>
  );
}

export function Palette({ game, s, onPick }: { game: Game; s: Snap; onPick: (t: ToolId) => void }) {
  const groups = ['Tools', 'Water', 'Sanitation', 'City'];
  return (
    <div className="panel scroll-thin m-1.5 flex shrink-0 gap-1 overflow-auto p-1.5 max-md:flex-row md:w-44 md:flex-col">
      {groups.map(gname => (
        <div key={gname} className="flex gap-1 max-md:flex-row md:flex-col">
          <div className="font-display hidden px-1 pt-1 text-[10px] uppercase tracking-widest text-[var(--gold)] md:block">{gname}</div>
          {TOOLS.filter(t => t.group === gname).map(t => {
            const unlocked = game.isUnlocked(t.id);
            const sel = s.tool === t.id;
            const cost = Math.ceil(t.cost * game.costMult);
            const afford = s.coins >= cost;
            return (
              <button key={t.id} onClick={() => onPick(t.id)} title={`${t.name} — ${t.desc}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs transition-colors max-md:min-w-[64px] max-md:flex-col max-md:gap-0 ${sel ? 'border-[var(--gold)] bg-[var(--terra)]/55' : 'border-white/10 bg-black/20 hover:bg-white/10'} ${unlocked ? '' : 'opacity-50'}`}>
                <span className="text-lg leading-none">{unlocked ? t.icon : '🔒'}</span>
                <span className="min-w-0 flex-1 max-md:text-center">
                  <span className="block truncate font-bold max-md:text-[10px]">{t.name}</span>
                  {t.cost > 0 && <span className={`block text-[10px] ${afford ? 'text-[var(--ink-dim)]' : 'text-[var(--bad)]'}`}>{t.id === 'bridge' ? `${cost}+` : cost}🪙</span>}
                </span>
                <span className="chip !px-1 !py-0 text-[9px] max-md:hidden">{t.key}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Objective({ ok, text }: { ok: boolean; text: string }) {
  return <div className={`flex items-center gap-1.5 text-sm ${ok ? 'text-[var(--good)]' : ''}`}><span>{ok ? '✔' : '○'}</span>{text}</div>;
}

export function SidePanel({ s, tab, setTab, onResearch, onOverlay, onRotate }: {
  s: Snap; tab: 'city' | 'tech' | 'log'; setTab: (t: 'city' | 'tech' | 'log') => void;
  onResearch: (id: string) => void; onOverlay: (o: 'none' | 'height' | 'health' | 'happy') => void; onRotate: () => void;
}) {
  const tool = TOOLS.find(t => t.id === s.tool)!;
  return (
    <div className="panel scroll-thin flex h-full w-full flex-col overflow-hidden">
      <div className="flex border-b border-white/10">
        {(['city', 'tech', 'log'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`font-display flex-1 py-1.5 text-xs font-bold uppercase tracking-wider ${tab === t ? 'bg-[var(--terra)]/50 text-[var(--gold)]' : 'text-[var(--ink-dim)] hover:bg-white/5'}`}>
            {t === 'city' ? '🏙 City' : t === 'tech' ? `★ Tech (${s.knowledgeInt})` : '📜 Log'}
          </button>
        ))}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2.5">
        {tab === 'city' && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-display text-xs uppercase tracking-widest text-[var(--gold)]">Objectives</div>
              <Objective ok={s.pop >= s.goalPop} text={`Population ${Math.round(s.pop)} / ${s.goalPop}`} />
              <Objective ok={s.happy >= s.goalHappy} text={`Happiness ${Math.round(s.happy)} ≥ ${s.goalHappy}`} />
              <Objective ok={s.bossDone} text={`Survive: ${s.boss.name}`} />
              {s.boss.state === 'wait' && <div className="text-xs text-[var(--ink-dim)]">Boss omen in about {Math.max(0, s.boss.secsTo - 52)} s.</div>}
              {s.boss.state === 'active' && <div className="mt-1"><Bar v={s.boss.prog} color="#ef5a48" /></div>}
              {s.winHold > 0 && <div className="mt-1 text-xs text-[var(--good)]">Holding goals… the Senate is impressed.</div>}
            </div>
            <div>
              <div className="font-display text-xs uppercase tracking-widest text-[var(--gold)]">Overlays</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {([['none', 'Off'], ['height', 'H Heights'], ['health', 'C Contagion'], ['happy', 'V Mood']] as const).map(([o, l]) => (
                  <button key={o} onClick={() => onOverlay(o)} className={`btn btn-sm !px-2 !text-[11px] ${s.overlay === o ? 'btn-gold' : 'btn-alt'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="rounded-md bg-black/25 p-2">
              <div className="font-bold">{tool.icon} {tool.name} <span className="chip">{tool.key}</span></div>
              <div className="mt-0.5 text-xs text-[var(--ink-dim)]">{tool.desc}</div>
              {tool.id === 'pump' && <button className="btn btn-sm btn-alt mt-1" onClick={onRotate}>↻ Rotate (R) — faces {['east', 'south', 'west', 'north'][s.pumpDir]}</button>}
            </div>
            <div>
              <div className="font-display text-xs uppercase tracking-widest text-[var(--gold)]">Inspector</div>
              {s.info.length ? s.info.map((l, i) => <div key={i} className={`text-xs ${i === 0 ? 'text-[var(--ink-dim)]' : ''}`}>{l}</div>) : <div className="text-xs text-[var(--ink-dim)]">Hover a tile to inspect it.</div>}
            </div>
            <div>
              <div className="font-display text-xs uppercase tracking-widest text-[var(--gold)]">Districts</div>
              {s.districts.length === 0 && <div className="text-xs text-[var(--ink-dim)]">No residents yet.</div>}
              {s.districts.map(d => (
                <div key={d.name} className="mt-1">
                  <div className="flex justify-between text-xs"><span>{d.name} <span className="text-[var(--ink-dim)]">· {Math.round(d.pop)} pop</span></span><span>{d.sick > 0.15 ? '🤢 ' : ''}{Math.round(d.happy)}</span></div>
                  <Bar v={d.happy / 100} color={d.happy > 55 ? '#8ad07a' : d.happy > 35 ? '#f2d24a' : '#ef5a48'} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[var(--ink-dim)]">
              <span>Water delivered</span><b className="text-right text-[var(--ink)]">{Math.round(s.stats.delivered)}</b>
              <span>Water wasted</span><b className="text-right text-[var(--ink)]">{Math.round(s.stats.wasted)}</b>
              <span>Floods</span><b className="text-right text-[var(--ink)]">{s.stats.floods}</b>
              <span>Deaths</span><b className="text-right text-[var(--ink)]">{Math.floor(s.stats.deaths)}</b>
              <span>Homes lost</span><b className="text-right text-[var(--ink)]">{s.stats.homesLost}</b>
            </div>
          </div>
        )}
        {tab === 'tech' && (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-[var(--ink-dim)]">Knowledge ★ <b className="text-[var(--ink)]">{s.knowledgeInt}</b> — it flows from your citizens. Techs reset each city.</div>
            {TECHS.map(t => {
              const done = s.techs.includes(t.id);
              const reqOk = t.req.every(r => s.techs.includes(r));
              const can = !done && reqOk && s.knowledgeInt >= t.cost;
              return (
                <div key={t.id} className={`rounded-md border p-1.5 ${done ? 'border-[var(--good)]/60 bg-[var(--good)]/10' : reqOk ? 'border-white/15 bg-black/20' : 'border-white/5 bg-black/30 opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-tight">{t.name}</div>
                      <div className="text-[11px] leading-tight text-[var(--ink-dim)]">{t.desc}</div>
                      {!reqOk && <div className="text-[10px] text-[var(--bad)]">Requires: {t.req.filter(r => !s.techs.includes(r)).map(r => TECH_BY_ID[r].name).join(', ')}</div>}
                    </div>
                    {done ? <span className="text-[var(--good)]">✔</span> : <button className="btn btn-sm !px-2" disabled={!can} onClick={() => onResearch(t.id)}>{t.cost}★</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'log' && (
          <div className="flex flex-col gap-1">
            {s.log.length === 0 && <div className="text-xs text-[var(--ink-dim)]">Quiet so far.</div>}
            {[...s.log].reverse().map(l => (
              <div key={l.id} className={`rounded px-1.5 py-1 text-xs ${l.kind === 'bad' ? 'bg-[var(--bad)]/15' : l.kind === 'good' ? 'bg-[var(--good)]/15' : l.kind === 'warn' ? 'bg-[var(--gold)]/15' : 'bg-black/20'}`}>{l.msg}</div>
            ))}
            <div className="mt-2 font-display text-xs uppercase tracking-widest text-[var(--gold)]">Event types</div>
            {Object.values(EVENT_INFO).map(e => <div key={e.name} className="text-[11px] text-[var(--ink-dim)]"><b className="text-[var(--ink)]">{e.icon} {e.name}:</b> {e.blurb}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export function OmenBar({ s }: { s: Snap }) {
  const items = [
    ...s.active.map(a => ({ key: `a${a.id}`, text: `${EVENT_INFO[a.kind].icon} ${EVENT_INFO[a.kind].name} — ${a.secs}s left`, hot: true, boss: a.boss })),
    ...s.pending.map(p => ({ key: `p${p.id}`, text: `${EVENT_INFO[p.kind].icon} ${EVENT_INFO[p.kind].name} in ${p.secs}s`, hot: p.secs < 8, boss: p.boss })),
  ];
  if (!items.length && s.boss.state === 'wait') return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex max-w-[92%] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5">
      {items.map(i => (
        <span key={i.key} className={`chip !text-xs font-bold shadow-lg ${i.boss ? '!border-[var(--bad)] !bg-[#4a1410]' : '!bg-[#2b2210]'} ${i.hot ? 'pulse-warn' : ''}`}>{i.boss ? '👹 ' : ''}{i.text}</span>
      ))}
    </div>
  );
}
