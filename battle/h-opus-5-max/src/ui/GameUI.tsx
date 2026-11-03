import { useEffect, useMemo, useRef, useState } from "react";
import { item } from "../game/blocks";
import type { Game, Snapshot } from "../game/engine";
import type { Stack } from "../game/inventory";
import { COOK_TIME } from "../game/inventory";

function iconOf(id: string): string {
  return item(id)?.icon ?? "";
}
function nameOf(id: string): string {
  return item(id)?.name ?? id;
}

export function Slot({
  stack,
  size = 46,
  onClick,
  highlight,
  label,
  dim,
}: {
  stack: Stack | null;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  highlight?: boolean;
  label?: string;
  dim?: boolean;
}) {
  const def = stack ? item(stack.id) : undefined;
  const dur = def?.tool && stack?.dur !== undefined ? stack.dur / def.tool.durability : null;
  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      title={stack ? nameOf(stack.id) : label}
      className={`relative select-none rounded-[4px] border transition-colors ${
        highlight
          ? "border-white/80 bg-white/20"
          : "border-white/10 bg-black/35 hover:border-white/40 hover:bg-white/10"
      } ${dim ? "opacity-40" : ""}`}
      style={{ width: size, height: size }}
    >
      {stack && (
        <>
          <img
            src={iconOf(stack.id)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated" }}
          />
          {stack.count > 1 && (
            <span
              className="pointer-events-none absolute right-[2px] bottom-[-1px] text-[12px] font-bold text-white"
              style={{ textShadow: "1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000" }}
            >
              {stack.count}
            </span>
          )}
          {dur !== null && dur < 1 && (
            <div className="pointer-events-none absolute right-[3px] bottom-[3px] left-[3px] h-[3px] rounded-sm bg-black/70">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${Math.max(0, dur) * 100}%`,
                  background: `hsl(${Math.max(0, dur) * 110}, 90%, 48%)`,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Heart({ fill }: { fill: number }) {
  return (
    <svg viewBox="0 0 10 9" className="h-[15px] w-[16px]" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,.8))" }}>
      <defs>
        <clipPath id={`hc${fill}`}>
          <rect x="0" y="0" width={10 * fill} height="9" />
        </clipPath>
      </defs>
      <path d="M1 1h2v1h1V1h2v1h1v3h-1v1H6v1H5v1H4V7H3V6H2V5H1z" fill="#2b0608" />
      <g clipPath={`url(#hc${fill})`}>
        <path d="M1 1h2v1h1V1h2v1h1v3h-1v1H6v1H5v1H4V7H3V6H2V5H1z" fill="#e23a3a" />
        <path d="M2 2h1v1H2z" fill="#ff7b7b" />
      </g>
    </svg>
  );
}

function Drumstick({ fill }: { fill: number }) {
  return (
    <svg viewBox="0 0 10 9" className="h-[15px] w-[16px]" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,.8))" }}>
      <defs>
        <clipPath id={`dc${fill}`}>
          <rect x={10 - 10 * fill} y="0" width={10 * fill} height="9" />
        </clipPath>
      </defs>
      <path d="M3 1h4v1h1v3H7v2H5v1H3V7H2V5h1V3h0z" fill="#2b1a08" />
      <g clipPath={`url(#dc${fill})`}>
        <path d="M3 1h4v1h1v3H7v2H5v1H3V7H2V5h1V3h0z" fill="#b5651d" />
        <path d="M4 2h2v1H4z" fill="#e09a4e" />
      </g>
    </svg>
  );
}

export function Hud({ s, game }: { s: Snapshot; game: Game }) {
  const hearts = [];
  for (let i = 0; i < 10; i++) hearts.push(Math.max(0, Math.min(1, s.health / 2 - i)));
  const food = [];
  for (let i = 0; i < 10; i++) food.push(Math.max(0, Math.min(1, s.hunger / 2 - i)));
  const bubbles = Math.ceil(s.air);
  const lowHealth = s.health <= 6;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden font-sans">
      {/* underwater tint */}
      {s.underwater && <div className="absolute inset-0 bg-[#1d5c86]/35 mix-blend-multiply" />}
      {s.inBlock && <div className="absolute inset-0 bg-black/88" />}
      {/* damage flash */}
      {s.damageFlash > 0.01 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(170,0,0,0) 35%, rgba(190,0,0,${0.55 * s.damageFlash}) 100%)`,
          }}
        />
      )}
      {lowHealth && !s.paused && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(120,0,0,0) 45%, rgba(130,0,0,0.42) 100%)" }}
        />
      )}

      {/* crosshair */}
      {s.screen === "none" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-5 w-5 opacity-80 mix-blend-difference">
            <div className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-white" />
            <div className="absolute top-0 left-1/2 h-full w-[2px] -translate-x-1/2 bg-white" />
          </div>
        </div>
      )}

      {/* held item name */}
      {s.heldName && s.screen === "none" && (
        <div
          key={s.heldName}
          className="absolute bottom-[112px] left-1/2 -translate-x-1/2 text-[15px] font-semibold tracking-wide text-white/95"
          style={{ textShadow: "0 2px 4px rgba(0,0,0,.9)", animation: "fadeout 2.6s forwards" }}
        >
          {s.heldName}
        </div>
      )}

      {/* bottom bars */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="flex w-full items-end justify-between gap-6 px-1" style={{ width: 9 * 50 }}>
          <div className="flex flex-col gap-1">
            {s.mode === "survival" && (
              <div className="flex gap-[1px]">
                {hearts.map((f, i) => (
                  <Heart key={i} fill={f} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {s.mode === "survival" && (
              <>
                {s.air < 10 && (
                  <div className="flex gap-[2px]">
                    {Array.from({ length: bubbles }).map((_, i) => (
                      <div key={i} className="h-[10px] w-[10px] rounded-full bg-sky-200 ring-1 ring-sky-900/70" />
                    ))}
                  </div>
                )}
                <div className="flex gap-[1px]">
                  {food.map((f, i) => (
                    <Drumstick key={i} fill={f} />
                  ))}
                </div>
              </>
            )}
            {s.mode === "creative" && (
              <div className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold tracking-widest text-emerald-300 uppercase ring-1 ring-emerald-400/40">
                Creative
              </div>
            )}
          </div>
        </div>

        {/* xp bar */}
        <div className="flex w-full items-center gap-2" style={{ width: 9 * 50 }}>
          <span
            className="w-7 text-right text-[13px] font-bold text-lime-300"
            style={{ textShadow: "0 1px 2px #000" }}
          >
            {s.level}
          </span>
          <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-black/70 ring-1 ring-white/15">
            <div
              className="h-full bg-gradient-to-r from-lime-400 to-emerald-300"
              style={{ width: `${(s.xp / s.xpNeeded) * 100}%` }}
            />
          </div>
        </div>

        {/* hotbar */}
        <div className="pointer-events-auto flex gap-[3px] rounded-lg bg-black/40 p-[4px] ring-1 ring-white/15 backdrop-blur-sm">
          {s.slots.slice(0, 9).map((st, i) => (
            <Slot
              key={i}
              stack={st}
              size={46}
              highlight={i === s.selected}
              onClick={() => {
                game.inv.selected = i;
                game.markUi();
              }}
            />
          ))}
        </div>
      </div>

      {/* toast */}
      {s.toast && (
        <div className="absolute bottom-[190px] left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1 text-[13px] text-white/90 ring-1 ring-white/15">
          {s.toast.text}
        </div>
      )}

      {/* achievement */}
      {s.achievement && (
        <div className="absolute top-6 right-6 w-72 rounded-lg border border-amber-300/40 bg-gradient-to-br from-amber-900/80 to-stone-900/90 p-3 shadow-2xl backdrop-blur">
          <div className="text-[11px] font-bold tracking-widest text-amber-300 uppercase">Achievement unlocked</div>
          <div className="mt-0.5 text-[14px] font-semibold text-white">{s.achievement}</div>
        </div>
      )}

      {/* weather indicator */}
      {s.weather !== "clear" && s.screen === "none" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-[11px] tracking-wider text-sky-200 uppercase ring-1 ring-white/10">
          {s.weather === "thunder" ? "⛈ Thunderstorm" : "🌧 Rain"}
        </div>
      )}

      {game.debug && <Debug s={s} />}
    </div>
  );
}

function Debug({ s }: { s: Snapshot }) {
  return (
    <div className="absolute top-3 left-3 rounded-md bg-black/60 p-3 font-mono text-[11px] leading-[1.5] text-lime-200 ring-1 ring-white/10">
      <div className="mb-1 font-bold text-white">VoxelCraft · debug</div>
      <div>fps {s.fps.toFixed(0)}</div>
      <div>
        xyz {s.pos[0].toFixed(1)} / {s.pos[1].toFixed(1)} / {s.pos[2].toFixed(1)}
      </div>
      <div>
        chunk {Math.floor(s.pos[0] / 16)}, {Math.floor(s.pos[2] / 16)} · loaded {s.chunks}
      </div>
      <div>biome {s.biome}</div>
      <div>time {s.timeStr} · {s.weather}</div>
      <div>tris {(s.tris / 1000).toFixed(0)}k · calls {s.drawCalls}</div>
      <div>seed {s.seed}</div>
    </div>
  );
}

// ── screens ────────────────────────────────────────────────────────────────
function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
      <div className="relative w-fit rounded-xl border border-white/15 bg-gradient-to-b from-stone-800/95 to-stone-900/95 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-8">
          <h2 className="text-sm font-bold tracking-[0.2em] text-stone-200 uppercase">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-0.5 text-xs text-stone-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
          >
            ESC
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InventoryGrid({ s, game }: { s: Snapshot; game: Game }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-9 gap-[3px]">
        {s.slots.slice(9, 36).map((st, i) => (
          <Slot key={i} stack={st} onClick={(e) => game.slotClick("inv", i + 9, e.button === 2, e.shiftKey)} />
        ))}
      </div>
      <div className="mt-1 grid grid-cols-9 gap-[3px] border-t border-white/10 pt-2">
        {s.slots.slice(0, 9).map((st, i) => (
          <Slot
            key={i}
            stack={st}
            highlight={i === s.selected}
            onClick={(e) => game.slotClick("inv", i, e.button === 2, e.shiftKey)}
          />
        ))}
      </div>
    </div>
  );
}

function RecipeList({ s, game }: { s: Snapshot; game: Game }) {
  return (
    <div className="flex w-[232px] flex-col">
      <div className="mb-1.5 text-[11px] font-bold tracking-[0.18em] text-stone-400 uppercase">
        Craftable ({s.recipes.length})
      </div>
      <div className="grid max-h-[320px] grid-cols-4 gap-[3px] overflow-y-auto pr-1">
        {s.recipes.map((r) => (
          <button key={r.i} onClick={() => game.craftRecipe(r.i)} title={`Craft ${nameOf(r.out.id)}`}>
            <Slot stack={r.out} size={52} />
          </button>
        ))}
        {s.recipes.length === 0 && (
          <div className="col-span-4 py-6 text-center text-[12px] text-stone-500">
            Gather resources to unlock recipes
          </div>
        )}
      </div>
    </div>
  );
}

export function InventoryScreen({ s, game }: { s: Snapshot; game: Game }) {
  const big = s.screen === "crafting";
  const w = big ? 3 : 2;
  return (
    <Panel title={big ? "Crafting Table" : "Inventory"} onClose={() => game.closeScreen()}>
      <div className="flex gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className={`grid gap-[3px]`} style={{ gridTemplateColumns: `repeat(${w}, minmax(0,1fr))` }}>
              {Array.from({ length: w * w }).map((_, i) => (
                <Slot
                  key={i}
                  stack={s.craft[i] ?? null}
                  onClick={(e) => game.slotClick("craft", i, e.button === 2, e.shiftKey)}
                />
              ))}
            </div>
            <div className="px-1 text-2xl text-stone-500">→</div>
            <Slot
              stack={s.craftOut}
              size={58}
              onClick={(e) => game.slotClick("out", 0, e.button === 2, e.shiftKey)}
            />
          </div>
          <InventoryGrid s={s} game={game} />
        </div>
        <div className="w-px bg-white/10" />
        <RecipeList s={s} game={game} />
      </div>
      <CursorGhost s={s} />
      <p className="mt-3 text-[11px] text-stone-500">
        Click to pick up · Right-click to split · Shift-click to quick-move · Click a craftable icon to make it
      </p>
    </Panel>
  );
}

export function FurnaceScreen({ s, game }: { s: Snapshot; game: Game }) {
  const f = s.furnace;
  if (!f) return null;
  const burn = f.burnMax > 0 ? Math.max(0, f.burnTime / f.burnMax) : 0;
  const cook = Math.min(1, f.cookTime / COOK_TIME);
  return (
    <Panel title="Furnace" onClose={() => game.closeScreen()}>
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-2 py-2">
          <Slot stack={f.input} size={52} label="Input" onClick={(e) => game.slotClick("f_in", 0, e.button === 2, e.shiftKey)} />
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 rounded bg-black/50 ring-1 ring-white/10" />
            <div
              className="absolute right-0 bottom-0 left-0 rounded-b bg-gradient-to-t from-orange-500 to-amber-300"
              style={{ height: `${burn * 100}%` }}
            />
          </div>
          <Slot stack={f.fuel} size={52} label="Fuel" onClick={(e) => game.slotClick("f_fuel", 0, e.button === 2, e.shiftKey)} />
        </div>
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-300" style={{ width: `${cook * 100}%` }} />
          </div>
          <span className="text-[11px] text-stone-400">smelting</span>
        </div>
        <div className="flex items-center">
          <Slot stack={f.output} size={64} label="Output" onClick={(e) => game.slotClick("f_out", 0, e.button === 2, e.shiftKey)} />
        </div>
      </div>
      <div className="mt-4 border-t border-white/10 pt-3">
        <InventoryGrid s={s} game={game} />
      </div>
      <CursorGhost s={s} />
    </Panel>
  );
}

function CursorGhost({ s }: { s: Snapshot }) {
  const [p, setP] = useState({ x: -100, y: -100 });
  useEffect(() => {
    const h = (e: MouseEvent) => setP({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  if (!s.cursor) return null;
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: p.x - 23, top: p.y - 23 }}
    >
      <Slot stack={s.cursor} size={46} />
    </div>
  );
}

export function PauseMenu({
  s,
  game,
  onQuit,
  settings,
  setSettings,
}: {
  s: Snapshot;
  game: Game;
  onQuit: () => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="w-[420px] rounded-xl border border-white/15 bg-stone-900/95 p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold tracking-[0.25em] text-stone-100 uppercase">Paused</h2>
        <p className="mt-1 text-center text-[12px] text-stone-400">{s.worldName}</p>
        <div className="mt-5 flex flex-col gap-2">
          <MenuButton onClick={() => game.setScreen("none")}>Resume</MenuButton>
          <div className="grid grid-cols-2 gap-2">
            <MenuButton
              onClick={() => game.setMode(s.mode === "survival" ? "creative" : "survival")}
            >
              Mode: {s.mode === "survival" ? "Survival" : "Creative"}
            </MenuButton>
            <MenuButton onClick={() => game.toggleDebug()}>Debug (F3)</MenuButton>
          </div>
          <SettingSlider
            label="Render distance"
            value={settings.renderDistance}
            min={3}
            max={14}
            step={1}
            suffix=" chunks"
            onChange={(v) => {
              setSettings({ ...settings, renderDistance: v });
              game.setRenderDistance(v);
            }}
          />
          <SettingSlider
            label="Mouse sensitivity"
            value={settings.sensitivity}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(v) => {
              setSettings({ ...settings, sensitivity: v });
              game.sensitivity = v;
            }}
          />
          <SettingSlider
            label="Music"
            value={settings.music}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setSettings({ ...settings, music: v })}
          />
          <SettingSlider
            label="Sound"
            value={settings.sfx}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setSettings({ ...settings, sfx: v })}
          />
          <MenuButton
            onClick={async () => {
              await game.save();
              onQuit();
            }}
          >
            Save &amp; quit to title
          </MenuButton>
        </div>
      </div>
    </div>
  );
}

export function DeathScreen({ game }: { game: Game }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-red-950/60 backdrop-blur-sm">
      <div className="text-center">
        <h2 className="text-4xl font-black tracking-widest text-red-300 drop-shadow-lg">YOU DIED</h2>
        <p className="mt-2 text-sm text-red-200/70">Your items were kept.</p>
        <button
          onClick={() => game.respawn()}
          className="mt-6 rounded-lg bg-stone-200 px-8 py-2.5 text-sm font-bold tracking-wider text-stone-900 uppercase transition hover:bg-white"
        >
          Respawn
        </button>
      </div>
    </div>
  );
}

export function MenuButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
      : variant === "danger"
        ? "bg-red-900/60 text-red-200 hover:bg-red-800/70 ring-1 ring-red-500/30"
        : "bg-white/10 text-stone-100 hover:bg-white/20 ring-1 ring-white/10";
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold tracking-wide transition ${styles}`}
    >
      {children}
    </button>
  );
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10">
      <span className="flex justify-between text-[12px] text-stone-300">
        <span>{label}</span>
        <span className="text-stone-400">
          {typeof value === "number" ? (step < 1 ? value.toFixed(2) : value) : value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-600 accent-emerald-400"
      />
    </label>
  );
}

export interface Settings {
  renderDistance: number;
  sensitivity: number;
  music: number;
  sfx: number;
}

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 8,
  sensitivity: 1,
  music: 0.3,
  sfx: 0.7,
};

