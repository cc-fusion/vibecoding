import { useEffect, useRef, useState } from "react";
import { TRAIT_INFO } from "../lib/content";
import { G, acceptStatement, askTopic, clueOf, presentEvidence, pressStatement, skey, stmtOf, useStore } from "../lib/store";
import { PILLARS, PILLAR_ICON, PILLAR_TOPIC } from "../lib/types";
import type { Pillar } from "../lib/types";
import { Kw, PillarRow } from "./ui";

function Ecg({ bpm, jitter, spikeAt }: { bpm: number; jitter: number; spikeAt: React.RefObject<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const buf: number[] = new Array(160).fill(0);
    let phase = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      const spiking = now - (spikeAt.current || 0) < 1600;
      const rate = (bpm + (spiking ? 55 : 0)) / 60;
      phase += 0.04 * rate;
      const ph = phase % 1;
      let v = 0;
      if (ph < 0.08) v = Math.sin((ph / 0.08) * Math.PI) * 0.18;
      else if (ph > 0.14 && ph < 0.17) v = -0.2;
      else if (ph >= 0.17 && ph < 0.22) v = Math.sin(((ph - 0.17) / 0.05) * Math.PI) * (spiking ? 1.2 : 0.9);
      else if (ph > 0.3 && ph < 0.42) v = Math.sin(((ph - 0.3) / 0.12) * Math.PI) * 0.25;
      v += (Math.random() - 0.5) * jitter * (spiking ? 3 : 1);
      buf.push(v);
      buf.shift();
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = spiking ? "#f87171" : "#4ade80";
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      buf.forEach((b, i) => {
        const x = (i / (buf.length - 1)) * w;
        const y = h / 2 - b * (h * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }, 40);
    return () => window.clearInterval(id);
  }, [bpm, jitter, spikeAt]);
  return <canvas ref={ref} width={320} height={64} className="w-full h-16 rounded-lg bg-black/60 border border-emerald-500/20" />;
}

