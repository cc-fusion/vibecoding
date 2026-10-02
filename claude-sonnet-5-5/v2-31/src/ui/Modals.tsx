import { useState } from "react";
import { ENEMIES, SPELLS, WEATHER } from "../game/data";
import type { Settings } from "../game/save";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-3 fade-in" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`panel pop-in flex max-h-full w-full flex-col ${wide ? "max-w-4xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-title text-xl font-bold tracking-wide text-sky-100">{title}</h2>
          <button className="rounded-md px-2 py-1 text-xl text-slate-300 hover:bg-white/10" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1 flex justify-between text-sm text-slate-300"><span>{label}</span><span>{Math.round(value * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </label>
  );
}

export function SettingsModal({ settings, onChange, onClose, onReset }: { settings: Settings; onChange: (p: Partial<Settings>) => void; onClose: () => void; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="mb-4 flex cursor-pointer items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <span>🔇 Mute all audio <span className="text-xs text-slate-400">(M)</span></span>
        <input type="checkbox" checked={settings.muted} onChange={(e) => onChange({ muted: e.target.checked })} className="h-5 w-5" />
      </label>
      <Slider label="Master volume" value={settings.master} onChange={(v) => onChange({ master: v })} />
      <Slider label="Sound effects" value={settings.sfx} onChange={(v) => onChange({ sfx: v })} />
      <Slider label="Music" value={settings.music} onChange={(v) => onChange({ music: v })} />
      <Slider label="Screen shake" value={settings.shake} onChange={(v) => onChange({ shake: v })} />
      <label className="mb-2 flex cursor-pointer items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <span>Show damage numbers</span>
        <input type="checkbox" checked={settings.dmgNumbers} onChange={(e) => onChange({ dmgNumbers: e.target.checked })} className="h-5 w-5" />
      </label>
      <label className="mb-4 flex cursor-pointer items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <span>Auto-pause when tab loses focus</span>
        <input type="checkbox" checked={settings.autoPause} onChange={(e) => onChange({ autoPause: e.target.checked })} className="h-5 w-5" />
      </label>
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm text-slate-400">Saved progress lives in your browser.</span>
        {confirm ? (
          <div className="flex gap-2">
            <button className="btn danger !px-3 !py-1 text-sm" onClick={() => { onReset(); setConfirm(false); }}>Confirm wipe</button>
            <button className="btn !px-3 !py-1 text-sm" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn !px-3 !py-1 text-sm" onClick={() => setConfirm(true)}>Reset progress</button>
        )}
      </div>
    </Modal>
  );
}

