import type { Game } from "@/game/Game";
import { HOTBAR } from "@/game/inventory";
import { itemName } from "@/game/blocks";
import { Slot } from "./common";

export function HUD({ game }: { game: Game }) {
  const p = game.player;
  const inv = game.inventory;
  const held = inv.held;
  const showName = held && performance.now() - game.lastSlotChange < 2000;
  const hearts = [];
  for (let i = 0; i < 10; i++) {
    const hp = p.health - i * 2;
    hearts.push(<Heart key={i} state={hp >= 2 ? 2 : hp >= 1 ? 1 : 0} low={p.health <= 6} />);
  }
  const bubbles = [];
  if (p.headInWater || p.air < 20) for (let i = 0; i < 10; i++) bubbles.push(<span key={i} className={`inline-block h-4 w-4 rounded-full border-2 border-sky-100 ${Math.ceil(p.air / 2) > i ? "bg-sky-300" : "bg-transparent opacity-30"}`} />);

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* underwater tint */}
      {p.headInWater && <div className="absolute inset-0 bg-blue-800/30" />}
      {/* hurt flash */}
      {game.hurtFlash > 0 && <div className="absolute inset-0 bg-red-600" style={{ opacity: game.hurtFlash * 0.35 }} />}
      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white" />
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-white" />
      </div>
      {/* break progress */}
      {game.breakProgress > 0 && (
        <div className="absolute left-1/2 top-1/2 mt-5 h-1.5 w-16 -translate-x-1/2 bg-black/50">
          <div className="h-full bg-white" style={{ width: `${Math.min(100, game.breakProgress * 100)}%` }} />
        </div>
      )}
      {/* top-left clock & mode */}
      <div className="absolute left-3 top-3 text-shadow text-sm font-bold text-white/90">
        <span className="rounded bg-black/40 px-2 py-1">
          {game.clockString()} · {game.meta.mode === "creative" ? "Creative" : "Survival"}
          {p.flying ? " · Flying" : ""}
        </span>
      </div>
      {/* debug */}
      {game.debug && (
        <div className="absolute left-3 top-12 space-y-0.5 font-mono text-xs text-white">
          {game.debugInfo().map((l, i) => (
            <div key={i} className="w-fit bg-black/50 px-1">
              {l}
            </div>
          ))}
        </div>
      )}
      {/* toasts */}
      <div className="absolute left-1/2 top-16 flex -translate-x-1/2 flex-col items-center gap-2">
        {game.toasts.map((t) => (
          <div key={t.id} className="toast rounded bg-black/70 px-4 py-2 text-sm font-bold text-yellow-100 shadow">
            {t.text}
          </div>
        ))}
      </div>
      {/* click to resume hint */}
      {!game.pointerLocked && game.screen === "none" && !game.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="rounded bg-black/70 px-6 py-3 text-lg font-bold text-white">Click to play</div>
        </div>
      )}
      {/* bottom HUD */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {showName && <div className="text-shadow mb-1 text-base font-bold text-white">{itemName(held.id)}</div>}
        {game.meta.mode === "survival" && (
          <div className="flex w-full items-end justify-between px-1">
            <div className="flex gap-0.5">{hearts}</div>
            <div className="flex gap-0.5">{bubbles}</div>
          </div>
        )}
        <div className="flex gap-0.5 rounded-sm bg-black/50 p-1">
          {Array.from({ length: HOTBAR }, (_, i) => (
            <Slot key={i} stack={inv.slots[i]} selected={inv.selected === i} size={50} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Heart({ state, low }: { state: 0 | 1 | 2; low: boolean }) {
  return (
    <svg viewBox="0 0 9 9" width="18" height="18" className={low && state > 0 ? "animate-pulse" : ""} shapeRendering="crispEdges">
      <path d="M1 1h2v1h3V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1z" fill="#000" opacity="0.6" />
      <path d="M1 2h2v1h3V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1z" fill="#3b3b3b" />
      {state === 2 && <path d="M1 2h2v1h3V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1z" fill="#e02020" />}
      {state === 1 && <path d="M1 2h2v1h1v4H3V6H2V5H1z" fill="#e02020" />}
      {state > 0 && <path d="M2 3h1v1H2z" fill="#ff8080" />}
    </svg>
  );
}
