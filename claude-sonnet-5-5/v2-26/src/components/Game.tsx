import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "../game/audio";
import { resolveJob, type JobReport } from "../game/campaign";
import { CLIENTS, CONSUMABLES, CONSUMABLE_IDS, LOOT, MECH_INFO, MODS } from "../game/data";
import { Engine } from "../game/engine";
import type { Campaign, ClientId, Contract, HudState, JobResult, JobSpec, MechType, ModId, Settings } from "../game/types";
import { fmtTime } from "../game/util";

interface Props {
  spec: JobSpec;
  settings: Settings;
  /** job mode */
  campaign?: Campaign;
  contract?: Contract;
  mods?: ModId[];
  onJobDone?: (c: Campaign, r: JobReport) => void;
  /** practice mode */
  practiceType?: MechType;
  onPracticeAgain?: () => void;
  onPracticeComplete?: (t: MechType) => void;
  onLeave: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

const AFFIX_ICON = { trapped: "☠", rusted: "⛓", alarmed: "🚨" } as const;
const AFFIX_TEXT = {
  trapped: "Trapped — mistakes cost double noise",
  rusted: "Rusted — tolerances −20%",
  alarmed: "Alarmed — a guard follows when it opens",
} as const;

export default function Game(props: Props) {
  const { spec, settings, campaign, contract, mods = [], practiceType } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<JobResult | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const practice = spec.mode === "practice";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new Engine(canvas, spec, {
      onHud: setHud,
      onEnd: (r) => setResult(r),
      onPauseRequest: () => setPaused(true),
    });
    engineRef.current = eng;
    return () => {
      eng.destroy();
      engineRef.current = null;
    };
  }, [spec]);

  useEffect(() => {
    engineRef.current?.setPaused(paused || !!result);
  }, [paused, result]);

  // resolve job outcome (pure; deterministic)
  const resolved = useMemo(() => {
    if (!result || practice || !campaign || !contract) return null;
    return resolveJob(campaign, contract, mods, result, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    if (!result) return;
    if (practice) return;
    if (result.outcome === "success") audio.win();
    else if (result.outcome !== "alarm") audio.lose();
    else window.setTimeout(() => audio.lose(), 1800);
  }, [result, practice]);

  const practiceDone = practice && !!hud?.practiceDone;
  useEffect(() => {
    if (practiceDone && practiceType) props.onPracticeComplete?.(practiceType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceDone]);

  const resume = useCallback(() => {
    audio.ui();
    setConfirmAbandon(false);
    setPaused(false);
  }, []);

  const noisePct = hud ? Math.min(100, hud.noise) : 0;
  const timePct = hud && hud.timeLimit > 0 ? (hud.time / hud.timeLimit) * 100 : 0;
  const lowTime = !practice && hud ? hud.time < 20 : false;
  const clientColor = spec.theme === "odd" ? "#b0a898" : spec.theme === "boss" ? "#ff5a3a" : CLIENTS[spec.theme as ClientId]?.color ?? "#d6a84c";

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a090e] text-[#e9e2d0]">
      {/* ---------- top HUD ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#d6a84c]/20 bg-black/40 px-3 py-2">
        <div className="min-w-0 flex-1 basis-48">
          <div className="font-display truncate text-sm font-bold sm:text-base" style={{ color: clientColor }}>
            {practice ? `Academy · ${practiceType ? MECH_INFO[practiceType].name : ""}` : spec.title}
          </div>
          <div className="truncate text-[11px] text-[#9d9484]">{hud?.mechName}</div>
        </div>

        {/* stage track */}
        <div className="flex items-center gap-1.5">
          {(hud?.stages ?? spec.stages).map((s, i) => {
            const done = hud ? i < hud.stageIdx || (practice && hud.practiceDone) : false;
            const cur = hud ? i === hud.stageIdx && !done : i === 0;
            return (
              <div
                key={i}
                title={`${MECH_INFO[s.type].name}${s.affix ? " — " + AFFIX_TEXT[s.affix] : ""}`}
                className={`relative flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-all ${
                  done ? "border-emerald-400/70 bg-emerald-900/40" : cur ? "scale-110 border-[#f3d88d] bg-[#3a2d1a]" : "border-white/15 bg-white/5 opacity-70"
                }`}
              >
                {done ? "✓" : MECH_INFO[s.type].icon}
                {s.affix && <span className="absolute -right-1 -top-1.5 text-[10px]">{AFFIX_ICON[s.affix]}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {!practice && (
            <div className={`font-display text-lg font-bold tabular-nums ${lowTime ? "text-red-400" : "text-[#f3d88d]"}`} style={lowTime ? { animation: "pulseRed 0.7s infinite" } : undefined}>
              ⏳ {hud ? fmtTime(hud.time) : "0:00"}
            </div>
          )}
          <button className="btn btn-sm" onClick={() => { audio.ui(); setPaused(true); }} aria-label="Pause">
            ❚❚ Pause
          </button>
        </div>
      </div>

      {/* noise / pick / patrol row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-white/5 bg-black/25 px-3 py-1.5 text-xs">
        <div className="flex min-w-[170px] flex-1 items-center gap-2">
          <span className="font-display font-bold text-[#9d9484]">NOISE</span>
          <div className={`relative h-3.5 flex-1 overflow-hidden rounded-full border border-white/15 bg-black/60 ${noisePct > 75 ? "anim-alarm" : ""}`}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,#3ddc84,#ffd05a 60%,#ff4a3a)", clipPath: `inset(0 ${100 - noisePct}% 0 0)` }} />
            <div className="absolute inset-y-0 left-[75%] w-px bg-white/30" />
          </div>
          <span className="w-8 tabular-nums">{Math.round(noisePct)}%</span>
          {hud?.oilActive && <span title="Oiled: noise gain −40%">🫗</span>}
        </div>
        {!practice && (
          <div className="flex items-center gap-2" title="Current pick durability and spare picks">
            <span className="font-display font-bold text-[#9d9484]">PICK</span>
            <div className="flex gap-0.5">
              {Array.from({ length: Math.ceil(hud?.durMax ?? spec.pickDur) }).map((_, i) => (
                <div key={i} className="h-3 w-2.5 rounded-sm" style={{ background: hud && i < Math.ceil(hud.durability - 0.001) ? "#cfd6e4" : "#2a2630" }} />
              ))}
            </div>
            <span className="tabular-nums text-[#cfd6e4]">×{hud?.picksLeft ?? spec.picks}</span>
          </div>
        )}
        {!practice && (
          <div className="flex items-center gap-2">
            {!spec.patrolEnabled ? (
              <span className="text-[#9d9484]">🤫 No patrols</span>
            ) : hud?.patrol === "warn" ? (
              <span className="font-bold text-amber-300" style={{ animation: "floaty 0.6s infinite" }}>👁 GUARD APPROACHING {hud.patrolT.toFixed(1)}s</span>
            ) : hud?.patrol === "pass" ? (
              <span className={`font-bold ${hud.hidden ? "text-emerald-300" : "text-red-400"}`}>{hud.hidden ? "🫥 Hidden — guard passing" : "🚨 GUARD PASSING — HIDE!"}</span>
            ) : (
              <span className="text-[#9d9484]">💂 Patrol in ~{Math.max(1, Math.ceil(hud?.nextPatrol ?? 0))}s</span>
            )}
          </div>
        )}
        {!practice && (
          <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:block" title="Time until dawn">
            <div className="h-full" style={{ width: `${timePct}%`, background: lowTime ? "#ff5a4a" : "#d6a84c" }} />
          </div>
        )}
      </div>

      {/* ---------- canvas ---------- */}
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />
        {practice && practiceType && (
          <div className="pointer-events-none absolute left-2 top-2 max-w-[260px] rounded-lg border border-[#d6a84c]/30 bg-black/65 p-3 text-xs leading-relaxed sm:max-w-xs">
            <div className="font-display mb-1 text-sm font-bold text-[#f3d88d]">Lesson: {MECH_INFO[practiceType].name}</div>
            <ol className="list-decimal space-y-1 pl-4 text-[#d8d0bc]">
              {MECH_INFO[practiceType].lesson.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        )}
        {/* mobile / mouse hide button */}
        {!practice && spec.patrolEnabled && (
          <button
            className={`absolute bottom-3 right-3 select-none rounded-xl border-2 px-4 py-3 font-display text-sm font-bold shadow-lg transition-colors ${
              hud?.patrol === "warn" || hud?.patrol === "pass" ? "animate-pulse border-amber-300 bg-amber-900/80 text-amber-100" : "border-white/25 bg-black/60 text-white/80"
            } ${hud?.hidden ? "!border-emerald-300 !bg-emerald-900/80" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); engineRef.current?.setHideUi(true); }}
            onPointerUp={() => engineRef.current?.setHideUi(false)}
            onPointerLeave={() => engineRef.current?.setHideUi(false)}
            onPointerCancel={() => engineRef.current?.setHideUi(false)}
          >
            🫥 HOLD TO HIDE <span className="ml-1 text-[10px] opacity-70">[Shift]</span>
          </button>
        )}
      </div>

      {/* ---------- bottom bar ---------- */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#d6a84c]/20 bg-black/50 px-3 py-1.5">
        <div className="min-w-0 flex-1 basis-60 text-[11px] leading-snug text-[#cbbf9f] sm:text-xs">{hud?.help}</div>
        {!practice && (
          <div className="flex gap-1.5">
            {CONSUMABLE_IDS.map((id) => {
              const n = hud?.items[id] ?? spec.items[id];
              return (
                <button
                  key={id}
                  disabled={n <= 0 || paused || !!result}
                  title={`${CONSUMABLES[id].name} [${CONSUMABLES[id].key}] — ${CONSUMABLES[id].desc}`}
                  onClick={() => engineRef.current?.useItem(id)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#d6a84c]/40 bg-[#20180d] text-lg transition hover:brightness-125 disabled:opacity-30"
                >
                  {CONSUMABLES[id].icon}
                  <span className="absolute -right-1 -top-1 rounded bg-black px-1 text-[10px] font-bold text-[#f3d88d]">{n}</span>
                  <span className="absolute -bottom-1 left-0.5 rounded bg-[#d6a84c] px-1 text-[9px] font-bold text-black">{CONSUMABLES[id].key}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- pause ---------- */}
      {paused && !result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="panel anim-pop w-full max-w-sm p-6 text-center">
            <h2 className="font-display title-shimmer mb-1 text-3xl font-black">PAUSED</h2>
            <p className="mb-4 text-xs text-[#9d9484]">The night waits. The clock does not tick while paused.</p>
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary" onClick={resume}>Resume</button>
              <button className="btn" onClick={() => { audio.ui(); props.onOpenSettings(); }}>Settings</button>
              <button className="btn" onClick={() => { audio.ui(); props.onOpenHelp(); }}>Controls &amp; Help</button>
              {!confirmAbandon ? (
                <button className="btn btn-danger" onClick={() => { audio.back(); setConfirmAbandon(true); }}>
                  {practice ? "Leave Lesson" : "Abandon Job"}
                </button>
              ) : (
                <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-3">
                  <p className="mb-2 text-xs text-red-200">
                    {practice ? "Leave this lesson?" : "Abandoning costs reputation with the client and adds Heat. Sure?"}
                  </p>
                  <div className="flex gap-2">
                    <button className="btn btn-danger btn-sm flex-1" onClick={() => {
                      if (practice) props.onLeave();
                      else { setPaused(false); engineRef.current?.abandon(); }
                    }}>Yes, leave</button>
                    <button className="btn btn-sm flex-1" onClick={() => setConfirmAbandon(false)}>Stay</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- practice done ---------- */}
      {practiceDone && practiceType && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/30 p-6 sm:items-center">
          <div className="panel anim-pop w-full max-w-sm p-5 text-center">
            <div className="mb-1 text-3xl">🔓</div>
            <h3 className="font-display text-2xl font-black text-[#9dffba]">Lesson Complete</h3>
            <p className="mb-4 text-sm text-[#cbbf9f]">You cracked the {MECH_INFO[practiceType].name}. Try another or head back.</p>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={() => props.onPracticeAgain?.()}>New Lock</button>
              <button className="btn btn-primary flex-1" onClick={props.onLeave}>Academy</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- job report ---------- */}
      {resolved && result && <Report report={resolved.report} campaign={resolved.campaign} onDone={() => props.onJobDone?.(resolved.campaign, resolved.report)} />}
    </div>
  );
}

function Report({ report, onDone }: { report: JobReport; campaign: Campaign; onDone: () => void }) {
  const r = report.result;
  const title =
    report.victory ? "THE SOVEREIGN'S VAULT IS YOURS"
    : report.success ? "VAULT CRACKED"
    : r.outcome === "alarm" ? "ALARM RAISED"
    : r.outcome === "timeout" ? "DAWN BROKE"
    : r.outcome === "nopicks" ? "OUT OF PICKS"
    : "JOB ABANDONED";
  const sub =
    report.success ? `“${report.title}” — clean getaway.`
    : r.outcome === "alarm" ? "The watch swarmed the building. You escaped, barely."
    : r.outcome === "timeout" ? "The sun rose before the last tumbler fell."
    : r.outcome === "nopicks" ? "Every pick snapped. You slunk away empty-handed."
    : "You walked away from the job.";
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
      <div className="panel anim-pop my-auto w-full max-w-lg p-5">
        <div className="text-center">
          <h2 className={`font-display text-2xl font-black sm:text-3xl ${report.success ? "title-shimmer" : "text-red-400"}`}>{title}</h2>
          <p className="mt-1 text-sm text-[#bfb496]">{sub}</p>
          {report.success && (
            <div className="my-2 text-3xl tracking-widest">
              {[1, 2, 3].map((s) => (
                <span key={s} className="inline-block" style={{ color: s <= report.stars ? "#ffd05a" : "#3a3440", animation: s <= report.stars ? `popIn 0.4s ${s * 0.18}s both` : undefined }}>★</span>
              ))}
            </div>
          )}
          {report.newRank && <div className="my-2 rounded-lg border border-[#d6a84c] bg-[#d6a84c]/15 py-1 font-display text-sm font-bold text-[#ffe08a]">⚜ RANK UP — {report.newRank}!</div>}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-black/30 p-3 text-sm">
          {report.success ? (
            <>
              <Row k="Payout" v={`+${report.pay - report.starBonus}g`} />
              <Row k={`Star bonus`} v={`${sign(report.starBonus)}g`} />
              <Row k="Renown" v={`+${report.renownGain}`} />
            </>
          ) : (
            <>
              <Row k="Fine paid" v={`−${report.fine}g`} bad />
            </>
          )}
          <Row k="Daily rent" v={`−${report.rent}g`} bad />
          <Row k="Heat" v={sign(report.heatDelta)} bad={report.heatDelta > 0} />
          <Row k="Locks opened" v={`${r.stagesDone}/${r.stageTotal}`} />
          <Row k="Faults" v={String(r.faults)} />
          <Row k="Peak noise" v={`${r.peakNoise}%`} />
          <Row k="Picks broken" v={String(r.picksBroken)} />
          <Row k="Guards dodged" v={`${r.patrolsDodged} (caught ${r.patrolsCaught})`} />
          <Row k="Time used" v={fmtTime(r.timeUsed)} />
        </div>
        {report.repChanges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {report.repChanges.map((c) => (
              <span key={c.client} className="rounded-full border px-2 py-0.5" style={{ borderColor: CLIENTS[c.client].color + "88", color: CLIENTS[c.client].color }}>
                {CLIENTS[c.client].icon} {CLIENTS[c.client].name} {sign(c.delta)}
              </span>
            ))}
          </div>
        )}
        {report.loot.length > 0 && (
          <div className="mt-2 text-xs text-[#d8d0bc]">
            <span className="font-display font-bold text-[#f3d88d]">Loot: </span>
            {report.loot.map((l) => `${LOOT[l.kind].icon} ${l.name}`).join(" · ")}
          </div>
        )}
        {report.gameOver && <div className="mt-2 rounded-lg bg-red-950/60 p-2 text-center text-sm font-bold text-red-300">{report.gameOver === "arrested" ? "The Heat is overwhelming — the watch is at your door…" : "Your debts are beyond repair…"}</div>}
        <button className="btn btn-primary mt-4 w-full" onClick={() => { audio.ui(); onDone(); }}>
          {report.victory ? "Claim Your Legacy" : report.gameOver ? "Face the Consequences" : "Return to the Workshop"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <>
      <div className="text-[#9d9484]">{k}</div>
      <div className={`text-right font-semibold tabular-nums ${bad ? "text-red-300" : "text-[#f3d88d]"}`}>{v}</div>
    </>
  );
}

export { MODS };
