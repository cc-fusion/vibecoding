import { useState } from 'react';
import { DIFFS, DiffId, LOOT, MODS, ModId, ARCH } from '../game/data';
import { EndReason, Meta, Summary } from '../game/meta';
import { audio } from '../game/audio';
import { money, Toggle } from './common';

export function Title({ hasSave, onContinue, onNew, onTutorial, onHelp, onSettings }: { hasSave: boolean; onContinue: () => void; onNew: () => void; onTutorial: () => void; onHelp: () => void; onSettings: () => void }) {
  const B = ({ children, onClick, gold }: { children: React.ReactNode; onClick: () => void; gold?: boolean }) => (
    <button className={`btn w-full !py-2.5 text-lg ${gold ? 'btn-gold' : ''}`} onClick={() => { audio.init(); audio.startMusic(); audio.sfx('select'); onClick(); }}>{children}</button>
  );
  return (
    <div className="blueprint-bg scanlines relative flex h-full w-full items-center justify-center overflow-hidden p-4">
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <style>{`@keyframes dash{to{stroke-dashoffset:-200}} @keyframes sweep{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(30deg)}} .d{animation:dash 6s linear infinite} .sw{transform-origin:640px 120px;animation:sweep 5s ease-in-out infinite}`}</style>
        <g fill="none" stroke="#38bdf8" strokeOpacity=".35" strokeWidth="3">
          <rect x="60" y="60" width="680" height="380" /><path d="M300 60V250M300 250H60M520 60V300M520 300H740M300 340V440M60 340H300" />
        </g>
        <path className="d" d="M90 420 L90 300 L250 300 L250 150 L420 150 L420 100 L640 100" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="14 10" />
        <g className="sw"><path d="M640 120 L560 220 L720 220 Z" fill="#f87171" fillOpacity=".25" /></g>
        <circle cx="640" cy="120" r="9" fill="#ef4444" />
      </svg>
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="font-display text-sm tracking-[0.5em] text-sky-300/80">THE PLAN IS EVERYTHING</div>
        <h1 className="flicker font-display text-5xl font-bold leading-none tracking-wider text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.5)] sm:text-6xl">MERIDIAN<br />HEIST SYNDICATE</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-400">Blueprint the job. Brief the crew. Then watch it all go to plan... or horribly wrong.</p>
        <div className="mt-6 space-y-2">
          {hasSave && <B gold onClick={onContinue}>▶ Continue Campaign</B>}
          <B gold={!hasSave} onClick={onNew}>New Campaign</B>
          <B onClick={onTutorial}>🎓 Training Run</B>
          <div className="grid grid-cols-2 gap-2"><B onClick={onHelp}>❓ Field Manual</B><B onClick={onSettings}>⚙️ Settings</B></div>
        </div>
        <div className="mt-4 text-xs text-slate-500">Keyboard / mouse / touch · Audio is synthesized live</div>
      </div>
    </div>
  );
}

export function NewGame({ onStart, onBack }: { onStart: (d: DiffId, mods: Record<ModId, boolean>) => void; onBack: () => void }) {
  const [d, setD] = useState<DiffId>('pro');
  const [mods, setMods] = useState<Record<ModId, boolean>>({ iron: false, paranoid: false, lean: false });
  return (
    <div className="blueprint-bg h-full w-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <h2 className="font-display text-3xl font-bold text-amber-200">New Campaign</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(DIFFS) as DiffId[]).map(k => (
            <button key={k} className={`btn !text-left !normal-case ${d === k ? 'btn-on' : ''}`} onClick={() => { audio.sfx('click'); setD(k); }}>
              <div className="font-display text-xl uppercase">{DIFFS[k].name}</div>
              <div className="text-xs text-slate-300">{DIFFS[k].desc}</div>
              <div className="mt-1 text-xs text-amber-300">Start cash {money(DIFFS[k].cash)}</div>
            </button>
          ))}
        </div>
        <div className="panel p-3">
          <div className="mb-2 font-display text-xl text-sky-200">Modifiers (optional)</div>
          <div className="space-y-1">
            {(Object.keys(MODS) as ModId[]).map(k => <Toggle key={k} on={mods[k]} onChange={v => setMods(m => ({ ...m, [k]: v }))} label={`${MODS[k].icon} ${MODS[k].name} - ${MODS[k].desc}`} />)}
          </div>
        </div>
        <div className="panel p-3 text-sm text-slate-300">
          <b className="text-amber-200">Goal:</b> climb from street crew to Kingpin, then steal the <b>Meridian Core</b> from the Meridian Vault. Keep heat under 100, stay solvent, keep your crew alive.
        </div>
        <div className="flex justify-between">
          <button className="btn" onClick={() => { audio.sfx('click'); onBack(); }}>← Back</button>
          <button className="btn btn-gold !px-8 !py-2 text-xl" onClick={() => { audio.sfx('select'); onStart(d, mods); }}>Start →</button>
        </div>
      </div>
    </div>
  );
}

