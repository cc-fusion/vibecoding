import { useMemo, useState } from "react";
import { DIFFICULTIES, DYN_MODS, PERKS, HOUSES, type DifficultyId } from "../game/data";
import type { HallEntry, SaveData, Settings } from "../game/save";
import { audio } from "../game/audio";
import { Btn, Modal, Toggle } from "./common";

export function SettingsModal({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const slider = (label: string, key: "master" | "music" | "sfx") => (
    <div className="py-1">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-amber-200">{Math.round(settings[key] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.05} value={settings[key]} className="w-full" onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })} onPointerUp={() => audio.sfx("select")} />
    </div>
  );
  return (
    <Modal title="Settings" onClose={onClose} z={80}>
      <Toggle on={settings.muted} onChange={(v) => onChange({ ...settings, muted: v })} label="🔇 Mute all audio" />
      {slider("Master volume", "master")}
      {slider("Music volume", "music")}
      {slider("Effects volume", "sfx")}
      <div className="mt-2 border-t border-white/10 pt-2">
        <Toggle on={settings.shake} onChange={(v) => onChange({ ...settings, shake: v })} label="📳 Screen shake" />
        <Toggle on={settings.numbers} onChange={(v) => onChange({ ...settings, numbers: v })} label="🔢 Damage numbers" />
      </div>
      <div className="mt-4 flex justify-end"><Btn variant="primary" onClick={onClose}>Done</Btn></div>
    </Modal>
  );
}

const CONTROLS: [string, string, string][] = [
  ["Move", "W A S D / Arrow keys", "Left stick · Touch pad"],
  ["Aim", "Mouse cursor (J/Z auto-aims)", "Right stick · Auto-aim on touch"],
  ["Attack", "Left Click (hold) / J / Z", "RT / RB / X · ⚔ button"],
  ["Dash (i-frames)", "Space / Right Click / K / Shift", "A / B / LT · 💨 button"],
  ["Ancestral Roar", "Q / L", "Y · 📢 button"],
  ["Healing potion", "E / H", "LB · 🧪 button"],
  ["Pause", "Esc / P", "Start"],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ["The Goal", "Combat", "Bloodline", "Controls"];
  return (
    <Modal title="How to Play" onClose={onClose} wide z={80}>
      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map((t, i) => (
          <Btn key={t} variant={i === tab ? "primary" : "ghost"} onClick={() => setTab(i)} className="!py-1">{t}</Btn>
        ))}
      </div>
      <div className="text-sm sm:text-base leading-relaxed text-violet-100 space-y-3">
        {tab === 0 && (
          <>
            <p><b className="text-amber-200">Heirloom Dynasty</b> is a generational action-roguelite. You do not play one hero. You play a <b>family</b>. Each hero delves into five realms, and when they fall, their child takes up the blade.</p>
            <p>🎯 <b>Win:</b> Slay <b>The Hollow King</b> in the fifth realm before your generation limit runs out. The limit depends on the difficulty you pick.</p>
            <p>💀 <b>Lose:</b> The bloodline goes extinct (a hero falls with no heir), or your family runs out of generations.</p>
            <p>🏡 Between expeditions you return to the <b>Homestead</b>: spend gold on the Estate, train and marry, equip heirlooms, and rewrite blood at the Shrine. Bosses you defeat stay defeated, so each generation starts deeper.</p>
            <p>🔑 Keep a spouse and children alive. <b>An unwed hero who dies with no children ends your line</b> (unless your Nursery can summon distant kin).</p>
          </>
        )}
        {tab === 1 && (
          <>
            <p>⚔️ <b>Attack</b> with your heirloom weapon. Melee swings hit everything in an arc and <b>deflect enemy bullets</b> back at them. Blade, Spear, Maul and Bow all feel different.</p>
            <p>💨 <b>Dash</b> gives brief invulnerability. Use it to dodge red telegraphs: boss cones, charge lines, and ground circles.</p>
            <p>📢 <b>Ancestral Roar</b> charges as you fight. When full, it blasts nearby foes, erases bullets and stuns. Its power grows with <b>every ancestor</b> your family has lost, so your dead fight alongside you.</p>
            <p>🧪 <b>Potions</b> heal a portion of your health. Hearth levels give more potions, and Wits makes them stronger.</p>
            <p>🚪 After each room, choose a door: <b>Fight</b>, <b>Treasure Hoard</b> (more gold), <b>Elite</b> (heirloom relic), <b>Rest</b>, or <b>Merchant</b>. You can <b>Return Home</b> at any door with all your gold, or press on and risk losing some on death.</p>
            <p>🌋 Each realm has a hazard. Bogs slow, lava erupts, ice slides, spikes strike and void wells pull. Bombers hurt other enemies, and spikes hurt them too.</p>
            <p>🌟 <b>Boons</b> found in rooms stack within a run. Relics are <b>heirlooms</b> that you keep and that grow stronger every generation they are passed down.</p>
          </>
        )}
        {tab === 2 && (
          <>
            <p>🧬 Every hero has five <b>stats</b> (Vigor, Might, Agility, Wits, Luck) and up to three <b>traits</b>. Traits change how you play: Berserker Blood hits harder when hurt, Glass Cannon trades health for damage, and Stormborn arcs lightning.</p>
            <p>💍 <b>Marry</b> a suitor at the Family tab. After each expedition, children are born. They inherit a mix of both parents' stats and traits, with a chance to <b>mutate</b>. Nursery levels favor good traits and allow more children.</p>
            <p>🏋️ <b>Train</b> heirs with gold before they inherit. Bonuses compound across generations, but a child inherits only about 70% of the parents' average, so keep training.</p>
            <p>⏳ <b>Age</b> matters: Youthful heroes are quick but unwise, Elders are wise but frail. Heroes who reach 62 retire. Each expedition costs 4 years.</p>
            <p>⛩️ The <b>Shrine</b> lets you reroll, cleanse or bless traits, and grants each run starting boons. 🪙 <b>Legacy Marks</b> earned at the end of each dynasty buy permanent perks for new ones.</p>
          </>
        )}
        {tab === 3 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-amber-200 text-left"><th className="py-1 pr-3">Action</th><th className="pr-3">Keyboard + Mouse</th><th>Gamepad / Touch</th></tr></thead>
              <tbody>
                {CONTROLS.map((c) => (
                  <tr key={c[0]} className="border-t border-white/10"><td className="py-1.5 pr-3 font-bold">{c[0]}</td><td className="pr-3">{c[1]}</td><td>{c[2]}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-violet-300">Tip: the game pauses automatically if the window loses focus. Replay the Training Grounds from the title screen any time.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function Title({ save, onContinue, onNew, onTutorial, onLegacy, onHelp, onSettings }: { save: SaveData; onContinue: () => void; onNew: () => void; onTutorial: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void }) {
  const embers = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 10, dur: 7 + Math.random() * 8, key: i })), []);
  const d = save.dynasty;
  return (
    <div className="relative h-full w-full overflow-hidden flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 30%, #2a1a4a 0%, #120b22 55%, #07050c 100%)" }}>
      {embers.map((e) => (<span key={e.key} className="ember" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }} />))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-60" style={{ background: "linear-gradient(to top, #07050c, transparent)" }} />
      <div className="relative z-10 flex flex-col items-center px-4 py-6 max-h-full scroll-y w-full">
        <div className="text-6xl sm:text-7xl anim-float">🛡️</div>
        <h1 className="font-title text-4xl sm:text-6xl md:text-7xl font-black shimmer-text mt-2 text-center">HEIRLOOM DYNASTY</h1>
        <p className="font-title italic text-violet-300 mt-1 mb-6 text-center text-sm sm:text-lg">One blade. Many hands. A single crown to break.</p>
        <div className="flex flex-col gap-2.5 w-64 sm:w-72 anim-up">
          {d && (
            <Btn variant="primary" onClick={onContinue} className="!py-3 text-lg">
              ▶ Continue House {d.house}
              <div className="text-xs font-normal opacity-80">Gen {d.gen} · Year {d.year} · {d.realmsCleared}/5 realms</div>
            </Btn>
          )}
          <Btn variant={d ? "secondary" : "primary"} onClick={onNew} className={d ? "" : "!py-3 text-lg"}>⚔️ New Dynasty</Btn>
          <Btn onClick={onTutorial}>🎓 Training Grounds</Btn>
          <Btn onClick={onLegacy}>🏆 Ancestral Hall <span className="text-amber-300">({save.marks} marks)</span></Btn>
          <div className="flex gap-2">
            <Btn onClick={onHelp} className="flex-1">❓ How to Play</Btn>
            <Btn onClick={onSettings} className="flex-1">⚙️ Settings</Btn>
          </div>
        </div>
        <p className="mt-6 text-xs text-violet-400 text-center max-w-md">Keyboard + mouse · gamepad · touch. Progress saves automatically in your browser.</p>
      </div>
    </div>
  );
}

