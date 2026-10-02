import { useState } from "react";
import { BRANCHES, DIFFICULTIES, MODS, PERKS, ROLES, SCENARIOS, type Role } from "../game/data";
import type { SaveData, Settings } from "../game/save";
import { sfx } from "../game/audio";
import { Btn, Card, Chip, Overlay } from "./common";

export interface RunCfg { scenarioId: string; difficultyId: string; mods: string[]; tutorial: boolean }

export function isUnlocked(save: SaveData, i: number) {
  return i === 0 || (save.cleared[SCENARIOS[i - 1].id]?.wins ?? 0) > 0;
}

/* ---------------- Title ---------------- */
export function TitleScreen({ save, onPlay, onPerks, onHelp, onSettings }: { save: SaveData; onPlay: () => void; onPerks: () => void; onHelp: () => void; onSettings: () => void }) {
  const cleared = SCENARIOS.filter((s) => (save.cleared[s.id]?.wins ?? 0) > 0).length;
  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col items-center justify-center text-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #3a1c2a 0%, #150d1a 55%, #07050a 100%)" }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} className="absolute rounded-full pointer-events-none" style={{
          left: `${(i * 37) % 100}%`, bottom: -10, width: 2 + (i % 3), height: 2 + (i % 3), background: "#ffd89a",
          animation: `drift ${9 + (i % 7) * 2}s linear ${(i % 9) * 1.3}s infinite`, boxShadow: "0 0 6px #ffb050",
        }} />
      ))}
      <div className="text-6xl sm:text-7xl mb-2 anim-flicker">👑</div>
      <h1 className="font-display font-black gold-text leading-none text-4xl sm:text-6xl md:text-7xl drop-shadow-[0_4px_20px_rgba(227,185,90,0.35)]">COUP D'ETAT</h1>
      <h2 className="font-display tracking-[0.5em] text-lg sm:text-2xl text-[#c9a6ff] mt-2">PROTOCOL</h2>
      <p className="max-w-xl mt-5 text-base sm:text-lg italic text-[#b9ab8c]">
        Recruit. Bribe. Blackmail. Whisper. Place your conspirators on the palace chessboard — then seize the throne before the heir is crowned.
      </p>
      <div className="mt-8 flex flex-col gap-3 w-64 sm:w-72 anim-fadeup">
        <Btn onClick={onPlay} className="text-lg py-3">⚔ Begin Conspiracy</Btn>
        <Btn variant="dark" onClick={onPerks}>🗝 Archive of Seals <span className="text-[#e3b95a]">({save.seals})</span></Btn>
        <Btn variant="dark" onClick={onHelp}>📖 How to Play</Btn>
        <Btn variant="dark" onClick={onSettings}>⚙ Settings</Btn>
      </div>
      <div className="mt-6 text-sm text-[#8a7d66]">
        Courts overthrown: <span className="text-[#e3b95a]">{cleared}/{SCENARIOS.length}</span> · Runs: {save.runs} · Victories: {save.wins}
      </div>
    </div>
  );
}

