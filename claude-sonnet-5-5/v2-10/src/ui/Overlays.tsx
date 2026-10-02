import { useState } from 'react';
import type { Game } from '../game/engine';
import { ABIL } from '../game/engine';
import { DEFS, DEF_ORDER, KAIJU, RESEARCH, PERKS, DIFFS, MODS, MAX_DAY, INCIDENT_NAMES, fmtK } from '../game/data';
import type { KKind } from '../game/data';
import { audio } from '../game/audio';
import { Btn, Modal, Kbd, Chip, cx } from './common';

// ----------------------------------------------------------------- title
export function TitleScreen({ g, onNew, onPerks, onHelp, onSettings }: { g: Game; onNew: () => void; onPerks: () => void; onHelp: () => void; onSettings: () => void }) {
  const m = g.meta;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-slate-950/85 p-4 text-center">
      <div className="anim-pop max-w-2xl">
        <div className="font-serif text-xs uppercase tracking-[0.5em] text-amber-300/80">Claimsworth &amp; Doom Mutual presents</div>
        <h1 className="mt-2 font-serif text-4xl font-black leading-none tracking-tight text-amber-50 drop-shadow-[0_4px_0_rgba(190,18,60,0.6)] sm:text-6xl md:text-7xl">
          KAIJU <span className="text-rose-400">INSURANCE</span> ADJUSTER
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm italic text-slate-300 sm:text-base">
          “Giant monsters are not an act of God. They are an act of <b className="text-amber-300">Giant Lizard</b>, and that rider costs extra.”
        </p>
        <div className="mx-auto mt-6 flex w-64 flex-col gap-2.5 sm:w-72">
          <Btn variant="primary" className="py-3! text-lg!" onClick={onNew}>▶ New Campaign</Btn>
          <Btn onClick={onPerks}>🎖 Career Perks <span className="ml-1 rounded bg-violet-700 px-1.5 py-0.5 text-xs">{m.cp} CP</span></Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={onHelp}>❓ How to Play</Btn>
            <Btn onClick={onSettings}>⚙️ Settings</Btn>
          </div>
        </div>
        <div className="mx-auto mt-6 flex flex-wrap justify-center gap-2 text-[11px] text-slate-400">
          <Chip>Runs {m.runs}</Chip><Chip tone="green">Victories {m.wins}</Chip><Chip>Best score {m.bestScore.toLocaleString()}</Chip><Chip>Best incident {m.bestDay}</Chip><Chip tone="red">Kaiju slain {m.kills}</Chip>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">Predict the path · place defenses · order evacuations · adjudicate the claims. Keyboard, mouse &amp; touch.</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- setup
export function SetupModal({ g, onStart, onClose }: { g: Game; onStart: (diff: string, mods: string[]) => void; onClose: () => void }) {
  const [diff, setDiff] = useState('adjuster');
  const [mods, setMods] = useState<string[]>([]);
  const d = DIFFS.find((x) => x.id === diff)!;
  const mul = d.mul * mods.reduce((a, id) => a * (MODS.find((x) => x.id === id)?.mul ?? 1), 1);
  return (
    <Modal wide onClose={onClose}>
      <h2 className="font-serif text-2xl font-bold text-amber-200">Open a New Case File</h2>
      <p className="text-sm text-slate-400">Survive {MAX_DAY} incidents — ending with OMEGA — without going bankrupt or losing the public's trust.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {DIFFS.map((x) => {
          const locked = x.id === 'catastrophe' && !g.meta.unlockedCat;
          return (
            <button key={x.id} type="button" disabled={locked} onClick={() => { setDiff(x.id); audio.sfx('click'); }}
              className={cx('rounded-lg border p-3 text-left transition', diff === x.id ? 'border-amber-300 bg-amber-500/15' : 'border-slate-700 bg-slate-950/60 hover:bg-slate-800', locked && 'opacity-40')}>
              <div className="flex items-center justify-between"><span className="font-serif font-bold">{locked ? '🔒 ' : ''}{x.name}</span><span className="font-mono text-xs text-amber-300">×{x.mul} score</span></div>
              <div className="text-xs text-slate-400">{locked ? 'Win a campaign to unlock.' : x.desc}</div>
              <div className="mt-1 text-[10px] text-slate-500">Kaiju HP ×{x.hp} · start {fmtK(x.cash)} · income ×{x.income} · fraud ×{x.fraud}</div>
              {g.meta.bestByDiff[x.id] ? <div className="text-[10px] text-emerald-400">Best: {g.meta.bestByDiff[x.id].toLocaleString()}</div> : null}
            </button>
          );
        })}
      </div>
      <h3 className="mt-4 font-serif text-xs font-bold uppercase tracking-widest text-amber-300/90">Modifiers (optional)</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {MODS.map((x) => {
          const on = mods.includes(x.id);
          return (
            <button key={x.id} type="button" onClick={() => { setMods(on ? mods.filter((i) => i !== x.id) : [...mods, x.id]); audio.sfx('click'); }}
              className={cx('rounded-lg border p-2 text-left text-xs transition', on ? 'border-rose-400 bg-rose-500/15' : 'border-slate-700 bg-slate-950/60 hover:bg-slate-800')}>
              <div className="font-semibold">{on ? '☑' : '☐'} {x.name} <span className="text-amber-300">×{x.mul}</span></div>
              <div className="text-slate-400">{x.desc}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-300">Total score multiplier: <b className="font-mono text-amber-300">×{mul.toFixed(2)}</b></div>
        <div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Back</Btn><Btn variant="primary" onClick={() => onStart(diff, mods)}>Begin Incident 1 ▶</Btn></div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- help
export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('basics');
  const tabs = [['basics', 'The Job'], ['defenses', 'Defenses'], ['kaiju', 'Kaiju'], ['claims', 'Claims'], ['controls', 'Controls']];
  return (
    <Modal wide onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-amber-200">Adjuster's Handbook</h2>
        <Btn small variant="ghost" onClick={onClose}>✕ Close</Btn>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tabs.map(([id, label]) => <Btn key={id} small variant={tab === id ? 'primary' : 'ghost'} onClick={() => setTab(id)}>{label}</Btn>)}
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
        {tab === 'basics' && (
          <>
            <p>You run the catastrophe desk at <b>Claimsworth &amp; Doom Mutual</b>. Every incident is one day with four phases:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li><b className="text-amber-300">Briefing.</b> A kaiju approaches. The red cloud is a <i>forecast</i> of its path — its tightness depends on forecast accuracy (research, probes, weather). Place defenses on road/park tiles and order evacuations district by district.</li>
              <li><b className="text-amber-300">Incident.</b> Watch it unfold in real time. Use emergency actions (flares, air strikes, sirens). Coloured warning zones show where the monster strikes next.</li>
              <li><b className="text-amber-300">Claims.</b> Every damaged building files a claim. Pay honest, covered ones; trim padded ones; deny uncovered causes and phantoms. Fraud drains your capital; unfair denials drain public trust.</li>
              <li><b className="text-amber-300">Report.</b> Premiums arrive, repairs follow paid claims, research points accrue and tomorrow's conditions are announced.</li>
            </ol>
            <p><b className="text-emerald-300">Systems that interlock:</b> Trust → premium share &amp; evacuation compliance. Evacuation → casualties → trust. Defenses → upkeep → capital. Collateral from your own artillery → more claims. Kills → bounty &amp; research → better forecast, defenses and claim tools. Unpaid ruins become blight that bleeds trust.</p>
            <p><b className="text-rose-300">You lose</b> if trust hits 0, capital falls below −$400K, or the city loses 65% of its people. <b className="text-emerald-300">You win</b> by surviving incident {MAX_DAY}: OMEGA, Mother of Ruin. Afterwards you may keep going in Endless mode.</p>
            <p className="text-slate-400">Between runs you earn <b>Career Points</b> to buy permanent perks. Defeating the campaign unlocks the hardest difficulty.</p>
          </>
        )}
        {tab === 'defenses' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {DEF_ORDER.map((t) => (
              <div key={t} className="rounded-lg bg-slate-950/60 p-2.5">
                <div className="font-serif font-bold text-slate-100">{DEFS[t].icon} {DEFS[t].name} <span className="font-mono text-xs text-amber-300">{fmtK(DEFS[t].cost)}</span> <Kbd>{DEFS[t].key}</Kbd></div>
                <div className="text-xs">{DEFS[t].desc}</div>
                <div className="text-[11px] text-slate-500">Range {DEFS[t].range} · HP {DEFS[t].hp}{DEFS[t].req ? ' · requires research' : ' · available from start'}</div>
              </div>
            ))}
            {(Object.keys(ABIL) as (keyof typeof ABIL)[]).map((a) => (
              <div key={a} className="rounded-lg border border-amber-500/20 bg-slate-950/60 p-2.5">
                <div className="font-serif font-bold text-slate-100">{ABIL[a].icon} {ABIL[a].name} <span className="font-mono text-xs text-amber-300">{fmtK(ABIL[a].cost)}</span> <Kbd>{ABIL[a].key}</Kbd></div>
                <div className="text-xs">{ABIL[a].desc} (live, during incidents)</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'kaiju' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(KAIJU) as KKind[]).map((k) => (
              <div key={k} className="rounded-lg bg-slate-950/60 p-2.5">
                <div className="font-serif font-bold text-slate-100">{KAIJU[k].icon} {KAIJU[k].name} <span className="font-normal text-slate-400">— {KAIJU[k].title}</span></div>
                <div className="text-xs">{KAIJU[k].desc}</div>
                <div className="text-[11px] text-emerald-300/90">Weak to: {KAIJU[k].weak}</div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-700 p-2.5 text-xs sm:col-span-2">
              <b>Schedule:</b> {INCIDENT_NAMES.map((n, i) => `${i + 1}. ${n}`).join(' · ')}
            </div>
          </div>
        )}
        {tab === 'claims' && (
          <>
            <p>Each claim card shows the <b>claimed</b> amount, the aerial <b>assessed</b> amount (noisy), the cause, the policy riders, claim history and whether the building was in the kaiju path.</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b className="text-emerald-300">Approve</b> — pay what is claimed. Right for honest, covered claims.</li>
              <li><b className="text-slate-100">Settle</b> — pay the assessed value. Right for <i>inflated</i> claims (claimed ≫ assessed, repeat claimants).</li>
              <li><b className="text-rose-300">Deny</b> — pay nothing. Right for <i>uncovered</i> causes (fire/flood/quake without the rider) and <i>phantom</i> claims (intact photo, outside the path).</li>
              <li><b className="text-sky-300">Investigate</b> — spend capital and one daily token to reveal the truth.</li>
            </ul>
            <p>Correct decisions build a streak that boosts score. Wrongly denying an honest, covered claim costs 3 trust and risks a bad-faith lawsuit. Paying uncovered claims earns goodwill but burns capital.</p>
          </>
        )}
        {tab === 'controls' && (
          <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {[
              ['Mouse / touch', 'Click tiles to place; click buttons for everything else'],
              ['1–7', 'Select defense (briefing) · 1–3 emergency actions (incident)'],
              ['X', 'Sell tool / sell inspected defense'],
              ['F', 'Deploy seismic probe (briefing)'],
              ['Space / Enter', 'Launch incident · toggle 2× speed · next incident'],
              ['A / S / D', 'Approve / Settle / Deny claim'],
              ['I', 'Investigate claim'],
              ['R', 'Research department'],
              ['Esc / P', 'Cancel tool, else pause'],
              ['Right-click', 'Cancel current tool'],
              ['M', 'Mute / unmute'],
              ['H', 'This handbook'],
            ].map(([k, v]) => <div key={k} className="flex gap-2 border-b border-slate-800 py-1"><span className="w-28 shrink-0 font-mono text-amber-300">{k}</span><span>{v}</span></div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- settings
export function SettingsModal({ g, onClose }: { g: Game; onClose: () => void }) {
  const s = g.settings;
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => (
    <label className="block text-sm">
      <div className="flex justify-between"><span>{label}</span><span className="font-mono text-amber-300">{Math.round(s[key] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={s[key]} onChange={(e) => g.setSetting({ [key]: parseFloat(e.target.value) })} onPointerUp={() => audio.sfx('place')} className="w-full accent-amber-400" />
    </label>
  );
  const toggle = (label: string, on: boolean, fn: () => void) => (
    <button type="button" onClick={fn} className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm hover:bg-slate-800">
      <span>{label}</span><span className={cx('rounded px-2 py-0.5 font-mono text-xs', on ? 'bg-emerald-700' : 'bg-slate-700')}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
  return (
    <Modal onClose={onClose} z={60}>
      <h2 className="font-serif text-2xl font-bold text-amber-200">Settings</h2>
      <div className="mt-4 space-y-3">
        {slider('Master volume', 'master')}
        {slider('Music volume', 'music')}
        {slider('Effects volume', 'sfx')}
        {toggle('Mute all audio', s.muted, () => g.setSetting({ muted: !s.muted }))}
        {toggle('Screen shake', s.shake, () => g.setSetting({ shake: !s.shake }))}
        {toggle('Coaching tips', s.tips, () => g.setSetting({ tips: !s.tips }))}
        <div>
          <div className="mb-1 text-sm">Particle density</div>
          <div className="flex gap-2">
            {[[0.25, 'Low'], [0.6, 'Medium'], [1, 'High']].map(([v, l]) => (
              <Btn key={l as string} small variant={s.particles === v ? 'primary' : 'ghost'} className="flex-1" onClick={() => g.setSetting({ particles: v as number })}>{l}</Btn>
            ))}
          </div>
        </div>
        {g.status !== 'title' && <p className="text-xs text-slate-400">Current run: {g.diff.name}{g.mods.length ? ' + ' + g.mods.map((m) => MODS.find((x) => x.id === m)?.name).join(', ') : ''}. Difficulty is locked per run — restart from the pause menu to change it.</p>}
      </div>
      <div className="mt-5 text-right"><Btn variant="primary" onClick={onClose}>Done</Btn></div>
    </Modal>
  );
}

// ----------------------------------------------------------------- pause
export function PauseModal({ g, onResume, onHelp, onSettings, onRestart, onQuit }: { g: Game; onResume: () => void; onHelp: () => void; onSettings: () => void; onRestart: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState<null | 'restart' | 'quit'>(null);
  return (
    <Modal onClose={onResume}>
      <h2 className="text-center font-serif text-3xl font-bold text-amber-200">Paused</h2>
      <p className="mt-1 text-center text-xs text-slate-400">Incident {g.day} · {g.diff.name} · Score so far {g.score.toLocaleString()}</p>
      {!confirm ? (
        <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
          <Btn variant="primary" onClick={onResume}>▶ Resume</Btn>
          <Btn onClick={onHelp}>❓ Handbook</Btn>
          <Btn onClick={onSettings}>⚙️ Settings</Btn>
          <Btn variant="ghost" onClick={() => setConfirm('restart')}>↻ Restart campaign</Btn>
          <Btn variant="danger" onClick={() => setConfirm('quit')}>🚪 Resign &amp; return to title</Btn>
        </div>
      ) : (
        <div className="mx-auto mt-5 max-w-xs text-center">
          <p className="text-sm text-slate-300">{confirm === 'restart' ? 'Restart from Incident 1 with the same settings? Progress in this run is lost (Career Points for progress are awarded).' : 'Resign now? You keep Career Points earned so far.'}</p>
          <div className="mt-3 flex gap-2"><Btn className="flex-1" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn><Btn className="flex-1" variant="danger" onClick={confirm === 'restart' ? onRestart : onQuit}>Confirm</Btn></div>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------- research
export function ResearchModal({ g, onClose }: { g: Game; onClose: () => void }) {
  const branches = ['Forecast', 'Defense', 'Claims', 'Finance'];
  return (
    <Modal wide onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-amber-200">🔬 Research Department</h2>
        <div className="flex items-center gap-2"><Chip tone="blue">{g.rp} RP available</Chip><Btn small variant="ghost" onClick={onClose}>✕ Close</Btn></div>
      </div>
      <p className="text-xs text-slate-400">Earn RP daily (+2), from kills (+1) and via events. Research lasts for the whole run.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {branches.map((b) => (
          <div key={b} className="rounded-lg border border-slate-700 bg-slate-950/50 p-2.5">
            <div className="mb-2 font-serif text-xs font-bold uppercase tracking-widest text-amber-300/90">{b}</div>
            <div className="space-y-1.5">
              {RESEARCH.filter((r) => r.branch === b).map((r) => {
                const owned = g.has(r.id);
                const locked = !!r.req && !g.has(r.req);
                const afford = g.rp >= r.cost;
                const reqName = r.req ? RESEARCH.find((x) => x.id === r.req)?.name : '';
                return (
                  <div key={r.id} className={cx('flex items-center gap-2 rounded-md border p-2', owned ? 'border-emerald-600/60 bg-emerald-950/40' : 'border-slate-700 bg-slate-900/60')}>
                    <div className="text-xl">{r.icon}</div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-slate-400">{r.desc}</div>
                      {locked && <div className="text-[10px] text-rose-300">Requires {reqName}</div>}
                    </div>
                    {owned ? <Chip tone="green">✔ Done</Chip> : <Btn small variant={afford && !locked ? 'primary' : 'default'} disabled={!afford || locked} onClick={() => g.buyResearch(r.id)}>{r.cost} RP</Btn>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- perks
export function PerksModal({ g, onClose }: { g: Game; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-amber-200">🎖 Career Perks</h2>
        <Chip tone="blue">{g.meta.cp} CP</Chip>
      </div>
      <p className="text-xs text-slate-400">Permanent upgrades, saved on this device. Earn Career Points at the end of every run — more for deeper runs and victories.</p>
      <div className="mt-3 space-y-2">
        {PERKS.map((p) => {
          const lvl = g.perk(p.id);
          const cost = p.cost * (lvl + 1);
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 p-2.5">
              <div className="text-2xl">{p.icon}</div>
              <div className="flex-1 text-sm">
                <div className="font-semibold">{p.name} <span className="font-mono text-xs text-amber-300">{'●'.repeat(lvl)}{'○'.repeat(p.max - lvl)}</span></div>
                <div className="text-xs text-slate-400">{p.desc}</div>
              </div>
              {lvl >= p.max ? <Chip tone="green">MAX</Chip> : <Btn small variant="primary" disabled={g.meta.cp < cost} onClick={() => g.buyPerk(p.id)}>{cost} CP</Btn>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-right"><Btn onClick={onClose}>Close</Btn></div>
    </Modal>
  );
}

// ----------------------------------------------------------------- daily report
export function ReportModal({ g, onNext, onResearch }: { g: Game; onNext: () => void; onResearch: () => void }) {
  const r = g.rep;
  const line = (label: string, v: string, tone = 'text-slate-100') => (
    <div className="flex justify-between border-b border-slate-800 py-1 text-sm"><span className="text-slate-400">{label}</span><span className={cx('font-mono', tone)}>{v}</span></div>
  );
  const net = r.cashDelta;
  return (
    <Modal wide z={40}>
      <div className="text-center">
        <div className="font-serif text-[11px] uppercase tracking-[0.3em] text-amber-300/80">End of Day Report</div>
        <h2 className="font-serif text-2xl font-bold text-amber-100">Incident {r.day}: {r.day <= MAX_DAY ? INCIDENT_NAMES[r.day - 1] : 'Endless Calamity'}</h2>
        <div className="mt-1 text-sm text-slate-300">{r.kills > 0 ? `🏆 ${r.kills} kaiju slain` : '👣 The monster escaped'} · {r.destroyed} buildings destroyed · <span className={r.casualties ? 'text-rose-300' : 'text-emerald-300'}>{r.casualties} casualties</span> · {r.saved} lives saved by evacuations</div>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div>
          <h3 className="font-serif text-xs font-bold uppercase tracking-widest text-amber-300/90">Ledger</h3>
          {line('Premiums collected', '+' + fmtK(r.premiums), 'text-emerald-300')}
          {line('Kaiju bounties', '+' + fmtK(r.bounty), 'text-emerald-300')}
          {line('Claims paid', '−' + fmtK(r.payouts), 'text-rose-300')}
          {line('Defenses, evac & actions', '−' + fmtK(r.spent + r.evacCost), 'text-rose-300')}
          {line('Defense upkeep', '−' + fmtK(r.maintenance), 'text-rose-300')}
          {line('Net change today', (net >= 0 ? '+' : '') + fmtK(net), net >= 0 ? 'text-emerald-300' : 'text-rose-300')}
        </div>
        <div>
          <h3 className="font-serif text-xs font-bold uppercase tracking-widest text-amber-300/90">Operations</h3>
          {line('Claims decided correctly', `${r.claimsRight} / ${r.claimsTotal}`)}
          {line('Frauds caught or trimmed', String(r.fraudCaught), 'text-sky-300')}
          {line('Friendly-fire claims', String(r.collateral))}
          {line('Rebuilt after payouts', String(r.repaired), 'text-emerald-300')}
          {line('Blight (unpaid ruins)', String(r.blight), r.blight ? 'text-rose-300' : 'text-slate-100')}
          {line('Public trust', `${Math.round(g.trust)} (${r.trustDelta >= 0 ? '+' : ''}${r.trustDelta})`, r.trustDelta >= 0 ? 'text-emerald-300' : 'text-rose-300')}
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 p-2.5 text-sm text-amber-100">
        <b>Tomorrow — {r.event}.</b> {r.eventText}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Btn onClick={onResearch}>🔬 Research ({g.rp} RP) <Kbd>R</Kbd></Btn>
        <Btn variant="primary" onClick={onNext}>{g.day + 1 === MAX_DAY && !g.endless ? '⚠ Face OMEGA' : 'Next Incident'} ▶ <Kbd>Enter</Kbd></Btn>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- end screens
function rank(score: number) {
  return score >= 12000 ? 'S' : score >= 8000 ? 'A' : score >= 5000 ? 'B' : score >= 2500 ? 'C' : 'D';
}

export function EndModal({ g, onContinue, onRetry, onTitle, onPerks }: { g: Game; onContinue: () => void; onRetry: () => void; onTitle: () => void; onPerks: () => void }) {
  const won = g.status === 'won';
  const s = g.stats;
  const acc = s.decided ? Math.round((s.right / s.decided) * 100) : 0;
  const cell = (label: string, v: string | number) => (
    <div className="rounded-lg bg-slate-950/60 p-2 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="font-mono text-lg text-slate-100">{v}</div></div>
  );
  return (
    <Modal wide z={55}>
      <div className="text-center">
        <div className={cx('font-serif text-4xl font-black sm:text-5xl', won ? 'text-amber-300' : 'text-rose-400')}>{won ? 'POLICY RENEWED' : 'CLAIM DENIED'}</div>
        <div className="mt-1 text-sm text-slate-300">{g.endReason}</div>
        <div className="mx-auto mt-3 flex items-center justify-center gap-5">
          <div className={cx('flex h-20 w-20 items-center justify-center rounded-full border-4 font-serif text-5xl font-black', won ? 'border-amber-300 text-amber-300' : 'border-rose-500 text-rose-400')}>{rank(g.finalScore)}</div>
          <div className="text-left"><div className="text-xs uppercase tracking-widest text-slate-500">Final score</div><div className="font-mono text-3xl text-amber-200">{g.finalScore.toLocaleString()}</div><div className="text-xs text-slate-400">{g.diff.name} ×{(g.diff.mul * g.modMul()).toFixed(2)}</div></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cell('Incidents survived', s.incidents)}
        {cell('Kaiju slain', s.kills)}
        {cell('Casualties', s.casualties)}
        {cell('Lives saved', s.lives)}
        {cell('Buildings lost', s.destroyed)}
        {cell('Claims paid', fmtK(s.paid))}
        {cell('Fraud saved', fmtK(s.savedMoney))}
        {cell('Money wasted', fmtK(s.wasted))}
        {cell('Frauds caught', s.caught)}
        {cell('Claim accuracy', acc + '%')}
        {cell('Best streak', s.bestStreak)}
        {cell('Collateral hits', s.collateral)}
      </div>
      <div className="mt-3 text-center text-sm text-violet-300">🎖 +{g.cpGain} Career Points earned ({g.meta.cp} total){won && !g.meta.bestByDiff.catastrophe && g.diff.id !== 'catastrophe' ? ' · “Act of God” difficulty unlocked!' : ''}</div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {won && <Btn variant="primary" onClick={onContinue}>♾ Continue in Endless Mode</Btn>}
        <Btn variant={won ? 'default' : 'primary'} onClick={onRetry}>↻ {won ? 'New Campaign' : 'Try Again'}</Btn>
        <Btn onClick={onPerks}>🎖 Career Perks</Btn>
        <Btn variant="ghost" onClick={onTitle}>Title Screen</Btn>
      </div>
    </Modal>
  );
}
