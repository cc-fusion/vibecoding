import { useEffect, useRef } from 'react';
import type { SimHandle } from './useSimulation';

const TOOL_BRUSH_COLOR: Record<string, string> = {
  wall: '#d9c39a',
  erase: '#f87171',
  addAnts: '#ffffff',
  removeAnts: '#f87171',
  addFood: '#a3e635',
  addNest: '#ffffff',
};

export function WorldCanvas({ sim }: { sim: SimHandle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef(sim);
  simRef.current = sim;
  const drag = useRef<{ kind: 'none' | 'food' | 'nest' | 'paint'; lastX: number; lastY: number; spawnTimer: number }>({ kind: 'none', lastX: 0, lastY: 0, spawnTimer: 0 });

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = simRef.current;
      const opts = { ...s.renderOptsRef.current, brush: s.brushRef.current };
      s.renderer.draw(ctx, s.world, cssW, cssH, opts);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return simRef.current.renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const brushRadius = (tool: string) => {
    const s = simRef.current;
    if (tool === 'wall' || tool === 'erase') return s.world.params.wallBrush;
    if (tool === 'removeAnts') return 24;
    if (tool === 'addAnts') return 12;
    if (tool === 'addFood') return 4 + Math.sqrt(s.world.params.foodQuantity) * 0.8;
    if (tool === 'addNest') return 22;
    return 0;
  };

  const updateBrush = (x: number, y: number) => {
    const s = simRef.current;
    const r = brushRadius(s.tool);
    if (r > 0 && s.world.inBounds(x, y)) s.brushRef.current = { x, y, radius: r, color: TOOL_BRUSH_COLOR[s.tool] ?? '#fff' };
    else s.brushRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const s = simRef.current;
    const { x, y } = toWorld(e);
    if (!s.world.inBounds(x, y)) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const w = s.world;
    const d = drag.current;
    d.lastX = x; d.lastY = y; d.kind = 'none'; d.spawnTimer = 0;
    switch (s.tool) {
      case 'select': {
        const ant = w.antAt(x, y, 8);
        if (ant) { s.setSelectedAnt(ant); s.setSelectedFood(null); s.setSelectedNest(null); break; }
        const food = w.foodAt(x, y);
        if (food) { s.setSelectedFood(food); s.setSelectedAnt(null); s.setSelectedNest(null); d.kind = 'food'; break; }
        const nest = w.nestAt(x, y);
        if (nest) { s.setSelectedNest(nest); s.setSelectedAnt(null); s.setSelectedFood(null); d.kind = 'nest'; break; }
        s.setSelectedAnt(null); s.setSelectedFood(null); s.setSelectedNest(null);
        break;
      }
      case 'addFood': {
        const f = w.addFood(x, y);
        s.setSelectedFood(f);
        break;
      }
      case 'removeFood': {
        const f = w.foodAt(x, y);
        if (f) w.removeFood(f.id);
        break;
      }
      case 'addNest': {
        const n = w.addNest(s.activeColonyId, x, y);
        s.setSelectedNest(n);
        break;
      }
      case 'removeNest': {
        const n = w.nestAt(x, y);
        if (n) w.removeNest(n.id);
        break;
      }
      case 'addAnts':
        w.spawnAnts(s.activeColonyId, x, y, w.params.antBrush);
        d.kind = 'paint';
        break;
      case 'removeAnts':
        w.removeAntsNear(x, y, 24);
        d.kind = 'paint';
        break;
      case 'wall':
        w.walls.paint(x, y, w.params.wallBrush, true);
        d.kind = 'paint';
        break;
      case 'erase':
        w.walls.paint(x, y, w.params.wallBrush, false);
        d.kind = 'paint';
        break;
    }
    s.refresh();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = simRef.current;
    const { x, y } = toWorld(e);
    updateBrush(x, y);
    const d = drag.current;
    if (d.kind === 'none') return;
    const w = s.world;
    const inside = w.inBounds(x, y);
    const cx = inside ? x : d.lastX;
    const cy = inside ? y : d.lastY;
    if (d.kind === 'food' && s.selectedFood) { s.selectedFood.x = cx; s.selectedFood.y = cy; }
    else if (d.kind === 'nest' && s.selectedNest) { s.selectedNest.x = cx; s.selectedNest.y = cy; }
    else if (d.kind === 'paint') {
      switch (s.tool) {
        case 'wall': w.walls.paintLine(d.lastX, d.lastY, cx, cy, w.params.wallBrush, true); break;
        case 'erase': w.walls.paintLine(d.lastX, d.lastY, cx, cy, w.params.wallBrush, false); break;
        case 'removeAnts': w.removeAntsNear(cx, cy, 24); break;
        case 'addAnts': {
          const moved = Math.hypot(cx - d.lastX, cy - d.lastY);
          d.spawnTimer += moved;
          if (d.spawnTimer > 30) { d.spawnTimer = 0; w.spawnAnts(s.activeColonyId, cx, cy, Math.max(1, Math.round(w.params.antBrush / 2))); }
          break;
        }
      }
    }
    d.lastX = cx; d.lastY = cy;
  };

  const onPointerUp = () => {
    drag.current.kind = 'none';
    simRef.current.refresh();
  };

  const onLeave = () => {
    simRef.current.brushRef.current = null;
  };

  const cursor = sim.tool === 'select' ? 'default' : 'crosshair';

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
