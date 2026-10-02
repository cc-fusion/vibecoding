import { useEffect, useRef, useState, useCallback } from "react";
import { MODS, MOD_ORDER, ModId, hullById, HULLS, isModUnlocked, isHullUnlocked, STARTER_BUILD, Cat } from "../game/data";
import { Analysis, emptyLayout, inMask, buildLayout, layoutCost } from "../game/ship";
import { SaveData } from "../game/save";
import { drawModule } from "../game/render";
import { audio } from "../game/audio";
import { Bar, Btn, ModIcon, Panel } from "./ui";

/** Analysis overlay modes for the builder grid. */
export type View = "normal" | "power" | "heat" | "crew" | "mass";
type Tool = ModId | "erase";

interface Props { save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void; an: Analysis; view: View; setView: (v: View) => void }

const CATS: Cat[] = ["Structure", "Power", "Propulsion", "Weapons", "Defense", "Thermal", "Crew", "Utility"];
const VIEWS: { id: View; label: string; color: string }[] = [
  { id: "normal", label: "Normal", color: "#94a3b8" }, { id: "power", label: "Power", color: "#fbbf24" }, { id: "heat", label: "Heat", color: "#fb923c" },
  { id: "crew", label: "Crew", color: "#86efac" }, { id: "mass", label: "Mass", color: "#7dd3fc" },
];

