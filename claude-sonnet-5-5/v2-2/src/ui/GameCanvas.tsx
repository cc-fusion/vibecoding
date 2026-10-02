import { useEffect, useRef } from 'react';
import { draw, DrawCfg, View } from '../game/render';
import { World } from '../game/mapgen';

type BaseCfg = Omit<DrawCfg, 'W' | 'H' | 'dpr' | 'view' | 'time'>;
interface Props {
  world: World;
  getCfg: () => BaseCfg;
  onFrame: (dt: number) => void;
  onTile: (x: number, y: number) => void;
  onHover: (p: { x: number; y: number } | null) => void;
}

export default function GameCanvas({ world, getCfg, onFrame, onTile, onHover }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const zoom = useRef({ z: 1, px: 0, py: 0 });
  const viewRef = useRef<View>({ scale: 10, ox: 0, oy: 0 });
  const fns = useRef({ getCfg, onFrame, onTile, onHover });
  fns.current = { getCfg, onFrame, onTile, onHover };
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  const computeView = () => {
    const { w, h } = size.current;
    const base = Math.min(w / (world.w + 1), h / (world.h + 0.6));
    const sc = base * zoom.current.z;
    viewRef.current = { scale: sc, ox: (w - world.w * sc) / 2 + zoom.current.px, oy: (h - world.h * sc) / 2 + zoom.current.py };
  };

  useEffect(() => {
    const el = box.current, c = cv.current;
    if (!el || !c) return;
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: Math.max(100, r.width), h: Math.max(100, r.height), dpr };
      c.width = Math.floor(size.current.w * dpr); c.height = Math.floor(size.current.h * dpr);
      c.style.width = size.current.w + 'px'; c.style.height = size.current.h + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    window.addEventListener('resize', resize);
    let raf = 0, last = performance.now(), alive = true;
    const ctx = c.getContext('2d');
    const loop = (t: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      try {
        fns.current.onFrame(dt);
        computeView();
        if (ctx) draw(ctx, { ...fns.current.getCfg(), W: size.current.w, H: size.current.h, dpr: size.current.dpr, view: viewRef.current, time: t / 1000 });
      } catch (e) { console.error(e); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const tileAt = (e: { clientX: number; clientY: number }) => {
    const r = cv.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: Math.floor((e.clientX - r.left - v.ox) / v.scale), y: Math.floor((e.clientY - r.top - v.oy) / v.scale) };
  };
  const inMap = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < world.w && p.y < world.h;

  const zoomBy = (f: number, cx?: number, cy?: number) => {
    const z = zoom.current, v = viewRef.current, { w, h } = size.current;
    const nz = Math.max(0.8, Math.min(4, z.z * f));
    const k = nz / z.z;
    const mx = cx ?? w / 2, my = cy ?? h / 2;
    // keep point under cursor fixed
    const wx = (mx - v.ox), wy = (my - v.oy);
    const newOx = mx - wx * k, newOy = my - wy * k;
    z.z = nz;
    const base = Math.min(w / (world.w + 1), h / (world.h + 0.6)) * nz;
    z.px = newOx - (w - world.w * base) / 2; z.py = newOy - (h - world.h * base) / 2;
    if (nz <= 1.001) { z.px = 0; z.py = 0; z.z = Math.max(0.8, nz); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') zoomBy(1.2);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-[#050a14]">
      <canvas
        ref={cv}
        className="block cursor-crosshair"
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={e => {
          const d = drag.current;
          if (d && d.id === e.pointerId) {
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (d.moved || Math.hypot(dx, dy) > 7) { d.moved = true; zoom.current.px += dx; zoom.current.py += dy; d.x = e.clientX; d.y = e.clientY; }
          } else if (e.pointerType === 'mouse') { const p = tileAt(e); fns.current.onHover(inMap(p) ? p : null); }
        }}
        onPointerUp={e => {
          const d = drag.current; drag.current = null;
          if (d && !d.moved && e.button !== 2) { const p = tileAt(e); if (inMap(p)) fns.current.onTile(p.x, p.y); }
        }}
        onPointerLeave={() => fns.current.onHover(null)}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={e => { const r = cv.current!.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }}
      />
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button className="btn !px-2 !py-0.5 text-lg" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
        <button className="btn !px-2 !py-0.5 text-lg" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
        <button className="btn !px-2 !py-0.5" onClick={() => { zoom.current = { z: 1, px: 0, py: 0 }; }} aria-label="Reset view">⌂</button>
      </div>
    </div>
  );
}