export function NewDynasty({ marks, onStart, onBack }: { marks: number; onStart: (house: string, diff: DifficultyId, mods: string[]) => void; onBack: () => void }) {
  const [house, setHouse] = useState(() => HOUSES[Math.floor(Math.random() * HOUSES.length)]);
  const [diff, setDiff] = useState<DifficultyId>("noble");
  const [mods, setMods] = useState<string[]>([]);
  const toggle = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <div className="h-full w-full scroll-y flex justify-center p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a4a 0%, #0d0916 70%)" }}>
      <div className="panel w-full max-w-3xl p-5 h-fit anim-up">
        <h2 className="font-title text-3xl text-amber-200 mb-1">Found a New Dynasty</h2>
        <p className="text-violet-300 text-sm mb-4">Name your house, choose how cruel the world is, and add optional curses for greater renown.</p>
        <label className="block text-sm text-violet-200 mb-1">House name</label>
        <div className="flex gap-2 mb-4">
          <input value={house} maxLength={18} onChange={(e) => setHouse(e.target.value)} className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-amber-100 font-title text-lg outline-none focus:border-amber-300" />
          <Btn variant="ghost" onClick={() => setHouse(HOUSES[Math.floor(Math.random() * HOUSES.length)])}>🎲</Btn>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {Object.values(DIFFICULTIES).map((d) => (
            <button key={d.id} onClick={() => { audio.sfx("select"); setDiff(d.id); }} className={`rounded-xl p-3 text-left border transition cursor-pointer ${diff === d.id ? "border-amber-300 bg-amber-300/10 anim-glow" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <div className="text-2xl">{d.icon}</div>
              <div className="font-bold text-amber-100">{d.name}</div>
              <div className="text-xs text-violet-300 mt-1">{d.desc}</div>
              <div className="text-xs mt-2 text-violet-200">Foe HP ×{d.hp} · Dmg ×{d.dmg}</div>
            </button>
          ))}
        </div>
        <div className="text-sm text-violet-200 mb-1">Optional curses (more renown, harder)</div>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {DYN_MODS.map((m) => (
            <button key={m.id} onClick={() => { audio.sfx("select"); toggle(m.id); }} className={`rounded-lg p-2 text-left border text-sm cursor-pointer ${mods.includes(m.id) ? "border-red-300 bg-red-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <b>{m.icon} {m.name}</b> <span className="text-violet-300">· {m.desc}</span>
            </button>
          ))}
        </div>
        {marks > 0 && <p className="text-xs text-amber-200 mb-3">🪙 Your Legacy Marks perks are applied automatically to the founder.</p>}
        <div className="flex justify-between">
          <Btn variant="ghost" onClick={onBack}>← Back</Btn>
          <Btn variant="primary" onClick={() => onStart(house.trim() || "Nameless", diff, mods)} className="!px-8">Begin the Line →</Btn>
        </div>
      </div>
    </div>
  );
}

