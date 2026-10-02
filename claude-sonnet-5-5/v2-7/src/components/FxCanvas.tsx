import { useEffect, useRef } from "react";
import { fx } from "../game/fx";

// Full-screen overlay that renders particles/floating text and applies screen shake to #shake-root.
export default function FxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1); w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
    };
    resize(); window.addEventListener("resize", resize);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      fx.update(dt, w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      fx.draw(ctx);
      const root = document.getElementById("shake-root");
      if (root) {
        if (fx.shakeMag > 0) root.style.transform = `translate(${(Math.random() - 0.5) * fx.shakeMag}px, ${(Math.random() - 0.5) * fx.shakeMag}px)`;
        else if (root.style.transform) root.style.transform = "";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-[100]" />;
}
