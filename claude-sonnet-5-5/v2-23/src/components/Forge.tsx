import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, Settings } from "../game/save";
import {
  PARTS, SLOTS, SLOT_LABEL, TAGS, TAG_META, SYNERGIES, ROW_NAMES, FINAL_ROUND, DIFFICULTIES, MUTAGENS, partDesc, partStats,
} from "../game/data";
import { computeSynergy, previewTeam, type PartInst } from "../game/battle";
import {
  buy, reroll, toggleFreeze, upgradeForge, sell, move, quickEquip, swapChimeras, rerollCost, forgeCost, partCost, sellValue,
  benchSize, genEnemy, hasMut, lab, isBossRound, getPart, type RunState, type Loc, type ActResult,
} from "../game/run";
import { ChimeraCanvas, PartChip, PartInfo, Kbd } from "./ui";
import { audio } from "../game/audio";

type Act = (fn: (r: RunState, m: Meta, s: Settings) => ActResult) => void; // runs a pure-ish mutation on cloned state

const TUT: { title: string; text: string; action: boolean }[] = [
  { title: "Welcome, Forgemaster!", text: "You stitch beasts from body parts and send them to fight automatically. Win rounds, survive 3 bosses, and conquer the 15-round gauntlet. Let's build your first chimera.", action: false },
  { title: "1 · Buy a part", text: "Click a card in the Shop (or press 1–5) to buy it with gold. Parts have a Tag (🐺🐉🦂🦅🌀) and fit a Head, Torso, Limbs or Tail socket.", action: true },
  { title: "2 · Place & move parts", text: "Parts auto-fill empty sockets, but you decide where they go. Drag a part — or click it, then click another socket — to move or swap. ⚡ means the part resonates in that row (×1.5 power).", action: true },
  { title: "3 · Synergies & evolution", text: "Own 2 / 4 / 6 parts of one Tag across your team to unlock team-wide bonuses (see the Synergies panel). Buy 3 identical parts and they merge into a stronger Tier ★★. A chimera with 4 same-Tag parts becomes Pure (+20%).", action: false },
  { title: "4 · Formation matters", text: "Enemies hit the Front row most (50%), Middle (30%), Back (20%). Use the ◀ ▶ buttons to reorder your chimeras. Tails like Ward and Inspire affect the units behind or beside them.", action: false },
  { title: "5 · Fight!", text: "Spend gold wisely — interest pays +1 per 5 gold banked. When ready, press FIGHT (Space). The battle plays out automatically; you can speed it up.", action: true },
  { title: "You've got it!", text: "Rerolls, freezing the shop, and upgrading the Forge unlock rarer parts. Bosses arrive on rounds 5, 10 and 15. Check How To Play anytime from the pause menu. Good luck!", action: false },
];

