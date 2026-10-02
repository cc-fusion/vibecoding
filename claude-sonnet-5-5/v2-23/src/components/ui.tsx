import { useEffect, useRef, type ReactNode } from "react";
import { PARTS, TAG_META, ROW_NAMES, SLOT_LABEL, partDesc, partStats, RESONANCE } from "../game/data";
import type { PartInst, Chimera } from "../game/battle";
import { drawChimera, type DrawPart } from "../game/draw";
import { audio } from "../game/audio";

export function toDraw(parts: (PartInst | null)[]): (DrawPart | null)[] {
  return parts.map((p) => (p && PARTS[p.id] ? { tag: PARTS[p.id].tag, tier: p.tier } : null));
}

export function ChimeraCanvas({ chimera, w = 150, h = 112, facing = 1, anim = false, scale = 1.25 }: { chimera: Chimera; w?: number; h?: number; facing?: 1 | -1; anim?: boolean; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = chimera.parts.map((p) => (p ? p.id + p.tier : "-")).join(",");
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const parts = toDraw(chimera.parts);
    let raf = 0, t0 = performance.now();
    const render = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(w / 2, h - 10, 46 * scale / 1.25, 7, 0, 0, 7); ctx.fill();
      drawChimera(ctx, parts, w / 2 + 6 * facing, h - 12, scale, { t: (now - t0) / 1000, facing, still: !anim });
      if (anim) raf = requestAnimationFrame(render);
    };
    render(t0);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w, h, facing, anim, scale]);
  return <canvas ref={ref} style={{ width: w, height: h }} className="block" />;
}

const stars = (t: number) => "★".repeat(t);

export function PartChip(props: {
  part: PartInst; row?: number; selected?: boolean; compact?: boolean;
  onClick?: () => void; onDoubleClick?: () => void; onDragStart?: () => void; onDragEnd?: () => void; onHover?: (p: PartInst | null) => void;
}) {
  const { part, row, selected, compact } = props;
  const d = PARTS[part.id];
  if (!d) return null;
  const col = TAG_META[d.tag].color;
  const res = row !== undefined && row === d.row;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", part.id); e.dataTransfer.effectAllowed = "move"; props.onDragStart?.(); }}
      onDragEnd={props.onDragEnd}
      onClick={(e) => { e.stopPropagation(); props.onClick?.(); }}
      onDoubleClick={(e) => { e.stopPropagation(); props.onDoubleClick?.(); }}
      onMouseEnter={() => { props.onHover?.(part); audio.sfx("hover"); }}
      onMouseLeave={() => props.onHover?.(null)}
      title={`${d.name} (Tier ${part.tier}) — ${partDesc(d, part.tier)}`}
      className={`part-card relative flex items-center gap-1.5 rounded-lg border cursor-grab active:cursor-grabbing ${compact ? "px-1.5 py-1" : "px-2 py-1.5"} ${selected ? "sel-ring" : ""} ${part.tier === 3 ? "anim-glow" : ""}`}
      style={{ borderColor: col, background: `linear-gradient(135deg, ${col}33, ${col}0d)`, boxShadow: part.tier === 3 ? `0 0 14px ${col}88` : undefined }}
    >
      <span className={compact ? "text-lg" : "text-xl"}>{d.icon}</span>
      <div className="min-w-0 leading-tight flex-1">
        <div className={`truncate font-semibold ${compact ? "text-[11px]" : "text-xs"}`}>{d.name}</div>
        <div className="text-[10px] flex items-center gap-1" style={{ color: col }}>
          <span className="text-amber-300 tracking-tighter">{stars(part.tier)}</span>
          <span className="opacity-80">{TAG_META[d.tag].name}</span>
          {res && <span title={`Resonance: x${RESONANCE} stats & effect in the ${ROW_NAMES[d.row]} row`} className="text-yellow-300">⚡</span>}
        </div>
      </div>
    </div>
  );
}

export function PartInfo({ part, row }: { part: PartInst | null; row?: number }) {
  if (!part) return <div className="text-xs opacity-60 p-2">Hover or select a part to inspect it. Parts share a <b>Tag</b> for synergies and have a favored <b>Row</b> for resonance.</div>;
  const d = PARTS[part.id];
  const col = TAG_META[d.tag].color;
  const s = partStats(d, part.tier);
  const res = row !== undefined && row === d.row;
  return (
    <div className="p-2 text-xs space-y-1 anim-slide" key={part.id + part.tier}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{d.icon}</span>
        <div>
          <div className="font-bold text-sm">{d.name} <span className="text-amber-300">{stars(part.tier)}</span></div>
          <div style={{ color: col }}>{TAG_META[d.tag].icon} {TAG_META[d.tag].name} · {SLOT_LABEL[d.slot]} · Rarity {d.rarity}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {s.hp > 0 && <span className="chip">❤ +{s.hp}</span>}
        {s.atk > 0 && <span className="chip">⚔ +{s.atk}</span>}
        {s.spd > 0 && <span className="chip">⚡ +{Math.round(s.spd * 100)}% spd</span>}
        {s.def > 0 && <span className="chip">🛡 +{s.def}</span>}
      </div>
      <div className="text-amber-100">{partDesc(d, part.tier)}</div>
      <div className={res ? "text-yellow-300" : "opacity-70"}>
        {res ? `⚡ Resonating in the ${ROW_NAMES[d.row]} row (×${RESONANCE})` : `Resonates in the ${ROW_NAMES[d.row]} row (×${RESONANCE} stats & effect)`}
      </div>
    </div>
  );
}

export function Modal({ children, onClose, wide, title }: { children: ReactNode; onClose?: () => void; wide?: boolean; title?: string }) {
  return (
    <div data-modal="1" className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`panel anim-pop max-h-full overflow-y-auto scroll-thin w-full ${wide ? "max-w-4xl" : "max-w-md"} p-5`} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="font-title text-2xl mb-3 text-amber-200">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-10 text-right tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button className="flex items-center justify-between w-full text-sm py-1 text-left" onClick={() => onChange(!value)}>
      <span>{label}{hint && <span className="block text-[11px] opacity-60">{hint}</span>}</span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${value ? "bg-orange-500" : "bg-zinc-700"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-[11px] font-mono text-amber-200">{children}</kbd>;
}
