import { useEffect, useRef } from "react";
import { audio } from "../game/audio";
import type { Game } from "../game/engine";
import { clamp, fromPixel } from "../game/hex";
import { render, screenToWorld } from "../game/render";
import { writeSave } from "../game/save";
import { Hud } from "./Hud";
import { CombatModal, EventModal, InfoModal, JournalModal, LandmarkModal } from "./Modals";
import { PauseMenu, EndScreen } from "./Screens";
import { useGameSync } from "./ui";

interface Props {
  g: Game;
  onRetry: () => void;
  onArchive: () => void;
  onTitle: () => void;
}

const MOVE_KEYS: Record<string, number> = { d: 0, e: 1, q: 2, a: 3, z: 4, c: 5 };

export function GameView({ g, onRetry, onArchive, onTitle }: Props) {
  useGameSync(g);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 600 });
  const ptr = useRef<{
    pts: Map<number, { x: number; y: number }>;
    down: boolean; button: number; sx: number; sy: number; moved: boolean; camx: number; camy: number;
    drawing: boolean; lastKey: string; pinch: number; pinchZoom: number;
  }>({ pts: new Map(), down: false, button: 0, sx: 0, sy: 0, moved: false, camx: 0, camy: 0, drawing: false, lastKey: "", pinch: 0, pinchZoom: 1 });

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let dpr = 1;
    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: Math.max(200, r.width), h: Math.max(200, r.height) };
      canvas.width = Math.floor(size.current.w * dpr);
      canvas.height = Math.floor(size.current.h * dpr);
      canvas.style.width = size.current.w + "px";
      canvas.style.height = size.current.h + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    window.addEventListener("resize", resize);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      g.cam.zoom = clamp(g.cam.zoom * Math.exp(-e.deltaY * 0.0012), 0.5, 2.2);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      g.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, g, size.current.w, size.current.h, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [g]);

  // keyboard + visibility
  useEffect(() => {
    const toggleMute = () => {
      const s = g.save.settings;
      s.muted = !s.muted;
      audio.setVolumes({ muted: s.muted });
      writeSave(g.save);
      g.emit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (g.over || g.dying) return;
      const pan = ["arrowup", "arrowdown", "arrowleft", "arrowright", "+", "=", "-", "_"].includes(k);
      if (e.repeat && !pan) return;
      if (k === "m") { toggleMute(); return; }
      if (k === "escape") {
        e.preventDefault();
        const m = g.modal;
        if (g.paused) { g.paused = false; g.emit(); return; }
        if (m) {
          if (m.type === "journal" || m.type === "info" || m.type === "landmark" || (m.type === "event" && m.result !== null)) g.closeModal();
          else if (m.type === "combat" && m.c.over) g.closeCombat();
          return;
        }
        g.paused = true;
        g.emit();
        return;
      }
      if (g.paused) return;
      const m = g.modal;
      if (m) {
        const digit = parseInt(k, 10);
        if (m.type === "combat") {
          if (m.c.over) { if (k === "enter" || k === " ") { e.preventDefault(); g.closeCombat(); } return; }
          const map: Record<string, string> = { "1": "strike", "2": "flare", "3": "brace", "4": "parley", "5": "flee", h: "tonic", g: "laud", "6": "gilded" };
          if (map[k]) g.combatAct(map[k]);
        } else if (m.type === "event") {
          if (m.result === null && digit >= 1) g.eventChoose(digit - 1);
          else if (m.result !== null && (k === "enter" || k === " ")) { e.preventDefault(); g.closeModal(); }
        } else if (m.type === "landmark") {
          if (digit >= 1) g.landmarkAct(digit - 1);
        } else if (m.type === "journal") {
          if (k === "j") g.closeModal();
        } else if (m.type === "info" && (k === "enter" || k === " ")) {
          e.preventDefault();
          g.closeModal();
        }
        return;
      }
      if (k in MOVE_KEYS) { e.preventDefault(); g.keyMove(MOVE_KEYS[k]); return; }
      const step = 40 / g.cam.zoom;
      switch (k) {
        case "arrowup": e.preventDefault(); g.cam.manual = true; g.cam.y -= step; break;
        case "arrowdown": e.preventDefault(); g.cam.manual = true; g.cam.y += step; break;
        case "arrowleft": e.preventDefault(); g.cam.manual = true; g.cam.x -= step; break;
        case "arrowright": e.preventDefault(); g.cam.manual = true; g.cam.x += step; break;
        case "+": case "=": g.cam.zoom = clamp(g.cam.zoom * 1.1, 0.5, 2.2); break;
        case "-": case "_": g.cam.zoom = clamp(g.cam.zoom / 1.1, 0.5, 2.2); break;
        case " ": e.preventDefault(); g.cam.manual = false; break;
        case "1": g.tool = "walk"; audio.sfx("click"); g.emit(); break;
        case "2": g.tool = "quill"; audio.sfx("click"); g.emit(); break;
        case "3": g.tool = "pin"; audio.sfx("click"); g.emit(); break;
        case "r": g.camp(); break;
        case "s": g.quickSurvey(); break;
        case "f": case "enter": g.interact(); break;
        case "j": g.openJournal(); break;
        case "h": g.useItem("tonic"); break;
        case "g": g.useItem("laud"); break;
      }
    };
    const onVis = () => {
      if (document.hidden && !g.over && !g.dying && !g.paused) {
        g.paused = true;
        g.emit();
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [g]);

  const tileFromEvent = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const w = screenToWorld(g, e.clientX - r.left, e.clientY - r.top, size.current.w, size.current.h);
    const a = fromPixel(w.x, w.y);
    const t = g.tileAt(a.q, a.r);
    return { a, t };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    audio.resume();
    const p = ptr.current;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pts.size === 2) {
      const [a, b] = [...p.pts.values()];
      p.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      p.pinchZoom = g.cam.zoom;
      p.drawing = false;
      p.moved = true;
      return;
    }
    p.down = true;
    p.button = e.button;
    p.sx = e.clientX;
    p.sy = e.clientY;
    p.moved = false;
    p.camx = g.cam.x;
    p.camy = g.cam.y;
    const { t } = tileFromEvent(e);
    if (e.button === 2) {
      if (t) g.togglePin(t);
      p.down = false;
      return;
    }
    if (e.button === 0 && g.tool === "quill" && !g.locked()) {
      p.drawing = true;
      if (t) {
        p.lastKey = t.q + "," + t.r;
        g.chartTile(t);
      }
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = ptr.current;
    if (p.pts.has(e.pointerId)) p.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pts.size === 2 && p.pinch > 0) {
      const [a, b] = [...p.pts.values()];
      g.cam.zoom = clamp(p.pinchZoom * (Math.hypot(a.x - b.x, a.y - b.y) / p.pinch), 0.5, 2.2);
      return;
    }
    const { a, t } = tileFromEvent(e);
    g.setHover(t ? a : null);
    if (!p.down) return;
    const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
    if (p.drawing) {
      if (t) {
        const k = t.q + "," + t.r;
        if (k !== p.lastKey) {
          p.lastKey = k;
          g.chartTile(t);
        }
      }
      return;
    }
    if (!p.moved && Math.hypot(dx, dy) > 6) p.moved = true;
    if (p.moved) {
      g.cam.manual = true;
      g.cam.x = p.camx - dx / g.cam.zoom;
      g.cam.y = p.camy - dy / g.cam.zoom;
    }
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = ptr.current;
    p.pts.delete(e.pointerId);
    if (p.pts.size < 2) p.pinch = 0;
    if (!p.down) return;
    p.down = false;
    if (p.drawing) {
      p.drawing = false;
      return;
    }
    if (!p.moved && e.button === 0) {
      const { t } = tileFromEvent(e);
      if (t) {
        g.cam.manual = false;
        g.clickTile(t);
      }
    }
  };

  const lowSan = g.sanity < 35 && g.save.settings.psycho;
  const m = g.modal;
  return (
    <div className={`absolute inset-0 overflow-hidden ${lowSan ? "anim-madness" : ""}`}>
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => g.setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: g.tool === "quill" ? "crosshair" : g.tool === "pin" ? "copy" : "pointer" }}
        />
      </div>
      <Hud g={g} />
      {!g.over && m?.type === "event" && <EventModal g={g} />}
      {!g.over && m?.type === "landmark" && <LandmarkModal g={g} />}
      {!g.over && m?.type === "combat" && <CombatModal g={g} />}
      {!g.over && m?.type === "journal" && <JournalModal g={g} />}
      {!g.over && m?.type === "info" && <InfoModal g={g} title={m.title} body={m.body} emoji={m.emoji} />}
      {g.paused && !g.over && (
        <PauseMenu
          onResume={() => { g.paused = false; g.emit(); }}
          onAbandon={() => { g.paused = false; g.end("abandon"); }}
          onQuit={onTitle}
        />
      )}
      {g.dying && g.dying.kind !== "victory" && g.dying.kind !== "abandon" && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 65, background: g.dying.kind === "mad" ? "radial-gradient(circle,transparent,rgba(60,10,90,0.85))" : "radial-gradient(circle,transparent,rgba(110,10,10,0.85))", animation: "fadeUp 1s ease both" }} />
      )}
      {g.over && (
        <EndScreen
          over={g.over}
          onRetry={onRetry}
          onArchive={onArchive}
          onTitle={onTitle}
          onContinue={g.over.win ? () => { g.over = null; g.free = true; g.paused = false; g.banner = { id: g.uid++, text: "Free Roam", sub: "The Unwriting has ended. Explore at leisure.", t: 3 }; g.emit(); } : undefined}
        />
      )}
    </div>
  );
}
