import { useEffect, useRef, useState } from "react";
import { Btn, Overlay, Panel, Slider, Toggle } from "./ui";
import { DIFFS, DiffKey, ENEMIES, ENV_INFO, MOD_INFO, ModsState, EType, HULLS, STARTER_BUILD, CAMPAIGN_LEN, resistFromMemory } from "../game/data";
import { SaveData } from "../game/save";
import { RunResult } from "../game/combat";
import { drawModule } from "../game/render";
import { audio } from "../game/audio";

/* ---------------- Title screen ---------------- */
function TitleShip() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const cs = 22, w = 7, h = 7;
    const draw = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.translate(c.width / 2, c.height / 2 + Math.sin(t * 1.3) * 6);
      ctx.rotate(Math.sin(t * 0.7) * 0.08);
      for (const [x, y, id] of STARTER_BUILD) {
        drawModule(ctx, id, (x - (w - 1) / 2) * cs, (y - (h - 1) / 2) * cs, cs, { t, active: id === "engine" });
      }
      // thruster glow
      for (const ex of [2, 4]) {
        const gx = (ex - 3) * cs, gy = (5 - 3) * cs + cs * 0.6;
        const g = ctx.createLinearGradient(gx, gy, gx, gy + 40 + Math.sin(t * 30 + ex) * 8);
        g.addColorStop(0, "rgba(251,146,60,0.9)"); g.addColorStop(1, "rgba(251,146,60,0)");
        ctx.fillStyle = g; ctx.fillRect(gx - 5, gy, 10, 50);
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={260} height={260} className="w-48 h-48 sm:w-64 sm:h-64" />;
}

export function TitleScreen({ hasProgress, onContinue, onNew, onSettings, onHelp, onQuickStart, best }: {
  hasProgress: boolean; onContinue: () => void; onNew: () => void; onSettings: () => void; onHelp: () => void; onQuickStart: () => void; best: number;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center starfield overflow-y-auto scroll-thin"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #12204a 0%, #050813 70%)" }}>
      <div className="fade-up flex flex-col items-center py-6 px-4 text-center">
        <TitleShip />
        <div className="font-display text-[10px] sm:text-xs tracking-[0.5em] text-cyan-300 mb-2">CONSTRUCT · CALIBRATE · COMBAT</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl tracking-[0.12em] text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-200 to-sky-500 drop-shadow-[0_0_24px_rgba(34,211,238,0.5)]">
          STARFORGE
        </h1>
        <h2 className="font-display font-bold text-xl sm:text-3xl tracking-[0.55em] text-amber-300 -mt-1 mb-6">SHIPWRIGHT</h2>
        <div className="flex flex-col gap-3 w-64">
          {hasProgress ? (
            <>
              <Btn variant="primary" onClick={onContinue}>Continue Campaign</Btn>
              {confirm ? (
                <div className="flex gap-2">
                  <Btn variant="danger" className="flex-1" onClick={() => { setConfirm(false); onNew(); }}>Erase &amp; Start</Btn>
                  <Btn className="flex-1" onClick={() => setConfirm(false)}>Cancel</Btn>
                </div>
              ) : (
                <Btn onClick={() => setConfirm(true)}>New Campaign</Btn>
              )}
            </>
          ) : (
            <Btn variant="primary" onClick={onQuickStart}>Begin Campaign</Btn>
          )}
          <Btn onClick={onHelp}>How to Play</Btn>
          <Btn onClick={onSettings}>Settings</Btn>
        </div>
        {best > 0 && <div className="mt-5 text-xs text-slate-400 tracking-widest uppercase">Best score <span className="text-amber-300 font-bold">{best.toLocaleString()}</span></div>}
        <p className="mt-5 max-w-md text-sm text-slate-400">
          Design a modular warship around power, heat, mass and crew logistics — then take it into real-time sorties against enemy fleets that evolve to counter you.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