export function Hangar({ save, setSave, an, view, setView }: Props) {
  const hull = hullById(save.hull);
  const layout = save.layouts[save.hull] ?? emptyLayout(hull);
  const [tool, setTool] = useState<Tool>("armor");
  const [hover, setHover] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const geo = useRef({ ox: 0, oy: 0, cell: 32 });
  const latest = useRef(save);
  latest.current = save;
  const live = useRef({ layout, hull, an, view, hover, tool });
  live.current = { layout, hull, an, view, hover, tool };
  const dragging = useRef<null | "place" | "erase">(null);
  const toastT = useRef<number | undefined>(undefined);

  const say = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const commit = (n: SaveData) => { latest.current = n; setSave(() => n); };

  const apply = (i: number, erase: boolean) => {
    const s = latest.current;
    const h = hullById(s.hull);
    const x = i % h.w, y = (i / h.w) | 0;
    if (!inMask(h, x, y)) return;
    if (x === h.bridge.x && y === h.bridge.y) { if (erase || live.current.tool === "erase") say("The command bridge cannot be removed."); return; }
    const l = (s.layouts[s.hull] ?? emptyLayout(h)).slice();
    const cur = l[i];
    const t = live.current.tool;
    if (erase || t === "erase") {
      if (!cur) return;
      l[i] = null;
      audio.sfx("remove");
      commit({ ...s, credits: s.credits + MODS[cur].cost, layouts: { ...s.layouts, [s.hull]: l } });
      return;
    }
    if (cur === t) return;
    if (!isModUnlocked(t, s.tech)) { say("Locked — unlock it in the Research tab."); audio.sfx("error"); return; }
    const delta = MODS[t].cost - (cur ? MODS[cur].cost : 0);
    if (s.credits < delta) { say(`Not enough credits (need ${delta}¢).`); audio.sfx("error"); return; }
    l[i] = t;
    audio.sfx("place");
    commit({ ...s, credits: s.credits - delta, layouts: { ...s.layouts, [s.hull]: l } });
  };

  const clearAll = () => {
    const s = latest.current;
    const h = hullById(s.hull);
    const l = s.layouts[s.hull] ?? emptyLayout(h);
    const refund = layoutCost(l);
    audio.sfx("remove");
    commit({ ...s, credits: s.credits + refund, layouts: { ...s.layouts, [s.hull]: emptyLayout(h) } });
    say(`Refunded ${refund}¢. Hull stripped.`);
  };
  const resetStarter = () => {
    const s = latest.current;
    const h = hullById(s.hull);
    if (h.id !== "skiff") { say("Starter layout exists only for the Wasp Skiff."); audio.sfx("error"); return; }
    const old = layoutCost(s.layouts[s.hull] ?? emptyLayout(h));
    const nl = buildLayout(h, STARTER_BUILD);
    const cost = layoutCost(nl);
    if (s.credits + old < cost) { say(`Need ${cost - old - s.credits}¢ more for the starter refit.`); audio.sfx("error"); return; }
    audio.sfx("place");
    commit({ ...s, credits: s.credits + old - cost, layouts: { ...s.layouts, [s.hull]: nl } });
    say("Starter layout installed.");
  };

  // hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const unlocked = MOD_ORDER.filter((m) => isModUnlocked(m, latest.current.tech));
      if (e.key >= "1" && e.key <= "9") { const m = unlocked[parseInt(e.key) - 1]; if (m) { setTool(m); audio.sfx("ui"); } }
      else if (e.key === "x" || e.key === "X") setTool("erase");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // render loop
  useEffect(() => {
    const cv = cvRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const frame = (ms: number) => {
      const t = ms / 1000;
      const { layout: L, hull: hl, an: A, view: V, hover: hv, tool: tl } = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cell = Math.max(18, Math.min(64, Math.floor(Math.min((W - 30) / hl.w, (H - 56) / hl.h))));
      const ox = Math.floor((W - cell * hl.w) / 2), oy = Math.floor((H - cell * hl.h) / 2) + 8;
      geo.current = { ox, oy, cell };
      // grid backdrop
      ctx.strokeStyle = "rgba(56,189,248,0.07)"; ctx.lineWidth = 1;
      for (let x = ox % cell; x < W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = oy % cell; y < H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = "rgba(125,211,252,0.6)"; ctx.font = "bold 11px Orbitron, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("▲ FORE", W / 2, oy - 8);
      for (let y = 0; y < hl.h; y++) for (let x = 0; x < hl.w; x++) {
        if (!inMask(hl, x, y)) continue;
        const i = y * hl.w + x;
        const px = ox + x * cell, py = oy + y * cell;
        ctx.fillStyle = "rgba(30,41,59,0.55)"; ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "rgba(100,116,139,0.35)"; ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
        const id = L[i];
        if (!id) continue;
        const d = MODS[id];
        drawModule(ctx, id, px + cell / 2, py + cell / 2, cell - 2, { t, unmanned: !A.manned[i], dim: V === "crew" && !d.passable ? 0.55 : 1 });
        // overlays
        if (V === "power") {
          const gen = d.power > 0;
          const draw = -d.power - d.active;
          if (gen || draw > 0) {
            ctx.fillStyle = gen ? "rgba(74,222,128,0.35)" : "rgba(251,146,60,0.32)";
            ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
            ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, cell * 0.28)}px Rajdhani, sans-serif`; ctx.textAlign = "center";
            ctx.fillText(gen ? `+${d.power}` : `−${draw.toFixed(1).replace(".0", "")}`, px + cell / 2, py + cell - 4);
          }
        } else if (V === "heat") {
          const hs = d.heat + d.heatActive + (d.weapon ? d.weapon.rate * d.weapon.heatShot : 0);
          if (hs > 0) { ctx.fillStyle = `rgba(239,68,68,${Math.min(0.7, 0.2 + hs * 0.1)})`; ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4); ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, cell * 0.28)}px Rajdhani, sans-serif`; ctx.textAlign = "center"; ctx.fillText(`+${hs.toFixed(1)}`, px + cell / 2, py + cell - 4); }
          if (d.dissip > 0) {
            const ex = A.exposure[i];
            ctx.fillStyle = ex > 1 ? "rgba(56,189,248,0.4)" : "rgba(100,116,139,0.55)"; ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
            ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, cell * 0.3)}px Rajdhani, sans-serif`; ctx.textAlign = "center"; ctx.fillText(`×${ex}`, px + cell / 2, py + cell - 4);
          }
          if (d.heatCap > 0) { ctx.fillStyle = "rgba(56,189,248,0.3)"; ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4); }
        } else if (V === "crew") {
          if (d.crewProv > 0) { ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
          if (d.crew > 0) {
            ctx.fillStyle = A.manned[i] ? "rgba(74,222,128,0.3)" : "rgba(244,63,94,0.45)"; ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
            ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, cell * 0.3)}px Rajdhani, sans-serif`; ctx.textAlign = "center"; ctx.fillText(`${d.crew}☺`, px + cell / 2, py + cell - 4);
          }
        } else if (V === "mass") {
          ctx.fillStyle = `rgba(125,211,252,${0.08 + d.mass * 0.06})`; ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
          ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, cell * 0.3)}px Rajdhani, sans-serif`; ctx.textAlign = "center"; ctx.fillText(`${d.mass}`, px + cell / 2, py + cell - 4);
        }
        if (A.disconnected.includes(i)) { ctx.strokeStyle = "#f43f5e"; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); ctx.setLineDash([]); }
      }
      if (V === "crew") {
        ctx.fillStyle = "#bbf7d0";
        A.flows.forEach((path, k) => {
          const n = path.length;
          for (let d = 0; d < 2; d++) {
            const p = ((t * 0.9 + k * 0.37 + d * 0.5) % 1) * (n - 1);
            const a = Math.floor(p), f = p - a;
            const ia = path[Math.min(n - 1, a)], ib = path[Math.min(n - 1, a + 1)];
            const xa = ox + (ia % hl.w) * cell + cell / 2, ya = oy + ((ia / hl.w) | 0) * cell + cell / 2;
            const xb = ox + (ib % hl.w) * cell + cell / 2, yb = oy + ((ib / hl.w) | 0) * cell + cell / 2;
            ctx.beginPath(); ctx.arc(xa + (xb - xa) * f, ya + (yb - ya) * f, Math.max(2.5, cell * 0.08), 0, 7); ctx.fill();
          }
        });
      }
      // hover & ghost
      if (hv !== null) {
        const x = hv % hl.w, y = (hv / hl.w) | 0;
        const px = ox + x * cell, py = oy + y * cell;
        if (tl !== "erase" && !L[hv]) drawModule(ctx, tl, px + cell / 2, py + cell / 2, cell - 2, { t, dim: 0.55 });
        ctx.strokeStyle = tl === "erase" ? "#f43f5e" : "#22d3ee"; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const cellFromEvent = (e: React.PointerEvent): number | null => {
    const cv = cvRef.current!;
    const r = cv.getBoundingClientRect();
    const { ox, oy, cell } = geo.current;
    const x = Math.floor((e.clientX - r.left - ox) / cell), y = Math.floor((e.clientY - r.top - oy) / cell);
    if (!inMask(live.current.hull, x, y)) return null;
    return y * live.current.hull.w + x;
  };

  const hovMod = hover !== null ? layout[hover] : null;
  const infoId: ModId | null = hovMod || (tool !== "erase" ? tool : null);
  const info = infoId ? MODS[infoId] : null;
  const E = (v: number, d = 1) => v.toFixed(d).replace(/\.0$/, "");
  const dpsTot = an.dps.energy + an.dps.kinetic + an.dps.explosive;
  const cooldown = an.overheatIn;

  return (
    <div className="h-full grid gap-2 p-2 overflow-y-auto scroll-thin lg:overflow-hidden lg:grid-cols-[236px_minmax(0,1fr)_272px] grid-rows-[auto] lg:grid-rows-1">
      {/* palette */}
      <Panel title="Modules" className="lg:overflow-y-auto scroll-thin order-2 lg:order-1 lg:h-full">
        <div className="p-2 space-y-2">
          <button onClick={() => { setTool("erase"); audio.sfx("ui"); }} className={"w-full flex items-center gap-2 p-1.5 border rounded-sm text-left text-sm " + (tool === "erase" ? "border-rose-400 bg-rose-500/15" : "border-slate-700 hover:border-slate-500")}>
            <span className="w-7 h-7 flex items-center justify-center text-rose-400 font-bold">✕</span><span className="font-bold">Erase (X)</span><span className="ml-auto text-[11px] text-slate-400">refund 100%</span>
          </button>
          {CATS.map((cat) => {
            const items = MOD_ORDER.filter((m) => MODS[m].cat === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="font-display text-[9px] tracking-[0.3em] text-slate-500 uppercase mb-1">{cat}</div>
                <div className="space-y-1">
                  {items.map((m) => {
                    const unlocked = isModUnlocked(m, save.tech);
                    const afford = save.credits >= MODS[m].cost;
                    const idx = MOD_ORDER.filter((x) => isModUnlocked(x, save.tech)).indexOf(m);
                    return (
                      <button key={m} onClick={() => { if (!unlocked) { say("Locked — unlock it in the Research tab."); audio.sfx("error"); return; } setTool(m); audio.sfx("ui"); }}
                        title={MODS[m].desc}
                        className={"w-full flex items-center gap-2 p-1.5 border rounded-sm text-left transition-colors " + (tool === m ? "border-cyan-400 bg-cyan-500/15 " : "border-slate-700 hover:border-slate-500 ") + (unlocked ? "" : "opacity-40")}>
                        <ModIcon id={m} size={28} />
                        <span className="leading-tight min-w-0">
                          <span className="block text-sm font-bold truncate">{MODS[m].name}</span>
                          <span className="block text-[11px] text-slate-400">{unlocked ? `${MODS[m].mass} mass` : "🔒 Research"}</span>
                        </span>
                        <span className="ml-auto text-right shrink-0">
                          <span className={"block text-xs font-bold " + (afford ? "text-amber-300" : "text-rose-400")}>{MODS[m].cost}¢</span>
                          {unlocked && idx >= 0 && idx < 9 && <span className="block text-[9px] text-slate-500">[{idx + 1}]</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* builder */}
      <div className="flex flex-col min-h-[56vh] lg:min-h-0 order-1 lg:order-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {HULLS.map((h) => {
              const un = isHullUnlocked(h.id, save.tech);
              return (
                <Btn key={h.id} small variant={save.hull === h.id ? "primary" : "default"} disabled={!un}
                  title={un ? `${h.name} — ${h.desc}` : "Research this hull"}
                  onClick={() => setSave((s) => ({ ...s, hull: h.id, layouts: { ...s.layouts, [h.id]: s.layouts[h.id] ?? emptyLayout(h) } }))}>
                  {un ? h.name.split(" ")[0] : "🔒 " + h.name.split(" ")[0]}
                </Btn>
              );
            })}
          </div>
          <div className="flex gap-1 ml-auto flex-wrap">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => { audio.sfx("ui"); setView(v.id); }}
                className={"font-display text-[10px] tracking-widest uppercase px-2.5 py-1.5 border rounded-sm transition-colors " + (view === v.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}
                style={{ borderColor: view === v.id ? v.color : "#334155", color: view === v.id ? v.color : undefined }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div ref={wrapRef} className="relative flex-1 min-h-[300px] border border-slate-700 rounded-sm bg-[#070c1c] overflow-hidden"
          onContextMenu={(e) => e.preventDefault()}>
          <canvas ref={cvRef} className="absolute inset-0 touch-none cursor-crosshair"
            onPointerDown={(e) => {
              audio.init();
              (e.target as Element).setPointerCapture(e.pointerId);
              const i = cellFromEvent(e);
              dragging.current = e.button === 2 ? "erase" : "place";
              if (i !== null) apply(i, e.button === 2);
            }}
            onPointerMove={(e) => {
              const i = cellFromEvent(e);
              setHover((h) => (h === i ? h : i));
              if (dragging.current && i !== null) apply(i, dragging.current === "erase");
            }}
            onPointerUp={() => { dragging.current = null; }}
            onPointerLeave={() => { if (!dragging.current) setHover(null); }}
          />
          <div className="absolute top-2 left-2 text-[11px] text-slate-400 pointer-events-none">
            {hull.name} · {hull.w}×{hull.h} · cap {hull.cap}
          </div>
          {info && (
            <div className="absolute bottom-2 left-2 right-2 sm:right-auto sm:max-w-md bg-slate-950/85 border border-slate-700 p-2 rounded-sm pointer-events-none text-xs">
              <div className="flex items-center gap-2"><span className="font-display text-[11px] tracking-widest" style={{ color: info.color }}>{info.name}</span>
                <span className="text-slate-400">{info.cat} · mass {info.mass} · {info.hp}hp{info.crew ? ` · crew ${info.crew}` : ""}{info.power > 0 ? ` · +${info.power}⚡` : info.power < 0 ? ` · −${-info.power}⚡` : ""}</span></div>
              <div className="text-slate-300 mt-0.5">{info.desc}</div>
            </div>
          )}
          {toast && <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-rose-900/90 border border-rose-500 text-rose-100 px-3 py-1 text-sm rounded-sm fade-up">{toast}</div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn small onClick={resetStarter}>Starter layout</Btn>
          <Btn small variant="danger" onClick={clearAll}>Strip hull</Btn>
          <span className="text-[11px] text-slate-500 self-center">Drag to paint · Right-click to erase · Placing replaces (price difference charged)</span>
        </div>
      </div>

      {/* stats */}
      <Panel title="Ship Analysis" className="lg:overflow-y-auto scroll-thin order-3 lg:h-full">
        <div className="p-3">
          <Bar label="Mass" value={`${E(an.mass, 0)} / ${an.cap}`} pct={an.mass / an.cap} color="#7dd3fc" warn={an.mass > an.cap} />
          <Bar label="Power output" value={`${E(an.gen)} vs peak ${E(an.peakDraw)}`} pct={an.peakDraw > 0 ? an.gen / an.peakDraw : 1} color="#fbbf24" warn={an.gen < an.idleDraw} />
          <div className="text-[10px] text-slate-500 -mt-1 mb-1.5">idle draw {E(an.idleDraw)} · capacitor {E(an.battery, 0)}</div>
          <Bar label="Heat dissipation" value={`${E(an.dissip)}/s vs ${E(an.idleHeat + an.fireHeat)}/s firing`} pct={(an.idleHeat + an.fireHeat) > 0 ? an.dissip * 1.6 / (an.idleHeat + an.fireHeat) : 1} color="#fb923c" warn={cooldown !== null} />
          <div className="text-[10px] text-slate-500 -mt-1 mb-1.5">capacity {E(an.heatCap, 0)} · {cooldown !== null ? <span className="text-rose-400">overheats in {E(cooldown, 0)}s of fire</span> : <span className="text-emerald-400">sustainable fire</span>}</div>
          <Bar label="Crew" value={`${an.crewUsed} / ${an.crewNeed} needed (${an.crewSupply} supply)`} pct={an.crewNeed > 0 ? an.crewUsed / an.crewNeed : 1} color="#86efac" warn={an.crewUsed < an.crewNeed} />
          <Bar label="Top speed" value={`${E(an.accel * 520 / 1.1, 0)}`} pct={an.accel * 520 / 1.1 / 480} color="#a78bfa" warn={an.thrust <= 0} />
          <Bar label="Shield" value={`${E(an.shieldCap, 0)} (+${E(an.shieldRegen, 0)}/s)`} pct={an.shieldCap / 240} color="#22d3ee" />
          <Bar label="Structure" value={`${E(an.hp, 0)} HP`} pct={an.hp / 1200} color="#f87171" />
          <div className="mt-2 border-t border-slate-700 pt-2">
            <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-400"><span>Firepower</span><span className="text-slate-100">{E(dpsTot, 0)} dps (+{Math.round((an.dmgMult - 1) * 100)}%)</span></div>
            <div className="flex h-2 mt-1 rounded-sm overflow-hidden bg-slate-800">
              <div style={{ width: `${dpsTot ? an.dps.energy / dpsTot * 100 : 0}%`, background: "#f472b6" }} title="energy" />
              <div style={{ width: `${dpsTot ? an.dps.kinetic / dpsTot * 100 : 0}%`, background: "#c084fc" }} title="kinetic" />
              <div style={{ width: `${dpsTot ? an.dps.explosive / dpsTot * 100 : 0}%`, background: "#f87171" }} title="explosive" />
            </div>
            <div className="flex justify-between text-[10px] mt-0.5"><span className="text-pink-400">energy {E(an.dps.energy, 0)}</span><span className="text-purple-400">kinetic {E(an.dps.kinetic, 0)}</span><span className="text-red-400">explosive {E(an.dps.explosive, 0)}</span></div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex justify-between"><span>Ship value</span><span className="text-amber-300 font-bold">{an.cost}¢</span></div>
          <div className="mt-2 space-y-1">
            {an.errors.map((e) => <div key={e} className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 px-2 py-1 rounded-sm">⛔ {e}</div>)}
            {an.warnings.map((e) => <div key={e} className="text-xs text-amber-200 bg-amber-950/40 border border-amber-800/70 px-2 py-1 rounded-sm">⚠ {e}</div>)}
            {!an.errors.length && !an.warnings.length && <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800 px-2 py-1 rounded-sm">✔ All systems nominal.</div>}
          </div>
        </div>
      </Panel>
    </div>
  );
}