export function Interrogation() {
  useStore();
  const run = G.run!;
  const [si, setSi] = useState(0);
  const [active, setActive] = useState<Pillar | null>(null);
  const [picker, setPicker] = useState(false);
  const spikeAt = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const s = run.def.suspects[si];
  const info = TRAIT_INFO[s.trait];
  const clammed = run.patience[si] <= 0;
  const maxP = Math.max(run.patience[si], info.patience + 3);
  const log = run.dialog[si] || [];
  const lowSanity = run.sanity < 35;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length, si]);

  const pick = (p: Pillar) => {
    if (clammed) return;
    setActive(p);
    setPicker(false);
    const k = skey(si, p);
    if (!run.tells[k]) {
      askTopic(si, p);
      const t2 = G.run!.tells[k] as { fired: boolean } | undefined;
      if (t2 && t2.fired) spikeAt.current = Date.now() + 450;
    }
  };

  const st = active ? stmtOf(run, si, active) : null;
  const k = active ? skey(si, active) : "";
  const tell = k ? run.tells[k] : undefined;
  const broken = k ? run.state[k] === "broken" : false;

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#0d0a18]">
      <aside className="md:w-[210px] flex md:flex-col gap-2 overflow-auto p-2 border-b md:border-b-0 md:border-r border-white/10 bg-black/30">
        {run.def.suspects.map((x) => (
          <button key={x.id} onClick={() => { setSi(x.id); setActive(null); setPicker(false); }}
            className={`suspect-tab shrink-0 text-left ${si === x.id ? "on" : ""} ${run.patience[x.id] <= 0 ? "opacity-45" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{x.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{x.name}</div>
                <div className="text-[11px] text-violet-200/60">{run.patience[x.id] <= 0 ? "Refuses to talk" : x.job}</div>
              </div>
            </div>
            <div className="mt-1 hidden md:block"><PillarRow run={run} s={x.id} /></div>
          </button>
        ))}
      </aside>

      <section className="flex-1 min-w-0 flex flex-col overflow-auto p-3 gap-3">
        <div className="flex gap-3 items-start flex-wrap">
          <div className={`portrait ${clammed ? "grayscale" : ""} ${tell?.fired && active ? "twitch" : ""}`}>{s.emoji}</div>
          <div className="flex-1 min-w-[220px]">
            <div className="text-xl font-serif font-semibold">{s.name} <span className="text-sm text-violet-200/60">· {s.job}</span></div>
            <div className="text-xs text-violet-200/80 mt-0.5"><b>{info.label}.</b> {info.tip}</div>
            <div className="flex items-center gap-1 mt-2" title="Patience: wrong evidence and pressing honest statements drain it">
              <span className="text-[11px] text-violet-200/70 mr-1">Patience</span>
              {Array.from({ length: maxP }).map((_, i) => (
                <span key={i} className={`h-2.5 w-5 rounded-full ${i < run.patience[si] ? "bg-amber-400" : "bg-white/10"}`} />
              ))}
            </div>
            <div className="mt-2"><PillarRow run={run} s={si} /></div>
          </div>
          <div className="w-full md:w-[320px]">
            <div className="text-[11px] text-emerald-300/80 mb-1 flex justify-between">
              <span>🫀 Lie detector</span>
              {lowSanity && <span className="text-red-300">Your frayed mind misreads tells!</span>}
            </div>
            <Ecg bpm={s.trait === "nervous" ? 96 : s.trait === "stoic" ? 62 : 74} jitter={lowSanity ? 0.16 : 0.03} spikeAt={spikeAt} />
            <div className="text-xs mt-1 h-5 text-amber-200">
              {active && tell ? (tell.fired ? <span className="tell">TELL: {s.first} {tell.label}</span> : <span className="text-white/50">No visible tell.</span>) : <span className="text-white/40">Choose a topic to read them.</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {PILLARS.map((p) => {
            const state = run.state[skey(si, p)];
            return (
              <button key={p} disabled={clammed} onClick={() => pick(p)}
                className={`btn ${active === p ? "btn-gold" : "btn-ghost"}`}>
                {PILLAR_ICON[p]} {PILLAR_TOPIC[p]} {state === "broken" ? "💥" : state === "accepted" ? "📝" : run.tells[skey(si, p)] ? "💬" : ""}
              </button>
            );
          })}
        </div>

        {active && st && !clammed && (
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-amber-200/70 mb-1">{PILLAR_TOPIC[active]} statement</div>
            <div className="text-lg font-serif italic leading-snug">"{st.text}"</div>
            {broken ? (
              <div className="mt-2 text-emerald-300 text-sm font-semibold">💥 Lie broken. The truth is out.</div>
            ) : (
              <div className="flex gap-2 flex-wrap mt-3">
                <button className="btn btn-ghost" onClick={() => acceptStatement(si, active)}>✓ Accept</button>
                <button className="btn btn-ghost" onClick={() => pressStatement(si, active)} title="Costs 8 Focus">🔍 Press (8⚡)</button>
                <button className="btn btn-gold" onClick={() => setPicker((v) => !v)}>📎 Present Evidence</button>
              </div>
            )}
            {picker && !broken && (
              <div className="mt-3 grid gap-2 grid-cols-1 lg:grid-cols-2 max-h-56 overflow-auto pr-1">
                {run.found.length === 0 && <div className="text-sm text-white/50">You have no clues to present yet.</div>}
                {run.found.map((id) => {
                  const c = clueOf(run, id);
                  return (
                    <button key={id} className="clue-card !min-h-0 text-left" onClick={() => { setPicker(false); presentEvidence(si, active, id); }}>
                      <div className="text-[12px] leading-snug"><Kw text={c.text} k={c.key} /></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {clammed && <div className="rounded-xl border border-red-400/30 bg-red-900/20 p-3 text-red-200 text-sm">{s.first} has had enough and will answer nothing more. Wrong evidence and badgering honest people burn patience.</div>}

        <div ref={logRef} className="flex-1 min-h-[120px] overflow-auto rounded-xl bg-black/30 border border-white/10 p-2 space-y-1.5 text-sm">
          {log.length === 0 && <div className="text-white/40 text-center py-6">Choose a topic above to begin questioning {s.first}.</div>}
          {log.map((l, i) => (
            <div key={i} className={`fade-in ${l.who === "you" ? "text-sky-200" : l.who === "them" ? "text-amber-100" : "text-emerald-300 text-xs"}`}>
              {l.who === "you" && <b>You: </b>}
              {l.who === "them" && <b>{s.first}: </b>}
              {l.text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
