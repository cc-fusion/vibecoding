import { useState } from "react";
import type { ReactNode } from "react";
import { DIFFICULTIES, MODIFIERS, PESTS, REACTIONS, RESEARCH, SPELLS, STRUCTS } from "../game/data";
import type { PestKind } from "../game/data";
import { getSave, updateSave, resetSave } from "../game/save";
import { audio } from "../game/audio";

export function Btn({ children, onClick, kind = "primary", className = "", disabled = false }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger" | "gold"; className?: string; disabled?: boolean }) {
  const base = "rounded-xl px-5 py-2.5 font-bold tracking-wide transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none ";
  const k =
    kind === "primary"
      ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_4px_0_#0b4a7a] hover:brightness-110"
      : kind === "gold"
        ? "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_4px_0_#92600a] hover:brightness-110"
        : kind === "danger"
          ? "bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_4px_0_#7a1a2a] hover:brightness-110"
          : "bg-white/10 text-slate-100 border border-white/20 hover:bg-white/20";
  return (
    <button
      disabled={disabled}
      className={base + k + " " + className}
      onClick={() => {
        audio.init();
        audio.startMusic();
        audio.click();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"rounded-2xl border border-white/15 bg-slate-900/80 backdrop-blur-md shadow-2xl " + className}>{children}</div>;
}

export function Title({ onPlay, onResearch, onHelp, onSettings }: { onPlay: () => void; onResearch: () => void; onHelp: () => void; onSettings: () => void }) {
  const s = getSave();
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="pointer-events-none absolute inset-0">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="ww-cloud absolute text-7xl opacity-60 md:text-9xl" style={{ top: `${6 + i * 13}%`, animationDuration: `${40 + i * 9}s`, animationDelay: `-${i * 11}s` }}>
            {i % 3 === 0 ? "⛈️" : i % 3 === 1 ? "☁️" : "🌧️"}
          </div>
        ))}
        <div className="ww-flash absolute inset-0 bg-white" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="text-6xl drop-shadow-lg md:text-7xl">🌩️🌾</div>
        <h1 className="ww-title text-5xl font-black tracking-tight text-amber-100 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] md:text-7xl">Weather Warden</h1>
        <p className="max-w-xl text-base text-sky-100/90 md:text-lg">Command wind, rain, lightning, fire and frost. Chain the elements. Defend the harvest.</p>
        <div className="mt-6 flex w-64 flex-col gap-3">
          <Btn kind="gold" onClick={onPlay} className="text-xl">▶ Play</Btn>
          <Btn onClick={onResearch}>🌱 Research {s.seeds > 0 && <span className="ml-1 rounded-full bg-amber-300 px-2 py-0.5 text-xs text-slate-900">{s.seeds} seeds</span>}</Btn>
          <Btn kind="ghost" onClick={onHelp}>📖 How to Play</Btn>
          <Btn kind="ghost" onClick={onSettings}>⚙ Settings</Btn>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-sky-100/70">
          <span>Runs: {s.runs}</span>
          <span>Victories: {s.wins}</span>
          <span>Best wave: {s.bestWave}</span>
          <span>Best score: {s.bestScore}</span>
          <span>Pests swept: {s.kills}</span>
        </div>
      </div>
    </div>
  );
}

