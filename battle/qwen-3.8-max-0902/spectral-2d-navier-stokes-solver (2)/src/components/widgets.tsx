import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/* structure                                                          */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  tag,
  children,
  className,
  accent = "cyan",
}: {
  title: string;
  tag?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "amber" | "magenta" | "lime";
}) {
  const dot = { cyan: "bg-cyan", amber: "bg-amber", magenta: "bg-magenta", lime: "bg-lime" }[accent];
  return (
    <section
      className={cn(
        "relative rounded-sm border border-line bg-panel/80 backdrop-blur-[2px]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_10px_30px_-18px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-line/80 px-3 py-2">
        <span className={cn("h-1.5 w-1.5 rotate-45", dot)} />
        <h3 className="font-mono text-[10.5px] font-medium tracking-[0.22em] text-mist uppercase">{title}</h3>
        <div className="ml-auto flex items-center gap-2 font-mono text-[10px] tracking-wider text-mist/70">{tag}</div>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    // Safety net: never leave content invisible if the observer cannot fire
    // (deep-linked full-page capture, reduced-motion agents, unusual viewports).
    const fallback = window.setTimeout(() => el.classList.add("in"), 1400);
    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* controls                                                           */
/* ------------------------------------------------------------------ */

export function Toggle({
  label,
  value,
  onChange,
  hint,
  accent = "#43dfe6",
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="group flex w-full items-center gap-3 rounded-[3px] px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span
        className="relative h-[16px] w-[30px] shrink-0 rounded-[2px] border transition-all duration-200"
        style={{
          borderColor: value ? accent : "#2a414e",
          background: value ? `${accent}22` : "rgba(255,255,255,0.02)",
          boxShadow: value ? `0 0 12px -2px ${accent}` : "none",
        }}
      >
        <span
          className="absolute top-[2px] h-[10px] w-[12px] rounded-[1px] transition-all duration-200"
          style={{ left: value ? 15 : 3, background: value ? accent : "#4d6a79" }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-chalk/90 group-hover:text-chalk">{label}</span>
        {hint && <span className="block truncate font-mono text-[9.5px] tracking-wide text-mist/60">{hint}</span>}
      </span>
      <span className="font-mono text-[9px] tracking-[0.18em] text-mist/45 uppercase">{value ? "on" : "off"}</span>
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  accent = "#43dfe6",
  log = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accent?: string;
  log?: boolean;
}) {
  const toSlider = (v: number) => (log ? Math.log10(Math.max(v, min)) : v);
  const fromSlider = (v: number) => (log ? Math.pow(10, v) : v);
  const sv = toSlider(value);
  const smin = toSlider(min);
  const smax = toSlider(max);
  const sstep = log ? (smax - smin) / 200 : step;
  const pct = ((sv - smin) / (smax - smin || 1)) * 100;
  return (
    <div className="px-1.5 py-1">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <label className="truncate text-[12px] font-medium text-chalk/85">{label}</label>
        <span className="tabular shrink-0 font-mono text-[11px]" style={{ color: accent }}>
          {format ? format(value) : value.toFixed(3)}
        </span>
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute top-[7.5px] left-0 h-[3px] rounded-[2px]"
          style={{ width: `${pct}%`, background: accent, opacity: 0.55, boxShadow: `0 0 10px ${accent}66` }}
        />
        <input
          type="range"
          min={smin}
          max={smax}
          step={sstep}
          value={sv}
          onChange={(e) => onChange(fromSlider(parseFloat(e.target.value)))}
          style={{ ["--thumb" as string]: accent }}
        />
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accent = "#43dfe6",
  className,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-[3px] rounded-[3px] border border-line bg-black/25 p-[3px]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-[2px] px-1.5 py-[5px] font-mono text-[10px] tracking-[0.08em] uppercase transition-all duration-150",
              active ? "text-void" : "text-mist hover:bg-white/[0.045] hover:text-chalk",
            )}
            style={active ? { background: accent, boxShadow: `0 0 14px -3px ${accent}` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "danger";
  className?: string;
  title?: string;
}) {
  const styles = {
    ghost: "border-line2/70 bg-white/[0.02] text-chalk/85 hover:border-cyan/60 hover:text-cyan hover:bg-cyan/[0.07]",
    primary: "border-cyan/70 bg-cyan/15 text-cyan hover:bg-cyan/25 shadow-[0_0_18px_-6px_#43dfe6]",
    danger: "border-magenta/50 bg-magenta/10 text-magenta hover:bg-magenta/20",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-[3px] border px-2.5 py-[6px] font-mono text-[10px] tracking-[0.14em] uppercase transition-all duration-150 active:scale-[0.97]",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* readouts                                                           */
/* ------------------------------------------------------------------ */

export function LED({ on, color = "#b6f24a", label }: { on: boolean; color?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("h-[6px] w-[6px] rounded-full", on && "pulse-dot")}
        style={{ background: on ? color : "#31464f", color: on ? `${color}55` : "transparent" }}
      />
      {label && <span className="font-mono text-[9.5px] tracking-[0.16em] text-mist/70 uppercase">{label}</span>}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  accent = "#e8f3f7",
  wide,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  wide?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-line/70 bg-gradient-to-b from-white/[0.035] to-transparent px-2 py-1.5",
        wide && "col-span-2",
      )}
    >
      <div className="font-mono text-[8.5px] tracking-[0.2em] text-mist/60 uppercase">{label}</div>
      <div className="tabular mt-[2px] flex items-baseline gap-1">
        <span className="font-mono text-[15px] leading-none font-medium" style={{ color: accent }}>
          {value}
        </span>
        {unit && <span className="font-mono text-[9px] text-mist/60">{unit}</span>}
      </div>
      {sub && <div className="tabular mt-[3px] font-mono text-[8.5px] text-mist/45">{sub}</div>}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#43dfe6",
  height = 42,
  fill = true,
  min,
  max,
  label,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  min?: number;
  max?: number;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(height * dpr));
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    if (data.length < 2) return;
    const lo = min ?? Math.min(...data);
    const hi = max ?? Math.max(...data);
    const span = hi - lo || 1;
    const X = (i: number) => (i / (data.length - 1)) * w;
    const Y = (v: number) => height - 2 - ((v - lo) / span) * (height - 5);

    // baseline grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (fill) {
      ctx.beginPath();
      ctx.moveTo(0, height);
      data.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
      ctx.lineTo(w, height);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, `${color}44`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.beginPath();
    data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.shadowColor = `${color}aa`;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const last = data[data.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X(data.length - 1), Y(last), 1.9, 0, Math.PI * 2);
    ctx.fill();
  }, [data, color, height, fill, min, max]);
  return (
    <div className="relative">
      <canvas ref={ref} style={{ height, width: "100%" }} className="block" />
      {label && (
        <span className="absolute top-0 left-0 font-mono text-[8.5px] tracking-[0.18em] text-mist/50 uppercase">
          {label}
        </span>
      )}
    </div>
  );
}

export function StageBars({ stages, total }: { stages: { label: string; ms: number }[]; total: number }) {
  const max = Math.max(0.001, ...stages.map((s) => s.ms));
  const palette = ["#43dfe6", "#ffb454", "#ff5d8f", "#b6f24a", "#8f7bff", "#5ee0a0", "#ff8a5c", "#7fb6ff"];
  return (
    <div className="space-y-[5px]">
      {stages.map((s, i) => (
        <div key={s.label} className="group flex items-center gap-2">
          <span className="w-[46%] shrink-0 truncate font-mono text-[9px] tracking-tight text-mist/75" title={s.label}>
            {s.label}
          </span>
          <span className="relative h-[7px] flex-1 overflow-hidden rounded-[1px] bg-white/[0.04]">
            <span
              className="absolute inset-y-0 left-0 rounded-[1px] transition-[width] duration-500 ease-out"
              style={{
                width: `${(s.ms / max) * 100}%`,
                background: palette[i % palette.length],
                boxShadow: `0 0 10px -1px ${palette[i % palette.length]}`,
              }}
            />
          </span>
          <span className="tabular w-[52px] shrink-0 text-right font-mono text-[9.5px] text-chalk/80">
            {s.ms.toFixed(2)} ms
          </span>
        </div>
      ))}
      {total > 0 && (
        <div className="mt-1 flex items-center justify-between border-t border-line/70 pt-1 font-mono text-[9px] tracking-[0.14em] text-mist/60 uppercase">
          <span>gpu step</span>
          <span className="tabular text-cyan">{total.toFixed(2)} ms</span>
        </div>
      )}
    </div>
  );
}

export function ColorBar({
  gradient,
  lo,
  hi,
  label,
  unit,
}: {
  gradient: string;
  lo: string;
  hi: string;
  label: string;
  unit?: string;
}) {
  return (
    <div className="w-[190px]">
      <div className="mb-[3px] flex items-baseline justify-between font-mono text-[8.5px] tracking-[0.18em] text-chalk/70 uppercase">
        <span>{label}</span>
        {unit && <span className="text-mist/50">{unit}</span>}
      </div>
      <div className="h-[7px] w-full rounded-[1px] border border-white/10" style={{ background: gradient }} />
      <div className="tabular mt-[2px] flex justify-between font-mono text-[8.5px] text-mist/60">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