/* ---------------- Campaign ---------------- */
export function CampaignScreen({ save, cfg, setCfg, onStart, onBack }: { save: SaveData; cfg: RunCfg; setCfg: (c: RunCfg) => void; onStart: () => void; onBack: () => void }) {
  const idx = Math.max(0, SCENARIOS.findIndex((s) => s.id === cfg.scenarioId));
  const scn = SCENARIOS[idx];
  const diff = DIFFICULTIES.find((d) => d.id === cfg.difficultyId) ?? DIFFICULTIES[1];
  const mult = diff.mult * cfg.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus ?? 0), 1);
  const rec = save.cleared[scn.id];
  return (
    <div className="h-full w-full overflow-y-auto bg-[#0d0a10] p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a30 0%, #0d0a10 60%)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl sm:text-3xl gold-text font-bold">Campaign of Courts</h2>
          <Btn variant="ghost" onClick={onBack}>← Back</Btn>
        </div>
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <div className="flex flex-col gap-2">
            {SCENARIOS.map((s, i) => {
              const un = isUnlocked(save, i);
              const r = save.cleared[s.id];
              return (
                <button key={s.id} disabled={!un}
                  onClick={() => { sfx("select"); setCfg({ ...cfg, scenarioId: s.id }); }}
                  className={`btn text-left rounded-lg border p-3 flex items-center gap-3 ${cfg.scenarioId === s.id ? "border-[#e3b95a] bg-[#2a1f33]" : "border-[#3c3046] bg-[#1a1422]"} ${un ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                  <span className="text-3xl w-10 text-center">{un ? s.icon : "🔒"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-sm font-bold" style={{ color: s.accent }}>{i + 1}. {s.court}</span>
                    <span className="block text-sm text-[#cdbd9a] truncate">{un ? s.name : "Overthrow the previous court to unlock"}</span>
                    {r && <span className="block text-xs text-[#8a7d66]">Best {r.best.toLocaleString()} · {r.wins} win{r.wins === 1 ? "" : "s"}</span>}
                  </span>
                  {r && r.wins > 0 && <span className="text-xl">🏆</span>}
                </button>
              );
            })}
          </div>
          <Card className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="text-5xl">{scn.icon}</span>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-bold" style={{ color: scn.accent }}>{scn.name}</h3>
                <div className="text-[#cdbd9a]">{scn.monarchName} · <span className="text-[#e3b95a]">{scn.days - (cfg.mods.includes("fuse") ? 2 : 0)} days</span> to succession</div>
              </div>
            </div>
            <p className="mt-3 text-[#b9ab8c] italic text-lg leading-snug">{scn.blurb}</p>
            <p className="mt-2 text-[#e9dcc0]"><span className="text-[#e3b95a] font-display text-sm">OBJECTIVE</span> — {scn.objective}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip color="#c9604a">Garrison ×{scn.garrisonMul}</Chip>
              <Chip color="#8a6fb8">Spymaster ×{scn.spySkill}</Chip>
              <Chip color="#7aa7c9">Unrest {scn.unrest}</Chip>
              <Chip color="#e3b95a">Paranoia {scn.paranoia}</Chip>
              {scn.boss && <Chip color="#ff4d4d">☠ BOSS: The Hollow Knight</Chip>}
              {rec && <Chip color="#7cff9f">Best: {rec.best.toLocaleString()}</Chip>}
            </div>

            <h4 className="font-display text-sm text-[#e3b95a] mt-4 mb-1">DIFFICULTY</h4>
            <div className="grid sm:grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d.id} onClick={() => { sfx("select"); setCfg({ ...cfg, difficultyId: d.id }); }}
                  className={`btn text-left rounded-lg border p-2 cursor-pointer ${cfg.difficultyId === d.id ? "border-[#e3b95a] bg-[#2f2338]" : "border-[#3c3046] bg-[#1a1422]"}`}>
                  <div className="font-display text-sm font-bold">{d.name} <span className="text-xs text-[#8a7d66]">×{d.mult}</span></div>
                  <div className="text-xs text-[#a89a80] leading-tight">{d.desc}</div>
                </button>
              ))}
            </div>

            <h4 className="font-display text-sm text-[#e3b95a] mt-4 mb-1">MODIFIERS <span className="text-[#8a7d66] normal-case">(bonus seals & score)</span></h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {MODS.map((m) => {
                const on = cfg.mods.includes(m.id);
                return (
                  <button key={m.id} onClick={() => { sfx("click"); setCfg({ ...cfg, mods: on ? cfg.mods.filter((x) => x !== m.id) : [...cfg.mods, m.id] }); }}
                    className={`btn text-left rounded-lg border p-2 flex gap-2 items-center cursor-pointer ${on ? "border-[#b3263e] bg-[#2d1520]" : "border-[#3c3046] bg-[#1a1422]"}`}>
                    <span className="text-2xl">{m.icon}</span>
                    <span className="flex-1">
                      <span className="block font-display text-xs font-bold">{m.name} <span className="text-[#e3b95a]">+{Math.round(m.bonus * 100)}%</span></span>
                      <span className="block text-xs text-[#a89a80] leading-tight">{m.desc}</span>
                    </span>
                    <span className={`w-4 h-4 rounded border ${on ? "bg-[#b3263e] border-[#ff7a8c]" : "border-[#5a4a34]"}`} />
                  </button>
                );
              })}
            </div>
            {scn.tutorial && (
              <label className="mt-4 flex items-center gap-2 text-[#cdbd9a] cursor-pointer">
                <input type="checkbox" checked={cfg.tutorial} onChange={(e) => setCfg({ ...cfg, tutorial: e.target.checked })} />
                Show guided tutorial objectives
              </label>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[#b9ab8c]">Score multiplier <span className="text-[#e3b95a] font-bold">×{mult.toFixed(2)}</span></div>
              <Btn onClick={onStart} className="text-lg px-8 py-3">Enter the Court →</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Perks ---------------- */
export function PerksScreen({ save, onBuy, onBack }: { save: SaveData; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <div className="h-full w-full overflow-y-auto p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a30 0%, #0d0a10 60%)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-2xl sm:text-3xl gold-text font-bold">Archive of Seals</h2>
          <Btn variant="ghost" onClick={onBack}>← Back</Btn>
        </div>
        <p className="text-[#b9ab8c] mb-4">Seals earned in every run (win or lose) buy permanent boons. Each branch unlocks in order. You have <span className="text-[#e3b95a] font-bold text-xl">{save.seals} 🔱</span></p>
        <div className="grid md:grid-cols-3 gap-4">
          {(Object.keys(BRANCHES) as (keyof typeof BRANCHES)[]).map((b) => {
            const br = BRANCHES[b];
            const list = PERKS.filter((p) => p.branch === b);
            return (
              <Card key={b} className="p-3">
                <h3 className="font-display font-bold text-lg" style={{ color: br.color }}>{br.name}</h3>
                <p className="text-sm text-[#a89a80] mb-3">{br.blurb}</p>
                <div className="flex flex-col gap-2">
                  {list.map((p, i) => {
                    const lvl = save.perks[p.id] ?? 0;
                    const prev = i === 0 ? 3 : save.perks[list[i - 1].id] ?? 0;
                    const locked = prev < 1;
                    const maxed = lvl >= p.costs.length;
                    const cost = p.costs[lvl];
                    const can = !locked && !maxed && save.seals >= cost;
                    return (
                      <div key={p.id} className={`rounded-lg border p-2 ${locked ? "opacity-45 border-[#2c2236]" : "border-[#4a3a5a]"} bg-[#1a1422]`}>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{locked ? "🔒" : p.icon}</span>
                          <div className="flex-1">
                            <div className="font-display text-sm font-bold">{p.name}</div>
                            <div className="text-xs text-[#a89a80] leading-tight">{p.desc}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex gap-1">{p.costs.map((_, k) => <span key={k} className={`w-4 h-2 rounded-sm ${k < lvl ? "" : "bg-[#2e2438]"}`} style={k < lvl ? { background: br.color } : undefined} />)}</div>
                          {maxed ? <Chip color="#7cff9f">MAX</Chip> : (
                            <Btn variant={can ? "gold" : "dark"} disabled={!can} onClick={() => onBuy(p.id)} className="!py-0.5 !px-3 !text-xs">
                              {locked ? "Locked" : `Buy · ${cost} 🔱`}
                            </Btn>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Help ---------------- */
const HELP_TABS = ["Goal", "The Loop", "Actions", "Roles", "The Coup", "Controls"] as const;
export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof HELP_TABS)[number]>("Goal");
  const roles: Role[] = ["captain", "general", "treasurer", "priest", "spymaster", "physician", "scribe", "chef", "assassin", "courtier", "servant"];
  return (
    <Overlay z={80} onBack={onClose}>
      <Card className="w-full max-w-3xl max-h-[92vh] flex flex-col anim-pop">
        <div className="flex items-center justify-between p-3 border-b border-[#3c3046]">
          <h3 className="font-display text-xl gold-text font-bold">📖 Conspirator's Handbook</h3>
          <Btn variant="ghost" onClick={onClose} className="!py-1">Close ✕</Btn>
        </div>
        <div className="flex flex-wrap gap-1 p-2 border-b border-[#3c3046]">
          {HELP_TABS.map((t) => (
            <button key={t} onClick={() => { sfx("click"); setTab(t); }} className={`btn font-display text-xs sm:text-sm px-3 py-1 rounded cursor-pointer ${tab === t ? "bg-[#e3b95a] text-black" : "bg-[#241c2e] text-[#cdbd9a]"}`}>{t}</button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto text-[#e9dcc0] text-base sm:text-lg leading-snug space-y-3">
          {tab === "Goal" && (<>
            <p><b className="text-[#e3b95a]">Seize the throne.</b> A palace full of nobles follows daily schedules through its rooms. You are the unseen hand who recruits conspirators, positions them, and finally <b>launches a coup</b> to capture the Monarch — before <b>Succession Day</b>, when the heir is crowned and you lose.</p>
            <p><b className="text-[#b3263e]">You lose if</b> your <b>Evidence</b> meter reaches 100 (you're exposed), if Succession Day arrives, or if your coup is crushed or the relief army arrives first.</p>
            <p>Resources: <b>💰 Gold</b> (bribes, stipends, recruits), <b>⚡ Influence</b> (whispers, regenerates), <b>📝 Forgeries</b> (frame enemies).</p>
            <p>Hidden info: everyone starts mostly unknown. <b>Eavesdrop</b> to reveal exact loyalty, ambition, traits and secrets. Unknown stats are shown as fuzzy estimates.</p>
          </>)}
          {tab === "The Loop" && (<>
            <p><b className="text-[#e3b95a]">1. Scout.</b> Click a courtier. Eavesdrop to learn what they want and what they hide.</p>
            <p><b className="text-[#e3b95a]">2. Recruit.</b> Recruit, bribe or blackmail. Actions need an agent in the <i>same room</i> — otherwise a courier is used (double cost, intercept risk). Every action can be <b>witnessed</b>; loyal witnesses raise Evidence.</p>
            <p><b className="text-[#e3b95a]">3. Position.</b> Select an agent, click a room. Agents hold their post until recalled. Each role has a <b>power that only works in the right room</b> (look for the ✦ glow).</p>
            <p><b className="text-[#e3b95a]">4. Whisper.</b> Rumors spread by gossip where NPCs share rooms. <b>Doubt</b> raises Unrest. <b>Scandal</b> disgraces a target when the Monarch hears. <b>Frame</b> sends the Spymaster after someone else.</p>
            <p><b className="text-[#e3b95a]">5. Survive the Spymaster.</b> He investigates your agents, especially those in his room. Exposure above 100 means arrest. Bribe him, bury reports, or frame him.</p>
            <p><b className="text-[#e3b95a]">6. Strike.</b> Check the Coup tab forecast, then launch.</p>
            <p className="text-[#b9ab8c] text-base">Systems interlock: Unrest + Legitimacy shrink garrisons; Paranoia triggers purges and raises evidence; unpaid stipends sour agents; Monarch Vigor weakens the Champion; arrested figures vanish from the loyalist ranks.</p>
          </>)}
          {tab === "Actions" && (
            <div className="space-y-2 text-base">
              <p><b>👂 Eavesdrop</b> – reveal stats, trait, maybe a secret. <b>🤝 Recruit</b> – odds depend on crown loyalty, ambition, trait, legitimacy.</p>
              <p><b>💰 Bribe</b> – +favor, −crown loyalty (greedy love it; honorable may be insulted). <b>🩸 Blackmail</b> – needs a known secret; coerced agents may defect in the coup.</p>
              <p><b>🌫️ Sow Doubt</b> – a rumor that lowers crown loyalty and raises Unrest. <b>📰 Scandal</b> – pick a spreader, then a target. Groundless scandals are weaker than ones using a known secret.</p>
              <p><b>📝 Frame</b> – costs a Forgery (Archivist makes them). <b>🗡️ Silence</b> – requires your Shadow Blade in the same room. <b>🔓 Break Out</b> – free an arrested NPC; they will swear to you (yes, even the Champion).</p>
              <p><b>🎁 Reward</b> – pay an agent to boost devotion. Agents under 15 devotion betray you.</p>
            </div>
          )}
          {tab === "Roles" && (
            <div className="space-y-2 text-base">
              {roles.map((r) => {
                const d = ROLES[r];
                return (
                  <div key={r} className="rounded-lg border border-[#3c3046] bg-[#1a1422] p-2">
                    <div className="font-display text-sm font-bold" style={{ color: d.color }}>{d.icon} {d.title} <span className="text-[#8a7d66] font-normal">· ~{d.followers} followers</span></div>
                    <div className="text-[#a89a80] text-sm">{d.blurb}</div>
                    {d.ability && <div className="text-sm"><b className="text-[#e3b95a]">{d.ability.name}</b> <span className="text-[#8a7d66]">({d.ability.room === "any" ? "anywhere" : `in ${d.ability.room}`})</span> — {d.ability.desc}</div>}
                  </div>
                );
              })}
              <div className="rounded-lg border border-[#5a2a3a] bg-[#1f1018] p-2 text-sm"><b>🛡️ Royal Champion</b> — a boss-like defender of the Monarch. Recruit, frame, silence or weaken him before the coup.</div>
            </div>
          )}
          {tab === "The Coup" && (<>
            <p>Launching freezes the court. Each agent becomes a <b>squad</b> wherever they stand (size by role, perks, Marshal's Muster). Loyalists hold garrisons; the Monarch flees to the <b>Royal Chamber</b> with his Champion.</p>
            <p><b className="text-[#e3b95a]">Fighting</b> follows a square law — concentrate your squads. Squads stop at defended rooms; give new orders to continue.</p>
            <p><b className="text-[#e3b95a]">Win</b> by holding the Monarch's room with no defenders for 4 seconds. <b className="text-[#b3263e]">Lose</b> if all squads die or the relief army arrives (150s).</p>
            <ul className="list-disc pl-5 text-base space-y-1">
              <li>🏰 Gatehouse: relief delayed +45s</li><li>⚔️ Barracks: stops loyalist reinforcements</li><li>🛡️ Armory: +15% rebel damage</li>
              <li>⛪ Chapel: +10% rebel damage</li><li>💰 Treasury: mercenary squads</li><li>⛓️ Dungeon: freed prisoners join you</li><li>👑 Throne Room: −10% loyalist damage</li>
            </ul>
            <p className="text-[#b9ab8c] text-base">Champions call for aid when wounded. The Hollow Knight (final court) enters a fury at 33% health.</p>
          </>)}
          {tab === "Controls" && (
            <div className="grid sm:grid-cols-2 gap-3 text-base">
              <div className="rounded-lg border border-[#3c3046] p-3"><b className="text-[#e3b95a]">Mouse / Touch</b><ul className="mt-1 space-y-1"><li>Click token → select NPC</li><li>Click room → send selected agent (or squads)</li><li>Right-click room → quick order</li><li>Shift+click squad → add to selection</li><li>Tap works the same on touch</li></ul></div>
              <div className="rounded-lg border border-[#3c3046] p-3"><b className="text-[#e3b95a]">Keyboard</b><ul className="mt-1 space-y-1"><li><kbd>Space</kbd> pause · <kbd>1 2 3</kbd> speed</li><li><kbd>Tab</kbd> cycle NPCs / squads</li><li><kbd>Esc</kbd> cancel / pause menu</li><li><kbd>W</kbd> toggle relationship web</li><li><kbd>C</kbd> coup tab · <kbd>A</kbd> select all squads</li><li><kbd>M</kbd> mute · <kbd>H</kbd> help</li></ul></div>
            </div>
          )}
        </div>
      </Card>
    </Overlay>
  );
}

/* ---------------- Settings ---------------- */
export function SettingsModal({ settings, onChange, onClose, onReset }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const slider = (label: string, key: "master" | "music" | "sfx") => (
    <label className="flex items-center gap-3">
      <span className="w-24 font-display text-sm">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={settings[key]} onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })} className="flex-1" />
      <span className="w-10 text-right text-sm text-[#b9ab8c]">{Math.round(settings[key] * 100)}</span>
    </label>
  );
  return (
    <Overlay z={90} onBack={onClose}>
      <Card className="w-full max-w-md p-5 anim-pop">
        <h3 className="font-display text-xl gold-text font-bold mb-4">⚙ Settings</h3>
        <div className="space-y-3">
          {slider("Master", "master")}
          {slider("Music", "music")}
          {slider("Effects", "sfx")}
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.muted} onChange={(e) => onChange({ ...settings, muted: e.target.checked })} /> Mute all audio</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.shake} onChange={(e) => onChange({ ...settings, shake: e.target.checked })} /> Screen shake</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.hints} onChange={(e) => onChange({ ...settings, hints: e.target.checked })} /> Show in-game hints</label>
        </div>
        <div className="mt-5 flex justify-between items-center">
          {confirm ? (
            <div className="flex gap-2 items-center"><span className="text-sm text-[#ff7a8c]">Erase all progress?</span><Btn variant="red" className="!py-1 !text-xs" onClick={() => { onReset(); setConfirm(false); }}>Yes</Btn><Btn variant="dark" className="!py-1 !text-xs" onClick={() => setConfirm(false)}>No</Btn></div>
          ) : <Btn variant="ghost" className="!text-xs" onClick={() => setConfirm(true)}>Reset save</Btn>}
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </Card>
    </Overlay>
  );
}
