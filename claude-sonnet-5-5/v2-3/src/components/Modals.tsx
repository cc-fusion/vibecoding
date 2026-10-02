import { useState } from "react";
import type { Game } from "../game/engine";
import { landmarkActions } from "../game/content";
import { FACTIONS, LM, LORE, PINS, RELICS } from "../game/data";
import { hexDist } from "../game/hex";
import type { FactionId, RelicId } from "../game/types";
import { Modal, Title, Kbd } from "./ui";
import { HelpContent } from "./Help";

export function InfoModal({ g, title, body, emoji }: { g: Game; title: string; body: string; emoji: string }) {
  return (
    <Modal>
      <Title>{emoji} {title}</Title>
      <p className="mb-4">{body}</p>
      <button className="btn w-full" onClick={() => g.closeModal()}>Continue</button>
    </Modal>
  );
}

export function EventModal({ g }: { g: Game }) {
  const m = g.modal;
  if (!m || m.type !== "event") return null;
  const ev = m.ev;
  return (
    <Modal>
      <div className="text-center text-6xl mb-1 anim-bob">{ev.emoji}</div>
      <Title>{ev.title}</Title>
      <p className="italic mb-4 text-center">{ev.text}</p>
      {m.result === null ? (
        <div className="space-y-2">
          {ev.choices.map((c, i) => {
            const why = c.disabled ? c.disabled(g) : null;
            return (
              <button key={i} className="choice" disabled={!!why} onClick={() => g.eventChoose(i)}>
                <div className="flex items-baseline gap-2">
                  <Kbd>{i + 1}</Kbd>
                  <b>{c.label}</b>
                </div>
                <div className="text-xs opacity-75 ml-8">{why ? `🔒 ${why}` : c.hint}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="anim-fadeUp">
          <div className="p-3 rounded bg-black/10 border border-black/20 mb-4">{m.result}</div>
          <button className="btn w-full" onClick={() => g.closeModal()}>Continue the expedition</button>
        </div>
      )}
    </Modal>
  );
}

export function LandmarkModal({ g }: { g: Game }) {
  const m = g.modal;
  if (!m || m.type !== "landmark") return null;
  const lm = LM[(m.tile.feature as { id: keyof typeof LM }).id];
  const acts = landmarkActions(g, m.tile);
  return (
    <Modal>
      <div className="text-center text-6xl mb-1 anim-bob">{lm.emoji}</div>
      <Title sub={lm.desc}>{lm.name}</Title>
      <div className="flex flex-wrap justify-center gap-3 text-sm mb-3 opacity-90">
        <span>🪙 {g.gold}</span><span>🍖 {g.supplies}/{g.maxSupplies}</span><span>🖋️ {g.ink}/{g.maxInk}</span><span>🧠 {Math.round(g.sanity)}</span><span>❤️ {Math.round(g.vigor)}</span><span>🧪 {g.tonics}</span><span>💊 {g.laud}</span>
      </div>
      {m.log && <div className="p-3 rounded bg-black/10 border border-black/20 mb-3 text-sm anim-fadeUp">{m.log}</div>}
      <div className="space-y-2">
        {acts.map((a, i) => (
          <button key={i} className="choice" disabled={!!a.disabled} onClick={() => g.landmarkAct(i)}>
            <div className="flex items-baseline gap-2"><Kbd>{i + 1}</Kbd><b>{a.label}</b></div>
            <div className="text-xs opacity-75 ml-8">{a.disabled ? `🔒 ${a.disabled}` : a.hint}</div>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost w-full mt-3 !text-amber-100" onClick={() => g.closeModal()}>Leave <Kbd>Esc</Kbd></button>
    </Modal>
  );
}

export function CombatModal({ g }: { g: Game }) {
  const m = g.modal;
  if (!m || m.type !== "combat") return null;
  const c = m.c;
  const e = c.enemy;
  const hpPct = (c.hp / c.maxHp) * 100;
  const it = c.intent;
  const red = c.redacted;
  const parley = g.parleyChance(c);
  const flare = g.flareCost();
  const A = (id: string, icon: string, label: string, sub: string, k: string, disabled: boolean) => (
    <button key={id} className={`choice !p-2 ${red === id ? "!line-through" : ""}`} disabled={disabled || !!c.over || red === id} onClick={() => g.combatAct(id)}>
      <div className="flex items-center gap-2"><span className="text-xl">{icon}</span><b className="text-sm">{label}</b><span className="ml-auto"><Kbd>{k}</Kbd></span></div>
      <div className="text-[11px] opacity-75">{red === id ? "▮▮▮ REDACTED ▮▮▮" : sub}</div>
    </button>
  );
  return (
    <Modal wide z={45}>
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-4">
        <div>
          <div className="text-center relative">
            <div className={`text-[88px] leading-none inline-block ${c.boss ? "anim-glitch" : "anim-bob"}`}>
              <span key={c.anim.id} className={`inline-block ${c.anim.enemy}`}>{e.emoji}</span>
            </div>
            {c.anim.ne && (
              <div key={"n" + c.anim.id} className="absolute left-1/2 top-2 text-3xl font-black text-red-700 pointer-events-none" style={{ animation: "floatNum 0.9s ease forwards" }}>{c.anim.ne}</div>
            )}
          </div>
          <h3 className="font-title text-xl font-black text-center">{e.name}{c.boss && ` · Phase ${["I", "II", "III"][c.phase]}`}</h3>
          <p className="text-center text-xs italic opacity-70 mb-2">{e.desc}</p>
          <div className="bar !h-4"><i style={{ width: hpPct + "%", background: "linear-gradient(90deg,#8b2b22,#d65a3a)" }} /></div>
          <div className="text-xs text-center mb-2">{c.hp} / {c.maxHp} HP {e.armor + c.guard > 0 && <span>· 🛡️ armor {e.armor + c.guard}</span>} {c.stunned && <b className="text-purple-700">· STUNNED</b>}</div>
          <div className="p-2 rounded border-2 border-red-900/50 bg-red-900/10 text-sm">
            <div className="text-[10px] tracking-widest font-title opacity-70">NEXT INTENT</div>
            <div className="flex items-center gap-2"><span className="text-2xl">{it.icon}</span>
              <div><b>{it.label}</b>
                <div className="text-xs">{it.dmg > 0 && <span className="mr-2">−{c.brace ? Math.ceil(it.dmg * 0.35) : it.dmg} ❤️</span>}{it.san > 0 && <span>−{c.brace ? Math.ceil(it.san * 0.6) : it.san} 🧠</span>}{it.dmg === 0 && it.san === 0 && <span>no damage</span>}{c.brace && <span className="opacity-60"> (braced)</span>}</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div key={"box" + c.anim.id} className={`relative grid grid-cols-2 gap-x-3 gap-y-1 mb-3 p-2 rounded bg-black/10 text-sm ${c.anim.player === "anim-shake" ? "anim-shake" : ""}`}>
            <div>❤️ Vigor <b>{Math.round(g.vigor)}</b>/{g.maxVigor}<div className="bar"><i style={{ width: (g.vigor / g.maxVigor) * 100 + "%", background: "#c0453a" }} /></div></div>
            <div>🧠 Sanity <b>{Math.round(g.sanity)}</b>/{g.maxSanity}<div className="bar"><i style={{ width: (g.sanity / g.maxSanity) * 100 + "%", background: "#8a5ab5" }} /></div></div>
            {c.anim.np && (
              <div key={"p" + c.anim.id} className={`absolute right-4 -top-2 text-3xl font-black pointer-events-none ${c.anim.npKind === "heal" ? "text-green-700" : c.anim.npKind === "sheal" || c.anim.npKind === "san" ? "text-purple-700" : "text-red-700"}`} style={{ animation: "floatNum 0.9s ease forwards" }}>{c.anim.np}</div>
            )}

          </div>
          {c.over ? (
            <div className="anim-fadeUp">
              <div className={`p-3 rounded border-2 mb-3 ${c.over === "win" || c.over === "parley" ? "border-green-800/60 bg-green-800/10" : "border-amber-800/60 bg-amber-800/10"}`}>
                <b className="font-title">{c.over === "win" ? "⚔️ Victory" : c.over === "parley" ? "🕊️ Peace" : "💨 Escaped"}</b>
                <p className="text-sm">{c.reward}</p>
              </div>
              <button className="btn btn-gold w-full" onClick={() => g.closeCombat()}>{c.boss && c.over === "win" ? "Behold the finished map" : "Continue"}</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {A("strike", "🗡️", "Strike", `${g.strikeBase()}–${g.strikeBase() + 2} dmg, minus armor`, "1", false)}
              {A("flare", "✨", "Ink Flare", `${g.flareDamage() * (e.weak === "flare" ? 2 : 1)} dmg, ignores armor${c.boss ? "" : ", stuns"} · ${flare} ink`, "2", g.ink < flare)}
              {A("brace", "🛡️", "Brace", "Take 65% less. +3 sanity", "3", false)}
              {A("parley", "🕊️", "Parley", parley > 0 ? `${Math.round(parley * 100)}% chance` : "Cannot be reasoned with", "4", parley <= 0)}
              {A("flee", "💨", "Flee", c.noFlee ? "No escape from the Spire" : `${Math.round(g.fleeChance(c) * 100)}% · retreat 1 tile`, "5", c.noFlee)}
              {A("tonic", "🧪", `Tonic ×${g.tonics}`, "+12 vigor (uses turn)", "H", g.tonics <= 0)}
              {A("laud", "💊", `Laudanum ×${g.laud}`, "+20 sanity (uses turn)", "G", g.laud <= 0)}
              {c.gilded > 0 && A("gilded", "💥", `Gilded Charge ×${c.gilded}`, "10 dmg, ignores armor", "6", false)}
            </div>
          )}
          <div className="mt-3 p-2 rounded bg-black/10 text-xs space-y-0.5 min-h-[88px]">
            {c.log.map((l, i) => (
              <div key={i} className={l.c === "e" ? "text-red-900" : l.c === "p" ? "text-emerald-900" : "text-purple-900 italic"} style={{ opacity: 0.55 + (i / Math.max(1, c.log.length)) * 0.45 }}>{l.t}</div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

type Tab = "exp" | "fac" | "rel" | "lm" | "cod" | "help";

export function JournalModal({ g }: { g: Game }) {
  const [tab, setTab] = useState<Tab>("exp");
  const tabs: [Tab, string][] = [["exp", "📖 Expedition"], ["fac", "⚖️ Factions"], ["rel", "🏺 Relics"], ["lm", "📍 Landmarks"], ["cod", "📜 Codex"], ["help", "❓ Help"]];
  const lms = g.tiles.filter((t) => t.feature?.kind === "landmark" && t.ls.disc);
  const s = g.stats;
  return (
    <Modal wide>
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map(([id, label]) => (
          <button key={id} className={`btn btn-sm ${tab === id ? "btn-gold" : "btn-ghost !text-amber-100"}`} onClick={() => setTab(id)}>{label}</button>
        ))}
        <button className="btn btn-sm btn-red ml-auto" onClick={() => g.closeModal()}>Close <Kbd>J</Kbd></button>
      </div>
      {tab === "exp" && (
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <h3 className="font-title font-bold text-lg">Progress</h3>
            <div>Day <b>{g.day}</b> · Map charted <b>{Math.round(g.pct())}%</b> ({g.charted} tiles)</div>
            <div>🔱 Sigils claimed: <b>{g.sigils}/3</b> · 🌀 Spire distance: <b>{hexDist(g.p, g.spire)}</b></div>
            <div>📌 Pins: {g.pinCount()}/{g.maxPins()}</div>
            <div>Difficulty: <b>{g.cfg.difficulty}</b>{g.cfg.mods.length > 0 && <> · Modifiers: {g.cfg.mods.join(", ")}</>}</div>
            <div>Max sanity {g.maxSanity} · Max vigor {g.maxVigor} · Strike {g.strikeBase()}+ · Flare {g.flareDamage()}</div>
            <div>Hallucination chance on unpinned tiles: <b>{Math.round(g.halluP() * 100)}%</b></div>
            <div>Shop price multiplier: <b>×{g.priceMult().toFixed(2)}</b></div>
          </div>
          <div className="space-y-1">
            <h3 className="font-title font-bold text-lg">Statistics</h3>
            <div>Tiles walked {s.tilesWalked} · charted {s.tilesCharted}</div>
            <div>Landmarks found {s.landmarks} · Relics {s.relics}</div>
            <div>Foes defeated {s.kills} · Damage dealt {s.damageDealt}</div>
            <div>Damage taken {s.damageTaken} · Sanity lost {s.sanityLost}</div>
            <div>Camps {s.camps} · Pins placed {s.pins} · Corrections {s.corrected}</div>
            <div>Gold earned {s.goldEarned} · Land shifts {s.shifts}</div>
            <div className="pt-2 flex gap-2">
              <button className="btn btn-sm" disabled={g.tonics <= 0} onClick={() => g.useItem("tonic")}>🧪 Use tonic ({g.tonics})</button>
              <button className="btn btn-sm" disabled={g.laud <= 0} onClick={() => g.useItem("laud")}>💊 Use laudanum ({g.laud})</button>
            </div>
          </div>
          <div className="sm:col-span-2 text-xs opacity-80 italic">Pin legend: {PINS.slice(1).map((p) => `${p.glyph} ${p.name}`).join(" · ")}</div>
        </div>
      )}
      {tab === "fac" && (
        <div className="space-y-3">
          {(Object.keys(FACTIONS) as FactionId[]).map((f) => {
            const F = FACTIONS[f];
            const v = g.rep[f];
            return (
              <div key={f} className="p-2 rounded bg-black/10">
                <div className="flex justify-between items-center"><b className="font-title">{F.emoji} {F.name}</b><span className="text-sm"><b>{g.repLabel(v)}</b> ({v})</span></div>
                <div className="bar !h-3 my-1 relative"><i style={{ width: (v + 100) / 2 + "%", background: F.color }} /><span className="absolute left-1/2 top-0 h-full w-px bg-white/60" /></div>
                <div className="text-xs opacity-80">{F.desc}</div>
              </div>
            );
          })}
          <div className="text-xs italic opacity-70">Hostile factions (below −25) send ambushes. At +40 they aid you against The Unwritten.</div>
        </div>
      )}
      {tab === "rel" && (
        <div className="grid sm:grid-cols-2 gap-2">
          {g.relics.length === 0 && <p className="italic opacity-70">No relics yet. Seek them in caves, libraries, markets and fallen ambushers.</p>}
          {g.relics.map((r: RelicId) => (
            <div key={r} className="p-2 rounded bg-black/10 flex gap-2"><span className="text-3xl">{RELICS[r].emoji}</span><div><b>{RELICS[r].name}</b><div className="text-xs">{RELICS[r].desc}</div></div></div>
          ))}
        </div>
      )}
      {tab === "lm" && (
        <div className="space-y-1 text-sm">
          {lms.map((t, i) => {
            const L = LM[(t.feature as { id: keyof typeof LM }).id];
            return <div key={i} className="flex justify-between p-1.5 rounded bg-black/10"><span>{L.emoji} {L.name}{t.ls.claimed ? " ✔" : ""}</span><span className="opacity-70">{hexDist(g.p, t)} tiles away</span></div>;
          })}
          {g.rumors.map((r, i) => <div key={"r" + i} className="flex justify-between p-1.5 rounded bg-amber-900/20"><span>🔱 Rumor: {r.label}</span><span className="opacity-70">~{hexDist(g.p, r)} tiles</span></div>)}
        </div>
      )}
      {tab === "cod" && (
        <div className="space-y-2 text-sm">
          {LORE.map((p, i) => {
            const known = g.save.lore.includes(i);
            return (
              <div key={i} className="p-2 rounded bg-black/10">
                <b className="font-title">{known ? p.title : "??? Undiscovered page"}</b>
                <div className="italic text-xs">{known ? p.text : "Find libraries, obelisks and the dead to recover this page."}</div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "help" && <HelpContent />}
    </Modal>
  );
}