export function ResultScreen({ s, onContinue }: { s: Summary; onContinue: () => void }) {
  const r = s.result;
  const rankCol = s.rank === 'S' ? '#fde047' : s.rank === 'A' ? '#4ade80' : s.rank === 'B' ? '#38bdf8' : s.rank === 'C' ? '#fb923c' : '#f87171';
  return (
    <div className="blueprint-bg h-full w-full overflow-y-auto p-3 md:p-6">
      <div className="mx-auto max-w-4xl space-y-3 pop-in">
        <div className="panel flex items-center justify-between p-4">
          <div>
            <div className={`font-display text-4xl font-bold tracking-widest ${s.success ? 'text-emerald-300' : 'text-red-400'}`}>{s.tutorial ? (s.success ? 'TRAINING COMPLETE' : 'TRAINING FAILED') : s.success ? 'JOB COMPLETE' : 'JOB FAILED'}</div>
            <div className="text-sm text-slate-400">{s.tplName} · {r.reason} · {Math.floor(r.time / 60)}:{String(Math.floor(r.time % 60)).padStart(2, '0')}</div>
          </div>
          <div className="text-center"><div className="text-xs text-slate-400">RANK</div><div className="font-display text-7xl font-bold leading-none" style={{ color: rankCol, textShadow: `0 0 20px ${rankCol}` }}>{s.rank}</div></div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="panel p-3">
            <div className="mb-1 font-display text-xl text-sky-200">Take</div>
            <table className="w-full text-sm"><tbody>
              {!s.tutorial && <tr><td className="text-slate-400">Contract payout</td><td className="text-right text-emerald-300">{money(s.payout)}</td></tr>}
              {!s.tutorial && <tr><td className="text-slate-400">Cash loot (laundered)</td><td className="text-right text-emerald-300">{money(s.cashLoot)}</td></tr>}
              <tr><td className="text-slate-400">Goods to stash</td><td className="text-right text-amber-200">{money(s.stashed)}</td></tr>
              <tr><td className="text-slate-400">Reputation</td><td className="text-right text-sky-200">+{s.repGain}</td></tr>
              <tr><td className="text-slate-400">Heat</td><td className="text-right text-red-300">+{s.heatGain}</td></tr>
            </tbody></table>
            <div className="mt-2 flex flex-wrap gap-1 text-lg">{r.loot.map((l, i) => <span key={i} title={`${LOOT[l.kind].name} ${money(l.value)}`}>{LOOT[l.kind].icon}</span>)}{!r.loot.length && <span className="text-sm text-slate-500">Empty-handed.</span>}</div>
          </div>
          <div className="panel p-3">
            <div className="mb-1 font-display text-xl text-sky-200">Bonus objectives</div>
            {r.bonuses.map(b => <div key={b.id} className={`text-sm ${b.ok ? 'text-emerald-300' : 'text-slate-500'}`}>{b.ok ? '✔' : '✖'} {b.name} <span className="float-right">+{b.pct}%</span></div>)}
            <div className="mt-2 text-sm text-slate-400">Alarms: {r.stats.hard} hard / {r.stats.soft} soft · KOs: {r.stats.kos} · Hacks: {r.stats.hacks} · Doors: {r.stats.doors} · Safes: {r.stats.safes} · Gadgets: {r.stats.gadgets}</div>
          </div>
        </div>

        {!s.tutorial && (
          <div className="panel p-3">
            <div className="mb-1 font-display text-xl text-sky-200">Crew</div>
            <div className="grid gap-1 md:grid-cols-2">
              {s.crewXp.map(c => <div key={c.id} className="flex justify-between rounded bg-white/5 px-2 py-1 text-sm"><span>{c.arrested ? '⛓' : '✅'} {c.name}{c.lost ? ' (lost)' : ''}</span><span className="text-amber-200">+{c.xp} XP{c.level ? ` · LEVEL ${c.level}!` : ''}</span></div>)}
            </div>
          </div>
        )}
        {(s.log.length > 0 || s.leveled.length > 0) && <div className="panel p-3 text-sm text-slate-300">{[...s.leveled, ...s.log].map((l, i) => <div key={i}>• {l}</div>)}</div>}
        <div className="text-center"><button className="btn btn-gold !px-10 !py-2 text-xl" onClick={() => { audio.sfx('click'); onContinue(); }}>{s.won ? 'See the aftermath →' : s.tutorial ? 'Back →' : 'Return to hideout →'}</button></div>
      </div>
    </div>
  );
}

