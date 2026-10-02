import { useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import { getSave, persist, resetSave } from '../game/data';
import type { SettingsData } from '../game/data';
import { audio } from '../game/audio';

export function Btn({
  children, onClick, kind = 'primary', disabled, className = '', title,
}: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'good'; disabled?: boolean; className?: string; title?: string }) {
  const base = 'rounded-xl px-4 py-2.5 font-semibold tracking-wide transition-all duration-150 active:scale-95 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';
  const k = {
    primary: 'bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 shadow-[0_4px_0_#7a4a0a] hover:from-amber-300 hover:to-amber-500 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none',
    good: 'bg-gradient-to-b from-lime-400 to-green-600 text-stone-950 shadow-[0_4px_0_#245c18] hover:from-lime-300 hover:to-green-500 hover:-translate-y-0.5',
    ghost: 'bg-white/5 text-amber-50 border border-amber-100/20 hover:bg-white/10 hover:border-amber-100/40',
    danger: 'bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_4px_0_#6b1111] hover:from-red-400 hover:to-red-600',
  }[kind];
  return (
    <button
      title={title}
      disabled={disabled}
      className={`${base} ${k} ${className}`}
      onClick={() => { audio.ensure(); audio.play('click'); onClick?.(); }}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-amber-100/15 bg-[#1b130c]/85 backdrop-blur-md shadow-2xl ${className}`}>{children}</div>;
}

export function Slider({ label, value, onChange, max = 1, step = 0.01, suffix }: { label: string; value: number; onChange: (v: number) => void; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm text-amber-100/80">
        <span>{label}</span>
        <span className="tabular-nums">{suffix ?? Math.round((value / max) * 100) + '%'}</span>
      </div>
      <input
        type="range" min={0} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={() => audio.play('click')}
        className="w-full accent-amber-400"
      />
    </label>
  );
}

export function SettingsPanel({ allowReset, onReset }: { allowReset?: boolean; onReset?: () => void }) {
  const s = getSave().settings;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [confirm, setConfirm] = useState(false);
  const upd = (p: Partial<SettingsData>) => {
    Object.assign(s, p);
    audio.ensure();
    audio.setVolumes(s.master, s.music, s.sfx, s.muted);
    persist();
    force();
  };
  return (
    <div className="space-y-4">
      <Slider label="Master volume" value={s.master} onChange={(v) => upd({ master: v })} />
      <Slider label="Music" value={s.music} onChange={(v) => upd({ music: v })} />
      <Slider label="Sound effects" value={s.sfx} onChange={(v) => upd({ sfx: v })} />
      <Slider label="Screen shake" value={s.shake} onChange={(v) => upd({ shake: v })} />
      <div>
        <div className="mb-1 text-sm text-amber-100/80">Particle density</div>
        <div className="flex gap-2">
          {([['Low', 0.35], ['Medium', 0.7], ['High', 1]] as [string, number][]).map(([n, v]) => (
            <Btn key={n} kind={Math.abs(s.particles - v) < 0.05 ? 'primary' : 'ghost'} className="flex-1 !py-1.5 text-sm" onClick={() => upd({ particles: v })}>{n}</Btn>
          ))}
        </div>
      </div>
      <Btn kind={s.muted ? 'danger' : 'ghost'} className="w-full" onClick={() => upd({ muted: !s.muted })}>
        {s.muted ? '🔇 Muted — click to unmute' : '🔊 Sound on — click to mute'}
      </Btn>
      {allowReset && (
        <div className="border-t border-amber-100/10 pt-3">
          {!confirm ? (
            <Btn kind="ghost" className="w-full text-sm" onClick={() => setConfirm(true)}>Reset all progress…</Btn>
          ) : (
            <div className="flex gap-2">
              <Btn kind="danger" className="flex-1 text-sm" onClick={() => { resetSave(); setConfirm(false); onReset?.(); force(); }}>Yes, erase everything</Btn>
              <Btn kind="ghost" className="flex-1 text-sm" onClick={() => setConfirm(false)}>Cancel</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const HELP_TABS = ['Goal', 'Trails & Orders', 'Colony', 'Dangers', 'Controls'] as const;

export function HelpPanel() {
  const [tab, setTab] = useState<(typeof HELP_TABS)[number]>('Goal');
  const H = ({ children }: { children: ReactNode }) => <h4 className="mt-3 mb-1 font-bold text-amber-300">{children}</h4>;
  const row = (k: string, v: string) => (
    <div key={k} className="flex justify-between gap-4 border-b border-white/5 py-1.5">
      <kbd className="rounded bg-black/40 px-2 py-0.5 font-mono text-xs text-amber-200">{k}</kbd>
      <span className="text-right text-amber-50/80">{v}</span>
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {HELP_TABS.map((t) => (
          <button key={t} onClick={() => { audio.play('click'); setTab(t); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-amber-400 text-stone-950' : 'bg-white/5 text-amber-100 hover:bg-white/10'}`}>{t}</button>
        ))}
      </div>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-2 text-sm leading-relaxed text-amber-50/85">
        {tab === 'Goal' && (
          <>
            <p>You are the Regent of an ant colony. Your <b>Queen</b> lays eggs that cost food. If she falls — or the colony starves — you lose. Each expedition has its own objective: grow, conquer rival nests, survive storms, slay a boss, or endure endlessly.</p>
            <H>The core loop</H>
            <p>Food → eggs → ants → more food. Paint trails to guide ants, dig tunnels to reach buried caches and enemy nests, build chambers to multiply your output, and keep soldiers ready. Everything interacts: weather washes your trails, wasps hunt exposed ants, dead predators become food, tunnels open paths for both you and your enemies.</p>
            <H>Rewards</H>
            <p>Victories (and even defeats) earn <b>Royal Jelly</b>, spent on permanent <b>Evolutions</b> in the tech tree. Stars: ★ win · ★★ under par time · ★★★ few losses. Harder difficulties and modifiers boost jelly.</p>
          </>
        )}
        {tab === 'Trails & Orders' && (
          <>
            <H>🟢 Forage trail (1)</H>
            <p>Paint from your tunnel exit toward food. Idle workers join the trail and follow it <b>outward from the nest</b>. Workers returning with food reinforce the trail they walk. Scouts that find food leave a faint trail too. Painting costs <b>gland energy</b>, which regenerates.</p>
            <H>🔴 War trail (2)</H>
            <p>Soldiers and Spitters follow red trails outward and fight at the end. Any ant under attack also emits an alarm that draws defenders.</p>
            <H>⛏ Dig (3)</H>
            <p>Mark brown soil; workers excavate it. Rock cannot be dug. Buried seed caches sparkle in explored soil. Digging into a rival nest opens a path for raids — in both directions.</p>
            <H>🧽 Erase (4) · 🏗 Build (5) · ✋ Pan (6)</H>
            <p>Erase clears trails and dig marks. Build places a chamber that workers will dig out. Pan is for touch screens — or hold the right mouse button.</p>
            <H>Weather &amp; trails</H>
            <p>Rain and storms wash surface trails away; heat evaporates them faster. Tunnels preserve trails far better.</p>
          </>
        )}
        {tab === 'Colony' && (
          <>
            <H>Castes</H>
            <p><b>Workers</b> forage and dig · <b>Soldiers</b> fight · <b>Nurses</b> speed brood, heal and tend fungus · <b>Scouts</b> explore the fog and mark food · <b>Spitters</b> shoot armor-piercing acid (needs Acid Glands). Use the Caste Mix sliders to steer what the Queen lays.</p>
            <H>Chambers</H>
            <p><b>Nursery</b>: brood slots + faster hatching · <b>Granary</b>: food capacity and a nearer drop-off · <b>Barracks</b>: population cap, heals soldiers · <b>Fungus Garden</b>: passive food (loves rain, hates heat) · <b>Sentry Post</b>: automated acid turret that burns food.</p>
            <H>Upkeep</H>
            <p>Every ant eats. With no food, ants and the Queen slowly starve, and your ants move slower. Killing beetles, spiders and centipedes leaves carcasses — haul them home!</p>
            <H>Rivals</H>
            <p>Rival colonies forage the same crumbs, grow stronger over time and launch raids at your Queen. Kill their queen and the colony collapses.</p>
          </>
        )}
        {tab === 'Dangers' && (
          <>
            <p>🪲 <b>Beetles</b> – armored; low-damage ants barely scratch them. Use soldiers with Razor Mandibles or Spitters.</p>
            <p>🕷️ <b>Spiders</b> – fast and poisonous; they hunt foragers.</p>
            <p>🐝 <b>Wasps</b> – fly over everything, but only attack ants on the surface. Retreat underground. Rain grounds them.</p>
            <p>🐛 <b>Centipedes</b> – dig straight through soil to your Queen.</p>
            <p>🕳️ <b>Antlions</b> – pits that drag ants in. Kill them with soldiers.</p>
            <p>🦡 <b>The Anteater</b> – a boss with claw sweeps and telegraphed tongue-slams (watch the red circles!). It enrages at half health.</p>
            <p>⛈️ <b>Weather</b> – heat dehydrates surface ants, cold slows ants and brood, storms bring wind and lightning.</p>
          </>
        )}
        {tab === 'Controls' && (
          <div>
            {row('Left mouse / touch', 'Use the current tool')}
            {row('Right / middle drag', 'Pan the camera')}
            {row('Mouse wheel / pinch', 'Zoom')}
            {row('W A S D / arrows', 'Pan the camera')}
            {row('1 2 3 4 5 6', 'Forage · War · Dig · Erase · Build · Pan')}
            {row('[  ]', 'Brush size')}
            {row('H', 'Centre on the Queen')}
            {row('+ / −', 'Zoom in / out')}
            {row('T', 'Cycle game speed 1× 2× 3×')}
            {row('Space / P / Esc', 'Pause menu')}
            {row('Minimap click', 'Jump the camera')}
          </div>
        )}
      </div>
    </div>
  );
}
