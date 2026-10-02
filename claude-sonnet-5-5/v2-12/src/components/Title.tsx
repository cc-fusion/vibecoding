import { useEffect, useRef } from 'react';
import { Btn } from './ui';
import { Save } from '../game/save';

function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.floor(w * dpr));
      cv.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, w, h);
      const masses = [0, 1, 2].map((i) => ({
        x: w / 2 + Math.cos(t * (0.25 + i * 0.1) + i * 2.1) * w * (0.22 + i * 0.07),
        y: h / 2 + Math.sin(t * (0.3 + i * 0.08) + i * 1.3) * h * (0.2 + i * 0.06),
        m: 9000 + i * 5000,
      }));
      const step = Math.max(34, Math.min(w, h) / 14);
      const cols = Math.ceil(w / step) + 2;
      const rows = Math.ceil(h / step) + 2;
      const pts: [number, number][] = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = i * step - step / 2;
          const y = j * step - step / 2;
          let dx = 0;
          let dy = 0;
          for (const m of masses) {
            const vx = m.x - x;
            const vy = m.y - y;
            const d2 = vx * vx + vy * vy + 2500;
            const k = m.m / d2 / 6;
            dx += vx * k * 0.06;
            dy += vy * k * 0.06;
          }
          const l = Math.hypot(dx, dy);
          const cap = step * 0.9;
          if (l > cap) {
            dx = (dx / l) * cap;
            dy = (dy / l) * cap;
          }
          pts.push([x + dx, y + dy]);
        }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(90,140,255,0.35)';
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        for (let i = 0; i < cols; i++) {
          const p = pts[j * cols + i];
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          const p = pts[j * cols + i];
          if (j === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      masses.forEach((m, i) => {
        const g = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, 60 + i * 12);
        g.addColorStop(0, i === 1 ? 'rgba(255,79,154,0.9)' : 'rgba(79,240,255,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 60 + i * 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 9 + i * 2, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

const TIPS = [
  'Heavy pieces bend beams. Stand behind a Bulwark and shots curl around it.',
  'Black holes are lethal. Push, pull, and lure enemies into them.',
  'Press G to reveal the gravity field. Arrows on pieces preview end-of-round drift.',
  'Brace adds +3 mass - perfect to anchor yourself against a well.',
  'Firing along the field gives +1 damage. Fire against it and you lose 1.',
];

export default function Title({
  save, onPlay, onHelp, onSettings,
}: {
  save: Save;
  onPlay: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const tip = TIPS[(save.totals.battles + save.cleared) % TIPS.length];
  const started = save.cleared > 0 || save.totals.battles > 0;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#05060f]/40 to-[#05060f]/90" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div>
          <div className="font-display text-xs tracking-[0.6em] text-cyan-300/80 sm:text-sm">TACTICS IN CURVED SPACE</div>
          <h1 className="font-display mt-2 text-4xl font-black leading-tight tracking-wider text-white drop-shadow-[0_0_24px_rgba(79,240,255,0.6)] sm:text-6xl md:text-7xl">
            GRAVITY<br />
            <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">CHESS</span>
          </h1>
        </div>
        <div className="flex w-64 flex-col gap-3">
          <Btn variant="primary" onClick={onPlay} className="py-3 text-base">{started ? 'Continue Campaign' : 'Begin Campaign'}</Btn>
          <Btn onClick={onHelp}>How to Play</Btn>
          <Btn onClick={onSettings}>Settings</Btn>
        </div>
        <p className="max-w-md text-sm text-slate-400">
          <span className="text-cyan-300">TIP</span> · {tip}
        </p>
        {started && (
          <p className="text-xs text-slate-500">
            Battles {save.totals.battles} · Victories {save.totals.wins} · Kills {save.totals.kills} · Swallowed by holes {save.totals.hazard}
          </p>
        )}
      </div>
    </div>
  );
}