export function Setup({ onStart, onBack }: { onStart: (diff: string, mods: string[], tutorial: boolean) => void; onBack: () => void }) {
  const s = getSave();
  const [diff, setDiff] = useState(s.settings.difficulty);
  const [mods, setMods] = useState<string[]>(s.settings.mods);
  const [tut, setTut] = useState(!s.tutorialDone);
  const d = DIFFICULTIES.find((x) => x.id === diff) || DIFFICULTIES[1];
  const bonus = mods.reduce((a, id) => a + (MODIFIERS.find((m) => m.id === id)?.seed || 0), 0);
  const total = d.seed * (1 + bonus);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4">
      <Panel className="w-full max-w-3xl p-5 md:p-7">
        <h2 className="mb-1 text-3xl font-black text-amber-100">Prepare the Season</h2>
        <p className="mb-4 text-sm text-slate-300">Survive 12 waves, defeat the Thornback Titan (wave 6) and the Locust Queen (wave 12). Then keep going in Endless mode.</p>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-sky-300">Difficulty</div>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          {DIFFICULTIES.map((x) => (
            <button key={x.id} onClick={() => { audio.click(); setDiff(x.id); }} className={"rounded-xl border p-3 text-left transition " + (diff === x.id ? "border-amber-300 bg-amber-300/15" : "border-white/15 bg-white/5 hover:bg-white/10")}>
              <div className="font-bold text-white">{x.name}</div>
              <div className="text-xs text-slate-300">{x.desc}</div>
            </button>
          ))}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-sky-300">Modifiers (extra seeds)</div>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {MODIFIERS.map((m) => {
            const on = mods.includes(m.id);
            return (
              <button key={m.id} onClick={() => { audio.click(); setMods(on ? mods.filter((q) => q !== m.id) : [...mods, m.id]); }} className={"flex items-center gap-3 rounded-xl border p-3 text-left transition " + (on ? "border-emerald-300 bg-emerald-300/15" : "border-white/15 bg-white/5 hover:bg-white/10")}>
                <span className="text-2xl">{m.icon}</span>
                <span>
                  <span className="block font-bold text-white">{m.name} <span className="text-xs text-amber-300">+{Math.round(m.seed * 100)}% seeds</span></span>
                  <span className="block text-xs text-slate-300">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={tut} onChange={(e) => setTut(e.target.checked)} className="h-4 w-4" />
          Guided tutorial (the first wave waits until you finish it)
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-200">Seed reward multiplier: x{total.toFixed(2)}</div>
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={onBack}>Back</Btn>
            <Btn kind="gold" onClick={() => {
              updateSave((sv) => { sv.settings.difficulty = diff; sv.settings.mods = mods; });
              onStart(diff, mods, tut);
            }}>Begin Season ▶</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function Research({ onBack, refresh }: { onBack: () => void; refresh: () => void }) {
  const [, force] = useState(0);
  const s = getSave();
  const branches = ["Aether", "Growth", "Storm", "Arsenal"] as const;
  const colors: Record<string, string> = { Aether: "text-violet-300", Growth: "text-lime-300", Storm: "text-yellow-300", Arsenal: "text-orange-300" };
  const buy = (id: string) => {
    const n = RESEARCH.find((r) => r.id === id)!;
    const cur = getSave();
    if (cur.owned.includes(id) || cur.seeds < n.cost || (n.req && !cur.owned.includes(n.req))) {
      audio.deny();
      return;
    }
    updateSave((d) => {
      d.seeds -= n.cost;
      d.owned.push(id);
    });
    audio.build();
    force((x) => x + 1);
    refresh();
  };
  return (
    <div className="flex h-full w-full flex-col overflow-hidden p-3 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-3xl font-black text-amber-100">Research Grove</h2>
          <p className="text-sm text-slate-300">Spend seeds earned from seasons. Upgrades persist between runs.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-300/20 px-4 py-2 text-xl font-black text-amber-200">🌱 {s.seeds} seeds</div>
          <Btn kind="ghost" onClick={onBack}>Back</Btn>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto pb-4 md:grid-cols-2 xl:grid-cols-4">
        {branches.map((b) => (
          <Panel key={b} className="p-3">
            <div className={"mb-2 text-sm font-black uppercase tracking-widest " + colors[b]}>{b}</div>
            <div className="flex flex-col gap-2">
              {RESEARCH.filter((r) => r.branch === b).map((r) => {
                const owned = s.owned.includes(r.id);
                const locked = !!r.req && !s.owned.includes(r.req);
                const can = !owned && !locked && s.seeds >= r.cost;
                return (
                  <button key={r.id} onClick={() => buy(r.id)} className={"flex items-start gap-3 rounded-xl border p-2.5 text-left transition " + (owned ? "border-emerald-400/60 bg-emerald-400/10" : locked ? "border-white/10 bg-black/20 opacity-50" : can ? "border-amber-300 bg-amber-300/10 hover:bg-amber-300/20" : "border-white/15 bg-white/5")}>
                    <span className="text-2xl">{r.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-white">{r.name}</span>
                      <span className="block text-xs text-slate-300">{r.desc}</span>
                      {r.req && <span className="block text-[10px] text-slate-400">Requires: {RESEARCH.find((q) => q.id === r.req)?.name}</span>}
                    </span>
                    <span className={"text-sm font-black " + (owned ? "text-emerald-300" : "text-amber-300")}>{owned ? "✔" : "🌱" + r.cost}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose, inGame, difficulty, onDifficulty }: { onClose: () => void; inGame?: boolean; difficulty?: string; onDifficulty?: (id: string) => void }) {
  const [, force] = useState(0);
  const s = getSave().settings;
  const set = (fn: (st: typeof s) => void) => {
    const n = updateSave((d) => fn(d.settings));
    audio.setVolumes(n.settings);
    force((x) => x + 1);
  };
  const slider = (label: string, key: "master" | "music" | "sfx") => (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <span className="w-20">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => set((st) => { st[key] = Number(e.target.value); })} onPointerUp={() => audio.click()} className="flex-1 accent-sky-400" />
      <span className="w-10 text-right text-xs">{Math.round(s[key] * 100)}%</span>
    </label>
  );
  return (
    <Panel className="w-full max-w-md p-5">
      <h2 className="mb-3 text-2xl font-black text-amber-100">Settings</h2>
      <div className="flex flex-col gap-3">
        {slider("Master", "master")}
        {slider("Music", "music")}
        {slider("Effects", "sfx")}
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={s.muted} onChange={(e) => set((st) => { st.muted = e.target.checked; })} className="h-4 w-4" /> Mute all sound (M)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={s.shake} onChange={(e) => set((st) => { st.shake = e.target.checked; })} className="h-4 w-4" /> Screen shake
        </label>
        {inGame && onDifficulty && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-sky-300">Difficulty (applies to upcoming waves)</div>
            <div className="flex flex-col gap-1">
              {DIFFICULTIES.map((d) => (
                <button key={d.id} onClick={() => { audio.click(); onDifficulty(d.id); }} className={"rounded-lg border px-3 py-1.5 text-left text-sm " + (difficulty === d.id ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10")}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {!inGame && (
          <Btn kind="danger" className="text-sm" onClick={() => { if (window.confirm("Erase all progress, seeds and research?")) { resetSave(); audio.setVolumes(getSave().settings); force((x) => x + 1); } }}>Erase save data</Btn>
        )}
      </div>
      <div className="mt-4 flex justify-end"><Btn onClick={onClose}>Done</Btn></div>
    </Panel>
  );
}

const CONTROLS: [string, string][] = [
  ["1 – 5", "Select a spell: Rain, Gale, Lightning, Heat, Frost"],
  ["6 – 9, 0", "Select a structure to build"],
  ["Left click / tap", "Cast the selected spell or place the structure"],
  ["Click + drag", "Aim the Gale Gust (direction of the drag)"],
  ["Click a structure", "Select it (no tool) → Upgrade / Rotate / Sell"],
  ["Right click / Q", "Clear the selected tool"],
  ["R", "Rotate a Wind Fan (selected or while placing)"],
  ["U / X", "Upgrade / sell the selected structure"],
  ["Space", "Call the next wave early for a gold bonus"],
  ["F", "Toggle fast-forward"],
  ["P / Esc", "Pause menu"],
  ["M", "Mute / unmute"],
  ["Gamepad", "Left stick aims, A casts, B clears, LB/RB cycle tools, Y calls wave, Start pauses"],
];

export function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ["How to Play", "Reactions", "Pests", "Controls"];
  return (
    <Panel className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-amber-100">Warden's Handbook</h2>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => { audio.click(); setTab(i); }} className={"rounded-lg px-3 py-1.5 text-sm font-bold " + (tab === i ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 text-sm text-slate-200">
        {tab === 0 && (
          <div className="flex flex-col gap-3">
            <p><b className="text-amber-200">Goal:</b> pests march in from the west to devour your crops. If fewer than 5 of your 24 plots survive, the farm collapses. Survive 12 waves (two bosses!) to win, then push on in Endless mode.</p>
            <p><b className="text-sky-300">Aether</b> is your spell mana. It regenerates faster while your farm is healthy and while you keep a reaction <b>combo</b> alive.</p>
            <p><b className="text-lime-300">Crops</b> grow when the ground is moist and the temperature is mild. Too dry, too cold or too hot and they stall, wilt or die. Ripe crops auto-harvest for gold. Click a ruined plot to replant it (25 gold).</p>
            <p><b className="text-yellow-300">The ground is a living grid</b>: every tile tracks moisture, temperature, ice, fire, steam and wind. Your spells change those values, and the values change how pests move, how lightning conducts and how fires spread.</p>
            <p><b className="text-orange-300">Weather fronts</b> roll in on their own: drizzle, heat waves, cold snaps, thunderstorms and gales. The forecast in the top bar warns you. Turn each one to your advantage, or protect your crops from it.</p>
            <p><b className="text-emerald-300">Structures</b> cost gold and can be upgraded to level 3. Lightning Rods ground nearby crops and attract natural bolts. Wind Fans, Totems, Lamps and Spires reshape the weather permanently.</p>
            <p><b className="text-violet-300">Seeds</b> earned at the end of every run buy permanent research: bigger Aether pools, stronger lightning, tougher crops and new spells.</p>
            <p className="text-slate-400">Tip: Rain + Lightning is your bread and butter. Freeze a boss, then shatter it. Never strike dry ground near your crops, or they will burn.</p>
          </div>
        )}
        {tab === 1 && (
          <div className="grid gap-2 md:grid-cols-2">
            {REACTIONS.map((r) => (
              <div key={r.name} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-black text-yellow-200">{r.name}</div>
                <div className="text-xs font-bold text-sky-300">{r.recipe}</div>
                <div className="text-xs text-slate-300">{r.desc}</div>
              </div>
            ))}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2 text-xs text-slate-300">
              Each reaction raises your <b>combo</b>: bonus Aether, faster regen, more gold from kills and harvests, and a bigger score. The combo fades after a few seconds without a reaction.
              <div className="mt-2 text-slate-400">Spells: {SPELLS.map((s) => s.icon + " " + s.name).join(" · ")}</div>
              <div className="text-slate-400">Structures: {STRUCTS.map((s) => s.icon + " " + s.name).join(" · ")}</div>
            </div>
          </div>
        )}
        {tab === 2 && (
          <div className="grid gap-2 md:grid-cols-2">
            {(Object.keys(PESTS) as PestKind[]).map((k) => (
              <div key={k} className={"flex gap-3 rounded-xl border p-3 " + (PESTS[k].boss ? "border-rose-400/50 bg-rose-400/10" : "border-white/10 bg-white/5")}>
                <div className="text-3xl">{PESTS[k].emoji}</div>
                <div>
                  <div className="font-black text-white">{PESTS[k].name} {PESTS[k].boss && <span className="text-xs text-rose-300">BOSS</span>}</div>
                  <div className="text-xs text-slate-300">{PESTS[k].desc}</div>
                  <div className="mt-1 text-[10px] text-slate-400">Appears from wave {PESTS[k].unlockWave} · {PESTS[k].fly ? "Flying" : "Ground"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 3 && (
          <div className="flex flex-col gap-1">
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="flex gap-3 rounded-lg bg-white/5 px-3 py-1.5">
                <span className="w-36 shrink-0 font-bold text-amber-200">{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="mt-2 text-xs text-slate-400">Touch: tap tools in the bottom bar, then tap the field. Drag for the Gale.</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end"><Btn onClick={onClose}>Close</Btn></div>
    </Panel>
  );
}
