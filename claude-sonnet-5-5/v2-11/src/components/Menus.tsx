import { useEffect, useRef, useState } from "react";
import { CARDS, CARD_MAP, DIFFS, METAS, ORDERS, VOWS, vowAshBonus } from "../game/data";
import type { SaveData } from "../game/save";
import { audio } from "../game/audio";
import { BCOL, SPRITE_SCALE, orbSprite } from "../game/sprites";
import { cn } from "../utils/cn";
import CardView from "./CardView";

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, t = 0, last = performance.now();
    const resize = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    resize();
    window.addEventListener("resize", resize);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const cx = cv.width / 2, cy = cv.height * 0.42;
      const R = Math.min(cv.width, cv.height) * 0.55;
      for (let arm = 0; arm < 5; arm++) {
        for (let i = 0; i < 46; i++) {
          const k = i / 46;
          const a = t * 0.25 + arm * 1.2566 + k * 5.5;
          const r = (k * R + t * 20 * 0) * (0.35 + 0.65 * k);
          const img = orbSprite((arm + (i % 2)) % 6, 3 + (i % 3));
          const w = img.width * SPRITE_SCALE * 1.2, h = img.height * SPRITE_SCALE * 1.2;
          ctx.globalAlpha = 0.18 + 0.4 * (1 - k);
          ctx.drawImage(img, cx + Math.cos(a) * r * 1.4 - w / 2, cy + Math.sin(a) * r * 0.9 - h / 2, w, h);
        }
      }
      ctx.globalAlpha = 1;
      // ship silhouette
      ctx.fillStyle = BCOL[2] + "cc";
      ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx + 16, cy + 14); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 16, cy + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#f6d37a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy - 30, 10, 4, 0, 0, 7); ctx.stroke();
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-80 pointer-events-none" />;
}

