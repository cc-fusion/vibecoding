import { useState } from 'react';
import { audio } from '../game/audio';
import { saveMeta, defaultMeta, type Meta, type Settings } from '../game/campaign';
import { Btn } from './ui';
import { cn } from '../utils/cn';
import { WEATHER_INFO, CLASSES, ENEMIES, PERKS, GEAR } from '../game/data';

export function applyAudio(s: Settings) {
  audio.setSettings({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-[#cfc6ea]">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-[#f5d78a]" />
      <span className="w-10 text-right tabular-nums text-[#f5d78a]">{Math.round(value * 100)}</span>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => {
        audio.sfx('click');
        onChange(!on);
      }}
      className="flex w-full items-center justify-between rounded-lg border border-[#3d3460] bg-[#1c1730] px-3 py-2 text-sm hover:bg-[#262042]"
    >
      <span>{label}</span>
      <span className={cn('rounded px-2 py-0.5 text-xs font-bold', on ? 'bg-[#2f7a56] text-white' : 'bg-[#4a2d3a] text-[#ffc9d0]')}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export function SettingsPanel({ meta, setMeta, onResetAll }: { meta: Meta; setMeta: (m: Meta) => void; onResetAll?: () => void }) {
  const s = meta.settings;
  const [confirm, setConfirm] = useState(false);
  const upd = (p: Partial<Settings>) => {
    const ns = { ...s, ...p };
    const nm = { ...meta, settings: ns };
    applyAudio(ns);
    saveMeta(nm);
    setMeta(nm);
  };
  return (
    <div className="space-y-3">
      <Slider label="Master" value={s.master} onChange={(v) => upd({ master: v })} />
      <Slider label="Music" value={s.music} onChange={(v) => upd({ music: v })} />
      <Slider label="Effects" value={s.sfx} onChange={(v) => upd({ sfx: v })} />
      <Toggle label="Mute all audio" on={s.muted} onChange={(v) => upd({ muted: v })} />
      <Toggle label="Screen shake" on={s.shake} onChange={(v) => upd({ shake: v })} />
      <Toggle label="Floating damage numbers" on={s.numbers} onChange={(v) => upd({ numbers: v })} />
      <Toggle label="High-quality particles" on={s.particles === 'high'} onChange={(v) => upd({ particles: v ? 'high' : 'low' })} />
      <p className="text-xs text-[#9a90b8]">Screen shake, numbers and particle settings apply to the next battle.</p>
      {onResetAll && (
        <div className="pt-2">
          {!confirm ? (
            <Btn variant="danger" small onClick={() => setConfirm(true)}>
              Erase all saved progress…
            </Btn>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#ffb0b8]">Really erase laurels, tech and campaign?</span>
              <Btn
                variant="danger"
                small
                onClick={() => {
                  const d = defaultMeta();
                  d.settings = s;
                  saveMeta(d);
                  setMeta(d);
                  onResetAll();
                  setConfirm(false);
                }}
              >
                Yes, erase
              </Btn>
              <Btn small onClick={() => setConfirm(false)}>
                Cancel
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = ['Basics', 'Hazards', 'Supply', 'Veterans', 'Units', 'Controls'] as const;

export function HelpPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Basics');
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Btn key={t} small variant={tab === t ? 'gold' : 'default'} onClick={() => setTab(t)}>
            {t}
          </Btn>
        ))}
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-[#d9d1ee]">
        {tab === 'Basics' && (
          <>
            <p>
              <b className="text-[#f5d78a]">Hexfall Commanders</b> is a turn-based hex wargame on ground that is falling apart. Each <b>Round</b> has a Player phase, an Enemy phase, then a <b>Hazard phase</b> where the land collapses, floods or burns.
            </p>
            <p>Select a unit, <b>move</b> (blue hexes, terrain costs vary), then <b>attack</b> a red-ringed enemy or use an <b>ability</b>. Hover an enemy for a damage preview. Melee foes counter-attack, and a friendly unit adjacent to the target gives +1 flank damage.</p>
            <p>Forests and hills give +1 cover. Ranged units gain +1 range on hills. Mortars can't fire after moving.</p>
            <p>
              <b>Objectives:</b> Rout (kill all), Seize (hold every beacon 🚩 at round end), Survive (last N rounds), Boss (slay it). You lose if your whole company dies, or an enemy holds your HQ 🏰 through two consecutive round ends (the first is a warning).
            </p>
            <p>Between battles, spend <b>Crowns</b> on recruits and gear, level up veterans, and pick your route on the campaign map. <b>Laurels</b> persist between campaigns and buy permanent War College upgrades.</p>
          </>
        )}
        {tab === 'Hazards' && (
          <>
            <p>Flashing marked hexes with a number show hazards that will happen when that number counts down to 0 at the end of a round. Everything is telegraphed, so plan around it.</p>
            <p>
              <b className="text-[#e8cfa8]">Collapse:</b> the hex becomes a chasm; units on it take 5 damage and are dropped on the nearest firm ground. Fault ground and chasm edges crumble most.
            </p>
            <p>
              <b className="text-[#7fd0ff]">Flood:</b> rivers rise onto low ground (not hills): +1 move cost, -1 attack, supply cut. It douses fire. Flooding a chasm makes a permanent lake.
            </p>
            <p>
              <b className="text-[#ffa04a]">Fire:</b> burning hexes hurt (3 dmg) and spread, most to forests and downwind. Burned ground becomes ash. Fire also cuts supply.
            </p>
            <p>
              <b>Weather:</b>{' '}
              {Object.values(WEATHER_INFO).map((w) => (
                <span key={w.name} className="mr-2 inline-block">
                  {w.icon} <b>{w.name}</b>: {w.desc}
                </span>
              ))}
            </p>
            <p>
              Enemy casters (Pyromancer, Geomancer, Tidecaller) mark extra hazards too. <b>Sappers</b> can <b>Shore</b> a hex to cancel a hazard permanently. <b>Vanguards</b> can <b>Shove</b> enemies into chasms, deep water and flames for instant kills.
            </p>
          </>
        )}
        {tab === 'Supply' && (
          <>
            <p>Your HQ and captured depots project <b className="text-[#8dffb0]">supply lines</b> (green dashes) along open ground, up to a limited reach. Walk onto a depot at round end to capture it.</p>
            <p>Lines are blocked by chasms, deep water, flooding, fire and enemy units, so hazards and enemies can cut your units off.</p>
            <p>
              <b>Supplied</b> units heal each round. <b>Unsupplied</b> units (orange ! marker) get -1 attack and -1 move, and after 2 rounds lose 1 HP per round. Foragers, Iron Rations and Quartermaster upgrades help.
            </p>
            <p>Enemy skirmishers and raiders love to grab depots and rush your HQ, so keep a guard.</p>
          </>
        )}
        {tab === 'Veterans' && (
          <>
            <p>Units earn XP from attacking, killing, healing and shoring. Levels: {['Recruit', 'Veteran', 'Elite', 'Champion', 'Legend'].join(' → ')}. Each level adds HP and a <b>perk choice</b> in the War Room (⭐ marker).</p>
            <p>
              <b className="text-[#ff9aa6]">Permadeath:</b> fallen units are gone forever and added to the Memorial. On Squire difficulty, Field Surgeons may save some after a victory.
            </p>
            <p>Perks: {PERKS.map((p) => p.name).join(', ')}.</p>
            <p>Gear (one per unit): {GEAR.map((g) => `${g.icon} ${g.name}`).join(', ')}.</p>
          </>
        )}
        {tab === 'Units' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(CLASSES).map((c) => (
              <div key={c.id} className="rounded-lg border border-[#3d3460] bg-[#1b1630] p-2">
                <div className="font-bold text-[#8fe3ff]">
                  {c.icon} {c.name}
                </div>
                <div className="text-xs text-[#cfc6ea]">{c.desc}</div>
                <div className="mt-1 text-[11px] text-[#9a90b8]">
                  HP {c.hp} · ATK {c.atk} · MOVE {c.move} · ARM {c.armor} · RNG {c.rmin}-{c.rmax}
                </div>
              </div>
            ))}
            {Object.values(ENEMIES).map((c) => (
              <div key={c.id} className="rounded-lg border border-[#5a2d3a] bg-[#201420] p-2">
                <div className="font-bold text-[#ff9a8a]">
                  {c.icon} {c.name}
                </div>
                <div className="text-xs text-[#cfc6ea]">{c.desc}</div>
                <div className="mt-1 text-[11px] text-[#9a90b8]">
                  HP {c.hp} · ATK {c.atk} · MOVE {c.move} · ARM {c.armor} · RNG {c.rmin}-{c.rmax}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'Controls' && <Controls />}
      </div>
    </div>
  );
}

export function Controls() {
  const rows: [string, string][] = [
    ['Left click / tap', 'Select unit, move to a blue hex, attack a red-ringed enemy, pick ability targets'],
    ['Right click / Esc', 'Cancel ability mode or deselect (Esc again: pause)'],
    ['Space / Enter', 'End turn'],
    ['Tab', 'Cycle to next ready unit'],
    ['A / Q', 'Toggle unit ability targeting'],
    ['U / Backspace', 'Undo last move (before acting)'],
    ['T', 'Toggle enemy threat range'],
    ['S', 'Toggle supply overlay'],
    ['P / Esc', 'Pause menu'],
    ['M', 'Mute / unmute'],
  ];
  return (
    <div className="space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 rounded-md bg-[#1b1630] px-3 py-1.5 text-sm">
          <span className="w-40 shrink-0 font-bold text-[#f5d78a]">{k}</span>
          <span className="text-[#d9d1ee]">{v}</span>
        </div>
      ))}
      <p className="pt-1 text-xs text-[#9a90b8]">Touch: tap to select/move/attack, use the on-screen buttons for abilities, undo and end turn.</p>
    </div>
  );
}
