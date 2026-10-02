import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, Settings } from "../game/save";
import { BattleEngine, W, H, computeSynergy, type BattleResult } from "../game/battle";
import { buildConfig, type RunState, type RoundSummary } from "../game/run";
import { TAGS, TAG_META, FINAL_ROUND } from "../game/data";
import { audio } from "../game/audio";
import { Kbd } from "./ui";

const SPEEDS = [1, 2, 4, 8]; // 8 acts as "skip"

export default function Battle({ run, meta, settings, paused, onPause, onFinished, onContinue }: {
  run: RunState; meta: Meta; settings: Settings; paused: boolean; onPause: () => void;
  onFinished: (r: BattleResult) => RoundSummary; onContinue: (s: RoundSummary) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState<{ res: BattleResult; sum: RoundSummary } | null>(null);
  const speedRef = useRef(1);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const cb = useRef({ onFinished, settings });
  cb.current = { onFinished, settings };
  const cfg = useMemo(() => buildConfig(run, meta, settings), []); // eslint-disable-line react-hooks/exhaustive-deps
  const synP = useMemo(() => computeSynergy(cfg.player), [cfg]);
  const synE = useMemo(() => computeSynergy(cfg.enemy), [cfg]);

  const setSp = (i: number) => { speedRef.current = SPEEDS[i]; setSpeed(SPEEDS[i]); audio.sfx("click"); };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const engine = new BattleEngine({ ...cfg, settings: cb.current.settings });
    let raf = 0, last = performance.now(), reported = false, intens = 0, cw = 1, ch = 1, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = Math.max(1, wrap.clientWidth); ch = Math.max(1, wrap.clientHeight);
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap); resize();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pausedRef.current) engine.update(dt * speedRef.current);
      const sc = Math.min(cw / W, ch / H);
      const ox = (cw - W * sc) / 2, oy = (ch - H * sc) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0b0709"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath(); ctx.rect(ox * dpr, oy * dpr, W * sc * dpr, H * sc * dpr); ctx.clip();
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox * dpr, oy * dpr);
      engine.draw(ctx);
      ctx.restore();
      intens += dt;
      if (intens > 0.25) {
        intens = 0;
        audio.setIntensity(0.2 + (1 - engine.hpFrac("e")) * 0.45 + (1 - engine.hpFrac("p")) * 0.35 + (engine.time > 40 ? 0.3 : 0));
      }
      if (engine.done && engine.result && !reported) {
        reported = true;
        const res = engine.result;
        setDone({ res, sum: cb.current.onFinished(res) });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); audio.setIntensity(0); };
  }, [cfg]);

  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (document.querySelector("[data-modal]")) return;
      if (doneRef.current) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onContinue(doneRef.current.sum); } return; }
      if (e.key >= "1" && e.key <= "4") setSp(parseInt(e.key) - 1);
      else if (e.key === " ") { e.preventDefault(); setSp((SPEEDS.indexOf(speedRef.current) + 1) % SPEEDS.length); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onContinue]);

  const chips = (syn: ReturnType<typeof computeSynergy>) =>
    TAGS.filter((t) => syn.counts[t] > 0).map((t) => (
      <span key={t} className="chip" style={{ color: TAG_META[t].color, borderColor: syn.level[t] >= 0 ? TAG_META[t].color : undefined }}>
        {TAG_META[t].icon} {syn.counts[t]}{syn.level[t] >= 0 ? " ✔" : ""}
      </span>
    ));

  const mvp = done ? [...done.res.units.filter((u) => u.side === "p")].sort((a, b) => b.dmg - a.dmg)[0] : null;

  return (
    <div className="relative h-full w-full bg-black crt overflow-hidden">
      <div ref={wrapRef} className="absolute inset-0"><canvas ref={canvasRef} className="w-full h-full block" /></div>

      <div className="absolute top-2 left-2 right-2 flex items-start gap-2 pointer-events-none">
        <div className="panel px-3 py-1.5 pointer-events-auto">
          <div className="font-title text-lg leading-none text-amber-200">Round {run.round}{run.round <= FINAL_ROUND ? ` / ${FINAL_ROUND}` : " ∞"}</div>
          <div className="text-[11px] opacity-75">vs {cfg.boss ? `👑 ${cfg.boss.name}` : "enemy chimeras"}</div>
        </div>
        <div className="ml-auto flex gap-1 pointer-events-auto panel p-1 items-center">
          {SPEEDS.map((s, i) => <button key={s} className={`btn btn-sm !px-2 ${speed === s ? "btn-primary" : ""}`} onClick={() => setSp(i)} title={`Speed ×${s} (${i + 1})`}>{s === 8 ? "⏭" : `${s}×`}</button>)}
          <button className="btn btn-sm" onClick={onPause}>⏸</button>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between pointer-events-none">
        <div className="panel px-2 py-1 flex gap-1 flex-wrap max-w-[48%]"><span className="text-[11px] opacity-70 mr-1">You</span>{chips(synP)}</div>
        <div className="hidden sm:block text-[11px] opacity-60 self-end"><Kbd>1</Kbd>-<Kbd>4</Kbd> speed · <Kbd>Space</Kbd> cycle · <Kbd>Esc</Kbd> pause</div>
        <div className="panel px-2 py-1 flex gap-1 flex-wrap max-w-[48%] justify-end"><span className="text-[11px] opacity-70 mr-1">Foe</span>{chips(synE)}</div>
      </div>

      {done && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-3 bg-black/65 backdrop-blur-[2px]">
          <div className="panel anim-pop w-full max-w-lg p-4 max-h-full overflow-y-auto scroll-thin">
            <div className={`font-title text-4xl text-center ${done.sum.outcome === "win" ? "text-emerald-300" : done.sum.outcome === "lose" ? "text-red-400" : "text-zinc-300"}`}>
              {done.sum.outcome === "win" ? (done.sum.boss ? "BOSS SLAIN!" : "VICTORY") : done.sum.outcome === "lose" ? "DEFEAT" : "STALEMATE"}
            </div>
            <div className="text-center text-xs opacity-70 mb-2">Round {done.sum.round} · {done.res.time.toFixed(1)}s · {done.res.dmg} damage dealt · {done.res.kills} kills</div>
            {done.sum.livesLost > 0 && <div className="text-center text-red-300 mb-2">💔 You lost {done.sum.livesLost} {done.sum.livesLost > 1 ? "lives" : "life"}! ({run.lives} left)</div>}
            <table className="w-full text-xs mb-3">
              <thead className="opacity-60"><tr><th className="text-left">Chimera</th><th>Dealt</th><th>Taken</th><th>Kills</th><th>Healed</th></tr></thead>
              <tbody>
                {done.res.units.filter((u) => u.side === "p").map((u) => (
                  <tr key={u.name} className={u.alive ? "" : "opacity-50"}><td>{u === mvp && done.res.outcome === "win" ? "🏅 " : ""}{u.alive ? "" : "☠ "}{u.name}</td><td className="text-center">{u.dmg}</td><td className="text-center">{u.taken}</td><td className="text-center">{u.kills}</td><td className="text-center">{u.healed}</td></tr>
                ))}
              </tbody>
            </table>
            {done.sum.income.length > 0 && (
              <div className="rounded-lg bg-black/30 p-2 mb-3 text-sm">
                {done.sum.income.map((x) => <div key={x.label} className="flex justify-between"><span>{x.label}</span><span className={x.v < 0 ? "text-red-300" : "text-yellow-300"}>{x.v > 0 ? "+" : ""}{x.v}🪙</span></div>)}
                <div className="flex justify-between font-bold border-t border-white/10 mt-1 pt-1"><span>Total</span><span className="text-yellow-300">+{Math.max(0, done.sum.total)}🪙</span></div>
              </div>
            )}
            <button className="btn btn-primary w-full text-lg" onClick={() => onContinue(done.sum)}>
              {done.sum.over === "lose" ? "💀 Face your fate" : done.sum.over === "win" ? "👑 Claim your victory" : "Return to the Forge"} <Kbd>Space</Kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
