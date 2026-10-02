import { useReducer, useRef, useState } from "react";
import { TRAIT_INFO } from "../lib/content";
import { audio } from "../lib/audio";
import { G, P, clueOf, combine, evidence, toast, uiShake, useStore } from "../lib/store";
import { PILLARS, PILLAR_LABEL } from "../lib/types";
import { Kw, PillarRow } from "./ui";

const CW = 195;
const CH = 112;

export function Board({ onAccuse }: { onAccuse: (s: number) => void }) {
  useStore();
  const run = G.run!;
  const [sel, setSel] = useState<string | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [pop, setPop] = useState("");
  const [bad, setBad] = useState<string[]>([]);
  const [dossier, setDossier] = useState(true);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const assoc = P().assoc;

  const nodes = [...run.found.map((id) => ({ id, ded: false })), ...run.deds.map((id) => ({ id, ded: true }))];
  const pos = (id: string) => run.boardPos[id] || { x: 20, y: 20 };
  let maxY = 600;
  let maxX = 1000;
  nodes.forEach((n) => {
    const p = pos(n.id);
    maxY = Math.max(maxY, p.y + CH + 40);
    maxX = Math.max(maxX, p.x + CW + 40);
  });
  if (run.deds.length) maxX = Math.max(maxX, 1290 + 2 * 215);

  const handleClue = (id: string) => {
    if (!sel) { setSel(id); audio.play("ui"); return; }
    if (sel === id) { setSel(null); return; }
    const res = combine(sel, id);
    const pair = [sel, id];
    setSel(null);
    if (res.kind === "ded") {
      toast(`Deduction: ${res.ded.text}`, res.ded.value ? "bad" : "good");
      setPop(res.ded.id);
      window.setTimeout(() => setPop(""), 1200);
    } else if (res.kind === "known") toast("You already deduced that.", "info");
    else if (res.kind === "tired") toast("Too drained to think. Wait for Focus.", "bad");
    else {
      toast(res.kind === "coincidence" ? "Coincidence: the keyword matches, but nothing follows." : "These clues are unrelated. The strain stings.", res.kind === "coincidence" ? "info" : "bad");
      setBad(pair);
      if (res.kind === "unrelated") uiShake();
      window.setTimeout(() => setBad([]), 500);
    }
  };

  const down = (e: React.PointerEvent, id: string) => {
    const p = pos(id);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (d.moved) {
      run.boardPos[d.id] = { x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy) };
      force();
    }
  };
  const up = (e: React.PointerEvent, isDed: boolean) => {
    const d = drag.current;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (d && !d.moved && !isDed) handleClue(d.id);
  };

  const selClue = sel ? clueOf(run, sel) : null;

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#0b0916]">
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-1.5 text-xs text-violet-200/80 border-b border-white/10 bg-black/30 flex items-center gap-3 flex-wrap">
          <span>🧩 <b>Deduction Board</b>: click a clue, then another sharing a <b className="kw">golden keyword</b>. Drag to arrange. Each link costs 4 Focus.</span>
          {sel && <button className="btn btn-ghost !py-0.5 !text-xs" onClick={() => setSel(null)}>Cancel selection</button>}
          <button className="btn btn-ghost !py-0.5 !text-xs md:hidden ml-auto" onClick={() => setDossier((v) => !v)}>{dossier ? "Hide" : "Show"} dossier</button>
        </div>
        <div className="relative flex-1 overflow-auto board-bg">
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-violet-200/60 p-8">
              <div>
                <div className="text-5xl mb-2">🧷</div>
                No clues pinned yet.<br />Return to the Palace (key 1) and examine glowing objects.
              </div>
            </div>
          )}
          <div className="relative" style={{ width: maxX, height: maxY }}>
            <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
              {run.deds.map((id) => {
                const d = run.def.deductions.find((x) => x.id === id)!;
                const pd = pos(id);
                return [d.a, d.b].map((cid) => {
                  const pc = pos(cid);
                  return (
                    <line key={id + cid} x1={pc.x + CW / 2} y1={pc.y + CH / 2} x2={pd.x + CW / 2} y2={pd.y + CH / 2}
                      stroke={d.value ? "#f87171" : "#34d399"} strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
                  );
                });
              })}
            </svg>
            {nodes.map((n) => {
              const p = pos(n.id);
              if (n.ded) {
                const d = run.def.deductions.find((x) => x.id === n.id)!;
                return (
                  <div key={n.id} onPointerDown={(e) => down(e, n.id)} onPointerMove={move} onPointerUp={(e) => up(e, true)}
                    className={`absolute node ded-card ${d.value ? "ded-true" : "ded-false"} ${pop === n.id ? "pop" : ""}`}
                    style={{ left: p.x, top: p.y, width: CW, minHeight: CH - 20 }}>
                    <div className="text-[10px] uppercase tracking-wider opacity-80">{d.value ? "⚠ Incriminating" : "✔ Exonerating"} · {PILLAR_LABEL[d.pillar]}</div>
                    <div className="text-sm font-semibold leading-snug mt-1">{d.text}</div>
                  </div>
                );
              }
              const c = clueOf(run, n.id);
              const cand = assoc && selClue && selClue.id !== c.id && selClue.key === c.key;
              return (
                <div key={n.id} onPointerDown={(e) => down(e, n.id)} onPointerMove={move} onPointerUp={(e) => up(e, false)}
                  className={`absolute node clue-card ${sel === n.id ? "sel" : ""} ${cand ? "cand" : ""} ${bad.includes(n.id) ? "shake" : ""}`}
                  style={{ left: p.x, top: p.y, width: CW, minHeight: CH }}>
                  <div className="pin" />
                  <div className="text-[13px] leading-snug"><Kw text={c.text} k={c.key} /></div>
                  <div className="text-[10px] text-amber-900/60 mt-1">📍 {run.def.rooms[c.room].name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {dossier && (
        <aside className="md:w-[300px] max-h-[42%] md:max-h-none overflow-auto border-t md:border-t-0 md:border-l border-white/10 bg-black/40 p-2 space-y-2">
          <div className="text-xs text-violet-200/70 px-1">
            <b>Case:</b> {run.def.crime} of <b>{run.def.victim}</b>. Weapon / method: <b>{run.def.weapon}</b>. Prove <b>Means, Motive, Opportunity</b> against one suspect.
          </div>
          {run.def.suspects.map((s) => {
            const cleared = run.wrongAccused.includes(s.id);
            return (
              <div key={s.id} className={`rounded-xl border border-white/10 bg-white/5 p-2 ${cleared ? "opacity-40" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] text-violet-200/60">{s.job} · {TRAIT_INFO[s.trait].label}</div>
                  </div>
                  <div className="text-[11px] text-amber-200">{evidence(run, s.id)}/3</div>
                </div>
                <div className="mt-1.5"><PillarRow run={run} s={s.id} /></div>
                <button disabled={cleared} className="btn btn-danger !py-0.5 !text-xs mt-2 w-full" onClick={() => onAccuse(s.id)}>
                  {cleared ? "⚖️ Cleared at trial" : "Accuse"}
                </button>
              </div>
            );
          })}
          <div className="text-[10px] text-violet-200/50 px-1">
            {PILLARS.length} pillars per suspect. "says yes/no" is testimony only; * means a lie was exposed. Only deductions count as proof.
          </div>
        </aside>
      )}
    </div>
  );
}
