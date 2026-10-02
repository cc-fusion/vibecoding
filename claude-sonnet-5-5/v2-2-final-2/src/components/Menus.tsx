import { useState } from 'react';
import type { Campaign, Mods, Settings } from '../game/types';
import { DIFF_DESC, DIFF_NAMES, MOD_INFO, HEISTS } from '../game/data';
import { audio } from '../game/audio';
import { completed } from '../game/store';
import { Btn, Modal, Panel, money } from './ui';

export function Title({ save, onNew, onContinue, onHelp, onSettings }: { save: Campaign | null; onNew: () => void; onContinue: () => void; onHelp: () => void; onSettings: () => void }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050d1c] flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 500">
        <defs>
          <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1d4f8f" strokeWidth="0.5" opacity="0.5" /></pattern>
          <radialGradient id="v" cx="50%" cy="50%" r="70%"><stop offset="40%" stopColor="#050d1c" stopOpacity="0" /><stop offset="100%" stopColor="#050d1c" stopOpacity="1" /></radialGradient>
        </defs>
        <rect width="800" height="500" fill="url(#g)" />
        <g fill="none" stroke="#7ec8ff" strokeWidth="2" opacity="0.7">
          <path d="M120 120H340V250H120Z M340 180H520V320H340Z M520 120H700V260H520Z M200 250V380H460V320 M520 260V380H660" />
          <path d="M340 190H322 M340 230H322" stroke="#fbbf24" />
        </g>
        <g>
          <circle r="5" fill="#fbbf24"><animateMotion dur="9s" repeatCount="indefinite" path="M130 130H330V240H130Z" /></circle>
          <circle r="5" fill="#a78bfa"><animateMotion dur="7s" repeatCount="indefinite" path="M350 190H510V310H350Z" /></circle>
          <circle r="5" fill="#f87171"><animateMotion dur="11s" repeatCount="indefinite" path="M530 130H690V250H530Z" /></circle>
          <path d="M520 190L440 120L440 260Z" fill="#fbbf24" opacity="0.12"><animateTransform attributeName="transform" type="rotate" values="-10 520 190;10 520 190;-10 520 190" dur="6s" repeatCount="indefinite" /></path>
        </g>
        <rect width="800" height="500" fill="url(#v)" />
      </svg>
      <div className="relative z-10 text-center px-4 w-full max-w-xl">
        <div className="text-cyan-400 tracking-[0.5em] text-xs mb-2">A BLUEPRINT CRIME SIMULATION</div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-none" style={{ textShadow: '0 0 30px rgba(34,211,238,0.5)' }}>
          MERIDIAN<br /><span className="text-amber-400">HEIST</span> SYNDICATE
        </h1>
        <p className="mt-4 text-slate-300 text-sm sm:text-base">Plan it on paper. Watch it burn in real time. Fence the take. Stay one step ahead of the heat.</p>
        <div className="mt-8 flex flex-col gap-3 items-stretch max-w-xs mx-auto">
          {save && !save.over && <Btn variant="gold" className="py-3 text-base" onClick={onContinue}>▶ Continue · Day {save.day} · {money(save.cash)} · {completed(save)}/{HEISTS.length} jobs</Btn>}
          <Btn variant="primary" className="py-3 text-base" onClick={onNew}>New Campaign</Btn>
          <div className="flex gap-3"><Btn className="flex-1" onClick={onHelp}>How to Play</Btn><Btn className="flex-1" onClick={onSettings}>Settings</Btn></div>
        </div>
        <div className="mt-6 text-xs text-slate-500">Mouse / touch to plan · Space pause · 1-5 select crew · Esc menu</div>
      </div>
    </div>
  );
}

