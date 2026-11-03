import { useHud } from "../game/store";
import { ItemIcon } from "./ItemIcon";
import { getName } from "../game/blocks";

function Hearts({ health, max }: { health: number; max: number }) {
  const hearts = [];
  for (let i = 0; i < max / 2; i++) {
    const v = health - i * 2;
    const fill = v >= 2 ? 1 : v === 1 ? 0.5 : 0;
    hearts.push(
      <svg key={i} className="heart" viewBox="0 0 18 18">
        <path d="M9 16 L2 9 Q0 6 2.5 3.5 Q5 1.5 9 5 Q13 1.5 15.5 3.5 Q18 6 16 9 Z" fill="#3a0a0a" stroke="#1a0000" strokeWidth="1" />
        {fill > 0 && (
          <clipPath id={`hc${i}`}>
            <rect x="0" y="0" width={fill === 1 ? 18 : 9} height="18" />
          </clipPath>
        )}
        {fill > 0 && <path d="M9 16 L2 9 Q0 6 2.5 3.5 Q5 1.5 9 5 Q13 1.5 15.5 3.5 Q18 6 16 9 Z" fill={health <= 4 ? "#ff6a6a" : "#e8303a"} clipPath={`url(#hc${i})`} />}
        {fill > 0 && <path d="M4 5 Q5 3.5 7 4.5" stroke="#ffb0b0" strokeWidth="1.3" fill="none" clipPath={`url(#hc${i})`} />}
      </svg>,
    );
  }
  return <div className={`flex gap-[1px] ${health <= 4 ? "pulse-soft" : ""}`}>{hearts}</div>;
}

function Food({ hunger }: { hunger: number }) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const v = hunger - i * 2;
    const fill = v >= 2 ? 1 : v === 1 ? 0.5 : 0;
    items.push(
      <svg key={i} className="drum" viewBox="0 0 18 18">
        <g transform="rotate(-40 9 9)">
          <ellipse cx="7" cy="8" rx="5.5" ry="4.5" fill="#3a2410" stroke="#1a1000" strokeWidth="1" />
          <rect x="11" y="7" width="6" height="2.4" fill="#3a2a1a" />
          {fill > 0 && (
            <clipPath id={`fc${i}`}>
              <rect x="0" y="0" width={fill === 1 ? 18 : 7} height="18" />
            </clipPath>
          )}
          {fill > 0 && <ellipse cx="7" cy="8" rx="5.5" ry="4.5" fill="#b8692c" clipPath={`url(#fc${i})`} />}
          {fill > 0 && <rect x="11" y="7" width="6" height="2.4" fill="#e9dcc0" clipPath={`url(#fc${i})`} />}
        </g>
      </svg>,
    );
  }
  return <div className="flex flex-row-reverse gap-[1px]">{items}</div>;
}

