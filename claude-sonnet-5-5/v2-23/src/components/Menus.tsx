import { useEffect, useRef, useState } from "react";
import type { Meta, Settings } from "../game/save";
import {
  DIFFICULTIES, MUTAGENS, LAB_UPGRADES, PART_LIST, TAGS, TAG_META, SYNERGIES, SLOTS, SLOT_LABEL, ROW_NAMES, BOSSES, FINAL_ROUND,
  partDesc, partStats, FX_TEXT,
} from "../game/data";
import { drawChimera, type DrawPart } from "../game/draw";
import { calcScore, calcEssence, mutMult, diffOf, type RunState } from "../game/run";
import { Modal, Slider, Toggle, Kbd } from "./ui";
import { audio } from "../game/audio";

// ---------------- Title ----------------
function TitleScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const rnd = () => TAGS[Math.floor(Math.random() * 5)];
    const mk = (): (DrawPart | null)[] => [0, 1, 2, 3].map(() => ({ tag: rnd(), tier: 1 + Math.floor(Math.random() * 3) }));
    const beasts = [mk(), mk(), mk()];
    const embers = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.06, s: 1 + Math.random() * 2 }));
    let raf = 0, last = performance.now(), t = 0, cycle = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; cycle += dt;
      if (cycle > 6) { cycle = 0; beasts[Math.floor(Math.random() * 3)] = mk(); }
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) { e.y -= e.v * dt; if (e.y < 0) { e.y = 1; e.x = Math.random(); } ctx.fillStyle = "rgba(255,138,61,.7)"; ctx.beginPath(); ctx.arc(e.x * w + Math.sin(t + e.x * 9) * 8, e.y * h, e.s, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = "source-over";
      const s = Math.min(w / 700, h / 340, 2.4);
      beasts.forEach((b, i) => drawChimera(ctx, b, w / 2 + (i - 1) * 190 * s, h - 24 - Math.abs(i - 1) * 18, 1.5 * s, { t, facing: i === 2 ? -1 : 1, phase: i * 2 }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-x-0 bottom-0 w-full h-[45%] pointer-events-none opacity-90" />;
}

export function Title({ meta, hasSave, onNew, onContinue, onTutorial, onLab, onHelp, onSettings }: {
  meta: Meta; hasSave: boolean; onNew: () => void; onContinue: () => void; onTutorial: () => void; onLab: () => void; onHelp: () => void; onSettings: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Enter" && !document.querySelector("[data-modal]")) (hasSave ? onContinue : onNew)(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hasSave, onNew, onContinue]);
  const s = meta.stats;
  return (
    <div className="relative h-full w-full bg-forge overflow-hidden flex flex-col items-center justify-start pt-[5vh] sm:pt-[7vh] overflow-y-auto">
      <TitleScene />
      <div className="relative z-10 text-center px-4">
        <div className="text-sm tracking-[.5em] text-orange-300/80">STITCH · EVOLVE · CONQUER</div>
        <h1 className="font-title text-5xl sm:text-7xl font-black leading-none mt-2 bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(180deg,#ffe3b3,#ff8a3d 55%,#a63d0c)", textShadow: "0 0 40px rgba(255,122,47,.25)" }}>CHIMERA<br />AUTO-FORGE</h1>
        <div className="mt-2 text-xs sm:text-sm opacity-70 max-w-md mx-auto">Assemble beasts from Head, Torso, Limbs and Tail. Chase synergies. Evolve. Survive the Boss Gauntlet.</div>
      </div>
      <div className="relative z-10 mt-5 flex flex-col gap-2 w-60">
        {hasSave && <button className="btn btn-primary text-lg" onClick={onContinue}>▶ Continue Run</button>}
        <button className={`btn text-lg ${hasSave ? "" : "btn-primary"}`} onClick={onNew}>⚔ New Run</button>
        <button className="btn" onClick={onTutorial}>🎓 Interactive Tutorial</button>
        <button className="btn" onClick={onLab}>🧬 Genome Lab <span className="chip ml-1">✦ {meta.essence}</span></button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={onHelp}>📖 How to Play</button>
          <button className="btn" onClick={onSettings}>⚙ Settings</button>
        </div>
      </div>
      <div className="relative z-10 mt-4 mb-3 text-[11px] opacity-60 text-center">
        Runs {s.runs} · Victories {s.wins} · Best round {s.bestRound} · Best score {s.bestScore.toLocaleString()}
      </div>
    </div>
  );
}

// ---------------- Setup ----------------
export function Setup({ onStart, onBack }: { onStart: (diff: string, muts: string[], seed: string) => void; onBack: () => void }) {
  const [diff, setDiff] = useState("journeyman");
  const [muts, setMuts] = useState<string[]>([]);
  const [seed, setSeed] = useState("");
  const d = DIFFICULTIES.find((x) => x.id === diff)!;
  const mult = muts.reduce((m, id) => m * (MUTAGENS.find((x) => x.id === id)?.mult ?? 1), 1) * d.essence;
  return (
    <div className="h-full w-full bg-forge overflow-y-auto scroll-thin p-3">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-title text-3xl text-amber-200 mb-3">Prepare the Gauntlet</h2>
        <h3 className="font-semibold mb-1 opacity-80">Difficulty</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {DIFFICULTIES.map((x) => (
            <button key={x.id} onClick={() => { setDiff(x.id); audio.sfx("click"); }} className={`panel p-3 text-left transition hover:brightness-125 ${diff === x.id ? "sel-ring" : ""}`} style={{ borderColor: x.color }}>
              <div className="font-title text-lg" style={{ color: x.color }}>{x.name}</div>
              <div className="text-xs opacity-80 min-h-[32px]">{x.desc}</div>
              <div className="text-[11px] mt-1 opacity-70">❤ {x.lives} · 🪙 {x.gold} · Foes ×{x.enemyMult} · Rewards ×{x.essence}</div>
            </button>
          ))}
        </div>
        <h3 className="font-semibold mb-1 opacity-80">Mutagens <span className="text-xs opacity-60">(optional challenge modifiers — boost rewards)</span></h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {MUTAGENS.map((m) => {
            const on = muts.includes(m.id);
            return (
              <button key={m.id} onClick={() => { setMuts(on ? muts.filter((x) => x !== m.id) : [...muts, m.id]); audio.sfx("click"); }} className={`panel p-2 text-left transition hover:brightness-125 ${on ? "sel-ring" : "opacity-80"}`}>
                <div className="font-semibold">{m.icon} {m.name} <span className="chip ml-1">×{m.mult}</span></div>
                <div className="text-xs opacity-75">{m.desc}</div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm flex items-center gap-2">Seed <input value={seed} onChange={(e) => setSeed(e.target.value.slice(0, 16))} placeholder="random" className="bg-black/40 border border-white/20 rounded-md px-2 py-1 w-36" /></label>
          <span className="text-sm">Reward multiplier: <b className="text-amber-300">×{mult.toFixed(2)}</b></span>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={onBack}>← Back</button>
          <button className="btn btn-primary text-lg flex-1 sm:flex-none sm:px-10" onClick={() => onStart(diff, muts, seed.trim() || Math.random().toString(36).slice(2, 8))}>⚔ Begin the Gauntlet</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Lab ----------------
export function Lab({ meta, onUpgrade, onUnlock, onBack }: { meta: Meta; onUpgrade: (id: string) => void; onUnlock: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"mut" | "parts" | "rec">("mut");
  const tabBtn = (id: typeof tab, label: string) => <button key={id} className={`btn ${tab === id ? "btn-primary" : ""}`} onClick={() => setTab(id)}>{label}</button>;
  return (
    <div className="h-full w-full bg-forge overflow-y-auto scroll-thin p-3">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-title text-3xl text-amber-200">Genome Lab</h2>
          <span className="chip text-lg !px-3 !py-1 text-fuchsia-300">✦ {meta.essence} Essence</span>
          <div className="ml-auto flex gap-2">{tabBtn("mut", "🧬 Mutations")}{tabBtn("parts", "🦴 Part Codex")}{tabBtn("rec", "🏆 Records")}<button className="btn" onClick={onBack}>← Back</button></div>
        </div>
        {tab === "mut" && (
          <div className="grid sm:grid-cols-2 gap-2">
            {LAB_UPGRADES.map((u) => {
              const lv = meta.up[u.id] ?? 0, max = u.costs.length, cost = u.costs[lv];
              return (
                <div key={u.id} className="panel p-3 flex items-center gap-3">
                  <div className="text-3xl">{u.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{u.name} <span className="text-xs opacity-60">Lv {lv}/{max}</span></div>
                    <div className="text-xs opacity-75">{u.desc}</div>
                    <div className="flex gap-1 mt-1">{u.costs.map((_, i) => <span key={i} className={`w-4 h-1.5 rounded ${i < lv ? "bg-orange-400" : "bg-white/15"}`} />)}</div>
                  </div>
                  <button className="btn btn-sm" disabled={lv >= max || meta.essence < cost} onClick={() => onUpgrade(u.id)}>{lv >= max ? "MAX" : `✦ ${cost}`}</button>
                </div>
              );
            })}
          </div>
        )}
        {tab === "parts" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PART_LIST.map((p) => {
              const unlocked = meta.unlocked.includes(p.id), col = TAG_META[p.tag].color, s = partStats(p, 1);
              return (
                <div key={p.id} className={`panel p-2 ${unlocked ? "" : "opacity-70"}`} style={{ borderColor: unlocked ? col : undefined }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{unlocked ? p.icon : "🔒"}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-[11px]" style={{ color: col }}>{TAG_META[p.tag].name} · {SLOT_LABEL[p.slot]} · Rarity {p.rarity}</div>
                    </div>
                    {!unlocked && <button className="btn btn-sm" disabled={meta.essence < p.unlock} onClick={() => onUnlock(p.id)}>✦ {p.unlock}</button>}
                    {unlocked && meta.seen.includes(p.id) && <span className="chip">seen</span>}
                  </div>
                  <div className="text-[11px] opacity-80 mt-1">{[s.hp ? `❤${s.hp}` : "", s.atk ? `⚔${s.atk}` : "", s.spd ? `⚡${Math.round(s.spd * 100)}%` : "", s.def ? `🛡${s.def}` : ""].filter(Boolean).join("  ")} · {partDesc(p, 1)}</div>
                  <div className="text-[10px] opacity-55">Resonates in {ROW_NAMES[p.row]} row</div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "rec" && (
          <div className="grid sm:grid-cols-2 gap-2">
            {([["Runs started", meta.stats.runs], ["Victories", meta.stats.wins], ["Best round reached", meta.stats.bestRound], ["Best score", meta.stats.bestScore.toLocaleString()], ["Total kills", meta.stats.kills], ["Rounds won", meta.stats.rounds], ["Bosses slain", meta.stats.bosses], ["Evolutions", meta.stats.merges]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="panel p-3 flex justify-between"><span className="opacity-80">{k}</span><b className="text-amber-200">{v}</b></div>
            ))}
            <div className="panel p-3 sm:col-span-2 text-sm opacity-80">Progress is saved automatically in your browser. Essence is earned at the end of each run — more on harder difficulties and with Mutagens.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Help ----------------
export function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ["How to Play", "Parts & Rows", "Synergies", "Foes & Bosses", "Controls"];
  return (
    <Modal wide onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="font-title text-2xl text-amber-200">Codex of the Forge</h2>
        <div className="ml-auto flex flex-wrap gap-1">{tabs.map((t, i) => <button key={t} className={`btn btn-sm ${tab === i ? "btn-primary" : ""}`} onClick={() => setTab(i)}>{t}</button>)}<button className="btn btn-sm" onClick={onClose}>✕ Close</button></div>
      </div>
      <div className="text-sm space-y-2 leading-relaxed">
        {tab === 0 && (<>
          <p><b className="text-amber-300">Goal:</b> Survive until you defeat the final boss in round {FINAL_ROUND}. You start with a few lives; losing a round costs 1 life (a boss costs 2). At 0 lives the run ends.</p>
          <p><b className="text-amber-300">Each round:</b> <b>Forge</b> (buy and arrange parts) → <b>Battle</b> (auto-fight 3 vs 3) → earn gold → repeat.</p>
          <p><b className="text-amber-300">Chimeras:</b> You field 3 chimeras in a Front / Middle / Back formation. Each has 4 sockets: Head, Torso, Limbs, Tail. Even a naked chimera has base stats, but parts add HP, ATK, speed, armor and special effects.</p>
          <p><b className="text-amber-300">Economy:</b> Gold comes from base income, wins, streaks and <b>interest</b> (+1 per 5 banked gold, capped). Spend it on parts (3–5🪙), rerolls, or <b>Forge upgrades</b> that make rarer parts appear. Sell parts for a refund.</p>
          <p><b className="text-amber-300">Evolution:</b> Three identical parts of the same tier merge into one part of the next tier (★ → ★★ → ★★★), with 2.2× / 4× stats and stronger effects. They merge across your bench and sockets automatically.</p>
          <p><b className="text-amber-300">Positions:</b> Enemies pick targets weighted 50% Front, 30% Middle, 20% Back. Each part <b>resonates</b> in a favored row (⚡): ×1.5 stats and effect when placed on a chimera in that row. Cleave hits neighbors, Inspire buffs adjacent allies and Ward shields the chimera behind.</p>
          <p><b className="text-amber-300">Bonds:</b> A chimera with 4 parts of one Tag is <b>Pure</b> (+20% HP/ATK). With 4 different Tags it is a <b>Mosaic</b> (+12%).</p>
          <p><b className="text-amber-300">Overload:</b> Fights that drag past 40 seconds trigger Overload — everyone burns, escalating until someone drops.</p>
          <p><b className="text-amber-300">Meta:</b> Earn ✦ Essence after each run to buy permanent Mutations and unlock rare parts in the Genome Lab. Difficulty and Mutagens multiply your rewards.</p>
        </>)}
        {tab === 1 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {SLOTS.map((sl) => PART_LIST.filter((p) => p.slot === sl).map((p) => (
              <div key={p.id} className="rounded-lg border p-2" style={{ borderColor: TAG_META[p.tag].color + "88" }}>
                <div className="font-semibold">{p.icon} {p.name} <span className="text-xs" style={{ color: TAG_META[p.tag].color }}>{TAG_META[p.tag].name} {SLOT_LABEL[sl]}</span></div>
                <div className="text-xs opacity-80">{FX_TEXT[p.fx](p.v)} · ⚡ {ROW_NAMES[p.row]} row</div>
              </div>
            )))}
          </div>
        )}
        {tab === 2 && (
          <div className="space-y-2">
            <p>Count parts by Tag across all 3 chimeras. Reaching 2, 4 or 6 parts activates a team-wide bonus (the highest reached applies). Enemies use the same rules.</p>
            {TAGS.map((t) => (
              <div key={t} className="rounded-lg border p-2" style={{ borderColor: TAG_META[t].color + "88" }}>
                <div className="font-semibold" style={{ color: TAG_META[t].color }}>{TAG_META[t].icon} {TAG_META[t].name} — <span className="opacity-80 font-normal">{TAG_META[t].blurb}</span></div>
                {SYNERGIES[t].map((s) => <div key={s.n} className="text-xs"><b>({s.n})</b> {s.text}</div>)}
              </div>
            ))}
            <p className="text-xs opacity-70"><b>Status effects:</b> Poison ticks damage each second then decays. Weaken reduces enemy damage. Stun freezes attacks. Shields absorb damage first. Armor reduces each hit (minimum 25% gets through).</p>
          </div>
        )}
        {tab === 3 && (
          <div className="space-y-2">
            <p>Five enemy archetypes roam the gauntlet — Howling Pack (Feral), Scale Wall, Hive Swarm (Chitin), Storm Flock (Plume), Void Cult — plus the unpredictable Mongrel Horde. Check <b>Next Foe</b> in the Forge to counter-build.</p>
            {BOSSES.map((b, i) => (
              <div key={b.id} className="rounded-lg border p-2" style={{ borderColor: b.color }}>
                <div className="font-semibold" style={{ color: b.color }}>☠ Round {(i + 1) * 5}: {b.name} <span className="text-xs opacity-70">— {b.title}</span></div>
                <div className="text-xs"><b>{b.skill}:</b> {b.skillDesc}</div>
              </div>
            ))}
            <p className="text-xs opacity-70">After the final boss you may continue into Endless mode: bosses return stronger every 5 rounds.</p>
          </div>
        )}
        {tab === 4 && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
            <div className="sm:col-span-2 font-bold text-amber-300">Forge</div>
            {[["Click shop card / 1-5", "Buy a part"], ["Click part → click socket", "Move / swap"], ["Drag & drop", "Buy, move, swap, sell"], ["Double-click part", "Auto-equip / unequip"], ["S / Delete", "Sell selected part"], ["R", "Reroll shop"], ["F", "Freeze shop"], ["U", "Upgrade forge"], ["Space / Enter", "Start fight"], ["◀ ▶ on cards", "Reorder formation"], ["Esc", "Pause menu"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-white/5 py-0.5"><Kbd>{k}</Kbd><span className="opacity-80 text-right">{v}</span></div>)}
            <div className="sm:col-span-2 font-bold text-amber-300 mt-2">Battle</div>
            {[["1 / 2 / 3 / 4", "Speed 1× 2× 4× skip"], ["Space", "Cycle speed"], ["Esc", "Pause"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-white/5 py-0.5"><Kbd>{k}</Kbd><span className="opacity-80">{v}</span></div>)}
            <div className="sm:col-span-2 text-xs opacity-70 mt-2">Touch: tap a part to select it, then tap a socket, the bench or the sell zone. Tap a shop card to buy.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Settings / Pause ----------------
export function SettingsPanel({ s, onChange, onClose }: { s: Settings; onChange: (p: Partial<Settings>) => void; onClose: () => void }) {
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-2">
        <Toggle label="Mute all audio" value={s.mute} onChange={(v) => onChange({ mute: v })} />
        <Slider label="Master" value={s.master} onChange={(v) => onChange({ master: v })} />
        <Slider label="Music" value={s.music} onChange={(v) => onChange({ music: v })} />
        <Slider label="Effects" value={s.sfx} onChange={(v) => { onChange({ sfx: v }); audio.sfx("buy"); }} />
        <hr className="border-white/10" />
        <Slider label="Screen shake" value={s.shake} onChange={(v) => onChange({ shake: v })} />
        <Toggle label="Floating damage numbers" value={s.floaters} onChange={(v) => onChange({ floaters: v })} />
        <Toggle label="Hit flashes" value={s.flash} onChange={(v) => onChange({ flash: v })} />
        <Toggle label="Low particle quality" hint="Better performance on slow devices" value={s.particles === "low"} onChange={(v) => onChange({ particles: v ? "low" : "high" })} />
        <Toggle label="Auto-equip purchases" hint="Buy straight into an empty matching socket" value={s.autoEquip} onChange={(v) => onChange({ autoEquip: v })} />
      </div>
      <button className="btn btn-primary w-full mt-4" onClick={onClose}>Done</button>
    </Modal>
  );
}

export function Pause({ inRun, diff, onDiff, onResume, onSettings, onHelp, onQuit, onAbandon }: {
  inRun: boolean; diff: string; onDiff: (id: string) => void; onResume: () => void; onSettings: () => void; onHelp: () => void; onQuit: () => void; onAbandon: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Paused" onClose={onResume}>
      <div className="flex flex-col gap-2">
        <button className="btn btn-primary" onClick={onResume}>▶ Resume</button>
        {inRun && (
          <div className="rounded-lg bg-black/30 p-2">
            <div className="text-xs opacity-70 mb-1">Difficulty (applies from the next fight)</div>
            <div className="grid grid-cols-2 gap-1">
              {DIFFICULTIES.map((d) => <button key={d.id} className={`btn btn-sm ${d.id === diff ? "btn-primary" : ""}`} onClick={() => onDiff(d.id)}>{d.name}</button>)}
            </div>
          </div>
        )}
        <button className="btn" onClick={onSettings}>⚙ Settings (audio & visuals)</button>
        <button className="btn" onClick={onHelp}>📖 How to Play & Controls</button>
        {inRun && <button className="btn" onClick={onQuit}>💾 Save & Quit to Title</button>}
        {inRun && !confirm && <button className="btn btn-danger" onClick={() => setConfirm(true)}>🏳 Abandon Run</button>}
        {inRun && confirm && <button className="btn btn-danger" onClick={onAbandon}>Really abandon? Essence is still banked.</button>}
      </div>
    </Modal>
  );
}

// ---------------- End screens ----------------
export function EndScreen({ run, kind, gained, onRetry, onMenu, onLab, onEndless }: {
  run: RunState; kind: "win" | "lose"; gained: number; onRetry: () => void; onMenu: () => void; onLab: () => void; onEndless?: () => void;
}) {
  const s = run.stats;
  const rows: [string, string | number][] = [
    ["Rounds won", s.roundsWon], ["Bosses slain", s.bosses], ["Enemies felled", s.kills], ["Damage dealt", s.dmg.toLocaleString()],
    ["Parts forged", s.bought], ["Evolutions", s.merges], ["Gold earned", s.goldEarned], ["Best win streak", s.bestStreak],
    ["Highest tier", "★".repeat(s.maxTier)], ["Rerolls", s.rerolls], ["Lives left", `${run.lives}/${run.maxLives}`], ["Battle time", `${Math.round(s.time)}s`],
  ];
  const win = kind === "win";
  return (
    <div className="relative h-full w-full bg-forge overflow-y-auto scroll-thin flex items-start sm:items-center justify-center p-3">
      <div className="panel anim-pop max-w-2xl w-full p-5" style={{ borderColor: win ? "#fbbf24" : "#b91c1c" }}>
        <div className={`font-title text-4xl sm:text-5xl text-center ${win ? "text-amber-300" : "text-red-400"}`}>{win ? "THE PRIME FALLS" : "THE FORGE GOES COLD"}</div>
        <div className="text-center text-sm opacity-75 mb-3">{win ? "Your stitched legion conquered the gauntlet. The old gods weep." : `Your chimeras fell on round ${run.round}. Their parts will be reused...`}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {rows.map(([k, v]) => <div key={k} className="rounded-lg bg-black/30 px-2 py-1.5"><div className="text-[11px] opacity-60">{k}</div><div className="font-bold text-amber-100">{v}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-2 justify-between items-center rounded-lg bg-black/40 p-3 mb-4">
          <div><div className="text-xs opacity-60">{diffOf(run).name}{run.mutagens.length ? ` · Mutagens ×${mutMult(run).toFixed(2)}` : ""}</div><div className="text-2xl font-bold text-amber-300">Score {calcScore(run).toLocaleString()}</div></div>
          <div className="text-right"><div className="text-xs opacity-60">Essence earned</div><div className="text-2xl font-bold text-fuchsia-300">✦ +{gained}</div><div className="text-[10px] opacity-50">total banked for run: {calcEssence(run)}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {win && onEndless && <button className="btn btn-primary flex-1" onClick={onEndless}>♾ Continue into Endless</button>}
          <button className={`btn flex-1 ${win ? "" : "btn-primary"}`} onClick={onRetry}>{win ? "⚔ New Run" : "↻ Try Again"}</button>
          <button className="btn flex-1" onClick={onLab}>🧬 Genome Lab</button>
          <button className="btn flex-1" onClick={onMenu}>🏠 Title</button>
        </div>
      </div>
    </div>
  );
}