export function Title({ save, onPlay, onTutorial, onReliquary, onHelp, onSettings }: { save: SaveData; onPlay: () => void; onTutorial: () => void; onReliquary: () => void; onHelp: () => void; onSettings: () => void }) {
  const best = Math.max(0, ...Object.values(save.records.bestScore));
  return (
    <div className="relative h-full w-full glass-bg overflow-hidden flex flex-col items-center justify-center p-4">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <div className="text-amber-200/70 tracking-[0.5em] text-xs sm:text-sm uppercase fade-up">A Bullet-Hell Deckbuilder</div>
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-[0.12em] text-amber-100 title-glow fade-up float-slow" style={{ animationDelay: "0.1s" }}>
          BULLET<br />LITURGY
        </h1>
        <p className="max-w-md text-sm text-violet-100/80 font-sans mt-1 fade-up" style={{ animationDelay: "0.2s" }}>
          Graze the choir. Rewrite your hymn. Silence the Hollow Cardinal.
        </p>
        <div className="flex flex-col gap-2 w-60 mt-4 fade-up" style={{ animationDelay: "0.3s" }}>
          <button className="btn btn-primary !py-3" onClick={onPlay} autoFocus>Begin Liturgy</button>
          <button className="btn" onClick={onTutorial}>{save.tutorialDone ? "Tutorial" : "Tutorial (recommended)"}</button>
          <button className="btn" onClick={onReliquary}>Reliquary <span className="text-amber-300">· {save.ash} Ash</span></button>
          <button className="btn" onClick={onHelp}>Codex &amp; Controls</button>
          <button className="btn" onClick={onSettings}>Settings</button>
        </div>
        <div className="text-xs text-violet-200/60 font-sans mt-3 flex gap-4">
          <span>Runs {save.records.runs}</span><span>Victories {save.records.wins}</span><span>Best {best.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function Setup({ save, onStart, onBack, onUnlockOrder, onChange }: {
  save: SaveData; onStart: () => void; onBack: () => void; onUnlockOrder: (id: string) => void; onChange: (s: SaveData["setup"]) => void;
}) {
  const st = save.setup;
  const order = ORDERS.find((o) => o.id === st.order) || ORDERS[0];
  const diff = DIFFS.find((d) => d.id === st.diff) || DIFFS[1];
  const mult = diff.ash * vowAshBonus(st.vows);
  const toggleVow = (id: string) => { audio.sfx("ui"); onChange({ ...st, vows: st.vows.includes(id) ? st.vows.filter((v) => v !== id) : [...st.vows, id] }); };
  const unlocked = (id: string) => save.unlockedOrders.includes(id);
  return (
    <div className="h-full w-full glass-bg overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button className="btn" onClick={onBack}>← Back</button>
          <h2 className="text-xl sm:text-3xl tracking-[0.25em] text-amber-100 title-glow">PREPARE THE RITE</h2>
          <div className="w-20" />
        </div>
        <section>
          <h3 className="text-xs uppercase tracking-[0.3em] text-amber-200/70 mb-2">1 · Choose your Order</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {ORDERS.map((o) => {
              const ok = unlocked(o.id);
              return (
                <div key={o.id} className={cn("panel rounded p-3 flex flex-col gap-2 cursor-pointer transition", st.order === o.id && ok && "!border-amber-300 shadow-[0_0_24px_rgba(246,211,122,0.35)]", !ok && "opacity-80")}
                  onClick={() => { if (ok) { audio.sfx("ui"); onChange({ ...st, order: o.id }); } }}>
                  <div className="flex items-center gap-2"><span className="text-3xl" style={{ color: o.color }}>{o.icon}</span><div><div className="font-bold text-amber-50">{o.name}</div><div className="text-xs text-violet-200/70">{o.sub}</div></div></div>
                  <p className="text-xs font-sans text-violet-100/80">{o.desc}</p>
                  <div className="text-xs font-sans text-amber-100/80 flex gap-3"><span>♥ {o.hp}</span><span>✧ {o.faith}</span><span>⚔ ×{o.dmg}</span><span>↻ ×{o.regen}</span></div>
                  <div className="flex flex-wrap gap-1">
                    {o.deck.map((c, i) => <span key={i} className="text-[10px] font-sans px-1 rounded bg-black/40 border border-white/10">{CARD_MAP[c].icon} {CARD_MAP[c].name}</span>)}
                  </div>
                  {!ok && <button className="btn !py-1 !text-[11px]" disabled={save.ash < (o.unlock || 0)} onClick={(e) => { e.stopPropagation(); onUnlockOrder(o.id); }}>Unlock · {o.unlock} Ash</button>}
                </div>
              );
            })}
          </div>
        </section>
        <div className="grid md:grid-cols-2 gap-4">
          <section>
            <h3 className="text-xs uppercase tracking-[0.3em] text-amber-200/70 mb-2">2 · Difficulty</h3>
            <div className="flex flex-col gap-1">
              {DIFFS.map((d) => (
                <button key={d.id} onClick={() => { audio.sfx("ui"); onChange({ ...st, diff: d.id }); }} className={cn("btn text-left !normal-case !tracking-normal flex justify-between gap-2", st.diff === d.id && "btn-primary")}>
                  <span><b className="uppercase tracking-widest">{d.name}</b> <span className="font-sans text-xs opacity-80">{d.desc}</span></span>
                  <span className="font-sans text-xs whitespace-nowrap">×{d.ash} Ash</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-xs uppercase tracking-[0.3em] text-amber-200/70 mb-2">3 · Vows (optional modifiers)</h3>
            <div className="flex flex-col gap-1">
              {VOWS.map((v) => (
                <button key={v.id} onClick={() => toggleVow(v.id)} className={cn("btn text-left !normal-case !tracking-normal flex justify-between gap-2", st.vows.includes(v.id) && "btn-primary")}>
                  <span><b className="uppercase tracking-widest text-[11px]">{v.name}</b> <span className="font-sans text-xs opacity-80">{v.text}</span></span>
                  <span className="font-sans text-xs whitespace-nowrap">+{Math.round(v.ash * 100)}%</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 panel rounded p-3">
          <div className="text-sm font-sans text-violet-100/90">
            <b className="text-amber-100">{order.name}</b> on <b className="text-amber-100">{diff.name}</b> with {st.vows.length} vow{st.vows.length === 1 ? "" : "s"} — Ash multiplier <b className="text-amber-300">×{mult.toFixed(2)}</b>
          </div>
          <button className="btn btn-primary !py-3 !px-8" onClick={onStart}>Descend</button>
        </div>
      </div>
    </div>
  );
}

export function Reliquary({ save, onBack, onBuyMeta, onUnlockCard, onUnlockOrder, onWipe }: {
  save: SaveData; onBack: () => void; onBuyMeta: (id: string) => void; onUnlockCard: (id: string) => void; onUnlockOrder: (id: string) => void; onWipe: () => void;
}) {
  const [tab, setTab] = useState<"up" | "cards" | "orders" | "chron">("up");
  const [confirm, setConfirm] = useState(false);
  const r = save.records;
  const lockedCards = CARDS.filter((c) => c.unlock);
  return (
    <div className="h-full w-full glass-bg overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button className="btn" onClick={onBack}>← Back</button>
          <h2 className="text-xl sm:text-3xl tracking-[0.25em] text-amber-100 title-glow">THE RELIQUARY</h2>
          <div className="text-amber-200 font-bold tabular-nums">⚰ {save.ash} Ash</div>
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {([["up", "Blessings"], ["cards", "Sealed Cards"], ["orders", "Orders"], ["chron", "Chronicle"]] as const).map(([t, l]) => (
            <button key={t} className={cn("btn !py-1", tab === t && "btn-primary")} onClick={() => { audio.sfx("ui"); setTab(t); }}>{l}</button>
          ))}
        </div>
        {tab === "up" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {METAS.map((m) => {
              const lvl = save.meta[m.id] || 0;
              const maxed = lvl >= m.max;
              const cost = m.cost[Math.min(lvl, m.max - 1)];
              return (
                <div key={m.id} className="panel rounded p-3 flex items-center gap-3">
                  <div className="text-3xl w-10 text-center">{m.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-amber-50">{m.name} <span className="text-xs text-amber-300">{lvl}/{m.max}</span></div>
                    <div className="text-xs font-sans text-violet-100/80">{m.text}</div>
                    <div className="flex gap-1 mt-1">{Array.from({ length: m.max }).map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded", i < lvl ? "bg-amber-300" : "bg-white/10")} />)}</div>
                  </div>
                  <button className="btn !py-1 !text-[11px] w-24" disabled={maxed || save.ash < cost} onClick={() => onBuyMeta(m.id)}>{maxed ? "Maxed" : cost + " Ash"}</button>
                </div>
              );
            })}
          </div>
        )}
        {tab === "cards" && (
          <div className="flex flex-wrap gap-4 justify-center">
            {lockedCards.map((c) => {
              const has = save.unlockedCards.includes(c.id);
              return (
                <div key={c.id} className="flex flex-col items-center gap-2">
                  <CardView inst={{ uid: 0, id: c.id, up: false }} locked={!has} />
                  <button className="btn !py-1 !text-[11px] w-[190px]" disabled={has || save.ash < (c.unlock || 0)} onClick={() => onUnlockCard(c.id)}>{has ? "Unlocked ✓" : "Unseal · " + c.unlock + " Ash"}</button>
                </div>
              );
            })}
          </div>
        )}
        {tab === "orders" && (
          <div className="grid md:grid-cols-3 gap-3">
            {ORDERS.map((o) => {
              const has = save.unlockedOrders.includes(o.id);
              return (
                <div key={o.id} className="panel rounded p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2"><span className="text-3xl" style={{ color: o.color }}>{o.icon}</span><div><div className="font-bold">{o.name}</div><div className="text-xs opacity-70">{o.sub}</div></div></div>
                  <p className="text-xs font-sans">{o.desc}</p>
                  <button className="btn !py-1 !text-[11px]" disabled={has || save.ash < (o.unlock || 0)} onClick={() => onUnlockOrder(o.id)}>{has ? "Unlocked ✓" : "Unlock · " + o.unlock + " Ash"}</button>
                </div>
              );
            })}
          </div>
        )}
        {tab === "chron" && (
          <div className="panel rounded p-4 grid sm:grid-cols-2 gap-x-8 gap-y-1 font-sans text-sm">
            <div>Runs begun: <b>{r.runs}</b></div><div>Victories: <b>{r.wins}</b></div>
            <div>Foes silenced: <b>{r.kills}</b></div><div>Bullets grazed: <b>{r.grazes}</b></div>
            <div>Bosses felled: <b>{r.bosses}</b></div><div>Furthest Act: <b>{r.bestAct}</b></div>
            <div>Time in vigil: <b>{Math.floor(r.playtime / 60)} min</b></div>
            <div>Unsealed cards: <b>{save.unlockedCards.length}/{lockedCards.length}</b></div>
            <div className="sm:col-span-2 mt-2 border-t border-white/10 pt-2">Best scores:
              {DIFFS.map((d) => <span key={d.id} className="ml-3">{d.name} <b>{(r.bestScore[d.id] || 0).toLocaleString()}</b></span>)}
            </div>
            <div className="sm:col-span-2 mt-3">
              {!confirm ? <button className="btn !text-[11px]" onClick={() => setConfirm(true)}>Erase all progress…</button> : (
                <span className="flex gap-2 items-center">Really erase everything? <button className="btn btn-primary !py-1 !text-[11px]" onClick={() => { setConfirm(false); onWipe(); }}>Erase</button><button className="btn !py-1 !text-[11px]" onClick={() => setConfirm(false)}>Cancel</button></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