export function useSnapshot(game: Game | null) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const raf = useRef(0);
  const pending = useRef<Snapshot | null>(null);
  useEffect(() => {
    if (!game) return;
    game.onUpdate = (s) => {
      pending.current = s;
      if (!raf.current) {
        raf.current = requestAnimationFrame(() => {
          raf.current = 0;
          if (pending.current) setSnap({ ...pending.current });
        });
      }
    };
    setSnap({ ...game.snapshot });
    return () => {
      game.onUpdate = () => {};
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [game]);
  return snap;
}

export function Controls() {
  const rows = useMemo(
    () => [
      ["WASD", "Move"],
      ["Mouse", "Look"],
      ["Left click", "Break block / attack"],
      ["Right click", "Place block / use / eat"],
      ["Space", "Jump · swim up · (2×) fly"],
      ["Shift", "Sneak · descend"],
      ["Ctrl", "Sprint"],
      ["1-9 / Scroll", "Select hotbar slot"],
      ["E", "Inventory & crafting"],
      ["Q", "Drop item"],
      ["F", "Toggle fly (creative)"],
      ["F3", "Debug overlay"],
      ["Esc", "Pause"],
    ],
    [],
  );
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-right font-mono text-emerald-300/90">{k}</span>
          <span className="text-stone-300">{v}</span>
        </div>
      ))}
    </div>
  );
}
