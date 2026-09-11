import type { ReactNode, MouseEvent } from "react";
import { cn } from "@/utils/cn";
import { iconFor } from "@/game/icons";
import { ITEMS, itemName } from "@/game/blocks";
import type { Stack } from "@/game/inventory";
import type { Settings } from "@/game/save";

export function Button({
  children,
  onClick,
  className,
  disabled,
  variant = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "mc-btn select-none px-4 py-2 text-sm font-bold tracking-wide text-white transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
        variant === "default" && "bg-stone-600 hover:bg-stone-500",
        variant === "primary" && "bg-emerald-700 hover:bg-emerald-600",
        variant === "danger" && "bg-red-800 hover:bg-red-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <div className={cn("mc-panel rounded-sm bg-stone-800/95 p-4 text-stone-100 shadow-2xl", className)}>
      {title && <h2 className="mb-3 text-center text-lg font-black uppercase tracking-widest text-stone-200">{title}</h2>}
      {children}
    </div>
  );
}

export function ItemIcon({ id, size = 40, className }: { id: number; size?: number; className?: string }) {
  return <img src={iconFor(id)} alt={itemName(id)} width={size} height={size} draggable={false} className={cn("pixelated pointer-events-none", className)} />;
}

export function Slot({
  stack,
  selected,
  size = 48,
  onClick,
  onContextMenu,
  title,
  dim,
  className,
}: {
  stack: Stack | null | undefined;
  selected?: boolean;
  size?: number;
  onClick?: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  title?: string;
  dim?: boolean;
  className?: string;
}) {
  const maxDur = stack?.durability !== undefined ? ITEMS[stack.id]?.tool?.durability ?? 0 : 0;
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={(e) => e.preventDefault()}
      title={title ?? (stack ? itemName(stack.id) : undefined)}
      style={{ width: size, height: size }}
      className={cn(
        "slot relative flex items-center justify-center bg-stone-900/70",
        selected && "slot-selected",
        onClick && "cursor-pointer hover:bg-stone-600/60",
        dim && "opacity-40",
        className,
      )}
    >
      {stack && (
        <>
          <ItemIcon id={stack.id} size={size * 0.78} />
          {stack.count > 1 && <span className="absolute bottom-0 right-1 text-shadow text-sm font-bold leading-none text-white">{stack.count}</span>}
          {maxDur > 0 && stack.durability !== undefined && stack.durability < maxDur && (
            <div className="absolute bottom-1 left-1 right-1 h-1 bg-black/70">
              <div
                className="h-full"
                style={{
                  width: `${(stack.durability / maxDur) * 100}%`,
                  background: stack.durability / maxDur > 0.5 ? "#4ade80" : stack.durability / maxDur > 0.25 ? "#facc15" : "#ef4444",
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="text-stone-300">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="space-y-3">
      <Slider label="Render distance" value={settings.renderDistance} min={3} max={12} step={1} onChange={(v) => set({ renderDistance: v })} format={(v) => `${v} chunks`} />
      <Slider label="Field of view" value={settings.fov} min={60} max={110} step={1} onChange={(v) => set({ fov: v })} format={(v) => `${v}°`} />
      <Slider label="Mouse sensitivity" value={settings.sensitivity} min={0.2} max={3} step={0.1} onChange={(v) => set({ sensitivity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Sound volume" value={settings.volume} min={0} max={1} step={0.05} onChange={(v) => set({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Music volume" value={settings.musicVolume} min={0} max={1} step={0.05} onChange={(v) => set({ musicVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <label className="flex items-center justify-between text-sm">
        <span>View bobbing</span>
        <input type="checkbox" checked={settings.viewBobbing} onChange={(e) => set({ viewBobbing: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
      </label>
    </div>
  );
}

export const CONTROLS: [string, string][] = [
  ["W A S D", "Move"],
  ["Mouse", "Look around"],
  ["Space", "Jump / swim up"],
  ["Shift", "Sneak (won't fall off edges)"],
  ["Ctrl / double-tap W", "Sprint"],
  ["Left click (hold)", "Mine block"],
  ["Right click", "Place block / use / eat"],
  ["Middle click", "Pick block"],
  ["1-9 / Scroll", "Select hotbar slot"],
  ["E", "Inventory & crafting"],
  ["Q / Ctrl+Q", "Drop item / stack"],
  ["F / double-tap Space", "Toggle flying (creative)"],
  ["F3", "Debug info"],
  ["Esc", "Pause"],
];

export function ControlsList({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm", className)}>
      {CONTROLS.map(([k, v]) => (
        <div key={k} className="contents">
          <kbd className="rounded bg-stone-950/70 px-2 py-0.5 font-mono text-xs text-emerald-300">{k}</kbd>
          <span className="text-stone-300">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
