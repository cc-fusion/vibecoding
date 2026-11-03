import { useEffect, useRef } from 'react';
import type { Game } from '../game/game';
import { useGame, useTick, Slot, Bar, Icon } from './common';
import { ACH } from '../game/game';

function Fx({ g }: { g: Game }) {
  const a = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null), c = useRef<HTMLDivElement>(null), d = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const p = g.player;
      if (a.current) a.current.style.opacity = g.underwaterFx ? '1' : '0';
      if (b.current) b.current.style.opacity = g.lavaFx ? '0.85' : '0';
      if (c.current) c.current.style.opacity = String(Math.min(0.55, (p ? p.hurtT : 0) * 1.4));
      if (d.current) d.current.style.opacity = String(Math.min(0.9, g.weather.flash * 0.8));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [g]);
  return (
    <>
      <div ref={a} className="pointer-events-none fixed inset-0 transition-opacity duration-150" style={{ background: 'radial-gradient(ellipse at center, rgba(30,90,200,.25), rgba(10,40,120,.55))', opacity: 0 }} />
      <div ref={b} className="pointer-events-none fixed inset-0" style={{ background: 'rgba(220,70,10,.7)', opacity: 0 }} />
      <div ref={c} className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(255,0,0,0), rgba(220,0,0,.75))', opacity: 0 }} />
      <div ref={d} className="pointer-events-none fixed inset-0 bg-white" style={{ opacity: 0 }} />
    </>
  );
}

function MiniMap({ g }: { g: Game }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    g.mapCanvas.style.cssText = 'width:150px;height:150px;image-rendering:pixelated;display:block;border-radius:2px';
    el.appendChild(g.mapCanvas);
    return () => { if (g.mapCanvas.parentNode === el) el.removeChild(g.mapCanvas); };
  }, [g]);
  return (
    <div className="fixed top-3 right-3 p-[3px] bg-black/70 border-2 border-black shadow-lg" style={{ boxShadow: 'inset 0 0 0 2px #6b5f52' }}>
      <div ref={ref} />
      <div className="text-[10px] text-center text-white/70 mt-0.5">N ↑  · M to hide</div>
    </div>
  );
}