export default function Forge({ run, meta, act, onFight, onPause, onTut }: {
  run: RunState; meta: Meta; act: Act; onFight: () => void; onPause: () => void; onTut: (next: number) => void;
}) {
  const [sel, setSel] = useState<Loc | null>(null);
  const [hover, setHover] = useState<{ part: PartInst; row?: number } | null>(null);
  const drag = useRef<Loc | null>(null);
  const [burst, setBurst] = useState<{ id: string; tier: number; k: number } | null>(null);
  const lastK = useRef(run.evolve?.k ?? 0);
  const diff = DIFFICULTIES.find((d) => d.id === run.diff)!;
  const glass = hasMut(run, "glass");

  useEffect(() => {
    if (run.evolve && run.evolve.k !== lastK.current) {
      lastK.current = run.evolve.k;
      setBurst(run.evolve);
      const t = setTimeout(() => setBurst(null), 1100);
      return () => clearTimeout(t);
    }
  }, [run.evolve]);

  const preview = useMemo(
    () => previewTeam(run.team, { hpMult: 1, atkMult: 1, glass, labHp: lab(meta, "vigor") * 0.04, labAtk: lab(meta, "fang") * 0.03 }),
    [run.team, glass, meta],
  );
  const enemy = useMemo(() => genEnemy(run), [run.seed, run.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const foggy = hasMut(run, "fog") && !enemy.boss;
  const enemySyn = useMemo(() => computeSynergy(enemy.team), [enemy]);

  const selPart = sel ? getPart(run, sel) : null;
  const infoPart = hover?.part ?? selPart;
  const infoRow = hover ? hover.row : sel && sel.t === "sock" ? sel.c : undefined;

  const doMove = (from: Loc, to: Loc | "sell") => {
    if (to === "sell") act((r, m) => (from.t === "shop" ? { err: "Can't sell shop items" } : sell(r, m, from)));
    else act((r, m) => move(r, m, from, to));
    setSel(null); drag.current = null;
  };
  const target = (to: Loc | "sell") => {
    const from = drag.current ?? sel;
    if (!from) return false;
    doMove(from, to); return true;
  };
  const clickSocket = (c: number, s: number) => {
    if (sel) { if (sel.t === "sock" && sel.c === c && sel.s === s) setSel(null); else target({ t: "sock", c, s }); return; }
    if (run.team[c].parts[s]) { setSel({ t: "sock", c, s }); audio.sfx("click"); }
  };
  const clickCard = (c: number) => {
    if (!sel) return;
    const p = getPart(run, sel); if (!p) return;
    target({ t: "sock", c, s: SLOTS.indexOf(PARTS[p.id].slot) });
  };
  const sellSel = () => { if (sel && sel.t !== "shop") doMove(sel, "sell"); };

  // keyboard
  const ref = useRef({ act, onFight, run, meta, sel });
  ref.current = { act, onFight, run, meta, sel };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const { act, onFight, sel } = ref.current;
      if ((e.target as HTMLElement)?.tagName === "INPUT" || document.querySelector("[data-modal]")) return;
      if (e.key >= "1" && e.key <= "5") { const i = parseInt(e.key) - 1; act((r, m, s) => buy(r, m, s, i)); }
      else if (e.key === "r" || e.key === "R") act((r, m) => reroll(r, m));
      else if (e.key === "f" || e.key === "F") act((r) => toggleFreeze(r));
      else if (e.key === "u" || e.key === "U") act((r) => upgradeForge(r));
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFight(); }
      else if ((e.key === "s" || e.key === "S" || e.key === "Delete" || e.key === "Backspace") && sel && sel.t !== "shop") { const s = sel; act((r, m) => sell(r, m, s)); setSel(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const filled = run.team.reduce((n, c) => n + c.parts.filter(Boolean).length, 0);
  const rc = rerollCost(run, meta);
  const fc = forgeCost(run);
  const bs = benchSize(meta);
  const tut = run.tut >= 0 ? TUT[run.tut] : null;

  const socket = (c: number, s: number) => {
    const part = run.team[c].parts[s];
    const slot = SLOTS[s];
    const fits = selPart && PARTS[selPart.id].slot === slot;
    const isSel = sel?.t === "sock" && sel.c === c && sel.s === s;
    return (
      <div
        key={s}
        onClick={(e) => { e.stopPropagation(); clickSocket(c, s); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); target({ t: "sock", c, s }); }}
        className={`rounded-lg border border-dashed border-white/15 bg-black/25 p-0.5 transition ${fits ? "drop-ok" : ""}`}
      >
        {part ? (
          <PartChip part={part} row={c} compact selected={isSel} onHover={(p) => setHover(p ? { part: p, row: c } : null)}
            onDragStart={() => { drag.current = { t: "sock", c, s }; setSel({ t: "sock", c, s }); }} onDragEnd={() => { drag.current = null; }}
            onDoubleClick={() => { act((r, m) => quickEquip(r, m, { t: "sock", c, s })); setSel(null); }} />
        ) : (
          <div className="text-[11px] opacity-45 text-center py-2.5 select-none">+ {SLOT_LABEL[slot]}</div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full w-full overflow-y-auto scroll-thin bg-forge" onClick={() => setSel(null)}>
      <div className="mx-auto max-w-[1400px] p-2 sm:p-3 flex flex-col gap-2 min-h-full">
        {/* top bar */}
        <div className="panel flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
          <div>
            <div className="font-title text-xl leading-none text-amber-200">Round {run.round}{run.round <= FINAL_ROUND ? <span className="text-sm opacity-60"> / {FINAL_ROUND}</span> : <span className="text-sm text-fuchsia-300"> ∞ Endless</span>}</div>
            <div className="text-[11px] opacity-70" style={{ color: diff.color }}>{diff.name}{run.mutagens.length > 0 && ` · ${run.mutagens.map((id) => MUTAGENS.find((m) => m.id === id)?.icon).join("")}`}</div>
          </div>
          <div className="flex items-center gap-1 text-lg" title="Lives. Boss losses cost 2.">
            {Array.from({ length: run.maxLives }).map((_, i) => <span key={i} className={i < run.lives ? "" : "opacity-20 grayscale"}>❤️</span>)}
          </div>
          <div className="flex items-center gap-1 font-bold text-xl text-yellow-300" title="Gold"><span className="anim-flicker">🪙</span><span key={run.gold} className="anim-pop inline-block tabular-nums">{run.gold}</span>
            <span className="text-[11px] font-normal opacity-70 ml-1">+{Math.min(2 + lab(meta, "interest"), Math.floor(run.gold / 5))} interest</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="chip" title="Forge level controls the rarity of parts in the shop">🔨 Forge L{run.forge}</span>
            <button className="btn btn-sm" disabled={run.forge >= 4 || run.gold < fc} onClick={(e) => { e.stopPropagation(); act((r) => upgradeForge(r)); }}>
              {run.forge >= 4 ? "Max" : `Upgrade ${fc}🪙`} <Kbd>U</Kbd>
            </button>
          </div>
          {run.streakW >= 2 && <span className="chip text-orange-300">🔥 Streak ×{run.streakW}</span>}
          {run.mercy && <span className="chip text-sky-300" title="Enemies are 7% weaker after a defeat">🕊 Mercy</span>}
          <div className="ml-auto flex gap-2">
            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onPause(); }}>⏸ Pause <Kbd>Esc</Kbd></button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_330px] flex-1">
          {/* left: chimeras + shop */}
          <div className="flex flex-col gap-2 min-w-0">
            <div className="grid gap-2 md:grid-cols-3">
              {run.team.map((ch, c) => {
                const st = preview.stats[c];
                const bond = st.bond;
                return (
                  <div key={c} onClick={(e) => { e.stopPropagation(); clickCard(c); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const p = drag.current ? getPart(run, drag.current) : null; if (p) target({ t: "sock", c, s: SLOTS.indexOf(PARTS[p.id].slot) }); }}
                    className={`panel p-2 relative transition ${selPart ? "hover:brightness-125" : ""}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="chip" style={{ color: ["#ff9b9b", "#ffd166", "#9bd1ff"][c] }}>{ROW_NAMES[c]} · {["50%", "30%", "20%"][c]} hit chance</span>
                      <span className="flex gap-1">
                        <button className="btn btn-sm !px-2 !py-0" disabled={c === 0} onClick={(e) => { e.stopPropagation(); act((r) => swapChimeras(r, c, c - 1)); }} title="Move toward the front">◀</button>
                        <button className="btn btn-sm !px-2 !py-0" disabled={c === 2} onClick={(e) => { e.stopPropagation(); act((r) => swapChimeras(r, c, c + 1)); }} title="Move toward the back">▶</button>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChimeraCanvas chimera={ch} w={130} h={100} scale={1.1} anim />
                      <div className="text-xs space-y-0.5 flex-1">
                        <div className="font-bold text-sm text-amber-100">{ch.name}</div>
                        <div title="Health">❤ {Math.round(st.hp)}</div>
                        <div title="Attack damage per hit">⚔ {st.atk.toFixed(1)} <span className="opacity-60">· {(st.atk * Math.max(0.35, st.spd) / 1.6).toFixed(1)}/s</span></div>
                        <div title="Attack speed multiplier">⚡ ×{st.spd.toFixed(2)} {st.def > 0 && <span title="Armor">🛡 {st.def.toFixed(1)}</span>}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 my-1 min-h-[20px]">
                      {bond === "pure" && <span className="chip text-amber-300" title="All 4 parts share a Tag: +20% HP & ATK">💎 Pure +20%</span>}
                      {bond === "mosaic" && <span className="chip text-fuchsia-300" title="4 different Tags: +12% HP & ATK">🎨 Mosaic +12%</span>}
                      {st.resonant > 0 && <span className="chip text-yellow-300" title="Parts in their favored row get ×1.5">⚡ {st.resonant} resonating</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-1">{[0, 1, 2, 3].map((s) => socket(c, s))}</div>
                  </div>
                );
              })}
            </div>

            {/* shop */}
            <div className="panel p-2">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-title text-lg text-amber-200">Part Shop {run.frozen && <span className="text-sky-300 text-sm">❄ frozen</span>}</h3>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-sm" disabled={run.gold < rc} onClick={(e) => { e.stopPropagation(); act((r, m) => reroll(r, m)); }}>🎲 Reroll {rc === 0 ? "FREE" : `${rc}🪙`} <Kbd>R</Kbd></button>
                  <button className={`btn btn-sm ${run.frozen ? "!border-sky-400" : ""}`} onClick={(e) => { e.stopPropagation(); act((r) => toggleFreeze(r)); }}>❄ Freeze <Kbd>F</Kbd></button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {run.shop.map((it, i) => {
                  if (!it) return <div key={i} className="rounded-lg border border-dashed border-white/10 min-h-[92px] flex items-center justify-center text-xs opacity-30">sold</div>;
                  const d = PARTS[it.id], col = TAG_META[d.tag].color, cost = partCost(it.id), s = partStats(d, 1);
                  const afford = run.gold >= cost;
                  return (
                    <div key={it.uid} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.id); drag.current = { t: "shop", i }; }} onDragEnd={() => { drag.current = null; }}
                      onClick={(e) => { e.stopPropagation(); act((r, m, st) => buy(r, m, st, i)); }}
                      onMouseEnter={() => { setHover({ part: it }); audio.sfx("hover"); }} onMouseLeave={() => setHover(null)}
                      className={`part-card anim-pop relative rounded-lg border p-2 cursor-pointer ${afford ? "" : "opacity-50"}`}
                      style={{ borderColor: col, background: `linear-gradient(160deg, ${col}2e, #150d12)`, animationDelay: `${i * 40}ms` }}>
                      <div className="flex justify-between items-start">
                        <span className="text-2xl">{d.icon}</span>
                        <span className={`font-bold text-sm ${afford ? "text-yellow-300" : "text-red-400"}`}>{cost}🪙</span>
                      </div>
                      <div className="text-xs font-semibold leading-tight mt-0.5">{d.name}</div>
                      <div className="text-[10px]" style={{ color: col }}>{TAG_META[d.tag].name} · {SLOT_LABEL[d.slot]} {d.rarity > 1 && <span className="text-amber-300">{"◆".repeat(d.rarity - 1)}</span>}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{[s.hp ? `❤${s.hp}` : "", s.atk ? `⚔${s.atk}` : "", s.spd ? `⚡${Math.round(s.spd * 100)}%` : "", s.def ? `🛡${s.def}` : ""].filter(Boolean).join(" ")}</div>
                      <div className="text-[10px] text-amber-100/80 leading-tight mt-0.5">{partDesc(d, 1)}</div>
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] opacity-40"><Kbd>{i + 1}</Kbd></div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* bench */}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="panel p-2" onClick={(e) => { e.stopPropagation(); if (sel && sel.t === "sock") target({ t: "bench", i: 0 }); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); target({ t: "bench", i: 0 }); }}>
                <div className="text-xs font-bold opacity-80 mb-1">🧰 Bench <span className="opacity-60">({run.bench.length}/{bs}) — double-click a part to auto-equip</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-1">
                  {Array.from({ length: bs }).map((_, i) => {
                    const p = run.bench[i];
                    return p ? (
                      <PartChip key={p.uid} part={p} compact selected={sel?.t === "bench" && sel.i === i} onHover={(x) => setHover(x ? { part: x } : null)}
                        onClick={() => { if (sel && sel.t === "bench" && sel.i === i) setSel(null); else setSel({ t: "bench", i }); audio.sfx("click"); }}
                        onDoubleClick={() => { act((r, m) => quickEquip(r, m, { t: "bench", i })); setSel(null); }}
                        onDragStart={() => { drag.current = { t: "bench", i }; setSel({ t: "bench", i }); }} onDragEnd={() => { drag.current = null; }} />
                    ) : <div key={i} className="rounded-lg border border-dashed border-white/10 min-h-[38px]" />;
                  })}
                </div>
              </div>
              <div className="flex sm:flex-col gap-2">
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); target("sell"); }}
                  onClick={(e) => { e.stopPropagation(); sellSel(); }}
                  className={`panel flex-1 sm:w-36 p-2 flex flex-col items-center justify-center text-center text-xs cursor-pointer ${selPart && sel?.t !== "shop" ? "!border-red-400 anim-glow" : "opacity-70"}`}>
                  <div className="text-xl">♻️</div>
                  <div>{selPart && sel?.t !== "shop" ? `Sell for ${sellValue(selPart, meta)}🪙` : "Drop to sell"}</div>
                  <div className="opacity-60"><Kbd>S</Kbd></div>
                </div>
              </div>
            </div>
          </div>

          {/* right sidebar */}
          <div className="flex flex-col gap-2 min-w-0">
            <div className="panel p-2">
              <h3 className="font-title text-lg text-amber-200 mb-1">Synergies</h3>
              <div className="space-y-1.5">
                {TAGS.map((tag) => {
                  const n = preview.syn.counts[tag], lv = preview.syn.level[tag], m = TAG_META[tag];
                  const next = SYNERGIES[tag].find((s) => n < s.n);
                  return (
                    <div key={tag} className={`rounded-md px-2 py-1 border text-xs ${lv >= 0 ? "" : "opacity-70"}`} style={{ borderColor: lv >= 0 ? m.color : "#3a2631", background: lv >= 0 ? `${m.color}1c` : "transparent" }} title={m.blurb}>
                      <div className="flex items-center gap-2">
                        <span>{m.icon}</span><b style={{ color: m.color }}>{m.name}</b>
                        <span className="ml-auto flex gap-1 items-center">
                          {SYNERGIES[tag].map((s) => <span key={s.n} className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold" style={{ background: n >= s.n ? m.color : "#2a1a22", color: n >= s.n ? "#111" : "#887" }}>{s.n}</span>)}
                          <b className="w-4 text-right">{n}</b>
                        </span>
                      </div>
                      <div className="text-[11px] opacity-85 leading-tight mt-0.5">{lv >= 0 ? `✔ ${SYNERGIES[tag][lv].text}` : `${m.blurb}`}{next && lv >= 0 && <span className="opacity-60"> · next @{next.n}</span>}{lv < 0 && next && <span className="opacity-70"> ({next.n}: {next.text})</span>}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-1 min-h-[132px]">
              <PartInfo part={infoPart} row={infoRow} />
            </div>

            <div className={`panel p-2 ${enemy.boss ? "!border-red-500" : ""}`} style={enemy.boss ? { animation: "bossWarn 2s infinite" } : undefined}>
              <div className="flex items-center justify-between">
                <h3 className="font-title text-lg text-amber-200">Next Foe</h3>
                {enemy.boss && <span className="chip !bg-red-900/60 text-red-200">☠ BOSS</span>}
                {isBossRound(run.round + 1) && !enemy.boss && <span className="chip text-red-300">Boss next round</span>}
              </div>
              {foggy ? (
                <div className="text-sm opacity-70 py-4 text-center">🌫️ Fog of War hides the enemy…</div>
              ) : (
                <>
                  <div className="font-semibold">{enemy.name}</div>
                  <div className="text-xs opacity-70 mb-1">{enemy.blurb}</div>
                  {enemy.boss && <div className="text-xs text-red-200 mb-1"><b>{enemy.boss.skill}:</b> {enemy.boss.skillDesc}</div>}
                  <div className="flex justify-around -mx-1">
                    {enemy.team.map((c, i) => <div key={i} className="text-center"><ChimeraCanvas chimera={c} w={96} h={74} scale={0.8} facing={-1} /><div className="text-[10px] opacity-70 -mt-1">{c.name}</div></div>)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {TAGS.filter((t) => enemySyn.counts[t] > 0).map((t) => <span key={t} className="chip" style={{ color: TAG_META[t].color }}>{TAG_META[t].icon} {enemySyn.counts[t]}{enemySyn.level[t] >= 0 && " ✔"}</span>)}
                  </div>
                </>
              )}
            </div>

            <button className="btn btn-primary text-xl py-3 sticky bottom-2 z-10" onClick={(e) => { e.stopPropagation(); onFight(); }}>
              ⚔ FIGHT! <Kbd>Space</Kbd>
              {filled === 0 && <div className="text-[11px] font-normal opacity-80">Your chimeras are naked — buy some parts first!</div>}
            </button>
          </div>
        </div>
      </div>

      {burst && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="absolute w-72 h-72 rounded-full anim-evolve" style={{ background: `radial-gradient(circle, ${TAG_META[PARTS[burst.id].tag].color}cc, transparent 65%)` }} />
          <div className="anim-pop text-center">
            <div className="text-6xl drop-shadow-lg">{PARTS[burst.id].icon}</div>
            <div className="font-title text-3xl text-amber-300 drop-shadow">EVOLVED! {"★".repeat(burst.tier)}</div>
          </div>
        </div>
      )}

      {tut && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(560px,94vw)] panel p-3 anim-pop !border-amber-400" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3">
            <div className="text-3xl">🧙</div>
            <div className="flex-1">
              <div className="font-title text-lg text-amber-200">{tut.title}</div>
              <div className="text-sm">{tut.text}</div>
              <div className="flex gap-2 mt-2 justify-end">
                <button className="btn btn-sm" onClick={() => onTut(-1)}>Skip tutorial</button>
                <button className="btn btn-sm btn-primary" onClick={() => onTut(run.tut === TUT.length - 1 ? -1 : run.tut + 1)}>{tut.action ? "Skip step" : run.tut === TUT.length - 1 ? "Done" : "Next"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