export function NewGame({ onStart, onBack }: { onStart: (d: 0 | 1 | 2, m: Mods) => void; onBack: () => void }) {
  const [d, setD] = useState<0 | 1 | 2>(1);
  const [m, setM] = useState<Mods>({ iron: false, hot: false, fuse: false });
  return (
    <div className="min-h-screen w-full bg-[#050d1c] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <h2 className="text-3xl font-black text-white mb-1">Set Up Your Syndicate</h2>
        <p className="text-slate-400 mb-4 text-sm">Choose how hard the city fights back. You can change difficulty later in Settings.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {DIFF_NAMES.map((n, i) => (
            <button key={n} onClick={() => { audio.play('click'); setD(i as 0 | 1 | 2); }} className={`text-left p-4 rounded-lg border transition ${d === i ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-600'}`}>
              <div className="text-lg font-bold text-white">{['🌱', '🕶️', '💀'][i]} {n}</div>
              <div className="text-xs text-slate-400 mt-1">{DIFF_DESC[i]}</div>
            </button>
          ))}
        </div>
        <h3 className="mt-5 mb-2 text-xs uppercase tracking-widest text-cyan-300">Optional Modifiers</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(MOD_INFO) as (keyof Mods)[]).map(k => (
            <button key={k} onClick={() => { audio.play('click'); setM({ ...m, [k]: !m[k] }); }} className={`text-left p-3 rounded-lg border transition ${m[k] ? 'border-red-400 bg-red-500/10' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-600'}`}>
              <div className="font-bold text-white">{MOD_INFO[k].icon} {MOD_INFO[k].name} {m[k] ? '✓' : ''}</div>
              <div className="text-xs text-slate-400 mt-1">{MOD_INFO[k].desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 flex gap-3"><Btn onClick={onBack}>← Back</Btn><Btn variant="gold" className="flex-1 py-2.5" onClick={() => onStart(d, m)}>Start Campaign</Btn></div>
      </div>
    </div>
  );
}

const PAGES: { t: string; body: React.ReactNode }[] = [
  { t: 'The Job', body: (<><p>You run a crew of specialists. Each job is a <b>two-phase heist</b>:</p><ol className="list-decimal ml-5 mt-2 space-y-1"><li><b>Plan</b> on the blueprint. Queue waypoints and actions for every crew member.</li><li><b>Execute</b> and watch it unfold in real time. Guards patrol, cameras sweep, alarms spread.</li><li><b>Fence</b> the loot, pay bail, upgrade the hideout, and keep the <b>Heat</b> down.</li></ol><p className="mt-2">Grab the <b>Prize</b> (👑 in the vault) and get back to the 🚐 van to complete a job. Beat all jobs, ending with <b>The Meridian Vault</b>, to win.</p></>) },
  { t: 'Planning', body: (<><ul className="list-disc ml-5 space-y-1"><li>Pick up to your crew-slot limit in the roster. Select a member to edit their plan.</li><li><b>Click floor</b> to add a waypoint. <b>Click a door / terminal / camera / safe / loot</b> to queue an interaction. <b>Click the van</b> to extract.</li><li><b>Sneak</b> is slow and quiet, <b>Run</b> is fast and loud (and ignores laser timing).</li><li><b>Signals</b> A/B/C synchronise crew: one sends, others <i>await</i>. Awaits time out after 45s.</li><li>Specials: Hacker <b>Jam</b>, Safecracker <b>Charge</b> (stand near a door or safe first), Muscle/Shadow <b>Ambush</b>, Face <b>Distract</b>.</li><li>Buy <b>Casing</b> intel to reveal cameras, lasers and loot; buy <b>Inside Man</b> to reveal guard routes.</li><li>Unskilled crew can still force locks, but slower, louder and risking a tamper alarm.</li></ul></>) },
  { t: 'Execution', body: (<><ul className="list-disc ml-5 space-y-1"><li>Select a crew card (or press <b>1-5</b>) to enter <b>Focus</b>: time slows. Click the map to issue an <b>Improvise</b> order (costs 1 pip; pips slowly regenerate).</li><li>Gadgets are free to use: pick a gadget, then click the map while a crew member is selected.</li><li><b>Space</b> pauses. <b>F</b> cycles 1x/2x/4x speed. <b>Abort</b> sends everyone running to the van.</li><li>Guards fill a suspicion bar when they see you. Full bar = alert. An alerted guard radios in after 2s unless you take them out.</li><li>Alarm level rises from spotted crew, bodies, lasers and noise. At 100% the <b>police ETA</b> starts. When cops arrive the van only waits 25 more seconds.</li></ul></>) },
  { t: 'Systems', body: (<><ul className="list-disc ml-5 space-y-1"><li><b>Crew:</b> five specialties, levels, perk points, traits. Arrests mean jail time and bail (or permanent loss on Iron Crew).</li><li><b>Alarm:</b> spreads as a red wave through hallways, redirecting guards. Tampered doors and bodies are noticed.</li><li><b>Heat:</b> campaign-wide. High heat adds guards, shortens police ETA and slashes fence prices. At 100 the Task Force raids you.</li><li><b>Fence market:</b> three fences with different rates, risk and saturation. Prices drift and react to events.</li><li><b>Hideout:</b> more crew slots, gadgets, improv, heat decay and a faster getaway.</li></ul></>) },
  { t: 'Controls', body: (<div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">{[['Click / Tap map', 'Add plan step / improvise order'], ['1 - 5', 'Select crew (execution)'], ['Space', 'Pause / resume'], ['F', 'Cycle game speed'], ['Esc', 'Cancel focus / pause menu'], ['Q', 'Toggle Sneak/Walk/Run while planning'], ['Z', 'Undo last plan step'], ['M', 'Mute audio']].map(([k, v]) => (<div key={k} className="contents"><div className="font-mono text-amber-300">{k}</div><div className="text-slate-300">{v}</div></div>))}</div>) },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState(0);
  return (
    <Modal title="How to Play" onClose={onClose} wide>
      <div className="flex gap-1 flex-wrap mb-3">{PAGES.map((pg, i) => <Btn key={pg.t} variant={i === p ? 'primary' : 'ghost'} onClick={() => setP(i)}>{pg.t}</Btn>)}</div>
      <div className="text-sm text-slate-200 leading-relaxed min-h-[220px]">{PAGES[p].body}</div>
      <div className="mt-4 flex justify-between"><Btn disabled={p === 0} onClick={() => setP(p - 1)}>← Prev</Btn><Btn variant="primary" onClick={() => (p < PAGES.length - 1 ? setP(p + 1) : onClose())}>{p < PAGES.length - 1 ? 'Next →' : 'Got it'}</Btn></div>
    </Modal>
  );
}

export function SettingsModal({ settings, onChange, camp, onDiff, onClose, onReset }: { settings: Settings; onChange: (s: Settings) => void; camp: Campaign | null; onDiff: (d: 0 | 1 | 2) => void; onClose: () => void; onReset?: () => void }) {
  const Slider = ({ label, k }: { label: string; k: 'master' | 'music' | 'sfx' }) => (
    <label className="flex items-center gap-3 text-sm"><span className="w-24 text-slate-300">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={e => onChange({ ...settings, [k]: parseFloat(e.target.value) })} className="flex-1 accent-cyan-400" />
      <span className="w-10 text-right text-slate-400">{Math.round(settings[k] * 100)}</span></label>
  );
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-3">
        <Slider label="Master" k="master" /><Slider label="Music" k="music" /><Slider label="Effects" k="sfx" />
        <div className="flex gap-2 flex-wrap">
          <Btn variant={settings.muted ? 'danger' : 'ghost'} onClick={() => onChange({ ...settings, muted: !settings.muted })}>{settings.muted ? '🔇 Muted' : '🔊 Sound On'}</Btn>
          <Btn variant={settings.shake ? 'primary' : 'ghost'} onClick={() => onChange({ ...settings, shake: !settings.shake })}>Screen Shake {settings.shake ? 'On' : 'Off'}</Btn>
        </div>
        <div className="text-sm text-slate-300">Default heist speed
          <div className="flex gap-2 mt-1">{[1, 2, 4].map(sp => <Btn key={sp} variant={settings.speedDefault === sp ? 'primary' : 'ghost'} onClick={() => onChange({ ...settings, speedDefault: sp })}>{sp}x</Btn>)}</div></div>
        {camp && (
          <Panel title="Difficulty (applies immediately)">
            <div className="flex gap-2 flex-wrap">{DIFF_NAMES.map((n, i) => <Btn key={n} variant={camp.diff === i ? 'gold' : 'ghost'} onClick={() => onDiff(i as 0 | 1 | 2)}>{n}</Btn>)}</div>
            <div className="text-xs text-slate-400 mt-2">{DIFF_DESC[camp.diff]}</div>
          </Panel>
        )}
        {onReset && <Btn variant="danger" onClick={onReset}>Abandon campaign &amp; delete save</Btn>}
      </div>
    </Modal>
  );
}
