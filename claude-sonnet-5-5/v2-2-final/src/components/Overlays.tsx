import { useState } from 'react';
import { Btn, Modal, Stat } from './ui';
import { audio } from '../game/audio';
import { CREW, CREW_KINDS, DIFFS, MODS, fmt } from '../game/data';
import type { DiffId, ModId } from '../game/data';
import type { Campaign, Settings } from '../game/meta';
import { deadline } from '../game/meta';

const PAGES = ['The Job', 'Planning', 'Execution', 'Systems', 'Controls'];

export function Help({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState(0);
  const B = ({ children }: { children: React.ReactNode }) => <b style={{ color: '#ffd35c' }}>{children}</b>;
  return (
    <Modal title="Syndicate Field Manual" onClose={onClose} wide>
      <div className="flex gap-2 flex-wrap mb-4">{PAGES.map((n, i) => <Btn key={n} sm on={p === i} onClick={() => setP(i)}>{i + 1}. {n}</Btn>)}</div>
      <div className="text-sm leading-relaxed space-y-3 min-h-[300px]">
        {p === 0 && (<>
          <p>You run the <B>Meridian Heist Syndicate</B>. Each day you pick a contract, case the building, <B>draw a plan on the blueprint</B> for every crew member, then watch it play out <B>in real time</B>.</p>
          <p>Steal the <B>★ target</B> and get it to the 🚐 van to be paid. Everything else you grab goes to your stash and is sold through <B>fences</B> whose prices swing every day.</p>
          <p>Every alarm raises your campaign-wide <B>Heat</B>. High heat means more guards, tougher cameras, faster cops and worse fence rates. At 100 heat the syndicate is raided and the run is over.</p>
          <p><B>Win:</B> after 6 successful jobs, the <B>Meridian Vault</B> contract appears. Pull it off before the deadline (day 38 / 32 / 27 on Rookie / Professional / Mastermind). <B>Lose:</B> raid, bankruptcy, or the vault closing.</p>
        </>)}
        {p === 1 && (<>
          <p>Select a crew member (click them, their card, or press <B>1-5</B>) and click the map to give orders. Each order shows as a numbered marker on their route.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><B>Click floor</B>: Move. <B>Click an item</B>: steal / hack / crack it. <B>Click a door</B>: unlock it (amber = lockpick/breach, pink = keycard).</li>
            <li><B>Sprint</B> tool: faster but noisy and easier to spot. <B>Ambush</B> tool: lie in wait and silently take down a guard who walks past.</li>
            <li><B>Wait / Signal A-B-C / Await A-B-C</B>: sync your crew. The Hacker loops cameras, <i>signals A</i>, and the Ghost <i>awaits A</i> before walking in.</li>
            <li><B>Face</B> can Disguise (guards barely notice) and Spoof Radio (hides missed check-ins).</li>
            <li>Right-click or <B>Backspace</B> removes the last order. After the last order, crew auto-head to the van.</li>
            <li><B>Casing</B> reveals more intel: level 1 shows cameras, lasers, terminals and loot. Level 2 adds guard patrols and live guard tracking.</li>
            <li><B>Rehearsal</B> runs your plan on a copy of the job for a small fee so you can iterate.</li>
          </ul>
        </>)}
        {p === 2 && (<>
          <p>Once you press <B>EXECUTE</B>, your crew follow their orders. You can still intervene:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><B>Bail (B)</B>: everyone sprints for the van. Click a crew card's <B>Bail</B> to pull out one person.</li>
            <li><B>Gadgets (1-4)</B>: arm one, then click the map within 13 tiles of any crew: Smoke, EMP, Noise Decoy, Tranq Dart.</li>
            <li><B>Space</B> pauses. Speed buttons give 1x / 2x / 4x.</li>
          </ul>
          <p>Guards fill an <B>awareness ring</B> when they see someone. Full ring = spotted. Cameras do the same. Sounds travel as dotted rings and pull guards over. Unconscious guards that are not found miss their <B>radio check-in</B> after ~24s.</p>
          <p>Alert levels: <B>Alert</B> (guards investigate) → <B>Alarm</B> (everyone hunts; police call in 20s - the Hacker can cut the <B>Alarm Panel</B>) → <B>Police en route</B> → <B>SWAT arrives</B>. Get out before they trap you.</p>
        </>)}
        {p === 3 && (<>
          <ul className="list-disc pl-5 space-y-2">
            <li><B>Crew</B>: Ghost (lockpicks, quiet), Hacker (electronics), Safecracker (safes, vault), Muscle (carry, breach, brawl), Face (disguise, radio spoof). Train them to level 3 for speed, skill and HP.</li>
            <li><B>Arrests</B>: caught crew sit in custody for 3 days, or you pay bail. On <i>Iron Crew</i> they are gone forever.</li>
            <li><B>Heat</B> decays daily (Safehouse speeds this up). Bribe the commissioner or Lay Low to cool off.</li>
            <li><B>Fences</B>: Vey loves art and relics, Tito pays well for jewels and gold, the Broker takes anything (data!) and ignores heat. Dumping many of one type depresses the price. <i>Hot</i> loot from noisy jobs sells at -30% for 3 days.</li>
            <li><B>Syndicate upgrades</B>: garage (slower cops), intel (cheaper casing), lawyer (cheaper bail), workshop (cheaper gadgets), safehouse (faster cooldown).</li>
          </ul>
        </>)}
        {p === 4 && (
          <table className="w-full text-sm">
            <tbody>
              {[['Left click', 'Select crew / add order / deploy gadget'], ['Right click / Backspace', 'Remove last order'], ['1 - 5', 'Select crew (planning)'], ['Tab', 'Next crew member'], ['S / A', 'Toggle Sprint / Ambush tool'], ['Enter', 'Execute plan'], ['Space', 'Pause / resume (heist)'], ['B', 'Bail: everyone to the van'], ['1 - 4 (heist)', 'Arm gadget'], ['F', 'Cycle speed 1x/2x/4x'], ['Esc', 'Pause menu / cancel gadget'], ['Touch', 'Tap works like left click; use on-screen buttons for the rest']].map(([k, v]) => (
                <tr key={k} className="border-b" style={{ borderColor: 'rgba(43,91,148,0.4)' }}><td className="py-1.5 pr-4 font-semibold" style={{ color: '#6ee7ff' }}>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export function SettingsModal({ s, onChange, onClose }: { s: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const row = (label: string, key: 'master' | 'music' | 'sfx') => (
    <label className="flex items-center gap-3 text-sm"><span className="w-28 uppercase text-xs tracking-wider opacity-80">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => onChange({ ...s, [key]: parseFloat(e.target.value) })} className="flex-1" /><span className="w-10 text-right">{Math.round(s[key] * 100)}%</span></label>
  );
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-4">
        {row('Master', 'master')}{row('Music', 'music')}{row('Effects', 'sfx')}
        <div className="flex flex-wrap gap-2 pt-2">
          <Btn on={s.muted} onClick={() => onChange({ ...s, muted: !s.muted })}>{s.muted ? '🔇 Muted' : '🔊 Sound On'}</Btn>
          <Btn on={s.shake} onClick={() => onChange({ ...s, shake: !s.shake })}>Screen Shake: {s.shake ? 'On' : 'Off'}</Btn>
          <Btn on={s.hints} onClick={() => onChange({ ...s, hints: !s.hints })}>Hints: {s.hints ? 'On' : 'Off'}</Btn>
          <Btn onClick={() => audio.sfx('alert')}>Test Sound</Btn>
        </div>
        <div className="text-xs opacity-60">Settings are saved to this browser. Audio is fully synthesized (Web Audio).</div>
      </div>
    </Modal>
  );
}

export function NewGame({ onStart, onClose }: { onStart: (d: DiffId, m: ModId[]) => void; onClose: () => void }) {
  const [d, setD] = useState<DiffId>('pro'); const [m, setM] = useState<ModId[]>([]);
  const toggle = (id: ModId) => setM((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <Modal title="New Syndicate" onClose={onClose} wide>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {(Object.keys(DIFFS) as DiffId[]).map((k) => (
          <button key={k} onClick={() => { audio.sfx('select'); setD(k); }} className={`panel p-3 text-left transition ${d === k ? 'ring-2 ring-[#ffb347]' : 'opacity-80 hover:opacity-100'}`}>
            <div className="noir text-lg text-white">{DIFFS[k].name}</div><div className="text-xs opacity-80 mb-2">{DIFFS[k].blurb}</div>
            <Stat label="Start cash" value={fmt(DIFFS[k].cash)} /><Stat label="Guard sight" value={`${Math.round(DIFFS[k].vis * 100)}%`} /><Stat label="Heat gain" value={`${Math.round(DIFFS[k].heat * 100)}%`} /><Stat label="Payouts" value={`${Math.round(DIFFS[k].pay * 100)}%`} /><Stat label="Vault deadline" value={`Day ${DIFFS[k].deadline}`} />
          </button>
        ))}
      </div>
      <div className="panel-h mb-2">Modifiers (more payout)</div>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {MODS.map((x) => (
          <button key={x.id} onClick={() => { audio.sfx('click'); toggle(x.id); }} className={`panel p-3 text-left ${m.includes(x.id) ? 'ring-2 ring-[#6ee7ff]' : 'opacity-75'}`}>
            <div className="font-semibold text-white">{m.includes(x.id) ? '☑' : '☐'} {x.name}</div><div className="text-xs opacity-80">{x.desc}</div><div className="text-xs mt-1" style={{ color: '#5cf0a8' }}>+{Math.round(x.pay * 100)}% payouts</div>
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={() => onStart(d, m)}>Start Syndicate</Btn></div>
    </Modal>
  );
}

export function EndScreen({ kind, title, text, camp, onRestart, onTitle, onContinue }: {
  kind: 'victory' | 'loss'; title: string; text: string; camp: Campaign; onRestart: () => void; onTitle: () => void; onContinue?: () => void;
}) {
  const win = kind === 'victory';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto" style={{ background: win ? 'radial-gradient(circle at 50% 30%,#3b2f0a,#050d1c 70%)' : 'radial-gradient(circle at 50% 30%,#3a0a14,#050d1c 70%)' }}>
      <div className="panel rise max-w-2xl w-full p-6 text-center">
        <div className="text-6xl mb-2">{win ? '💠' : '🚔'}</div>
        <div className="stamp noir text-4xl sm:text-5xl mb-2" style={{ color: win ? '#ffd35c' : '#ff4d5e' }}>{title}</div>
        <p className="text-sm opacity-90 mb-4">{win ? 'The Meridian Star glitters in your hands. The syndicate becomes legend.' : text}</p>
        <div className="panel p-3 text-left grid grid-cols-2 gap-x-6 mb-4">
          <Stat label="Days played" value={camp.day} /><Stat label="Jobs done" value={`${camp.stats.wins}/${camp.stats.jobs}`} />
          <Stat label="Total stolen" value={fmt(camp.stats.stolen)} color="#ffd35c" /><Stat label="Fenced" value={fmt(camp.stats.sold)} color="#5cf0a8" />
          <Stat label="Ghost runs" value={camp.stats.ghosts} /><Stat label="Alarms raised" value={camp.stats.alarms} />
          <Stat label="Crew arrests" value={camp.stats.arrests} /><Stat label="Takedowns" value={camp.stats.takedowns} />
          <Stat label="Cash" value={fmt(camp.cash)} /><Stat label="Final heat" value={Math.round(camp.heat)} />
          <Stat label="Deadline" value={`Day ${deadline(camp)}`} /><Stat label="Crew roster" value={camp.crew.map((m) => CREW[m.kind].icon).join(' ') || '-'} />
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          {win && onContinue && <Btn variant="primary" onClick={onContinue}>Keep Playing (Free Play)</Btn>}
          <Btn variant={win ? '' : 'primary'} onClick={onRestart}>New Syndicate</Btn><Btn variant="ghost" onClick={onTitle}>Title Screen</Btn>
        </div>
      </div>
    </div>
  );
}

export const CREW_ORDER = CREW_KINDS;
