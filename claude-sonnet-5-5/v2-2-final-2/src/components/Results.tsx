import type { Campaign, HeistDef, HeistResult } from '../game/types';
import type { ResultNotes } from '../game/store';
import { DIFF_NAMES, HEISTS, MOD_INFO } from '../game/data';
import { completed } from '../game/store';
import { Btn, Panel, money } from './ui';

const RC: Record<string, string> = { S: '#facc15', A: '#4ade80', B: '#38bdf8', C: '#fb923c', D: '#f87171', F: '#ef4444' };

export function Results({ r, notes, def, names, onContinue }: { r: HeistResult; notes: ResultNotes; def: HeistDef; names: Record<string, string>; onContinue: () => void }) {
  const bonus = r.bonuses.reduce((a, b) => a + b.amount, 0);
  const net = r.fee + bonus - r.salary;
  const stat = (k: string, v: string | number) => <div className="flex justify-between text-sm border-b border-slate-800 py-1"><span className="text-slate-400">{k}</span><b>{v}</b></div>;
  return (
    <div className="min-h-screen bg-[#060e1e] text-slate-100 p-3 flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <div className={`rounded-xl border p-4 mb-3 flex items-center gap-4 ${r.success ? 'border-emerald-500 bg-emerald-950/50' : 'border-red-500 bg-red-950/50'}`}>
          <div className="text-6xl font-black w-20 text-center" style={{ color: RC[r.rating] }}>{r.rating}</div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{def.name}</div>
            <div className={`text-3xl font-black ${r.success ? 'text-emerald-300' : 'text-red-300'}`}>{r.success ? 'JOB COMPLETE' : r.aborted ? 'JOB ABORTED' : 'JOB FAILED'}</div>
            <div className="text-sm text-slate-300">{r.success ? 'The prize is in the van. Time to get paid.' : r.loot.length ? 'The prize slipped away, but you kept some loot.' : 'You left empty-handed.'}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Panel title="Mission Stats">
            {stat('Time', `${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}`)}{stat('Loot value', money(r.lootValue))}{stat('Guards downed', r.guardsDowned)}{stat('Times spotted', r.spotted)}{stat('Alarm events', r.alarms)}{stat('Bodies found', r.bodiesFound)}
            {stat('Full alarm', r.fullAlarm ? 'Yes' : 'No')}{stat('Police arrived', r.police ? 'Yes' : 'No')}{stat('Ghost run', r.ghost ? 'Yes ✨' : 'No')}{def.captain && stat('Captain Voss', r.captainDown ? 'Defeated' : 'Standing')}
          </Panel>
          <Panel title="Payout">
            {stat('Contract fee', money(r.fee))}
            {r.bonuses.map(b => <div key={b.name} className="flex justify-between text-sm border-b border-slate-800 py-1"><span className="text-amber-200">★ {b.name}</span><b className="text-amber-300">+{money(b.amount)}</b></div>)}
            {stat('Crew salaries', '-' + money(r.salary))}
            <div className="flex justify-between text-lg mt-2"><span>Net</span><b className={net >= 0 ? 'text-emerald-300' : 'text-red-300'}>{money(net)}</b></div>
            <div className="text-xs text-slate-400 mt-2">Loot goes to your stash. Sell it at the Fence.</div>
            <div className="flex flex-wrap gap-1 mt-2">{r.loot.map((l, i) => <span key={i} title={`${l.name} ${money(l.value)}`} className="text-xl">{l.icon}</span>)}{!r.loot.length && <span className="text-sm text-slate-500">No loot</span>}</div>
          </Panel>
          <Panel title="Crew & Aftermath">
            {Object.keys(r.xp).map(id => <div key={id} className="flex justify-between text-sm border-b border-slate-800 py-1"><span>{names[id] || id} {r.arrested.includes(id) ? <span className="text-red-400">🔒 arrested</span> : r.extracted.includes(id) ? <span className="text-emerald-300">✓ out</span> : null}</span><b className="text-violet-300">+{r.xp[id]} XP</b></div>)}
            <div className="mt-2 space-y-1 text-sm">{notes.levelUps.map(l => <div key={l} className="text-amber-300">⬆ {l}</div>)}{notes.lines.map(l => <div key={l} className={l.includes('RAID') ? 'text-red-300 font-bold' : 'text-slate-300'}>{l}</div>)}</div>
          </Panel>
        </div>
        <div className="mt-4 flex justify-center"><Btn variant="gold" className="px-10 py-3 text-base" onClick={onContinue}>Continue →</Btn></div>
      </div>
    </div>
  );
}

function SummaryStats({ camp }: { camp: Campaign }) {
  const s = camp.stats;
  const rows: [string, string][] = [['Days elapsed', String(camp.day)], ['Jobs completed', `${completed(camp)}/${HEISTS.length}`], ['Heists run', String(s.heists)], ['Total earned', money(s.earned)], ['Loot hauled', money(s.loot)], ['Ghost runs', String(s.ghosts)], ['Guards downed', String(s.guards)], ['Arrests', String(s.arrests)], ['Raids survived', String(camp.raids)], ['Difficulty', DIFF_NAMES[camp.diff] + ((Object.keys(MOD_INFO) as (keyof typeof MOD_INFO)[]).filter(k => camp.mods[k]).map(k => ' + ' + MOD_INFO[k].name).join(''))]];
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-left">{rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-800 py-1"><span className="text-slate-400">{k}</span><b>{v}</b></div>)}</div>;
}

export function GameOver({ camp, onRetry, onTitle }: { camp: Campaign; onRetry: () => void; onTitle: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0508] to-black text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full text-center">
        <div className="text-6xl">🚔</div>
        <h1 className="text-5xl font-black text-red-500 tracking-tight mt-2">SYNDICATE BROKEN</h1>
        <p className="text-slate-300 mt-3">{camp.over}</p>
        <Panel title="Final Ledger" className="mt-5"><SummaryStats camp={camp} /></Panel>
        <div className="mt-5 flex gap-3 justify-center"><Btn variant="gold" className="px-6 py-2.5" onClick={onRetry}>↺ New Campaign</Btn><Btn onClick={onTitle}>Title</Btn></div>
      </div>
    </div>
  );
}

export function Victory({ camp, onContinue, onRetry }: { camp: Campaign; onContinue: () => void; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1b1503] via-[#0a1226] to-black text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full text-center">
        <div className="text-6xl">👑</div>
        <h1 className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight mt-2" style={{ textShadow: '0 0 30px rgba(251,191,36,0.5)' }}>THE MERIDIAN IS YOURS</h1>
        <p className="text-slate-300 mt-3">The vault is empty, the diamond is in your pocket, and the city will talk about this night for decades. The Syndicate is legend.</p>
        <Panel title="Legacy" className="mt-5"><SummaryStats camp={camp} /></Panel>
        <div className="mt-5 flex gap-3 justify-center flex-wrap"><Btn variant="gold" className="px-6 py-2.5" onClick={onContinue}>Continue Free Play</Btn><Btn variant="primary" onClick={onRetry}>New Campaign</Btn></div>
      </div>
    </div>
  );
}