export function Hud({ g }: { g: Game }) {
  useGame(g); useTick(140);
  const p = g.player;
  if (!p || g.hideHud) return <Fx g={g} />;
  const held = g.heldStack();
  const showChat = g.screen === 'chat';
  const lines = g.chat.filter((c) => showChat || g.time - c.at < 8).slice(-8);
  const d = g.dbg;
  return (
    <div className="pointer-events-none fixed inset-0 select-none">
      <Fx g={g} />
      {g.showMap && g.screen !== 'death' && <MiniMap g={g} />}
      {/* crosshair */}
      {g.screen === 'none' && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)', mixBlendMode: 'difference' }}>
          <div className="absolute bg-white" style={{ width: 2, height: 18, left: -1, top: -9 }} />
          <div className="absolute bg-white" style={{ width: 18, height: 2, left: -9, top: -1 }} />
        </div>
      )}
      {(g.settings.fps || g.showDebug) && <div className="absolute left-3 top-2 text-sm mc-text text-yellow-200">{g.fps} FPS</div>}
      {g.showDebug && (
        <div className="absolute left-3 top-8 text-[12px] leading-5 bg-black/50 px-2 py-1 rounded mc-text">
          <div>TerraCraft · {d.workers === 'main thread' ? 'main thread' : `${d.workers} workers`}</div>
          <div>XYZ: {d.pos}</div>
          <div>Chunk: {d.chunk} · Facing: {d.facing}</div>
          <div>Biome: {d.biome}</div>
          <div>Light: {d.light}</div>
          <div>Day {d.day} · time {d.time} · weather {d.weather}</div>
          <div>Chunks {d.chunks} · mobs {d.mobs} · items {d.items}</div>
          <div>Draw calls {d.calls} · tris {d.tris}</div>
          {g.target && <div className="text-cyan-200">Target: {g.target.x} {g.target.y} {g.target.z}</div>}
        </div>
      )}
      {/* toasts */}
      <div className="absolute right-3 top-44 flex flex-col gap-2 w-72">
        {g.toasts.map((t) => (
          <div key={t.id} className="toast panel px-3 py-2 flex gap-3 items-center">
            <div className="text-2xl">🏆</div>
            <div><div className="text-yellow-300 text-sm">Goal reached!</div><div className="text-[15px] leading-4">{t.t}</div><div className="text-[11px] text-white/60">{t.d}</div></div>
          </div>
        ))}
      </div>
      {/* chat log */}
      <div className="absolute left-3 bottom-24 w-[520px] max-w-[60vw] flex flex-col gap-[2px]">
        {lines.map((c, i) => (
          <div key={i} className="bg-black/45 px-2 py-[1px] text-[14px] mc-text" style={{ opacity: showChat ? 1 : Math.max(0, Math.min(1, 8 - (g.time - c.at))) }}>{c.text}</div>
        ))}
      </div>
      {/* vitals + hotbar */}
      <div className="absolute bottom-3 left-1/2 flex flex-col items-center gap-1" style={{ transform: 'translateX(-50%)' }}>
        {g.selNameT > 0 && g.selName && <div className="mc-text text-[15px] mb-1" style={{ opacity: Math.min(1, g.selNameT) }}>{g.selName}</div>}
        {!g.creative && (
          <div className="flex justify-between w-full px-1 items-end" style={{ width: 9 * 48 }}>
            <div className="flex flex-col gap-1">
              <Bar value={p.health} kind="heart" />
              {p.headInWater && p.air < 15 && (
                <div className="flex gap-[2px] h-3">{Array.from({ length: Math.ceil(p.air / 1.5) }).map((_, i) => <div key={i} className="w-3 h-3 rounded-full border-2 border-sky-200 bg-sky-400/50" />)}</div>
              )}
            </div>
            <Bar value={p.food} kind="food" />
          </div>
        )}
        <div className="flex p-[3px] bg-black/60 border-2 border-black" style={{ boxShadow: 'inset 0 0 0 2px #6b5f52' }}>
          {g.inv.slots.slice(0, 9).map((s, i) => (
            <div key={i} className="relative" style={{ outline: i === g.sel ? '3px solid #fff' : 'none', outlineOffset: -2, zIndex: i === g.sel ? 2 : 1 }}>
              <Slot stack={s} size={46} />
              <span className="absolute left-[3px] top-[1px] text-[10px] text-white/60">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
      {held && g.screen === 'none' && null}
      {g.creative && <div className="absolute left-1/2 bottom-20 -translate-x-1/2 text-[11px] text-yellow-200/70 mc-text">CREATIVE</div>}
    </div>
  );
}

export function ChatInput({ g }: { g: Game }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 0); }, []);
  return (
    <div className="fixed left-3 bottom-10 w-[520px] max-w-[60vw]">
      <input
        ref={ref}
        className="field"
        placeholder="Type a message or /command (try /help)"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { g.runCommand((e.target as HTMLInputElement).value); g.closeScreen(); }
          else if (e.key === 'Escape') g.closeScreen();
        }}
        onKeyUp={(e) => e.stopPropagation()}
        autoComplete="off"
      />
    </div>
  );
}

export function AdvScreen({ g }: { g: Game }) {
  useGame(g);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <div className="panel p-5 w-[560px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="text-2xl mc-text">Goals</div>
          <div className="text-sm text-yellow-200">{g.achieved.size} / {ACH.length}</div>
        </div>
        <div className="scroll overflow-y-auto pr-1 flex flex-col gap-2">
          {ACH.map((a) => {
            const done = g.achieved.has(a.id);
            return (
              <div key={a.id} className={'flex items-center gap-3 px-3 py-2 border-2 ' + (done ? 'border-yellow-500/70 bg-yellow-900/20' : 'border-white/10 bg-black/30 opacity-70')}>
                <div className="text-2xl">{done ? '🏆' : '🔒'}</div>
                <div><div className={done ? 'text-yellow-200' : ''}>{a.t}</div><div className="text-[12px] text-white/60">{a.d}</div></div>
              </div>
            );
          })}
        </div>
        <button className="btn mt-4" onClick={() => g.closeScreen()}>Close</button>
      </div>
    </div>
  );
}

export { Icon };