const END_TEXT: Record<Exclude<EndReason, null>, [string, string]> = {
  raid: ['TASK FORCE RAID', 'Heat hit 100. Armoured vans surround the safehouse before dawn. The Syndicate is finished.'],
  debt: ['LOAN SHARKS', 'You are over $1,000 in debt and the creditors have lost patience. The syndicate is dissolved.'],
  broke: ['NO CREW, NO CASH', 'There is nobody left to run a job and no money to hire anyone. The syndicate quietly disbands.'],
};

function StatsBlock({ meta }: { meta: Meta }) {
  const st = meta.stats;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-left text-sm sm:grid-cols-3">
      {([['Days survived', meta.day], ['Heists', `${st.success}/${st.heists}`], ['Total earned', money(st.earned)], ['Loot stolen', money(st.stolen)], ['Ghost runs', st.ghosts], ['Arrests', st.arrests], ['Alarms raised', st.alarms], ['Guards KO\'d', st.kos], ['Best score', money(st.best)]] as [string, string | number][]).map(([k, v]) => <div key={k}><span className="text-slate-400">{k}:</span> <b className="text-amber-200">{v}</b></div>)}
    </div>
  );
}

export function GameOver({ reason, meta, onRetry, onTitle }: { reason: Exclude<EndReason, null>; meta: Meta; onRetry: () => void; onTitle: () => void }) {
  const [t, d] = END_TEXT[reason];
  return (
    <div className="blueprint-bg scanlines relative flex h-full w-full items-center justify-center p-4">
      <div className="panel pop-in max-w-2xl space-y-4 p-6 text-center !border-red-500/60">
        <div className="font-display text-5xl font-bold tracking-widest text-red-400">GAME OVER</div>
        <div className="font-display text-2xl text-red-200">{t}</div>
        <p className="text-slate-300">{d}</p>
        <StatsBlock meta={meta} />
        <div className="text-xs text-slate-500">{Object.values(ARCH).length} specialists could not save you. Difficulty: {DIFFS[meta.diff].name}</div>
        <div className="flex justify-center gap-3"><button className="btn btn-gold" onClick={() => { audio.sfx('click'); onRetry(); }}>↻ New campaign</button><button className="btn" onClick={() => { audio.sfx('click'); onTitle(); }}>Title screen</button></div>
      </div>
    </div>
  );
}

export function Victory({ meta, onContinue, onTitle, onRetry }: { meta: Meta; onContinue: () => void; onTitle: () => void; onRetry: () => void }) {
  return (
    <div className="blueprint-bg scanlines relative flex h-full w-full items-center justify-center p-4">
      <div className="panel pop-in max-w-2xl space-y-4 p-6 text-center !border-amber-400/70 shadow-[0_0_60px_rgba(251,191,36,0.3)]">
        <div className="text-6xl">🔮</div>
        <div className="flicker font-display text-5xl font-bold tracking-widest text-amber-300">THE MERIDIAN CORE</div>
        <div className="font-display text-2xl text-emerald-300">IS YOURS</div>
        <p className="text-slate-300">The Warden is still searching the vault tower. By the time anyone notices, your crew is a rumour and the Syndicate belongs to you. You are the legend of the underworld.</p>
        <StatsBlock meta={meta} />
        <div className="flex flex-wrap justify-center gap-3"><button className="btn btn-gold" onClick={() => { audio.sfx('click'); onContinue(); }}>Keep playing (free roam)</button><button className="btn" onClick={() => { audio.sfx('click'); onRetry(); }}>New campaign</button><button className="btn" onClick={() => { audio.sfx('click'); onTitle(); }}>Title screen</button></div>
      </div>
    </div>
  );
}
