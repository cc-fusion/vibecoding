import { useEffect, useRef, useState } from "react";
import { audio } from "../game/audio";
import { CLASSES, DIFFICULTY, LORE, MODIFIERS, RELICS, TERRAIN, UPGRADES } from "../game/data";
import type { OverState } from "../game/engine";
import { SQ3, fbm, hash2 } from "../game/hex";
import { loadSave, resetSave, writeSave } from "../game/save";
import type { RunConfig, TerrainId } from "../game/types";
import { HelpContent } from "./Help";
import { Kbd, Modal, Title } from "./ui";

// ---------- backdrop ----------
export function TitleBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let w = 0, h = 0;
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w;
      c.height = h;
    };
    resize();
    window.addEventListener("resize", resize);
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.fillStyle = "#d8c496";
      ctx.fillRect(0, 0, w, h);
      const s = 38;
      const cols = Math.ceil(w / (s * SQ3)) + 2;
      const rows = Math.ceil(h / (s * 1.5)) + 2;
      for (let r = -1; r < rows; r++) {
        for (let q = -1 - Math.floor(r / 2); q < cols - Math.floor(r / 2); q++) {
          const x = s * SQ3 * (q + r / 2);
          const y = s * 1.5 * r;
          const el = fbm(q * 0.22 + 3, r * 0.22 + 3, 5);
          const mo = fbm(q * 0.25 + 40, r * 0.25 + 40, 9);
          const id: TerrainId = el > 0.64 ? "mountain" : el > 0.55 ? "hills" : mo > 0.6 ? "marsh" : mo > 0.44 ? "forest" : "meadow";
          const appear = hash2(q, r, 4) * 6 + (Math.hypot(x - w / 2, y - h / 2) / 400);
          const a = Math.max(0, Math.min(1, (t % 22) - appear));
          const fade = t % 22 > 18 ? Math.max(0, 1 - ((t % 22) - 18) / 3.5) : 1;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const an = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + (s - 1) * Math.cos(an);
            const py = y + (s - 1) * Math.sin(an);
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.globalAlpha = a * fade * 0.55;
          ctx.fillStyle = TERRAIN[id].color;
          ctx.fill();
          ctx.globalAlpha = a * fade * 0.5;
          ctx.strokeStyle = "#4a3620";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, "rgba(20,12,6,0.35)");
      g.addColorStop(1, "rgba(10,6,3,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ---------- settings ----------
export function SettingsPanel({ onChange }: { onChange?: () => void }) {
  const save = loadSave();
  const [, force] = useState(0);
  const s = save.settings;
  const upd = (p: Partial<typeof s>) => {
    Object.assign(s, p);
    writeSave(save);
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    force((v) => v + 1);
    onChange?.();
  };
  const slider = (label: string, k: "master" | "music" | "sfx") => (
    <label className="block" key={k}>
      <div className="flex justify-between text-sm"><span>{label}</span><span>{Math.round(s[k] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={s[k]} onChange={(e) => upd({ [k]: parseFloat(e.target.value) })} onMouseUp={() => audio.sfx("click")} />
    </label>
  );
  return (
    <div className="space-y-3">
      {slider("Master volume", "master")}
      {slider("Music volume", "music")}
      {slider("Effects volume", "sfx")}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={() => upd({ muted: !s.muted })}>{s.muted ? "🔇 Muted" : "🔊 Sound on"}</button>
        <button className="btn btn-sm" onClick={() => upd({ shake: !s.shake })}>{s.shake ? "📳 Screen shake: on" : "📴 Screen shake: off"}</button>
        <button className="btn btn-sm" onClick={() => upd({ psycho: !s.psycho })}>{s.psycho ? "🌀 Madness visuals: on" : "🌀 Madness visuals: off"}</button>
      </div>
      <p className="text-xs opacity-70 italic">Settings are saved automatically. Turn off shake and madness visuals for a calmer experience.</p>
    </div>
  );
}

// ---------- title ----------
export function TitleScreen({ onPlay, onArchive, onHelp, onSettings }: { onPlay: () => void; onArchive: () => void; onHelp: () => void; onSettings: () => void }) {
  const sv = loadSave();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
      <TitleBackdrop />
      <div className="relative anim-fadeUp">
        <div className="text-6xl mb-2 anim-bob">🧭</div>
        <h1 className="font-title font-black text-5xl sm:text-7xl text-amber-100 leading-none" style={{ textShadow: "0 3px 0 #3a2410, 0 0 40px rgba(200,150,46,0.55)" }}>
          Cartographer's<br />Lament
        </h1>
        <p className="italic text-amber-200/90 mt-3 text-lg sm:text-xl">Draw the world before it is unwritten.</p>
        <div className="flex flex-col gap-3 mt-8 items-center">
          <button className="btn btn-gold !text-xl !px-10 !py-3 w-72" onClick={onPlay}>Begin Expedition</button>
          <button className="btn w-72" onClick={onArchive}>The Archive <span className="opacity-80 text-sm">· ◈ {sv.renown}</span></button>
          <button className="btn w-72" onClick={onHelp}>Field Guide &amp; Controls</button>
          <button className="btn w-72" onClick={onSettings}>Settings</button>
        </div>
        <p className="mt-6 text-xs text-amber-200/60">{sv.runs} expeditions · {sv.wins} completed · {sv.lore.length}/{LORE.length} lore pages</p>
      </div>
    </div>
  );
}

export function HelpScreen({ onClose }: { onClose: () => void }) {
  return (
    <Modal wide>
      <Title sub="Everything a cartographer needs to know">Field Guide</Title>
      <HelpContent />
      <button className="btn w-full mt-4" onClick={onClose}>Close</button>
    </Modal>
  );
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  return (
    <Modal>
      <Title>Settings</Title>
      <SettingsPanel />
      <button className="btn w-full mt-4" onClick={onClose}>Done</button>
    </Modal>
  );
}

// ---------- prepare ----------
export function PrepareScreen({ onStart, onBack }: { onStart: (cfg: RunConfig) => void; onBack: () => void }) {
  const sv = loadSave();
  const [cfg, setCfg] = useState<RunConfig>({ ...sv.lastCfg, tutorial: !sv.tutorialDone });
  const mult = DIFFICULTY[cfg.difficulty].renown + cfg.mods.reduce((a, m) => a + (MODIFIERS[m]?.renown ?? 0), 0);
  const cls = sv.classes.includes(cfg.classId) ? cfg.classId : "surveyor";
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <TitleBackdrop />
      <div className="relative max-w-4xl mx-auto p-4 sm:p-8">
        <div className="panel p-4 sm:p-6 anim-fadeUp">
          <Title sub="Choose your burden">Prepare the Expedition</Title>
          <h3 className="font-title font-bold mb-2">Difficulty</h3>
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((d) => (
              <button key={d} className={`choice ${cfg.difficulty === d ? "!bg-amber-300/80 !border-amber-900" : ""}`} onClick={() => { audio.sfx("click"); setCfg({ ...cfg, difficulty: d }); }}>
                <b className="font-title">{DIFFICULTY[d].name}</b>
                <div className="text-xs opacity-80">{DIFFICULTY[d].desc}</div>
                <div className="text-xs mt-1">Renown ×{DIFFICULTY[d].renown}</div>
              </button>
            ))}
          </div>
          <h3 className="font-title font-bold mb-2">Modifiers <span className="text-xs font-normal opacity-70">(more renown)</span></h3>
          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            {Object.entries(MODIFIERS).map(([id, m]) => {
              const on = cfg.mods.includes(id);
              return (
                <button key={id} className={`choice ${on ? "!bg-purple-300/70 !border-purple-900" : ""}`} onClick={() => { audio.sfx("click"); setCfg({ ...cfg, mods: on ? cfg.mods.filter((x) => x !== id) : [...cfg.mods, id] }); }}>
                  <b>{m.emoji} {m.name}</b> <span className="text-xs opacity-80">+{Math.round(m.renown * 100)}% renown</span>
                  <div className="text-xs opacity-80">{m.desc}</div>
                </button>
              );
            })}
          </div>
          <h3 className="font-title font-bold mb-2">Cartographer</h3>
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {Object.entries(CLASSES).map(([id, c]) => {
              const own = sv.classes.includes(id);
              return (
                <button key={id} disabled={!own} className={`choice ${cls === id ? "!bg-amber-300/80 !border-amber-900" : ""}`} onClick={() => { audio.sfx("click"); setCfg({ ...cfg, classId: id }); }}>
                  <b className="font-title">{c.emoji} {c.name}</b>
                  <div className="text-xs opacity-80">{c.desc}</div>
                  {!own && <div className="text-xs mt-1">🔒 Unlock in the Archive (◈ {c.cost})</div>}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={cfg.tutorial} onChange={(e) => setCfg({ ...cfg, tutorial: e.target.checked })} className="w-4 h-4 accent-amber-700" />
            <span>Guided field lessons (interactive tutorial)</span>
          </label>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <button className="btn btn-ghost !text-amber-100" onClick={onBack}>← Back</button>
            <span className="text-sm">Total renown multiplier: <b>×{mult.toFixed(2)}</b></span>
            <button className="btn btn-gold !px-8" onClick={() => { const c = { ...cfg, classId: cls }; const s = loadSave(); s.lastCfg = c; writeSave(s); onStart(c); }}>Set Out ➜</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- archive ----------
export function ArchiveScreen({ onBack }: { onBack: () => void }) {
  const [, force] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const sv = loadSave();
  const buy = (id: string, cost: number, max: number) => {
    const r = sv.upgrades[id] || 0;
    if (r >= max || sv.renown < cost) {
      audio.sfx("error");
      return;
    }
    sv.renown -= cost;
    sv.upgrades[id] = r + 1;
    writeSave(sv);
    audio.sfx("relic");
    force((v) => v + 1);
  };
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <TitleBackdrop />
      <div className="relative max-w-5xl mx-auto p-4 sm:p-8">
        <div className="panel p-4 sm:p-6 anim-fadeUp">
          <Title sub="Knowledge outlives the cartographer">The Archive</Title>
          <div className="text-center text-2xl font-title font-black mb-3">◈ {sv.renown} <span className="text-sm font-normal">renown to spend</span></div>
          <h3 className="font-title font-bold mb-2">Guild Upgrades</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {UPGRADES.map((u) => {
              const r = sv.upgrades[u.id] || 0;
              const cost = u.cost * (r + 1);
              const maxed = r >= u.max;
              return (
                <button key={u.id} className="choice" disabled={maxed || sv.renown < cost} onClick={() => buy(u.id, cost, u.max)}>
                  <div className="flex justify-between"><b>{u.emoji} {u.name}</b><span className="text-xs">{r}/{u.max}</span></div>
                  <div className="text-xs opacity-80">{u.desc}</div>
                  <div className="text-xs mt-1 font-bold">{maxed ? "Mastered" : `◈ ${cost}`}</div>
                </button>
              );
            })}
          </div>
          <h3 className="font-title font-bold mb-2">Cartographer Orders</h3>
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {Object.entries(CLASSES).map(([id, c]) => {
              const own = sv.classes.includes(id);
              return (
                <button key={id} className="choice" disabled={own || sv.renown < c.cost} onClick={() => { sv.renown -= c.cost; sv.classes.push(id); writeSave(sv); audio.sfx("relic"); force((v) => v + 1); }}>
                  <b>{c.emoji} {c.name}</b>
                  <div className="text-xs opacity-80">{c.desc}</div>
                  <div className="text-xs mt-1 font-bold">{own ? "Unlocked" : `◈ ${c.cost}`}</div>
                </button>
              );
            })}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-title font-bold mb-2">Codex ({sv.lore.length}/{LORE.length})</h3>
              <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto scroll-thin pr-1">
                {LORE.map((p, i) => (
                  <div key={i} className="p-2 rounded bg-black/10">
                    <b className="font-title text-xs">{sv.lore.includes(i) ? p.title : "??? Undiscovered"}</b>
                    <div className="italic text-xs">{sv.lore.includes(i) ? p.text : "Recover pages from libraries, obelisks, the dead, and the end of the road."}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-title font-bold mb-2">Records</h3>
              <div className="text-sm space-y-0.5 mb-2">
                <div>Expeditions: {sv.runs} · Completed: {sv.wins}</div>
                <div>Lifetime renown: {sv.lifetime}</div>
                <div>Tiles charted: {sv.totals.charted} · Foes: {sv.totals.kills} · Landmarks: {sv.totals.landmarks}</div>
              </div>
              <h4 className="font-title text-sm font-bold">Best expeditions</h4>
              {sv.best.length === 0 && <p className="text-xs italic opacity-70">None yet.</p>}
              {sv.best.map((b, i) => (
                <div key={i} className="text-xs flex justify-between p-1 rounded bg-black/10 mb-1">
                  <span>{i + 1}. {b.win ? "🏆" : "☠️"} {b.diff} · {CLASSES[b.cls]?.name ?? b.cls}</span>
                  <span>◈ {b.score} · day {b.days} · {b.charted}% mapped</span>
                </div>
              ))}
              <h4 className="font-title text-sm font-bold mt-2">Relics of the world</h4>
              <div className="text-lg flex flex-wrap gap-1" title="Relics you may find">{Object.values(RELICS).map((r) => <span key={r.name} title={`${r.name}: ${r.desc}`}>{r.emoji}</span>)}</div>
            </div>
          </div>
          <div className="flex justify-between mt-5">
            <button className="btn btn-ghost !text-amber-100" onClick={onBack}>← Back</button>
            <button className="btn btn-red btn-sm" onClick={() => { if (confirm) { resetSave(); setConfirm(false); force((v) => v + 1); } else setConfirm(true); }}>{confirm ? "Really erase all progress?" : "Erase progress"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- pause ----------
export function PauseMenu({ onResume, onAbandon, onQuit }: { onResume: () => void; onAbandon: () => void; onQuit: () => void }) {
  const [view, setView] = useState<"main" | "settings" | "help" | "confirm" | "quit">("main");
  return (
    <Modal dark={false} wide={view === "help"} z={60}>
      {view === "main" && (
        <>
          <Title sub="The ink waits.">Paused</Title>
          <div className="flex flex-col gap-2">
            <button className="btn btn-gold" onClick={onResume}>Resume <Kbd>Esc</Kbd></button>
            <button className="btn" onClick={() => setView("settings")}>Settings</button>
            <button className="btn" onClick={() => setView("help")}>Field Guide &amp; Controls</button>
            <button className="btn btn-red" onClick={() => setView("confirm")}>Abandon Expedition</button>
            <button className="btn btn-ghost !text-amber-100" onClick={() => setView("quit")}>Quit to Title (no progress)</button>
          </div>
        </>
      )}
      {view === "settings" && (
        <>
          <Title>Settings</Title>
          <SettingsPanel />
          <button className="btn w-full mt-4" onClick={() => setView("main")}>Back</button>
        </>
      )}
      {view === "help" && (
        <>
          <Title>Field Guide</Title>
          <HelpContent />
          <button className="btn w-full mt-4" onClick={() => setView("main")}>Back</button>
        </>
      )}
      {view === "confirm" && (
        <>
          <Title sub="You keep half the renown earned so far.">Abandon this expedition?</Title>
          <div className="flex gap-2"><button className="btn btn-red flex-1" onClick={onAbandon}>Abandon</button><button className="btn flex-1" onClick={() => setView("main")}>Keep going</button></div>
        </>
      )}
      {view === "quit" && (
        <>
          <Title sub="Nothing from this run will be recorded.">Quit to title?</Title>
          <div className="flex gap-2"><button className="btn btn-red flex-1" onClick={onQuit}>Quit</button><button className="btn flex-1" onClick={() => setView("main")}>Stay</button></div>
        </>
      )}
    </Modal>
  );
}

// ---------- end screens ----------
const CAUSES: Record<string, { title: string; text: string; emoji: string }> = {
  fallen: { title: "Fallen", emoji: "💀", text: "Your body gave out in the unmapped dark. Someone, someday, will find your half-drawn map." },
  mad: { title: "Lost to the Lament", emoji: "🌀", text: "The whispers won. You are drawing now, and cannot stop, and no one reads the lines." },
  abandon: { title: "Expedition Abandoned", emoji: "🏳️", text: "You close the journal. The ink dries. The Unwriting continues without you." },
  victory: { title: "The Map is Complete", emoji: "🏆", text: "The Unwritten unravels into ink, and the ink becomes a coastline. For the first time, the world has an edge, and you drew it." },
};

export function EndScreen({ over, onRetry, onArchive, onTitle, onContinue }: { over: OverState; onRetry: () => void; onArchive: () => void; onTitle: () => void; onContinue?: () => void }) {
  const c = CAUSES[over.kind] ?? CAUSES.fallen;
  const s = over.stats;
  const Row = ({ k, v }: { k: string; v: string | number }) => (
    <div className="flex justify-between border-b border-black/10 py-0.5"><span>{k}</span><b>{v}</b></div>
  );
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-3 overflow-y-auto" style={{ background: over.win ? "radial-gradient(circle,rgba(60,40,5,0.8),rgba(10,6,2,0.95))" : "radial-gradient(circle,rgba(30,10,30,0.8),rgba(5,2,6,0.96))" }}>
      <div className="panel anim-pop w-full max-w-2xl p-5 sm:p-7 my-auto">
        <div className="text-center">
          <div className={`text-7xl ${over.win ? "anim-bob" : "anim-glitch"}`}>{c.emoji}</div>
          <h2 className="font-title font-black text-3xl sm:text-4xl">{c.title}</h2>
          <p className="italic opacity-80 mb-3">{c.text}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 text-sm mb-3">
          <div>
            <Row k="Difficulty" v={over.difficulty} />
            <Row k="Order" v={over.cls} />
            <Row k="Days survived" v={over.days} />
            <Row k="Map charted" v={`${Math.round(over.pct)}% (${over.charted} tiles)`} />
            <Row k="Sigils claimed" v={`${over.sigils}/3`} />
            <Row k="Landmarks found" v={s.landmarks} />
          </div>
          <div>
            <Row k="Foes defeated" v={s.kills} />
            <Row k="Damage dealt / taken" v={`${s.damageDealt} / ${s.damageTaken}` } />
            <Row k="Sanity lost" v={s.sanityLost} />
            <Row k="Relics found" v={s.relics} />
            <Row k="Camps / pins / corrections" v={`${s.camps} / ${s.pins} / ${s.corrected}`} />
            <Row k="Tiles walked" v={s.tilesWalked} />
          </div>
        </div>
        {over.relics.length > 0 && <div className="text-2xl text-center mb-2" title="Relics carried">{over.relics.map((r) => <span key={r} title={RELICS[r].name}>{RELICS[r].emoji}</span>)}</div>}
        <div className="p-3 rounded bg-amber-700/20 border-2 border-amber-900/50 text-center mb-3">
          <div className="text-xs tracking-widest font-title">RENOWN EARNED</div>
          <div className="font-title font-black text-3xl">◈ +{over.gain}</div>
          <div className="text-xs opacity-75">Score {over.score} × {over.mult.toFixed(2)}{over.kind === "abandon" ? " × 0.5" : ""}</div>
          {over.newLore.length > 0 && <div className="text-xs mt-1">📜 New codex pages: {over.newLore.join(", ")}</div>}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <button className="btn btn-gold" onClick={onRetry}>{over.win ? "New Expedition" : "Try Again"}</button>
          {over.win && onContinue && <button className="btn" onClick={onContinue}>Keep Exploring</button>}
          <button className="btn" onClick={onArchive}>Spend Renown</button>
          <button className="btn btn-ghost !text-amber-100" onClick={onTitle}>Title</button>
        </div>
      </div>
    </div>
  );
}