export function SettingsPanel({ save, setSave, inGame, onClose, onNewCampaign }: {
  save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void; inGame?: boolean; onClose: () => void; onNewCampaign?: () => void;
}) {
  const st = save.settings;
  const [confirm, setConfirm] = useState(false);
  const setS = (p: Partial<SaveData["settings"]>) => setSave((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  return (
    <Overlay onClose={onClose}>
      <Panel title="Settings" right={<button className="text-slate-400 hover:text-white px-2" onClick={onClose}>✕</button>}>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="font-display text-[10px] tracking-widest text-slate-400 uppercase">Audio</div>
            <Slider label="Master" value={st.master} onChange={(v) => setS({ master: v })} />
            <Slider label="Music" value={st.music} onChange={(v) => setS({ music: v })} />
            <Slider label="Effects" value={st.sfx} onChange={(v) => { setS({ sfx: v }); audio.sfx("pickup"); }} />
            <Toggle on={st.muted} onChange={(v) => setS({ muted: v })} label="Mute all audio" />
          </div>
          <div className="space-y-2">
            <div className="font-display text-[10px] tracking-widest text-slate-400 uppercase">Display</div>
            <Slider label="Screen shake" value={st.shake} min={0} max={1.5} onChange={(v) => setS({ shake: v })} />
          </div>
          <div className="space-y-2">
            <div className="font-display text-[10px] tracking-widest text-slate-400 uppercase">Difficulty {inGame && <span className="text-emerald-400 normal-case">(applies live)</span>}</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFS) as DiffKey[]).map((k) => (
                <button key={k} onClick={() => { audio.sfx("ui"); setSave((s) => ({ ...s, diff: k })); }}
                  className={"p-2 border rounded-sm text-left transition-colors " + (save.diff === k ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700 hover:border-slate-500")}>
                  <div className="font-display text-xs tracking-widest uppercase">{DIFFS[k].name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-1">{DIFFS[k].desc}</div>
                </button>
              ))}
            </div>
            <div className="font-display text-[10px] tracking-widest text-slate-400 uppercase pt-1">Modifiers {inGame && <span className="text-amber-400 normal-case">(apply next sortie)</span>}</div>
            {(Object.keys(MOD_INFO) as (keyof ModsState)[]).map((k) => (
              <Toggle key={k} disabled={inGame} on={save.mods[k]} onChange={(v) => setSave((s) => ({ ...s, mods: { ...s.mods, [k]: v } }))}
                label={`${MOD_INFO[k].name}  (+${Math.round(MOD_INFO[k].cred * 100)}% credits)`} desc={MOD_INFO[k].desc} />
            ))}
          </div>
          {!inGame && onNewCampaign && (
            <div className="pt-2 border-t border-slate-700">
              {confirm ? (
                <div className="flex items-center gap-2 text-sm"><span className="text-rose-300">Erase all progress?</span>
                  <Btn small variant="danger" onClick={() => { setConfirm(false); onNewCampaign(); }}>Yes, reset</Btn>
                  <Btn small onClick={() => setConfirm(false)}>No</Btn></div>
              ) : <Btn small variant="danger" onClick={() => setConfirm(true)}>Reset campaign</Btn>}
            </div>
          )}
          <div className="flex justify-end"><Btn variant="primary" onClick={onClose}>Done</Btn></div>
        </div>
      </Panel>
    </Overlay>
  );
}

/* ---------------- Help ---------------- */
const KEYS: [string, string][] = [
  ["W A S D / Arrows", "Thrust in any direction"],
  ["Mouse", "Aim — the ship rotates toward the cursor"],
  ["Left Mouse / J", "Fire cannons (pulse + railgun)"],
  ["Right Mouse / K", "Launch homing missiles"],
  ["Space", "Emergency vent (dump heat; 2s weapon & shield lockout; 14s cooldown)"],
  ["Esc / P", "Pause menu"],
  ["Hangar: Left click / drag", "Place selected module (paint by dragging)"],
  ["Hangar: Right click / X", "Remove module (full refund)"],
  ["Hangar: 1-9", "Quick-select first nine palette modules"],
  ["Gamepad", "Left stick move · Right stick aim · RT cannons · LT/RB missiles · A vent · Start pause"],
  ["Touch", "Drag left side to move · FIRE / MSL / VENT buttons · ship auto-aims"],
];
export function HelpPanel({ onClose, onReplayTutorial }: { onClose: () => void; onReplayTutorial?: () => void }) {
  const [tab, setTab] = useState<"controls" | "systems" | "enemies" | "tips">("controls");
  const tabs = ["controls", "systems", "enemies", "tips"] as const;
  return (
    <Overlay onClose={onClose} wide>
      <Panel title="Flight Manual" right={<button className="text-slate-400 hover:text-white px-2" onClick={onClose}>✕</button>}>
        <div className="flex gap-1 p-2 border-b border-slate-700 flex-wrap">
          {tabs.map((t) => (
            <Btn key={t} small variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)}>{t}</Btn>
          ))}
        </div>
        <div className="p-4 text-sm leading-relaxed min-h-[320px]">
          {tab === "controls" && (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {KEYS.map(([k, v]) => (
                <div key={k} className="flex gap-3 items-start"><span className="shrink-0 font-display text-[10px] text-amber-300 bg-slate-800 border border-slate-600 px-2 py-1 rounded-sm">{k}</span><span className="text-slate-300">{v}</span></div>
              ))}
            </div>
          )}
          {tab === "systems" && (
            <div className="space-y-3 text-slate-300">
              <p><b className="text-amber-300">Power.</b> Reactors, solar arrays and the bridge generate power. Shields, engines and weapons consume it. When demand exceeds output, capacitors cover the gap; once empty, everything runs slower (weapon fire rate, thrust, shield regen). Solar flares cut generation by 65%.</p>
              <p><b className="text-orange-400">Heat.</b> Reactors and weapons make heat. Radiators shed it (×1.5 when exposed to open space, ×0.5 when buried in the hull); heat sinks store it. At 100% your weapons and shields go offline and modules cook. Vent with Space in emergencies. Nebulae slow cooling.</p>
              <p><b className="text-sky-300">Mass.</b> Every module adds mass. Each hull has a mass cap. Thrust ÷ mass decides your speed and turn rate — heavy armor makes you a sitting duck.</p>
              <p><b className="text-emerald-300">Crew flow.</b> Crew Quarters (and the bridge) supply crew. Crew walk through connected modules (corridors, quarters, reactors…) but NOT through armor, radiators or solar arrays. Modules marked with a red dot have no crew path and are offline. Losing a corridor or quarters mid-fight can strand your gunners!</p>
              <p><b className="text-rose-300">Structure.</b> Every module has its own HP. Shots hit the cell they land on, so armor placed in front truly shields what is behind. Sections disconnected from the bridge are torn away. Lose the bridge and the ship is lost. Destroyed reactors explode.</p>
              <p><b className="text-fuchsia-300">Adaptation.</b> Enemy fleets remember which damage type you rely on (energy / kinetic / explosive) and develop resistance — mix your arsenal. Their composition also shifts to counter shields, armor, or speed.</p>
              <p><b className="text-cyan-300">Economy.</b> Credits buy and place modules (removal refunds 100%). Data unlocks blueprints and upgrades in Research. Destroyed modules cost 30% to rebuild after a win.</p>
            </div>
          )}
          {tab === "enemies" && (
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(ENEMIES) as EType[]).filter((t) => t !== "mine").map((t) => (
                <div key={t} className="border border-slate-700 p-2 rounded-sm">
                  <div className="font-display text-xs tracking-widest" style={{ color: ENEMIES[t].color }}>{ENEMIES[t].name}</div>
                  <div className="text-slate-300 text-[13px]">{ENEMIES[t].desc}</div>
                  <div className="text-emerald-300/90 text-[12px] mt-1">Counter: {ENEMIES[t].counter}</div>
                </div>
              ))}
              {(Object.keys(ENV_INFO) as (keyof typeof ENV_INFO)[]).map((k) => (
                <div key={k} className="border border-slate-800 p-2 rounded-sm bg-slate-900/50">
                  <div className="font-display text-xs tracking-widest text-sky-300">{ENV_INFO[k].name}</div>
                  <div className="text-slate-400 text-[13px]">{ENV_INFO[k].desc}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "tips" && (
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Always put a radiator on the hull's outer edge – exposed radiators are three times better than buried ones.</li>
              <li>Corridors cost only 8 credits and keep crew flowing. Put them between quarters and the guns.</li>
              <li>Pulse cannons are cheap but warm. A railgun needs a capacitor bank and heat sinks to be sustainable.</li>
              <li>Turrets shoot down incoming missiles – bring one or two against Missile Corvettes.</li>
              <li>Ion Skirmishers drain capacitors and add heat: keep headroom before engaging them.</li>
              <li>Watch the crimson telegraph lines: Lancer beams fire a split-second after they stop tracking you.</li>
              <li>Use asteroids as cover. Rocks block every projectile.</li>
              <li>Cargo holds boost credits, but each adds 4 mass. Replay old sorties at half rewards if you need funds.</li>
              <li>Prefer a mixed arsenal late in the campaign – single-damage-type builds meet 35% resistance.</li>
            </ul>
          )}
        </div>
        <div className="flex justify-between p-3 border-t border-slate-700">
          {onReplayTutorial ? <Btn small onClick={onReplayTutorial}>Replay hangar tutorial</Btn> : <span />}
          <Btn variant="primary" onClick={onClose}>Close</Btn>
        </div>
      </Panel>
    </Overlay>
  );
}

/* ---------------- Results ---------------- */
export function ResultsScreen({ res, save, campaignWin, onHangar, onRetry, onNext, onEndless, onTitle }: {
  res: RunResult; save: SaveData; campaignWin: boolean; onHangar: () => void; onRetry: () => void; onNext: () => void; onEndless: () => void; onTitle: () => void;
}) {
  const win = res.win;
  const adapt = resistFromMemory(save.adapt, res.sortie + 1);
  const adaptLines = (Object.keys(adapt) as (keyof typeof adapt)[]).filter((k) => adapt[k] > 0.02).map((k) => `${k} −${Math.round(adapt[k] * 100)}%`);
  const acc = res.shots > 0 ? Math.round((res.hits / res.shots) * 100) : 0;
  const mm = Math.floor(res.time / 60), ss = Math.floor(res.time % 60).toString().padStart(2, "0");
  const net = res.scrap + res.bonus - res.repairBill;
  const title = campaignWin ? "CAMPAIGN COMPLETE" : win ? "SORTIE CLEARED" : res.retreat ? "RETREATED" : "SHIP DESTROYED";
  const color = win ? "text-cyan-300" : res.retreat ? "text-amber-300" : "text-rose-400";
  const rows: [string, string][] = [
    ["Time", `${mm}:${ss}`], ["Kills", `${res.kills}`], ["Waves", `${Math.min(res.wave, res.totalWaves)}/${res.totalWaves}`],
    ["Accuracy", `${acc}% (${res.hits}/${res.shots})`], ["Damage dealt", `${Math.round(res.dmgDealt.energy + res.dmgDealt.kinetic + res.dmgDealt.explosive)}`],
    ["Damage taken", `${res.dmgTaken}`], ["Shield absorbed", `${res.shieldAbsorbed}`], ["Modules lost", `${res.cellsLost}`],
    ["Peak heat", `${Math.round(res.maxHeat * 100)}%`], ["Overheats / Vents", `${res.overheats} / ${res.vents}`], ["Hull left", `${res.hullPct}%`], ["Score", res.score.toLocaleString()],
  ];
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin starfield flex items-start sm:items-center justify-center p-3"
      style={{ background: win ? "radial-gradient(ellipse at 50% 20%, #0c3b52 0%, #050813 70%)" : "radial-gradient(ellipse at 50% 20%, #4a0f1d 0%, #050813 70%)" }}>
      <div className="fade-up w-full max-w-3xl">
        <Panel>
          <div className="p-5 text-center border-b border-slate-700">
            <div className={"font-display font-black text-3xl sm:text-5xl tracking-[0.15em] " + color}>{title}</div>
            <div className="text-slate-400 tracking-widest uppercase text-xs mt-2">Sortie {res.sortie}{res.boss && win ? " · Boss defeated" : ""}</div>
            {campaignWin && <p className="mt-3 text-amber-200 text-sm max-w-xl mx-auto">The Void Sovereign is no more. The lanes are open and your yard's name is spoken across the stars. The war goes on — continue into Endless Sorties where fleets keep evolving.</p>}
            {!win && !res.retreat && <p className="mt-3 text-slate-300 text-sm">Your bridge was destroyed. You salvaged 25% of collected scrap. Refit in the hangar and try again — check the Power / Heat / Crew views for weak points.</p>}
          </div>
          <div className="grid sm:grid-cols-[120px_1fr] gap-4 p-4">
            <div className="flex sm:flex-col items-center justify-center gap-2">
              <div className="font-display text-xs tracking-widest text-slate-400">RANK</div>
              <div className={"font-display font-black text-6xl " + (res.rank === "S" ? "text-amber-300" : res.rank === "A" ? "text-cyan-300" : res.rank === "D" ? "text-rose-400" : "text-slate-200")}>{res.rank}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
              {rows.map(([k, v]) => (<div key={k} className="flex justify-between border-b border-slate-800 py-0.5"><span className="text-slate-400">{k}</span><span className="text-slate-100 tabular-nums">{v}</span></div>))}
            </div>
          </div>
          <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
            <div className="border border-slate-700 p-3 rounded-sm text-sm">
              <div className="font-display text-[10px] tracking-widest text-amber-300 uppercase mb-1">Rewards</div>
              <div className="flex justify-between"><span>Salvage collected</span><span className="text-amber-200">+{res.scrap}¢</span></div>
              <div className="flex justify-between"><span>Completion bonus</span><span className="text-amber-200">+{res.bonus}¢</span></div>
              <div className="flex justify-between"><span>Repair bill</span><span className="text-rose-300">−{res.repairBill}¢</span></div>
              <div className="flex justify-between border-t border-slate-700 mt-1 pt-1 font-bold"><span>Net</span><span className={net >= 0 ? "text-emerald-300" : "text-rose-300"}>{net >= 0 ? "+" : ""}{net}¢</span></div>
              {res.data > 0 && <div className="flex justify-between text-cyan-300 font-bold"><span>Research data</span><span>+{res.data} ◆</span></div>}
            </div>
            <div className="border border-slate-700 p-3 rounded-sm text-sm">
              <div className="font-display text-[10px] tracking-widest text-fuchsia-300 uppercase mb-1">Fleet Intelligence</div>
              {adaptLines.length ? (
                <p className="text-slate-300">Enemy fleets are adapting to your arsenal: <b className="text-fuchsia-200">{adaptLines.join(", ")}</b> damage resistance. Diversify your weapons.</p>
              ) : <p className="text-slate-300">No notable adaptation yet. Your damage profile is balanced or too little data has been gathered.</p>}
              <div className="text-xs text-slate-500 mt-1">Campaign progress: {Math.min(save.cleared, CAMPAIGN_LEN)}/{CAMPAIGN_LEN} sorties</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center p-4 border-t border-slate-700">
            {campaignWin && <Btn variant="gold" onClick={onEndless}>Continue · Endless</Btn>}
            {win && !campaignWin && <Btn variant="primary" onClick={onNext}>Next sortie</Btn>}
            <Btn variant={win ? "default" : "primary"} onClick={onRetry}>{win ? "Replay sortie" : "Retry sortie"}</Btn>
            <Btn onClick={onHangar}>Hangar</Btn>
            <Btn variant="ghost" onClick={onTitle}>Title</Btn>
          </div>
        </Panel>
        <div className="text-center text-[11px] text-slate-600 mt-2">{HULLS.length} hull classes · {Object.keys(save.tech).length} blueprints researched</div>
      </div>
    </div>
  );
}