export function Legacy({ save, onBuy, onBack }: { save: SaveData; onBuy: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="h-full w-full scroll-y flex justify-center p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a4a 0%, #0d0916 70%)" }}>
      <div className="panel w-full max-w-3xl p-5 h-fit anim-up">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-title text-3xl text-amber-200">Ancestral Hall</h2>
          <div className="text-amber-300 font-bold">🪙 {save.marks} Legacy Marks</div>
        </div>
        <div className="flex gap-2 mb-4">
          <Btn variant={tab === 0 ? "primary" : "ghost"} onClick={() => setTab(0)}>Legacy Perks</Btn>
          <Btn variant={tab === 1 ? "primary" : "ghost"} onClick={() => setTab(1)}>Hall of Fame ({save.hall.length})</Btn>
        </div>
        {tab === 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {PERKS.map((p) => {
              const lv = save.perks[p.id] || 0;
              const maxed = lv >= p.costs.length;
              const cost = p.costs[lv];
              return (
                <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex justify-between"><b className="text-amber-100">{p.icon} {p.name}</b><span className="text-xs text-violet-300">Lv {lv}/{p.costs.length}</span></div>
                  <p className="text-xs text-violet-300 my-2">{p.desc}</p>
                  <Btn variant="primary" disabled={maxed || save.marks < cost} onClick={() => onBuy(p.id)} className="w-full !py-1">{maxed ? "Maxed" : `Unlock · ${cost} marks`}</Btn>
                </div>
              );
            })}
            <p className="sm:col-span-2 text-xs text-violet-400">Earn marks when a dynasty ends: more generations, bosses slain, and a victory award more.</p>
          </div>
        )}
        {tab === 1 && (
          <div className="space-y-2">
            {save.hall.length === 0 && <p className="text-violet-300 text-sm">No dynasties have ended yet. Your legend begins when the first line falls, or triumphs.</p>}
            {save.hall.map((h: HallEntry, i) => (
              <div key={i} className={`rounded-lg border p-3 text-sm ${h.result === "won" ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex justify-between"><b className="font-title text-lg">{h.result === "won" ? "👑" : "🪦"} House {h.house}</b><span className="text-amber-200 font-bold">{h.score} pts</span></div>
                <div className="text-violet-300 text-xs">{h.reason} · {h.gens} gens · {h.years} yrs · {h.bosses} bosses · {h.difficulty}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4"><Btn variant="ghost" onClick={onBack}>← Back</Btn></div>
      </div>
    </div>
  );
}
