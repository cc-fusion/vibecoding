import { ReactNode, useState } from 'react';
import { audio } from '../game/audio';
import { Settings } from '../game/meta';

export const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

export function Modal({ title, onClose, children, wide, z = 50 }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-3 fade-in" style={{ zIndex: z, background: 'rgba(2,6,14,0.82)', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`panel pop-in flex max-h-[92vh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-sky-500/25 px-4 py-2">
          <h2 className="font-display text-xl font-bold uppercase tracking-widest text-sky-200">{title}</h2>
          {onClose && <button className="btn !px-2 !py-0.5" onClick={() => { audio.sfx('click'); onClose(); }}>✕</button>}
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, color = '#38bdf8', h = 8, label }: { value: number; max?: number; color?: string; h?: number; label?: string }) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative w-full overflow-hidden rounded-sm bg-black/60" style={{ height: h }} title={label}>
      <div className="h-full transition-all duration-500" style={{ width: `${p * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`btn w-full !text-left ${on ? 'btn-on' : ''}`} onClick={() => { audio.sfx('click'); onChange(!on); }}>
      {on ? '☑' : '☐'} {label}
    </button>
  );
}

export function SettingsModal({ settings, onChange, onClose, extra }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; extra?: ReactNode }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  const slider = (label: string, k: 'master' | 'music' | 'sfx') => (
    <label className="block" key={k}>
      <div className="flex justify-between text-sm text-sky-200"><span>{label}</span><span>{Math.round(settings[k] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.05} value={settings[k]} className="w-full" onChange={e => set({ [k]: parseFloat(e.target.value) } as Partial<Settings>)} onPointerUp={() => audio.sfx('select')} />
    </label>
  );
  return (
    <Modal title="Settings" onClose={onClose} z={80}>
      <div className="space-y-3">
        {slider('Master volume', 'master')}
        {slider('Music', 'music')}
        {slider('Sound effects', 'sfx')}
        <Toggle on={settings.muted} onChange={v => set({ muted: v })} label="Mute all audio" />
        <Toggle on={settings.shake} onChange={v => set({ shake: v })} label="Screen shake" />
        <Toggle on={settings.reduceFlash} onChange={v => set({ reduceFlash: v })} label="Reduce flashing effects" />
        <div>
          <div className="mb-1 text-sm text-sky-200">Default heist speed</div>
          <div className="flex gap-2">{[1, 2, 4].map(s => <button key={s} className={`btn flex-1 ${settings.speed === s ? 'btn-on' : ''}`} onClick={() => set({ speed: s })}>{s}x</button>)}</div>
        </div>
        {extra}
        <button className="btn btn-gold w-full" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

const HELP: Record<string, ReactNode> = {
  Basics: (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      <p><b className="text-amber-300">The loop:</b> pick a contract on the job board, case the joint (optional recon), choose crew and gadgets, then <b>plan every move on the blueprint</b>. Press Execute and watch the plan unfold in real time. You can only intervene with limited tools: hold, skip, bail, and gadgets.</p>
      <p><b className="text-amber-300">Win the campaign</b> by stealing the Meridian Core from the Meridian Vault (unlocks at Kingpin rep, tier 4). <b className="text-red-300">You lose</b> if heat hits 100 (task-force raid), you sink more than $1,000 into debt, or you run out of crew and money.</p>
      <p>Each heist and each laid-low day costs a <b>day</b>: crew wages are paid, heat cools, the fence market moves and new contracts appear.</p>
    </div>
  ),
  Crew: (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      <p>Every specialist has five skills: <b>Stealth, Hacking, Locks, Muscle, Charm</b>. Skills set work speed, how visible they are, how much they can carry, and whether high-grade locks slow them.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>💻 <b>Hacker</b>: hacks remotely from 6 tiles, through walls.</li>
        <li>🗝️ <b>Locksmith</b>: silent, fast picks and safes.</li>
        <li>💪 <b>Muscle</b>: carries more, hides bodies, wins grapples, breaches doors, can stagger the Warden.</li>
        <li>🎭 <b>Grifter</b>: barely noticed, one free talk-down, long distractions.</li>
        <li>🥷 <b>Ghost</b>: ignores laser grids, runs quietly.</li>
      </ul>
      <p>Crew earn XP, level up, and give you skill points to spend in the Crew tab. Arrested crew sit in jail until released or bailed out (or are lost forever with Iron Crew).</p>
    </div>
  ),
  Planning: (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      <p>Select a crew member, pick a tool, and click the blueprint to append a step to their queue. Steps run in order. Different crew run in parallel, so use <b>Sync points</b> (🔗) to make them wait for each other, e.g. the Hacker loops cameras before the Ghost moves.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Move</b>: walk to a tile (Sneak is quiet and slow, Run is loud and fast).</li>
        <li><b>Interact</b>: click a door (pick), terminal/camera/panel (hack), safe or vault door (crack), loot (grab), or guard (takedown).</li>
        <li><b>Breach</b>: loudly smash a door open. <b>Distract</b>: hold nearby guards' attention. <b>Gadget</b>: throw a loadout item.</li>
        <li><b>Wait / Sync / Exit</b>: add instantly. Always end with Exit or the crew will linger.</li>
        <li><b>Recon</b> reveals cameras, lasers, panels, door grades, guards (L1) and patrol routes (L2).</li>
      </ul>
    </div>
  ),
  Security: (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      <p><b className="text-amber-300">Guards</b> have vision cones. Suspicion fills faster when you are close, running, in light, or skilled in nothing. A "?" means investigating; a "!" means they have you. An alerted guard must <b>radio it in</b> (1.5s). Jam the radio or hack the comms terminal and they must run to an <b>alarm panel</b> instead.</p>
      <p><b className="text-amber-300">Alarms propagate</b> room by room through doors (watch the red pulses). A soft alarm sends guards to investigate. A hard alarm starts the <b>police countdown</b>, seals the vault shutters, and brings reinforcements at the halfway point. When the clock hits zero everyone left inside is arrested.</p>
      <p><b>Threats:</b> guards, armoured heavies (need Muscle 3+ or a dart), cameras, lasers (pulse or solid), drones (EMP only), civilian witnesses (they scream), and the Warden (capstone boss; stagger only).</p>
      <p>Knocked-out guards wake up and bodies get discovered unless hidden. Dropped loot stays on the floor.</p>
    </div>
  ),
  Economy: (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      <p><b className="text-amber-300">Heat</b> is campaign-wide. Alarms, bodies, arrests and big scores raise it; days and laying low lower it. Higher heat means extra guards, faster police, jumpier security and a bigger fence cut. At 100 the task force raids your safehouse: game over.</p>
      <p><b className="text-amber-300">The Fence</b> buys stolen goods. Prices drift every day, react to market events, and drop 4% per item you sell, so don't dump everything at once. Cash is laundered automatically at a 12% fee.</p>
      <p>Spend money on gadgets, hideout upgrades and recruits. Wages are due every day. Reputation unlocks bigger contracts, better gadgets and finally the capstone.</p>
    </div>
  ),
  Controls: (
    <div className="space-y-2 text-sm text-slate-300">
      <table className="w-full text-left">
        <tbody>
          {[
            ['Planning', ''],
            ['Click map', 'Add step with current tool'],
            ['1-8', 'Move, Interact, Breach, Distract, Gadget, Wait, Sync, Exit'],
            ['Tab / Shift+Tab', 'Next / previous crew member'],
            ['Z or Backspace', 'Undo last step of selected crew'],
            ['Enter', 'Execute plan'],
            ['Wheel / drag / +/-', 'Zoom and pan the blueprint (touch: drag, buttons)'],
            ['Execution', ''],
            ['Space', 'Pause / resume'],
            ['Q / W / E', 'Speed 1x / 2x / 4x'],
            ['Click crew or 1-4', 'Select crew member'],
            ['H / B / X', 'Hold-resume / Bail / Skip step (selected crew)'],
            ['G then click', 'Throw a gadget (pick it in the side panel first)'],
            ['Esc', 'Pause menu'],
          ].map(([a, b], i) => b === '' ? (
            <tr key={i}><td colSpan={2} className="pt-2 font-display text-lg text-sky-300">{a}</td></tr>
          ) : (
            <tr key={i} className="border-t border-white/5"><td className="w-44 py-1 pr-2 text-amber-200">{a}</td><td>{b}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('Basics');
  return (
    <Modal title="Field Manual" onClose={onClose} wide z={80}>
      <div className="mb-3 flex flex-wrap gap-1">
        {Object.keys(HELP).map(k => <button key={k} className={`btn !py-1 ${tab === k ? 'btn-on' : ''}`} onClick={() => { audio.sfx('click'); setTab(k); }}>{k}</button>)}
      </div>
      {HELP[tab]}
    </Modal>
  );
}
