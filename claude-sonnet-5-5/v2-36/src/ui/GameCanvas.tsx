import { useEffect, useRef } from 'react';
import type { Game } from '../game/engine';
import { Renderer } from '../game/render';

export function GameCanvas({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const parent = cv.parentElement!;
    const ctx = cv.getContext('2d')!;
    const rend = new Renderer();
    let raf = 0, last = performance.now(), w = 1, h = 1, dpr = 1;
    const prev: boolean[] = [];

    const resize = () => {
      const r = parent.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
    };
    const ro = new ResizeObserver(resize); ro.observe(parent); resize();

    const toWorld = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect(); const v = rend.view;
      return { x: (e.clientX - r.left) / v.scale + v.camX, y: (e.clientY - r.top) / v.scale + v.camY };
    };
    const onDown = (e: PointerEvent) => { const p = toWorld(e); game.clickWorld(p.x, p.y); };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e); game.hover = p;
      if (e.buttons && game.phase === 'night' && !game.talk && !game.paused) {
        const n = game.npcs.find(q => q.visible && Math.hypot(q.x - p.x, q.y - p.y) < 30);
        if (!n) game.player.target = { x: Math.max(24, Math.min(1256, p.x)), y: Math.max(24, Math.min(736, p.y)) };
      }
    };
    const onLeave = () => { game.hover = null; };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', onLeave);

    const pollPad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && pads[0];
      if (!gp) { game.pad.x = 0; game.pad.y = 0; return; }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      game.pad.x = Math.abs(ax) > 0.2 ? ax : 0; game.pad.y = Math.abs(ay) > 0.2 ? ay : 0;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const edge = (i: number, fn: () => void) => { const now = b(i); if (now && !prev[i]) fn(); prev[i] = now; };
      edge(0, () => game.interact());
      edge(1, () => game.closeTalk());
      edge(2, () => game.dash());
      edge(5, () => game.dash());
      edge(9, () => game.setPaused(!game.paused));
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (game.phase !== 'night') return;
      pollPad();
      game.update(dt);
      rend.draw(ctx, game, w, h, dpr, now);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => { if (document.hidden && game.phase === 'night') game.setPaused(true); };
    const onBlur = () => { if (game.phase === 'night') game.setPaused(true); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur);
    };
  }, [game]);

  return <canvas ref={ref} className="absolute inset-0 block" style={{ touchAction: 'none', cursor: 'crosshair' }} />;
}
