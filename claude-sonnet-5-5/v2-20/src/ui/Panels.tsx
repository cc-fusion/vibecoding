import { useEffect, useState } from "react";
import type { Game } from "../game";
import { ROOMS, NPCS, ITEMS, npcDef, fmtTime, type Fact } from "../data";
import { audio } from "../audio";
import { Keypad, Hack, Breaker, Safe } from "./Minigames";

const card = "rounded-2xl border border-cyan-400/40 bg-[#08101d]/95 shadow-[0_0_40px_rgba(92,200,255,0.18)]";
const catStyle: Record<string, string> = {
  means: "border-rose-400/60 text-rose-300", motive: "border-amber-400/60 text-amber-300",
  opportunity: "border-sky-400/60 text-sky-300", secret: "border-fuchsia-400/60 text-fuchsia-300",
};

function useDigits(n: number, cb: (i: number) => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const i = parseInt(e.key, 10);
      if (!isNaN(i) && i >= 1 && i <= n) cb(i - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
}

export function Trust({ n }: { n: number }) {
  return <span className="tracking-widest text-emerald-300">{Array.from({ length: 4 }).map((_, i) => (i < n ? "●" : "○")).join("")}</span>;
}

export function Journal({ g, onClose }: { g: Game; onClose: () => void }) {
  const [tab, setTab] = useState<"ev" | "notes" | "time" | "cast">("ev");
  const [hint, setHint] = useState("");
  const cd = g.cd;
  const facts = [...g.known].map((id) => cd.facts[id]).filter(Boolean) as Fact[];
  const notes = facts.filter((f) => f.kind === "note");
  const nb = Math.ceil(cd.crime / 5);
  const cur = Math.floor(g.t / 5);
  const zoneInfo = (z: string) => (z === "hall" ? { short: "HL", color: "#5cc8ff", name: "Hallway" } : ROOMS.find((r) => r.id === z)!);
  const tabs: [typeof tab, string][] = [["ev", "Evidence"], ["notes", `Notes (${notes.length})`], ["time", "Timeline"], ["cast", "Cast"]];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-6">
      <div className={`${card} flex max-h-full w-full max-w-4xl flex-col overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold tracking-widest text-cyan-300">📓 CASE JOURNAL — {cd.title.toUpperCase()}</h2>
            <p className="text-xs text-slate-400">Knowledge persists across loops. Loop {g.loopNo} · {g.loopsLeft}/{g.pool} loops remain</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700">Close (J)</button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-cyan-400/10 px-3 pt-2">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); audio.sfx("click"); }} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === k ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === "ev" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
                ☠ <b>{npcDef(cd.victim).name}</b> dies at <b>{fmtTime(cd.crime)}</b> in the {ROOMS.find((r) => r.id === cd.crimeRoom)!.name}. Prove who did it — then confront them.
              </div>
              <div className="text-sm text-slate-300">Evidence collected: <b className="text-amber-300">{g.evidenceKnown().length}/{cd.evidence.length}</b></div>
              {cd.evidence.map((id, i) => {
                const f = cd.facts[id];
                return g.known.has(id) ? (
                  <div key={id} className={`rounded-xl border-l-4 bg-slate-900/70 p-3 ${catStyle[f.cat || "secret"]}`}>
                    <div className="flex items-center justify-between"><b className="text-base text-white">{f.title}</b><span className="text-xs uppercase tracking-widest">{f.cat}</span></div>
                    <p className="mt-1 text-sm text-slate-300">{f.text}</p>
                  </div>
                ) : (
                  <div key={id} className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-500">Undiscovered evidence #{i + 1} — ???</div>
                );
              })}
              <div className="rounded-lg border border-cyan-400/20 p-3">
                <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Inventory</div>
                <div className="flex flex-wrap gap-2">
                  {g.items.length === 0 && <span className="text-sm text-slate-500">Empty</span>}
                  {g.items.map((it) => (
                    <button key={it} onClick={() => g.pin(it)} title={g.save.ups.pocket ? "Pin to Chrono-Pocket" : "Buy the Chrono-Pocket upgrade to keep items across loops"}
                      className={`rounded-lg border px-3 py-1 text-sm ${g.pocket === it ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200" : "border-slate-600 bg-slate-800 text-slate-200"}`}>
                      {ITEMS[it]?.icon} {ITEMS[it]?.name}{g.pocket === it ? " 🧿 pinned" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button onClick={() => setHint(g.hint())} className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20">💡 Request a hint (−5 Insight)</button>
                {hint && <p className="mt-2 rounded-lg bg-amber-400/5 p-3 text-sm text-amber-100">{hint}</p>}
              </div>
            </div>
          )}
          {tab === "notes" && (
            <div className="space-y-2">
              {notes.length === 0 && <p className="text-slate-500">No notes yet. Explore, eavesdrop, and talk to the crew.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-cyan-400/20 bg-slate-900/60 p-3">
                  <b className="text-cyan-200">{n.title}</b>
                  <p className="text-sm text-slate-300">{n.text}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "time" && (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs text-slate-400">Cells fill in when you personally watch someone during a 5-minute window. Use them to predict where everyone will be.</p>
              <div className="grid min-w-[640px] gap-[2px] text-[10px]" style={{ gridTemplateColumns: `100px repeat(${nb}, minmax(20px,1fr))` }}>
                <div />
                {Array.from({ length: nb }).map((_, b) => (
                  <div key={b} className={`text-center ${b === cur ? "font-bold text-cyan-300" : "text-slate-500"}`}>{b % 2 === 0 ? fmtTime(b * 5).replace(/^(\d+):/, "$1:") : ""}</div>
                ))}
                {NPCS.map((n) => (
                  <div key={n.id} className="contents">
                    <div className="truncate py-1 pr-1 text-xs font-semibold" style={{ color: n.color }}>{n.name.split(" ").slice(-1)[0]}</div>
                    {Array.from({ length: nb }).map((_, b) => {
                      const z = g.sight[n.id]?.[b];
                      const zi = z ? zoneInfo(z) : null;
                      const isCrime = b === Math.floor((cd.crime - 0.01) / 5);
                      return (
                        <div key={b} title={zi ? `${fmtTime(b * 5)}–${fmtTime(b * 5 + 5)} ${zi.name}` : "unknown"}
                          className={`rounded-sm py-1 text-center font-bold ${isCrime ? "ring-1 ring-red-500/60" : ""} ${b === cur ? "outline outline-1 outline-cyan-300" : ""}`}
                          style={zi ? { background: zi.color + "33", color: zi.color } : { background: "#0f172a", color: "#334155" }}>{zi ? zi.short : "·"}</div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                {[...ROOMS.map((r) => ({ s: r.short, n: r.name, c: r.color })), { s: "HL", n: "Hallway", c: "#5cc8ff" }].map((r) => (
                  <span key={r.s}><b style={{ color: r.c }}>{r.s}</b> {r.n}</span>
                ))}
              </div>
            </div>
          )}
          {tab === "cast" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {NPCS.map((n) => {
                const s = g.sight[n.id] || {};
                const keys = Object.keys(s).map(Number);
                const last = keys.length ? Math.max(...keys) : -1;
                return (
                  <div key={n.id} className="rounded-xl border bg-slate-900/60 p-3" style={{ borderColor: n.color + "66" }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-slate-900" style={{ background: n.color }}>{n.init}</div>
                      <div>
                        <div className="font-bold text-white">{n.name} {n.id === cd.victim && <span title="victim">☠</span>}</div>
                        <div className="text-xs text-slate-400">{n.role}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{n.bio}</p>
                    <div className="mt-2 flex justify-between text-xs"><span>Trust now: <Trust n={g.npc(n.id).trust} /></span><span className="text-slate-400">{last >= 0 ? `Last seen ${fmtTime(last * 5)} · ${zoneInfo(s[last]).name}` : "Not yet observed"}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ObjMenu({ g, onClose }: { g: Game; onClose: () => void }) {
  const m = g.modal;
  const obj = m && m.k === "menu" ? m.obj : null;
  const opts = obj ? obj.opts : [];
  const choose = (i: number) => { if (obj && opts[i]) g.runOpt(obj, opts[i]); };
  useDigits(opts.length, choose);
  if (!obj) return null;
  const watched = g.watchers(obj.room).length > 0 || g.camOn(obj.room);
  return (
    <div className={`${card} w-full max-w-md p-5`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="text-4xl">{obj.icon}</div>
        <div>
          <h3 className="text-lg font-bold text-cyan-200">{obj.name}</h3>
          <p className="text-xs text-slate-400">{watched ? <span className="text-red-300">👁 You are being watched here</span> : <span className="text-emerald-300">Nobody is watching</span>}</p>
        </div>
      </div>
      <div className="space-y-2">
        {opts.map((o, i) => {
          const why = o.lock ? o.lock(g) : null;
          return (
            <button key={i} onClick={() => choose(i)} className={`w-full rounded-xl border px-4 py-3 text-left transition ${why ? "border-slate-700 bg-slate-900/50 text-slate-500" : "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}>
              <div className="flex justify-between"><span><b className="mr-2 text-cyan-400">{i + 1}</b>{o.label}</span><span className="text-xs text-slate-400">{o.cost ? `⏱ ${o.cost}m` : ""} {o.illicit ? <span className={watched ? "text-red-300" : "text-amber-300"}>⚠ risky</span> : ""}</span></div>
              {why && <div className="mt-1 text-xs text-amber-400/80">🔒 {why}</div>}
            </button>
          );
        })}
      </div>
      <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-slate-400 hover:text-white">Leave (Esc)</button>
    </div>
  );
}

function Talk({ g, onClose }: { g: Game; onClose: () => void }) {
  const m = g.modal;
  const id = m && m.k === "talk" ? m.npc : "";
  const opts = id ? g.talkOptions(id) : [];
  useDigits(opts.length, (i) => { if (!opts[i].reason) g.pickTopic(id, opts[i].key); });
  if (!m || m.k !== "talk") return null;
  const d = npcDef(id);
  const n = g.npc(id);
  const have = g.evidenceKnown().length;
  return (
    <div className={`${card} flex max-h-[92vh] w-full max-w-xl flex-col p-5`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-slate-900" style={{ background: d.color }}>{d.init}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold" style={{ color: d.color }}>{d.name}</h3>
          <p className="text-xs text-slate-400">{d.role} · Trust <Trust n={n.trust} /></p>
        </div>
      </div>
      <div className="mb-3 min-h-[60px] flex-1 space-y-2 overflow-auto rounded-lg bg-black/40 p-3 text-sm">
        {m.log.length === 0 && <p className="italic text-slate-500">{d.name.split(" ")[0]} looks up as you approach.</p>}
        {m.log.map((l, i) => (
          <p key={i} className={l.who === "You" ? "text-cyan-200" : "text-slate-100"}><b style={l.who === "You" ? undefined : { color: d.color }}>{l.who === "You" ? "You" : l.who.split(" ").slice(-1)[0]}:</b> {l.text}</p>
        ))}
      </div>
      <div className="space-y-2 overflow-auto">
        {opts.map((o, i) => (
          <button key={o.key} disabled={!!o.reason} onClick={() => g.pickTopic(id, o.key)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${o.reason ? "border-slate-700 text-slate-500" : "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"}`}>
            <b className="mr-2 text-cyan-400">{i + 1}</b>{o.label}{o.reason && <span className="ml-2 text-xs text-amber-400/80">🔒 {o.reason}</span>}
          </button>
        ))}
        {m.confirm ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
            <p className="text-red-200">Confront <b>{d.name}</b> as the killer? You hold {have}/{g.cd.evidence.length} pieces of evidence. A wrong accusation gets you detained.</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => g.accuse(id)} className="flex-1 rounded-lg bg-red-600 py-2 font-bold text-white hover:bg-red-500">Confront!</button>
              <button onClick={() => g.confirmAccuse(false)} className="flex-1 rounded-lg border border-slate-600 py-2 text-slate-300">Not yet</button>
            </div>
          </div>
        ) : (
          <button onClick={() => (have > 0 ? g.confirmAccuse(true) : g.msg("You have no evidence yet. Gather proof first.", "#ff9f43"))} className="w-full rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-left text-sm font-semibold text-red-200 hover:bg-red-500/20">⚖ Confront as the killer…</button>
        )}
      </div>
      <button onClick={onClose} className="mt-3 w-full py-1 text-sm text-slate-400 hover:text-white">End conversation (Esc)</button>
    </div>
  );
}

function Interrogation({ g }: { g: Game }) {
  const q = g.interro;
  const ev = g.evidenceKnown();
  useDigits(ev.length, (i) => g.present(ev[i]));
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "x") g.present("slide"); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 90); return () => clearInterval(i); }, []);
  if (!q) return null;
  const cd = g.cd;
  const k = npcDef(cd.killer);
  const st = cd.statements[Math.min(q.i, cd.statements.length - 1)];
  const tell = g.save.ups.lie && !q.done && !st.truth && tick % 8 < 3;
  return (
    <div className={`${card} flex max-h-[96vh] w-full max-w-3xl flex-col overflow-auto p-5 ${q.shake > 0 ? "animate-pulse" : ""}`} style={{ boxShadow: `0 0 60px ${k.color}44` }}>
      <div className="mb-3 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-slate-900" style={{ background: k.color, boxShadow: `0 0 ${10 + (100 - q.resolve) / 5}px ${k.color}` }}>{k.init}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold tracking-wider" style={{ color: k.color }}>INTERROGATION — {k.name}</h3>
          <div className="mt-1 text-xs text-slate-400">Resolve</div>
          <div className="h-2 overflow-hidden rounded bg-slate-800"><div className="h-full transition-all duration-500" style={{ width: `${q.resolve}%`, background: k.color }} /></div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Composure</div>
          <div className="text-xl">{Array.from({ length: q.maxHp }).map((_, i) => <span key={i}>{i < q.hp ? "💙" : "🖤"}</span>)}</div>
        </div>
      </div>
      {cd.bossTimer ? <div className="mb-2 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-red-500" style={{ width: `${(q.timer / cd.bossTimer) * 100}%` }} /></div> : null}
      <div className={`mb-3 rounded-xl border p-4 ${tell ? "border-red-400 bg-red-500/10" : "border-slate-600 bg-black/40"} ${q.ok === false ? "ring-2 ring-red-500/50" : ""}`}>
        <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">{q.done ? "Final words" : `Statement ${q.i + 1}/${cd.statements.length}`}{g.save.ups.lie && !q.done ? (tell ? " · 🫀 stress spike!" : "") : ""}</div>
        <p className="text-lg italic text-white">“{q.done ? q.line : st.text}”</p>
        {!q.done && q.ok !== null && <p className={`mt-2 text-sm ${q.ok ? "text-emerald-300" : "text-red-300"}`}>{q.ok ? `✔ ${k.name.split(" ")[0]}: ${q.line}` : `✖ ${q.line}`}</p>}
      </div>
      {q.done ? (
        <button onClick={() => g.finishInterro()} className={`rounded-xl py-3 text-lg font-bold tracking-widest ${q.done === "win" ? "bg-emerald-500 text-slate-900" : "bg-red-600 text-white"}`}>
          {q.done === "win" ? "THE KILLER BREAKS — CONTINUE" : "THEY ESCAPE YOUR GRASP — REWIND"}
        </button>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-400">Present the evidence that contradicts the statement — or let it slide if it's true. [1-{Math.max(1, ev.length)}] present · [X] let it slide</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ev.map((id, i) => {
              const f = cd.facts[id];
              return (
                <button key={id} onClick={() => g.present(id)} className={`rounded-lg border-l-4 bg-slate-900/70 p-2 text-left hover:bg-slate-800 ${catStyle[f.cat || "secret"]}`}>
                  <b className="text-sm text-white"><span className="mr-1 text-cyan-400">{i + 1}</span>{f.title}</b>
                  <div className="text-[10px] uppercase tracking-widest">{f.cat}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{f.text}</p>
                </button>
              );
            })}
            {ev.length === 0 && <p className="text-sm text-red-300">You have no evidence!</p>}
          </div>
          <button onClick={() => g.present("slide")} className="mt-3 rounded-lg border border-slate-500 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">🤐 Let it slide (X)</button>
        </>
      )}
    </div>
  );
}

export function ModalHost({ g }: { g: Game }) {
  const m = g.modal;
  if (!m) return null;
  const close = () => g.closeModal();
  const notes = (re: RegExp) => [...g.known].map((id) => g.cd.facts[id]).filter((f) => f && f.kind === "note" && re.test(f.text)).map((f) => f.text);
  let body = null;
  if (m.k === "menu") body = <ObjMenu g={g} onClose={close} />;
  else if (m.k === "talk") body = <Talk g={g} onClose={close} />;
  else if (m.k === "interro") body = <Interrogation g={g} />;
  else {
    const common = { onWin: () => g.miniDone(true), onFail: (s: number) => g.miniFail(s), onCancel: close };
    if (m.kind === "keypad") body = <Keypad key={m.id} code={String(m.p.code)} notes={notes(/\d{4}/)} {...common} />;
    else if (m.kind === "hack") body = <Hack key={m.id} len={Number(m.p.len)} {...common} />;
    else if (m.kind === "breaker") body = <Breaker key={m.id} order={m.p.order as string[]} notes={notes(/→/)} {...common} />;
    else body = <Safe key={m.id} hits={Number(m.p.hits)} {...common} />;
  }
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]">{body}</div>;
}
