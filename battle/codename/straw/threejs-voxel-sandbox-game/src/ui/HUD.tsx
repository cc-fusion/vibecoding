import { useEffect, useRef } from 'react';
import { Heart, Drumstick, CloudRain, CloudSnow, Sun, Moon, Feather, MousePointerClick } from 'lucide-react';
import type { Game, UIState } from '../game/game';
import { getItemIcon } from '../game/textures';
import { Slot } from './ItemIcon';
import { cn } from '../utils/cn';

function Hearts({ hp }: { hp: number }) {
  return (
    <div className="flex gap-[1px]">
      {Array.from({ length: 10 }, (_, i) => {
        const v = hp - i * 2;
        return (
          <span key={i} className="relative inline-block h-[18px] w-[18px]">
            <Heart size={18} className="absolute text-[#3d0a0e]" fill="#2a070a" strokeWidth={2.4} />
            {v >= 2 && <Heart size={18} className="absolute text-[#5c0d12]" fill="#e0232e" strokeWidth={2.4} />}
            {v === 1 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: 9 }}>
                <Heart size={18} className="text-[#5c0d12]" fill="#e0232e" strokeWidth={2.4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function Hunger({ hunger }: { hunger: number }) {
  return (
    <div className="flex flex-row-reverse gap-[1px]">
      {Array.from({ length: 10 }, (_, i) => {
        const v = hunger - i * 2;
        return (
          <span key={i} className="relative inline-block h-[18px] w-[18px]">
            <Drumstick size={18} className="absolute text-[#2e1c0c]" fill="#241608" strokeWidth={2.2} />
            {v >= 2 && <Drumstick size={18} className="absolute text-[#5f3c14]" fill="#c47a36" strokeWidth={2.2} />}
            {v === 1 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: 9 }}>
                <Drumstick size={18} className="text-[#5f3c14]" fill="#c47a36" strokeWidth={2.2} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function Bubbles({ air }: { air: number }) {
  if (air >= 9.9) return null;
  const full = Math.ceil(air);
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={cn('inline-block h-[11px] w-[11px] rounded-full border-2', i < full ? 'border-sky-200 bg-sky-400/70' : 'border-sky-200/30 bg-transparent')} />
      ))}
    </div>
  );
}

export function HUD({ ui, game }: { ui: UIState; game: Game }) {
  const mapRef = useRef<HTMLCanvasElement>(null);
  const inWorld = ui.screen !== 'title' && ui.screen !== 'loading';

  useEffect(() => {
    if (!ui.minimapOn || !inWorld) return;
    const draw = () => { if (mapRef.current) game.drawMinimap(mapRef.current); };
    draw();
    const t = setInterval(draw, 350);
    return () => clearInterval(t);
  }, [game, ui.minimapOn, inWorld]);

  if (!inWorld) return null;
  const showBars = ui.mode === 'survival';
  const heldFresh = Date.now() - ui.heldNameAt < 2300;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* crosshair */}
      {ui.screen === 'playing' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
          <div className="absolute top-1/2 left-1/2 h-[2px] w-[18px] -translate-x-1/2 -translate-y-1/2 bg-white" />
          <div className="absolute top-1/2 left-1/2 h-[18px] w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white" />
        </div>
      )}

      {/* overlays */}
      {ui.hurtFlash > 0 && <div key={ui.hurtFlash} className="hurt-flash absolute inset-0 bg-red-600/45" />}
      {showBars && ui.hp <= 6 && ui.hp > 0 && <div className="lowhp absolute inset-0" />}
      {ui.underwater && <div className="absolute inset-0 bg-blue-700/25 backdrop-blur-[1px]" />}
      {ui.inLavaView && <div className="absolute inset-0 bg-orange-600/50" />}

      {/* top-left status */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-md bg-black/45 px-2.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">
          {ui.isNight ? <Moon size={14} className="text-indigo-300" /> : <Sun size={14} className="text-amber-300" />}
          <span>Day {ui.day} · {ui.timeLabel}</span>
          <span className="text-white/40">|</span>
          {ui.weather === 'Rain' ? <CloudRain size={14} className="text-sky-300" /> : ui.weather === 'Snow' ? <CloudSnow size={14} className="text-sky-100" /> : <Sun size={14} className="text-white/50" />}
          <span className="text-white/85">{ui.weather}</span>
          {ui.fly && (<><span className="text-white/40">|</span><Feather size={14} className="text-emerald-300" /><span className="text-emerald-300">Flying</span></>)}
          {ui.mode === 'creative' && <span className="rounded bg-violet-500/70 px-1.5 py-px text-[10px] font-bold tracking-wide">CREATIVE</span>}
        </div>
        {ui.debug && (
          <div className="rounded-md bg-black/55 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-emerald-200 backdrop-blur-sm">
            <div>XYZ: {ui.pos.x} / {ui.pos.y} / {ui.pos.z}</div>
            <div>Biome: {ui.biome}</div>
            <div>FPS: {ui.fps} · Chunks: {ui.chunkCount}</div>
            <div>Mode: {ui.mode}{ui.fly ? ' · fly' : ''}</div>
          </div>
        )}
      </div>

      {/* minimap + toasts */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        {ui.minimapOn && (
          <div className="relative overflow-hidden rounded-lg border-2 border-black/60 shadow-xl">
            <canvas ref={mapRef} width={132} height={132} className="pixelated block" />
            <span className="absolute top-0.5 left-1/2 -translate-x-1/2 font-pixel text-[10px] text-white" style={{ textShadow: '1px 1px 0 #000' }}>N</span>
          </div>
        )}
        {ui.toasts.map(t => (
          <div key={t.id} className="toast-in mc-panel flex w-72 items-center gap-3 px-3 py-2.5">
            <div className="mc-slot flex h-11 w-11 shrink-0 items-center justify-center">
              <ToastIcon id={t.icon} />
            </div>
            <div className="min-w-0">
              <div className="font-pixel text-[12px] text-amber-300">{t.title}</div>
              <div className="truncate text-[12px] text-white/75">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* hint */}
      {ui.hint && ui.screen === 'playing' && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-[13px] font-medium whitespace-nowrap text-amber-100 backdrop-blur-sm">
          {ui.hint}
        </div>
      )}

      {/* held item name */}
      {heldFresh && ui.heldName && ui.screen === 'playing' && (
        <div key={ui.heldNameAt} className="held-fade absolute bottom-[104px] left-1/2 -translate-x-1/2 font-pixel text-[15px] text-white" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.55)' }}>
          {ui.heldName}
        </div>
      )}

      {/* bottom HUD: bars + hotbar */}
      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        {showBars && (
          <div className="flex w-[468px] items-end justify-between px-0.5">
            <Hearts hp={ui.hp} />
            <Bubbles air={ui.air} />
            <Hunger hunger={ui.hunger} />
          </div>
        )}
        <div className="mc-hotbar flex gap-[3px] rounded-lg p-[3px]">
          {ui.hotbar.map((s, i) => (
            <Slot key={i} stack={s} size={50} selected={ui.selected === i} hotkey={String(i + 1)} />
          ))}
        </div>
      </div>

      {/* click to lock */}
      {ui.lockNeeded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <div className="mc-panel flex items-center gap-3 px-5 py-3.5">
            <MousePointerClick className="text-emerald-300" />
            <div>
              <div className="font-pixel text-sm text-white">Click to play</div>
              <div className="text-xs text-white/60">Your mouse will be captured. Esc opens the menu.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToastIcon({ id }: { id: number }) {
  return <img src={getItemIcon(id)} alt="" width={34} height={34} className="pixelated" draggable={false} />;
}