export function HUD({ onClickToPlay }: { onClickToPlay: () => void }) {
  const hud = useHud();
  const showStats = !hud.creative;
  const level = Math.floor(hud.xp / 10);
  const xpPct = (hud.xp % 10) / 10;
  return (
    <div className="pointer-events-none fixed inset-0 select-none text-white">
      {/* overlays */}
      {hud.underwater && <div className="absolute inset-0 bg-[#1b4fa0]/35" />}
      {hud.hurtFlash > 0 && <div className="absolute inset-0 bg-red-600" style={{ opacity: hud.hurtFlash * 0.35 }} />}
      {hud.sleepFade > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: hud.sleepFade }} />}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.35)" }} />

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
        <div className="relative h-5 w-5">
          <div className="absolute left-1/2 top-0 h-5 w-[2px] -translate-x-1/2 bg-white" />
          <div className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 bg-white" />
        </div>
      </div>
      {hud.breakProgress > 0 && (
        <div className="absolute left-1/2 top-1/2 mt-5 h-1 w-14 -translate-x-1/2 bg-black/60">
          <div className="h-full bg-white" style={{ width: `${hud.breakProgress * 100}%` }} />
        </div>
      )}

      {/* target name */}
      {hud.targetName && (
        <div className="absolute left-1/2 top-[calc(50%-48px)] -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs font-semibold tracking-wide text-white/90">{hud.targetName}</div>
      )}

      {/* top-left info */}
      <div className="absolute left-3 top-3 text-xs font-semibold text-white/90 drop-shadow-[1px_1px_0_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/40 px-2 py-0.5">🕒 {hud.timeString}</span>
          <span className="rounded bg-black/40 px-2 py-0.5">🌍 {hud.biome}</span>
          {hud.flying && <span className="rounded bg-black/40 px-2 py-0.5">✈ Flying</span>}
        </div>
      </div>

      {/* debug */}
      {hud.debug.length > 0 && (
        <div className="absolute left-3 top-12 space-y-0.5 font-mono text-[12px] leading-tight text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.9)]">
          {hud.debug.map((l, i) => (
            <div key={i} className="w-fit bg-black/40 px-1">
              {l}
            </div>
          ))}
        </div>
      )}

      {/* toasts */}
      <div className="absolute right-3 top-3 flex w-72 flex-col gap-2">
        {hud.toasts.map((t) => (
          <div key={t.id} className={`toast mc-panel flex items-center gap-3 px-3 py-2 ${t.kind === "achievement" ? "border-yellow-500/70" : ""}`}>
            {t.icon !== undefined ? <ItemIcon id={t.icon} size={32} /> : <div className="h-8 w-8" />}
            <div className="min-w-0">
              <div className={`text-sm font-bold ${t.kind === "achievement" ? "text-yellow-300" : ""}`}>{t.kind === "achievement" ? "Achievement unlocked!" : t.title}</div>
              <div className="truncate text-xs text-white/80">{t.kind === "achievement" ? t.title : t.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* bottom bar */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        {showStats && (
          <div className="flex w-[484px] items-end justify-between px-1">
            <Hearts health={hud.health} max={hud.maxHealth} />
            <div className="flex flex-col items-end gap-1">
              {hud.air < hud.maxAir && (
                <div className="flex gap-[1px]">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`h-3 w-3 rounded-full border border-black/60 ${hud.air / hud.maxAir > i / 10 ? "bg-sky-300" : "bg-transparent"}`} />
                  ))}
                </div>
              )}
              <Food hunger={hud.hunger} />
            </div>
          </div>
        )}
        {showStats && (
          <div className="relative h-[6px] w-[484px] border border-black/70 bg-black/50">
            <div className="h-full bg-lime-400" style={{ width: `${xpPct * 100}%` }} />
            {level > 0 && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm font-bold text-lime-300 drop-shadow-[1px_1px_0_#000]">{level}</div>}
          </div>
        )}
        <div className="flex">
          {hud.hotbar.map((s, i) => (
            <div key={i} className={`hotbar-slot relative flex items-center justify-center ${i === hud.selected ? "selected" : ""}`}>
              {s && (
                <>
                  <ItemIcon id={s.id} size={38} />
                  {s.count > 1 && <span className="absolute bottom-0 right-1 text-sm font-bold drop-shadow-[1px_1px_0_#000]">{s.count}</span>}
                </>
              )}
            </div>
          ))}
        </div>
        {hud.hotbar[hud.selected] && <div className="text-sm font-semibold drop-shadow-[1px_1px_0_#000]">{getName(hud.hotbar[hud.selected]!.id)}</div>}
      </div>

      {/* click to play */}
      {!hud.pointerLocked && hud.screen === "playing" && (
        <div className="pointer-events-auto absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30" onClick={onClickToPlay}>
          <div className="mc-panel px-8 py-5 text-center">
            <div className="text-xl font-bold">Click to play</div>
            <div className="mt-1 text-sm text-white/70">Mouse look · WASD move · Space jump · Ctrl sprint · Shift sneak · E inventory</div>
          </div>
        </div>
      )}
    </div>
  );
}