const REACTIONS = [
  ["💧 + ⚡", "Conduct", "Lightning on a WET enemy: +50% damage, a much longer chain and a stun."],
  ["💧 + ❄️", "Flash Freeze", "Chilling a WET enemy freezes it solid. Frozen foes can't move or attack."],
  ["🧊 + 🪨", "Shatter", "Rockfall on a FROZEN enemy deals double damage and ends the freeze. Great against bosses."],
  ["🧊 + 🔥", "Meltdown", "Fire on a frozen enemy thaws it with a burst of bonus damage."],
  ["🔥 + 💧", "Steam", "Water on a burning enemy (or fire on a wet one) cancels both and scalds for damage."],
  ["🔥 + 🌪️", "Wildfire Gust", "Gale spreads burning from enemy to nearby enemies and fans Firestorm zones bigger."],
  ["💧 + 🌪️", "Wind Chill", "Gale on a wet enemy turns the water to chill, slowing it."],
  ["🎶", "Harmony", "Casting a DIFFERENT element than your last spell builds Harmony: bonus damage per stack. Repeating an element resets it."],
  ["🧱 + 🪨", "Rubble", "Rockfall leaves free rubble walls where it lands. Walls can be reinforced for 1 stone (click a damaged wall)."],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("basics");
  const tabs = [["basics", "Basics"], ["controls", "Controls"], ["react", "Reactions"], ["foes", "Foes"], ["skies", "Skies"]];
  return (
    <Modal title="How to Hold the Pass" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([id, name]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === id ? "bg-sky-500/30 text-sky-100 ring-1 ring-sky-300/50" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{name}</button>
        ))}
      </div>
      {tab === "basics" && (
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-200">
          <p>Armies march from the <b className="text-red-300">red spawn</b> on the left toward your <b className="text-amber-200">Gate</b> on the right. Every enemy that reaches the gate damages it. If the Gate falls, the run ends. Survive <b>15 waves</b> (bosses on waves 5, 10 and 15) to win — then keep going in Endless mode.</p>
          <p><b className="text-sky-200">Shape the terrain.</b> Spend <b>🪨 stone</b> to raise walls. Enemies follow the cheapest route: they walk around walls when the detour is short, but will hack through if you seal the road. The dotted yellow line previews their route. Build mazes to buy time, or barricades to hold them in your storms.</p>
          <p><b className="text-sky-200">Call the storms.</b> Spells cost <b>mana</b> and have cooldowns. The real power is in <b>elemental reactions</b>: soak enemies, then strike, freeze, shatter or burn them. Chaining different elements builds <b>Harmony</b> for bonus damage, and reactions charge your <b>Tempest</b> ultimate.</p>
          <p><b className="text-sky-200">Weather matters.</b> Each wave has weather that buffs some elements and weakens others. A forecast of the next wave and its weather is shown in the prep panel.</p>
          <p><b className="text-sky-200">Roguelite layers.</b> After each wave pick one of three <b>relics</b> that last the run. After each run you earn <b>Aether</b>, spent in the <b>Sanctum</b> research tree on permanent upgrades and new spells (Firestorm and Gale Burst must be researched). Mutators and harder difficulties earn more Aether.</p>
        </div>
      )}
      {tab === "controls" && (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Left click / drag", "Cast selected spell · paint walls · reinforce a wall"],
            ["Right click / drag", "Remove walls (refunds some stone)"],
            ["1 – 6", "Select spell: " + SPELLS.map((s) => s.icon).join(" ")],
            ["Q", "Wall tool"], ["E", "Dig tool (for touch / trackpads)"],
            ["R", "Tempest Call ultimate (when meter is full)"],
            ["Space", "Call the next wave early (bonus score + mana)"],
            ["F", "Toggle 1x / 2x game speed"],
            ["Esc / P", "Pause"], ["M", "Mute / unmute"],
            ["Touch", "Tap toolbar to choose a tool, tap or drag on the pass to use it"],
          ].map(([k, d]) => (
            <div key={k} className="flex gap-3 rounded-lg bg-white/5 px-3 py-2">
              <kbd className="h-fit shrink-0 rounded bg-slate-700 px-2 py-0.5 font-mono text-xs text-sky-100">{k}</kbd>
              <span className="text-slate-300">{d}</span>
            </div>
          ))}
        </div>
      )}
      {tab === "react" && (
        <div className="space-y-2">
          {SPELLS.map((s) => (
            <div key={s.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="font-semibold" style={{ color: s.color }}>{s.icon} {s.name}</span> <span className="text-slate-400">(key {s.key}, {s.cost} mana)</span>
              <div className="text-slate-300">{s.desc}</div>
            </div>
          ))}
          <div className="pt-2 font-title text-lg text-sky-100">Reactions</div>
          {REACTIONS.map(([ic, n, d]) => (
            <div key={n} className="flex gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <div className="w-24 shrink-0 text-center text-base">{ic}</div>
              <div><b className="text-amber-200">{n}.</b> <span className="text-slate-300">{d}</span></div>
            </div>
          ))}
        </div>
      )}
      {tab === "foes" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.values(ENEMIES).map((e) => (
            <div key={e.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-100"><span className="text-xl">{e.icon}</span>{e.name}{e.boss && <span className="rounded bg-red-500/30 px-1.5 text-xs text-red-200">BOSS</span>}</div>
              <div className="text-slate-300">{e.desc}</div>
              <div className="text-sky-300">💡 {e.tip}</div>
            </div>
          ))}
        </div>
      )}
      {tab === "skies" && (
        <div className="space-y-2">
          {Object.values(WEATHER).map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="text-3xl">{w.icon}</span>
              <div><div className="font-semibold" style={{ color: w.color }}>{w.name}</div><div className="text-slate-300">{w.desc}</div></div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
